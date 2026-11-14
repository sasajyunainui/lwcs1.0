/*
 * LWCS 技能设计台数据层（独立浏览器脚本）
 * ------------------------------------------------------------------
 * 用途：给新 UI 原型提供与原版 SillyTavern 技能设计台（lwcs/mvu_logic_bridge.js）一致的
 *       「技能 → 表单 → 字段描述 → 保存技能 / 临时技能 / 摘要 / 校验」数据层，不含任何 DOM 渲染。
 * 依赖：页面须先加载 MVU_Skill_Runtime.js（提供 __LWCS_SKILL_MECHANISM_REGISTRY__、
 *       __LWCS_COMPILE_SKILL_STRUCTURE_TEXT__、__LWCS_SKILL_COST_HELPERS_V1__ 等）。
 * 结构：
 *   一、原版代码：由 build_model.js 依赖闭包从 bridge 逐字抽取（每段标注 B:行号），勿手改；
 *   二、预览页局部量切片：技能设计台分支内的模板上下文（标题提示表、融合选项等），逐字切片；
 *   三、移植层：把原版「渲染 HTML → 挂载同步 → DOM 回读」改写为纯数据，并对外暴露 window.LWCS_DESIGNER_MODEL。
 * 生成时间：2026-11-08T06:40:42.069Z；抽取 465 段顶层声明。
 *
 * 用法（M = window.LWCS_DESIGNER_MODEL，root 缺省用 setRoot() 的值，再缺省 window.LWCS_SAVE）：
 *   const meta = M.meta.ring('唐凌雪','第1武魂','第1魂灵','第2魂环','第2魂技', 魂技名);   // 也有 fusion / art / custom / independentRing
 *   const s = M.session(null, meta, root);      // 推荐：有状态会话，保留虚拟 DOM，与原版设计台同生命周期
 *   s.view()  → { sections[{id,title,tab,hint,visible,fields}], rows[{path,prototypeSelect,fields}], sideEffects, preview:{summary,…} }
 *   s.act({ type:'effectField', path:[0], key:'数值', value:'-20%' })   // 动作见 act 说明；返回会话本身
 *   s.save() → { ok, skill, updates, messages }   s.toSkill() / s.tempSkill() / s.summary() / s.validate()
 *   无状态版：fromSkill / open / toSkill / save / tempSkill / summary / validate / act / view / schema.fields(effect, ctx)
 * 规则（与桥接现行代码一致）：任何来源都能保存修炼增益 / 战斗外复活；保存时忙碌态禁用的控件照常回读，条件分支不丢。
 * 规则开关：M.rules.物品被动保持承载方式（默认开）→ 物品技能（装备 / 魂骨附带）的「被动」开关 ⇔ 承载方式「被动」。
 */
(function () {
  if (typeof globalThis === 'undefined' || !globalThis.__LWCS_SKILL_MECHANISM_REGISTRY__) {
    console.error('[LWCS_DESIGNER_MODEL] 未检测到 __LWCS_SKILL_MECHANISM_REGISTRY__：请先加载 MVU_Skill_Runtime.js 再加载本脚本。');
  }
  // ════════════════ 一、原版代码（逐字抽取） ════════════════
  // —— B:2
  const __mvuBridgeRoot = typeof globalThis !== 'undefined' ? globalThis : window;
  // —— B:44-66
  const 读取正式技能结构翻译器 = () => {
    if (typeof __mvuBridgeRoot.__LWCS_COMPILE_SKILL_STRUCTURE_TEXT__ === 'function')
      return __mvuBridgeRoot.__LWCS_COMPILE_SKILL_STRUCTURE_TEXT__;
    try {
      if (
        window.parent &&
        window.parent !== window &&
        typeof window.parent.__LWCS_COMPILE_SKILL_STRUCTURE_TEXT__ === 'function'
      ) {
        return window.parent.__LWCS_COMPILE_SKILL_STRUCTURE_TEXT__;
      }
    } catch (错误) {}
    try {
      if (
        window.top &&
        window.top !== window &&
        typeof window.top.__LWCS_COMPILE_SKILL_STRUCTURE_TEXT__ === 'function'
      ) {
        return window.top.__LWCS_COMPILE_SKILL_STRUCTURE_TEXT__;
      }
    } catch (错误) {}
    return null;
  };
  // —— B:708-714
  function escapeHtmlAttr(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  // —— B:893-909
  const SPIRIT_ATTRIBUTE_TOKEN_OPTIONS = Object.freeze([
    '金',
    '木',
    '水',
    '火',
    '土',
    '风',
    '雷',
    '冰',
    '光',
    '暗',
    '精神',
    '空间',
    '时间',
    '创造',
    '毁灭',
  ]);
  // —— B:910
  const WUXING_ATTRIBUTE_TOKEN_OPTIONS = Object.freeze(['金', '木', '水', '火', '土']);
  // —— B:911
  const ELEMENT_ATTRIBUTE_TOKEN_OPTIONS = Object.freeze(['水', '火', '风', '土', '光', '暗']);
  // —— B:912
  const SKILL_LIMITED_ELEMENT_OPTIONS = Object.freeze(['五行类', '元素类', ...SPIRIT_ATTRIBUTE_TOKEN_OPTIONS]);
  // —— B:913-915
  function 规范化技能元素列表_桥接(value = []) {
    return Array.from(new Set(normalizeSkillDesignerArray(value).filter(token => SPIRIT_ATTRIBUTE_TOKEN_OPTIONS.includes(token))));
  }
  // —— B:1888
  let liveSnapshot = null;
  // —— B:1889
  let lastRenderableSnapshot = null;
  // —— B:2028-2035
  function htmlEscape(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  // —— B:2037-2040
  function hasUiPlaceholderToken(value) {
    const text = String(value === undefined || value === null ? '' : value).trim();
    return !!text && /待补全|待生成|未知|未详|不详/i.test(text);
  }
  // —— B:2042-2046
  function toText(value, fallback = '无') {
    if (value === undefined || value === null || value === '') return fallback;
    const text = String(value);
    return hasUiPlaceholderToken(text) ? fallback : text;
  }
  // —— B:2067-2070
  function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  // —— B:2132-2148
  function 获取载入器候选窗口() {
    const 列表 = [window];
    try {
      if (window.parent && window.parent !== window) 列表.push(window.parent);
    } catch (错误) {}
    try {
      if (window.top && window.top !== window && !列表.includes(window.top)) 列表.push(window.top);
    } catch (错误) {}
    for (const 当前窗口 of [...列表]) {
      try {
        Array.from(当前窗口.frames || []).forEach(子窗口 => {
          if (子窗口 && !列表.includes(子窗口)) 列表.push(子窗口);
        });
      } catch (错误) {}
    }
    return 列表;
  }
  // —— B:2150-2156
  function 读取窗口函数(键名) {
    for (const 目标窗口 of 获取载入器候选窗口()) {
      const 函数值 = 目标窗口 && typeof 目标窗口 === 'object' ? 目标窗口[键名] : null;
      if (typeof 函数值 === 'function') return 函数值.bind(目标窗口);
    }
    return null;
  }
  // —— B:2192-2203
  const 技能设计台分页定义 = Object.freeze([
    { 名称: '基础', 标题集: ['基础框架载体', '实体凝结参数', '融合对象', '功法进度'] },
    {
      名称: '效果',
      标题集: ['核心术式阵列', '使用效果阵列', '使用效果', '施展副作用', '使用副作用', '副作用'],
      // 副作用分区标题是动态的（造物承载时叫「施展副作用」，否则叫「副作用」），
      // 靠标记归页比匹配文字稳
      标记集: ['[data-skill-designer-side-effect-title]', '[data-skill-designer-prototype-title]'],
    },
    { 名称: '消耗与成长', 标题集: ['运转能量配置', '技能掌控度'] },
    { 名称: '属性与呈现', 标题集: ['元属性特征', '终端解析图谱'] },
  ]);
  // —— B:2526-2528
  function formatNumber(value) {
    return new Intl.NumberFormat('zh-CN').format(toNumber(value, 0));
  }
  // —— B:2902-2911
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
  // —— B:2913-2915
  function safeEntries(obj) {
    return obj && typeof obj === 'object' ? Object.entries(obj) : [];
  }
  // —— B:2939-2942
  function 读取槽位序号_桥接(槽位名 = '', 默认值 = 1) {
    const 匹配 = String(槽位名 || '').match(/第(\d+)/);
    return Math.max(1, Math.floor(Number(匹配 ? 匹配[1] : 默认值) || 默认值 || 1));
  }
  // —— B:2944-2946
  function 是武魂槽位键_桥接(键 = '') {
    return /^第\d+武魂$/.test(String(键 || '').trim());
  }
  // —— B:2948-2950
  function 是魂灵槽位键_桥接(键 = '') {
    return /^第\d+魂灵$/.test(String(键 || '').trim());
  }
  // —— B:2952-2954
  function 是魂环槽位键_桥接(键 = '') {
    return /^第\d+魂环$/.test(String(键 || '').trim());
  }
  // —— B:2956-2958
  function 是魂技槽位键_桥接(键 = '') {
    return /^第\d+魂技(?:_2)?$/.test(String(键 || '').trim());
  }
  // —— B:2960-2962
  function 是气血魂环槽位键_桥接(键 = '') {
    return /^第\d+气血魂环$/.test(String(键 || '').trim());
  }
  // —— B:2964-2966
  function 是血脉魂技槽位键_桥接(键 = '') {
    return /^第\d+血脉魂技(?:_2)?$/.test(String(键 || '').trim());
  }
  // —— B:2968-2970
  function 取槽位条目_桥接(对象 = {}, 判断函数 = () => false) {
    return safeEntries(对象).filter(([键, 值]) => 判断函数(键) && 值 && typeof 值 === 'object' && !Array.isArray(值));
  }
  // —— B:2972-2974
  function 取角色武魂条目_桥接(角色 = {}) {
    return 取槽位条目_桥接(角色, 是武魂槽位键_桥接);
  }
  // —— B:2976-2981
  function 取角色主武魂系别_桥接(角色 = {}, fallback = '强攻系') {
    const 条目 = 取角色武魂条目_桥接(角色);
    const 第1武魂 = 条目.find(([键]) => 键 === '第1武魂')?.[1] || 条目[0]?.[1] || {};
    const 系别 = normalizeSkillUiText(第1武魂?.系别 || 第1武魂?.type, '');
    return 系别 && 系别 !== '未知系' ? 系别 : fallback;
  }
  // —— B:2983-2985
  function 取武魂魂灵条目_桥接(武魂 = {}) {
    return 取槽位条目_桥接(武魂, 是魂灵槽位键_桥接);
  }
  // —— B:2987-2989
  function 取武魂直接魂环条目_桥接(武魂 = {}) {
    return 取槽位条目_桥接(武魂, 是魂环槽位键_桥接);
  }
  // —— B:2991-2993
  function 取魂灵魂环条目_桥接(魂灵 = {}) {
    return 取槽位条目_桥接(魂灵, 是魂环槽位键_桥接);
  }
  // —— B:2995-2997
  function 取魂环魂技条目_桥接(魂环 = {}) {
    return 取槽位条目_桥接(魂环, 是魂技槽位键_桥接);
  }
  // —— B:2999-3001
  function 取血脉气血魂环条目_桥接(血脉 = {}) {
    return 取槽位条目_桥接(血脉, 是气血魂环槽位键_桥接);
  }
  // —— B:3003-3005
  function 取气血魂环魂技条目_桥接(魂环 = {}) {
    return 取槽位条目_桥接(魂环, 是血脉魂技槽位键_桥接);
  }
  // —— B:4702-4710
  function cloneJsonValue(value, fallback = {}) {
    try {
      return structuredClone(value);
    } catch (error) {}
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {}
    return fallback;
  }
  // —— B:17301-17303
  function isTodoPlaceholderText(value) {
    return hasUiPlaceholderToken(value);
  }
  // —— B:17305-17311
  function normalizeSkillUiText(value, fallback = '未知') {
    const text = toText(value, '')
      .replace(/\[续台推演\]\s*/g, '')
      .trim();
    if (!text || text === '无' || text === '未生成' || isTodoPlaceholderText(text)) return fallback;
    return text;
  }
  // —— B:17313-17345
  function 格式化技能消耗显示文本_桥接(消耗值, 兜底文本 = '无') {
    if (消耗值 === undefined || 消耗值 === null || 消耗值 === '') return 兜底文本;
    if (typeof 消耗值 !== 'object') return normalizeSkillUiText(消耗值, 兜底文本);
    const 格式化原子值 = 值 => {
      if (值 === undefined || 值 === null || 值 === '') return '';
      if (typeof 值 === 'number') return Number.isFinite(值) ? formatNumber(值) : '';
      if (typeof 值 === 'string') return normalizeSkillUiText(值, '');
      return '';
    };
    const 格式化资源对象 = 资源对象 => {
      if (!资源对象 || typeof 资源对象 !== 'object') return 格式化原子值(资源对象);
      return Object.entries(资源对象)
        .filter(([资源名]) => !['启动', 'upfront', '维持', 'sustain'].includes(String(资源名 || '')))
        .map(([资源名, 数值]) => {
          const 文本 = 格式化原子值(数值);
          return 文本 ? `${资源名}:${文本}` : '';
        })
        .filter(Boolean)
        .join(' | ');
    };
    if (Array.isArray(消耗值)) {
      const 文本 = 消耗值.map(条目 => 格式化技能消耗显示文本_桥接(条目, '')).filter(Boolean).join(' | ');
      return 文本 || 兜底文本;
    }
    const 启动消耗 = 消耗值.启动 || 消耗值.upfront || null;
    const 维持消耗 = 消耗值.维持 || 消耗值.sustain || null;
    const 基础文本 = 格式化资源对象(启动消耗 || 消耗值);
    const 维持文本 = 格式化资源对象(维持消耗);
    const 片段 = [];
    if (基础文本) 片段.push(基础文本);
    if (维持文本) 片段.push(`维持:${维持文本}`);
    return 片段.join(' ') || 兜底文本;
  }
  // —— B:17385-17403
  function summarizeSummonEffectUi(effect) {
    const 单位类型 = normalizeSkillUiText(effect && effect['召唤单位类型'], '魂兽');
    const 名称 = normalizeSkillUiText(effect && effect['召唤物名称'], '召唤物');
    const 数量 = Math.max(1, toNumber(effect && (effect['数量'] ?? effect['召唤数量']), 1));
    const 持续回合 = Math.max(0, toNumber(effect && effect['持续回合'], 0));
    const 行动模式 = normalizeSkillUiText(effect && effect['行动模式'], '');
    const 强度 = Number(effect && effect['强度']);
    const 继承比例 = Math.max(0, Math.min(1, toNumber(effect && effect['继承属性比例'], 0)));
    const 使用继承 = 继承比例 > 0;
    return [
      `召唤${单位类型}【${名称}】×${数量}`,
      行动模式,
      !使用继承 && Number.isFinite(强度) ? `强度:${强度}` : '',
      使用继承 ? `平均继承:${Math.round(继承比例 * 100)}%` : '',
      持续回合 > 0 ? `持续:${持续回合}回合` : '',
    ]
      .filter(Boolean)
      .join(' / ');
  }
  // —— B:17418
  const SKILL_DESIGNER_PREVIEW_PREFIX = '技能设计台：';
  // —— B:17420
  const SKILL_DESIGNER_SELF_FUSION_PARTNER = '自身双武魂';
  // —— B:17421-17425
  const SHARED_SKILL_MECHANISM_REGISTRY =
    __mvuBridgeRoot.__LWCS_SKILL_MECHANISM_REGISTRY__ &&
    typeof __mvuBridgeRoot.__LWCS_SKILL_MECHANISM_REGISTRY__ === 'object'
      ? __mvuBridgeRoot.__LWCS_SKILL_MECHANISM_REGISTRY__
      : null;
  // —— B:17426
  const SKILL_DESIGNER_MECHANISM_META = Object.freeze(SHARED_SKILL_MECHANISM_REGISTRY?.机制定义 || {});
  // —— B:17427
  const SKILL_DESIGNER_PROTOTYPE_REGISTRY = Object.freeze(SHARED_SKILL_MECHANISM_REGISTRY?.原型定义 || {});
  // —— B:17428
  const 技能设计台机制抹消可匹配字段表 = Object.freeze(SHARED_SKILL_MECHANISM_REGISTRY?.机制抹消可匹配字段 || {});
  // —— B:17429
  const 技能设计台嵌套效果数组字段表 = Object.freeze(SHARED_SKILL_MECHANISM_REGISTRY?.嵌套效果数组字段 || []);
  // —— B:17430
  const 技能设计台条件分支效果数组字段表 = Object.freeze(SHARED_SKILL_MECHANISM_REGISTRY?.条件分支效果数组字段 || []);
  // —— B:17432-17454
  const 技能设计台机制抹消支持原型默认选项 = Object.freeze([
    '资源变化',
    '资源转移',
    '护盾变化',
    '属性修正',
    '判定修正',
    '结算修正',
    '炸环',
    '状态施加',
    '时窗修正',
    '状态移除',
    '规则防御',
    '状态转移',
    '状态交换',
    '资源锁定',
    '规则改写',
    '机制授予',
    '复制执行',
    '时光回溯',
    '位移执行',
    '决策干扰',
    '召唤生成',
  ]);
  // —— B:17455
  const 技能设计台机制授予禁止授予原型集合 = new Set(['伤害结算', '机制授予', '修炼增益', '战斗外复活']);
  // —— B:17456-17458
  const 技能设计台机制授予允许授予原型集合 = new Set(
    Object.keys(SKILL_DESIGNER_PROTOTYPE_REGISTRY || {}).filter(原型 => !技能设计台机制授予禁止授予原型集合.has(normalizeSkillUiText(原型, ''))),
  );
  // —— B:17460-17469
  function 技能设计台原型支持驱动判定字段(原型 = '', 字段 = {}) {
    const 原型名 = normalizeSkillUiText(原型, '');
    if (原型名 === '结算修正') {
      const 支持字段 = 技能设计台结算修正支持字段矩阵[normalizeSkillUiText(字段 && 字段['结算'], '')];
      return !!支持字段 && 支持字段.includes('驱动属性') && 支持字段.includes('影响方向');
    }
    const 定义 = SKILL_DESIGNER_PROTOTYPE_REGISTRY[原型名];
    const 字段列表 = Array.isArray(定义 && 定义['允许字段']) ? 定义['允许字段'] : [];
    return 字段列表.includes('驱动属性') && 字段列表.includes('影响方向');
  }
  // —— B:17481-17494
  function 技能设计台原型命中绝对值默认无驱动(字段 = {}) {
    if (!字段 || typeof 字段 !== 'object') return false;
    const 数值列表 = ['数值', '结算倍率', '转化比例', '概率'].flatMap(key => {
      const 原值 = 字段[key];
      if (原值 === undefined || 原值 === null) return [];
      return Array.isArray(原值) ? 原值 : [原值];
    });
    if (!数值列表.length) return false;
    return 数值列表.every(原值 => {
      if (typeof 原值 === 'number') return Number.isFinite(原值);
      const 文本 = normalizeSkillUiText(原值, '');
      return !!文本 && 技能设计台字段值是数值修正(文本) && !技能设计台字段值是百分比修正(文本);
    });
  }
  // —— B:17496-17507
  function 技能设计台原型需要默认驱动判定(原型 = '', 字段 = {}) {
    const 原型名 = normalizeSkillUiText(原型, '');
    if (!字段 || typeof 字段 !== 'object') return false;
    if (原型名 === '伤害结算') return false;
    if (!技能设计台原型支持驱动判定字段(原型名, 字段)) return false;
    if (原型名 === '时光回溯') return true;
    if (原型名 === '机制授予') return true;
    if (原型名 === '复制执行') return /属性|全部/.test(normalizeSkillUiText(字段['复制类型'], ''));
    if (normalizeSkillUiText(字段['目标'], '') === '自身' && 原型名 !== '位移执行') return false;
    if (原型名 === '状态施加') return !技能设计台原型命中绝对值默认无驱动(字段);
    return !技能设计台原型命中绝对值默认无驱动(字段);
  }
  // —— B:17509-17515
  function 读取技能设计台影响方向选项值(原型 = '', 字段 = {}) {
    const 原始选项 = 读取技能设计台原型字段选项(原型, '影响方向', { 当前效果: 字段 });
    return (Array.isArray(原始选项) ? 原始选项 : []).flatMap(选项 => {
      if (选项 && typeof 选项 === 'object' && Array.isArray(选项.options)) return 选项.options;
      return [选项];
    }).map(选项 => normalizeSkillUiText(选项 && typeof 选项 === 'object' ? 选项.value : 选项, '')).filter(Boolean);
  }
  // —— B:17517-17537
  function 选择技能设计台默认影响方向(原型 = '', 字段 = {}, fallback = '效果强度') {
    const 原型名 = normalizeSkillUiText(原型, '');
    const 结算 = normalizeSkillUiText(字段 && 字段['结算'], '');
    const 调整字段 = normalizeSkillUiText(字段 && 字段['调整字段'], '');
    let 默认方向 = fallback;
    if (原型名 === '位移执行') 默认方向 = '效果强度';
    else if (原型名 === '状态施加') 默认方向 = '效果强度';
    else if (原型名 === '复制执行') 默认方向 = '效果强度';
    else if (['判定修正', '决策干扰', '机制抹消', '资源锁定', '规则改写'].includes(原型名))
      默认方向 = '成功率';
    else if (原型名 === '机制授予') 默认方向 = '效果强度';
    else if (原型名 === '结算修正' && 结算 === '消耗分摊') 默认方向 = '效果强度';
    else if (原型名 === '结算修正' && 结算 === '消耗') 默认方向 = '消耗';
    else if (原型名 === '结算修正' && 结算 === '前摇') 默认方向 = '前摇';
    else if (原型名 === '时光回溯') 默认方向 = '成功率';
    else if (原型名 === '时窗修正') 默认方向 = ['持续回合', '有效期tick'].includes(调整字段) ? '持续时间' : '效果强度';
    else if (原型名 === '状态移除') 默认方向 = '成功率';
    else 默认方向 = '效果强度';
    const 选项列表 = 读取技能设计台影响方向选项值(原型名, 字段);
    return 选项列表.includes(默认方向) ? 默认方向 : 选项列表[0] || fallback;
  }
  // —— B:17539-17573
  function 应用技能设计台目标驱动契约(原型 = '', 字段 = {}) {
    if (!字段 || typeof 字段 !== 'object') return;
    const 原型名 = normalizeSkillUiText(原型, '');
    if (字段['__显式无驱动属性']) {
      delete 字段['驱动属性'];
      delete 字段['影响方向'];
      return;
    }
    if (原型名 === '伤害结算' || !技能设计台原型支持驱动判定字段(原型名, 字段)) {
      delete 字段['驱动属性'];
      delete 字段['影响方向'];
      return;
    }
    if (!['机制授予', '时光回溯', '位移执行', '复制执行'].includes(原型名) && normalizeSkillUiText(字段['目标'], '') === '自身') {
      delete 字段['驱动属性'];
      delete 字段['影响方向'];
      return;
    }
    if (!技能设计台原型需要默认驱动判定(原型名, 字段)) {
      delete 字段['驱动属性'];
      delete 字段['影响方向'];
      return;
    }
    if (String(字段['驱动属性'] ?? '').trim() === '无') {
      delete 字段['驱动属性'];
      delete 字段['影响方向'];
      return;
    }
    if (!normalizeSkillUiText(字段['驱动属性'], ''))
      字段['驱动属性'] = 选择技能设计台默认驱动属性(原型名, 字段);
    const 首个方向 = 选择技能设计台默认影响方向(原型名, 字段, '效果强度');
    const 方向选项 = 读取技能设计台影响方向选项值(原型名, 字段);
    if (!normalizeSkillUiText(字段['影响方向'], '') || !方向选项.includes(normalizeSkillUiText(字段['影响方向'], '')))
      字段['影响方向'] = 首个方向;
  }
  // —— B:17574
  const SKILL_DESIGNER_MECHANISM_COMPILER_TABLE = Object.freeze(SHARED_SKILL_MECHANISM_REGISTRY?.机制编译表 || {});
  // —— B:17575-17587
  const SKILL_DESIGNER_SKILL_TYPES = Object.freeze([
    '输出',
    '控制',
    '辅助',
    '防御',
    '回复',
    '位移',
    '领域',
    '被动',
    '真身',
    '召唤',
    '造物',
  ]);
  // —— B:17588-17603
  const SKILL_DESIGNER_SOURCE_TYPE_TO_SKILL_TYPE = Object.freeze({
    强攻系: '输出',
    敏攻系: '输出',
    元素系: '输出',
    精神系: '控制',
    控制系: '控制',
    防御系: '防御',
    辅助系: '辅助',
    食物系: '造物',
    治疗系: '回复',
    召唤系: '召唤',
    武魂融合技: '输出',
    功法: '被动',
    自创魂技: '输出',
    血脉被动: '被动',
  });
  // —— B:17604
  const SKILL_DESIGNER_TARGET_OPTIONS = Object.freeze(['自身', '单体', '群体', '全场', '召唤物']);
  // —— B:17605
  const SKILL_DESIGNER_CLONE_TARGET_OPTIONS = Object.freeze([...SKILL_DESIGNER_TARGET_OPTIONS, '分身']);
  // —— B:17606-17662
  const SKILL_DESIGNER_MAIN_MECHANIC_POOL = Object.freeze(
    SHARED_SKILL_MECHANISM_REGISTRY?.mainArchetypes || {
      伤害类: Object.freeze(['单体伤害', '群体伤害', '多段伤害', '持续伤害']),
      控制类: Object.freeze(['硬控', '软控', '迟缓', '节奏打断', '封技']),
      削弱类: Object.freeze([
        '单属性削弱',
        '多属性削弱',
        '禁疗',
        '消耗',
        '前摇',
        '掌控压制',
        '速度压制',
        '治疗反转',
      ]),
      增益类: Object.freeze([
        '单属性增益',
        '多属性增益',
        '全属性增益',
        '消耗',
        '前摇',
        '掌控提升',
        '速度提升',
        '修炼增益',
      ]),
      防御类: Object.freeze([
        '护盾',
        '承伤修正',
        '免伤',
        '霸体',
        '免死/锁血',
        '无敌金身',
        '伤害反射',
        '伤害转移',
        '伤害分摊',
        '消耗分摊',
      ]),
      回复类: Object.freeze(['体力恢复', '魂力恢复', '精神恢复', '持续恢复', '净化/解控']),
      '感知/认知类': Object.freeze(['感知干扰', '标记锁定', '共享视野', '幻境', '催眠', '认知扭曲']),
      位移类: Object.freeze(['自身位移', '强制位移', '位移交换', '追击位移', '脱离位移']),
      特殊规则类: Object.freeze([
        '召唤',
        '分身',
        '复制',
        '反制',
        '转化',
        '状态交换',
        '状态转移',
        '强制绑定/锁定',
        '规则改写',
        '引爆持续伤害',
        '斩盾',
        '吞噬',
        '能力共享',
        '机制抹消',
      ]),
    },
  );
  // —— B:17663-17666
  const SKILL_DESIGNER_DELIVERY_FORM_POOL = Object.freeze([
    '直接生效',
    '造物承载',
  ]);
  // —— B:17667-17681
  const SKILL_DESIGNER_DELIVERY_FORM_BY_TYPE = Object.freeze({
    强攻系: Object.freeze(['直接生效']),
    控制系: Object.freeze(['直接生效']),
    食物系: Object.freeze(['造物承载', '直接生效']),
    精神系: Object.freeze(['直接生效']),
    防御系: Object.freeze(['直接生效']),
    敏攻系: Object.freeze(['直接生效']),
    元素系: Object.freeze(['直接生效']),
    辅助系: Object.freeze(['直接生效', '造物承载']),
    治疗系: Object.freeze(['直接生效', '造物承载']),
    召唤系: Object.freeze(['直接生效']),
    被动: Object.freeze(['直接生效']),
    功法: Object.freeze(['直接生效']),
    自创魂技: Object.freeze(['直接生效', '造物承载']),
  });
  // —— B:17682-17693
  const SKILL_DESIGNER_ATTRIBUTE_HINTS_BY_TYPE = Object.freeze({
    强攻系: Object.freeze(['力量', '魂力', '防御']),
    控制系: Object.freeze(['魂力', '精神力', '敏捷']),
    食物系: Object.freeze(['魂力', '精神力']),
    精神系: Object.freeze(['精神力', '魂力']),
    防御系: Object.freeze(['防御', '魂力']),
    敏攻系: Object.freeze(['敏捷', '力量', '魂力']),
    元素系: Object.freeze(['精神力', '魂力', '敏捷']),
    辅助系: Object.freeze(['魂力', '精神力', '防御']),
    治疗系: Object.freeze(['魂力', '精神力']),
    召唤系: Object.freeze(['精神力', '魂力', '防御']),
  });
  // —— B:17694-17791
  const SKILL_DESIGNER_SECONDARY_BY_MAIN = Object.freeze(
    SHARED_SKILL_MECHANISM_REGISTRY?.secondaryByMain || {
      伤害类: Object.freeze([
        '穿透',
        '伤害吸收',
        '斩杀补伤',
        '流血DOT',
        '打断',
        '反击',
        '追击',
        '引爆持续伤害',
        '斩盾',
        '吞噬',
      ]),
      控制类: Object.freeze(['打断', '沉默', '减速', '致盲', '迟缓', '禁疗', '嘲讽', '破隐', '封技']),
      削弱类: Object.freeze([
        '禁疗',
        '减速',
        '迟缓',
        '标记弱点',
        '驱散增益',
        '破隐',
        '治疗反转',
        '封技',
        '斩盾',
        '吞噬',
        '机制抹消',
      ]),
      增益类: Object.freeze([
        '小护盾',
        '净化',
        '解控',
        '共享视野',
        '隐身',
        '护卫',
        '无敌金身',
        '能力共享',
        '修炼增益',
      ]),
      防御类: Object.freeze([
        '小护盾',
        '反击',
        '净化',
        '解控',
        '护卫',
        '嘲讽',
        '无敌金身',
        '伤害反射',
        '伤害转移',
        '伤害分摊',
        '消耗分摊',
      ]),
      回复类: Object.freeze([
        '净化',
        '解控',
        '小护盾',
        '魂力恢复',
        '精神恢复',
        '驱散增益',
        '护卫',
        '能力共享',
        '修炼增益',
      ]),
      '感知/认知类': Object.freeze([
        '标记弱点',
        '共享视野',
        '目标锁定',
        '打断',
        '沉默',
        '驱散增益',
        '窃取增益',
        '破隐',
      ]),
      位移类: Object.freeze(['打断', '反击', '标记弱点', '隐身', '破隐']),
      特殊规则类: Object.freeze([
        '共享视野',
        '标记弱点',
        '净化',
        '驱散增益',
        '窃取增益',
        '隐身',
        '护卫',
        '状态转移',
        '引爆持续伤害',
        '斩盾',
        '吞噬',
        '能力共享',
        '机制抹消',
        '治疗反转',
        '封技',
        '无敌金身',
        '伤害反射',
        '伤害转移',
        '伤害分摊',
        '消耗分摊',
      ]),
    },
  );
  // —— B:17792-17825
  const SKILL_DESIGNER_SECONDARY_TYPE_BIAS = Object.freeze(
    SHARED_SKILL_MECHANISM_REGISTRY?.secondaryTypeBias || {
      强攻系: Object.freeze(['斩盾', '引爆持续伤害', '无敌金身', '伤害反射', '反击', '追击']),
      防御系: Object.freeze(['伤害反射', '护卫']),
      敏攻系: Object.freeze(['隐身', '追击', '破隐', '无敌金身', '斩盾']),
      控制系: Object.freeze([
        '封技',
        '治疗反转',
        '目标锁定',
        '驱散增益',
        '嘲讽',
        '伤害分摊',
        '状态转移',
        '吞噬',
        '机制抹消',
      ]),
      精神系: Object.freeze([
        '状态转移',
        '封技',
        '治疗反转',
        '窃取增益',
        '目标锁定',
        '隐身',
        '吞噬',
        '能力共享',
        '机制抹消',
      ]),
      元素系: Object.freeze(['引爆持续伤害', '斩盾', '封技', '治疗反转', '驱散增益', '破隐', '吞噬', '机制抹消']),
      辅助系: Object.freeze(['护卫', '共享视野', '驱散增益', '无敌金身', '伤害分摊', '消耗分摊', '能力共享']),
      治疗系: Object.freeze(['护卫', '驱散增益', '共享视野', '无敌金身', '伤害分摊', '消耗分摊', '能力共享']),
      食物系: Object.freeze(['修炼增益', '驱散增益', '共享视野', '治疗反转', '护卫', '能力共享']),
      召唤系: Object.freeze(['共享视野', '护卫', '能力共享', '伤害分摊']),
    },
  );
  // —— B:17826
  const SKILL_DESIGNER_TARGET_SEMANTICS = Object.freeze(SHARED_SKILL_MECHANISM_REGISTRY?.目标语义表 || {});
  // —— B:17852-17854
  const SKILL_DESIGNER_ALL_SECONDARY_OPTIONS = Object.freeze(
    Array.from(new Set(Object.values(SKILL_DESIGNER_SECONDARY_BY_MAIN).flat())).sort(),
  );
  // —— B:17855-17871
  const SKILL_DESIGNER_ATTRIBUTE_OPTIONS = Object.freeze([
    '金',
    '木',
    '水',
    '火',
    '土',
    '风',
    '雷',
    '冰',
    '光',
    '暗',
    '精神',
    '空间',
    '时间',
    '创造',
    '毁灭',
  ]);
  // —— B:17872
  const SKILL_DESIGNER_RESOURCE_TYPE_OPTIONS = Object.freeze(['无', '魂力', '精神力', '体力', '混合']);
  // —— B:17873
  const SKILL_DESIGNER_COST_RESOURCE_KEYS = Object.freeze(['魂力', '精神力', '体力']);
  // —— B:17874-18063
  const 技能设计台参数提示表 = Object.freeze({
    交出状态: '状态交换时你交给对方的状态。',
    位移幅度: '移动的距离或格数。',
    修正数值: '在原值基础上加减多少；填百分比按比例，填数字按绝对值。',
    削弱属性: '要压低目标的哪一项属性。',
    增幅对象: '要提升哪一项属性。',
    属性组: '同时作用的多项属性。',
    压制幅度: '压低的幅度。',
    压缩倍率: '压缩后每回合的伤害倍率。',
    压缩回合: '压缩后剩余的回合数。',
    转化规则: '压缩时剩余伤害怎么处理。',
    延长回合: '延长几个回合。',
    层数变化: '延长时叠层数怎么变。',
    去向: '状态转移的接收方。',
    来源: '状态转移的提供方。',
    状态筛选: '只转移符合条件的状态。',
    数量: '一次处理几个。',
    吸收来源: '按打出的伤害转化，还是按挨到的伤害转化。',
    固定强度: '不随属性缩放的固定强度值。',
    力量继承: '召唤物继承你力量的比例。',
    防御继承: '召唤物继承你防御的比例。',
    敏捷继承: '召唤物继承你敏捷的比例。',
    体力继承: '召唤物继承你体力的比例。',
    魂力继承: '召唤物继承你魂力的比例。',
    精神继承: '召唤物继承你精神力的比例。',
    复活恢复比例: '复活后恢复多少生命。',
    规则: '要改写的战斗规则。',
    规则持续回合: '改写后的规则维持几个回合。',
    封禁元素: '要封禁的元素类别。',
    封禁强度: '封禁的强度。',
    限定元素: '只对指定元素的技能生效。',
    强化倍率: '炸环时的强化倍率。',
    打断时机: '在目标动作的哪个阶段打断。',
    收益倍率: '修炼收益提升的倍率。',
    效果倍率: '技能效果放大的倍率。',
    每回合燃烧: '每回合损失的资源量。',
    燃烧资源: '被持续损失的资源种类。',
    锁定类型: '锁定回复、锁定使用，还是两者。',
    锁定资源: '被锁定的资源种类。',
    锁定比例: '锁定的比例。',
    气运修正: '对气运判定的修正值。',
    致盲回合: '致盲持续几个回合。',
    覆盖类型: '这条承伤修正覆盖哪类伤害。',
    转化比例: '吞噬所得转成自身资源的比例。',
    转移对象: '伤害转移的承接方。',
    转移比例: '转移出去的伤害比例。',
    迟缓幅度: '拉长出手间隔的幅度。',
    链接规则: '生命链接的分摊规则。',
    威力: '打出去的基础威力',
    威力倍率: '打出去的基础威力',
    对应等级: '物品或装备自身等级基准；非伤害物品效果超过该等级无效',
    强度倍率: '这招压出去的力道',
    攻击段数: '会结算几次',
    作用范围: '能打到哪里',
    作用半径: '能覆盖多大',
    段数: '分成几段结算',
    单段倍率: '每一段的力道',
    延迟时长: '多久续爆发',
    爆发倍率: '爆发时的力道',
    触发条件: '什么时候生效',
    触发次数: '最多触发几次',
    每跳倍率: '每次跳伤的力道',
    持续回合: '能维持多久',
    控制回合: '能控多久',
    沉默回合: '能封多久',
    睡眠回合: '能睡多久',
    叠层上限: '最多叠几层',
    控制强度: '越高越难挣脱',
    控制幅度: '压低对方行动',
    命中条件: '怎样才算打中',
    解除条件: '怎样能摆脱',
    降低倍率: '压低到多少',
    削弱幅度: '削弱多少',
    压制倍率: '压低到多少',
    统一倍率: '统一压到多少',
    增益幅度: '提高多少',
    增幅倍率: '提高到多少',
    全属性倍率: '全属性提高多少',
    提高倍率: '提高到多少',
    提升倍率: '提高到多少',
    拉长倍率: '拖慢到多少',
    缩短倍率: '加快到多少',
    防护强度: '挡下多少压力',
    护盾倍率: '护盾厚度',
    护盾上限: '护盾按什么封顶',
    承伤修正: '少吃多少伤害',
    免伤次数: '能抵消几次伤害',
    单次上限: '单次最多挡多少',
    免控级别: '能挡住哪类控制',
    额外减伤: '额外少吃多少伤害',
    触发阈值: '低到哪里触发',
    锁血下限: '最低保留多少',
    每日触发: '一天能触发几次',
    反射比例: '反弹多少伤害',
    分摊比例: '分摊多少比例',
    分摊人数: '由几个人承担',
    抵消次数: '能抵消几次',
    回复倍率: '一次回多少',
    每回合倍率: '每回合回多少',
    生效次数: '会生效几次',
    清除条目数: '能清掉几项',
    净化优先级: '先清哪一类',
    附带收益: '清掉后附带什么',
    干扰强度: '干扰对方判断',
    标记时长: '标记保留多久',
    锁定目标数: '能锁几个目标',
    追踪规则: '目标怎么被追踪',
    共享范围: '能共享给谁',
    共享深度: '能看见多少',
    幻境范围: '幻境覆盖哪里',
    幻术强度: '幻境压迫程度',
    唤醒条件: '怎样醒来',
    扭曲强度: '认知被扭曲多少',
    命中增益: '更容易打中',
    锁定强度: '越高越难躲开',
    位移距离: '位移幅度',
    交换范围: '多远内可交换',
    交换条件: '怎样交换',
    追击距离: '追出去多远',
    追击窗口: '多久内能追上',
    追加倍率: '追击附带力道',
    脱离距离: '撤开多远',
    脱离条件: '怎样触发撤离',
    脱离收益: '撤离后获得什么',
    分身类型: '生成哪类分身',
    分身数量: '生成几个分身',
    隐蔽度: '越高越难发现',
    实力继承: '分身继承多少实力',
    分身称谓: '分身的名字',
    召唤单位类型: '召唤出的单位类别',
    召唤物名称: '召唤出的对象',
    召唤数量: '召唤几个',
    召唤强度: '非继承召唤的固定战力',
    力量继承比例: '继承召唤者多少力量',
    防御继承比例: '继承召唤者多少防御',
    敏捷继承比例: '继承召唤者多少敏捷',
    体力继承比例: '继承召唤者多少体力',
    魂力继承比例: '继承召唤者多少魂力',
    精神继承比例: '继承召唤者多少精神力',
    行动模式: '决定协同、护卫或自主行动',
    承伤规则: '召唤物怎么承伤',
    复制类型: '复制什么',
    复制模式: '怎样复制',
    保存上限: '最多保存几个复刻技能',
    削减比例: '属性复制时按比例削弱',
    可用次数: '能用几次',
    保留时长tick: '非战斗保留多久',
    反制对象: '反制哪类动作',
    反制倍率: '反制时的力道',
    转化方向: '把什么转成什么',
    转化比率: '转化多少',
    交换对象: '交换哪类状态',
    交换层数: '交换几层',
    转移模式: '状态怎么转移',
    转移条件: '怎样发生转移',
    绑定回合: '绑定多久',
    绑定目标数: '能绑几个',
    触发结果: '触发后发生什么',
    引爆倍率: '引爆时的力道',
    消耗规则: '引爆会消耗什么',
    吞噬资源: '吞噬哪种资源',
    吞噬比例: '吞噬多少',
    共享资源: '共享哪种资源',
    共享比例: '共享多少',
    抹消对象: '匹配哪个原型',
    穿透比例: '无视多少防护',
    穿透对象: '穿透哪类防护',
    吸收比例: '按伤害吸收多少',
    吸收资源: '吸收哪种资源',
    触发血线: '低到哪里触发',
    补伤倍率: '补上的力道',
    追加僵直: '让对方多停多久',
    反击条件: '什么时候反击',
    反击倍率: '反击时的力道',
    追击倍率: '追击时的力道',
    限制范围: '限制哪些动作',
    减速幅度: '减慢多少',
    影响内容: '影响哪类行动',
    禁疗幅度: '压住多少治疗',
    反转倍率: '治疗反成多少伤害',
    弱点类型: '暴露哪类弱点',
    驱散数量: '能驱散几项',
    窃取数量: '能偷几项',
    闪避增益: '更容易躲开',
    反应增益: '更容易反应',
    护卫减伤: '护卫时少吃多少',
    聚火规则: '敌人会优先打谁',
    中心等级: '发挥一半左右',
    圆满等级: '接近完整释放',
  });
  // —— B:18064
  const SKILL_ATTRIBUTE_DIM_KEYS = Object.freeze(['掌控', '威力', '消耗', '前摇', '控制', '速度']);
  // —— B:18178-18194
  const SKILL_DESIGNER_PACKED_PROPERTY_LABELS = Object.freeze({
    str: '力量',
    def: '防御',
    agi: '敏捷',
    vit_max: '体力上限',
    sp_max: '魂力上限',
    men_max: '精神力上限',
    vit: '体力',
    sp: '魂力',
    men: '精神力',
    掌控: '掌控',
    威力: '威力',
    消耗: '消耗',
    前摇: '前摇',
    控制: '控制',
    速度: '速度',
  });
  // —— B:18195-18211
  const SKILL_DESIGNER_PARAM_ATTRIBUTE_OPTIONS = Object.freeze([
    '力量',
    '防御',
    '敏捷',
    '体力上限',
    '魂力上限',
    '精神力上限',
    '体力',
    '魂力',
    '精神力',
    '掌控',
    '威力',
    '消耗',
    '前摇',
    '控制',
    '速度',
  ]);
  // —— B:18212-18226
  const SKILL_DESIGNER_PARAM_ATTRIBUTE_GROUP_OPTIONS = Object.freeze([
    '力量/防御',
    '力量/敏捷',
    '防御/敏捷',
    '力量/防御/敏捷',
    '体力上限/魂力上限',
    '体力上限/精神力上限',
    '魂力上限/精神力上限',
    '体力上限/魂力上限/精神力上限',
    '魂力/精神力',
    '掌控/威力',
    '掌控/控制',
    '消耗/前摇',
    '速度/敏捷',
  ]);
  // —— B:18227
  const SKILL_DESIGNER_PARAM_PANEL_OPTIONS = Object.freeze(['攻击', '防御', '回复', '速度', '控制']);
  // —— B:18228
  const SKILL_DESIGNER_PARAM_SUPPORT_TARGET_OPTIONS = SKILL_DESIGNER_TARGET_OPTIONS;
  // —— B:18229
  const SKILL_DESIGNER_PARAM_SHIELD_CAP_OPTIONS = Object.freeze(['基于体力', '基于魂力', '基于精神力']);
  // —— B:18230
  const SKILL_DESIGNER_PARAM_IMMUNE_LEVEL_OPTIONS = Object.freeze(['硬控', '软控', '全部控制']);
  // —— B:18231-18235
  const SKILL_DESIGNER_PARAM_CLEANSE_PRIORITY_OPTIONS = Object.freeze([
    '控制 > 削弱 > 异常',
    '削弱 > 控制 > 异常',
    '异常 > 控制 > 削弱',
  ]);
  // —— B:18236
  const SKILL_DESIGNER_PARAM_CLEANSE_GAIN_OPTIONS = Object.freeze(['回复', '护盾', '免疫']);
  // —— B:18237
  const SKILL_DESIGNER_PARAM_TRACKING_RULE_OPTIONS = Object.freeze(['不可脱锁', '共享坐标', '命中显形']);
  // —— B:18238
  const SKILL_DESIGNER_PARAM_INFO_DEPTH_OPTIONS = Object.freeze(['位置', '视野', '状态', '位置+视野', '完整共享']);
  // —— B:18239
  const SKILL_DESIGNER_PARAM_WAKE_RULE_OPTIONS = Object.freeze(['受伤', '净化', '时间结束']);
  // —— B:18240
  const SKILL_DESIGNER_PARAM_ESCAPE_GAIN_OPTIONS = Object.freeze(['隐匿', '护盾', '加速']);
  // —— B:18241
  const SKILL_DESIGNER_PARAM_COPY_TARGET_OPTIONS = Object.freeze(['复制技能', '复制属性', '复制全部']);
  // —— B:18242
  const 技能设计器参数复制模式选项 = Object.freeze(['即时镜像', '复刻友方']);
  // —— B:18243
  const SKILL_DESIGNER_PARAM_COUNTER_TARGET_OPTIONS = Object.freeze(['远程', '控制', '召唤', '近战']);
  // —— B:18244
  const SKILL_DESIGNER_PARAM_TRIGGER_RESULT_OPTIONS = Object.freeze(['爆发', '刷新', '召唤']);
  // —— B:18245-18248
  const SKILL_DESIGNER_PARAM_RULE_REWRITE_OPTIONS = Object.freeze([
    '束手',
    { value: '死亡转存活', label: '复活' },
  ]);
  // —— B:18249
  const 技能设计台规则改写选项值 = Object.freeze(normalizeSkillDesignerOptionList(SKILL_DESIGNER_PARAM_RULE_REWRITE_OPTIONS).map(item => item.value));
  // —— B:18250
  const 技能设计台战斗外可继承状态选项 = Object.freeze(SHARED_SKILL_MECHANISM_REGISTRY?.战斗外可继承技能状态选项 || ['中毒', '灼烧', '冻伤', '虚弱', '反噬', '精神紊乱', '魂力枯竭']);
  // —— B:18251
  const 技能设计台日常系统状态选项 = Object.freeze(SHARED_SKILL_MECHANISM_REGISTRY?.日常系统状态选项 || ['饥饿']);
  // —— B:18252
  const 技能设计台战斗外复活代价类型选项 = Object.freeze(['状态代价', '封印能力', '永久代价', '消耗实体物品']);
  // —— B:18253
  const 技能设计台战斗外复活物品代价对象选项 = Object.freeze(['神器', '魂骨', '复活类丹药', '绑定祭器']);
  // —— B:18254
  const 技能设计台战斗外复活封印代价对象选项 = Object.freeze(['武魂', '魂技', '魂环', '魂骨', '精神力', '魂力']);
  // —— B:18255
  const 技能设计台战斗外复活永久代价对象选项 = Object.freeze(['等级上限', '力量', '防御', '敏捷', '体力上限', '魂力上限', '精神力上限']);
  // —— B:18256
  const SKILL_DESIGNER_PARAM_CLONE_TYPE_OPTIONS = Object.freeze(['物理分身', '精神力分身']);
  // —— B:18257
  const 技能设计台召唤单位类型选项 = Object.freeze(['魂师', '魂兽', '本命召唤兽', '分身', '深渊生物', '其他召唤生物']);
  // —— B:18258
  const 技能设计台召唤承伤规则选项 = Object.freeze(['可承伤', '护卫承伤', '分摊承伤']);
  // —— B:18259
  const SKILL_DESIGNER_PARAM_PENETRATION_TARGET_OPTIONS = Object.freeze(['防御', '护盾', '抗性']);
  // —— B:18260
  const 技能设计台伤害转移对象选项 = Object.freeze(['攻击者', '攻击方队友', '攻击方任意', '防守方队友']);
  // —— B:18261
  const 技能设计台伤害吸收来源选项 = Object.freeze(['造成伤害', '受到伤害']);
  // —— B:18262
  const 技能设计台伤害吸收资源选项 = Object.freeze(['生命', '体力', '魂力', '精神力']);
  // —— B:18263
  const 技能设计台资源锁定类型选项 = Object.freeze(['资源池锁定', '回复锁定', '转化锁定']);
  // —— B:18264
  const SKILL_DESIGNER_PARAM_RESOURCE_TRANSFER_TYPE_OPTIONS = Object.freeze(['魂力', '精神力', '双资源']);
  // —— B:18265-18269
  const 技能设计台机制抹消对象原型选项 = Object.freeze(
    Array.isArray(SHARED_SKILL_MECHANISM_REGISTRY?.机制抹消支持原型)
      ? SHARED_SKILL_MECHANISM_REGISTRY.机制抹消支持原型.filter(原型 => SKILL_DESIGNER_PROTOTYPE_REGISTRY?.[原型])
      : 技能设计台机制抹消支持原型默认选项.filter(原型 => SKILL_DESIGNER_PROTOTYPE_REGISTRY?.[原型]),
  );
  // —— B:18270
  const 技能设计台机制授予触发条件选项 = Object.freeze(['主动触发', '随下次行动触发', '下次魂技成功释放']);
  // —— B:18271
  const 技能设计台召唤行动模式选项 = Object.freeze(['自主行动', '护卫', '协同攻击']);
  // —— B:18272
  const SKILL_DESIGNER_PARAM_INTERRUPT_WINDOW_OPTIONS = Object.freeze(['前摇', '吟唱中', '引导中']);
  // —— B:18273
  const SKILL_DESIGNER_PARAM_COUNTER_RULE_OPTIONS = Object.freeze(['受击后', '免伤后', '受控后']);
  // —— B:18274
  const SKILL_DESIGNER_PARAM_MUTE_SCOPE_OPTIONS = Object.freeze(['主动技', '咏唱技', '造物技', '全部技能']);
  // —— B:18275
  const SKILL_DESIGNER_PARAM_BLIND_EFFECT_OPTIONS = Object.freeze(['命中', '视野', '锁定']);
  // —— B:18276
  const SKILL_DESIGNER_PARAM_WEAK_POINT_TYPE_OPTIONS = Object.freeze(['防御剥夺', '精神抗性剥夺', '双抗剥夺']);
  // —— B:18277-18308
  const SKILL_DESIGNER_PARAM_OPTION_REGISTRY = Object.freeze({
    ATTRIBUTE: SKILL_DESIGNER_PARAM_ATTRIBUTE_OPTIONS,
    ATTRIBUTE_GROUP: SKILL_DESIGNER_PARAM_ATTRIBUTE_GROUP_OPTIONS,
    SHIELD_CAP: SKILL_DESIGNER_PARAM_SHIELD_CAP_OPTIONS,
    IMMUNE_LEVEL: SKILL_DESIGNER_PARAM_IMMUNE_LEVEL_OPTIONS,
    CLEANSE_PRIORITY: SKILL_DESIGNER_PARAM_CLEANSE_PRIORITY_OPTIONS,
    CLEANSE_GAIN: SKILL_DESIGNER_PARAM_CLEANSE_GAIN_OPTIONS,
    TRACKING_RULE: SKILL_DESIGNER_PARAM_TRACKING_RULE_OPTIONS,
    INFO_DEPTH: SKILL_DESIGNER_PARAM_INFO_DEPTH_OPTIONS,
    WAKE_RULE: SKILL_DESIGNER_PARAM_WAKE_RULE_OPTIONS,
    ESCAPE_GAIN: SKILL_DESIGNER_PARAM_ESCAPE_GAIN_OPTIONS,
    COPY_TARGET: SKILL_DESIGNER_PARAM_COPY_TARGET_OPTIONS,
    COPY_MODE: 技能设计器参数复制模式选项,
    COUNTER_TARGET: SKILL_DESIGNER_PARAM_COUNTER_TARGET_OPTIONS,
    TRIGGER_RESULT: SKILL_DESIGNER_PARAM_TRIGGER_RESULT_OPTIONS,
    RULE_REWRITE: SKILL_DESIGNER_PARAM_RULE_REWRITE_OPTIONS,
    CLONE_TYPE: SKILL_DESIGNER_PARAM_CLONE_TYPE_OPTIONS,
    SUMMON_UNIT_TYPE: 技能设计台召唤单位类型选项,
    SUMMON_DAMAGE_RULE: 技能设计台召唤承伤规则选项,
    PENETRATION_TARGET: SKILL_DESIGNER_PARAM_PENETRATION_TARGET_OPTIONS,
    ABSORB_SOURCE: 技能设计台伤害吸收来源选项,
    ABSORB_RESOURCE: 技能设计台伤害吸收资源选项,
    DAMAGE_TRANSFER_TARGET: 技能设计台伤害转移对象选项,
    RESOURCE_LOCK_TYPE: 技能设计台资源锁定类型选项,
    RESOURCE_TRANSFER_TYPE: SKILL_DESIGNER_PARAM_RESOURCE_TRANSFER_TYPE_OPTIONS,
    MECHANISM_GRANT_TRIGGER: 技能设计台机制授予触发条件选项,
    INTERRUPT_WINDOW: SKILL_DESIGNER_PARAM_INTERRUPT_WINDOW_OPTIONS,
    COUNTER_RULE: SKILL_DESIGNER_PARAM_COUNTER_RULE_OPTIONS,
    MUTE_SCOPE: SKILL_DESIGNER_PARAM_MUTE_SCOPE_OPTIONS,
    BLIND_EFFECT: SKILL_DESIGNER_PARAM_BLIND_EFFECT_OPTIONS,
    WEAK_POINT_TYPE: SKILL_DESIGNER_PARAM_WEAK_POINT_TYPE_OPTIONS,
  });
  // —— B:18311-18314
  function 技能设计台召唤允许继承属性比例(效果 = {}) {
    const 单位类型 = typeof 效果 === 'string' ? 效果 : 效果 && 效果['召唤单位类型'];
    return ['本命召唤兽', '分身'].includes(normalizeSkillUiText(单位类型, ''));
  }
  // —— B:18316-18319
  function 技能设计台召唤允许普通批量(效果 = {}) {
    const 单位类型 = typeof 效果 === 'string' ? 效果 : 效果 && 效果['召唤单位类型'];
    return normalizeSkillUiText(单位类型, '') === '其他召唤生物';
  }
  // —— B:18321-18323
  function 技能设计台召唤使用继承属性比例(效果 = {}) {
    return toNumber(效果 && 效果['继承属性比例'], 0) > 0;
  }
  // —— B:18324-18334
  const 技能设计台副作用类型候选_V1 = Object.freeze([
    '全属性降低',
    '自损反噬',
    '致死献祭',
    '精神紊乱',
    '魂力反噬',
    '命中下降',
    '动作迟缓',
    '目标错乱',
    '施法僵直',
    // 战后长期代价（用户 2026-11-12）：战斗内无效果，战后结算。
    '本源损耗',
    '重伤昏迷',
  ]);
  // —— B:18335
  const 技能设计台副作用触发时机选项_V1 = Object.freeze(['效果生效后', '命中后', '回合结束时', '效果结束后']);
  // —— B:18336
  const 技能设计台副作用生效对象选项_V1 = Object.freeze(['技能释放者', '效果承受者', '双方']);
  // —— B:18337-18347
  const 技能设计台副作用配置表_V1 = Object.freeze({
    全属性降低: Object.freeze({ 状态: '虚弱', 数值: '+10%', 副数值: '', 持续回合: 2, 数值标签: '虚弱强度' }),
    自损反噬: Object.freeze({ 状态: '反噬', 数值: '+3%', 副数值: '', 持续回合: 1, 数值标签: '反噬伤害' }),
    致死献祭: Object.freeze({ 致死: true }),
    精神紊乱: Object.freeze({ 状态: '精神紊乱', 数值: '+25%', 副数值: '+8%', 持续回合: 2, 数值标签: '错乱概率', 副数值标签: '反应惩罚' }),
    魂力反噬: Object.freeze({ 状态: '魂力枯竭', 数值: '+5%', 副数值: '', 持续回合: 1, 数值标签: '魂力流失' }),
    命中下降: Object.freeze({ 状态: '精神紊乱', 数值: '+10%', 副数值: '', 持续回合: 2, 数值标签: '命中惩罚' }),
    动作迟缓: Object.freeze({ 状态: '迟缓', 数值: '+15%', 副数值: '+10%', 持续回合: 1, 数值标签: '反应惩罚', 副数值标签: '闪避惩罚' }),
    目标错乱: Object.freeze({ 状态: '混乱', 数值: '+30%', 副数值: '', 持续回合: 1, 数值标签: '敌我错乱' }),
    施法僵直: Object.freeze({ 状态: '僵直', 数值: '+20%', 副数值: '', 持续回合: 1, 数值标签: '施法僵直' }),
    本源损耗: Object.freeze({ 状态: '本源损耗', 数值: '+5%', 副数值: '', 持续回合: 1, 数值标签: '潜力损失' }),
    重伤昏迷: Object.freeze({ 状态: '重伤昏迷', 数值: '1', 副数值: '', 持续回合: 1, 数值标签: '昏迷月数' }),
  });
  // —— B:18348-18352
  const 技能执行旧数组键表_V1 = Object.freeze([
    '授予效果数组',
    '结算效果数组',
    '使用效果数组',
  ]);
  // —— B:18353-18382
  const 技能执行黑名单键表_V1 = Object.freeze([
    '文本',
    '描述',
    '效果描述',
    '副作用说明',
    '运行机制',
    '战斗效果',
    '计算层效果',
    '状态名称',
    '特殊机制标识',
    '瞬时结算',
    '状态承载',
    '场地承载',
    '结算参数',
    '机制标签',
    '基础威力倍率',
    '护盾绝对值',
    'dot_damage',
    'armor_pen',
    'final_damage_mult',
    'shield_gain_bonus',
    '加成属性',
    '持续伤害值',
    '防御穿透值',
    '造成伤害倍率',
    '护盾获得加值',
    '副作用列表',
    '机制决策临时',
    ...技能执行旧数组键表_V1,
  ]);
  // —— B:18383
  const 技能执行黑名单键集合_V1 = new Set(技能执行黑名单键表_V1);
  // —— B:18385-18388
  function isSkillSummaryEffect(effect) {
    void effect;
    return false;
  }
  // —— B:18390-18405
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
  // —— B:18407-18416
  function buildSkillDesignerSideEffectSummary(draft = {}) {
    const 施展列表 = 规范化技能设计台副作用列表(draft && draft.副作用列表);
    const 格式化 = list => list
      .map(格式化技能设计台副作用摘要)
      .filter(Boolean)
      .join('；');
    const 片段 = [];
    if (施展列表.length) 片段.push(`施展副作用：${格式化(施展列表)}`);
    return 片段.join('；');
  }
  // —— B:18418-18465
  function 规范化技能设计台副作用条目(value = {}, recordViolation = () => {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const 副作用类型 = normalizeSkillUiText(value['副作用类型'], '');
    if (!技能设计台副作用类型候选_V1.includes(副作用类型)) {
      recordViolation('副作用列表.副作用类型');
      return null;
    }
    if (value['参数'] !== undefined || value['战斗效果'] !== undefined || value['面板修改比例'] !== undefined || value['面板固定修正'] !== undefined)
      recordViolation('副作用列表.旧自由效果字段');
    safeEntries(value).forEach(([key]) => {
      const 允许字段 = 副作用类型 === '致死献祭'
        ? ['副作用类型', '触发时机', '生效对象', '触发概率']
        : ['副作用类型', '触发时机', '生效对象', '触发概率', '持续回合', '副作用状态', '数值', '副数值', '关联状态'];
      if (!允许字段.includes(key)) recordViolation(`副作用列表.${key}`);
    });
    const 配置 = 技能设计台副作用配置表_V1[副作用类型] || {};
    const 触发时机 = normalizeSkillUiText(value['触发时机'], '效果生效后');
    const 生效对象 = normalizeSkillUiText(value['生效对象'], '技能释放者');
    if (!技能设计台副作用触发时机选项_V1.includes(触发时机)) recordViolation('副作用列表.触发时机');
    if (!技能设计台副作用生效对象选项_V1.includes(生效对象)) recordViolation('副作用列表.生效对象');
    const 概率文本 = normalizeSkillUiText(value['触发概率'], '1');
    const 概率原值 = Number(String(概率文本).replace('%', ''));
    const 概率 = /%$/.test(概率文本) ? 概率原值 / 100 : 概率原值;
    if (!Number.isFinite(概率) || 概率 < 0 || 概率 > 1) recordViolation('副作用列表.触发概率');
    const 条目 = {
      副作用类型,
      触发时机: 技能设计台副作用触发时机选项_V1.includes(触发时机) ? 触发时机 : '效果生效后',
      生效对象: 技能设计台副作用生效对象选项_V1.includes(生效对象) ? 生效对象 : '技能释放者',
      触发概率: Number.isFinite(概率) ? Math.max(0, Math.min(1, Number(概率.toFixed(4)))) : 1,
    };
    if (副作用类型 === '致死献祭') return 条目;
    const 持续 = Number(value['持续回合'] ?? 配置.持续回合 ?? 1);
    if (!Number.isFinite(持续) || 持续 < 0 || Math.round(持续) !== 持续) recordViolation('副作用列表.持续回合');
    条目['持续回合'] = Number.isFinite(持续) ? Math.max(0, Math.round(持续)) : Math.max(0, Number(配置.持续回合 || 1));
    const 输入状态 = normalizeSkillUiText(value['副作用状态'], 配置.状态 || 副作用类型);
    if (输入状态 && 输入状态 !== normalizeSkillUiText(配置.状态, 副作用类型)) recordViolation('副作用列表.副作用状态');
    条目['副作用状态'] = normalizeSkillUiText(配置.状态, 副作用类型);
    const 数值 = normalizeSkillUiText(value['数值'], 配置.数值 || '');
    const 副数值 = normalizeSkillUiText(value['副数值'], 配置.副数值 || '');
    if (数值) 条目['数值'] = 数值;
    if (副数值) 条目['副数值'] = 副数值;
    if (条目['触发时机'] === '效果结束后') {
      const 关联状态 = normalizeSkillUiText(value['关联状态'], '');
      if (!关联状态) recordViolation('副作用列表.关联状态');
      else 条目['关联状态'] = 关联状态;
    }
    return 条目;
  }
  // —— B:18467-18471
  function 规范化技能设计台副作用列表(value = [], recordViolation = () => {}) {
    return (Array.isArray(value) ? value : [])
      .map(item => 规范化技能设计台副作用条目(item, recordViolation))
      .filter(Boolean);
  }
  // —— B:18473-18484
  function 创建技能设计台默认副作用条目(副作用类型 = '自损反噬', 选项 = {}) {
    const 默认对象 = normalizeSkillUiText(选项?.生效对象, '技能释放者');
    return 规范化技能设计台副作用条目({ 副作用类型, 生效对象: 默认对象 }, () => {}) || {
      副作用类型: '自损反噬',
      触发时机: '效果生效后',
      生效对象: 默认对象,
      触发概率: 1,
      持续回合: 1,
      副作用状态: '反噬',
      数值: '+3%',
    };
  }
  // —— B:18486-18491
  function 读取技能设计台默认副作用对象(draft = {}, 阶段 = '施展') {
    if (normalizeSkillUiText(阶段, '施展') === '使用') return '效果承受者';
    return normalizeSkillUiText(draft?.type, '') === '食物系' && normalizeSkillUiText(draft?.deliveryForm, '') !== '造物承载'
      ? '效果承受者'
      : '技能释放者';
  }
  // —— B:18493-18497
  function 格式化技能设计台概率百分比(value = 1) {
    const 数值 = Math.max(0, Math.min(1, Number(value ?? 1)));
    const 百分比 = 数值 * 100;
    return `${Math.abs(百分比 % 1) < 0.0001 ? 百分比.toFixed(0) : 百分比.toFixed(1)}%`;
  }
  // —— B:18499-18525
  function 格式化技能设计台副作用摘要(条目 = {}) {
    const 类型 = normalizeSkillUiText(条目 && 条目['副作用类型'], '');
    if (!类型) return '';
    const 配置 = 技能设计台副作用配置表_V1[类型] || {};
    const 概率 = Math.max(0, Math.min(1, Number((条目 && 条目['触发概率']) ?? 1)));
    const 持续 = Math.max(0, Number((条目 && 条目['持续回合']) || 0));
    const 百分值 = 输入 => {
      const 数字 = Number(normalizeSkillUiText(输入, '').replace(/[+%-]/g, ''));
      return Number.isFinite(数字) ? Math.abs(数字) : 0;
    };
    const 数值 = 百分值(条目 && 条目['数值']);
    const 副数值 = 百分值(条目 && 条目['副数值']);
    const 触发 = normalizeSkillUiText(条目 && 条目['触发时机'], '效果生效后');
    const 对象 = normalizeSkillUiText(条目 && 条目['生效对象'], '技能释放者');
    const 效果 = ({
      全属性降低: `力量、防御、敏捷降低${数值 || 10}%`,
      自损反噬: `立即承受上限${数值 || 3}%反噬伤害`,
      致死献祭: '技能释放者进入致死代价',
      精神紊乱: `精神判定降低${数值 || 10}%`,
      魂力反噬: `魂力流失${数值 || 5}%`,
      命中下降: `命中率降低${数值 || 10}%`,
      动作迟缓: `反应降低${数值 || 15}%${副数值 ? `，闪避降低${副数值}%` : ''}`,
      目标错乱: `${数值 || 30}%概率错乱目标`,
      施法僵直: `施法僵直${数值 || 20}%`,
      本源损耗: `战后永久损失${数值 || 5}%潜力（战斗内无效果）`,
      重伤昏迷: `战后昏迷${数值 || 1}个月（战斗内无效果）`,
    })[类型] || `${类型}${数值 ? ` ${数值}%` : ''}`;
    return `${触发}，${Math.round(概率 * 100)}%使${对象}${效果}${持续 > 0 && !['本源损耗', '重伤昏迷'].includes(类型) ? `，持续${持续}回合` : ''}`;
  }
  // —— B:18527-18585
  function 构建技能设计台副作用行列表(副作用列表 = [], 选项 = {}) {
    const 列表 = 规范化技能设计台副作用列表(副作用列表);
    if (!列表.length) return '';
    const 字段名 = normalizeSkillUiText(选项 && 选项.字段名, '副作用列表');
    return 列表.map(条目 => {
      const 类型 = normalizeSkillUiText(条目['副作用类型'], '自损反噬');
      const 是致死献祭 = 类型 === '致死献祭';
      const 配置 = 技能设计台副作用配置表_V1[类型] || {};
      const 效果说明 = 格式化技能设计台副作用摘要(条目);
      return `
        <div class="skill-designer-side-effect-row" data-skill-designer-side-effect-row data-skill-designer-side-effect-scope="${escapeHtmlAttr(字段名)}">
          <button type="button" class="skill-designer-remove-btn" data-skill-designer-remove-side-effect data-skill-designer-disableable aria-label="删除副作用" title="删除副作用">×</button>
          <label class="mvu-editor-field">
            ${构建技能设计台说明标签('类型', 技能设计台副作用字段提示.类型)}
            <select class="mvu-editor-select" data-skill-designer-side-effect-field="副作用类型" data-skill-designer-disableable>
              ${buildSkillDesignerSelectOptions(技能设计台副作用类型候选_V1, 类型)}
            </select>
          </label>
          <label class="mvu-editor-field">
            ${构建技能设计台说明标签('时机', 技能设计台副作用字段提示.时机)}
            <select class="mvu-editor-select" data-skill-designer-side-effect-field="触发时机" data-skill-designer-disableable>
              ${buildSkillDesignerSelectOptions(技能设计台副作用触发时机选项_V1, 条目['触发时机'] || '效果生效后')}
            </select>
          </label>
          <label class="mvu-editor-field">
            ${构建技能设计台说明标签('对象', 技能设计台副作用字段提示.对象)}
            <select class="mvu-editor-select" data-skill-designer-side-effect-field="生效对象" data-skill-designer-disableable>
              ${buildSkillDesignerSelectOptions(技能设计台副作用生效对象选项_V1, 条目['生效对象'] || '技能释放者')}
            </select>
          </label>
          <label class="mvu-editor-field">
            ${构建技能设计台说明标签('概率', 技能设计台副作用字段提示.概率)}
            <input class="mvu-editor-input" type="text" value="${escapeHtmlAttr(格式化技能设计台概率百分比(条目['触发概率'] ?? 1))}" data-skill-designer-side-effect-field="触发概率" data-skill-designer-disableable />
          </label>
          ${是致死献祭 ? '' : `
            <label class="mvu-editor-field">
              ${构建技能设计台说明标签('持续', 技能设计台副作用字段提示.持续)}
              <input class="mvu-editor-input" type="number" min="0" step="1" value="${escapeHtmlAttr(String(条目['持续回合'] ?? 1))}" data-skill-designer-side-effect-field="持续回合" data-skill-designer-disableable />
            </label>
            <label class="mvu-editor-field">
              <span class="mvu-editor-label">${htmlEscape(配置.数值标签 || '强度')}</span>
              <input class="mvu-editor-input" type="text" value="${escapeHtmlAttr(条目['数值'] || '')}" placeholder="${escapeHtmlAttr(配置.数值 || '+10%')}" data-skill-designer-side-effect-field="数值" data-skill-designer-disableable />
            </label>
            ${配置.副数值 ? `
              <label class="mvu-editor-field">
                <span class="mvu-editor-label">${htmlEscape(配置.副数值标签 || '附加强度')}</span>
                <input class="mvu-editor-input" type="text" value="${escapeHtmlAttr(条目['副数值'] || '')}" placeholder="${escapeHtmlAttr(配置.副数值)}" data-skill-designer-side-effect-field="副数值" data-skill-designer-disableable />
              </label>
            ` : ''}
            ${效果说明 ? `<div class="mvu-editor-field skill-designer-side-effect-summary"><span>${htmlEscape(效果说明)}</span></div>` : ''}
            <label class="mvu-editor-field" data-skill-designer-side-effect-link-field${条目['触发时机'] === '效果结束后' ? '' : ' hidden style="display:none"'}>
              <span class="mvu-editor-label">关联效果</span>
              <input class="mvu-editor-input" type="text" value="${escapeHtmlAttr(条目['关联状态'] || '')}" placeholder="食物增幅" data-skill-designer-side-effect-field="关联状态" data-skill-designer-disableable />
            </label>
          `}
        </div>
      `;
    }).join('');
  }
  // —— B:18587-18591
  function normalizeSkillDesignerExecutionTargetModel(value = '', fallback = '单体') {
    const text = normalizeSkillUiText(value, '');
    if (!text) return normalizeSkillDesignerEffectTargetValue(fallback, '单体');
    return normalizeSkillDesignerEffectTargetValue(text, normalizeSkillDesignerEffectTargetValue(fallback, '单体'));
  }
  // —— B:18593-18602
  function normalizeSkillDesignerTimeRewindTargetValue(value = '', fallback = '单体') {
    const text = normalizeSkillUiText(value, '');
    const fallbackText = ['单体', '群体', '全场'].includes(normalizeSkillUiText(fallback, ''))
      ? normalizeSkillUiText(fallback, '')
      : '单体';
    if (/全场/.test(text)) return '全场';
    if (/群体|范围|多个/.test(text)) return '群体';
    if (/目标|单体|双方|彼此|二者/.test(text)) return '单体';
    return fallbackText;
  }
  // —— B:18604-18608
  function 读取技能设计台时光回溯目标候选(effect = {}, context = {}) {
    void effect;
    void context;
    return ['单体', '群体', '全场'];
  }
  // —— B:18610-18612
  function 技能设计台分摊结算目标候选() {
    return ['单体', '群体'];
  }
  // —— B:18614-18617
  function 规范化技能设计台分摊结算目标(value = '') {
    const 目标 = normalizeSkillDesignerEffectTargetValue(value, '单体');
    return 技能设计台分摊结算目标候选().includes(目标) ? 目标 : '单体';
  }
  // —— B:18619-18632
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
  // —— B:18634-18636
  function 机制授予目标允许下次行动触发(目标 = '') {
    return normalizeSkillDesignerEffectTargetValue(目标, '单体') === '自身';
  }
  // —— B:18638-18642
  function 读取技能设计台机制授予触发条件选项(目标 = '') {
    return 机制授予目标允许下次行动触发(目标)
      ? 技能设计台机制授予触发条件选项
      : ['主动触发'];
  }
  // —— B:18644-18650
  function formatSkillDesignerSignedValue(value, asPercent = true) {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) return asPercent ? '+0%' : '+0';
    const digits = Math.abs((asPercent ? num * 100 : num) % 1) < 0.0001 ? 0 : 2;
    const text = String(Number((asPercent ? num * 100 : num).toFixed(digits)));
    return `${num >= 0 ? '+' : ''}${text}${asPercent ? '%' : ''}`;
  }
  // —— B:18652-18661
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
  // —— B:18663-18676
  function normalizeSkillDesignerEffectValue(value, action = '') {
    if (value === undefined || value === null) return value;
    if (typeof value === 'string') return normalizeSkillUiText(value, '');
    const num = Number(value);
    if (!Number.isFinite(num)) return value;
    const actionText = normalizeSkillUiText(action, '');
    if (['倍率提升', '倍率压制'].includes(actionText)) {
      return formatSkillDesignerSignedValue(num - 1, true);
    }
    if (actionText === '减值') return formatSkillDesignerSignedValue(-Math.abs(num), Math.abs(num) <= 1);
    if (actionText === '加值' || actionText === '持续恢复')
      return formatSkillDesignerSignedValue(Math.abs(num), Math.abs(num) <= 1);
    return Number(num.toFixed(4));
  }
  // —— B:18678-18681
  function normalizeSkillDesignerResourceLockRatio(value, fallback = 0.5) {
    const ratio = Math.abs(parseSkillDesignerPercentRatio(value, fallback));
    return formatSkillDesignerSignedValue(Math.max(0.01, Math.min(1, ratio)), true);
  }
  // —— B:18683-18687
  function 转换技能设计台原型资源字段(value = '') {
    const text = normalizeSkillUiText(value, '');
    if (text === '双资源') return ['魂力', '精神力'];
    return { vit: '体力', hp: '生命', sp: '魂力', men: '精神力' }[text] || text || '魂力';
  }
  // —— B:18689-18696
  function 格式化技能设计台原型比例变化(value, 方向 = 1, 按倍率 = false) {
    const text = normalizeSkillUiText(value, '');
    if (!text) return '';
    const num = /%$/.test(text) ? Number(text.replace('%', '')) / 100 : Number(text);
    if (!Number.isFinite(num)) return text;
    const abs = Math.abs(按倍率 && num > 1 ? num - 1 : num);
    return formatSkillDesignerSignedValue(abs * (方向 < 0 ? -1 : 1), true);
  }
  // —— B:18698-18710
  function 格式化技能设计台资源转移数值方向(value = '', 方式 = '吞噬') {
    const text = normalizeSkillUiText(value, '');
    if (/%$/.test(text)) {
      const 百分比 = Math.abs(Number(text.replace('%', '')) || 0);
      const digits = Math.abs(百分比 % 1) < 0.0001 ? 0 : 2;
      const 符号 = 方式 === '吞噬' ? '-' : '+';
      return `${符号}${String(Number(百分比.toFixed(digits)))}%`;
    }
    const 数值 = Math.abs(Number(text) || 0);
    const digits = Math.abs(数值 % 1) < 0.0001 ? 0 : 2;
    const 符号 = 方式 === '吞噬' ? '-' : '+';
    return `${符号}${String(Number(数值.toFixed(digits)))}`;
  }
  // —— B:18712-18716
  function 规范化技能设计台被动触发(value = '') {
    const text = normalizeSkillUiText(value, '');
    if (!text) return '';
    return 技能设计台被动触发选项.includes(text) ? text : '';
  }
  // —— B:18718-18739
  const SKILL_DESIGNER_CONDITION_BRANCH_TYPE_OPTIONS = Object.freeze([
    '当前行动',
    '命中',
    '被闪避',
    '状态存在',
    '护盾',
    '生命比例',
    '体力比例',
    '魂力比例',
    '精神力比例',
    '生命数值',
    '体力数值',
    '魂力数值',
    '精神力数值',
    '目标',
    '使用者',
    '环境满足',
    '时间',
    '装备状态',
    '自身状态',
    '连携前提',
  ]);
  // —— B:18740-18748
  const SKILL_DESIGNER_CONDITION_BRANCH_TYPE_GROUPS = Object.freeze([
    Object.freeze({ label: '使用时机', options: Object.freeze(['当前行动']) }),
    Object.freeze({ label: '命中结果', options: Object.freeze(['命中', '被闪避']) }),
    Object.freeze({ label: '自身/目标状态', options: Object.freeze(['状态存在', '护盾']) }),
    Object.freeze({ label: '资源门槛', options: Object.freeze(['生命比例', '体力比例', '魂力比例', '精神力比例', '生命数值', '体力数值', '魂力数值', '精神力数值']) }),
    Object.freeze({ label: '目标关系', options: Object.freeze(['目标', '使用者']) }),
    Object.freeze({ label: '环境与装备', options: Object.freeze(['环境满足', '时间', '装备状态', '自身状态']) }),
    Object.freeze({ label: '连携前提', options: Object.freeze(['连携前提']) }),
  ]);
  // —— B:18749
  const SKILL_DESIGNER_CONDITION_BRANCH_OBJECT_OPTIONS = Object.freeze(['目标', '自身', '施术者', '召唤物', '使用者', '制作者']);
  // —— B:18750
  const SKILL_DESIGNER_CONDITION_BRANCH_COMPARE_OPTIONS = Object.freeze(['==', '!=', '>', '>=', '<', '<=', '有', '无', '包含']);
  // —— B:18751
  const SKILL_DESIGNER_CONDITION_BRANCH_ACTION_OPTIONS = Object.freeze(['生效', '替换效果', '追加效果', '禁用']);
  // —— B:18752-18755
  const SKILL_DESIGNER_CONDITION_BRANCH_FLAG_TYPES = Object.freeze([
    '命中',
    '被闪避',
  ]);
  // —— B:18756
  const 技能设计台释放前结算禁用条件类型 = Object.freeze(['命中', '被闪避']);
  // —— B:18757-18766
  const SKILL_DESIGNER_CONDITION_BRANCH_ENUM_VALUE_OPTIONS = Object.freeze({
    目标: Object.freeze(['自身', '他人', '己方', '敌方', '全场', '召唤物']),
    使用者: Object.freeze(['使用者', '制作者']),
    当前行动: Object.freeze(['常规攻击', '释放魂技', '武魂融合技', '使用物品', '防御', '闪避', '撤离', '穿戴装备']),
    环境满足: Object.freeze(['冰面', '水域', '阴影', '高空', '狭窄地形', '领域内', '场地内']),
    时间: Object.freeze(['白天', '黑夜', '清晨', '上午', '中午', '下午', '黄昏', '夜晚', '深夜']),
    装备状态: Object.freeze(['已装备主武器', '已装备防具', '已装备斗铠', '已装备机甲']),
    自身状态: Object.freeze(['蓄力中', '隐匿中']),
    连携前提: Object.freeze(['上一动作命中', '目标被控制']),
  });
  // —— B:18767
  const SKILL_DESIGNER_CONDITION_BRANCH_RATIO_TYPES = Object.freeze(['生命比例', '体力比例', '魂力比例', '精神力比例']);
  // —— B:18768-18776
  const SKILL_DESIGNER_CONDITION_BRANCH_NUMBER_TYPES = Object.freeze([
    '年龄',
    '等级',
    '生命数值',
    '体力数值',
    '魂力数值',
    '精神力数值',
    '护盾',
  ]);
  // —— B:18777-18787
  const SKILL_DESIGNER_CONDITION_BRANCH_RATIO_VALUE_OPTIONS = Object.freeze([
    '5%',
    '10%',
    '20%',
    '30%',
    '35%',
    '50%',
    '70%',
    '80%',
    '100%',
  ]);
  // —— B:18789-18792
  function 技能设计台条件类型是否枚举值(类型 = '') {
    const type = normalizeSkillUiText(类型, '');
    return !!SKILL_DESIGNER_CONDITION_BRANCH_ENUM_VALUE_OPTIONS[type] && type !== '目标';
  }
  // —— B:18794-18802
  function 技能设计台条件类型是否显示比较(类型 = '') {
    const type = normalizeSkillUiText(类型, '');
    return (
      SKILL_DESIGNER_CONDITION_BRANCH_FLAG_TYPES.includes(type) ||
      ['环境满足', '时间', '装备状态', '自身状态', '连携前提'].includes(type) ||
      SKILL_DESIGNER_CONDITION_BRANCH_RATIO_TYPES.includes(type) ||
      SKILL_DESIGNER_CONDITION_BRANCH_NUMBER_TYPES.includes(type)
    );
  }
  // —— B:18804-18817
  function 读取技能设计台条件分支比较选项(类型 = '') {
    const type = normalizeSkillUiText(类型, '生命比例');
    if (type === '目标') return ['=='];
    if (SKILL_DESIGNER_CONDITION_BRANCH_FLAG_TYPES.includes(type)) return ['有', '无'];
    if (type === '状态存在') return ['包含', '无'];
    if (['使用者', '环境满足', '时间', '装备状态', '自身状态', '连携前提'].includes(type)) return ['==', '!='];
    if (
      SKILL_DESIGNER_CONDITION_BRANCH_RATIO_TYPES.includes(type) ||
      SKILL_DESIGNER_CONDITION_BRANCH_NUMBER_TYPES.includes(type)
    ) {
      return ['<=', '<', '>=', '>', '==', '!='];
    }
    return ['=='];
  }
  // —— B:18819-18823
  function 规范化技能设计台条件分支比较值(类型 = '', value = '') {
    const 选项 = 读取技能设计台条件分支比较选项(类型);
    const 文本 = toText(value, '').trim();
    return 选项.includes(文本) ? 文本 : 选项[0];
  }
  // —— B:18825-18848
  function 读取技能设计台条件分支值控件配置(类型 = '', 比较 = '') {
    const type = normalizeSkillUiText(类型, '生命比例');
    const compare = 规范化技能设计台条件分支比较值(type, 比较);
    const 是状态条件 = type === '状态存在';
    const 值选项 = SKILL_DESIGNER_CONDITION_BRANCH_ENUM_VALUE_OPTIONS[type] || [];
    let 值控件 = '无';
    if (type === '目标') 值控件 = '枚举';
    else if (技能设计台条件类型是否枚举值(type)) 值控件 = '枚举';
    else if (compare !== '有' && compare !== '无' && compare !== '包含' && type !== '状态存在') {
      if (SKILL_DESIGNER_CONDITION_BRANCH_RATIO_TYPES.includes(type)) 值控件 = '比例';
      else if (SKILL_DESIGNER_CONDITION_BRANCH_NUMBER_TYPES.includes(type)) 值控件 = '数字';
    }
    return {
      比较选项: 读取技能设计台条件分支比较选项(type),
      显示比较: 技能设计台条件类型是否显示比较(type),
      显示值: 值控件 !== '无',
      显示状态: 是状态条件,
      值控件,
      值选项: 值控件 === '比例' ? SKILL_DESIGNER_CONDITION_BRANCH_RATIO_VALUE_OPTIONS : 值选项,
      对象标签: '目标',
      比较标签: SKILL_DESIGNER_CONDITION_BRANCH_FLAG_TYPES.includes(type) ? '是否' : '比较',
      值标签: type,
    };
  }
  // —— B:18850-18863
  function 构建技能设计台条件分支对象选项() {
    const 标签表 = {
      目标: '目标',
      自身: '自身',
      施术者: '施术者',
      召唤物: '召唤物',
      使用者: '使用者',
      制作者: '制作者',
    };
    return SKILL_DESIGNER_CONDITION_BRANCH_OBJECT_OPTIONS.map(item => ({
      value: item,
      label: 标签表[item] || item,
    }));
  }
  // —— B:18865-18867
  function 构建技能设计台条件分支比较选项(类型 = '') {
    return 读取技能设计台条件分支比较选项(normalizeSkillUiText(类型, '生命比例'));
  }
  // —— B:18869-18883
  function 构建技能设计台条件分支比较控件选项(类型 = '', 当前值 = '') {
    const type = normalizeSkillUiText(类型, '生命比例');
    const current = 规范化技能设计台条件分支比较值(type, 当前值);
    return 构建技能设计台条件分支比较选项(type)
      .map(value => {
        const label =
          SKILL_DESIGNER_CONDITION_BRANCH_FLAG_TYPES.includes(type) || type === '状态存在'
            ? value === '无'
              ? '否'
              : '是'
            : value;
        return `<option value="${escapeHtmlAttr(value)}"${value === current ? ' selected' : ''}>${htmlEscape(label)}</option>`;
      })
      .join('');
  }
  // —— B:18885-18889
  function 读取技能设计台条件分支对象显示名(value = '') {
    const key = normalizeSkillUiText(value, '目标');
    const match = 构建技能设计台条件分支对象选项().find(item => item.value === key);
    return match ? match.label : key;
  }
  // —— B:18891-18910
  function 构建技能设计台条件分支条件预览(condition = {}) {
    const 类型 = normalizeSkillUiText(condition['类型'], '生命比例');
    const 对象 = 读取技能设计台条件分支对象显示名(condition['对象']);
    const 比较 = 规范化技能设计台条件分支比较值(类型, condition['比较']);
    if (类型 === '目标') return `条件：目标为${normalizeSkillUiText(condition['值'], '自身')}`;
    if (类型 === '使用者') return `条件：${对象}${比较 === '!=' ? '不是' : '是'}${normalizeSkillUiText(condition['值'], '制作者')}`;
    if (SKILL_DESIGNER_CONDITION_BRANCH_FLAG_TYPES.includes(类型)) {
      return `条件：${对象}${比较 === '无' ? '不是' : '是'}${类型}`;
    }
    if (类型 === '状态存在')
      return `条件：${对象}${比较 === '无' ? '不存在' : '存在'}${normalizeSkillUiText(condition['状态'] || condition['值'], '状态')}`;
    if (类型 === '环境满足') return `条件：环境${比较 === '!=' ? '不满足' : '满足'}${normalizeSkillUiText(condition['值'], '阴影')}`;
    if (类型 === '时间') return `条件：时间${比较 === '!=' ? '不是' : '处于'}${normalizeSkillUiText(condition['值'], '白天')}`;
    if (类型 === '装备状态') return `条件：${对象}${比较 === '!=' ? '未满足' : '满足'}${normalizeSkillUiText(condition['值'], '已装备主武器')}`;
    if (类型 === '自身状态') return `条件：${对象}${比较 === '!=' ? '不是' : '处于'}${normalizeSkillUiText(condition['值'], '蓄力中')}`;
    if (类型 === '连携前提') return `条件：${比较 === '!=' ? '不满足' : '满足'}${normalizeSkillUiText(condition['值'], '上一动作命中')}`;
    if (技能设计台条件类型是否枚举值(类型))
      return condition['值'] !== undefined && normalizeSkillUiText(condition['值'], '') ? `条件：${对象}${类型}为${normalizeSkillUiText(condition['值'], '')}` : '';
    return condition['值'] !== undefined && normalizeSkillUiText(condition['值'], '') ? `条件：${对象}${类型} ${比较} ${normalizeSkillUiText(condition['值'], '')}` : '';
  }
  // —— B:18912-18931
  function 构建技能设计台条件分支摘要(value = []) {
    const branches = Array.isArray(value) ? value : [];
    if (!branches.length) return '';
    return branches
      .slice(0, 3)
      .map(branch => {
        const conditions = Array.isArray(branch && branch['条件']) ? branch['条件'] : [];
        const conditionText = conditions
          .map(item => 构建技能设计台条件分支条件预览(item).replace(/^条件：/, ''))
          .filter(Boolean)
          .join(' 且 ');
        if (!conditionText) return '';
        const action = normalizeSkillUiText(branch && branch['处理'], '生效');
        const effectKey = action === '追加效果' ? '追加效果' : '替换效果';
        const effectCount = 技能设计台条件分支效果数组字段表.includes(action) && Array.isArray(branch && branch[effectKey]) ? branch[effectKey].length : 0;
        return `${conditionText} → ${action}${effectCount ? `(${effectCount}原型)` : ''}`;
      })
      .filter(Boolean)
      .join('；');
  }
  // —— B:18933-18935
  function 构建技能设计台条件分支隐藏属性(显示 = true) {
    return 显示 ? '' : ' hidden style="display:none"';
  }
  // —— B:18937-18946
  function 构建技能设计台条件分支值控件(类型 = '', 比较 = '', value = '') {
    const 显示配置 = 读取技能设计台条件分支值控件配置(类型, 比较);
    if (显示配置.值控件 === '无') return '';
    if (显示配置.值控件 === '数字') {
      return `<input class=\"mvu-editor-input\" type=\"number\" min=\"0\" step=\"1\" value=\"${escapeHtmlAttr(value)}\" data-skill-designer-condition-field=\"值\" data-skill-designer-disableable />`;
    }
    return `<select class=\"mvu-editor-select\" data-skill-designer-condition-field=\"值\" data-skill-designer-disableable>
        ${buildSkillDesignerSelectOptions(显示配置.值选项, value)}
      </select>`;
  }
  // —— B:18948-18981
  function normalizeSkillDesignerConditionBranchConditionList(value = [], recordViolation = () => {}) {
    return (Array.isArray(value) ? value : [])
      .map(condition => {
        if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return null;
        const 类型 = normalizeSkillUiText(condition['类型'], '');
        if (!SKILL_DESIGNER_CONDITION_BRANCH_TYPE_OPTIONS.includes(类型)) {
          recordViolation('条件分支.条件.类型');
          return null;
        }
        const 对象 = SKILL_DESIGNER_CONDITION_BRANCH_OBJECT_OPTIONS.includes(
          normalizeSkillUiText(condition['对象'], ''),
        )
          ? normalizeSkillUiText(condition['对象'], '')
          : '目标';
        const 比较 = 规范化技能设计台条件分支比较值(类型, condition['比较']);
        const normalized = { 类型, 对象, 比较 };
        const 显示配置 = 读取技能设计台条件分支值控件配置(类型, 比较);
        if (显示配置.显示值) {
          const 值 = 读取技能设计台原型字段输入值(condition['值'] ?? condition['数值'] ?? '');
          if (显示配置.值控件 === '枚举')
            normalized['值'] = normalizeSkillDesignerSelectValue(值, 显示配置.值选项, 显示配置.值选项[0] || '');
          else if (显示配置.值控件 === '比例')
            normalized['值'] = normalizeSkillDesignerSelectValue(值, 显示配置.值选项, 显示配置.值选项[0] || '20%');
          else if (值 !== '') normalized['值'] = 值;
        }
        if (类型 === '目标') normalized['对象'] = '目标';
        if (显示配置.显示状态) {
          const 状态 = normalizeSkillUiText(condition['状态'], '');
          if (状态) normalized['状态'] = 状态;
        }
        return normalized;
      })
      .filter(Boolean);
  }
  // —— B:18983-18994
  function 规范化技能设计台等价比较效果(效果 = {}) {
    if (!效果 || typeof 效果 !== 'object' || Array.isArray(效果)) return 效果;
    const 副本 = cloneJsonValue(效果);
    delete 副本['条件分支'];
    if (副本['目标'] === undefined || 副本['目标'] === null || normalizeSkillUiText(副本['目标'], '') === '')
      delete 副本['目标'];
    Object.keys(副本).forEach(键 => {
      const 值 = 副本[键];
      if (值 === undefined || 值 === null || (typeof 值 === 'string' && !值.trim())) delete 副本[键];
    });
    return 副本;
  }
  // —— B:18996-19005
  function 稳定序列化技能设计台效果(值) {
    if (Array.isArray(值)) return `[${值.map(稳定序列化技能设计台效果).join(',')}]`;
    if (值 && typeof 值 === 'object') {
      return `{${Object.keys(值)
        .sort()
        .map(键 => `${JSON.stringify(键)}:${稳定序列化技能设计台效果(值[键])}`)
        .join(',')}}`;
    }
    return JSON.stringify(值);
  }
  // —— B:19007-19016
  function 技能设计台条件分支替换效果等价(父效果 = {}, 替换效果列表 = []) {
    const 效果列表 = Array.isArray(替换效果列表) ? 替换效果列表 : [];
    if (效果列表.length !== 1) return false;
    const 基础 = 规范化技能设计台等价比较效果(父效果);
    const 替换 = 规范化技能设计台等价比较效果(效果列表[0]);
    if (!替换['目标'] && 基础['目标']) 替换['目标'] = 基础['目标'];
    if (!基础['目标'] && 替换['目标'] === '自身') delete 替换['目标'];
    else if (!基础['目标'] && 替换['目标']) 基础['目标'] = 替换['目标'];
    return 稳定序列化技能设计台效果(基础) === 稳定序列化技能设计台效果(替换);
  }
  // —— B:19018-19022
  function 读取技能设计台机制抹消可匹配字段(原型 = '') {
    const 原型名 = normalizeSkillUiText(原型, '');
    const 字段列表 = 技能设计台机制抹消可匹配字段表[原型名];
    return Array.isArray(字段列表) ? 字段列表 : [];
  }
  // —— B:19024
  const 技能设计台机制抹消全部字段值 = new Set(['全部', '抹消全部', '全部状态', '全部规则', '全部资源', '全部结算', '全部属性', '全部原型', '全部转移方式', '全部复制类型']);
  // —— B:19026-19036
  function 规范化技能设计台机制抹消字段值(值) {
    const 原始列表 = Array.isArray(值) ? 值 : String(值 ?? '').split(/[、,，|/]/);
    if (原始列表.some(item => 技能设计台机制抹消全部字段值.has(normalizeSkillUiText(item, '')))) return undefined;
    const 列表 = Array.from(new Set(
      原始列表
        .map(item => normalizeSkillUiText(item, ''))
        .filter(item => item && item !== '无' && !技能设计台机制抹消全部字段值.has(item)),
    ));
    if (!列表.length) return undefined;
    return 列表.length === 1 ? 列表[0] : 列表;
  }
  // —— B:19038-19040
  function 格式化技能设计台机制抹消字段值(值) {
    return Array.isArray(值) ? 值.map(item => normalizeSkillUiText(item, '')).filter(Boolean).join('、') : normalizeSkillUiText(值, '');
  }
  // —— B:19051-19067
  function 规范化技能设计台机制抹消对象(值 = {}) {
    if (typeof 值 === 'string' && /^[\[{]/.test(值.trim())) {
      try {
        return 规范化技能设计台机制抹消对象(JSON.parse(值));
      } catch (_) {}
    }
    const 来源 = 值 && typeof 值 === 'object' && !Array.isArray(值)
      ? 值
      : { 原型: normalizeSkillUiText(值, '') || '机制授予' };
    const 原型 = normalizeSkillUiText(来源['原型'], '') || '机制授予';
    const 结果 = { 原型 };
    读取技能设计台机制抹消可匹配字段(原型).forEach(key => {
      const 字段值 = 规范化技能设计台机制抹消字段值(来源[key]);
      if (字段值 !== undefined) 结果[key] = 字段值;
    });
    return 结果;
  }
  // —— B:19069-19075
  function 构建技能设计台机制抹消对象摘要(值 = {}) {
    const 对象 = 规范化技能设计台机制抹消对象(值);
    return ['原型', ...读取技能设计台机制抹消可匹配字段(对象['原型'])]
      .map(key => 格式化技能设计台机制抹消字段值(对象[key]))
      .filter(Boolean)
      .join('/');
  }
  // —— B:19081-19093
  function 读取技能设计台机制抹消对象字段选项(原型 = '', 字段 = '') {
    const 原型名 = normalizeSkillUiText(原型, '');
    const 字段名 = normalizeSkillUiText(字段, '');
    if (!读取技能设计台机制抹消可匹配字段(原型名).includes(字段名)) return [];
    const 选项 = 读取技能设计台原型字段选项(原型名, 字段名);
    if (字段名 === '状态') {
      return normalizeSkillDesignerOptionList(选项)
        .map(item => item.value)
        .filter(item => normalizeSkillUiText(item, '') && !/^任意/.test(normalizeSkillUiText(item, '')));
    }
    if (字段名 === '匹配原型') return 选项;
    return normalizeSkillDesignerOptionList(选项).map(item => item.value).filter(Boolean);
  }
  // —— B:19095-19106
  function 读取技能设计台机制抹消全部标签(字段 = '') {
    return ({
      状态: '全部状态',
      规则: '全部规则',
      资源: '全部资源',
      结算: '全部结算',
      属性: '全部属性',
      匹配原型: '全部原型',
      资源转移方式: '全部转移方式',
      复制类型: '全部复制类型',
    })[normalizeSkillUiText(字段, '')] || '抹消全部';
  }
  // —— B:19108-19143
  function 构建技能设计台机制抹消对象字段控件(对象 = {}, 字段前缀 = '') {
    const 匹配器 = 规范化技能设计台机制抹消对象(对象);
    const 原型 = normalizeSkillUiText(匹配器['原型'], '机制授予');
    return 读取技能设计台机制抹消可匹配字段(原型)
      .map(字段 => {
        const 选项 = 读取技能设计台机制抹消对象字段选项(原型, 字段);
        const 值列表 = Array.isArray(匹配器[字段])
          ? 匹配器[字段].map(item => normalizeSkillUiText(item, '')).filter(Boolean)
          : [normalizeSkillUiText(匹配器[字段], '')].filter(Boolean);
        const 属性名 = 字段前缀 ? `${字段前缀}-field` : 'data-skill-designer-suppress-object-field';
        if (选项.length) {
          const 全部标签 = 读取技能设计台机制抹消全部标签(字段);
          const 全部选中 = !值列表.length;
          return `
              <label class=\"mvu-editor-field\">
                <span class=\"mvu-editor-label\">${htmlEscape(字段)}</span>
                <select class=\"mvu-editor-select\" multiple size=\"${Math.min(4, Math.max(2, 选项.length + 1))}\" ${属性名}=\"${escapeHtmlAttr(字段)}\" data-skill-designer-disableable>
                  <option value=\"${escapeHtmlAttr(全部标签)}\"${全部选中 ? ' selected' : ''}>${htmlEscape(全部标签)}</option>
                  ${normalizeSkillDesignerOptionList(选项).map(option => {
                    const value = normalizeSkillUiText(option.value, '');
                    return `<option value=\"${escapeHtmlAttr(value)}\"${值列表.includes(value) ? ' selected' : ''}>${htmlEscape(option.label || value)}</option>`;
                  }).join('')}
                </select>
              </label>
            `;
        }
        const 值 = 格式化技能设计台机制抹消字段值(匹配器[字段]);
        return `
              <label class=\"mvu-editor-field\">
                <span class=\"mvu-editor-label\">${htmlEscape(字段)}</span>
                <input class=\"mvu-editor-input\" type=\"text\" value=\"${escapeHtmlAttr(值)}\" placeholder=\"留空 = 无\" ${属性名}=\"${escapeHtmlAttr(字段)}\" data-skill-designer-disableable />
              </label>
            `;
      })
      .join('');
  }
  // —— B:19145-19172
  function 清理技能设计台等价替换条件分支(值) {
    if (!值 || typeof 值 !== 'object') return 值;
    if (Array.isArray(值)) {
      值.forEach(条目 => 清理技能设计台等价替换条件分支(条目));
      return 值;
    }
    if (Array.isArray(值['条件分支'])) {
      值['条件分支'] = 值['条件分支']
        .filter(
          分支 =>
            !(
              normalizeSkillUiText(分支 && 分支['处理'], '') === '替换效果' &&
              技能设计台条件分支替换效果等价(值, (分支 && 分支['替换效果']) || [])
            ),
        )
        .map(分支 => {
          技能设计台条件分支效果数组字段表.forEach(键 => {
            if (Array.isArray(分支 && 分支[键])) 清理技能设计台等价替换条件分支(分支[键]);
          });
          return 分支;
        });
      if (!值['条件分支'].length) delete 值['条件分支'];
    }
    技能设计台嵌套效果数组字段表.forEach(键 => {
      if (Array.isArray(值[键])) 清理技能设计台等价替换条件分支(值[键]);
    });
    return 值;
  }
  // —— B:19174-19219
  function normalizeSkillDesignerConditionBranchList(
    值 = [],
    fallbackTarget = '单体',
    recordViolation = () => {},
    parentEffect = {},
  ) {
    return (Array.isArray(值) ? 值 : [])
      .map(分支 => {
        if (!分支 || typeof 分支 !== 'object' || Array.isArray(分支)) return null;
        const 条件 = normalizeSkillDesignerConditionBranchConditionList(分支['条件'] || [], recordViolation);
        if (!条件.length) return null;
        const 处理源 = normalizeSkillUiText(分支['处理'], '');
        const 处理 = SKILL_DESIGNER_CONDITION_BRANCH_ACTION_OPTIONS.includes(处理源)
          ? 处理源
          : Array.isArray(分支['替换效果']) && 分支['替换效果'].length
            ? '替换效果'
            : Array.isArray(分支['追加效果']) && 分支['追加效果'].length
              ? '追加效果'
              : '生效';
        const 收口结果 = { 条件, 处理 };
        if (处理 === '生效') {
          if (技能设计台条件分支效果数组字段表.some(字段名 => Array.isArray(分支[字段名]) && 分支[字段名].length)) {
            recordViolation('条件分支.生效.禁止携带改写效果');
            return null;
          }
          return 收口结果;
        }
        if (处理 === '替换效果' || 处理 === '追加效果') {
          const 字段名 = 处理 === '替换效果' ? '替换效果' : '追加效果';
          const 效果列表 = normalizeSkillDesignerExecutionEffectArray(分支[字段名] || [], fallbackTarget, {
            条件分支: true,
            强制独立: true,
            禁用释放前降低结算: 技能设计台条件列表包含释放后条件(条件),
          });
          if (!效果列表.length) return null;
          if (技能设计台条件列表包含释放后条件(条件) && 技能设计台效果列表包含释放前降低结算(效果列表)) {
            recordViolation(`条件分支.${字段名}.释放前结算`);
            return null;
          }
          if (处理 === '替换效果' && 技能设计台条件分支替换效果等价(parentEffect, 效果列表)) return null;
          收口结果[字段名] = 效果列表;
        }
        return 收口结果;
      })
      .filter(Boolean);
  }
  // —— B:19221-19229
  function getSkillDesignerMechanismCompiledPrototypeList(mechanism = '') {
    const key = normalizeSkillUiText(mechanism, '');
    if (!key) return [];
    const entry = SKILL_DESIGNER_MECHANISM_COMPILER_TABLE[key];
    if (entry && Array.isArray(entry['原型列表']) && entry['原型列表'].length)
      return entry['原型列表'].map(item => cloneJsonValue(item));
    if (SKILL_DESIGNER_PROTOTYPE_REGISTRY[key]) return [{ 原型: key }];
    return [];
  }
  // —— B:19231
  const SKILL_DESIGNER_BATCH_EFFECT_FIELD_KEYS = Object.freeze(['原型', '属性', '资源', '状态', '类型']);
  // —— B:19232
  const 技能设计台嵌套效果数组字段集合 = new Set(技能设计台嵌套效果数组字段表);
  // —— B:19233
  const 技能设计台伤害类型选项 = Object.freeze(['近身攻击', '远程攻击', '精神攻击', '真实攻击']);
  // —— B:19235-19243
  function 规范化技能设计台伤害类型(value = '', draft = {}) {
    const text = normalizeSkillUiText(value, '');
    if (技能设计台伤害类型选项.includes(text)) return text;
    const merged = `${text} ${normalizeSkillUiText(draft?.type, '')} ${normalizeSkillUiText(draft?.deliveryForm, '')} ${normalizeSkillUiText(draft?.name || draft?.魂技名 || draft?.技能名称, '')} ${normalizeSkillUiText(draft?.description || draft?.效果描述, '')}`;
    if (/真实|规则|法则|无视|穿透本源|毁灭|时光/.test(merged)) return '真实攻击';
    if (/精神|识海|幻境|灵魂|眩晕|混乱|封技|恐惧/.test(merged)) return '精神攻击';
    if (/远程|射线|光束|飞刃|投掷|炮|波|箭|弹|雷|电|冰|火|光|暗|星|空间|元素|爆炸/.test(merged)) return '远程攻击';
    return '近身攻击';
  }
  // —— B:19245-19252
  function 读取技能设计台伤害绑定(伤害类型 = '', draft = {}) {
    const type = 规范化技能设计台伤害类型(伤害类型, draft);
    return {
      伤害类型: type,
      结算标签: type === '真实攻击' ? '真实伤害' : '标准伤害',
      抗性类型: type === '真实攻击' ? '真实无视' : type === '精神攻击' ? '精神抗性' : type === '远程攻击' ? '元素抗性' : '物理抗性',
    };
  }
  // —— B:19254-19272
  const SKILL_DESIGNER_PROTOTYPE_FORBIDDEN_FIELDS = new Set([
    '对象',
    '结算策略',
    '动作',
    '状态持续',
    'cast_time',
    '环境条件',
    '装备条件',
    '姿态条件',
    '连招条件',
    '动作时窗',
    '中断条件',
    '应用' + '原型',
    '参数',
    '判定属性',
    '判定阈值',
    '成功参数',
    '失败参数',
  ]);
  // —— B:19274-19281
  function 构建缺少状态禁用条件分支(状态 = '持续创伤', 对象 = '目标') {
    return [
      {
        条件: [{ 类型: '状态存在', 对象, 比较: '无', 状态 }],
        处理: '禁用',
      },
    ];
  }
  // —— B:19283-19295
  function 是技能设计台持续伤害引爆自动条件(条件分支 = []) {
    if (!Array.isArray(条件分支) || 条件分支.length !== 1) return false;
    const 分支 = 条件分支[0];
    const 条件列表 = Array.isArray(分支 && 分支['条件']) ? 分支['条件'] : [];
    if (normalizeSkillUiText(分支 && 分支['处理'], '') !== '禁用' || 条件列表.length !== 1) return false;
    const 条件 = 条件列表[0] || {};
    return (
      normalizeSkillUiText(条件['类型'], '') === '状态存在' &&
      normalizeSkillUiText(条件['对象'], '') === '目标' &&
      normalizeSkillUiText(条件['比较'], '') === '无' &&
      normalizeSkillUiText(条件['状态'], '') === '持续创伤'
    );
  }
  // —— B:19306-19644
  function fillSkillDesignerPrototypeValueFromTemplate(原型 = '', 字段 = {}, source = {}) {
    if (!字段 || typeof 字段 !== 'object') return;
    const pick = keys => {
      for (const key of keys) {
        if (source[key] !== undefined && source[key] !== null && String(source[key]).trim() !== '') return source[key];
      }
      return undefined;
    };
    if (原型 === '伤害结算') {
      if (字段['威力倍率'] === undefined) {
        const rawPower = pick([
          '威力倍率',
          'powerRatio',
          '强度倍率',
          '单段倍率',
          '爆发倍率',
          '每跳倍率',
          '数值',
        ]);
        const powerNumber = Number(rawPower);
        if (Number.isFinite(powerNumber))
          字段['威力倍率'] = Math.max(1, Math.round(powerNumber));
      }
      if (字段['伤害类型'] === undefined)
        字段['伤害类型'] = 规范化技能设计台伤害类型(source['伤害类型'] || source.damageType, source);
      if (字段['攻击段数'] === undefined) {
        const rawHitCount = pick(['攻击段数', '段数', 'hitCount', 'segmentCount']);
        if (rawHitCount !== undefined)
          字段['攻击段数'] = Math.max(1, parseSkillDesignerIntegerInputValue(rawHitCount, 1, 1));
      }
      if (字段['防御穿透'] === undefined) {
        const rawPen = pick(['防御穿透', '破甲比例']);
        if (rawPen !== undefined) 字段['防御穿透'] = parseSkillDesignerNumericInputValue(rawPen, 0, 4);
      }
      return;
    }
    if (原型 === '护盾变化') {
      if (字段['数值'] === undefined) {
        const rawShield = pick(['数值', '护盾值', 'shieldValue']);
        if (rawShield !== undefined)
          字段['数值'] = normalizeSkillDesignerEffectValue(rawShield, Number(rawShield) < 0 ? '减值' : '加值');
      }
      return;
    }
    if (原型 === '资源变化' || 原型 === '资源转移') {
      if (字段['资源'] === undefined) {
        const rawResource = normalizeSkillUiText(原型 === '资源转移' ? source['资源'] : source['资源'] || source['属性'] || source['资源类型'], '');
        字段['资源'] = 转换技能设计台原型资源字段(rawResource);
      }
      if (字段['数值'] === undefined) {
        const 目标 = normalizeSkillUiText(字段['目标'] || source['目标'], '');
        const rawDrain = pick(['夺取比例', 'drainRatio']);
        const rawBurn = pick(['燃烧比例', 'burnRatio']);
        const rawRefeed = pick(['反灌比例', '共享比例', 'refeedRatio']);
        const rawResourceValue = pick([
          '数值',
          '恢复比例',
          '回复比例',
          'sp_gain_ratio',
          'men_gain_ratio',
          '资源变化',
          '消耗比例',
        ]);
        if (原型 === '资源变化' && rawBurn !== undefined) 字段['数值'] = 格式化技能设计台原型比例变化(rawBurn, -1);
        else if (原型 === '资源转移' && rawDrain !== undefined) {
          const 转化比例 = Math.max(0, Number(source['转化比例'] ?? source.convertRatio ?? 1) || 1);
          字段['数值'] = 格式化技能设计台原型比例变化(
            Number(rawDrain || 0) * (目标 === '自身' ? 转化比例 : 1),
            目标 === '自身' ? 1 : -1,
          );
        } else if (原型 === '资源转移' && rawRefeed !== undefined) 字段['数值'] = 格式化技能设计台原型比例变化(rawRefeed, 1);
        else if (rawResourceValue !== undefined) {
          字段['数值'] = 原型 === '资源转移'
            ? normalizeSkillUiText(rawResourceValue, '')
            : normalizeSkillDesignerEffectValue(
                rawResourceValue,
                Number(rawResourceValue) < 0 ? '减值' : '加值',
              );
        }
      }
      if (字段['持续回合'] === undefined && source['持续回合'] !== undefined) {
        字段['持续回合'] = Math.max(0, parseSkillDesignerIntegerInputValue(source['持续回合'], 0, 0));
      }
      return;
    }
    if (原型 === '属性修正') {
      if (字段['属性'] === undefined) {
        const rawProperty = normalizeSkillUiText(source['属性'], '');
        if (rawProperty) 字段['属性'] = getSkillDesignerPackedPropertyLabel(rawProperty);
      }
      if (字段['数值'] === undefined) {
        const rawAttributeValue = pick(['数值', '属性倍率', '倍率', 'agi_ratio', 'speed_ratio', 'mastery_ratio']);
        if (rawAttributeValue !== undefined)
          字段['数值'] = normalizeSkillDesignerEffectValue(rawAttributeValue, source['动作'] || source.action || '');
      }
      return;
    }
    if (
      原型 === '结算修正' &&
      normalizeSkillUiText(字段['结算'] || source['结算'], '') === '持续伤害引爆' &&
      字段['条件分支'] === undefined
    ) {
      字段['条件分支'] = 构建缺少状态禁用条件分支(
        normalizeSkillUiText(source['状态'], '持续创伤'),
      );
    }
    if (原型 === '时窗修正' && 字段['调整字段'] === undefined) 字段['调整字段'] = '持续回合';
    if (字段['数值'] !== undefined) return;
    let raw;
    if (原型 === '判定修正') {
      const 判定 = normalizeSkillUiText(字段['判定'], '');
      const map = {
        命中: ['增加命中', '降低命中'],
        闪避: ['增加闪避', '降低闪避'],
        反应: ['增加反应', '降低反应'],
      };
      raw = pick(map[判定] || []);
    } else if (原型 === '决策干扰') {
      const 干扰 = normalizeSkillUiText(字段['干扰'], '');
      const map = {
        判断干扰: ['数值'],
        索敌干扰: ['数值'],
      };
      raw = pick(map[干扰] || []);
    } else if (原型 === '结算修正') {
      const 结算 = normalizeSkillUiText(字段['结算'], '');
      const map = {
        造成伤害: ['数值'],
        受到伤害: ['数值'],
        治疗: ['数值'],
        消耗: ['数值'],
        前摇: ['数值'],
        技能效果: ['技能效果倍率'],
        反伤: ['反射比例'],
        伤害转移: ['转移比例'],
        伤害吸收: ['吸收比例'],
        伤害转治疗: ['转化比例', 'rewriteValue', '数值'],
        治疗转伤害: ['转化比例', 'rewriteValue', '数值'],
        伤害分摊: ['分摊比例'],
        消耗分摊: ['分摊比例'],
        防御穿透: ['破甲比例'],
        反击: ['反击倍率'],
        持续伤害引爆: ['引爆倍率', 'detonateRatio'],
      };
      raw = pick(map[结算] || []);
      if (raw !== undefined) {
        const 按倍率 = ['造成伤害', '受到伤害', '治疗', '消耗', '前摇', '技能效果'].includes(结算);
        if (按倍率 && Math.abs(Number(raw) - 1) < 0.0001) return;
        const 格式化数值 = 格式化技能设计台原型比例变化(raw, 1, 按倍率);
        if (parseSkillDesignerSignedValue(格式化数值) === 0) return;
        字段['数值'] = 格式化数值;
        if (结算 === '伤害转移')
          字段['转移对象'] = normalizeSkillUiText(source['转移对象'], '攻击者');
        if (结算 === '伤害吸收') {
          字段['吸收来源'] = 技能设计台伤害吸收来源选项.includes(normalizeSkillUiText(source['吸收来源'] || source.absorbSource, ''))
            ? normalizeSkillUiText(source['吸收来源'] || source.absorbSource, '')
            : '造成伤害';
          字段['吸收资源'] = 技能设计台伤害吸收资源选项.includes(normalizeSkillUiText(source['吸收资源'] || source.resourceType, ''))
            ? normalizeSkillUiText(source['吸收资源'] || source.resourceType, '')
            : '生命';
        }
        if (结算 === '持续伤害引爆' && 字段['条件分支'] === undefined)
          字段['条件分支'] = 构建缺少状态禁用条件分支(
            normalizeSkillUiText(source['状态'], '持续创伤'),
          );
        return;
      }
    } else if (原型 === '时窗修正') {
      const 调整字段 = normalizeSkillUiText(字段['调整字段'], '持续回合');
      if (字段['调整方式'] === undefined) {
        const sourceText = normalizeSkillUiText(source['调整方式'] || source['机制'] || source['动作'], '');
        字段['调整方式'] = /压缩|引爆|缩短/.test(sourceText) ? '压缩' : '延长';
      }
      if (调整字段 === '持续回合') {
        if (字段['调整回合'] === undefined)
          字段['调整回合'] = Math.max(
            1,
            Math.min(
              3,
              parseSkillDesignerIntegerInputValue(
                source['调整回合'] || source['持续回合'] || source.extendRounds || source.consumeRounds,
                1,
                1,
              ),
            ),
          );
        if (字段['结算倍率'] === undefined) {
          const rawRatio = pick(['结算倍率', '引爆倍率', '压缩倍率', 'compressRatio']);
          if (rawRatio !== undefined) 字段['结算倍率'] = 格式化技能设计台原型比例变化(rawRatio, 1, true);
        }
      } else if (调整字段 === '有效期tick') {
        if (字段['调整tick'] === undefined)
          字段['调整tick'] = Math.max(
            1,
            Math.min(1008, parseSkillDesignerIntegerInputValue(source['调整tick'] || source['有效期tick'] || source['持续tick'], 6, 1)),
          );
      } else if (['触发次数', '使用次数'].includes(调整字段)) {
        if (字段['调整次数'] === undefined)
          字段['调整次数'] = Math.max(
            1,
            Math.min(3, parseSkillDesignerIntegerInputValue(source['调整次数'], 1, 1)),
          );
      }
      return;
    } else if (原型 === '规则防御') {
      raw = pick([
        '次数',
        '免伤次数',
        '免死次数',
        '抵消次数',
      ]);
      if (raw !== undefined) 字段['次数'] = Math.max(1, parseSkillDesignerIntegerInputValue(raw, 1, 1));
      return;
    } else if (原型 === '规则改写') {
      字段['规则'] = 技能设计台规则改写选项值.includes(normalizeSkillUiText(字段['规则'] || source['规则'], ''))
        ? normalizeSkillUiText(字段['规则'] || source['规则'], '')
        : '束手';
      if (字段['规则'] === '死亡转存活') {
        字段['目标'] = '自身';
        if (字段['数值'] === undefined) 字段['数值'] = 格式化技能设计台原型比例变化(pick(['数值', 'rewriteValue']) ?? 0.25, 0.25, true);
        delete 字段['持续回合'];
        delete 字段['死亡时限tick'];
        delete 字段['复活代价类型'];
        delete 字段['复活代价对象'];
        delete 字段['复活代价值'];
        delete 字段['复活代价时限tick'];
        delete 字段['复活后状态'];
        delete 字段['复活后状态时限tick'];
      } else {
        delete 字段['数值'];
        if (字段['持续回合'] === undefined) 字段['持续回合'] = Math.max(1, parseSkillDesignerIntegerInputValue(source['持续回合'] || source.duration, 1, 1));
        delete 字段['死亡时限tick'];
        delete 字段['复活代价类型'];
        delete 字段['复活代价对象'];
        delete 字段['复活代价值'];
        delete 字段['复活代价时限tick'];
        delete 字段['复活后状态'];
        delete 字段['复活后状态时限tick'];
      }
      return;
    } else if (原型 === '战斗外复活') {
      字段['数值'] = 格式化技能设计台原型比例变化(pick(['数值']) ?? 0.25, 0.25, true);
      字段['死亡时限tick'] = Math.max(1, parseSkillDesignerIntegerInputValue(source['死亡时限tick'] || 字段['死亡时限tick'], 144, 1));
      字段['复活代价类型'] = 技能设计台战斗外复活代价类型选项.includes(normalizeSkillUiText(字段['复活代价类型'] || source['复活代价类型'], ''))
        ? normalizeSkillUiText(字段['复活代价类型'] || source['复活代价类型'], '')
        : '状态代价';
      字段['复活代价对象'] = normalizeSkillUiText(字段['复活代价对象'] || source['复活代价对象'], 字段['复活代价类型'] === '消耗实体物品' ? '复活类丹药' : 字段['复活代价类型'] === '封印能力' ? '魂技' : 字段['复活代价类型'] === '永久代价' ? '等级上限' : '虚弱');
      字段['复活代价值'] = normalizeSkillUiText(字段['复活代价值'] || source['复活代价值'], '+1');
      字段['复活代价时限tick'] = Math.max(1, parseSkillDesignerIntegerInputValue(source['复活代价时限tick'] || 字段['复活代价时限tick'], 144, 1));
      字段['复活后状态'] = normalizeSkillUiText(字段['复活后状态'] || source['复活后状态'], '虚弱');
      字段['复活后状态时限tick'] = Math.max(1, parseSkillDesignerIntegerInputValue(source['复活后状态时限tick'] || 字段['复活后状态时限tick'], 144, 1));
      return;
    } else if (原型 === '机制抹消') {
      字段['抹消对象'] = 规范化技能设计台机制抹消对象(字段['抹消对象'] ?? source['抹消对象']);
      return;
  } else if (原型 === '复制执行') {
    const 复制类型 = normalizeSkillUiText(字段['复制类型'] || source['复制类型'], '复制技能');
    字段['复制类型'] = SKILL_DESIGNER_PARAM_COPY_TARGET_OPTIONS.includes(复制类型) ? 复制类型 : '复制技能';
    const 复制模式 = normalizeSkillUiText(字段['复制模式'] || source['复制模式'], '即时镜像');
    字段['复制模式'] = 技能设计器参数复制模式选项.includes(复制模式) ? 复制模式 : '即时镜像';
    if (!/属性|全部/.test(String(字段['复制类型'] || ''))) delete 字段['削减比例'];
    if (!['复制技能', '复制全部'].includes(String(字段['复制类型'] || ''))) {
      delete 字段['保存上限'];
      delete 字段['可用次数'];
    }
      if (字段['保留时长tick'] !== undefined) {
        const tick = Math.max(0, parseSkillDesignerIntegerInputValue(字段['保留时长tick'], 0, 0));
        if (tick > 0) 字段['保留时长tick'] = tick;
        else delete 字段['保留时长tick'];
      }
      return;
    } else if (原型 === '状态施加') {
      if (字段['状态'] === undefined)
        字段['状态'] = normalizeSkillUiText(source['状态'], '持续创伤');
      return;
    } else if (原型 === '状态移除') {
      if (字段['状态'] === undefined) 字段['状态'] = normalizeSkillUiText(source['状态'], '任意负面');
      if (字段['条件分支'] === undefined)
        字段['条件分支'] = 构建缺少状态禁用条件分支(
          字段['状态'] || '任意状态',
          normalizeSkillUiText(字段['目标'], '') === '自身' ? '自身' : '目标',
        );
      return;
    } else if (原型 === '状态交换') {
      字段['状态'] = normalizeSkillUiText(字段['状态'] ?? source['状态'], '') || '任意负面';
      return;
    } else if (原型 === '状态转移') {
      if (字段['状态'] === undefined) 字段['状态'] = normalizeSkillUiText(source['状态'], '任意状态');
      if (字段['数量'] === undefined) {
        const 数量文本 = normalizeSkillUiText(source['数量'], '');
        字段['数量'] = 数量文本 === '全部' ? '全部' : Math.max(1, parseSkillDesignerIntegerInputValue(source['数量'], 1, 1));
      }
      const 来源 = normalizeSkillUiText(source['来源'], '自身');
      const 去向 = normalizeSkillUiText(source['去向'], '目标');
      if (字段['来源'] === undefined) 字段['来源'] = ['自身', '目标', '友方', '敌方'].includes(来源) ? 来源 : '自身';
      if (字段['去向'] === undefined) 字段['去向'] = ['自身', '目标', '友方', '敌方'].includes(去向) ? 去向 : '目标';
      return;
    } else if (原型 === '召唤生成') {
      if (字段['召唤单位类型'] === undefined)
        字段['召唤单位类型'] = normalizeSkillUiText(source['召唤单位类型'], '魂兽');
      if (字段['召唤物名称'] === undefined)
        字段['召唤物名称'] = normalizeSkillUiText(
          source['召唤物名称'] || source['实体名称'],
          '召唤物',
        );
      if (字段['数量'] === undefined)
        字段['数量'] = Math.max(
          1,
          parseSkillDesignerIntegerInputValue(source['数量'] || source['召唤数量'] || source.repeatCount, 1, 1),
        );
      const 使用继承 = 技能设计台召唤允许继承属性比例(字段) && toNumber(字段['继承属性比例'], 0) > 0;
      if (使用继承) {
        字段['继承属性比例'] = Math.max(0.01, Math.min(1, toNumber(字段['继承属性比例'], 0.45)));
        delete 字段['强度'];
      } else {
        if (!(toNumber(字段['继承属性比例'], 0) > 0)) delete 字段['继承属性比例'];
        if (字段['强度'] === undefined) 字段['强度'] = Math.max(0.01, toNumber(source['强度'] || source['召唤强度'], 1));
      }
      return;
    } else if (原型 === '修炼增益') {
      const 收益类型 = normalizeSkillUiText(字段['收益类型'] || source['收益类型'], '训练方式收益');
      字段['收益类型'] = ['属性修炼速度', '训练方式收益'].includes(收益类型) ? 收益类型 : '训练方式收益';
      if (字段['收益类型'] === '属性修炼速度') {
        const 修炼属性 = getSkillDesignerPackedPropertyLabel(字段['修炼属性'] || source['修炼属性']);
        字段['修炼属性'] = ['力量', '防御', '敏捷', '体力上限', '魂力上限', '精神力上限'].includes(修炼属性) ? 修炼属性 : '魂力上限';
        delete 字段['训练方式'];
      } else {
        const 训练方式 = normalizeSkillUiText(字段['训练方式'] || source['训练方式'], '冥想');
        字段['训练方式'] = ['冥想', '肉体训练', '精神训练', '日常训练', '副职业经验'].includes(训练方式) ? 训练方式 : '冥想';
        delete 字段['修炼属性'];
      }
      raw = pick(['数值', '收益倍率']);
    }
    if (raw !== undefined) {
      字段['数值'] = 原型 === '修炼增益'
        ? 格式化技能设计台原型比例变化(raw, 1, true)
        : normalizeSkillDesignerEffectValue(raw);
    }
  }
  // —— B:19646-19665
  function expandSkillDesignerBatchEffectFields(value = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    if (normalizeSkillUiText(value['原型'], '') === '属性修正') return [value];
    let entries = [cloneJsonValue(value)];
    let expanded = false;
    const expandTopLevel = key => {
      entries = entries.flatMap(entry => {
        const raw = entry && entry[key];
        if (!Array.isArray(raw)) return [entry];
        const list = raw.map(item => normalizeSkillUiText(item, '')).filter(Boolean);
        if (!list.length) return [entry];
        expanded = true;
        return list.map(item => ({ ...entry, [key]: item }));
      });
    };
    SKILL_DESIGNER_BATCH_EFFECT_FIELD_KEYS.forEach(key => {
      expandTopLevel(key);
    });
    return expanded ? entries : [value];
  }
  // —— B:19667-19672
  function 技能设计台原型值需要默认驱动判定(原型 = '', 字段 = {}) {
    if (!字段 || typeof 字段 !== 'object') return false;
    if (字段['__显式无驱动属性']) return false;
    if (Object.prototype.hasOwnProperty.call(字段, '驱动属性')) return false;
    return 技能设计台原型需要默认驱动判定(原型, 字段);
  }
  // —— B:19674
  const 技能设计台状态施加状态分类矩阵 = Object.freeze(SHARED_SKILL_MECHANISM_REGISTRY?.状态施加状态分类矩阵 || {});
  // —— B:19675-19677
  const 技能设计台状态施加分类索引 = Object.freeze(Object.fromEntries(
    Object.entries(技能设计台状态施加状态分类矩阵).flatMap(([分类, 状态列表]) => 状态列表.map(状态 => [状态, 分类])),
  ));
  // —— B:19678-19712
  const 技能设计台状态施加默认驱动属性表 = Object.freeze({
    中毒: '魂力上限',
    流血: '魂力上限',
    灼烧: '魂力上限',
    冻伤: '魂力上限',
    持续创伤: '魂力上限',
    持续恢复: '魂力上限',
    护盾: '魂力上限',
    无视异常: '魂力上限',
    麻痹: '魂力上限',
    僵直: '魂力上限',
    迟缓: '魂力上限',
    虚弱: '魂力上限',
    防御剥夺: '魂力上限',
    资源燃烧: '魂力上限',
    魂力枯竭: '魂力上限',
    眩晕: '精神力上限',
    沉默: '精神力上限',
    致盲: '精神力上限',
    封技: '精神力上限',
    混乱: '精神力上限',
    失控: '精神力上限',
    精神紊乱: '精神力上限',
    隐匿: '精神力上限',
    探查屏蔽: '精神力上限',
    共享视野: '精神力上限',
    标记: '精神力上限',
    嘲讽: '精神力上限',
    精神抗性剥夺: '精神力上限',
    禁疗: '精神力上限',
    治疗反转: '精神力上限',
    反噬: '精神力上限',
    霸体: '体力上限',
    护卫: '体力上限',
  });
  // —— B:19713-19716
  function 技能设计台判定修正允许打断效果(字段 = {}) {
    if (parseSkillDesignerIntegerInputValue(字段 && 字段['持续回合'], 0, 0) > 0) return false;
    return 解析技能设计台正负数值(字段 && 字段['数值']) < 0;
  }
  // —— B:19718-19720
  function 读取技能设计台状态施加分类(状态 = '') {
    return 技能设计台状态施加分类索引[normalizeSkillUiText(状态, '')] || '';
  }
  // —— B:19722-19750
  function 构建技能设计台状态施加分组选项(状态选项 = []) {
    状态选项 = (Array.isArray(状态选项) ? 状态选项 : [])
      .map(状态 => normalizeSkillUiText(状态, ''))
      .filter(状态 => 状态 && 状态 !== '无');
    const 分类标签 = {
      持续伤害类: '持续伤害',
      恢复资源类: '资源持续',
      硬控封禁类: '控制封禁',
      防御布尔类: '防御状态',
      防御数值类: '防御状态',
      增益类: '增益状态',
      削弱标记类: '削弱标记',
    };
    const 分组选项 = new Map();
    const 已分组状态 = new Set();
    Object.entries(技能设计台状态施加状态分类矩阵).forEach(([分类, 分类状态列表]) => {
      const 标签 = 分类标签[分类] || 分类;
      (Array.isArray(分类状态列表) ? 分类状态列表 : []).forEach(状态名 => {
        const 状态 = normalizeSkillUiText(状态名, '');
        if (!状态 || !状态选项.includes(状态)) return;
        if (!分组选项.has(标签)) 分组选项.set(标签, []);
        分组选项.get(标签).push(状态);
        已分组状态.add(状态);
      });
    });
    const 未分类状态 = 状态选项.filter(状态 => !已分组状态.has(状态));
    if (未分类状态.length) 分组选项.set('其他状态', 未分类状态);
    return Array.from(分组选项, ([label, options]) => ({ label, options }));
  }
  // —— B:19752-19756
  function 技能设计台状态施加允许数值字段(状态 = '') {
    const 状态名 = normalizeSkillUiText(状态, '');
    return ['持续伤害类', '恢复资源类', '防御数值类'].includes(读取技能设计台状态施加分类(状态名)) ||
      ['禁疗', '治疗反转', '标记', '嘲讽', '共享视野', '防御剥夺', '精神抗性剥夺', '虚弱', '迟缓', '资源燃烧', '失控', '反噬', '精神紊乱', '僵直', '麻痹', '混乱', '魂力枯竭'].includes(状态名);
  }
  // —— B:19758-19760
  function 技能设计台状态施加允许副数值字段(状态 = '') {
    return ['中毒', '流血', '灼烧', '冻伤', '持续创伤', '资源燃烧', '迟缓', '失控', '精神紊乱', '魂力枯竭', '僵直', '麻痹', '混乱', '共享视野'].includes(normalizeSkillUiText(状态, ''));
  }
  // —— B:19762-19786
  function 技能设计台状态施加默认数值(状态 = '') {
    const 状态名 = normalizeSkillUiText(状态, '');
    if (状态名 === '中毒') return '-3%';
    if (状态名 === '流血') return '-3%';
    if (状态名 === '持续恢复') return '+5%';
    if (状态名 === '护盾') return '+10%';
    if (状态名 === '禁疗') return '+40%';
    if (状态名 === '治疗反转') return '+100%';
    if (状态名 === '护卫') return '+10%';
    if (状态名 === '嘲讽') return '+100%';
    if (状态名 === '共享视野') return '+10%';
    if (['资源燃烧', '魂力枯竭'].includes(状态名)) return '+3%';
    if (状态名 === '冻伤') return '-2%';
    if (状态名 === '迟缓') return '-10%';
    if (状态名 === '虚弱') return '-8%';
    if (状态名 === '失控') return '+35%';
    if (状态名 === '反噬') return '+3%';
    if (状态名 === '精神紊乱') return '+25%';
    if (状态名 === '僵直') return '-50%';
    if (状态名 === '麻痹') return '-50%';
    if (状态名 === '混乱') return '+40%';
    // 标记 = 被标记者闪避下降，默认 10%（与 MVU_Skill_Runtime 读取状态施加默认数值_V1、战斗侧缺省一致）。
    if (状态名 === '标记') return '-10%';
    if (['防御剥夺', '精神抗性剥夺'].includes(状态名)) return '+20%';
    return '-3%';
  }
  // —— B:19788-19801
  function 技能设计台状态施加默认副数值(状态 = '') {
    const 状态名 = normalizeSkillUiText(状态, '');
    if (状态名 === '中毒') return '-5%';
    if (状态名 === '流血') return '+5%';
    if (['灼烧', '冻伤'].includes(状态名)) return '+20%';
    if (状态名 === '持续创伤') return '-5%';
    if (['资源燃烧', '魂力枯竭'].includes(状态名)) return '+5%';
    if (状态名 === '共享视野') return '+10%';
    if (状态名 === '迟缓') return '-8%';
    if (['失控', '混乱'].includes(状态名)) return '-10%';
    if (状态名 === '精神紊乱') return '-8%';
    if (['僵直', '麻痹'].includes(状态名)) return '-20%';
    return '+5%';
  }
  // —— B:19803-19850
  function 技能设计台状态摘要(effect = {}) {
    const 状态名 = normalizeSkillUiText(effect && effect['状态'], '');
    const 数值 = normalizeSkillUiText(effect && effect['数值'], 技能设计台状态施加默认数值(状态名));
    const 副数值 = normalizeSkillUiText(effect && effect['副数值'], 技能设计台状态施加默认副数值(状态名));
    const 触发方式 = normalizeSkillUiText(effect && effect['触发方式'], '立即触发');
    const 延迟回合 = parseSkillDesignerIntegerInputValue(effect && effect['延迟回合'], 1, 1);
    const 触发前缀 = 触发方式 === '延迟触发'
      ? `延迟${延迟回合}回合后，`
      : 触发方式 === '遥控触发'
        ? '遥控触发时，'
        : '';
    const 映射 = {
      中毒: `每回合生命${数值}，命中率${副数值}。`,
      流血: `每回合生命${数值}，受到伤害${副数值}。`,
      灼烧: `每回合生命${数值}，火元素承伤${副数值}。`,
      冻伤: `每回合生命${数值}，冰元素承伤${副数值}。`,
      持续创伤: `每回合生命${数值}，反应${副数值}。`,
      持续恢复: `每回合生命${数值}。`,
      迟缓: `出手速度与闪避${数值}，反应${副数值}。`,
      资源燃烧: `每回合燃烧魂力${String(数值).replace(/^\+/, '')}，技能消耗${副数值}。`,
      眩晕: '跳过行动，无法反应。',
      沉默: '目标暂时无法施展魂技与主动技能。',
      致盲: '目标感知被扰乱，攻击命中下降35%。',
      禁疗: `目标生机受压制，受到的治疗降低${String(数值).replace(/^\+/, '')}。`,
      治疗反转: `目标生机被扭曲，治疗按${String(数值).replace(/^\+/, '')}转化为伤害。`,
      隐匿: '无法被单体敌对效果直接锁定，范围与全场效果仍会命中。',
      探查屏蔽: '屏蔽精神力感知、目标锁定与精神标记对自身的捕捉。',
      共享视野: `命中率${数值}，反应${副数值}。`,
      护盾: `获得生命上限${String(数值).replace(/^\+/, '')}的护盾。`,
      无视异常: '短时间进入无视异常状态，免疫负面状态与削减类效果。',
      霸体: '身形稳固如山，行动不易被打断。',
      标记: `目标被精神标记，闪避率${数值}。`,
      防御剥夺: `防御参与伤害结算时，目标防御按${String(数值).replace(/^\+/, '')}剥夺。`,
      精神抗性剥夺: `防守精神参与精神攻击结算时，目标精神抗性按${String(数值).replace(/^\+/, '')}剥夺。`,
      护卫: `施术者护卫目标，替其拦截攻击，护卫者承伤降低${String(数值).replace(/^\+/, '')}。`,
      嘲讽: '目标会优先攻击施术者。',
      封技: '技能回路被封锁，暂时无法施展技能。',
      虚弱: `目标力量、防御、敏捷各${数值}。`,
      失控: `${String(数值).replace(/^\+/, '')}概率偏转目标，命中率${副数值}。`,
      反噬: `主动施技续受到自身生命上限${String(数值).replace(/^\+/, '')}的伤害。`,
      精神紊乱: `${String(数值).replace(/^\+/, '')}概率偏转目标，反应${副数值}。`,
      魂力枯竭: `每回合流失魂力${String(数值).replace(/^\+/, '')}，技能消耗${副数值}。`,
      僵直: `目标无法反应，闪避率${副数值}。`,
      麻痹: `目标反应${数值}，闪避率${副数值}。`,
      混乱: `${String(数值).replace(/^\+/, '')}概率偏转目标，命中率${副数值}。`,
    };
    return 映射[状态名] ? `${触发前缀}${映射[状态名]}` : '';
  }
  // —— B:19852-19864
  function 技能设计台位移执行摘要(effect = {}) {
    const 位移类型 = normalizeSkillUiText(effect && effect['位移类型'], '瞬移');
    const 位移对象 = normalizeSkillUiText(effect && effect['位移对象'], 推断技能设计台位移对象(effect));
    const 距离 = Math.max(1, Math.min(30, toNumber(effect && effect['距离'], 1)));
    const 强度文本 = normalizeSkillUiText(effect && effect['数值'], '') || `约+${Math.round(Math.min(45, 距离 * 4))}%`;
    if (位移对象 === '自身与目标' || 位移类型 === '换位') return `双方节奏扰动：反应/闪避变化${强度文本}。`;
    if (位移对象 === '自身' || ['瞬移', '脱离'].includes(位移类型)) {
      return `${位移类型}收益：自身闪避/反应${强度文本}${位移类型 === '脱离' ? '，降低被锁定' : ''}。`;
    }
    if (位移类型 === '拉近') return `压迫目标：命中/锁定提高，目标反应${强度文本}。`;
    if (位移类型 === '击退') return `压制目标：反应/闪避/命中${强度文本}。`;
    return `战斗折算：反应与闪避${强度文本}。`;
  }
  // —— B:19866-19868
  function 技能设计台状态一句话说明(状态 = '') {
    return 技能设计台状态摘要({ 状态 });
  }
  // —— B:19870-19872
  function 技能设计台状态施加使用正向强度数值(状态 = '') {
    return ['资源燃烧', '魂力枯竭', '防御剥夺', '精神抗性剥夺', '持续恢复', '护盾', '禁疗', '治疗反转'].includes(normalizeSkillUiText(状态, ''));
  }
  // —— B:19874-19903
  function 技能设计台状态施加字段显示名(状态 = '', 字段 = '') {
    const 状态名 = normalizeSkillUiText(状态, '');
    const 字段名 = normalizeSkillUiText(字段, '');
    if (!['数值', '副数值'].includes(字段名)) return '';
    const 字段名矩阵 = {
      中毒: { 数值: '生命流失', 副数值: '命中修正' },
      流血: { 数值: '生命流失', 副数值: '承伤修正' },
      灼烧: { 数值: '生命流失', 副数值: '火元素承伤' },
      冻伤: { 数值: '生命流失', 副数值: '冰元素承伤' },
      持续创伤: { 数值: '生命流失', 副数值: '反应修正' },
      持续恢复: { 数值: '生命恢复' },
      迟缓: { 数值: '出手与闪避修正', 副数值: '反应修正' },
      资源燃烧: { 数值: '魂力流失', 副数值: '消耗修正' },
      禁疗: { 数值: '治疗削弱' },
      治疗反转: { 数值: '转伤比例' },
      护盾: { 数值: '护盾比例' },
      标记: { 数值: '闪避修正' },
      防御剥夺: { 数值: '防御剥夺' },
      精神抗性剥夺: { 数值: '精神抗性剥夺' },
      虚弱: { 数值: '属性修正' },
      失控: { 数值: '偏转概率', 副数值: '命中修正' },
      反噬: { 数值: '自伤比例' },
      精神紊乱: { 数值: '偏转概率', 副数值: '反应修正' },
      魂力枯竭: { 数值: '魂力流失', 副数值: '消耗修正' },
      僵直: { 数值: '反应修正', 副数值: '闪避修正' },
      麻痹: { 数值: '反应修正', 副数值: '闪避修正' },
      混乱: { 数值: '偏转概率', 副数值: '命中修正' },
    };
    return 字段名矩阵[状态名]?.[字段名] || (字段名 === '副数值' ? '附加数值' : 字段名);
  }
  // —— B:19905-19913
  function 格式化技能设计台状态施加比例字段(value, fallback = '+5%') {
    const 原文 = normalizeSkillUiText(value, '');
    if (!原文) return fallback;
    const 数值 = parseSkillDesignerSignedValue(原文);
    if (!Number.isFinite(数值)) return fallback;
    if (/%$/.test(原文)) return formatSkillDesignerSignedValue(数值, true);
    if (Math.abs(数值) <= 1) return formatSkillDesignerSignedValue(数值, true);
    return formatSkillDesignerSignedValue(数值 / 100, true);
  }
  // —— B:19915-19929
  function 限制技能设计台状态施加比例字段(状态 = '', 字段名 = '', value = '') {
    const 状态名 = normalizeSkillUiText(状态, '');
    const 字段 = normalizeSkillUiText(字段名, '');
    const 数值 = parseSkillDesignerSignedValue(value);
    if (!Number.isFinite(数值)) return value;
    if (字段 === '数值' && (技能设计台状态施加状态分类矩阵.持续伤害类 || []).includes(状态名))
      return formatSkillDesignerSignedValue(-Math.max(0.01, Math.abs(数值)), true);
    if (字段 === '数值' && 状态名 === '持续恢复')
      return formatSkillDesignerSignedValue(Math.max(0.05, Math.abs(数值)), true);
    if (字段 === '数值' && ['资源燃烧', '魂力枯竭'].includes(状态名))
      return formatSkillDesignerSignedValue(Math.max(0.01, Math.abs(数值)), true);
    if (字段 === '数值' && ['护盾', '禁疗', '治疗反转', '防御剥夺', '精神抗性剥夺'].includes(状态名))
      return formatSkillDesignerSignedValue(Math.max(0.05, Math.abs(数值)), true);
    return value;
  }
  // —— B:19931-19935
  function 技能设计台状态施加清理驱动字段(状态 = '', 目标 = '') {
    const 分类 = 读取技能设计台状态施加分类(状态);
    return ['硬控封禁类', '防御布尔类', '增益类'].includes(分类) &&
      ['自身', '召唤物', '分身'].includes(normalizeSkillUiText(目标, ''));
  }
  // —— B:19937-19940
  function 技能设计台状态施加是负面语义(状态 = '') {
    const 分类 = 读取技能设计台状态施加分类(状态);
    return ['持续伤害类', '硬控封禁类', '削弱标记类'].includes(分类) || normalizeSkillUiText(状态, '') === '资源燃烧';
  }
  // —— B:19942-19945
  function 技能设计台状态交换状态有效(状态 = '') {
    const 状态名 = normalizeSkillUiText(状态, '');
    return 状态名 === '任意负面' || 技能设计台状态施加是负面语义(状态名);
  }
  // —— B:19947-19949
  function 技能设计台状态施加是防护语义(状态 = '') {
    return ['防御布尔类', '防御数值类'].includes(读取技能设计台状态施加分类(状态));
  }
  // —— B:19951-19957
  function 技能设计台状态施加允许触发限制(状态 = '', 目标 = '') {
    const 状态名 = normalizeSkillUiText(状态, '');
    const 目标名 = normalizeSkillUiText(目标, '');
    const 分类 = 读取技能设计台状态施加分类(状态名);
    return 状态名 === '无视异常' ||
      (['群体', '全场'].includes(目标名) && (分类 === '硬控封禁类' || 技能设计台状态施加是防护语义(状态名)));
  }
  // —— B:19959-19977
  function 技能设计台状态施加强度约束错误(effect = {}, path = '_效果数组', index = 0) {
    const 状态名 = normalizeSkillUiText(effect && effect['状态'], '');
    const 目标 = normalizeSkillUiText(effect && effect['目标'], '');
    const 顶层 = path === '_效果数组';
    const 嵌套或代价 = !顶层 || /\.(授予效果|结算效果|使用效果|副作用)(?:\[|$)/.test(path);
    const 持续回合 = parseSkillDesignerIntegerInputValue(effect && effect['持续回合'], 0, 0);
    const 有触发限制 = !!(effect && effect['触发限制'] && typeof effect['触发限制'] === 'object' && !Array.isArray(effect['触发限制']));
    if (顶层 && !嵌套或代价 && 目标 === '自身' && 技能设计台状态施加是负面语义(状态名))
      return `技能执行结构错误:${path}[${index}]负面状态顶层不能直接作用自身，需放入副作用或代价槽位`;
    if (['群体', '全场'].includes(目标) && 读取技能设计台状态施加分类(状态名) === '硬控封禁类') {
      if (!(持续回合 > 0 || 有触发限制)) return `技能执行结构错误:${path}[${index}]群体硬控必须有持续或触发约束`;
      if (持续回合 > 1 && !有触发限制) return `技能执行结构错误:${path}[${index}]群体硬控持续回合必须为短窗或带触发限制`;
    }
    if (['群体', '全场'].includes(目标) && 技能设计台状态施加是防护语义(状态名) && !(持续回合 > 0 || 有触发限制))
      return `技能执行结构错误:${path}[${index}]群体防护状态必须有持续或触发约束`;
    if (['群体', '全场'].includes(目标) && (技能设计台状态施加状态分类矩阵.持续伤害类 || []).includes(状态名) && 持续回合 > 3)
      return `技能执行结构错误:${path}[${index}]群体DOT持续回合过长`;
    return '';
  }
  // —— B:19979-20015
  function 清理技能设计台纯布尔控制字段(原型 = '', 字段 = {}) {
    if (normalizeSkillUiText(原型, '') !== '状态施加' || !字段 || typeof 字段 !== 'object') return;
    const 状态名 = normalizeSkillUiText(字段['状态'], '');
    const 触发方式 = normalizeSkillUiText(字段['触发方式'], '立即触发');
    字段['触发方式'] = ['立即触发', '延迟触发', '遥控触发'].includes(触发方式)
      ? 触发方式
      : 字段['延迟回合'] !== undefined
        ? '延迟触发'
        : '立即触发';
    if (字段['触发方式'] === '延迟触发' || 字段['延迟回合'] !== undefined) {
      字段['触发方式'] = '延迟触发';
      字段['延迟回合'] = Math.max(1, parseSkillDesignerIntegerInputValue(字段['延迟回合'], 1, 1));
    } else {
      delete 字段['延迟回合'];
    }
    if (!技能设计台状态施加允许数值字段(状态名)) delete 字段['数值'];
    if (!技能设计台状态施加允许副数值字段(状态名)) delete 字段['副数值'];
    if (字段['数值'] !== undefined) 字段['数值'] = 格式化技能设计台状态施加比例字段(字段['数值'], 技能设计台状态施加默认数值(状态名));
    if (字段['副数值'] !== undefined) 字段['副数值'] = 格式化技能设计台状态施加比例字段(字段['副数值'], 技能设计台状态施加默认副数值(状态名));
    if (字段['数值'] !== undefined) 字段['数值'] = 限制技能设计台状态施加比例字段(状态名, '数值', 字段['数值']);
    if (字段['副数值'] !== undefined) 字段['副数值'] = 限制技能设计台状态施加比例字段(状态名, '副数值', 字段['副数值']);
    if (['禁疗', '治疗反转'].includes(状态名) && 字段['数值'] !== undefined) {
      字段['数值'] = formatSkillDesignerSignedValue(
        Math.abs(parseSkillDesignerSignedValue(字段['数值'])),
        /%$/.test(normalizeSkillUiText(字段['数值'], '')),
      );
    }
    if (技能设计台状态施加清理驱动字段(状态名, 字段['目标'])) {
      delete 字段['驱动属性'];
      delete 字段['影响方向'];
    } else if (状态名 === '标记') {
      if (!normalizeSkillUiText(字段['驱动属性'], '')) 字段['驱动属性'] = '精神力上限';
      if (!normalizeSkillUiText(字段['影响方向'], '')) 字段['影响方向'] = '效果强度';
    }
    delete 字段['概率'];
    delete 字段['打断效果'];
  }
  // —— B:20017-20042
  function 清理技能设计台打断效果字段(原型 = '', 字段 = {}) {
    if (!字段 || typeof 字段 !== 'object') return;
    delete 字段['打断类型'];
    delete 字段['中断概率'];
    if (normalizeSkillUiText(原型, '') === '判定修正') {
      if (parseSkillDesignerIntegerInputValue(字段 && 字段['持续回合'], 0, 0) > 0) {
        delete 字段['打断效果'];
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(字段, '打断效果')) {
        if (技能设计台判定修正允许打断效果(字段)) 字段['打断效果'] = true;
        return;
      }
      if (!技能设计台判定修正允许打断效果(字段)) {
        delete 字段['打断效果'];
        return;
      }
      字段['打断效果'] = !!字段['打断效果'];
      return;
    }
    if (normalizeSkillUiText(原型, '') === '状态施加') {
      delete 字段['打断效果'];
      return;
    }
    delete 字段['打断效果'];
  }
  // —— B:20044-20054
  function 推断技能设计台位移对象(字段 = {}) {
    const 位移类型 = normalizeSkillUiText(字段 && 字段['位移类型'], '');
    const 目标 = normalizeSkillUiText(字段 && 字段['目标'], '');
    const 显式对象 = normalizeSkillUiText(字段 && 字段['位移对象'], '');
    if (['自身', '目标', '自身与目标'].includes(显式对象)) return 显式对象;
    if (位移类型 === '换位') return '自身与目标';
    if (['瞬移', '脱离'].includes(位移类型)) return '自身';
    if (['自身', '友方', '召唤物'].includes(目标)) return '自身';
    if (位移类型 === '拉近') return '自身';
    return '目标';
  }
  // —— B:20056-20058
  function 技能设计台位移对象包含目标(位移对象 = '') {
    return ['目标', '自身与目标'].includes(normalizeSkillUiText(位移对象, ''));
  }
  // —— B:20060-20064
  function 技能设计台位移目标需要判定(字段 = {}) {
    const 目标 = normalizeSkillUiText(字段 && 字段['目标'], '');
    if (['自身', '友方', '友方单体', '友方群体', '召唤物'].includes(目标)) return false;
    return 技能设计台位移对象包含目标(字段 && 字段['位移对象']);
  }
  // —— B:20066-20088
  function 清理技能设计台位移字段(原型 = '', 字段 = {}) {
    if (normalizeSkillUiText(原型, '') !== '位移执行' || !字段 || typeof 字段 !== 'object') return;
    delete 字段['方位'];
    delete 字段['数量'];
    字段['距离'] = Math.max(1, Math.min(30, toNumber(字段['距离'], 1)));
    字段['持续回合'] = Math.max(1, Math.min(10, parseSkillDesignerIntegerInputValue(字段['持续回合'], 1, 1)));
    if (字段['数值'] !== undefined) {
      const 数值文本 = normalizeSkillUiText(字段['数值'], '');
      if (技能设计台字段值是百分比修正(数值文本)) 字段['数值'] = formatSkillDesignerSignedValue(解析技能设计台正负数值(数值文本), true);
      else delete 字段['数值'];
    }
    字段['位移对象'] = 推断技能设计台位移对象(字段);
    if (技能设计台位移目标需要判定(字段)) {
      if (!normalizeSkillUiText(字段['驱动属性'], '')) 字段['驱动属性'] = '魂力上限';
      if (!normalizeSkillUiText(字段['影响方向'], '')) 字段['影响方向'] = '效果强度';
    } else if (
      normalizeSkillUiText(字段['影响方向'], '') === '成功率' &&
      !技能设计台原型值需要默认驱动判定(原型, 字段)
    ) {
      delete 字段['驱动属性'];
      delete 字段['影响方向'];
    }
  }
  // —— B:20090-20104
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
  // —— B:20106-20126
  function 清理技能设计台召唤字段(原型 = '', 字段 = {}) {
    if (normalizeSkillUiText(原型, '') !== '召唤生成' || !字段 || typeof 字段 !== 'object') return;
    字段['召唤单位类型'] = normalizeSkillUiText(字段['召唤单位类型'], '魂兽');
    if (!技能设计台召唤单位类型选项.includes(字段['召唤单位类型'])) 字段['召唤单位类型'] = '魂兽';
    字段['目标'] = '自身';
    字段['数量'] = Math.max(1, parseSkillDesignerIntegerInputValue(字段['数量'], 1, 1));
    const 默认行动模式 = ['魂师', '魂兽', '本命召唤兽', '深渊生物'].includes(字段['召唤单位类型']) ? '自主行动' : '协同攻击';
    if (!['自主行动', '护卫', '协同攻击'].includes(normalizeSkillUiText(字段['行动模式'], '')))
      字段['行动模式'] = 默认行动模式;
    const 使用继承 = 技能设计台召唤允许继承属性比例(字段);
    if (使用继承) {
      delete 字段['强度'];
      字段['继承属性比例'] = Math.max(0.01, Math.min(1, toNumber(字段['继承属性比例'], 0.45)));
    } else {
      if (!(toNumber(字段['继承属性比例'], 0) > 0)) delete 字段['继承属性比例'];
      字段['强度'] = Math.max(0.01, toNumber(字段['强度'], 1));
    }
    if (normalizeSkillUiText(字段['行动模式'], '') === '护卫') {
      if (!['可承伤', '护卫承伤', '分摊承伤'].includes(normalizeSkillUiText(字段['承伤规则'], ''))) 字段['承伤规则'] = '护卫承伤';
    } else delete 字段['承伤规则'];
  }
  // —— B:20128-20135
  function 解析技能设计台正负数值(数值) {
    if (typeof 数值 === 'number') return Number.isFinite(数值) ? 数值 : 0;
    const 文本 = normalizeSkillUiText(数值, '');
    const 匹配 = 文本.match(/^([+-]?)(\d+(?:\.\d+)?)(%)?$/);
    if (!匹配) return 0;
    const 符号 = 匹配[1] === '-' ? -1 : 1;
    return 符号 * (Number(匹配[2]) || 0);
  }
  // —— B:20137-20139
  function 技能设计台字段值是百分比修正(数值) {
    return /^[-+]?\d+(?:\.\d+)?%$/.test(normalizeSkillUiText(数值, ''));
  }
  // —— B:20141-20143
  function 技能设计台字段值是数值修正(数值) {
    return /^[-+]?\d+(?:\.\d+)?%?$/.test(normalizeSkillUiText(数值, ''));
  }
  // —— B:20145-20147
  function 技能设计台数值字段使用单位下拉(原型 = '', 字段 = '', effect = {}) {
    return ['混合', '百分比', '点数'].includes(读取技能设计台数值字段口径(原型, 字段, effect));
  }
  // —— B:20149-20151
  function 读取技能设计台数值单位(value = '') {
    return /%$/.test(normalizeSkillUiText(value, '')) ? '百分比' : '点数';
  }
  // —— B:20153-20163
  function 格式化技能设计台单位数值(value = '', 单位 = '点数') {
    const 文本 = normalizeSkillUiText(value, '');
    if (!文本) return '';
    const 匹配 = 文本.match(/^([+-]?)(\d+(?:\.\d+)?)(%)?$/);
    if (!匹配) return 文本;
    const 数值 = Number(匹配[2]);
    if (!Number.isFinite(数值)) return 文本;
    const 精度 = Math.abs(数值 % 1) < 0.0001 ? 0 : 2;
    const 符号 = 匹配[1] === '-' ? '-' : '+';
    return `${符号}${Number(数值.toFixed(精度))}${单位 === '百分比' ? '%' : ''}`;
  }
  // —— B:20173-20180
  function 构建技能设计台数值单位下拉(当前单位 = '点数', 禁用 = false) {
    const disabledAttr = 禁用 ? ' disabled aria-disabled="true"' : '';
    return `
              <select class=\"mvu-editor-select\" data-skill-designer-value-unit data-skill-designer-disableable${disabledAttr}>
                <option value=\"点数\"${当前单位 === '点数' ? ' selected' : ''}>点数</option>
                <option value=\"百分比\"${当前单位 === '百分比' ? ' selected' : ''}>百分比</option>
              </select>`;
  }
  // —— B:20182-20196
  function 读取技能设计台数值字段口径(原型 = '', 字段 = '', effect = {}) {
    const 原型名 = normalizeSkillUiText(原型, '');
    const 字段名 = normalizeSkillUiText(字段, '');
    if (!['数值', '副数值', '强化倍率', '结算倍率'].includes(字段名)) return '';
    if (字段名 === '强化倍率' || 字段名 === '结算倍率') return '百分比';
    if (原型名 === '状态施加') return '百分比';
    if (['属性修正', '判定修正', '资源锁定', '决策干扰'].includes(原型名)) return '百分比';
    if (['资源变化', '资源转移', '护盾变化'].includes(原型名)) return '混合';
    if (原型名 === '结算修正') {
      const 结算 = normalizeSkillUiText(effect && effect['结算'], '');
      return ['消耗', '前摇'].includes(结算) ? '混合' : '百分比';
    }
    if (原型名 === '规则改写' && normalizeSkillUiText(effect && effect['规则'], '') === '死亡转存活') return '百分比';
    return '';
  }
  // —— B:20198-20208
  function 格式化技能设计台百分比字段值(value, fallback = '+5%') {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return fallback;
      return formatSkillDesignerSignedValue(Math.abs(value) <= 1 ? value : value / 100, true);
    }
    const 文本 = normalizeSkillUiText(value, '');
    if (!文本) return fallback;
    if (/%$/.test(文本)) return formatSkillDesignerSignedValue(parseSkillDesignerSignedValue(文本), true);
    const 百分点 = 解析技能设计台正负数值(文本);
    return Number.isFinite(百分点) ? formatSkillDesignerSignedValue(百分点 / 100, true) : fallback;
  }
  // —— B:20210-20216
  function 规范化技能设计台数值字段值(原型 = '', 字段 = '', value = '', effect = {}) {
    const 口径 = 读取技能设计台数值字段口径(原型, 字段, effect);
    if (口径 === '混合') return 格式化技能设计台单位数值(value, 读取技能设计台数值单位(value));
    if (口径 === '点数') return 格式化技能设计台单位数值(value, '点数');
    if (口径 === '百分比') return 格式化技能设计台百分比字段值(value);
    return normalizeSkillDesignerEffectValue(value);
  }
  // —— B:20218-20237
  const 技能设计台结算修正支持字段矩阵 = Object.freeze({
    造成伤害: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '持续回合', '限定元素', '驱动属性', '影响方向']),
    受到伤害: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '持续回合', '限定元素', '驱动属性', '影响方向']),
    治疗: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '持续回合', '驱动属性', '影响方向']),
    消耗: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '持续回合', '限定元素', '驱动属性', '影响方向']),
    前摇: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '持续回合', '限定元素', '驱动属性', '影响方向']),
    反伤: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '持续回合']),
    伤害转移: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '转移对象', '持续回合']),
    伤害吸收: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '对应等级', '吸收来源', '吸收资源', '转化效果', '增幅上限', '持续回合']),
    伤害转治疗: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '持续回合']),
    治疗转伤害: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '持续回合']),
    伤害分摊: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '数量', '持续回合']),
    消耗分摊: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '数量', '持续回合']),
    防御穿透: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '持续回合']),
    防御剥夺: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '持续回合', '驱动属性', '影响方向']),
    精神抗性剥夺: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '持续回合', '驱动属性', '影响方向']),
    技能效果: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '持续回合', '限定元素', '驱动属性', '影响方向']),
    反击: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '持续回合', '触发限制']),
    持续伤害引爆: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值']),
  });
  // —— B:20239-20249
  function 读取技能设计台限定元素列表(value) {
    const 原始列表 = Array.isArray(value) ? value : normalizeSkillUiText(value, '').split(/[、,，/|｜；;\s]+/g);
    const 展开表 = {
      五行类: WUXING_ATTRIBUTE_TOKEN_OPTIONS,
      元素类: ELEMENT_ATTRIBUTE_TOKEN_OPTIONS,
    };
    return Array.from(new Set(原始列表
      .map(项 => normalizeSkillUiText(项, ''))
      .filter(Boolean)
      .flatMap(项 => 展开表[项] || [项])));
  }
  // —— B:20251-20263
  function 格式化技能设计台限定元素显示(value) {
    const 原始列表 = Array.isArray(value) ? value : normalizeSkillUiText(value, '').split(/[、,，/|｜；;\s]+/g);
    const 原始集合 = new Set(原始列表.map(项 => normalizeSkillUiText(项, '')).filter(Boolean));
    if (原始集合.has('元素类')) return '元素类';
    if (原始集合.has('五行类')) return '五行类';
    const 列表 = 读取技能设计台限定元素列表(value).filter(元素 => SPIRIT_ATTRIBUTE_TOKEN_OPTIONS.includes(元素));
    const 等于集合 = 目标 => 列表.length === 目标.length && 目标.every(元素 => 列表.includes(元素));
    if (等于集合(ELEMENT_ATTRIBUTE_TOKEN_OPTIONS)) return '元素类';
    if (等于集合(WUXING_ATTRIBUTE_TOKEN_OPTIONS)) return '五行类';
    if (!列表.length) return '';
    if (列表.length <= 6) return 列表.join('、');
    return `${列表.slice(0, 6).join('、')}等${列表.length}项`;
  }
  // —— B:20276-20280
  function 技能设计台条件分支包含释放后条件(effect = {}) {
    return (Array.isArray(effect && effect['条件分支']) ? effect['条件分支'] : []).some(分支 =>
      技能设计台条件列表包含释放后条件(分支 && 分支['条件']),
    );
  }
  // —— B:20282-20286
  function 技能设计台条件列表包含释放后条件(条件列表 = []) {
    return (Array.isArray(条件列表) ? 条件列表 : []).some(条件 =>
      技能设计台释放前结算禁用条件类型.includes(normalizeSkillUiText(条件 && 条件['类型'], '')),
    );
  }
  // —— B:20288-20299
  function 技能设计台效果列表包含释放前降低结算(效果列表 = []) {
    return (Array.isArray(效果列表) ? 效果列表 : []).some(effect => {
      if (!effect || typeof effect !== 'object' || Array.isArray(effect)) return false;
      const 原型 = normalizeSkillUiText(effect['原型'], '');
      const 结算 = normalizeSkillUiText(effect['结算'], '');
      if (原型 === '结算修正' && ['消耗', '前摇'].includes(结算) && 解析技能设计台正负数值(effect['数值']) < 0) return true;
      return 技能设计台嵌套效果数组字段表.some(键 => 技能设计台效果列表包含释放前降低结算(effect[键]))
        || (Array.isArray(effect['条件分支']) ? effect['条件分支'] : []).some(分支 =>
          技能设计台条件分支效果数组字段表.some(键 => 技能设计台效果列表包含释放前降低结算(分支 && 分支[键])),
        );
    });
  }
  // —— B:20301-20311
  function 断言技能设计台释放后分支不携带释放前降低结算(effect = {}, path = '_效果数组', index = 0) {
    if (!Array.isArray(effect && effect['条件分支'])) return;
    effect['条件分支'].forEach((分支, 分支序号) => {
      if (!技能设计台条件列表包含释放后条件(分支 && 分支['条件'])) return;
      技能设计台条件分支效果数组字段表.forEach(字段名 => {
        if (技能设计台效果列表包含释放前降低结算(分支 && 分支[字段名])) {
          throw new Error(`技能执行结构错误:${path}[${index}].条件分支[${分支序号}]${字段名}不能用命中/被闪避条件降低消耗或前摇`);
        }
      });
    });
  }
  // —— B:20313-20377
  function 断言技能设计台结算修正字段范围(effect = {}, path = '_效果数组', index = 0) {
    const 结算 = normalizeSkillUiText(effect['结算'], '');
    if (/\.状态效果(?:\[|$)/.test(path) && 结算 === '伤害') {
      throw new Error(`技能执行结构错误:${path}[${index}]状态内结算修正必须使用受到伤害`);
    }
    const 支持字段 = 技能设计台结算修正支持字段矩阵[结算];
    if (!支持字段) throw new Error(`技能执行结构错误:${path}[${index}]结算修正选项无效`);
    Object.keys(effect || {}).forEach(字段名 => {
      if (!支持字段.includes(字段名)) throw new Error(`技能执行结构错误:${path}[${index}]${结算}不支持字段${字段名}`);
    });
    const 允许绝对值 = ['消耗', '前摇'].includes(结算);
    if (允许绝对值 ? !技能设计台字段值是数值修正(effect['数值']) : !技能设计台字段值是百分比修正(effect['数值']))
      throw new Error(`技能执行结构错误:${path}[${index}]${结算}数值${允许绝对值 ? '只能填写百分比或绝对值' : '必须使用百分比'}`);
    const 数值 = 解析技能设计台正负数值(effect['数值']);
    if (!Number.isFinite(数值) || 数值 === 0) throw new Error(`技能执行结构错误:${path}[${index}]结算修正数值不能为0`);
    if (['消耗', '前摇'].includes(结算) && 数值 < 0 && 技能设计台条件分支包含释放后条件(effect)) {
      throw new Error(`技能执行结构错误:${path}[${index}]${结算}降低不能使用命中/被闪避条件`);
    }
    if (['反伤', '伤害转移', '伤害吸收', '伤害转治疗', '治疗转伤害', '伤害分摊', '消耗分摊', '防御穿透', '防御剥夺', '精神抗性剥夺', '反击', '持续伤害引爆'].includes(结算) && 数值 <= 0)
      throw new Error(`技能执行结构错误:${path}[${index}]${结算}数值必须为正向百分比`);
    if (['反伤', '伤害转移', '伤害吸收', '伤害转治疗', '治疗转伤害', '伤害分摊', '消耗分摊', '防御穿透', '防御剥夺', '精神抗性剥夺', '反击'].includes(结算) && 数值 > 100)
      throw new Error(`技能执行结构错误:${path}[${index}]${结算}数值不能超过100%`);
    if (结算 === '伤害转移') {
      if (!技能设计台伤害转移对象选项.includes(normalizeSkillUiText(effect['转移对象'], '攻击者')))
        throw new Error(`技能执行结构错误:${path}[${index}]伤害转移对象无效`);
    } else if (effect['转移对象'] !== undefined) {
      throw new Error(`技能执行结构错误:${path}[${index}]${结算}不支持字段转移对象`);
    }
    if (结算 === '伤害吸收') {
      if (!技能设计台伤害吸收来源选项.includes(normalizeSkillUiText(effect['吸收来源'], '造成伤害')))
        throw new Error(`技能执行结构错误:${path}[${index}]伤害吸收来源无效`);
      if (!技能设计台伤害吸收资源选项.includes(normalizeSkillUiText(effect['吸收资源'], '生命')))
        throw new Error(`技能执行结构错误:${path}[${index}]伤害吸收资源无效`);
      if (effect['对应等级'] !== undefined && (!Number.isInteger(Number(effect['对应等级'])) || Number(effect['对应等级']) <= 0))
        throw new Error(`技能执行结构错误:${path}[${index}]伤害吸收对应等级必须为正整数`);
      const 转化效果 = normalizeSkillUiText(effect['转化效果'], '');
      if (转化效果 && !['恢复资源', '下次造成伤害'].includes(转化效果))
        throw new Error(`技能执行结构错误:${path}[${index}]伤害吸收转化效果无效`);
      if (effect['增幅上限'] !== undefined && !技能设计台字段值是百分比修正(effect['增幅上限']))
        throw new Error(`技能执行结构错误:${path}[${index}]伤害吸收增幅上限必须使用百分比`);
    } else {
      if (effect['吸收来源'] !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]${结算}不支持字段吸收来源`);
      if (effect['吸收资源'] !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]${结算}不支持字段吸收资源`);
    }
    if (['伤害分摊', '消耗分摊'].includes(结算)) {
      if (normalizeSkillDesignerEffectTargetValue(effect['目标'], '单体') !== '群体' && effect['数量'] !== undefined)
        throw new Error(`技能执行结构错误:${path}[${index}]${结算}单体目标不支持数量`);
      if (normalizeSkillDesignerEffectTargetValue(effect['目标'], '单体') === '群体' && effect['数量'] !== undefined) {
        const 数量 = Number(effect['数量']);
        if (!(Number.isInteger(数量) && 数量 >= 1)) throw new Error(`技能执行结构错误:${path}[${index}]${结算}数量必须为正整数`);
      }
    }
    if (effect['持续回合'] !== undefined) {
      const 持续回合 = Number(effect['持续回合']);
      if (!(Number.isInteger(持续回合) && 持续回合 >= 1))
        throw new Error(`技能执行结构错误:${path}[${index}]结算修正持续回合必须为正整数`);
    }
    if (effect['限定元素'] !== undefined) {
      const 限定元素列表 = 读取技能设计台限定元素列表(effect['限定元素']);
      if (!限定元素列表.length) throw new Error(`技能执行结构错误:${path}[${index}]${结算}必须填写限定元素`);
      if (限定元素列表.some(元素 => !SPIRIT_ATTRIBUTE_TOKEN_OPTIONS.includes(元素))) throw new Error(`技能执行结构错误:${path}[${index}]${结算}限定元素无效`);
    }
    if (结算 === '反击' && path === '_效果数组') throw new Error(`技能执行结构错误:${path}[${index}]反击只能放在后续触发槽位`);
    if (结算 === '技能效果' && !Array.isArray(effect['条件分支']) && effect['限定元素'] === undefined) throw new Error(`技能执行结构错误:${path}[${index}]技能效果必须绑定条件`);
  }
  // —— B:20389-20396
  function 技能设计台效果支持维持释放(effect = {}) {
    const 原型 = normalizeSkillUiText(effect && effect['原型'], '');
    if (['伤害结算', '资源变化', '资源转移', '护盾变化', '属性修正', '判定修正', '状态施加', '时窗修正', '状态移除', '资源锁定', '决策干扰'].includes(原型)) return true;
    if (原型 === '结算修正') return ['造成伤害', '受到伤害', '治疗', '消耗', '前摇', '技能效果', '防御剥夺', '精神抗性剥夺', '伤害转治疗', '治疗转伤害'].includes(normalizeSkillUiText(effect['结算'], ''));
    if (原型 === '规则改写') return ['束手', '缴械'].includes(normalizeSkillUiText(effect['规则'], ''));
    if (原型 === '机制抹消') return true;
    return false;
  }
  // —— B:20398-20425
  function 断言技能设计台维持契约(skill = {}) {
    const 消耗文本 = 格式化技能消耗显示文本_桥接(skill && skill['消耗'], '');
    if (!/维持[:：]?/.test(消耗文本)) return;
    const 扫描 = (效果列表 = [], path = '_效果数组') => {
      (Array.isArray(效果列表) ? 效果列表 : []).forEach((effect, index) => {
        const 原型 = normalizeSkillUiText(effect && effect['原型'], '');
    if (原型 === '炸环') throw new Error(`技能执行结构错误:${path}[${index}]炸环不支持维持`);
    if (原型 === '时光回溯') throw new Error(`技能执行结构错误:${path}[${index}]时光回溯不支持维持`);
    if (原型 === '修炼增益') throw new Error(`技能执行结构错误:${path}[${index}]修炼增益不进入战斗维持`);
    if (原型 === '战斗外复活') throw new Error(`技能执行结构错误:${path}[${index}]战斗外复活不进入战斗维持`);
        if (原型 === '伤害结算' && effect['持续回合'] !== undefined)
          throw new Error(`技能执行结构错误:${path}[${index}]伤害结算不支持持续回合`);
        if (['召唤生成', '机制授予', '复制执行'].includes(原型) && 技能设计台效果支持维持释放(effect))
          throw new Error(`技能执行结构错误:${path}[${index}]${原型}只能维持存在，不能维持重复释放`);
        技能设计台嵌套效果数组字段表.forEach(key => {
          if (Array.isArray(effect && effect[key])) 扫描(effect[key], `${path}[${index}].${key}`);
        });
        if (Array.isArray(effect && effect['条件分支'])) {
          effect['条件分支'].forEach((branch, branchIndex) => {
            技能设计台条件分支效果数组字段表.forEach(key => {
              if (Array.isArray(branch && branch[key])) 扫描(branch[key], `${path}[${index}].条件分支[${branchIndex}].${key}`);
            });
          });
        }
      });
    };
    扫描(skill['_效果数组']);
  }
  // —— B:20427-20691
  function 清理技能设计台行为闭环字段(原型 = '', 字段 = {}, context = {}) {
    if (!字段 || typeof 字段 !== 'object') return;
    const 允许对应等级 = !!(context && context.允许对应等级);
    delete 字段['事件优先级'];
    delete 字段['快照规则'];
    技能执行旧数组键表_V1.forEach(字段名 => {
      delete 字段[字段名];
    });
    if (原型 === '伤害结算') {
      ['每段倍率', '段间隔', '范围半径', '目标数量上限', '装备条件', '姿态条件', '连招条件', '动作时窗', '中断条件', '主驱动资源', '触发限制'].forEach(字段名 => {
        delete 字段[字段名];
      });
      delete 字段['驱动属性'];
      delete 字段['影响方向'];
      字段['攻击段数'] = Math.max(1, parseSkillDesignerIntegerInputValue(字段['攻击段数'], 1, 1));
      字段['威力倍率'] = 规范化技能设计台伤害威力倍率(字段['威力倍率'], 100);
      if (允许对应等级 && 字段['对应等级'] !== undefined) {
        const 对应等级 = Math.round(toNumber(字段['对应等级'], 0));
        if (Number.isFinite(对应等级) && 对应等级 > 0) 字段['对应等级'] = Math.max(1, Math.min(180, 对应等级));
        else delete 字段['对应等级'];
      } else delete 字段['对应等级'];
      if (!['单体', '群体', '全场'].includes(normalizeSkillUiText(字段['目标'], ''))) delete 字段['目标'];
      const 伤害绑定 = 读取技能设计台伤害绑定(字段['伤害类型'], context?.draft || context?.skill || {});
      字段['伤害类型'] = 伤害绑定.伤害类型;
      字段['结算标签'] = 伤害绑定.结算标签;
      字段['抗性类型'] = 伤害绑定.抗性类型;
    }
    const 原型定义 = SKILL_DESIGNER_PROTOTYPE_REGISTRY[原型];
    const 允许延迟回合 = ['伤害结算', '护盾变化', '属性修正', '状态施加'].includes(原型);
    if (允许延迟回合 && 字段['延迟回合'] !== undefined) {
      const 延迟回合 = Math.max(0, parseSkillDesignerIntegerInputValue(字段['延迟回合'], 0, 0));
      if (延迟回合 > 0) 字段['延迟回合'] = 延迟回合;
      else delete 字段['延迟回合'];
    }
    if (原型 === '时窗修正') {
      const 调整字段 = ['持续回合', '有效期tick', '触发次数', '使用次数'].includes(normalizeSkillUiText(字段['调整字段'], ''))
        ? normalizeSkillUiText(字段['调整字段'], '')
        : '持续回合';
      字段['调整字段'] = 调整字段;
      if (调整字段 === '持续回合') {
        字段['调整回合'] = Math.max(1, Math.min(3, parseSkillDesignerIntegerInputValue(字段['调整回合'] || 字段['持续回合'], 1, 1)));
        delete 字段['状态'];
        delete 字段['调整tick'];
        delete 字段['调整次数'];
        delete 字段['造物名称'];
        const 调整方式 = normalizeSkillUiText(字段['调整方式'], '延长');
        if (调整方式 !== '压缩') delete 字段['结算倍率'];
        else if (!normalizeSkillUiText(字段['结算倍率'], '')) 字段['结算倍率'] = '+100%';
      } else if (调整字段 === '有效期tick') {
        字段['调整tick'] = Math.max(1, Math.min(1008, parseSkillDesignerIntegerInputValue(字段['调整tick'] || 字段['有效期tick'], 6, 1)));
        delete 字段['状态'];
        delete 字段['调整回合'];
        delete 字段['调整次数'];
        delete 字段['造物名称'];
        delete 字段['结算倍率'];
      } else {
        字段['调整次数'] = Math.max(1, Math.min(3, parseSkillDesignerIntegerInputValue(字段['调整次数'] || 字段['调整回合'], 1, 1)));
        delete 字段['状态'];
        delete 字段['调整回合'];
        delete 字段['调整tick'];
        delete 字段['造物名称'];
        delete 字段['结算倍率'];
      }
      字段['单日使用次数上限'] = Math.max(1, Math.min(3, parseSkillDesignerIntegerInputValue(字段['单日使用次数上限'], 1, 1)));
    }
    if (原型 === '资源变化') {
      delete 字段['持续tick'];
      delete 字段['主驱动资源'];
      delete 字段['结算标签'];
      delete 字段['资源转移方式'];
      delete 字段['转化比例'];
      if (normalizeSkillUiText(字段['资源'], '') === '生命' && 解析技能设计台正负数值(字段['数值']) < 0) {
        throw new Error(`技能执行结构错误:${上下文?.path || '_效果数组'}[${上下文?.index || 0}]资源变化生命不允许负数，请使用伤害结算`);
      }
    }
    if (原型 === '资源转移') {
      delete 字段['持续tick'];
      delete 字段['主驱动资源'];
      delete 字段['结算标签'];
      if (字段['持续回合'] !== undefined) {
        const 持续回合 = Math.max(0, Math.min(10, parseSkillDesignerIntegerInputValue(字段['持续回合'], 0, 0)));
        if (持续回合 > 0) 字段['持续回合'] = 持续回合;
        else delete 字段['持续回合'];
      }
      const 资源转移方式 = normalizeSkillUiText(字段['资源转移方式'], '');
      if (!['吞噬', '共享', '均分', '转移'].includes(资源转移方式)) {
        throw new Error(`技能执行结构错误:${上下文?.path || '_效果数组'}[${上下文?.index || 0}]资源转移方式无效`);
      }
      if (字段['资源转移方式'] === '均分') {
        delete 字段['转化比例'];
      } else {
        const 转化比例 = Number(字段['转化比例'] ?? 1);
        if (!Number.isFinite(转化比例) || 转化比例 < 0 || 转化比例 > 2) throw new Error('资源转移转化比例必须在0到2之间');
        字段['转化比例'] = 转化比例;
      }
      字段['数值'] = 格式化技能设计台资源转移数值方向(字段['数值'], 字段['资源转移方式']);
    }
    if (原型 === '战斗外复活') {
      字段['数值'] = normalizeSkillUiText(字段['数值'], '+25%');
      字段['死亡时限tick'] = Math.max(1, parseSkillDesignerIntegerInputValue(字段['死亡时限tick'], 144, 1));
      字段['复活代价类型'] = 技能设计台战斗外复活代价类型选项.includes(normalizeSkillUiText(字段['复活代价类型'], ''))
        ? normalizeSkillUiText(字段['复活代价类型'], '')
        : '状态代价';
      字段['复活代价对象'] = normalizeSkillUiText(字段['复活代价对象'], 字段['复活代价类型'] === '消耗实体物品' ? '复活类丹药' : 字段['复活代价类型'] === '封印能力' ? '魂技' : 字段['复活代价类型'] === '永久代价' ? '等级上限' : '虚弱');
      字段['复活代价值'] = normalizeSkillUiText(字段['复活代价值'], '+1');
      字段['复活代价时限tick'] = Math.max(1, parseSkillDesignerIntegerInputValue(字段['复活代价时限tick'], 144, 1));
      字段['复活后状态'] = normalizeSkillUiText(字段['复活后状态'], '虚弱');
      字段['复活后状态时限tick'] = Math.max(1, parseSkillDesignerIntegerInputValue(字段['复活后状态时限tick'], 144, 1));
    }
    if (原型 === '属性修正') {
      const 合法属性 = ['力量', '防御', '敏捷', '生命上限', '体力上限', '魂力上限', '精神力上限'];
      if (Array.isArray(字段['属性'])) {
        const 属性列表 = 字段['属性'].map(item => normalizeSkillUiText(item, '')).filter(item => 合法属性.includes(item));
        字段['属性'] = 属性列表.length > 1 ? Array.from(new Set(属性列表)) : 属性列表[0] || '力量';
      } else {
        const 属性 = normalizeSkillUiText(字段['属性'], '');
        字段['属性'] = 合法属性.includes(属性) ? 属性 : '力量';
      }
    }
    if (字段['触发限制'] && typeof 字段['触发限制'] === 'object' && !Array.isArray(字段['触发限制'])) {
      字段['触发限制'] = {
        周期: normalizeSkillUiText(字段['触发限制']['周期'], '主动使用') || '主动使用',
        次数: Math.max(1, parseSkillDesignerIntegerInputValue(字段['触发限制']['次数'], 1, 1)),
      };
    }
    const 持续回合 = Math.max(0, parseSkillDesignerIntegerInputValue(字段['持续回合'], 0, 0));
    if (原型 === '规则防御') {
      delete 字段['驱动属性'];
      delete 字段['影响方向'];
    }
    if (原型 === '状态移除') {
      delete 字段['概率'];
      const 数量 = normalizeSkillUiText(字段['数量'], '');
      if (数量) 字段['数量'] = 数量 === '全部' ? '全部' : Math.max(1, Math.min(3, parseSkillDesignerIntegerInputValue(数量, 1, 1)));
      const 匹配原型 = normalizeSkillUiText(字段['匹配原型'], '');
      if (!['资源变化', '护盾变化'].includes(匹配原型)) {
        delete 字段['匹配原型'];
        delete 字段['资源'];
        delete 字段['数值方向'];
      } else if (匹配原型 === '资源变化') {
        字段['资源'] = '生命';
        const 数值方向 = normalizeSkillUiText(字段['数值方向'], '任意');
        字段['数值方向'] = ['负向', '正向', '任意'].includes(数值方向) ? 数值方向 : '任意';
      } else {
        delete 字段['资源'];
        delete 字段['数值方向'];
      }
    }
    if (原型 === '规则改写') {
      字段['规则'] = 技能设计台规则改写选项值.includes(normalizeSkillUiText(字段['规则'], '')) ? normalizeSkillUiText(字段['规则'], '') : '束手';
      if (字段['规则'] === '死亡转存活') {
        字段['目标'] = '自身';
        字段['数值'] = normalizeSkillUiText(字段['数值'], '+25%');
        delete 字段['持续回合'];
        delete 字段['死亡时限tick'];
        delete 字段['复活代价类型'];
        delete 字段['复活代价对象'];
        delete 字段['复活代价值'];
        delete 字段['复活代价时限tick'];
        delete 字段['复活后状态'];
        delete 字段['复活后状态时限tick'];
      } else {
        字段['持续回合'] = Math.max(1, parseSkillDesignerIntegerInputValue(字段['持续回合'], 1, 1));
        delete 字段['数值'];
        delete 字段['死亡时限tick'];
        delete 字段['复活代价类型'];
        delete 字段['复活代价对象'];
        delete 字段['复活代价值'];
        delete 字段['复活代价时限tick'];
        delete 字段['复活后状态'];
        delete 字段['复活后状态时限tick'];
      }
    }
    if (['规则防御', '状态移除', '状态转移', '状态交换'].includes(原型) && 字段['持续回合'] !== undefined) {
      const 持续回合 = Math.max(0, Math.min(10, parseSkillDesignerIntegerInputValue(字段['持续回合'], 0, 0)));
      if (持续回合 > 0) 字段['持续回合'] = 持续回合;
      else delete 字段['持续回合'];
    }
    if (原型 === '状态交换') {
      if (!normalizeSkillUiText(字段['状态'], '')) 字段['状态'] = '任意负面';
    }
    if (原型 === '护盾变化') {
      if (!['正向护盾', '斩盾', '窃盾'].includes(normalizeSkillUiText(字段['护盾模式'], ''))) 字段['护盾模式'] = 解析技能设计台正负数值(字段['数值']) < 0 ? '斩盾' : '正向护盾';
      限制技能设计台护盾变化数值(字段);
      if (normalizeSkillUiText(字段['护盾模式'], '') !== '正向护盾') delete 字段['持续回合'];
    }
    if (原型 === '结算修正' && 字段['限定元素'] !== undefined) {
      const 限定元素列表 = 读取技能设计台限定元素列表(字段['限定元素']).filter(元素 =>
        SPIRIT_ATTRIBUTE_TOKEN_OPTIONS.includes(元素),
      );
      if (限定元素列表.length) {
        字段['限定元素'] = 限定元素列表.length > 1 ? 限定元素列表 : 限定元素列表[0];
      } else {
        delete 字段['限定元素'];
      }
    }
    if (原型 === '结算修正') {
      if (normalizeSkillUiText(字段['结算'], '') === '伤害吸收') {
        字段['吸收来源'] = 技能设计台伤害吸收来源选项.includes(normalizeSkillUiText(字段['吸收来源'], ''))
          ? normalizeSkillUiText(字段['吸收来源'], '')
          : '造成伤害';
        字段['吸收资源'] = 技能设计台伤害吸收资源选项.includes(normalizeSkillUiText(字段['吸收资源'], ''))
          ? normalizeSkillUiText(字段['吸收资源'], '')
          : '生命';
        if (字段['对应等级'] !== undefined) {
          const 对应等级 = Math.round(toNumber(字段['对应等级'], 0));
          if (Number.isFinite(对应等级) && 对应等级 > 0) 字段['对应等级'] = Math.max(1, Math.min(180, 对应等级));
          else delete 字段['对应等级'];
        }
        const 转化效果 = normalizeSkillUiText(字段['转化效果'], '');
        if (转化效果 === '恢复资源' || 转化效果 === '下次造成伤害') 字段['转化效果'] = 转化效果;
        else delete 字段['转化效果'];
        if (字段['增幅上限'] !== undefined) 字段['增幅上限'] = 格式化技能设计台百分比字段值(字段['增幅上限'], '+100%');
      }
      const 支持字段 = 技能设计台结算修正支持字段矩阵[normalizeSkillUiText(字段['结算'], '')];
      if (支持字段) {
        Object.keys(字段).forEach(字段名 => {
          if (!支持字段.includes(字段名)) delete 字段[字段名];
        });
      }
      if (normalizeSkillUiText(字段['结算'], '') !== '持续伤害引爆') {
        if (是技能设计台持续伤害引爆自动条件(字段['条件分支'])) delete 字段['条件分支'];
      }
      if (['伤害分摊', '消耗分摊'].includes(normalizeSkillUiText(字段['结算'], ''))) {
        if (normalizeSkillDesignerEffectTargetValue(字段['目标'], '单体') === '群体') 字段['数量'] = Math.max(1, parseSkillDesignerIntegerInputValue(字段['数量'], 1, 1));
        else delete 字段['数量'];
      }
    }
    if (原型 === '魂骨年限提升') {
      字段['目标'] = '自身';
      字段['数值'] = 格式化技能设计台百分比字段值(字段['数值'], '+10%');
      字段['年限上限'] = Math.max(1, Math.min(10000, Math.round(toNumber(字段['年限上限'], 10000))));
    }
    if (原型 === '修炼增益') {
      const 收益类型 = normalizeSkillUiText(字段['收益类型'], '');
      字段['收益类型'] = ['属性修炼速度', '训练方式收益'].includes(收益类型) ? 收益类型 : '训练方式收益';
      if (字段['收益类型'] === '属性修炼速度') {
        const 修炼属性 = normalizeSkillUiText(字段['修炼属性'], '');
        字段['修炼属性'] = ['力量', '防御', '敏捷', '体力上限', '魂力上限', '精神力上限'].includes(修炼属性) ? 修炼属性 : '魂力上限';
        delete 字段['训练方式'];
      } else {
        const 训练方式 = normalizeSkillUiText(字段['训练方式'], '');
        字段['训练方式'] = ['冥想', '肉体训练', '精神训练', '日常训练', '副职业经验'].includes(训练方式) ? 训练方式 : '冥想';
        delete 字段['修炼属性'];
      }
    }
    if (原型 === '状态施加') {
      const 状态名 = normalizeSkillUiText(字段['状态'], '');
      if (['任意负面', '任意增益', '任意状态'].includes(状态名)) 字段['状态'] = '眩晕';
      if (!技能设计台状态施加允许触发限制(字段['状态'], 字段['目标'])) delete 字段['触发限制'];
    }
    if (原型 === '时光回溯') {
      字段['发动方式'] = ['主动', '被动'].includes(normalizeSkillUiText(字段['发动方式'], '')) ? normalizeSkillUiText(字段['发动方式'], '') : '被动';
      if (字段['发动方式'] === '主动' && normalizeSkillUiText(字段['目标'], '') === '自身') 字段['目标'] = '单体';
      if (!normalizeSkillUiText(字段['驱动属性'], '')) 字段['驱动属性'] = '精神力上限';
    }
    const 方向选项 = normalizeSkillDesignerOptionList(读取技能设计台原型字段选项(原型, '影响方向', { 当前效果: 字段 })).map(选项 => 选项.value);
    if (normalizeSkillUiText(字段['驱动属性'], '') && normalizeSkillUiText(字段['驱动属性'], '') !== '无') {
      if (!方向选项.length) delete 字段['影响方向'];
      else if (!方向选项.includes(normalizeSkillUiText(字段['影响方向'], ''))) 字段['影响方向'] = 选择技能设计台默认影响方向(原型, 字段, 方向选项[0]);
    } else if (normalizeSkillUiText(字段['影响方向'], '')) {
      if (!方向选项.length) delete 字段['影响方向'];
      else if (!方向选项.includes(normalizeSkillUiText(字段['影响方向'], ''))) 字段['影响方向'] = 选择技能设计台默认影响方向(原型, 字段, 方向选项[0]);
    }
  }
  // —— B:20693-20702
  const 技能设计台精神默认驱动原型集合 = new Set([
    '状态移除',
    '状态转移',
    '状态交换',
    '判定修正',
    '决策干扰',
    '机制抹消',
    '资源锁定',
    '规则改写',
  ]);
  // —— B:20704-20712
  function 选择技能设计台默认驱动属性(原型 = '', 字段 = {}) {
    const 原型名 = normalizeSkillUiText(原型, '');
    const 状态名 = normalizeSkillUiText(字段 && 字段['状态'], '');
    if (原型名 === '时光回溯') return '精神力上限';
    if (原型名 === '复制执行') return '精神力上限';
    if (技能设计台精神默认驱动原型集合.has(原型名)) return '精神力上限';
    if (原型名 === '状态施加') return 技能设计台状态施加默认驱动属性表[状态名] || '魂力上限';
    return '魂力上限';
  }
  // —— B:20714-20718
  function 补齐技能设计台非固定数值默认驱动判定(原型 = '', 字段 = {}) {
    if (!技能设计台原型值需要默认驱动判定(原型, 字段)) return;
    字段['驱动属性'] = 选择技能设计台默认驱动属性(原型, 字段);
    字段['影响方向'] = 选择技能设计台默认影响方向(原型, 字段, '效果强度');
  }
  // —— B:20720-20744
  function normalizeSkillDesignerPrototypeFieldValue(value) {
    if (Array.isArray(value)) return value.map(item => normalizeSkillDesignerPrototypeFieldValue(item));
    if (!value || typeof value !== 'object') return value;
    const 英文机制键中文名 = {
      str: '力量',
      def: '防御',
      agi: '敏捷',
      vit: '体力',
      vit_max: '体力上限',
      hp: '生命',
      hp_ratio: '生命比例',
      sp: '魂力',
      sp_max: '魂力上限',
      sp_ratio: '魂力比例',
      men: '精神力',
      men_max: '精神力上限',
      men_ratio: '精神力比例',
    };
    const result = {};
    safeEntries(value).forEach(([key, raw]) => {
      const nextKey = 英文机制键中文名[key] || key;
      result[nextKey] = normalizeSkillDesignerPrototypeFieldValue(raw);
    });
    return result;
  }
  // —— B:20746-20984
  function normalizeSkillDesignerPrototypeEffectEntry(
    value = {},
    fallbackTargetKind = '单体',
    recordViolation = () => {},
    forcedPrototype = '',
    context = {},
  ) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const 来自机制模板 = forcedPrototype && typeof forcedPrototype === 'object' && !Array.isArray(forcedPrototype);
    const forcedEntry =
      forcedPrototype && typeof forcedPrototype === 'object' && !Array.isArray(forcedPrototype)
        ? forcedPrototype
        : { 原型: forcedPrototype };
    const 原型 = normalizeSkillUiText(forcedEntry['原型'] || value['原型'], '');
    const 原型定义 = SKILL_DESIGNER_PROTOTYPE_REGISTRY[原型];
    if (!原型 || !原型定义) return null;
    const allowedFields = new Set(Array.isArray(原型定义['允许字段']) ? 原型定义['允许字段'] : ['原型', '目标']);
    safeEntries(value).forEach(([key]) => {
      if (技能执行黑名单键集合_V1.has(key) || SKILL_DESIGNER_PROTOTYPE_FORBIDDEN_FIELDS.has(key))
        recordViolation(`${原型}.${key}`);
    });
    const 旧独立条件字段 = ['环境条件', '装备条件', '姿态条件', '连招条件', '动作时窗', '中断条件'].find(字段名 => value[字段名] !== undefined);
    if (旧独立条件字段) recordViolation(`${原型}.${旧独立条件字段}.已删除`);
    const 嵌套字段 = normalizeSkillUiText(context && context.嵌套字段, '');
    const 目标默认值 = 技能设计台按上下文默认目标(原型, value['目标'] || fallbackTargetKind, context);
    const 目标 = normalizeSkillDesignerExecutionTargetModel(value['目标'] || 目标默认值, 目标默认值);
    const 持续回合 = Math.max(0, parseSkillDesignerIntegerInputValue(value['持续回合'], 0, 0));
    const 持续tick = Math.max(0, parseSkillDesignerIntegerInputValue(value['持续tick'], 0, 0));
    const 有效期tick = Math.max(0, parseSkillDesignerIntegerInputValue(value['有效期tick'], 0, 0));
    const 字段 = {};
    const 字段允许数组 = key =>
      SKILL_DESIGNER_BATCH_EFFECT_FIELD_KEYS.includes(key) ||
      技能设计台嵌套效果数组字段集合.has(key) ||
      normalizeSkillUiText(原型定义 && 原型定义['字段定义'] && 原型定义['字段定义'][key] && 原型定义['字段定义'][key]['类型'], '') === '多枚举';
    safeEntries(forcedEntry).forEach(([key, raw]) => {
      if (key === '原型' || key === '目标' || raw === undefined || raw === null) return;
      if (技能执行黑名单键集合_V1.has(key) || SKILL_DESIGNER_PROTOTYPE_FORBIDDEN_FIELDS.has(key)) {
        recordViolation(`${原型}.${key}`);
        return;
      }
      if (!allowedFields.has(key)) return;
      if (Array.isArray(raw) && !字段允许数组(key)) {
        recordViolation(`${原型}.${key}.数组`);
        return;
      }
      字段[key] = normalizeSkillDesignerPrototypeFieldValue(cloneJsonValue(raw));
    });
    safeEntries(value).forEach(([key, raw]) => {
      if (
        [
          '原型',
          '机制',
          '目标',
          '持续回合',
          '持续tick',
          '有效期tick',
          '条件分支',
          '表现语义',
          '推荐语义',
        ].includes(key)
      )
        return;
      if (技能执行黑名单键集合_V1.has(key) || SKILL_DESIGNER_PROTOTYPE_FORBIDDEN_FIELDS.has(key)) {
        recordViolation(`${原型}.${key}`);
        return;
      }
      if (raw === undefined || raw === null) return;
      if (typeof raw === 'string' && !raw.trim()) return;
      const normalizedField = normalizeSkillDesignerPrototypeFieldValue({ [key]: cloneJsonValue(raw) });
      safeEntries(normalizedField).forEach(([fieldKey, fieldValue]) => {
        if (Array.isArray(fieldValue) && !字段允许数组(fieldKey)) {
          recordViolation(`${原型}.${fieldKey}.数组`);
          return;
        }
        if (!allowedFields.has(fieldKey)) {
          if (!来自机制模板) recordViolation(`${原型}.${fieldKey}`);
          return;
        }
        字段[fieldKey] = fieldValue;
      });
    });
    if (字段['属性'] !== undefined) 字段['属性'] = getSkillDesignerPackedPropertyLabel(字段['属性']);
    if (字段['驱动属性'] !== undefined) 字段['驱动属性'] = getSkillDesignerPackedPropertyLabel(字段['驱动属性']);
    if (字段['数值'] !== undefined) {
      const 原始数值 = 原型 === '资源转移' && value && value['数值'] !== undefined ? value['数值'] : 字段['数值'];
      字段['数值'] = 规范化技能设计台数值字段值(原型, '数值', 原始数值, 字段);
    }
    if (
      context &&
      context.禁用释放前降低结算 &&
      原型 === '结算修正' &&
      ['消耗', '前摇'].includes(normalizeSkillUiText(字段['结算'], '')) &&
      解析技能设计台正负数值(字段['数值']) < 0
    ) {
      recordViolation('结算修正.释放前结算');
      return null;
    }
    if (字段['结算倍率'] !== undefined) 字段['结算倍率'] = 规范化技能设计台数值字段值(原型, '结算倍率', 字段['结算倍率'], 字段);
    if (原型 === '护盾变化') 限制技能设计台护盾变化数值(字段);
    if (!['独立生效', '跟随主原型'].includes(normalizeSkillUiText(字段['生效方式'], ''))) 字段['生效方式'] = '独立生效';
    if (context && (context.强制独立 || context.条件分支 || 嵌套字段)) 字段['生效方式'] = '独立生效';
    if (字段['生效方式'] === '跟随主原型' && normalizeSkillUiText(字段['目标'], '') === '自身') {
      delete 字段['驱动属性'];
      delete 字段['影响方向'];
    }
    if (原型 === '炸环') {
      字段['目标'] = '自身';
      字段['强化倍率'] = formatSkillDesignerSignedValue(Math.max(0.01, parseSkillDesignerPercentRatio(字段['强化倍率'], 1)), true);
    }
    if (原型 === '资源锁定') 字段['数值'] = normalizeSkillDesignerResourceLockRatio(字段['数值'], 0.5);
    if (字段['匹配原型'] === '无') delete 字段['匹配原型'];
    if (原型 === '状态移除') {
      const 匹配原型 = normalizeSkillUiText(字段['匹配原型'], '');
      if (!['资源变化', '护盾变化'].includes(匹配原型)) {
        delete 字段['匹配原型'];
        delete 字段['资源'];
        delete 字段['数值方向'];
      } else if (匹配原型 === '资源变化') {
        字段['资源'] = '生命';
        const 数值方向 = normalizeSkillUiText(字段['数值方向'], '任意');
        字段['数值方向'] = ['负向', '正向', '任意'].includes(数值方向) ? 数值方向 : '任意';
      } else {
        delete 字段['资源'];
        delete 字段['数值方向'];
      }
    } else {
      delete 字段['数值方向'];
    }
    if (持续回合 > 0 && allowedFields.has('持续回合')) 字段['持续回合'] = 持续回合;
    if (持续tick > 0 && allowedFields.has('持续tick')) 字段['持续tick'] = 持续tick;
    if (有效期tick > 0 && allowedFields.has('有效期tick')) 字段['有效期tick'] = 有效期tick;
    fillSkillDesignerPrototypeValueFromTemplate(原型, 字段, value);
    if (原型 === '规则改写') {
      字段['目标'] = 约束技能设计台原型正式目标(原型, 目标, 目标默认值, 字段);
      delete 字段['死亡时限tick'];
      delete 字段['复活代价类型'];
      delete 字段['复活代价对象'];
      delete 字段['复活代价值'];
      delete 字段['复活代价时限tick'];
      delete 字段['复活后状态'];
      delete 字段['复活后状态时限tick'];
    }
    if (原型 === '机制授予') {
      const 触发条件 = normalizeSkillUiText(字段['触发条件'] || value['触发条件'], '主动触发');
      const 授予目标 = 约束技能设计台原型正式目标(原型, 目标, 目标默认值, 字段);
      字段['触发条件'] = 读取技能设计台机制授予触发条件选项(授予目标).includes(触发条件) ? 触发条件 : '主动触发';
      if (字段['触发条件'] === '随下次行动触发') {
        delete 字段['可用次数'];
      } else {
        字段['可用次数'] = Math.max(
          1,
          parseSkillDesignerIntegerInputValue(字段['可用次数'] ?? value['可用次数'] ?? value.useCount, 1, 1),
        );
      }
      if (字段['触发条件'] === '主动触发' || normalizeSkillUiText(value['持续回合'] ?? value.duration, '')) {
        字段['持续回合'] = Math.max(
          1,
          parseSkillDesignerIntegerInputValue(字段['持续回合'] ?? value['持续回合'] ?? value.duration, 1, 1),
        );
      } else delete 字段['持续回合'];
    }
    if (原型 === '机制抹消') {
      字段['抹消对象'] = 规范化技能设计台机制抹消对象(字段['抹消对象']);
    }
    字段['目标'] = 原型 === '位移执行' ? 目标 : 约束技能设计台原型正式目标(原型, 目标, 目标默认值, 字段);
    if (原型 === '护盾变化') {
      if (!['正向护盾', '斩盾', '窃盾'].includes(normalizeSkillUiText(字段['护盾模式'], ''))) 字段['护盾模式'] = 解析技能设计台正负数值(字段['数值']) < 0 ? '斩盾' : '正向护盾';
      限制技能设计台护盾变化数值(字段);
      if (normalizeSkillUiText(字段['护盾模式'], '') !== '正向护盾') delete 字段['持续回合'];
    }
    清理技能设计台位移字段(原型, 字段);
    清理技能设计台召唤字段(原型, 字段);
    清理技能设计台行为闭环字段(原型, 字段, context);
    补齐技能设计台非固定数值默认驱动判定(原型, 字段);
    清理技能设计台行为闭环字段(原型, 字段, context);
    应用技能设计台目标驱动契约(原型, 字段);
    清理技能设计台打断效果字段(原型, 字段);
    清理技能设计台纯布尔控制字段(原型, 字段);
    safeEntries(字段).forEach(([key, raw]) => {
      const 字段定义 =
        原型定义['字段定义'] && typeof 原型定义['字段定义'] === 'object' ? 原型定义['字段定义'][key] : null;
      const 类型 = normalizeSkillUiText(字段定义 && 字段定义['类型'], '');
      const 选项 = normalizeSkillDesignerOptionList(Array.isArray(字段定义 && 字段定义['选项']) ? 字段定义['选项'] : []).map(
        选项项 => 选项项.value,
      );
      if (!选项.length || !['枚举', '多枚举'].includes(类型)) return;
      if (Array.isArray(raw)) {
        const 合法列表 = raw.filter(item => 选项.includes(normalizeSkillUiText(item, '')));
        if (合法列表.length) 字段[key] = 合法列表;
        else delete 字段[key];
        return;
      }
      if (!选项.includes(normalizeSkillUiText(raw, ''))) {
        delete 字段[key];
      }
    });
    if (原型 === '状态施加') {
      const 状态名 = normalizeSkillUiText(字段['状态'], '');
      if (字段['数值'] !== undefined) {
        字段['数值'] = 格式化技能设计台状态施加比例字段(字段['数值'], 技能设计台状态施加默认数值(状态名));
        字段['数值'] = 限制技能设计台状态施加比例字段(状态名, '数值', 字段['数值']);
      }
      if (字段['副数值'] !== undefined) {
        字段['副数值'] = 格式化技能设计台状态施加比例字段(字段['副数值'], 技能设计台状态施加默认副数值(状态名));
        字段['副数值'] = 限制技能设计台状态施加比例字段(状态名, '副数值', 字段['副数值']);
      }
      if (!技能设计台状态施加允许触发限制(状态名, 字段['目标'])) delete 字段['触发限制'];
    }
    if (原型 === '状态移除' && !['1', '2', '3', '全部'].includes(normalizeSkillUiText(字段['数量'], '1')))
      delete 字段['数量'];
    技能设计台嵌套效果数组字段表.forEach(key => {
      const nested = Array.isArray(value[key]) ? value[key] : [];
      if (!nested.length) return;
      if (!allowedFields.has(key)) {
        recordViolation(`${原型}.${key}`);
        return;
      }
      字段[key] = nested
        .flatMap(effect =>
          normalizeSkillDesignerExecutionEffectEntryList(effect, 目标, recordViolation, {
            嵌套字段: key,
            父原型: 原型,
          }),
        )
        .filter(Boolean);
    });
    const 条件分支源 =
      Array.isArray(字段['条件分支']) && 字段['条件分支'].length
        ? 字段['条件分支']
        : value['条件分支'] || [];
    delete 字段['条件分支'];
    const normalized = { 原型: 原型, 目标: 目标, ...字段 };
    normalized['目标'] = 约束技能设计台原型正式目标(原型, normalizeSkillDesignerExecutionTargetModel(normalized['目标'], 目标), 目标默认值, normalized);
    const 条件分支 = normalizeSkillDesignerConditionBranchList(条件分支源, 目标, recordViolation, normalized);
    if (条件分支.length) normalized['条件分支'] = 条件分支;
    应用技能设计台目标驱动契约(原型, normalized);
    normalized['目标'] = 约束技能设计台原型正式目标(原型, normalizeSkillDesignerExecutionTargetModel(normalized['目标'], 目标), 目标默认值, normalized);
    return normalized;
  }
  // —— B:20986-21012
  function normalizeSkillDesignerExecutionEffectEntryList(
    value = {},
    fallbackTargetKind = '单体',
    recordViolation = () => {},
    context = {},
  ) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const batchEntries = expandSkillDesignerBatchEffectFields(value);
    if (batchEntries.length !== 1 || batchEntries[0] !== value) {
      return batchEntries.flatMap(entry =>
        normalizeSkillDesignerExecutionEffectEntryList(entry, fallbackTargetKind, recordViolation, context),
      );
    }
    const explicitPrototype = normalizeSkillUiText(value['原型'], '');
    if (explicitPrototype) {
      const normalized = normalizeSkillDesignerPrototypeEffectEntry(
        value,
        fallbackTargetKind,
        recordViolation,
        explicitPrototype,
        context,
      );
      return normalized ? [normalized] : [];
    }
    if (normalizeSkillUiText(value['机制'], '')) recordViolation('机制字段');
    return [];
  }
  // —— B:21022-21039
  function normalizeSkillDesignerExecutionEffectArray(effectArray = [], fallbackTargetKind = '单体', context = {}) {
    const source = Array.isArray(effectArray) ? effectArray : [];
    const violationList = [];
    const recordViolation = path => {
      if (!path) return;
      violationList.push(path);
    };
    const effectList = source
      .flatMap(effect =>
        normalizeSkillDesignerExecutionEffectEntryList(effect, fallbackTargetKind, recordViolation, context),
      )
      .filter(Boolean);
    if (violationList.length) {
      const uniqueList = Array.from(new Set(violationList));
      throw new Error(`[技能执行结构校验失败] 检测到黑名单字段：${uniqueList.join('、')}`);
    }
    return effectList;
  }
  // —— B:21041-21620
  function 断言技能设计台效果数组契约(效果数组 = [], path = '_效果数组') {
    if (!Array.isArray(效果数组)) return;
    const 主目标 = normalizeSkillUiText(效果数组[0] && 效果数组[0]['目标'], '');
    const 是结算效果路径 = /\.结算效果(?:\[|$)/.test(path);
    const 是授予效果路径 = /\.授予效果(?:\[|$)/.test(path);
    效果数组.forEach((effect, index) => {
      if (!effect || typeof effect !== 'object' || Array.isArray(effect)) {
        throw new Error(`技能执行结构错误:${path}[${index}]不是效果对象`);
      }
      const 原型 = normalizeSkillUiText(effect['原型'], '');
      if (!原型) throw new Error(`技能执行结构错误:${path}[${index}]缺少原型`);
      const 原型定义 = SKILL_DESIGNER_PROTOTYPE_REGISTRY[原型];
      if (!原型定义) throw new Error(`技能执行结构错误:${path}[${index}]未知原型${原型}`);
      const 缺失必填字段 = (Array.isArray(原型定义['必填字段']) ? 原型定义['必填字段'] : []).filter(字段名 => {
        const 原值 = effect[字段名];
        return 原值 === undefined || 原值 === null || (typeof 原值 === 'string' && !原值.trim()) || (Array.isArray(原值) && !原值.length);
      });
      if (原型 === '状态移除' && !normalizeSkillUiText(effect['状态'], '') && !normalizeSkillUiText(effect['匹配原型'], '')) {
        缺失必填字段.push('状态/匹配原型');
      }
      if (缺失必填字段.length) throw new Error(`技能执行结构错误:${path}[${index}]缺少必填字段${缺失必填字段.join('、')}`);
      if (原型 === '伤害结算' && effect['持续回合'] !== undefined)
        throw new Error(`技能执行结构错误:${path}[${index}]伤害结算不支持持续回合`);
      const 允许对应等级字段 = 原型 === '伤害结算'
        || (原型 === '结算修正' && normalizeSkillUiText(effect['结算'], '') === '伤害吸收');
      if (effect['对应等级'] !== undefined) {
        if (!允许对应等级字段) throw new Error(`技能执行结构错误:${path}[${index}]对应等级只允许伤害结算或伤害吸收`);
        const 对应等级 = Number(effect['对应等级']);
        if (!Number.isInteger(对应等级) || 对应等级 <= 0) throw new Error(`技能执行结构错误:${path}[${index}]对应等级必须为正整数`);
      }
      if (effect['资源转移角色'] !== undefined)
        throw new Error(`技能执行结构错误:${path}[${index}]资源转移角色已删除`);
      const 正式字段集合 = new Set(Array.isArray(原型定义 && 原型定义['允许字段']) ? 原型定义['允许字段'] : []);
      if (原型 === '结算修正') {
        const 支持字段 = 技能设计台结算修正支持字段矩阵[normalizeSkillUiText(effect['结算'], '')];
        if (支持字段) 支持字段.forEach(字段名 => 正式字段集合.add(字段名));
      }
      Object.keys(effect).forEach(字段名 => {
        if (!正式字段集合.has(字段名)) throw new Error(`技能执行结构错误:${path}[${index}]${原型}不支持字段${字段名}`);
      });
      if (['友方单体', '友方群体', '敌方单体', '敌方群体', '己方/单体', '己方/群体', '敌方/单体', '敌方/群体'].includes(normalizeSkillUiText(effect['目标'], '')))
        throw new Error(`技能执行结构错误:${path}[${index}]原型目标只能写正式目标范围`);
      if (normalizeSkillUiText(effect['机制'], '')) throw new Error(`技能执行结构错误:${path}[${index}]仍写入机制字段`);
      if (normalizeSkillUiText(effect['运行机制'], ''))
        throw new Error(`技能执行结构错误:${path}[${index}]仍写入运行机制字段`);
      if (normalizeSkillUiText(effect['副作用列表'], '') || Array.isArray(effect['副作用列表']))
        throw new Error(`技能执行结构错误:${path}[${index}]仍写入副作用列表`);
      if (effect['机制决策临时'] && typeof effect['机制决策临时'] === 'object')
        throw new Error(`技能执行结构错误:${path}[${index}]仍写入机制决策临时`);
      const 当前目标 = normalizeSkillDesignerEffectTargetValue(effect['目标'], normalizeSkillUiText(effect['目标'], ''));
      const 是顶层路径 = path === '_效果数组';
      if (当前目标 === '分身' && !技能设计台原型允许分身目标(原型))
        throw new Error(`技能执行结构错误:${path}[${index}]只有资源变化/属性修正/判定修正/结算修正可以选择分身目标`);
      if (原型 === '结算修正' && ['伤害分摊', '消耗分摊'].includes(normalizeSkillUiText(effect['结算'], '')) && !技能设计台分摊结算目标候选().includes(当前目标))
        throw new Error(`技能执行结构错误:${path}[${index}]${normalizeSkillUiText(effect['结算'], '')}目标只允许单体/群体`);
      if (原型 === '修炼增益' && !['自身', '单体', '群体', '全场'].includes(当前目标))
        throw new Error(`技能执行结构错误:${path}[${index}]修炼增益目标只允许自身/单体/群体/全场`);
      if (原型 === '魂骨年限提升') {
        if (当前目标 !== '自身') throw new Error(`技能执行结构错误:${path}[${index}]魂骨年限提升目标必须是自身`);
        if (!技能设计台字段值是百分比修正(effect['数值'])) throw new Error(`技能执行结构错误:${path}[${index}]魂骨年限提升数值必须使用百分比`);
        const 提升比例 = 解析技能设计台正负数值(effect['数值']);
        if (!(提升比例 > 0 && 提升比例 <= 100)) throw new Error(`技能执行结构错误:${path}[${index}]魂骨年限提升比例必须在0到100%之间`);
        const 年限上限 = Number(effect['年限上限']);
        if (!Number.isInteger(年限上限) || 年限上限 < 1 || 年限上限 > 10000) throw new Error(`技能执行结构错误:${path}[${index}]魂骨年限提升年限上限必须是1到10000的整数`);
      }
      if (原型 === '战斗外复活') {
        if (当前目标 === '自身') throw new Error(`技能执行结构错误:${path}[${index}]战斗外复活目标不能是自身`);
        if (!['单体', '群体', '全场'].includes(当前目标)) throw new Error(`技能执行结构错误:${path}[${index}]战斗外复活目标只允许单体/群体/全场`);
        if (!技能设计台战斗外复活代价类型选项.includes(normalizeSkillUiText(effect['复活代价类型'], ''))) throw new Error(`技能执行结构错误:${path}[${index}]战斗外复活代价类型无效`);
        ['死亡时限tick', '复活代价时限tick', '复活后状态时限tick'].forEach(字段名 => {
          const 数值 = toNumber(effect[字段名], NaN);
          if (!Number.isFinite(数值) || 数值 < 1 || Math.round(数值) !== 数值) throw new Error(`技能执行结构错误:${path}[${index}]${字段名}必须为正整数`);
        });
      }
      if (是顶层路径 && ['状态转移', '状态交换'].includes(原型) && 当前目标 !== '单体')
        throw new Error(`技能执行结构错误:${path}[${index}]${原型}顶层目标只允许单体`);
      if (是顶层路径 && 原型 === '状态移除' && !['自身', '单体', '群体'].includes(当前目标))
        throw new Error(`技能执行结构错误:${path}[${index}]状态移除顶层目标只允许自身/单体/群体`);
      if (是顶层路径 && 原型 === '规则防御' && !['自身', '单体', '群体'].includes(当前目标))
        throw new Error(`技能执行结构错误:${path}[${index}]规则防御顶层目标只允许自身/单体/群体`);
      if (原型 === '规则防御' && (effect['驱动属性'] !== undefined || effect['影响方向'] !== undefined))
        throw new Error(`技能执行结构错误:${path}[${index}]${原型}不允许驱动属性或影响方向`);
      if (原型 === '状态移除' && effect['概率'] !== undefined)
        throw new Error(`技能执行结构错误:${path}[${index}]状态移除不允许概率，成功率由驱动属性修正`);
      if (原型 === '状态移除' && effect['抵抗判定'] !== undefined)
        throw new Error(`技能执行结构错误:${path}[${index}]状态移除不允许抵抗判定，成功率由驱动属性修正`);
      if (原型 === '状态移除') {
        const 匹配原型 = normalizeSkillUiText(effect['匹配原型'], '');
        if (匹配原型 && !['资源变化', '护盾变化'].includes(匹配原型))
          throw new Error(`技能执行结构错误:${path}[${index}]状态移除匹配原型只允许资源变化/护盾变化`);
        if (匹配原型 === '资源变化') {
          if (normalizeSkillUiText(effect['资源'], '') !== '生命')
            throw new Error(`技能执行结构错误:${path}[${index}]状态移除资源变化只支持生命`);
          if (!['负向', '正向', '任意'].includes(normalizeSkillUiText(effect['数值方向'], '')))
            throw new Error(`技能执行结构错误:${path}[${index}]状态移除数值方向无效`);
        } else if (effect['资源'] !== undefined || effect['数值方向'] !== undefined) {
          throw new Error(`技能执行结构错误:${path}[${index}]状态移除非资源变化不允许资源或数值方向`);
        }
        if (effect['持续回合'] !== undefined) {
          const 持续回合 = toNumber(effect['持续回合'], 0);
          if (!Number.isFinite(持续回合) || 持续回合 < 1 || 持续回合 > 10 || Math.round(持续回合) !== 持续回合)
            throw new Error(`技能执行结构错误:${path}[${index}]状态移除持续回合必须为1到10的整数`);
        }
      }
      if (原型 === '状态交换' && !技能设计台状态交换状态有效(effect['状态']))
        throw new Error(`技能执行结构错误:${path}[${index}]状态交换只允许自身负面状态筛选`);
      if (原型 === '状态交换') {
        const 交换状态 = normalizeSkillUiText(effect['状态'], '任意负面');
        const 有自身前置 = (Array.isArray(effect['条件分支']) ? effect['条件分支'] : []).some(分支 =>
          (Array.isArray(分支 &&分支['条件']) ? 分支['条件'] : []).some(条件 =>
            normalizeSkillUiText(条件 && 条件['类型'], '') === '状态存在' &&
            normalizeSkillUiText(条件 && 条件['对象'], '') === '自身' &&
            normalizeSkillUiText(条件 && 条件['比较'], '') === '无' &&
            normalizeSkillUiText(条件 && 条件['状态'], '') === 交换状态,
          ),
        );
        if (!有自身前置) throw new Error(`技能执行结构错误:${path}[${index}]状态交换缺少状态前置条件`);
        if (effect['持续回合'] !== undefined) {
          const 持续回合 = toNumber(effect['持续回合'], 0);
          if (!Number.isFinite(持续回合) || 持续回合 < 1 || 持续回合 > 10 || Math.round(持续回合) !== 持续回合)
            throw new Error(`技能执行结构错误:${path}[${index}]状态交换持续回合必须为1到10的整数`);
        }
      }
      if (
        原型 === '状态转移' &&
        (!['自身', '目标', '友方', '敌方'].includes(normalizeSkillUiText(effect['来源'], '')) ||
          !['自身', '目标', '友方', '敌方'].includes(normalizeSkillUiText(effect['去向'], '')))
      )
        throw new Error(`技能执行结构错误:${path}[${index}]状态转移来源或去向无效`);
      if (原型 === '状态转移') {
        const 数量文本 = normalizeSkillUiText(effect['数量'], '');
        const 数量合法 = 数量文本 === '全部' || (Number.isInteger(Number(数量文本)) && Number(数量文本) > 0);
        if (!数量合法) throw new Error(`技能执行结构错误:${path}[${index}]状态转移数量只允许正整数或全部`);
        if (effect['持续回合'] !== undefined) {
          const 持续回合 = toNumber(effect['持续回合'], 0);
          if (!Number.isFinite(持续回合) || 持续回合 < 1 || 持续回合 > 10 || Math.round(持续回合) !== 持续回合)
          throw new Error(`技能执行结构错误:${path}[${index}]状态转移持续回合必须为1到10的整数`);
        }
      }
      if (原型 === '召唤生成') {
        const 单位类型 = normalizeSkillUiText(effect['召唤单位类型'], '');
        if (!技能设计台召唤单位类型选项.includes(单位类型))
          throw new Error(`技能执行结构错误:${path}[${index}]召唤单位类型无效`);
        if (!['自主行动', '护卫', '协同攻击'].includes(normalizeSkillUiText(effect['行动模式'], '')))
          throw new Error(`技能执行结构错误:${path}[${index}]召唤行动模式无效`);
        if (单位类型 === '本命召唤兽' && !技能设计台召唤使用继承属性比例(effect))
          throw new Error(`技能执行结构错误:${path}[${index}]本命召唤兽必须携带继承属性比例`);
        if (单位类型 === '分身' && !技能设计台召唤使用继承属性比例(effect))
          throw new Error(`技能执行结构错误:${path}[${index}]分身必须携带继承属性比例`);
        if (!技能设计台召唤允许继承属性比例(effect) && (effect['继承属性比例'] !== undefined || effect['属性继承比例'] !== undefined))
          throw new Error(`技能执行结构错误:${path}[${index}]${单位类型}不允许继承属性比例`);
        if (技能设计台召唤允许继承属性比例(effect) && effect['强度'] !== undefined)
          throw new Error(`技能执行结构错误:${path}[${index}]继承型召唤不应携带强度`);
        if (!技能设计台召唤允许继承属性比例(effect) && effect['强度'] === undefined)
          throw new Error(`技能执行结构错误:${path}[${index}]模板召唤缺少强度`);
        const 召唤数量 = Math.max(1, Math.round(toNumber(effect['数量'] ?? effect['召唤数量'], 1)));
        if (单位类型 === '本命召唤兽' && 召唤数量 !== 1)
          throw new Error(`技能执行结构错误:${path}[${index}]本命召唤兽数量必须为1`);
        if (单位类型 !== '分身' && !技能设计台召唤允许普通批量(effect) && 召唤数量 !== 1)
          throw new Error(`技能执行结构错误:${path}[${index}]${单位类型}不允许批量召唤`);
        if (normalizeSkillUiText(effect['行动模式'], '') === '护卫' && !技能设计台召唤承伤规则选项.includes(normalizeSkillUiText(effect['承伤规则'], '')))
          throw new Error(`技能执行结构错误:${path}[${index}]护卫召唤必须允许承伤`);
        if (normalizeSkillUiText(effect['行动模式'], '') !== '护卫' && effect['承伤规则'] !== undefined)
          throw new Error(`技能执行结构错误:${path}[${index}]非护卫召唤不应携带承伤规则`);
      }
      if (原型 === '复制执行') {
        const 复制类型 = normalizeSkillUiText(effect['复制类型'], '复制技能');
        if (!SKILL_DESIGNER_PARAM_COPY_TARGET_OPTIONS.includes(复制类型))
          throw new Error(`技能执行结构错误:${path}[${index}]复制类型无效`);
        if (!技能设计器参数复制模式选项.includes(normalizeSkillUiText(effect['复制模式'], '即时镜像')))
          throw new Error(`技能执行结构错误:${path}[${index}]复制模式无效`);
        const 允许字段 = new Set(['原型', '目标', '复制类型', '复制模式', '保存上限', '削减比例', '可用次数', '保留回合', '保留时长tick', '条件分支', '生效方式', '驱动属性', '影响方向']);
        Object.keys(effect).forEach(字段名 => {
          if (!允许字段.has(字段名)) throw new Error(`技能执行结构错误:${path}[${index}]复制执行包含不支持字段`);
        });
      if (effect['削减比例'] !== undefined && !/属性|全部/.test(复制类型))
        throw new Error(`技能执行结构错误:${path}[${index}]复制削减比例只允许属性或全部复制使用`);
      ['保存上限', '可用次数'].forEach(字段名 => {
        if (effect[字段名] !== undefined && !['复制技能', '复制全部'].includes(复制类型))
          throw new Error(`技能执行结构错误:${path}[${index}]复制${字段名}只允许复制技能或复制全部使用`);
      });
        if (!/属性|全部/.test(复制类型) && (effect['驱动属性'] !== undefined || effect['影响方向'] !== undefined))
          throw new Error(`技能执行结构错误:${path}[${index}]复制技能不允许驱动属性或影响方向`);
      }
      if (原型 === '规则防御' && !['免伤', '免死'].includes(normalizeSkillUiText(effect['规则'], '')))
        throw new Error(`技能执行结构错误:${path}[${index}]规则防御规则只允许免伤/免死`);
      if (原型 === '规则防御' && effect['持续回合'] !== undefined) {
        const 持续回合 = toNumber(effect['持续回合'], 0);
        if (!Number.isFinite(持续回合) || 持续回合 < 1 || 持续回合 > 99 || Math.round(持续回合) !== 持续回合)
          throw new Error(`技能执行结构错误:${path}[${index}]规则防御持续回合必须为1到99的整数`);
      }
      if (原型 === '规则改写') {
        if (!技能设计台规则改写选项值.includes(normalizeSkillUiText(effect['规则'], '')))
          throw new Error(`技能执行结构错误:${path}[${index}]规则改写规则无效`);
        if (normalizeSkillUiText(effect['规则'], '') === '死亡转存活') {
          if (当前目标 === '自身') {
            if (effect['持续回合'] !== undefined || effect['死亡时限tick'] !== undefined || effect['复活代价类型'] !== undefined || effect['复活代价对象'] !== undefined || effect['复活代价值'] !== undefined || effect['复活代价时限tick'] !== undefined || effect['复活后状态'] !== undefined || effect['复活后状态时限tick'] !== undefined) {
              const 战斗内禁用字段 = ['死亡时限tick', '复活代价类型', '复活代价对象', '复活代价值', '复活代价时限tick', '复活后状态', '复活后状态时限tick', '持续回合'].find(字段名 => effect[字段名] !== undefined);
              throw new Error(`技能执行结构错误:${path}[${index}]自身死亡转存活不支持字段${战斗内禁用字段}`);
            }
          }
        } else {
          if (!(toNumber(effect['持续回合'], 0) > 0)) throw new Error(`技能执行结构错误:${path}[${index}]规则改写必须提供持续回合`);
          const 复活字段 = ['死亡时限tick', '复活代价类型', '复活代价对象', '复活代价值', '复活代价时限tick', '复活后状态', '复活后状态时限tick'].find(字段名 => effect[字段名] !== undefined);
          if (复活字段) throw new Error(`技能执行结构错误:${path}[${index}]非死亡转存活不支持字段${复活字段}`);
        }
      }
      if (原型 === '机制抹消') {
        if (
          effect['抹消对象'] &&
          typeof effect['抹消对象'] === 'object' &&
          !Array.isArray(effect['抹消对象']) &&
          effect['抹消对象']['授予效果'] !== undefined
        )
          throw new Error(`技能执行结构错误:${path}[${index}]机制抹消抹消对象不允许授予效果`);
        if (!effect['抹消对象'] || typeof effect['抹消对象'] !== 'object' || Array.isArray(effect['抹消对象']))
          throw new Error(`技能执行结构错误:${path}[${index}]机制抹消缺少抹消对象`);
        const 抹消对象原型 = normalizeSkillUiText(effect['抹消对象']['原型'], '');
        if (!抹消对象原型 || !技能设计台机制抹消对象原型选项.includes(抹消对象原型))
          throw new Error(`技能执行结构错误:${path}[${index}]机制抹消对象原型无效`);
        const 抹消对象允许字段 = new Set(['原型', ...读取技能设计台机制抹消可匹配字段(抹消对象原型)]);
        const 无效字段 = Object.keys(effect['抹消对象']).filter(字段 => !抹消对象允许字段.has(字段));
        if (无效字段.length)
          throw new Error(`技能执行结构错误:${path}[${index}]机制抹消对象不支持字段${无效字段[0]}`);
      }
      if (原型 === '伤害结算' && (effect['驱动属性'] !== undefined || effect['影响方向'] !== undefined))
        throw new Error(`技能执行结构错误:${path}[${index}]伤害结算不允许驱动属性或影响方向`);
      if (原型 === '状态施加') {
        const 状态名 = normalizeSkillUiText(effect['状态'], '');
        if (['任意负面', '任意增益', '任意状态'].includes(状态名))
          throw new Error(`技能执行结构错误:${path}[${index}]状态施加不能使用匹配占位状态`);
        if (技能设计台日常系统状态选项.includes(状态名))
          throw new Error(`技能执行结构错误:${path}[${index}]${状态名}是日常系统状态，不能通过状态施加赋予`);
        const 强度约束错误 = 技能设计台状态施加强度约束错误(effect, path, index);
        if (强度约束错误) throw new Error(强度约束错误);
      }
      if (原型 !== '伤害结算' && 技能设计台原型支持驱动判定字段(原型)) {
        if (
          原型 !== '机制授予' &&
          原型 !== '时光回溯' &&
          原型 !== '位移执行' &&
          原型 !== '复制执行' &&
          normalizeSkillUiText(effect['目标'], '') === '自身' &&
          (effect['驱动属性'] !== undefined || effect['影响方向'] !== undefined)
        )
          throw new Error(`技能执行结构错误:${path}[${index}]自身目标不允许驱动属性或影响方向`);
        if (原型 === '时光回溯') {
          const 发动方式 = normalizeSkillUiText(effect['发动方式'], '被动');
          const 目标 = normalizeSkillUiText(effect['目标'], '单体');
          const 方向选项 = 发动方式 === '主动' ? ['成功率', '效果强度'] : ['成功率'];
          if (!['主动', '被动'].includes(发动方式))
            throw new Error(`技能执行结构错误:${path}[${index}]时光回溯发动方式只能为主动或被动`);
          if (!['单体', '群体', '全场'].includes(目标))
            throw new Error(`技能执行结构错误:${path}[${index}]时光回溯目标只允许单体、群体或全场`);
          if (!方向选项.includes(normalizeSkillUiText(effect['影响方向'], '')))
            throw new Error(`技能执行结构错误:${path}[${index}]时光回溯影响方向与发动方式不匹配`);
        }
        if (
          技能设计台原型需要默认驱动判定(原型, effect) &&
          (!normalizeSkillUiText(effect['驱动属性'], '') || !normalizeSkillUiText(effect['影响方向'], ''))
        )
          throw new Error(`技能执行结构错误:${path}[${index}]目标驱动效果必须提供驱动属性和影响方向`);
      }
      if (原型 === '伤害结算' && effect['触发限制'] !== undefined)
        throw new Error(`技能执行结构错误:${path}[${index}]伤害结算不允许触发限制`);
      const 允许延迟回合 = ['伤害结算', '护盾变化', '属性修正', '状态施加'].includes(原型);
      if (effect['延迟回合'] !== undefined && !允许延迟回合)
        throw new Error(`技能执行结构错误:${path}[${index}]延迟回合只允许用于正式战斗或行为原型`);
      if (
        允许延迟回合 &&
        effect['延迟回合'] !== undefined &&
        !(toNumber(effect['延迟回合'], 0) > 0)
      )
        throw new Error(`技能执行结构错误:${path}[${index}]延迟回合必须大于0，未设置请不要落盘`);
      if (原型 === '判定修正' && !读取技能设计台原型字段选项('判定修正', '判定').includes(normalizeSkillUiText(effect['判定'], '')))
        throw new Error(`技能执行结构错误:${path}[${index}]判定修正判定类型无效`);
      if (原型 === '决策干扰') {
        if (!['判断干扰', '索敌干扰'].includes(normalizeSkillUiText(effect['干扰'], '')))
          throw new Error(`技能执行结构错误:${path}[${index}]决策干扰类型无效`);
      if (!技能设计台字段值是百分比修正(effect['数值']))
        throw new Error(`技能执行结构错误:${path}[${index}]决策干扰数值必须使用百分比`);
      const 数值 = 解析技能设计台正负数值(effect['数值']);
      if (!(数值 >= 1 && 数值 <= 100))
        throw new Error(`技能执行结构错误:${path}[${index}]决策干扰数值必须在1%到100%之间`);
      const 旧字段 = [
        '决' + '策',
        '行动' + '权重',
        '目标' + '权重',
        '锁' + '定',
        '护' + '卫',
        '嘲' + '讽',
        '追' + '击',
        '弱' + '点',
        'decision_' + 'action_' + 'weight',
        'decision_' + 'target_' + 'weight',
      ].find(字段名 => effect[字段名] !== undefined);
      if (旧字段)
        throw new Error(`技能执行结构错误:${path}[${index}]决策干扰不允许旧字段${旧字段}`);
    }
      if (原型 === '资源变化') {
        ['持续tick', '主驱动资源', '结算标签'].forEach(字段名 => {
          if (effect[字段名] !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]资源变化不允许${字段名}`);
        });
        if (effect['持续回合'] !== undefined && (!Number.isFinite(Number(effect['持续回合'])) || Number(effect['持续回合']) < 1 || Number(effect['持续回合']) > 10))
          throw new Error(`技能执行结构错误:${path}[${index}]资源变化持续回合必须为1到10`);
        if (effect['资源转移方式'] !== undefined || effect['转化比例'] !== undefined)
          throw new Error(`技能执行结构错误:${path}[${index}]资源变化不允许资源转移字段`);
        if (effect['资源转移角色'] !== undefined)
          throw new Error(`技能执行结构错误:${path}[${index}]资源转移角色已删除`);
        if (normalizeSkillUiText(effect['资源'], '') === '生命' && 解析技能设计台正负数值(effect['数值']) < 0)
          throw new Error(`技能执行结构错误:${path}[${index}]资源变化生命不允许负数，请使用伤害结算`);
      }
      if (原型 === '资源转移') {
        ['持续tick', '主驱动资源', '结算标签'].forEach(字段名 => {
          if (effect[字段名] !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]资源转移不允许${字段名}`);
        });
        if (effect['持续回合'] !== undefined) {
          const 持续回合 = toNumber(effect['持续回合'], 0);
          if (!Number.isFinite(持续回合) || 持续回合 < 1 || 持续回合 > 10 || Math.round(持续回合) !== 持续回合)
            throw new Error(`技能执行结构错误:${path}[${index}]资源转移持续回合必须为1到10的整数`);
        }
        if (effect['资源转移角色'] !== undefined)
          throw new Error(`技能执行结构错误:${path}[${index}]资源转移角色已删除`);
        const 转移方式 = normalizeSkillUiText(effect['资源转移方式'], '');
        if (!['吞噬', '共享', '均分', '转移'].includes(转移方式))
          throw new Error(`技能执行结构错误:${path}[${index}]资源转移方式无效`);
        const 目标 = normalizeSkillUiText(effect['目标'], '');
        const 合法目标 = 转移方式 === '均分' ? ['单体', '群体', '全场'] : ['单体', '群体'];
        if (!合法目标.includes(目标))
          throw new Error(`技能执行结构错误:${path}[${index}]${转移方式}不允许目标${目标 || '空'}`);
        if (转移方式 === '均分' && effect['转化比例'] !== undefined)
          throw new Error(`技能执行结构错误:${path}[${index}]${转移方式}不允许转化比例`);
        if (['吞噬', '共享', '转移'].includes(转移方式)) {
          const 转化比例 = Number(effect['转化比例'] ?? 1);
          if (!Number.isFinite(转化比例) || 转化比例 < 0 || 转化比例 > 2)
            throw new Error(`技能执行结构错误:${path}[${index}]转化比例必须在0到2之间`);
        }
      }
      if (原型 === '资源锁定') {
        const 资源列表 = Array.isArray(effect['资源']) ? effect['资源'] : [effect['资源']];
        if (资源列表.some(资源 => !['生命', '体力', '魂力', '精神力'].includes(normalizeSkillUiText(资源, ''))))
          throw new Error(`技能执行结构错误:${path}[${index}]资源锁定资源无效`);
        if (!技能设计台资源锁定类型选项.includes(normalizeSkillUiText(effect['锁定类型'], '')))
          throw new Error(`技能执行结构错误:${path}[${index}]资源锁定类型无效`);
        if (!技能设计台字段值是百分比修正(effect['数值']))
          throw new Error(`技能执行结构错误:${path}[${index}]资源锁定数值必须使用百分比`);
        const 数值 = 解析技能设计台正负数值(effect['数值']);
        if (!(数值 > 0) || 数值 > 100)
          throw new Error(`技能执行结构错误:${path}[${index}]资源锁定数值必须为0%~100%的正百分比`);
        if (!(toNumber(effect['持续回合'], 0) > 0))
          throw new Error(`技能执行结构错误:${path}[${index}]资源锁定必须提供持续回合`);
      }
      if (原型 === '护盾变化') {
        const 模式 = normalizeSkillUiText(effect['护盾模式'], '');
        if (!['正向护盾', '斩盾', '窃盾'].includes(模式)) throw new Error(`技能执行结构错误:${path}[${index}]护盾变化护盾模式无效`);
        const 数值 = 解析技能设计台正负数值(effect['数值']);
        if (模式 === '正向护盾' && !(数值 > 0)) throw new Error(`技能执行结构错误:${path}[${index}]正向护盾数值必须为正`);
        if (模式 !== '正向护盾' && !(数值 < 0)) throw new Error(`技能执行结构错误:${path}[${index}]斩盾/窃盾数值必须为负`);
        if (模式 !== '正向护盾' && effect['持续回合'] !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]斩盾/窃盾不允许持续回合`);
      }
      if (原型 === '属性修正') {
        const 属性列表 = Array.isArray(effect['属性']) ? effect['属性'] : [effect['属性']];
        if (属性列表.some(属性 => !['力量', '防御', '敏捷', '生命上限', '体力上限', '魂力上限', '精神力上限'].includes(normalizeSkillUiText(属性, ''))))
          throw new Error(`技能执行结构错误:${path}[${index}]属性修正属性无效`);
      }
      if (原型 === '位移执行' && effect['方位'] !== undefined)
        throw new Error(`技能执行结构错误:${path}[${index}]位移方位没有行为约束`);
      if (原型 === '位移执行') {
        const 位移类型 = normalizeSkillUiText(effect['位移类型'], '');
        const 目标 = normalizeSkillUiText(effect['目标'], '');
        const 位移对象 = normalizeSkillUiText(effect['位移对象'], '');
        if (!['拉近', '击退', '换位', '瞬移', '脱离'].includes(位移类型))
          throw new Error(`技能执行结构错误:${path}[${index}]位移类型无效`);
        if (!['自身', '目标', '自身与目标'].includes(位移对象))
          throw new Error(`技能执行结构错误:${path}[${index}]位移对象无效`);
        if (目标 === '自身' && 位移对象 !== '自身')
          throw new Error(`技能执行结构错误:${path}[${index}]自身目标必须使用自身位移对象`);
        if ((位移类型 === '换位' || 位移对象 === '自身与目标') && (!目标 || 目标 === '自身'))
          throw new Error(`技能执行结构错误:${path}[${index}]换位必须提供自身以外目标`);
        if (位移类型 === '换位' && 位移对象 !== '自身与目标')
          throw new Error(`技能执行结构错误:${path}[${index}]换位必须声明自身与目标双参与者`);
        if (位移类型 !== '换位' && 位移对象 === '自身与目标')
          throw new Error(`技能执行结构错误:${path}[${index}]非换位不能使用自身与目标双参与者`);
        if (['瞬移', '脱离'].includes(位移类型) && 位移对象 !== '自身')
          throw new Error(`技能执行结构错误:${path}[${index}]${位移类型}只能移动自身`);
        if (effect['数量'] !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]位移执行不允许触发次数或数量`);
        if (toNumber(effect['距离'], 0) <= 0) throw new Error(`技能执行结构错误:${path}[${index}]位移幅度必须大于0`);
        if (toNumber(effect['距离'], 0) > 30) throw new Error(`技能执行结构错误:${path}[${index}]位移幅度不能超过30`);
        if (effect['数值'] !== undefined && !技能设计台字段值是百分比修正(effect['数值']))
          throw new Error(`技能执行结构错误:${path}[${index}]位移收益强度覆写必须是百分比`);
        if (effect['数值'] !== undefined && Math.abs(解析技能设计台正负数值(effect['数值'])) > 0.45)
          throw new Error(`技能执行结构错误:${path}[${index}]位移收益强度覆写不能超过45%`);
        if (effect['持续回合'] !== undefined && (!Number.isFinite(Number(effect['持续回合'])) || Number(effect['持续回合']) < 1 || Number(effect['持续回合']) > 10))
          throw new Error(`技能执行结构错误:${path}[${index}]位移持续回合必须为1到10`);
      }
      if (原型 === '伤害结算') {
        const 结算标签 = normalizeSkillUiText(effect['结算标签'], '');
        const 抗性类型 = normalizeSkillUiText(effect['抗性类型'], '');
        const 伤害类型 = normalizeSkillUiText(effect['伤害类型'], '');
        if (!['标准伤害', '真实伤害'].includes(结算标签))
          throw new Error(`技能执行结构错误:${path}[${index}]伤害结算标签无效`);
        if (!['物理抗性', '精神抗性', '元素抗性', '毒素抗性', '真实无视'].includes(抗性类型))
          throw new Error(`技能执行结构错误:${path}[${index}]抗性类型无效`);
        if (!技能设计台伤害类型选项.includes(伤害类型))
          throw new Error(`技能执行结构错误:${path}[${index}]伤害类型无效`);
        const 伤害绑定 = 读取技能设计台伤害绑定(伤害类型);
        const 预期结算标签 = 伤害绑定.结算标签;
        const 预期抗性类型 = 伤害绑定.抗性类型;
        if (结算标签 !== 预期结算标签 || 抗性类型 !== 预期抗性类型)
          throw new Error(`技能执行结构错误:${path}[${index}]伤害类型自动绑定字段不一致`);
        if (!['单体', '群体', '全场'].includes(normalizeSkillUiText(effect['目标'], '')))
          throw new Error(`技能执行结构错误:${path}[${index}]主伤害目标无效`);
      }
      if (原型 === '判定修正' && !技能设计台字段值是百分比修正(effect['数值']))
        throw new Error(`技能执行结构错误:${path}[${index}]判定修正数值必须使用百分比`);
      if (原型 === '判定修正' && effect['持续回合'] !== undefined) {
        const 持续回合 = toNumber(effect['持续回合'], 0);
        if (!Number.isFinite(持续回合) || 持续回合 < 1 || 持续回合 > 10 || Math.round(持续回合) !== 持续回合)
          throw new Error(`技能执行结构错误:${path}[${index}]判定修正持续回合必须为1到10的整数`);
        if (effect['打断效果'] !== undefined)
          throw new Error(`技能执行结构错误:${path}[${index}]持续判定修正不允许附带打断效果`);
      }
      if (原型 === '结算修正') 断言技能设计台结算修正字段范围(effect, path, index);
      断言技能设计台释放后分支不携带释放前降低结算(effect, path, index);
      if (原型 === '判定修正' && effect['打断效果'] !== undefined && !技能设计台判定修正允许打断效果(effect))
        throw new Error(`技能执行结构错误:${path}[${index}]正向判定修正不允许开启打断效果`);
      if (effect['事件优先级'] !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]事件优先级已删除`);
      if (effect['快照规则'] !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]快照规则已删除`);
      if (effect['影响方向'] !== undefined && !读取技能设计台影响方向选项值(原型, effect).includes(normalizeSkillUiText(effect['影响方向'], '')))
        throw new Error(`技能执行结构错误:${path}[${index}]影响方向不适用于${原型}`);
      if (
        (是结算效果路径 || 是授予效果路径) &&
        normalizeSkillUiText(effect['生效方式'], '') === '跟随主原型'
      )
        throw new Error(`技能执行结构错误:${path}[${index}]嵌套效果必须独立生效`);
      if (原型 === '状态施加') {
        const 状态名 = normalizeSkillUiText(effect['状态'], '');
        const 触发方式 = normalizeSkillUiText(effect['触发方式'], '立即触发');
        if (状态名 === '护卫' && normalizeSkillUiText(effect['目标'], '') === '自身')
          throw new Error(`技能执行结构错误:${path}[${index}]护卫目标不能是自身`);
        if (!['立即触发', '延迟触发', '遥控触发'].includes(触发方式))
          throw new Error(`技能执行结构错误:${path}[${index}]状态触发方式无效`);
        if (触发方式 === '延迟触发' && !(toNumber(effect['延迟回合'], 0) > 0))
          throw new Error(`技能执行结构错误:${path}[${index}]延迟触发必须提供延迟回合`);
        if (触发方式 !== '延迟触发' && effect['延迟回合'] !== undefined)
          throw new Error(`技能执行结构错误:${path}[${index}]非延迟触发不允许延迟回合`);
        const 数值 = 解析技能设计台正负数值(effect['数值']);
        if (!技能设计台状态施加允许数值字段(状态名) && effect['数值'] !== undefined)
          throw new Error(`技能执行结构错误:${path}[${index}]${状态名}不允许数值`);
        if (!技能设计台状态施加允许副数值字段(状态名) && effect['副数值'] !== undefined)
          throw new Error(`技能执行结构错误:${path}[${index}]${状态名}不允许副数值`);
        if (技能设计台状态施加状态分类矩阵.持续伤害类.includes(状态名) && !(数值 < 0))
          throw new Error(`技能执行结构错误:${path}[${index}]${状态名}数值必须为负`);
        if (状态名 === '持续恢复' && !(数值 > 0))
          throw new Error(`技能执行结构错误:${path}[${index}]持续恢复数值必须为正`);
        if (状态名 === '资源燃烧' && !(数值 > 0))
          throw new Error(`技能执行结构错误:${path}[${index}]资源燃烧数值必须为正`);
        if (状态名 === '魂力枯竭' && !(数值 > 0))
          throw new Error(`技能执行结构错误:${path}[${index}]魂力枯竭数值必须为正`);
        if (状态名 === '护盾' && !(数值 > 0))
          throw new Error(`技能执行结构错误:${path}[${index}]护盾数值必须为正`);
        if (['禁疗', '治疗反转', '防御剥夺', '精神抗性剥夺'].includes(状态名) && !(数值 > 0))
          throw new Error(`技能执行结构错误:${path}[${index}]${状态名}数值必须为正`);
        if (技能设计台状态施加清理驱动字段(状态名, effect['目标']) && (effect['驱动属性'] !== undefined || effect['影响方向'] !== undefined))
          throw new Error(`技能执行结构错误:${path}[${index}]${状态名}不应携带驱动属性或影响方向`);
        if (effect['概率'] !== undefined)
          throw new Error(`技能执行结构错误:${path}[${index}]状态施加不允许概率`);
        if (effect['打断效果'] !== undefined)
          throw new Error(`技能执行结构错误:${path}[${index}]该状态不允许打断效果`);
        if (effect['触发限制'] !== undefined && !技能设计台状态施加允许触发限制(状态名, effect['目标']))
          throw new Error(`技能执行结构错误:${path}[${index}]该状态不允许触发限制`);
      }
      if (是授予效果路径 && 原型 === '机制授予')
        throw new Error(`技能执行结构错误:${path}[${index}]授予效果不能继续授予机制`);
      if (原型 === '机制授予' && (!Array.isArray(effect['授予效果']) || !effect['授予效果'].length))
        throw new Error(`技能执行结构错误:${path}[${index}]机制授予缺少授予效果`);
      if (原型 === '机制授予' && !技能设计台机制授予触发条件选项.includes(normalizeSkillUiText(effect['触发条件'], '主动触发')))
        throw new Error(`技能执行结构错误:${path}[${index}]机制授予触发条件无效`);
      if (原型 === '机制授予' && normalizeSkillUiText(effect['触发条件'], '主动触发') === '随下次行动触发' && !机制授予目标允许下次行动触发(effect['目标']))
        throw new Error(`技能执行结构错误:${path}[${index}]非自身机制授予不允许随下次行动触发`);
      if (原型 === '机制授予' && normalizeSkillUiText(effect['触发条件'], '主动触发') === '随下次行动触发' && effect['可用次数'] !== undefined)
        throw new Error(`技能执行结构错误:${path}[${index}]随下次行动触发固定使用一次，不支持可用次数`);
      if (原型 === '机制授予' && effect['触发条件'] === '下次魂技成功释放' && !机制授予目标允许下次行动触发(effect['目标']))
        throw new Error(`技能执行结构错误:${path}[${index}]非自身机制授予不允许在下次魂技成功释放时触发`);
      if (原型 === '机制授予' && effect['触发条件'] === '下次魂技成功释放' && !(Number.isInteger(Number(effect['可用次数'])) && Number(effect['可用次数']) > 0))
        throw new Error(`技能执行结构错误:${path}[${index}]下次魂技成功释放机制授予必须有正整数可用次数`);
      if (原型 === '机制授予' && effect['持续回合'] !== undefined && !(Number.isInteger(Number(effect['持续回合'])) && Number(effect['持续回合']) > 0))
        throw new Error(`技能执行结构错误:${path}[${index}]机制授予持续回合必须为正整数`);
      if (原型 === '机制授予' && normalizeSkillUiText(effect['触发条件'], '主动触发') === '主动触发' && !(toNumber(effect['可用次数'], 0) > 0 && toNumber(effect['持续回合'], 0) > 0))
        throw new Error(`技能执行结构错误:${path}[${index}]主动触发机制授予缺少可用次数或持续回合`);
      if (
        原型 === '机制授予' &&
        (Array.isArray(effect['授予效果']) ? effect['授予效果'] : []).some(item => {
          const grantPrototype = normalizeSkillUiText(item && item['原型'], '');
          return !grantPrototype || !技能设计台机制授予允许授予原型集合.has(grantPrototype);
        })
      )
        throw new Error(`技能执行结构错误:${path}[${index}]机制授予授予效果原型无效`);
      if (原型 === '召唤生成' && normalizeSkillUiText(effect['目标'], '') !== '自身')
        throw new Error(`技能执行结构错误:${path}[${index}]召唤生成只能挂载自身`);
      if (
        (原型 === '资源变化' && 解析技能设计台正负数值(effect['数值']) > 0) ||
        (原型 === '护盾变化' && 解析技能设计台正负数值(effect['数值']) > 0)
      ) {
      }
      if (原型 === '时窗修正') {
        const 调整字段 = normalizeSkillUiText(effect['调整字段'], '');
        if (effect['状态'] !== undefined || effect['造物名称'] !== undefined)
          throw new Error(`技能执行结构错误:${path}[${index}]时窗修正不允许指定状态或造物`);
        if (调整字段 === '持续回合') {
          if (effect['调整tick'] !== undefined || effect['调整次数'] !== undefined)
            throw new Error(`技能执行结构错误:${path}[${index}]时窗修正字段组合无效`);
          const 调整回合 = Math.round(toNumber(effect['调整回合'], 1));
          if (!(调整回合 >= 1 && 调整回合 <= 3))
            throw new Error(`技能执行结构错误:${path}[${index}]时窗修正调整回合必须为1~3`);
        }
        if (调整字段 === '有效期tick' && (effect['调整回合'] !== undefined || effect['调整次数'] !== undefined || effect['结算倍率'] !== undefined))
          throw new Error(`技能执行结构错误:${path}[${index}]时窗修正字段组合无效`);
        if (调整字段 === '有效期tick') {
          const 调整tick = Math.round(toNumber(effect['调整tick'], 1));
          if (!(调整tick >= 1 && 调整tick <= 1008))
            throw new Error(`技能执行结构错误:${path}[${index}]时窗修正有效期调整必须为1~1008tick`);
        }
        if (['触发次数', '使用次数'].includes(调整字段)) {
          if (effect['调整回合'] !== undefined || effect['调整tick'] !== undefined || effect['结算倍率'] !== undefined)
            throw new Error(`技能执行结构错误:${path}[${index}]时窗修正字段组合无效`);
          const 调整次数 = Math.round(toNumber(effect['调整次数'], 1));
          if (!(调整次数 >= 1 && 调整次数 <= 3))
            throw new Error(`技能执行结构错误:${path}[${index}]时窗修正调整次数必须为1~3`);
        }
        const 单日使用次数上限 = Math.round(toNumber(effect['单日使用次数上限'], 1));
        if (!(单日使用次数上限 >= 1 && 单日使用次数上限 <= 3))
          throw new Error(`技能执行结构错误:${path}[${index}]时窗修正单日使用次数上限必须为1~3`);
        if (effect['结算倍率'] !== undefined) {
          const 倍率文本 = normalizeSkillUiText(effect['结算倍率'], '');
          const 倍率数值 = parseSkillDesignerSignedValue(倍率文本);
          if (调整字段 !== '持续回合' || normalizeSkillUiText(effect['调整方式'], '') !== '压缩')
            throw new Error(`技能执行结构错误:${path}[${index}]时窗修正结算倍率仅允许持续回合压缩`);
          if (!/%$/.test(倍率文本) || !(倍率数值 >= 0.5 && 倍率数值 <= 3))
            throw new Error(`技能执行结构错误:${path}[${index}]时窗修正结算倍率必须为+50%~+300%`);
        }
      }
      if (
        index > 0 &&
        normalizeSkillUiText(effect['生效方式'], '') === '跟随主原型' &&
        主目标 &&
        normalizeSkillUiText(effect['目标'], '') !== 主目标
      ) {
        throw new Error(`技能执行结构错误:${path}[${index}]目标不同不能跟随主原型`);
      }
      技能设计台嵌套效果数组字段表.forEach(key => {
        if (Array.isArray(effect[key])) 断言技能设计台效果数组契约(effect[key], `${path}[${index}].${key}`);
      });
      if (Array.isArray(effect['条件分支'])) {
        effect['条件分支'].forEach((branch, branchIndex) => {
          const 条件列表 = Array.isArray(branch && branch['条件']) ? branch['条件'] : [];
          if (!条件列表.length) throw new Error(`技能执行结构错误:${path}[${index}].条件分支[${branchIndex}]缺少条件`);
          const 处理 = normalizeSkillUiText(branch && branch['处理'], '');
          if (!['生效', '替换效果', '追加效果', '禁用'].includes(处理))
            throw new Error(`技能执行结构错误:${path}[${index}].条件分支[${branchIndex}]处理方式无效`);
          if (
            处理 === '生效' &&
            (
              (Array.isArray(branch && branch['替换效果']) && branch['替换效果'].length) ||
              (Array.isArray(branch && branch['追加效果']) && branch['追加效果'].length)
            )
          )
            throw new Error(`技能执行结构错误:${path}[${index}].条件分支[${branchIndex}]生效分支不可携带替换或追加效果`);
          if (处理 === '替换效果' && (!Array.isArray(branch && branch['替换效果']) || !branch['替换效果'].length))
            throw new Error(`技能执行结构错误:${path}[${index}].条件分支[${branchIndex}]缺少替换效果`);
          if (处理 === '追加效果' && (!Array.isArray(branch && branch['追加效果']) || !branch['追加效果'].length))
            throw new Error(`技能执行结构错误:${path}[${index}].条件分支[${branchIndex}]缺少追加效果`);
          技能设计台条件分支效果数组字段表.forEach(key => {
            if (Array.isArray(branch && branch[key]))
              断言技能设计台效果数组契约(branch[key], `${path}[${index}].条件分支[${branchIndex}].${key}`);
          });
        });
      }
    });
  }
  // —— B:21622-21626
  function formatSkillDesignerNumericInput(value, digits = 4) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '';
    return String(Number(parsed.toFixed(digits)));
  }
  // —— B:21628-21635
  function getSkillDesignerEffectDuration(effect = {}) {
    const candidates = [effect && effect['持续'], effect && effect['持续回合']];
    for (const item of candidates) {
      const parsed = Number(item);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return 0;
  }
  // —— B:21637-21641
  function getSkillDesignerPackedPropertyLabel(property = '') {
    if (Array.isArray(property)) return property.map(item => getSkillDesignerPackedPropertyLabel(item)).filter(Boolean);
    const key = normalizeSkillUiText(property, '');
    return SKILL_DESIGNER_PACKED_PROPERTY_LABELS[key] || key;
  }
  // —— B:21660-21678
  function resolveSkillDesignerNestedEffectMechanism(entry = {}) {
    const explicitMechanism = normalizeSkillUiText(entry && entry['机制'], '');
    if (explicitMechanism) return explicitMechanism;
    const description = '';
    if (!description) return '';
    if (/分身/.test(description)) return '分身';
    if (/霸体/.test(description)) return '霸体';
    if (/护盾/.test(description)) return '护盾';
    if (/承伤|减伤/.test(description)) return '承伤修正';
    if (/免死|锁血/.test(description)) return '免死';
    if (/解控/.test(description)) return '解控';
    if (/净化/.test(description)) return '净化';
    if (/(回复|恢复)/.test(description) && /魂力/.test(description)) return '魂力恢复';
    if (/(回复|恢复)/.test(description) && /精神/.test(description)) return '精神恢复';
    if (/(回复|恢复)/.test(description) && /(体力|生命)/.test(description)) return '体力恢复';
    if (/共享视野/.test(description)) return '共享视野';
    if (/标记/.test(description) && /锁定/.test(description)) return '标记锁定';
    return '';
  }
  // —— B:21680-21725
  function buildSkillDesignerNestedEffectEntry(entry = {}, fallback = {}) {
    const entryValue = entry && typeof entry === 'object' ? entry : {};
    const valueConfig = entryValue && entryValue.value && typeof entryValue.value === 'object' ? entryValue.value : {};
    const hasStructuredPayload =
      Object.prototype.hasOwnProperty.call(entryValue, 'type') ||
      Object.prototype.hasOwnProperty.call(entryValue, 'target') ||
      Object.prototype.hasOwnProperty.call(entryValue, '目标') ||
      Object.prototype.hasOwnProperty.call(entryValue, '持续回合') ||
      Object.prototype.hasOwnProperty.call(entryValue, '持续') ||
      Object.prototype.hasOwnProperty.call(valueConfig, 'durationRounds') ||
      Object.prototype.hasOwnProperty.call(valueConfig, 'duration');
    if (!hasStructuredPayload) return null;

    const mechanism = resolveSkillDesignerNestedEffectMechanism(entryValue);
    if (!mechanism) return null;
    const target = normalizeSkillUiText(entryValue['目标'] || entryValue.target || (fallback && fallback.target), '');
    const duration = Math.max(
      0,
      toNumber(
        entryValue['持续回合'] ??
          entryValue['持续'] ??
          valueConfig.durationRounds ??
          valueConfig.duration ??
          valueConfig.rounds,
        0,
      ),
    );
    const 原型列表 = getSkillDesignerMechanismCompiledPrototypeList(mechanism);
    if (!原型列表.length) return null;
    const 原型条目 =
      原型列表[0] && typeof 原型列表[0] === 'object'
        ? cloneJsonValue(原型列表[0])
        : { 原型: normalizeSkillUiText(原型列表[0], '') };
    const normalizedEffect = buildSkillDesignerRuntimeObject(原型条目);
    if (!normalizedEffect || !normalizeSkillUiText(normalizedEffect['原型'], '')) return null;
    if (target) normalizedEffect['目标'] = target;
    if (duration > 0) normalizedEffect['持续回合'] = duration;

    const immuneLevel = normalizeSkillUiText(entryValue['免控级别'] || valueConfig.immuneLevel, '');
    const reduceRatio = formatSkillDesignerNumericInput(entryValue['承伤修正'] ?? valueConfig.reduceRatio);
    const shieldSource = normalizeSkillUiText(entryValue['护盾来源'] || valueConfig.shieldSource, '');
    if (immuneLevel) normalizedEffect['免控级别'] = immuneLevel;
    if (reduceRatio) normalizedEffect['承伤修正'] = reduceRatio;
    if (shieldSource) normalizedEffect['护盾来源'] = shieldSource;
    return normalizedEffect;
  }
  // —— B:21727-21737
  function getSkillDesignerEffectSignature(effect = {}) {
    const mechanism = normalizeSkillUiText(effect && effect['原型'], '');
    const target = normalizeSkillUiText(effect && effect['目标'], '');
    const property = normalizeSkillUiText(effect && effect['属性'], '');
    const action = normalizeSkillUiText(
      effect && (effect['判定'] || effect['结算'] || effect['状态'] || effect['规则']),
      '',
    );
    const duration = getSkillDesignerEffectDuration(effect);
    return [mechanism, target, property, action, String(duration)].join('|');
  }
  // —— B:21739-21747
  function appendSkillDesignerEffectEntry(bucket = [], seen = new Set(), effect = null) {
    if (!effect || typeof effect !== 'object') return;
    const mechanism = normalizeSkillUiText(effect['原型'], '');
    if (!mechanism || mechanism === '系统基础' || isSkillSummaryEffect(effect)) return;
    const signature = getSkillDesignerEffectSignature(effect);
    if (!signature || seen.has(signature)) return;
    seen.add(signature);
    bucket.push(effect);
  }
  // —— B:21749-21782
  function appendSkillDesignerEffectEntries(source, bucket = [], seen = new Set(), context = {}) {
    if (Array.isArray(source)) {
      source.forEach(entry => appendSkillDesignerEffectEntries(entry, bucket, seen, context));
      return bucket;
    }
    if (!source || typeof source !== 'object') return bucket;

    const fallbackTarget = normalizeSkillUiText(context && context.target, '');
    const resolvedTarget = normalizeSkillUiText(source['目标'] || source.target || fallbackTarget, fallbackTarget);
    const explicitPrototype = normalizeSkillUiText(source['原型'], '');
    if (explicitPrototype) {
      const clonedEffect = cloneJsonValue(source);
      if (!normalizeSkillUiText(clonedEffect['目标'], '') && resolvedTarget) {
        clonedEffect['目标'] = resolvedTarget;
      }
      appendSkillDesignerEffectEntry(bucket, seen, clonedEffect);
    } else {
      const nestedEffect = buildSkillDesignerNestedEffectEntry(source, { target: resolvedTarget });
      const runtimeEffect = buildSkillDesignerRuntimeObject(nestedEffect);
      appendSkillDesignerEffectEntry(
        bucket,
        seen,
        runtimeEffect && normalizeSkillUiText(runtimeEffect['原型'], '') ? runtimeEffect : null,
      );
    }

    if (Array.isArray(source['使用效果'])) {
      appendSkillDesignerEffectEntries(source['使用效果'], bucket, seen, { target: resolvedTarget || fallbackTarget });
    }
    if (Array.isArray(source.effects)) {
      appendSkillDesignerEffectEntries(source.effects, bucket, seen, { target: resolvedTarget || fallbackTarget });
    }
    return bucket;
  }
  // —— B:22222-22230
  function normalizeSkillDesignerCoeffMap(value) {
    const source = value && typeof value === 'object' ? value : {};
    const result = {};
    SKILL_ATTRIBUTE_DIM_KEYS.forEach(key => {
      const parsed = Number(source[key]);
      result[key] = Number.isFinite(parsed) ? parsed : 1;
    });
    return result;
  }
  // —— B:22232-22234
  function getSkillDesignerEffectEntries(effectArray = []) {
    return appendSkillDesignerEffectEntries(Array.isArray(effectArray) ? effectArray : [], [], new Set());
  }
  // —— B:22333-22349
  function inferSkillDesignerDeliveryForm(effectArray = [], type = '', target = '') {
    const effectEntries = getSkillDesignerEffectEntries(effectArray);
    const mechanisms = effectEntries.map(effect => normalizeSkillUiText(effect && effect['原型'], ''));
    const normalizedType = normalizeSkillUiText(type, '');
    const normalizedTarget = normalizeSkillUiText(target, '');
    if (
      effectEntries.some(
        effect =>
          !normalizeSkillUiText(effect && effect['原型'], '') && Array.isArray(effect && effect['使用效果']),
      ) ||
      /食物系/.test(normalizedType)
    )
      return '造物承载';
    void mechanisms;
    void normalizedTarget;
    return '直接生效';
  }
  // —— B:22351-22366
  function inferSkillDesignerMainRole(type = '', target = '', primaryMain = '', primarySub = '') {
    const normalizedType = normalizeSkillUiText(type, '');
    const normalizedTarget = normalizeSkillUiText(target, '');
    const normalizedMain = normalizeSkillUiText(primaryMain, '');
    const normalizedSub = normalizeSkillUiText(primarySub, '');
    if (/被动/.test(normalizedType)) return '被动固化';
    if (normalizedMain === '伤害类') return /持续/.test(normalizedSub) ? '持续压制' : '爆发输出';
    if (normalizedMain === '控制类' || normalizedMain === '削弱类') return '控制起手';
    if (normalizedMain === '防御类') return '保护承伤';
    if (normalizedMain === '回复类') return '回复续航';
    if (normalizedMain === '增益类') return '增益辅助';
    if (normalizedMain === '感知/认知类' || normalizedMain === '位移类' || normalizedMain === '特殊规则类')
      return '特殊规则';
    if (/自身/.test(normalizedTarget)) return '增益辅助';
    return '未知';
  }
  // —— B:22374-22376
  function isSkillDesignerSlotLabel(value = '') {
    return /^第(?:\d+|[一二三四五六七八九十百]+)魂技(?:_2)?$/u.test(toText(value, '').trim());
  }
  // —— B:22378-22385
  function getSkillDesignerNameFallback(previewMeta = {}) {
    const scope = toText(previewMeta && previewMeta.scope, '魂技');
    const label = toText(previewMeta && previewMeta.label, '')
      .replace(/\[续台推演\]\s*/g, '')
      .trim();
    if (scope === '魂技' && isSkillDesignerSlotLabel(label)) return '';
    return label;
  }
  // —— B:22387-22391
  function 是第七魂环魂技设计_桥接(previewMeta = {}) {
    if (toText(previewMeta && previewMeta.scope, '') !== '魂技') return false;
    const path = Array.isArray(previewMeta && previewMeta.path) ? previewMeta.path : [];
    return path.some(片段 => 是魂环槽位键_桥接(片段) && 读取槽位序号_桥接(片段, 0) === 7);
  }
  // —— B:22393-22404
  function 读取第七魂环真身默认名_桥接(previewMeta = {}) {
    const path = Array.isArray(previewMeta && previewMeta.path) ? previewMeta.path : [];
    const rootData = (liveSnapshot && liveSnapshot.rootData) || readLatestMvuDataByEditor() || {};
    const 魂环索引 = path.findIndex(片段 => 是魂环槽位键_桥接(片段));
    const 候选路径列表 = 魂环索引 >= 0 ? [path.slice(0, 魂环索引), path.slice(0, Math.max(0, 魂环索引 - 1))] : [];
    for (const 候选路径 of 候选路径列表) {
      const 节点 = 候选路径.length ? deepGet(rootData, 候选路径, null) : null;
      const 名称 = normalizeSkillUiText(节点 && (节点.表象名称 || 节点.名称 || 节点.name), '');
      if (名称 && !hasUiPlaceholderToken(名称) && 名称 !== '未展露') return /真身/.test(名称) ? 名称 : `${名称}真身`;
    }
    return '武魂真身';
  }
  // —— B:22406-22412
  function 规范第七魂环真身名称_桥接(名称 = '', previewMeta = {}) {
    const 原名 = normalizeSkillUiText(名称, '');
    if (!是第七魂环魂技设计_桥接(previewMeta)) return 原名;
    if (!原名 || hasUiPlaceholderToken(原名) || /^(待补全|未知|未命名|第7魂技|第七魂技)$/u.test(原名))
      return 读取第七魂环真身默认名_桥接(previewMeta);
    return /真身/.test(原名) ? 原名 : `${原名}真身`;
  }
  // —— B:22414-22421
  function cleanSkillDisplayName(skill, rawName = '') {
    const explicitName = normalizeSkillUiText((skill && skill['魂技名']) || (skill && skill['name']), '');
    if (explicitName) return explicitName;
    const cleanName = toText(rawName, '')
      .replace(/\[续台推演\]\s*/g, '')
      .trim();
    return isSkillDesignerSlotLabel(cleanName) ? '' : cleanName;
  }
  // —— B:22423-22433
  function buildSkillDesignerPreviewKey(meta = {}) {
    const path = Array.isArray(meta.path) ? meta.path : [];
    if (!path.length) return '';
    const payload = {
      path,
      label: toText(meta.label, '技能'),
      category: toText(meta.category, '技能'),
      scope: toText(meta.scope, '魂技'),
    };
    return `${SKILL_DESIGNER_PREVIEW_PREFIX}${encodeURIComponent(JSON.stringify(payload))}`;
  }
  // —— B:22453-22467
  function parseSkillDesignerPreviewKey(previewKey = '') {
    const raw = toText(previewKey, '');
    if (!raw.startsWith(SKILL_DESIGNER_PREVIEW_PREFIX)) return null;
    try {
      const payload = JSON.parse(decodeURIComponent(raw.slice(SKILL_DESIGNER_PREVIEW_PREFIX.length)));
      return {
        path: Array.isArray(payload && payload.path) ? payload.path : [],
        label: toText(payload && payload.label, '技能'),
        category: toText(payload && payload.category, '技能'),
        scope: toText(payload && payload.scope, '魂技'),
      };
    } catch (error) {
      return null;
    }
  }
  // —— B:22469-22486
  function formatSkillDesignerChineseOrdinal(value, suffix = '') {
    const safeValue = Math.max(0, Math.floor(Number(value) || 0));
    if (!safeValue) return '';
    const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    let numeral = '';
    if (safeValue < 10) {
      numeral = digits[safeValue];
    } else if (safeValue < 20) {
      numeral = safeValue === 10 ? '十' : `十${digits[safeValue - 10]}`;
    } else if (safeValue < 100) {
      const tens = Math.floor(safeValue / 10);
      const ones = safeValue % 10;
      numeral = `${digits[tens]}十${ones ? digits[ones] : ''}`;
    } else {
      numeral = String(safeValue);
    }
    return `第${numeral}${suffix}`;
  }
  // —— B:22499-22504
  function 读取技能设计台槽位序号标签(槽位名 = '', 默认值 = '') {
    const 文本 = toText(槽位名, '').trim();
    const 匹配 = 文本.match(/^第(\d+)(血脉)?魂技(.*)$/u);
    if (!匹配) return toText(默认值, '').trim();
    return `${formatSkillDesignerChineseOrdinal(匹配[1], `${匹配[2] || ''}魂技`) || 文本}${匹配[3] || ''}`;
  }
  // —— B:22506-22510
  function 技能设计台标签是同一槽位(左侧标签 = '', 右侧标签 = '') {
    const 左侧 = 读取技能设计台槽位序号标签(左侧标签, 左侧标签);
    const 右侧 = 读取技能设计台槽位序号标签(右侧标签, 右侧标签);
    return !!左侧 && 左侧 === 右侧;
  }
  // —— B:22512-22515
  function 读取技能设计台技能显示名(技能 = {}, 备用名 = '') {
    const 显式名称 = normalizeSkillUiText(技能 && (技能['魂技名'] || 技能.name || 技能['名称']), '');
    return 显式名称 || cleanSkillDisplayName(技能, 备用名) || toText(备用名, '').trim() || '未命名技能';
  }
  // —— B:22517-22590
  function 获取技能设计台同组切换项(rootData = {}, previewMeta = {}) {
    const path = Array.isArray(previewMeta && previewMeta.path) ? previewMeta.path : [];
    if (path.length < 2) return [];
    const scope = toText(previewMeta && previewMeta.scope, '');
    const 当前键 = toText(path[path.length - 1], '').trim();
    const 当前路径键 = path.join('\u0001');
    const category = toText(previewMeta && previewMeta.category, '技能');
    const 列表 = [];
    const 加入技能 = (技能路径, 键, 技能, 环位名 = '') => {
      if (!Array.isArray(技能路径) || !技能路径.length || !技能 || typeof 技能 !== 'object' || Array.isArray(技能))
        return;
      const 槽位标签 = 读取技能设计台槽位序号标签(键, 键);
      const 技能名 = 读取技能设计台技能显示名(技能, 键);
      const 环位标签 = 环位名 ? 读取技能设计台槽位序号标签(环位名.replace('魂环', '魂技'), '') : '';
      const 前缀 = 槽位标签 || 环位标签;
      const 显示标签 =
        前缀 && 前缀 !== 技能名 && !技能设计台标签是同一槽位(前缀, 技能名) ? `${前缀} / ${技能名}` : 前缀 || 技能名;
      列表.push({
        key: 键,
        skillName: 技能名,
        path: [...技能路径],
        label: 显示标签,
        title: 显示标签,
        preview: buildSkillDesignerPreviewKey({
          path: [...技能路径],
          label: 技能名,
          category,
          scope: scope || '魂技',
        }),
        active: 技能路径.join('\u0001') === 当前路径键,
        order: 读取槽位序号_桥接(环位名 || 键, 999) * 10 + (/_2$/.test(键) ? 1 : 0),
      });
    };
    if (['魂技', 'independent_ring_skill'].includes(scope)) {
      const 武魂索引 = path.findIndex(片段 => 是武魂槽位键_桥接(片段));
      const 武魂路径 = 武魂索引 >= 0 ? path.slice(0, 武魂索引 + 1) : path.slice(0, -3);
      const 武魂 = deepGet(rootData, 武魂路径, null);
      取武魂魂灵条目_桥接(武魂)
        .sort((a, b) => 读取槽位序号_桥接(a[0], 999) - 读取槽位序号_桥接(b[0], 999))
        .forEach(([魂灵名, 魂灵]) => {
          const 魂灵路径 = [...武魂路径, 魂灵名];
          取魂灵魂环条目_桥接(魂灵)
            .sort((a, b) => 读取槽位序号_桥接(a[0], 999) - 读取槽位序号_桥接(b[0], 999))
            .forEach(([环位名, 魂环]) => {
              取魂环魂技条目_桥接(魂环).forEach(([键, 技能]) => 加入技能([...魂灵路径, 环位名, 键], 键, 技能, 环位名));
            });
        });
      取武魂直接魂环条目_桥接(武魂)
        .sort((a, b) => 读取槽位序号_桥接(a[0], 999) - 读取槽位序号_桥接(b[0], 999))
        .forEach(([环位名, 魂环]) => {
          取魂环魂技条目_桥接(魂环).forEach(([键, 技能]) => 加入技能([...武魂路径, 环位名, 键], 键, 技能, 环位名));
        });
    } else if (scope === 'blood_ring_skill') {
      const 环位索引 = path.findIndex(片段 => 是气血魂环槽位键_桥接(片段));
      const 载体路径 = 环位索引 >= 0 ? path.slice(0, 环位索引) : path.slice(0, -2);
      const 载体 = deepGet(rootData, 载体路径, null);
      取血脉气血魂环条目_桥接(载体)
        .sort((a, b) => 读取槽位序号_桥接(a[0], 999) - 读取槽位序号_桥接(b[0], 999))
        .forEach(([环位名, 魂环]) => {
          取气血魂环魂技条目_桥接(魂环).forEach(([键, 技能]) => 加入技能([...载体路径, 环位名, 键], 键, 技能, 环位名));
        });
    } else {
      const parentPath = path.slice(0, -1);
      const parent = deepGet(rootData, parentPath, null);
      if (parent && typeof parent === 'object' && !Array.isArray(parent)) {
        safeEntries(parent).forEach(([键, 技能]) => {
          if (scope === '武魂融合技' && 键 !== 当前键) return;
          if (scope !== '武魂融合技' && !['自创魂技', 'art', 'blood_skill', 'blood_passive'].includes(scope)) return;
          加入技能([...parentPath, 键], 键, 技能);
        });
      }
    }
    return 列表.sort((a, b) => a.order - b.order || String(a.label).localeCompare(String(b.label), 'zh-Hans'));
  }
  // —— B:22592-22601
  function 获取技能设计台当前标题(rootData = {}, previewMeta = {}, skillSource = {}) {
    const path = Array.isArray(previewMeta && previewMeta.path) ? previewMeta.path : [];
    const 当前键 = toText(path[path.length - 1], '').trim();
    const 槽位标签 = 读取技能设计台槽位序号标签(当前键, '');
    const 技能名 = 读取技能设计台技能显示名(skillSource, toText(previewMeta && previewMeta.label, 当前键 || '技能'));
    if (槽位标签 && 槽位标签 !== 技能名 && !技能设计台标签是同一槽位(槽位标签, 技能名)) return `${槽位标签} / ${技能名}`;
    if (槽位标签 && 技能设计台标签是同一槽位(槽位标签, 技能名)) return 槽位标签;
    void rootData;
    return 技能名;
  }
  // —— B:22621-22646
  function resolveSkillDesignerSourceTypeMeta(previewMeta = {}) {
    const scope = toText(previewMeta && previewMeta.scope, '魂技');
    const path = Array.isArray(previewMeta && previewMeta.path) ? previewMeta.path : [];
    const rootData = (liveSnapshot && liveSnapshot.rootData) || readLatestMvuDataByEditor() || {};
    if (scope === '魂技') {
      const spiritBasePath = path.length >= 4 ? path.slice(0, 4) : [];
      const spiritSlot = normalizeSkillUiText(spiritBasePath[3], '');
      const spiritType = normalizeSkillUiText(
        spiritBasePath.length ? deepGet(rootData, [...spiritBasePath, 'type'], '') : '',
        '未设置',
      );
      return {
        value: spiritType || '未设置',
        display: spiritSlot && spiritType ? `${spiritSlot} / ${spiritType}` : spiritType || spiritSlot || '未设置',
      };
    }
    if (scope === '武魂融合技') return { value: '武魂融合技', display: '武魂融合技' };
    if (scope === 'art') return { value: '功法', display: '功法' };
    if (scope === '自创魂技') return { value: '自创魂技', display: '自创魂技' };
    if (scope === 'blood_passive') return { value: '血脉被动', display: '血脉被动' };
    const category = toText(previewMeta && previewMeta.category, '技能');
    return {
      value: category || '未设置',
      display: category || '未设置',
    };
  }
  // —— B:22648-22659
  function resolveSkillDesignerTypeMeta(previewMeta = {}, fallbackType = '') {
    const normalizedFallback = normalizeSkillUiText(fallbackType, '');
    if (SKILL_DESIGNER_SKILL_TYPES.includes(normalizedFallback)) {
      return { value: normalizedFallback, display: normalizedFallback };
    }
    const sourceType = resolveSkillDesignerSourceTypeMeta(previewMeta).value;
    const mappedType = SKILL_DESIGNER_SOURCE_TYPE_TO_SKILL_TYPE[sourceType] || '输出';
    return {
      value: mappedType,
      display: mappedType,
    };
  }
  // —— B:22661-22738
  function 推断技能设计台技能分类(原型效果列表 = [], fallbackType = '') {
    const fallback = SKILL_DESIGNER_SKILL_TYPES.includes(normalizeSkillUiText(fallbackType, ''))
      ? normalizeSkillUiText(fallbackType, '')
      : '输出';
    const effects = Array.isArray(原型效果列表)
      ? 原型效果列表.filter(effect => effect && typeof effect === 'object')
      : [];
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
    const 负面状态 = [
      '中毒',
      '流血',
      '灼烧',
      '冻伤',
      '眩晕',
      '沉默',
      '致盲',
      '禁疗',
      '治疗反转',
      '标记',
      '封技',
      '迟缓',
    ];
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
    if (
      effects.some(
        effect =>
          normalizeSkillUiText(effect['原型'], '') === '资源变化' &&
          normalizeSkillUiText(effect['资源'], '') === '生命' &&
          读取数值方向(effect) > 0,
      )
    )
      return '回复';
    if (
      effects.some(
        effect =>
          ['属性修正', '判定修正', '结算修正', '资源变化'].includes(normalizeSkillUiText(effect['原型'], '')) &&
          读取数值方向(effect) < 0,
      )
    )
      return '控制';
    if (
      effects.some(
        effect =>
          ['属性修正', '判定修正', '结算修正', '资源变化'].includes(normalizeSkillUiText(effect['原型'], '')) &&
          读取数值方向(effect) > 0,
      )
    )
      return '辅助';
    if (
      有原型('决策干扰') ||
      有原型('规则改写') ||
      有原型('机制抹消')
    )
      return '控制';
    if (有原型('机制授予') || 有原型('复制执行') || 有原型('时光回溯') || 有原型('状态转移') || 有原型('状态交换'))
      return '辅助';
    return fallback;
  }
  // —— B:22749-22797
  function getSkillDesignerScopeLabels(previewMeta = {}) {
    const scope = toText(previewMeta && previewMeta.scope, '魂技');
    if (scope === 'art') {
      return {
        studioTitle: '功法设计台',
        parameterTitle: '功法设置',
        summaryTitle: '功法速览',
        nameFieldLabel: '功法名',
        targetLabel: '目标',
        deliveryLabel: '运转方式',
        visualLabel: '运转表现',
        effectLabel: '功法描述',
      };
    }
    if (scope === '自创魂技') {
      return {
        studioTitle: '自创魂技设计台',
        parameterTitle: '自创魂技设置',
        summaryTitle: '自创魂技速览',
        nameFieldLabel: '自创魂技名',
        targetLabel: '目标',
        deliveryLabel: '施展方式',
        visualLabel: '表现描述',
        effectLabel: '魂技描述',
      };
    }
    if (scope === '武魂融合技') {
      return {
        studioTitle: '武魂融合技设计台',
        parameterTitle: '武魂融合结构',
        summaryTitle: '武魂融合速览',
        nameFieldLabel: '武魂融合技名',
        targetLabel: '目标',
        deliveryLabel: '施放形式',
        visualLabel: '融合表现',
        effectLabel: '融合效果',
      };
    }
    return {
      studioTitle: '技能设计台',
      parameterTitle: '魂技设置',
      summaryTitle: '设计速览',
      nameFieldLabel: '魂技名',
      targetLabel: '目标',
      deliveryLabel: '释放形式',
      visualLabel: '画面描述',
      effectLabel: '效果描述',
    };
  }
  // —— B:22799-22804
  function getSkillDesignerDefaultTarget(previewMeta = {}, type = '') {
    const scope = toText(previewMeta && previewMeta.scope, 'skill');
    const normalizedType = normalizeSkillUiText(type, '');
    if (scope === 'art' || scope === 'blood_passive' || /被动/.test(normalizedType)) return '自身';
    return '单体';
  }
  // —— B:22806-22809
  function normalizeSkillDesignerTargetForForm(target = '', fallback = '') {
    const text = normalizeSkillUiText(target, fallback);
    return normalizeSkillDesignerEffectTargetValue(text, normalizeSkillDesignerEffectTargetValue(fallback, '单体'));
  }
  // —— B:22811-22827
  function resolveSkillDesignerImplicitAttributeConfig(state = {}, previewMeta = {}) {
    const attachedAttributes = normalizeSkillDesignerArray(state && state.attachedAttributes);
    const scope = toText(previewMeta && previewMeta.scope, 'skill');
    const type = normalizeSkillUiText(state && state.type, '');
    const allWuxing =
      attachedAttributes.length >= 2 && attachedAttributes.every(attr => WUXING_ATTRIBUTE_TOKEN_OPTIONS.includes(attr));
    let source = '无';
    if (attachedAttributes.length) {
      if (allWuxing) source = '魂技调用';
      else if (scope === 'art' || scope === '自创魂技' || /元素|精神|功法|自创/.test(type)) source = '自身操控';
    }
    return {
      source,
      role: source === '魂技调用' ? '结构术式' : source === '自身操控' ? '增幅器' : '无',
      coeff: normalizeSkillDesignerCoeffMap({}),
    };
  }
  // —— B:22829-22838
  function normalizeSkillDesignerLevelControl(数值 = {}) {
    const 来源 = 数值 && typeof 数值 === 'object' && !Array.isArray(数值) ? 数值 : {};
    const 中心等级 = Number(来源.中心等级);
    const 圆满等级 = Number(来源.圆满等级);
    if (!Number.isFinite(中心等级) || !Number.isFinite(圆满等级) || 圆满等级 <= 中心等级) return null;
    return {
      中心等级: Number(中心等级.toFixed(2)),
      圆满等级: Number(圆满等级.toFixed(2)),
    };
  }
  // —— B:22840-22848
  function buildSkillDesignerLevelControlFromDraft(草稿 = {}) {
    return (
      normalizeSkillDesignerLevelControl(草稿 && 草稿.技能掌控度) ||
      normalizeSkillDesignerLevelControl({
        中心等级: 草稿 && 草稿.技能掌控度中心等级,
        圆满等级: 草稿 && 草稿.技能掌控度圆满等级,
      })
    );
  }
  // —— B:22850-22857
  function 技能设计台启用技能掌控度(previewMeta = {}, 草稿 = {}) {
    if (草稿 && 草稿.技能掌控度 && typeof 草稿.技能掌控度 === 'object' && !Array.isArray(草稿.技能掌控度)) return true;
    const 显式值 = normalizeSkillUiText(草稿 && 草稿.启用技能掌控度, '');
    if (/启用|有|true|yes|1/.test(显式值)) return true;
    if (/无|禁用|关闭|false|no|0/.test(显式值)) return false;
    void previewMeta;
    return false;
  }
  // —— B:22859
  const 技能设计台被动触发选项 = Object.freeze(['常驻', '战斗开始', '回合开始', '受击前', '致命前', '受击后', '濒死时', '被控制时', '命中后']);
  // —— B:22860
  const 技能设计台被动触发周期选项 = Object.freeze(['无限制', '每战', '每回合']);
  // —— B:22861
  const 技能设计台使用限制周期选项 = Object.freeze(['无限制', '每战', '每日']);
  // —— B:22863-22872
  function 技能设计台效果是自身死亡转存活(effect = {}) {
    return (
      effect &&
      typeof effect === 'object' &&
      !Array.isArray(effect) &&
      normalizeSkillUiText(effect['原型'], '') === '规则改写' &&
      normalizeSkillUiText(effect['规则'], '') === '死亡转存活' &&
      normalizeSkillDesignerEffectTargetValue(effect['目标'], '自身') === '自身'
    );
  }
  // —— B:22874-22880
  function 技能设计台包含自身死亡转存活(草稿 = {}) {
    const effects = [
      ...(Array.isArray(草稿 && 草稿.prototypeEffects) ? 草稿.prototypeEffects : []),
      ...(Array.isArray(草稿 && 草稿['_效果数组']) ? 草稿['_效果数组'] : []),
    ];
    return effects.some(effect => 技能设计台效果是自身死亡转存活(effect));
  }
  // —— B:22882-22888
  function 技能设计台启用被动(previewMeta = {}, 草稿 = {}) {
    const 显式值 = normalizeSkillUiText(草稿 && 草稿.启用被动, '');
    if (/启用|有|true|yes|1/.test(显式值)) return true;
    if (技能设计台包含自身死亡转存活(草稿)) return true;
    if (/无|禁用|关闭|false|no|0/.test(显式值)) return false;
    return toText(previewMeta && previewMeta.scope, '') === 'blood_passive';
  }
  // —— B:22890-22904
  function 读取技能设计台被动触发默认值(草稿 = {}) {
    if (技能设计台包含自身死亡转存活(草稿)) return '濒死时';
    const 显式触发 = normalizeSkillDesignerSelectValue(
      草稿 && 草稿.被动触发,
      技能设计台被动触发选项,
      '',
    );
    if (显式触发) return 显式触发;
    const effects = Array.isArray(草稿 && 草稿.prototypeEffects) ? 草稿.prototypeEffects : [];
    if (effects.some(effect => normalizeSkillUiText(effect && effect['原型'], '') === '规则防御' && normalizeSkillUiText(effect && effect['规则'], '') === '免死'))
      return '濒死时';
    if (effects.some(effect => normalizeSkillUiText(effect && effect['原型'], '') === '规则防御' && normalizeSkillUiText(effect && effect['规则'], '') === '免伤'))
      return '受击前';
    return '常驻';
  }
  // —— B:22906-22925
  function 读取技能设计台被动触发限制(草稿 = {}) {
    const 技能级限制 = 草稿 && 草稿['触发限制'] && typeof 草稿['触发限制'] === 'object' && !Array.isArray(草稿['触发限制'])
      ? 草稿['触发限制']
      : {};
    const 技能级被动周期 = normalizeSkillDesignerSelectValue(
      技能级限制['周期'],
      技能设计台被动触发周期选项,
      '',
    );
    const 默认周期 = 技能设计台包含自身死亡转存活(草稿) ? '每战' : '无限制';
    const 周期 = normalizeSkillDesignerSelectValue(
      (草稿 && 草稿.被动触发周期) || (技能级被动周期 === '每回合' ? 技能级被动周期 : '') || 默认周期,
      技能设计台被动触发周期选项,
      '无限制',
    );
    return {
      周期,
      次数: Math.max(1, parseSkillDesignerIntegerInputValue(草稿 && (草稿.被动触发次数 || (技能级被动周期 === '每回合' ? 技能级限制['次数'] : '')), 1, 1)),
    };
  }
  // —— B:22927-22940
  function 读取技能设计台使用限制(草稿 = {}) {
    const 限制 = 草稿 && 草稿['触发限制'] && typeof 草稿['触发限制'] === 'object' && !Array.isArray(草稿['触发限制'])
      ? 草稿['触发限制']
      : {};
    const 周期 = normalizeSkillDesignerSelectValue(
      草稿 && (草稿.使用限制周期 || 限制['周期']),
      技能设计台使用限制周期选项,
      '无限制',
    );
    return {
      周期,
      次数: Math.max(1, parseSkillDesignerIntegerInputValue(草稿 && (草稿.使用限制次数 || 限制['次数']), 1, 1)),
    };
  }
  // —— B:22942-22949
  function 读取技能设计台有效触发限制(草稿 = {}, 预览元数据 = {}) {
    const 使用限制 = 读取技能设计台使用限制(草稿);
    if (使用限制.周期 !== '无限制') return cloneJsonValue(使用限制);
    if (!技能设计台启用被动(预览元数据, 草稿)) return null;
    const 被动触发限制 = 读取技能设计台被动触发限制(草稿);
    if (被动触发限制.周期 !== '无限制') return cloneJsonValue(被动触发限制);
    return null;
  }
  // —— B:22951-23091
  function readSkillDesignerDraft(skill = {}, rawName = '', previewMeta = {}) {
    const safeSkill = skill && typeof skill === 'object' ? skill : {};
    const 预览路径 = Array.isArray(previewMeta && previewMeta.path) ? previewMeta.path : [];
    const 外层记录 = 预览路径.length > 1 && toText(预览路径[预览路径.length - 1], '') === '技能数据'
      ? deepGet(liveSnapshot?.rootData || lastRenderableSnapshot?.rootData || {}, 预览路径.slice(0, -1), {}) || {}
      : {};
    const 功法记录 = toText(previewMeta && previewMeta.scope, '') === 'art' && 预览路径[0] === 'char' && 预览路径.length
      ? deepGet(liveSnapshot?.rootData || lastRenderableSnapshot?.rootData || {}, ['char', 预览路径[1], '功法', toText(预览路径[预览路径.length - 1], rawName)], {}) || {}
      : {};
    const effectArray = Array.isArray(safeSkill['_效果数组']) ? safeSkill['_效果数组'] : [];
    const constructTemplate =
      effectArray.find(
        effect =>
          effect &&
          typeof effect === 'object' &&
          !normalizeSkillUiText(effect['原型'], '') &&
          Array.isArray(effect['使用效果']),
      ) || null;
    const designDraft = {};
    const levelControl = normalizeSkillDesignerLevelControl(safeSkill['技能掌控度']);
    const resolvedType = normalizeSkillUiText(designDraft.type || safeSkill.type, '未知');
    const 启用技能掌控度 = 技能设计台启用技能掌控度(previewMeta, {
      ...designDraft,
      type: resolvedType,
      技能掌控度: levelControl,
      启用技能掌控度: designDraft['启用技能掌控度'] || (levelControl ? '启用' : ''),
    });
    const resolvedTarget = normalizeSkillUiText(
      (Array.isArray(constructTemplate?.['使用效果']) ? constructTemplate['使用效果'] : effectArray).find(
        effect => effect && effect['目标'],
      )?.['目标'],
      getSkillDesignerDefaultTarget(previewMeta, resolvedType),
    );
    const allPrototypeEffects = 提取技能设计台原型效果列表(
      constructTemplate ? constructTemplate['使用效果'] : effectArray,
      resolvedTarget,
    );
    const resolvedPrototypeEffects = allPrototypeEffects;
    const resolvedPrimaryMain = '';
    const resolvedPrimarySub = '';
    const resolvedSecondaryMechanics = [];
    const inferredDeliveryForm = inferSkillDesignerDeliveryForm(effectArray, resolvedType, resolvedTarget);
    const inferredMainRole = inferSkillDesignerMainRole(
      resolvedType,
      resolvedTarget,
      resolvedPrimaryMain,
      resolvedPrimarySub,
    );
    const mergedMechanicParams = {};
    const costConfig = parseSkillDesignerCostConfig(
      designDraft['消耗'] || safeSkill['消耗'],
      designDraft['消耗资源'],
      designDraft['消耗值'],
    );
    const resolvedDeliveryForm = normalizeSkillUiText(
      designDraft['承载方式'] ||
        designDraft['释放形式'] ||
        safeSkill['承载方式'] ||
        safeSkill['释放形式'] ||
        inferredDeliveryForm,
      '',
    );
    const 启用被动 = 技能设计台启用被动(previewMeta, {
      ...designDraft,
      type: resolvedType,
      启用被动: designDraft['启用被动'],
    });
    const 被动触发 = 读取技能设计台被动触发默认值({
      ...designDraft,
      prototypeEffects: resolvedPrototypeEffects,
    });
    const 被动触发限制 = 读取技能设计台被动触发限制({
      ...designDraft,
      prototypeEffects: resolvedPrototypeEffects,
      触发限制: safeSkill['触发限制'],
    });
    const 使用限制 = 读取技能设计台使用限制(safeSkill);
    return {
      name: cleanSkillDisplayName(safeSkill, rawName),
      type: 启用被动 ? '被动' : resolvedType,
      target: resolvedTarget,
      cost: formatSkillDesignerFullCostText(costConfig.resourceType, costConfig.resourceValues, costConfig.sustainText),
      resourceType: costConfig.resourceType,
      resourceValues: cloneJsonValue(costConfig.resourceValues || {}),
      resourceValue: costConfig.resourceValue,
      sustainCostText: costConfig.sustainText || '',
      前摇: Math.max(0, toNumber(safeSkill['前摇'], 0)),
      bonus: '无',
      mainRole: normalizeSkillUiText(inferredMainRole, '未知'),
      primaryMain: resolvedPrimaryMain,
      primarySub: resolvedPrimarySub,
      prototypeEffects: resolvedPrototypeEffects,
      deliveryForm: resolvedDeliveryForm,
      constructItemCount: Math.max(
        1,
        parseSkillDesignerIntegerInputValue(constructTemplate && constructTemplate['数量'], 1, 1),
      ),
      constructDurationTick: Math.max(
        0,
        parseSkillDesignerIntegerInputValue(constructTemplate && constructTemplate['有效期tick'], 0, 0),
      ),
      constructDescription: normalizeSkillUiText(constructTemplate && constructTemplate['描述'], ''),
      secondaryMechanics: resolvedSecondaryMechanics,
      attachedAttributes: normalizeSkillDesignerArray(designDraft['附带属性'] || safeSkill['附带属性']),
      attributeSource: normalizeSkillUiText(designDraft['属性来源'], '无'),
      attributeRole: normalizeSkillUiText(designDraft['魂技作用'], '无'),
      coeff: normalizeSkillDesignerCoeffMap(designDraft['属性系数']),
      artStage: normalizeSkillUiText(功法记录['境界'] || designDraft['境界'], '未入门'),
      artLevel: Math.max(0, toNumber(功法记录['lv'] ?? designDraft['lv'], 0)),
      fusionMode:
        designDraft['融合模式'] || 外层记录['融合模式']
          ? normalizeSkillDesignerFusionMode(designDraft['融合模式'] || 外层记录['融合模式'])
          : '',
      用法模式: 规范化技能设计台融合用法模式(designDraft['用法模式'] || 外层记录['用法模式']),
      fusionPartner: normalizeSkillUiText(designDraft['融合对象'] || 外层记录['融合对象'], ''),
      fusionSourceSpirits: normalizeSkillDesignerArray(designDraft['来源武魂'] || 外层记录['来源武魂']),
      fusionParticipants: getSkillDesignerRawFusionParticipants(designDraft, 外层记录),
      mechanicParams: normalizeSkillDesignerMechanicParamMap(mergedMechanicParams, {
        target: resolvedTarget,
        primaryMain: resolvedPrimaryMain,
        primarySub: resolvedPrimarySub,
        secondaryMechanics: resolvedSecondaryMechanics,
      }),
      visualDesc: normalizeSkillUiText(safeSkill['画面描述'], '未知'),
      effectDesc: normalizeSkillUiText(safeSkill['效果描述'], '未知'),
      summaryText: normalizeSkillUiText(designDraft['设计摘要'], ''),
      副作用列表: Array.isArray(safeSkill['副作用列表']) ? cloneJsonValue(safeSkill['副作用列表']) : [],
      使用副作用列表: Array.isArray(constructTemplate?.['副作用列表']) ? cloneJsonValue(constructTemplate['副作用列表']) : [],
      启用技能掌控度: 启用技能掌控度 ? '启用' : '无',
      技能掌控度: 启用技能掌控度 ? levelControl : null,
      技能掌控度中心等级: 启用技能掌控度 && levelControl ? String(levelControl.中心等级) : '',
      技能掌控度圆满等级: 启用技能掌控度 && levelControl ? String(levelControl.圆满等级) : '',
      启用被动: 启用被动 ? '启用' : '无',
      被动触发,
      被动触发周期: 被动触发限制.周期,
      被动触发次数: String(被动触发限制.次数),
      使用限制周期: 使用限制.周期,
      使用限制次数: String(使用限制.次数),
      阵营判定: '自动',
    };
  }
  // —— B:23137-23177
  function 构建技能设计台模板原型效果列表(draft = {}, previewMeta = {}) {
    try {
      const 目标 = normalizeSkillDesignerTargetForForm(
        draft && draft.target,
        getSkillDesignerDefaultTarget(previewMeta, draft && draft.type),
      );
      const 模板名列表 = Array.from(
        new Set(
          [
            getSkillDesignerEffectivePrimaryLabel(draft),
            ...normalizeSkillDesignerSecondarySelection(
              draft && draft.primaryMain,
              draft && draft.secondaryMechanics,
              draft && draft.type,
              draft && draft.primarySub,
            ),
          ]
            .map(label => normalizeSkillUiText(label, ''))
            .filter(Boolean),
        ),
      );
      const runtimeEffects = 模板名列表.flatMap(label => {
        const 编译列表 = getSkillDesignerMechanismCompiledPrototypeList(label);
        return 编译列表
          .map(编译条目 => {
            const 原型 = normalizeSkillUiText(编译条目 && 编译条目['原型'], '');
            if (!原型) return null;
            return {
              ...创建技能设计台默认原型效果(原型, 目标),
              ...cloneJsonValue(编译条目),
              目标,
            };
          })
          .filter(Boolean);
      });
      return normalizeSkillDesignerExecutionEffectArray(cloneJsonValue(runtimeEffects), 目标);
    } catch (error) {
      console.warn('[SkillDesigner] 机制模板编译原型失败', error);
      return [];
    }
  }
  // —— B:23179-23184
  function buildSkillDesignerConstructSummary(draft = {}) {
    if (normalizeSkillUiText(draft && draft.deliveryForm, '') !== '造物承载') return '';
    const count = Math.max(1, parseSkillDesignerIntegerInputValue(draft && draft.constructItemCount, 1, 1));
    const duration = Math.max(0, parseSkillDesignerIntegerInputValue(draft && draft.constructDurationTick, 0, 0));
    return `造物：×${count}${duration > 0 ? `；${duration}tick` : ''}`;
  }
  // —— B:23222-23231
  function buildSkillDesignerExecutionSummary(draft = {}) {
    const parts = [];
    const cost = formatSkillDesignerCostText(draft.costType, draft.costValues);
    const constructSummary = buildSkillDesignerConstructSummary(draft);
    if (cost && cost !== '无') parts.push(`消耗：${cost}`);
    if (constructSummary) parts.push(constructSummary);
    const sideEffectSummary = buildSkillDesignerSideEffectSummary(draft);
    if (sideEffectSummary) parts.push(`副作用：${sideEffectSummary}`);
    return parts.join('；');
  }
  // —— B:23233-23240
  function buildSkillDesignerArtProgressSummary(draft = {}) {
    const type = normalizeSkillUiText(draft.type, '');
    if (type !== '功法') return '';
    if (normalizeSkillUiText(draft.name, '') !== '紫极魔瞳') return '';
    const stage = normalizeSkillUiText(draft.artStage, '未入门');
    const level = Math.max(0, toNumber(draft.artLevel, 0));
    return `境界：${stage}；等级：${level}`;
  }
  // —— B:23242-23245
  function buildSkillDesignerAttributeSummary(draft = {}) {
    const attachedAttributes = normalizeSkillDesignerArray(draft.attachedAttributes);
    return attachedAttributes.length ? `附带属性：${attachedAttributes.join('/')}` : '';
  }
  // —— B:23247-23285
  function 构建技能设计台临时技能(草稿 = {}, 预览元数据 = {}) {
    const 规范化草稿 = buildSkillDesignerFormStateFromDraft(草稿, 预览元数据);
    const 启用被动 = 技能设计台启用被动(预览元数据, 规范化草稿);
    const 有效触发限制 = 读取技能设计台有效触发限制(规范化草稿, 预览元数据);
    const 临时技能 = {
      魂技名: normalizeSkillUiText(规范化草稿.name, ''),
      承载方式: 启用被动 ? '直接生效' : normalizeSkillUiText(规范化草稿.deliveryForm, '直接生效'),
      消耗: 格式化技能设计台正式消耗文本(规范化草稿.costType, 规范化草稿.costValues, 规范化草稿.sustainCostText, 预览元数据, 规范化草稿, liveSnapshot?.rootData || lastRenderableSnapshot?.rootData || {}),
      前摇: Math.max(0, toNumber(规范化草稿['前摇'], 0)),
      附带属性: normalizeSkillDesignerArray(规范化草稿.attachedAttributes),
      _效果数组: buildSkillDesignerRuntimeEffects(规范化草稿, {}, 预览元数据),
    };
    if (有效触发限制) 临时技能['触发限制'] = 有效触发限制;
    临时技能.__魂环位 = 推断技能设计台魂环位(预览元数据);
    临时技能.__战斗来源类别 = ['魂技', 'independent_ring_skill'].includes(normalizeSkillUiText(预览元数据 && 预览元数据.scope, ''))
      ? '魂技'
      : normalizeSkillUiText(预览元数据 && 预览元数据.scope, '');
    if (临时技能['承载方式'] === '造物承载') {
      const 使用效果 = normalizeSkillDesignerExecutionEffectArray(
        cloneJsonValue(临时技能['_效果数组']),
        normalizeSkillDesignerTargetForForm(规范化草稿.target, '单体'),
        { draft: 规范化草稿, 技能: {}, passiveMode: false },
      );
      临时技能['_效果数组'] = [buildSkillDesignerConstructEffect(规范化草稿, 使用效果)].filter(
        效果 => Array.isArray(效果['使用效果']) && 效果['使用效果'].length,
      );
      临时技能['产物描述'] = normalizeSkillUiText(规范化草稿.constructDescription, '');
    }
    if (规范化草稿['技能掌控度']) 临时技能['技能掌控度'] = cloneJsonValue(规范化草稿['技能掌控度']);
    if (Array.isArray(规范化草稿['副作用列表']) && 规范化草稿['副作用列表'].length)
      临时技能['副作用列表'] = cloneJsonValue(规范化草稿['副作用列表']);
    if (预览元数据 && 预览元数据.scope === '武魂融合技') {
      临时技能['融合参与者'] = (Array.isArray(规范化草稿.fusionParticipants) ? 规范化草稿.fusionParticipants : [])
        .map(参与者 => normalizeSkillUiText(参与者 && (参与者.name || 参与者.charKey), ''))
        .filter(Boolean);
      临时技能['失败回滚'] = true;
    }
    return { 临时技能, 规范化草稿 };
  }
  // —— B:23287-23464
  function 构建技能设计台COST试算Html(草稿 = {}, 预览元数据 = {}, 根数据 = {}) {
    try {
      const COST助手 = (typeof globalThis !== 'undefined' && globalThis.__LWCS_SKILL_COST_HELPERS_V1__)
        || (typeof window !== 'undefined' && window.__LWCS_SKILL_COST_HELPERS_V1__)
        || null;
      if (!COST助手 || typeof COST助手.评估技能预算_V1 !== 'function') return '';
      const { 临时技能, 规范化草稿 } = 构建技能设计台临时技能(草稿, 预览元数据);
      const 预算上下文 = 构建技能设计台预算上下文(预览元数据, 根数据, 规范化草稿);
      const 评估 = COST助手.评估技能预算_V1(临时技能, {
        ...预算上下文,
        path: 预览元数据 && 预览元数据.path,
        来源: 预算上下文.来源类别,
        启用位级硬上限: true,
      });
      if (!评估) return '';
      const 差额 = Number((Number(评估.实际门禁 || 0) - Number(评估.实际COST || 0)).toFixed(2));
      const 状态 = 差额 >= 0 ? `剩余 ${差额.toFixed(1)}` : `超出 ${Math.abs(差额).toFixed(1)}`;
      const 明细 = (Array.isArray(评估.效果明细) ? 评估.效果明细 : []).slice(0, 12);
      const 副作用明细 = (Array.isArray(评估.副作用明细) ? 评估.副作用明细 : []).slice(0, 6);
      const 条件来源标签 = 项 => {
        const 路径 = String(项 && 项.路径 || '');
        const 匹配 = 路径.match(/条件分支\[(\d+)\]\.(替换效果|追加效果)/);
        if (!匹配) return String(项 && 项.分支角色 || '').trim();
        const 序号 = Number(匹配[1]) + 1;
        return `条件${序号}${匹配[2] === '替换效果' ? '替换' : '追加'}`;
      };
      const 明细标签 = 项 => {
        const 角色 = 条件来源标签(项);
        const 原型 = String(项.原型 || '').trim();
        const 字段 = String(项.关键字段 || '').trim();
        const 名称 = 原型 === '规则改写' && 字段 === '规则' && String(项.关键值 || '').trim() === '死亡转存活'
          ? '复活'
          : String(项.关键值 || '').trim();
        const 目标 = String(项.目标 || '').trim();
        const 原始数值文本 = 项.数值 !== undefined && 项.数值 !== '' ? String(项.数值) : '';
        const 数值 = 原始数值文本
          ? `${原始数值文本}${项.绝对值每COST点数 ? '点' : ''}`
          : (项.威力倍率 !== undefined && 项.威力倍率 !== '' ? `威力${项.威力倍率}` : '');
        const 伤害类型 = 原型 === '伤害结算' && 项.伤害类型 ? String(项.伤害类型).trim() : '';
        const 限定 = 格式化技能设计台限定元素显示(项.限定元素);
        return [
          角色 || '基础',
          原型,
          字段 && 名称 ? `${字段}:${名称}` : 名称,
          数值,
          伤害类型,
          目标,
          项.持续回合 ? `持续${项.持续回合}回合` : '',
          限定 ? `限定${限定}` : '',
        ].filter(Boolean).join(' / ') || '效果';
      };
      const 明细字段 = 项 => {
        const 字段列表 = [
          项.路径 ? `路径 ${项.路径}` : '',
          条件来源标签(项) ? `来源 ${条件来源标签(项)}` : '',
          项.原型 ? `原型 ${项.原型}` : '',
          项.关键字段 ? `${项.关键字段} ${项.原型 === '规则改写' && 项.关键字段 === '规则' && 项.关键值 === '死亡转存活' ? '复活' : 项.关键值 || '-'}` : '',
          项.目标 ? `目标 ${项.目标}` : '',
          项.持续回合 ? `持续 ${项.持续回合}` : '',
          项.威力倍率 !== undefined && 项.威力倍率 !== '' ? `威力 ${项.威力倍率}` : '',
          项.数值 !== undefined && 项.数值 !== '' ? `数值 ${项.数值}` : '',
          项.数值类型 ? `类型 ${项.数值类型}` : '',
          项.百分点 !== null && 项.百分点 !== undefined ? `百分点 ${Number(项.百分点 || 0).toFixed(2)}` : '',
          项.绝对值 !== null && 项.绝对值 !== undefined ? `绝对值 ${Number(项.绝对值 || 0).toFixed(2)}` : '',
          项.绝对值每COST点数 !== null && 项.绝对值每COST点数 !== undefined ? `${Number(项.绝对值每COST点数 || 0).toFixed(0)}点/COST` : '',
          项.单位COST !== null && 项.单位COST !== undefined ? `单位COST ${Number(项.单位COST || 0).toFixed(2)}` : '',
          项.数值倍率 !== null && 项.数值倍率 !== undefined ? `数值倍率 ${Number(项.数值倍率 || 0).toFixed(2)}` : '',
          项.目标系数 !== null && 项.目标系数 !== undefined ? `目标系数 ${Number(项.目标系数 || 0).toFixed(2)}` : '',
          项.持续系数 !== null && 项.持续系数 !== undefined ? `持续系数 ${Number(项.持续系数 || 0).toFixed(2)}` : '',
          项.限定元素 ? `限定元素 ${格式化技能设计台限定元素显示(项.限定元素)}` : '',
          项.限制来源 ? `限制来源 ${项.限制来源}` : '',
          项.限制抵扣率 ? `限制抵扣率 ${(Number(项.限制抵扣率 || 0) * 100).toFixed(0)}%` : '',
          Number(项.限制抵扣 || 0) > 0 ? `限制 -${Number(项.限制抵扣 || 0).toFixed(1)}` : '',
        ].filter(Boolean);
        return 字段列表.join(' · ');
      };
      const 明细辅助文本 = 项 => [
        项.百分点 !== null && 项.百分点 !== undefined ? `百分点 ${Number(项.百分点 || 0).toFixed(1)}` : '',
        项.绝对值每COST点数 !== null && 项.绝对值每COST点数 !== undefined ? `${Number(项.绝对值每COST点数 || 0).toFixed(0)}点/COST` : '',
        项.单位COST !== null && 项.单位COST !== undefined ? `单位 ${Number(项.单位COST || 0).toFixed(2)}` : '',
        项.目标系数 !== null && 项.目标系数 !== undefined ? `目标 ${Number(项.目标系数 || 0).toFixed(2)}` : '',
        项.持续系数 !== null && 项.持续系数 !== undefined ? `持续 ${Number(项.持续系数 || 0).toFixed(2)}` : '',
        项.限制抵扣率 ? `${项.限制来源 || '限制'} -${(Number(项.限制抵扣率 || 0) * 100).toFixed(0)}%` : '',
      ].filter(Boolean).join(' ｜ ');
      const 副作用标签 = 项 => [
        项.来源 || '副作用',
        项.副作用类型 || '',
        项.触发时机 || '',
        项.生效对象 || '',
        项.触发概率 !== undefined ? `${(Number(项.触发概率 || 0) * 100).toFixed(0)}%` : '',
        项.持续回合 ? `持续${项.持续回合}回合` : '',
      ].filter(Boolean).join(' / ');
      const 副作用字段 = 项 => [
        项.路径 ? `路径 ${项.路径}` : '',
        项.来源 ? `来源 ${项.来源}` : '',
        项.副作用类型 ? `副作用 ${项.副作用类型}` : '',
        项.副作用状态 ? `状态 ${项.副作用状态}` : '',
        项.触发时机 ? `触发 ${项.触发时机}` : '',
        项.生效对象 ? `对象 ${项.生效对象}` : '',
        项.触发概率 !== undefined ? `概率 ${(Number(项.触发概率 || 0) * 100).toFixed(0)}%` : '',
        项.持续回合 ? `持续 ${项.持续回合}` : '',
        项.数值 ? `数值 ${项.数值}` : '',
        项.副数值 ? `副数值 ${项.副数值}` : '',
      ].filter(Boolean).join(' · ');
      const 副作用辅助文本 = 项 => [
        项.数值 ? `数值 ${项.数值}` : '',
        项.副数值 ? `副值 ${项.副数值}` : '',
        项.触发概率 !== undefined ? `概率 ${(Number(项.触发概率 || 0) * 100).toFixed(0)}%` : '',
        项.持续回合 ? `持续 ${项.持续回合}` : '',
      ].filter(Boolean).join(' ｜ ');
      const 明细Html = 明细.length || 副作用明细.length ? `
            <div class="skill-designer-cost-detail">
              ${明细.map(项 => `
                <div class="skill-designer-cost-detail-row${项.计入COST === false ? ' muted' : ''}">
                  <em title="${escapeHtmlAttr(明细字段(项))}">${htmlEscape(明细标签(项))}${明细辅助文本(项) ? `<small>${htmlEscape(明细辅助文本(项))}</small>` : ''}</em>
                  <span>${项.计入COST === false ? '候选 ' : ''}${htmlEscape(`${Number(项.原始COST || 0).toFixed(1)} / ${Number(项.净COST || 项.原始COST || 0).toFixed(1)}`)}</span>
                </div>
              `).join('')}
              ${副作用明细.map(项 => `
                <div class="skill-designer-cost-detail-row muted">
                  <em title="${escapeHtmlAttr(副作用字段(项))}">${htmlEscape(副作用标签(项))}${副作用辅助文本(项) ? `<small>${htmlEscape(副作用辅助文本(项))}</small>` : ''}</em>
                  <span>${htmlEscape(`-${Number(项.COST || 0).toFixed(1)}`)}</span>
                </div>
              `).join('')}
            </div>
          ` : '';
      const 位级上限行 = Number(评估.位级硬上限 || 0) > 0 && Number(评估.位级硬上限 || 0) < Number(评估.对等基线 || 0) - 0.05
        ? [['位级上限', Number(评估.位级硬上限 || 0).toFixed(1)]]
        : [];
      const 公式Html = `
            <div class="skill-designer-cost-detail">
              ${[
                ['魂技位', 评估.魂技位],
                ['基础 COST', Number(评估.基础参考 || 0).toFixed(1)],
                ['来源承载', `${Number(评估.来源承载 || 0).toFixed(2)}x`],
                ['魂环加值', `${Number(评估.魂环年限COST修正 || 0) >= 0 ? '+' : ''}${Number(评估.魂环年限COST修正 || 0).toFixed(1)}`],
                ['天赋加值', `${Number(评估.天赋修正 || 0) >= 0 ? '+' : ''}${Number(评估.天赋修正 || 0).toFixed(1)}`],
                ['运转基准', Number(评估.运转基准 || 0).toFixed(1)],
                ['标准消耗', 评估.运转标准消耗 === null || 评估.标准消耗 === null ? '百分比' : Number(评估.标准消耗 || 0).toFixed(0)],
                ['实际消耗', Number(评估.实际消耗 || 0).toFixed(0)],
                ['标准前摇', Number(评估.标准前摇 || 0).toFixed(0)],
                ['实际前摇', Number(评估.实际前摇 || 0).toFixed(0)],
                ['消耗倍数', `${Number(评估.消耗倍数 || 0).toFixed(2)}x`],
                ['前摇倍数', `${Number(评估.前摇倍数 || 0).toFixed(2)}x`],
                ['代价能量', `${Number(评估.代价能量 || 0).toFixed(3)}x`],
                ['当前对等上限', Number(评估.对等基线 || 0).toFixed(1)],
                ...位级上限行,
              ].map(([标签, 数值]) => `
                <div class="skill-designer-cost-detail-row">
                  <em>${htmlEscape(标签)}</em>
                  <span>${htmlEscape(String(数值))}</span>
                </div>
              `).join('')}
            </div>
          `;
      return `
        <div class="skill-designer-cost-panel">
          <details class="skill-designer-cost-block" open>
            <summary class="skill-designer-trial-row skill-designer-cost-head"><em>效果 COST</em><span>${htmlEscape(Number(评估.效果原始COST || 0).toFixed(1))}</span></summary>
            ${明细Html}
          </details>
          <div class="skill-designer-trial-row"><em>限制抵扣</em><span>-${htmlEscape(Number(评估.限制COST || 0).toFixed(1))}</span></div>
          <div class="skill-designer-trial-row"><em>实际 COST</em><span>${htmlEscape(Number(评估.实际COST || 0).toFixed(1))}</span></div>
          <details class="skill-designer-cost-block" open>
            <summary class="skill-designer-trial-row skill-designer-cost-head">
              <em>运转可承载上限 <button type="button" class="skill-designer-cost-help" data-cost-tip="当前消耗、前摇、魂环、来源与天赋可承载的净 COST 上限。" aria-label="运转可承载上限说明">i</button></em>
              <span>${htmlEscape(Number(评估.实际门禁 || 0).toFixed(1))}</span>
            </summary>
            ${公式Html}
          </details>
          <div class="skill-designer-trial-row"><em>预算利用率</em><span>${htmlEscape(`${Number(评估.实际门禁 || 0) > 0 ? Math.min(999, Math.max(0, Number(评估.实际COST || 0) / Math.max(0.01, Number(评估.实际门禁 || 0))) * 100).toFixed(0) : '0'}%`)}</span></div>
          <div class="skill-designer-trial-row${差额 < 0 ? ' muted' : ''}"><em>状态</em><span>${htmlEscape(状态)}</span></div>
        </div>
      `;
    } catch (error) {
      return '';
    }
  }
  // —— B:23488-23498
  function buildSkillDesignerCompactSummary(draft = {}) {
    return [
      buildSkillDesignerFusionSummary(draft),
      构建技能设计台原型摘要(draft),
      buildSkillDesignerExecutionSummary(draft),
      buildSkillDesignerArtProgressSummary(draft),
      buildSkillDesignerAttributeSummary(draft),
    ]
      .filter(Boolean)
      .join(' ｜ ');
  }
  // —— B:23500-23514
  function 构建技能设计台当前翻译摘要(draft = {}, previewMeta = {}, 根数据 = {}) {
    const 正式翻译器 = 读取正式技能结构翻译器();
    const { 临时技能, 规范化草稿 } = 构建技能设计台临时技能(draft, previewMeta);
    if (typeof 正式翻译器 !== 'function') return buildSkillDesignerCompactSummary(规范化草稿);
    const 计算预算 = 读取窗口函数('__LWCS_CALC_DIRECT_SETTLE_BUDGET__');
    const 预算 = typeof 计算预算 === 'function'
      ? 计算预算(临时技能, 构建技能设计台预算上下文(previewMeta, 根数据, 规范化草稿))
      : null;
    const 翻译文本 = normalizeSkillUiText(正式翻译器(临时技能, { 预算 }), '') || buildSkillDesignerCompactSummary(规范化草稿);
    const 运行态消耗 = 构建技能设计台运行态消耗展示(临时技能['消耗'], 临时技能['_效果数组'], previewMeta, 临时技能);
    const 原消耗展示 = 格式化技能消耗显示文本_桥接(临时技能['消耗'], '无');
    return 运行态消耗 !== 原消耗展示
      ? 翻译文本.replace(`消耗:${原消耗展示}`, `消耗:${运行态消耗}`).replace(`消耗:${String({})}`, `消耗:${运行态消耗}`)
      : 翻译文本;
  }
  // —— B:23539-23545
  function 读取技能设计台天赋训练系数(天赋梯队 = '正常') {
    return (
      { 绝世妖孽: 1.6, 顶级天才: 1.2, 天才: 1, 优秀: 0.8, 正常: 0.5, 劣等: 0.2, 天赋极差: 0 }[
        String(天赋梯队 || '').trim()
      ] ?? 0.5
    );
  }
  // —— B:23547-23550
  function 读取技能设计台精神训练系数(天赋梯队 = '正常') {
    const 梯队 = String(天赋梯队 || '').trim();
    return 梯队 === '绝世妖孽' ? 2.0 : 读取技能设计台天赋训练系数(梯队);
  }
  // —— B:23552-23611
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
      // 与 MVU_Skill_Runtime TypeMultipliers 同步（11-14 辅助、治疗、食物系 敏捷 0.6、防御 0.45）。
      辅助系: { sp_max: 1, men_max: 1.2, str: 0.7, def: 0.45, agi: 0.6, vit_max: 0.7 },
      治疗系: { sp_max: 1, men_max: 1.2, str: 0.7, def: 0.45, agi: 0.6, vit_max: 0.7 },
      食物系: { sp_max: 1, men_max: 1.2, str: 0.7, def: 0.45, agi: 0.6, vit_max: 0.7 },
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
  // —— B:23648-23670
  function 构建技能设计台角色战斗属性(角色键 = '', 角色数据 = {}, 默认系别 = '强攻系') {
    const 来源 = 角色数据 && typeof 角色数据 === 'object' ? (角色数据['属性'] || 角色数据) : {};
    const 属性 = {
      name: getSkillDesignerCharDisplayName(角色键, 角色数据),
      type: normalizeSkillUiText(来源.系别 || 角色数据?.type, 默认系别 || '强攻系'),
      lv: Math.max(1, Number(来源.等级 || 角色数据?.lv || 角色数据?.等级 || 1)),
      等级: Math.max(1, Number(来源.等级 || 角色数据?.lv || 角色数据?.等级 || 1)),
      str: Math.max(1, Number(来源.力量 || 来源.str || 1)),
      def: Math.max(1, Number(来源.防御 || 来源.def || 1)),
      agi: Math.max(1, Number(来源.敏捷 || 来源.agi || 1)),
      vit_max: Math.max(1, Number(来源.体力上限 || 来源.HP上限 || 来源.hp_max || 来源.vit_max || 1)),
      sp_max: Math.max(1, Number(来源.魂力上限 || 来源.sp_max || 1)),
      men_max: Math.max(1, Number(来源.精神力上限 || 来源.men_max || 1)),
      属性: { 天赋梯队: String(来源.天赋梯队 || 角色数据?.属性?.天赋梯队 || 角色数据?.天赋梯队 || '正常').trim() || '正常' },
    };
    属性.sp = Math.max(0, Math.min(属性.sp_max, Number(来源.魂力 ?? 来源.sp ?? 属性.sp_max)));
    属性.men = Math.max(0, Math.min(属性.men_max, Number(来源.精神力 ?? 来源.men ?? 属性.men_max)));
    属性.hp_max = 属性.vit_max;
    属性.HP上限 = 属性.vit_max;
    属性.HP = Math.max(0, Math.min(属性.vit_max, Number(来源.HP ?? 来源.体力 ?? 来源.hp ?? 属性.vit_max)));
    属性.final = { ...属性 };
    return 属性;
  }
  // —— B:23672-23676
  function 推断技能设计台魂环位(previewMeta = {}) {
    const path = Array.isArray(previewMeta && previewMeta.path) ? previewMeta.path : [];
    const 槽位 = path.find(片段 => 是魂环槽位键_桥接(片段) || 是气血魂环槽位键_桥接(片段)) || previewMeta?.label || '';
    return Math.max(1, 读取槽位序号_桥接(槽位, 1));
  }
  // —— B:23678-23684
  function 读取技能设计台魂环数据(previewMeta = {}, 根数据 = {}) {
    const path = Array.isArray(previewMeta && previewMeta.path) ? previewMeta.path : [];
    const 环位索引 = path.findIndex(片段 => 是魂环槽位键_桥接(片段) || 是气血魂环槽位键_桥接(片段));
    if (环位索引 < 0) return null;
    const 魂环数据 = deepGet(根数据, path.slice(0, 环位索引 + 1), null);
    return 魂环数据 && typeof 魂环数据 === 'object' && !Array.isArray(魂环数据) ? 魂环数据 : null;
  }
  // —— B:23686-23747
  function 构建技能设计台预算上下文(previewMeta = {}, 根数据 = {}, 草稿 = {}) {
    const 范围 = normalizeSkillUiText(previewMeta && previewMeta.scope, '');
    const 分类 = normalizeSkillUiText(previewMeta && previewMeta.category, '');
    const { charKey: 角色键, charData: 角色数据 } = getSkillDesignerCharByPreviewPath(根数据, previewMeta);
    const 魂环位 = 推断技能设计台魂环位(previewMeta);
    const 魂环数据 = 读取技能设计台魂环数据(previewMeta, 根数据);
    const 角色属性 = 角色数据 && Object.keys(角色数据).length
      ? 构建技能设计台角色战斗属性(角色键, 角色数据, normalizeSkillUiText(草稿 && 草稿.type, '强攻系'))
      : 构建技能设计台标准战斗属性(草稿?.level || 草稿?.lv || 50, 草稿?.type || '强攻系');
    const 路径 = Array.isArray(previewMeta && previewMeta.path) ? previewMeta.path : [];
    const 武魂索引 = 路径.findIndex(片段 => ['第1武魂', '第2武魂'].includes(normalizeSkillUiText(片段, '')));
    const 武魂数据 = 武魂索引 >= 0 ? deepGet(根数据, 路径.slice(0, 武魂索引 + 1), {}) : {};
    const 武魂元素上下文 = 读取技能设计台武魂上下文(根数据, previewMeta);
    const 预算系别 = normalizeSkillUiText(
      武魂数据?.系别 ||
        武魂数据?.type ||
        草稿?.type ||
        角色属性?.系别 ||
        角色属性?.type ||
        取角色主武魂系别_桥接(角色数据) ||
        '强攻系',
      '强攻系',
    );
    let 来源类别 = '魂技';
    let 预算角色 = 角色属性;
    if (['魂技', 'independent_ring_skill'].includes(范围)) {
      来源类别 = '魂技';
      预算角色 = 构建技能设计台标准战斗属性(10 * Math.min(9, 魂环位) + 1, 角色属性.type || 草稿?.type || '强攻系', {
        天赋梯队: 角色属性?.属性?.天赋梯队 || 角色数据?.属性?.天赋梯队 || 角色数据?.天赋梯队 || '正常',
      });
    } else if (范围 === 'blood_ring_skill') {
      来源类别 = '气血魂技';
    } else if (范围 === 'blood_skill' || 范围 === 'blood_passive') {
      来源类别 = '血脉技能';
    } else if (范围 === '自创魂技') {
      来源类别 = '自创魂技';
    } else if (范围 === '武魂融合技') {
      来源类别 = '武魂融合技';
    } else if (范围 === 'soul_bone_skill') {
      来源类别 = '魂骨技能';
    } else if (范围 === 'art') {
      来源类别 = '精神领域';
    } else if (分类.includes('装备')) {
      来源类别 = '装备技能';
    } else if (分类.includes('物品')) {
      来源类别 = '物品技能';
    }
    return {
      角色: 预算角色,
      施术者: 预算角色,
      来源类别,
      系别: 预算系别,
      武魂系别: 预算系别,
      可调用元素: 武魂元素上下文.可调用元素,
      callableElements: 武魂元素上下文.可调用元素,
      魂环位,
      魂环数据,
      ringAge: 魂环数据?.年限,
      ringColor: 魂环数据?.颜色,
      融合记录: 范围 === '武魂融合技' ? getSkillDesignerFusionRecord(根数据, previewMeta) : undefined,
    };
  }
  // —— B:23749-23757
  function 读取技能设计台伤害效果列表(effectArray = []) {
    return (Array.isArray(effectArray) ? effectArray : []).filter(
      effect =>
        effect &&
        typeof effect === 'object' &&
        toText(effect['原型'], '').trim() === '伤害结算' &&
        (Number(effect['威力倍率'] || 0) > 0 || normalizeSkillUiText(effect['数值'], '')),
    );
  }
  // —— B:23763-23771
  function 技能设计台是普通魂环伤害魂技(previewMeta = {}, effectArray = [], skill = {}) {
    const 范围 = normalizeSkillUiText(previewMeta && previewMeta.scope, '');
    if (!['魂技', 'independent_ring_skill'].includes(范围)) return false;
    const 魂环位 = 推断技能设计台魂环位(previewMeta);
    if (!(魂环位 > 0) || 魂环位 === 7) return false;
    const 名称文本 = `${skill?.魂技名 || ''}${skill?.name || ''}${skill?.技能名称 || ''}`;
    if (/武魂真身|真身/.test(名称文本)) return false;
    return 读取技能设计台伤害效果列表(effectArray).length > 0;
  }
  // —— B:23773-23778
  function 构建技能设计台运行态消耗展示(基础消耗 = '', effectArray = [], previewMeta = {}, skill = {}) {
    void effectArray;
    void previewMeta;
    void skill;
    return 格式化技能消耗显示文本_桥接(基础消耗, '无');
  }
  // —— B:23912-23918
  function 计算技能设计台固定结算消耗比例(draft = {}) {
    const effects = buildSkillDesignerRuntimeEffects(buildSkillDesignerFormStateFromDraft(draft, {}), {}, {});
    if (!effects.some(effect => normalizeSkillUiText(effect && effect['原型'], '') === '伤害结算')) return 0;
    const ringIndex = Math.max(1, Math.min(9, Math.floor(Number(draft.ringIndex || draft.ring || 1) || 1)));
    if (ringIndex === 7) return 0;
    return Math.max(0, Math.min(0.27, ringIndex * 0.03));
  }
  // —— B:24169-24171
  function getSkillDesignerChildMechanicOptions(primaryMain = '') {
    return SKILL_DESIGNER_MAIN_MECHANIC_POOL[normalizeSkillUiText(primaryMain, '')] || [];
  }
  // —— B:24173-24175
  function getSkillDesignerDeliveryOptions(type = '') {
    return SKILL_DESIGNER_DELIVERY_FORM_BY_TYPE[normalizeSkillUiText(type, '')] || SKILL_DESIGNER_DELIVERY_FORM_POOL;
  }
  // —— B:24177-24179
  function getSkillDesignerSecondaryOptions(primaryMain = '') {
    return SKILL_DESIGNER_SECONDARY_BY_MAIN[normalizeSkillUiText(primaryMain, '')] || [];
  }
  // —— B:24181-24186
  function getSkillDesignerRecommendedSecondaryOptions(primaryMain = '', type = '') {
    return normalizeSkillDesignerArray([
      ...getSkillDesignerSecondaryOptions(primaryMain),
      ...(SKILL_DESIGNER_SECONDARY_TYPE_BIAS[normalizeSkillUiText(type, '')] || []),
    ]);
  }
  // —— B:24194-24206
  function normalizeSkillDesignerSecondarySelection(primaryMain = '', values = [], type = '', primarySub = '') {
    const knownSet = new Set([
      ...SKILL_DESIGNER_ALL_SECONDARY_OPTIONS,
      ...getSkillDesignerRecommendedSecondaryOptions(primaryMain, type),
    ]);
    const primarySubLabel = normalizeSkillUiText(primarySub, '');
    return normalizeSkillDesignerArray(values).filter(label => {
      if (primarySubLabel && label === primarySubLabel) return false;
      if (!knownSet.has(label)) return false;
      const meta = getSkillDesignerMechanismRegistryMeta(label);
      return !meta || meta.可副机制 === true || normalizeSkillUiText(meta.designerSecondaryHint, '') === label;
    });
  }
  // —— B:24219-24233
  function normalizeSkillDesignerOptionList(选项列表 = []) {
    const 原始选项列表 = Array.isArray(选项列表) ? 选项列表 : [];
    return 原始选项列表.flatMap(选项 => {
      if (选项 && typeof 选项 === 'object' && Array.isArray(选项.options)) {
        return normalizeSkillDesignerOptionList(选项.options);
      }
      if (选项 && typeof 选项 === 'object') {
        const 值 = toText(选项.value ?? 选项.label, '').trim();
        const 标签 = toText(选项.label ?? 选项.value, 值).trim();
        return 值 ? [{ value: 值, label: 标签 || 值 }] : [];
      }
      const 值 = toText(选项, '').trim();
      return 值 ? [{ value: 值, label: 值 }] : [];
    });
  }
  // —— B:24235-24246
  function normalizeSkillDesignerOptionEntries(选项列表 = []) {
    const 原始选项列表 = Array.isArray(选项列表) ? 选项列表 : [];
    return 原始选项列表.flatMap(选项 => {
      if (选项 && typeof 选项 === 'object' && Array.isArray(选项.options)) {
        const 标签 = toText(选项.label, '').trim();
        const 子选项 = normalizeSkillDesignerOptionList(选项.options);
        return 标签 && 子选项.length ? [{ type: 'group', label: 标签, options: 子选项 }] : 子选项;
      }
      const 普通选项 = normalizeSkillDesignerOptionList([选项]);
      return 普通选项.map(item => ({ type: 'option', ...item }));
    });
  }
  // —— B:24248-24251
  function getSkillDesignerFirstOptionValue(选项列表 = [], 回退值 = '') {
    const 首项 = normalizeSkillDesignerOptionList(选项列表)[0] || null;
    return 首项 ? 首项.value : normalizeSkillUiText(回退值, '');
  }
  // —— B:24253-24260
  function normalizeSkillDesignerSelectValue(当前值 = '', 选项列表 = [], 回退值 = '') {
    const 规范选项列表 = normalizeSkillDesignerOptionList(选项列表);
    const 原始值 = toText(当前值, '').trim();
    if (原始值 && 规范选项列表.some(选项 => 选项.value === 原始值)) return 原始值;
    const 选中值 = normalizeSkillUiText(原始值, '');
    if (选中值 && 规范选项列表.some(选项 => 选项.value === 选中值)) return 选中值;
    return 规范选项列表[0] ? 规范选项列表[0].value : normalizeSkillUiText(回退值, '');
  }
  // —— B:24262-24309
  function buildSkillDesignerSelectOptions(选项列表 = [], 当前值 = '', 空状态文本 = '') {
    const 规范条目列表 = normalizeSkillDesignerOptionEntries(选项列表);
    const 规范选项列表 = normalizeSkillDesignerOptionList(选项列表);
    const 不允许空值 = 规范选项列表.length > 0 && 规范选项列表.every(选项 => 选项.value !== '无');
    if (!规范选项列表.length) {
      const 空文本 =
        normalizeSkillUiText(空状态文本, '') && !/未设置/.test(normalizeSkillUiText(空状态文本, ''))
          ? normalizeSkillUiText(空状态文本, '')
          : '暂无可选';
      return `<option value=\"\" selected disabled>${htmlEscape(空文本)}</option>`;
    }
    const 输出选项列表 = [];
    const 输出条目列表 = [];
    const 已见 = new Set();
    const 加入选项 = 选项 => {
      if (已见.has(选项.value)) return;
      已见.add(选项.value);
      输出选项列表.push(选项);
      return 选项;
    };
    规范条目列表.forEach(条目 => {
      if (条目.type === 'group') {
        const 组选项 = 条目.options.map(加入选项).filter(Boolean);
        if (组选项.length) 输出条目列表.push({ ...条目, options: 组选项 });
        return;
      }
      const 选项 = 加入选项(条目);
      if (选项) 输出条目列表.push({ type: 'option', ...选项 });
    });
    const 当前文本 = toText(当前值, '').trim();
    const 选中值 = 输出选项列表.some(选项 => 选项.value === 当前文本)
      ? toText(当前值, '').trim()
      : 不允许空值 && 当前文本 === '无'
        ? 输出选项列表[0].value
      : 输出选项列表[0].value;
    const 构建选项 = 选项 => {
      const 安全值 = toText(选项.value, '');
      const 标签 = toText(选项.label, 安全值);
      return `<option value=\"${escapeHtmlAttr(安全值)}\"${安全值 === 选中值 ? ' selected' : ''}>${htmlEscape(标签)}</option>`;
    };
    return 输出条目列表
      .map(条目 => {
        if (条目.type !== 'group') return 构建选项(条目);
        const 选项文本 = 条目.options.map(构建选项).join('');
        return `<optgroup label=\"${escapeHtmlAttr(条目.label)}\">${选项文本}</optgroup>`;
      })
      .join('');
  }
  // —— B:24311-24325
  function 构建技能设计台条件类型分组选项(当前值 = '') {
    const 选中值 = SKILL_DESIGNER_CONDITION_BRANCH_TYPE_OPTIONS.includes(toText(当前值, '').trim())
      ? toText(当前值, '').trim()
      : SKILL_DESIGNER_CONDITION_BRANCH_TYPE_OPTIONS[0];
    return SKILL_DESIGNER_CONDITION_BRANCH_TYPE_GROUPS
      .map(分组 => {
        const 选项文本 = 分组.options
          .filter(选项 => SKILL_DESIGNER_CONDITION_BRANCH_TYPE_OPTIONS.includes(选项))
          .map(选项 => `<option value=\"${escapeHtmlAttr(选项)}\"${选项 === 选中值 ? ' selected' : ''}>${htmlEscape(选项)}</option>`)
          .join('');
        if (!选项文本) return '';
        return `<optgroup label=\"${escapeHtmlAttr(分组.label)}\">${选项文本}</optgroup>`;
      })
      .join('');
  }
  // —— B:24327-24347
  function buildSkillDesignerCheckChipList(
    options = [],
    selectedValues = [],
    inputName = '',
    extraClassResolver = null,
  ) {
    const selectedSet = new Set(normalizeSkillDesignerArray(selectedValues));
    return (Array.isArray(options) ? options : [])
      .map(option => {
        const label = toText(option, '').trim();
        if (!label) return '';
        const extraClass = typeof extraClassResolver === 'function' ? toText(extraClassResolver(label), '') : '';
        return `
          <label class=\"skill-designer-check-chip ${selectedSet.has(label) ? 'active' : ''} ${extraClass}\">
            <input type=\"checkbox\" name=\"${escapeHtmlAttr(inputName)}\" value=\"${escapeHtmlAttr(label)}\"${selectedSet.has(label) ? ' checked' : ''} />
            <span>${htmlEscape(label)}</span>
          </label>
        `;
      })
      .join('');
  }
  // —— B:24349-24354
  function normalizeSkillDesignerFusionMode(value = '') {
    const raw = normalizeSkillUiText(value, '').trim();
    if (!raw) return 'partner';
    if (raw === 'self' || /自体|自身|自己|双生|双武魂/.test(raw)) return 'self';
    return 'partner';
  }
  // —— B:24356-24360
  function 规范化技能设计台融合用法模式(value = '') {
    const raw = normalizeSkillUiText(value, '').trim();
    if (/增幅|共享|持续/.test(raw)) return '融合增幅';
    return '一次性释放';
  }
  // —— B:24362-24365
  function formatSkillDesignerFusionModeLabel(mode = '', participants = []) {
    if (normalizeSkillDesignerFusionMode(mode) === 'self') return '自体融合';
    return normalizeSkillDesignerFusionParticipantList(participants).length > 2 ? '多人融合' : '双人融合';
  }
  // —— B:24367-24373
  function resolveSkillDesignerSpiritDisplayName(slotName = '', spiritData = {}) {
    const safeSpirit = spiritData && typeof spiritData === 'object' ? spiritData : {};
    return normalizeSkillUiText(
      safeSpirit['表象名称'] || safeSpirit.name || safeSpirit.type || slotName,
      slotName || '武魂',
    );
  }
  // —— B:24375-24381
  function getSkillDesignerSpiritNameOptions(charData = {}) {
    const names = 取角色武魂条目_桥接(charData)
      .map(([slotName, spiritData]) => resolveSkillDesignerSpiritDisplayName(slotName, spiritData))
      .map(name => normalizeSkillUiText(name, '').trim())
      .filter(name => name && !/^(未设置|未知|无)$/.test(name));
    return Array.from(new Set(names));
  }
  // —— B:24383-24388
  function getSkillDesignerCharDisplayName(charKey = '', charData = {}) {
    return normalizeSkillUiText(
      charData && (charData.name || deepGet(charData, 'base.name', '')),
      charKey || '未命名角色',
    );
  }
  // —— B:24390-24397
  function getSkillDesignerCharByPreviewPath(rootData = {}, previewMeta = {}) {
    const path = Array.isArray(previewMeta && previewMeta.path) ? previewMeta.path : [];
    const charKey = path[0] === 'char' ? toText(path[1], '').trim() : '';
    return {
      charKey,
      charData: charKey ? deepGet(rootData, ['char', charKey], {}) : {},
    };
  }
  // —— B:24399-24411
  function 读取技能设计台武魂上下文(rootData = {}, previewMeta = {}) {
    const path = Array.isArray(previewMeta && previewMeta.path) ? previewMeta.path : [];
    const 武魂索引 = path.findIndex(片段 => ['第1武魂', '第2武魂'].includes(normalizeSkillUiText(片段, '')));
    const 武魂数据 = 武魂索引 >= 0 ? deepGet(rootData, path.slice(0, 武魂索引 + 1), {}) : {};
    const 属性体系 = normalizeSkillUiText(武魂数据 && 武魂数据['属性体系'], '无');
    const 可调用元素 = 规范化技能元素列表_桥接(武魂数据 && 武魂数据['可调用元素']);
    return {
      武魂数据,
      系别: normalizeSkillUiText(武魂数据 && 武魂数据['系别'], ''),
      属性体系,
      可调用元素: 属性体系 === '五行' && !可调用元素.length ? [...WUXING_ATTRIBUTE_TOKEN_OPTIONS] : 可调用元素,
    };
  }
  // —— B:24413-24417
  function 技能设计台是元素系上下文(rootData = {}, previewMeta = {}, 草稿 = {}) {
    const 武魂上下文 = 读取技能设计台武魂上下文(rootData, previewMeta);
    const 系别文本 = [武魂上下文.系别, 草稿 && 草稿.type, 武魂上下文.属性体系].map(item => normalizeSkillUiText(item, '')).join('/');
    return /元素系|元素|五行/.test(系别文本);
  }
  // —— B:24419-24436
  function 收口技能设计台元素字段(效果数组 = [], 可调用元素 = []) {
    const 默认元素 = 规范化技能元素列表_桥接(可调用元素);
    const 访问 = 效果 => {
      if (!效果 || typeof 效果 !== 'object' || Array.isArray(效果)) return;
      if (效果['限定元素'] !== undefined) {
        const 限定元素列表 = 读取技能设计台限定元素列表(效果['限定元素']).filter(元素 => SPIRIT_ATTRIBUTE_TOKEN_OPTIONS.includes(元素));
        const 限定交集 = 默认元素.length ? 限定元素列表.filter(元素 => 默认元素.includes(元素)) : 限定元素列表;
        const 生效元素 = 限定交集.length ? 限定交集 : 默认元素;
        if (生效元素.length) 效果['限定元素'] = 生效元素.length > 1 ? 生效元素 : 生效元素[0];
      }
      技能设计台嵌套效果数组字段表.forEach(字段名 => (Array.isArray(效果[字段名]) ? 效果[字段名] : []).forEach(访问));
      (Array.isArray(效果['条件分支']) ? 效果['条件分支'] : []).forEach(分支 =>
        技能设计台条件分支效果数组字段表.forEach(字段名 => (Array.isArray(分支 && 分支[字段名]) ? 分支[字段名] : []).forEach(访问)),
      );
    };
    (Array.isArray(效果数组) ? 效果数组 : []).forEach(访问);
    return 效果数组;
  }
  // —— B:24438-24451
  function 技能设计台效果列表包含本命召唤(效果数组 = []) {
    const 访问 = 效果 => {
      if (!效果 || typeof 效果 !== 'object' || Array.isArray(效果)) return false;
      if (
        normalizeSkillUiText(效果['原型'], '') === '召唤生成' &&
        normalizeSkillUiText(效果['召唤单位类型'], '') === '本命召唤兽'
      ) return true;
      if (技能设计台嵌套效果数组字段表.some(字段名 => (Array.isArray(效果[字段名]) ? 效果[字段名] : []).some(访问))) return true;
      return (Array.isArray(效果['条件分支']) ? 效果['条件分支'] : []).some(分支 =>
        技能设计台条件分支效果数组字段表.some(字段名 => (Array.isArray(分支 && 分支[字段名]) ? 分支[字段名] : []).some(访问)),
      );
    };
    return (Array.isArray(效果数组) ? 效果数组 : []).some(访问);
  }
  // —— B:24453-24479
  function 断言技能设计台本命召唤唯一(previewMeta = {}, nextSkill = {}, rootData = {}) {
    if (!技能设计台效果列表包含本命召唤(nextSkill && nextSkill['_效果数组'])) return;
    const { charKey, charData } = getSkillDesignerCharByPreviewPath(rootData, previewMeta);
    if (!charData || typeof charData !== 'object') return;
    const 预览路径 = Array.isArray(previewMeta && previewMeta.path) ? previewMeta.path : [];
    const 当前路径 = JSON.stringify(预览路径);
    const 冲突路径列表 = [];
    const 扫描 = (节点, 路径) => {
      if (!节点 || typeof 节点 !== 'object') return;
      if (
        !Array.isArray(节点) &&
        Array.isArray(节点['_效果数组']) &&
        JSON.stringify(['char', charKey, ...路径]) !== 当前路径 &&
        技能设计台效果列表包含本命召唤(节点['_效果数组'])
      ) {
        冲突路径列表.push(路径.join('.'));
        return;
      }
      Object.entries(节点).forEach(([键, 值]) => {
        if (键 === '_效果数组') return;
        扫描(值, [...路径, 键]);
      });
    };
    扫描(charData, []);
    if (冲突路径列表.length)
      throw new Error(`本命召唤兽已存在：${冲突路径列表[0]}。同一角色全技能只能有一个本命召唤兽生成效果。`);
  }
  // —— B:24481-24487
  function getSkillDesignerFusionRecord(rootData = {}, previewMeta = {}) {
    const path = Array.isArray(previewMeta && previewMeta.path) ? previewMeta.path : [];
    if (toText(previewMeta && previewMeta.scope, '') !== '武魂融合技') return {};
    if (toText(path[path.length - 1], '') !== '技能数据') return {};
    const record = deepGet(rootData, path.slice(0, -1), {});
    return record && typeof record === 'object' ? record : {};
  }
  // —— B:24489-24498
  function findSkillDesignerCharKeyByName(rootData = {}, rawName = '') {
    const target = normalizeSkillUiText(rawName, '').trim();
    if (!target) return '';
    const charRoot = deepGet(rootData, 'char', {});
    if (charRoot && Object.prototype.hasOwnProperty.call(charRoot, target)) return target;
    const match = safeEntries(charRoot).find(
      ([key, charData]) => getSkillDesignerCharDisplayName(key, charData) === target,
    );
    return match ? match[0] : '';
  }
  // —— B:24500-24509
  function getSkillDesignerFusionSelfEntry(rootData = {}, previewMeta = {}, snapshot = {}) {
    const { charKey, charData } = getSkillDesignerCharByPreviewPath(rootData, previewMeta);
    const fallbackName = normalizeSkillUiText(snapshot && snapshot.activeName, charKey || '当前角色');
    return {
      charKey,
      charName: getSkillDesignerCharDisplayName(charKey, charData) || fallbackName,
      charData,
      spirits: getSkillDesignerSpiritNameOptions(charData),
    };
  }
  // —— B:24511-24530
  function getSkillDesignerFusionCharOptions(rootData = {}, previewMeta = {}, extraParticipants = []) {
    const selfEntry = getSkillDesignerFusionSelfEntry(rootData, previewMeta);
    const charOptions = safeEntries(deepGet(rootData, 'char', {}))
      .map(([key, charData]) => ({
        value: key,
        label: getSkillDesignerCharDisplayName(key, charData),
      }))
      .filter(option => option.value && option.label && option.value !== selfEntry.charKey);
    normalizeSkillDesignerFusionParticipantList(extraParticipants).forEach(participant => {
      if (
        participant.charKey &&
        participant.charName &&
        participant.charKey !== selfEntry.charKey &&
        !charOptions.some(option => option.value === participant.charKey)
      ) {
        charOptions.unshift({ value: participant.charKey, label: participant.charName });
      }
    });
    return charOptions;
  }
  // —— B:24532-24534
  function getSkillDesignerFusionCharData(rootData = {}, charKey = '') {
    return charKey ? deepGet(rootData, ['char', charKey], {}) : {};
  }
  // —— B:24536-24541
  function getSkillDesignerFusionSpiritOptions(rootData = {}, charKey = '', fallbackSpirit = '') {
    const options = getSkillDesignerSpiritNameOptions(getSkillDesignerFusionCharData(rootData, charKey));
    const fallback = normalizeSkillUiText(fallbackSpirit, '');
    if (fallback && !options.includes(fallback)) options.unshift(fallback);
    return options;
  }
  // —— B:24543-24548
  function resolveSkillDesignerFusionSpirit(rootData = {}, charKey = '', currentSpirit = '') {
    const spiritOptions = getSkillDesignerSpiritNameOptions(getSkillDesignerFusionCharData(rootData, charKey));
    const current = normalizeSkillUiText(currentSpirit, '');
    if (current && spiritOptions.includes(current)) return current;
    return spiritOptions[0] || current;
  }
  // —— B:24550-24578
  function normalizeSkillDesignerFusionParticipant(participant = {}, rootData = {}) {
    const raw = participant && typeof participant === 'object' ? participant : {};
    const roleText = normalizeSkillUiText(raw.role || raw['类型'] || raw['身份'], '');
    const role = roleText === 'self' || /自身|自体|自己|本体/.test(roleText) ? 'self' : 'partner';
    const rawCharName = normalizeSkillUiText(
      raw.charName || raw.char_name || raw.name || raw['角色'] || raw['角色名'],
      '',
    );
    let charKey = normalizeSkillUiText(raw.charKey || raw.char_key || raw.key || raw['角色键'] || raw['角色key'], '');
    if (!charKey && rawCharName) charKey = findSkillDesignerCharKeyByName(rootData, rawCharName);
    const charData = getSkillDesignerFusionCharData(rootData, charKey);
    const charName = getSkillDesignerCharDisplayName(charKey, charData) || rawCharName || charKey;
    const spirit = normalizeSkillUiText(
      raw.spirit ||
        raw.spiritName ||
        raw.spirit_name ||
        raw.sourceSpirit ||
        raw.source_spirit ||
        raw['武魂'] ||
        raw['来源武魂'],
      '',
    );
    return {
      role,
      charKey,
      charName,
      spirit,
    };
  }
  // —— B:24580-24585
  function normalizeSkillDesignerFusionParticipantList(participants = [], rootData = {}) {
    if (!Array.isArray(participants)) return [];
    return participants
      .map(participant => normalizeSkillDesignerFusionParticipant(participant, rootData))
      .filter(participant => participant.charKey || participant.charName || participant.spirit);
  }
  // —— B:24587-24594
  function getSkillDesignerRawFusionParticipants(draft = {}, fusionRecord = {}) {
    const safeDraft = draft && typeof draft === 'object' ? draft : {};
    const safeRecord = fusionRecord && typeof fusionRecord === 'object' ? fusionRecord : {};
    const raw = [safeDraft.fusionParticipants, safeDraft['融合参与者'], safeRecord['融合参与者']].find(
      candidate => Array.isArray(candidate) && candidate.length,
    );
    return Array.isArray(raw) ? raw : [];
  }
  // —— B:24596-24603
  function parseSkillDesignerFusionPartnerNames(value = '') {
    const raw = normalizeSkillUiText(value, '');
    if (!raw || raw === SKILL_DESIGNER_SELF_FUSION_PARTNER) return [];
    return raw
      .split(/[、,，+\/|｜；;]/)
      .map(item => normalizeSkillUiText(item, '').trim())
      .filter(Boolean);
  }
  // —— B:24605-24612
  function createSkillDesignerFusionParticipant(role = 'partner', charKey = '', charName = '', spirit = '') {
    return {
      role: role === 'self' ? 'self' : 'partner',
      charKey: normalizeSkillUiText(charKey, ''),
      charName: normalizeSkillUiText(charName, ''),
      spirit: normalizeSkillUiText(spirit, ''),
    };
  }
  // —— B:24614-24620
  function createSkillDesignerDefaultPartnerParticipant(rootData = {}, previewMeta = {}, usedCharKeys = []) {
    const used = new Set(normalizeSkillDesignerArray(usedCharKeys));
    const options = getSkillDesignerFusionCharOptions(rootData, previewMeta);
    const option = options.find(item => !used.has(item.value)) || options[0] || { value: '', label: '' };
    const spiritOptions = getSkillDesignerFusionSpiritOptions(rootData, option.value);
    return createSkillDesignerFusionParticipant('partner', option.value, option.label, spiritOptions[0] || '');
  }
  // —— B:24622-24734
  function buildSkillDesignerFusionParticipants(snapshot = {}, previewMeta = {}, baseDraft = {}, fusionRecord = {}) {
    if (toText(previewMeta && previewMeta.scope, '') !== '武魂融合技') return [];
    const rootData = snapshot && snapshot.rootData ? snapshot.rootData : {};
    const selfEntry = getSkillDesignerFusionSelfEntry(rootData, previewMeta, snapshot);
    const selfSpiritOptions = selfEntry.spirits;
    let fusionMode = normalizeSkillDesignerFusionMode(
      baseDraft.fusionMode || baseDraft['融合模式'] || fusionRecord.融合模式 || '',
    );
    if (fusionMode === 'self' && selfSpiritOptions.length < 2) fusionMode = 'partner';
    const rawParticipants = getSkillDesignerRawFusionParticipants(baseDraft, fusionRecord);
    let participants = normalizeSkillDesignerFusionParticipantList(rawParticipants, rootData);
    if (!participants.length) {
      const sourceSpirits = normalizeSkillDesignerArray(
        baseDraft.fusionSourceSpirits || baseDraft['来源武魂'] || fusionRecord.来源武魂,
      );
      if (fusionMode === 'self') {
        participants = [
          createSkillDesignerFusionParticipant(
            'self',
            selfEntry.charKey,
            selfEntry.charName,
            sourceSpirits[0] || selfSpiritOptions[0] || '',
          ),
          createSkillDesignerFusionParticipant(
            'self',
            selfEntry.charKey,
            selfEntry.charName,
            sourceSpirits[1] || selfSpiritOptions[1] || selfSpiritOptions[0] || '',
          ),
        ];
      } else {
        const partnerNames = parseSkillDesignerFusionPartnerNames(
          baseDraft.fusionPartner || baseDraft['融合对象'] || fusionRecord['融合对象'] || '',
        );
        participants = [
          createSkillDesignerFusionParticipant(
            'self',
            selfEntry.charKey,
            selfEntry.charName,
            sourceSpirits[0] || selfSpiritOptions[0] || '',
          ),
        ];
        partnerNames.forEach((name, index) => {
          const charKey = findSkillDesignerCharKeyByName(rootData, name);
          const charName = charKey
            ? getSkillDesignerCharDisplayName(charKey, getSkillDesignerFusionCharData(rootData, charKey))
            : name;
          const spiritOptions = getSkillDesignerFusionSpiritOptions(rootData, charKey);
          participants.push(
            createSkillDesignerFusionParticipant(
              'partner',
              charKey,
              charName,
              sourceSpirits[index + 1] || spiritOptions[0] || '',
            ),
          );
        });
        if (participants.length < 2) {
          participants.push(
            createSkillDesignerDefaultPartnerParticipant(
              rootData,
              previewMeta,
              participants.map(item => item.charKey),
            ),
          );
        }
      }
    }
    if (fusionMode === 'self') {
      const selfRows = participants.filter(participant => participant.role === 'self');
      const firstSpirit = resolveSkillDesignerFusionSpirit(
        rootData,
        selfEntry.charKey,
        selfRows[0] && selfRows[0].spirit ? selfRows[0].spirit : selfSpiritOptions[0] || '',
      );
      let secondSpirit = resolveSkillDesignerFusionSpirit(
        rootData,
        selfEntry.charKey,
        selfRows[1] && selfRows[1].spirit
          ? selfRows[1].spirit
          : selfSpiritOptions.find(name => name !== firstSpirit) || selfSpiritOptions[1] || firstSpirit,
      );
      if (selfSpiritOptions.length > 1 && secondSpirit === firstSpirit) {
        secondSpirit = selfSpiritOptions.find(name => name !== firstSpirit) || secondSpirit;
      }
      return [
        createSkillDesignerFusionParticipant('self', selfEntry.charKey, selfEntry.charName, firstSpirit),
        createSkillDesignerFusionParticipant('self', selfEntry.charKey, selfEntry.charName, secondSpirit),
      ];
    }
    const normalized = participants.map((participant, index) => {
      if (index === 0 || participant.role === 'self') {
        const spirit = resolveSkillDesignerFusionSpirit(rootData, selfEntry.charKey, participant.spirit);
        return createSkillDesignerFusionParticipant('self', selfEntry.charKey, selfEntry.charName, spirit);
      }
      const charKey = participant.charKey || findSkillDesignerCharKeyByName(rootData, participant.charName);
      const charName =
        getSkillDesignerCharDisplayName(charKey, getSkillDesignerFusionCharData(rootData, charKey)) ||
        participant.charName;
      const spirit = resolveSkillDesignerFusionSpirit(rootData, charKey, participant.spirit);
      return createSkillDesignerFusionParticipant('partner', charKey, charName, spirit);
    });
    if (!normalized.some(participant => participant.role === 'partner')) {
      normalized.push(
        createSkillDesignerDefaultPartnerParticipant(
          rootData,
          previewMeta,
          normalized.map(item => item.charKey),
        ),
      );
    }
    return normalized;
  }
  // —— B:24736-24754
  function deriveSkillDesignerFusionFields(mode = '', participants = [], fallbackPartner = '') {
    const participantList = normalizeSkillDesignerFusionParticipantList(participants);
    const fusionMode = normalizeSkillDesignerFusionMode(mode);
    const partnerNames = participantList
      .filter(participant => participant.role !== 'self')
      .map(participant => participant.charName || participant.charKey)
      .filter(Boolean);
    return {
      fusionMode,
      fusionPartner:
        fusionMode === 'self'
          ? SKILL_DESIGNER_SELF_FUSION_PARTNER
          : partnerNames.length
            ? Array.from(new Set(partnerNames)).join('、')
            : normalizeSkillUiText(fallbackPartner, ''),
      fusionSourceSpirits: participantList.map(participant => participant.spirit).filter(Boolean),
      fusionParticipants: participantList,
    };
  }
  // —— B:24756-24759
  function isSkillDesignerFusionBlankText(value = '') {
    const text = normalizeSkillUiText(value, '').trim();
    return !text || /^(未设置|未知|无|未接入武魂)$/.test(text);
  }
  // —— B:24761-24787
  function assertSkillDesignerFusionState(draft = {}) {
    const fields = deriveSkillDesignerFusionFields(draft.fusionMode, draft.fusionParticipants, draft.fusionPartner);
    const participants = fields.fusionParticipants;
    const 用法模式 = 规范化技能设计台融合用法模式(draft['用法模式']);
    if (participants.length < 2) throw new Error('融合技至少需要两个参与武魂。');
    const incomplete = participants.some(
      participant =>
        (isSkillDesignerFusionBlankText(participant.charKey) && isSkillDesignerFusionBlankText(participant.charName)) ||
        isSkillDesignerFusionBlankText(participant.spirit),
    );
    if (incomplete) throw new Error('融合对象需要指定角色与武魂。');
    if (fields.fusionMode === 'self') {
      const spirits = participants
        .map(participant => participant.spirit)
        .filter(spirit => !isSkillDesignerFusionBlankText(spirit));
      if (new Set(spirits).size < 2) throw new Error('自体融合需要选择两个不同武魂。');
    }
    if (
      用法模式 === '融合增幅' &&
      (['伤害类', '控制类'].includes(normalizeSkillUiText(draft.primaryMain, '')) ||
        ['直接伤害', '单体伤害', '群体伤害', '多段伤害', '持续伤害', '硬控', '软控', '封技'].includes(
          normalizeSkillUiText(draft.primarySub, ''),
        ))
    )
      throw new Error('融合增幅模式不能混入一次性伤害或封控主机制。');
    return fields;
  }
  // —— B:24789-24836
  function buildSkillDesignerFusionParticipantRows(participants = [], rootData = {}, previewMeta = {}) {
    const participantList = normalizeSkillDesignerFusionParticipantList(participants, rootData);
    const mode = participantList.filter(participant => participant.role === 'partner').length ? 'partner' : 'self';
    const partnerCount = participantList.filter(participant => participant.role === 'partner').length;
    return participantList
      .map((participant, index) => {
        const isSelf = participant.role === 'self';
        const charOptions = isSelf
          ? [{ value: participant.charKey, label: participant.charName || participant.charKey || '当前角色' }]
          : getSkillDesignerFusionCharOptions(rootData, previewMeta, participantList);
        const spiritOptions = getSkillDesignerFusionSpiritOptions(rootData, participant.charKey, participant.spirit);
        const charLabel = participant.charName || participant.charKey || '未设置';
        return `
          <div class=\"skill-designer-fusion-participant-row\" data-fusion-participant-row>
            <input type=\"hidden\" value=\"${escapeHtmlAttr(participant.role)}\" data-skill-designer-fusion-role />
            <label class=\"mvu-editor-field skill-designer-fusion-char-field\">
              <span class=\"mvu-editor-label\">角色</span>
              ${
                isSelf
                  ? `
                  <div class=\"mvu-editor-static skill-designer-fusion-self-char\">${htmlEscape(charLabel)}</div>
                  <input type=\"hidden\" value=\"${escapeHtmlAttr(participant.charKey)}\" data-skill-designer-fusion-char data-skill-designer-fusion-char-name=\"${escapeHtmlAttr(charLabel)}\" />
                `
                  : `
                  <select class=\"mvu-editor-select\" data-skill-designer-fusion-char data-skill-designer-disableable>
                    ${buildSkillDesignerSelectOptions(charOptions, participant.charKey, '暂无对象')}
                  </select>
                `
              }
            </label>
            <label class=\"mvu-editor-field skill-designer-fusion-spirit-field\">
              <span class=\"mvu-editor-label\">武魂</span>
              <select class=\"mvu-editor-select\" data-skill-designer-fusion-spirit data-skill-designer-disableable>
                ${buildSkillDesignerSelectOptions(spiritOptions, participant.spirit, spiritOptions.length ? '' : '未接入武魂')}
              </select>
            </label>
            <div class=\"skill-designer-fusion-row-actions\">
              ${
                !isSelf && mode === 'partner' && partnerCount > 1
                  ? `<button type=\"button\" class=\"tag-chip\" data-skill-designer-remove-fusion-participant data-skill-designer-disableable>移除</button>`
                  : ''
              }
            </div>
          </div>
        `;
      })
      .join('');
  }
  // —— B:24838-24865
  function getSkillDesignerFusionDraftSeed(snapshot = {}, previewMeta = {}, baseDraft = {}) {
    if (toText(previewMeta && previewMeta.scope, '') !== '武魂融合技') return {};
    const rootData = snapshot && snapshot.rootData ? snapshot.rootData : {};
    const fusionRecord = getSkillDesignerFusionRecord(rootData, previewMeta);
    const selfEntry = getSkillDesignerFusionSelfEntry(rootData, previewMeta, snapshot);
    const spiritNames = selfEntry.spirits;
    const rawMode = baseDraft.fusionMode || baseDraft['融合模式'] || fusionRecord.融合模式 || '';
    let fusionMode = normalizeSkillDesignerFusionMode(rawMode);
    if (fusionMode === 'self' && spiritNames.length < 2) fusionMode = 'partner';
    const rawPartner = baseDraft.fusionPartner || baseDraft['融合对象'] || fusionRecord['融合对象'] || '';
    const fusionPartner =
      fusionMode === 'self' ? SKILL_DESIGNER_SELF_FUSION_PARTNER : normalizeSkillUiText(rawPartner, '');
    let fusionSourceSpirits = normalizeSkillDesignerArray(
      baseDraft.fusionSourceSpirits || baseDraft['来源武魂'] || fusionRecord.来源武魂,
    );
    if (fusionMode === 'self' && !fusionSourceSpirits.length) fusionSourceSpirits = spiritNames.slice(0, 2);
    const fusionParticipants = buildSkillDesignerFusionParticipants(snapshot, previewMeta, baseDraft, fusionRecord);
    const derivedFields = deriveSkillDesignerFusionFields(fusionMode, fusionParticipants, fusionPartner);
    return {
      fusionMode: derivedFields.fusionMode,
      用法模式: 规范化技能设计台融合用法模式(baseDraft['用法模式'] || fusionRecord['用法模式']),
      fusionPartner: derivedFields.fusionPartner,
      fusionSourceSpirits: derivedFields.fusionSourceSpirits.length
        ? derivedFields.fusionSourceSpirits
        : fusionSourceSpirits,
      fusionParticipants: derivedFields.fusionParticipants,
    };
  }
  // —— B:24867-24889
  function buildSkillDesignerFusionSummary(draft = {}) {
    if (!draft || !draft.fusionMode) return '';
    const derivedFields = deriveSkillDesignerFusionFields(
      draft.fusionMode,
      draft.fusionParticipants,
      draft.fusionPartner,
    );
    const participantText = derivedFields.fusionParticipants
      .map(participant => {
        const charName = participant.charName || participant.charKey || '未设置';
        const spirit = participant.spirit || '未设置';
        return `${charName}:${spirit}`;
      })
      .join(' + ');
    const fallbackSourceText = normalizeSkillDesignerArray(draft.fusionSourceSpirits).join('/');
    return [
      规范化技能设计台融合用法模式(draft['用法模式']),
      formatSkillDesignerFusionModeLabel(derivedFields.fusionMode, derivedFields.fusionParticipants),
      participantText || derivedFields.fusionPartner || fallbackSourceText,
    ]
      .filter(Boolean)
      .join(' / ');
  }
  // —— B:24891-24895
  function getSkillDesignerParamHint(标签 = '', 字段键 = '') {
    const 标题 = normalizeSkillUiText(标签, '');
    const 规范字段键 = normalizeSkillUiText(字段键, '');
    return 技能设计台参数提示表[标题] || 技能设计台参数提示表[规范字段键] || '';
  }
  // —— B:24897-24905
  function createSkillDesignerTextParam(key, label, placeholder = '', hint = '') {
    return Object.freeze({
      key,
      label,
      type: 'text',
      placeholder,
      hint: normalizeSkillUiText(hint, getSkillDesignerParamHint(label, key)),
    });
  }
  // —— B:24907-24916
  function createSkillDesignerNumberParam(key, label, placeholder = '', step = '0.1', hint = '') {
    return Object.freeze({
      key,
      label,
      type: 'number',
      placeholder,
      step,
      hint: normalizeSkillUiText(hint, getSkillDesignerParamHint(label, key)),
    });
  }
  // —— B:24918-24927
  function createSkillDesignerSelectParam(key, label, options = [], placeholder = '', hint = '') {
    return Object.freeze({
      key,
      label,
      type: 'select',
      options,
      placeholder,
      hint: normalizeSkillUiText(hint, getSkillDesignerParamHint(label, key)),
    });
  }
  // —— B:24929-24934
  function parseSkillDesignerCostAmount(value = '') {
    const text = normalizeSkillUiText(value, '');
    if (!text || text === '无') return '';
    // 固定 + 百分比复合写法（维持型真身/融合技的魂力消耗），整串按文本保留。
    if (/^\d+(?:\.\d+)?\s*[+＋]\s*\d+(?:\.\d+)?%$/.test(text)) return text.replace(/\s+/g, '').replace('＋', '+');
    if (!/^\d+(?:\.\d+)?%?$/.test(text)) return null;
    return /%$/.test(text) ? text : Number(text);
  }
  // —— B:24936-24941
  function 格式化技能设计台消耗片段(消耗值 = {}) {
    const 数值表 = normalizeSkillDesignerCostValues(消耗值);
    return SKILL_DESIGNER_COST_RESOURCE_KEYS.filter(key => 数值表[key] !== undefined)
      .map(key => `${key}:${数值表[key]}`)
      .join(' | ');
  }
  // —— B:24943-25003
  function 解析技能设计台消耗文本配置(rawCost = '') {
    const 结果 = { resourceType: '无', resourceValues: {}, resourceValue: '', sustainText: '' };
    if (rawCost === undefined || rawCost === null) return 结果;
    if (rawCost && typeof rawCost === 'object' && !Array.isArray(rawCost)) {
      if (rawCost['启动'] || rawCost['维持']) {
        const 启动数值 = normalizeSkillDesignerCostValues(rawCost['启动']);
        const 启动条目 = safeEntries(启动数值);
        const 维持文本 = 格式化技能设计台消耗片段(rawCost['维持']);
        结果.sustainText = 维持文本;
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
      /(魂力|体力|精神力)\s*[:：]\s*(\d+(?:\.\d+)?\s*[+＋]\s*\d+(?:\.\d+)?%|[^|+＋]+?)(?=\s*(?:魂力|体力|精神力)\s*[:：]|[|+＋]|$)/g,
    );
    const 数值表 = {};
    Array.from(匹配结果).forEach(匹配 => {
      const 资源名 = normalizeSkillUiText(匹配[1], '');
      const 消耗文本 = normalizeSkillUiText(匹配[2], '');
      const 数值 = parseSkillDesignerCostAmount(消耗文本);
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
  // —— B:25005-25013
  function normalizeSkillDesignerCostValues(value = {}) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const result = {};
    SKILL_DESIGNER_COST_RESOURCE_KEYS.forEach(key => {
      const amount = parseSkillDesignerCostAmount(source[key]);
      if (amount !== null && amount !== '') result[key] = amount;
    });
    return result;
  }
  // —— B:25015-25030
  function parseSkillDesignerCostConfig(rawCost = '', explicitType = '', explicitValues = {}) {
    const explicitResourceType = normalizeSkillUiText(explicitType, '');
    if (explicitResourceType) {
      const values = normalizeSkillDesignerCostValues(explicitValues);
      const 文本配置 = 解析技能设计台消耗文本配置(rawCost);
      return {
        resourceType: SKILL_DESIGNER_RESOURCE_TYPE_OPTIONS.includes(explicitResourceType)
          ? explicitResourceType
          : '混合',
        resourceValues: values,
        resourceValue: values[explicitResourceType] !== undefined ? values[explicitResourceType] : '',
        sustainText: 文本配置.sustainText || '',
      };
    }
    return 解析技能设计台消耗文本配置(rawCost);
  }
  // —— B:25032-25041
  function formatSkillDesignerCostText(resourceType = '', resourceValues = {}) {
    const safeType = normalizeSkillUiText(resourceType, '无') || '无';
    const values = normalizeSkillDesignerCostValues(resourceValues);
    if (safeType === '无') return '无';
    if (safeType !== '混合') return values[safeType] !== undefined ? `${safeType}:${values[safeType]}` : safeType;
    const text = SKILL_DESIGNER_COST_RESOURCE_KEYS.filter(key => values[key] !== undefined)
      .map(key => `${key}:${values[key]}`)
      .join(' | ');
    return text || '混合';
  }
  // —— B:25043-25049
  function formatSkillDesignerFullCostText(resourceType = '', resourceValues = {}, sustainText = '') {
    const 启动文本 = formatSkillDesignerCostText(resourceType, resourceValues);
    const 持续文本 = normalizeSkillUiText(sustainText, '');
    if (!持续文本) return 启动文本 || '无';
    if (!启动文本 || 启动文本 === '无') return `维持:${持续文本}`;
    return `${启动文本} 维持:${持续文本}`;
  }
  // —— B:25051-25095
  function 格式化技能设计台正式消耗文本(resourceType = '', resourceValues = {}, sustainText = '', previewMeta = {}, draft = {}, rootData = {}) {
    const scope = normalizeSkillUiText(previewMeta && previewMeta.scope, '');
    const nameText = normalizeSkillUiText(draft?.name || draft?.魂技名 || draft?.技能名称, '');
    const keepPercent =
      scope === '武魂融合技' ||
      /武魂真身|真身/.test(nameText);
    if (keepPercent) return formatSkillDesignerFullCostText(resourceType, resourceValues, sustainText);
    if (!['魂技', 'independent_ring_skill', '自创魂技'].includes(scope)) return formatSkillDesignerFullCostText(resourceType, resourceValues, sustainText);

    const budget = 构建技能设计台预算上下文(previewMeta, rootData, draft);
    const actor = budget?.角色 || {};
    const maxByResource = {
      魂力: Math.max(1, Number(actor.sp_max || actor.魂力上限 || 1)),
      体力: Math.max(1, Number(actor.vit_max || actor.体力上限 || actor.HP上限 || 1)),
      精神力: Math.max(1, Number(actor.men_max || actor.精神力上限 || 1)),
    };
    const 转换消耗值 = values => {
      const converted = {};
      safeEntries(normalizeSkillDesignerCostValues(values)).forEach(([resource, value]) => {
        const text = normalizeSkillUiText(value, '');
        if (/%$/.test(text) && !/[+＋]/.test(text)) {
          const ratio = Math.max(0, Number(text.replace('%', '')) || 0) / 100;
          converted[resource] = Math.max(0, Math.floor((maxByResource[resource] || 1) * ratio));
        } else {
          converted[resource] = value;
        }
      });
      return converted;
    };
    const cost = normalizeSkillDesignerCostValues(resourceValues);
    const upfrontHasPercent = safeEntries(cost).some(([, value]) => /%$/.test(normalizeSkillUiText(value, '')));
    const converted = 转换消耗值(cost);
    let convertedSustain = normalizeSkillUiText(sustainText, '');
    const sustainHasPercent = /%/.test(convertedSustain);
    if (convertedSustain) {
      const sustainConfig = 解析技能设计台消耗文本配置(convertedSustain);
      if (safeEntries(sustainConfig.resourceValues).length) {
        convertedSustain = formatSkillDesignerCostText(sustainConfig.resourceType, 转换消耗值(sustainConfig.resourceValues));
      }
    }
    if (!upfrontHasPercent && !sustainHasPercent) {
      return formatSkillDesignerFullCostText(resourceType, resourceValues, sustainText);
    }
    return formatSkillDesignerFullCostText(resourceType, converted, convertedSustain);
  }
  // —— B:25097-25125
  function buildSkillDesignerCostObject(resourceType = '', resourceValues = {}, strict = false) {
    const safeType = normalizeSkillUiText(resourceType, '无') || '无';
    if (safeType === '无') return {};
    const source =
      resourceValues && typeof resourceValues === 'object' && !Array.isArray(resourceValues) ? resourceValues : {};
    const values = normalizeSkillDesignerCostValues(source);
    if (strict) {
      const fields = safeType === '混合' ? SKILL_DESIGNER_COST_RESOURCE_KEYS : [safeType];
      fields.forEach(key => {
        const raw = normalizeSkillUiText(source[key], '');
        if (raw && parseSkillDesignerCostAmount(raw) === null) throw new Error('消耗数值只能填写数字或百分比。');
      });
    }
    if (safeType === '混合') {
      if (!safeEntries(values).length && strict) throw new Error('混合消耗至少填写一项。');
      return values;
    }
    if (!['魂力', '精神力', '体力'].includes(safeType)) return {};
    const amount = parseSkillDesignerCostAmount(values[safeType]);
    if (amount === null) {
      if (strict) throw new Error('消耗数值只能填写数字或百分比。');
      return {};
    }
    if (amount === '') {
      if (strict) throw new Error(`${safeType}消耗不能为空。`);
      return {};
    }
    return { [safeType]: amount };
  }
  // —— B:25127-25652
  function getSkillDesignerMechanicParamDefs(mechanicLabel = '') {
    const label = normalizeSkillUiText(mechanicLabel, '');
    const registryDefs = resolveSkillDesignerMechanismParamDefsFromRegistry(label);
    if (registryDefs.length) return registryDefs;
    switch (label) {
      case '伤害类':
        return [
          createSkillDesignerNumberParam('powerRatio', '强度倍率', '100'),
          createSkillDesignerNumberParam('hitCount', '攻击段数', '1', '1'),
          createSkillDesignerTextParam('range', '作用范围', '单体 / 半径3米'),
        ];
      case '控制类':
        return [
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
          createSkillDesignerNumberParam('controlPower', '控制强度', '1.0'),
          createSkillDesignerTextParam('hitRule', '命中条件', '命中后 / 破防后'),
        ];
      case '削弱类':
        return [
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
          createSkillDesignerNumberParam('weakenRatio', '削弱幅度', '0.2'),
          createSkillDesignerSelectParam('affectedPanel', '影响对象', SKILL_DESIGNER_PARAM_PANEL_OPTIONS),
        ];
      case '增益类':
        return [
          createSkillDesignerNumberParam('duration', '持续回合', '3', '1'),
          createSkillDesignerNumberParam('gainRatio', '增益幅度', '0.25'),
          createSkillDesignerSelectParam('gainTarget', '覆盖对象', SKILL_DESIGNER_PARAM_SUPPORT_TARGET_OPTIONS),
        ];
      case '防御类':
        return [
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
          createSkillDesignerNumberParam('guardValue', '防护强度', '1.0'),
          createSkillDesignerTextParam('triggerRule', '触发条件', '受击时 / 常驻'),
        ];
      case '回复类':
        return [
          createSkillDesignerNumberParam('recoverRatio', '回复倍率', '0.3'),
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
          createSkillDesignerNumberParam('repeatCount', '生效次数', '1', '1'),
        ];
      case '感知/认知类':
        return [
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
          createSkillDesignerTextParam('senseRange', '感知范围', '半径20米'),
          createSkillDesignerNumberParam('disturbPower', '干扰强度', '1.0'),
        ];
      case '位移类':
        return [
          createSkillDesignerTextParam('moveDistance', '位移幅度', '5米'),
          createSkillDesignerTextParam('followWindow', '追击窗口', '1回合内'),
        ];
      case '特殊规则类':
        return [
          createSkillDesignerTextParam('triggerRule', '触发条件', '被击中后 / 结算前'),
          createSkillDesignerTextParam('ruleTarget', '改写对象', '单次技能 / 状态'),
          createSkillDesignerTextParam('maintainCost', '维持代价', '每回合额外消耗'),
        ];
      case '单体伤害':
        return [
          createSkillDesignerNumberParam('powerRatio', '威力', '140'),
          createSkillDesignerNumberParam('hitCount', '攻击段数', '1', '1'),
          createSkillDesignerTextParam('range', '作用范围', '单体 / 直线 / 点杀'),
        ];
      case '群体伤害':
        return [
          createSkillDesignerNumberParam('powerRatio', '威力', '110'),
          createSkillDesignerTextParam('range', '作用半径', '半径5米'),
          createSkillDesignerNumberParam('hitCount', '攻击段数', '1', '1'),
        ];
      case '多段伤害':
        return [
          createSkillDesignerNumberParam('segmentCount', '段数', '3', '1'),
          createSkillDesignerNumberParam('segmentRatio', '单段倍率', '45'),
          createSkillDesignerTextParam('segmentInterval', '段间间隔', '0.2秒'),
        ];
      case '持续伤害':
        return [
          createSkillDesignerNumberParam('dotRatio', '每跳倍率', '35'),
          createSkillDesignerNumberParam('duration', '持续回合', '3', '1'),
          createSkillDesignerNumberParam('stackLimit', '叠层上限', '3', '1'),
        ];
      case '硬控':
        return [
          createSkillDesignerNumberParam('duration', '控制回合', '2', '1'),
          createSkillDesignerNumberParam('controlPower', '控制强度', '1.2'),
          createSkillDesignerTextParam('breakRule', '解除条件', '受伤 / 净化'),
        ];
      case '软控':
        return [
          createSkillDesignerNumberParam('duration', '控制回合', '2', '1'),
          createSkillDesignerNumberParam('slowRatio', '控制幅度', '0.3'),
          createSkillDesignerTextParam('hitRule', '命中条件', '接触续 / 视线锁定'),
        ];
      case '迟缓':
        return [
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
          createSkillDesignerNumberParam('slowRatio', '迟缓幅度', '0.2'),
        ];
      case '节奏打断':
        return [
          createSkillDesignerNumberParam('interruptCount', '可打断次数', '1', '1'),
          createSkillDesignerNumberParam('extraDelay', '追加僵直', '0.5'),
        ];
      case '单属性削弱':
        return [
          createSkillDesignerSelectParam('debuffAttr', '压制对象', SKILL_DESIGNER_PARAM_ATTRIBUTE_OPTIONS),
          createSkillDesignerNumberParam('reduceRatio', '压制倍率', '0.8'),
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
        ];
      case '多属性削弱':
        return [
          createSkillDesignerSelectParam('debuffAttrGroup', '属性组', SKILL_DESIGNER_PARAM_ATTRIBUTE_GROUP_OPTIONS),
          createSkillDesignerNumberParam('reduceRatio', '统一倍率', '0.85'),
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
        ];
      case '消耗':
        return [
          createSkillDesignerNumberParam('gainRatio', '修正数值', '-20%'),
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
        ];
      case '前摇':
        return [
          createSkillDesignerNumberParam('gainRatio', '修正数值', '-20%'),
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
        ];
      case '掌控压制':
        return [
          createSkillDesignerNumberParam('gainRatio', '压制倍率', '0.8'),
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
        ];
      case '速度压制':
        return [
          createSkillDesignerNumberParam('gainRatio', '压制倍率', '0.85'),
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
        ];
      case '单属性增益':
        return [
          createSkillDesignerSelectParam('buffAttr', '增幅对象', SKILL_DESIGNER_PARAM_ATTRIBUTE_OPTIONS),
          createSkillDesignerNumberParam('gainRatio', '增幅倍率', '0.3'),
          createSkillDesignerNumberParam('duration', '持续回合', '3', '1'),
        ];
      case '多属性增益':
        return [
          createSkillDesignerSelectParam('buffAttrGroup', '属性组', SKILL_DESIGNER_PARAM_ATTRIBUTE_GROUP_OPTIONS),
          createSkillDesignerNumberParam('gainRatio', '增幅倍率', '0.2'),
          createSkillDesignerNumberParam('duration', '持续回合', '3', '1'),
        ];
      case '全属性增益':
        return [
          createSkillDesignerNumberParam('allGainRatio', '全属性倍率', '0.15'),
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
        ];
      case '掌控提升':
        return [
          createSkillDesignerNumberParam('gainRatio', '提升倍率', '1.2'),
          createSkillDesignerNumberParam('duration', '持续回合', '3', '1'),
        ];
      case '速度提升':
        return [
          createSkillDesignerNumberParam('gainRatio', '提升倍率', '1.15'),
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
        ];
      case '护盾':
      case '小护盾':
        return [
          createSkillDesignerNumberParam('shieldRatio', '护盾倍率', '0.8'),
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
          createSkillDesignerSelectParam('shieldCap', '护盾上限', SKILL_DESIGNER_PARAM_SHIELD_CAP_OPTIONS),
        ];
      case '承伤修正':
        return [
          createSkillDesignerNumberParam('reduceRatio', '承伤修正', '0.35'),
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
          createSkillDesignerTextParam('damageType', '覆盖类型', '物理 / 元素 / 全伤'),
        ];
      case '免伤':
        return [
          createSkillDesignerNumberParam('blockCount', '免伤次数', '1', '1'),
          createSkillDesignerTextParam('blockCap', '单次上限', '最多抵消一次大招'),
          createSkillDesignerTextParam('triggerRule', '触发条件', '受击瞬间'),
        ];
      case '霸体':
        return [
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
          createSkillDesignerSelectParam('immuneLevel', '免控级别', SKILL_DESIGNER_PARAM_IMMUNE_LEVEL_OPTIONS),
          createSkillDesignerNumberParam('reduceRatio', '额外减伤', '0.2'),
        ];
      case '免死/锁血':
        return [
          createSkillDesignerTextParam('triggerThreshold', '触发阈值', '低于20%生命'),
          createSkillDesignerTextParam('lockBloodFloor', '锁血下限', '保留1点 / 10%'),
          createSkillDesignerNumberParam('triggerCount', '触发次数', '1', '1'),
        ];
      case '无敌金身':
        return [
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
          createSkillDesignerNumberParam('每日触发次数', '每日触发', '3', '1'),
        ];
      case '伤害反射':
        return [
          createSkillDesignerNumberParam('reflectRatio', '反射比例', '0.25'),
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
          createSkillDesignerTextParam('reflectRule', '触发条件', '受击后'),
        ];
      case '伤害转移':
        return [
          createSkillDesignerNumberParam('transferRatio', '转移比例', '0.25'),
          createSkillDesignerSelectParam('transferTarget', '转移对象', 技能设计台伤害转移对象选项),
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
        ];
      case '伤害分摊':
        return [
          createSkillDesignerNumberParam('shareRatio', '分摊比例', '0.35'),
          createSkillDesignerNumberParam('shareCount', '分摊人数', '1', '1'),
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
        ];
      case '消耗分摊':
        return [
          createSkillDesignerNumberParam('shareRatio', '分摊比例', '0.35'),
          createSkillDesignerNumberParam('shareCount', '分摊人数', '1', '1'),
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
        ];
      case '体力恢复':
      case '魂力恢复':
      case '精神恢复':
        return [
          createSkillDesignerNumberParam('recoverRatio', '回复倍率', '0.35'),
          createSkillDesignerNumberParam('repeatCount', '生效次数', '1', '1'),
        ];
      case '持续恢复':
        return [
          createSkillDesignerNumberParam('recoverRatio', '每回合倍率', '0.2'),
          createSkillDesignerNumberParam('duration', '持续回合', '3', '1'),
          createSkillDesignerNumberParam('stackLimit', '叠层上限', '2', '1'),
        ];
      case '净化/解控':
      case '净化':
      case '解控':
        return [
          createSkillDesignerNumberParam('cleanseCount', '清除条目数', '2', '1'),
          createSkillDesignerNumberParam('duration', '持续回合', '1', '1'),
          createSkillDesignerSelectParam(
            'cleansePriority',
            '净化优先级',
            SKILL_DESIGNER_PARAM_CLEANSE_PRIORITY_OPTIONS,
          ),
          createSkillDesignerSelectParam('extraGain', '附带收益', SKILL_DESIGNER_PARAM_CLEANSE_GAIN_OPTIONS),
        ];
      case '感知干扰':
        return [
          createSkillDesignerNumberParam('disturbPower', '干扰强度', '1.1'),
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
        ];
      case '标记锁定':
        return [
          createSkillDesignerNumberParam('markDuration', '标记时长', '2', '1'),
          createSkillDesignerNumberParam('targetCap', '锁定目标数', '1', '1'),
          createSkillDesignerSelectParam('trackingRule', '追踪规则', SKILL_DESIGNER_PARAM_TRACKING_RULE_OPTIONS),
        ];
      case '共享视野':
        return [
          createSkillDesignerTextParam('shareRange', '共享范围', '队伍 / 半径30米'),
          createSkillDesignerNumberParam('duration', '持续回合', '3', '1'),
          createSkillDesignerSelectParam('infoDepth', '共享深度', SKILL_DESIGNER_PARAM_INFO_DEPTH_OPTIONS),
        ];
      case '幻境':
        return [
          createSkillDesignerTextParam('illusionRange', '幻境范围', '半径8米'),
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
          createSkillDesignerNumberParam('illusionPower', '幻术强度', '1.1'),
        ];
      case '催眠':
        return [
          createSkillDesignerNumberParam('duration', '睡眠回合', '2', '1'),
          createSkillDesignerSelectParam('wakeRule', '唤醒条件', SKILL_DESIGNER_PARAM_WAKE_RULE_OPTIONS),
          createSkillDesignerTextParam('hitRule', '命中条件', '视线锁定 / 声波接触'),
        ];
      case '认知扭曲':
        return [
          createSkillDesignerNumberParam('twistPower', '扭曲强度', '0.18'),
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
        ];
      case '目标锁定':
        return [
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
          createSkillDesignerNumberParam('hitBonus', '命中增益', '0.1'),
          createSkillDesignerNumberParam('lockLevel', '锁定强度', '1', '1'),
        ];
      case '自身位移':
        return [createSkillDesignerTextParam('moveDistance', '位移幅度', '5米')];
      case '强制位移':
        return [createSkillDesignerTextParam('moveDistance', '位移幅度', '4米')];
      case '位移交换':
        return [
          createSkillDesignerTextParam('exchangeRange', '交换范围', '8米'),
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
          createSkillDesignerTextParam('triggerRule', '交换条件', '命中标记目标'),
        ];
      case '追击位移':
        return [
          createSkillDesignerTextParam('moveDistance', '追击幅度', '6米'),
          createSkillDesignerTextParam('followWindow', '追击窗口', '命中后1秒'),
          createSkillDesignerNumberParam('extraRatio', '追加倍率', '0.3'),
        ];
      case '脱离位移':
        return [
          createSkillDesignerTextParam('moveDistance', '脱离幅度', '7米'),
          createSkillDesignerTextParam('escapeRule', '脱离条件', '生命低于50%'),
          createSkillDesignerSelectParam('extraGain', '脱离收益', SKILL_DESIGNER_PARAM_ESCAPE_GAIN_OPTIONS),
        ];
      case '分身':
        return [
          createSkillDesignerSelectParam('cloneType', '分身类型', SKILL_DESIGNER_PARAM_CLONE_TYPE_OPTIONS),
          createSkillDesignerNumberParam('cloneCount', '分身数量', '2', '1'),
          createSkillDesignerNumberParam('stealthRatio', '隐蔽度', '0.45'),
          createSkillDesignerNumberParam('inheritRatio', '实力继承', '0.55'),
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
          createSkillDesignerTextParam('cloneName', '分身称谓', '影分身 / 心像'),
        ];
      case '召唤':
        return [
          createSkillDesignerSelectParam('召唤单位类型', '召唤单位类型', 技能设计台召唤单位类型选项),
          createSkillDesignerTextParam('summonName', '召唤物名称', '本命召唤兽'),
          createSkillDesignerNumberParam('summonCount', '召唤数量', '1', '1'),
          createSkillDesignerNumberParam('召唤强度', '固定强度', '1.0'),
          createSkillDesignerNumberParam('力量继承比例', '力量继承', '0.45', '0.01'),
          createSkillDesignerNumberParam('防御继承比例', '防御继承', '0.45', '0.01'),
          createSkillDesignerNumberParam('敏捷继承比例', '敏捷继承', '0.45', '0.01'),
          createSkillDesignerNumberParam('体力继承比例', '体力继承', '0.45', '0.01'),
          createSkillDesignerNumberParam('魂力继承比例', '魂力继承', '0.45', '0.01'),
          createSkillDesignerNumberParam('精神继承比例', '精神继承', '0.45', '0.01'),
          createSkillDesignerNumberParam('duration', '持续回合', '3', '1'),
          createSkillDesignerSelectParam('summonMode', '行动模式', 技能设计台召唤行动模式选项),
          createSkillDesignerSelectParam('damageRule', '承伤规则', 技能设计台召唤承伤规则选项),
        ];
      case '复制':
        return [
          createSkillDesignerSelectParam('copyTarget', '复制类型', SKILL_DESIGNER_PARAM_COPY_TARGET_OPTIONS),
          createSkillDesignerSelectParam('copyMode', '复制模式', 技能设计器参数复制模式选项),
          createSkillDesignerNumberParam('saveLimit', '保存上限', '1', '1'),
          createSkillDesignerNumberParam('reductionRatio', '削减比例', '0.2'),
          createSkillDesignerNumberParam('useCount', '可用次数', '1', '1'),
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
          createSkillDesignerNumberParam('keepDurationTick', '保留时长tick', '144', '1'),
        ];
      case '炸环':
        return [
          createSkillDesignerNumberParam('burstEnhanceRatio', '强化倍率 × 年限', '100', '0.1', '实际增幅按该倍率再乘炸环总年限/40万；默认 40万年约把 97级基础属性推近 100级。'),
        ];
      case '反制':
        return [
          createSkillDesignerSelectParam('counterTarget', '反制对象', SKILL_DESIGNER_PARAM_COUNTER_TARGET_OPTIONS),
          createSkillDesignerTextParam('triggerRule', '触发条件', '被锁定时 / 命中前'),
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
          createSkillDesignerNumberParam('counterRatio', '反制倍率', '1.0'),
        ];
      case '转化':
        return [
          createSkillDesignerTextParam('convertPath', '转化方向', '伤害→治疗 / 治疗→伤害'),
          createSkillDesignerNumberParam('convertRatio', '转化比率', '0.6'),
        ];
      case '状态交换':
        return [
          createSkillDesignerSelectParam('状态', '交出状态', 读取技能设计台原型字段选项('状态交换', '状态')),
          createSkillDesignerNumberParam('duration', '持续回合', '1', '1'),
        ];
      case '状态转移':
        return [
          createSkillDesignerSelectParam('状态', '状态筛选', 读取技能设计台原型字段选项('状态转移', '状态')),
          createSkillDesignerSelectParam('来源', '来源', ['自身', '目标', '友方', '敌方']),
          createSkillDesignerSelectParam('去向', '去向', ['自身', '目标', '友方', '敌方']),
          createSkillDesignerTextParam('数量', '数量', '1 或 全部'),
          createSkillDesignerNumberParam('duration', '持续回合', '1', '1'),
        ];
      case '强制绑定/锁定':
        return [
          createSkillDesignerNumberParam('bindDuration', '绑定回合', '2', '1'),
          createSkillDesignerNumberParam('targetCap', '绑定目标数', '1', '1'),
          createSkillDesignerTextParam('releaseRule', '解除条件', '超距离 / 净化'),
        ];
      case '规则改写':
        return [
          createSkillDesignerSelectParam('rewriteRule', '规则', SKILL_DESIGNER_PARAM_RULE_REWRITE_OPTIONS),
          createSkillDesignerNumberParam('rewriteValue', '复活恢复比例', '25%'),
          createSkillDesignerNumberParam('duration', '规则持续回合', '1', '1'),
        ];
      case '引爆持续伤害':
        return [
          createSkillDesignerNumberParam('detonateRatio', '引爆倍率', '1.2'),
          createSkillDesignerTextParam('consumeMode', '消耗规则', '消耗全部持续伤害'),
        ];
      case '斩盾':
        return [];
      case '吞噬':
        return [
          createSkillDesignerSelectParam(
            'resourceType',
            '吞噬资源',
            SKILL_DESIGNER_PARAM_RESOURCE_TRANSFER_TYPE_OPTIONS,
          ),
          createSkillDesignerNumberParam('drainRatio', '吞噬比例', '0.18'),
          createSkillDesignerNumberParam('convertRatio', '转化比例', '1.0'),
          createSkillDesignerNumberParam('duration', '持续回合', '1', '1'),
        ];
      case '能力共享':
        return [
          createSkillDesignerSelectParam(
            'resourceType',
            '共享资源',
            SKILL_DESIGNER_PARAM_RESOURCE_TRANSFER_TYPE_OPTIONS,
          ),
          createSkillDesignerNumberParam('refeedRatio', '共享比例', '0.2'),
          createSkillDesignerNumberParam('duration', '持续回合', '1', '1'),
        ];
      case '机制抹消':
        return [
          createSkillDesignerTextParam('suppressObject', '抹消对象', '{"原型":"机制授予"}'),
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
        ];
      case '机制授予':
        return [
          createSkillDesignerSelectParam('grantTrigger', '触发条件', 技能设计台机制授予触发条件选项),
          createSkillDesignerNumberParam('useCount', '可用次数', '1', '1'),
          createSkillDesignerNumberParam('duration', '持续回合', '1', '1', '待机触发可留空表示无回合期限；填写后逾期失效。主动触发默认1回合。'),
        ];
      case '穿透':
        return [
          createSkillDesignerNumberParam('penetrationRatio', '穿透比例', '0.25'),
          createSkillDesignerSelectParam(
            'penetrationTarget',
            '穿透对象',
            SKILL_DESIGNER_PARAM_PENETRATION_TARGET_OPTIONS,
          ),
        ];
      case '伤害吸收':
        return [
          createSkillDesignerNumberParam('absorbRatio', '吸收比例', '0.2'),
          createSkillDesignerSelectParam('absorbSource', '吸收来源', 技能设计台伤害吸收来源选项),
          createSkillDesignerSelectParam('resourceType', '吸收资源', 技能设计台伤害吸收资源选项),
        ];
      case '斩杀补伤':
        return [
          createSkillDesignerTextParam('executeLine', '触发血线', '低于25%'),
          createSkillDesignerNumberParam('bonusRatio', '补伤倍率', '0.5'),
        ];
      case '流血DOT':
        return [
          createSkillDesignerNumberParam('dotRatio', '每跳倍率', '20'),
          createSkillDesignerNumberParam('duration', '持续回合', '3', '1'),
        ];
      case '打断':
        return [
          createSkillDesignerNumberParam('extraDelay', '追加僵直', '0.5'),
        ];
      case '反击':
        return [
          createSkillDesignerSelectParam('counterRule', '反击条件', SKILL_DESIGNER_PARAM_COUNTER_RULE_OPTIONS),
          createSkillDesignerNumberParam('counterRatio', '反击倍率', '0.8'),
        ];
      case '追击':
        return [
          createSkillDesignerTextParam('followWindow', '追击窗口', '命中后1秒'),
          createSkillDesignerNumberParam('bonusRatio', '追击倍率', '1.2'),
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
        ];
      case '沉默':
        return [
          createSkillDesignerNumberParam('duration', '沉默回合', '2', '1'),
          createSkillDesignerSelectParam('muteScope', '限制范围', SKILL_DESIGNER_PARAM_MUTE_SCOPE_OPTIONS),
        ];
      case '减速':
      case '迟缓':
        return [
          createSkillDesignerNumberParam('slowRatio', '减速幅度', '0.3'),
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
        ];
      case '致盲':
        return [
          createSkillDesignerNumberParam('duration', '致盲回合', '2', '1'),
          createSkillDesignerSelectParam('blindEffect', '影响内容', SKILL_DESIGNER_PARAM_BLIND_EFFECT_OPTIONS),
        ];
      case '禁疗':
        return [
          createSkillDesignerNumberParam('banHealRatio', '禁疗幅度', '1.0'),
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
        ];
      case '治疗反转':
        return [
          createSkillDesignerNumberParam('invertRatio', '反转倍率', '1.0'),
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
        ];
      case '标记弱点':
        return [
          createSkillDesignerSelectParam('weakPointType', '弱点类型', SKILL_DESIGNER_PARAM_WEAK_POINT_TYPE_OPTIONS),
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
        ];
      case '驱散增益':
        return [createSkillDesignerNumberParam('dispelCount', '驱散数量', '1', '1')];
      case '窃取增益':
        return [createSkillDesignerNumberParam('stealCount', '窃取数量', '1', '1')];
      case '隐身':
        return [
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
        ];
      case '护卫':
        return [
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
          createSkillDesignerNumberParam('reduceRatio', '护卫减伤', '0.1'),
        ];
      case '嘲讽':
        return [
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
          createSkillDesignerTextParam('focusRule', '聚火规则', '强制优先自身'),
        ];
      case '破隐':
        return [];
      case '封技':
        return [
          createSkillDesignerNumberParam('duration', '持续回合', '2', '1'),
          createSkillDesignerSelectParam('muteScope', '限制范围', SKILL_DESIGNER_PARAM_MUTE_SCOPE_OPTIONS),
        ];
      default:
        return [];
    }
  }
  // —— B:25654-25669
  function getSkillDesignerMechanicParamSections(draft = {}) {
    const sections = [];
    const primaryLabel = getSkillDesignerEffectivePrimaryLabel(draft);
    const primaryMain = normalizeSkillUiText(draft.primaryMain, '');
    if (primaryLabel) {
      sections.push({ kind: 'primary', label: primaryLabel });
    } else if (primaryMain && getSkillDesignerMechanicParamDefs(primaryMain).length) {
      sections.push({ kind: 'primary', label: primaryMain });
    }
    normalizeSkillDesignerSecondarySelection(primaryMain, draft.secondaryMechanics, draft.type, primaryLabel).forEach(
      label => {
        sections.push({ kind: 'secondary', label });
      },
    );
    return sections;
  }
  // —— B:25671-25679
  function collectSkillDesignerMechanicLabels(draft = {}) {
    return Array.from(
      new Set(
        getSkillDesignerMechanicParamSections(draft)
          .map(section => normalizeSkillUiText(section && section.label, ''))
          .filter(Boolean),
      ),
    );
  }
  // —— B:25681-25708
  function normalizeSkillDesignerMechanicParamMap(value = {}, draft = {}) {
    const safeMap = value && typeof value === 'object' ? value : {};
    const normalized = {};
    collectSkillDesignerMechanicLabels(draft).forEach(label => {
      const defs = getSkillDesignerMechanicParamDefs(label);
      const source = safeMap[label] && typeof safeMap[label] === 'object' ? safeMap[label] : {};
      const nextEntry = {};
      defs.forEach(def => {
        if (label === '机制抹消' && def.key === 'suppressObject') {
          const 对象 = 规范化技能设计台机制抹消对象(source[def.key]);
          if (safeEntries(对象).length) nextEntry[def.key] = 对象;
          return;
        }
        const currentValue = normalizeSkillUiText(source[def.key], '');
        if (currentValue) nextEntry[def.key] = currentValue;
      });
      if (label === '机制授予') {
        const 授予目标 = resolveSkillDesignerGrantableMechanismTargetForRuntime(draft && draft.target, label);
        const 触发条件 = normalizeSkillUiText(nextEntry['grantTrigger'], '主动触发');
        nextEntry['grantTrigger'] = 读取技能设计台机制授予触发条件选项(授予目标).includes(触发条件) ? 触发条件 : '主动触发';
        if (nextEntry['grantTrigger'] === '随下次行动触发') {
          delete nextEntry['useCount'];
        }
      }
      if (safeEntries(nextEntry).length) normalized[label] = nextEntry;
    });
    return normalized;
  }
  // —— B:25875
  const 技能设计台原型字段隐藏集合 = new Set(['原型']);
  // —— B:25876
  const 技能设计台玩家可选原型排除集合 = new Set();
  // —— B:25878-25882
  function 读取技能设计台原型名称列表() {
    return Object.keys(SKILL_DESIGNER_PROTOTYPE_REGISTRY || {}).filter(
      name => !技能设计台玩家可选原型排除集合.has(name),
    );
  }
  // —— B:25884-25896
  function 读取技能设计台原型摘要(原型 = '') {
    const 原型名 = normalizeSkillUiText(原型, '');
    const 定义 = SKILL_DESIGNER_PROTOTYPE_REGISTRY[原型名] || {};
    const 类别 = normalizeSkillUiText(定义['类别'], '');
    const 方向 = normalizeSkillUiText(定义['默认方向'], '');
    const 描述 = normalizeSkillUiText(定义['描述'], '');
    return {
      类别,
      方向,
      描述,
      文本: [类别, 方向, 描述].filter(Boolean).join(' · '),
    };
  }
  // —— B:25898-25917
  function 构建技能设计台原型选项(当前原型 = '') {
    const 当前值 = normalizeSkillUiText(当前原型, '');
    const 分组 = [
      ['战斗内', 读取技能设计台原型名称列表().filter(原型名 => 读取技能设计台原型摘要(原型名).类别 !== '战斗外')],
      ['战斗外', 读取技能设计台原型名称列表().filter(原型名 => 读取技能设计台原型摘要(原型名).类别 === '战斗外')],
    ];
    return 分组
      .map(([标题, 原型列表]) => {
        if (!原型列表.length) return '';
        return [
          `<option value="" disabled>── ${htmlEscape(标题)} ──</option>`,
          ...原型列表.map(原型名 => {
            const 摘要 = 读取技能设计台原型摘要(原型名);
            const 标签 = `${原型名}｜${摘要.描述 || 原型名}`;
            return `<option value="${escapeHtmlAttr(原型名)}"${原型名 === 当前值 ? ' selected' : ''}>${htmlEscape(标签)}</option>`;
          }),
        ].join('');
      })
      .join('');
  }
  // —— B:25919-25997
  function 技能设计台原型字段是否显示(原型 = '', 字段 = '', effect = {}) {
    const prototype = normalizeSkillUiText(原型, '');
    const key = normalizeSkillUiText(字段, '');
    const valueOf = name => normalizeSkillUiText(effect && effect[name], '');
    const target = normalizeSkillDesignerEffectTargetValue(effect && effect['目标'], '单体');
    if (prototype === '伤害结算' && key === '持续回合') return false;
    if (prototype === '伤害结算' && ['装备条件', '姿态条件', '连招条件', '动作时窗', '中断条件', '主驱动资源', '每段倍率', '段间隔', '范围半径', '目标数量上限', '触发限制', '结算标签', '抗性类型'].includes(key)) return false;
    if (prototype === '资源变化' && ['持续tick', '主驱动资源', '结算标签', '资源转移角色', '资源转移方式', '转化比例'].includes(key)) return false;
    if (prototype === '资源转移' && ['持续tick', '主驱动资源', '结算标签', '资源转移角色'].includes(key)) return false;
    if (prototype === '资源转移' && key === '转化比例') return ['吞噬', '共享', '转移'].includes(valueOf('资源转移方式'));
    if (prototype === '修炼增益' && key === '修炼属性') return valueOf('收益类型') === '属性修炼速度';
    if (prototype === '修炼增益' && key === '训练方式') return valueOf('收益类型') !== '属性修炼速度';
    if (prototype === '护盾变化' && key === '持续回合') return valueOf('护盾模式') === '正向护盾';
    if (prototype === '时光回溯') return ['目标', '原型', '生效方式', '条件分支', '发动方式', '驱动属性', '影响方向'].includes(key);
    if (prototype === '规则改写') {
      if (key === '目标') return valueOf('规则') !== '死亡转存活';
      if (key === '数值') return valueOf('规则') === '死亡转存活';
      if (key === '持续回合') return valueOf('规则') !== '死亡转存活';
      return !['死亡时限tick', '复活代价类型', '复活代价对象', '复活代价值', '复活代价时限tick', '复活后状态', '复活后状态时限tick'].includes(key);
    }
    if (prototype === '战斗外复活') return ['目标', '数值', '死亡时限tick', '复活代价类型', '复活代价对象', '复活代价值', '复活代价时限tick', '复活后状态', '复活后状态时限tick'].includes(key);
    if (prototype === '复制执行') {
      const 复制类型 = valueOf('复制类型') || '复制技能';
      if (key === '削减比例') return /属性|全部/.test(复制类型);
      if (['保存上限', '可用次数'].includes(key)) return ['复制技能', '复制全部'].includes(复制类型);
      if (['驱动属性', '影响方向'].includes(key)) return /属性|全部/.test(复制类型);
    }
    if (prototype === '召唤生成') {
      const 单位类型 = valueOf('召唤单位类型') || '魂兽';
      const 使用继承 = ['分身', '本命召唤兽'].includes(单位类型);
      if (key === '强度') return !使用继承;
      if (key === '继承属性比例') return false;
      if (key === '力量继承比例') return 使用继承;
      if (['防御继承比例', '敏捷继承比例', '体力继承比例', '魂力继承比例', '精神继承比例'].includes(key)) return false;
    }
    if (prototype === '位移执行' && key === '方位') return false;
    if (prototype === '炸环') return ['目标', '原型', '生效方式', '条件分支', '强化倍率'].includes(key);
    if (prototype === '结算修正') {
      const 结算 = valueOf('结算');
      const 支持字段 = 技能设计台结算修正支持字段矩阵[结算] || 技能设计台结算修正支持字段矩阵['造成伤害'];
      if (key === '数量' && ['伤害分摊', '消耗分摊'].includes(结算)) return target === '群体';
      return !!支持字段 && 支持字段.includes(key);
    }
    if (prototype === '判定修正' && key === '打断效果') return 技能设计台判定修正允许打断效果(effect);
    if (prototype === '判定修正') return key !== '持续tick';
    if (prototype === '状态施加' && key === '概率') return false;
    if (prototype === '状态施加' && key === '延迟回合') return valueOf('触发方式') === '延迟触发';
    if (prototype === '资源变化' && key === '触发限制') return true;
    if (prototype === '状态施加' && key === '触发限制') return 技能设计台状态施加允许触发限制(valueOf('状态'), target);
    if (prototype === '状态施加' && ['驱动属性', '影响方向'].includes(key))
      return !技能设计台状态施加清理驱动字段(valueOf('状态'), target);
    if (prototype === '状态施加' && key === '数值') {
      return 读取技能设计台多枚举值(effect && effect['状态']).some(state =>
        技能设计台状态施加允许数值字段(state),
      );
    }
    if (prototype === '状态施加' && key === '副数值') {
      return 读取技能设计台多枚举值(effect && effect['状态']).some(state =>
        技能设计台状态施加允许副数值字段(state),
      );
    }
    if (prototype === '召唤生成' && key === '承伤规则') return valueOf('行动模式') === '护卫';
    if (prototype === '状态移除' && ['资源', '数值方向'].includes(key)) return valueOf('匹配原型') === '资源变化';
    if (prototype === '时窗修正' && key === '调整回合') {
      return valueOf('调整字段') === '持续回合' || !valueOf('调整字段');
    }
    if (prototype === '时窗修正' && key === '调整tick') return valueOf('调整字段') === '有效期tick';
    if (prototype === '时窗修正' && key === '调整次数') return ['触发次数', '使用次数'].includes(valueOf('调整字段'));
    if (prototype === '时窗修正' && key === '结算倍率') {
      return (
        valueOf('调整字段') === '持续回合' &&
        valueOf('调整方式') === '压缩'
      );
    }
    if (prototype === '机制授予' && key === '可用次数') {
      return !机制授予目标允许下次行动触发(target) || valueOf('触发条件') !== '随下次行动触发';
    }
    return true;
  }
  // —— B:25999-26024
  function 读取技能设计台原型字段列表(原型 = '', effect = {}, context = {}) {
    const 原型名 = normalizeSkillUiText(原型, '');
    const 定义 = SKILL_DESIGNER_PROTOTYPE_REGISTRY[原型名];
    const 字段 = Array.isArray(定义 && 定义['允许字段']) ? [...定义['允许字段']] : [];
    if (原型名 === '结算修正') {
      const 支持字段 = 技能设计台结算修正支持字段矩阵[normalizeSkillUiText(effect && effect['结算'], '')];
      if (支持字段) 字段.push(...支持字段);
    }
    const 允许字段 = key => key && !技能设计台原型字段隐藏集合.has(key) && (key !== '对应等级' || !!(context && context.允许对应等级));
    if (原型名 === '炸环' && !字段.includes('强化倍率')) return ['目标', '原型', '生效方式', '强化倍率', '条件分支'];
    if (原型名 === '规则改写') {
      const 规则 = normalizeSkillUiText(effect && effect['规则'], '束手');
      const 固定顺序 = 规则 === '死亡转存活'
        ? ['规则', '数值', '生效方式', '条件分支']
        : ['规则', '目标', '持续回合', '生效方式', '条件分支'];
      return 固定顺序.filter(key =>
        字段.includes(key) &&
        允许字段(key) &&
        技能设计台原型字段是否显示(原型名, key, effect),
      );
    }
    return Array.from(new Set(字段))
      .map(key => normalizeSkillUiText(key, ''))
      .filter(允许字段)
      .filter(key => 技能设计台原型字段是否显示(原型名, key, effect));
  }
  // —— B:26026-26169
  function 读取技能设计台原型字段定义(原型 = '', 字段 = '', options = {}) {
    const 原型名 = normalizeSkillUiText(原型, '');
    const 字段名 = normalizeSkillUiText(字段, '');
    if (原型名 === '规则改写' && 字段名 === '数值' && normalizeSkillUiText(options?.当前效果?.['规则'] || options?.规则, '') === '死亡转存活') {
      return { 字段: 字段名, 类型: '带符号数值', 默认值: '+25%' };
    }
    if (原型名 === '战斗外复活' && 字段名 === '数值') {
      return { 字段: 字段名, 类型: '带符号数值', 默认值: '+25%' };
    }
    if (原型名 === '战斗外复活' && 字段名 === '死亡时限tick') {
      return { 字段: 字段名, 类型: '整数', 默认值: '144', 最小值: 1, 最大值: 10080 };
    }
    if (原型名 === '战斗外复活' && 字段名 === '复活代价类型') {
      return { 字段: 字段名, 类型: '枚举', 选项: 技能设计台战斗外复活代价类型选项, 默认值: '状态代价' };
    }
    if (原型名 === '战斗外复活' && 字段名 === '复活代价对象') {
      const 代价类型 = normalizeSkillUiText(options?.当前效果?.['复活代价类型'] || options?.复活代价类型, '状态代价');
      const 选项 = 代价类型 === '消耗实体物品'
        ? 技能设计台战斗外复活物品代价对象选项
        : 代价类型 === '封印能力'
          ? 技能设计台战斗外复活封印代价对象选项
          : 代价类型 === '永久代价'
            ? 技能设计台战斗外复活永久代价对象选项
            : [...技能设计台战斗外可继承状态选项, ...技能设计台日常系统状态选项];
      return { 字段: 字段名, 类型: '枚举', 选项, 默认值: 选项[0] || '虚弱' };
    }
    if (原型名 === '战斗外复活' && 字段名 === '复活后状态') {
      return { 字段: 字段名, 类型: '枚举', 选项: [...技能设计台战斗外可继承状态选项, ...技能设计台日常系统状态选项], 默认值: '虚弱' };
    }
    if (原型名 === '战斗外复活' && ['复活代价时限tick', '复活后状态时限tick'].includes(字段名)) {
      return { 字段: 字段名, 类型: '整数', 默认值: '144', 最小值: 1, 最大值: 10080 };
    }
    if (原型名 === '状态移除' && 字段名 === '数量') {
      return { 字段: 字段名, 类型: '枚举', 选项: ['1', '2', '3', '全部'], 默认值: '1' };
    }
    if (原型名 === '时光回溯' && 字段名 === '发动方式') {
      return { 字段: 字段名, 类型: '枚举', 选项: ['主动', '被动'], 默认值: '被动' };
    }
    if (原型名 === '时窗修正' && 字段名 === '调整回合') {
      return { 字段: 字段名, 类型: '整数', 默认值: '1', 最小值: 1, 最大值: 3 };
    }
    if (原型名 === '时窗修正' && 字段名 === '调整tick') {
      return { 字段: 字段名, 类型: '整数', 默认值: '6', 最小值: 1, 最大值: 1008 };
    }
    if (原型名 === '时窗修正' && 字段名 === '调整次数') {
      return { 字段: 字段名, 类型: '整数', 默认值: '1', 最小值: 1, 最大值: 3 };
    }
    if (原型名 === '时窗修正' && 字段名 === '单日使用次数上限') {
      return { 字段: 字段名, 类型: '整数', 默认值: '1', 最小值: 1, 最大值: 3 };
    }
    if (原型名 === '时光回溯' && 字段名 === '驱动属性') {
      return { 字段: 字段名, 类型: '枚举', 选项: ['无', '力量', '防御', '敏捷', '魂力上限', '精神力上限', '体力上限'], 默认值: '精神力上限' };
    }
    if (原型名 === '时光回溯' && 字段名 === '影响方向') {
      return { 字段: 字段名, 类型: '枚举', 选项: ['成功率', '效果强度'], 默认值: '成功率' };
    }
    if (原型名 === '炸环' && 字段名 === '强化倍率') {
      return { 字段: 字段名, 类型: '带符号数值', 默认值: '+100%' };
    }
    if (原型名 === '结算修正' && 字段名 === '吸收资源') {
      return { 字段: 字段名, 类型: '枚举', 选项: 技能设计台伤害吸收资源选项, 默认值: '生命' };
    }
    if (原型名 === '结算修正' && 字段名 === '吸收来源') {
      return { 字段: 字段名, 类型: '枚举', 选项: 技能设计台伤害吸收来源选项, 默认值: '造成伤害' };
    }
    if (原型名 === '结算修正' && 字段名 === '转化效果') {
      return { 字段: 字段名, 类型: '枚举', 选项: ['', '恢复资源', '下次造成伤害'], 默认值: '' };
    }
    if (原型名 === '结算修正' && 字段名 === '增幅上限') {
      return { 字段: 字段名, 类型: '带符号数值', 默认值: '+100%' };
    }
    if (原型名 === '结算修正' && 字段名 === '对应等级') {
      return { 字段: 字段名, 类型: '整数', 默认值: '10', 最小值: 1, 最大值: 180 };
    }
    if (原型名 === '结算修正' && 字段名 === '转移对象') {
      return { 字段: 字段名, 类型: '枚举', 选项: 技能设计台伤害转移对象选项, 默认值: '攻击者' };
    }
    if (原型名 === '结算修正' && 字段名 === '数量') {
      return { 字段: 字段名, 类型: '整数', 默认值: '1', 最小值: 1 };
    }
    if (原型名 === '魂骨年限提升' && 字段名 === '数值') {
      return { 字段: 字段名, 类型: '带符号数值', 默认值: '+10%' };
    }
    if (原型名 === '魂骨年限提升' && 字段名 === '年限上限') {
      return { 字段: 字段名, 类型: '整数', 默认值: '10000', 最小值: 1, 最大值: 10000 };
    }
    if (
      原型名 === '结算修正' &&
      字段名 === '结算' &&
      options &&
      options.禁用释放前降低结算 &&
      解析技能设计台正负数值(options?.当前效果?.['数值'] ?? options?.['数值']) < 0
    ) {
      const 字段定义 = SKILL_DESIGNER_PROTOTYPE_REGISTRY[原型名]?.['字段定义']?.[字段名] || {};
      const 选项 = normalizeSkillDesignerOptionList(字段定义['选项']).map(item => normalizeSkillUiText(item.value, '')).filter(Boolean);
      return {
        ...字段定义,
        类型: '枚举',
        选项: 选项.filter(选项值 => !['消耗', '前摇'].includes(选项值)),
        默认值: '造成伤害',
      };
    }
    if (原型名 === '资源锁定' && 字段名 === '锁定类型') {
      return { 字段: 字段名, 类型: '枚举', 选项: 技能设计台资源锁定类型选项, 默认值: '回复锁定' };
    }
    if (原型名 === '状态转移' && 字段名 === '来源') {
      return { 字段: 字段名, 类型: '枚举', 选项: ['自身', '目标', '友方', '敌方'], 默认值: '自身' };
    }
    if (原型名 === '状态转移' && 字段名 === '去向') {
      return { 字段: 字段名, 类型: '枚举', 选项: ['自身', '目标', '友方', '敌方'], 默认值: '目标' };
    }
    const 定义 = SKILL_DESIGNER_PROTOTYPE_REGISTRY[原型名];
    const 字段定义 = 定义 && 定义['字段定义'] && typeof 定义['字段定义'] === 'object' ? 定义['字段定义'][字段名] : null;
    if (原型名 === '状态施加' && 字段名 === '状态' && 字段定义 && typeof 字段定义 === 'object') {
      const 正式状态选项 = (Array.isArray(字段定义['选项']) ? 字段定义['选项'] : [])
        .map(item => normalizeSkillUiText(item, ''))
        .filter(item => item && !/^任意/.test(item));
      return {
        ...字段定义,
        类型: '枚举',
        选项: 构建技能设计台状态施加分组选项(正式状态选项),
      };
    }
    if (原型名 === '状态施加' && 字段名 === '副数值') {
      return { 字段: 字段名, 类型: '带符号数值', 默认值: 技能设计台状态施加默认副数值(options?.当前效果?.['状态'] || options?.状态) };
    }
    if (原型名 === '规则防御' && 字段名 === '规则' && 字段定义 && typeof 字段定义 === 'object') {
      return {
        ...字段定义,
        选项: (Array.isArray(字段定义['选项']) ? 字段定义['选项'] : []).filter(item =>
          ['免伤', '免死'].includes(normalizeSkillUiText(item, '')),
        ),
      };
    }
    if (原型名 === '属性修正' && 字段名 === '属性' && 字段定义 && typeof 字段定义 === 'object') {
      return {
        ...字段定义,
        选项: (Array.isArray(字段定义['选项']) ? 字段定义['选项'] : []).filter(item =>
          ['力量', '防御', '敏捷', '生命上限', '体力上限', '魂力上限', '精神力上限'].includes(normalizeSkillUiText(item, '')),
        ),
      };
    }
    return 字段定义 && typeof 字段定义 === 'object' ? 字段定义 : { 字段: 字段名, 类型: '文本', 选项: [] };
  }
  // —— B:26171-26236
  function 读取技能设计台原型字段选项(原型 = '', 字段 = '', options = {}) {
    const 原型名 = normalizeSkillUiText(原型, '');
    const 字段名 = normalizeSkillUiText(字段, '');
    if (原型名 === '状态交换' && 字段名 === '状态') {
      const 状态选项 = 读取技能设计台原型字段选项('状态施加', '状态').filter(状态 => 技能设计台状态施加是负面语义(状态));
      return [{ label: '交出状态', options: ['任意负面', ...状态选项] }];
    }
    // 护盾模式是严格三值枚举：结构校验对非法值直接 throw，不能留成自由输入框。
    if (原型名 === '护盾变化' && 字段名 === '护盾模式') return ['正向护盾', '斩盾', '窃盾'];
    if (原型名 === '状态移除' && 字段名 === '匹配原型') return ['无', '资源变化', '护盾变化'];
    if (原型名 === '状态移除' && 字段名 === '资源') return ['生命'];
    if (原型名 === '机制授予' && 字段名 === '触发条件') {
      return 读取技能设计台机制授予触发条件选项(options?.当前效果?.['目标'] || options?.目标 || '单体');
    }
    if (原型名 === '战斗外复活' && 字段名 === '复活代价类型') return 技能设计台战斗外复活代价类型选项;
    if (原型名 === '战斗外复活' && 字段名 === '复活代价对象') {
      const 代价类型 = normalizeSkillUiText(options?.当前效果?.['复活代价类型'] || options?.复活代价类型, '状态代价');
      if (代价类型 === '消耗实体物品') return 技能设计台战斗外复活物品代价对象选项;
      if (代价类型 === '封印能力') return 技能设计台战斗外复活封印代价对象选项;
      if (代价类型 === '永久代价') return 技能设计台战斗外复活永久代价对象选项;
      return [...技能设计台战斗外可继承状态选项, ...技能设计台日常系统状态选项];
    }
    if (原型名 === '战斗外复活' && 字段名 === '复活后状态') return [...技能设计台战斗外可继承状态选项, ...技能设计台日常系统状态选项];
    if (['状态移除', '状态转移'].includes(原型名) && 字段名 === '状态') {
      const 字段定义 = 读取技能设计台原型字段定义(原型名, 字段名);
      const 原始选项 = Array.isArray(字段定义['选项']) ? 字段定义['选项'] : [];
      const 匹配占位 = 原始选项.filter(选项值 => ['任意状态', '任意负面', '任意增益'].includes(normalizeSkillUiText(选项值, '')));
      const 正式状态 = 原始选项.filter(选项值 => !匹配占位.includes(选项值));
      return [
        { label: '匹配占位', options: 匹配占位 },
        { label: '正式状态', options: 正式状态 },
      ].filter(分组 => 分组.options.length);
    }
    if (字段名 === '影响方向') {
      if (原型名 === '时光回溯') {
        const 发动方式 = normalizeSkillUiText(options?.当前效果?.['发动方式'] || options?.发动方式 || '', '被动');
        return 发动方式 === '主动' ? ['成功率', '效果强度'] : ['成功率'];
      }
      if (原型名 === '伤害结算') return ['效果强度'];
      if (原型名 === '资源锁定') return ['成功率', '效果强度', '消耗', '前摇'];
      if (原型名 === '复制执行') return ['效果强度', '消耗', '前摇'];
      if (原型名 === '机制授予') return ['成功率', '效果强度', '持续时间', '消耗', '前摇'];
      if (原型名 === '状态施加') {
        const 当前效果 = options?.当前效果 || {};
        const 有持续回合 = parseSkillDesignerIntegerInputValue(当前效果['持续回合'], 0, 0) > 0;
        return 有持续回合 ? ['成功率', '效果强度', '持续时间', '消耗', '前摇'] : ['成功率', '效果强度', '消耗', '前摇'];
      }
      if (原型名 === '时窗修正') {
        const 调整字段 = normalizeSkillUiText(options?.当前效果?.['调整字段'] || '', '持续回合');
        return ['持续回合', '有效期tick'].includes(调整字段)
          ? ['持续时间', '消耗', '前摇']
          : ['效果强度', '消耗', '前摇'];
      }
      return ['成功率', '效果强度', '持续时间', '消耗', '前摇'];
    }
    if (原型名 === '时窗修正' && 字段名 === '调整字段') {
      return [
        '持续回合',
        '有效期tick',
        '触发次数',
        '使用次数',
      ];
    }
    const 定义 = 读取技能设计台原型字段定义(原型, 字段, options);
    return normalizeSkillDesignerOptionList(定义['选项']).map(item => normalizeSkillUiText(item.value, '')).filter(Boolean);
  }
  // —— B:26238-26283
  function 构建技能设计台原型字段下拉选项(字段 = '', 选项 = [], 是必填 = false) {
    const 字段名 = normalizeSkillUiText(字段, '');
    const 标签表 = {
      驱动属性: {
        力量: '力量｜按力量差影响',
        防御: '防御｜按防御差影响',
        敏捷: '敏捷｜按敏捷差影响',
        魂力上限: '魂力上限｜按魂力差影响',
        精神力上限: '精神力上限｜按精神差影响',
        体力上限: '体力上限｜按体魄差影响',
      },
      影响方向: {
        成功率: '成功率｜影响命中概率',
        效果强度: '效果强度｜影响数值大小',
        持续时间: '持续时间｜影响持续长短',
        消耗: '消耗｜影响自身消耗',
        前摇: '前摇｜影响自身前摇',
      },
      调整字段: {
        有效期tick: '造物有效期',
      },
      规则: {
        死亡转存活: '复活',
      },
    };
    const 原始选项 = Array.isArray(选项) ? 选项 : [];
    const 是否分组 = 原始选项.some(item => item && typeof item === 'object' && !Array.isArray(item));
    const 构建标签 = 值 => 标签表[字段名]?.[值] || 值;
    const 显示选项 = 是否分组
      ? 原始选项
          .filter(item => item && typeof item === 'object')
          .map(item => ({
            label: normalizeSkillUiText(item.label, ''),
            options: (Array.isArray(item.options) ? item.options : [])
              .filter(值 => 值 !== '无')
              .map(值 => ({ value: 值, label: 构建标签(值) })),
          }))
          .filter(item => item.label && item.options.length)
      : 原始选项
          .filter(item => item !== '无')
          .map(item => ({
            value: item,
            label: 构建标签(item),
          }));
    return 是必填 ? 显示选项 : [{ value: '无', label: '默认无' }, ...显示选项];
  }
  // —— B:26285-26452
  function 获取技能设计台原型字段提示(原型 = '', 字段 = '', effect = {}) {
    const 原型名 = normalizeSkillUiText(原型, '');
    const 字段名 = normalizeSkillUiText(字段, '');
    const 结算 = normalizeSkillUiText(effect && effect['结算'], '');
    const 数值口径 = 读取技能设计台数值字段口径(原型名, 字段名, effect);
    const 通用提示表 = {
      原型: '选择技能效果的结构类型；切换后表单字段会按该原型重建。',
      目标: '选择该原型实际作用对象。',
      生效方式: '主效果用独立生效；副效果只有必须跟主效果命中、结算或存在同一前置时才用跟随主原型。',
      条件分支: '只有效果需要满足条件才触发、替换或禁用时开启；普通直达效果不要开。',
      数值: 数值口径 === '百分比'
        ? '按百分点填写；右侧单位固定为百分比。'
        : 数值口径 === '混合'
          ? '右侧选择点数或百分比；切换单位不换算数字。'
          : '填写实际强度，正负号表达方向。',
      副数值: 数值口径 === '百分比'
        ? '按百分点填写；右侧单位固定为百分比。'
        : '填写附加强度，正负号表达方向。',
      持续回合: '命中后保留几回合；不影响后来入场目标。',
      延迟回合: '只用于需要延迟落地的战斗效果；无延迟时不要落盘。',
      触发限制: '限制触发周期和次数；只在规则壳或限定触发次数的效果上填写。',
      驱动属性: '选择无时不按属性差缩放；选择属性时按双方属性差影响指定方向。',
      影响方向: '说明驱动属性影响什么：成功率、效果强度、持续时间、消耗或前摇。',
      概率: '只在效果本身不是必定发生时填写；确定生效不要用概率占位。',
      数量: '限制本次处理的目标、状态、链式对象或机制数量；不限制时按原型默认。',
      打断效果: '只在负向判定修正会打断释放、蓄力、引导时勾选；普通命中加成不要勾。',
      强化倍率: '基础属性增幅比例，运行时会再乘以炸掉魂环的年限系数，只影响下一次魂技释放时的自身属性。',
    };
    const 原型提示表 = {
      伤害结算: {
        威力倍率: '技能基础伤害倍率；直伤主效果才填，持续 DOT 不用它伪装。',
        攻击段数: '多段攻击的段数；每段都能参与命中/护盾/触发时才提高。',
        伤害类型: '选择攻击口径：近身攻击、远程攻击、精神攻击或真实攻击；目标范围仍由目标字段决定。',
        防御穿透: '内联穿透百分比；只在本次伤害自身带破防时填写。',
      },
      资源变化: {
        资源: '选择恢复或扣减的资源；生命负数必须走伤害结算。',
      },
      资源转移: {
        资源: '选择要回收、共享或重分配的资源。',
        资源转移方式: '吞噬扣目标并回补自身，共享或转移由自身给目标，均分按目标集合重分配。',
        转化比例: '吞噬、共享或转移时的换算比例；均分不要填。',
      },
      属性修正: {
        属性: '选择要改变的面板属性；多属性增减应明确每个属性。',
      },
      护盾变化: {
        护盾模式: '选择护盾效果类型：正向护盾、斩盾或窃盾。',
        数值: '正向护盾填增加量；斩盾/窃盾填削减比例，设计台会按模式自动修正正负号。',
        持续回合: '只用于正向护盾保留；斩盾和窃盾是即时结算。',
      },
      判定修正: {
        判定: '选择要修改的判定入口；命中影响技能成功命中，闪避/反应影响躲避与响应。',
      },
      结算修正: {
        结算: '选择要修正的结算环节；伤害/治疗/消耗/前摇用数值正负表达增减。',
        数值: 结算 === '伤害转移'
          ? '转移比例；例如 +30% 表示受击成立续，将本次伤害的30%打到转移对象身上。'
          : ['伤害分摊', '消耗分摊'].includes(结算)
          ? '分摊比例；例如 +30% 表示把本次伤害或消耗的30%转给同阵营其他存活单位。'
          : '消耗/前摇可填百分比或绝对值；消耗绝对值按当前技能实际消耗加减，前摇绝对值单位为tick。其他结算只填百分比。',
        持续回合: ['消耗', '前摇'].includes(结算)
          ? '持续1回合适合一次性起手修正，例如白天施展更省力、蓄势完成续更快出手；需要由某个主效果触发时，可放在条件分支追加效果或跟随主原型。'
          : '只在结算修正需要跨回合保留时填写；即时修正不要填。',
        数量: '群体分摊时最多由几个同阵营其他存活单位承接；单体分摊不需要数量。',
        转移对象: '受击成立续，额外伤害落到谁身上。',
        吸收来源: '选伤害吸收时才填：吸收「造成伤害」按你打出的量转化，吸收「受到伤害」按你挨打的量转化。',
        吸收资源: '吸收得到的量补进哪种资源；运行时按该资源结算，不填按生命处理。',
        限定元素: '限定当前行动技能元素；未命中元素不计收益。',
        结算倍率: '持续伤害压缩或引爆用倍率；普通时长调整不要填。',
      },
      状态施加: {
        状态: '选择要施加的正式状态；正式状态会直接写入战斗效果。',
        数值: '状态主效果强度；例如每回合掉血、治疗削弱、护盾量、反应下降。',
        副数值: '状态附加效果强度；例如命中下降、承伤提高、技能消耗提高、闪避下降。',
      },
      时窗修正: {
        调整字段: '选择要调整的窗口对象。',
        调整方式: '延长增加剩余窗口，压缩减少剩余窗口。',
        调整回合: '持续回合窗口的调整量，最多3回合。',
        调整tick: '本次生成造物有效期的调整量，最多7天。',
        调整次数: '触发次数或使用次数的调整量，最多3次。',
        单日使用次数上限: '单日最多使用几次该时窗修正。',
        结算倍率: '只允许 DOT 压缩时填写，范围 +50%~+300%。',
      },
      状态移除: {
        状态: '选择要移除的状态；普通净化/驱散只填这里。被动在「被控制时」选「触发来源」＝只移除触发这次被动的那个控制。',
        匹配原型: '高级筛选：按状态内部效果筛选；例如只移除带持续扣生命效果的状态。',
        资源: '仅在匹配原型为资源变化时填写，用于筛 DOT、恢复等状态。',
        数值方向: '仅在匹配资源变化时填写，区分正向恢复、负向扣减或任意。',
      },
      规则防御: {
        规则: '免伤用于抵消伤害，免死用于致命结算锁血。',
        次数: '规则壳可触发次数；触发后会扣减，用光即移除（可再次获得）。',
        计次: '按段：多段攻击每挡一段扣一次（缺省）；整招：同一次出手的所有段只扣一次。',
      },
      状态转移: {
        状态: '指定状态或任意状态。',
        来源: '状态从谁身上取出。',
        去向: '状态被搬到谁身上。',
      },
      状态交换: {
        状态: '选择自身要交出的负面状态；目标侧固定夺取一个增益状态。',
      },
      资源锁定: {
        资源: '要锁定的资源类型。',
        锁定类型: '资源池锁定压低可用上限；回复锁定削减恢复；转化锁定削减吞噬、共享、吸收回补。',
        数值: '锁定比例，正百分比；10% 与 +10% 都表示锁定 10%。',
      },
      规则改写: {
        规则: '选择要临时改写的定向结算规则。',
        持续回合: '规则改写器持续回合；不作为状态写入。',
      },
      机制抹消: {
        抹消对象: '填写原型匹配器；源动作、中间机制和最终结果都会按它匹配。',
      },
      机制授予: {
        授予效果: '被授予后实际可触发的效果列表；不能再嵌套授予机制。',
        触发条件: '主动触发进入技能池；下次行动触发一次；魂技成功释放触发每次扣一次，未命中不代表释放失败。待机期限可留空。',
        可用次数: '主动触发时授予壳还能使用几次。',
        持续回合: '主动触发时必须在几回合内使用。',
      },
      复制执行: {
        复制类型: '选择复制技能、复制属性或复制全部。',
        复制模式: '即时镜像响应战斗动作，复刻友方走剧情裁定。',
        保存上限: '最多保存多少个复刻技能。',
        削减比例: '只影响复制属性和复制全部。',
        保留回合: '复制结果保留多久。',
        保留时长tick: '非战斗保留多久。',
      },
      时光回溯: {
        目标: '单体会覆盖施术者与主目标；全场不分敌我，主动排除施术者。',
        发动方式: '主动释放时压低目标反应；被动=目标结算前回溯规避。',
        驱动属性: '默认精神力上限，可改。',
        影响方向: '主动可影响成功率或反应压制强度；被动只影响成功率。',
      },
      位移执行: {
        位移类型: '拉近、击退、换位、瞬移或脱离。',
        位移对象: '选择战斗收益或压制落在自身、目标还是双方。',
        距离: '位移幅度；越大对行动、反应与命中压制影响越强。',
        数值: '可选强度覆写；只填百分比，不填时按位移幅度自动折算。',
        持续回合: '战斗收益或压制持续多久，默认1回合。',
      },
      决策干扰: {
        干扰: '选择判断干扰或索敌干扰。',
        数值: '例如 20%，越高干扰越强。',
      },
      修炼增益: {
        收益类型: '选择按属性修炼速度，或按训练方式收益。',
        修炼属性: '只影响该属性的成长速度。',
        训练方式: '只影响该训练方式的收益。',
        有效期tick: '收益修正保留多久。',
      },
      召唤生成: {
        召唤单位类型: '决定召唤物类别。',
        召唤物名称: '运行时显示和状态引用的召唤物名称。',
        行动模式: '决定召唤物协同、护卫或自主行动。',
        强度: '非继承召唤的固定战力系数。',
        力量继承比例: '按召唤者力量折算。',
        防御继承比例: '按召唤者防御折算。',
        敏捷继承比例: '按召唤者敏捷折算。',
        体力继承比例: '按召唤者体力上限折算。',
        魂力继承比例: '按召唤者魂力上限折算。',
        精神继承比例: '按召唤者精神力上限折算。',
        承伤规则: '护卫模式下折算为承伤收益。',
      },
    };
    return 原型提示表[原型名]?.[字段名] || 通用提示表[字段名] || '';
  }
  // —— B:26510-26514
  function 构建技能设计台说明标签(显示名 = '', 提示 = '') {
    const 文本 = normalizeSkillUiText(提示, '');
    if (!文本) return `<span class="mvu-editor-label">${htmlEscape(显示名)}</span>`;
    return `<span class="mvu-editor-label mvu-editor-label--with-hint">${htmlEscape(显示名)}<button type="button" class="mvu-editor-hint-badge" tabindex="0" aria-label="${escapeHtmlAttr(显示名)}说明" data-hint-text="${escapeHtmlAttr(文本)}">?</button></span>`;
  }
  // —— B:26516-26522
  const 技能设计台条件字段提示 = Object.freeze({
    类型: '选择用什么条件来判断，例如目标生命比例、是否命中、是否存在护盾。',
    比较: '条件的比较方式；与右侧阈值一起构成判断式。',
    处理: '条件成立时怎么办：替换掉原效果，或在原效果之外追加。',
    替换效果: '条件成立时改为执行这里的效果，原效果不再结算。',
    追加效果: '条件成立时在原效果之外额外执行这里的效果。',
  });
  // —— B:26524-26530
  const 技能设计台副作用字段提示 = Object.freeze({
    类型: '选择副作用的种类；不同种类决定下面填强度还是关联效果。',
    时机: '副作用在什么时候结算：效果生效后、命中后、回合结束时或效果结束后。',
    对象: '副作用落在谁身上：技能释放者、效果承受者或双方。',
    概率: '副作用的触发概率；填 100% 表示必定触发。',
    持续: '副作用生效几个回合。',
  });
  // —— B:26532-26545
  function 构建技能设计台原型字段标签(原型 = '', 字段 = '', 显示名 = '', effect = {}) {
    const 提示 = 获取技能设计台原型字段提示(原型, 字段, effect);
    const 原型名 = normalizeSkillUiText(原型, '');
    const 字段名 = normalizeSkillUiText(字段, '');
    const 基础标签 = 原型名 === '炸环' && 字段名 === '强化倍率'
      ? '强化倍率 × 年限'
      : 原型名 === '状态施加' && ['数值', '副数值'].includes(字段名)
        ? 技能设计台状态施加字段显示名(effect && effect['状态'], 字段名)
        : 显示名 || 字段;
    // 说明改为图标触发：常驻小字会把表单堆成一堵字墙，纯 title 又让触屏无解。
    // 折中为标签旁一个 ? 徽标，hover 与 focus 都能唤出气泡，且可被键盘聚焦。
    if (!提示) return `<span class=\"mvu-editor-label\">${htmlEscape(基础标签)}</span>`;
    return `<span class=\"mvu-editor-label mvu-editor-label--with-hint\">${htmlEscape(基础标签)}<button type=\"button\" class=\"mvu-editor-hint-badge\" tabindex=\"0\" aria-label=\"${escapeHtmlAttr(基础标签)}说明\" data-hint-text=\"${escapeHtmlAttr(提示)}\">?</button></span>`;
  }
  // —— B:26547-26550
  function 技能设计台原型字段是否必填(原型 = '', 字段 = '') {
    const 定义 = SKILL_DESIGNER_PROTOTYPE_REGISTRY[normalizeSkillUiText(原型, '')] || {};
    return Array.isArray(定义['必填字段']) && 定义['必填字段'].includes(字段);
  }
  // —— B:26552-26616
  function 创建技能设计台默认原型效果(原型 = '伤害结算', target = '单体') {
    const prototype = normalizeSkillUiText(原型, 读取技能设计台原型名称列表()[0] || '伤害结算');
    const effect = {
      原型: prototype,
      目标: prototype === '时光回溯'
        ? normalizeSkillDesignerTimeRewindTargetValue(target, '单体')
        : normalizeSkillDesignerEffectTargetValue(target, '单体'),
    };
    const 定义 = SKILL_DESIGNER_PROTOTYPE_REGISTRY[prototype] || {};
    const 必填字段 = Array.isArray(定义['必填字段']) ? 定义['必填字段'] : [];
    必填字段.forEach(key => {
      const 字段定义 = 读取技能设计台原型字段定义(prototype, key);
      const 类型 = normalizeSkillUiText(字段定义['类型'], '文本');
      const 选项 = 读取技能设计台原型字段选项(prototype, key);
      if (字段定义['默认值'] !== undefined) effect[key] = cloneJsonValue(字段定义['默认值']);
      else if (key === '威力倍率') effect[key] = 100;
      else if (key === '伤害类型') effect[key] = '近身攻击';
      else if (key === '数值') effect[key] = '+10%';
      else if (key === '数量' || key === '次数') effect[key] = 1;
      else if (类型 === '原型列表') effect[key] = [创建技能设计台默认原型效果('判定修正', effect['目标'])];
      else if (类型 === '对象') effect[key] = {};
      else if (类型 === '枚举' || 类型 === '多枚举') effect[key] = getSkillDesignerFirstOptionValue(选项, '');
      else effect[key] = '';
    });
    if (prototype === '状态施加') {
      const 状态名 = normalizeSkillUiText(effect['状态'], '眩晕');
      effect['状态'] = 状态名;
    }
    if (prototype === '护盾变化') {
      effect['护盾模式'] = '正向护盾';
    }
    if (prototype === '时窗修正') {
      const 调整字段 = normalizeSkillUiText(effect['调整字段'], '持续回合');
      effect['调整字段'] = 调整字段;
      effect['调整方式'] = normalizeSkillUiText(effect['调整方式'], '延长');
      if (调整字段 === '持续回合') {
        effect['调整回合'] = Math.max(1, Math.min(3, Number(effect['调整回合'] || 1)));
        delete effect['状态'];
        delete effect['造物名称'];
        if (effect['调整方式'] !== '压缩') delete effect['结算倍率'];
        else effect['结算倍率'] = normalizeSkillUiText(effect['结算倍率'], '+100%');
      } else if (调整字段 === '有效期tick') {
        effect['调整tick'] = Math.max(1, Math.min(1008, Number(effect['调整tick'] || 6)));
        delete effect['状态'];
        delete effect['造物名称'];
      } else if (['触发次数', '使用次数'].includes(调整字段)) {
        effect['调整次数'] = Math.max(1, Math.min(3, Number(effect['调整次数'] || 1)));
        delete effect['状态'];
        delete effect['造物名称'];
      }
      effect['单日使用次数上限'] = Math.max(1, Math.min(3, Math.round(Number(effect['单日使用次数上限'] || 1))));
    }
    if (prototype === '修炼增益') {
      const 收益类型 = normalizeSkillUiText(effect['收益类型'], '训练方式收益');
      effect['收益类型'] = ['属性修炼速度', '训练方式收益'].includes(收益类型) ? 收益类型 : '训练方式收益';
      if (effect['收益类型'] === '属性修炼速度') {
        effect['修炼属性'] = normalizeSkillUiText(effect['修炼属性'], '魂力上限');
        delete effect['训练方式'];
      } else {
        effect['训练方式'] = normalizeSkillUiText(effect['训练方式'], '冥想');
        delete effect['修炼属性'];
      }
    }
    return effect;
  }
  // —— B:26618-26620
  function 技能设计台按上下文默认目标(原型 = '伤害结算', fallbackTarget = '单体', context = {}) {
    return 约束技能设计台原型正式目标(原型, fallbackTarget, fallbackTarget);
  }
  // —— B:26622
  const 技能设计台分身目标允许原型集合 = new Set(['资源变化', '属性修正', '判定修正', '结算修正']);
  // —— B:26624-26626
  function 技能设计台原型允许分身目标(原型 = '') {
    return 技能设计台分身目标允许原型集合.has(normalizeSkillUiText(原型, ''));
  }
  // —— B:26628-26631
  function 约束技能设计台分身目标(原型 = '', 目标 = '') {
    const 当前目标 = normalizeSkillDesignerEffectTargetValue(目标, '单体');
    return 当前目标 === '分身' && !技能设计台原型允许分身目标(原型) ? '单体' : 当前目标;
  }
  // —— B:26633-26646
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
  // —— B:26648-26664
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
    if (原型名 === '时光回溯') return normalizeSkillDesignerTimeRewindTargetValue(当前目标, '单体');
    if (['召唤生成', '炸环'].includes(原型名)) return '自身';
    if (['伤害结算', '资源转移'].includes(原型名) && !['单体', '群体', '全场'].includes(当前目标)) return '单体';
    if (原型名 === '修炼增益' && 当前目标 === '召唤物') return 默认目标 === '自身' ? '自身' : '单体';
    if (当前目标 === '全场' && 技能设计台效果是正向辅助(原型名, 效果 || {})) return '群体';
    return 当前目标;
  }
  // —— B:26666-26684
  function 读取技能设计台目标候选(原型 = '', context = {}) {
    const 原型名 = normalizeSkillUiText(原型, '');
    const 嵌套字段 = normalizeSkillUiText(context && context.嵌套字段, '');
    const 当前状态 = normalizeSkillUiText(context?.当前效果?.['状态'], '');
    if (原型名 === '状态施加' && 当前状态 === '护卫') return ['单体', '群体', '全场'];
    if (原型名 === '修炼增益') return ['自身', '单体', '群体', '全场'];
    if (嵌套字段 === '授予效果') return 技能设计台原型允许分身目标(原型名) ? SKILL_DESIGNER_CLONE_TARGET_OPTIONS : SKILL_DESIGNER_TARGET_OPTIONS;
    if (嵌套字段 === '使用效果') return 技能设计台原型允许分身目标(原型名) ? SKILL_DESIGNER_CLONE_TARGET_OPTIONS : SKILL_DESIGNER_TARGET_OPTIONS;
    if (嵌套字段 === '结算效果') return 技能设计台原型允许分身目标(原型名) ? SKILL_DESIGNER_CLONE_TARGET_OPTIONS : SKILL_DESIGNER_TARGET_OPTIONS;
    if (原型名 === '时光回溯') return 读取技能设计台时光回溯目标候选(context?.当前效果 || {}, context);
    if (原型名 === '结算修正' && ['伤害分摊', '消耗分摊'].includes(normalizeSkillUiText(context?.当前效果?.['结算'], ''))) return 技能设计台分摊结算目标候选();
    if (技能设计台原型允许分身目标(原型名)) return ['自身', '单体', '群体', '全场', '分身'];
    if (原型名 === '伤害结算') return ['单体', '群体', '全场'];
    if (原型名 === '战斗外复活') return ['单体', '群体', '全场'];
    if (原型名 === '状态转移' || 原型名 === '状态交换') return ['单体'];
    if (原型名 === '状态移除' || 原型名 === '规则防御') return ['自身', '单体', '群体'];
    if (技能设计台效果是正向辅助(原型名, context?.当前效果 || {})) return ['自身', '单体', '群体'];
    return ['自身', '单体', '群体', '全场'];
  }
  // —— B:26686-26879
  function 技能设计台清理并水合原型效果(effect = {}, fallbackTarget = '单体', context = {}) {
    const source = effect && typeof effect === 'object' && !Array.isArray(effect) ? effect : {};
    const prototype = normalizeSkillUiText(source['原型'], '伤害结算');
    const 定义 = SKILL_DESIGNER_PROTOTYPE_REGISTRY[prototype] || {};
    const 允许字段 = new Set(Array.isArray(定义['允许字段']) ? 定义['允许字段'] : ['原型', '目标']);
    if (!(context && context.允许对应等级)) 允许字段.delete('对应等级');
    const target = 技能设计台按上下文默认目标(prototype, source['目标'] || fallbackTarget, context);
    const next = 创建技能设计台默认原型效果(prototype, target);
    ['原型', '目标', '生效方式', '条件分支'].forEach(key => {
      if (source[key] !== undefined && source[key] !== null && String(source[key]).trim() !== '')
        next[key] = cloneJsonValue(source[key]);
    });
    Object.entries(source).forEach(([key, raw]) => {
      if (!允许字段.has(key) || raw === undefined || raw === null) return;
      if (typeof raw === 'string' && !raw.trim()) return;
      next[key] = cloneJsonValue(raw);
    });
    if (prototype === '规则改写') {
      const 规则 = 技能设计台规则改写选项值.includes(normalizeSkillUiText(source['规则'], ''))
        ? normalizeSkillUiText(source['规则'], '')
        : normalizeSkillUiText(next['规则'], '束手');
      next['规则'] = 规则;
      if (规则 === '死亡转存活') {
        next['目标'] = '自身';
        next['数值'] = normalizeSkillUiText(source['数值'] ?? next['数值'], '+25%');
        delete next['持续回合'];
        delete next['死亡时限tick'];
        delete next['复活代价类型'];
        delete next['复活代价对象'];
        delete next['复活代价值'];
        delete next['复活代价时限tick'];
        delete next['复活后状态'];
        delete next['复活后状态时限tick'];
      } else {
        delete next['数值'];
        delete next['死亡时限tick'];
        delete next['复活代价类型'];
        delete next['复活代价对象'];
        delete next['复活代价值'];
        delete next['复活代价时限tick'];
        delete next['复活后状态'];
        delete next['复活后状态时限tick'];
      }
    }
    if (prototype === '战斗外复活') {
      next['数值'] = normalizeSkillUiText(source['数值'] ?? next['数值'], '+25%');
      next['死亡时限tick'] = Math.max(1, parseSkillDesignerIntegerInputValue(source['死亡时限tick'] ?? next['死亡时限tick'], 144, 1));
      next['复活代价类型'] = 技能设计台战斗外复活代价类型选项.includes(normalizeSkillUiText(source['复活代价类型'] ?? next['复活代价类型'], ''))
        ? normalizeSkillUiText(source['复活代价类型'] ?? next['复活代价类型'], '')
        : '状态代价';
      next['复活代价对象'] = normalizeSkillUiText(source['复活代价对象'] ?? next['复活代价对象'], next['复活代价类型'] === '消耗实体物品' ? '复活类丹药' : next['复活代价类型'] === '封印能力' ? '魂技' : next['复活代价类型'] === '永久代价' ? '等级上限' : '虚弱');
      next['复活代价值'] = normalizeSkillUiText(source['复活代价值'] ?? next['复活代价值'], '+1');
      next['复活代价时限tick'] = Math.max(1, parseSkillDesignerIntegerInputValue(source['复活代价时限tick'] ?? next['复活代价时限tick'], 144, 1));
      next['复活后状态'] = normalizeSkillUiText(source['复活后状态'] ?? next['复活后状态'], '虚弱');
      next['复活后状态时限tick'] = Math.max(1, parseSkillDesignerIntegerInputValue(source['复活后状态时限tick'] ?? next['复活后状态时限tick'], 144, 1));
    }
    if (prototype === '资源锁定' && source['数值'] === undefined) delete next['数值'];
    if (prototype === '机制抹消') {
      next['抹消对象'] = 规范化技能设计台机制抹消对象(next['抹消对象']);
    }
      next['原型'] = prototype;
      next['目标'] = prototype === '时光回溯'
        ? normalizeSkillDesignerTimeRewindTargetValue(target, '单体')
      : prototype === '规则改写' && normalizeSkillUiText(next['规则'], '') === '死亡转存活' && normalizeSkillUiText(next['目标'], '') === '自身'
        ? '自身'
      : prototype === '战斗外复活'
        ? 约束技能设计台原型正式目标(prototype, normalizeSkillDesignerEffectTargetValue(next['目标'] || target, '单体'), fallbackTarget)
      : prototype === '结算修正' && ['伤害分摊', '消耗分摊'].includes(normalizeSkillUiText(next['结算'], ''))
        ? 规范化技能设计台分摊结算目标(next['目标'])
      : 约束技能设计台原型正式目标(prototype, target, fallbackTarget, next);
    next['目标'] = 约束技能设计台原型正式目标(prototype, next['目标'], fallbackTarget, next);
    if (prototype === '伤害结算') {
      delete next['持续回合'];
    }
    if (prototype === '机制授予') {
      const 触发条件 = normalizeSkillUiText(next['触发条件'], '主动触发');
      next['触发条件'] = 读取技能设计台机制授予触发条件选项(next['目标']).includes(触发条件) ? 触发条件 : '主动触发';
      if (next['触发条件'] === '随下次行动触发') {
        delete next['可用次数'];
      } else {
        next['可用次数'] = Math.max(1, parseSkillDesignerIntegerInputValue(next['可用次数'], 1, 1));
      }
      if (next['触发条件'] === '主动触发' || normalizeSkillUiText(effect['持续回合'], '')) {
        next['持续回合'] = Math.max(1, parseSkillDesignerIntegerInputValue(next['持续回合'], 1, 1));
      } else delete next['持续回合'];
    }
    if (prototype === '资源变化' && next['持续回合'] !== undefined) {
      const 持续回合 = Math.max(0, Math.min(10, parseSkillDesignerIntegerInputValue(next['持续回合'], 0, 0)));
      if (持续回合 > 0) next['持续回合'] = 持续回合;
      else delete next['持续回合'];
    }
    if (prototype === '判定修正' && next['持续回合'] !== undefined) {
      const 持续回合 = Math.max(0, Math.min(10, parseSkillDesignerIntegerInputValue(next['持续回合'], 0, 0)));
      if (持续回合 > 0) next['持续回合'] = 持续回合;
      else delete next['持续回合'];
    }
    if (['资源转移', '规则防御', '状态移除', '状态转移', '状态交换'].includes(prototype) && next['持续回合'] !== undefined) {
      const 持续回合 = Math.max(0, Math.min(10, parseSkillDesignerIntegerInputValue(next['持续回合'], 0, 0)));
      if (持续回合 > 0) next['持续回合'] = 持续回合;
      else delete next['持续回合'];
    }
    if (prototype === '时光回溯') {
      next['发动方式'] = ['主动', '被动'].includes(normalizeSkillUiText(next['发动方式'], '')) ? normalizeSkillUiText(next['发动方式'], '') : '被动';
      next['目标'] = normalizeSkillDesignerTimeRewindTargetValue(next['目标'], '单体');
      if (!normalizeSkillUiText(next['驱动属性'], '')) next['驱动属性'] = '精神力上限';
      const 时光回溯方向选项 = next['发动方式'] === '主动' ? ['成功率', '效果强度'] : ['成功率'];
      if (!时光回溯方向选项.includes(normalizeSkillUiText(next['影响方向'], ''))) next['影响方向'] = '成功率';
    }
    if (prototype === '状态施加') {
      const 状态名 = normalizeSkillUiText(next['状态'], '眩晕');
      next['状态'] = 状态名;
      next['目标'] = 约束技能设计台原型正式目标(prototype, next['目标'], fallbackTarget, next);
      const 触发方式 = normalizeSkillUiText(next['触发方式'], '立即触发');
      next['触发方式'] = ['立即触发', '延迟触发', '遥控触发'].includes(触发方式)
        ? 触发方式
        : next['延迟回合'] !== undefined
          ? '延迟触发'
          : '立即触发';
      if (next['触发方式'] === '延迟触发' || next['延迟回合'] !== undefined) {
        next['延迟回合'] = Math.max(1, parseSkillDesignerIntegerInputValue(next['延迟回合'], 1, 1));
      } else {
        delete next['延迟回合'];
      }
      if (!(parseSkillDesignerIntegerInputValue(next['持续回合'], 0, 0) > 0)) next['持续回合'] = 3;
      if (技能设计台状态施加允许数值字段(状态名) && next['数值'] === undefined) {
        next['数值'] = 技能设计台状态施加默认数值(状态名);
      }
      if (技能设计台状态施加允许副数值字段(状态名) && next['副数值'] === undefined) {
        next['副数值'] = 技能设计台状态施加默认副数值(状态名);
      }
      if (状态名 === '迟缓') {
        if (!normalizeSkillUiText(next['驱动属性'], '')) next['驱动属性'] = '魂力上限';
        if (!normalizeSkillUiText(next['影响方向'], '')) next['影响方向'] = '效果强度';
      }
      if (['禁疗', '治疗反转'].includes(状态名) && next['数值'] !== undefined) {
        next['数值'] = formatSkillDesignerSignedValue(
          Math.abs(parseSkillDesignerSignedValue(next['数值'])),
          /%$/.test(normalizeSkillUiText(next['数值'], '')),
        );
      }
      if (技能设计台状态施加使用正向强度数值(状态名) && next['数值'] !== undefined) {
        next['数值'] = formatSkillDesignerSignedValue(
          Math.abs(parseSkillDesignerSignedValue(next['数值'])),
          /%$/.test(normalizeSkillUiText(next['数值'], '')),
        );
      }
      if (next['数值'] !== undefined) {
        next['数值'] = 格式化技能设计台状态施加比例字段(next['数值'], 技能设计台状态施加默认数值(状态名));
        next['数值'] = 限制技能设计台状态施加比例字段(状态名, '数值', next['数值']);
      }
      if (next['副数值'] !== undefined) {
        next['副数值'] = 格式化技能设计台状态施加比例字段(next['副数值'], 技能设计台状态施加默认副数值(状态名));
        next['副数值'] = 限制技能设计台状态施加比例字段(状态名, '副数值', next['副数值']);
      }
    }
    if (prototype === '召唤生成') {
      const 单位类型 = normalizeSkillUiText(next['召唤单位类型'], '魂兽');
      const 使用继承 = 技能设计台召唤允许继承属性比例(单位类型);
      if (使用继承) {
        next['继承属性比例'] = parseSkillDesignerPercentRatio(next['继承属性比例'] ?? next['力量继承比例'], 0.45);
        delete next['强度'];
      } else {
        if (!(toNumber(next['继承属性比例'], 0) > 0)) delete next['继承属性比例'];
        next['强度'] = Math.max(0.01, toNumber(next['强度'], 1));
      }
      delete next['力量继承比例'];
      delete next['防御继承比例'];
      delete next['敏捷继承比例'];
      delete next['体力继承比例'];
      delete next['魂力继承比例'];
      delete next['精神继承比例'];
    }
    if (prototype === '护盾变化') {
      if (!['正向护盾', '斩盾', '窃盾'].includes(normalizeSkillUiText(next['护盾模式'], ''))) next['护盾模式'] = 解析技能设计台正负数值(next['数值']) < 0 ? '斩盾' : '正向护盾';
      限制技能设计台护盾变化数值(next);
      if (normalizeSkillUiText(next['护盾模式'], '') !== '正向护盾') delete next['持续回合'];
    }
    if (context && context.强制独立) next['生效方式'] = '独立生效';
    if (next['生效方式'] === '跟随主原型') {
      delete next['驱动属性'];
      delete next['影响方向'];
    }
    if (String(next['驱动属性'] ?? '').trim() === '无') {
      delete next['驱动属性'];
      delete next['影响方向'];
      next['__显式无驱动属性'] = true;
    }
    清理技能设计台打断效果字段(prototype, next);
    清理技能设计台行为闭环字段(prototype, next, context);
    应用技能设计台目标驱动契约(prototype, next);
    清理技能设计台纯布尔控制字段(prototype, next);
    delete next['__显式无驱动属性'];
    return next;
  }
  // —— B:26881-26901
  function 筛选技能设计台显式原型效果列表(value = [], fallbackTarget = '单体', context = {}) {
    const target = normalizeSkillDesignerEffectTargetValue(fallbackTarget, '单体');
    const source = Array.isArray(value) ? value : [];
    return source
      .map(entry => {
        const safeEntry = entry && typeof entry === 'object' ? entry : {};
        const prototype = normalizeSkillUiText(safeEntry['原型'], '');
        if (!prototype || !SKILL_DESIGNER_PROTOTYPE_REGISTRY[prototype]) return null;
        const normalized = {
          原型: prototype,
          目标: normalizeSkillDesignerEffectTargetValue(safeEntry['目标'], target),
        };
        读取技能设计台原型字段列表(prototype, safeEntry, context).forEach(key => {
          if (safeEntry[key] === undefined || safeEntry[key] === null) return;
          if (typeof safeEntry[key] === 'string' && !safeEntry[key].trim()) return;
          normalized[key] = cloneJsonValue(safeEntry[key]);
        });
        return normalized;
      })
      .filter(Boolean);
  }
  // —— B:26903-26909
  function 规范化技能设计台原型效果列表(value = [], fallbackTarget = '单体', context = {}) {
    const target = normalizeSkillDesignerEffectTargetValue(fallbackTarget, '单体');
    const list = 筛选技能设计台显式原型效果列表(value, target, context);
    if (list.length) return list;
    const fallbackPrototype = 读取技能设计台原型名称列表()[0] || '伤害结算';
    return [创建技能设计台默认原型效果(fallbackPrototype, target)];
  }
  // —— B:26911-26922
  function 提取技能设计台原型效果列表(effectArray = [], fallbackTarget = '单体') {
    const source = Array.isArray(effectArray) ? effectArray : [];
    const target = normalizeSkillDesignerEffectTargetValue(fallbackTarget, '单体');
    return 筛选技能设计台显式原型效果列表(
      source
        .filter(effect => effect && typeof effect === 'object')
        .filter(effect => normalizeSkillUiText(effect['原型'], ''))
        .map(effect => cloneJsonValue(effect)),
      target,
      {},
    );
  }
  // —— B:26937-26944
  function 技能设计台原型需要落盘(effect = {}) {
    const prototype = normalizeSkillUiText(effect && effect['原型'], '');
    if (!prototype) return false;
    const meta = 读取技能设计台原型摘要(prototype);
    if (meta.类别 !== '战斗外') return true;
    if (['修炼增益', '战斗外复活', '召唤生成'].includes(prototype)) return true;
    return false;
  }
  // —— B:26946-26950
  function 技能设计台允许纯描述技能(draft = {}) {
    const type = normalizeSkillUiText(draft && draft.type, '');
    const hasText = !!normalizeSkillUiText((draft && draft.effectDesc) || (draft && draft.visualDesc), '');
    return hasText && ['辅助', '被动'].includes(type);
  }
  // —— B:26952-26956
  function 格式化技能设计台原型字段值(value) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }
  // —— B:26958-26969
  function 读取技能设计台原型字段输入值(raw = '') {
    const text = toText(raw, '').trim();
    if (!text) return '';
    if (/^[\[{]/.test(text)) {
      try {
        return JSON.parse(text);
      } catch (error) {
        return text;
      }
    }
    return text;
  }
  // —— B:26971-27030
  function 构建技能设计台条件分支条件编辑器(condition = {}, 允许删除 = false, 追加动画 = false) {
    const 类型 = normalizeSkillUiText(condition['类型'], '生命比例');
    const 对象 = normalizeSkillUiText(condition['对象'], '目标');
    const 比较选项 = 读取技能设计台条件分支比较选项(类型);
    const 比较 = 规范化技能设计台条件分支比较值(类型, condition['比较']);
    const 值 = 格式化技能设计台原型字段值(condition['值'] ?? (类型 === '目标' ? '自身' : ''));
    const 状态 = normalizeSkillUiText(condition['状态'], '中毒');
    const 显示配置 = 读取技能设计台条件分支值控件配置(类型, 比较);
    const 显示比较 = 显示配置.显示比较;
    if (类型 === '目标') {
      return `
          <div class=\"mvu-editor-field-grid skill-designer-condition-row skill-designer-condition-row--target\" data-skill-designer-condition-row data-skill-designer-condition-type=\"${escapeHtmlAttr(类型)}\">
            ${允许删除 ? '<button type=\"button\" class=\"skill-designer-remove-btn\" data-skill-designer-remove-condition data-skill-designer-disableable aria-label=\"删除判定条件\" title=\"删除该判定条件\">×</button>' : ''}
            <label class=\"mvu-editor-field\">
              ${构建技能设计台说明标签('类型', 技能设计台条件字段提示.类型)}
              <select class=\"mvu-editor-select\" data-skill-designer-condition-field=\"类型\" data-skill-designer-disableable>
                ${构建技能设计台条件类型分组选项(类型)}
              </select>
            </label>
            <input type=\"hidden\" value=\"目标\" data-skill-designer-condition-field=\"对象\" />
            <input type=\"hidden\" value=\"==\" data-skill-designer-condition-field=\"比较\" />
            <label class=\"mvu-editor-field\">
              <span class=\"mvu-editor-label\">目标</span>
              ${构建技能设计台条件分支值控件(类型, 比较, 值 || '自身')}
            </label>
            <div class=\"skill-designer-condition-preview\" data-skill-designer-condition-preview>${htmlEscape(构建技能设计台条件分支条件预览({ 类型, 对象: '目标', 比较: '==', 值: 值 || '自身' }))}</div>
          </div>
        `;
    }
    return `
        <div class=\"mvu-editor-field-grid skill-designer-condition-row${追加动画 ? ' skill-designer-fade-in' : ''}\" data-skill-designer-condition-row data-skill-designer-condition-type=\"${escapeHtmlAttr(类型)}\">
          ${允许删除 ? '<button type=\"button\" class=\"skill-designer-remove-btn\" data-skill-designer-remove-condition data-skill-designer-disableable aria-label=\"删除判定条件\" title=\"删除该判定条件\">×</button>' : ''}
          <label class=\"mvu-editor-field\">
            ${构建技能设计台说明标签('类型', 技能设计台条件字段提示.类型)}
            <select class=\"mvu-editor-select\" data-skill-designer-condition-field=\"类型\" data-skill-designer-disableable>
              ${构建技能设计台条件类型分组选项(类型)}
            </select>
          </label>
          <input type=\"hidden\" value=\"${escapeHtmlAttr(对象)}\" data-skill-designer-condition-field=\"对象\" />
          <input type=\"hidden\" value=\"${escapeHtmlAttr(比较)}\" data-skill-designer-condition-field=\"比较\"${显示比较 ? ' disabled' : ''} />
          <label class=\"mvu-editor-field\" data-skill-designer-condition-compare-field${显示比较 ? '' : ' hidden style=\"display:none\"'}>
            <span class=\"mvu-editor-label\" data-skill-designer-condition-compare-label>${htmlEscape(显示配置.比较标签)}</span>
            <select class=\"mvu-editor-select\" data-skill-designer-condition-field=\"比较\" data-skill-designer-disableable>
              ${构建技能设计台条件分支比较控件选项(类型, 比较)}
            </select>
          </label>
          <label class=\"mvu-editor-field\" data-skill-designer-condition-value-field${构建技能设计台条件分支隐藏属性(显示配置.显示值)}>
            <span class=\"mvu-editor-label\" data-skill-designer-condition-value-label>${htmlEscape(显示配置.值标签)}</span>
            ${构建技能设计台条件分支值控件(类型, 比较, 值)}
          </label>
          <label class=\"mvu-editor-field\" data-skill-designer-condition-state-field${构建技能设计台条件分支隐藏属性(显示配置.显示状态)}>
            <span class=\"mvu-editor-label\">状态</span>
            <select class=\"mvu-editor-select\" data-skill-designer-condition-field=\"状态\" data-skill-designer-disableable>
              ${buildSkillDesignerSelectOptions(构建技能设计台状态施加分组选项(读取技能设计台原型字段选项('状态施加', '状态')), 状态)}
            </select>
          </label>
          <div class=\"skill-designer-condition-preview\" data-skill-designer-condition-preview>${htmlEscape(构建技能设计台条件分支条件预览(condition))}</div>
        </div>
      `;
  }
  // —— B:27032-27074
  function 构建技能设计台条件分支条目编辑器(branch = {}, fallbackTarget = '单体', 追加动画 = false) {
    const 处理 = normalizeSkillUiText(branch['处理'], '生效');
    const 条件 =
      Array.isArray(branch['条件']) && branch['条件'].length
        ? branch['条件']
        : [{ 类型: '生命比例', 对象: '目标', 比较: '<=', 值: '20%' }];
    const 替换效果 = Array.isArray(branch['替换效果']) ? branch['替换效果'] : [];
    const 追加效果 = Array.isArray(branch['追加效果']) ? branch['追加效果'] : [];
    const 禁用释放前降低结算 = 技能设计台条件列表包含释放后条件(条件);
    return `
        <div class=\"skill-designer-subsection${追加动画 ? ' skill-designer-fade-in' : ''}\" data-skill-designer-condition-branch-row>
          <button type=\"button\" class=\"skill-designer-remove-btn\" data-skill-designer-remove-condition-branch data-skill-designer-disableable aria-label=\"删除逻辑分支\" title=\"删除该逻辑分支模块\">×</button>
          <div class=\"skill-designer-preview-stack\" data-skill-designer-condition-list>
            ${条件.map(item => 构建技能设计台条件分支条件编辑器(item, 条件.length > 1)).join('')}
          </div>
          <div class=\"mvu-editor-actions\">
            <button type=\"button\" class=\"tag-chip\" data-skill-designer-add-condition data-skill-designer-disableable>新增条件</button>
          </div>
          <div class=\"mvu-editor-field-grid\">
            <label class=\"mvu-editor-field\">
              ${构建技能设计台说明标签('处理', 技能设计台条件字段提示.处理)}
              <select class=\"mvu-editor-select\" data-skill-designer-condition-branch-action data-skill-designer-disableable>
                ${buildSkillDesignerSelectOptions(SKILL_DESIGNER_CONDITION_BRANCH_ACTION_OPTIONS, 处理)}
              </select>
            </label>
          </div>
          <div class=\"mvu-editor-field mvu-editor-field-wide skill-designer-nested-prototype-field\" data-skill-designer-condition-effect=\"替换效果\"${处理 === '替换效果' ? '' : ' hidden'}${处理 === '替换效果' ? '' : ' style=\"display:none\"'}>
            ${构建技能设计台说明标签('替换效果', 技能设计台条件字段提示.替换效果)}
            <div class=\"skill-designer-preview-stack\" data-skill-designer-prototype-grid=\"condition-replace\" data-skill-designer-allow-empty=\"true\">
              ${替换效果.length ? 构建技能设计台原型效果行列表(替换效果, fallbackTarget, true, { 禁用条件分支: true, 禁用释放前降低结算 }) : ''}
            </div>
            <div class=\"mvu-editor-actions\"><button type=\"button\" class=\"tag-chip\" data-skill-designer-add-condition-effect data-skill-designer-condition-effect-kind=\"替换效果\" data-skill-designer-disableable>新增原型</button></div>
          </div>
          <div class=\"mvu-editor-field mvu-editor-field-wide skill-designer-nested-prototype-field\" data-skill-designer-condition-effect=\"追加效果\"${处理 === '追加效果' ? '' : ' hidden'}${处理 === '追加效果' ? '' : ' style=\"display:none\"'}>
            ${构建技能设计台说明标签('追加效果', 技能设计台条件字段提示.追加效果)}
            <div class=\"skill-designer-preview-stack\" data-skill-designer-prototype-grid=\"condition-append\" data-skill-designer-allow-empty=\"true\">
              ${追加效果.length ? 构建技能设计台原型效果行列表(追加效果, fallbackTarget, true, { 禁用条件分支: true, 禁用释放前降低结算 }) : ''}
            </div>
            <div class=\"mvu-editor-actions\"><button type=\"button\" class=\"tag-chip\" data-skill-designer-add-condition-effect data-skill-designer-condition-effect-kind=\"追加效果\" data-skill-designer-disableable>新增原型</button></div>
          </div>
        </div>
      `;
  }
  // —— B:27076-27083
  function 创建技能设计台默认条件分支(fallbackTarget = '单体') {
    const target = normalizeSkillDesignerEffectTargetValue(fallbackTarget, '单体');
    return {
      条件: [{ 类型: '生命比例', 对象: '目标', 比较: '<=', 值: '20%' }],
      处理: '替换效果',
      替换效果: [创建技能设计台默认原型效果('伤害结算', target)],
    };
  }
  // —— B:27085-27105
  function 构建技能设计台条件分支编辑器(原型 = '', value = [], fallbackTarget = '单体') {
    const branches = Array.isArray(value) ? value : [];
    void 原型;
    return `
        <div class=\"mvu-editor-field mvu-editor-field-wide\" data-skill-designer-condition-branch>
          <div class=\"skill-designer-inline-toggle\">
            <span class=\"mvu-editor-label\">条件分支</span>
            <label class=\"skill-designer-check-toggle\">
              <input type=\"checkbox\"${branches.length ? ' checked' : ''} data-skill-designer-condition-branch-enabled data-skill-designer-disableable />
              <span></span>
            </label>
          </div>
          <div class=\"skill-designer-preview-stack\" data-skill-designer-condition-branch-list${branches.length ? '' : ' hidden'}${branches.length ? '' : ' style=\"display:none\"'}>
            ${branches.map(branch => 构建技能设计台条件分支条目编辑器(branch, fallbackTarget)).join('')}
          </div>
          <div class=\"mvu-editor-actions\" data-skill-designer-condition-branch-actions${branches.length ? '' : ' hidden'}${branches.length ? '' : ' style=\"display:none\"'}>
            <button type=\"button\" class=\"tag-chip\" data-skill-designer-add-condition-branch data-skill-designer-disableable>新增分支</button>
          </div>
        </div>
      `;
  }
  // —— B:27107-27123
  function 构建技能设计台嵌套原型列表编辑器(字段名 = '', value = [], fallbackTarget = '单体') {
    const source = Array.isArray(value) ? value : [];
    const 嵌套目标 = 字段名 === '授予效果' ? '单体' : fallbackTarget;
    const 显示字段名 = 字段名 === '授予效果' ? '作用效果' : 字段名 === '结算效果' ? '结算效果' : 字段名;
    const 默认原型 = 字段名 === '结算效果' ? '伤害结算' : '判定修正';
    return `
        <div class="mvu-editor-field mvu-editor-field-wide skill-designer-nested-prototype-field" data-skill-designer-nested-prototype-field="${escapeHtmlAttr(字段名)}">
          <span class="mvu-editor-label">${htmlEscape(显示字段名)}</span>
          <div class="skill-designer-preview-stack" data-skill-designer-prototype-grid="nested" data-skill-designer-nested-kind="${escapeHtmlAttr(字段名)}" data-skill-designer-allow-empty="true">
            ${source.length ? 构建技能设计台原型效果行列表(source, 嵌套目标, true, { 嵌套字段: 字段名, 强制独立: true }) : ''}
          </div>
          <div class="mvu-editor-actions">
            <button type="button" class="tag-chip" data-skill-designer-add-nested-prototype data-skill-designer-default-prototype="${escapeHtmlAttr(默认原型)}" data-skill-designer-disableable>新增原型</button>
          </div>
        </div>
      `;
  }
  // —— B:27125-27129
  function 读取技能设计台多枚举值(value = '') {
    return (Array.isArray(value) ? value : String(value || '').split(/[、,，|/]/))
      .map(item => normalizeSkillUiText(item, ''))
      .filter(Boolean);
  }
  // —— B:27131
  const 技能设计台每tick分钟 = 10;
  // —— B:27132
  const 技能设计台时窗最大调整tick = 7 * 24 * 6;
  // —— B:27134-27145
  function 拆分技能设计台tick时长(value = 0, options = {}) {
    const 最小tick = Math.max(0, parseSkillDesignerIntegerInputValue(options.最小tick, 0, 0));
    const 最大tick = Number.isFinite(Number(options.最大tick)) ? Math.max(最小tick, Math.round(Number(options.最大tick))) : 0;
    const 默认tick = Math.max(最小tick, parseSkillDesignerIntegerInputValue(options.默认tick, 最小tick, 最小tick));
    const 原始tick = parseSkillDesignerIntegerInputValue(value, 默认tick, 最小tick);
    const tick = 最大tick > 0 ? Math.max(最小tick, Math.min(最大tick, 原始tick)) : Math.max(最小tick, 原始tick);
    const 总分钟 = tick * 技能设计台每tick分钟;
    const 日 = Math.floor(总分钟 / 1440);
    const 小时 = Math.floor((总分钟 % 1440) / 60);
    const 分钟 = 总分钟 % 60;
    return { 日, 小时, 分钟, tick };
  }
  // —— B:27147-27173
  function 构建技能设计台tick时长输入(标签 = '', 字段名 = '', value = 0, options = {}) {
    const 最小tick = Math.max(0, parseSkillDesignerIntegerInputValue(options.最小tick, 0, 0));
    const 最大tick = Number.isFinite(Number(options.最大tick)) ? Math.max(最小tick, Math.round(Number(options.最大tick))) : 0;
    const 时长 = 拆分技能设计台tick时长(value, { 最小tick, 最大tick, 默认tick: options.默认tick ?? 最小tick });
    const 字段属性名 = options.字段属性名 || 'data-skill-designer-prototype-field';
    const 日最大值 = 最大tick > 0 ? ` max=\"${escapeHtmlAttr(String(Math.floor((最大tick * 技能设计台每tick分钟) / 1440)))}\"` : '';
    return `
          <div class=\"mvu-editor-field mvu-editor-field-wide skill-designer-time-parts\" data-skill-designer-time-parts data-skill-designer-time-min-tick=\"${escapeHtmlAttr(String(最小tick))}\"${最大tick > 0 ? ` data-skill-designer-time-max-tick=\"${escapeHtmlAttr(String(最大tick))}\"` : ''}>
            ${标签}
            <div class=\"skill-designer-time-parts-grid\">
              <label>
                <span>日</span>
                <input class=\"mvu-editor-input\" type=\"number\" min=\"0\"${日最大值} step=\"1\" value=\"${escapeHtmlAttr(时长.日)}\" data-skill-designer-time-part=\"日\" data-skill-designer-disableable />
              </label>
              <label>
                <span>时</span>
                <input class=\"mvu-editor-input\" type=\"number\" min=\"0\" max=\"23\" step=\"1\" value=\"${escapeHtmlAttr(时长.小时)}\" data-skill-designer-time-part=\"时\" data-skill-designer-disableable />
              </label>
              <label>
                <span>分</span>
                <input class=\"mvu-editor-input\" type=\"number\" min=\"0\" max=\"59\" step=\"10\" value=\"${escapeHtmlAttr(时长.分钟)}\" data-skill-designer-time-part=\"分\" data-skill-designer-disableable />
              </label>
            </div>
            <input type=\"hidden\" value=\"${escapeHtmlAttr(时长.tick)}\" ${字段属性名}=\"${escapeHtmlAttr(字段名)}\" data-skill-designer-time-hidden />
          </div>
        `;
  }
  // —— B:27175-27177
  function 技能设计台字段是tick时长(key = '') {
    return /tick$/i.test(String(key || ''));
  }
  // —— B:27179-27426
  function 构建技能设计台原型字段输入(原型 = '', key = '', value = '', fallbackTarget = '单体', options = {}) {
    const 定义 = 读取技能设计台原型字段定义(原型, key, options);
    const 类型 = normalizeSkillUiText(定义['类型'], '文本');
    const 选项 = 读取技能设计台原型字段选项(原型, key, options);
    const 嵌套字段 = normalizeSkillUiText(options && options.嵌套字段, '');
    const effect = options && options.当前效果 && typeof options.当前效果 === 'object' ? options.当前效果 : { ...(options || {}), [key]: value };
    const 时窗字段显示名 = 原型 === '时窗修正'
      ? ({
          调整字段: '调整对象',
          调整方式: '方向',
          调整回合: '回合数',
          调整tick: '时长',
          调整次数: effect['调整字段'] === '触发次数' ? '触发次数' : effect['调整字段'] === '使用次数' ? '使用次数' : '次数',
          结算倍率: '压缩结算',
        }[key] || '')
      : '';
    const 显示字段名 = 时窗字段显示名 || (key === '防御穿透'
      ? '伤害内联穿透%'
      : 原型 === '规则改写' && key === '数值' && normalizeSkillUiText(effect && effect['规则'], '') === '死亡转存活'
        ? '复活恢复比例'
      : 原型 === '战斗外复活' && key === '数值'
        ? '复活恢复比例'
      : key === '资源转移方式'
        ? '转移模式'
      : 原型 === '状态移除' && key === '状态'
        ? '移除状态'
      : 原型 === '状态移除' && key === '匹配原型'
        ? '内部效果'
      : 原型 === '状态移除' && key === '数值方向'
        ? '方向'
      : key === '目标' && 原型 === '机制授予'
        ? '授予对象'
        : key === '目标' && 嵌套字段 === '授予效果'
            ? '作用目标'
              : key === '目标' && 嵌套字段 === '结算效果'
                ? '结算目标'
                : key);
    const 标签 = 构建技能设计台原型字段标签(原型, key, 显示字段名, effect);
    if (key === '条件分支' && options && options.禁用条件分支) return '';
    if (key === '条件分支') return 构建技能设计台条件分支编辑器(原型, value, fallbackTarget);
    if (类型 === '原型列表') return 构建技能设计台嵌套原型列表编辑器(key, value, fallbackTarget);
    if (原型 === '机制抹消' && key === '抹消对象') {
      const 对象 = 规范化技能设计台机制抹消对象(value);
      const 原型选项 = 构建技能设计台原型字段下拉选项('原型', 技能设计台机制抹消对象原型选项, true);
      return `
          <div class=\"mvu-editor-field mvu-editor-field-wide\" data-skill-designer-suppress-object-editor>
            ${标签}
            <div class=\"mvu-editor-field-grid\">
              <label class=\"mvu-editor-field\">
                <span class=\"mvu-editor-label\">原型</span>
                <select class=\"mvu-editor-select\" data-skill-designer-suppress-object-field=\"原型\" data-skill-designer-disableable>
                  ${buildSkillDesignerSelectOptions(原型选项, 对象['原型'])}
                </select>
              </label>
              ${构建技能设计台机制抹消对象字段控件(对象)}
            </div>
            <input type=\"hidden\" value=\"${escapeHtmlAttr(JSON.stringify(对象))}\" data-skill-designer-prototype-field=\"抹消对象\" data-skill-designer-prototype-json />
          </div>
        `;
    }
    const 是必填 = key === '目标' || key === '生效方式' || 技能设计台原型字段是否必填(原型, key);
    const 禁用空值 = Boolean(options && options.禁用空值);
    if (原型 === '炸环' && key === '目标') {
      return `
          <label class=\"mvu-editor-field\">
            ${标签}
            <div class=\"mvu-editor-static skill-designer-static-token\">自身</div>
            <input type=\"hidden\" value=\"自身\" data-skill-designer-prototype-field=\"目标\" />
          </label>
        `;
    }
    if (key === '生效方式' && options && options.强制独立) {
      return `<input type=\"hidden\" value=\"独立生效\" data-skill-designer-prototype-field=\"生效方式\" />`;
    }
    if (key === '生效方式' && options && options.固定生效方式) {
      const 固定值 = normalizeSkillUiText(options.固定生效方式, '独立生效');
      return `
          <label class=\"mvu-editor-field\">
            ${标签}
            <div class=\"mvu-editor-static skill-designer-static-token\">${htmlEscape(固定值)}</div>
            <input type=\"hidden\" value=\"${escapeHtmlAttr(固定值)}\" data-skill-designer-prototype-field=\"生效方式\" />
          </label>
        `;
    }
    if (类型 === '枚举') {
      const 可用选项 =
        key === '目标'
          ? 读取技能设计台目标候选(原型, { ...options, 当前效果: options?.当前效果 || { ...(options || {}), [key]: value } })
          : 选项;
      if (!可用选项.length) return '';
      const 下拉选项 = 构建技能设计台原型字段下拉选项(key, 可用选项, 是必填 || 禁用空值);
      const 渲染选项 = 原型 === '状态施加' && key === '状态'
        ? 构建技能设计台状态施加分组选项(normalizeSkillDesignerOptionList(下拉选项).map(item => item.value))
        : 下拉选项;
      const 首个合法值 = Array.isArray(可用选项[0]?.options) ? 可用选项[0].options[0] : 可用选项[0];
      const 当前值 =
        value ||
        (key === '生效方式' && options && options.默认生效方式 ? options.默认生效方式 : '') ||
        ((是必填 || 禁用空值) ? 首个合法值 : '无') ||
        '';
      if (原型 === '状态施加' && key === '状态') {
        const 摘要 = 技能设计台状态摘要({ ...(options?.当前效果 || {}), 状态: 当前值 });
        return `
          <label class=\"mvu-editor-field\">
            ${标签}
            <select class=\"mvu-editor-select\" data-skill-designer-prototype-field=\"${escapeHtmlAttr(key)}\" data-skill-designer-disableable>
              ${buildSkillDesignerSelectOptions(渲染选项, 当前值)}
            </select>
            <span class=\"skill-designer-state-summary\" data-skill-designer-state-summary>${htmlEscape(摘要)}</span>
          </label>
        `;
      }
      if (原型 === '位移执行' && key === '位移类型') {
        const 摘要 = 技能设计台位移执行摘要({ ...(options?.当前效果 || {}), 位移类型: 当前值 });
        return `
          <label class=\"mvu-editor-field\">
            ${标签}
            <select class=\"mvu-editor-select\" data-skill-designer-prototype-field=\"${escapeHtmlAttr(key)}\" data-skill-designer-disableable>
              ${buildSkillDesignerSelectOptions(渲染选项, 当前值)}
            </select>
            <span class=\"skill-designer-state-summary\" data-skill-designer-movement-summary>${htmlEscape(摘要)}</span>
          </label>
        `;
      }
      return `
          <label class=\"mvu-editor-field\">
            ${标签}
            <select class=\"mvu-editor-select\" data-skill-designer-prototype-field=\"${escapeHtmlAttr(key)}\" data-skill-designer-disableable>
              ${buildSkillDesignerSelectOptions(渲染选项, 当前值)}
            </select>
          </label>
        `;
    }
    if (类型 === '多枚举') {
      const 可选项 = key === '限定元素' ? SKILL_LIMITED_ELEMENT_OPTIONS : 选项;
      const selected = 读取技能设计台多枚举值(value).filter(item => 可选项.includes(item));
      const selectedText = selected.length ? selected.join('、') : '默认无';
      return `
          <div class=\"mvu-editor-field skill-designer-filter-select${key === '限定元素' ? ' skill-designer-filter-select--wide' : ''}\" data-skill-designer-filter-select>
            ${标签}
            <details class=\"skill-designer-filter-select-box\">
              <summary><span data-skill-designer-filter-summary>${htmlEscape(selectedText)}</span></summary>
              <div class=\"skill-designer-filter-options\">
                ${可选项
                  .map(
                    option => `
                  <label class=\"skill-designer-filter-option\" data-skill-designer-filter-option=\"${escapeHtmlAttr(option)}\">
                    <input type=\"checkbox\" value=\"${escapeHtmlAttr(option)}\"${selected.includes(option) ? ' checked' : ''} data-skill-designer-filter-checkbox data-skill-designer-disableable />
                    <span>${htmlEscape(option)}</span>
                  </label>
                `,
                  )
                  .join('')}
              </div>
            </details>
            <input type=\"hidden\" value=\"${escapeHtmlAttr(selected.join('|'))}\" data-skill-designer-prototype-field=\"${escapeHtmlAttr(key)}\" data-skill-designer-prototype-multiple />
          </div>
        `;
    }
    if (原型 === '时窗修正' && key === '调整tick') {
      return 构建技能设计台tick时长输入(标签, '调整tick', value || 6, {
        最小tick: 1,
        最大tick: 技能设计台时窗最大调整tick,
        默认tick: 6,
      });
    }
    if (类型 === '数字' || 类型 === '整数') {
      if (技能设计台字段是tick时长(key)) return 构建技能设计台tick时长输入(标签, key, value, { 最小tick: 0, 默认tick: 0 });
      const 最大值属性 = 定义['最大值'] !== undefined ? ` max=\"${escapeHtmlAttr(String(定义['最大值']))}\"` : key === '防御穿透' ? ' max=\"100\"' : '';
      const 最小值属性 = 定义['最小值'] !== undefined ? String(定义['最小值']) : '0';
      const 当前数值 = value;
      const 占位文本 = '留空 = 无';
      const 字段类 = 原型 === '时窗修正' && key === '延迟回合' ? ' mvu-editor-field-wide' : '';
      return `
          <label class=\"mvu-editor-field${字段类}\">
            ${标签}
            <input class=\"mvu-editor-input\" type=\"number\" ${类型 === '整数' || key === '防御穿透' ? 'step=\"1\"' : 'step=\"0.01\"'} min=\"${最小值属性}\"${最大值属性} value=\"${escapeHtmlAttr(当前数值)}\" placeholder=\"${escapeHtmlAttr(占位文本)}\" data-skill-designer-prototype-field=\"${escapeHtmlAttr(key)}\" data-skill-designer-disableable />
          </label>
        `;
    }
    if (类型 === '带符号数值') {
      const 结算 = normalizeSkillUiText(
        options && options.当前效果 && options.当前效果['结算'] !== undefined ? options.当前效果['结算'] : options && options['结算'],
        '',
      );
      const 状态名 = normalizeSkillUiText(
        options && options.当前效果 && options.当前效果['状态'] !== undefined ? options.当前效果['状态'] : options && options['状态'],
        '',
      );
      const 只允许正向强度 = normalizeSkillUiText(原型, '') === '状态施加' && key === '数值' && 技能设计台状态施加使用正向强度数值(状态名);
      const 允许结算绝对值 = normalizeSkillUiText(原型, '') === '结算修正' && ['消耗', '前摇'].includes(结算) && key === '数值';
      const 必须百分比修正 =
        (['判定修正', '结算修正', '位移执行', '决策干扰'].includes(normalizeSkillUiText(原型, '')) && key === '数值') &&
        !允许结算绝对值;
      const pattern = 只允许正向强度
        ? '\\+?[0-9]+(\\.[0-9]+)?%?'
        : 必须百分比修正
        ? '(?:\\+|-)?[0-9]+(\\.[0-9]+)?%'
        : '(?:\\+|-)?[0-9]+(\\.[0-9]+)?%?|x[0-9]+(\\.[0-9]+)?';
      const 占位文本 = 允许结算绝对值
        ? (结算 === '前摇' ? '+20% / -20% / +2 / -2' : '+20% / -20% / +500 / -500')
        : 只允许正向强度 ? '例如 10%'
        : normalizeSkillUiText(原型, '') === '决策干扰' && key === '数值' ? '例如 20%，越高干扰越强'
          : 必须百分比修正 ? '例如 +12%' : '留空 = 无';
      const 数值单位口径 = 读取技能设计台数值字段口径(原型, key, effect);
      if (技能设计台数值字段使用单位下拉(原型, key, effect)) {
        const 当前单位 = 数值单位口径 === '混合' ? 读取技能设计台数值单位(value) : 数值单位口径;
        const 当前值 = 数值单位口径 === '百分比'
          ? 格式化技能设计台百分比字段值(value, '')
          : 格式化技能设计台单位数值(value, 当前单位);
        const 单位禁用 = 数值单位口径 !== '混合';
        return `
          <label class=\"mvu-editor-field\">
            ${标签}
            <div class=\"skill-designer-value-unit-control\" data-skill-designer-value-unit-control>
              <input class=\"mvu-editor-input\" type=\"text\" pattern=\"${escapeHtmlAttr(pattern)}\" value=\"${escapeHtmlAttr(当前值)}\" placeholder=\"${escapeHtmlAttr(占位文本)}\" data-skill-designer-prototype-field=\"${escapeHtmlAttr(key)}\"${只允许正向强度 ? ' data-skill-designer-positive-value=\"true\"' : ''} data-skill-designer-disableable />
              ${构建技能设计台数值单位下拉(当前单位, 单位禁用)}
            </div>
          </label>
        `;
      }
      return `
          <label class=\"mvu-editor-field\">
            ${标签}
            <input class=\"mvu-editor-input\" type=\"text\" pattern=\"${escapeHtmlAttr(pattern)}\" value=\"${escapeHtmlAttr(value)}\" placeholder=\"${escapeHtmlAttr(占位文本)}\" data-skill-designer-prototype-field=\"${escapeHtmlAttr(key)}\"${只允许正向强度 ? ' data-skill-designer-positive-value=\"true\"' : ''} data-skill-designer-disableable />
          </label>
        `;
    }
    if (类型 === '布尔') {
      const 已启用 = value === true || normalizeSkillUiText(value, '') === 'true' || normalizeSkillUiText(value, '') === '启用';
      return `
          <div class=\"mvu-editor-field\">
            ${标签}
            <label class=\"skill-designer-check-toggle\">
              <input type=\"checkbox\"${已启用 ? ' checked' : ''} data-skill-designer-prototype-field=\"${escapeHtmlAttr(key)}\" data-skill-designer-disableable />
              <span></span>
            </label>
          </div>
        `;
    }
    if (类型 === '对象') return '';
    return `
        <label class=\"mvu-editor-field\">
          ${标签}
          <input class=\"mvu-editor-input\" type=\"text\" value=\"${escapeHtmlAttr(value)}\" placeholder=\"留空 = 无\" data-skill-designer-prototype-field=\"${escapeHtmlAttr(key)}\" data-skill-designer-disableable />
        </label>
      `;
  }
  // —— B:27428-27485
  function 构建技能设计台驱动判定属性编辑器(effect = {}) {
    const 原型 = normalizeSkillUiText(effect && effect['原型'], '');
    const 目标 = normalizeSkillUiText(effect && effect['目标'], '');
    if (原型 === '伤害结算' || (目标 === '自身' && !['机制授予', '时光回溯', '位移执行', '复制执行'].includes(原型)) || !技能设计台原型需要默认驱动判定(原型, effect)) {
      return `
        <div class=\"mvu-editor-field-grid mvu-editor-field-wide skill-designer-scaling-field\" data-skill-designer-scaling-field hidden style=\"display:none\">
          <input type=\"hidden\" value=\"无\" data-skill-designer-prototype-field=\"驱动属性\" data-skill-designer-scaling-driver />
          <input type=\"hidden\" value=\"无\" data-skill-designer-prototype-field=\"影响方向\" />
        </div>
      `;
    }
    const 驱动属性 = String((effect && effect['驱动属性']) ?? '无').trim() || '无';
    const 有驱动 = 驱动属性 && 驱动属性 !== '无';
    const 方向原始选项 = 读取技能设计台原型字段选项(原型, '影响方向', { 当前效果: effect });
    const 首个合法方向 = 选择技能设计台默认影响方向(原型, effect, '效果强度');
    const 方向值 = normalizeSkillUiText(effect && effect['影响方向'], 首个合法方向);
    const 方向列表 = 读取技能设计台影响方向选项值(原型, effect);
    const 影响方向 = 有驱动 ? (方向列表.includes(方向值) ? 方向值 : 首个合法方向) : '无';
    const 驱动选项 = 构建技能设计台原型字段下拉选项(
      '驱动属性',
      读取技能设计台原型字段选项(原型, '驱动属性'),
      有驱动,
    );
    if (原型 === '状态移除') {
      return `
        <div class=\"mvu-editor-field-grid mvu-editor-field-wide skill-designer-scaling-field\" data-skill-designer-scaling-field>
          <label class=\"mvu-editor-field\">
            ${构建技能设计台原型字段标签(原型, '驱动属性', '驱动/判定属性')}
            <select class=\"mvu-editor-select\" data-skill-designer-prototype-field=\"驱动属性\" data-skill-designer-scaling-driver data-skill-designer-disableable>
              ${buildSkillDesignerSelectOptions(驱动选项, 有驱动 ? 驱动属性 : 选择技能设计台默认驱动属性(原型, effect))}
            </select>
          </label>
          <input type=\"hidden\" value=\"成功率\" data-skill-designer-prototype-field=\"影响方向\" />
        </div>
      `;
    }
    const 方向选项 = 构建技能设计台原型字段下拉选项(
      '影响方向',
      方向原始选项,
      true,
    );
    return `
        <div class=\"mvu-editor-field-grid mvu-editor-field-wide skill-designer-scaling-field\" data-skill-designer-scaling-field>
          <label class=\"mvu-editor-field\">
            ${构建技能设计台原型字段标签(原型, '驱动属性', '驱动/判定属性')}
            <select class=\"mvu-editor-select\" data-skill-designer-prototype-field=\"驱动属性\" data-skill-designer-scaling-driver data-skill-designer-disableable>
              ${buildSkillDesignerSelectOptions(驱动选项, 有驱动 ? 驱动属性 : '无')}
            </select>
          </label>
          <label class=\"mvu-editor-field\" data-skill-designer-scaling-direction${有驱动 ? '' : ' hidden style=\"display:none\"'}>
            ${构建技能设计台原型字段标签(原型, '影响方向', '影响方向')}
            <select class=\"mvu-editor-select\" data-skill-designer-prototype-field=\"影响方向\" data-skill-designer-disableable>
              ${buildSkillDesignerSelectOptions(方向选项, 有驱动 ? 影响方向 : 首个合法方向)}
            </select>
          </label>
        </div>
      `;
  }
  // —— B:27487-27518
  function 构建技能设计台状态移除内部筛选编辑器(effect = {}, fallbackTarget = '单体', options = {}) {
    const 内部字段 = ['匹配原型', '资源', '数值方向']
      .filter(key => 读取技能设计台原型字段列表('状态移除', effect).includes(key))
      .map(key => 构建技能设计台原型字段输入('状态移除', key, 格式化技能设计台原型字段值(effect && effect[key]), fallbackTarget, options));
    if (!内部字段.length) return '';
    const 已启用 = normalizeSkillUiText(effect && effect['匹配原型'], '') && normalizeSkillUiText(effect && effect['匹配原型'], '') !== '无';
    const 匹配原型 = normalizeSkillUiText(effect && effect['匹配原型'], '');
    const 资源 = normalizeSkillUiText(effect && effect['资源'], '');
    const 数值方向 = normalizeSkillUiText(effect && effect['数值方向'], '任意');
    const 摘要 = (() => {
      if (!已启用) return '未启用';
      if (匹配原型 === '资源变化') {
        if (资源 === '生命' && 数值方向 === '负向') return '扣生命状态';
        if (资源 === '生命' && 数值方向 === '正向') return '恢复生命状态';
        if (资源) return `${资源}${数值方向 === '负向' ? '扣减' : 数值方向 === '正向' ? '恢复' : '变化'}状态`;
        return '资源变化状态';
      }
      if (匹配原型 === '护盾变化') return '护盾状态';
      return '内部筛选';
    })();
    return `
        <details class="mvu-editor-field-wide skill-designer-advanced-fields"${已启用 ? ' open' : ''}>
          <summary>
            <span>内部效果筛选</span>
            <b>${htmlEscape(摘要)}</b>
          </summary>
          <div class="mvu-editor-field-grid">
            ${内部字段.join('')}
          </div>
        </details>
      `;
  }
  // —— B:27520-27562
  function 构建技能设计台原型字段编辑器(effect = {}, options = {}) {
    const prototype = normalizeSkillUiText(effect && effect['原型'], 读取技能设计台原型名称列表()[0] || '伤害结算');
    const target = normalizeSkillDesignerEffectTargetValue(effect && effect['目标'], '单体');
    const 当前效果 = 技能设计台清理并水合原型效果(effect, target, {
      嵌套字段: options && options.嵌套字段,
      强制独立: options && options.强制独立,
      允许对应等级: options && options.允许对应等级,
    });
    const 原始字段列表 = 读取技能设计台原型字段列表(prototype, 当前效果, options);
    const 字段列表 =
      prototype === '时窗修正'
        ? (() => {
            const 调整字段 = normalizeSkillUiText(当前效果 && 当前效果['调整字段'], '持续回合');
            const 模式字段 =
              调整字段 === '有效期tick'
                ? ['调整tick']
                : ['触发次数', '使用次数'].includes(调整字段)
                  ? ['调整次数']
                  : ['调整回合', '结算倍率'];
            const 固定顺序 = ['目标', '生效方式', '调整字段', '调整方式', ...模式字段, '单日使用次数上限', '驱动属性', '影响方向', '条件分支'];
            return [
              ...固定顺序.filter(key => 原始字段列表.includes(key)),
              ...原始字段列表.filter(key => !固定顺序.includes(key)),
            ];
          })()
        : 原始字段列表;
    const 内部筛选字段 = prototype === '状态移除' ? new Set(['匹配原型', '资源', '数值方向']) : new Set();
    const 字段内容 = 字段列表
      .filter(key => !['驱动属性', '影响方向', '条件分支'].includes(key) && !内部筛选字段.has(key))
      .map(key => {
        const rawValue = 当前效果 && 当前效果[key];
        const value = Array.isArray(rawValue) ? rawValue : 格式化技能设计台原型字段值(rawValue);
        return 构建技能设计台原型字段输入(prototype, key, value, target, { ...options, 当前效果 });
      });
    if (prototype === '状态移除') 字段内容.push(构建技能设计台状态移除内部筛选编辑器(当前效果, target, options));
    if (字段列表.includes('驱动属性') && 字段列表.includes('影响方向'))
      字段内容.push(构建技能设计台驱动判定属性编辑器(当前效果));
    if (字段列表.includes('条件分支'))
      字段内容.push(
        构建技能设计台原型字段输入(prototype, '条件分支', 当前效果 && 当前效果['条件分支'], target, options),
      );
    return 字段内容.join('');
  }
  // —— B:27564-27586
  function 规范化技能设计台原型生效方式列表(效果列表 = [], context = {}) {
    const 列表 = Array.isArray(效果列表) ? 效果列表 : [];
    const 主目标 = normalizeSkillDesignerEffectTargetValue(列表[0] && 列表[0]['目标'], '');
    const 主原型 = normalizeSkillUiText(列表[0] && 列表[0]['原型'], '');
    const 嵌套字段 = normalizeSkillUiText(context && context.嵌套字段, '');
    const 强制独立 = !!(context && (context.强制独立 || context.条件分支 || 嵌套字段));
    const 可跟随主原型 = 效果条目 => {
      const 原型 = normalizeSkillUiText(效果条目 && 效果条目['原型'], '');
      if (!主原型 || !原型 || 原型 === 主原型) return false;
      return ['状态施加', '状态移除', '判定修正', '结算修正', '决策干扰'].includes(
        原型,
      );
    };
    return 列表.map((效果条目, 序号) => {
      if (!效果条目 || typeof 效果条目 !== 'object') return 效果条目;
        const 下一条 = 技能设计台清理并水合原型效果(效果条目, 主目标 || '单体', { 嵌套字段, 强制独立, 允许对应等级: context && context.允许对应等级 });
      const 当前目标 = normalizeSkillDesignerEffectTargetValue(下一条['目标'], 主目标 || '单体');
      const 当前生效方式 = normalizeSkillUiText(效果条目['生效方式'], '独立生效');
      下一条['生效方式'] =
        强制独立 || 序号 === 0 || (主目标 && 当前目标 !== 主目标) || !可跟随主原型(下一条) ? '独立生效' : 当前生效方式;
      return 下一条;
    });
  }
  // —— B:27588-27610
  function 规范化技能设计台运行效果生效方式(效果数组 = [], context = {}) {
    const 列表 = Array.isArray(效果数组) ? 效果数组 : [];
    const 主目标 = normalizeSkillDesignerEffectTargetValue(列表[0] && 列表[0]['目标'], '');
    const 主原型 = normalizeSkillUiText(列表[0] && 列表[0]['原型'], '');
    const 嵌套字段 = normalizeSkillUiText(context && context.嵌套字段, '');
    const 强制独立 = !!(context && (context.强制独立 || context.条件分支 || 嵌套字段));
    const 可跟随主原型 = 效果条目 => {
      const 原型 = normalizeSkillUiText(效果条目 && 效果条目['原型'], '');
      if (!主原型 || !原型 || 原型 === 主原型) return false;
      return ['状态施加', '状态移除', '判定修正', '结算修正', '决策干扰'].includes(
        原型,
      );
    };
    return 列表.map((效果条目, 序号) => {
      if (!效果条目 || typeof 效果条目 !== 'object' || Array.isArray(效果条目)) return 效果条目;
      const 下一条 = 技能设计台清理并水合原型效果(效果条目, 主目标 || '单体', { 嵌套字段, 强制独立, 允许对应等级: context && context.允许对应等级 });
      const 当前目标 = normalizeSkillDesignerEffectTargetValue(下一条['目标'], 主目标 || '单体');
      const 当前生效方式 = normalizeSkillUiText(效果条目['生效方式'], '独立生效');
      下一条['生效方式'] =
        强制独立 || 序号 === 0 || (主目标 && 当前目标 !== 主目标) || !可跟随主原型(下一条) ? '独立生效' : 当前生效方式;
      return 下一条;
    });
  }
  // —— B:27612-27654
  function 构建技能设计台原型效果行列表(
    effects = [],
    fallbackTarget = '单体',
    允许删空 = false,
    options = {},
    追加动画 = false,
  ) {
    const source = Array.isArray(effects) ? effects : [];
    const normalized = 允许删空 && !source.length ? [] : 规范化技能设计台原型效果列表(source, fallbackTarget, options);
    const prototypeOptions = 读取技能设计台原型名称列表();
    return normalized
      .map((effect, index) => {
        const prototype = normalizeSkillUiText(effect['原型'], prototypeOptions[0] || '伤害结算');
        const 允许删除当前原型 = 允许删空 || normalized.length > 1;
        const 行选项 = {
          ...options,
          当前效果: effect,
          默认生效方式: options && options.默认生效方式 ? options.默认生效方式 : '跟随主原型',
          固定生效方式:
            options && options.固定首个独立生效 && index === 0 ? '独立生效' : options && options.固定生效方式,
        };
        const 状态标记 = prototype === '状态施加'
          ? ` data-skill-designer-rendered-state=\"${escapeHtmlAttr(normalizeSkillUiText(effect['状态'], ''))}\"`
          : '';
        return `
          <div class=\"skill-designer-subsection${追加动画 ? ' skill-designer-fade-in' : ''}${prototype === '状态施加' ? ' skill-designer-status-prototype-row' : ''}\" data-skill-designer-prototype-row data-skill-designer-rendered-prototype=\"${escapeHtmlAttr(prototype)}\"${状态标记}>
            ${允许删除当前原型 ? '<button type=\"button\" class=\"skill-designer-remove-btn\" data-skill-designer-remove-prototype data-skill-designer-disableable aria-label=\"删除该原型机制\" title=\"删除该原型机制\">×</button>' : ''}
            <div class=\"mvu-editor-field-grid\">
              <label class=\"mvu-editor-field\">
                <span class=\"mvu-editor-label\">原型</span>
                <select class=\"mvu-editor-select\" data-skill-designer-prototype-select data-skill-designer-disableable>
                  ${构建技能设计台原型选项(prototype)}
                </select>
              </label>
            </div>
            <div class=\"mvu-editor-field-grid\" data-skill-designer-prototype-fields>
              ${构建技能设计台原型字段编辑器(effect, 行选项)}
            </div>
          </div>
        `;
      })
      .join('');
  }
  // —— B:27800-27937
  function 构建技能设计台原型摘要(draft = {}) {
    const 简写 = (value, fallback = '') => normalizeSkillUiText(格式化技能设计台原型字段值(value), fallback);
    const 目标文本 = effect => {
      const 目标 = normalizeSkillDesignerEffectTargetValue(effect && effect['目标'], '单体');
      if (目标 === '单体') return '，作用于目标';
      if (目标 === '群体') return '，作用于多个目标';
      if (目标 === '全场') return '，作用于全场';
      if (目标 === '召唤物') return '，作用于召唤物';
      return `，作用于${目标}`;
    };
    const 持续文本 = effect => {
      const round = Math.max(0, parseSkillDesignerIntegerInputValue(effect && effect['持续回合'], 0, 0));
      const tick = Math.max(0, parseSkillDesignerIntegerInputValue(effect && effect['持续tick'], 0, 0));
      if (round > 0) return `，${round}回合`;
      if (tick > 0) return `，${tick}tick`;
      return '';
    };
    const 数值文本 = (effect, fallback = '') => 简写(effect && effect['数值'], fallback);
    const 条件文本 = effect => {
      const text = 构建技能设计台条件分支摘要(effect && effect['条件分支']);
      return text ? `；条件：${text}` : '';
    };
    const 单条摘要 = effect => {
      const prototype = normalizeSkillUiText(effect && effect['原型'], '');
      if (!prototype) return '';
      if (prototype === '伤害结算') {
        const power = 简写(effect['威力倍率'], '100');
        const type = 简写(effect['伤害类型']);
        const hits = Math.max(1, parseSkillDesignerIntegerInputValue(effect['攻击段数'], 1, 1));
        const penetration = 简写(effect['防御穿透']);
        const fixedPower = 简写(effect['对应等级']);
        return (
          [`伤害，威力倍率${power}`, type, hits > 1 ? `${hits}段` : '', penetration ? `穿透${penetration}%` : '', fixedPower ? `对应等级${fixedPower}级` : '']
            .filter(Boolean)
            .join('，') +
          目标文本(effect) +
          持续文本(effect) +
          条件文本(effect)
        );
      }
      if (prototype === '资源变化') {
        const 数值 = 数值文本(effect, '+0');
        const 资源 = 简写(effect['资源'], '资源');
        const 动作 = 数值.startsWith('-') && 资源 !== '生命' ? `泯灭 ${资源} ${数值.replace(/^-/, '')}` : `${资源} ${数值}`;
        return (
          动作 +
          目标文本(effect) +
          持续文本(effect) +
          条件文本(effect)
        );
      }
      if (prototype === '资源转移') {
        const 方式 = 简写(effect['资源转移方式'], '资源转移');
        const 资源 = 简写(effect['资源'], '资源');
        const 数值 = 数值文本(effect, '+0').replace(/^[+-]/, '');
        if (方式 === '吞噬') return `吞噬目标${数值}${资源}，并转化为自身${资源}${持续文本(effect)}${条件文本(effect)}`;
        if (方式 === '共享') return `向目标共享${数值}${资源}${持续文本(effect)}${条件文本(effect)}`;
        if (方式 === '均分') return `均分目标${资源}${持续文本(effect)}${条件文本(effect)}`;
        return `转移目标${数值}${资源}${持续文本(effect)}${条件文本(effect)}`;
      }
      if (prototype === '护盾变化') {
        const 模式 = 简写(effect['护盾模式'], 解析技能设计台正负数值(effect['数值']) < 0 ? '斩盾' : '正向护盾');
        const 数值 = 数值文本(effect, '+0').replace(/^[+-]/, '');
        if (模式 === '窃盾') return `窃取目标护盾${数值}${持续文本(effect)}${条件文本(effect)}`;
        if (模式 === '斩盾') return `削减目标护盾${数值}${持续文本(effect)}${条件文本(effect)}`;
        return `生成护盾${数值}${目标文本(effect)}${持续文本(effect)}${条件文本(effect)}`;
      }
      if (prototype === '属性修正')
        return `${简写(effect['属性'], '属性')} ${数值文本(effect, '+0')}${目标文本(effect)}${持续文本(effect)}${条件文本(effect)}`;
      if (prototype === '判定修正')
        return `调整${简写(effect['判定'], '判定')}${数值文本(effect, '+0')}${effect['打断效果'] === true ? '，附带打断' : ''}${目标文本(effect)}${持续文本(effect)}${条件文本(effect)}`;
      if (prototype === '结算修正') {
        const 限定元素 = 简写(effect['限定元素']);
        const 结算 = 简写(effect['结算']);
        const 数量 = ['伤害分摊', '消耗分摊'].includes(结算) && normalizeSkillDesignerEffectTargetValue(effect['目标'], '单体') === '群体'
          ? 简写(effect['数量'])
          : '';
        const 转移对象 = 结算 === '伤害转移' ? 简写(effect['转移对象'], '攻击者') : '';
        return `结算：${结算 || '结算'} ${数值文本(effect, '+0')}${转移对象 ? `，转给${转移对象}` : ''}${数量 ? `，最多${数量}人` : ''}${限定元素 ? `，限定${限定元素}` : ''}${持续文本(effect)}${条件文本(effect)}`;
      }
      if (prototype === '状态施加') {
        return `施加${简写(effect['状态'], '状态')}${目标文本(effect)}${持续文本(effect)}${条件文本(effect)}`;
      }
      if (prototype === '状态移除') {
        const state = 简写(effect['状态']) || 简写(effect['类型']) || 简写(effect['匹配原型'], '状态');
        const label =
          state === '任意负面'
            ? '负面状态'
            : state === '任意增益'
              ? '增益状态'
              : state === '任意状态'
                ? '匹配状态'
                : state;
        const count = 简写(effect['数量']);
        return `移除${label}${count ? ` ${count}` : ''}${目标文本(effect)}${持续文本(effect)}${条件文本(effect)}`;
      }
      if (prototype === '规则防御') {
        const 规则 = 简写(effect['规则'], '规则');
        const 次数 = 简写(effect['次数']) || '1';
        if (规则 === '免伤') return `抵消伤害 ${次数}次${目标文本(effect)}${持续文本(effect)}${条件文本(effect)}`;
        if (规则 === '免死') return `致命结算锁血 ${次数}次${目标文本(effect)}${持续文本(effect)}${条件文本(effect)}`;
        return `规则防御：${规则}${次数 ? ` ${次数}次` : ''}${目标文本(effect)}${持续文本(effect)}${条件文本(effect)}`;
      }
      if (prototype === '机制授予') {
        const 授予文本 = (Array.isArray(effect['授予效果']) ? effect['授予效果'] : [])
          .map(单条摘要)
          .filter(Boolean)
          .slice(0, 3)
          .join('；') || '后续效果';
        const 触发条件 = 简写(effect['触发条件'], '主动触发');
        const 待机期限 = effect['持续回合'] !== undefined ? `待机期限${简写(effect['持续回合'])}回合，逾期失效` : '无回合期限';
        if (触发条件 === '随下次行动触发') return `下次行动时触发一次：${授予文本}；${待机期限}${条件文本(effect)}`;
        const 次数 = 简写(effect['可用次数']) || '1';
        if (触发条件 === '下次魂技成功释放') return `魂技成功释放时附带：${授予文本}；每次消耗一次，共${次数}次，${待机期限}${条件文本(effect)}`;
        const 回合 = 简写(effect['持续回合']) || '1';
        return `主动触发${次数}次，${回合}回合内：${授予文本}${条件文本(effect)}`;
      }
      if (prototype === '决策干扰')
        return `干扰：${简写(effect['干扰'], '判断干扰')} ${数值文本(effect, '20%')}${持续文本(effect)}${条件文本(effect)}`;
      if (prototype === '召唤生成') return `${summarizeSummonEffectUi(effect)}${条件文本(effect)}`;
      if (prototype === '修炼增益') {
        const 收益类型 = 简写(effect['收益类型'], '训练方式收益');
        const 对象 = 收益类型 === '属性修炼速度'
          ? `${简写(effect['修炼属性'], '魂力上限')}修炼`
          : `${简写(effect['训练方式'], '冥想')}收益`;
        return `修炼增益：${对象} ${数值文本(effect, '+0')}${持续文本(effect)}${条件文本(effect)}`;
      }
      return [prototype, 数值文本(effect), 持续文本(effect).replace(/^，/, '')].filter(Boolean).join(' ');
    };
    return 规范化技能设计台原型效果列表(draft.prototypeEffects, draft.target)
      .map(effect => {
        const text = 单条摘要(effect);
        if (!text) return '';
        return normalizeSkillUiText(effect && effect['生效方式'], '') === '跟随主原型' ? `附加${text}` : text;
      })
      .filter(Boolean)
      .join('；');
  }
  // —— B:27939-27963
  function readSkillDesignerMechanicParamState(mountEl, draft = {}) {
    const nextMap = {};
    collectSkillDesignerMechanicLabels(draft).forEach(label => {
      const defs = getSkillDesignerMechanicParamDefs(label);
      const entry = {};
      defs.forEach(def => {
        const input = mountEl
          ? Array.from(mountEl.querySelectorAll('[data-skill-designer-param-key]')).find(
              node =>
                node.getAttribute('data-skill-designer-mechanic') === label &&
                node.getAttribute('data-skill-designer-param-key') === def.key,
            )
          : null;
        const rawValue = input ? normalizeSkillUiText(input.value, '') : '';
        if (!rawValue) return;
        if (label === '机制抹消' && def.key === 'suppressObject') {
          entry[def.key] = 规范化技能设计台机制抹消对象(rawValue);
          return;
        }
        entry[def.key] = rawValue;
      });
      if (safeEntries(entry).length) nextMap[label] = entry;
    });
    return nextMap;
  }
  // —— B:27965-28124
  function buildSkillDesignerFormStateFromDraft(draft = {}, previewMeta = {}) {
    const baseDraft = draft && typeof draft === 'object' ? draft : {};
    const 显式被动值 = normalizeSkillUiText(baseDraft.启用被动, '');
    const 原始类型 = normalizeSkillUiText(baseDraft.type, '');
    const typeMeta = resolveSkillDesignerTypeMeta(previewMeta, /无|禁用|关闭|false|no|0/.test(显式被动值) ? '' : baseDraft.type);
    const costConfig = parseSkillDesignerCostConfig(
      baseDraft.cost || baseDraft['消耗'],
      baseDraft.resourceType || baseDraft.costType,
      baseDraft.resourceValues || baseDraft.costValues,
    );
    const 原始主机制 = normalizeSkillUiText(baseDraft.primaryMain || baseDraft['主机制'], '');
    const resolvedPrimaryMain = Object.keys(SKILL_DESIGNER_MAIN_MECHANIC_POOL).includes(原始主机制) ? 原始主机制 : '';
    let resolvedTarget = normalizeSkillDesignerSelectValue(
      normalizeSkillDesignerTargetForForm(
        (Array.isArray(baseDraft.prototypeEffects) &&
          baseDraft.prototypeEffects[0] &&
          baseDraft.prototypeEffects[0]['目标']) ||
          baseDraft.target,
        getSkillDesignerDefaultTarget(previewMeta, typeMeta.value),
      ),
      SKILL_DESIGNER_TARGET_OPTIONS,
      getSkillDesignerFirstOptionValue(SKILL_DESIGNER_TARGET_OPTIONS),
    );
    if (/^(未知|未设置|无)$/.test(resolvedTarget))
      resolvedTarget = getSkillDesignerDefaultTarget(previewMeta, typeMeta.value);
    const isFusionScope = toText(previewMeta && previewMeta.scope, '') === '武魂融合技';
    const rawFusionMode = isFusionScope
      ? normalizeSkillDesignerFusionMode(baseDraft.fusionMode || baseDraft['融合模式'])
      : '';
    const 原始融合用法模式 = isFusionScope ? 规范化技能设计台融合用法模式(baseDraft['用法模式']) : '';
    const rawFusionPartner = isFusionScope
      ? normalizeSkillUiText(baseDraft.fusionPartner || baseDraft['融合对象'], '')
      : '';
    const rawFusionParticipants = isFusionScope
      ? normalizeSkillDesignerFusionParticipantList(getSkillDesignerRawFusionParticipants(baseDraft))
      : [];
    const derivedFusionFields = isFusionScope
      ? deriveSkillDesignerFusionFields(rawFusionMode, rawFusionParticipants, rawFusionPartner)
      : { fusionMode: '', fusionPartner: '', fusionSourceSpirits: [], fusionParticipants: [] };
    const 原始细分机制 = normalizeSkillUiText(baseDraft.primarySub || baseDraft['细分机制'], '');
    const resolvedPrimarySub =
      resolvedPrimaryMain && getSkillDesignerChildMechanicOptions(resolvedPrimaryMain).includes(原始细分机制)
        ? 原始细分机制
        : '';
    const resolvedDeliveryForm = normalizeSkillDesignerSelectValue(
      baseDraft.deliveryForm,
      getSkillDesignerDeliveryOptions(typeMeta.value),
      getSkillDesignerFirstOptionValue(getSkillDesignerDeliveryOptions(typeMeta.value), '直接生效'),
    );
    const derivedMainRole = inferSkillDesignerMainRole(
      typeMeta.value,
      resolvedTarget,
      resolvedPrimaryMain,
      resolvedPrimarySub,
    );
    const 启用技能掌控度 = 技能设计台启用技能掌控度(previewMeta, baseDraft);
    const levelControl = 启用技能掌控度 ? buildSkillDesignerLevelControlFromDraft(baseDraft) : null;
    const 显式原型效果 = 筛选技能设计台显式原型效果列表(baseDraft.prototypeEffects, resolvedTarget);
    const 启用被动 = 技能设计台启用被动(previewMeta, baseDraft);
    const 被动触发 = 读取技能设计台被动触发默认值({ ...baseDraft, prototypeEffects: 显式原型效果 });
    const 被动触发限制 = 读取技能设计台被动触发限制(baseDraft);
    const 使用限制 = 读取技能设计台使用限制(baseDraft);
    const 预览根数据 = (liveSnapshot && liveSnapshot.rootData) || (lastRenderableSnapshot && lastRenderableSnapshot.rootData) || {};
    const 武魂元素上下文 = 读取技能设计台武魂上下文(预览根数据, previewMeta);
    let 初始附带属性 = 规范化技能元素列表_桥接(baseDraft.attachedAttributes);
    if (!初始附带属性.length && 技能设计台是元素系上下文(预览根数据, previewMeta, { type: typeMeta.value })) {
      初始附带属性 = [...武魂元素上下文.可调用元素];
    }
    const coreState = {
      name: 规范第七魂环真身名称_桥接(
        normalizeSkillUiText(baseDraft.name, getSkillDesignerNameFallback(previewMeta)),
        previewMeta,
      ),
      type: typeMeta.value,
      typeDisplay: typeMeta.display,
      target: 启用被动 ? '自身' : resolvedTarget,
      cost: buildSkillDesignerCostObject(costConfig.resourceType, costConfig.resourceValues),
      costType: normalizeSkillDesignerSelectValue(costConfig.resourceType, SKILL_DESIGNER_RESOURCE_TYPE_OPTIONS, '无'),
      costValues: cloneJsonValue(costConfig.resourceValues || {}),
      costValue: costConfig.resourceValue,
      sustainCostText: costConfig.sustainText || '',
      前摇: Math.max(
        0,
        toNumber(baseDraft['前摇'], SKILL_DESIGNER_RUNTIME_CAST_TIME_BY_DELIVERY[resolvedDeliveryForm] || 10),
      ),
      启用技能掌控度: 启用技能掌控度 ? '启用' : '无',
      启用被动: 启用被动 ? '启用' : '无',
      被动触发,
      被动触发周期: 被动触发限制.周期,
      被动触发次数: String(被动触发限制.次数),
      使用限制周期: 使用限制.周期,
      使用限制次数: String(使用限制.次数),
      bonus: '无',
      mainRole: normalizeSkillUiText(derivedMainRole, '未知'),
      primaryMain: resolvedPrimaryMain,
      primarySub: resolvedPrimarySub,
      prototypeEffects: 显式原型效果,
      deliveryForm: resolvedDeliveryForm,
      constructItemCount: Math.max(
        1,
        parseSkillDesignerIntegerInputValue(baseDraft.constructItemCount || baseDraft['数量'], 1, 1),
      ),
      constructDurationTick: Math.max(
        0,
        parseSkillDesignerIntegerInputValue(baseDraft.constructDurationTick || baseDraft['有效期tick'], 0, 0),
      ),
      constructDescription: normalizeSkillUiText(baseDraft.constructDescription || baseDraft['描述'], ''),
      secondaryMechanics: resolvedPrimaryMain
        ? normalizeSkillDesignerSecondarySelection(
            resolvedPrimaryMain,
            baseDraft.secondaryMechanics,
            typeMeta.value,
            resolvedPrimarySub,
          )
        : [],
      attachedAttributes: 初始附带属性,
      attributeSource: '无',
      attributeRole: '无',
      coeff: normalizeSkillDesignerCoeffMap({}),
      visualDesc: normalizeSkillUiText(baseDraft.visualDesc, ''),
      effectDesc: normalizeSkillUiText(baseDraft.effectDesc, ''),
      artStage: normalizeSkillUiText(baseDraft.artStage, '未入门'),
      artLevel: Math.max(0, toNumber(baseDraft.artLevel, 0)),
      fusionMode: derivedFusionFields.fusionMode,
      用法模式: 原始融合用法模式,
      fusionPartner: derivedFusionFields.fusionPartner,
      fusionSourceSpirits: derivedFusionFields.fusionSourceSpirits.length
        ? derivedFusionFields.fusionSourceSpirits
        : isFusionScope
          ? normalizeSkillDesignerArray(baseDraft.fusionSourceSpirits || baseDraft['来源武魂'])
          : [],
      fusionParticipants: derivedFusionFields.fusionParticipants,
      副作用列表: 规范化技能设计台副作用列表(baseDraft.副作用列表),
      使用副作用列表: 规范化技能设计台副作用列表(baseDraft.使用副作用列表),
      技能掌控度: levelControl,
      技能掌控度中心等级: levelControl ? String(levelControl.中心等级) : '',
      技能掌控度圆满等级: levelControl ? String(levelControl.圆满等级) : '',
      阵营判定: '自动',
    };
    if (!coreState.prototypeEffects.length) {
      const 模板原型效果 = 构建技能设计台模板原型效果列表(coreState, previewMeta);
      coreState.prototypeEffects = 模板原型效果.length
        ? 模板原型效果
        : 规范化技能设计台原型效果列表([], resolvedTarget);
    }
    coreState.type = 推断技能设计台技能分类(coreState.prototypeEffects, typeMeta.value);
    coreState.typeDisplay = coreState.type;
    coreState.mainRole = normalizeSkillUiText(
      inferSkillDesignerMainRole(coreState.type, coreState.target, coreState.primaryMain, coreState.primarySub),
      '未知',
    );
    const implicitAttributeConfig = resolveSkillDesignerImplicitAttributeConfig(coreState, previewMeta);
    return {
      ...coreState,
      attributeSource: implicitAttributeConfig.source,
      attributeRole: implicitAttributeConfig.role,
      coeff: implicitAttributeConfig.coeff,
      mechanicParams: normalizeSkillDesignerMechanicParamMap(baseDraft.mechanicParams, coreState),
    };
  }
  // —— B:28337-28340
  const SKILL_DESIGNER_RUNTIME_CAST_TIME_BY_DELIVERY = Object.freeze({
    直接生效: 10,
    造物承载: 20,
  });
  // —— B:28342-28365
  function buildSkillDesignerRuntimeObject(source = {}) {
    const result = {};
    safeEntries(source && typeof source === 'object' ? source : {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (typeof value === 'string' && !value.trim()) return;
      if (Array.isArray(value) && !value.length) return;
      if (value && typeof value === 'object' && !Array.isArray(value) && !safeEntries(value).length) return;
      result[key] = value;
    });
      if (!normalizeSkillUiText(result['原型'], '') && normalizeSkillUiText(result['机制'], '')) {
        const 原型列表 = getSkillDesignerMechanismCompiledPrototypeList(result['机制']);
        if (原型列表.length) {
          const 原型条目 = 原型列表[0];
          const 原型 = typeof 原型条目 === 'string' ? 原型条目 : normalizeSkillUiText(原型条目 && 原型条目['原型'], '');
          if (原型) {
            const 转换结果 = { ...result, ...(typeof 原型条目 === 'object' && 原型条目 ? 原型条目 : {}), 原型: 原型 };
            delete 转换结果['机制'];
            return 转换结果;
          }
        }
      }
    delete result['机制'];
    return result;
  }
  // —— B:28367-28374
  function parseSkillDesignerNumericInputValue(value, fallback = 0, digits = 4) {
    const rawText = toText(value, '').trim();
    if (!rawText) return Number(Number(fallback || 0).toFixed(digits));
    const match = rawText.match(/-?\d+(?:\.\d+)?/);
    const parsed = Number(match ? match[0] : rawText);
    if (!Number.isFinite(parsed)) return Number(Number(fallback || 0).toFixed(digits));
    return Number(parsed.toFixed(digits));
  }
  // —— B:28376-28380
  function parseSkillDesignerIntegerInputValue(value, fallback = 0, minimum = 0) {
    const parsed = Math.round(parseSkillDesignerNumericInputValue(value, fallback, 0));
    if (!Number.isFinite(parsed)) return Math.max(minimum, Math.round(Number(fallback || 0)));
    return Math.max(minimum, parsed);
  }
  // —— B:28382-28389
  function parseSkillDesignerPercentRatio(value, fallback = 0) {
    const rawText = toText(value, '').trim();
    if (!rawText) return Number(Number(fallback || 0).toFixed(4));
    const parsed = parseSkillDesignerNumericInputValue(rawText, fallback, 4);
    if (!Number.isFinite(parsed)) return Number(Number(fallback || 0).toFixed(4));
    if (/%/.test(rawText) || parsed > 1) return Number((parsed / 100).toFixed(4));
    return Number(parsed.toFixed(4));
  }
  // —— B:28405-28409
  function 规范化技能设计台伤害威力倍率(value, fallback = 100) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return Math.max(1, Number(fallback || 100));
    return Math.max(1, Math.round(parsed));
  }
  // —— B:28434-28436
  function normalizeSkillDesignerTargetForRuntime(target = '') {
    return normalizeSkillDesignerEffectTargetValue(target, '单体');
  }
  // —— B:28442-28447
  function isSkillDesignerGrantableMechanism(label = '') {
    const normalizedLabel = normalizeSkillUiText(label, '');
    return Array.isArray(SKILL_DESIGNER_TARGET_SEMANTICS.可赋予)
      ? SKILL_DESIGNER_TARGET_SEMANTICS.可赋予.includes(normalizedLabel)
      : false;
  }
  // —— B:28456-28461
  function getSkillDesignerMechanismRegistryMeta(label = '') {
    const normalizedLabel = normalizeSkillUiText(label, '');
    if (!normalizedLabel) return null;
    const meta = SKILL_DESIGNER_MECHANISM_META[normalizedLabel];
    return meta && typeof meta === 'object' ? meta : null;
  }
  // —— B:28484-28511
  function resolveSkillDesignerMechanismParamDefsFromRegistry(label = '') {
    const meta = getSkillDesignerMechanismRegistryMeta(label);
    const schema = Array.isArray(meta && meta.设计台参数定义) ? meta.设计台参数定义 : [];
    if (!schema.length) return [];
    return schema
      .map(def => {
        if (!def || typeof def !== 'object') return null;
        const type = normalizeSkillUiText(def.type, 'text');
        const key = normalizeSkillUiText(def.key, '');
        const title = normalizeSkillUiText(def.label, '');
        if (!key || !title) return null;
        const placeholder = normalizeSkillUiText(def.placeholder, '');
        if (type === 'select') {
          const optionKey = normalizeSkillUiText(def.optionsKey, '');
          const options = optionKey
            ? SKILL_DESIGNER_PARAM_OPTION_REGISTRY[optionKey] || []
            : Array.isArray(def.options)
              ? def.options
              : [];
          return createSkillDesignerSelectParam(key, title, options, placeholder || '未设置');
        }
        if (type === 'number') {
          return createSkillDesignerNumberParam(key, title, placeholder, normalizeSkillUiText(def.step, '0.1'));
        }
        return createSkillDesignerTextParam(key, title, placeholder);
      })
      .filter(Boolean);
  }
  // —— B:28530-28535
  function resolveSkillDesignerGrantableMechanismTargetForRuntime(target = '', mechanismLabel = '') {
    const normalizedTarget = normalizeSkillDesignerTargetForRuntime(target);
    if (mechanismLabel && !isSkillDesignerGrantableMechanism(mechanismLabel)) return normalizedTarget || '自身';
    if (normalizeSkillUiText(mechanismLabel, '') === '能力共享' && normalizedTarget === '自身') return '群体';
    return normalizedTarget || '自身';
  }
  // —— B:28575-28580
  function getSkillDesignerEffectivePrimaryLabel(draft = {}) {
    const primarySub = normalizeSkillUiText(draft && draft.primarySub, '');
    if (primarySub) return primarySub;
    const primaryMain = normalizeSkillUiText(draft && draft.primaryMain, '');
    return primaryMain;
  }
  // —— B:30620-30640
  function normalizeSkillDesignerPassiveEffects(effectArray = [], draft = {}, previewMeta = {}) {
    const isPassive =
      /被动/.test(normalizeSkillUiText(draft && draft.type, '')) ||
      toText(previewMeta && previewMeta.scope, '') === 'blood_passive';
    if (!isPassive) return Array.isArray(effectArray) ? effectArray : [];
    return (Array.isArray(effectArray) ? effectArray : []).map(effect => {
      if (!effect || typeof effect !== 'object') return effect;
      const cloned = cloneJsonValue(effect);
      const 原型 = toText(cloned && cloned['原型'], '').trim();
      if (['属性修正', '资源变化', '状态施加', '结算修正'].includes(原型)) {
        cloned['目标'] = cloned['目标'] || '自身';
        delete cloned['对象'];
        if (Number(cloned['持续回合'] || 0) > 10) delete cloned['持续回合'];
      }
      if (['护盾变化', '规则防御', '机制授予', '召唤生成', '复制执行'].includes(原型)) {
        cloned['目标'] = cloned['目标'] || '自身';
        if (Number(cloned['持续回合'] || 0) > 10) delete cloned['持续回合'];
      }
      return cloned;
    });
  }
  // —— B:30642-30654
  function 套用技能设计台被动触发(effectArray = [], draft = {}) {
    if (!技能设计台启用被动({}, draft)) return Array.isArray(effectArray) ? effectArray : [];
    return (Array.isArray(effectArray) ? effectArray : []).map(effect => {
      if (!effect || typeof effect !== 'object') return effect;
      const cloned = cloneJsonValue(effect);
      const 原型 = normalizeSkillUiText(cloned['原型'], '');
      cloned['目标'] = '自身';
      delete cloned['对象'];
      if (原型 !== '伤害结算' && Number(cloned['持续回合'] || 0) > 10) delete cloned['持续回合'];
      delete cloned['触发限制'];
      return cloned;
    });
  }
  // —— B:30656-30697
  function buildSkillDesignerConstructEffect(draft = {}, runtimeEffects = []) {
    const 造物默认驱动属性 =
      cloneJsonValue(Array.isArray(runtimeEffects) ? runtimeEffects : []).find(effect =>
        effect &&
        typeof effect === 'object' &&
        normalizeSkillUiText(effect['原型'], '') !== '伤害结算' &&
        normalizeSkillUiText(effect['驱动属性'], '无') !== '无',
      )?.['驱动属性'] || '魂力上限';
    const usageEffects = cloneJsonValue(Array.isArray(runtimeEffects) ? runtimeEffects : []).map(effect => {
      if (!effect || typeof effect !== 'object') return effect;
      const cloned = cloneJsonValue(effect);
      const 原型 = normalizeSkillUiText(cloned['原型'], '');
      const 字段列表 = 读取技能设计台原型字段列表(原型, cloned);
      const 支持驱动 = 字段列表.includes('驱动属性');
      const 支持影响方向 = 字段列表.includes('影响方向');
      if (原型 !== '伤害结算' && 原型 && 支持驱动 && 支持影响方向) {
        if (String(cloned['驱动属性'] ?? '').trim() === '无') {
          delete cloned['驱动属性'];
          delete cloned['影响方向'];
        } else {
          if (!normalizeSkillUiText(cloned['驱动属性'], '')) {
            cloned['驱动属性'] = 造物默认驱动属性;
          }
        }
      }
      应用技能设计台目标驱动契约(原型, cloned);
      return cloned;
    });
    const result = buildSkillDesignerRuntimeObject({
      数量: Math.max(1, parseSkillDesignerIntegerInputValue(draft && draft.constructItemCount, 1, 1)),
      描述: normalizeSkillUiText(
        draft && draft.constructDescription,
        buildSkillDesignerCompactSummary(draft) || '使用后触发对应魂技效果',
      ),
      使用效果: usageEffects,
    });
    const 使用副作用列表 = 规范化技能设计台副作用列表(draft && draft.使用副作用列表);
    if (使用副作用列表.length) result['副作用列表'] = 使用副作用列表;
    const durationTick = Math.max(0, parseSkillDesignerIntegerInputValue(draft && draft.constructDurationTick, 0, 0));
    if (durationTick > 0) result['有效期tick'] = durationTick;
    return result;
  }
  // —— B:30699-30707
  function buildSkillDesignerRuntimeEffects(draft = {}, skillSource = {}, previewMeta = {}) {
    const prototypeEffects = 筛选技能设计台显式原型效果列表(
      draft && draft.prototypeEffects,
      draft && draft.target,
    ).filter(effect => 技能设计台原型需要落盘(effect));
    void skillSource;
    void previewMeta;
    return 规范化技能设计台运行效果生效方式(prototypeEffects);
  }
  // —— B:30709-30809
  function buildSkillDesignerUpdatedSkill(skillSource = {}, formState = {}, previewMeta = {}, 根数据 = {}) {
    const safeSkill = {};
    const 原始副作用违规列表 = [];
    const 记录原始副作用违规 = (列表, 前缀) => {
      if (!Array.isArray(列表)) return;
      规范化技能设计台副作用列表(列表, path => {
        if (path) 原始副作用违规列表.push(path.replace(/^副作用列表/, 前缀));
      });
    };
    记录原始副作用违规(formState && formState['副作用列表'], '副作用列表');
    记录原始副作用违规(formState && formState['使用副作用列表'], '使用副作用列表');
    if (原始副作用违规列表.length) throw new Error(`副作用结构错误：${Array.from(new Set(原始副作用违规列表)).join('、')}`);
    // 修炼增益 / 战斗外复活等战斗外原型：任何来源都能保存（2026-11-08 定；原先只有功法能存）
    const normalized = buildSkillDesignerFormStateFromDraft(formState, previewMeta);
    const normalizedFusionFields =
      previewMeta && previewMeta.scope === '武魂融合技' ? assertSkillDesignerFusionState(normalized) : null;
    if (!normalizeSkillUiText(normalized.name, ''))
      throw new Error(`请填写${getSkillDesignerScopeLabels(previewMeta).nameFieldLabel || '技能名'}。`);
    const designSummary = buildSkillDesignerCompactSummary(normalized);
    const 启用被动 = 技能设计台启用被动(previewMeta, normalized);
    const 有效触发限制 = 读取技能设计台有效触发限制(normalized, previewMeta);
    safeSkill['魂技名'] = 规范第七魂环真身名称_桥接(normalized.name, previewMeta);
    safeSkill['承载方式'] = 启用被动 ? '直接生效' : normalized.deliveryForm || '直接生效';
    safeSkill['消耗'] = 格式化技能设计台正式消耗文本(normalized.costType, normalized.costValues, normalized.sustainCostText, previewMeta, normalized, 根数据);
    safeSkill['前摇'] = Math.max(0, toNumber(normalized['前摇'], 0));
    if (有效触发限制) safeSkill['触发限制'] = cloneJsonValue(有效触发限制);
    else delete safeSkill['触发限制'];
    if (normalized['技能掌控度']) safeSkill['技能掌控度'] = cloneJsonValue(normalized['技能掌控度']);
    else delete safeSkill['技能掌控度'];
    safeSkill['画面描述'] = normalized.visualDesc;
    safeSkill['效果描述'] = normalized.effectDesc;
    const 技能设计台写回元数据 = {};
    if (previewMeta && previewMeta.scope === 'art') {
      技能设计台写回元数据['功法境界'] = normalizeSkillUiText(normalized.artStage, '未入门');
      技能设计台写回元数据['功法等级'] = Math.max(0, toNumber(normalized.artLevel, 0));
    }
    if (previewMeta && previewMeta.scope === '武魂融合技') {
      技能设计台写回元数据['融合模式'] = normalizedFusionFields.fusionMode;
      技能设计台写回元数据['融合用法模式'] = normalized['用法模式'];
      技能设计台写回元数据['融合对象'] = normalizedFusionFields.fusionPartner;
      技能设计台写回元数据['融合来源武魂'] = [...normalizedFusionFields.fusionSourceSpirits];
      技能设计台写回元数据['融合参与者'] = cloneJsonValue(normalizedFusionFields.fusionParticipants);
    }
    if (Object.keys(技能设计台写回元数据).length) {
      Object.defineProperty(safeSkill, '技能设计台写回元数据', {
        value: 技能设计台写回元数据,
        enumerable: false,
        configurable: true,
      });
    }
    const 武魂元素上下文 = 读取技能设计台武魂上下文(根数据, previewMeta);
    let 正式附带属性 = 规范化技能元素列表_桥接(normalized.attachedAttributes);
    if (!正式附带属性.length && 技能设计台是元素系上下文(根数据, previewMeta, normalized)) {
      if (!武魂元素上下文.可调用元素.length) throw new Error('元素系技能需要先补全武魂可调用元素。');
      正式附带属性 = [...武魂元素上下文.可调用元素];
    }
    safeSkill['附带属性'] = 正式附带属性;
    const 副作用违规列表 = [];
    const 副作用列表 = 规范化技能设计台副作用列表(normalized['副作用列表'], path => {
      if (path) 副作用违规列表.push(path);
    });
    规范化技能设计台副作用列表(normalized['使用副作用列表'], path => {
      if (path) 副作用违规列表.push(path.replace(/^副作用列表/, '使用副作用列表'));
    });
    if (副作用违规列表.length) throw new Error(`副作用结构错误：${Array.from(new Set(副作用违规列表)).join('、')}`);
    if (副作用列表.length) safeSkill['副作用列表'] = 副作用列表;
    else delete safeSkill['副作用列表'];
    void designSummary;
    let runtimeEffects = buildSkillDesignerRuntimeEffects(normalized, skillSource, previewMeta);
    runtimeEffects = 套用技能设计台被动触发(
      normalizeSkillDesignerPassiveEffects(runtimeEffects, normalized, previewMeta),
      normalized,
    );
    const normalizedRuntimeEffects = normalizeSkillDesignerExecutionEffectArray(
      cloneJsonValue(runtimeEffects),
      normalizeSkillDesignerTargetForForm(normalized.target, '单体'),
      { draft: normalized, 技能: safeSkill, passiveMode: 技能设计台启用被动(previewMeta, normalized) },
    );
    safeSkill['_效果数组'] =
      normalized.deliveryForm === '造物承载'
        ? [buildSkillDesignerConstructEffect(normalized, normalizedRuntimeEffects)].filter(
            effect => Array.isArray(effect['使用效果']) && effect['使用效果'].length,
          )
        : normalizedRuntimeEffects;
    收口技能设计台元素字段(safeSkill['_效果数组'], safeSkill['附带属性']);
    if (!safeSkill['_效果数组'].length && !技能设计台允许纯描述技能(normalized))
      throw new Error('至少需要一个可执行原型。');
    if (normalized.deliveryForm === '造物承载') {
      safeSkill['_效果数组'].forEach((effect, index) =>
        断言技能设计台效果数组契约(effect['使用效果'] || [], `_效果数组[${index}].使用效果`),
      );
    } else {
      断言技能设计台效果数组契约(safeSkill['_效果数组']);
    }
    断言技能设计台维持契约(safeSkill);
    const 断言预算 = 读取窗口函数('__LWCS_ASSERT_DIRECT_SETTLE_BUDGET__');
    if (typeof 断言预算 === 'function') {
      断言预算(safeSkill, '技能', 构建技能设计台预算上下文(previewMeta, 根数据, normalized));
    }
    return safeSkill;
  }
  // —— B:30811-30895
  function buildSkillDesignerWriteUpdates(previewMeta = {}, nextSkill = {}, rootData = {}) {
    const path = Array.isArray(previewMeta && previewMeta.path) ? previewMeta.path : [];
    if (!path.length) return [];
    断言技能设计台本命召唤唯一(previewMeta, nextSkill, rootData);
    const 技能设计台写回元数据 = nextSkill && typeof nextSkill === 'object' ? (nextSkill.技能设计台写回元数据 || {}) : {};
    const 功法境界 = normalizeSkillUiText(技能设计台写回元数据['功法境界'], '未入门');
    const 功法等级 = Math.max(0, toNumber(技能设计台写回元数据['功法等级'], 0));
    const 融合模式草稿 = 技能设计台写回元数据['融合模式'];
    const 融合用法模式草稿 = 技能设计台写回元数据['融合用法模式'];
    const 融合对象草稿 = 技能设计台写回元数据['融合对象'];
    const 融合来源武魂草稿 = 技能设计台写回元数据['融合来源武魂'];
    const 融合参与者草稿 = 技能设计台写回元数据['融合参与者'];
    const updates = toText(previewMeta && previewMeta.scope, '') === 'art' ? [] : [{ path, value: nextSkill }];
    if (toText(previewMeta && previewMeta.scope, '') === 'art') {
      const charKey = path[0] === 'char' ? toText(path[1], '') : '';
      const 功法名 = normalizeSkillUiText(nextSkill?.魂技名 || path[path.length - 1], path[path.length - 1] || '未命名功法');
      if (charKey && 功法名) {
        const 功法路径 = ['char', charKey, '功法', 功法名];
        if (功法名 === '紫极魔瞳') {
          const 已有获得tick = toNumber(deepGet(rootData, [...功法路径, '获得tick'], deepGet(rootData, ['world', '时间', 'tick'], 0)), 0);
          updates.push({ path: 功法路径, value: {
            境界: ['纵观', '入微', '芥子', '浩瀚'].includes(功法境界) ? 功法境界 : '纵观',
            lv: Math.max(1, Math.min(4, 功法等级 || 1)),
            获得tick: Math.max(0, Math.floor(已有获得tick)),
            描述: normalizeSkillUiText(nextSkill?.效果描述, '无'),
          } });
        } else {
          updates.push({ path: 功法路径, value: { 描述: normalizeSkillUiText(nextSkill?.效果描述, '无') } });
        }
      }
    }
    if (
      toText(previewMeta && previewMeta.scope, '') === '武魂融合技' &&
      toText(path[path.length - 1], '') === '技能数据'
    ) {
      const fusionRecordPath = path.slice(0, -1);
      const existingFusion = deepGet(rootData, fusionRecordPath, {});
      const fusionName = normalizeSkillUiText(
        nextSkill && (nextSkill['魂技名'] || nextSkill.name),
        toText(previewMeta && previewMeta.label, '未命名融合技'),
      );
      const charKey = path[0] === 'char' ? toText(path[1], '') : '';
      const spiritOptions = getSkillDesignerSpiritNameOptions(charKey ? deepGet(rootData, ['char', charKey], {}) : {});
      const canUseSelfFusion = spiritOptions.length >= 2;
      let fusionMode = normalizeSkillDesignerFusionMode(
        融合模式草稿 || existingFusion.融合模式 || 'partner',
      );
      if (fusionMode === 'self' && !canUseSelfFusion) fusionMode = 'partner';
      const 用法模式 = 规范化技能设计台融合用法模式(
        融合用法模式草稿 || existingFusion['用法模式'],
      );
      const 临时融合数据 = {
        融合参与者: 融合参与者草稿,
        来源武魂: 融合来源武魂草稿,
        融合对象: 融合对象草稿,
      };
      const rawParticipants = getSkillDesignerRawFusionParticipants(临时融合数据, {}).length
        ? getSkillDesignerRawFusionParticipants(临时融合数据, {})
        : getSkillDesignerRawFusionParticipants({}, existingFusion);
      const fusionParticipants = normalizeSkillDesignerFusionParticipantList(rawParticipants, rootData);
      const fusionFields = deriveSkillDesignerFusionFields(
        fusionMode,
        fusionParticipants,
        normalizeSkillUiText(
          融合对象草稿 || existingFusion['融合对象'],
          '未知搭档',
        ),
      );
      const partnerValue = fusionFields.fusionPartner;
      let sourceSpirits = fusionFields.fusionSourceSpirits.length
        ? fusionFields.fusionSourceSpirits
        : normalizeSkillDesignerArray(融合来源武魂草稿 || existingFusion.来源武魂);
      if (fusionMode === 'self' && !sourceSpirits.length) sourceSpirits = spiritOptions.slice(0, 2);
      updates.push({ path: [...fusionRecordPath, '名称'], value: fusionName });
      updates.push({ path: [...fusionRecordPath, '融合模式'], value: fusionMode });
      updates.push({ path: [...fusionRecordPath, '用法模式'], value: 用法模式 });
      updates.push({ path: [...fusionRecordPath, '融合对象'], value: partnerValue });
      updates.push({ path: [...fusionRecordPath, '来源武魂'], value: sourceSpirits });
      updates.push({
        path: [...fusionRecordPath, '融合参与者'],
        value: cloneJsonValue(fusionFields.fusionParticipants),
      });
    }
    return updates;
  }

  // ════════════════ 二、预览页局部量（B:38898-38936，逐字切片） ════════════════
  function 设计台模板上下文(snapshot, previewMeta, designerDraft) {
      const recommendedAttrs = new Set(
        normalizeSkillDesignerArray(SKILL_DESIGNER_ATTRIBUTE_HINTS_BY_TYPE[designerDraft.type] || []),
      );
      const isFusionDesigner = previewMeta.scope === '武魂融合技';
      const 启用技能掌控度 = 技能设计台启用技能掌控度(previewMeta, designerDraft);
      const 启用被动 = 技能设计台启用被动(previewMeta, designerDraft);
      const { charData: fusionCharData } = getSkillDesignerCharByPreviewPath(snapshot.rootData, previewMeta);
      const fusionSpiritOptions = isFusionDesigner ? getSkillDesignerSpiritNameOptions(fusionCharData) : [];
      const fusionModeOptions = isFusionDesigner
        ? [
            { value: 'partner', label: '双人/多人融合' },
            ...(fusionSpiritOptions.length >= 2 || designerDraft.fusionMode === 'self'
              ? [{ value: 'self', label: '自体融合' }]
              : []),
          ]
        : [];
      const 融合用法模式选项 = isFusionDesigner
        ? [
            { value: '一次性释放', label: '一次性释放' },
            { value: '融合增幅', label: '融合增幅' },
          ]
        : [];
      const 被动触发限制 = 读取技能设计台被动触发限制(designerDraft);
      const 是造物承载 = normalizeSkillUiText(designerDraft.deliveryForm, '') === '造物承载';
      const 消耗值 =
        designerDraft.costValues && typeof designerDraft.costValues === 'object' ? designerDraft.costValues : {};
      const 维持消耗值 = 解析技能设计台消耗文本配置(designerDraft.sustainCostText || '').resourceValues || {};
      const 固定百分比消耗比例 = 技能设计台是普通魂环伤害魂技(previewMeta, 构建技能设计台临时技能(designerDraft, previewMeta).临时技能?._效果数组 || [], designerDraft)
        ? 计算技能设计台固定结算消耗比例(designerDraft)
        : 0;
      const 标题提示表 = {
        基础框架载体: '填写名称与承载方式。造物承载用于先生成造物、再使用触发效果的技能。',
        核心术式阵列: '填写技能真正执行的原型效果；先放主效果，再补条件、状态或修正。',
        使用效果阵列: '填写造物被使用后触发的效果。',
        运转能量配置: '启动填保存真实消耗。维持每回合扣费。',
        技能掌控度: '只在技能随等级逐步发挥时启用；普通魂技不需要填写。',
        元属性特征: '只勾选技能实际携带的元素或概念属性。',
        终端解析图谱: '填写给玩家看的画面与效果摘要，不参与战斗结算。',
      };
    return { recommendedAttrs, isFusionDesigner, 启用技能掌控度, 启用被动, fusionCharData, fusionSpiritOptions, fusionModeOptions, 融合用法模式选项, 被动触发限制, 是造物承载, 消耗值, 维持消耗值, 固定百分比消耗比例, 标题提示表 };
  }

  // ════════════════ 三、移植层 ════════════════
  // 说明：本段手写。原版设计台的保存链是「designerDraft → 拼 HTML → 挂载时同步若干控件 → 从 DOM 回读 →
  // buildSkillDesignerUpdatedSkill」。这里用「虚拟控件树」逐函数复刻那条 HTML/DOM 链：
  //   描述* 系列 ≙ 构建技能设计台*（原版 HTML 生成器），产出控件描述而非 HTML；
  //   同步* 系列 ≙ onMount 里的 syncScalingField / 同步原型行默认驱动判定 / syncConditionRow 等；
  //   读取* 系列 ≙ readSkillDesignerFormState / 读取技能设计台原型效果状态（DOM 回读）。
  // 控件值一律保存「DOM 里 input.value 会读到的字符串」，下拉值遵循浏览器 <select> 的选中规则。

  // ───────────── 0. 根数据与快照 ─────────────
  let 设计台根数据 = null;
  function readLatestMvuDataByEditor() {
    // 原版从 MVU 宿主读取最新变量；独立页面里改为返回当前注入的根数据
    return 设计台根数据 || null;
  }
  function 设计台取根(root, meta) {
    if (root && typeof root === 'object') return root;
    if (meta && meta.root && typeof meta.root === 'object') return meta.root;
    if (设计台根数据) return 设计台根数据;
    if (typeof window !== 'undefined' && window.LWCS_SAVE) return window.LWCS_SAVE;
    return {};
  }
  function 设计台规范元数据(meta = {}) {
    // 去掉便捷参数 root，其余原样作为 previewMeta 传给原版函数
    const { root, ...rest } = meta && typeof meta === 'object' ? meta : {};
    void root;
    return { path: Array.isArray(rest.path) ? rest.path : [], label: toText(rest.label, '技能'), category: toText(rest.category, '技能'), scope: toText(rest.scope, '魂技'), ...rest };
  }
  // 建立原版依赖的 liveSnapshot：rootData + 当前角色（取 previewMeta.path[1]，否则玩家名）
  function 设计台使用快照(root, meta) {
    const 根 = 设计台取根(root, meta);
    设计台根数据 = 根;
    const 路径 = Array.isArray(meta && meta.path) ? meta.path : [];
    const 玩家 = toText(deepGet(根, 'sys.玩家名', ''), '');
    const 角色名 = 路径[0] === 'char' && 根 && 根.char && 根.char[路径[1]] ? 路径[1] : 玩家;
    const 快照 = { rootData: 根, activeName: 角色名, activeChar: (根 && 根.char && 根.char[角色名]) || {} };
    liveSnapshot = 快照;
    lastRenderableSnapshot = 快照;
    return 快照;
  }

  // ───────────── 1. HTML 往返等价 ─────────────
  // 原版把值写进 HTML 属性/文本再由浏览器解析，这里按同样的转义 + 解码计算出 DOM 中的值
  function 解码实体(文本) {
    return String(文本).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|#39);/gi, (m, e) => {
      const k = e.toLowerCase();
      if (k === 'amp') return '&'; if (k === 'lt') return '<'; if (k === 'gt') return '>'; if (k === 'quot') return '"'; if (k === '#39') return "'";
      return String.fromCodePoint(k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
    });
  }
  const 属性回读 = 值 => 解码实体(escapeHtmlAttr(值));
  const 文本回读 = 值 => 解码实体(htmlEscape(值));
  // <input type="number"> 的取值净化：非合法浮点数文本读出为空串（浏览器行为）
  const 数字输入回读 = 值 => {
    const 文本 = 属性回读(值);
    return /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(文本) ? 文本 : '';
  };
  const 数字净化 = 文本 => (/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(String(文本)) ? String(文本) : '');
  // <textarea> 解析会吃掉开头一个换行
  const 文本域回读 = 值 => 文本回读(值).replace(/^\n/, '');

  // ───────────── 2. 下拉 ≙ buildSkillDesignerSelectOptions ─────────────
  function 设计台下拉(选项列表 = [], 当前值 = '', 空状态文本 = '') {
    const 规范条目列表 = normalizeSkillDesignerOptionEntries(选项列表);
    const 规范选项列表 = normalizeSkillDesignerOptionList(选项列表);
    const 不允许空值 = 规范选项列表.length > 0 && 规范选项列表.every(选项 => 选项.value !== '无');
    if (!规范选项列表.length) {
      const 空文本 =
        normalizeSkillUiText(空状态文本, '') && !/未设置/.test(normalizeSkillUiText(空状态文本, ''))
          ? normalizeSkillUiText(空状态文本, '')
          : '暂无可选';
      return { options: [{ value: '', label: 空文本, disabled: true }], value: '', empty: true };
    }
    const 输出选项列表 = [];
    const 输出条目列表 = [];
    const 已见 = new Set();
    const 加入选项 = 选项 => {
      if (已见.has(选项.value)) return;
      已见.add(选项.value);
      输出选项列表.push(选项);
      return 选项;
    };
    规范条目列表.forEach(条目 => {
      if (条目.type === 'group') {
        const 组选项 = 条目.options.map(加入选项).filter(Boolean);
        if (组选项.length) 输出条目列表.push({ ...条目, options: 组选项 });
        return;
      }
      const 选项 = 加入选项(条目);
      if (选项) 输出条目列表.push({ type: 'option', ...选项 });
    });
    const 当前文本 = toText(当前值, '').trim();
    const 选中值 = 输出选项列表.some(选项 => 选项.value === 当前文本)
      ? toText(当前值, '').trim()
      : 不允许空值 && 当前文本 === '无'
        ? 输出选项列表[0].value
        : 输出选项列表[0].value;
    const options = [];
    const 推入 = (选项, 分组) => {
      const 安全值 = toText(选项.value, '');
      const 项 = { value: 属性回读(安全值), label: 文本回读(toText(选项.label, 安全值)) };
      if (分组) 项.group = 分组;
      项.__selected = 安全值 === 选中值;
      options.push(项);
    };
    输出条目列表.forEach(条目 => {
      if (条目.type !== 'group') 推入(条目);
      else 条目.options.forEach(选项 => 推入(选项, 条目.label));
    });
    return 下拉收口({ options });
  }
  // 依 <select> 规则求当前值：有 selected 取最后一个，否则首个非 disabled 选项
  function 下拉收口(下拉) {
    const 选中 = 下拉.options.filter(项 => 项.__selected);
    let value = '';
    if (选中.length) value = 选中[选中.length - 1].value;
    else { const 首个 = 下拉.options.find(项 => !项.disabled); value = 首个 ? 首个.value : ''; }
    下拉.options.forEach(项 => { delete 项.__selected; });
    下拉.value = value;
    return 下拉;
  }
  // 给 select 控件赋值：浏览器里赋不存在的值会变为未选中（value 读出空串）
  function 设控件值(控件, 值) {
    if (!控件) return;
    const 文本 = String(值 == null ? '' : 值);
    if (控件.kind === 'select') 控件.value = 控件.options.some(项 => 项.value === 文本) ? 文本 : '';
    else if (控件.kind === 'number') 控件.value = 数字净化(文本);
    else 控件.value = 文本;
  }
  // 选项说明：原版在标签里用「值｜说明」的，拆出 hint；状态施加的状态取原版一句话说明
  function 补选项说明(控件, 原型 = '', 字段 = '') {
    if (!控件 || !Array.isArray(控件.options)) return 控件;
    控件.options.forEach(项 => {
      const 分隔 = String(项.label || '').indexOf('｜');
      if (分隔 > 0) 项.hint = 项.label.slice(分隔 + 1);
      if (字段 === '状态' && ['状态施加', '状态移除', '状态转移', '状态交换', '__条件'].includes(原型) && 项.value) {
        const 说明 = 技能设计台状态一句话说明(项.value);
        if (说明) 项.hint = 说明;
      }
    });
    return 控件;
  }

  // ───────────── 3. 原型行 ≙ 构建技能设计台原型效果行列表 / 字段编辑器 / 字段输入 ─────────────
  const 设计台驱动例外原型 = ['机制授予', '时光回溯', '位移执行', '复制执行'];
  function 设计台原型下拉(当前原型 = '') {
    // ≙ 构建技能设计台原型选项：分「战斗内 / 战斗外」两组，组标题是 disabled 选项
    const 当前值 = normalizeSkillUiText(当前原型, '');
    const options = [];
    [
      ['战斗内', 读取技能设计台原型名称列表().filter(原型名 => 读取技能设计台原型摘要(原型名).类别 !== '战斗外')],
      ['战斗外', 读取技能设计台原型名称列表().filter(原型名 => 读取技能设计台原型摘要(原型名).类别 === '战斗外')],
    ].forEach(([标题, 列表]) => {
      if (!列表.length) return;
      options.push({ value: '', label: `── ${标题} ──`, disabled: true, header: true, group: 标题 });
      列表.forEach(原型名 => {
        const 摘要 = 读取技能设计台原型摘要(原型名);
        options.push({ value: 原型名, label: `${原型名}｜${摘要.描述 || 原型名}`, hint: 摘要.描述 || '', group: 标题, category: 摘要.类别, direction: 摘要.方向, __selected: 原型名 === 当前值 });
      });
    });
    return 下拉收口({ kind: 'select', options });
  }
  function 设计台原型字段标签(原型 = '', 字段 = '', 显示名 = '', effect = {}) {
    // ≙ 构建技能设计台原型字段标签：返回 { label, hint }
    const 提示 = 获取技能设计台原型字段提示(原型, 字段, effect);
    const 原型名 = normalizeSkillUiText(原型, '');
    const 字段名 = normalizeSkillUiText(字段, '');
    const 基础标签 = 原型名 === '炸环' && 字段名 === '强化倍率'
      ? '强化倍率 × 年限'
      : 原型名 === '状态施加' && ['数值', '副数值'].includes(字段名)
        ? 技能设计台状态施加字段显示名(effect && effect['状态'], 字段名)
        : 显示名 || 字段;
    return { label: 文本回读(基础标签), hint: 提示 ? 属性回读(提示) : '' };
  }
  function 描述tick输入(标签 = {}, 字段名 = '', value = 0, options = {}) {
    // ≙ 构建技能设计台tick时长输入：日/时/分三格 + 隐藏 tick
    const 最小tick = Math.max(0, parseSkillDesignerIntegerInputValue(options.最小tick, 0, 0));
    const 最大tick = Number.isFinite(Number(options.最大tick)) ? Math.max(最小tick, Math.round(Number(options.最大tick))) : 0;
    const 时长 = 拆分技能设计台tick时长(value, { 最小tick, 最大tick, 默认tick: options.默认tick ?? 最小tick });
    return {
      kind: 'tick', key: 字段名, field: true, ...标签,
      value: 属性回读(时长.tick), tick: 时长.tick,
      parts: { 日: 时长.日, 时: 时长.小时, 分: 时长.分钟 },
      partLimits: { 日: { min: 0, max: 最大tick > 0 ? Math.floor((最大tick * 技能设计台每tick分钟) / 1440) : undefined, step: 1 }, 时: { min: 0, max: 23, step: 1 }, 分: { min: 0, max: 59, step: 10 } },
      minTick: 最小tick, maxTick: 最大tick,
    };
  }
  function 描述原型字段输入(原型 = '', key = '', value = '', fallbackTarget = '单体', options = {}) {
    const 定义 = 读取技能设计台原型字段定义(原型, key, options);
    const 类型 = normalizeSkillUiText(定义['类型'], '文本');
    const 选项 = 读取技能设计台原型字段选项(原型, key, options);
    const 嵌套字段 = normalizeSkillUiText(options && options.嵌套字段, '');
    const effect = options && options.当前效果 && typeof options.当前效果 === 'object' ? options.当前效果 : { ...(options || {}), [key]: value };
    const 时窗字段显示名 = 原型 === '时窗修正'
      ? ({
          调整字段: '调整对象',
          调整方式: '方向',
          调整回合: '回合数',
          调整tick: '时长',
          调整次数: effect['调整字段'] === '触发次数' ? '触发次数' : effect['调整字段'] === '使用次数' ? '使用次数' : '次数',
          结算倍率: '压缩结算',
        }[key] || '')
      : '';
    const 显示字段名 = 时窗字段显示名 || (key === '防御穿透'
      ? '伤害内联穿透%'
      : 原型 === '规则改写' && key === '数值' && normalizeSkillUiText(effect && effect['规则'], '') === '死亡转存活'
        ? '复活恢复比例'
      : 原型 === '战斗外复活' && key === '数值'
        ? '复活恢复比例'
      : key === '资源转移方式'
        ? '转移模式'
      : 原型 === '状态移除' && key === '状态'
        ? '移除状态'
      : 原型 === '状态移除' && key === '匹配原型'
        ? '内部效果'
      : 原型 === '状态移除' && key === '数值方向'
        ? '方向'
      : key === '目标' && 原型 === '机制授予'
        ? '授予对象'
        : key === '目标' && 嵌套字段 === '授予效果'
            ? '作用目标'
              : key === '目标' && 嵌套字段 === '结算效果'
                ? '结算目标'
                : key);
    const 标签 = 设计台原型字段标签(原型, key, 显示字段名, effect);
    const 公共 = { key, field: true, ...标签, type: 类型, default: 定义['默认值'] };
    if (key === '条件分支' && options && options.禁用条件分支) return null;
    if (key === '条件分支') return 描述条件分支编辑器(原型, value, fallbackTarget, 标签.hint);
    if (类型 === '原型列表') return 描述嵌套原型列表编辑器(key, value, fallbackTarget, 标签.hint);
    if (原型 === '机制抹消' && key === '抹消对象') {
      const 对象 = 规范化技能设计台机制抹消对象(value);
      return { ...公共, kind: 'object', value: 对象, json: JSON.stringify(对象), subfields: 描述机制抹消对象字段(对象) };
    }
    const 是必填 = key === '目标' || key === '生效方式' || 技能设计台原型字段是否必填(原型, key);
    const 禁用空值 = Boolean(options && options.禁用空值);
    if (原型 === '炸环' && key === '目标') return { ...公共, kind: 'static', value: '自身', display: '自身', required: true };
    if (key === '生效方式' && options && options.强制独立) return { key, field: true, kind: 'hidden', value: '独立生效', label: '', hint: '', hidden: true };
    if (key === '生效方式' && options && options.固定生效方式) {
      const 固定值 = normalizeSkillUiText(options.固定生效方式, '独立生效');
      return { ...公共, kind: 'static', value: 属性回读(固定值), display: 文本回读(固定值), required: true };
    }
    if (类型 === '枚举') {
      const 可用选项 =
        key === '目标'
          ? 读取技能设计台目标候选(原型, { ...options, 当前效果: options?.当前效果 || { ...(options || {}), [key]: value } })
          : 选项;
      if (!可用选项.length) return null;
      const 下拉选项 = 构建技能设计台原型字段下拉选项(key, 可用选项, 是必填 || 禁用空值);
      const 渲染选项 = 原型 === '状态施加' && key === '状态'
        ? 构建技能设计台状态施加分组选项(normalizeSkillDesignerOptionList(下拉选项).map(item => item.value))
        : 下拉选项;
      const 首个合法值 = Array.isArray(可用选项[0]?.options) ? 可用选项[0].options[0] : 可用选项[0];
      const 当前值 =
        value ||
        (key === '生效方式' && options && options.默认生效方式 ? options.默认生效方式 : '') ||
        ((是必填 || 禁用空值) ? 首个合法值 : '无') ||
        '';
      const 控件 = { ...公共, kind: 'select', required: !!(是必填 || 禁用空值), ...设计台下拉(渲染选项, 当前值) };
      补选项说明(控件, 原型, key);
      if (原型 === '状态施加' && key === '状态') 控件.summary = 技能设计台状态摘要({ ...(options?.当前效果 || {}), 状态: 当前值 });
      if (原型 === '位移执行' && key === '位移类型') 控件.summary = 技能设计台位移执行摘要({ ...(options?.当前效果 || {}), 位移类型: 当前值 });
      return 控件;
    }
    if (类型 === '多枚举') {
      const 可选项 = key === '限定元素' ? SKILL_LIMITED_ELEMENT_OPTIONS : 选项;
      const selected = 读取技能设计台多枚举值(value).filter(item => 可选项.includes(item));
      return {
        ...公共, kind: 'multi', multiple: true,
        options: 可选项.map(option => ({ value: 属性回读(option), label: 文本回读(option) })),
        selected: selected.map(item => 属性回读(item)),
        value: 属性回读(selected.join('|')),
        summary: selected.length ? selected.join('、') : '默认无',
        wide: key === '限定元素',
      };
    }
    if (原型 === '时窗修正' && key === '调整tick') {
      return { ...描述tick输入(标签, '调整tick', value || 6, { 最小tick: 1, 最大tick: 技能设计台时窗最大调整tick, 默认tick: 6 }), type: 类型, default: 定义['默认值'] };
    }
    if (类型 === '数字' || 类型 === '整数') {
      if (技能设计台字段是tick时长(key)) return { ...描述tick输入(标签, key, value, { 最小tick: 0, 默认tick: 0 }), type: 类型, default: 定义['默认值'] };
      const 最大值 = 定义['最大值'] !== undefined ? String(定义['最大值']) : key === '防御穿透' ? '100' : undefined;
      const 最小值 = 定义['最小值'] !== undefined ? String(定义['最小值']) : '0';
      return {
        ...公共, kind: 'number',
        min: 最小值, max: 最大值, step: 类型 === '整数' || key === '防御穿透' ? '1' : '0.01',
        value: 数字输入回读(value), placeholder: '留空 = 无',
        wide: 原型 === '时窗修正' && key === '延迟回合',
      };
    }
    if (类型 === '带符号数值') {
      const 结算 = normalizeSkillUiText(
        options && options.当前效果 && options.当前效果['结算'] !== undefined ? options.当前效果['结算'] : options && options['结算'],
        '',
      );
      const 状态名 = normalizeSkillUiText(
        options && options.当前效果 && options.当前效果['状态'] !== undefined ? options.当前效果['状态'] : options && options['状态'],
        '',
      );
      const 只允许正向强度 = normalizeSkillUiText(原型, '') === '状态施加' && key === '数值' && 技能设计台状态施加使用正向强度数值(状态名);
      const 允许结算绝对值 = normalizeSkillUiText(原型, '') === '结算修正' && ['消耗', '前摇'].includes(结算) && key === '数值';
      const 必须百分比修正 =
        (['判定修正', '结算修正', '位移执行', '决策干扰'].includes(normalizeSkillUiText(原型, '')) && key === '数值') &&
        !允许结算绝对值;
      const pattern = 只允许正向强度
        ? '\\+?[0-9]+(\\.[0-9]+)?%?'
        : 必须百分比修正
        ? '(?:\\+|-)?[0-9]+(\\.[0-9]+)?%'
        : '(?:\\+|-)?[0-9]+(\\.[0-9]+)?%?|x[0-9]+(\\.[0-9]+)?';
      const 占位文本 = 允许结算绝对值
        ? (结算 === '前摇' ? '+20% / -20% / +2 / -2' : '+20% / -20% / +500 / -500')
        : 只允许正向强度 ? '例如 10%'
        : normalizeSkillUiText(原型, '') === '决策干扰' && key === '数值' ? '例如 20%，越高干扰越强'
          : 必须百分比修正 ? '例如 +12%' : '留空 = 无';
      const 数值单位口径 = 读取技能设计台数值字段口径(原型, key, effect);
      if (技能设计台数值字段使用单位下拉(原型, key, effect)) {
        const 当前单位 = 数值单位口径 === '混合' ? 读取技能设计台数值单位(value) : 数值单位口径;
        const 当前值 = 数值单位口径 === '百分比'
          ? 格式化技能设计台百分比字段值(value, '')
          : 格式化技能设计台单位数值(value, 当前单位);
        const 单位禁用 = 数值单位口径 !== '混合';
        // 单位下拉 ≙ 构建技能设计台数值单位下拉：当前单位若非「点数/百分比」则浏览器默认选首项「点数」
        const 单位值 = ['点数', '百分比'].includes(当前单位) ? 当前单位 : '点数';
        return {
          ...公共, kind: 数值单位口径 === '百分比' ? 'percent' : 'signed',
          value: 属性回读(当前值), pattern, placeholder: 占位文本, positiveOnly: 只允许正向强度,
          unit: { value: 单位值, locked: 单位禁用, options: [{ value: '点数', label: '点数' }, { value: '百分比', label: '百分比' }], basis: 数值单位口径 },
        };
      }
      return { ...公共, kind: 'signed', value: 属性回读(value), pattern, placeholder: 占位文本, positiveOnly: 只允许正向强度 };
    }
    if (类型 === '布尔') {
      const 已启用 = value === true || normalizeSkillUiText(value, '') === 'true' || normalizeSkillUiText(value, '') === '启用';
      return { ...公共, kind: 'bool', value: 已启用 };
    }
    if (类型 === '对象') return null;
    return { ...公共, kind: 'text', value: 属性回读(value), placeholder: '留空 = 无' };
  }
  function 描述机制抹消对象字段(对象 = {}) {
    // ≙ 构建技能设计台机制抹消对象字段控件 + 「原型」下拉
    const 匹配器 = 规范化技能设计台机制抹消对象(对象);
    const 原型 = normalizeSkillUiText(匹配器['原型'], '机制授予');
    const 原型下拉 = 设计台下拉(构建技能设计台原型字段下拉选项('原型', 技能设计台机制抹消对象原型选项, true), 对象['原型']);
    const 字段列表 = [{ key: '原型', kind: 'select', label: '原型', hint: '', ...原型下拉 }];
    读取技能设计台机制抹消可匹配字段(原型).forEach(字段 => {
      const 选项 = 读取技能设计台机制抹消对象字段选项(原型, 字段);
      const 值列表 = Array.isArray(匹配器[字段])
        ? 匹配器[字段].map(item => normalizeSkillUiText(item, '')).filter(Boolean)
        : [normalizeSkillUiText(匹配器[字段], '')].filter(Boolean);
      if (选项.length) {
        const 全部标签 = 读取技能设计台机制抹消全部标签(字段);
        const 全部选中 = !值列表.length;
        const options = [{ value: 属性回读(全部标签), label: 文本回读(全部标签), all: true, selected: 全部选中 }];
        normalizeSkillDesignerOptionList(选项).forEach(option => {
          const v = normalizeSkillUiText(option.value, '');
          options.push({ value: 属性回读(v), label: 文本回读(option.label || v), selected: 值列表.includes(v) });
        });
        字段列表.push({ key: 字段, kind: 'multi', multiple: true, label: 文本回读(字段), hint: '', options, selected: options.filter(o => o.selected).map(o => o.value), allLabel: 全部标签 });
      } else {
        字段列表.push({ key: 字段, kind: 'text', label: 文本回读(字段), hint: '', value: 属性回读(格式化技能设计台机制抹消字段值(匹配器[字段])), placeholder: '留空 = 无' });
      }
    });
    return 字段列表;
  }
  function 描述驱动判定属性编辑器(effect = {}) {
    // ≙ 构建技能设计台驱动判定属性编辑器
    const 原型 = normalizeSkillUiText(effect && effect['原型'], '');
    const 目标 = normalizeSkillUiText(effect && effect['目标'], '');
    if (原型 === '伤害结算' || (目标 === '自身' && !设计台驱动例外原型.includes(原型)) || !技能设计台原型需要默认驱动判定(原型, effect)) {
      return {
        kind: 'scaling', hidden: true, rendered: 'hidden',
        controls: [
          { key: '驱动属性', field: true, kind: 'hidden', value: '无', scalingDriver: true, label: '', hint: '' },
          { key: '影响方向', field: true, kind: 'hidden', value: '无', label: '', hint: '' },
        ],
      };
    }
    const 驱动属性 = String((effect && effect['驱动属性']) ?? '无').trim() || '无';
    const 有驱动 = 驱动属性 && 驱动属性 !== '无';
    const 方向原始选项 = 读取技能设计台原型字段选项(原型, '影响方向', { 当前效果: effect });
    const 首个合法方向 = 选择技能设计台默认影响方向(原型, effect, '效果强度');
    const 方向值 = normalizeSkillUiText(effect && effect['影响方向'], 首个合法方向);
    const 方向列表 = 读取技能设计台影响方向选项值(原型, effect);
    const 影响方向 = 有驱动 ? (方向列表.includes(方向值) ? 方向值 : 首个合法方向) : '无';
    const 驱动选项 = 构建技能设计台原型字段下拉选项('驱动属性', 读取技能设计台原型字段选项(原型, '驱动属性'), 有驱动);
    const 驱动标签 = 设计台原型字段标签(原型, '驱动属性', '驱动/判定属性');
    if (原型 === '状态移除') {
      return {
        kind: 'scaling', hidden: false, rendered: 'remove',
        controls: [
          补选项说明({ key: '驱动属性', field: true, kind: 'select', scalingDriver: true, ...驱动标签, ...设计台下拉(驱动选项, 有驱动 ? 驱动属性 : 选择技能设计台默认驱动属性(原型, effect)) }),
          { key: '影响方向', field: true, kind: 'hidden', value: '成功率', label: '', hint: '' },
        ],
      };
    }
    const 方向选项 = 构建技能设计台原型字段下拉选项('影响方向', 方向原始选项, true);
    return {
      kind: 'scaling', hidden: false, rendered: 'full',
      controls: [
        补选项说明({ key: '驱动属性', field: true, kind: 'select', scalingDriver: true, ...驱动标签, ...设计台下拉(驱动选项, 有驱动 ? 驱动属性 : '无') }),
        补选项说明({ key: '影响方向', field: true, kind: 'select', directionField: true, hidden: !有驱动, ...设计台原型字段标签(原型, '影响方向', '影响方向'), ...设计台下拉(方向选项, 有驱动 ? 影响方向 : 首个合法方向) }),
      ],
    };
  }
  function 描述状态移除内部筛选编辑器(effect = {}, fallbackTarget = '单体', options = {}) {
    const 内部字段 = ['匹配原型', '资源', '数值方向']
      .filter(key => 读取技能设计台原型字段列表('状态移除', effect).includes(key))
      .map(key => 描述原型字段输入('状态移除', key, 格式化技能设计台原型字段值(effect && effect[key]), fallbackTarget, options))
      .filter(Boolean);
    if (!内部字段.length) return null;
    const 已启用 = normalizeSkillUiText(effect && effect['匹配原型'], '') && normalizeSkillUiText(effect && effect['匹配原型'], '') !== '无';
    const 匹配原型 = normalizeSkillUiText(effect && effect['匹配原型'], '');
    const 资源 = normalizeSkillUiText(effect && effect['资源'], '');
    const 数值方向 = normalizeSkillUiText(effect && effect['数值方向'], '任意');
    const 摘要 = (() => {
      if (!已启用) return '未启用';
      if (匹配原型 === '资源变化') {
        if (资源 === '生命' && 数值方向 === '负向') return '扣生命状态';
        if (资源 === '生命' && 数值方向 === '正向') return '恢复生命状态';
        if (资源) return `${资源}${数值方向 === '负向' ? '扣减' : 数值方向 === '正向' ? '恢复' : '变化'}状态`;
        return '资源变化状态';
      }
      if (匹配原型 === '护盾变化') return '护盾状态';
      return '内部筛选';
    })();
    return { kind: 'group', label: '内部效果筛选', summary: 摘要, open: !!已启用, controls: 内部字段 };
  }
  function 描述原型字段编辑器(effect = {}, options = {}) {
    // ≙ 构建技能设计台原型字段编辑器（字段顺序、驱动/条件分支放末尾、时窗修正固定顺序全部照搬）
    const prototype = normalizeSkillUiText(effect && effect['原型'], 读取技能设计台原型名称列表()[0] || '伤害结算');
    const target = normalizeSkillDesignerEffectTargetValue(effect && effect['目标'], '单体');
    const 当前效果 = 技能设计台清理并水合原型效果(effect, target, {
      嵌套字段: options && options.嵌套字段,
      强制独立: options && options.强制独立,
      允许对应等级: options && options.允许对应等级,
    });
    const 原始字段列表 = 读取技能设计台原型字段列表(prototype, 当前效果, options);
    const 字段列表 =
      prototype === '时窗修正'
        ? (() => {
            const 调整字段 = normalizeSkillUiText(当前效果 && 当前效果['调整字段'], '持续回合');
            const 模式字段 =
              调整字段 === '有效期tick'
                ? ['调整tick']
                : ['触发次数', '使用次数'].includes(调整字段)
                  ? ['调整次数']
                  : ['调整回合', '结算倍率'];
            const 固定顺序 = ['目标', '生效方式', '调整字段', '调整方式', ...模式字段, '单日使用次数上限', '驱动属性', '影响方向', '条件分支'];
            return [
              ...固定顺序.filter(key => 原始字段列表.includes(key)),
              ...原始字段列表.filter(key => !固定顺序.includes(key)),
            ];
          })()
        : 原始字段列表;
    const 内部筛选字段 = prototype === '状态移除' ? new Set(['匹配原型', '资源', '数值方向']) : new Set();
    const 字段内容 = 字段列表
      .filter(key => !['驱动属性', '影响方向', '条件分支'].includes(key) && !内部筛选字段.has(key))
      .map(key => {
        const rawValue = 当前效果 && 当前效果[key];
        const value = Array.isArray(rawValue) ? rawValue : 格式化技能设计台原型字段值(rawValue);
        return 描述原型字段输入(prototype, key, value, target, { ...options, 当前效果 });
      });
    if (prototype === '状态移除') 字段内容.push(描述状态移除内部筛选编辑器(当前效果, target, options));
    if (字段列表.includes('驱动属性') && 字段列表.includes('影响方向')) 字段内容.push(描述驱动判定属性编辑器(当前效果));
    if (字段列表.includes('条件分支'))
      字段内容.push(描述原型字段输入(prototype, '条件分支', 当前效果 && 当前效果['条件分支'], target, options));
    return { 当前效果, controls: 字段内容.filter(Boolean) };
  }
  function 描述原型效果行列表(effects = [], fallbackTarget = '单体', 允许删空 = false, options = {}, 网格 = {}) {
    // ≙ 构建技能设计台原型效果行列表；网格 = { name: main|condition-replace|condition-append|nested, nestedKind, conditionEffect, branchEntry }
    const source = Array.isArray(effects) ? effects : [];
    const normalized = 允许删空 && !source.length ? [] : 规范化技能设计台原型效果列表(source, fallbackTarget, options);
    const prototypeOptions = 读取技能设计台原型名称列表();
    const 网格对象 = { name: 网格.name || 'main', nestedKind: 网格.nestedKind || '', allowEmpty: !!网格.allowEmpty, conditionEffect: !!网格.conditionEffect, branchEntry: 网格.branchEntry || null, rows: [] };
    normalized.forEach((effect, index) => {
      const prototype = normalizeSkillUiText(effect['原型'], prototypeOptions[0] || '伤害结算');
      const 允许删除当前原型 = 允许删空 || normalized.length > 1;
      const 行选项 = {
        ...options,
        当前效果: effect,
        默认生效方式: options && options.默认生效方式 ? options.默认生效方式 : '跟随主原型',
        固定生效方式:
          options && options.固定首个独立生效 && index === 0 ? '独立生效' : options && options.固定生效方式,
      };
      const 行 = { kind: 'row', prototype, renderedState: prototype === '状态施加' ? normalizeSkillUiText(effect['状态'], '') : '', removable: !!允许删除当前原型, prototypeSelect: 设计台原型下拉(prototype) };
      Object.defineProperty(行, '__grid', { value: 网格对象, writable: true, enumerable: false });
      const 编辑 = 描述原型字段编辑器(effect, 行选项);
      行.fields = 编辑.controls;
      Object.defineProperty(行, '__effect', { value: 编辑.当前效果, writable: true, enumerable: false });
      绑定子网格(行);
      网格对象.rows.push(行);
    });
    Object.defineProperty(网格对象.rows, '__grid', { value: 网格对象, writable: true, enumerable: false });
    return 网格对象.rows;
  }
  // 给行内的嵌套列表 / 条件分支效果列表补父链（模拟 DOM 的 closest 关系）
  function 绑定子网格(行) {
    行.fields.forEach(控件 => {
      if (控件.kind === 'nested') 控件.rows.forEach(子行 => { Object.defineProperty(子行, '__parentRow', { value: 行, writable: true, enumerable: false }); });
      if (控件.kind === 'branch') 控件.branches.forEach(条目 => 绑定分支条目(条目, 行));
    });
  }
  function 绑定分支条目(条目, 行) {
    Object.defineProperty(条目, '__parentRow', { value: 行, writable: true, enumerable: false });
    ['替换效果', '追加效果'].forEach(键 => {
      const 列表 = 条目.effects[键].rows;
      if (列表.__grid) 列表.__grid.branchEntry = 条目;
      列表.forEach(子行 => { Object.defineProperty(子行, '__parentRow', { value: 行, writable: true, enumerable: false }); });
    });
  }

  // ───────────── 4. 条件分支 ≙ 构建技能设计台条件分支编辑器 / 条目 / 条件 ─────────────
  function 描述条件分支编辑器(原型 = '', value = [], fallbackTarget = '单体', 表内提示 = '') {
    const branches = Array.isArray(value) ? value : [];
    void 原型;
    // 原版这里的「条件分支」标签是纯文本，不显示 获取技能设计台原型字段提示 的说明（放在 tableHint）
    return { kind: 'branch', key: '条件分支', field: false, label: '条件分支', hint: '', tableHint: 表内提示 || '', enabled: !!branches.length, fallbackTarget, branches: branches.map(branch => 描述条件分支条目编辑器(branch, fallbackTarget)) };
  }
  function 描述条件分支条目编辑器(branch = {}, fallbackTarget = '单体') {
    const 处理 = normalizeSkillUiText(branch['处理'], '生效');
    const 条件 =
      Array.isArray(branch['条件']) && branch['条件'].length
        ? branch['条件']
        : [{ 类型: '生命比例', 对象: '目标', 比较: '<=', 值: '20%' }];
    const 替换效果 = Array.isArray(branch['替换效果']) ? branch['替换效果'] : [];
    const 追加效果 = Array.isArray(branch['追加效果']) ? branch['追加效果'] : [];
    const 禁用释放前降低结算 = 技能设计台条件列表包含释放后条件(条件);
    const 条目 = {
      kind: 'branchEntry', fallbackTarget,
      conditions: 条件.map(item => 描述条件分支条件编辑器(item, 条件.length > 1)),
      action: { key: '处理', kind: 'select', label: '处理', hint: 技能设计台条件字段提示.处理, ...设计台下拉(SKILL_DESIGNER_CONDITION_BRANCH_ACTION_OPTIONS, 处理) },
      effects: {},
    };
    [['替换效果', 'condition-replace', 替换效果], ['追加效果', 'condition-append', 追加效果]].forEach(([键, 网格名, 列表]) => {
      条目.effects[键] = {
        key: 键, label: 键, hint: 技能设计台条件字段提示[键], hidden: 处理 !== 键, grid: 网格名,
        rows: 列表.length
          ? 描述原型效果行列表(列表, fallbackTarget, true, { 禁用条件分支: true, 禁用释放前降低结算 }, { name: 网格名, allowEmpty: true, conditionEffect: true })
          : 描述原型效果行列表([], fallbackTarget, true, {}, { name: 网格名, allowEmpty: true, conditionEffect: true }),
      };
    });
    return 条目;
  }
  function 条件类型下拉(当前值 = '') {
    // ≙ 构建技能设计台条件类型分组选项
    const 选中值 = SKILL_DESIGNER_CONDITION_BRANCH_TYPE_OPTIONS.includes(toText(当前值, '').trim())
      ? toText(当前值, '').trim()
      : SKILL_DESIGNER_CONDITION_BRANCH_TYPE_OPTIONS[0];
    const options = [];
    SKILL_DESIGNER_CONDITION_BRANCH_TYPE_GROUPS.forEach(分组 => {
      分组.options.filter(选项 => SKILL_DESIGNER_CONDITION_BRANCH_TYPE_OPTIONS.includes(选项)).forEach(选项 => {
        options.push({ value: 选项, label: 选项, group: 分组.label, __selected: 选项 === 选中值 });
      });
    });
    return 下拉收口({ options });
  }
  function 条件比较下拉(类型 = '', 当前值 = '') {
    // ≙ 构建技能设计台条件分支比较控件选项（旗标/状态类型显示「是/否」）
    const type = normalizeSkillUiText(类型, '生命比例');
    const current = 规范化技能设计台条件分支比较值(type, 当前值);
    const options = 构建技能设计台条件分支比较选项(type).map(value => ({
      value,
      label: SKILL_DESIGNER_CONDITION_BRANCH_FLAG_TYPES.includes(type) || type === '状态存在' ? (value === '无' ? '否' : '是') : value,
      __selected: value === current,
    }));
    return 下拉收口({ options });
  }
  function 条件值控件(类型 = '', 比较 = '', value = '') {
    // ≙ 构建技能设计台条件分支值控件
    const 显示配置 = 读取技能设计台条件分支值控件配置(类型, 比较);
    if (显示配置.值控件 === '无') return null;
    if (显示配置.值控件 === '数字') return { key: '值', kind: 'number', min: '0', step: '1', value: 数字输入回读(value) };
    return { key: '值', kind: 'select', ...设计台下拉(显示配置.值选项, value) };
  }
  function 条件状态下拉(状态) {
    return 补选项说明({ key: '状态', kind: 'select', label: '状态', hint: '', ...设计台下拉(构建技能设计台状态施加分组选项(读取技能设计台原型字段选项('状态施加', '状态')), 状态) }, '__条件', '状态');
  }
  function 描述条件分支条件编辑器(condition = {}, 允许删除 = false) {
    const 类型 = normalizeSkillUiText(condition['类型'], '生命比例');
    const 对象 = normalizeSkillUiText(condition['对象'], '目标');
    const 比较 = 规范化技能设计台条件分支比较值(类型, condition['比较']);
    const 值 = 格式化技能设计台原型字段值(condition['值'] ?? (类型 === '目标' ? '自身' : ''));
    const 状态 = normalizeSkillUiText(condition['状态'], '中毒');
    const 显示配置 = 读取技能设计台条件分支值控件配置(类型, 比较);
    const 类型控件 = { key: '类型', kind: 'select', label: '类型', hint: 技能设计台条件字段提示.类型, ...条件类型下拉(类型) };
    if (类型 === '目标') {
      return {
        kind: 'condition', isTargetRow: true, renderedType: 类型, removable: !!允许删除,
        类型: 类型控件,
        对象: { key: '对象', kind: 'hidden', value: '目标' },
        比较隐藏: { key: '比较', kind: 'hidden', value: '==', disabled: false },
        比较: null,
        值: { label: '目标', hidden: false, control: 条件值控件(类型, 比较, 值 || '自身') },
        状态: null,
        preview: 构建技能设计台条件分支条件预览({ 类型, 对象: '目标', 比较: '==', 值: 值 || '自身' }),
      };
    }
    return {
      kind: 'condition', isTargetRow: false, renderedType: 类型, removable: !!允许删除,
      类型: 类型控件,
      对象: { key: '对象', kind: 'hidden', value: 属性回读(对象) },
      比较隐藏: { key: '比较', kind: 'hidden', value: 属性回读(比较), disabled: !!显示配置.显示比较 },
      比较: { key: '比较', kind: 'select', label: 显示配置.比较标签, hint: '', tableHint: 技能设计台条件字段提示.比较, hidden: !显示配置.显示比较, ...条件比较下拉(类型, 比较) },
      值: { label: 显示配置.值标签, hidden: !显示配置.显示值, control: 条件值控件(类型, 比较, 值) },
      状态: { ...条件状态下拉(状态), hidden: !显示配置.显示状态 },
      preview: 构建技能设计台条件分支条件预览(condition),
    };
  }
  function 描述嵌套原型列表编辑器(字段名 = '', value = [], fallbackTarget = '单体', 表内提示 = '') {
    // ≙ 构建技能设计台嵌套原型列表编辑器（标签为纯文本，原版不显示说明徽标）
    const source = Array.isArray(value) ? value : [];
    const 嵌套目标 = 字段名 === '授予效果' ? '单体' : fallbackTarget;
    const 显示字段名 = 字段名 === '授予效果' ? '作用效果' : 字段名 === '结算效果' ? '结算效果' : 字段名;
    const 默认原型 = 字段名 === '结算效果' ? '伤害结算' : '判定修正';
    return {
      kind: 'nested', key: 字段名, field: false, label: 文本回读(显示字段名), hint: '', tableHint: 表内提示 || '',
      defaultPrototype: 默认原型, nestedTarget: 嵌套目标,
      rows: 描述原型效果行列表(source, 嵌套目标, true, { 嵌套字段: 字段名, 强制独立: true }, { name: 'nested', nestedKind: 字段名, allowEmpty: true }),
    };
  }

  // ───────────── 5. 虚拟 DOM 遍历（文档顺序） ─────────────
  // 行内全部「data-skill-designer-prototype-field」输入，按 DOM 顺序，包含嵌套行（owner 标出所属行）
  function* 行内输入(行) { for (const 控件 of 行.fields) yield* 控件输入(控件, 行); }
  function* 控件输入(控件, owner) {
    if (!控件) return;
    if (控件.kind === 'scaling') { for (const c of 控件.controls) yield { ctl: c, owner }; return; }
    if (控件.kind === 'group') { for (const c of 控件.controls) yield* 控件输入(c, owner); return; }
    if (控件.kind === 'nested') { for (const r of 控件.rows) yield* 行内输入(r); return; }
    if (控件.kind === 'branch') { for (const b of 控件.branches) for (const k of ['替换效果', '追加效果']) for (const r of b.effects[k].rows) yield* 行内输入(r); return; }
    if (控件.field) yield { ctl: 控件, owner };
  }
  function* 遍历行(rows) {
    for (const 行 of rows) {
      yield 行;
      for (const 控件 of 行.fields) {
        if (控件.kind === 'nested') yield* 遍历行(控件.rows);
        if (控件.kind === 'branch') for (const b of 控件.branches) for (const k of ['替换效果', '追加效果']) yield* 遍历行(b.effects[k].rows);
      }
    }
  }
  function* 遍历缩放块(rows) {
    for (const 行 of rows) for (const 控件 of 行.fields) {
      if (控件.kind === 'scaling') yield { block: 控件, row: 行 };
      else if (控件.kind === 'nested') yield* 遍历缩放块(控件.rows);
      else if (控件.kind === 'branch') for (const b of 控件.branches) for (const k of ['替换效果', '追加效果']) yield* 遍历缩放块(b.effects[k].rows);
    }
  }
  function* 遍历条件行(rows) {
    for (const 行 of rows) for (const 控件 of 行.fields) {
      if (控件.kind === 'nested') yield* 遍历条件行(控件.rows);
      else if (控件.kind === 'branch') for (const b of 控件.branches) yield* 条目内条件行(b);
    }
  }
  function* 条目内条件行(条目) {
    for (const c of 条目.conditions) yield { cond: c, entry: 条目 };
    for (const k of ['替换效果', '追加效果']) yield* 遍历条件行(条目.effects[k].rows);
  }
  function 控件读值(控件) {
    if (!控件) return undefined;
    if (控件.kind === 'object') return 控件.json;
    if (控件.kind === 'bool') return 'on';
    return 控件.value;
  }
  function 行字段控件(行, 字段名) { for (const { ctl } of 行内输入(行)) if (ctl.key === 字段名) return ctl; return null; }
  const 原型行字段值 = (行, 字段名) => normalizeSkillUiText(控件读值(行字段控件(行, 字段名)), '');

  // ───────────── 6. 挂载期同步 ≙ onMount 的 syncScalingField / 同步原型行默认驱动判定 / syncConditionRow ─────────────
  function 同步缩放块(block, 行) {
    if (!block) return;
    const 原型 = normalizeSkillUiText(行.prototypeSelect.value || 原型行字段值(行, '原型'), '');
    const 目标 = 原型行字段值(行, '目标');
    const 驱动 = block.controls.find(c => c.key === '驱动属性');
    const 方向 = block.controls.find(c => c.key === '影响方向');
    if (原型 === '伤害结算' || (!设计台驱动例外原型.includes(原型) && 目标 === '自身')) {
      block.hidden = true;
      if (驱动) 设控件值(驱动, '无');
      if (方向) 设控件值(方向, '无');
      return;
    }
    block.hidden = false;
    const driver = block.controls.find(c => c.scalingDriver);
    const direction = block.controls.find(c => c.directionField) || null;
    const 刷新方向选项 = (控件, 选项列表, 当前值, 默认值) => {
      const 下拉 = 设计台下拉(选项列表, 选项列表.includes(当前值) ? 当前值 : 默认值);
      控件.options = 下拉.options; 控件.value = 下拉.value;
    };
    const hasDriver = normalizeSkillUiText(driver && driver.value, '无') !== '无';
    const 当前字段 = {
      目标,
      发动方式: 原型行字段值(行, '发动方式'),
      状态: 原型行字段值(行, '状态'),
      数值: 原型行字段值(行, '数值'),
      持续回合: 原型行字段值(行, '持续回合'),
      结算: 原型行字段值(行, '结算'),
    };
    const 合法方向列表 = 读取技能设计台影响方向选项值(原型, 当前字段);
    const 首个合法方向 = 选择技能设计台默认影响方向(原型, 当前字段, '效果强度');
    if (direction) {
      direction.hidden = 原型 === '状态移除' || !hasDriver;
      const 当前方向 = normalizeSkillUiText(direction.value, '');
      刷新方向选项(direction, 合法方向列表, 当前方向, 首个合法方向);
      设控件值(direction, 原型 === '状态移除' && hasDriver
        ? '成功率'
        : hasDriver
          ? (当前方向 === '无' || (合法方向列表.length && !合法方向列表.includes(当前方向)) ? 首个合法方向 : 当前方向)
          : '无');
    }
  }
  function 原型行需要默认驱动判定(行) {
    if (!行) return false;
    if (原型行字段值(行, '驱动属性')) return false;
    const 原型 = normalizeSkillUiText(行.prototypeSelect.value || 原型行字段值(行, '原型'), '');
    if (原型 === '伤害结算' || (!设计台驱动例外原型.includes(原型) && 原型行字段值(行, '目标') === '自身')) return false;
    return 技能设计台原型需要默认驱动判定(原型, {
      目标: 原型行字段值(行, '目标'),
      状态: 原型行字段值(行, '状态'),
      数值: 原型行字段值(行, '数值'),
      结算: 原型行字段值(行, '结算'),
      发动方式: 原型行字段值(行, '发动方式'),
      结算倍率: 原型行字段值(行, '结算倍率'),
      转化比例: 原型行字段值(行, '转化比例'),
      概率: 原型行字段值(行, '概率'),
    });
  }
  function 同步原型行默认驱动判定(行) {
    if (!行 || !原型行需要默认驱动判定(行)) return;
    const 驱动输入 = 行字段控件(行, '驱动属性');
    const 方向输入 = 行字段控件(行, '影响方向');
    const 原型 = normalizeSkillUiText(行.prototypeSelect.value || 原型行字段值(行, '原型'), '');
    const 字段 = {};
    ['状态', '数值', '结算', '威力倍率', '发动方式'].forEach(字段名 => {
      const 字段值 = 原型行字段值(行, 字段名);
      if (字段值) 字段[字段名] = 字段值;
    });
    if (驱动输入) 设控件值(驱动输入, 选择技能设计台默认驱动属性(原型, 字段));
    if (方向输入) 设控件值(方向输入, 选择技能设计台默认影响方向(原型, 字段, '效果强度'));
    const 首块 = 遍历缩放块([行]).next().value;
    if (首块) 同步缩放块(首块.block, 首块.row);
  }
  // 原版 handleSubmit 先 setBusy(true) 把所有 [data-skill-designer-disableable] 控件设为 disabled 再回读表单。
  // 桥接 readCondition 已修（2026-11-08）：忙碌态禁用的可禁用控件照常读取，只跳过有意禁用的隐藏输入 → 保存不再丢条件分支。
  // 保存链仍按忙碌态回读（与原版流程一致），{ keepConditionBranches } 保留为兼容参数，两者结果相同。
  let 设计台回读忙碌态 = false;
  // 物品被动保持承载方式：旧设计台没有物品技能入口，这条只在数据层实现（见 api2.js 物品被动承载），默认开
  const 设计台规则 = { 物品被动保持承载方式: true, 角色被动存为被动: true };
  function 条件读值(条件, 字段名) {
    // ≙ readCondition：同名字段中第一个未有意禁用的输入（DOM 顺序：类型、对象、隐藏比较、比较下拉、值、状态）；
    // 忙碌态（设计台回读忙碌态）只禁用可禁用控件，桥接修复后照常读取，所以这里不再按忙碌态排除
    const 候选 = [条件.类型, 条件.对象, 条件.比较隐藏, 条件.比较, 条件.值 && 条件.值.control, 条件.状态].filter(Boolean);
    const 命中 = 候选.find(c => c.key === 字段名 && !c.disabled);
    return 命中 ? 读取技能设计台原型字段输入值(命中.value) : '';
  }
  function 同步条件行(条件, 条目) {
    // ≙ syncConditionRow
    if (!条件) return 条件;
    const type = normalizeSkillUiText(条件.类型.value, '生命比例');
    const 原类型 = normalizeSkillUiText(条件.renderedType, type);
    if (原类型 !== type || (type === '目标') !== 条件.isTargetRow) {
      const 默认配置 = 读取技能设计台条件分支值控件配置(type, '');
      const 当前值 = normalizeSkillUiText(条件.值 && 条件.值.control ? 条件.值.control.value : '', '');
      const nextCondition = { 类型: type, 对象: '目标', 比较: 规范化技能设计台条件分支比较值(type, '') };
      if (默认配置.显示值) nextCondition['值'] = normalizeSkillDesignerSelectValue(当前值, 默认配置.值选项, 默认配置.值选项[0] || (type === '目标' ? '自身' : ''));
      if (默认配置.显示状态) nextCondition['状态'] = normalizeSkillUiText(条件.状态 && 条件.状态.value, '中毒');
      const 新行 = 描述条件分支条件编辑器(nextCondition, !!条件.removable);
      const 序号 = 条目.conditions.indexOf(条件);
      if (序号 >= 0) 条目.conditions.splice(序号, 1, 新行);
      同步条件行(新行, 条目);
      同步条件分支后置结算限制(条目);
      return 新行;
    }
    if (type === '目标') {
      条件.preview = 构建技能设计台条件分支条件预览({ 类型: '目标', 对象: '目标', 比较: '==', 值: normalizeSkillUiText(条件.值 && 条件.值.control ? 条件.值.control.value : '', '自身') });
      return 条件;
    }
    const compareSelect = 条件.比较;
    const compareHidden = 条件.比较隐藏;
    const compareInput = compareSelect && !compareSelect.disabled ? compareSelect : compareHidden;
    const 显示配置 = 读取技能设计台条件分支值控件配置(type, compareInput && compareInput.value);
    if (compareSelect) compareSelect.label = 显示配置.比较标签;
    if (条件.值) 条件.值.label = 显示配置.值标签;
    if (compareSelect) compareSelect.hidden = !显示配置.显示比较;
    if (compareHidden) {
      compareHidden.disabled = !!显示配置.显示比较;
      compareHidden.value = 规范化技能设计台条件分支比较值(type, compareHidden.value || (compareInput && compareInput.value));
    }
    if (compareSelect) {
      const currentCompare = 规范化技能设计台条件分支比较值(type, compareSelect.value || (compareHidden && compareHidden.value));
      const 下拉 = 条件比较下拉(type, currentCompare);
      compareSelect.options = 下拉.options; compareSelect.value = 下拉.value;
    }
    const 比较源 = 显示配置.显示比较 ? compareSelect : compareHidden;
    const compare = 规范化技能设计台条件分支比较值(type, 比较源 && 比较源.value);
    const nextConfig = 读取技能设计台条件分支值控件配置(type, compare);
    const 当前值 = normalizeSkillUiText(条件.值 && 条件.值.control ? 条件.值.control.value : '', '');
    条件.值 = { label: nextConfig.值标签, hidden: !nextConfig.显示值, control: 条件值控件(type, compare, 当前值) };
    if (条件.状态) 条件.状态.hidden = !nextConfig.显示状态;
    条件.preview = 构建技能设计台条件分支条件预览({
      类型: type,
      对象: normalizeSkillUiText(条件.对象 && 条件.对象.value, '目标'),
      比较: compare,
      值: normalizeSkillUiText(条件.值.control ? 条件.值.control.value : '', ''),
      状态: normalizeSkillUiText(条件.状态 && 条件.状态.value, ''),
    });
    同步条件分支后置结算限制(条目);
    return 条件;
  }
  function 同步条件分支后置结算限制(条目) {
    if (!条目) return;
    const 条件列表 = [...条目内条件行(条目)].map(({ cond }) => ({ 类型: normalizeSkillUiText(cond.类型.value, '') }));
    const 禁用释放前降低结算 = 技能设计台条件列表包含释放后条件(条件列表);
    ['替换效果', '追加效果'].forEach(键 => {
      [...遍历行(条目.effects[键].rows)].forEach(行 => {
        const 原型 = normalizeSkillUiText(行.prototypeSelect.value, '');
        if (原型 !== '结算修正') return;
        let 结算输入 = null, 数值输入 = null;
        for (const { ctl, owner } of 行内输入(行)) {
          if (owner !== 行) continue;
          if (!结算输入 && ctl.key === '结算') 结算输入 = ctl;
          if (!数值输入 && ctl.key === '数值') 数值输入 = ctl;
        }
        if (!结算输入) return;
        const 结算 = normalizeSkillUiText(结算输入.value, '');
        const 数值 = 解析技能设计台正负数值(数值输入 && 数值输入.value);
        if (禁用释放前降低结算 && ['消耗', '前摇'].includes(结算) && 数值 < 0) {
          设控件值(结算输入, '造成伤害');
          重建原型行(行);
        }
      });
    });
  }
  function 重建原型行(行) {
    // ≙ rebuildPrototypeRowFields：按当前行值重新水合并重渲染本行字段
    if (!行) return;
    const nextPrototype = normalizeSkillUiText(行.prototypeSelect.value, '');
    if (!nextPrototype || !SKILL_DESIGNER_PROTOTYPE_REGISTRY[nextPrototype]) return;
    const renderedPrototype = normalizeSkillUiText(行.prototype, '');
    const renderedState = normalizeSkillUiText(行.renderedState, '');
    const 目标控件 = 行字段控件(行, '目标');
    const currentTarget = normalizeSkillUiText(目标控件 && 目标控件.value, '单体');
    const 网格 = 行.__grid;
    const rows = 网格 ? 网格.rows : [];
    const rowIndex = rows.indexOf(行);
    const gridName = normalizeSkillUiText(网格 && 网格.name, '');
    const 允许对应等级 = gridName === 'item-use';
    const currentEffects = 网格 ? 读取虚拟行列表(rows, currentTarget, '', true, { 允许对应等级 }) : [];
    const nestedKind = normalizeSkillUiText(网格 && 网格.nestedKind, '');
    const branchRow = 网格 && 网格.branchEntry;
    const 禁用释放前降低结算 = !!branchRow && 技能设计台条件列表包含释放后条件([...条目内条件行(branchRow)].map(({ cond }) => ({ 类型: cond.类型.value })));
    const currentSource = currentEffects[rowIndex] || {};
    const sourceEffect =
      renderedPrototype && renderedPrototype !== nextPrototype
        ? { 原型: nextPrototype, 目标: currentTarget, 生效方式: currentSource['生效方式'] }
        : { ...currentSource, 原型: nextPrototype, 目标: currentTarget };
    if (nextPrototype === '状态施加' && renderedPrototype === '状态施加' && renderedState && normalizeSkillUiText(sourceEffect['状态'], '') !== renderedState) {
      delete sourceEffect['数值'];
      delete sourceEffect['副数值'];
    }
    if (nextPrototype === '结算修正' && normalizeSkillUiText(sourceEffect['结算'], '') !== '持续伤害引爆' && 是技能设计台持续伤害引爆自动条件(sourceEffect['条件分支'])) {
      delete sourceEffect['条件分支'];
    }
    const currentEffect = 技能设计台清理并水合原型效果(sourceEffect, currentTarget, { 嵌套字段: nestedKind, 强制独立: gridName !== 'main', 允许对应等级 });
    const 禁用条件分支 = !!(网格 && 网格.conditionEffect);
    const 编辑 = 描述原型字段编辑器(currentEffect, {
      禁用条件分支,
      嵌套字段: nestedKind,
      强制独立: gridName !== 'main',
      禁用释放前降低结算,
      固定生效方式: gridName === 'main' && rowIndex === 0 ? '独立生效' : '',
      默认生效方式: '独立生效',
      当前效果: currentEffect,
      允许对应等级,
    });
    行.fields = 编辑.控件 || 编辑.controls;
    行.__effect = 编辑.当前效果;
    绑定子网格(行);
    行.prototype = currentEffect['原型'];
    行.renderedState = currentEffect['原型'] === '状态施加' ? normalizeSkillUiText(currentEffect['状态'], '') : '';
    行.prototypeSelect = 设计台原型下拉(行.prototype);
    for (const { cond, entry } of [...遍历条件行([行])]) 同步条件行(cond, entry);
    for (const { block, row } of [...遍历缩放块([行])]) 同步缩放块(block, row);
  }
  function 挂载同步行(rows) {
    // ≙ onMount 末尾：全部原型行默认驱动 → 全部缩放块 → 全部条件行（均为文档顺序）
    [...遍历行(rows)].forEach(同步原型行默认驱动判定);
    [...遍历缩放块(rows)].forEach(({ block, row }) => 同步缩放块(block, row));
    [...遍历条件行(rows)].forEach(({ cond, entry }) => 同步条件行(cond, entry));
  }

  // ───────────── 7. 回读 ≙ 读取技能设计台原型效果状态 ─────────────
  function 读取虚拟行列表(rows = [], fallbackTarget = '单体', gridName = '', 允许空列表 = false, context = {}) {
    const target = normalizeSkillDesignerEffectTargetValue(fallbackTarget, '单体');
    if (!rows.length && (gridName === 'side' || 允许空列表)) return [];
    const effects = rows
      .map(行 => {
        const prototype = normalizeSkillUiText(行.prototypeSelect && 行.prototypeSelect.value, '');
        if (!prototype || !SKILL_DESIGNER_PROTOTYPE_REGISTRY[prototype]) return null;
        const effect = { 原型: prototype, 目标: target };
        for (const { ctl, owner } of 行内输入(行)) {
          if (owner !== 行) continue;
          const key = normalizeSkillUiText(ctl.key, '');
          if (!key) continue;
          if (ctl.kind === 'bool') {
            if (ctl.value === true) effect[key] = true;
            continue;
          }
          const value = ctl.kind === 'object'
            ? (() => {
                try {
                  const parsed = JSON.parse(ctl.json || '{}');
                  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
                } catch (_) {
                  return {};
                }
              })()
            : ctl.kind === 'multi'
              ? 读取技能设计台多枚举值(ctl.value)
              : 读取技能设计台原型字段输入值(ctl.value);
          if (value === '无') continue;
          if (value !== '' && !(value && typeof value === 'object' && !Array.isArray(value) && !Object.keys(value).length))
            effect[key] = key === '防御穿透' ? Math.max(0, Math.min(100, parseSkillDesignerIntegerInputValue(value, 0, 0))) : value;
        }
        if (prototype === '状态施加' && normalizeSkillUiText(effect['状态'], '') === '无视异常' && !effect['触发限制']) {
          effect['触发限制'] = { 周期: '每日', 次数: 3 };
        }
        行.fields.filter(控件 => 控件.kind === 'branch').forEach(block => {
          if (!block.enabled) return;
          const branches = block.branches
            .map(条目 => {
              const action = normalizeSkillUiText(条目.action && 条目.action.value, '替换效果');
              const conditions = [...条目内条件行(条目)]
                .map(({ cond }) => {
                  const 类型 = normalizeSkillUiText(条件读值(cond, '类型'), '');
                  const 比较 = 规范化技能设计台条件分支比较值(类型, 条件读值(cond, '比较'));
                  const condition = { 类型, 对象: normalizeSkillUiText(条件读值(cond, '对象'), '目标'), 比较 };
                  const 显示配置 = 读取技能设计台条件分支值控件配置(类型, 比较);
                  if (显示配置.显示值) {
                    const value = 条件读值(cond, '值');
                    if (value !== '') condition['值'] = value;
                  }
                  if (显示配置.显示状态) {
                    const state = normalizeSkillUiText(条件读值(cond, '状态'), '');
                    if (state) condition['状态'] = state;
                  }
                  return condition['类型'] ? condition : null;
                })
                .filter(Boolean);
              if (!conditions.length) return null;
              const branch = { 条件: conditions, 处理: action };
              if (action === '替换效果' || action === '追加效果') {
                const effectKey = action === '替换效果' ? '替换效果' : '追加效果';
                const nestedEffects = 读取虚拟行列表(条目.effects[effectKey].rows, target, '', true, {
                  条件分支: true,
                  强制独立: true,
                  允许对应等级: context && context.允许对应等级,
                });
                if (nestedEffects.length) branch[effectKey] = nestedEffects;
              }
              return branch;
            })
            .filter(Boolean);
          if (branches.length) effect['条件分支'] = branches;
        });
        行.fields.filter(控件 => 控件.kind === 'nested').forEach(block => {
          const key = normalizeSkillUiText(block.key, '');
          if (!key) return;
          const nestedEffects = 读取虚拟行列表(block.rows, target, '', true, {
            嵌套字段: key,
            强制独立: true,
            允许对应等级: context && context.允许对应等级,
          });
          if (nestedEffects.length) effect[key] = nestedEffects;
        });
        return effect;
      })
      .filter(Boolean);
    const 规范续效果列表 = 规范化技能设计台原型生效方式列表(effects, context);
    const 归一效果列表 =
      允许空列表 && !规范续效果列表.length ? [] : 规范化技能设计台原型效果列表(规范续效果列表, target, context);
    清理技能设计台等价替换条件分支(归一效果列表);
    return 归一效果列表;
  }

  // ───────────── 8. 副作用行 ≙ 构建技能设计台副作用行列表 / readSideEffects ─────────────
  function 描述副作用行列表(副作用列表 = [], 选项 = {}) {
    const 列表 = 规范化技能设计台副作用列表(副作用列表);
    const 字段名 = normalizeSkillUiText(选项 && 选项.字段名, '副作用列表');
    return 列表.map(条目 => 描述副作用行(条目, 字段名));
  }
  function 描述副作用行(条目 = {}, 字段名 = '副作用列表') {
    const 类型 = normalizeSkillUiText(条目['副作用类型'], '自损反噬');
    const 是致死献祭 = 类型 === '致死献祭';
    const 配置 = 技能设计台副作用配置表_V1[类型] || {};
    const 效果说明 = 格式化技能设计台副作用摘要(条目);
    const 字段 = [
      { key: '副作用类型', kind: 'select', label: '类型', hint: 技能设计台副作用字段提示.类型, ...设计台下拉(技能设计台副作用类型候选_V1, 类型) },
      { key: '触发时机', kind: 'select', label: '时机', hint: 技能设计台副作用字段提示.时机, ...设计台下拉(技能设计台副作用触发时机选项_V1, 条目['触发时机'] || '效果生效后') },
      { key: '生效对象', kind: 'select', label: '对象', hint: 技能设计台副作用字段提示.对象, ...设计台下拉(技能设计台副作用生效对象选项_V1, 条目['生效对象'] || '技能释放者') },
      { key: '触发概率', kind: 'text', label: '概率', hint: 技能设计台副作用字段提示.概率, value: 属性回读(格式化技能设计台概率百分比(条目['触发概率'] ?? 1)) },
    ];
    if (!是致死献祭) {
      // 战后长期代价没有战斗内的持续回合。
      if (!['本源损耗', '重伤昏迷'].includes(类型)) 字段.push({ key: '持续回合', kind: 'number', label: '持续', hint: 技能设计台副作用字段提示.持续, min: '0', step: '1', value: 数字输入回读(String(条目['持续回合'] ?? 1)) });
      字段.push({ key: '数值', kind: 'text', label: 文本回读(配置.数值标签 || '强度'), hint: '', value: 属性回读(条目['数值'] || ''), placeholder: 属性回读(配置.数值 || '+10%') });
      if (配置.副数值) 字段.push({ key: '副数值', kind: 'text', label: 文本回读(配置.副数值标签 || '附加强度'), hint: '', value: 属性回读(条目['副数值'] || ''), placeholder: 属性回读(配置.副数值) });
      字段.push({ key: '关联状态', kind: 'text', label: '关联效果', hint: '', value: 属性回读(条目['关联状态'] || ''), placeholder: '食物增幅', hidden: 条目['触发时机'] !== '效果结束后' });
    }
    // 类型选项说明：原版副作用摘要（按该类型默认参数）
    字段[0].options.forEach(项 => { const 示例 = 创建技能设计台默认副作用条目(项.value); const 说明 = 示例 && 示例.副作用类型 === 项.value ? 格式化技能设计台副作用摘要(示例) : ''; if (说明) 项.hint = 说明; });
    return { kind: 'sideEffect', scope: 字段名, fields: 字段, summary: 是致死献祭 ? '' : 效果说明 };
  }
  function 读取副作用行列表(行列表 = []) {
    return 规范化技能设计台副作用列表(
      行列表.map(行 => {
        const 条目 = {};
        行.fields.forEach(控件 => {
          const key = normalizeSkillUiText(控件.key, '');
          if (!key) return;
          const value = normalizeSkillUiText(控件.value, '');
          if (value || ['触发概率', '持续回合'].includes(key)) 条目[key] = value;
        });
        return 条目;
      }),
    );
  }

  // ───────────── 9. 整张表单 ≙ 预览页模板 + readSkillDesignerFormState ─────────────
  function 构建虚拟表单(designerDraft = {}, previewMeta = {}, snapshot = {}) {
    const 上下文 = 设计台模板上下文(snapshot, previewMeta, designerDraft);
    const scopeLabels = getSkillDesignerScopeLabels(previewMeta);
    const 下拉 = (选项, 当前, 空) => ({ kind: 'select', ...设计台下拉(选项, 当前, 空) });
    const 使用限制无 = (designerDraft.使用限制周期 || '无限制') === '无限制';
    const 是紫极魔瞳功法 = previewMeta.scope === 'art' && (designerDraft.name || previewMeta.label) === '紫极魔瞳';
    const top = {
      name: { kind: 'text', value: 属性回读(designerDraft.name), placeholder: 属性回读(`请输入${scopeLabels.nameFieldLabel}`) },
      type: { kind: 'hidden', value: 属性回读(designerDraft.type || '输出') },
      typeDisplay: 文本回读(designerDraft.typeDisplay || designerDraft.type || '输出'),
      deliveryForm: 下拉(getSkillDesignerDeliveryOptions(designerDraft.type), designerDraft.deliveryForm || '直接生效'),
      使用限制周期: 下拉(技能设计台使用限制周期选项, designerDraft.使用限制周期 || '无限制'),
      使用限制次数: { kind: 'number', min: '1', step: '1', value: 数字输入回读(String(Math.max(1, toNumber(designerDraft.使用限制次数, 1)))), disabled: 使用限制无 },
      启用被动: { kind: 'bool', value: !!上下文.启用被动 },
      被动触发: 下拉(技能设计台被动触发选项, designerDraft.被动触发 || '常驻'),
      被动触发周期: 下拉(技能设计台被动触发周期选项, 上下文.被动触发限制.周期),
      被动触发次数: { kind: 'number', min: '1', step: '1', value: 数字输入回读(String(上下文.被动触发限制.次数)) },
      artStage: 是紫极魔瞳功法 ? { kind: 'text', value: 属性回读(designerDraft.artStage || '未入门') } : null,
      artLevel: 是紫极魔瞳功法 ? { kind: 'number', min: '1', max: '4', step: '1', value: 数字输入回读(String(Math.max(1, toNumber(designerDraft.artLevel, 1)))) } : null,
      constructItemCount: { kind: 'number', min: '1', step: '1', value: 数字输入回读(String(Math.max(1, toNumber(designerDraft.constructItemCount, 1)))) },
      constructDurationTick: 描述tick输入({ label: '有效期', hint: '' }, 'constructDurationTick', Math.max(0, toNumber(designerDraft.constructDurationTick, 0)), { 最小tick: 0, 默认tick: 0 }),
      constructDescription: { kind: 'text', value: 属性回读(designerDraft.constructDescription || ''), placeholder: '例如：闪烁着暗金光芒的晶体' },
      costType: 下拉(SKILL_DESIGNER_RESOURCE_TYPE_OPTIONS, designerDraft.costType),
      costValues: Object.fromEntries(SKILL_DESIGNER_COST_RESOURCE_KEYS.map(资源 => [资源, { kind: 'text', value: 属性回读(上下文.消耗值[资源] ?? ''), placeholder: '无', pattern: '[0-9]+(\\.[0-9]+)?%?' }])),
      sustainValues: Object.fromEntries(SKILL_DESIGNER_COST_RESOURCE_KEYS.map(资源 => [资源, { kind: 'text', value: 属性回读(上下文.维持消耗值[资源] ?? ''), placeholder: '无', pattern: '[0-9]+(\\.[0-9]+)?%?' }])),
      fixedCostRatio: 上下文.固定百分比消耗比例,
      前摇: { kind: 'number', min: '0', step: '1', value: 数字输入回读(String(Math.max(0, toNumber(designerDraft['前摇'], 0)))) },
      启用技能掌控度: { kind: 'bool', value: !!上下文.启用技能掌控度 },
      技能掌控度中心等级: { kind: 'number', min: '1', step: '1', value: 数字输入回读(designerDraft.技能掌控度中心等级 || ''), placeholder: '85' },
      技能掌控度圆满等级: { kind: 'number', min: '1', step: '1', value: 数字输入回读(designerDraft.技能掌控度圆满等级 || ''), placeholder: '99' },
      attachedAttributes: (() => {
        const 已选 = new Set(normalizeSkillDesignerArray(designerDraft.attachedAttributes));
        return { kind: 'multi', options: SKILL_DESIGNER_ATTRIBUTE_OPTIONS.map(项 => toText(项, '').trim()).filter(Boolean).map(项 => ({ value: 属性回读(项), label: 文本回读(项), recommended: 上下文.recommendedAttrs.has(项) })), selected: SKILL_DESIGNER_ATTRIBUTE_OPTIONS.map(项 => toText(项, '').trim()).filter(项 => 项 && 已选.has(项)).map(属性回读) };
      })(),
      visualDesc: { kind: 'textarea', value: 文本域回读(designerDraft.visualDesc), placeholder: '例如：空间剧烈震荡，一柄漆黑如墨的巨刃破空而出...' },
      effectDesc: { kind: 'textarea', value: 文本域回读(designerDraft.effectDesc), placeholder: '总结技能的实际作用，如：造成中等伤害并附带破甲效果' },
      用法模式: 上下文.isFusionDesigner ? 下拉(上下文.融合用法模式选项, designerDraft['用法模式'], '') : null,
      fusionMode: 上下文.isFusionDesigner ? 下拉(上下文.fusionModeOptions, designerDraft.fusionMode, '') : null,
      fusionParticipants: 上下文.isFusionDesigner ? 描述融合参与者行(designerDraft.fusionParticipants, snapshot.rootData, previewMeta) : [],
    };
    const vf = {
      previewMeta, scopeLabels, top,
      rows: designerDraft.prototypeEffects && designerDraft.prototypeEffects.length > 0
        ? 描述原型效果行列表(designerDraft.prototypeEffects, designerDraft.target, false, { 固定首个独立生效: true }, { name: 'main' })
        : [],
      sideEffects: 描述副作用行列表(designerDraft['副作用列表'], { 字段名: '副作用列表' }),
      isConstruct: !!上下文.是造物承载,
      isFusion: !!上下文.isFusionDesigner,
    };
    if (!vf.rows.__grid) Object.defineProperty(vf.rows, '__grid', { value: { name: 'main', nestedKind: '', allowEmpty: false, conditionEffect: false, branchEntry: null, rows: vf.rows }, writable: true, enumerable: false });
    return vf;
  }
  function 描述融合参与者行(participants = [], rootData = {}, previewMeta = {}) {
    // ≙ buildSkillDesignerFusionParticipantRows
    const participantList = normalizeSkillDesignerFusionParticipantList(participants, rootData);
    const mode = participantList.filter(participant => participant.role === 'partner').length ? 'partner' : 'self';
    const partnerCount = participantList.filter(participant => participant.role === 'partner').length;
    return participantList.map(participant => {
      const isSelf = participant.role === 'self';
      const charOptions = isSelf
        ? [{ value: participant.charKey, label: participant.charName || participant.charKey || '当前角色' }]
        : getSkillDesignerFusionCharOptions(rootData, previewMeta, participantList);
      const spiritOptions = getSkillDesignerFusionSpiritOptions(rootData, participant.charKey, participant.spirit);
      const charLabel = participant.charName || participant.charKey || '未设置';
      return {
        role: participant.role,
        char: isSelf
          ? { kind: 'static', value: 属性回读(participant.charKey), display: 文本回读(charLabel), charName: 属性回读(charLabel) }
          : { kind: 'select', ...设计台下拉(charOptions, participant.charKey, '暂无对象') },
        spirit: { kind: 'select', ...设计台下拉(spiritOptions, participant.spirit, spiritOptions.length ? '' : '未接入武魂') },
        removable: !isSelf && mode === 'partner' && partnerCount > 1,
      };
    });
  }
  function 读取虚拟表单(vf, previewMeta = {}) {
    // ≙ readSkillDesignerFormState（字段读取改为读虚拟控件，其余逻辑原样）
    const T = vf.top;
    const 字段表 = {
      name: T.name, type: T.type, deliveryForm: T.deliveryForm, 使用限制周期: T.使用限制周期, 使用限制次数: T.使用限制次数,
      启用被动: T.启用被动, 被动触发: T.被动触发, 被动触发周期: T.被动触发周期, 被动触发次数: T.被动触发次数,
      用法模式: T.用法模式, fusionMode: T.fusionMode, artStage: T.artStage, artLevel: T.artLevel,
      constructItemCount: T.constructItemCount, constructDurationTick: T.constructDurationTick, constructDescription: T.constructDescription,
      costType: T.costType, 前摇: T.前摇, 启用技能掌控度: T.启用技能掌控度, 技能掌控度中心等级: T.技能掌控度中心等级, 技能掌控度圆满等级: T.技能掌控度圆满等级,
      visualDesc: T.visualDesc, effectDesc: T.effectDesc,
    };
    const readField = key => {
      const input = 字段表[key];
      if (input && input.kind === 'bool') return input.value ? '启用' : '无';
      return input ? toText(input.value, '').trim() : '';
    };
    const readToggleField = key => (字段表[key] && 字段表[key].kind === 'bool' && 字段表[key].value ? '启用' : '无');
    const 选中资源 = () => {
      const costType = readField('costType') || '无';
      return costType === '混合' ? SKILL_DESIGNER_COST_RESOURCE_KEYS : SKILL_DESIGNER_COST_RESOURCE_KEYS.includes(costType) ? [costType] : [];
    };
    const readCostValues = () => {
      const result = {};
      选中资源().forEach(key => { const value = normalizeSkillUiText(T.costValues[key] && T.costValues[key].value, ''); if (value) result[key] = value; });
      return result;
    };
    const readSustainCostText = () => {
      const result = {};
      选中资源().forEach(key => { const value = normalizeSkillUiText(T.sustainValues[key] && T.sustainValues[key].value, ''); if (value) result[key] = value; });
      return 格式化技能设计台消耗片段(result);
    };
    const readFusionParticipants = () =>
      (T.fusionParticipants || [])
        .map(行 => {
          const role = normalizeSkillUiText(行.role, '') === 'self' ? 'self' : 'partner';
          const charKey = normalizeSkillUiText(行.char && 行.char.value, '');
          const 选中项 = 行.char && 行.char.kind === 'select' ? 行.char.options.find(项 => 项.value === 行.char.value) || null : null;
          const charName = normalizeSkillUiText(行.char && 行.char.kind === 'static' ? 行.char.charName : null, normalizeSkillUiText(选中项 && 选中项.label, charKey));
          const spirit = normalizeSkillUiText(行.spirit && 行.spirit.value, '');
          return createSkillDesignerFusionParticipant(role, charKey, charName, spirit);
        })
        .filter(participant => participant.charKey || participant.charName || participant.spirit);
    const 被动开关值 = readToggleField('启用被动');
    const 类型字段值 = readField('type');
    const typeMeta = resolveSkillDesignerTypeMeta(previewMeta, 被动开关值 === '无' ? '' : 类型字段值);
    const resolvedPrimaryMain = '';
    const resolvedPrimarySub = '';
    const resolvedTarget = getSkillDesignerDefaultTarget(previewMeta, typeMeta.value);
    const isFusionScope = toText(previewMeta && previewMeta.scope, '') === '武魂融合技';
    const fusionMode = isFusionScope ? normalizeSkillDesignerFusionMode(readField('fusionMode')) : '';
    const 用法模式 = isFusionScope ? 规范化技能设计台融合用法模式(readField('用法模式')) : '';
    const fusionParticipants = isFusionScope ? readFusionParticipants() : [];
    const derivedFusionFields = isFusionScope
      ? deriveSkillDesignerFusionFields(fusionMode, fusionParticipants, '')
      : { fusionPartner: '', fusionSourceSpirits: [], fusionParticipants: [] };
    const derivedMainRole = inferSkillDesignerMainRole(typeMeta.value, resolvedTarget, resolvedPrimaryMain, resolvedPrimarySub);
    const 启用技能掌控度 = 技能设计台启用技能掌控度(previewMeta, { type: typeMeta.value, 启用技能掌控度: readToggleField('启用技能掌控度') });
    const 启用被动 = 技能设计台启用被动(previewMeta, { type: typeMeta.value, 启用被动: 被动开关值 });
    const levelControl = 启用技能掌控度
      ? normalizeSkillDesignerLevelControl({ 中心等级: readField('技能掌控度中心等级'), 圆满等级: readField('技能掌控度圆满等级') })
      : null;
    const 被动触发限制 = 读取技能设计台被动触发限制({ 被动触发周期: readField('被动触发周期'), 被动触发次数: readField('被动触发次数') });
    const 使用限制 = 读取技能设计台使用限制({ 使用限制周期: readField('使用限制周期'), 使用限制次数: readField('使用限制次数') });
    const baseState = {
      name: readField('name') || toText(previewMeta && previewMeta.label, '未命名技能'),
      type: typeMeta.value,
      typeDisplay: typeMeta.display,
      target: 启用被动 ? '自身' : resolvedTarget,
      costType: readField('costType') || '无',
      costValues: readCostValues(),
      sustainCostText: readSustainCostText(),
      前摇: Math.max(0, toNumber(readField('前摇'), 0)),
      启用技能掌控度: 启用技能掌控度 ? '启用' : '无',
      启用被动: 启用被动 ? '启用' : '无',
      被动触发: 启用被动 ? normalizeSkillDesignerSelectValue(readField('被动触发'), 技能设计台被动触发选项, '常驻') : '',
      被动触发周期: 被动触发限制.周期,
      被动触发次数: String(被动触发限制.次数),
      使用限制周期: 使用限制.周期,
      使用限制次数: String(使用限制.次数),
      bonus: '无',
      mainRole: normalizeSkillUiText(derivedMainRole, '未知'),
      primaryMain: resolvedPrimaryMain,
      primarySub: resolvedPrimarySub,
      prototypeEffects: 读取虚拟行列表(vf.rows, resolvedTarget, 'main'),
      deliveryForm: readField('deliveryForm'),
      constructItemCount: Math.max(1, parseSkillDesignerIntegerInputValue(readField('constructItemCount'), 1, 1)),
      constructDurationTick: Math.max(0, parseSkillDesignerIntegerInputValue(readField('constructDurationTick'), 0, 0)),
      constructDescription: normalizeSkillUiText(readField('constructDescription'), ''),
      secondaryMechanics: [],
      attachedAttributes: (T.attachedAttributes.selected || []).map(值 => toText(值, '').trim()).filter(Boolean),
      attributeSource: '无',
      attributeRole: '无',
      coeff: normalizeSkillDesignerCoeffMap({}),
      visualDesc: readField('visualDesc'),
      effectDesc: readField('effectDesc'),
      artStage: readField('artStage') || '未入门',
      artLevel: Math.max(0, toNumber(readField('artLevel'), 0)),
      fusionMode,
      用法模式,
      fusionPartner: derivedFusionFields.fusionPartner,
      fusionSourceSpirits: derivedFusionFields.fusionSourceSpirits,
      fusionParticipants: derivedFusionFields.fusionParticipants,
      副作用列表: 读取副作用行列表(vf.sideEffects),
      使用副作用列表: 读取副作用行列表([]),
      技能掌控度: levelControl,
      技能掌控度中心等级: 启用技能掌控度 ? readField('技能掌控度中心等级') : '',
      技能掌控度圆满等级: 启用技能掌控度 ? readField('技能掌控度圆满等级') : '',
      阵营判定: '自动',
    };
    const firstPrototypeTarget = normalizeSkillUiText(baseState.prototypeEffects && baseState.prototypeEffects[0] && baseState.prototypeEffects[0]['目标'], '');
    if (firstPrototypeTarget) baseState.target = firstPrototypeTarget;
    if (启用被动) baseState.target = '自身';
    baseState.type = 推断技能设计台技能分类(baseState.prototypeEffects, typeMeta.value);
    baseState.typeDisplay = baseState.type;
    baseState.mainRole = normalizeSkillUiText(inferSkillDesignerMainRole(baseState.type, baseState.target, baseState.primaryMain, baseState.primarySub), '未知');
    const implicitAttributeConfig = resolveSkillDesignerImplicitAttributeConfig(baseState, previewMeta);
    return {
      ...baseState,
      attributeSource: implicitAttributeConfig.source,
      attributeRole: implicitAttributeConfig.role,
      coeff: implicitAttributeConfig.coeff,
      cost: formatSkillDesignerFullCostText(baseState.costType, baseState.costValues, baseState.sustainCostText),
      mechanicParams: readSkillDesignerMechanicParamState(null, baseState),
    };
  }
  function 同步草稿(vf, previewMeta, snapshot) {
    // ≙ syncDraftCache：回读 → (融合种子) → buildSkillDesignerFormStateFromDraft
    const formState = 读取虚拟表单(vf, previewMeta);
    const fusionSeed = vf.isFusion ? getSkillDesignerFusionDraftSeed(snapshot, previewMeta, formState) : {};
    return buildSkillDesignerFormStateFromDraft({ ...formState, ...fusionSeed }, previewMeta);
  }
  function 重建承载下拉(vf) {
    // ≙ rebuildDeliveryOptions
    const 当前值 = toText(vf.top.deliveryForm.value, '').trim();
    vf.top.deliveryForm = { kind: 'select', ...设计台下拉(getSkillDesignerDeliveryOptions(vf.top.type.value), 当前值) };
  }
  function 挂载虚拟表单(vf, previewMeta, snapshot) {
    // ≙ onMount 初始化顺序：handleInteractiveRefresh(承载下拉、融合行、refreshPreview) → 行级同步
    重建承载下拉(vf);
    if (vf.isFusion && vf.top.fusionMode) {
      const formState = 读取虚拟表单(vf, previewMeta);
      const fusionSeed = getSkillDesignerFusionDraftSeed(snapshot, previewMeta, formState);
      vf.top.fusionParticipants = 描述融合参与者行(fusionSeed.fusionParticipants, snapshot.rootData, previewMeta);
    }
    const 刷新草稿 = 同步草稿(vf, previewMeta, snapshot);
    vf.openSummaryDraft = 刷新草稿; // 打开瞬间（行级同步之前）原版摘要所用草稿
    vf.top.type.value = 属性回读(刷新草稿.type || '输出');
    vf.top.typeDisplay = 文本回读(刷新草稿.typeDisplay || 刷新草稿.type || '输出');
    重建承载下拉(vf);
    挂载同步行(vf.rows);
    return vf;
  }
  function 渲染并挂载(form, previewMeta, snapshot) {
    return 挂载虚拟表单(构建虚拟表单(form, previewMeta, snapshot), previewMeta, snapshot);
  }


  // ───────────── 10. 对外描述（去掉内部链接，补 visible） ─────────────
  function 导出选项(options) {
    return (Array.isArray(options) ? options : []).map(项 => {
      const 出 = { value: 项.value, label: 项.label };
      ['hint', 'group', 'disabled', 'header', 'category', 'direction', 'recommended', 'all', 'selected'].forEach(k => { if (项[k] !== undefined && 项[k] !== '' && 项[k] !== false) 出[k] = 项[k]; });
      return 出;
    });
  }
  const 导出键 = ['key', 'kind', 'label', 'hint', 'tableHint', 'value', 'display', 'required', 'default', 'min', 'max', 'step', 'placeholder', 'pattern', 'positiveOnly', 'multiple', 'selected', 'summary', 'wide', 'tick', 'parts', 'partLimits', 'minTick', 'maxTick', 'json', 'allLabel', 'type', 'disabled'];
  function 导出控件(控件, 路径, 附加 = {}) {
    if (!控件) return null;
    if (控件.kind === 'scaling') return 控件.controls.map(c => 导出控件(c, 路径, { scaling: true, visible: !控件.hidden && !c.hidden && c.kind !== 'hidden' }));
    if (控件.kind === 'group') return { kind: 'group', label: 控件.label, summary: 控件.summary, open: !!控件.open, visible: true, fields: 控件.controls.flatMap(c => [].concat(导出控件(c, 路径) || [])) };
    if (控件.kind === 'nested') return { kind: 'nested', key: 控件.key, label: 控件.label, hint: '', tableHint: 控件.tableHint, visible: true, defaultPrototype: 控件.defaultPrototype, rows: 控件.rows.map((行, j) => 导出行(行, [...路径, 控件.key, j])) };
    if (控件.kind === 'branch') {
      return {
        kind: 'branch', key: '条件分支', label: 控件.label, hint: '', tableHint: 控件.tableHint, visible: true, enabled: !!控件.enabled,
        branches: 控件.branches.map((条目, b) => {
          const 列 = 键 => ({ label: 条目.effects[键].label, hint: 条目.effects[键].hint, visible: !条目.effects[键].hidden, rows: 条目.effects[键].rows.map((行, j) => 导出行(行, [...路径, '条件分支', b, 键, j])) });
          return { action: 导出控件(条目.action, 路径), conditions: 条目.conditions.map(导出条件), 替换效果: 列('替换效果'), 追加效果: 列('追加效果') };
        }),
      };
    }
    const 出 = {};
    导出键.forEach(k => { if (控件[k] !== undefined) 出[k] = Array.isArray(控件[k]) ? 控件[k].slice() : 控件[k]; });
    if (控件.options) 出.options = 导出选项(控件.options);
    // 驱动属性 / 影响方向：原版标签表里有逐项说明（挂载同步重建方向下拉后标签变为纯值，但说明仍属原版文本）
    if (['驱动属性', '影响方向'].includes(控件.key) && 出.options) 出.options.forEach(项 => { if (!项.hint) { const 说明 = 设计台选项说明(控件.key, 项.value); if (说明) 项.hint = 说明; } });
    if (控件.unit) 出.unit = { ...控件.unit, options: 导出选项(控件.unit.options) };
    if (控件.subfields) 出.subfields = 控件.subfields.map(c => 导出控件(c, 路径));
    出.visible = 附加.visible !== undefined ? 附加.visible : !控件.hidden && 控件.kind !== 'hidden';
    if (附加.scaling) 出.scaling = true;
    if (控件.kind === 'select' && 控件.value === '' && 控件.options && !控件.options.some(项 => 项.value === '')) 出.unselected = true;
    return 出;
  }
  function 设计台选项说明(字段, 值) {
    const 项 = 构建技能设计台原型字段下拉选项(字段, [值], true)[0];
    const 标签 = String((项 && 项.label) || '');
    const 分隔 = 标签.indexOf('｜');
    return 分隔 > 0 ? 标签.slice(分隔 + 1) : '';
  }
  function 导出条件(条件) {
    const 出 = { kind: 'condition', isTargetRow: !!条件.isTargetRow, removable: !!条件.removable, preview: 条件.preview };
    出.类型 = 导出控件(条件.类型);
    出.对象 = { key: '对象', kind: 'hidden', value: 条件.对象.value, visible: false };
    出.比较 = 条件.比较 ? 导出控件(条件.比较) : { key: '比较', kind: 'hidden', value: 条件.比较隐藏.value, visible: false };
    if (条件.比较) 出.比较隐藏 = { value: 条件.比较隐藏.value, disabled: !!条件.比较隐藏.disabled };
    出.值 = 条件.值 && 条件.值.control ? { ...导出控件(条件.值.control), label: 条件.值.label, visible: !条件.值.hidden } : { key: '值', kind: 'none', label: 条件.值 ? 条件.值.label : '', visible: false };
    if (条件.状态) 出.状态 = 导出控件(条件.状态);
    return 出;
  }
  function 导出行(行, 路径) {
    return {
      path: 路径,
      prototype: 行.prototypeSelect.value || 行.prototype,
      removable: !!行.removable,
      prototypeSelect: { key: '原型', kind: 'select', label: '原型', hint: '', value: 行.prototypeSelect.value, options: 导出选项(行.prototypeSelect.options), visible: true },
      fields: 行.fields.flatMap(控件 => [].concat(导出控件(控件, 路径) || [])),
    };
  }

  // ───────────── 11. 表单分区（原版 section 顺序 + 分页） ─────────────
  function 读取分区页名(标题, 标记 = '') {
    const 页 = 技能设计台分页定义.find(定义 => (定义.标题集 || []).includes(标题) || (标记 && (定义.标记集 || []).includes(标记)));
    return 页 ? 页.名称 : '';
  }
  const 是造物 = form => normalizeSkillUiText(form && form.deliveryForm, '') === '造物承载';
  const 设计台分区定义 = [
    { id: 'basic', title: () => '基础框架载体', hintKey: '基础框架载体', visible: () => true },
    { id: 'fusion', title: () => '融合对象', hintKey: '', visible: (form, meta) => meta.scope === '武魂融合技' },
    { id: 'artProgress', title: () => '功法进度', hintKey: '', visible: (form, meta) => meta.scope === 'art' && ((form && form.name) || meta.label) === '紫极魔瞳' },
    { id: 'construct', title: () => '实体凝结参数', hintKey: '', visible: form => 是造物(form) },
    // 模板标题「核心术式阵列 / 使用效果阵列」；挂载后 syncDeliverySections 把文本改成「原型设计 / 使用效果」，说明改走 title 属性
    { id: 'prototypes', title: form => (是造物(form) ? '使用效果' : '原型设计'), templateTitle: form => (是造物(form) ? '使用效果阵列' : '核心术式阵列'), hintKey: form => (是造物(form) ? '使用效果阵列' : '核心术式阵列'), marker: '[data-skill-designer-prototype-title]', visible: () => true },
    { id: 'sideEffects', title: form => (是造物(form) ? '施展副作用' : '副作用'), hintKey: '', marker: '[data-skill-designer-side-effect-title]', visible: () => true },
    { id: 'energy', title: () => '运转能量配置', hintKey: '运转能量配置', visible: () => true },
    { id: 'mastery', title: () => '技能掌控度', hintKey: '技能掌控度', visible: () => true },
    { id: 'attributes', title: () => '元属性特征', hintKey: '元属性特征', visible: () => true },
    { id: 'terminal', title: () => '终端解析图谱', hintKey: '终端解析图谱', visible: () => true },
  ];
  function 设计台分区列表(form = {}, meta = {}, 标题提示表 = {}) {
    return 设计台分区定义.map(定义 => {
      const title = 定义.title(form, meta);
      const 模板标题 = 定义.templateTitle ? 定义.templateTitle(form, meta) : title;
      const 提示键 = typeof 定义.hintKey === 'function' ? 定义.hintKey(form, meta) : 定义.hintKey;
      return { id: 定义.id, title, templateTitle: 模板标题, tab: 读取分区页名(模板标题, 定义.marker), hint: (提示键 && 标题提示表[提示键]) || '', visible: !!定义.visible(form, meta) };
    });
  }
  function 顶层字段描述(vf, form, previewMeta) {
    // 各分区内字段（值取挂载后的虚拟控件）。原版顶层字段没有逐项说明徽标，只有分区标题说明
    const T = vf.top;
    const L = vf.scopeLabels;
    const 字段 = (key, label, 控件, 附加 = {}) => (控件 ? { ...导出控件({ ...控件, key, label, hint: '' }), ...附加, key, label } : null);
    const 启用被动 = 技能设计台启用被动(previewMeta, form);
    const 被动周期 = normalizeSkillUiText(T.被动触发周期.value, '无限制');
    const 使用周期 = normalizeSkillUiText(T.使用限制周期.value, '无限制');
    const costType = normalizeSkillUiText(T.costType.value, '无');
    const 显示资源 = 资源 => costType === 资源 || costType === '混合';
    const 掌控显示 = 技能设计台启用技能掌控度(previewMeta, form);
    return {
      basic: [
        字段('name', L.nameFieldLabel, T.name),
        字段('deliveryForm', '承载方式', T.deliveryForm, { typeDisplay: T.typeDisplay, typeValue: T.type.value }),
        字段('使用限制周期', '使用限制', T.使用限制周期),
        字段('使用限制次数', '限制次数', T.使用限制次数, { visible: 使用周期 !== '无限制', disabled: 使用周期 === '无限制' }),
        字段('启用被动', '被动', T.启用被动, { title: '被动技能' }),
        字段('被动触发', '触发时机', T.被动触发, { visible: 启用被动 }),
        字段('被动触发周期', '次数周期', T.被动触发周期, { visible: 启用被动 }),
        字段('被动触发次数', '触发次数', T.被动触发次数, { visible: 启用被动 && 被动周期 !== '无限制' }),
      ].filter(Boolean),
      fusion: vf.isFusion
        ? [
            字段('用法模式', '用法', T.用法模式),
            字段('fusionMode', '模式', T.fusionMode),
            {
              key: 'fusionParticipants', kind: 'fusionParticipants', label: '融合对象', hint: '', visible: true,
              canAdd: normalizeSkillUiText(T.fusionMode && T.fusionMode.value, '') !== 'self',
              rows: (T.fusionParticipants || []).map(行 => ({ role: 行.role, removable: 行.removable, char: 导出控件({ ...行.char, key: 'char', label: '角色' }), spirit: 导出控件({ ...行.spirit, key: 'spirit', label: '武魂' }) })),
            },
          ].filter(Boolean)
        : [],
      artProgress: T.artStage ? [字段('artStage', '境界', T.artStage), 字段('artLevel', '等级', T.artLevel)] : [],
      construct: [
        字段('constructItemCount', '数量', T.constructItemCount),
        { ...导出控件(T.constructDurationTick), key: 'constructDurationTick', label: '有效期' },
        字段('constructDescription', '物品描述', T.constructDescription),
      ],
      energy: [
        字段('costType', '消耗资源', T.costType, { group: '启动消耗 / 维持重扫' }),
        ...SKILL_DESIGNER_COST_RESOURCE_KEYS.map(资源 => 字段(`cost.${资源}`, `${资源}消耗`, T.costValues[资源], { visible: 显示资源(资源), resource: 资源, badge: 资源 === '魂力' && T.fixedCostRatio > 0 ? `结算${(T.fixedCostRatio * 100).toFixed(0)}%` : '' })),
        ...SKILL_DESIGNER_COST_RESOURCE_KEYS.map(资源 => 字段(`sustain.${资源}`, `${资源}维持`, T.sustainValues[资源], { visible: 显示资源(资源), resource: 资源 })),
        字段('前摇', '前摇', T.前摇),
      ],
      mastery: [
        字段('启用技能掌控度', '技能掌控度', T.启用技能掌控度, { title: '技能掌控度' }),
        字段('技能掌控度中心等级', '中心等级', T.技能掌控度中心等级, { visible: 掌控显示 }),
        字段('技能掌控度圆满等级', '圆满等级', T.技能掌控度圆满等级, { visible: 掌控显示 }),
      ],
      attributes: [{ key: 'attachedAttributes', kind: 'multi', multiple: true, label: '附带属性', hint: '', visible: true, options: 导出选项(T.attachedAttributes.options), selected: T.attachedAttributes.selected.slice() }],
      terminal: [字段('visualDesc', L.visualLabel, T.visualDesc), 字段('effectDesc', L.effectLabel, T.effectDesc)],
    };
  }

  // ───────────── 12. 定位（路径 = 效果内路径） ─────────────
  // 行路径：[i] 主列表第 i 行；[i, '授予效果', j] 嵌套列表；[i, '条件分支', b, '替换效果'|'追加效果', j] 分支效果
  function 定位列表(vf, 路径 = []) {
    let rows = vf.rows;
    let 结果 = { rows };
    let i = 0;
    while (i < 路径.length) {
      const 行 = rows[路径[i]];
      if (!行) throw new Error(`路径无效：${JSON.stringify(路径)}`);
      const 键 = 路径[i + 1];
      if (键 === undefined) return { ...结果, rows, row: 行 };
      if (键 === '条件分支') {
        const 块 = 行.fields.find(c => c.kind === 'branch');
        const 条目 = 块 && 块.branches[路径[i + 2]];
        if (!条目) throw new Error(`条件分支不存在：${JSON.stringify(路径)}`);
        const 类别 = 路径[i + 3];
        if (类别 === undefined) return { rows, row: 行, block: 块, entry: 条目 };
        rows = 条目.effects[类别].rows;
        结果 = { rows, entry: 条目, kind: 类别, parentRow: 行 };
        i += 4;
        continue;
      }
      const 嵌套 = 行.fields.find(c => c.kind === 'nested' && c.key === 键);
      if (!嵌套) throw new Error(`嵌套列表不存在：${键}`);
      rows = 嵌套.rows;
      结果 = { rows, nested: 嵌套, parentRow: 行 };
      i += 2;
    }
    return 结果;
  }
  function 定位行(vf, 路径) {
    const 结果 = 定位列表(vf, 路径);
    if (!结果.row) throw new Error(`行不存在：${JSON.stringify(路径)}`);
    return 结果;
  }
  function 行内控件(行, key) {
    for (const 控件 of 行.fields) {
      if (控件.kind === 'scaling' || 控件.kind === 'group') { const 命中 = 控件.controls.find(c => c.key === key); if (命中) return 命中; }
      else if (控件.key === key && 控件.kind !== 'nested' && 控件.kind !== 'branch') return 控件;
    }
    return null;
  }
  function 同步tick(控件, parts = {}) {
    // ≙ syncTimeParts
    const 取值 = (k, fallback = 0) => parseSkillDesignerIntegerInputValue(parts[k], fallback, 0);
    const 最小tick = Math.max(0, parseSkillDesignerIntegerInputValue(控件.minTick, 0, 0));
    const 最大tick = Math.max(0, parseSkillDesignerIntegerInputValue(控件.maxTick, 0, 0));
    const 总分钟 = Math.max(0, 取值('日') * 1440 + 取值('时') * 60 + 取值('分'));
    const 原始tick = 总分钟 > 0 ? Math.ceil(总分钟 / 技能设计台每tick分钟) : 0;
    const tick = 最大tick > 0 ? Math.max(最小tick, Math.min(最大tick, 原始tick)) : Math.max(最小tick, 原始tick);
    const 显示 = 拆分技能设计台tick时长(tick, { 最小tick, 最大tick, 默认tick: 最小tick });
    控件.parts = { 日: 显示.日, 时: 显示.小时, 分: 显示.分钟 };
    控件.tick = tick;
    控件.value = String(tick);
  }
  function 写控件(控件, 值, 选项 = {}) {
    if (!控件) throw new Error('控件不存在');
    if (控件.kind === 'tick') {
      // 传 {日,时,分} 按 syncTimeParts 折算；传数字视为 tick
      同步tick(控件, 值 && typeof 值 === 'object' ? 值 : { 分: Math.max(0, parseSkillDesignerIntegerInputValue(值, 0, 0)) * 技能设计台每tick分钟 });
      return;
    }
    if (控件.kind === 'bool') { 控件.value = !!值; return; }
    if (控件.kind === 'multi') {
      const 列表 = (Array.isArray(值) ? 值 : 读取技能设计台多枚举值(值)).map(v => toText(v, '').trim()).filter(Boolean);
      const 可选 = (控件.options || []).map(项 => 项.value);
      控件.selected = 可选.filter(v => 列表.includes(v));
      控件.value = 控件.selected.join('|');
      控件.summary = 控件.selected.length ? 控件.selected.join('、') : '未选择';
      return;
    }
    let 文本 = String(值 == null ? '' : 值);
    if (控件.positiveOnly && !选项.raw) 文本 = 文本.replace(/^-+/, '');
    设控件值(控件, 文本);
  }

  // ───────────── 13. 交互动作 ≙ handleChange / handleClick ─────────────
  const 设计台重建字段键 = ['目标', '状态', '来源', '去向', '匹配原型', '选择', '触发条件', '触发方式', '延迟回合', '规则', '判断', '生效方式', '发动方式', '攻击段数', '结算', '数值', '调整字段', '调整方式', '位移类型', '复制类型'];
  function 执行动作(vf, 动作, previewMeta, snapshot) {
    const 类型 = 动作 && 动作.type;
    const 刷新位移摘要 = 行 => {
      const 控件 = 行内控件(行, '位移类型');
      if (控件) 控件.summary = 技能设计台位移执行摘要({ 位移类型: 原型行字段值(行, '位移类型'), 位移对象: 原型行字段值(行, '位移对象'), 距离: 原型行字段值(行, '距离'), 数值: 原型行字段值(行, '数值') });
    };
    const 刷新状态摘要 = 行 => {
      const 控件 = 行内控件(行, '状态');
      if (控件 && 行.prototypeSelect.value === '状态施加') 控件.summary = 技能设计台状态摘要({ 状态: 原型行字段值(行, '状态'), 数值: 原型行字段值(行, '数值'), 副数值: 原型行字段值(行, '副数值'), 触发方式: 原型行字段值(行, '触发方式'), 延迟回合: 原型行字段值(行, '延迟回合') });
    };
    // ≙ syncFusionFields / applyFusionParticipants：按种子重绘参与者行，并以 buildSkillDesignerFormStateFromDraft 结果刷新预览
    const 刷新融合行 = (覆盖 = {}) => {
      const formState = 读取虚拟表单(vf, previewMeta);
      const fusionSeed = getSkillDesignerFusionDraftSeed(snapshot, previewMeta, { ...formState, ...覆盖 });
      vf.top.fusionParticipants = 描述融合参与者行(fusionSeed.fusionParticipants, snapshot.rootData, previewMeta);
      vf.__post = { refresh: buildSkillDesignerFormStateFromDraft({ ...formState, ...fusionSeed }, previewMeta) };
    };
    if (类型 === 'top') {
      const key = 动作.key;
      if (/^cost\./.test(key)) return 写控件(vf.top.costValues[key.slice(5)], 动作.value);
      if (/^sustain\./.test(key)) return 写控件(vf.top.sustainValues[key.slice(8)], 动作.value);
      if (key === 'attachedAttributes') return 写控件(vf.top.attachedAttributes, 动作.value);
      if (key === 'constructDurationTick') return 写控件(vf.top.constructDurationTick, 动作.value);
      const 控件 = vf.top[key];
      if (!控件 || typeof 控件 !== 'object') throw new Error(`未知字段：${key}`);
      写控件(控件, 动作.value);
      if (key === 'name') {
        const 真身名称 = 规范第七魂环真身名称_桥接(控件.value, previewMeta);
        if (真身名称 && 控件.value !== 真身名称) 控件.value = 真身名称;
      }
      if (key === 'fusionMode') 刷新融合行();
      if (key === 'deliveryForm') vf.__post = { rebuildMain: 'reread', refresh: 'reread' }; // ≙ rebuildPrototypeGrid(syncDraftCache())
      return;
    }
    if (类型 === 'fusionParticipant') {
      const 行 = vf.top.fusionParticipants[动作.index];
      if (!行) throw new Error('融合对象行不存在');
      写控件(动作.key === 'spirit' ? 行.spirit : 行.char, 动作.value);
      if (动作.key !== 'spirit') 刷新融合行();
      return;
    }
    if (类型 === 'fusionAdd' || 类型 === 'fusionRemove') {
      if (!vf.top.fusionMode) return;
      if (类型 === 'fusionAdd') 写控件(vf.top.fusionMode, 'partner');
      const 当前 = 同步草稿(vf, previewMeta, snapshot);
      const 参与者 = 类型 === 'fusionAdd'
        ? [...当前.fusionParticipants, createSkillDesignerDefaultPartnerParticipant(snapshot.rootData, previewMeta, 当前.fusionParticipants.map(p => p.charKey))]
        : 当前.fusionParticipants.filter((p, i) => i !== 动作.index);
      刷新融合行({ fusionMode: vf.top.fusionMode.value, fusionParticipants: 参与者 });
      return;
    }
    if (类型 === 'prototype') {
      const { row } = 定位行(vf, 动作.path);
      写控件(row.prototypeSelect, 动作.value);
      重建原型行(row);
      同步原型行默认驱动判定(row);
      return;
    }
    if (类型 === 'effectField' || 类型 === 'unit' || 类型 === 'objectField') {
      const { row } = 定位行(vf, 动作.path);
      const 控件 = 行内控件(row, 类型 === 'objectField' ? '抹消对象' : 动作.key);
      if (!控件) throw new Error(`该行没有字段：${动作.key || '抹消对象'}`);
      if (类型 === 'unit') {
        // ≙ 同步技能设计台数值单位选择
        if (!控件.unit || 控件.unit.locked) return;
        控件.unit.value = ['点数', '百分比'].includes(动作.unit) ? 动作.unit : '';
        控件.value = 格式化技能设计台单位数值(控件.value, normalizeSkillUiText(控件.unit.value, '点数'));
        return;
      }
      if (类型 === 'objectField') {
        // 抹消对象子字段 ≙ handleChange 的 suppress-object 分支
        const sub = 控件.subfields.find(c => c.key === 动作.key);
        if (!sub) throw new Error(`抹消对象没有子字段：${动作.key}`);
        if (动作.key === '原型') {
          写控件(sub, 动作.value);
          const 当前目标 = normalizeSkillUiText((行字段控件(row, '目标') || {}).value, '单体');
          const 新效果 = { 原型: '机制抹消', 目标: 当前目标, 抹消对象: { 原型: sub.value } };
          const 编辑 = 描述原型字段编辑器(新效果, { 当前效果: 新效果 });
          row.fields = 编辑.controls; row.__effect = 编辑.当前效果; 绑定子网格(row);
          const 新控件 = 行内控件(row, '抹消对象');
          if (新控件) { 新控件.value = 规范化技能设计台机制抹消对象({ 原型: sub.value }); 新控件.json = JSON.stringify(新控件.value); }
          return;
        }
        if (sub.kind === 'multi') {
          let 列表 = (Array.isArray(动作.value) ? 动作.value : [动作.value]).map(v => normalizeSkillUiText(v, '')).filter(Boolean);
          if (列表.some(v => 技能设计台机制抹消全部字段值.has(v))) 列表 = sub.options.filter(o => 技能设计台机制抹消全部字段值.has(normalizeSkillUiText(o.value, ''))).map(o => o.value);
          sub.options.forEach(o => { o.selected = 列表.includes(o.value); });
          sub.selected = sub.options.filter(o => o.selected).map(o => o.value);
        } else 写控件(sub, 动作.value);
        const 对象 = {};
        控件.subfields.forEach(c => {
          const 值 = c.kind === 'multi' ? c.options.filter(o => o.selected).map(o => normalizeSkillUiText(o.value, '')) : normalizeSkillUiText(c.value, '');
          if (c.key && 值 && 值 !== '无') 对象[c.key] = 值;
        });
        if (!对象['原型']) 对象['原型'] = '机制授予';
        控件.value = 规范化技能设计台机制抹消对象(对象);
        控件.json = JSON.stringify(控件.value);
        return;
      }
      写控件(控件, 动作.value);
      if (控件.scalingDriver) { const 块 = row.fields.find(c => c.kind === 'scaling'); if (块) 同步缩放块(块, row); }
      if (设计台重建字段键.includes(动作.key)) 重建原型行(row);
      if (动作.key === '持续回合') { const 块 = row.fields.find(c => c.kind === 'scaling'); if (块) 同步缩放块(块, row); }
      if (['位移类型', '位移对象', '距离', '数值'].includes(动作.key)) 刷新位移摘要(row);
      if (['状态', '数值', '副数值', '触发方式', '延迟回合'].includes(动作.key)) 刷新状态摘要(row);
      同步原型行默认驱动判定(row);
      return;
    }
    if (类型 === 'addEffect') {
      const 列表路径 = Array.isArray(动作.path) ? 动作.path : [];
      if (!列表路径.length) {
        // 主列表 ≙ addPrototype：以同步草稿 + 新效果重建整列
        const 当前 = 同步草稿(vf, previewMeta, snapshot);
        const 首个原型 = 读取技能设计台原型名称列表()[0] || '伤害结算';
        const 新效果 = 技能设计台清理并水合原型效果({ 原型: 首个原型 }, 当前.target, {});
        if (Array.isArray(当前.prototypeEffects) && 当前.prototypeEffects.length > 0) 新效果['生效方式'] = '独立生效';
        const 下一草稿 = { ...当前, prototypeEffects: [...规范化技能设计台原型效果列表(当前.prototypeEffects, 当前.target), 新效果] };
        vf.__post = { rebuildMain: 下一草稿, refresh: 下一草稿 };
        return;
      }
      const 定位 = 定位列表(vf, 列表路径);
      const 网格 = 定位.rows.__grid;
      const 父行 = 定位.parentRow;
      const 目标值 = normalizeSkillUiText((父行 && (行字段控件(父行, '目标') || {}).value) || '', '单体');
      let 新行;
      if (定位.entry) {
        // ≙ addConditionEffect
        const 禁用 = 技能设计台条件列表包含释放后条件([...条目内条件行(定位.entry)].map(({ cond }) => ({ 类型: cond.类型.value })));
        const 新效果 = 技能设计台清理并水合原型效果({ 原型: '伤害结算', 生效方式: '独立生效' }, 目标值, { 强制独立: true, 禁用释放前降低结算: 禁用 });
        新行 = 描述原型效果行列表([新效果], 目标值, true, { 禁用条件分支: true, 强制独立: true, 禁用释放前降低结算: 禁用 }, { name: 网格.name, allowEmpty: true, conditionEffect: true })[0];
      } else {
        // ≙ addNestedPrototype
        const 嵌套字段 = normalizeSkillUiText(定位.nested && 定位.nested.key, '');
        const 新效果 = 技能设计台清理并水合原型效果({ 原型: (定位.nested && 定位.nested.defaultPrototype) || '判定修正', 生效方式: '独立生效' }, '单体', { 嵌套字段, 强制独立: true });
        新行 = 描述原型效果行列表([新效果], '单体', true, { 嵌套字段, 强制独立: true }, { name: 'nested', nestedKind: 嵌套字段, allowEmpty: true })[0];
      }
      新行.__grid = 网格; 网格.rows.push(新行);
      if (父行) Object.defineProperty(新行, '__parentRow', { value: 父行, writable: true, enumerable: false });
      return;
    }
    if (类型 === 'removeEffect') {
      const { rows, row } = 定位行(vf, 动作.path);
      const 网格 = rows.__grid || {};
      const 允许空 = 网格.name === 'side' || !!网格.allowEmpty;
      if (rows.length > (允许空 ? 0 : 1)) {
        rows.splice(rows.indexOf(row), 1);
        const 下一草稿 = 同步草稿(vf, previewMeta, snapshot);
        vf.__post = 网格.name === 'main' ? { rebuildMain: 下一草稿, refresh: 下一草稿 } : { refresh: 下一草稿 };
      }
      return;
    }
    if (['branchEnabled', 'addBranch', 'removeBranch', 'branchAction', 'addCondition', 'removeCondition', 'conditionField'].includes(类型)) {
      const { row } = 定位行(vf, 动作.path);
      const 块 = row.fields.find(c => c.kind === 'branch');
      if (!块) throw new Error('该行没有条件分支');
      const 目标值 = normalizeSkillUiText((行字段控件(row, '目标') || {}).value, '单体');
      const 新条目 = () => { const 条目 = 描述条件分支条目编辑器(创建技能设计台默认条件分支(目标值), 目标值); 绑定分支条目(条目, row); return 条目; };
      if (类型 === 'branchEnabled') {
        块.enabled = !!动作.value;
        if (块.enabled && !块.branches.length) { const 条目 = 新条目(); 块.branches.push(条目); 条目.conditions.slice().forEach(c => 同步条件行(c, 条目)); }
        return;
      }
      if (类型 === 'addBranch') { 块.branches.push(新条目()); return; }
      const 条目 = 块.branches[动作.branch];
      if (!条目) throw new Error('条件分支条目不存在');
      if (类型 === 'removeBranch') { 块.branches.splice(动作.branch, 1); return; }
      if (类型 === 'branchAction') {
        写控件(条目.action, 动作.value);
        const 处理 = normalizeSkillUiText(条目.action.value, '替换效果');
        ['替换效果', '追加效果'].forEach(键 => { 条目.effects[键].hidden = 键 !== 处理; });
        return;
      }
      if (类型 === 'addCondition') {
        条目.conditions.push(描述条件分支条件编辑器({ 类型: '生命比例', 对象: '目标', 比较: '<=', 值: '20%' }, true));
        条目.conditions.forEach(c => { c.removable = true; });
        同步条件行(条目.conditions[条目.conditions.length - 1], 条目);
        return;
      }
      const 条件 = 条目.conditions[动作.index];
      if (!条件) throw new Error('条件不存在');
      if (类型 === 'removeCondition') {
        const 数量 = 条目.conditions.length;
        if (数量 > 1) 条目.conditions.splice(动作.index, 1);
        if (数量 === 2) 条目.conditions.forEach(c => { c.removable = false; });
        return;
      }
      const 字段控件 = 动作.key === '类型' ? 条件.类型 : 动作.key === '比较' ? (条件.比较 || 条件.比较隐藏) : 动作.key === '值' ? 条件.值 && 条件.值.control : 动作.key === '状态' ? 条件.状态 : null;
      if (!字段控件) throw new Error(`条件没有字段：${动作.key}`);
      写控件(字段控件, 动作.value);
      if (['类型', '比较'].includes(动作.key)) 同步条件行(条件, 条目);
      return;
    }
    if (类型 === 'addSideEffect') {
      const 当前 = 同步草稿(vf, previewMeta, snapshot);
      const 下一列表 = [...规范化技能设计台副作用列表(当前['副作用列表']), 创建技能设计台默认副作用条目('自损反噬', { 生效对象: 读取技能设计台默认副作用对象(当前, '施展') })];
      vf.sideEffects = 描述副作用行列表(下一列表, { 字段名: '副作用列表' });
      vf.__post = { refresh: { ...当前, 副作用列表: 下一列表 } };
      return;
    }
    if (类型 === 'removeSideEffect') {
      vf.sideEffects.splice(动作.index, 1);
      const 下一草稿 = 同步草稿(vf, previewMeta, snapshot);
      vf.sideEffects = 描述副作用行列表(下一草稿['副作用列表'], { 字段名: '副作用列表' });
      vf.__post = { refresh: 下一草稿 };
      return;
    }
    if (类型 === 'sideEffectField') {
      const 行 = vf.sideEffects[动作.index];
      if (!行) throw new Error('副作用行不存在');
      const 控件 = 行.fields.find(c => c.key === 动作.key);
      if (!控件) throw new Error(`副作用没有字段：${动作.key}`);
      写控件(控件, 动作.value);
      if (动作.key === '副作用类型') {
        // ≙ syncSideEffectRow：按新类型规范化后重绘该行
        const 当前 = {};
        行.fields.forEach(c => { 当前[c.key] = normalizeSkillUiText(c.value, ''); });
        const 下一 = 规范化技能设计台副作用条目(当前, () => {}) || 创建技能设计台默认副作用条目();
        vf.sideEffects[动作.index] = 描述副作用行(下一, 行.scope);
      } else {
        const 时机 = normalizeSkillUiText((行.fields.find(c => c.key === '触发时机') || {}).value, '效果生效后');
        const 关联 = 行.fields.find(c => c.key === '关联状态');
        if (关联) 关联.hidden = 时机 !== '效果结束后';
      }
      return;
    }
    throw new Error(`未知动作：${类型}`);
  }

  // ───────────── 14. 公共 API ─────────────
  // 物品技能（装备 / 魂骨附带）：运行时只认承载方式「被动」为物品被动（MVU_Skill_Runtime 读取物品被动技能条目_V1），
  // 原版设计台却只有「直接生效 / 造物承载」+ 战斗被动开关，存一次物品被动就变成要手动施放的技能。
  // 规则开关打开时：设计台「被动」开关 ⇔ 承载方式「被动」。战斗技能不受影响。
  const 是物品技能范围 = previewMeta => ['equipment_skill', 'soul_bone_skill'].includes(normalizeSkillUiText(previewMeta && previewMeta.scope, ''));
  // 被动技能修复方案 2026-11-12：角色自己的被动（非物品：血脉被动、自创魂技等）原先存成「直接生效」且不写触发时机——战斗把它
  // 当主动技能放，当被动又永不触发（与金龙王 9/11/16 层同病）。规则开关打开时：「被动」开关 ⇔ 承载方式「被动」，并把所选
  // 「触发时机」写进技能级与各效果（效果自带的延迟/遥控等时机不动）；含死亡转存活的走复活通道，只给其余效果写时机。
  // 「常驻」只有物品被动认（物品消费者），角色被动选它写不出时机，战斗开局会记 PASSIVE_NEVER_TRIGGERS。
  function 战斗被动承载与时机(skill, previewMeta, formState) {
    if (!skill || !设计台规则.角色被动存为被动 || 是物品技能范围(previewMeta) || !技能设计台启用被动(previewMeta, formState)) return skill;
    skill.承载方式 = '被动';
    const 时机 = 规范化技能设计台被动触发(formState && formState.被动触发);
    if (!时机 || 时机 === '常驻') return skill;
    const 效果列表 = Array.isArray(skill._效果数组) ? skill._效果数组 : [];
    const 含复活 = 效果列表.some(effect => 技能设计台效果是自身死亡转存活(effect));
    if (!含复活) skill.触发方式 = 时机;
    效果列表.forEach(effect => {
      if (!effect || typeof effect !== 'object' || !normalizeSkillUiText(effect.原型, '') || 技能设计台效果是自身死亡转存活(effect)) return;
      const 自带 = normalizeSkillUiText(effect.触发方式, '');
      if (!自带 || 自带 === '立即触发') effect.触发方式 = 时机;
    });
    return skill;
  }
  function 物品被动承载(skill, previewMeta, formState) {
    if (skill && 设计台规则.物品被动保持承载方式 && 是物品技能范围(previewMeta) && 技能设计台启用被动(previewMeta, formState)) skill.承载方式 = '被动';
    return 战斗被动承载与时机(skill, previewMeta, formState);
  }
  function 设计台准备(meta, root) {
    const previewMeta = 设计台规范元数据(meta);
    const snapshot = 设计台使用快照(root, previewMeta);
    return { previewMeta, snapshot };
  }
  function 设计台原始草稿(skill, previewMeta, snapshot) {
    const skillSource = skill && typeof skill === 'object'
      ? skill
      : previewMeta.path.length ? deepGet(snapshot.rootData, previewMeta.path, {}) || {} : {};
    const rawDesignerDraft = readSkillDesignerDraft(skillSource, previewMeta.label, previewMeta);
    // 规则开关：物品技能承载方式「被动」→ 打开时「被动」开关为开（原版设计台没有被动承载，见 物品被动承载）
    if (设计台规则.物品被动保持承载方式 && 是物品技能范围(previewMeta) && normalizeSkillUiText(skillSource.承载方式, '') === '被动' && !normalizeSkillUiText(rawDesignerDraft.启用被动, ''))
      rawDesignerDraft.启用被动 = '启用';
    // 角色被动（战斗被动承载与时机）：存成「被动」的读回来仍是被动，所选时机读技能级（或首个效果级）触发方式。
    if (设计台规则.角色被动存为被动 && !是物品技能范围(previewMeta) && normalizeSkillUiText(skillSource.承载方式, '') === '被动') {
      if (!normalizeSkillUiText(rawDesignerDraft.启用被动, '')) rawDesignerDraft.启用被动 = '启用';
      const 存档时机 = 规范化技能设计台被动触发(skillSource.触发方式) ||
        (Array.isArray(skillSource._效果数组) ? skillSource._效果数组 : []).map(effect => 规范化技能设计台被动触发(effect && effect.触发方式)).find(Boolean) || '';
      if (存档时机) rawDesignerDraft.被动触发 = 存档时机;
    }
    const fusionDraftSeed = getSkillDesignerFusionDraftSeed(snapshot, previewMeta, rawDesignerDraft);
    return { skillSource, rawDesignerDraft, designerDraft: buildSkillDesignerFormStateFromDraft({ ...rawDesignerDraft, ...fusionDraftSeed }, previewMeta) };
  }
  function 读取COST助手() {
    return (typeof globalThis !== 'undefined' && globalThis.__LWCS_SKILL_COST_HELPERS_V1__)
      || (typeof window !== 'undefined' && window.__LWCS_SKILL_COST_HELPERS_V1__)
      || null;
  }
  // 动作执行后的收尾 ≙ rebuildPrototypeGrid(按需) + refreshPreview（类型隐藏值、承载下拉）
  function 动作后刷新(vf, previewMeta, snapshot) {
    const post = vf.__post || {};
    vf.__post = null;
    if (post.rebuildMain) {
      const 重建草稿 = post.rebuildMain === 'reread' ? 同步草稿(vf, previewMeta, snapshot) : post.rebuildMain;
      vf.rows = 描述原型效果行列表(重建草稿.prototypeEffects, 重建草稿.target, false, { 固定首个独立生效: true }, { name: 'main' });
    }
    const 草稿 = post.refresh && post.refresh !== 'reread' ? post.refresh : 同步草稿(vf, previewMeta, snapshot);
    vf.top.type.value = 属性回读(草稿.type || '输出');
    vf.top.typeDisplay = 文本回读(草稿.typeDisplay || 草稿.type || '输出');
    重建承载下拉(vf);
    return 草稿;
  }
  // ≙ handleSubmit：回读 → buildSkillDesignerUpdatedSkill → COST 截断/分支约束/预算断言 → 写回更新列表
  function 设计台保存(form, meta, baseSkill, root, 选项 = {}) {
    const { previewMeta, snapshot } = 设计台准备(meta, root);
    let vf = null;
    try { vf = 渲染并挂载(form, previewMeta, snapshot); } catch (error) { return { ok: false, skill: null, updates: [], messages: [{ level: 'error', text: error && error.message ? error.message : '技能设计写回失败。' }], formState: null }; }
    return 保存核心(vf, previewMeta, snapshot, baseSkill, 选项);
  }
  function 保存核心(vf, previewMeta, snapshot, baseSkill, 选项 = {}) {
    const messages = [];
    const 结果 = { ok: false, skill: null, updates: [], messages, formState: null };
    try {
      if (!Array.isArray(previewMeta.path) || !previewMeta.path.length) throw new Error('当前技能缺少可写回路径。');
      结果.formStateIdle = 读取虚拟表单(vf, previewMeta);
      设计台回读忙碌态 = 选项.keepConditionBranches !== true;
      let formState;
      try { formState = 读取虚拟表单(vf, previewMeta); } finally { 设计台回读忙碌态 = false; }
      结果.formState = formState;
      const skillSource = baseSkill && typeof baseSkill === 'object' ? baseSkill : deepGet(snapshot.rootData, previewMeta.path, {}) || {};
      const nextSkill = 物品被动承载(buildSkillDesignerUpdatedSkill(skillSource, formState, previewMeta, snapshot.rootData), previewMeta, formState);
      结果.skill = nextSkill;
      const COST助手 = 读取COST助手();
      // 设计台保存的技能按新计价（读档收敛据 计价版本 选口径）。
      if (COST助手 && Number(COST助手.当前技能计价版本_V1) > 0 && nextSkill && typeof nextSkill === 'object') nextSkill.计价版本 = Number(COST助手.当前技能计价版本_V1);
      if (COST助手 && typeof COST助手.评估技能预算_V1 === 'function') {
        const 预算上下文 = 构建技能设计台预算上下文(previewMeta, snapshot.rootData || {}, formState || {});
        const 魂技位 = Math.max(1, Number(previewMeta?.__魂环位 || 预算上下文.魂环位 || 1) || 1);
        const 来源标识 = (() => {
          const 路径 = Array.isArray(previewMeta.path) ? previewMeta.path : [];
          if (路径.includes('武魂融合技')) return '武魂融合技';
          if (路径.includes('魂骨')) return '魂骨技能';
          if (路径.includes('自创魂技')) return '自创魂技';
          return '魂技';
        })();
        if (typeof COST助手.按原型数上限截断_V1 === 'function') {
          const 截断结果 = COST助手.按原型数上限截断_V1(nextSkill, 魂技位, 来源标识);
          if (截断结果?.截断记录) {
            const 记录 = 截断结果.截断记录;
            messages.push({ level: 'warn', title: '原型数超限', text: `效果原型数 ${记录.原数量} 超过该魂技位上限 ${记录.上限}，已截断；丢弃 ${记录.丢弃数} 项: ${记录.丢弃原型.join('、') || '无'}` });
          }
        }
        if (typeof COST助手.条件分支约束_V1 === 'function') {
          const 分支统计 = COST助手.条件分支约束_V1(nextSkill);
          if (分支统计 && (分支统计.截断分支 > 0 || 分支统计.拍平层 > 0 || 分支统计.合并对 > 0)) {
            messages.push({ level: 'warn', title: '条件分支约束', text: `条件分支已规整：截断 ${分支统计.截断分支} 个、拍平嵌套 ${分支统计.拍平层} 层、近似合并 ${分支统计.合并对} 对` });
          }
        }
        // 供界面显示：与保存断言同一技能、同一上下文的预算求值（只读，不改变保存行为）
        try { 结果.budget = COST助手.评估技能预算_V1(nextSkill, { ...预算上下文, path: previewMeta.path, 魂环位: 魂技位, 来源: 预算上下文.来源类别, 启用位级硬上限: true }); } catch (error) { 结果.budget = null; }
        if (选项.跳过预算断言 !== true) {
          if (typeof COST助手.断言技能预算_V1 !== 'function') throw new Error('技能预算断言不可用');
          COST助手.断言技能预算_V1(nextSkill, {
            ...预算上下文,
            path: previewMeta.path,
            魂环位: 魂技位,
            来源: 预算上下文.来源类别,
            启用位级硬上限: true,
          }, normalizeSkillUiText(previewMeta.label || formState.name || '技能设计', '技能设计'));
        }
      }
      if (选项.跳过预算断言 !== true) 结果.updates = buildSkillDesignerWriteUpdates(previewMeta, nextSkill, snapshot.rootData);
      结果.ok = true;
    } catch (error) {
      messages.push({ level: 'error', text: error && error.message ? error.message : '技能设计写回失败。' });
    }
    return 结果;
  }
  function 设计台动作(form, 动作, meta, root) {
    // 无状态：从 form 渲染并挂载一次，按顺序执行全部动作（同一份虚拟 DOM），返回 refreshPreview 所用草稿
    const { previewMeta, snapshot } = 设计台准备(meta, root);
    const vf = 渲染并挂载(form, previewMeta, snapshot);
    let 草稿 = form;
    (Array.isArray(动作) ? 动作 : [动作]).forEach(单个 => { 执行动作(vf, 单个, previewMeta, snapshot); 草稿 = 动作后刷新(vf, previewMeta, snapshot); });
    return 草稿;
  }
  // 有状态会话：保留虚拟 DOM（≙ 原版设计台打开后的 DOM），动作之间不重渲染，与原版显示/回读同生命周期
  function 设计台会话(skill, meta, root) {
    const { previewMeta, snapshot } = 设计台准备(meta, root);
    const 起始 = 设计台原始草稿(skill, previewMeta, snapshot);
    const vf = 渲染并挂载(起始.designerDraft, previewMeta, snapshot);
    let 草稿 = 同步草稿(vf, previewMeta, snapshot);
    const 激活 = () => 设计台使用快照(snapshot.rootData, previewMeta);
    const 会话 = {
      meta: previewMeta,
      initialForm: 起始.designerDraft,
      /** 当前表单 ≙ syncDraftCache()（从虚拟 DOM 现读） */
      get form() { 激活(); return 同步草稿(vf, previewMeta, snapshot); },
      /** 最近一次 refreshPreview 实际使用的草稿（新增原型/副作用等动作原版直接用拼好的草稿刷新预览） */
      get previewForm() { return 草稿; },
      act(动作) {
        激活();
        (Array.isArray(动作) ? 动作 : [动作]).forEach(单个 => { 执行动作(vf, 单个, previewMeta, snapshot); 草稿 = 动作后刷新(vf, previewMeta, snapshot); });
        return 会话;
      },
      view() { 激活(); return 视图核心(vf, previewMeta, snapshot); },
      save(opts = {}) { 激活(); return 保存核心(vf, previewMeta, snapshot, 起始.skillSource, { keepConditionBranches: !!opts.keepConditionBranches }); },
      toSkill(opts = {}) {
        激活();
        const 结果 = 保存核心(vf, previewMeta, snapshot, 起始.skillSource, { 跳过预算断言: true, keepConditionBranches: !!opts.keepConditionBranches });
        const 错误 = 结果.messages.find(m => m.level === 'error');
        if (错误) throw new Error(错误.text);
        return 结果.skill;
      },
      validate(opts = {}) { return 会话.save(opts).messages; },
      tempSkill() { 激活(); const 表单 = 同步草稿(vf, previewMeta, snapshot); return 物品被动承载(构建技能设计台临时技能(表单, previewMeta).临时技能, previewMeta, 表单); },
      summary() { 激活(); return 构建技能设计台当前翻译摘要(同步草稿(vf, previewMeta, snapshot), previewMeta, snapshot.rootData) || '未设置'; },
    };
    return 会话;
  }
  function 设计台视图(form, meta, root) {
    const { previewMeta, snapshot } = 设计台准备(meta, root);
    return 视图核心(渲染并挂载(form, previewMeta, snapshot), previewMeta, snapshot);
  }
  function 视图核心(vf, previewMeta, snapshot) {
    const 当前草稿 = 同步草稿(vf, previewMeta, snapshot);
    const 上下文 = 设计台模板上下文(snapshot, previewMeta, 当前草稿);
    const 分区 = 设计台分区列表(当前草稿, previewMeta, 上下文.标题提示表);
    const 字段 = 顶层字段描述(vf, 当前草稿, previewMeta);
    const scopeLabels = getSkillDesignerScopeLabels(previewMeta);
    return {
      titles: scopeLabels,
      title: `${scopeLabels.studioTitle} / ${获取技能设计台当前标题(snapshot.rootData, previewMeta, deepGet(snapshot.rootData, previewMeta.path, {}) || {}) || 当前草稿.name || previewMeta.label || '未命名'}`,
      typeDisplay: vf.top.typeDisplay,
      sections: 分区.map(区 => ({ ...区, fields: 字段[区.id] || [] })),
      rows: vf.rows.map((行, i) => 导出行(行, [i])),
      emptyGuide: vf.rows.length ? null : { icon: '✦', title: '术式阵列未装配', desc: '请点击下方按钮，为该技能添加基础机制（如：伤害、判定修正、状态授予等）。您可以组合多个原型来构建复杂技能。' },
      sideEffects: vf.sideEffects.map((行, i) => ({ index: i, scope: 行.scope, summary: 行.summary, fields: 行.fields.map(c => 导出控件(c, [])) })),
      draft: 当前草稿,
      preview: {
        fusion: previewMeta.scope === '武魂融合技' ? buildSkillDesignerFusionSummary(当前草稿) || '未设置' : '',
        summary: 构建技能设计台当前翻译摘要(当前草稿, previewMeta, snapshot.rootData) || '未设置',
        progress: previewMeta.scope === 'art' ? buildSkillDesignerArtProgressSummary(当前草稿) || '未设置' : '',
        attribute: buildSkillDesignerAttributeSummary(当前草稿) || '未设置',
      },
    };
  }
  function 单行字段(effect, ctx = {}) {
    const 网格名 = ctx.grid || 'main';
    const 序号 = Math.max(0, Number(ctx.index) || 0);
    const fallbackTarget = ctx.fallbackTarget || (effect && effect['目标']) || '单体';
    const 选项 = 网格名 === 'main'
      ? { 固定首个独立生效: 序号 === 0 }
      : 网格名 === 'nested' ? { 嵌套字段: ctx.nestedKind || '', 强制独立: true } : { 禁用条件分支: true, 禁用释放前降低结算: !!ctx.禁用释放前降低结算 };
    const rows = 描述原型效果行列表([effect], fallbackTarget, 网格名 !== 'main', 选项, { name: 网格名, nestedKind: ctx.nestedKind || '', allowEmpty: 网格名 !== 'main', conditionEffect: /^condition/.test(网格名) });
    挂载同步行(rows);
    return rows.length ? 导出行(rows[0], [序号]).fields : [];
  }

  const 公共接口 = {
    version: 1,
    /** 规则开关（可改）：{ 物品被动保持承载方式 }（默认开） */
    rules: 设计台规则,
    /** 设置默认根数据（不传 root 的调用都用它；缺省回退 window.LWCS_SAVE） */
    setRoot(root) { 设计台根数据 = root && typeof root === 'object' ? root : null; },
    /** previewMeta 构造器（与原版各入口一致） */
    meta: {
      ring: (角色, 武魂槽, 魂灵槽, 魂环槽, 魂技键, label) => ({ path: ['char', 角色, 武魂槽, 魂灵槽, 魂环槽, 魂技键], label: label || 魂技键, category: '魂环魂技', scope: '魂技' }),
      independentRing: (角色, 武魂槽, 魂环槽, 魂技键, label) => ({ path: ['char', 角色, 武魂槽, 魂环槽, 魂技键], label: label || 魂技键, category: '独立魂环魂技', scope: 'independent_ring_skill' }),
      fusion: (角色, 记录键, label) => ({ path: ['char', 角色, '武魂融合技', 记录键, '技能数据'], label: label || 记录键, category: '武魂融合技', scope: '武魂融合技' }),
      art: (角色, 功法名) => ({ path: ['char', 角色, '功法', 功法名], label: 功法名, category: '功法', scope: 'art' }),
      custom: (角色, 技能键, label) => ({ path: ['char', 角色, '自创魂技', 技能键], label: label || 技能键, category: '自创魂技', scope: '自创魂技' }),
      // 血脉三类与魂骨：路径与 scope 同原版 buildBloodlineConfig / 构建技能设计台预算上下文（原版魂骨技能只在物品定义里改 JSON，这里补设计台入口）
      blood: (角色, 技能键, label) => ({ path: ['char', 角色, '血脉之力', '技能', 技能键], label: label || 技能键, category: '血脉散技', scope: 'blood_skill' }),
      bloodPassive: (角色, 技能键, label) => ({ path: ['char', 角色, '血脉之力', '被动', 技能键], label: label || 技能键, category: '血脉特性', scope: 'blood_passive' }),
      bloodRing: (角色, 环位, 魂技键, label) => ({ path: ['char', 角色, '血脉之力', 环位, 魂技键], label: label || 魂技键, category: '血脉魂环', scope: 'blood_ring_skill' }),
      bone: (角色, 槽位, 技能键, label) => ({ path: ['char', 角色, '魂骨', 槽位, '附带技能', 技能键], label: label || 技能键, category: '魂骨技能', scope: 'soul_bone_skill' }),
      // 装备技能：原版没有设计台入口（只在物品定义编辑器里裸改 JSON）。槽位可多段（魂导器 / 装配 / 一号位）；
      // 分类含「装备」→ 原版预算上下文的来源类别 = 装备技能（来源承载 1.35），预算角色 = 佩戴者
      equip: (角色, 槽位, 技能键, label) => ({ path: ['char', 角色, '装备', ...[].concat(槽位), '装备技能', 技能键], label: label || 技能键, category: '装备技能', scope: 'equipment_skill' }),
      fromPreviewKey: key => parseSkillDesignerPreviewKey(key),
      toPreviewKey: meta => buildSkillDesignerPreviewKey(设计台规范元数据(meta)),
    },
    /** 技能 → 原版初始表单 designerDraft（≙ readSkillDesignerDraft + 融合种子 + buildSkillDesignerFormStateFromDraft） */
    fromSkill(skill, meta, root) {
      const { previewMeta, snapshot } = 设计台准备(meta, root);
      return 设计台原始草稿(skill, previewMeta, snapshot).designerDraft;
    },
    /** 打开设计台后的实时表单：初始表单经「渲染 → 挂载同步 → 回读 → syncDraftCache」 */
    open(skill, meta, root) {
      const { previewMeta, snapshot } = 设计台准备(meta, root);
      const { designerDraft } = 设计台原始草稿(skill, previewMeta, snapshot);
      return 同步草稿(渲染并挂载(designerDraft, previewMeta, snapshot), previewMeta, snapshot);
    },
    /** 表单 → 原版保存的技能（只含正式字段；结构校验失败抛出原版错误文本；不做 COST 预算断言，断言见 validate/save） */
    toSkill(form, meta, baseSkill, root, opts = {}) {
      const 结果 = 设计台保存(form, meta, baseSkill, root, { 跳过预算断言: true, keepConditionBranches: !!(opts && opts.keepConditionBranches) });
      const 错误 = 结果.messages.find(m => m.level === 'error');
      if (错误) throw new Error(错误.text);
      return 结果.skill;
    },
    /** 完整保存链 ≙ handleSubmit：{ ok, skill, updates:[{path,value}], messages:[{level,text,title?}] } */
    save(form, meta, baseSkill, root, opts = {}) { return 设计台保存(form, meta, baseSkill, root, { keepConditionBranches: !!(opts && opts.keepConditionBranches) }); },
    /** ≙ 构建技能设计台临时技能（COST 引擎与试算用）；默认 live：先按原版 refreshPreview 刷新草稿 */
    tempSkill(form, meta, root, 选项 = {}) {
      const { previewMeta, snapshot } = 设计台准备(meta, root);
      const 草稿 = 选项.live === false ? form : 同步草稿(渲染并挂载(form, previewMeta, snapshot), previewMeta, snapshot);
      return 构建技能设计台临时技能(草稿, previewMeta).临时技能;
    },
    /** ≙「最终摘要」行文本（原版空串显示「未设置」） */
    summary(form, meta, root, 选项 = {}) {
      const { previewMeta, snapshot } = 设计台准备(meta, root);
      const 草稿 = 选项.live === false ? form : 同步草稿(渲染并挂载(form, previewMeta, snapshot), previewMeta, snapshot);
      return 构建技能设计台当前翻译摘要(草稿, previewMeta, snapshot.rootData) || '未设置';
    },
    /** 原版保存时的全部检查（按原版顺序，第一处错误即中止，与原版 toast 一致）：[{ level:'error'|'warn', text, title? }] */
    validate(form, meta, root, baseSkill, opts = {}) { return 设计台保存(form, meta, baseSkill, root, { keepConditionBranches: !!(opts && opts.keepConditionBranches) }).messages; },
    /** 新增原型 ≙ 点「新增原型」再把该行原型下拉切到 prototypeName；opts.path = 列表路径（[] 主列表 / [i,'授予效果'] / [i,'条件分支',b,'替换效果']） */
    newEffect(prototypeName, form, meta, root, opts = {}) {
      const 列表路径 = Array.isArray(opts.path) ? opts.path : [];
      const { previewMeta, snapshot } = 设计台准备(meta, root);
      let 下一 = 设计台动作(form, { type: 'addEffect', path: 列表路径 }, meta, root);
      const 列表 = 定位列表(渲染并挂载(下一, previewMeta, snapshot), 列表路径).rows;
      const 末行路径 = [...列表路径, Math.max(0, 列表.length - 1)];
      if (prototypeName && 列表.length && 列表[列表.length - 1].prototypeSelect.value !== prototypeName) {
        下一 = 设计台动作(下一, { type: 'prototype', path: 末行路径, value: prototypeName }, meta, root);
      }
      const 列表2 = 定位列表(渲染并挂载(下一, previewMeta, snapshot), 列表路径).rows;
      const 主列表 = !列表路径.length;
      const 效果们 = 读取虚拟行列表(列表2, 主列表 ? getSkillDesignerDefaultTarget(previewMeta, 下一.type) : '单体', 主列表 ? 'main' : '', !主列表, 主列表 ? {} : { 强制独立: true });
      return { effect: 效果们[效果们.length - 1] || null, form: 下一, path: 末行路径 };
    },
    /** ≙ 开启条件分支 / 新增分支：创建技能设计台默认条件分支(行目标) */
    newBranch(effect) { return 创建技能设计台默认条件分支(normalizeSkillUiText(effect && effect['目标'], '单体')); },
    /** ≙「新增条件」 */
    newCondition() { return { 类型: '生命比例', 对象: '目标', 比较: '<=', 值: '20%' }; },
    /** ≙「+ 副作用」：默认自损反噬，对象按草稿推断 */
    newSideEffect(form) { return 创建技能设计台默认副作用条目('自损反噬', { 生效对象: 读取技能设计台默认副作用对象(form || {}, '施展') }); },
    /** 交互动作（与原版事件处理同语义），返回新的实时表单；可传动作数组顺序执行 */
    act(form, action, meta, root) { return 设计台动作(form, action, meta, root); },
    /** 有状态会话（推荐 UI 使用）：session(skill|null, meta, root) → { form, act(), view(), save(), toSkill(), tempSkill(), summary(), validate() } */
    session(skill, meta, root) { return 设计台会话(skill, meta, root); },
    /** 整张设计台视图：分区/字段/原型行/副作用/摘要（值为原版挂载后 DOM 中的值） */
    view(form, meta, root) { return 设计台视图(form, meta, root); },
    schema: {
      sections: 设计台分区定义.map(定义 => ({
        id: 定义.id,
        title: 定义.title({}, {}),
        templateTitle: 定义.templateTitle ? 定义.templateTitle({}, {}) : 定义.title({}, {}),
        tab: 读取分区页名(定义.templateTitle ? 定义.templateTitle({}, {}) : 定义.title({}, {}), 定义.marker),
        hint: (() => { const 表 = 设计台模板上下文({ rootData: {} }, { path: [], scope: '魂技' }, {}).标题提示表; const 键 = typeof 定义.hintKey === 'function' ? 定义.hintKey({}, {}) : 定义.hintKey; return (键 && 表[键]) || ''; })(),
        visible: (form, meta) => !!定义.visible(form || {}, 设计台规范元数据(meta)),
      })),
      sectionsFor(form, meta, root) {
        const { previewMeta, snapshot } = 设计台准备(meta, root);
        return 设计台分区列表(form || {}, previewMeta, 设计台模板上下文(snapshot, previewMeta, form || {}).标题提示表);
      },
      tabs: 技能设计台分页定义.map(页 => ({ name: 页.名称, titles: [...页.标题集] })),
      top: {
        deliveryOptions: type => getSkillDesignerDeliveryOptions(type).map(v => ({ value: v, label: v })),
        useLimitPeriods: 技能设计台使用限制周期选项.map(v => ({ value: v, label: v })),
        passiveTriggers: 技能设计台被动触发选项.map(v => ({ value: v, label: v })),
        passivePeriods: 技能设计台被动触发周期选项.map(v => ({ value: v, label: v })),
        resourceTypes: SKILL_DESIGNER_RESOURCE_TYPE_OPTIONS.map(v => ({ value: v, label: v })),
        costKeys: [...SKILL_DESIGNER_COST_RESOURCE_KEYS],
        attributes: SKILL_DESIGNER_ATTRIBUTE_OPTIONS.map(v => ({ value: v, label: v })),
        recommendedAttributes: form => normalizeSkillDesignerArray(SKILL_DESIGNER_ATTRIBUTE_HINTS_BY_TYPE[(form && form.type) || ''] || []),
        scopeLabels: meta => getSkillDesignerScopeLabels(设计台规范元数据(meta)),
        castTimeByDelivery: { ...SKILL_DESIGNER_RUNTIME_CAST_TIME_BY_DELIVERY },
      },
      prototypes: 设计台原型下拉('').options.filter(项 => !项.header).map(项 => ({ name: 项.value, category: 项.category, group: 项.group, label: 项.label, hint: 项.hint, direction: 项.direction })),
      prototypeRegistry: name => SKILL_DESIGNER_PROTOTYPE_REGISTRY[name] || null,
      /** 单个效果行的字段（≙ 该效果在 ctx.grid 第 ctx.index 行渲染并挂载同步后的控件） */
      fields: 单行字段,
      targets(effect, ctx = {}) {
        const 原型 = normalizeSkillUiText(effect && effect['原型'], '伤害结算');
        const 当前效果 = 技能设计台清理并水合原型效果(effect || {}, normalizeSkillDesignerEffectTargetValue(effect && effect['目标'], '单体'), { 嵌套字段: ctx.nestedKind, 强制独立: !!(ctx.grid && ctx.grid !== 'main') });
        return 读取技能设计台目标候选(原型, { 嵌套字段: ctx.nestedKind || '', 当前效果 }).map(v => ({ value: v, label: v }));
      },
      condition: {
        typeGroups: SKILL_DESIGNER_CONDITION_BRANCH_TYPE_GROUPS.map(组 => ({ label: 组.label, options: 组.options.filter(o => SKILL_DESIGNER_CONDITION_BRANCH_TYPE_OPTIONS.includes(o)).map(o => ({ value: o, label: o, group: 组.label })) })),
        objects: 构建技能设计台条件分支对象选项(),
        compare: type => 条件比较下拉(type, '').options.map(({ value, label }) => ({ value, label })),
        valueControl: (type, compare) => {
          const 配置 = 读取技能设计台条件分支值控件配置(type, compare);
          return {
            kind: 配置.值控件 === '数字' ? 'number' : 配置.值控件 === '无' ? 'none' : 'select',
            options: 配置.值控件 === '数字' || 配置.值控件 === '无' ? [] : normalizeSkillDesignerOptionList(配置.值选项),
            label: 配置.值标签, compareLabel: 配置.比较标签, showCompare: 配置.显示比较, showValue: 配置.显示值, showState: 配置.显示状态,
          };
        },
        states: 条件状态下拉('中毒').options.map(({ value, label, group, hint }) => ({ value, label, group, ...(hint ? { hint } : {}) })),
        actions: SKILL_DESIGNER_CONDITION_BRANCH_ACTION_OPTIONS.map(v => ({ value: v, label: v })),
        hints: { ...技能设计台条件字段提示 },
        preview: condition => 构建技能设计台条件分支条件预览(condition || {}),
        summary: branches => 构建技能设计台条件分支摘要(branches || []),
      },
      sideEffect: {
        types: 技能设计台副作用类型候选_V1.map(v => ({ value: v, label: v, config: { ...(技能设计台副作用配置表_V1[v] || {}) } })),
        triggers: 技能设计台副作用触发时机选项_V1.map(v => ({ value: v, label: v })),
        targets: 技能设计台副作用生效对象选项_V1.map(v => ({ value: v, label: v })),
        hints: { ...技能设计台副作用字段提示 },
        fields: row => 描述副作用行(规范化技能设计台副作用条目(row || {}, () => {}) || 创建技能设计台默认副作用条目(), '副作用列表').fields.map(c => 导出控件(c, [])),
        summary: row => 格式化技能设计台副作用摘要(row || {}),
      },
      tick: {
        parts: ['日', '时', '分'],
        minutesPerTick: 技能设计台每tick分钟,
        windowMaxTick: 技能设计台时窗最大调整tick,
        toTick(parts = {}, opts = {}) { const 控件 = { minTick: opts.minTick || 0, maxTick: opts.maxTick || 0 }; 同步tick(控件, parts); return 控件.tick; },
        fromTick(tick = 0, opts = {}) { const r = 拆分技能设计台tick时长(tick, { 最小tick: opts.minTick || 0, 最大tick: opts.maxTick, 默认tick: opts.minTick || 0 }); return { 日: r.日, 时: r.小时, 分: r.分钟, tick: r.tick }; },
      },
      units: { options: [{ value: '点数', label: '点数' }, { value: '百分比', label: '百分比' }], format: (value, unit) => 格式化技能设计台单位数值(value, unit), basis: (原型, 字段, effect) => 读取技能设计台数值字段口径(原型, 字段, effect || {}) },
      hints: {
        prototypeField: (原型, 字段, effect) => 获取技能设计台原型字段提示(原型, 字段, effect || {}),
        condition: { ...技能设计台条件字段提示 },
        sideEffect: { ...技能设计台副作用字段提示 },
        sections: { ...设计台模板上下文({ rootData: {} }, { path: [], scope: '魂技' }, {}).标题提示表 },
        legacyParam: { ...技能设计台参数提示表 },
      },
    },
    /** 调试：原版 HTML 生成器与虚拟表单（对照用） */
    _debug: {
      rowHtml: (effects, fallbackTarget, 允许删空, options) => 构建技能设计台原型效果行列表(effects, fallbackTarget, 允许删空, options),
      virtualForm: (form, meta, root) => { const { previewMeta, snapshot } = 设计台准备(meta, root); return 渲染并挂载(form, previewMeta, snapshot); },
      readVirtualForm: (vf, meta) => 读取虚拟表单(vf, 设计台规范元数据(meta)),
      writeUpdates: (meta, skill, root) => { const { previewMeta, snapshot } = 设计台准备(meta, root); return buildSkillDesignerWriteUpdates(previewMeta, skill, snapshot.rootData); },
      liveDraft: (form, meta, root) => { const { previewMeta, snapshot } = 设计台准备(meta, root); return 同步草稿(渲染并挂载(form, previewMeta, snapshot), previewMeta, snapshot); },
      openSummaryDraft: (form, meta, root) => { const { previewMeta, snapshot } = 设计台准备(meta, root); return 渲染并挂载(form, previewMeta, snapshot).openSummaryDraft; },
    },
  };
  if (typeof window !== 'undefined') window.LWCS_DESIGNER_MODEL = 公共接口;
  globalThis.LWCS_DESIGNER_MODEL = 公共接口;

})();

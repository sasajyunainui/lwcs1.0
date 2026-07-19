(() => {
  'use strict';

  const 适配器版本 = 'lwcs-database-adapter-v1';
  const 通用适配器键 = '__ACU_PLOT_RUNTIME_ADAPTER__';
  const 专属适配器键 = '__LWCS_DATABASE_ADAPTER__';
  const MVU运行时视图占位符 = '{{MVU_RUNTIME_VIEW}}';
  const MVU运行时更新占位符 = '{{MVU_RUNTIME_UPDATE}}';
  const MVU更新结构提示占位符 = '{{MVU_UPDATE_STRUCTURE_HINTS}}';
  const MVU相互可见性视图占位符 = '{{MVU_MUTUAL_VISIBILITY_VIEW}}';
  const 时间线预览占位符 = '{{剧情钩子._引导.时间线预览}}';
  const 远端原著时间线候选占位符 = '{{剧情钩子._引导.远端原著时间线候选}}';
  const 角色基础六维对标占位符 = '{{角色基础六维对标}}';
  const 剧情当前地点占位符 = '{{剧情当前地点}}';
  const 剧情当前主身份占位符 = '{{剧情当前主身份}}';
  const 场景候选角色资料占位符 = '{{场景候选角色资料}}';
  const 场景背景角色补充占位符 = '{{场景背景角色补充}}';
  const 场景审计材料占位符 = '{{场景审计材料}}';
  const 玩家角色表占位符 = '{{玩家角色表}}';
  const 战斗裁断任务占位符 = '{{战斗裁断任务}}';
  const 战斗裁断输出格式占位符 = '{{战斗裁断输出格式}}';
  const 本轮前置承诺表 = new Map();
  const 本轮模块路由接管表 = new Map();
  const 本轮战斗裁断接管表 = new Map();
  const 本轮MVU前置记录表 = new Map();
  const 本轮提示限流表 = new Map();
  let 本轮战斗结算上下文 = null;
  const 正则引擎缓存 = { 模块: null, 承诺: null };
  const 正则近场缓存表 = new Map();
  let 最近MVU前置记录键 = '';
  let 本轮StatData = null;
  let 本轮输入文本 = '';
  const 魂灵塔层规则 = Object.freeze([
    Object.freeze({ label: '千年魂灵区', gateStart: 1, gateEnd: 18, minAge: 1000, maxAge: 9999, qualitySteps: Object.freeze(['C', 'B', 'A']) }),
    Object.freeze({ label: '万年魂灵区', gateStart: 19, gateEnd: 36, minAge: 10000, maxAge: 99999, qualitySteps: Object.freeze(['B', 'A', 'S']) }),
    Object.freeze({ label: '万年以上魂灵区', gateStart: 37, gateEnd: 99, minAge: 10000, maxAge: 99999, qualitySteps: Object.freeze(['A', 'S']) }),
    Object.freeze({ label: '凶兽魂灵区', gateStart: 100, gateEnd: 108, minAge: 100000, maxAge: 200000, qualitySteps: Object.freeze(['S+']) }),
  ]);
  const 魂灵塔总层数 = 108;
  const 魂灵塔标准物种 = Object.freeze(['龙类', '蛛类', '熊类', '植物系', '海魂兽', '鸟类', '猫科', '蛇类']);

  function 收集窗口() {
    const 窗口列表 = [];
    const 加入窗口 = (候选窗口) => {
      try {
        if (候选窗口 && typeof 候选窗口 === 'object' && !窗口列表.includes(候选窗口)) 窗口列表.push(候选窗口);
      } catch (_) {}
    };
    try { 加入窗口(window.parent); } catch (_) {}
    try { 加入窗口(window.top); } catch (_) {}
    try { 加入窗口(window); } catch (_) {}
    try { 加入窗口(globalThis); } catch (_) {}
    for (let 序号 = 0; 序号 < 窗口列表.length; 序号 += 1) {
      try { Array.from(窗口列表[序号].frames || []).forEach(加入窗口); } catch (_) {}
    }
    return 窗口列表;
  }

  function 读取窗口字段(字段名) {
    for (const 当前窗口 of 收集窗口()) {
      try {
        const 字段值 = 当前窗口?.[字段名];
        if (字段值) return 字段值;
      } catch (_) {}
    }
    return null;
  }

  function 读取窗口函数(函数名) {
    const 函数 = 读取窗口字段(函数名);
    return typeof 函数 === 'function' ? 函数 : null;
  }

  function 读取剧情模块StagingStatData(context = {}) {
    const 读取函数 = 读取窗口函数('__LWCS_GET_STORY_MODULE_STAGING_STAT__');
    if (typeof 读取函数 !== 'function') return null;
    try {
      const 结果 = 读取函数({
        userInput: context.originalUserInput || context.userInput || '',
        用户输入文本: context.originalUserInput || context.userInput || '',
      });
      return 结果 && typeof 结果 === 'object' ? 结果 : null;
    } catch (_) {
      return null;
    }
  }

  function 读取酒馆上下文() {
    try {
      if (window.SillyTavern && typeof window.SillyTavern.getContext === 'function') return window.SillyTavern.getContext();
    } catch (_) {}
    try {
      if (window.parent?.SillyTavern && typeof window.parent.SillyTavern.getContext === 'function') return window.parent.SillyTavern.getContext();
    } catch (_) {}
    return null;
  }

  function 读取聊天数组() {
    const 上下文 = 读取酒馆上下文();
    return Array.isArray(上下文?.chat) ? 上下文.chat : [];
  }

  function 读取消息当前滑动编号(消息) {
    const 当前编号 = Number(消息?.swipe_id);
    return Number.isInteger(当前编号) && 当前编号 >= 0 ? 当前编号 : '';
  }

  function 读取消息正文(消息) {
    if (!消息 || typeof 消息 !== 'object') return '';
    const 当前滑动编号 = 读取消息当前滑动编号(消息);
    if (当前滑动编号 !== '' && Array.isArray(消息.swipes)) {
      const 当前滑动正文 = 消息.swipes[当前滑动编号];
      if (typeof 当前滑动正文 === 'string') return 当前滑动正文;
      if (当前滑动正文 && typeof 当前滑动正文.mes === 'string') return 当前滑动正文.mes;
    }
    return typeof 消息.mes === 'string' ? 消息.mes : '';
  }

  function 读取最新角色消息元信息() {
    const 聊天数组 = 读取聊天数组();
    for (let 消息索引 = 聊天数组.length - 1; 消息索引 >= 0; 消息索引 -= 1) {
      const 消息 = 聊天数组[消息索引];
      if (!消息 || 消息.is_user) continue;
      return {
        文本: 读取消息正文(消息),
        消息索引,
        消息编号: String(消息?.id ?? 消息?.message_id ?? 消息索引),
        滑动编号: 读取消息当前滑动编号(消息),
      };
    }
    return { 文本: '', 消息索引: -1, 消息编号: '', 滑动编号: '' };
  }

  function 读取最新用户消息元信息() {
    const 聊天数组 = 读取聊天数组();
    for (let 消息索引 = 聊天数组.length - 1; 消息索引 >= 0; 消息索引 -= 1) {
      const 消息 = 聊天数组[消息索引];
      if (!消息 || !消息.is_user) continue;
      return {
        文本: 读取消息正文(消息),
        消息索引,
        消息编号: String(消息?.id ?? 消息?.message_id ?? 消息索引),
        滑动编号: 读取消息当前滑动编号(消息),
      };
    }
    return { 文本: '', 消息索引: -1, 消息编号: '', 滑动编号: '' };
  }

  function 取哈希(文本) {
    const 源文本 = String(文本 || '');
    let 哈希 = 2166136261;
    for (let 序号 = 0; 序号 < 源文本.length; 序号 += 1) {
      哈希 ^= 源文本.charCodeAt(序号);
      哈希 = Math.imul(哈希, 16777619);
    }
    return (哈希 >>> 0).toString(16);
  }

  function 克隆JSON值(值, 回退值 = {}) {
    if (值 === null || typeof 值 !== 'object') {
      if (typeof 值 === 'function' || typeof 值 === 'symbol') return 回退值;
      return 值;
    }
    if (Array.isArray(值)) return 值.map(项 => 克隆JSON值(项, 项));
    const 原型 = Object.getPrototypeOf(值);
    if (原型 === Object.prototype || 原型 === null) {
      const 输出 = {};
      Object.entries(值).forEach(([键, 子值]) => {
        输出[键] = 克隆JSON值(子值, 子值);
      });
      return 输出;
    }
    try {
      return structuredClone(值);
    } catch (_) {}
    try {
      return JSON.parse(JSON.stringify(值));
    } catch (_) {}
    return 回退值;
  }

  function 规范化战斗结算上下文(payload = {}) {
    const 输入 = payload && typeof payload === 'object' ? payload : {};
    const 结构化摘要 = String(输入.结构化摘要 || 输入.battleSummary || 输入.summary || '').trim();
    const 裁断卷宗 = String(输入.裁断卷宗 || 输入.settlementDossier || 输入.dossier || '').trim();
    if (!结构化摘要 && !裁断卷宗) return null;
    return {
      id: String(输入.id || 输入.批次ID || `battle-settlement-${Date.now()}`).trim(),
      结构化摘要,
      裁断卷宗,
      来源: String(输入.来源 || 输入.source || 'battle_ui').trim(),
      时间戳: Number(输入.时间戳 || 输入.timestamp || Date.now()) || Date.now(),
    };
  }

  function 登记战斗结算上下文(payload = {}) {
    const 上下文 = 规范化战斗结算上下文(payload);
    if (!上下文) return { ok: false, reason: 'battle_settlement_context_empty' };
    本轮战斗结算上下文 = 上下文;
    return { ok: true, id: 上下文.id, context: 克隆JSON值(上下文, 上下文) };
  }

  function 读取战斗结算上下文() {
    return 本轮战斗结算上下文 && typeof 本轮战斗结算上下文 === 'object' ? 本轮战斗结算上下文 : null;
  }

  function 本轮输入包含战斗结构化摘要(text = '') {
    return /<battle_structured_summary>[\s\S]*?<\/battle_structured_summary>/i.test(String(text || ''));
  }

  function 取本轮有效战斗结算上下文(userInput = '') {
    if (!本轮输入包含战斗结构化摘要(userInput)) {
      本轮战斗结算上下文 = null;
      return null;
    }
    return 读取战斗结算上下文();
  }

  function 构建战斗裁断任务文本() {
    const 上下文 = 取本轮有效战斗结算上下文(本轮输入文本);
    if (!上下文) return '无任务';
    return [
      '【战斗裁断任务】',
      '当前存在前端战斗模块提交的战斗结算卷宗。Runtime的最终快照和终局事实已经通过确定性JSONPatch提交；结构化战斗摘要中的绝对HP、资源、状态、召唤物、胜负条件、终局类型与失能原因均不可改写。你只负责原样复述卷宗裁断并为后续正文准备自然承接，不得重新判断胜负、重算HP或生成新的失能原因。',
      '',
      '<battle_adjudication_dossier>',
      上下文.裁断卷宗 || '无',
      '</battle_adjudication_dossier>',
    ].join('\n');
  }

  function 构建战斗裁断输出格式文本() {
    if (!取本轮有效战斗结算上下文(本轮输入文本)) return '';
    return [
      '若存在【战斗裁断任务】，必须在 <module_routing> 后追加：',
      '<battle_adjudication>',
      '{',
      '  "模块结算": {',
      '    "是否结束": false',
      '  },',
      '  "正文承接": "自然语言承接战斗过程与当前战局。必须写清关键攻防、普通攻击/防御/闪避/撤离/魂技选择及战局结果"',
      '}',
      '</battle_adjudication>',
      '',
      '若战斗结束，<battle_adjudication> 必须改为：',
      '<battle_adjudication>',
      '{',
      '  "模块结算": {',
      '    "是否结束": true,',
      '    "胜方": "参战者名称",',
      '    "败方": "参战者名称",',
      '    "败方剩余HP比例": 5,',
      '    "终局类型": "incapacitated",',
      '    "终局原因": "STAMINA_EXHAUSTED"',
      '  },',
      '  "正文承接": "自然语言承接战斗过程与当前战局。必须写清关键攻防、普通攻击/防御/闪避/撤离/魂技选择及战局结果"',
      '}',
      '</battle_adjudication>',
      '',
      '模块结算规则：终局类型只能填 death、incapacitated、hp_threshold、survived、withdrawal、time_limit；终局原因必须复制战斗结算卷宗中的结构化原因。death 时败方剩余HP比例必须为0；incapacitated 时必须大于0，且只表示失去战斗能力，不得写成死亡；time_limit 表示平局，胜方和败方都填“无”，HP比例填100；其余类型的胜方和败方必须是当前参战者名称且不能相同。',
    ].join('\n');
  }

  function 替换战斗裁断占位符(text = '') {
    return String(text || '')
      .replaceAll(战斗裁断任务占位符, 构建战斗裁断任务文本())
      .replaceAll(战斗裁断输出格式占位符, 构建战斗裁断输出格式文本());
  }

  function 深读对象(对象, 路径, 回退值 = undefined) {
    const 片段列表 = Array.isArray(路径) ? 路径 : String(路径 || '').split('.').filter(Boolean);
    let 当前值 = 对象;
    for (const 片段 of 片段列表) {
      if (当前值 === null || 当前值 === undefined) return 回退值;
      当前值 = 当前值[片段];
    }
    return 当前值 === undefined ? 回退值 : 当前值;
  }

  function 读取当前StatData() {
    if (本轮StatData && typeof 本轮StatData === 'object') return 本轮StatData;
    const mvu = 读取窗口字段('Mvu');
    if (mvu && typeof mvu.getMvuData === 'function') {
      try {
        const 数据 = mvu.getMvuData({ type: 'message', message_id: 'latest' });
        if (数据 && 数据.stat_data && typeof 数据.stat_data === 'object') return 数据.stat_data;
      } catch (_) {}
    }
    return null;
  }

  function 取玩家角色数据(statData = null) {
    const 数据 = statData && typeof statData === 'object' ? statData : 读取当前StatData();
    if (!数据 || typeof 数据 !== 'object') return null;
    const 玩家名 = String(数据?.sys?.玩家名 || '').trim();
    if (玩家名 && 数据?.char?.[玩家名] && typeof 数据.char[玩家名] === 'object') return 数据.char[玩家名];
    const 角色表 = 数据?.char && typeof 数据.char === 'object' ? 数据.char : {};
    return Object.values(角色表).find(角色 => 角色 && typeof 角色 === 'object' && 角色.__mvu_isPlayer === true) || null;
  }

  function 读取剧情当前地点(statData = null) {
    const 玩家 = 取玩家角色数据(statData);
    return String(玩家?.状态?.位置 || '未知').trim() || '未知';
  }

  function 读取剧情当前主身份(statData = null) {
    const 玩家 = 取玩家角色数据(statData);
    return String(玩家?.社交?.主身份 || '未知').trim() || '未知';
  }

  function 取魂灵塔大关信息(层数 = 1) {
    const 安全层数 = Math.max(1, Math.min(魂灵塔总层数, Math.floor(Number(层数) || 1)));
    const 规则 = 魂灵塔层规则.find(item => 安全层数 >= item.gateStart && 安全层数 <= item.gateEnd) || 魂灵塔层规则[魂灵塔层规则.length - 1];
    const 大关序号 = 魂灵塔层规则.findIndex(item => item === 规则) + 1;
    const 进度 = 规则.gateEnd > 规则.gateStart ? (安全层数 - 规则.gateStart) / (规则.gateEnd - 规则.gateStart) : 1;
    const 品质档 = 规则.qualitySteps[Math.min(规则.qualitySteps.length - 1, Math.floor(Math.max(0, Math.min(1, 进度)) * 规则.qualitySteps.length))] || 规则.qualitySteps[0] || 'C';
    const 年限 = 安全层数 === 规则.gateEnd
      ? 规则.maxAge
      : Math.max(规则.minAge, Math.min(规则.maxAge, Math.round(规则.minAge + (规则.maxAge - 规则.minAge) * 进度)));
    const 物种 = 魂灵塔标准物种[(安全层数 - 1) % 魂灵塔标准物种.length] || '龙类';
    return {
      层数: 安全层数,
      大关: 大关序号,
      标签: 规则.label,
      区间: `${规则.gateStart}-${规则.gateEnd}层`,
      最小年限: 规则.minAge,
      最大年限: 规则.maxAge,
      年限,
      品质: 品质档,
      标准物种: 物种,
      关底战: 安全层数 === 规则.gateEnd,
    };
  }

  function 构建魂灵塔待战系统消息(statData = null) {
    const 数据 = statData && typeof statData === 'object' ? statData : 读取当前StatData();
    if (!数据 || typeof 数据 !== 'object') return '';
    const 战斗 = 深读对象(数据, ['world', '战斗'], {});
    if (!战斗 || typeof 战斗 !== 'object') return '';
    if (战斗.进行中 === true) return '';
    const 试炼状态 = String(战斗.试炼状态 || '');
    const 匹配 = 试炼状态.match(/魂灵塔-第(\d+)层/);
    if (!匹配) return '';
    const 层数 = Math.max(1, Math.min(魂灵塔总层数, Math.floor(Number(战斗.floor || 匹配[1]) || 1)));
    const 信息 = 取魂灵塔大关信息(层数);
    return [
      '【魂灵塔待战信息】',
      `当前试炼：魂灵塔第${信息.层数}层（${信息.标签}，${信息.区间}）`,
      `守塔约束：标准物种=${信息.标准物种}；年限=${信息.年限}；品质=${信息.品质}；年限范围=${信息.最小年限}-${信息.最大年限}；${信息.关底战 ? '本层为关底战' : '本层为普通层'}。`,
      '推进2若判定进入战斗，必须在 battle 模块路由的参战者.team_enemy 中给出正式敌方名称；脚本只提供约束，不会用占位名当正式敌方。',
      '当前未进入战斗；战斗模块进行中时不要重复注入或重复触发 battle 路由。',
    ].join('\n');
  }

  function 构建MVU前置记录键(最新角色消息, 最新用户消息, 捕获文本) {
    const 聊天数组 = 读取聊天数组();
    return [
      String(读取酒馆上下文()?.chatId || 'current_chat').trim() || 'current_chat',
      String(聊天数组.length),
      String(最新用户消息?.消息编号 || ''),
      String(最新用户消息?.消息索引 ?? ''),
      String(最新用户消息?.滑动编号 ?? ''),
      String(最新角色消息?.消息编号 || ''),
      String(最新角色消息?.消息索引 ?? ''),
      String(最新角色消息?.滑动编号 ?? ''),
      取哈希(捕获文本 || ''),
    ].join('|');
  }

  function 读取性能时间() {
    try {
      if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
    } catch (_) {}
    return Date.now();
  }

  function 记录耗时(标签, 开始时间, 附加文本 = '') {
    try {
      const 耗时 = Math.round(读取性能时间() - Number(开始时间 || 0));
      console.debug(`[LWCS适配器] ${标签} ${耗时}ms${附加文本 ? ` ${附加文本}` : ''}`);
    } catch (_) {}
  }

  function 记录本轮MVU前置结果(键, 结果) {
    if (!键) return;
    const 命中角色 = Array.isArray(结果?.命中角色) ? Array.from(new Set(结果.命中角色.map(名称 => String(名称 || '').trim()).filter(Boolean))) : [];
    const 命中物品 = Array.isArray(结果?.命中物品) ? Array.from(new Set(结果.命中物品.map(名称 => String(名称 || '').trim()).filter(Boolean))) : [];
    const 命中动态地点 = Array.isArray(结果?.命中动态地点) ? Array.from(new Set(结果.命中动态地点.map(名称 => String(名称 || '').trim()).filter(Boolean))) : [];
    最近MVU前置记录键 = 键;
    本轮MVU前置记录表.set(键, {
      键,
      时间: Date.now(),
      目标消息编号: String(结果?.目标消息编号 || ''),
      目标消息索引: Number.isInteger(Number(结果?.目标消息索引)) ? Math.floor(Number(结果?.目标消息索引)) : -1,
      滑动编号: String(结果?.滑动编号 ?? ''),
      文本签名: String(结果?.文本签名 || ''),
      statData: 结果 && typeof 结果.statData === 'object' ? 克隆JSON值(结果.statData, {}) : null,
      命中角色,
      命中物品,
      命中动态地点,
    });
    while (本轮MVU前置记录表.size > 20) {
      const 首个键 = 本轮MVU前置记录表.keys().next().value;
      if (首个键 === undefined) break;
      本轮MVU前置记录表.delete(首个键);
    }
  }

  function 读取最近MVU前置记录() {
    const 记录 = 本轮MVU前置记录表.get(最近MVU前置记录键);
    if (!记录) return null;
    return {
      键: 记录.键,
      时间: 记录.时间,
      目标消息编号: 记录.目标消息编号,
      目标消息索引: 记录.目标消息索引,
      滑动编号: 记录.滑动编号,
      文本签名: 记录.文本签名,
      statData: 记录.statData && typeof 记录.statData === 'object' ? 克隆JSON值(记录.statData, {}) : null,
      命中角色: Array.isArray(记录.命中角色) ? [...记录.命中角色] : [],
      命中物品: Array.isArray(记录.命中物品) ? [...记录.命中物品] : [],
      命中动态地点: Array.isArray(记录.命中动态地点) ? [...记录.命中动态地点] : [],
    };
  }

  function 读取MVU运行时视图接口() {
    const 接口 = 读取窗口字段('__LWCS_MVU_RUNTIME_VIEW__');
    if (接口 && typeof 接口 === 'object') return 接口;
    return null;
  }

  function 缓存StatData(statData, userInput = '') {
    if (!statData || typeof statData !== 'object') return null;
    本轮StatData = statData;
    本轮输入文本 = String(userInput || '').trim();
    return statData;
  }

  function 读取开场MVU初始化事务(userInput = '') {
    const 开场事务 = 读取窗口字段('__LWCS_开场MVU初始化事务__');
    if (!开场事务 || typeof 开场事务 !== 'object') return null;
    const 当前输入 = String(userInput || '').trim();
    const 开场输入 = String(开场事务.开场输入 || '').trim();
    if (!当前输入 || !开场输入 || 当前输入 !== 开场输入) return null;
    return 开场事务;
  }

  async function 等待开场MVU初始化事务(userInput = '') {
    const 开场事务 = 读取开场MVU初始化事务(userInput);
    if (!开场事务) return null;
    if (开场事务.状态 === 'ready' && 开场事务.statData && typeof 开场事务.statData === 'object') return 开场事务.statData;
    if (开场事务.状态 === 'error') return null;
    if (开场事务.promise && typeof 开场事务.promise.then === 'function') {
      try {
        const statData = await Promise.race([
          开场事务.promise,
          new Promise(resolve => setTimeout(() => resolve(null), 6000)),
        ]);
        return statData && typeof statData === 'object' ? statData : null;
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  function 取StatData(statData = null, userInput = '') {
    if (statData && typeof statData === 'object') return 缓存StatData(statData, userInput);
    const 当前输入 = String(userInput || '').trim();
    if (本轮StatData && typeof 本轮StatData === 'object') {
      if (当前输入 && 本轮输入文本 && 当前输入 === 本轮输入文本) return 本轮StatData;
    }
    return null;
  }

  function 构建前置键(最新角色消息, 最新用户消息, 捕获文本, 附加文本 = '') {
    const 聊天数组 = 读取聊天数组();
    return [
      String(读取酒馆上下文()?.chatId || 'current_chat').trim() || 'current_chat',
      String(聊天数组.length),
      String(最新用户消息?.消息编号 || ''),
      String(最新用户消息?.消息索引 ?? ''),
      String(最新用户消息?.滑动编号 ?? ''),
      String(最新角色消息?.消息编号 || ''),
      String(最新角色消息?.消息索引 ?? ''),
      String(最新角色消息?.滑动编号 ?? ''),
      取哈希(捕获文本),
      取哈希(附加文本),
    ].join('|');
  }

  function 取本轮提示限流集合(选项 = {}) {
    if (选项.运行时提示已使用类型 instanceof Set) return 选项.运行时提示已使用类型;
    const 最新角色消息 = 选项?.latestCharMessageInfo && typeof 选项.latestCharMessageInfo === 'object' ? 选项.latestCharMessageInfo : 读取最新角色消息元信息();
    const 最新用户消息 = 读取最新用户消息元信息();
    const 捕获文本 = String(选项?.captureText ?? '').trim()
      ? 清理近场文本片段(选项.captureText)
      : 构建近场文本(选项.userInput || '', 选项.lastCharMessage || '');
    const 限流键 = 构建前置键(最新角色消息, 最新用户消息, 捕获文本);
    let 已使用类型 = 本轮提示限流表.get(限流键);
    if (!(已使用类型 instanceof Set)) {
      已使用类型 = new Set();
      本轮提示限流表.set(限流键, 已使用类型);
      while (本轮提示限流表.size > 20) {
        const 首个键 = 本轮提示限流表.keys().next().value;
        if (首个键 === undefined) break;
        本轮提示限流表.delete(首个键);
      }
    }
    return 已使用类型;
  }

  function 清理近场文本片段(文本 = '') {
    return 清理世界书扫描文本(文本)
      .replace(/<剧情审查>[\s\S]*?<\/剧情审查>/gi, ' ')
      .replace(/<module_routing>[\s\S]*?<\/module_routing>/gi, ' ')
      .replace(/<tabletop>[\s\S]*?<\/tabletop>/gi, ' ')
      .replace(/<\/?content>/gi, ' ')
      .trim();
  }

  function 构建近场文本(用户输入文本 = '', 最后角色消息文本 = '') {
    return [清理近场文本片段(用户输入文本), 清理近场文本片段(最后角色消息文本)].filter(Boolean).join('\n');
  }

  function 限制正则近场缓存表大小() {
    while (正则近场缓存表.size > 20) {
      const 首个键 = 正则近场缓存表.keys().next().value;
      if (首个键 === undefined) break;
      正则近场缓存表.delete(首个键);
    }
  }

  function 取正则近场缓存键(用户输入文本 = '', 最后角色消息文本 = '') {
    return `${取哈希(String(用户输入文本 || ''))}|${取哈希(String(最后角色消息文本 || ''))}`;
  }

  async function 读取正则引擎模块() {
    if (正则引擎缓存.模块) return 正则引擎缓存.模块;
    if (!正则引擎缓存.承诺) {
      正则引擎缓存.承诺 = import('/scripts/extensions/regex/engine.js')
        .then((模块) => {
          正则引擎缓存.模块 = 模块 && typeof 模块 === 'object' ? 模块 : null;
          return 正则引擎缓存.模块;
        })
        .catch((错误) => {
          console.warn('[LWCS适配器] 正则引擎加载失败:', 错误);
          return null;
        });
    }
    return await 正则引擎缓存.承诺;
  }

  async function 套用酒馆正则过滤(文本 = '', placement = '', options = {}) {
    const 源文本 = String(文本 || '');
    if (!源文本) return '';
    const 模块 = await 读取正则引擎模块();
    const getRegexedString = 模块?.getRegexedString;
    const regexPlacement = 模块?.regex_placement;
    if (typeof getRegexedString !== 'function' || !regexPlacement) return 源文本;
    const 位置 = placement === 'user' ? regexPlacement.USER_INPUT : regexPlacement.AI_OUTPUT;
    if (位置 === undefined || 位置 === null) return 源文本;
    try {
      const 正则选项 = { isPrompt: true };
      正则选项.depth = Number.isInteger(options?.depth) ? options.depth : 0;
      return String(getRegexedString(源文本, 位置, 正则选项) ?? 源文本);
    } catch (错误) {
      console.warn('[LWCS适配器] 正则过滤失败:', 错误);
      return 源文本;
    }
  }

  async function 生成过滤后近场上下文(用户输入文本 = '', 最后角色消息文本 = '') {
    const 缓存键 = 取正则近场缓存键(用户输入文本, 最后角色消息文本);
    const 已缓存 = 正则近场缓存表.get(缓存键);
    if (已缓存) return 克隆JSON值(已缓存, {});
    const [过滤后用户输入, 过滤后最后角色消息] = await Promise.all([
      套用酒馆正则过滤(用户输入文本, 'user', { depth: 0 }),
      套用酒馆正则过滤(最后角色消息文本, 'ai', { depth: 0 }),
    ]);
    const 结果 = {
      userInput: 清理近场文本片段(过滤后用户输入),
      lastCharMessage: 清理近场文本片段(过滤后最后角色消息),
    };
    结果.captureText = [结果.userInput, 结果.lastCharMessage].filter(Boolean).join('\n');
    正则近场缓存表.set(缓存键, 结果);
    限制正则近场缓存表大小();
    return 克隆JSON值(结果, {});
  }

  function 限制前置承诺表大小() {
    while (本轮前置承诺表.size > 20) {
      const 首个键 = 本轮前置承诺表.keys().next().value;
      if (首个键 === undefined) break;
      本轮前置承诺表.delete(首个键);
    }
  }

  async function 准备MVU前置数据(选项 = {}) {
    const 用户输入文本 = String(选项?.userInput || '');
    const 最后角色消息文本 = String(选项?.lastCharMessage || '');
    const 最新角色消息 = 选项?.latestCharMessageInfo && typeof 选项.latestCharMessageInfo === 'object' ? 选项.latestCharMessageInfo : 读取最新角色消息元信息();
    const 最新用户消息 = 读取最新用户消息元信息();
    const 近场文本 = String(选项?.captureText ?? '').trim()
      ? 清理近场文本片段(选项.captureText)
      : 构建近场文本(用户输入文本, 最后角色消息文本);
    if (!近场文本.trim()) return 选项?.statData && typeof 选项.statData === 'object' ? 选项.statData : null;
    const 前置键 = 构建前置键(最新角色消息, 最新用户消息, 近场文本);
    const 前置记录键 = 构建MVU前置记录键(最新角色消息, 最新用户消息, 近场文本);
    if (本轮前置承诺表.has(前置键)) return await 本轮前置承诺表.get(前置键);
    const 前置承诺 = (async () => {
      const 总开始时间 = 读取性能时间();
      let 当前StatData = 选项?.statData && typeof 选项.statData === 'object' ? 选项.statData : null;
      const 准备上下文 = 读取窗口函数('__LWCS_PREPARE_MVU_CONTEXT_FOR_PROMPT__');
      if (typeof 准备上下文 !== 'function') {
        记录耗时('正文生成前置:MVU统一前置缺失', 总开始时间);
        记录本轮MVU前置结果(前置记录键, {
          statData: 当前StatData,
          目标消息编号: 最新角色消息.消息编号,
          目标消息索引: 最新角色消息.消息索引,
          滑动编号: 最新角色消息.滑动编号,
          文本签名: 取哈希(近场文本 || ''),
          命中角色: [],
          命中物品: [],
          命中动态地点: [],
        });
        return 当前StatData || null;
      }
      const 参数 = {
        剧情文本: '',
        最后剧情文本: 清理近场文本片段(最后角色消息文本),
        statData: 当前StatData || undefined,
        消息索引: 最新角色消息.消息索引,
        消息编号: 最新角色消息.消息编号,
        上限: 16,
      };
      const 结果 = await Promise.resolve(准备上下文(近场文本, 参数));
      if (结果 && typeof 结果.statData === 'object') 当前StatData = 结果.statData;
      const 命中角色 = Array.isArray(结果?.命中角色) ? 结果.命中角色 : [];
      const 命中物品 = Array.isArray(结果?.命中物品) ? 结果.命中物品 : [];
      const 命中动态地点 = Array.isArray(结果?.命中动态地点) ? 结果.命中动态地点 : [];
      记录耗时(
        '正文生成前置:MVU统一前置',
        总开始时间,
        `changed=${结果?.changed === true} names=${Array.isArray(结果?.names) ? 结果.names.length : 0}`,
      );
      记录本轮MVU前置结果(前置记录键, {
        statData: 当前StatData,
        目标消息编号: 最新角色消息.消息编号,
        目标消息索引: 最新角色消息.消息索引,
        滑动编号: 最新角色消息.滑动编号,
        文本签名: 取哈希(近场文本 || ''),
        命中角色,
        命中物品,
        命中动态地点,
      });
      return 当前StatData || null;
    })();
    本轮前置承诺表.set(前置键, 前置承诺);
    限制前置承诺表大小();
    return await 前置承诺;
  }

  function 替换运行时占位符(content, viewType = 'empty', context = {}) {
    const 源文本 = String(content || '');
    if (
      !源文本.includes(MVU运行时视图占位符) &&
      !源文本.includes(MVU运行时更新占位符) &&
      !源文本.includes(MVU更新结构提示占位符) &&
      !源文本.includes(MVU相互可见性视图占位符) &&
      !源文本.includes(场景候选角色资料占位符) &&
      !源文本.includes(场景背景角色补充占位符) &&
      !源文本.includes(场景审计材料占位符) &&
      !源文本.includes(玩家角色表占位符) &&
      !源文本.includes(战斗裁断任务占位符) &&
      !源文本.includes(战斗裁断输出格式占位符)
    ) {
      return 源文本;
    }
    const 接口 = 读取MVU运行时视图接口();
    if (接口 && typeof 接口.替换MVU运行时视图占位符 === 'function') {
      try {
        const statData = 取StatData(context.statData, context.userInput || '');
        return 替换战斗裁断占位符(接口.替换MVU运行时视图占位符(源文本, viewType, {
          statData,
          userInput: context.userInput || '',
          lastCharMessage: context.lastCharMessage || '',
          plotText: context.plotText || '',
          场景线索种子文本: context.场景线索种子文本 || '',
          运行时提示已使用类型: 取本轮提示限流集合({
            ...context,
            viewType,
          }),
        }));
      } catch (错误) {
        console.warn('[LWCS适配器] MVU运行时占位符替换失败:', 错误);
      }
    }
    return 替换战斗裁断占位符(源文本
      .replaceAll(MVU运行时视图占位符, '')
      .replaceAll(MVU运行时更新占位符, '')
      .replaceAll(MVU更新结构提示占位符, '')
      .replaceAll(MVU相互可见性视图占位符, '')
      .replaceAll(场景背景角色补充占位符, '')
      .replaceAll(场景候选角色资料占位符, '')
      .replaceAll(场景审计材料占位符, '')
      .replaceAll(玩家角色表占位符, '')
      .replace(/<status_current_variables>\s*<\/status_current_variables>/gi, '')
      .trim());
  }

  function 读取剧情钩子时间线预览(userInput = '', statData = null) {
    const 接口 = 读取MVU运行时视图接口();
    if (!接口 || typeof 接口.生成MVU剧情视图 !== 'function') return '';
    try {
      const 剧情视图 = 接口.生成MVU剧情视图(取StatData(statData, userInput) || null, userInput);
      return String(剧情视图?.剧情钩子?._引导?.时间线预览 || '').trim();
    } catch (错误) {
      console.warn('[LWCS适配器] 时间线预览读取失败:', 错误);
      return '';
    }
  }

  function 读取远端原著时间线候选(userInput = '', statData = null, 近场文本 = '') {
    const 接口 = 读取MVU运行时视图接口();
    if (!接口 || typeof 接口.生成MVU剧情视图 !== 'function') return '';
    try {
      const 剧情视图 = 接口.生成MVU剧情视图(取StatData(statData, userInput) || null, 近场文本 || userInput);
      return String(剧情视图?.剧情钩子?._引导?.远端原著时间线候选 || '').trim();
    } catch (错误) {
      console.warn('[LWCS适配器] 远端原著时间线候选读取失败:', 错误);
      return '';
    }
  }

  function 读取角色基础六维对标(userInput = '', statData = null, 近场文本 = '') {
    const 接口 = 读取MVU运行时视图接口();
    if (!接口 || typeof 接口.生成角色基础六维对标摘要 !== 'function') return '无';
    try {
      return String(接口.生成角色基础六维对标摘要(取StatData(statData, userInput) || null, 近场文本 || userInput) || '').trim() || '无';
    } catch (错误) {
      console.warn('[LWCS适配器] 角色基础六维对标读取失败:', 错误);
      return '无';
    }
  }

  function 替换专属占位符(content, context = {}) {
    const 文本 = String(content || '');
    if (!文本.includes(时间线预览占位符)
      && !文本.includes(远端原著时间线候选占位符)
      && !文本.includes(角色基础六维对标占位符)
      && !文本.includes(剧情当前地点占位符)
      && !文本.includes(剧情当前主身份占位符)) return 文本;
    let 结果 = 文本;
    const userInput = String(context.userInput || '');
    const lastCharMessage = String(context.lastCharMessage || '');
    const statData = context.statData && typeof context.statData === 'object' ? context.statData : null;
    const 近场文本 = String(context.captureText || '').trim() || 构建近场文本(userInput, lastCharMessage);
    if (结果.includes(剧情当前地点占位符)) {
      结果 = 结果.replaceAll(剧情当前地点占位符, 读取剧情当前地点(statData));
    }
    if (结果.includes(剧情当前主身份占位符)) {
      结果 = 结果.replaceAll(剧情当前主身份占位符, 读取剧情当前主身份(statData));
    }
    if (结果.includes(时间线预览占位符)) {
      结果 = 结果.replaceAll(时间线预览占位符, 读取剧情钩子时间线预览(userInput, statData) || '无');
    }
    if (结果.includes(远端原著时间线候选占位符)) {
      结果 = 结果.replaceAll(远端原著时间线候选占位符, 读取远端原著时间线候选(userInput, statData, 近场文本) || '无远端原著时间线候选。');
    }
    if (结果.includes(角色基础六维对标占位符)) {
      结果 = 结果.replaceAll(角色基础六维对标占位符, 读取角色基础六维对标(userInput, statData, 近场文本));
    }
    return 结果;
  }

  async function 处理提示词运行时内容(内容, 上下文 = {}) {
    const 文本 = String(内容 || '');
    const 视图类型 = String(上下文.viewType || 'empty');
    const 用户输入文本 = String(上下文.userInput || '');
    const 最后角色消息文本 = String(上下文.lastCharMessage || '');
    const 近场上下文 = await 生成过滤后近场上下文(用户输入文本, 最后角色消息文本);
    const 基准StatData = 取StatData(上下文.statData, 用户输入文本);
    const 运行时StatData = await 准备MVU前置数据({
      userInput: 用户输入文本,
      lastCharMessage: 最后角色消息文本,
      latestCharMessageInfo: 上下文.latestCharMessageInfo,
      captureText: 近场上下文.captureText || '',
      plotText: 上下文.plotText || '',
      statData: 基准StatData || undefined,
    }) || 基准StatData || 上下文.statData;
    const 替换后内容 = 替换运行时占位符(文本, 视图类型, {
      statData: 运行时StatData,
      userInput: 用户输入文本,
      lastCharMessage: 最后角色消息文本,
      plotText: 上下文.plotText || '',
      captureText: 近场上下文.captureText || '',
      latestCharMessageInfo: 上下文.latestCharMessageInfo,
      场景线索种子文本: 上下文.场景线索种子文本 || '',
      运行时提示已使用类型: 取本轮提示限流集合({
        ...上下文,
        userInput: 用户输入文本,
        lastCharMessage: 最后角色消息文本,
        captureText: 近场上下文.captureText || '',
        viewType: 视图类型,
      }),
    });
    return 替换专属占位符(替换后内容, {
      userInput: 用户输入文本,
      lastCharMessage: 最后角色消息文本,
      statData: 运行时StatData,
      captureText: 近场上下文.captureText || '',
    });
  }

  async function 准备正文运行时数据(context = {}) {
    const 原始输入 = String(context.userInput || '');
    const 最后角色消息文本 = String(context.lastCharMessage || 读取最新角色消息元信息().文本 || '');
    const 近场上下文 = await 生成过滤后近场上下文(原始输入, 最后角色消息文本);
    const 开场StatData = await 等待开场MVU初始化事务(原始输入);
    const 模块StagingStatData = 读取剧情模块StagingStatData(context);
    return await 准备MVU前置数据({
      userInput: 原始输入,
      lastCharMessage: 最后角色消息文本,
      captureText: 近场上下文.captureText || '',
      plotText: '',
      statData: 模块StagingStatData || 取StatData(context.statData, 原始输入) || 开场StatData || undefined,
    });
  }

  async function 准备提示词运行时数据(context = {}) {
    const 用户输入文本 = String(context.userInput || '');
    const 最后角色消息文本 = String(context.lastCharMessage || '');
    const 近场上下文 = await 生成过滤后近场上下文(用户输入文本, 最后角色消息文本);
    const 开场StatData = await 等待开场MVU初始化事务(用户输入文本);
    return await 准备MVU前置数据({
      userInput: 用户输入文本,
      lastCharMessage: 最后角色消息文本,
      latestCharMessageInfo: context.latestCharMessageInfo,
      captureText: 近场上下文.captureText || '',
      plotText: '',
      statData: 取StatData(context.statData, context.userInput || '') || 开场StatData || undefined,
    });
  }

  function 构建正文时间线预览(userInput = '', statData = null) {
    const 预览 = 读取剧情钩子时间线预览(userInput, statData);
    if (!预览 || 预览 === '无') return '';
    return [
      '【正文时间线预览】',
      '以下只作为原著参照与节奏压力；不得因为tick临近就强行落地，必须服从当前地点、人物认知、关系状态和事件后果。',
      预览,
    ].join('\n');
  }

  function 追加正文注入(options, context = {}) {
    if (!options || typeof options !== 'object') return false;
    const userInput = String(context.userInput || '');
    const statData = context.statData && typeof context.statData === 'object' ? context.statData : null;
    const 注入片段 = [构建正文时间线预览(userInput, statData)].filter(Boolean);
    if (!注入片段.length) return false;
    const 注入列表 = Array.isArray(options.injects) ? options.injects : [];
    options.injects = 注入列表;
    let 是否追加 = false;
    for (const 文本 of 注入片段) {
      const 标题 = '【正文时间线预览】';
      if (注入列表.some(item => String(item?.content || '').includes(标题))) continue;
      注入列表.push({ position: 'in_chat', depth: 0, role: 'system', content: 文本, should_scan: false, _qrf_scope: 'story' });
      是否追加 = true;
    }
    return 是否追加;
  }

  function 构建剧情推进临时系统消息(options = {}) {
    const 输出 = [];
    const 魂灵塔待战消息 = 构建魂灵塔待战系统消息(options?.statData);
    if (魂灵塔待战消息) 输出.push({ role: 'system', content: 魂灵塔待战消息 });
    return 输出;
  }

  function 提取模块路由块(规划文本) {
    const 匹配 = String(规划文本 || '').match(/<module_routing>\s*([\s\S]*?)\s*<\/module_routing>/i);
    return 匹配 ? String(匹配[1] || '').trim() : '';
  }

  function 模块路由块命中战斗(路由块 = '') {
    return /(?:^|\n)\s*模块\s*[：:]\s*battle\s*(?:\n|$)/i.test(String(路由块 || ''));
  }

  function 提取战斗裁断块(规划文本) {
    const 匹配 = String(规划文本 || '').match(/<battle_adjudication>\s*([\s\S]*?)\s*<\/battle_adjudication>/i);
    return 匹配 ? String(匹配[1] || '').trim() : '';
  }

  function 清理模块路由事件文本(文本 = '') {
    return String(文本 || '')
      .replace(/<\s*module_routing\s*>[\s\S]*?<\s*\/\s*module_routing\s*>/gi, '[模块路由已执行]')
      .replace(/<\s*JSONPatch\b[\s\S]*?<\s*\/\s*JSONPatch\s*>/gi, '[结构化写入已省略]')
      .replace(/<\s*UpdateVariable\b[\s\S]*?<\s*\/\s*UpdateVariable\s*>/gi, '[变量写入已省略]')
      .trim();
  }

  function 构建模块路由运行事件(结果 = {}) {
    const 直接事件 = 清理模块路由事件文本(结果?.runtimeEvent || '');
    if (直接事件) return 直接事件;
    const 模块 = String(结果?.kind || '').trim() || 'unknown';
    if (模块 === '未命中') return '';
    const 模式 = String(结果?.dispatchMode || '').trim() || (结果?.handled === true ? 'settled_summary' : 'failed_summary');
    const 状态 =
      模式 === 'pending_confirmation' || /opened_.*panel/.test(模式) ? '待确认'
        : 模式 === 'failed_summary' || 结果?.handled === false ? '执行失败'
          : /battle_takeover|battle_continuation/.test(模式) ? '实时接管'
            : '已处理';
    const 原因 = String(结果?.reason || '').trim();
    const 事实 = 原因 ? `模块路由${状态}，原因：${原因}。` : `模块路由${状态}。`;
    return `<module_routing_result>\n模块：${模块}\n状态：${状态}\n事实：${事实}\n</module_routing_result>`;
  }

  function 构建战斗裁断运行事件(结果 = {}) {
    const 直接事件 = String(结果?.runtimeEvent || '').trim();
    if (直接事件) return 直接事件;
    if (结果?.handled !== true) return '';
    const 状态 = 结果?.finished === true ? '已结束' : '未结束';
    const 摘要 = String(结果?.summary || '').trim() || `战斗裁断${状态}。`;
    return `<battle_adjudication_result>\n状态：${状态}\n事实：${摘要}\n约束：后续剧情只承接该裁断结果，不要重复输出 <battle_adjudication>，不要重复结算同一场战斗。\n</battle_adjudication_result>`;
  }

  function 限制模块路由接管表大小() {
    while (本轮模块路由接管表.size > 20) {
      const 首个键 = 本轮模块路由接管表.keys().next().value;
      if (首个键 === undefined) break;
      本轮模块路由接管表.delete(首个键);
    }
  }

  function 模块路由结果应放行(结果) {
    const 模块 = String(结果?.kind || '').trim();
    const 模式 = String(结果?.dispatchMode || '').trim();
    const 原因 = String(结果?.reason || '').trim();
    if (模块 === '未命中' || 原因 === 'no_special_module_hit') return true;
    if (模式 === 'failed_summary' || 模式 === 'pending_confirmation' || 模式 === 'patch' || 模式 === 'inline' || 模式 === 'settled_summary') return true;
    if (/opened_.*panel/.test(模式)) return true;
    if (模块 !== 'battle') return true;
    if (原因 === 'battle_free_narrative' || 模式 === 'battle_auto_arbitration') return true;
    return false;
  }

  function 构建剧情模块路由事务上下文(context = {}, 路由块 = '') {
    const 最新角色消息 = 读取最新角色消息元信息();
    const 最新用户消息 = 读取最新用户消息元信息();
    const 用户输入文本 = String(context.originalUserInput || context.userInput || 最新用户消息.文本 || '').trim();
    return {
      source: 'story_generation_guard',
      userInput: 用户输入文本,
      用户输入文本,
      routeHash: 取哈希(路由块),
      路由块哈希: 取哈希(路由块),
      planningHash: 取哈希(context.planningText || ''),
      规划文本哈希: 取哈希(context.planningText || ''),
      latestUserMessageInfo: 最新用户消息,
      latestAiMessageInfo: 最新角色消息,
    };
  }

  async function 尝试接管模块路由(规划文本, context = {}) {
    const 文本 = String(规划文本 || '');
    const 路由块 = 提取模块路由块(文本);
    if (!路由块) return { action: 'continue', reason: 'module_route_missing' };
    if (模块路由块命中战斗(路由块) && 取本轮有效战斗结算上下文(本轮输入文本)) {
      return {
        action: 'continueWithRuntimeEvent',
        reason: 'battle_summary_route_skipped',
        result: {
          handled: true,
          kind: 'battle',
          dispatchMode: 'settled_summary',
          reason: 'battle_summary_route_skipped',
        },
        runtimeEvent: '<module_routing_result>\n模块：battle\n状态：已跳过\n事实：本轮用户输入已经包含结构化战斗摘要，battle 模块路由只作为结算承接上下文，不再重复接管或截断正文。\n</module_routing_result>',
      };
    }
    const 路由函数 = 读取窗口函数('__MVU_ROUTE_MODULE_INTENT__');
    if (typeof 路由函数 !== 'function') return { action: 'continue', reason: 'module_route_bridge_unavailable' };
    const 接管键 = 取哈希(`${context.originalUserInput || context.userInput || ''}\n${路由块}`);
    if (本轮模块路由接管表.has(接管键)) return await 本轮模块路由接管表.get(接管键);
    const 接管承诺 = (async () => {
      let 结果 = null;
      try {
        结果 = await Promise.resolve(路由函数(文本, 构建剧情模块路由事务上下文({ ...context, planningText: 文本 }, 路由块)));
      } catch (错误) {
        console.warn('[LWCS适配器] 模块路由接管失败，放行正文生成:', 错误);
        return { action: 'continue', reason: 'module_route_failed' };
      }
      if (!结果 || 结果.handled !== true) {
        if (结果 && 结果.reason) console.warn('[LWCS适配器] 模块路由未接管，放行正文生成:', 结果.reason);
        const runtimeEvent = 构建模块路由运行事件(结果 || {});
        if (runtimeEvent) {
          return {
            action: 'continueWithRuntimeEvent',
            reason: String(结果?.reason || 'module_route_not_handled'),
            result: 结果,
            runtimeEvent,
          };
        }
        return { action: 'continue', reason: String(结果?.reason || 'module_route_not_handled') };
      }
      if (模块路由结果应放行(结果)) {
        const runtimeEvent = 构建模块路由运行事件(结果);
        return runtimeEvent
          ? { action: 'continueWithRuntimeEvent', reason: String(结果.reason || 'module_route_settled'), result: 结果, runtimeEvent }
          : { action: 'continue', reason: String(结果.reason || 'module_route_skipped') };
      }
      return { action: 'blocked', reason: 'module_route_handled', result: 结果 };
    })();
    本轮模块路由接管表.set(接管键, 接管承诺);
    限制模块路由接管表大小();
    return await 接管承诺;
  }

  async function 尝试接管战斗裁断(规划文本, context = {}) {
    const 文本 = String(规划文本 || '');
    const 裁断块 = 提取战斗裁断块(文本);
    if (!裁断块) return { action: 'continue', reason: 'battle_adjudication_missing' };
    const 裁断函数 = 读取窗口函数('__LWCS_APPLY_BATTLE_ADJUDICATION__');
    if (typeof 裁断函数 !== 'function') return { action: 'continue', reason: 'battle_adjudication_bridge_unavailable' };
    const 接管键 = 取哈希(`${context.originalUserInput || context.userInput || ''}\n${裁断块}`);
    if (本轮战斗裁断接管表.has(接管键)) return await 本轮战斗裁断接管表.get(接管键);
    const 接管承诺 = (async () => {
      let 结果 = null;
      try {
        结果 = await Promise.resolve(裁断函数(
          `<battle_adjudication>${裁断块}</battle_adjudication>`,
          构建剧情模块路由事务上下文({ ...context, planningText: 文本 }, 裁断块),
        ));
      } catch (错误) {
        console.warn('[LWCS适配器] 战斗裁断接管失败，放行正文生成:', 错误);
        return { action: 'continue', reason: 'battle_adjudication_failed' };
      }
      const runtimeEvent = 构建战斗裁断运行事件(结果 || {});
      return runtimeEvent
        ? { action: 'continueWithRuntimeEvent', reason: String(结果?.reason || 'battle_adjudication_settled'), result: 结果, runtimeEvent }
        : { action: 'continue', reason: String(结果?.reason || 'battle_adjudication_skipped'), result: 结果 };
    })();
    本轮战斗裁断接管表.set(接管键, 接管承诺);
    return await 接管承诺;
  }

  async function 正文生成前确认(context = {}) {
    const 战斗裁断决定 = await 尝试接管战斗裁断(context.planningText || '', context);
    if (战斗裁断决定.action === 'continueWithRuntimeEvent') return 战斗裁断决定;
    const 模块路由决定 = await 尝试接管模块路由(context.planningText || '', context);
    if (模块路由决定.action === 'blocked') return 模块路由决定;
    if (模块路由决定.action === 'continueWithRuntimeEvent') return 模块路由决定;
    return 模块路由决定;
  }

  function 是否运行时占位符名(tagName) {
    return [
      'MVU_RUNTIME_VIEW',
      'MVU_RUNTIME_UPDATE',
      'MVU_UPDATE_STRUCTURE_HINTS',
      'MVU_MUTUAL_VISIBILITY_VIEW',
      '剧情钩子._引导.时间线预览',
      '剧情钩子._引导.远端原著时间线候选',
      '角色基础六维对标',
      '剧情当前地点',
      '剧情当前主身份',
      '场景背景角色补充',
      '场景候选角色资料',
      '场景审计材料',
      '玩家角色表',
      '战斗裁断任务',
      '战斗裁断输出格式',
    ].includes(String(tagName || '').trim());
  }

  function 文本需要运行时处理(text = '') {
    const 文本 = String(text || '');
    return 文本.includes(MVU运行时视图占位符)
      || 文本.includes(MVU运行时更新占位符)
      || 文本.includes(MVU更新结构提示占位符)
      || 文本.includes(MVU相互可见性视图占位符)
      || 文本.includes(时间线预览占位符)
      || 文本.includes(远端原著时间线候选占位符)
      || 文本.includes(角色基础六维对标占位符)
      || 文本.includes(剧情当前地点占位符)
      || 文本.includes(剧情当前主身份占位符)
      || 文本.includes(场景背景角色补充占位符)
      || 文本.includes(场景候选角色资料占位符)
      || 文本.includes(场景审计材料占位符)
      || 文本.includes(玩家角色表占位符)
      || 文本.includes(战斗裁断任务占位符)
      || 文本.includes(战斗裁断输出格式占位符);
  }

  function 清理世界书扫描文本(value) {
    return String(value || '')
      .replace(/<status_current_variables>[\s\S]*?<\/status_current_variables>/gi, ' ')
      .replace(/<scene_audit>[\s\S]*?<\/scene_audit>/gi, ' ')
      .replace(/<MVU剧情视图>[\s\S]*?<\/MVU剧情视图>/gi, ' ')
      .replace(/<相互可见性>[\s\S]*?<\/相互可见性>/gi, ' ')
      .replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/gi, ' ')
      .replace(/<JSONPatch>[\s\S]*?<\/JSONPatch>/gi, ' ')
      .replace(/<Analysis>[\s\S]*?<\/Analysis>/gi, ' ')
      .replace(/<battle_adjudication>[\s\S]*?<\/battle_adjudication>/gi, ' ')
      .replace(/\{\{MVU_RUNTIME_VIEW\}\}/g, ' ')
      .replace(/\{\{MVU_RUNTIME_UPDATE\}\}/g, ' ')
      .replace(/\{\{MVU_UPDATE_STRUCTURE_HINTS\}\}/g, ' ')
      .replace(/\{\{MVU_MUTUAL_VISIBILITY_VIEW\}\}/g, ' ')
      .replace(/\{\{剧情当前地点\}\}/g, ' ')
      .replace(/\{\{剧情当前主身份\}\}/g, ' ')
      .replace(/\{\{场景背景角色补充\}\}/g, ' ')
      .replace(/\{\{场景候选角色资料\}\}/g, ' ')
      .replace(/\{\{场景审计材料\}\}/g, ' ')
      .replace(/\{\{战斗裁断任务\}\}/g, ' ')
      .replace(/\{\{战斗裁断输出格式\}\}/g, ' ');
  }

  const 适配器 = {
    版本: 适配器版本,
    isRuntimePlaceholderName: 是否运行时占位符名,
    needsRuntimeProcessing: 文本需要运行时处理,
    processPromptRuntimeContent: 处理提示词运行时内容,
    replaceRuntimePlaceholders: 替换运行时占位符,
    replaceSpecialPlaceholders: 替换专属占位符,
    prepareStoryRuntimeData: 准备正文运行时数据,
    preparePromptRuntimeData: 准备提示词运行时数据,
    读取最近MVU前置记录,
    appendStoryRuntimeInjects: 追加正文注入,
    buildPlanningRuntimeSystemMessages: 构建剧情推进临时系统消息,
    confirmBeforeStoryGeneration: 正文生成前确认,
    registerBattleSettlementContext: 登记战斗结算上下文,
    stripRuntimeBlocksForWorldbookScan: 清理世界书扫描文本,
  };

  for (const 当前窗口 of 收集窗口()) {
    try {
      当前窗口[通用适配器键] = 适配器;
      当前窗口[专属适配器键] = 适配器;
      当前窗口.__LWCS_REGISTER_BATTLE_SETTLEMENT_CONTEXT__ = 登记战斗结算上下文;
    } catch (_) {}
  }
})();

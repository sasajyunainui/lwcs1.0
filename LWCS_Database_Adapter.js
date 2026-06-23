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
  const 本轮前置承诺表 = new Map();
  const 本轮模块路由接管表 = new Map();
  const 本轮MVU前置记录表 = new Map();
  const 正则引擎缓存 = { 模块: null, 承诺: null };
  const 正则近场缓存表 = new Map();
  let 最近MVU前置记录键 = '';
  let 本轮StatData = null;
  let 本轮输入文本 = '';

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

  function 清理近场文本片段(文本 = '') {
    return 清理世界书扫描文本(文本)
      .replace(/<剧情审查>[\s\S]*?<\/剧情审查>/gi, ' ')
      .replace(/<模块路由>[\s\S]*?<\/模块路由>/gi, ' ')
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
      !源文本.includes(MVU相互可见性视图占位符)
    ) {
      return 源文本;
    }
    const 接口 = 读取MVU运行时视图接口();
    if (接口 && typeof 接口.替换MVU运行时视图占位符 === 'function') {
      try {
        const statData = 取StatData(context.statData, context.userInput || '');
        return 接口.替换MVU运行时视图占位符(源文本, viewType, {
          statData,
          userInput: context.userInput || '',
          lastCharMessage: context.lastCharMessage || '',
          plotText: context.plotText || '',
        });
      } catch (错误) {
        console.warn('[LWCS适配器] MVU运行时占位符替换失败:', 错误);
      }
    }
    return 源文本
      .replaceAll(MVU运行时视图占位符, '')
      .replaceAll(MVU运行时更新占位符, '')
      .replaceAll(MVU更新结构提示占位符, '')
      .replaceAll(MVU相互可见性视图占位符, '')
      .replace(/<status_current_variables>\s*<\/status_current_variables>/gi, '')
      .trim();
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
    if (!文本.includes(时间线预览占位符) && !文本.includes(远端原著时间线候选占位符) && !文本.includes(角色基础六维对标占位符)) return 文本;
    let 结果 = 文本;
    const userInput = String(context.userInput || '');
    const lastCharMessage = String(context.lastCharMessage || '');
    const statData = context.statData && typeof context.statData === 'object' ? context.statData : null;
    const 近场文本 = String(context.captureText || '').trim() || 构建近场文本(userInput, lastCharMessage);
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
    return await 准备MVU前置数据({
      userInput: 原始输入,
      lastCharMessage: 最后角色消息文本,
      captureText: 近场上下文.captureText || '',
      plotText: '',
      statData: 取StatData(context.statData, 原始输入) || 开场StatData || undefined,
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
      注入列表.push({ position: 'in_chat', depth: 0, role: 'system', content: 文本, should_scan: false });
      是否追加 = true;
    }
    return 是否追加;
  }

  function 注册正文一次性注入(context = {}) {
    const 助手 = window.TavernHelper || 读取窗口字段('TavernHelper');
    if (!助手 || typeof 助手.injectPrompts !== 'function') return false;
    const userInput = String(context.userInput || '');
    const statData = context.statData && typeof context.statData === 'object' ? context.statData : null;
    const 注入片段 = [构建正文时间线预览(userInput, statData)].filter(Boolean);
    let 是否注册 = false;
    for (const 文本 of 注入片段) {
      const 注入编号 = `lwcs-runtime-${取哈希(文本)}`;
      try { 助手.uninjectPrompts?.([注入编号]); } catch (_) {}
      助手.injectPrompts([{ id: 注入编号, position: 'in_chat', depth: 0, role: 'system', content: 文本, should_scan: false }], { once: true });
      是否注册 = true;
    }
    return 是否注册;
  }

  function 构建剧情推进临时系统消息(options = {}) {
    const 注入列表 = Array.isArray(options?.injects) ? options.injects : [];
    const 命中项 = [...注入列表].reverse().find((item) => {
      const role = String(item?.role || '').trim().toLowerCase();
      const content = String(item?.content || '');
      return role === 'system' && (content.includes('<moduleSettlement>') || content.includes('[battle_arbitration]'));
    });
    return 命中项 ? [{ role: 'system', content: String(命中项.content || '').trim() }] : [];
  }

  function 检测剧情获得技能(规划文本) {
    const 文本 = String(规划文本 || '').trim();
    if (!文本 || /<module_intent\b/i.test(文本)) return null;
    const 获得技能模式 = /(获得|领悟|习得|学会|掌握|觉醒|创出|自创|解锁|凝聚|生成|衍生|得到|参悟出).{0,24}(魂技|技能|绝学|功法|秘技|血脉技|融合技|被动)/;
    const 技能名词模式 = /(新魂技|新技能|自创魂技|魂环技能|血脉技能|功法绝学|武魂融合技)/;
    if (!获得技能模式.test(文本) && !技能名词模式.test(文本)) return null;
    const 名称匹配 = 文本.match(/[【「《]([^】」》]{2,24})(?:】|」|》)/);
    return {
      label: 名称匹配 ? 名称匹配[1] : '剧情新技能',
      sourceLabel: '剧情获得技能',
    };
  }

  function 提取模块路由块(规划文本) {
    const 匹配 = String(规划文本 || '').match(/<模块路由>\s*([\s\S]*?)\s*<\/模块路由>/i);
    return 匹配 ? String(匹配[1] || '').trim() : '';
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
    if (模块 !== 'battle') return true;
    if (原因 === 'battle_free_narrative' || 模式 === 'battle_auto_arbitration') return true;
    return false;
  }

  async function 尝试接管模块路由(规划文本) {
    const 文本 = String(规划文本 || '');
    const 路由块 = 提取模块路由块(文本);
    if (!路由块) return { action: 'continue', reason: 'module_route_missing' };
    const 路由函数 = 读取窗口函数('__MVU_ROUTE_MODULE_INTENT__');
    if (typeof 路由函数 !== 'function') return { action: 'continue', reason: 'module_route_bridge_unavailable' };
    const 接管键 = 取哈希(文本);
    if (本轮模块路由接管表.has(接管键)) return await 本轮模块路由接管表.get(接管键);
    const 接管承诺 = (async () => {
      let 结果 = null;
      try {
        结果 = await Promise.resolve(路由函数(文本, { source: 'story_generation_guard' }));
      } catch (错误) {
        console.warn('[LWCS适配器] 模块路由接管失败，放行正文生成:', 错误);
        return { action: 'continue', reason: 'module_route_failed' };
      }
      if (!结果 || 结果.handled !== true) {
        if (结果 && 结果.reason) console.warn('[LWCS适配器] 模块路由未接管，放行正文生成:', 结果.reason);
        return { action: 'continue', reason: String(结果?.reason || 'module_route_not_handled') };
      }
      if (模块路由结果应放行(结果)) return { action: 'continue', reason: String(结果.reason || 'module_route_skipped') };
      return { action: 'blocked', reason: 'module_route_handled', result: 结果 };
    })();
    本轮模块路由接管表.set(接管键, 接管承诺);
    限制模块路由接管表大小();
    return await 接管承诺;
  }

  async function 正文生成前确认(context = {}) {
    const 模块路由决定 = await 尝试接管模块路由(context.planningText || '');
    if (模块路由决定.action === 'blocked') return 模块路由决定;
    const 检测结果 = 检测剧情获得技能(context.planningText || '');
    if (!检测结果) return { action: 'continue' };
    const 打开技能设计 = 读取窗口函数('__LWCS_PROMPT_SKILL_DESIGN__');
    if (typeof 打开技能设计 !== 'function') return { action: 'continue', reason: 'skill_design_bridge_unavailable' };
    const 需要自行设计 = typeof window.confirm === 'function'
      ? window.confirm(`本轮剧情预计会获得【${检测结果.label}】。是否自行设计？`)
      : false;
    if (!需要自行设计) return { action: 'continue' };
    const 结果 = await 打开技能设计(检测结果);
    return 结果 && 结果.ok
      ? { action: 'blocked', reason: 'skill_design_requested' }
      : { action: 'continue', reason: 'skill_design_open_failed' };
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
      || 文本.includes(角色基础六维对标占位符);
  }

  function 清理世界书扫描文本(value) {
    return String(value || '')
      .replace(/<status_current_variables>[\s\S]*?<\/status_current_variables>/gi, ' ')
      .replace(/<MVU剧情视图>[\s\S]*?<\/MVU剧情视图>/gi, ' ')
      .replace(/<相互可见性>[\s\S]*?<\/相互可见性>/gi, ' ')
      .replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/gi, ' ')
      .replace(/<JSONPatch>[\s\S]*?<\/JSONPatch>/gi, ' ')
      .replace(/<Analysis>[\s\S]*?<\/Analysis>/gi, ' ')
      .replace(/\{\{MVU_RUNTIME_VIEW\}\}/g, ' ')
      .replace(/\{\{MVU_RUNTIME_UPDATE\}\}/g, ' ')
      .replace(/\{\{MVU_UPDATE_STRUCTURE_HINTS\}\}/g, ' ')
      .replace(/\{\{MVU_MUTUAL_VISIBILITY_VIEW\}\}/g, ' ');
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
    registerStoryRuntimeInjects: 注册正文一次性注入,
    buildPlanningRuntimeSystemMessages: 构建剧情推进临时系统消息,
    confirmBeforeStoryGeneration: 正文生成前确认,
    stripRuntimeBlocksForWorldbookScan: 清理世界书扫描文本,
  };

  for (const 当前窗口 of 收集窗口()) {
    try {
      当前窗口[通用适配器键] = 适配器;
      当前窗口[专属适配器键] = 适配器;
    } catch (_) {}
  }
})();

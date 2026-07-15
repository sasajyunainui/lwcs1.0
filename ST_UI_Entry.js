!(function () {
  'use strict';

  const 加载器键 = 'mvu_external_ui_vue_loader';
  const 宿主窗口 = (() => {
    try {
      if (window.parent && window.parent !== window && window.parent.document) return window.parent;
    } catch (错误) {}
    return window;
  })();
  const 宿主文档 = 宿主窗口.document;

  const 调试热更新模式 = !!宿主窗口[加载器键];
  宿主窗口[加载器键] = true;

  const 默认资源基础地址 = 'https://testingcf.jsdelivr.net/gh/sasajyunainui/lwcs1.0@c661966/';
  const 资源基础地址 = (() => {
    const 覆盖地址 = String(宿主窗口.__LWCS_资源基础地址__ || window.__LWCS_资源基础地址__ || '').trim();
    if (!覆盖地址) return 默认资源基础地址;
    return 覆盖地址.endsWith('/') ? 覆盖地址 : `${覆盖地址}/`;
  })();
  const 资源基础地址候选列表 = (() => {
    const 候选原值 = 宿主窗口.__LWCS_资源基础地址候选列表__ || window.__LWCS_资源基础地址候选列表__;
    const 候选列表 = Array.isArray(候选原值) ? 候选原值 : [];
    const 清理地址 = 地址 => {
      const 文本 = String(地址 || '').trim();
      if (!文本) return '';
      return 文本.endsWith('/') ? 文本 : `${文本}/`;
    };
    return [资源基础地址, ...候选列表.map(清理地址)].filter((地址, 序号, 列表) => 地址 && 列表.indexOf(地址) === 序号);
  })();
  const 资源版本后缀 = '';
  const Vue远程地址 = 'https://unpkg.com/vue@3.5.13/dist/vue.global.prod.js';
  const 资源请求超时毫秒 = 6500;
  const 远程脚本超时毫秒 = 8000;
  const 首次重试延迟毫秒 = 260;
  const 二次重试延迟毫秒 = 560;

  const 模块注册表 = {
    样式核心: { 类型: 'css', 地址: 资源基础地址 + 'mvu_styles.css' + 资源版本后缀, 关键: true, 分组: 'core' },
    魂环引擎样式: { 类型: 'css', 地址: 资源基础地址 + 'soul_ring_engine.css' + 资源版本后缀, 关键: true, 分组: 'core' },
    Vue核心: { 类型: 'remote-js', 地址: Vue远程地址, 关键: true, 分组: 'core' },
    壳层运行时: { 类型: 'inline-js', 地址: 资源基础地址 + 'Main_Vue_runtimefix_v2.js' + 资源版本后缀, 关键: true, 分组: 'core' },
    内置角色库: { 类型: 'inline-js', 地址: 资源基础地址 + 'CharacterLibrary.js' + 资源版本后缀, 关键: true, 分组: 'core' },
    内置物品库: { 类型: 'inline-js', 地址: 资源基础地址 + 'ItemLibrary.js' + 资源版本后缀, 关键: true, 分组: 'core' },
    魂技机制注册表: { 类型: 'wait-global', 全局键: '__LWCS_SKILL_MECHANISM_REGISTRY__', 值类型: 'object', 关键: true, 分组: 'core' },
    变量运行时视图: { 类型: 'wait-global', 全局键: '__LWCS_MVU_RUNTIME_VIEW__', 值类型: 'object', 关键: true, 分组: 'core' },
    变量规范化接口: { 类型: 'wait-global', 全局键: '__LWCS_NORMALIZE_MVU_STAT_DATA__', 值类型: 'function', 关键: true, 分组: 'core' },
    副职业派生接口: { 类型: 'wait-global', 全局键: '__LWCS_PROFESSION_DERIVATION__', 值类型: 'object', 关键: true, 分组: 'core' },
    技能结构编译接口: { 类型: 'wait-global', 全局键: '__LWCS_COMPILE_SKILL_STRUCTURE_TEXT__', 值类型: 'function', 关键: true, 分组: 'core' },
    技能消耗助手: { 类型: 'wait-global', 全局键: '__LWCS_SKILL_COST_HELPERS_V1__', 值类型: 'object', 关键: true, 分组: 'core' },
    直接结算预算接口: { 类型: 'wait-global', 全局键: '__LWCS_CALC_DIRECT_SETTLE_BUDGET__', 值类型: 'function', 关键: true, 分组: 'core' },
    直接结算预算断言: { 类型: 'wait-global', 全局键: '__LWCS_ASSERT_DIRECT_SETTLE_BUDGET__', 值类型: 'function', 关键: true, 分组: 'core' },
    基础属性接口: { 类型: 'wait-global', 全局键: '__LWCS_GET_BASE_STATS__', 值类型: 'function', 关键: true, 分组: 'core' },
    装备属性加成接口: { 类型: 'wait-global', 全局键: '__LWCS_CALC_ACTIVE_EQUIPMENT_BONUS__', 值类型: 'function', 关键: true, 分组: 'core' },
    JSONPatch规范化接口: { 类型: 'wait-global', 全局键: '__LWCS_NORMALIZE_JSON_PATCH_OPS__', 值类型: 'function', 关键: true, 分组: 'core' },
    JSONPatch文本预处理接口: { 类型: 'wait-global', 全局键: '__LWCS_PREPROCESS_JSON_PATCH_TEXT__', 值类型: 'function', 关键: true, 分组: 'core' },
    逻辑桥接: { 类型: 'inline-js', 地址: 资源基础地址 + 'mvu_logic_bridge.js' + 资源版本后缀, 关键: true, 分组: 'core' },
    数据库适配器: { 类型: 'inline-js', 地址: 资源基础地址 + 'LWCS_Database_Adapter.js' + 资源版本后缀, 关键: true, 分组: 'core' },
    请求监控挂件: { 类型: 'inline-js', 地址: 资源基础地址 + 'RequestMonitorWidget.js' + 资源版本后缀, 关键: false, 分组: 'background' },
    地图模块: { 类型: 'inline-js', 地址: 资源基础地址 + 'sheep_map_restore.js' + 资源版本后缀, 关键: false, 分组: 'lazy' },
    交易模块: { 类型: 'inline-js', 地址: 资源基础地址 + 'TradeUI_Module.js' + 资源版本后缀, 关键: false, 分组: 'lazy' },
    副职业模块: { 类型: 'inline-js', 地址: 资源基础地址 + 'ProfessionUI_Module.js' + 资源版本后缀, 关键: false, 分组: 'lazy' },
    战斗预估运行时: { 类型: 'inline-js', 地址: 资源基础地址 + 'BattlePreview_Module.js' + 资源版本后缀, 关键: false, 分组: 'lazy' },
    战斗决策运行时: { 类型: 'inline-js', 地址: 资源基础地址 + 'BattleDecision_Module.js' + 资源版本后缀, 关键: false, 分组: 'lazy', 依赖: ['战斗预估运行时'] },
    战斗运行时: { 类型: 'inline-js', 地址: 资源基础地址 + 'BattleRuntime_Module.js' + 资源版本后缀, 关键: false, 分组: 'lazy', 依赖: ['战斗决策运行时'] },
    战斗战报运行时: { 类型: 'inline-js', 地址: 资源基础地址 + 'BattleReport_Module.js' + 资源版本后缀, 关键: false, 分组: 'lazy', 依赖: ['战斗运行时'] },
    战斗模块: { 类型: 'inline-js', 地址: 资源基础地址 + 'BattleUI_Module.js' + 资源版本后缀, 关键: false, 分组: 'lazy', 依赖: ['战斗战报运行时'] },
    数据库模块: { 类型: 'inline-js', 地址: 资源基础地址 + 'Database_Module.js' + 资源版本后缀, 关键: true, 分组: 'background' }
  };

  const 变量运行时接口模块顺序 = Object.freeze([
    '魂技机制注册表',
    '变量运行时视图',
    '变量规范化接口',
    '副职业派生接口',
    '技能结构编译接口',
    '技能消耗助手',
    '直接结算预算接口',
    '直接结算预算断言',
    '基础属性接口',
    '装备属性加成接口',
    'JSONPatch规范化接口',
    'JSONPatch文本预处理接口',
  ]);
  const 核心前置模块顺序 = Object.freeze(['样式核心', '魂环引擎样式', 'Vue核心', '壳层运行时', '内置角色库', '内置物品库']);
  const 核心模块顺序 = Object.freeze(['样式核心', '魂环引擎样式', 'Vue核心', '壳层运行时', '内置角色库', '内置物品库', ...变量运行时接口模块顺序, '逻辑桥接', '数据库适配器']);
  const 热更新重置模块顺序 = Object.freeze(['内置角色库', '内置物品库', ...变量运行时接口模块顺序, '逻辑桥接', '数据库适配器', '请求监控挂件', '战斗预估运行时', '战斗决策运行时', '战斗运行时', '战斗战报运行时', '战斗模块', '数据库模块']);
  const 启动预取模块顺序 = Object.freeze(['样式核心', '魂环引擎样式', '壳层运行时', '内置角色库', '内置物品库', '逻辑桥接', '数据库适配器', '请求监控挂件', '数据库模块', '战斗预估运行时', '战斗决策运行时', '战斗运行时', '战斗战报运行时', '战斗模块']);
  const 启动预取资源列表 = Object.freeze([
    'MVU_ZOD_Entry.js',
    'MVU_Skill_Runtime.js',
    'MVU_Schema_Runtime.js',
    'MVU_Runtime_View.js',
    'MVU.js',
    'MVU_Hooks.js',
    'timeline.js',
    'IntelEvents.js',
  ]);

  const 预览依赖映射 = {
    交易网络: ['交易模块'],
    交易模块弹窗: ['交易模块'],
    当前节点详情: ['交易模块', '地图模块'],
    图层控制与跑图: ['地图模块'],
    全息星图主画布: ['地图模块'],
    动态地点与扩展节点: ['地图模块'],
    武装工坊详细页: ['副职业模块'],
    副职业工坊: ['副职业模块'],
    战斗终端: ['战斗模块']
  };

  const 加载阶段 = {
    待启动: '待启动',
    节点就绪: '节点就绪',
    核心加载中: '核心加载中',
    桥接就绪: '桥接就绪',
    首屏可交互: '首屏可交互',
    空闲预取中: '空闲预取中',
    完成: '完成',
    失败: '失败'
  };

  const 加载状态 = {
    阶段: 加载阶段.待启动,
    启动时间: Date.now(),
    首屏可交互时间: 0,
    结束时间: 0,
    数据库模块开始时间: 0,
    数据库模块完成时间: 0,
    数据库模块错误: '',
    错误数: 0,
    最近错误: ''
  };

  const 模块状态表 = Object.create(null);
  const 模块加载承诺表 = new Map();
  const 文本资源缓存表 = new Map();
  let 引导承诺 = null;
  let 空闲预取已安排 = false;
  let 数据库模块后台加载已安排 = false;

  Object.keys(模块注册表).forEach(模块名 => {
    模块状态表[模块名] = {
      状态: 'pending',
      尝试次数: 0,
      错误: '',
      最近来源: '',
      最后完成时间: 0
    };
  });

  宿主窗口.__LWCS_加载状态__ = 加载状态;
  宿主窗口.__LWCS_模块状态__ = 模块状态表;

  function 睡眠(毫秒) {
    return new Promise(resolve => setTimeout(resolve, 毫秒));
  }

  async function 等待剧情推进预设接口(最大等待毫秒 = 12000) {
    const 开始时间 = Date.now();
    while (Date.now() - 开始时间 < 最大等待毫秒) {
      const 数据库接口 = 宿主窗口.AutoCardUpdaterAPI;
      if (
        数据库接口 &&
        typeof 数据库接口.importPlotPresetsFromData === 'function' &&
        typeof 数据库接口.injectPlotPresetToCurrentChat === 'function' &&
        typeof 数据库接口.getCurrentPlotPreset === 'function'
      ) {
        return 数据库接口;
      }
      await 睡眠(120);
    }
    throw new Error('剧情推进预设接口未就绪');
  }

  宿主窗口.__LWCS_注入数据库剧情推进预设__ = async function 注入数据库剧情推进预设(选项 = {}) {
    const 来源 = String(选项 && 选项.来源 ? 选项.来源 : 'manual');
    const 强制切换 = 选项 && 选项.强制切换 === true;
    const 预设文件名 = '缝合怪二改_专用推进预设.plot-preset.json';
    await 等待数据库模块就绪('plot_preset_inject', true);
    const 数据库接口 = await 等待剧情推进预设接口();
    const 当前预设名 = String(数据库接口.getCurrentPlotPreset() || '').trim();

    const 预设地址 = 资源基础地址 + 预设文件名 + 资源版本后缀;
    const 响应 = await fetchWithTimeout(预设地址, 取资源请求选项(预设地址));
    if (!响应.ok) throw new Error(`LWCS 剧情推进预设读取失败: ${响应.status}`);
    const 预设数组 = await 响应.json();
    const 预设名 = String(预设数组 && 预设数组[0] && 预设数组[0].name ? 预设数组[0].name : '').trim();
    if (!预设名) throw new Error('LWCS 剧情推进预设缺少正式名称');
    const 导入结果 = await 数据库接口.importPlotPresetsFromData(预设数组, { overwrite: true });
    if (!导入结果 || 导入结果.success === false) {
      throw new Error(`LWCS 剧情推进预设导入失败: ${导入结果 && 导入结果.message ? 导入结果.message : 'unknown_error'}`);
    }

    if (当前预设名 && 当前预设名 !== 预设名 && !强制切换) {
      console.info(`[LWCS] 当前聊天已使用剧情推进预设"${当前预设名}"，跳过专用剧情推进预设绑定。来源=${来源}`);
      return { success: true, skipped: true, reason: '已有其他剧情推进预设', presetName: 当前预设名 };
    }

    const 已绑定 = 数据库接口.injectPlotPresetToCurrentChat(预设名) === true;
    if (!已绑定) throw new Error(`LWCS 剧情推进预设绑定失败: ${预设名}`);
    console.info(`[LWCS] 已绑定当前聊天剧情推进预设：${预设名}。来源=${来源}`);
    return { success: true, skipped: false, presetName: 预设名 };
  };
  try {
    if (window !== 宿主窗口) window.__LWCS_注入数据库剧情推进预设__ = 宿主窗口.__LWCS_注入数据库剧情推进预设__;
  } catch (错误) {}

  function 记录阶段(阶段, 附加错误 = '') {
    加载状态.阶段 = 阶段;
    if (附加错误) {
      加载状态.最近错误 = 附加错误;
      加载状态.错误数 += 1;
    }
  }

  function 记录模块失败(模块名, 来源, 错误) {
    const 状态 = 模块状态表[模块名];
    if (!状态) return;
    const 错误文本 = 错误 && 错误.message ? 错误.message : String(错误 || 'unknown_error');
    状态.错误 = 错误文本;
    状态.最近来源 = 来源 || '';
    加载状态.最近错误 = `[${模块名}] ${错误文本}`;
    加载状态.错误数 += 1;
  }

  function 是提交哈希资源地址(地址) {
    return /\/gh\/[^?#]+@[0-9a-f]{40}(?:\/|$)/i.test(String(地址 || ''));
  }

  function 取资源请求选项(地址) {
    return { cache: 是提交哈希资源地址(地址) ? 'force-cache' : 'no-store' };
  }

  function fetchWithTimeout(地址, 选项 = {}, 超时毫秒 = 资源请求超时毫秒) {
    const 请求选项 = { ...选项 };
    let 控制器 = null;
    if (typeof AbortController === 'function') {
      控制器 = new AbortController();
      请求选项.signal = 控制器.signal;
    }
    return new Promise((resolve, reject) => {
      let 已结束 = false;
      const 结束 = (成功, 结果) => {
        if (已结束) return;
        已结束 = true;
        clearTimeout(超时器);
        if (成功) resolve(结果);
        else reject(结果);
      };
      const 超时器 = setTimeout(() => {
        try {
          if (控制器) 控制器.abort();
        } catch (错误) {}
        结束(false, new Error(`读取 ${地址} 超时:${超时毫秒}ms`));
      }, 超时毫秒);
      fetch(地址, 请求选项).then(
        响应 => 结束(true, 响应),
        错误 => 结束(false, 错误),
      );
    });
  }

  function 取候选资源地址列表(地址) {
    if (!地址 || !资源基础地址候选列表.length || !String(地址).startsWith(资源基础地址)) return [地址];
    const 文件路径 = String(地址).slice(资源基础地址.length);
    return 资源基础地址候选列表.map(候选基础地址 => 候选基础地址 + 文件路径);
  }

  async function 读取文本资源(地址, 错误前缀) {
    if (!文本资源缓存表.has(地址)) {
      const 读取承诺 = (async () => {
        const 错误列表 = [];
        for (const 候选地址 of 取候选资源地址列表(地址)) {
          try {
            const 响应 = await fetchWithTimeout(候选地址, 取资源请求选项(候选地址));
            if (!响应.ok) throw new Error(`[${响应.status}]`);
            return await 响应.text();
          } catch (错误) {
            错误列表.push(`${候选地址} ${错误 && 错误.message ? 错误.message : String(错误 || 'unknown_error')}`);
          }
        }
        throw new Error(`${错误前缀}: ${错误列表.join(' | ')}`);
      })()
        .catch(错误 => {
          文本资源缓存表.delete(地址);
          throw 错误;
        });
      文本资源缓存表.set(地址, 读取承诺);
    }
    return 文本资源缓存表.get(地址);
  }

  function 取文本资源错误前缀(模块) {
    if (!模块) return 'Resource load failed';
    if (模块.类型 === 'css') return 'CSS load failed';
    if (模块.类型 === 'module-js') return 'Module JS load failed';
    return 'JS load failed';
  }

  function 预取资源(地址) {
    if (!地址 || !宿主文档 || !宿主文档.createElement) return;
    const 标记 = 'mvu-prefetch-' + btoa(地址).replace(/[^a-zA-Z0-9]/g, '');
    if (宿主文档.getElementById(标记)) return;
    const 节点 = 宿主文档.createElement('link');
    节点.id = 标记;
    节点.rel = 'prefetch';
    节点.href = 地址;
    节点.as = /\.css(?:[?#]|$)/i.test(地址) ? 'style' : 'script';
    节点.crossOrigin = 'anonymous';
    (宿主文档.head || 宿主文档.documentElement).appendChild(节点);
  }

  function 预取模块文本(模块名) {
    const 模块 = 模块注册表[模块名];
    if (!模块 || (模块.类型 !== 'css' && 模块.类型 !== 'inline-js' && 模块.类型 !== 'module-js')) return;
    预取资源(模块.地址);
  }

  function 取样式标记(地址) {
    return 'mvu-style-' + btoa(地址).replace(/[^a-zA-Z0-9]/g, '');
  }

  function 取远程脚本标记(地址) {
    return 'mvu-remote-' + btoa(地址).replace(/[^a-zA-Z0-9]/g, '');
  }

  function 取内联脚本标记(地址) {
    return 'mvu-inline-' + btoa(地址).replace(/[^a-zA-Z0-9]/g, '');
  }

  async function 加载样式(地址) {
    const 样式标记 = 取样式标记(地址);
    const 旧样式 = 宿主文档.getElementById(样式标记);
    if (旧样式 && !调试热更新模式) return 地址;
    if (旧样式) 旧样式.remove();

    const 样式文本 = await 读取文本资源(地址, 'CSS load failed');
    const 样式节点 = 宿主文档.createElement('style');
    样式节点.id = 样式标记;
    样式节点.textContent = 样式文本;
    宿主文档.head.appendChild(样式节点);
    return 地址;
  }

  function 加载远程脚本(地址) {
    return new Promise((resolve, reject) => {
      const 脚本标记 = 取远程脚本标记(地址);
      if (宿主文档.getElementById(脚本标记)) {
        resolve(地址);
        return;
      }
      const 脚本节点 = 宿主文档.createElement('script');
      let 已完成 = false;
      const 完成 = (成功, 结果) => {
        if (已完成) return;
        已完成 = true;
        clearTimeout(超时器);
        if (成功) resolve(结果);
        else reject(结果);
      };
      const 超时器 = setTimeout(() => {
        try {
          脚本节点.remove();
        } catch (错误) {}
        完成(false, new Error(`Remote script load timeout:${远程脚本超时毫秒}ms ${地址}`));
      }, 远程脚本超时毫秒);
      脚本节点.id = 脚本标记;
      脚本节点.src = 地址;
      脚本节点.async = false;
      脚本节点.onload = () => 完成(true, 地址);
      脚本节点.onerror = () => 完成(false, new Error(`Remote script load failed: ${地址}`));
      宿主文档.head.appendChild(脚本节点);
    });
  }

  async function 加载内联脚本(地址) {
    const 脚本标记 = 取内联脚本标记(地址);
    const 旧脚本 = 宿主文档.getElementById(脚本标记);
    if (旧脚本 && !调试热更新模式) return 地址;
    if (旧脚本) 旧脚本.remove();

    const 代码文本 = await 读取文本资源(地址, 'JS load failed');
    const 脚本节点 = 宿主文档.createElement('script');
    脚本节点.id = 脚本标记;
    脚本节点.text = `${代码文本}\n//# sourceURL=${地址}`;
    (宿主文档.body || 宿主文档.documentElement).appendChild(脚本节点);
    return 地址;
  }

  function 加载模块脚本(地址) {
    return new Promise(async (resolve, reject) => {
      const 脚本标记 = 取内联脚本标记(地址);
      const 旧脚本 = 宿主文档.getElementById(脚本标记);
      if (旧脚本 && !调试热更新模式) {
        resolve(地址);
        return;
      }
      if (旧脚本) 旧脚本.remove();

      try {
        const 代码文本 = await 读取文本资源(地址, 'Module JS load failed');
        const 脚本节点 = 宿主文档.createElement('script');
        let 已完成 = false;
        const 完成加载 = () => {
          if (已完成) return;
          已完成 = true;
          resolve(地址);
        };
        脚本节点.id = 脚本标记;
        脚本节点.type = 'module';
        脚本节点.textContent = `${代码文本}\n//# sourceURL=${地址}`;
        脚本节点.onload = 完成加载;
        脚本节点.onerror = () => reject(new Error(`Module JS execute failed: ${地址}`));
        (宿主文档.body || 宿主文档.documentElement).appendChild(脚本节点);
        setTimeout(完成加载, 100);
      } catch (错误) {
        reject(错误);
      }
    });
  }

  async function 执行调试热更新() {
    try {
      记录阶段(加载阶段.核心加载中);
      await waitForMountsReady(10000);
      ensureGetAllVariablesShim();
      await 加载样式(模块注册表.样式核心.地址);
      热更新重置模块顺序.forEach(模块名 => {
        if (!模块状态表[模块名]) return;
        模块状态表[模块名].状态 = 'pending';
        模块状态表[模块名].错误 = '';
      });
      await 确保模块已加载('内置角色库', { 来源: 'hot_reload', 允许失败降级: false, 抛错: true });
      await 确保模块已加载('内置物品库', { 来源: 'hot_reload', 允许失败降级: false, 抛错: true });
      await 确保模块组已加载(变量运行时接口模块顺序, { 来源: 'hot_reload', 允许失败降级: false, 抛错: true });
      await 确保模块已加载('逻辑桥接', { 来源: 'hot_reload', 允许失败降级: false, 抛错: true });
      await 确保模块已加载('请求监控挂件', { 来源: 'hot_reload', 允许失败降级: true, 抛错: false });
      await 确保模块已加载('战斗模块', { 来源: 'hot_reload', 允许失败降级: true, 抛错: false });
      await 确保模块已加载('数据库模块', { 来源: 'hot_reload', 允许失败降级: false, 抛错: true });
      try {
        if (typeof 宿主窗口.__sheepMapDispose === 'function') 宿主窗口.__sheepMapDispose();
      } catch (错误) {}
      try {
        宿主窗口.__sheepMapRestoreLoaded = false;
        if (window !== 宿主窗口) window.__sheepMapRestoreLoaded = false;
      } catch (错误) {}
      宿主文档.querySelectorAll('#page-map .map-layout').forEach(节点 => 节点.remove());
      宿主文档.querySelectorAll([
        ".split-left-page[data-target='page-map']",
        ".split-right-page[data-target='page-map']",
        '[data-mvu-map-stage]'
      ].join(',')).forEach(节点 => { 节点.innerHTML = ''; });
      await 加载内联脚本(模块注册表.地图模块.地址);
      记录阶段(加载阶段.完成);
      加载状态.结束时间 = Date.now();
      setTimeout(triggerMvuRefresh, 0);
      setTimeout(triggerMvuRefresh, 260);
    } catch (错误) {
      记录阶段(加载阶段.失败, 错误 && 错误.message ? 错误.message : String(错误 || 'unknown_hot_reload_error'));
      console.error('[MVU] External UI hot reload failed:', 错误);
    }
  }

  async function 执行模块加载(模块名) {
    const 模块 = 模块注册表[模块名];
    if (!模块) throw new Error(`unknown_module:${模块名}`);
    for (const 依赖模块名 of Array.isArray(模块.依赖) ? 模块.依赖 : []) {
      const 依赖结果 = await 尝试加载模块(依赖模块名, `dependency:${模块名}`, false);
      if (!依赖结果?.ok) throw 依赖结果?.error || new Error(`module_dependency_failed:${模块名}:${依赖模块名}`);
    }
    if (模块.类型 === 'css') return 加载样式(模块.地址);
    if (模块.类型 === 'remote-js') return 加载远程脚本(模块.地址);
    if (模块.类型 === 'wait-global') return 等待全局函数(模块.全局键, 12000, 模块.值类型 || 'function');
    if (模块.类型 === 'module-js') return 加载模块脚本(模块.地址);
    return 加载内联脚本(模块.地址);
  }

  async function 尝试加载模块(模块名, 来源 = 'runtime', 允许失败降级 = true) {
    const 模块 = 模块注册表[模块名];
    const 状态 = 模块状态表[模块名];
    if (!模块 || !状态) return { ok: false, 模块名, reason: 'unknown_module' };
    if (状态.状态 === 'loaded') return { ok: true, 模块名, cached: true };
    if (模块加载承诺表.has(模块名)) return 模块加载承诺表.get(模块名);

    const 加载承诺 = (async () => {
      状态.状态 = 'loading';
      状态.最近来源 = 来源 || '';
      状态.错误 = '';
      const 最大尝试次数 = 2;
      for (let 尝试序号 = 1; 尝试序号 <= 最大尝试次数; 尝试序号 += 1) {
        状态.尝试次数 = 尝试序号;
        try {
          await 执行模块加载(模块名);
          状态.状态 = 'loaded';
          状态.错误 = '';
          状态.最后完成时间 = Date.now();
          return { ok: true, 模块名, attempts: 尝试序号 };
        } catch (错误) {
          记录模块失败(模块名, 来源, 错误);
          if (尝试序号 < 最大尝试次数) {
            await 睡眠(尝试序号 === 1 ? 首次重试延迟毫秒 : 二次重试延迟毫秒);
            continue;
          }
          状态.状态 = 模块.关键 || !允许失败降级 ? 'failed' : 'degraded';
          return { ok: false, 模块名, error: 错误, attempts: 尝试序号, degraded: 状态.状态 === 'degraded' };
        }
      }
      状态.状态 = 模块.关键 || !允许失败降级 ? 'failed' : 'degraded';
      return { ok: false, 模块名, reason: 'retry_exhausted' };
    })()
      .finally(() => {
        模块加载承诺表.delete(模块名);
      });

    模块加载承诺表.set(模块名, 加载承诺);
    return 加载承诺;
  }

  async function 确保模块已加载(模块名, 选项 = {}) {
    const 来源 = typeof 选项.来源 === 'string' ? 选项.来源 : 'runtime';
    const 允许失败降级 = 选项.允许失败降级 !== false;
    const 结果 = await 尝试加载模块(模块名, 来源, 允许失败降级);
    if (!结果.ok && 选项 && 选项.抛错) {
      throw 结果.error || new Error(结果.reason || `${模块名}_load_failed`);
    }
    return 结果;
  }

  async function 确保模块组已加载(模块名列表, 选项 = {}) {
    const 加载结果列表 = await Promise.all(模块名列表.map(模块名 => 确保模块已加载(模块名, { ...选项, 抛错: false })));
    const 失败结果 = 加载结果列表.find(结果 => !结果 || !结果.ok);
    if (失败结果 && 选项 && 选项.抛错) {
      throw 失败结果.error || new Error(失败结果.reason || `${失败结果.模块名 || 'module'}_load_failed`);
    }
    return 加载结果列表;
  }

  async function 等待数据库模块就绪(来源 = 'database_required', 抛错 = true) {
    if (!加载状态.数据库模块开始时间) 加载状态.数据库模块开始时间 = Date.now();
    加载状态.数据库模块错误 = '';
    const 结果 = await 确保模块已加载('数据库模块', { 来源, 允许失败降级: false, 抛错: false });
    if (结果 && 结果.ok) {
      加载状态.数据库模块完成时间 = Date.now();
      加载状态.数据库模块错误 = '';
      return 结果;
    }
    const 错误文本 =
      结果 && 结果.error && 结果.error.message
        ? 结果.error.message
        : 结果 && 结果.reason
          ? 结果.reason
          : '数据库模块加载失败';
    加载状态.数据库模块错误 = 错误文本;
    if (抛错) throw (结果 && 结果.error) || new Error(错误文本);
    return 结果;
  }

  function 启动数据库模块后台加载(来源 = 'bootstrap_database') {
    if (数据库模块后台加载已安排) return;
    数据库模块后台加载已安排 = true;
    if (!加载状态.数据库模块开始时间) 加载状态.数据库模块开始时间 = Date.now();
    setTimeout(() => {
      等待数据库模块就绪(来源, false).then(结果 => {
        if (!结果 || !结果.ok) console.error('[LWCS] 数据库模块后台加载失败:', 加载状态.数据库模块错误);
      });
    }, 0);
  }

  async function 确保预览依赖已加载(预览键, 选项 = {}) {
    const 键 = String(预览键 || '').trim();
    const 依赖列表 = Array.isArray(预览依赖映射[键]) ? 预览依赖映射[键] : [];
    if (!依赖列表.length) {
      return { ok: true, 预览键: 键, 模块列表: [], results: [] };
    }
    const 结果列表 = [];
    for (const 模块名 of 依赖列表) {
      const 结果 = await 确保模块已加载(模块名, {
        来源: 选项.来源 || `preview:${键}`,
        允许失败降级: true,
        抛错: false
      });
      结果列表.push(结果);
    }
    return {
      ok: 结果列表.every(item => item && item.ok),
      预览键: 键,
      模块列表: 依赖列表.slice(),
      results: 结果列表
    };
  }

  function 获取加载诊断() {
    const 模块状态快照 = Object.keys(模块状态表).reduce((结果, 模块名) => {
      结果[模块名] = { ...模块状态表[模块名] };
      return 结果;
    }, {});
      return {
      ...加载状态,
      模块: 模块状态快照
    };
  }

  宿主窗口.__LWCS_确保模块已加载__ = 确保模块已加载;
  宿主窗口.__LWCS_等待数据库模块就绪__ = 等待数据库模块就绪;
  宿主窗口.__LWCS_确保预览依赖已加载__ = 确保预览依赖已加载;
  宿主窗口.__LWCS_获取加载诊断__ = 获取加载诊断;
  try {
    if (window !== 宿主窗口) window.__LWCS_等待数据库模块就绪__ = 等待数据库模块就绪;
  } catch (错误) {}

  function ensureHostNodes() {
    if (!宿主文档.body) return;

    const legacyLeft = 宿主文档.getElementById('mvu-left-mount');
    if (legacyLeft) legacyLeft.remove();
    const legacyRight = 宿主文档.getElementById('mvu-right-mount');
    if (legacyRight) legacyRight.remove();

    let unified = 宿主文档.getElementById('mvu-unified-mount');
    if (!unified) {
      unified = 宿主文档.createElement('div');
      unified.id = 'mvu-unified-mount';
      宿主文档.body.appendChild(unified);
    }
    unified.style.position = 'relative';
    unified.style.width = '100%';
    unified.style.pointerEvents = 'none';
    unified.style.zIndex = '';

    const battleOverlay = 宿主文档.getElementById('battle-overlay');
    if (battleOverlay) battleOverlay.remove();

    if (!宿主文档.getElementById('page-map')) {
      const pageMap = 宿主文档.createElement('div');
      pageMap.id = 'page-map';
      pageMap.style.display = 'none';
      宿主文档.body.appendChild(pageMap);
    }

    const existingModal = 宿主文档.getElementById('detailModal');
    const modalIncomplete = existingModal && (!existingModal.querySelector('.mvu-modal-panel, .modal-panel')
      || !宿主文档.getElementById('modalTitle')
      || !宿主文档.getElementById('modalBody')
      || !宿主文档.getElementById('modalClose'));

    if (!existingModal || modalIncomplete) {
      const wrapper = 宿主文档.createElement('div');
      wrapper.innerHTML = `
      <div class="mvu-modal-mask modal-mask mvu-root" id="detailModal" aria-hidden="true">
        <div class="mvu-modal-panel modal-panel" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
          <div class="modal-head">
            <div class="modal-head-main">
              <div class="modal-meta-row">
                <span class="modal-level-chip" id="modalLevel"></span>
                <span class="modal-path-chip" id="modalPath"></span>
              </div>
              <div class="modal-title-wrap">
                <div class="modal-title" id="modalTitle"></div>
                <div class="modal-subtitle" id="modalSubtitle"></div>
              </div>
            </div>
            <button class="modal-close" id="modalClose">关闭</button>
          </div>
          <div class="modal-summary" id="modalSummary"></div>
          <div class="modal-body" id="modalBody"></div>
        </div>
      </div>
    `;
      const nextModal = wrapper.firstElementChild;
      if (existingModal && existingModal.parentNode) {
        existingModal.parentNode.replaceChild(nextModal, existingModal);
      } else {
        宿主文档.body.appendChild(nextModal);
      }
    }
  }

  function ensureGetAllVariablesShim() {
    if (宿主窗口.getAllVariables) return;

    const buildMessageIdCandidates = (depth = 24) => {
      const ids = ['latest'];
      for (let index = 1; index <= Math.max(1, depth); index += 1) ids.push(-index);
      return ids;
    };

    const hasLikelyRootData = (data) => {
      if (!data || typeof data !== 'object') return false;
      const statData = data.stat_data && typeof data.stat_data === 'object' ? data.stat_data : data;
      return !!(statData && typeof statData === 'object' && (statData.char || statData.world || statData.sys || statData.org || statData.map));
    };

    const scanRecentMessageData = async (reader) => {
      if (typeof reader !== 'function') return null;
      let fallback = null;
      for (const messageId of buildMessageIdCandidates()) {
        try {
          const data = await Promise.resolve(reader(messageId));
          if (!data || typeof data !== 'object') continue;
          if (!fallback) fallback = data;
          if (hasLikelyRootData(data)) return data;
        } catch (错误) {}
      }
      return fallback;
    };

    宿主窗口.getAllVariables = async function () {
      try {
        const mvu = 宿主窗口.Mvu || window.Mvu;
        if (mvu && typeof mvu.getMvuData === 'function') {
          const data = await scanRecentMessageData(messageId => mvu.getMvuData({ type: 'message', message_id: messageId }));
          if (data) return data;
        }
      } catch (错误) {}

      try {
        if (宿主窗口.TavernHelper && typeof 宿主窗口.TavernHelper.getVariables === 'function') {
          const latest = await scanRecentMessageData(messageId => 宿主窗口.TavernHelper.getVariables({ type: 'message', message_id: messageId }));
          return latest || null;
        }
      } catch (错误) {}

      return null;
    };

    try { window.getAllVariables = 宿主窗口.getAllVariables; } catch (错误) {}
  }

  async function waitForMountsReady(timeout) {
    const start = Date.now();
    const limit = timeout || 10000;
    while (Date.now() - start < limit) {
      ensureHostNodes();
      const unified = 宿主文档.getElementById('mvu-unified-mount');
      const modal = 宿主文档.getElementById('detailModal');
      if (unified && modal) return true;
      await 睡眠(100);
    }
    throw new Error('Mount points not ready');
  }

  async function 等待全局函数(函数名, timeout, 值类型 = 'function') {
    const start = Date.now();
    const limit = timeout || 10000;
    const 安全函数名 = String(函数名 || '').trim();
    if (!安全函数名) throw new Error('global function name missing');
    const 查找函数 = () => {
      const 窗口列表 = [宿主窗口];
      try {
        if (window && !窗口列表.includes(window)) 窗口列表.push(window);
      } catch (错误) {}
      for (const 当前窗口 of [...窗口列表]) {
        try {
          Array.from(当前窗口.frames || []).forEach(子窗口 => {
            if (子窗口 && !窗口列表.includes(子窗口)) 窗口列表.push(子窗口);
          });
        } catch (错误) {}
      }
      return 窗口列表.some(当前窗口 => {
        try {
          const 全局值 = 当前窗口[安全函数名];
          if (值类型 === 'function') return typeof 全局值 === 'function';
          if (值类型 === 'object') return !!全局值 && typeof 全局值 === 'object';
          return 全局值 !== undefined && 全局值 !== null;
        } catch (错误) {
          return false;
        }
      });
    };
    while (Date.now() - start < limit) {
      if (查找函数()) return 安全函数名;
      await 睡眠(100);
    }
    throw new Error(`Global function not ready: ${安全函数名}`);
  }

  function 读取已就绪全局值(键名, 值类型 = 'function') {
    const 安全键名 = String(键名 || '').trim();
    if (!安全键名) return null;
    const 窗口列表 = [宿主窗口];
    try {
      if (window && !窗口列表.includes(window)) 窗口列表.push(window);
    } catch (错误) {}
    for (const 当前窗口 of [...窗口列表]) {
      try {
        Array.from(当前窗口.frames || []).forEach(子窗口 => {
          if (子窗口 && !窗口列表.includes(子窗口)) 窗口列表.push(子窗口);
        });
      } catch (错误) {}
    }
    for (const 当前窗口 of 窗口列表) {
      try {
        const 全局值 = 当前窗口[安全键名];
        if (值类型 === 'function' && typeof 全局值 === 'function') return 全局值;
        if (值类型 === 'object' && 全局值 && typeof 全局值 === 'object') return 全局值;
        if (值类型 !== 'function' && 值类型 !== 'object' && 全局值 !== undefined && 全局值 !== null) return 全局值;
      } catch (错误) {}
    }
    return null;
  }

  function 显示入口按钮提示(消息, 类型 = 'info', 时长 = 4200) {
    const 文本 = String(消息 || '').trim();
    if (!文本) return;
    try {
      const toastBridge =
        (宿主窗口 && 宿主窗口.MVU_Toast && typeof 宿主窗口.MVU_Toast.show === 'function' ? 宿主窗口.MVU_Toast : null)
        || (window && window.MVU_Toast && typeof window.MVU_Toast.show === 'function' ? window.MVU_Toast : null);
      if (toastBridge) {
        toastBridge.show(文本, 类型, 时长);
        return;
      }
    } catch (错误) {}
    try {
      const toastrApi =
        (宿主窗口 && 宿主窗口.toastr ? 宿主窗口.toastr : null)
        || (window && window.toastr ? window.toastr : null);
      if (toastrApi && typeof toastrApi[类型] === 'function') {
        toastrApi[类型](文本);
        return;
      }
      if (toastrApi && typeof toastrApi.error === 'function') {
        toastrApi.error(文本);
        return;
      }
    } catch (错误) {}
    try {
      console[类型 === 'error' ? 'error' : 'warn'](`[LWCS] ${文本}`);
    } catch (错误) {}
  }

  function 构建入口按钮错误文本(入口名, 错误) {
    const 名称 = String(入口名 || '入口').trim();
    const 主错误 = 错误 && 错误.message ? 错误.message : String(错误 || '未知错误');
    const 数据库错误 = String(加载状态.数据库模块错误 || '').trim();
    if (数据库错误 && 数据库错误 !== 主错误) {
      return `${名称}打开失败：${主错误}（数据库模块：${数据库错误}）`;
    }
    return `${名称}打开失败：${主错误}`;
  }

  async function waitForVueMounted(timeout) {
    const start = Date.now();
    const limit = timeout || 10000;
    while (Date.now() - start < limit) {
      ensureHostNodes();
      const unifiedMount = 宿主文档.getElementById('mvu-unified-mount');
      if (unifiedMount && unifiedMount.innerHTML.trim()) return true;
      await 睡眠(140);
    }
    return false;
  }

  function triggerMvuRefresh() {
    try {
      const mvu = 宿主窗口.Mvu || window.Mvu;
      const eventName = mvu && mvu.events ? mvu.events.VARIABLE_UPDATE_ENDED : '';
      if (!eventName) return;
      try { 宿主窗口.dispatchEvent(new Event(eventName)); } catch (错误) {}
      try {
        if (typeof mvu.dispatchEvent === 'function') mvu.dispatchEvent(new Event(eventName));
      } catch (错误) {}
    } catch (错误) {}
  }

  function 注册冷归档脚本按钮() {
    try {
      if (宿主窗口.__LWCS_COLD_ARCHIVE_ENTRY_BUTTON_BOUND__) return true;
      if (
        typeof appendInexistentScriptButtons !== 'function' ||
        typeof getButtonEvent !== 'function' ||
        typeof eventOn !== 'function'
      ) {
        return false;
      }
      appendInexistentScriptButtons([{ name: 'MVU冷归档', visible: true }]);
      eventOn(getButtonEvent('MVU冷归档'), async () => {
        try {
          await 引导加载();
          await 确保模块已加载('逻辑桥接', { 来源: 'cold_archive_button', 允许失败降级: false, 抛错: true });
          await 等待全局函数('__LWCS_OPEN_MVU_COLD_ARCHIVE_PANEL__', 12000);
          const 打开冷归档面板 = 读取已就绪全局值('__LWCS_OPEN_MVU_COLD_ARCHIVE_PANEL__');
          if (typeof 打开冷归档面板 !== 'function') throw new Error('冷归档面板未就绪');
          打开冷归档面板();
        } catch (错误) {
          console.error('[MVU] MVU冷归档按钮执行失败:', 错误);
          显示入口按钮提示(构建入口按钮错误文本('MVU冷归档', 错误), 'error');
        }
      });
      宿主窗口.__LWCS_COLD_ARCHIVE_ENTRY_BUTTON_BOUND__ = true;
      return true;
    } catch (错误) {
      console.warn('[MVU] MVU冷归档按钮注册失败:', 错误);
      return false;
    }
  }

  function 安排冷归档脚本按钮注册() {
    const 启动时间 = Date.now();
    const 尝试注册 = () => {
      if (注册冷归档脚本按钮()) return;
      if (Date.now() - 启动时间 < 12000) setTimeout(尝试注册, 500);
    };
    尝试注册();
  }

  function 注册防截断流入脚本按钮() {
    try {
      if (宿主窗口.__LWCS_TRUNCATION_GUARD_ENTRY_BUTTON_BOUND__) return true;
      if (
        typeof appendInexistentScriptButtons !== 'function' ||
        typeof getButtonEvent !== 'function' ||
        typeof eventOn !== 'function'
      ) {
        return false;
      }
      appendInexistentScriptButtons([{ name: '防截断流入', visible: true }]);
      eventOn(getButtonEvent('防截断流入'), async () => {
        try {
          await 引导加载();
          let 打开防截断流入面板 = 读取已就绪全局值('__LWCS_OPEN_TRUNCATION_GUARD_PANEL__');
          if (typeof 打开防截断流入面板 !== 'function') {
            await 等待数据库模块就绪('truncation_guard_button', true);
            await 等待全局函数('__LWCS_OPEN_TRUNCATION_GUARD_PANEL__', 12000);
            打开防截断流入面板 = 读取已就绪全局值('__LWCS_OPEN_TRUNCATION_GUARD_PANEL__');
          }
          if (typeof 打开防截断流入面板 !== 'function') throw new Error('防截断流入面板未就绪');
          打开防截断流入面板();
        } catch (错误) {
          console.error('[MVU] 防截断流入按钮执行失败:', 错误);
          显示入口按钮提示(构建入口按钮错误文本('防截断流入', 错误), 'error');
        }
      });
      宿主窗口.__LWCS_TRUNCATION_GUARD_ENTRY_BUTTON_BOUND__ = true;
      return true;
    } catch (错误) {
      console.warn('[MVU] 防截断流入按钮注册失败:', 错误);
      return false;
    }
  }

  function 安排防截断流入脚本按钮注册() {
    const 启动时间 = Date.now();
    const 尝试注册 = () => {
      if (注册防截断流入脚本按钮()) return;
      if (Date.now() - 启动时间 < 12000) setTimeout(尝试注册, 500);
    };
    尝试注册();
  }

  function 安排空闲预取() {
    if (空闲预取已安排) return;
    空闲预取已安排 = true;
    记录阶段(加载阶段.空闲预取中);
    const 空闲执行器 = typeof 宿主窗口.requestIdleCallback === 'function'
      ? 宿主窗口.requestIdleCallback.bind(宿主窗口)
      : callback => setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 8 }), 160);
    ['地图模块', '战斗模块'].forEach(预取模块文本);
    空闲执行器(async () => {
      await Promise.allSettled([
        确保模块已加载('地图模块', { 来源: 'idle_prefetch:map' }),
        确保模块已加载('战斗模块', { 来源: 'idle_prefetch:battle' })
      ]);
      记录阶段(加载阶段.完成);
      加载状态.结束时间 = Date.now();
    });
  }

  async function 引导加载() {
    if (引导承诺) return 引导承诺;
    引导承诺 = (async () => {
      try {
        记录阶段(加载阶段.节点就绪);
        await waitForMountsReady(10000);
        ensureGetAllVariablesShim();

        记录阶段(加载阶段.核心加载中);
        启动预取模块顺序.forEach(预取模块文本);
        启动预取资源列表.forEach(文件名 => {
          预取资源(资源基础地址 + 文件名 + 资源版本后缀);
        });
        for (const 模块名 of 核心前置模块顺序) {
          await 确保模块已加载(模块名, { 来源: 'bootstrap_core', 允许失败降级: false });
        }
        await 确保模块组已加载(变量运行时接口模块顺序, { 来源: 'bootstrap_core', 允许失败降级: false, 抛错: true });
        await 确保模块已加载('逻辑桥接', { 来源: 'bootstrap_core', 允许失败降级: false });
        await 确保模块已加载('数据库适配器', { 来源: 'bootstrap_core', 允许失败降级: false });
        确保模块已加载('请求监控挂件', { 来源: 'bootstrap_request_monitor', 允许失败降级: true, 抛错: false });
        启动数据库模块后台加载('bootstrap_database');
        确保模块已加载('战斗模块', { 来源: 'bootstrap_battle', 允许失败降级: true, 抛错: false });

        if (!宿主窗口.Vue || typeof 宿主窗口.Vue.compile !== 'function') {
          throw new Error('Vue full build load failed: compiler missing');
        }

        记录阶段(加载阶段.桥接就绪);
        ensureHostNodes();
        const mounted = await waitForVueMounted(10000);
        if (mounted) {
          记录阶段(加载阶段.首屏可交互);
          加载状态.首屏可交互时间 = Date.now();
          setTimeout(triggerMvuRefresh, 0);
          setTimeout(triggerMvuRefresh, 280);
          setTimeout(triggerMvuRefresh, 900);
        }
        安排空闲预取();
      } catch (错误) {
        记录阶段(加载阶段.失败, 错误 && 错误.message ? 错误.message : String(错误 || 'unknown_bootstrap_error'));
        console.error('[MVU] External UI Vue loader failed:', 错误);
      }
    })();
    return 引导承诺;
  }

  function 监控并启动引导() {
    const tryBoot = () => {
      if (调试热更新模式) {
        if (!引导承诺) 引导承诺 = 执行调试热更新();
        return;
      }
      if (!引导承诺) 引导加载();
    };
    if (宿主文档.body && 宿主文档.readyState !== 'loading') {
      tryBoot();
      return;
    }
    const 启动时间戳 = Date.now();
    const 轮询器 = setInterval(() => {
      if (宿主文档.body && 宿主文档.readyState !== 'loading') {
        clearInterval(轮询器);
        tryBoot();
        return;
      }
      if (Date.now() - 启动时间戳 > 12000) {
        clearInterval(轮询器);
        tryBoot();
      }
    }, 80);
    try {
      宿主文档.addEventListener('readystatechange', () => {
        if (宿主文档.readyState !== 'loading') tryBoot();
      });
    } catch (错误) {}
  }

  安排冷归档脚本按钮注册();
  安排防截断流入脚本按钮注册();
  监控并启动引导();
})();

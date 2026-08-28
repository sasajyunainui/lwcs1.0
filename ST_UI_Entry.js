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
  const 是TT宿主 = [宿主窗口, window].some(候选窗口 => {
    if (!候选窗口) return false;
    const TT对象 = 候选窗口.__TAURITAVERN__;
    return Object.prototype.hasOwnProperty.call(候选窗口, '__TAURITAVERN_MAIN_READY__')
      || (!!TT对象 && typeof TT对象 === 'object')
      || (!!TT对象 && Object.prototype.hasOwnProperty.call(TT对象, 'ready'));
  });
  const 读取共享值 = 键 => 宿主窗口[键] ?? window[键] ?? null;
  const 共享启动状态 = 读取共享值('__LWCS_REMOTE_BOOTSTRAP_STATE__') || {};
  const 共享文本读取 = 读取共享值('__LWCS_READ_SHARED_TEXT_V1__');
  const 共享资源提交哈希 = String(读取共享值('__LWCS_当前远程提交__') || 共享启动状态.commit || 'local').trim() || 'local';
  const 入口参数 = (() => {
    try {
      const 当前脚本地址 = 宿主文档.currentScript?.src || '';
      return new URLSearchParams(new URL(当前脚本地址, 宿主文档.baseURI).hash.slice(1));
    } catch (错误) {
      return new URLSearchParams();
    }
  })();
  const 本轮启动代号 = Number(入口参数.get('lwcs_ui_generation') || 读取共享值('__LWCS_UI_ACTIVE_GENERATION_V1__') || 0);
  const 入口尝试代号 = String(入口参数.get('lwcs_attempt') || '');
  const 活动启动代号 = Number(读取共享值('__LWCS_UI_ACTIVE_GENERATION_V1__') || 0);
  if (本轮启动代号 > 0 && 活动启动代号 > 0 && 本轮启动代号 !== 活动启动代号) return;
  if (入口尝试代号) 宿主窗口.__LWCS_UI_ENTRY_STARTED_ATTEMPT_V1__ = 入口尝试代号;

  const 已有入口实例 = 宿主窗口[加载器键];
  if (
    已有入口实例?.active === true
    && 已有入口实例.generation === 本轮启动代号
    && 已有入口实例.commit === 共享资源提交哈希
  ) return;
  try { 已有入口实例?.停止?.(); } catch (错误) {}
  const 入口实例 = {
    generation: 本轮启动代号,
    commit: 共享资源提交哈希,
    active: true,
    subscriptions: [],
    停止() {
      if (!this.active) return;
      this.active = false;
      for (const 订阅 of this.subscriptions.splice(0)) {
        try { 订阅?.stop?.(); } catch (错误) {}
      }
    },
  };
  宿主窗口[加载器键] = 入口实例;
  const 入口实例仍活动 = () => 入口实例.active
    && 宿主窗口[加载器键] === 入口实例
    && (!Number.isFinite(本轮启动代号) || 本轮启动代号 <= 0
      || Number(读取共享值('__LWCS_UI_ACTIVE_GENERATION_V1__') || 0) === 本轮启动代号);
  const UI启动状态 = (() => {
    const 键 = '__LWCS_UI_ENTRY_STATE__';
    const 已有状态 = 宿主窗口[键];
    if (
      已有状态
      && typeof 已有状态 === 'object'
      && 已有状态.generation === 本轮启动代号
      && 已有状态.commit === 共享资源提交哈希
    ) return 已有状态;
    const 新状态 = {
      generation: 本轮启动代号,
      commit: 共享资源提交哈希,
      成功启动: false,
      重试次数: 0,
      最近错误: '',
    };
    宿主窗口[键] = 新状态;
    return 新状态;
  })();
  let UI就绪解决 = 宿主窗口.__LWCS_UI_READY_RESOLVE_V1__;
  let UI就绪拒绝 = 宿主窗口.__LWCS_UI_READY_REJECT_V1__;
  if (!宿主窗口.__LWCS_UI_READY_PROMISE_V1__
    || typeof 宿主窗口.__LWCS_UI_READY_PROMISE_V1__.then !== 'function') {
    宿主窗口.__LWCS_UI_READY_PROMISE_V1__ = new Promise((resolve, reject) => {
      UI就绪解决 = resolve;
      UI就绪拒绝 = reject;
    });
    宿主窗口.__LWCS_UI_READY_RESOLVE_V1__ = UI就绪解决;
    宿主窗口.__LWCS_UI_READY_REJECT_V1__ = UI就绪拒绝;
  }
  void 宿主窗口.__LWCS_UI_READY_PROMISE_V1__.catch(() => {});
  const 最大启动重试次数 = 2;

  const 默认资源基础地址 = 'https://testingcf.jsdelivr.net/gh/sasajyunainui/lwcs1.0@f9ac09ce4dc7b6418a915adb6e198121d2e0e10e/';
  const 资源基础地址 = (() => {
    const 覆盖地址 = String(
        宿主窗口.__LWCS_资源基础地址__
        || window.__LWCS_资源基础地址__
        || 共享启动状态.resourceBases?.[0]
        || ''
    ).trim();
    if (!覆盖地址) return 默认资源基础地址;
    return 覆盖地址.endsWith('/') ? 覆盖地址 : `${覆盖地址}/`;
  })();
  const 资源基础地址候选列表 = (() => {
    const 候选原值 = 宿主窗口.__LWCS_资源基础地址候选列表__
      || window.__LWCS_资源基础地址候选列表__
      || 共享启动状态.resourceBases;
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
  const 模块等待上限毫秒 = 15000;
  const 首次重试延迟毫秒 = 260;
  const 二次重试延迟毫秒 = 560;

  const 模块注册表 = {
    界面样式: {
      类型: 'inline-js',
      地址: 资源基础地址 + 'LWCS_UI_Styles_Bundle.js' + 资源版本后缀,
      关键: true,
      分组: 'core',
      已就绪: () => 读取共享值('__LWCS_UI_STYLES_READY_V1__') === true,
    },
    Vue核心: { 类型: 'remote-js', 地址: Vue远程地址, 关键: true, 分组: 'core' },
    壳层运行时: { 类型: 'inline-js', 地址: 资源基础地址 + 'Main_Vue_runtimefix_v2.js' + 资源版本后缀, 关键: true, 分组: 'core' },
    历法与库运行时: { 类型: 'wait-global', 全局键: '__LWCS_LIBRARY_DATA_RUNTIME_V1__', 值类型: 'object', 关键: true, 分组: 'core' },
    时代数据注册表: { 类型: 'wait-global', 全局键: '__LWCS_ERA_DATA_REGISTRY_V1__', 值类型: 'object', 关键: true, 分组: 'core' },
    时代货币注册表: { 类型: 'wait-global', 全局键: '__LWCS_ERA_CURRENCY_REGISTRY_V1__', 值类型: 'object', 关键: true, 分组: 'core' },
    时代事件状态运行时: { 类型: 'wait-global', 全局键: '__LWCS_TIMELINE_RUNTIME_V1__', 值类型: 'object', 关键: true, 分组: 'core' },
    时代运行时集成: { 类型: 'wait-global', 全局键: '__LWCS_ERA_RUNTIME_INTEGRATION_V1__', 值类型: 'object', 关键: true, 分组: 'core' },
    时代修炼运行时: { 类型: 'wait-global', 全局键: '__LWCS_ERA_CULTIVATION_RUNTIME_V1__', 值类型: 'object', 关键: true, 分组: 'core' },
    MVU核心就绪: { 类型: 'wait-global', 全局键: '__LWCS_MVU_CORE_READY_V1__', 值类型: 'value', 关键: true, 分组: 'core' },
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
    UI运行时: {
      类型: 'inline-js',
      地址: 资源基础地址 + 'LWCS_UI_Runtime_Bundle.js' + 资源版本后缀,
      关键: true,
      分组: 'core',
      已就绪: () => !!读取共享值('__LWCS_DATABASE_ADAPTER__')
        && typeof 读取共享值('__MVU_ROUTE_MODULE_INTENT__') === 'function'
        && typeof 读取共享值('mountTradeUI') === 'function'
        && typeof 读取共享值('mountProfessionUI') === 'function'
        && typeof 读取共享值('mountCompetitionUI') === 'function'
        && !!读取共享值('__LWCS_BATTLE_PREVIEW__')
        && !!读取共享值('__LWCS_BEHAVIOR_DECISION_PIPELINE__')
        && !!读取共享值('__LWCS_BATTLE_DECISION__')
        && !!读取共享值('__LWCS_BATTLE_RUNTIME__')
        && !!读取共享值('__LWCS_BATTLE_REPORT__')
        && typeof 读取共享值('mountBattleUI') === 'function'
        && !!读取共享值('AutoCardUpdaterAPI'),
    },
    UI集成运行时: {
      类型: 'bundle-member',
      依赖: ['UI运行时'],
      关键: true,
      分组: 'core',
      已就绪: () => !!读取共享值('__LWCS_DATABASE_ADAPTER__') && typeof 读取共享值('__MVU_ROUTE_MODULE_INTENT__') === 'function',
    },
    逻辑桥接: { 类型: 'bundle-member', 依赖: ['UI运行时'], 关键: true, 分组: 'core' },
    数据库适配器: {
      类型: 'bundle-member',
      依赖: ['UI运行时'],
      关键: true,
      分组: 'core',
      已就绪: () => !!读取共享值('__LWCS_DATABASE_ADAPTER__'),
    },
    持久化适配器: {
      类型: 'wait-global',
      全局键: '__LWCS_PERSISTENCE_ADAPTER_V1__',
      值类型: 'object',
      关键: true,
      分组: 'core',
      已就绪: () => {
        const 适配器 = 读取共享值('__LWCS_PERSISTENCE_ADAPTER_V1__');
        return !!适配器 && typeof 适配器.openSession === 'function' && typeof 适配器.registerBackend === 'function';
      },
    },
    MVU持久化提供者: {
      类型: 'wait-global',
      全局键: '__LWCS_MVU_PERSISTENCE_PROVIDER_V1__',
      值类型: 'object',
      关键: true,
      分组: 'core',
      依赖: ['持久化适配器'],
      已就绪: () => {
        const 提供者 = 读取共享值('__LWCS_MVU_PERSISTENCE_PROVIDER_V1__');
        return !!提供者 && typeof 提供者.open === 'function';
      },
    },
    MVU提示投影器: {
      类型: 'wait-global',
      全局键: '__LWCS_MVU_PROMPT_PROJECTOR_V1__',
      值类型: 'function',
      关键: true,
      分组: 'core',
      依赖: ['MVU持久化提供者'],
      已就绪: () => typeof 读取共享值('__LWCS_MVU_PROMPT_PROJECTOR_V1__') === 'function',
    },
    ...(是TT宿主 ? {} : {
      冷归档存储: { 类型: 'inline-js', 地址: 资源基础地址 + 'LWCS_Cold_Archive_Store.js' + 资源版本后缀, 关键: true, 分组: 'core', 依赖: ['持久化适配器'] },
    }),
    请求监控挂件: {
      类型: 'remote-js',
      地址: 资源基础地址 + 'RequestMonitorWidget.js' + 资源版本后缀,
      关键: false,
      分组: 'background',
      已就绪: () => !!查找消息统计界面(),
    },
    TT变量管理器: {
      类型: 'remote-js',
      地址: 资源基础地址 + 'TTStoreVariableManager.js' + 资源版本后缀,
      关键: false,
      分组: 'background',
      依赖: ['Vue核心', '持久化适配器', 'MVU持久化提供者'],
      已就绪: () => !!读取共享值('__LWCS_TT_STORE_VARIABLE_MANAGER_V1__'),
    },
    地图模块: {
      类型: 'inline-js',
      地址: 资源基础地址 + 'sheep_map_restore.js' + 资源版本后缀,
      关键: true,
      分组: 'core',
      依赖: ['UI运行时'],
      已就绪: () => 读取共享值('__sheepMapRestoreLoaded') === true,
    },
    游戏功能运行时: {
      类型: 'bundle-member',
      依赖: ['UI运行时'],
      关键: true,
      分组: 'core',
      已就绪: () => typeof 读取共享值('mountTradeUI') === 'function'
        && typeof 读取共享值('mountProfessionUI') === 'function'
        && typeof 读取共享值('mountCompetitionUI') === 'function'
        && !!读取共享值('__LWCS_BATTLE_PREVIEW__')
        && !!读取共享值('__LWCS_BEHAVIOR_DECISION_PIPELINE__')
        && !!读取共享值('__LWCS_BATTLE_DECISION__')
        && !!读取共享值('__LWCS_BATTLE_RUNTIME__')
        && !!读取共享值('__LWCS_BATTLE_REPORT__')
        && typeof 读取共享值('mountBattleUI') === 'function',
    },
    交易模块: { 类型: 'bundle-member', 依赖: ['游戏功能运行时'], 关键: true, 分组: 'core' },
    副职业模块: { 类型: 'bundle-member', 依赖: ['游戏功能运行时'], 关键: true, 分组: 'core' },
    赛事权限模块: { 类型: 'bundle-member', 依赖: ['游戏功能运行时'], 关键: true, 分组: 'core' },
    战斗预估运行时: { 类型: 'bundle-member', 依赖: ['游戏功能运行时'], 关键: true, 分组: 'core' },
    行为决策管线: { 类型: 'bundle-member', 依赖: ['游戏功能运行时'], 关键: true, 分组: 'core' },
    战斗决策运行时: { 类型: 'bundle-member', 依赖: ['游戏功能运行时'], 关键: true, 分组: 'core' },
    战斗运行时: { 类型: 'bundle-member', 依赖: ['游戏功能运行时'], 关键: true, 分组: 'core' },
    战斗战报运行时: { 类型: 'bundle-member', 依赖: ['游戏功能运行时'], 关键: true, 分组: 'core' },
    战斗模块: { 类型: 'bundle-member', 依赖: ['游戏功能运行时'], 关键: true, 分组: 'core' },
    数据库模块: {
      类型: 'bundle-member',
      依赖: ['UI运行时'],
      关键: true,
      分组: 'core',
      已就绪: () => !!读取共享值('AutoCardUpdaterAPI'),
    }
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
  const 时代运行时前置模块顺序 = Object.freeze(['历法与库运行时', '时代数据注册表', '时代货币注册表', '时代事件状态运行时', '时代运行时集成', '时代修炼运行时', 'MVU核心就绪']);
  const MVU核心接口模块顺序 = Object.freeze([...时代运行时前置模块顺序, ...变量运行时接口模块顺序]);
  const 核心前置模块顺序 = Object.freeze(['界面样式', 'Vue核心', '壳层运行时']);
  const 冷归档前置模块顺序 = Object.freeze([
    '持久化适配器',
    'MVU持久化提供者',
    'MVU提示投影器',
    ...(是TT宿主 ? [] : ['冷归档存储']),
  ]);
  const 核心模块顺序 = Object.freeze([...核心前置模块顺序, ...冷归档前置模块顺序, 'UI运行时', '地图模块', '数据库模块']);
  const 正常启动追踪模块顺序 = Object.freeze([...核心模块顺序]);

  const 加载阶段 = {
    待启动: '待启动',
    节点就绪: '节点就绪',
    核心加载中: '核心加载中',
    桥接就绪: '桥接就绪',
    首屏可交互: '首屏可交互',
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
  const 远程脚本加载承诺表 = new Map();
  let MVU核心接口验证承诺 = null;
  let 引导承诺 = null;

  Object.keys(模块注册表).forEach(模块名 => {
    模块状态表[模块名] = {
      状态: 'pending',
      阶段: 模块名 === '地图模块' ? '等待首屏' : '等待',
      尝试次数: 0,
      错误: '',
      最近来源: '',
      最后完成时间: 0
    };
  });

  宿主窗口.__LWCS_加载状态__ = 加载状态;
  宿主窗口.__LWCS_模块状态__ = 模块状态表;

  function 刷新加载追踪面板() {
    const 追踪器 = 宿主窗口.__LWCS_加载追踪器__;
    if (!追踪器 || typeof 追踪器.更新模块快照 !== 'function') return;
    const 模块列表 = 正常启动追踪模块顺序.map(模块名 => {
      const 状态 = 模块状态表[模块名] || {};
      return {
        名称: 模块名,
        状态: 状态.状态 || 'pending',
        阶段: 状态.阶段 || '',
        错误: 状态.错误 || '',
      };
    });
    追踪器.更新模块快照({
      阶段: 加载状态.阶段,
      模块列表,
      全部完成: 加载状态.阶段 === 加载阶段.完成
        && 模块列表.length > 0
        && 模块列表.every(项目 => 项目.状态 === 'loaded'),
      最近错误: 加载状态.最近错误,
    });
  }

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
    刷新加载追踪面板();
  }

  function 记录模块失败(模块名, 来源, 错误) {
    const 状态 = 模块状态表[模块名];
    if (!状态) return;
    const 错误文本 = 错误 && 错误.message ? 错误.message : String(错误 || 'unknown_error');
    状态.错误 = 错误文本;
    状态.最近来源 = 来源 || '';
    加载状态.最近错误 = `[${模块名}] ${错误文本}`;
    加载状态.错误数 += 1;
    刷新加载追踪面板();
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
            if (typeof 共享文本读取 === 'function') {
              return await 共享文本读取(
                候选地址,
                取资源请求选项(候选地址),
                资源请求超时毫秒,
                共享资源提交哈希,
              );
            }
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
    if (模块.类型 === 'module-js') return 'Module JS load failed';
    return 'JS load failed';
  }

  function 取远程脚本标记(地址) {
    return 'mvu-remote-' + btoa(地址).replace(/[^a-zA-Z0-9]/g, '');
  }

  function 取内联脚本标记(地址) {
    return 'mvu-inline-' + btoa(地址).replace(/[^a-zA-Z0-9]/g, '');
  }

  function 加载单一远程脚本(地址) {
    return new Promise((resolve, reject) => {
      const 脚本标记 = 取远程脚本标记(地址);
      const 旧脚本 = 宿主文档.getElementById(脚本标记);
      if (旧脚本) {
        resolve(地址);
        return;
      }
      const 脚本节点 = 宿主文档.createElement('script');
      let 已完成 = false;
      const 完成 = (成功, 结果) => {
        if (已完成) return;
        已完成 = true;
        clearTimeout(超时器);
        脚本节点.onload = null;
        脚本节点.onerror = null;
        if (成功) resolve(结果);
        else {
          try { 脚本节点.remove(); } catch (错误) {}
          reject(结果);
        }
      };
      const 超时器 = setTimeout(() => {
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

  function 加载远程脚本(地址, 状态 = null) {
    if (远程脚本加载承诺表.has(地址)) return 远程脚本加载承诺表.get(地址);
    if (状态) {
      状态.阶段 = '下载并执行';
      刷新加载追踪面板();
    }
    const 加载承诺 = (async () => {
      const 错误列表 = [];
      for (const 候选地址 of 取候选资源地址列表(地址)) {
        try {
          return await 加载单一远程脚本(候选地址);
        } catch (错误) {
          错误列表.push(`${候选地址} ${错误?.message || String(错误)}`);
        }
      }
      throw new Error(`Remote script load failed: ${错误列表.join(' | ')}`);
    })().finally(() => 远程脚本加载承诺表.delete(地址));
    远程脚本加载承诺表.set(地址, 加载承诺);
    return 加载承诺;
  }
  async function 加载内联脚本(地址, 状态 = null) {
    const 执行内联加载 = async () => {
      const 脚本标记 = 取内联脚本标记(地址);
      const 旧脚本 = 宿主文档.getElementById(脚本标记);
      if (旧脚本) {
        if (旧脚本.__LWCS_EXECUTION_ERROR__) throw 旧脚本.__LWCS_EXECUTION_ERROR__;
        return 地址;
      }

      if (状态) {
        状态.阶段 = '下载中';
        刷新加载追踪面板();
      }
      const 代码文本 = await 读取文本资源(地址, 'JS load failed');
      if (状态) {
        状态.阶段 = '执行中';
        刷新加载追踪面板();
      }
      const 脚本节点 = 宿主文档.createElement('script');
      脚本节点.id = 脚本标记;
      脚本节点.text = `${代码文本}\n//# sourceURL=${地址}`;
      let 执行错误 = null;
      const 捕获执行错误 = 事件 => {
        const 文件名 = String(事件?.filename || '');
        const 堆栈 = String(事件?.error?.stack || '');
        if (文件名 && 文件名 !== 地址 && !堆栈.includes(地址)) return;
        执行错误 = 事件?.error instanceof Error
          ? 事件.error
          : new Error(String(事件?.message || `JS execute failed: ${地址}`));
      };
      宿主窗口.addEventListener('error', 捕获执行错误);
      try {
        (宿主文档.body || 宿主文档.documentElement).appendChild(脚本节点);
      } finally {
        宿主窗口.removeEventListener('error', 捕获执行错误);
      }
      脚本节点.text = '';
      文本资源缓存表.delete(地址);
      const 共享文本请求表 = 宿主窗口.__LWCS_SHARED_TEXT_REQUESTS_V1__;
      if (共享文本请求表 && typeof 共享文本请求表.delete === 'function') {
        for (const 候选地址 of 取候选资源地址列表(地址)) {
          共享文本请求表.delete(`${共享资源提交哈希 || 'local'}:${候选地址}`);
        }
      }
      if (执行错误) {
        脚本节点.__LWCS_EXECUTION_ERROR__ = 执行错误;
        throw 执行错误;
      }
      return 地址;
    };
    if (!/LibraryData_Runtime\.js(?:[?#]|$)/.test(地址)) return 执行内联加载();
    const 运行时宿主 = 宿主窗口;
    const 已就绪 = 运行时宿主.__LWCS_LIBRARY_DATA_RUNTIME_V1__ || window.__LWCS_LIBRARY_DATA_RUNTIME_V1__;
    if (已就绪 && 已就绪.version === '2.0.0') return 地址;
    const 已有加载 = 运行时宿主.__LWCS_LIBRARY_DATA_RUNTIME_LOADING_V1__ || window.__LWCS_LIBRARY_DATA_RUNTIME_LOADING_V1__;
    if (已有加载 && typeof 已有加载.then === 'function') {
      await 已有加载;
      return 地址;
    }
    const 加载承诺 = 执行内联加载().then(() => {
      const 运行时 = 运行时宿主.__LWCS_LIBRARY_DATA_RUNTIME_V1__ || window.__LWCS_LIBRARY_DATA_RUNTIME_V1__;
      if (!运行时 || 运行时.version !== '2.0.0') throw new Error('LibraryData_Runtime未暴露2.0.0接口');
      return 运行时;
    });
    运行时宿主.__LWCS_LIBRARY_DATA_RUNTIME_LOADING_V1__ = 加载承诺;
    window.__LWCS_LIBRARY_DATA_RUNTIME_LOADING_V1__ = 加载承诺;
    try {
      await 加载承诺;
      return 地址;
    } catch (错误) {
      if (运行时宿主.__LWCS_LIBRARY_DATA_RUNTIME_LOADING_V1__ === 加载承诺) delete 运行时宿主.__LWCS_LIBRARY_DATA_RUNTIME_LOADING_V1__;
      if (window.__LWCS_LIBRARY_DATA_RUNTIME_LOADING_V1__ === 加载承诺) delete window.__LWCS_LIBRARY_DATA_RUNTIME_LOADING_V1__;
      throw 错误;
    }
  }

  function 加载模块脚本(地址, 状态 = null, 模块 = null) {
    return new Promise(async (resolve, reject) => {
      const 脚本标记 = 取内联脚本标记(地址);
      const 旧脚本 = 宿主文档.getElementById(脚本标记);
      if (旧脚本) {
        resolve(地址);
        return;
      }

      try {
        if (状态) {
          状态.阶段 = '下载中';
          刷新加载追踪面板();
        }
        const 代码文本 = await 读取文本资源(地址, 'Module JS load failed');
        if (状态) {
          状态.阶段 = '执行中';
          刷新加载追踪面板();
        }
        const 脚本节点 = 宿主文档.createElement('script');
        let 已完成 = false;
        const 完成加载 = () => {
          if (已完成) return;
          已完成 = true;
          resolve(地址);
        };
        脚本节点.id = 脚本标记;
        脚本节点.type = 'module';
        const 导出注入 = 模块?.导出名 && 模块?.导出全局键
          ? `\n;globalThis[${JSON.stringify(模块.导出全局键)}] = ${模块.导出名};`
          : '';
        脚本节点.textContent = `${代码文本}${导出注入}\n//# sourceURL=${地址}`;
        脚本节点.onload = 完成加载;
        脚本节点.onerror = () => reject(new Error(`Module JS execute failed: ${地址}`));
        (宿主文档.body || 宿主文档.documentElement).appendChild(脚本节点);
        文本资源缓存表.delete(地址);
        setTimeout(完成加载, 100);
      } catch (错误) {
        reject(错误);
      }
    });
  }

  async function 执行模块加载(模块名) {
    const 模块 = 模块注册表[模块名];
    if (!模块) throw new Error(`unknown_module:${模块名}`);
    for (const 依赖模块名 of Array.isArray(模块.依赖) ? 模块.依赖 : []) {
      const 依赖结果 = await 尝试加载模块(依赖模块名, `dependency:${模块名}`, false);
      if (!依赖结果?.ok) throw 依赖结果?.error || new Error(`module_dependency_failed:${模块名}:${依赖模块名}`);
    }
    const 状态 = 模块状态表[模块名];
    if (模块.类型 === 'remote-js') return 加载远程脚本(模块.地址, 状态);
    if (模块.类型 === 'wait-global') {
      if (状态) {
        状态.阶段 = '等待接口';
        刷新加载追踪面板();
      }
      return 等待全局函数(模块.全局键, 12000, 模块.值类型 || 'function');
    }
    if (模块.类型 === 'bundle-member') {
      if (typeof 模块.已就绪 === 'function' && !模块.已就绪()) {
        throw new Error(`${模块名}所属Bundle已执行但接口未就绪`);
      }
      return 模块.地址 || 模块名;
    }
    if (模块.类型 === 'module-js') return 加载模块脚本(模块.地址, 状态, 模块);
    return 加载内联脚本(模块.地址, 状态);
  }

  async function 尝试加载模块(模块名, 来源 = 'runtime', 允许失败降级 = true) {
    const 模块 = 模块注册表[模块名];
    const 状态 = 模块状态表[模块名];
    if (!模块 || !状态) return { ok: false, 模块名, reason: 'unknown_module' };
    if (状态.状态 === 'loaded') return { ok: true, 模块名, cached: true };
    if (模块加载承诺表.has(模块名)) return 模块加载承诺表.get(模块名);
    if (typeof 模块.已就绪 === 'function' && 模块.已就绪()) {
      状态.状态 = 'loaded';
      状态.阶段 = '复用已有全局';
      状态.错误 = '';
      刷新加载追踪面板();
      return { ok: true, 模块名, existing: true };
    }

    const 加载承诺 = (async () => {
      状态.状态 = 'loading';
      状态.阶段 = '准备加载';
      状态.最近来源 = 来源 || '';
      状态.错误 = '';
      刷新加载追踪面板();
      const 最大尝试次数 = 2;
      for (let 尝试序号 = 1; 尝试序号 <= 最大尝试次数; 尝试序号 += 1) {
        状态.尝试次数 = 尝试序号;
        try {
          await 执行模块加载(模块名);
          if (typeof 模块.已就绪 === 'function' && !模块.已就绪()) {
            throw new Error(`${模块名}执行完成但接口未就绪`);
          }
          状态.状态 = 'loaded';
          状态.阶段 = '完成';
          状态.错误 = '';
          状态.最后完成时间 = Date.now();
          刷新加载追踪面板();
          return { ok: true, 模块名, attempts: 尝试序号 };
        } catch (错误) {
          记录模块失败(模块名, 来源, 错误);
          if (尝试序号 < 最大尝试次数) {
            状态.阶段 = '等待重试';
            刷新加载追踪面板();
            await 睡眠(尝试序号 === 1 ? 首次重试延迟毫秒 : 二次重试延迟毫秒);
            continue;
          }
          状态.状态 = 模块.关键 || !允许失败降级 ? 'failed' : 'degraded';
          状态.阶段 = 状态.状态 === 'degraded' ? '降级' : '失败';
          刷新加载追踪面板();
          return { ok: false, 模块名, error: 错误, attempts: 尝试序号, degraded: 状态.状态 === 'degraded' };
        }
      }
      状态.状态 = 模块.关键 || !允许失败降级 ? 'failed' : 'degraded';
      状态.阶段 = 状态.状态 === 'degraded' ? '降级' : '失败';
      刷新加载追踪面板();
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
    const 最大等待毫秒 = Math.max(1, Number(选项.最大等待毫秒 || 模块等待上限毫秒));
    const 加载承诺 = 尝试加载模块(模块名, 来源, 允许失败降级);
    const 超时结果 = new Promise(resolve => setTimeout(() => {
      const 错误 = new Error(`${模块名}加载等待超过${最大等待毫秒}ms`);
      const 状态 = 模块状态表[模块名];
      if (状态 && 状态.状态 === 'loading') {
        状态.状态 = 模块注册表[模块名]?.关键 ? 'failed' : 'degraded';
        状态.阶段 = '超时';
        状态.错误 = 错误.message;
        刷新加载追踪面板();
      }
      resolve({ ok: false, 模块名, reason: 'timeout', error: 错误 });
    }, 最大等待毫秒));
    const 结果 = await Promise.race([加载承诺, 超时结果]);
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
    const 结果 = await 确保模块已加载('数据库模块', { 来源, 允许失败降级: false, 抛错: false, 最大等待毫秒: 60000 });
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

    宿主窗口.getAllVariables = async function () {
      try {
        const mvu = 宿主窗口.Mvu || window.Mvu;
        if (mvu && typeof mvu.getMvuData === 'function') {
          const 上下文 = typeof 宿主窗口.SillyTavern?.getContext === 'function'
            ? 宿主窗口.SillyTavern.getContext()
            : null;
          const 聊天 = Array.isArray(上下文?.chat) ? 上下文.chat : [];
          const 末条 = 聊天[聊天.length - 1];
          const 当前楼层 = 聊天.length
            ? Number(末条?.message_id ?? 末条?.id ?? 聊天.length - 1)
            : NaN;
          const 读取选项 = [
            ...(Number.isFinite(当前楼层)
              ? [{ type: 'message', message_id: Math.trunc(当前楼层) }]
              : []),
            { type: 'chat' },
            { type: 'message', message_id: 'latest' },
          ];
          if (typeof mvu.getMvuDataAsync === 'function') {
            const data = await mvu.getMvuDataAsync(读取选项[0]);
            if (data?.stat_data && typeof data.stat_data === 'object' && Object.keys(data.stat_data).length > 0) return data;
          }
          for (const 选项 of 读取选项) {
            const data = await Promise.resolve(mvu.getMvuData(选项));
            if (data?.stat_data && typeof data.stat_data === 'object' && Object.keys(data.stat_data).length > 0) return data;
          }
        }
      } catch (错误) {}

      try {
        if (宿主窗口.TavernHelper && typeof 宿主窗口.TavernHelper.getVariables === 'function') {
          const 上下文 = typeof 宿主窗口.SillyTavern?.getContext === 'function'
            ? 宿主窗口.SillyTavern.getContext()
            : null;
          const 聊天 = Array.isArray(上下文?.chat) ? 上下文.chat : [];
          const 末条 = 聊天[聊天.length - 1];
          const 当前楼层 = 聊天.length
            ? Number(末条?.message_id ?? 末条?.id ?? 聊天.length - 1)
            : NaN;
          for (const 消息编号 of Number.isFinite(当前楼层) ? [Math.trunc(当前楼层), 'latest'] : ['latest']) {
            const data = await Promise.resolve(
              宿主窗口.TavernHelper.getVariables({ type: 'message', message_id: 消息编号 }),
            );
            if (data && typeof data === 'object') return data;
          }
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

  async function 等待MVU核心契约(来源 = 'bootstrap_core', 抛错 = true, 最大等待毫秒 = 30000) {
    if (!MVU核心接口验证承诺) {
      MVU核心接口验证承诺 = (async () => {
        加载状态.阶段 = '等待MVU核心接口契约';
        加载状态.最近错误 = '';
        刷新加载追踪面板();
        const 就绪承诺 = 读取共享值('__LWCS_MVU_CORE_READY_PROMISE_V1__');
        if (!就绪承诺 || typeof 就绪承诺.then !== 'function') throw new Error('MVU核心就绪承诺未注册');
        await Promise.race([
          就绪承诺,
          睡眠(最大等待毫秒).then(() => { throw new Error(`MVU核心接口契约等待超过${最大等待毫秒}ms`); }),
        ]);
        const 契约 = 读取共享值('__LWCS_MVU_CORE_CONTRACT_V1__');
        if (!契约?.ready) throw new Error(`MVU核心接口契约不完整${契约?.missing?.length ? `：${契约.missing.join('、')}` : ''}`);
        const 缺失接口 = [];
        for (const 模块名 of MVU核心接口模块顺序) {
          const 模块 = 模块注册表[模块名];
          const 已就绪 = 模块?.类型 === 'wait-global'
            && !!读取已就绪全局值(模块.全局键, 模块.值类型 || 'function');
          const 状态 = 模块状态表[模块名];
          if (状态) {
            状态.状态 = 已就绪 ? 'loaded' : 'failed';
            状态.阶段 = 已就绪 ? '核心契约确认' : '接口缺失';
            状态.错误 = 已就绪 ? '' : `${来源}: ${模块?.全局键 || 模块名}`;
            状态.最近来源 = 来源;
            状态.最后完成时间 = 已就绪 ? Date.now() : 0;
          }
          if (!已就绪) 缺失接口.push(模块名);
        }
        刷新加载追踪面板();
        if (缺失接口.length) throw new Error(`MVU核心接口缺失：${缺失接口.join('、')}`);
        return { ok: true, contract: 契约 };
      })().catch(错误 => {
        const 错误文本 = 错误 && 错误.message ? 错误.message : String(错误 || 'MVU核心契约验证失败');
        加载状态.最近错误 = 错误文本;
        刷新加载追踪面板();
        if (抛错) throw 错误;
        return { ok: false, error: 错误 };
      });
    }
    return MVU核心接口验证承诺;
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

  async function waitForVueMounted(timeout) {
    const start = Date.now();
    const limit = timeout || 10000;
    while (Date.now() - start < limit) {
      if (!入口实例仍活动()) return false;
      ensureHostNodes();
      const unifiedMount = 宿主文档.getElementById('mvu-unified-mount');
      const 真实卡片已就绪 = 读取共享值('__LWCS_UI_CONTENT_READY_V1__') === true;
      if (
        真实卡片已就绪
        && unifiedMount?.dataset?.mvuContentReady === '1'
        && unifiedMount.querySelector('.mvu-unified-page.active [data-unified-card]:not(:empty)')
      ) {
        return true;
      }
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

  let 冷归档按钮已由当前脚本绑定 = false;

  function 注册冷归档脚本按钮() {
    try {
      if (!入口实例仍活动()) return true;
      if (是TT宿主) return true;
      if (冷归档按钮已由当前脚本绑定) return true;
      if (
        typeof appendInexistentScriptButtons !== 'function' ||
        typeof getButtonEvent !== 'function' ||
        typeof eventOn !== 'function'
      ) {
        return false;
      }
      appendInexistentScriptButtons([{ name: '变量归档', visible: true }]);
      const 订阅 = eventOn(getButtonEvent('变量归档'), async () => {
        try {
          await 引导加载();
          await 确保模块已加载('冷归档存储', { 来源: 'cold_archive_button', 允许失败降级: false, 抛错: true });
          const 冷归档存储 = 读取已就绪全局值('__LWCS_COLD_ARCHIVE_STORE_V1__', 'object');
          if (!冷归档存储 || typeof 冷归档存储.open !== 'function') throw new Error('冷归档存储模块未就绪');
          await 确保模块已加载('逻辑桥接', { 来源: 'cold_archive_button', 允许失败降级: false, 抛错: true });
          await 等待全局函数('__LWCS_OPEN_MVU_COLD_ARCHIVE_PANEL__', 12000);
          const 打开冷归档面板 = 读取已就绪全局值('__LWCS_OPEN_MVU_COLD_ARCHIVE_PANEL__');
          if (typeof 打开冷归档面板 !== 'function') throw new Error('冷归档面板未就绪');
          打开冷归档面板();
        } catch (错误) {
          console.error('[MVU] MVU冷归档按钮执行失败:', 错误);
          显示入口按钮提示('变量归档暂时无法打开，请稍后重试。', 'error');
        }
      });
      if (订阅 && typeof 订阅.stop === 'function') 入口实例.subscriptions.push(订阅);
      冷归档按钮已由当前脚本绑定 = true;
      宿主窗口.__LWCS_COLD_ARCHIVE_ENTRY_BUTTON_BOUND__ = {
        commit: 共享资源提交哈希,
        boundAt: Date.now(),
      };
      return true;
    } catch (错误) {
      console.warn('[MVU] MVU冷归档按钮注册失败:', 错误);
      return false;
    }
  }

  function 安排冷归档脚本按钮注册() {
    const 启动时间 = Date.now();
    const 尝试注册 = () => {
      if (!入口实例仍活动()) return;
      if (注册冷归档脚本按钮()) return;
      if (Date.now() - 启动时间 < 12000) setTimeout(尝试注册, 500);
    };
    尝试注册();
  }

  function 查找消息统计界面() {
    const 待检查窗口 = [宿主窗口, window];
    const 已检查窗口 = new Set();
    while (待检查窗口.length && 已检查窗口.size < 32) {
      const 当前窗口 = 待检查窗口.shift();
      if (!当前窗口 || 已检查窗口.has(当前窗口)) continue;
      已检查窗口.add(当前窗口);
      try {
        const 根节点 = 当前窗口.document?.getElementById('request-monitor-root');
        const 悬浮按钮 = 根节点?.querySelector('.rm-fab');
        if (根节点?.isConnected && 悬浮按钮 && typeof 悬浮按钮.click === 'function') {
          return { 窗口: 当前窗口, 根节点, 悬浮按钮 };
        }
      } catch (错误) {}
      try {
        if (当前窗口.parent && 当前窗口.parent !== 当前窗口) 待检查窗口.push(当前窗口.parent);
      } catch (错误) {}
      try {
        if (当前窗口.top && 当前窗口.top !== 当前窗口) 待检查窗口.push(当前窗口.top);
      } catch (错误) {}
      try { 待检查窗口.push(...Array.from(当前窗口.frames || [])); } catch (错误) {}
    }
    return null;
  }

  function 重置失效的消息统计挂件() {
    const 已访问窗口 = new Set();
    const 待访问窗口 = [宿主窗口, window];
    while (待访问窗口.length && 已访问窗口.size < 32) {
      const 当前窗口 = 待访问窗口.shift();
      if (!当前窗口 || 已访问窗口.has(当前窗口)) continue;
      已访问窗口.add(当前窗口);
      try {
        if (typeof 当前窗口.__LWCS_REQUEST_MONITOR_UNLOAD__ === 'function') {
          当前窗口.__LWCS_REQUEST_MONITOR_UNLOAD__();
        }
      } catch (错误) {}
      try {
        if (当前窗口.parent && 当前窗口.parent !== 当前窗口) 待访问窗口.push(当前窗口.parent);
      } catch (错误) {}
      try {
        if (当前窗口.top && 当前窗口.top !== 当前窗口) 待访问窗口.push(当前窗口.top);
      } catch (错误) {}
      try { 待访问窗口.push(...Array.from(当前窗口.frames || [])); } catch (错误) {}
    }

    const 模块 = 模块注册表.请求监控挂件;
    for (const 候选地址 of 取候选资源地址列表(模块.地址)) {
      try { 宿主文档.getElementById(取远程脚本标记(候选地址))?.remove(); } catch (错误) {}
      远程脚本加载承诺表.delete(候选地址);
    }
    try {
      宿主文档.querySelectorAll('script[src*="RequestMonitorWidget.js"]').forEach(脚本 => 脚本.remove());
    } catch (错误) {}
    远程脚本加载承诺表.delete(模块.地址);
    模块加载承诺表.delete('请求监控挂件');
    const 状态 = 模块状态表.请求监控挂件;
    if (状态) {
      状态.状态 = 'pending';
      状态.阶段 = '等待';
      状态.错误 = '';
    }
  }

  async function 打开消息统计界面(界面) {
    let 当前界面 = 界面 || 查找消息统计界面();
    if (!当前界面) throw new Error('请求统计界面未就绪');
    const 已打开 = () => !!(
      当前界面?.根节点?.querySelector('.rm-panel')
      || 当前界面?.根节点?.querySelector('.rm-root.is-open')
    );
    if (已打开()) return true;
    当前界面.悬浮按钮.click();
    await 睡眠(120);
    当前界面 = 查找消息统计界面() || 当前界面;
    if (已打开()) return true;
    当前界面.悬浮按钮.click();
    await 睡眠(160);
    当前界面 = 查找消息统计界面() || 当前界面;
    if (!已打开()) throw new Error('请求统计挂件已加载，但窗口未能打开');
    return true;
  }

  async function 打开消息统计入口() {
    console.info('[LWCS][消息统计] 已收到按钮事件');
    try {
      const 已有界面 = 查找消息统计界面();
      if (已有界面) {
        await 打开消息统计界面(已有界面);
        return;
      }
      显示入口按钮提示('消息统计加载中…', 'info', 1800);
      重置失效的消息统计挂件();
      await 确保模块已加载('请求监控挂件', { 来源: 'request_monitor_button', 允许失败降级: false, 抛错: true });
      const 等待开始 = Date.now();
      let 界面 = null;
      while (!界面 && Date.now() - 等待开始 < 5000) {
        界面 = 查找消息统计界面();
        if (!界面) await 睡眠(100);
      }
      await 打开消息统计界面(界面);
    } catch (错误) {
      console.error('[MVU] 消息统计按钮执行失败:', 错误);
      显示入口按钮提示('消息统计暂时无法打开，请稍后重试。', 'error');
    }
  }

  // TavernHelper 按钮事件必须留在原脚本 iframe；父页面入口只暴露业务动作。
  宿主窗口.__LWCS_OPEN_REQUEST_MONITOR_V1__ = 打开消息统计入口;
  入口实例.subscriptions.push({
    stop() {
      if (宿主窗口.__LWCS_OPEN_REQUEST_MONITOR_V1__ === 打开消息统计入口) {
        delete 宿主窗口.__LWCS_OPEN_REQUEST_MONITOR_V1__;
      }
    },
  });

  async function 打开TT变量管理入口() {
    try {
      await 确保模块已加载('TT变量管理器', {
        来源: 'tt_store_variable_manager_button',
        允许失败降级: false,
        抛错: true,
      });
      const 管理器 = 读取共享值('__LWCS_TT_STORE_VARIABLE_MANAGER_V1__');
      if (typeof 管理器?.open !== 'function') throw new Error('变量管理器尚未准备好');
      await 管理器.open();
    } catch (错误) {
      console.error('[MVU] TT-store 变量管理按钮执行失败:', 错误);
      显示入口按钮提示('变量管理暂时无法打开，请稍后重试。', 'error');
    }
  }

  宿主窗口.__LWCS_OPEN_TT_STORE_VARIABLE_MANAGER_V1__ = 打开TT变量管理入口;
  入口实例.subscriptions.push({
    stop() {
      if (宿主窗口.__LWCS_OPEN_TT_STORE_VARIABLE_MANAGER_V1__ === 打开TT变量管理入口) {
        delete 宿主窗口.__LWCS_OPEN_TT_STORE_VARIABLE_MANAGER_V1__;
      }
      try { 读取共享值('__LWCS_TT_STORE_VARIABLE_MANAGER_V1__')?.destroy?.(); } catch (错误) {}
    },
  });

  function 清理已废弃防护配置() {
    try {
      const 候选窗口 = [window, 宿主窗口];
      try {
        if (window.parent && !候选窗口.includes(window.parent)) 候选窗口.push(window.parent);
      } catch (错误) {}
      try {
        if (window.top && !候选窗口.includes(window.top)) 候选窗口.push(window.top);
      } catch (错误) {}
      for (const 候选 of 候选窗口) {
        try { 候选.localStorage?.removeItem('LWCS_防截断流入配置_v1'); } catch (错误) {}
        try { delete 候选.__LWCS_OPEN_TRUNCATION_GUARD_PANEL__; } catch (错误) {}
        try { delete 候选.__LWCS_TRUNCATION_GUARD__; } catch (错误) {}
        try { delete 候选.__LWCS_TRUNCATION_GUARD_ENTRY_BUTTON_BOUND__; } catch (错误) {}
      }
      if (typeof getScriptButtons !== 'function' || typeof replaceScriptButtons !== 'function') return false;
      const 当前按钮 = getScriptButtons();
      if (!Array.isArray(当前按钮)) return false;
      const 保留按钮 = 当前按钮.filter(按钮 => 按钮?.name !== '防截断流入');
      if (保留按钮.length !== 当前按钮.length) replaceScriptButtons(保留按钮);
      return true;
    } catch (错误) {
      console.warn('[MVU] 已废弃防护配置清理失败:', 错误);
      return false;
    }
  }

  function 安排已废弃防护配置清理() {
    const 启动时间 = Date.now();
    const 尝试清理 = () => {
      if (!入口实例仍活动()) return;
      if (清理已废弃防护配置()) return;
      if (Date.now() - 启动时间 < 12000) setTimeout(尝试清理, 500);
    };
    尝试清理();
  }

  async function 引导加载() {
    if (!入口实例仍活动()) return false;
    if (引导承诺) return 引导承诺;
    let 本次引导承诺;
    本次引导承诺 = (async () => {
      try {
        记录阶段(加载阶段.节点就绪);
        void 读取文本资源(模块注册表.UI运行时.地址, 'UI runtime preload failed').catch(() => {});
        await waitForMountsReady(10000);
        ensureGetAllVariablesShim();

        记录阶段(加载阶段.核心加载中);
        await Promise.all([
          确保模块已加载('界面样式', { 来源: 'bootstrap_core', 允许失败降级: false, 抛错: true }),
          确保模块已加载('Vue核心', { 来源: 'bootstrap_core', 允许失败降级: false, 抛错: true }),
        ]);
        await 确保模块已加载('壳层运行时', { 来源: 'bootstrap_core', 允许失败降级: false, 抛错: true });
        await 等待MVU核心契约('bootstrap_core', true);
        await 确保模块组已加载(冷归档前置模块顺序, { 来源: 'bootstrap_core', 允许失败降级: false, 抛错: true });
        await Promise.all([
          确保模块已加载('UI运行时', { 来源: 'bootstrap_core', 允许失败降级: false, 抛错: true }),
          确保模块已加载('地图模块', { 来源: 'bootstrap_core', 允许失败降级: false, 抛错: true }),
        ]);
        await Promise.all([
          等待数据库模块就绪('bootstrap_core', true),
        ]);

        if (!宿主窗口.Vue || typeof 宿主窗口.Vue.compile !== 'function') {
          throw new Error('Vue full build load failed: compiler missing');
        }

        记录阶段(加载阶段.桥接就绪);
        ensureHostNodes();
        const mounted = await waitForVueMounted(10000);
        if (!入口实例仍活动()) return;
        if (!mounted) {
          const 首屏错误 = String(读取共享值('__LWCS_UI_CONTENT_ERROR_V1__') || '').trim();
          throw new Error(首屏错误 ? `Vue 首屏数据未就绪：${首屏错误}` : 'Vue 首屏数据挂载超时');
        }
        记录阶段(加载阶段.首屏可交互);
        加载状态.首屏可交互时间 = Date.now();
        UI启动状态.成功启动 = true;
        UI启动状态.重试次数 = 0;
        UI启动状态.最近错误 = '';
        共享启动状态.uiStatus = 'ready';
        setTimeout(triggerMvuRefresh, 0);
        记录阶段(加载阶段.完成);
        加载状态.结束时间 = Date.now();
        UI就绪解决?.(UI启动状态);
        void 确保模块已加载('请求监控挂件', {
          来源: 'bootstrap_background',
          允许失败降级: true,
          抛错: false,
        });
      } catch (错误) {
        if (!入口实例仍活动()) return;
        const 错误文本 = 错误 && 错误.message ? 错误.message : String(错误 || 'unknown_bootstrap_error');
        UI启动状态.成功启动 = false;
        UI启动状态.最近错误 = 错误文本;
        记录阶段(加载阶段.失败, 错误文本);
        console.error('[MVU] External UI Vue loader failed:', 错误);
        try {
          const 导出诊断 = 读取共享值('__LWCS_EXPORT_MVU_CHAIN_DIAGNOSTICS_V1__');
          if (typeof 导出诊断 === 'function') console.error(`[LWCS][MVU链路诊断] ${JSON.stringify(导出诊断())}`);
        } catch (诊断错误) {
          console.error('[LWCS][MVU链路诊断] 导出失败:', 诊断错误);
        }
        if (引导承诺 !== 本次引导承诺) return;
        引导承诺 = null;
        MVU核心接口验证承诺 = null;
        模块加载承诺表.clear();
        Object.values(模块状态表).forEach(状态 => {
          if (状态 && 状态.状态 !== 'loaded') {
            状态.状态 = 'pending';
            状态.错误 = '';
          }
        });
        if (UI启动状态.重试次数 < 最大启动重试次数) {
          UI启动状态.重试次数 += 1;
          setTimeout(() => {
            if (入口实例仍活动() && 引导承诺 === null) 引导加载();
          }, UI启动状态.重试次数 === 1 ? 首次重试延迟毫秒 : 二次重试延迟毫秒);
        } else {
          共享启动状态.uiStatus = 'failed';
          UI就绪拒绝?.(错误);
          入口实例.停止();
          if (宿主窗口[加载器键] === 入口实例) delete 宿主窗口[加载器键];
        }
      }
    })();
    引导承诺 = 本次引导承诺;
    return 本次引导承诺;
  }

  function 监控并启动引导() {
    const tryBoot = () => {
      if (!入口实例仍活动()) return;
      刷新加载追踪面板();
      if (!引导承诺) 引导加载();
    };
    if (宿主文档.body && 宿主文档.readyState !== 'loading') {
      tryBoot();
      return;
    }
    const 启动时间戳 = Date.now();
    const 轮询器 = setInterval(() => {
      if (!入口实例仍活动()) {
        clearInterval(轮询器);
        return;
      }
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
  安排已废弃防护配置清理();
  监控并启动引导();
})();

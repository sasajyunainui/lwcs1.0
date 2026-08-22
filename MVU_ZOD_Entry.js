const MVU_ZOD_ENTRY_BASE_V1 = new URL('./', import.meta.url);
const MVU_ZOD_RESOURCE_TIMEOUT_MS_V1 = 6500;
const MVU追踪模块顺序_V1 = Object.freeze([
  'MVU_ZOD_Entry.js',
  'LibraryData_Runtime.js',
  'EraDataRegistry.js',
  'EraCurrencyRegistry.js',
  'TimelineRuntime.js',
  'EraRuntime_Integration.js',
  'EraCultivation_Runtime.js',
  'MVU_Skill_Runtime.js',
  'MVU_Schema_Runtime.js',
  'MVU_Competition_Runtime.js',
  'MVU_Runtime_View.js',
  'MVU.js',
  'MVU_Hooks.js',
  'IntelEvents.js',
]);
const MVU共享宿主窗口_V1 = (() => {
  try {
    if (globalThis.parent && globalThis.parent !== globalThis && globalThis.parent.document) return globalThis.parent;
  } catch (错误) {}
  return globalThis;
})();
const MVU共享启动状态_V1 = (() => {
  const 键 = '__LWCS_REMOTE_BOOTSTRAP_STATE__';
  const 已有状态 = MVU共享宿主窗口_V1[键];
  if (已有状态 && typeof 已有状态 === 'object') return 已有状态;
  const 新状态 = {
    commitPromise: null,
    commit: '',
    resourceBases: [],
    mvuStatus: 'loading',
    mvuStage: 'MVU 入口执行中',
    mvuModules: [],
    mvuTrackingComplete: false,
    uiStatus: 'idle',
  };
  MVU共享宿主窗口_V1[键] = 新状态;
  return 新状态;
})();

function 发布MVU模块状态_V1(名称, 状态, 阶段, 错误 = '') {
  const 状态表 = new Map(
    (Array.isArray(MVU共享启动状态_V1.mvuModules) ? MVU共享启动状态_V1.mvuModules : [])
      .map(项目 => [项目.名称, { ...项目 }])
  );
  MVU追踪模块顺序_V1.forEach(模块名 => {
    if (!状态表.has(模块名)) 状态表.set(模块名, { 名称: 模块名, 状态: 'pending', 阶段: '等待', 错误: '' });
  });
  状态表.set(名称, { 名称, 状态, 阶段, 错误 });
  MVU共享启动状态_V1.mvuStage = 阶段;
  MVU共享启动状态_V1.mvuModules = MVU追踪模块顺序_V1.map(模块名 => 状态表.get(模块名));
  MVU共享启动状态_V1.mvuTrackingComplete = MVU共享启动状态_V1.mvuModules.every(项目 =>
    ['loaded', 'degraded', 'failed'].includes(项目.状态)
  );
  try {
    MVU共享宿主窗口_V1.__LWCS_加载追踪器__?.更新MVU快照?.({
      阶段,
      模块列表: MVU共享启动状态_V1.mvuModules,
      全部完成: MVU共享启动状态_V1.mvuTrackingComplete,
    });
  } catch (追踪错误) {}
}

发布MVU模块状态_V1('MVU_ZOD_Entry.js', 'loading', '执行中');
const MVU_ZOD_ENTRY_BASE_CANDIDATES_V1 = (() => {
  const 候选原值 = globalThis.__LWCS_MVU_资源基础地址候选列表__;
  const 候选列表 = Array.isArray(候选原值) ? 候选原值 : [];
  const 清理地址 = 地址 => {
    const 文本 = String(地址 || '').trim();
    if (!文本) return '';
    return 文本.endsWith('/') ? 文本 : `${文本}/`;
  };
  return [MVU_ZOD_ENTRY_BASE_V1.href, ...候选列表.map(清理地址)].filter((地址, 序号, 列表) => 地址 && 列表.indexOf(地址) === 序号);
})();

function 是MVU提交哈希资源地址_V1(地址) {
  return /\/gh\/[^?#]+@[0-9a-f]{40}(?:\/|$)/i.test(String(地址 || ''));
}

function 取MVU资源请求选项_V1(地址) {
  return { cache: 是MVU提交哈希资源地址_V1(地址) ? 'force-cache' : 'no-store' };
}

function MVU请求超时_V1(承诺, 标签, 超时毫秒 = MVU_ZOD_RESOURCE_TIMEOUT_MS_V1, 超时回调 = null) {
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
        if (typeof 超时回调 === 'function') 超时回调();
      } catch (错误) {}
      结束(false, new Error(`${标签} 超时:${超时毫秒}ms`));
    }, 超时毫秒);
    Promise.resolve(承诺).then(
      结果 => 结束(true, 结果),
      错误 => 结束(false, 错误),
    );
  });
}

function MVU_FETCH_V1(地址) {
  const 请求选项 = 取MVU资源请求选项_V1(地址);
  let 控制器 = null;
  if (typeof AbortController === 'function') {
    控制器 = new AbortController();
    请求选项.signal = 控制器.signal;
  }
  return MVU请求超时_V1(fetch(地址, 请求选项), `读取 ${地址}`, MVU_ZOD_RESOURCE_TIMEOUT_MS_V1, () => {
    if (控制器) 控制器.abort();
  });
}

function 构建MVU候选资源地址列表_V1(文件名) {
  return MVU_ZOD_ENTRY_BASE_CANDIDATES_V1.map(基础地址 => {
    const 地址 = new URL(文件名, 基础地址);
    地址.search = '';
    地址.hash = '';
    return 地址.href;
  });
}

function 规范化MVU资源路径_V1(文件名) {
  const 原始文本 = String(文件名 || '').trim();
  if (!原始文本) throw new Error('MVU资源路径不能为空');
  const 地址 = new URL(原始文本, 'https://lwcs.invalid/');
  let 路径 = 地址.pathname.replace(/^\/+/, '');
  const 提交路径 = /(?:^|\/)gh\/[^/]+@([0-9a-f]{7,40})\/(.+)$/i.exec(路径);
  if (提交路径) 路径 = 提交路径[2];
  const 部件 = [];
  路径.split('/').forEach(项目 => {
    if (!项目 || 项目 === '.') return;
    if (项目 === '..') { 部件.pop(); return; }
    部件.push(项目);
  });
  if (!部件.length) throw new Error(`MVU资源路径无效: ${文件名}`);
  return 部件.join('/');
}

function 读取MVU资源提交_V1() {
  const 候选值 = [
    globalThis.__LWCS_MVU_当前远程提交__,
    MVU共享启动状态_V1.commit,
    ...MVU_ZOD_ENTRY_BASE_CANDIDATES_V1,
  ];
  for (const 值 of 候选值) {
    const 文本 = String(值 || '');
    if (/^[0-9a-f]{7,40}$/i.test(文本)) return 文本;
    const 匹配 = /@([0-9a-f]{7,40})(?:\/|$)/i.exec(文本);
    if (匹配) return 匹配[1];
  }
  return 'local';
}

function 发布MVU资源所有者_V1(所有者) {
  const 窗口 = [globalThis];
  try { if (globalThis.parent && globalThis.parent !== globalThis) 窗口.push(globalThis.parent); } catch (_) {}
  try { if (globalThis.top && globalThis.top !== globalThis && !窗口.includes(globalThis.top)) 窗口.push(globalThis.top); } catch (_) {}
  窗口.forEach(当前窗口 => {
    try { 当前窗口.__LWCS_MVU_RESOURCE_OWNER_V1__ = 所有者; } catch (_) {}
  });
}

const MVU资源所有者状态_V1 = (() => {
  const 键 = '__LWCS_MVU_RESOURCE_OWNER_STATE_V1__';
  const 旧状态 = globalThis[键];
  if (旧状态 && 旧状态.version === '1.0.0' && 旧状态.records instanceof Map) return 旧状态;
  const 新状态 = { version: '1.0.0', records: new Map() };
  globalThis[键] = 新状态;
  return 新状态;
})();

function MVU资源状态快照_V1(记录) {
  return Object.freeze({
    key: 记录.key,
    commit: 记录.commit,
    relativePath: 记录.relativePath,
    mode: 记录.mode,
    status: 记录.status,
    phase: 记录.phase,
    fetchAttempts: 记录.fetchAttempts,
    executeCount: 记录.executeCount,
    executionStarted: 记录.executionStarted,
    url: 记录.url || '',
    error: 记录.error ? String(记录.error.message || 记录.error) : '',
  });
}

function 创建MVU资源所有者_V1() {
  function canonicalKey(文件名, commit = 读取MVU资源提交_V1()) {
    return `${String(commit || 'local').trim() || 'local'}:${规范化MVU资源路径_V1(文件名)}`;
  }

  function getResourceState(文件名, commit) {
    const key = canonicalKey(文件名, commit);
    const 记录 = MVU资源所有者状态_V1.records.get(key);
    return 记录 ? MVU资源状态快照_V1(记录) : Object.freeze({
      key,
      commit: String(commit || 读取MVU资源提交_V1()),
      relativePath: 规范化MVU资源路径_V1(文件名),
      mode: null,
      status: 'unloaded',
      phase: 'idle',
      fetchAttempts: 0,
      executeCount: 0,
      executionStarted: false,
      url: '',
      error: '',
    });
  }

  async function 执行资源加载_V1(记录, 文件名, 选项) {
    const 模式 = 记录.mode;
    const 就绪检查 = typeof 选项.ready === 'function' ? 选项.ready : () => false;
    if (await Promise.resolve(就绪检查())) {
      记录.status = 'loaded';
      记录.phase = 'existing';
      记录.value = null;
      return Object.freeze({ key: 记录.key, commit: 记录.commit, relativePath: 记录.relativePath, mode: 模式, url: '', value: null, existing: true });
    }

    let 地址 = '';
    let 模块 = null;
    if (模式 === 'script-global') {
      const 候选地址 = 构建MVU候选资源地址列表_V1(文件名);
      let 代码文本 = '';
      const 错误列表 = [];
      while (记录.fetchAttempts < 2) {
        const 尝试序号 = 记录.fetchAttempts;
        记录.fetchAttempts += 1;
        地址 = 候选地址[Math.min(尝试序号, Math.max(候选地址.length - 1, 0))];
        try {
          const 预取缓存 = globalThis.__LWCS_MVU_RESOURCE_TEXT_PREFETCH_V1__;
          const 预取承诺 = 预取缓存?.[地址];
          if (预取承诺) {
            const 预取结果 = await 预取承诺;
            delete 预取缓存[地址];
            if (!预取结果?.ok) throw new Error(预取结果?.error || `[${预取结果?.status || 'prefetch_failed'}]`);
            代码文本 = 预取结果.text;
          } else {
            const 响应 = await MVU_FETCH_V1(地址);
            if (!响应.ok) throw new Error(`[${响应.status}]`);
            代码文本 = await 响应.text();
          }
          break;
        } catch (错误) {
          错误列表.push(`${地址} ${错误 && 错误.message ? 错误.message : String(错误 || 'unknown_error')}`);
        }
      }
      if (!代码文本) throw new Error(`MVU资源读取失败：${记录.relativePath} ${错误列表.join(' | ')}`);
      记录.phase = 'execute';
      记录.executionStarted = true;
      记录.executeCount += 1;
      const 文档 = globalThis.document;
      if (!文档 || !文档.createElement) throw new Error(`MVU资源执行缺少document：${记录.relativePath}`);
      const 脚本 = 文档.createElement('script');
      脚本.id = `lwcs-resource-owner-${记录.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
      脚本.text = `${代码文本}\n//# sourceURL=${地址}`;
      (文档.body || 文档.documentElement).appendChild(脚本);
      if (!(await Promise.resolve(就绪检查()))) throw new Error(`MVU资源未暴露预期接口：${记录.relativePath}`);
    } else if (模式 === 'dynamic-import') {
      地址 = 构建MVU候选资源地址列表_V1(文件名)[0];
      记录.phase = 'execute';
      记录.executionStarted = true;
      记录.executeCount += 1;
      模块 = await MVU请求超时_V1(import(地址), `导入 ${地址}`);
    } else {
      throw new Error(`MVU资源执行模式无效：${模式}`);
    }
    记录.status = 'loaded';
    记录.phase = 'complete';
    记录.url = 地址;
    记录.value = 模块;
    return Object.freeze({ key: 记录.key, commit: 记录.commit, relativePath: 记录.relativePath, mode: 模式, url: 地址, value: 模块, existing: false });
  }

  function loadResource(文件名, 选项 = {}) {
    const 相对路径 = 规范化MVU资源路径_V1(文件名);
    const 模式 = 选项.mode || 'script-global';
    if (!['script-global', 'dynamic-import'].includes(模式)) throw new Error(`MVU资源执行模式无效：${模式}`);
    const commit = String(选项.commit || 读取MVU资源提交_V1()).trim() || 'local';
    const key = canonicalKey(相对路径, commit);
    const 已有记录 = MVU资源所有者状态_V1.records.get(key);
    if (已有记录) {
      if (已有记录.mode !== 模式) throw new Error(`MVU资源执行模式冲突：${key}`);
      if (已有记录.status === 'loaded') return Promise.resolve(Object.freeze({ key, commit, relativePath: 相对路径, mode: 模式, url: 已有记录.url || '', value: 已有记录.value || null, existing: 已有记录.phase === 'existing' }));
      if (已有记录.promise) return 已有记录.promise;
      return Promise.reject(已有记录.error || new Error(`MVU资源已失败：${key}`));
    }
    const 记录 = {
      key,
      commit,
      relativePath: 相对路径,
      mode: 模式,
      status: 'loading',
      phase: 'fetch',
      fetchAttempts: 0,
      executeCount: 0,
      executionStarted: false,
      url: '',
      value: null,
      error: null,
      promise: null,
    };
    const 承诺 = 执行资源加载_V1(记录, 相对路径, 选项).catch(错误 => {
      记录.status = 'failed';
      记录.phase = 记录.executionStarted ? 'execute-failed' : 'fetch-failed';
      记录.error = 错误;
      throw 错误;
    });
    记录.promise = 承诺;
    MVU资源所有者状态_V1.records.set(key, 记录);
    return 承诺;
  }

  return Object.freeze({
    version: '1.0.0',
    owner: 'MVU_ZOD_Entry.js',
    canonicalKey,
    loadResource,
    getResourceState,
    getDiagnostics: () => Object.freeze(Array.from(MVU资源所有者状态_V1.records.values(), MVU资源状态快照_V1)),
  });
}

const MVU资源所有者_V1 = (() => {
  const 已有 = globalThis.__LWCS_MVU_RESOURCE_OWNER_V1__;
  const 所有者 = 已有 && 已有.version === '1.0.0' ? 已有 : 创建MVU资源所有者_V1();
  发布MVU资源所有者_V1(所有者);
  return 所有者;
})();

async function 导入MVU候选模块_V1(文件名) {
  const 结果 = await MVU资源所有者_V1.loadResource(文件名, { mode: 'dynamic-import' });
  return 结果.value;
}

const MVU数据源加载状态_V1 = globalThis.__LWCS_MVU_数据源加载状态__ || {
  时间线开始时间: 0,
  时间线完成时间: 0,
  时间线错误: '',
  情报开始时间: 0,
  情报完成时间: 0,
  情报错误: '',
};

function 同步MVU全局字段_V1(字段名, 字段值) {
  globalThis[字段名] = 字段值;
  try { if (globalThis.parent && globalThis.parent !== globalThis) globalThis.parent[字段名] = 字段值; } catch (错误) {}
  try { if (globalThis.top && globalThis.top !== globalThis) globalThis.top[字段名] = 字段值; } catch (错误) {}
}

同步MVU全局字段_V1('__LWCS_MVU_数据源加载状态__', MVU数据源加载状态_V1);

async function 加载MVU数据源模块_V1(文件名, 导出名, 开始字段, 完成字段, 错误字段) {
  MVU数据源加载状态_V1[开始字段] = Date.now();
  MVU数据源加载状态_V1[错误字段] = '';
  发布MVU模块状态_V1(文件名, 'loading', '下载并执行');
  try {
    const 模块 = await 导入MVU候选模块_V1(文件名);
    const 数据源 = 模块 && 模块[导出名] ? 模块[导出名] : {};
    同步MVU全局字段_V1(导出名, 数据源);
    MVU数据源加载状态_V1[完成字段] = Date.now();
    MVU数据源加载状态_V1[错误字段] = '';
    发布MVU模块状态_V1(文件名, 'loaded', '完成');
    return 数据源;
  } catch (错误) {
    const 错误文本 = 错误 && 错误.message ? 错误.message : String(错误 || 'unknown_error');
    MVU数据源加载状态_V1[错误字段] = 错误文本;
    发布MVU模块状态_V1(文件名, 'degraded', '降级', 错误文本);
    console.warn(`[LWCS] MVU数据源加载失败：${文件名}`, 错误);
    return {};
  }
}

async function 加载MVU经典依赖_V1(文件名, 已就绪 = () => false) {
  发布MVU模块状态_V1(文件名, 'loading', '下载中');
  发布MVU模块状态_V1(文件名, 'loading', '执行中');
  try {
    await MVU资源所有者_V1.loadResource(文件名, { mode: 'script-global', ready: 已就绪 });
    发布MVU模块状态_V1(文件名, 'loaded', '完成');
  } catch (错误) {
    发布MVU模块状态_V1(文件名, 'failed', '失败', 错误 && 错误.message ? 错误.message : String(错误 || 'unknown_error'));
    throw 错误;
  }
}

function 读取MVU共享全局值_V1(键名) {
  return MVU共享宿主窗口_V1[键名] ?? globalThis[键名] ?? null;
}

async function 确保库数据运行时_V1() {
  const 宿主 = MVU共享宿主窗口_V1;
  const 就绪 = 宿主.__LWCS_LIBRARY_DATA_RUNTIME_V1__ || globalThis.__LWCS_LIBRARY_DATA_RUNTIME_V1__;
  if (就绪 && 就绪.version === '2.0.0') {
    发布MVU模块状态_V1('LibraryData_Runtime.js', 'loaded', '已存在');
    return 就绪;
  }
  发布MVU模块状态_V1('LibraryData_Runtime.js', 'loading', '下载并执行');
  const 加载承诺 = MVU资源所有者_V1.loadResource('LibraryData_Runtime.js', {
    mode: 'script-global',
    ready: () => {
      const 运行时 = 宿主.__LWCS_LIBRARY_DATA_RUNTIME_V1__ || globalThis.__LWCS_LIBRARY_DATA_RUNTIME_V1__;
      return !!运行时 && 运行时.version === '2.0.0';
    },
  }).then(() => 宿主.__LWCS_LIBRARY_DATA_RUNTIME_V1__ || globalThis.__LWCS_LIBRARY_DATA_RUNTIME_V1__);
  宿主.__LWCS_LIBRARY_DATA_RUNTIME_LOADING_V1__ = 加载承诺;
  globalThis.__LWCS_LIBRARY_DATA_RUNTIME_LOADING_V1__ = 加载承诺;
  try {
    const 运行时 = await 加载承诺;
    发布MVU模块状态_V1('LibraryData_Runtime.js', 'loaded', '完成');
    return 运行时;
  } catch (错误) {
    if (宿主.__LWCS_LIBRARY_DATA_RUNTIME_LOADING_V1__ === 加载承诺) delete 宿主.__LWCS_LIBRARY_DATA_RUNTIME_LOADING_V1__;
    if (globalThis.__LWCS_LIBRARY_DATA_RUNTIME_LOADING_V1__ === 加载承诺) delete globalThis.__LWCS_LIBRARY_DATA_RUNTIME_LOADING_V1__;
    发布MVU模块状态_V1('LibraryData_Runtime.js', 'failed', '失败', 错误 && 错误.message ? 错误.message : String(错误 || 'unknown_error'));
    throw 错误;
  }
}

async function 读取MVU当前数据根_V1() {
  const 候选窗口 = [MVU共享宿主窗口_V1, globalThis].filter((窗口, 序号, 列表) => 窗口 && 列表.indexOf(窗口) === 序号);
  for (const 窗口 of 候选窗口) {
    try {
      const 接口 = 窗口.Mvu;
      if (!接口 || typeof 接口.getMvuData !== 'function') continue;
      const 变量包 = await Promise.resolve(接口.getMvuData({ type: 'message', message_id: 'latest' }));
      const 根 = 变量包?.stat_data && typeof 变量包.stat_data === 'object'
        ? 变量包.stat_data
        : 变量包?.display_data && typeof 变量包.display_data === 'object'
          ? 变量包.display_data
          : 变量包;
      if (根 && typeof 根 === 'object') return 根;
    } catch (错误) {}
  }
  return null;
}

async function 加载MVU当前时代核心资源_V1() {
  const 集成 = 读取MVU共享全局值_V1('__LWCS_ERA_RUNTIME_INTEGRATION_V1__');
  const 根 = await 读取MVU当前数据根_V1();
  let 当前tick = Number(根?.world?.时间?.tick);
  if (!Number.isFinite(当前tick) || 当前tick < 0) {
    const 注册表 = 读取MVU共享全局值_V1('__LWCS_ERA_DATA_REGISTRY_V1__');
    const 运行时 = 读取MVU共享全局值_V1('__LWCS_LIBRARY_DATA_RUNTIME_V1__');
    当前tick = Number(注册表?.getEraDataSource?.('current')?.startYear) * Number(运行时?.ticksPerYear);
  }
  if (!集成 || typeof 集成.ensureEraResourcesForTick !== 'function' || !Number.isFinite(当前tick) || 当前tick < 0) {
    throw new Error('MVU当前时代核心资源缺少有效时代上下文');
  }
  try {
    const 结果 = await 集成.ensureEraResourcesForTick(当前tick, ['character', 'item', 'faction', 'location'], {
      reason: 'mvu-core-consumer-demand',
      dataRoot: 根,
    });
    同步MVU全局字段_V1('__LWCS_MVU_CURRENT_ERA_RESOURCE_CONTEXT_V1__', 结果);
    return { status: 'ready', ...结果 };
  } catch (错误) {
    const 诊断 = { status: 'failed', reason: 错误?.message || String(错误 || 'era_resource_load_failed'), tick: 当前tick };
    同步MVU全局字段_V1('__LWCS_MVU_CURRENT_ERA_RESOURCE_CONTEXT_V1__', 诊断);
    console.warn('[LWCS] 当前时代资源未就绪：', 错误);
    throw 错误;
  }
}

if (typeof waitGlobalInitialized === 'function') await waitGlobalInitialized('Mvu');
if (typeof eventOn !== 'function') throw new Error('MVU_ZOD_Entry 需要酒馆助手 eventOn 接口');

await 确保库数据运行时_V1();
const MVU执行上下文库运行时_V1 = MVU共享宿主窗口_V1.__LWCS_LIBRARY_DATA_RUNTIME_V1__ || globalThis.__LWCS_LIBRARY_DATA_RUNTIME_V1__;
if (MVU执行上下文库运行时_V1) globalThis.__LWCS_LIBRARY_DATA_RUNTIME_V1__ = MVU执行上下文库运行时_V1;
await 加载MVU经典依赖_V1('EraDataRegistry.js', () => 读取MVU共享全局值_V1('__LWCS_ERA_DATA_REGISTRY_V1__')?.version === '1.1.0-era-resource-owner-20260822');
await 加载MVU经典依赖_V1('EraCurrencyRegistry.js', () => !!读取MVU共享全局值_V1('__LWCS_ERA_CURRENCY_REGISTRY_V1__'));
await 加载MVU经典依赖_V1('TimelineRuntime.js', () => 读取MVU共享全局值_V1('__LWCS_TIMELINE_RUNTIME_V1__')?.version === '1.0.0');
await 加载MVU经典依赖_V1('EraRuntime_Integration.js', () => {
  const 集成 = 读取MVU共享全局值_V1('__LWCS_ERA_RUNTIME_INTEGRATION_V1__');
  return !!集成 && 集成.version === '1.1.0-era-context-20260822' && typeof 集成.getCultivationBlend === 'function' && typeof 集成.getEraContext === 'function';
});
await 加载MVU经典依赖_V1('EraCultivation_Runtime.js', () => {
  const 修炼运行时 = 读取MVU共享全局值_V1('__LWCS_ERA_CULTIVATION_RUNTIME_V1__');
  return !!修炼运行时 && typeof 修炼运行时.settleMeditationSegment === 'function';
});
await 加载MVU当前时代核心资源_V1();
await 加载MVU数据源模块_V1('IntelEvents.js', 'IntelEvents', '情报开始时间', '情报完成时间', '情报错误');

await 加载MVU经典依赖_V1('MVU_Skill_Runtime.js', () =>
  typeof 角色穿搭上装待补全文案_V1 === 'string' &&
  typeof globalThis.__LWCS_INITIALIZE_SKILL_EFFECTS__ === 'function' &&
  typeof 创建空魂导器装配表_V1 === 'function' &&
  globalThis.__LWCS_SKILL_MECHANISM_REGISTRY__ &&
  typeof globalThis.__LWCS_SKILL_MECHANISM_REGISTRY__ === 'object' &&
  globalThis.__LWCS_PROFESSION_DERIVATION__ &&
  typeof globalThis.__LWCS_PROFESSION_DERIVATION__.派生运行时 === 'function' &&
  typeof globalThis.__LWCS_COMPILE_SKILL_STRUCTURE_TEXT__ === 'function' &&
  globalThis.__LWCS_SKILL_COST_HELPERS_V1__ &&
  typeof globalThis.__LWCS_SKILL_COST_HELPERS_V1__ === 'object' &&
  typeof globalThis.__LWCS_CALC_DIRECT_SETTLE_BUDGET__ === 'function' &&
  typeof globalThis.__LWCS_ASSERT_DIRECT_SETTLE_BUDGET__ === 'function' &&
  typeof globalThis.__LWCS_GET_BASE_STATS__ === 'function' &&
  typeof globalThis.__LWCS_CALC_ACTIVE_EQUIPMENT_BONUS__ === 'function'
);

await 加载MVU经典依赖_V1('MVU_Schema_Runtime.js', () =>
  typeof markPlayerCharacterInSchemaInput === 'function' &&
  typeof 规范化技能结构Schema_V1 === 'function' &&
  typeof 规范化装备Schema_V1 === 'function' &&
  typeof 规范化角色Schema_V1 === 'function' &&
  typeof 规范化Schema根转换_V1 === 'function'
);

await 加载MVU经典依赖_V1('MVU_Competition_Runtime.js', () =>
  globalThis.__LWCS_COMPETITION_PRIVILEGE_RUNTIME__ &&
  typeof globalThis.__LWCS_COMPETITION_PRIVILEGE_RUNTIME__.生成项目对局 === 'function' &&
  typeof globalThis.__LWCS_COMPETITION_PRIVILEGE_RUNTIME__.计算购买支付比例 === 'function'
);

await 加载MVU经典依赖_V1('MVU_Runtime_View.js', () => {
  const 运行时视图 = globalThis.__LWCS_MVU_RUNTIME_VIEW__;
  const 必需方法 = [
    '替换MVU运行时视图占位符',
    '生成MVU剧情视图',
    '生成MVU相互可见性视图',
    '生成场景背景角色补充',
    '生成场景候选角色资料',
    '生成场景审计材料',
    '生成角色基础六维对标摘要',
  ];
  const 错误状态 = globalThis.__LWCS_MVU_RUNTIME_VIEW_ERROR__;
  if (错误状态?.错误列表?.length) {
    throw new Error(`MVU运行时视图接口注册失败：${错误状态.错误列表.map(项目 => 项目.错误 || 'unknown_error').join('；')}`);
  }
  return !!运行时视图
    && typeof 运行时视图 === 'object'
    && 必需方法.every(方法名 => typeof 运行时视图[方法名] === 'function');
});

发布MVU模块状态_V1('MVU.js', 'loading', '下载并执行');
try {
  await 导入MVU候选模块_V1('MVU.js');
  发布MVU模块状态_V1('MVU.js', 'loaded', '完成');
} catch (错误) {
  发布MVU模块状态_V1('MVU.js', 'failed', '失败', 错误 && 错误.message ? 错误.message : String(错误 || 'unknown_error'));
  throw 错误;
}

globalThis.__LWCS_MVU变量结构已注册__ = true;
try { if (globalThis.parent && globalThis.parent !== globalThis) globalThis.parent.__LWCS_MVU变量结构已注册__ = true; } catch (错误) {}
try { if (globalThis.top && globalThis.top !== globalThis) globalThis.top.__LWCS_MVU变量结构已注册__ = true; } catch (错误) {}

await 加载MVU经典依赖_V1('MVU_Hooks.js', () =>
  typeof globalThis.__LWCS_NORMALIZE_MVU_STAT_DATA__ === 'function' &&
  typeof globalThis.__LWCS_NORMALIZE_JSON_PATCH_OPS__ === 'function' &&
  typeof globalThis.__LWCS_PREPROCESS_JSON_PATCH_TEXT__ === 'function'
);

同步MVU全局字段_V1('__LWCS_MVU_CORE_READY_V1__', true);
发布MVU模块状态_V1('MVU_ZOD_Entry.js', 'loaded', '完成');

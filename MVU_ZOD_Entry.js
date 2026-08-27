const MVU_ZOD_ENTRY_URL_V1 = new URL(import.meta.url);
const MVU_ZOD_ENTRY_BASE_V1 = new URL('./', MVU_ZOD_ENTRY_URL_V1);
const MVU_ZOD_RESOURCE_TIMEOUT_MS_V1 = 6500;
const MVU_ENGINE_BUNDLE_FILE_V1 = 'MVU_Engine_Bundle.js';
const MVU_FOUNDATION_BUNDLE_FILE_V1 = 'LWCS_MVU_Foundation_Bundle.js';
const MVU_SCHEMA_DATA_BUNDLE_FILE_V1 = 'LWCS_MVU_Schema_Data_Bundle.js';
const MVU_CRITICAL_PREFETCH_FILES_V1 = Object.freeze([
  MVU_FOUNDATION_BUNDLE_FILE_V1,
  MVU_SCHEMA_DATA_BUNDLE_FILE_V1,
  'MVU.js',
  'MVU_Zod_Bundle.js',
  'MVU_Hooks.js',
]);
const MVU_UI_PREFETCH_FILES_V1 = Object.freeze([
  'LWCS_UI_Runtime_Bundle.js',
  'LWCS_UI_Styles_Bundle.js',
  'Main_Vue_runtimefix_v2.js',
  'sheep_map_restore.js',
]);
const MVU_ENGINE_UPSTREAM_COMMIT_V1 = '0a730cd4a9b99689d1135a49b542c780b977c24c';
const MVU_ENGINE_BUNDLE_SHA256_V1 = '6c05357210551be8b827ee49c4d735b4f651ffdf33489aa1fbe2dfdf91fb8e69';
const MVU追踪模块顺序_V1 = Object.freeze([
  'MVU_ZOD_Entry.js',
  MVU_FOUNDATION_BUNDLE_FILE_V1,
  MVU_ENGINE_BUNDLE_FILE_V1,
  MVU_SCHEMA_DATA_BUNDLE_FILE_V1,
  'MVU.js',
  'MVU_Hooks.js',
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
const MVU入口片段参数_V1 = new URLSearchParams(MVU_ZOD_ENTRY_URL_V1.hash.replace(/^#/, ''));
function 读取MVU入口参数_V1(名称) {
  return MVU_ZOD_ENTRY_URL_V1.searchParams.get(名称) ?? MVU入口片段参数_V1.get(名称);
}
const MVU入口启动代号_V1 = (() => {
  const 原值 = 读取MVU入口参数_V1('lwcs_generation');
  const 参数值 = Number(原值);
  return 原值 !== null && 原值 !== '' && Number.isFinite(参数值)
    ? 参数值
    : Number(MVU共享启动状态_V1.mvuGeneration) || 0;
})();
const MVU入口尝试代号_V1 = String(读取MVU入口参数_V1('lwcs_attempt') || '');
const MVU加载诊断起点_V1 = performance.now();
const MVU加载诊断_V1 = {
  version: '1.0.0',
  generation: MVU入口启动代号_V1,
  attempt: MVU入口尝试代号_V1,
  records: [],
  resources: [],
};
function 记录MVU加载阶段_V1(阶段, 详情 = {}) {
  const 记录 = {
    阶段: String(阶段 || 'unknown'),
    经过毫秒: Number((performance.now() - MVU加载诊断起点_V1).toFixed(2)),
    ...详情,
  };
  MVU加载诊断_V1.records.push(记录);
  console.info(`[LWCS][MVU加载诊断] ${JSON.stringify(记录)}`);
  return 记录;
}
function 输出MVU加载诊断_V1() {
  MVU加载诊断_V1.resources = performance.getEntriesByType('resource')
    .filter(项目 => /\/(?:MVU|LWCS_(?:MVU|Era))[^/?#]*\.js(?:[?#]|$)/i.test(String(项目.name || '')))
    .map(项目 => ({
      地址: 项目.name,
      耗时毫秒: Number(项目.duration.toFixed(2)),
      响应等待毫秒: Number((项目.responseStart - 项目.startTime).toFixed(2)),
      传输字节: Number(项目.transferSize) || 0,
    }));
  console.info(`[LWCS][MVU加载诊断汇总] ${JSON.stringify(MVU加载诊断_V1)}`);
  return MVU加载诊断_V1;
}
globalThis.__LWCS_MVU_LOAD_TRACE_V1__ = MVU加载诊断_V1;
globalThis.__LWCS_MARK_MVU_LOAD_V1__ = 记录MVU加载阶段_V1;
globalThis.__LWCS_DUMP_MVU_LOAD_TRACE_V1__ = 输出MVU加载诊断_V1;
try {
  MVU共享宿主窗口_V1.__LWCS_MVU_LOAD_TRACE_V1__ = MVU加载诊断_V1;
  MVU共享宿主窗口_V1.__LWCS_DUMP_MVU_LOAD_TRACE_V1__ = 输出MVU加载诊断_V1;
} catch (_) {}
记录MVU加载阶段_V1('entry:module-start', { 入口地址: MVU_ZOD_ENTRY_URL_V1.href });
function 是当前MVU启动轮次_V1() {
  return Number(MVU共享宿主窗口_V1.__LWCS_MVU_ACTIVE_GENERATION_V1__) === MVU入口启动代号_V1
    && (!MVU入口尝试代号_V1 || MVU共享宿主窗口_V1.__LWCS_MVU_ACTIVE_ENTRY_ATTEMPT_V1__ === MVU入口尝试代号_V1);
}
if (!是当前MVU启动轮次_V1()) throw new Error(`MVU入口已过期：${MVU入口启动代号_V1}`);
if (MVU入口尝试代号_V1) MVU共享宿主窗口_V1.__LWCS_MVU_ENTRY_STARTED_ATTEMPT_V1__ = MVU入口尝试代号_V1;
let MVU核心就绪解决_V1;
let MVU核心就绪拒绝_V1;
const MVU核心就绪承诺_V1 = MVU共享宿主窗口_V1.__LWCS_MVU_CORE_READY_PROMISE_V1__ || new Promise((resolve, reject) => {
  MVU核心就绪解决_V1 = resolve;
  MVU核心就绪拒绝_V1 = reject;
});
MVU共享宿主窗口_V1.__LWCS_MVU_CORE_READY_PROMISE_V1__ = MVU核心就绪承诺_V1;
void MVU核心就绪承诺_V1.catch(() => {});
if (MVU核心就绪解决_V1) {
  MVU共享宿主窗口_V1.__LWCS_MVU_CORE_READY_RESOLVE_V1__ = MVU核心就绪解决_V1;
  MVU共享宿主窗口_V1.__LWCS_MVU_CORE_READY_REJECT_V1__ = MVU核心就绪拒绝_V1;
}
const MVU本轮核心就绪解决_V1 = MVU共享宿主窗口_V1.__LWCS_MVU_CORE_READY_RESOLVE_V1__ || MVU核心就绪解决_V1;
const MVU本轮核心就绪拒绝_V1 = MVU共享宿主窗口_V1.__LWCS_MVU_CORE_READY_REJECT_V1__ || MVU核心就绪拒绝_V1;
const MVU项目引擎状态_V1 = (() => {
  const 键 = '__LWCS_MVU_ENGINE_STATE_V1__';
  const 已有状态 = MVU共享宿主窗口_V1[键];
  if (已有状态 && 已有状态.version === '1.0.0') {
    try { globalThis[键] = 已有状态; } catch (_) {}
    return 已有状态;
  }
  const 新状态 = {
    version: '1.0.0',
    status: 'idle',
    phase: '等待',
    upstreamCommit: MVU_ENGINE_UPSTREAM_COMMIT_V1,
    bundleFile: MVU_ENGINE_BUNDLE_FILE_V1,
    bundleSha256: MVU_ENGINE_BUNDLE_SHA256_V1,
    url: '',
    error: '',
    loadPromise: null,
  };
  MVU共享宿主窗口_V1[键] = 新状态;
  try { globalThis[键] = 新状态; } catch (_) {}
  return 新状态;
})();

function 发布MVU模块状态_V1(名称, 状态, 阶段, 错误 = '') {
  if (!是当前MVU启动轮次_V1()) return;
  MVU共享启动状态_V1.mvuHeartbeatAt = Date.now();
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
  const 候选原值 = globalThis.__LWCS_MVU_资源基础地址候选列表__
    || MVU共享宿主窗口_V1.__LWCS_MVU_资源基础地址候选列表__
    || MVU共享启动状态_V1.resourceBases;
  const 候选列表 = Array.isArray(候选原值) ? 候选原值 : [];
  const 清理地址 = 地址 => {
    const 文本 = String(地址 || '').trim();
    if (!文本) return '';
    return 文本.endsWith('/') ? 文本 : `${文本}/`;
  };
  return [MVU_ZOD_ENTRY_BASE_V1.href, ...候选列表.map(清理地址)].filter((地址, 序号, 列表) => 地址 && 列表.indexOf(地址) === 序号);
})();
const MVU共享预取_V1 = MVU共享宿主窗口_V1.__LWCS_PREFETCH_SHARED_TEXT_V1__;
if (typeof MVU共享预取_V1 === 'function') {
  void MVU共享预取_V1(
    [...MVU_CRITICAL_PREFETCH_FILES_V1, ...MVU_UI_PREFETCH_FILES_V1]
      .map(文件名 => new URL(文件名, MVU_ZOD_ENTRY_BASE_CANDIDATES_V1[0]).href),
    读取MVU资源提交_V1(),
  ).catch(() => {});
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
      const 错误 = new Error(`${标签} 超时:${超时毫秒}ms`);
      错误.code = 'LWCS_RESOURCE_TIMEOUT';
      结束(false, 错误);
    }, 超时毫秒);
    Promise.resolve(承诺).then(
      结果 => 结束(true, 结果),
      错误 => 结束(false, 错误),
    );
  });
}

function 加载MVU经典脚本_V1(地址, 节点ID) {
  return new Promise((resolve, reject) => {
    const 文档 = globalThis.document;
    if (!文档 || !文档.createElement) {
      reject(new Error(`MVU资源执行缺少document：${地址}`));
      return;
    }
    const 脚本 = 文档.createElement('script');
    let 已完成 = false;
    const 完成 = (成功, 结果) => {
      if (已完成) return;
      已完成 = true;
      clearTimeout(超时器);
      脚本.onload = null;
      脚本.onerror = null;
      if (成功) resolve(地址);
      else {
        try { 脚本.remove(); } catch (错误) {}
        reject(结果 instanceof Error ? 结果 : new Error(`MVU资源加载失败：${地址}`));
      }
    };
    const 超时器 = setTimeout(() => {
      const 错误 = new Error(`MVU资源加载超时:${MVU_ZOD_RESOURCE_TIMEOUT_MS_V1}ms ${地址}`);
      错误.code = 'LWCS_RESOURCE_TIMEOUT';
      完成(false, 错误);
    }, MVU_ZOD_RESOURCE_TIMEOUT_MS_V1);
    脚本.id = 节点ID;
    脚本.async = false;
    脚本.src = 地址;
    脚本.onload = () => 完成(true, 地址);
    脚本.onerror = () => 完成(false, new Error(`MVU资源加载失败：${地址}`));
    (文档.head || 文档.documentElement).appendChild(脚本);
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
  const 会话键 = `${读取MVU资源提交_V1()}:${MVU入口启动代号_V1}`;
  const 旧状态 = globalThis[键];
  if (旧状态 && 旧状态.version === '1.0.0' && 旧状态.sessionKey === 会话键
    && typeof 旧状态.records?.get === 'function' && typeof 旧状态.records?.set === 'function') return 旧状态;
  const 新状态 = { version: '1.0.0', sessionKey: 会话键, records: new Map() };
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
      const 错误列表 = [];
      while (记录.fetchAttempts < 候选地址.length) {
        const 尝试序号 = 记录.fetchAttempts;
        记录.fetchAttempts += 1;
        地址 = 候选地址[Math.min(尝试序号, Math.max(候选地址.length - 1, 0))];
        const 加载开始时刻 = performance.now();
        记录MVU加载阶段_V1('script-load:start', {
          文件: 记录.relativePath,
          地址,
          尝试: 记录.fetchAttempts,
        });
        try {
          记录.phase = 'execute';
          记录.executionStarted = true;
          记录.executeCount += 1;
          await 加载MVU经典脚本_V1(
            地址,
            `lwcs-resource-owner-${记录.key.replace(/[^a-zA-Z0-9_-]/g, '-')}-${尝试序号}`,
          );
          记录MVU加载阶段_V1('script-load:resolved', {
            文件: 记录.relativePath,
            地址,
            尝试: 记录.fetchAttempts,
            本次耗时毫秒: Number((performance.now() - 加载开始时刻).toFixed(2)),
          });
          break;
        } catch (错误) {
          记录MVU加载阶段_V1('script-load:failed', {
            文件: 记录.relativePath,
            地址,
            尝试: 记录.fetchAttempts,
            本次耗时毫秒: Number((performance.now() - 加载开始时刻).toFixed(2)),
            错误: 错误?.message || String(错误 || 'unknown_error'),
          });
          记录.executionStarted = false;
          错误列表.push(`${地址} ${错误 && 错误.message ? 错误.message : String(错误 || 'unknown_error')}`);
        }
      }
      if (!地址 || 错误列表.length === 候选地址.length) {
        throw new Error(`MVU资源加载失败：${记录.relativePath} ${错误列表.join(' | ')}`);
      }
      if (!(await Promise.resolve(就绪检查()))) throw new Error(`MVU资源未暴露预期接口：${记录.relativePath}`);
    } else if (模式 === 'dynamic-import') {
      const 候选地址 = 构建MVU候选资源地址列表_V1(文件名);
      const 错误列表 = [];
      for (const 候选地址项 of 候选地址) {
        地址 = 候选地址项;
        记录.fetchAttempts += 1;
        记录.phase = 'execute';
        记录.executionStarted = true;
        记录.executeCount += 1;
        const 导入开始时刻 = performance.now();
        记录MVU加载阶段_V1('dynamic-import:start', {
          文件: 记录.relativePath,
          地址,
          尝试: 记录.fetchAttempts,
        });
        try {
          模块 = await MVU请求超时_V1(import(地址), `导入 ${地址}`, 120000);
          记录MVU加载阶段_V1('dynamic-import:resolved', {
            文件: 记录.relativePath,
            地址,
            尝试: 记录.fetchAttempts,
            本次耗时毫秒: Number((performance.now() - 导入开始时刻).toFixed(2)),
          });
          break;
        } catch (错误) {
          记录MVU加载阶段_V1('dynamic-import:failed', {
            文件: 记录.relativePath,
            地址,
            尝试: 记录.fetchAttempts,
            本次耗时毫秒: Number((performance.now() - 导入开始时刻).toFixed(2)),
            错误: 错误?.message || String(错误 || 'unknown_error'),
          });
          if (错误?.code === 'LWCS_RESOURCE_TIMEOUT') throw 错误;
          错误列表.push(`${地址} ${错误 && 错误.message ? 错误.message : String(错误 || 'unknown_error')}`);
        }
      }
      if (!模块) throw new Error(`MVU模块导入失败：${记录.relativePath} ${错误列表.join(' | ')}`);
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
      if (已有记录.status === 'failed') {
        if (模式 !== 'dynamic-import' && 已有记录.executionStarted)
          return Promise.reject(已有记录.error || new Error(`MVU资源执行失败，禁止重复执行：${key}`));
        MVU资源所有者状态_V1.records.delete(key);
      }
      else if (已有记录.promise) return 已有记录.promise;
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
    sessionKey: MVU资源所有者状态_V1.sessionKey,
    owner: 'MVU_ZOD_Entry.js',
    canonicalKey,
    loadResource,
    getResourceState,
    getDiagnostics: () => Object.freeze(Array.from(MVU资源所有者状态_V1.records.values(), MVU资源状态快照_V1)),
  });
}

const MVU资源所有者_V1 = (() => {
  const 已有 = globalThis.__LWCS_MVU_RESOURCE_OWNER_V1__;
  const 所有者 = 已有 && 已有.version === '1.0.0' && 已有.sessionKey === MVU资源所有者状态_V1.sessionKey
    ? 已有
    : 创建MVU资源所有者_V1();
  发布MVU资源所有者_V1(所有者);
  return 所有者;
})();

function 取MVU引擎窗口_V1() {
  const 窗口列表 = [globalThis, MVU共享宿主窗口_V1];
  try { if (globalThis.top && !窗口列表.includes(globalThis.top)) 窗口列表.push(globalThis.top); } catch (_) {}
  return 窗口列表.filter((窗口, 序号, 列表) => 窗口 && 列表.indexOf(窗口) === 序号);
}

function 取已有MVU引擎_V1() {
  return 取MVU引擎窗口_V1().map(窗口 => 窗口.Mvu).find(接口 =>
    接口 && 接口.__LWCS_MVU_ENGINE_OWNER_V1__?.owner === 'lwcs-controlled-magvarupdate'
  ) || null;
}

function 取已有外部MVU_V1() {
  return 取MVU引擎窗口_V1().map(窗口 => 窗口.Mvu).find(Boolean) || null;
}

async function 确保项目MVU引擎_V1() {
  const 已有项目引擎 = 取已有MVU引擎_V1();
  if (已有项目引擎) {
    MVU项目引擎状态_V1.status = 'ready';
    MVU项目引擎状态_V1.phase = '已存在';
    发布MVU模块状态_V1(MVU_ENGINE_BUNDLE_FILE_V1, 'loaded', '已存在');
    return 已有项目引擎;
  }
  const 已有外部引擎 = 取已有外部MVU_V1();
  if (已有外部引擎) {
    MVU项目引擎状态_V1.status = 'failed';
    MVU项目引擎状态_V1.phase = '拒绝重复注册';
    MVU项目引擎状态_V1.error = '检测到未由LWCS控制的Mvu实例';
    发布MVU模块状态_V1(MVU_ENGINE_BUNDLE_FILE_V1, 'failed', '拒绝重复注册', MVU项目引擎状态_V1.error);
    throw new Error('LWCS MVU引擎拒绝与外部Mvu实例重复注册');
  }
  if (MVU项目引擎状态_V1.loadPromise) {
    const 进行中承诺 = MVU项目引擎状态_V1.loadPromise;
    发布MVU模块状态_V1(MVU_ENGINE_BUNDLE_FILE_V1, 'loading', '复用进行中的导入');
    try {
      const 结果 = await 进行中承诺;
      发布MVU模块状态_V1(MVU_ENGINE_BUNDLE_FILE_V1, 'loaded', '复用完成');
      return 结果;
    } catch (错误) {
      发布MVU模块状态_V1(MVU_ENGINE_BUNDLE_FILE_V1, 'failed', '复用导入失败', 错误?.message || String(错误));
      throw 错误;
    }
  }

  MVU项目引擎状态_V1.status = 'loading';
  MVU项目引擎状态_V1.phase = '导入固定bundle';
  MVU项目引擎状态_V1.error = '';
  发布MVU模块状态_V1(MVU_ENGINE_BUNDLE_FILE_V1, 'loading', '加载并执行');
  const 加载承诺 = 导入MVU候选模块_V1(MVU_ENGINE_BUNDLE_FILE_V1)
    .then(结果 => {
      if (MVU项目引擎状态_V1.loadPromise === 加载承诺) {
        MVU项目引擎状态_V1.status = 'loaded';
        MVU项目引擎状态_V1.phase = 'bundle已执行，等待Mvu';
        MVU项目引擎状态_V1.url = 结果?.url || '';
      }
      发布MVU模块状态_V1(MVU_ENGINE_BUNDLE_FILE_V1, 'loaded', '完成');
      return 结果;
    })
    .catch(错误 => {
      const 错误文本 = 错误 && 错误.message ? 错误.message : String(错误 || 'unknown_error');
      if (MVU项目引擎状态_V1.loadPromise === 加载承诺) {
        MVU项目引擎状态_V1.status = 'failed';
        MVU项目引擎状态_V1.phase = '导入失败';
        MVU项目引擎状态_V1.error = 错误文本;
        MVU项目引擎状态_V1.loadPromise = null;
      }
      发布MVU模块状态_V1(MVU_ENGINE_BUNDLE_FILE_V1, 'failed', '导入失败', 错误文本);
      throw 错误;
    });
  MVU项目引擎状态_V1.loadPromise = 加载承诺;
  return await 加载承诺;
}

async function 导入MVU候选模块_V1(文件名) {
  const 结果 = await MVU资源所有者_V1.loadResource(文件名, { mode: 'dynamic-import' });
  return 结果.value;
}

function 同步MVU全局字段_V1(字段名, 字段值) {
  globalThis[字段名] = 字段值;
  try { if (globalThis.parent && globalThis.parent !== globalThis) globalThis.parent[字段名] = 字段值; } catch (错误) {}
  try { if (globalThis.top && globalThis.top !== globalThis) globalThis.top[字段名] = 字段值; } catch (错误) {}
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

async function 确保MVU基础依赖_V1() {
  await 加载MVU经典依赖_V1(MVU_FOUNDATION_BUNDLE_FILE_V1, () => {
    const 适配器 = 读取MVU共享全局值_V1('__LWCS_PERSISTENCE_ADAPTER_V1__');
    const 提供者 = 读取MVU共享全局值_V1('__LWCS_MVU_PERSISTENCE_PROVIDER_V1__');
    const 集成 = 读取MVU共享全局值_V1('__LWCS_ERA_RUNTIME_INTEGRATION_V1__');
    const 修炼运行时 = 读取MVU共享全局值_V1('__LWCS_ERA_CULTIVATION_RUNTIME_V1__');
    return !!适配器
      && typeof 适配器.openSession === 'function'
      && typeof 适配器.registerBackend === 'function'
      && !!提供者
      && typeof 提供者.open === 'function'
      && typeof 读取MVU共享全局值_V1('__LWCS_MVU_PROMPT_PROJECTOR_V1__') === 'function'
      && 读取MVU共享全局值_V1('__LWCS_LIBRARY_DATA_RUNTIME_V1__')?.version === '2.0.0'
      && 读取MVU共享全局值_V1('__LWCS_ERA_DATA_REGISTRY_V1__')?.version === '1.1.0-era-resource-owner-20260822'
      && !!读取MVU共享全局值_V1('__LWCS_ERA_CURRENCY_REGISTRY_V1__')
      && 读取MVU共享全局值_V1('__LWCS_TIMELINE_RUNTIME_V1__')?.version === '1.0.0'
      && 集成?.version === '1.1.0-era-context-20260822'
      && typeof 集成.getCultivationBlend === 'function'
      && typeof 集成.getEraContext === 'function'
      && typeof 修炼运行时?.settleMeditationSegment === 'function';
  });
}

function 读取MVU共享全局值_V1(键名) {
  return MVU共享宿主窗口_V1[键名] ?? globalThis[键名] ?? null;
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
  记录MVU加载阶段_V1('era-context:data-root-start');
  const 根 = await 读取MVU当前数据根_V1();
  记录MVU加载阶段_V1('era-context:data-root-resolved');
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
    记录MVU加载阶段_V1('era-resources:ensure-start', { tick: 当前tick });
    const 结果 = await 集成.ensureEraResourcesForTick(当前tick, ['character', 'item', 'faction', 'location', 'timeline'], {
      reason: 'mvu-core-consumer-demand',
      dataRoot: 根,
    });
    记录MVU加载阶段_V1('era-resources:ensure-resolved', { tick: 当前tick, 时代: 结果?.resourceEra || '' });
    同步MVU全局字段_V1('__LWCS_MVU_CURRENT_ERA_RESOURCE_CONTEXT_V1__', 结果);
    return { status: 'ready', ...结果 };
  } catch (错误) {
    const 诊断 = { status: 'failed', reason: 错误?.message || String(错误 || 'era_resource_load_failed'), tick: 当前tick };
    同步MVU全局字段_V1('__LWCS_MVU_CURRENT_ERA_RESOURCE_CONTEXT_V1__', 诊断);
    console.warn('[LWCS] 当前时代资源未就绪：', 错误);
    throw 错误;
  }
}

if (typeof eventOn !== 'function') throw new Error('MVU_ZOD_Entry 需要酒馆助手 eventOn 接口');
记录MVU加载阶段_V1('foundation-and-engine:await-start');
await Promise.all([确保MVU基础依赖_V1(), 确保项目MVU引擎_V1()]);
记录MVU加载阶段_V1('foundation-and-engine:await-resolved');
if (typeof waitGlobalInitialized === 'function') {
  记录MVU加载阶段_V1('mvu-global:await-start');
  await waitGlobalInitialized('Mvu');
  记录MVU加载阶段_V1('mvu-global:await-resolved');
}
const MVU执行上下文库运行时_V1 = 读取MVU共享全局值_V1('__LWCS_LIBRARY_DATA_RUNTIME_V1__');
if (MVU执行上下文库运行时_V1) globalThis.__LWCS_LIBRARY_DATA_RUNTIME_V1__ = MVU执行上下文库运行时_V1;
const MVU时代资源加载承诺_V1 = 加载MVU当前时代核心资源_V1();
const MVUSchema数据加载承诺_V1 = 加载MVU经典依赖_V1(MVU_SCHEMA_DATA_BUNDLE_FILE_V1, () =>
  Array.isArray(读取MVU共享全局值_V1('IntelEvents')) &&
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
  typeof globalThis.__LWCS_CALC_ACTIVE_EQUIPMENT_BONUS__ === 'function' &&
  typeof markPlayerCharacterInSchemaInput === 'function' &&
  typeof 规范化技能结构Schema_V1 === 'function' &&
  typeof 规范化装备Schema_V1 === 'function' &&
  typeof 规范化角色Schema_V1 === 'function' &&
  typeof 规范化Schema根转换_V1 === 'function' &&
  globalThis.__LWCS_COMPETITION_PRIVILEGE_RUNTIME__ &&
  typeof globalThis.__LWCS_COMPETITION_PRIVILEGE_RUNTIME__.生成项目对局 === 'function' &&
  typeof globalThis.__LWCS_COMPETITION_PRIVILEGE_RUNTIME__.计算购买支付比例 === 'function' &&
  (() => {
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
  })()
);
await Promise.all([MVU时代资源加载承诺_V1, MVUSchema数据加载承诺_V1]);

发布MVU模块状态_V1('MVU.js', 'loading', '加载并执行');
记录MVU加载阶段_V1('mvu-import:await-start');
try {
  await 导入MVU候选模块_V1('MVU.js');
  记录MVU加载阶段_V1('mvu-import:await-resolved');
  输出MVU加载诊断_V1();
  发布MVU模块状态_V1('MVU.js', 'loaded', '完成');
} catch (错误) {
  记录MVU加载阶段_V1('mvu-import:await-failed', { 错误: 错误?.message || String(错误 || 'unknown_error') });
  输出MVU加载诊断_V1();
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

const 集成_V1 = 读取MVU共享全局值_V1('__LWCS_ERA_RUNTIME_INTEGRATION_V1__');
const 竞争_V1 = 读取MVU共享全局值_V1('__LWCS_COMPETITION_PRIVILEGE_RUNTIME__');
const 必需接口_V1 = [
  ['eventOn', typeof eventOn === 'function'],
  ['Mvu', typeof 读取MVU共享全局值_V1('Mvu')?.getMvuData === 'function'],
  ['PersistenceAdapter', typeof 读取MVU共享全局值_V1('__LWCS_PERSISTENCE_ADAPTER_V1__')?.openSession === 'function'],
  ['PersistenceProvider', typeof 读取MVU共享全局值_V1('__LWCS_MVU_PERSISTENCE_PROVIDER_V1__')?.open === 'function'],
  ['PromptProjector', typeof 读取MVU共享全局值_V1('__LWCS_MVU_PROMPT_PROJECTOR_V1__') === 'function'],
  ['LibraryData', 读取MVU共享全局值_V1('__LWCS_LIBRARY_DATA_RUNTIME_V1__')?.version === '2.0.0'],
  ['EraDataRegistry', !!读取MVU共享全局值_V1('__LWCS_ERA_DATA_REGISTRY_V1__')],
  ['EraCurrencyRegistry', !!读取MVU共享全局值_V1('__LWCS_ERA_CURRENCY_REGISTRY_V1__')],
  ['TimelineRuntime', !!读取MVU共享全局值_V1('__LWCS_TIMELINE_RUNTIME_V1__')],
  ['EraIntegration', !!集成_V1 && typeof 集成_V1.getEraContext === 'function' && typeof 集成_V1.ensureEraResourcesForTick === 'function'],
  ['EraCultivation', typeof 读取MVU共享全局值_V1('__LWCS_ERA_CULTIVATION_RUNTIME_V1__')?.settleMeditationSegment === 'function'],
  ['SkillRuntime', !!读取MVU共享全局值_V1('__LWCS_SKILL_MECHANISM_REGISTRY__') && typeof globalThis.__LWCS_COMPILE_SKILL_STRUCTURE_TEXT__ === 'function'],
  ['SchemaRuntime', typeof markPlayerCharacterInSchemaInput === 'function' && typeof 规范化角色Schema_V1 === 'function'],
  ['CompetitionRuntime', !!竞争_V1 && typeof 竞争_V1.生成项目对局 === 'function'],
  ['RuntimeView', !!读取MVU共享全局值_V1('__LWCS_MVU_RUNTIME_VIEW__')],
  ['MvuRegistered', globalThis.__LWCS_MVU变量结构已注册__ === true],
  ['MvuHooks', typeof globalThis.__LWCS_NORMALIZE_MVU_STAT_DATA__ === 'function' && typeof globalThis.__LWCS_NORMALIZE_JSON_PATCH_OPS__ === 'function'],
];
const MVU核心接口缺失_V1 = 必需接口_V1.filter(([, 已就绪]) => !已就绪).map(([名称]) => 名称);
const MVU核心契约_V1 = Object.freeze({
  version: '1.0.0',
  ready: MVU核心接口缺失_V1.length === 0,
  missing: Object.freeze(MVU核心接口缺失_V1),
});
if (!是当前MVU启动轮次_V1()) throw new Error(`MVU入口完成时已过期：${MVU入口启动代号_V1}`);
同步MVU全局字段_V1('__LWCS_MVU_CORE_CONTRACT_V1__', MVU核心契约_V1);
if (!MVU核心契约_V1.ready) {
  const 错误 = new Error(`MVU核心接口缺失：${MVU核心接口缺失_V1.join('、')}`);
  MVU共享启动状态_V1.mvuStatus = 'failed';
  MVU共享启动状态_V1.mvuStartedAt = 0;
  MVU本轮核心就绪拒绝_V1?.(错误);
  throw 错误;
}
同步MVU全局字段_V1('__LWCS_MVU_CORE_READY_V1__', true);
发布MVU模块状态_V1('MVU_ZOD_Entry.js', 'loaded', '完成');
MVU共享启动状态_V1.mvuStatus = 'ready';
MVU共享启动状态_V1.mvuStartedAt = 0;
MVU本轮核心就绪解决_V1?.(MVU核心契约_V1);

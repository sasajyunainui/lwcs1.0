const 仓库名 = 'sasajyunainui/lwcs1.0';
const 分支名 = 'master';
const CDN地址列表 = Object.freeze([
  'https://testingcf.jsdelivr.net',
  'https://cdn.jsdelivr.net',
  'https://gcore.jsdelivr.net',
  'https://fastly.jsdelivr.net',
]);
const 请求超时毫秒 = 6500;
const GitHub请求超时毫秒 = 8000;
const 回退提交哈希 = 'cba6eba9442e445cde7a0365b06837e0c9ab5c7f';
const 入口文件名 = 'MVU_ZOD_Entry.js';
const MVU追踪模块顺序 = Object.freeze([入口文件名]);
async function 取最新提交哈希() {
  const 接口地址 = `https://api.github.com/repos/${仓库名}/git/ref/heads/${分支名}?t=${Date.now()}`;
  const 响应 = await withTimeout(fetch(接口地址, {
    cache: 'no-store',
    headers: { Accept: 'application/vnd.github+json' },
  }), `读取 ${接口地址}`, GitHub请求超时毫秒);
  if (!响应.ok) throw new Error(`GitHub 最新提交读取失败: ${响应.status}`);
  const 数据 = await 响应.json();
  const 提交哈希 = String(数据 && 数据.object && 数据.object.sha ? 数据.object.sha : '').trim();
  if (!/^[0-9a-f]{40}$/i.test(提交哈希)) throw new Error('GitHub 最新提交格式异常');
  return 提交哈希;
}

function withTimeout(承诺, 标签, 超时毫秒 = 请求超时毫秒, 超时回调 = null) {
  return new Promise((resolve, reject) => {
    const 超时器 = setTimeout(() => {
      try {
        if (typeof 超时回调 === 'function') 超时回调();
      } catch (错误) {}
      reject(new Error(`${标签} 超时:${超时毫秒}ms`));
    }, 超时毫秒);
    Promise.resolve(承诺).then(
      值 => {
        clearTimeout(超时器);
        resolve(值);
      },
      错误 => {
        clearTimeout(超时器);
        reject(错误);
      },
    );
  });
}

function 加载模块脚本入口(入口地址, 入口尝试代号) {
  const 执行承诺 = import(入口地址);
  void 执行承诺.catch(() => {});
  const 开始承诺 = new Promise((resolve, reject) => {
    let 已完成 = false;
    const 完成 = 结果 => {
      if (已完成) return;
      已完成 = true;
      clearTimeout(超时器);
      clearInterval(启动检查器);
      if (结果 === true) resolve(入口地址);
      else reject(结果 instanceof Error ? 结果 : new Error(`入口脚本加载失败: ${入口地址}`));
    };
    const 超时器 = setTimeout(() => {
      const 错误 = new Error(`入口脚本启动超时:${请求超时毫秒}ms ${入口地址}`);
      错误.code = 'LWCS_MODULE_ENTRY_TIMEOUT';
      完成(错误);
    }, 请求超时毫秒);
    const 启动检查器 = setInterval(() => {
      if (共享宿主窗口.__LWCS_MVU_ENTRY_STARTED_ATTEMPT_V1__ === 入口尝试代号) 完成(true);
    }, 25);
    执行承诺.then(
      () => 完成(true),
      错误 => 完成(共享宿主窗口.__LWCS_MVU_ENTRY_STARTED_ATTEMPT_V1__ === 入口尝试代号 ? true : 错误),
    );
  });
  return Object.freeze({ 开始承诺, 执行承诺 });
}

const 共享宿主窗口 = (() => {
  try {
    if (globalThis.parent && globalThis.parent !== globalThis && globalThis.parent.document) return globalThis.parent;
  } catch (错误) {}
  return globalThis;
})();
const 共享启动状态 = (() => {
  const 键 = '__LWCS_REMOTE_BOOTSTRAP_STATE__';
  const 已有状态 = 共享宿主窗口[键];
  if (已有状态 && typeof 已有状态 === 'object') return 已有状态;
  const 新状态 = {
    commitPromise: null,
    commit: '',
    resourceBases: [],
    mvuStatus: 'idle',
    mvuStage: '等待 MVU 引导',
    mvuModules: [],
    mvuTrackingComplete: false,
    uiStatus: 'idle',
  };
  共享宿主窗口[键] = 新状态;
  return 新状态;
})();
if (!Array.isArray(共享启动状态.mvuModules)) 共享启动状态.mvuModules = [];
if (typeof 共享启动状态.mvuStage !== 'string') 共享启动状态.mvuStage = '等待 MVU 引导';
if (typeof 共享启动状态.mvuTrackingComplete !== 'boolean') 共享启动状态.mvuTrackingComplete = false;
const 已有共享文本请求表 = 共享宿主窗口.__LWCS_SHARED_TEXT_REQUESTS_V1__;
const 共享文本请求表 = 已有共享文本请求表
  && typeof 已有共享文本请求表.get === 'function'
  && typeof 已有共享文本请求表.set === 'function'
  && typeof 已有共享文本请求表.has === 'function'
  && typeof 已有共享文本请求表.delete === 'function'
  ? 已有共享文本请求表
  : new Map();
共享宿主窗口.__LWCS_SHARED_TEXT_REQUESTS_V1__ = 共享文本请求表;
const 读取共享文本 = 共享宿主窗口.__LWCS_READ_SHARED_TEXT_V1__ || ((地址, 选项 = {}, 超时毫秒 = 请求超时毫秒, 提交哈希 = '') => {
  const 请求键 = `${提交哈希 || 'local'}:${地址}`;
  if (!共享文本请求表.has(请求键)) {
    const 请求承诺 = withTimeout(fetch(地址, 选项), `读取 ${地址}`, 超时毫秒)
      .then(async 响应 => {
        if (!响应.ok) throw new Error(`[${响应.status}] ${地址}`);
        return await withTimeout(响应.text(), `读取 ${地址}`, Math.max(20000, 超时毫秒));
      })
      .catch(错误 => {
        if (共享文本请求表.get(请求键) === 请求承诺) 共享文本请求表.delete(请求键);
        throw 错误;
      });
    共享文本请求表.set(请求键, 请求承诺);
  }
  return 共享文本请求表.get(请求键);
});
共享宿主窗口.__LWCS_READ_SHARED_TEXT_V1__ = 读取共享文本;
const 已有预取状态 = 共享宿主窗口.__LWCS_SHARED_PREFETCH_STATE_V1__;
const 共享预取状态 = 已有预取状态 && Array.isArray(已有预取状态.queue)
  ? 已有预取状态
  : { queue: [], active: 0 };
if (!Number.isFinite(共享预取状态.active) || 共享预取状态.active < 0) 共享预取状态.active = 0;
共享宿主窗口.__LWCS_SHARED_PREFETCH_STATE_V1__ = 共享预取状态;
const 预取共享文本 = 共享宿主窗口.__LWCS_PREFETCH_SHARED_TEXT_V1__ || ((地址列表, 提交哈希 = '') => {
  const 任务承诺列表 = [...new Set(地址列表 || [])].map(地址 => new Promise(resolve => {
    共享预取状态.queue.push({ 地址, 提交哈希, resolve });
  }));
  const 继续预取 = () => {
    while (共享预取状态.active < 4 && 共享预取状态.queue.length) {
      const 任务 = 共享预取状态.queue.shift();
      共享预取状态.active += 1;
      Promise.resolve().then(() => 读取共享文本(任务.地址, { cache: 'force-cache' }, 请求超时毫秒, 任务.提交哈希))
        .catch(() => null)
        .finally(() => {
          共享预取状态.active -= 1;
          任务.resolve();
          继续预取();
        });
    }
  };
  继续预取();
  return Promise.all(任务承诺列表);
});
共享宿主窗口.__LWCS_PREFETCH_SHARED_TEXT_V1__ = 预取共享文本;

function MVU加载所有者仍存活() {
  const 所有者窗口 = 共享启动状态.mvuOwnerWindow;
  const 所有者文档 = 共享启动状态.mvuOwnerDocument;
  if (!所有者窗口 || !所有者文档) return false;
  try {
    if (所有者窗口.document !== 所有者文档) return false;
    return 所有者文档 === globalThis.document || !!所有者窗口.frameElement?.isConnected;
  } catch (错误) {
    return false;
  }
}

function 失效MVU共享核心状态() {
  共享启动状态.mvuStatus = 'idle';
  共享启动状态.mvuStartedAt = 0;
  共享启动状态.mvuHeartbeatAt = 0;
  共享启动状态.mvuOwnerWindow = null;
  共享启动状态.mvuOwnerDocument = null;
  共享启动状态.mvuOwnerToken = '';
  共享启动状态.mvuGeneration = (Number(共享启动状态.mvuGeneration) || 0) + 1;
  共享宿主窗口.__LWCS_MVU_ACTIVE_GENERATION_V1__ = 共享启动状态.mvuGeneration;
  delete 共享宿主窗口.__LWCS_MVU_CORE_READY_PROMISE_V1__;
  delete 共享宿主窗口.__LWCS_MVU_CORE_READY_RESOLVE_V1__;
  delete 共享宿主窗口.__LWCS_MVU_CORE_READY_REJECT_V1__;
  delete 共享宿主窗口.__LWCS_MVU_CORE_CONTRACT_V1__;
  delete 共享宿主窗口.__LWCS_MVU_CORE_READY_V1__;
}

async function 等待旧MVU所有者释放() {
  if (!['loading', 'ready'].includes(共享启动状态.mvuStatus)) return;
  const 旧所有者窗口 = 共享启动状态.mvuOwnerWindow;
  const 旧所有者文档 = 共享启动状态.mvuOwnerDocument;
  const 旧所有者代号 = 共享启动状态.mvuOwnerToken;
  if (旧所有者文档 === globalThis.document) return;
  if (!旧所有者窗口) {
    失效MVU共享核心状态();
    return;
  }

  const 截止时间 = Date.now() + 请求超时毫秒;
  if (!旧所有者文档) {
    if (旧所有者窗口 === globalThis) {
      失效MVU共享核心状态();
      return;
    }
    while (
      共享启动状态.mvuOwnerWindow === 旧所有者窗口
      && 共享启动状态.mvuOwnerToken === 旧所有者代号
      && ['loading', 'ready'].includes(共享启动状态.mvuStatus)
    ) {
      let 旧框架仍连接 = false;
      try { 旧框架仍连接 = !!旧所有者窗口.frameElement?.isConnected; } catch (错误) {}
      if (!旧框架仍连接) break;
      if (Date.now() >= 截止时间) {
        throw new Error(`等待旧MVU所有者释放超时:${请求超时毫秒}ms`);
      }
      await new Promise(继续 => setTimeout(继续, 16));
    }
    if (
      共享启动状态.mvuOwnerWindow === 旧所有者窗口
      && 共享启动状态.mvuOwnerToken === 旧所有者代号
    ) 失效MVU共享核心状态();
    return;
  }
  if (!MVU加载所有者仍存活()) {
    失效MVU共享核心状态();
    return;
  }
  while (
    共享启动状态.mvuOwnerWindow === 旧所有者窗口
    && 共享启动状态.mvuOwnerDocument === 旧所有者文档
    && 共享启动状态.mvuOwnerToken === 旧所有者代号
    && ['loading', 'ready'].includes(共享启动状态.mvuStatus)
    && MVU加载所有者仍存活()
  ) {
    if (Date.now() >= 截止时间) {
      throw new Error(`等待旧MVU所有者释放超时:${请求超时毫秒}ms`);
    }
    await new Promise(继续 => setTimeout(继续, 16));
  }
}

await 等待旧MVU所有者释放();

const MVU加载开始时间 = Math.max(Number(共享启动状态.mvuStartedAt) || 0, Number(共享启动状态.mvuHeartbeatAt) || 0);
const MVU加载已陈旧 = 共享启动状态.mvuStatus === 'loading'
  && (!MVU加载所有者仍存活() || !Number.isFinite(MVU加载开始时间) || Date.now() - MVU加载开始时间 > 240000);
const 核心状态已失效 = MVU加载已陈旧 || 共享启动状态.mvuStatus === 'failed'
  || (共享启动状态.mvuStatus === 'ready' && (
    共享宿主窗口.__LWCS_MVU_CORE_CONTRACT_V1__?.ready !== true
    || !共享启动状态.mvuOwnerToken
    || !MVU加载所有者仍存活()
  ));
if (核心状态已失效) {
  失效MVU共享核心状态();
}
let 解决核心就绪;
let 拒绝核心就绪;
const 核心就绪承诺 = 共享宿主窗口.__LWCS_MVU_CORE_READY_PROMISE_V1__ || new Promise((resolve, reject) => {
  解决核心就绪 = resolve;
  拒绝核心就绪 = reject;
});
共享宿主窗口.__LWCS_MVU_CORE_READY_PROMISE_V1__ = 核心就绪承诺;
void 核心就绪承诺.catch(() => {});
if (解决核心就绪) {
  共享宿主窗口.__LWCS_MVU_CORE_READY_RESOLVE_V1__ = 解决核心就绪;
  共享宿主窗口.__LWCS_MVU_CORE_READY_REJECT_V1__ = 拒绝核心就绪;
}

function 更新MVU入口追踪(状态, 阶段, 错误 = '') {
  const 原顺序 = 共享启动状态.mvuModules.map(项目 => 项目.名称);
  const 追踪顺序 = 原顺序.length ? 原顺序 : MVU追踪模块顺序;
  const 状态表 = new Map(共享启动状态.mvuModules.map(项目 => [项目.名称, { ...项目 }]));
  if (!状态表.size) {
    MVU追踪模块顺序.forEach(名称 => {
      状态表.set(名称, { 名称, 状态: 'pending', 阶段: '等待', 错误: '' });
    });
  }
  状态表.set(入口文件名, { 名称: 入口文件名, 状态, 阶段, 错误 });
  共享启动状态.mvuStage = 阶段;
  共享启动状态.mvuModules = [入口文件名, ...追踪顺序.filter(名称 => 名称 !== 入口文件名)].map(名称 =>
    状态表.get(名称) || { 名称, 状态: 'pending', 阶段: '等待', 错误: '' }
  );
  共享启动状态.mvuTrackingComplete = 共享启动状态.mvuModules.every(项目 =>
    ['loaded', 'degraded', 'failed'].includes(项目.状态)
  );
  try {
    共享宿主窗口.__LWCS_加载追踪器__?.更新MVU快照?.({
      阶段,
      模块列表: 共享启动状态.mvuModules,
      全部完成: 共享启动状态.mvuTrackingComplete,
    });
  } catch (追踪错误) {}
}

async function 取共享最新提交哈希(启动代号) {
  if (共享启动状态.commitGeneration === 启动代号 && 共享启动状态.commit) {
    return 共享启动状态.commit;
  }
  if (!共享启动状态.commitPromise || 共享启动状态.commitPromiseGeneration !== 启动代号) {
    const 提交承诺 = 取最新提交哈希()
      .then(提交哈希 => {
        if (共享宿主窗口.__LWCS_MVU_ACTIVE_GENERATION_V1__ === 启动代号) {
          共享启动状态.commit = 提交哈希;
          共享启动状态.commitGeneration = 启动代号;
        }
        return 提交哈希;
      })
      .catch(错误 => {
        console.warn('[LWCS MVU Bootstrap] GitHub 最新提交读取失败，改用正式回退提交。', 错误);
        if (共享宿主窗口.__LWCS_MVU_ACTIVE_GENERATION_V1__ === 启动代号) {
          共享启动状态.commit = 回退提交哈希;
          共享启动状态.commitGeneration = 启动代号;
        }
        return 回退提交哈希;
      })
      .finally(() => {
        if (共享启动状态.commitPromise === 提交承诺) {
          共享启动状态.commitPromise = null;
          共享启动状态.commitPromiseGeneration = 0;
        }
      });
    共享启动状态.commitPromise = 提交承诺;
    共享启动状态.commitPromiseGeneration = 启动代号;
  }
  return await 共享启动状态.commitPromise;
}

if (共享启动状态.mvuStatus !== 'loading' && 共享启动状态.mvuStatus !== 'ready') {
  const 本轮启动代号 = (Number(共享启动状态.mvuGeneration) || 0) + 1;
  const 本轮所有者代号 = `${本轮启动代号}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const 本轮核心就绪承诺 = 核心就绪承诺;
  const 本轮核心拒绝 = 共享宿主窗口.__LWCS_MVU_CORE_READY_REJECT_V1__ || 拒绝核心就绪;
  共享启动状态.mvuGeneration = 本轮启动代号;
  共享宿主窗口.__LWCS_MVU_ACTIVE_GENERATION_V1__ = 本轮启动代号;
  共享启动状态.mvuStatus = 'loading';
  共享启动状态.mvuOwnerWindow = globalThis;
  共享启动状态.mvuOwnerDocument = globalThis.document;
  共享启动状态.mvuOwnerToken = 本轮所有者代号;
  共享启动状态.mvuStartedAt = Date.now();
  共享启动状态.mvuHeartbeatAt = 共享启动状态.mvuStartedAt;
  更新MVU入口追踪('loading', '加载并执行');
  try {
    globalThis.addEventListener('pagehide', () => {
      if (共享启动状态.mvuOwnerToken !== 本轮所有者代号) return;
      失效MVU共享核心状态();
    }, { once: true });
  } catch (错误) {}
  try {
    const 最新提交哈希 = await 取共享最新提交哈希(本轮启动代号);
    const 错误列表 = [];
    let 已加载 = false;
    let 入口执行承诺 = null;

    for (const [CDN序号, CDN地址] of CDN地址列表.entries()) {
      const 资源基础地址 = `${CDN地址}/gh/${仓库名}@${最新提交哈希}/`;
      try {
        const 资源基础地址候选列表 = CDN地址列表.map(候选CDN地址 => `${候选CDN地址}/gh/${仓库名}@${最新提交哈希}/`);
        globalThis.__LWCS_MVU_资源基础地址__ = 资源基础地址;
        globalThis.__LWCS_MVU_资源基础地址候选列表__ = 资源基础地址候选列表;
        globalThis.__LWCS_MVU_当前远程提交__ = 最新提交哈希;
        共享启动状态.resourceBases = [...资源基础地址候选列表];
        try {
          if (globalThis.parent && globalThis.parent !== globalThis) {
            globalThis.parent.__LWCS_MVU_资源基础地址__ = 资源基础地址;
            globalThis.parent.__LWCS_MVU_资源基础地址候选列表__ = 资源基础地址候选列表;
            globalThis.parent.__LWCS_MVU_当前远程提交__ = 最新提交哈希;
          }
        } catch (错误) {}
        try {
          if (globalThis.top && globalThis.top !== globalThis) {
            globalThis.top.__LWCS_MVU_资源基础地址__ = 资源基础地址;
            globalThis.top.__LWCS_MVU_资源基础地址候选列表__ = 资源基础地址候选列表;
            globalThis.top.__LWCS_MVU_当前远程提交__ = 最新提交哈希;
          }
        } catch (错误) {}

        const 入口尝试代号 = `${本轮启动代号}:${CDN序号}`;
        共享宿主窗口.__LWCS_MVU_ACTIVE_ENTRY_ATTEMPT_V1__ = 入口尝试代号;
        const 入口地址 = `${资源基础地址}${入口文件名}#lwcs_generation=${本轮启动代号}&lwcs_attempt=${入口尝试代号}`;
        const 文档 = globalThis.document;
        if (文档?.createElement) {
          for (const 预载项 of [
            { id: 'lwcs-mvu-project-runtime-preload', rel: 'preload', as: 'script', file: 'LWCS_MVU_Project_Runtime_Bundle.js' },
            { id: 'lwcs-mvu-schema-modulepreload', rel: 'modulepreload', file: 'MVU.js' },
            { id: 'lwcs-mvu-engine-modulepreload', rel: 'modulepreload', file: 'MVU_Engine_Bundle.js' },
          ]) {
            const 预载地址 = `${资源基础地址}${预载项.file}`;
            let 预载节点 = 文档.getElementById(预载项.id);
            if (预载节点 && 预载节点.href !== 预载地址) {
              预载节点.remove();
              预载节点 = null;
            }
            if (!预载节点) {
              预载节点 = 文档.createElement('link');
              预载节点.id = 预载项.id;
              预载节点.rel = 预载项.rel;
              if (预载项.as) 预载节点.as = 预载项.as;
              预载节点.href = 预载地址;
              if (预载项.rel === 'modulepreload') 预载节点.crossOrigin = 'anonymous';
              (文档.head || 文档.documentElement).appendChild(预载节点);
            }
          }
        }
        const 入口加载 = 加载模块脚本入口(入口地址, 入口尝试代号);
        await 入口加载.开始承诺;
        入口执行承诺 = 入口加载.执行承诺;
        已加载 = true;
        break;
      } catch (错误) {
        错误列表.push(`${CDN地址}: ${错误 && 错误.message ? 错误.message : String(错误 || 'unknown_error')}`);
      }
    }
    if (!已加载) throw new Error(`LWCS MVU 入口 CDN 全部失败: ${错误列表.join(' | ')}`);
    await withTimeout(Promise.race([
      本轮核心就绪承诺,
      入口执行承诺.then(() => 本轮核心就绪承诺),
    ]), '等待 MVU 核心接口契约', 30000);
    if (共享宿主窗口.__LWCS_MVU_ACTIVE_GENERATION_V1__ !== 本轮启动代号) {
      throw new Error(`MVU启动轮次已过期：${本轮启动代号}`);
    }
    共享启动状态.mvuStatus = 'ready';
    共享启动状态.mvuStartedAt = 0;
    共享启动状态.mvuHeartbeatAt = 0;
    更新MVU入口追踪('loaded', '完成');
  } catch (错误) {
    const 错误文本 = 错误 && 错误.message ? 错误.message : String(错误 || 'unknown_error');
    try { 本轮核心拒绝?.(错误); } catch (拒绝错误) {}
    if (共享宿主窗口.__LWCS_MVU_ACTIVE_GENERATION_V1__ === 本轮启动代号) {
      共享启动状态.mvuStatus = 'failed';
      共享启动状态.mvuStartedAt = 0;
      共享启动状态.mvuHeartbeatAt = 0;
      共享启动状态.mvuOwnerWindow = null;
      共享启动状态.mvuOwnerDocument = null;
      共享启动状态.mvuOwnerToken = '';
      更新MVU入口追踪('failed', '失败', 错误文本);
      共享启动状态.mvuGeneration = 本轮启动代号 + 1;
      共享宿主窗口.__LWCS_MVU_ACTIVE_GENERATION_V1__ = 共享启动状态.mvuGeneration;
    }
    throw 错误;
  }
}

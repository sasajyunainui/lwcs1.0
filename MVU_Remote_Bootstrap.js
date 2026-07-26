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
const 入口文件名 = 'MVU_ZOD_Entry.js';
const MVU追踪模块顺序 = Object.freeze([
  'MVU_ZOD_Entry.js',
  'MVU_Skill_Runtime.js',
  'MVU_Schema_Runtime.js',
  'MVU_Competition_Runtime.js',
  'MVU_Runtime_View.js',
  'MVU.js',
  'MVU_Hooks.js',
  'timeline.js',
  'IntelEvents.js',
]);
const 启动预取资源列表 = Object.freeze([
  'MVU_Skill_Runtime.js',
  'MVU_Schema_Runtime.js',
  'MVU_Competition_Runtime.js',
  'MVU_Runtime_View.js',
  'MVU.js',
  'MVU_Hooks.js',
  'timeline.js',
  'IntelEvents.js',
]);

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

function 预取关键资源(资源基础地址) {
  const 文档 = globalThis.document;
  if (!文档 || !文档.createElement) return;
  启动预取资源列表.forEach(文件名 => {
    const 地址 = `${资源基础地址}${文件名}`;
    const 标记 = 'lwcs-mvu-prefetch-' + btoa(地址).replace(/[^a-zA-Z0-9]/g, '');
    if (文档.getElementById(标记)) return;
    const 节点 = 文档.createElement('link');
    节点.id = 标记;
    节点.rel = 'prefetch';
    节点.href = 地址;
    节点.as = 'script';
    节点.crossOrigin = 'anonymous';
    (文档.head || 文档.documentElement).appendChild(节点);
  });
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

function 加载模块脚本入口(入口地址) {
  return new Promise((resolve, reject) => {
    const 文档 = globalThis.document;
    if (!文档 || !文档.createElement) {
      reject(new Error(`入口脚本加载缺少document: ${入口地址}`));
      return;
    }
    const 脚本 = 文档.createElement('script');
    let 已完成 = false;
    const 完成 = 结果 => {
      if (已完成) return;
      已完成 = true;
      clearTimeout(超时器);
      if (结果 === true) resolve(入口地址);
      else reject(结果 instanceof Error ? 结果 : new Error(`入口脚本加载失败: ${入口地址}`));
    };
    const 超时器 = setTimeout(() => {
      try {
        脚本.remove();
      } catch (错误) {}
      完成(new Error(`入口脚本加载超时:${请求超时毫秒}ms ${入口地址}`));
    }, 请求超时毫秒);
    脚本.type = 'module';
    脚本.src = 入口地址;
    脚本.onload = () => 完成(true);
    脚本.onerror = () => 完成(new Error(`入口脚本加载失败: ${入口地址}`));
    (文档.head || 文档.documentElement).appendChild(脚本);
  });
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

function 更新MVU入口追踪(状态, 阶段, 错误 = '') {
  const 状态表 = new Map(共享启动状态.mvuModules.map(项目 => [项目.名称, { ...项目 }]));
  if (!状态表.size) {
    MVU追踪模块顺序.forEach(名称 => {
      状态表.set(名称, { 名称, 状态: 'pending', 阶段: '等待', 错误: '' });
    });
  }
  状态表.set(入口文件名, { 名称: 入口文件名, 状态, 阶段, 错误 });
  共享启动状态.mvuStage = 阶段;
  共享启动状态.mvuModules = MVU追踪模块顺序.map(名称 =>
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

async function 取共享最新提交哈希() {
  if (共享启动状态.commit) return 共享启动状态.commit;
  if (!共享启动状态.commitPromise) {
    共享启动状态.commitPromise = 取最新提交哈希()
      .then(提交哈希 => {
        共享启动状态.commit = 提交哈希;
        共享启动状态.commitPromise = null;
        return 提交哈希;
      })
      .catch(错误 => {
        共享启动状态.commitPromise = null;
        throw 错误;
      });
  }
  return await 共享启动状态.commitPromise;
}

共享启动状态.mvuStatus = 'loading';
更新MVU入口追踪('loading', '下载并执行');
try {
  const 最新提交哈希 = await 取共享最新提交哈希();
  const 错误列表 = [];
  let 已加载 = false;

  for (const CDN地址 of CDN地址列表) {
    const 资源基础地址 = `${CDN地址}/gh/${仓库名}@${最新提交哈希}/`;
    try {
      const 资源基础地址候选列表 = CDN地址列表.map(候选CDN地址 => `${候选CDN地址}/gh/${仓库名}@${最新提交哈希}/`);
      globalThis.__LWCS_MVU_资源基础地址__ = 资源基础地址;
      globalThis.__LWCS_MVU_资源基础地址候选列表__ = 资源基础地址候选列表;
      globalThis.__LWCS_MVU_当前远程提交__ = 最新提交哈希;
      共享启动状态.resourceBases = 资源基础地址候选列表;
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

      const 入口地址 = `${资源基础地址}${入口文件名}`;
      try {
        await withTimeout(import(入口地址), `导入 ${入口地址}`);
      } catch (导入错误) {
        await 加载模块脚本入口(入口地址);
      }
      预取关键资源(资源基础地址);
      已加载 = true;
      break;
    } catch (错误) {
      错误列表.push(`${CDN地址}: ${错误 && 错误.message ? 错误.message : String(错误 || 'unknown_error')}`);
    }
  }
  if (!已加载) throw new Error(`LWCS MVU 入口 CDN 全部失败: ${错误列表.join(' | ')}`);
  共享启动状态.mvuStatus = 'ready';
  更新MVU入口追踪('loaded', '完成');
} catch (错误) {
  共享启动状态.mvuStatus = 'failed';
  更新MVU入口追踪('failed', '失败', 错误 && 错误.message ? 错误.message : String(错误 || 'unknown_error'));
  throw 错误;
}

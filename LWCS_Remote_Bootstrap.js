!(function () {
  'use strict';

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
  const 入口文件名 = 'ST_UI_Entry.js';
  const 启动预取资源列表 = Object.freeze([
    'mvu_styles.css',
    'soul_ring_engine.css',
    'Main_Vue_runtimefix_v2.js',
    'CharacterLibrary.js',
    'ItemLibrary.js',
    'mvu_logic_bridge.js',
    'LWCS_Database_Adapter.js',
    'RequestMonitorWidget.js',
    'Database_Module.js',
    'BattleUI_Module.js',
    'CompetitionPrivilegeUI_Module.js',
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
  const 引导键 = '__LWCS_REMOTE_BOOTSTRAP_RUNNING__';
  const 宿主窗口 = (() => {
    try {
      if (window.parent && window.parent !== window && window.parent.document) return window.parent;
    } catch (错误) {}
    return window;
  })();
  const 宿主文档 = 宿主窗口.document;

  if (宿主窗口[引导键]) return;
  宿主窗口[引导键] = true;

  function 构建资源基础地址(CDN地址, 提交哈希) {
    return `${CDN地址}/gh/${仓库名}@${提交哈希}/`;
  }

  function 构建资源基础地址候选列表(首选地址, 提交哈希) {
    const 候选列表 = [首选地址, ...CDN地址列表.map(CDN地址 => 构建资源基础地址(CDN地址, 提交哈希))];
    return 候选列表.filter((地址, 序号) => 地址 && 候选列表.indexOf(地址) === 序号);
  }

  function 预取关键资源(资源基础地址) {
    if (!宿主文档 || !宿主文档.createElement) return;
    启动预取资源列表.forEach(文件名 => {
      const 地址 = `${资源基础地址}${文件名}`;
      const 标记 = 'lwcs-prefetch-' + btoa(地址).replace(/[^a-zA-Z0-9]/g, '');
      if (宿主文档.getElementById(标记)) return;
      const 节点 = 宿主文档.createElement('link');
      节点.id = 标记;
      节点.rel = 'prefetch';
      节点.href = 地址;
      节点.as = /\.css(?:[?#]|$)/i.test(地址) ? 'style' : 'script';
      节点.crossOrigin = 'anonymous';
      (宿主文档.head || 宿主文档.documentElement).appendChild(节点);
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

  function fetchWithTimeout(地址, 选项) {
    const 请求选项 = { ...(选项 || {}) };
    let 控制器 = null;
    if (typeof AbortController === 'function') {
      控制器 = new AbortController();
      请求选项.signal = 控制器.signal;
    }
    return withTimeout(fetch(地址, 请求选项), `读取 ${地址}`, 请求超时毫秒, () => {
      if (控制器) 控制器.abort();
    });
  }

  function 加载脚本入口(入口地址) {
    return new Promise((resolve, reject) => {
      const 脚本 = 宿主文档.createElement('script');
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
      脚本.async = false;
      脚本.src = 入口地址;
      脚本.onload = () => 完成(true);
      脚本.onerror = () => 完成(new Error(`入口脚本加载失败: ${入口地址}`));
      (宿主文档.head || 宿主文档.documentElement).appendChild(脚本);
    });
  }

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

  async function 加载正式入口(提交哈希) {
    const 错误列表 = [];
    for (const CDN地址 of CDN地址列表) {
      const 资源基础地址 = 构建资源基础地址(CDN地址, 提交哈希);
      try {
        const 入口地址 = `${资源基础地址}${入口文件名}`;
        const 资源基础地址候选列表 = 构建资源基础地址候选列表(资源基础地址, 提交哈希);
        宿主窗口.__LWCS_资源基础地址__ = 资源基础地址;
        宿主窗口.__LWCS_资源基础地址候选列表__ = 资源基础地址候选列表;
        宿主窗口.__LWCS_当前远程提交__ = 提交哈希;
        try {
          if (window !== 宿主窗口) {
            window.__LWCS_资源基础地址__ = 资源基础地址;
            window.__LWCS_资源基础地址候选列表__ = 资源基础地址候选列表;
            window.__LWCS_当前远程提交__ = 提交哈希;
          }
        } catch (错误) {}

        预取关键资源(资源基础地址);
        try {
          const 响应 = await fetchWithTimeout(入口地址, { cache: 'force-cache' });
          if (!响应.ok) throw new Error(`入口读取失败:${响应.status}`);
          const 入口代码 = await 响应.text();
          const 执行入口 = new Function(`${入口代码}\n//# sourceURL=${入口地址}`);
          执行入口();
        } catch (读取错误) {
          await 加载脚本入口(入口地址);
        }
        return;
      } catch (错误) {
        错误列表.push(`${CDN地址}: ${错误 && 错误.message ? 错误.message : String(错误 || 'unknown_error')}`);
      }
    }
    throw new Error(`LWCS 入口 CDN 全部失败: ${错误列表.join(' | ')}`);
  }

  async function 启动远程入口() {
    try {
      const 提交哈希 = await 取最新提交哈希();
      await 加载正式入口(提交哈希);
    } catch (错误) {
      console.error('[LWCS] 远程入口加载失败:', 错误);
    } finally {
      宿主窗口[引导键] = false;
    }
  }

  启动远程入口();
})();

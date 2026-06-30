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
  const 请求超时毫秒 = 6000;
  const 入口文件名 = 'ST_UI_Entry.js';
  const 启动预取资源列表 = Object.freeze([
    'mvu_styles.css',
    'soul_ring_engine.css',
    'Main_Vue_runtimefix_v2.js',
    'CharacterLibrary.js',
    'ItemLibrary.js',
    'mvu_logic_bridge.js',
    'LWCS_Database_Adapter.js',
    'Database_Module.js',
    'BattleUI_Module.js',
    'MVU_ZOD_Entry.js',
    'MVU_Skill_Runtime.js',
    'MVU_Schema_Runtime.js',
    'MVU_Runtime_View.js',
    'MVU.js',
    'MVU_Hooks.js',
    'timeline.js',
    'IntelEvents.js',
  ]);
  const 核心探测资源列表 = Object.freeze([
    入口文件名,
    'mvu_styles.css',
    'soul_ring_engine.css',
    'Main_Vue_runtimefix_v2.js',
    'CharacterLibrary.js',
    'ItemLibrary.js',
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

  function 预取关键资源(资源基础地址) {
    启动预取资源列表.forEach(文件名 => {
      fetch(`${资源基础地址}${文件名}`, { cache: 'force-cache' }).catch(() => {});
    });
  }

  function fetchWithTimeout(地址, 选项) {
    if (typeof AbortController === 'undefined') return fetch(地址, 选项);
    const 控制器 = new AbortController();
    const 超时器 = setTimeout(() => 控制器.abort(), 请求超时毫秒);
    return fetch(地址, { ...选项, signal: 控制器.signal }).finally(() => clearTimeout(超时器));
  }

  async function 取最新提交哈希() {
    const 接口地址 = `https://api.github.com/repos/${仓库名}/git/ref/heads/${分支名}?t=${Date.now()}`;
    const 响应 = await fetch(接口地址, {
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json' },
    });
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
        const 响应 = await fetchWithTimeout(入口地址, { cache: 'force-cache' });
        if (!响应.ok) throw new Error(`入口读取失败:${响应.status}`);
        const 入口代码 = await 响应.text();
        await Promise.all(核心探测资源列表.filter(文件名 => 文件名 !== 入口文件名).map(async 文件名 => {
          const 探测响应 = await fetchWithTimeout(`${资源基础地址}${文件名}`, { cache: 'force-cache' });
          if (!探测响应.ok) throw new Error(`${文件名}:${探测响应.status}`);
        }));

        宿主窗口.__LWCS_资源基础地址__ = 资源基础地址;
        宿主窗口.__LWCS_当前远程提交__ = 提交哈希;
        try {
          if (window !== 宿主窗口) {
            window.__LWCS_资源基础地址__ = 资源基础地址;
            window.__LWCS_当前远程提交__ = 提交哈希;
          }
        } catch (错误) {}

        预取关键资源(资源基础地址);
        const 执行入口 = new Function(`${入口代码}\n//# sourceURL=${入口地址}`);
        执行入口();
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

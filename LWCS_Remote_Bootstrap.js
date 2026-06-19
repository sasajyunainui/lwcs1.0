!(function () {
  'use strict';

  const 仓库名 = 'sasajyunainui/lwcs1.0';
  const 分支名 = 'master';
  const CDN地址 = 'https://testingcf.jsdelivr.net';
  const 入口文件名 = 'ST_UI_Entry.js';
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

  function 构建资源基础地址(提交哈希) {
    return `${CDN地址}/gh/${仓库名}@${提交哈希}/`;
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
    const 资源基础地址 = 构建资源基础地址(提交哈希);
    const 入口地址 = `${资源基础地址}${入口文件名}`;
    const 响应 = await fetch(入口地址, { cache: 'no-store' });
    if (!响应.ok) throw new Error(`LWCS 入口读取失败: ${响应.status}`);
    const 入口代码 = await 响应.text();

    宿主窗口.__LWCS_资源基础地址__ = 资源基础地址;
    宿主窗口.__LWCS_当前远程提交__ = 提交哈希;
    try {
      if (window !== 宿主窗口) {
        window.__LWCS_资源基础地址__ = 资源基础地址;
        window.__LWCS_当前远程提交__ = 提交哈希;
      }
    } catch (错误) {}

    const 脚本节点 = 宿主文档.createElement('script');
    脚本节点.text = `${入口代码}\n//# sourceURL=${入口地址}`;
    (宿主文档.body || 宿主文档.documentElement).appendChild(脚本节点);
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

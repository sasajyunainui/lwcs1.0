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
    'mvu_logic_bridge.js',
    'LWCS_Database_Adapter.js',
    'LWCS_Persistence_Adapter.js',
    'Database_Module.js',
  ]);
  const 引导键 = '__LWCS_REMOTE_BOOTSTRAP_RUNNING__';
  const 宿主窗口 = (() => {
    try {
      if (window.parent && window.parent !== window && window.parent.document) return window.parent;
    } catch (错误) {}
    return window;
  })();
  const 宿主文档 = 宿主窗口.document;
  const 共享启动状态 = (() => {
    const 键 = '__LWCS_REMOTE_BOOTSTRAP_STATE__';
    const 已有状态 = 宿主窗口[键];
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
    宿主窗口[键] = 新状态;
    return 新状态;
  })();
  if (!Array.isArray(共享启动状态.mvuModules)) 共享启动状态.mvuModules = [];
  if (typeof 共享启动状态.mvuStage !== 'string') 共享启动状态.mvuStage = '等待 MVU 引导';
  if (typeof 共享启动状态.mvuTrackingComplete !== 'boolean') 共享启动状态.mvuTrackingComplete = false;

  if (共享启动状态.uiStatus === 'loading' || 共享启动状态.uiStatus === 'ready') return;
  if (宿主窗口[引导键]) return;
  宿主窗口[引导键] = true;

  const 加载追踪器 = (() => {
    const 面板ID = 'lwcs-script-load-tracker';
    const 样式ID = 'lwcs-script-load-tracker-style';
    let 会话ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const 状态 = {
      阶段: '远程引导启动',
      入口状态: 'pending',
      入口详情: '等待',
      入口错误: '',
      模块列表: [],
      模块完成: false,
      最近错误: '',
    };
    let 已手动关闭 = false;
    let 已自动隐藏 = false;
    let 待渲染计时器 = 0;

    function 转义文本(值) {
      return String(值 ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function 确保样式() {
      if (!宿主文档.head || 宿主文档.getElementById(样式ID)) return;
      const 样式节点 = 宿主文档.createElement('style');
      样式节点.id = 样式ID;
      样式节点.textContent = `
        #${面板ID} {
          position: fixed;
          top: 14px;
          right: 14px;
          z-index: 2147483000;
          width: min(320px, calc(100vw - 28px));
          overflow: hidden;
          border: 1px solid rgba(94, 216, 255, 0.28);
          border-radius: 8px;
          background: rgba(10, 17, 24, 0.96);
          color: #eaf7fb;
          box-shadow: 0 14px 38px rgba(0, 0, 0, 0.42);
          font: 12px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif;
          backdrop-filter: blur(10px);
          animation: lwcs-load-tracker-in 160ms ease-out;
        }
        #${面板ID}.is-complete { border-color: rgba(74, 222, 128, 0.34); }
        #${面板ID}.has-error { border-color: rgba(251, 113, 133, 0.48); }
        #${面板ID} .lwcs-load-head {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          padding: 10px 10px 8px;
          border-bottom: 1px solid rgba(148, 190, 204, 0.14);
        }
        #${面板ID} .lwcs-load-title {
          display: grid;
          gap: 2px;
          min-width: 0;
        }
        #${面板ID} .lwcs-load-title strong {
          overflow: hidden;
          color: #f4fbfd;
          font-size: 13px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        #${面板ID} .lwcs-load-title span {
          color: #91acb6;
          font-size: 10px;
        }
        #${面板ID} .lwcs-load-close {
          display: grid;
          place-items: center;
          width: 28px;
          height: 28px;
          padding: 0;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: #9db4bc;
          font-size: 18px;
          cursor: pointer;
        }
        #${面板ID} .lwcs-load-close:hover,
        #${面板ID} .lwcs-load-close:focus-visible {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
          outline: 1px solid rgba(94, 216, 255, 0.45);
        }
        #${面板ID} .lwcs-load-progress {
          height: 3px;
          overflow: hidden;
          background: rgba(148, 190, 204, 0.12);
        }
        #${面板ID} .lwcs-load-progress i {
          display: block;
          height: 100%;
          background: #4dd6ff;
          box-shadow: 0 0 10px rgba(77, 214, 255, 0.48);
          transition: width 180ms ease;
        }
        #${面板ID}.is-complete .lwcs-load-progress i {
          background: #4ade80;
          box-shadow: 0 0 10px rgba(74, 222, 128, 0.42);
        }
        #${面板ID} .lwcs-load-list {
          display: grid;
          max-height: min(310px, calc(100vh - 120px));
          overflow-x: hidden;
          overflow-y: auto;
          overscroll-behavior: contain;
          scrollbar-width: thin;
        }
        #${面板ID} .lwcs-load-row {
          display: grid;
          grid-template-columns: 9px minmax(0, 1fr) auto;
          align-items: center;
          gap: 8px;
          min-height: 28px;
          padding: 5px 10px;
          border-bottom: 1px solid rgba(148, 190, 204, 0.08);
        }
        #${面板ID} .lwcs-load-row:last-child { border-bottom: 0; }
        #${面板ID} .lwcs-load-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #53656c;
        }
        #${面板ID} .lwcs-load-name {
          min-width: 0;
          overflow: hidden;
          color: #dcecf1;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        #${面板ID} .lwcs-load-state {
          color: #829ba5;
          font-size: 10px;
          white-space: nowrap;
        }
        #${面板ID} .lwcs-load-row[data-state="loading"] .lwcs-load-dot {
          background: #4dd6ff;
          box-shadow: 0 0 8px rgba(77, 214, 255, 0.68);
          animation: lwcs-load-dot-pulse 900ms ease-in-out infinite;
        }
        #${面板ID} .lwcs-load-row[data-state="loaded"] .lwcs-load-dot { background: #4ade80; }
        #${面板ID} .lwcs-load-row[data-state="failed"] .lwcs-load-dot,
        #${面板ID} .lwcs-load-row[data-state="degraded"] .lwcs-load-dot {
          background: #fb7185;
          box-shadow: 0 0 8px rgba(251, 113, 133, 0.5);
        }
        #${面板ID} .lwcs-load-row[data-state="failed"] .lwcs-load-state,
        #${面板ID} .lwcs-load-row[data-state="degraded"] .lwcs-load-state { color: #fda4af; }
        @keyframes lwcs-load-tracker-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes lwcs-load-dot-pulse {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 1; }
        }
        @media (max-width: 520px) {
          #${面板ID} {
            top: 8px;
            right: 8px;
            width: calc(100vw - 16px);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          #${面板ID},
          #${面板ID} .lwcs-load-dot,
          #${面板ID} .lwcs-load-progress i {
            animation: none;
            transition: none;
          }
        }
      `;
      宿主文档.head.appendChild(样式节点);
    }

    function 刷新面板() {
      if (已手动关闭 || 已自动隐藏) return;
      if (!宿主文档.body) {
        if (!待渲染计时器) {
          待渲染计时器 = setTimeout(() => {
            待渲染计时器 = 0;
            刷新面板();
          }, 80);
        }
        return;
      }
      确保样式();
      let 面板 = 宿主文档.getElementById(面板ID);
      if (!面板 || 面板.dataset.session !== 会话ID) {
        if (面板) 面板.remove();
        面板 = 宿主文档.createElement('section');
        面板.id = 面板ID;
        面板.dataset.session = 会话ID;
        面板.setAttribute('role', 'status');
        面板.setAttribute('aria-live', 'polite');
        宿主文档.body.appendChild(面板);
      }

      const MVU模块列表 = Array.isArray(共享启动状态.mvuModules)
        ? 共享启动状态.mvuModules.map(项目 => ({ ...项目 }))
        : [];
      const 模块列表 = [
        { 名称: '远程引导', 状态: 'loaded', 错误: '' },
        ...MVU模块列表,
        { 名称: 'ST_UI_Entry.js', 状态: 状态.入口状态, 阶段: 状态.入口详情, 错误: 状态.入口错误 },
        ...状态.模块列表,
      ];
      const 完成数 = 模块列表.filter(项目 => 项目.状态 === 'loaded').length;
      const 异常列表 = 模块列表.filter(项目 => ['failed', 'degraded'].includes(项目.状态));
      const MVU追踪完成 = 共享启动状态.mvuTrackingComplete === true
        || (共享启动状态.mvuStatus === 'ready' && MVU模块列表.length === 0)
        || (MVU模块列表.length > 0 && MVU模块列表.every(项目 => ['loaded', 'degraded', 'failed'].includes(项目.状态)));
      const 全部完成 = MVU追踪完成 && 状态.入口状态 === 'loaded' && 状态.模块完成 && 异常列表.length === 0;
      const 进度 = 模块列表.length ? Math.round((完成数 / 模块列表.length) * 100) : 100;
      if (全部完成) {
        已自动隐藏 = true;
        面板.remove();
        return;
      }
      const 状态文本表 = {
        pending: '等待',
        loading: '加载中',
        loaded: '完成',
        degraded: '降级',
        failed: '失败',
      };
      const 副标题 = 异常列表.length
        ? `${异常列表.length} 项异常 · ${状态.阶段}`
        : `${完成数}/${模块列表.length} · ${状态.阶段}`;
      面板.className = `${全部完成 ? 'is-complete' : ''}${异常列表.length ? ' has-error' : ''}`.trim();
      面板.innerHTML = `
        <div class="lwcs-load-head">
          <div class="lwcs-load-title">
            <strong>${全部完成 ? '脚本加载完成' : 异常列表.length ? '脚本加载异常' : '脚本加载中'}</strong>
            <span>${转义文本(副标题)}</span>
          </div>
          <button type="button" class="lwcs-load-close" title="关闭加载追踪" aria-label="关闭加载追踪">×</button>
        </div>
        <div class="lwcs-load-progress" aria-hidden="true"><i style="width:${进度}%"></i></div>
        <div class="lwcs-load-list">
          ${模块列表.map(项目 => {
            const 错误提示 = 项目.错误 ? ` title="${转义文本(项目.错误)}"` : '';
            return `
              <div class="lwcs-load-row" data-state="${转义文本(项目.状态)}"${错误提示}>
                <i class="lwcs-load-dot" aria-hidden="true"></i>
                <span class="lwcs-load-name">${转义文本(项目.名称)}</span>
                <span class="lwcs-load-state">${转义文本(项目.阶段 || 状态文本表[项目.状态] || 项目.状态)}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
      面板.querySelector('.lwcs-load-close')?.addEventListener('click', () => {
        已手动关闭 = true;
        面板.remove();
      }, { once: true });
    }

    const 接口 = {
      开始新会话() {
        会话ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        状态.阶段 = '入口已启动';
        状态.入口状态 = 'loading';
        状态.入口详情 = '启动中';
        状态.入口错误 = '';
        状态.模块列表 = [];
        状态.模块完成 = false;
        状态.最近错误 = '';
        已手动关闭 = false;
        已自动隐藏 = false;
        宿主文档.getElementById(面板ID)?.remove();
        刷新面板();
      },
      更新入口(入口状态, 阶段 = 状态.阶段, 错误 = '', 入口详情 = '') {
        状态.入口状态 = 入口状态 || 'pending';
        状态.阶段 = 阶段 || 状态.阶段;
        状态.入口详情 = 入口详情 || 状态.入口详情;
        状态.入口错误 = 错误 || '';
        if (错误) 状态.最近错误 = 错误;
        刷新面板();
      },
      更新模块快照(快照 = {}) {
        状态.阶段 = String(快照.阶段 || 状态.阶段);
        状态.模块列表 = Array.isArray(快照.模块列表) ? 快照.模块列表 : 状态.模块列表;
        状态.模块完成 = 快照.全部完成 === true;
        if (快照.最近错误) 状态.最近错误 = String(快照.最近错误);
        刷新面板();
      },
      更新MVU快照(快照 = {}) {
        if (Array.isArray(快照.模块列表)) 共享启动状态.mvuModules = 快照.模块列表;
        if (typeof 快照.阶段 === 'string' && 快照.阶段) 共享启动状态.mvuStage = 快照.阶段;
        if (typeof 快照.全部完成 === 'boolean') 共享启动状态.mvuTrackingComplete = 快照.全部完成;
        刷新面板();
      },
      标记失败(错误, 阶段 = '远程入口失败') {
        const 错误文本 = 错误 && 错误.message ? 错误.message : String(错误 || 'unknown_bootstrap_error');
        状态.入口状态 = 'failed';
        状态.入口详情 = '失败';
        状态.入口错误 = 错误文本;
        状态.最近错误 = 错误文本;
        状态.阶段 = 阶段;
        刷新面板();
      },
    };

    宿主窗口.__LWCS_加载追踪器__ = 接口;
    try {
      if (window !== 宿主窗口) window.__LWCS_加载追踪器__ = 接口;
    } catch (错误) {}
    刷新面板();
    return 接口;
  })();

  function 构建资源基础地址(CDN地址, 提交哈希) {
    return `${CDN地址}/gh/${仓库名}@${提交哈希}/`;
  }

  function 构建资源基础地址候选列表(首选地址, 提交哈希) {
    const 候选列表 = [首选地址, ...CDN地址列表.map(CDN地址 => 构建资源基础地址(CDN地址, 提交哈希))];
    return 候选列表.filter((地址, 序号) => 地址 && 候选列表.indexOf(地址) === 序号);
  }

  function 预取关键资源(资源基础地址) {
    const 缓存键 = '__LWCS_UI_RESOURCE_TEXT_PREFETCH_V1__';
    const 预取缓存 = 宿主窗口[缓存键] && typeof 宿主窗口[缓存键] === 'object'
      ? 宿主窗口[缓存键]
      : Object.create(null);
    宿主窗口[缓存键] = 预取缓存;
    try { if (window !== 宿主窗口) window[缓存键] = 预取缓存; } catch (错误) {}
    启动预取资源列表.forEach(文件名 => {
      const 地址 = `${资源基础地址}${文件名}`;
      if (预取缓存[地址]) return;
      预取缓存[地址] = fetchWithTimeout(地址, { cache: 'force-cache' })
        .then(async 响应 => 响应.ok
          ? { ok: true, text: await withTimeout(响应.text(), `读取预取正文 ${地址}`, 20000) }
          : { ok: false, status: 响应.status })
        .catch(错误 => ({ ok: false, error: 错误 && 错误.message ? 错误.message : String(错误 || 'unknown_error') }));
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

  async function 等待MVU就绪(最大等待毫秒 = 12000) {
    const 开始时间 = Date.now();
    while (Date.now() - 开始时间 < 最大等待毫秒) {
      if (共享启动状态.mvuStatus === 'ready') return true;
      if (共享启动状态.mvuStatus === 'failed') return false;
      await new Promise(resolve => setTimeout(resolve, 120));
    }
    return 共享启动状态.mvuStatus === 'ready';
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

  async function 准备正式入口(提交哈希) {
    const 错误列表 = [];
    for (const CDN地址 of CDN地址列表) {
      const 资源基础地址 = 构建资源基础地址(CDN地址, 提交哈希);
      const 入口地址 = `${资源基础地址}${入口文件名}`;
      try {
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
        const 响应 = await fetchWithTimeout(入口地址, { cache: 'force-cache' });
        if (!响应.ok) throw new Error(`入口读取失败:${响应.status}`);
        return { 入口地址, 入口代码: await 响应.text() };
      } catch (错误) {
        错误列表.push(`${CDN地址}: ${错误 && 错误.message ? 错误.message : String(错误 || 'unknown_error')}`);
      }
    }
    throw new Error(`LWCS 入口预读 CDN 全部失败: ${错误列表.join(' | ')}`);
  }

  async function 启动远程入口() {
    共享启动状态.uiStatus = 'loading';
    加载追踪器.更新入口('pending', '正在解析最新版本', '', '等待版本');
    try {
      const 提交哈希 = await 取共享最新提交哈希();
      加载追踪器.更新入口('loading', '并行准备 UI 入口', '', '下载中');
      const 入口准备结果承诺 = 准备正式入口(提交哈希).then(
        结果 => ({ ok: true, 结果 }),
        错误 => ({ ok: false, 错误 }),
      );
      入口准备结果承诺.then(准备结果 => {
        if (准备结果.ok) 加载追踪器.更新入口('pending', '等待 MVU 运行时', '', '等待执行');
        else 加载追踪器.更新入口('pending', '等待 MVU 运行时', '', '等待回退');
      });
      if (!await 等待MVU就绪()) throw new Error('MVU 运行时未就绪，已停止加载 UI');
      const 入口准备结果 = await 入口准备结果承诺;
      if (入口准备结果.ok) {
        加载追踪器.更新入口('loading', '正在执行 ST_UI_Entry.js', '', '执行中');
        const { 入口地址, 入口代码 } = 入口准备结果.结果;
        const 执行入口 = new Function(`${入口代码}\n//# sourceURL=${入口地址}`);
        执行入口();
      } else {
        加载追踪器.更新入口('loading', '正在回退加载 ST_UI_Entry.js', '', '回退加载');
        await 加载正式入口(提交哈希);
      }
      加载追踪器.更新入口('loaded', '入口已执行', '', '完成');
      共享启动状态.uiStatus = 'ready';
    } catch (错误) {
      共享启动状态.uiStatus = 'failed';
      加载追踪器.标记失败(错误);
      console.error('[LWCS] 远程入口加载失败:', 错误);
    } finally {
      宿主窗口[引导键] = false;
    }
  }

  启动远程入口();
})();

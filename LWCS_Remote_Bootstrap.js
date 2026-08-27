!(async function () {
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
  const 回退提交哈希 = 'cba6eba9442e445cde7a0365b06837e0c9ab5c7f';
  const 入口文件名 = 'ST_UI_Entry.js';
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

  const 已有共享文本请求表 = 宿主窗口.__LWCS_SHARED_TEXT_REQUESTS_V1__;
  const 共享文本请求表 = 已有共享文本请求表
    && typeof 已有共享文本请求表.get === 'function'
    && typeof 已有共享文本请求表.set === 'function'
    && typeof 已有共享文本请求表.has === 'function'
    && typeof 已有共享文本请求表.delete === 'function'
    ? 已有共享文本请求表
    : new Map();
  宿主窗口.__LWCS_SHARED_TEXT_REQUESTS_V1__ = 共享文本请求表;
  const 读取共享文本 = 宿主窗口.__LWCS_READ_SHARED_TEXT_V1__ || ((地址, 选项 = {}, 超时毫秒 = 请求超时毫秒, 提交哈希 = '') => {
    const 请求键 = `${提交哈希 || 'local'}:${地址}`;
    if (!共享文本请求表.has(请求键)) {
      const 请求承诺 = fetchWithTimeout(地址, 选项)
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
  宿主窗口.__LWCS_READ_SHARED_TEXT_V1__ = 读取共享文本;
  const 已有预取状态 = 宿主窗口.__LWCS_SHARED_PREFETCH_STATE_V1__;
  const 共享预取状态 = 已有预取状态 && Array.isArray(已有预取状态.queue)
    ? 已有预取状态
    : { queue: [], active: 0 };
  if (!Number.isFinite(共享预取状态.active) || 共享预取状态.active < 0) 共享预取状态.active = 0;
  宿主窗口.__LWCS_SHARED_PREFETCH_STATE_V1__ = 共享预取状态;
  const 预取共享文本 = 宿主窗口.__LWCS_PREFETCH_SHARED_TEXT_V1__ || ((地址列表, 提交哈希 = '') => {
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
  宿主窗口.__LWCS_PREFETCH_SHARED_TEXT_V1__ = 预取共享文本;
  if (!宿主窗口.__LWCS_MVU_CORE_READY_PROMISE_V1__
    || typeof 宿主窗口.__LWCS_MVU_CORE_READY_PROMISE_V1__.then !== 'function') {
    宿主窗口.__LWCS_MVU_CORE_READY_PROMISE_V1__ = new Promise((resolve, reject) => {
      宿主窗口.__LWCS_MVU_CORE_READY_RESOLVE_V1__ = resolve;
      宿主窗口.__LWCS_MVU_CORE_READY_REJECT_V1__ = reject;
    });
  }
  void 宿主窗口.__LWCS_MVU_CORE_READY_PROMISE_V1__.catch(() => {});
  const UI所有者仍存活 = () => {
    const 所有者窗口 = 共享启动状态.uiOwnerWindow;
    const 所有者文档 = 共享启动状态.uiOwnerDocument;
    if (!所有者窗口 || !所有者文档) return false;
    try {
      if (所有者窗口.document !== 所有者文档) return false;
      return 所有者文档 === window.document || !!所有者窗口.frameElement?.isConnected;
    } catch (错误) {
      return false;
    }
  };
  async function 等待旧UI所有者释放() {
    while (['loading', 'ready'].includes(共享启动状态.uiStatus)) {
      const 旧所有者窗口 = 共享启动状态.uiOwnerWindow;
      const 旧所有者文档 = 共享启动状态.uiOwnerDocument;
      const 旧所有者代号 = 共享启动状态.uiOwnerToken;
      if (旧所有者文档 === window.document) return false;
      if (!旧所有者窗口 || 旧所有者窗口 === window) return true;

      const 截止时间 = Date.now() + 请求超时毫秒;
      if (!旧所有者文档) {
        while (
          共享启动状态.uiOwnerWindow === 旧所有者窗口
          && 共享启动状态.uiOwnerToken === 旧所有者代号
          && ['loading', 'ready'].includes(共享启动状态.uiStatus)
        ) {
          let 旧框架仍连接 = false;
          try { 旧框架仍连接 = !!旧所有者窗口.frameElement?.isConnected; } catch (错误) {}
          if (!旧框架仍连接) return true;
          if (Date.now() >= 截止时间) {
            throw new Error(`等待旧UI所有者释放超时:${请求超时毫秒}ms`);
          }
          await new Promise(继续 => setTimeout(继续, 16));
        }
        continue;
      }
      if (!UI所有者仍存活()) return true;
      while (
        共享启动状态.uiOwnerWindow === 旧所有者窗口
        && 共享启动状态.uiOwnerDocument === 旧所有者文档
        && 共享启动状态.uiOwnerToken === 旧所有者代号
        && ['loading', 'ready'].includes(共享启动状态.uiStatus)
        && UI所有者仍存活()
      ) {
        if (Date.now() >= 截止时间) {
          throw new Error(`等待旧UI所有者释放超时:${请求超时毫秒}ms`);
        }
        await new Promise(继续 => setTimeout(继续, 16));
      }
    }
    return true;
  }
  if (!await 等待旧UI所有者释放()) return;

  try { 宿主窗口.mvu_external_ui_vue_loader?.停止?.(); } catch (错误) {}
  try {
    宿主窗口.__LWCS_UI_READY_REJECT_V1__?.(new Error('UI入口已由新一轮加载替换'));
  } catch (错误) {}
  delete 宿主窗口.mvu_external_ui_vue_loader;
  delete 宿主窗口.__LWCS_UI_ENTRY_STATE__;
  delete 宿主窗口.__LWCS_UI_READY_PROMISE_V1__;
  delete 宿主窗口.__LWCS_UI_READY_RESOLVE_V1__;
  delete 宿主窗口.__LWCS_UI_READY_REJECT_V1__;

  const 本轮启动代号 = (Number(共享启动状态.uiGeneration) || 0) + 1;
  const 本轮所有者代号 = `${本轮启动代号}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  共享启动状态.uiGeneration = 本轮启动代号;
  共享启动状态.uiOwnerWindow = window;
  共享启动状态.uiOwnerDocument = window.document;
  共享启动状态.uiOwnerToken = 本轮所有者代号;
  共享启动状态.uiStartedAt = Date.now();
  宿主窗口.__LWCS_UI_ACTIVE_GENERATION_V1__ = 本轮启动代号;
  宿主窗口.__LWCS_UI_READY_PROMISE_V1__ = new Promise((resolve, reject) => {
    宿主窗口.__LWCS_UI_READY_RESOLVE_V1__ = resolve;
    宿主窗口.__LWCS_UI_READY_REJECT_V1__ = reject;
  });
  const 本轮UI就绪承诺 = 宿主窗口.__LWCS_UI_READY_PROMISE_V1__;
  void 本轮UI就绪承诺.catch(() => {});
  宿主窗口[引导键] = true;

  try {
    window.addEventListener('pagehide', () => {
      if (共享启动状态.uiOwnerToken !== 本轮所有者代号) return;
      try { 宿主窗口.mvu_external_ui_vue_loader?.停止?.(); } catch (错误) {}
      共享启动状态.uiStatus = 'idle';
      共享启动状态.uiOwnerWindow = null;
      共享启动状态.uiOwnerDocument = null;
      共享启动状态.uiOwnerToken = '';
      共享启动状态.uiStartedAt = 0;
      宿主窗口[引导键] = false;
    }, { once: true });
  } catch (错误) {}

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

    function 渲染面板() {
      if (已手动关闭 || 已自动隐藏) return;
      if (!宿主文档.body) {
        if (!待渲染计时器) {
          待渲染计时器 = setTimeout(() => {
            待渲染计时器 = 0;
            渲染面板();
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
      const 完成数 = 模块列表.filter(项目 => ['loaded', 'degraded'].includes(项目.状态)).length;
      const 异常列表 = 模块列表.filter(项目 => ['failed', 'degraded'].includes(项目.状态));
      const MVU追踪完成 = 共享启动状态.mvuStatus === 'ready';
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

    function 刷新面板() {
      if (已手动关闭 || 已自动隐藏 || 待渲染计时器) return;
      待渲染计时器 = setTimeout(() => {
        待渲染计时器 = 0;
        渲染面板();
      }, 80);
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
        clearTimeout(待渲染计时器);
        待渲染计时器 = 0;
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
        else {
          try { 脚本.remove(); } catch (错误) {}
          reject(结果 instanceof Error ? 结果 : new Error(`入口脚本加载失败: ${入口地址}`));
        }
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

  async function 取目标提交哈希() {
    const 接口地址 = `https://api.github.com/repos/${仓库名}/git/ref/heads/${分支名}?t=${Date.now()}`;
    try {
      const 响应 = await withTimeout(fetch(接口地址, {
        cache: 'no-store',
        headers: { Accept: 'application/vnd.github+json' },
      }), `读取 ${接口地址}`, GitHub请求超时毫秒);
      if (!响应.ok) throw new Error(`GitHub 最新提交读取失败: ${响应.status}`);
      const 数据 = await 响应.json();
      const 提交哈希 = String(数据?.object?.sha || '').trim();
      if (!/^[0-9a-f]{40}$/i.test(提交哈希)) throw new Error('GitHub 最新提交格式异常');
      return 提交哈希;
    } catch (错误) {
      const 当前提交哈希 = String(
        宿主窗口.__LWCS_MVU_当前远程提交__
        || window.__LWCS_MVU_当前远程提交__
        || 共享启动状态.commit
        || ''
      ).trim();
      console.warn('[LWCS Bootstrap] GitHub 最新提交读取失败，沿用当前 MVU 提交。', 错误);
      return /^[0-9a-f]{40}$/i.test(当前提交哈希) ? 当前提交哈希 : 回退提交哈希;
    }
  }

  async function 等待MVU就绪(目标提交哈希) {
    const 截止时间 = Date.now() + 30000;
    while (Date.now() < 截止时间) {
      const 完成契约 = 宿主窗口.__LWCS_MVU_CORE_CONTRACT_V1__
        || window.__LWCS_MVU_CORE_CONTRACT_V1__;
      const 当前提交哈希 = String(
        宿主窗口.__LWCS_MVU_当前远程提交__
        || window.__LWCS_MVU_当前远程提交__
        || ''
      ).trim();
      if (
        共享启动状态.mvuStatus === 'ready'
        && 当前提交哈希 === 目标提交哈希
        && 完成契约?.ready === true
        && 完成契约.commit === 目标提交哈希
        && 完成契约.generation === Number(共享启动状态.mvuGeneration)
      ) return true;
      if (共享启动状态.mvuStatus === 'failed' && 当前提交哈希 === 目标提交哈希) {
        throw new Error(`MVU核心启动失败（${共享启动状态.mvuStage || '未知阶段'}）`);
      }
      await new Promise(继续 => setTimeout(继续, 25));
    }
    throw new Error(`MVU核心未切换到UI目标提交：${目标提交哈希}`);
  }

  async function 加载正式入口(提交哈希) {
    const 错误列表 = [];
    for (const [CDN序号, CDN地址] of CDN地址列表.entries()) {
      const 资源基础地址 = 构建资源基础地址(CDN地址, 提交哈希);
      try {
        const 入口尝试代号 = `${本轮启动代号}:${CDN序号}`;
        宿主窗口.__LWCS_UI_ACTIVE_ENTRY_ATTEMPT_V1__ = 入口尝试代号;
        const 入口地址 = `${资源基础地址}${入口文件名}#lwcs_ui_generation=${本轮启动代号}&lwcs_attempt=${入口尝试代号}`;
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

        await 加载脚本入口(入口地址);
        return;
      } catch (错误) {
        错误列表.push(`${CDN地址}: ${错误 && 错误.message ? 错误.message : String(错误 || 'unknown_error')}`);
      }
    }
    throw new Error(`LWCS 入口 CDN 全部失败: ${错误列表.join(' | ')}`);
  }

  async function 启动远程入口() {
    共享启动状态.uiStatus = 'loading';
    加载追踪器.更新入口('pending', '正在解析目标版本', '', '等待版本');
    try {
      const 提交哈希 = await 取目标提交哈希();
      加载追踪器.更新入口('pending', '等待同版本 MVU 运行时', '', '等待执行');
      await 等待MVU就绪(提交哈希);
      加载追踪器.更新入口('loading', '正在执行 ST_UI_Entry.js', '', '执行中');
      await 加载正式入口(提交哈希);
      await 本轮UI就绪承诺;
      if (宿主窗口.__LWCS_UI_ACTIVE_GENERATION_V1__ !== 本轮启动代号) {
        throw new Error(`UI启动轮次已过期：${本轮启动代号}`);
      }
      加载追踪器.更新入口('loaded', '入口已执行', '', '完成');
      共享启动状态.uiStatus = 'ready';
      共享启动状态.uiStartedAt = 0;
    } catch (错误) {
      if (宿主窗口.__LWCS_UI_ACTIVE_GENERATION_V1__ === 本轮启动代号) {
        try { 宿主窗口.mvu_external_ui_vue_loader?.停止?.(); } catch (停止错误) {}
        共享启动状态.uiStatus = 'failed';
        共享启动状态.uiStartedAt = 0;
        共享启动状态.uiOwnerWindow = null;
        共享启动状态.uiOwnerDocument = null;
        共享启动状态.uiOwnerToken = '';
        加载追踪器.标记失败(错误);
        console.error('[LWCS] 远程入口加载失败:', 错误);
      }
    } finally {
      if (宿主窗口.__LWCS_UI_ACTIVE_GENERATION_V1__ === 本轮启动代号) {
        宿主窗口[引导键] = false;
      }
    }
  }

  void 启动远程入口();
})().catch(错误 => console.error('[LWCS] UI 引导所有权交接失败:', 错误));

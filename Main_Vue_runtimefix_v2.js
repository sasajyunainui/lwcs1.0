/* 状态栏挂载壳层：在聊天流里维护 #mvu-unified-mount（跟随最新一条消息），给 body 挂布局类，修正酒馆底部原生菜单位置。
   状态栏内容只有座舱（由桥接挂进挂载点）；旧版 Vue 详情页、标签与主题状态已随旧界面删除 */

const mvuLayoutState = window.__MVU_LAYOUT_STATE__ || (window.__MVU_LAYOUT_STATE__ = {
  effectiveMode: 'holo',
  unifiedAnchorReady: false
});

if (!('unifiedAnchorReady' in mvuLayoutState)) {
  mvuLayoutState.unifiedAnchorReady = false;
}
mvuLayoutState.effectiveMode = 'holo';

function syncUnifiedMountPlacement() {
  if (window.__MVU_UNIFIED_ANCHOR_MANAGER__ && typeof window.__MVU_UNIFIED_ANCHOR_MANAGER__.scheduleRelocate === 'function') {
    window.__MVU_UNIFIED_ANCHOR_MANAGER__.scheduleRelocate();
  }
}

function applyLayoutBodyClasses() {
  const body = document.body;
  if (!body) return;
  const unifiedMount = document.getElementById('mvu-unified-mount');
  if (
    unifiedMount
    && unifiedMount.hasAttribute('data-mvu-booting')
    && (mvuLayoutState.unifiedAnchorReady || body.classList.contains('mvu-unified-mount-ready'))
  ) {
    unifiedMount.removeAttribute('data-mvu-booting');
  }
  body.classList.toggle('mvu-unified-mount-ready', !!mvuLayoutState.unifiedAnchorReady);
  body.classList.remove('mvu-layout-split', 'mvu-layout-unified');
  body.classList.toggle('mvu-layout-holo', true);
  body.classList.add('mvu-surface-panel');
  body.classList.remove(
    'mvu-layout-split',
    'mvu-layout-unified',
    'mvu-layout-unified-locked'
  );
}

function syncLayoutMode() {
  mvuLayoutState.effectiveMode = 'holo';
  applyLayoutBodyClasses();
  return mvuLayoutState.effectiveMode;
}

function refreshViewportState() {
  syncUnifiedMountPlacement();
  syncLayoutMode();
}

if (typeof window.__MVU_LAYOUT_VIEWPORT_CLEANUP__ === 'function') {
  try { window.__MVU_LAYOUT_VIEWPORT_CLEANUP__(); } catch (err) {}
}

const viewportDisposers = [];
const onResize = () => refreshViewportState();
window.addEventListener('resize', onResize);
viewportDisposers.push(() => window.removeEventListener('resize', onResize));
window.__MVU_LAYOUT_VIEWPORT_CLEANUP__ = () => {
  for (const disposer of viewportDisposers) {
    try { disposer(); } catch (err) {}
  }
};

function applyUnifiedMountHostStyle(mountEl) {
  if (!mountEl) return;
  mountEl.style.position = 'relative';
  mountEl.style.inset = '';
  mountEl.style.width = '100%';
  mountEl.style.height = '';
  mountEl.style.pointerEvents = 'none';
  mountEl.style.zIndex = '';
}

function 贴合酒馆底部菜单到按钮(按钮, 菜单) {
  if (!(按钮 instanceof HTMLElement) || !(菜单 instanceof HTMLElement)) return;
  if (window.getComputedStyle(菜单).display === 'none') return;
  const 按钮矩形 = 按钮.getBoundingClientRect();
  const 菜单矩形 = 菜单.getBoundingClientRect();
  const 安全间距 = 8;
  const 菜单宽度 = Math.max(菜单矩形.width || 菜单.offsetWidth || 0, 1);
  const 菜单高度 = Math.max(菜单矩形.height || 菜单.offsetHeight || 0, 1);
  const 左侧 = Math.min(
    Math.max(安全间距, 按钮矩形.left),
    Math.max(安全间距, window.innerWidth - 菜单宽度 - 安全间距)
  );
  const 上方 = Math.max(安全间距, 按钮矩形.top - 菜单高度 - 安全间距);
  菜单.style.position = 'fixed';
  菜单.style.inset = 'auto';
  菜单.style.left = `${Math.round(左侧)}px`;
  菜单.style.top = `${Math.round(上方)}px`;
  菜单.style.right = 'auto';
  菜单.style.bottom = 'auto';
  菜单.style.transform = 'none';
  菜单.style.maxHeight = `${Math.max(120, Math.floor(按钮矩形.top - 安全间距 * 2))}px`;
  if (菜单.id === 'extensionsMenu') 菜单.style.overflowY = 'auto';
}

function 修正酒馆底部原生菜单位置() {
  if (!document.body || !document.body.classList.contains('mvu-layout-holo')) return;
  const 选项按钮 = document.getElementById('options_button');
  const 扩展按钮 = document.getElementById('extensionsMenuButton');
  贴合酒馆底部菜单到按钮(选项按钮, document.getElementById('options'));
  贴合酒馆底部菜单到按钮(扩展按钮, document.getElementById('extensionsMenu'));
}

function 启动酒馆底部菜单位置修正() {
  if (window.__MVU_HOLO_NATIVE_MENU_FIX_CLEANUP__) {
    try { window.__MVU_HOLO_NATIVE_MENU_FIX_CLEANUP__(); } catch (错误) {}
  }
  let 动画帧 = 0;
  const 安排修正 = () => {
    if (动画帧) return;
    动画帧 = requestAnimationFrame(() => {
      动画帧 = 0;
      修正酒馆底部原生菜单位置();
    });
  };
  const 点击监听 = 事件 => {
    const 目标 = 事件.target instanceof Element ? 事件.target : null;
    if (!目标 || !目标.closest('#options_button, #extensionsMenuButton')) return;
    requestAnimationFrame(安排修正);
  };
  const 滚动监听 = () => 安排修正();
  document.addEventListener('click', 点击监听, false);
  window.addEventListener('resize', 安排修正);
  const 聊天容器 = document.getElementById('chat');
  if (聊天容器) 聊天容器.addEventListener('scroll', 滚动监听, { passive: true });
  window.__MVU_HOLO_NATIVE_MENU_FIX_CLEANUP__ = () => {
    if (动画帧) {
      cancelAnimationFrame(动画帧);
      动画帧 = 0;
    }
    document.removeEventListener('click', 点击监听, false);
    window.removeEventListener('resize', 安排修正);
    if (聊天容器) 聊天容器.removeEventListener('scroll', 滚动监听, { passive: true });
    delete window.__MVU_HOLO_NATIVE_MENU_FIX_CLEANUP__;
  };
}

function createUnifiedAnchorManager(options = {}) {
  const mountId = options.mountId || 'mvu-unified-mount';
  const onReadyChange = typeof options.onReadyChange === 'function' ? options.onReadyChange : () => {};
  const anchorSelector = `.mes, #chat, #${mountId}`;

  let bodyObserver = null;
  let chatObserver = null;
  let observedChat = null;
  let rafToken = 0;
  let lastReadyState = null;

  function nodeContainsSelector(node, selector) {
    if (!(node instanceof Element)) return false;
    return node.matches(selector) || !!node.querySelector(selector);
  }

  function recordsContainSelector(records, selector, ignoredSubtree = null) {
    for (const record of records) {
      if (record.type !== 'childList') continue;
      if (ignoredSubtree && (record.target === ignoredSubtree || ignoredSubtree.contains(record.target))) continue;
      for (const node of record.addedNodes) {
        if (nodeContainsSelector(node, selector)) return true;
      }
      for (const node of record.removedNodes) {
        if (nodeContainsSelector(node, selector)) return true;
      }
    }
    return false;
  }

  function hasStableUnifiedMountContent() {
    const mountEl = document.getElementById(mountId);
    if (!mountEl || !mountEl.isConnected) return false;
    if (mountEl.__mvuVueMounted) return true;
    if (mountEl.children && mountEl.children.length > 0) return true;
    return false;
  }

  function setReadyState(nextReady) {
    if (!nextReady && lastReadyState === true && hasStableUnifiedMountContent()) {
      return;
    }
    if (lastReadyState === nextReady) return;
    lastReadyState = nextReady;
    onReadyChange(nextReady);
  }

  function findLastMessage(chatEl) {
    if (!chatEl) return null;
    const explicitLast = chatEl.querySelector('.mes.last_mes');
    if (explicitLast) return explicitLast;
    const messages = chatEl.querySelectorAll('.mes');
    return messages.length ? messages[messages.length - 1] : null;
  }

  function findFallbackConflictNode(chatEl) {
    if (!chatEl || !chatEl.children) return null;
    const children = Array.from(chatEl.children);
    for (const node of children) {
      if (!(node instanceof Element)) continue;
      if (node.id === 'acu-nav-bar') return node;
      if (node.classList.contains('acu-wrapper')) return node;
    }
    return null;
  }

  function relocateMount() {
    const mountEl = ensureUnifiedDockMounted();
    const chatEl = document.getElementById('chat');
    if (!mountEl) {
      setReadyState(false);
      return;
    }
    applyUnifiedMountHostStyle(mountEl);
    if (!chatEl || !chatEl.isConnected) {
      if (document.body && mountEl.parentElement !== document.body) {
        document.body.appendChild(mountEl);
      }
      setReadyState(!!mountEl.isConnected);
      return;
    }

    const anchor = findLastMessage(chatEl);
    const parent = (anchor && anchor.parentElement) ? anchor.parentElement : chatEl;
    let expectedNext = anchor ? anchor.nextElementSibling : findFallbackConflictNode(chatEl);
    if (expectedNext === mountEl) {
      expectedNext = mountEl.nextElementSibling;
    }

    if (mountEl.parentElement !== parent || mountEl.nextElementSibling !== expectedNext) {
      parent.insertBefore(mountEl, expectedNext || null);
    }

    setReadyState(true);
  }

  function scheduleRelocate() {
    if (rafToken) return;
    rafToken = requestAnimationFrame(() => {
      rafToken = 0;
      relocateMount();
    });
  }

  function observeChat(chatEl) {
    if (chatObserver) {
      chatObserver.disconnect();
      chatObserver = null;
    }
    observedChat = chatEl || null;
    if (!chatEl) return;

    chatObserver = new MutationObserver(records => {
      if (recordsContainSelector(records, anchorSelector)) scheduleRelocate();
    });
    chatObserver.observe(chatEl, { childList: true, subtree: true });
  }

  function refreshChatObserver() {
    const chatEl = document.getElementById('chat');
    if (chatEl !== observedChat) {
      observeChat(chatEl);
    }
  }

  function start() {
    const root = document.body || document.documentElement;
    if (!root) return;

    if (bodyObserver) bodyObserver.disconnect();
    bodyObserver = new MutationObserver(records => {
      if (!recordsContainSelector(records, anchorSelector, observedChat)) return;
      if (recordsContainSelector(records, '#chat')) refreshChatObserver();
      scheduleRelocate();
    });
    bodyObserver.observe(root, { childList: true, subtree: true });

    refreshChatObserver();
    scheduleRelocate();
  }

  function stop() {
    if (bodyObserver) {
      bodyObserver.disconnect();
      bodyObserver = null;
    }
    if (chatObserver) {
      chatObserver.disconnect();
      chatObserver = null;
    }
    observedChat = null;
    if (rafToken) {
      cancelAnimationFrame(rafToken);
      rafToken = 0;
    }
  }

  return {
    start,
    stop,
    scheduleRelocate
  };
}

function ensureUnifiedMountNode() {
  let unifiedMount = document.getElementById('mvu-unified-mount');
  if (!unifiedMount && document.body) {
    unifiedMount = document.createElement('div');
    unifiedMount.id = 'mvu-unified-mount';
    unifiedMount.dataset.mvuBooting = '1';
    document.body.appendChild(unifiedMount);
  }
  if (
    unifiedMount
    && unifiedMount.hasAttribute('data-mvu-booting')
    && (mvuLayoutState.unifiedAnchorReady || document.body?.classList.contains('mvu-unified-mount-ready'))
  ) {
    unifiedMount.removeAttribute('data-mvu-booting');
  }
  applyUnifiedMountHostStyle(unifiedMount);
  return unifiedMount;
}

function ensureUnifiedDockMounted() {
  const unifiedMount = ensureUnifiedMountNode();
  if (!unifiedMount) return null;
  // 挂载点里只放座舱（桥接挂入）；标记沿用，锚点管理据此判断挂载点已有稳定内容
  unifiedMount.__mvuVueMounted = true;
  return unifiedMount;
}

function mountMvuVue() {
  const unifiedMount = ensureUnifiedDockMounted();

  if (window.__MVU_UNIFIED_ANCHOR_MANAGER__ && typeof window.__MVU_UNIFIED_ANCHOR_MANAGER__.stop === 'function') {
    try { window.__MVU_UNIFIED_ANCHOR_MANAGER__.stop(); } catch (err) {}
  }
  const anchorManager = createUnifiedAnchorManager({
    mountId: 'mvu-unified-mount',
    onReadyChange: isReady => {
      mvuLayoutState.unifiedAnchorReady = !!isReady;
      syncLayoutMode();
    }
  });
  window.__MVU_UNIFIED_ANCHOR_MANAGER__ = anchorManager;
  anchorManager.start();

  refreshViewportState();
  syncLayoutMode();
  启动酒馆底部菜单位置修正();
  const finishUnifiedBootstrap = () => {
    if (unifiedMount && unifiedMount.hasAttribute('data-mvu-booting')) {
      unifiedMount.removeAttribute('data-mvu-booting');
    }
  };
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => window.requestAnimationFrame(finishUnifiedBootstrap));
  } else {
    window.setTimeout(finishUnifiedBootstrap, 32);
  }
  window.setTimeout(finishUnifiedBootstrap, 160);
  window.setTimeout(finishUnifiedBootstrap, 640);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountMvuVue);
} else {
  mountMvuVue();
}

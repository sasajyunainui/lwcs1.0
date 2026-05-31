const { createApp, ref, reactive, computed, watch, onMounted, onUnmounted } = Vue;

const TAB_ITEMS = [
  {
    id: 'page-archive',
    label: '档案',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5.5h10l2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-11l2-2Z"></path><path d="M9 5.5V4h6v1.5"></path><path d="M9 11h6"></path><path d="M9 15h6"></path></svg>'
  },
  {
    id: 'page-map',
    label: '星图',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7.5 12 4l7 3.5v9L12 20l-7-3.5z"></path><path d="M12 4v16"></path><path d="m5 7.5 7 3.5 7-3.5"></path></svg>'
  },
  {
    id: 'page-world',
    label: '世界',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle><path d="M4 12h16"></path><path d="M12 4a12 12 0 0 1 0 16"></path><path d="M12 4a12 12 0 0 0 0 16"></path></svg>'
  },
  {
    id: 'page-org',
    label: '势力',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16"></path><path d="M8 5h8l-1.5 3L16 11H8z"></path><path d="M7 20h10"></path></svg>'
  },
  {
    id: 'page-terminal',
    label: '终端',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"></rect><path d="m8 10 2 2-2 2"></path><path d="M12.5 15h3.5"></path></svg>'
  }
];

const UNIFIED_TAB_META = {
  'page-archive': {
    eyebrow: '',
    title: '档案',
    desc: ''
  },
  'page-map': {
    eyebrow: '',
    title: '星图',
    desc: ''
  },
  'page-world': {
    eyebrow: '',
    title: '世界',
    desc: ''
  },
  'page-org': {
    eyebrow: '',
    title: '势力',
    desc: ''
  },
  'page-terminal': {
    eyebrow: '',
    title: '终端',
    desc: ''
  }
};

const 统一标签存储键 = 'mvu_unified_current_tab_v1';

function normalizeTabId(tabId) {
  const value = String(tabId || '').trim();
  return TAB_ITEMS.some(tab => tab.id === value) ? value : 'page-archive';
}

function 读取统一标签存储() {
  try {
    return normalizeTabId(window.localStorage.getItem(统一标签存储键));
  } catch (err) {
    return 'page-archive';
  }
}

function 写入统一标签存储(tabId) {
  const normalized = normalizeTabId(tabId);
  try {
    window.localStorage.setItem(统一标签存储键, normalized);
  } catch (err) {}
}

function resolveUnifiedTabMeta(tabId) {
  return UNIFIED_TAB_META[tabId] || UNIFIED_TAB_META['page-archive'];
}

function resolveShellPreviewTitle(previewKey, fallback = '') {
  const key = String(previewKey || '').trim();
  if (key.startsWith('技能设计台：')) {
    try {
      const payload = JSON.parse(decodeURIComponent(key.slice('技能设计台：'.length)));
      const scope = String(payload && payload.scope || '').trim();
      const scopeTitleMap = {
        武魂融合技: '武魂融合技设计',
        自创魂技: '自创魂技设计',
        魂技: '魂技设计',
        fusion_skill: '融合技设计',
        art: '功法设计',
        special_ability: '特殊能力设计',
        spirit_skill: '魂技设计',
        soul_bone_skill: '魂骨技设计',
        blood_skill: '血脉技能设计',
        blood_passive: '血脉被动设计'
      };
      return scopeTitleMap[scope] || '技能设计';
    } catch (err) {
      return '技能设计';
    }
  }
  if (key.startsWith('org_detail_')) {
    const 势力名 = key.replace('org_detail_', '').trim();
    return 势力名 ? `势力档案 / ${势力名}` : '势力档案';
  }
  const previewTitleMap = {
    '\u89d2\u8272\u5207\u6362\u5668': '\u89d2\u8272',
    '\u751f\u547d\u56fe\u8c31\u8be6\u60c5\u9875': '\u8be6\u7ec6\u6863\u6848',
    '\u751f\u547d\u56fe\u8c31\u8be6\u7ec6\u9875': '\u8be6\u7ec6\u6863\u6848',
    '\u79c1\u5bc6\u6863\u6848\u8be6\u7ec6\u9875': '\u79c1\u5bc6\u6863\u6848',
    '\u6b66\u88c5\u5de5\u574a\u8be6\u60c5\u9875': '\u6b66\u88c5',
    '\u6b66\u88c5\u5de5\u574a\u8be6\u7ec6\u9875': '\u6b66\u88c5',
    '\u50a8\u7269\u4ed3\u5e93\u8be6\u60c5\u9875': '\u4ed3\u5e93',
    '\u50a8\u7269\u4ed3\u5e93\u8be6\u7ec6\u9875': '\u4ed3\u5e93',
    '\u793e\u4f1a\u6863\u6848\u8be6\u60c5\u9875': '\u793e\u4f1a',
    '\u793e\u4f1a\u6863\u6848\u8be6\u7ec6\u9875': '\u793e\u4f1a',
    '\u6240\u5c5e\u52bf\u529b\u8be6\u60c5\u9875': '\u6240\u5c5e\u52bf\u529b',
    '\u6240\u5c5e\u52bf\u529b\u8be6\u7ec6\u9875': '\u6240\u5c5e\u52bf\u529b',
    '\u4eba\u7269\u5173\u7cfb\u8be6\u60c5\u9875': '\u5173\u7cfb',
    '\u4eba\u7269\u5173\u7cfb\u8be6\u7ec6\u9875': '\u5173\u7cfb',
    '\u60c5\u62a5\u5e93\u8be6\u60c5\u9875': '\u60c5\u62a5\u5e93',
    '\u60c5\u62a5\u5e93\u8be6\u7ec6\u9875': '\u60c5\u62a5\u5e93',
    '\u7b2c\u4e00\u6b66\u9b42\u8be6\u60c5\u9875': '\u7b2c\u4e00\u6b66\u9b42',
    '\u7b2c\u4e00\u6b66\u9b42\u8be6\u7ec6\u9875': '\u7b2c\u4e00\u6b66\u9b42',
    '\u7b2c\u4e8c\u6b66\u9b42\u8be6\u60c5\u9875': '\u7b2c\u4e8c\u6b66\u9b42',
    '\u7b2c\u4e8c\u6b66\u9b42\u8be6\u7ec6\u9875': '\u7b2c\u4e8c\u6b66\u9b42',
    '\u8840\u8109\u5c01\u5370\u8be6\u60c5\u9875': '\u8840\u8109',
    '\u6b66\u9b42\u878d\u5408\u6280\u8be6\u7ec6\u9875': '\u878d\u5408\u6280',
    '\u6b66\u9b42\u878d\u5408\u6280\u8be6\u60c5\u9875': '\u878d\u5408\u6280',
    '\u5168\u606f\u661f\u56fe\u4e3b\u753b\u5e03': '\u661f\u56fe',
    '\u5f53\u524d\u8282\u70b9\u8be6\u60c5': '\u5f53\u524d\u8282\u70b9',
    '\u56fe\u5c42\u63a7\u5236\u4e0e\u8dd1\u56fe': '\u8dd1\u56fe',
    '\u52a8\u6001\u5730\u70b9\u4e0e\u6269\u5c55\u8282\u70b9': '\u52a8\u6001\u5730\u70b9',
    '\u4e16\u754c\u72b6\u6001\u603b\u89c8': '\u4e16\u754c',
    '\u7f16\u5e74\u53f2\u6863\u6848': '\u7f16\u5e74',
    '\u62cd\u5356\u4e0e\u8b66\u62a5': '\u8b66\u62a5',
    '\u52bf\u529b\u77e9\u9635\u603b\u89c8': '\u52bf\u529b',
    '\u6211\u7684\u9635\u8425\u8be6\u60c5': '\u6211\u7684\u9635\u8425\u6743\u9650',
    '\u672c\u5730\u636e\u70b9\u8be6\u60c5': '\u672c\u5730\u636e\u70b9',
    '\u7cfb\u7edf\u64ad\u62a5\u4e0e\u65e5\u5fd7': '\u64ad\u62a5',
    '\u8bd5\u70bc\u4e0e\u60c5\u62a5': '\u60c5\u62a5',
    '\u8fd1\u671f\u89c1\u95fb': '\u89c1\u95fb',
    '\u602a\u7269\u56fe\u9274': '\u56fe\u9274',
    '\u4efb\u52a1\u754c\u9762': '\u4efb\u52a1'
  };
  return previewTitleMap[key] || key || fallback || '详情';
}

const mvuLayoutState = window.__MVU_LAYOUT_STATE__ || (window.__MVU_LAYOUT_STATE__ = reactive({
  effectiveMode: 'unified',
  unifiedAnchorReady: false
}));

if (!('unifiedAnchorReady' in mvuLayoutState)) {
  mvuLayoutState.unifiedAnchorReady = false;
}
mvuLayoutState.effectiveMode = 'unified';

const mvuTabState = window.__MVU_TAB_STATE__ || (window.__MVU_TAB_STATE__ = reactive({ current: 读取统一标签存储() }));
const mvuUnifiedDetailState = window.__MVU_UNIFIED_DETAIL_STATE__ || (window.__MVU_UNIFIED_DETAIL_STATE__ = reactive({
  isOpen: false,
  previewKey: '',
  returnTab: mvuTabState.current,
  stack: [],
  returnScrollTop: 0
}));
mvuTabState.current = normalizeTabId(mvuTabState.current);
if (!Array.isArray(mvuUnifiedDetailState.stack)) mvuUnifiedDetailState.stack = [];
mvuUnifiedDetailState.returnTab = normalizeTabId(mvuUnifiedDetailState.returnTab || mvuTabState.current);

function syncUnifiedMountPlacement() {
  if (window.__MVU_UNIFIED_ANCHOR_MANAGER__ && typeof window.__MVU_UNIFIED_ANCHOR_MANAGER__.scheduleRelocate === 'function') {
    window.__MVU_UNIFIED_ANCHOR_MANAGER__.scheduleRelocate();
  }
}

function requestUnifiedShellCardRefresh(options = {}) {
  const force = options.force !== false;
  const runRender = () => {
    if (typeof window.__MVU_RERENDER_UNIFIED_CARDS__ === 'function') {
      try { window.__MVU_RERENDER_UNIFIED_CARDS__({ force }); } catch (err) {}
    }
  };
  const run = () => {
    if (typeof window.__MVU_REFRESH_LIVE_SNAPSHOT__ === 'function') {
      try {
        const refreshResult = window.__MVU_REFRESH_LIVE_SNAPSHOT__({ force });
        if (refreshResult && typeof refreshResult.then === 'function') {
          refreshResult.finally(runRender);
          return;
        }
      } catch (err) {}
    }
    runRender();
  };
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => window.requestAnimationFrame(run));
  } else {
    window.setTimeout(run, 0);
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
  body.classList.remove('mvu-layout-split');
  body.classList.toggle('mvu-layout-unified', true);
  body.classList.add('mvu-surface-panel');
  body.classList.remove(
    'mvu-layout-split',
    'mvu-layout-unified-locked'
  );
}

function syncLayoutMode() {
  mvuLayoutState.effectiveMode = 'unified';
  applyLayoutBodyClasses();
  return mvuLayoutState.effectiveMode;
}

function refreshViewportState() {
  syncUnifiedMountPlacement();
  syncLayoutMode();
  if (typeof window.__MVU_SYNC_DETAIL_MODAL_HOST__ === 'function') {
    try { window.__MVU_SYNC_DETAIL_MODAL_HOST__(); } catch (err) {}
  }
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

function setSharedTab(target) {
  mvuTabState.current = normalizeTabId(target);
}

window.__MVU_SET_TAB_STATE__ = setSharedTab;

function requestTabChange(target) {
  const next = normalizeTabId(target);
  setSharedTab(next);
  写入统一标签存储(next);
  if (typeof window.mvuSetMainTabExternal === 'function') {
    window.mvuSetMainTabExternal(next);
  } else if (typeof window.mvuSetMainTab === 'function') {
    window.mvuSetMainTab(next);
  }
  if (next === 'page-map' && typeof window.__sheepMapResync === 'function') {
    window.setTimeout(() => {
      try { window.__sheepMapResync({ center: false, syncVisual: false }); } catch (err) {}
      if (typeof window.__MVU_CLAMP_UNIFIED_MAP_CANVAS__ === 'function') {
        try { window.__MVU_CLAMP_UNIFIED_MAP_CANVAS__(); } catch (err) {}
      }
    }, 40);
  }
}

function applyUnifiedMountHostStyle(mountEl) {
  if (!mountEl) return;
  mountEl.style.position = 'relative';
  mountEl.style.inset = '';
  mountEl.style.width = '100%';
  mountEl.style.height = '';
  mountEl.style.pointerEvents = 'auto';
  mountEl.style.zIndex = '1000';
}

function createUnifiedAnchorManager(options = {}) {
  const mountId = options.mountId || 'mvu-unified-mount';
  const onReadyChange = typeof options.onReadyChange === 'function' ? options.onReadyChange : () => {};

  let bodyObserver = null;
  let chatObserver = null;
  let observedChat = null;
  let rafToken = 0;
  let lastReadyState = null;

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

    chatObserver = new MutationObserver(() => scheduleRelocate());
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
    bodyObserver = new MutationObserver(() => {
      refreshChatObserver();
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

const DesktopUnifiedLayout = {
  template: `
    <div class="mvu-unified-shell mvu-unified-panel-host mvu-root">
      <div class="mvu-unified-frame" :class="{ 'is-detail': detailState.isOpen }">
        <div class="mvu-unified-toolbar" :class="{ 'is-detail': detailState.isOpen }">
          <div class="mvu-unified-toolbar-main">
            <div class="mvu-unified-detail-bar" v-show="detailState.isOpen">
              <button type="button" class="mvu-unified-detail-back" aria-label="返回" @click="closeUnifiedDetail">&lt;</button>
              <strong class="mvu-unified-detail-title">{{ 详情路径标题 }}</strong>
            </div>
            <div class="mvu-unified-overview-bar" v-show="!detailState.isOpen">
              <div class="mvu-unified-top-status" data-unified-top-status="panel"></div>
              <div class="mvu-unified-tab-row">
                <button
                  v-for="tab in tabs"
                  :key="'unified-tab-' + tab.id"
                  type="button"
                  class="mvu-tab-btn mvu-unified-tab-btn"
                  :class="{ active: tabState.current === tab.id }"
                  :data-target="tab.id"
                  :aria-pressed="tabState.current === tab.id ? 'true' : 'false'"
                  @click="setTab(tab.id)"
                >{{ tab.label }}</button>
              </div>
            </div>
          </div>
        </div>

        <div v-show="!detailState.isOpen" class="mvu-unified-page-stack">
          <section class="mvu-unified-page" :class="{ active: tabState.current === 'page-archive' }" data-target="page-archive">
            <section class="mvu-unified-section mvu-unified-section--dashboard">
              <div class="mvu-unified-dashboard mvu-unified-dashboard--archive">
                <div class="mvu-unified-card mvu-unified-card--featured clickable" data-preview="生命图谱详细页" data-detail-mode="embed" data-unified-card="archive-core" data-unified-surface="panel"></div>
                <div class="mvu-unified-card clickable" data-unified-card="primary-spirit" data-unified-surface="panel"></div>
                <div class="mvu-unified-card clickable" data-unified-card="secondary-spirit" data-unified-surface="panel"></div>
                <div class="mvu-unified-card clickable" data-preview="武装工坊详细页" data-detail-mode="embed" data-unified-card="armory" data-unified-surface="panel"></div>
                <div class="mvu-unified-card clickable" data-preview="储物仓库详细页" data-detail-mode="embed" data-unified-card="vault" data-unified-surface="panel"></div>
                <div class="mvu-unified-card" data-unified-card="social" data-unified-surface="panel"></div>
              </div>
            </section>
          </section>

          <section class="mvu-unified-page" :class="{ active: tabState.current === 'page-map' }" data-target="page-map">
            <section class="mvu-unified-section mvu-unified-section--dashboard">
              <div class="mvu-unified-dashboard mvu-unified-dashboard--map">
                <div class="mvu-unified-map-stage" data-mvu-map-stage="panel"></div>
                <div class="mvu-unified-card clickable" data-preview="当前节点详情" data-detail-mode="embed" data-unified-card="map-current" data-unified-surface="panel"></div>
                <div class="mvu-unified-card" data-unified-card="map-locals" data-unified-surface="panel"></div>
              </div>
            </section>
          </section>

          <section class="mvu-unified-page" :class="{ active: tabState.current === 'page-world' }" data-target="page-world">
            <section class="mvu-unified-section mvu-unified-section--dashboard">
              <div class="mvu-unified-dashboard mvu-unified-dashboard--world">
                <div class="mvu-unified-card mvu-unified-card--featured clickable" data-unified-card="world-hero" data-unified-surface="panel"></div>
                <div class="mvu-unified-card clickable" data-preview="全息编年史" data-detail-mode="embed" data-unified-card="world-timeline" data-unified-surface="panel"></div>
              </div>
            </section>
          </section>

          <section class="mvu-unified-page" :class="{ active: tabState.current === 'page-org' }" data-target="page-org">
            <section class="mvu-unified-section mvu-unified-section--dashboard">
              <div class="mvu-unified-dashboard mvu-unified-dashboard--org">
                <div class="mvu-unified-card mvu-unified-card--featured clickable" data-preview="势力矩阵总览" data-detail-mode="embed" data-unified-card="org-hero" data-unified-surface="panel"></div>
                <div class="mvu-unified-card clickable" data-preview="我的阵营详情" data-detail-mode="embed" data-unified-card="org-faction" data-unified-surface="panel"></div>
                <div class="mvu-unified-card clickable" data-preview="本地据点详情" data-detail-mode="embed" data-unified-card="org-node" data-unified-surface="panel"></div>
              </div>
            </section>
          </section>

          <section class="mvu-unified-page" :class="{ active: tabState.current === 'page-terminal' }" data-target="page-terminal">
            <section class="mvu-unified-section mvu-unified-section--dashboard">
              <div class="mvu-unified-dashboard mvu-unified-dashboard--terminal">
                <div class="mvu-unified-card mvu-unified-card--featured clickable" data-preview="系统播报与日志" data-detail-mode="embed" data-unified-card="terminal-hero" data-unified-surface="panel"></div>
                <div class="mvu-unified-card clickable" data-preview="试炼与情报" data-detail-mode="embed" data-unified-card="terminal-intel" data-unified-surface="panel"></div>
                <div class="mvu-unified-card clickable" data-preview="怪物图鉴" data-detail-mode="embed" data-unified-card="terminal-bestiary" data-unified-surface="panel"></div>
                <div class="mvu-unified-card clickable" data-preview="任务界面" data-detail-mode="embed" data-unified-card="terminal-quest" data-unified-surface="panel"></div>
              </div>
            </section>
          </section>
        </div>

        <section v-show="detailState.isOpen" class="mvu-unified-detail-page" :data-unified-detail-preview="detailState.previewKey">
          <div ref="detailHostRef" class="mvu-unified-detail-host" data-unified-detail-host></div>
        </section>
      </div>
    </div>
  `,
  setup() {
    const activeMeta = computed(() => resolveUnifiedTabMeta(mvuTabState.current));
    const detailHostRef = ref(null);
    const detailState = mvuUnifiedDetailState;
    const 上次详情标题 = ref('详情');
    const 读取当前详情标题 = () => {
      const 预览键 = String(detailState.previewKey || '').trim();
      const 默认标题 = activeMeta.value && activeMeta.value.title ? activeMeta.value.title : '详情';
      const 标题 = String(resolveShellPreviewTitle(预览键, 默认标题) || '').trim();
      return 标题 || 上次详情标题.value || 默认标题 || '详情';
    };
    watch(
      () => [detailState.previewKey, activeMeta.value && activeMeta.value.title],
      () => {
        const 标题 = 读取当前详情标题();
        if (标题) 上次详情标题.value = 标题;
      },
      { immediate: true }
    );
    const 详情标题 = computed(() => 读取当前详情标题());
    const 详情路径标题 = computed(() => {
      const 页面标题 = String(activeMeta.value && activeMeta.value.title ? activeMeta.value.title : '详情').trim();
      const 标题 = String(详情标题.value || '').trim();
      if (页面标题 && 标题 && 页面标题 !== 标题) return `${页面标题} · ${标题}`;
      return 标题 || 页面标题 || '详情';
    });
    let removeDetailWheelBridge = null;
    const 清理顶层浮窗 = () => {
      if (typeof window.__MVU_CLEAR_FLOATING_HOVER__ === 'function') {
        try { window.__MVU_CLEAR_FLOATING_HOVER__(); } catch (err) {}
      }
    };
    const isVerticallyScrollable = element => {
      if (!(element instanceof HTMLElement)) return false;
      try {
        const style = window.getComputedStyle(element);
        const overflowY = style ? style.overflowY : '';
        return (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay')
          && element.scrollHeight > element.clientHeight + 2;
      } catch (err) {
        return false;
      }
    };
    const findInnerScrollableForWheel = target => {
      const host = detailHostRef.value;
      let current = target instanceof HTMLElement ? target : host;
      while (current && current instanceof HTMLElement) {
        if (current === host) break;
        if (isVerticallyScrollable(current)) return current;
        current = current.parentElement;
      }
      return isVerticallyScrollable(host) ? host : null;
    };
    const getChatScrollTarget = () => {
      const chat = document.getElementById('chat');
      return chat instanceof HTMLElement ? chat : null;
    };
    const handleUnifiedDetailWheel = event => {
      if (!(event instanceof WheelEvent) || event.ctrlKey) return;
      const host = detailHostRef.value;
      if (!(host instanceof HTMLElement) || !host.isConnected) return;
      const deltaY = Number(event.deltaY || 0);
      if (!Number.isFinite(deltaY) || Math.abs(deltaY) < 1 || Math.abs(deltaY) < Math.abs(Number(event.deltaX || 0))) return;
      const scrollable = findInnerScrollableForWheel(event.target);
      if (!scrollable) return;
      const maxScrollTop = Math.max(0, scrollable.scrollHeight - scrollable.clientHeight);
      const currentTop = Number(scrollable.scrollTop || 0);
      const canScrollUp = currentTop > 1;
      const canScrollDown = currentTop < maxScrollTop - 1;
      if ((deltaY < 0 && canScrollUp) || (deltaY > 0 && canScrollDown)) return;
      const chat = getChatScrollTarget();
      if (!chat || chat.scrollHeight <= chat.clientHeight + 2) return;
      event.preventDefault();
      chat.scrollTop += deltaY;
    };
    const bindDetailWheelBridge = () => {
      if (typeof removeDetailWheelBridge === 'function') {
        removeDetailWheelBridge();
        removeDetailWheelBridge = null;
      }
      const host = detailHostRef.value;
      if (!(host instanceof HTMLElement)) return;
      host.addEventListener('wheel', handleUnifiedDetailWheel, { passive: false });
      removeDetailWheelBridge = () => {
        host.removeEventListener('wheel', handleUnifiedDetailWheel, { passive: false });
      };
    };
    const getDetailScrollTarget = () => {
      let current = detailHostRef.value ? detailHostRef.value.closest('.mvu-unified-frame') : document.getElementById('mvu-unified-mount');
      while (current && current !== document.body) {
        try {
          const style = window.getComputedStyle(current);
          const overflowY = style ? style.overflowY : '';
          if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight + 2) {
            return current;
          }
        } catch (err) {}
        current = current.parentElement;
      }
      return document.scrollingElement || document.documentElement || document.body;
    };
    const scheduleFrameTask = task => {
      const run = () => {
        if (typeof task === 'function') task();
      };
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => window.requestAnimationFrame(run));
      } else {
        window.setTimeout(run, 0);
      }
    };
    const syncUnifiedFrameViewport = () => {
      const frame = (detailHostRef.value && detailHostRef.value.closest('.mvu-unified-frame'))
        || document.querySelector('#mvu-unified-mount .mvu-unified-frame');
      if (!frame || !frame.isConnected) return;
      const 视口高度 = Number(window.innerHeight) || Number(document.documentElement.clientHeight) || 720;
      const 发送栏 = document.getElementById('send_form');
      const 发送栏矩形 = 发送栏 ? 发送栏.getBoundingClientRect() : null;
      const 底部边界 = 发送栏矩形 && 发送栏矩形.top > 80 && 发送栏矩形.top < 视口高度
        ? 发送栏矩形.top - 10
        : 视口高度 - 10;
      const 顶部边界 = 42;
      const 状态栏目标高度 = 视口高度 * 0.86;
      const 状态栏高度上限 = 940;
      const 状态栏高度下限 = Math.min(760, Math.max(620, 视口高度 - 72));
      const 状态栏最大高度 = Math.max(状态栏高度下限, Math.min(状态栏高度上限, 状态栏目标高度));
      const 统一挂载 = frame.closest('#mvu-unified-mount') || frame.parentElement || frame;
      统一挂载.style.setProperty('--mvu-unified-frame-max-height', `${Math.floor(状态栏最大高度)}px`);
      frame.style.setProperty('--mvu-unified-frame-max-height', `${Math.floor(状态栏最大高度)}px`);

      const detailHost = detailHostRef.value;
      if (detailHost && detailHost.isConnected) {
        const toolbar = frame.querySelector('.mvu-unified-toolbar');
        const toolbarHeight = toolbar ? toolbar.getBoundingClientRect().height : 64;
        const 详情页 = frame.querySelector('.mvu-unified-detail-page');
        const 详情页高度 = 详情页 ? 详情页.getBoundingClientRect().height : 0;
        const 详情最大高度 = Math.max(420, 详情页高度 || (状态栏最大高度 - toolbarHeight - 18));
        detailHost.style.setProperty('--mvu-unified-detail-max-height', `${Math.floor(详情最大高度)}px`);
      }

      const scrollTarget = getDetailScrollTarget();
      const scrollByAmount = amount => {
        if (!Number.isFinite(amount) || Math.abs(amount) < 1) return;
        if (scrollTarget === document.scrollingElement || scrollTarget === document.documentElement || scrollTarget === document.body) {
          window.scrollBy({ top: amount, behavior: 'auto' });
        } else if (scrollTarget) {
          scrollTarget.scrollTop += amount;
        }
      };

      let frameRect = frame.getBoundingClientRect();
      const bottomOverflow = frameRect.bottom - 底部边界;
      if (bottomOverflow > 1) {
        scrollByAmount(bottomOverflow);
        frameRect = frame.getBoundingClientRect();
      }
      const topOverflow = 顶部边界 - frameRect.top;
      if (topOverflow > 1) {
        scrollByAmount(-topOverflow);
      }
    };
    const scheduleUnifiedFrameViewportSync = () => {
      scheduleFrameTask(syncUnifiedFrameViewport);
      [120, 360, 760].forEach(delay => {
        window.setTimeout(syncUnifiedFrameViewport, delay);
      });
    };
    const rememberReturnScroll = () => {
      const target = getDetailScrollTarget();
      detailState.returnScrollTop = target === document.scrollingElement || target === document.documentElement || target === document.body
        ? Number(window.scrollY) || Number(target.scrollTop) || 0
        : Number(target.scrollTop) || 0;
    };
    const restoreReturnScroll = () => {
      const target = getDetailScrollTarget();
      const nextTop = Math.max(0, Number(detailState.returnScrollTop) || 0);
      if (target === document.scrollingElement || target === document.documentElement || target === document.body) {
        window.scrollTo({ top: nextTop, behavior: 'auto' });
      } else {
        target.scrollTop = nextTop;
      }
    };
    const 标记待渲染详情 = 预览键 => {
      const 详情宿主 = detailHostRef.value;
      if (!(详情宿主 instanceof HTMLElement) || !详情宿主.isConnected) return;
      const 当前预览键 = String(详情宿主.dataset.unifiedPreview || '').trim();
      const 目标预览键 = String(预览键 || '').trim();
      if (!目标预览键 || 当前预览键 === 目标预览键) return;
      详情宿主.innerHTML = '';
      delete 详情宿主.dataset.unifiedPreview;
    };
    const requestUnifiedDetailRender = (options = {}) => {
      const nextPreviewKey = String(detailState.previewKey || '').trim();
      const 重试次数 = Number(options.重试次数 || 0);
      scheduleFrameTask(() => {
        const host = detailHostRef.value;
        if (!host || !host.isConnected || !nextPreviewKey || !detailState.isOpen) return;
        if (typeof window.__MVU_RENDER_UNIFIED_PREVIEW__ !== 'function') {
          if (重试次数 < 8) {
            window.setTimeout(() => requestUnifiedDetailRender({ ...options, 重试次数: 重试次数 + 1 }), 80);
          }
          return;
        }
        try {
          const rendered = window.__MVU_RENDER_UNIFIED_PREVIEW__(nextPreviewKey, { ...options, host });
          if (rendered === false && detailState.previewKey === nextPreviewKey) {
            closeUnifiedDetail({ force: true });
            return;
          }
          const 已渲染预览键 = String(host.dataset.unifiedPreview || '').trim();
          if (detailState.previewKey === nextPreviewKey && 已渲染预览键 !== nextPreviewKey) {
            if (重试次数 < 8) {
              window.setTimeout(
                () => requestUnifiedDetailRender({ ...options, force: true, 重试次数: 重试次数 + 1 }),
                80,
              );
            }
            return;
          }
          syncUnifiedFrameViewport();
        } catch (err) {
          if (重试次数 < 8) {
            window.setTimeout(() => requestUnifiedDetailRender({ ...options, force: true, 重试次数: 重试次数 + 1 }), 80);
          }
        }
      });
    };
    const openUnifiedPreview = (previewKey, options = {}) => {
      const nextPreviewKey = String(previewKey || '').trim();
      if (!nextPreviewKey) return false;
      const 下一个详情标题 = String(resolveShellPreviewTitle(nextPreviewKey, activeMeta.value && activeMeta.value.title ? activeMeta.value.title : '详情') || '').trim();
      if (下一个详情标题) 上次详情标题.value = 下一个详情标题;
      清理顶层浮窗();
      if (!detailState.isOpen) {
        detailState.returnTab = normalizeTabId(mvuTabState.current);
        detailState.stack.splice(0);
        rememberReturnScroll();
      } else if (!options.replace && detailState.previewKey && detailState.previewKey !== nextPreviewKey) {
        detailState.stack.push(detailState.previewKey);
      }
      detailState.previewKey = nextPreviewKey;
      detailState.isOpen = true;
      标记待渲染详情(nextPreviewKey);
      requestUnifiedDetailRender(options);
      scheduleUnifiedFrameViewportSync();
      return true;
    };
    const closeUnifiedDetail = (options = {}) => {
      清理顶层浮窗();
      if (!options.force && detailState.stack.length) {
        detailState.previewKey = detailState.stack.pop() || '';
        requestUnifiedDetailRender({ replace: true });
        return;
      }
      detailState.isOpen = false;
      detailState.previewKey = '';
      detailState.stack.splice(0);
      if (typeof window.__MVU_CLEAR_UNIFIED_PREVIEW__ === 'function') {
        try { window.__MVU_CLEAR_UNIFIED_PREVIEW__(); } catch (err) {}
      }
      requestTabChange(normalizeTabId(detailState.returnTab));
      forceUnifiedCardSync();
      scheduleUnifiedFrameViewportSync();
      scheduleFrameTask(restoreReturnScroll);
    };
    const requestMapSurfaceSync = () => {
      if (typeof window.__sheepMapResync !== 'function') return;
      window.setTimeout(() => {
        try { window.__sheepMapResync({ center: false, syncVisual: false }); } catch (err) {}
        if (typeof window.__MVU_CLAMP_UNIFIED_MAP_CANVAS__ === 'function') {
          try { window.__MVU_CLAMP_UNIFIED_MAP_CANVAS__(); } catch (err) {}
          window.setTimeout(() => {
            try { window.__MVU_CLAMP_UNIFIED_MAP_CANVAS__(); } catch (err) {}
          }, 80);
        }
      }, 40);
    };
    const setUnifiedTab = tabId => {
      清理顶层浮窗();
      requestTabChange(tabId);
      scheduleUnifiedFrameViewportSync();
    };
    const forceUnifiedCardSync = () => {
      requestUnifiedShellCardRefresh({ force: true });
    };
    const handleDesktopUnifiedResize = () => {
      scheduleUnifiedFrameViewportSync();
      forceUnifiedCardSync();
    };
    onMounted(() => {
      window.__MVU_OPEN_UNIFIED_PREVIEW__ = openUnifiedPreview;
      window.__MVU_CLOSE_UNIFIED_PREVIEW__ = closeUnifiedDetail;
      window.__MVU_GET_UNIFIED_DETAIL_HOST__ = () => detailHostRef.value;
      window.addEventListener('resize', handleDesktopUnifiedResize);
      bindDetailWheelBridge();
      scheduleUnifiedFrameViewportSync();
      forceUnifiedCardSync();
      if (mvuTabState.current === 'page-map') {
        requestMapSurfaceSync();
      }
      if (detailState.isOpen && detailState.previewKey) {
        requestUnifiedDetailRender({ force: true, replace: true });
      }
    });
    onUnmounted(() => {
      window.removeEventListener('resize', handleDesktopUnifiedResize);
      if (typeof removeDetailWheelBridge === 'function') {
        removeDetailWheelBridge();
        removeDetailWheelBridge = null;
      }
      if (window.__MVU_OPEN_UNIFIED_PREVIEW__ === openUnifiedPreview) delete window.__MVU_OPEN_UNIFIED_PREVIEW__;
      if (window.__MVU_CLOSE_UNIFIED_PREVIEW__ === closeUnifiedDetail) delete window.__MVU_CLOSE_UNIFIED_PREVIEW__;
      if (typeof window.__MVU_GET_UNIFIED_DETAIL_HOST__ === 'function' && window.__MVU_GET_UNIFIED_DETAIL_HOST__() === detailHostRef.value) {
        delete window.__MVU_GET_UNIFIED_DETAIL_HOST__;
      }
    });
    watch(() => mvuTabState.current, () => {
      scheduleUnifiedFrameViewportSync();
    });
    return {
      tabs: TAB_ITEMS,
      activeMeta,
      closeUnifiedDetail,
      detailHostRef,
      detailState,
      详情路径标题,
      tabState: mvuTabState,
      layoutState: mvuLayoutState,
      setTab: setUnifiedTab,
    };
  }
};

const UnifiedLayoutRoot = {
  components: {
    DesktopUnifiedLayout
  },
  template: `
    <div class="mvu-unified-layout-host">
      <desktop-unified-layout></desktop-unified-layout>
    </div>
  `,
  setup() {
    return {
      layoutState: mvuLayoutState
    };
  }
};

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
  if (!unifiedMount.__mvuVueMounted) {
    createApp(UnifiedLayoutRoot).mount(unifiedMount);
    unifiedMount.__mvuVueMounted = true;
  }
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
  if (typeof window.__MVU_SYNC_DETAIL_MODAL_HOST__ === 'function') {
    try { window.__MVU_SYNC_DETAIL_MODAL_HOST__(); } catch (err) {}
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountMvuVue);
} else {
  mountMvuVue();
}

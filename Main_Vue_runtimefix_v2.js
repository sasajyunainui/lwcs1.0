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

const SHELL_TAB_ITEMS = TAB_ITEMS;

const UNIFIED_ACTION_ITEMS = {
  'page-archive': [
    { label: '角色', preview: '角色切换器' },
    { label: '武装', preview: '武装工坊详细页' },
    { label: '仓库', preview: '储物仓库详细页' }
  ],
  'page-map': [
    { label: '节点', preview: '当前节点详情' },
    { label: '跑图', preview: '图层控制与跑图' },
    { label: '星图', preview: '全息星图主画布' }
  ],
  'page-world': [
    { label: '编年史', preview: '全息编年史' }
  ],
  'page-org': [
    { label: '阵营', preview: '我的阵营详情' },
    { label: '据点', preview: '本地据点详情' }
  ],
  'page-terminal': [
    { label: '情报', preview: '试炼与情报' },
    { label: '任务', preview: '任务界面' },
    { label: '图鉴', preview: '怪物图鉴' }
  ]
};

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

const SHELL_APP_ITEMS = [
  {
    id: 'page-archive',
    title: '档案',
    hint: '',
    homeSlot: 'home-archive'
  },
  {
    id: 'page-map',
    title: '星图',
    hint: '',
    homeSlot: 'home-map'
  },
  {
    id: 'page-world',
    title: '世界',
    hint: '',
    homeSlot: 'home-world'
  },
  {
    id: 'page-org',
    title: '势力',
    hint: '',
    homeSlot: 'home-org'
  },
  {
    id: 'page-terminal',
    title: '终端',
    hint: '',
    homeSlot: 'home-terminal'
  }
];

const LAYOUT_STORAGE_KEY = 'mvu_layout_mode';
const SURFACE_MODE_STORAGE_KEY = 'mvu_surface_mode_v1';
const SURFACE_LAUNCHER_STORAGE_KEY = 'mvu_surface_launcher_pos_v2';
const MOBILE_LAST_TAB_STORAGE_KEY = 'mvu_mobile_shell_last_tab_v1';
const MOBILE_VIEWPORT_MEDIA = '(max-width: 860px)';
const VALID_LAYOUT_MODES = new Set(['unified']);
const VALID_SURFACE_MODES = new Set(['panel', 'shell']);
const SURFACE_LAUNCHER_GAP = 12;
const SURFACE_LAUNCHER_DRAG_THRESHOLD = 8;
const SURFACE_LAUNCHER_LONG_PRESS_MS = 360;
const SURFACE_LAUNCHER_MOBILE_SIZE = { width: 56, height: 56 };
const SURFACE_LAUNCHER_DESKTOP_SIZE = { width: 56, height: 56 };

function detectMobileViewport() {
  try {
    if (typeof window.matchMedia === 'function') {
      return window.matchMedia(MOBILE_VIEWPORT_MEDIA).matches;
    }
  } catch (err) {}
  return window.innerWidth <= 860;
}

function normalizeLayoutMode(mode) {
  const value = String(mode || '').trim();
  return VALID_LAYOUT_MODES.has(value) ? value : '';
}

function normalizeSurfaceMode(mode) {
  const value = String(mode || '').trim();
  return VALID_SURFACE_MODES.has(value) ? value : '';
}

function normalizeTabId(tabId) {
  const value = String(tabId || '').trim();
  return TAB_ITEMS.some(tab => tab.id === value) ? value : 'page-archive';
}

function normalizeShellTabId(tabId) {
  const value = String(tabId || '').trim();
  return SHELL_TAB_ITEMS.some(tab => tab.id === value) ? value : 'page-archive';
}

function readJsonStorage(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function writeJsonStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {}
}

function readLayoutModeStorage() {
  try {
    return normalizeLayoutMode(window.localStorage.getItem(LAYOUT_STORAGE_KEY));
  } catch (err) {
    return '';
  }
}

function writeLayoutModeStorage(mode) {
  const normalized = normalizeLayoutMode(mode);
  if (!normalized) return;
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, normalized);
  } catch (err) {}
}

function readSurfaceModeStorage() {
  try {
    return normalizeSurfaceMode(window.localStorage.getItem(SURFACE_MODE_STORAGE_KEY));
  } catch (err) {
    return '';
  }
}

function writeSurfaceModeStorage(mode) {
  const normalized = normalizeSurfaceMode(mode);
  if (!normalized) return;
  try {
    window.localStorage.setItem(SURFACE_MODE_STORAGE_KEY, normalized);
  } catch (err) {}
}

function readMobileLastTabStorage() {
  try {
    return normalizeShellTabId(window.localStorage.getItem(MOBILE_LAST_TAB_STORAGE_KEY));
  } catch (err) {
    return 'page-archive';
  }
}

function writeMobileLastTabStorage(tabId) {
  const normalized = normalizeShellTabId(tabId);
  try {
    window.localStorage.setItem(MOBILE_LAST_TAB_STORAGE_KEY, normalized);
  } catch (err) {}
}

function normalizeSurfaceLauncherPosition(rawPosition) {
  if (!rawPosition || typeof rawPosition !== 'object') return null;
  const x = Number(rawPosition.x);
  const y = Number(rawPosition.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function normalizeSurfaceLauncherStorage(rawStorage) {
  if (!rawStorage || typeof rawStorage !== 'object') {
    return { desktop: null, mobile: null };
  }
  return {
    desktop: normalizeSurfaceLauncherPosition(rawStorage.desktop),
    mobile: normalizeSurfaceLauncherPosition(rawStorage.mobile)
  };
}

function getSurfaceLauncherViewportKey(viewportType = null) {
  const value = String(viewportType || '').trim();
  if (value === 'desktop' || value === 'mobile') return value;
  return mvuLayoutState && mvuLayoutState.isMobileViewport ? 'mobile' : 'desktop';
}

function readSurfaceLauncherStorage() {
  return normalizeSurfaceLauncherStorage(readJsonStorage(SURFACE_LAUNCHER_STORAGE_KEY));
}

function readSurfaceLauncherPosition(viewportType = null) {
  const key = getSurfaceLauncherViewportKey(viewportType);
  return readSurfaceLauncherStorage()[key];
}

function writeSurfaceLauncherPosition(position, viewportType = null) {
  const normalized = normalizeSurfaceLauncherPosition(position);
  if (!normalized) return;
  const key = getSurfaceLauncherViewportKey(viewportType);
  const current = readSurfaceLauncherStorage();
  current[key] = {
    x: Math.round(normalized.x),
    y: Math.round(normalized.y)
  };
  writeJsonStorage(SURFACE_LAUNCHER_STORAGE_KEY, current);
}

function resolveUnifiedActions(tabId) {
  return UNIFIED_ACTION_ITEMS[tabId] || UNIFIED_ACTION_ITEMS['page-archive'] || [];
}

function resolveUnifiedTabMeta(tabId) {
  return UNIFIED_TAB_META[tabId] || UNIFIED_TAB_META['page-archive'];
}

function resolveShellAppMeta(tabId) {
  const normalized = normalizeShellTabId(tabId);
  const activeTab = SHELL_TAB_ITEMS.find(tab => tab.id === normalized) || SHELL_TAB_ITEMS[0];
  return {
    id: activeTab.id,
    title: activeTab.label,
    icon: activeTab.icon
  };
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

const persistedLayoutMode = readLayoutModeStorage();
const persistedSurfaceMode = readSurfaceModeStorage();
const initialIsMobileViewport = detectMobileViewport();
const mvuLayoutState = window.__MVU_LAYOUT_STATE__ || (window.__MVU_LAYOUT_STATE__ = reactive({
  preferredMode: persistedLayoutMode || 'unified',
  effectiveMode: 'unified',
  unifiedAnchorReady: false,
  isMobileViewport: initialIsMobileViewport,
  hasManualOverride: !!persistedLayoutMode,
  surfaceMode: 'panel',
  mobileShellOpen: false,
  surfaceLauncherMenuOpen: false,
  surfaceLauncherPosition: readSurfaceLauncherPosition(initialIsMobileViewport ? 'mobile' : 'desktop'),
  surfaceLauncherDragging: false
}));

if (!('hasManualOverride' in mvuLayoutState)) {
  mvuLayoutState.hasManualOverride = !!persistedLayoutMode;
}
if (!('unifiedAnchorReady' in mvuLayoutState)) {
  mvuLayoutState.unifiedAnchorReady = false;
}
if (!('mobileShellOpen' in mvuLayoutState)) {
  mvuLayoutState.mobileShellOpen = false;
}
if (!('surfaceMode' in mvuLayoutState)) {
  mvuLayoutState.surfaceMode = 'panel';
}
if (!('surfaceLauncherMenuOpen' in mvuLayoutState)) {
  mvuLayoutState.surfaceLauncherMenuOpen = false;
}
if (!('surfaceLauncherPosition' in mvuLayoutState)) {
  mvuLayoutState.surfaceLauncherPosition = readSurfaceLauncherPosition(initialIsMobileViewport ? 'mobile' : 'desktop');
}
if (!('surfaceLauncherDragging' in mvuLayoutState)) {
  mvuLayoutState.surfaceLauncherDragging = false;
}
if (!normalizeLayoutMode(mvuLayoutState.preferredMode)) {
  mvuLayoutState.preferredMode = persistedLayoutMode || 'unified';
}
if (!mvuLayoutState.hasManualOverride) {
  mvuLayoutState.preferredMode = 'unified';
}
if (!normalizeSurfaceMode(mvuLayoutState.surfaceMode)) {
  mvuLayoutState.surfaceMode = 'panel';
}
mvuLayoutState.surfaceMode = 'panel';
mvuLayoutState.mobileShellOpen = false;

const mvuTabState = window.__MVU_TAB_STATE__ || (window.__MVU_TAB_STATE__ = reactive({ current: readMobileLastTabStorage() }));
const mvuUnifiedDetailState = window.__MVU_UNIFIED_DETAIL_STATE__ || (window.__MVU_UNIFIED_DETAIL_STATE__ = reactive({
  isOpen: false,
  previewKey: '',
  returnTab: mvuTabState.current,
  stack: [],
  returnScrollTop: 0
}));
if (!mvuLayoutState.surfaceLauncherPosition || !Number.isFinite(Number(mvuLayoutState.surfaceLauncherPosition.x)) || !Number.isFinite(Number(mvuLayoutState.surfaceLauncherPosition.y))) {
  mvuLayoutState.surfaceLauncherPosition = readSurfaceLauncherPosition(initialIsMobileViewport ? 'mobile' : 'desktop');
}
mvuTabState.current = normalizeTabId(mvuTabState.current);
if (!Array.isArray(mvuUnifiedDetailState.stack)) mvuUnifiedDetailState.stack = [];
mvuUnifiedDetailState.returnTab = normalizeTabId(mvuUnifiedDetailState.returnTab || mvuTabState.current);

function getViewportSize() {
  const width = Math.max(0, Number(window.innerWidth) || Number(document.documentElement?.clientWidth) || 0);
  const height = Math.max(0, Number(window.innerHeight) || Number(document.documentElement?.clientHeight) || 0);
  return { width, height };
}

function getSurfaceLauncherSize(viewportType = null) {
  return getSurfaceLauncherViewportKey(viewportType) === 'mobile'
    ? { ...SURFACE_LAUNCHER_MOBILE_SIZE }
    : { ...SURFACE_LAUNCHER_DESKTOP_SIZE };
}

function getSurfaceLauncherBounds(options = {}) {
  const viewportType = getSurfaceLauncherViewportKey(options.viewportType);
  const size = options.size || getSurfaceLauncherSize(viewportType);
  const viewport = getViewportSize();
  const safeGap = SURFACE_LAUNCHER_GAP;
  let minY = safeGap;
  let maxY = Math.max(minY, viewport.height - size.height - safeGap);
  let minX = safeGap;
  let maxX = Math.max(minX, viewport.width - size.width - safeGap);

  const topToolbar = Array.from(document.querySelectorAll('body > *')).find(node => {
    if (!(node instanceof Element) || node.id === 'mvu-unified-mount' || node.id === 'detailModal') return false;
    const style = window.getComputedStyle(node);
    if (!style || style.display === 'none' || style.visibility === 'hidden') return false;
    if (style.position !== 'fixed' && style.position !== 'sticky') return false;
    const rect = node.getBoundingClientRect();
    return rect.top <= 4 && rect.height >= 36 && rect.width >= viewport.width * 0.5;
  });
  if (topToolbar) {
    minY = Math.max(minY, topToolbar.getBoundingClientRect().bottom + safeGap);
  }

  const sendForm = document.getElementById('send_form');
  if (sendForm) {
    const rect = sendForm.getBoundingClientRect();
    if (rect.height > 0) {
      maxY = Math.min(maxY, rect.top - size.height - safeGap);
    }
  }

  return {
    minX,
    maxX: Math.max(minX, maxX),
    minY,
    maxY: Math.max(minY, maxY)
  };
}

function clampSurfaceLauncherPosition(position, options = {}) {
  const bounds = getSurfaceLauncherBounds(options);
  const nextX = Number(position && position.x);
  const nextY = Number(position && position.y);
  const fallbackX = bounds.minX;
  const fallbackY = bounds.maxY;
  return {
    x: _.clamp(Number.isFinite(nextX) ? nextX : fallbackX, bounds.minX, bounds.maxX),
    y: _.clamp(Number.isFinite(nextY) ? nextY : fallbackY, bounds.minY, bounds.maxY)
  };
}

function getDefaultSurfaceLauncherPosition(viewportType = null) {
  const resolvedViewportType = getSurfaceLauncherViewportKey(viewportType);
  const bounds = getSurfaceLauncherBounds({ viewportType: resolvedViewportType });
  if (resolvedViewportType === 'mobile') {
    const optionsButton = document.getElementById('options_button');
    const preferredX = optionsButton ? optionsButton.getBoundingClientRect().left : bounds.minX;
    return clampSurfaceLauncherPosition({
      x: preferredX,
      y: bounds.maxY
    }, { viewportType: resolvedViewportType });
  }
  return clampSurfaceLauncherPosition({
    x: bounds.maxX,
    y: bounds.maxY
  }, { viewportType: resolvedViewportType });
}

function syncSurfaceLauncherPosition(options = {}) {
  const forceDefault = !!options.forceDefault;
  const viewportType = getSurfaceLauncherViewportKey(options.viewportType);
  const current = !forceDefault && mvuLayoutState.surfaceLauncherPosition
    ? mvuLayoutState.surfaceLauncherPosition
    : null;
  const stored = !forceDefault && readSurfaceLauncherPosition(viewportType);
  const nextPosition = clampSurfaceLauncherPosition(current || stored || getDefaultSurfaceLauncherPosition(viewportType), { viewportType });
  mvuLayoutState.surfaceLauncherPosition = nextPosition;
  if (options.persist !== false) {
    writeSurfaceLauncherPosition(nextPosition, viewportType);
  }
  return nextPosition;
}

function resolveSurfaceLauncherDisplayPosition(position = null) {
  const viewportType = getSurfaceLauncherViewportKey();
  const basePosition = clampSurfaceLauncherPosition(
    position || mvuLayoutState.surfaceLauncherPosition || getDefaultSurfaceLauncherPosition(viewportType),
    { viewportType }
  );
  if (viewportType === 'mobile' || mvuLayoutState.surfaceMode !== 'shell' || !mvuLayoutState.mobileShellOpen) {
    return basePosition;
  }
  const bounds = getSurfaceLauncherBounds({ viewportType });
  const midpointX = (bounds.minX + bounds.maxX) / 2;
  return {
    x: basePosition.x >= midpointX ? bounds.maxX : bounds.minX,
    y: _.clamp(basePosition.y, bounds.minY, bounds.maxY)
  };
}

function closeDetailModalIfPossible() {
  if (typeof window.__MVU_CLOSE_UNIFIED_PREVIEW__ === 'function') {
    try { window.__MVU_CLOSE_UNIFIED_PREVIEW__({ force: true }); } catch (err) {}
  }
  if (typeof window.__MVU_CLOSE_DETAIL_MODAL__ === 'function') {
    try { window.__MVU_CLOSE_DETAIL_MODAL__(); } catch (err) {}
  }
}

function isShellSurfaceMode() {
  return false;
}

function isDesktopShellMode() {
  return false;
}

function getDesktopModeSelection() {
  return 'unified';
}

function setMobileShellOpen() {
  mvuLayoutState.mobileShellOpen = false;
  mvuLayoutState.surfaceLauncherDragging = false;
  mvuLayoutState.surfaceLauncherMenuOpen = false;
  mvuLayoutState.surfaceMode = 'panel';
  applyLayoutBodyClasses();
  if (typeof window.__MVU_SYNC_DETAIL_MODAL_HOST__ === 'function') {
    try { window.__MVU_SYNC_DETAIL_MODAL_HOST__(); } catch (err) {}
  }
  return false;
}

window.__MVU_SET_MOBILE_SHELL_OPEN__ = value => setMobileShellOpen(value);

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

function setSurfaceMode(mode, options = {}) {
  mvuLayoutState.surfaceMode = 'panel';
  mvuLayoutState.mobileShellOpen = false;
  mvuLayoutState.surfaceLauncherDragging = false;
  mvuLayoutState.surfaceLauncherMenuOpen = false;

  if (options.manual !== false) {
    writeSurfaceModeStorage('panel');
  }

  syncUnifiedMountPlacement();
  applyLayoutBodyClasses();
  if (typeof window.__MVU_SYNC_DETAIL_MODAL_HOST__ === 'function') {
    try { window.__MVU_SYNC_DETAIL_MODAL_HOST__(); } catch (err) {}
  }
  return 'panel';
}

function openShellSurface() {
  setSurfaceMode('panel');
  return false;
}

function closeShellSurface() {
  return setMobileShellOpen();
}

function exitShellSurface() {
  if (mvuLayoutState.mobileShellOpen) {
    closeDetailModalIfPossible();
  }
  return setSurfaceMode('panel');
}

function toggleShellSurface() {
  return false;
}

function setDesktopMode(mode, options = {}) {
  setSurfaceMode('panel', options);
  return setLayoutMode('unified', options);
}

function applyDesktopLayoutSelection(mode, options = {}) {
  return setDesktopMode('unified', options);
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
  body.classList.toggle('mvu-mobile-viewport', !!mvuLayoutState.isMobileViewport);
  body.classList.toggle('mvu-shell-overlay-enabled', false);
  body.classList.toggle('mvu-surface-panel', true);
  body.classList.toggle('mvu-surface-shell', false);
  body.classList.toggle('mvu-desktop-shell-surface', false);
  body.classList.toggle('mvu-layout-unified-locked', false);
  body.classList.toggle('mvu-mobile-shell-open', false);
  body.classList.toggle('mvu-surface-launcher-menu-open', false);
  body.classList.toggle('mvu-mobile-shell-dragging', false);
}

function isSplitLayoutAllowed() {
  return false;
}

function resolveEffectiveLayoutMode() {
  return 'unified';
}

function syncLayoutMode() {
  mvuLayoutState.effectiveMode = resolveEffectiveLayoutMode();
  applyLayoutBodyClasses();
  return mvuLayoutState.effectiveMode;
}

function setLayoutMode(mode, options = {}) {
  const normalized = normalizeLayoutMode(mode);
  if (!normalized) return mvuLayoutState.effectiveMode;
  const nextPreferred = normalized || 'unified';

  mvuLayoutState.preferredMode = nextPreferred;
  mvuLayoutState.surfaceMode = 'panel';
  mvuLayoutState.mobileShellOpen = false;
  mvuLayoutState.surfaceLauncherMenuOpen = false;
  mvuLayoutState.surfaceLauncherDragging = false;
  if (options.manual !== false) {
    mvuLayoutState.hasManualOverride = true;
    writeLayoutModeStorage(nextPreferred);
  }
  if (nextPreferred === 'unified' && window.__MVU_UNIFIED_ANCHOR_MANAGER__ && typeof window.__MVU_UNIFIED_ANCHOR_MANAGER__.scheduleRelocate === 'function') {
    window.__MVU_UNIFIED_ANCHOR_MANAGER__.scheduleRelocate();
  }
  return syncLayoutMode();
}

function getLayoutMode() {
  return mvuLayoutState.effectiveMode;
}

function refreshViewportState() {
  const nextMobileState = detectMobileViewport();
  if (mvuLayoutState.isMobileViewport !== nextMobileState) {
    mvuLayoutState.isMobileViewport = nextMobileState;
  }
  if (!mvuLayoutState.hasManualOverride) {
    mvuLayoutState.preferredMode = 'unified';
  }
  mvuLayoutState.surfaceMode = 'panel';
  mvuLayoutState.mobileShellOpen = false;
  mvuLayoutState.surfaceLauncherMenuOpen = false;
  mvuLayoutState.surfaceLauncherDragging = false;
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
if (typeof window.matchMedia === 'function') {
  const mediaQuery = window.matchMedia(MOBILE_VIEWPORT_MEDIA);
  const onMediaChange = () => refreshViewportState();
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', onMediaChange);
    viewportDisposers.push(() => mediaQuery.removeEventListener('change', onMediaChange));
  } else if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(onMediaChange);
    viewportDisposers.push(() => mediaQuery.removeListener(onMediaChange));
  }
}

const onResize = () => refreshViewportState();
window.addEventListener('resize', onResize);
viewportDisposers.push(() => window.removeEventListener('resize', onResize));
window.__MVU_LAYOUT_VIEWPORT_CLEANUP__ = () => {
  for (const disposer of viewportDisposers) {
    try { disposer(); } catch (err) {}
  }
};

window.mvuSetLayoutMode = mode => setLayoutMode(mode, { manual: true });
window.mvuGetLayoutMode = () => getLayoutMode();
window.mvuSetSurfaceMode = () => setSurfaceMode('panel', { manual: true });
window.mvuGetDesktopMode = () => getDesktopModeSelection();
window.mvuSetDesktopMode = () => setDesktopMode('unified', { manual: true });

function setSharedTab(target) {
  mvuTabState.current = normalizeTabId(target);
}

window.__MVU_SET_TAB_STATE__ = setSharedTab;

function requestTabChange(target) {
  const next = normalizeTabId(target);
  setSharedTab(next);
  writeMobileLastTabStorage(next);
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
  const shouldUseOverlayHost = isShellSurfaceMode();
  if (shouldUseOverlayHost) {
    mountEl.style.position = 'fixed';
    mountEl.style.inset = '0';
    mountEl.style.width = '100vw';
    mountEl.style.height = '100dvh';
    mountEl.style.pointerEvents = 'none';
    mountEl.style.zIndex = '10040';
  } else {
    mountEl.style.position = 'relative';
    mountEl.style.inset = '';
    mountEl.style.width = '100%';
    mountEl.style.height = '';
    mountEl.style.pointerEvents = 'auto';
    mountEl.style.zIndex = '1000';
  }
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
    const shouldUseOverlayHost = isShellSurfaceMode();
    if (shouldUseOverlayHost) {
      if (document.body && mountEl.parentElement !== document.body) {
        document.body.appendChild(mountEl);
      }
      setReadyState(!!mountEl.isConnected);
      return;
    }
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

const UnifiedDock = {
  template: `
    <div class="mvu-unified-wrapper mvu-root">
      <div class="mvu-unified-dock">
        <div class="mvu-unified-hero">
          <div class="mvu-unified-hero-top">
            <div class="mvu-unified-status">
              <span class="mvu-unified-eyebrow">{{ activeMeta.eyebrow }}</span>
              <span class="mvu-unified-mode-badge">{{ modeBadge }}</span>
            </div>
            <div class="mvu-unified-layout-toggle">
              <button
                type="button"
                class="mvu-unified-layout-btn active"
                disabled
              >一体</button>
            </div>
          </div>
          <div class="mvu-unified-headline">
            <strong>{{ activeMeta.title }}</strong>
            <span>{{ activeMeta.desc }}</span>
          </div>
        </div>

        <div class="mvu-unified-section-head">
          <b>主导航</b>
          <span>先切页，再下钻详细视图</span>
        </div>

        <div class="mvu-unified-tab-grid">
          <button
            v-for="tab in tabs"
            :key="'unified-tab-' + tab.id"
            class="mvu-tab-btn mvu-unified-tab-btn mvu-unified-grid-btn"
            :class="{ active: tabState.current === tab.id }"
            :data-target="tab.id"
            @click="setTab(tab.id)"
          >{{ tab.label }}</button>
        </div>

        <div class="mvu-unified-section-head">
          <b>当前页快捷入口</b>
          <span>{{ quickActionHint }}</span>
        </div>

        <div class="mvu-unified-action-grid">
          <button
            v-for="item in quickActions"
            :key="'unified-action-' + item.preview"
            type="button"
            class="mvu-unified-action-btn mvu-unified-grid-btn clickable"
            :data-preview="item.preview"
          >{{ item.label }}</button>
        </div>
      </div>
    </div>
  `,
  setup() {
    const quickActions = computed(() => resolveUnifiedActions(mvuTabState.current));
    const activeMeta = computed(() => resolveUnifiedTabMeta(mvuTabState.current));
    const modeBadge = computed(() => (mvuLayoutState.isMobileViewport ? '移动端一体栏' : '桌面一体栏'));
    const quickActionHint = computed(() => `${quickActions.value.length || 0} 个入口`);
    return {
      tabs: TAB_ITEMS,
      quickActions,
      activeMeta,
      modeBadge,
      quickActionHint,
      tabState: mvuTabState,
      layoutState: mvuLayoutState,
      setTab: requestTabChange
    };
  }
};

const SurfaceLauncherShellLayout = {
  template: `
    <div class="mvu-mobile-shell-host mvu-root" :class="{ 'is-open': layoutState.mobileShellOpen, 'is-dragging': layoutState.surfaceLauncherDragging }">
      <div
        v-if="showLauncher"
        ref="launcherRef"
        class="mvu-surface-launcher"
        :class="{
          'is-mobile': layoutState.isMobileViewport,
          'is-open': shellVisible,
          'menu-open': layoutState.surfaceLauncherMenuOpen
        }"
        :data-mode="launcherMode"
        :style="launcherStyle"
        role="group"
        aria-label="LWCS 鎸備欢"
      >
        <button
          type="button"
          class="mvu-surface-launcher-main"
          :aria-label="launcherMainAriaLabel"
          @pointerdown="onLauncherPointerDown"
          @contextmenu.prevent="onLauncherContextMenu"
          @keydown.enter.prevent="onLauncherKeyboardAction"
          @keydown.space.prevent="onLauncherKeyboardAction"
        >
          <span class="mvu-surface-launcher-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="4.5" y="4.5" width="6.25" height="6.25" rx="1.8" fill="currentColor"></rect>
              <rect x="13.25" y="4.5" width="6.25" height="6.25" rx="1.8" fill="currentColor"></rect>
              <rect x="4.5" y="13.25" width="6.25" height="6.25" rx="1.8" fill="currentColor"></rect>
              <rect x="13.25" y="13.25" width="6.25" height="6.25" rx="1.8" fill="currentColor"></rect>
            </svg>
          </span>
          <span class="mvu-surface-launcher-dot" aria-hidden="true"></span>
        </button>

        <div
          v-if="showLauncherMenu"
          class="mvu-surface-launcher-menu"
          :class="{
            active: layoutState.surfaceLauncherMenuOpen,
            'align-end': launcherMenuAlign === 'end',
            'open-up': launcherMenuVertical === 'up'
          }"
          role="menu"
          aria-label="界面模式"
        >
          <button
            v-for="item in launcherModeItems"
            :key="'launcher-mode-' + item.id"
            type="button"
            class="mvu-surface-launcher-menu-item"
            :class="{ active: launcherMode === item.id }"
            role="menuitemradio"
            :aria-checked="launcherMode === item.id ? 'true' : 'false'"
            @click="selectLauncherMode(item.id)"
          >{{ item.label }}</button>
        </div>
      </div>

      <div class="mvu-mobile-shell-backdrop" :class="{ active: shellVisible }"></div>

      <section class="mvu-mobile-shell" :class="{ active: shellVisible }" aria-label="酒馆助手小手机框架">
        <div ref="shellFrameRef" class="mvu-mobile-shell-frame" :style="shellFrameStyle" :data-screen="shellScreen">
          <header class="mvu-mobile-shell-head" @pointerdown="onShellHeaderPointerDown">
            <div class="mvu-mobile-shell-head-main">
              <button
                v-if="showHomeBack"
                type="button"
                class="mvu-mobile-shell-back"
                aria-label="返回首页"
                @click="handleBack"
              >
                <span aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M15 18 9 12l6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
                  </svg>
                </span>
              </button>
              <div class="mvu-mobile-shell-head-copy">
                <strong class="mvu-mobile-shell-title">{{ resolvedActiveTitle }}</strong>
              </div>
            </div>
            <div class="mvu-mobile-shell-head-actions">
              <button type="button" class="mvu-mobile-shell-close" aria-label="关闭" @click="closeShell">&times;</button>
            </div>
          </header>

          <div class="mvu-mobile-shell-body">
            <div class="mvu-mobile-shell-scroll" :class="{ 'is-detail': shellScreen === 'detail' }">
              <section v-if="shellScreen === 'detail'" class="mvu-mobile-library mvu-mobile-library--detail" :data-target="shellDetailPreviewKey || tabState.current">
                <div ref="modalHostRef" class="mvu-mobile-shell-modal-host"></div>
              </section>

              <section v-else class="mvu-mobile-library" :data-target="tabState.current">
                <section v-if="tabState.current === 'page-archive'" class="mvu-mobile-library-page" data-target="page-archive">
                  <div class="mvu-mobile-card mvu-mobile-card--hero clickable" data-preview="生命图谱详细页" data-unified-card="archive-core" data-unified-surface="shell"></div>
                  <div class="mvu-mobile-card-grid mvu-mobile-card-grid--two">
                    <div class="mvu-mobile-card clickable" data-unified-card="primary-spirit" data-unified-surface="shell"></div>
                    <div class="mvu-mobile-card clickable" data-unified-card="secondary-spirit" data-unified-surface="shell"></div>
                  </div>
                  <div class="mvu-mobile-card-grid mvu-mobile-card-grid--two">
                    <div class="mvu-mobile-card clickable" data-preview="武装工坊详细页" data-unified-card="armory" data-unified-surface="shell"></div>
                    <div class="mvu-mobile-card clickable" data-preview="储物仓库详细页" data-unified-card="vault" data-unified-surface="shell"></div>
                  </div>
                  <div class="mvu-mobile-card" data-unified-card="social" data-unified-surface="shell"></div>
                </section>
                <section v-if="tabState.current === 'page-map'" class="mvu-mobile-library-page" data-target="page-map">
                  <div class="mvu-mobile-card mvu-mobile-card--hero" data-unified-card="map-locals" data-unified-surface="shell"></div>
                  <div class="mvu-mobile-card clickable" data-preview="当前节点详情" data-unified-card="map-current" data-unified-surface="shell"></div>
                </section>

                <section v-if="tabState.current === 'page-world'" class="mvu-mobile-library-page" data-target="page-world">
                  <div class="mvu-mobile-card mvu-mobile-card--hero clickable" data-preview="世界状态总览" data-unified-card="world-hero" data-unified-surface="shell"></div>
                  <div class="mvu-mobile-card clickable" data-preview="全息编年史" data-unified-card="world-timeline" data-unified-surface="shell"></div>
                </section>
                <section v-if="tabState.current === 'page-org'" class="mvu-mobile-library-page" data-target="page-org">
                  <div class="mvu-mobile-card mvu-mobile-card--hero clickable" data-preview="势力矩阵总览" data-unified-card="org-hero" data-unified-surface="shell"></div>
                  <div class="mvu-mobile-card-grid mvu-mobile-card-grid--two">
                    <div class="mvu-mobile-card clickable" data-preview="我的阵营详情" data-unified-card="org-faction" data-unified-surface="shell"></div>
                    <div class="mvu-mobile-card clickable" data-preview="本地据点详情" data-unified-card="org-node" data-unified-surface="shell"></div>
                  </div>
                </section>
                <section v-if="tabState.current === 'page-terminal'" class="mvu-mobile-library-page" data-target="page-terminal">
                  <div class="mvu-mobile-card mvu-mobile-card--hero clickable" data-preview="系统播报与日志" data-unified-card="terminal-hero" data-unified-surface="shell"></div>
                  <div class="mvu-mobile-card-grid mvu-mobile-card-grid--two">
                    <div class="mvu-mobile-card clickable" data-preview="试炼与情报" data-unified-card="terminal-intel" data-unified-surface="shell"></div>
                    <div class="mvu-mobile-card clickable" data-preview="怪物图鉴" data-unified-card="terminal-bestiary" data-unified-surface="shell"></div>
                    <div class="mvu-mobile-card clickable" data-preview="任务界面" data-unified-card="terminal-quest" data-unified-surface="shell"></div>
                  </div>
                </section>
              </section>
            </div>
          </div>

          <nav class="mvu-mobile-shell-nav" aria-label="页面切换">
            <button
              v-for="tab in tabs"
              :key="'mobile-tab-' + tab.id"
              type="button"
              class="mvu-mobile-shell-tab"
              :class="{ active: tabState.current === tab.id }"
              :data-target="tab.id"
              @click="enterSection(tab.id)"
            >
              <span class="mvu-mobile-shell-tab-icon" aria-hidden="true" v-html="tab.icon"></span>
              <span class="mvu-mobile-shell-tab-label">{{ tab.label }}</span>
            </button>
          </nav>
        </div>
      </section>
    </div>
  `,
  setup() {
    const launcherRef = ref(null);
    const shellFrameRef = ref(null);
    const modalHostRef = ref(null);
    const shellScreen = ref('section');
    const shellDetailPreviewKey = ref('');
    const shellDetailReturnScreen = ref('section');
    const launcherModeItems = [
      { id: 'unified', label: '一体' },
      { id: 'shell', label: '手机' }
    ];
    const dragState = {
      pointerId: null,
      startX: 0,
      startY: 0,
      originX: 0,
      originY: 0,
      moved: false,
      longPressTriggered: false,
      longPressTimer: null
    };

    const launcherPosition = computed(() => resolveSurfaceLauncherDisplayPosition());
    const launcherStyle = computed(() => {
      const position = launcherPosition.value;
      return {
        transform: `translate3d(${Math.round(position.x)}px, ${Math.round(position.y)}px, 0)`
      };
    });
    const shellOffset = reactive({ x: 0, y: 0 });
    const shellDragState = {
      pointerId: null,
      startX: 0,
      startY: 0,
      originX: 0,
      originY: 0,
      dragging: false
    };
    const clampShellOffset = nextValue => {
      const shellLayer = shellFrameRef.value && typeof shellFrameRef.value.closest === 'function'
        ? shellFrameRef.value.closest('.mvu-mobile-shell')
        : null;
      const shellRect = shellLayer && typeof shellLayer.getBoundingClientRect === 'function'
        ? shellLayer.getBoundingClientRect()
        : { width: window.innerWidth || 0, height: window.innerHeight || 0 };
      const frameRect = shellFrameRef.value && typeof shellFrameRef.value.getBoundingClientRect === 'function'
        ? shellFrameRef.value.getBoundingClientRect()
        : { width: 0, height: 0 };
      const margin = 10;
      const limitX = Math.max(0, ((shellRect.width || 0) - (frameRect.width || 0)) / 2 - margin);
      const limitY = Math.max(0, ((shellRect.height || 0) - (frameRect.height || 0)) / 2 - margin);
      return {
        x: _.clamp(Number(nextValue && nextValue.x) || 0, -limitX, limitX),
        y: _.clamp(Number(nextValue && nextValue.y) || 0, -limitY, limitY)
      };
    };
    const syncShellOffset = nextValue => {
      const nextOffset = clampShellOffset(nextValue || shellOffset);
      shellOffset.x = nextOffset.x;
      shellOffset.y = nextOffset.y;
      return nextOffset;
    };
    const shellFrameStyle = computed(() => ({
      '--mvu-shell-offset-x': `${Math.round(shellOffset.x)}px`,
      '--mvu-shell-offset-y': `${Math.round(shellOffset.y)}px`
    }));
    const shellVisible = computed(() => !!mvuLayoutState.mobileShellOpen);
    const showLauncher = computed(() => !(mvuLayoutState.isMobileViewport && shellVisible.value));
    const showLauncherMenu = computed(() => true);
    const launcherMode = computed(() => getDesktopModeSelection());
    const activeApp = computed(() => resolveShellAppMeta(mvuTabState.current));
    const showHomeBack = computed(() => shellScreen.value === 'detail');
    const resolvedActiveTitle = computed(() => {
      if (shellScreen.value === 'detail') return resolveShellPreviewTitle(shellDetailPreviewKey.value, activeApp.value.title);
      return activeApp.value.title;
    });
    const launcherMainAriaLabel = computed(() => {
      if (mvuLayoutState.surfaceMode === 'shell' && shellVisible.value) return '收起小手机';
      return '打开小手机';
    });
    const launcherMenuAlign = computed(() => {
      const viewport = getViewportSize();
      return launcherPosition.value.x > viewport.width * 0.52 ? 'end' : 'start';
    });
    const launcherMenuVertical = computed(() => {
      const viewport = getViewportSize();
      return launcherPosition.value.y > viewport.height * 0.58 ? 'up' : 'down';
    });

    const setLauncherMenuOpen = nextOpen => {
      const nextValue = !!nextOpen;
      if (mvuLayoutState.surfaceLauncherMenuOpen === nextValue) return nextValue;
      mvuLayoutState.surfaceLauncherMenuOpen = nextValue;
      applyLayoutBodyClasses();
      return nextValue;
    };

    const closeLauncherMenu = () => setLauncherMenuOpen(false);
    const ensureShellTab = () => {
      const normalized = normalizeShellTabId(mvuTabState.current);
      if (mvuTabState.current !== normalized) {
        setSharedTab(normalized);
        writeMobileLastTabStorage(normalized);
      }
      return normalized;
    };
    const clearLongPressTimer = () => {
      if (dragState.longPressTimer) {
        window.clearTimeout(dragState.longPressTimer);
        dragState.longPressTimer = null;
      }
    };

    const detachPointerListeners = () => {
      clearLongPressTimer();
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
    const detachShellPointerListeners = () => {
      window.removeEventListener('pointermove', handleShellPointerMove);
      window.removeEventListener('pointerup', handleShellPointerEnd);
      window.removeEventListener('pointercancel', handleShellPointerEnd);
    };

    function handleShellPointerMove(event) {
      if (event.pointerId !== shellDragState.pointerId) return;
      const deltaX = event.clientX - shellDragState.startX;
      const deltaY = event.clientY - shellDragState.startY;
      if (!shellDragState.dragging && Math.hypot(deltaX, deltaY) < 6) return;
      shellDragState.dragging = true;
      syncShellOffset({
        x: shellDragState.originX + deltaX,
        y: shellDragState.originY + deltaY
      });
    }

    function handleShellPointerEnd(event) {
      if (event.pointerId !== shellDragState.pointerId) return;
      detachShellPointerListeners();
      shellDragState.pointerId = null;
      shellDragState.dragging = false;
      syncShellOffset();
    }

    const onShellHeaderPointerDown = event => {
      if (!shellVisible.value) return;
      if (typeof event.button === 'number' && event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target && target.closest('button, a, input, textarea, select, label')) return;
      event.preventDefault();
      shellDragState.pointerId = event.pointerId;
      shellDragState.startX = event.clientX;
      shellDragState.startY = event.clientY;
      shellDragState.originX = shellOffset.x;
      shellDragState.originY = shellOffset.y;
      shellDragState.dragging = false;
      if (event.currentTarget && typeof event.currentTarget.setPointerCapture === 'function') {
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch (err) {}
      }
      window.addEventListener('pointermove', handleShellPointerMove);
      window.addEventListener('pointerup', handleShellPointerEnd);
      window.addEventListener('pointercancel', handleShellPointerEnd);
    };

    const runLauncherAction = () => {
      closeLauncherMenu();
      toggleShellSurface();
    };

    const finishDrag = () => {
      detachPointerListeners();
      dragState.pointerId = null;
      const moved = dragState.moved;
      const longPressTriggered = dragState.longPressTriggered;
      dragState.moved = false;
      dragState.longPressTriggered = false;
      mvuLayoutState.surfaceLauncherDragging = false;
      if (moved) {
        syncSurfaceLauncherPosition({ persist: true });
        return;
      }
      if (longPressTriggered) return;
      runLauncherAction();
    };

    function handlePointerMove(event) {
      if (event.pointerId !== dragState.pointerId) return;
      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      if (dragState.longPressTriggered) return;
      if (!dragState.moved && Math.hypot(deltaX, deltaY) >= SURFACE_LAUNCHER_DRAG_THRESHOLD) {
        dragState.moved = true;
        mvuLayoutState.surfaceLauncherDragging = true;
        clearLongPressTimer();
        closeLauncherMenu();
      }
      if (!dragState.moved) return;
      mvuLayoutState.surfaceLauncherPosition = clampSurfaceLauncherPosition({
        x: dragState.originX + deltaX,
        y: dragState.originY + deltaY
      });
    }

    function handlePointerEnd(event) {
      if (event.pointerId !== dragState.pointerId) return;
      finishDrag();
    }

    const beginLauncherPointer = (event) => {
      if (typeof event.button === 'number' && event.button !== 0) return;
      event.preventDefault();
      const position = resolveSurfaceLauncherDisplayPosition();
      dragState.pointerId = event.pointerId;
      dragState.startX = event.clientX;
      dragState.startY = event.clientY;
      dragState.originX = position.x;
      dragState.originY = position.y;
      dragState.moved = false;
      dragState.longPressTriggered = false;
      mvuLayoutState.surfaceLauncherDragging = false;
      if (event.currentTarget && typeof event.currentTarget.setPointerCapture === 'function') {
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch (err) {}
      }
      clearLongPressTimer();
      dragState.longPressTimer = window.setTimeout(() => {
        if (dragState.pointerId !== event.pointerId || dragState.moved) return;
        dragState.longPressTriggered = true;
        setLauncherMenuOpen(true);
      }, SURFACE_LAUNCHER_LONG_PRESS_MS);
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerEnd);
      window.addEventListener('pointercancel', handlePointerEnd);
    };

    const onLauncherPointerDown = event => beginLauncherPointer(event);
    const onLauncherKeyboardAction = () => runLauncherAction();
    const onLauncherContextMenu = () => {
      setLauncherMenuOpen(true);
    };

    const resetShellDetailState = nextScreen => {
      shellDetailPreviewKey.value = '';
      shellDetailReturnScreen.value = 'section';
      shellScreen.value = nextScreen === 'detail' ? 'detail' : 'section';
    };
    const openShellPreview = previewKey => {
      const nextPreviewKey = String(previewKey || '').trim();
      if (!nextPreviewKey) return;
      shellDetailReturnScreen.value = 'section';
      shellDetailPreviewKey.value = nextPreviewKey;
      shellScreen.value = 'detail';
      const run = () => {
        if (typeof window.__MVU_OPEN_SHELL_PREVIEW__ === 'function') {
          try { window.__MVU_OPEN_SHELL_PREVIEW__(nextPreviewKey, { preserveMapDispatchContext: true }); } catch (err) {}
        }
      };
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => window.requestAnimationFrame(run));
      } else {
        window.setTimeout(run, 0);
      }
    };
    const closeShellDetail = nextScreen => {
      if (typeof window.__MVU_CLOSE_DETAIL_MODAL__ === 'function') {
        try { window.__MVU_CLOSE_DETAIL_MODAL__(); } catch (err) {}
      }
      resetShellDetailState(nextScreen || shellDetailReturnScreen.value || 'section');
    };
    const closeShell = () => closeShellSurface();
    const handleBackdropClick = event => {
      if (!event) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const handleShellPreviewClick = event => {
      if (shellScreen.value === 'detail') return;
      const 目标节点 = event.target instanceof Element ? event.target : null;
      if (!目标节点) return;
      if (typeof window.__MVU_CONSUME_LONG_PRESS_CLICK__ === 'function' && window.__MVU_CONSUME_LONG_PRESS_CLICK__(目标节点)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const 预览入口 = 目标节点.closest('.clickable[data-preview]');
      if (!预览入口) return;
      const 统一挂载 = document.getElementById('mvu-unified-mount');
      const 来自桌面统一面板 = !!(统一挂载 && 统一挂载.contains(预览入口) && !预览入口.closest('.mvu-mobile-shell'));
      const 预览键 = String(预览入口.getAttribute('data-preview') || '').trim();
      if (!预览键) return;
      if (来自桌面统一面板) {
        if (typeof window.__MVU_OPEN_UNIFIED_PREVIEW__ !== 'function') return;
        event.preventDefault();
        event.stopPropagation();
        window.__MVU_OPEN_UNIFIED_PREVIEW__(预览键, {
          triggerEl: 预览入口,
          preserveMapDispatchContext: true,
          replace: true
        });
        return;
      }
      if (!shellFrameRef.value || !shellFrameRef.value.contains(预览入口)) return;
      if (预览入口.closest('.mvu-mobile-shell-nav')) return;
      event.preventDefault();
      event.stopPropagation();
      openShellPreview(预览键);
    };
    const enterSection = tabId => {
      if (shellScreen.value === 'detail') {
        closeShellDetail('section');
      }
      requestTabChange(normalizeShellTabId(tabId));
      shellScreen.value = 'section';
    };
    const handleBack = () => {
      if (shellScreen.value !== 'detail') return;
      closeShellDetail(shellDetailReturnScreen.value || 'section');
    };
    const selectLauncherMode = mode => {
      closeLauncherMenu();
      applyDesktopLayoutSelection(mode);
    };

    const handleWindowPointerDown = event => {
      if (!mvuLayoutState.surfaceLauncherMenuOpen) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target && launcherRef.value && launcherRef.value.contains(target)) return;
      closeLauncherMenu();
    };

    const handleWindowKeydown = event => {
      if (event.key === 'Escape' && mvuLayoutState.surfaceLauncherMenuOpen) {
        closeLauncherMenu();
      }
    };

    watch(() => mvuLayoutState.mobileShellOpen, nextOpen => {
      if (nextOpen) {
        ensureShellTab();
        resetShellDetailState('section');
        closeLauncherMenu();
        if (typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(() => syncShellOffset());
        } else {
          window.setTimeout(() => syncShellOffset(), 0);
        }
      } else {
        detachShellPointerListeners();
        shellDragState.pointerId = null;
        shellDragState.dragging = false;
        shellDetailPreviewKey.value = '';
      }
      requestUnifiedShellCardRefresh({ force: true });
    });

    watch(() => mvuTabState.current, nextTab => {
      if (shellVisible.value && normalizeShellTabId(nextTab) !== nextTab) {
        ensureShellTab();
        return;
      }
      requestUnifiedShellCardRefresh({ force: true });
    });

    watch(shellScreen, nextScreen => {
      if (nextScreen === 'section') {
        ensureShellTab();
      }
      requestUnifiedShellCardRefresh({ force: true });
    });

    const bridge = {
      isAvailable: () => true,
      isOpen: () => !!mvuLayoutState.mobileShellOpen,
      isDetailActive: () => shellScreen.value === 'detail',
      getModalHost: () => modalHostRef.value,
      getShellFrame: () => shellFrameRef.value,
      open: () => openShellSurface(),
      close: () => closeShellSurface(),
      toggle: () => toggleShellSurface(),
      openPreview: previewKey => openShellPreview(previewKey),
      onPreviewChange: payload => {
        const previewKey = typeof payload === 'string'
          ? payload
          : String(payload && payload.previewKey || '').trim();
        if (!previewKey) return;
        if (shellScreen.value !== 'detail') shellDetailReturnScreen.value = 'section';
        shellDetailPreviewKey.value = previewKey;
        shellScreen.value = 'detail';
      },
      onPreviewClosed: () => {
        if (shellScreen.value !== 'detail') return;
        resetShellDetailState(shellDetailReturnScreen.value || 'section');
      },
      syncLauncherPosition: options => syncSurfaceLauncherPosition(options)
    };

    onMounted(() => {
      window.__MVU_MOBILE_SHELL__ = bridge;
      syncSurfaceLauncherPosition({ persist: true });
      syncShellOffset();
      window.addEventListener('click', handleShellPreviewClick, true);
      window.addEventListener('pointerdown', handleWindowPointerDown, true);
      window.addEventListener('keydown', handleWindowKeydown);
      window.addEventListener('resize', syncShellOffset);
      if (mvuLayoutState.mobileShellOpen) ensureShellTab();
      requestUnifiedShellCardRefresh({ force: true });
      if (typeof window.__MVU_SYNC_DETAIL_MODAL_HOST__ === 'function') {
        try { window.__MVU_SYNC_DETAIL_MODAL_HOST__(); } catch (err) {}
      }
    });

    onUnmounted(() => {
      detachPointerListeners();
      detachShellPointerListeners();
      window.removeEventListener('click', handleShellPreviewClick, true);
      window.removeEventListener('pointerdown', handleWindowPointerDown, true);
      window.removeEventListener('keydown', handleWindowKeydown);
      window.removeEventListener('resize', syncShellOffset);
      if (window.__MVU_MOBILE_SHELL__ === bridge) {
        delete window.__MVU_MOBILE_SHELL__;
      }
    });

    return {
      tabs: SHELL_TAB_ITEMS,
      resolvedActiveTitle,
      enterSection,
      handleBack,
      launcherMainAriaLabel,
      launcherMenuAlign,
      launcherModeItems,
      launcherMenuVertical,
      launcherMode,
      launcherStyle,
      launcherRef,
      onLauncherContextMenu,
      onLauncherKeyboardAction,
      onLauncherPointerDown,
      selectLauncherMode,
      shellVisible,
      shellDetailPreviewKey,
      shellScreen,
      showHomeBack,
      showLauncher,
      showLauncherMenu,
      tabState: mvuTabState,
      layoutState: mvuLayoutState,
      shellFrameRef,
      shellFrameStyle,
      modalHostRef,
      closeShell,
      handleBackdropClick,
      onShellHeaderPointerDown
    };
  }
};

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
    const modeBadge = computed(() => (mvuLayoutState.isMobileViewport ? '移动端一体栏' : '桌面一体栏'));
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
    const requestUnifiedDetailRender = (options = {}) => {
      const nextPreviewKey = String(detailState.previewKey || '').trim();
      scheduleFrameTask(() => {
        const host = detailHostRef.value;
        if (!host || !host.isConnected || !nextPreviewKey || !detailState.isOpen) return;
        if (typeof window.__MVU_RENDER_UNIFIED_PREVIEW__ !== 'function') return;
        try {
          const rendered = window.__MVU_RENDER_UNIFIED_PREVIEW__(nextPreviewKey, { ...options, host });
          if (rendered === false && detailState.previewKey === nextPreviewKey) {
            closeUnifiedDetail({ force: true });
            return;
          }
          syncUnifiedFrameViewport();
        } catch (err) {}
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
    watch(() => mvuLayoutState.effectiveMode, nextMode => {
      if (nextMode !== 'unified' && detailState.isOpen) {
        closeUnifiedDetail({ force: true });
      }
    });
    watch(() => mvuTabState.current, () => {
      scheduleUnifiedFrameViewportSync();
    });
    watch(() => mvuLayoutState.isMobileViewport, () => {
      scheduleUnifiedFrameViewportSync();
      forceUnifiedCardSync();
    });
    return {
      tabs: TAB_ITEMS,
      activeMeta,
      closeUnifiedDetail,
      detailHostRef,
      detailState,
      详情路径标题,
      modeBadge,
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

const LayoutRescueDock = {
  template: `
    <div class="mvu-layout-rescue" :class="{ active: shouldShow }">
      <button type="button" class="mvu-layout-rescue-btn" @click="rescue">
        <span class="mvu-layout-rescue-title">切回一体栏</span>
        <span class="mvu-layout-rescue-desc">移动端仅保留一体栏，点这里直接恢复。</span>
      </button>
    </div>
  `,
  setup() {
    const shouldShow = computed(() => mvuLayoutState.isMobileViewport && mvuLayoutState.effectiveMode !== 'unified');
    const rescue = () => setLayoutMode('unified');
    return {
      shouldShow,
      rescue
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

function ensureLayoutRescueMountNode() {
  let rescueMount = document.getElementById('mvu-layout-rescue-mount');
  if (!rescueMount && document.body) {
    rescueMount = document.createElement('div');
    rescueMount.id = 'mvu-layout-rescue-mount';
    document.body.appendChild(rescueMount);
  }
  return rescueMount;
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

function ensureLayoutRescueMounted() {
  const rescueMount = ensureLayoutRescueMountNode();
  if (!rescueMount) return null;
  if (!rescueMount.__mvuVueMounted) {
    createApp(LayoutRescueDock).mount(rescueMount);
    rescueMount.__mvuVueMounted = true;
  }
  return rescueMount;
}

function removeLayoutRescueMountNode() {
  const rescueMount = document.getElementById('mvu-layout-rescue-mount');
  if (rescueMount && rescueMount.parentElement) {
    rescueMount.parentElement.removeChild(rescueMount);
  }
}

function mountMvuVue() {
  const unifiedMount = ensureUnifiedDockMounted();
  removeLayoutRescueMountNode();

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

  syncSurfaceLauncherPosition({ persist: true });
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

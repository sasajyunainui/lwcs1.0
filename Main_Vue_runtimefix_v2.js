const { createApp, ref, reactive, computed, watch, onMounted, onUnmounted } = Vue;

const TAB_ITEMS = [
  [
    "page-archive",
    "角色",
    "M7 5h10v15H7z M9 3h6v4H9z M10 11h4 M10 15h4"
  ],
  [
    "page-ability",
    "能力",
    "M12 3l7 9-7 9-7-9z M12 7v10 M8 12h8"
  ],
  [
    "page-supplies",
    "物资",
    "M4 8h16v12H4z M8 8V4h8v4 M4 12h16 M10 12v3h4v-3"
  ],
  [
    "page-map",
    "探索",
    "M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z M9 4v14 M15 6v14"
  ],
  [
    "page-world",
    "世界",
    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M3 12h18 M12 3a18 18 0 0 0 0 18 18 18 0 0 0 0-18"
  ],
  [
    "page-terminal",
    "事务",
    "M5 4h14v16H5z M8 8h8 M8 12h8 M8 16h5"
  ]
].map(([id, label, path]) => ({
  id, label, icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"></path></svg>'
}));

const UNIFIED_TAB_META = Object.fromEntries(TAB_ITEMS.map(tab => [tab.id, { title: tab.label, eyebrow: '', desc: '' }]));

// 页面导航属于界面状态；preview / focus 始终进入原业务与同一份数据。
const CABIN_PAGES = [
  [
    "status",
    "page-archive",
    "状态总览",
    "",
    ""
  ],
  [
    "profile",
    "page-archive",
    "完整档案",
    "生命图谱详细页",
    ".dossier-card--life-profile"
  ],
  [
    "growth",
    "page-archive",
    "成长记录",
    "生命图谱详细页",
    ".dossier-card--life-record"
  ],
  [
    "relations",
    "page-archive",
    "人物关系",
    "人物关系详细页",
    ""
  ],
  [
    "identity",
    "page-archive",
    "社会身份",
    "社会档案详细页",
    ""
  ],
  [
    "privileges",
    "page-archive",
    "特殊权限",
    "特殊权限",
    ""
  ],
  [
    "characters",
    "page-archive",
    "角色目录",
    "角色切换器",
    ""
  ],
  [
    "private",
    "page-archive",
    "私密档案",
    "私密档案详细页",
    ""
  ],
  [
    "martial",
    "page-ability",
    "武魂",
    "",
    ""
  ],
  [
    "rings",
    "page-ability",
    "魂环",
    "第1武魂详细页",
    ".soul-ring-terminal-row"
  ],
  [
    "spirits",
    "page-ability",
    "魂灵",
    "第1武魂详细页",
    "[data-cabin-section=\"spirits\"]"
  ],
  [
    "bloodline",
    "page-ability",
    "血脉",
    "血脉封印详细页",
    ""
  ],
  [
    "skills",
    "page-ability",
    "技能典籍",
    "技能典籍",
    ""
  ],
  [
    "fusion",
    "page-ability",
    "融合技",
    "武魂融合技详细页",
    ""
  ],
  [
    "design",
    "page-ability",
    "技能设计",
    "技能设计目录",
    ""
  ],
  [
    "pending",
    "page-ability",
    "待处理能力",
    "待处理能力",
    ""
  ],
  [
    "equipment",
    "page-supplies",
    "装备",
    "",
    ""
  ],
  [
    "bones",
    "page-supplies",
    "魂骨",
    "武装工坊详细页",
    ".mvu-armory-bone-topology"
  ],
  [
    "bag",
    "page-supplies",
    "背包",
    "储物仓库详细页",
    ".mvu-inventory-workbench"
  ],
  [
    "wallet",
    "page-supplies",
    "钱包",
    "储物仓库详细页",
    ".vault-wallet-card"
  ],
  [
    "map",
    "page-map",
    "行旅星图",
    "",
    ""
  ],
  [
    "locations",
    "page-map",
    "地点详情",
    "当前节点详情",
    ""
  ],
  [
    "people",
    "page-map",
    "在场人物",
    "当前节点详情",
    ".location-card--people"
  ],
  [
    "actions",
    "page-map",
    "日常行动",
    "全息星图主画布",
    ".map-action-control-row"
  ],
  [
    "travel",
    "page-map",
    "行程",
    "全息星图主画布",
    ".map-action-control-row"
  ],
  [
    "world",
    "page-world",
    "世界概况",
    "",
    ""
  ],
  [
    "chronicle",
    "page-world",
    "编年与见闻",
    "编年史档案",
    ""
  ],
  [
    "organizations",
    "page-world",
    "势力",
    "势力矩阵总览",
    ""
  ],
  [
    "camp",
    "page-world",
    "我的阵营",
    "我的阵营详情",
    ""
  ],
  [
    "competitions",
    "page-world",
    "赛事",
    "赛事",
    ""
  ],
  [
    "bestiary",
    "page-world",
    "魂兽图鉴",
    "怪物图鉴",
    ""
  ],
  [
    "tasks",
    "page-terminal",
    "任务",
    "任务界面",
    ""
  ],
  [
    "trial",
    "page-terminal",
    "试炼",
    "试炼与情报",
    ""
  ],
  [
    "workshop",
    "page-terminal",
    "副职工坊",
    "副职业工坊",
    ""
  ],
  [
    "records",
    "page-terminal",
    "情报与记录",
    "情报库详细页",
    ""
  ],
  [
    "trade",
    "page-terminal",
    "交易",
    "交易网络",
    ""
  ],
  [
    "battle",
    "page-terminal",
    "战斗复入",
    "战斗复入",
    ""
  ],
  [
    "settings",
    "page-terminal",
    "显示与维护",
    "显示与维护",
    ""
  ]
].map(([id, tab, title, preview, focus]) => Object.freeze({ id, tab, title, preview, focus }));
window.__LWCS_CABIN_PAGES__ = Object.freeze(CABIN_PAGES);

const 统一标签存储键 = 'mvu_unified_current_tab_v1';
const 全息星轨主题存储键 = 'mvu_unified_holo_theme_v1';
const 全息星轨主题列表 = [
  { 名称: '经典状态栏', 短名: '经典' },
  { 名称: '炫世唐门', 短名: '唐门' },
  { 名称: '金龙王', 短名: '金龙' },
  { 名称: '银龙王', 短名: '银龙' },
  { 名称: '幻海蝶舞', 短名: '幻海' }
];
const 全息星轨主题键映射 = Object.freeze({
  经典状态栏: 'classic',
  炫世唐门: 'tangmen',
  金龙王: 'jinlong',
  银龙王: 'yinlong',
  幻海蝶舞: 'huanhai',
});

function normalizeTabId(tabId) {
  const value = String(tabId || '').trim();
  if (value === 'page-org') return 'page-world';
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

function 规范化全息星轨主题(主题) {
  const 值 = String(主题 || '').trim();
  return 全息星轨主题列表.some(条目 => 条目.名称 === 值) ? 值 : '经典状态栏';
}

function 读取全息星轨主题() {
  try {
    return 规范化全息星轨主题(window.localStorage.getItem(全息星轨主题存储键));
  } catch (err) {
    return '经典状态栏';
  }
}

function 写入全息星轨主题(主题) {
  try {
    window.localStorage.setItem(全息星轨主题存储键, 规范化全息星轨主题(主题));
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
    '\u751f\u547d\u56fe\u8c31\u8be6\u60c5\u9875': '\u751f\u547d\u56fe\u8c31',
    '\u751f\u547d\u56fe\u8c31\u8be6\u7ec6\u9875': '\u751f\u547d\u56fe\u8c31',
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
  effectiveMode: 'holo',
  unifiedAnchorReady: false
}));

if (!('unifiedAnchorReady' in mvuLayoutState)) {
  mvuLayoutState.unifiedAnchorReady = false;
}
mvuLayoutState.effectiveMode = 'holo';

const mvuTabState = window.__MVU_TAB_STATE__ || (window.__MVU_TAB_STATE__ = reactive({ current: 读取统一标签存储() }));
const mvuUnifiedDetailState = window.__MVU_UNIFIED_DETAIL_STATE__ || (window.__MVU_UNIFIED_DETAIL_STATE__ = reactive({
  isOpen: false,
  previewKey: '',
  returnTab: mvuTabState.current,
  stack: [],
  returnScrollTop: 0,
  cabinPageId: ''
}));
const 全息星轨状态 = window.__MVU_HOLO_STATUS_STATE__ || (window.__MVU_HOLO_STATUS_STATE__ = reactive({
  主题: 读取全息星轨主题(),
  主题面板展开: false
}));
mvuTabState.current = normalizeTabId(mvuTabState.current);
if (!Array.isArray(mvuUnifiedDetailState.stack)) mvuUnifiedDetailState.stack = [];
mvuUnifiedDetailState.returnTab = normalizeTabId(mvuUnifiedDetailState.returnTab || mvuTabState.current);
全息星轨状态.主题 = 规范化全息星轨主题(全息星轨状态.主题);
全息星轨状态.主题面板展开 = !!全息星轨状态.主题面板展开;

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

const DesktopUnifiedLayout = {
  template: `
    <div class="mvu-unified-shell mvu-unified-panel-host mvu-root">
      <section class="mvu-unified-frame mvu-cabin"
        :class="{ 'is-workspace-cabin': tabState.current !== 'page-archive' || (detailState.isOpen && !(detailState.cabinPageId === 'profile' && detailState.previewKey === '生命图谱详细页')), 'is-status-cabin': tabState.current === 'page-archive' && !detailState.isOpen, 'is-profile-cabin': detailState.isOpen && detailState.cabinPageId === 'profile' && detailState.previewKey === '生命图谱详细页', 'is-detail': detailState.isOpen, 'is-holo-animation-paused': 全息动画暂停, 'is-mobile-collapsed': 移动状态栏折叠 && tabState.current !== 'page-archive', 'is-cabin-front-expanded': 前屏展开 && tabState.current !== 'page-archive' }"
        :data-holo-theme="全息星轨状态.主题" :data-unified-tab="tabState.current" :data-cabin-page="当前座舱页面.id"
        @pointerdown.passive="标记全息动画临停" @wheel.passive="标记全息动画临停" @keydown="标记全息动画临停">
        <header class="mvu-unified-toolbar" :class="{ 'is-detail': detailState.isOpen }" @click="处理移动状态栏标题点击">
          <div class="mvu-unified-toolbar-main">
            <div class="mvu-unified-status-strip">
              <button type="button" class="character-switch mvu-unified-character-switch clickable" data-preview="角色切换器" data-detail-mode="embed" aria-label="查看角色目录"><span class="char-emblem">角</span><span class="char-name">当前角色</span></button>
              <div class="header-loc mvu-unified-header-loc" aria-live="polite"
                :role="移动状态栏模式 ? 'button' : null" :tabindex="移动状态栏模式 ? 0 : -1"
                :aria-expanded="移动状态栏模式 ? (移动状态栏折叠 ? 'false' : 'true') : null"
                :aria-label="移动状态栏模式 ? (移动状态栏折叠 ? '展开状态栏' : '收起状态栏') : null"
                @keydown.enter.prevent="切换移动状态栏折叠" @keydown.space.prevent="切换移动状态栏折叠"><span>时间与地点同步中</span></div>
            </div>
            <div class="mvu-cabin-heading">
              <button v-if="detailState.isOpen" type="button" class="mvu-unified-detail-back" aria-label="返回上一页" @click.stop="closeUnifiedDetail">‹</button>
              <strong class="mvu-unified-detail-title">{{ detailState.isOpen ? 详情路径标题 : 当前座舱页面.title }}</strong>
              <button type="button" class="mvu-cabin-read-toggle" :aria-pressed="前屏展开 ? 'true' : 'false'" @click.stop="前屏展开 = !前屏展开">{{ 前屏展开 ? '恢复双屏' : '展开前屏' }}</button>
              <div class="mvu-unified-detail-actions" data-detail-title-actions></div>
            </div>
          </div>
          <div class="mvu-unified-theme-dock" :data-holo-theme="全息星轨状态.主题" :class="{ 'is-open': 全息星轨状态.主题面板展开 }" @focusout="处理全息主题面板失焦" @keydown.esc="关闭全息主题面板">
            <button type="button" class="mvu-unified-theme-toggle" :aria-expanded="全息星轨状态.主题面板展开 ? 'true' : 'false'" aria-label="显示主题" @click.stop="切换全息主题面板"><span>⚙</span></button>
            <div class="mvu-unified-theme-panel" aria-label="主题切换"><button v-for="主题 in 全息星轨主题" :key="主题.名称" type="button" class="mvu-holo-theme-btn" :aria-pressed="全息星轨状态.主题 === 主题.名称 ? 'true' : 'false'" @click="设置全息星轨主题(主题.名称)">{{ 主题.短名 }}</button></div>
          </div>
        </header>
        <nav class="mvu-cabin-page-nav" aria-label="当前领域页面" :inert="移动状态栏折叠 ? '' : null">
          <button v-for="页面 in 座舱页面列表" :key="页面.id" type="button" :data-cabin-private="页面.id === 'private' ? '' : null" :class="{ active: 当前座舱页面.id === 页面.id }" :aria-current="当前座舱页面.id === 页面.id ? 'page' : null" @click="打开座舱页面(页面)">{{ 页面.title }}</button>
        </nav>
        <div class="mvu-unified-stage-switch" :data-holo-theme-key="当前主题键">
          <div class="mvu-unified-page-stack" :class="detailState.isOpen ? 'is-stage-inactive' : 'is-stage-active'" :data-unified-overview-tab="tabState.current" :aria-hidden="detailState.isOpen || (移动状态栏折叠 && tabState.current !== 'page-archive') ? 'true' : 'false'" :inert="detailState.isOpen || (移动状态栏折叠 && tabState.current !== 'page-archive') ? '' : null">
            <section class="mvu-unified-page mvu-cabin-overview mvu-cabin-overview--role" :class="{ active: tabState.current === 'page-archive' }" data-target="page-archive"><div data-status-cabin></div></section>
<section class="mvu-unified-page mvu-cabin-overview mvu-cabin-overview--ability" :class="{ active: tabState.current === 'page-ability' }" data-target="page-ability"><div class="mvu-cabin-screen mvu-cabin-screen--rear " data-cabin-scroll="rear"><section class="mvu-cabin-card " data-unified-card="spirit-stage" data-unified-surface="panel"></section></div><div class="mvu-cabin-screen mvu-cabin-screen--front " data-cabin-scroll="front"><section class="mvu-cabin-card " data-unified-card="cabin-ability-focus" data-unified-surface="panel"></section></div></section>
<section class="mvu-unified-page mvu-cabin-overview mvu-cabin-overview--supplies" :class="{ active: tabState.current === 'page-supplies' }" data-target="page-supplies"><div class="mvu-cabin-screen mvu-cabin-screen--rear " data-cabin-scroll="rear"><section class="mvu-cabin-card " data-unified-card="armory" data-unified-surface="panel"></section></div><div class="mvu-cabin-screen mvu-cabin-screen--front " data-cabin-scroll="front"><section class="mvu-cabin-card " data-unified-card="cabin-supplies-focus" data-unified-surface="panel"></section></div></section>
<section class="mvu-unified-page mvu-cabin-overview mvu-cabin-overview--map" :class="{ active: tabState.current === 'page-map' }" data-target="page-map"><div class="mvu-cabin-screen mvu-cabin-screen--rear " data-cabin-scroll="rear"><div class="mvu-unified-map-stage" data-mvu-map-stage="panel"></div><section class="mvu-cabin-card " data-unified-card="map-locals" data-unified-surface="panel"></section></div><div class="mvu-cabin-screen mvu-cabin-screen--front " data-cabin-scroll="front"><section class="mvu-cabin-card " data-unified-card="map-current" data-unified-surface="panel"></section></div></section>
<section class="mvu-unified-page mvu-cabin-overview mvu-cabin-overview--world" :class="{ active: tabState.current === 'page-world' }" data-target="page-world"><div class="mvu-cabin-screen mvu-cabin-screen--rear " data-cabin-scroll="rear"><section class="mvu-cabin-card " data-unified-card="world-hero" data-unified-surface="panel"></section><section class="mvu-cabin-card " data-unified-card="world-timeline" data-unified-surface="panel"></section><section class="mvu-cabin-card " data-unified-card="org-hero" data-unified-surface="panel"></section><section class="mvu-cabin-card " data-unified-card="org-node" data-unified-surface="panel"></section></div><div class="mvu-cabin-screen mvu-cabin-screen--front " data-cabin-scroll="front"><section class="mvu-cabin-card " data-unified-card="world-competition" data-unified-surface="panel"></section><section class="mvu-cabin-card " data-unified-card="world-bestiary" data-unified-surface="panel"></section><section class="mvu-cabin-card " data-unified-card="org-faction" data-unified-surface="panel"></section></div></section>
<section class="mvu-unified-page mvu-cabin-overview mvu-cabin-overview--affairs" :class="{ active: tabState.current === 'page-terminal' }" data-target="page-terminal"><div class="mvu-cabin-screen mvu-cabin-screen--rear " data-cabin-scroll="rear"><section class="mvu-cabin-card " data-unified-card="terminal-hero" data-unified-surface="panel"></section><section class="mvu-cabin-card " data-unified-card="vault" data-unified-surface="panel"></section><section class="mvu-cabin-card " data-unified-card="terminal-quest" data-unified-surface="panel"></section></div><div class="mvu-cabin-screen mvu-cabin-screen--front " data-cabin-scroll="front"><section class="mvu-cabin-card " data-unified-card="terminal-intel" data-unified-surface="panel"></section><section class="mvu-cabin-card " data-unified-card="terminal-profession" data-unified-surface="panel"></section></div></section>
          </div>
          <section class="mvu-unified-detail-page" :class="detailState.isOpen ? 'is-stage-active' : 'is-stage-inactive'" :data-unified-detail-preview="detailState.previewKey" :aria-hidden="detailState.isOpen && !移动状态栏折叠 ? 'false' : 'true'" :inert="!detailState.isOpen || (移动状态栏折叠 && tabState.current !== 'page-archive') ? '' : null">
            <div ref="detailHostRef" class="mvu-unified-detail-host mvu-holo-detail-stage" data-unified-detail-host data-holo-detail-host></div>
          </section>
        </div>
        <nav class="mvu-unified-tab-row mvu-cabin-domain-nav" aria-label="状态栏领域" :inert="移动状态栏折叠 ? '' : null">
          <button v-for="标签 in tabs" :key="标签.id" type="button" class="mvu-tab-btn mvu-unified-tab-btn" :class="{ active: tabState.current === 标签.id }" :data-target="标签.id" :aria-pressed="tabState.current === 标签.id ? 'true' : 'false'" @click="setTab(标签.id)"><span class="mvu-unified-tab-icon" v-html="标签.icon"></span><span>{{ 标签.label }}</span></button>
        </nav>
      </section>
    </div>
  `,
  setup() {
    const activeMeta = computed(() => resolveUnifiedTabMeta(mvuTabState.current));
    const detailHostRef = ref(null);
    const detailState = mvuUnifiedDetailState;
    const 前屏展开 = ref(false);
    const 座舱页面列表 = computed(() => CABIN_PAGES.filter(page => page.tab === mvuTabState.current));
    const 当前座舱页面 = computed(() => {
      const 页面 = CABIN_PAGES.find(page => page.id === detailState.cabinPageId && page.tab === mvuTabState.current);
      if (detailState.isOpen && 页面) return 页面;
      return 座舱页面列表.value.find(page => !page.preview) || { id: mvuTabState.current, title: activeMeta.value.title };
    });
    const 打开座舱页面 = 页面 => {
      if (!页面) return;
      if (!页面.preview) { setUnifiedTab(页面.tab); return; }
      openUnifiedPreview(页面.preview, { replace: true, cabinPageId: 页面.id, focusSelector: 页面.focus });
    };
    const 当前全息星轨状态 = 全息星轨状态;
    const 当前主题键 = computed(() => 全息星轨主题键映射[当前全息星轨状态.主题] || 'classic');
    const 页面可见 = ref(typeof document === 'undefined' || document.visibilityState === 'visible');
    const 移动状态栏模式 = ref(
      typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(max-width: 760px)').matches
    );
    const 移动状态栏折叠 = ref(false);
    const 全息动画临停 = ref(false);
    const 全息动画暂停 = computed(() => !页面可见.value || 全息动画临停.value);
    const 上次详情标题 = ref('详情');
    const 读取当前详情标题 = () => {
      const 预览键 = String(detailState.previewKey || '').trim();
      const 默认标题 = activeMeta.value && activeMeta.value.title ? activeMeta.value.title : '详情';
      const 页面 = CABIN_PAGES.find(page => page.id === detailState.cabinPageId && page.preview === 预览键);
      const 标题 = 页面?.title || String(resolveShellPreviewTitle(预览键, 默认标题) || '').trim();
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
    const 统一路径标题 = computed(() => {
      const 标题 = String(activeMeta.value && activeMeta.value.title ? activeMeta.value.title : '档案').trim();
      return `${标题} / 概览`;
    });
    const 同步全息主题到页面 = () => {
      const 主题 = 规范化全息星轨主题(当前全息星轨状态.主题);
      const 页面主体 = typeof document !== 'undefined' && document.body ? document.body : null;
      if (页面主体) 页面主体.dataset.mvuHoloTheme = 主题;
    };
    let removeDetailWheelBridge = null;
    let 全息动画恢复计时器 = 0;
    let 详情切换避让截止时间 = 0;
    let 详情关闭清理计时器 = 0;
    const 读取详情性能时间 = () => {
      return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
    };
    const 详情性能探针启用 = () => {
      try {
        return window.__LWCS_DETAIL_PERF_PROBE__ === true;
      } catch (err) {
        return false;
      }
    };
    const 记录详情切换性能 = (阶段, 详情 = {}) => {
      if (!详情性能探针启用()) return;
      try {
        console.debug('[LWCS详情性能]', {
          来源: 'Vue外壳',
          阶段,
          时间毫秒: Math.round(读取详情性能时间() * 10) / 10,
          详情已打开: !!detailState.isOpen,
          当前Tab: normalizeTabId(mvuTabState.current),
          ...详情,
        });
      } catch (err) {}
    };
    const 标记全息动画临停 = () => {
      if (typeof window === 'undefined') return;
      全息动画临停.value = true;
      if (全息动画恢复计时器) window.clearTimeout(全息动画恢复计时器);
      全息动画恢复计时器 = window.setTimeout(() => {
        全息动画恢复计时器 = 0;
        全息动画临停.value = false;
      }, 360);
    };
    const 标记详情切换避让 = (毫秒 = 360) => {
      if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        详情切换避让截止时间 = Math.max(详情切换避让截止时间, performance.now() + Math.max(0, Number(毫秒) || 0));
      } else {
        详情切换避让截止时间 = Math.max(详情切换避让截止时间, Date.now() + Math.max(0, Number(毫秒) || 0));
      }
      try { window.__MVU_详情切换避让截止时间__ = 详情切换避让截止时间; } catch (err) {}
    };
    const 仍在详情切换避让期 = () => {
      const 当前时间 = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
      return 当前时间 < 详情切换避让截止时间;
    };
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
      if (scrollable.closest('.dc-host, [data-cabin-plane]')) return;
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
    // 逐层 getComputedStyle + 读 scrollHeight 会强制重排，结果缓存到下次 resize
    let 详情滚动容器缓存 = null;
    let 详情滚动容器缓存起点 = null;
    const 清除详情滚动容器缓存 = () => {
      详情滚动容器缓存 = null;
      详情滚动容器缓存起点 = null;
    };
    const getDetailScrollTarget = () => {
      const 起点 = detailHostRef.value ? detailHostRef.value.closest('.mvu-unified-frame') : document.getElementById('mvu-unified-mount');
      if (详情滚动容器缓存 && 详情滚动容器缓存起点 === 起点 && 详情滚动容器缓存.isConnected) {
        return 详情滚动容器缓存;
      }
      let current = 起点;
      while (current && current !== document.body) {
        try {
          const style = window.getComputedStyle(current);
          const overflowY = style ? style.overflowY : '';
          if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight + 2) {
            详情滚动容器缓存 = current;
            详情滚动容器缓存起点 = 起点;
            return current;
          }
        } catch (err) {}
        current = current.parentElement;
      }
      const 兜底 = document.scrollingElement || document.documentElement || document.body;
      详情滚动容器缓存 = 兜底;
      详情滚动容器缓存起点 = 起点;
      return 兜底;
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
    let cabinNavigationAnchor = null;
    const rememberCabinPosition = () => {
      const frame = detailHostRef.value?.closest('.mvu-unified-frame');
      if (!frame?.isConnected) return;
      const rect = frame.getBoundingClientRect();
      const minHeight = cabinNavigationAnchor?.frame === frame ? cabinNavigationAnchor.minHeight : frame.style.minHeight;
      cabinNavigationAnchor = { frame, target: getDetailScrollTarget(), top: rect.top, minHeight };
      frame.style.minHeight = `${rect.height}px`;
    };
    const restoreCabinPosition = () => {
      const anchor = cabinNavigationAnchor;
      if (!anchor) return;
      scheduleFrameTask(() => {
        if (cabinNavigationAnchor !== anchor) return;
        cabinNavigationAnchor = null;
        anchor.frame.style.minHeight = anchor.minHeight;
        if (anchor.frame.isConnected && anchor.target.isConnected) {
          anchor.target.scrollTop += anchor.frame.getBoundingClientRect().top - anchor.top;
        }
      });
    };
    const 请求统一概览同步 = (原因 = '', 选项 = {}) => {
      if (detailState.isOpen && !选项.允许详情态) return;
      const 重试次数 = Number(选项.重试次数 || 0);
      scheduleFrameTask(() => {
        if (detailState.isOpen && !选项.允许详情态) return;
        if (!选项.force && 仍在详情切换避让期()) {
          if (重试次数 < 6) window.setTimeout(() => 请求统一概览同步(原因, { ...选项, 重试次数: 重试次数 + 1 }), 96);
          return;
        }
        const 概览页 = document.querySelector('#mvu-unified-mount .mvu-unified-page.active');
        const 概览槽位 = 概览页 ? 概览页.querySelector('[data-status-cabin], [data-unified-card], [data-mvu-map-stage]') : null;
        const 概览结构就绪 = !!(概览页 && 概览槽位 && 概览槽位.isConnected);
        const 可同步 = typeof window.__MVU_RERENDER_UNIFIED_CARDS__ === 'function';
        if (可同步 && 概览结构就绪) {
          try {
            const 当前共享修订 = Number(window.__dragonUiSharedMvuRefreshHub?.runtime?.revision);
            window.__MVU_RERENDER_UNIFIED_CARDS__({
              force: true,
              source: 原因 || 'unified-shell',
              revision: Number.isFinite(当前共享修订) ? 当前共享修订 : undefined,
            });
            restoreCabinPosition();
          } catch (错误) {}
        }
        if ((!可同步 || !概览结构就绪) && 重试次数 < 8) {
          window.setTimeout(() => 请求统一概览同步(原因, { ...选项, 重试次数: 重试次数 + 1 }), 80);
        }
      });
    };
    const syncUnifiedFrameViewport = () => {
      const frame = (detailHostRef.value && detailHostRef.value.closest('.mvu-unified-frame'))
        || document.querySelector('#mvu-unified-mount .mvu-unified-frame');
      if (!frame || !frame.isConnected) return;
      const cabinWidth = frame.clientWidth;
      frame.style.setProperty('--dc-shell-scale', String(cabinWidth / 1672));
      const 视口高度 = Number(window.innerHeight) || Number(document.documentElement.clientHeight) || 720;
      const 发送栏 = document.getElementById('send_form');
      const 发送栏矩形 = 发送栏 ? 发送栏.getBoundingClientRect() : null;
      const 发送栏高度 = 发送栏矩形 ? Math.max(60, 发送栏矩形.height) : 90;
      const 底部边界 = 发送栏矩形 && 发送栏矩形.top > 80 && 发送栏矩形.top < 视口高度
        ? 发送栏矩形.top - 24
        : 视口高度 - 发送栏高度 - 24;
      const 顶部边界 = 42;
      const 可用高度 = Math.max(420, 底部边界 - 顶部边界);
      const 状态栏目标高度 = Math.min(可用高度, 视口高度 * 0.70);
      const 状态栏高度上限 = 760;
      const 状态栏高度下限 = Math.min(620, Math.max(520, 视口高度 - 发送栏高度 - 120));
      const 状态栏最大高度 = Math.max(状态栏高度下限, Math.min(状态栏高度上限, 状态栏目标高度));
      frame.style.setProperty('--dc-frame-height', cabinWidth >= 720 ? `${Math.round(状态栏最大高度)}px` : 'auto');
      const 统一挂载 = frame.closest('#mvu-unified-mount') || frame.parentElement || frame;
      const detailHost = detailHostRef.value;
      const 需要详情高度 = !!(detailHost && detailHost.isConnected);
      // 写样式前读完工具栏高度；写完再读会强制重排
      const toolbar = 需要详情高度 ? frame.querySelector('.mvu-unified-toolbar') : null;
      const toolbarHeight = toolbar ? toolbar.getBoundingClientRect().height : 64;

      统一挂载.style.setProperty('--mvu-unified-frame-max-height', `${Math.floor(状态栏最大高度)}px`);
      frame.style.setProperty('--mvu-unified-frame-max-height', `${Math.floor(状态栏最大高度)}px`);

      if (需要详情高度) {
        const 详情最大高度 = Math.max(260, 状态栏最大高度 - toolbarHeight - 110);
        detailHost.style.setProperty('--mvu-unified-detail-max-height', `${Math.floor(详情最大高度)}px`);
      }
    };
    const scheduleUnifiedFrameViewportSync = () => {
      scheduleFrameTask(syncUnifiedFrameViewport);
    };
    const 标记待渲染详情 = 预览键 => {
      const 详情宿主 = detailHostRef.value;
      if (!(详情宿主 instanceof HTMLElement) || !详情宿主.isConnected) return;
      const 当前预览键 = String(详情宿主.dataset.holoPreview || '').trim();
      const 目标预览键 = String(预览键 || '').trim();
      if (!目标预览键 || 当前预览键 === 目标预览键) return;
      if (typeof window.__MVU_CLEAR_UNIFIED_PREVIEW__ === 'function') {
        try { window.__MVU_CLEAR_UNIFIED_PREVIEW__(); } catch (err) {}
      } else {
        详情宿主.innerHTML = '';
        delete 详情宿主.dataset.holoPreview;
      }
    };
    const requestUnifiedDetailRender = (options = {}) => {
      const nextPreviewKey = String(detailState.previewKey || '').trim();
      const 重试次数 = Number(options.重试次数 || 0);
      记录详情切换性能('详情渲染调度', { 预览键: nextPreviewKey, 重试次数 });
      scheduleFrameTask(() => {
        记录详情切换性能('详情渲染帧到达', { 预览键: nextPreviewKey, 重试次数 });
        const host = detailHostRef.value;
        if ((!host || !host.isConnected) && nextPreviewKey && detailState.isOpen && 重试次数 < 8) {
          window.setTimeout(() => requestUnifiedDetailRender({ ...options, 重试次数: 重试次数 + 1 }), 80);
          return;
        }
        if (!host || !host.isConnected || !nextPreviewKey || !detailState.isOpen) return;
        bindDetailWheelBridge();
        if (typeof window.__MVU_RENDER_UNIFIED_PREVIEW__ !== 'function') {
          if (重试次数 < 8) {
            window.setTimeout(() => requestUnifiedDetailRender({ ...options, 重试次数: 重试次数 + 1 }), 80);
          }
          return;
        }
        try {
          记录详情切换性能('调用详情渲染开始', { 预览键: nextPreviewKey });
          const rendered = window.__MVU_RENDER_UNIFIED_PREVIEW__(nextPreviewKey, { ...options, host });
          记录详情切换性能('调用详情渲染返回', { 预览键: nextPreviewKey, 返回值: rendered !== false });
          if (rendered === false && detailState.previewKey === nextPreviewKey) {
            closeUnifiedDetail({ force: true });
            return;
          }
          const 已渲染预览键 = String(host.dataset.holoPreview || '').trim();
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
      if (nextPreviewKey === '私密档案详细页' && detailHostRef.value?.closest('.mvu-unified-frame')?.dataset.cabinPrivateAllowed !== 'true') return false;
      rememberCabinPosition();
      记录详情切换性能('打开详情入口', { 预览键: nextPreviewKey });
      标记全息动画临停();
      标记详情切换避让(520);
      const 下一个详情标题 = String(resolveShellPreviewTitle(nextPreviewKey, activeMeta.value && activeMeta.value.title ? activeMeta.value.title : '详情') || '').trim();
      if (下一个详情标题) 上次详情标题.value = 下一个详情标题;
      清理顶层浮窗();
      if (!detailState.isOpen) {
        detailState.returnTab = normalizeTabId(mvuTabState.current);
        detailState.stack.splice(0);
      } else if (!options.replace && detailState.previewKey && detailState.previewKey !== nextPreviewKey) {
        detailState.stack.push({ previewKey: detailState.previewKey, cabinPageId: detailState.cabinPageId, focusSelector: detailHostRef.value?.dataset.cabinFocus || '' });
      }
      const 匹配页面 = CABIN_PAGES.find(page => page.id === options.cabinPageId)
        || CABIN_PAGES.find(page => page.preview === nextPreviewKey && page.tab === mvuTabState.current)
        || CABIN_PAGES.find(page => page.preview === nextPreviewKey);
      detailState.cabinPageId = 匹配页面 ? 匹配页面.id : '';
      detailState.previewKey = nextPreviewKey;
      detailState.isOpen = true;
      记录详情切换性能('详情壳已打开', { 预览键: nextPreviewKey });
      标记待渲染详情(nextPreviewKey);
      requestUnifiedDetailRender(options);
      scheduleUnifiedFrameViewportSync();
      return true;
    };
    const closeUnifiedDetail = (options = {}) => {
      rememberCabinPosition();
      记录详情切换性能('关闭详情入口', { 预览键: detailState.previewKey || '', force: !!options.force });
      标记全息动画临停();
      标记详情切换避让(420);
      清理顶层浮窗();
      if (!options.force && detailState.stack.length) {
        const previous = detailState.stack.pop();
        detailState.previewKey = typeof previous === 'string' ? previous : previous.previewKey;
        detailState.cabinPageId = typeof previous === 'string' ? '' : previous.cabinPageId;
        requestUnifiedDetailRender({ replace: true, focusSelector: previous.focusSelector || '' });
        return;
      }
      detailState.isOpen = false;
      记录详情切换性能('详情壳已关闭', { 预览键: detailState.previewKey || '' });
      detailState.stack.splice(0);
      if (详情关闭清理计时器) window.clearTimeout(详情关闭清理计时器);
      详情关闭清理计时器 = window.setTimeout(() => {
        详情关闭清理计时器 = 0;
        if (detailState.isOpen) return;
        detailState.previewKey = '';
        if (typeof window.__MVU_CLEAR_UNIFIED_PREVIEW__ === 'function') {
          try { window.__MVU_CLEAR_UNIFIED_PREVIEW__(); } catch (err) {}
        }
      }, 360);
      requestTabChange(normalizeTabId(detailState.returnTab));
      请求统一概览同步('detail-close');
      scheduleUnifiedFrameViewportSync();
      restoreCabinPosition();
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
      rememberCabinPosition();
      标记全息动画临停();
      清理顶层浮窗();
      if (detailState.isOpen) {
        detailState.isOpen = false;
        detailState.stack.splice(0);
        if (typeof window.__MVU_CLEAR_UNIFIED_PREVIEW__ === 'function') {
          try { window.__MVU_CLEAR_UNIFIED_PREVIEW__(); } catch (err) {}
        }
        detailState.previewKey = '';
      }
      requestTabChange(tabId);
      请求统一概览同步('tab-change');
      scheduleUnifiedFrameViewportSync();
    };
    const 设置全息星轨主题 = 主题 => {
      标记全息动画临停();
      当前全息星轨状态.主题 = 规范化全息星轨主题(主题);
      写入全息星轨主题(当前全息星轨状态.主题);
      当前全息星轨状态.主题面板展开 = false;
    };
    const 切换全息主题面板 = () => {
      标记全息动画临停();
      当前全息星轨状态.主题面板展开 = !当前全息星轨状态.主题面板展开;
    };
    const 关闭全息主题面板 = () => {
      if (!当前全息星轨状态.主题面板展开) return;
      标记全息动画临停();
      当前全息星轨状态.主题面板展开 = false;
    };
    const 处理全息主题面板失焦 = event => {
      const 下个焦点 = event && event.relatedTarget;
      if (下个焦点 instanceof Node && event.currentTarget instanceof Node && event.currentTarget.contains(下个焦点)) return;
      关闭全息主题面板();
    };
    const 切换移动状态栏折叠 = () => {
      if (!移动状态栏模式.value) return;
      标记全息动画临停();
      移动状态栏折叠.value = !移动状态栏折叠.value;
      if (移动状态栏折叠.value) 关闭全息主题面板();
      scheduleUnifiedFrameViewportSync();
    };
    const 处理移动状态栏标题点击 = event => {
      if (!移动状态栏模式.value) return;
      const 目标 = event && event.target instanceof Element ? event.target : null;
      if (!目标 || 目标.closest('button, nav, a, input, select, textarea, [data-preview], .mvu-unified-theme-dock')) return;
      切换移动状态栏折叠();
    };
    const handleDesktopUnifiedResize = () => {
      清除详情滚动容器缓存();
      移动状态栏模式.value = typeof window.matchMedia === 'function'
        ? window.matchMedia('(max-width: 760px)').matches
        : window.innerWidth <= 760;
      if (!移动状态栏模式.value) 移动状态栏折叠.value = false;
      scheduleUnifiedFrameViewportSync();
    };
    const handleDesktopUnifiedFocusRestore = () => {
      页面可见.value = typeof document === 'undefined' || document.visibilityState === 'visible';
      if (页面可见.value) 请求统一概览同步('focus-restore');
    };
    onMounted(() => {
      window.__MVU_SET_UNIFIED_TAB__ = setUnifiedTab;
      window.__MVU_SET_CABIN_THEME__ = 设置全息星轨主题;
      window.__MVU_OPEN_UNIFIED_PREVIEW__ = openUnifiedPreview;
      window.__MVU_CLOSE_UNIFIED_PREVIEW__ = closeUnifiedDetail;
      window.__MVU_GET_UNIFIED_DETAIL_HOST__ = () => detailHostRef.value;
      window.__MVU_同步统一详情视口__ = scheduleUnifiedFrameViewportSync;
      window.addEventListener('resize', handleDesktopUnifiedResize);
      window.addEventListener('mvu-cabin-content-ready', restoreCabinPosition);
      window.addEventListener('focus', handleDesktopUnifiedFocusRestore);
      document.addEventListener('visibilitychange', handleDesktopUnifiedFocusRestore);
      bindDetailWheelBridge();
      scheduleUnifiedFrameViewportSync();
      请求统一概览同步('mounted');
      if (mvuTabState.current === 'page-map') {
        requestMapSurfaceSync();
      }
      if (detailState.isOpen && detailState.previewKey) {
        requestUnifiedDetailRender({ force: true, replace: true });
      }
    });
    onUnmounted(() => {
      if (cabinNavigationAnchor) { cabinNavigationAnchor.frame.style.minHeight = cabinNavigationAnchor.minHeight; cabinNavigationAnchor = null; }
      window.dispatchEvent(new CustomEvent('mvu-status-cabin-dispose'));
      if (window.__MVU_SET_UNIFIED_TAB__ === setUnifiedTab) delete window.__MVU_SET_UNIFIED_TAB__;
      window.removeEventListener('resize', handleDesktopUnifiedResize);
      window.removeEventListener('mvu-cabin-content-ready', restoreCabinPosition);
      window.removeEventListener('focus', handleDesktopUnifiedFocusRestore);
      document.removeEventListener('visibilitychange', handleDesktopUnifiedFocusRestore);
      if (全息动画恢复计时器) {
        window.clearTimeout(全息动画恢复计时器);
        全息动画恢复计时器 = 0;
      }
      if (详情关闭清理计时器) {
        window.clearTimeout(详情关闭清理计时器);
        详情关闭清理计时器 = 0;
      }
      if (
        typeof document !== 'undefined'
        && document.body
        && document.body.dataset.mvuHoloTheme === 规范化全息星轨主题(当前全息星轨状态.主题)
      ) {
        delete document.body.dataset.mvuHoloTheme;
      }
      if (typeof removeDetailWheelBridge === 'function') {
        removeDetailWheelBridge();
        removeDetailWheelBridge = null;
      }
      if (window.__MVU_SET_CABIN_THEME__ === 设置全息星轨主题) delete window.__MVU_SET_CABIN_THEME__;
      if (window.__MVU_OPEN_UNIFIED_PREVIEW__ === openUnifiedPreview) delete window.__MVU_OPEN_UNIFIED_PREVIEW__;
      if (window.__MVU_CLOSE_UNIFIED_PREVIEW__ === closeUnifiedDetail) delete window.__MVU_CLOSE_UNIFIED_PREVIEW__;
      if (typeof window.__MVU_GET_UNIFIED_DETAIL_HOST__ === 'function' && window.__MVU_GET_UNIFIED_DETAIL_HOST__() === detailHostRef.value) {
        delete window.__MVU_GET_UNIFIED_DETAIL_HOST__;
      }
      if (window.__MVU_同步统一详情视口__ === scheduleUnifiedFrameViewportSync) delete window.__MVU_同步统一详情视口__;
    });
    watch(() => 当前全息星轨状态.主题, 同步全息主题到页面, { immediate: true });
    watch(() => mvuTabState.current, () => {
      if (mvuTabState.current === 'page-map') requestMapSurfaceSync();
      请求统一概览同步('tab-watch');
      scheduleUnifiedFrameViewportSync();
    });
    return {
      tabs: TAB_ITEMS,
      座舱页面列表,
      当前座舱页面,
      前屏展开,
      打开座舱页面,
      activeMeta,
      closeUnifiedDetail,
      detailHostRef,
      detailState,
      统一路径标题,
      当前主题键,
      全息动画暂停,
      标记全息动画临停,
      全息星轨状态: 当前全息星轨状态,
      全息星轨主题: 全息星轨主题列表,
      设置全息星轨主题,
      切换全息主题面板,
      关闭全息主题面板,
      处理全息主题面板失焦,
      移动状态栏模式,
      移动状态栏折叠,
      切换移动状态栏折叠,
      处理移动状态栏标题点击,
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
  if (typeof window.__MVU_SYNC_DETAIL_MODAL_HOST__ === 'function') {
    try { window.__MVU_SYNC_DETAIL_MODAL_HOST__(); } catch (err) {}
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountMvuVue);
} else {
  mountMvuVue();
}

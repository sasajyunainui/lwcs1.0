/* eslint-disable vue/one-component-per-file -- 独立 script 模块按契约在同一 IIFE 内定义局部组件 */
(function installTTStoreVariableManager(globalScope) {
  'use strict';

  const currentWindow = globalScope?.window || globalScope;
  let hostWindow = currentWindow;
  try {
    if (currentWindow.parent?.document?.body) hostWindow = currentWindow.parent;
  } catch (_) {
    hostWindow = currentWindow;
  }

  const API_KEY = '__LWCS_TT_STORE_VARIABLE_MANAGER_V1__';
  const STYLE_ID = 'lwcs-tvm-style-v1';
  const ROOT_ID = 'lwcs-tvm-root-v1';
  const DATABASE_NAMESPACE = 'lwcs.database.v2';
  const previousApi = hostWindow[API_KEY];
  if (previousApi && typeof previousApi.destroy === 'function') {
    try { previousApi.destroy(); } catch (_) { /* replacement continues */ }
  }

  const Vue = hostWindow.Vue || currentWindow.Vue;
  if (!Vue?.createApp || !Vue?.defineComponent || !Vue?.h) {
    const unavailableApi = Object.freeze({
      open() { throw new Error('变量管理器尚未准备好，请稍后重试'); },
      close() {},
      destroy() { if (hostWindow[API_KEY] === unavailableApi) delete hostWindow[API_KEY]; },
      async refresh() { throw new Error('Vue 3 global 不可用'); },
      getStatus() { return Object.freeze({ mounted: false, open: false, error: 'VUE_UNAVAILABLE' }); },
    });
    hostWindow[API_KEY] = unavailableApi;
    return;
  }

  const {
    createApp,
    defineComponent,
    h,
    reactive,
    computed,
    watch,
    nextTick,
  } = Vue;

  function cloneJson(value) {
    if (value === undefined || value === null || typeof value !== 'object') return value;
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function canonicalJson(value) {
    if (value === undefined) return 'undefined';
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }

  function errorText(error) {
    return String(error?.message || error || '未知错误');
  }

  function valueKind(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  function pathKey(path) {
    return path.length === 0
      ? '$'
      : `$/` + path.map(part => String(part).replace(/~/g, '~0').replace(/\//g, '~1')).join('/');
  }

  function pathLabel(path) {
    return path.length ? ['变量', ...path].join(' › ') : '变量';
  }

  function getAtPath(rootValue, path) {
    let cursor = rootValue;
    for (const part of path) cursor = cursor?.[part];
    return cursor;
  }

  function isContainer(value) {
    return value !== null && typeof value === 'object';
  }

  function typeTag(value) {
    const kind = valueKind(value);
    return kind === 'string' ? '文本' : kind === 'number' ? '数字' : kind === 'boolean' ? '开关' : kind === 'array' ? '列表' : kind === 'object' ? '分组' : '空值';
  }

  function compactValue(value) {
    if (Array.isArray(value)) return value.length + ' 项';
    if (value && typeof value === 'object') return Object.keys(value).length + ' 项';
    if (value === null) return '空值';
    if (typeof value === 'string') return value || '空字符串';
    if (typeof value === 'boolean') return value ? '开启' : '关闭';
    return String(value);
  }

  function persistenceCandidates(status) {
    const sessions = Array.isArray(status) ? status : status?.sessions;
    return [
      status?.provider?.handle,
      status?.provider,
      status?.handle,
      ...(Array.isArray(sessions) ? sessions : []),
    ].filter(candidate => candidate && typeof candidate === 'object');
  }

  function extractRevision(data, status) {
    for (const candidate of persistenceCandidates(status)) {
      const revision = candidate.head?.revision ?? candidate.revision;
      if (revision !== undefined && revision !== null) return revision;
    }
    const direct = data?.revision ?? data?._revision;
    if (direct !== undefined && direct !== null) return direct;
    return null;
  }

  function extractStableChatId(status) {
    for (const candidate of persistenceCandidates(status)) {
      const stableChatId = candidate.stableChatId ?? candidate.stable_chat_id;
      if (stableChatId !== undefined && stableChatId !== null && String(stableChatId).trim()) return String(stableChatId);
    }
    return '';
  }

  function extractBackend(status) {
    for (const candidate of persistenceCandidates(status)) {
      if (candidate.backend) return String(candidate.backend);
    }
    return '';
  }

  function replaceAtPath(rootValue, path, nextValue) {
    if (path.length === 0) return nextValue;
    const nextRoot = cloneJson(rootValue);
    let cursor = nextRoot;
    for (let index = 0; index < path.length - 1; index += 1) cursor = cursor[path[index]];
    cursor[path[path.length - 1]] = nextValue;
    return nextRoot;
  }

  function safeStatus(value) {
    if (!value || typeof value !== 'object') return value ?? null;
    const allowed = [
      'version', 'phase', 'state', 'backend', 'stableChatId', 'stable_chat_id',
      'chatGeneration', 'domainGeneration', 'pending', 'loading', 'loaded', 'live',
      'error', 'revision', 'checkpointRevision', 'mode', 'schemaVersion', 'kind',
      'verifiedWrite', 'verifiedRead', 'listKeys', 'getJson', 'setJson', 'deleteJson',
    ];
    if (Array.isArray(value)) return value.map(safeStatus);
    const result = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(value, key)) result[key] = safeStatus(value[key]);
    }
    for (const key of ['provider', 'handle', 'head', 'floor', 'sessions']) {
      if (value[key] && typeof value[key] === 'object') result[key] = safeStatus(value[key]);
    }
    return result;
  }

  const state = reactive({
    visible: false,
    activeTab: 'mvu',
    viewportWidth: hostWindow.innerWidth || 1200,
    snapshot: null,
    baselineChatId: '',
    baselineStableChatId: '',
    baselineRevision: null,
    baselineFingerprint: '',
    drafts: {},
    expanded: new Set(['$']),
    currentPath: [],
    focusPathKey: '$',
    searchInput: '',
    searchQuery: '',
    searchResults: [],
    searchBusy: false,
    searchCapped: false,
    scrollTop: 0,
    viewportHeight: 480,
    saveState: 'clean',
    mvuLoading: false,
    mvuSaving: false,
    mvuError: '',
    mvuNotice: '',
    editingPathKey: '',
    editingPath: [],
    editingType: '',
    editingText: '',
    editingError: '',
    detailOpen: false,
    detailPath: [],
    detailType: '',
    detailText: '',
    detailError: '',
    verifiedPaths: new Set(),
    floorMessages: [],
    floorListLoading: false,
    floorError: '',
    floorSelectedIndex: null,
    floorDetail: null,
    floorDetailLoading: false,
    floorListScrollTop: 0,
    floorListHeight: 480,
    floorTreeScrollTop: 0,
    floorTreeHeight: 480,
    floorMobileDetail: false,
    floorExpanded: new Set(['$']),
    floorSearchInput: '',
    floorSearchQuery: '',
    floorSearchResults: [],
    floorSearchBusy: false,
    floorSearchCapped: false,
    floorFocusPathKey: '$',
    floorIdentity: '',
    databaseLoading: false,
    databaseError: '',
    databaseBackend: '',
    databaseStableChatId: '',
    databaseCapabilities: null,
    databaseKeys: [],
    databaseSelectedKey: '',
    databaseSelectedValue: undefined,
    databaseValueLoading: false,
    diagnosticLoading: false,
    diagnosticError: '',
    diagnostics: null,
  });

  let app = null;
  let rootElement = null;
  let styleElement = null;
  let openerElement = null;
  let databaseSession = null;
  let destroyed = false;
  let searchTimer = 0;
  let searchGeneration = 0;
  let verifiedTimer = 0;
  let sheetReturnElement = null;
  let floorGeneration = 0;
  let floorSearchTimer = 0;
  let floorSearchGeneration = 0;
  const floorCache = new Map();
  let chatEventSource = null;
  let chatChangedEvent = null;

  const draftList = computed(() => Object.values(state.drafts));
  const isDirty = computed(() => draftList.value.length > 0);
  const isMobile = computed(() => state.viewportWidth < 600);
  const floorRowHeight = computed(() => isMobile.value ? 48 : 32);
  const effectiveStatData = computed(() => {
    let result = cloneJson(state.snapshot?.stat_data || {});
    for (const entry of [...draftList.value].sort((left, right) => left.path.length - right.path.length)) {
      result = replaceAtPath(result, entry.path, cloneJson(entry.nextValue));
    }
    return result;
  });

  const revisionLabel = computed(() => {
    return state.baselineRevision === null ? '—' : String(state.baselineRevision);
  });

  const backendLabel = computed(() => {
    return extractBackend(state.diagnostics?.mvuPersistence) || state.databaseBackend || '不可用';
  });

  const saveStatusText = computed(() => {
    if (state.mvuSaving) return '正在保存';
    return isDirty.value ? `有 ${draftList.value.length} 项未保存` : '已保存';
  });

  function setDraft(path, nextValue) {
    const key = pathKey(path);
    const original = cloneJson(getAtPath(state.snapshot?.stat_data, path));
    const entries = Object.entries(state.drafts);
    const ancestor = entries.find(([, entry]) => entry.path.length <= path.length
      && entry.path.every((part, index) => part === path[index]));
    if (ancestor) {
      const [ancestorKey, entry] = ancestor;
      const relativePath = path.slice(entry.path.length);
      const mergedValue = relativePath.length
        ? replaceAtPath(entry.nextValue, relativePath, cloneJson(nextValue))
        : cloneJson(nextValue);
      if (canonicalJson(entry.original) === canonicalJson(mergedValue)) delete state.drafts[ancestorKey];
      else entry.nextValue = mergedValue;
    } else {
      for (const [otherKey, entry] of entries) {
        if (path.length < entry.path.length && path.every((part, index) => part === entry.path[index])) {
          delete state.drafts[otherKey];
        }
      }
      if (canonicalJson(original) === canonicalJson(nextValue)) delete state.drafts[key];
      else state.drafts[key] = { path: [...path], original, nextValue: cloneJson(nextValue) };
    }
    state.saveState = isDirty.value ? 'draft' : 'clean';
    state.mvuNotice = '';
    if (state.searchInput.trim()) scheduleSearch();
  }

  function discardPath(path) {
    delete state.drafts[pathKey(path)];
    state.saveState = isDirty.value ? 'draft' : 'clean';
    if (state.searchInput.trim()) scheduleSearch();
  }

  function discardDraft() {
    state.drafts = {};
    state.saveState = 'clean';
    state.mvuNotice = '已丢弃全部未保存修改。';
    if (state.searchInput.trim()) scheduleSearch();
  }

  function confirmDiscardDraft() {
    if (!isDirty.value) return;
    if (!hostWindow.confirm('丢弃当前所有未保存的变量修改？此操作无法撤销。')) return;
    discardDraft();
  }

  function readCanonicalHotMvu(mvu) {
    if (typeof mvu?.getMvuData !== 'function') throw new Error('Mvu.getMvuData 同步热读不可用');
    const data = mvu.getMvuData({ type: 'chat' });
    if (!data || typeof data !== 'object') throw new Error('未从当前 chat 热态读取到 canonical MvuData');
    if (!data.stat_data || typeof data.stat_data !== 'object' || Array.isArray(data.stat_data)) {
      throw new Error('当前 chat canonical 热态缺少有效 stat_data');
    }
    return cloneJson(data);
  }

  async function readCanonicalMvu() {
    const mvu = hostWindow.Mvu || currentWindow.Mvu;
    const chatIdBeforeIdle = currentChatId();
    if (typeof mvu?.persistence?.awaitIdle === 'function') await mvu.persistence.awaitIdle();
    const chatIdAfterIdle = currentChatId();
    if (chatIdBeforeIdle !== chatIdAfterIdle) throw new Error('等待持久化期间聊天已切换，已取消本次 canonical 读取');
    const data = readCanonicalHotMvu(mvu);
    const status = typeof mvu?.persistence?.getStatus === 'function'
      ? await Promise.resolve(mvu.persistence.getStatus())
      : null;
    if (chatIdAfterIdle !== currentChatId()) throw new Error('读取 canonical 状态期间聊天已切换');
    return {
      data,
      status,
      chatId: chatIdAfterIdle,
      stableChatId: extractStableChatId(status),
      revision: extractRevision(data, status),
    };
  }

  async function refreshMvu(options = {}) {
    if (state.mvuLoading || state.mvuSaving) return false;
    if (isDirty.value && options.discard !== true) {
      state.mvuNotice = '还有未保存的修改。请先保存或点击“丢弃全部”；重新读取不会覆盖这些修改。';
      return false;
    }
    state.mvuLoading = true;
    state.mvuError = '';
    state.mvuNotice = '';
    try {
      const result = await readCanonicalMvu();
      state.snapshot = result.data;
      state.baselineChatId = result.chatId;
      state.baselineStableChatId = result.stableChatId;
      state.baselineRevision = result.revision;
      state.baselineFingerprint = canonicalJson(result.data.stat_data);
      updateFloorIdentity(result.chatId, result.stableChatId, result.revision);
      state.drafts = {};
      state.saveState = 'clean';
      if (state.searchInput.trim()) scheduleSearch();
      return true;
    } catch (error) {
      state.mvuError = errorText(error);
      return false;
    } finally {
      state.mvuLoading = false;
    }
  }

  async function saveMvu() {
    if (state.mvuSaving || state.mvuLoading || !state.snapshot || !isDirty.value) return false;
    if (state.editingPathKey && !commitInlineEdit()) return false;
    if (!isDirty.value) return false;
    state.mvuSaving = true;
    state.saveState = 'saving';
    state.mvuError = '';
    state.mvuNotice = '';
    try {
      const current = await readCanonicalMvu();
      if (!state.baselineChatId || !current.chatId || state.baselineChatId !== current.chatId) {
        state.saveState = 'conflict';
        throw new Error('当前聊天身份与草稿基线不一致；未执行写入。');
      }
      if (!state.baselineStableChatId || !current.stableChatId || state.baselineStableChatId !== current.stableChatId) {
        state.saveState = 'conflict';
        throw new Error('TT-store stableChatId 缺失或与草稿基线不一致；未执行写入。');
      }
      if (state.baselineRevision === null || current.revision === null
        || String(current.revision) !== String(state.baselineRevision)
        || canonicalJson(current.data.stat_data) !== state.baselineFingerprint) {
        state.saveState = 'conflict';
        throw new Error('canonical revision 已变化；草稿已保留，请刷新基线后重新确认。');
      }
      for (const entry of draftList.value) {
        if (canonicalJson(getAtPath(current.data.stat_data, entry.path)) !== canonicalJson(entry.original)) {
          state.saveState = 'conflict';
          throw new Error('路径 ' + pathLabel(entry.path) + ' 的基线已变化；未执行覆盖。');
        }
      }
      const intendedStatData = cloneJson(effectiveStatData.value);
      const intendedDrafts = draftList.value.map(entry => ({ path: [...entry.path], nextValue: cloneJson(entry.nextValue) }));
      const nextData = { ...cloneJson(current.data), stat_data: intendedStatData };
      const mvu = hostWindow.Mvu || currentWindow.Mvu;
      if (typeof mvu?.replaceMvuData !== 'function') throw new Error('Mvu.replaceMvuData 不可用');
      await mvu.replaceMvuData(nextData, { type: 'chat' });
      const confirmed = await readCanonicalMvu();
      if (!confirmed.chatId || confirmed.chatId !== state.baselineChatId
        || !confirmed.stableChatId || confirmed.stableChatId !== state.baselineStableChatId
        || confirmed.revision === null) {
        state.saveState = 'conflict';
        throw new Error('写后回读身份或 revision 无法确认；草稿已保留。');
      }
      for (const entry of intendedDrafts) {
        if (canonicalJson(getAtPath(confirmed.data.stat_data, entry.path)) !== canonicalJson(entry.nextValue)) {
          state.saveState = 'conflict';
          throw new Error('写后回读路径不一致：' + pathLabel(entry.path));
        }
      }
      state.snapshot = confirmed.data;
      state.baselineChatId = confirmed.chatId;
      state.baselineStableChatId = confirmed.stableChatId;
      state.baselineRevision = confirmed.revision;
      state.baselineFingerprint = canonicalJson(confirmed.data.stat_data);
      updateFloorIdentity(confirmed.chatId, confirmed.stableChatId, confirmed.revision);
      state.drafts = {};
      state.verifiedPaths = new Set(intendedDrafts.map(entry => pathKey(entry.path)));
      state.saveState = 'verified';
      state.mvuNotice = '变量已保存。';
      hostWindow.clearTimeout(verifiedTimer);
      verifiedTimer = hostWindow.setTimeout(() => {
        state.verifiedPaths = new Set();
        if (state.saveState === 'verified') state.saveState = 'clean';
      }, 1200);
      await refreshDiagnostics();
      return true;
    } catch (error) {
      state.mvuError = errorText(error);
      if (state.saveState !== 'conflict') state.saveState = 'error';
      return false;
    } finally {
      state.mvuSaving = false;
    }
  }

  function parseEditedValue(kind, text) {
    if (kind === 'string') return text;
    if (kind === 'number') {
      const value = Number(text);
      if (!Number.isFinite(value)) throw new Error('请输入有效数字');
      return value;
    }
    if (kind === 'boolean') return text === 'true';
    if (kind === 'null') return null;
    try {
      const value = JSON.parse(text);
      if (!value || typeof value !== 'object') throw new Error('请输入有效的分组或列表内容。');
      return value;
    } catch (error) {
      if (error?.message === '请输入有效的分组或列表内容。') throw error;
      throw new Error('内容格式不正确，请检查括号、引号和逗号。');
    }
  }

  function beginInlineEdit(path, value) {
    if (value === null || isContainer(value) || (typeof value === 'string' && value.length > 120)) {
      openDetail(path, value);
      return;
    }
    state.editingPathKey = pathKey(path);
    state.editingPath = [...path];
    state.editingType = valueKind(value);
    state.editingText = value === null ? 'null' : String(value);
    state.editingError = '';
    state.saveState = 'editing';
    nextTick(() => rootElement?.querySelector('.lwcs-tvm-inline-input')?.focus());
  }

  function cancelInlineEdit() {
    state.editingPathKey = '';
    state.editingPath = [];
    state.editingText = '';
    state.editingError = '';
    state.saveState = isDirty.value ? 'draft' : 'clean';
  }

  function commitInlineEdit(path) {
    const targetPath = path || state.editingPath;
    if (!targetPath) return false;
    try {
      setDraft(targetPath, parseEditedValue(state.editingType, state.editingText));
      cancelInlineEdit();
      return true;
    } catch (error) {
      state.editingError = errorText(error);
      return false;
    }
  }

  function openDetail(path, value) {
    sheetReturnElement = hostWindow.document.activeElement;
    state.detailPath = [...path];
    state.detailType = valueKind(value);
    state.detailText = isContainer(value) ? JSON.stringify(value, null, 2) : value === null ? 'null' : String(value);
    state.detailError = '';
    state.detailOpen = true;
    state.saveState = 'editing';
    nextTick(() => rootElement?.querySelector('.lwcs-tvm-detail-input')?.focus());
  }

  function closeDetail() {
    state.detailOpen = false;
    state.detailError = '';
    state.saveState = isDirty.value ? 'draft' : 'clean';
    const target = sheetReturnElement;
    sheetReturnElement = null;
    nextTick(() => target?.isConnected && target.focus?.());
  }

  function commitDetail() {
    try {
      const nextValue = parseEditedValue(state.detailType, state.detailText);
      if (state.detailPath.length === 0 && (!nextValue || typeof nextValue !== 'object' || Array.isArray(nextValue))) {
        throw new Error('全部变量必须保持为一个分组。');
      }
      setDraft(state.detailPath, nextValue);
      closeDetail();
    } catch (error) {
      state.detailError = errorText(error);
    }
  }

  function makeRow(key, value, path, depth) {
    const ownKey = pathKey(path);
    const draft = state.drafts[ownKey] || null;
    return {
      key: ownKey,
      name: String(key),
      path,
      depth,
      value,
      container: isContainer(value),
      expanded: state.expanded.has(ownKey),
      draft,
      displayValue: draft ? draft.nextValue : value,
    };
  }

  function makeReadonlyRow(key, value, path, depth) {
    const ownKey = pathKey(path);
    return {
      key: ownKey,
      name: String(key),
      path,
      depth,
      value,
      container: isContainer(value),
      expanded: state.floorExpanded.has(ownKey),
      draft: null,
      displayValue: value,
    };
  }

  const visibleRows = computed(() => {
    if (!state.snapshot || isMobile.value || state.searchQuery) return [];
    const rows = [];
    const stack = Object.entries(effectiveStatData.value).reverse().map(([key, value]) => ({ key, value, path: [key], depth: 0 }));
    while (stack.length) {
      const item = stack.pop();
      const row = makeRow(item.key, item.value, item.path, item.depth);
      rows.push(row);
      if (row.container && row.expanded) {
        const children = Object.entries(row.displayValue);
        for (let index = children.length - 1; index >= 0; index -= 1) {
          const [key, value] = children[index];
          stack.push({ key, value, path: [...item.path, Array.isArray(row.displayValue) ? Number(key) : key], depth: item.depth + 1 });
        }
      }
    }
    return rows;
  });

  const mobileRows = computed(() => {
    const container = getAtPath(effectiveStatData.value, state.currentPath);
    if (!isContainer(container)) return [];
    return Object.entries(container).map(([key, value]) => {
      const part = Array.isArray(container) ? Number(key) : key;
      return makeRow(key, value, [...state.currentPath, part], 0);
    });
  });

  const floorRows = computed(() => {
    if (state.floorSearchQuery) return state.floorSearchResults;
    const root = state.floorDetail?.status === 'ready' ? state.floorDetail.hotState?.stat_data : null;
    if (!root || typeof root !== 'object') return [];
    const rows = [];
    const stack = Object.entries(root).reverse().map(([key, value]) => ({ key, value, path: [key], depth: 0 }));
    while (stack.length) {
      const item = stack.pop();
      const row = makeReadonlyRow(item.key, item.value, item.path, item.depth);
      rows.push(row);
      if (isContainer(row.value) && row.expanded) {
        const children = Object.entries(row.value);
        for (let index = children.length - 1; index >= 0; index -= 1) {
          const [key, value] = children[index];
          stack.push({ key, value, path: [...item.path, Array.isArray(row.value) ? Number(key) : key], depth: item.depth + 1 });
        }
      }
    }
    return rows;
  });

  function scheduleSearch() {
    hostWindow.clearTimeout(searchTimer);
    searchGeneration += 1;
    const generation = searchGeneration;
    searchTimer = hostWindow.setTimeout(() => runSearch(generation), 80);
  }

  function scheduleFloorSearch() {
    hostWindow.clearTimeout(floorSearchTimer);
    floorSearchGeneration += 1;
    const generation = floorSearchGeneration;
    floorSearchTimer = hostWindow.setTimeout(() => runFloorSearch(generation), 80);
  }

  function toggleFloorExpanded(row) {
    if (!row.container) return;
    if (state.floorExpanded.has(row.key)) state.floorExpanded.delete(row.key);
    else state.floorExpanded.add(row.key);
  }

  async function runFloorSearch(generation) {
    const query = state.floorSearchInput.trim().toLocaleLowerCase('zh-CN');
    const detail = state.floorDetail;
    const selectedIndex = state.floorSelectedIndex;
    const identity = state.floorIdentity;
    state.floorSearchQuery = query;
    state.floorSearchResults = [];
    state.floorSearchCapped = false;
    state.floorFocusPathKey = '$';
    if (!query || detail?.status !== 'ready') {
      state.floorSearchBusy = false;
      return;
    }
    state.floorSearchBusy = true;
    const results = [];
    const stack = [{ value: detail.hotState?.stat_data, path: [] }];
    let processed = 0;
    while (stack.length && results.length < 150) {
      const item = stack.pop();
      if (item.path.length) {
        const name = String(item.path[item.path.length - 1]);
        const searchable = [name, pathLabel(item.path), isContainer(item.value) ? '' : compactValue(item.value)]
          .join(' ').toLocaleLowerCase('zh-CN');
        if (searchable.includes(query)) results.push(makeReadonlyRow(name, item.value, item.path, 0));
      }
      if (isContainer(item.value)) {
        const children = Object.entries(item.value);
        for (let index = children.length - 1; index >= 0; index -= 1) {
          const [key, value] = children[index];
          stack.push({ value, path: [...item.path, Array.isArray(item.value) ? Number(key) : key] });
        }
      }
      processed += 1;
      if (processed % 750 === 0) {
        await new Promise(resolve => {
          if (typeof hostWindow.requestAnimationFrame === 'function') hostWindow.requestAnimationFrame(resolve);
          else hostWindow.setTimeout(resolve, 0);
        });
        if (generation !== floorSearchGeneration || destroyed || state.floorDetail !== detail
          || state.floorSelectedIndex !== selectedIndex || state.floorIdentity !== identity) return;
      }
    }
    if (generation !== floorSearchGeneration || destroyed || state.floorDetail !== detail
      || state.floorSelectedIndex !== selectedIndex || state.floorIdentity !== identity) return;
    state.floorSearchResults = results;
    state.floorSearchCapped = stack.length > 0;
    state.floorSearchBusy = false;
  }

  function focusFloorRow(index) {
    const rows = floorRows.value;
    const targetIndex = Math.max(0, Math.min(rows.length - 1, index));
    const row = rows[targetIndex];
    if (!row) return;
    state.floorFocusPathKey = row.key;
    const viewport = rootElement?.querySelector('.lwcs-tvm-floor-tree-viewport');
    if (rows.length > 400 && viewport) {
      const top = targetIndex * floorRowHeight.value;
      if (top < viewport.scrollTop) viewport.scrollTop = top;
      else if (top + floorRowHeight.value > viewport.scrollTop + viewport.clientHeight) {
        viewport.scrollTop = top - viewport.clientHeight + floorRowHeight.value;
      }
      state.floorTreeScrollTop = viewport.scrollTop;
    }
    nextTick(() => rootElement?.querySelector('.lwcs-tvm-floor-tree-viewport [data-path-key="'
      + String(row.key).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]')?.focus());
  }

  function handleFloorRowKeydown(event, row, index) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusFloorRow(index + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'ArrowRight' && row.container) {
      event.preventDefault();
      if (!row.expanded) toggleFloorExpanded(row);
      nextTick(() => focusFloorRow(floorRows.value.findIndex(item => item.key === row.key)));
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (row.container && row.expanded) {
        toggleFloorExpanded(row);
        nextTick(() => focusFloorRow(floorRows.value.findIndex(item => item.key === row.key)));
      } else if (row.path.length > 1) {
        const parentKey = pathKey(row.path.slice(0, -1));
        const parentIndex = floorRows.value.findIndex(item => item.key === parentKey);
        if (parentIndex >= 0) focusFloorRow(parentIndex);
      }
    }
  }

  async function runSearch(generation) {
    const query = state.searchInput.trim().toLocaleLowerCase('zh-CN');
    state.searchQuery = query;
    state.searchResults = [];
    state.searchCapped = false;
    if (!query || !state.snapshot) {
      state.searchBusy = false;
      return;
    }
    state.searchBusy = true;
    const results = [];
    const stack = [{ value: effectiveStatData.value, path: [] }];
    let processed = 0;
    while (stack.length && results.length < 150) {
      const item = stack.pop();
      if (item.path.length) {
        const name = String(item.path[item.path.length - 1]);
        const searchable = [name, pathLabel(item.path), isContainer(item.value) ? '' : compactValue(item.value)]
          .join(' ').toLocaleLowerCase('zh-CN');
        if (searchable.includes(query)) results.push(makeRow(name, item.value, item.path, 0));
      }
      if (isContainer(item.value)) {
        const children = Object.entries(item.value);
        for (let index = children.length - 1; index >= 0; index -= 1) {
          const [key, value] = children[index];
          stack.push({ value, path: [...item.path, Array.isArray(item.value) ? Number(key) : key] });
        }
      }
      processed += 1;
      if (processed % 750 === 0) {
        await new Promise(resolve => {
          if (typeof hostWindow.requestAnimationFrame === 'function') hostWindow.requestAnimationFrame(resolve);
          else hostWindow.setTimeout(resolve, 0);
        });
        if (generation !== searchGeneration || destroyed) return;
      }
    }
    if (generation !== searchGeneration || destroyed) return;
    state.searchResults = results;
    state.searchCapped = stack.length > 0;
    state.searchBusy = false;
  }

  function locateRow(path) {
    for (let depth = 1; depth < path.length; depth += 1) state.expanded.add(pathKey(path.slice(0, depth)));
    state.focusPathKey = pathKey(path);
    if (isMobile.value) state.currentPath = isContainer(getAtPath(effectiveStatData.value, path)) ? [...path] : path.slice(0, -1);
    state.searchInput = '';
    state.searchQuery = '';
    state.searchResults = [];
    nextTick(() => rootElement?.querySelector('[data-path-key="' + String(pathKey(path)).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]')?.focus());
  }

  function toggleExpanded(row, expanded) {
    if (!row.container) return;
    if (expanded ?? !state.expanded.has(row.key)) state.expanded.add(row.key);
    else state.expanded.delete(row.key);
  }

  function focusRow(index) {
    const rows = state.searchQuery ? state.searchResults : visibleRows.value;
    const targetIndex = Math.max(0, Math.min(rows.length - 1, index));
    const row = rows[targetIndex];
    if (!row) return;
    state.focusPathKey = row.key;
    const viewport = rootElement?.querySelector('.lwcs-tvm-tree-viewport');
    if (!state.searchQuery && rows.length > 400 && viewport) {
      const top = targetIndex * 32;
      if (top < viewport.scrollTop) viewport.scrollTop = top;
      else if (top + 32 > viewport.scrollTop + viewport.clientHeight) viewport.scrollTop = top - viewport.clientHeight + 32;
      state.scrollTop = viewport.scrollTop;
    }
    nextTick(() => rootElement?.querySelector('[data-path-key="' + String(row.key).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]')?.focus());
  }

  function handleRowKeydown(event, row, index) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusRow(index + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'ArrowRight' && row.container) {
      event.preventDefault(); toggleExpanded(row, true);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (row.container && row.expanded) toggleExpanded(row, false);
      else if (row.path.length > 1) locateRow(row.path.slice(0, -1));
    } else if (event.key === 'Enter') {
      event.preventDefault(); beginInlineEdit(row.path, row.displayValue);
    } else if (event.key === ' ' && typeof row.displayValue === 'boolean') {
      event.preventDefault(); setDraft(row.path, !row.displayValue);
    }
  }

  function currentChatId() {
    try {
      const context = hostWindow.SillyTavern?.getContext?.();
      const value = String(context?.chatId ?? context?.chat_id ?? '').trim();
      if (value) return value;
    } catch (_) { /* 回退到当前窗口上下文。 */ }
    try {
      const context = currentWindow.SillyTavern?.getContext?.();
      return String(context?.chatId ?? context?.chat_id ?? '').trim();
    } catch (_) { return ''; }
  }

  function floorFingerprint(text) {
    let hash = 2166136261;
    for (const character of String(text || '')) hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function floorRole(message) {
    if (message?.is_system) return '系统';
    if (message?.is_user) return '玩家';
    return '角色';
  }

  function floorSummary(message) {
    const text = String(message?.message ?? message?.mes ?? '').replace(/\s+/g, ' ').trim();
    return text.length > 90 ? text.slice(0, 87) + '…' : text || '（空消息）';
  }

  function invalidateFloorReads(clearSelection = false) {
    floorGeneration += 1;
    floorSearchGeneration += 1;
    hostWindow.clearTimeout(floorSearchTimer);
    state.floorListLoading = false;
    state.floorDetailLoading = false;
    state.floorSearchBusy = false;
    if (clearSelection) {
      state.floorSelectedIndex = null;
      state.floorDetail = null;
      state.floorMobileDetail = false;
      state.floorExpanded = new Set(['$']);
      state.floorSearchInput = '';
      state.floorSearchQuery = '';
      state.floorSearchResults = [];
      state.floorSearchCapped = false;
      state.floorFocusPathKey = '$';
      state.floorTreeScrollTop = 0;
    }
  }

  function syncFloorListScroll(reset = false) {
    nextTick(() => {
      const viewport = rootElement?.querySelector('.lwcs-tvm-floor-list');
      const viewportHeight = viewport?.clientHeight || state.floorListHeight;
      const maximum = Math.max(0, state.floorMessages.length * 56 - viewportHeight);
      const nextScrollTop = reset ? 0 : Math.max(0, Math.min(state.floorListScrollTop, maximum));
      state.floorListScrollTop = nextScrollTop;
      if (viewport) viewport.scrollTop = nextScrollTop;
    });
  }

  function unbindChatChange() {
    if (chatEventSource && chatChangedEvent) {
      if (typeof chatEventSource.off === 'function') chatEventSource.off(chatChangedEvent, handleChatChanged);
      else if (typeof chatEventSource.removeListener === 'function') chatEventSource.removeListener(chatChangedEvent, handleChatChanged);
    }
    chatEventSource = null;
    chatChangedEvent = null;
  }

  function handleChatChanged() {
    floorCache.clear();
    state.floorIdentity = '';
    state.floorMessages = [];
    state.floorListScrollTop = 0;
    invalidateFloorReads(true);
    syncFloorListScroll(true);
    if (state.visible && state.activeTab === 'floors') refreshFloorList();
  }

  function bindChatChange() {
    unbindChatChange();
    const context = hostWindow.SillyTavern?.getContext?.() || currentWindow.SillyTavern?.getContext?.();
    const source = context?.eventSource || hostWindow.eventSource || currentWindow.eventSource;
    const eventName = context?.event_types?.CHAT_CHANGED || hostWindow.event_types?.CHAT_CHANGED || currentWindow.event_types?.CHAT_CHANGED;
    if (typeof source?.on !== 'function' || !eventName) return;
    source.on(eventName, handleChatChanged);
    chatEventSource = source;
    chatChangedEvent = eventName;
  }

  function updateFloorIdentity(chatId, stableChatId, revision) {
    const identity = [chatId, stableChatId, revision ?? ''].join('|');
    if (identity !== state.floorIdentity) {
      state.floorIdentity = identity;
      floorCache.clear();
      state.floorListScrollTop = 0;
      invalidateFloorReads(true);
      syncFloorListScroll(true);
      return true;
    }
    return false;
  }

  async function refreshFloorList() {
    if (state.floorListLoading) return false;
    let generation = ++floorGeneration;
    state.floorListLoading = true;
    state.floorError = '';
    try {
      const canonical = await readCanonicalMvu();
      if (generation !== floorGeneration || state.activeTab !== 'floors') return false;
      const identityChanged = updateFloorIdentity(canonical.chatId, canonical.stableChatId, canonical.revision);
      generation = floorGeneration;
      const context = hostWindow.SillyTavern?.getContext?.() || currentWindow.SillyTavern?.getContext?.();
      const messages = Array.isArray(context?.chat) ? context.chat : [];
      if (canonical.chatId !== currentChatId()) throw new Error('读取楼层列表期间聊天已切换');
      state.floorMessages = messages.map((message, absoluteIndex) => ({
        absoluteIndex,
        role: floorRole(message),
        summary: floorSummary(message),
        swipeId: message?.swipe_id ?? null,
      }));
      syncFloorListScroll(identityChanged);
      return true;
    } catch (error) {
      if (generation === floorGeneration) state.floorError = errorText(error);
      return false;
    } finally {
      if (generation === floorGeneration) state.floorListLoading = false;
    }
  }

  function cacheFloorState(key, value) {
    if (floorCache.has(key)) floorCache.delete(key);
    floorCache.set(key, value);
    while (floorCache.size > 16) floorCache.delete(floorCache.keys().next().value);
  }

  async function selectFloor(absoluteIndex) {
    let generation = ++floorGeneration;
    state.floorSelectedIndex = absoluteIndex;
    state.floorDetail = null;
    state.floorDetailLoading = true;
    state.floorError = '';
    if (isMobile.value) state.floorMobileDetail = true;
    try {
      const requestedChatId = currentChatId();
      const helper = hostWindow.TavernHelper || currentWindow.TavernHelper;
      if (typeof helper?.getChatMessages !== 'function') throw new Error('TavernHelper.getChatMessages 不可用');
      const selectedMessages = await helper.getChatMessages(absoluteIndex, { include_swipes: true });
      if (!requestedChatId || requestedChatId !== currentChatId()) throw new Error('读取楼层消息期间聊天已切换');
      const message = Array.isArray(selectedMessages) ? selectedMessages.at(-1) : null;
      if (!message) throw new Error('无法读取第 ' + absoluteIndex + ' 楼消息');
      const text = String(message.message ?? message.mes ?? '');
      const pointer = {
        absoluteIndex,
        swipeId: message.swipe_id ?? null,
        textFingerprint: floorFingerprint(text),
      };
      const chatId = requestedChatId;
      const provider = hostWindow.__LWCS_MVU_PERSISTENCE_PROVIDER_V1__ || currentWindow.__LWCS_MVU_PERSISTENCE_PROVIDER_V1__;
      if (typeof provider?.open !== 'function') throw new Error('LWCS MVU Persistence Provider 不可用');
      const opened = await provider.open({ fallbackStableChatId: chatId });
      if (opened?.state !== 'committed' || !opened.handle) {
        throw new Error(opened?.error || '楼层持久化状态不可用：' + (opened?.state || 'unavailable'));
      }
      const liveHead = opened.handle.getHead?.() || null;
      const stableChatId = String(opened.stableChatId || opened.handle.stableChatId || '');
      const headRevision = liveHead?.revision ?? null;
      updateFloorIdentity(chatId, stableChatId, headRevision);
      generation = floorGeneration;
      state.floorSelectedIndex = absoluteIndex;
      state.floorDetailLoading = true;
      if (isMobile.value) state.floorMobileDetail = true;
      const cacheKey = [stableChatId, headRevision ?? '', pointer.absoluteIndex, pointer.swipeId ?? '', pointer.textFingerprint].join('|');
      let detail = floorCache.get(cacheKey);
      if (!detail) {
        const initialState = state.baselineChatId === chatId && state.snapshot
          ? cloneJson(state.snapshot)
          : (await readCanonicalMvu()).data;
        const result = await opened.handle.readState({ initialState, message: pointer });
        if (result?.state !== 'committed') {
          throw new Error(result?.error || '楼层读取失败：' + (result?.state || 'uncertain'));
        }
        if (!result.stableChatId || String(result.stableChatId) !== stableChatId) {
          throw new Error('楼层读取返回了不一致的 stableChatId');
        }
        const headAfterRead = opened.handle.getHead?.() || null;
        if (String(headAfterRead?.revision ?? '') !== String(headRevision ?? '')) {
          throw new Error('读取楼层期间 TT-store head revision 已变化，请重新选择该楼');
        }
        if (result.branchReset || !result.head) {
          detail = { status: 'none', pointer, stableChatId, headRevision };
        } else {
          const sourceFloor = result.head.floor || result.floor || null;
          detail = {
            status: 'ready',
            pointer,
            stableChatId: String(result.stableChatId || stableChatId),
            snapshotRevision: result.head.revision ?? null,
            sourceFloor: cloneJson(sourceFloor),
            inherited: Number.isInteger(sourceFloor?.absoluteIndex) && sourceFloor.absoluteIndex < absoluteIndex,
            hotState: cloneJson(result.hotState),
          };
          cacheFloorState(cacheKey, detail);
        }
      }
      if (generation !== floorGeneration || state.activeTab !== 'floors' || chatId !== currentChatId()) return false;
      state.floorDetail = cloneJson(detail);
      state.floorExpanded = new Set(['$']);
      state.floorTreeScrollTop = 0;
      state.floorSearchInput = '';
      state.floorSearchQuery = '';
      state.floorSearchResults = [];
      state.floorSearchBusy = false;
      state.floorSearchCapped = false;
      state.floorFocusPathKey = '$';
      floorSearchGeneration += 1;
      hostWindow.clearTimeout(floorSearchTimer);
      nextTick(() => {
        const viewport = rootElement?.querySelector('.lwcs-tvm-floor-tree-viewport');
        if (viewport) viewport.scrollTop = 0;
      });
      return true;
    } catch (error) {
      if (generation === floorGeneration) state.floorError = errorText(error);
      return false;
    } finally {
      if (generation === floorGeneration) state.floorDetailLoading = false;
    }
  }

  async function refreshDatabase() {
    if (state.databaseLoading) return false;
    state.databaseLoading = true;
    state.databaseError = '';
    state.databaseSelectedKey = '';
    state.databaseSelectedValue = undefined;
    try {
      const adapter = hostWindow.__LWCS_PERSISTENCE_ADAPTER_V1__;
      if (typeof adapter?.openSession !== 'function') throw new Error('LWCS 持久化适配器不可用');
      const opened = await adapter.openSession({ domain: 'database', fallbackStableChatId: currentChatId() });
      if (opened?.state !== 'committed' || !opened.session) {
        throw new Error(opened?.error || `数据库 session 状态：${opened?.state || 'unavailable'}`);
      }
      const session = opened.session;
      const result = await session.listKeys({ namespace: DATABASE_NAMESPACE });
      if (result?.state !== 'committed' || result?.verified !== true) {
        throw new Error(result?.error || `读取键列表失败：${result?.state || 'unknown'}`);
      }
      if (!Array.isArray(result.keys)) throw new Error('数据库 listKeys 返回值缺少 keys 数组');
      databaseSession = session;
      state.databaseBackend = session.backend || '';
      state.databaseStableChatId = session.stableChatId || '';
      state.databaseCapabilities = safeStatus(session.capabilities);
      state.databaseKeys = [...result.keys].sort((left, right) => left.localeCompare(right, 'zh-CN'));
      return true;
    } catch (error) {
      databaseSession = null;
      state.databaseBackend = '';
      state.databaseStableChatId = '';
      state.databaseCapabilities = null;
      state.databaseKeys = [];
      state.databaseError = errorText(error);
      return false;
    } finally {
      state.databaseLoading = false;
    }
  }

  async function selectDatabaseKey(key) {
    if (!databaseSession || state.databaseValueLoading) return;
    state.databaseSelectedKey = key;
    state.databaseSelectedValue = undefined;
    state.databaseValueLoading = true;
    state.databaseError = '';
    try {
      const result = await databaseSession.getJson({ namespace: DATABASE_NAMESPACE, key });
      if (result?.state !== 'committed' || result?.verified !== true) {
        throw new Error(result?.error || `读取 ${key} 失败`);
      }
      state.databaseSelectedValue = cloneJson(result.value);
    } catch (error) {
      state.databaseError = errorText(error);
    } finally {
      state.databaseValueLoading = false;
    }
  }

  async function openDatabaseEditor() {
    state.databaseError = '';
    try {
      const openVisualizer = hostWindow.AutoCardUpdaterV2API?.openVisualizer;
      if (typeof openVisualizer !== 'function') throw new Error('数据库编辑器 API 不可用：AutoCardUpdaterV2API.openVisualizer');
      await openVisualizer();
    } catch (error) {
      state.databaseError = errorText(error);
    }
  }

  async function refreshDiagnostics() {
    if (state.diagnosticLoading) return false;
    state.diagnosticLoading = true;
    state.diagnosticError = '';
    try {
      const mvu = hostWindow.Mvu || currentWindow.Mvu;
      const provider = hostWindow.__LWCS_MVU_PERSISTENCE_PROVIDER_V1__;
      const adapter = hostWindow.__LWCS_PERSISTENCE_ADAPTER_V1__;
      const mvuPersistence = typeof mvu?.persistence?.getStatus === 'function'
        ? await Promise.resolve(mvu.persistence.getStatus())
        : null;
      const providerStatus = typeof provider?.getStatus === 'function'
        ? await Promise.resolve(provider.getStatus())
        : null;
      state.diagnostics = {
        mvuPersistence: safeStatus(mvuPersistence),
        provider: {
          available: !!provider,
          version: provider?.version || null,
          namespace: provider?.namespace || null,
          status: safeStatus(providerStatus),
        },
        adapter: {
          available: !!adapter,
          version: adapter?.version || null,
          domains: adapter?.domains ? Object.keys(adapter.domains) : [],
          chatGeneration: typeof adapter?.getChatGeneration === 'function' ? adapter.getChatGeneration() : null,
          databaseDomainGeneration: typeof adapter?.getDomainGeneration === 'function'
            ? adapter.getDomainGeneration('database')
            : null,
        },
        database: databaseSession ? {
          state: 'committed',
          backend: state.databaseBackend,
          stableChatId: state.databaseStableChatId,
          capabilities: state.databaseCapabilities,
          keyCount: state.databaseKeys.length,
        } : { state: 'unavailable' },
      };
      return true;
    } catch (error) {
      state.diagnosticError = errorText(error);
      return false;
    } finally {
      state.diagnosticLoading = false;
    }
  }

  async function refreshActive() {
    if (destroyed) throw new Error('变量管理器已关闭，请重新打开');
    if (state.activeTab === 'mvu') return refreshMvu();
    if (state.activeTab === 'floors') return refreshFloorList();
    if (state.activeTab === 'database') {
      const result = await refreshDatabase();
      await refreshDiagnostics();
      return result;
    }
    return refreshDiagnostics();
  }

  function focusableElements() {
    if (!rootElement) return [];
    return [...rootElement.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )].filter(element => element.getClientRects().length > 0);
  }

  function handleGlobalKeydown(event) {
    if (!state.visible) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (state.detailOpen) { closeDetail(); return; }
      if (state.editingPathKey) { cancelInlineEdit(); return; }
      closeManager();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      rootElement?.querySelector('.lwcs-tvm-search input')?.focus();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (state.activeTab === 'mvu') saveMvu();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusables = focusableElements();
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && hostWindow.document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && hostWindow.document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function openManager() {
    if (destroyed) throw new Error('变量管理器已关闭，请重新打开');
    if (state.visible) {
      rootElement?.querySelector('.lwcs-tvm-close')?.focus();
      return;
    }
    openerElement = hostWindow.document.activeElement;
    handleViewportChange();
    state.visible = true;
    hostWindow.document.addEventListener('keydown', handleGlobalKeydown, true);
    bindChatChange();
    hostWindow.addEventListener('resize', handleViewportChange);
    hostWindow.visualViewport?.addEventListener('resize', handleViewportChange);
    await nextTick();
    rootElement?.querySelector('.lwcs-tvm-close')?.focus();
    await refreshActive();
    if (destroyed || !state.visible) return;
    if (state.activeTab !== 'diagnostics') await refreshDiagnostics();
  }

  function closeManager() {
    invalidateFloorReads(false);
    state.visible = false;
    hostWindow.document.removeEventListener('keydown', handleGlobalKeydown, true);
    unbindChatChange();
    hostWindow.removeEventListener('resize', handleViewportChange);
    hostWindow.visualViewport?.removeEventListener('resize', handleViewportChange);
    hostWindow.document.documentElement.style.removeProperty('--lwcs-tvm-visual-height');
    const target = openerElement;
    openerElement = null;
    if (target?.isConnected && typeof target.focus === 'function') target.focus();
  }

  function handleViewportChange() {
    const previousFloorRowHeight = state.viewportWidth < 600 ? 48 : 32;
    const nextWidth = hostWindow.visualViewport?.width || hostWindow.innerWidth || 1200;
    const nextFloorRowHeight = nextWidth < 600 ? 48 : 32;
    if (previousFloorRowHeight !== nextFloorRowHeight && state.floorTreeScrollTop > 0) {
      state.floorTreeScrollTop = Math.floor(state.floorTreeScrollTop / previousFloorRowHeight) * nextFloorRowHeight;
      nextTick(() => {
        const viewport = rootElement?.querySelector('.lwcs-tvm-floor-tree-viewport');
        if (viewport) viewport.scrollTop = state.floorTreeScrollTop;
      });
    }
    state.viewportWidth = nextWidth;
    hostWindow.document.documentElement.style.setProperty('--lwcs-tvm-visual-height', (hostWindow.visualViewport?.height || hostWindow.innerHeight) + 'px');
  }

  const DataRow = defineComponent({
    name: 'LwcsTvmDataRow',
    props: {
      row: { type: Object, required: true },
      index: { type: Number, required: true },
      searchMode: { type: Boolean, default: false },
      readonly: { type: Boolean, default: false },
    },
    setup(props) {
      return () => {
        const row = props.row;
        const draft = row.draft;
        const value = row.displayValue;
        const editing = !props.readonly && state.editingPathKey === row.key;
        let valueNode;
        if (editing) {
          const input = state.editingType === 'boolean'
            ? h('select', { class: 'lwcs-tvm-inline-input', value: state.editingText, onChange: event => { state.editingText = event.target.value; }, onKeydown: event => {
              if (event.key === 'Enter') commitInlineEdit(row.path);
              if (event.key === 'Escape') cancelInlineEdit();
            } }, [h('option', { value: 'true' }, '开启'), h('option', { value: 'false' }, '关闭')])
            : h('input', { class: 'lwcs-tvm-inline-input', type: state.editingType === 'number' ? 'number' : 'text', value: state.editingText,
              onInput: event => { state.editingText = event.target.value; }, onKeydown: event => {
                if (event.key === 'Enter') commitInlineEdit(row.path);
                if (event.key === 'Escape') cancelInlineEdit();
              } });
          valueNode = h('div', { class: 'lwcs-tvm-inline-editor' }, [
            input,
            h('button', { type: 'button', onClick: () => commitInlineEdit(row.path) }, '确认'),
            h('button', { type: 'button', onClick: cancelInlineEdit }, '取消'),
          ]);
        } else if (draft) {
          valueNode = h('div', { class: 'lwcs-tvm-diff' }, [
            h('span', { class: 'lwcs-tvm-old' }, compactValue(draft.original)),
            h('span', { class: 'lwcs-tvm-arrow', 'aria-hidden': 'true' }, '→'),
            h('span', { class: 'lwcs-tvm-new' }, compactValue(draft.nextValue)),
          ]);
        } else {
          valueNode = h('span', { class: 'lwcs-tvm-cell-value', title: compactValue(value) }, compactValue(value));
        }
        const actions = [
          h('button', { type: 'button', class: 'lwcs-tvm-row-action', onClick: () => hostWindow.navigator?.clipboard?.writeText(pathLabel(row.path)) }, '复制'),
        ];
        if (!props.readonly) actions.push(h('button', { type: 'button', class: 'lwcs-tvm-row-action', onClick: () => openDetail(row.path, value) }, '详情'));
        if (!props.readonly && draft) actions.push(h('button', { type: 'button', class: 'lwcs-tvm-row-action lwcs-tvm-undo', onClick: () => discardPath(row.path) }, '撤销'));
        return h('div', {
          class: ['lwcs-tvm-row', props.readonly ? 'is-readonly' : '', draft ? 'is-draft' : '', !props.readonly && state.verifiedPaths.has(row.key) ? 'is-verified' : ''],
          role: 'treeitem', tabindex: props.readonly
            ? (state.floorFocusPathKey === row.key || (state.floorFocusPathKey === '$' && props.index === 0) ? 0 : -1)
            : state.focusPathKey === row.key || (state.focusPathKey === '$' && props.index === 0) ? 0 : -1,
          'aria-level': row.depth + 1, 'aria-expanded': row.container ? String(row.expanded) : undefined,
          'aria-posinset': props.index + 1, 'data-path-key': row.key, style: { '--lwcs-tvm-depth': String(row.depth) },
          onFocus: () => {
            if (props.readonly) state.floorFocusPathKey = row.key;
            else state.focusPathKey = row.key;
          },
          onKeydown: event => {
            if (props.readonly) {
              handleFloorRowKeydown(event, row, props.index);
              return;
            }
            handleRowKeydown(event, row, props.index);
          },
          onDblclick: () => { if (!props.readonly) beginInlineEdit(row.path, value); },
        }, [
          h('div', { class: 'lwcs-tvm-cell-key' }, [
            row.container ? h('button', { type: 'button', class: 'lwcs-tvm-disclosure',
              'aria-label': props.readonly
                ? (row.expanded ? '折叠 ' : '展开 ') + row.name
                : isMobile.value ? '进入 ' + row.name : (row.expanded ? '折叠 ' : '展开 ') + row.name,
              onClick: () => {
                if (props.readonly) {
                  state.floorFocusPathKey = row.key;
                  toggleFloorExpanded(row);
                }
                else if (isMobile.value) state.currentPath = [...row.path];
                else toggleExpanded(row);
              } }, props.readonly ? (row.expanded ? '−' : '+') : isMobile.value ? '›' : row.expanded ? '−' : '+') : h('span', { class: 'lwcs-tvm-scalar-space' }),
            h('span', { class: 'lwcs-tvm-key-text', title: row.name }, row.name),
          ]),
          props.searchMode ? (props.readonly
            ? h('span', { class: 'lwcs-tvm-breadcrumb-value' }, pathLabel(row.path))
            : h('button', { type: 'button', class: 'lwcs-tvm-breadcrumb-value', onClick: () => locateRow(row.path) }, pathLabel(row.path)))
            : h('span', { class: 'lwcs-tvm-type' }, typeTag(value)),
          h('div', { class: 'lwcs-tvm-value-wrap', onClick: () => {
            if (props.readonly || !isMobile.value) return;
            if (row.container) state.currentPath = [...row.path];
            else openDetail(row.path, value);
          } }, valueNode),
          h('div', { class: 'lwcs-tvm-row-actions' }, actions),
        ]);
      };
    },
  });

  const MvuPage = defineComponent({
    name: 'LwcsTvmMvuPage',
    setup() {
      const rows = computed(() => state.searchQuery ? state.searchResults : isMobile.value ? mobileRows.value : visibleRows.value);
      const virtual = computed(() => !isMobile.value && !state.searchQuery && rows.value.length > 400);
      const start = computed(() => virtual.value ? Math.max(0, Math.floor(state.scrollTop / 32) - 10) : 0);
      const end = computed(() => virtual.value ? Math.min(rows.value.length, start.value + Math.ceil(state.viewportHeight / 32) + 20) : rows.value.length);
      function detailSheet() {
        if (!state.detailOpen) return null;
        const original = getAtPath(state.snapshot?.stat_data, state.detailPath);
        return h('div', { class: 'lwcs-tvm-sheet-backdrop', onMousedown: event => { if (event.target === event.currentTarget) closeDetail(); } }, [
          h('section', { class: 'lwcs-tvm-detail-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'lwcs-tvm-detail-title' }, [
            h('header', null, [h('div', null, [
              h('span', { class: 'lwcs-tvm-kicker' }, typeTag(getAtPath(effectiveStatData.value, state.detailPath))),
              h('h3', { id: 'lwcs-tvm-detail-title' }, state.detailPath.length ? String(state.detailPath.at(-1)) : '全部变量'),
              h('p', null, pathLabel(state.detailPath)),
            ]), h('button', { type: 'button', class: 'lwcs-tvm-icon-button', 'aria-label': '关闭详情', onClick: closeDetail }, '×')]),
            h('div', { class: 'lwcs-tvm-detail-body' }, [
              h('select', { value: state.detailType, 'aria-label': '值类型', onChange: event => {
                state.detailType = event.target.value;
                if (event.target.value === 'boolean') state.detailText = ['true', 'false'].includes(state.detailText) ? state.detailText : 'false';
                if (event.target.value === 'null') state.detailText = 'null';
              } }, [
                ['string', '文本'], ['number', '数字'], ['boolean', '开关'], ['null', '空值'], ['object', '分组'], ['array', '列表'],
              ].map(([kind, label]) => h('option', { value: kind }, label))),
              state.detailType === 'boolean'
                ? h('button', { type: 'button', class: 'lwcs-tvm-boolean-toggle', onClick: () => { state.detailText = state.detailText === 'true' ? 'false' : 'true'; } }, (state.detailText === 'true' ? '开启' : '关闭') + ' · 点击切换')
                : state.detailType === 'null'
                  ? h('div', { class: 'lwcs-tvm-state' }, '空值')
                : h('textarea', { class: 'lwcs-tvm-detail-input', rows: 12, value: state.detailText, spellcheck: 'false', 'aria-label': '编辑值',
                  onInput: event => { state.detailText = event.target.value; } }),
              h('div', { class: 'lwcs-tvm-original-block' }, [h('span', null, '保存前的值'), h('pre', null, isContainer(original) ? JSON.stringify(original, null, 2) : compactValue(original))]),
              state.detailError ? h('p', { class: 'lwcs-tvm-message is-error', role: 'alert' }, state.detailError) : null,
            ]),
            h('footer', null, [
              h('button', { type: 'button', onClick: () => {
                state.detailType = valueKind(original);
                state.detailText = isContainer(original) ? JSON.stringify(original, null, 2) : original === null ? 'null' : String(original);
              } }, '恢复原值'),
              h('button', { type: 'button', onClick: closeDetail }, '取消'),
              h('button', { type: 'button', class: 'lwcs-tvm-primary', onClick: commitDetail }, '加入待保存'),
            ]),
          ]),
        ]);
      }
      return () => {
        const shown = rows.value.slice(start.value, end.value);
        const crumbs = [{ label: '变量', path: [] }, ...state.currentPath.map((part, index) => ({ label: String(part), path: state.currentPath.slice(0, index + 1) }))];
        return h('section', { class: 'lwcs-tvm-mvu-page' }, [
          h('div', { class: 'lwcs-tvm-context-bar' }, [
            h('div', { class: 'lwcs-tvm-context' }, [
              h('strong', null, '当前聊天 · 变量'),
              h('span', { class: 'lwcs-tvm-badge', 'data-state': state.saveState }, saveStatusText.value),
            ]),
            h('label', { class: 'lwcs-tvm-search' }, [h('span', { class: 'lwcs-tvm-sr-only' }, '搜索变量'), h('input', {
              type: 'search', value: state.searchInput, placeholder: '搜索名称或内容  Ctrl+P',
              onInput: event => { state.searchInput = event.target.value; scheduleSearch(); },
            })]),
            h('div', { class: 'lwcs-tvm-tree-tools' }, [
              !isMobile.value ? h('button', { type: 'button', onClick: () => {
                const next = new Set(state.expanded);
                visibleRows.value.filter(row => row.container && row.depth < 1).forEach(row => next.add(row.key));
                state.expanded = next;
              } }, '展开一级') : null,
              h('button', { type: 'button', onClick: () => { state.expanded = new Set(['$']); } }, '全部折叠'),
              h('button', { type: 'button', onClick: () => openDetail([], effectiveStatData.value) }, '查看全部'),
              h('button', { type: 'button', disabled: state.mvuLoading || state.mvuSaving, onClick: () => refreshMvu() }, '重新读取'),
            ]),
          ]),
          h('div', { class: 'lwcs-tvm-status-stack' }, [
            isMobile.value && !state.searchQuery ? h('nav', { class: 'lwcs-tvm-mobile-crumbs', 'aria-label': '当前位置' }, crumbs.map((crumb, index) => h('button', {
              type: 'button', class: index === crumbs.length - 1 ? 'is-current' : '', onClick: () => { state.currentPath = [...crumb.path]; },
            }, crumb.label))) : null,
            state.editingError ? h('p', { class: 'lwcs-tvm-message is-error', role: 'alert' }, state.editingError) : null,
            state.mvuError ? h('p', { class: 'lwcs-tvm-message is-error', role: 'alert' }, state.saveState === 'conflict'
                ? '检测到其他更新，当前修改尚未保存。请保留修改并重试。'
                : '操作没有完成。请重试；如需重新读取，请先保存或丢弃当前修改。') : null,
            state.mvuNotice ? h('p', { class: 'lwcs-tvm-message', role: 'status' }, state.mvuNotice) : null,
            state.searchBusy ? h('p', { class: 'lwcs-tvm-message', role: 'status' }, '正在检索…') : null,
            state.searchCapped ? h('p', { class: 'lwcs-tvm-message' }, '仅显示前 150 条匹配结果。') : null,
          ]),
          h('div', { class: 'lwcs-tvm-grid-head' }, [h('span', null, '名称'), h('span', null, '类型'), h('span', null, '当前值与修改'), h('span', null, '操作')]),
          h('div', { class: 'lwcs-tvm-tree-viewport', role: 'tree', 'aria-label': '当前聊天变量', 'aria-rowcount': rows.value.length,
            onScroll: event => { state.scrollTop = event.currentTarget.scrollTop; state.viewportHeight = event.currentTarget.clientHeight; } }, [
            start.value ? h('div', { style: { height: start.value * 32 + 'px' } }) : null,
            ...shown.map((row, index) => h(DataRow, { key: row.key, row, index: start.value + index, searchMode: !!state.searchQuery })),
            virtual.value && end.value < rows.value.length ? h('div', { style: { height: (rows.value.length - end.value) * 32 + 'px' } }) : null,
            !state.mvuLoading && !rows.value.length ? h('div', { class: 'lwcs-tvm-empty' }, state.searchQuery
              ? '没有找到匹配的变量。'
              : [h('p', null, '当前聊天暂时没有可显示的变量。'), h('button', { type: 'button', onClick: () => refreshMvu() }, '重新读取')]) : null,
          ]),
          h('footer', { class: 'lwcs-tvm-draft-bar' }, [
            h('div', null, [h('strong', null, saveStatusText.value),
              h('span', null, state.saveState === 'conflict' ? '检测到其他更新，当前修改仍保留。' : '只保存当前修改；完成后会重新确认结果。')]),
            h('button', { type: 'button', disabled: !isDirty.value || state.mvuSaving, onClick: confirmDiscardDraft }, '丢弃全部'),
            h('button', { type: 'button', class: 'lwcs-tvm-primary lwcs-tvm-save', disabled: !isDirty.value || state.mvuSaving || state.mvuLoading, onClick: saveMvu },
              state.mvuSaving ? '正在保存…' : '保存修改'),
          ]),
          detailSheet(),
        ]);
      };
    },
  });
  const FloorPage = defineComponent({
    name: 'LwcsTvmFloorPage',
    setup() {
      const listStart = computed(() => Math.max(0, Math.floor(state.floorListScrollTop / 56) - 6));
      const listEnd = computed(() => Math.min(state.floorMessages.length, listStart.value + Math.ceil(state.floorListHeight / 56) + 12));
      const treeVirtual = computed(() => floorRows.value.length > 400);
      const treeStart = computed(() => treeVirtual.value ? Math.max(0, Math.floor(state.floorTreeScrollTop / floorRowHeight.value) - 10) : 0);
      const treeEnd = computed(() => treeVirtual.value
        ? Math.min(floorRows.value.length, treeStart.value + Math.ceil(state.floorTreeHeight / floorRowHeight.value) + 20)
        : floorRows.value.length);

      function renderList() {
        const shown = state.floorMessages.slice(listStart.value, listEnd.value);
        return h('div', {
          class: 'lwcs-tvm-floor-list',
          'aria-label': '聊天楼层',
          onScroll: event => {
            state.floorListScrollTop = event.currentTarget.scrollTop;
            state.floorListHeight = event.currentTarget.clientHeight;
          },
        }, [
          listStart.value ? h('div', { style: { height: listStart.value * 56 + 'px' }, 'aria-hidden': 'true' }) : null,
          ...shown.map(item => h('button', {
            type: 'button',
            class: ['lwcs-tvm-floor-item', state.floorSelectedIndex === item.absoluteIndex ? 'is-selected' : ''],
            'aria-current': state.floorSelectedIndex === item.absoluteIndex ? 'true' : undefined,
            onClick: () => selectFloor(item.absoluteIndex),
          }, [
            h('span', { class: 'lwcs-tvm-floor-number' }, '第 ' + item.absoluteIndex + ' 楼'),
            h('span', { class: 'lwcs-tvm-floor-role' }, item.role),
            h('span', { class: 'lwcs-tvm-floor-summary' }, item.summary),
          ])),
          listEnd.value < state.floorMessages.length
            ? h('div', { style: { height: (state.floorMessages.length - listEnd.value) * 56 + 'px' }, 'aria-hidden': 'true' })
            : null,
          !state.floorListLoading && !state.floorMessages.length ? h('div', { class: 'lwcs-tvm-empty' }, '当前聊天暂时没有可显示的楼层记录。') : null,
        ]);
      }

      function renderDetail() {
        if (state.floorDetailLoading) return h('div', { class: 'lwcs-tvm-state', role: 'status' }, '正在读取该楼变量…');
        if (!state.floorDetail) return h('div', { class: 'lwcs-tvm-state' }, '选择一个楼层后查看当时的变量记录。');
        if (state.floorDetail.status === 'none') {
          return h('div', { class: 'lwcs-tvm-floor-none' }, [
            h('strong', null, '该楼没有可显示的变量记录'),
            h('p', null, '可以选择其他楼层，或点击“重新读取”后再试。'),
          ]);
        }
        const detail = state.floorDetail;
        const sourceIndex = detail.sourceFloor?.absoluteIndex;
        const rows = floorRows.value.slice(treeStart.value, treeEnd.value);
        const top = treeVirtual.value ? treeStart.value * floorRowHeight.value : 0;
        const bottom = treeVirtual.value ? (floorRows.value.length - treeEnd.value) * floorRowHeight.value : 0;
        return h('div', { class: 'lwcs-tvm-floor-detail-inner' }, [
          h('div', { class: 'lwcs-tvm-floor-detail-head' }, [
            isMobile.value ? h('button', { type: 'button', onClick: () => { state.floorMobileDetail = false; } }, '返回楼层') : null,
            h('div', null, [
              h('strong', null, '第 ' + detail.pointer.absoluteIndex + ' 楼'),
              detail.inherited ? h('span', { class: 'lwcs-tvm-inherited' }, '沿用第 ' + sourceIndex + ' 楼的变量记录') : h('span', null, '本楼变量记录'),
            ]),
            h('button', { type: 'button', class: 'lwcs-tvm-primary', onClick: () => { state.activeTab = 'mvu'; } }, '编辑当前变量'),
          ]),
          h('div', { class: 'lwcs-tvm-floor-tree-tools' }, [
            h('label', { class: 'lwcs-tvm-search' }, [
              h('span', { class: 'lwcs-tvm-sr-only' }, '搜索楼层变量'),
              h('input', { type: 'search', value: state.floorSearchInput, placeholder: '搜索该楼的名称或内容',
                onInput: event => { state.floorSearchInput = event.target.value; scheduleFloorSearch(); } }),
            ]),
            state.floorSearchBusy ? h('span', { class: 'lwcs-tvm-floor-search-state', role: 'status' }, '搜索中…') : null,
            state.floorSearchCapped ? h('span', { class: 'lwcs-tvm-floor-search-state' }, '仅显示前 150 条') : null,
            h('button', { type: 'button', onClick: () => {
              state.floorExpanded = new Set(['$']);
              state.floorFocusPathKey = '$';
              state.floorTreeScrollTop = 0;
              nextTick(() => {
                const viewport = rootElement?.querySelector('.lwcs-tvm-floor-tree-viewport');
                if (viewport) viewport.scrollTop = 0;
              });
            } }, '全部折叠'),
          ]),
          h('div', { class: 'lwcs-tvm-grid-head' }, [h('span', null, '名称'), h('span', null, '类型'), h('span', null, '当时的值'), h('span', null, '操作')]),
          h('div', { class: 'lwcs-tvm-tree-viewport lwcs-tvm-floor-tree-viewport', role: 'tree', 'aria-label': '楼层变量记录',
            'aria-rowcount': floorRows.value.length, 'aria-busy': String(state.floorSearchBusy),
            onScroll: event => { state.floorTreeScrollTop = event.currentTarget.scrollTop; state.floorTreeHeight = event.currentTarget.clientHeight; } }, [
            top ? h('div', { style: { height: top + 'px' }, 'aria-hidden': 'true' }) : null,
            ...rows.map((row, index) => h(DataRow, { key: row.key, row, index: treeStart.value + index, readonly: true, searchMode: !!state.floorSearchQuery })),
            bottom ? h('div', { style: { height: bottom + 'px' }, 'aria-hidden': 'true' }) : null,
            !state.floorSearchBusy && !floorRows.value.length
              ? h('div', { class: 'lwcs-tvm-empty' }, state.floorSearchQuery ? '没有找到匹配的变量。' : '该楼暂时没有可显示的变量。')
              : null,
          ]),
        ]);
      }

      return () => h('section', { class: ['lwcs-tvm-floor-page', state.floorMobileDetail ? 'is-mobile-detail' : ''] }, [
        h('header', { class: 'lwcs-tvm-floor-toolbar' }, [
          h('div', null, [h('strong', null, '楼层记录'), h('span', null, '查看各楼层保存下来的变量；这里不会修改内容。')]),
          h('button', { type: 'button', disabled: state.floorListLoading, onClick: refreshFloorList }, state.floorListLoading ? '读取中…' : '重新读取'),
        ]),
        h('div', { class: 'lwcs-tvm-floor-status' }, [
          state.floorError ? h('p', { class: 'lwcs-tvm-message is-error', role: 'alert' }, '楼层记录暂时无法读取。请点击“重新读取”再试。') : null,
        ]),
        h('div', { class: 'lwcs-tvm-floor-workspace' }, [
          h('aside', { class: 'lwcs-tvm-floor-list-pane' }, [renderList()]),
          h('main', { class: 'lwcs-tvm-floor-detail' }, [renderDetail()]),
        ]),
      ]);
    },
  });

  const DatabasePage = defineComponent({
    name: 'LwcsTvmDatabasePage',
    setup() {
      return () => {
        const selectedIndex = state.databaseKeys.indexOf(state.databaseSelectedKey);
        return h('section', { class: 'lwcs-tvm-page', 'aria-labelledby': 'lwcs-tvm-db-title' }, [
        h('div', { class: 'lwcs-tvm-page-heading' }, [
          h('div', null, [
            h('h2', { id: 'lwcs-tvm-db-title' }, '剧情资料 / 数据库'),
            h('p', null, '这里用于查看已保存的资料；修改内容请使用数据库编辑器。'),
          ]),
          h('div', { class: 'lwcs-tvm-actions' }, [
            h('button', { type: 'button', disabled: state.databaseLoading, onClick: refreshDatabase }, state.databaseLoading ? '读取中…' : '重新读取'),
            h('button', { class: 'lwcs-tvm-primary', type: 'button', onClick: openDatabaseEditor }, '打开数据库编辑器'),
          ]),
        ]),
        state.databaseError ? h('div', { class: 'lwcs-tvm-alert lwcs-tvm-alert-error', role: 'alert' }, '剧情资料暂时无法读取。请点击“重新读取”或打开数据库编辑器。') : null,
        h('div', { class: 'lwcs-tvm-db-layout' }, [
          h('div', { class: 'lwcs-tvm-key-list', 'aria-label': '剧情资料项目' }, [
            state.databaseLoading ? h('div', { class: 'lwcs-tvm-state' }, '正在读取资料…') : null,
            !state.databaseLoading && state.databaseKeys.length === 0 ? h('div', { class: 'lwcs-tvm-state' }, '当前聊天暂时没有可显示的剧情资料。') : null,
            ...state.databaseKeys.map((key, index) => h('button', {
              key,
              type: 'button',
              'aria-pressed': String(state.databaseSelectedKey === key),
              class: state.databaseSelectedKey === key ? 'is-selected' : '',
              onClick: () => selectDatabaseKey(key),
            }, '剧情资料 ' + (index + 1))),
          ]),
          h('div', { class: 'lwcs-tvm-value-view' }, [
            h('div', { class: 'lwcs-tvm-value-title' }, selectedIndex >= 0 ? '剧情资料 ' + (selectedIndex + 1) : '选择一项查看内容'),
            state.databaseValueLoading ? h('div', { class: 'lwcs-tvm-state' }, '读取中…') : null,
            !state.databaseValueLoading && state.databaseSelectedKey
              ? h('pre', { tabindex: '0' }, JSON.stringify(state.databaseSelectedValue, null, 2) ?? '（无内容）')
              : null,
          ]),
        ]),
        ]);
      };
    },
  });

  const DiagnosticsPage = defineComponent({
    name: 'LwcsTvmDiagnosticsPage',
    setup() {
      return () => {
        const checks = [
          ['变量', state.mvuLoading || state.mvuSaving ? '处理中' : state.mvuError ? '需要重试' : '正常'],
          ['楼层记录', state.floorListLoading || state.floorDetailLoading ? '读取中' : state.floorError ? '需要重试' : '正常'],
          ['剧情资料', state.databaseLoading || state.databaseValueLoading ? '读取中' : state.databaseError ? '需要重试' : '正常'],
          ['当前聊天', state.baselineChatId ? '已识别' : '等待载入'],
        ];
        return h('section', { class: 'lwcs-tvm-page', 'aria-labelledby': 'lwcs-tvm-diag-title' }, [
        h('div', { class: 'lwcs-tvm-page-heading' }, [
          h('div', null, [
            h('h2', { id: 'lwcs-tvm-diag-title' }, '运行检查'),
            h('p', null, '查看变量、楼层记录和剧情资料是否可以正常使用。'),
          ]),
          h('button', { type: 'button', disabled: state.diagnosticLoading, onClick: refreshDiagnostics }, state.diagnosticLoading ? '检查中…' : '重新检查'),
        ]),
        state.diagnosticError ? h('div', { class: 'lwcs-tvm-alert lwcs-tvm-alert-error', role: 'alert' }, '运行检查暂时无法完成，请稍后重试。') : null,
        h('div', { class: 'lwcs-tvm-diagnostic-grid' }, checks.map(([title, value]) => h('article', { class: 'lwcs-tvm-diagnostic-card', key: title }, [
          h('h3', null, title),
          h('p', { class: value === '需要重试' ? 'lwcs-tvm-message is-error' : 'lwcs-tvm-message' }, value),
        ]))),
        ]);
      };
    },
  });

  const Root = defineComponent({
    name: 'LwcsTvmRoot',
    setup() {
      const tabs = [
        { id: 'mvu', label: '变量', detail: '查看和修改当前变量' },
        { id: 'floors', label: '楼层记录', detail: '查看过去楼层的变量' },
        { id: 'database', label: '剧情资料', detail: '查看数据库内容' },
        { id: 'diagnostics', label: '运行检查', detail: '查看各项功能是否正常' },
      ];
      watch(() => state.activeTab, async tab => {
        invalidateFloorReads(false);
        if (tab === 'floors') await refreshFloorList();
        if (tab === 'database') await refreshDatabase();
        if (tab === 'diagnostics') await refreshDiagnostics();
      });
      return () => state.visible ? h('div', {
        class: 'lwcs-tvm-overlay',
        role: 'presentation',
        onMousedown: event => { if (event.target === event.currentTarget) closeManager(); },
      }, [
        h('section', {
          class: 'lwcs-tvm-shell',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-labelledby': 'lwcs-tvm-title',
          'aria-busy': String(state.mvuSaving || state.mvuLoading || state.databaseLoading || state.diagnosticLoading),
        }, [
          h('header', { class: 'lwcs-tvm-header' }, [
            h('div', { class: 'lwcs-tvm-title-group' }, [
              h('h1', { id: 'lwcs-tvm-title' }, '变量管理器'),
              h('span', { class: 'lwcs-tvm-context' }, '变量与剧情资料'),
            ]),
            h('div', { class: 'lwcs-tvm-header-status', 'aria-live': 'polite' }, [
              h('span', { class: `lwcs-tvm-badge ${isDirty.value ? 'is-dirty' : ''}` }, saveStatusText.value),
              h('button', { class: 'lwcs-tvm-close', type: 'button', 'aria-label': '关闭变量管理器', onClick: closeManager }, '×'),
            ]),
          ]),
          h('div', { class: 'lwcs-tvm-workspace' }, [
            h('nav', { class: 'lwcs-tvm-nav', 'aria-label': '变量管理器页面' }, tabs.map(tab => h('button', {
              key: tab.id,
              type: 'button',
              class: state.activeTab === tab.id ? 'is-active' : '',
              'aria-current': state.activeTab === tab.id ? 'page' : undefined,
              onClick: () => { state.activeTab = tab.id; },
            }, [h('strong', null, tab.label), h('span', null, tab.detail)]))),
            h('main', { class: 'lwcs-tvm-main' }, [
              state.activeTab === 'mvu' ? h(MvuPage) : null,
              state.activeTab === 'floors' ? h(FloorPage) : null,
              state.activeTab === 'database' ? h(DatabasePage) : null,
              state.activeTab === 'diagnostics' ? h(DiagnosticsPage) : null,
            ]),
          ]),
        ]),
      ]) : null;
    },
  });

  function injectStyle() {
    styleElement = hostWindow.document.getElementById(STYLE_ID);
    if (styleElement) styleElement.remove();
    styleElement = hostWindow.document.createElement('style');
    styleElement.id = STYLE_ID;
    styleElement.textContent = [
'.lwcs-tvm-overlay,.lwcs-tvm-overlay *{box-sizing:border-box}',
'.lwcs-tvm-overlay{--bg:#141516;--panel:#1b1d1f;--panel2:#222426;--line:#34373a;--soft:#282a2c;--text:#ece9e4;--muted:#9c9994;--orange:#f39a32;--cyan:#56d8d0;--danger:#ff838d;position:fixed;inset:0;z-index:2147482000;display:grid;place-items:center;padding:12px;color:var(--text);background:rgba(5,6,7,.8);color-scheme:dark;font:13px/1.35 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;overscroll-behavior:contain}',
'.lwcs-tvm-shell{width:min(1240px,100%);height:min(820px,calc(100dvh - 24px));min-height:420px;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--line);border-radius:4px;background:var(--bg);box-shadow:0 18px 58px rgba(0,0,0,.5)}',
'.lwcs-tvm-header{height:48px;min-height:48px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 6px 0 14px;border-bottom:1px solid var(--line);background:#1b1d1e}',
'.lwcs-tvm-title-group,.lwcs-tvm-header-status,.lwcs-tvm-actions,.lwcs-tvm-context{display:flex;align-items:center;gap:8px;min-width:0}.lwcs-tvm-title-group h1{margin:0;font-size:15px}.lwcs-tvm-title-group .lwcs-tvm-context{color:var(--muted);font-size:11px}',
'.lwcs-tvm-badge{display:inline-flex;align-items:center;min-height:24px;padding:2px 7px;border:1px solid var(--line);border-radius:2px;color:var(--muted);background:#171819;font:11px/1.2 ui-monospace,Consolas,monospace;white-space:nowrap}.lwcs-tvm-badge.is-dirty,.lwcs-tvm-badge[data-state="draft"],.lwcs-tvm-badge[data-state="editing"]{color:#ffc47a;border-color:rgba(243,154,50,.5)}.lwcs-tvm-badge[data-state="conflict"],.lwcs-tvm-badge[data-state="error"]{color:#ffc4ca;border-color:rgba(255,131,141,.55)}',
'.lwcs-tvm-overlay button,.lwcs-tvm-overlay input,.lwcs-tvm-overlay textarea,.lwcs-tvm-overlay select{font:inherit;color:inherit}.lwcs-tvm-overlay button{min-height:40px;padding:6px 10px;border:1px solid var(--line);border-radius:3px;background:var(--panel2);cursor:pointer;touch-action:manipulation}.lwcs-tvm-overlay button:hover{border-color:#5a5d60;background:#292b2d}.lwcs-tvm-overlay button:disabled{opacity:.44;cursor:not-allowed}.lwcs-tvm-overlay button:focus-visible,.lwcs-tvm-overlay input:focus-visible,.lwcs-tvm-overlay textarea:focus-visible,.lwcs-tvm-overlay select:focus-visible,.lwcs-tvm-row:focus-visible{outline:2px solid var(--orange);outline-offset:-2px}.lwcs-tvm-primary{color:#21160b;border-color:var(--orange);background:var(--orange);font-weight:750}.lwcs-tvm-close,.lwcs-tvm-icon-button{width:44px;min-width:44px;padding:0;background:transparent;font-size:21px}',
'.lwcs-tvm-workspace{min-height:0;flex:1;display:grid;grid-template-rows:42px minmax(0,1fr)}.lwcs-tvm-nav{display:flex;align-items:stretch;padding:0 10px;border-bottom:1px solid var(--line);background:#18191a}.lwcs-tvm-nav button{position:relative;min-height:42px;padding:4px 16px;border:0;border-radius:0;background:transparent}.lwcs-tvm-nav button span{display:none}.lwcs-tvm-nav button.is-active{color:#fff1df}.lwcs-tvm-nav button.is-active:after{content:"";position:absolute;inset:auto 10px 0;height:2px;background:var(--orange)}',
'.lwcs-tvm-main{min-width:0;min-height:0;overflow:hidden}.lwcs-tvm-page{height:100%;padding:12px 14px;overflow:auto}.lwcs-tvm-mvu-page{height:100%;min-height:0;display:grid;grid-template-rows:auto auto auto minmax(0,1fr) auto;overflow:hidden}.lwcs-tvm-status-stack{min-height:0;overflow:auto}',
'.lwcs-tvm-context-bar{display:grid;grid-template-columns:minmax(260px,auto) minmax(220px,1fr) auto;align-items:center;gap:8px;padding:8px 10px;border-bottom:2px solid var(--orange);background:#1a1c1d}.lwcs-tvm-context{flex-wrap:wrap}.lwcs-tvm-context strong{font-size:12px}.lwcs-tvm-search{min-width:0}.lwcs-tvm-search input{width:100%;height:36px;padding:6px 9px;border:1px solid var(--line);border-radius:2px;background:#111213}.lwcs-tvm-tree-tools{display:flex;gap:5px}.lwcs-tvm-tree-tools button{min-height:36px;padding:4px 8px;font-size:12px}',
'.lwcs-tvm-message{margin:0;padding:6px 10px;border-bottom:1px solid var(--soft);color:#dccdbb;background:#211e19;overflow-wrap:anywhere}.lwcs-tvm-message.is-error{color:#ffd0d5;background:#24191b}',
'.lwcs-tvm-grid-head,.lwcs-tvm-row{display:grid;grid-template-columns:minmax(180px,30%) 86px minmax(220px,1fr) 150px;align-items:center}.lwcs-tvm-grid-head{height:29px;padding:0 8px;border-bottom:1px solid var(--line);color:#85827e;background:#171819;font-size:10px;text-transform:uppercase;letter-spacing:.06em}.lwcs-tvm-tree-viewport{min-height:0;overflow:auto;background:#151617;scrollbar-gutter:stable}.lwcs-tvm-row{height:32px;padding:0 8px;border-bottom:1px solid #242628;background:#171819;outline:none}.lwcs-tvm-row:nth-child(even){background:#191a1b}.lwcs-tvm-row:hover,.lwcs-tvm-row:focus{background:#222426}.lwcs-tvm-row.is-draft{box-shadow:inset 2px 0 var(--orange)}.lwcs-tvm-row.is-verified{background:#18231e}',
'.lwcs-tvm-cell-key{min-width:0;height:100%;display:flex;align-items:center;padding-left:calc(var(--lwcs-tvm-depth) * 14px);background-image:repeating-linear-gradient(90deg,transparent 0,transparent 13px,rgba(255,255,255,.055) 13px,rgba(255,255,255,.055) 14px);background-size:calc(var(--lwcs-tvm-depth) * 14px) 100%;background-repeat:no-repeat}.lwcs-tvm-disclosure{width:28px;min-width:28px;min-height:28px;padding:0;border:0;background:transparent;color:var(--orange)}.lwcs-tvm-scalar-space{width:28px;min-width:28px}.lwcs-tvm-key-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 12px/1.2 ui-monospace,Consolas,monospace}.lwcs-tvm-type{color:#777a7c;font:10px/1 ui-monospace,Consolas,monospace}.lwcs-tvm-value-wrap{min-width:0;overflow:hidden}.lwcs-tvm-cell-value,.lwcs-tvm-old,.lwcs-tvm-new{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:12px/1.25 ui-monospace,Consolas,monospace}.lwcs-tvm-diff{min-width:0;display:grid;grid-template-columns:minmax(0,1fr) 18px minmax(0,1fr);align-items:center}.lwcs-tvm-old{color:#777;text-decoration:line-through}.lwcs-tvm-arrow{text-align:center;color:#806947}.lwcs-tvm-new{color:#ffc16b}.lwcs-tvm-breadcrumb-value{min-width:0;min-height:28px;padding:2px 5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left;border:0;background:transparent;color:#9b9690}',
'.lwcs-tvm-row-actions{display:flex;justify-content:flex-end;gap:3px}.lwcs-tvm-row-action{min-height:26px;padding:2px 6px;opacity:0;border-color:transparent;background:transparent;font-size:10px}.lwcs-tvm-row:hover .lwcs-tvm-row-action,.lwcs-tvm-row:focus-within .lwcs-tvm-row-action,.lwcs-tvm-row-action.lwcs-tvm-undo{opacity:1}.lwcs-tvm-undo{color:#ffc16b}.lwcs-tvm-inline-editor{display:flex;align-items:center;gap:4px}.lwcs-tvm-inline-input{min-width:0;width:100%;height:27px;padding:3px 6px;border:1px solid var(--orange);background:#101112}.lwcs-tvm-inline-editor button{min-height:27px;padding:2px 6px;font-size:10px}',
'.lwcs-tvm-draft-bar{min-height:54px;display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:8px;padding:7px 10px;border-top:1px solid var(--line);background:#1b1d1e}.lwcs-tvm-draft-bar div{display:flex;flex-direction:column;min-width:0}.lwcs-tvm-draft-bar span{color:var(--muted);font-size:11px}.lwcs-tvm-save{min-width:138px}.lwcs-tvm-empty{padding:28px;color:var(--muted);text-align:center}',
'.lwcs-tvm-floor-page{height:100%;min-height:0;display:grid;grid-template-rows:auto auto minmax(0,1fr);overflow:hidden}.lwcs-tvm-floor-toolbar{min-height:48px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 10px;border-bottom:2px solid var(--orange);background:#1a1c1d}.lwcs-tvm-floor-toolbar div{display:flex;flex-direction:column;min-width:0}.lwcs-tvm-floor-toolbar span{color:var(--muted);font-size:11px}.lwcs-tvm-floor-status{min-height:0}.lwcs-tvm-floor-workspace{min-height:0;display:grid;grid-template-columns:280px minmax(0,1fr)}.lwcs-tvm-floor-list-pane{min-height:0;border-right:1px solid var(--line);background:#171819}.lwcs-tvm-floor-list{height:100%;overflow:auto}.lwcs-tvm-floor-item{width:100%;height:56px;display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;gap:2px 7px;padding:6px 9px;border:0;border-bottom:1px solid var(--soft);border-radius:0;text-align:left;background:transparent}.lwcs-tvm-floor-item.is-selected{box-shadow:inset 3px 0 var(--orange);background:#24211d}.lwcs-tvm-floor-number{font-weight:700}.lwcs-tvm-floor-role{color:var(--muted);font-size:10px;text-align:right}.lwcs-tvm-floor-summary{grid-column:1/-1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c5c0ba}.lwcs-tvm-floor-detail{min-width:0;min-height:0;overflow:hidden}.lwcs-tvm-floor-detail-inner{height:100%;min-height:0;display:grid;grid-template-rows:auto auto auto minmax(0,1fr)}.lwcs-tvm-floor-detail-head{min-height:52px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px;border-bottom:1px solid var(--line)}.lwcs-tvm-floor-detail-head>div{display:flex;flex-direction:column;min-width:0}.lwcs-tvm-floor-detail-head span{color:var(--muted);font-size:11px}.lwcs-tvm-floor-detail-head .lwcs-tvm-inherited{color:#ffc16b}.lwcs-tvm-floor-tree-tools{display:flex;align-items:center;gap:7px;padding:6px 9px;border-bottom:1px solid var(--line)}.lwcs-tvm-floor-search-state{color:var(--muted);font-size:11px;white-space:nowrap}.lwcs-tvm-floor-none{padding:24px}.lwcs-tvm-floor-none p{color:var(--muted)}',
'.lwcs-tvm-mobile-crumbs{display:flex;gap:2px;overflow:auto;padding:5px 8px;border-bottom:1px solid var(--line);background:#18191a}.lwcs-tvm-mobile-crumbs button{min-height:34px;padding:3px 8px;white-space:nowrap;background:transparent}.lwcs-tvm-mobile-crumbs button:after{content:"›";margin-left:8px;color:#6d6964}.lwcs-tvm-mobile-crumbs button.is-current{color:#ffc16b}.lwcs-tvm-mobile-crumbs button.is-current:after{content:""}',
'.lwcs-tvm-sheet-backdrop{position:fixed;inset:0;z-index:3;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.58)}.lwcs-tvm-detail-sheet{width:min(720px,100%);max-height:min(82dvh,var(--lwcs-tvm-visual-height,82dvh));display:grid;grid-template-rows:auto minmax(0,1fr) auto;border:1px solid var(--line);border-bottom:0;background:#1a1c1d;animation:lwcs-tvm-sheet-in .2s ease-out}.lwcs-tvm-detail-sheet header,.lwcs-tvm-detail-sheet footer{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 12px;border-bottom:1px solid var(--line)}.lwcs-tvm-detail-sheet footer{justify-content:flex-end;border-top:1px solid var(--line);border-bottom:0;padding-bottom:calc(9px + env(safe-area-inset-bottom))}.lwcs-tvm-detail-sheet h3,.lwcs-tvm-detail-sheet p{margin:0}.lwcs-tvm-detail-sheet p{max-width:560px;color:var(--muted);overflow-wrap:anywhere}.lwcs-tvm-kicker{color:#8d8984;font:10px/1 monospace}.lwcs-tvm-detail-body{min-height:0;display:flex;flex-direction:column;gap:8px;overflow:auto;padding:12px}.lwcs-tvm-detail-body select{width:140px;height:40px;padding:6px;border:1px solid var(--line);background:#111213}.lwcs-tvm-detail-input{width:100%;min-height:180px;resize:vertical;padding:9px;border:1px solid var(--line);background:#111213;font:12px/1.45 ui-monospace,Consolas,monospace;overflow-wrap:anywhere}.lwcs-tvm-boolean-toggle{min-height:48px;color:#ffc16b}.lwcs-tvm-original-block{min-width:0;color:var(--muted)}.lwcs-tvm-original-block pre{max-height:180px;margin:5px 0 0;padding:8px;overflow:auto;border:1px solid var(--soft);background:#121314;color:#aaa;white-space:pre-wrap;overflow-wrap:anywhere}',
'.lwcs-tvm-page-heading{display:flex;justify-content:space-between;gap:12px;margin-bottom:9px;padding-bottom:9px;border-bottom:1px solid var(--soft)}.lwcs-tvm-page-heading h2{margin:0;font-size:16px}.lwcs-tvm-page-heading p{margin:2px 0;color:var(--muted)}.lwcs-tvm-alert,.lwcs-tvm-field-error{margin:7px 0;padding:7px 9px;border-left:2px solid var(--orange);background:#211e19;overflow-wrap:anywhere}.lwcs-tvm-alert-error,.lwcs-tvm-field-error{border-color:var(--danger);color:#ffd0d5}.lwcs-tvm-state{padding:18px;color:var(--muted)}',
'.lwcs-tvm-db-layout{min-height:400px;display:grid;grid-template-columns:minmax(190px,28%) minmax(0,1fr);border:1px solid var(--line)}.lwcs-tvm-key-list{overflow:auto;padding:5px;border-right:1px solid var(--line)}.lwcs-tvm-key-list button{width:100%;display:block;margin-bottom:3px;text-align:left;overflow-wrap:anywhere}.lwcs-tvm-key-list button.is-selected{border-color:var(--orange)}.lwcs-tvm-value-view{min-width:0;overflow:auto;padding:9px}.lwcs-tvm-value-view pre,.lwcs-tvm-diagnostic-card pre{margin:0;padding:8px;overflow:auto;border:1px solid var(--soft);background:#111213;white-space:pre-wrap;overflow-wrap:anywhere}.lwcs-tvm-diagnostic-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.lwcs-tvm-diagnostic-card{min-width:0;padding:8px;border:1px solid var(--line);background:var(--panel)}.lwcs-tvm-diagnostic-card h3{margin:0 0 6px}.lwcs-tvm-diagnostic-errors{margin-top:8px}.lwcs-tvm-diagnostic-errors summary{min-height:40px;padding:6px;cursor:pointer}.lwcs-tvm-sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}',
'@keyframes lwcs-tvm-sheet-in{from{transform:translateY(18px);opacity:.7}to{transform:none;opacity:1}}',
'@media(max-width:899px){.lwcs-tvm-overlay{padding:0}.lwcs-tvm-shell{width:100%;height:100dvh;border-radius:0;border-inline:0}.lwcs-tvm-context-bar{grid-template-columns:minmax(180px,1fr) minmax(180px,1fr);}.lwcs-tvm-tree-tools{grid-column:1/-1}.lwcs-tvm-grid-head,.lwcs-tvm-row{grid-template-columns:minmax(140px,30%) 64px minmax(160px,1fr) 118px}.lwcs-tvm-floor-workspace{grid-template-columns:240px minmax(0,1fr)}.lwcs-tvm-page{padding:10px}.lwcs-tvm-header-status .lwcs-tvm-badge:nth-child(2){display:none}}',
'@media(max-width:599px){.lwcs-tvm-header{height:48px;min-height:48px;padding-left:10px}.lwcs-tvm-title-group{min-width:0;overflow:hidden}.lwcs-tvm-title-group h1{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lwcs-tvm-title-group .lwcs-tvm-context,.lwcs-tvm-header-status .lwcs-tvm-badge{display:none}.lwcs-tvm-header-status{display:flex;flex:0 0 44px}.lwcs-tvm-close{display:block}.lwcs-tvm-workspace{grid-template-rows:44px minmax(0,1fr)}.lwcs-tvm-nav{padding:0}.lwcs-tvm-nav button{flex:1;min-height:44px;padding:4px}.lwcs-tvm-main{overflow:hidden}.lwcs-tvm-context-bar{grid-template-columns:1fr;padding:7px 8px}.lwcs-tvm-context{overflow:auto;flex-wrap:nowrap}.lwcs-tvm-tree-tools{display:grid;grid-template-columns:repeat(3,1fr)}.lwcs-tvm-tree-tools button{min-height:44px}.lwcs-tvm-grid-head{display:none}.lwcs-tvm-tree-viewport{padding-bottom:0}.lwcs-tvm-row{height:auto;min-height:48px;grid-template-columns:minmax(90px,34%) 48px minmax(0,1fr);padding:0 7px}.lwcs-tvm-row.is-readonly{height:48px;min-height:48px;max-height:48px;overflow:hidden}.lwcs-tvm-row-actions{display:none}.lwcs-tvm-cell-key{padding-left:0;background:none}.lwcs-tvm-disclosure{width:44px;min-width:44px;min-height:44px}.lwcs-tvm-scalar-space{display:none}.lwcs-tvm-cell-value,.lwcs-tvm-old,.lwcs-tvm-new{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}.lwcs-tvm-row.is-readonly .lwcs-tvm-cell-value{line-height:16px;max-height:32px}.lwcs-tvm-breadcrumb-value{min-height:44px}.lwcs-tvm-draft-bar{grid-template-columns:1fr auto;padding-bottom:calc(7px + env(safe-area-inset-bottom));background:#1a1c1d}.lwcs-tvm-draft-bar div{grid-column:1/-1}.lwcs-tvm-save{min-width:0}.lwcs-tvm-floor-toolbar span{display:none}.lwcs-tvm-floor-workspace{display:block}.lwcs-tvm-floor-list-pane,.lwcs-tvm-floor-detail{height:100%}.lwcs-tvm-floor-list-pane{border-right:0}.lwcs-tvm-floor-page.is-mobile-detail .lwcs-tvm-floor-list-pane{display:none}.lwcs-tvm-floor-page:not(.is-mobile-detail) .lwcs-tvm-floor-detail{display:none}.lwcs-tvm-floor-detail-head{align-items:flex-start;flex-wrap:wrap}.lwcs-tvm-floor-detail-head>div{flex:1}.lwcs-tvm-floor-tree-tools{flex-wrap:wrap}.lwcs-tvm-floor-tree-tools .lwcs-tvm-search{flex:1 1 100%}.lwcs-tvm-floor-detail-inner{grid-template-rows:auto auto minmax(0,1fr)}.lwcs-tvm-floor-detail-inner>.lwcs-tvm-grid-head{display:none}.lwcs-tvm-diagnostic-grid{grid-template-columns:1fr}.lwcs-tvm-db-layout{grid-template-columns:1fr;grid-template-rows:minmax(150px,34%) minmax(200px,1fr)}.lwcs-tvm-key-list{border-right:0;border-bottom:1px solid var(--line)}}',
'@media(prefers-reduced-motion:reduce){.lwcs-tvm-overlay *{scroll-behavior:auto;transition:none;animation:none}}'
].join('\n');
    hostWindow.document.head.appendChild(styleElement);
  }

  function mount() {
    if (app || destroyed) return;
    const existingRoot = hostWindow.document.getElementById(ROOT_ID);
    if (existingRoot) existingRoot.remove();
    injectStyle();
    rootElement = hostWindow.document.createElement('div');
    rootElement.id = ROOT_ID;
    hostWindow.document.body.appendChild(rootElement);
    app = createApp(Root);
    app.mount(rootElement);
  }

  function destroyManager() {
    if (destroyed) return;
    closeManager();
    destroyed = true;
    hostWindow.clearTimeout(searchTimer);
    hostWindow.clearTimeout(verifiedTimer);
    hostWindow.clearTimeout(floorSearchTimer);
    searchGeneration += 1;
    invalidateFloorReads(true);
    floorCache.clear();
    searchTimer = 0;
    verifiedTimer = 0;
    hostWindow.document.documentElement.style.removeProperty('--lwcs-tvm-visual-height');
    if (app) app.unmount();
    app = null;
    rootElement?.remove();
    styleElement?.remove();
    databaseSession = null;
    state.databaseBackend = '';
    state.databaseStableChatId = '';
    state.databaseCapabilities = null;
    state.databaseKeys = [];
    state.databaseSelectedKey = '';
    state.databaseSelectedValue = undefined;
    rootElement = null;
    styleElement = null;
    if (hostWindow[API_KEY] === publicApi) delete hostWindow[API_KEY];
  }

  const publicApi = Object.freeze({
    async open() { mount(); await openManager(); },
    close() { closeManager(); },
    destroy() { destroyManager(); },
    async refresh() { return refreshActive(); },
    getStatus() {
      return Object.freeze({
        mounted: !!app,
        open: state.visible,
        destroyed,
        activeTab: state.activeTab,
        mvu: Object.freeze({
          loading: state.mvuLoading,
          saving: state.mvuSaving,
          dirty: isDirty.value,
          state: state.saveState,
          draftCount: draftList.value.length,
          backend: backendLabel.value,
          revision: revisionLabel.value,
          error: state.mvuError || null,
        }),
        database: Object.freeze({
          loading: state.databaseLoading,
          backend: state.databaseBackend || null,
          stableChatId: state.databaseStableChatId || null,
          keyCount: state.databaseKeys.length,
          error: state.databaseError || null,
        }),
        floors: Object.freeze({
          loading: state.floorListLoading || state.floorDetailLoading,
          count: state.floorMessages.length,
          selectedIndex: state.floorSelectedIndex,
          cacheSize: floorCache.size,
          error: state.floorError || null,
        }),
      });
    },
  });

  hostWindow[API_KEY] = publicApi;
})(typeof globalThis !== 'undefined' ? globalThis : window);

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
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(value);
      } catch (_) {
        // TT-store may return cross-realm or Vue proxy objects. Persisted MVU data is JSON-safe.
      }
    }
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
    floorPath: [],
    databasePath: [],
    draftsOpen: false,
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
    if (state.mvuLoading) return '正在读取';
    if (state.mvuSaving) return '正在保存';
    if (!state.snapshot) return state.mvuError ? '读取失败' : '尚未读取';
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

  function readHotMvu(mvu) {
    if (typeof mvu?.getMvuData !== 'function') throw new Error('Mvu.getMvuData 同步热读不可用');
    const data = mvu.getMvuData({ type: 'chat' });
    if (!data || typeof data !== 'object') throw new Error('未读取到当前聊天的 MVU 数据');
    return cloneJson(data);
  }

  function readCanonicalHotMvu(mvu) {
    const data = readHotMvu(mvu);
    if (!data.stat_data || typeof data.stat_data !== 'object' || Array.isArray(data.stat_data)
      || Object.keys(data.stat_data).length === 0 || !Object.prototype.hasOwnProperty.call(data, 'schema')) {
      throw new Error('当前聊天尚未形成可读取的 MVU 变量');
    }
    return data;
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
      state.snapshot = null;
      state.baselineChatId = '';
      state.baselineStableChatId = '';
      state.baselineRevision = null;
      state.baselineFingerprint = '';
      state.saveState = 'error';
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
      const chatId = currentChatId();
      if (!chatId) throw new Error('尚未识别当前聊天');
      if (generation !== floorGeneration || state.activeTab !== 'floors') return false;
      const hasCurrentBaseline = state.baselineChatId === chatId;
      const identityChanged = updateFloorIdentity(
        chatId,
        hasCurrentBaseline ? state.baselineStableChatId : '',
        hasCurrentBaseline ? state.baselineRevision : null,
      );
      generation = floorGeneration;
      const currentContext = currentWindow.SillyTavern?.getContext?.();
      const hostContext = hostWindow.SillyTavern?.getContext?.();
      const context = Array.isArray(currentContext?.chat) ? currentContext : hostContext;
      const messages = Array.isArray(context?.chat) ? context.chat : [];
      if (chatId !== currentChatId()) throw new Error('读取楼层列表期间聊天已切换');
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
      const messageReader = [
        [currentWindow.TavernHelper, currentWindow.TavernHelper?.getChatMessages],
        [currentWindow, currentWindow.getChatMessages],
        [hostWindow.TavernHelper, hostWindow.TavernHelper?.getChatMessages],
        [hostWindow, hostWindow.getChatMessages],
      ].find(([, fn]) => typeof fn === 'function');
      if (!messageReader) throw new Error('getChatMessages 不可用');
      const selectedMessages = await messageReader[1].call(messageReader[0], absoluteIndex);
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
          : readHotMvu(hostWindow.Mvu || currentWindow.Mvu);
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

  // ================= 界面 =================
  // 版式：顶部铭牌（标题 / 页签 / 状态 / 关闭）+ 各页工作区。变量页 = 左目录（只列分组）+ 右属性表（字段原地改、子分组成卡片可进入）；
  // 楼层记录与剧情资料用同一套只读属性表浏览。说明文字只放悬停（title）。类名统一 lwcs-tvm- 前缀，样式注入宿主文档也不串。
  const ROOT_CAPTION = { char: '角色', org: '组织', sys: '系统', world: '世界' };
  const TABS = [
    { id: 'mvu', label: '变量', icon: 'sliders', hint: '查看和修改当前聊天的变量' },
    { id: 'floors', label: '楼层记录', icon: 'layer-group', hint: '查看各楼层保存下来的变量（只读）' },
    { id: 'database', label: '剧情资料', icon: 'book-open', hint: '查看数据库里已保存的资料（只读，修改请用数据库编辑器）' },
    { id: 'diagnostics', label: '运行检查', icon: 'stethoscope', hint: '变量、楼层记录与剧情资料是否可以正常使用' },
  ];
  // 一个分组里一次最多列出的字段 / 子分组数，超出用「显示更多」追加
  const SHEET_PAGE = 240;
  const fieldErrors = reactive({});
  const icon = (name, extra = '') => h('i', { class: 'fa-solid fa-' + name + (extra ? ' ' + extra : ''), 'aria-hidden': 'true' });
  const samePrefix = (prefix, path) => prefix.length <= path.length && prefix.every((part, index) => part === path[index]);
  const cssPathKey = key => String(key).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  // 私密档案（char/<名字>/私密档案）：目录里一律不列；属性表与搜索只对女性且年满 18 岁的角色显示，未成年或年龄不明不给入口
  const privateGateOk = (root, name) => {
    const attrs = root?.char?.[name]?.属性 || {};
    const age = Number(attrs.年龄);
    return attrs.性别 === '女' && Number.isFinite(age) && age >= 18;
  };
  const isPrivatePath = path => path.length >= 3 && path[0] === 'char' && path[2] === '私密档案';
  const privateHidden = (root, path, inNavigation = false) => isPrivatePath(path) && (inNavigation || !privateGateOk(root, path[1]));
  function childEntries(container, path, root, inNavigation = false) {
    const isList = Array.isArray(container);
    return Object.entries(container).map(([key, value]) => ({ key, value, path: [...path, isList ? Number(key) : key] }))
      .filter(entry => !privateHidden(root, entry.path, inNavigation));
  }
  // 子分组卡片上的预览：前三个标量字段；没有标量时列前几个子项名
  function previewOf(value) {
    const parts = [];
    // 子项全是分组（角色表、物品表等）时列子项名
    if (!Array.isArray(value) && Object.values(value).every(isContainer)) return Object.keys(value).filter(key => key !== '私密档案').slice(0, 4).join(' · ');
    for (const [key, child] of Object.entries(value)) {
      if (isContainer(child)) continue;
      parts.push(Array.isArray(value) ? compactValue(child) : key + ' ' + compactValue(child));
      if (parts.length >= 3) break;
    }
    return parts.join(' · ');
  }
  // 草稿落在这个分组内或它的上级时，卡片 / 目录标为已改
  const containerChanged = path => draftList.value.some(entry => samePrefix(entry.path, path) || samePrefix(path, entry.path));

  function navigateMvu(path, focusKey = '') {
    state.currentPath = [...path];
    const next = new Set(state.expanded);
    for (let depth = 1; depth <= path.length; depth += 1) next.add(pathKey(path.slice(0, depth)));
    state.expanded = next;
    state.focusPathKey = focusKey || '$';
    if (focusKey) nextTick(() => rootElement?.querySelector('.lwcs-tvm-mvu [data-path-key="' + cssPathKey(focusKey) + '"]')?.scrollIntoView({ block: 'nearest' }));
  }
  function commitField(path, kind, raw) {
    const key = pathKey(path);
    try {
      if (kind === 'number' && !String(raw).trim()) throw new Error('请输入数字');
      setDraft(path, parseEditedValue(kind, raw));
      delete fieldErrors[key];
    } catch (error) {
      fieldErrors[key] = errorText(error);
    }
  }

  // 字段：标签 + 按类型的控件（开关 / 数字 / 短文本 / 长文本）；改过的标琥珀色并给原值与撤销
  function renderField(entry, editable) {
    const { key: name, value, path } = entry;
    const key = pathKey(path);
    const original = editable ? getAtPath(state.snapshot?.stat_data, path) : value;
    const changed = editable && canonicalJson(original) !== canonicalJson(value);
    const kind = valueKind(value);
    const long = kind === 'string' && (value.length > 42 || value.includes('\n'));
    let control;
    if (!editable) {
      control = h('div', { class: ['lwcs-tvm-read', 'is-' + kind], title: compactValue(value) }, compactValue(value));
    } else if (kind === 'boolean') {
      control = h('button', { type: 'button', role: 'switch', class: 'lwcs-tvm-switch', 'aria-checked': String(value), 'aria-label': name, onClick: () => setDraft(path, !value) },
        [h('span', { class: 'lwcs-tvm-knob' }), h('b', null, value ? '开启' : '关闭')]);
    } else if (kind === 'null') {
      control = h('button', { type: 'button', class: 'lwcs-tvm-null', title: '空值：点开按类型填写', onClick: () => openDetail(path, value) }, '空值');
    } else if (long) {
      control = h('textarea', { class: 'lwcs-tvm-input', rows: Math.min(6, Math.max(2, Math.ceil(value.length / 46) + (value.match(/\n/g) || []).length)), value, spellcheck: 'false', 'aria-label': name,
        onChange: event => commitField(path, 'string', event.target.value) });
    } else {
      control = h('input', { class: ['lwcs-tvm-input', kind === 'number' ? 'is-number' : ''], type: kind === 'number' ? 'number' : 'text', step: 'any', value: String(value), 'aria-label': name,
        onChange: event => commitField(path, kind, event.target.value),
        onKeydown: event => { if (event.key === 'Enter') event.target.blur(); } });
    }
    return h('div', { key, class: ['lwcs-tvm-field', long || (!editable && kind === 'string' && value.length > 42) ? 'is-wide' : '', changed ? 'is-changed' : '',
      state.verifiedPaths.has(key) ? 'is-verified' : '', state.focusPathKey === key || state.floorFocusPathKey === key ? 'is-focus' : ''], 'data-path-key': key }, [
      h('div', { class: 'lwcs-tvm-field-head' }, [
        h('span', { class: 'lwcs-tvm-field-name', title: name }, name),
        editable && changed && original !== undefined ? h('button', { type: 'button', class: 'lwcs-tvm-mini', title: '撤销这一项', 'aria-label': '撤销 ' + name, onClick: () => { delete fieldErrors[key]; setDraft(path, cloneJson(original)); } }, icon('rotate-left')) : null,
        editable ? h('button', { type: 'button', class: 'lwcs-tvm-mini', title: '按类型或 JSON 编辑', 'aria-label': '详细编辑 ' + name, onClick: () => openDetail(path, value) }, icon('ellipsis')) : null,
      ]),
      control,
      changed ? h('div', { class: 'lwcs-tvm-was', title: compactValue(original) }, original === undefined ? '新增' : '原值 ' + compactValue(original)) : null,
      fieldErrors[key] ? h('div', { class: 'lwcs-tvm-field-error', role: 'alert' }, fieldErrors[key]) : null,
    ]);
  }

  function renderTile(entry, navigate, editable) {
    const count = Object.keys(entry.value).length;
    const preview = previewOf(entry.value);
    return h('button', { key: pathKey(entry.path), type: 'button', class: ['lwcs-tvm-tile', editable && containerChanged(entry.path) ? 'is-changed' : ''], 'data-path-key': pathKey(entry.path), onClick: () => navigate(entry.path) }, [
      h('span', { class: 'lwcs-tvm-sock' }, icon(Array.isArray(entry.value) ? 'list-ul' : 'folder')),
      h('span', { class: 'lwcs-tvm-tile-body' }, [h('strong', { title: entry.key }, entry.key), h('small', { title: preview }, preview || (count ? (Array.isArray(entry.value) ? '列表' : '分组') : '空'))]),
      h('span', { class: 'lwcs-tvm-count' }, String(count)),
      icon('chevron-right', 'lwcs-tvm-go'),
    ]);
  }

  function renderCrumbs(path, navigate, rootLabel) {
    const crumbs = [{ label: rootLabel, path: [] }, ...path.map((part, index) => ({ label: String(part), path: path.slice(0, index + 1) }))];
    return h('nav', { class: 'lwcs-tvm-crumbs', 'aria-label': '当前位置' }, crumbs.map((crumb, index) => h('button', {
      type: 'button', class: index === crumbs.length - 1 ? 'is-current' : '', 'aria-current': index === crumbs.length - 1 ? 'location' : undefined, onClick: () => navigate(crumb.path),
    }, crumb.label)));
  }

  // 属性表：一个分组的内容 = 字段区 + 子分组卡片区
  const Sheet = defineComponent({
    name: 'LwcsTvmSheet',
    props: { root: { default: undefined }, path: { type: Array, required: true }, editable: { type: Boolean, default: false }, navigate: { type: Function, required: true } },
    setup(props) {
      const limit = Vue.ref(SHEET_PAGE);
      watch(() => pathKey(props.path), () => { limit.value = SHEET_PAGE; });
      return () => {
        const node = getAtPath(props.root, props.path);
        if (!isContainer(node)) return h('div', { class: 'lwcs-tvm-empty' }, '这里没有内容。');
        if (privateHidden(props.root, props.path)) return h('div', { class: 'lwcs-tvm-empty' }, '这里没有内容。');
        const entries = childEntries(node, props.path, props.root);
        const fields = entries.filter(entry => !isContainer(entry.value));
        const groups = entries.filter(entry => isContainer(entry.value));
        const more = Math.max(0, fields.length - limit.value) + Math.max(0, groups.length - limit.value);
        return h('div', { class: 'lwcs-tvm-sheet' }, [
          fields.length ? h('section', { class: 'lwcs-tvm-sec' }, [
            h('h3', { class: 'lwcs-tvm-sec-title' }, [icon('pen-to-square'), '字段', h('em', null, String(fields.length))]),
            h('div', { class: 'lwcs-tvm-fields' }, fields.slice(0, limit.value).map(entry => renderField(entry, props.editable))),
          ]) : null,
          groups.length ? h('section', { class: 'lwcs-tvm-sec' }, [
            h('h3', { class: 'lwcs-tvm-sec-title' }, [icon('folder-tree'), Array.isArray(node) ? '条目' : '分组', h('em', null, String(groups.length))]),
            h('div', { class: 'lwcs-tvm-tiles' }, groups.slice(0, limit.value).map(entry => renderTile(entry, props.navigate, props.editable))),
          ]) : null,
          more ? h('button', { type: 'button', class: 'lwcs-tvm-more', onClick: () => { limit.value += SHEET_PAGE; } }, '显示更多（还有 ' + more + ' 项）') : null,
          entries.length ? null : h('div', { class: 'lwcs-tvm-empty' }, Array.isArray(node) ? '空列表' : '空分组'),
        ]);
      };
    },
  });

  // 属性表上方：返回上一级 + 路径 + 标题（顶层分组带中文副标题）+ 操作
  function renderPaneHead(path, node, navigate, rootLabel, actions = []) {
    const title = path.length ? String(path[path.length - 1]) : rootLabel;
    const caption = path.length === 1 ? ROOT_CAPTION[path[0]] : '';
    return h('div', { class: 'lwcs-tvm-pane-head' }, [
      h('div', { class: 'lwcs-tvm-pane-row' }, [
        path.length ? h('button', { type: 'button', class: 'lwcs-tvm-up', title: '上一级', 'aria-label': '返回上一级', onClick: () => navigate(path.slice(0, -1)) }, icon('arrow-turn-up')) : null,
        renderCrumbs(path, navigate, rootLabel),
      ]),
      h('div', { class: 'lwcs-tvm-pane-row' }, [
        h('h2', { class: 'lwcs-tvm-pane-title', title }, [title, caption ? h('small', null, caption) : null]),
        isContainer(node) ? h('span', { class: 'lwcs-tvm-chip' }, (Array.isArray(node) ? '列表 · ' : '分组 · ') + Object.keys(node).length + ' 项') : null,
        h('div', { class: 'lwcs-tvm-pane-actions' }, actions),
      ]),
    ]);
  }

  function renderSearchResults(results, onPick, emptyText, root) {
    results = results.filter(row => !privateHidden(root, row.path));
    if (!results.length) return h('div', { class: 'lwcs-tvm-empty' }, emptyText);
    return h('div', { class: 'lwcs-tvm-results', role: 'list' }, results.map(row => h('button', {
      key: row.key, type: 'button', role: 'listitem', class: 'lwcs-tvm-result', onClick: () => onPick(row),
    }, [
      h('span', { class: 'lwcs-tvm-sock' }, icon(row.container ? (Array.isArray(row.value) ? 'list-ul' : 'folder') : 'pen-to-square')),
      h('span', { class: 'lwcs-tvm-result-body' }, [
        h('strong', null, row.name),
        h('small', { title: pathLabel(row.path) }, row.path.slice(0, -1).join(' › ') || '顶层'),
      ]),
      h('span', { class: 'lwcs-tvm-result-value', title: compactValue(row.displayValue) }, compactValue(row.displayValue)),
    ])));
  }

  function renderMessages(list) {
    const shown = list.filter(Boolean);
    return shown.length ? h('div', { class: 'lwcs-tvm-messages' }, shown.map(([text, kind]) => h('p', { class: ['lwcs-tvm-message', kind === 'error' ? 'is-error' : ''], role: kind === 'error' ? 'alert' : 'status' }, text))) : null;
  }

  // 变量页左栏目录：只列分组，按 state.expanded 展开；当前所在路径高亮
  const Navigator = defineComponent({
    name: 'LwcsTvmNavigator',
    setup() {
      return () => {
        const rows = [];
        const walk = (container, path, depth) => {
          for (const entry of childEntries(container, path, effectiveStatData.value, true)) {
            if (!isContainer(entry.value) || rows.length >= 800) continue;
            const key = pathKey(entry.path);
            const nested = Object.values(entry.value).some(isContainer);
            const open = nested && state.expanded.has(key);
            rows.push({ ...entry, keyId: key, depth, nested, open });
            if (open) walk(entry.value, entry.path, depth + 1);
          }
        };
        if (state.snapshot) walk(effectiveStatData.value, [], 0);
        const currentKey = pathKey(state.currentPath);
        return h('nav', { class: 'lwcs-tvm-tree', 'aria-label': '变量目录' }, [
          h('button', { type: 'button', class: ['lwcs-tvm-tree-row', 'is-root', state.currentPath.length ? '' : 'is-current'], onClick: () => navigateMvu([]) }, [icon('database'), h('span', null, '全部变量')]),
          ...rows.map(row => h('div', { key: row.keyId, class: ['lwcs-tvm-tree-row', row.keyId === currentKey ? 'is-current' : '', samePrefix(row.path, state.currentPath) && row.keyId !== currentKey ? 'is-trail' : '', containerChanged(row.path) ? 'is-changed' : ''], style: { '--lwcs-tvm-depth': String(row.depth) } }, [
            row.nested ? h('button', { type: 'button', class: 'lwcs-tvm-twist', 'aria-label': (row.open ? '收起 ' : '展开 ') + row.key, 'aria-expanded': String(row.open), onClick: () => {
              const next = new Set(state.expanded);
              if (row.open) next.delete(row.keyId); else next.add(row.keyId);
              state.expanded = next;
            } }, icon(row.open ? 'caret-down' : 'caret-right')) : h('span', { class: 'lwcs-tvm-twist' }),
            h('button', { type: 'button', class: 'lwcs-tvm-tree-name', title: pathLabel(row.path), onClick: () => navigateMvu(row.path) }, [
              h('span', null, row.key), row.depth === 0 && ROOT_CAPTION[row.key] ? h('small', null, ROOT_CAPTION[row.key]) : null,
            ]),
            h('span', { class: 'lwcs-tvm-count' }, String(Object.keys(row.value).length)),
          ])),
        ]);
      };
    },
  });

  function detailSheet() {
    if (!state.detailOpen) return null;
    const original = getAtPath(state.snapshot?.stat_data, state.detailPath);
    return h('div', { class: 'lwcs-tvm-sheet-backdrop', onMousedown: event => { if (event.target === event.currentTarget) closeDetail(); } }, [
      h('section', { class: 'lwcs-tvm-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'lwcs-tvm-detail-title' }, [
        h('header', { class: 'lwcs-tvm-dialog-head' }, [
          h('div', null, [
            h('h3', { id: 'lwcs-tvm-detail-title' }, state.detailPath.length ? String(state.detailPath.at(-1)) : '全部变量'),
            h('p', { title: pathLabel(state.detailPath) }, pathLabel(state.detailPath)),
          ]),
          h('button', { type: 'button', class: 'lwcs-tvm-icon', 'aria-label': '关闭详细编辑', onClick: closeDetail }, icon('xmark')),
        ]),
        h('div', { class: 'lwcs-tvm-dialog-body' }, [
          h('div', { class: 'lwcs-tvm-kinds', role: 'radiogroup', 'aria-label': '值类型' }, [
            ['string', '文本'], ['number', '数字'], ['boolean', '开关'], ['null', '空值'], ['object', '分组'], ['array', '列表'],
          ].map(([kind, label]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(state.detailType === kind), class: state.detailType === kind ? 'is-on' : '', onClick: () => {
            state.detailType = kind;
            if (kind === 'boolean') state.detailText = ['true', 'false'].includes(state.detailText) ? state.detailText : 'false';
            if (kind === 'null') state.detailText = 'null';
          } }, label))),
          state.detailType === 'boolean'
            ? h('button', { type: 'button', role: 'switch', class: 'lwcs-tvm-switch is-large', 'aria-checked': String(state.detailText === 'true'), onClick: () => { state.detailText = state.detailText === 'true' ? 'false' : 'true'; } },
              [h('span', { class: 'lwcs-tvm-knob' }), h('b', null, state.detailText === 'true' ? '开启' : '关闭')])
            : state.detailType === 'null'
              ? h('div', { class: 'lwcs-tvm-empty' }, '空值')
              : h('textarea', { class: 'lwcs-tvm-detail-input', rows: 12, value: state.detailText, spellcheck: 'false', 'aria-label': '编辑值', onInput: event => { state.detailText = event.target.value; } }),
          h('details', { class: 'lwcs-tvm-original' }, [h('summary', null, '保存前的值'), h('pre', null, isContainer(original) ? JSON.stringify(original, null, 2) : compactValue(original))]),
          state.detailError ? h('p', { class: 'lwcs-tvm-message is-error', role: 'alert' }, state.detailError) : null,
        ]),
        h('footer', { class: 'lwcs-tvm-dialog-foot' }, [
          h('button', { type: 'button', class: 'lwcs-tvm-btn', onClick: () => {
            state.detailType = valueKind(original);
            state.detailText = isContainer(original) ? JSON.stringify(original, null, 2) : original === null ? 'null' : String(original);
          } }, [icon('rotate-left'), '恢复原值']),
          h('button', { type: 'button', class: 'lwcs-tvm-btn', onClick: closeDetail }, '取消'),
          h('button', { type: 'button', class: 'lwcs-tvm-btn is-primary', onClick: commitDetail }, [icon('check'), '加入待保存']),
        ]),
      ]),
    ]);
  }

  const MvuPage = defineComponent({
    name: 'LwcsTvmMvuPage',
    setup() {
      return () => {
        const data = effectiveStatData.value;
        const node = getAtPath(data, state.currentPath);
        const searching = !!state.searchQuery;
        return h('section', { class: 'lwcs-tvm-mvu' }, [
          h('div', { class: 'lwcs-tvm-toolbar' }, [
            h('label', { class: 'lwcs-tvm-search' }, [icon('magnifying-glass'), h('span', { class: 'lwcs-tvm-sr-only' }, '搜索变量'), h('input', {
              type: 'search', value: state.searchInput, placeholder: '搜索名称或内容', title: 'Ctrl+P',
              onInput: event => { state.searchInput = event.target.value; scheduleSearch(); },
            })]),
            h('button', { type: 'button', class: 'lwcs-tvm-btn', disabled: state.mvuLoading || state.mvuSaving, title: '重新读取当前聊天的变量（有未保存修改时不会覆盖）', onClick: () => refreshMvu() }, [icon('arrows-rotate'), isMobile.value ? null : '重新读取']),
          ]),
          renderMessages([
            state.editingError && [state.editingError, 'error'],
            state.mvuError && [state.saveState === 'conflict' ? '检测到其他更新，当前修改尚未保存。请保留修改并重试。' : '操作没有完成：' + state.mvuError, 'error'],
            state.mvuNotice && [state.mvuNotice],
            state.searchBusy && ['正在检索…'],
            state.searchCapped && ['仅显示前 150 条匹配结果。'],
          ]),
          h('div', { class: 'lwcs-tvm-split' }, [
            isMobile.value ? null : h('aside', { class: 'lwcs-tvm-aside' }, [h(Navigator)]),
            h('main', { class: 'lwcs-tvm-pane' }, searching
              ? [h('div', { class: 'lwcs-tvm-pane-head' }, [h('div', { class: 'lwcs-tvm-pane-row' }, [h('h2', { class: 'lwcs-tvm-pane-title' }, ['搜索结果', h('small', null, state.searchInput.trim())]), h('span', { class: 'lwcs-tvm-chip' }, state.searchResults.length + ' 项')])]),
                h('div', { class: 'lwcs-tvm-scroll' }, [renderSearchResults(state.searchResults, row => {
                  state.searchInput = ''; state.searchQuery = ''; state.searchResults = [];
                  if (row.container) navigateMvu(row.path); else navigateMvu(row.path.slice(0, -1), row.key);
                }, state.searchBusy ? '' : '没有找到匹配的变量。', data)])]
              : !state.snapshot
                ? [h('div', { class: 'lwcs-tvm-empty is-big' }, state.mvuLoading ? '正在读取变量…' : [h('p', null, '当前聊天暂时没有可显示的变量。'), h('button', { type: 'button', class: 'lwcs-tvm-btn', onClick: () => refreshMvu() }, [icon('arrows-rotate'), '重新读取'])])]
                : [
                  renderPaneHead(state.currentPath, node, path => navigateMvu(path), '全部变量', [
                    h('button', { type: 'button', class: 'lwcs-tvm-btn', title: '把这个分组按 JSON 整体编辑', onClick: () => openDetail(state.currentPath, node) }, [icon('code'), isMobile.value ? null : 'JSON']),
                    h('button', { type: 'button', class: 'lwcs-tvm-btn', title: '复制路径：' + pathLabel(state.currentPath), onClick: () => hostWindow.navigator?.clipboard?.writeText(pathLabel(state.currentPath)) }, [icon('copy'), isMobile.value ? null : '复制路径']),
                  ]),
                  h('div', { class: 'lwcs-tvm-scroll' }, [h(Sheet, { root: data, path: state.currentPath, editable: true, navigate: path => navigateMvu(path) })]),
                ]),
          ]),
          state.draftsOpen && isDirty.value ? h('div', { class: 'lwcs-tvm-drafts', role: 'list', 'aria-label': '待保存的修改' }, draftList.value.map(entry => h('div', { key: pathKey(entry.path), class: 'lwcs-tvm-draft', role: 'listitem' }, [
            h('button', { type: 'button', class: 'lwcs-tvm-draft-path', title: '定位到这一项', onClick: () => navigateMvu(isContainer(entry.nextValue) ? entry.path : entry.path.slice(0, -1), isContainer(entry.nextValue) ? '' : pathKey(entry.path)) }, entry.path.join(' › ')),
            h('span', { class: 'lwcs-tvm-draft-old', title: compactValue(entry.original) }, compactValue(entry.original)),
            icon('arrow-right', 'lwcs-tvm-draft-arrow'),
            h('span', { class: 'lwcs-tvm-draft-new', title: compactValue(entry.nextValue) }, compactValue(entry.nextValue)),
            h('button', { type: 'button', class: 'lwcs-tvm-mini', title: '撤销这一项', 'aria-label': '撤销 ' + entry.path.join(' › '), onClick: () => discardPath(entry.path) }, icon('rotate-left')),
          ]))) : null,
          h('footer', { class: 'lwcs-tvm-savebar' }, [
            h('button', { type: 'button', class: ['lwcs-tvm-save-state', isDirty.value ? 'is-dirty' : ''], 'data-state': state.saveState, disabled: !isDirty.value, 'aria-expanded': String(!!state.draftsOpen && isDirty.value),
              title: isDirty.value ? '展开 / 收起待保存清单' : '只保存改动的部分，保存后会重新读回确认', onClick: () => { state.draftsOpen = !state.draftsOpen; } }, [
              icon(isDirty.value ? 'pen-ruler' : state.saveState === 'verified' ? 'circle-check' : 'floppy-disk'),
              h('span', null, saveStatusText.value),
              isDirty.value ? icon(state.draftsOpen ? 'chevron-down' : 'chevron-up') : null,
            ]),
            h('button', { type: 'button', class: 'lwcs-tvm-btn is-ghost', disabled: !isDirty.value || state.mvuSaving, onClick: confirmDiscardDraft }, '丢弃全部'),
            h('button', { type: 'button', class: 'lwcs-tvm-btn is-primary lwcs-tvm-save', disabled: !isDirty.value || state.mvuSaving || state.mvuLoading, title: 'Ctrl+S', onClick: saveMvu },
              [icon('floppy-disk'), state.mvuSaving ? '正在保存…' : '保存修改']),
          ]),
          detailSheet(),
        ]);
      };
    },
  });

  const FloorPage = defineComponent({
    name: 'LwcsTvmFloorPage',
    setup() {
      // 楼层列表行高固定 56px（syncFloorListScroll 按此换算），超长聊天只渲染可视区
      const listStart = computed(() => Math.max(0, Math.floor(state.floorListScrollTop / 56) - 6));
      const listEnd = computed(() => Math.min(state.floorMessages.length, listStart.value + Math.ceil(state.floorListHeight / 56) + 12));
      const navigate = path => { state.floorPath = [...path]; state.floorFocusPathKey = '$'; };

      function renderList() {
        const shown = state.floorMessages.slice(listStart.value, listEnd.value);
        return h('div', { class: 'lwcs-tvm-floor-list', 'aria-label': '聊天楼层', onScroll: event => {
          state.floorListScrollTop = event.currentTarget.scrollTop;
          state.floorListHeight = event.currentTarget.clientHeight;
        } }, [
          listStart.value ? h('div', { style: { height: listStart.value * 56 + 'px' }, 'aria-hidden': 'true' }) : null,
          ...shown.map(item => h('button', {
            key: item.absoluteIndex, type: 'button', class: ['lwcs-tvm-floor', 'is-' + (item.role === '玩家' ? 'user' : item.role === '系统' ? 'system' : 'char'), state.floorSelectedIndex === item.absoluteIndex ? 'is-on' : ''],
            'aria-current': state.floorSelectedIndex === item.absoluteIndex ? 'true' : undefined, title: item.summary, onClick: () => selectFloor(item.absoluteIndex),
          }, [
            h('span', { class: 'lwcs-tvm-floor-no' }, '#' + item.absoluteIndex),
            h('span', { class: 'lwcs-tvm-floor-role' }, item.role),
            h('span', { class: 'lwcs-tvm-floor-text' }, item.summary),
          ])),
          listEnd.value < state.floorMessages.length ? h('div', { style: { height: (state.floorMessages.length - listEnd.value) * 56 + 'px' }, 'aria-hidden': 'true' }) : null,
          !state.floorListLoading && !state.floorMessages.length ? h('div', { class: 'lwcs-tvm-empty' }, '当前聊天暂时没有楼层。') : null,
        ]);
      }

      function renderDetail() {
        const back = isMobile.value ? h('button', { type: 'button', class: 'lwcs-tvm-btn', onClick: () => { state.floorMobileDetail = false; } }, [icon('chevron-left'), '楼层']) : null;
        if (state.floorDetailLoading) return h('div', { class: 'lwcs-tvm-empty is-big', role: 'status' }, '正在读取该楼的变量…');
        if (!state.floorDetail) return h('div', { class: 'lwcs-tvm-empty is-big' }, [icon('hand-pointer'), h('p', null, '选择左侧一个楼层')]);
        if (state.floorDetail.status === 'none') {
          return h('div', { class: 'lwcs-tvm-floor-detail' }, [h('div', { class: 'lwcs-tvm-pane-head' }, [h('div', { class: 'lwcs-tvm-pane-row' }, [back, h('h2', { class: 'lwcs-tvm-pane-title' }, '#' + state.floorDetail.pointer.absoluteIndex)])]),
            h('div', { class: 'lwcs-tvm-empty is-big' }, '该楼没有变量记录')]);
        }
        const detail = state.floorDetail;
        const root = detail.hotState?.stat_data;
        const node = getAtPath(root, state.floorPath);
        return h('div', { class: 'lwcs-tvm-floor-detail' }, [
          h('div', { class: 'lwcs-tvm-floor-head' }, [
            back,
            h('strong', { class: 'lwcs-tvm-floor-title' }, '第 ' + detail.pointer.absoluteIndex + ' 楼'),
            h('span', { class: ['lwcs-tvm-chip', detail.inherited ? 'is-amber' : ''], title: detail.inherited ? '这一楼没有新的变量记录，显示的是它之前最近一次的记录' : '这一楼自己的变量记录' },
              detail.inherited ? '沿用 #' + detail.sourceFloor?.absoluteIndex : '本楼记录'),
            h('label', { class: 'lwcs-tvm-search is-small' }, [icon('magnifying-glass'), h('span', { class: 'lwcs-tvm-sr-only' }, '搜索该楼变量'),
              h('input', { type: 'search', value: state.floorSearchInput, placeholder: '搜索该楼', onInput: event => { state.floorSearchInput = event.target.value; scheduleFloorSearch(); } })]),
            h('button', { type: 'button', class: 'lwcs-tvm-btn', title: '去「变量」页编辑当前变量', onClick: () => { state.activeTab = 'mvu'; } }, [icon('pen'), isMobile.value ? null : '编辑当前变量']),
          ]),
          state.floorSearchQuery
            ? h('div', { class: 'lwcs-tvm-scroll' }, [state.floorSearchCapped ? renderMessages([['仅显示前 150 条匹配结果。']]) : null, renderSearchResults(state.floorSearchResults, row => {
              state.floorSearchInput = ''; state.floorSearchQuery = ''; state.floorSearchResults = [];
              state.floorPath = row.container ? [...row.path] : row.path.slice(0, -1);
              state.floorFocusPathKey = row.container ? '$' : row.key;
            }, state.floorSearchBusy ? '正在检索…' : '没有找到匹配的变量。', detail.hotState?.stat_data)])
            : [renderPaneHead(state.floorPath, node, navigate, '该楼变量'), h('div', { class: 'lwcs-tvm-scroll' }, [h(Sheet, { root, path: state.floorPath, editable: false, navigate })])],
        ]);
      }

      return () => h('section', { class: ['lwcs-tvm-floors', state.floorMobileDetail ? 'is-mobile-detail' : ''] }, [
        renderMessages([state.floorError && ['楼层记录暂时无法读取：' + state.floorError, 'error']]),
        h('div', { class: 'lwcs-tvm-split' }, [
          h('aside', { class: 'lwcs-tvm-aside lwcs-tvm-floor-aside' }, [
            h('div', { class: 'lwcs-tvm-aside-head' }, [h('strong', null, '楼层'), h('span', { class: 'lwcs-tvm-count' }, String(state.floorMessages.length)),
              h('button', { type: 'button', class: 'lwcs-tvm-icon', disabled: state.floorListLoading, title: '重新读取楼层', 'aria-label': '重新读取楼层', onClick: refreshFloorList }, icon('arrows-rotate', state.floorListLoading ? 'fa-spin' : ''))]),
            renderList(),
          ]),
          h('main', { class: 'lwcs-tvm-pane' }, [renderDetail()]),
        ]),
      ]);
    },
  });

  const DatabasePage = defineComponent({
    name: 'LwcsTvmDatabasePage',
    setup() {
      const navigate = path => { state.databasePath = [...path]; };
      return () => {
        const selectedIndex = state.databaseKeys.indexOf(state.databaseSelectedKey);
        const value = state.databaseSelectedValue;
        return h('section', { class: 'lwcs-tvm-db' }, [
          renderMessages([state.databaseError && ['剧情资料暂时无法读取：' + state.databaseError, 'error']]),
          h('div', { class: 'lwcs-tvm-split' }, [
            h('aside', { class: 'lwcs-tvm-aside' }, [
              h('div', { class: 'lwcs-tvm-aside-head' }, [h('strong', null, '剧情资料'), h('span', { class: 'lwcs-tvm-count' }, String(state.databaseKeys.length)),
                h('button', { type: 'button', class: 'lwcs-tvm-icon', disabled: state.databaseLoading, title: '重新读取', 'aria-label': '重新读取剧情资料', onClick: refreshDatabase }, icon('arrows-rotate', state.databaseLoading ? 'fa-spin' : ''))]),
              h('div', { class: 'lwcs-tvm-key-list' }, [
                state.databaseLoading ? h('div', { class: 'lwcs-tvm-empty' }, '正在读取…') : null,
                !state.databaseLoading && !state.databaseKeys.length ? h('div', { class: 'lwcs-tvm-empty' }, '当前聊天还没有剧情资料。') : null,
                ...state.databaseKeys.map((key, index) => h('button', { key, type: 'button', class: ['lwcs-tvm-key', state.databaseSelectedKey === key ? 'is-on' : ''], 'aria-pressed': String(state.databaseSelectedKey === key), onClick: () => selectDatabaseKey(key) },
                  [h('span', { class: 'lwcs-tvm-sock' }, icon('book')), h('span', null, '剧情资料 ' + (index + 1))])),
              ]),
              h('button', { type: 'button', class: 'lwcs-tvm-btn is-primary lwcs-tvm-db-open', title: '修改剧情资料请在数据库编辑器里进行', onClick: openDatabaseEditor }, [icon('table'), '打开数据库编辑器']),
            ]),
            h('main', { class: 'lwcs-tvm-pane' }, state.databaseValueLoading
              ? [h('div', { class: 'lwcs-tvm-empty is-big' }, '读取中…')]
              : !state.databaseSelectedKey
                ? [h('div', { class: 'lwcs-tvm-empty is-big' }, [icon('hand-pointer'), h('p', null, '选择左侧一项资料')])]
                : isContainer(value)
                  ? [renderPaneHead(state.databasePath, getAtPath(value, state.databasePath), navigate, '剧情资料 ' + (selectedIndex + 1)), h('div', { class: 'lwcs-tvm-scroll' }, [h(Sheet, { root: value, path: state.databasePath, editable: false, navigate })])]
                  : [h('div', { class: 'lwcs-tvm-scroll' }, [h('pre', { class: 'lwcs-tvm-pre', tabindex: '0' }, value === undefined ? '（无内容）' : JSON.stringify(value, null, 2))])]),
          ]),
        ]);
      };
    },
  });

  const DiagnosticsPage = defineComponent({
    name: 'LwcsTvmDiagnosticsPage',
    setup() {
      return () => {
        const light = (busy, error) => busy ? 'busy' : error ? 'error' : 'ok';
        const cards = [
          { title: '变量', icon: 'sliders', state: light(state.mvuLoading || state.mvuSaving, state.mvuError), text: state.mvuLoading || state.mvuSaving ? '处理中' : state.mvuError ? '需要重试' : '正常',
            rows: [['存储', backendLabel.value], ['版本', revisionLabel.value], ['待保存', String(draftList.value.length)]], error: state.mvuError },
          { title: '楼层记录', icon: 'layer-group', state: light(state.floorListLoading || state.floorDetailLoading, state.floorError), text: state.floorListLoading || state.floorDetailLoading ? '读取中' : state.floorError ? '需要重试' : '正常',
            rows: [['楼层', state.floorMessages.length ? String(state.floorMessages.length) : '—'], ['已缓存', String(floorCache.size)]], error: state.floorError },
          { title: '剧情资料', icon: 'book-open', state: light(state.databaseLoading || state.databaseValueLoading, state.databaseError), text: state.databaseLoading || state.databaseValueLoading ? '读取中' : state.databaseError ? '需要重试' : '正常',
            rows: [['存储', state.databaseBackend || '—'], ['条目', String(state.databaseKeys.length)]], error: state.databaseError },
          { title: '当前聊天', icon: 'comments', state: state.baselineChatId ? 'ok' : 'busy', text: state.baselineChatId ? '已识别' : '等待载入',
            rows: [['聊天', state.baselineChatId || '—']], error: '' },
        ];
        return h('section', { class: 'lwcs-tvm-diag' }, [
          h('div', { class: 'lwcs-tvm-diag-head' }, [
            renderMessages([state.diagnosticError && ['运行检查暂时无法完成：' + state.diagnosticError, 'error']]),
            h('button', { type: 'button', class: 'lwcs-tvm-btn', disabled: state.diagnosticLoading, onClick: refreshDiagnostics }, [icon('stethoscope', state.diagnosticLoading ? 'fa-beat-fade' : ''), state.diagnosticLoading ? '检查中…' : '重新检查']),
          ]),
          h('div', { class: 'lwcs-tvm-diag-grid' }, cards.map(card => h('article', { key: card.title, class: ['lwcs-tvm-diag-card', 'is-' + card.state] }, [
            h('header', null, [h('span', { class: 'lwcs-tvm-sock' }, icon(card.icon)), h('strong', null, card.title), h('span', { class: 'lwcs-tvm-light', title: card.error || card.text }, [h('i'), card.text])]),
            h('dl', null, card.rows.flatMap(([key, value]) => [h('dt', null, key), h('dd', { title: value }, value)])),
          ]))),
        ]);
      };
    },
  });

  const Root = defineComponent({
    name: 'LwcsTvmRoot',
    setup() {
      watch(() => state.activeTab, async tab => {
        invalidateFloorReads(false);
        if (tab === 'floors') await refreshFloorList();
        if (tab === 'database') await refreshDatabase();
        if (tab === 'diagnostics') await refreshDiagnostics();
      });
      // 换楼层 / 换资料时回到顶层
      watch(() => state.floorDetail, () => { state.floorPath = []; });
      watch(() => state.databaseSelectedKey, () => { state.databasePath = []; });
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
          h('header', { class: 'lwcs-tvm-head' }, [
            h('div', { class: 'lwcs-tvm-brand' }, [h('span', { class: 'lwcs-tvm-sock is-brand' }, icon('sliders')), h('h1', { id: 'lwcs-tvm-title' }, '变量管理器')]),
            h('nav', { class: 'lwcs-tvm-tabs', 'aria-label': '变量管理器页面' }, TABS.map(tab => h('button', {
              key: tab.id, type: 'button', class: state.activeTab === tab.id ? 'is-on' : '', title: tab.hint,
              'aria-current': state.activeTab === tab.id ? 'page' : undefined, onClick: () => { state.activeTab = tab.id; },
            }, [icon(tab.icon), h('span', null, tab.label), tab.id === 'mvu' && isDirty.value ? h('em', { class: 'lwcs-tvm-dot', title: '有未保存的修改' }, String(draftList.value.length)) : null]))),
            h('button', { class: 'lwcs-tvm-close', type: 'button', 'aria-label': '关闭变量管理器', title: '关闭（Esc）', onClick: closeManager }, icon('xmark')),
          ]),
          h('div', { class: 'lwcs-tvm-body' }, [
            state.activeTab === 'mvu' ? h(MvuPage) : null,
            state.activeTab === 'floors' ? h(FloorPage) : null,
            state.activeTab === 'database' ? h(DatabasePage) : null,
            state.activeTab === 'diagnostics' ? h(DiagnosticsPage) : null,
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
    styleElement.textContent = `
.lwcs-tvm-overlay,.lwcs-tvm-overlay *{box-sizing:border-box}
.lwcs-tvm-overlay{--ink:#16223d;--ink2:#465572;--ink3:#76839a;--line:rgba(30,48,80,.16);--blue:#2f7cf6;--navy:#1a2640;--amber:#b86e08;--amber-bg:rgba(255,186,80,.16);--ok:#1f9d63;--err:#c8392f;position:fixed;inset:0;z-index:2147482000;display:grid;place-items:center;padding:14px;color:var(--ink);background:radial-gradient(70% 60% at 50% 40%,rgba(30,60,120,.35),transparent 70%),rgba(6,10,18,.78);color-scheme:light;font:14px/1.4 "HarmonyOS Sans SC","Microsoft YaHei UI","Microsoft YaHei","PingFang SC",system-ui,sans-serif;overscroll-behavior:contain}
.lwcs-tvm-overlay button,.lwcs-tvm-overlay input,.lwcs-tvm-overlay textarea{font:inherit;color:inherit;margin:0}
.lwcs-tvm-overlay button{cursor:pointer;touch-action:manipulation}
.lwcs-tvm-overlay button:disabled{opacity:.45;cursor:not-allowed}
.lwcs-tvm-overlay :focus-visible{outline:2px solid var(--blue);outline-offset:1px}
.lwcs-tvm-sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
/* 外壳：银色金属外框（切角）+ 浅色屏面 */
.lwcs-tvm-shell{width:min(1280px,100%);height:min(860px,calc(100dvh - 28px));min-height:420px;display:flex;flex-direction:column;overflow:hidden;padding:5px;background:linear-gradient(160deg,#eef2f7,#b3bdcc 45%,#dfe5ee);clip-path:polygon(16px 0,100% 0,100% calc(100% - 16px),calc(100% - 16px) 100%,0 100%,0 16px);filter:drop-shadow(0 18px 40px rgba(0,0,0,.55))}
.lwcs-tvm-shell>*{flex:none}
.lwcs-tvm-body{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;background:repeating-linear-gradient(180deg,rgba(255,255,255,0) 0 3px,rgba(255,255,255,.35) 3px 4px),linear-gradient(180deg,#f3f6fa,#e2e8f1);clip-path:polygon(0 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%)}
.lwcs-tvm-body>section{flex:1 1 auto;min-height:0;display:flex;flex-direction:column}
/* 顶部铭牌：深蓝金属条，标题 + 页签 + 关闭 */
.lwcs-tvm-head{display:flex;align-items:center;gap:14px;padding:7px 8px 7px 12px;margin-bottom:5px;color:#e6edf9;background:linear-gradient(180deg,#2c3a56,#151e33);box-shadow:inset 0 1px 0 rgba(255,255,255,.18),inset 0 0 0 1px rgba(120,150,200,.35);clip-path:polygon(12px 0,100% 0,100% 100%,0 100%,0 12px)}
.lwcs-tvm-brand{display:flex;align-items:center;gap:10px;min-width:0}
.lwcs-tvm-brand h1{margin:0;font-size:17px;font-weight:900;letter-spacing:.12em;white-space:nowrap}
.lwcs-tvm-tabs{flex:1 1 auto;min-width:0;display:flex;gap:4px;overflow-x:auto;scrollbar-width:none}
.lwcs-tvm-tabs button{position:relative;flex:none;display:flex;align-items:center;gap:7px;min-height:38px;padding:0 18px;border:0;color:#9db0cf;font-weight:800;letter-spacing:.06em;background:none;clip-path:polygon(9px 0,100% 0,calc(100% - 9px) 100%,0 100%)}
.lwcs-tvm-tabs button:hover{color:#fff;background:rgba(120,170,255,.12)}
.lwcs-tvm-tabs button.is-on{color:#fff;background:linear-gradient(180deg,#5aa5ff,#1a5ad6 60%,#1446b0);box-shadow:inset 0 1px 0 rgba(255,255,255,.55)}
.lwcs-tvm-dot{min-width:18px;height:18px;padding:0 5px;display:inline-grid;place-items:center;border-radius:9px;font:800 11px/1 Bahnschrift,sans-serif;font-style:normal;color:#3a2300;background:#ffc46b}
.lwcs-tvm-close,.lwcs-tvm-icon{flex:none;width:36px;height:36px;display:grid;place-items:center;padding:0;border:0;border-radius:2px;background:none;font-size:17px}
.lwcs-tvm-close{color:#cfe0ff}.lwcs-tvm-close:hover{color:#fff;background:rgba(255,90,90,.25)}
.lwcs-tvm-icon{color:var(--ink2)}.lwcs-tvm-icon:hover{color:var(--blue);background:rgba(47,124,246,.1)}
/* 八角图标座 */
.lwcs-tvm-sock{flex:none;width:30px;height:30px;display:grid;place-items:center;color:#cfe3ff;font-size:13px;background:radial-gradient(circle at 40% 25%,#3d5f9e,#0f1a33 75%);clip-path:polygon(28% 0,72% 0,100% 28%,100% 72%,72% 100%,28% 100%,0 72%,0 28%)}
.lwcs-tvm-sock.is-brand{width:32px;height:32px;color:#ffd36b;background:radial-gradient(circle at 40% 25%,#5a6f96,#141d33 75%)}
/* 通用按钮 */
.lwcs-tvm-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:36px;padding:0 14px;border:0;font-weight:800;color:var(--ink);background:linear-gradient(180deg,#fff,#e6ebf2);box-shadow:inset 0 0 0 1px rgba(30,48,80,.2),0 1px 2px rgba(20,40,80,.12);clip-path:polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px);white-space:nowrap}
.lwcs-tvm-btn:hover:not(:disabled){color:var(--blue);box-shadow:inset 0 0 0 1px rgba(47,124,246,.55)}
.lwcs-tvm-btn.is-primary{color:#fff;background:linear-gradient(180deg,#5aa5ff,#1a5ad6 60%,#1446b0);box-shadow:inset 0 1px 0 rgba(255,255,255,.5),inset 0 -2px 0 rgba(0,0,0,.18)}
.lwcs-tvm-btn.is-primary:hover:not(:disabled){color:#fff;filter:brightness(1.08)}
.lwcs-tvm-btn.is-ghost{background:none;box-shadow:inset 0 0 0 1px rgba(200,215,240,.35);color:#cfe0ff}
.lwcs-tvm-mini{flex:none;width:24px;height:24px;display:grid;place-items:center;padding:0;border:0;border-radius:2px;color:var(--ink3);background:none;font-size:12px}
.lwcs-tvm-mini:hover{color:var(--blue);background:rgba(47,124,246,.1)}
/* 工具条：搜索 + 操作 */
.lwcs-tvm-toolbar{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--line)}
.lwcs-tvm-search{flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:8px;height:38px;padding:0 12px;color:var(--ink3);background:#fff;box-shadow:inset 0 0 0 1px rgba(30,48,80,.22),inset 0 2px 3px rgba(20,40,80,.06);clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)}
.lwcs-tvm-search:focus-within{box-shadow:inset 0 0 0 2px var(--blue)}
.lwcs-tvm-search input{flex:1;min-width:0;height:100%;border:0;outline:0;background:none;font-weight:700;color:var(--ink)}
.lwcs-tvm-search.is-small{flex:0 1 220px;height:34px}
.lwcs-tvm-messages{padding:6px 12px 0}
.lwcs-tvm-message{margin:0 0 6px;padding:7px 12px;font-size:13px;font-weight:700;color:#5b4a2c;background:rgba(255,200,110,.18);box-shadow:inset 3px 0 0 #e0a23a;overflow-wrap:anywhere}
.lwcs-tvm-message.is-error{color:#8a1f18;background:rgba(230,80,70,.12);box-shadow:inset 3px 0 0 var(--err)}
/* 左栏 + 右栏 */
.lwcs-tvm-split{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:minmax(230px,280px) minmax(0,1fr)}
.lwcs-tvm-aside{min-height:0;display:flex;flex-direction:column;border-right:1px solid var(--line);background:rgba(255,255,255,.4)}
.lwcs-tvm-aside-head{display:flex;align-items:center;gap:8px;padding:10px 8px 8px 14px;border-bottom:1px solid var(--line)}
.lwcs-tvm-aside-head strong{font-weight:900;letter-spacing:.08em}
.lwcs-tvm-aside-head .lwcs-tvm-icon{margin-left:auto}
.lwcs-tvm-pane{min-width:0;min-height:0;display:flex;flex-direction:column}
.lwcs-tvm-scroll{flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;padding:12px 14px 16px;scrollbar-width:thin;scrollbar-color:#9aa7ba transparent}
/* 目录 */
.lwcs-tvm-tree{flex:1 1 auto;min-height:0;overflow:auto;padding:8px 6px 12px;scrollbar-width:thin;scrollbar-color:#9aa7ba transparent}
.lwcs-tvm-tree-row{position:relative;display:flex;align-items:center;gap:2px;min-height:32px;padding-left:calc(var(--lwcs-tvm-depth,0) * 16px);border-radius:2px}
.lwcs-tvm-tree-row.is-root{width:100%;gap:9px;padding:0 10px;border:0;font-weight:900;color:var(--ink2);background:none;text-align:left}
.lwcs-tvm-tree-row:hover{background:rgba(47,124,246,.07)}
.lwcs-tvm-tree-row.is-current{background:linear-gradient(90deg,rgba(47,124,246,.2),rgba(47,124,246,.04));box-shadow:inset 3px 0 0 var(--blue)}
.lwcs-tvm-tree-row.is-current .lwcs-tvm-tree-name,.lwcs-tvm-tree-row.is-root.is-current{color:#0f4fc4}
.lwcs-tvm-tree-row.is-trail .lwcs-tvm-tree-name{color:var(--ink)}
.lwcs-tvm-tree-row.is-changed::after{content:"";position:absolute;right:6px;top:50%;width:6px;height:6px;margin-top:-3px;border-radius:50%;background:#f0a53a;box-shadow:0 0 5px #f0a53a}
.lwcs-tvm-twist{flex:none;width:24px;height:28px;display:grid;place-items:center;padding:0;border:0;background:none;color:var(--ink3);font-size:12px}
.lwcs-tvm-tree-name{flex:1 1 auto;min-width:0;display:flex;align-items:baseline;gap:6px;min-height:30px;padding:0 4px;border:0;background:none;text-align:left;font-weight:700;color:var(--ink2)}
.lwcs-tvm-tree-name span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lwcs-tvm-tree-name small{flex:none;font-size:11px;font-weight:800;color:var(--ink3)}
.lwcs-tvm-count{flex:none;min-width:24px;padding:0 6px;font:700 12px/20px Bahnschrift,sans-serif;text-align:center;color:var(--ink3)}
.lwcs-tvm-tree-row .lwcs-tvm-count{margin-right:14px}
/* 属性表头 */
.lwcs-tvm-pane-head{display:flex;flex-direction:column;gap:6px;padding:10px 14px 10px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.35)}
.lwcs-tvm-pane-row{display:flex;align-items:center;gap:10px;min-width:0}
.lwcs-tvm-up{flex:none;width:30px;height:30px;display:grid;place-items:center;padding:0;border:0;color:var(--ink2);background:rgba(30,48,80,.07);clip-path:polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)}
.lwcs-tvm-up:hover{color:var(--blue)}
.lwcs-tvm-crumbs{min-width:0;display:flex;align-items:center;overflow-x:auto;scrollbar-width:none}
.lwcs-tvm-crumbs button{flex:none;min-height:28px;padding:0 4px;border:0;background:none;font-size:12px;font-weight:700;color:var(--ink3);white-space:nowrap}
.lwcs-tvm-crumbs button:not(:last-child)::after{content:"›";margin-left:8px;color:#a4afc0}
.lwcs-tvm-crumbs button:hover{color:var(--blue)}
.lwcs-tvm-crumbs button.is-current{color:var(--ink2)}
.lwcs-tvm-pane-title{margin:0;min-width:0;display:flex;align-items:baseline;gap:10px;font-size:21px;font-weight:900;letter-spacing:.05em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lwcs-tvm-pane-title small{font-size:13px;font-weight:800;letter-spacing:.1em;color:var(--ink3)}
.lwcs-tvm-chip{flex:none;padding:3px 10px;font-size:12px;font-weight:800;color:#e6edf9;background:linear-gradient(180deg,#2c3a56,#151e33);clip-path:polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%)}
.lwcs-tvm-chip.is-amber{color:#3a2300;background:linear-gradient(180deg,#ffd58a,#f0a53a)}
.lwcs-tvm-pane-actions{margin-left:auto;display:flex;gap:6px}
/* 属性表：字段网格 + 分组卡片 */
.lwcs-tvm-sheet{display:flex;flex-direction:column;gap:16px}
.lwcs-tvm-sec-title{margin:0 0 8px;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:900;letter-spacing:.16em;color:var(--ink3)}
.lwcs-tvm-sec-title i{color:var(--blue)}
.lwcs-tvm-sec-title em{font:700 12px Bahnschrift,sans-serif;letter-spacing:0;color:var(--ink3)}
.lwcs-tvm-fields{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}
.lwcs-tvm-field{position:relative;min-width:0;display:flex;flex-direction:column;gap:5px;padding:8px 10px 9px;background:rgba(255,255,255,.78);box-shadow:inset 0 0 0 1px var(--line),0 1px 2px rgba(20,40,80,.06);clip-path:polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)}
.lwcs-tvm-field.is-wide{grid-column:1/-1}
.lwcs-tvm-field.is-changed{background:linear-gradient(180deg,rgba(255,236,200,.9),rgba(255,248,232,.85));box-shadow:inset 3px 0 0 #f0a53a,inset 0 0 0 1px rgba(200,130,30,.35)}
.lwcs-tvm-field.is-verified{box-shadow:inset 3px 0 0 var(--ok),inset 0 0 0 1px rgba(30,160,100,.4)}
.lwcs-tvm-field.is-focus{animation:lwcs-tvm-flash 1.6s ease-out}
.lwcs-tvm-field-head{display:flex;align-items:center;gap:2px;min-height:22px}
.lwcs-tvm-field-name{flex:1 1 auto;min-width:0;font-size:12px;font-weight:800;letter-spacing:.04em;color:var(--ink3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lwcs-tvm-field .lwcs-tvm-mini{opacity:.55}
.lwcs-tvm-field:hover .lwcs-tvm-mini,.lwcs-tvm-field:focus-within .lwcs-tvm-mini,.lwcs-tvm-field.is-changed .lwcs-tvm-mini{opacity:1}
.lwcs-tvm-input{width:100%;min-width:0;padding:4px 2px;border:0;border-bottom:1px solid rgba(30,48,80,.22);background:none;font-weight:800;font-size:15px;color:var(--ink);outline:0;resize:vertical}
.lwcs-tvm-input:focus{border-bottom:2px solid var(--blue);padding-bottom:3px}
.lwcs-tvm-input.is-number{font:700 18px Bahnschrift,"DIN Alternate",sans-serif;letter-spacing:.02em}
textarea.lwcs-tvm-input{font-size:14px;font-weight:600;line-height:1.55;padding:6px 8px;border:1px solid rgba(30,48,80,.18);background:rgba(255,255,255,.6)}
textarea.lwcs-tvm-input:focus{border:1px solid var(--blue);padding:6px 8px}
.lwcs-tvm-read{min-width:0;font-weight:800;font-size:15px;color:var(--ink);overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:4;overflow:hidden}
.lwcs-tvm-read.is-number{font:700 18px Bahnschrift,sans-serif}
.lwcs-tvm-read.is-boolean,.lwcs-tvm-read.is-null{color:var(--ink2)}
.lwcs-tvm-was{font-size:12px;font-weight:700;color:#8a5a10;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lwcs-tvm-field-error{font-size:12px;font-weight:800;color:var(--err)}
.lwcs-tvm-null{align-self:flex-start;padding:3px 12px;border:1px dashed rgba(30,48,80,.3);background:none;font-weight:800;color:var(--ink3)}
/* 开关 */
.lwcs-tvm-switch{align-self:flex-start;display:inline-flex;align-items:center;gap:9px;padding:2px 2px 2px 0;border:0;background:none;font-weight:800;color:var(--ink2)}
.lwcs-tvm-knob{position:relative;width:44px;height:22px;border-radius:11px;background:#c3ccd9;box-shadow:inset 0 1px 3px rgba(0,0,0,.25);transition:background .18s}
.lwcs-tvm-knob::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:translate .18s}
.lwcs-tvm-switch[aria-checked="true"] .lwcs-tvm-knob{background:linear-gradient(180deg,#5aa5ff,#1a5ad6)}
.lwcs-tvm-switch[aria-checked="true"] .lwcs-tvm-knob::after{translate:22px 0}
.lwcs-tvm-switch[aria-checked="true"] b{color:#0f4fc4}
.lwcs-tvm-switch.is-large{padding:8px 0}
/* 分组卡片 */
.lwcs-tvm-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px}
.lwcs-tvm-tile{min-width:0;display:flex;align-items:center;gap:10px;padding:9px 10px;border:0;text-align:left;color:var(--ink);background:rgba(255,255,255,.78);box-shadow:inset 0 0 0 1px var(--line),0 1px 2px rgba(20,40,80,.06);clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)}
.lwcs-tvm-tile:hover{background:#fff;box-shadow:inset 0 0 0 1px rgba(47,124,246,.55)}
.lwcs-tvm-tile:hover .lwcs-tvm-sock{filter:drop-shadow(0 0 5px rgba(80,160,255,.8))}
.lwcs-tvm-tile.is-changed{box-shadow:inset 3px 0 0 #f0a53a,inset 0 0 0 1px rgba(200,130,30,.35)}
.lwcs-tvm-tile-body{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:1px}
.lwcs-tvm-tile-body strong{font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lwcs-tvm-tile-body small{font-size:12px;font-weight:700;color:var(--ink3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lwcs-tvm-tile .lwcs-tvm-count{font-size:15px;color:var(--ink2)}
.lwcs-tvm-go{color:#a4afc0;font-size:12px}
.lwcs-tvm-more{align-self:center;padding:8px 18px;border:1px dashed rgba(30,48,80,.3);background:none;font-weight:800;color:var(--ink2)}
.lwcs-tvm-empty{padding:26px 16px;text-align:center;font-weight:700;color:var(--ink3)}
.lwcs-tvm-empty.is-big{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px}
.lwcs-tvm-empty.is-big>i{font-size:28px;color:#a4b4cc}
.lwcs-tvm-empty p{margin:0}
/* 搜索结果 */
.lwcs-tvm-results{display:flex;flex-direction:column;gap:6px}
.lwcs-tvm-result{display:grid;grid-template-columns:auto minmax(0,1fr) minmax(0,40%);align-items:center;gap:10px;padding:7px 10px;border:0;text-align:left;color:var(--ink);background:rgba(255,255,255,.78);box-shadow:inset 0 0 0 1px var(--line)}
.lwcs-tvm-result:hover{background:#fff;box-shadow:inset 0 0 0 1px rgba(47,124,246,.55)}
.lwcs-tvm-result-body{min-width:0;display:flex;flex-direction:column}
.lwcs-tvm-result-body strong{font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lwcs-tvm-result-body small,.lwcs-tvm-result-value{font-size:12px;font-weight:700;color:var(--ink3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lwcs-tvm-result-value{font-size:13px;color:var(--ink2);text-align:right}
/* 待保存清单 + 保存条（深蓝铭牌） */
.lwcs-tvm-drafts{max-height:34%;overflow:auto;padding:8px 12px;border-top:1px solid var(--line);background:rgba(255,240,214,.6)}
.lwcs-tvm-draft{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr) auto minmax(0,1fr) auto;align-items:center;gap:8px;min-height:32px;font-size:13px}
.lwcs-tvm-draft+.lwcs-tvm-draft{border-top:1px solid rgba(180,120,30,.18)}
.lwcs-tvm-draft-path{min-width:0;padding:0;border:0;background:none;text-align:left;font-weight:800;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lwcs-tvm-draft-path:hover{color:var(--blue)}
.lwcs-tvm-draft-old{min-width:0;color:var(--ink3);text-decoration:line-through;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lwcs-tvm-draft-new{min-width:0;font-weight:800;color:#8a5a10;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lwcs-tvm-draft-arrow{color:#c98a2a;font-size:11px}
.lwcs-tvm-savebar{display:flex;align-items:center;gap:8px;padding:8px 10px;color:#e6edf9;background:linear-gradient(180deg,#2c3a56,#151e33);box-shadow:inset 0 1px 0 rgba(255,255,255,.15)}
.lwcs-tvm-savebar .lwcs-tvm-save-state{margin-right:auto;display:flex;align-items:center;gap:9px;min-height:36px;padding:0 10px;border:0;background:none;font-weight:800;color:#cfe0ff}
.lwcs-tvm-save-state:disabled{opacity:1;cursor:default}
.lwcs-tvm-save-state.is-dirty{color:#ffc46b}
.lwcs-tvm-save-state[data-state="verified"]{color:#7ff0bd}
.lwcs-tvm-save-state[data-state="conflict"],.lwcs-tvm-save-state[data-state="error"]{color:#ffb3ab}
.lwcs-tvm-save{min-width:132px}
/* 详细编辑弹层 */
.lwcs-tvm-sheet-backdrop{position:fixed;inset:0;z-index:3;display:flex;align-items:center;justify-content:center;padding:14px;background:rgba(6,10,18,.6)}
.lwcs-tvm-dialog{width:min(720px,100%);max-height:min(86dvh,var(--lwcs-tvm-visual-height,86dvh));display:flex;flex-direction:column;background:linear-gradient(180deg,#f3f6fa,#e2e8f1);box-shadow:0 0 0 5px #c3ccd9,0 20px 50px rgba(0,0,0,.5);clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px);animation:lwcs-tvm-pop .18s ease-out}
.lwcs-tvm-dialog-head{display:flex;align-items:flex-start;gap:10px;padding:12px 10px 10px 16px;color:#e6edf9;background:linear-gradient(180deg,#2c3a56,#151e33)}
.lwcs-tvm-dialog-head>div{flex:1;min-width:0}
.lwcs-tvm-dialog-head h3{margin:0;font-size:18px;font-weight:900;letter-spacing:.06em}
.lwcs-tvm-dialog-head p{margin:2px 0 0;font-size:12px;color:#9db0cf;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lwcs-tvm-dialog-head .lwcs-tvm-icon{color:#cfe0ff}
.lwcs-tvm-dialog-body{flex:1 1 auto;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:10px;padding:14px 16px}
.lwcs-tvm-kinds{display:flex;flex-wrap:wrap;gap:5px}
.lwcs-tvm-kinds button{min-height:32px;padding:0 14px;border:0;font-weight:800;color:var(--ink2);background:rgba(255,255,255,.7);box-shadow:inset 0 0 0 1px var(--line);clip-path:polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%)}
.lwcs-tvm-kinds button.is-on{color:#fff;background:linear-gradient(180deg,#5aa5ff,#1a5ad6)}
.lwcs-tvm-detail-input{width:100%;min-height:220px;padding:10px 12px;border:1px solid rgba(30,48,80,.22);background:#fff;font:13px/1.55 ui-monospace,Consolas,monospace;color:var(--ink);resize:vertical;outline:0}
.lwcs-tvm-detail-input:focus{border-color:var(--blue)}
.lwcs-tvm-original summary{cursor:pointer;font-size:12px;font-weight:800;color:var(--ink3)}
.lwcs-tvm-original pre,.lwcs-tvm-pre{margin:6px 0 0;max-height:200px;overflow:auto;padding:10px;background:rgba(255,255,255,.6);box-shadow:inset 0 0 0 1px var(--line);font:12px/1.5 ui-monospace,Consolas,monospace;color:var(--ink2);white-space:pre-wrap;overflow-wrap:anywhere}
.lwcs-tvm-pre{max-height:none;margin:0}
.lwcs-tvm-dialog-foot{display:flex;justify-content:flex-end;gap:8px;padding:10px 16px calc(10px + env(safe-area-inset-bottom));border-top:1px solid var(--line)}
/* 楼层记录 */
.lwcs-tvm-floor-list{flex:1 1 auto;min-height:0;overflow:auto;scrollbar-width:thin;scrollbar-color:#9aa7ba transparent}
.lwcs-tvm-floor{width:100%;height:56px;display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;align-content:center;gap:2px 8px;padding:0 12px 0 14px;border:0;border-bottom:1px solid var(--line);text-align:left;color:var(--ink);background:none}
.lwcs-tvm-floor:hover{background:rgba(47,124,246,.06)}
.lwcs-tvm-floor.is-on{background:linear-gradient(90deg,rgba(47,124,246,.2),rgba(47,124,246,.04));box-shadow:inset 3px 0 0 var(--blue)}
.lwcs-tvm-floor-no{font:800 14px Bahnschrift,sans-serif;color:var(--ink)}
.lwcs-tvm-floor-role{justify-self:end;padding:0 7px;font-size:11px;font-weight:800;color:#fff;background:#6b7a93;clip-path:polygon(4px 0,100% 0,calc(100% - 4px) 100%,0 100%)}
.lwcs-tvm-floor.is-user .lwcs-tvm-floor-role{background:#1a5ad6}
.lwcs-tvm-floor.is-char .lwcs-tvm-floor-role{background:#9c6d0c}
.lwcs-tvm-floor-text{grid-column:1/-1;font-size:12px;font-weight:600;color:var(--ink3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lwcs-tvm-floor-detail{flex:1 1 auto;min-height:0;display:flex;flex-direction:column}
.lwcs-tvm-floor-head{display:flex;align-items:center;flex-wrap:wrap;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.5)}
.lwcs-tvm-floor-title{font-size:19px;font-weight:900;letter-spacing:.04em}
.lwcs-tvm-floor-head .lwcs-tvm-search{margin-left:auto}
/* 剧情资料 */
.lwcs-tvm-key-list{flex:1 1 auto;min-height:0;overflow:auto;padding:8px;display:flex;flex-direction:column;gap:5px}
.lwcs-tvm-key{display:flex;align-items:center;gap:10px;min-height:42px;padding:6px 10px;border:0;text-align:left;font-weight:800;color:var(--ink);background:rgba(255,255,255,.7);box-shadow:inset 0 0 0 1px var(--line)}
.lwcs-tvm-key:hover{background:#fff}
.lwcs-tvm-key.is-on{background:linear-gradient(90deg,rgba(47,124,246,.2),rgba(255,255,255,.75));box-shadow:inset 3px 0 0 var(--blue),inset 0 0 0 1px rgba(47,124,246,.35)}
.lwcs-tvm-aside .lwcs-tvm-db-open{margin:8px}
/* 运行检查 */
.lwcs-tvm-diag{overflow:auto;padding:14px}
.lwcs-tvm-diag-head{display:flex;align-items:flex-start;gap:10px;margin-bottom:12px}
.lwcs-tvm-diag-head .lwcs-tvm-messages{flex:1;padding:0}
.lwcs-tvm-diag-head .lwcs-tvm-btn{margin-left:auto}
.lwcs-tvm-diag-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
.lwcs-tvm-diag-card{padding:12px 14px;background:rgba(255,255,255,.8);box-shadow:inset 0 0 0 1px var(--line);clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)}
.lwcs-tvm-diag-card header{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.lwcs-tvm-diag-card strong{font-size:16px;font-weight:900}
.lwcs-tvm-light{margin-left:auto;display:flex;align-items:center;gap:6px;font-size:12px;font-weight:800;color:var(--ink2)}
.lwcs-tvm-light i{width:10px;height:10px;border-radius:50%;background:#9aa7ba}
.lwcs-tvm-diag-card.is-ok .lwcs-tvm-light i{background:#2fd08a;box-shadow:0 0 8px #2fd08a}
.lwcs-tvm-diag-card.is-busy .lwcs-tvm-light i{background:#f0a53a;box-shadow:0 0 8px #f0a53a}
.lwcs-tvm-diag-card.is-error .lwcs-tvm-light i{background:#e5483d;box-shadow:0 0 8px #e5483d}
.lwcs-tvm-diag-card.is-error .lwcs-tvm-light{color:var(--err)}
.lwcs-tvm-diag-card dl{margin:0;display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 14px;font-size:13px}
.lwcs-tvm-diag-card dt{font-weight:800;color:var(--ink3)}
.lwcs-tvm-diag-card dd{margin:0;font-weight:800;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@keyframes lwcs-tvm-flash{0%,30%{box-shadow:inset 0 0 0 2px var(--blue),0 0 0 3px rgba(47,124,246,.25)}100%{box-shadow:inset 0 0 0 1px var(--line)}}
@keyframes lwcs-tvm-pop{from{transform:translateY(10px);opacity:.6}to{transform:none;opacity:1}}
@media(max-width:899px){.lwcs-tvm-overlay{padding:0}.lwcs-tvm-shell{width:100%;height:100dvh;clip-path:none;padding:0}.lwcs-tvm-head{clip-path:none;margin-bottom:0}.lwcs-tvm-body{clip-path:none}.lwcs-tvm-split{grid-template-columns:minmax(200px,230px) minmax(0,1fr)}.lwcs-tvm-tabs button{padding:0 12px}}
@media(max-width:599px){.lwcs-tvm-head{flex-wrap:wrap;gap:6px;padding:6px 4px 0 10px}.lwcs-tvm-brand h1{font-size:15px}.lwcs-tvm-head .lwcs-tvm-close{margin-left:auto}.lwcs-tvm-brand{flex:1}.lwcs-tvm-tabs{order:3;flex:1 1 100%;margin:0 -4px 0 -10px;padding:0 4px}.lwcs-tvm-tabs button{flex:1;justify-content:center;padding:0 6px;min-height:40px;font-size:13px;gap:5px}
.lwcs-tvm-split{display:flex;flex-direction:column}.lwcs-tvm-aside{border-right:0}.lwcs-tvm-pane{flex:1 1 auto}
.lwcs-tvm-pane-head{padding:8px 10px}.lwcs-tvm-pane-title{font-size:18px}.lwcs-tvm-scroll{padding:10px}
.lwcs-tvm-fields{grid-template-columns:repeat(2,minmax(0,1fr))}.lwcs-tvm-tiles{grid-template-columns:1fr}
.lwcs-tvm-result{grid-template-columns:auto minmax(0,1fr)}.lwcs-tvm-result-value{grid-column:2;text-align:left}
.lwcs-tvm-draft{grid-template-columns:minmax(0,1fr) auto;row-gap:0;padding:4px 0}.lwcs-tvm-draft-path{grid-column:1/-1}.lwcs-tvm-draft-arrow{display:none}.lwcs-tvm-draft-old,.lwcs-tvm-draft-new{grid-column:1}.lwcs-tvm-draft .lwcs-tvm-mini{grid-column:2;grid-row:2/4}
.lwcs-tvm-savebar{flex-wrap:wrap;padding-bottom:calc(8px + env(safe-area-inset-bottom))}.lwcs-tvm-savebar .lwcs-tvm-save-state{flex:1 1 100%;margin:0}.lwcs-tvm-savebar .lwcs-tvm-btn{flex:1}
.lwcs-tvm-floors .lwcs-tvm-aside{flex:1 1 auto;min-height:0}
.lwcs-tvm-floors.is-mobile-detail .lwcs-tvm-aside,.lwcs-tvm-floors:not(.is-mobile-detail) .lwcs-tvm-pane{display:none}
.lwcs-tvm-floor-head .lwcs-tvm-search{flex:1 1 100%;margin:0}
.lwcs-tvm-db .lwcs-tvm-aside{max-height:40%;border-bottom:1px solid var(--line)}
.lwcs-tvm-dialog{max-height:100dvh}.lwcs-tvm-sheet-backdrop{padding:0;align-items:flex-end}.lwcs-tvm-dialog{clip-path:none}}
@media(prefers-reduced-motion:reduce){.lwcs-tvm-overlay *{transition:none!important;animation:none!important}}
`;
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

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
      open() { throw new Error('TT-store 变量管理器需要宿主已加载 Vue 3 global'); },
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
    return path.length ? ['stat_data', ...path].join(' › ') : 'stat_data';
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
    return kind === 'string' ? 'str' : kind === 'number' ? 'num' : kind === 'boolean' ? 'bool' : kind === 'array' ? 'arr' : kind === 'object' ? 'obj' : 'null';
  }

  function compactValue(value) {
    if (Array.isArray(value)) return value.length + ' 项';
    if (value && typeof value === 'object') return Object.keys(value).length + ' 项';
    if (value === null) return 'null';
    if (typeof value === 'string') return value || '空字符串';
    return String(value);
  }

  function extractRevision(data, status) {
    const direct = data?.revision ?? data?._revision;
    if (direct !== undefined && direct !== null) return direct;
    const sessions = Array.isArray(status) ? status : status?.sessions;
    return sessions?.find(item => item?.head?.revision !== undefined)?.head?.revision ?? null;
  }

  function replaceAtPath(rootValue, path, nextValue) {
    if (path.length === 0) return nextValue;
    const nextRoot = cloneJson(rootValue);
    let cursor = nextRoot;
    for (let index = 0; index < path.length - 1; index += 1) cursor = cursor[path[index]];
    cursor[path[path.length - 1]] = nextValue;
    return nextRoot;
  }

  function shortValue(value) {
    if (typeof value === 'string') return value.length > 120 ? `${value.slice(0, 117)}…` : value;
    if (value === null) return 'null';
    if (typeof value === 'object') return Array.isArray(value) ? `[${value.length}]` : `{${Object.keys(value).length}}`;
    return String(value);
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
    if (value.head && typeof value.head === 'object') result.head = safeStatus(value.head);
    if (value.floor && typeof value.floor === 'object') result.floor = safeStatus(value.floor);
    if (value.sessions && Array.isArray(value.sessions)) result.sessions = value.sessions.map(safeStatus);
    return result;
  }

  const state = reactive({
    visible: false,
    activeTab: 'mvu',
    viewportWidth: hostWindow.innerWidth || 1200,
    snapshot: null,
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
    detailOpen: false,
    detailPath: [],
    detailType: '',
    detailText: '',
    detailError: '',
    verifiedPaths: new Set(),
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
    const fromDatabase = state.databaseBackend;
    const statuses = state.diagnostics?.mvuPersistence;
    const sessions = Array.isArray(statuses) ? statuses : statuses?.sessions;
    const fromMvu = sessions?.find(item => item?.backend)?.backend;
    return fromMvu || fromDatabase || '不可用';
  });

  function setDraft(path, nextValue) {
    const key = pathKey(path);
    const original = cloneJson(getAtPath(state.snapshot?.stat_data, path));
    if (canonicalJson(original) === canonicalJson(nextValue)) {
      delete state.drafts[key];
    } else {
      for (const [otherKey, entry] of Object.entries(state.drafts)) {
        const overlaps = entry.path.length <= path.length
          ? entry.path.every((part, index) => part === path[index])
          : path.every((part, index) => part === entry.path[index]);
        if (overlaps) delete state.drafts[otherKey];
      }
      state.drafts[key] = { path: [...path], original, nextValue: cloneJson(nextValue) };
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
    state.mvuNotice = '已丢弃全部未保存草稿。';
    if (state.searchInput.trim()) scheduleSearch();
  }

  function confirmDiscardDraft() {
    if (!isDirty.value) return;
    if (!hostWindow.confirm('丢弃当前未保存的 stat_data 修改？此操作无法撤销。')) return;
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
    if (typeof mvu?.persistence?.awaitIdle === 'function') await mvu.persistence.awaitIdle();
    const data = readCanonicalHotMvu(mvu);
    const status = typeof mvu?.persistence?.getStatus === 'function'
      ? await Promise.resolve(mvu.persistence.getStatus())
      : null;
    return { data, revision: extractRevision(data, status) };
  }

  async function refreshMvu(options = {}) {
    if (state.mvuLoading || state.mvuSaving) return false;
    if (isDirty.value && options.discard !== true) {
      state.mvuNotice = '存在未保存草稿。请先保存或点击“丢弃”，刷新不会覆盖当前草稿。';
      return false;
    }
    state.mvuLoading = true;
    state.mvuError = '';
    state.mvuNotice = '';
    try {
      const result = await readCanonicalMvu();
      state.snapshot = result.data;
      state.baselineRevision = result.revision;
      state.baselineFingerprint = canonicalJson(result.data.stat_data);
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
    state.mvuSaving = true;
    state.saveState = 'saving';
    state.mvuError = '';
    state.mvuNotice = '';
    try {
      const current = await readCanonicalMvu();
      if ((state.baselineRevision !== null && current.revision !== null && String(current.revision) !== String(state.baselineRevision))
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
      if (typeof mvu.persistence?.awaitIdle === 'function') await mvu.persistence.awaitIdle();
      const confirmed = readCanonicalHotMvu(mvu);
      for (const entry of intendedDrafts) {
        if (canonicalJson(getAtPath(confirmed.stat_data, entry.path)) !== canonicalJson(entry.nextValue)) {
          state.saveState = 'conflict';
          throw new Error('写后回读路径不一致：' + pathLabel(entry.path));
        }
      }
      state.snapshot = confirmed;
      const status = typeof mvu.persistence?.getStatus === 'function' ? await Promise.resolve(mvu.persistence.getStatus()) : null;
      state.baselineRevision = extractRevision(confirmed, status);
      state.baselineFingerprint = canonicalJson(confirmed.stat_data);
      state.drafts = {};
      state.verifiedPaths = new Set(intendedDrafts.map(entry => pathKey(entry.path)));
      state.saveState = 'verified';
      state.mvuNotice = '已保存并完成 TT-store 路径回读确认。';
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
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object') throw new Error('请输入对象或数组 JSON');
    return value;
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
    state.saveState = 'editing';
    nextTick(() => rootElement?.querySelector('.lwcs-tvm-inline-input')?.focus());
  }

  function cancelInlineEdit() {
    state.editingPathKey = '';
    state.editingPath = [];
    state.editingText = '';
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
      state.mvuError = errorText(error);
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
        throw new Error('stat_data 根必须是 JSON 对象');
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

  function scheduleSearch() {
    hostWindow.clearTimeout(searchTimer);
    searchGeneration += 1;
    const generation = searchGeneration;
    searchTimer = hostWindow.setTimeout(() => runSearch(generation), 80);
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
      return String(context?.chatId ?? context?.chat_id ?? '').trim();
    } catch (_) {
      return '';
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
    if (destroyed) throw new Error('TT-store 变量管理器已销毁');
    if (state.activeTab === 'mvu') return refreshMvu();
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
    if (destroyed) throw new Error('TT-store 变量管理器已销毁');
    if (state.visible) {
      rootElement?.querySelector('.lwcs-tvm-close')?.focus();
      return;
    }
    openerElement = hostWindow.document.activeElement;
    handleViewportChange();
    state.visible = true;
    hostWindow.document.addEventListener('keydown', handleGlobalKeydown, true);
    hostWindow.addEventListener('resize', handleViewportChange);
    hostWindow.visualViewport?.addEventListener('resize', handleViewportChange);
    await nextTick();
    rootElement?.querySelector('.lwcs-tvm-close')?.focus();
    await refreshActive();
    if (destroyed || !state.visible) return;
    if (state.activeTab !== 'diagnostics') await refreshDiagnostics();
  }

  function closeManager() {
    state.visible = false;
    hostWindow.document.removeEventListener('keydown', handleGlobalKeydown, true);
    hostWindow.removeEventListener('resize', handleViewportChange);
    hostWindow.visualViewport?.removeEventListener('resize', handleViewportChange);
    const target = openerElement;
    openerElement = null;
    if (target?.isConnected && typeof target.focus === 'function') target.focus();
  }

  function handleViewportChange() {
    state.viewportWidth = hostWindow.visualViewport?.width || hostWindow.innerWidth || 1200;
    hostWindow.document.documentElement.style.setProperty('--lwcs-tvm-visual-height', (hostWindow.visualViewport?.height || hostWindow.innerHeight) + 'px');
  }

  const DataRow = defineComponent({
    name: 'LwcsTvmDataRow',
    props: {
      row: { type: Object, required: true },
      index: { type: Number, required: true },
      searchMode: { type: Boolean, default: false },
    },
    setup(props) {
      return () => {
        const row = props.row;
        const draft = row.draft;
        const value = row.displayValue;
        const editing = state.editingPathKey === row.key;
        let valueNode;
        if (editing) {
          const input = state.editingType === 'boolean'
            ? h('select', { class: 'lwcs-tvm-inline-input', value: state.editingText, onChange: event => { state.editingText = event.target.value; }, onKeydown: event => {
              if (event.key === 'Enter') commitInlineEdit(row.path);
              if (event.key === 'Escape') cancelInlineEdit();
            } }, [h('option', { value: 'true' }, 'true'), h('option', { value: 'false' }, 'false')])
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
          h('button', { type: 'button', class: 'lwcs-tvm-row-action', onClick: () => openDetail(row.path, value) }, '详情'),
        ];
        if (draft) actions.push(h('button', { type: 'button', class: 'lwcs-tvm-row-action lwcs-tvm-undo', onClick: () => discardPath(row.path) }, '撤销'));
        return h('div', {
          class: ['lwcs-tvm-row', draft ? 'is-draft' : '', state.verifiedPaths.has(row.key) ? 'is-verified' : ''],
          role: 'treeitem', tabindex: state.focusPathKey === row.key || (state.focusPathKey === '$' && props.index === 0) ? 0 : -1,
          'aria-level': row.depth + 1, 'aria-expanded': row.container ? String(row.expanded) : undefined,
          'aria-posinset': props.index + 1, 'data-path-key': row.key, style: { '--lwcs-tvm-depth': String(row.depth) },
          onFocus: () => { state.focusPathKey = row.key; }, onKeydown: event => handleRowKeydown(event, row, props.index),
          onDblclick: () => beginInlineEdit(row.path, value),
        }, [
          h('div', { class: 'lwcs-tvm-cell-key' }, [
            row.container ? h('button', { type: 'button', class: 'lwcs-tvm-disclosure',
              'aria-label': isMobile.value ? '进入 ' + row.name : (row.expanded ? '折叠 ' : '展开 ') + row.name,
              onClick: () => {
                if (isMobile.value) state.currentPath = [...row.path];
                else toggleExpanded(row);
              } }, isMobile.value ? '›' : row.expanded ? '−' : '+') : h('span', { class: 'lwcs-tvm-scalar-space' }),
            h('span', { class: 'lwcs-tvm-key-text', title: row.name }, row.name),
          ]),
          props.searchMode ? h('button', { type: 'button', class: 'lwcs-tvm-breadcrumb-value', onClick: () => locateRow(row.path) }, pathLabel(row.path))
            : h('span', { class: 'lwcs-tvm-type' }, '[' + typeTag(value) + ']'),
          h('div', { class: 'lwcs-tvm-value-wrap', onClick: () => {
            if (!isMobile.value) return;
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
              h('span', { class: 'lwcs-tvm-kicker' }, '[' + typeTag(getAtPath(effectiveStatData.value, state.detailPath)) + ']'),
              h('h3', { id: 'lwcs-tvm-detail-title' }, state.detailPath.length ? String(state.detailPath.at(-1)) : 'stat_data'),
              h('p', null, pathLabel(state.detailPath)),
            ]), h('button', { type: 'button', class: 'lwcs-tvm-icon-button', 'aria-label': '关闭详情', onClick: closeDetail }, '×')]),
            h('div', { class: 'lwcs-tvm-detail-body' }, [
              h('select', { value: state.detailType, 'aria-label': '值类型', onChange: event => {
                state.detailType = event.target.value;
                if (event.target.value === 'boolean') state.detailText = ['true', 'false'].includes(state.detailText) ? state.detailText : 'false';
                if (event.target.value === 'null') state.detailText = 'null';
              } }, ['string', 'number', 'boolean', 'null', 'object', 'array'].map(kind => h('option', { value: kind }, kind))),
              state.detailType === 'boolean'
                ? h('button', { type: 'button', class: 'lwcs-tvm-boolean-toggle', onClick: () => { state.detailText = state.detailText === 'true' ? 'false' : 'true'; } }, state.detailText + ' · 点击翻转')
                : h('textarea', { class: 'lwcs-tvm-detail-input', rows: 12, value: state.detailText, spellcheck: 'false', 'aria-label': '编辑值',
                  onInput: event => { state.detailText = event.target.value; } }),
              h('div', { class: 'lwcs-tvm-original-block' }, [h('span', null, 'canonical 原值'), h('pre', null, isContainer(original) ? JSON.stringify(original, null, 2) : compactValue(original))]),
              state.detailError ? h('p', { class: 'lwcs-tvm-message is-error', role: 'alert' }, state.detailError) : null,
            ]),
            h('footer', null, [
              h('button', { type: 'button', onClick: () => {
                state.detailType = valueKind(original);
                state.detailText = isContainer(original) ? JSON.stringify(original, null, 2) : original === null ? 'null' : String(original);
              } }, '恢复原值'),
              h('button', { type: 'button', onClick: closeDetail }, '取消'),
              h('button', { type: 'button', class: 'lwcs-tvm-primary', onClick: commitDetail }, '加入草稿'),
            ]),
          ]),
        ]);
      }
      return () => {
        const shown = rows.value.slice(start.value, end.value);
        const crumbs = [{ label: 'stat_data', path: [] }, ...state.currentPath.map((part, index) => ({ label: String(part), path: state.currentPath.slice(0, index + 1) }))];
        return h('section', { class: 'lwcs-tvm-mvu-page' }, [
          h('div', { class: 'lwcs-tvm-context-bar' }, [
            h('div', { class: 'lwcs-tvm-context' }, [
              h('strong', null, '当前聊天 · canonical stat_data'),
              h('span', { class: ['lwcs-tvm-backend', backendLabel.value === 'tt-store' ? 'is-online' : ''] }, backendLabel.value),
              h('span', null, 'revision ' + revisionLabel.value),
              h('span', { class: 'lwcs-tvm-state', 'data-state': state.saveState }, state.saveState),
            ]),
            h('label', { class: 'lwcs-tvm-search' }, [h('span', { class: 'lwcs-tvm-sr-only' }, '搜索变量'), h('input', {
              type: 'search', value: state.searchInput, placeholder: '搜索键名、路径或值  Ctrl+P',
              onInput: event => { state.searchInput = event.target.value; scheduleSearch(); },
            })]),
            h('div', { class: 'lwcs-tvm-tree-tools' }, [
              !isMobile.value ? h('button', { type: 'button', onClick: () => {
                const next = new Set(state.expanded);
                visibleRows.value.filter(row => row.container && row.depth < 1).forEach(row => next.add(row.key));
                state.expanded = next;
              } }, '展开一级') : null,
              h('button', { type: 'button', onClick: () => { state.expanded = new Set(['$']); } }, '全部折叠'),
              h('button', { type: 'button', onClick: () => openDetail([], effectiveStatData.value) }, 'JSON 详情'),
              h('button', { type: 'button', disabled: state.mvuLoading || state.mvuSaving, onClick: () => refreshMvu() }, '刷新'),
            ]),
          ]),
          isMobile.value && !state.searchQuery ? h('nav', { class: 'lwcs-tvm-mobile-crumbs', 'aria-label': '当前位置' }, crumbs.map((crumb, index) => h('button', {
            type: 'button', class: index === crumbs.length - 1 ? 'is-current' : '', onClick: () => { state.currentPath = [...crumb.path]; },
          }, crumb.label))) : null,
          state.mvuError ? h('p', { class: 'lwcs-tvm-message is-error', role: 'alert' }, state.mvuError) : null,
          state.mvuNotice ? h('p', { class: 'lwcs-tvm-message', role: 'status' }, state.mvuNotice) : null,
          state.searchBusy ? h('p', { class: 'lwcs-tvm-message', role: 'status' }, '正在检索…') : null,
          state.searchCapped ? h('p', { class: 'lwcs-tvm-message' }, '仅显示前 150 条匹配结果。') : null,
          h('div', { class: 'lwcs-tvm-grid-head' }, [h('span', null, '键名'), h('span', null, '类型'), h('span', null, '值 / 草稿差异'), h('span', null, '操作')]),
          h('div', { class: 'lwcs-tvm-tree-viewport', role: 'tree', 'aria-label': 'stat_data 变量树', 'aria-rowcount': rows.value.length,
            onScroll: event => { state.scrollTop = event.currentTarget.scrollTop; state.viewportHeight = event.currentTarget.clientHeight; } }, [
            start.value ? h('div', { style: { height: start.value * 32 + 'px' } }) : null,
            ...shown.map((row, index) => h(DataRow, { key: row.key, row, index: start.value + index, searchMode: !!state.searchQuery })),
            virtual.value && end.value < rows.value.length ? h('div', { style: { height: (rows.value.length - end.value) * 32 + 'px' } }) : null,
            !state.mvuLoading && !rows.value.length ? h('div', { class: 'lwcs-tvm-empty' }, state.searchQuery ? '没有匹配项' : 'stat_data 当前没有子项') : null,
          ]),
          h('footer', { class: 'lwcs-tvm-draft-bar' }, [
            h('div', null, [h('strong', null, isDirty.value ? draftList.value.length + ' 条路径草稿' : '无未保存草稿'),
              h('span', null, state.saveState === 'conflict' ? '检测到冲突，未覆盖 canonical' : '仅写入 stat_data；保存后逐路径回读')]),
            h('button', { type: 'button', disabled: !isDirty.value || state.mvuSaving, onClick: confirmDiscardDraft }, '丢弃全部'),
            h('button', { type: 'button', class: 'lwcs-tvm-primary lwcs-tvm-save', disabled: !isDirty.value || state.mvuSaving || state.mvuLoading, onClick: saveMvu },
              state.mvuSaving ? '保存中…' : '保存并回读'),
          ]),
          detailSheet(),
        ]);
      };
    },
  });
  const DatabasePage = defineComponent({
    name: 'LwcsTvmDatabasePage',
    setup() {
      return () => h('section', { class: 'lwcs-tvm-page', 'aria-labelledby': 'lwcs-tvm-db-title' }, [
        h('div', { class: 'lwcs-tvm-page-heading' }, [
          h('div', null, [
            h('h2', { id: 'lwcs-tvm-db-title' }, '数据库持久化'),
            h('p', null, '底层键只读，数据编辑请使用数据库编辑器。这里不会修改 raw head、index 或 frame。'),
          ]),
          h('div', { class: 'lwcs-tvm-actions' }, [
            h('button', { type: 'button', disabled: state.databaseLoading, onClick: refreshDatabase }, state.databaseLoading ? '读取中…' : '刷新键列表'),
            h('button', { class: 'lwcs-tvm-primary', type: 'button', onClick: openDatabaseEditor }, '打开数据库编辑器'),
          ]),
        ]),
        state.databaseError ? h('div', { class: 'lwcs-tvm-alert lwcs-tvm-alert-error', role: 'alert' }, state.databaseError) : null,
        h('div', { class: 'lwcs-tvm-db-meta' }, [
          h('div', null, [h('span', null, 'Backend'), h('strong', null, state.databaseBackend || '不可用')]),
          h('div', null, [h('span', null, 'Stable chat'), h('strong', { title: state.databaseStableChatId }, state.databaseStableChatId || '—')]),
          h('div', null, [h('span', null, 'Namespace'), h('strong', null, DATABASE_NAMESPACE)]),
          h('div', null, [h('span', null, '能力'), h('strong', null, state.databaseCapabilities?.verifiedWrite ? '已验证读写' : '不可用')]),
        ]),
        h('div', { class: 'lwcs-tvm-db-layout' }, [
          h('div', { class: 'lwcs-tvm-key-list', 'aria-label': '数据库底层键' }, [
            state.databaseLoading ? h('div', { class: 'lwcs-tvm-state' }, '正在读取键列表…') : null,
            !state.databaseLoading && state.databaseKeys.length === 0 ? h('div', { class: 'lwcs-tvm-state' }, '该 namespace 暂无键。') : null,
            ...state.databaseKeys.map(key => h('button', {
              key,
              type: 'button',
              'aria-pressed': String(state.databaseSelectedKey === key),
              class: state.databaseSelectedKey === key ? 'is-selected' : '',
              onClick: () => selectDatabaseKey(key),
            }, key)),
          ]),
          h('div', { class: 'lwcs-tvm-value-view' }, [
            h('div', { class: 'lwcs-tvm-value-title' }, state.databaseSelectedKey || '选择一个键查看只读值'),
            state.databaseValueLoading ? h('div', { class: 'lwcs-tvm-state' }, '读取中…') : null,
            !state.databaseValueLoading && state.databaseSelectedKey
              ? h('pre', { tabindex: '0' }, JSON.stringify(state.databaseSelectedValue, null, 2) ?? 'undefined')
              : null,
          ]),
        ]),
      ]);
    },
  });

  const DiagnosticsPage = defineComponent({
    name: 'LwcsTvmDiagnosticsPage',
    setup() {
      return () => h('section', { class: 'lwcs-tvm-page', 'aria-labelledby': 'lwcs-tvm-diag-title' }, [
        h('div', { class: 'lwcs-tvm-page-heading' }, [
          h('div', null, [
            h('h2', { id: 'lwcs-tvm-diag-title' }, '持久化诊断'),
            h('p', null, '只展示后端、会话和队列状态，不展示聊天内容、变量值或密钥。'),
          ]),
          h('button', { type: 'button', disabled: state.diagnosticLoading, onClick: refreshDiagnostics }, state.diagnosticLoading ? '读取中…' : '刷新诊断'),
        ]),
        state.diagnosticError ? h('div', { class: 'lwcs-tvm-alert lwcs-tvm-alert-error', role: 'alert' }, state.diagnosticError) : null,
        state.diagnostics ? h('div', { class: 'lwcs-tvm-diagnostic-grid' }, [
          ['MVU persistence', state.diagnostics.mvuPersistence],
          ['MVU provider', state.diagnostics.provider],
          ['Persistence adapter', state.diagnostics.adapter],
          ['Database session', state.diagnostics.database],
        ].map(([title, value]) => h('article', { class: 'lwcs-tvm-diagnostic-card', key: title }, [
          h('h3', null, title),
          h('pre', { tabindex: '0' }, JSON.stringify(value, null, 2)),
        ]))) : h('div', { class: 'lwcs-tvm-state' }, '暂无诊断状态。'),
      ]);
    },
  });

  const Root = defineComponent({
    name: 'LwcsTvmRoot',
    setup() {
      const tabs = [
        { id: 'mvu', label: 'MVU', detail: '编辑 canonical stat_data' },
        { id: 'database', label: '数据库', detail: '查看 TT-store 底层键' },
        { id: 'diagnostics', label: '诊断', detail: '检查持久化会话' },
      ];
      watch(() => state.activeTab, async tab => {
        if (tab === 'database' && !databaseSession) await refreshDatabase();
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
              h('h1', { id: 'lwcs-tvm-title' }, '数据检修台'),
              h('span', { class: 'lwcs-tvm-context' }, 'TT-store 变量管理'),
            ]),
            h('div', { class: 'lwcs-tvm-header-status', 'aria-live': 'polite' }, [
              h('span', { class: `lwcs-tvm-badge ${backendLabel.value === 'tt-store' ? 'is-online' : 'is-offline'}` }, backendLabel.value === 'tt-store' ? 'TT-store' : '不可用'),
              h('span', { class: 'lwcs-tvm-badge' }, `revision ${revisionLabel.value}`),
              h('span', { class: `lwcs-tvm-badge ${isDirty.value ? 'is-dirty' : ''}` }, isDirty.value ? '未保存' : '已同步'),
              h('button', { class: 'lwcs-tvm-close', type: 'button', 'aria-label': '关闭 TT-store 变量管理器', onClick: closeManager }, '×'),
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
'.lwcs-tvm-badge,.lwcs-tvm-backend,.lwcs-tvm-state{display:inline-flex;align-items:center;min-height:24px;padding:2px 7px;border:1px solid var(--line);border-radius:2px;color:var(--muted);background:#171819;font:11px/1.2 ui-monospace,Consolas,monospace;white-space:nowrap}.lwcs-tvm-badge.is-online,.lwcs-tvm-backend.is-online{color:var(--cyan);border-color:rgba(86,216,208,.4)}.lwcs-tvm-badge.is-offline{color:#ffc4ca}.lwcs-tvm-badge.is-dirty,.lwcs-tvm-state[data-state="draft"],.lwcs-tvm-state[data-state="editing"]{color:#ffc47a;border-color:rgba(243,154,50,.5)}.lwcs-tvm-state[data-state="conflict"],.lwcs-tvm-state[data-state="error"]{color:#ffc4ca;border-color:rgba(255,131,141,.55)}',
'.lwcs-tvm-overlay button,.lwcs-tvm-overlay input,.lwcs-tvm-overlay textarea,.lwcs-tvm-overlay select{font:inherit;color:inherit}.lwcs-tvm-overlay button{min-height:40px;padding:6px 10px;border:1px solid var(--line);border-radius:3px;background:var(--panel2);cursor:pointer;touch-action:manipulation}.lwcs-tvm-overlay button:hover{border-color:#5a5d60;background:#292b2d}.lwcs-tvm-overlay button:disabled{opacity:.44;cursor:not-allowed}.lwcs-tvm-overlay button:focus-visible,.lwcs-tvm-overlay input:focus-visible,.lwcs-tvm-overlay textarea:focus-visible,.lwcs-tvm-overlay select:focus-visible,.lwcs-tvm-row:focus-visible{outline:2px solid var(--orange);outline-offset:-2px}.lwcs-tvm-primary{color:#21160b;border-color:var(--orange);background:var(--orange);font-weight:750}.lwcs-tvm-close,.lwcs-tvm-icon-button{width:44px;min-width:44px;padding:0;background:transparent;font-size:21px}',
'.lwcs-tvm-workspace{min-height:0;flex:1;display:grid;grid-template-rows:42px minmax(0,1fr)}.lwcs-tvm-nav{display:flex;align-items:stretch;padding:0 10px;border-bottom:1px solid var(--line);background:#18191a}.lwcs-tvm-nav button{position:relative;min-height:42px;padding:4px 16px;border:0;border-radius:0;background:transparent}.lwcs-tvm-nav button span{display:none}.lwcs-tvm-nav button.is-active{color:#fff1df}.lwcs-tvm-nav button.is-active:after{content:"";position:absolute;inset:auto 10px 0;height:2px;background:var(--orange)}',
'.lwcs-tvm-main{min-width:0;min-height:0;overflow:hidden}.lwcs-tvm-page{height:100%;padding:12px 14px;overflow:auto}.lwcs-tvm-mvu-page{height:100%;min-height:0;display:grid;grid-template-rows:auto auto auto minmax(0,1fr) auto;overflow:hidden}',
'.lwcs-tvm-context-bar{display:grid;grid-template-columns:minmax(260px,auto) minmax(220px,1fr) auto;align-items:center;gap:8px;padding:8px 10px;border-bottom:2px solid var(--orange);background:#1a1c1d}.lwcs-tvm-context{flex-wrap:wrap}.lwcs-tvm-context strong{font-size:12px}.lwcs-tvm-search{min-width:0}.lwcs-tvm-search input{width:100%;height:36px;padding:6px 9px;border:1px solid var(--line);border-radius:2px;background:#111213}.lwcs-tvm-tree-tools{display:flex;gap:5px}.lwcs-tvm-tree-tools button{min-height:36px;padding:4px 8px;font-size:12px}',
'.lwcs-tvm-message{margin:0;padding:6px 10px;border-bottom:1px solid var(--soft);color:#dccdbb;background:#211e19;overflow-wrap:anywhere}.lwcs-tvm-message.is-error{color:#ffd0d5;background:#24191b}',
'.lwcs-tvm-grid-head,.lwcs-tvm-row{display:grid;grid-template-columns:minmax(180px,30%) 86px minmax(220px,1fr) 150px;align-items:center}.lwcs-tvm-grid-head{height:29px;padding:0 8px;border-bottom:1px solid var(--line);color:#85827e;background:#171819;font-size:10px;text-transform:uppercase;letter-spacing:.06em}.lwcs-tvm-tree-viewport{min-height:0;overflow:auto;background:#151617;scrollbar-gutter:stable}.lwcs-tvm-row{height:32px;padding:0 8px;border-bottom:1px solid #242628;background:#171819;outline:none}.lwcs-tvm-row:nth-child(even){background:#191a1b}.lwcs-tvm-row:hover,.lwcs-tvm-row:focus{background:#222426}.lwcs-tvm-row.is-draft{box-shadow:inset 2px 0 var(--orange)}.lwcs-tvm-row.is-verified{background:#18231e}',
'.lwcs-tvm-cell-key{min-width:0;height:100%;display:flex;align-items:center;padding-left:calc(var(--lwcs-tvm-depth) * 14px);background-image:repeating-linear-gradient(90deg,transparent 0,transparent 13px,rgba(255,255,255,.055) 13px,rgba(255,255,255,.055) 14px);background-size:calc(var(--lwcs-tvm-depth) * 14px) 100%;background-repeat:no-repeat}.lwcs-tvm-disclosure{width:28px;min-width:28px;min-height:28px;padding:0;border:0;background:transparent;color:var(--orange)}.lwcs-tvm-scalar-space{width:28px;min-width:28px}.lwcs-tvm-key-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 12px/1.2 ui-monospace,Consolas,monospace}.lwcs-tvm-type{color:#777a7c;font:10px/1 ui-monospace,Consolas,monospace}.lwcs-tvm-value-wrap{min-width:0;overflow:hidden}.lwcs-tvm-cell-value,.lwcs-tvm-old,.lwcs-tvm-new{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:12px/1.25 ui-monospace,Consolas,monospace}.lwcs-tvm-diff{min-width:0;display:grid;grid-template-columns:minmax(0,1fr) 18px minmax(0,1fr);align-items:center}.lwcs-tvm-old{color:#777;text-decoration:line-through}.lwcs-tvm-arrow{text-align:center;color:#806947}.lwcs-tvm-new{color:#ffc16b}.lwcs-tvm-breadcrumb-value{min-width:0;min-height:28px;padding:2px 5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left;border:0;background:transparent;color:#9b9690}',
'.lwcs-tvm-row-actions{display:flex;justify-content:flex-end;gap:3px}.lwcs-tvm-row-action{min-height:26px;padding:2px 6px;opacity:0;border-color:transparent;background:transparent;font-size:10px}.lwcs-tvm-row:hover .lwcs-tvm-row-action,.lwcs-tvm-row:focus-within .lwcs-tvm-row-action,.lwcs-tvm-row-action.lwcs-tvm-undo{opacity:1}.lwcs-tvm-undo{color:#ffc16b}.lwcs-tvm-inline-editor{display:flex;align-items:center;gap:4px}.lwcs-tvm-inline-input{min-width:0;width:100%;height:27px;padding:3px 6px;border:1px solid var(--orange);background:#101112}.lwcs-tvm-inline-editor button{min-height:27px;padding:2px 6px;font-size:10px}',
'.lwcs-tvm-draft-bar{min-height:54px;display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:8px;padding:7px 10px;border-top:1px solid var(--line);background:#1b1d1e}.lwcs-tvm-draft-bar div{display:flex;flex-direction:column;min-width:0}.lwcs-tvm-draft-bar span{color:var(--muted);font-size:11px}.lwcs-tvm-save{min-width:138px}.lwcs-tvm-empty{padding:28px;color:var(--muted);text-align:center}',
'.lwcs-tvm-mobile-crumbs{display:flex;gap:2px;overflow:auto;padding:5px 8px;border-bottom:1px solid var(--line);background:#18191a}.lwcs-tvm-mobile-crumbs button{min-height:34px;padding:3px 8px;white-space:nowrap;background:transparent}.lwcs-tvm-mobile-crumbs button:after{content:"›";margin-left:8px;color:#6d6964}.lwcs-tvm-mobile-crumbs button.is-current{color:#ffc16b}.lwcs-tvm-mobile-crumbs button.is-current:after{content:""}',
'.lwcs-tvm-sheet-backdrop{position:fixed;inset:0;z-index:3;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.58)}.lwcs-tvm-detail-sheet{width:min(720px,100%);max-height:min(82dvh,var(--lwcs-tvm-visual-height,82dvh));display:grid;grid-template-rows:auto minmax(0,1fr) auto;border:1px solid var(--line);border-bottom:0;background:#1a1c1d;animation:lwcs-tvm-sheet-in .2s ease-out}.lwcs-tvm-detail-sheet header,.lwcs-tvm-detail-sheet footer{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 12px;border-bottom:1px solid var(--line)}.lwcs-tvm-detail-sheet footer{justify-content:flex-end;border-top:1px solid var(--line);border-bottom:0;padding-bottom:calc(9px + env(safe-area-inset-bottom))}.lwcs-tvm-detail-sheet h3,.lwcs-tvm-detail-sheet p{margin:0}.lwcs-tvm-detail-sheet p{max-width:560px;color:var(--muted);overflow-wrap:anywhere}.lwcs-tvm-kicker{color:#8d8984;font:10px/1 monospace}.lwcs-tvm-detail-body{min-height:0;display:flex;flex-direction:column;gap:8px;overflow:auto;padding:12px}.lwcs-tvm-detail-body select{width:140px;height:40px;padding:6px;border:1px solid var(--line);background:#111213}.lwcs-tvm-detail-input{width:100%;min-height:180px;resize:vertical;padding:9px;border:1px solid var(--line);background:#111213;font:12px/1.45 ui-monospace,Consolas,monospace;overflow-wrap:anywhere}.lwcs-tvm-boolean-toggle{min-height:48px;color:#ffc16b}.lwcs-tvm-original-block{min-width:0;color:var(--muted)}.lwcs-tvm-original-block pre{max-height:180px;margin:5px 0 0;padding:8px;overflow:auto;border:1px solid var(--soft);background:#121314;color:#aaa;white-space:pre-wrap;overflow-wrap:anywhere}',
'.lwcs-tvm-page-heading{display:flex;justify-content:space-between;gap:12px;margin-bottom:9px;padding-bottom:9px;border-bottom:1px solid var(--soft)}.lwcs-tvm-page-heading h2{margin:0;font-size:16px}.lwcs-tvm-page-heading p{margin:2px 0;color:var(--muted)}.lwcs-tvm-alert,.lwcs-tvm-field-error{margin:7px 0;padding:7px 9px;border-left:2px solid var(--orange);background:#211e19;overflow-wrap:anywhere}.lwcs-tvm-alert-error,.lwcs-tvm-field-error{border-color:var(--danger);color:#ffd0d5}.lwcs-tvm-state{padding:18px;color:var(--muted)}',
'.lwcs-tvm-db-meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;margin-bottom:8px;border:1px solid var(--line);background:var(--line)}.lwcs-tvm-db-meta div{min-width:0;padding:7px 9px;background:var(--panel)}.lwcs-tvm-db-meta span{display:block;color:var(--muted);font-size:10px}.lwcs-tvm-db-meta strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lwcs-tvm-db-layout{min-height:400px;display:grid;grid-template-columns:minmax(190px,28%) minmax(0,1fr);border:1px solid var(--line)}.lwcs-tvm-key-list{overflow:auto;padding:5px;border-right:1px solid var(--line)}.lwcs-tvm-key-list button{width:100%;display:block;margin-bottom:3px;text-align:left;overflow-wrap:anywhere}.lwcs-tvm-key-list button.is-selected{border-color:var(--orange)}.lwcs-tvm-value-view{min-width:0;overflow:auto;padding:9px}.lwcs-tvm-value-view pre,.lwcs-tvm-diagnostic-card pre{margin:0;padding:8px;overflow:auto;border:1px solid var(--soft);background:#111213;white-space:pre-wrap;overflow-wrap:anywhere}.lwcs-tvm-diagnostic-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.lwcs-tvm-diagnostic-card{min-width:0;padding:8px;border:1px solid var(--line);background:var(--panel)}.lwcs-tvm-diagnostic-card h3{margin:0 0 6px}.lwcs-tvm-sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}',
'@keyframes lwcs-tvm-sheet-in{from{transform:translateY(18px);opacity:.7}to{transform:none;opacity:1}}',
'@media(max-width:899px){.lwcs-tvm-overlay{padding:0}.lwcs-tvm-shell{width:100%;height:100dvh;border-radius:0;border-inline:0}.lwcs-tvm-context-bar{grid-template-columns:minmax(180px,1fr) minmax(180px,1fr);}.lwcs-tvm-tree-tools{grid-column:1/-1}.lwcs-tvm-grid-head,.lwcs-tvm-row{grid-template-columns:minmax(140px,30%) 64px minmax(160px,1fr) 118px}.lwcs-tvm-page{padding:10px}.lwcs-tvm-header-status .lwcs-tvm-badge:nth-child(2){display:none}}',
'@media(max-width:599px){.lwcs-tvm-header{height:48px}.lwcs-tvm-title-group .lwcs-tvm-context,.lwcs-tvm-header-status{display:none}.lwcs-tvm-workspace{grid-template-rows:44px minmax(0,1fr)}.lwcs-tvm-nav{padding:0}.lwcs-tvm-nav button{flex:1;min-height:44px;padding:4px}.lwcs-tvm-main{overflow:hidden}.lwcs-tvm-context-bar{grid-template-columns:1fr;padding:7px 8px}.lwcs-tvm-context{overflow:auto;flex-wrap:nowrap}.lwcs-tvm-tree-tools{display:grid;grid-template-columns:repeat(3,1fr)}.lwcs-tvm-tree-tools button{min-height:44px}.lwcs-tvm-grid-head{display:none}.lwcs-tvm-mvu-page{grid-template-rows:auto auto auto minmax(0,1fr) auto}.lwcs-tvm-tree-viewport{padding-bottom:0}.lwcs-tvm-row{height:auto;min-height:48px;grid-template-columns:minmax(90px,34%) 48px minmax(0,1fr);padding:0 7px}.lwcs-tvm-row-actions{display:none}.lwcs-tvm-cell-key{padding-left:0;background:none}.lwcs-tvm-disclosure{width:44px;min-width:44px;min-height:44px}.lwcs-tvm-scalar-space{display:none}.lwcs-tvm-cell-value,.lwcs-tvm-old,.lwcs-tvm-new{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}.lwcs-tvm-breadcrumb-value{min-height:44px}.lwcs-tvm-draft-bar{grid-template-columns:1fr auto;padding-bottom:calc(7px + env(safe-area-inset-bottom));background:#1a1c1d}.lwcs-tvm-draft-bar div{grid-column:1/-1}.lwcs-tvm-save{min-width:0}.lwcs-tvm-db-meta,.lwcs-tvm-diagnostic-grid{grid-template-columns:1fr}.lwcs-tvm-db-layout{grid-template-columns:1fr;grid-template-rows:minmax(150px,34%) minmax(200px,1fr)}.lwcs-tvm-key-list{border-right:0;border-bottom:1px solid var(--line)}}',
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
    searchGeneration += 1;
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
      });
    },
  });

  hostWindow[API_KEY] = publicApi;
})(typeof globalThis !== 'undefined' ? globalThis : window);

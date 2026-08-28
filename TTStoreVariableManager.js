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
    mvuView: 'tree',
    search: '',
    expanded: new Set(['$']),
    snapshot: null,
    draft: null,
    jsonText: '',
    jsonError: '',
    mvuLoading: false,
    mvuSaving: false,
    mvuError: '',
    mvuNotice: '',
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

  const isDirty = computed(() => {
    if (state.jsonError) return true;
    if (!state.snapshot || state.draft === null) return false;
    return canonicalJson(state.snapshot.stat_data) !== canonicalJson(state.draft);
  });

  const revisionLabel = computed(() => {
    const direct = state.snapshot?.revision ?? state.snapshot?._revision;
    if (direct !== undefined && direct !== null) return String(direct);
    const statuses = state.diagnostics?.mvuPersistence;
    const sessions = Array.isArray(statuses) ? statuses : statuses?.sessions;
    const revision = sessions?.find(item => item?.head?.revision !== undefined)?.head?.revision;
    return revision === undefined ? '—' : String(revision);
  });

  const backendLabel = computed(() => {
    const fromDatabase = state.databaseBackend;
    const statuses = state.diagnostics?.mvuPersistence;
    const sessions = Array.isArray(statuses) ? statuses : statuses?.sessions;
    const fromMvu = sessions?.find(item => item?.backend)?.backend;
    return fromMvu || fromDatabase || '不可用';
  });

  function setMvuView(view) {
    state.mvuView = view;
    if (view === 'json') {
      state.jsonText = JSON.stringify(state.draft ?? {}, null, 2);
      state.jsonError = '';
    }
  }

  function updateJsonDraft(text) {
    state.jsonText = text;
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('stat_data 必须是 JSON 对象');
      }
      state.draft = parsed;
      state.jsonError = '';
    } catch (error) {
      state.jsonError = errorText(error);
    }
  }

  function updateDraft(path, value) {
    state.draft = replaceAtPath(state.draft, path, value);
    state.jsonText = JSON.stringify(state.draft, null, 2);
    state.jsonError = '';
    state.mvuNotice = '';
  }

  function discardDraft() {
    if (!state.snapshot) return;
    state.draft = cloneJson(state.snapshot.stat_data || {});
    state.jsonText = JSON.stringify(state.draft, null, 2);
    state.jsonError = '';
    state.mvuNotice = '已丢弃未保存修改。';
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
    return readCanonicalHotMvu(mvu);
  }

  async function refreshMvu(options = {}) {
    if (isDirty.value && options.discard !== true) {
      state.mvuNotice = '存在未保存草稿。请先保存或点击“丢弃”，刷新不会覆盖当前草稿。';
      return false;
    }
    state.mvuLoading = true;
    state.mvuError = '';
    state.mvuNotice = '';
    try {
      const data = await readCanonicalMvu();
      state.snapshot = data;
      state.draft = cloneJson(data.stat_data);
      state.jsonText = JSON.stringify(state.draft, null, 2);
      state.jsonError = '';
      return true;
    } catch (error) {
      state.mvuError = errorText(error);
      return false;
    } finally {
      state.mvuLoading = false;
    }
  }

  async function saveMvu() {
    if (state.mvuSaving || !state.snapshot) return false;
    if (state.mvuView === 'json') updateJsonDraft(state.jsonText);
    if (state.jsonError) {
      state.mvuError = `JSON 无法保存：${state.jsonError}`;
      return false;
    }
    state.mvuSaving = true;
    state.mvuError = '';
    state.mvuNotice = '';
    try {
      const intendedStatData = cloneJson(state.draft);
      const nextData = { ...cloneJson(state.snapshot), stat_data: intendedStatData };
      const mvu = hostWindow.Mvu || currentWindow.Mvu;
      if (typeof mvu?.replaceMvuData !== 'function') throw new Error('Mvu.replaceMvuData 不可用');
      await mvu.replaceMvuData(nextData, { type: 'chat' });
      if (typeof mvu.persistence?.awaitIdle === 'function') await mvu.persistence.awaitIdle();
      const confirmed = readCanonicalHotMvu(mvu);
      if (canonicalJson(confirmed.stat_data) !== canonicalJson(intendedStatData)) {
        throw new Error('TT-store 写后回读不一致，未接受本次保存结果');
      }
      state.snapshot = confirmed;
      state.draft = cloneJson(confirmed.stat_data);
      state.jsonText = JSON.stringify(state.draft, null, 2);
      state.jsonError = '';
      state.mvuNotice = '已保存并完成 TT-store 回读确认。';
      await refreshDiagnostics();
      return true;
    } catch (error) {
      state.mvuError = errorText(error);
      return false;
    } finally {
      state.mvuSaving = false;
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
      closeManager();
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
    state.visible = true;
    hostWindow.document.addEventListener('keydown', handleGlobalKeydown, true);
    await nextTick();
    rootElement?.querySelector('.lwcs-tvm-close')?.focus();
    await refreshActive();
    if (destroyed || !state.visible) return;
    if (state.activeTab !== 'diagnostics') await refreshDiagnostics();
  }

  function closeManager() {
    state.visible = false;
    hostWindow.document.removeEventListener('keydown', handleGlobalKeydown, true);
    const target = openerElement;
    openerElement = null;
    if (target?.isConnected && typeof target.focus === 'function') target.focus();
  }

  const TreeNode = defineComponent({
    name: 'LwcsTvmTreeNode',
    props: {
      nodeValue: { required: true },
      nodeKey: { type: [String, Number], required: true },
      path: { type: Array, required: true },
      depth: { type: Number, required: true },
      query: { type: String, default: '' },
      expanded: { type: Object, required: true },
    },
    emits: ['update-value', 'toggle'],
    setup(props, { emit }) {
      const kind = computed(() => valueKind(props.nodeValue));
      const key = computed(() => pathKey(props.path));
      const children = computed(() => {
        if (!props.nodeValue || typeof props.nodeValue !== 'object') return [];
        return Object.keys(props.nodeValue).map(childKey => ({
          key: childKey,
          value: props.nodeValue[childKey],
          path: [...props.path, Array.isArray(props.nodeValue) ? Number(childKey) : childKey],
        }));
      });
      const matches = computed(() => {
        const query = props.query.trim().toLocaleLowerCase('zh-CN');
        if (!query) return true;
        const own = `${props.nodeKey} ${shortValue(props.nodeValue)}`.toLocaleLowerCase('zh-CN');
        if (own.includes(query)) return true;
        const scan = value => {
          if (!value || typeof value !== 'object') return String(value).toLocaleLowerCase('zh-CN').includes(query);
          return Object.entries(value).some(([childKey, childValue]) => String(childKey).toLocaleLowerCase('zh-CN').includes(query) || scan(childValue));
        };
        return scan(props.nodeValue);
      });

      function changeKind(event) {
        const nextKind = event.target.value;
        const defaults = { string: '', number: 0, boolean: false, null: null };
        emit('update-value', props.path, defaults[nextKind]);
      }

      function leafEditor() {
        const typeSelect = h('select', {
          class: 'lwcs-tvm-type-select',
          'aria-label': `${String(props.nodeKey)} 的数据类型`,
          value: kind.value,
          onChange: changeKind,
        }, ['string', 'number', 'boolean', 'null'].map(type => h('option', { value: type }, type)));
        let editor = null;
        if (kind.value === 'string') {
          const isLong = props.nodeValue.length > 90 || props.nodeValue.includes('\n');
          const tag = isLong ? 'textarea' : 'input';
          editor = h(tag, {
            class: isLong ? 'lwcs-tvm-leaf-textarea' : 'lwcs-tvm-leaf-input',
            value: props.nodeValue,
            rows: isLong ? 4 : undefined,
            autocomplete: 'off',
            spellcheck: 'false',
            'aria-label': `${String(props.nodeKey)} 的值`,
            onInput: event => emit('update-value', props.path, event.target.value),
          });
        } else if (kind.value === 'number') {
          editor = h('input', {
            class: 'lwcs-tvm-leaf-input',
            type: 'number',
            value: props.nodeValue,
            autocomplete: 'off',
            'aria-label': `${String(props.nodeKey)} 的数值`,
            onChange: event => {
              const number = Number(event.target.value);
              if (Number.isFinite(number)) emit('update-value', props.path, number);
            },
          });
        } else if (kind.value === 'boolean') {
          editor = h('select', {
            class: 'lwcs-tvm-leaf-input',
            value: String(props.nodeValue),
            'aria-label': `${String(props.nodeKey)} 的布尔值`,
            onChange: event => emit('update-value', props.path, event.target.value === 'true'),
          }, [h('option', { value: 'true' }, 'true'), h('option', { value: 'false' }, 'false')]);
        } else {
          editor = h('span', { class: 'lwcs-tvm-null-value' }, 'null');
        }
        return h('div', { class: 'lwcs-tvm-leaf-editor' }, [typeSelect, editor]);
      }

      return () => {
        if (!matches.value) return null;
        const compound = kind.value === 'object' || kind.value === 'array';
        const open = props.query.trim() ? true : props.expanded.has(key.value);
        return h('div', {
          class: 'lwcs-tvm-tree-node',
          role: 'treeitem',
          'aria-level': props.depth + 1,
          'aria-expanded': compound ? String(open) : undefined,
          'data-path': key.value,
        }, [
          h('div', {
            class: 'lwcs-tvm-tree-row',
            style: { '--lwcs-tvm-depth': Math.min(props.depth, 12) },
          }, [
            compound
              ? h('button', {
                class: 'lwcs-tvm-disclosure',
                type: 'button',
                'aria-expanded': String(open),
                'aria-label': `${open ? '折叠' : '展开'} ${String(props.nodeKey)}`,
                onClick: () => emit('toggle', key.value),
              }, open ? '−' : '+')
              : h('span', { class: 'lwcs-tvm-leaf-dot', 'aria-hidden': 'true' }, '•'),
            h('span', { class: 'lwcs-tvm-node-key', title: String(props.nodeKey) }, String(props.nodeKey)),
            h('span', { class: `lwcs-tvm-kind lwcs-tvm-kind-${kind.value}` }, kind.value),
            compound
              ? h('span', { class: 'lwcs-tvm-node-summary' }, shortValue(props.nodeValue))
              : leafEditor(),
          ]),
          compound && open
            ? h('div', { class: 'lwcs-tvm-tree-children', role: 'group' }, children.value.length > 0
              ? children.value.map(child => h(TreeNode, {
                key: pathKey(child.path),
                nodeValue: child.value,
                nodeKey: child.key,
                path: child.path,
                depth: props.depth + 1,
                query: props.query,
                expanded: props.expanded,
                onUpdateValue: (path, value) => emit('update-value', path, value),
                onToggle: childPath => emit('toggle', childPath),
              }))
              : [h('div', { class: 'lwcs-tvm-empty-node', style: { '--lwcs-tvm-depth': Math.min(props.depth + 1, 12) } }, kind.value === 'array' ? '空数组 []' : '空对象 {}')])
            : null,
        ]);
      };
    },
  });

  const MvuPage = defineComponent({
    name: 'LwcsTvmMvuPage',
    setup() {
      function toggle(path) {
        if (state.expanded.has(path)) state.expanded.delete(path);
        else state.expanded.add(path);
      }
      function expandAll() {
        const visit = (value, path) => {
          if (!value || typeof value !== 'object') return;
          state.expanded.add(pathKey(path));
          Object.keys(value).forEach(key => visit(value[key], [...path, Array.isArray(value) ? Number(key) : key]));
        };
        visit(state.draft, []);
      }
      return () => h('section', { class: 'lwcs-tvm-page', 'aria-labelledby': 'lwcs-tvm-mvu-title' }, [
        h('div', { class: 'lwcs-tvm-page-heading' }, [
          h('div', null, [
            h('h2', { id: 'lwcs-tvm-mvu-title' }, 'MVU canonical 变量'),
            h('p', null, '仅编辑 stat_data；schema 与其他顶层元数据保持只读并随保存原样保留。'),
          ]),
          h('div', { class: 'lwcs-tvm-actions' }, [
            h('button', { type: 'button', disabled: state.mvuLoading || state.mvuSaving, onClick: () => refreshMvu() }, state.mvuLoading ? '读取中…' : '刷新'),
            h('button', { class: 'lwcs-tvm-danger-action', type: 'button', disabled: !isDirty.value || state.mvuSaving, onClick: confirmDiscardDraft }, '丢弃草稿'),
            h('button', { class: 'lwcs-tvm-primary', type: 'button', disabled: !isDirty.value || state.mvuSaving || !!state.jsonError, onClick: saveMvu }, state.mvuSaving ? '保存中…' : '保存并回读'),
          ]),
        ]),
        state.mvuError ? h('div', { class: 'lwcs-tvm-alert lwcs-tvm-alert-error', role: 'alert' }, state.mvuError) : null,
        state.mvuNotice ? h('div', { class: 'lwcs-tvm-alert', role: 'status' }, state.mvuNotice) : null,
        state.snapshot ? h('div', { class: 'lwcs-tvm-mvu-tools' }, [
          h('div', { class: 'lwcs-tvm-segment', role: 'group', 'aria-label': 'MVU 查看方式' }, [
            h('button', { type: 'button', 'aria-pressed': String(state.mvuView === 'tree'), onClick: () => setMvuView('tree') }, '树形'),
            h('button', { type: 'button', 'aria-pressed': String(state.mvuView === 'json'), onClick: () => setMvuView('json') }, 'JSON'),
          ]),
          state.mvuView === 'tree' ? h('label', { class: 'lwcs-tvm-search' }, [
            h('span', null, '搜索'),
            h('input', { type: 'search', name: 'lwcs-tvm-search', autocomplete: 'off', value: state.search, placeholder: '键、路径或值…', onInput: event => { state.search = event.target.value; } }),
          ]) : null,
          state.mvuView === 'tree' ? h('div', { class: 'lwcs-tvm-actions lwcs-tvm-actions-compact' }, [
            h('button', { type: 'button', onClick: expandAll }, '全部展开'),
            h('button', { type: 'button', onClick: () => { state.expanded = new Set(['$']); } }, '全部折叠'),
          ]) : null,
        ]) : null,
        state.snapshot ? h('details', { class: 'lwcs-tvm-readonly-meta' }, [
          h('summary', null, '查看只读顶层元数据（含 schema）'),
          h('pre', { tabindex: '0' }, JSON.stringify(
            Object.fromEntries(Object.entries(state.snapshot).filter(([key]) => key !== 'stat_data')),
            null,
            2,
          )),
        ]) : null,
        state.mvuLoading && !state.snapshot ? h('div', { class: 'lwcs-tvm-state' }, '正在读取 TT-store canonical 快照…') : null,
        !state.mvuLoading && !state.snapshot && !state.mvuError ? h('div', { class: 'lwcs-tvm-state' }, '暂无可显示的 MVU 数据。') : null,
        state.snapshot && state.mvuView === 'tree' ? h('div', { class: 'lwcs-tvm-tree', role: 'tree', 'aria-label': 'stat_data 树形编辑器' }, [
          Object.keys(state.draft || {}).length > 0
            ? Object.keys(state.draft).map(key => h(TreeNode, {
              key: pathKey([key]),
              nodeValue: state.draft[key],
              nodeKey: key,
              path: [key],
              depth: 0,
              query: state.search,
              expanded: state.expanded,
              onUpdateValue: updateDraft,
              onToggle: toggle,
            }))
            : h('div', { class: 'lwcs-tvm-state' }, 'stat_data 是空对象。'),
        ]) : null,
        state.snapshot && state.mvuView === 'json' ? h('div', { class: 'lwcs-tvm-json-editor' }, [
          h('label', { for: 'lwcs-tvm-json-input' }, 'stat_data JSON 草稿'),
          h('textarea', {
            id: 'lwcs-tvm-json-input',
            name: 'lwcs-tvm-json-input',
            autocomplete: 'off',
            spellcheck: 'false',
            value: state.jsonText,
            'aria-invalid': String(!!state.jsonError),
            'aria-describedby': state.jsonError ? 'lwcs-tvm-json-error' : undefined,
            onInput: event => updateJsonDraft(event.target.value),
          }),
          state.jsonError ? h('div', { id: 'lwcs-tvm-json-error', class: 'lwcs-tvm-field-error', role: 'alert' }, state.jsonError) : null,
        ]) : null,
      ]);
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
    styleElement.textContent = `
.lwcs-tvm-overlay, .lwcs-tvm-overlay * { box-sizing: border-box; }
.lwcs-tvm-overlay {
  --lwcs-tvm-bg: #141516; --lwcs-tvm-panel: #1b1d1f; --lwcs-tvm-panel-2: #232527;
  --lwcs-tvm-border: #35383b; --lwcs-tvm-border-soft: #292c2e; --lwcs-tvm-text: #eeeae4;
  --lwcs-tvm-muted: #a29e98; --lwcs-tvm-orange: #f39a32; --lwcs-tvm-orange-soft: rgba(243,154,50,.12);
  --lwcs-tvm-cyan: #55d8d0; --lwcs-tvm-danger: #ff7f8b;
  position: fixed; inset: 0; z-index: 2147482000; display: grid; place-items: center; color-scheme: dark;
  padding: clamp(10px, 2vw, 22px); color: var(--lwcs-tvm-text); background: rgba(6,7,8,.78);
  overscroll-behavior: contain; font: 13px/1.4 system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
}
.lwcs-tvm-shell { width: min(1120px, 100%); height: min(760px, calc(100dvh - 28px)); min-height: 420px;
  display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--lwcs-tvm-border);
  border-radius: 7px; background: var(--lwcs-tvm-bg); box-shadow: 0 20px 64px rgba(0,0,0,.52); }
.lwcs-tvm-header { height: 56px; min-height: 56px; display: flex; align-items: center; justify-content: space-between; gap: 14px;
  padding: 0 10px 0 16px; border-bottom: 1px solid var(--lwcs-tvm-border); background: #1c1e20; }
.lwcs-tvm-title-group { min-width: 0; display: flex; align-items: baseline; gap: 10px; white-space: nowrap; }
.lwcs-tvm-title-group h1 { margin: 0; font-size: 17px; line-height: 1; letter-spacing: .02em; }
.lwcs-tvm-context { color: var(--lwcs-tvm-muted); font-size: 12px; }
.lwcs-tvm-header-status, .lwcs-tvm-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.lwcs-tvm-header-status { min-width: 0; flex-wrap: nowrap; }
.lwcs-tvm-badge { min-height: 26px; display: inline-flex; align-items: center; padding: 3px 8px; border: 1px solid var(--lwcs-tvm-border);
  border-radius: 3px; color: var(--lwcs-tvm-muted); background: #171819; font: 11px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace; white-space: nowrap; }
.lwcs-tvm-badge.is-online { color: var(--lwcs-tvm-cyan); border-color: rgba(85,216,208,.45); }
.lwcs-tvm-badge.is-offline { color: #ffc0c8; border-color: #87424a; }
.lwcs-tvm-badge.is-dirty { color: #ffc77f; border-color: rgba(243,154,50,.58); }
.lwcs-tvm-overlay button, .lwcs-tvm-overlay input, .lwcs-tvm-overlay textarea, .lwcs-tvm-overlay select { font: inherit; color: inherit; }
.lwcs-tvm-overlay button { min-height: 44px; border: 1px solid var(--lwcs-tvm-border); border-radius: 4px; padding: 7px 11px;
  background: var(--lwcs-tvm-panel-2); cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: rgba(243,154,50,.18);
  transition: border-color .14s ease, background-color .14s ease, color .14s ease; }
.lwcs-tvm-overlay button:hover { border-color: #66625d; background: #2b2d2f; }
.lwcs-tvm-overlay button:active { background: #343638; }
.lwcs-tvm-overlay button:disabled { opacity: .46; cursor: not-allowed; }
.lwcs-tvm-overlay button:focus-visible, .lwcs-tvm-overlay input:focus-visible, .lwcs-tvm-overlay textarea:focus-visible, .lwcs-tvm-overlay select:focus-visible {
  outline: 2px solid var(--lwcs-tvm-orange); outline-offset: 2px; }
.lwcs-tvm-close { width: 44px; min-width: 44px; padding: 0; border-color: transparent; background: transparent; font-size: 23px; line-height: 1; }
.lwcs-tvm-primary { color: #21160b; border-color: var(--lwcs-tvm-orange); background: var(--lwcs-tvm-orange); font-weight: 750; }
.lwcs-tvm-primary:hover { border-color: #ffb357; background: #ffad4b; }
.lwcs-tvm-danger-action { color: #ffc0c8; border-color: #87424a; background: rgba(255,127,139,.08); }
.lwcs-tvm-danger-action:hover { border-color: var(--lwcs-tvm-danger); background: rgba(255,127,139,.14); }
.lwcs-tvm-workspace { min-height: 0; flex: 1; display: grid; grid-template-columns: 176px minmax(0,1fr); }
.lwcs-tvm-nav { padding: 8px 0; border-right: 1px solid var(--lwcs-tvm-border); background: #18191a; overflow: auto; }
.lwcs-tvm-nav button { position: relative; width: 100%; min-height: 52px; display: flex; flex-direction: column; align-items: flex-start; justify-content: center;
  gap: 1px; padding: 6px 12px 6px 16px; border: 0; border-radius: 0; text-align: left; background: transparent; }
.lwcs-tvm-nav button strong { font-size: 13px; }.lwcs-tvm-nav button span { color: var(--lwcs-tvm-muted); font-size: 11px; }
.lwcs-tvm-nav button.is-active { color: #fff3e5; background: var(--lwcs-tvm-orange-soft); }
.lwcs-tvm-nav button.is-active::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 3px; background: var(--lwcs-tvm-orange); }
.lwcs-tvm-main { min-width: 0; min-height: 0; overflow: auto; background: var(--lwcs-tvm-bg); }
.lwcs-tvm-page { min-height: 100%; padding: 14px 16px 18px; }
.lwcs-tvm-page-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--lwcs-tvm-border-soft); }
.lwcs-tvm-page-heading h2 { margin: 0; font-size: 17px; }.lwcs-tvm-page-heading p { max-width: 680px; margin: 2px 0 0; color: var(--lwcs-tvm-muted); font-size: 12px; }
.lwcs-tvm-alert { margin: 8px 0; padding: 8px 10px; border-left: 3px solid var(--lwcs-tvm-orange); border-radius: 2px; background: var(--lwcs-tvm-orange-soft); overflow-wrap: anywhere; }
.lwcs-tvm-alert-error, .lwcs-tvm-field-error { color: #ffd2d8; border-color: var(--lwcs-tvm-danger); background: rgba(255,128,144,.10); }
.lwcs-tvm-state { padding: 18px 12px; color: var(--lwcs-tvm-muted); text-align: center; overflow-wrap: anywhere; }
.lwcs-tvm-mvu-tools { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
.lwcs-tvm-segment { display: inline-flex; border: 1px solid var(--lwcs-tvm-border); border-radius: 4px; overflow: hidden; }
.lwcs-tvm-segment button { min-height: 44px; border: 0; border-radius: 0; background: transparent; }
.lwcs-tvm-segment button + button { border-left: 1px solid var(--lwcs-tvm-border); }
.lwcs-tvm-segment button[aria-pressed="true"] { color: #21160b; background: var(--lwcs-tvm-orange); }
.lwcs-tvm-search { flex: 1 1 220px; display: flex; align-items: center; gap: 7px; color: var(--lwcs-tvm-muted); }
.lwcs-tvm-search input, .lwcs-tvm-leaf-input, .lwcs-tvm-leaf-textarea, .lwcs-tvm-type-select, .lwcs-tvm-json-editor textarea {
  min-width: 0; border: 1px solid var(--lwcs-tvm-border); border-radius: 3px; background: #111213; }
.lwcs-tvm-search input { width: 100%; min-height: 42px; padding: 7px 9px; }
.lwcs-tvm-actions-compact button { padding: 5px 9px; }
.lwcs-tvm-tree { overflow: auto; border: 1px solid var(--lwcs-tvm-border); border-radius: 3px; background: #171819; }
.lwcs-tvm-tree-row { min-width: 620px; min-height: 44px; display: grid; grid-template-columns: 44px minmax(128px,210px) 62px minmax(240px,1fr); align-items: start;
  gap: 6px; padding-inline-start: calc(var(--lwcs-tvm-depth) * 14px); padding-inline-end: 7px; border-bottom: 1px solid var(--lwcs-tvm-border-soft); }
.lwcs-tvm-tree-row:hover { background: rgba(255,255,255,.018); }
.lwcs-tvm-disclosure { min-width: 44px; width: 44px; min-height: 44px; padding: 0; border: 0; border-radius: 0; background: transparent; color: var(--lwcs-tvm-orange); }
.lwcs-tvm-leaf-dot { width: 44px; padding-top: 12px; text-align: center; color: #6f6c68; }
.lwcs-tvm-node-key { padding-top: 12px; font: 600 12px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace; overflow-wrap: anywhere; }
.lwcs-tvm-node-summary { padding-top: 12px; color: var(--lwcs-tvm-muted); font: 12px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace; }
.lwcs-tvm-kind { align-self: start; margin-top: 10px; padding: 2px 5px; border-radius: 2px; color: #beb9b2; background: #292b2d; font: 10px/1.3 ui-monospace,SFMono-Regular,Consolas,monospace; text-align: center; }
.lwcs-tvm-leaf-editor { min-width: 0; display: grid; grid-template-columns: 80px minmax(0,1fr); gap: 6px; padding: 4px 0; }
.lwcs-tvm-type-select, .lwcs-tvm-leaf-input { min-height: 36px; padding: 4px 6px; }
.lwcs-tvm-leaf-textarea { width: 100%; min-height: 64px; resize: vertical; padding: 6px; line-height: 1.4; }
.lwcs-tvm-null-value { padding-top: 9px; color: #d7a8f4; font-family: ui-monospace,SFMono-Regular,Consolas,monospace; }
.lwcs-tvm-empty-node { min-width: 620px; padding-block: 8px; padding-inline-start: calc(var(--lwcs-tvm-depth) * 14px); color: var(--lwcs-tvm-muted); }
.lwcs-tvm-json-editor label { display: block; margin-bottom: 6px; font-weight: 700; }
.lwcs-tvm-readonly-meta { margin: 8px 0; border: 1px solid var(--lwcs-tvm-border); border-radius: 3px; background: var(--lwcs-tvm-panel); }
.lwcs-tvm-readonly-meta summary { min-height: 44px; padding: 11px 10px; cursor: pointer; color: var(--lwcs-tvm-muted); }
.lwcs-tvm-readonly-meta pre { max-height: 250px; margin: 0; padding: 10px; overflow: auto; border-top: 1px solid var(--lwcs-tvm-border); background: #111213; color: #ddd8d1; white-space: pre-wrap; overflow-wrap: anywhere; }
.lwcs-tvm-json-editor textarea { width: 100%; min-height: 430px; padding: 10px; resize: vertical; font: 12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace; tab-size: 2; }
.lwcs-tvm-field-error { margin-top: 6px; padding: 7px 9px; border-left: 3px solid; border-radius: 2px; }
.lwcs-tvm-db-meta { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 1px; margin-bottom: 10px; border: 1px solid var(--lwcs-tvm-border); background: var(--lwcs-tvm-border); }
.lwcs-tvm-db-meta div { min-width: 0; padding: 8px 10px; background: var(--lwcs-tvm-panel); }
.lwcs-tvm-db-meta span { display: block; color: var(--lwcs-tvm-muted); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
.lwcs-tvm-db-meta strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lwcs-tvm-db-layout { min-height: 410px; display: grid; grid-template-columns: minmax(190px,28%) minmax(0,1fr); overflow: hidden; border: 1px solid var(--lwcs-tvm-border); border-radius: 3px; }
.lwcs-tvm-key-list { overflow: auto; padding: 5px; border-right: 1px solid var(--lwcs-tvm-border); background: #171819; }
.lwcs-tvm-key-list button { width: 100%; display: block; margin-bottom: 3px; text-align: left; overflow-wrap: anywhere; background: transparent; }
.lwcs-tvm-key-list button.is-selected { border-color: rgba(243,154,50,.55); background: var(--lwcs-tvm-orange-soft); }
.lwcs-tvm-value-view { min-width: 0; overflow: auto; padding: 10px; }
.lwcs-tvm-value-title { margin-bottom: 7px; color: var(--lwcs-tvm-muted); overflow-wrap: anywhere; }
.lwcs-tvm-value-view pre, .lwcs-tvm-diagnostic-card pre { max-width: 100%; margin: 0; padding: 10px; overflow: auto; border: 1px solid var(--lwcs-tvm-border-soft); border-radius: 2px; background: #111213; color: #ddd8d1; white-space: pre-wrap; overflow-wrap: anywhere; }
.lwcs-tvm-diagnostic-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; }
.lwcs-tvm-diagnostic-card { min-width: 0; padding: 9px; border: 1px solid var(--lwcs-tvm-border); border-radius: 3px; background: var(--lwcs-tvm-panel); }
.lwcs-tvm-diagnostic-card h3 { margin: 0 0 7px; font-size: 13px; }
@media (max-width: 720px) {
  .lwcs-tvm-overlay { padding: 0; }.lwcs-tvm-shell { width: 100%; height: 100dvh; min-height: 0; border-radius: 0; border-inline: 0; }
  .lwcs-tvm-header { height: 56px; min-height: 56px; padding-inline: 12px 6px; }.lwcs-tvm-context, .lwcs-tvm-header-status .lwcs-tvm-badge:nth-child(2) { display: none; }
  .lwcs-tvm-workspace { grid-template-columns: 1fr; grid-template-rows: auto minmax(0,1fr); }
  .lwcs-tvm-nav { display: grid; grid-template-columns: repeat(3,1fr); padding: 0; border-right: 0; border-bottom: 1px solid var(--lwcs-tvm-border); }
  .lwcs-tvm-nav button { min-height: 48px; align-items: center; padding: 5px; text-align: center; }.lwcs-tvm-nav button span { display: none; }
  .lwcs-tvm-nav button.is-active::before { inset: auto 0 0; width: auto; height: 3px; }
  .lwcs-tvm-page-heading { flex-direction: column; }.lwcs-tvm-db-meta { grid-template-columns: repeat(2,minmax(0,1fr)); }.lwcs-tvm-diagnostic-grid { grid-template-columns: 1fr; }
  .lwcs-tvm-tree-row { min-width: 0; grid-template-columns: 44px minmax(0,1fr) 58px; grid-template-rows: auto auto; padding-inline-start: calc(var(--lwcs-tvm-depth) * 10px); }
  .lwcs-tvm-disclosure, .lwcs-tvm-leaf-dot { grid-row: 1 / span 2; }.lwcs-tvm-node-key { grid-column: 2; }.lwcs-tvm-kind { grid-column: 3; }
  .lwcs-tvm-node-summary, .lwcs-tvm-leaf-editor { grid-column: 2 / 4; grid-row: 2; padding-top: 0; padding-bottom: 5px; }
  .lwcs-tvm-empty-node { min-width: 0; padding-inline-start: calc(var(--lwcs-tvm-depth) * 10px); }
  .lwcs-tvm-db-layout { grid-template-columns: 1fr; grid-template-rows: minmax(150px,35%) minmax(220px,1fr); }.lwcs-tvm-key-list { border-right: 0; border-bottom: 1px solid var(--lwcs-tvm-border); }
}
@media (max-width: 440px) {
  .lwcs-tvm-title-group h1 { font-size: 15px; }.lwcs-tvm-header-status { gap: 4px; }.lwcs-tvm-badge { padding-inline: 6px; }
  .lwcs-tvm-page { padding: 10px; }.lwcs-tvm-actions { width: 100%; }.lwcs-tvm-actions button { flex: 1 1 auto; }
  .lwcs-tvm-db-meta { grid-template-columns: 1fr; }.lwcs-tvm-mvu-tools { align-items: stretch; }.lwcs-tvm-search { flex-basis: 100%; }
  .lwcs-tvm-leaf-editor { grid-template-columns: 72px minmax(0,1fr); }.lwcs-tvm-json-editor textarea { min-height: 300px; }
}
@media (prefers-reduced-motion: reduce) { .lwcs-tvm-overlay *, .lwcs-tvm-overlay *::before, .lwcs-tvm-overlay *::after { scroll-behavior: auto; transition: none; animation: none; } }
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

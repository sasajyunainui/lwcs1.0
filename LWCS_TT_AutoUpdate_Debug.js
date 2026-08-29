(function installLwcsTtAutoUpdateDebug() {
  'use strict';

  const DEBUG_KEY = '__LWCS_TT_AUTO_UPDATE_DEBUG_V1__';
  if (globalThis[DEBUG_KEY]?.version === '1.0.0') return;

  const listeners = [];
  const records = [];
  const knownGenerationTypes = new Set(['normal', 'regenerate', 'continue', 'quiet', 'impersonate', 'swipe']);
  const safeStringKeys = new Set(['eventName', 'source', 'reason', 'result', 'type', 'action', 'status', 'kind', 'version']);

  function getRealm() {
    try {
      const frameId = String(globalThis.frameElement?.id || '');
      if (frameId.includes('MVU_ZOD')) return 'MVU';
      if (frameId.includes('MVU外置状态栏')) return '数据库/UI';
      if (frameId) return '其他iframe';
    } catch (_) {}
    return globalThis === globalThis.top ? '主窗口' : '未识别iframe';
  }

  function getHostScopes() {
    const scopes = [globalThis];
    for (const candidate of [globalThis.parent, globalThis.top]) {
      try {
        if (candidate && !scopes.includes(candidate)) scopes.push(candidate);
      } catch (_) {}
    }
    return scopes;
  }

  function getApiCandidates() {
    const candidates = [];
    for (const scope of getHostScopes()) {
      try {
        const api = scope.SillyTavern;
        if (!api) continue;
        if (typeof api.getContext === 'function') {
          const context = api.getContext();
          if (context) candidates.push(context);
        }
        candidates.push(api);
      } catch (_) {}
    }
    return candidates;
  }

  function fingerprint(value) {
    const text = String(value || '');
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `${text.length}:${(hash >>> 0).toString(16)}`;
  }

  function summarizeString(value) {
    return knownGenerationTypes.has(value)
      ? value
      : { type: 'string', length: value.length, fingerprint: fingerprint(value) };
  }

  function summarize(value, depth = 0, key = '') {
    if (value === null || value === undefined || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return knownGenerationTypes.has(value) || safeStringKeys.has(key)
        ? value.slice(0, 160)
        : summarizeString(value);
    }
    if (typeof value === 'function') return { type: 'function' };
    if (Array.isArray(value)) {
      if (depth >= 3) return { type: 'array', length: value.length };
      return value.slice(0, 16).map(item => summarize(item, depth + 1));
    }
    if (typeof value !== 'object') return { type: typeof value };

    const keys = Object.keys(value).slice(0, 24);
    if (depth >= 3) return { type: 'object', keys };
    const result = {};
    for (const property of keys) result[property] = summarize(value[property], depth + 1, property);
    return result;
  }

  function getSnapshot() {
    const api = getApiCandidates().find(candidate => Array.isArray(candidate?.chat)) || null;
    const chat = Array.isArray(api?.chat) ? api.chat : [];
    const lastIndex = chat.length - 1;
    const last = lastIndex >= 0 ? chat[lastIndex] : null;
    const text = String(last?.mes ?? last?.message ?? '');
    let chatId = '';
    try {
      chatId = String(api?.chatId ?? api?.chat_id ?? globalThis.SillyTavern?.getCurrentChatId?.() ?? '');
    } catch (_) {}
    return {
      chatCount: chat.length,
      chatId: chatId ? fingerprint(chatId) : '',
      last: last ? {
        index: lastIndex,
        messageId: summarize(last.message_id ?? last.id ?? lastIndex),
        swipeId: summarize(last.swipe_id ?? last.swipeId ?? null),
        isUser: last.is_user === true,
        isSystem: last.is_system === true,
        textLength: text.length,
        placeholder: text.trim() === '...' || text.trim().length < 5,
        hasUpdateVariable: /<UpdateVariable\b/i.test(text),
      } : null,
    };
  }

  function record(stage, data = {}) {
    const entry = {
      at: new Date().toISOString(),
      realm: getRealm(),
      stage,
      data: summarize(data),
      snapshot: getSnapshot(),
    };
    records.push(entry);
    if (records.length > 240) records.shift();
    console.info(`[LWCS][TT自动更新诊断] ${JSON.stringify(entry)}`);
    return entry;
  }

  function resolveEventSources() {
    const sources = [];
    for (const api of getApiCandidates()) {
      const eventSource = api?.eventSource;
      const eventTypes = api?.eventTypes;
      if (eventSource && typeof eventSource.on === 'function' && eventTypes && !sources.some(item => item.eventSource === eventSource)) {
        sources.push({ eventSource, eventTypes });
      }
    }
    try {
      const eventSource = globalThis.eventSource;
      const eventTypes = globalThis.tavern_events;
      if (eventSource && typeof eventSource.on === 'function' && eventTypes && !sources.some(item => item.eventSource === eventSource)) {
        sources.push({ eventSource, eventTypes });
      }
    } catch (_) {}
    return sources;
  }

  function attach() {
    if (listeners.length > 0) return true;
    const eventKeys = [
      'GENERATION_STARTED',
      'GENERATION_AFTER_COMMANDS',
      'GENERATION_ENDED',
      'GENERATION_STOPPED',
      'MESSAGE_SENT',
      'MESSAGE_RECEIVED',
      'MESSAGE_UPDATED',
      'MESSAGE_SWIPED',
    ];
    const sources = resolveEventSources();
    for (const { eventSource, eventTypes } of sources) {
      const registered = new Set();
      for (const key of eventKeys) {
        const eventName = eventTypes[key];
        if (!eventName || registered.has(eventName)) continue;
        registered.add(eventName);
        const handler = (...args) => record(`宿主事件:${key}`, {
          eventName: String(eventName),
          argumentCount: args.length,
          arguments: args.map(argument => summarize(argument)),
        });
        eventSource.on(eventName, handler);
        listeners.push({ eventSource, eventName, handler });
      }
    }
    record('诊断监听注册', {
      eventSourceCount: sources.length,
      listenerCount: listeners.length,
      ttMarker: getHostScopes().some(scope => {
        try {
          return !!(scope.__TAURITAVERN__ || scope.__TAURITAVERN_MAIN_READY__ || scope.__TAURI_RUNNING__);
        } catch (_) {
          return false;
        }
      }),
    });
    return listeners.length > 0;
  }

  const debug = {
    version: '1.0.0',
    records,
    record,
    snapshot: getSnapshot,
    attach,
    uninstall() {
      for (const { eventSource, eventName, handler } of listeners.splice(0)) {
        try {
          if (typeof eventSource.removeListener === 'function') eventSource.removeListener(eventName, handler);
          else if (typeof eventSource.off === 'function') eventSource.off(eventName, handler);
        } catch (_) {}
      }
      delete globalThis[DEBUG_KEY];
    },
  };

  globalThis[DEBUG_KEY] = debug;
  record('诊断脚本加载', { version: debug.version });
  if (!attach()) {
    for (const delay of [250, 1000, 3000]) {
      setTimeout(() => attach(), delay);
    }
  }
})();

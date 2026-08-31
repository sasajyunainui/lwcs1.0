(function (root) {
  'use strict';

  const VERSION = '1.0.0';
  const GLOBAL_KEY = '__LWCS_PERSISTENCE_ADAPTER_V1__';
  const LOADING_KEY = '__LWCS_PERSISTENCE_ADAPTER_LOADING_V1__';
  const STATES = Object.freeze(['committed', 'not_committed', 'conflict', 'uncertain', 'stale_chat', 'unavailable']);
  const DOMAIN_BACKENDS = Object.freeze({
    database: Object.freeze(['tt-store', 'st-message']),
    mvu: Object.freeze(['tt-store', 'st-message']),
    'cold-archive': Object.freeze(['st-files']),
  });
  const FALLBACK_BACKENDS = Object.freeze({
    database: 'st-message',
    mvu: 'st-message',
    'cold-archive': 'st-files',
  });
  const PROBE_NAMESPACE = '__lwcs_capability_probe_v1__';
  const TT_HOST_TIMEOUT_MS = 2000;
  let nonceCounter = 0;

  function collectWindows() {
    const windows = [];
    const add = candidate => {
      if (candidate && (typeof candidate === 'object' || typeof candidate === 'function') && !windows.includes(candidate)) windows.push(candidate);
    };
    add(root);
    try { add(root.window); } catch (_) { /* cross-origin window access can fail */ }
    try { add(root.parent); } catch (_) { /* cross-origin window access can fail */ }
    try { add(root.top); } catch (_) { /* cross-origin window access can fail */ }
    return windows;
  }

  function readField(target, field) {
    try { return target?.[field]; } catch (_) { return null; }
  }

  function findExistingAdapter() {
    for (const candidate of collectWindows()) {
      const value = readField(candidate, GLOBAL_KEY);
      if (value) return value;
    }
    return null;
  }

  const existing = findExistingAdapter();
  if (existing) {
    for (const candidate of collectWindows()) {
      try { candidate[GLOBAL_KEY] = existing; } catch (_) { /* best-effort global sharing */ }
      try { candidate[LOADING_KEY] = Promise.resolve(existing); } catch (_) { /* best-effort global sharing */ }
    }
    return;
  }

  class PersistenceAdapterError extends Error {
    constructor(code, message) {
      super(message || code);
      this.name = 'PersistenceAdapterError';
      this.code = code;
    }
  }

  class StaleChatError extends PersistenceAdapterError {
    constructor() {
      super('STALE_CHAT', 'chat generation is no longer active');
    }
  }

  function callTtHost(label, call) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeoutId = setTimeout(() => {
        settled = true;
        reject(new PersistenceAdapterError('TT_HOST_TIMEOUT', `TT host call timed out: ${label}`));
      }, TT_HOST_TIMEOUT_MS);
      const finish = (handler, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        handler(value);
      };
      try {
        Promise.resolve(call()).then(
          value => finish(resolve, value),
          error => finish(reject, error),
        );
      } catch (error) {
        finish(reject, error);
      }
    });
  }

  function assertDomain(domain) {
    if (!Object.prototype.hasOwnProperty.call(DOMAIN_BACKENDS, domain)) throw new PersistenceAdapterError('DOMAIN_INVALID', 'unsupported persistence domain');
    return domain;
  }

  function assertBackend(domain, backend) {
    assertDomain(domain);
    if (!DOMAIN_BACKENDS[domain].includes(backend)) throw new PersistenceAdapterError('BACKEND_INVALID', 'backend is not allowed for this domain');
    return backend;
  }

  function assertMethodSet(backend) {
    if (!backend || typeof backend !== 'object' || ['setJson', 'getJson', 'listKeys', 'deleteJson'].some(method => typeof backend[method] !== 'function')) {
      throw new PersistenceAdapterError('BACKEND_CONTRACT_INVALID', 'backend does not implement the JSON persistence contract');
    }
    return backend;
  }

  function assertRequest(request, includeValue = false) {
    if (!request || typeof request !== 'object') throw new PersistenceAdapterError('REQUEST_INVALID', 'persistence request must be an object');
    if (typeof request.namespace !== 'string' || request.namespace.length === 0 || typeof request.key !== 'string' || request.key.length === 0) {
      throw new PersistenceAdapterError('REQUEST_INVALID', 'namespace and key are required');
    }
    if (includeValue) {
      const serialized = canonicalJson(request.value);
      if (serialized === undefined) throw new PersistenceAdapterError('VALUE_INVALID', 'value is not JSON serializable');
    }
    return request;
  }

  function canonicalJson(value, ancestors = []) {
    if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : undefined;
    if (value === undefined || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') return undefined;
    if (ancestors.includes(value)) throw new PersistenceAdapterError('VALUE_INVALID', 'value is not JSON serializable');
    if (Array.isArray(value)) {
      return `[${value.map(item => canonicalJson(item, ancestors.concat([value])) ?? 'null').join(',')}]`;
    }
    const parts = [];
    for (const key of Object.keys(value).sort()) {
      const serialized = canonicalJson(value[key], ancestors.concat(value));
      if (serialized !== undefined) parts.push(`${JSON.stringify(key)}:${serialized}`);
    }
    return `{${parts.join(',')}}`;
  }

  function jsonEqual(left, right) {
    try { return canonicalJson(left) === canonicalJson(right); } catch (_) { return false; }
  }

  function toJsonValue(value) {
    let serialized;
    try { serialized = JSON.stringify(value); } catch (_) { /* handled below */ }
    if (serialized === undefined) throw new PersistenceAdapterError('VALUE_INVALID', 'value is not JSON serializable');
    return JSON.parse(serialized);
  }

  function expectedFieldsMatch(value, expected) {
    if (expected === undefined) return true;
    if (!expected || typeof expected !== 'object' || Array.isArray(expected) || !value || typeof value !== 'object') return false;
    return Object.keys(expected).every(key => Object.prototype.hasOwnProperty.call(value, key) && jsonEqual(value[key], expected[key]));
  }

  function createNonce() {
    nonceCounter += 1;
    let randomPart = '';
    try {
      if (root.crypto && typeof root.crypto.randomUUID === 'function') randomPart = root.crypto.randomUUID();
      else if (root.crypto && typeof root.crypto.getRandomValues === 'function') {
        const bytes = new Uint32Array(2);
        root.crypto.getRandomValues(bytes);
        randomPart = `${bytes[0].toString(16)}${bytes[1].toString(16)}`;
      }
    } catch (_) { /* optional crypto source unavailable */ }
    if (!randomPart) randomPart = Math.random().toString(36).slice(2);
    return `${Date.now().toString(36)}-${nonceCounter.toString(36)}-${randomPart}`;
  }

  function encodeTauriStoreComponent(value) {
    const bytes = new TextEncoder().encode(String(value));
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `lwcs_${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')}`;
  }

  function decodeTauriStoreComponent(value) {
    const encoded = String(value || '');
    if (!encoded.startsWith('lwcs_')) return null;
    try {
      const body = encoded.slice(5).replace(/-/g, '+').replace(/_/g, '/');
      const binary = atob(body + '='.repeat((4 - body.length % 4) % 4));
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch (_) {
      return null;
    }
  }

  function isTauriStoreNotFound(error) {
    const structured = error?.cause?.NotFound;
    return (typeof structured === 'string' && /Chat store entry not found(?::|$)/.test(structured))
      || /Chat store entry not found(?::|$)/.test(String(error?.message || error));
  }

  function createTauriStoreBackend(store) {
    return Object.freeze({
      setJson: ({ namespace, key, value }) => callTtHost('store.setJson()', () => store.setJson({
        namespace: encodeTauriStoreComponent(namespace),
        key: encodeTauriStoreComponent(key),
        value,
      })),
      getJson: async ({ namespace, key }) => {
        try {
          return await callTtHost('store.getJson()', () => store.getJson({
            namespace: encodeTauriStoreComponent(namespace),
            key: encodeTauriStoreComponent(key),
          }));
        } catch (error) {
          if (isTauriStoreNotFound(error)) return undefined;
          throw error;
        }
      },
      deleteJson: ({ namespace, key }) => callTtHost('store.deleteJson()', () => store.deleteJson({
        namespace: encodeTauriStoreComponent(namespace),
        key: encodeTauriStoreComponent(key),
      })),
      listKeys: async ({ namespace }) => {
        const keys = await callTtHost('store.listKeys()', () => store.listKeys({ namespace: encodeTauriStoreComponent(namespace) }));
        if (!Array.isArray(keys)) return keys;
        return keys.map(decodeTauriStoreComponent).filter(key => key !== null);
      },
    });
  }

  function findTauriTavern() {
    for (const candidate of collectWindows()) {
      const tauriTavern = readField(candidate, '__TAURITAVERN__');
      if (tauriTavern && typeof tauriTavern === 'object') return { owner: candidate, tauriTavern };
    }
    return null;
  }

  function findMainReady() {
    for (const candidate of collectWindows()) {
      const ready = readField(candidate, '__TAURITAVERN_MAIN_READY__');
      if (ready && (typeof ready === 'function' || typeof ready.then === 'function')) return { owner: candidate, ready, label: '__TAURITAVERN_MAIN_READY__' };
    }
    return null;
  }

  async function awaitReady(owner, ready, label) {
    if (typeof ready === 'function') await callTtHost(label, () => ready.call(owner));
    else if (ready && typeof ready.then === 'function') await callTtHost(label, () => ready);
  }

  function findTauriReady(candidate) {
    const localReady = readField(candidate.tauriTavern, 'ready');
    if (localReady && (typeof localReady === 'function' || typeof localReady.then === 'function')) return { owner: candidate.tauriTavern, ready: localReady, label: '__TAURITAVERN__.ready' };
    const mainReady = findMainReady();
    return mainReady || null;
  }

  function resultMeta(session, state, extra = {}) {
    return Object.freeze({
      state,
      backend: session?.backend || null,
      stableChatId: session?.stableChatId || null,
      chatGeneration: session?.chatGeneration ?? null,
      domainGeneration: extra.domainGeneration ?? session?.domainGeneration ?? null,
      commitId: extra.commitId ?? null,
      revision: extra.revision ?? null,
      verified: extra.verified === true,
      ...extra,
    });
  }

  function failureMeta(session, state, code) {
    return resultMeta(session, state, { error: code });
  }

  function errorState(error, mutation) {
    if (error instanceof StaleChatError || error?.code === 'STALE_CHAT') return 'stale_chat';
    if (error?.code === 'CONFLICT') return 'conflict';
    if (error?.code === 'NOT_COMMITTED') return 'not_committed';
    return mutation ? 'uncertain' : 'unavailable';
  }

  function errorCode(error) {
    if (error instanceof PersistenceAdapterError && error.code) return error.code;
    if (error && error.code === 'CONFLICT') return 'CONFLICT';
    return 'BACKEND_ERROR';
  }

  function createPersistenceAdapter(options = {}) {
    const injectedBackends = new Map();
    const backendPins = new Map();
    const capabilityCache = new Map();
    const capabilityInflight = new Map();
    const mutationQueues = new Map();
    let chatGeneration = 0;
    let activeStableChatId = null;
    const domainGenerations = new Map(Object.keys(DOMAIN_BACKENDS).map(domain => [domain, 0]));

    function chatDomainKey(stableChatId, domain) {
      return `${stableChatId}\u0000${domain}`;
    }

    function backendKey(domain, backend) {
      return `${domain}\u0000${backend}`;
    }

    function registerBackend(domain, backend, implementation) {
      assertBackend(domain, backend);
      assertMethodSet(implementation);
      injectedBackends.set(backendKey(domain, backend), implementation);
      return true;
    }

    function injectedBackend(domain, backend) {
      return injectedBackends.get(backendKey(domain, backend)) || null;
    }

    if (options && options.backends && typeof options.backends === 'object') {
      for (const domain of Object.keys(options.backends)) {
        const domainBackends = options.backends[domain];
        if (!domainBackends || typeof domainBackends !== 'object') throw new PersistenceAdapterError('BACKEND_CONTRACT_INVALID', 'backend registration must be an object');
        for (const backend of Object.keys(domainBackends)) registerBackend(domain, backend, domainBackends[backend]);
      }
    }

    function assertGeneration(expectedGeneration) {
      if (expectedGeneration !== chatGeneration) throw new StaleChatError();
    }

    function getDomainGeneration(domain) {
      assertDomain(domain);
      return domainGenerations.get(domain);
    }

    function assertDomainGeneration(domain, expectedGeneration) {
      if (getDomainGeneration(domain) !== expectedGeneration) throw new StaleChatError();
    }

    function assertSessionGeneration(session) {
      assertGeneration(session.chatGeneration);
      assertDomainGeneration(session.domain, session.domainGeneration);
    }

    function assertOpenIdentity(identity) {
      assertGeneration(identity.chatGeneration);
      assertDomainGeneration(identity.domain, identity.domainGeneration);
    }

    function assertLive(session) {
      assertSessionGeneration(session);
      if (session.stableChatId !== activeStableChatId) throw new StaleChatError();
    }

    async function resolveCurrentIdentity(startGeneration, fallbackStableChatId) {
      assertGeneration(startGeneration);
      let candidate = findTauriTavern();
      if (!candidate) {
        const mainReady = findMainReady();
        if (mainReady) {
          await awaitReady(mainReady.owner, mainReady.ready, mainReady.label);
          assertGeneration(startGeneration);
          candidate = findTauriTavern();
        }
      }
      let handle = null;
      let stableChatId = '';
      let identitySource = 'fallback';
      if (candidate) {
        const ready = findTauriReady(candidate);
        if (ready) {
          await awaitReady(ready.owner, ready.ready, ready.label);
          assertGeneration(startGeneration);
        }
        const handleFactory = candidate.tauriTavern?.api?.chat?.current?.handle;
        if (typeof handleFactory === 'function') {
          handle = await callTtHost('api.chat.current.handle()', () => handleFactory.call(candidate.tauriTavern.api.chat.current));
          assertGeneration(startGeneration);
          if (handle && typeof handle.stableId === 'function') {
            const rawStableId = await callTtHost('handle.stableId()', () => handle.stableId.call(handle));
            assertGeneration(startGeneration);
            stableChatId = typeof rawStableId === 'string' ? rawStableId : (typeof rawStableId === 'number' ? String(rawStableId) : '');
            stableChatId = stableChatId.trim();
            if (stableChatId)
              identitySource = 'tauritavern';
          }
        }
      }
      if (!stableChatId) {
        stableChatId = typeof fallbackStableChatId === 'string' || typeof fallbackStableChatId === 'number'
          ? String(fallbackStableChatId).trim()
          : '';
        if (!stableChatId)
          return null;
        assertGeneration(startGeneration);
        handle = null;
      }
      if (activeStableChatId && activeStableChatId !== stableChatId) chatGeneration += 1;
      activeStableChatId = stableChatId;
      return { handle, stableChatId, chatGeneration, identitySource };
    }

    function backendFor(domain, backend, identity) {
      if (backend === 'tt-store') {
        const store = identity.handle?.store;
        if (!store || typeof store !== 'object') return null;
        try { return assertMethodSet(createTauriStoreBackend(store)); } catch (_) { return null; }
      }
      return injectedBackend(domain, backend);
    }

    async function probeBackend(backend, sessionIdentity) {
      const nonce = createNonce();
      const key = `nonce-${nonce}`;
      const value = { nonce };
      let deleteAttempted = false;
      let writeCompleted = false;
      try {
        assertOpenIdentity(sessionIdentity);
        await backend.setJson({ namespace: PROBE_NAMESPACE, key, value, stableChatId: sessionIdentity.stableChatId });
        writeCompleted = true;
        assertOpenIdentity(sessionIdentity);
        const readBack = await backend.getJson({ namespace: PROBE_NAMESPACE, key, stableChatId: sessionIdentity.stableChatId });
        assertOpenIdentity(sessionIdentity);
        if (!jsonEqual(readBack, value)) return null;
        const keysBeforeDelete = await backend.listKeys({ namespace: PROBE_NAMESPACE, stableChatId: sessionIdentity.stableChatId });
        assertOpenIdentity(sessionIdentity);
        if (!Array.isArray(keysBeforeDelete) || !keysBeforeDelete.includes(key)) return null;
        deleteAttempted = true;
        await backend.deleteJson({ namespace: PROBE_NAMESPACE, key, stableChatId: sessionIdentity.stableChatId });
        writeCompleted = false;
        assertOpenIdentity(sessionIdentity);
        const afterDelete = await backend.listKeys({ namespace: PROBE_NAMESPACE, stableChatId: sessionIdentity.stableChatId });
        assertOpenIdentity(sessionIdentity);
        if (!Array.isArray(afterDelete) || afterDelete.includes(key)) return null;
        return Object.freeze({
          ready: true,
          stableId: true,
          jsonStore: true,
          listKeys: typeof backend.listKeys === 'function',
          deleteJson: true,
          verifiedWrite: true,
        });
      } catch (error) {
        if (error instanceof StaleChatError) throw error;
        return null;
      } finally {
        if (writeCompleted && !deleteAttempted) {
          try {
            assertOpenIdentity(sessionIdentity);
            await backend.deleteJson({ namespace: PROBE_NAMESPACE, key, stableChatId: sessionIdentity.stableChatId });
            assertOpenIdentity(sessionIdentity);
          } catch (_) { /* cleanup is best effort after a failed probe */ }
        }
      }
    }

    async function getCapabilities(domain, backendName, backend, sessionIdentity) {
      const cacheKey = chatDomainKey(sessionIdentity.stableChatId, domain);
      const cached = capabilityCache.get(cacheKey);
      if (cached && cached.backend === backendName) return cached.capabilities;
      if (capabilityInflight.has(cacheKey)) return capabilityInflight.get(cacheKey);
      const probePromise = probeBackend(backend, sessionIdentity)
        .then(capabilities => {
          if (capabilities) capabilityCache.set(cacheKey, { backend: backendName, capabilities });
          else capabilityCache.delete(cacheKey);
          return capabilities;
        })
        .finally(() => capabilityInflight.delete(cacheKey));
      capabilityInflight.set(cacheKey, probePromise);
      return probePromise;
    }

    function backendCandidates(domain, sessionIdentity) {
      const pin = backendPins.get(chatDomainKey(sessionIdentity.stableChatId, domain));
      if (pin) return [pin];
      if (sessionIdentity.identitySource === 'fallback') {
        const fallbackBackend = FALLBACK_BACKENDS[domain];
        return DOMAIN_BACKENDS[domain].includes(fallbackBackend) ? [fallbackBackend] : [];
      }
      return DOMAIN_BACKENDS[domain].slice();
    }

    function pinBackend(session, valuePresent = true) {
      if (valuePresent) backendPins.set(chatDomainKey(session.stableChatId, session.domain), session.backend);
    }

    function enqueueMutation(session, action) {
      const queueKey = chatDomainKey(session.stableChatId, session.domain);
      const previous = mutationQueues.get(queueKey) || Promise.resolve();
      const current = previous.catch(() => undefined).then(action);
      const queued = current.finally(() => {
        if (mutationQueues.get(queueKey) === queued) mutationQueues.delete(queueKey);
      });
      queued.catch(() => undefined);
      mutationQueues.set(queueKey, queued);
      return current;
    }

    async function readBackWithRetry(read, matches, check) {
      const delays = [0, 50, 150, 300, 600];
      let value;
      const startedAt = Date.now();
      for (const delay of delays) {
        if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
        value = await read();
        check();
        if (matches(value)) return { matched: true, value, attempts: delays.indexOf(delay) + 1, elapsedMs: Date.now() - startedAt };
      }
      return { matched: false, value, attempts: delays.length, elapsedMs: Date.now() - startedAt };
    }

    function describeValue(value) {
      let serialized;
      try { serialized = canonicalJson(value); } catch (_) { serialized = undefined; }
      return {
        type: value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value,
        canonicalLength: typeof serialized === 'string' ? serialized.length : null,
      };
    }

    function warnReadBackMismatch(session, request, expected, readBack) {
      console.warn('[LWCS Persistence] 写后读回不一致', {
        backend: session.backend,
        key: request.key,
        attempts: readBack.attempts,
        elapsedMs: readBack.elapsedMs,
        expected: describeValue(expected),
        actual: describeValue(readBack.value),
        verifyMatched: expectedFieldsMatch(readBack.value, request.verify),
      });
    }

    async function openSession({ domain, fallbackStableChatId } = {}) {
      assertDomain(domain);
      const startGeneration = chatGeneration;
      const startDomainGeneration = getDomainGeneration(domain);
      let sessionIdentity;
      try {
        const resolvedIdentity = await resolveCurrentIdentity(startGeneration, fallbackStableChatId);
        if (resolvedIdentity) {
          sessionIdentity = {
            ...resolvedIdentity,
            domain,
            domainGeneration: startDomainGeneration,
          };
          assertOpenIdentity(sessionIdentity);
        }
      } catch (error) {
        if (error instanceof StaleChatError) return resultMeta(null, 'stale_chat', { error: errorCode(error) });
        return resultMeta(null, 'unavailable', { error: errorCode(error) });
      }
      if (!sessionIdentity) {
        return resultMeta(null, 'unavailable', {
          error: fallbackStableChatId === undefined ? 'TAURITAVERN_UNAVAILABLE' : 'FALLBACK_IDENTITY_UNAVAILABLE',
        });
      }
      const sessionBase = { domain, ...sessionIdentity };
      for (const backendName of backendCandidates(domain, sessionIdentity)) {
        const backend = backendFor(domain, backendName, sessionIdentity);
        if (!backend) continue;
        let capabilities;
        try {
          capabilities = await getCapabilities(domain, backendName, backend, sessionIdentity);
          assertOpenIdentity(sessionIdentity);
        } catch (error) {
          if (error instanceof StaleChatError) return resultMeta(null, 'stale_chat', { error: errorCode(error) });
          capabilities = null;
        }
        if (!capabilities?.verifiedWrite) continue;
        const session = createSession({ ...sessionBase, backend: backendName, capabilities, backendApi: backend });
        if (domain === 'mvu') pinBackend(session);
        return resultMeta(session, 'committed', { verified: true, session });
      }
      return resultMeta(null, 'unavailable', { error: 'PERSISTENCE_BACKEND_UNAVAILABLE' });
    }

    function createSession({ domain, backend, stableChatId, chatGeneration: sessionGeneration, domainGeneration: sessionDomainGeneration, capabilities, backendApi }) {
      const session = {
        domain,
        backend,
        stableChatId,
        chatGeneration: sessionGeneration,
        domainGeneration: sessionDomainGeneration,
        capabilities,
      };
      const confirmedKeys = new Set();
      const indexedNamespaces = new Set();
      const confirmedKey = (namespace, key) => `${namespace}\u0000${key}`;

      async function run(kind, action) {
        try {
          assertLive(session);
          return await action(() => assertLive(session));
        } catch (error) {
          const state = errorState(error, kind === 'mutation');
          return failureMeta(session, state, errorCode(error));
        }
      }

      session.getJson = async request => {
        assertRequest(request);
        return run('read', async check => {
          const key = confirmedKey(request.namespace, request.key);
          if (backend === 'tt-store' && !confirmedKeys.has(key)) {
            if (!indexedNamespaces.has(request.namespace)) {
              const keys = await backendApi.listKeys({ namespace: request.namespace, stableChatId: session.stableChatId });
              check();
              if (!Array.isArray(keys)) return failureMeta(session, 'uncertain', 'READBACK_MISMATCH');
              keys.forEach(found => confirmedKeys.add(confirmedKey(request.namespace, found)));
              indexedNamespaces.add(request.namespace);
            }
            if (!confirmedKeys.has(key)) {
              return request.verify === undefined
                ? resultMeta(session, 'committed', { verified: true, value: undefined })
                : failureMeta(session, 'not_committed', 'NOT_FOUND');
            }
          }
          const value = await backendApi.getJson({ namespace: request.namespace, key: request.key, stableChatId: session.stableChatId });
          check();
          if (value === undefined) {
            confirmedKeys.delete(key);
            if (request.verify !== undefined) return failureMeta(session, 'not_committed', 'NOT_FOUND');
          }
          if (!expectedFieldsMatch(value, request.verify)) return failureMeta(session, 'uncertain', 'READBACK_MISMATCH');
          if (value !== undefined) {
            confirmedKeys.add(key);
            pinBackend(session);
          }
          return resultMeta(session, 'committed', { verified: true, value });
        });
      };

      session.setJson = async request => {
        assertRequest(request, true);
        const jsonValue = toJsonValue(request.value);
        return enqueueMutation(session, () => run('mutation', async check => {
          await backendApi.setJson({ namespace: request.namespace, key: request.key, value: jsonValue, stableChatId: session.stableChatId });
          check();
          if (backend === 'tt-store') {
            confirmedKeys.add(confirmedKey(request.namespace, request.key));
            pinBackend(session);
            return resultMeta(session, 'committed', {
              commitId: request.verify?.commitId ?? null,
              revision: request.verify?.revision ?? null,
              verified: true,
            });
          }
          const readBack = await readBackWithRetry(
            () => backendApi.getJson({ namespace: request.namespace, key: request.key, stableChatId: session.stableChatId }),
            value => jsonEqual(value, jsonValue) && expectedFieldsMatch(value, request.verify),
            check,
          );
          if (!readBack.matched) {
            warnReadBackMismatch(session, request, jsonValue, readBack);
            return failureMeta(session, 'uncertain', `READBACK_MISMATCH:${request.key}`);
          }
          confirmedKeys.add(confirmedKey(request.namespace, request.key));
          pinBackend(session);
          return resultMeta(session, 'committed', {
            commitId: request.verify?.commitId ?? null,
            revision: request.verify?.revision ?? null,
            verified: true,
          });
        }));
      };

      session.setJsonBatch = async requests => {
        if (backend !== 'tt-store') return failureMeta(session, 'unavailable', 'BATCH_WRITE_UNSUPPORTED');
        if (!Array.isArray(requests) || requests.length === 0) throw new PersistenceAdapterError('REQUEST_INVALID', 'non-empty requests are required');
        requests.forEach(request => assertRequest(request, true));
        const jsonValues = requests.map(request => toJsonValue(request.value));
        return enqueueMutation(session, () => run('mutation', async check => {
          await Promise.all(requests.map((request, index) => backendApi.setJson({
            namespace: request.namespace,
            key: request.key,
            value: jsonValues[index],
            stableChatId: session.stableChatId,
          })));
          check();
          requests.forEach(request => confirmedKeys.add(confirmedKey(request.namespace, request.key)));
          pinBackend(session);
          return resultMeta(session, 'committed', { verified: true, count: requests.length });
        }));
      };

      session.listKeys = async request => {
        const normalized = request && typeof request === 'object' ? request : {};
        if (typeof normalized.namespace !== 'string' || normalized.namespace.length === 0) throw new PersistenceAdapterError('REQUEST_INVALID', 'namespace is required');
        return run('read', async check => {
          const keys = await backendApi.listKeys({ namespace: normalized.namespace, stableChatId: session.stableChatId });
          check();
          if (!Array.isArray(keys)) return failureMeta(session, 'uncertain', 'READBACK_MISMATCH');
          keys.forEach(key => confirmedKeys.add(confirmedKey(normalized.namespace, key)));
          if (backend === 'tt-store') indexedNamespaces.add(normalized.namespace);
          if (keys.length > 0) pinBackend(session);
          return resultMeta(session, 'committed', { verified: true, keys: keys.slice() });
        });
      };

      session.deleteJson = async request => {
        assertRequest(request);
        return enqueueMutation(session, () => run('mutation', async check => {
          const beforeDelete = await backendApi.listKeys({ namespace: request.namespace, stableChatId: session.stableChatId });
          check();
          if (!Array.isArray(beforeDelete)) return failureMeta(session, 'uncertain', 'DELETE_NOT_VERIFIED');
          if (!beforeDelete.includes(request.key)) {
            confirmedKeys.delete(confirmedKey(request.namespace, request.key));
            return resultMeta(session, 'committed', { verified: true });
          }
          await backendApi.deleteJson({ namespace: request.namespace, key: request.key, stableChatId: session.stableChatId });
          check();
          const afterDelete = await backendApi.listKeys({ namespace: request.namespace, stableChatId: session.stableChatId });
          check();
          if (!Array.isArray(afterDelete) || afterDelete.includes(request.key)) return failureMeta(session, 'uncertain', 'DELETE_NOT_VERIFIED');
          confirmedKeys.delete(confirmedKey(request.namespace, request.key));
          pinBackend(session);
          return resultMeta(session, 'committed', { verified: true });
        }));
      };

      return Object.freeze(session);
    }

    function invalidateChatGeneration() {
      chatGeneration += 1;
      activeStableChatId = null;
      return chatGeneration;
    }

    function invalidateDomainGeneration(domain) {
      assertDomain(domain);
      const nextGeneration = getDomainGeneration(domain) + 1;
      domainGenerations.set(domain, nextGeneration);
      return nextGeneration;
    }

    return Object.freeze({
      version: VERSION,
      statuses: STATES,
      domains: DOMAIN_BACKENDS,
      openSession,
      registerBackend,
      invalidateChatGeneration,
      invalidateDomainGeneration,
      getChatGeneration: () => chatGeneration,
      getDomainGeneration,
    });
  }

  const adapter = createPersistenceAdapter();
  for (const candidate of collectWindows()) {
    try { candidate[GLOBAL_KEY] = adapter; } catch (_) { /* best-effort global sharing */ }
    try { candidate[LOADING_KEY] = Promise.resolve(adapter); } catch (_) { /* best-effort global sharing */ }
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);

/* 此文件由 Build_Runtime_Bundles.cjs 生成，禁止直接编辑。 */
;
/* sources-sha256: LWCS_Persistence_Adapter.js:99db441c20e82c31d01da4f82f3d7d4742136367e18fdbef03c9fb2e24e516ef|LWCS_MVU_Persistence_Provider.js:6a58dc159e89c0c880f50f3ee414d90a71e59f18872e00e779d97a018e1299f5|LWCS_MVU_Prompt_Projector.js:621af59c602776d18cecb575a844f3449f60baa2639ca850a7c9399de92905c7|LibraryData_Runtime.js:8a5d07321714f9ba26ba8134099975dcc9a4ce371d78b5ca2d5a289383b6891b|EraDataRegistry.js:74d280273114bcbb92a05015205f71fd35407f122a8fd4c03d36262bd7b3cc85|EraCurrencyRegistry.js:f2a8b5e80ccd7223a81b3635902c42e44a4151eb11b623881a23f9ba620422af|TimelineRuntime.js:bd39c241a145f01e315010128d4924f32f4aacf72dd3f7eec83bce8cd770c7c8|EraRuntime_Integration.js:afa433280c1eb9d514a0efd9d4cd570ea48dae7d6e03bc83f2c43360723ecca2|EraCultivation_Runtime.js:1cb66ad1f375d1128f6e811841c0d8e59b42fe73f82394516ea28f5564afd743 */
;
/* source: LWCS_Persistence_Adapter.js */
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
          if (/Chat store entry not found(?::|$)/.test(String(error?.message || error))) return undefined;
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
            const keys = await backendApi.listKeys({ namespace: request.namespace, stableChatId: session.stableChatId });
            check();
            if (!Array.isArray(keys)) return failureMeta(session, 'uncertain', 'READBACK_MISMATCH');
            if (!keys.includes(request.key)) {
              return request.verify === undefined
                ? resultMeta(session, 'committed', { verified: true, value: undefined })
                : failureMeta(session, 'not_committed', 'NOT_FOUND');
            }
            confirmedKeys.add(key);
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

;
/* source: LWCS_MVU_Persistence_Provider.js */
(function (root) {
  'use strict';

  const VERSION = '1.0.0';
  const GLOBAL_KEY = '__LWCS_MVU_PERSISTENCE_PROVIDER_V1__';
  const NAMESPACE = 'lwcs.mvu.v1';
  const STORAGE_ROOT = '__lwcs_mvu_persistence_v1__';
  const SCHEMA_VERSION = 1;
  const STATES = Object.freeze(['committed', 'not_committed', 'uncertain', 'stale_chat', 'unavailable']);
  const sessions = new Map();
  let sessionCounter = 0;

  /*
   * LUNA-MVU contract:
   * provider.open({ fallbackStableChatId }) -> { state, backend, handle }.
   * handle.load({ initialState, message }) restores the complete hot state.
   * handle.commit({ fullState, message }) and handle.enqueueCommit(...) serialize one chat queue.
   * A commit is immutable revision -> floor/swipe pointer -> head; head is read back before success.
   * handle.getHotState(), getHead(), getFloor(), getQueueState(), getStatus() are memory/status reads only.
   * handle.awaitIdle() waits for that chat's load and commit queue; provider.awaitIdle() waits for all opened chats.
   */

  function collectWindows() {
    const windows = [];
    const add = candidate => {
      if (candidate && (typeof candidate === 'object' || typeof candidate === 'function') && !windows.includes(candidate)) windows.push(candidate);
    };
    add(root);
    try { add(root.window); } catch (_) {}
    try { add(root.parent); } catch (_) {}
    try { add(root.top); } catch (_) {}
    return windows;
  }

  function readField(target, field) {
    try { return target?.[field]; } catch (_) { return null; }
  }

  function isTauriTavern() {
    return collectWindows().some(candidate => {
      const tauriTavern = readField(candidate, '__TAURITAVERN__');
      return Object.prototype.hasOwnProperty.call(candidate, '__TAURITAVERN_MAIN_READY__')
        || (!!tauriTavern && typeof tauriTavern === 'object')
        || (!!tauriTavern && Object.prototype.hasOwnProperty.call(tauriTavern, 'ready'));
    });
  }

  function findExistingProvider() {
    for (const candidate of collectWindows()) {
      const value = readField(candidate, GLOBAL_KEY);
      if (value) return value;
    }
    return null;
  }

  const existing = findExistingProvider();
  if (existing) {
    for (const candidate of collectWindows()) {
      try { candidate[GLOBAL_KEY] = existing; } catch (_) {}
    }
    return;
  }

  class ProviderError extends Error {
    constructor(code, message) {
      super(message || code);
      this.name = 'MvuPersistenceProviderError';
      this.code = code;
    }
  }

  function clone(value) {
    if (value === undefined) return undefined;
    try {
      if (typeof root.structuredClone === 'function') return root.structuredClone(value);
    } catch (_) {}
    return JSON.parse(JSON.stringify(value));
  }

  function isObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function canonicalJson(value) {
    if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : undefined;
    if (Array.isArray(value)) return `[${value.map(item => canonicalJson(item) ?? 'null').join(',')}]`;
    if (isObject(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key]) ?? 'null'}`).join(',')}}`;
    return undefined;
  }

  function jsonEqual(left, right) {
    try { return canonicalJson(left) === canonicalJson(right); } catch (_) { return false; }
  }

  function encodeComponent(value) {
    const text = String(value);
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `lwcs_${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')}`;
  }

  function decodeComponent(value) {
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

  function result(state, extra = {}) {
    return Object.freeze({ state, namespace: NAMESPACE, verified: state === 'committed', ...extra });
  }

  function resultError(value, fallback = 'PERSISTENCE_OPERATION_FAILED') {
    if (value instanceof Error) return value;
    const error = new ProviderError(value?.error || fallback, value?.error || fallback);
    error.state = value?.state || 'uncertain';
    return error;
  }

  function findFunction(name) {
    for (const candidate of collectWindows()) {
      const helper = readField(candidate, 'TavernHelper');
      if (helper && typeof helper[name] === 'function') return { owner: helper, fn: helper[name] };
      if (typeof readField(candidate, name) === 'function') return { owner: candidate, fn: candidate[name] };
    }
    return null;
  }

  function getChatContext() {
    for (const candidate of collectWindows()) {
      const sillyTavern = readField(candidate, 'SillyTavern');
      if (!sillyTavern || typeof sillyTavern.getContext !== 'function') continue;
      try {
        const context = sillyTavern.getContext();
        if (context && Array.isArray(context.chat)) return { context, chat: context.chat, owner: candidate };
      } catch (_) {}
    }
    return { context: null, chat: null, owner: null };
  }

  async function readChatSnapshot() {
    const context = getChatContext();
    if (Array.isArray(context.chat)) {
      return {
        chat: context.chat,
        chatId: String(context.context?.chatId ?? context.context?.chat_id ?? '').trim(),
      };
    }
    const helper = findFunction('getChatMessages');
    if (!helper) throw new ProviderError('ST_MESSAGE_API_UNAVAILABLE');
    const recent = await helper.fn.call(helper.owner, -1, { include_swipes: true });
    if (!Array.isArray(recent)) throw new ProviderError('ST_MESSAGE_READ_FAILED');
    return { chat: recent, chatId: '' };
  }

  function messageId(message, index) {
    const value = message?.message_id ?? message?.id ?? index;
    return value === undefined || value === null ? index : value;
  }

  function swipeId(message) {
    const value = Number(message?.swipe_id);
    return Number.isInteger(value) && value >= 0 ? value : null;
  }

  function emptyStorage() {
    return { schemaVersion: SCHEMA_VERSION, namespaces: {}, branches: {} };
  }

  function readStorageRoot(message) {
    const value = message?.extra?.[STORAGE_ROOT];
    if (!isObject(value) || value.schemaVersion !== SCHEMA_VERSION || !isObject(value.namespaces) || !isObject(value.branches)) return null;
    return value;
  }

  function readBucket(rootValue, namespace, key, branch) {
    if (!rootValue) return { found: false, value: undefined };
    const encodedNamespace = encodeComponent(namespace);
    const encodedKey = encodeComponent(key);
    const sources = [];
    if (branch !== null && isObject(rootValue.branches[String(branch)])) sources.push(rootValue.branches[String(branch)]);
    sources.push(rootValue.namespaces);
    for (const source of sources) {
      const namespaceBucket = source?.[encodedNamespace];
      if (isObject(namespaceBucket) && Object.prototype.hasOwnProperty.call(namespaceBucket, encodedKey)) {
        return { found: true, value: clone(namespaceBucket[encodedKey]) };
      }
    }
    return { found: false, value: undefined };
  }

  function writeBucket(rootValue, namespace, key, value, branch) {
    const encodedNamespace = encodeComponent(namespace);
    const encodedKey = encodeComponent(key);
    const output = isObject(rootValue) ? clone(rootValue) : emptyStorage();
    output.schemaVersion = SCHEMA_VERSION;
    if (!isObject(output.namespaces)) output.namespaces = {};
    if (!isObject(output.branches)) output.branches = {};
    const target = branch === null
      ? output.namespaces
      : (output.branches[String(branch)] = isObject(output.branches[String(branch)]) ? output.branches[String(branch)] : {});
    if (!isObject(target[encodedNamespace])) target[encodedNamespace] = {};
    target[encodedNamespace][encodedKey] = clone(value);
    return output;
  }

  function deleteBucket(rootValue, namespace, key, branch) {
    if (!rootValue) return { root: rootValue, deleted: false };
    const output = clone(rootValue);
    const encodedNamespace = encodeComponent(namespace);
    const encodedKey = encodeComponent(key);
    const targets = [];
    if (branch !== null && isObject(output.branches?.[String(branch)])) targets.push(output.branches[String(branch)]);
    targets.push(output.namespaces);
    for (const target of targets) {
      const bucket = target?.[encodedNamespace];
      if (!isObject(bucket) || !Object.prototype.hasOwnProperty.call(bucket, encodedKey)) continue;
      delete bucket[encodedKey];
      if (Object.keys(bucket).length === 0) delete target[encodedNamespace];
      return { root: output, deleted: true };
    }
    return { root: output, deleted: false };
  }

  function findStoredValue(messages, namespace, key, activeSwipe) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      const rootValue = readStorageRoot(message);
      if (!rootValue) continue;
      const messageBranch = index === messages.length - 1 ? activeSwipe : swipeId(message);
      const stored = readBucket(rootValue, namespace, key, messageBranch);
      if (stored.found) return stored;
    }
    return { found: false, value: undefined };
  }

  function currentMessage(messages) {
    if (!Array.isArray(messages) || messages.length === 0) throw new ProviderError('ST_MESSAGE_UNAVAILABLE');
    const index = messages.length - 1;
    return { message: messages[index], index, swipe: swipeId(messages[index]) };
  }

  function assertStableChat(snapshot, stableChatId) {
    const current = String(snapshot.chatId || '').trim();
    const expected = String(stableChatId || '').trim();
    if (current && expected && current !== expected) throw new ProviderError('STALE_CHAT');
  }

  async function writeMessageExtra(snapshot, stableChatId, nextExtra) {
    assertStableChat(snapshot, stableChatId);
    const current = currentMessage(snapshot.chat);
    const helper = findFunction('setChatMessages');
    if (!helper) throw new ProviderError('ST_MESSAGE_API_UNAVAILABLE');
    await helper.fn.call(helper.owner, [{ message_id: messageId(current.message, current.index), extra: nextExtra }], { refresh: 'none' });
    try { current.message.extra = nextExtra; } catch (_) {}
  }

  function createStMessageBackend() {
    return Object.freeze({
      async setJson({ namespace, key, value, stableChatId }) {
        const snapshot = await readChatSnapshot();
        assertStableChat(snapshot, stableChatId);
        const current = currentMessage(snapshot.chat);
        const rootValue = readStorageRoot(current.message) || emptyStorage();
        const nextRoot = writeBucket(rootValue, namespace, key, value, current.swipe);
        const extra = isObject(current.message.extra) ? clone(current.message.extra) : {};
        extra[STORAGE_ROOT] = nextRoot;
        await writeMessageExtra(snapshot, stableChatId, extra);
      },
      async getJson({ namespace, key, stableChatId }) {
        const snapshot = await readChatSnapshot();
        assertStableChat(snapshot, stableChatId);
        const current = currentMessage(snapshot.chat);
        return findStoredValue(snapshot.chat, namespace, key, current.swipe).value;
      },
      async listKeys({ namespace, stableChatId }) {
        const snapshot = await readChatSnapshot();
        assertStableChat(snapshot, stableChatId);
        const keys = new Set();
        const encodedNamespace = encodeComponent(namespace);
        for (const message of snapshot.chat) {
          const rootValue = readStorageRoot(message);
          if (!rootValue) continue;
          const collect = source => {
            const bucket = source?.[encodedNamespace];
            if (isObject(bucket)) Object.keys(bucket).forEach(key => keys.add(key));
          };
          collect(rootValue.namespaces);
          Object.values(rootValue.branches).forEach(collect);
        }
        return [...keys].map(decodeComponent).filter(key => key !== null);
      },
      async deleteJson({ namespace, key, stableChatId }) {
        const snapshot = await readChatSnapshot();
        assertStableChat(snapshot, stableChatId);
        const current = currentMessage(snapshot.chat);
        const rootValue = readStorageRoot(current.message);
        const deleted = deleteBucket(rootValue, namespace, key, current.swipe);
        if (!deleted.deleted) return;
        const extra = isObject(current.message.extra) ? clone(current.message.extra) : {};
        extra[STORAGE_ROOT] = deleted.root;
        await writeMessageExtra(snapshot, stableChatId, extra);
      },
    });
  }

  function pointerEscape(value) {
    return String(value).replace(/~/g, '~0').replace(/\//g, '~1');
  }

  function pointerUnescape(value) {
    return String(value).replace(/~1/g, '/').replace(/~0/g, '~');
  }

  function diffValues(previous, next, path, output) {
    if (jsonEqual(previous, next)) return;
    if (isObject(previous) && isObject(next)) {
      for (const key of Object.keys(previous).sort()) {
        if (!Object.prototype.hasOwnProperty.call(next, key)) output.push({ op: 'remove', path: `${path}/${pointerEscape(key)}` });
      }
      for (const key of Object.keys(next).sort()) {
        const childPath = `${path}/${pointerEscape(key)}`;
        if (!Object.prototype.hasOwnProperty.call(previous, key)) output.push({ op: 'add', path: childPath, value: clone(next[key]) });
        else diffValues(previous[key], next[key], childPath, output);
      }
      return;
    }
    output.push({ op: 'replace', path, value: clone(next) });
  }

  function createPatch(previous, next) {
    const output = [];
    diffValues(previous, next, '', output);
    return output;
  }

  function pathParts(path) {
    if (path === '') return [];
    if (typeof path !== 'string' || !path.startsWith('/')) throw new ProviderError('PATCH_INVALID');
    return path.slice(1).split('/').map(pointerUnescape);
  }

  function applyPatch(document, patch) {
    let output = clone(document);
    if (!Array.isArray(patch)) throw new ProviderError('PATCH_INVALID');
    for (const operation of patch) {
      if (!operation || !['add', 'replace', 'remove'].includes(operation.op)) throw new ProviderError('PATCH_INVALID');
      const parts = pathParts(operation.path);
      if (parts.length === 0) {
        if (operation.op === 'remove') throw new ProviderError('PATCH_INVALID');
        output = clone(operation.value);
        continue;
      }
      let parent = output;
      for (const part of parts.slice(0, -1)) {
        if (!parent || typeof parent !== 'object' || !Object.prototype.hasOwnProperty.call(parent, part)) throw new ProviderError('PATCH_PARENT_MISSING');
        parent = parent[part];
      }
      const key = parts[parts.length - 1];
      if (!parent || typeof parent !== 'object') throw new ProviderError('PATCH_PARENT_MISSING');
      if (operation.op === 'remove') delete parent[key];
      else parent[key] = clone(operation.value);
    }
    return output;
  }

  function normalizeFloor(input) {
    const source = input?.message || input?.floor || input || {};
    const rawIndex = Number(source.absoluteIndex ?? source.messageIndex ?? source.message_id ?? source.messageId);
    const rawSwipe = source.swipeId ?? source.swipe_id;
    const swipe = rawSwipe === undefined || rawSwipe === null || rawSwipe === '' ? null : (Number.isFinite(Number(rawSwipe)) ? Number(rawSwipe) : String(rawSwipe));
    return Object.freeze({
      absoluteIndex: Number.isFinite(rawIndex) ? Math.trunc(rawIndex) : -1,
      swipeId: swipe,
      textFingerprint: source.textFingerprint === undefined || source.textFingerprint === null ? '' : String(source.textFingerprint),
    });
  }

  function textFingerprint(value) {
    let hash = 2166136261;
    for (const character of String(value)) hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  async function readCurrentFloor(expected) {
    const normalized = normalizeFloor(expected);
    if (normalized.absoluteIndex < 0) return normalized;
    const helper = findFunction('getChatMessages');
    if (!helper) throw new ProviderError('MESSAGE_POINTER_UNAVAILABLE');
    const messages = await helper.fn.call(helper.owner, normalized.absoluteIndex, { include_swipes: true });
    const message = Array.isArray(messages) ? messages.at(-1) : null;
    if (!message) throw new ProviderError('STALE_CHAT');
    return normalizeFloor({
      absoluteIndex: message.message_id ?? normalized.absoluteIndex,
      swipeId: message.swipe_id,
      textFingerprint: textFingerprint(message.message ?? message.mes ?? ''),
    });
  }

  async function assertCurrentFloor(expected) {
    const normalized = normalizeFloor(expected);
    if (normalized.absoluteIndex < 0) return;
    const actual = await readCurrentFloor(normalized);
    if (!jsonEqual(actual, normalized)) throw new ProviderError('STALE_CHAT');
  }

  function floorPointerKey(floor) {
    const normalized = normalizeFloor(floor);
    return `state:floor:branch:${encodeComponent(JSON.stringify([normalized.absoluteIndex, normalized.swipeId, normalized.textFingerprint]))}`;
  }

  function validFloorPointer(value, floor) {
    return isObject(value)
      && value.schemaVersion === SCHEMA_VERSION
      && value.kind === 'floor'
      && Number.isInteger(value.revision)
      && jsonEqual(normalizeFloor(value.floor), floor);
  }

  function floorCompatible(persisted, current) {
    if (!current || current.absoluteIndex < 0) return true;
    if (!persisted || persisted.absoluteIndex < 0) return false;
    if (persisted.absoluteIndex > current.absoluteIndex) return false;
    if (persisted.absoluteIndex < current.absoluteIndex) return true;
    if (persisted.swipeId !== null && current.swipeId !== null && persisted.swipeId !== current.swipeId) return false;
    if (persisted.textFingerprint && current.textFingerprint && persisted.textFingerprint !== current.textFingerprint) return false;
    return true;
  }

  function validRevision(value, revision) {
    return isObject(value)
      && value.schemaVersion === SCHEMA_VERSION
      && value.kind === 'revision'
      && value.revision === revision
      && (value.mode === 'checkpoint' || value.mode === 'patch')
      && isObject(value.floor);
  }

  function validHead(value) {
    return isObject(value)
      && value.schemaVersion === SCHEMA_VERSION
      && value.kind === 'head'
      && Number.isInteger(value.revision)
      && value.revision > 0
      && Number.isInteger(value.checkpointRevision)
      && value.checkpointRevision > 0
      && isObject(value.floor);
  }

  function normalizeState(value) {
    if (!isObject(value)) throw new ProviderError('STATE_INVALID');
    return clone(value);
  }

  function createSession(adapter, opened) {
    const sessionId = ++sessionCounter;
    const adapterSession = opened.session;
    const domainGeneration = opened.domainGeneration;
    let hotState = null;
    let loaded = false;
    let head = null;
    let floor = null;
    let latestRevision = 0;
    let invalidated = false;
    let queue = Promise.resolve();
    let pending = 0;
    let lastError = '';

    function generationIsLive() {
      return adapter.getChatGeneration() === opened.chatGeneration
        && adapter.getDomainGeneration('mvu') === domainGeneration;
    }

    function assertLive() {
      if (invalidated) throw new ProviderError('STALE_CHAT');
      if (!generationIsLive()) {
        invalidated = true;
        lastError = 'STALE_CHAT';
        throw new ProviderError('STALE_CHAT');
      }
    }

    function enqueue(action) {
      pending += 1;
      const current = queue.catch(() => undefined).then(action);
      queue = current.finally(() => { pending = Math.max(0, pending - 1); });
      current.catch(() => undefined);
      return current;
    }

    function operationFailure(error) {
      const state = ['not_committed', 'conflict', 'uncertain', 'stale_chat', 'unavailable'].includes(error?.state)
        ? error.state
        : (error?.code === 'STALE_CHAT' ? 'stale_chat' : 'uncertain');
      lastError = error?.code || 'PERSISTENCE_OPERATION_FAILED';
      return result(state, { error: lastError, backend: opened.backend, stableChatId: opened.stableChatId });
    }

    async function readKey(key, verify) {
      assertLive();
      const read = await adapterSession.getJson({ namespace: NAMESPACE, key, verify });
      if (read.state === 'not_committed' && read.error === 'NOT_FOUND') return { found: false, value: undefined };
      if (read.state !== 'committed') throw resultError(read);
      return { found: true, value: read.value };
    }

    async function writeKey(key, value, verify) {
      assertLive();
      const written = await adapterSession.setJson({ namespace: NAMESPACE, key, value, verify });
      if (written.state !== 'committed') throw resultError(written);
    }

    async function loadNow(request = {}) {
      assertLive();
      const initialState = request.initialState === undefined ? {} : normalizeState(request.initialState);
      const requestedFloor = normalizeFloor(request.message);
      await assertCurrentFloor(requestedFloor);
      const branchRead = requestedFloor.absoluteIndex >= 0
        ? await readKey(floorPointerKey(requestedFloor), {})
        : { found: false, value: undefined };
      const headRead = await readKey('state:head', {});
      if (!headRead.found) {
        await assertCurrentFloor(requestedFloor);
        hotState = clone(initialState);
        head = null;
        floor = normalizeFloor(request.message);
        loaded = true;
        lastError = '';
        return result('committed', { hotState: clone(hotState), head: null, floor, empty: true, backend: opened.backend, stableChatId: opened.stableChatId });
      }
      if (!validHead(headRead.value)) throw new ProviderError('HEAD_INVALID');
      const persistedHead = headRead.value;
      latestRevision = Math.max(latestRevision, persistedHead.revision);
      let targetRevision = persistedHead.revision;
      if (branchRead.found && validFloorPointer(branchRead.value, requestedFloor) && branchRead.value.revision <= persistedHead.revision) targetRevision = branchRead.value.revision;
      const targetRevisionRead = await readKey(`state:revision:${targetRevision}`, { schemaVersion: SCHEMA_VERSION, kind: 'revision', revision: targetRevision });
      if (!targetRevisionRead.found || !validRevision(targetRevisionRead.value, targetRevision)) throw new ProviderError('REVISION_HEAD_INVALID');
      const reverseRecords = [targetRevisionRead.value];
      let cursor = targetRevisionRead.value;
      while (cursor.mode !== 'checkpoint') {
        if (reverseRecords.length > 20 || !Number.isInteger(cursor.parent)) throw new ProviderError('REVISION_WINDOW_EXCEEDED');
        const parentRevision = cursor.parent;
        const parentRead = await readKey(`state:revision:${parentRevision}`, { schemaVersion: SCHEMA_VERSION, kind: 'revision', revision: parentRevision });
        if (!parentRead.found || !validRevision(parentRead.value, parentRevision)) throw new ProviderError('REVISION_CHAIN_INVALID');
        cursor = parentRead.value;
        reverseRecords.push(cursor);
      }
      if (reverseRecords.length > 20 || reverseRecords[reverseRecords.length - 1].mode !== 'checkpoint') throw new ProviderError('CHECKPOINT_MISSING');
      const records = reverseRecords.reverse();
      const checkpointRevision = records[0].revision;
      if (records.some(record => record.mode === 'patch' && record.checkpointRevision !== checkpointRevision)) throw new ProviderError('REVISION_CHAIN_INVALID');
      let state = normalizeState(records[0].checkpoint);
      let targetIndex = records.length - 1;
      if (requestedFloor.absoluteIndex >= 0) {
        targetIndex = -1;
        let targetAbsoluteIndex = -1;
        for (let index = records.length - 1; index >= 0; index -= 1) {
          const candidateFloor = normalizeFloor(records[index].floor);
          if (!floorCompatible(candidateFloor, requestedFloor) || candidateFloor.absoluteIndex < targetAbsoluteIndex) continue;
          targetIndex = index;
          targetAbsoluteIndex = candidateFloor.absoluteIndex;
        }
        if (targetIndex < 0) {
          await assertCurrentFloor(requestedFloor);
          hotState = clone(initialState);
          head = null;
          floor = requestedFloor;
          loaded = true;
          lastError = '';
          return result('committed', { hotState: clone(hotState), head: null, floor, branchReset: true, backend: opened.backend, stableChatId: opened.stableChatId });
        }
      }
      const target = records[targetIndex];
      const targetHead = {
        schemaVersion: SCHEMA_VERSION,
        kind: 'head',
        revision: target.revision,
        parent: target.parent ?? null,
        checkpointRevision: target.mode === 'checkpoint' ? target.revision : checkpointRevision,
        floor: target.floor,
        mode: target.mode,
      };
      state = normalizeState(records[0].checkpoint);
      for (let index = 1; index <= targetIndex; index += 1) {
        const record = records[index];
        state = record.mode === 'checkpoint' ? normalizeState(record.checkpoint) : normalizeState(applyPatch(state, record.patch));
      }
      await assertCurrentFloor(requestedFloor);
      hotState = state;
      head = clone(targetHead);
      floor = normalizeFloor(target.floor);
      loaded = true;
      lastError = '';
      return result('committed', { hotState: clone(hotState), head: clone(head), floor, backend: opened.backend, stableChatId: opened.stableChatId });
    }

    async function commitNow(request = {}) {
      assertLive();
      if (!loaded || hotState === null) throw new ProviderError('STATE_NOT_LOADED');
      const previousState = clone(hotState);
      const nextState = request.fullState === undefined
        ? (typeof request.updater === 'function' ? normalizeState(request.updater(clone(hotState))) : null)
        : normalizeState(request.fullState);
      if (nextState === null) throw new ProviderError('FULL_STATE_REQUIRED');
      const nextFloor = normalizeFloor(request.message);
      await assertCurrentFloor(nextFloor);
      if (jsonEqual(previousState, nextState)) {
        lastError = '';
        return result('committed', { skipped: true, revision: head?.revision || 0, hotState: clone(hotState), head: clone(head), floor, backend: opened.backend, stableChatId: opened.stableChatId });
      }
      let revision = latestRevision + 1;
      while ((await readKey(`state:revision:${revision}`, {})).found) revision += 1;
      const parent = head?.revision ?? null;
      latestRevision = revision;
      const patch = createPatch(previousState, nextState);
      const fullSize = Math.max(1, JSON.stringify(nextState).length);
      const patchSize = JSON.stringify(patch).length;
      const checkpointBase = head?.checkpointRevision || 0;
      const checkpoint = !head || revision - checkpointBase >= 20 || patchSize > fullSize * 0.35;
      const record = {
        schemaVersion: SCHEMA_VERSION,
        kind: 'revision',
        revision,
        parent,
        checkpointRevision: checkpoint ? revision : checkpointBase,
        mode: checkpoint ? 'checkpoint' : 'patch',
        floor: nextFloor,
      };
      if (checkpoint) record.checkpoint = clone(nextState);
      else record.patch = patch;
      const nextHead = {
        schemaVersion: SCHEMA_VERSION,
        kind: 'head',
        revision,
        parent,
        checkpointRevision: record.checkpointRevision,
        floor: nextFloor,
        mode: record.mode,
      };
      const nextPointer = { schemaVersion: SCHEMA_VERSION, kind: 'floor', revision, floor: nextFloor };
      hotState = clone(nextState);
      let headWriteStarted = false;
      try {
        await assertCurrentFloor(nextFloor);
        await writeKey(`state:revision:${revision}`, record, { schemaVersion: SCHEMA_VERSION, kind: 'revision', revision });
        await assertCurrentFloor(nextFloor);
        await writeKey('state:floor', nextPointer, { schemaVersion: SCHEMA_VERSION, kind: 'floor', revision });
        await assertCurrentFloor(nextFloor);
        await writeKey(floorPointerKey(nextFloor), nextPointer, { schemaVersion: SCHEMA_VERSION, kind: 'floor', revision });
        await assertCurrentFloor(nextFloor);
        headWriteStarted = true;
        await writeKey('state:head', nextHead, { schemaVersion: SCHEMA_VERSION, kind: 'head', revision });
        const headRead = await readKey('state:head', { schemaVersion: SCHEMA_VERSION, kind: 'head', revision });
        if (!headRead.found || !jsonEqual(headRead.value, nextHead)) throw new ProviderError('HEAD_READBACK_MISMATCH');
        await assertCurrentFloor(nextFloor);
        head = nextHead;
        floor = nextFloor;
        lastError = '';
        return result('committed', { revision, parent, checkpoint, hotState: clone(hotState), head: clone(head), floor, backend: opened.backend, stableChatId: opened.stableChatId });
      } catch (error) {
        let durableHead = null;
        if (headWriteStarted && error?.code !== 'STALE_CHAT' && !invalidated && generationIsLive()) {
          try {
            const headProbe = await adapterSession.getJson({ namespace: NAMESPACE, key: 'state:head', verify: {} });
            if (headProbe.state === 'committed') durableHead = jsonEqual(headProbe.value, nextHead);
            else if (headProbe.state === 'not_committed' && headProbe.error === 'NOT_FOUND') durableHead = false;
          } catch (_) {}
        }
        if (durableHead === true && generationIsLive() && !invalidated) {
          hotState = clone(nextState);
          head = nextHead;
          floor = nextFloor;
          lastError = '';
          return result('committed', { revision, parent, checkpoint, recovered: true, hotState: clone(hotState), head: clone(head), floor, backend: opened.backend, stableChatId: opened.stableChatId });
        }
        hotState = previousState;
        if (headWriteStarted && durableHead === null) invalidated = true;
        throw error;
      }
    }

    const load = request => enqueue(() => loadNow(request).catch(operationFailure));
    const commit = request => enqueue(() => commitNow(request).catch(operationFailure));
    const handle = {
      version: VERSION,
      namespace: NAMESPACE,
      sessionId,
      backend: opened.backend,
      stableChatId: opened.stableChatId,
      chatGeneration: opened.chatGeneration,
      domainGeneration,
      load,
      commit,
      enqueueCommit: commit,
      enqueue: action => enqueue(() => action(handle)),
      getHotState: () => (hotState === null || invalidated ? null : clone(hotState)),
      getHead: () => (head === null ? null : clone(head)),
      getFloor: () => (floor === null ? null : clone(floor)),
      getQueueState: () => Object.freeze({ pending, busy: pending > 0 }),
      awaitIdle: () => queue.catch(() => undefined),
      getStatus: () => Object.freeze({
        phase: invalidated ? 'stale' : pending > 0 ? (loaded ? 'busy' : 'loading') : lastError ? 'failed' : loaded ? 'ready' : 'idle',
        pending,
        loaded,
        live: !invalidated && generationIsLive(),
        backend: opened.backend,
        stableChatId: opened.stableChatId,
        chatGeneration: opened.chatGeneration,
        domainGeneration,
        error: lastError,
        head: head === null ? null : clone(head),
        floor: floor === null ? null : clone(floor),
      }),
      isLive: () => !invalidated && generationIsLive(),
      invalidate: reason => {
        invalidated = true;
        lastError = reason || 'STALE_CHAT';
        return { state: 'stale_chat', error: reason || 'STALE_CHAT' };
      },
    };
    return Object.freeze(handle);
  }

  function findAdapter() {
    for (const candidate of collectWindows()) {
      const adapter = readField(candidate, '__LWCS_PERSISTENCE_ADAPTER_V1__');
      if (adapter
        && typeof adapter.openSession === 'function'
        && typeof adapter.registerBackend === 'function'
        && typeof adapter.getDomainGeneration === 'function'
        && typeof adapter.invalidateDomainGeneration === 'function') return adapter;
    }
    return null;
  }

  function currentFallbackChatId() {
    const snapshot = getChatContext();
    return String(snapshot.context?.chatId ?? snapshot.context?.chat_id ?? '').trim();
  }

  async function open(options = {}) {
    const adapter = findAdapter();
    if (!adapter) return result('unavailable', { error: 'PERSISTENCE_ADAPTER_UNAVAILABLE' });
    const fallbackStableChatId = String(options.fallbackStableChatId ?? currentFallbackChatId()).trim();
    if (!fallbackStableChatId) return result('unavailable', { error: 'FALLBACK_IDENTITY_UNAVAILABLE' });
    if (!isTauriTavern()) {
      try {
        adapter.registerBackend('mvu', 'st-message', createStMessageBackend());
      } catch (error) {
        return result('unavailable', { error: error.code || 'ST_MESSAGE_BACKEND_REGISTRATION_FAILED' });
      }
    }
    let opened;
    try {
      opened = await adapter.openSession({ domain: 'mvu', fallbackStableChatId });
    } catch (error) {
      return result('unavailable', { error: error?.code || error?.message || 'PERSISTENCE_BACKEND_UNAVAILABLE', stableChatId: fallbackStableChatId });
    }
    if (opened.state !== 'committed' || !opened.session) return result(opened.state, { error: opened.error || 'PERSISTENCE_BACKEND_UNAVAILABLE', backend: opened.backend, stableChatId: opened.stableChatId, chatGeneration: opened.chatGeneration, domainGeneration: opened.domainGeneration });
    if (!Number.isInteger(opened.domainGeneration) || !Number.isInteger(opened.session.domainGeneration)) return result('unavailable', { error: 'PERSISTENCE_DOMAIN_GENERATION_UNAVAILABLE', backend: opened.backend, stableChatId: opened.stableChatId, chatGeneration: opened.chatGeneration });
    const existingSession = sessions.get(opened.stableChatId);
    if (existingSession
      && existingSession.chatGeneration === opened.chatGeneration
      && existingSession.domainGeneration === opened.domainGeneration
      && existingSession.isLive()) return result('committed', { handle: existingSession, backend: opened.backend, stableChatId: opened.stableChatId, chatGeneration: opened.chatGeneration, domainGeneration: opened.domainGeneration });
    const handle = createSession(adapter, opened);
    sessions.set(opened.stableChatId, handle);
    return result('committed', { handle, backend: opened.backend, stableChatId: opened.stableChatId, chatGeneration: opened.chatGeneration, domainGeneration: opened.domainGeneration });
  }

  function invalidateChat(reason = 'CHAT_CHANGED') {
    sessions.forEach(session => session.invalidate(reason));
    const adapter = findAdapter();
    let chatGeneration = typeof adapter?.getChatGeneration === 'function' ? adapter.getChatGeneration() : null;
    let domainGeneration = typeof adapter?.getDomainGeneration === 'function' ? adapter.getDomainGeneration('mvu') : null;
    if (String(reason).toLowerCase() === 'chat_changed') {
      if (typeof adapter?.invalidateChatGeneration === 'function') chatGeneration = adapter.invalidateChatGeneration();
    } else if (typeof adapter?.invalidateDomainGeneration === 'function') {
      domainGeneration = adapter.invalidateDomainGeneration('mvu');
    }
    return { state: 'stale_chat', error: reason, chatGeneration, domainGeneration };
  }

  async function awaitIdle() {
    await Promise.all([...sessions.values()].map(session => session.awaitIdle()));
  }

  function getStatus() {
    return Object.freeze([...sessions.values()].map(session => session.getStatus()));
  }

  const provider = Object.freeze({
    version: VERSION,
    namespace: NAMESPACE,
    schemaVersion: SCHEMA_VERSION,
    statuses: STATES,
    open,
    invalidateChat,
    awaitIdle,
    getStatus,
  });
  for (const candidate of collectWindows()) {
    try { candidate[GLOBAL_KEY] = provider; } catch (_) {}
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);

;
/* source: LWCS_MVU_Prompt_Projector.js */
(function (root) {
  'use strict';

  const GLOBAL_KEY = '__LWCS_MVU_PROMPT_PROJECTOR_V1__';
  const VERSION = 1;
  function collectWindows() {
    const windows = [];
    const add = candidate => {
      if (candidate && (typeof candidate === 'object' || typeof candidate === 'function') && !windows.includes(candidate)) windows.push(candidate);
    };
    add(root);
    try { add(root.window); } catch (_) {}
    try { add(root.parent); } catch (_) {}
    try { add(root.top); } catch (_) {}
    return windows;
  }

  const existing = collectWindows().map(candidate => candidate[GLOBAL_KEY]).find(value => typeof value === 'function');
  if (existing) {
    collectWindows().forEach(candidate => {
      try { candidate[GLOBAL_KEY] = existing; } catch (_) {}
    });
    return;
  }

  const ACTIVE_STATUSES = new Set(['进行中', '待接取', '已接取', '开放', 'active', 'pending', 'running', 'open']);
  const CLOSED_STATUSES = new Set(['已完成', '完成', '已失败', '失败', '已放弃', '放弃', '关闭', '结束', 'closed', 'failed', 'completed']);
  const PLAYER_FIELDS = ['等级', '魂力', '魂力上限', '精神力', '精神力上限', '修为', '境界', '生命', '当前生命', '状态', '位置', '所属势力', '主身份'];
  const ENTITY_FIELDS = ['名称', '姓名', '名字', '类型', '描述', '现状描述', '状态', '位置', '所属势力', '势力', '身份', '关系'];
  const LOCATION_FIELDS = ['类型', '描述', '现状描述', '掌控势力', '状态', '归属父节点', '经济状况', 'x', 'y'];
  const ITEM_FIELDS = ['名称', '分类', '物品分类', '数量', '品质', '品级', '描述', '状态', '剩余使用次数', '有效期至tick'];

  function isObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function text(value, fallback = '') {
    const result = value === undefined || value === null ? '' : String(value).trim();
    return result || fallback;
  }

  function cloneWithoutStatData(value, seen = []) {
    if (value === null || typeof value !== 'object') return value;
    if (seen.includes(value)) return '[循环引用已省略]';
    if (Array.isArray(value)) return value.map(item => cloneWithoutStatData(item, seen.concat([value])));
    const output = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === 'stat_data') continue;
      output[key] = cloneWithoutStatData(child, seen.concat([value]));
    }
    return output;
  }

  function pick(source, fields) {
    if (!isObject(source)) return {};
    const output = {};
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(source, field)) output[field] = cloneWithoutStatData(source[field]);
    }
    return output;
  }

  function displayName(source, fallback = '') {
    if (typeof source === 'string') return source;
    return text(source?.名称 || source?.姓名 || source?.名字 || source?.name || source?.id, fallback);
  }

  function compactRecord(name, source, fields = ENTITY_FIELDS) {
    const output = pick(source, fields);
    const label = displayName(source, text(name));
    if (label) output.name = label;
    return cloneWithoutStatData(output);
  }

  function entries(value) {
    if (Array.isArray(value)) return value.map((record, index) => [String(index), record]);
    return isObject(value) ? Object.entries(value) : [];
  }

  function activeStatus(record) {
    const status = text(record?.状态 || record?.status, '');
    if (!status) return true;
    if (CLOSED_STATUSES.has(status)) return false;
    return ACTIVE_STATUSES.has(status) || !['已归档', '已结算', '休市'].includes(status);
  }

  function findLocationName(state, context, player) {
    return text(
      context.currentLocation || context.location || player?.状态?.位置 || player?.位置 || state?.world?.当前地点,
      '未知地点',
    );
  }

  function findLocationRecord(state, locationName) {
    const world = isObject(state?.world) ? state.world : {};
    return world.地点?.[locationName] || world.动态地点?.[locationName] || null;
  }

  function addNamedRecord(output, seen, name, record, kind, fields = ENTITY_FIELDS) {
    const label = displayName(record, text(name));
    if (!label || seen.has(`${kind}:${label}`)) return;
    seen.add(`${kind}:${label}`);
    output.push({ kind, ...compactRecord(label, record, fields) });
  }

  function collectPresentEntities(state, context, locationName, playerName) {
    const output = [];
    const seen = new Set();
    const location = findLocationRecord(state, locationName);
    const localSources = [
      context.presentEntities,
      location?.在场实体,
      location?.在场角色,
      location?.角色,
      location?.实体,
    ];
    for (const source of localSources) {
      for (const [name, record] of entries(source)) addNamedRecord(output, seen, name, isObject(record) ? record : { 名称: record }, 'present');
    }
    for (const [name, record] of entries(state?.char)) {
      if (!isObject(record) || text(record?.状态?.位置 || record?.位置) !== locationName) continue;
      if (displayName(record, name) === playerName) continue;
      addNamedRecord(output, seen, name, record, 'present');
    }
    return output.slice(0, 32);
  }

  function findMentionedNames(state, context) {
    const explicit = Array.isArray(context.mentionedEntities) ? context.mentionedEntities : [];
    const names = explicit.map(value => displayName(value, text(value))).filter(Boolean);
    if (names.length > 0) return [...new Set(names)].slice(0, 32);
    const content = text(context.text || context.prompt || context.message, '');
    if (!content) return [];
    const candidates = [
      ...Object.keys(isObject(state?.char) ? state.char : {}),
      ...Object.keys(isObject(state?.org) ? state.org : {}),
      ...Object.keys(isObject(state?.world?.地点) ? state.world.地点 : {}),
      ...Object.keys(isObject(state?.world?.动态地点) ? state.world.动态地点 : {}),
      ...Object.keys(isObject(state?.物品) ? state.物品 : {}),
    ];
    return [...new Set(candidates.filter(name => name.length > 1 && content.includes(name)))].slice(0, 32);
  }

  function resolveMentionedEntities(state, context, playerName) {
    const output = [];
    const seen = new Set();
    for (const name of findMentionedNames(state, context)) {
      if (name === playerName) continue;
      const record = state?.char?.[name];
      if (record) addNamedRecord(output, seen, name, record, 'character');
      const faction = state?.org?.[name];
      if (faction) addNamedRecord(output, seen, name, faction, 'faction', ['类型', '描述', '现状描述', '影响力', '规模', '状态', '上级势力', '关系']);
      const location = state?.world?.地点?.[name] || state?.world?.动态地点?.[name];
      if (location) addNamedRecord(output, seen, name, location, 'location', LOCATION_FIELDS);
      const item = state?.物品?.[name];
      if (item) addNamedRecord(output, seen, name, item, 'item', ITEM_FIELDS);
      if (!record && !faction && !location && !item) output.push({ kind: 'mentioned', name });
    }
    return output.slice(0, 32);
  }

  function collectTasks(player, world) {
    const output = [];
    for (const [name, record] of entries(player?.我的任务)) {
      if (activeStatus(record)) output.push({ id: name, source: 'player', ...cloneWithoutStatData(record) });
    }
    for (const [name, record] of entries(world?.委托板)) {
      if (activeStatus(record)) output.push({ id: name, source: 'world', ...cloneWithoutStatData(record) });
    }
    return output.slice(0, 40);
  }

  function collectMatches(world) {
    const output = [];
    if (world?.战斗?.进行中) output.push({ id: '当前战斗', source: '战斗', ...cloneWithoutStatData(world.战斗) });
    for (const [name, record] of entries(world?.赛事)) {
      if (activeStatus(record)) output.push({ id: name, source: '赛事', ...cloneWithoutStatData(record) });
    }
    return output.slice(0, 24);
  }

  function collectItems(player, context) {
    const output = [];
    const sources = [player?.背包, player?.物品, context.items];
    for (const source of sources) {
      for (const [name, record] of entries(source)) {
        const item = isObject(record) ? record : { 数量: record };
        const quantity = Number(item.数量 ?? item.数量总计 ?? 1);
        if (Number.isFinite(quantity) && quantity <= 0) continue;
        output.push({ id: name, ...compactRecord(name, item, ITEM_FIELDS) });
      }
    }
    const seen = new Set();
    return output.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }).slice(0, 50);
  }

  function project(fullState, context = {}) {
    const state = isObject(fullState) ? fullState : {};
    const world = isObject(state.world) ? state.world : {};
    const playerName = text(context.playerName || state.sys?.玩家名, '无名氏');
    const player = state.char?.[playerName] || Object.values(isObject(state.char) ? state.char : {}).find(record => record?.__mvu_isPlayer) || {};
    const locationName = findLocationName(state, context, player);
    const location = findLocationRecord(state, locationName);
    const projection = {
      version: VERSION,
      player: {
        name: playerName,
        location: locationName,
        state: cloneWithoutStatData(player?.状态 || {}),
        summary: pick(player, PLAYER_FIELDS),
      },
      location: {
        name: locationName,
        record: pick(location, LOCATION_FIELDS),
      },
      presentEntities: collectPresentEntities(state, context, locationName, playerName),
      mentionedEntities: resolveMentionedEntities(state, context, playerName),
      activeTasks: collectTasks(player, world),
      activeMatches: collectMatches(world),
      items: collectItems(player, context),
      world: {
        time: cloneWithoutStatData(world.时间 || {}),
        timeline: entries(world.时间线).filter(([, record]) => activeStatus(record)).slice(0, 24).map(([id, record]) => ({ id, ...cloneWithoutStatData(record) })),
        systemNotice: text(state.sys?.系统播报, ''),
      },
    };
    return cloneWithoutStatData(projection);
  }

  const projector = Object.freeze(project);
  collectWindows().forEach(candidate => {
    try { candidate[GLOBAL_KEY] = projector; } catch (_) {}
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);

;
/* source: LibraryData_Runtime.js */
!(function (global) {
  'use strict';

  const VERSION = '2.0.0';
  const MINUTES_PER_DAY = 24 * 60;
  const DAYS_PER_MONTH = 30;
  const MONTHS_PER_YEAR = 12;
  const MINUTES_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR * MINUTES_PER_DAY;
  const MINUTES_PER_TICK = 10;
  const TICKS_PER_YEAR = MINUTES_PER_YEAR / MINUTES_PER_TICK;
  const TICKS_PER_MILLENNIUM = 1000 * TICKS_PER_YEAR;
  const LEGACY_TICK_FIELDS = new Set([
    '每年tick',
    'tick',
    '首次登场tick',
    '原著触发tick',
    '触发tick',
    '有效期tick',
    '时长tick',
    '调整tick',
    '保留时长tick',
    '死亡时限tick',
    '复活代价时限tick',
    '复活后状态时限tick',
  ]);
  const DATE_FIELDS = Object.freeze({
    时间: '触发tick',
    首次登场时间: '首次登场tick',
    原著发生时间: '原著触发tick',
    死亡时间: '死亡tick',
  });
  const DURATION_FIELDS = Object.freeze({
    时长: '时长tick',
    调整时长: '调整tick',
    保留时长: '保留时长tick',
    有效期: '有效期tick',
    死亡时限: '死亡时限tick',
    复活代价时限: '复活代价时限tick',
    复活后状态时限: '复活后状态时限tick',
  });
  const ITEM_USAGE_RECOVERY_CYCLES = new Set(['每日']);
  const PROFILES = Object.freeze({
    dldl: Object.freeze({ id: 'dldl', startYear: 0, epoch: '斗罗历0年1月1日00时00分' }),
    jueshitangmen: Object.freeze({ id: 'jueshitangmen', startYear: 10000, epoch: '斗罗历10000年1月1日00时00分' }),
    current: Object.freeze({ id: 'current', startYear: 20000, epoch: '斗罗历20000年1月1日00时00分' }),
    zjdl: Object.freeze({ id: 'zjdl', startYear: 30000, epoch: '斗罗历30000年1月1日00时00分' }),
  });
  const ERA_TRANSITION_POINTS = Object.freeze([
    Object.freeze({ eraId: 'jueshitangmen', thresholdYear: 9800, thresholdTick: 9800 * TICKS_PER_YEAR }),
    Object.freeze({ eraId: 'current', thresholdYear: 19800, thresholdTick: 19800 * TICKS_PER_YEAR }),
    Object.freeze({ eraId: 'zjdl', thresholdYear: 29800, thresholdTick: 29800 * TICKS_PER_YEAR }),
  ]);
  const ERA_THRESHOLDS = Object.freeze({
    dldl: Object.freeze({ eraId: 'dldl', thresholdYear: 0, thresholdTick: 0 }),
    jueshitangmen: ERA_TRANSITION_POINTS[0],
    current: ERA_TRANSITION_POINTS[1],
    zjdl: ERA_TRANSITION_POINTS[2],
  });

  class LibraryContractError extends Error {
    constructor(code, profileId, path, value, message = code) {
      super(message);
      this.name = 'LibraryContractError';
      this.code = code;
      this.profileId = profileId;
      this.path = path || '$';
      this.value = value;
    }
  }

  function assertProfile(profileId) {
    const profile = PROFILES[profileId];
    if (!profile) throw new LibraryContractError('PROFILE_UNKNOWN', profileId, '$', profileId, `未知历法profile: ${profileId}`);
    return profile;
  }

  function fail(code, profileId, path, value, message) {
    throw new LibraryContractError(code, profileId, path, value, message);
  }

  function parseDateTime(value, profileId, path = '$') {
    const profile = assertProfile(profileId);
    if (typeof value !== 'string') fail('DATE_FORMAT_INVALID', profileId, path, value, '时间必须是斗罗历字符串');
    const match = /^斗罗历(\d+)年(\d{1,2})月(\d{1,2})日(\d{1,2})时(\d{1,2})分$/.exec(value.trim());
    if (!match) fail('DATE_FORMAT_INVALID', profileId, path, value, `非法斗罗历格式: ${value}`);
    const date = {
      年: Number(match[1]),
      月: Number(match[2]),
      日: Number(match[3]),
      时: Number(match[4]),
      分: Number(match[5]),
    };
    if (date.年 < profile.startYear || date.月 < 1 || date.月 > 12 || date.日 < 1 || date.日 > 30 || date.时 < 0 || date.时 > 23 || date.分 < 0 || date.分 > 59) {
      fail(date.年 < profile.startYear ? 'DATE_BEFORE_EPOCH' : 'DATE_RANGE_INVALID', profileId, path, value, `斗罗历日期越界: ${value}`);
    }
    date.规范文本 = formatDateTime(date, profileId, path);
    return Object.freeze(date);
  }

  function formatDateTime(value, profileId, path = '$') {
    const profile = assertProfile(profileId);
    if (!value || typeof value !== 'object') fail('DATE_FORMAT_INVALID', profileId, path, value, '日期对象无效');
    const date = {
      年: Number(value.年),
      月: Number(value.月),
      日: Number(value.日),
      时: Number(value.时),
      分: Number(value.分),
    };
    if (![date.年, date.月, date.日, date.时, date.分].every(Number.isInteger)) fail('DATE_FORMAT_INVALID', profileId, path, value, '日期字段必须是整数');
    if (date.年 < profile.startYear) fail('DATE_BEFORE_EPOCH', profileId, path, value, '日期早于profile起点');
    if (date.月 < 1 || date.月 > 12 || date.日 < 1 || date.日 > 30 || date.时 < 0 || date.时 > 23 || date.分 < 0 || date.分 > 59) {
      fail('DATE_RANGE_INVALID', profileId, path, value, '日期字段超出斗罗历范围');
    }
    return `斗罗历${date.年}年${date.月}月${date.日}日${String(date.时).padStart(2, '0')}时${String(date.分).padStart(2, '0')}分`;
  }

  function dateToMinutes(date) {
    return date.年 * MINUTES_PER_YEAR + (date.月 - 1) * DAYS_PER_MONTH * MINUTES_PER_DAY + (date.日 - 1) * MINUTES_PER_DAY + date.时 * 60 + date.分;
  }

  function toTick(value, profileId, path = '$') {
    const profile = assertProfile(profileId);
    const date = typeof value === 'string' ? parseDateTime(value, profileId, path) : value;
    if (!date || typeof date !== 'object' || !['年', '月', '日', '时', '分'].every(key => Number.isInteger(Number(date[key])))) {
      fail('DATE_FORMAT_INVALID', profileId, path, value, '日期对象字段无效');
    }
    if (Number(date.年) < profile.startYear) fail('DATE_BEFORE_EPOCH', profileId, path, value, '日期早于profile起点');
    if (Number(date.月) < 1 || Number(date.月) > 12 || Number(date.日) < 1 || Number(date.日) > 30 || Number(date.时) < 0 || Number(date.时) > 23 || Number(date.分) < 0 || Number(date.分) > 59) {
      fail('DATE_RANGE_INVALID', profileId, path, value, '日期字段超出斗罗历范围');
    }
    const minutes = dateToMinutes(date);
    if (minutes < 0) fail('DATE_BEFORE_EPOCH', profileId, path, value, '日期早于profile起点');
    if (!Number.isSafeInteger(minutes)) fail('TICK_INVALID', profileId, path, value, '日期无法转换为安全tick');
    return minutes / MINUTES_PER_TICK;
  }

  function fromTick(value, profileId, path = '$') {
    const profile = assertProfile(profileId);
    const tick = assertAbsoluteTick(value, path);
    const totalMinutes = Math.round(tick * MINUTES_PER_TICK);
    let remainder = totalMinutes;
    const year = Math.floor(remainder / MINUTES_PER_YEAR);
    if (year < profile.startYear) fail('DATE_BEFORE_EPOCH', profileId, path, value, 'tick对应日期早于profile起点');
    remainder %= MINUTES_PER_YEAR;
    const month = Math.floor(remainder / (DAYS_PER_MONTH * MINUTES_PER_DAY)) + 1;
    remainder %= DAYS_PER_MONTH * MINUTES_PER_DAY;
    const day = Math.floor(remainder / MINUTES_PER_DAY) + 1;
    remainder %= MINUTES_PER_DAY;
    const hour = Math.floor(remainder / 60);
    const minute = remainder % 60;
    return formatDateTime({ 年: year, 月: month, 日: day, 时: hour, 分: minute }, profileId, path);
  }

  function durationToTicks(value, profileId, path = '$') {
    assertProfile(profileId);
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('DURATION_INVALID', profileId, path, value, '持续时间必须是结构化对象');
    const units = ['年', '月', '日', '时', '分'];
    const parts = units.map(unit => {
      const number = value[unit] === undefined ? 0 : Number(value[unit]);
      if (!Number.isInteger(number) || number < 0) fail('DURATION_INVALID', profileId, `${path}.${unit}`, value[unit], '持续时间字段必须是非负整数');
      return number;
    });
    const minutes = parts[0] * MINUTES_PER_YEAR + parts[1] * DAYS_PER_MONTH * MINUTES_PER_DAY + parts[2] * MINUTES_PER_DAY + parts[3] * 60 + parts[4];
    if (!Number.isSafeInteger(minutes)) fail('DURATION_INVALID', profileId, path, value, '持续时间超出安全范围');
    return minutes / MINUTES_PER_TICK;
  }

  function assertAbsoluteTick(value, path = '$') {
    const tick = Number(value);
    const scaled = Math.round(tick * 10);
    if (!Number.isFinite(tick) || tick < 0 || !Number.isSafeInteger(scaled) || Math.abs(tick * 10 - scaled) > 1e-9) {
      fail('TICK_INVALID', 'absolute', path, value, '绝对tick必须是非负且保持0.1精度的安全数值');
    }
    return scaled / 10;
  }

  function resolveEraAtTick(tick) {
    const absoluteTick = assertAbsoluteTick(tick, '$.tick');
    for (let index = ERA_TRANSITION_POINTS.length - 1; index >= 0; index -= 1) {
      const point = ERA_TRANSITION_POINTS[index];
      if (absoluteTick >= point.thresholdTick) return point.eraId;
    }
    return 'dldl';
  }

  function transitionRecord(point, direction) {
    return Object.freeze({
      eraId: point.eraId,
      thresholdYear: point.thresholdYear,
      thresholdTick: point.thresholdTick,
      direction,
    });
  }

  function getEraTransitions(previousTick, currentTick) {
    const previous = assertAbsoluteTick(previousTick, '$.previousTick');
    const current = assertAbsoluteTick(currentTick, '$.currentTick');
    if (previous === current) return [];
    if (current > previous) {
      return ERA_TRANSITION_POINTS
        .filter(point => point.thresholdTick > previous && point.thresholdTick <= current)
        .map(point => transitionRecord(point, 'forward'));
    }
    return ERA_TRANSITION_POINTS
      .filter(point => point.thresholdTick > current && point.thresholdTick <= previous)
      .sort((left, right) => right.thresholdTick - left.thresholdTick)
      .map(point => transitionRecord(point, 'backward'));
  }

  function cultivationBlend(current, zjdl, mode, stage, absorptionTick = null) {
    return Object.freeze({ current, zjdl, mode, stage, absorptionTick });
  }

  function getCultivationEraBlend(tick, options = undefined) {
    const absoluteTick = assertAbsoluteTick(tick, '$.tick');
    const settings = options === undefined ? {} : options;
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      fail('BLEND_OPTIONS_INVALID', 'absolute', '$.options', options, '修炼时代渐变参数必须是对象');
    }
    if (Object.prototype.hasOwnProperty.call(settings, 'directZJDL') && typeof settings.directZJDL !== 'boolean') {
      fail('BLEND_OPTIONS_INVALID', 'absolute', '$.options.directZJDL', settings.directZJDL, 'directZJDL必须是布尔值');
    }
    if (settings.directZJDL === true) return cultivationBlend(0, 1, 'direct-zjdl', 10);
    if (settings.deepAbyssAbsorptionTick === undefined || settings.deepAbyssAbsorptionTick === null) {
      return cultivationBlend(1, 0, 'no-absorption-event', 0);
    }
    const absorptionTick = assertAbsoluteTick(settings.deepAbyssAbsorptionTick, '$.options.deepAbyssAbsorptionTick');
    if (absoluteTick < absorptionTick) return cultivationBlend(1, 0, 'before-absorption', 0, absorptionTick);
    const stage = Math.min(10, 1 + Math.floor((absoluteTick - absorptionTick) / TICKS_PER_MILLENNIUM));
    const zjdl = stage / 10;
    return cultivationBlend(1 - zjdl, zjdl, 'progressive', stage, absorptionTick);
  }

  function clone(value, seen = new WeakMap()) {
    if (!value || typeof value !== 'object') return value;
    if (seen.has(value)) return seen.get(value);
    const output = Array.isArray(value) ? [] : {};
    seen.set(value, output);
    Object.keys(value).forEach(key => { output[key] = clone(value[key], seen); });
    return output;
  }

  function freezeDeep(value, seen = new WeakSet()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return value;
    seen.add(value);
    Object.keys(value).forEach(key => freezeDeep(value[key], seen));
    return Object.freeze(value);
  }

  function assertAuthorSource(value, profileId, path = '$', seen = new WeakSet()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    Object.keys(value).forEach(key => {
      if (LEGACY_TICK_FIELDS.has(key)) fail('TICK_INVALID', profileId, `${path}.${key}`, value[key], `作者源禁止旧tick字段: ${key}`);
      assertAuthorSource(value[key], profileId, `${path}.${key}`, seen);
    });
  }

  function compileDates(value, profileId, path = '$') {
    if (Array.isArray(value)) return value.map((item, index) => compileDates(item, profileId, `${path}[${index}]`));
    if (!value || typeof value !== 'object') return value;
    const output = {};
    Object.keys(value).forEach(key => {
      const childPath = `${path}.${key}`;
      output[key] = compileDates(value[key], profileId, childPath);
      const derivedKey = DATE_FIELDS[key];
      if (derivedKey && value[key] !== null && value[key] !== undefined) output[derivedKey] = toTick(value[key], profileId, childPath);
    });
    return output;
  }

  function compileItemDurations(value, profileId, path = '$') {
    if (Array.isArray(value)) return value.map((item, index) => compileItemDurations(item, profileId, `${path}[${index}]`));
    if (!value || typeof value !== 'object') return value;
    if (Object.prototype.hasOwnProperty.call(value, '使用次数恢复周期')) {
      if (typeof value.使用次数恢复周期 !== 'string' || !ITEM_USAGE_RECOVERY_CYCLES.has(value.使用次数恢复周期.trim())) {
        fail('LIBRARY_FIELD_INVALID', `${path}.使用次数恢复周期`, value.使用次数恢复周期, '使用次数恢复周期只允许每日');
      }
    }
    if (Object.prototype.hasOwnProperty.call(value, '使用后消耗') && typeof value.使用后消耗 !== 'boolean') {
      fail('LIBRARY_FIELD_INVALID', `${path}.使用后消耗`, value.使用后消耗, '使用后消耗必须是布尔值');
    }
    const output = {};
    Object.keys(value).forEach(key => {
      const childPath = `${path}.${key}`;
      output[key] = compileItemDurations(value[key], profileId, childPath);
      const derivedKey = DURATION_FIELDS[key];
      if (derivedKey && value[key] !== null && value[key] !== undefined) output[derivedKey] = durationToTicks(value[key], profileId, childPath);
    });
    return output;
  }

  const compiledTimelineSources = new WeakSet();

  function compileCharacterLibrary(source, profileId) {
    assertProfile(profileId);
    if (!source || typeof source !== 'object') fail('REFERENCE_UNRESOLVED', profileId, '$', source, '角色库不是对象');
    assertAuthorSource(source, profileId);
    const output = compileDates(source, profileId);
    output.每年tick = MINUTES_PER_YEAR / MINUTES_PER_TICK;
    if (!output.角色 || typeof output.角色 !== 'object') fail('REFERENCE_UNRESOLVED', profileId, '$.角色', output.角色, '角色库缺少角色表');
    Object.entries(output.角色).forEach(([角色名, 角色记录]) => {
      if (!角色记录 || typeof 角色记录 !== 'object') fail('REFERENCE_UNRESOLVED', profileId, `$.角色.${角色名}`, 角色记录, '角色记录不是对象');
      (Array.isArray(角色记录.快照) ? 角色记录.快照 : []).forEach((快照, index) => {
        const tick = Number(快照?.触发tick);
        if (!Number.isFinite(tick)) fail('TICK_INVALID', profileId, `$.角色.${角色名}.快照[${index}]`, 快照, '角色快照缺少合法时间');
        快照.tick = tick;
        delete 快照.触发tick;
      });
    });
    Object.entries(output.开场节点 || {}).forEach(([节点名, 节点]) => {
      const 角色名 = String(节点?.角色名 || '').trim();
      const 快照节点 = String(节点?.快照节点 || '').trim();
      const 快照 = output.角色?.[角色名]?.快照?.find(条目 => String(条目?.节点 || '').trim() === 快照节点);
      if (!快照) fail('REFERENCE_UNRESOLVED', profileId, `$.开场节点.${节点名}`, 节点, `开场节点未绑定有效角色快照: ${角色名 || '空角色'}/${快照节点 || '空节点'}`);
      节点.时间 = 快照.时间;
      节点.tick = 快照.tick;
      delete 节点.触发tick;
    });
    return freezeDeep(output);
  }

  function sortTimelineArray(items, profileId, path) {
    return items
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const left = Number(a.item?.触发tick);
        const right = Number(b.item?.触发tick);
        if (!Number.isFinite(left) || !Number.isFinite(right)) fail('TICK_INVALID', profileId, path, a.item, '时间线事件缺少合法触发tick');
        return left - right || a.index - b.index;
      })
      .map(entry => entry.item);
  }

  function compileTimeline(source, profileId) {
    assertProfile(profileId);
    if (!source || typeof source !== 'object') fail('REFERENCE_UNRESOLVED', profileId, '$', source, '时间线不是对象');
    assertAuthorSource(source, profileId);
    const output = compileDates(source, profileId);
    const walk = (value, path) => {
      if (Array.isArray(value)) {
        const mapped = value.map((item, index) => walk(item, `${path}[${index}]`));
        return mapped.length && mapped.every(item => item && typeof item === 'object' && item.触发tick !== undefined)
          ? sortTimelineArray(mapped, profileId, path)
          : mapped;
      }
      if (!value || typeof value !== 'object') return value;
      Object.keys(value).forEach(key => { value[key] = walk(value[key], `${path}.${key}`); });
      return value;
    };
    const compiled = freezeDeep(walk(output, '$'));
    compiledTimelineSources.add(compiled);
    return compiled;
  }

  function intervalMatches(record, atTime, context, profileId, path) {
    const atTick = atTime === undefined || atTime === null ? null : (typeof atTime === 'number' ? atTime : toTick(atTime, profileId, path));
    if (record.开始时间 && atTick !== null && atTick < toTick(record.开始时间, profileId, `${path}.开始时间`)) return false;
    if (record.结束时间 && atTick !== null && atTick >= toTick(record.结束时间, profileId, `${path}.结束时间`)) return false;
    if (Array.isArray(record.上下文) && record.上下文.length) {
      const tags = new Set(Array.isArray(context) ? context : (typeof context === 'string' ? [context] : []));
      if (!record.上下文.every(tag => tags.has(tag))) return false;
    }
    return true;
  }

  function resolveIdentity(library, query, profileId, options = {}) {
    assertProfile(profileId);
    if (!library || typeof library !== 'object' || !library.角色 || typeof library.角色 !== 'object') fail('REFERENCE_UNRESOLVED', profileId, '$.角色', library, '身份解析缺少角色库');
    const input = query && typeof query === 'object' ? query : { 名称: query };
    const name = String(input.名称 || input.name || '').trim();
    const atTime = input.atTime ?? input.时间 ?? options.atTime;
    const context = input.context ?? input.上下文 ?? options.context;
    if (!name) return { status: 'unresolved', key: null, candidates: [] };
    const entries = Object.entries(library.角色);
    const exact = entries.filter(([key]) => key === name);
    if (exact.length === 1) return { status: 'resolved', key: exact[0][0], reason: 'exact-key' };
    if (exact.length > 1) return { status: 'conflict', key: null, candidates: exact.map(([key]) => key), reason: 'exact-key' };
    const titleRecords = entries.flatMap(([key, record]) => (Array.isArray(record.称号) ? record.称号 : []).filter(title => title && title.名称 === name).map(title => ({ key, record, title, reason: 'title' })));
    const titleNeedsTime = titleRecords.some(item => item.title.开始时间 || item.title.结束时间);
    if ((atTime === undefined || atTime === null) && titleNeedsTime && titleRecords.length) {
      return { status: 'conflict', key: null, candidates: titleRecords.map(item => item.key), reason: 'title-time-required' };
    }
    const titleCandidates = titleRecords.filter(item => intervalMatches(item.title, atTime, context, profileId, `$.角色.${item.key}.称号`));
    if (titleCandidates.length === 1) return { status: 'resolved', key: titleCandidates[0].key, reason: 'title' };
    if (titleCandidates.length > 1) return { status: 'conflict', key: null, candidates: titleCandidates.map(item => item.key), reason: 'title' };
    const disguiseCandidates = entries.flatMap(([key, record]) => (Array.isArray(record.伪装身份) ? record.伪装身份 : []).filter(identity => identity && identity.名称 === name && intervalMatches(identity, atTime, context, profileId, `$.角色.${key}.伪装身份`)).map(() => ({ key, record, reason: 'disguise' })));
    if (disguiseCandidates.length === 1) return { status: 'resolved', key: disguiseCandidates[0].key, reason: 'disguise' };
    if (disguiseCandidates.length > 1) return { status: 'conflict', key: null, candidates: disguiseCandidates.map(item => item.key), reason: 'disguise' };
    const aliases = entries.filter(([, record]) => Array.isArray(record.别名) && record.别名.includes(name)).map(([key]) => key);
    if (aliases.length === 1) return { status: 'resolved', key: aliases[0], reason: 'alias' };
    if (aliases.length > 1) return { status: 'conflict', key: null, candidates: aliases, reason: 'alias' };
    return { status: 'unresolved', key: null, candidates: [] };
  }

  const FACTION_STATUSES = new Set(['正常', '鼎盛', '衰落', '隐世', '蛰伏', '戒备', '濒危']);
  const LOCATION_STRATEGIES = new Set(['insert', 'replace']);
  const LOCATION_ECONOMIES = new Set(['繁荣', '普通', '萧条', '未知']);
  const FACTION_RECORD_KEYS = new Set(['类型', '别名', '关键词', '描述', '现状描述', '影响力', '规模', '状态', '上级势力', '关系', '战力统计']);
  const FACTION_RELATION_KEYS = new Set(['态度']);
  const FACTION_BATTLE_KEYS = new Set(['极限斗罗', '超级斗罗', '封号斗罗']);
  const LOCATION_RECORD_KEYS = new Set(['规范名', '目标路径', '实例化策略', '节点']);
  const LOCATION_NODE_KEYS = new Set(['类型', '别名', '关键词', '描述', '现状描述', '掌控势力', '状态', '人口', '守护军团', '经济状况', 'x', 'y', '商店']);
  const GENERIC_HIT_TERMS = new Set(['学院', '城市', '军团', '协会', '家族', '帝国', '大陆', '总部', '分部', '组织', '地点', '宗门']);
  const compiledFactionMeta = new WeakMap();
  const compiledLocationMeta = new WeakMap();
  let defaultFactionLibrary = null;
  let defaultLocationLibrary = null;
  const ERA_IDS = new Set(['dldl', 'jueshitangmen', 'current', 'zjdl']);

  function libraryFail(code, path, value, message) {
    fail(code, 'library', path, value, message);
  }

  function isPlainRecord(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function assertPlainRecord(value, path, label) {
    if (!isPlainRecord(value)) libraryFail('LIBRARY_TYPE_INVALID', path, value, `${label}必须是对象`);
  }

  function assertStrictKeys(value, allowed, path) {
    Object.keys(value).forEach(key => {
      if (!allowed.has(key)) libraryFail('LIBRARY_FIELD_UNKNOWN', `${path}.${key}`, value[key], `库字段未声明: ${key}`);
    });
  }

  function requiredString(value, path, label) {
    if (typeof value !== 'string' || !value.trim()) libraryFail('LIBRARY_FIELD_INVALID', path, value, `${label}必须是非空字符串`);
    return value.trim();
  }

  function optionalString(value, path, label) {
    if (value === undefined) return undefined;
    return requiredString(value, path, label);
  }

  function stringList(value, path, label) {
    if (!Array.isArray(value)) libraryFail('LIBRARY_FIELD_INVALID', path, value, `${label}必须是字符串数组`);
    const output = value.map((item, index) => requiredString(item, `${path}[${index}]`, label));
    if (new Set(output).size !== output.length) libraryFail('LIBRARY_DUPLICATE_ALIAS', path, value, `${label}不得重复`);
    return output;
  }

  function nonNegativeInteger(value, path, label, max = Number.MAX_SAFE_INTEGER) {
    if (!Number.isSafeInteger(value) || value < 0 || value > max) libraryFail('LIBRARY_NUMBER_INVALID', path, value, `${label}必须是范围内的非负整数`);
    return value;
  }

  function finiteNumber(value, path, label) {
    if (typeof value !== 'number' || !Number.isFinite(value)) libraryFail('LIBRARY_NUMBER_INVALID', path, value, `${label}必须是有限数值`);
    return value;
  }

  function jsonPointerSegment(value) {
    return String(value).replace(/~/g, '~0').replace(/\//g, '~1');
  }

  function pathKey(pathSegments) {
    return JSON.stringify(pathSegments);
  }

  function runtimeWindows() {
    const result = [global];
    try { if (global.parent && global.parent !== global) result.push(global.parent); } catch (_) {}
    try { if (global.top && global.top !== global && !result.includes(global.top)) result.push(global.top); } catch (_) {}
    return result;
  }

  function readEraIntegration() {
    for (const current of runtimeWindows()) {
      try {
        const integration = current?.__LWCS_ERA_RUNTIME_INTEGRATION_V1__;
        if (integration) return integration;
      } catch (_) {}
    }
    return null;
  }

  function readDataRootTick(dataRoot) {
    const value = dataRoot?.world?.时间?.tick;
    const tick = Number(value);
    return Number.isFinite(tick) && tick >= 0 ? tick : null;
  }

  function selectEraContext(options = {}) {
    const explicitEraId = typeof options.eraId === 'string' ? options.eraId.trim() : '';
    if (explicitEraId) {
      if (!ERA_IDS.has(explicitEraId)) {
        return { ok: false, status: 'failed', eraId: explicitEraId, selector: 'explicit-era', detail: `未知时代: ${explicitEraId}`, diagnostic: { code: 'ERA_UNKNOWN', selector: 'explicit-era' } };
      }
      return { ok: true, eraId: explicitEraId, selector: 'explicit-era', diagnostic: { selector: 'explicit-era' } };
    }

    const suppliedTick = options.absoluteTick === undefined || options.absoluteTick === null
      ? readDataRootTick(options.dataRoot)
      : Number(options.absoluteTick);
    if (Number.isFinite(suppliedTick) && suppliedTick >= 0) {
      const integration = readEraIntegration();
      if (!integration || typeof integration.getEraContext !== 'function') {
        return { ok: false, status: 'failed', eraId: null, selector: 'tick-context', detail: 'EraRuntime_Integration尚未注册', diagnostic: { code: 'ERA_CONTEXT_NOT_READY', selector: 'tick-context', tick: suppliedTick } };
      }
      try {
        const context = integration.getEraContext(suppliedTick, { dataRoot: options.dataRoot });
        return {
          ok: true,
          eraId: context.resourceEra,
          selector: 'context-resource-era',
          tick: suppliedTick,
          context,
          diagnostic: { selector: 'context-resource-era', tick: suppliedTick, narrativeEra: context.narrativeEra, resourceEra: context.resourceEra },
        };
      } catch (error) {
        return { ok: false, status: 'failed', eraId: null, selector: 'tick-context', detail: error?.message || String(error), diagnostic: { code: 'ERA_CONTEXT_FAILED', selector: 'tick-context', tick: suppliedTick } };
      }
    }

    return { ok: true, eraId: 'current', selector: 'implicit-current', diagnostic: { code: 'IMPLICIT_CURRENT', selector: 'implicit-current', detail: '未提供时代或可读tick，按current本地调用处理' } };
  }

  function compileResolvedLibrary(source, type) {
    if (type === 'faction') return compiledFactionMeta.has(source) ? source : compileFactionLibrary(source);
    return compiledLocationMeta.has(source) ? source : compileLocationLibrary(source);
  }

  function resolutionDiagnostic(selection, type, resourceStatus, source) {
    return {
      selector: selection.selector,
      source: source || null,
      resourceType: type,
      resourceStatus,
      ...(selection.diagnostic || {}),
    };
  }

  function resolveEraLibrary(library, type, options = {}) {
    const selection = selectEraContext(options);
    if (!selection.ok) {
      return {
        status: selection.status,
        library: null,
        eraId: selection.eraId,
        resourceType: type,
        resourceStatus: selection.status,
        detail: selection.detail || '',
        diagnostic: resolutionDiagnostic(selection, type, selection.status, null),
      };
    }
    const 未就绪标记 = library && typeof library === 'object' ? library.__LWCS_RESOURCE_NOT_READY__ : null;
    if (未就绪标记 && typeof 未就绪标记 === 'object') {
      const 资源状态 = String(未就绪标记.status || 'unloaded');
      return {
        status: 'unloaded',
        library: null,
        eraId: selection.eraId,
        resourceType: type,
        resourceStatus: 资源状态,
        detail: String(未就绪标记.detail || 未就绪标记.reason || '时代资源尚未加载'),
        diagnostic: resolutionDiagnostic(selection, type, 资源状态, 'not-ready-placeholder'),
      };
    }

    const integration = readEraIntegration();
    if (selection.selector !== 'implicit-current') {
      if (!integration || typeof integration.getStaticSourceForEra !== 'function') {
        return {
          status: 'failed',
          library: null,
          eraId: selection.eraId,
          resourceType: type,
          resourceStatus: 'failed',
          detail: 'EraRuntime_Integration按时代取源接口尚未注册',
          diagnostic: resolutionDiagnostic(selection, type, 'failed', null),
        };
      }
      let sourceResult;
      try {
        sourceResult = integration.getStaticSourceForEra(selection.eraId, type);
      } catch (error) {
        return {
          status: 'failed',
          library: null,
          eraId: selection.eraId,
          resourceType: type,
          resourceStatus: 'failed',
          detail: error?.message || String(error),
          diagnostic: resolutionDiagnostic(selection, type, 'failed', 'era-runtime'),
        };
      }
      if (!sourceResult || sourceResult.status !== 'resolved') {
        const status = sourceResult?.status || 'failed';
        return {
          status,
          library: null,
          eraId: selection.eraId,
          resourceType: type,
          resourceStatus: status,
          detail: sourceResult?.detail || '时代资源未就绪',
          diagnostic: resolutionDiagnostic(selection, type, status, 'era-runtime'),
        };
      }
      return {
        status: 'resolved',
        library: compileResolvedLibrary(sourceResult.source, type),
        eraId: selection.eraId,
        resourceType: type,
        resourceStatus: 'loaded',
        diagnostic: resolutionDiagnostic(selection, type, 'loaded', 'era-runtime'),
      };
    }

    if (library) {
      return {
        status: 'resolved',
        library: compileResolvedLibrary(library, type),
        eraId: 'current',
        resourceType: type,
        resourceStatus: 'loaded',
        diagnostic: resolutionDiagnostic(selection, type, 'loaded', 'provided-library'),
      };
    }

    if (integration && typeof integration.getStaticSourceForEra === 'function') {
      const sourceResult = integration.getStaticSourceForEra('current', type);
      if (!sourceResult || sourceResult.status !== 'resolved') {
        const status = sourceResult?.status || 'failed';
        return {
          status,
          library: null,
          eraId: 'current',
          resourceType: type,
          resourceStatus: status,
          detail: sourceResult?.detail || '当前时代资源未就绪',
          diagnostic: resolutionDiagnostic(selection, type, status, 'era-runtime'),
        };
      }
      return {
        status: 'resolved',
        library: compileResolvedLibrary(sourceResult.source, type),
        eraId: 'current',
        resourceType: type,
        resourceStatus: 'loaded',
        diagnostic: resolutionDiagnostic(selection, type, 'loaded', 'era-runtime'),
      };
    }

    const globalName = type === 'faction' ? '__LWCS_内置势力库__' : '__LWCS_内置地点库__';
    const current = type === 'faction' ? defaultFactionLibrary : defaultLocationLibrary;
    const source = current || global[globalName];
    if (!source) {
      return {
        status: 'unloaded',
        library: null,
        eraId: 'current',
        resourceType: type,
        resourceStatus: 'unloaded',
        detail: '当前时代资源未注册',
        diagnostic: resolutionDiagnostic(selection, type, 'unloaded', 'implicit-current'),
      };
    }
    return {
      status: 'resolved',
      library: compileResolvedLibrary(source, type),
      eraId: 'current',
      resourceType: type,
      resourceStatus: 'loaded',
      diagnostic: resolutionDiagnostic(selection, type, 'loaded', 'current-global'),
    };
  }

  function decorateResolution(result, selection) {
    return {
      ...result,
      eraId: selection.eraId,
      resourceType: selection.resourceType,
      resourceStatus: selection.resourceStatus,
      diagnostic: selection.diagnostic,
    };
  }

  function compileFactionLibrary(source) {
    assertPlainRecord(source, '$', '势力库');
    assertStrictKeys(source, new Set(['版本', '势力']), '$');
    if (source.版本 !== 1) libraryFail('LIBRARY_VERSION_INVALID', '$.版本', source.版本, '势力库版本必须为1');
    assertPlainRecord(source.势力, '$.势力', '势力表');
    const canonicalNames = new Set(Object.keys(source.势力));
    const output = { 版本: 1, 势力: {} };
    const aliases = new Map();
    const keywords = new Map();
    for (const [canonicalName, sourceRecord] of Object.entries(source.势力)) {
      requiredString(canonicalName, `$.势力.${canonicalName}`, '规范名');
      assertPlainRecord(sourceRecord, `$.势力.${canonicalName}`, '势力记录');
      assertStrictKeys(sourceRecord, FACTION_RECORD_KEYS, `$.势力.${canonicalName}`);
      const record = {
        类型: requiredString(sourceRecord.类型, `$.势力.${canonicalName}.类型`, '类型'),
        描述: requiredString(sourceRecord.描述, `$.势力.${canonicalName}.描述`, '描述'),
        影响力: nonNegativeInteger(sourceRecord.影响力, `$.势力.${canonicalName}.影响力`, '影响力', 1000000),
        规模: nonNegativeInteger(sourceRecord.规模, `$.势力.${canonicalName}.规模`, '规模'),
        状态: requiredString(sourceRecord.状态, `$.势力.${canonicalName}.状态`, '状态'),
        上级势力: requiredString(sourceRecord.上级势力, `$.势力.${canonicalName}.上级势力`, '上级势力'),
        关系: {},
        战力统计: {},
      };
      if (!FACTION_STATUSES.has(record.状态)) libraryFail('LIBRARY_STATUS_INVALID', `$.势力.${canonicalName}.状态`, record.状态, `非法势力状态: ${record.状态}`);
      if (sourceRecord.别名 !== undefined) record.别名 = stringList(sourceRecord.别名, `$.势力.${canonicalName}.别名`, '别名');
      if (sourceRecord.关键词 !== undefined) record.关键词 = stringList(sourceRecord.关键词, `$.势力.${canonicalName}.关键词`, '关键词');
      if (sourceRecord.现状描述 !== undefined) record.现状描述 = optionalString(sourceRecord.现状描述, `$.势力.${canonicalName}.现状描述`, '现状描述');
      assertPlainRecord(sourceRecord.关系, `$.势力.${canonicalName}.关系`, '关系');
      for (const [targetName, relation] of Object.entries(sourceRecord.关系)) {
        requiredString(targetName, `$.势力.${canonicalName}.关系.${targetName}`, '目标势力');
        assertPlainRecord(relation, `$.势力.${canonicalName}.关系.${targetName}`, '关系记录');
        assertStrictKeys(relation, FACTION_RELATION_KEYS, `$.势力.${canonicalName}.关系.${targetName}`);
        record.关系[targetName] = { 态度: requiredString(relation.态度, `$.势力.${canonicalName}.关系.${targetName}.态度`, '态度') };
      }
      assertPlainRecord(sourceRecord.战力统计, `$.势力.${canonicalName}.战力统计`, '战力统计');
      assertStrictKeys(sourceRecord.战力统计, FACTION_BATTLE_KEYS, `$.势力.${canonicalName}.战力统计`);
      for (const statName of FACTION_BATTLE_KEYS) record.战力统计[statName] = nonNegativeInteger(sourceRecord.战力统计[statName], `$.势力.${canonicalName}.战力统计.${statName}`, statName);
      output.势力[canonicalName] = record;
    }
    for (const [canonicalName, record] of Object.entries(output.势力)) {
      for (const alias of record.别名 || []) {
        if (canonicalNames.has(alias) || aliases.has(alias)) libraryFail('LIBRARY_DUPLICATE_ALIAS', `$.势力.${canonicalName}.别名`, alias, `势力别名重复或与规范名冲突: ${alias}`);
        aliases.set(alias, canonicalName);
      }
      for (const keyword of record.关键词 || []) {
        if (!keywords.has(keyword)) keywords.set(keyword, []);
        keywords.get(keyword).push(canonicalName);
      }
    }
    const compiled = freezeDeep(output);
    compiledFactionMeta.set(compiled, { names: canonicalNames, aliases, keywords });
    defaultFactionLibrary = compiled;
    return compiled;
  }

  function compileLocationLibrary(source) {
    assertPlainRecord(source, '$', '地点库');
    assertStrictKeys(source, new Set(['版本', '地点']), '$');
    if (source.版本 !== 1) libraryFail('LIBRARY_VERSION_INVALID', '$.版本', source.版本, '地点库版本必须为1');
    assertPlainRecord(source.地点, '$.地点', '地点表');
    const output = { 版本: 1, 地点: {} };
    const names = new Map();
    const aliases = new Map();
    const keywords = new Map();
    const paths = new Map();
    for (const [recordId, sourceRecord] of Object.entries(source.地点)) {
      requiredString(recordId, `$.地点.${recordId}`, '记录ID');
      assertPlainRecord(sourceRecord, `$.地点.${recordId}`, '地点记录');
      assertStrictKeys(sourceRecord, LOCATION_RECORD_KEYS, `$.地点.${recordId}`);
      const canonicalName = requiredString(sourceRecord.规范名, `$.地点.${recordId}.规范名`, '规范名');
      if (!Array.isArray(sourceRecord.目标路径) || !sourceRecord.目标路径.length) libraryFail('LIBRARY_PATH_INVALID', `$.地点.${recordId}.目标路径`, sourceRecord.目标路径, '目标路径必须是非空字符串数组');
      const targetPath = sourceRecord.目标路径.map((segment, index) => requiredString(segment, `$.地点.${recordId}.目标路径[${index}]`, '路径片段'));
      const strategy = requiredString(sourceRecord.实例化策略, `$.地点.${recordId}.实例化策略`, '实例化策略');
      if (!LOCATION_STRATEGIES.has(strategy)) libraryFail('LIBRARY_STRATEGY_INVALID', `$.地点.${recordId}.实例化策略`, strategy, `非法地点实例化策略: ${strategy}`);
      assertPlainRecord(sourceRecord.节点, `$.地点.${recordId}.节点`, '地点节点');
      assertStrictKeys(sourceRecord.节点, LOCATION_NODE_KEYS, `$.地点.${recordId}.节点`);
      const sourceNode = sourceRecord.节点;
      const node = {
        类型: requiredString(sourceNode.类型, `$.地点.${recordId}.节点.类型`, '类型'),
        描述: requiredString(sourceNode.描述, `$.地点.${recordId}.节点.描述`, '描述'),
        掌控势力: requiredString(sourceNode.掌控势力, `$.地点.${recordId}.节点.掌控势力`, '掌控势力'),
        状态: requiredString(sourceNode.状态, `$.地点.${recordId}.节点.状态`, '状态'),
      };
      if (sourceNode.别名 !== undefined) node.别名 = stringList(sourceNode.别名, `$.地点.${recordId}.节点.别名`, '别名');
      if (sourceNode.关键词 !== undefined) node.关键词 = stringList(sourceNode.关键词, `$.地点.${recordId}.节点.关键词`, '关键词');
      if (sourceNode.现状描述 !== undefined) node.现状描述 = optionalString(sourceNode.现状描述, `$.地点.${recordId}.节点.现状描述`, '现状描述');
      if (sourceNode.人口 !== undefined) node.人口 = nonNegativeInteger(sourceNode.人口, `$.地点.${recordId}.节点.人口`, '人口');
      if (sourceNode.守护军团 !== undefined) node.守护军团 = requiredString(sourceNode.守护军团, `$.地点.${recordId}.节点.守护军团`, '守护军团');
      if (sourceNode.经济状况 !== undefined) {
        node.经济状况 = requiredString(sourceNode.经济状况, `$.地点.${recordId}.节点.经济状况`, '经济状况');
        if (!LOCATION_ECONOMIES.has(node.经济状况)) libraryFail('LIBRARY_FIELD_INVALID', `$.地点.${recordId}.节点.经济状况`, node.经济状况, `非法经济状况: ${node.经济状况}`);
      }
      for (const coordinate of ['x', 'y']) if (sourceNode[coordinate] !== undefined) node[coordinate] = finiteNumber(sourceNode[coordinate], `$.地点.${recordId}.节点.${coordinate}`, coordinate);
      if (sourceNode.商店 !== undefined) {
        assertPlainRecord(sourceNode.商店, `$.地点.${recordId}.节点.商店`, '商店');
        node.商店 = clone(sourceNode.商店);
      }
      output.地点[recordId] = { 规范名: canonicalName, 目标路径: targetPath, 实例化策略: strategy, 节点: node };
      if (!names.has(canonicalName)) names.set(canonicalName, []);
      names.get(canonicalName).push(recordId);
      const targetKey = pathKey(targetPath);
      if (!paths.has(targetKey)) paths.set(targetKey, []);
      paths.get(targetKey).push(recordId);
    }
    for (const [recordId, record] of Object.entries(output.地点)) {
      for (const alias of record.节点.别名 || []) {
        if (aliases.has(alias)) libraryFail('LIBRARY_DUPLICATE_ALIAS', `$.地点.${recordId}.节点.别名`, alias, `地点别名重复: ${alias}`);
        aliases.set(alias, recordId);
      }
      for (const keyword of record.节点.关键词 || []) {
        if (!keywords.has(keyword)) keywords.set(keyword, []);
        keywords.get(keyword).push(recordId);
      }
    }
    for (const [targetKey, recordIds] of paths) {
      if (recordIds.length > 1 && recordIds.some(recordId => output.地点[recordId].实例化策略 !== 'replace')) {
        const insertCount = recordIds.filter(recordId => output.地点[recordId].实例化策略 === 'insert').length;
        if (insertCount > 1) libraryFail('LIBRARY_DUPLICATE_PATH', `$.地点.${targetKey}`, recordIds, '同一地点路径不得有多个insert记录');
      }
    }
    const compiled = freezeDeep(output);
    compiledLocationMeta.set(compiled, { names, aliases, keywords, paths });
    defaultLocationLibrary = compiled;
    return compiled;
  }

  const LIFECYCLE_STATUSES = new Set(['开场常驻', '按需现存', '尚未生效']);

  function compileLifecycleMetadata(sourceMetadata, profileId, resourceType, source) {
    assertProfile(profileId);
    if (!['faction', 'location'].includes(resourceType)) fail('LIFECYCLE_RESOURCE_INVALID', profileId, '$', resourceType, '生命周期sidecar只适用于势力或地点');
    assertPlainRecord(sourceMetadata, '$', '生命周期sidecar');
    assertStrictKeys(sourceMetadata, new Set(['版本', '时代', '资源类型', '记录']), '$');
    if (sourceMetadata.版本 !== 1) fail('LIFECYCLE_VERSION_INVALID', profileId, '$.版本', sourceMetadata.版本, '生命周期sidecar版本必须为1');
    if (sourceMetadata.时代 !== profileId) fail('LIFECYCLE_ERA_INVALID', profileId, '$.时代', sourceMetadata.时代, '生命周期sidecar时代不匹配');
    if (sourceMetadata.资源类型 !== resourceType) fail('LIFECYCLE_RESOURCE_INVALID', profileId, '$.资源类型', sourceMetadata.资源类型, '生命周期sidecar资源类型不匹配');
    assertPlainRecord(sourceMetadata.记录, '$.记录', '生命周期记录表');
    const sourceTable = resourceType === 'faction' ? source?.势力 : source?.地点;
    if (!sourceTable || typeof sourceTable !== 'object' || Array.isArray(sourceTable)) fail('LIFECYCLE_SOURCE_INVALID', profileId, '$.记录', source, '生命周期sidecar缺少对应静态库');
    const sourceIds = new Set(Object.keys(sourceTable));
    const metadataIds = new Set(Object.keys(sourceMetadata.记录));
    for (const recordId of sourceIds) if (!metadataIds.has(recordId)) fail('LIFECYCLE_RECORD_MISSING', profileId, `$.记录.${recordId}`, undefined, `静态记录缺少生命周期sidecar: ${recordId}`);
    for (const recordId of metadataIds) if (!sourceIds.has(recordId)) fail('LIFECYCLE_RECORD_UNKNOWN', profileId, `$.记录.${recordId}`, sourceMetadata.记录[recordId], `生命周期sidecar包含未知记录: ${recordId}`);
    const records = {};
    for (const [recordId, value] of Object.entries(sourceMetadata.记录)) {
      assertPlainRecord(value, `$.记录.${recordId}`, '生命周期记录');
      assertStrictKeys(value, new Set(['运行状态', '首次生效tick']), `$.记录.${recordId}`);
      const status = requiredString(value.运行状态, `$.记录.${recordId}.运行状态`, '运行状态');
      if (!LIFECYCLE_STATUSES.has(status)) fail('LIFECYCLE_STATUS_INVALID', profileId, `$.记录.${recordId}.运行状态`, status, `非法生命周期状态: ${status}`);
      const tick = assertAbsoluteTick(value.首次生效tick, `$.记录.${recordId}.首次生效tick`);
      records[recordId] = { 运行状态: status, 首次生效tick: tick };
    }
    return freezeDeep({ 版本: 1, 时代: profileId, 资源类型: resourceType, 记录: records });
  }

  function resolveFaction(nameOrAlias, options = {}) {
    const selection = resolveEraLibrary(options.library, 'faction', options);
    const finish = result => decorateResolution(result, selection);
    if (selection.status !== 'resolved') return finish({ status: selection.status, canonicalName: null, candidates: [], reason: selection.detail || 'resource-not-ready' });
    const library = selection.library;
    const meta = compiledFactionMeta.get(library);
    const name = String(nameOrAlias && typeof nameOrAlias === 'object' ? (nameOrAlias.规范名 || nameOrAlias.name || nameOrAlias.名称 || '') : nameOrAlias || '').trim();
    if (!name) return finish({ status: 'unresolved', canonicalName: null, candidates: [], reason: 'empty-query' });
    if (meta.names.has(name)) return finish({ status: 'resolved', canonicalName: name, candidates: [name], reason: 'exact-name' });
    if (meta.aliases.has(name)) return finish({ status: 'resolved', canonicalName: meta.aliases.get(name), candidates: [meta.aliases.get(name)], reason: 'alias' });
    if (options.allowKeyword && meta.keywords.has(name)) {
      const candidates = Array.from(new Set(meta.keywords.get(name)));
      if (candidates.length === 1) return finish({ status: 'resolved', canonicalName: candidates[0], candidates, reason: 'keyword' });
      return finish({ status: 'conflict', canonicalName: null, candidates, reason: 'keyword' });
    }
    return finish({ status: 'unresolved', canonicalName: null, candidates: [], reason: 'not-found' });
  }

  function resolveLocation(nameOrAlias, currentPath = [], options = {}) {
    if (currentPath && !Array.isArray(currentPath) && typeof currentPath === 'object') {
      options = currentPath;
      currentPath = options.currentPath || [];
    }
    const selection = resolveEraLibrary(options.library, 'location', options);
    const finish = result => decorateResolution(result, selection);
    if (selection.status !== 'resolved') return finish({ status: selection.status, recordId: null, candidates: [], reason: selection.detail || 'resource-not-ready' });
    const library = selection.library;
    const meta = compiledLocationMeta.get(library);
    const recordId = String(nameOrAlias && typeof nameOrAlias === 'object'
      ? (nameOrAlias.记录ID || '')
      : nameOrAlias || '').trim();
    const explicitRecordId = nameOrAlias && typeof nameOrAlias === 'object' && !!recordId;
    if (explicitRecordId && Object.prototype.hasOwnProperty.call(library.地点, recordId)) {
      const record = library.地点[recordId];
      return finish({ status: 'resolved', recordId, canonicalName: record.规范名, path: record.目标路径, candidates: [recordId], reason: 'record-id' });
    }
    const query = String(nameOrAlias && typeof nameOrAlias === 'object' ? (nameOrAlias.规范名 || nameOrAlias.name || nameOrAlias.名称 || '') : nameOrAlias || '').trim();
    if (!query) return finish({ status: 'unresolved', recordId: null, candidates: [], reason: 'empty-query' });
    const suppliedCurrentPath = Array.isArray(currentPath) ? currentPath.map(片段 => String(片段 || '').trim()).filter(Boolean) : [];
    let normalizedCurrentPath = suppliedCurrentPath;
    let pathCandidates = meta.paths.get(pathKey(normalizedCurrentPath)) || [];
    if (!pathCandidates.length && normalizedCurrentPath.length > 1) {
      for (let 起点 = 1; 起点 < suppliedCurrentPath.length; 起点 += 1) {
        const 后缀路径 = suppliedCurrentPath.slice(起点);
        const 后缀候选 = meta.paths.get(pathKey(后缀路径)) || [];
        if (!后缀候选.length) continue;
        normalizedCurrentPath = 后缀路径;
        pathCandidates = 后缀候选;
        break;
      }
    }
    if (!explicitRecordId && pathCandidates.length && (query === suppliedCurrentPath.join('-') || query === suppliedCurrentPath.join('/') || query === normalizedCurrentPath.join('-') || query === normalizedCurrentPath.join('/') || query === normalizedCurrentPath[normalizedCurrentPath.length - 1])) {
      if (pathCandidates.length > 1) return finish({ status: 'conflict', recordId: null, candidates: pathCandidates, reason: 'path' });
      return finish({ status: 'resolved', recordId: pathCandidates[0], canonicalName: library.地点[pathCandidates[0]].规范名, path: library.地点[pathCandidates[0]].目标路径, candidates: pathCandidates, reason: 'path' });
    }
    let candidates = meta.names.get(query) || [];
    let reason = 'exact-name';
    if (!candidates.length && meta.aliases.has(query)) {
      candidates = [meta.aliases.get(query)];
      reason = 'alias';
    }
    if (!candidates.length && options.allowKeyword && meta.keywords.has(query)) {
      candidates = Array.from(new Set(meta.keywords.get(query)));
      reason = 'keyword';
    }
    if (candidates.length === 1) {
      const record = library.地点[candidates[0]];
      return finish({ status: 'resolved', recordId: candidates[0], canonicalName: record.规范名, path: record.目标路径, candidates, reason });
    }
    if (candidates.length > 1) return finish({ status: 'conflict', recordId: null, candidates, reason });
    if (recordId && Object.prototype.hasOwnProperty.call(library.地点, recordId)) {
      const record = library.地点[recordId];
      return finish({ status: 'resolved', recordId, canonicalName: record.规范名, path: record.目标路径, candidates: [recordId], reason: 'record-id' });
    }
    return finish({ status: 'unresolved', recordId: null, candidates: [], reason: 'not-found' });
  }

  function collectLibraryHits(text, type, options = {}) {
    const selection = resolveEraLibrary(options.library, type, options);
    const finish = result => decorateResolution(result, selection);
    if (selection.status !== 'resolved') return finish({ status: selection.status, hits: [], conflicts: [], reason: selection.detail || 'resource-not-ready' });
    const library = selection.library;
    if (typeof text !== 'string' || !text.trim()) return finish({ status: 'unresolved', hits: [], conflicts: [], reason: 'empty-text' });
    const meta = type === 'faction' ? compiledFactionMeta.get(library) : compiledLocationMeta.get(library);
    const exactTerms = [];
    if (type === 'faction') {
      for (const name of meta.names) exactTerms.push({ term: name, candidates: [name], reason: 'exact-name' });
      for (const [term, canonicalName] of meta.aliases) exactTerms.push({ term, candidates: [canonicalName], reason: 'alias' });
    } else {
      for (const [name, recordIds] of meta.names) exactTerms.push({ term: name, candidates: recordIds, reason: 'exact-name' });
      for (const [term, recordId] of meta.aliases) exactTerms.push({ term, candidates: [recordId], reason: 'alias' });
      for (const [pathName, recordIds] of meta.paths) {
        const pathSegments = JSON.parse(pathName);
        exactTerms.push({ term: pathSegments.join('-'), candidates: recordIds, reason: 'path' });
      }
    }
    const hits = [];
    const conflicts = [];
    const seen = new Set();
    for (const termInfo of exactTerms.sort((left, right) => right.term.length - left.term.length)) {
      if (!termInfo.term || !text.includes(termInfo.term)) continue;
      const candidates = Array.from(new Set(termInfo.candidates));
      if (candidates.length > 1) {
        conflicts.push({ term: termInfo.term, candidates, reason: termInfo.reason, index: text.indexOf(termInfo.term) });
        continue;
      }
      const termIndex = text.indexOf(termInfo.term);
      if (hits.some(hit => hit.candidates.length === 1 && hit.candidates[0] === candidates[0] && hit.index <= termIndex && hit.index + hit.term.length >= termIndex + termInfo.term.length)) continue;
      for (let hitIndex = hits.length - 1; hitIndex >= 0; hitIndex -= 1) {
        const hit = hits[hitIndex];
        if (hit.candidates.length === 1 && hit.candidates[0] === candidates[0] && hit.index >= termIndex && hit.index + hit.term.length <= termIndex + termInfo.term.length) hits.splice(hitIndex, 1);
      }
      const key = `${termInfo.reason}:${termInfo.term}:${candidates[0]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({ term: termInfo.term, candidates, reason: termInfo.reason, index: termIndex, type });
    }
    if (options.allowKeyword !== false) {
      for (const [keyword, keywordCandidates] of meta.keywords) {
        if (GENERIC_HIT_TERMS.has(keyword) || keyword.length < 2 || !text.includes(keyword)) continue;
        const contextText = typeof options.contextText === 'string' ? options.contextText : text;
        if (contextText.trim().length <= keyword.length + 2) continue;
        const candidates = Array.from(new Set(keywordCandidates));
        if (candidates.length > 1) conflicts.push({ term: keyword, candidates, reason: 'keyword', index: text.indexOf(keyword) });
        else hits.push({ term: keyword, candidates, reason: 'keyword', index: text.indexOf(keyword), type });
      }
    }
    const unresolvedConflicts = conflicts.filter(conflict => {
      const start = Number.isInteger(conflict.index) && conflict.index >= 0 ? conflict.index : text.indexOf(conflict.term);
      const end = start + String(conflict.term || '').length;
      return !hits.some(hit => hit.index <= start && hit.index + String(hit.term || '').length >= end);
    });
    return finish({ status: unresolvedConflicts.length ? 'conflict' : (hits.length ? 'resolved' : 'unresolved'), hits, conflicts: unresolvedConflicts });
  }

  function collectFactionHits(text, options = {}) {
    return collectLibraryHits(text, 'faction', options);
  }

  function collectLocationHits(text, options = {}) {
    return collectLibraryHits(text, 'location', options);
  }

  function buildFactionInstance(canonicalName, statData = {}, options = {}) {
    const resolved = resolveFaction(canonicalName, { ...options, allowKeyword: false });
    if (resolved.status !== 'resolved') libraryFail(resolved.status === 'conflict' ? 'LIBRARY_REFERENCE_CONFLICT' : 'LIBRARY_REFERENCE_UNRESOLVED', '$.势力', canonicalName, `无法唯一解析势力: ${canonicalName}`);
    const library = resolveEraLibrary(options.library, 'faction', options).library;
    const sourceRecord = library.势力[resolved.canonicalName];
    const instance = clone(sourceRecord);
    if (statData !== undefined && statData !== null) {
      assertPlainRecord(statData, '$.势力实例动态状态', '势力动态状态');
      const dynamicKeys = new Set(['现状描述', '影响力', '规模', '状态', '上级势力', '关系', '战力统计']);
      Object.keys(statData).forEach(key => {
        if (!dynamicKeys.has(key)) libraryFail('LIBRARY_FIELD_UNKNOWN', `$.势力实例动态状态.${key}`, statData[key], `势力动态字段未声明: ${key}`);
      });
      Object.assign(instance, clone(statData));
    }
    delete instance.成员;
    return instance;
  }

  function activeLocationRoot(statData) {
    if (!isPlainRecord(statData)) return {};
    if (isPlainRecord(statData.world) && isPlainRecord(statData.world.地点)) return statData.world.地点;
    if (isPlainRecord(statData.世界) && isPlainRecord(statData.世界.地点)) return statData.世界.地点;
    if (isPlainRecord(statData.地点)) return statData.地点;
    return statData;
  }

  function hasActiveLocation(root, pathSegments) {
    let current = root;
    for (let index = 0; index < pathSegments.length; index += 1) {
      if (!isPlainRecord(current) || !Object.prototype.hasOwnProperty.call(current, pathSegments[index])) return false;
      current = current[pathSegments[index]]?.子节点;
    }
    return true;
  }

  function activeLocationNode(root, pathSegments) {
    let current = root;
    for (let index = 0; index < pathSegments.length; index += 1) {
      if (!isPlainRecord(current) || !isPlainRecord(current[pathSegments[index]])) return null;
      const node = current[pathSegments[index]];
      current = node.子节点;
      if (index === pathSegments.length - 1) return node;
    }
    return null;
  }

  function locationPointer(pathSegments) {
    const segments = ['world', '地点'];
    if (pathSegments.length > 1) {
      segments.push(pathSegments[0]);
      for (let index = 1; index < pathSegments.length; index += 1) segments.push('子节点', pathSegments[index]);
    } else segments.push(pathSegments[0]);
    return `/${segments.map(jsonPointerSegment).join('/')}`;
  }

  function sameStaticLocationIdentity(left, right) {
    if (!left || !right) return false;
    return ['类型', '别名', '关键词', '描述'].every(key => JSON.stringify(left[key] ?? null) === JSON.stringify(right[key] ?? null));
  }

  function buildLocationInstantiationOps(recordId, statData = {}, options = {}) {
    const library = resolveEraLibrary(options.library, 'location', options).library;
    if (!library || !Object.prototype.hasOwnProperty.call(library.地点, recordId)) libraryFail('LIBRARY_REFERENCE_UNRESOLVED', `$.地点.${recordId}`, recordId, `地点记录不存在: ${recordId}`);
    const meta = compiledLocationMeta.get(library);
    const targetRecord = library.地点[recordId];
    const root = activeLocationRoot(statData);
    const operations = [];
    for (let depth = 1; depth <= targetRecord.目标路径.length; depth += 1) {
      const prefix = targetRecord.目标路径.slice(0, depth);
      const existing = hasActiveLocation(root, prefix);
      const prefixIds = meta.paths.get(pathKey(prefix)) || [];
      const prefixId = depth === targetRecord.目标路径.length
        ? recordId
        : (prefixIds.find(candidate => library.地点[candidate].实例化策略 === 'insert') || prefixIds[0]);
      if (!prefixId) libraryFail('LIBRARY_PATH_INVALID', `$.地点.${recordId}.目标路径`, prefix, '缺少可实例化的祖先地点记录');
      const record = library.地点[prefixId];
      if (existing) {
        if (depth === targetRecord.目标路径.length && targetRecord.实例化策略 === 'replace' && !sameStaticLocationIdentity(activeLocationNode(root, prefix), record.节点)) {
          operations.push({ op: 'replace', path: locationPointer(prefix), value: clone(record.节点), recordId: prefixId, strategy: 'replace' });
        }
        continue;
      }
      operations.push({ op: 'add', path: locationPointer(prefix), value: clone(record.节点), recordId: prefixId, strategy: record.实例化策略 });
    }
    return operations;
  }

  const API = Object.freeze({
    version: VERSION,
    profiles: PROFILES,
    ticksPerYear: TICKS_PER_YEAR,
    ticksPerMillennium: TICKS_PER_MILLENNIUM,
    eraThresholds: ERA_THRESHOLDS,
    LibraryContractError,
    parseDateTime,
    formatDateTime,
    toTick,
    fromTick,
    durationToTicks,
    resolveEraAtTick,
    getEraTransitions,
    getCultivationEraBlend,
    compileCharacterLibrary,
    compileItemLibrary: (source, profileId) => {
      assertProfile(profileId);
      if (!source || typeof source !== 'object') fail('REFERENCE_UNRESOLVED', profileId, '$', source, '物品库不是对象');
      assertAuthorSource(source, profileId);
      return freezeDeep(compileItemDurations(source, profileId));
    },
    compileTimeline,
    isCompiledTimeline: source => !!source && typeof source === 'object' && compiledTimelineSources.has(source),
    compileFactionLibrary,
    compileLocationLibrary,
    compileLifecycleMetadata,
    resolveFaction,
    resolveLocation,
    collectFactionHits,
    collectLocationHits,
    buildFactionInstance,
    buildLocationInstantiationOps,
    resolveIdentity,
  });

  const existing = global.__LWCS_LIBRARY_DATA_RUNTIME_V1__;
  if (existing && existing.version !== VERSION) throw new Error(`LibraryData_Runtime版本不符: ${existing.version}`);
  const runtime = existing || API;
  global.__LWCS_LIBRARY_DATA_RUNTIME_V1__ = runtime;
  if (!global.__LWCS_LIBRARY_DATA_RUNTIME_LOADING_V1__ || typeof global.__LWCS_LIBRARY_DATA_RUNTIME_LOADING_V1__.then !== 'function') {
    global.__LWCS_LIBRARY_DATA_RUNTIME_LOADING_V1__ = Promise.resolve(runtime);
  }
  try { if (global.parent && global.parent !== global) global.parent.__LWCS_LIBRARY_DATA_RUNTIME_V1__ = runtime; } catch (error) {}
  try { if (global.top && global.top !== global) global.top.__LWCS_LIBRARY_DATA_RUNTIME_V1__ = runtime; } catch (error) {}
})(typeof globalThis !== 'undefined' ? globalThis : window);

;
/* source: EraDataRegistry.js */
!(function (global) {
  'use strict';

  const VERSION = '1.1.0-era-resource-owner-20260822';
  const RESOURCE_TYPES = Object.freeze(['character', 'item', 'faction', 'location', 'timeline']);
  const RESOURCE_STATUS_NAMES = Object.freeze(['unloaded', 'loading', 'loaded', 'failed', 'disabled', 'not-configured']);
  const LOADING_CONTRACT = Object.freeze({
    owner: 'MVU_ZOD_Entry.js 的 canonical resource owner',
    waiter: 'TimelineRuntime、EraRuntime_Integration 及其他消费者在查询资源前等待加载承诺完成',
    failure: 'throw EraDataRegistryError and mark the resource state as failed',
  });

  class EraDataRegistryError extends Error {
    constructor(code, eraId, resourceType, message) {
      super(message || code);
      this.name = 'EraDataRegistryError';
      this.code = code;
      this.eraId = eraId;
      this.resourceType = resourceType;
    }
  }

  function freezeDeep(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(key => freezeDeep(value[key]));
    return Object.freeze(value);
  }

  function resourceDescriptor(resourceType, options) {
    return freezeDeep({
      resourceType,
      sourceStatus: options.sourceStatus || 'configured',
      modulePath: options.modulePath || null,
      loader: options.loader || null,
      globalKey: options.globalKey || null,
      metadataGlobalKey: options.metadataGlobalKey || null,
      exportName: options.exportName || null,
      namespace: options.namespace,
      note: options.note || null,
    });
  }

  function eraDescriptor(id, profileId, startYear, mapProfile, resources) {
    return freezeDeep({ id, profileId, startYear, mapProfile, resources });
  }

  const ERA_DATA_SOURCES = freezeDeep({
    dldl: eraDescriptor('dldl', 'dldl', 0, {
      id: 'dldl-terrestrial',
      mapId: 'map_dldl_world',
      asset: '斗罗大陆1地图.png',
      topology: 'terrestrial',
      terrainSource: 'image-sampling',
      width: 3174,
      height: 2246,
    }, {
      character: resourceDescriptor('character', { modulePath: './dldlCharacterLibrary.js', loader: 'script-global', globalKey: '__DLDL_CHARACTER_LIBRARY__', namespace: 'dldlCharacterLibrary' }),
      item: resourceDescriptor('item', { modulePath: './dldlItemLibrary.js', loader: 'script-global', globalKey: '__LWCS_斗罗大陆物品库__', namespace: 'dldlItemLibrary' }),
      faction: resourceDescriptor('faction', { modulePath: './dldlFactionLibrary.js', loader: 'script-global', globalKey: '__LWCS_DLDL_FACTION_LIBRARY__', metadataGlobalKey: '__LWCS_DLDL_FACTION_LIBRARY_META_V1__', namespace: 'dldlFactionLibrary' }),
      location: resourceDescriptor('location', { modulePath: './dldlLocationLibrary.js', loader: 'script-global', globalKey: '__LWCS_DLDL_LOCATION_LIBRARY__', metadataGlobalKey: '__LWCS_DLDL_LOCATION_LIBRARY_META_V1__', namespace: 'dldlLocationLibrary' }),
      timeline: resourceDescriptor('timeline', { modulePath: './dldltimeline.js', loader: 'dynamic-import', globalKey: '__LWCS_TIMELINE_SOURCE_dldl__', exportName: 'TimelineEvents', namespace: 'dldlTimelineEvents' }),
    }),
    jueshitangmen: eraDescriptor('jueshitangmen', 'jueshitangmen', 10000, {
      id: 'terrestrial-shared',
      mapId: 'map_terrestrial_world',
      asset: 'MAP.webp',
      topology: 'terrestrial',
      terrainSource: 'manual-and-image',
      width: 3174,
      height: 2246,
    }, {
      character: resourceDescriptor('character', { modulePath: './JueshiTangmenCharacterLibrary.js', loader: 'script-global', globalKey: '__LWCS_绝世唐门角色库__', namespace: 'jueshitangmenCharacterLibrary' }),
      item: resourceDescriptor('item', { modulePath: './JueshiTangmenItemLibrary.js', loader: 'script-global', globalKey: '__LWCS_绝世唐门物品库__', namespace: 'jueshitangmenItemLibrary' }),
      faction: resourceDescriptor('faction', { modulePath: './jstmFactionLibrary.js', loader: 'script-global', globalKey: '__LWCS_JSTM_FACTION_LIBRARY__', metadataGlobalKey: '__LWCS_JSTM_FACTION_LIBRARY_META_V1__', namespace: 'jueshitangmenFactionLibrary' }),
      location: resourceDescriptor('location', { modulePath: './jstmLocationLibrary.js', loader: 'script-global', globalKey: '__LWCS_JSTM_LOCATION_LIBRARY__', metadataGlobalKey: '__LWCS_JSTM_LOCATION_LIBRARY_META_V1__', namespace: 'jueshitangmenLocationLibrary' }),
      timeline: resourceDescriptor('timeline', { modulePath: './JueshiTangmenTimeline.js', loader: 'dynamic-import', globalKey: '__LWCS_TIMELINE_SOURCE_jueshitangmen__', exportName: '绝世唐门时间线', namespace: 'jueshitangmenTimelineEvents' }),
    }),
    current: eraDescriptor('current', 'current', 20000, {
      id: 'terrestrial-shared',
      mapId: 'map_terrestrial_world',
      asset: 'MAP.webp',
      topology: 'terrestrial',
      terrainSource: 'manual-and-image',
      width: 3174,
      height: 2246,
    }, {
      character: resourceDescriptor('character', { modulePath: './LWCS_Era_Current_Data_Bundle.js', loader: 'script-global', globalKey: '__LWCS_内置角色库__', namespace: 'currentCharacterLibrary' }),
      item: resourceDescriptor('item', { modulePath: './LWCS_Era_Current_Data_Bundle.js', loader: 'script-global', globalKey: '__LWCS_内置物品库__', namespace: 'currentItemLibrary' }),
      faction: resourceDescriptor('faction', { modulePath: './LWCS_Era_Current_Data_Bundle.js', loader: 'script-global', globalKey: '__LWCS_内置势力库__', metadataGlobalKey: '__LWCS_CURRENT_FACTION_LIBRARY_META_V1__', namespace: 'currentFactionLibrary' }),
      location: resourceDescriptor('location', { modulePath: './LWCS_Era_Current_Data_Bundle.js', loader: 'script-global', globalKey: '__LWCS_内置地点库__', metadataGlobalKey: '__LWCS_CURRENT_LOCATION_LIBRARY_META_V1__', namespace: 'currentLocationLibrary' }),
      timeline: resourceDescriptor('timeline', { modulePath: './LWCS_Era_Current_Data_Bundle.js', loader: 'script-global', globalKey: '__LWCS_TIMELINE_SOURCE_current__', namespace: 'currentTimelineEvents' }),
    }),
    zjdl: eraDescriptor('zjdl', 'zjdl', 30000, {
      id: 'zjdl-stellar',
      mapId: 'map_zjdl_stellar',
      asset: 'MAP_ZJDL.webp',
      topology: 'stellar',
      terrainSource: 'none',
      width: 3174,
      height: 2246,
    }, {
      character: resourceDescriptor('character', { modulePath: './zjdlCharacterLibrary.js', loader: 'script-global', globalKey: '__LWCS_终极斗罗角色库__', namespace: 'zjdlCharacterLibrary' }),
      item: resourceDescriptor('item', { modulePath: './zjdlItemLibrary.js', loader: 'script-global', globalKey: '__LWCS_终极斗罗物品库__', namespace: 'zjdlItemLibrary' }),
      faction: resourceDescriptor('faction', { modulePath: './zjdlFactionLibrary.js', loader: 'script-global', globalKey: '__LWCS_终极斗罗势力库__', metadataGlobalKey: '__LWCS_ZJDL_FACTION_LIBRARY_META_V1__', namespace: 'zjdlFactionLibrary' }),
      location: resourceDescriptor('location', { modulePath: './zjdlLocationLibrary.js', loader: 'script-global', globalKey: '__LWCS_终极斗罗地点库__', metadataGlobalKey: '__LWCS_ZJDL_LOCATION_LIBRARY_META_V1__', namespace: 'zjdlLocationLibrary' }),
      timeline: resourceDescriptor('timeline', { modulePath: './zjdltimeline.js', loader: 'dynamic-import', globalKey: '__LWCS_TIMELINE_SOURCE_zjdl__', exportName: '终极斗罗时间线', namespace: 'zjdlTimelineEvents' }),
    }),
  });

  const RESOURCE_STATES = new Map();
  const RESOURCE_PROMISES = new Map();

  function 窗口列表() {
    const result = [global];
    try { if (global.parent && global.parent !== global) result.push(global.parent); } catch (_) {}
    try { if (global.top && global.top !== global && !result.includes(global.top)) result.push(global.top); } catch (_) {}
    return result;
  }

  function assertEraId(eraId) {
    if (!Object.prototype.hasOwnProperty.call(ERA_DATA_SOURCES, eraId)) throw new EraDataRegistryError('ERA_UNKNOWN', eraId, null, `未知时代: ${eraId}`);
    return ERA_DATA_SOURCES[eraId];
  }

  function assertResourceType(resourceType) {
    if (!RESOURCE_TYPES.includes(resourceType)) throw new EraDataRegistryError('RESOURCE_TYPE_UNKNOWN', null, resourceType, `未知静态库类型: ${resourceType}`);
    return resourceType;
  }

  function getResourceDescriptor(eraId, resourceType) {
    const era = assertEraId(eraId);
    const type = assertResourceType(resourceType);
    return era.resources[type];
  }

  function resourceKey(eraId, resourceType) {
    return `${eraId}:${resourceType}`;
  }

  function getResourceState(eraId, resourceType) {
    const descriptor = getResourceDescriptor(eraId, resourceType);
    const state = RESOURCE_STATES.get(resourceKey(eraId, resourceType));
    if (state) return state;
    return Object.freeze({
      eraId,
      resourceType,
      status: descriptor.sourceStatus === 'configured' ? 'unloaded' : 'not-configured',
      detail: descriptor.note,
    });
  }

  function setResourceState(eraId, resourceType, status, detail = '') {
    const descriptor = getResourceDescriptor(eraId, resourceType);
    if (!RESOURCE_STATUS_NAMES.includes(status) || status === 'not-configured') throw new EraDataRegistryError('RESOURCE_STATE_INVALID', eraId, resourceType, `非法静态库加载状态: ${status}`);
    if (descriptor.sourceStatus !== 'configured') throw new EraDataRegistryError('RESOURCE_NOT_CONFIGURED', eraId, resourceType, descriptor.note || `静态库未配置: ${eraId}:${resourceType}`);
    const state = Object.freeze({ eraId, resourceType, status, detail: String(detail || '') });
    RESOURCE_STATES.set(resourceKey(eraId, resourceType), state);
    return state;
  }

  function getEraDataSource(eraId) {
    return assertEraId(eraId);
  }

  function getMapProfile(eraId) {
    return assertEraId(eraId).mapProfile;
  }

  function listEraDataSources() {
    return Object.freeze(Object.values(ERA_DATA_SOURCES));
  }

  function listResourceTypes() {
    return RESOURCE_TYPES;
  }

  function getLoadPlan(eraId, resourceTypes = RESOURCE_TYPES) {
    assertEraId(eraId);
    if (!Array.isArray(resourceTypes)) throw new EraDataRegistryError('RESOURCE_PLAN_INVALID', eraId, null, '加载计划必须是资源类型数组');
    return Object.freeze(resourceTypes.map(resourceType => getResourceDescriptor(eraId, resourceType)));
  }

  function assertResourceConfigured(eraId, resourceType) {
    const descriptor = getResourceDescriptor(eraId, resourceType);
    if (descriptor.sourceStatus !== 'configured') throw new EraDataRegistryError('RESOURCE_NOT_CONFIGURED', eraId, resourceType, descriptor.note || `静态库未配置: ${eraId}:${resourceType}`);
    return descriptor;
  }

  function 读取全局能力(key) {
    for (const current of 窗口列表()) {
      try {
        if (current && current[key] !== undefined && current[key] !== null) return current[key];
      } catch (_) {}
    }
    return null;
  }

  function 规范化资源类型列表(resourceTypes) {
    if (!Array.isArray(resourceTypes) || resourceTypes.length === 0) {
      throw new EraDataRegistryError('RESOURCE_PLAN_INVALID', null, null, 'ensureEraResources必须指定至少一种资源类型');
    }
    return Array.from(new Set(resourceTypes.map(assertResourceType)));
  }

  function 同步资源全局源(descriptor, source) {
    if (!descriptor.globalKey) return;
    窗口列表().forEach(current => {
      try { current[descriptor.globalKey] = source; } catch (_) {}
    });
  }

  function 读取已加载资源源(descriptor, loaderResult) {
    const moduleValue = loaderResult && loaderResult.value;
    if (moduleValue && descriptor.exportName && moduleValue[descriptor.exportName] !== undefined) {
      return moduleValue[descriptor.exportName];
    }
    if (descriptor.globalKey) return 读取全局能力(descriptor.globalKey);
    return null;
  }

  async function ensureResource(eraId, resourceType, options = {}) {
    const era = assertEraId(eraId);
    const type = assertResourceType(resourceType);
    const descriptor = era.resources[type];
    if (descriptor.sourceStatus !== 'configured') return getResourceState(eraId, resourceType);
    const key = resourceKey(eraId, resourceType);
    const currentState = getResourceState(eraId, resourceType);
    if (currentState.status === 'loaded' || currentState.status === 'disabled') return currentState;
    const existingPromise = RESOURCE_PROMISES.get(key);
    if (existingPromise) return existingPromise;
    const loader = 读取全局能力('__LWCS_MVU_RESOURCE_OWNER_V1__');
    if (!loader || loader.version !== '1.0.0' || typeof loader.loadResource !== 'function') {
      throw new EraDataRegistryError('RESOURCE_OWNER_NOT_READY', eraId, resourceType, 'MVU_ZOD资源owner尚未注册');
    }
    const integration = 读取全局能力('__LWCS_ERA_RUNTIME_INTEGRATION_V1__');
    if (!integration || typeof integration.registerSource !== 'function') {
      throw new EraDataRegistryError('ERA_RUNTIME_NOT_READY', eraId, resourceType, 'EraRuntime_Integration尚未注册');
    }
    let promise;
    promise = (async () => {
      setResourceState(eraId, resourceType, 'loading', options.reason || 'ensureEraResources');
      try {
        const loaderResult = await loader.loadResource(descriptor.modulePath, {
          mode: descriptor.loader === 'dynamic-import' ? 'dynamic-import' : 'script-global',
          ready: () => descriptor.globalKey ? !!读取全局能力(descriptor.globalKey) : false,
        });
        const source = 读取已加载资源源(descriptor, loaderResult);
        if (source === undefined || source === null) {
          throw new EraDataRegistryError('RESOURCE_SOURCE_MISSING', eraId, resourceType, `资源已执行但未暴露源: ${eraId}:${resourceType}`);
        }
        同步资源全局源(descriptor, source);
        const metadata = descriptor.metadataGlobalKey ? 读取全局能力(descriptor.metadataGlobalKey) : null;
        const registered = integration.registerSource(eraId, resourceType, source, {
          detail: options.reason || 'ensureEraResources',
          metadata,
        });
        if (!registered || registered.status !== 'loaded') {
          throw new EraDataRegistryError('RESOURCE_REGISTER_FAILED', eraId, resourceType, `资源注册失败: ${eraId}:${resourceType}`);
        }
        return setResourceState(eraId, resourceType, 'loaded', options.reason || 'ensureEraResources');
      } catch (error) {
        const detail = error && error.message ? error.message : String(error || 'unknown_error');
        try { setResourceState(eraId, resourceType, 'failed', detail); } catch (_) {}
        throw error;
      } finally {
        if (RESOURCE_PROMISES.get(key) === promise) RESOURCE_PROMISES.delete(key);
      }
    })();
    RESOURCE_PROMISES.set(key, promise);
    return promise;
  }

  function ensureEraResources(eraId, resourceTypes, options = {}) {
    assertEraId(eraId);
    const types = 规范化资源类型列表(resourceTypes);
    return Promise.all(types.map(resourceType => ensureResource(eraId, resourceType, options)));
  }

  function prefetchEraResources(eraId, resourceTypes, options = {}) {
    return ensureEraResources(eraId, resourceTypes, { ...options, reason: options.reason || 'prefetchEraResources' });
  }

  const API = Object.freeze({
    version: VERSION,
    resourceTypes: RESOURCE_TYPES,
    resourceStates: RESOURCE_STATUS_NAMES,
    loadingContract: LOADING_CONTRACT,
    sources: ERA_DATA_SOURCES,
    EraDataRegistryError,
    getEraDataSource,
    getMapProfile,
    listEraDataSources,
    listResourceTypes,
    getResourceDescriptor,
    getResourceState,
    setResourceState,
    getLoadPlan,
    assertResourceConfigured,
    ensureEraResources,
    prefetchEraResources,
    getEraResourceState: getResourceState,
  });

  const existing = global.__LWCS_ERA_DATA_REGISTRY_V1__;
  if (existing && existing.version !== VERSION) throw new Error(`EraDataRegistry版本不符: ${existing.version}`);
  const registry = existing || API;
  global.__LWCS_ERA_DATA_REGISTRY_V1__ = registry;
  if (!global.__LWCS_ERA_DATA_REGISTRY_LOADING_V1__ || typeof global.__LWCS_ERA_DATA_REGISTRY_LOADING_V1__.then !== 'function') {
    global.__LWCS_ERA_DATA_REGISTRY_LOADING_V1__ = Promise.resolve(registry);
  }
  try { if (global.parent && global.parent !== global) global.parent.__LWCS_ERA_DATA_REGISTRY_V1__ = registry; } catch (error) {}
  try { if (global.top && global.top !== global) global.top.__LWCS_ERA_DATA_REGISTRY_V1__ = registry; } catch (error) {}
})(typeof globalThis !== 'undefined' ? globalThis : window);

;
/* source: EraCurrencyRegistry.js */
!(function () {
  'use strict';

  const 货币种类 = Object.freeze({
    法币: '法币',
    组织积分: '组织积分',
    军功: '军功',
    身份物品排除: '身份物品排除',
  });

  const 时代顺序 = Object.freeze(['dldl', 'jueshitangmen', 'current', 'zjdl']);

  const 时代定义 = {
    dldl: {
      名称: '斗一',
      时代: 'dldl',
      默认法币: '金魂币',
      货币: {
        金魂币: { 名称: '金魂币', 种类: 货币种类.法币, 最小单位价值: 100, 最小单位: '铜魂币' },
        银魂币: { 名称: '银魂币', 种类: 货币种类.法币, 最小单位价值: 10, 最小单位: '铜魂币' },
        铜魂币: { 名称: '铜魂币', 种类: 货币种类.法币, 最小单位价值: 1, 最小单位: '铜魂币' },
      },
      身份物品排除: ['魂师徽章', '铁斗魂徽章', '斗魂场入场铜牌'],
    },
    jueshitangmen: {
      名称: '斗二',
      时代: 'jueshitangmen',
      默认法币: '金魂币',
      货币: {
        金魂币: { 名称: '金魂币', 种类: 货币种类.法币, 最小单位价值: 100, 最小单位: '铜魂币' },
        银魂币: { 名称: '银魂币', 种类: 货币种类.法币, 最小单位价值: 10, 最小单位: '铜魂币' },
        铜魂币: { 名称: '铜魂币', 种类: 货币种类.法币, 最小单位价值: 1, 最小单位: '铜魂币' },
      },
      身份物品排除: ['二级魂导师徽章', '史莱克学院白色新生徽章'],
    },
    current: {
      名称: '斗三',
      时代: 'current',
      默认法币: '联邦币',
      货币: {
        联邦币: { 名称: '联邦币', 种类: 货币种类.法币, 最小单位价值: 1, 最小单位: '联邦币' },
        星罗币: { 名称: '星罗币', 种类: 货币种类.法币, 精确换算: false },
        唐门积分: { 名称: '唐门积分', 种类: 货币种类.组织积分, 精确换算: false },
        学院积分: { 名称: '学院积分', 显示名: '史莱克学院积分', 种类: 货币种类.组织积分, 精确换算: false },
        战功: { 名称: '战功', 显示名: '血神功勋', 种类: 货币种类.军功, 精确换算: false },
      },
      身份物品排除: ['锻造师协会徽章', '白级斗士徽章', '黄级斗者徽章'],
    },
    zjdl: {
      名称: '斗四',
      时代: 'zjdl',
      默认法币: '联邦币',
      货币: {
        联邦币: { 名称: '联邦币', 种类: 货币种类.法币, 最小单位价值: 1, 最小单位: '联邦币' },
        龙马币: { 名称: '龙马币', 种类: 货币种类.法币, 最小单位价值: 1000, 最小单位: '联邦币' },
        天龙晶币: { 名称: '天龙晶币', 种类: 货币种类.法币, 最小单位价值: 2000000, 最小单位: '联邦币' },
        白级徽章: { 名称: '白级徽章', 种类: 货币种类.组织积分, 精确换算: false },
        黄级徽章: { 名称: '黄级徽章', 种类: 货币种类.组织积分, 精确换算: false },
        紫级徽章: { 名称: '紫级徽章', 种类: 货币种类.组织积分, 精确换算: false },
        斗天者积分: { 名称: '斗天者积分', 种类: 货币种类.军功, 精确换算: false },
      },
      身份物品排除: [
        '红级徽章(蓝轩宇)',
        '黑级徽章(蓝轩宇)',
        '八级斗天者徽章',
        '天龙会徽章(蓝轩宇)',
        '天龙会徽章(白秀秀)',
        '族长会徽章(蓝轩宇)',
        '黑级徽章(唐震华所借)',
      ],
    },
  };

  const 跨时代映射 = [
    {
      id: 'current:学院积分->zjdl:学院徽章体系',
      类型: '概念映射',
      来源: { 时代: 'current', 货币: '学院积分' },
      目标: { 时代: 'zjdl', 概念: '学院徽章体系', 货币: ['白级徽章', '黄级徽章', '紫级徽章'] },
      精确汇率: null,
      说明: '斗三史莱克学院积分对应斗四学院徽章兑换体系；未提供等级或数量汇率。',
    },
    {
      id: 'current:唐门积分->zjdl:学院徽章体系',
      类型: '概念映射',
      来源: { 时代: 'current', 货币: '唐门积分' },
      目标: { 时代: 'zjdl', 概念: '学院徽章体系', 货币: ['白级徽章', '黄级徽章', '紫级徽章'] },
      精确汇率: null,
      说明: '斗三唐门积分对应斗四学院徽章兑换体系；未提供等级或数量汇率。',
    },
    {
      id: 'current:战功->zjdl:斗天者积分',
      类型: '概念映射',
      来源: { 时代: 'current', 货币: '战功' },
      目标: { 时代: 'zjdl', 概念: '斗天者积分', 货币: ['斗天者积分'] },
      精确汇率: null,
      说明: '斗三军功对应斗四斗天者积分；未提供军功数量汇率。',
    },
  ];

  const 身份排除集合 = Object.fromEntries(
    时代顺序.map(时代 => [时代, new Set(时代定义[时代].身份物品排除)]),
  );

  function 失败结果(原因, 额外 = {}) {
    return Object.freeze({ status: 'unresolved', reason: 原因, ...额外 });
  }

  function 解析时代(时代) {
    if (typeof 时代 !== 'string' || !Object.prototype.hasOwnProperty.call(时代定义, 时代)) {
      return 失败结果('unknown-era', { era: 时代 ?? null });
    }
    return { status: 'resolved', era: 时代, definition: 时代定义[时代] };
  }

  function 解析货币(时代, 货币) {
    const 时代结果 = 解析时代(时代);
    if (时代结果.status !== 'resolved') return 时代结果;
    if (typeof 货币 !== 'string' || !货币) return 失败结果('unknown-currency', { era: 时代, currency: 货币 ?? null });
    const 定义 = 时代结果.definition.货币[货币];
    if (定义) return { status: 'resolved', era: 时代, currency: 货币, definition: 定义 };
    if (身份排除集合[时代].has(货币)) {
      return 失败结果('identity-item-excluded', { era: 时代, currency: 货币, kind: 货币种类.身份物品排除 });
    }
    return 失败结果('unknown-currency', { era: 时代, currency: 货币 });
  }

  function 解析整数金额(金额) {
    if (typeof 金额 === 'bigint') {
      return 金额 >= 0n ? { status: 'resolved', value: 金额 } : 失败结果('amount-must-be-nonnegative-integer');
    }
    if (typeof 金额 === 'number') {
      if (!Number.isSafeInteger(金额) || 金额 < 0) return 失败结果('amount-must-be-nonnegative-safe-integer');
      return { status: 'resolved', value: BigInt(金额) };
    }
    if (typeof 金额 === 'string' && /^[0-9]+$/.test(金额)) return { status: 'resolved', value: BigInt(金额) };
    return 失败结果('amount-must-be-nonnegative-integer');
  }

  function 查询跨时代映射(来源, 目标) {
    const 来源时代 = 来源?.era;
    const 来源货币 = 来源?.currency;
    const 目标时代 = 目标?.era;
    const 目标货币 = 目标?.currency;
    const 目标概念 = 目标?.concept;
    const 候选 = 跨时代映射.find(映射 => {
      if (映射.来源.时代 !== 来源时代 || 映射.来源.货币 !== 来源货币 || 映射.目标.时代 !== 目标时代) return false;
      if (目标货币) return 映射.目标.货币.includes(目标货币);
      if (目标概念) return 映射.目标.概念 === 目标概念;
      return true;
    });
    return 候选
      ? { status: 'resolved', mapping: 候选 }
      : 失败结果('no-explicit-cross-era-mapping', { from: 来源 ?? null, to: 目标 ?? null });
  }

  function 查询货币(时代, 货币) {
    return 解析货币(时代, 货币);
  }

  function 解析交易货币(时代, 显式货币 = '', 上下文 = '') {
    const 时代结果 = 解析时代(时代);
    if (时代结果.status !== 'resolved') return 时代结果;
    const 显式名称 = String(显式货币 || '').trim();
    if (显式名称) {
      const 显式结果 = 解析货币(时代, 显式名称);
      if (显式结果.status === 'resolved' || 显式结果.reason === 'identity-item-excluded') return 显式结果;
    }
    const 文本 = String(上下文 || '');
    let 货币 = 时代结果.definition.默认法币;
    if (时代 === 'current') {
      if (/血神军团战备|战功商店|军需处/.test(文本)) 货币 = '战功';
      else if (/唐门/.test(文本)) 货币 = '唐门积分';
      else if (/史莱克|海神阁|内院|外院/.test(文本)) 货币 = '学院积分';
      else if (/星罗/.test(文本)) 货币 = '星罗币';
    } else if (时代 === 'zjdl') {
      if (/斗天者|斗天|军功|功勋/.test(文本)) 货币 = '斗天者积分';
      else if (/天龙/.test(文本)) 货币 = '天龙晶币';
      else if (/龙马/.test(文本)) 货币 = '龙马币';
    }
    return 解析货币(时代, 货币);
  }

  function 可直接消费(时代, 货币) {
    const 结果 = 获取货币种类(时代, 货币);
    return 结果.status === 'resolved' && 结果.kind !== 货币种类.军功;
  }

  function 获取货币种类(时代, 货币) {
    const 结果 = 解析货币(时代, 货币);
    return 结果.status === 'resolved'
      ? { status: 'resolved', era: 时代, currency: 货币, kind: 结果.definition.种类 }
      : 结果;
  }

  function 列出货币(时代) {
    const 时代结果 = 解析时代(时代);
    if (时代结果.status !== 'resolved') return 时代结果;
    return {
      status: 'resolved',
      era: 时代,
      currencies: Object.freeze(Object.values(时代结果.definition.货币).map(定义 => Object.freeze({ ...定义 }))),
    };
  }

  function 整数换算({ amount, from, to } = {}) {
    const 金额结果 = 解析整数金额(amount);
    if (金额结果.status !== 'resolved') return 金额结果;
    const 来源结果 = 解析货币(from?.era, from?.currency);
    if (来源结果.status !== 'resolved') return 来源结果;
    const 目标结果 = 解析货币(to?.era, to?.currency);
    if (目标结果.status !== 'resolved') return 目标结果;

    if (from.era !== to.era) {
      const 映射结果 = 查询跨时代映射(from, to);
      if (映射结果.status !== 'resolved') return 映射结果;
      const 映射 = 映射结果.mapping;
      if (!映射.精确汇率) {
        return 失败结果('no-exact-rate', { mappingId: 映射.id, from, to });
      }
      const 分子 = 金额结果.value * BigInt(映射.精确汇率.分子);
      const 分母 = BigInt(映射.精确汇率.分母);
      if (分母 <= 0n || 分子 % 分母 !== 0n) return 失败结果('non-integral-result', { from, to });
      return { status: 'resolved', amount: (分子 / 分母).toString(), currency: to.currency, mappingId: 映射.id };
    }

    const 来源单位 = 来源结果.definition.最小单位价值;
    const 目标单位 = 目标结果.definition.最小单位价值;
    if (来源单位 == null || 目标单位 == null) {
      return 失败结果('no-exact-rate', { from, to });
    }
    const 分子 = 金额结果.value * BigInt(来源单位);
    const 分母 = BigInt(目标单位);
    if (分子 % 分母 !== 0n) return 失败结果('non-integral-result', { from, to });
    return { status: 'resolved', amount: (分子 / 分母).toString(), currency: to.currency };
  }

  function 深冻结(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(深冻结);
    return Object.freeze(value);
  }

  const 注册表 = {
    version: '20260819.v1',
    currencyKinds: 货币种类,
    eraOrder: 时代顺序,
    eras: 时代定义,
    crossEraMappings: 跨时代映射,
    resolveCurrency: 查询货币,
    resolveTradeCurrency: 解析交易货币,
    isDirectlySpendable: 可直接消费,
    getCurrencyKind: 获取货币种类,
    listCurrencies: 列出货币,
    getCrossEraMapping: 查询跨时代映射,
    convertInteger: 整数换算,
  };
  深冻结(注册表);

  const 全局名称 = '__LWCS_ERA_CURRENCY_REGISTRY_V1__';
  if (!Object.prototype.hasOwnProperty.call(globalThis, 全局名称)) {
    Object.defineProperty(globalThis, 全局名称, {
      value: 注册表,
      configurable: false,
      enumerable: false,
      writable: false,
    });
  }
})();

;
/* source: TimelineRuntime.js */
!(function (global) {
  'use strict';

  const VERSION = '1.0.0';
  const ERA_PREFIX = Object.freeze({
    dldl: '1',
    jueshitangmen: '2',
    current: '3',
    zjdl: '4',
  });
  const PREFIX_ERA = Object.freeze(Object.fromEntries(Object.entries(ERA_PREFIX).map(([eraId, prefix]) => [prefix, eraId])));
  const ERA_IDS = Object.freeze(Object.keys(ERA_PREFIX));
  const STATE_NAMES = Object.freeze(['unprocessed', 'active', 'original', 'deviated']);
  const STATE_VALUES = Object.freeze(Object.fromEntries(STATE_NAMES.map((name, value) => [name, value])));
  const MAX_EVENT_SERIAL = 9999;
  const MAX_STATE_BYTES = Math.ceil((MAX_EVENT_SERIAL * 2) / 8);
  const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

  class TimelineRuntimeError extends Error {
    constructor(code, message, details = {}) {
      super(message || code);
      this.name = 'TimelineRuntimeError';
      this.code = code;
      Object.assign(this, details);
    }
  }

  function fail(code, message, details = {}) {
    throw new TimelineRuntimeError(code, message, details);
  }

  function isRecord(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function cloneValue(value, seen = new WeakMap()) {
    if (!value || typeof value !== 'object') return value;
    if (seen.has(value)) return seen.get(value);
    if (Array.isArray(value)) {
      const output = [];
      seen.set(value, output);
      value.forEach(item => output.push(cloneValue(item, seen)));
      return output;
    }
    const output = {};
    seen.set(value, output);
    Object.keys(value).forEach(key => {
      output[key] = cloneValue(value[key], seen);
    });
    return output;
  }

  function freezeDeep(value, seen = new Set()) {
    if (!value || typeof value !== 'object' || seen.has(value) || Object.isFrozen(value)) return value;
    seen.add(value);
    Object.keys(value).forEach(key => freezeDeep(value[key], seen));
    return Object.freeze(value);
  }

  function assertEraId(eraId) {
    const id = String(eraId || '').trim();
    if (!Object.prototype.hasOwnProperty.call(ERA_PREFIX, id)) {
      fail('ERA_ID_INVALID', '未知时代ID: ' + (id || '(empty)'), { eraId });
    }
    return id;
  }

  function parseEventId(id) {
    const text = typeof id === 'string' ? id.trim() : '';
    const match = /^([1-4])-(\d{4})$/.exec(text);
    if (!match) fail('EVENT_ID_INVALID', '事件ID必须符合x-xxxx格式: ' + (text || '(empty)'), { id });
    const serial = Number(match[2]);
    if (!Number.isInteger(serial) || serial < 1 || serial > MAX_EVENT_SERIAL) {
      fail('EVENT_SERIAL_INVALID', '事件序号超出范围: ' + text, { id: text, serial });
    }
    return { id: text, prefix: match[1], serial, eraId: PREFIX_ERA[match[1]] };
  }

  function normalizeState(state) {
    if (typeof state === 'number' && Number.isInteger(state) && state >= 0 && state < STATE_NAMES.length) {
      return state;
    }
    if (typeof state === 'string' && Object.prototype.hasOwnProperty.call(STATE_VALUES, state)) {
      return STATE_VALUES[state];
    }
    fail('STATE_INVALID', '非法原著事件状态: ' + String(state), { state });
  }

  function stateName(value) {
    return STATE_NAMES[value] || STATE_NAMES[0];
  }

  function normalizeStates(states) {
    if (states === undefined || states === null) return null;
    const values = Array.isArray(states) ? states : [states];
    return new Set(values.map(normalizeState));
  }

  function collectEvents(source, path = '$', output = []) {
    if (Array.isArray(source)) {
      source.forEach((item, index) => collectEvents(item, path + '[' + index + ']', output));
      return output;
    }
    if (!isRecord(source)) {
      fail('TIMELINE_SOURCE_INVALID', '时间线源必须由对象和数组组成: ' + path, { path });
    }
    if (Object.prototype.hasOwnProperty.call(source, '标识')) {
      output.push({ source, path });
      return output;
    }
    Object.entries(source).forEach(([key, value]) => collectEvents(value, path + '.' + key, output));
    return output;
  }

  function normalizeTimelineEvents(eraId, source) {
    const safeEra = assertEraId(eraId);
    if (!isRecord(source) && !Array.isArray(source)) {
      fail('TIMELINE_SOURCE_INVALID', '时间线源无效: ' + safeEra, { eraId: safeEra });
    }
    const collected = collectEvents(source);
    if (!collected.length) fail('TIMELINE_SOURCE_EMPTY', '时间线源没有事件: ' + safeEra, { eraId: safeEra });
    const libraryRuntime = global.__LWCS_LIBRARY_DATA_RUNTIME_V1__;
    const reuseCompiledEvents = typeof libraryRuntime?.isCompiledTimeline === 'function'
      && libraryRuntime.isCompiledTimeline(source);
    const seen = new Set();
    const events = collected.map(({ source: event, path }) => {
      const parsed = parseEventId(event.标识);
      if (parsed.eraId !== safeEra) {
        fail('EVENT_ID_ERA_MISMATCH', '事件ID时代前缀与注册时代不一致: ' + parsed.id, {
          eraId: safeEra,
          id: parsed.id,
          path,
        });
      }
      if (seen.has(parsed.id)) {
        fail('TIMELINE_SOURCE_DUPLICATE_ID', '时间线内事件ID重复: ' + parsed.id, {
          eraId: safeEra,
          id: parsed.id,
          path,
        });
      }
      seen.add(parsed.id);
      const triggerTick = Number(event.触发tick);
      if (!Number.isFinite(triggerTick) || triggerTick < 0) {
        fail('EVENT_TICK_INVALID', '事件缺少合法触发tick: ' + parsed.id, {
          eraId: safeEra,
          id: parsed.id,
          path,
        });
      }
      if (reuseCompiledEvents) return { id: parsed.id, serial: parsed.serial, event };
      const cloned = cloneValue(event);
      cloned.标识 = parsed.id;
      cloned.触发tick = triggerTick;
      return { id: parsed.id, serial: parsed.serial, event: freezeDeep(cloned) };
    });
    return events.sort((left, right) => left.event.触发tick - right.event.触发tick || left.serial - right.serial);
  }

  function sourceFingerprint(events) {
    return events.map(item => item.id + ':' + JSON.stringify(item.event)).join('\u0000');
  }

  function bytesFromBase64(text, eraId) {
    if (typeof text !== 'string') {
      fail('STATE_BASE64_INVALID', '状态串必须是base64字符串: ' + eraId, { eraId });
    }
    if (text === '') return new Uint8Array(0);
    if (text.length % 4 !== 0 || !BASE64_PATTERN.test(text)) {
      fail('STATE_BASE64_INVALID', '状态串不是合法base64: ' + eraId, { eraId });
    }
    const bytes = [];
    for (let index = 0; index < text.length; index += 4) {
      const first = BASE64_ALPHABET.indexOf(text[index]);
      const second = BASE64_ALPHABET.indexOf(text[index + 1]);
      const thirdChar = text[index + 2];
      const fourthChar = text[index + 3];
      const third = thirdChar === '=' ? 0 : BASE64_ALPHABET.indexOf(thirdChar);
      const fourth = fourthChar === '=' ? 0 : BASE64_ALPHABET.indexOf(fourthChar);
      if (first < 0 || second < 0 || third < 0 || fourth < 0) {
        fail('STATE_BASE64_INVALID', '状态串包含非法base64字符: ' + eraId, { eraId });
      }
      if (thirdChar === '=' && (fourthChar !== '=' || (second & 15) !== 0)) {
        fail('STATE_BASE64_NON_CANONICAL', '状态串base64填充位非法: ' + eraId, { eraId });
      }
      if (fourthChar === '=' && thirdChar !== '=' && (third & 3) !== 0) {
        fail('STATE_BASE64_NON_CANONICAL', '状态串base64填充位非法: ' + eraId, { eraId });
      }
      bytes.push((first << 2) | (second >> 4));
      if (thirdChar !== '=') bytes.push(((second & 15) << 4) | (third >> 2));
      if (fourthChar !== '=') bytes.push(((third & 3) << 6) | fourth);
    }
    if (bytes.length > MAX_STATE_BYTES) {
      fail('STATE_LENGTH_INVALID', '状态串超出四位事件序号可用长度: ' + eraId, { eraId, length: bytes.length });
    }
    return Uint8Array.from(bytes);
  }

  function base64FromBytes(bytes) {
    let output = '';
    for (let index = 0; index < bytes.length; index += 3) {
      const first = bytes[index];
      const hasSecond = index + 1 < bytes.length;
      const hasThird = index + 2 < bytes.length;
      const second = hasSecond ? bytes[index + 1] : 0;
      const third = hasThird ? bytes[index + 2] : 0;
      output += BASE64_ALPHABET[first >> 2];
      output += BASE64_ALPHABET[((first & 3) << 4) | (second >> 4)];
      output += hasSecond ? BASE64_ALPHABET[((second & 15) << 2) | (third >> 6)] : '=';
      output += hasThird ? BASE64_ALPHABET[third & 63] : '=';
    }
    return output;
  }

  function trimZeroBytes(bytes) {
    let length = bytes.length;
    while (length > 0 && bytes[length - 1] === 0) length -= 1;
    return length === bytes.length ? bytes : bytes.slice(0, length);
  }

  function readStateValue(bytes, serial) {
    const offset = serial - 1;
    const byteIndex = Math.floor(offset / 4);
    if (byteIndex >= bytes.length) return 0;
    return (bytes[byteIndex] >> ((offset % 4) * 2)) & 3;
  }

  function writeStateValue(bytes, serial, value) {
    const offset = serial - 1;
    const byteIndex = Math.floor(offset / 4);
    const shift = (offset % 4) * 2;
    if (value === 0 && byteIndex >= bytes.length) return bytes;
    const next = new Uint8Array(Math.max(bytes.length, byteIndex + 1));
    next.set(bytes);
    next[byteIndex] = (next[byteIndex] & ~(3 << shift)) | (value << shift);
    return trimZeroBytes(next);
  }

  function emptyStateSnapshot() {
    return Object.fromEntries(ERA_IDS.map(eraId => [eraId, new Uint8Array(0)]));
  }

  function assertDataRoot(dataRoot) {
    if (!isRecord(dataRoot)) fail('DATA_ROOT_INVALID', 'dataRoot必须是Schema根对象', { dataRootType: typeof dataRoot });
    return dataRoot;
  }

  function readStateSnapshot(dataRoot) {
    if (dataRoot === undefined || dataRoot === null) return emptyStateSnapshot();
    assertDataRoot(dataRoot);
    const world = dataRoot.world;
    const node = isRecord(world) ? world.原著事件状态 : undefined;
    if (node === undefined) return emptyStateSnapshot();
    if (!isRecord(node)) fail('STATE_CONTAINER_INVALID', 'world.原著事件状态必须是对象');
    if (node.版本 !== 1) fail('STATE_VERSION_INVALID', '原著事件状态版本必须为1', { version: node.版本 });
    if (Object.keys(node).some(key => !['版本', '数据'].includes(key))) {
      fail('STATE_CONTAINER_EXTRA_KEY', '原著事件状态包含未定义字段');
    }
    if (!isRecord(node.数据)) fail('STATE_DATA_INVALID', '原著事件状态.数据必须是对象');
    if (Object.keys(node.数据).some(key => !ERA_IDS.includes(key))) {
      fail('STATE_DATA_EXTRA_KEY', '原著事件状态.数据包含未定义时代字段');
    }
    const snapshot = {};
    ERA_IDS.forEach(eraId => {
      if (!Object.prototype.hasOwnProperty.call(node.数据, eraId)) {
        fail('STATE_DATA_INVALID', '原著事件状态缺少时代字段: ' + eraId, { eraId });
      }
      snapshot[eraId] = bytesFromBase64(node.数据[eraId], eraId);
    });
    return snapshot;
  }

  function ensureStateContainer(dataRoot) {
    const root = assertDataRoot(dataRoot);
    if (!isRecord(root.world)) root.world = {};
    if (root.world.原著事件状态 === undefined) {
      root.world.原著事件状态 = {
        版本: 1,
        数据: Object.fromEntries(ERA_IDS.map(eraId => [eraId, ''])),
      };
    }
    return readStateSnapshot(root);
  }

  function getRegisteredEvent(id) {
    const parsed = parseEventId(id);
    const registration = registrations.get(parsed.eraId);
    if (!registration) {
      fail('TIMELINE_NOT_REGISTERED', '时代时间线尚未注册: ' + parsed.eraId, { eraId: parsed.eraId, id: parsed.id });
    }
    const event = registration.byId.get(parsed.id);
    if (!event) {
      fail('EVENT_NOT_FOUND', '未注册该事件ID: ' + parsed.id, { eraId: parsed.eraId, id: parsed.id });
    }
    return { ...parsed, registration, event };
  }

  function copyEvent(event) {
    return cloneValue(event);
  }

  function eventWithState(event, state) {
    const output = copyEvent(event);
    output.状态 = state;
    return output;
  }

  function parseQuery(query = {}) {
    if (!isRecord(query)) fail('QUERY_INVALID', '时间线查询参数必须是对象');
    const hasEra = Object.prototype.hasOwnProperty.call(query, 'era');
    const era = hasEra ? assertEraId(query.era) : null;
    const hasFrom = query.fromTick !== undefined && query.fromTick !== null;
    const hasTo = query.toTick !== undefined && query.toTick !== null;
    const fromTick = hasFrom ? Number(query.fromTick) : -Infinity;
    const toTick = hasTo ? Number(query.toTick) : Infinity;
    if (!Number.isFinite(fromTick) && fromTick !== -Infinity) fail('QUERY_TICK_INVALID', 'fromTick必须是有限数字');
    if (!Number.isFinite(toTick) && toTick !== Infinity) fail('QUERY_TICK_INVALID', 'toTick必须是有限数字');
    if (fromTick > toTick) fail('QUERY_RANGE_INVALID', '时间线查询范围倒置', { fromTick, toTick });
    const limit = query.limit === undefined || query.limit === null ? null : Number(query.limit);
    if (limit !== null && (!Number.isInteger(limit) || limit < 0)) fail('QUERY_LIMIT_INVALID', 'limit必须是非负整数', { limit: query.limit });
    return { era, fromTick, toTick, states: normalizeStates(query.states), limit };
  }

  function registerTimelineSource(eraId, source) {
    const safeEra = assertEraId(eraId);
    const events = normalizeTimelineEvents(safeEra, source);
    const existing = registrations.get(safeEra);
    if (existing) {
      if (existing.source === source) return existing.summary;
      const fingerprint = sourceFingerprint(events);
      const existingFingerprint = existing.fingerprint || sourceFingerprint(existing.events);
      existing.fingerprint = existingFingerprint;
      if (existingFingerprint === fingerprint) return existing.summary;
      fail('TIMELINE_SOURCE_ALREADY_REGISTERED', '时代时间线已经注册且内容不同: ' + safeEra, { eraId: safeEra });
    }
    const byId = new Map();
    events.forEach(item => {
      if (eventIndex.has(item.id)) fail('EVENT_ID_GLOBAL_DUPLICATE', '全局事件ID重复: ' + item.id, { id: item.id });
      byId.set(item.id, item);
      eventIndex.set(item.id, item);
    });
    const registration = {
      eraId: safeEra,
      events: Object.freeze(events.slice()),
      byId,
      source,
      fingerprint: null,
      summary: Object.freeze({
        eraId: safeEra,
        count: events.length,
        firstId: events[0].id,
        lastId: events[events.length - 1].id,
      }),
    };
    registrations.set(safeEra, registration);
    return registration.summary;
  }

  function listEvents(query = {}, dataRoot) {
    const parsedQuery = parseQuery(query);
    const eraIds = parsedQuery.era ? [parsedQuery.era] : ERA_IDS.filter(eraId => registrations.has(eraId));
    eraIds.forEach(eraId => {
      if (!registrations.has(eraId)) fail('TIMELINE_NOT_REGISTERED', '时代时间线尚未注册: ' + eraId, { eraId });
    });
    const snapshot = readStateSnapshot(dataRoot);
    const output = [];
    eraIds.forEach(eraId => {
      registrations.get(eraId).events.forEach(item => {
        const triggerTick = Number(item.event.触发tick);
        if (triggerTick < parsedQuery.fromTick || triggerTick > parsedQuery.toTick) return;
        const status = stateName(readStateValue(snapshot[eraId], item.serial));
        if (parsedQuery.states && !parsedQuery.states.has(STATE_VALUES[status])) return;
        output.push(eventWithState(item.event, status));
      });
    });
    output.sort((left, right) => Number(left.触发tick) - Number(right.触发tick) || String(left.标识).localeCompare(String(right.标识)));
    return parsedQuery.limit === null ? output : output.slice(0, parsedQuery.limit);
  }

  function getEvent(id) {
    return copyEvent(getRegisteredEvent(id).event.event);
  }

  function getEventState(dataRoot, id) {
    const parsed = getRegisteredEvent(id);
    const snapshot = readStateSnapshot(dataRoot);
    return stateName(readStateValue(snapshot[parsed.eraId], parsed.serial));
  }

  function setEventState(dataRoot, id, state) {
    const parsed = getRegisteredEvent(id);
    const value = normalizeState(state);
    const snapshot = ensureStateContainer(dataRoot);
    const nextBytes = writeStateValue(snapshot[parsed.eraId], parsed.serial, value);
    const nextText = base64FromBytes(nextBytes);
    dataRoot.world.原著事件状态.数据[parsed.eraId] = nextText;
    return stateName(value);
  }

  function buildRelevantProjection(dataRoot, eventIds) {
    if (!Array.isArray(eventIds)) fail('PROJECTION_IDS_INVALID', 'eventIds必须是数组');
    const snapshot = readStateSnapshot(dataRoot);
    const seen = new Set();
    return eventIds
      .map(id => getRegisteredEvent(id))
      .filter(parsed => {
        if (seen.has(parsed.id)) return false;
        seen.add(parsed.id);
        return true;
      })
      .map(parsed => {
        const event = parsed.event.event;
        const projection = {};
        ['标识', '触发tick', '章节', '人物', '描述', '简述', '时间'].forEach(key => {
          if (event[key] !== undefined) projection[key] = cloneValue(event[key]);
        });
        projection.状态 = stateName(readStateValue(snapshot[parsed.eraId], parsed.serial));
        return projection;
      });
  }

  const registrations = new Map();
  const eventIndex = new Map();
  const API = Object.freeze({
    version: VERSION,
    eraIds: ERA_IDS,
    stateNames: STATE_NAMES,
    TimelineRuntimeError,
    registerTimelineSource,
    getEvent,
    listEvents,
    getEventState,
    setEventState,
    buildRelevantProjection,
    listRegisteredEras: () => ERA_IDS.filter(eraId => registrations.has(eraId)),
    isEraRegistered: eraId => registrations.has(assertEraId(eraId)),
  });

  const existing = global.__LWCS_TIMELINE_RUNTIME_V1__;
  if (existing && existing.version !== VERSION) {
    throw new Error('TimelineRuntime版本不符: ' + existing.version);
  }
  const runtime = existing || API;
  global.__LWCS_TIMELINE_RUNTIME_V1__ = runtime;
  try { if (global.parent && global.parent !== global) global.parent.__LWCS_TIMELINE_RUNTIME_V1__ = runtime; } catch (error) {}
  try { if (global.top && global.top !== global) global.top.__LWCS_TIMELINE_RUNTIME_V1__ = runtime; } catch (error) {}
})(typeof globalThis !== 'undefined' ? globalThis : window);

;
/* source: EraRuntime_Integration.js */
// 四时代总接线运行时：静态源选择、时间线注册、时代跨越提示与修炼时代渐变。
// 本模块只保留当前页面生命周期内的内存态注册，不写入MVU；业务动作仍由桥接/Schema消费者执行。
!(function (global) {
  'use strict';

  const VERSION = '1.1.0-era-context-20260822';
  const ERA_IDS = Object.freeze(['dldl', 'jueshitangmen', 'current', 'zjdl']);
  const ERA_LABELS = Object.freeze({ dldl: '斗一', jueshitangmen: '斗二', current: '斗三', zjdl: '斗四' });
  const DATA_GLOBAL_KEYS = Object.freeze({
    dldl: Object.freeze({ character: '__DLDL_CHARACTER_LIBRARY__', item: '__LWCS_斗罗大陆物品库__', faction: '__LWCS_DLDL_FACTION_LIBRARY__', location: '__LWCS_DLDL_LOCATION_LIBRARY__' }),
    jueshitangmen: Object.freeze({ character: '__LWCS_绝世唐门角色库__', item: '__LWCS_绝世唐门物品库__', faction: '__LWCS_JSTM_FACTION_LIBRARY__', location: '__LWCS_JSTM_LOCATION_LIBRARY__' }),
    current: Object.freeze({ character: '__LWCS_内置角色库__', item: '__LWCS_内置物品库__', faction: '__LWCS_内置势力库__', location: '__LWCS_内置地点库__' }),
    zjdl: Object.freeze({ character: '__LWCS_终极斗罗角色库__', item: '__LWCS_终极斗罗物品库__', faction: '__LWCS_终极斗罗势力库__', location: '__LWCS_终极斗罗地点库__' }),
  });
  const TIMELINE_GLOBAL_KEYS = Object.freeze({
    dldl: '__LWCS_TIMELINE_SOURCE_dldl__',
    jueshitangmen: '__LWCS_TIMELINE_SOURCE_jueshitangmen__',
    current: '__LWCS_TIMELINE_SOURCE_current__',
    zjdl: '__LWCS_TIMELINE_SOURCE_zjdl__',
  });
  const ABSORPTION_EVENT_ID = '3-3525';

  function 窗口列表() {
    const result = [global];
    try { if (global.parent && global.parent !== global) result.push(global.parent); } catch (_) {}
    try { if (global.top && global.top !== global && !result.includes(global.top)) result.push(global.top); } catch (_) {}
    return result;
  }

  function 读取全局值(key) {
    for (const current of 窗口列表()) {
      try {
        if (current && current[key] !== undefined && current[key] !== null) return current[key];
      } catch (_) {}
    }
    return null;
  }

  function 规范化tick(value) {
    const tick = Number(value);
    if (!Number.isFinite(tick) || tick < 0) throw new Error(`绝对tick无效: ${value}`);
    return tick;
  }

  function 读取库运行时() {
    const runtime = 读取全局值('__LWCS_LIBRARY_DATA_RUNTIME_V1__');
    if (!runtime || runtime.version !== '2.0.0') throw new Error('LibraryData_Runtime 2.0.0 未加载');
    return runtime;
  }

  function 读取数据注册表() {
    const registry = 读取全局值('__LWCS_ERA_DATA_REGISTRY_V1__');
    if (!registry || registry.version !== '1.1.0-era-resource-owner-20260822') throw new Error('EraDataRegistry 未加载');
    return registry;
  }

  function 读取时间线运行时() {
    return 读取全局值('__LWCS_TIMELINE_RUNTIME_V1__');
  }

  function 读取修炼运行时() {
    return 读取全局值('__LWCS_ERA_CULTIVATION_RUNTIME_V1__');
  }

  function 读取时代开场tick(eraId) {
    const runtime = 读取库运行时();
    const descriptor = 读取数据注册表().getEraDataSource(eraId);
    const startYear = Number(descriptor?.startYear);
    const ticksPerYear = Number(runtime.ticksPerYear);
    if (!Number.isFinite(startYear) || !Number.isFinite(ticksPerYear) || startYear < 0 || ticksPerYear <= 0) {
      throw new Error(`无法计算时代开场tick: ${eraId}`);
    }
    return startYear * ticksPerYear;
  }

  const DIRECT_ZJDL_TICK = 读取时代开场tick('zjdl');

  function 读取时代(absoluteTick) {
    const profileId = 读取库运行时().resolveEraAtTick(规范化tick(absoluteTick));
    if (!ERA_LABELS[profileId]) throw new Error(`未知时代profile: ${profileId}`);
    return { eraId: profileId, label: ERA_LABELS[profileId] };
  }

  function 取全局源键(eraId, resourceType) {
    if (resourceType === 'timeline') return TIMELINE_GLOBAL_KEYS[eraId];
    return DATA_GLOBAL_KEYS[eraId]?.[resourceType] || '';
  }

  function 读取正式资源时代(absoluteTick) {
    const tick = 规范化tick(absoluteTick);
    const registry = 读取数据注册表();
    const runtime = 读取库运行时();
    const ticksPerYear = Number(runtime.ticksPerYear);
    return ERA_IDS.slice().reverse().find(eraId => {
      const startYear = Number(registry.getEraDataSource(eraId)?.startYear);
      return Number.isFinite(startYear) && tick >= startYear * ticksPerYear;
    }) || ERA_IDS[0];
  }

  const SOURCE_TABLE = new Map();
  const SOURCE_METADATA = new Map();

  function 注册静态源(eraId, resourceType, source, options = {}) {
    const registry = 读取数据注册表();
    const descriptor = registry.getResourceDescriptor(eraId, resourceType);
    if (descriptor.sourceStatus !== 'configured') {
      return Object.freeze({ status: 'not-configured', eraId, resourceType, detail: descriptor.note || '' });
    }
    if (registry.getResourceState(eraId, resourceType).status === 'disabled') {
      return Object.freeze({ status: 'disabled', eraId, resourceType, detail: registry.getResourceState(eraId, resourceType).detail || '' });
    }
    if (source === undefined || source === null) {
      return Object.freeze({ status: 'failed', eraId, resourceType, detail: '源对象未就绪' });
    }
    const sourceKey = `${eraId}:${resourceType}`;
    const existingSource = SOURCE_TABLE.get(sourceKey);
    if (existingSource && existingSource !== source) {
      return Object.freeze({ status: 'failed', eraId, resourceType, detail: '同一时代资源已注册不同源对象' });
    }
    const timelineRuntime = resourceType === 'timeline' ? 读取时间线运行时() : null;
    if (resourceType === 'timeline') {
      if (!timelineRuntime || typeof timelineRuntime.registerTimelineSource !== 'function') {
        try { registry.setResourceState(eraId, resourceType, 'failed', 'TimelineRuntime未就绪'); } catch (_) {}
        return Object.freeze({ status: 'failed', eraId, resourceType, detail: 'TimelineRuntime未就绪' });
      }
      timelineRuntime.registerTimelineSource(eraId, source);
    }
    let metadata = null;
    if (resourceType === 'faction' || resourceType === 'location') {
      const libraryRuntime = 读取库运行时();
      if (!libraryRuntime || typeof libraryRuntime.compileLifecycleMetadata !== 'function') {
        return Object.freeze({ status: 'failed', eraId, resourceType, detail: 'LibraryData_Runtime缺少生命周期契约编译器' });
      }
      try {
        metadata = libraryRuntime.compileLifecycleMetadata(options.metadata, eraId, resourceType, source);
      } catch (error) {
        try { registry.setResourceState(eraId, resourceType, 'failed', error?.message || String(error || 'lifecycle_metadata_invalid')); } catch (_) {}
        return Object.freeze({ status: 'failed', eraId, resourceType, detail: error?.message || String(error || 'lifecycle_metadata_invalid') });
      }
    }
    SOURCE_TABLE.set(sourceKey, source);
    if (metadata) SOURCE_METADATA.set(sourceKey, metadata);
    try { registry.setResourceState(eraId, resourceType, 'loaded', options.detail || 'EraRuntime_Integration'); } catch (_) {}
    return Object.freeze({ status: 'loaded', eraId, resourceType, source });
  }

  function 注册可用源() {
    const registry = 读取数据注册表();
    const result = [];
    ERA_IDS.forEach(eraId => {
      registry.listResourceTypes().forEach(resourceType => {
        const descriptor = registry.getResourceDescriptor(eraId, resourceType);
        if (descriptor.sourceStatus !== 'configured') {
          result.push({ status: 'not-configured', eraId, resourceType, detail: descriptor.note || '' });
          return;
        }
        if (registry.getResourceState(eraId, resourceType).status === 'disabled') {
          result.push({ status: 'disabled', eraId, resourceType, detail: registry.getResourceState(eraId, resourceType).detail || '' });
          return;
        }
        const source = 读取全局值(取全局源键(eraId, resourceType));
        const metadata = descriptor.metadataGlobalKey ? 读取全局值(descriptor.metadataGlobalKey) : null;
        result.push(source === null
          ? { status: registry.getResourceState(eraId, resourceType).status, eraId, resourceType, detail: '源尚未加载' }
          : 注册静态源(eraId, resourceType, source, { metadata }));
      });
    });
    return Object.freeze(result);
  }

  function 获取时代静态源(eraId, resourceType, context = {}) {
    const registry = 读取数据注册表();
    const descriptor = registry.getResourceDescriptor(eraId, resourceType);
    const base = { ...context, eraId, resourceType };
    if (descriptor.sourceStatus !== 'configured') {
      return Object.freeze({ status: 'not-configured', ...base, detail: descriptor.note || '' });
    }
    const state = registry.getResourceState(eraId, resourceType);
    if (state.status !== 'loaded') return Object.freeze({ status: state.status, ...base, detail: state.detail || '' });
    const key = `${eraId}:${resourceType}`;
    if (!SOURCE_TABLE.has(key)) return Object.freeze({ status: 'failed', ...base, detail: '资源状态为loaded但静态源未注册' });
    return Object.freeze({ status: 'resolved', ...base, resourceStatus: 'loaded', source: SOURCE_TABLE.get(key) });
  }

  function 获取静态源(resourceType, absoluteTick) {
    const context = 获取时代上下文(absoluteTick);
    return 获取时代静态源(context.resourceEra, resourceType, context);
  }

  function 获取静态元数据(eraId, resourceType) {
    const registry = 读取数据注册表();
    const descriptor = registry.getResourceDescriptor(eraId, resourceType);
    if (descriptor.sourceStatus !== 'configured') return Object.freeze({ status: 'not-configured', eraId, resourceType, metadata: null, detail: descriptor.note || '' });
    const state = registry.getResourceState(eraId, resourceType);
    if (state.status !== 'loaded') return Object.freeze({ status: state.status, eraId, resourceType, metadata: null, detail: state.detail || '' });
    const metadata = SOURCE_METADATA.get(`${eraId}:${resourceType}`);
    return metadata
      ? Object.freeze({ status: 'resolved', eraId, resourceType, metadata })
      : Object.freeze({ status: 'failed', eraId, resourceType, metadata: null, detail: '静态资源已加载但生命周期sidecar未注册' });
  }

  function 获取时代地图配置(absoluteTick) {
    const context = 获取时代上下文(absoluteTick);
    const profile = 读取数据注册表().getMapProfile(context.resourceEra);
    return Object.freeze({ ...profile, eraId: context.resourceEra, tick: context.tick });
  }

  function 获取生命周期记录(eraId, resourceType, recordId, absoluteTick, mode = 'demand') {
    const tick = 规范化tick(absoluteTick);
    const resolved = 获取静态元数据(eraId, resourceType);
    const record = resolved.metadata?.记录?.[String(recordId || '').trim()] || null;
    if (!record) return Object.freeze({ status: resolved.status === 'resolved' ? 'unknown-record' : resolved.status, active: false, eraId, resourceType, recordId: String(recordId || '').trim(), record: null });
    const effective = tick >= Number(record.首次生效tick);
    const active = effective && (mode === 'resident' ? record.运行状态 === '开场常驻' : true);
    return Object.freeze({ status: 'resolved', active, eraId, resourceType, recordId: String(recordId || '').trim(), record });
  }

  function 列出生命周期记录(eraId, resourceType, absoluteTick, mode = 'demand') {
    const resolved = 获取静态元数据(eraId, resourceType);
    if (resolved.status !== 'resolved') return Object.freeze([]);
    const tick = 规范化tick(absoluteTick);
    return Object.freeze(Object.entries(resolved.metadata.记录)
      .filter(([, record]) => tick >= Number(record.首次生效tick) && (mode !== 'resident' || record.运行状态 === '开场常驻'))
      .map(([recordId, record]) => Object.freeze({ recordId, ...record })));
  }

  async function 确保时代资源(absoluteTick, resourceTypes, options = {}) {
    const context = 获取时代上下文(absoluteTick, options);
    const resources = await 读取数据注册表().ensureEraResources(context.resourceEra, resourceTypes, options);
    return Object.freeze({ ...context, resources: Object.freeze(resources) });
  }

  function 获取时代跨越(previousTick, currentTick) {
    const previous = 规范化tick(previousTick);
    const current = 规范化tick(currentTick);
    const transitions = 读取库运行时().getEraTransitions(previous, current).map(item => Object.freeze({
      ...item,
      label: ERA_LABELS[item.eraId] || item.eraId,
    }));
    const lines = transitions.map(item => item.direction === 'backward'
      ? `时代回退：已离开${item.label}，时间线回到${item.thresholdYear}年前的阶段。`
      : `时代跨越：${item.label}修炼与世界规则开始生效（斗罗历${item.thresholdYear}年）。`);
    return Object.freeze({
      previousTick: previous,
      currentTick: current,
      transitions: Object.freeze(transitions),
      crossed: transitions.length > 0,
      broadcastText: lines.join('\n'),
    });
  }

  function 获取深渊吸收tick(dataRoot) {
    const timeline = 读取时间线运行时();
    if (!timeline || typeof timeline.getEventState !== 'function' || typeof timeline.getEvent !== 'function') return null;
    try {
      if (timeline.getEventState(dataRoot, ABSORPTION_EVENT_ID) !== 'original') return null;
      const event = timeline.getEvent(ABSORPTION_EVENT_ID);
      const tick = Number(event?.触发tick);
      return Number.isFinite(tick) && tick >= 0 ? tick : null;
    } catch (_) {
      return null;
    }
  }

  function 获取修炼渐变(absoluteTick, options = {}) {
    const tick = 规范化tick(absoluteTick);
    const library = 读取库运行时();
    if (tick >= DIRECT_ZJDL_TICK) return library.getCultivationEraBlend(tick, { directZJDL: true });
    const absorptionTick = 获取深渊吸收tick(options.dataRoot);
    return absorptionTick === null
      ? library.getCultivationEraBlend(tick)
      : library.getCultivationEraBlend(tick, { deepAbyssAbsorptionTick: absorptionTick });
  }

  function 构建修炼选项(absoluteTick, options = {}) {
    const blend = 获取修炼渐变(absoluteTick, options);
    return {
      ...options,
      currentTick: 规范化tick(absoluteTick),
      blend: { current: blend.current, zjdl: blend.zjdl, mode: blend.mode, stage: blend.stage },
    };
  }

  function 获取时代上下文(absoluteTick, options = {}) {
    const tick = 规范化tick(absoluteTick);
    const narrative = 读取时代(tick);
    const resourceEra = 读取正式资源时代(tick);
    const blend = 获取修炼渐变(tick, options);
    return Object.freeze({
      tick,
      narrativeEra: narrative.eraId,
      narrativeLabel: narrative.label,
      resourceEra,
      resourceLabel: ERA_LABELS[resourceEra],
      cultivationBlend: Object.freeze({
        current: Number(blend.current),
        zjdl: Number(blend.zjdl),
        mode: blend.mode,
        stage: Number(blend.stage),
        absorptionTick: blend.absorptionTick ?? null,
      }),
    });
  }

  function 获取运行时诊断() {
    const registry = 读取数据注册表();
    return Object.freeze({
      version: VERSION,
      sourceStatus: Object.freeze(ERA_IDS.flatMap(eraId => registry.listResourceTypes().map(resourceType => {
        const state = registry.getResourceState(eraId, resourceType);
        return Object.freeze({ eraId, resourceType, status: state.status, detail: state.detail || '' });
      }))),
      registeredTimelines: Object.freeze(读取时间线运行时()?.listRegisteredEras?.() || []),
    });
  }

  const API = Object.freeze({
    version: VERSION,
    eraIds: ERA_IDS,
    eraLabels: ERA_LABELS,
    absorptionEventId: ABSORPTION_EVENT_ID,
    directZJDLTick: DIRECT_ZJDL_TICK,
    resolveEraAtTick: 读取时代,
    resolveResourceEraAtTick: 读取正式资源时代,
    getEraContext: 获取时代上下文,
    ensureEraResourcesForTick: 确保时代资源,
    registerSource: 注册静态源,
    registerAvailableSources: 注册可用源,
    getStaticSourceForEra: 获取时代静态源,
    getStaticSource: 获取静态源,
    getStaticSourceMetadata: 获取静态元数据,
    getLifecycleRecord: 获取生命周期记录,
    listLifecycleRecords: 列出生命周期记录,
    getMapProfileForTick: 获取时代地图配置,
    getEraTransitions: 获取时代跨越,
    getCultivationBlend: 获取修炼渐变,
    buildCultivationOptions: 构建修炼选项,
    getDiagnostics: 获取运行时诊断,
    getRuntime: 读取修炼运行时,
  });

  const globalKey = '__LWCS_ERA_RUNTIME_INTEGRATION_V1__';
  const existing = global[globalKey];
  if (existing && existing.version !== VERSION) throw new Error(`EraRuntime_Integration版本不符: ${existing.version}`);
  const runtime = existing || API;
  global[globalKey] = runtime;
  try { if (global.parent && global.parent !== global) global.parent[globalKey] = runtime; } catch (_) {}
  try { if (global.top && global.top !== global) global.top[globalKey] = runtime; } catch (_) {}
  try { runtime.registerAvailableSources(); } catch (error) { console.warn('[LWCS] 四时代源注册未完成:', error); }
})(typeof globalThis !== 'undefined' ? globalThis : window);

;
/* source: EraCultivation_Runtime.js */
// 四时代修炼运行时：封版参数与纯计算/结算接口。
// 生产者：本文件（由入口集成代理加载）；消费者：MVU_Schema_Runtime、MVU_Skill_Runtime、mvu_logic_bridge。
// 本模块不负责入口加载、事件状态判定或推进预设接线。
!(function (global) {
  'use strict';

  const VERSION = '1.0.0-era-cultivation-20260819';
  const ERA_BY_PROFILE = Object.freeze({ dldl: '斗一', jueshitangmen: '斗二', current: '斗三', zjdl: '斗四' });
  const NO_SOUL_CORE_GATE = Number.POSITIVE_INFINITY;
  const LEVEL_CAPS_BY_ERA = Object.freeze({
    斗一: Object.freeze([89, 98, 99.5, NO_SOUL_CORE_GATE]),
    斗二: Object.freeze([89, 98, 99.5, NO_SOUL_CORE_GATE]),
    斗三: Object.freeze([69, 89, 98, NO_SOUL_CORE_GATE]),
    斗四: Object.freeze([69, 89, 98, NO_SOUL_CORE_GATE]),
  });
  const LEVEL_ADJUSTMENTS = Object.freeze([[20, 30, 1.024], [30, 40, 1.014], [40, 60, 0.865]]);
  const INITIAL_LEVEL_ANCHORS = Object.freeze({
    劣等: Object.freeze([1, 2]),
    正常: Object.freeze([3, 4]),
    优秀: Object.freeze([5, 6]),
    天才: Object.freeze([7, 9]),
    顶级天才: Object.freeze([9, 10]),
    绝世妖孽: Object.freeze([10, 10]),
  });
  const PARAMETERS = Object.freeze({"version":"era-cultivation-final-20260819","fit":{"targetCount":224,"inBand":162,"rmse":1.0418983433875995,"endpointRmse":1.315521784700492},"parameters":{"baseVariationPower":1,"baseVariationAge":[0.4979959839195493,1.0787280393690946,1.868475081807203,0.4,2.1566902813911946,2.0937186893388655,0.7867733429197995,3,3,3,3,0.4],"baseVariationEraTalent":{"斗一":[1.2767868159350368,1.502450078003413,2.9277002188456,0.8435658646975894,0.6883602856586172,1.9015292242539055],"斗二":[1.36905306453291,3,2.6098049864482924,1.4550870924385657,3,3],"斗三":[1.134507063012965,3,1.2166254402355312,1.4793254723766707,2.347625467112181,1.007513298848355],"斗四":[2.9277002188456,3,2.530140886042872,0.9559730002742267,3,1.0285460387295402]},"baseVariationEarlyEraTalent":{"斗一":[2.22779597031629,1.7158500177875946,0.7714913272560323,0.2704556652599967,1.3843054560296613,1.372922965877485],"斗二":[1.7561082035111604,0.6762564167965434,0.4303740035353919,0.25494306495068947,0.5565677221390628,0.4423410979336079],"斗三":[1.64966612014534,0.8900404457693161,0.7676090105396997,0.7017878754690547,0.5903727767761343,0.9797255363170447],"斗四":[0.9772428129627441,1.6107065959671718,0.46494679618269674,2.4909730704683426,0.40328335557333267,1.1147323010477201]},"baseVariationLevelScale":0.49626535888927736,"baseVariationLevelInteractionAge":[1.411926763037311,3.6722795023395225,2.9832704558720993,2.6837022189045565,4,3.6317232692508226,1.0025938842095943,1.9311990399456676,2.088778061076873,3.017923199032935,2.510879852639606,2.1843223003236516,2.589215643440033,1.0098627115715326,2.1863538437822188,2.1823415330247316,4,1.0065742991404547,1.3726027360641875],"baseVariationLevelEraTalent":{"斗一":[0.25,0.25,0.25,2.8197285456605727,2.6237614221014414,0.537256448128083],"斗二":[0.2851542460215194,0.5305593808580059,0.6439191596055792,4,3.2519845798462383,2.1826144743527607],"斗三":[0.48598732879061446,0.3896227293458124,0.9829085051448,2.9619308937208415,2.81512547727651,0.9913958721863375],"斗四":[2.021036464685537,0.9787608431166123,4,1.757204592103971,3.1984344107514233,3.71771456361346]},"eraSpeed":{"斗一":[0.7495464968537389,0.8224188029542704,0.4759392896926258,0.44922029714085043,0.5595462695688294,0.4886629632342205,0.68,0.6782740999621101,0.19,0.28,0.19109720003036187,2.4,0.3343908503234612,0.4643828438789588,0.24506062558186686,0.20015593122753345,0.17785207839132247],"斗二":[0.8215300826105891,1.250468261414683,0.9056329418424843,0.9021770098070113,1.3584417923669134,1.351534048843821,1.3304658716187274,0.313875,0.31124748994971835,0.25,0.2,0.2154764076942245,2,0.6,0.2758918742887087,0.19974684404034868,0.1757047975331545],"斗三":[0.8938846232487758,1.1561115484690871,1.4840167912780864,1.0209309658859043,1.0103692324723326,0.9811126646794737,1.4810352797267032,0.32843478744764526,0.31124748994971835,0.319196750625,0.11624999999999999,0.25,0.175,0.175,0.24978042254273342,0.27621978574004197,0.2882836914508411],"斗四":[2.1878693493173844,2.6341615902585085,2.207557366079394,2.130832630917113,2.8623313921924756,3.086369119415535,2.739104083002093,2.47,3.002915783034882,0.7438016635284314,0.6224949798994366,0.8224331438404774,4.069293363519384,2.003098664421504,0.125,0.537279644118651,0.5314126351712608]},"age":[1.0248956879779547,0.9998564791024275,1.0454005634750043,1.0241012852221343,0.8524123574748944,1.018571300014914,1.036136122906551,1.0326995934514527,0.9563951435968767,1.2380860037478265,1.7145893991296635,1.4579999999999997],"eraAge":{"斗一":[0.9693911558633354,0.9562127479044699,0.9961030785871681,1.035126935489949,0.9791419264691344,1.0389090400777454,1.614187791369933,0.5723056069741264,2.4096579867074968,3,1.5114767960496258,1.188787333535486],"斗二":[1.0573187704634683,1.0877042363682539,1.0412014431379644,0.9907292441733878,0.5,0.6858710562414266,1.773459626820328,0.5,1.4624940040089622,1.1476262258268746,1.0265822596516483,0.955140919271386],"斗三":[0.9647869483161198,0.8835826571204083,1.2389300268277823,1.020123038213062,0.5,0.5,0.8346915643477403,0.5,0.5,0.8105355042110842,0.9437749231169428,0.959021314070607],"斗四":[0.9897986124315382,1.0165931587684436,1.040268941607992,1.012053114302191,1.1089654825965245,0.7802809471912119,1.0316407881361418,0.9571470887356958,0.9785751883396724,0.9362648559084683,1.3065353034355514,1.9444201058151935]},"talentAge":{"劣等":[1.6847069331995053,2.5,1.042484737306117,0.5,0.5,0.5,0.7881401250000001,0.5,0.5,2.1083749199862343,1.332231315642055,1.1847833551041038],"正常":[0.6815105104884247,1.7022763981032467,0.9084481192534247,1.0291419210878534,1.6393848913918594,1.3622237135189306,2.008048322256247,1.6996247783368132,1.6054807704817782,2.5,1.42214781735739,1.198739495509842],"优秀":[0.5,0.5,0.8556162918822491,0.5,1.0431886490059745,1.2963050433590546,1.061286542591397,2.5,2.5,2.5,2.5,1.5668520142458344],"天才":[0.9701863745492119,1.0083557327249473,1.0209609852449286,1.0109629942682128,1.2707080092291,1.853666012305746,1.5670969819653346,0.5,0.5,2.5,1.4617999305784573,1.1851756644030214],"顶级天才":[0.9602770670650209,1.0126376483270971,1.0193377122684413,0.9864145739296348,1.4044442023349863,1.0071589227880304,0.5,0.5,1.4516975987318044,1.0902517139329213,0.5,0.5],"绝世妖孽":[0.9105717757803334,0.8324882176885542,0.5659639530419476,1.0099031707485668,2.5,1.6641889705692665,1.2686953645188963,1.2556845808044022,1.3511861467123814,0.6455207166311776,2.4406882621765953,1.566044921959584]},"eraTalent":{"斗一":[1.0236748833476894,1.1558214099633772,1.0625866696432973,0.9667625093331897,0.9681124003706107,1.2226611388254065],"斗二":[0.7177639557849422,0.8890052003962025,0.9067000463538913,1.0545575778460883,1.4214995750795552,1.3178305456369916],"斗三":[0.7628522276124383,1.011020548220019,0.8200499629207901,1.0264524138279367,1.1121613083186466,0.9623890688686814],"斗四":[0.67,0.9913813588195795,0.7201161547566616,0.9684677004568549,0.862379130496571,1.0398272921709308]},"eraTalentAge":{"斗一":{"劣等":[1.5771666336619574,1.4842648553879272,0.5804100076310071,1.0279935692554731,1.0193523999797298,1.348202283958404,1.0736913642701376,1.0258466048528965,1.2516943661431408,0.25,0.25,0.5798880069864283,0.7894070178536525,0.8906381747687799,0.9476384560289461,0.9881414967023187,0.9709077883172317,0.986586867028031,0.9833072217021408],"正常":[1.0940015464709032,1.4100207767263908,0.7461905710885003,0.7013260431022952,0.3999735531746385,0.5866593118569643,0.6176819277662448,0.6184167197821232,0.68788766875704,0.4483188161409855,0.45276376809355556,1.645359479327898,1.2399391854937682,1.0891149329331087,1.0540481316649657,1.0298546640357606,1.0337364007998486,1.0230859964405894,1.01547661807167],"优秀":[0.826074898632328,1.0762859388841965,1.3791697660121283,1.1641020774367234,0.8286584257621995,1.0687641275448403,0.26903571428571427,0.4971467441148835,0.5359083928217081,3,3,0.8127323357412841,3,1.4881878139352458,1.1637057503402808,1.079411862031835,1.041257712642797,1.0326481247718733,1.0141982059944936],"天才":[0.8882258550726676,0.4953784898550122,0.5524751918437587,0.25,0.6946167322978184,0.8488910654162813,0.9468653556549875,1.0682312744486249,0.6607919154001191,2.6166245019201653,2.720887145034537,0.970821780054595,1.020027112437109,1.3330513480880448,0.25,0.5968786442512045,0.8306007709328379,0.9180739248894452,0.9630805947025357],"顶级天才":[0.9932605705968964,0.8695513466469962,1.0281028275902278,1.076116340398189,1.3648990109498058,0.8229505837926259,0.5971705073925685,0.6391919660834038,0.7739720047287298,0.9140190748053008,2.0165751777612493,1.3546724252505464,0.28922506699164047,3,1.0794216830182413,1.004947234219507,0.997726311243589,0.9844037161877983,0.9826806673560355],"绝世妖孽":[1.0099449809571825,0.9998066649963103,1.0881255414317514,1.043111880737092,1.423399768269679,0.8645144684386552,1.0903504676104465,1.1834282436692123,1.1553073847931556,1.0429968611410854,0.8156702787817803,0.5301751511784232,1.175786770183076,1.4479654993785833,0.4456108085900869,3,1.5395387717407893,1.221926651754136,1.1017911287233697]},"斗二":{"劣等":[2.2597022126987842,1.0757019937756034,0.9785887793086081,0.9687855640881735,1.297990384777868,1.273227634600722,0.9977870554814041,0.994140021974846,0.9842872058207515,0.25,0.25,0.5871801243451833,0.8265197727566299,0.9148588265565948,0.9456254410160613,0.9596181059569053,0.9774665380424947,0.9790012653354685,0.9775721632576636],"正常":[1.1628243566397956,1.6257238840142394,0.5642920063484463,0.5916487933655209,0.39898329664897697,0.4505887239402709,1.1431265442863816,1.2069619771994382,0.7838704535510882,1.8499708596911106,1.2505054554399633,1.1472210822026396,1.060708246587431,1.031939757023261,1.0126845854536322,1.018023956997409,1.0130346475478755,1.0244091236354738,1.009848760402453],"优秀":[0.8337224574960407,0.9930822458866249,2.085402146170804,3,0.9302208413918761,1.2242590931862334,0.25,0.33790419601043953,0.9059499585524217,0.6775956879476324,0.25,0.40797140089504375,1.8406016436214745,1.2532277974970978,1.100891885940852,1.0596835338038668,1.0331229742998862,0.9937723047075584,0.9784791922392018],"天才":[1.0368471147069676,1.5478445282113302,1.0415145191012718,1.3866301576759164,1.7465143176459808,0.25,0.8783618213724331,1.032615130203522,0.9699071618627374,0.5832198408096183,0.8958309124408046,0.25,0.25,0.25,0.25,0.6061854106909093,0.8198108660101711,0.9080199939254778,0.9445623453592282],"顶级天才":[0.9100817320701393,0.9051918393490668,0.9771302607237344,1.1596848839123708,2.428332423827565,0.7652424521286393,0.5385037826232022,0.25,0.25,0.25,0.25,0.25,1.1128959370275737,0.25,1.7257701772481986,1.2224009527837971,1.0780381755640893,1.032504388467259,1.0238437910178648],"绝世妖孽":[0.9104563006339759,1.0296445244795605,1.0598054367909173,1.053985653970446,0.9638417791855377,0.25,0.9415123247829107,0.3489406816288539,0.5519640846013453,3,3,3,1.5514315741065943,1.2171303065055312,1.1116835503149516,1.0472459743227627,1.0323305031782122,1.026008899167102,1.0152667789348497]},"斗三":{"劣等":[2.001969030315789,1.63041256131436,1.0696387728761925,1.0789615013994358,1.0298443038767322,0.9320107577502621,1.0365856252011787,1.0428405635498659,0.9856601824023523,0.25,0.25,0.5860808665492638,0.8070478968241535,0.9056578018055094,0.9672113346924852,0.967831889395044,0.978432652061209,0.9741067703334616,0.9968294126134861],"正常":[1.069229201665318,1.3636311422602816,0.5770578231514958,0.5540555377095692,0.7252141417611986,1.499814705390701,1.5274880820835164,1.568590666439013,1.525629666022747,1.2370407264430654,1.1385533271292572,0.9342419387758062,0.9835597524947401,0.9879934919824933,0.9963312199221409,1.001474253899339,1.010380299442868,1.0189109791832913,1.0098708708569408],"优秀":[0.8911799253927709,1.1650958219925756,2.9277002188456,3,0.7529901205711114,1.1551091629723873,1.3162412268778216,1.2227856408308129,1.3887526998931141,0.9869673735369304,0.9613089059292487,1.238958706405859,0.5366824071017803,0.7816912260569941,0.9154424848438136,0.976128487784081,0.9886271090661858,0.983460243108307,0.9935223633466969],"天才":[0.7738241641768188,1.4454748360942964,1.0108402654080753,1.0065734373495783,1.4642965891669828,1.140020397824325,0.6879075715754761,0.25,0.25,0.3112474899497183,0.25,0.25,0.25,0.25,0.25,0.588342948620814,0.7973804579775744,0.8909625318335334,0.9380686634948732],"顶级天才":[0.6864829544993619,1.43724928048343,0.9569745832389158,1.047875954149608,1.1771595877467533,0.9567070964395581,1.1418076534197097,0.43589139107577135,0.2930924123274646,0.9229358652683584,3,3,0.8831945041319642,0.25,0.25,0.6008619336039355,0.8388231940367624,0.9414762152598563,0.9727581712338257],"绝世妖孽":[0.6518025177350614,1.6682452241880168,1.0575497931339843,0.25,0.25,0.25,1.2159250679985067,0.2824875,2.7952542224358727,0.25,2.550994920525589,1.41269051271011,1.1330250980553873,1.0423209246450758,1.0256344502333197,1.0229439967658966,0.9870074347984649,1.0004089327009054,1.0158433673648937]},"斗四":{"劣等":[1.197212848552941,1.0390920342331793,0.8058451966457476,1.1025,0.25,0.25,0.5130257061174159,0.25,0.437855625,0.3230690147073613,0.3650518331685829,0.25,0.692526326736374,0.5049384315716844,0.45,2.8940625000000004,1.463158906592969,1.1556435781635555,1.096339761103098],"正常":[0.66380172458345,1.0461304217379954,0.25,1.05,1.1757789535567311,0.8428522964564381,1,1,0.8849949112792601,0.5806451612903226,0.5138680130008607,0.6276855927859065,3,1.2555,1.2555,1.5382920109623321,1.2011267516273525,1.050207892788757,1.0246950765959597],"优秀":[0.7459199933239862,1.881676423158921,1.21550625,0.30661155628609427,0.9070294784580498,1,1,1,1,2.5614449047363874,0.8083521602545696,0.9057512911488023,0.5497277371875,0.512822615302431,0.5746131064883939,3,3,1.5606774439347526,1.2631072217347126],"天才":[0.6144393241167434,0.3964124671720925,1.12995,1.6680214285714288,0.25,0.25,0.25,0.25,0.25,3,1.5546180559403204,1.2326664298327255,1.1499132744810359,1.2326664298327255,1.5606774439347526,3,1.5606774439347528,1.2233554330278331,1.1187651927847688],"顶级天才":[0.5851803086826128,1,1,2.05,0.25,0.25,0.25,3,2.0101359273138413,3,1.7776706024604192,0.8844764782938913,0.25,0.4341902484798571,0.25,0.25,0.55746539359291,1.3056557536719346,0.5186370641331773],"绝世妖孽":[0.9070294784580498,1.1025,1,1.05,1.2437179888686742,1.3497169792943227,0.4242402568859526,0.5138680130008607,0.4331148348332823,1.7965675308597568,1.7965675308597568,1.1130000000000002,0.5680357612985433,1,0.9759000729485332,0.9070294784580499,1.1356808018431646,0.3155443385489361,0.5034384498056929]}},"earlyTalent":{"斗一":{"天才":[0.43244544640821364,0.35,2.500954500842054,1.2059064061979623,0.907273510050897],"顶级天才":[0.4368951891168401,1.1537657338066123,1.203814469167021,1.2528923703934967,1.0144635694998145],"绝世妖孽":[0.4667485789304254,1.515275774003847,1.619502471728594,3,1.727353395489245]},"斗二":{"天才":[0.35,0.5459237188185248,0.5047231439082077,1.0085169761115822,0.7456059061609557],"顶级天才":[0.3657578201625605,0.922175685513882,1.6666042182051581,1.3493100898636647,0.6817619314700436],"绝世妖孽":[0.40513202313309543,0.7712677519986336,0.792441655921001,0.9036271455046584,0.8011869995045944]},"斗三":{"天才":[0.47849002595453294,1.1261448564692351,1.2858582005099441,1.422892908016476,1.0957739741103394],"顶级天才":[0.5105187738554425,1.4497304459211735,1.0777154357275311,1.6441855766127036,1.4890859166711818],"绝世妖孽":[0.547361819102901,1.5528638142886804,0.9484962160134778,0.35,0.35]},"斗四":{"天才":[0.4511421947013212,0.774990937658956,1.5493864035281797,1.0660439904588637,0.35],"顶级天才":[0.9910079911304388,2.059285714285714,2.4432343875000004,0.5573145796977265,0.35],"绝世妖孽":[0.6248571428571429,1.1211928875000001,3,0.7345440762813352,1.3092559631338052]}},"coreGrowth":{"斗一":[1,3,2.344386782786573,1],"斗二":[1,0.9523809523809523,0.5,1],"斗三":[1,1,0.5,0.5],"斗四":[1,1,3,1]},"coreSpeed":{"斗一":[0.8485684507456963,0.7647724901739319,0.9798537014021512],"斗二":[7.5,5,4.90284715268797],"斗三":[10,5,3.5217834495488796],"斗四":[50.7406266621718,15,5]},"coreTalent":{"斗一":{"劣等":[1.0260891247607724,1.029245472534995,1.029524384482194],"正常":[0.9745499806703812,0.9718495271639761,0.9767199130275941],"优秀":[1.0123287127127358,1.0124103527428636,1.001784616760402],"天才":[0.9923119480615286,0.9963681073639648,0.9845695243897493],"顶级天才":[1.1822968880013451,1.0739944154245225,1.0312575163513005],"绝世妖孽":[0.5541726360375865,1.6388349609276016,1.2709393035783028]},"斗二":{"劣等":[0.9801267775090508,0.9938401401691063,1.0054167261461608],"正常":[1.0021777341618996,0.993590667500584,0.9987293810938052],"优秀":[0.2532268807741641,0.5789440085864597,0.7505493899034209],"天才":[0.7418448431415,0.25,0.5036605889440537],"顶级天才":[0.2563634866124277,0.25,0.49770828968704856],"绝世妖孽":[0.6486932826904201,0.25,0.5006466466373088]},"斗三":{"劣等":[0.9899286394680074,0.9874703423716484,0.9812240501267946],"正常":[1.0087316162081594,1.0123897572175193,0.9978156284697426],"优秀":[0.27974208184564914,2.5793545044249773,1.7122226611685387],"天才":[0.25,0.25,0.4914719283491743],"顶级天才":[5,0.25,2.024336504904118],"绝世妖孽":[0.7780950043462816,0.47876741300925163,0.25]},"斗四":{"劣等":[0.9785298682766161,0.9802885733802494,1.0061101066964098],"正常":[0.45361114703344146,2.2584719226134555,1.4948292658950986],"优秀":[0.34814110834916684,0.6617744985213488,0.8170541109719696],"天才":[1.5235885444718453,0.25,1.6146225441144149],"顶级天才":[0.313875,0.25,0.6669747501353607],"绝世妖孽":[0.25,0.3875,0.31421028521812383]}}},"levelBands":["1-20","20-40","40-50","50-60","60-64","64-67","67-70","70-75","75-80","80-90","90-95","95-98","98-99","99-99.5","99.5-100","100-120","120+"],"ageBands":["6-12","12-18","18-22","22-30","30-40","40-50","50-60","60-80","80-100","100-200","200-500","500+"],"coreRules":{"斗一":[{"startLevel":89,"bottleneckLevel":89,"sourceStage":0},{"startLevel":98,"bottleneckLevel":98,"sourceStage":1}],"斗二":[{"startLevel":50,"bottleneckLevel":69,"sourceStage":0},{"startLevel":80,"bottleneckLevel":89,"sourceStage":1}],"斗三":[{"startLevel":50,"bottleneckLevel":69,"sourceStage":0},{"startLevel":80,"bottleneckLevel":89,"sourceStage":1},{"startLevel":95,"bottleneckLevel":98,"sourceStage":2}],"斗四":[{"startLevel":50,"bottleneckLevel":69,"sourceStage":0},{"startLevel":80,"bottleneckLevel":89,"sourceStage":1},{"startLevel":95,"bottleneckLevel":98,"sourceStage":2}]},"finalCapRules":{"斗一":{"顶级天才":97},"斗二":{"顶级天才":99},"斗三":{"顶级天才":[{"probability":0.5,"cap":98},{"probability":0.3,"cap":99},{"probability":0.2,"cap":99.5}]},"斗四":{"天才":[{"probability":0.75,"cap":99},{"probability":0.25,"cap":105}],"顶级天才":[{"probability":0.75,"cap":109},{"probability":0.25,"cap":115}],"绝世妖孽":146}},"meditation":{"defaultHours":8,"斗三第一核后Hours":12},"baseVariation":{"min":0.95,"max":1.05,"deterministicFit":1,"growthPower":1,"ageResponse":[0.4979959839195493,1.0787280393690946,1.868475081807203,0.4,2.1566902813911946,2.0937186893388655,0.7867733429197995,3,3,3,3,0.4],"eraTalentResponse":{"斗一":[1.2767868159350368,1.502450078003413,2.9277002188456,0.8435658646975894,0.6883602856586172,1.9015292242539055],"斗二":[1.36905306453291,3,2.6098049864482924,1.4550870924385657,3,3],"斗三":[1.134507063012965,3,1.2166254402355312,1.4793254723766707,2.347625467112181,1.007513298848355],"斗四":[2.9277002188456,3,2.530140886042872,0.9559730002742267,3,1.0285460387295402]},"earlyEraTalentResponse":{"斗一":[2.22779597031629,1.7158500177875946,0.7714913272560323,0.2704556652599967,1.3843054560296613,1.372922965877485],"斗二":[1.7561082035111604,0.6762564167965434,0.4303740035353919,0.25494306495068947,0.5565677221390628,0.4423410979336079],"斗三":[1.64966612014534,0.8900404457693161,0.7676090105396997,0.7017878754690547,0.5903727767761343,0.9797255363170447],"斗四":[0.9772428129627441,1.6107065959671718,0.46494679618269674,2.4909730704683426,0.40328335557333267,1.1147323010477201]},"levelResponseScale":0.49626535888927736,"levelInteractionAgeResponse":[1.411926763037311,3.6722795023395225,2.9832704558720993,2.6837022189045565,4,3.6317232692508226,1.0025938842095943,1.9311990399456676,2.088778061076873,3.017923199032935,2.510879852639606,2.1843223003236516,2.589215643440033,1.0098627115715326,2.1863538437822188,2.1823415330247316,4,1.0065742991404547,1.3726027360641875],"levelEraTalentResponse":{"斗一":[0.25,0.25,0.25,2.8197285456605727,2.6237614221014414,0.537256448128083],"斗二":[0.2851542460215194,0.5305593808580059,0.6439191596055792,4,3.2519845798462383,2.1826144743527607],"斗三":[0.48598732879061446,0.3896227293458124,0.9829085051448,2.9619308937208415,2.81512547727651,0.9913958721863375],"斗四":[2.021036464685537,0.9787608431166123,4,1.757204592103971,3.1984344107514233,3.71771456361346]}},"coreVariation":{"gain":1,"power":21,"asymmetric":true,"eras":["斗一"],"talents":["顶级天才"],"stages":[0],"enabled":true,"rule":"魂核凝聚速度 × max(1, 底子波动^power)，仅作用于 斗一·顶级天才·第一核；用于表达“60岁只有约10%顶级天才能达到90级、且通过者底子波动≥1.04”的分布描点。"},"meta":{"eras":["斗一","斗二","斗三","斗四"],"bookEraMap":{"dldl":"斗一","jueshitangmen":"斗二","current":"斗三","zjdl":"斗四"},"talents":["劣等","正常","优秀","天才","顶级天才","绝世妖孽"],"earlyTalents":["天才","顶级天才","绝世妖孽"],"levelBandLimits":[20,40,50,60,64,67,70,75,80,90,95,98,99,99.5,100,120,null],"ageBandLimits":[12,18,22,30,40,50,60,80,100,200,500,null],"earlyAgeBandLimits":[10,12,15,18,22],"interactionAgeBandLimits":[10,12,15,18,19,22,25,28,30,35,40,50,60,80,100,200,300,500,null],"startAge":6,"ticksPerDay":144,"meditationTicksPerDay":{"default":48,"斗三第一核后":72},"cultivationStopAges":{"劣等":40,"正常":50,"优秀":60,"天才":90,"顶级天才":100,"绝世妖孽":120},"decayRules":{"before30":1,"30-40":0.35,"40+":0.1,"talentBonus":{"天才":0.15,"优秀":{"30-40":0.069,"40+":0.0493},"顶级天才":0.32,"绝世妖孽":0.3},"100+":0.1,"斗四":{"顶级天才":{"shiftYears":100},"绝世妖孽":{"shiftYears":100},"优秀":{"100+":"noDecay"}}},"effectiveTalentRule":{"15岁前":{"from":["天才","顶级天才","绝世妖孽"],"to":"天才"},"20岁前":{"from":["顶级天才","绝世妖孽"],"to":"顶级天才"}}},"projectSoulCoreStages":[{"requiredCoreCount":0,"nextCoreIndex":1,"startLevel":50,"bottleneckLevel":69,"baseAttemptChance":0.0125,"talentRatioMap":{"劣等":0.01,"正常":0.02,"优秀":1.55,"天才":3,"顶级天才":2,"绝世妖孽":3.2}},{"requiredCoreCount":1,"nextCoreIndex":2,"startLevel":80,"bottleneckLevel":89,"baseAttemptChance":0.054,"talentRatioMap":{"劣等":0.01,"正常":0.02,"优秀":0.18,"天才":0.55,"顶级天才":0.9,"绝世妖孽":1.3}},{"requiredCoreCount":2,"nextCoreIndex":3,"startLevel":95,"bottleneckLevel":98,"baseAttemptChance":0.0045,"talentRatioMap":{"劣等":0.01,"正常":0.01,"优秀":0.02,"天才":0.04,"顶级天才":1.2,"绝世妖孽":18}}],"projectTalentCoreRates":{"劣等":[0.45,0.02,0.01,0.01],"正常":[0.88,0.03,0.02,0.01],"优秀":[1.1,1.85,0.08,0.04],"天才":[0.95,1.08,6.1,0.8],"顶级天才":[1.05,0.5,18,160],"绝世妖孽":[1.15,0.68,30,180]}});

  const freezeDeep = (value, seen = new WeakSet()) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return value;
    seen.add(value);
    Object.keys(value).forEach(key => freezeDeep(value[key], seen));
    return Object.freeze(value);
  };
  freezeDeep(PARAMETERS);

  const clamp = (value, low, high) => Math.max(low, Math.min(high, Number(value)));
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.floor(Number(value)) : fallback;
  const limits = key => (PARAMETERS.meta[key] || []).map(value => value === null ? Infinity : Number(value));
  const levelLimits = limits('levelBandLimits');
  const ageLimits = limits('ageBandLimits');
  const earlyAgeLimits = limits('earlyAgeBandLimits');
  const interactionAgeLimits = limits('interactionAgeBandLimits');
  const talents = PARAMETERS.meta.talents;
  const earlyTalents = new Set(PARAMETERS.meta.earlyTalents);
  const D4_DAILY_TICK_SCALE_IN_D3_CORE_WINDOW = (
    Number(PARAMETERS.meditation.defaultHours || 8)
    / Number(PARAMETERS.meditation['斗三第一核后Hours'] || 12)
  );
  const levelBandIndex = level => Math.max(0, limits('levelBandLimits').findIndex(upper => finite(level, 0) < upper));
  const ageBandIndex = age => Math.max(0, ageLimits.findIndex(upper => Math.max(0, finite(age, 0)) < upper));
  const earlyAgeBandIndex = age => Math.max(0, earlyAgeLimits.findIndex(upper => Math.max(0, finite(age, 0)) < upper));
  const interactionAgeBandIndex = age => Math.max(0, interactionAgeLimits.findIndex(upper => Math.max(0, finite(age, 0)) < upper));
  const talentIndex = talent => Math.max(0, talents.indexOf(String(talent || '').trim()));
  const safeEra = era => PARAMETERS.meta.eras.includes(era) ? era : '斗一';

  function libraryRuntime() {
    const candidates = [global];
    try { if (global.parent && global.parent !== global) candidates.push(global.parent); } catch (_) {}
    try { if (global.top && global.top !== global) candidates.push(global.top); } catch (_) {}
    return candidates.map(item => item && item.__LWCS_LIBRARY_DATA_RUNTIME_V1__).find(item => item && typeof item === 'object') || null;
  }

  function resolveEraAtTick(tick) {
    const library = libraryRuntime();
    if (!library || typeof library.resolveEraAtTick !== 'function') throw new Error('LibraryData_Runtime 2.0.0 未加载，无法按绝对tick解析时代');
    const era = ERA_BY_PROFILE[library.resolveEraAtTick(Math.max(0, finite(tick, 0)))];
    if (!era) throw new Error('LibraryData_Runtime返回未知时代profile');
    return era;
  }

  function resolveEra(char = {}, options = {}) {
    if (options && options.currentTick !== undefined && options.currentTick !== null) return resolveEraAtTick(options.currentTick);
    if (options && options.era) return safeEra(options.era);
    const explicit = String(char?.属性?.时代 || char?.所属时代 || char?.时代 || '').trim();
    if (PARAMETERS.meta.eras.includes(explicit)) return explicit;
    const book = String(char?.所属部 || char?.所属书库 || char?.book || char?.bookId || '').trim();
    return safeEra(PARAMETERS.meta.bookEraMap[book] || '斗一');
  }

  function directZJDLTick() {
    const library = libraryRuntime();
    const startYear = Number(library?.profiles?.zjdl?.startYear);
    const ticksPerYear = Number(library?.ticksPerYear);
    return Number.isFinite(startYear) && Number.isFinite(ticksPerYear) && startYear >= 0 && ticksPerYear > 0
      ? startYear * ticksPerYear
      : Number.POSITIVE_INFINITY;
  }

  function resolveCultivationEra(char = {}, options = {}) {
    if (options && options.cultivationEra) return safeEra(options.cultivationEra);
    if (options && options.currentTick !== undefined && options.currentTick !== null) {
      const tick = Math.max(0, finite(options.currentTick, 0));
      const library = libraryRuntime();
      const d3Threshold = Number(library?.eraThresholds?.current?.thresholdTick);
      if (tick >= directZJDLTick()) return '斗四';
      if (Number.isFinite(d3Threshold) && tick >= d3Threshold) return '斗三';
    }
    return resolveEra(char, options);
  }

  function resolveBlend(tick, options = {}) {
    if (options && options.blend && typeof options.blend === 'object') {
      const zjdl = clamp(options.blend.zjdl, 0, 1);
      return { current: 1 - zjdl, zjdl, mode: String(options.blend.mode || 'provided'), stage: Math.round(zjdl * 10) };
    }
    const library = libraryRuntime();
    if (!library || typeof library.getCultivationEraBlend !== 'function') return null;
    const hasTick = tick !== undefined && tick !== null && Number.isFinite(Number(tick));
    if (options.directZJDL === true || (hasTick && Number(tick) >= directZJDLTick()) || options.deepAbyssAbsorptionTick !== undefined) {
      return library.getCultivationEraBlend(tick, {
        directZJDL: options.directZJDL === true || (hasTick && Number(tick) >= directZJDLTick()),
        deepAbyssAbsorptionTick: options.deepAbyssAbsorptionTick,
      });
    }
    return hasTick ? library.getCultivationEraBlend(tick) : null;
  }

  function smoothRatio(ratio) {
    const value = clamp(ratio, 0, 1);
    return value * value * (3 - 2 * value);
  }

  function soulPowerCurve(level) {
    const value = clamp(level || 1, 1, 180);
    const anchors = [
      [1, 100], [10, 800], [20, 2000], [30, 4500], [40, 8500], [50, 15000], [60, 26000],
      [70, 55000], [80, 95000], [90, 180000], [95, 360000],
    ];
    const last = anchors[anchors.length - 1];
    if (value >= last[0] && value <= 99) return last[1] * 2 ** (value - last[0]);
    if (value > 99 && value <= 99.5) return last[1] * 16 * 2 ** ((value - 99) / 0.5);
    if (value > 99.5 && value <= 100) return last[1] * 32 * 2 ** ((value - 99.5) / 0.5);
    if (value > 100) return last[1] * 64 * 10 ** ((value - 100) / 10);
    for (let index = 0; index < anchors.length - 1; index += 1) {
      const start = anchors[index];
      const end = anchors[index + 1];
      if (value >= start[0] && value <= end[0]) return start[1] + (end[1] - start[1]) * smoothRatio((value - start[0]) / (end[0] - start[0]));
    }
    return anchors[0][1];
  }

  function oldSoulPowerCurve(level) {
    const value = clamp(level || 1, 1, 100);
    if (value <= 29) return 100 + ((2200 - 100) / 28) * (value - 1);
    if (value === 30) return 3000;
    if (value <= 69) return 3200 + ((9000 - 3200) / 38) * (value - 31);
    if (value === 70) return 14000;
    if (value <= 89) return 14500 + ((17000 - 14500) / 18) * (value - 71);
    if (value === 90) return 18500;
    if (value <= 94) return 18875 + ((20000 - 18875) / 3) * (value - 91);
    if (value <= 99) return 20000 * 2 ** (value - 94);
    if (value <= 99.5) return 20000 * 2 ** 5 * 2;
    return 20000 * 2 ** 5 * 4;
  }

  function extendedOldSoulPowerCurve(level) {
    const value = finite(level, 1);
    if (value <= 100) return oldSoulPowerCurve(value);
    const lastStep = oldSoulPowerCurve(100) - oldSoulPowerCurve(99.5);
    return oldSoulPowerCurve(100) + lastStep * (value - 100);
  }

  function nextLevel(level) {
    const value = Math.max(0, finite(level, 0));
    if (value >= 99.5 && value < 100) return 100;
    if (value >= 99 && value < 99.5) return 99.5;
    return Math.floor(value) + 1;
  }

  function soulPowerCurveCalibration(level, next = null) {
    const start = Math.max(1, finite(level, 1));
    const end = Math.max(start, finite(next === null ? nextLevel(start) : next, start));
    if (start < 70 || end === start) return 1;
    const oldDelta = Math.max(0.0001, extendedOldSoulPowerCurve(end) - extendedOldSoulPowerCurve(start));
    const newDelta = Math.max(0.0001, soulPowerCurve(end) - soulPowerCurve(start));
    return Math.max(0.01, newDelta / oldDelta);
  }

  function effectiveTalent(age, talent) {
    const value = String(talent || '').trim() || '正常';
    if (finite(age, 0) < 15 && ['天才', '顶级天才', '绝世妖孽'].includes(value)) return '天才';
    if (finite(age, 0) < 20 && ['顶级天才', '绝世妖孽'].includes(value)) return '顶级天才';
    return value;
  }

  function cultivationStopAge(era, talent) {
    const base = Number(PARAMETERS.meta.cultivationStopAges[talent] ?? 0);
    if (era === '斗四' && talent === '优秀') return 400;
    if (era === '斗四' && ['顶级天才', '绝世妖孽'].includes(talent)) return Infinity;
    return base + (era === '斗四' ? 100 : 0);
  }

  function shiftedAge(era, age, talent) {
    return era === '斗四' && ['顶级天才', '绝世妖孽'].includes(talent) ? Math.max(0, finite(age, 0) - 100) : Math.max(0, finite(age, 0));
  }

  function ageDecayMultiplier(era, age, talent) {
    const ageValue = finite(age, 0);
    if (ageValue >= cultivationStopAge(era, talent)) return 0;
    const shifted = shiftedAge(era, ageValue, talent);
    if (shifted < 30) return 1;
    const rules = PARAMETERS.meta.decayRules;
    const base = shifted < 40 ? Number(rules['30-40'] || 0.35) : Number(rules['40+'] || 0.1);
    const bonus = rules.talentBonus?.[talent];
    const talentBonus = typeof bonus === 'object' ? (shifted < 40 ? Number(bonus['30-40'] || 0) : Number(bonus['40+'] || 0)) : Number(bonus || 0);
    let value = Math.max(0, base + talentBonus);
    if (era === '斗四' && talent === '优秀' && shifted >= 100) return value;
    if (shifted >= 100) value = Math.max(0.01, value * 0.1);
    return value;
  }

  function cultivationAgeDecayMultiplier(char = {}, options = {}) {
    const age = finite(char?.属性?.年龄, 0);
    const talent = String(char?.属性?.天赋梯队 || '').trim() || '正常';
    const era = resolveCultivationEra(char, options);
    const blend = resolveBlend(options.currentTick, options);
    if (blend && era === '斗三') {
      return Number(blend.current || 0) * ageDecayMultiplier('斗三', age, talent)
        + Number(blend.zjdl || 0) * ageDecayMultiplier('斗四', age, talent);
    }
    return ageDecayMultiplier(era, age, talent);
  }

  function youthYieldMultiplier(age, talent) {
    const value = effectiveTalent(age, talent);
    const ageValue = finite(age, 0);
    if (ageValue < 12) return ({ 劣等: 0.05, 正常: 0.1, 优秀: 0.2, 天才: 0.36, 顶级天才: 0.36, 绝世妖孽: 0.36 })[value] || 0.1;
    if (ageValue < 18) return ({ 劣等: 0.1, 正常: 0.18, 优秀: 0.42, 天才: 0.62, 顶级天才: 0.82, 绝世妖孽: 0.82 })[value] || 0.25;
    if (ageValue < 22) return ({ 劣等: 0.16, 正常: 0.26, 优秀: 0.72, 天才: 1, 顶级天才: 1.05, 绝世妖孽: 1.1 })[value] || 0.4;
    if (ageValue < 30) return ({ 劣等: 0.2, 正常: 0.32, 优秀: 0.9, 天才: 1.1, 顶级天才: 1.85, 绝世妖孽: 5.2 })[value] || 0.45;
    return 1;
  }

  function baseVariation(char = {}, override = undefined) {
    const value = override === undefined ? char?.属性?.底子波动 : override;
    return clamp(Number.isFinite(Number(value)) && Number(value) !== 0 ? Number(value) : 1, PARAMETERS.baseVariation.min, PARAMETERS.baseVariation.max);
  }

  function cultivationMultiplier(char = {}, options = {}) {
    const cultivationEra = resolveCultivationEra(char, options);
    const age = Math.max(0, finite(char?.属性?.年龄, 0));
    const level = Math.max(0, finite(options.levelOverride === undefined ? char?.属性?.等级 : options.levelOverride, 0));
    const talent = String(char?.属性?.天赋梯队 || '').trim() || '正常';
    const coreCount = Math.max(0, integer(options.coreCountOverride === undefined ? char?.魂核?.核心?.数量 : options.coreCountOverride, 0));
    const params = PARAMETERS.parameters;
    const ageIndex = ageBandIndex(age);
    const levelIndex = levelBandIndex(level);
    const interactionIndex = interactionAgeBandIndex(age);
    const realizedTalent = effectiveTalent(age, talent);
    const talentIdx = talents.includes(realizedTalent) ? talents.indexOf(realizedTalent) : talents.indexOf('正常');
    const rawTalentIdx = talents.includes(talent) ? talents.indexOf(talent) : talents.indexOf('正常');
    const variation = baseVariation(char, options.baseVariation);
    const singleEraMultiplier = eraValue => {
      const exponent = Number(params.baseVariationPower || 1)
        * Number(params.baseVariationAge[ageIndex] || 1)
        * Number(params.baseVariationEraTalent[eraValue]?.[rawTalentIdx] || 1)
        * (age < 22 ? Number(params.baseVariationEarlyEraTalent[eraValue]?.[rawTalentIdx] || 1) : 1);

      let value = Number(params.eraSpeed[eraValue]?.[levelIndex] || 1)
        * Number(params.age[ageIndex] || 1)
        * Number(params.eraAge[eraValue]?.[ageIndex] || 1)
        * Number(params.talentAge[realizedTalent]?.[ageIndex] || 1)
        * Number(params.eraTalent[eraValue]?.[talentIdx] || 1)
      * Number(params.eraTalentAge[eraValue]?.[talent]?.[interactionIndex] || 1)
        * Number(params.coreGrowth[eraValue]?.[Math.min(3, coreCount)] || 1);
      if (age < 22 && earlyTalents.has(talent)) value *= Number(params.earlyTalent[eraValue]?.[talent]?.[earlyAgeBandIndex(age)] || 1);
      return value * variation ** exponent;
    };
    const blend = resolveBlend(options.currentTick, options);
    const blendD4TickScale = cultivationEra === '斗三' && coreCount >= 1 ? D4_DAILY_TICK_SCALE_IN_D3_CORE_WINDOW : 1;
    const eraFactor = blend && cultivationEra === '斗三'
      ? Number(blend.current || 0) * singleEraMultiplier('斗三') + Number(blend.zjdl || 0) * singleEraMultiplier('斗四') * blendD4TickScale
      : singleEraMultiplier(cultivationEra);
    return Math.max(0, eraFactor);
  }

  function soulPowerRequirement(level, variation = 1) {
    return Math.max(0, soulPowerCurve(level) * clamp(variation, PARAMETERS.baseVariation.min, PARAMETERS.baseVariation.max));
  }

  function getTalentCoreRate(char = {}, options = {}) {
    const age = finite(char?.属性?.年龄, 0);
    const talent = effectiveTalent(age, String(char?.属性?.天赋梯队 || '').trim() || '正常');
    const coreCount = Math.min(3, Math.max(0, integer(options.coreCountOverride === undefined ? char?.魂核?.核心?.数量 : options.coreCountOverride, 0)));
    return Math.max(0, Number(PARAMETERS.projectTalentCoreRates[talent]?.[coreCount] || 0));
  }

  function getLevelCapForCoreCount(charOrOptions = {}, maybeOptions = {}) {
    const options = maybeOptions && typeof maybeOptions === 'object' ? maybeOptions : {};
    const char = charOrOptions && charOrOptions.属性 ? charOrOptions : options.char || {};
    const era = resolveCultivationEra(char, { ...options, era: options.era || charOrOptions?.era });
    const coreCount = Math.min(3, Math.max(0, integer(options.coreCountOverride === undefined ? char?.魂核?.核心?.数量 : options.coreCountOverride, 0)));
    return Number(LEVEL_CAPS_BY_ERA[era]?.[coreCount] ?? NO_SOUL_CORE_GATE);
  }

  function requiredCoreCountForLevel(era, level) {
    const caps = LEVEL_CAPS_BY_ERA[safeEra(era)] || LEVEL_CAPS_BY_ERA.斗三;
    const target = finite(level, 0);
    const index = caps.findIndex(cap => target <= cap);
    return index < 0 ? 3 : index;
  }

  function finalLevelCap(char = {}, options = {}) {
    const era = resolveCultivationEra(char, options);
    const talent = String(char?.属性?.天赋梯队 || '').trim() || '正常';
    const rule = PARAMETERS.finalCapRules[era]?.[talent];
    if (typeof rule === 'number') return rule;
    if (Array.isArray(rule)) {
      const q = (baseVariation(char, options.baseVariation) - PARAMETERS.baseVariation.min) / (PARAMETERS.baseVariation.max - PARAMETERS.baseVariation.min);
      let cumulative = 0;
      for (const item of rule) {
        cumulative += Number(item.probability || 0);
        if (q < cumulative) return Number(item.cap);
      }
      return Number(rule[rule.length - 1].cap);
    }
    return 99.5;
  }

  function isNaturalCultivationAllowed(char = {}, options = {}) {
    const level = finite(options.levelOverride === undefined ? char?.属性?.等级 : options.levelOverride, 0);
    return cultivationAgeDecayMultiplier(char, options) > 0 && level < finalLevelCap(char, options);
  }

  function advanceNaturalLevel(char = {}, options = {}) {
    if (!char?.属性 || typeof char.属性 !== 'object') return { advanced: 0, level: 0 };
    const era = resolveCultivationEra(char, options);
    const variation = baseVariation(char, options.baseVariation);
    const coreCount = Math.max(0, integer(char?.魂核?.核心?.数量, 0));
    const requirementMultiplier = Math.max(0, finite(options.requirementMultiplier, 1));
    const naturalCap = finalLevelCap(char, options);
    const levelCap = Number.isFinite(Number(options.levelCap)) ? Number(options.levelCap) : NO_SOUL_CORE_GATE;
    const cap = Math.min(naturalCap, levelCap);
    const nonCultivationSoulPowerBonus = Math.max(0, finite(options.nonCultivationSoulPowerBonus, 0));
    let level = Math.max(0, finite(char.属性.等级, 0));
    let advanced = 0;
    while (level < cap) {
      const next = nextLevel(level);
      if (next === null || next > cap || requiredCoreCountForLevel(era, next) > coreCount) break;
      if (
        Math.max(0, finite(char.属性.魂力上限, 0) - nonCultivationSoulPowerBonus)
        < soulPowerRequirement(next, variation) * requirementMultiplier
      ) break;
      level = next;
      advanced += 1;
    }
    if (advanced > 0) char.属性.等级 = level;
    return { advanced, level };
  }

  function getSoulCoreStage(char = {}, options = {}) {
    const era = resolveCultivationEra(char, options);
    const coreCount = Math.min(2, Math.max(0, integer(options.coreCountOverride === undefined ? char?.魂核?.核心?.数量 : options.coreCountOverride, 0)));
    const level = Math.max(0, finite(options.levelOverride === undefined ? char?.属性?.等级 : options.levelOverride, 0));
    const rule = PARAMETERS.coreRules[era]?.[coreCount];
    if (!rule || level < Number(rule.startLevel)) return null;
    const projectStage = PARAMETERS.projectSoulCoreStages[coreCount];
    if (!projectStage) return null;
    const span = Math.max(1, Number(rule.bottleneckLevel) - Number(rule.startLevel));
    return {
      era,
      coreCount,
      nextCoreIndex: Number(projectStage.nextCoreIndex),
      startLevel: Number(rule.startLevel),
      bottleneckLevel: Number(rule.bottleneckLevel),
      baseAttemptChance: Number(projectStage.baseAttemptChance),
      talentRatioMap: projectStage.talentRatioMap,
      proximity: clamp((level - Number(rule.startLevel)) / span, 0, 1),
    };
  }

  function soulCoreSuccessChance(char = {}, options = {}) {
    const stage = getSoulCoreStage(char, options);
    if (!stage || !isNaturalCultivationAllowed(char, options)) return 0;
    const talent = String(char?.属性?.天赋梯队 || '').trim() || '正常';
    const ratio = Number(stage.talentRatioMap[talent] || stage.talentRatioMap.正常 || 0.55);
    const blend = resolveBlend(options.currentTick, options);
    const coreTalentFactor = eraValue => Number(PARAMETERS.parameters.coreTalent[eraValue]?.[talent]?.[Math.min(2, stage.coreCount)] || 1);
    const factor = blend && stage.era === '斗三'
      ? Number(blend.current || 0) * coreTalentFactor('斗三') + Number(blend.zjdl || 0) * coreTalentFactor('斗四')
      : coreTalentFactor(stage.era);
    return clamp(stage.baseAttemptChance * ratio * (0.3 + 0.7 * stage.proximity ** 1.2) * factor, 0.0001, 0.35);
  }

  function soulCoreAttemptDelta(char = {}, segmentDelta = 0, options = {}) {
    const stage = getSoulCoreStage(char, options);
    if (!stage || !(segmentDelta > 0)) return 0;
    const level = finite(options.levelOverride === undefined ? char?.属性?.等级 : options.levelOverride, 0);
    const cultivationEra = resolveCultivationEra(char, options);
    const levelCap = getLevelCapForCoreCount(char, { ...options, cultivationEra, coreCountOverride: stage.coreCount });
    const next = nextLevel(level);
    const bottleneck = next !== null && requiredCoreCountForLevel(cultivationEra, next) > stage.coreCount || level >= levelCap;
    const variation = baseVariation(char, options.baseVariation);
    const coreVariation = stage.era === '斗一' && String(char?.属性?.天赋梯队 || '').trim() === '顶级天才' && stage.coreCount === 0
      ? Math.max(1, variation ** Number(PARAMETERS.coreVariation.power || 21))
      : 1;
    const blend = resolveBlend(options.currentTick, options);
    const coreSpeed = eraValue => Number(PARAMETERS.parameters.coreSpeed[eraValue]?.[Math.min(2, stage.coreCount)] || 1);
    const speed = blend && stage.era === '斗三'
      ? Number(blend.current || 0) * coreSpeed('斗三') + Number(blend.zjdl || 0) * coreSpeed('斗四') * (stage.coreCount >= 1 ? D4_DAILY_TICK_SCALE_IN_D3_CORE_WINDOW : 1)
      : coreSpeed(stage.era);
    return Math.max(0, finite(segmentDelta, 0)) * speed
      * (bottleneck ? 2.45 : 1) * coreVariation;
  }

  function advanceSoulCoreProgress(char = {}, segmentDelta = 0, options = {}) {
    const stage = getSoulCoreStage(char, options);
    if (!stage) return { progressGain: 0, completed: 0, attemptDelta: 0, chance: 0 };
    if (!char.魂核 || typeof char.魂核 !== 'object' || Array.isArray(char.魂核)) char.魂核 = {};
    if (!char.魂核.核心 || typeof char.魂核.核心 !== 'object' || Array.isArray(char.魂核.核心)) char.魂核.核心 = { 数量: stage.coreCount, 进度: 0 };
    const chance = soulCoreSuccessChance(char, options);
    const attemptDelta = soulCoreAttemptDelta(char, segmentDelta, options);
    if (!(attemptDelta > 0) || !(chance > 0)) return { progressGain: 0, completed: 0, attemptDelta, chance };
    let progressGain = 0;
    if (options.deterministic === true) {
      progressGain = attemptDelta / 48 * chance;
    } else {
      const rng = typeof options.rng === 'function' ? options.rng : Math.random;
      const fullAttempts = Math.floor(attemptDelta / 48);
      let attempts = fullAttempts;
      const remainder = attemptDelta - fullAttempts * 48;
      if (remainder > 0 && rng() < remainder / 48) attempts += 1;
      for (let index = 0; index < attempts; index += 1) if (rng() <= chance) progressGain += 1;
    }
    char.魂核.核心.进度 = Math.max(0, finite(char.魂核.核心.进度, 0)) + progressGain;
    let completed = 0;
    while (char.魂核.核心.进度 >= 100 && completed < 1 && stage.coreCount < 3) {
      char.魂核.核心.进度 -= 100;
      char.魂核.核心.数量 = Math.max(stage.nextCoreIndex, integer(char.魂核.核心.数量, stage.coreCount) + 1);
      completed += 1;
    }
    return { progressGain, completed, attemptDelta, chance };
  }

  function meditationSchedule(char = {}, options = {}) {
    const era = resolveCultivationEra(char, options);
    const coreCount = Math.max(0, integer(options.coreCountOverride === undefined ? char?.魂核?.核心?.数量 : options.coreCountOverride, 0));
    const ticksPerDay = era === '斗三' && coreCount >= 1 ? Number(PARAMETERS.meditation['斗三第一核后Hours'] || 12) * 6 : Number(PARAMETERS.meditation.defaultHours || 8) * 6;
    return ticksPerDay === 72 ? { ticksPerDay, start: 21 * 6, end: 9 * 6 } : { ticksPerDay, start: 23 * 6, end: 7 * 6 };
  }

  function calculateMeditationGrowth(char = {}, segmentDelta = 0, options = {}) {
    if (!isNaturalCultivationAllowed(char, options)) return 0;
    const age = finite(char?.属性?.年龄, 0);
    const talent = String(char?.属性?.天赋梯队 || '').trim() || '正常';
    const level = finite(options.levelOverride === undefined ? char?.属性?.等级 : options.levelOverride, 0);
    const coreCount = Math.max(0, integer(options.coreCountOverride === undefined ? char?.魂核?.核心?.数量 : options.coreCountOverride, 0));
    const baseRate = getTalentCoreRate(char, { coreCountOverride: coreCount });
    let growth = baseRate * (Math.max(0, finite(segmentDelta, 0)) / 6);
    const cultivationEra = resolveCultivationEra(char, options);
    const blend = resolveBlend(options.currentTick, options);
    const actualEfficiency = blend && cultivationEra === '斗三'
      ? Number(blend.current || 0)
        * cultivationMultiplier(char, { ...options, cultivationEra: '斗三', blend: { current: 1, zjdl: 0 }, levelOverride: level, coreCountOverride: coreCount })
        * ageDecayMultiplier('斗三', age, talent)
        + Number(blend.zjdl || 0)
        * cultivationMultiplier(char, { ...options, cultivationEra: '斗四', blend: { current: 0, zjdl: 1 }, levelOverride: level, coreCountOverride: coreCount })
        * ageDecayMultiplier('斗四', age, talent)
        * (coreCount >= 1 ? D4_DAILY_TICK_SCALE_IN_D3_CORE_WINDOW : 1)
      : cultivationMultiplier(char, { ...options, levelOverride: level, coreCountOverride: coreCount })
        * cultivationAgeDecayMultiplier(char, options);
    growth *= actualEfficiency * youthYieldMultiplier(age, talent);
    const adjustment = LEVEL_ADJUSTMENTS.find(([lower, upper]) => level >= lower && level < upper);
    if (adjustment) growth *= adjustment[2];
    growth *= soulPowerCurveCalibration(level, nextLevel(level));
    return Math.max(0, growth * Math.max(0, finite(options.externalMultiplier, 1)));
  }

  function settleMeditationSegment(char = {}, segmentDelta = 0, options = {}) {
    const safeDelta = Math.max(0, finite(segmentDelta, 0));
    let remaining = safeDelta;
    let elapsed = 0;
    let totalGrowth = 0;
    let coresCompleted = 0;
    let levelsAdvanced = 0;
    let guard = 0;
    const nonCultivationSoulPowerBonus = Math.max(0, finite(options.nonCultivationSoulPowerBonus, 0));
    while (remaining > 0 && guard < 200000 && isNaturalCultivationAllowed(char, { ...options, levelOverride: char?.属性?.等级 })) {
      guard += 1;
      const startLevelAdvance = advanceNaturalLevel(char, options).advanced;
      levelsAdvanced += startLevelAdvance;
      const level = Math.max(0, finite(char?.属性?.等级, 0));
      const coreCount = Math.max(0, integer(char?.魂核?.核心?.数量, 0));
      const chunk = Math.min(remaining, 48);
      const growth = calculateMeditationGrowth(char, chunk, { ...options, levelOverride: level, coreCountOverride: coreCount });
      if (growth > 0 && char?.属性) {
        const current = Math.max(0, finite(char.属性.魂力上限, 0));
        const next = nextLevel(level);
        const requirementMultiplier = Math.max(0, finite(options.requirementMultiplier, 1));
        const blocked = next !== null && requiredCoreCountForLevel(resolveCultivationEra(char, options), next) > coreCount;
        const storageCap = blocked
          ? soulPowerRequirement(level, baseVariation(char, options.baseVariation)) * requirementMultiplier
            + Math.max(0, soulPowerRequirement(next, baseVariation(char, options.baseVariation)) * requirementMultiplier
              - soulPowerRequirement(level, baseVariation(char, options.baseVariation)) * requirementMultiplier) * 0.7
            + nonCultivationSoulPowerBonus
          : Number.POSITIVE_INFINITY;
        const nextValue = Math.max(current, Math.min(storageCap, current + growth));
        char.属性.魂力上限 = nextValue;
        totalGrowth += nextValue - current;
      }
      const coreResult = advanceSoulCoreProgress(char, chunk, { ...options, levelOverride: level, coreCountOverride: coreCount });
      coresCompleted += coreResult.completed;
      const endLevelAdvance = advanceNaturalLevel(char, options).advanced;
      levelsAdvanced += endLevelAdvance;
      remaining -= chunk;
      elapsed += chunk;
      if ((coreResult.completed > 0 || startLevelAdvance > 0 || endLevelAdvance > 0) && remaining > 0) continue;
      if (!(growth > 0) && coreResult.completed <= 0) break;
    }
    return { totalGrowth, coresCompleted, levelsAdvanced, elapsed, remaining };
  }

  function estimateInitialLevel(options = {}) {
    const targetAge = Math.max(0, finite(options.age, 6));
    if (targetAge < Number(PARAMETERS.meta.startAge || 6)) return 0;
    const talent = talents.includes(String(options.talent || '').trim()) ? String(options.talent).trim() : '正常';
    const variation = clamp(finite(options.baseVariation, 1), PARAMETERS.baseVariation.min, PARAMETERS.baseVariation.max);
    const era = options.currentTick !== undefined && options.currentTick !== null
      ? resolveCultivationEra({}, { currentTick: options.currentTick })
      : safeEra(options.era || PARAMETERS.meta.bookEraMap[String(options.book || '').trim()]);
    const anchor = INITIAL_LEVEL_ANCHORS[talent] || INITIAL_LEVEL_ANCHORS.正常;
    const quantile = (variation - PARAMETERS.baseVariation.min) / (PARAMETERS.baseVariation.max - PARAMETERS.baseVariation.min);
    const initialLevel = anchor[0] + (anchor[1] - anchor[0]) * clamp(quantile, 0, 1);
    const char = {
      所属时代: era,
      属性: {
        年龄: Number(PARAMETERS.meta.startAge || 6),
        等级: Math.floor(initialLevel),
        魂力上限: soulPowerRequirement(initialLevel, variation),
        天赋梯队: talent,
        底子波动: variation,
      },
      魂核: { 核心: { 数量: 0, 进度: 0 } },
    };
    if (targetAge <= char.属性.年龄 + 1e-9) return initialLevel;
    let remainingDays = (targetAge - char.属性.年龄) * Number(PARAMETERS.meta.yearDays || 360);
    while (remainingDays > 1e-9) {
      const days = Math.min(1, remainingDays);
      char.属性.年龄 += days / 720;
      const schedule = meditationSchedule(char, { cultivationEra: era });
      for (const segmentDelta of [schedule.end, Number(PARAMETERS.meta.ticksPerDay || 144) - schedule.start]) {
        const level = finite(char.属性.等级, 1);
        const coreCount = integer(char.魂核?.核心?.数量, 0);
        const growth = calculateMeditationGrowth(char, segmentDelta * days, {
          cultivationEra: era,
          currentTick: options.currentTick,
          levelOverride: level,
          coreCountOverride: coreCount,
        });
        const current = finite(char.属性.魂力上限, 0);
        const next = nextLevel(level);
        const blocked = next !== null && requiredCoreCountForLevel(era, next) > coreCount;
        const storageCap = blocked
          ? soulPowerRequirement(level, variation) + Math.max(0, soulPowerRequirement(next, variation) - soulPowerRequirement(level, variation)) * 0.7
          : Number.POSITIVE_INFINITY;
        char.属性.魂力上限 = Math.max(current, Math.min(storageCap, current + growth));
        advanceSoulCoreProgress(char, segmentDelta * days, {
          cultivationEra: era,
          currentTick: options.currentTick,
          levelOverride: level,
          coreCountOverride: coreCount,
          deterministic: true,
        });
      }
      advanceNaturalLevel(char, { cultivationEra: era });
      char.属性.年龄 += days / 720;
      remainingDays -= days;
    }
    advanceNaturalLevel(char, { cultivationEra: era });
    const level = finite(char.属性.等级, 1);
    const next = nextLevel(level);
    if (next === null || next <= level || requiredCoreCountForLevel(era, next) > integer(char.魂核?.核心?.数量, 0)) return level;
    const currentRequirement = soulPowerRequirement(level, variation);
    const nextRequirement = soulPowerRequirement(next, variation);
    const progress = nextRequirement > currentRequirement
      ? clamp((finite(char.属性.魂力上限, currentRequirement) - currentRequirement) / (nextRequirement - currentRequirement), 0, 1)
      : 0;
    return Math.max(1, Math.min(finalLevelCap(char, { cultivationEra: era }), level + (next - level) * progress + continuousLevelAdjustment(char, { cultivationEra: era })));
  }

  function continuousLevelAdjustment(char = {}, options = {}) {
    const age = finite(char?.属性?.年龄, 0);
    const era = resolveCultivationEra(char, options);
    const talent = String(char?.属性?.天赋梯队 || '').trim() || '正常';
    const variation = baseVariation(char, options.baseVariation);
    const index = interactionAgeBandIndex(age);
    const talentIndexValue = talents.includes(talent) ? talents.indexOf(talent) : talents.indexOf('正常');
    return ((variation - 1) / 0.1) * Number(PARAMETERS.parameters.baseVariationLevelScale || 1)
      * Number(PARAMETERS.parameters.baseVariationLevelInteractionAge[index] || 1)
      * Number(PARAMETERS.parameters.baseVariationLevelEraTalent[era]?.[talentIndexValue] || 1);
  }

  const API = Object.freeze({
    version: VERSION,
    parameterVersion: PARAMETERS.version,
    parameters: PARAMETERS,
    resolveEraAtTick,
    resolveEra,
    resolveCultivationEra,
    cultivationMultiplier,
    getMeditationSchedule: meditationSchedule,
    calculateMeditationGrowth,
    settleMeditationSegment,
    estimateInitialLevel,
    soulPowerCurve,
    soulPowerRequirement,
    soulPowerCurveCalibration,
    getLevelCapForCoreCount,
    requiredCoreCountForLevel,
    finalLevelCap,
    getSoulCoreStage,
    soulCoreSuccessChance,
    soulCoreAttemptDelta,
    advanceSoulCoreProgress,
    advanceNaturalLevel,
    ageDecayMultiplier,
    youthYieldMultiplier,
    continuousLevelAdjustment,
  });

  const existing = global.__LWCS_ERA_CULTIVATION_RUNTIME_V1__;
  if (existing && existing.parameterVersion !== PARAMETERS.version) throw new Error('EraCultivation_Runtime封版参数版本冲突');
  const runtime = existing || API;
  global.__LWCS_ERA_CULTIVATION_RUNTIME_V1__ = runtime;
  try { if (global.parent && global.parent !== global) global.parent.__LWCS_ERA_CULTIVATION_RUNTIME_V1__ = runtime; } catch (_) {}
  try { if (global.top && global.top !== global) global.top.__LWCS_ERA_CULTIVATION_RUNTIME_V1__ = runtime; } catch (_) {}
})(typeof globalThis !== 'undefined' ? globalThis : window);

;

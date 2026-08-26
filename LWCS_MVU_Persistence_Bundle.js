/* 此文件由 Build_Runtime_Bundles.cjs 生成，禁止直接编辑。 */
;
/* sources-sha256: LWCS_Persistence_Adapter.js:07005dda595fa3addec15f63815b71029180a1608cde5c0d88cdc19baf0ce447|LWCS_MVU_Persistence_Provider.js:6a58dc159e89c0c880f50f3ee414d90a71e59f18872e00e779d97a018e1299f5|LWCS_MVU_Prompt_Projector.js:621af59c602776d18cecb575a844f3449f60baa2639ca850a7c9399de92905c7 */
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
      const delays = [0, 40, 120, 240];
      let value;
      for (const delay of delays) {
        if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
        value = await read();
        check();
        if (matches(value)) return { matched: true, value };
      }
      return { matched: false, value };
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
          if (backend === 'tt-store') {
            const keys = await backendApi.listKeys({ namespace: request.namespace, stableChatId: session.stableChatId });
            check();
            if (!Array.isArray(keys)) return failureMeta(session, 'uncertain', 'READBACK_MISMATCH');
            if (!keys.includes(request.key)) {
              return request.verify === undefined
                ? resultMeta(session, 'committed', { verified: true, value: undefined })
                : failureMeta(session, 'not_committed', 'NOT_FOUND');
            }
          }
          const value = await backendApi.getJson({ namespace: request.namespace, key: request.key, stableChatId: session.stableChatId });
          check();
          if (request.verify !== undefined && value === undefined) return failureMeta(session, 'not_committed', 'NOT_FOUND');
          if (!expectedFieldsMatch(value, request.verify)) return failureMeta(session, 'uncertain', 'READBACK_MISMATCH');
          if (value !== undefined) pinBackend(session);
          return resultMeta(session, 'committed', { verified: true, value });
        });
      };

      session.setJson = async request => {
        assertRequest(request, true);
        const jsonValue = toJsonValue(request.value);
        return enqueueMutation(session, () => run('mutation', async check => {
          await backendApi.setJson({ namespace: request.namespace, key: request.key, value: jsonValue, stableChatId: session.stableChatId });
          check();
          const readBack = await readBackWithRetry(
            () => backendApi.getJson({ namespace: request.namespace, key: request.key, stableChatId: session.stableChatId }),
            value => jsonEqual(value, jsonValue) && expectedFieldsMatch(value, request.verify),
            check,
          );
          if (!readBack.matched) return failureMeta(session, 'uncertain', `READBACK_MISMATCH:${request.key}`);
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
          const readBack = await readBackWithRetry(
            () => Promise.all(requests.map(request => backendApi.getJson({
              namespace: request.namespace,
              key: request.key,
              stableChatId: session.stableChatId,
            }))),
            values => requests.every((request, index) => jsonEqual(values[index], jsonValues[index]) && expectedFieldsMatch(values[index], request.verify)),
            check,
          );
          const mismatchIndex = requests.findIndex((request, index) => !jsonEqual(readBack.value[index], jsonValues[index]) || !expectedFieldsMatch(readBack.value[index], request.verify));
          if (mismatchIndex >= 0) return failureMeta(session, 'uncertain', `READBACK_MISMATCH:${requests[mismatchIndex].key}`);
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
          if (!beforeDelete.includes(request.key)) return resultMeta(session, 'committed', { verified: true });
          await backendApi.deleteJson({ namespace: request.namespace, key: request.key, stableChatId: session.stableChatId });
          check();
          const afterDelete = await backendApi.listKeys({ namespace: request.namespace, stableChatId: session.stableChatId });
          check();
          if (!Array.isArray(afterDelete) || afterDelete.includes(request.key)) return failureMeta(session, 'uncertain', 'DELETE_NOT_VERIFIED');
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

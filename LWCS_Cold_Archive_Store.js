(function (root) {
  'use strict';

  const VERSION = '1.0.0';
  const GLOBAL_KEY = '__LWCS_COLD_ARCHIVE_STORE_V1__';
  const ADAPTER_KEY = '__LWCS_PERSISTENCE_ADAPTER_V1__';
  const ADAPTER_LOADING_KEY = '__LWCS_PERSISTENCE_ADAPTER_LOADING_V1__';
  const NAMESPACE = 'lwcs.cold-archive.v1';
  const SCHEMA_VERSION = 1;
  const INDEX_KEY = 'state:__lwcs_key_index__';
  const KEY_PREFIXES = Object.freeze(['journal:', 'manifest:', 'entity:', 'state:']);
  const STATES = Object.freeze(['committed', 'not_committed', 'conflict', 'uncertain', 'stale_chat', 'unavailable']);
  const mutationQueues = new Map();

  function collectWindows() {
    const windows = [];
    const add = candidate => {
      if (candidate && (typeof candidate === 'object' || typeof candidate === 'function') && !windows.includes(candidate)) windows.push(candidate);
    };
    add(root);
    try { add(root.window); } catch (_) { /* cross-window access is best effort */ }
    try { add(root.parent); } catch (_) { /* cross-window access is best effort */ }
    try { add(root.top); } catch (_) { /* cross-window access is best effort */ }
    return windows;
  }

  function readField(target, field) {
    try { return target?.[field]; } catch (_) { return null; }
  }

  function findGlobal(key) {
    for (const candidate of collectWindows()) {
      const value = readField(candidate, key);
      if (value) return value;
    }
    return null;
  }

  const existing = findGlobal(GLOBAL_KEY);
  if (existing) {
    for (const candidate of collectWindows()) {
      try { candidate[GLOBAL_KEY] = existing; } catch (_) { /* best effort */ }
    }
    return;
  }

  function makeError(code, message = code) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function errorCode(error) {
    return String(error?.code || 'BACKEND_ERROR');
  }

  function normalizeStableChatId(value) {
    if (typeof value !== 'string' && typeof value !== 'number') return '';
    const normalized = String(value).trim();
    return normalized && normalized.toLowerCase() !== 'default' ? normalized : '';
  }

  function assertLogicalKey(value, allowInternal = false) {
    if (typeof value !== 'string' && typeof value !== 'number') throw makeError('KEY_INVALID', 'logical key is required');
    const key = String(value).trim();
    if (!key) throw makeError('KEY_INVALID', 'logical key is required');
    if (!KEY_PREFIXES.some(prefix => key.startsWith(prefix))) throw makeError('KEY_INVALID', 'logical key prefix is not allowed');
    if (!allowInternal && key === INDEX_KEY) throw makeError('KEY_RESERVED', 'logical key is reserved');
    if (key.endsWith(':')) throw makeError('KEY_INVALID', 'logical key suffix is required');
    return key;
  }

  function assertPublicNamespace(value) {
    if (value !== undefined && value !== NAMESPACE) throw makeError('NAMESPACE_INVALID', 'cold archive namespace is fixed');
    return NAMESPACE;
  }

  function canonicalJson(value, ancestors = []) {
    if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : undefined;
    if (value === undefined || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') return undefined;
    if (ancestors.includes(value)) throw makeError('VALUE_INVALID', 'value is not JSON serializable');
    if (Array.isArray(value)) {
      return `[${value.map(item => canonicalJson(item, ancestors.concat([value])) ?? 'null').join(',')}]`;
    }
    return `{${Object.keys(value).sort().map(key => {
      const serialized = canonicalJson(value[key], ancestors.concat([value]));
      return serialized === undefined ? '' : `${JSON.stringify(key)}:${serialized}`;
    }).filter(Boolean).join(',')}}`;
  }

  function cloneJson(value) {
    const serialized = canonicalJson(value);
    if (serialized === undefined) throw makeError('VALUE_INVALID', 'value is not JSON serializable');
    return JSON.parse(serialized);
  }

  function jsonEqual(left, right) {
    try { return canonicalJson(left) === canonicalJson(right); } catch (_) { return false; }
  }

  async function hashText(text) {
    const cryptoApi = readField(root, 'crypto');
    const Encoder = readField(root, 'TextEncoder');
    if (cryptoApi?.subtle && typeof Encoder === 'function') {
      const digest = await cryptoApi.subtle.digest('SHA-256', new Encoder().encode(text));
      const Bytes = readField(root, 'Uint8Array');
      return Array.from(new Bytes(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
    }
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `fnv-${(hash >>> 0).toString(16)}`;
  }

  async function encodeBase64(text) {
    const Encoder = readField(root, 'TextEncoder');
    const bytes = typeof Encoder === 'function' ? new Encoder().encode(text) : null;
    const btoa = readField(root, 'btoa');
    if (bytes && typeof btoa === 'function') {
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary);
    }
    const BufferCtor = readField(root, 'Buffer');
    if (BufferCtor?.from) return BufferCtor.from(text, 'utf8').toString('base64');
    throw makeError('FILE_ENCODING_UNAVAILABLE', 'base64 encoder is unavailable');
  }

  function getFetch() {
    for (const candidate of collectWindows()) {
      const fetchImpl = readField(candidate, 'fetch');
      if (typeof fetchImpl === 'function') return fetchImpl.bind(candidate);
    }
    return null;
  }

  function getRequestHeaders() {
    for (const candidate of collectWindows()) {
      const directApi = readField(candidate, 'SillyTavern_API_ACU');
      const context = readField(candidate, 'SillyTavern')?.getContext?.();
      const providers = [directApi?.getRequestHeaders, context?.getRequestHeaders];
      for (const provider of providers) {
        if (typeof provider !== 'function') continue;
        try {
          const headers = provider.call(directApi || context);
          if (headers && typeof headers === 'object') {
            const result = { ...headers };
            if (!result['Content-Type'] && !result['content-type']) result['Content-Type'] = 'application/json';
            return result;
          }
        } catch (_) { /* continue to the next host provider */ }
      }
    }
    return { 'Content-Type': 'application/json' };
  }

  async function request(url, options = {}) {
    const fetchImpl = getFetch();
    if (!fetchImpl) throw makeError('ST_FETCH_UNAVAILABLE', 'SillyTavern fetch is unavailable');
    return fetchImpl(url, options);
  }

  function encodeFileName(fileName) {
    return `/user/files/${encodeURIComponent(fileName)}`;
  }

  function deleteCandidates(fileName) {
    return [
      { path: `files/${fileName}` },
      { path: fileName },
      { path: `user/files/${fileName}` },
      { path: `/user/files/${fileName}` },
    ];
  }

  function resultMeta(session, state, extra = {}) {
    return Object.freeze({
      state,
      backend: session?.backend || null,
      stableChatId: session?.stableChatId || null,
      chatGeneration: session?.chatGeneration ?? null,
      verified: extra.verified === true,
      ...extra,
    });
  }

  function failureResult(session, state, error, extra = {}) {
    return resultMeta(session, state, { error, ...extra });
  }

  function stateForError(error, mutation) {
    if (error?.code === 'STALE_CHAT') return 'stale_chat';
    if (error?.code === 'CONFLICT') return 'conflict';
    if (error?.code === 'NOT_COMMITTED') return 'not_committed';
    return mutation ? 'uncertain' : 'unavailable';
  }

  function findAdapter() {
    return findGlobal(ADAPTER_KEY);
  }

  async function resolveAdapter() {
    const immediate = findAdapter();
    if (immediate) return immediate;
    for (const candidate of collectWindows()) {
      const loading = readField(candidate, ADAPTER_LOADING_KEY);
      if (loading && typeof loading.then === 'function') {
        try { await loading; } catch (_) { /* final lookup reports unavailable */ }
      }
    }
    return findAdapter();
  }

  function enqueueMutation(stableChatId, action) {
    const queueKey = String(stableChatId);
    const previous = mutationQueues.get(queueKey) || Promise.resolve();
    const current = previous.catch(() => undefined).then(action);
    const queued = current.finally(() => {
      if (mutationQueues.get(queueKey) === queued) mutationQueues.delete(queueKey);
    });
    queued.catch(() => undefined);
    mutationQueues.set(queueKey, queued);
    return current;
  }

  function createStFilesBackend(fallbackStableChatId) {
    async function stableIdFrom(request) {
      const stableChatId = normalizeStableChatId(request?.stableChatId) || normalizeStableChatId(fallbackStableChatId);
      if (!stableChatId) throw makeError('FALLBACK_IDENTITY_UNAVAILABLE', 'stable chat id is required');
      return stableChatId;
    }

    async function fileNameFor(stableChatId, namespace, key) {
      const digest = await hashText(`${stableChatId}\n${namespace}\n${key}`);
      return `lwcs_cold_${digest}.json`;
    }

    async function createEnvelope(stableChatId, namespace, key, value) {
      const base = {
        schemaVersion: SCHEMA_VERSION,
        stableChatId,
        namespace,
        key,
        value: cloneJson(value),
      };
      return { ...base, checksum: await hashText(canonicalJson(base)) };
    }

    async function readEnvelopeAt(fileName, expected = null) {
      const response = await request(encodeFileName(fileName), { method: 'GET' });
      if (response?.status === 404) return undefined;
      if (!response?.ok) throw makeError('FILE_READ_FAILED', 'file read failed');
      let envelope;
      try { envelope = await response.json(); } catch (_) { throw makeError('FILE_ENVELOPE_INVALID', 'file envelope is invalid'); }
      if (!envelope || envelope.schemaVersion !== SCHEMA_VERSION || typeof envelope.stableChatId !== 'string' || typeof envelope.namespace !== 'string' || typeof envelope.key !== 'string' || typeof envelope.checksum !== 'string') {
        throw makeError('FILE_ENVELOPE_INVALID', 'file envelope is invalid');
      }
      const base = {
        schemaVersion: envelope.schemaVersion,
        stableChatId: envelope.stableChatId,
        namespace: envelope.namespace,
        key: envelope.key,
        value: envelope.value,
      };
      if (envelope.checksum !== await hashText(canonicalJson(base))) throw makeError('READBACK_MISMATCH', 'file checksum mismatch');
      if (expected && (envelope.stableChatId !== expected.stableChatId || envelope.namespace !== expected.namespace || envelope.key !== expected.key)) {
        throw makeError('READBACK_MISMATCH', 'file identity mismatch');
      }
      return envelope;
    }

    async function uploadEnvelope(fileName, envelope) {
      const response = await request('/api/files/upload', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ name: fileName, data: await encodeBase64(JSON.stringify(envelope)) }),
      });
      if (!response?.ok) throw makeError('NOT_COMMITTED', 'file upload failed');
      const readBack = await readEnvelopeAt(fileName, envelope);
      if (!readBack || !jsonEqual(readBack, envelope)) throw makeError('READBACK_MISMATCH', 'file readback mismatch');
    }

    async function deleteFile(fileName) {
      let endpointSucceeded = false;
      let notFoundSeen = false;
      for (const body of deleteCandidates(fileName)) {
        try {
          const response = await request('/api/files/delete', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(body),
          });
          if (response?.ok) {
            endpointSucceeded = true;
            break;
          }
          if (response?.status === 404) notFoundSeen = true;
        } catch (_) { /* try the next accepted path form */ }
      }
      const afterDelete = await readEnvelopeAt(fileName);
      if (afterDelete !== undefined) throw makeError('DELETE_NOT_VERIFIED', 'file delete was not verified');
      if (!endpointSucceeded && !notFoundSeen) throw makeError('FILE_DELETE_FAILED', 'file delete failed');
    }

    async function readIndex(stableChatId, namespace) {
      const fileName = await fileNameFor(stableChatId, namespace, INDEX_KEY);
      const envelope = await readEnvelopeAt(fileName, { stableChatId, namespace, key: INDEX_KEY });
      if (!envelope) return [];
      const keys = envelope.value?.keys;
      if (envelope.value?.schemaVersion !== SCHEMA_VERSION || !Array.isArray(keys) || keys.some(key => typeof key !== 'string')) {
        throw makeError('READBACK_MISMATCH', 'file index is invalid');
      }
      return Array.from(new Set(keys.filter(key => key !== INDEX_KEY))).sort();
    }

    async function writeIndex(stableChatId, namespace, keys) {
      const value = { schemaVersion: SCHEMA_VERSION, keys: Array.from(new Set(keys.filter(key => key !== INDEX_KEY))).sort() };
      const envelope = await createEnvelope(stableChatId, namespace, INDEX_KEY, value);
      await uploadEnvelope(await fileNameFor(stableChatId, namespace, INDEX_KEY), envelope);
    }

    return {
      async setJson({ stableChatId: requestedStableChatId, namespace, key, value }) {
        const stableChatId = await stableIdFrom({ stableChatId: requestedStableChatId });
        const fileKey = String(key);
        const fileName = await fileNameFor(stableChatId, namespace, fileKey);
        const envelope = await createEnvelope(stableChatId, namespace, fileKey, value);
        await uploadEnvelope(fileName, envelope);
        if (fileKey !== INDEX_KEY) {
          const keys = await readIndex(stableChatId, namespace);
          if (!keys.includes(fileKey)) await writeIndex(stableChatId, namespace, keys.concat(fileKey));
        }
      },
      async getJson({ stableChatId: requestedStableChatId, namespace, key }) {
        const stableChatId = await stableIdFrom({ stableChatId: requestedStableChatId });
        const fileName = await fileNameFor(stableChatId, namespace, String(key));
        const envelope = await readEnvelopeAt(fileName, { stableChatId, namespace, key: String(key) });
        return envelope?.value;
      },
      async listKeys({ stableChatId: requestedStableChatId, namespace }) {
        const stableChatId = await stableIdFrom({ stableChatId: requestedStableChatId });
        return readIndex(stableChatId, namespace);
      },
      async deleteJson({ stableChatId: requestedStableChatId, namespace, key }) {
        const stableChatId = await stableIdFrom({ stableChatId: requestedStableChatId });
        const fileKey = String(key);
        await deleteFile(await fileNameFor(stableChatId, namespace, fileKey));
        if (fileKey !== INDEX_KEY) {
          const keys = await readIndex(stableChatId, namespace);
          const nextKeys = keys.filter(existingKey => existingKey !== fileKey);
          if (nextKeys.length !== keys.length) await writeIndex(stableChatId, namespace, nextKeys);
        }
      },
    };
  }

  function normalizePublicKey(key) {
    return assertLogicalKey(key, false);
  }

  function normalizeBundle(input) {
    if (!input || typeof input !== 'object') throw makeError('BUNDLE_INVALID', 'commit bundle is required');
    const commitId = String(input.commitId ?? '').trim();
    if (!commitId) throw makeError('BUNDLE_INVALID', 'commit id is required');
    const revision = Number(input.revision);
    if (!Number.isFinite(revision) || revision < 0) throw makeError('BUNDLE_INVALID', 'revision is invalid');
    if (!Array.isArray(input.entries)) throw makeError('BUNDLE_INVALID', 'entries are required');
    const entries = input.entries.map(entry => {
      const key = normalizePublicKey(entry?.key);
      if (key === 'state:head' || key === `journal:${commitId}`) throw makeError('BUNDLE_INVALID', 'bundle key is reserved');
      const value = cloneJson(entry?.value);
      return { key, value };
    });
    if (new Set(entries.map(entry => entry.key)).size !== entries.length) throw makeError('BUNDLE_INVALID', 'bundle keys must be unique');
    const metadata = input.metadata === undefined ? null : cloneJson(input.metadata);
    return { commitId, revision, entries, metadata };
  }

  async function physicalKeyFor(logicalKey, commitId) {
    const prefix = logicalKey.slice(0, logicalKey.indexOf(':') + 1);
    const logicalHash = await hashText(logicalKey);
    const commitHash = await hashText(commitId);
    return `${prefix}${logicalHash}:${commitHash}`;
  }

  async function prepareBundle(bundle, previousHead) {
    const preparedEntries = [];
    for (const entry of bundle.entries) {
      preparedEntries.push({
        logicalKey: entry.key,
        physicalKey: await physicalKeyFor(entry.key, bundle.commitId),
        checksum: await hashText(canonicalJson(entry.value)),
        value: entry.value,
      });
    }
    const previousMapping = previousHead?.mapping && typeof previousHead.mapping === 'object' ? previousHead.mapping : {};
    const previousChecksums = previousHead?.checksums && typeof previousHead.checksums === 'object' ? previousHead.checksums : {};
    const mapping = { ...previousMapping };
    const checksums = { ...previousChecksums };
    for (const entry of preparedEntries) {
      mapping[entry.logicalKey] = entry.physicalKey;
      checksums[entry.logicalKey] = entry.checksum;
    }
    const nextHead = {
      schemaVersion: SCHEMA_VERSION,
      status: 'committed',
      commitId: bundle.commitId,
      revision: bundle.revision,
      mapping,
      checksums,
      metadata: bundle.metadata,
      journalKey: `journal:${bundle.commitId}`,
    };
    return { preparedEntries, nextHead };
  }

  function sameHead(value, expected) {
    if (expected === null) return value === undefined;
    return jsonEqual(value, expected);
  }

  function validJournal(value) {
    return !!value
      && value.schemaVersion === SCHEMA_VERSION
      && (value.status === 'pending' || value.status === 'committed' || value.status === 'rolled_back')
      && typeof value.commitId === 'string'
      && Number.isFinite(Number(value.revision))
      && Array.isArray(value.entries)
      && value.entries.every(entry => typeof entry?.logicalKey === 'string' && typeof entry?.physicalKey === 'string' && typeof entry?.checksum === 'string')
      && value.nextHead && typeof value.nextHead === 'object'
      && (value.previousHead === null || (value.previousHead && typeof value.previousHead === 'object'));
  }

  async function invokeSession(session, method, request, mutation = false) {
    try {
      return await session[method](request);
    } catch (error) {
      return failureResult(session, stateForError(error, mutation), errorCode(error));
    }
  }

  function validateRequest(request = {}) {
    const namespace = assertPublicNamespace(request.namespace);
    const key = normalizePublicKey(request.key);
    return { namespace, key };
  }

  function withHandleMethods(opened) {
    const session = opened.session;
    const stableChatId = session.stableChatId;
    const callMutation = (action) => enqueueMutation(stableChatId, action);
    const rawGet = key => invokeSession(session, 'getJson', { namespace: NAMESPACE, key }, false);
    const rawSet = (key, value, verify = undefined) => invokeSession(session, 'setJson', { namespace: NAMESPACE, key, value, verify }, true);

    const handle = {
      ...opened,
      version: VERSION,
      namespace: NAMESPACE,
      getJson: async (request = {}) => {
        try {
          const normalized = validateRequest(request);
          return handle.readCurrent({ key: normalized.key, verify: request.verify });
        } catch (error) {
          return failureResult(session, 'unavailable', errorCode(error));
        }
      },
      setJson: async (request = {}) => {
        try {
          const normalized = validateRequest(request);
          return callMutation(() => invokeSession(session, 'setJson', { namespace: normalized.namespace, key: normalized.key, value: request.value, verify: request.verify }, true));
        } catch (error) {
          return failureResult(session, 'not_committed', errorCode(error));
        }
      },
      deleteJson: async (request = {}) => {
        try {
          const normalized = validateRequest(request);
          return callMutation(() => invokeSession(session, 'deleteJson', { namespace: normalized.namespace, key: normalized.key }, true));
        } catch (error) {
          return failureResult(session, 'not_committed', errorCode(error));
        }
      },
      listKeys: async (request = {}) => {
        try {
          const namespace = assertPublicNamespace(request.namespace);
          return invokeSession(session, 'listKeys', { namespace });
        } catch (error) {
          return failureResult(session, 'unavailable', errorCode(error));
        }
      },
    };

    handle.readCurrent = async (request = {}) => {
      try {
        const normalized = validateRequest(request);
        if (normalized.key === 'state:head' || normalized.key.startsWith('journal:')) return rawGet(normalized.key);
        const headResult = await rawGet('state:head');
        if (headResult.state !== 'committed') return headResult;
        if (headResult.value === undefined) return rawGet(normalized.key);
        const physicalKey = headResult.value?.mapping?.[normalized.key];
        if (!physicalKey) return rawGet(normalized.key);
        const resolved = await invokeSession(session, 'getJson', { namespace: NAMESPACE, key: physicalKey, verify: request.verify });
        if (resolved.state !== 'committed') return resolved;
        const expectedChecksum = headResult.value?.checksums?.[normalized.key];
        if (expectedChecksum && expectedChecksum !== await hashText(canonicalJson(resolved.value))) return failureResult(session, 'uncertain', 'READBACK_MISMATCH');
        return { ...resolved, logicalKey: normalized.key, physicalKey, resolved: true };
      } catch (error) {
        return failureResult(session, 'unavailable', errorCode(error));
      }
    };

    handle.readJournal = async commitId => {
      try {
        const key = normalizePublicKey(`journal:${String(commitId ?? '').trim()}`);
        const result = await rawGet(key);
        return result.state === 'committed' ? { ...result, journal: result.value ?? null } : result;
      } catch (error) {
        return failureResult(session, 'unavailable', errorCode(error));
      }
    };

    handle.listPending = async () => {
      const listed = await handle.listKeys();
      if (listed.state !== 'committed') return listed;
      const head = await rawGet('state:head');
      if (head.state !== 'committed') return head;
      const pending = [];
      for (const key of listed.keys.filter(item => item.startsWith('journal:'))) {
        const journal = await handle.readJournal(key.slice('journal:'.length));
        if (journal.state !== 'committed') return journal;
        if (journal.journal?.status === 'pending' || (journal.journal?.status === 'committed' && !sameHead(head.value, journal.journal.nextHead))) {
          pending.push(journal.journal);
        }
      }
      return { ...listed, pending };
    };

    handle.recoverPending = async () => {
      return callMutation(async () => {
        const result = await handle.listPending();
        if (result.state !== 'committed') return result;
        const recovered = [];
        for (const journal of result.pending) {
          if (!validJournal(journal)) return failureResult(session, 'uncertain', 'JOURNAL_INVALID', { recovered });
          const head = await rawGet('state:head');
          if (head.state !== 'committed') return head;
          const previousHead = journal.previousHead;
          const nextHead = journal.nextHead;
          if (!sameHead(head.value, previousHead) && !sameHead(head.value, nextHead)) {
            return failureResult(session, 'conflict', 'RECOVERY_HEAD_CONFLICT', { recovered, commitId: journal.commitId, revision: journal.revision });
          }
          let entryState = 'ok';
          for (const entry of journal.entries) {
            const entryResult = await rawGet(entry.physicalKey);
            if (entryResult.state !== 'committed') return entryResult;
            if (entryResult.value === undefined || entry.checksum !== await hashText(canonicalJson(entryResult.value))) {
              entryState = 'missing';
              break;
            }
          }
          if (entryState === 'missing') {
            if (!sameHead(head.value, previousHead)) return failureResult(session, 'uncertain', 'RECOVERY_INCONSISTENT_HEAD', { recovered, commitId: journal.commitId, revision: journal.revision });
            const rolledBack = { ...journal, status: 'rolled_back', rollbackReason: 'ENTRY_MISSING_OR_MISMATCH' };
            const rollbackResult = await rawSet(`journal:${journal.commitId}`, rolledBack, { commitId: journal.commitId, revision: journal.revision });
            if (rollbackResult.state !== 'committed') return rollbackResult;
            recovered.push({ commitId: journal.commitId, revision: journal.revision, outcome: 'rolled_back' });
            continue;
          }
          if (journal.status === 'pending') {
            const committedJournal = { ...journal, status: 'committed' };
            const journalResult = await rawSet(`journal:${journal.commitId}`, committedJournal, { commitId: journal.commitId, revision: journal.revision });
            if (journalResult.state !== 'committed') return journalResult;
          }
          if (!sameHead(head.value, nextHead)) {
            const headResult = await rawSet('state:head', nextHead, { commitId: journal.commitId, revision: journal.revision });
            if (headResult.state !== 'committed') return headResult;
          }
          recovered.push({ commitId: journal.commitId, revision: journal.revision, outcome: 'completed' });
        }
        const remaining = await handle.listPending();
        if (remaining.state !== 'committed') return remaining;
        return resultMeta(session, 'committed', { verified: true, recovered, pending: remaining.pending });
      });
    };

    handle.commitBundle = async input => {
      let bundle;
      try { bundle = normalizeBundle(input); } catch (error) { return failureResult(session, 'not_committed', errorCode(error)); }
      return callMutation(async () => {
        const journalKey = `journal:${bundle.commitId}`;
        const headKey = 'state:head';
        const previousHead = await invokeSession(session, 'getJson', { namespace: NAMESPACE, key: headKey }, false);
        if (previousHead.state !== 'committed') return previousHead;
        const previousHeadValue = previousHead.value === undefined ? null : cloneJson(previousHead.value);
        const prepared = await prepareBundle(bundle, previousHeadValue);
        const pendingJournal = {
          schemaVersion: SCHEMA_VERSION,
          status: 'pending',
          commitId: bundle.commitId,
          revision: bundle.revision,
          entries: prepared.preparedEntries.map(entry => ({ logicalKey: entry.logicalKey, physicalKey: entry.physicalKey, checksum: entry.checksum })),
          previousHead: previousHeadValue,
          nextHead: prepared.nextHead,
          metadata: bundle.metadata,
        };
        const pendingResult = await rawSet(journalKey, pendingJournal, { commitId: bundle.commitId, revision: bundle.revision });
        if (pendingResult.state !== 'committed') return pendingResult;

        if (session.backend === 'tt-store' && typeof session.setJsonBatch === 'function' && prepared.preparedEntries.length > 1) {
          const batchResult = await invokeSession(session, 'setJsonBatch', prepared.preparedEntries.map(entry => ({
            namespace: NAMESPACE,
            key: entry.physicalKey,
            value: entry.value,
          })), true);
          if (batchResult.state !== 'committed' || batchResult.verified !== true) return batchResult;
        } else {
          for (const entry of prepared.preparedEntries) {
            const entryResult = await rawSet(entry.physicalKey, entry.value);
            if (entryResult.state !== 'committed') return entryResult;
          }
        }

        const committedJournal = { ...pendingJournal, status: 'committed' };
        const journalResult = await rawSet(journalKey, committedJournal, { commitId: bundle.commitId, revision: bundle.revision });
        if (journalResult.state !== 'committed') {
          await rawSet(journalKey, pendingJournal, { commitId: bundle.commitId, revision: bundle.revision });
          return journalResult;
        }
        const headResult = await rawSet(headKey, prepared.nextHead, { commitId: bundle.commitId, revision: bundle.revision });
        if (headResult.state !== 'committed') return headResult;
        return resultMeta(session, 'committed', {
          commitId: bundle.commitId,
          revision: bundle.revision,
          verified: true,
          journalKey,
          mapping: prepared.nextHead.mapping,
          checksums: prepared.nextHead.checksums,
        });
      });
    };

    return Object.freeze(handle);
  }

  async function open(options = {}) {
    const hasFallback = Object.prototype.hasOwnProperty.call(options, 'fallbackStableChatId');
    const fallbackStableChatId = normalizeStableChatId(options.fallbackStableChatId);
    if (hasFallback && !fallbackStableChatId) return resultMeta(null, 'unavailable', { error: 'FALLBACK_IDENTITY_UNAVAILABLE' });
    const adapter = await resolveAdapter();
    if (!adapter || typeof adapter.openSession !== 'function' || typeof adapter.registerBackend !== 'function') {
      return resultMeta(null, 'unavailable', { error: 'PERSISTENCE_ADAPTER_UNAVAILABLE' });
    }
    try {
      adapter.registerBackend('cold-archive', 'st-files', createStFilesBackend(fallbackStableChatId));
    } catch (error) {
      return resultMeta(null, 'unavailable', { error: errorCode(error) });
    }
    const opened = await adapter.openSession({ domain: 'cold-archive', fallbackStableChatId: fallbackStableChatId || undefined });
    if (opened.state !== 'committed' || !opened.session) {
      if (opened.error === 'TAURITAVERN_UNAVAILABLE' && !fallbackStableChatId) return { ...opened, error: 'FALLBACK_IDENTITY_UNAVAILABLE' };
      return opened;
    }
    return withHandleMethods(opened);
  }

  const api = Object.freeze({ version: VERSION, namespace: NAMESPACE, statuses: STATES, open });
  for (const candidate of collectWindows()) {
    try { candidate[GLOBAL_KEY] = api; } catch (_) { /* best effort */ }
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);

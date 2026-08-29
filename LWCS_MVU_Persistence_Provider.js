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
   * handle.readState({ initialState, message }) reads one floor without replacing the live hot state.
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

  function isPlainObject(value) {
    if (!isObject(value) || Object.prototype.toString.call(value) !== '[object Object]') return false;
    try {
      const prototype = Object.getPrototypeOf(value);
      if (prototype === null) return true;
      const constructor = Object.prototype.hasOwnProperty.call(prototype, 'constructor') && prototype.constructor;
      return typeof constructor === 'function'
        && Function.prototype.toString.call(constructor) === Function.prototype.toString.call(Object);
    } catch (_) {
      return false;
    }
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

  function isCanonicalMvuState(value) {
    return isPlainObject(value)
      && isPlainObject(value.stat_data)
      && (isPlainObject(value.schema) || value.schema === '没有用别管这个');
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
        : (error?.code === 'STALE_CHAT'
          ? 'stale_chat'
          : (['STATE_INVALID', 'PLACEHOLDER_MESSAGE'].includes(error?.code) ? 'not_committed' : 'uncertain'));
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

    async function readRevisionChain(targetRevision) {
      const targetRead = await readKey(`state:revision:${targetRevision}`, { schemaVersion: SCHEMA_VERSION, kind: 'revision', revision: targetRevision });
      if (!targetRead.found || !validRevision(targetRead.value, targetRevision)) throw new ProviderError('REVISION_HEAD_INVALID');
      const reverseRecords = [targetRead.value];
      const visitedRevisions = new Set([targetRevision]);
      let cursor = targetRead.value;
      while (cursor.mode !== 'checkpoint') {
        if (reverseRecords.length > 20 || !Number.isInteger(cursor.parent)) throw new ProviderError('REVISION_WINDOW_EXCEEDED');
        const parentRevision = cursor.parent;
        if (parentRevision >= cursor.revision || visitedRevisions.has(parentRevision)) throw new ProviderError('REVISION_CHAIN_INVALID');
        const parentRead = await readKey(`state:revision:${parentRevision}`, { schemaVersion: SCHEMA_VERSION, kind: 'revision', revision: parentRevision });
        if (!parentRead.found || !validRevision(parentRead.value, parentRevision)) throw new ProviderError('REVISION_CHAIN_INVALID');
        visitedRevisions.add(parentRevision);
        cursor = parentRead.value;
        reverseRecords.push(cursor);
      }
      if (reverseRecords.length > 20) throw new ProviderError('REVISION_WINDOW_EXCEEDED');
      const records = reverseRecords.reverse();
      const checkpointRevision = records[0].revision;
      if (records.some(record => record.mode === 'patch' && record.checkpointRevision !== checkpointRevision)) throw new ProviderError('REVISION_CHAIN_INVALID');
      return records;
    }

    function selectCanonicalState(records, requestedFloor) {
      let targetIndex = records.length - 1;
      if (requestedFloor.absoluteIndex >= 0) {
        targetIndex = -1;
        let targetAbsoluteIndex = -1;
        for (let index = records.length - 1; index >= 0; index -= 1) {
          const candidateFloor = normalizeFloor(records[index].floor);
          if (!floorCompatible(candidateFloor, requestedFloor) || candidateFloor.absoluteIndex <= targetAbsoluteIndex) continue;
          targetIndex = index;
          targetAbsoluteIndex = candidateFloor.absoluteIndex;
        }
      }
      if (targetIndex < 0) return null;
      let candidateState = normalizeState(records[0].checkpoint);
      let canonicalTargetIndex = isCanonicalMvuState(candidateState) ? 0 : -1;
      let canonicalState = canonicalTargetIndex === 0 ? clone(candidateState) : null;
      for (let index = 1; index <= targetIndex; index += 1) {
        const record = records[index];
        candidateState = record.mode === 'checkpoint'
          ? normalizeState(record.checkpoint)
          : normalizeState(applyPatch(candidateState, record.patch));
        if (isCanonicalMvuState(candidateState)) {
          canonicalTargetIndex = index;
          canonicalState = clone(candidateState);
        }
      }
      return canonicalTargetIndex < 0 ? null : { records, targetIndex: canonicalTargetIndex, state: canonicalState };
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
      let selected = null;
      let candidateRevision = targetRevision;
      const visitedCheckpointHeads = new Set();
      for (let attempt = 0; attempt < 20 && Number.isInteger(candidateRevision); attempt += 1) {
        if (visitedCheckpointHeads.has(candidateRevision)) throw new ProviderError('REVISION_CHAIN_INVALID');
        visitedCheckpointHeads.add(candidateRevision);
        const records = await readRevisionChain(candidateRevision);
        selected = selectCanonicalState(records, requestedFloor);
        if (selected) break;
        const parentRevision = records[0].parent;
        if (Number.isInteger(parentRevision) && parentRevision >= records[0].revision) throw new ProviderError('REVISION_CHAIN_INVALID');
        candidateRevision = parentRevision;
      }
      if (!selected && Number.isInteger(candidateRevision)) throw new ProviderError('REVISION_WINDOW_EXCEEDED');
      if (!selected) {
        await assertCurrentFloor(requestedFloor);
        hotState = clone(initialState);
        head = null;
        floor = requestedFloor;
        loaded = true;
        lastError = '';
        return result('committed', { hotState: clone(hotState), head: null, floor, invalidStateReset: true, backend: opened.backend, stableChatId: opened.stableChatId });
      }
      const { records, targetIndex, state: canonicalState } = selected;
      const checkpointRevision = records[0].revision;
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
      await assertCurrentFloor(requestedFloor);
      hotState = canonicalState;
      head = clone(targetHead);
      floor = normalizeFloor(target.floor);
      loaded = true;
      lastError = '';
      return result('committed', { hotState: clone(hotState), head: clone(head), floor, recovered: target.revision !== targetRevision, backend: opened.backend, stableChatId: opened.stableChatId });
    }

    async function readStateNow(request = {}) {
      const liveState = hotState === null ? null : clone(hotState);
      const liveLoaded = loaded;
      const liveHead = head === null ? null : clone(head);
      const liveFloor = floor === null ? null : clone(floor);
      const liveError = lastError;
      try {
        return await loadNow(request);
      } finally {
        hotState = liveState;
        loaded = liveLoaded;
        head = liveHead;
        floor = liveFloor;
        lastError = liveError;
      }
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
      if (!isCanonicalMvuState(nextState)) throw new ProviderError('STATE_INVALID');
      if (nextFloor.absoluteIndex < 0 || nextFloor.textFingerprint === textFingerprint('')) throw new ProviderError('PLACEHOLDER_MESSAGE');
      await assertCurrentFloor(nextFloor);
      if (head && jsonEqual(previousState, nextState)) {
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
    const readState = request => enqueue(() => readStateNow(request).catch(operationFailure));
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
      readState,
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

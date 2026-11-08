(function (root) {
  'use strict';
  const KEY = '__LWCS_HOST_COMPATIBILITY_V1__';
  if (root[KEY]) return;
  // Main-window session memory only. Values never go to MVU/worldbooks/storage.
  const sessionPanels = new Map();
  function sessionMap(chatId, panel) {
    const key = JSON.stringify([String(chatId || ''), String(panel || '')]);
    if (!sessionPanels.has(key)) sessionPanels.set(key, new Map());
    return sessionPanels.get(key);
  }

  // TT 2.3.0 maps endpoint-dialog cancellation to AbortError. Keep that
  // structured identity (including a wrapped Rust Cancelled variant), not text.
  function isCancellation(error) {
    const seen = new Set();
    for (let value = error; value && typeof value === 'object' && !seen.has(value); value = value.cause) {
      seen.add(value);
      if (value.name === 'AbortError' || value.code === 'ABORT_ERR'
        || Object.prototype.hasOwnProperty.call(value, 'Cancelled')) return true;
    }
    return false;
  }
  function abortError(message = '操作已取消。', cause) {
    const error = new Error(message, cause === undefined ? undefined : { cause });
    error.name = 'AbortError';
    return error;
  }

  function hasColdValue(value) {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index++) {
        if (!Object.prototype.hasOwnProperty.call(value, index) || value[index] == null) return true;
      }
      return false;
    }
    return !!value && typeof value === 'object' && Object.values(value).some(item => item == null);
  }
  function canonicalOrHelperField(message, canonical, helperAlias) {
    return message?.[canonical] !== undefined ? message[canonical] : message?.[helperAlias];
  }
  function hasColdVariableSlots(message) {
    const variables = canonicalOrHelperField(message, 'variables', 'swipes_data');
    return variables === null || hasColdValue(variables);
  }
  function hasColdSlots(message) {
    return hasColdValue(message?.swipes)
      || hasColdValue(canonicalOrHelperField(message, 'variables', 'swipes_data'))
      || hasColdValue(canonicalOrHelperField(message, 'swipe_info', 'swipes_info'));
  }
  function hasHydratableCanonicalSlots(message) {
    return hasColdValue(message?.swipes) || hasColdValue(message?.swipe_info);
  }
  let transportPromise;
  const pending = new WeakMap();
  async function ensureWarmSwipes(message, assertCurrent = () => {}) {
    assertCurrent();
    if (hasColdVariableSlots(message)) throw new Error('历史候选变量未加载且 TT hydration 不支持补齐变量槽，已停止写入。');
    if (!hasColdSlots(message)) return message;
    if (!hasHydratableCanonicalSlots(message)) {
      throw new Error('历史候选冷槽仅存在于 Helper 别名中，不能交给 TT hydration，已停止写入。');
    }
    if (!root.__TAURITAVERN__ || !message?.tt_swipe_cold) {
      throw new Error('历史候选未加载且宿主不提供冷候选来源，已停止写入。');
    }
    // This module is loaded in the main window by ST_UI_Entry, like the bridge.
    // Only the documented transport fills null slots; never read/replace chat.
    if (!transportPromise) {
      transportPromise = import(new URL('/scripts/chat-payload-transport.js', root.location.href).href)
        .catch(error => { transportPromise = null; throw error; });
    }
    let job = pending.get(message);
    if (!job) {
      job = (async () => {
        const transport = await transportPromise;
        assertCurrent();
        if (typeof transport.hydrateMessageSwipes !== 'function') throw new Error('宿主缺少冷候选读取接口。');
        await transport.hydrateMessageSwipes(message);
      })();
      pending.set(message, job);
    }
    try { await job; }
    finally { if (pending.get(message) === job) pending.delete(message); }
    assertCurrent();
    if (hasColdSlots(message)) throw new Error('历史候选读取不完整，已停止写入。');
    return message;
  }
  root[KEY] = Object.freeze({ isCancellation, abortError, hasColdSlots, hasColdVariableSlots, hasHydratableCanonicalSlots, ensureWarmSwipes, sessionMap });
})(globalThis);

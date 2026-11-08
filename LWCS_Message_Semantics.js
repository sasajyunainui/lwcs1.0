/* 纯消息语义：输入必须来自 canonical chat[]，不可使用丢失 role/tool_calls 的助手投影。 */
(function (root) {
  'use strict';

  function roleOf(message) {
    if (!message || typeof message !== 'object') return 'unknown';
    if (typeof message.role === 'string' && message.role.trim()) return message.role.trim().toLowerCase();
    if (message.is_user) return 'user';
    if (message.is_system || message.extra?.type === 'narrator') return 'system';
    return 'assistant';
  }

  function bodyOf(message) {
    if (!message || typeof message !== 'object') return '';
    // mes 是当前候选的内存正文；不以磁盘或冷槽位覆盖未保存编辑。
    if (typeof message.mes === 'string') return message.mes;
    if (typeof message.message === 'string') return message.message;
    const swipe = message.swipes?.[message.swipe_id ?? 0];
    return typeof swipe === 'string' ? swipe : '';
  }

  function isNarrative(message) {
    return roleOf(message) === 'assistant' && bodyOf(message).trim().length > 0;
  }

  function isDialogue(message) {
    return roleOf(message) === 'user' || isNarrative(message);
  }

  function narrativeIndices(chat) {
    const indices = [];
    if (Array.isArray(chat)) chat.forEach((message, index) => { if (isNarrative(message)) indices.push(index); });
    return indices;
  }

  function legacyIndices(chat) {
    const indices = [];
    // 历史调度字段采用非玩家序号。此口径不能改成剧情序号。
    if (Array.isArray(chat)) chat.forEach((message, index) => { if (message && !message.is_user) indices.push(index); });
    return indices;
  }

  function countThrough(indices, absoluteIndex) {
    let left = 0;
    let right = indices.length;
    while (left < right) {
      const middle = (left + right) >>> 1;
      if (indices[middle] <= absoluteIndex) left = middle + 1;
      else right = middle;
    }
    return left;
  }

  function resolveScheduleFloor(legacyFloor, legacy, narrative) {
    // 0 是现有“未更新”哨兵；非法或越界坐标不可悄悄重置。
    if (!Number.isInteger(legacyFloor) || legacyFloor < 0 || legacyFloor > legacy.length) {
      return { ok: false, reason: 'unresolved_legacy_schedule_floor', legacyFloor };
    }
    const absoluteIndex = legacyFloor === 0 ? -1 : legacy[legacyFloor - 1];
    return { ok: true, legacyFloor, absoluteIndex, narrativeFloor: countThrough(narrative, absoluteIndex) };
  }

  const api = Object.freeze({ roleOf, bodyOf, isNarrative, isDialogue, narrativeIndices, legacyIndices, countThrough, resolveScheduleFloor });
  root.__LWCS_MESSAGE_SEMANTICS_V1__ = api;
})(globalThis);

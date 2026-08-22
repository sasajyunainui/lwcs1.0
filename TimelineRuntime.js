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
    const fingerprint = sourceFingerprint(events);
    const existing = registrations.get(safeEra);
    if (existing) {
      if (existing.fingerprint === fingerprint) return existing.summary;
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
      fingerprint,
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

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
  const LOCATION_REGION_PROFILES = Object.freeze({
    前哨: Object.freeze({ 设施上限: 1 }),
    小镇: Object.freeze({ 设施上限: 2 }),
    小城: Object.freeze({ 设施上限: 3 }),
    中型城市: Object.freeze({ 设施上限: 4 }),
    大型城市: Object.freeze({ 设施上限: 5 }),
    首都: Object.freeze({ 设施上限: 6 }),
  });
  const LOCATION_TERRAIN_PROFILES = Object.freeze({
    森林: Object.freeze({ 设施上限: 2, 危险等级: 2, 探索难度: 35, 修炼环境: Object.freeze({ 魂力倍率: 1.02, 精神力倍率: 1.02, 生命力倍率: 1.04 }) }),
    极寒: Object.freeze({ 设施上限: 1, 危险等级: 4, 探索难度: 60, 修炼环境: Object.freeze({ 魂力倍率: 0.95, 精神力倍率: 1, 生命力倍率: 0.9 }) }),
    山地: Object.freeze({ 设施上限: 2, 危险等级: 2, 探索难度: 45, 修炼环境: Object.freeze({ 魂力倍率: 1, 精神力倍率: 1, 生命力倍率: 1 }) }),
    平原: Object.freeze({ 设施上限: 3, 危险等级: 1, 探索难度: 30, 修炼环境: Object.freeze({ 魂力倍率: 1, 精神力倍率: 1, 生命力倍率: 1 }) }),
    深海: Object.freeze({ 设施上限: 1, 危险等级: 4, 探索难度: 65, 修炼环境: Object.freeze({ 魂力倍率: 1.05, 精神力倍率: 1.02, 生命力倍率: 0.9 }) }),
    位面: Object.freeze({ 设施上限: 1, 危险等级: 5, 探索难度: 75, 修炼环境: Object.freeze({ 魂力倍率: 0.8, 精神力倍率: 0.9, 生命力倍率: 0.85 }) }),
    太空: Object.freeze({ 设施上限: 2, 危险等级: 5, 探索难度: 70, 修炼环境: Object.freeze({ 魂力倍率: 0.9, 精神力倍率: 1.05, 生命力倍率: 0.8 }) }),
  });
  const LOCATION_FUNCTION_PROFILES = Object.freeze({
    学院: Object.freeze({ 默认等级: 3, 开放时段: '06:00-22:00' }),
    锻造: Object.freeze({ 默认等级: 3, 开放时段: '08:00-22:00' }),
    工业: Object.freeze({ 默认等级: 3, 开放时段: '08:00-22:00' }),
    商业: Object.freeze({ 默认等级: 3, 开放时段: '08:00-22:00' }),
    港口: Object.freeze({ 默认等级: 3, 开放时段: '00:00-24:00' }),
    军方: Object.freeze({ 默认等级: 4, 开放时段: '00:00-24:00' }),
    总部: Object.freeze({ 默认等级: 4, 开放时段: '08:00-22:00' }),
    医疗: Object.freeze({ 默认等级: 3, 开放时段: '00:00-24:00' }),
    交通: Object.freeze({ 默认等级: 3, 开放时段: '05:00-24:00' }),
    资源: Object.freeze({ 默认等级: 2, 开放时段: '06:00-22:00' }),
    黑市: Object.freeze({ 默认等级: 2, 开放时段: '18:00-06:00' }),
    拍卖: Object.freeze({ 默认等级: 4, 开放时段: '18:00-22:00' }),
  });
  const ERA_FACILITY_CAPS = Object.freeze({ dldl: 3, jueshitangmen: 4, current: 5, zjdl: 6 });
  const LOCATION_WORLD_RULE_KEYS = new Set(['区域档案', '功能档案', '覆盖']);
  const LOCATION_RECORD_KEYS = new Set(['规范名', '目标路径', '实例化策略', '节点', '世界规则']);
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

    return { ok: false, status: 'unloaded', eraId: null, selector: 'missing-context', detail: '未提供时代或可读tick', diagnostic: { code: 'ERA_CONTEXT_MISSING', selector: 'missing-context' } };
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
    const explicitEraId = typeof options.eraId === 'string' ? options.eraId.trim() : '';
    const suppliedTick = options.absoluteTick === undefined || options.absoluteTick === null
      ? readDataRootTick(options.dataRoot)
      : Number(options.absoluteTick);
    if (library && !explicitEraId && !(Number.isFinite(suppliedTick) && suppliedTick >= 0)) {
      return {
        status: 'resolved',
        library: compileResolvedLibrary(library, type),
        eraId: null,
        resourceType: type,
        resourceStatus: 'loaded',
        diagnostic: { selector: 'provided-library', source: 'provided-library', resourceType: type, resourceStatus: 'loaded' },
      };
    }
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

  function compileLocationWorldRules(value, path) {
    assertPlainRecord(value, path, '地点世界规则');
    assertStrictKeys(value, LOCATION_WORLD_RULE_KEYS, path);
    const region = requiredString(value.区域档案, `${path}.区域档案`, '区域档案');
    if (!LOCATION_REGION_PROFILES[region] && !LOCATION_TERRAIN_PROFILES[region]) {
      libraryFail('LIBRARY_FIELD_INVALID', `${path}.区域档案`, region, `未知区域档案: ${region}`);
    }
    const functions = stringList(value.功能档案, `${path}.功能档案`, '功能档案');
    functions.forEach(functionName => {
      if (!LOCATION_FUNCTION_PROFILES[functionName]) {
        libraryFail('LIBRARY_FIELD_INVALID', `${path}.功能档案`, functionName, `未知功能档案: ${functionName}`);
      }
    });
    assertPlainRecord(value.覆盖, `${path}.覆盖`, '地点规则覆盖');
    return {
      区域档案: region,
      功能档案: functions,
      覆盖: clone(value.覆盖),
    };
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
      if (sourceRecord.世界规则 === undefined) {
        libraryFail('LIBRARY_FIELD_INVALID', `$.地点.${recordId}.世界规则`, sourceRecord.世界规则, '地点记录必须声明世界规则');
      }
      const worldRules = compileLocationWorldRules(sourceRecord.世界规则, `$.地点.${recordId}.世界规则`);
      output.地点[recordId] = {
        规范名: canonicalName,
        目标路径: targetPath,
        实例化策略: strategy,
        节点: node,
        世界规则: worldRules,
      };
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

  function normalizeLocationPath(value) {
    return String(value || '')
      .trim()
      .replace(/^(?:斗罗大陆|斗灵大陆)-?/, '')
      .split(/[-/]/)
      .map(segment => segment.trim())
      .filter(Boolean);
  }

  function readWorldLocationNode(dataRoot, pathSegments) {
    const root = dataRoot?.world?.地点;
    if (!isPlainRecord(root) || !pathSegments.length) return null;
    const candidates = [pathSegments];
    if (pathSegments.length > 1 && Object.prototype.hasOwnProperty.call(root, pathSegments[1])) candidates.push(pathSegments.slice(1));
    for (const candidate of candidates) {
      let current = root;
      let valid = true;
      for (let index = 0; index < candidate.length; index += 1) {
        if (!isPlainRecord(current) || !isPlainRecord(current[candidate[index]])) {
          valid = false;
          break;
        }
        current = current[candidate[index]];
        if (index < candidate.length - 1) current = current.子节点;
      }
      if (valid && isPlainRecord(current)) return current;
    }
    return null;
  }

  function selectLocationRecordByPath(library, pathSegments) {
    const meta = compiledLocationMeta.get(library);
    const ids = meta?.paths?.get(pathKey(pathSegments)) || [];
    if (!ids.length) return null;
    const recordId = ids.find(id => library.地点[id]?.实例化策略 === 'insert') || ids[0];
    return library.地点[recordId] ? { recordId, record: library.地点[recordId] } : null;
  }

  function resolveStaticLocationView(library, query, currentPath = []) {
    const raw = String(query || '').trim();
    if (!raw || !library) return null;
    const normalized = normalizeLocationPath(raw);
    const candidates = Array.from(new Set([
      raw,
      normalized.join('-'),
      normalized[normalized.length - 1] || '',
    ].filter(Boolean)));
    for (const candidate of candidates) {
      const resolved = resolveLocation(candidate, currentPath, { library });
      if (resolved.status !== 'resolved' || !resolved.recordId) continue;
      const record = library.地点[resolved.recordId];
      if (!record) continue;
      return {
        resolved: true,
        dynamic: false,
        recordId: resolved.recordId,
        name: record.规范名,
        path: [...record.目标路径],
        node: clone(record.节点),
        worldRules: clone(record.世界规则),
        source: 'static-library',
      };
    }
    const pathRecord = selectLocationRecordByPath(library, normalized);
    if (!pathRecord) return null;
    return {
      resolved: true,
      dynamic: false,
      recordId: pathRecord.recordId,
      name: pathRecord.record.规范名,
      path: [...pathRecord.record.目标路径],
      node: clone(pathRecord.record.节点),
      worldRules: clone(pathRecord.record.世界规则),
      source: 'static-library',
      overlay: null,
    };
  }

  function resolveDynamicLocationView(dataRoot, library, query) {
    const dynamicTable = dataRoot?.world?.动态地点;
    if (!isPlainRecord(dynamicTable)) return null;
    const raw = String(query || '').trim();
    const normalized = normalizeLocationPath(raw);
    const leaf = normalized[normalized.length - 1] || raw;
    const candidates = Array.from(new Set([raw, leaf].filter(Boolean)));
    let hit = null;
    for (const candidate of candidates) {
      if (isPlainRecord(dynamicTable[candidate])) {
        hit = [candidate, dynamicTable[candidate]];
        break;
      }
    }
    if (!hit) {
      hit = Object.entries(dynamicTable).find(([name]) => name === leaf || (raw && raw.endsWith(`-${name}`))) || null;
    }
    if (!hit) return null;
    const [name, node] = hit;
    const parentName = String(node.归属父节点 || '').trim();
    const parent = resolveStaticLocationView(library, parentName, normalizeLocationPath(parentName).slice(0, -1));
    const parentPath = parent?.path || normalizeLocationPath(parentName);
    return {
      resolved: true,
      dynamic: true,
      recordId: `dynamic:${name}`,
      name,
      path: [...parentPath, name],
      node: clone(node),
      worldRules: {
        区域档案: parent?.worldRules?.区域档案 || '平原',
        功能档案: [],
        覆盖: {},
      },
      source: 'world.动态地点',
      parent,
    };
  }

  function resolveWorldLocationView(dataRoot, library, query, currentPath = []) {
    const dynamic = resolveDynamicLocationView(dataRoot, library, query);
    if (dynamic) return dynamic;
    const staticView = resolveStaticLocationView(library, query, currentPath);
    if (!staticView) return null;
    const overlay = readWorldLocationNode(dataRoot, staticView.path);
    if (overlay) staticView.node = { ...staticView.node, ...clone(overlay) };
    staticView.source = overlay ? 'world.地点' : staticView.source;
    return staticView;
  }

  function parseClockMinute(value) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour < 0 || hour > 24 || minute < 0 || minute > 59 || (hour === 24 && minute !== 0)) return null;
    return hour * 60 + minute;
  }

  function parseOpeningWindow(value) {
    const match = String(value || '').trim().match(/^(.+?)-(.*)$/);
    if (!match) return null;
    const start = parseClockMinute(match[1]);
    const end = parseClockMinute(match[2]);
    return start === null || end === null ? null : { start, end };
  }

  function isOpeningRangeAvailable(window, startMinute, durationMinutes) {
    if (!window) return true;
    if (window.start === 0 && window.end === 1440) return true;
    const intervals = window.start < window.end
      ? [[window.start, window.end]]
      : [[window.start, 1440], [0, window.end]];
    const duration = Math.max(0, Number(durationMinutes || 0));
    const start = Math.max(0, Number(startMinute || 0));
    if (!(duration > 0)) {
      const local = start % MINUTES_PER_DAY;
      return intervals.some(([from, to]) => local >= from && local < to);
    }
    let cursor = start;
    const end = start + duration;
    while (cursor < end) {
      const dayEnd = (Math.floor(cursor / MINUTES_PER_DAY) + 1) * MINUTES_PER_DAY;
      const segmentEnd = Math.min(end, dayEnd);
      const localStart = cursor % MINUTES_PER_DAY;
      const localEnd = segmentEnd % MINUTES_PER_DAY || (segmentEnd === dayEnd ? MINUTES_PER_DAY : 0);
      if (!intervals.some(([from, to]) => localStart >= from && localEnd <= to)) return false;
      cursor = segmentEnd;
    }
    return true;
  }

  function buildWorldActionTime(dataRoot, durationTicks) {
    const rawTick = Number(dataRoot?.world?.时间?.tick);
    const tick = Number.isFinite(rawTick) && rawTick >= 0 ? Math.round(rawTick * 10) / 10 : null;
    const duration = Number.isFinite(Number(durationTicks)) && Number(durationTicks) >= 0
      ? Math.round(Number(durationTicks) * 10) / 10
      : 0;
    if (tick === null) return { tick: null, 持续tick: duration, 开始分钟: null, 结束分钟: null, 日内分钟: null, 日期: null };
    const startMinutes = tick * MINUTES_PER_TICK;
    const endMinutes = startMinutes + duration * MINUTES_PER_TICK;
    const calendar = totalMinutes => {
      const wholeMinutes = Math.max(0, Math.floor(totalMinutes));
      const days = Math.floor(wholeMinutes / MINUTES_PER_DAY);
      const minuteOfDay = wholeMinutes % MINUTES_PER_DAY;
      return {
        年: Math.floor(days / (DAYS_PER_MONTH * MONTHS_PER_YEAR)),
        月: Math.floor(days % (DAYS_PER_MONTH * MONTHS_PER_YEAR) / DAYS_PER_MONTH) + 1,
        日: days % DAYS_PER_MONTH + 1,
        时: Math.floor(minuteOfDay / 60),
        分: minuteOfDay % 60,
      };
    };
    return {
      tick,
      持续tick: duration,
      分钟: startMinutes,
      结束分钟: endMinutes,
      开始分钟: startMinutes,
      日内分钟: startMinutes % MINUTES_PER_DAY,
      日期: calendar(startMinutes),
      结束日期: calendar(endMinutes),
    };
  }

  function inferWorldTerrain(view) {
    const area = String(view?.worldRules?.区域档案 || '').trim();
    if (LOCATION_TERRAIN_PROFILES[area]) return area;
    const text = `${view?.name || ''} ${(view?.path || []).join('-')} ${view?.node?.类型 || ''} ${view?.node?.描述 || ''}`;
    if (/深渊|恶魔位面|位面|万兽台|七圣渊|战神斗场|龙谷/.test(text)) return '位面';
    if (/深海|海神岛|海域|海港|海洋|水下/.test(text)) return '深海';
    if (/极北|冰川|冰原|雪山|极寒/.test(text)) return '极寒';
    if (/森林|林海|雨林|草木/.test(text)) return '森林';
    if (/山脉|山地|山峰|盆地|峡谷|沙漠|矿区/.test(text)) return '山地';
    return '平原';
  }

  function readWorldPermissions(charData, node) {
    const social = isPlainRecord(charData?.社交) ? charData.社交 : {};
    const factionTable = isPlainRecord(social.势力) ? social.势力 : {};
    const relationTable = isPlainRecord(social.关系) ? social.关系 : {};
    const factions = {};
    let highest = 0;
    Object.entries(factionTable).forEach(([name, value]) => {
      if (!isPlainRecord(value)) return;
      const level = Math.max(0, Number(value.权限级 || 0) || 0);
      highest = Math.max(highest, level);
      factions[name] = {
        身份: String(value.身份 || '无'),
        权限级: level,
        关系: String(relationTable[name]?.关系 || relationTable[name]?.对方身份 || '').trim() || undefined,
      };
    });
    const reputation = Number(social.声望 || 0) || 0;
    const controlling = String(node?.掌控势力 || '').split(/[、/,，；;]/).map(item => item.trim()).filter(Boolean);
    const locationFactions = {};
    let locationHighest = 0;
    let locationPriceModifier = 0;
    controlling.forEach(name => {
      const faction = isPlainRecord(factionTable[name]) ? factionTable[name] : {};
      const relation = isPlainRecord(relationTable[name]) ? relationTable[name] : {};
      const level = Math.max(0, Number(faction.权限级 || 0) || 0);
      const identity = String(faction.身份 || '无').trim() || '无';
      const affinity = Math.max(-100, Math.min(100, Number(relation.好感度 || 0) || 0));
      const relationText = String(relation.关系 || '').trim();
      const relationshipModifier = /敌对|仇恨|厌恶/.test(relationText) ? 0.02 : /友好|信任|亲密|盟友/.test(relationText) ? -0.01 : 0;
      const identityModifier = identity !== '无' && level > 0 ? -0.01 : 0;
      const priceModifier = Number((identityModifier - Math.min(0.04, level * 0.008) - affinity * 0.0001 + relationshipModifier).toFixed(4));
      locationHighest = Math.max(locationHighest, level);
      locationPriceModifier += priceModifier;
      locationFactions[name] = {
        身份: identity,
        权限级: level,
        关系: relationText || '未记录',
        好感度: affinity,
        价格修正: priceModifier,
      };
    });
    if (controlling.length) locationPriceModifier /= controlling.length;
    const reputationModifier = -Math.max(-1000, Math.min(1000, reputation)) / 10000;
    const priceMultiplier = Number(Math.max(0.85, Math.min(1.15, (1 + reputationModifier) * (1 + locationPriceModifier))).toFixed(4));
    return {
      主身份: String(social.主身份 || '无'),
      声望: reputation,
      势力: factions,
      掌控势力: controlling,
      最高权限级: highest,
      当前地点势力: locationFactions,
      当前地点最高权限级: locationHighest,
      修正: { 价格倍率: priceMultiplier, 来源: controlling.length ? '声望+当前掌控势力社交记录' : '声望' },
    };
  }

  function requiredWorldFacilityGroups(actionType) {
    const text = String(actionType || '').trim().toLowerCase();
    if (/auction|bid|拍卖|竞拍/.test(text)) return [['拍卖']];
    if (/private|私下/.test(text) && !/black[_-]?market|黑市/.test(text)) return [];
    if (/black[_-]?market|黑市/.test(text)) return [['黑市']];
    if (/trade|buy|sell|交易|购买|出售/.test(text)) return [['商业']];
    const isTravel = /travel|move|移动|前往|赶往|抵达|出发|启程|赶路|去往/.test(text);
    const isPublicTransport = /列车|地铁|公交|航班|飞船客运|客运飞船|渡船|轮渡|公共交通|校车|短驳|火车|train|subway|metro|bus|flight|ferry|passenger[\s_-]*ship|space[\s_-]*(flight|shuttle)/.test(text);
    const isPrivateTransport = /自有|自驾|私人|private|personal|own/.test(text);
    if (isTravel && isPublicTransport && !isPrivateTransport) return [['交通']];
    if (/profession|craft|副职业|工坊|锻造|制造|设计|修理|维修/.test(text)) {
      if (/锻造/.test(text)) return [['锻造']];
      if (/修理|维修/.test(text)) return [['工业', '锻造']];
      return [['工业', '锻造']];
    }
    return [];
  }

  function actionUsesSoulPower(actionType) {
    return /冥想|修炼|魂核|魂力|soul/.test(String(actionType || '').trim().toLowerCase());
  }

  function collectEnvironmentSourceTags(environmentRules = {}) {
    const tags = [];
    const seen = new WeakSet();
    const visit = value => {
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (!isPlainRecord(value) || seen.has(value)) return;
      seen.add(value);
      ['来源标签', '防护来源标签'].forEach(field => {
        const values = Array.isArray(value[field]) ? value[field] : [value[field]];
        values.forEach(item => {
          const tag = String(item || '').trim();
          if (tag && !tags.includes(tag)) tags.push(tag);
        });
      });
      Object.values(value).forEach(visit);
    };
    visit(environmentRules);
    return tags;
  }

  function isFormalSoulPowerProtectionEffect(effect = {}) {
    const prototype = String(effect.原型 || '').trim();
    const state = String(effect.状态 || '').trim();
    if (prototype === '状态施加' && /无视异常|环境免疫/.test(state)) return true;
    const ruleText = [effect.规则, effect.防御对象, effect.环境规则, effect.防护对象]
      .map(value => String(value || '').trim())
      .filter(Boolean)
      .join(' ');
    if (prototype === '规则防御' && /环境免疫|环境防护|魂力限制|魂力禁用|异常免疫/.test(ruleText)) return true;
    if (prototype === '结算修正' && /环境免疫|环境防护|魂力限制解除|魂力禁用解除/.test(`${ruleText} ${String(effect.结算 || '').trim()}`)) return true;
    return false;
  }

  function readSoulPowerProtection(character = {}, environmentRules = {}) {
    const environmentTags = collectEnvironmentSourceTags(environmentRules);
    if (!environmentTags.length) return { 来源: '' };
    const consumer = runtimeWindows()
      .map(current => current && current.__LWCS_ITEM_PASSIVE_CONSUMER_V1__)
      .find(value => value && typeof value.编译角色装备被动消费者_V1 === 'function');
    if (!consumer) return { 来源: '' };
    let packageValue;
    try {
      packageValue = consumer.编译角色装备被动消费者_V1(character);
    } catch (_) {
      return { 来源: '' };
    }
    const effectEntries = [
      ...(Array.isArray(packageValue?.常驻效果) ? packageValue.常驻效果 : []),
      ...(Array.isArray(packageValue?.动作效果) ? packageValue.动作效果 : []),
      ...(Array.isArray(packageValue?.非战斗路由) ? packageValue.非战斗路由 : []),
    ];
    for (const entry of effectEntries) {
      const effect = isPlainRecord(entry?.效果) ? entry.效果 : null;
      if (!effect) continue;
      if (!isFormalSoulPowerProtectionEffect(effect)) continue;
      const restrictions = Array.isArray(effect.限定来源)
        ? effect.限定来源.map(value => String(value || '').trim()).filter(Boolean)
        : [String(effect.限定来源 || '').trim()].filter(Boolean);
      const matched = restrictions.find(tag => environmentTags.includes(tag));
      if (matched) return { 来源: matched };
    }
    return { 来源: '' };
  }

  function readWorldActionState(character, dataRoot, characterKey, actionType, currentTick) {
    const blockers = [];
    const warnings = [];
    const state = isPlainRecord(character?.状态) ? character.状态 : {};
    const effects = isPlainRecord(character?.属性?.状态效果) ? character.属性.状态效果 : {};
    const tokens = [];
    const collect = table => Object.entries(table).forEach(([key, value]) => {
      tokens.push(key);
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') tokens.push(String(value));
      else if (isPlainRecord(value)) ['状态', '名称', '描述', '类型'].forEach(field => {
        if (value[field] !== undefined) tokens.push(String(value[field]));
      });
    });
    collect(state);
    Object.entries(effects).forEach(([key, value]) => {
      const endTick = Number(value?.结束tick);
      if (Number.isFinite(endTick) && endTick > 0 && currentTick !== null && currentTick >= endTick) return;
      collect({ [key]: value });
    });
    const text = tokens.join('|');
    const actionText = String(actionType || '').trim().toLowerCase();
    const battleAction = /battle|combat|战斗|切磋/.test(actionText);
    const restAction = /休息|睡眠|休养/.test(actionText);
    const worldBattle = isPlainRecord(dataRoot?.world?.战斗) && dataRoot.world.战斗.进行中 === true;
    let characterInBattle = /战斗中|战斗状态|交战/.test(text);
    if (worldBattle) {
      const participants = [
        ...(Array.isArray(dataRoot.world.战斗.参战者?.team_player) ? dataRoot.world.战斗.参战者.team_player : []),
        ...(Array.isArray(dataRoot.world.战斗.参战者?.team_enemy) ? dataRoot.world.战斗.参战者.team_enemy : []),
      ];
      characterInBattle = characterInBattle || !participants.length || participants.some(item => {
        const name = String(item?.name || item?.名称 || item?.charKey || '').trim();
        return name && [characterKey, character?.姓名, character?.名称].map(value => String(value || '').trim()).includes(name);
      });
    }
    if (state.存活 === false || /昏迷|失去意识|无法行动|死亡|濒死/.test(text)) blockers.push('角色当前状态无法行动');
    if (/休息|睡眠|休养/.test(text) && !restAction) blockers.push('角色当前处于休息状态');
    if (characterInBattle && !battleAction) blockers.push('角色当前处于战斗状态');
    if (/执行职务|执勤|值勤|上课|授课|工作中/.test(text)) warnings.push('角色当前正在执行职务，行动可能需要先完成或中断当前事务');
    if (actionUsesSoulPower(actionType) && /禁魔|魂力禁用|魂力禁止/.test(text)) blockers.push('角色当前状态禁止调用魂力');
    return { blockers, warnings, tokens: Array.from(new Set(tokens)).slice(0, 12) };
  }

  function buildWorldFacilityTable(view, eraId, time, permissions, terrainProfile) {
    const rules = view?.worldRules || {};
    const functions = Array.isArray(rules.功能档案) ? rules.功能档案 : [];
    const overrides = isPlainRecord(rules.覆盖?.设施) ? rules.覆盖.设施 : {};
    const area = String(rules.区域档案 || '').trim();
    const areaCap = LOCATION_REGION_PROFILES[area]?.设施上限 || LOCATION_TERRAIN_PROFILES[area]?.设施上限 || terrainProfile?.设施上限 || 1;
    const eraCap = ERA_FACILITY_CAPS[eraId] || ERA_FACILITY_CAPS.current;
    const output = {};
    functions.forEach(functionName => {
      const profile = LOCATION_FUNCTION_PROFILES[functionName];
      if (!profile) return;
      const override = isPlainRecord(overrides[functionName]) ? overrides[functionName] : {};
      const defaultLevel = Math.max(0, Number(profile.默认等级 || 0));
      const requestedLevel = override.等级 === undefined ? defaultLevel : Math.max(0, Number(override.等级 || 0));
      const level = Math.max(0, Math.min(eraCap, areaCap, requestedLevel));
      const opening = String(override.开放时段 || profile.开放时段);
      const minimumPermission = Math.max(0, Number(override.最低权限级 || 0) || 0);
      const open = isOpeningRangeAvailable(parseOpeningWindow(opening), time?.日内分钟, Number(time?.持续tick || 0) * MINUTES_PER_TICK);
      const permission = permissions.当前地点最高权限级 >= minimumPermission;
      output[functionName] = {
        功能: functionName,
        等级: level,
        开放时段: opening,
        最低权限级: minimumPermission,
        可用: level > 0 && open && permission,
        ...(level <= 0 ? { 原因: '设施等级不足' } : !open ? { 原因: '当前时段未营业' } : !permission ? { 原因: '权限不足' } : {}),
      };
    });
    return output;
  }

  function collectNearbyWorldFacilities(library, view, eraId, time, permissions, terrainProfile) {
    const paths = [];
    const path = Array.isArray(view?.path) ? view.path : [];
    for (let depth = 1; depth < path.length; depth += 1) {
      const selected = selectLocationRecordByPath(library, path.slice(0, depth));
      if (selected) paths.push({ path: path.slice(0, depth), record: selected.record });
    }
    if (view?.dynamic && view.parent?.path?.length) {
      const selected = selectLocationRecordByPath(library, view.parent.path);
      if (selected && !paths.some(item => pathKey(item.path) === pathKey(view.parent.path))) paths.push({ path: view.parent.path, record: selected.record });
    }
    const output = [];
    paths.forEach(({ path: parentPath, record }) => {
      const parentView = { worldRules: record.世界规则, node: record.节点, path: parentPath, name: record.规范名 };
      const table = buildWorldFacilityTable(parentView, eraId, time, permissions, terrainProfile);
      Object.values(table).forEach(facility => {
        output.push({ 地点: parentPath.join('-'), 功能: facility.功能, 等级: facility.等级, 开放时段: facility.开放时段, 需移动: true, 可用: false });
      });
    });
    return output;
  }

  function resolveWorldActionContext(options = {}) {
    const dataRoot = isPlainRecord(options.dataRoot) ? options.dataRoot : {};
    const characterKey = String(options.characterKey || '').trim();
    const actionType = String(options.actionType || '').trim();
    const character = characterKey && isPlainRecord(dataRoot.char?.[characterKey]) ? dataRoot.char[characterKey] : null;
    const durationTicks = Number.isFinite(Number(options.durationTicks)) ? Math.max(0, Math.round(Number(options.durationTicks) * 10) / 10) : 0;
    const time = buildWorldActionTime(dataRoot, durationTicks);
    const warnings = [];
    const blockers = [];
    if (!character) blockers.push('角色未在dataRoot.char中创建');
    if (time.tick === null) blockers.push('世界时间不可读');

    let selection = null;
    let library = null;
    try {
      selection = resolveEraLibrary(options.library, 'location', { dataRoot, absoluteTick: time.tick === null ? undefined : time.tick });
      library = selection.library;
    } catch (error) {
      selection = { status: 'failed', eraId: null, resourceStatus: 'failed', detail: error?.message || String(error) };
    }
    const era = {
      id: selection?.eraId || null,
      status: selection?.status || 'unavailable',
      resourceStatus: selection?.resourceStatus || 'unavailable',
      selector: selection?.diagnostic?.selector || null,
      narrativeEra: selection?.diagnostic?.narrativeEra || null,
      resourceEra: selection?.diagnostic?.resourceEra || selection?.eraId || null,
    };
    if (!library) {
      const reason = selection?.detail || '地点库未就绪';
      blockers.push(`地点资源不可用：${reason}`);
      warnings.push('地点世界规则未加载，无法安全结算动作条件');
    }

    const currentLocation = character ? String(character.状态?.位置 || '').trim() : '';
    const currentPath = normalizeLocationPath(currentLocation);
    const targetText = String(options.targetLocation || '').trim();
    const currentView = library && currentLocation ? resolveWorldLocationView(dataRoot, library, currentLocation, currentPath) : null;
    const targetView = library && targetText ? resolveWorldLocationView(dataRoot, library, targetText, currentPath) : null;
    const isTravelAction = /travel|move|移动|前往|赶往|抵达|出发|启程|赶路|去往/.test(actionType.toLowerCase());
    const activeView = isTravelAction ? currentView || targetView : targetView || currentView;
    const facilityView = isTravelAction ? currentView || targetView : activeView;
    const terrainView = isTravelAction ? targetView || currentView : activeView;
    const location = {
      current: currentView,
      target: targetText ? targetView || { resolved: false, name: targetText, path: normalizeLocationPath(targetText) } : null,
      active: activeView,
      moved: false,
    };
    if (character && currentLocation && !currentView) warnings.push(`当前位置未在地点库解析：${currentLocation}`);
    if (targetText && !targetView) {
      if (/travel|移动|前往|抵达|赶路/.test(actionType) && currentView) warnings.push(`目标地点待创建动态节点：${targetText}`);
      else blockers.push(`目标地点未解析：${targetText}`);
    }
    if (!activeView && character) blockers.push('当前动作没有可解析的地点');
    const actionState = character
      ? readWorldActionState(character, dataRoot, characterKey, actionType, time.tick)
      : { blockers: [], warnings: [], tokens: [] };
    blockers.push(...actionState.blockers);
    warnings.push(...actionState.warnings);

    const terrainName = inferWorldTerrain(terrainView || currentView);
    const terrainProfile = LOCATION_TERRAIN_PROFILES[terrainName] || { 设施上限: 1, 危险等级: 0, 探索难度: 30, 修炼环境: { 魂力倍率: 1, 精神力倍率: 1, 生命力倍率: 1 } };
    const terrain = {
      区域档案: activeView?.worldRules?.区域档案 || '平原',
      自然档案: terrainName,
      路径: terrainView?.path || [],
      来源: terrainView?.worldRules?.区域档案 === terrainName ? '地点规则' : '地点规则+自然档案',
    };
    const permissions = readWorldPermissions(character || {}, facilityView?.node || {});
    const facilities = facilityView ? buildWorldFacilityTable(facilityView, era.id || 'current', time, permissions, terrainProfile) : {};
    const nearbyFacilities = library && facilityView ? collectNearbyWorldFacilities(library, facilityView, era.id || 'current', time, permissions, terrainProfile) : [];
    const coverage = isPlainRecord(terrainView?.worldRules?.覆盖) ? terrainView.worldRules.覆盖 : {};
    const environmentRules = isPlainRecord(coverage.环境规则) ? coverage.环境规则 : {};
    const trainingRule = isPlainRecord(coverage.修炼环境) ? coverage.修炼环境 : {};
    const facilityForTraining = ['学院', '资源']
      .map(name => facilities[name])
      .filter(item => item && item.可用)
      .sort((left, right) => right.等级 - left.等级)[0] || null;
    const facilityMultiplier = facilityForTraining ? 1 + Math.max(0, facilityForTraining.等级 - 3) * 0.05 : 1;
    const cultivationModifiers = {
      魂力: Number(Math.max(0.1, Number(trainingRule.魂力倍率 ?? terrainProfile.修炼环境.魂力倍率 ?? 1) * facilityMultiplier).toFixed(4)),
      精神力: Number(Math.max(0.1, Number(trainingRule.精神力倍率 ?? terrainProfile.修炼环境.精神力倍率 ?? 1)).toFixed(4)),
      生命力: Number(Math.max(0.1, Number(trainingRule.生命力倍率 ?? terrainProfile.修炼环境.生命力倍率 ?? 1)).toFixed(4)),
      ...(facilityForTraining ? { 设施: facilityForTraining.功能, 设施等级: facilityForTraining.等级 } : {}),
    };
    const terrainDanger = Math.max(0, Math.min(5, Number(terrainProfile.危险等级 || 0)));
    const terrainDifficulty = Math.max(30, Math.min(90, Number(terrainProfile.探索难度 || 30)));
    const dangerDelta = Math.max(0, terrainDanger - 1);
    const difficultyDelta = Math.max(0, terrainDifficulty - 30);
    const travelModifiers = terrainName === '平原'
      ? { 耗时倍率: 1, 体力倍率: 1 }
      : {
          耗时倍率: Number(Math.max(1, Math.min(1.3, 1 + dangerDelta * 0.04 + difficultyDelta * 0.001)).toFixed(4)),
          体力倍率: Number(Math.max(1, Math.min(1.5, 1 + dangerDelta * 0.06 + difficultyDelta * 0.0015)).toFixed(4)),
        };
    const 原始魂力禁用 = environmentRules.魂力可用 === false || environmentRules.魂力动作 === '禁止';
    const 魂力保护 = readSoulPowerProtection(character || {}, environmentRules);
    const soulPowerAvailable = !原始魂力禁用 || Boolean(魂力保护.来源);
    const temporaryRuleSource = Array.isArray(options.temporaryRuleIds)
      ? options.temporaryRuleIds
      : dataRoot?.world?.战斗?.环境?.临时规则ID;
    const temporaryRuleIds = Array.from(new Set((Array.isArray(temporaryRuleSource) ? temporaryRuleSource : []).map(item => String(item || '').trim()).filter(Boolean)));
    const modifiers = {
      修炼: cultivationModifiers,
      旅行: travelModifiers,
      技能: {
        魂力可用: soulPowerAvailable,
        魂力动作: soulPowerAvailable ? '允许' : '禁止',
        原始禁用: 原始魂力禁用,
        有效可用: soulPowerAvailable,
        保护来源: 魂力保护.来源 || '无',
      },
      价格: { 倍率: permissions.修正.价格倍率 },
      探索: { 标准难度: Math.max(10, Math.min(90, Number(terrainProfile.探索难度 || 30) + Number(terrainProfile.危险等级 || 0) * 3)) },
      战斗: { 临时规则ID: temporaryRuleIds, 环境规则: clone(environmentRules) },
      状态: actionState.tokens,
    };
    const hazards = [];
    if (Number(terrainProfile.危险等级 || 0) > 0) hazards.push({ 类型: '自然环境', 名称: terrainName, 等级: terrainProfile.危险等级 });
    if (isPlainRecord(coverage.危险)) hazards.push({ 类型: '地点危险', ...clone(coverage.危险) });
    Object.entries(environmentRules).forEach(([ruleId, rule]) => {
      const ruleText = `${ruleId} ${isPlainRecord(rule) ? Object.values(rule).join(' ') : String(rule || '')}`;
      if (!/(危险|攻击|威压|压迫|潮汐|暴露|伤害|毒|重力|辐射|风暴|缺氧|高温|低温|寒冷)/.test(ruleText)) return;
      hazards.push({ 规则ID: ruleId, 类型: '环境危险', ...(isPlainRecord(rule) ? clone(rule) : { 值: rule }) });
    });
    hazards.filter(item => Number(item.等级 || 0) >= 3).forEach(item => warnings.push(`环境危险：${item.名称 || item.规则ID || item.类型}（等级${item.等级}）`));
    nearbyFacilities.forEach(item => warnings.push(`附近有${item.功能}设施，但需要移动至${item.地点}`));

    const requiredGroups = requiredWorldFacilityGroups(actionType);
    requiredGroups.forEach(group => {
      const available = group.map(name => facilities[name]).find(item => item?.可用);
      if (available) return;
      const existing = group.map(name => facilities[name]).filter(Boolean);
      blockers.push(existing.length ? `当前地点${group.join('/')}设施不可用：${existing.map(item => item.原因 || '条件不满足').join('、')}` : `当前地点缺少${group.join('/')}设施`);
    });
    if (!soulPowerAvailable && actionUsesSoulPower(actionType)) blockers.push('当前环境禁止调用魂力');

    const resources = {
      标签: coverage.资源 === undefined ? [] : clone(coverage.资源),
      可用: true,
      库存来源: Object.keys(activeView?.node?.商店 || {}),
    };
    const market = {
      经济状况: activeView?.node?.经济状况 || '未知',
      商店: Object.keys(activeView?.node?.商店 || {}),
      价格倍率: permissions.修正.价格倍率,
    };
    const visibleFacility = Object.values(facilities).filter(item => item.可用).map(item => `${item.功能}Lv${item.等级}`).slice(0, 3).join('、') || '无';
    const visibleHazard = hazards.map(item => item.名称 || item.规则ID || item.类型).filter(Boolean).slice(0, 2).join('、') || '无';
    modifiers.投影 = `地点：${activeView?.path?.join('-') || currentLocation || '未知'}；时段：${time.日期 ? `${time.日期.时}时${time.日期.分}分` : '未知'}；设施：${visibleFacility}；风险：${visibleHazard}；魂力：${soulPowerAvailable ? '可用' : '禁用'}。`;
    const dedupe = list => Array.from(new Set(list.map(item => String(item || '').trim()).filter(Boolean)));
    return freezeDeep({
      era,
      time,
      location,
      terrain,
      hazards,
      facilities,
      nearbyFacilities,
      resources,
      market,
      permissions,
      modifiers,
      blockers: dedupe(blockers),
      warnings: dedupe(warnings),
    });
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
    resolveWorldActionContext,
    resolveIdentity,
  });

  const existing = global.__LWCS_LIBRARY_DATA_RUNTIME_V1__;
  if (existing && existing.version !== VERSION) throw new Error(`LibraryData_Runtime版本不符: ${existing.version}`);
  const runtime = existing ? Object.freeze({ ...existing, ...API }) : API;
  global.__LWCS_LIBRARY_DATA_RUNTIME_V1__ = runtime;
  if (!global.__LWCS_LIBRARY_DATA_RUNTIME_LOADING_V1__ || typeof global.__LWCS_LIBRARY_DATA_RUNTIME_LOADING_V1__.then !== 'function') {
    global.__LWCS_LIBRARY_DATA_RUNTIME_LOADING_V1__ = Promise.resolve(runtime);
  }
  try { if (global.parent && global.parent !== global) global.parent.__LWCS_LIBRARY_DATA_RUNTIME_V1__ = runtime; } catch (error) {}
  try { if (global.top && global.top !== global) global.top.__LWCS_LIBRARY_DATA_RUNTIME_V1__ = runtime; } catch (error) {}
})(typeof globalThis !== 'undefined' ? globalThis : window);

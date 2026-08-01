!(function (global) {
  'use strict';

const VERSION = '1.0.0';
  const MINUTES_PER_DAY = 24 * 60;
  const DAYS_PER_MONTH = 30;
  const MONTHS_PER_YEAR = 12;
  const MINUTES_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR * MINUTES_PER_DAY;
  const MINUTES_PER_TICK = 10;
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
  const PROFILES = Object.freeze({
    dldl: Object.freeze({ id: 'dldl', startYear: 0, epoch: '斗罗历0年1月1日00时00分' }),
    jueshitangmen: Object.freeze({ id: 'jueshitangmen', startYear: 10000, epoch: '斗罗历10000年1月1日00时00分' }),
    current: Object.freeze({ id: 'current', startYear: 20000, epoch: '斗罗历20000年1月1日00时00分' }),
    zjdl: Object.freeze({ id: 'zjdl', startYear: 30000, epoch: '斗罗历30000年1月1日00时00分' }),
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
    const minutes = dateToMinutes(date) - profile.startYear * MINUTES_PER_YEAR;
    if (minutes < 0) fail('DATE_BEFORE_EPOCH', profileId, path, value, '日期早于profile起点');
    if (!Number.isSafeInteger(minutes)) fail('TICK_INVALID', profileId, path, value, '日期无法转换为安全tick');
    return minutes / MINUTES_PER_TICK;
  }

  function fromTick(value, profileId, path = '$') {
    const profile = assertProfile(profileId);
    const tick = Number(value);
    if (!Number.isFinite(tick) || tick < 0 || !Number.isInteger(tick * 10)) fail('TICK_INVALID', profileId, path, value, 'tick必须是非负0.1精度数值');
    const totalMinutes = Math.round(tick * MINUTES_PER_TICK);
    let remainder = totalMinutes;
    const year = profile.startYear + Math.floor(remainder / MINUTES_PER_YEAR);
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
    const output = {};
    Object.keys(value).forEach(key => {
      const childPath = `${path}.${key}`;
      output[key] = compileItemDurations(value[key], profileId, childPath);
      const derivedKey = DURATION_FIELDS[key];
      if (derivedKey && value[key] !== null && value[key] !== undefined) output[derivedKey] = durationToTicks(value[key], profileId, childPath);
    });
    return output;
  }

  function compileCharacterLibrary(source, profileId) {
    assertProfile(profileId);
    if (!source || typeof source !== 'object') fail('REFERENCE_UNRESOLVED', profileId, '$', source, '角色库不是对象');
    assertAuthorSource(source, profileId);
    const output = compileDates(clone(source), profileId);
    output.每年tick = MINUTES_PER_YEAR / MINUTES_PER_TICK;
    if (!output.角色 || typeof output.角色 !== 'object') fail('REFERENCE_UNRESOLVED', profileId, '$.角色', output.角色, '角色库缺少角色表');
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
    const output = compileDates(clone(source), profileId);
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
    return freezeDeep(walk(output, '$'));
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

  function resolveLibraryValue(library, type) {
    if (library) return type === 'faction' ? (compiledFactionMeta.has(library) ? library : compileFactionLibrary(library)) : (compiledLocationMeta.has(library) ? library : compileLocationLibrary(library));
    const globalName = type === 'faction' ? '__LWCS_内置势力库__' : '__LWCS_内置地点库__';
    const current = type === 'faction' ? defaultFactionLibrary : defaultLocationLibrary;
    const source = current || global[globalName];
    if (!source) return null;
    return type === 'faction' ? (compiledFactionMeta.has(source) ? source : compileFactionLibrary(source)) : (compiledLocationMeta.has(source) ? source : compileLocationLibrary(source));
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

  function resolveFaction(nameOrAlias, options = {}) {
    const library = resolveLibraryValue(options.library, 'faction');
    if (!library) return { status: 'unresolved', canonicalName: null, candidates: [], reason: 'library-missing' };
    const meta = compiledFactionMeta.get(library);
    const name = String(nameOrAlias && typeof nameOrAlias === 'object' ? (nameOrAlias.规范名 || nameOrAlias.name || nameOrAlias.名称 || '') : nameOrAlias || '').trim();
    if (!name) return { status: 'unresolved', canonicalName: null, candidates: [], reason: 'empty-query' };
    if (meta.names.has(name)) return { status: 'resolved', canonicalName: name, candidates: [name], reason: 'exact-name' };
    if (meta.aliases.has(name)) return { status: 'resolved', canonicalName: meta.aliases.get(name), candidates: [meta.aliases.get(name)], reason: 'alias' };
    if (options.allowKeyword && meta.keywords.has(name)) {
      const candidates = Array.from(new Set(meta.keywords.get(name)));
      if (candidates.length === 1) return { status: 'resolved', canonicalName: candidates[0], candidates, reason: 'keyword' };
      return { status: 'conflict', canonicalName: null, candidates, reason: 'keyword' };
    }
    return { status: 'unresolved', canonicalName: null, candidates: [], reason: 'not-found' };
  }

  function resolveLocation(nameOrAlias, currentPath = [], options = {}) {
    if (currentPath && !Array.isArray(currentPath) && typeof currentPath === 'object') {
      options = currentPath;
      currentPath = options.currentPath || [];
    }
    const library = resolveLibraryValue(options.library, 'location');
    if (!library) return { status: 'unresolved', recordId: null, candidates: [], reason: 'library-missing' };
    const meta = compiledLocationMeta.get(library);
    const recordId = String(nameOrAlias && typeof nameOrAlias === 'object'
      ? (nameOrAlias.记录ID || '')
      : nameOrAlias || '').trim();
    const explicitRecordId = nameOrAlias && typeof nameOrAlias === 'object' && !!recordId;
    if (explicitRecordId && Object.prototype.hasOwnProperty.call(library.地点, recordId)) {
      const record = library.地点[recordId];
      return { status: 'resolved', recordId, canonicalName: record.规范名, path: record.目标路径, candidates: [recordId], reason: 'record-id' };
    }
    const query = String(nameOrAlias && typeof nameOrAlias === 'object' ? (nameOrAlias.规范名 || nameOrAlias.name || nameOrAlias.名称 || '') : nameOrAlias || '').trim();
    if (!query) return { status: 'unresolved', recordId: null, candidates: [], reason: 'empty-query' };
    const normalizedCurrentPath = Array.isArray(currentPath) ? currentPath : [];
    const pathCandidates = meta.paths.get(pathKey(normalizedCurrentPath)) || [];
    if (!explicitRecordId && pathCandidates.length && (query === normalizedCurrentPath.join('-') || query === normalizedCurrentPath.join('/') || query === normalizedCurrentPath[normalizedCurrentPath.length - 1])) {
      if (pathCandidates.length > 1) return { status: 'conflict', recordId: null, candidates: pathCandidates, reason: 'path' };
      return { status: 'resolved', recordId: pathCandidates[0], canonicalName: library.地点[pathCandidates[0]].规范名, path: library.地点[pathCandidates[0]].目标路径, candidates: pathCandidates, reason: 'path' };
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
      return { status: 'resolved', recordId: candidates[0], canonicalName: record.规范名, path: record.目标路径, candidates, reason };
    }
    if (candidates.length > 1) return { status: 'conflict', recordId: null, candidates, reason };
    if (recordId && Object.prototype.hasOwnProperty.call(library.地点, recordId)) {
      const record = library.地点[recordId];
      return { status: 'resolved', recordId, canonicalName: record.规范名, path: record.目标路径, candidates: [recordId], reason: 'record-id' };
    }
    return { status: 'unresolved', recordId: null, candidates: [], reason: 'not-found' };
  }

  function collectLibraryHits(text, type, options = {}) {
    const library = resolveLibraryValue(options.library, type);
    if (!library || typeof text !== 'string' || !text.trim()) return { status: 'unresolved', hits: [], conflicts: [], reason: library ? 'empty-text' : 'library-missing' };
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
    return { status: unresolvedConflicts.length ? 'conflict' : (hits.length ? 'resolved' : 'unresolved'), hits, conflicts: unresolvedConflicts };
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
    const library = resolveLibraryValue(options.library, 'faction');
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
    const library = resolveLibraryValue(options.library, 'location');
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
    LibraryContractError,
    parseDateTime,
    formatDateTime,
    toTick,
    fromTick,
    durationToTicks,
    compileCharacterLibrary,
    compileItemLibrary: (source, profileId) => {
      assertProfile(profileId);
      if (!source || typeof source !== 'object') fail('REFERENCE_UNRESOLVED', profileId, '$', source, '物品库不是对象');
      assertAuthorSource(source, profileId);
      return freezeDeep(compileItemDurations(clone(source), profileId));
    },
    compileTimeline,
    compileFactionLibrary,
    compileLocationLibrary,
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

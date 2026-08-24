(function (root) {
  'use strict';

  const GLOBAL_KEY = '__LWCS_MVU_PROMPT_PROJECTOR_V1__';
  const VERSION = 1;
  if (typeof root[GLOBAL_KEY] === 'function') return;

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

  root[GLOBAL_KEY] = Object.freeze(project);
})(typeof globalThis !== 'undefined' ? globalThis : window);

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
      character: resourceDescriptor('character', { modulePath: './CharacterLibrary.js', loader: 'script-global', globalKey: '__LWCS_内置角色库__', namespace: 'currentCharacterLibrary' }),
      item: resourceDescriptor('item', { modulePath: './ItemLibrary.js', loader: 'script-global', globalKey: '__LWCS_内置物品库__', namespace: 'currentItemLibrary' }),
      faction: resourceDescriptor('faction', { modulePath: './FactionLibrary.js', loader: 'script-global', globalKey: '__LWCS_内置势力库__', metadataGlobalKey: '__LWCS_CURRENT_FACTION_LIBRARY_META_V1__', namespace: 'currentFactionLibrary' }),
      location: resourceDescriptor('location', { modulePath: './LocationLibrary.js', loader: 'script-global', globalKey: '__LWCS_内置地点库__', metadataGlobalKey: '__LWCS_CURRENT_LOCATION_LIBRARY_META_V1__', namespace: 'currentLocationLibrary' }),
      timeline: resourceDescriptor('timeline', { modulePath: './timeline.js', loader: 'dynamic-import', globalKey: '__LWCS_TIMELINE_SOURCE_current__', exportName: 'TimelineEvents', namespace: 'currentTimelineEvents' }),
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

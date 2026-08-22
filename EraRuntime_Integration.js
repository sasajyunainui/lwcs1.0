// 四时代总接线运行时：静态源选择、时间线注册、时代跨越提示与修炼时代渐变。
// 本模块只保留当前页面生命周期内的内存态注册，不写入MVU；业务动作仍由桥接/Schema消费者执行。
!(function (global) {
  'use strict';

  const VERSION = '1.1.0-era-context-20260822';
  const ERA_IDS = Object.freeze(['dldl', 'jueshitangmen', 'current', 'zjdl']);
  const ERA_LABELS = Object.freeze({ dldl: '斗一', jueshitangmen: '斗二', current: '斗三', zjdl: '斗四' });
  const DATA_GLOBAL_KEYS = Object.freeze({
    dldl: Object.freeze({ character: '__DLDL_CHARACTER_LIBRARY__', item: '__LWCS_斗罗大陆物品库__' }),
    jueshitangmen: Object.freeze({ character: '__LWCS_绝世唐门角色库__', item: '__LWCS_绝世唐门物品库__' }),
    current: Object.freeze({ character: '__LWCS_内置角色库__', item: '__LWCS_内置物品库__', faction: '__LWCS_内置势力库__', location: '__LWCS_内置地点库__' }),
    zjdl: Object.freeze({ character: '__LWCS_终极斗罗角色库__', item: '__LWCS_终极斗罗物品库__' }),
  });
  const TIMELINE_GLOBAL_KEYS = Object.freeze({
    dldl: '__LWCS_TIMELINE_SOURCE_dldl__',
    jueshitangmen: '__LWCS_TIMELINE_SOURCE_jueshitangmen__',
    current: '__LWCS_TIMELINE_SOURCE_current__',
    zjdl: '__LWCS_TIMELINE_SOURCE_zjdl__',
  });
  const ABSORPTION_EVENT_ID = '3-3525';

  function 窗口列表() {
    const result = [global];
    try { if (global.parent && global.parent !== global) result.push(global.parent); } catch (_) {}
    try { if (global.top && global.top !== global && !result.includes(global.top)) result.push(global.top); } catch (_) {}
    return result;
  }

  function 读取全局值(key) {
    for (const current of 窗口列表()) {
      try {
        if (current && current[key] !== undefined && current[key] !== null) return current[key];
      } catch (_) {}
    }
    return null;
  }

  function 规范化tick(value) {
    const tick = Number(value);
    if (!Number.isFinite(tick) || tick < 0) throw new Error(`绝对tick无效: ${value}`);
    return tick;
  }

  function 读取库运行时() {
    const runtime = 读取全局值('__LWCS_LIBRARY_DATA_RUNTIME_V1__');
    if (!runtime || runtime.version !== '2.0.0') throw new Error('LibraryData_Runtime 2.0.0 未加载');
    return runtime;
  }

  function 读取数据注册表() {
    const registry = 读取全局值('__LWCS_ERA_DATA_REGISTRY_V1__');
    if (!registry || registry.version !== '1.1.0-era-resource-owner-20260822') throw new Error('EraDataRegistry 未加载');
    return registry;
  }

  function 读取时间线运行时() {
    return 读取全局值('__LWCS_TIMELINE_RUNTIME_V1__');
  }

  function 读取修炼运行时() {
    return 读取全局值('__LWCS_ERA_CULTIVATION_RUNTIME_V1__');
  }

  function 读取时代开场tick(eraId) {
    const runtime = 读取库运行时();
    const descriptor = 读取数据注册表().getEraDataSource(eraId);
    const startYear = Number(descriptor?.startYear);
    const ticksPerYear = Number(runtime.ticksPerYear);
    if (!Number.isFinite(startYear) || !Number.isFinite(ticksPerYear) || startYear < 0 || ticksPerYear <= 0) {
      throw new Error(`无法计算时代开场tick: ${eraId}`);
    }
    return startYear * ticksPerYear;
  }

  const DIRECT_ZJDL_TICK = 读取时代开场tick('zjdl');

  function 读取时代(absoluteTick) {
    const profileId = 读取库运行时().resolveEraAtTick(规范化tick(absoluteTick));
    if (!ERA_LABELS[profileId]) throw new Error(`未知时代profile: ${profileId}`);
    return { eraId: profileId, label: ERA_LABELS[profileId] };
  }

  function 取全局源键(eraId, resourceType) {
    if (resourceType === 'timeline') return TIMELINE_GLOBAL_KEYS[eraId];
    return DATA_GLOBAL_KEYS[eraId]?.[resourceType] || '';
  }

  function 读取正式资源时代(absoluteTick) {
    const tick = 规范化tick(absoluteTick);
    const registry = 读取数据注册表();
    const runtime = 读取库运行时();
    const ticksPerYear = Number(runtime.ticksPerYear);
    return ERA_IDS.slice().reverse().find(eraId => {
      const startYear = Number(registry.getEraDataSource(eraId)?.startYear);
      return Number.isFinite(startYear) && tick >= startYear * ticksPerYear;
    }) || ERA_IDS[0];
  }

  const SOURCE_TABLE = new Map();

  function 注册静态源(eraId, resourceType, source, options = {}) {
    const registry = 读取数据注册表();
    const descriptor = registry.getResourceDescriptor(eraId, resourceType);
    if (descriptor.sourceStatus !== 'configured') {
      return Object.freeze({ status: 'not-configured', eraId, resourceType, detail: descriptor.note || '' });
    }
    if (registry.getResourceState(eraId, resourceType).status === 'disabled') {
      return Object.freeze({ status: 'disabled', eraId, resourceType, detail: registry.getResourceState(eraId, resourceType).detail || '' });
    }
    if (source === undefined || source === null) {
      return Object.freeze({ status: 'failed', eraId, resourceType, detail: '源对象未就绪' });
    }
    const sourceKey = `${eraId}:${resourceType}`;
    const existingSource = SOURCE_TABLE.get(sourceKey);
    if (existingSource && existingSource !== source) {
      return Object.freeze({ status: 'failed', eraId, resourceType, detail: '同一时代资源已注册不同源对象' });
    }
    const timelineRuntime = resourceType === 'timeline' ? 读取时间线运行时() : null;
    if (resourceType === 'timeline') {
      if (!timelineRuntime || typeof timelineRuntime.registerTimelineSource !== 'function') {
        try { registry.setResourceState(eraId, resourceType, 'failed', 'TimelineRuntime未就绪'); } catch (_) {}
        return Object.freeze({ status: 'failed', eraId, resourceType, detail: 'TimelineRuntime未就绪' });
      }
      timelineRuntime.registerTimelineSource(eraId, source);
    }
    SOURCE_TABLE.set(sourceKey, source);
    try { registry.setResourceState(eraId, resourceType, 'loaded', options.detail || 'EraRuntime_Integration'); } catch (_) {}
    return Object.freeze({ status: 'loaded', eraId, resourceType, source });
  }

  function 注册可用源() {
    const registry = 读取数据注册表();
    const result = [];
    ERA_IDS.forEach(eraId => {
      registry.listResourceTypes().forEach(resourceType => {
        const descriptor = registry.getResourceDescriptor(eraId, resourceType);
        if (descriptor.sourceStatus !== 'configured') {
          result.push({ status: 'not-configured', eraId, resourceType, detail: descriptor.note || '' });
          return;
        }
        if (registry.getResourceState(eraId, resourceType).status === 'disabled') {
          result.push({ status: 'disabled', eraId, resourceType, detail: registry.getResourceState(eraId, resourceType).detail || '' });
          return;
        }
        const source = 读取全局值(取全局源键(eraId, resourceType));
        result.push(source === null
          ? { status: registry.getResourceState(eraId, resourceType).status, eraId, resourceType, detail: '源尚未加载' }
          : 注册静态源(eraId, resourceType, source));
      });
    });
    return Object.freeze(result);
  }

  function 获取时代静态源(eraId, resourceType, context = {}) {
    const registry = 读取数据注册表();
    const descriptor = registry.getResourceDescriptor(eraId, resourceType);
    const base = { ...context, eraId, resourceType };
    if (descriptor.sourceStatus !== 'configured') {
      return Object.freeze({ status: 'not-configured', ...base, detail: descriptor.note || '' });
    }
    const state = registry.getResourceState(eraId, resourceType);
    if (state.status !== 'loaded') return Object.freeze({ status: state.status, ...base, detail: state.detail || '' });
    const key = `${eraId}:${resourceType}`;
    if (!SOURCE_TABLE.has(key)) return Object.freeze({ status: 'failed', ...base, detail: '资源状态为loaded但静态源未注册' });
    return Object.freeze({ status: 'resolved', ...base, resourceStatus: 'loaded', source: SOURCE_TABLE.get(key) });
  }

  function 获取静态源(resourceType, absoluteTick) {
    const context = 获取时代上下文(absoluteTick);
    return 获取时代静态源(context.resourceEra, resourceType, context);
  }

  async function 确保时代资源(absoluteTick, resourceTypes, options = {}) {
    const context = 获取时代上下文(absoluteTick, options);
    const resources = await 读取数据注册表().ensureEraResources(context.resourceEra, resourceTypes, options);
    return Object.freeze({ ...context, resources: Object.freeze(resources) });
  }

  function 获取时代跨越(previousTick, currentTick) {
    const previous = 规范化tick(previousTick);
    const current = 规范化tick(currentTick);
    const transitions = 读取库运行时().getEraTransitions(previous, current).map(item => Object.freeze({
      ...item,
      label: ERA_LABELS[item.eraId] || item.eraId,
    }));
    const lines = transitions.map(item => item.direction === 'backward'
      ? `时代回退：已离开${item.label}，时间线回到${item.thresholdYear}年前的阶段。`
      : `时代跨越：${item.label}修炼与世界规则开始生效（斗罗历${item.thresholdYear}年）。`);
    return Object.freeze({
      previousTick: previous,
      currentTick: current,
      transitions: Object.freeze(transitions),
      crossed: transitions.length > 0,
      broadcastText: lines.join('\n'),
    });
  }

  function 获取深渊吸收tick(dataRoot) {
    const timeline = 读取时间线运行时();
    if (!timeline || typeof timeline.getEventState !== 'function' || typeof timeline.getEvent !== 'function') return null;
    try {
      if (timeline.getEventState(dataRoot, ABSORPTION_EVENT_ID) !== 'original') return null;
      const event = timeline.getEvent(ABSORPTION_EVENT_ID);
      const tick = Number(event?.触发tick);
      return Number.isFinite(tick) && tick >= 0 ? tick : null;
    } catch (_) {
      return null;
    }
  }

  function 获取修炼渐变(absoluteTick, options = {}) {
    const tick = 规范化tick(absoluteTick);
    const library = 读取库运行时();
    if (tick >= DIRECT_ZJDL_TICK) return library.getCultivationEraBlend(tick, { directZJDL: true });
    const absorptionTick = 获取深渊吸收tick(options.dataRoot);
    return absorptionTick === null
      ? library.getCultivationEraBlend(tick)
      : library.getCultivationEraBlend(tick, { deepAbyssAbsorptionTick: absorptionTick });
  }

  function 构建修炼选项(absoluteTick, options = {}) {
    const blend = 获取修炼渐变(absoluteTick, options);
    return {
      ...options,
      currentTick: 规范化tick(absoluteTick),
      blend: { current: blend.current, zjdl: blend.zjdl, mode: blend.mode, stage: blend.stage },
    };
  }

  function 获取时代上下文(absoluteTick, options = {}) {
    const tick = 规范化tick(absoluteTick);
    const narrative = 读取时代(tick);
    const resourceEra = 读取正式资源时代(tick);
    const blend = 获取修炼渐变(tick, options);
    return Object.freeze({
      tick,
      narrativeEra: narrative.eraId,
      narrativeLabel: narrative.label,
      resourceEra,
      resourceLabel: ERA_LABELS[resourceEra],
      cultivationBlend: Object.freeze({
        current: Number(blend.current),
        zjdl: Number(blend.zjdl),
        mode: blend.mode,
        stage: Number(blend.stage),
        absorptionTick: blend.absorptionTick ?? null,
      }),
    });
  }

  function 获取运行时诊断() {
    const registry = 读取数据注册表();
    return Object.freeze({
      version: VERSION,
      sourceStatus: Object.freeze(ERA_IDS.flatMap(eraId => registry.listResourceTypes().map(resourceType => {
        const state = registry.getResourceState(eraId, resourceType);
        return Object.freeze({ eraId, resourceType, status: state.status, detail: state.detail || '' });
      }))),
      registeredTimelines: Object.freeze(读取时间线运行时()?.listRegisteredEras?.() || []),
    });
  }

  const API = Object.freeze({
    version: VERSION,
    eraIds: ERA_IDS,
    eraLabels: ERA_LABELS,
    absorptionEventId: ABSORPTION_EVENT_ID,
    directZJDLTick: DIRECT_ZJDL_TICK,
    resolveEraAtTick: 读取时代,
    resolveResourceEraAtTick: 读取正式资源时代,
    getEraContext: 获取时代上下文,
    ensureEraResourcesForTick: 确保时代资源,
    registerSource: 注册静态源,
    registerAvailableSources: 注册可用源,
    getStaticSourceForEra: 获取时代静态源,
    getStaticSource: 获取静态源,
    getEraTransitions: 获取时代跨越,
    getCultivationBlend: 获取修炼渐变,
    buildCultivationOptions: 构建修炼选项,
    getDiagnostics: 获取运行时诊断,
    getRuntime: 读取修炼运行时,
  });

  const globalKey = '__LWCS_ERA_RUNTIME_INTEGRATION_V1__';
  const existing = global[globalKey];
  if (existing && existing.version !== VERSION) throw new Error(`EraRuntime_Integration版本不符: ${existing.version}`);
  const runtime = existing || API;
  global[globalKey] = runtime;
  try { if (global.parent && global.parent !== global) global.parent[globalKey] = runtime; } catch (_) {}
  try { if (global.top && global.top !== global) global.top[globalKey] = runtime; } catch (_) {}
  try { runtime.registerAvailableSources(); } catch (error) { console.warn('[LWCS] 四时代源注册未完成:', error); }
})(typeof globalThis !== 'undefined' ? globalThis : window);

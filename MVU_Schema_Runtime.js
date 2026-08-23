// 从 MVU.js 机械拆分：Schema transform 使用的归一化、派生、实例化与裁剪逻辑。

const DEFAULT_NEW_GAME_TICK_SCHEMA_RUNTIME = 20000 * 51840;

function 读取MVUSchema部件_V1(部件名 = '') {
  const 部件 = globalThis.__LWCS_MVU_SCHEMA_PARTS__?.[部件名];
  if (!部件) throw new Error(`MVU Schema 部件未就绪：${部件名}`);
  return 部件;
}

function 读取时代修炼运行时_ACU() {
  const 候选列表 = [globalThis];
  try { if (globalThis.parent && globalThis.parent !== globalThis) 候选列表.push(globalThis.parent); } catch (错误) {}
  try { if (globalThis.top && globalThis.top !== globalThis) 候选列表.push(globalThis.top); } catch (错误) {}
  return 候选列表
    .map(候选 => 候选 && 候选.__LWCS_ERA_CULTIVATION_RUNTIME_V1__)
    .find(接口 => 接口 && typeof 接口 === 'object') || null;
}

function 应用静态高等级魂核初始化_ACU(char = {}, era = null) {
  if (!char || char.__mvu_isPlayer === true || !era) return false;
  const level = Math.max(0, Math.floor(Number(char.属性?.等级 || 0)));
  const soulPowerSeed = Math.max(0, Math.floor(Number(char.属性?.魂力上限 || 0)));
  if (!(level > 1) || soulPowerSeed > 10) return false;
  const runtime = 读取时代修炼运行时_ACU();
  if (!runtime || typeof runtime.requiredCoreCountForLevel !== 'function') return false;
  const required = Math.max(0, Math.floor(Number(runtime.requiredCoreCountForLevel(era, level) || 0)));
  if (required <= Number(char.魂核?.核心?.数量 || 0)) return false;
  if (!char.魂核 || typeof char.魂核 !== 'object') char.魂核 = {};
  if (!char.魂核.核心 || typeof char.魂核.核心 !== 'object') char.魂核.核心 = { 数量: 0, 进度: 0 };
  char.魂核.核心.数量 = required;
  char.魂核.核心.进度 = 0;
  return true;
}

function 解析角色静态魂核时代_ACU(char = {}, fallbackEra = null) {
  const runtime = 读取时代修炼运行时_ACU();
  if (!runtime || typeof runtime.resolveEra !== 'function') return fallbackEra;
  const hasExplicitEra = !!(char?.属性?.时代 || char?.所属时代 || char?.时代 || char?.所属部 || char?.所属书库 || char?.book || char?.bookId);
  return hasExplicitEra ? runtime.resolveEra(char) : fallbackEra;
}

function 记录角色归一化播报事件_V1(角色名 = '', 文本 = '') {
  if (globalThis.__LWCS_SUPPRESS_SCHEMA_BROADCAST__ === true) return;
  const 内容 = String(文本 || '').trim();
  if (!内容) return;
  if (!Array.isArray(globalThis.__LWCS_SCHEMA_BROADCAST_EVENTS__)) {
    globalThis.__LWCS_SCHEMA_BROADCAST_EVENTS__ = [];
  }
  globalThis.__LWCS_SCHEMA_BROADCAST_EVENTS__.push({
    角色名: String(角色名 || '').trim(),
    文本: 内容,
  });
}

function 取出角色归一化播报事件_V1() {
  const 事件列表 = Array.isArray(globalThis.__LWCS_SCHEMA_BROADCAST_EVENTS__)
    ? globalThis.__LWCS_SCHEMA_BROADCAST_EVENTS__
    : [];
  globalThis.__LWCS_SCHEMA_BROADCAST_EVENTS__ = [];
  return 事件列表;
}

function 读取时代运行时集成_V1() {
  const 候选列表 = [globalThis];
  try { if (globalThis.parent && globalThis.parent !== globalThis) 候选列表.push(globalThis.parent); } catch (错误) {}
  try { if (globalThis.top && globalThis.top !== globalThis) 候选列表.push(globalThis.top); } catch (错误) {}
  return 候选列表.map(候选 => 候选?.__LWCS_ERA_RUNTIME_INTEGRATION_V1__).find(接口 =>
    接口 && typeof 接口.getEraContext === 'function' && typeof 接口.getStaticSource === 'function'
  ) || null;
}

function 读取Schema活动数据根_V1() {
  const 活动根 = globalThis.__LWCS_SCHEMA_ACTIVE_DATA_ROOT_V1__;
  if (活动根 && typeof 活动根 === 'object') return 活动根;
  try {
    const 接口 = globalThis.Mvu;
    const 变量包 = 接口 && typeof 接口.getMvuData === 'function'
      ? 接口.getMvuData({ type: 'message', message_id: 'latest' })
      : null;
    if (变量包?.stat_data && typeof 变量包.stat_data === 'object') return 变量包.stat_data;
    if (变量包?.display_data && typeof 变量包.display_data === 'object') return 变量包.display_data;
    if (变量包 && typeof 变量包 === 'object') return 变量包;
  } catch (错误) {}
  return {};
}

function 读取Schema时代资源_V1(资源类型 = '', 数据根 = null, 当前tick = null) {
  const 集成 = 读取时代运行时集成_V1();
  const 根 = 数据根 && typeof 数据根 === 'object' ? 数据根 : 读取Schema活动数据根_V1();
  const tick = Number(当前tick ?? 根?.world?.时间?.tick);
  if (!集成 || !Number.isFinite(tick) || tick < 0) {
    return { status: 'not-ready', diagnostic: { resourceType: 资源类型, status: 'not-ready', reason: 'era_context_or_tick_unavailable' } };
  }
  try {
    const context = 集成.getEraContext(tick, { dataRoot: 根 });
    const resolved = 集成.getStaticSource(资源类型, context.tick);
    if (resolved.status !== 'resolved') {
      return {
        status: 'not-ready',
        context,
        diagnostic: { resourceType: 资源类型, status: resolved.status, resourceEra: context.resourceEra, detail: resolved.detail || '资源尚未加载' },
      };
    }
    return { status: 'ready', context, source: resolved.source };
  } catch (错误) {
    return { status: 'not-ready', diagnostic: { resourceType: 资源类型, status: 'not-ready', reason: 错误?.message || String(错误 || 'era_context_failed') } };
  }
}

function 创建Schema资源未就绪占位_V1(资源类型, 诊断) {
  const 标记 = { __LWCS_RESOURCE_NOT_READY__: { ...诊断 } };
  if (资源类型 === 'character') return { 版本: 0, 每年tick: 51840, 开场节点: {}, 角色: {}, ...标记 };
  if (资源类型 === 'item') return { ...标记 };
  if (资源类型 === 'faction') return { 版本: 0, 势力: {}, ...标记 };
  if (资源类型 === 'location') return { 版本: 0, 地点: {}, ...标记 };
  return 标记;
}

function 读取内置角色库_V1(数据根 = null, 当前tick = null) {
  const 资源 = 读取Schema时代资源_V1('character', 数据根, 当前tick);
  return 资源.status === 'ready' && 资源.source?.角色 && typeof 资源.source.角色 === 'object'
    ? 资源.source
    : 创建Schema资源未就绪占位_V1('character', 资源.diagnostic || { resourceType: 'character', status: 'not-ready' });
}

function 读取内置物品库_V1(数据根 = null, 当前tick = null) {
  const 资源 = 读取Schema时代资源_V1('item', 数据根, 当前tick);
  return 资源.status === 'ready' && 资源.source && typeof 资源.source === 'object' && !Array.isArray(资源.source)
    ? 资源.source
    : 创建Schema资源未就绪占位_V1('item', 资源.diagnostic || { resourceType: 'item', status: 'not-ready' });
}

function 读取内置势力库_V1(数据根 = null, 当前tick = null) {
  const 资源 = 读取Schema时代资源_V1('faction', 数据根, 当前tick);
  return 资源.status === 'ready' && 资源.source?.势力 && typeof 资源.source.势力 === 'object'
    ? 资源.source
    : 创建Schema资源未就绪占位_V1('faction', 资源.diagnostic || { resourceType: 'faction', status: 'not-ready' });
}

function 读取内置地点库_V1(数据根 = null, 当前tick = null) {
  const 资源 = 读取Schema时代资源_V1('location', 数据根, 当前tick);
  return 资源.status === 'ready' && 资源.source?.地点 && typeof 资源.source.地点 === 'object'
    ? 资源.source
    : 创建Schema资源未就绪占位_V1('location', 资源.diagnostic || { resourceType: 'location', status: 'not-ready' });
}

function 读取库运行时_V1() {
  const 候选列表 = [globalThis];
  try { if (globalThis.parent && globalThis.parent !== globalThis) 候选列表.push(globalThis.parent); } catch (错误) {}
  try { if (globalThis.top && globalThis.top !== globalThis) 候选列表.push(globalThis.top); } catch (错误) {}
  for (const 候选 of 候选列表) {
    const 运行时 = 候选?.__LWCS_LIBRARY_DATA_RUNTIME_V1__;
    if (运行时 && typeof 运行时 === 'object') return 运行时;
  }
  return null;
}

function 记录库缺失错误_V1(类型 = '', 文本 = '') {
  const 键 = `${类型}:${文本}`;
  if (!globalThis.__LWCS_LIBRARY_RUNTIME_ERRORS_V1__) globalThis.__LWCS_LIBRARY_RUNTIME_ERRORS_V1__ = new Set();
  if (globalThis.__LWCS_LIBRARY_RUNTIME_ERRORS_V1__.has(键)) return;
  globalThis.__LWCS_LIBRARY_RUNTIME_ERRORS_V1__.add(键);
  console.error(`[LWCS] ${文本}`);
}

function 记录运行时冷实体发送_V1(实体表 = {}) {
  const 载荷 = [];
  const 添加 = (类型 = '', 名称列表 = []) => {
    Array.from(名称列表 || []).forEach(名称 => {
      const 实体名 = String(名称 || '').trim();
      if (实体名) 载荷.push({ 类型, 名称: 实体名 });
    });
  };
  添加('角色', 实体表.角色);
  添加('动态地点', 实体表.动态地点);
  添加('物品', 实体表.物品);
  if (!载荷.length) return;
  const 窗口列表 = [globalThis];
  try { if (globalThis.parent && globalThis.parent !== globalThis) 窗口列表.push(globalThis.parent); } catch (错误) {}
  try { if (globalThis.top && globalThis.top !== globalThis) 窗口列表.push(globalThis.top); } catch (错误) {}
  for (const 窗口 of 窗口列表) {
    try {
      const 记录函数 = 窗口 && 窗口.__LWCS_RECORD_MVU_COLD_ENTITY_ACTIVATION__;
      if (typeof 记录函数 === 'function') {
        记录函数(载荷);
        return;
      }
    } catch (错误) {}
  }
}

var 古月娜融合成立tick_V1 = DEFAULT_NEW_GAME_TICK_SCHEMA_RUNTIME + 643159;
var 内置角色预备出场窗口tick_V1 = 3 * 30 * 144;

function 是否古月娜融合阶段_V1(当前tick = 0, 数据根 = {}) {
  return Number(当前tick || 0) >= 古月娜融合成立tick_V1 || !!数据根?.char?.古月娜;
}

function 读取内置角色记录_V1(角色名 = '', 当前tick = 0, 数据根 = {}) {
  const 规范名 = 解析内置角色规范名_V1(角色名, 当前tick, 数据根);
  if (!规范名) return null;
  return 读取内置角色库_V1(数据根, 当前tick).角色?.[规范名] || null;
}

function 读取内置角色别名条目_V1() {
  return Object.entries(读取内置角色库_V1().角色 || {})
    .flatMap(([角色名, 角色记录]) => [角色名, ...(Array.isArray(角色记录?.别名) ? 角色记录.别名 : [])]
      .map(别名 => String(别名 || '').trim())
      .filter(别名 => 别名 && 别名.length > 1)
      .map(别名 => ({ 别名, 角色名 })))
    .sort((a, b) => b.别名.length - a.别名.length);
}

function 规范化内置角色命中目标_V1(条目 = {}, 当前tick = 0, 数据根 = {}) {
  if (条目?.角色名 === '古月娜' && !是否古月娜融合阶段_V1(当前tick, 数据根)) {
    return '';
  }
  if (条目?.角色名 === '古月' && 条目?.别名 === '古月' && 是否古月娜融合阶段_V1(当前tick, 数据根) && 读取内置角色库_V1().角色?.古月娜) {
    return '古月娜';
  }
  return String(条目?.角色名 || '').trim();
}

function 内置角色文本命中满足二级关键词_V1(角色名 = '', 文本 = '') {
  const 角色记录 = 读取内置角色库_V1().角色?.[String(角色名 || '').trim()];
  const 二级关键词 = Array.isArray(角色记录?.匹配要求?.二级关键词) ? 角色记录.匹配要求.二级关键词 : [];
  if (!二级关键词.length) return true;
  const 内容 = String(文本 || '');
  return 二级关键词.some(关键词 => {
    const 文本关键词 = String(关键词 || '').trim();
    return 文本关键词 && 内容.includes(文本关键词);
  });
}

function 解析内置角色规范名_V1(名称 = '', 当前tick = 0, 数据根 = {}) {
  const 文本 = String(名称 || '').trim();
  if (!文本) return '';
  const 角色库 = 读取内置角色库_V1();
  if (文本 === '古月' && 是否古月娜融合阶段_V1(当前tick, 数据根) && 角色库.角色?.古月娜) return '古月娜';
  if (文本 === '古月娜' && !是否古月娜融合阶段_V1(当前tick, 数据根)) return '';
  if (角色库.角色?.[文本]) return 文本;
  const 命中 = 读取内置角色别名条目_V1().find(条目 => 条目.别名 === 文本);
  return 命中 ? 规范化内置角色命中目标_V1(命中, 当前tick, 数据根) : '';
}

function 取内置角色最近快照_V1(角色记录 = {}, 当前tick = 0) {
  const 快照列表 = Array.isArray(角色记录?.快照) ? 角色记录.快照 : [];
  if (!快照列表.length) return null;
  const tick = Number(当前tick || 0);
  const 有tick快照 = 快照列表.filter(快照 => Number.isFinite(Number(快照?.tick)));
  if (!有tick快照.length) return 快照列表[0] || null;
  const 开场前向快照 = 取内置角色开场前向快照_V1(角色记录, 有tick快照, tick);
  if (开场前向快照) return 开场前向快照;
  const 之前快照 = 有tick快照.filter(快照 => Number(快照.tick) <= tick).sort((a, b) => Number(b.tick) - Number(a.tick))[0];
  if (之前快照) return 之前快照;
  return 有tick快照.sort((a, b) => Number(a.tick) - Number(b.tick))[0] || 快照列表[0] || null;
}

function 取内置角色指定节点快照_V1(角色记录 = {}, 指定节点 = '') {
  const 节点 = String(指定节点 || '').trim();
  if (!节点) return null;
  return (Array.isArray(角色记录?.快照) ? 角色记录.快照 : []).find(快照 => String(快照?.节点 || '').trim() === 节点) || null;
}

function 读取内置角色节点年龄_V1(节点 = '') {
  const 匹配 = String(节点 || '').match(/(\d+(?:\.\d+)?)\s*岁/);
  const 年龄 = 匹配 ? Number(匹配[1]) : NaN;
  return Number.isFinite(年龄) ? 年龄 : null;
}

function 读取内置角色快照年龄_V1(快照 = {}) {
  const 节点年龄 = 读取内置角色节点年龄_V1(快照?.节点);
  if (节点年龄 !== null) return 节点年龄;
  const 年龄 = Number(快照?.年龄 ?? 快照?.角色?.属性?.年龄);
  return Number.isFinite(年龄) ? 年龄 : null;
}

function 估算内置角色当前投影年龄_V1(快照列表 = [], 当前tick = 0) {
  const 每年tick = Math.max(1, Number(读取内置角色库_V1().每年tick || 51840));
  const 候选 = (Array.isArray(快照列表) ? 快照列表 : [])
    .map(快照 => {
      const 快照tick = Number(快照?.tick);
      const 快照年龄 = Number(快照?.年龄 ?? 快照?.角色?.属性?.年龄);
      if (!Number.isFinite(快照tick) || !Number.isFinite(快照年龄)) return null;
      return {
        距离: Math.abs(Number(当前tick || 0) - 快照tick),
        年龄: Math.max(0, 快照年龄 + (Number(当前tick || 0) - 快照tick) / 每年tick),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.距离 - b.距离);
  return 候选.length ? 候选[0].年龄 : null;
}

function 取内置角色开场前向快照_V1(角色记录 = {}, 快照列表 = [], 当前tick = 0) {
  const 开场节点年龄 = (Array.isArray(角色记录?.开场常驻节点) ? 角色记录.开场常驻节点 : [])
    .map(读取内置角色节点年龄_V1)
    .filter(年龄 => 年龄 !== null)
    .sort((a, b) => a - b);
  if (开场节点年龄.length <= 1) return null;
  const 当前年龄 = 估算内置角色当前投影年龄_V1(快照列表, 当前tick);
  if (当前年龄 === null) return null;
  const 目标节点年龄 = 开场节点年龄.find(年龄 => 年龄 > 当前年龄 + 0.001);
  if (目标节点年龄 === undefined) return null;
  return (Array.isArray(快照列表) ? 快照列表 : [])
    .filter(快照 => Math.abs((读取内置角色快照年龄_V1(快照) ?? -9999) - 目标节点年龄) < 0.001)
    .sort((a, b) => Number(a.tick) - Number(b.tick))[0] || null;
}

function 计算内置角色投影年龄_V1(快照 = {}, 当前tick = 0) {
  const 快照年龄 = Math.max(0, Number(快照?.年龄 ?? 快照?.角色?.属性?.年龄 ?? 0) || 0);
  if (快照?.固定年龄投影 === true) return 快照年龄;
  const 快照tick = Number(快照?.tick);
  if (!Number.isFinite(快照tick)) return 快照年龄;
  const 每年tick = Math.max(1, Number(读取内置角色库_V1().每年tick || 51840));
  return Math.max(0, 快照年龄 + (Number(当前tick || 0) - 快照tick) / 每年tick);
}

function 清理提示审计扫描文本_V1(text = '') {
  return String(text || '').replace(/<scene_audit>[\s\S]*?<\/scene_audit>/gi, ' ');
}

function 匹配文本内置角色名_V1(文本 = '', 当前tick = 0, 数据根 = {}) {
  const 内容 = 清理提示审计扫描文本_V1(文本);
  if (!内容.trim()) return [];
  const 已占用区间 = [];
  const 命中角色 = [];
  读取内置角色别名条目_V1().forEach(条目 => {
    let 起点 = 内容.indexOf(条目.别名);
    while (起点 >= 0) {
      const 终点 = 起点 + 条目.别名.length;
      const 被长别名覆盖 = 已占用区间.some(区间 => 起点 < 区间.终点 && 终点 > 区间.起点);
      if (!被长别名覆盖) {
        const 规范名 = 规范化内置角色命中目标_V1(条目, 当前tick, 数据根);
        if (规范名 && 内置角色文本命中满足二级关键词_V1(规范名, 内容)) {
          已占用区间.push({ 起点, 终点 });
          命中角色.push(规范名);
        }
      }
      起点 = 内容.indexOf(条目.别名, 起点 + 1);
    }
  });
  return Array.from(new Set(命中角色));
}

function 收集当前时间线命中内置角色名_V1(当前tick = 0, 文本 = '', 数据根 = {}) {
  const 命中 = new Set(匹配文本内置角色名_V1(文本, 当前tick, 数据根));
  return Array.from(命中);
}

var 紫极魔瞳境界等级表_V1 = Object.freeze({ 纵观: 1, 入微: 2, 芥子: 3, 浩瀚: 4 });
var 紫极魔瞳精神境界阶位表_V1 = Object.freeze({ 灵元境: 1, 灵通境: 2, 灵海境: 3, 灵渊境: 4, 灵域境: 5, 神元境: 6 });
var 紫极魔瞳三月tick_V1 = 3 * 30 * 144;
var 紫极魔瞳三年tick_V1 = 3 * 51840;
var 紫极魔瞳十年tick_V1 = 10 * 51840;

function 读取紫极魔瞳精神境界阶位_V1(精神境界 = '') {
  return 紫极魔瞳精神境界阶位表_V1[String(精神境界 || '').trim()] || 0;
}

function 按精神力读取紫极魔瞳境界_V1(角色 = {}) {
  const 精神境界 = String(角色?.属性?.精神境界 || '').trim();
  const 精神力上限 = Math.max(0, Math.floor(Number(角色?.属性?.精神力上限 || 0)));
  const 精神阶位 = 读取紫极魔瞳精神境界阶位_V1(精神境界);
  if (精神力上限 >= 20000 || 精神阶位 >= 读取紫极魔瞳精神境界阶位_V1('灵域境')) return '浩瀚';
  if (精神力上限 >= 5000 || 精神阶位 >= 读取紫极魔瞳精神境界阶位_V1('灵渊境')) return '芥子';
  if (精神力上限 >= 50 || 精神阶位 >= 读取紫极魔瞳精神境界阶位_V1('灵通境')) return '入微';
  return '纵观';
}

function 按精神力同步内置角色紫极魔瞳_V1(角色 = {}) {
  const 功法 = 角色?.功法?.['紫极魔瞳'];
  if (!功法 || typeof 功法 !== 'object' || Array.isArray(功法)) return;
  const 境界 = 按精神力读取紫极魔瞳境界_V1(角色);
  功法.境界 = 境界;
  功法.lv = 紫极魔瞳境界等级表_V1[境界];
}

function 角色拥有唐门身份_V1(角色 = {}) {
  const 势力 = 角色?.社交?.势力 && typeof 角色.社交.势力 === 'object' && !Array.isArray(角色.社交.势力) ? 角色.社交.势力 : {};
  const 身份文本 = [角色?.社交?.主身份, ...Object.entries(势力).flatMap(([势力名, 势力数据]) => [势力名, 势力数据?.身份])].join(' ');
  return 身份文本.includes('唐门');
}

function 判断初始唐门紫极魔瞳_V1(角色 = {}, 功法 = {}) {
  return 角色拥有唐门身份_V1(角色) && !Object.prototype.hasOwnProperty.call(功法 || {}, '获得tick');
}

function 构建最新功法记录_V1(功法名 = '', 记录 = {}) {
  const 名称 = String(功法名 || '').trim();
  const 来源 = 记录 && typeof 记录 === 'object' && !Array.isArray(记录) ? 记录 : {};
  const 描述 = String(来源.描述 || 来源.效果描述 || 来源.画面描述 || '无').trim() || '无';
  if (名称 !== '紫极魔瞳') return { 描述 };
  const 境界 = 紫极魔瞳境界等级表_V1[String(来源.境界 || '').trim()] ? String(来源.境界).trim() : '纵观';
  const 输出 = {
    境界,
    lv: 紫极魔瞳境界等级表_V1[境界],
    描述,
  };
  if (Object.prototype.hasOwnProperty.call(来源, '获得tick')) 输出.获得tick = Math.max(0, Math.floor(Number(来源.获得tick || 0)));
  return 输出;
}

function 计算紫极魔瞳境界_V1(角色 = {}, 当前tick = 0) {
  const 功法 = 角色?.功法?.['紫极魔瞳'];
  if (!功法 || typeof 功法 !== 'object' || Array.isArray(功法)) return null;
  if (判断初始唐门紫极魔瞳_V1(角色, 功法)) {
    按精神力同步内置角色紫极魔瞳_V1(角色);
    return 功法;
  }
  const 有获得tick = Object.prototype.hasOwnProperty.call(功法, '获得tick');
  const 已获得tick = Math.max(0, Math.floor(Number(有获得tick ? 功法.获得tick : 当前tick || 0)));
  if (!有获得tick) 功法.获得tick = 已获得tick;
  const 持有tick = Math.max(0, Math.floor(Number(当前tick || 0)) - 已获得tick);
  const 精神阶位 = 读取紫极魔瞳精神境界阶位_V1(角色?.属性?.精神境界);
  let 境界 = '纵观';
  if (持有tick >= 紫极魔瞳十年tick_V1 && 精神阶位 >= 读取紫极魔瞳精神境界阶位_V1('灵域境')) 境界 = '浩瀚';
  else if (持有tick >= 紫极魔瞳三年tick_V1 && 精神阶位 >= 读取紫极魔瞳精神境界阶位_V1('灵渊境')) 境界 = '芥子';
  else if (持有tick >= 紫极魔瞳三月tick_V1 && 精神阶位 >= 读取紫极魔瞳精神境界阶位_V1('灵通境')) 境界 = '入微';
  const 当前境界 = String(功法.境界 || '').trim();
  const 当前等级 = Math.max(0, Number(功法.lv || 0), 紫极魔瞳境界等级表_V1[当前境界] || 0);
  const 结算等级 = 紫极魔瞳境界等级表_V1[境界] || 1;
  if (当前等级 > 结算等级) {
    const 保留境界 = Object.entries(紫极魔瞳境界等级表_V1).find(([, 等级]) => 等级 === Math.min(4, 当前等级))?.[0];
    if (保留境界) 境界 = 保留境界;
  }
  功法.境界 = 境界;
  功法.lv = 紫极魔瞳境界等级表_V1[境界];
  return 功法;
}

function 读取紫极魔瞳精神训练倍率_V1(角色 = {}, 当前tick = 0) {
  const 功法 = 计算紫极魔瞳境界_V1(角色, 当前tick);
  if (!功法) return 1;
  return Number(功法.lv || 1) >= 2 ? 1.1 : 1.05;
}

function 构建紫极神光技能_V1(角色 = {}) {
  const 精神力上限 = Math.max(1, Math.floor(Number(角色?.属性?.精神力上限 || 1)));
  return {
    魂技名: '紫极神光',
    画面描述: '双眸凝出紫金神光，以实质化精神力直刺敌方识海。',
    效果描述: '单体精神攻击，并短暂压制目标反应。',
    承载方式: '直接生效',
    消耗: `精神力:${Math.max(1, Math.floor(精神力上限 * 0.18))}`,
    前摇: 18,
    附带属性: ['精神'],
    _效果数组: [
      { 原型: '伤害结算', 目标: '单体', 生效方式: '独立生效', 威力倍率: 115, 伤害类型: '精神攻击' },
      { 原型: '判定修正', 目标: '单体', 生效方式: '跟随主原型', 判定: '反应', 数值: '-15%', 持续回合: 1 },
    ],
  };
}

function 同步紫极神光技能_V1(角色 = {}, 当前tick = 0) {
  const 功法 = 计算紫极魔瞳境界_V1(角色, 当前tick);
  if (!功法 || 功法.境界 !== '浩瀚') return;
  if (!角色.自创魂技 || typeof 角色.自创魂技 !== 'object' || Array.isArray(角色.自创魂技)) 角色.自创魂技 = {};
  const 已有技能 = 角色.自创魂技['紫极神光'];
  if (已有技能 && typeof 已有技能 === 'object' && !Array.isArray(已有技能)) return;
  角色.自创魂技['紫极神光'] = 读取MVUSchema部件_V1('SkillStructSchema').parse(构建紫极神光技能_V1(角色));
}

var 物品分类列表_V1 = Object.freeze([
  '锻造金属',
  '设计图纸',
  '近战武器',
  '远程武器',
  '战术装备',
  '功能道具',
  '防具装备',
  '斗铠部件',
  '机甲机体',
  '魂骨',
  '魂灵',
  '魂技造物',
  '天然灵物',
  '丹药',
  '身份凭证',
  '入场凭证',
  '修炼秘籍',
  '一次性道具',
  '剧情杂物',
]);
var 物品分类集合_V1 = new Set(物品分类列表_V1);
var 可执行使用效果物品分类集合_V1 = new Set(['丹药', '天然灵物', '近战武器', '远程武器', '战术装备', '功能道具', '一次性道具', '魂技造物', '魂骨']);
var 装备物品分类集合_V1 = new Set(['近战武器', '远程武器', '防具装备', '斗铠部件', '机甲机体', '魂骨']);
if (typeof 结算修正支持字段矩阵_V1 === 'object' && 结算修正支持字段矩阵_V1) {
  结算修正支持字段矩阵_V1 = Object.freeze(Object.fromEntries(
    Object.entries(结算修正支持字段矩阵_V1).map(([结算, 字段列表]) => [
      结算,
      Object.freeze([...new Set([...(Array.isArray(字段列表) ? 字段列表 : []), '对应等级', '转化效果', '增幅上限'])]),
    ]),
  ));
}
var 动态金属块基础金属候选表_V1 = Object.freeze({
  1: Object.freeze(['钢精']),
  2: Object.freeze(['沉银', '钢精']),
  3: Object.freeze(['魔银', '天龙铁', '精金', '千机铜', '幽冥铁']),
  4: Object.freeze(['金晶', '蓝孕铜', '龙鳞沉银', '灵金', '钛晶', '钛金', '星陨铁', '星银', '玉银']),
  5: Object.freeze(['七彩沉银', '金水相涵']),
});
var 物品经济品质列表_V1 = Object.freeze(['普通', '优秀', '稀有', '史诗', '传说', '神器', '超神器']);
var 物品经济品质集合_V1 = new Set(物品经济品质列表_V1);
var 装备加成属性列表_V1 = Object.freeze(['魂力上限', '精神力上限', '力量', '防御', '敏捷', '体力上限']);
var 装备加成方向列表_V1 = Object.freeze([...装备加成属性列表_V1, '全属性']);
var 装备加成方向集合_V1 = new Set(装备加成方向列表_V1);
var 非神器品质等级段表_V1 = Object.freeze({
  普通: Object.freeze([1, 30]),
  优秀: Object.freeze([31, 50]),
  稀有: Object.freeze([51, 70]),
  史诗: Object.freeze([71, 90]),
  传说: Object.freeze([91, 99]),
});
var 装备属性键映射_V1 = Object.freeze({ 魂力上限: 'sp_max', 精神力上限: 'men_max', 力量: 'str', 防御: 'def', 敏捷: 'agi', 体力上限: 'vit_max' });

function 规范化物品分类_V1(分类 = '', fallback = '剧情杂物') {
  const 文本 = String(分类 || '').trim();
  return 物品分类集合_V1.has(文本) ? 文本 : fallback;
}

function 规范化物品经济品质_V1(品质 = '', 物品名 = '', 分类 = '') {
  const 文本 = String(品质 || '').trim();
  if (物品经济品质集合_V1.has(文本)) return 文本;
  const 判定文本 = `${物品名} ${分类} ${文本}`;
  if (/超神器/.test(判定文本)) return '超神器';
  if (/神器/.test(判定文本)) return '神器';
  if (/十万年|天锻|神级金属|十二级|弑神|位面核心|极限斗罗|血脉核心|战略级/.test(判定文本)) return '传说';
  if (/万年|魂锻|灵锻|顶级|机密|高级|重型|最新型|九级|八级/.test(判定文本)) return '史诗';
  if (/千年|千锻|有灵合金|稀有|战术|秘密|特殊|特种|珍贵|军用/.test(判定文本)) return '稀有';
  if (/百年|黄级|优秀|高级制式/.test(判定文本)) return '优秀';
  return '普通';
}

function 读取显式物品基础价格_V1(来源 = {}) {
  const 数据 = 来源 && typeof 来源 === 'object' && !Array.isArray(来源) ? 来源 : {};
  for (const 字段名 of ['基础价格', '价格']) {
    if (!Object.prototype.hasOwnProperty.call(数据, 字段名)) continue;
    const 原值 = 数据[字段名];
    if (原值 === undefined || 原值 === null || (typeof 原值 === 'string' && !原值.trim())) continue;
    const 数值 = Number(原值);
    if (Number.isFinite(数值)) return Math.max(0, Math.floor(数值));
  }
  return undefined;
}

function 判断神器品质_V1(品质 = '') {
  const 文本 = String(品质 || '').trim();
  return 文本 === '神器' || 文本 === '超神器';
}

function 规范化装备加成方向_V1(来源方向 = []) {
  const 原始列表 = Array.isArray(来源方向)
    ? 来源方向
    : String(来源方向 || '')
      .split(/[,\n，、|/]+/)
      .map(片段 => 片段.trim());
  const 输出 = [];
  原始列表.forEach(方向 => {
    const 文本 = String(方向 || '').trim();
    if (!文本 || !装备加成方向集合_V1.has(文本) || 输出.includes(文本)) return;
    输出.push(文本);
  });
  return 输出;
}

function 计算稳定哈希数值_V1(文本 = '') {
  let 哈希 = 2166136261;
  String(文本 || '').split('').forEach(字符 => {
    哈希 ^= 字符.charCodeAt(0);
    哈希 += (哈希 << 1) + (哈希 << 4) + (哈希 << 7) + (哈希 << 8) + (哈希 << 24);
  });
  return 哈希 >>> 0;
}

function 读取稳定随机数_V1(文本 = '') {
  return (计算稳定哈希数值_V1(文本) % 10000) / 10000;
}

function 读取品质随机等级_V1(品质 = '普通', 种子 = '') {
  const 等级段 = 非神器品质等级段表_V1[品质];
  if (!等级段) return 0;
  const [下限, 上限] = 等级段;
  return 下限 + Math.floor(读取稳定随机数_V1(`${品质}|${种子}`) * (上限 - 下限 + 1));
}

function 计算品质属性基础值_V1(品质 = '普通', 属性名 = '', 种子 = '') {
  const 属性键 = 装备属性键映射_V1[属性名];
  const 随机等级 = 读取品质随机等级_V1(品质, `${种子}|${属性名}`);
  if (!属性键 || !(随机等级 > 0)) return 0;
  return Math.floor(Number(getBaseStats(随机等级)?.[属性键] || 0) * 0.3);
}

function 展开装备加成方向_V1(方向列表 = []) {
  const 输出 = [];
  规范化装备加成方向_V1(方向列表).forEach(方向 => {
    const 展开列表 = 方向 === '全属性' ? 装备加成属性列表_V1 : [方向];
    展开列表.forEach(属性名 => {
      if (!输出.includes(属性名)) 输出.push(属性名);
    });
  });
  return 输出;
}

function 计算装备方向属性加成表_V1(装备 = {}, 分类 = '') {
  const 品质 = 规范化物品经济品质_V1(装备?.品质 || 装备?.品阶 || '普通', 装备?.名称 || '', 分类);
  const 方向列表 = 展开装备加成方向_V1(装备?.加成方向 || []);
  if (!方向列表.length || 判断神器品质_V1(品质)) return {};
  return Object.fromEntries(方向列表.map(属性名 => [
    属性名,
    计算品质属性基础值_V1(品质, 属性名, `${装备?.名称 || ''}|${分类}|装备`),
  ]).filter(([, 数值]) => Number(数值 || 0) > 0));
}

function 读取手工装备属性加成_V1(装备 = {}) {
  const 原始加成 = 装备?.属性加成 && typeof 装备.属性加成 === 'object' && !Array.isArray(装备.属性加成) ? 装备.属性加成 : {};
  const 输出 = {};
  let 有有效数值 = false;
  Object.entries(原始加成).forEach(([键, 值]) => {
    if (!装备加成属性列表_V1.includes(键)) return;
    const 文本值 = String(值 ?? '').trim();
    if (/^[+-]?\d+(?:\.\d+)?%$/.test(文本值)) {
      输出[键] = 文本值;
      有有效数值 = true;
      return;
    }
    const 数值 = Number(值);
    if (!Number.isFinite(数值)) return;
    输出[键] = 数值;
    if (Math.floor(数值) !== 0) 有有效数值 = true;
  });
  return 有有效数值 ? 输出 : {};
}

function 判断常规装备定义_V1(物品分类 = '', 是魂导器 = false, 定义 = {}) {
  const 分类 = String(物品分类 || '').trim();
  if (['近战武器', '远程武器', '防具装备', '战术装备', '功能道具'].includes(分类) || 是魂导器) return true;
  const 槽位 = String(定义?.装备槽位 || '').trim();
  return !!槽位 && 槽位 !== '无' && !['魂骨', '斗铠部件', '机甲机体'].includes(分类);
}

function 角色应用物品定义可注册_V1(分类 = '', 定义 = {}) {
  if (!定义 || typeof 定义 !== 'object' || Array.isArray(定义)) return false;
  const 来源 = cloneJsonValue(定义, {});
  ['名称', '装备状态', '状态', '耐久', '剩余使用次数', '绑定者', '有效期至tick', '品质系数', '_属性加成', '_已排异'].forEach(字段名 => delete 来源[字段名]);
  if (来源.品阶 === '无') delete 来源.品阶;
  if (来源.描述 === undefined || 来源.描述 === null || String(来源.描述 || '').trim() === '') delete 来源.描述;
  if (来源.属性加成 && typeof 来源.属性加成 === 'object' && !Array.isArray(来源.属性加成)) {
    const 有效加成 = 读取手工装备属性加成_V1({ ...定义, 属性加成: 来源.属性加成 });
    if (Object.keys(有效加成).length) 来源.属性加成 = 有效加成;
    else delete 来源.属性加成;
  }
  if (Array.isArray(来源.加成方向)) {
    const 方向 = 规范化装备加成方向_V1(来源.加成方向);
    if (方向.length) 来源.加成方向 = 方向;
    else delete 来源.加成方向;
  }
  return Object.entries(来源).some(([键, 值]) => {
    if (值 === undefined || 值 === null || 值 === '' || 值 === '无') return false;
    if (Array.isArray(值)) return 值.length > 0;
    if (值 && typeof 值 === 'object') return Object.keys(值).length > 0;
    if (键 === '品质') return String(值 || '').trim() !== '普通';
    return true;
  });
}

function 是污染魂灵物品定义_V1(来源 = {}) {
  if (!来源 || typeof 来源 !== 'object' || Array.isArray(来源)) return false;
  if (来源.契合度 !== undefined || 来源.战力面板 !== undefined) return true;
  const 状态文本 = String(来源.状态 || '').trim();
  if (['活跃', '沉睡', '已吸收', '接入', '融合'].includes(状态文本)) return true;
  return Object.keys(来源).some(键 => 是魂环槽位键_V1(键) || 是魂技槽位键_V1(键));
}

function 创建空物品分类表_V1() {
  return Object.fromEntries(物品分类列表_V1.map(分类 => [分类, {}]));
}

function 读取物品定义显式分类_V1(定义 = {}, fallback = '') {
  const 来源 = 定义 && typeof 定义 === 'object' && !Array.isArray(定义) ? 定义 : {};
  return 规范化物品分类_V1(来源.分类 || 来源.物品分类 || '', fallback);
}

function 要求物品定义分类_V1(物品名 = '', 定义 = {}, 分类 = '') {
  const 分类名 = 规范化物品分类_V1(分类 || 读取物品定义显式分类_V1(定义, ''), '');
  if (!分类名) throw new Error(`物品定义缺少分类路径：${String(物品名 || '未命名').trim() || '未命名'}`);
  return 分类名;
}

function 规范化物品定义_V1(物品名 = '', 定义 = {}, 分类 = '') {
  const 来源 = 定义 && typeof 定义 === 'object' && !Array.isArray(定义) ? 定义 : {};
  const 物品分类 = 要求物品定义分类_V1(物品名, 来源, 分类);
  if (物品分类 === '魂灵' && 是污染魂灵物品定义_V1(来源)) return null;
  const 输出 = {
    品质: 规范化物品经济品质_V1(来源.品质 || '普通', 物品名, 物品分类),
    描述: String(来源.描述 || `关于【${物品名}】的记录暂未展开。`).trim(),
    默认货币: String(来源.默认货币 || 来源.货币 || '联邦币').trim() || '联邦币',
  };
  const 基础价格 = 读取显式物品基础价格_V1(来源);
  if (基础价格 !== undefined) 输出.基础价格 = 基础价格;
  if (物品分类 === '魂灵') {
    ['表象名称', '标准物种'].forEach(字段名 => {
      if (来源[字段名] !== undefined && String(来源[字段名]).trim() && String(来源[字段名]).trim() !== '无') 输出[字段名] = String(来源[字段名]).trim();
    });
    const 魂灵品质 = normalizeSoulSpiritQuality(来源.魂灵品质 || '');
    if (魂灵品质) 输出.魂灵品质 = 魂灵品质;
    if (Number(来源.年限 || 0) > 0) 输出.年限 = Math.max(0, Math.floor(Number(来源.年限 || 0)));
    Object.keys(输出).forEach(键 => {
      const 值 = 输出[键];
      if (值 === undefined || 值 === null || 值 === '' || (Array.isArray(值) && !值.length)) delete 输出[键];
      else if (值 && typeof 值 === 'object' && !Array.isArray(值) && !Object.keys(值).length) delete 输出[键];
    });
    return 输出;
  }
  if (Number(来源.魂导等级 || 0) > 0) 输出.魂导等级 = Math.max(1, Math.min(12, Math.floor(Number(来源.魂导等级 || 0))));
  const 是魂导器 = Number(输出.魂导等级 || 0) > 0 && !(物品分类 === '一次性道具' || /奶瓶|定装|炮弹|炸弹|爆弹|弹\b|弹$/.test(`${物品名} ${物品分类} ${输出.描述}`));
  if (来源.使用后消耗 !== undefined) {
    if (typeof 来源.使用后消耗 !== 'boolean') throw new Error(`物品定义使用后消耗无效：${物品名}`);
    输出.使用后消耗 = 来源.使用后消耗;
  }
  if (来源.使用次数恢复周期 !== undefined) {
    const 使用次数恢复周期 = String(来源.使用次数恢复周期 || '').trim();
    if (使用次数恢复周期 !== '每日') throw new Error(`物品定义使用次数恢复周期无效：${物品名}`);
    输出.使用次数恢复周期 = 使用次数恢复周期;
  }
  if (['近战武器', '远程武器'].includes(物品分类) && 来源.材质 !== undefined) {
    const 材质 = String(来源.材质 || '').trim();
    if (材质 && 材质 !== '无') 输出.材质 = 材质;
  }
  if (物品分类 === '锻造金属') {
    输出.阶位 = Math.max(0, Math.min(5, Math.floor(Number(来源.阶位 || 0))));
    const 金属特性 = Array.isArray(来源.金属特性)
      ? [...new Set(来源.金属特性.map(特性 => String(特性 || '').trim()).filter(Boolean))]
      : [];
    if (金属特性.length) 输出.金属特性 = 金属特性;
  }
  if (物品分类 === '机甲机体') {
    ['等级', '型号', '材质', '武装'].forEach(字段名 => {
      if (来源[字段名] !== undefined && String(来源[字段名]).trim() && String(来源[字段名]).trim() !== '无') 输出[字段名] = cloneJsonValue(来源[字段名]);
    });
  }
  const 装备槽位 = String(来源.装备槽位 || '').trim();
  const 是装备定义 = 装备物品分类集合_V1.has(物品分类) || 是魂导器 || (!!装备槽位 && 装备槽位 !== '无');
  if (Number(来源.基础使用次数 || 0) > 0) 输出.基础使用次数 = Math.max(1, Math.floor(Number(来源.基础使用次数 || 0)));
  if (是装备定义) {
    const 是常规装备 = 判断常规装备定义_V1(物品分类, 是魂导器, 来源);
    if (装备槽位) 输出.装备槽位 = 装备槽位;
    if (Number(来源.基础耐久 || 0) > 0) 输出.基础耐久 = Math.max(0, Math.floor(Number(来源.基础耐久 || 0)));
    if (是常规装备) {
      const 加成方向 = 规范化装备加成方向_V1(来源.加成方向 || []);
      if (加成方向.length) 输出.加成方向 = 加成方向;
    }
    if (来源.属性加成 && typeof 来源.属性加成 === 'object' && !Array.isArray(来源.属性加成)) {
      const 属性加成 = 读取手工装备属性加成_V1(来源);
      if (Object.keys(属性加成).length) 输出.属性加成 = 属性加成;
    }
    if (物品分类 === '魂骨' && 来源.属性倍率 && typeof 来源.属性倍率 === 'object' && !Array.isArray(来源.属性倍率)) 输出.属性倍率 = cloneJsonValue(来源.属性倍率, {});
    if (物品分类 !== '魂骨' && 来源.装备技能 && typeof 来源.装备技能 === 'object' && !Array.isArray(来源.装备技能)) 输出.装备技能 = cloneJsonValue(来源.装备技能, {});
    if (来源.附带魂技 && typeof 来源.附带魂技 === 'object' && !Array.isArray(来源.附带魂技)) 输出.附带魂技 = cloneJsonValue(来源.附带魂技, {});
  }
  if (物品分类 === '魂骨') {
    if (Number(来源.年限 || 来源.age || 0) > 0) 输出.年限 = Math.max(0, Math.floor(Number(来源.年限 || 来源.age || 0)));
    ['来源', '品阶', '表象名称'].forEach(字段名 => {
      if (来源[字段名] !== undefined && String(来源[字段名]).trim() && String(来源[字段名]).trim() !== '无') 输出[字段名] = String(来源[字段名]).trim();
    });
    const 附带技能 = 来源.附带技能 && typeof 来源.附带技能 === 'object' && !Array.isArray(来源.附带技能)
      ? 来源.附带技能
      : 来源.装备技能;
    if (附带技能 && typeof 附带技能 === 'object' && !Array.isArray(附带技能)) 输出.附带技能 = cloneJsonValue(附带技能, {});
  }
  if (可执行使用效果物品分类集合_V1.has(物品分类)) {
    const 使用效果 = Array.isArray(来源.使用效果) ? 来源.使用效果 : [];
    if (使用效果.length) {
      输出.使用效果 = cloneJsonValue(使用效果, []).map(效果 => {
        if (!效果 || typeof 效果 !== 'object' || Array.isArray(效果)) return 效果;
        const 清理效果 = cloneJsonValue(效果, {});
        delete 清理效果.描述;
        return 清理效果;
      });
    }
    if (Array.isArray(来源.副作用列表) && 来源.副作用列表.length) 输出.副作用列表 = cloneJsonValue(来源.副作用列表, []);
  }
  if (物品分类 === '设计图纸') {
    ['图纸目标', '材料'].forEach(字段名 => {
      if (来源[字段名] !== undefined && String(来源[字段名]).trim()) 输出[字段名] = cloneJsonValue(来源[字段名]);
    });
  }
  if (['身份凭证', '入场凭证'].includes(物品分类) && String(来源.使用限制或归属说明 || '').trim()) {
    输出.使用限制或归属说明 = String(来源.使用限制或归属说明).trim();
  }
  if (Array.isArray(来源.解锁内容) && 来源.解锁内容.length) 输出.解锁内容 = cloneJsonValue(来源.解锁内容, []);
  if (物品分类 === '修炼秘籍') {
    const 获取条件 = 来源.获取条件 || {};
    const 研读条件 = 来源.研读条件 || {};
    const 解锁内容 = 来源.解锁内容 || [];
    if (获取条件 && (typeof 获取条件 !== 'object' || Array.isArray(获取条件) || Object.keys(获取条件).length)) 输出.获取条件 = cloneJsonValue(获取条件, 获取条件);
    if (研读条件 && (typeof 研读条件 !== 'object' || Array.isArray(研读条件) || Object.keys(研读条件).length)) 输出.研读条件 = cloneJsonValue(研读条件, 研读条件);
    if (!输出.解锁内容 && (Array.isArray(解锁内容) ? 解锁内容.length : !!解锁内容)) 输出.解锁内容 = cloneJsonValue(解锁内容, 解锁内容);
  }
  Object.keys(输出).forEach(键 => {
    const 值 = 输出[键];
    if (值 === undefined || 值 === null || 值 === '' || (Array.isArray(值) && !值.length)) delete 输出[键];
    else if (值 && typeof 值 === 'object' && !Array.isArray(值) && !Object.keys(值).length) delete 输出[键];
  });
  return 输出;
}

function 规范化物品分类表_V1(物品表 = {}) {
  const 输出 = 创建空物品分类表_V1();
  const 来源表 = 物品表 && typeof 物品表 === 'object' && !Array.isArray(物品表) ? 物品表 : {};
  物品分类列表_V1.forEach(分类 => {
    Object.entries(来源表[分类] || {}).forEach(([物品名, 定义]) => {
      const 名称 = String(物品名 || '').trim();
      if (!名称 || !定义 || typeof 定义 !== 'object' || Array.isArray(定义)) return;
      const 规范定义 = 规范化物品定义_V1(名称, 定义, 分类);
      if (规范定义) 输出[分类][名称] = 规范定义;
    });
  });
  return 输出;
}

function 确保物品分类表_V1(data = {}) {
  if (!data || typeof data !== 'object') return 创建空物品分类表_V1();
  if (!data.物品 || typeof data.物品 !== 'object' || Array.isArray(data.物品)) data.物品 = 创建空物品分类表_V1();
  物品分类列表_V1.forEach(分类 => {
    if (!data.物品[分类] || typeof data.物品[分类] !== 'object' || Array.isArray(data.物品[分类])) data.物品[分类] = {};
  });
  return data.物品;
}

function 遍历物品定义_V1(物品表 = {}, 回调 = () => {}) {
  const 分类表 = 物品表 && typeof 物品表 === 'object' && !Array.isArray(物品表) ? 物品表 : {};
  物品分类列表_V1.forEach(分类 => {
    Object.entries(分类表[分类] || {}).forEach(([物品名, 定义]) => {
      if (!物品名 || !定义 || typeof 定义 !== 'object' || Array.isArray(定义)) return;
      回调(物品名, 定义, 分类);
    });
  });
}

function 查找物品定义_V1(数据根 = {}, 物品名 = '') {
  const 名称 = String(物品名 || '').trim();
  if (!名称) return null;
  let 结果 = null;
  遍历物品定义_V1(数据根?.物品 || {}, (当前名, 定义, 分类) => {
    if (!结果 && 当前名 === 名称) 结果 = { 物品名: 当前名, 定义, 分类 };
  });
  return 结果;
}

function 物品定义存在_V1(数据根 = {}, 物品名 = '') {
  return !!查找物品定义_V1(数据根, 物品名);
}

function 写入分类物品定义_V1(data = {}, 物品名 = '', 定义 = {}, 分类 = '') {
  const 名称 = String(物品名 || '').trim();
  if (!名称) return null;
  const 目标分类 = 要求物品定义分类_V1(名称, 定义, 分类);
  const 物品表 = 确保物品分类表_V1(data);
  const 现有 = 查找物品定义_V1(data, 名称);
  if (现有) {
    if (现有.分类 !== 目标分类) throw new Error(`同名物品已存在于【${现有.分类}】：${名称}`);
    return 现有;
  }
  const 规范定义 = 规范化物品定义_V1(名称, 定义, 目标分类);
  if (!规范定义) return null;
  if (!物品表[目标分类]) 物品表[目标分类] = {};
  物品表[目标分类][名称] = 规范定义;
  return { 物品名: 名称, 定义: 规范定义, 分类: 目标分类 };
}

function 合并分类物品定义_V1(data = {}, 物品名 = '', 定义 = {}, 分类 = '') {
  const 名称 = String(物品名 || '').trim();
  if (!名称) return null;
  const 目标分类 = 要求物品定义分类_V1(名称, 定义, 分类);
  const 物品表 = 确保物品分类表_V1(data);
  const 规范定义 = 规范化物品定义_V1(名称, 定义, 目标分类);
  if (!规范定义) return null;
  const 现有 = 查找物品定义_V1(data, 名称);
  if (现有) {
    if (现有.分类 !== 目标分类) throw new Error(`同名物品已存在于【${现有.分类}】：${名称}`);
    物品表[目标分类][名称] = { ...现有.定义, ...规范定义 };
    return { 物品名: 名称, 定义: 物品表[目标分类][名称], 分类: 目标分类 };
  }
  物品表[目标分类][名称] = 规范定义;
  return { 物品名: 名称, 定义: 规范定义, 分类: 目标分类 };
}

function 计算装备属性加成_V1(装备 = {}, 角色 = {}) {
  const 结果 = {};
  const 分类 = String(装备?.物品分类 || 装备?.分类 || '').trim();
  const 品质 = 规范化物品经济品质_V1(装备?.品质 || 装备?.品阶 || 装备?.类型 || '普通', 装备?.名称 || '', 分类);
  const 是神器装备 = 判断神器品质_V1(品质);
  const 角色等级 = Math.max(1, Number(角色?.属性?.等级 ?? 角色?.等级 ?? 角色?.lv ?? 1) || 1);
  const 手工加成 = 读取手工装备属性加成_V1(装备);
  const 写入等级差加成 = (属性名, 等级差) => {
    const 属性键 = 装备属性键映射_V1[属性名];
    if (!属性键) return;
    const 起始属性 = getBaseStats(角色等级);
    const 目标属性 = getBaseStats(Math.max(1, 角色等级 + Number(等级差 || 0)));
    结果[属性名] = Math.floor(Number(目标属性[属性键] || 0) - Number(起始属性[属性键] || 0));
  };
  Object.entries(手工加成).forEach(([键, 值]) => {
    const 文本值 = String(值 ?? '').trim();
    const 百分比匹配 = 文本值.match(/^([+-]?\d+(?:\.\d+)?)%$/);
    if (百分比匹配) {
      const 百分比数字 = Number(百分比匹配[1]);
      写入等级差加成(键, 百分比数字 / 10);
      return;
    }
    const 数值 = Number(值);
    结果[键] = Number.isFinite(数值) ? Math.floor(数值) : 0;
  });
  if (!Object.keys(结果).length && !是神器装备) {
    Object.entries(计算装备方向属性加成表_V1({ ...装备, 品质 }, 分类)).forEach(([属性名, 数值]) => {
      结果[属性名] = Math.floor(Number(数值 || 0));
    });
  }
  return 结果;
}

const 临时突破属性键映射_V1 = Object.freeze({
  力量: 'str',
  防御: 'def',
  敏捷: 'agi',
  体力上限: 'vit_max',
  精神力上限: 'men_max',
});
const 临时突破全属性列表_V1 = Object.freeze(Object.keys(临时突破属性键映射_V1));

function 追加系统播报文本(data = {}, 文本 = '') {
  const 内容 = String(文本 || '').trim();
  if (!内容) return;
  if (!data.sys || typeof data.sys !== 'object' || Array.isArray(data.sys)) data.sys = {};
  const 当前 = String(data.sys.系统播报 || '').trim();
  data.sys.系统播报 = !当前 || 当前 === '初始化' ? 内容 : `${当前} ${内容}`;
}

function 解析临时突破请求_V1(原始值 = '') {
  const 文本 = String(原始值 ?? '').trim();
  if (!文本 || 文本 === '无' || /待补全|请填写/.test(文本)) return null;
  const 类型匹配 = 文本.match(/类型\s*[:：]\s*([^；;\n]+)/);
  const 增量匹配 = 文本.match(/等级增量\s*[:：]\s*([+-]?\d+)/);
  if (!类型匹配 || !增量匹配) return null;
  const 等级增量 = Math.floor(Number(增量匹配[1]));
  if (!(等级增量 > 0)) return null;
  const 类型列表 = String(类型匹配[1] || '')
    .split(/[,\uFF0C\u3001/／]/)
    .map(类型 => 类型.trim())
    .filter(Boolean);
  if (!类型列表.length) return null;
  const 输出类型 = [];
  类型列表.forEach(类型 => {
    if (类型 === '全属性') {
      临时突破全属性列表_V1.forEach(属性 => 输出类型.push(属性));
    } else if (类型 === '魂力' || 类型 === '等级' || 临时突破属性键映射_V1[类型]) {
      输出类型.push(类型);
    }
  });
  const 去重类型 = Array.from(new Set(输出类型));
  return 去重类型.length ? { 类型列表: 去重类型, 等级增量 } : null;
}

function 处理临时突破请求_V1(data = {}) {
  const 角色表 = data?.char && typeof data.char === 'object' && !Array.isArray(data.char) ? data.char : {};
  Object.entries(角色表).forEach(([角色名, 角色]) => {
    if (!角色 || typeof 角色 !== 'object' || Array.isArray(角色)) return;
    const 请求 = 解析临时突破请求_V1(角色.临时突破);
    if (!请求) return;
    const 属性 = 角色.属性 && typeof 角色.属性 === 'object' && !Array.isArray(角色.属性) ? 角色.属性 : null;
    if (!属性) return;

    const 当前等级 = Math.max(1, Math.floor(Number(属性.等级 || 1) || 1));
    const 目标等级 = Math.max(当前等级 + 1, 当前等级 + 请求.等级增量);
    const 播报项 = [];
    if (请求.类型列表.includes('魂力') || 请求.类型列表.includes('等级')) {
      if (目标等级 > 当前等级) {
        属性.等级 = 目标等级;
        播报项.push(`魂力提升${目标等级 - 当前等级}级`);
      }
    }

    const 起始属性 = getBaseStats(当前等级);
    const 目标属性 = getBaseStats(目标等级);
    const 训练加成 = ensureNumericStatBonusMap(属性, '训练加成');
    请求.类型列表.forEach(类型 => {
      const 属性键 = 临时突破属性键映射_V1[类型];
      if (!属性键) return;
      const 增量 = Math.max(1, Math.floor(Number(目标属性?.[属性键] || 0) - Number(起始属性?.[属性键] || 0)));
      训练加成[类型] = Math.floor(Number(训练加成[类型] || 0) + 增量);
      播报项.push(`${类型}属性永久加成+${增量}`);
    });

    角色.临时突破 = '无';
    if (播报项.length) 追加系统播报文本(data, `[突破结算] ${角色名} ${播报项.join('；')}。`);
  });
}

function 查找物品定义于分类表_V1(物品表 = {}, 物品名 = '') {
  const 名称 = String(物品名 || '').trim();
  if (!名称) return null;
  const 来源表 = 物品表 && typeof 物品表 === 'object' && !Array.isArray(物品表) ? 物品表 : {};
  for (const 分类 of 物品分类列表_V1) {
    const 定义 = 来源表?.[分类]?.[名称];
    if (定义 && typeof 定义 === 'object' && !Array.isArray(定义)) return { 物品名: 名称, 定义, 分类 };
  }
  return null;
}

function 构建引用水合物品表_V1(数据根 = {}) {
  const 合并表 = 创建空物品分类表_V1();
  const 写入表 = 来源表 => {
    物品分类列表_V1.forEach(分类 => {
      Object.entries(来源表?.[分类] || {}).forEach(([物品名, 定义]) => {
        if (!物品名 || !定义 || typeof 定义 !== 'object' || Array.isArray(定义)) return;
        合并表[分类][物品名] = cloneJsonValue(定义, {});
      });
    });
  };
  写入表(读取内置物品库_V1());
  写入表(数据根?.物品);
  return 合并表;
}

function 合并引用定义与状态_V1(物品表 = {}, 状态 = {}, 期望分类 = '') {
  if (!状态 || typeof 状态 !== 'object' || Array.isArray(状态)) return 状态;
  const 名称 = String(状态.名称 || '').trim();
  if (!名称 || 名称 === '无') return 状态;
  const 命中 = 查找物品定义于分类表_V1(物品表, 名称);
  const 期望集合 = Array.isArray(期望分类)
    ? new Set(期望分类.map(分类 => String(分类 || '').trim()).filter(Boolean))
    : new Set(String(期望分类 || '').trim() ? [String(期望分类 || '').trim()] : []);
  if (!命中 || (期望集合.size && !期望集合.has(命中.分类))) return 状态;
  return { ...cloneJsonValue(命中.定义, {}), ...状态, 名称, 物品分类: 命中.分类 };
}

function 水合角色物品引用_V1(数据根 = {}) {
  const 物品表 = 构建引用水合物品表_V1(数据根);
  Object.values(数据根?.char || {}).forEach(char => {
    if (!char || typeof char !== 'object' || Array.isArray(char)) return;
    if (char.装备 && typeof char.装备 === 'object' && !Array.isArray(char.装备)) {
      if (char.装备.武器 && typeof char.装备.武器 === 'object') char.装备.武器 = 合并引用定义与状态_V1(物品表, char.装备.武器, ['近战武器', '远程武器']);
      if (char.装备.防具 && typeof char.装备.防具 === 'object') char.装备.防具 = 合并引用定义与状态_V1(物品表, char.装备.防具, '防具装备');
      if (char.装备.机甲 && typeof char.装备.机甲 === 'object') char.装备.机甲 = 合并引用定义与状态_V1(物品表, char.装备.机甲, '机甲机体');
      Object.entries(char.装备.斗铠?.部件 || {}).forEach(([部件名, 部件]) => {
        if (部件 && typeof 部件 === 'object' && !Array.isArray(部件)) char.装备.斗铠.部件[部件名] = 合并引用定义与状态_V1(物品表, 部件, '斗铠部件');
      });
      Object.entries(char.装备.魂导器?.装配 || {}).forEach(([槽位, 装配]) => {
        if (装配 && typeof 装配 === 'object' && !Array.isArray(装配)) char.装备.魂导器.装配[槽位] = 合并引用定义与状态_V1(物品表, 装配);
      });
    }
    Object.entries(char.魂骨 || {}).forEach(([槽位, 魂骨]) => {
      if (魂骨 && typeof 魂骨 === 'object' && !Array.isArray(魂骨)) char.魂骨[槽位] = 合并引用定义与状态_V1(物品表, 魂骨, '魂骨');
    });
  });
  return 数据根;
}

function 注册角色应用物品定义_V1(data = {}) {
  const 构建注册定义 = (物品名 = '', 分类 = '', 定义 = {}) => {
    const 来源 = cloneJsonValue(定义, {});
    if (分类 === '机甲机体') {
      const 等级 = String(来源.等级 || 物品名.match(/(黄级|紫级|黑级|红级|规格外机甲)/)?.[1] || '黄级').trim();
      const 价格 = { 黄级: 6000000, 紫级: 80000000, 黑级: 1000000000, 红级: 8000000000, 规格外机甲: 8000000000 }[等级] || 6000000;
      return {
        分类,
        品质: 等级 === '红级' || 等级 === '规格外机甲' ? '神器' : 等级 === '黑级' ? '传说' : 等级 === '紫级' ? '史诗' : '稀有',
        描述: `${等级}机甲机体的标准定义，应用侧仅保存名称与状态。`,
        基础价格: 价格,
        默认货币: '联邦币',
        等级,
        型号: String(来源.型号 || '均衡').trim() || '均衡',
        装备槽位: '机甲',
        基础耐久: 等级 === '红级' || 等级 === '规格外机甲' ? 200000 : 等级 === '黑级' ? 80000 : 等级 === '紫级' ? 30000 : 10000,
      };
    }
    if (分类 === '斗铠部件') {
      const 等级 = Math.max(1, Math.min(4, Math.floor(Number(来源.等级 || 物品名.match(/([一二三四])字斗铠/)?.[1]?.replace('一', 1).replace('二', 2).replace('三', 3).replace('四', 4) || 1))));
      return {
        分类,
        品质: 等级 >= 4 ? '神器' : 等级 >= 3 ? '传说' : 等级 >= 2 ? '史诗' : '稀有',
        描述: `${等级}字斗铠部件的标准定义，具体品质由背包批次或装配状态记录。`,
        基础价格: [0, 500000, 5000000, 50000000, 800000000][等级] || 500000,
        默认货币: '联邦币',
        装备槽位: '斗铠部件',
        基础耐久: [0, 3000, 10000, 30000, 100000][等级] || 3000,
      };
    }
    return { ...来源, 分类 };
  };
  const 注册 = (名称 = '', 分类 = '', 定义 = {}) => {
    const 物品名 = String(名称 || '').trim();
    if (!物品名 || 物品名 === '无' || isAiTodoText(物品名)) return;
    if (!定义 || typeof 定义 !== 'object' || Array.isArray(定义)) return;
    const 已有 = 查找物品定义_V1(data, 物品名);
    if (已有) return;
    合并分类物品定义_V1(data, 物品名, 构建注册定义(物品名, 分类, 定义), 分类);
  };
  Object.values(data?.char || {}).forEach(char => {
    if (!char || typeof char !== 'object' || Array.isArray(char)) return;
    注册(char.装备?.武器?.名称, 读取物品定义显式分类_V1(char.装备?.武器, '近战武器'), char.装备?.武器);
    注册(char.装备?.防具?.名称, '防具装备', char.装备?.防具);
    注册(char.装备?.机甲?.名称, '机甲机体', char.装备?.机甲);
    Object.values(char.装备?.斗铠?.部件 || {}).forEach(部件 => 注册(部件?.名称, '斗铠部件', 部件));
    Object.values(char.装备?.魂导器?.装配 || {}).forEach(装配 => 注册(装配?.名称, 读取物品定义显式分类_V1(装配, '功能道具'),装配));
    Object.values(char.魂骨 || {}).forEach(魂骨 => 注册(魂骨?.名称, '魂骨', 魂骨));
  });
}

function 压缩应用物品记录_V1(记录 = {}, 选项 = {}) {
  if (!记录 || typeof 记录 !== 'object' || Array.isArray(记录)) return 记录;
  const 名称 = String(记录.名称 || '').trim();
  if (!名称 || 名称 === '无' || isAiTodoText(名称)) return 记录;
  const 保留字段 = new Set(['名称', ...(选项.状态字段 || [])]);
  const 输出 = { 名称 };
  保留字段.forEach(字段名 => {
    if (字段名 === '名称') return;
    const 值 = 记录[字段名];
    if (值 === undefined || 值 === null || 值 === '' || 值 === '无') return;
    if (值 && typeof 值 === 'object' && !Array.isArray(值) && !Object.keys(值).length) return;
    输出[字段名] = cloneJsonValue(值, 值);
  });
  return 输出;
}

function 压缩角色应用物品引用_V1(data = {}) {
  Object.values(data?.char || {}).forEach(char => {
    if (!char || typeof char !== 'object' || Array.isArray(char)) return;
    if (char.装备 && typeof char.装备 === 'object' && !Array.isArray(char.装备)) {
      char.装备.武器 = 压缩应用物品记录_V1(char.装备.武器, { 状态字段: ['耐久', '剩余使用次数', '绑定者', '有效期至tick'] });
      char.装备.防具 = 压缩应用物品记录_V1(char.装备.防具, { 状态字段: ['装备状态', '耐久', '绑定者', '有效期至tick'] });
      char.装备.机甲 = 压缩应用物品记录_V1(char.装备.机甲, { 状态字段: ['状态', '装备状态', '品质系数', '耐久', '绑定者', '有效期至tick'] });
      Object.entries(char.装备.斗铠?.部件 || {}).forEach(([部件名, 部件]) => {
        char.装备.斗铠.部件[部件名] = 压缩应用物品记录_V1(部件, { 状态字段: ['状态', '品质系数', '耐久', '绑定者'] });
      });
      Object.entries(char.装备.魂导器?.装配 || {}).forEach(([槽位, 装配]) => {
        char.装备.魂导器.装配[槽位] = 压缩应用物品记录_V1(装配, { 状态字段: ['剩余使用次数', '耐久', '绑定者', '有效期至tick'] });
      });
    }
    Object.entries(char.魂骨 || {}).forEach(([槽位, 魂骨]) => {
      const 名称 = String(魂骨?.名称 || '').trim();
      char.魂骨[槽位] = 名称 && 名称 !== '无' && !isAiTodoText(名称)
        ? 压缩应用物品记录_V1(魂骨, { 状态字段: [] })
        : {};
    });
  });
  return data;
}

var FLAT_LOCATIONS = {};

function refreshFlatLocationsFromTree(node, name) {
  if (node?.x !== undefined && node?.y !== undefined) {
    FLAT_LOCATIONS[name] = { x: node.x, y: node.y };
  }
  if (node?.子节点) {
    for (const childName in node.子节点) {
      refreshFlatLocationsFromTree(node.子节点[childName], childName);
    }
  }
}

function findMapNodeEntry(targetName, sd) {
  let found = null;
  const safeTargetName = String(targetName || '').trim();
  const visit = (node, name, path = []) => {
    if (found || !node) return;
    if (sd && typeof node.condition === 'function' && !node.condition(sd)) return;
    const nextPath = [...path, name];
    if (name === safeTargetName) {
      found = { name, node, path: nextPath };
      return;
    }
    if (node.子节点) {
      Object.keys(node.子节点).forEach(childName => {
        visit(node.子节点[childName], childName, nextPath);
      });
    }
  };

  if (sd && sd.world && sd.world.地点) {
    Object.keys(sd.world.地点).forEach(locName => {
      visit(sd.world.地点[locName], locName, []);
    });
  }

  if (!found && sd && sd.world && sd.world.地点 && safeTargetName.includes('-')) {
    const rawSegments = safeTargetName
      .split('-')
      .map(seg => String(seg || '').trim())
      .filter(Boolean);
    const pathSegments = rawSegments.filter(seg => seg !== '斗罗大陆' && seg !== '斗灵大陆');
    if (pathSegments.length >= 1) {
      let currentNode = sd.world.地点[pathSegments[0]];
      const currentPath = [];
      if (currentNode && !(typeof currentNode.condition === 'function' && !currentNode.condition(sd))) {
        currentPath.push(pathSegments[0]);
        if (pathSegments.length === 1) {
          found = {
            name: currentPath[0],
            node: currentNode,
            path: currentPath,
          };
        } else {
          let valid = true;
          for (let i = 1; i < pathSegments.length; i++) {
            const seg = pathSegments[i];
            currentNode = currentNode?.子节点?.[seg];
            if (!currentNode || (typeof currentNode.condition === 'function' && !currentNode.condition(sd))) {
              valid = false;
              break;
            }
            currentPath.push(seg);
          }
          if (valid && currentNode) {
            found = {
              name: currentPath[currentPath.length - 1],
              node: currentNode,
              path: currentPath,
            };
          } else if (currentPath.length) {
            const matchedNode = currentPath.reduce((node, seg, index) => {
              if (index === 0) return sd.world.地点[seg];
              return node?.子节点?.[seg];
            }, null);
            if (matchedNode) {
              found = {
                name: currentPath[currentPath.length - 1],
                node: matchedNode,
                path: currentPath,
              };
            }
          }
        }
      }
    }
  }

  return found;
}

function normalizeDynamicLocationTextList(value = []) {
  return Array.isArray(value)
    ? value.map(item => String(item || '').trim()).filter(Boolean)
    : [];
}

function buildCompactDynamicLocationDisplayPayload(dynData = {}) {
  const nextData = {
    归属父节点: dynData.归属父节点,
    描述: dynData.描述,
    x: dynData.x,
    y: dynData.y,
  };

  const faction = String(dynData.势力 || '').trim();
  if (faction && faction !== '未知') nextData.势力 = faction;

  const status = String(dynData.状态 || dynData.state || '').trim();
  if (status && status !== 'intact') nextData.状态 = status;

  return nextData;
}

function pruneDynamicLocationStorageFields(locData = {}) {
  if (!locData || typeof locData !== 'object' || Array.isArray(locData)) return locData;

  const faction = String(locData.势力 || '').trim();
  if (faction && faction !== '未知') locData.势力 = faction;
  else delete locData.势力;

  const status = String(locData.状态 || '').trim();
  if (status && status !== 'intact') locData.状态 = status;
  else delete locData.状态;
  return locData;
}

var 初始化魂灵预算倍率记录_V1 = new WeakMap();

var BaseProductPool = {
  高能压缩干粮: {
    价格: 50,
    货币: '联邦币',
    分类: '一次性道具',
    描述: '长途旅行必备，能快速补充少量体力。',
    使用效果: [{ 原型: '资源变化', 目标: '自身', 资源: '体力', 数值: '+10%' }],
  },
  初级恢复药剂: {
    价格: 500,
    货币: '联邦币',
    分类: '丹药',
    描述: '能恢复少量魂力和体力，战斗后的应急用品。',
    使用效果: [
      { 原型: '资源变化', 目标: '自身', 资源: '魂力', 数值: '+15%' },
      { 原型: '资源变化', 目标: '自身', 资源: '体力', 数值: '+15%' },
    ],
  },
  中级恢复药剂: {
    价格: 2000,
    货币: '联邦币',
    分类: '丹药',
    描述: '效果显著的恢复药剂，能应对大多数战斗消耗。',
    使用效果: [
      { 原型: '资源变化', 目标: '自身', 资源: '魂力', 数值: '+35%' },
      { 原型: '资源变化', 目标: '自身', 资源: '体力', 数值: '+35%' },
    ],
  },
  高级恢复药剂: {
    价格: 8000,
    货币: '联邦币',
    分类: '丹药',
    描述: '珍贵的强效恢复药剂，关键时刻能扭转战局。',
    使用效果: [
      { 原型: '资源变化', 目标: '自身', 资源: '魂力', 数值: '+70%' },
      { 原型: '资源变化', 目标: '自身', 资源: '体力', 数值: '+70%' },
    ],
  },
  精神恢复冥想香: {
    价格: 1500,
    货币: '联邦币',
    分类: '丹药',
    描述: '点燃后能帮助魂师快速集中精神，恢复消耗的精神力。',
    使用效果: [{ 原型: '资源变化', 目标: '自身', 资源: '精神力', 数值: '+25%' }],
  },
  基础解毒散: {
    价格: 300,
    货币: '联邦币',
    分类: '丹药',
    描述: '可以解除一些百年魂兽的普通毒素。',
    使用效果: [{ 原型: '状态移除', 目标: '自身', 状态: '普通中毒', 数量: 1 }],
  },
  千年解毒丹: {
    价格: 2500,
    货币: '联邦币',
    分类: '丹药',
    描述: '能有效化解千年魂兽的剧毒，是魂师深入森林的保障。',
    使用效果: [{ 原型: '状态移除', 目标: '自身', 状态: '千年剧毒', 数量: 1 }],
  },
  力量增幅药剂: {
    价格: 1200,
    货币: '联邦币',
    分类: '丹药',
    描述: '饮用后短时间内肌肉膨胀，力量获得显著提升。',
    使用效果: [{ 原型: '属性修正', 目标: '自身', 属性: '力量', 数值: '+15%', 持续回合: 3 }],
  },
  野外生存帐篷: {
    价格: 1000,
    货币: '联邦币',
    分类: '剧情杂物',
    描述: '在野外提供一个相对安全的休息点，可用于临时营地搭建。',
  },
  照明魂导器: {
    价格: 800,
    货币: '联邦币',
    分类: '功能道具',
    描述: '最基础的手持照明工具，比火把方便得多，可辅助低光环境探索。',
  },
  普通铁锭: {
    价格: 200,
    货币: '联邦币',
    分类: '锻造金属',
    描述: '最基础的锻造材料，用于练习或打造低级工具。',
    阶位: 0,
  },
  百锻精铁: {
    价格: 1500,
    货币: '联邦币',
    分类: '锻造金属',
    描述: '经过百次锻打的精铁，是打造魂导器的入门材料。',
    阶位: 1,
  },
  '1级密封奶瓶': {
    价格: 80000,
    货币: '联邦币',
    分类: '一次性道具',
    描述: '一级密封奶瓶，储存稳定魂力的密封魂导补给瓶，使用后恢复固定魂力160。',
    基础使用次数: 1,
    使用效果: [{ 原型: '资源变化', 目标: '自身', 资源: '魂力', 数值: '+160' }],
  },
  '2级密封奶瓶': {
    价格: 80000,
    货币: '联邦币',
    分类: '一次性道具',
    描述: '二级密封奶瓶，储存稳定魂力的密封魂导补给瓶，使用后恢复固定魂力400。',
    基础使用次数: 1,
    使用效果: [{ 原型: '资源变化', 目标: '自身', 资源: '魂力', 数值: '+400' }],
  },
  '3级密封奶瓶': {
    价格: 200000,
    货币: '联邦币',
    分类: '一次性道具',
    描述: '三级密封奶瓶，储存稳定魂力的密封魂导补给瓶，使用后恢复固定魂力900。',
    基础使用次数: 1,
    使用效果: [{ 原型: '资源变化', 目标: '自身', 资源: '魂力', 数值: '+900' }],
  },
  '4级密封奶瓶': {
    价格: 800000,
    货币: '联邦币',
    分类: '一次性道具',
    描述: '四级密封奶瓶，储存稳定魂力的密封魂导补给瓶，使用后恢复固定魂力1700。',
    基础使用次数: 1,
    使用效果: [{ 原型: '资源变化', 目标: '自身', 资源: '魂力', 数值: '+1700' }],
  },
  '5级密封奶瓶': {
    价格: 2000000,
    货币: '联邦币',
    分类: '一次性道具',
    描述: '五级密封奶瓶，储存稳定魂力的密封魂导补给瓶，使用后恢复固定魂力3000。',
    基础使用次数: 1,
    使用效果: [{ 原型: '资源变化', 目标: '自身', 资源: '魂力', 数值: '+3000' }],
  },
  '6级密封奶瓶': {
    价格: 8000000,
    货币: '联邦币',
    分类: '一次性道具',
    描述: '六级密封奶瓶，储存稳定魂力的密封魂导补给瓶，使用后恢复固定魂力5200。',
    基础使用次数: 1,
    使用效果: [{ 原型: '资源变化', 目标: '自身', 资源: '魂力', 数值: '+5200' }],
  },
  '7级密封奶瓶': {
    价格: 20000000,
    货币: '联邦币',
    分类: '一次性道具',
    描述: '七级密封奶瓶，储存稳定魂力的密封魂导补给瓶，使用后恢复固定魂力11000。',
    基础使用次数: 1,
    使用效果: [{ 原型: '资源变化', 目标: '自身', 资源: '魂力', 数值: '+11000' }],
  },
};

var TangmenShopProducts = {
  玄天功秘籍: {
    价格: 500,
    货币: '唐门积分',
    分类: '修炼秘籍',
    描述: '唐门基础内功心法，修炼后可大幅提升魂力恢复速度与精纯度。',
    获取条件: { 势力: '唐门' },
    研读条件: {},
    解锁内容: [{ 内容类型: '功法', 内容名称: '玄天功', 初始境界: '入门' }],
  },
  紫极魔瞳秘籍: {
    价格: 500,
    货币: '唐门积分',
    分类: '修炼秘籍',
    描述: '唐门瞳术，修炼后可提升视力、动态视觉与精神力。',
    获取条件: { 势力: '唐门' },
    研读条件: {},
    解锁内容: [{ 内容类型: '功法', 内容名称: '紫极魔瞳', 初始境界: '纵观' }],
  },
  玄玉手秘籍: {
    价格: 800,
    货币: '唐门积分',
    分类: '修炼秘籍',
    描述: '唐门手法，修炼后可强化双手抗性、近身控拿与卸力能力。',
    获取条件: { 势力: '唐门' },
    研读条件: {},
    解锁内容: [{ 内容类型: '功法', 内容名称: '玄玉手', 初始境界: '入门' }],
  },
  鬼影迷踪步秘籍: {
    价格: 800,
    货币: '唐门积分',
    分类: '修炼秘籍',
    描述: '唐门身法，修炼后可提升步法变化、闪避与近身切位能力。',
    获取条件: { 势力: '唐门' },
    研读条件: {},
    解锁内容: [{ 内容类型: '功法', 内容名称: '鬼影迷踪步', 初始境界: '入门' }],
  },
  控鹤擒龙秘籍: {
    价格: 1200,
    货币: '唐门积分',
    分类: '修炼秘籍',
    描述: '唐门擒拿控劲绝学，修炼后可掌握隔空牵引、卸力与夺势。',
    获取条件: { 势力: '唐门' },
    研读条件: {},
    解锁内容: [{ 内容类型: '功法', 内容名称: '控鹤擒龙', 初始境界: '入门' }],
  },
  暗器百解: {
    价格: 2000,
    货币: '唐门积分',
    分类: '修炼秘籍',
    描述: '记录了唐门上百种暗器制作与手法的总纲。',
    获取条件: { 势力: '唐门', 阶级: ['黄级', '紫级', '黑级', '红级', '长老', '殿主'] },
    研读条件: {},
    解锁内容: [{ 内容类型: '功法', 内容名称: '暗器百解', 初始境界: '入门' }],
  },
  百年炽火阳泉草: {
    价格: 8000,
    货币: '唐门积分',
    分类: '天然灵物',
    描述: '生长于冰火两仪眼阳泉旁的百年灵草，蕴含纯粹的火属性能量。',
    需求: { 势力: '唐门', 阶级: ['黄级', '紫级', '黑级', '红级', '长老', '殿主'] },
    使用效果: [{ 原型: '灵物吸收', 目标: '自身', 属性: '吸收灵物年限', 数值: 100 }],
  },
  千年寒极冰晶花: {
    价格: 50000,
    货币: '唐门积分',
    分类: '天然灵物',
    描述: '生长于冰火两仪眼寒泉旁的千年奇花，蕴含极致的冰属性能量。',
    需求: { 势力: '唐门', 阶级: ['紫级', '黑级', '红级', '长老', '殿主'] },
    使用效果: [{ 原型: '灵物吸收', 目标: '自身', 属性: '吸收灵物年限', 数值: 1000 }],
  },
  万年望穿秋水露: {
    价格: 250000,
    货币: '唐门积分',
    分类: '天然灵物',
    描述: '冰火两仪眼孕育的万年仙品，服用后可极大增强精神力与视力。',
    需求: { 势力: '唐门', 阶级: ['红级', '长老', '殿主'] },
    使用效果: [{ 原型: '灵物吸收', 目标: '自身', 属性: '吸收灵物年限', 数值: 10000 }],
  },
  万年魂骨兑换凭证: {
    价格: 500000,
    货币: '唐门积分',
    分类: '剧情杂物',
    描述: '唐门最高级别的奖励之一。可从宗门宝库中挑选一块万年魂骨。',
    需求: { 势力: '唐门', 阶级: ['红级', '长老', '殿主'] },
  },
};

var ShrekAcademyShopProducts = {
  百年龙鳞果: {
    价格: 500,
    货币: '学院积分',
    分类: '天然灵物',
    描述: '百年级别的灵果，能小幅强化气血。',
    需求: { 势力: '史莱克学院' },
    使用效果: [{ 原型: '灵物吸收', 目标: '自身', 属性: '吸收灵物年限', 数值: 100 }],
  },
  千年海心莲子: {
    价格: 8000,
    货币: '学院积分',
    分类: '天然灵物',
    描述: '千年级别的仙品莲子，能显著提升精神力。',
    需求: { 势力: '史莱克学院' },
    使用效果: [{ 原型: '灵物吸收', 目标: '自身', 属性: '吸收灵物年限', 数值: 1000 }],
  },
  万年绮罗郁金香: {
    价格: 120000,
    货币: '学院积分',
    分类: '天然灵物',
    描述: '万年级别的仙品，服用后可百毒不侵。',
    需求: { 势力: '史莱克学院', 阶级: ['内院弟子', '史莱克七怪', '老师', '宿老', '阁主'] },
    使用效果: [{ 原型: '灵物吸收', 目标: '自身', 属性: '吸收灵物年限', 数值: 10000 }],
  },
  十万年绮罗郁金香: {
    价格: 3000000,
    货币: '学院积分',
    分类: '天然灵物',
    描述: '十万年级别的仙品，七字武魂突破八十级的重要门槛灵物。',
    需求: { 势力: '史莱克学院', 阶级: ['宿老', '阁主', '史莱克七怪'] },
    使用效果: [{ 原型: '灵物吸收', 目标: '自身', 属性: '吸收灵物年限', 数值: 100000 }],
  },
  万年魂骨兑换凭证: {
    价格: 300000,
    货币: '学院积分',
    分类: '剧情杂物',
    描述: '史莱克学院内院的核心奖励。每人仅限兑换一次。',
    需求: {
      势力: '史莱克学院',
      阶级: ['内院弟子', '史莱克七怪', '老师', '宿老', '阁主'],
      限购标记: 'redeemed_10k_bone',
    },
  },
  十万年魂骨兑换凭证: {
    价格: 1000000,
    货币: '学院积分',
    分类: '剧情杂物',
    描述: '史莱克学院的至高奖励。每人终身仅限兑换一次。',
    需求: { 势力: '史莱克学院', 阶级: ['宿老', '阁主', '史莱克七怪'], 限购标记: 'redeemed_100k_bone' },
  },
};

var AssociationShopProducts = {
  锻造师协会: {
    百锻金属块: {
      价格: 50000,
      货币: '联邦币',
      分类: '锻造金属',
      描述: '经过百次锻打的金属，是锻造师的基础材料。',
      阶位: 1,
      品质: '普通',
      库存: 6,
      批次: [{ 数量: 6, 基础金属: '钢精', 品质: '普通' }],
    },
    千锻金属块: {
      价格: 500000,
      货币: '联邦币',
      分类: '锻造金属',
      描述: '千锤百炼的稀有金属，拥有了初步的灵性。',
      阶位: 2,
      品质: '优秀',
      库存: 4,
      批次: [{ 数量: 4, 基础金属: '沉银', 品质: '优秀' }],
    },
    灵锻金属块: {
      价格: 10000000,
      货币: '联邦币',
      分类: '锻造金属',
      描述: '被赋予生命的金属，是四级以上锻造师的杰作。',
      阶位: 3,
      品质: '史诗',
      库存: 2,
      批次: [{ 数量: 2, 基础金属: '魔银', 品质: '史诗' }],
    },
    魂锻金属块: {
      价格: 80000000,
      货币: '联邦币',
      分类: '锻造金属',
      描述: '与灵魂相融的金属，圣匠的标志。',
      阶位: 4,
      品质: '史诗',
      库存: 1,
      批次: [{ 数量: 1, 基础金属: '星陨铁', 品质: '史诗' }],
    },
    天锻金属块: {
      价格: 500000000,
      货币: '联邦币',
      分类: '锻造金属',
      描述: '引动天地法则淬炼而成的神级金属。',
      阶位: 5,
      品质: '传说',
      库存: 1,
      批次: [{ 数量: 1, 基础金属: '七彩沉银', 品质: '传说' }],
    },
  },
  设计师协会: {
    一字斗铠设计图: {
      价格: 100000,
      货币: '联邦币',
      分类: '设计图纸',
      描述: '标准的一字斗铠设计蓝图。',
      图纸目标: '一字斗铠',
    },
    二字斗铠设计图: {
      价格: 2000000,
      货币: '联邦币',
      分类: '设计图纸',
      描述: '蕴含领域雏形的二字斗铠设计图。',
      图纸目标: '二字斗铠',
    },
    三字斗铠设计图: {
      价格: 20000000,
      货币: '联邦币',
      分类: '设计图纸',
      描述: '能够赋予斗铠真正领域的三字斗铠设计图。',
      图纸目标: '三字斗铠',
    },
    四字斗铠设计图: {
      价格: 150000000,
      货币: '联邦币',
      分类: '设计图纸',
      描述: '传说中的四字斗铠设计图。',
      图纸目标: '四字斗铠',
    },
  },
  机甲师协会: {
    黄级机甲现货: {
      价格: 6000000,
      货币: '联邦币',
      分类: '机甲机体',
      描述: '制式黄级机甲现货，流水线标准机体。',
      品质: '优秀',
    },
    紫级机甲现货: {
      价格: 80000000,
      货币: '联邦币',
      分类: '机甲机体',
      描述: '制式紫级机甲现货，性能明显高于黄级机甲。',
      品质: '稀有',
    },
    黑级机甲现货: {
      价格: 1000000000,
      货币: '联邦币',
      分类: '机甲机体',
      描述: '制式黑级机甲现货，高阶机甲师使用的重型机体。',
      品质: '史诗',
    },
  },
  修理师协会: {
    基础维护套件: {
      价格: 50000,
      货币: '联邦币',
      分类: '一次性道具',
      描述: '用于机甲和魂导器的日常保养。',
      使用效果: [{ 原型: '耐久修复', 目标: '自身', 修复等级: '轻度磨损' }],
    },
    精密修复模块: {
      价格: 500000,
      货币: '联邦币',
      分类: '一次性道具',
      品质: '优秀',
      描述: '可以修复机甲或斗铠的中度损伤。',
      使用效果: [{ 原型: '耐久修复', 目标: '自身', 修复等级: '中重度损伤' }],
    },
    机甲超频模块: {
      价格: 500000,
      货币: '联邦币',
      分类: '一次性道具',
      描述: '一次性模块，能让机甲在短时间内爆发出超越极限的性能。',
      基础使用次数: 1,
      使用效果: [
        { 原型: '属性修正', 目标: '自身', 属性: '机甲输出', 数值: '+18%', 持续回合: 2 },
        { 原型: '属性修正', 目标: '自身', 属性: '机甲耐久损耗', 数值: '+10%', 持续回合: 2 },
      ],
    },
    斗铠本源蕴养液: {
      价格: 20000000,
      货币: '联邦币',
      分类: '一次性道具',
      品质: '史诗',
      描述: '极其珍贵的蕴养液，能修复受损的斗铠本源。',
      使用效果: [{ 原型: '耐久修复', 目标: '自身', 修复等级: '斗铠本源伤' }],
    },
    神级重塑核心: {
      价格: 500000000,
      货币: '联邦币',
      分类: '一次性道具',
      品质: '传说',
      描述: '传说中的物品，据说能让彻底损毁的斗铠甚至神器重获新生。',
      使用效果: [{ 原型: '耐久修复', 目标: '自身', 修复等级: '彻底损毁' }],
    },
  },
};

function 规范化商品模板为物品定义_V1(商品名 = '', 商品模板 = {}) {
  const 模板 = 商品模板 && typeof 商品模板 === 'object' && !Array.isArray(商品模板) ? 商品模板 : {};
  const 分类 = 要求物品定义分类_V1(商品名, 模板);
  const 定义 = {
    分类,
    品质: String(模板.品质 || 模板.品阶 || '普通').trim() || '普通',
    描述: String(模板.描述 || `可交易物品【${商品名}】。`).trim(),
    默认货币: String(模板.默认货币 || 模板.货币 || '联邦币').trim() || '联邦币',
  };
  const 基础价格 = 读取显式物品基础价格_V1(模板);
  if (基础价格 !== undefined) 定义.基础价格 = 基础价格;
  if (分类 === '魂灵') {
    const 魂灵品质 = normalizeSoulSpiritQuality(模板.魂灵品质 || '');
    if (魂灵品质) 定义.魂灵品质 = 魂灵品质;
    if (String(模板.表象名称 || '').trim()) 定义.表象名称 = String(模板.表象名称).trim();
    if (String(模板.标准物种 || '').trim()) 定义.标准物种 = String(模板.标准物种).trim();
    if (Number(模板.年限 || 0) > 0) 定义.年限 = Math.max(0, Math.floor(Number(模板.年限 || 0)));
    return 规范化物品定义_V1(商品名, 定义, 分类);
  }
  if (分类 === '锻造金属') {
    定义.阶位 = Math.max(0, Math.min(5, Math.floor(Number(模板.阶位 || 0))));
    const 金属特性 = Array.isArray(模板.金属特性)
      ? [...new Set(模板.金属特性.map(特性 => String(特性 || '').trim()).filter(Boolean))]
      : [];
    if (金属特性.length) 定义.金属特性 = 金属特性;
  }
  if (Number(模板.魂导等级 || 0) > 0) 定义.魂导等级 = Math.max(1, Math.min(12, Math.floor(Number(模板.魂导等级 || 0))));
  if (String(模板.装备槽位 || '').trim()) 定义.装备槽位 = String(模板.装备槽位).trim();
  if (Number(模板.基础耐久 || 0) > 0) 定义.基础耐久 = Math.max(0, Math.floor(Number(模板.基础耐久 || 0)));
  if (Number(模板.基础使用次数 || 0) > 0) 定义.基础使用次数 = Math.max(1, Math.floor(Number(模板.基础使用次数 || 0)));
  if (Array.isArray(模板.使用效果) && 模板.使用效果.length) 定义.使用效果 = cloneJsonValue(模板.使用效果, []);
  if (模板.加成方向 !== undefined) 定义.加成方向 = cloneJsonValue(模板.加成方向, []);
  if (模板.属性加成 && typeof 模板.属性加成 === 'object' && !Array.isArray(模板.属性加成)) 定义.属性加成 = cloneJsonValue(模板.属性加成, {});
  if (模板.属性倍率 && typeof 模板.属性倍率 === 'object' && !Array.isArray(模板.属性倍率)) 定义.属性倍率 = cloneJsonValue(模板.属性倍率, {});
  if (模板.装备技能 && typeof 模板.装备技能 === 'object' && !Array.isArray(模板.装备技能)) 定义.装备技能 = cloneJsonValue(模板.装备技能, {});
  if (模板.附带魂技 && typeof 模板.附带魂技 === 'object' && !Array.isArray(模板.附带魂技)) 定义.附带魂技 = cloneJsonValue(模板.附带魂技, {});
  if (分类 === '设计图纸' && String(模板.图纸目标 || '').trim()) 定义.图纸目标 = 模板.图纸目标;
  if (分类 === '修炼秘籍') {
    if (模板.获取条件 !== undefined) 定义.获取条件 = 模板.获取条件;
    if (模板.研读条件 !== undefined) 定义.研读条件 = 模板.研读条件;
    if (模板.解锁内容 !== undefined) 定义.解锁内容 = 模板.解锁内容;
  }
  return 规范化物品定义_V1(商品名, 定义, 分类);
}

function 写入物品定义并生成库存状态_V1(data = {}, 商品名 = '', 商品模板 = {}, 库存数量 = null) {
  确保物品分类表_V1(data);
  const 模板 = 商品模板 && typeof 商品模板 === 'object' && !Array.isArray(商品模板) ? 商品模板 : {};
  const 库存 = Math.max(0, Math.floor(Number(库存数量 ?? 模板.库存 ?? 1)));
  const 库存状态 = {
    库存: Math.max(0, Math.floor(Number(库存数量 ?? 模板.库存 ?? 1))),
    价格倍率: Math.max(0, Number(模板.价格倍率 || 1)),
    折扣: Math.max(0, Math.min(1, Number(模板.折扣 || 0))),
    需求声望: Math.max(0, Math.floor(Number(模板.需求声望 || 0))),
    需求: 模板.需求 && typeof 模板.需求 === 'object' && !Array.isArray(模板.需求) ? cloneJsonValue(模板.需求, {}) : {},
  };
  if (Array.isArray(模板.批次) && 模板.批次.length) {
    库存状态.批次 = 模板.批次
      .map(批次 => (批次 && typeof 批次 === 'object' && !Array.isArray(批次) ? cloneJsonValue(批次, {}) : null))
      .filter(Boolean);
    if (库存状态.批次.length === 1) 库存状态.批次[0].数量 = 库存;
  }
  return 库存状态;
}

function 合并商品模板到库存_V1(data = {}, 库存 = {}, 商品模板表 = {}) {
  _(商品模板表 || {}).forEach((商品模板, 商品名) => {
    库存[商品名] = 写入物品定义并生成库存状态_V1(data, 商品名, 商品模板);
  });
}

function 构建传灵塔商品模板_V1(数据根 = {}, 物品名 = '') {
  const 名称 = String(物品名 || '').trim();
  const 千年魂灵价格 = 判断传灵塔万年魂灵开放_V1(数据根) ? 6000000 : 20000000;
  const 模板表 = {
    '十年魂灵·随机型': { 价格: 50000, 货币: '联邦币', 分类: '魂灵', 品质: '普通', 魂灵品质: 'C', 年限: 10, 描述: '最基础的人造魂灵，适合平民魂师。' },
    '百年魂灵·随机型': { 价格: 1000000, 货币: '联邦币', 分类: '魂灵', 品质: '优秀', 魂灵品质: 'C', 年限: 100, 描述: '品质尚可的百年魂灵。' },
    '千年魂灵·随机型': { 价格: 千年魂灵价格, 货币: '联邦币', 分类: '魂灵', 品质: '稀有', 魂灵品质: 'B', 年限: 1000, 描述: 判断传灵塔万年魂灵开放_V1(数据根) ? '技术成熟后的量产千年魂灵，价格已大幅下降。' : '当前技术下极难培育的千年魂灵，造价高昂。' },
    '万年魂灵·随机型': { 价格: 100000000, 货币: '联邦币', 分类: '魂灵', 品质: '史诗', 魂灵品质: 'A', 年限: 10000, 描述: '传灵塔尖端科技结晶，万年级别魂灵！' },
    初级升灵台门票: { 价格: 500000, 货币: '联邦币', 分类: '入场凭证', 描述: '可进入初级升灵台，最高遭遇3千年以下虚拟魂兽。' },
    中级升灵台门票: { 价格: 5000000, 货币: '联邦币', 分类: '入场凭证', 描述: '可进入中级升灵台，最高遭遇2万年以下虚拟魂兽。' },
    高级升灵台门票: { 价格: 50000000, 货币: '联邦币', 分类: '入场凭证', 描述: '可进入高级升灵台，最高遭遇10万年以下虚拟魂兽。' },
    魂灵塔门票: { 价格: 20000000, 货币: '联邦币', 分类: '入场凭证', 描述: '仅限史莱克城传灵塔总部核发，可进入魂灵塔挑战当前可冲击的下一层。' },
  };
  return 模板表[名称] || null;
}

function 收集拍卖地点候选_V1(数据根 = {}) {
  const 候选列表 = [];
  const 访问节点 = (节点 = null, 节点名 = '', 路径 = []) => {
    if (!节点 || typeof 节点 !== 'object' || Array.isArray(节点)) return;
    if (typeof 节点.condition === 'function' && !节点.condition(数据根)) return;
    const 当前路径 = [...路径, String(节点名 || '').trim()].filter(Boolean);
    const 合并文本 = [
      节点名,
      当前路径.join('-'),
      节点.类型,
      节点.描述,
      节点.说明,
      节点.经济状况,
      节点.标签,
    ].flat().map(值 => String(值 || '')).join(' ');
    if (/拍卖场|拍卖|交易中心/.test(合并文本)) {
      let 评分 = 0;
      if (/拍卖场/.test(合并文本)) 评分 += 100;
      if (/拍卖/.test(合并文本)) 评分 += 80;
      if (/交易中心/.test(合并文本)) 评分 += 60;
      if (String(节点.经济状况 || '') === '繁荣') 评分 += 12;
      if (String(节点.经济状况 || '') === '萧条') 评分 -= 8;
      const 重要度 = Number(节点.重要度 ?? 节点.重要性 ?? 节点.城市等级 ?? 0);
      if (Number.isFinite(重要度)) 评分 += Math.max(0, Math.min(30, 重要度));
      if (/史莱克|明都|天斗|星罗|东海/.test(当前路径.join('-'))) 评分 += 8;
      评分 += Math.min(8, 当前路径.length);
      候选列表.push({
        名称: 当前路径.join('-') || String(节点名 || '').trim(),
        路径: 当前路径,
        节点,
        评分,
      });
    }
    Object.entries(节点.子节点 || {}).forEach(([子节点名, 子节点]) => 访问节点(子节点, 子节点名, 当前路径));
  };
  Object.entries(数据根?.world?.地点 || {}).forEach(([地点名, 地点节点]) => 访问节点(地点节点, 地点名, []));
  return 候选列表.sort((a, b) => b.评分 - a.评分);
}

function 构建拍卖专用模板表_V1(数据根 = {}) {
  const 万年魂灵开放 = 判断传灵塔万年魂灵开放_V1(数据根);
  return {
    万年灵物匣: {
      价格: 45000000,
      货币: '联邦币',
      分类: '天然灵物',
      品质: '史诗',
      描述: '拍卖场封存的万年级灵物匣，可用于高阶修炼突破。',
      使用效果: [{ 原型: '灵物吸收', 目标: '自身', 属性: '吸收灵物年限', 数值: 10000 }],
    },
    魂锻金属块: {
      价格: 80000000,
      货币: '联邦币',
      分类: '锻造金属',
      品质: '史诗',
      阶位: 4,
      描述: '圣匠级魂锻金属，适合作为高阶斗铠核心材料。',
    },
    天锻金属块: {
      价格: 500000000,
      货币: '联邦币',
      分类: '锻造金属',
      品质: '传说',
      阶位: 5,
      描述: '引动天地法则淬炼而成的神级金属。',
    },
    三字斗铠设计图: {
      价格: 20000000,
      货币: '联邦币',
      分类: '设计图纸',
      品质: '史诗',
      图纸目标: '三字斗铠',
      描述: '能够赋予斗铠真正领域的三字斗铠设计图。',
    },
    四字斗铠设计图: {
      价格: 150000000,
      货币: '联邦币',
      分类: '设计图纸',
      品质: '传说',
      图纸目标: '四字斗铠',
      描述: '传说中的四字斗铠设计图。',
    },
    高级升灵台门票: {
      价格: 50000000,
      货币: '联邦币',
      分类: '入场凭证',
      品质: '史诗',
      描述: '可进入高级升灵台，最高遭遇10万年以下虚拟魂兽。',
    },
    '万年魂灵·随机型': {
      价格: 万年魂灵开放 ? 100000000 : 180000000,
      货币: '联邦币',
      分类: '魂灵',
      品质: '史诗',
      魂灵品质: 'A',
      年限: 10000,
      描述: '传灵塔尖端科技结晶，万年级别魂灵。',
    },
  };
}

function 拍卖物品可进入普通拍卖_V1(物品名 = '', 定义 = {}, 分类 = '', 来源 = '物品库') {
  const 名称 = String(物品名 || '').trim();
  if (!名称 || !定义 || typeof 定义 !== 'object' || Array.isArray(定义)) return false;
  const 货币 = String(定义.默认货币 || 定义.货币 || '联邦币').trim() || '联邦币';
  if (货币 !== '联邦币') return false;
  const 价格 = 读取显式物品基础价格_V1(定义) ?? 0;
  if (价格 < 500000) return false;
  const 分类名 = 规范化物品分类_V1(分类 || 定义.分类 || 定义.物品分类 || '', '');
  const 允许物品库分类 = ['锻造金属', '设计图纸', '斗铠部件', '机甲机体', '入场凭证'];
  const 允许模板分类 = ['锻造金属', '设计图纸', '天然灵物', '魂灵', '入场凭证'];
  if (来源 === '拍卖模板' ? !允许模板分类.includes(分类名) : !允许物品库分类.includes(分类名)) return false;
  const 文本 = `${名称} ${分类名} ${定义.品质 || ''} ${定义.描述 || ''} ${定义.来源 || ''}`;
  if (/海神三叉戟|黄金龙枪|白银龙枪|天圣裂渊戟|擎天神枪|超神器|神器|神级核心|位面核心|封神台|冰神之心|龙神|海神|冰神|法蓝|麒麟珠|神珠|神梭|仅存|遗留|赠予|提供|唯一|专属|绑定|剧情唯一/.test(文本)) return false;
  return true;
}

function 收集拍卖物品候选_V1(数据根 = {}) {
  const 候选表 = new Map();
  const 记录候选 = (物品名 = '', 定义 = {}, 分类 = '', 来源 = '物品库') => {
    const 名称 = String(物品名 || '').trim();
    const 分类名 = 规范化物品分类_V1(分类 || 定义?.分类 || 定义?.物品分类 || '', '');
    if (!名称 || !分类名 || 候选表.has(名称)) return;
    const 已有定义 = 查找物品定义_V1(数据根, 名称);
    if (已有定义 && 已有定义.分类 !== 分类名) return;
    const 规范定义 = 规范化物品定义_V1(名称, 定义, 分类名);
    if (!规范定义 || !拍卖物品可进入普通拍卖_V1(名称, 规范定义, 分类名, 来源)) return;
    const 价格 = Math.max(1, Math.floor(Number(规范定义.基础价格 ?? 1)));
    const 品质 = 规范化物品经济品质_V1(规范定义.品质 || '普通', 名称, 分类名);
    const 品质评分 = { 普通: 0, 优秀: 8, 稀有: 18, 史诗: 32, 传说: 48 }[品质] || 0;
    const 分类评分 = { 魂灵: 24, 魂骨: 24, 机甲机体: 20, 斗铠部件: 18, 设计图纸: 16, 锻造金属: 14, 天然灵物: 14, 入场凭证: 10 }[分类名] || 0;
    候选表.set(名称, {
      名称,
      分类: 分类名,
      定义: 规范定义,
      来源,
      评分: Math.log10(价格 + 10) * 10 + 品质评分 + 分类评分,
    });
  };
  遍历物品定义_V1(构建引用水合物品表_V1(数据根), 记录候选);
  Object.entries(构建拍卖专用模板表_V1(数据根)).forEach(([物品名, 模板]) => {
    记录候选(物品名, 规范化商品模板为物品定义_V1(物品名, 模板), 模板.分类, '拍卖模板');
  });
  return Array.from(候选表.values()).sort((a, b) => b.评分 - a.评分);
}

function 写入拍卖休市_V1(数据根 = {}, 当前tick = 0, 刷新间隔 = 1008) {
  if (!数据根.world || typeof 数据根.world !== 'object') 数据根.world = {};
  数据根.world.拍卖 = {
    ...(数据根.world.拍卖 && typeof 数据根.world.拍卖 === 'object' && !Array.isArray(数据根.world.拍卖) ? 数据根.world.拍卖 : {}),
    状态: '休市',
    地点: '无',
    拍品: {},
    下次刷新tick: Math.max(0, Math.floor(Number(当前tick || 0))) + Math.max(1, Math.floor(Number(刷新间隔 || 1008))),
  };
}

function 刷新世界拍卖供给_V1(数据根 = {}, 当前tick = 0, 刷新间隔 = 1008) {
  if (!数据根.world || typeof 数据根.world !== 'object') 数据根.world = {};
  if (!数据根.world.拍卖 || typeof 数据根.world.拍卖 !== 'object' || Array.isArray(数据根.world.拍卖)) {
    数据根.world.拍卖 = { 状态: '休市', 地点: '无', 拍品: {}, 下次刷新tick: 0 };
  }
  const 当前拍卖 = 数据根.world.拍卖;
  const 安全当前tick = Math.max(0, Math.floor(Number(当前tick || 0)));
  if (安全当前tick < Math.max(0, Number(当前拍卖.下次刷新tick || 0))) return;
  const 地点候选 = 收集拍卖地点候选_V1(数据根);
  if (!地点候选.length) {
    写入拍卖休市_V1(数据根, 安全当前tick, 刷新间隔);
    return;
  }
  const 物品候选 = 收集拍卖物品候选_V1(数据根);
  if (!物品候选.length) {
    写入拍卖休市_V1(数据根, 安全当前tick, 刷新间隔);
    return;
  }
  const 本期地点 = 地点候选[Math.floor(Math.random() * Math.min(3, 地点候选.length))] || 地点候选[0];
  const 拍品数量 = Math.min(物品候选.length, Math.floor(Math.random() * 4) + 3);
  const 已选候选 = 物品候选
    .map(候选 => ({ ...候选, 抽取权重: 候选.评分 * (0.65 + Math.random()) }))
    .sort((a, b) => b.抽取权重 - a.抽取权重)
    .slice(0, 拍品数量);
  const 拍品 = {};
  已选候选.forEach(候选 => {
    const 已有定义 = 查找物品定义_V1(数据根, 候选.名称);
    if (!已有定义) 写入分类物品定义_V1(数据根, 候选.名称, 候选.定义, 候选.分类);
    const 品质倍率 = { 普通: 1.05, 优秀: 1.12, 稀有: 1.2, 史诗: 1.32, 传说: 1.5 }[候选.定义.品质] || 1.15;
    const 价格 = Math.max(1, Math.floor(Number(候选.定义.基础价格 ?? 1) * 品质倍率 * (1 + Math.random() * 0.18)));
    拍品[候选.名称] = {
      分类: 候选.分类,
      品级: 候选.定义.品质 || '普通',
      背景: `${本期地点.名称}本期上拍：${候选.定义.描述 || '稀有拍品'}`,
      价格,
    };
  });
  数据根.world.拍卖 = {
    状态: '开市',
    地点: 本期地点.名称,
    拍品,
    下次刷新tick: 安全当前tick + Math.max(1, Math.floor(Number(刷新间隔 || 1008))),
  };
}

function 查找商店商品模板定义_V1(数据根 = {}, 物品名 = '') {
  const 名称 = String(物品名 || '').trim();
  if (!名称) return null;
  const 查表 = 商品模板表 => {
    const 模板 = 商品模板表 && typeof 商品模板表 === 'object' && !Array.isArray(商品模板表) ? 商品模板表[名称] : null;
    return 模板 && typeof 模板 === 'object' && !Array.isArray(模板) ? 模板 : null;
  };
  const 直接模板 = 查表(BaseProductPool) || 查表(TangmenShopProducts) || 查表(ShrekAcademyShopProducts);
  if (直接模板) return { 物品名: 名称, 定义: 规范化商品模板为物品定义_V1(名称, 直接模板), 分类: 要求物品定义分类_V1(名称, 直接模板) };
  for (const 商品模板表 of Object.values(AssociationShopProducts || {})) {
    const 模板 = 查表(商品模板表);
    if (模板) return { 物品名: 名称, 定义: 规范化商品模板为物品定义_V1(名称, 模板), 分类: 要求物品定义分类_V1(名称, 模板) };
  }
  const 传灵塔模板 = 构建传灵塔商品模板_V1(数据根, 名称);
  if (传灵塔模板) return { 物品名: 名称, 定义: 规范化商品模板为物品定义_V1(名称, 传灵塔模板), 分类: 要求物品定义分类_V1(名称, 传灵塔模板) };
  return null;
}

function 查找运行时物品定义_V1(数据根 = {}, 物品名 = '') {
  const 名称 = String(物品名 || '').trim();
  if (!名称) return null;
  const 热区定义 = 查找物品定义_V1(数据根, 名称);
  if (热区定义) return { 物品名: 名称, 定义: cloneJsonValue(热区定义.定义, {}), 分类: 热区定义.分类, 来源: '热区' };
  const 商品定义 = 查找商店商品模板定义_V1(数据根, 名称);
  if (商品定义) return { ...商品定义, 定义: cloneJsonValue(商品定义.定义, {}), 来源: '商店模板' };
  const 内置定义 = 查找内置物品定义_V1(名称);
  if (内置定义) return { 物品名: 名称, 定义: cloneJsonValue(内置定义.定义, {}), 分类: 内置定义.分类, 来源: '内置物品库' };
  return null;
}

var 传灵塔万年魂灵开放tick_V1 = 814960;

function 判断传灵塔万年魂灵开放_V1(数据根 = {}) {
  const 当前tick = Math.max(0, Math.floor(Number(数据根?.world?.时间?.tick || 0)));
  if (当前tick < 传灵塔万年魂灵开放tick_V1) return false;
  const 角色表 = 数据根?.char && typeof 数据根.char === 'object' && !Array.isArray(数据根.char) ? 数据根.char : {};
  const 目标角色名列表 = ['古月', '古月娜'];
  return 目标角色名列表.some(角色名 => {
    const 角色 =
      角色表[角色名] ||
      Object.values(角色表).find(候选 => {
        if (!候选 || typeof 候选 !== 'object' || Array.isArray(候选)) return false;
        return [候选.name, 候选?.base?.name, 候选?.属性?.姓名].some(名称 => String(名称 || '').trim() === 角色名);
      });
    if (!角色 || typeof 角色 !== 'object' || Array.isArray(角色)) return false;
    const 位置 = String(角色?.状态?.位置 || '').trim();
    const 势力 = 角色?.社交?.势力;
    return 位置.includes('传灵塔') && !!(势力 && typeof 势力 === 'object' && !Array.isArray(势力) && 势力['传灵塔']);
  });
}

function markPlayerCharacterInSchemaInput(rawInput) {
  开始MVU归一化批次_V1();
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) return rawInput;
  const clonedInput = _.cloneDeep(rawInput);
  const 候选根列表 = [
    clonedInput,
    clonedInput?.stat_data,
    clonedInput?.display_data,
    clonedInput?.char?.stat_data,
    clonedInput?.char?.display_data,
  ];
  const 记录候选原始等级 = candidate => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return;
    const charMap = candidate?.char;
    if (!charMap || typeof charMap !== 'object' || Array.isArray(charMap)) return;
    Object.entries(charMap).forEach(([charName, charData]) => {
      if (!charName || !charData || typeof charData !== 'object' || Array.isArray(charData)) return;
      const 原始等级 = Math.max(0, Number(charData?.属性?.等级 || 0) || 0);
      记录本轮原始角色等级_V1(charName, 原始等级);
      const 显示名 = String(charData?.name || charData?.属性?.name || charData?.base?.name || '').trim();
      if (显示名 && 显示名 !== charName) 记录本轮原始角色等级_V1(显示名, 原始等级);
      const 原始天赋梯队 = 规范化显式天赋梯队_V1(charData?.属性?.天赋梯队);
      if (原始天赋梯队) charData.__mvu_显式天赋梯队 = 原始天赋梯队;
      else delete charData.__mvu_显式天赋梯队;
    });
  };
  const markCandidate = candidate => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return;
    const playerName = String(candidate?.sys?.玩家名 || '').trim();
    const charMap = candidate?.char;
    if (!playerName || !charMap || typeof charMap !== 'object' || Array.isArray(charMap)) return;
    Object.values(charMap).forEach(charData => {
      if (charData && typeof charData === 'object' && !Array.isArray(charData)) {
        delete charData.__mvu_isPlayer;
      }
    });
    if (charMap[playerName] && typeof charMap[playerName] === 'object' && !Array.isArray(charMap[playerName])) {
      charMap[playerName].__mvu_isPlayer = true;
      return;
    }
    const matchedKey = Object.keys(charMap).find(charKey => {
      const charData = charMap[charKey];
      if (!charData || typeof charData !== 'object' || Array.isArray(charData)) return false;
      const displayName = String(charData?.name || charData?.属性?.name || charData?.base?.name || charKey || '').trim();
      return displayName === playerName;
    });
    if (matchedKey) {
      charMap[matchedKey].__mvu_isPlayer = true;
    }
  };
  候选根列表.forEach(记录候选原始等级);
  候选根列表.forEach(水合角色物品引用_V1);
  候选根列表.forEach(记录数据根非魂师角色_V1);
  候选根列表.forEach(markCandidate);
  return clonedInput;
}

function 计算内置角色提前年数_V1(快照 = {}, 当前tick = 0) {
  const 快照tick = Number(快照?.tick);
  if (!Number.isFinite(快照tick)) return 0;
  const 提前tick = 快照tick - Number(当前tick || 0);
  if (!(提前tick > 1)) return 0;
  const 每年tick = Math.max(1, Number(读取内置角色库_V1().每年tick || 51840));
  return 提前tick / 每年tick;
}

function 是否内置角色预备出场_V1(快照 = {}, 当前tick = 0) {
  const 快照tick = Number(快照?.tick);
  if (!Number.isFinite(快照tick)) return false;
  const 提前tick = 快照tick - Number(当前tick || 0);
  return 提前tick > 1 && 提前tick <= 内置角色预备出场窗口tick_V1;
}

function 格式化提前出场年数文本_V1(提前年数 = 0) {
  const 安全年数 = Math.max(0, Number(提前年数 || 0));
  if (安全年数 >= 1) return `约${Math.max(1, Math.round(安全年数))}年后`;
  return `约${Math.max(1, Math.round(安全年数 * 12))}个月后`;
}

function 构建提前出场未来身份提示_V1(快照 = {}, 提前年数 = 0) {
  const 角色 = 快照?.角色 || {};
  const 片段 = [];
  const 添加片段 = 值 => {
    String(值 || '')
      .split(/[\/、,，\-—>]+/)
      .map(项 => 项.trim())
      .filter(Boolean)
      .forEach(项 => {
        if (!片段.includes(项)) 片段.push(项);
      });
  };
  添加片段(角色?.状态?.位置);
  Object.entries(角色?.社交?.势力 || {}).forEach(([势力名, 势力数据]) => {
    添加片段(势力名);
    添加片段(势力数据?.身份);
  });
  添加片段(角色?.社交?.主身份);
  Object.keys(角色?.社交?.称号 || {}).forEach(添加片段);
  if (!片段.length) return '';
  return `原著${格式化提前出场年数文本_V1(提前年数)}时为：${片段.join(' / ')}；请基于当前年龄与剧情时间生成目前身份。`;
}

function 应用提前出场副职业认证投影_V1(副职业表 = {}, 提前年数 = 0) {
  if (!副职业表 || typeof 副职业表 !== 'object' || Array.isArray(副职业表)) return;
  const 总提前年数 = Math.max(0, Number(提前年数 || 0));
  if (!(总提前年数 > 0)) return;
  Object.entries(副职业表).forEach(([副职业名, 副职业数据]) => {
    if (!副职业数据 || typeof 副职业数据 !== 'object' || Array.isArray(副职业数据)) return;
    let 剩余年数 = 总提前年数;
    let 经验 = Math.max(0, Math.floor(Number(副职业数据.经验 || 0)));
    let 等级 = 读取副职业认证等级_V1(副职业名, 副职业数据);
    while (剩余年数 > 0) {
      if (等级 <= 1) break;
      const 降级所需年数 = Math.max(1, 等级 - 1);
      if (剩余年数 < 降级所需年数) break;
      剩余年数 -= 降级所需年数;
      等级 -= 1;
    }
    const 当前等级底线 = Math.max(0, JobExpThresholds[Math.max(0, 等级 - 1)] || 0);
    const 下级经验线 = Math.max(当前等级底线 + 1, JobExpThresholds[Math.min(等级, 9)] || JobExpThresholds[9]);
    if (剩余年数 > 0 && 等级 > 1) {
      const 当前段经验 = Math.max(0, 经验 - 当前等级底线);
      经验 = Math.max(0, Math.floor(经验 - 当前段经验 * Math.min(1, 剩余年数 / Math.max(1, 等级 - 1))));
    }
    if (等级 > 0) 经验 = Math.max(0, Math.min(经验, 下级经验线 - 1));
    副职业数据.等级 = 等级;
    副职业数据.经验 = 经验;
    副职业数据.称号 = 等级 <= 1 ? '无' : String(副职业数据.称号 || '无').trim() || '无';
  });
}

var 内置角色斗铠通用部件列表_V1 = Object.freeze(['头盔', '胸铠', '左肩', '右肩', '左臂', '右臂']);
var 内置角色斗铠等级文本_V1 = Object.freeze(['无', '一', '二', '三', '四']);

function 取内置角色斗铠部件列表_V1(角色 = {}) {
  return [
    ...内置角色斗铠通用部件列表_V1,
    ...(String(角色?.属性?.性别 ?? 角色?.性别 ?? '').includes('女') ? ['战裙'] : ['左腿', '右腿']),
    '战靴',
  ];
}

function 创建空内置角色装备加成_V1(包含等效等级 = false) {
  return {
    ...(包含等效等级 ? { 等效等级: 0 } : {}),
    魂力上限: 0,
    精神力上限: 0,
    力量: 0,
    防御: 0,
    敏捷: 0,
    体力上限: 0,
  };
}

function 补齐内置角色完整斗铠部件_V1(斗铠 = {}, 角色 = {}) {
  const 等级 = Math.max(0, Math.min(4, Math.floor(Number(斗铠?.等级 || 0) || 0)));
  if (等级 <= 0) return;
  if (!斗铠.部件 || typeof 斗铠.部件 !== 'object' || Array.isArray(斗铠.部件)) 斗铠.部件 = {};
  const 部件名列表 = 取内置角色斗铠部件列表_V1(角色);
  const 有效部件名 = new Set(部件名列表);
  Object.keys(斗铠.部件).forEach(部件名 => {
    if (!有效部件名.has(部件名)) delete 斗铠.部件[部件名];
  });
  部件名列表.forEach(部件名 => {
    if (!斗铠.部件[部件名] || typeof 斗铠.部件[部件名] !== 'object') {
      斗铠.部件[部件名] = { 状态: '完好', 品质系数: 1.0 };
    }
  });
}

function 计算内置角色稳定哈希_V1(文本 = '') {
  let 哈希 = 2166136261;
  String(文本 || '').split('').forEach(字符 => {
    哈希 ^= 字符.charCodeAt(0);
    哈希 += (哈希 << 1) + (哈希 << 4) + (哈希 << 7) + (哈希 << 8) + (哈希 << 24);
  });
  return 哈希 >>> 0;
}

function 取内置角色斗铠稳定部件顺序_V1(种子 = '', 部件名列表 = []) {
  return [...部件名列表]
    .sort((a, b) => 计算内置角色稳定哈希_V1(`${种子}|${a}`) - 计算内置角色稳定哈希_V1(`${种子}|${b}`));
}

function 清空内置角色斗铠_V1(角色 = {}) {
  if (!角色.装备 || typeof 角色.装备 !== 'object' || Array.isArray(角色.装备)) 角色.装备 = {};
  if (!角色.装备.斗铠 || typeof 角色.装备.斗铠 !== 'object' || Array.isArray(角色.装备.斗铠)) 角色.装备.斗铠 = {};
  角色.装备.斗铠.等级 = 0;
  角色.装备.斗铠.名称 = '无';
  角色.装备.斗铠.领域 = '无';
  角色.装备.斗铠.材质 = '无';
  角色.装备.斗铠.装备状态 = '未装备';
  角色.装备.斗铠.部件 = {};
  角色.装备.斗铠._属性加成 = 创建空内置角色装备加成_V1(true);
  角色.装备.斗铠._已排异 = false;
  const 武器 = 角色.装备.武器;
  if (武器 && typeof 武器 === 'object' && !Array.isArray(武器) && /斗铠/.test(`${武器.名称 || ''}${武器.品阶 || ''}${武器.描述 || ''}`)) {
    武器.名称 = '无';
    武器.品阶 = '无';
    武器.描述 = '';
  }
}

function 应用内置角色斗铠有效等级_V1(角色 = {}, 有效等级 = 0, 原始斗铠 = {}) {
  const 等级 = Math.max(0, Math.min(4, Math.floor(Number(有效等级 || 0) || 0)));
  if (等级 <= 0) {
    清空内置角色斗铠_V1(角色);
    return;
  }
  if (!角色.装备 || typeof 角色.装备 !== 'object' || Array.isArray(角色.装备)) 角色.装备 = {};
  if (!角色.装备.斗铠 || typeof 角色.装备.斗铠 !== 'object' || Array.isArray(角色.装备.斗铠)) 角色.装备.斗铠 = {};
  角色.装备.斗铠.等级 = 等级;
  if (Number(原始斗铠?.等级 || 0) !== 等级 || !String(角色.装备.斗铠.名称 || '').trim()) {
    角色.装备.斗铠.名称 = `${内置角色斗铠等级文本_V1[等级] || 等级}字斗铠`;
  }
  角色.装备.斗铠.装备状态 = String(原始斗铠?.装备状态 || 角色.装备.斗铠.装备状态 || '未装备');
  角色.装备.斗铠.部件 = {};
  补齐内置角色完整斗铠部件_V1(角色.装备.斗铠, 角色);
  delete 角色.装备.斗铠._属性加成;
  delete 角色.装备.斗铠._已排异;
}

function 应用内置角色斗铠不完整投影_V1(角色 = {}, 等级 = 1, 移除部件数 = 0, 原始斗铠 = {}, 种子 = '') {
  const 部件名列表 = 取内置角色斗铠部件列表_V1(角色);
  const 保留部件 = new Set(部件名列表);
  取内置角色斗铠稳定部件顺序_V1(种子, 部件名列表).slice(0, Math.max(0, Math.floor(Number(移除部件数 || 0) || 0))).forEach(部件名 => 保留部件.delete(部件名));
  if (!保留部件.size) {
    清空内置角色斗铠_V1(角色);
    return;
  }
  if (!角色.装备 || typeof 角色.装备 !== 'object' || Array.isArray(角色.装备)) 角色.装备 = {};
  if (!角色.装备.斗铠 || typeof 角色.装备.斗铠 !== 'object' || Array.isArray(角色.装备.斗铠)) 角色.装备.斗铠 = {};
  角色.装备.斗铠.等级 = Math.max(1, Math.min(4, Math.floor(Number(等级 || 1) || 1)));
  角色.装备.斗铠.名称 = String(原始斗铠?.名称 || 角色.装备.斗铠.名称 || '').trim() || `${内置角色斗铠等级文本_V1[角色.装备.斗铠.等级] || 角色.装备.斗铠.等级}字斗铠`;
  角色.装备.斗铠.装备状态 = '未装备';
  角色.装备.斗铠.部件 = {};
  保留部件.forEach(部件名 => {
    角色.装备.斗铠.部件[部件名] = { 状态: '完好', 品质系数: 1.0 };
  });
  角色.装备.斗铠._属性加成 = 创建空内置角色装备加成_V1(true);
  角色.装备.斗铠._已排异 = false;
  const 武器 = 角色.装备.武器;
  if (武器 && typeof 武器 === 'object' && !Array.isArray(武器) && /斗铠/.test(`${武器.名称 || ''}${武器.品阶 || ''}${武器.描述 || ''}`)) {
    武器.名称 = '无';
    武器.品阶 = '无';
    武器.描述 = '';
  }
}

function 应用提前出场斗铠投影_V1(角色 = {}, 角色记录 = {}, 快照 = {}, 当前tick = 0) {
  const 快照年龄 = Math.max(0, Number(快照?.年龄 ?? 快照?.角色?.属性?.年龄 ?? 0) || 0);
  if (快照年龄 >= 30) return;
  const 提前年数 = 计算内置角色提前年数_V1(快照, 当前tick);
  const 斗铠 = 角色?.装备?.斗铠;
  const 原等级 = Math.max(0, Math.min(4, Math.floor(Number(斗铠?.等级 || 0) || 0)));
  if (!斗铠 || typeof 斗铠 !== 'object' || 原等级 <= 0) return;
  补齐内置角色完整斗铠部件_V1(斗铠, 角色);
  let 有效等级 = 原等级;
  const 部件名列表 = 取内置角色斗铠部件列表_V1(角色);
  const 部件数量 = 部件名列表.length;
  let 剩余移除部件数 = Math.max(0, Math.floor((提前年数 * 部件数量) / 5));
  let 不完整等级 = 0;
  let 不完整移除部件数 = 0;
  while (有效等级 > 0 && 剩余移除部件数 >= 部件数量) {
    有效等级 -= 1;
    剩余移除部件数 -= 部件数量;
  }
  if (有效等级 > 0 && 剩余移除部件数 > 0) {
    不完整等级 = 有效等级;
    不完整移除部件数 = 剩余移除部件数;
    有效等级 -= 1;
  }
  const 当前等级 = Math.max(0, Math.floor(Number(角色?.属性?.等级 || 0) || 0));
  while (有效等级 > 0 && 当前等级 < ([0, 50, 70, 80, 90][有效等级] || 0)) 有效等级 -= 1;
  if (有效等级 <= 0 && 不完整等级 === 1 && 当前等级 >= 50) {
    应用内置角色斗铠不完整投影_V1(角色, 1, 不完整移除部件数, 斗铠, `${角色记录?.角色名 || ''}|${当前tick}`);
    return;
  }
  应用内置角色斗铠有效等级_V1(角色, 有效等级, 斗铠);
}

function 应用内置角色提前出场投影_V1(角色 = {}, 角色记录 = {}, 快照 = {}, 当前tick = 0) {
  if (是否内置角色预备出场_V1(快照, 当前tick)) return;
  const 提前年数 = 计算内置角色提前年数_V1(快照, 当前tick);
  if (!(提前年数 > 0)) return;
  if (角色.属性 && typeof 角色.属性 === 'object') delete 角色.属性.背景;
  if (角色.状态 && typeof 角色.状态 === 'object') delete 角色.状态.位置;
  if (角色记录?.身份变化 === true) {
    if (!角色.社交 || typeof 角色.社交 !== 'object' || Array.isArray(角色.社交)) 角色.社交 = {};
    角色.社交.主身份 = 构建提前出场未来身份提示_V1(快照, 提前年数);
    角色.社交.势力 = {};
  }
  应用提前出场副职业认证投影_V1(角色.副职业, 提前年数);
  应用提前出场斗铠投影_V1(角色, 角色记录, 快照, 当前tick);
}

function 是否非魂师轻量角色_V1(角色 = {}) {
  if (!角色 || typeof 角色 !== 'object' || Array.isArray(角色)) return false;
  const 属性 = 角色.属性 && typeof 角色.属性 === 'object' && !Array.isArray(角色.属性) ? 角色.属性 : {};
  return isNoSoulPowerTalentTier(属性.天赋梯队);
}

function 是否已有明确魂师数据_V1(角色 = {}) {
  if (!角色 || typeof 角色 !== 'object' || Array.isArray(角色)) return false;
  const 属性 = 角色.属性 && typeof 角色.属性 === 'object' && !Array.isArray(角色.属性) ? 角色.属性 : {};
  if (isNoSoulPowerTalentTier(属性.天赋梯队)) return false;
  if (
    取角色武魂条目_V1(角色).some(([, 武魂数据]) =>
      取武魂魂灵条目_V1(武魂数据).some(([, 魂灵数据]) =>
        取魂灵魂环条目_V1(魂灵数据).length > 0 ||
        取对象槽位条目_V1(魂灵数据, 键 => /^第\d+魂技$/.test(String(键))).length > 0
      ) ||
      取武魂直接魂环条目_V1(武魂数据).length > 0
    )
  ) return true;
  const 有真实魂骨 = Object.values(角色.魂骨 || {}).some(魂骨 =>
    魂骨 &&
    typeof 魂骨 === 'object' &&
    !Array.isArray(魂骨) &&
    (
      (String(魂骨.名称 || '').trim() && String(魂骨.名称 || '').trim() !== '无') ||
      Math.max(0, Number(魂骨.年限 || 0) || 0) > 0 ||
      取对象槽位条目_V1(魂骨.附带技能 || {}, () => true).length > 0
    )
  );
  return (
    有真实魂骨 ||
    Math.max(0, Number(角色.魂核?.核心?.数量 || 0) || 0) > 0 ||
    取对象槽位条目_V1(角色.自创魂技 || {}, () => true).length > 0 ||
    取对象槽位条目_V1(角色.武魂融合技 || {}, () => true).length > 0 ||
    (String(角色.血脉之力?.血脉 || '').trim() && String(角色.血脉之力?.血脉 || '').trim() !== '无')
  );
}

function 是否已有魂师结构_V1(角色 = {}) {
  if (!角色 || typeof 角色 !== 'object' || Array.isArray(角色)) return false;
  const 属性 = 角色.属性 && typeof 角色.属性 === 'object' && !Array.isArray(角色.属性) ? 角色.属性 : {};
  if (isNoSoulPowerTalentTier(属性.天赋梯队)) return false;
  if (Math.max(0, Number(属性.等级 || 0) || 0) > 1) return true;
  if (取角色武魂条目_V1(角色).some(([, 武魂数据]) => 是否真实武魂数据_V1(武魂数据))) return true;
  const 有真实魂骨 = Object.values(角色.魂骨 || {}).some(魂骨 =>
    魂骨 &&
    typeof 魂骨 === 'object' &&
    !Array.isArray(魂骨) &&
    (
      (String(魂骨.名称 || '').trim() && String(魂骨.名称 || '').trim() !== '无') ||
      Math.max(0, Number(魂骨.年限 || 0) || 0) > 0 ||
      取对象槽位条目_V1(魂骨.附带技能 || {}, () => true).length > 0
    )
  );
  return (
    有真实魂骨 ||
    Math.max(0, Number(角色.魂核?.核心?.数量 || 0) || 0) > 0 ||
    取对象槽位条目_V1(角色.自创魂技 || {}, () => true).length > 0 ||
    取对象槽位条目_V1(角色.武魂融合技 || {}, () => true).length > 0
  );
}

function 记录数据根非魂师角色_V1(数据根 = {}) {
  Object.entries(数据根?.char || {}).forEach(([角色名, 角色]) => {
    if (!角色 || typeof 角色 !== 'object' || Array.isArray(角色)) return;
    if (是否已有魂师结构_V1(角色)) return;
    const 显式天赋梯队 = 规范化显式天赋梯队_V1(角色.__mvu_显式天赋梯队 || 角色?.属性?.天赋梯队);
    if (isNoSoulPowerTalentTier(显式天赋梯队) || 判断本轮轻量非魂师角色_V1(角色名)) 记录本轮轻量非魂师角色_V1(角色名);
  });
}

function 是否内置少年成长角色_V1(角色 = {}, 快照 = {}, 当前tick = 0) {
  if (是否内置角色预备出场_V1(快照, 当前tick)) return false;
  const 快照年龄 = Math.max(0, Number(快照?.年龄 ?? 角色?.属性?.年龄 ?? 0) || 0);
  const 投影年龄 = 计算内置角色投影年龄_V1(快照, 当前tick);
  return 快照年龄 <= 25 && 投影年龄 < 快照年龄 - 0.25;
}

function 读取内置角色快照等级_V1(快照 = {}) {
  const 等级 = Number(快照?.角色?.属性?.等级);
  return Number.isFinite(等级) ? Math.max(0, 等级) : null;
}

function 计算内置角色默认修为等级_V1(角色 = {}, 年龄 = 6, 当前tick = 0) {
  const 安全年龄 = Math.max(0, Number(年龄 || 0));
  if (安全年龄 < 6) return 0;
  return Math.max(0, Math.floor(Number(计算初始化修为等级(
    角色?.属性?.天赋梯队 || '正常',
    安全年龄,
    角色?.属性?.底子波动 || 1,
    角色?.属性?.生日 || '',
    当前tick,
  )) || 0));
}

function 取内置角色前置等级快照_V1(角色记录 = {}, 当前快照 = {}) {
  const 当前快照tick = Number(当前快照?.tick);
  if (!Number.isFinite(当前快照tick)) return null;
  return (Array.isArray(角色记录?.快照) ? 角色记录.快照 : [])
    .filter(快照 => Number.isFinite(Number(快照?.tick)) && Number(快照.tick) < 当前快照tick && 读取内置角色快照等级_V1(快照) !== null)
    .sort((a, b) => Number(b.tick) - Number(a.tick))[0] || null;
}

function 计算内置角色投影等级_V1(角色 = {}, 角色记录 = {}, 快照 = {}, 当前tick = 0, 投影年龄 = 0) {
  const 快照等级 = 读取内置角色快照等级_V1(快照);
  if (投影年龄 < 6) return 0;
  if (快照等级 === null) return 计算内置角色默认修为等级_V1(角色, 投影年龄, 当前tick);
  const 快照tick = Number(快照?.tick);
  if (!Number.isFinite(快照tick) || Number(当前tick || 0) >= 快照tick) return Math.max(0, Math.floor(快照等级));
  const 前置快照 = 取内置角色前置等级快照_V1(角色记录, 快照);
  if (前置快照 && Number(当前tick || 0) >= Number(前置快照.tick)) {
    const 前置等级 = 读取内置角色快照等级_V1(前置快照);
    const 比例 = Math.max(0, Math.min(1, (Number(当前tick || 0) - Number(前置快照.tick)) / Math.max(1, 快照tick - Number(前置快照.tick))));
    return Math.max(0, Math.min(Math.floor(快照等级), Math.floor(Number(前置等级 || 0) + (快照等级 - Number(前置等级 || 0)) * 比例)));
  }
  const 快照年龄 = Math.max(0, Number(快照?.年龄 ?? 快照?.角色?.属性?.年龄 ?? 投影年龄) || 投影年龄);
  const 默认快照等级 = 计算内置角色默认修为等级_V1(角色, 快照年龄, 快照tick);
  const 默认当前等级 = 计算内置角色默认修为等级_V1(角色, 投影年龄, 当前tick);
  const 倒推等级 = Math.floor(快照等级 - Math.max(0, 默认快照等级 - 默认当前等级));
  return Math.max(0, Math.min(Math.floor(快照等级), 倒推等级));
}

function 读取真实魂环等级底线_V1(角色 = {}) {
  const 魂环数 = 读取角色实际魂环数量_V1(角色);
  return 魂环数 > 0 ? Math.min(99, 魂环数 * 10 + 1) : 0;
}

function 裁剪内置角色魂环到等级_V1(角色 = {}) {
  const 等级 = Math.max(0, Number(角色?.属性?.等级 || 0) || 0);
  const 最大第一武魂魂环数 = Math.max(0, Math.min(9, Math.floor(等级 / 10)));
  Object.entries(角色 || {}).forEach(([武魂键, 武魂]) => {
    if (!/^第\d+武魂$/.test(武魂键) || !武魂 || typeof 武魂 !== 'object' || Array.isArray(武魂)) return;
    const 武魂序号 = 读取槽位序号_V1(武魂键, 1);
    const 最大魂环数 = 武魂序号 === 1 ? 最大第一武魂魂环数 : 最大第一武魂魂环数;
    Object.keys(武魂).forEach(键 => {
      const 魂环匹配 = String(键).match(/^第(\d+)魂环$/);
      if (魂环匹配 && Number(魂环匹配[1]) > 最大魂环数) {
        delete 武魂[键];
        return;
      }
      if (/^第\d+魂灵$/.test(键) && 武魂[键] && typeof 武魂[键] === 'object') {
        Object.keys(武魂[键]).forEach(魂灵键 => {
          const 魂灵魂环匹配 = String(魂灵键).match(/^第(\d+)魂环$/);
          if (魂灵魂环匹配 && Number(魂灵魂环匹配[1]) > 最大魂环数) delete 武魂[键][魂灵键];
        });
      }
    });
  });
}

function 清理内置角色未觉醒战斗能力_V1(角色 = {}) {
  裁剪内置角色魂环到等级_V1(角色);
  if (角色.自创魂技 && typeof 角色.自创魂技 === 'object') 角色.自创魂技 = {};
  if (角色.武魂融合技 && typeof 角色.武魂融合技 === 'object') 角色.武魂融合技 = {};
  if (角色.装备 && typeof 角色.装备 === 'object') {
    清空内置角色斗铠_V1(角色);
    if (角色.装备.机甲 && typeof 角色.装备.机甲 === 'object') {
      角色.装备.机甲.等级 = '无';
      角色.装备.机甲.名称 = '无';
      角色.装备.机甲.状态 = '无';
      角色.装备.机甲.装备状态 = '未装备';
      角色.装备.机甲._属性加成 = { 魂力上限: 0, 精神力上限: 0, 力量: 0, 防御: 0, 敏捷: 0, 体力上限: 0 };
    }
  }
}

function 读取时间线事件源_V1(数据根 = null, 当前tick = null) {
  const 资源 = 读取Schema时代资源_V1('timeline', 数据根, 当前tick);
  return 资源.status === 'ready' ? 资源.source : {};
}

function 读取情报事件源_V1() {
  try {
    return typeof IntelEvents === 'undefined' ? {} : IntelEvents;
  } catch (错误) {
    return {};
  }
}

function 读取成长模板附近事件文本_V1(当前tick = 0) {
  const 当前tick数值 = Number(当前tick || 0);
  const 时间线事件源 = 读取时间线事件源_V1();
  const 时间线事件列表 = Array.isArray(时间线事件源) ? 时间线事件源 : Object.values(时间线事件源 || {}).flat();
  return 时间线事件列表
    .filter(事件 => {
      const 事件tick = Number(事件?.触发tick);
      return Number.isFinite(事件tick)
        && 事件tick <= 当前tick数值
        && 当前tick数值 - 事件tick <= 内置角色预备出场窗口tick_V1;
    })
    .map(事件 => [事件?.标识, 事件?.章节, 事件?.描述, 事件?.简述].join('\n'))
    .join('\n');
}

function 成长模板关键词命中_V1(模板 = {}, 文本 = '') {
  const 内容 = String(文本 || '');
  if (!内容.trim()) return false;
  const 关键词列表 = [
    模板?.触发事件标识,
    模板?.魂技名,
    ...(Array.isArray(模板?.触发关键词) ? 模板.触发关键词 : []),
  ].map(关键词 => String(关键词 || '').trim()).filter(Boolean);
  return 关键词列表.some(关键词 => 内容.includes(关键词));
}

function 成长模板剧情明确达成_V1(模板 = {}, 当前剧情文本 = '') {
  const 内容 = String(当前剧情文本 || '');
  if (!成长模板关键词命中_V1(模板, 内容)) return false;
  const 否定词 = '(?:未|没|没有|无法|不能|并未|尚未|还未|没能|未能)';
  const 达成词 = '(?:获得|觉醒|领悟|突破|首次|成功施展|施展成功|掌握|命名|进化|解开|解封|凝聚|成型|练成|修成|学会|悟出|创造|创出|完成|达成|开启|显现|出现|稳定)';
  if (new RegExp(`${否定词}.{0,8}${达成词}`).test(内容)) return false;
  return new RegExp(达成词).test(内容);
}

function 成长模板触发_V1(模板 = {}, 当前tick = 0, 当前剧情文本 = '', 附近事件文本 = '') {
  if (成长模板剧情明确达成_V1(模板, 当前剧情文本)) return true;
  const 原著触发tick = Number(模板?.原著触发tick ?? Infinity);
  if (!Number.isFinite(原著触发tick) || Number(当前tick || 0) < 原著触发tick) return false;
  return 成长模板关键词命中_V1(模板, [当前剧情文本, 附近事件文本].join('\n'));
}

function 计算武魂实际魂环数量_V1(武魂数据 = {}) {
  const 魂环序号 = new Set();
  取武魂魂灵条目_V1(武魂数据).forEach(([, 魂灵数据]) => {
    取魂灵魂环条目_V1(魂灵数据).forEach(([魂环键]) => 魂环序号.add(读取槽位序号_V1(魂环键, 0)));
  });
  return Array.from(魂环序号).filter(序号 => 序号 > 0).length;
}

function 读取角色实际魂环数量_V1(角色 = {}, 武魂键 = '') {
  if (武魂键 && 角色?.[武魂键]) return 计算武魂实际魂环数量_V1(角色[武魂键]);
  return Math.max(0, ...取角色武魂条目_V1(角色).map(([, 武魂数据]) => 计算武魂实际魂环数量_V1(武魂数据)));
}

function 成长模板承载门槛满足_V1(角色 = {}, 模板 = {}) {
  const 路径片段 = String(模板?.写入路径 || '').split('.').map(片段 => 片段.trim()).filter(Boolean);
  const 武魂键 = 路径片段.find(片段 => 是武魂槽位键_V1(片段)) || '';
  if (读取角色实际魂环数量_V1(角色, 武魂键) < Math.max(0, Number(模板?.需求魂环数 || 0))) return false;
  const 需求气血魂环数 = Math.max(0, Number(模板?.需求气血魂环数 || 0));
  if (!需求气血魂环数) return true;
  return 取血脉气血魂环条目_V1(角色?.血脉之力).length >= 需求气血魂环数;
}

function 读取成长模板目标魂环_V1(角色 = {}, 写入路径 = '') {
  const 路径片段 = String(写入路径 || '').split('.').map(片段 => 片段.trim()).filter(Boolean);
  const [武魂键, 魂灵键, 魂环键, 技能键] = 路径片段;
  if (!是武魂槽位键_V1(武魂键) || !是魂灵槽位键_V1(魂灵键) || !是魂环槽位键_V1(魂环键) || !是魂技槽位键_V1(技能键)) return null;
  if (读取槽位序号_V1(魂环键, 0) !== 读取槽位序号_V1(技能键, -1)) return null;
  const 魂环 = 角色?.[武魂键]?.[魂灵键]?.[魂环键];
  return 魂环 && typeof 魂环 === 'object' && !Array.isArray(魂环) ? 魂环 : null;
}

function 成长技能槽已写实_V1(技能 = null, 模板 = {}) {
  if (!技能 || typeof 技能 !== 'object' || Array.isArray(技能)) return false;
  const 技能名 = String(技能.魂技名 || '').trim();
  const 模板技能名 = String(模板?.技能数据?.魂技名 || 模板?.魂技名 || '').trim();
  const 文本 = [技能.魂技名, 技能.画面描述, 技能.效果描述].map(值 => String(值 || '').trim()).filter(Boolean).join('\n');
  if (!文本) return false;
  if (模板技能名 && 技能名 && 模板技能名 !== 技能名) return false;
  return !/待补全|未知|AI_TODO/.test(文本);
}

function 构建成长模板技能数据_V1(模板 = {}) {
  const 技能数据 = cloneJsonValue(模板?.技能数据 || {}, {});
  技能数据.魂技名 = String(技能数据.魂技名 || 模板?.魂技名 || '').trim();
  return 技能数据.魂技名 ? 技能数据 : null;
}

function 记录成长技能写入结果_V1(变更列表 = null, 技能 = null, 上下文 = {}) {
  if (Array.isArray(变更列表) && 技能 && typeof 技能 === 'object' && !Array.isArray(技能)) 变更列表.push({ 技能, 上下文 });
  return true;
}

function 补齐成长新增技能结构_V1(变更列表 = [], 角色 = {}, 角色名 = '') {
  const 恢复增益重复账本缓存 = 创建恢复增益重复账本缓存_V1();
  (Array.isArray(变更列表) ? 变更列表 : []).forEach(变更 => {
    if (!变更?.技能 || typeof 变更.技能 !== 'object' || Array.isArray(变更.技能)) return;
    ensureSkillStructGenerated(变更.技能, {
      角色,
      talentTier: 角色?.属性?.天赋梯队 || '正常',
      恢复增益重复账本缓存,
      允许自动生成技能结构: true,
      ...(变更.上下文 || {}),
      path: 变更?.上下文?.path || `char.${角色名}.${变更?.上下文?.写入路径 || ''}`,
    });
  });
}

function 写入成长魂环魂技_V1(角色 = {}, 模板 = {}, 变更列表 = null, 角色名 = '') {
  const 路径片段 = String(模板?.写入路径 || '').split('.').map(片段 => 片段.trim()).filter(Boolean);
  const 魂环键 = 路径片段[2] || '';
  const 技能键 = 路径片段[3] || '';
  const 魂环 = 读取成长模板目标魂环_V1(角色, 模板?.写入路径);
  if (!魂环 || !技能键) return false;
  if (成长技能槽已写实_V1(魂环[技能键], 模板)) return false;
  魂环[技能键] = 构建成长模板技能数据_V1(模板);
  return !!魂环[技能键] && 记录成长技能写入结果_V1(变更列表, 魂环[技能键], {
    写入路径: 模板?.写入路径,
    path: `char.${角色名}.${模板?.写入路径}`,
    type: 取角色主武魂系别_V1(角色),
    武魂系别: 取角色主武魂系别_V1(角色),
    魂环数据: 魂环,
    ringIndex: 读取槽位序号_V1(魂环键, 1),
    age: Math.max(1000, Number(魂环?.年限 || 0)),
    ringAge: Math.max(1000, Number(魂环?.年限 || 0)),
    sourceCategory: '魂技',
    来源: '魂技',
    textContext: { spiritName: 模板?.魂技名 || 技能键, type: 取角色主武魂系别_V1(角色) },
  });
}

function 写入成长自创魂技_V1(角色 = {}, 模板 = {}, 变更列表 = null, 角色名 = '') {
  const 路径片段 = String(模板?.写入路径 || '').split('.').map(片段 => 片段.trim()).filter(Boolean);
  const 技能键 = String(路径片段[1] || '').trim();
  if (路径片段.length !== 2 || 路径片段[0] !== '自创魂技' || !技能键 || 技能键 !== String(模板?.技能数据?.魂技名 || 模板?.魂技名 || '').trim()) return false;
  if (!角色.自创魂技 || typeof 角色.自创魂技 !== 'object' || Array.isArray(角色.自创魂技)) 角色.自创魂技 = {};
  if (成长技能槽已写实_V1(角色.自创魂技[技能键], 模板)) return false;
  角色.自创魂技[技能键] = 构建成长模板技能数据_V1(模板);
  const 系别 = 取角色主武魂系别_V1(角色);
  const 获得阶段魂环数 = Math.max(1, Math.floor(Number(模板?.需求魂环数 || 1)) || 1);
  return !!角色.自创魂技[技能键] && 记录成长技能写入结果_V1(变更列表, 角色.自创魂技[技能键], {
    写入路径: 模板?.写入路径,
    path: `char.${角色名}.${模板?.写入路径}`,
    type: 系别,
    武魂系别: 系别,
    ringIndex: 获得阶段魂环数,
    魂环位: 获得阶段魂环数,
    获得阶段魂环数,
    age: Math.max(1000, 获得阶段魂环数 * 2000),
    ringAge: Math.max(1000, 获得阶段魂环数 * 2000),
    sourceCategory: '自创魂技',
    来源: '自创魂技',
    textContext: { spiritName: 技能键, type: 系别 },
  });
}

function 写入成长魂骨技能_V1(角色 = {}, 模板 = {}, 变更列表 = null, 角色名 = '') {
  const 路径片段 = String(模板?.写入路径 || '').split('.').map(片段 => 片段.trim()).filter(Boolean);
  const 魂骨键 = 路径片段[1] || '';
  const 技能数据 = 构建成长模板技能数据_V1(模板);
  const 技能键 = String(路径片段[3] || '').trim();
  if (路径片段.length !== 4 || 路径片段[0] !== '魂骨' || 路径片段[2] !== '附带技能' || !魂骨槽位列表_V1.includes(魂骨键) || !技能键 || 技能键 !== String(技能数据?.魂技名 || '').trim()) return false;
  if (!角色.魂骨 || typeof 角色.魂骨 !== 'object' || Array.isArray(角色.魂骨)) 角色.魂骨 = {};
  if (!角色.魂骨[魂骨键] || typeof 角色.魂骨[魂骨键] !== 'object' || Array.isArray(角色.魂骨[魂骨键])) 角色.魂骨[魂骨键] = { 名称: 魂骨键 };
  if (!角色.魂骨[魂骨键].附带技能 || typeof 角色.魂骨[魂骨键].附带技能 !== 'object' || Array.isArray(角色.魂骨[魂骨键].附带技能)) 角色.魂骨[魂骨键].附带技能 = {};
  if (成长技能槽已写实_V1(角色.魂骨[魂骨键].附带技能[技能键], 模板)) return false;
  角色.魂骨[魂骨键].附带技能[技能键] = 技能数据;
  const 系别 = 取角色主武魂系别_V1(角色);
  return 记录成长技能写入结果_V1(变更列表, 技能数据, {
    写入路径: `魂骨.${魂骨键}.附带技能.${技能键}`,
    path: `char.${角色名}.魂骨.${魂骨键}.附带技能.${技能键}`,
    type: 系别,
    武魂系别: 系别,
    age: Math.max(1000, Number(角色.魂骨[魂骨键]?.年限 || 0)),
    ringAge: Math.max(1000, Number(角色.魂骨[魂骨键]?.年限 || 0)),
    魂骨年限: Math.max(1000, Number(角色.魂骨[魂骨键]?.年限 || 0)),
    ringIndex: 1,
    passiveMode: true,
    passiveName: 技能键,
    sourceCategory: '魂骨技能',
    来源: '魂骨技能',
    textContext: { spiritName: 角色.魂骨[魂骨键]?.名称 || 魂骨键, type: 系别 },
  });
}

function 写入成长功法_V1(角色 = {}, 模板 = {}) {
  const 技能数据 = 构建成长模板技能数据_V1(模板);
  const 路径片段 = String(模板?.写入路径 || '').split('.').map(片段 => 片段.trim()).filter(Boolean);
  const 功法名 = String(路径片段[1] || '').trim();
  if (路径片段.length !== 2 || 路径片段[0] !== '功法' || !功法名 || !技能数据 || 功法名 !== String(技能数据.魂技名 || '').trim()) return false;
  if (!角色.功法 || typeof 角色.功法 !== 'object' || Array.isArray(角色.功法)) 角色.功法 = {};
  const 当前描述 = String(角色.功法[功法名]?.描述 || '').trim();
  const 描述 = String(技能数据.效果描述 || 技能数据.画面描述 || '无').trim() || '无';
  if (当前描述 && 当前描述 !== '无' && !/待补全|未知|AI_TODO/.test(当前描述)) return false;
  角色.功法[功法名] = 构建最新功法记录_V1(功法名, { 描述 });
  return true;
}

function 写入成长血脉技能_V1(角色 = {}, 模板 = {}, 变更列表 = null, 角色名 = '') {
  if (!角色?.血脉之力 || typeof 角色.血脉之力 !== 'object' || Array.isArray(角色.血脉之力)) 角色.血脉之力 = {};
  const 路径片段 = String(模板?.写入路径 || '').split('.').map(片段 => 片段.trim()).filter(Boolean);
  const 技能数据 = 构建成长模板技能数据_V1(模板);
  const 容器键 = 路径片段[1] || '';
  const 技能键 = String(路径片段[2] || '').trim();
  if (路径片段.length !== 3 || 路径片段[0] !== '血脉之力' || !['技能', '被动'].includes(容器键) || !技能键 || !技能数据 || 技能键 !== String(技能数据.魂技名 || '').trim()) return false;
  if (!角色.血脉之力[容器键] || typeof 角色.血脉之力[容器键] !== 'object' || Array.isArray(角色.血脉之力[容器键])) 角色.血脉之力[容器键] = {};
  if (成长技能槽已写实_V1(角色.血脉之力[容器键][技能键], 模板)) return false;
  角色.血脉之力[容器键][技能键] = 技能数据;
  const 系别 = 取角色主武魂系别_V1(角色);
  const 获得阶段魂环数 = Math.max(1, Math.floor(Number(模板?.需求魂环数 || 1)) || 1);
  return 记录成长技能写入结果_V1(变更列表, 技能数据, {
    写入路径: `血脉之力.${容器键}.${技能键}`,
    path: `char.${角色名}.血脉之力.${容器键}.${技能键}`,
    type: 系别,
    武魂系别: 系别,
    ringIndex: 获得阶段魂环数,
    魂环位: 获得阶段魂环数,
    获得阶段魂环数,
    age: Math.max(10000, 获得阶段魂环数 * 5000),
    ringAge: Math.max(10000, 获得阶段魂环数 * 5000),
    sourceCategory: '血脉技能',
    来源: '血脉技能',
    跳过预算门禁: true,
    血脉技能: true,
    textContext: { spiritName: 角色.血脉之力?.血脉 || 技能键, type: 系别 },
  });
}

function 写入成长气血魂技_V1(角色 = {}, 模板 = {}, 变更列表 = null, 角色名 = '') {
  const 路径片段 = String(模板?.写入路径 || '').split('.').map(片段 => 片段.trim()).filter(Boolean);
  const 气血魂环键 = 路径片段[1] || '';
  const 技能键 = 路径片段[2] || '';
  if (路径片段.length !== 3 || 路径片段[0] !== '血脉之力' || !是气血魂环槽位键_V1(气血魂环键) || !是血脉魂技槽位键_V1(技能键) || 读取槽位序号_V1(气血魂环键, 0) !== 读取槽位序号_V1(技能键, -1)) return false;
  const 气血魂环 = 角色?.血脉之力?.[气血魂环键];
  if (!气血魂环 || !技能键 || typeof 气血魂环 !== 'object' || Array.isArray(气血魂环)) return false;
  if (成长技能槽已写实_V1(气血魂环[技能键], 模板)) return false;
  气血魂环[技能键] = 构建成长模板技能数据_V1(模板);
  const 系别 = 取角色主武魂系别_V1(角色);
  return !!气血魂环[技能键] && 记录成长技能写入结果_V1(变更列表, 气血魂环[技能键], {
    写入路径: 模板?.写入路径,
    path: `char.${角色名}.${模板?.写入路径}`,
    type: 系别,
    武魂系别: 系别,
    魂环数据: 气血魂环,
    ringIndex: 读取槽位序号_V1(气血魂环键, 1),
    age: Math.max(1000, 读取槽位序号_V1(气血魂环键, 1) * 5000),
    ringAge: Math.max(1000, 读取槽位序号_V1(气血魂环键, 1) * 5000),
    sourceCategory: '气血魂技',
    来源: '气血魂技',
    跳过预算门禁: true,
    血脉技能: true,
    textContext: { spiritName: 角色.血脉之力?.血脉 || 技能键, type: 系别 },
  });
}

function 写入成长武魂融合技_V1(角色 = {}, 模板 = {}, 变更列表 = null, 角色名 = '') {
  const 路径片段 = String(模板?.写入路径 || '').split('.').map(片段 => 片段.trim()).filter(Boolean);
  if (路径片段.length !== 2 || 路径片段[0] !== '武魂融合技' || !路径片段[1] || 路径片段[1] !== String(模板?.技能数据?.魂技名 || 模板?.魂技名 || '').trim()) return false;
  const 技能名 = 路径片段[1];
  if (!角色.武魂融合技 || typeof 角色.武魂融合技 !== 'object' || Array.isArray(角色.武魂融合技)) 角色.武魂融合技 = {};
  if (!角色.武魂融合技[技能名] || typeof 角色.武魂融合技[技能名] !== 'object' || Array.isArray(角色.武魂融合技[技能名])) 角色.武魂融合技[技能名] = {};
  if (成长技能槽已写实_V1(角色.武魂融合技[技能名].技能数据, 模板)) return false;
  角色.武魂融合技[技能名].技能数据 = 构建成长模板技能数据_V1(模板);
  const 系别 = 取角色主武魂系别_V1(角色);
  const 获得阶段魂环数 = Math.max(1, Math.floor(Number(模板?.需求魂环数 || 5)) || 5);
  return !!角色.武魂融合技[技能名].技能数据 && 记录成长技能写入结果_V1(变更列表, 角色.武魂融合技[技能名].技能数据, {
    写入路径: 模板?.写入路径,
    path: `char.${角色名}.${模板?.写入路径}.技能数据`,
    type: 系别,
    武魂系别: 系别,
    ringIndex: 获得阶段魂环数,
    魂环位: 获得阶段魂环数,
    获得阶段魂环数,
    age: Math.max(10000, 获得阶段魂环数 * 5000),
    ringAge: Math.max(10000, 获得阶段魂环数 * 5000),
    sourceCategory: '武魂融合技',
    来源: '武魂融合技',
    来源类别: '武魂融合技',
    textContext: { spiritName: 技能名, type: 系别 },
  });
}

function 写入成长武魂进化_V1(角色 = {}, 模板 = {}) {
  const 路径片段 = String(模板?.写入路径 || '').split('.').map(片段 => 片段.trim()).filter(Boolean);
  const 武魂键 = 路径片段[0];
  const 字段键 = 路径片段[1];
  if (!是武魂槽位键_V1(武魂键) || !字段键 || !角色?.[武魂键] || typeof 角色[武魂键] !== 'object' || Array.isArray(角色[武魂键])) return false;
  const 现有文本 = String(角色[武魂键][字段键] || '').trim();
  const 技能数据 = 构建成长模板技能数据_V1(模板);
  if (!技能数据 || 现有文本.includes(技能数据.魂技名) || 现有文本.includes(技能数据.效果描述)) return false;
  const 追加文本 = `武魂进化：${技能数据.魂技名}，${技能数据.效果描述}`;
  角色[武魂键][字段键] = 现有文本 && !/待补全|未知|AI_TODO/.test(现有文本) ? `${现有文本}；${追加文本}` : 追加文本;
  return true;
}

function 写入成长技能模板_V1(角色 = {}, 模板 = {}, 变更列表 = null, 角色名 = '') {
  if (!成长模板承载门槛满足_V1(角色, 模板)) return false;
  if (模板?.写入类型 === '魂环魂技') return 写入成长魂环魂技_V1(角色, 模板, 变更列表, 角色名);
  if (模板?.写入类型 === '自创魂技') return 写入成长自创魂技_V1(角色, 模板, 变更列表, 角色名);
  if (模板?.写入类型 === '魂骨技能') return 写入成长魂骨技能_V1(角色, 模板, 变更列表, 角色名);
  if (模板?.写入类型 === '血脉技能') return 写入成长血脉技能_V1(角色, 模板, 变更列表, 角色名);
  if (模板?.写入类型 === '气血魂技') return 写入成长气血魂技_V1(角色, 模板, 变更列表, 角色名);
  if (模板?.写入类型 === '武魂融合技') return 写入成长武魂融合技_V1(角色, 模板, 变更列表, 角色名);
  if (模板?.写入类型 === '武魂进化') return 写入成长武魂进化_V1(角色, 模板);
  if (模板?.写入类型 === '功法') return 写入成长功法_V1(角色, 模板);
  return false;
}

function 收集内置角色成长技能模板触发_V1(数据根 = {}, 选项 = {}) {
  const 当前剧情文本 = [选项.用户输入, 选项.剧情文本, 选项.最后剧情文本].join('\n');
  if (!String(当前剧情文本 || '').trim()) return [];
  const 当前tick = Number(数据根?.world?.时间?.tick || 0);
  const 附近事件文本 = 读取成长模板附近事件文本_V1(当前tick);
  const 待确认 = [];
  Object.entries(数据根?.char || {}).forEach(([角色名, 角色]) => {
    if (!角色 || typeof 角色 !== 'object' || Array.isArray(角色)) return;
    const 角色记录 = 读取内置角色记录_V1(角色名, 当前tick, 数据根) || 读取内置角色库_V1().角色?.[角色名];
    const 模板列表 = Array.isArray(角色记录?.成长技能模板) ? 角色记录.成长技能模板 : [];
    if (!模板列表.length) return;
    模板列表.forEach((模板, 模板索引) => {
      if (!成长模板触发_V1(模板, 当前tick, 当前剧情文本, 附近事件文本)) return;
      if (!成长模板承载门槛满足_V1(角色, 模板)) return;
      const 技能数据 = 构建成长模板技能数据_V1(模板);
      if (!技能数据) return;
      const 预检角色 = cloneJsonValue(角色, {});
      if (!写入成长技能模板_V1(预检角色, 模板, [], 角色名)) return;
      待确认.push({
        角色名,
        模板索引,
        魂技名: 技能数据.魂技名,
        写入类型: String(模板?.写入类型 || '').trim(),
        写入路径: String(模板?.写入路径 || '').trim(),
        触发事件标识: String(模板?.触发事件标识 || '').trim(),
        模板,
      });
    });
  });
  return 待确认;
}

function 应用内置角色成长技能模板_V1(数据根 = {}, 选项 = {}) {
  if (选项?.直接写入 !== true && 选项?.允许直接写入成长技能模板 !== true) return [];
  const 待确认 = 收集内置角色成长技能模板触发_V1(数据根, 选项);
  const 已变更 = [];
  待确认.forEach(记录 => {
    const 角色名 = String(记录?.角色名 || '').trim();
    const 角色 = 数据根?.char?.[角色名];
    const 模板 = 记录?.模板;
    if (!角色 || typeof 角色 !== 'object' || Array.isArray(角色) || !模板) return;
    let 写入成功 = false;
    const 技能变更列表 = [];
    if (写入成长技能模板_V1(角色, 模板, 技能变更列表, 角色名)) 写入成功 = true;
    if (!写入成功) return;
    补齐成长新增技能结构_V1(技能变更列表, 角色, 角色名);
    已变更.push(角色名);
  });
  return 已变更;
}

function 应用内置角色成长技能模板记录_V1(数据根 = {}, 记录 = {}) {
  const 角色名 = String(记录?.角色名 || '').trim();
  const 模板 = 记录?.模板;
  const 角色 = 数据根?.char?.[角色名];
  if (!角色名 || !角色 || typeof 角色 !== 'object' || Array.isArray(角色) || !模板) return { changed: false, reason: 'growth_skill_record_invalid' };
  const 技能变更列表 = [];
  if (!写入成长技能模板_V1(角色, 模板, 技能变更列表, 角色名)) return { changed: false, reason: 'growth_skill_not_written' };
  补齐成长新增技能结构_V1(技能变更列表, 角色, 角色名);
  return { changed: true, changedNames: [角色名], names: [角色名], skillChanges: 技能变更列表 };
}

function 应用内置物品实例化_V1(数据根 = {}, 选项 = {}) {
  if (!数据根 || typeof 数据根 !== 'object') return { changed: false, changedNames: [], names: [] };
  确保物品分类表_V1(数据根);
  const 命中文本 = 清理提示审计扫描文本_V1([选项.用户输入, 选项.剧情文本, 选项.最后剧情文本].join('\n'));
  const 内置物品目录 = 构建内置物品平铺表_V1();
  if (!Object.keys(内置物品目录).length || (!String(命中文本 || '').trim() && !收集运行时物品候选名_V1(数据根, 命中文本, 选项).length)) {
    return { changed: false, changedNames: [], names: [] };
  }
  const 命中列表 = 收集运行时物品命中_V1(数据根, 命中文本, {
    ...选项,
    物品目录: 内置物品目录,
    阈值: Math.max(1, Math.floor(Number(选项.阈值 ?? 5))),
    上限: Math.max(1, Math.floor(Number(选项.上限 ?? 12))),
  });
  const 已写入 = [];
  命中列表.forEach(命中 => {
    const 物品名 = String(命中?.名称 || '').trim();
    if (!物品名 || 物品定义存在_V1(数据根, 物品名)) return;
    const 内置定义 = 查找内置物品定义_V1(物品名);
    if (!内置定义) return;
    写入分类物品定义_V1(数据根, 物品名, cloneJsonValue(内置定义.定义, {}), 内置定义.分类);
    已写入.push(物品名);
  });
  return { changed: 已写入.length > 0, changedNames: 已写入, names: 已写入 };
}

function 构建内置角色实例_V1(角色名 = '', 当前tick = 0, 数据根 = {}, 选项 = {}) {
  const 角色记录 = 读取内置角色记录_V1(角色名, 当前tick, 数据根);
  const 快照 = 取内置角色指定节点快照_V1(角色记录, 选项.指定快照节点) || 取内置角色最近快照_V1(角色记录, 当前tick);
  if (!快照?.角色 || typeof 快照.角色 !== 'object') return null;
  const 角色 = cloneJsonValue(快照.角色, null);
  if (!角色 || typeof 角色 !== 'object') return null;
  if (!角色.属性 || typeof 角色.属性 !== 'object') 角色.属性 = {};
  if (角色.装备?.斗铠 && typeof 角色.装备.斗铠 === 'object') 补齐内置角色完整斗铠部件_V1(角色.装备.斗铠, 角色);
  const 投影年龄 = 计算内置角色投影年龄_V1(快照, 当前tick);
  const 快照tick = Number(快照?.tick);
  const 是未来快照投影 = Number.isFinite(快照tick) && Number(当前tick || 0) < 快照tick;
  角色.属性.年龄 = Number(投影年龄.toFixed(1));
  角色.属性.等级 = 计算内置角色投影等级_V1(角色, 角色记录, 快照, 当前tick, 投影年龄);
  if (!是未来快照投影) 角色.属性.等级 = Math.max(Number(角色.属性.等级 || 0), 读取真实魂环等级底线_V1(角色));
  if (是未来快照投影) {
    if (!角色.状态 || typeof 角色.状态 !== 'object' || Array.isArray(角色.状态)) 角色.状态 = {};
    角色.状态.__内置角色未来快照投影 = true;
  }
  if (投影年龄 < 6) 清理内置角色未觉醒战斗能力_V1(角色);
  else 裁剪内置角色魂环到等级_V1(角色);
  应用内置角色提前出场投影_V1(角色, 角色记录, 快照, 当前tick);
  按精神力同步内置角色紫极魔瞳_V1(角色);
  return 角色;
}

function 解析内置角色Schema_V1(角色 = {}) {
  const 原抑制状态 = globalThis.__LWCS_SUPPRESS_SCHEMA_BROADCAST__;
  globalThis.__LWCS_SUPPRESS_SCHEMA_BROADCAST__ = true;
  try {
    return 读取MVUSchema部件_V1('CharacterSchema').parse(角色);
  } finally {
    if (原抑制状态 === undefined) delete globalThis.__LWCS_SUPPRESS_SCHEMA_BROADCAST__;
    else globalThis.__LWCS_SUPPRESS_SCHEMA_BROADCAST__ = 原抑制状态;
  }
}

function 是内置角色空壳_V1(角色 = {}) {
  if (!角色 || typeof 角色 !== 'object' || Array.isArray(角色)) return true;
  const 等级 = Math.max(0, Number(角色?.属性?.等级 || 0) || 0);
  const 年龄 = Math.max(0, Number(角色?.属性?.年龄 || 0) || 0);
  const 位置 = String(角色?.状态?.位置 || '').trim();
  if (等级 <= 1 && 年龄 <= 0 && 位置.includes('待转移')) return true;
  const 武魂名 = String(角色?.第1武魂?.表象名称 || '').trim();
  const 有魂灵 = !!角色?.第1武魂?.第1魂灵;
  const 有魂环 = Object.entries(角色?.第1武魂?.第1魂灵 || {}).some(([键, 值]) =>
    /^第\d+魂环$/.test(String(键)) && 值 && typeof 值 === 'object' && Object.keys(值).length > 0
  );
  const 主身份 = String(角色?.社交?.主身份 || '').trim();
  const 势力 = 角色?.社交?.势力 && typeof 角色.社交.势力 === 'object' && !Array.isArray(角色.社交.势力) ? 角色.社交.势力 : {};
  const 缺少基础社交 = !主身份 && Object.keys(势力).length === 0;
  const 缺少武魂主体 = !武魂名 || 武魂名 === '无' || 武魂名.includes('待补全');
  if (等级 <= 1 && 年龄 <= 0 && 缺少武魂主体 && !有魂灵 && !有魂环) return true;
  if (等级 <= 1 && 年龄 <= 0 && 缺少基础社交 && !有魂环) return true;
  if (等级 <= 1 && 缺少基础社交 && !有魂环) return true;
  return 等级 <= 1 && 年龄 <= 0 && (!武魂名 || 武魂名 === '无' || 武魂名.includes('待补全')) && !有魂灵 && !有魂环;
}

function 同步银龙融合旧实体状态_V1(数据根 = {}, 当前tick = 0) {
  if (!是否古月娜融合阶段_V1(当前tick, 数据根)) return [];
  const 角色表 = 数据根?.char && typeof 数据根.char === 'object' && !Array.isArray(数据根.char) ? 数据根.char : {};
  const 已变更 = [];
  ['古月', '娜儿'].forEach(角色名 => {
    const 角色 = 角色表[角色名];
    if (!角色 || typeof 角色 !== 'object' || Array.isArray(角色)) return;
    if (!角色.状态 || typeof 角色.状态 !== 'object' || Array.isArray(角色.状态)) 角色.状态 = {};
    const 死亡tick = Math.max(0, Number(角色.状态.死亡tick ?? -1), 古月娜融合成立tick_V1);
    const 需要变更 =
      角色.状态.存活 !== false ||
      Number(角色.状态.死亡tick ?? -1) !== 死亡tick ||
      角色.状态.死亡类型 !== '自然';
    if (!需要变更) return;
    角色.状态.存活 = false;
    角色.状态.死亡tick = 死亡tick;
    角色.状态.死亡类型 = '自然';
    已变更.push(角色名);
  });
  return 已变更;
}

function 归一化角色死亡状态_V1(角色 = {}, 当前tick = 0) {
  if (!角色 || typeof 角色 !== 'object' || Array.isArray(角色)) return;
  if (!角色.状态 || typeof 角色.状态 !== 'object' || Array.isArray(角色.状态)) 角色.状态 = {};
  if (角色.状态.存活 !== false) {
    角色.状态.存活 = true;
    角色.状态.死亡tick = -1;
    角色.状态.死亡类型 = '无';
    delete 角色.死亡tick;
    delete 角色.死亡类型;
    return;
  }
  const 原死亡tick = Math.floor(Number(角色.状态.死亡tick));
  角色.状态.死亡tick = Number.isFinite(原死亡tick) && 原死亡tick >= 0
    ? 原死亡tick
    : Math.max(0, Math.floor(Number(当前tick || 0) || 0));
  const 死亡类型 = String(角色.状态.死亡类型 ?? '').trim();
  角色.状态.死亡类型 = 死亡类型 === '自然' ? '自然' : '意外';
  delete 角色.死亡tick;
  delete 角色.死亡类型;
}

function 应用内置势力实例化_V1(数据根 = {}, 选项 = {}) {
  const 档案阻断 = globalThis.__LWCS_LIBRARY_ARCHIVE_BLOCKS__ && globalThis.__LWCS_LIBRARY_ARCHIVE_BLOCKS__.势力 === true;
  if (选项.禁止内置势力实例化 === true || 档案阻断) return { changed: false, changedNames: [], names: [], error: 'archive-unavailable' };
  const 名称列表 = [
    ...(Array.isArray(选项.候选势力) ? 选项.候选势力 : []),
    ...Object.values(数据根?.char || {}).flatMap(角色 => Object.keys(
      角色?.社交?.势力 && typeof 角色.社交.势力 === 'object' && !Array.isArray(角色.社交.势力)
        ? 角色.社交.势力
        : {},
    )),
  ];
  if (!数据根 || typeof 数据根 !== 'object' || !名称列表.length) return { changed: false, changedNames: [], names: [] };
  const 运行时 = 读取库运行时_V1();
  const 势力库 = 读取内置势力库_V1(数据根, Number(数据根?.world?.时间?.tick));
  if (!运行时 || typeof 运行时.resolveFaction !== 'function' || typeof 运行时.buildFactionInstance !== 'function' || !势力库) {
    记录库缺失错误_V1('势力', '势力库或库运行时缺失，已阻止新的势力实例化。');
    return { changed: false, changedNames: [], names: [], error: 'library-missing' };
  }
  if (!数据根.org || typeof 数据根.org !== 'object' || Array.isArray(数据根.org)) 数据根.org = {};
  const 禁止势力 = new Set(Array.isArray(选项.禁止势力) ? 选项.禁止势力.map(名称 => String(名称 || '').trim()).filter(Boolean) : []);
  const 已写入 = [];
  Array.from(new Set(名称列表.map(项目 => String(项目?.规范名 || 项目?.名称 || 项目?.记录ID || 项目 || '').trim()).filter(Boolean))).forEach(名称 => {
    const 解析 = 运行时.resolveFaction(名称, { library: 势力库, allowKeyword: false });
    if (解析.status !== 'resolved') {
      记录库缺失错误_V1('势力解析', `势力“${名称}”无法唯一解析（${解析.status}），未创建候选实例。`);
      return;
    }
    const 规范名 = 解析.canonicalName;
    if (禁止势力.has(规范名)) return;
    if (数据根.org[规范名] && typeof 数据根.org[规范名] === 'object' && !Array.isArray(数据根.org[规范名])) return;
    try {
      数据根.org[规范名] = 运行时.buildFactionInstance(规范名, {}, { library: 势力库 });
      已写入.push(规范名);
    } catch (错误) {
      记录库缺失错误_V1('势力实例化', `势力“${规范名}”实例化失败，已阻止写入：${错误.message || 错误}`);
    }
  });
  return { changed: 已写入.length > 0, changedNames: 已写入, names: 已写入 };
}

function 读取玩家当前位置_V1(数据根 = {}, 选项 = {}) {
  const 明确位置 = 选项.当前位置;
  if (明确位置 !== undefined) return String(明确位置 || '').trim();
  const 玩家名 = String(数据根?.sys?.玩家名 || '').trim();
  if (!玩家名) return '';
  return String(数据根?.char?.[玩家名]?.状态?.位置 || '').trim();
}

function 解析内置地点位置_V1(位置 = '', 地点库 = {}, 运行时 = null) {
  const 原文 = String(位置 || '').trim();
  if (!原文 || ['无', '未知', '待生成'].includes(原文)) return { status: 'unresolved', reason: 'empty-sentinel' };
  const 片段 = 原文.split('-').map(片段 => 片段.trim()).filter(Boolean);
  const 直接路径 = 片段.length > 1 && typeof 运行时?.resolveLocation === 'function'
    ? 运行时.resolveLocation(原文, 片段, { library: 地点库, allowKeyword: false })
    : null;
  if (直接路径?.status === 'resolved') return 直接路径;
  if (片段.length > 1) {
    const 叶节点 = 运行时.resolveLocation(片段[片段.length - 1], [], { library: 地点库, allowKeyword: false });
    if (叶节点.status === 'resolved') return 叶节点;
    if (叶节点.status === 'conflict') return 叶节点;
  }
  return 运行时.resolveLocation(原文, [], { library: 地点库, allowKeyword: false });
}

function 解析JSONPointer片段_V1(指针 = '') {
  return String(指针 || '').split('/').slice(1).map(片段 => String(片段).replace(/~1/g, '/').replace(/~0/g, '~'));
}

function 应用地点实例化操作_V1(数据根 = {}, 操作 = {}) {
  const 片段 = 解析JSONPointer片段_V1(操作.path);
  if (片段[0] !== 'world' || 片段[1] !== '地点' || 片段.length < 3) return false;
  let 容器 = 数据根.world.地点;
  const 地点片段 = 片段.slice(2);
  for (let index = 0; index < 地点片段.length; index += 1) {
    const 名称 = 地点片段[index];
    if (index === 地点片段.length - 1) {
      if (操作.op === 'replace' || !Object.prototype.hasOwnProperty.call(容器, 名称)) 容器[名称] = _.cloneDeep(操作.value || {});
      return true;
    }
    if (!容器[名称] || typeof 容器[名称] !== 'object' || Array.isArray(容器[名称])) 容器[名称] = {};
    if (!容器[名称].子节点 || typeof 容器[名称].子节点 !== 'object' || Array.isArray(容器[名称].子节点)) 容器[名称].子节点 = {};
    if (地点片段[index + 1] !== '子节点') return false;
    容器 = 容器[名称].子节点;
    index += 1;
  }
  return false;
}

function 应用内置地点实例化_V1(数据根 = {}, 选项 = {}) {
  if (!数据根 || typeof 数据根 !== 'object') return { changed: false, changedNames: [], names: [] };
  const 档案阻断 = globalThis.__LWCS_LIBRARY_ARCHIVE_BLOCKS__ && globalThis.__LWCS_LIBRARY_ARCHIVE_BLOCKS__.地点 === true;
  if (选项.禁止内置地点实例化 === true || 档案阻断) return { changed: false, changedNames: [], names: [], error: 'archive-unavailable' };
  const 运行时 = 读取库运行时_V1();
  const 地点库 = 读取内置地点库_V1(数据根, Number(数据根?.world?.时间?.tick));
  const 当前位置 = 读取玩家当前位置_V1(数据根, 选项);
  const 名称列表 = Array.isArray(选项.候选地点) ? 选项.候选地点 : [];
  const 禁止地点记录ID = new Set(Array.isArray(选项.禁止地点记录ID) ? 选项.禁止地点记录ID.map(名称 => String(名称 || '').trim()).filter(Boolean) : []);
  const 禁止地点路径键 = new Set(Array.isArray(选项.禁止地点路径键) ? 选项.禁止地点路径键.map(路径 => typeof 路径 === 'string' ? 路径 : JSON.stringify(路径)).filter(Boolean) : []);
  const 地点被阻断 = 解析 => !!解析 && (禁止地点记录ID.has(String(解析.recordId || '').trim()) || 禁止地点路径键.has(JSON.stringify(解析.path || [])));
  if (!运行时 || typeof 运行时.resolveLocation !== 'function' || typeof 运行时.buildLocationInstantiationOps !== 'function' || !地点库) {
    记录库缺失错误_V1('地点', '地点库或库运行时缺失，已阻止新的地点实例化。');
    return { changed: false, changedNames: [], names: [], error: 'library-missing' };
  }
  if (!数据根.world || typeof 数据根.world !== 'object') 数据根.world = {};
  if (!数据根.world.地点 || typeof 数据根.world.地点 !== 'object' || Array.isArray(数据根.world.地点)) 数据根.world.地点 = {};
  const 记录ID列表 = [];
  if (当前位置 && !['无', '未知', '待生成'].includes(当前位置)) {
    const 位置解析 = 解析内置地点位置_V1(当前位置, 地点库, 运行时);
    if (位置解析.status === 'resolved') {
      if (!地点被阻断(位置解析)) 记录ID列表.push(位置解析.recordId);
    } else 记录库缺失错误_V1('地点解析', `玩家位置“${当前位置}”无法唯一解析（${位置解析.status}），保留原位置文本。`);
  }
  名称列表.forEach(项目 => {
    const 名称 = String(项目?.规范名 || 项目?.名称 || 项目?.记录ID || 项目 || '').trim();
    const 查询对象 = 项目 && typeof 项目 === 'object' ? 项目 : 名称;
    if (!名称 && !项目?.记录ID) return;
    const 解析 = 运行时.resolveLocation(查询对象, [], { library: 地点库, allowKeyword: false });
    if (解析.status === 'resolved') {
      if (!地点被阻断(解析)) 记录ID列表.push(解析.recordId);
    } else 记录库缺失错误_V1('地点解析', `地点“${名称}”无法唯一解析（${解析.status}），未创建候选实例。`);
  });
  Object.entries(地点库.地点 || {}).forEach(([记录ID, 记录]) => {
    if (记录?.实例化策略 === 'insert' && !地点被阻断({ recordId: 记录ID, path: 记录.目标路径 })) 记录ID列表.push(记录ID);
  });
  const 已写入 = [];
  Array.from(new Set(记录ID列表)).forEach(记录ID => {
    try {
      const 操作列表 = 运行时.buildLocationInstantiationOps(记录ID, 数据根, { library: 地点库 });
      操作列表.forEach(操作 => {
        if (应用地点实例化操作_V1(数据根, 操作)) 已写入.push(记录ID);
      });
    } catch (错误) {
      记录库缺失错误_V1('地点实例化', `地点记录“${记录ID}”实例化失败，已阻止写入：${错误.message || 错误}`);
    }
  });
  const 变更记录 = Array.from(new Set(已写入));
  return { changed: 变更记录.length > 0, changedNames: 变更记录, names: 变更记录 };
}

function 应用内置角色实例化_V1(数据根 = {}, 选项 = {}) {
  if (!数据根 || typeof 数据根 !== 'object') return { changed: false, changedNames: [], names: [] };
  if (!数据根.char || typeof 数据根.char !== 'object' || Array.isArray(数据根.char)) 数据根.char = {};
  const tick数值 = Number(数据根?.world?.时间?.tick || 0);
  const 当前tick = Number.isFinite(tick数值) ? tick数值 : 0;
  const 待写入 = new Set();
  const 命中文本 = 清理提示审计扫描文本_V1([选项.用户输入, 选项.剧情文本, 选项.最后剧情文本].join('\n'));
  const 使用统一命中 = 选项.使用统一命中 === true || Array.isArray(选项.命中角色) || Array.isArray(选项.候选角色) || Array.isArray(选项.相关角色);
  const 文本自动命中 = 选项.使用统一命中 === true && String(命中文本 || '').trim();
  const 添加命中角色 = 名称列表 => {
    (Array.isArray(名称列表) ? 名称列表 : []).forEach(角色名 => {
      const 规范名 = 解析内置角色规范名_V1(角色名, 当前tick, 数据根);
      if (规范名 && (!文本自动命中 || 内置角色文本命中满足二级关键词_V1(规范名, 命中文本))) 待写入.add(规范名);
    });
  };
  添加命中角色(选项.命中角色);
  添加命中角色(选项.候选角色);
  添加命中角色(选项.相关角色);
  if (!使用统一命中 && String(命中文本 || '').trim()) {
    收集当前时间线命中内置角色名_V1(当前tick, 命中文本, 数据根).forEach(角色名 => 待写入.add(角色名));
  }
  if (是否古月娜融合阶段_V1(当前tick, 数据根) && !数据根.char.古月娜 && (数据根.char.古月 || 数据根.char.娜儿)) {
    待写入.add('古月娜');
  }
  const 已写入 = [];
  待写入.forEach(角色名 => {
    if (!角色名) return;
    if (数据根.char[角色名] && !是内置角色空壳_V1(数据根.char[角色名])) return;
    const 角色 = 构建内置角色实例_V1(角色名, 当前tick, 数据根);
    if (!角色) return;
    const 临时根 = { ...数据根, char: { [角色名]: 角色 } };
    水合角色物品引用_V1(临时根);
    数据根.char[角色名] = 解析内置角色Schema_V1(临时根.char[角色名]);
    已写入.push(角色名);
  });
  if (已写入.length > 0) {
    const 新写入角色集 = {};
    已写入.forEach(角色名 => {
      if (数据根.char?.[角色名]) 新写入角色集[角色名] = 数据根.char[角色名];
    });
    globalThis.__LWCS_INITIALIZE_SKILL_EFFECTS__({ char: 新写入角色集 });
  }
  const 已同步 = 同步银龙融合旧实体状态_V1(数据根, 当前tick);
  const 已补成长技能 = 应用内置角色成长技能模板_V1(数据根, 选项);
  const 已变更 = Array.from(new Set([...已写入, ...已同步, ...已补成长技能]));
  return { changed: 已变更.length > 0, changedNames: 已变更, names: 已变更 };
}

function 解析开场时间线入库命令_V1(载荷 = null) {
  if (!载荷 || typeof 载荷 !== 'object' || Array.isArray(载荷)) {
    throw new Error('开场时间线入库命令必须是JSON对象');
  }
  const eraId = String(载荷?.eraId || '').trim();
  const 开场节点 = String(载荷?.node || '').trim();
  if (!eraId || !开场节点) throw new Error('开场时间线入库命令缺少eraId或node');
  return { eraId, 开场节点 };
}

function 应用开场时间线内置角色入库_V1(数据根 = {}, 命令 = null) {
  if (!数据根 || typeof 数据根 !== 'object') return { changed: false, changedNames: [], names: [] };
  if (!数据根.char || typeof 数据根.char !== 'object' || Array.isArray(数据根.char)) 数据根.char = {};
  const { eraId, 开场节点 } = 解析开场时间线入库命令_V1(命令);
  const tick数值 = Number(数据根?.world?.时间?.tick || 0);
  const 当前tick = Number.isFinite(tick数值) ? tick数值 : 0;
  const 时代集成 = 读取时代运行时集成_V1();
  if (!时代集成 || typeof 时代集成.getStaticSourceForEra !== 'function' || typeof 时代集成.resolveResourceEraAtTick !== 'function') {
    throw new Error('时代运行时接口未就绪');
  }
  const 资源结果 = 时代集成.getStaticSourceForEra(eraId, 'character');
  if (资源结果?.status !== 'resolved' || !资源结果.source?.角色) throw new Error(`开场时代角色库未就绪：${eraId}`);
  const 角色库 = 资源结果.source;
  const 节点定义 = 角色库.开场节点?.[开场节点];
  if (!节点定义 || !Number.isFinite(Number(节点定义.tick))) throw new Error(`开场节点无效：${eraId}/${开场节点}`);
  if (时代集成.resolveResourceEraAtTick(当前tick) !== eraId) throw new Error(`开场tick与时代不一致：${eraId}/${当前tick}`);
  if (Math.abs(Number(节点定义.tick) - 当前tick) > 1e-9) throw new Error(`开场tick与快照不一致：${开场节点}`);
  const 已写入 = [];
  Object.values(角色库.角色 || {}).forEach(角色记录 => {
    const 角色名 = String(角色记录?.角色名 || '').trim();
    if (!角色名) return;
    const 节点列表 = Array.isArray(角色记录?.开场常驻节点) ? 角色记录.开场常驻节点 : [];
    if (!节点列表.includes(开场节点) && 角色名 !== 节点定义.角色名) return;
    if (数据根.char[角色名] && !是内置角色空壳_V1(数据根.char[角色名])) return;
    const 指定快照节点 = 角色名 === 节点定义.角色名 ? 节点定义.快照节点 : 开场节点;
    const 角色 = 构建内置角色实例_V1(角色名, 当前tick, 数据根, { 指定快照节点 });
    if (!角色) return;
    const 临时根 = { ...数据根, char: { [角色名]: 角色 } };
    水合角色物品引用_V1(临时根);
    数据根.char[角色名] = 解析内置角色Schema_V1(临时根.char[角色名]);
    已写入.push(角色名);
  });
  if (已写入.length > 0) {
    const 新写入角色集 = {};
    已写入.forEach(角色名 => {
      if (数据根.char?.[角色名]) 新写入角色集[角色名] = 数据根.char[角色名];
    });
    globalThis.__LWCS_INITIALIZE_SKILL_EFFECTS__({ char: 新写入角色集 });
  }
  const 已同步 = 同步银龙融合旧实体状态_V1(数据根, 当前tick);
  const 已补成长技能 = 应用内置角色成长技能模板_V1(数据根, {});
  const 已变更 = Array.from(new Set([...已写入, ...已同步, ...已补成长技能]));
  return { changed: 已变更.length > 0, changedNames: 已变更, names: 已变更, eraId, 开场节点 };
}

function 角色存在空技能效果数组_V1(节点 = null) {
    if (!节点 || typeof 节点 !== 'object') return false;
    if (Array.isArray(节点)) return 节点.some(角色存在空技能效果数组_V1);
    if (Object.prototype.hasOwnProperty.call(节点, '_效果数组')) {
      const 是技能对象 =
        Object.prototype.hasOwnProperty.call(节点, '魂技名') ||
        Object.prototype.hasOwnProperty.call(节点, '画面描述') ||
        Object.prototype.hasOwnProperty.call(节点, '效果描述') ||
        Object.prototype.hasOwnProperty.call(节点, '承载方式');
      if (是技能对象) return !Array.isArray(节点._效果数组) || 节点._效果数组.length === 0;
    }
    return Object.values(节点).some(角色存在空技能效果数组_V1);
}

function 规范化Schema根转换_V1(data = {}, 选项 = {}) {
    if (!data || typeof data !== 'object') data = {};
    globalThis.__LWCS_SCHEMA_ACTIVE_DATA_ROOT_V1__ = data;

    const hasSchemaRootFields = value =>
      !!value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      (typeof value.sys === 'object' ||
        typeof value.world === 'object' ||
        typeof value.org === 'object' ||
        typeof value.char === 'object');
    const countSchemaRootFields = value => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return 0;
      return ['sys', 'world', 'org', 'char'].filter(key => !!value[key] && typeof value[key] === 'object').length;
    };
    const rootCandidates = [data, data.stat_data, data.display_data];
    let bestRootCandidate = data;
    let bestRootScore = countSchemaRootFields(data);
    let bestRootSize = Object.keys(data || {}).length;
    rootCandidates.forEach(candidate => {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return;
      const score = countSchemaRootFields(candidate);
      const size = Object.keys(candidate).length;
      if (score > bestRootScore || (score === bestRootScore && size > bestRootSize)) {
        bestRootCandidate = candidate;
        bestRootScore = score;
        bestRootSize = size;
      }
    });
    if (bestRootCandidate !== data && bestRootScore > 0) {
      data = _.cloneDeep(bestRootCandidate);
    }
    globalThis.__LWCS_SCHEMA_ACTIVE_DATA_ROOT_V1__ = data;

    if (!data.sys || typeof data.sys !== 'object') data.sys = {};
    if (!data.char || typeof data.char !== 'object') data.char = {};

    if (hasSchemaRootFields(data.char?.stat_data)) {
      data.char = _.cloneDeep(data.char.stat_data.char || {});
    } else if (
      data.char &&
      typeof data.char === 'object' &&
      data.char.display_data &&
      typeof data.char.display_data === 'object' &&
      data.char.display_data.char &&
      typeof data.char.display_data.char === 'object' &&
      Object.keys(data.char).length <= 8
    ) {
      data.char = _.cloneDeep(data.char.display_data.char);
    }

    if (!data.org || typeof data.org !== 'object') data.org = {};
    if (!data.world || typeof data.world !== 'object') data.world = {};
    if (!data.物品 || typeof data.物品 !== 'object' || Array.isArray(data.物品)) data.物品 = {};
    水合角色物品引用_V1(data);
    if (data.map && typeof data.map === 'object') delete data.map;
    if (!data.world.时间 || typeof data.world.时间 !== 'object') data.world.时间 = {};
    if (!data.world.时间线 || typeof data.world.时间线 !== 'object' || Array.isArray(data.world.时间线))
      data.world.时间线 = {};
    if (!data.world.机密情报 || typeof data.world.机密情报 !== 'object') data.world.机密情报 = {};
    if (!data.world.动态地点 || typeof data.world.动态地点 !== 'object')
      data.world.动态地点 = {};
    if (!data.world.地点 || typeof data.world.地点 !== 'object') data.world.地点 = {};
    if (!data.world.特殊权限 || typeof data.world.特殊权限 !== 'object' || Array.isArray(data.world.特殊权限))
      data.world.特殊权限 = {};
    if (!data.world.赛事 || typeof data.world.赛事 !== 'object' || Array.isArray(data.world.赛事))
      data.world.赛事 = {};
    try {
      globalThis.__LWCS_COMPETITION_PRIVILEGE_RUNTIME__?.整理特殊权限?.(data, {
        当前tick: Number(data.world.时间?.tick || 0),
      });
    } catch (错误) {
      console.warn('[LWCS] 特殊权限整理失败', 错误);
    }

    const RESERVED_CHAR_KEYS = new Set([
      'display_data',
      'delta_data',
      'stat_data',
      'initialized_lorebooks',
      'schema',
      'sys',
      'world',
      'org',
      'char',
      'variables',
      'payload',
      'root',
      'data',
    ]);
    Object.keys(data.char).forEach(charKey => {
      if (RESERVED_CHAR_KEYS.has(charKey)) {
        delete data.char[charKey];
        return;
      }
      const charData = data.char[charKey];
      if (!charData || typeof charData !== 'object' || Array.isArray(charData)) {
        delete data.char[charKey];
      }
    });
    Object.values(data.char).forEach(charData => {
      if (charData && typeof charData === 'object' && !Array.isArray(charData)) {
        delete charData.__mvu_isPlayer;
        delete charData.__mvu_显式天赋梯队;
      }
    });
    Object.entries(data.char).forEach(([charName, charData]) => {
      if (!charData || typeof charData !== 'object' || Array.isArray(charData)) return;
      const 原始等级 = 读取本轮原始角色等级_V1(charName);
      const 当前等级 = Math.max(0, Number(charData?.属性?.等级 || 0) || 0);
      if (原始等级 !== null && 当前等级 > 原始等级) 标记本轮等级上升角色_V1(charData, charName);
    });
    应用内置角色实例化_V1(data, 选项);
    应用内置势力实例化_V1(data, 选项);
    应用内置地点实例化_V1(data, 选项);
    记录数据根非魂师角色_V1(data);

    if (typeof data.sys.玩家名 !== 'string' || !data.sys.玩家名.trim()) data.sys.玩家名 = '无名氏';
    if (typeof data.sys.系统播报 !== 'string' || !data.sys.系统播报.trim()) data.sys.系统播报 = '初始化';
    取出角色归一化播报事件_V1().forEach(事件 => 追加系统播报文本(data, 事件.文本));
    处理临时突破请求_V1(data);

    const appendSystemReasonText = text => {
      const safeText = String(text || '').trim();
      if (!safeText) return;
      追加系统播报文本(data, safeText);
    };

    const appendSystemReasonBatchText = (label, entries = [], options = {}) => {
      const safeLabel = String(label || '').trim();
      const normalizedEntries = Array.from(new Set((Array.isArray(entries) ? entries : [])
        .map(item => String(item || '').trim())
        .filter(Boolean)));
      if (!safeLabel || !normalizedEntries.length) return;
      const limit = Math.max(1, Number(options.limit || 3));
      const visible = normalizedEntries.slice(0, limit);
      const suffix = normalizedEntries.length > limit ? ` 等${normalizedEntries.length}项` : '';
      appendSystemReasonText(`${safeLabel} ${visible.join('；')}${suffix}`);
    };

    const compactInternalSystemReasonText = rawText => {
      const source = String(rawText || '').trim();
      if (!source) return source;
      const intelMatches = Array.from(source.matchAll(/\[机密情报待提交\]\s*【?([\s\S]*?)】?已写入\s*\/world\/机密情报\/[\s\S]*?handled。/g));
      let cleaned = source
        .replace(/\[编年史推进待提交\]\s*[\s\S]*?。已写入\s*\/world\/时间线\/[\s\S]*?handled。/g, ' ')
        .replace(/\[机密情报待提交\]\s*【?[\s\S]*?】?已写入\s*\/world\/机密情报\/[\s\S]*?handled。/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const summaryParts = [];
      if (intelMatches.length) {
        const intelItems = intelMatches.map(match => String(match[1] || '').trim()).filter(Boolean);
        if (intelItems.length) {
          const unique = Array.from(new Set(intelItems));
          summaryParts.push(`[机密情报待处理] ${unique.slice(0, 3).join('；')}${unique.length > 3 ? ` 等${unique.length}项` : ''}`);
        }
      }
      return [cleaned, ...summaryParts].filter(Boolean).join(' ').trim() || source;
    };

    const upsertSecretIntel = (intelKey, payload = {}) => {
      const safeKey = String(intelKey || '').trim();
      if (!safeKey) return null;
      const previous = data.world.机密情报?.[safeKey];
      const 来源条目 = {
        ...(previous && typeof previous === 'object' ? previous : {}),
        ...(payload && typeof payload === 'object' ? payload : {}),
      };
      const next = {
        内容: String(来源条目.内容 || '无').trim() || '无',
        知情规则: Array.isArray(来源条目.知情规则) ? _.cloneDeep(来源条目.知情规则) : [],
      };
      if (!Array.isArray(next.知情规则)) next.知情规则 = [];
      data.world.机密情报[safeKey] = next;
      return next;
    };

    const hasSecretIntel = intelKey => {
      const safeKey = String(intelKey || '').trim();
      return !!safeKey && !!data.world.机密情报?.[safeKey];
    };

    const getDefaultSecretIntelKnowers_ACU = intelKey => {
      const safeKey = String(intelKey || '').trim();
      if (!safeKey) return [];
      if (safeKey.includes('万年前的神界绝密布局')) {
        return ['唐三'];
      }
      if (safeKey.includes('血神军团镇守深渊位面')) {
        return ['史莱克高层', '战神殿高层', '传灵塔高层', '唐门高层', '联邦高层'];
      }
      return [];
    };

    const resolveSecretIntelKnowers_ACU = intelEntry => {
      const rawRules = Array.isArray(intelEntry?.知情规则)
        ? intelEntry.知情规则
        : (Array.isArray(intelEntry?.knowers) ? intelEntry.knowers : []);
      const fallbackRules = rawRules.length ? rawRules : getDefaultSecretIntelKnowers_ACU(intelEntry?.情报名 || intelEntry?.内容 || '');
      const normalizedRules = Array.from(new Set(fallbackRules.map(item => String(item || '').trim()).filter(Boolean)));
      const resolvedTargets = [];
      const addTarget = name => {
        const safeName = String(name || '').trim();
        if (!safeName || resolvedTargets.includes(safeName)) return;
        resolvedTargets.push(safeName);
      };
      const matchFactionRule = (ruleText, factionName) => {
        const rule = String(ruleText || '').trim();
        const faction = String(factionName || '').trim();
        if (!rule || !faction) return false;
        const strippedRule = rule.replace(/高层/g, '').trim();
        if (!strippedRule) return false;
        if (rule === faction || strippedRule === faction) return true;
        if (rule.includes(faction) || faction.includes(strippedRule)) return true;
        if (strippedRule === '史莱克' && faction.includes('史莱克')) return true;
        if (strippedRule === '联邦' && faction.includes('联邦')) return true;
        return false;
      };

      normalizedRules.forEach(target => {
        if (data.char[target]) {
          addTarget(target);
          return;
        }
        _(data.char).forEach((charData, charName) => {
          const displayName = String(charData?.name || charData?.base?.name || charName || '').trim();
          if (displayName && displayName === target) {
            addTarget(charName);
            return;
          }
          _(charData?.社交?.势力 || {}).forEach((facData, facName) => {
            const isHighLevelRule = /高层/.test(target);
            if (isHighLevelRule) {
              if (matchFactionRule(target, facName) && Number(facData?.权限级 || 0) >= 7) addTarget(charName);
            } else if (matchFactionRule(target, facName)) {
              addTarget(charName);
            }
          });
        });
      });

      return { rules: normalizedRules, targets: resolvedTargets };
    };

    const refreshSecretIntelAudienceDistribution_ACU = () => {
      _(data.world.机密情报 || {}).forEach((intelEntry, intelKey) => {
        if (!intelEntry || typeof intelEntry !== 'object') return;
        const resolved = resolveSecretIntelKnowers_ACU({
          ...intelEntry,
          情报名: intelKey,
        });
        data.world.机密情报[intelKey] = {
          内容: String(intelEntry.内容 || '无').trim() || '无',
          知情规则: resolved.rules,
        };
      });
    };

    const rawWorldTick = data.world.时间.tick === undefined || data.world.时间.tick === null
      ? DEFAULT_NEW_GAME_TICK_SCHEMA_RUNTIME
      : data.world.时间.tick;
    let currentTick = Number(rawWorldTick);
    if (!Number.isFinite(currentTick) || currentTick < 0) currentTick = DEFAULT_NEW_GAME_TICK_SCHEMA_RUNTIME;
    data.world.时间.tick = currentTick;
    const 根修炼运行时 = 读取时代修炼运行时_ACU();
    const 当前修炼时代 = 根修炼运行时 && typeof 根修炼运行时.resolveCultivationEra === 'function'
      ? 根修炼运行时.resolveCultivationEra({}, { currentTick })
      : null;
    if (当前修炼时代) {
      _(data.char).forEach(角色 => 应用静态高等级魂核初始化_ACU(角色, 解析角色静态魂核时代_ACU(角色, 当前修炼时代)));
    }
    _(data.char).forEach(角色 => 归一化角色死亡状态_V1(角色, currentTick));

    const 补全任务条目字段 = (任务条目 = {}, 当前tick = 0) => {
      if (!任务条目 || typeof 任务条目 !== 'object' || Array.isArray(任务条目)) return null;
      任务条目.任务线 = String(任务条目.任务线 || '支线').trim() || '支线';
      任务条目.当前进度 = Math.max(0, Math.min(100, Number(任务条目.当前进度 || 0)));
      任务条目.奖励币 = Math.max(0, Number(任务条目.奖励币 || 0));
      任务条目.奖励声望 = Math.max(0, Number(任务条目.奖励声望 || 0));
      任务条目.最后更新时间tick = Math.max(0, Number(任务条目.最后更新时间tick || 当前tick || 0));
      return 任务条目;
    };

    const 应用图鉴被动到角色 = (角色 = {}) => {
      if (!角色 || typeof 角色 !== 'object') return;
      if (!角色.属性 || typeof 角色.属性 !== 'object') return;
      if (!角色.属性.状态效果 || typeof 角色.属性.状态效果 !== 'object') 角色.属性.状态效果 = {};
      delete 角色.属性.状态效果['图鉴研究增益'];
      if (!角色.状态 || typeof 角色.状态 !== 'object') 角色.状态 = {};
      delete 角色.状态.图鉴被动来源;
    };

    const formatTickToCalendarDateLocal = tickValue => {
      const safeTick = Math.max(0, Number(tickValue || 0));
      const totalMinutes = Math.round(safeTick * 10);
      const days = Math.floor(totalMinutes / (24 * 60));
      const years = Math.floor(days / 360);
      const months = Math.floor((days % 360) / 30) + 1;
      const currentDay = (days % 30) + 1;
      const remainderMinutes = totalMinutes % (24 * 60);
      const hours = Math.floor(remainderMinutes / 60);
      const mins = Math.floor(remainderMinutes % 60);
      return `斗罗历${years}年${months}月${currentDay}日 ${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };

    const formatTickToCalendar = tickValue => formatTickToCalendarDateLocal(tickValue);
    const BASE_DAILY_LIVING_COST_ACU = 300;
    const MONTH_TICK_SPAN_ACU = 30 * 144;
    const MONTHLY_STIPEND_TICK_OFFSET_ACU = 54; // 每月1号 09:00

    const getSoulMasterStipendDaysByLevel_ACU = levelValue => {
      const level = Math.max(0, Math.floor(Number(levelValue) || 0));
      if (level <= 0) return 0;
      if (level <= 10) return 10;
      if (level <= 20) return 30;
      if (level <= 30) return 60;
      if (level <= 40) return 90;
      if (level <= 50) return 120;
      if (level <= 60) return 180;
      if (level <= 70) return 270;
      if (level <= 80) return 360;
      if (level <= 90) return 720;
      return 1800;
    };

    const isSoulMasterStipendEligible_ACU = char => {
      if (!char || typeof char !== 'object') return false;
      if (isSoulBeastCharacter(char)) return false;
      if (char?.属性?.邪魂师 === true) return false;
      const unitNature = String(char?.单位性质 || '').trim();
      if (unitNature === '魂兽' || unitNature === '深渊') return false;
      return Math.max(0, Math.floor(Number(char?.属性?.等级 || 0))) > 0;
    };

    const getMonthlyStipendCycleIndex_ACU = tickValue => {
      const safeTick = Math.max(0, Math.floor(Number(tickValue) || 0));
      if (safeTick < MONTHLY_STIPEND_TICK_OFFSET_ACU) return -1;
      return Math.floor((safeTick - MONTHLY_STIPEND_TICK_OFFSET_ACU) / MONTH_TICK_SPAN_ACU);
    };

    const getMonthlyStipendTicksCrossed_ACU = (prevTick, nextTick) => {
      const previous = Math.max(0, Math.floor(Number(prevTick) || 0));
      const current = Math.max(0, Math.floor(Number(nextTick) || 0));
      if (current <= previous) return [];
      const startCycle = getMonthlyStipendCycleIndex_ACU(previous);
      const endCycle = getMonthlyStipendCycleIndex_ACU(current);
      if (endCycle < startCycle + 1) return [];
      const ticks = [];
      for (let cycle = startCycle + 1; cycle <= endCycle; cycle++) {
        ticks.push(cycle * MONTH_TICK_SPAN_ACU + MONTHLY_STIPEND_TICK_OFFSET_ACU);
      }
      return ticks;
    };

    const DAY_TICK_SPAN_ACU = 144;
    const NIGHT_MEDITATION_START_TICK_ACU = 23 * 6;
    const NIGHT_MEDITATION_END_TICK_ACU = 7 * 6;

    const normalizeDayTickOffset_ACU = tickValue => {
      const safeTick = Number(tickValue || 0);
      const offset = safeTick % DAY_TICK_SPAN_ACU;
      return offset < 0 ? offset + DAY_TICK_SPAN_ACU : offset;
    };

    const isNightMeditationTick_ACU = (tickValue, char = {}, segmentCurrentTick = tickValue) => {
      const offset = normalizeDayTickOffset_ACU(tickValue);
      const 运行时 = 读取时代修炼运行时_ACU();
      const schedule = 运行时 && typeof 运行时.getMeditationSchedule === 'function'
        ? 运行时.getMeditationSchedule(char, { currentTick: segmentCurrentTick })
        : { start: NIGHT_MEDITATION_START_TICK_ACU, end: NIGHT_MEDITATION_END_TICK_ACU };
      return offset < Number(schedule.end || 0) || offset >= Number(schedule.start || DAY_TICK_SPAN_ACU);
    };

    const getNextDailyAutoBoundaryTick_ACU = (tickValue, endTick, char = {}, segmentCurrentTick = tickValue) => {
      const safeTick = Number(tickValue || 0);
      const safeEndTick = Math.max(safeTick, Number(endTick || 0));
      const dayBase = safeTick - normalizeDayTickOffset_ACU(safeTick);
      const offset = normalizeDayTickOffset_ACU(safeTick);
      const 运行时 = 读取时代修炼运行时_ACU();
      const schedule = 运行时 && typeof 运行时.getMeditationSchedule === 'function'
        ? 运行时.getMeditationSchedule(char, { currentTick: segmentCurrentTick })
        : { start: NIGHT_MEDITATION_START_TICK_ACU, end: NIGHT_MEDITATION_END_TICK_ACU };
      const start = Number(schedule.start || NIGHT_MEDITATION_START_TICK_ACU);
      const end = Number(schedule.end || NIGHT_MEDITATION_END_TICK_ACU);
      let boundary = safeEndTick;
      if (offset < end) {
        boundary = dayBase + end;
      } else if (offset < start) {
        boundary = dayBase + start;
      } else {
        boundary = dayBase + DAY_TICK_SPAN_ACU;
      }
      return Math.min(safeEndTick, boundary);
    };

    const getNextEraBoundaryTick_ACU = (tickValue, endTick) => {
      const safeTick = Math.max(0, Number(tickValue || 0));
      const safeEndTick = Math.max(safeTick, Number(endTick || 0));
      const 时代库 = 读取库运行时_V1();
      const thresholds = Object.values(时代库?.eraThresholds || {})
        .map(item => Number(item?.thresholdTick))
        .filter(threshold => Number.isFinite(threshold) && threshold > safeTick && threshold <= safeEndTick);
      return Math.min(safeEndTick, ...thresholds);
    };

    const 获取跨过日界tick列表_ACU = (前tick, 后tick, 日内偏移 = 0) => {
      const 前值 = Math.max(0, Math.floor(Number(前tick) || 0));
      const 后值 = Math.max(0, Math.floor(Number(后tick) || 0));
      const 偏移 = normalizeDayTickOffset_ACU(日内偏移);
      if (后值 <= 前值) return [];
      const 起始日序号 = Math.floor((前值 - 偏移) / DAY_TICK_SPAN_ACU);
      const 结束日序号 = Math.floor((后值 - 偏移) / DAY_TICK_SPAN_ACU);
      if (结束日序号 < 起始日序号 + 1) return [];
      const 结果 = [];
      for (let 日序号 = 起始日序号 + 1; 日序号 <= 结束日序号; 日序号++) {
        const 判定tick = 日序号 * DAY_TICK_SPAN_ACU + 偏移;
        if (判定tick > 前值 && 判定tick <= 后值) {
          结果.push(判定tick);
        }
      }
      return 结果;
    };

    const getResourceRatioForDailyAuto_ACU = (currentValue, maxValue) => {
      const upper = Math.max(1, Number(maxValue || 1));
      return Math.max(0, Math.min(1, Number(currentValue || 0) / upper));
    };

    const shouldDailyAutoSleep_ACU = char => {
      const vitRatio = getResourceRatioForDailyAuto_ACU(char?.属性?.体力, char?.属性?.体力上限);
      const menRatio = getResourceRatioForDailyAuto_ACU(char?.属性?.精神力, char?.属性?.精神力上限);
      return vitRatio < 0.45 || menRatio < 0.45 || (vitRatio < 0.6 && menRatio < 0.6);
    };

    const 城市消费倍率表_ACU = Object.freeze([1, 10, 100, 1000]);
    const 城市修炼加成表_ACU = Object.freeze([0, 0.05, 0.1, 0.2]);
    const 城市档位名称表_ACU = Object.freeze(['聚落', '城镇', '城市', '主城']);

    const 归一化地点文本_ACU = 地点 => {
      const 原文 = String(地点 || '')
        .replace(/^斗罗大陆-/, '')
        .replace(/^斗灵大陆-/, '')
        .trim();
      const 分段 = 原文.split('-').filter(Boolean);
      return {
        原文,
        末段: 分段[分段.length - 1] || 原文,
        分段,
      };
    };

    const 判断地点相容_ACU = (地点甲, 地点乙) => {
      const 甲 = 归一化地点文本_ACU(地点甲);
      const 乙 = 归一化地点文本_ACU(地点乙);
      if (!甲.原文 || !乙.原文) return 甲.原文 === 乙.原文;
      if (甲.原文 === 乙.原文 || 甲.末段 === 乙.末段) return true;
      return 甲.分段.some(片段 => 乙.分段.includes(片段));
    };

    const 读取地点信息_ACU = 角色 => {
      const 地点名 = String(角色?.状态?.位置 || '').trim();
      if (!地点名) return { 地点名: '', 地点信息: null, 文本: '' };
      const 动态地点信息 = data?.world?.动态地点?.[地点名];
      const 静态地点信息 = data?.world?.地点?.[地点名];
      const 地点信息 = 动态地点信息 && typeof 动态地点信息 === 'object' ? 动态地点信息 : 静态地点信息 || null;
      const 父节点名 = String(地点信息?.归属父节点 || '').trim();
      const 父节点条目 = 父节点名 ? findMapNodeEntry(父节点名, data) : null;
      const 文本 = [
        地点名,
        地点信息?.类型,
        地点信息?.描述,
        父节点名,
        Array.isArray(父节点条目?.path) ? 父节点条目.path.join('-') : '',
        父节点条目?.node?.类型,
        父节点条目?.node?.描述,
      ]
        .map(项 => String(项 || '').trim())
        .filter(Boolean)
        .join(' ');
      return { 地点名, 地点信息, 父节点信息: 父节点条目?.node || null, 文本 };
    };

    const 判定角色所在地货币_ACU = 角色 => {
      const 地点上下文 = 读取地点信息_ACU(角色);
      const 文本 = [
        地点上下文.文本,
        地点上下文.地点信息?.归属父节点,
        地点上下文.地点信息?.描述,
        地点上下文.地点信息?.类型,
        地点上下文.父节点信息?.类型,
        地点上下文.父节点信息?.描述,
      ]
        .map(项 => String(项 || '').trim())
        .filter(Boolean)
        .join(' ');
      return /星罗大陆|斗灵大陆/.test(文本) ? '星罗币' : '联邦币';
    };

    const 发放魂师津贴_ACU = () => {
      const payoutItems = [];
      _(data.char).forEach((c, charName) => {
        if (!isSoulMasterStipendEligible_ACU(c)) return;
        if (!c.财富 || typeof c.财富 !== 'object' || Array.isArray(c.财富)) c.财富 = {};
        const stipendDays = getSoulMasterStipendDaysByLevel_ACU(c.属性?.等级 || 0);
        const stipendAmount = stipendDays * BASE_DAILY_LIVING_COST_ACU;
        if (!(stipendAmount > 0)) return;
        const 货币字段 = 判定角色所在地货币_ACU(c);
        c.财富[货币字段] = Math.max(0, Number(c.财富[货币字段] || 0)) + stipendAmount;
        payoutItems.push(`${charName}+${stipendAmount}${货币字段}`);
      });
      return payoutItems;
    };

    const 判定城市规模档位_ACU = 角色 => {
      const 地点上下文 = 读取地点信息_ACU(角色);
      const 文本 = 地点上下文.文本;
      if (!文本) return { 档位索引: -1, 名称: '无城市环境' };
      const 当前层级 = Math.max(0, Math.floor(Number(地点上下文.地点信息?.层级 || 0)));
      const 父节点层级 = Math.max(0, Math.floor(Number(地点上下文.父节点信息?.层级 || 0)));
      const 层级 = 当前层级 || 父节点层级;
      if (/首都|皇城|帝都|都城|主城|海外首都/.test(文本)) {
        return { 档位索引: 3, 名称: 城市档位名称表_ACU[3] };
      }
      if (/城|学院|塔|都会|都市/.test(文本) || 层级 === 2) {
        return { 档位索引: 2, 名称: 城市档位名称表_ACU[2] };
      }
      if (/镇|村|街|巷|营地|分部|据点|市集|聚落/.test(文本)) {
        return { 档位索引: 1, 名称: 城市档位名称表_ACU[1] };
      }
      if (/居住|驿站|客栈|宿舍|据点|营地/.test(文本) || 层级 >= 3) {
        return { 档位索引: 0, 名称: 城市档位名称表_ACU[0] };
      }
      return { 档位索引: -1, 名称: '无城市环境' };
    };

    const 判断学院基础食宿保障_ACU = 角色 => {
      const 地点文本 = 读取地点信息_ACU(角色).文本;
      if (!/(学院|校区|宿舍|宿舍区|食堂)/.test(地点文本)) return false;
      const 势力 = 角色?.社交?.势力 && typeof 角色.社交.势力 === 'object' && !Array.isArray(角色.社交.势力) ? 角色.社交.势力 : {};
      const 身份文本 = [
        角色?.社交?.主身份,
        ...Object.entries(势力).flatMap(([势力名, 势力数据]) => [势力名, 势力数据?.身份]),
      ]
        .map(项 => String(项 || '').trim())
        .filter(Boolean)
        .join(' ');
      if (/(工读生|自费|需缴费|欠费|临时工|旁听|访客|外来|借宿)/.test(身份文本)) return false;
      return /(学生|学员|新生|弟子|正式生)/.test(身份文本);
    };

    const 收集角色武魂属性词_ACU = 角色 => {
      const 词集合 = new Set();
      取角色武魂条目_V1(角色).forEach(([槽位名, 武魂数据]) => {
        const 属性状态 = normalizeSpiritAttributeState(武魂数据 || {}, 槽位名, 角色);
        [武魂数据?.系别, 武魂数据?.表象名称, 武魂数据?.属性体系, 武魂数据?.描述, ...(属性状态?.可调用元素 || [])]
          .map(项 => String(项 || '').trim())
          .filter(Boolean)
          .forEach(词 => 词集合.add(词));
      });
      return Array.from(词集合);
    };

    const 计算地图拟态倍率_ACU = 角色 => {
      const 地点上下文 = 读取地点信息_ACU(角色);
      const 地点文本 = 地点上下文.文本;
      if (!地点文本) return { 倍率: 1, 来源: '无地点数据' };
      const 武魂词 = 收集角色武魂属性词_ACU(角色);
      if (!武魂词.length) return { 倍率: 1, 来源: '无武魂属性' };

      const 拟态规则表 = [
        { 关键词: ['冰', '雪', '寒', '冻', '霜'], 地形: /(冰|雪|寒|冻|霜|冰川|冰山)/, 加成: 0.2, 名称: '冰系拟态' },
        { 关键词: ['火', '炎', '焰', '熔', '热'], 地形: /(火山|熔岩|炎|热|地火|赤地)/, 加成: 0.2, 名称: '火系拟态' },
        { 关键词: ['水', '海', '潮', '雨', '雾'], 地形: /(海|湖|河|雨林|潮|湿地|水域)/, 加成: 0.16, 名称: '水系拟态' },
        { 关键词: ['风', '翼', '空', '云', '雷鹏'], 地形: /(高空|山巅|峡谷|风口|云层)/, 加成: 0.14, 名称: '风系拟态' },
        { 关键词: ['雷', '电', '霆'], 地形: /(雷|电|风暴|雷暴)/, 加成: 0.15, 名称: '雷系拟态' },
        { 关键词: ['土', '岩', '山', '石'], 地形: /(山|岩|矿|地脉|洞窟)/, 加成: 0.12, 名称: '土系拟态' },
        { 关键词: ['木', '林', '草', '藤', '花'], 地形: /(森林|林海|草原|藤|花海|雨林)/, 加成: 0.12, 名称: '木系拟态' },
        { 关键词: ['光', '圣'], 地形: /(圣殿|日耀|光|辉)/, 加成: 0.1, 名称: '光系拟态' },
        { 关键词: ['暗', '影', '夜', '冥'], 地形: /(夜|暗|幽|冥|影)/, 加成: 0.1, 名称: '暗系拟态' },
      ];

      let 倍率 = 1;
      const 来源列表 = [];
      拟态规则表.forEach(规则 => {
        const 命中属性 = 规则.关键词.some(关键词 => 武魂词.some(词 => String(词 || '').includes(关键词)));
        if (!命中属性) return;
        if (!规则.地形.test(地点文本)) return;
        倍率 *= 1 + Number(规则.加成 || 0);
        来源列表.push(规则.名称);
      });
      const 安全倍率 = Math.max(1, Math.min(2.2, Number(倍率.toFixed(4))));
      return {
        倍率: 安全倍率,
        来源: 来源列表.length ? 来源列表.join(' + ') : '无拟态命中',
      };
    };

    const 读取修炼食物倍率_ACU = (角色, 动作模式 = '日常') => {
      const 状态表 = 角色?.属性?.状态效果;
      if (!状态表 || typeof 状态表 !== 'object') return { 倍率: 1, 来源: '无食物增益' };
      const 当前动作模式 = normalizeCharacterActionMode_ACU(动作模式);
      let 倍率 = 1;
      const 来源列表 = [];
      Object.entries(状态表).forEach(([状态名, 状态值]) => {
        if (!状态值 || typeof 状态值 !== 'object') return;
        if (状态名 === '地点拟态修炼' && 状态值.结算模式 === '本轮冥想') {
          if (当前动作模式 !== '冥想') return;
          const 拟态倍率 = Number(状态值.收益倍率 || 0);
          if (!Number.isFinite(拟态倍率) || 拟态倍率 <= 1) return;
          倍率 *= 拟态倍率;
          来源列表.push(状态名);
          return;
        }
      });
      const 安全倍率 = Math.max(1, Math.min(3.5, Number(倍率.toFixed(4))));
      return { 倍率: 安全倍率, 来源: 来源列表.length ? 来源列表.join(' + ') : '无食物增益' };
    };

    const 读取修炼增益倍率_ACU = (角色, 条件 = {}) => {
      const 状态表 = 角色?.属性?.状态效果;
      const 收益类型 = String(条件.收益类型 || '').trim();
      const 修炼属性 = String(条件.修炼属性 || '').trim();
      const 训练方式 = String(条件.训练方式 || '').trim();
      if (!状态表 || typeof 状态表 !== 'object' || !收益类型) return 1;
      let 倍率 = 1;
      Object.entries(状态表).forEach(([状态名, 状态值]) => {
        if (!状态值 || typeof 状态值 !== 'object') return;
        const 结束tick = Math.max(0, Math.floor(Number(状态值.结束tick || 0)));
        if (结束tick > 0 && currentTick >= 结束tick) {
          delete 状态表[状态名];
          return;
        }
        if (String(状态值.收益类型 || '').trim() !== 收益类型) return;
        if (收益类型 === '属性修炼速度' && String(状态值.修炼属性 || '').trim() !== 修炼属性) return;
        if (收益类型 === '训练方式收益' && String(状态值.训练方式 || '').trim() !== 训练方式) return;
        const 状态倍率 = Number(状态值.收益倍率 || 0);
        if (!Number.isFinite(状态倍率) || 状态倍率 <= 0) return;
        倍率 *= 状态倍率;
      });
      return Math.max(0.1, Math.min(5, Number(倍率.toFixed(4))));
    };

    const 计算关系同修倍率_ACU = (角色, 角色名 = '') => {
      const 关系表 = 角色?.社交?.关系;
      if (!关系表 || typeof 关系表 !== 'object') return { 倍率: 1, 来源: '无关系数据' };
      const 当前地点 = String(角色?.状态?.位置 || '').trim();
      const 显式同修对象 = String(角色?.状态?.同修对象 || 角色?.状态?.双修对象 || '').trim();

      let 同修对象名 = '';
      let 同修关系数据 = null;
      if (显式同修对象 && 关系表[显式同修对象]) {
        const 候选角色 = data?.char?.[显式同修对象];
        if (!候选角色 || 判断地点相容_ACU(当前地点, 候选角色?.状态?.位置 || '')) {
          同修对象名 = 显式同修对象;
          同修关系数据 = 关系表[显式同修对象];
        }
      }
      if (!同修关系数据) {
        Object.entries(关系表).forEach(([目标名, 关系数据]) => {
          if (目标名 === 角色名) return;
          const 目标角色 = data?.char?.[目标名];
          if (!目标角色) return;
          if (!判断地点相容_ACU(当前地点, 目标角色?.状态?.位置 || '')) return;
          if (!同修关系数据 || 计算武魂相关度总分(关系数据) > 计算武魂相关度总分(同修关系数据)) {
            同修对象名 = 目标名;
            同修关系数据 = 关系数据;
          }
        });
      }
      if (!同修关系数据) return { 倍率: 1, 来源: '无同修对象' };
      const 相关度总分 = 计算武魂相关度总分(同修关系数据);
      const 倍率 = Math.max(1, Number((1 + 相关度总分 * 0.0025).toFixed(4)));
      return { 倍率, 来源: 同修对象名 ? `同修:${同修对象名}` : '同修' };
    };

    const 计算基础成长倍率_ACU = (角色, 角色名 = '', 动作模式 = '日常') => {
      const 模式 = String(动作模式 || '').trim();
      const 生效模式 = ['冥想', '肉体训练', '精神训练', '日常'].includes(模式);
      if (!生效模式) return { 倍率: 1, 构成说明: '常规', 明细: {} };

      const 同修倍率信息 = 计算关系同修倍率_ACU(角色, 角色名);
      const 拟态倍率信息 = 计算地图拟态倍率_ACU(角色);
      const 城市档位信息 = 判定城市规模档位_ACU(角色);
      const 城市修炼倍率 = 1 + (城市档位信息.档位索引 >= 0 ? Number(城市修炼加成表_ACU[城市档位信息.档位索引] || 0) : 0);
      const 食物倍率信息 = 读取修炼食物倍率_ACU(角色, 模式);
      const 总倍率 = Math.max(
        1,
        Math.min(8, Number((同修倍率信息.倍率 * 拟态倍率信息.倍率 * 城市修炼倍率 * 食物倍率信息.倍率).toFixed(4))),
      );
      return {
        倍率: 总倍率,
        构成说明: [
          `同修${同修倍率信息.倍率.toFixed(3)}`,
          `拟态${拟态倍率信息.倍率.toFixed(3)}`,
          `城市${城市修炼倍率.toFixed(3)}`,
          `食物${食物倍率信息.倍率.toFixed(3)}`,
        ].join(' × '),
        明细: {
          同修: 同修倍率信息,
          拟态: 拟态倍率信息,
          城市: {
            倍率: 城市修炼倍率,
            档位: 城市档位信息.档位索引,
            名称: 城市档位信息.名称,
          },
          食物: 食物倍率信息,
        },
      };
    };

    const 计算可负担消费档位_ACU = (存款, 基础日消费, 目标档位索引) => {
      const 安全存款 = Math.max(0, Number(存款 || 0));
      const 安全基础日消费 = Math.max(0, Number(基础日消费 || 0));
      const 安全目标档位 = Math.max(0, Math.min(3, Math.floor(Number(目标档位索引 || 0))));
      for (let 档位索引 = 安全目标档位; 档位索引 >= 0; 档位索引 -= 1) {
        const 周消费 = 安全基础日消费 * Number(城市消费倍率表_ACU[档位索引] || 1) * 7;
        if (安全存款 >= 周消费) return 档位索引;
      }
      return 0;
    };

    const normalizeCharacterActionMode_ACU = actionMode => {
      const raw = String(actionMode || '').trim() || '日常';
      return raw === '凝聚魂核' ? '冥想' : raw;
    };

    const roundRuntimeGrowthValue_ACU = value => Number(Number(value || 0).toFixed(4));

    const syncRoundedDisplaySoulPower_ACU = char => {
      if (!char?.属性) return;
      const soulPowerCap = Number(char.属性?.魂力上限 || 0);
      if (Number.isFinite(soulPowerCap) && soulPowerCap > 0) {
        char.属性.魂力上限 = Math.max(1, Math.ceil(soulPowerCap));
      }
      if (Number.isFinite(Number(char.属性?.魂力 || 0))) {
        char.属性.魂力 = Math.max(0, Math.min(Number(char.属性.魂力 || 0), Number(char.属性.魂力上限 || 0)));
      }
      if (Number.isFinite(Number(char.属性?.精神力 || 0)) && Number.isFinite(Number(char.属性?.精神力上限 || 0))) {
        char.属性.精神力 = Math.max(0, Math.min(Number(char.属性.精神力 || 0), Number(char.属性.精神力上限 || 0)));
      }
      if (Number.isFinite(Number(char.属性?.体力 || 0)) && Number.isFinite(Number(char.属性?.体力上限 || 0))) {
        char.属性.体力 = Math.max(0, Math.min(Number(char.属性.体力 || 0), Number(char.属性.体力上限 || 0)));
      }
      if (Number.isFinite(Number(char.属性?.HP || 0)) && Number.isFinite(Number(char.属性?.HP上限 || 0))) {
        char.属性.HP = Math.max(0, Math.min(Number(char.属性.HP || 0), Number(char.属性.HP上限 || 0)));
      }
    };

    const applyCharacterActionSegment_ACU = (c, actionMode, segmentDelta, trainedBonus, 角色名 = '', segmentCurrentTick = currentTick) => {
      const safeDelta = Math.max(0, Number(segmentDelta || 0));
      if (!(safeDelta > 0) || !c?.属性) return;
      const segmentTick = Math.max(0, Number(segmentCurrentTick ?? currentTick) || 0);
      计算紫极魔瞳境界_V1(c, segmentTick);
      const normalizedActionMode = normalizeCharacterActionMode_ACU(actionMode);
      const 应用伤势恢复到生命值 = 基础恢复倍率 => {
        const 安全基础恢复倍率 = Math.max(0, Number(基础恢复倍率 || 0));
        if (!(安全基础恢复倍率 > 0)) return;
        const 生命值上限 = Math.max(1, Number(c?.属性?.HP上限 || c?.属性?.体力上限 || 1));
        const 当前生命值 = Math.max(0, Number(c?.属性?.HP || 0));
        if (当前生命值 >= 生命值上限) return;
        const 伤势恢复倍率 = Math.max(0, Number(getComputedWoundRecoveryRatioFromStat(c?.属性 || {}) || 0));
        if (!(伤势恢复倍率 > 0)) return;
        const 恢复量 = roundRuntimeGrowthValue_ACU(生命值上限 * 安全基础恢复倍率 * safeDelta * 伤势恢复倍率);
        if (!(恢复量 > 0)) return;
        c.属性.HP = Math.min(生命值上限, roundRuntimeGrowthValue_ACU(当前生命值 + 恢复量));
      };
      const 修炼倍率信息 = 计算基础成长倍率_ACU(c, 角色名, normalizedActionMode);
      const 基础成长倍率 = Math.max(1, Number(修炼倍率信息.倍率 || 1));
      const 读取训练方式收益倍率 = 训练方式 => 读取修炼增益倍率_ACU(c, { 收益类型: '训练方式收益', 训练方式 });
      const 读取属性成长倍率 = 修炼属性 => 读取修炼增益倍率_ACU(c, { 收益类型: '属性修炼速度', 修炼属性 });
      const 肉体训练收益倍率 = 读取训练方式收益倍率('肉体训练');
      const 精神训练收益倍率 = 读取训练方式收益倍率('精神训练');
      const 日常训练收益倍率 = 读取训练方式收益倍率('日常训练');
      const 冥想收益倍率 = 读取训练方式收益倍率('冥想');
      if (!c.属性.训练加成 || typeof c.属性.训练加成 !== 'object' || Array.isArray(c.属性.训练加成)) {
        c.属性.训练加成 = createNumericStatBonusMap({});
      }
      const hasNoSoulPowerTalent = isNoSoulPowerTalentTier(c?.属性?.天赋梯队);
      const coreCount = c.魂核?.核心?.数量 || 0;
      let spRate = 0.01;
      let vitMenRate = 0;

      if (normalizedActionMode === '冥想') {
        spRate = coreCount === 0 ? 0.05 : coreCount === 1 ? 0.2 : coreCount === 2 ? 0.3 : 0.4;
        vitMenRate = 0.005;
        const menRate = 0.008;
        c.属性.精神力 = Math.min(c.属性.精神力上限, roundRuntimeGrowthValue_ACU(c.属性.精神力 + c.属性.精神力上限 * menRate * safeDelta));
        c.属性.体力 = Math.min(c.属性.体力上限, roundRuntimeGrowthValue_ACU(c.属性.体力 + c.属性.体力上限 * vitMenRate * safeDelta));
        应用伤势恢复到生命值(0.0008);
      } else if (normalizedActionMode === '战斗') {
        spRate = 0;
        vitMenRate = 0;
      } else if (normalizedActionMode === '睡眠') {
        spRate = 0.01;
        const sleepRate = 0.01;
        c.属性.精神力 = Math.min(c.属性.精神力上限, roundRuntimeGrowthValue_ACU(c.属性.精神力 + c.属性.精神力上限 * sleepRate * safeDelta));
        c.属性.体力 = Math.min(c.属性.体力上限, roundRuntimeGrowthValue_ACU(c.属性.体力 + c.属性.体力上限 * sleepRate * safeDelta));
        应用伤势恢复到生命值(0.0015);
      } else {
        c.属性.精神力 = Math.min(c.属性.精神力上限, roundRuntimeGrowthValue_ACU(c.属性.精神力 + c.属性.精神力上限 * vitMenRate * safeDelta));
        c.属性.体力 = Math.min(c.属性.体力上限, roundRuntimeGrowthValue_ACU(c.属性.体力 + c.属性.体力上限 * vitMenRate * safeDelta));
        应用伤势恢复到生命值(0.0004);
      }

      if (hasNoSoulPowerTalent) spRate = 0;
      c.属性.魂力 = Math.min(c.属性.魂力上限, roundRuntimeGrowthValue_ACU(c.属性.魂力 + c.属性.魂力上限 * spRate * safeDelta));

      const 血脉核心 = String(c.血脉之力?.核心 || '').trim();
      if (血脉核心 && 血脉核心 !== '未凝聚' && 血脉核心 !== '无') {
        c.属性.体力 = Math.min(c.属性.体力上限, roundRuntimeGrowthValue_ACU(c.属性.体力 + c.属性.体力上限 * 0.05 * safeDelta));
        应用伤势恢复到生命值(0.003);
      }

      if (normalizedActionMode === '冥想' && !hasNoSoulPowerTalent) {
        const 运行时 = 读取时代修炼运行时_ACU();
        if (运行时 && typeof 运行时.settleMeditationSegment === 'function') {
          let externalMultiplier = 基础成长倍率 * 冥想收益倍率 * 读取属性成长倍率('魂力上限') * 获取角色魂力获取速度系数_ACU(c) * getDualSpiritSoulPowerCoeff(c);
          if (c.功法?.['玄天功']) externalMultiplier *= 1.1;
          const talent = String(c?.属性?.天赋梯队 || '').trim();
          const currentCoreCount = Math.max(0, Math.floor(Number(c?.魂核?.核心?.数量 || 0)));
          if (talent === '优秀') {
            if (currentCoreCount === 1) externalMultiplier *= GOOD_TALENT_STAGE1_GROWTH_MULTIPLIER_ACU;
            else if (currentCoreCount === 2) externalMultiplier *= GOOD_TALENT_STAGE2_GROWTH_MULTIPLIER_ACU;
            else if (currentCoreCount >= 3) externalMultiplier *= GOOD_TALENT_STAGE3_GROWTH_MULTIPLIER_ACU;
          }
          if (isTopTalentLateBloom_ACU(c) && Number(c.属性?.年龄 || 0) >= 35 && currentCoreCount >= 2) {
            externalMultiplier *= TOP_TALENT_LATE_BLOOM_GROWTH_MULTIPLIER_ACU;
          }
          if (isGoodTalentLateBloom_ACU(c) && Number(c.属性?.年龄 || 0) >= GOOD_TALENT_LATE_BLOOM_START_AGE_ACU) {
            externalMultiplier *= GOOD_TALENT_LATE_BLOOM_GROWTH_MULTIPLIER_ACU;
          }
          const levelCap = Number(c?.属性?.等级 || 0) >= 100
            ? Number.POSITIVE_INFINITY
            : typeof getCharacterSoulRingLevelCap === 'function'
              ? getCharacterSoulRingLevelCap(c)
              : Number.POSITIVE_INFINITY;
          const 时代集成 = [globalThis]
            .concat(globalThis.parent && globalThis.parent !== globalThis ? [globalThis.parent] : [])
            .concat(globalThis.top && globalThis.top !== globalThis ? [globalThis.top] : [])
            .map(候选 => 候选 && 候选.__LWCS_ERA_RUNTIME_INTEGRATION_V1__)
            .find(接口 => 接口 && typeof 接口.getCultivationBlend === 'function');
          const 渐变 = 时代集成
            ? 时代集成.getCultivationBlend(segmentTick, { dataRoot: data })
            : null;
          运行时.settleMeditationSegment(c, safeDelta, {
            currentTick: segmentTick,
            externalMultiplier,
            levelCap,
            requirementMultiplier: getDualSpiritSoulPowerCoeff(c),
            ...(渐变 ? { blend: 渐变 } : {}),
          });
        }
      }

      if (normalizedActionMode === '肉体训练') {
        const cycles = Math.floor(safeDelta / 6);
        let actualCycles = 0;
        for (let i = 0; i < cycles; i++) {
          if (c.属性.体力 >= c.属性.体力上限 * 0.3) {
            c.属性.体力 -= c.属性.体力上限 * 0.3;
            actualCycles++;
          } else break;
        }
        if (actualCycles > 0) {
          const gain = 0.05 * actualCycles * 基础成长倍率 * 肉体训练收益倍率;
          addNumericStatBonusEntries(trainedBonus, {
            力量: gain * 读取属性成长倍率('力量'),
            防御: gain * 读取属性成长倍率('防御'),
            敏捷: gain * 读取属性成长倍率('敏捷'),
            体力上限: gain * 读取属性成长倍率('体力上限'),
          });
        }
      } else if (normalizedActionMode === '精神训练') {
        const cycles = Math.floor(safeDelta / 6);
        let actualCycles = 0;
        for (let i = 0; i < cycles; i++) {
          if (c.属性.精神力 > c.属性.精神力上限 * 0.1) {
            c.属性.精神力 -= c.属性.精神力 * 0.8;
            actualCycles++;
          } else break;
        }
        if (actualCycles > 0 && c.属性.年龄 <= 40) {
          let gain = 0.02 * actualCycles * 基础成长倍率 * 精神训练收益倍率 * 读取属性成长倍率('精神力上限');
          gain = Math.floor(gain * 读取紫极魔瞳精神训练倍率_V1(c, segmentTick));
          addNumericStatBonusValue(trainedBonus, '精神力上限', gain);
        }
      } else if (normalizedActionMode === '日常') {
        const passiveDays = safeDelta / DAY_TICK_SPAN_ACU;
        if (passiveDays > 0) {
          const passiveGain = 0.01 * passiveDays * 基础成长倍率 * 日常训练收益倍率;
          addNumericStatBonusEntries(trainedBonus, {
            力量: passiveGain * 读取属性成长倍率('力量'),
            防御: passiveGain * 读取属性成长倍率('防御'),
            敏捷: passiveGain * 读取属性成长倍率('敏捷'),
            体力上限: passiveGain * 读取属性成长倍率('体力上限'),
          });
          if (c.属性.年龄 <= 40) {
            addNumericStatBonusValue(trainedBonus, '精神力上限', passiveGain * 0.5 * 读取属性成长倍率('精神力上限'));
          }
        }
      }
    };

    data.world.时间._calendar = formatTickToCalendar(currentTick);

    _(data.char || {}).forEach(charData => {
      if (!charData || typeof charData !== 'object' || !charData.背包 || typeof charData.背包 !== 'object')
        return;
      Object.keys(charData.背包).forEach(itemName => {
        const item = charData.背包[itemName];
        const expiryTick = Number(item?.有效期至tick || 0);
        if (expiryTick > 0 && currentTick >= expiryTick) {
          delete charData.背包[itemName];
        }
      });
    });

    const 已有上次结算tick = Object.prototype.hasOwnProperty.call(data.world.时间, '_上次结算tick');
    const 原始上次结算tick = 已有上次结算tick ? data.world.时间._上次结算tick : data.world.时间.上次结算tick;
    const 原始上次结算数值 = Number(原始上次结算tick);
    const 是否新档初始化 = currentTick > 0 && !已有上次结算tick;
    let lastTick = Number.isFinite(原始上次结算数值) ? 原始上次结算数值 : currentTick;
    const 临时角色结算模式表 =
      data.world.时间._临时角色结算模式 &&
      typeof data.world.时间._临时角色结算模式 === 'object' &&
      !Array.isArray(data.world.时间._临时角色结算模式)
        ? data.world.时间._临时角色结算模式
        : {};
    delete data.world.时间._临时角色结算模式;
    if (是否新档初始化 && currentTick > 0 && !Object.keys(临时角色结算模式表).length) {
      /*
      魂师津贴系统暂时隐藏，保留备用。
      const 首发津贴条目 = 发放魂师津贴_ACU();
      if (首发津贴条目.length) {
        appendSystemReasonBatchText('[魂师津贴首发]', [
          `${formatTickToCalendar(currentTick)} ${首发津贴条目.slice(0, 3).join('；')}${首发津贴条目.length > 3 ? ` 等${首发津贴条目.length}人` : ''}`,
        ]);
      }
      */
      lastTick = currentTick;
      data.world.时间._上次结算tick = currentTick;
    }
    let delta = currentTick - lastTick;
    const 本轮跨过日界tick列表 = delta > 0 ? 获取跨过日界tick列表_ACU(lastTick, currentTick) : [];
    if (delta > 0 && data.sys.系统播报 && data.sys.系统播报 !== '初始化') {
      data.sys.系统播报 = '初始化';
    }

    let refreshQuestBoardFrames = () => {};
    const lowerCaseKeys = obj => {
      const QUEST_BOARD_TIER_ORDER = ['D', 'C', 'B', 'A', 'S'];
      const QUEST_BOARD_TIER_SETTINGS = Object.freeze({
        D: { rewardCoin: [500, 3000], rewardRep: [10, 30], progress: [1, 2], resourceLabel: '基础药剂/干粮' },
        C: { rewardCoin: [5000, 50000], rewardRep: [50, 150], progress: [2, 4], resourceLabel: '高级药剂/百锻精铁' },
        B: {
          rewardCoin: [100000, 1000000],
          rewardRep: [200, 500],
          progress: [3, 5],
          resourceLabel: '一字斗铠图纸/百锻金属块',
        },
        A: {
          rewardCoin: [2000000, 20000000],
          rewardRep: [1000, 3000],
          progress: [4, 6],
          resourceLabel: '黄级机甲/千锻~灵锻金属',
        },
        S: {
          rewardCoin: [50000000, 300000000],
          rewardRep: [5000, 8000],
          progress: [5, 8],
          resourceLabel: '紫级以上机甲/魂锻天锻金属/极品道具',
        },
      });
      const QUEST_BOARD_PENDING_LIMIT = 8;
      const QUEST_BOARD_PENDING_STALE_TICKS = 4032;
      const QUEST_BOARD_ARCHIVE_STALE_TICKS = 2016;
      const 委托板每日tick数 = 144;
      const 委托板时限天数范围 = Object.freeze({
        D: [2, 4],
        C: [3, 6],
        B: [5, 9],
        A: [7, 14],
        S: [10, 21],
      });

      const QUEST_BOARD_GENERAL_DESCRIPTORS = Object.freeze([
        {
          id: 'daily',
          class: 'general',
          label: '日常',
          type: '日常委托',
          publishers: ['学院后勤', '本地商会', '城市委托板'],
          maxTierIndex: 1,
          titles: {
            D: ['城内代送', '街区寻物', '校区跑腿'],
            C: ['跨区代办', '仓单核对', '药剂代购'],
          },
        },
        {
          id: 'investigation',
          class: 'general',
          label: '调查',
          type: '调查委托',
          publishers: ['传灵塔', '学院情报处', '当地执法队'],
          maxTierIndex: 4,
          titles: {
            D: ['异常足迹核查', '街区消息回收', '失物线索确认'],
            C: ['黑市货物流向追查', '外围据点摸排', '失联补给点核验'],
            B: ['危险区坐标复核', '高价值情报回收', '独立遗迹线索比对'],
            A: ['高危区域密档调查', '大额悬赏情报锁定', '独立遗迹入口勘验'],
            S: ['封存档案追索', '王级侧线目标定位', '独立禁区坐标回收'],
          },
        },
        {
          id: 'gathering',
          class: 'general',
          label: '采集',
          type: '采集委托',
          publishers: ['药剂铺', '锻造工坊', '本地商会'],
          maxTierIndex: 4,
          titles: {
            D: ['常规药草采集', '基础矿料回收', '学院配给补料'],
            C: ['高级药材采收', '百锻材料搜集', '稀有票据换货'],
            B: ['千锻主材回收', '一字斗铠辅材搜集', '高价值矿脉采样'],
            A: ['灵锻材料定向搜集', '黄级机甲部件回收', '高危资源点采收'],
            S: ['魂锻试材搜寻', '极品侧线资源回收', '天锻前置材料封存'],
          },
        },
        {
          id: 'escort',
          class: 'general',
          label: '护送',
          type: '护送委托',
          publishers: ['本地商会', '联邦驿运站', '学院后勤'],
          maxTierIndex: 4,
          titles: {
            D: ['短程货箱护送', '票据转运护航', '学员物资押送'],
            C: ['跨区补给护送', '高价药剂押运', '工坊订单转运'],
            B: ['图纸密件护送', '稀有材料押运', '贵重货物交接'],
            A: ['机密模组护送', '黄级机甲部件押运', '大宗灵锻物资转运'],
            S: ['顶级拍品侧线押送', '魂锻资源封存护航', '高危独立运输委托'],
          },
        },
        {
          id: 'battle',
          class: 'general',
          label: '战斗',
          type: '战斗委托',
          publishers: ['城市守备队', '联邦军方', '战神殿外勤', '传灵塔外勤'],
          maxTierIndex: 4,
          titles: {
            D: ['街区治安清理', '低危魂兽驱离', '外围巡逻增援'],
            C: ['小股敌对势力清剿', '中危魂兽讨伐', '外围据点拔除'],
            B: ['高危目标悬赏', '危险群落歼灭', '精英目标处置'],
            A: ['高阶讨伐令', '大型敌对据点突袭', '重赏清场委托'],
            S: ['王级侧线目标讨伐', '独立高危封锁战', '黑市武装首脑清除'],
          },
        },
      ]);

      const QUEST_BOARD_PROFESSION_DESCRIPTORS = Object.freeze([
        {
          id: 'forging',
          class: 'profession',
          label: '副职业/锻造',
          type: '副职业委托',
          publisher: '锻造师协会',
          keywords: ['锻造'],
          titles: {
            D: ['基础锻胚整形', '工坊代锻练习件'],
            C: ['百锻精铁回火', '高级器胚定型'],
            B: ['千锻部件代工', '一字斗铠外甲成型'],
            A: ['灵锻主材调合', '黄级机甲骨架锻造'],
            S: ['魂锻试作委托', '天锻前置净化'],
          },
        },
        {
          id: 'design',
          class: 'profession',
          label: '副职业/设计',
          type: '副职业委托',
          publisher: '设计师协会',
          keywords: ['设计'],
          titles: {
            D: ['基础零件草图', '常规配件制图'],
            C: ['一字斗铠构型设计', '中级模组蓝图'],
            B: ['战术组件总图', '高阶图纸修订'],
            A: ['黄级机甲整机蓝图', '二字斗铠构型设计'],
            S: ['高阶原型机结构预案', '极限构型复核'],
          },
        },
        {
          id: 'manufacture',
          class: 'profession',
          label: '副职业/制造',
          type: '副职业委托',
          publisher: '制造师协会',
          keywords: ['制造'],
          titles: {
            D: ['基础模组装配', '常规药剂器皿组装'],
            C: ['高级模块拼装', '百锻器件封装'],
            B: ['战术组件总装', '稀有订单批量制造'],
            A: ['黄级机甲核心总装', '高危环境专用模块制造'],
            S: ['顶级原型模块试装', '魂锻配套组件封装'],
          },
        },
        {
          id: 'mecha',
          class: 'profession',
          label: '副职业/机甲',
          type: '副职业委托',
          publisher: '机甲师协会',
          keywords: ['机甲'],
          titles: {
            D: ['基础机甲校准', '黄级部件调试'],
            C: ['高阶动力舱调平', '常规机甲战术适配'],
            B: ['紫级模组测试', '黑级外骨架复核'],
            A: ['黄级整机联调', '高阶机甲作战调校'],
            S: ['顶级机甲原型试运转', '魂锻级动力核心联校'],
          },
        },
        {
          id: 'repair',
          class: 'profession',
          label: '副职业/修理',
          type: '副职业委托',
          publisher: '修理师协会',
          keywords: ['修理'],
          titles: {
            D: ['基础维护检修', '常规外甲修复'],
            C: ['中度损伤修复', '高精模块排障'],
            B: ['战地返修委托', '高价值装备复原'],
            A: ['黄级机甲抢修', '灵锻装备损伤修补'],
            S: ['高阶机甲大修', '魂锻部件极限修复'],
          },
        },
      ]);

      const questBoardClampIndex = value =>
        Math.max(0, Math.min(QUEST_BOARD_TIER_ORDER.length - 1, Math.floor(Number(value || 0))));
      const questBoardPickRandom = (list = []) => {
        const pool = Array.isArray(list) ? list.filter(Boolean) : [];
        return pool.length ? pool[Math.floor(Math.random() * pool.length)] : '';
      };
      const questBoardRandomInt = (minValue, maxValue) => {
        const min = Math.floor(Math.min(minValue, maxValue));
        const max = Math.floor(Math.max(minValue, maxValue));
        return min + Math.floor(Math.random() * (max - min + 1));
      };
      const questBoardRollWeighted = (entries = []) => {
        const pool = (Array.isArray(entries) ? entries : []).filter(entry => entry && Number(entry.weight || 0) > 0);
        if (!pool.length) return null;
        const total = pool.reduce((sum, entry) => sum + Number(entry.weight || 0), 0);
        let roll = Math.random() * total;
        for (const entry of pool) {
          roll -= Number(entry.weight || 0);
          if (roll <= 0) return entry.value;
        }
        return pool[pool.length - 1].value;
      };
      const questBoardRoundCoin = value => {
        const numeric = Math.max(0, Number(value || 0));
        if (numeric >= 100000000) return Math.round(numeric / 10000000) * 10000000;
        if (numeric >= 10000000) return Math.round(numeric / 1000000) * 1000000;
        if (numeric >= 1000000) return Math.round(numeric / 100000) * 100000;
        if (numeric >= 100000) return Math.round(numeric / 10000) * 10000;
        if (numeric >= 10000) return Math.round(numeric / 1000) * 1000;
        if (numeric >= 1000) return Math.round(numeric / 100) * 100;
        return Math.round(numeric / 50) * 50;
      };

      function getQuestBoardRegionLabel(char = {}) {
        const raw = String(char?.状态?.位置 || '当前区域')
          .replace(/^斗罗大陆-/, '')
          .replace(/^斗灵大陆-/, '')
          .trim();
        const segments = raw.split('-').filter(Boolean);
        if (segments.length >= 2) return segments.slice(-2).join('-');
        return segments[0] || '当前区域';
      }

      function getQuestBoardJobLevel(char = {}, keywords = []) {
        let result = 0;
        _(char?.副职业 || {}).forEach((jobData, jobName) => {
          const safeName = String(jobName || '').trim();
          if (!safeName) return;
          if (
            (Array.isArray(keywords) ? keywords : []).some(keyword => safeName.includes(String(keyword || '').trim()))
          ) {
            result = Math.max(result, Number(jobData?.等级 || 0));
          }
        });
        return result;
      }

      function getQuestBoardMaxJobLevel(char = {}) {
        let result = 0;
        _(char?.副职业 || {}).forEach(jobData => {
          result = Math.max(result, Number(jobData?.等级 || 0));
        });
        return result;
      }

      function getQuestCombatTierIndex(level = 0) {
        const lv = Number(level || 0);
        if (lv < 20) return 0;
        if (lv < 40) return 1;
        if (lv < 60) return 2;
        if (lv < 80) return 3;
        return 4;
      }

      function getQuestProfessionTierIndex(jobLevel = 0) {
        const lv = Number(jobLevel || 0);
        if (lv < 2) return 0;
        if (lv < 4) return 1;
        if (lv < 6) return 2;
        if (lv < 8) return 3;
        return 4;
      }

      function getQuestMixedTierIndex(combatIndex = 0, jobIndex = 0) {
        return questBoardClampIndex(Math.round(combatIndex * 0.65 + jobIndex * 0.35));
      }

      function rollQuestTierFromBase(baseIndex = 0) {
        const tables = [
          [
            { value: 'D', weight: 84 },
            { value: 'C', weight: 16 },
          ],
          [
            { value: 'D', weight: 45 },
            { value: 'C', weight: 45 },
            { value: 'B', weight: 10 },
          ],
          [
            { value: 'D', weight: 15 },
            { value: 'C', weight: 45 },
            { value: 'B', weight: 30 },
            { value: 'A', weight: 10 },
          ],
          [
            { value: 'C', weight: 10 },
            { value: 'B', weight: 50 },
            { value: 'A', weight: 39 },
            { value: 'S', weight: 1 },
          ],
          [
            { value: 'B', weight: 28 },
            { value: 'A', weight: 70 },
            { value: 'S', weight: 2 },
          ],
        ];
        return questBoardRollWeighted(tables[questBoardClampIndex(baseIndex)] || tables[0]) || 'D';
      }

      function buildQuestBoardReward(tier = 'D', powerFactor = 0.25) {
        const cfg = QUEST_BOARD_TIER_SETTINGS[tier] || QUEST_BOARD_TIER_SETTINGS.D;
        const factor = Math.max(0.05, Math.min(0.95, Number(powerFactor || 0)));
        const coinBias = Math.min(0.95, 0.2 + factor * 0.55 + Math.random() * 0.2);
        const repBias = Math.min(0.95, 0.15 + factor * 0.6 + Math.random() * 0.2);
        const rewardCoin = questBoardRoundCoin(cfg.rewardCoin[0] + (cfg.rewardCoin[1] - cfg.rewardCoin[0]) * coinBias);
        const rewardRep = Math.max(
          cfg.rewardRep[0],
          Math.round(cfg.rewardRep[0] + (cfg.rewardRep[1] - cfg.rewardRep[0]) * repBias),
        );
        return { rewardCoin, rewardRep };
      }

      function buildQuestBoardRequiredCount(tier = 'D', descriptor = {}) {
        const cfg = QUEST_BOARD_TIER_SETTINGS[tier] || QUEST_BOARD_TIER_SETTINGS.D;
        let min = Number(cfg.progress?.[0] || 1);
        let max = Number(cfg.progress?.[1] || 1);
        if (descriptor.id === 'daily') max = Math.max(min, max - 1);
        if (descriptor.id === 'battle' || descriptor.id === 'escort') max += 1;
        if (descriptor.class === 'profession' && tier === 'S') max += 1;
        return questBoardRandomInt(min, max);
      }

      function 构建委托板截止tick(tier = 'D', descriptor = {}, currentTickValue = 0) {
        const 范围 = 委托板时限天数范围[tier] || 委托板时限天数范围.D;
        let 最短天数 = Number(范围[0] || 2);
        let 最长天数 = Number(范围[1] || 最短天数);
        if (descriptor.id === 'daily') {
          最短天数 = 1;
          最长天数 = Math.min(3, 最长天数);
        } else if (descriptor.id === 'escort') {
          最长天数 += 2;
        } else if (descriptor.id === 'battle') {
          最长天数 += 1;
        } else if (descriptor.class === 'profession') {
          最长天数 += 2;
        }
        const 时限天数 = questBoardRandomInt(最短天数, Math.max(最短天数, 最长天数));
        return Math.max(0, Math.floor(Number(currentTickValue || 0) + 时限天数 * 委托板每日tick数));
      }

      function 推断委托板金属阶位(tier = 'D', title = '') {
        const 文本 = String(title || '');
        if (/天锻/.test(文本)) return 5;
        if (/魂锻/.test(文本)) return 4;
        if (/灵锻/.test(文本)) return 3;
        if (/千锻/.test(文本)) return 2;
        if (/百锻/.test(文本)) return 1;
        return { D: 0, C: 1, B: 2, A: 3, S: 4 }[tier] ?? 0;
      }

      function 读取委托板交付品质下限(tier = 'D', 阶位 = 0) {
        const 品质 = { D: '普通', C: '优秀', B: '稀有', A: '史诗', S: '传说' }[tier] || '普通';
        const 阶位品质 = { 1: '优秀', 2: '稀有', 3: '史诗', 4: '史诗', 5: '传说' }[阶位] || 品质;
        return 物品经济品质列表_V1.indexOf(阶位品质) > 0 ? 阶位品质 : '';
      }

      function 构建委托板交付需求(tier = 'D', descriptor = {}, title = '') {
        if (descriptor.id !== 'gathering') return null;
        const 文本 = `${String(title || '')} ${String(QUEST_BOARD_TIER_SETTINGS[tier]?.resourceLabel || '')}`;
        if (/药|草|灵物/.test(文本)) {
          const 名称 = { D: '常规药草', C: '高级药材', B: '稀有药材', A: '高危灵草', S: '极品灵物' }[tier] || '常规药草';
          const 品质下限 = 读取委托板交付品质下限(tier, 0);
          return 品质下限 ? { 类型: '物品', 名称, 数量: 1, 品质下限 } : { 类型: '物品', 名称, 数量: 1 };
        }
        const 金属阶位 = 推断委托板金属阶位(tier, title);
        const 名称 =
          { 0: '基础矿料', 1: '百锻金属块', 2: '千锻金属块', 3: '灵锻金属块', 4: '魂锻金属块', 5: '天锻金属块' }[
            金属阶位
          ] || '基础矿料';
        const 品质下限 = 读取委托板交付品质下限(tier, 金属阶位);
        return 品质下限 ? { 类型: '物品', 名称, 数量: 1, 品质下限 } : { 类型: '物品', 名称, 数量: 1 };
      }

      function buildQuestBoardTitle(descriptor = {}, tier = 'D') {
        const titles = descriptor?.titles?.[tier] ||
          descriptor?.titles?.A ||
          descriptor?.titles?.C ||
          descriptor?.titles?.D || [descriptor?.label || '委托'];
        return questBoardPickRandom(titles) || `${tier}级${descriptor?.label || '委托'}`;
      }

      function buildQuestBoardTextPackage(descriptor = {}, tier = 'D', context = {}) {
        const regionLabel = context.regionLabel || '当前区域';
        const publisher = context.publisher || '系统';
        const resourceLabel = context.resourceLabel || '常规资源';
        const progressCount = Math.max(1, Number(context.progressCount || 1));
        switch (descriptor.id) {
          case 'daily':
            return {
              publicDesc: `委托板仅公开：${regionLabel}附近挂出一份${tier}级日常杂务，可能涉及代送、寻物或代办，接取后才会告知具体对象与交付路线。`,
              hiddenDesc: `在${regionLabel}范围内完成一份低风险日常事务：按委托人要求处理代送、寻物或回执核对，预计需要 ${progressCount} 个阶段。该委托仅服务地方日常运转，不涉及任何主线命运节点。`,
            };
          case 'investigation':
            return {
              publicDesc: `${publisher}仅公开：需要一名外勤核查${regionLabel}周边异常情报，接取后才会发放目标坐标与比对要求。`,
              hiddenDesc: `前往${regionLabel}周边核查一条独立的异常线索，完成现场记录、对象确认与结果回传，预计需要 ${progressCount} 个阶段。该委托仅影响地方侧线调查，不涉及主线人物与命运锚点。`,
            };
          case 'gathering':
            return {
              publicDesc: `委托板仅公开：有人悬赏与【${resourceLabel}】相关的采集/寻物事务，详情需在接取后确认。`,
              hiddenDesc: `在${regionLabel}附近采集或回收与【${resourceLabel}】匹配的指定材料，并完成交割与验收，预计需要 ${progressCount} 个阶段。任务目标为独立资源补给，不涉及主线推进。`,
            };
          case 'escort':
            return {
              publicDesc: `${publisher}仅公开：需要护送一批达到【${resourceLabel}】级别的物资，接取后才会告知路线与交接人。`,
              hiddenDesc: `护送一批与【${resourceLabel}】匹配的货物穿过${regionLabel}周边节点并完成签收，途中可能遭遇独立支线冲突，预计需要 ${progressCount} 个阶段，但不会触碰主线流程。`,
            };
          case 'battle':
            return tier === 'S'
              ? {
                  publicDesc: `${publisher}仅公开：${regionLabel}附近出现需要处理的独立高危目标，悬赏面向公开魂师，具体战区与对手信息需接取后披露。`,
                  hiddenDesc: `处理一处完全独立于主线的高危战斗委托，对象为${regionLabel}外缘活动的王级/统领级侧线目标或黑市武装首脑。预计需要 ${progressCount} 个阶段，结算后仅影响地方安保与资源流向，不影响主线命运锚点。`,
                }
              : {
                  publicDesc: `${publisher}仅公开：${regionLabel}附近出现需要处理的危险目标，悬赏面向公开魂师。`,
                  hiddenDesc: `在${regionLabel}附近清理独立危险目标或小股敌对势力，并回收可证明战果的凭证，预计需要 ${progressCount} 个阶段。该委托仅影响地方治安与支线资源。`,
                };
          case 'forging':
            return {
              publicDesc: `锻造师协会仅公开：有一份${tier}级代工框架，需要具备相应锻造基础的承接者，接取后才会披露具体部件参数。`,
              hiddenDesc: `为委托方处理一件与【${resourceLabel}】匹配的锻造代工/回火/成型任务，重点考验锻造火候与材料处理，预计需要 ${progressCount} 个阶段。该订单属于独立工坊委托，不涉及主线剧情。`,
            };
          case 'design':
            return {
              publicDesc: `设计师协会仅公开：有一份${tier}级蓝图设计框架待承接，接取后才会下发详细结构约束。`,
              hiddenDesc: `为委托方完成一份与【${resourceLabel}】相关的构型设计/图纸修订任务，预计需要 ${progressCount} 个阶段。该订单属于独立设计委托，不涉及主线流程。`,
            };
          case 'manufacture':
            return {
              publicDesc: `制造师协会仅公开：有一份${tier}级组装/封装框架待承接，接取后才会告知模块清单。`,
              hiddenDesc: `为委托方完成一批与【${resourceLabel}】相关的制造/总装任务，需要处理装配、校验与交付，预计需要 ${progressCount} 个阶段。该委托为独立产线订单，不影响主线剧情。`,
            };
          case 'mecha':
            return {
              publicDesc: `机甲师协会仅公开：有一份${tier}级机甲调校框架，需要具备对应基础的承接者，接取后才会发放整机参数。`,
              hiddenDesc: `对一台与【${resourceLabel}】相匹配的机甲或动力模块进行调校、联动或测试，预计需要 ${progressCount} 个阶段。该任务属于独立技术订单，不影响主线命运节点。`,
            };
          case 'repair':
            return {
              publicDesc: `修理师协会仅公开：有一份${tier}级维护/修复框架待承接，接取后才会披露受损部件清单。`,
              hiddenDesc: `为委托方处理一件与【${resourceLabel}】相关的维护、排障或修复任务，预计需要 ${progressCount} 个阶段。该委托属于独立售后/战地返修订单，不涉及主线推进。`,
            };
          default:
            return {
              publicDesc: `${publisher}挂出了一份${tier}级公开委托框架，接取后才会披露完整目标。`,
              hiddenDesc: `完成一份与【${resourceLabel}】相关的独立支线委托，预计需要 ${progressCount} 个阶段，不涉及主线剧情节点。`,
            };
        }
      }

      function pickQuestBoardDescriptor(playerChar = {}) {
        const combatTierIndex = getQuestCombatTierIndex(Number(playerChar?.属性?.等级 || 0));
        const maxJobLevel = getQuestBoardMaxJobLevel(playerChar);
        const descriptors = [
          { descriptor: QUEST_BOARD_GENERAL_DESCRIPTORS[0], weight: 24 },
          { descriptor: QUEST_BOARD_GENERAL_DESCRIPTORS[1], weight: 14 + combatTierIndex * 3 },
          { descriptor: QUEST_BOARD_GENERAL_DESCRIPTORS[2], weight: 14 + Math.max(0, Math.floor(maxJobLevel * 1.5)) },
          { descriptor: QUEST_BOARD_GENERAL_DESCRIPTORS[3], weight: 10 + combatTierIndex * 3 },
          { descriptor: QUEST_BOARD_GENERAL_DESCRIPTORS[4], weight: 8 + combatTierIndex * 8 },
        ];
        QUEST_BOARD_PROFESSION_DESCRIPTORS.forEach(descriptor => {
          const jobLevel = getQuestBoardJobLevel(playerChar, descriptor.keywords || []);
          if (jobLevel > 0) {
            descriptors.push({ descriptor: { ...descriptor, _jobLevel: jobLevel }, weight: 4 + jobLevel * 5 });
          }
        });
        return (
          questBoardRollWeighted(descriptors.map(item => ({ value: item.descriptor, weight: item.weight }))) ||
          QUEST_BOARD_GENERAL_DESCRIPTORS[0]
        );
      }

      function resolveQuestBoardBaseTierIndex(playerChar = {}, descriptor = {}) {
        const combatTierIndex = getQuestCombatTierIndex(Number(playerChar?.属性?.等级 || 0));
        const maxJobTierIndex = getQuestProfessionTierIndex(getQuestBoardMaxJobLevel(playerChar));
        if (descriptor.class === 'profession') {
          return questBoardClampIndex(
            Math.round(getQuestProfessionTierIndex(Number(descriptor._jobLevel || 0)) * 0.75 + combatTierIndex * 0.25),
          );
        }
        if (descriptor.id === 'daily')
          return questBoardClampIndex(Math.max(0, Math.round(combatTierIndex * 0.65 + maxJobTierIndex * 0.2) - 1));
        if (descriptor.id === 'battle') return combatTierIndex;
        if (descriptor.id === 'escort')
          return questBoardClampIndex(Math.round(combatTierIndex * 0.7 + maxJobTierIndex * 0.3));
        return getQuestMixedTierIndex(combatTierIndex, maxJobTierIndex);
      }

      function buildQuestBoardFrame(playerChar = {}, currentTickValue = 0) {
        const descriptor = pickQuestBoardDescriptor(playerChar);
        if (!descriptor) return null;
        const baseTierIndex = resolveQuestBoardBaseTierIndex(playerChar, descriptor);
        let tier = rollQuestTierFromBase(baseTierIndex);
        let tierIndex = questBoardClampIndex(QUEST_BOARD_TIER_ORDER.indexOf(tier));
        const maxTierIndex = Number.isFinite(Number(descriptor.maxTierIndex))
          ? questBoardClampIndex(descriptor.maxTierIndex)
          : QUEST_BOARD_TIER_ORDER.length - 1;
        if (tierIndex > maxTierIndex) tierIndex = maxTierIndex;
        tier = QUEST_BOARD_TIER_ORDER[tierIndex] || tier;
        const regionLabel = getQuestBoardRegionLabel(playerChar);
        const publisher = descriptor.publisher || questBoardPickRandom(descriptor.publishers || ['系统']) || '系统';
        const resourceLabel = QUEST_BOARD_TIER_SETTINGS[tier]?.resourceLabel || '常规资源';
        const progressCount = buildQuestBoardRequiredCount(tier, descriptor);
        const playerLevel = Number(playerChar?.属性?.等级 || 0);
        const relevantJobLevel =
          descriptor.class === 'profession' ? Number(descriptor._jobLevel || 0) : getQuestBoardMaxJobLevel(playerChar);
        const powerFactor = Math.min(
          1,
          Math.max(
            0.05,
            (playerLevel / 100) * 0.7 + (relevantJobLevel / 10) * (descriptor.class === 'profession' ? 0.3 : 0.2),
          ),
        );
        const reward = buildQuestBoardReward(tier, powerFactor);
        const title = buildQuestBoardTitle(descriptor, tier);
        const 截止tick = 构建委托板截止tick(tier, descriptor, currentTickValue);
        const 交付需求 = 构建委托板交付需求(tier, descriptor, title);
        const textPackage = buildQuestBoardTextPackage(descriptor, tier, {
          regionLabel,
          publisher,
          resourceLabel,
          progressCount,
          currentTickValue,
        });
        return {
          tier,
          title,
          descriptor,
          publisher,
          resourceLabel,
          progressCount,
          rewardCoin: reward.rewardCoin,
          rewardRep: reward.rewardRep,
          publicDesc: textPackage.publicDesc,
          hiddenDesc: textPackage.hiddenDesc,
          截止tick,
          交付需求,
        };
      }

      refreshQuestBoardFrames = function refreshQuestBoardFrames(dataRef, currentTickValue = 0) {
        if (!dataRef?.world) return;
        if (!dataRef.world.委托板 || typeof dataRef.world.委托板 !== 'object') dataRef.world.委托板 = {};
        const board = dataRef.world.委托板;

        Object.keys(board).forEach(questId => {
          const entry = board[questId];
          if (!entry || typeof entry !== 'object') {
            delete board[questId];
            return;
          }
          const generatedTick = Number(entry.生成tick || 0);
          if (generatedTick <= 0) return;
          const age = Math.max(0, Number(currentTickValue || 0) - generatedTick);
          const 状态 = String(entry.状态 || '待接取');
          if (状态 === '待接取' && age >= QUEST_BOARD_PENDING_STALE_TICKS) delete board[questId];
          else if ((状态 === '已完成' || 状态 === '已放弃') && age >= QUEST_BOARD_ARCHIVE_STALE_TICKS)
            delete board[questId];
        });

        const pendingEntries = Object.entries(board).filter(
          ([, entry]) => String(entry?.状态 || '待接取') === '待接取',
        );
        if (pendingEntries.length >= QUEST_BOARD_PENDING_LIMIT) return;

        const playerName = String(dataRef?.sys?.玩家名 || '').trim();
        const playerChar = playerName ? dataRef?.char?.[playerName] : null;
        if (!playerChar) return;

        const combatTierIndex = getQuestCombatTierIndex(Number(playerChar?.属性?.等级 || 0));
        const maxJobLevel = getQuestBoardMaxJobLevel(playerChar);
        const spawnChance = Math.min(
          82,
          35 + Math.max(0, 5 - pendingEntries.length) * 5 + combatTierIndex * 4 + Math.floor(maxJobLevel * 1.5),
        );
        const roll = questBoardRandomInt(1, 100);
        if (roll > spawnChance) return;

        const frame = buildQuestBoardFrame(playerChar, currentTickValue);
        if (!frame) return;

        let questIdBase = `${frame.tier}级委托·${frame.title}`;
        let questId = questIdBase;
        let suffix = 2;
        while (board[questId]) {
          questId = `${questIdBase}#${suffix}`;
          suffix += 1;
        }

        board[questId] = {
          标题: frame.title,
          描述: frame.hiddenDesc || '无',
          框架描述: frame.publicDesc || '无',
          发布者: frame.publisher || '系统',
          面向: '公开',
          指定对象: '无',
          状态: '待接取',
          难度: `${frame.tier}级`,
          资源级别: frame.resourceLabel || '无',
          奖励币: frame.rewardCoin,
          奖励声望: frame.rewardRep,
          承接者: '无',
          生成tick: Number(currentTickValue || 0),
        };
        if (Number(frame.截止tick || 0) > 0) board[questId].截止tick = Number(frame.截止tick || 0);
        if (frame.交付需求) board[questId].交付需求 = cloneJsonValue(frame.交付需求, {});

        if (!dataRef.sys?.系统播报 || dataRef.sys.系统播报 === '初始化') {
          追加系统播报文本(
            dataRef,
            `[社会动态] ${frame.publisher} 挂出了一份${frame.tier}级【${frame.descriptor?.label || '公开'}】委托框架：${frame.title}。`,
          );
        }
      };

      if (typeof obj !== 'object' || obj === null) return obj;
      return Object.keys(obj).reduce((acc, key) => {
        acc[key.toLowerCase()] = obj[key];
        return acc;
      }, {});
    };

    const 自动生成魂灵最低年限_V1 = 10;
    const 初始化独立魂环吸收极限表_V1 = Object.freeze([423, 764, 1760, 5000, 12000, 20000, 50000, 100000, 200000]);

    function 读取初始化独立魂环吸收极限_V1(魂环位 = 1) {
      const 序号 = Math.max(1, Math.floor(Number(魂环位 || 1)));
      const 上限 = 初始化独立魂环吸收极限表_V1[序号 - 1];
      return Number.isFinite(Number(上限)) ? Math.max(自动生成魂灵最低年限_V1, Math.floor(Number(上限))) : Number.POSITIVE_INFINITY;
    }

    function 估算初始化魂环承载体力上限_V1(角色数据 = {}) {
      if (!角色数据 || typeof 角色数据 !== 'object' || Array.isArray(角色数据)) return 0;
      const 属性 = 角色数据.属性 && typeof 角色数据.属性 === 'object' ? 角色数据.属性 : {};
      const 等级 = Math.max(1, Number(属性.等级 || 1) || 1);
      const 基础属性 = getBaseStats(等级);
      let 系别倍率 = 0;
      const 武魂条目 = 取角色武魂条目_V1(角色数据);
      if (武魂条目.length > 0) {
        武魂条目.forEach(([, 武魂]) => {
          const 倍率 = TypeMultipliers[武魂?.系别] || TypeMultipliers['强攻系'];
          系别倍率 = Math.max(系别倍率, Number(倍率?.vit_max || 1));
        });
      } else {
        const 倍率 = TypeMultipliers[取角色主武魂系别_V1(角色数据)] || TypeMultipliers['强攻系'];
        系别倍率 = Number(倍率?.vit_max || 1);
      }
      const 底子波动 = Math.max(0.1, Number(属性.底子波动 || 1));
      let 体力上限 =
        Math.floor(Number(基础属性.vit_max || 0) * Math.max(0.1, 系别倍率 || 1) * 底子波动) +
        Math.max(0, Math.floor(Number(属性.训练加成?.体力上限 || 0)));
      const 血脉名 = String(角色数据?.血脉之力?.血脉 || '').trim();
      if (血脉名.includes('金龙王')) {
        const 解封层数 = Math.max(0, Math.floor(Number(角色数据?.血脉之力?.解封层数 || 0)));
        const 倍率 = 解封层数 <= 0 ? 1.5 : 2 + 解封层数;
        if (体力上限 * 倍率 <= 100000) 体力上限 = Math.floor(体力上限 * 倍率);
        else if (体力上限 * 5 <= 200000) 体力上限 = Math.max(100000, Math.floor(体力上限 * 5));
        else 体力上限 = Math.max(200000, Math.floor(体力上限 * 2));
      } else if (血脉名.includes('银龙王')) {
        体力上限 += Math.min(体力上限, 20000);
      }
      if (角色数据.社交?.势力?.['本体宗']) 体力上限 += Math.min(体力上限 * 2, 40000);
      _(角色数据.魂骨).forEach((魂骨, 部位) => {
        if (!魂骨 || typeof 魂骨 !== 'object') return;
        if (是外附魂骨记录_V1(魂骨, 部位)) {
          const 倍率 = 按品质派生外附魂骨属性倍率_V1(魂骨?.品质);
          体力上限 += Math.floor(体力上限 * Math.max(0, Number(倍率?.体力上限 || 0)));
          return;
        }
        体力上限 += getRingBonus(Number(魂骨.年限 || 0)).vit_max;
      });
      取角色武魂条目_V1(角色数据).forEach(([, 武魂]) => {
        取武魂全部魂环条目_V1(武魂).forEach(({ 魂环数据: 魂环, 魂灵数据: 魂灵 }) => {
          const 年限 = Math.max(0, Number(魂环?.年限 || 0));
          if (!(年限 > 0)) return;
          const 契合倍率 = 魂灵 ? Math.max(0.1, Number(魂灵.契合度 !== undefined ? 魂灵.契合度 : 100) / 100) : 1;
          体力上限 += Math.floor(getRingBonus(年限).vit_max * 契合倍率);
        });
      });
      return Math.max(Math.floor(Number(属性.体力上限 || 0)), Math.floor(体力上限));
    }

    function 读取精神力动态魂环吸收上限_V1(精神力上限 = 0) {
      const 精神 = Math.max(0, Math.floor(Number(精神力上限 || 0)));
      if (精神 < 500) return 9999;
      if (精神 < 5000) return 10000 + Math.floor(((精神 - 500) / 4500) * 90000);
      if (精神 < 15000) return 100000 + Math.floor(((精神 - 5000) / 10000) * 100000);
      if (精神 < 20000) return 200000 + Math.floor(((精神 - 15000) / 5000) * 300000);
      if (精神 < 50000) return 500000 + Math.floor(((精神 - 20000) / 30000) * 499999);
      return 999999;
    }

    function 读取初始化动态魂环吸收极限_V1(魂环位 = 1, 角色数据 = {}, 目标年限 = 0) {
      const 安全魂环位 = Math.max(1, Math.min(9, Math.floor(Number(魂环位 || 1))));
      const 基准上限 = 读取初始化独立魂环吸收极限_V1(安全魂环位);
      const 基准等级 = Math.max(1, Math.min(99, 安全魂环位 * 10 + 1));
      const 基准属性 = getBaseStats(基准等级);
      const 基准体力 = Math.max(1, Math.floor(Number(基准属性?.vit_max || 1) * Number(TypeMultipliers['强攻系']?.vit_max || 1)));
      const 当前体力 = Math.max(1, 估算初始化魂环承载体力上限_V1(角色数据));
      const 体力倍率 = Math.max(0.25, Math.min(8, 当前体力 / 基准体力));
      const 体力上限 = Math.max(自动生成魂灵最低年限_V1, Math.floor(基准上限 * Math.pow(体力倍率, 1.15)));
      if (Math.max(体力上限, Number(目标年限 || 0)) < 10000) return 体力上限;
      return Math.max(
        自动生成魂灵最低年限_V1,
        Math.min(体力上限, 读取精神力动态魂环吸收上限_V1(估算初始化魂灵预算精神力上限_V1(角色数据))),
      );
    }

    function 读取初始化魂灵承载年限上限_V1(魂环位列表 = [], 角色数据 = {}) {
      const 有效魂环位 = (Array.isArray(魂环位列表) ? 魂环位列表 : [])
        .map(魂环位 => Math.max(1, Math.min(9, Math.floor(Number(魂环位 || 1)))))
        .filter(Boolean);
      if (!有效魂环位.length) return 自动生成魂灵最低年限_V1;
      return 读取初始化动态魂环吸收极限_V1(Math.max(...有效魂环位), 角色数据);
    }

    function 收口自动生成魂灵单项年限_V1(年限 = 自动生成魂灵最低年限_V1, 魂灵序号 = 0, 上下文 = {}) {
      const 上限 = Number.isFinite(Number(上下文?.年限上限)) ? Math.max(自动生成魂灵最低年限_V1, Math.floor(Number(上下文.年限上限))) : Number.POSITIVE_INFINITY;
      const 安全年限 = Math.max(自动生成魂灵最低年限_V1, Math.floor(Number(年限 || 自动生成魂灵最低年限_V1)));
      return Number.isFinite(上限) ? Math.min(安全年限, 上限) : 安全年限;
    }

    function 收口自动生成魂灵计划年限_V1(魂灵计划 = [], 上下文 = {}) {
      const 计划 = (Array.isArray(魂灵计划) ? 魂灵计划 : [])
        .filter(规划项 => 规划项 && 规划项.spData && typeof 规划项.spData === 'object')
        .sort((a, b) => Math.max(0, Number(a.魂灵序号 || 0)) - Math.max(0, Number(b.魂灵序号 || 0)));
      if (!计划.length) return;
      计划.forEach(规划项 => {
        const 魂灵序号 = Math.max(0, Math.floor(Number(规划项.魂灵序号 || 0)));
        const 年限上限 = Number.isFinite(Number(规划项.年限上限)) ? 规划项.年限上限 : 上下文?.年限上限;
        规划项.spData.age = 收口自动生成魂灵单项年限_V1(规划项.spData.age, 魂灵序号, { ...上下文, 年限上限 });
      });
      计划.forEach(规划项 => {
        规划项.spData.age = Math.max(自动生成魂灵最低年限_V1, Math.floor(Number(规划项.spData.age || 自动生成魂灵最低年限_V1)));
        规划项.spData.color = getRingColorByAge(规划项.spData.age);
      });
    }

    function rollSpirit(talentTier, lv, spiritIndex, realm, previousAge = null) {
      const 生成一次 = () => {
        const roll = Math.floor(Math.random() * 100) + 1;
        const talentScore = { 绝世妖孽: 100, 顶级天才: 80, 天才: 60, 优秀: 40, 正常: 20, 劣等: 0, 天赋极差: -100 }[talentTier] || 20;
        const sequenceScore = [0, 40, 90, 150, 220, 300, 400, 500, 600][spiritIndex] || spiritIndex * 80;
        let extraLvScore = lv > 95 ? Math.floor(lv - 95) * 50 : 0;
        const totalScore = roll + talentScore + lv * 2 + sequenceScore + extraLvScore;
        let age = 自动生成魂灵最低年限_V1,
          cap = 1;
        if (totalScore >= 600) {
          age = 100000 + (totalScore - 600) * 1000 + Math.floor(Math.random() * 5000);
          cap = 4;
        } else if (totalScore >= 300) {
          age = 10000 + (totalScore - 300) * 200 + Math.floor(Math.random() * 2000);
          cap = 4;
        } else if (totalScore >= 240) {
          age = 1000 + (totalScore - 240) * 100 + Math.floor(Math.random() * 500);
          cap = 3;
        } else if (totalScore >= 140) {
          age = 100 + Math.floor((totalScore - 140) * 9) + Math.floor(Math.random() * 10);
          cap = 2;
        } else {
          age = 10 + Math.floor(Math.max(0, totalScore) / 140 * 80) + Math.floor(Math.random() * 10);
          age = Math.min(99, age);
        }

        const realmCaps = { 灵元境: 400, 灵通境: 3000, 灵海境: 15000, 灵渊境: 100000, 灵域境: 999999, 神元境: 999999 };
        let maxAge = realmCaps[realm] || 400;
        if (age > maxAge) {
          if (maxAge >= 100000) {
            age = 100000;
            cap = 3;
          } else if (maxAge >= 15000) {
            age = 15000;
            cap = 4;
          } else if (maxAge >= 3000) {
            age = 3000;
            cap = 3;
          } else if (maxAge >= 400) {
            age = 400;
            cap = 2;
          } else {
            age = 自动生成魂灵最低年限_V1;
            cap = 1;
          }
        }

        const highTalent = ['绝世妖孽', '顶级天才', '天才'].includes(String(talentTier || ''));
        const shouldApplyFirstSpiritLowLevelCap = spiritIndex === 0 && lv < 30;
        if (spiritIndex === 0) {
          if (shouldApplyFirstSpiritLowLevelCap && highTalent) {
            const firstSpiritScore = Math.max(0, totalScore - 80);
            age = 100 + Math.min(300, Math.floor(firstSpiritScore * 2) + Math.floor(Math.random() * 21));
            age = Math.min(400, age);
            cap = age >= 100 ? 2 : 1;
          } else if (shouldApplyFirstSpiritLowLevelCap) {
            age = Math.min(100, Math.max(自动生成魂灵最低年限_V1, age));
            cap = age >= 100 ? 2 : 1;
          }
          if (cap > 2) cap = 2;
        } else if (spiritIndex <= 1 && cap > 2) {
          cap = 2;
        }
        age = Math.max(自动生成魂灵最低年限_V1, Math.floor(age));
        const color = getRingColorByAge(age);
        const initProvideCap = cap;
        return { age, color, cap, initProvideCap };
      };
      let 结果 = 生成一次();
      const 前置年限 = Math.max(0, Math.floor(Number(previousAge || 0)));
      if (spiritIndex > 0 && 前置年限 >= 自动生成魂灵最低年限_V1 && 结果.age <= 前置年限) {
        for (let 次数 = 0; 次数 < 3; 次数++) {
          const 候选 = 生成一次();
          if (候选.age > 结果.age) 结果 = 候选;
          if (候选.age > 前置年限) {
            结果 = 候选;
            break;
          }
        }
      }
      return 结果;
    }

    const 初始化九十九级魂环目标年限_V1 = Object.freeze([82000, 86000, 91000, 96000, 102000, 108000, 115000, 124000, 138000]);
    const 初始化九十八级魂环目标年限_V1 = Object.freeze([36000, 40000, 46000, 52000, 60000, 69000, 80000, 92000, 106000]);

    function 读取初始化魂环年限上限_V1(精神境界 = '') {
      const 境界 = String(精神境界 || '').trim();
      if (境界 === '神元境') return 999999;
      if (境界 === '灵域境') return 999999;
      if (境界 === '灵渊境') return 100000;
      if (境界 === '灵海境') return 15000;
      if (境界 === '灵通境') return 3000;
      if (境界 === '灵元境') return 400;
      return 400;
    }

    function 扰动初始化魂环年限_V1(年限 = 0, 上限 = 999999, 选项 = {}) {
      const 原始年限 = Math.max(自动生成魂灵最低年限_V1, Math.floor(Number(年限 || 0)));
      const 安全上限 = Math.max(自动生成魂灵最低年限_V1, Math.floor(Number(上限 || 自动生成魂灵最低年限_V1)));
      const 扰动幅度 = 原始年限 >= 100000 ? 3600 : 原始年限 >= 10000 ? 2600 : 原始年限 >= 1000 ? 360 : 45;
      let 结果 = 原始年限 + Math.floor((Math.random() * 2 - 1) * 扰动幅度) + Math.floor(Math.random() * 97);
      结果 = Math.max(自动生成魂灵最低年限_V1, Math.min(安全上限, Math.floor(结果)));
      if (选项?.禁止常规橙环 && 结果 >= 200000) 结果 = 199000 - Math.floor(Math.random() * 700);
      if (结果 % 100 === 0 || 结果 % 1000 <= 8 || 结果 % 10000 <= 12) {
        结果 += 17 + Math.floor(Math.random() * 77);
      }
      if (选项?.禁止常规橙环 && 结果 >= 200000) 结果 = 199000 - Math.floor(Math.random() * 700);
      return Math.max(自动生成魂灵最低年限_V1, Math.min(安全上限, Math.floor(结果)));
    }

    function 计算初始化魂环位目标年限_V1(魂环位 = 1, 等级 = 1, 天赋梯队 = '正常', 精神境界 = '', 是否独立魂环 = false, 角色数据 = {}) {
      const 安全魂环位 = Math.max(1, Math.min(9, Math.floor(Number(魂环位 || 1))));
      const 等级值 = Math.max(1, Number(等级 || 1));
      if (等级值 < 98) return null;
      const 进度 = Math.max(0, Math.min(1, (等级值 - 98) / 1));
      const 九十八级目标 = 初始化九十八级魂环目标年限_V1[安全魂环位 - 1] || 初始化九十八级魂环目标年限_V1[0];
      const 九十九级目标 = 初始化九十九级魂环目标年限_V1[安全魂环位 - 1] || 初始化九十九级魂环目标年限_V1[0];
      const 天赋倍率表 = { 绝世妖孽: 1.06, 顶级天才: 1, 天才: 0.94, 优秀: 0.88, 正常: 0.82, 劣等: 0.74, 天赋极差: 0.62 };
      const 天赋倍率 = 天赋倍率表[String(天赋梯队 || '').trim()] || 0.82;
      const 独立倍率 = 是否独立魂环 && 安全魂环位 >= 8 ? 1.035 : 1;
      const 上限 = 读取初始化魂环年限上限_V1(精神境界);
      let 目标 = (九十八级目标 + (九十九级目标 - 九十八级目标) * 进度) * 天赋倍率 * 独立倍率;
      const 可出橙 =
        上限 >= 200000 &&
        是否独立魂环 &&
        安全魂环位 >= 9 &&
        ['绝世妖孽', '顶级天才'].includes(String(天赋梯队 || '').trim()) &&
        等级值 >= 99 &&
        Math.random() < (String(天赋梯队 || '').trim() === '绝世妖孽' ? 0.025 : 0.012);
      const 年限上限 = Math.min(可出橙 ? 上限 : Math.min(上限, 199000), 是否独立魂环 ? 读取初始化动态魂环吸收极限_V1(安全魂环位, 角色数据, 目标) : Number.POSITIVE_INFINITY);
      return 扰动初始化魂环年限_V1(目标, 年限上限, { 禁止常规橙环: !可出橙 });
    }

    function 计算初始化承载魂灵年限_V1(魂环位列表 = [], 等级 = 1, 天赋梯队 = '正常', 精神境界 = '', 角色数据 = {}) {
      const 有效魂环位 = (Array.isArray(魂环位列表) ? 魂环位列表 : [])
        .map(魂环位 => Math.max(1, Math.floor(Number(魂环位 || 1))))
        .filter(Boolean);
      if (!有效魂环位.length) return null;
      const 年限列表 = 有效魂环位
        .map(魂环位 => 计算初始化魂环位目标年限_V1(魂环位, 等级, 天赋梯队, 精神境界, false, 角色数据))
        .filter(年限 => Number.isFinite(Number(年限)));
      if (!年限列表.length) return null;
      const 最高魂环位上限 = 读取初始化魂灵承载年限上限_V1(有效魂环位, 角色数据);
      return Math.max(
        自动生成魂灵最低年限_V1,
        Math.min(最高魂环位上限, Math.floor(年限列表.reduce((总和, 年限) => 总和 + 年限, 0) / 年限列表.length)),
      );
    }

    function 规划初始化魂环承载结构_V1(
      魂环总数 = 0,
      等级 = 1,
      天赋梯队 = '正常',
      精神境界 = '',
      可用魂灵位 = 0,
      武魂槽位 = '第1武魂',
      起始魂灵序号 = 0,
    ) {
      const 总数 = Math.max(0, Math.min(9, Math.floor(Number(魂环总数 || 0))));
      const 等级值 = Math.max(1, Number(等级 || 1));
      const 高阶 = 等级值 >= 98 && ['灵域境', '神元境'].includes(String(精神境界 || '').trim());
      const 独立魂环位集合 = new Set();
      if (高阶 && 总数 >= 9 && 可用魂灵位 >= 3) {
        const 天赋 = String(天赋梯队 || '').trim();
        const 第九概率 = 天赋 === '绝世妖孽' ? 0.68 : 天赋 === '顶级天才' ? 0.56 : 天赋 === '天才' ? 0.42 : 0.24;
        const 第八概率 = 天赋 === '绝世妖孽' ? 0.36 : 天赋 === '顶级天才' ? 0.26 : 天赋 === '天才' ? 0.16 : 0.08;
        if (Math.random() < 第九概率) 独立魂环位集合.add(9);
        if (Math.random() < 第八概率) 独立魂环位集合.add(8);
      }
      const 承载魂环位列表 = [];
      for (let 魂环位 = 1; 魂环位 <= 总数; 魂环位++) {
        if (!独立魂环位集合.has(魂环位)) 承载魂环位列表.push(魂环位);
      }
      const 规划 = [];
      let 指针 = 0;
      let 魂灵序号 = 0;
      while (指针 < 承载魂环位列表.length && 魂灵序号 < 可用魂灵位) {
        const 实际魂灵序号 = Math.max(0, Math.floor(Number(起始魂灵序号 || 0))) + 魂灵序号;
        const 容量 = 读取初始化魂灵序位承载上限_V1(武魂槽位, 实际魂灵序号);
        const 魂环位列表 = 承载魂环位列表.slice(指针, 指针 + 容量).sort((a, b) => a - b);
        if (!魂环位列表.length) break;
        规划.push({ 类型: '魂灵', 魂灵序号: 实际魂灵序号, 魂环位列表 });
        指针 += 魂环位列表.length;
        魂灵序号++;
      }
      Array.from(独立魂环位集合)
        .sort((a, b) => a - b)
        .forEach(魂环位 => 规划.push({ 类型: '独立魂环', 魂环位 }));
      return 规划.sort((a, b) => (a.魂环位列表?.[0] || a.魂环位 || 0) - (b.魂环位列表?.[0] || b.魂环位 || 0));
    }

    function 读取初始化武魂目标魂环数_V1(武魂槽位 = '第1武魂', 等级 = 1, 是否魂兽 = false) {
      if (是否魂兽) return 0;
      const 等级值 = Math.max(1, Number(等级 || 1));
      if (武魂槽位 === '第2武魂') {
        if (等级值 < 70) return 0;
        if (等级值 < 75) return 1;
        if (等级值 < 80) return 3;
        if (等级值 < 85) return 5;
        if (等级值 < 90) return 7;
        return 9;
      }
      return Math.max(0, Math.min(9, Math.floor(等级值 / 10)));
    }

    function 读取武魂已有魂环位集合_V1(武魂数据 = {}) {
      const 魂环位集合 = new Set();
      取武魂全部魂环条目_V1(武魂数据).forEach(魂环条目 => {
        const 魂环位 = 读取槽位序号_V1(魂环条目?.魂环键, 0);
        if (魂环位 > 0) 魂环位集合.add(魂环位);
      });
      return 魂环位集合;
    }

    function 读取魂灵初始化承载上限_V1(魂灵数据 = {}) {
      const 年限 = Math.max(0, Math.floor(Number(typeof 魂灵数据 === 'number' ? 魂灵数据 : 魂灵数据?.年限 || 0)));
      if (年限 >= 10000) return 4;
      if (年限 >= 1000) return 3;
      if (年限 >= 100) return 2;
      if (年限 >= 自动生成魂灵最低年限_V1) return 1;
      return 0;
    }

    function 读取初始化魂灵序位承载上限_V1(武魂槽位 = '第1武魂', 魂灵序号 = 0) {
      if (String(武魂槽位 || '').trim() === '第2武魂') return 4;
      return Math.max(0, Math.floor(Number(魂灵序号 || 0))) <= 1 ? 2 : 4;
    }

    function 读取魂灵自动初始化承载上限_V1(魂灵数据 = {}, 武魂槽位 = '第1武魂', 魂灵序号 = 0) {
      return Math.min(
        读取魂灵初始化承载上限_V1(魂灵数据),
        读取初始化魂灵序位承载上限_V1(武魂槽位, 魂灵序号),
      );
    }

    function 读取承载魂环数最低年限_V1(魂环数量 = 1) {
      const 数量 = Math.max(1, Math.floor(Number(魂环数量 || 1)));
      if (数量 >= 4) return 10000;
      if (数量 >= 3) return 1000;
      if (数量 >= 2) return 100;
      return 自动生成魂灵最低年限_V1;
    }

    function 读取下一个魂灵槽位名_V1(武魂数据 = {}) {
      let 序号 = 1;
      while (武魂数据 && Object.prototype.hasOwnProperty.call(武魂数据, `第${序号}魂灵`)) 序号++;
      return `第${序号}魂灵`;
    }

    function 构建初始化魂灵数据_V1(char = {}, spData = {}, 魂灵序号 = 0) {
      const 年限 = Math.max(自动生成魂灵最低年限_V1, Math.floor(Number(spData?.age || 自动生成魂灵最低年限_V1)));
      const 天赋补正 =
        { 绝世妖孽: 30, 顶级天才: 20, 天才: 10, 优秀: 0, 正常: -10, 劣等: -20, 天赋极差: -40 }[char?.属性?.天赋梯队] || 0;
      const 序号补正 = Math.max(0, Math.floor(Number(魂灵序号 || 0))) * 5;
      const 契合度 = Math.min(100, Math.max(0, 60 + 天赋补正 + 序号补正));
      return {
        表象名称: AI_TODO_SOUL_SPIRIT_NAME,
        描述: buildSoulSpiritDescriptionTodoText({
          表象名称: AI_TODO_SOUL_SPIRIT_NAME,
          年限,
          品质: AI_TODO_SOUL_SPIRIT_QUALITY,
          状态: '活跃',
        }),
        年限,
        品质: AI_TODO_SOUL_SPIRIT_QUALITY,
        契合度,
        状态: '活跃',
      };
    }

    function 同步初始化魂灵年限到魂环_V1(魂灵数据 = {}, 年限 = 0, 强制同步 = false) {
      if (!魂灵数据 || typeof 魂灵数据 !== 'object') return;
      const 安全年限 = Math.max(自动生成魂灵最低年限_V1, Math.floor(Number(年限 || 自动生成魂灵最低年限_V1)));
      const 既有魂灵年限 = Math.max(0, Math.floor(Number(魂灵数据.年限 || 0)));
      const 应用年限 = 强制同步 || !(既有魂灵年限 > 0) ? 安全年限 : 既有魂灵年限;
      if (强制同步 || !(既有魂灵年限 > 0)) 魂灵数据.年限 = 应用年限;
      取魂灵魂环条目_V1(魂灵数据).forEach(([, 魂环]) => {
        if (!魂环 || typeof 魂环 !== 'object') return;
        const 既有年限 = Math.max(0, Math.floor(Number(魂环.年限 || 0)));
        if (既有年限 > 0 && !强制同步) {
          if (!String(魂环.颜色 || '').trim() || 魂环.颜色 === '无') 魂环.颜色 = getRingColorByAge(既有年限);
          return;
        }
        魂环.年限 = 应用年限;
        魂环.颜色 = getRingColorByAge(应用年限);
      });
    }

    function 分配初始化魂灵年限预算_V1(魂灵计划 = [], 魂灵年限预算 = 0, 上下文 = {}) {
      const 计划 = Array.isArray(魂灵计划) ? 魂灵计划 : [];
      if (!计划.length) return;
      const 最低年限列表 = 计划.map(规划项 => {
        const 原始最低 = Math.max(
          自动生成魂灵最低年限_V1,
          Math.floor(Number(规划项.最低年限 || 自动生成魂灵最低年限_V1)),
        );
        const 年限上限 = Number.isFinite(Number(规划项.年限上限)) ? Math.max(自动生成魂灵最低年限_V1, Math.floor(Number(规划项.年限上限))) : Number.POSITIVE_INFINITY;
        return Number.isFinite(年限上限) ? Math.min(原始最低, 年限上限) : 原始最低;
      });
      const 目标年限列表 = 计划.map((规划项, 索引) => {
        const 年限上限 = Number.isFinite(Number(规划项.年限上限)) ? Math.max(自动生成魂灵最低年限_V1, Math.floor(Number(规划项.年限上限))) : Number.POSITIVE_INFINITY;
        const 目标年限 = Math.max(最低年限列表[索引], Math.floor(Number(规划项.spData?.age || 最低年限列表[索引])));
        return Number.isFinite(年限上限) ? Math.min(目标年限, 年限上限) : 目标年限;
      });
      const 最低总额 = 最低年限列表.reduce((总和, 年限) => 总和 + 年限, 0);
      const 目标总额 = 目标年限列表.reduce((总和, 年限) => 总和 + 年限, 0);
      const 可用预算 = Math.max(最低总额, Math.floor(Number(魂灵年限预算 || 0)));
      const 解锁比例 = 目标总额 > 最低总额
        ? Math.max(0, Math.min(1, (可用预算 - 最低总额) / (目标总额 - 最低总额)))
        : 1;
      计划.forEach((规划项, 索引) => {
        const 分配年限 = Math.max(
          最低年限列表[索引],
          Math.floor(最低年限列表[索引] + (目标年限列表[索引] - 最低年限列表[索引]) * 解锁比例),
        );
        规划项.spData.age = 分配年限;
        规划项.spData.color = getRingColorByAge(分配年限);
      });
      收口自动生成魂灵计划年限_V1(计划, 上下文);
    }

    function 估算初始化魂灵预算精神力上限_V1(角色数据 = {}) {
      if (!角色数据 || typeof 角色数据 !== 'object' || Array.isArray(角色数据)) return 0;
      const 属性 = 角色数据.属性 && typeof 角色数据.属性 === 'object' ? 角色数据.属性 : {};
      const 等级 = Math.max(1, Number(属性.等级 || 1) || 1);
      const 基础属性 = getBaseStats(等级);
      let 系别倍率 = 0;
      const 武魂条目 = 取角色武魂条目_V1(角色数据);
      if (武魂条目.length > 0) {
        武魂条目.forEach(([, 武魂]) => {
          const 倍率 = TypeMultipliers[武魂?.系别] || TypeMultipliers['强攻系'];
          系别倍率 = Math.max(系别倍率, Number(倍率?.men_max || 1));
        });
      } else {
        const 倍率 = TypeMultipliers[取角色主武魂系别_V1(角色数据)] || TypeMultipliers['强攻系'];
        系别倍率 = Number(倍率?.men_max || 1);
      }
      const 底子波动 = Math.max(0.1, Number(属性.底子波动 || 1));
      let 精神力上限 = Math.floor(
        (Math.floor(Number(基础属性.men_max || 0) * Math.max(0.1, 系别倍率 || 1) * 底子波动) +
          Math.max(0, Math.floor(Number(属性.训练加成?.精神力上限 || 0)))) *
          读取高天赋精神倍率_V1(属性),
      );
      精神力上限 = 应用龙王血脉精神力加成_V1(精神力上限, 角色数据);
      _(角色数据.魂骨).forEach((魂骨, 部位) => {
        if (!魂骨 || typeof 魂骨 !== 'object') return;
        if (是外附魂骨记录_V1(魂骨, 部位)) {
          const 倍率 = 按品质派生外附魂骨属性倍率_V1(魂骨?.品质);
          精神力上限 += Math.floor(精神力上限 * Math.max(0, Number(倍率?.精神力上限 || 0)));
          return;
        }
        const 加成 = getRingBonus(Number(魂骨.年限 || 0)).men_max;
        if (部位 === '头部魂骨') 精神力上限 += 加成 * 2;
        else 精神力上限 += 加成;
      });
      取角色武魂条目_V1(角色数据).forEach(([, 武魂]) => {
        取武魂全部魂环条目_V1(武魂).forEach(({ 魂环数据: 魂环, 魂灵数据: 魂灵 }) => {
          const 年限 = Math.max(0, Number(魂环?.年限 || 0));
          if (!(年限 > 0)) return;
          const 契合倍率 = 魂灵 ? Math.max(0.1, Number(魂灵.契合度 !== undefined ? 魂灵.契合度 : 100) / 100) : 1;
          精神力上限 += Math.floor(getRingBonus(年限).men_max * 契合倍率);
        });
      });
      return Math.max(读取角色精神力上限_V1(角色数据), Math.floor(精神力上限));
    }

    function 读取角色初始化魂灵可分配年限_V1(角色数据 = {}, 待补武魂数 = 1) {
      const 魂灵预算倍率 = Math.max(0, Number(初始化魂灵预算倍率记录_V1.get(角色数据) ?? 1));
      const 总预算 = Math.floor(读取精神力魂灵总年限上限_V1(估算初始化魂灵预算精神力上限_V1(角色数据)) * 魂灵预算倍率);
      const 剩余预算 = Math.max(0, 总预算 - 读取角色魂灵年限总和_V1(角色数据));
      return Math.floor(剩余预算 / Math.max(1, Math.floor(Number(待补武魂数 || 1))));
    }

    function 读取魂灵已承载魂环位列表_V1(魂灵数据 = {}) {
      return 取魂灵魂环条目_V1(魂灵数据)
        .map(([魂环键]) => 读取槽位序号_V1(魂环键, 0))
        .filter(魂环位 => 魂环位 > 0)
        .sort((a, b) => a - b);
    }

    function 按空间比例提升魂灵年限_V1(魂灵条目 = [], 可增年限 = 0) {
      const 条目 = Array.isArray(魂灵条目) ? 魂灵条目.filter(项 => 项 && 项.魂灵 && typeof 项.魂灵 === 'object') : [];
      let 剩余 = Math.max(0, Math.floor(Number(可增年限 || 0)));
      if (!条目.length || 剩余 <= 0) return false;
      const 可增长 = 条目.map(项 => {
        const 当前年限 = Math.max(自动生成魂灵最低年限_V1, Math.floor(Number(项.魂灵.年限 || 自动生成魂灵最低年限_V1)));
        const 年限上限 = Math.max(自动生成魂灵最低年限_V1, Math.floor(Number(项.年限上限 || 当前年限)));
        return { ...项, 当前年限, 年限上限, 空间: Math.max(0, 年限上限 - 当前年限) };
      }).filter(项 => 项.空间 > 0);
      if (!可增长.length) return false;
      const 空间总和 = 可增长.reduce((总和, 项) => 总和 + 项.空间, 0);
      const 本轮可分配 = Math.min(剩余, 空间总和);
      let 已更新 = false;
      可增长.forEach((项, 索引) => {
        if (剩余 <= 0) return;
        const 理论增量 = 索引 === 可增长.length - 1 ? 剩余 : Math.floor(本轮可分配 * 项.空间 / Math.max(1, 空间总和));
        const 增量 = Math.min(项.空间, Math.max(0, 理论增量));
        if (增量 <= 0) return;
        同步初始化魂灵年限到魂环_V1(项.魂灵, 项.当前年限 + 增量, true);
        剩余 -= 增量;
        已更新 = true;
      });
      for (const 项 of 可增长) {
        if (剩余 <= 0) break;
        const 当前年限 = Math.max(自动生成魂灵最低年限_V1, Math.floor(Number(项.魂灵.年限 || 自动生成魂灵最低年限_V1)));
        const 增量 = Math.min(剩余, Math.max(0, 项.年限上限 - 当前年限));
        if (增量 <= 0) continue;
        同步初始化魂灵年限到魂环_V1(项.魂灵, 当前年限 + 增量, true);
        剩余 -= 增量;
        已更新 = true;
      }
      return 已更新;
    }

    function 提升已有初始化魂灵年限预算_V1(角色数据 = {}) {
      if (!是否新档初始化 || !角色数据 || typeof 角色数据 !== 'object') return false;
      const 魂灵条目 = [];
      取角色武魂条目_V1(角色数据).forEach(([, 武魂]) => {
        取武魂魂灵条目_V1(武魂).forEach(([, 魂灵]) => {
          if (!魂灵 || typeof 魂灵 !== 'object') return;
          const 魂环位列表 = 读取魂灵已承载魂环位列表_V1(魂灵);
          const 年限上限 = 魂环位列表.length ? 读取初始化魂灵承载年限上限_V1(魂环位列表, 角色数据) : Math.max(自动生成魂灵最低年限_V1, Math.floor(Number(魂灵.年限 || 自动生成魂灵最低年限_V1)));
          魂灵条目.push({ 魂灵, 年限上限 });
        });
      });
      if (!魂灵条目.length) return false;
      const 魂灵预算倍率 = Math.max(0, Number(初始化魂灵预算倍率记录_V1.get(角色数据) ?? 1));
      const 目标总年限 = Math.floor(读取精神力魂灵总年限上限_V1(估算初始化魂灵预算精神力上限_V1(角色数据)) * 魂灵预算倍率);
      const 当前总年限 = 魂灵条目.reduce(
        (总和, 项) => 总和 + Math.max(自动生成魂灵最低年限_V1, Math.floor(Number(项.魂灵.年限 || 自动生成魂灵最低年限_V1))),
        0,
      );
      return 按空间比例提升魂灵年限_V1(魂灵条目, Math.max(0, 目标总年限 - 当前总年限));
    }

    function 补齐武魂缺失魂环_V1(char = {}, 武魂槽位 = '第1武魂', 武魂数据 = {}, 目标魂环数 = 0, 待补武魂数 = 1) {
      if (!武魂数据 || typeof 武魂数据 !== 'object') return false;
      const 目标总数 = Math.max(0, Math.min(9, Math.floor(Number(目标魂环数 || 0))));
      if (目标总数 <= 0) return false;
      const 已有魂环位集合 = 读取武魂已有魂环位集合_V1(武魂数据);
      let 缺失魂环位列表 = [];
      for (let 魂环位 = 1; 魂环位 <= 目标总数; 魂环位++) {
        if (!已有魂环位集合.has(魂环位)) 缺失魂环位列表.push(魂环位);
      }
      if (!缺失魂环位列表.length) return false;

      let 已补齐 = false;
      if (!String(武魂数据.表象名称 || '').trim()) 武魂数据.表象名称 = '未展露';
      const 已有魂灵条目 = 取武魂魂灵条目_V1(武魂数据);

      已有魂灵条目.forEach(([, 魂灵数据], 魂灵索引) => {
        if (!缺失魂环位列表.length || !魂灵数据 || typeof 魂灵数据 !== 'object') return;
        const 当前魂环数 = 取魂灵魂环条目_V1(魂灵数据).length;
        const 可补数量 = Math.max(0, 读取魂灵自动初始化承载上限_V1(魂灵数据, 武魂槽位, 魂灵索引) - 当前魂环数);
        if (可补数量 <= 0) return;
        const 可补魂环位 = 缺失魂环位列表.slice(0, 可补数量);
        可补魂环位.forEach(魂环位 => {
          const 年限 = Math.max(
            自动生成魂灵最低年限_V1,
            Math.floor(Number(魂灵数据.年限 || 自动生成魂灵最低年限_V1)),
          );
          魂灵数据[`第${魂环位}魂环`] = 创建默认魂环数据_V1(魂环位, 年限);
          已有魂环位集合.add(魂环位);
          已补齐 = true;
        });
        缺失魂环位列表 = 缺失魂环位列表.filter(魂环位 => !已有魂环位集合.has(魂环位));
      });

      if (!缺失魂环位列表.length) return 已补齐;

      const 可用魂灵位 = Math.max(0, 9 - 取武魂魂灵条目_V1(武魂数据).length);
      const 承载规划 = 规划初始化魂环承载结构_V1(
        目标总数,
        char.属性.等级,
        char.属性.天赋梯队,
        char.属性.精神境界,
        可用魂灵位,
        武魂槽位,
        已有魂灵条目.length,
      );
      const 生成计划 = [];
      const 生成中魂灵年限表 = new Map(
        已有魂灵条目.map(([, 魂灵数据], 魂灵序号) => [
          魂灵序号,
          Math.max(自动生成魂灵最低年限_V1, Math.floor(Number(魂灵数据?.年限 || 自动生成魂灵最低年限_V1))),
        ]),
      );
      承载规划.forEach(规划项 => {
        if (!规划项) return;
        if (规划项.类型 === '独立魂环') {
          const 魂环位 = Math.max(1, Math.floor(Number(规划项.魂环位 || 1)));
          if (!缺失魂环位列表.includes(魂环位) || 已有魂环位集合.has(魂环位)) return;
          let 独立年限 =
            计算初始化魂环位目标年限_V1(魂环位, char.属性.等级, char.属性.天赋梯队, char.属性.精神境界, true, char) ||
            rollSpirit(char.属性.天赋梯队, char.属性.等级, 魂环位 - 1, char.属性.精神境界).age;
          const 独立上限 = 读取初始化动态魂环吸收极限_V1(魂环位, char, 独立年限);
          独立年限 = Math.max(
            自动生成魂灵最低年限_V1,
            Math.min(独立上限, Math.floor(独立年限)),
          );
          生成计划.push({ 类型: '独立魂环', 魂环位, 年限: 独立年限 });
          return;
        }

        const 魂环位列表 = (Array.isArray(规划项.魂环位列表) ? 规划项.魂环位列表 : [])
          .map(魂环位 => Math.max(1, Math.floor(Number(魂环位 || 1))))
          .filter(魂环位 => 缺失魂环位列表.includes(魂环位) && !已有魂环位集合.has(魂环位));
        if (!魂环位列表.length) return;
        const 魂灵序号 = Math.max(0, Math.floor(Number(规划项.魂灵序号 || 0)));
        let spData = rollSpirit(
          char.属性.天赋梯队,
          char.属性.等级,
          魂灵序号,
          char.属性.精神境界,
          生成中魂灵年限表.get(魂灵序号 - 1),
        );
        const 承载年限 = 计算初始化承载魂灵年限_V1(
          魂环位列表,
          char.属性.等级,
          char.属性.天赋梯队,
          char.属性.精神境界,
          char,
        );
        if (承载年限 !== null) spData.age = Math.max(spData.age, 承载年限);
        const 年限上限 = 读取初始化魂灵承载年限上限_V1(魂环位列表, char);
        spData.age = 收口自动生成魂灵单项年限_V1(
          Math.min(年限上限, Math.max(自动生成魂灵最低年限_V1, Math.floor(spData.age))),
          魂灵序号,
          { 年限上限 },
        );
        spData.color = getRingColorByAge(spData.age);
        生成中魂灵年限表.set(魂灵序号, spData.age);
        生成计划.push({
          类型: '魂灵',
          魂灵序号,
          魂环位列表,
          最低年限: 读取承载魂环数最低年限_V1(魂环位列表.length),
          年限上限,
          spData,
        });
      });

      let 魂灵计划 = 生成计划.filter(规划项 => 规划项.类型 === '魂灵');
      const 魂灵年限预算 = 读取角色初始化魂灵可分配年限_V1(char, 待补武魂数);
      if (魂灵计划.length > 0) {
        魂灵计划
          .sort((a, b) => Math.max(0, Number(a.魂灵序号 || 0)) - Math.max(0, Number(b.魂灵序号 || 0)))
          .forEach((规划项, 索引) => {
            规划项.最低年限 = Math.max(规划项.最低年限 || 自动生成魂灵最低年限_V1, 自动生成魂灵最低年限_V1);
          });
        分配初始化魂灵年限预算_V1(魂灵计划, 魂灵年限预算, {});
        魂灵计划.forEach(规划项 => {
          规划项.spData.age = 收口自动生成魂灵单项年限_V1(
            规划项.spData?.age,
            Math.max(0, Math.floor(Number(规划项.魂灵序号 || 0))),
            { 年限上限: 规划项.年限上限 },
          );
          规划项.spData.color = getRingColorByAge(规划项.spData.age);
        });
        魂灵计划 = 魂灵计划.filter(规划项 => Math.max(0, Number(规划项.spData?.age || 0)) >= 自动生成魂灵最低年限_V1);
        const 待重新分配魂环位 = 魂灵计划
          .flatMap(规划项 => (Array.isArray(规划项.魂环位列表) ? 规划项.魂环位列表 : []))
          .map(魂环位 => Math.max(1, Math.floor(Number(魂环位 || 1))))
          .filter(魂环位 => 缺失魂环位列表.includes(魂环位) && !已有魂环位集合.has(魂环位))
          .sort((a, b) => a - b);
        let 魂环指针 = 0;
        魂灵计划.forEach(规划项 => {
          const 可承载数 = 读取魂灵自动初始化承载上限_V1(规划项.spData?.age, 武魂槽位, 规划项.魂灵序号);
          规划项.魂环位列表 = 待重新分配魂环位.slice(魂环指针, 魂环指针 + 可承载数);
          魂环指针 += 规划项.魂环位列表.length;
        });
        魂灵计划 = 魂灵计划.filter(规划项 => Array.isArray(规划项.魂环位列表) && 规划项.魂环位列表.length > 0);
      }

      生成计划
        .filter(规划项 => 规划项.类型 === '独立魂环' || 魂灵计划.includes(规划项))
        .sort((a, b) => (a.魂环位列表?.[0] || a.魂环位 || 0) - (b.魂环位列表?.[0] || b.魂环位 || 0))
        .forEach(规划项 => {
          if (!规划项) return;
          if (规划项.类型 === '独立魂环') {
            if (已有魂环位集合.has(规划项.魂环位)) return;
            const 魂灵槽位名 = 读取下一个魂灵槽位名_V1(武魂数据);
            武魂数据[魂灵槽位名] = 构建初始化魂灵数据_V1(char, { age: 规划项.年限, color: getRingColorByAge(规划项.年限) }, 读取槽位序号_V1(魂灵槽位名, 1) - 1);
            武魂数据[魂灵槽位名][`第${规划项.魂环位}魂环`] = 创建默认魂环数据_V1(规划项.魂环位, 规划项.年限);
            已有魂环位集合.add(规划项.魂环位);
            已补齐 = true;
            return;
          }

          const 魂灵槽位名 = 读取下一个魂灵槽位名_V1(武魂数据);
          const 魂灵序号 = 读取槽位序号_V1(魂灵槽位名, 1) - 1;
          武魂数据[魂灵槽位名] = 构建初始化魂灵数据_V1(char, 规划项.spData, 魂灵序号);
          规划项.魂环位列表.forEach(魂环位 => {
            if (已有魂环位集合.has(魂环位)) return;
            武魂数据[魂灵槽位名][`第${魂环位}魂环`] = 创建默认魂环数据_V1(魂环位, 规划项.spData.age);
            已有魂环位集合.add(魂环位);
            已补齐 = true;
          });
        });

      return 已补齐;
    }

    const resourceStateBeforeRecalc = new Map();
    const 本轮补齐魂环角色 = new Set();
    const 记录当前资源比例基准 = (charName, char) => {
      if (!charName || !char?.属性) return;
      resourceStateBeforeRecalc.set(charName, {
        魂力: Math.max(0, Number(char.属性?.魂力 || 0)),
        魂力上限: Math.max(1, Number(char.属性?.魂力上限 || 1)),
        精神力: Math.max(0, Number(char.属性?.精神力 || 0)),
        精神力上限: Math.max(1, Number(char.属性?.精神力上限 || 1)),
        体力: Math.max(0, Number(char.属性?.体力 || 0)),
        体力上限: Math.max(1, Number(char.属性?.体力上限 || 1)),
        HP: Math.max(0, Number(char.属性?.HP || 0)),
        HP上限: Math.max(1, Number(char.属性?.HP上限 || char.属性?.体力上限 || 1)),
      });
    };

    _(data.char).forEach((char, charName) => {
      记录当前资源比例基准(charName, char);
      delete char.持续效果;
      delete char.蓄力技能;
      let isBeast = isSoulBeastCharacter(char);
      let firstSpiritName = '第1武魂';
      syncSoulTowerRecordEligibility(char);

      let spiritEntries = 取角色武魂条目_V1(char);
      if (spiritEntries.length > 0) {
        firstSpiritName = spiritEntries[0][0];
        if (!spiritEntries.some(([, 武魂数据]) => 是否真实武魂数据_V1(武魂数据))) spiritEntries = [];
      }

      if (
        spiritEntries.length === 0 &&
        !isNoSoulPowerTalentTier(char?.属性?.天赋梯队) &&
        Math.max(0, Number(char?.属性?.等级 || 0) || 0) > 0
      ) {
        const 原有武魂壳 =
          char[firstSpiritName] && typeof char[firstSpiritName] === 'object' && !Array.isArray(char[firstSpiritName])
            ? char[firstSpiritName]
            : {};
        char[firstSpiritName] = {
          ...原有武魂壳,
          表象名称: String(原有武魂壳.表象名称 || '').trim() || '未展露',
          系别: String(原有武魂壳.系别 || '').trim() || 武魂系别待补全文案_V1,
        };
        spiritEntries = [[firstSpiritName, char[firstSpiritName]]];
      }

      spiritEntries.forEach(([, 武魂数据]) => {
        if (!武魂数据 || typeof 武魂数据 !== 'object' || Array.isArray(武魂数据)) return;
        if (!String(武魂数据.系别 || '').trim()) {
          武魂数据.系别 = 武魂系别待补全文案_V1;
        }
        delete 武魂数据.领域;
      });

      const 待补武魂列表 = spiritEntries
        .map(([spiritKey, targetSpirit]) => {
          if (!targetSpirit || typeof targetSpirit !== 'object') return null;
          const expectedRings = 读取初始化武魂目标魂环数_V1(spiritKey, char.属性.等级, isBeast);
          if (expectedRings <= 0) return null;
          const 已有魂环位集合 = 读取武魂已有魂环位集合_V1(targetSpirit);
          const 缺失魂环位列表 = [];
          for (let 魂环位 = 1; 魂环位 <= expectedRings; 魂环位++) {
            if (!已有魂环位集合.has(魂环位)) 缺失魂环位列表.push(魂环位);
          }
          if (!缺失魂环位列表.length) return null;
          return { spiritKey, targetSpirit, expectedRings, 缺失魂环位列表 };
        })
        .filter(Boolean);

      待补武魂列表.forEach(待补武魂 => {
        const 已补齐 = 补齐武魂缺失魂环_V1(
          char,
          待补武魂.spiritKey,
          待补武魂.targetSpirit,
          待补武魂.expectedRings,
          待补武魂列表.length,
        );
        if (已补齐) 本轮补齐魂环角色.add(charName);
      });
      if (提升已有初始化魂灵年限预算_V1(char)) 本轮补齐魂环角色.add(charName);
    });

    const isIntelRequestKey = requestKey => String(requestKey || '').trim().startsWith('intel_');
    const pendingSecretIntelReasonEntries = [];
    const 情报事件源 = 读取情报事件源_V1();

    if (情报事件源 && typeof 情报事件源 === 'object') {
      let dev = data.world.偏差值 || 0;

      let allIntels = Array.isArray(情报事件源) ? 情报事件源 : Object.values(情报事件源).flat();

      allIntels.map(lowerCaseKeys).forEach((intel, index) => {
        const 情报内容 = String(intel.content || '').trim();
        const 情报名 = String(intel.trigger_flag || '').trim() || 情报内容.replace(/\s+/g, '').slice(0, 24) || `情报_${intel.tick || 0}_${index}`;
        if (!hasSecretIntel(情报名)) {
          let drift = dev > 0 ? Math.floor((Math.random() * 2 - 1) * dev * 100) : 0;
          let actualTick = intel.tick + drift;

          if (currentTick >= actualTick) {
            if (intel.knowers || getDefaultSecretIntelKnowers_ACU(情报名).length > 0) {
              const { rules, targets } = resolveSecretIntelKnowers_ACU({
                knowers: intel.knowers,
                情报名,
                内容: 情报内容,
              });
              const uniqueTargets = Array.from(new Set(targets.filter(Boolean)));
              upsertSecretIntel(情报名, {
                内容: 情报内容 || 情报名 || '无',
                知情规则: rules,
              });
              if (uniqueTargets.length > 0) {
                const visibleTargets = uniqueTargets.slice(0, 2).join('、');
                pendingSecretIntelReasonEntries.push(`${情报内容 || 情报名 || '未知情报'}→${visibleTargets}${uniqueTargets.length > 2 ? `等${uniqueTargets.length}人` : ''}`);
              }
            }

            if (dev >= 40) {
              appendSystemReasonText(
                `🚨[情报异变] 偏差值过高！刚刚解锁的【${String(情报内容 || 情报名 || '未知情报').substring(0, 10)}...】情报可能已被第三方篡改或发生恶性反转，请 AI 自由推演！`,
              );
            }
          }
        }
      });
    }
    refreshSecretIntelAudienceDistribution_ACU();
    appendSystemReasonBatchText('[机密情报待处理]', pendingSecretIntelReasonEntries);
    data.sys.系统播报 = compactInternalSystemReasonText(data.sys.系统播报);

    const pruneDefaultMentalDomainState = (char = {}) => {
      const mentalDomain = char.精神领域 && typeof char.精神领域 === 'object' ? char.精神领域 : null;
      if (!mentalDomain) return;
      const domainName = String(mentalDomain.名称 || '').trim();
      const domainDesc = String(mentalDomain.描述 || '').trim();
      const isDefaultMentalDomainShell =
        (!domainName || domainName === '无') &&
        (!domainDesc || domainDesc === '无');
      if (isDefaultMentalDomainShell) {
        delete char.精神领域;
      }
    };

    _(data.char).forEach(c => pruneDefaultMentalDomainState(c));

    if (delta > 0) {
      let daysPassed = Math.floor(currentTick / 144) - Math.floor(lastTick / 144);
      /*
      魂师津贴系统暂时隐藏，保留备用。
      const stipendPayoutTicks = getMonthlyStipendTicksCrossed_ACU(lastTick, currentTick);
      const stipendReasonEntries = [];
      stipendPayoutTicks.forEach(payoutTick => {
        const payoutItems = 发放魂师津贴_ACU();
        if (payoutItems.length) {
          stipendReasonEntries.push(`${formatTickToCalendar(payoutTick)} ${payoutItems.slice(0, 3).join('；')}${payoutItems.length > 3 ? ` 等${payoutItems.length}人` : ''}`);
        }
      });
      appendSystemReasonBatchText('[魂师津贴发放]', stipendReasonEntries, { limit: 2 });
      */

      _(data.char).forEach((c, charName) => {
        if (!c || typeof c !== 'object' || Array.isArray(c)) return;
        if (!c.状态 || typeof c.状态 !== 'object' || Array.isArray(c.状态)) c.状态 = {};
        if (!c.属性 || typeof c.属性 !== 'object' || Array.isArray(c.属性)) c.属性 = {};
        if (!c.属性.状态效果 || typeof c.属性.状态效果 !== 'object' || Array.isArray(c.属性.状态效果)) c.属性.状态效果 = {};
        const trainedBonus = ensureNumericStatBonusMap(c.属性, '训练加成');
        if (daysPassed > 0 && Math.random() < 0.05) {
          const locName = _.get(c, '状态.位置', '');
          const locData =
            _.get(data, ['world', '地点', locName], null) ||
            _.get(data, ['world', '动态地点', locName], null);

          const opportunities = Array.isArray(locData && locData.opportunities) ? locData.opportunities : [];

          if (opportunities.length > 0) {
            let event = opportunities[Math.floor(Math.random() * opportunities.length)];
            if (data.sys.系统播报 === '初始化' || !data.sys.系统播报) data.sys.系统播报 = '';
            data.sys.系统播报 += ` 🎲[区域机遇] ${charName} 在【${locName}】触发了特殊事件：${event}！`;
          }
        }
        if (c.状态.位置 && c.状态.位置.includes('血神军团入伍考核')) {
          c.属性.魂力 = 0;
          if (!c.属性.状态效果['禁魔领域']) {
            c.属性.状态效果['禁魔领域'] = {
              类型: 'debuff',
              层数: 1,
              描述: '处于考核虚拟网中，魂力被绝对封印，仅能使用肉体力量与气血',
            };
          }
        } else {
          delete c.属性.状态效果['禁魔领域'];
        }

        if (c.状态.存活 && getComputedWoundLevelFromStat(c.属性) !== '濒死') {
          if (daysPassed > 0) {
            const 城市档位信息 = 判定城市规模档位_ACU(c);
            const 城市档位索引 = Math.max(-1, Math.min(3, Number(城市档位信息.档位索引 ?? -1)));

            if (城市档位索引 >= 0) {
              if (!c.财富 || typeof c.财富 !== 'object' || Array.isArray(c.财富)) c.财富 = {};
              if (判断学院基础食宿保障_ACU(c)) {
                delete c.属性.状态效果['饥饿'];
              } else {
                const 消费货币字段 = 判定角色所在地货币_ACU(c);
                const 当前存款 = Math.max(0, Number(c.财富?.[消费货币字段] || 0));
                const 基础日消费 = BASE_DAILY_LIVING_COST_ACU;
                const 可负担档位索引 = 计算可负担消费档位_ACU(当前存款, 基础日消费, 城市档位索引);
                const 消费倍率 = Number(城市消费倍率表_ACU[可负担档位索引] || 1);
                const 实际消费 = Math.max(0, Math.floor(基础日消费 * daysPassed * 消费倍率));
                const 实际可扣 = 当前存款 >= 实际消费;
                if (可负担档位索引 < 城市档位索引) {
                  appendSystemReasonText(
                    `[城市消费降档] ${charName} 所在地区档位由${城市档位名称表_ACU[城市档位索引]}(${城市消费倍率表_ACU[城市档位索引]}x)自动降为${城市档位名称表_ACU[可负担档位索引]}(${消费倍率}x)。`,
                  );
                }
                if (实际可扣) {
                  c.财富[消费货币字段] = Math.max(0, 当前存款 - 实际消费);
                  delete c.属性.状态效果['饥饿'];
                } else {
                  c.财富[消费货币字段] = 0;
                  const starvationLoss = Math.max(1, Math.floor(Math.max(1, Number(c.属性.体力上限 || 1)) * 0.05 * daysPassed));
                  c.属性.体力 = Math.max(0, Number(c.属性.体力 || 0) - starvationLoss);
                  c.属性.状态效果['饥饿'] = {
                    类型: 'debuff',
                    层数: Math.max(1, daysPassed),
                    描述: `缺乏资金购买食物，体力额外流失 ${starvationLoss} 点，力量/防御/敏捷与魂力上限下降。`,
                    面板倍率: { 力量: 0.92, 防御: 0.92, 敏捷: 0.9, 魂力上限: 0.95 },
                  };
                }
              }
            }
          }

          const beforeCoreCount = Math.max(0, Math.floor(Number(c.魂核?.核心?.数量 || 0)));
          const 临时结算模式 = String(临时角色结算模式表[charName] || '').trim();
          if (临时结算模式) {
            let segmentTickCursor = lastTick;
            while (segmentTickCursor < currentTick) {
              const nextDailyBoundaryTick = getNextDailyAutoBoundaryTick_ACU(segmentTickCursor, currentTick, c, segmentTickCursor);
              const nextEraBoundaryTick = getNextEraBoundaryTick_ACU(segmentTickCursor, currentTick);
              const nextBoundaryTick = Math.min(currentTick, nextDailyBoundaryTick, nextEraBoundaryTick);
              const segmentDelta = Math.max(0, Number(nextBoundaryTick || 0) - Number(segmentTickCursor || 0));
              if (!(segmentDelta > 0)) break;
              applyCharacterActionSegment_ACU(c, 临时结算模式, segmentDelta, trainedBonus, charName, segmentTickCursor);
              记录当前资源比例基准(charName, c);
              segmentTickCursor = nextBoundaryTick;
            }
          } else {
            let segmentTickCursor = lastTick;
            while (segmentTickCursor < currentTick) {
              const nextDailyBoundaryTick = getNextDailyAutoBoundaryTick_ACU(segmentTickCursor, currentTick, c, segmentTickCursor);
              const nextEraBoundaryTick = getNextEraBoundaryTick_ACU(segmentTickCursor, currentTick);
              const nextBoundaryTick = Math.min(currentTick, nextDailyBoundaryTick, nextEraBoundaryTick);
              const segmentDelta = Math.max(0, Number(nextBoundaryTick || 0) - Number(segmentTickCursor || 0));
              if (!(segmentDelta > 0)) break;
              const segmentAction = isNightMeditationTick_ACU(segmentTickCursor, c, segmentTickCursor)
                ? (shouldDailyAutoSleep_ACU(c) ? '睡眠' : '冥想')
                : '日常';
              applyCharacterActionSegment_ACU(c, segmentAction, segmentDelta, trainedBonus, charName, segmentTickCursor);
              记录当前资源比例基准(charName, c);
              segmentTickCursor = nextBoundaryTick;
            }
          }
          const afterCoreCount = Math.max(0, Math.floor(Number(c.魂核?.核心?.数量 || 0)));
          if (afterCoreCount > beforeCoreCount) {
            if (data.sys.系统播报 === '初始化' || !data.sys.系统播报) data.sys.系统播报 = '';
            data.sys.系统播报 += ` [境界突破] ${c.属性.年龄}岁的 ${charName || '角色'} 在冥想中成功凝聚第 ${afterCoreCount} 魂核！修为上限解锁！`;
          }
          if (c?.属性?.状态效果?.地点拟态修炼?.结算模式 === '本轮冥想') {
            delete c.属性.状态效果.地点拟态修炼;
          }
          syncRoundedDisplaySoulPower_ACU(c);
        }
      });
      autoBreakthrough(data);
      refreshQuestBoardFrames(data, currentTick);
      data.world.时间._上次结算tick = currentTick;
    } else {
      autoBreakthrough(data);
    }
    if (是否新档初始化) {
      globalThis.__LWCS_INITIALIZE_SKILL_EFFECTS__(data);
    } else {
      const 补齐角色集 = {};
      Object.entries(data.char || {}).forEach(([角色名, 角色数据]) => {
        if (本轮补齐魂环角色.has(角色名) || 角色存在空技能效果数组_V1(角色数据)) 补齐角色集[角色名] = 角色数据;
      });
      if (Object.keys(补齐角色集).length > 0) globalThis.__LWCS_INITIALIZE_SKILL_EFFECTS__({ char: 补齐角色集 });
    }

    _(data.char).forEach((c, charName) => {
      const trainedBonus = ensureNumericStatBonusMap(c.属性, '训练加成');
      应用图鉴被动到角色(c);
      const previousResourceSnapshot = resourceStateBeforeRecalc.get(charName) || {
        魂力: Math.max(0, Number(c.属性?.魂力 || 0)),
        魂力上限: Math.max(1, Number(c.属性?.魂力上限 || 1)),
        精神力: Math.max(0, Number(c.属性?.精神力 || 0)),
        精神力上限: Math.max(1, Number(c.属性?.精神力上限 || 1)),
        体力: Math.max(0, Number(c.属性?.体力 || 0)),
        体力上限: Math.max(1, Number(c.属性?.体力上限 || 1)),
        HP: Math.max(0, Number(c.属性?.HP || 0)),
        HP上限: Math.max(1, Number(c.属性?.HP上限 || c.属性?.体力上限 || 1)),
      };
      const previousResourceRatios = {
        魂力: previousResourceSnapshot.魂力 / previousResourceSnapshot.魂力上限,
        精神力: previousResourceSnapshot.精神力 / previousResourceSnapshot.精神力上限,
        体力: previousResourceSnapshot.体力 / previousResourceSnapshot.体力上限,
        HP: previousResourceSnapshot.HP / previousResourceSnapshot.HP上限,
      };
      const isDefaultSeededResourceState =
        previousResourceSnapshot.魂力上限 <= 10 &&
        previousResourceSnapshot.精神力上限 <= 10 &&
        previousResourceSnapshot.体力上限 <= 10 &&
        previousResourceSnapshot.HP上限 <= 10 &&
        previousResourceRatios.魂力 >= 0.95 &&
        previousResourceRatios.精神力 >= 0.95 &&
        previousResourceRatios.体力 >= 0.95 &&
        previousResourceRatios.HP >= 0.95;
      const resourceRatioValues = Object.values(previousResourceRatios).filter(Number.isFinite);
      const ratioSpread = resourceRatioValues.length
        ? Math.max(...resourceRatioValues) - Math.min(...resourceRatioValues)
        : 1;
      const isKnownBuggedRecoveryRatio = [0.05, 0.3, 0.7].some(value =>
        Math.abs(previousResourceRatios.HP - value) <= 0.001,
      );
      const hasInjuryMarkers = Object.keys(c.状态?.受伤部位 || {}).length > 0;
      const looksLikePlaceholderExhaustedPack =
        previousResourceSnapshot.魂力 <= 10 &&
        previousResourceSnapshot.精神力 <= 10 &&
        previousResourceSnapshot.魂力上限 >= 1000 &&
        previousResourceSnapshot.精神力上限 >= 1000 &&
        previousResourceSnapshot.体力上限 >= 1000 &&
        previousResourceSnapshot.HP上限 >= 1000 &&
        previousResourceSnapshot.体力 <= 20 &&
        previousResourceSnapshot.HP <= 20 &&
        Math.abs(previousResourceSnapshot.体力 - previousResourceSnapshot.HP) <= 2 &&
        !data.world?.战斗?.进行中 &&
        !hasInjuryMarkers;
      const looksLikeNewCharacterDefaultLeak =
        previousResourceSnapshot.魂力 <= 10 &&
        previousResourceSnapshot.精神力 <= 10 &&
        previousResourceSnapshot.魂力上限 >= 100 &&
        previousResourceSnapshot.精神力上限 >= 20 &&
        previousResourceRatios.体力 >= 0.9 &&
        previousResourceRatios.HP >= 0.9 &&
        !data.world?.战斗?.进行中 &&
        !hasInjuryMarkers;
      const shouldResetBuggedInitializedResources =
        Math.abs(previousResourceSnapshot.HP上限 - previousResourceSnapshot.体力上限) > 1 &&
        !data.world?.战斗?.进行中 &&
        !hasInjuryMarkers &&
        resourceRatioValues.length === 4 &&
        ratioSpread <= 0.0015 &&
        isKnownBuggedRecoveryRatio;
      if (c.私密档案) {
        const age = Number(c.属性?.年龄 || 0);
        const 生理阶段文本 = String(c.私密档案._生理阶段 || '').trim();
        const 需要初始化生理判定 = !生理阶段文本 || 生理阶段文本 === '计算中...';

        if (!c.私密档案._已来初潮) {
          if (age < 10) {
            c.私密档案._生理阶段 = '未初潮(幼年)';
          } else {
            const 初潮判定tick列表 = 需要初始化生理判定 ? [currentTick] : 本轮跨过日界tick列表;
            for (const 判定tick of 初潮判定tick列表) {
              let 初潮概率 = 0;
              if (age === 11) 初潮概率 = 0.05;
              else if (age === 12) 初潮概率 = 0.3;
              else if (age === 13) 初潮概率 = 0.6;
              else if (age === 14) 初潮概率 = 0.95;
              else if (age >= 15) 初潮概率 = 1;
              if (!(初潮概率 > 0)) continue;
              if (Math.random() < 初潮概率) {
                c.私密档案._已来初潮 = true;
                if (需要初始化生理判定 || 判定tick === 0) {
                  c.私密档案.生理期偏移 = Math.floor(Math.random() * 4032);
                } else {
                  c.私密档案.生理期偏移 = 4032 - (判定tick % 4032);
                }
                if (currentTick > 0 && !是否新档初始化 && !需要初始化生理判定) {
                  if (!data.sys.系统播报) data.sys.系统播报 = '';
                  data.sys.系统播报 += ` [生理变化] ${charName} 迎来了初潮，正式进入青春期！`;
                }
                break;
              }
            }
            if (!c.私密档案._已来初潮) {
              c.私密档案._生理阶段 = '未初潮(青春期前)';
            }
          }
        }

        if (c.私密档案._已来初潮) {
          if (c.私密档案.受孕tick > 0) {
            const pregDays = Math.floor((currentTick - c.私密档案.受孕tick) / 144);
            c.私密档案._怀孕天数 = pregDays;
            c.私密档案._生理阶段 = '孕期停经';
            let 已触发分娩 = false;
            for (const 判定tick of 本轮跨过日界tick列表) {
              const 判定怀孕天数 = Math.floor((判定tick - c.私密档案.受孕tick) / 144);
              if (判定怀孕天数 < 270) continue;
              const 分娩概率 = (判定怀孕天数 - 270) / 30;
              if (Math.random() < 分娩概率 || 判定怀孕天数 >= 300) {
                if (data.sys.系统播报 === '初始化' || !data.sys.系统播报) data.sys.系统播报 = '';
                data.sys.系统播报 += ` [生命降生] ${charName} 经过 ${判定怀孕天数} 天的孕育，成功分娩！`;
                c.私密档案.受孕tick = -1;
                c.私密档案.受孕对象 = '无';
                c.私密档案._怀孕天数 = 0;
                已触发分娩 = true;
                break;
              }
            }
            if (已触发分娩) {
              const cycleTick = (currentTick + c.私密档案.生理期偏移) % 4032;
              const cycleDays = cycleTick / 144;
              if (cycleDays <= 5) {
                c.私密档案._生理阶段 = '生理期(极度敏感/易疲劳)';
              } else if (cycleDays > 11 && cycleDays <= 16) {
                c.私密档案._生理阶段 = '排卵期(渴望繁衍/受孕率极高)';
              } else {
                c.私密档案._生理阶段 = '安全期';
              }
            }
          }
          if (c.私密档案.受孕tick <= 0) {
            c.私密档案._怀孕天数 = 0;
            const cycleTick = (currentTick + c.私密档案.生理期偏移) % 4032;
            const cycleDays = cycleTick / 144;

            if (cycleDays <= 5) {
              c.私密档案._生理阶段 = '生理期(极度敏感/易疲劳)';
            } else if (cycleDays > 11 && cycleDays <= 16) {
              c.私密档案._生理阶段 = '排卵期(渴望繁衍/受孕率极高)';
            } else {
              c.私密档案._生理阶段 = '安全期';
            }
          }
        }
      }
      if (c.状态.吸收灵物年限 > 0) {
        let age = c.状态.吸收灵物年限;
        const spiritHerbGain = getSpiritHerbSoulPowerGain_ACU(age);
        if (c.属性.等级惩罚 > 0 && age >= 10000) {
          let recoverAmount = age >= 100000 ? 3 : 1;
          c.属性.等级惩罚 = Math.max(0, c.属性.等级惩罚 - recoverAmount);
          if (getComputedWoundLevelFromStat(c.属性) === '濒死') {
            c.属性.HP = Math.max(Math.ceil(c.属性.HP上限 * 0.1), Number(c.属性.HP || 0));
          }
          let 灵物播报文本 = `[本源修复] ${charName} 吸收高阶灵物，庞大的生机修补了受损的根基！恢复了 ${recoverAmount} 级等级上限。`;
          const extraHerbMessages = applyHundredThousandSpiritHerbBonus_ACU(c);
          if (extraHerbMessages.length) {
            灵物播报文本 += ` 同时${extraHerbMessages.join('，')}。`;
          }
          追加系统播报文本(data, 灵物播报文本);
        } else {
          if (c.属性.等级 - c.属性.上次灵物等级 >= 20) {
            c.属性.魂力上限 = Math.floor(Number(c.属性.魂力上限 || 0) + spiritHerbGain);
            c.属性.上次灵物等级 = c.属性.等级;
            let 灵物播报文本 = `[灵物吸收] ${charName} 成功吸收 ${age} 年灵物，魂力成长槽提升 ${spiritHerbGain} 点！`;
            const extraHerbMessages = applyHundredThousandSpiritHerbBonus_ACU(c);
            if (extraHerbMessages.length) {
              灵物播报文本 += ` 同时${extraHerbMessages.join('，')}。`;
            }
            追加系统播报文本(data, 灵物播报文本);
          } else {
            c.属性.等级惩罚 += 1;
            c.属性.状态效果['灵物反噬'] = {
              类型: 'debuff',
              层数: 1,
              描述: '短时间内强行吸收灵物，经脉受损，永久扣除1级等级上限',
            };
            追加系统播报文本(data, `[灵物反噬] ${charName} 违规连续吸收灵物！经脉受损，永久扣除 1 级等级上限！`);
          }
        }
        c.状态.吸收灵物年限 = 0;
      }

      const hadLifeFireActive = LIFE_FIRE_STATE_CACHE[charName] === true;
      if (hadLifeFireActive && c.血脉之力?.生命之火 === false) {
        追加系统播报文本(data, `[生命之火熄灭] ${charName} 透支本源，修为暴跌 3 级，陷入濒死！`);
        c.属性.等级 = Math.max(1, c.属性.等级 - 3);
        c.属性.等级惩罚 += 3;
        c.属性.HP = Math.max(1, Math.floor(c.属性.HP上限 * 0.03));
        c.属性.体力 = 1;
      }

      LIFE_FIRE_STATE_CACHE[charName] = c.血脉之力?.生命之火 === true;

      const hasSeenAliveState = Object.prototype.hasOwnProperty.call(COMBAT_DEATH_STATE_CACHE, charName);
      const isAliveNow = c.状态?.存活 !== false;
      const wasAlive = hasSeenAliveState ? COMBAT_DEATH_STATE_CACHE[charName] !== false : isAliveNow;
      if (hasSeenAliveState && wasAlive && !isAliveNow) {
        const winnerName = getBattleRewardRecipientName(data, charName);
        const winner = winnerName ? data?.char?.[winnerName] : null;
        const speciesFlags = getCombatSpeciesFlags(c);
        if (winner && typeof winner === 'object') {
          if (speciesFlags.isAbyss) {
            settleInternalAbyssKillReward(data, winner, winnerName, c, charName);
          } else if (speciesFlags.isBeast) {
            settleInternalSoulBeastReward(data, winner, winnerName, c, charName);
          }
        }
      }
      COMBAT_DEATH_STATE_CACHE[charName] = isAliveNow;

      let vitMult = 1.0,
        strMult = 1.0,
        defMult = 1.0,
        allMult = 1.0,
        menMult = 1.0;
      if (c.血脉之力?.生命之火 === true) {
        allMult = 2.0;
      }

      let 龙族体质类型 = '';
      取角色武魂条目_V1(c).forEach(([, sp]) => {
        const 武魂名 = String(sp?.表象名称 || '').trim();
        if (/龙王/.test(武魂名)) 龙族体质类型 = '龙王';
        else if (!龙族体质类型 && /龙/.test(武魂名)) 龙族体质类型 = '龙';
      });
      if (龙族体质类型) {
        const 天赋层级 = { 天赋极差: 0, 劣等: 0, 正常: 1, 优秀: 2, 天才: 3, 顶级天才: 4, 绝世妖孽: 5 }[
          String(c?.属性?.天赋梯队 || '').trim()
        ] ?? 1;
        const 龙族体质倍率 = 1 + Math.max(0, 天赋层级) * (龙族体质类型 === '龙王' ? 0.5 : 0.1);
        vitMult = Math.max(vitMult, 龙族体质倍率);
        strMult = Math.max(strMult, 龙族体质倍率);
        defMult = Math.max(defMult, 龙族体质倍率);
      }

      const wpnBonus = 计算装备属性加成_V1(c.装备?.武器, { ...c, 属性基准模式: '已含本武器加成' });
      const 防具加成 = c.装备?.防具?.装备状态 === '已装备'
        ? 计算装备属性加成_V1(c.装备?.防具, { ...c, 属性基准模式: '已含本武器加成' })
        : {};
      let eb = {
        sp:
          (wpnBonus.魂力上限 || 0) +
          (防具加成.魂力上限 || 0) +
          (c.装备?.斗铠?._属性加成?.魂力上限 || 0) +
          (c.装备?.机甲?._属性加成?.魂力上限 || 0),
        men:
          (wpnBonus.精神力上限 || 0) +
          (防具加成.精神力上限 || 0) +
          (c.装备?.斗铠?._属性加成?.精神力上限 || 0) +
          (c.装备?.机甲?._属性加成?.精神力上限 || 0),
        str:
          (wpnBonus.力量 || 0) +
          (防具加成.力量 || 0) +
          (c.装备?.斗铠?._属性加成?.力量 || 0) +
          (c.装备?.机甲?._属性加成?.力量 || 0),
        def:
          (wpnBonus.防御 || 0) +
          (防具加成.防御 || 0) +
          (c.装备?.斗铠?._属性加成?.防御 || 0) +
          (c.装备?.机甲?._属性加成?.防御 || 0),
        agi:
          (wpnBonus.敏捷 || 0) +
          (防具加成.敏捷 || 0) +
          (c.装备?.斗铠?._属性加成?.敏捷 || 0) +
          (c.装备?.机甲?._属性加成?.敏捷 || 0),
        vit:
          (wpnBonus.体力上限 || 0) +
          (防具加成.体力上限 || 0) +
          (c.装备?.斗铠?._属性加成?.体力上限 || 0) +
          (c.装备?.机甲?._属性加成?.体力上限 || 0),
      };
      if (allMult > 1.0) {
        c.属性.魂力上限 = Math.floor((c.属性.魂力上限 - eb.sp) * allMult) + eb.sp;
        c.属性.精神力上限 = Math.floor((c.属性.精神力上限 - eb.men) * allMult) + eb.men;
        c.属性.力量 = Math.floor((c.属性.力量 - eb.str) * allMult) + eb.str;
        c.属性.防御 = Math.floor((c.属性.防御 - eb.def) * allMult) + eb.def;
        c.属性.敏捷 = Math.floor((c.属性.敏捷 - eb.agi) * allMult) + eb.agi;
        c.属性.体力上限 = Math.floor((c.属性.体力上限 - eb.vit) * allMult) + eb.vit;
      }

      if (vitMult > 1.0)
        c.属性.体力上限 = Math.max(c.属性.体力上限, Math.floor((c.属性.体力上限 - eb.vit) * vitMult) + eb.vit);
      if (strMult > 1.0) c.属性.力量 = Math.max(c.属性.力量, Math.floor((c.属性.力量 - eb.str) * strMult) + eb.str);
      if (defMult > 1.0) c.属性.防御 = Math.max(c.属性.防御, Math.floor((c.属性.防御 - eb.def) * defMult) + eb.def);
      if (menMult > 1.0)
        c.属性.精神力上限 = Math.max(c.属性.精神力上限, Math.floor((c.属性.精神力上限 - eb.men) * menMult) + eb.men);

      let buffMods = { str: 0, def: 0, agi: 0, vit_max: 0, sp_max: 0, men_max: 0 };
      _(c.属性.状态效果).forEach(cond => {
        if (cond.面板倍率) {
          const 累加面板倍率 = (字段名, 修正键) => {
            const 倍率 = Number(cond.面板倍率[字段名]);
            if (Number.isFinite(倍率) && Math.abs(倍率 - 1.0) > 0.0001) buffMods[修正键] += 倍率 - 1.0;
          };
          累加面板倍率('力量', 'str');
          累加面板倍率('防御', 'def');
          累加面板倍率('敏捷', 'agi');
          累加面板倍率('体力上限', 'vit_max');
          累加面板倍率('魂力上限', 'sp_max');
          累加面板倍率('精神力上限', 'men_max');
        }
      });
      if (buffMods.str !== 0) c.属性.力量 = Math.floor(c.属性.力量 * Math.max(0.1, 1.0 + buffMods.str));
      if (buffMods.def !== 0) c.属性.防御 = Math.floor(c.属性.防御 * Math.max(0.1, 1.0 + buffMods.def));
      if (buffMods.agi !== 0) c.属性.敏捷 = Math.floor(c.属性.敏捷 * Math.max(0.1, 1.0 + buffMods.agi));
      if (buffMods.vit_max !== 0) c.属性.体力上限 = Math.floor(c.属性.体力上限 * Math.max(0.1, 1.0 + buffMods.vit_max));
      if (buffMods.sp_max !== 0) c.属性.魂力上限 = Math.floor(c.属性.魂力上限 * Math.max(0.1, 1.0 + buffMods.sp_max));
      if (buffMods.men_max !== 0) c.属性.精神力上限 = Math.floor(c.属性.精神力上限 * Math.max(0.1, 1.0 + buffMods.men_max));

      let finalMen =
        c.属性.精神力上限 -
        (wpnBonus.精神力上限 || 0) -
        (防具加成.精神力上限 || 0) -
        (c.装备?.斗铠?._属性加成?.精神力上限 || 0) -
        (c.装备?.机甲?._属性加成?.精神力上限 || 0);
      if (finalMen >= 50000) c.属性.精神境界 = '神元境';
      else if (finalMen >= 20000) c.属性.精神境界 = '灵域境';
      else if (finalMen >= 5000) c.属性.精神境界 = '灵渊境';
      else if (finalMen >= 500) c.属性.精神境界 = '灵海境';
      else if (finalMen >= 50) c.属性.精神境界 = '灵通境';
      else c.属性.精神境界 = '灵元境';

      if (c.属性 && typeof c.属性 === 'object') delete c.属性.状态效果;

      c.属性.HP上限 = Math.max(1, Number(c.属性.体力上限 || c.属性.HP上限 || 1));
      const resolvePreservedRatio = key => {
        if (判断本轮等级上升角色_V1(c, charName)) return 1.0;
        if (
          是否新档初始化 ||
          isDefaultSeededResourceState ||
          shouldResetBuggedInitializedResources ||
          looksLikePlaceholderExhaustedPack ||
          looksLikeNewCharacterDefaultLeak
        )
          return 1.0;
        return Math.max(0, Math.min(1, Number(previousResourceRatios[key] || 0)));
      };
      c.属性.魂力 = Math.max(0, Math.min(c.属性.魂力上限, Math.floor(c.属性.魂力上限 * resolvePreservedRatio('魂力'))));
      c.属性.精神力 = Math.max(0, Math.min(c.属性.精神力上限, Math.floor(c.属性.精神力上限 * resolvePreservedRatio('精神力'))));
      c.属性.体力 = Math.max(0, Math.min(c.属性.体力上限, Math.floor(c.属性.体力上限 * resolvePreservedRatio('体力'))));
      c.属性.HP = Math.max(0, Math.min(c.属性.HP上限, Math.floor(c.属性.HP上限 * resolvePreservedRatio('HP'))));
      const fatiguePenaltyMult = getComputedFatiguePenaltyMultiplierFromStat(c.属性);
      c.属性.力量 = Math.max(1, Math.floor(c.属性.力量 * fatiguePenaltyMult));
      c.属性.防御 = Math.max(1, Math.floor(c.属性.防御 * fatiguePenaltyMult));
      c.属性.敏捷 = Math.max(1, Math.floor(c.属性.敏捷 * fatiguePenaltyMult));
      同步紫极神光技能_V1(c, currentTick);
    });

    if (!data.world.战斗 || typeof data.world.战斗 !== 'object') data.world.战斗 = {};

    _(data.char).forEach(c => {
      _(c?.我的任务 || {}).forEach(任务条目 => {
        补全任务条目字段(任务条目, currentTick);
      });
    });

    _(data.char).forEach((c, charName) => {
    });

    _(data.char).forEach((c, charName) => {
      if (!c || typeof c !== 'object' || Array.isArray(c)) return;
      if (!c.状态 || typeof c.状态 !== 'object' || Array.isArray(c.状态)) c.状态 = {};
      if (!c.属性 || typeof c.属性 !== 'object' || Array.isArray(c.属性)) c.属性 = {};
      if (c.状态.位置) {
        if (c.状态.位置.includes('生命之湖') && c.属性.等级 < 90) {
          if (!c.属性.状态效果 || typeof c.属性.状态效果 !== 'object' || Array.isArray(c.属性.状态效果)) c.属性.状态效果 = {};
          c.属性.状态效果['极致凶威压制'] = {
            类型: 'debuff',
            层数: 1,
            描述: '擅闯生命之湖，被多股凶兽级精神力锁定，随时陨落！',
          };
        } else if (c.状态.位置.includes('星斗大森林核心区') && c.属性.等级 < 50) {
          if (!c.属性.状态效果 || typeof c.属性.状态效果 !== 'object' || Array.isArray(c.属性.状态效果)) c.属性.状态效果 = {};
          c.属性.状态效果['跨阶恐惧'] = { 类型: 'debuff', 层数: 1, 描述: '实力不足以踏足核心区，深陷高阶魂兽包围' };
          if (getComputedWoundLevelFromStat(c.属性) === '无') {
            c.属性.HP = Math.min(Number(c.属性.HP || c.属性.HP上限 || 0), Math.max(1, Math.floor(Number(c.属性.HP上限 || 1) * 0.2)));
          }
        } else if (c.状态.位置.includes('深海') && c.属性.等级 < 50) {
          if (!c.属性.状态效果 || typeof c.属性.状态效果 !== 'object' || Array.isArray(c.属性.状态效果)) c.属性.状态效果 = {};
          c.属性.状态效果['深海压迫'] = { 类型: 'debuff', 层数: 1, 描述: '修为不足以抵御深海重压' };
        }
      }

    });
    const REFRESH_INTERVAL = 1008;
    const 市场耗散基础触发率 = 0.22;
    const 商店刷新基准tick = Math.max(0, Math.floor(Number(currentTick || 0)));
    const 归一商店记录 = 商店数据 => {
      if (!商店数据 || typeof 商店数据 !== 'object' || Array.isArray(商店数据)) return { 库存: {}, _下次刷新tick: 0 };
      if (!商店数据.库存 || typeof 商店数据.库存 !== 'object' || Array.isArray(商店数据.库存)) 商店数据.库存 = {};
      const 旧刷新tick = Number(商店数据.下次刷新tick);
      const 当前刷新tick = Number(商店数据._下次刷新tick);
      商店数据._下次刷新tick = Math.max(0, Math.floor(Number.isFinite(当前刷新tick) ? 当前刷新tick : Number.isFinite(旧刷新tick) ? 旧刷新tick : 0));
      delete 商店数据.下次刷新tick;
      return 商店数据;
    };
    const 归一地点商店容器 = cityData => {
      if (!cityData || typeof cityData !== 'object' || Array.isArray(cityData)) return {};
      if (!cityData.商店 || typeof cityData.商店 !== 'object' || Array.isArray(cityData.商店)) cityData.商店 = {};
      Object.entries(cityData.商店).forEach(([商店名, 商店数据]) => {
        cityData.商店[商店名] = 归一商店记录(商店数据);
      });
      return cityData.商店;
    };

    _(data.world.地点).forEach((cityData, cityName) => {
      const 地点类型 = String(cityData?.类型 || '').trim();
      const 已声明商店 = !!cityData && typeof cityData === 'object' && !Array.isArray(cityData)
        && Object.prototype.hasOwnProperty.call(cityData, '商店');
      const 城市类地点 = /城市|主城|首都|城镇|新城/.test(地点类型);
      if (!已声明商店 && !城市类地点) return;
      const 城市商店 = 归一地点商店容器(cityData);

      const groceryStoreName = '城市杂货店';
      if (!城市商店[groceryStoreName]) {
        城市商店[groceryStoreName] = { 库存: {}, _下次刷新tick: 0 };
      }
      const groceryStore = 归一商店记录(城市商店[groceryStoreName]);
      城市商店[groceryStoreName] = groceryStore;

      if (商店刷新基准tick >= (groceryStore._下次刷新tick || 0)) {
        let newInventory = {};
        const economy = cityData.经济状况 || '普通';
        let stockMultiplier = 1.0;
        if (economy === '繁荣') stockMultiplier = 1.5;
        else if (economy === '萧条') stockMultiplier = 0.5;

        _(BaseProductPool).forEach((item, itemName) => {
          newInventory[itemName] = 写入物品定义并生成库存状态_V1(data, itemName, item, Math.floor((Math.random() * 10 + 5) * stockMultiplier));
        });
        groceryStore.库存 = newInventory;
        groceryStore._下次刷新tick = 商店刷新基准tick + REFRESH_INTERVAL;
      }
    });

    _(FactionDistribution).forEach((dist, factionName) => {
      const branchCities = Array.isArray(dist?.branches) ? dist.branches : [];
      const storeCityNames = factionName === '传灵塔'
        ? Array.from(new Set([String(dist?.hq || '').trim(), ...branchCities].filter(Boolean)))
        : branchCities;
      storeCityNames.forEach(cityName => {
        if (data.world.地点[cityName]) {
          const cityData = data.world.地点[cityName];
          const 城市商店 = 归一地点商店容器(cityData);
          const isHeadquartersStore = factionName === '传灵塔' && String(cityName || '').trim() === String(dist?.hq || '').trim();
          const storeName = isHeadquartersStore ? `${factionName}总部` : `${factionName}分店`;
          if (!城市商店[storeName]) {
            城市商店[storeName] = { 库存: {}, _下次刷新tick: 0 };
          }
          const store = 归一商店记录(城市商店[storeName]);
          城市商店[storeName] = store;

          if (商店刷新基准tick >= (store._下次刷新tick || 0)) {
            store.库存 = {};

            if (factionName === '唐门') 合并商品模板到库存_V1(data, store.库存, TangmenShopProducts);
            else if (factionName === '史莱克学院') 合并商品模板到库存_V1(data, store.库存, ShrekAcademyShopProducts);
            else if (AssociationShopProducts[factionName])
              合并商品模板到库存_V1(data, store.库存, AssociationShopProducts[factionName]);
            else if (factionName === '传灵塔') {
              store.库存['十年魂灵·随机型'] = 写入物品定义并生成库存状态_V1(data, '十年魂灵·随机型', {
                价格: 50000,
                货币: '联邦币',
                分类: '魂灵',
                库存: 5,
                需求声望: 0,
                描述: '最基础的人造魂灵，适合平民魂师。',
              });
              store.库存['百年魂灵·随机型'] = 写入物品定义并生成库存状态_V1(data, '百年魂灵·随机型', {
                价格: 1000000,
                货币: '联邦币',
                分类: '魂灵',
                库存: 3,
                需求声望: 0,
                描述: '品质尚可的百年魂灵。',
              });

              const 万年魂灵开放 = 判断传灵塔万年魂灵开放_V1(data);

              if (万年魂灵开放) {
                store.库存['千年魂灵·随机型'] = 写入物品定义并生成库存状态_V1(data, '千年魂灵·随机型', {
                  价格: 6000000,
                  货币: '联邦币',
                  分类: '魂灵',
                  库存: 2,
                  需求声望: 500,
                  描述: '技术成熟后的量产千年魂灵，价格已大幅下降。',
                });
                store.库存['万年魂灵·随机型'] = 写入物品定义并生成库存状态_V1(data, '万年魂灵·随机型', {
                  价格: 100000000,
                  货币: '联邦币',
                  分类: '魂灵',
                  库存: 1,
                  需求声望: 5000,
                  描述: '传灵塔尖端科技结晶，万年级别魂灵！',
                });
              } else {
                store.库存['千年魂灵·随机型'] = 写入物品定义并生成库存状态_V1(data, '千年魂灵·随机型', {
                  价格: 20000000,
                  货币: '联邦币',
                  分类: '魂灵',
                  库存: 1,
                  需求声望: 1000,
                  描述: '当前技术下极难培育的千年魂灵，造价高昂。',
                });
              }

              const economy = cityData.经济状况 || '普通';
              let probMultiplier = 1.0;
              if (economy === '繁荣') probMultiplier = 1.5;
              else if (economy === '萧条') probMultiplier = 0.5;

              if (Math.random() * 100 <= 20 * probMultiplier) {
                store.库存['初级升灵台门票'] = 写入物品定义并生成库存状态_V1(data, '初级升灵台门票', {
                  价格: 500000,
                  货币: '联邦币',
                  分类: '入场凭证',
                  库存: 1,
                  需求声望: 0,
                  描述: '可进入初级升灵台，最高遭遇3千年以下虚拟魂兽。',
                });
              }
              if (Math.random() * 100 <= 10 * probMultiplier) {
                store.库存['中级升灵台门票'] = 写入物品定义并生成库存状态_V1(data, '中级升灵台门票', {
                  价格: 5000000,
                  货币: '联邦币',
                  分类: '入场凭证',
                  库存: 1,
                  需求声望: 1000,
                  描述: '可进入中级升灵台，最高遭遇2万年以下虚拟魂兽。',
                });
              }
              if (Math.random() * 100 <= 5 * probMultiplier) {
                store.库存['高级升灵台门票'] = 写入物品定义并生成库存状态_V1(data, '高级升灵台门票', {
                  价格: 50000000,
                  货币: '联邦币',
                  分类: '入场凭证',
                  库存: 1,
                  需求声望: 5000,
                  描述: '可进入高级升灵台，最高遭遇10万年以下虚拟魂兽。',
                });
              }
              if (isHeadquartersStore) {
                store.库存['魂灵塔门票'] = 写入物品定义并生成库存状态_V1(data, '魂灵塔门票', {
                  价格: 20000000,
                  货币: '联邦币',
                  分类: '入场凭证',
                  库存: 1,
                  需求声望: 2000,
                  描述: '仅限史莱克城传灵塔总部核发，可进入魂灵塔挑战当前可冲击的下一层。',
                });
              }
            }

            const economy = cityData.经济状况 || '普通';
            let probMultiplier = 1.0;
            if (economy === '繁荣') probMultiplier = 1.5;
            else if (economy === '萧条') probMultiplier = 0.2;

            if (factionName.includes('锻造师协会')) {
              tryGenerateDynamicItem(store.库存, '千锻金属块', 500000, 2, 60 * probMultiplier);
              tryGenerateDynamicItem(store.库存, '灵锻金属块', 10000000, 3, 20 * probMultiplier);
              tryGenerateDynamicItem(store.库存, '魂锻金属块', 80000000, 4, 3 * probMultiplier);
              tryGenerateDynamicItem(store.库存, '天锻金属块', 500000000, 5, 0.1 * probMultiplier);
            } else if (factionName.includes('设计师协会')) {
              tryGenerateDynamicItem(store.库存, '二字斗铠设计图', 2000000, 3, 30 * probMultiplier);
              tryGenerateDynamicItem(store.库存, '三字斗铠设计图', 20000000, 4, 5 * probMultiplier);
              tryGenerateDynamicItem(store.库存, '四字斗铠设计图', 150000000, 5, 0.5 * probMultiplier);
            }

            store._下次刷新tick = 商店刷新基准tick + REFRESH_INTERVAL;
          }
      }
    });
    });

    刷新世界拍卖供给_V1(data, currentTick, REFRESH_INTERVAL);

    const 计算商品库存耗散量 = 当前库存 => {
      const 安全库存 = Math.max(0, Math.floor(Number(当前库存 || 0)));
      if (安全库存 <= 0) return 0;
      const 最大耗散 = 安全库存 >= 20 ? 4 : 安全库存 >= 8 ? 3 : 安全库存 >= 3 ? 2 : 1;
      return Math.max(1, Math.min(安全库存, Math.floor(Math.random() * 最大耗散) + 1));
    };

    const 执行市场自然耗散 = () => {
      if (Math.random() > 市场耗散基础触发率) return;
      const 城市列表 = Object.entries(data.world?.地点 || {}).filter(([, 城市数据]) =>
        城市数据 &&
        typeof 城市数据 === 'object' &&
        Object.keys(归一地点商店容器(城市数据)).length > 0
      );
      if (!城市列表.length) return;
      const 波动次数 = Math.random() < 0.75 ? 1 : 2;
      const 波动记录 = [];
      for (let i = 0; i < 波动次数; i += 1) {
        const 城市项 = 城市列表[Math.floor(Math.random() * 城市列表.length)];
        if (!城市项) continue;
        const [城市名, 城市数据] = 城市项;
        const 商店列表 = Object.entries(城市数据.商店 || {}).filter(([, 商店数据]) => {
          if (!商店数据 || typeof 商店数据 !== 'object') return false;
          const 距刷新剩余tick = Math.max(0, Number(商店数据._下次刷新tick || 0) - 商店刷新基准tick);
          if (距刷新剩余tick >= Math.floor(REFRESH_INTERVAL * 0.9)) return false;
          const 可售条目数 = Object.values(商店数据.库存 || {}).filter(
            条目 => 条目 && typeof 条目 === 'object' && Math.max(0, Number(条目.库存 || 0)) > 0,
          ).length;
          return 可售条目数 > 0;
        });
        if (!商店列表.length) continue;
        const [商店名, 商店数据] = 商店列表[Math.floor(Math.random() * 商店列表.length)];
        const 商品列表 = Object.entries(商店数据.库存 || {}).filter(([, 商品数据]) =>
          商品数据 &&
          typeof 商品数据 === 'object' &&
          Math.max(0, Number(商品数据.库存 || 0)) > 0
        );
        if (!商品列表.length) continue;
        const [商品名, 商品数据] = 商品列表[Math.floor(Math.random() * 商品列表.length)];
        const 当前库存 = Math.max(0, Number(商品数据.库存 || 0));
        const 耗散量 = 计算商品库存耗散量(当前库存);
        if (!(耗散量 > 0)) continue;
        const 新库存 = Math.max(0, 当前库存 - 耗散量);
        商品数据.库存 = 新库存;
        const 商品定义 = 查找运行时物品定义_V1(data, 商品名)?.定义 || null;
        const 价格值 = Math.max(0, Number(读取显式物品基础价格_V1(商品定义) ?? 0) * Number(商品数据.价格倍率 || 1) * Math.max(0, 1 - Number(商品数据.折扣 || 0)));
        const 高价值 = 价格值 >= 20000000 || /万年|十万|天锻|魂锻|四字斗铠|魂灵塔/.test(String(商品名 || ''));
        波动记录.push({
          城市名: String(城市名 || '').trim(),
          商店名: String(商店名 || '').trim(),
          商品名: String(商品名 || '').trim(),
          耗散量,
          新库存,
          高价值,
          耗尽: 新库存 <= 0,
        });
      }
      if (!波动记录.length) return;
      const 关键记录 = 波动记录.filter(项 => 项.耗尽 || 项.高价值);
      if (!关键记录.length) return;
      const 播报文本 = 关键记录
        .slice(0, 2)
        .map(项 => `${项.城市名 || '未知地区'}·${项.商店名 || '未知商店'}【${项.商品名 || '未知商品'}】-${项.耗散量}(余${项.新库存})`)
        .join('；');
      追加系统播报文本(data, `[市场波动] ${播报文本}`);
    };
    执行市场自然耗散();
    function 随机动态金属块基础金属(tier) {
      const 候选 = 动态金属块基础金属候选表_V1[Math.max(1, Math.min(5, Math.floor(Number(tier || 1))))] || 动态金属块基础金属候选表_V1[1];
      return 候选[Math.floor(Math.random() * 候选.length)] || '钢精';
    }
    function tryGenerateDynamicItem(背包, itemName, basePrice, tier, prob) {
      if (Math.random() * 100 > prob) return;

      let metalCount = 1;
      const 是否金属块 = itemName.includes('金属块');
      if (tier >= 2 && 是否金属块) {
        let roll = Math.floor(Math.random() * 100) + 1;
        if (roll <= 70) metalCount = 2;
        else if (roll <= 90) metalCount = 3;
        else if (roll <= 98) metalCount = 4;
        else metalCount = 5;
      }

      let forgeMult = 1 + (metalCount - 1) * 0.3;
      let fluctuation = 0.85 + Math.random() * 0.3;
      let finalPrice = Math.floor(basePrice * forgeMult * fluctuation);
      let 库存 = tier === 1 ? Math.floor(Math.random() * 10) + 5 : Math.floor(Math.random() * 2) + 1;

      let reqFame = 0;
      if (tier === 3) reqFame = 1000;
      else if (tier === 4) reqFame = 5000;
      else if (tier === 5) reqFame = 20000;

      const 物品名 = itemName;
      背包[物品名] = {
        库存,
        价格倍率: Math.max(0.01, Number((finalPrice / Math.max(1, basePrice)).toFixed(4))),
        折扣: 0,
        需求声望: reqFame,
        需求: {},
      };
      if (是否金属块) {
        背包[物品名].批次 = [{
          数量: 库存,
          基础金属: 随机动态金属块基础金属(tier),
          品质: tier >= 5 ? '传说' : tier >= 4 ? '史诗' : tier >= 3 ? '稀有' : '优秀',
        }];
        if (metalCount > 1) 背包[物品名].批次[0].副职业参数 = { 融合参数: { 数量: metalCount, 融合率: Math.floor(85 + Math.random() * 16) } };
      }
    }

    if (data && data.char) {
      if (!data.world) data.world = {};

      FLAT_LOCATIONS = {};
      if (data.world.地点) {
        for (let rootName in data.world.地点) {
          refreshFlatLocationsFromTree(data.world.地点[rootName], rootName);
        }
      }

      if (!data.world.动态地点) data.world.动态地点 = {};

      _(data.world.动态地点).forEach((locData, locName) => {
        if (locData.x === undefined) locData.x = FLAT_LOCATIONS[locData.归属父节点]?.x ?? -1;
        if (locData.y === undefined) locData.y = FLAT_LOCATIONS[locData.归属父节点]?.y ?? -1;
      });

      const PLAYER_NAME = data.sys?.玩家名;

      // travel_request 已弃用：统一移除。
      _(data.char).forEach((charData, charName) => {
        if (!charData || typeof charData !== 'object') return;
        delete charData.travel_request;
      });

      _(data.char).forEach((charData, charName) => {
        if (!charData || typeof charData !== 'object') return;
        const genericSkillAge = Math.max(1000, Number(charData.属性?.等级 || 1) * 200);
        const 主武魂系别 = 取角色主武魂系别_V1(charData);
        _(charData.武魂融合技 || {}).forEach((fusionData, fusionName) => {
          if (!fusionData || typeof fusionData !== 'object') return;
          fusionData.融合模式 = getNormalizedFusionMode(fusionData);
          fusionData.用法模式 = 获取规范化武魂融合技用法模式(fusionData);
          if (fusionData.融合模式 === 'self') fusionData.融合对象 = '无';
          const fusionAttributeState = buildFusionSkillAttributeStateFromData(fusionData, charName, data);
          const fusionElementProfile = buildElementProfileFromAttributeState(fusionAttributeState);
          ensureSkillStructGenerated(fusionData?.技能数据, {
            type: 主武魂系别,
            talentTier: charData.属性?.天赋梯队 || '正常',
            age: Math.max(10000, genericSkillAge),
            ringIndex: Math.max(1, Math.ceil(Number(charData.属性?.等级 || 1) / 10)),
            compatibility: 100,
            preferredSecondary: [],
            elementProfile: fusionElementProfile,
            可调用元素: fusionAttributeState.可调用元素,
            callableElements: fusionAttributeState.可调用元素,
            elementTrigger: '融合',
            sourceCategory: '武魂融合技',
            来源: '武魂融合技',
            来源类别: '武魂融合技',
            rootData: data,
            融合技: fusionData,
            融合参与者: fusionData?.融合参与者,
            融合模式: fusionData?.融合模式,
            融合对象: fusionData?.融合对象,
            textContext: {
              spiritName: fusionName,
              type: 主武魂系别,
            },
          });
          ensureFusionSkillMentalCost(fusionData?.技能数据, 0.5);
        });
      });

      const visibleChars = {};
      const protagonist = data.char[PLAYER_NAME];
      const unlocked = protagonist?.已掌握情报 || [];
      const currentLoc = protagonist?.状态?.位置 || '未知';
      const 关系 = protagonist?.社交?.关系 || {};
      const normalizeLocForMatch = location => {
        const raw = String(location || '')
          .replace(/^斗罗大陆-/, '')
          .replace(/^斗灵大陆-/, '')
          .trim();
        const segments = raw.split('-').filter(Boolean);
        return {
          raw,
          leaf: segments[segments.length - 1] || raw,
          segments,
        };
      };
      const isLocationCompatible = (baseLoc, targetLoc) => {
        const current = normalizeLocForMatch(baseLoc);
        const target = normalizeLocForMatch(targetLoc);
        if (!current.raw || !target.raw) return current.raw === target.raw;
        if (current.raw === target.raw || current.leaf === target.leaf) return true;
        return current.segments.some(seg => target.segments.includes(seg));
      };
      const cloneValue = (value, fallback = undefined) =>
        value === undefined ? fallback : JSON.parse(JSON.stringify(value));
      const toText = (value, fallback = '无') => {
        const text = String(value ?? '').trim();
        return text && text !== '未知' ? text : fallback;
      };
      const 读取本轮模块结算只读路径 = () => {
        try {
          const 当前时间 = Date.now();
          const 运行时根列表 = [];
          const 追加运行时根 = 运行时根 => {
            try {
              if (运行时根 && typeof 运行时根 === 'object' && !运行时根列表.includes(运行时根)) 运行时根列表.push(运行时根);
            } catch (error) {}
          };
          try { 追加运行时根(window); } catch (error) {}
          try { 追加运行时根(window.parent); } catch (error) {}
          try { 追加运行时根(window.top); } catch (error) {}
          try { 追加运行时根(globalThis); } catch (error) {}
          const 记录 = 运行时根列表
            .map(运行时根 => {
              try { return 运行时根.__LWCS_本轮模块结算路径__; } catch (error) { return null; }
            })
            .find(候选记录 => 候选记录 && typeof 候选记录 === 'object' && Number(候选记录.过期时间 || 0) > 当前时间);
          if (!记录 || typeof 记录 !== 'object' || Number(记录.过期时间 || 0) <= 当前时间) return [];
          return (Array.isArray(记录.路径列表) ? 记录.路径列表 : [])
            .filter(路径 => Array.isArray(路径) && 路径.length > 1)
            .map(路径 => 路径.map(片段 => String(片段 ?? '').trim()).filter(Boolean))
            .filter(路径 => 路径.length > 1 && ['sys', 'world', 'org', 'char'].includes(路径[0]));
        } catch (error) {
          return [];
        }
      };
      const 投影本轮模块结算只读字段 = (显示根 = {}, 只读路径列表 = []) => {
        if (!显示根 || typeof 显示根 !== 'object' || !Array.isArray(只读路径列表) || 只读路径列表.length === 0) return 显示根;
        只读路径列表.forEach(路径 => {
          if (!Array.isArray(路径) || 路径.length < 2) return;
          let 当前节点 = 显示根;
          for (let index = 0; index < 路径.length - 1; index += 1) {
            const 片段 = 路径[index];
            if (!当前节点 || typeof 当前节点 !== 'object' || !(片段 in 当前节点)) return;
            当前节点 = 当前节点[片段];
          }
          if (!当前节点 || typeof 当前节点 !== 'object') return;
          const 叶字段 = 路径[路径.length - 1];
          if (!叶字段 || String(叶字段).startsWith('_') || !(叶字段 in 当前节点)) return;
          const 只读叶字段 = `_${叶字段}`;
          if (!(只读叶字段 in 当前节点)) 当前节点[只读叶字段] = 当前节点[叶字段];
          delete 当前节点[叶字段];
        });
        return 显示根;
      };
      const isEmptyDisplayText = value => String(value ?? '').trim() === '';
      const ensureDisplayText = (obj, key, fallbackText = '') => {
        if (!obj || typeof obj !== 'object') return;
        if (isEmptyDisplayText(obj[key])) obj[key] = fallbackText;
      };
      const ensureDisplayStringArray = (obj, key, fallbackText = '') => {
        if (!obj || typeof obj !== 'object') return;
        const current = obj[key];
        if (Array.isArray(current)) {
          const hasExistingValue = current.some(item => String(item ?? '').trim());
          if (hasExistingValue) return;
          if (current.length > 0) {
            const next = [...current];
            next[0] = fallbackText;
            obj[key] = next;
          } else {
            obj[key] = [fallbackText];
          }
          return;
        }
        if (isEmptyDisplayText(current)) {
          obj[key] = [fallbackText];
        }
      };
      const injectDisplaySkillStructDefaults = (skill = {}, context = {}) => {
        if (!skill || typeof skill !== 'object') return;
        const hasPackedEffects = Array.isArray(skill._效果数组) && skill._效果数组.length > 0;
        const textContext = context?.textContext || context || {};
        const 允许机制决策临时 = context?.允许机制决策临时 === true;
        if (!hasPackedEffects && Array.isArray(skill._效果数组)) delete skill._效果数组;
        if (isEmptyDisplayText(skill.魂技名)) skill.魂技名 = buildSkillNameTodoText(textContext);
        if (isEmptyDisplayText(skill.画面描述))
          skill.画面描述 = AI_TODO_SKILL_VISUAL;
        if (isEmptyDisplayText(skill.效果描述) || String(skill.效果描述 || '').trim() === SKILL_TEXT_UNKNOWN || isSkillTodoText(skill.效果描述)) {
          skill.效果描述 = AI_TODO_SKILL_EFFECT;
        }
        if (hasPackedEffects && skill?.[技能机制决策临时字段_V1] && typeof skill[技能机制决策临时字段_V1] === 'object') {
          delete skill[技能机制决策临时字段_V1];
        } else if (!hasPackedEffects && 允许机制决策临时) {
          skill[技能机制决策临时字段_V1] = 构建技能机制决策临时数据_V1(skill, context);
        } else if (skill?.[技能机制决策临时字段_V1] && typeof skill[技能机制决策临时字段_V1] === 'object') {
          delete skill[技能机制决策临时字段_V1];
        }
      };
      const injectDisplaySkillMapDefaults = (skillMap = {}, contextFactory = () => ({})) => {
        _(skillMap || {}).forEach((skill, skillName) => {
          if (!skill || typeof skill !== 'object') return;
          injectDisplaySkillStructDefaults(skill, contextFactory(skillName, skill) || {});
        });
      };
      const injectDisplayCharacterTodoDefaults = (charData = {}, charName = '', sourceChar = null) => {
        if (!charData || typeof charData !== 'object') return charData;
        const sourceAttr = sourceChar?.属性 && typeof sourceChar.属性 === 'object' ? sourceChar.属性 : null;
        const 允许机制决策临时 =
          !是否新档初始化 &&
          (charName === PLAYER_NAME || 是否同地图节点组(data, sourceChar, protagonist));

        ensureDisplayText(charData, '性格', AI_TODO_PERSONALITY);
        if (charData.社交 && typeof charData.社交 === 'object') {
          ensureDisplayText(charData.社交, '主身份', AI_TODO_MAIN_IDENTITY);
          ensureDisplayText(charData.社交, '家世描述', AI_TODO_FAMILY_BACKGROUND);
          _(charData.社交.关系 || {}).forEach(relData => {
            if (!relData || typeof relData !== 'object') return;
            规范武魂相关度基础字段(relData);
          });
        }
        if (charData.状态 && typeof charData.状态 === 'object') {
          ensureDisplayText(charData.状态, '位置', AI_TODO_STATUS_LOC);
        }
        if (charData.外貌 && typeof charData.外貌 === 'object') {
          ensureDisplayText(charData.外貌, '发色', '待补全(根据角色外貌补全发色)');
          ensureDisplayText(charData.外貌, '发型', '待补全(根据角色发质与气质补全发型)');
          ensureDisplayText(charData.外貌, '瞳色', '待补全(根据角色外貌补全瞳色)');
          ensureDisplayText(charData.外貌, '身高', '待补全(根据角色设定补全身高)');
          ensureDisplayText(charData.外貌, '体型', '待补全(根据角色体态补全体型)');
          ensureDisplayText(charData.外貌, '长相描述', '待补全(根据角色面部特征补全长相描述)');
          if (!Array.isArray(charData.外貌.特殊特征)) charData.外貌.特殊特征 = [];
          else {
            charData.外貌.特殊特征 = charData.外貌.特殊特征
              .map(item => String(item ?? '').trim())
              .filter(item => item && !/^待补全\(/.test(item));
          }
        }
        if (!charData.穿搭 || typeof charData.穿搭 !== 'object' || Array.isArray(charData.穿搭)) charData.穿搭 = {};
        ensureDisplayText(charData.穿搭, '上装', 角色穿搭上装待补全文案_V1);
        ensureDisplayText(charData.穿搭, '下装', 角色穿搭下装待补全文案_V1);
        ensureDisplayText(charData.穿搭, '鞋子', 角色穿搭鞋子待补全文案_V1);
        ensureDisplayText(charData.穿搭, '描述', 角色穿搭描述待补全文案_V1);
        if (charData.私密档案 && typeof charData.私密档案 === 'object') {
          ensureDisplayStringArray(charData.私密档案, '性癖', '待补全(请根据角色经历，填写已觉醒的特殊性癖好标签)');
          ensureDisplayStringArray(
            charData.私密档案,
            '性幻想',
            '待补全(请根据角色隐藏的性格，描写其内心深处渴望被对待的私密方式)',
          );
          if (charData.私密档案.身材数据 && typeof charData.私密档案.身材数据 === 'object') {
            ensureDisplayText(charData.私密档案.身材数据, '罩杯', '待补全(请根据角色体型填写，如A/B/C/D/E)');
            ensureDisplayText(charData.私密档案.身材数据, '身材描述', '待补全(请描写其身材曲线与肉感)');
          }
          if (charData.私密档案.贴身衣物 && typeof charData.私密档案.贴身衣物 === 'object') {
            ensureDisplayText(
              charData.私密档案.贴身衣物,
              '内衣',
              '待补全(请根据当前情境描写具体内衣款式，如蕾丝胸罩/真空/拘束具)',
            );
            ensureDisplayText(charData.私密档案.贴身衣物, '内裤', '待补全(请描写具体内裤款式，如丁字裤/C字裤/真空/贞操带)');
            ensureDisplayStringArray(
              charData.私密档案.贴身衣物,
              '特殊道具',
              '待补全(若体内或体表佩戴了跳蛋/项圈等道具请在此列出)',
            );
          }
          _(charData.私密档案.身体部位 || {}).forEach(partData => {
            if (!partData || typeof partData !== 'object') return;
            ensureDisplayText(
              partData,
              '外观特征',
              '待补全(请描写该部位的静态外观与天生敏感特征，如：粉嫩/修长/天生敏感)',
            );
          });
        }

        取角色武魂条目_V1(charData).forEach(([spiritKey, spiritData]) => {
          if (!spiritData || typeof spiritData !== 'object') return;
          const 武魂系别 = 取角色主武魂系别_V1(charData);
          const isSecondarySpirit = spiritKey === '第2武魂';
          ensureDisplayText(spiritData, '表象名称', isSecondarySpirit ? '未展露' : AI_TODO_SPIRIT_NAME);
          ensureDisplayText(spiritData, '描述', isSecondarySpirit ? '无' : AI_TODO_SPIRIT_DESC);
          ensureDisplayText(spiritData, '系别', 武魂系别待补全文案_V1);
          ensureDisplayText(spiritData, '属性体系', AI_TODO_ATTRIBUTE_SYSTEM);
          if (Array.isArray(spiritData.可调用元素)) {
            const hasCallableElements = spiritData.可调用元素.some(item => String(item ?? '').trim());
            if (!hasCallableElements) spiritData.可调用元素 = [AI_TODO_CALLABLE_ELEMENTS];
          } else if (
            spiritData.可调用元素 === undefined ||
            spiritData.可调用元素 === null ||
            spiritData.可调用元素 === ''
          ) {
            spiritData.可调用元素 = [AI_TODO_CALLABLE_ELEMENTS];
          }

          取武魂魂灵条目_V1(spiritData).forEach(([soulSpiritKey, soulSpirit]) => {
            if (!soulSpirit || typeof soulSpirit !== 'object') return;
            ensureDisplayText(soulSpirit, '表象名称', AI_TODO_SOUL_SPIRIT_NAME);
            if (isEmptyDisplayText(soulSpirit.描述))
              soulSpirit.描述 = buildSoulSpiritDescriptionTodoText(soulSpirit);
            ensureDisplayText(soulSpirit, '品质', AI_TODO_SOUL_SPIRIT_QUALITY);
            if (Object.prototype.hasOwnProperty.call(soulSpirit, '附机制候选')) delete soulSpirit.附机制候选;
            取魂灵魂环条目_V1(soulSpirit).forEach(([, ringData]) => {
              if (!ringData || typeof ringData !== 'object') return;
              ensureDisplayText(ringData, '颜色', '无');
              injectDisplaySkillMapDefaults(Object.fromEntries(取魂环魂技条目_V1(ringData)), skillName => ({
                type: 武魂系别,
                允许机制决策临时,
                textContext: {
                  spiritName:
                    (!isAiTodoText(soulSpirit.表象名称) && soulSpirit.表象名称 !== '未展露'
                      ? soulSpirit.表象名称
                      : !isAiTodoText(spiritData.表象名称) && spiritData.表象名称 !== '未展露'
                        ? spiritData.表象名称
                        : spiritKey || soulSpiritKey || skillName),
                  martialSoulName:
                    !isAiTodoText(spiritData.表象名称) && spiritData.表象名称 !== '未展露'
                      ? spiritData.表象名称
                      : spiritKey,
                  soulSpiritName:
                    !isAiTodoText(soulSpirit.表象名称) && soulSpirit.表象名称 !== '未展露'
                      ? soulSpirit.表象名称
                      : soulSpiritKey,
                  type: 武魂系别,
                },
              }));
            });
          });
          取武魂直接魂环条目_V1(spiritData).forEach(([, ringData]) => {
            if (!ringData || typeof ringData !== 'object') return;
            ensureDisplayText(ringData, '颜色', '无');
            ensureDisplayText(ringData, '来源', '无');
            if (Object.prototype.hasOwnProperty.call(ringData, '附机制候选')) delete ringData.附机制候选;
            injectDisplaySkillMapDefaults(Object.fromEntries(取魂环魂技条目_V1(ringData)), skillName => ({
              type: 武魂系别,
              允许机制决策临时,
              textContext: {
                spiritName:
                  !isAiTodoText(spiritData.表象名称) && spiritData.表象名称 !== '未展露'
                    ? spiritData.表象名称
                    : spiritKey || skillName,
                martialSoulName:
                  !isAiTodoText(spiritData.表象名称) && spiritData.表象名称 !== '未展露'
                    ? spiritData.表象名称
                    : spiritKey,
                ringSource: String(ringData?.来源 || '').trim(),
                type: 武魂系别,
              },
            }));
          });

        });

        _(charData.魂骨 || {}).forEach((boneData, bonePart) => {
          if (!boneData || typeof boneData !== 'object') return;
          const 骨部位 = String(bonePart || '魂骨').trim() || '魂骨';
          const 魂骨来源文本 = String(boneData.来源 || '').trim();
          const 主武魂系别 = 取角色主武魂系别_V1(charData);
          const 现有魂骨名 = String(boneData.名称 || '').trim();
          if (!现有魂骨名 || 现有魂骨名 === '无' || isAiTodoText(现有魂骨名)) return;
          if (魂骨来源文本) boneData.来源 = 魂骨来源文本;
          boneData.名称 = 归一化魂骨名称_V1(boneData.名称, boneData.来源, 骨部位);
          injectDisplaySkillMapDefaults(boneData?.附带技能, skillName => ({
            type: 主武魂系别,
            允许机制决策临时,
            textContext: {
              spiritName: boneData?.名称 || 骨部位 || skillName,
              type: 主武魂系别,
            },
          }));
        });

        if (charData.血脉之力 && typeof charData.血脉之力 === 'object') {
          const keepExtendedBloodline = shouldKeepExtendedBloodlineData(charName, charData);
          if (!keepExtendedBloodline) {
            pruneExtendedBloodlineData(charData, charName);
          }
          同步内置血脉技能模板_V1(charData);
          const bloodlineType = 取角色主武魂系别_V1(charData);
          if (keepExtendedBloodline) {
            injectDisplaySkillMapDefaults(charData.血脉之力?.被动, skillName => ({
              type: bloodlineType,
              sourceCategory: '血脉技能',
              来源: '血脉技能',
              跳过预算门禁: true,
              血脉技能: true,
              允许机制决策临时,
              textContext: {
                spiritName: charData.血脉之力?.血脉 || skillName,
                type: bloodlineType,
              },
            }));
            injectDisplaySkillMapDefaults(charData.血脉之力?.技能, skillName => ({
              type: bloodlineType,
              sourceCategory: '血脉技能',
              来源: '血脉技能',
              跳过预算门禁: true,
              血脉技能: true,
              允许机制决策临时,
              textContext: {
                spiritName: charData.血脉之力?.血脉 || skillName,
                type: bloodlineType,
              },
            }));
            取血脉气血魂环条目_V1(charData.血脉之力).forEach(([, ringData]) => {
              if (!ringData || typeof ringData !== 'object') return;
              ensureDisplayText(ringData, '颜色', '金');
              injectDisplaySkillMapDefaults(Object.fromEntries(取气血魂环魂技条目_V1(ringData)), skillName => ({
                type: bloodlineType,
                sourceCategory: '气血魂技',
                来源: '气血魂技',
                跳过预算门禁: true,
                血脉技能: true,
                允许机制决策临时,
                textContext: {
                  spiritName: charData.血脉之力?.血脉 || skillName,
                  type: bloodlineType,
                },
              }));
            });
          }
        }

        injectDisplaySkillMapDefaults(charData.自创魂技, skillName => ({
          type: 取角色主武魂系别_V1(charData),
          允许机制决策临时,
          textContext: {
            spiritName: skillName,
            type: 取角色主武魂系别_V1(charData),
          },
        }));
        _(charData.武魂融合技 || {}).forEach((fusionData, fusionName) => {
          if (!fusionData || typeof fusionData !== 'object') return;
          const 主武魂系别 = 取角色主武魂系别_V1(charData);
          injectDisplaySkillStructDefaults(fusionData.技能数据, {
            type: 主武魂系别,
            允许机制决策临时,
            textContext: {
              spiritName: fusionName,
              type: 主武魂系别,
            },
          });
        });

        return charData;
      };
      const pruneSummaryValue = value => {
        if (value === undefined || value === null) return undefined;
        if (typeof value === 'string') {
          const text = value.trim();
          if (!text || ['无', '未知', '当前尚未积累足够的人物关系数据。'].includes(text)) return undefined;
          return value;
        }
        if (typeof value === 'number') return value === 0 ? undefined : value;
        if (typeof value === 'boolean') return value ? value : undefined;
        if (Array.isArray(value)) {
          const nextArray = value.map(item => pruneSummaryValue(item)).filter(item => item !== undefined);
          return nextArray.length > 0 ? nextArray : undefined;
        }
        if (typeof value === 'object') {
          const nextObject = {};
          Object.keys(value).forEach(key => {
            const pruned = pruneSummaryValue(value[key]);
            if (pruned !== undefined) nextObject[key] = pruned;
          });
          return Object.keys(nextObject).length > 0 ? nextObject : undefined;
        }
        return value;
      };

      const buildCharReadOnlySummary = (sourceChar = {}, visibleChar = sourceChar) => {
        const relationCards = [];
        const inventoryExtraSummary = [];
        const soulBoneStatSummary = [];
        const spiritCombatSummary = [];
        const jobSummary = [];
        const battleHistorySummary = [];
        const equipmentBonusSummary = [];

        _(sourceChar.社交?.关系 || {}).forEach((relData, targetName) => {
          relationCards.push({
            目标: targetName,
            关系: relData.关系 || '陌生',
            好感度: Number(relData.好感度 || 0),
            对方身份: relData.对方身份 || '无',
          });
        });

        _(sourceChar.背包 || {}).forEach((itemData, itemName) => {
          if (!itemData || typeof itemData !== 'object') return;
          const summaryItem = { 物品: itemName };
          let hasContent = false;
          if (Number(itemData.有效期至tick || 0) > 0) {
            summaryItem.有效期至tick = Number(itemData.有效期至tick || 0);
            hasContent = true;
          }
          if (hasContent) inventoryExtraSummary.push(summaryItem);
        });

        _(sourceChar.魂骨 || {}).forEach((boneData, boneName) => {
          if (!boneData || typeof boneData !== 'object') return;
          const statsBonus = cloneValue(boneData.属性加成 || {}, {});
          if (Object.values(statsBonus).some(value => Number(value || 0) !== 0)) {
            soulBoneStatSummary.push({
              部位: boneName,
              力量: Number(statsBonus.力量 || 0),
              防御: Number(statsBonus.防御 || 0),
              敏捷: Number(statsBonus.敏捷 || 0),
              体力上限: Number(statsBonus.体力上限 || 0),
              精神上限: Number(statsBonus.精神力上限 || 0),
              魂力上限: Number(statsBonus.魂力上限 || 0),
            });
          }
        });

        取角色武魂条目_V1(sourceChar).forEach(([spiritKey, spiritData]) => {
          const visibleSpirit = visibleChar?.[spiritKey] || spiritData || {};
          取武魂魂灵条目_V1(spiritData).forEach(([slotName, soulSpirit]) => {
            const powerPanel = soulSpirit?.战力面板;
            if (!powerPanel || typeof powerPanel !== 'object') return;
            const visibleSlot = visibleChar?.[spiritKey]?.[slotName] || soulSpirit || {};
            spiritCombatSummary.push({
              武魂槽位: spiritKey,
              武魂名称: visibleSpirit.表象名称 || spiritData?.表象名称 || '无',
              魂灵槽位: slotName,
              魂灵名称: visibleSlot.表象名称 || soulSpirit.表象名称 || '无',
              描述: String(visibleSlot.描述 || soulSpirit.描述 || '无'),
              品质: String(visibleSlot.品质 || soulSpirit.品质 || '无'),
              对标等级: formatCultivationLevelText(powerPanel.对标等级 || 0, '0'),
              力量: Number(powerPanel.str || 0),
              防御: Number(powerPanel.def || 0),
              敏捷: Number(powerPanel.agi || 0),
              体力上限: Number(powerPanel.vit_max || 0),
              精神上限: Number(powerPanel.men_max || 0),
              魂力上限: Number(powerPanel.sp_max || 0),
            });
          });
        });

        _(sourceChar.副职业 || {}).forEach((jobData, jobName) => {
          const 副职业 = 派生副职业运行时_V1(jobName, jobData);
          jobSummary.push({
            副职业: 读取副职业显示名_V1(jobName),
            等级: 副职业.等级,
            经验: 副职业.经验,
            称号: 副职业.称号,
            核心技艺: 副职业.核心技艺,
            支持融锻数: 副职业.支持融锻数,
            基础成功率: 副职业.基础成功率,
          });
        });

        _(sourceChar.战斗历史 || {}).forEach((historyData, historyName) => {
          battleHistorySummary.push({
            项目: historyName,
            次数: Number(historyData?.次数 || 0),
            最近tick: Number(historyData?.最近tick || 0),
          });
        });

        const armorBonus = cloneValue(sourceChar.装备?.斗铠?._属性加成 || {}, {});
        if (Object.values(armorBonus).some(value => Number(value || 0) !== 0)) {
          equipmentBonusSummary.push({
            装备: '斗铠',
            等效等级: Number(armorBonus.等效等级 || 0),
            力量: Number(armorBonus.力量 || 0),
            防御: Number(armorBonus.防御 || 0),
            敏捷: Number(armorBonus.敏捷 || 0),
            体力上限: Number(armorBonus.体力上限 || 0),
            精神上限: Number(armorBonus.精神力上限 || 0),
            魂力上限: Number(armorBonus.魂力上限 || 0),
          });
        }
        const 防具加成 = sourceChar.装备?.防具?.装备状态 === '已装备'
          ? 计算装备属性加成_V1(sourceChar.装备?.防具, { ...sourceChar, 属性基准模式: '已含本武器加成' })
          : {};
        if (Object.values(防具加成).some(value => Number(value || 0) !== 0)) {
          equipmentBonusSummary.push({
            装备: '防具',
            等效等级: 0,
            力量: Number(防具加成.力量 || 0),
            防御: Number(防具加成.防御 || 0),
            敏捷: Number(防具加成.敏捷 || 0),
            体力上限: Number(防具加成.体力上限 || 0),
            精神上限: Number(防具加成.精神力上限 || 0),
            魂力上限: Number(防具加成.魂力上限 || 0),
          });
        }
        const mechBonus = cloneValue(sourceChar.装备?.机甲?._属性加成 || {}, {});
        if (Object.values(mechBonus).some(value => Number(value || 0) !== 0)) {
          equipmentBonusSummary.push({
            装备: '机甲',
            等效等级: 0,
            力量: Number(mechBonus.力量 || 0),
            防御: Number(mechBonus.防御 || 0),
            敏捷: Number(mechBonus.敏捷 || 0),
            体力上限: Number(mechBonus.体力上限 || 0),
            精神上限: Number(mechBonus.精神力上限 || 0),
            魂力上限: Number(mechBonus.魂力上限 || 0),
          });
        }

        const summary = {
          精神境界: sourceChar.属性?.精神境界 || '无',
          名望等级: sourceChar.社交?.名望等级 || '籍籍无名',
          力量: Number(sourceChar.属性?.力量 || 0),
          防御: Number(sourceChar.属性?.防御 || 0),
          敏捷: Number(sourceChar.属性?.敏捷 || 0),
          体力上限: Number(sourceChar.属性?.体力上限 || 0),
          魂力上限: Number(sourceChar.属性?.魂力上限 || 0),
          精神上限: Number(sourceChar.属性?.精神力上限 || 0),
          社交关系卡片: relationCards,
          魂灵战力摘要: spiritCombatSummary,
          副职业摘要: jobSummary,
          装备加成摘要: equipmentBonusSummary,
          斗铠回路冲突: !!sourceChar.装备?.斗铠?._已排异,
          魂骨属性概览: soulBoneStatSummary,
          ...(isSoulTowerEligibleCharacter(sourceChar)
            ? {
                试炼最高层: Number(sourceChar.魂灵塔记录?.最高层 || 0),
              }
            : {}),
          战斗记录摘要: battleHistorySummary,
          物品附加信息: inventoryExtraSummary,
        };
        return pruneSummaryValue(summary) || {};
      };
      const sanitizeDisplayCharacter = (sourceChar = {}) => {
        const nextChar = cloneValue(sourceChar, {});
        if (nextChar.属性) {
          delete nextChar.属性.上次灵物等级;
          delete nextChar.属性.底子波动;
          delete nextChar.属性.天赋梯队;
          delete nextChar.属性.训练加成;
          delete nextChar.属性.精神境界;
          delete nextChar.属性.魂力上限;
          delete nextChar.属性.精神力上限;
          delete nextChar.属性.力量;
          delete nextChar.属性.防御;
          delete nextChar.属性.敏捷;
          delete nextChar.属性.体力上限;
          delete nextChar.属性.状态效果;
        }
        delete nextChar.魂灵塔记录;
        delete nextChar.战斗历史;
        _(nextChar.副职业 || {}).forEach(jobData => {
          if (jobData && typeof jobData === 'object') delete jobData.限制;
        });
        _(nextChar.社交?.称号 || {}).forEach(titleData => {
          if (titleData && typeof titleData === 'object') delete titleData.声望加成;
        });
        _(nextChar.社交?.关系 || {}).forEach(relData => {
          if (!relData || typeof relData !== 'object') return;
          delete relData.关系;
          delete relData.关系路线;
          delete relData._关系阶段;
          delete relData._下一阶段;
          delete relData._下一阶段阈值;
          delete relData._可切线;
          delete relData._切线限制原因;
          delete relData._推进提示;
          delete relData._维护优先级;
          delete relData._当前关系加成;
          delete relData._下档解锁加成;
          delete relData._下档解锁阈值;
        });
        if (nextChar.社交) {
          delete nextChar.社交.名望等级;
          delete nextChar.社交.关系分析;
        }
        _(nextChar.背包 || {}).forEach(itemData => {
          if (itemData && typeof itemData === 'object') {
            delete itemData.市场估值;
            delete itemData.有效期至;
          }
        });
        _(nextChar.魂骨 || {}).forEach(boneData => {
          if (!boneData || typeof boneData !== 'object') return;
          delete boneData.name;
          delete boneData.age;
          delete boneData.状态;
          delete boneData.属性加成;
        });
        if (nextChar.装备?.斗铠) {
          delete nextChar.装备.斗铠._属性加成;
          delete nextChar.装备.斗铠._已排异;
        }
        if (nextChar.装备?.机甲) {
          delete nextChar.装备.机甲._属性加成;
        }
        取角色武魂条目_V1(nextChar).forEach(([, spiritData]) => {
          取武魂魂灵条目_V1(spiritData).forEach(([, soulSpirit]) => {
            delete soulSpirit.战力面板;
          });
        });
        return nextChar;
      };
      const buildFactionReadOnlySummary = (sourceFaction = {}, detailLevel = 'public', factionName = '') =>
        detailLevel === 'related'
          ? {
              核心战力: cloneValue(sourceFaction.战力统计, {}),
              成员数量: Object.values(data.char || {}).filter(charData => Object.prototype.hasOwnProperty.call(charData?.社交?.势力 || {}, factionName)).length,
            }
          : null;
      const sanitizeDisplayFaction = (sourceFaction = {}, detailLevel = 'public', factionName = '') => {
        const nextFaction = {
          类型: sourceFaction.类型,
          别名: cloneValue(sourceFaction.别名, undefined),
          关键词: cloneValue(sourceFaction.关键词, undefined),
          描述: sourceFaction.描述,
          现状描述: sourceFaction.现状描述,
          影响力: Number(sourceFaction.影响力 || 0),
          规模: Number(sourceFaction.规模 || 0),
          状态: sourceFaction.状态 || '正常',
          上级势力: sourceFaction.上级势力 || '无',
          关系: cloneValue(sourceFaction.关系 || {}, {}),
        };
        const summary = buildFactionReadOnlySummary(sourceFaction, detailLevel, factionName);
        if (summary) nextFaction._summary = summary;
        return nextFaction;
      };
      const sanitizeDisplayLocation = (locData = {}, includeFull = false) =>
        includeFull
          ? {
              别名: locData.别名,
              关键词: locData.关键词,
              掌控势力: locData.掌控势力,
              人口: locData.人口,
              守护军团: locData.守护军团,
              经济状况: locData.经济状况,
              类型: locData.类型,
              描述: locData.描述,
              现状描述: locData.现状描述,
              状态: locData.状态,
              子节点: sanitizeDisplayLocationChildMap(locData.子节点 || {}),
              商店: Object.keys(locData.商店 || {}),
            }
          : {
              别名: locData.别名,
              关键词: locData.关键词,
              类型: locData.类型,
              描述: locData.描述,
              现状描述: locData.现状描述,
              状态: locData.状态,
              已知子节点: Object.keys(locData.子节点 || {}),
            };
      const sanitizeDisplayLocationChildMap = (childMap = {}) => {
        const result = {};
        Object.entries(childMap || {}).forEach(([childName, childData]) => {
          if (!childData || typeof childData !== 'object') return;
          const child = {
            别名: childData.别名,
            关键词: childData.关键词,
            类型: childData.类型,
            描述: childData.描述,
            现状描述: childData.现状描述,
            状态: childData.状态,
            掌控势力: childData.掌控势力,
          };
          result[childName] = child;
        });
        return result;
      };
      const sanitizeDisplayDynamicLocation = (dynData = {}) =>
        buildCompactDynamicLocationDisplayPayload(dynData);
      Object.keys(data.char).forEach(charName => {
        const realCharData = data.char[charName];
        const charLoc = realCharData.状态?.位置 || '未知';

        const isProtagonist = charName === PLAYER_NAME;
        const isSameLoc = charLoc !== '未知' && isLocationCompatible(currentLoc, charLoc);
        const isKnown = !!关系[charName];

        if (isProtagonist || isSameLoc || isKnown) {
          const fakeCharData = sanitizeDisplayCharacter(realCharData);

          if (charName === '唐舞麟' && !unlocked.includes('event_ch4_06')) {
            if (fakeCharData.血脉之力) fakeCharData.血脉之力.血脉 = '未知隐性变异(尚未觉醒)';
          }
          if (charName === '古月' && !unlocked.includes('event_ch3_07')) {
            if (fakeCharData.武魂 && fakeCharData.武魂['元素使']) fakeCharData.武魂['元素使'].系别 = '元素系';
          }
          injectDisplayCharacterTodoDefaults(fakeCharData, charName, realCharData);
          const charSummary = buildCharReadOnlySummary(realCharData, fakeCharData);
          if (charSummary && Object.keys(charSummary).length > 0) fakeCharData._summary = charSummary;

          visibleChars[charName] = fakeCharData;
        }
      });
      const filtered_org = {};
      const relatedOrgNames = new Set(Object.keys(protagonist?.社交?.势力 || {}));
      Object.values(visibleChars).forEach(visibleChar => {
        Object.keys(visibleChar?.社交?.势力 || {}).forEach(facName => relatedOrgNames.add(facName));
      });
      _(data.org || {}).forEach((orgData, orgName) => {
        const detailLevel = relatedOrgNames.has(orgName) ? 'related' : 'public';
        filtered_org[orgName] = sanitizeDisplayFaction(orgData, detailLevel, orgName);
      });

      const filtered_sys = {
        系统播报: data.sys?.系统播报,
      };

      const filtered_world = {
        时间: { tick: Number(data.world?.时间?.tick || 0), _calendar: data.world?.时间?._calendar || '未知' },
        偏差值: Number(data.world?.偏差值 || 0),
        偏差倍率: Number(data.world?.偏差倍率 || 1),
        累计击杀年限: Number(data.world?.累计击杀年限 || 0),
        兽潮已触发: !!data.world?.兽潮已触发,
        时间线: cloneValue(data.world?.时间线 || {}, {}),
        机密情报: cloneValue(data.world?.机密情报 || {}, {}),
        拍卖: cloneValue(data.world?.拍卖 || {}, {}),
        委托板: cloneValue(data.world?.委托板 || {}, {}),
        图鉴: cloneValue(data.world?.图鉴 || {}, {}),
        战斗: cloneValue(data.world?.战斗 || {}, {}),
        地点: {},
        动态地点: {},
      };

      const currentLocInfo = findMapNodeEntry(currentLoc, data);

      let currentContextNodeName = currentLocInfo?.path?.length
        ? currentLocInfo.path[currentLocInfo.path.length - 1]
        : currentLoc;

      if (data.world.动态地点[currentLoc]?.归属父节点) {
        currentContextNodeName =
          data.world.动态地点[currentLoc].归属父节点 ||
          currentLocInfo?.path?.[currentLocInfo.path.length - 1] ||
          '斗罗大陆';
      }
      const currentPathSegments = Array.isArray(currentLocInfo?.path) ? currentLocInfo.path : [];
      const currentLocSegments = normalizeLocForMatch(currentLoc).segments;
      const currentScopeNames = new Set([currentContextNodeName, ...currentPathSegments, ...currentLocSegments].filter(Boolean));
      const isDynamicLocationInCurrentScope = (dynName = '', dynData = {}) => {
        const parentName = String(dynData?.归属父节点 || '').trim();
        const parentSegments = normalizeLocForMatch(parentName).segments;
        const dynSegments = normalizeLocForMatch(dynName).segments;
        if (parentName && currentScopeNames.has(parentName)) return true;
        if (parentSegments.some(seg => currentScopeNames.has(seg))) return true;
        if (dynSegments.some(seg => currentScopeNames.has(seg))) return true;
        return false;
      };

      _(data.world.地点).forEach((locData, locName) => {
        if (locName === currentContextNodeName || (currentLocInfo?.path && currentLocInfo.path.includes(locName))) {
          filtered_world.地点[locName] = sanitizeDisplayLocation(locData, true);
        } else {
          filtered_world.地点[locName] = sanitizeDisplayLocation(locData, false);
        }
      });

      _(data.world.动态地点).forEach((dynData, dynName) => {
        if (isDynamicLocationInCurrentScope(dynName, dynData)) {
          filtered_world.动态地点[dynName] = sanitizeDisplayDynamicLocation(dynData);
        }
      });

      delete data.display_chars;
      delete data.display_all;
    }

    _(data.world?.动态地点 || {}).forEach(locData => {
      pruneDynamicLocationStorageFields(locData);
    });

    水合角色物品引用_V1(data);
    注册角色应用物品定义_V1(data);
    压缩角色应用物品引用_V1(data);
    记录数据根非魂师角色_V1(data);
    return data;
}

// 从 MVU.js 字段级 schema transform 机械拆分。
function 规范化装备Schema_V1(装备) {
    const 斗铠计算 = 计算斗铠属性加成_V1(装备.斗铠);
    装备.斗铠._属性加成 = 斗铠计算.属性加成;
    装备.斗铠._已排异 = 斗铠计算.已排异;

    if (装备.机甲.等级 !== '无' && 装备.机甲.状态 !== '重创') {
      if (!装备.机甲.名称 || 装备.机甲.名称 === '无') 装备.机甲.名称 = `${装备.机甲.等级}机甲`;
      if (!['近战', '远程', '均衡', '重装', '高速', '支援'].includes(String(装备.机甲.型号 || '').trim())) 装备.机甲.型号 = '均衡';
    }
    装备.机甲._属性加成 = 计算机甲属性加成_V1(装备.机甲);

    const 当前魂导装配 = 装备.魂导器?.装配 && typeof 装备.魂导器.装配 === 'object' && !Array.isArray(装备.魂导器.装配) ? 装备.魂导器.装配 : {};
    装备.魂导器 = { 装配: {} };
    魂导器装配槽位列表_V1.forEach(槽位 => {
      const 槽位物品 = 当前魂导装配[槽位] && typeof 当前魂导装配[槽位] === 'object' && !Array.isArray(当前魂导装配[槽位]) ? 当前魂导装配[槽位] : {};
      const 名称 = String(槽位物品.名称 || 槽位物品.name || '无').trim() || '无';
      装备.魂导器.装配[槽位] = 名称 === '无' ? { 名称: '无' } : { ...槽位物品, 名称 };
      if (Number(装备.魂导器.装配[槽位].魂导等级 || 0) > 0) 装备.魂导器.装配[槽位].魂导等级 = Math.max(1, Math.min(12, Math.floor(Number(装备.魂导器.装配[槽位].魂导等级 || 0))));
    });

    return 装备;

}

function 规范化技能结构Schema_V1(skill) {
    if (!String(skill.承载方式 || '').trim() && 是造物承载效果数组_V1(skill._效果数组)) skill.承载方式 = '造物承载';
    if (!String(skill.承载方式 || '').trim()) skill.承载方式 = '直接生效';
    if (String(skill.承载方式 || '').trim() !== '造物承载' && !是造物承载效果数组_V1(skill._效果数组)) delete skill.产物描述;
    // v3 阶段 7：旧档迁移——_效果数组 内 状态:'沉默' 自动转为 '封技'（沉默与封技语义重合，统一）
    迁移沉默到封技_V1(skill._效果数组);
    return 收口技能执行结构_V1(skill, {
      目标: '单体',
      passiveMode: String(skill.承载方式 || '').trim() === '被动',
    });

}

function 规范化魂骨Schema_V1(魂骨表) {
    魂骨槽位列表_V1.forEach(槽位 => {
      if (!魂骨表[槽位]) 魂骨表[槽位] = 创建空魂骨记录_V1(槽位);
      delete 魂骨表[槽位].类型;
      if (是外附魂骨槽位_V1(槽位)) 魂骨表[槽位].属性倍率 = 按品质派生外附魂骨属性倍率_V1(魂骨表[槽位].品质);
    });
    return 魂骨表;

}

function 规范化魂环Schema_V1(魂环) {
    Object.keys(魂环).forEach(键 => {
      if (是魂技槽位键_V1(键)) 魂环[键] = 读取MVUSchema部件_V1('SkillStructSchema').parse(魂环[键]);
    });
    delete 魂环.魂技;
    return 魂环;

}

function 规范化魂灵Schema_V1(魂灵) {
    Object.keys(魂灵).forEach(键 => {
      if (是魂环槽位键_V1(键)) 魂灵[键] = 读取MVUSchema部件_V1('SoulRingSchema').parse(魂灵[键]);
    });
    delete 魂灵.魂环;
    return 魂灵;
  
}

function 规范化武魂Schema_V1(武魂) {
    归入武魂直挂魂环到魂灵_V1(武魂);
    Object.keys(武魂).forEach(键 => {
      if (是魂灵槽位键_V1(键)) 武魂[键] = 读取MVUSchema部件_V1('SoulSpiritSchema').parse(武魂[键]);
    });
    delete 武魂.领域;
    delete 武魂.魂灵;
    delete 武魂.独立魂环;
    return 武魂;
  
}

function 规范化血脉魂环Schema_V1(魂环) {
    Object.keys(魂环).forEach(键 => {
      if (是血脉魂技槽位键_V1(键)) 魂环[键] = 读取MVUSchema部件_V1('SkillStructSchema').parse(魂环[键]);
    });
    delete 魂环.魂技;
    return 魂环;
  
}

function 规范化血脉之力Schema_V1(血脉) {
    Object.keys(血脉).forEach(键 => {
      if (是气血魂环槽位键_V1(键)) 血脉[键] = 读取MVUSchema部件_V1('BloodlineRingSchema').parse(血脉[键]);
    });
    delete 血脉.气血魂环;
    清理银龙王血脉字段_V1(血脉);
    return 血脉;
  
}

function 规范化等级输入Schema_V1(val) {
        if (val === '准神') return 99.5;
        let num = Number(val);
        return isNaN(num) ? 1 : num;
      
}

function 规范化显式天赋梯队_V1(天赋梯队 = '') {
    const 文本 = String(天赋梯队 || '').trim();
    return ['天赋极差', '劣等', '正常', '优秀', '天才', '顶级天才', '绝世妖孽'].includes(文本) ? 文本 : '';
}

function 计算等级反推天赋梯队_V1(年龄 = 0, 等级 = 1, 生日 = '') {
    const 等级值 = Math.max(0, Number(等级 || 0) || 0);
    if (等级值 <= 0) return '天赋极差';
    const 年龄值 = Math.max(0, Number(年龄 || 0) || 0);
    const 档位列表 = ['劣等', '正常', '优秀', '天才', '顶级天才', '绝世妖孽'];
    const 基准列表 = 档位列表.map(档位 => ({
      档位,
      基准等级: Number(计算初始化修为等级(档位, 年龄值, 1, 生日)) || 1,
    }));
    const 基准组列表 = [];
    for (const 项 of 基准列表) {
      const 末组 = 基准组列表[基准组列表.length - 1];
      if (末组 && Math.abs(末组.基准等级 - 项.基准等级) <= 0.0001) {
        末组.档位列表.push(项.档位);
      } else {
        基准组列表.push({ 基准等级: 项.基准等级, 档位列表: [项.档位] });
      }
    }
    const 入档组列表 = 基准组列表.map((组, 序号) => {
      const 前组 = 基准组列表[序号 - 1];
      const 入档线 = 前组 ? Math.floor((前组.基准等级 + 组.基准等级) / 2) : -Infinity;
      return { ...组, 入档线 };
    });
    const 可用组列表 = 入档组列表.filter(组 => 等级值 >= 组.入档线);
    if (!可用组列表.length) return '劣等';
    const 选中组 = 可用组列表[可用组列表.length - 1];
    const 候选列表 = 选中组.档位列表.map(档位 => ({ 档位 }));
    if (候选列表.length <= 1) return 候选列表[0]?.档位 || '正常';
    const 百面骰 = Math.floor(Math.random() * 100) + 1;
    if (选中组.档位列表.includes('绝世妖孽') && 百面骰 <= 1) return '绝世妖孽';
    if (选中组.档位列表.includes('顶级天才') && 百面骰 <= 11) return '顶级天才';
    if (选中组.档位列表.includes('天才')) return '天才';
    if (选中组.档位列表.includes('优秀')) return '优秀';
    if (选中组.档位列表.includes('正常')) return '正常';
    return 候选列表[0]?.档位 || '劣等';
}

function 填充默认训练加成_V1(属性 = {}, 强制重算 = false) {
    if (!属性 || typeof 属性 !== 'object') return 属性;
    属性.训练加成 = createNumericStatBonusMap(属性.训练加成);
    if (!强制重算 && !(属性.等级 > 10 && 属性.训练加成.力量 === 0 && 属性.训练加成.精神力上限 === 0)) return 属性;
    if (!(属性.等级 > 10)) return 属性;
    const 常规训练系数 =
      { 绝世妖孽: 1.6, 顶级天才: 1.2, 天才: 1.0, 优秀: 0.8, 正常: 0.5, 劣等: 0.2, 天赋极差: 0 }[属性.天赋梯队] || 0.5;
    const 精神训练系数 = 属性.天赋梯队 === '绝世妖孽' ? 2.0 : 常规训练系数;
    const 基础属性 = getBaseStats(属性.等级);
    const 常规训练倍率 = 0.005 * (属性.等级 - 10) * 常规训练系数;
    const 精神训练倍率 = 0.005 * (属性.等级 - 10) * 精神训练系数;
    属性.训练加成.力量 = Math.floor(基础属性.str * 常规训练倍率);
    属性.训练加成.防御 = Math.floor(基础属性.def * 常规训练倍率);
    属性.训练加成.敏捷 = Math.floor(基础属性.agi * 常规训练倍率);
    属性.训练加成.体力上限 = Math.floor(基础属性.vit_max * 常规训练倍率);
    属性.训练加成.精神力上限 = Math.floor(基础属性.men_max * 精神训练倍率);
    return 属性;
}

function 应用永久属性提升_V1(角色 = {}, 属性名 = '', 数值 = 0) {
    if (!角色 || typeof 角色 !== 'object' || Array.isArray(角色)) return { changed: false };
    if (!角色.属性 || typeof 角色.属性 !== 'object' || Array.isArray(角色.属性)) 角色.属性 = {};
    const amount = Number(数值);
    const allowedAttributes = new Set(['力量', '防御', '敏捷', '体力上限', '精神力上限', '魂力上限']);
    if (!allowedAttributes.has(属性名) || !Number.isInteger(amount) || amount <= 0) return { changed: false };
    const trainingBonus = createNumericStatBonusMap(角色.属性.训练加成);
    trainingBonus[属性名] = Math.max(0, Math.floor(Number(trainingBonus[属性名] || 0))) + amount;
    角色.属性.训练加成 = trainingBonus;
    return { changed: true, 属性: 属性名, 数值: amount, 训练加成: { ...trainingBonus } };
}

function 读取高天赋精神倍率_V1(属性 = {}) {
  const 固定倍率 = { 优秀: 1.25, 天才: 2, 顶级天才: 3.5, 绝世妖孽: 4 }[String(属性?.天赋梯队 || '').trim()] || 1;
  if (固定倍率 <= 1) return 1;
  const 等级 = Math.max(1, Number(属性?.等级 || 1) || 1);
  let 解锁系数 = 0;
  if (等级 <= 20) 解锁系数 = 0;
  else if (等级 <= 45) 解锁系数 = (等级 - 20) / 25;
  else 解锁系数 = 1;
  return 1 + (固定倍率 - 1) * Math.max(0, Math.min(1, 解锁系数));
}

function 读取龙王血脉精神力增幅率_V1(角色 = {}) {
  const 血脉名 = String(角色?.血脉之力?.血脉 || '').trim();
  const 等级 = Math.max(1, Number(角色?.属性?.等级 || 1) || 1);
  if (血脉名.includes('银龙王')) {
    if (血脉名.includes('龙神') || 等级 >= 100) return 6;
    if (等级 <= 15) return Math.max(0, 2.58);
    if (等级 <= 40) return 2.58 + ((0.43 - 2.58) / 25) * (等级 - 15);
    return Math.max(0, Math.min(1.6, 0.43 + ((1.6 - 0.43) / 58) * (等级 - 40)));
  }
  if (血脉名.includes('金龙王')) {
    const 解封层数 = Math.max(0, Math.floor(Number(角色?.血脉之力?.解封层数 || 0)));
    if (等级 <= 20) return Math.max(0, 0.56);
    if (等级 <= 40) return Math.max(0, 0.56 * (40 - 等级) / 20);
    const 后期解锁 = Math.max(0, Math.min(1, (等级 - 40) / 58)) * Math.min(2.5, 0.35 + 解封层数 * 0.25);
    return 后期解锁;
  }
  return 0;
}

function 应用龙王血脉精神力加成_V1(精神力上限 = 0, 角色 = {}) {
  const 基础值 = Math.max(0, Math.floor(Number(精神力上限 || 0)));
  const 血脉名 = String(角色?.血脉之力?.血脉 || '').trim();
  const 增幅率 = 读取龙王血脉精神力增幅率_V1(角色);
  if (!(增幅率 > 0)) return 基础值;
  const 增幅上限 = 血脉名.includes('银龙王') ? 40000 : 20000;
  return Math.floor(基础值 + Math.min(基础值 * 增幅率, 增幅上限));
}

function 规范化属性Schema_V1(data) {
    data.训练加成 = createNumericStatBonusMap(data.训练加成);

    if (data.底子波动 === 0) {
      data.底子波动 = 0.95 + Math.random() * 0.1;
    }

    if (data.魂力 < 0) data.魂力 = Math.max(0, Number(data.魂力上限 || 10));
    if (data.精神力 < 0) data.精神力 = Math.max(0, Number(data.精神力上限 || 10));
    if (data.体力 < 0) data.体力 = Math.max(0, Number(data.体力上限 || 10));
    if (data.HP上限 < 0) data.HP上限 = Math.max(1, Number(data.体力上限 || 10));
    if (data.HP < 0) data.HP = Math.max(0, Math.min(Number(data.HP上限 || 1), Number(data.体力 || data.HP上限 || 1)));
    data.HP上限 = Math.max(1, Number(data.HP上限 || 1));
    data.HP = Math.max(0, Math.min(Number(data.HP || 0), data.HP上限));

    填充默认训练加成_V1(data, false);
    return data;
  
}

function 规范化复制技能列表Schema_V1(list) {
                const 是有效复制技能数据 = skill => {
                  if (!skill || typeof skill !== 'object' || Array.isArray(skill)) return false;
                  if (String(skill.魂技名 || skill.name || skill.技能名称 || '').trim()) return true;
                  return Array.isArray(skill._效果数组) && skill._效果数组.length > 0;
                };
                const entries = _(list)
                  .entries()
                  .filter(([, item]) => {
                    if (!item || typeof item !== 'object' || Array.isArray(item) || !是有效复制技能数据(item.技能数据)) return false;
                    return item.剩余次数 === undefined || Number(item.剩余次数 || 0) > 0;
                  })
                  .map(([key, item]) => [
                    key,
                    item.剩余次数 === undefined
                      ? { 技能数据: item.技能数据 }
                      : { 技能数据: item.技能数据, 剩余次数: Math.max(1, Math.floor(Number(item.剩余次数 || 1))) },
                  ])
                  .value();
                return entries.length ? _.fromPairs(entries) : undefined;
              
}

function 规范化属性快照Schema_V1(snapshot) {
                const entries = _(snapshot)
                  .entries()
                  .filter(([, value]) => Number.isFinite(Number(value)))
                  .map(([key, value]) => [key, Number(value)])
                  .value();
                return entries.length ? _.fromPairs(entries) : undefined;
              
}

function 规范化复制效果Schema_V1(data) {
        const entries = _(data)
          .entries()
          .map(([key, value]) => {
            if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
            const record = { 到期tick: Math.max(0, Number(value.到期tick || 0)) };
            if (value.技能列表 && Object.keys(value.技能列表).length) record.技能列表 = value.技能列表;
            if (value.属性快照 && Object.keys(value.属性快照).length) record.属性快照 = value.属性快照;
            return record.技能列表 || record.属性快照 ? [key, record] : null;
          })
          .filter(Boolean)
          .value();
        return entries.length ? _.fromPairs(entries) : undefined;
      
}

function 规范化魂灵塔记录Schema_V1(record) {
        const 源记录 = record && typeof record === 'object' && !Array.isArray(record) ? record : {};
        源记录.最高层 = Math.max(0, Math.floor(Number(源记录.最高层 || 0)));
        const 源魂灵 = 源记录.当前五折魂灵 && typeof 源记录.当前五折魂灵 === 'object' && !Array.isArray(源记录.当前五折魂灵)
          ? 源记录.当前五折魂灵
          : {};
        const 当前五折魂灵 = {
          层数: Math.max(0, Math.floor(Number(源魂灵.层数 || 0))),
          名称: String(源魂灵.名称 || '').trim(),
          标准物种: String(源魂灵.标准物种 || '').trim(),
          年限: Math.max(0, Math.floor(Number(源魂灵.年限 || 0))),
          品质: String(源魂灵.品质 || '').trim().toUpperCase().replace('＋', '+').replace(/\s+/g, ''),
          已使用: 源魂灵.已使用 === true,
        };
        if (!(当前五折魂灵.层数 > 0 && 当前五折魂灵.标准物种 && 当前五折魂灵.年限 > 0 && 当前五折魂灵.品质 && 当前五折魂灵.已使用 === false)) {
          源记录.当前五折魂灵 = {
            层数: 0,
            名称: '',
            标准物种: '',
            年限: 0,
            品质: '',
            已使用: false,
          };
          return 源记录;
        }
        if (!当前五折魂灵.名称) 当前五折魂灵.名称 = `${当前五折魂灵.标准物种}魂灵`;
        源记录.当前五折魂灵 = 当前五折魂灵;
        return 源记录;
}

function 规范化战斗历史Schema_V1(data) {
  return _(data).entries().takeRight(20).fromPairs().value();
}

function 规范化副职业Schema_V1(副职业表) {
        Object.entries(副职业表 || {}).forEach(([副职业名, 副职业数据]) => {
          副职业数据.经验 = Math.max(0, Math.floor(Number(副职业数据.经验 || 0)));
          副职业数据.称号 = String(副职业数据.称号 || '无').trim() || '无';
          副职业数据.等级 = 读取副职业认证等级_V1(副职业名, 副职业数据);
        });
        return 副职业表;
      
}

function 规范化功法Schema_V1(功法表) {
        const 输出 = {};
        Object.entries(功法表 || {}).forEach(([功法名, 记录]) => {
          const 名称 = String(功法名 || '').trim();
          if (!名称) return;
          输出[名称] = 构建最新功法记录_V1(名称, 记录);
        });
        return 输出;
      
}

function 规范化社交Schema_V1(社交) {
  社交 = 社交 && typeof 社交 === 'object' && !Array.isArray(社交) ? 社交 : {};
  社交.名望等级 = 社交.名望等级 || '籍籍无名';
  社交.主身份 = String(社交.主身份 || '').trim() || AI_TODO_MAIN_IDENTITY;
  const 家世描述 = String(社交.家世描述 || '').trim();
  社交.家世描述 = 家世描述 && 家世描述 !== '无' ? 家世描述 : AI_TODO_FAMILY_BACKGROUND;

  Object.entries(社交.关系 && typeof 社交.关系 === 'object' ? 社交.关系 : {}).forEach(([对象, 关系数据]) => {
    if (!关系数据 || typeof 关系数据 !== 'object' || Array.isArray(关系数据)) {
      delete 社交.关系[对象];
      return;
    }
    关系数据.关系 = String(关系数据.关系 || '陌生').trim() || '陌生';
    const 好感度 = Number(关系数据.好感度);
    关系数据.好感度 = Number.isFinite(好感度) ? Math.max(-100, Math.min(100, 好感度)) : 0;
    关系数据.对方身份 = String(关系数据.对方身份 || '无').trim() || '无';
    规范武魂相关度基础字段(关系数据);
    [
      '关系路线',
      '_关系阶段',
      '_下一阶段',
      '_下一阶段阈值',
      '_可切线',
      '_切线限制原因',
      '_推进提示',
      '_维护优先级',
      '_当前关系加成',
      '_下档解锁加成',
      '_下档解锁阈值',
    ].forEach(字段 => delete 关系数据[字段]);
  });

  delete 社交.关系分析;
  return 社交;
      
}

function 规范化背包项Schema_V1(背包项) {
            背包项.数量 = Math.max(0, Math.floor(Number(背包项.数量 || 0)));
            背包项.批次 = (Array.isArray(背包项.批次) ? 背包项.批次 : [])
              .map(批次 => {
                const 输出 = {
                  数量: Math.max(0, Math.floor(Number(批次.数量 || 0))),
                };
                if (批次.品质 !== undefined) 输出.品质 = 规范化物品经济品质_V1(批次.品质);
                if (批次.品质系数 !== undefined) 输出.品质系数 = Math.max(0.1, Math.min(2, Number(批次.品质系数 || 1)));
                if (String(批次.基础金属 || '').trim()) 输出.基础金属 = String(批次.基础金属 || '').trim();
                if (批次.魂导等级 !== undefined) 输出.魂导等级 = Math.max(0, Math.min(12, Math.floor(Number(批次.魂导等级 || 0))));
                if (批次.耐久 !== undefined) 输出.耐久 = Math.max(0, Math.floor(Number(批次.耐久 || 0)));
                if (批次.剩余使用次数 !== undefined) 输出.剩余使用次数 = Math.max(0, Math.floor(Number(批次.剩余使用次数 || 0)));
                if (批次.使用次数恢复至tick !== undefined) 输出.使用次数恢复至tick = Math.max(0, Math.floor(Number(批次.使用次数恢复至tick || 0)));
                if (批次.绑定者 !== undefined) 输出.绑定者 = String(批次.绑定者 || '无').trim() || '无';
                if (批次.有效期至tick !== undefined) 输出.有效期至tick = Math.max(0, Math.floor(Number(批次.有效期至tick || 0)));
                const 原始融合参数 = 批次?.副职业参数?.融合参数;
                if (
                  原始融合参数 &&
                  typeof 原始融合参数 === 'object' &&
                  !Array.isArray(原始融合参数) &&
                  (原始融合参数.数量 !== undefined || 原始融合参数.融合率 !== undefined)
                ) {
                  输出.副职业参数 = {
                    融合参数: {
                      数量: Math.max(1, Math.floor(Number(原始融合参数.数量 || 1))),
                      融合率: Math.max(0, Math.min(100, Math.floor(Number(原始融合参数.融合率 ?? 100)))),
                    },
                  };
                }
                Object.keys(输出).forEach(键 => {
                  const 值 = 输出[键];
                  if (
                    键 !== '数量' &&
                    (值 === '' ||
                      (值 === 0 && !(键 === '剩余使用次数' && Number(输出.使用次数恢复至tick || 0) > 0)) ||
                      值 === '无' ||
                      (键 === '品质' && 值 === '普通') ||
                      (键 === '品质系数' && Number(值) === 1) ||
                      (Array.isArray(值) && !值.length) ||
                      (值 && typeof 值 === 'object' && !Array.isArray(值) && !Object.keys(值).length))
                  ) delete 输出[键];
                });
                return 输出;
              })
              .filter(批次 => Number(批次.数量 || 0) > 0);
            return 背包项;
                
}

function 归一化角色副职业键_V1(角色 = {}) {
    const 副职业表 = 角色?.副职业;
    if (!副职业表 || typeof 副职业表 !== 'object' || Array.isArray(副职业表)) return;
    const 合并副职业键 = (旧键, 新键) => {
      if (!Object.prototype.hasOwnProperty.call(副职业表, 旧键)) return;
      const 来源 = 副职业表[旧键];
      if (!来源 || typeof 来源 !== 'object' || Array.isArray(来源)) {
        delete 副职业表[旧键];
        return;
      }
      if (!副职业表[新键] || typeof 副职业表[新键] !== 'object' || Array.isArray(副职业表[新键])) {
        副职业表[新键] = 来源;
        delete 副职业表[旧键];
        return;
      }
      const 目标 = 副职业表[新键];
      const 来源等级 = Math.max(0, Math.floor(Number(来源.等级 || 0) || 0));
      const 目标等级 = Math.max(0, Math.floor(Number(目标.等级 || 0) || 0));
      const 来源经验 = Math.max(0, Number(来源.经验 || 0) || 0);
      const 目标经验 = Math.max(0, Number(目标.经验 || 0) || 0);
      const 来源称号 = String(来源.称号 || '').trim();
      const 目标称号 = String(目标.称号 || '').trim();
      if (来源等级 > 目标等级) 目标.等级 = 来源等级;
      if (来源经验 > 目标经验) {
        目标.经验 = 来源经验;
        if (来源称号 && 来源称号 !== '无') 目标.称号 = 来源称号;
      } else if ((!目标称号 || 目标称号 === '无') && 来源称号 && 来源称号 !== '无') {
        目标.称号 = 来源称号;
      }
      delete 副职业表[旧键];
    };
    合并副职业键('机甲制造师', '制造师');
    合并副职业键('机甲设计师', '设计师');
    合并副职业键('机甲修理师', '修理师');
}

function 规范化角色Schema_V1(char) {
    const 原始等级 = Math.max(0, Number(char?.属性?.等级 || 0) || 0);
    const normalizedCharName = String(char?.name || char?.属性?.name || char?.base?.name || '').trim();
    const 原始已有魂师结构 = 是否已有明确魂师数据_V1(char);
    let 本轮初始化魂师面板 = false;
    const 跳过真实魂环等级底线 = char?.状态?.__内置角色未来快照投影 === true;
    if (char?.状态 && typeof char.状态 === 'object') delete char.状态.__内置角色未来快照投影;
    const 显式天赋梯队 = 规范化显式天赋梯队_V1(char.__mvu_显式天赋梯队);
    delete char.__mvu_显式天赋梯队;
    const 标记本轮等级上升 = () => {
      const 当前等级 = Math.max(0, Number(char?.属性?.等级 || 0) || 0);
      if (当前等级 > 原始等级) 标记本轮等级上升角色_V1(char, normalizedCharName);
    };
    const isPlayerCharacter = char.__mvu_isPlayer === true;
    归一化角色副职业键_V1(char);
    记录数据根非魂师角色_V1({ char: { [normalizedCharName || char?.name || '']: char } });
    if (char?.属性 && 需要初始化生日(char.属性.生日)) {
      char.属性.生日 = 随机生成生日();
    }
    const secondarySpirit = char.第2武魂;
    if (secondarySpirit && typeof secondarySpirit === 'object') {
      const secondaryName = String(secondarySpirit['表象名称'] || '').trim();
      const secondaryDesc = String(secondarySpirit['描述'] || '').trim();
      const secondaryAttributeState = normalizeSpiritAttributeState(secondarySpirit, '第2武魂', char);
      const hasCallableElements = secondaryAttributeState.可调用元素.some(
        attr => attr && attr !== '无' && !isAiTodoText(attr),
      );
      const hasElementSystem = ['元素', '五行'].includes(String(secondaryAttributeState.属性体系 || '').trim());
      const hasSoulSpirits = 取武魂魂灵条目_V1(secondarySpirit).length > 0;
      const hasRealSecondarySpirit =
        (secondaryName && secondaryName !== '未展露' && !isAiTodoText(secondaryName)) ||
        (secondaryDesc && secondaryDesc !== '无' && !isAiTodoText(secondaryDesc)) ||
        hasElementSystem ||
        hasCallableElements ||
        hasSoulSpirits;

      if (!hasRealSecondarySpirit) {
        delete char.第2武魂;
      }
    }

    同步内置血脉技能模板_V1(char);
    pruneExtendedBloodlineData(char, '');

    if (char._initial_state_override) {
      _.merge(char, char._initial_state_override);
      delete char._initial_state_override;

      if (char.装备.斗铠.装备状态 === '已装备') {
        let armorLv = char.装备.斗铠.等级;
        const reqLv = [0, 50, 70, 80, 90][armorLv] || 0;

        if (char.属性.等级 < reqLv) {
          char.装备.斗铠.装备状态 = '未装备';
          if (!char.属性.状态效果['装备反噬'])
            char.属性.状态效果['装备反噬'] = { 类型: 'debuff', 层数: 1, 描述: '强行穿戴高阶斗铠失败，气血震荡' };
        } else if (
          char.装备.机甲.等级 !== '无' &&
          char.装备.机甲.等级 !== '红级' &&
          char.装备.机甲.状态 !== '重创' &&
          char.装备.机甲.装备状态 === '已装备'
        ) {
          char.装备.斗铠.装备状态 = '未装备';
        }
      }

      if (char.装备.机甲.装备状态 === '已装备') {
        let mechReqLv = { 黄级: 40, 紫级: 50, 黑级: 60, 红级: 80 }[char.装备.机甲.等级] || 0;
        if (char.属性.等级 < mechReqLv) {
          char.装备.机甲.装备状态 = '未装备';
          if (!char.属性.状态效果['机甲反噬'])
            char.属性.状态效果['机甲反噬'] = {
              类型: 'debuff',
              层数: 1,
              描述: '精神力与魂力不足以驾驭高阶机甲，遭到反噬',
            };
        }
      }

      const reqLv = [0, 50, 70, 80, 90][Number(char?.装备?.斗铠?.等级 || 0)] || 0;
      if (char.属性.等级 < reqLv) {
        char.装备.斗铠.装备状态 = '未装备';
        if (!char.属性.状态效果['装备反噬'])
          char.属性.状态效果['装备反噬'] = { 类型: 'debuff', 层数: 1, 描述: '强行穿戴高阶斗铠失败，气血震荡' };
      } else if (char.装备.机甲.等级 !== '无' && char.装备.机甲.等级 !== '红级' && char.装备.机甲.状态 !== '重创') {
        char.装备.斗铠.装备状态 = '未装备';
      }
    }

    {
      delete char.属性.背景;
      const 等级值 = Math.max(0, Number(char.属性?.等级 || 0) || 0);
      初始化魂灵预算倍率记录_V1.set(char, 1);
      if (!原始已有魂师结构) {
        char.属性.天赋梯队 = 显式天赋梯队 || 计算等级反推天赋梯队_V1(char.属性.年龄, 等级值, char.属性.生日);
        if (等级值 > 0 && !isNoSoulPowerTalentTier(char.属性.天赋梯队)) {
          填充默认训练加成_V1(char.属性, true);
          本轮初始化魂师面板 = true;
        }
      }
      if (!原始已有魂师结构 && isNoSoulPowerTalentTier(char.属性.天赋梯队)) {
        normalizeNoSoulPowerCharacterData(char);
        标记本轮等级上升();
        return char;
      }
    }

    const 显式等级 = Math.max(0, Math.floor(Number(char.属性?.等级 || 0)));
    const 魂力上限种子 = Math.max(0, Math.floor(Number(char.属性?.魂力上限 || 0)));
    const 需要静态高等级初始化 =
      !isPlayerCharacter &&
      显式等级 > 1 &&
      魂力上限种子 <= 10;

    if (需要静态高等级初始化) {
      本轮初始化魂师面板 = true;
      if (!char.魂核) char.魂核 = {};
      if (!char.魂核.核心 || typeof char.魂核.核心 !== 'object') char.魂核.核心 = { 数量: 0, 进度: 0 };
      const 当前时代 = 解析角色静态魂核时代_ACU(char);
      if (当前时代) 应用静态高等级魂核初始化_ACU(char, 当前时代);
    }

    if (!跳过真实魂环等级底线) {
      const 真实魂环等级底线 = 读取真实魂环等级底线_V1(char);
      if (真实魂环等级底线 > 0 && Number(char.属性.等级 || 0) < 真实魂环等级底线) {
        char.属性.等级 = 真实魂环等级底线;
        标记本轮等级上升();
      }
    }

    const base = getBaseStats(char.属性.等级);
    let maxTypeMult = { sp_max: 0, men_max: 0, str: 0, def: 0, agi: 0, vit_max: 0 };
    const spiritEntriesForType = 取角色武魂条目_V1(char);
    if (spiritEntriesForType.length > 0) {
      spiritEntriesForType.forEach(([, spiritData]) => {
        let tm = TypeMultipliers[spiritData.系别] || TypeMultipliers['强攻系'];
        maxTypeMult.sp_max = Math.max(maxTypeMult.sp_max, tm.sp_max);
        maxTypeMult.men_max = Math.max(maxTypeMult.men_max, tm.men_max);
        maxTypeMult.str = Math.max(maxTypeMult.str, tm.str);
        maxTypeMult.def = Math.max(maxTypeMult.def, tm.def);
        maxTypeMult.agi = Math.max(maxTypeMult.agi, tm.agi);
        maxTypeMult.vit_max = Math.max(maxTypeMult.vit_max, tm.vit_max);
      });
    } else {
      maxTypeMult = { ...(TypeMultipliers[取角色主武魂系别_V1(char)] || TypeMultipliers['强攻系']) };
    }
    const typeMult = maxTypeMult;
    const hiddenVar = char.属性.底子波动;
    const 自然魂力基准 = Math.floor(base.sp_max * typeMult.sp_max * hiddenVar);
    const 双生武魂魂力系数 = getDualSpiritSoulPowerCoeff(char);
    const 自然魂力上限 = Math.floor(自然魂力基准 * 双生武魂魂力系数);
    const 既有魂力上限 = Math.max(0, Math.floor(Number(char.属性?.魂力上限 || 0)));
    let final_str = Math.floor(base.str * typeMult.str * hiddenVar) + char.属性.训练加成.力量;
    let final_def = Math.floor(base.def * typeMult.def * hiddenVar) + char.属性.训练加成.防御;
    let final_agi = Math.floor(base.agi * typeMult.agi * hiddenVar) + char.属性.训练加成.敏捷;
    let final_vit_max = Math.floor(base.vit_max * typeMult.vit_max * hiddenVar) + char.属性.训练加成.体力上限;
    let final_men_max = Math.floor((Math.floor(base.men_max * typeMult.men_max * hiddenVar) + char.属性.训练加成.精神力上限) * 读取高天赋精神倍率_V1(char.属性));
    let final_sp_max = Math.max(自然魂力上限, 既有魂力上限);
    let bName = char.血脉之力?.血脉 || '无';

  if (bName.includes('金龙王')) {
      const 金龙王解封层数 = Math.max(0, Math.floor(Number(char?.血脉之力?.解封层数 || 0)));
      const 金龙王基础倍率 = 金龙王解封层数 <= 0 ? 1.5 : 2 + 金龙王解封层数;
      const 金龙王力量体力最终值 = 基础值 => {
        const 数值 = Math.max(0, Math.floor(Number(基础值 || 0)));
        if (数值 * 金龙王基础倍率 <= 100000) return Math.floor(数值 * 金龙王基础倍率);
        if (数值 * 5 <= 200000) return Math.max(100000, Math.floor(数值 * 5));
        return Math.max(200000, Math.floor(数值 * 2));
      };
      final_vit_max = 金龙王力量体力最终值(final_vit_max);
      final_str = 金龙王力量体力最终值(final_str);
      final_men_max = 应用龙王血脉精神力加成_V1(final_men_max, char);
    } else if (bName.includes('银龙王')) {
      let vitInc = final_vit_max * 1;
      final_vit_max += Math.min(vitInc, 20000);
      let strInc = final_str * 1;
      final_str += Math.min(strInc, 20000);
      final_men_max = 应用龙王血脉精神力加成_V1(final_men_max, char);
    }
    if (char.社交?.势力?.['本体宗']) {
      let vitInc = final_vit_max * 2;
      final_vit_max += Math.min(vitInc, 40000);
    }
    if (bName.includes('银龙王')) {
      const 等级 = Math.max(1, Number(char?.属性?.等级 || 1) || 1);
      const 解锁元素 = [];
      if (等级 >= 110) 解锁元素.push('创造');
      if (等级 >= 120) 解锁元素.push('毁灭');
      if (解锁元素.length) {
        取角色武魂条目_V1(char).forEach(([, 武魂数据]) => {
          if (!武魂数据 || typeof 武魂数据 !== 'object') return;
          const 名称文本 = String(武魂数据.表象名称 || 武魂数据.描述 || '').trim();
          const 系别文本 = String(武魂数据.系别 || '').trim();
          if (!/元素使|元素系|元素/.test(`${名称文本}/${系别文本}`)) return;
          const 当前元素 = normalizeAttributeTokenArray(武魂数据.可调用元素 || []);
          武魂数据.可调用元素 = Array.from(new Set([...当前元素, ...解锁元素]));
        });
      }
    }
    let previewMen = final_men_max;
    if (previewMen >= 50000) char.属性.精神境界 = '神元境';
    else if (previewMen >= 20000) char.属性.精神境界 = '灵域境';
    else if (previewMen >= 5000) char.属性.精神境界 = '灵渊境';
    else if (previewMen >= 500) char.属性.精神境界 = '灵海境';
    else if (previewMen >= 50) char.属性.精神境界 = '灵通境';
    else char.属性.精神境界 = '灵元境';

    let tier = char.属性.天赋梯队;
    const isBeast = isSoulBeastCharacter(char);
    const 角色势力名集合 = new Set(Object.keys(char?.社交?.势力 || {}));
    const 属于军方联邦势力 = Array.from(角色势力名集合).some(势力名 =>
      /斗罗联邦|联邦|帝国|军方|军团|军$/.test(String(势力名 || '')),
    );
    const 机甲初始化概率 = 属于军方联邦势力 ? 0.7 : 0.18;
    const 可初始化机甲 =
      !isBeast && char.属性.等级 < 95 && !角色势力名集合.has('史莱克学院') && Math.random() < 机甲初始化概率;
    const 斗铠名称文本 = String(char?.装备?.斗铠?.名称 || '').trim();
    const 机甲等级文本 = String(char?.装备?.机甲?.等级 || '').trim();
    const 机甲名称文本 = String(char?.装备?.机甲?.名称 || '').trim();
    const 机甲状态文本 = String(char?.装备?.机甲?.状态 || '').trim();
    const 机甲装备状态文本 = String(char?.装备?.机甲?.装备状态 || '').trim();
    const 已有明确斗铠 =
      Number(char?.装备?.斗铠?.等级 || 0) > 0 ||
      (!!斗铠名称文本 && 斗铠名称文本 !== '无') ||
      Object.keys(char?.装备?.斗铠?.部件 || {}).length > 0;
    const 已有明确机甲 =
      (!!机甲等级文本 && 机甲等级文本 !== '无') ||
      (!!机甲名称文本 && 机甲名称文本 !== '无') ||
      (!!机甲状态文本 && 机甲状态文本 !== '无') ||
      (!!机甲装备状态文本 && 机甲装备状态文本 !== '未装备');

    if (isBeast) {
      char.装备.斗铠.等级 = 0;
      char.装备.斗铠.名称 = '无';
      char.装备.斗铠.领域 = '无';
      char.装备.斗铠.材质 = '无';
      char.装备.斗铠.装备状态 = '未装备';
      char.装备.斗铠.部件 = {};
      char.装备.斗铠._属性加成 = { 等效等级: 0, 魂力上限: 0, 精神力上限: 0, 力量: 0, 防御: 0, 敏捷: 0, 体力上限: 0 };
      char.装备.斗铠._已排异 = false;
      char.装备.机甲.等级 = '无';
      char.装备.机甲.名称 = '无';
      char.装备.机甲.型号 = '无';
      char.装备.机甲.材质 = '无';
      char.装备.机甲.状态 = '无';
      char.装备.机甲.装备状态 = '未装备';
      char.装备.机甲.武装 = '无';
      char.装备.机甲.品质系数 = 1.0;
      char.装备.机甲._属性加成 = { 魂力上限: 0, 精神力上限: 0, 力量: 0, 防御: 0, 敏捷: 0, 体力上限: 0 };
      char.魂骨 = {};
      补齐角色魂骨槽位_V1(char);
    }

    if (!isBeast && ['绝世妖孽', '顶级天才', '天才'].includes(tier)) {
      let armorLv = 0;
      if (char.属性.等级 >= 99) {
        armorLv = 4;
      } else if (char.属性.等级 >= 98) {
        armorLv = Math.random() < 0.5 ? 4 : 3;
      } else if (char.属性.等级 >= 95) {
        armorLv = 3;
      } else if (char.属性.等级 >= 90 && tier === '天才') {
        if (!可初始化机甲 || Math.random() < 0.7) {
          armorLv = 3;
        } else {
          armorLv = 0;
          if (!已有明确机甲) {
            char.装备.机甲.等级 = char.属性.等级 >= 90 ? '黑级' : '紫级';
            char.装备.机甲.名称 = `${char.装备.机甲.等级}机甲`;
            char.装备.机甲.型号 = '均衡';
            char.装备.机甲.状态 = '完好';
            char.装备.机甲.装备状态 = '未装备';
          }
        }
      } else if (char.属性.等级 >= 80) armorLv = 3;
      else if (char.属性.等级 >= 70) armorLv = 2;
      else if (char.属性.等级 >= 50) armorLv = 1;

      if (char.属性.邪魂师 && armorLv > 3) {
        armorLv = 3;
      }

      if (armorLv > 0 && !已有明确斗铠) {
        char.装备.斗铠.等级 = armorLv;
        char.装备.斗铠.装备状态 = '未装备';
        取内置角色斗铠部件列表_V1(char).forEach(p => (char.装备.斗铠.部件[p] = { 状态: '完好', 品质系数: 1.0 }));
      }
    } else if (!isBeast && tier === '优秀' && 可初始化机甲 && !已有明确机甲) {
      if (char.属性.等级 >= 70) {
        char.装备.机甲.等级 = '黑级';
        char.装备.机甲.名称 = '黑级机甲';
        char.装备.机甲.型号 = '均衡';
        char.装备.机甲.状态 = '完好';
        char.装备.机甲.装备状态 = '未装备';
      } else if (char.属性.等级 >= 50) {
        char.装备.机甲.等级 = '紫级';
        char.装备.机甲.名称 = '紫级机甲';
        char.装备.机甲.型号 = '均衡';
        char.装备.机甲.状态 = '完好';
        char.装备.机甲.装备状态 = '未装备';
      }
    }

    补齐角色魂骨槽位_V1(char);

    let totalSpirits = 0;
    const genericSkillAge = Math.max(1000, Number(char.属性.等级 || 1) * 200);
    const 恢复增益重复账本缓存 = 创建恢复增益重复账本缓存_V1();
    const 角色路径名 = String(char?.name || char?.base?.name || char?.属性?.姓名 || '角色').trim() || '角色';
    取角色武魂条目_V1(char).forEach(([spiritKey, spiritData]) => {
      if (!(spiritData && typeof spiritData === 'object')) return;
      const 武魂系别 = String(spiritData?.系别 || 取角色主武魂系别_V1(char)).trim() || '强攻系';
      const spiritAttributeState = normalizeSpiritAttributeState(spiritData, spiritKey, char);
      spiritData.属性体系 = spiritAttributeState.属性体系;
      spiritData.可调用元素 = spiritAttributeState.可调用元素;
      const runtimeElementProfile = buildElementProfileFromAttributeState(spiritAttributeState);
      totalSpirits += 取武魂魂灵条目_V1(spiritData).length;
      取武魂魂灵条目_V1(spiritData).forEach(([魂灵键, 武魂]) => {
        syncSoulSpiritRuntimeData(武魂);
        if (Object.prototype.hasOwnProperty.call(武魂, '附机制候选')) delete 武魂.附机制候选;
        const 来源品质 =
          normalizeSoulSpiritQuality(武魂?.品质 || '') ||
          inferSoulSpiritQuality(武魂) ||
          normalizeSoulSpiritQuality(spiritData?.品质 || '') ||
          inferSoulSpiritQuality(spiritData) ||
          '';

        取魂灵魂环条目_V1(武魂).forEach(([ringIndexStr, ring]) => {
          const ringIndex = 读取槽位序号_V1(ringIndexStr, 1);
          const 当前魂环数量 = 计算武魂当前魂环数量_V1(spiritData);
          const 武魂名称 = String(spiritData?.表象名称 || spiritKey || '').trim();
          ensureSkillMapGenerated(Object.fromEntries(取魂环魂技条目_V1(ring)), (_, skillName) => ({
            type: 武魂系别,
            武魂系别,
            角色: char,
            武魂数据: spiritData,
            魂环数据: ring,
            path: `char.${角色路径名}.${spiritKey}.${魂灵键}.${ringIndexStr}.${skillName}`,
            talentTier: char.属性.天赋梯队,
            age: ring.年限,
            ringAge: ring.年限,
            ringIndex,
            当前魂环数量,
            martialSoulName: 武魂名称,
            compatibility: 武魂.契合度 || 100,
            sourceQuality: 来源品质,
            preferredSecondary: [],
            elementProfile: runtimeElementProfile,
            可调用元素: spiritAttributeState.可调用元素,
            callableElements: spiritAttributeState.可调用元素,
            elementTrigger: '继承武魂',
            sourceCategory: '魂技',
            forceTrueBody: ringIndex === 7,
            textContext: {
              spiritName:
                !isAiTodoText(武魂.表象名称) && 武魂.表象名称 !== '未展露'
                  ? 武魂.表象名称
                  : spiritData?.表象名称 || skillName,
              type: 武魂系别,
              spiritDesc: String(武魂?.描述 || '').trim(),
              martialSoulName: 武魂名称,
              soulSpiritName: String(武魂?.表象名称 || '').trim(),
              ringSource: String(ring?.来源 || '').trim(),
            },
          }), { 恢复增益重复账本缓存 });
        });
      });

      取武魂直接魂环条目_V1(spiritData).forEach(([ringIndexStr, ring]) => {
        const ringIndex = 读取槽位序号_V1(ringIndexStr, 1);
        const 当前魂环数量 = 计算武魂当前魂环数量_V1(spiritData);
        const 武魂名称 = String(spiritData?.表象名称 || spiritKey || '').trim();
        const 来源品质 =
          normalizeSoulSpiritQuality(spiritData?.品质 || '') ||
          inferSoulSpiritQuality(spiritData) ||
          '';
        if (ring && typeof ring === 'object' && !String(ring.颜色 || '').trim()) ring.颜色 = getRingColorByAge(ring.年限);
        if (ring && typeof ring === 'object' && Object.prototype.hasOwnProperty.call(ring, '附机制候选')) delete ring.附机制候选;
        ensureSkillMapGenerated(Object.fromEntries(取魂环魂技条目_V1(ring)), (_, skillName) => ({
          type: 武魂系别,
          武魂系别,
          角色: char,
          武魂数据: spiritData,
          魂环数据: ring,
          path: `char.${角色路径名}.${spiritKey}.${ringIndexStr}.${skillName}`,
          talentTier: char.属性.天赋梯队,
          age: ring?.年限,
          ringAge: ring?.年限,
          ringIndex,
          当前魂环数量,
          martialSoulName: 武魂名称,
          compatibility: 100,
          sourceQuality: 来源品质,
          preferredSecondary: [],
          elementProfile: runtimeElementProfile,
          可调用元素: spiritAttributeState.可调用元素,
          callableElements: spiritAttributeState.可调用元素,
          elementTrigger: '继承武魂',
          sourceCategory: '魂技',
          forceTrueBody: ringIndex === 7,
          textContext: {
            spiritName: spiritData?.表象名称 || skillName,
            type: 武魂系别,
            spiritDesc: String(spiritData?.描述 || '').trim(),
            martialSoulName: 武魂名称,
            ringSource: String(ring?.来源 || '').trim(),
          },
        }), { 恢复增益重复账本缓存 });
      });

    });

    const 主武魂系别 = 取角色主武魂系别_V1(char);
    _(char.魂骨 || {}).forEach((bone, bonePart) => {
      ensureSkillMapGenerated(bone?.附带技能, (_, skillName) => ({
        type: 主武魂系别,
        武魂系别: 主武魂系别,
        角色: char,
        path: `char.${角色路径名}.魂骨.${bonePart}.附带技能.${skillName}`,
        talentTier: char.属性.天赋梯队,
        age: bone?.年限 || bone?.age || genericSkillAge,
        ringAge: bone?.年限 || bone?.age || genericSkillAge,
        魂骨年限: bone?.年限 || bone?.age || genericSkillAge,
        ringIndex: 1,
        compatibility: 100,
        passiveMode: true,
        passiveName: skillName,
        preferredSecondary: getBonePreferredSecondary(bonePart),
        sourceCategory: '魂骨技能',
        textContext: {
          spiritName: bone?.名称 || bonePart || skillName,
          type: 主武魂系别,
        },
      }), { 恢复增益重复账本缓存 });
    });

    const customSkillAttributeState = buildCharacterCustomSkillAttributeState(char);
    const customSkillElementProfile = buildElementProfileFromAttributeState(customSkillAttributeState);
    ensureSkillMapGenerated(char.自创魂技, (_, skillName) => ({
      type: 主武魂系别,
      武魂系别: 主武魂系别,
      角色: char,
      path: `char.${角色路径名}.自创魂技.${skillName}`,
      talentTier: char.属性.天赋梯队,
      age: Math.max(1000, genericSkillAge),
      ringAge: Math.max(1000, genericSkillAge),
      ringIndex: Math.max(1, Math.ceil(Number(char.属性.等级 || 1) / 10)),
      compatibility: 100,
      preferredSecondary: [],
      elementProfile: customSkillElementProfile,
      可调用元素: customSkillAttributeState.可调用元素,
      callableElements: customSkillAttributeState.可调用元素,
      elementTrigger: '自创',
      sourceCategory: '自创魂技',
      textContext: {
        spiritName: skillName,
        type: 主武魂系别,
      },
    }), { 恢复增益重复账本缓存 });

    if (!char.血脉之力 || typeof char.血脉之力 !== 'object') char.血脉之力 = {};
    ensureSkillMapGenerated(char.血脉之力?.被动, (_, skillName) => ({
      type: 主武魂系别,
      武魂系别: 主武魂系别,
      角色: char,
      path: `char.${角色路径名}.血脉之力.被动.${skillName}`,
      talentTier: char.属性.天赋梯队,
      age: Math.max(10000, genericSkillAge),
      ringAge: Math.max(10000, genericSkillAge),
      sourceCategory: '血脉技能',
      来源: '血脉技能',
      跳过预算门禁: true,
      血脉技能: true,
      compatibility: 100,
      passiveMode: true,
      passiveName: skillName,
      preferredSecondary: [],
      elementTrigger: '继承血脉',
      textContext: {
        spiritName: char.血脉之力?.血脉 || skillName,
        type: 主武魂系别,
      },
    }), { 恢复增益重复账本缓存 });

    ensureSkillMapGenerated(char.血脉之力?.技能, (_, skillName) => ({
      type: 主武魂系别,
      武魂系别: 主武魂系别,
      角色: char,
      path: `char.${角色路径名}.血脉之力.技能.${skillName}`,
      talentTier: char.属性.天赋梯队,
      age: Math.max(10000, genericSkillAge),
      ringAge: Math.max(10000, genericSkillAge),
      sourceCategory: '血脉技能',
      来源: '血脉技能',
      跳过预算门禁: true,
      血脉技能: true,
      compatibility: 100,
      preferredSecondary: [],
      elementTrigger: '继承血脉',
      textContext: {
        spiritName: char.血脉之力?.血脉 || skillName,
        type: 主武魂系别,
      },
    }), { 恢复增益重复账本缓存 });

    取血脉气血魂环条目_V1(char.血脉之力).forEach(([ringIndexStr, ringData]) => {
      const ringIndex = 读取槽位序号_V1(ringIndexStr, 1);
      if (ringData && typeof ringData === 'object' && !String(ringData.颜色 || '').trim()) ringData.颜色 = '金';
      ensureSkillMapGenerated(Object.fromEntries(取气血魂环魂技条目_V1(ringData)), (_, skillName) => ({
        type: 主武魂系别,
        武魂系别: 主武魂系别,
        角色: char,
        魂环数据: ringData,
        path: `char.${角色路径名}.血脉之力.${ringIndexStr}.${skillName}`,
        talentTier: char.属性.天赋梯队,
        age: Math.max(1000, ringIndex * 5000),
        ringAge: Math.max(1000, ringIndex * 5000),
        ringIndex,
        sourceCategory: '气血魂技',
        来源: '气血魂技',
        跳过预算门禁: true,
        血脉技能: true,
        compatibility: 100,
        preferredSecondary: [],
        elementTrigger: '继承血脉',
        textContext: {
          spiritName: char.血脉之力?.血脉 || skillName,
          type: 主武魂系别,
        },
      }), { 恢复增益重复账本缓存 });
    });

    _(char.武魂融合技 || {}).forEach((fusionData, fusionName) => {
      if (!fusionData || typeof fusionData !== 'object') return;
      fusionData.融合模式 = getNormalizedFusionMode(fusionData);
      fusionData.用法模式 = 获取规范化武魂融合技用法模式(fusionData);
      fusionData.来源武魂 = getNormalizedFusionSourceSpirits(fusionData, char);
      if (fusionData.融合模式 === 'self') fusionData.融合对象 = '无';
      const fusionElementProfile = getFusionSkillElementProfile(fusionData, char);
      ensureSkillStructGenerated(fusionData?.技能数据, {
        type: 主武魂系别,
        武魂系别: 主武魂系别,
        角色: char,
        path: `char.${角色路径名}.武魂融合技.${fusionName}.技能数据`,
        恢复增益重复账本缓存,
        talentTier: char.属性.天赋梯队,
        age: Math.max(10000, genericSkillAge),
        ringAge: Math.max(10000, genericSkillAge),
        ringIndex: Math.max(1, Math.ceil(Number(char.属性.等级 || 1) / 10)),
        compatibility: 100,
        preferredSecondary: [],
        elementProfile: fusionElementProfile,
        可调用元素: fusionElementProfile?.elements || [],
        callableElements: fusionElementProfile?.elements || [],
        elementTrigger: '融合',
        sourceCategory: '武魂融合技',
        来源: '武魂融合技',
        来源类别: '武魂融合技',
        融合技: fusionData,
        融合参与者: fusionData?.融合参与者,
        融合模式: fusionData?.融合模式,
        融合对象: fusionData?.融合对象,
        textContext: {
          spiritName: fusionName,
          type: 主武魂系别,
        },
      });
      ensureFusionSkillMentalCost(fusionData?.技能数据, 0.5);
    });

    const 斗铠计算 = 计算斗铠属性加成_V1(char.装备.斗铠);
    char.装备.斗铠._属性加成 = 斗铠计算.属性加成;
    char.装备.斗铠._已排异 = 斗铠计算.已排异;
    char.装备.机甲._属性加成 = 计算机甲属性加成_V1(char.装备.机甲);

    const armorBonus = char.装备.斗铠?.装备状态 === '已装备' ? char.装备.斗铠?._属性加成 || {} : {};
    const mechBonus = char.装备.机甲?.装备状态 === '已装备' ? char.装备.机甲?._属性加成 || {} : {};
    let boneBonus = { str: 0, def: 0, agi: 0, vit_max: 0, men_max: 0, sp_max: 0 };
    const externalBoneBase = {
      str: final_str,
      def: final_def,
      agi: final_agi,
      vit_max: final_vit_max,
      men_max: final_men_max,
      sp_max: 自然魂力上限,
    };
    let externalBoneBonus = { str: 0, def: 0, agi: 0, vit_max: 0, men_max: 0, sp_max: 0 };

    _(char.魂骨).forEach((bone, part) => {
      if (是外附魂骨记录_V1(bone, part)) {
        const 倍率 = 按品质派生外附魂骨属性倍率_V1(bone?.品质);
        externalBoneBonus.str += Math.floor(externalBoneBase.str * 倍率.力量);
        externalBoneBonus.def += Math.floor(externalBoneBase.def * 倍率.防御);
        externalBoneBonus.agi += Math.floor(externalBoneBase.agi * 倍率.敏捷);
        externalBoneBonus.vit_max += Math.floor(externalBoneBase.vit_max * 倍率.体力上限);
        externalBoneBonus.men_max += Math.floor(externalBoneBase.men_max * 倍率.精神力上限);
        externalBoneBonus.sp_max += Math.floor(externalBoneBase.sp_max * 倍率.魂力上限);
        return;
      }
      if (bone.年限 > 0) {
        let ringBonus = getRingBonus(bone.年限);

        if (part === '躯干魂骨') {
          boneBonus.str += ringBonus.str * 2;
          boneBonus.def += ringBonus.def * 2;
          boneBonus.agi += ringBonus.agi * 2;
          boneBonus.vit_max += ringBonus.vit_max * 2;
          boneBonus.sp_max += ringBonus.sp_max * 2;
        } else if (part === '头部魂骨') {
          boneBonus.men_max += ringBonus.men_max * 2;
        } else if (part === '左腿魂骨' || part === '右腿魂骨') {
          boneBonus.str += ringBonus.str;
          boneBonus.def += ringBonus.def;
          boneBonus.agi += ringBonus.agi * 2;
          boneBonus.vit_max += ringBonus.vit_max;
          boneBonus.men_max += ringBonus.men_max;
          boneBonus.sp_max += ringBonus.sp_max;
        } else if (part === '左臂魂骨' || part === '右臂魂骨') {
          boneBonus.str += ringBonus.str * 2;
          boneBonus.def += ringBonus.def;
          boneBonus.agi += ringBonus.agi;
          boneBonus.vit_max += ringBonus.vit_max;
          boneBonus.men_max += ringBonus.men_max;
          boneBonus.sp_max += ringBonus.sp_max;
        } else {
          boneBonus.str += ringBonus.str;
          boneBonus.def += ringBonus.def;
          boneBonus.agi += ringBonus.agi;
          boneBonus.vit_max += ringBonus.vit_max;
          boneBonus.men_max += ringBonus.men_max;
          boneBonus.sp_max += ringBonus.sp_max;
        }
      }
    });
    let ringTotalBonus = { str: 0, def: 0, agi: 0, vit_max: 0, men_max: 0, sp_max: 0 };
    取角色武魂条目_V1(char).forEach(([, spiritData]) => {
      取武魂全部魂环条目_V1(spiritData).forEach(({ 魂环数据: ring, 魂灵数据: ss }) => {
        let compMult = ss ? Math.max(0.1, (ss.契合度 !== undefined ? ss.契合度 : 100) / 100) : 1;
        if (Number(ring?.年限 || 0) > 0 && !String(ring?.颜色 || '').trim()) {
          ring.颜色 = getRingColorByAge(ring.年限);
        }
        if (ring.年限 > 0) {
          let bonus = getRingBonus(ring.年限);
          ringTotalBonus.str += Math.floor(bonus.str * compMult);
          ringTotalBonus.def += Math.floor(bonus.def * compMult);
          ringTotalBonus.agi += Math.floor(bonus.agi * compMult);
          ringTotalBonus.vit_max += Math.floor(bonus.vit_max * compMult);
          ringTotalBonus.men_max += Math.floor(bonus.men_max * compMult);
          ringTotalBonus.sp_max += Math.floor(bonus.sp_max * compMult);
        }
      });
    });

    const ringBoneSoulPowerBonus = Math.floor(ringTotalBonus.sp_max + boneBonus.sp_max);
    final_str = Math.floor(final_str + ringTotalBonus.str + boneBonus.str);
    final_def = Math.floor(final_def + ringTotalBonus.def + boneBonus.def);
    final_agi = Math.floor(final_agi + ringTotalBonus.agi + boneBonus.agi);
    final_vit_max = Math.floor(final_vit_max + ringTotalBonus.vit_max + boneBonus.vit_max);
    final_men_max = Math.floor(final_men_max + ringTotalBonus.men_max + boneBonus.men_max);
    final_str = Math.floor(final_str + externalBoneBonus.str);
    final_def = Math.floor(final_def + externalBoneBonus.def);
    final_agi = Math.floor(final_agi + externalBoneBonus.agi);
    final_vit_max = Math.floor(final_vit_max + externalBoneBonus.vit_max);
    final_men_max = Math.floor(final_men_max + externalBoneBonus.men_max);

    const goldenDragonPermanentBonus = applyGoldenDragonPermanentBonusNodes(char, {
      力量: final_str,
      防御: final_def,
      敏捷: final_agi,
      体力上限: final_vit_max,
      精神力上限: final_men_max,
      魂力上限: final_sp_max,
    });
    final_str = Math.floor(final_str + goldenDragonPermanentBonus.力量);
    final_def = Math.floor(final_def + goldenDragonPermanentBonus.防御);
    final_agi = Math.floor(final_agi + goldenDragonPermanentBonus.敏捷);
    final_vit_max = Math.floor(final_vit_max + goldenDragonPermanentBonus.体力上限);
    final_men_max = Math.floor(final_men_max + goldenDragonPermanentBonus.精神力上限);
    const 训练魂力上限加成 = Math.max(0, Math.floor(Number(char.属性?.训练加成?.魂力上限 || 0)));
    const 永久魂力来源加成 =
      ringBoneSoulPowerBonus +
      externalBoneBonus.sp_max +
      getPersistentSoulPowerBonusFromPermanentRecords(char) +
      训练魂力上限加成;
    const 修为魂力基底 = Math.max(自然魂力上限, 既有魂力上限 - 永久魂力来源加成);
    final_sp_max = Math.max(1, Math.floor(修为魂力基底 + 永久魂力来源加成));

    const 深渊帝君侧重点 = 读取深渊帝君百级侧重点_V1(char, normalizedCharName || 角色路径名);
    if (深渊帝君侧重点.精神力上限 || 深渊帝君侧重点.魂力上限 || 深渊帝君侧重点.体力上限) {
      const 百级基准 = getBaseStats(100);
      if (深渊帝君侧重点.精神力上限) final_men_max = Math.max(final_men_max, 百级基准.men_max);
      if (深渊帝君侧重点.魂力上限) final_sp_max = Math.max(final_sp_max, 百级基准.sp_max);
      if (深渊帝君侧重点.体力上限) final_vit_max = Math.max(final_vit_max, 百级基准.vit_max);
    }

    const wpnBonus = 计算装备属性加成_V1(char.装备.武器, {
      属性: {
        等级: char.属性.等级,
        力量: final_str,
        防御: final_def,
        敏捷: final_agi,
        体力上限: final_vit_max,
        精神力上限: final_men_max,
        魂力上限: final_sp_max,
      },
    });
    const 防具加成 = char.装备.防具?.装备状态 === '已装备'
      ? 计算装备属性加成_V1(char.装备.防具, {
          属性: {
            等级: char.属性.等级,
            力量: final_str,
            防御: final_def,
            敏捷: final_agi,
            体力上限: final_vit_max,
            精神力上限: final_men_max,
            魂力上限: final_sp_max,
          },
        })
      : {};

    if (final_men_max >= 50000) char.属性.精神境界 = '神元境';
    else if (final_men_max >= 20000) char.属性.精神境界 = '灵域境';
    else if (final_men_max >= 5000) char.属性.精神境界 = '灵渊境';
    else if (final_men_max >= 500) char.属性.精神境界 = '灵海境';
    else if (final_men_max >= 50) char.属性.精神境界 = '灵通境';
    else char.属性.精神境界 = '灵元境';

    char.属性.力量 = Math.floor(final_str + (wpnBonus.力量 || 0) + (防具加成.力量 || 0) + (armorBonus.力量 || 0) + (mechBonus.力量 || 0));
    char.属性.防御 = Math.floor(final_def + (wpnBonus.防御 || 0) + (防具加成.防御 || 0) + (armorBonus.防御 || 0) + (mechBonus.防御 || 0));
    char.属性.敏捷 = Math.floor(final_agi + (wpnBonus.敏捷 || 0) + (防具加成.敏捷 || 0) + (armorBonus.敏捷 || 0) + (mechBonus.敏捷 || 0));
    char.属性.体力上限 = Math.floor(
      final_vit_max + (wpnBonus.体力上限 || 0) + (防具加成.体力上限 || 0) + (armorBonus.体力上限 || 0) + (mechBonus.体力上限 || 0),
    );
    char.属性.HP上限 = Math.max(1, Number(char.属性.体力上限 || 1));
    char.属性.精神力上限 = Math.floor(
      final_men_max + (wpnBonus.精神力上限 || 0) + (防具加成.精神力上限 || 0) + (armorBonus.精神力上限 || 0) + (mechBonus.精神力上限 || 0),
    );
    char.属性.魂力上限 = Math.floor(final_sp_max);
    normalizeStatHpFields(char.属性);
    if (本轮初始化魂师面板) {
      char.属性.魂力 = char.属性.魂力上限;
      char.属性.精神力 = char.属性.精神力上限;
      char.属性.体力 = char.属性.体力上限;
      char.属性.HP = char.属性.HP上限;
    }
    if (!char.属性.状态效果 || typeof char.属性.状态效果 !== 'object') char.属性.状态效果 = {};
    const 魂灵年限总和 = 读取角色魂灵年限总和_V1(char);
    const 魂灵年限上限 = 读取精神力魂灵总年限上限_V1(char.属性.精神力上限);
    if (魂灵年限总和 > 魂灵年限上限) {
      const 超载比例 = Math.max(0, (魂灵年限总和 - 魂灵年限上限) / Math.max(1, 魂灵年限上限));
      const 反噬层数 = Math.max(1, Math.min(10, Math.ceil(超载比例 * 10)));
      const 旧超载层数 = Math.max(0, Math.floor(Number(char.属性.状态效果?.['精神超载']?.层数 || 0)));
      const HP保留比例 = Math.max(0.03, 1 - Math.min(0.97, 0.45 + 超载比例 * 1.4));
      const 精神保留比例 = Math.max(0, 1 - Math.min(1, 0.7 + 超载比例 * 1.8));
      char.属性.HP = Math.min(Math.max(0, Number(char.属性.HP || 0)), Math.max(1, Math.floor(char.属性.HP上限 * HP保留比例)));
      char.属性.体力 = Math.min(Math.max(0, Number(char.属性.体力 || 0)), Math.max(1, Math.floor(char.属性.体力上限 * HP保留比例)));
      char.属性.精神力 = Math.min(Math.max(0, Number(char.属性.精神力 || 0)), Math.floor(char.属性.精神力上限 * 精神保留比例));
      char.属性.状态效果['精神超载'] = {
        类型: 'debuff',
        层数: 反噬层数,
        描述: `魂灵年限总和${魂灵年限总和}超过精神力承载上限${魂灵年限上限}，魂灵反噬压制生命、体力与精神力。`,
        持续回合: 99,
        战斗效果: { 持续伤害: 0, 跳过回合: 反噬层数 >= 8, 破防比例: Math.min(0.5, 0.08 * 反噬层数) },
      };
      if (反噬层数 !== 旧超载层数) {
        const 反噬结果 = 反噬层数 >= 8
          ? '当场昏迷，生命体征跌至濒危线'
          : 反噬层数 >= 5
            ? '精神识海重创，陷入昏迷'
            : 反噬层数 >= 3
              ? '精神识海撕裂，身体重创'
              : '精神震荡，气血逆冲';
        记录角色归一化播报事件_V1(
          normalizedCharName,
          `[精神超载反噬] ${normalizedCharName || '角色'} 魂灵年限总和${魂灵年限总和}超过精神力承载上限${魂灵年限上限}，${反噬结果}！`,
        );
      }
    } else {
      delete char.属性.状态效果['精神超载'];
    }

    let rep = char.社交.声望 || 0;
    if (rep >= 10000) char.社交.名望等级 = '举世无双';
    else if (rep >= 5000) char.社交.名望等级 = '名动联邦';
    else if (rep >= 2000) char.社交.名望等级 = '威震一方';
    else if (rep >= 500) char.社交.名望等级 = '声名鹊起';
    else if (rep >= 100) char.社交.名望等级 = '初露锋芒';
    else char.社交.名望等级 = '籍籍无名';
    if (char.装备.斗铠?._已排异) {
      if (!char.属性.状态效果['回路冲突']) {
        char.属性.状态效果['回路冲突'] = {
          类型: 'debuff',
          层数: 1,
          描述: '斗铠各部件材质品质差距过大，能量回路产生排斥，气血不畅！',
          持续回合: 99,
          面板倍率: { 力量: 0.9, 防御: 0.9, 敏捷: 0.9, 魂力上限: 0.9 },
          战斗效果: { 持续伤害: 0, 跳过回合: false, 破防比例: 0 },
        };
      }
    } else {
      delete char.属性.状态效果['回路冲突'];
    }

    char.属性.体力 = Math.min(char.属性.体力, char.属性.体力上限);
    char.属性.魂力 = Math.min(char.属性.魂力, char.属性.魂力上限);
    char.属性.精神力 = Math.min(char.属性.精神力, char.属性.精神力上限);
    delete char.复制技能;

 const gender = String(char.属性?.性别 || '');
    if (!gender.includes('女') && !gender.includes('待补全')) {
      delete char.私密档案;
    }

    标记本轮等级上升();
    return char;
  
}

function 规范化商店库存项Schema_V1(库存项) {
                                库存项.批次 = (Array.isArray(库存项.批次) ? 库存项.批次 : [])
                                  .map(批次 => {
                                    if (!批次 || typeof 批次 !== 'object' || Array.isArray(批次)) return null;
                                    const 输出 = {
                                      数量: Math.max(0, Math.floor(Number(批次.数量 || 0))),
                                    };
                                    if (批次.品质 !== undefined) 输出.品质 = 规范化物品经济品质_V1(批次.品质);
                                    if (批次.品质系数 !== undefined) 输出.品质系数 = Math.max(0.1, Math.min(2, Number(批次.品质系数 || 1)));
                                    if (String(批次.基础金属 || '').trim()) 输出.基础金属 = String(批次.基础金属 || '').trim();
                                    if (批次.魂导等级 !== undefined) 输出.魂导等级 = Math.max(0, Math.min(12, Math.floor(Number(批次.魂导等级 || 0))));
                                    if (批次.耐久 !== undefined) 输出.耐久 = Math.max(0, Math.floor(Number(批次.耐久 || 0)));
                                    if (批次.剩余使用次数 !== undefined) 输出.剩余使用次数 = Math.max(0, Math.floor(Number(批次.剩余使用次数 || 0)));
                                    if (批次.使用次数恢复至tick !== undefined) 输出.使用次数恢复至tick = Math.max(0, Math.floor(Number(批次.使用次数恢复至tick || 0)));
                                    if (批次.基础耐久 !== undefined) 输出.基础耐久 = Math.max(0, Math.floor(Number(批次.基础耐久 || 0)));
                                    if (批次.基础使用次数 !== undefined) 输出.基础使用次数 = Math.max(0, Math.floor(Number(批次.基础使用次数 || 0)));
                                    if (批次.绑定者 !== undefined) 输出.绑定者 = String(批次.绑定者 || '无').trim() || '无';
                                    if (批次.有效期至tick !== undefined) 输出.有效期至tick = Math.max(0, Math.floor(Number(批次.有效期至tick || 0)));
                                    const 原始融合参数 = 批次?.副职业参数?.融合参数;
                                    if (
                                      原始融合参数 &&
                                      typeof 原始融合参数 === 'object' &&
                                      !Array.isArray(原始融合参数) &&
                                      (原始融合参数.数量 !== undefined || 原始融合参数.融合率 !== undefined)
                                    ) {
                                      输出.副职业参数 = {
                                        融合参数: {
                                          数量: Math.max(1, Math.floor(Number(原始融合参数.数量 || 1))),
                                          融合率: Math.max(0, Math.min(100, Math.floor(Number(原始融合参数.融合率 ?? 100)))),
                                        },
                                      };
                                    }
                                    Object.keys(输出).forEach(键 => {
                                      const 值 = 输出[键];
                                      if (
                                        键 !== '数量' &&
                                        (值 === '' ||
                                          (值 === 0 && !(键 === '剩余使用次数' && Number(输出.使用次数恢复至tick || 0) > 0)) ||
                                          值 === '无' ||
                                          (键 === '品质' && 值 === '普通') ||
                                          (键 === '品质系数' && Number(值) === 1) ||
                                          (Array.isArray(值) && !值.length) ||
                                          (值 && typeof 值 === 'object' && !Array.isArray(值) && !Object.keys(值).length))
                                      ) delete 输出[键];
                                    });
                                    return 输出;
                                  })
                                  .filter(批次 => 批次 && Number(批次.数量 || 0) > 0);
                                if (!库存项.批次.length) delete 库存项.批次;
                                return 库存项;
                              
}

function 规范化动态地点Schema_V1(地点数据) {
            _(地点数据).forEach((locData, locName) => {
              if (locData.x === -1 || locData.y === -1) {
                const siblingCoords = new Set();
                _(地点数据).forEach(otherLoc => {
                  if (otherLoc.归属父节点 === locData.归属父节点 && otherLoc.x !== -1 && otherLoc.y !== -1) {
                    siblingCoords.add(`${otherLoc.x},${otherLoc.y}`);
                  }
                });
                let newX, newY;
                let isDuplicate = true;
                let attempts = 0;
                while (isDuplicate && attempts < 100) {
                  newX = Math.floor(Math.random() * 3100);
                  newY = Math.floor(Math.random() * 2200);
                  if (!siblingCoords.has(`${newX},${newY}`)) {
                    isDuplicate = false;
                  }
                  attempts++;
                }

                locData.x = newX;
                locData.y = newY;
                siblingCoords.add(`${newX},${newY}`);
              }
            });
            return 地点数据;
          
}

function 克隆普通数据_V1(值, 兜底 = null) {
  try {
    return structuredClone(值);
  } catch (错误) {}
  try {
    return JSON.parse(JSON.stringify(值));
  } catch (错误) {}
  return 兜底;
}

function 补结算归档角色时间流逝_V1(角色名 = '', 角色数据 = {}, 数据根 = {}, 起始tick = 0, 结束tick = null) {
  const 安全角色名 = String(角色名 || '').trim();
  if (!安全角色名 || !角色数据 || typeof 角色数据 !== 'object' || Array.isArray(角色数据)) return 角色数据;
  const 当前tick = Math.max(0, Math.floor(Number(结束tick ?? 数据根?.world?.时间?.tick ?? 0) || 0));
  const 归档tick = Math.max(0, Math.floor(Number(起始tick || 0) || 0));
  if (当前tick <= 归档tick) return 克隆普通数据_V1(角色数据, 角色数据);

  const 临时根 = 克隆普通数据_V1(数据根 && typeof 数据根 === 'object' && !Array.isArray(数据根) ? 数据根 : {}, {});
  临时根.char = { [安全角色名]: 克隆普通数据_V1(角色数据, {}) };
  if (!临时根.world || typeof 临时根.world !== 'object' || Array.isArray(临时根.world)) 临时根.world = {};
  if (!临时根.world.时间 || typeof 临时根.world.时间 !== 'object' || Array.isArray(临时根.world.时间)) 临时根.world.时间 = {};
  临时根.world.时间.tick = 当前tick;
  临时根.world.时间._上次结算tick = 归档tick;
  规范化Schema根转换_V1(临时根);
  return 临时根.char?.[安全角色名] && typeof 临时根.char[安全角色名] === 'object'
    ? 克隆普通数据_V1(临时根.char[安全角色名], 临时根.char[安全角色名])
    : 克隆普通数据_V1(角色数据, 角色数据);
}

function 按动作模式结算变量根时间流逝_V1(数据根 = {}, 角色名 = '', 起始tick = 0, 结束tick = null, 结算模式 = '') {
  const 临时根 = 克隆普通数据_V1(数据根 && typeof 数据根 === 'object' && !Array.isArray(数据根) ? 数据根 : {}, {});
  if (!临时根.world || typeof 临时根.world !== 'object' || Array.isArray(临时根.world)) 临时根.world = {};
  if (!临时根.world.时间 || typeof 临时根.world.时间 !== 'object' || Array.isArray(临时根.world.时间)) 临时根.world.时间 = {};
  const 当前tick = Math.max(0, Math.floor(Number(结束tick ?? 临时根.world.时间.tick ?? 0) || 0));
  const 起始tick值 = Math.max(0, Math.floor(Number(起始tick || 0) || 0));
  临时根.world.时间.tick = 当前tick;
  临时根.world.时间._上次结算tick = 起始tick值;
  const 安全角色名 = String(角色名 || '').trim();
  const 临时结算模式 = String(结算模式 || '').trim();
  if (安全角色名 && 临时结算模式) 临时根.world.时间._临时角色结算模式 = { [安全角色名]: 临时结算模式 };
  规范化Schema根转换_V1(临时根);
  return 克隆普通数据_V1(临时根, 临时根);
}

globalThis.__LWCS_MVU_SCHEMA_RUNTIME__ = {
  ...(globalThis.__LWCS_MVU_SCHEMA_RUNTIME__ && typeof globalThis.__LWCS_MVU_SCHEMA_RUNTIME__ === 'object'
    ? globalThis.__LWCS_MVU_SCHEMA_RUNTIME__
    : {}),
  补结算归档角色时间流逝: 补结算归档角色时间流逝_V1,
  按动作模式结算变量根时间流逝: 按动作模式结算变量根时间流逝_V1,
  收集内置角色成长技能模板触发: 收集内置角色成长技能模板触发_V1,
  应用内置角色成长技能模板记录: 应用内置角色成长技能模板记录_V1,
  计算装备属性加成: 计算装备属性加成_V1,
  应用永久属性提升: 应用永久属性提升_V1,
  读取内置势力库: 读取内置势力库_V1,
  读取内置地点库: 读取内置地点库_V1,
  应用内置势力实例化: 应用内置势力实例化_V1,
  应用内置地点实例化: 应用内置地点实例化_V1,
};

try {
  if (globalThis.parent && globalThis.parent !== globalThis) {
    globalThis.parent.__LWCS_MVU_SCHEMA_RUNTIME__ = {
      ...(globalThis.parent.__LWCS_MVU_SCHEMA_RUNTIME__ && typeof globalThis.parent.__LWCS_MVU_SCHEMA_RUNTIME__ === 'object'
        ? globalThis.parent.__LWCS_MVU_SCHEMA_RUNTIME__
        : {}),
      补结算归档角色时间流逝: 补结算归档角色时间流逝_V1,
      按动作模式结算变量根时间流逝: 按动作模式结算变量根时间流逝_V1,
      收集内置角色成长技能模板触发: 收集内置角色成长技能模板触发_V1,
      应用内置角色成长技能模板记录: 应用内置角色成长技能模板记录_V1,
      计算装备属性加成: 计算装备属性加成_V1,
      应用永久属性提升: 应用永久属性提升_V1,
      读取内置势力库: 读取内置势力库_V1,
      读取内置地点库: 读取内置地点库_V1,
      应用内置势力实例化: 应用内置势力实例化_V1,
      应用内置地点实例化: 应用内置地点实例化_V1,
    };
  }
} catch (错误) {}

try {
  if (globalThis.top && globalThis.top !== globalThis) {
    globalThis.top.__LWCS_MVU_SCHEMA_RUNTIME__ = {
      ...(globalThis.top.__LWCS_MVU_SCHEMA_RUNTIME__ && typeof globalThis.top.__LWCS_MVU_SCHEMA_RUNTIME__ === 'object'
        ? globalThis.top.__LWCS_MVU_SCHEMA_RUNTIME__
        : {}),
      补结算归档角色时间流逝: 补结算归档角色时间流逝_V1,
      按动作模式结算变量根时间流逝: 按动作模式结算变量根时间流逝_V1,
      收集内置角色成长技能模板触发: 收集内置角色成长技能模板触发_V1,
      应用内置角色成长技能模板记录: 应用内置角色成长技能模板记录_V1,
      计算装备属性加成: 计算装备属性加成_V1,
      应用永久属性提升: 应用永久属性提升_V1,
      读取内置势力库: 读取内置势力库_V1,
      读取内置地点库: 读取内置地点库_V1,
      应用内置势力实例化: 应用内置势力实例化_V1,
      应用内置地点实例化: 应用内置地点实例化_V1,
    };
  }
} catch (错误) {}

const MVU_ZOD_ENTRY_BASE_V1 = new URL('./', import.meta.url);
const MVU_ZOD_RESOURCE_TIMEOUT_MS_V1 = 6500;
const MVU追踪模块顺序_V1 = Object.freeze([
  'MVU_ZOD_Entry.js',
  'LibraryData_Runtime.js',
  'FactionLibrary.js',
  'LocationLibrary.js',
  'MVU_Skill_Runtime.js',
  'MVU_Schema_Runtime.js',
  'MVU_Competition_Runtime.js',
  'MVU_Runtime_View.js',
  'MVU.js',
  'MVU_Hooks.js',
  'timeline.js',
  'IntelEvents.js',
]);
const MVU共享宿主窗口_V1 = (() => {
  try {
    if (globalThis.parent && globalThis.parent !== globalThis && globalThis.parent.document) return globalThis.parent;
  } catch (错误) {}
  return globalThis;
})();
const MVU共享启动状态_V1 = (() => {
  const 键 = '__LWCS_REMOTE_BOOTSTRAP_STATE__';
  const 已有状态 = MVU共享宿主窗口_V1[键];
  if (已有状态 && typeof 已有状态 === 'object') return 已有状态;
  const 新状态 = {
    commitPromise: null,
    commit: '',
    resourceBases: [],
    mvuStatus: 'loading',
    mvuStage: 'MVU 入口执行中',
    mvuModules: [],
    mvuTrackingComplete: false,
    uiStatus: 'idle',
  };
  MVU共享宿主窗口_V1[键] = 新状态;
  return 新状态;
})();

function 发布MVU模块状态_V1(名称, 状态, 阶段, 错误 = '') {
  const 状态表 = new Map(
    (Array.isArray(MVU共享启动状态_V1.mvuModules) ? MVU共享启动状态_V1.mvuModules : [])
      .map(项目 => [项目.名称, { ...项目 }])
  );
  MVU追踪模块顺序_V1.forEach(模块名 => {
    if (!状态表.has(模块名)) 状态表.set(模块名, { 名称: 模块名, 状态: 'pending', 阶段: '等待', 错误: '' });
  });
  状态表.set(名称, { 名称, 状态, 阶段, 错误 });
  MVU共享启动状态_V1.mvuStage = 阶段;
  MVU共享启动状态_V1.mvuModules = MVU追踪模块顺序_V1.map(模块名 => 状态表.get(模块名));
  MVU共享启动状态_V1.mvuTrackingComplete = MVU共享启动状态_V1.mvuModules.every(项目 =>
    ['loaded', 'degraded', 'failed'].includes(项目.状态)
  );
  try {
    MVU共享宿主窗口_V1.__LWCS_加载追踪器__?.更新MVU快照?.({
      阶段,
      模块列表: MVU共享启动状态_V1.mvuModules,
      全部完成: MVU共享启动状态_V1.mvuTrackingComplete,
    });
  } catch (追踪错误) {}
}

发布MVU模块状态_V1('MVU_ZOD_Entry.js', 'loading', '执行中');
const MVU_ZOD_ENTRY_BASE_CANDIDATES_V1 = (() => {
  const 候选原值 = globalThis.__LWCS_MVU_资源基础地址候选列表__;
  const 候选列表 = Array.isArray(候选原值) ? 候选原值 : [];
  const 清理地址 = 地址 => {
    const 文本 = String(地址 || '').trim();
    if (!文本) return '';
    return 文本.endsWith('/') ? 文本 : `${文本}/`;
  };
  return [MVU_ZOD_ENTRY_BASE_V1.href, ...候选列表.map(清理地址)].filter((地址, 序号, 列表) => 地址 && 列表.indexOf(地址) === 序号);
})();

function 是MVU提交哈希资源地址_V1(地址) {
  return /\/gh\/[^?#]+@[0-9a-f]{40}(?:\/|$)/i.test(String(地址 || ''));
}

function 取MVU资源请求选项_V1(地址) {
  return { cache: 是MVU提交哈希资源地址_V1(地址) ? 'force-cache' : 'no-store' };
}

function MVU请求超时_V1(承诺, 标签, 超时毫秒 = MVU_ZOD_RESOURCE_TIMEOUT_MS_V1, 超时回调 = null) {
  return new Promise((resolve, reject) => {
    let 已结束 = false;
    const 结束 = (成功, 结果) => {
      if (已结束) return;
      已结束 = true;
      clearTimeout(超时器);
      if (成功) resolve(结果);
      else reject(结果);
    };
    const 超时器 = setTimeout(() => {
      try {
        if (typeof 超时回调 === 'function') 超时回调();
      } catch (错误) {}
      结束(false, new Error(`${标签} 超时:${超时毫秒}ms`));
    }, 超时毫秒);
    Promise.resolve(承诺).then(
      结果 => 结束(true, 结果),
      错误 => 结束(false, 错误),
    );
  });
}

function MVU_FETCH_V1(地址) {
  const 请求选项 = 取MVU资源请求选项_V1(地址);
  let 控制器 = null;
  if (typeof AbortController === 'function') {
    控制器 = new AbortController();
    请求选项.signal = 控制器.signal;
  }
  return MVU请求超时_V1(fetch(地址, 请求选项), `读取 ${地址}`, MVU_ZOD_RESOURCE_TIMEOUT_MS_V1, () => {
    if (控制器) 控制器.abort();
  });
}

function 构建MVU候选资源地址列表_V1(文件名) {
  return MVU_ZOD_ENTRY_BASE_CANDIDATES_V1.map(基础地址 => {
    const 地址 = new URL(文件名, 基础地址).href;
    return 是MVU提交哈希资源地址_V1(地址) ? 地址 : `${地址}?t=${Date.now()}`;
  });
}

async function 导入MVU候选模块_V1(文件名) {
  const 错误列表 = [];
  for (const 地址 of 构建MVU候选资源地址列表_V1(文件名)) {
    try {
      return await MVU请求超时_V1(import(地址), `导入 ${地址}`);
    } catch (错误) {
      错误列表.push(`${地址} ${错误 && 错误.message ? 错误.message : String(错误 || 'unknown_error')}`);
    }
  }
  throw new Error(`MVU模块导入失败：${文件名} ${错误列表.join(' | ')}`);
}

const MVU数据源加载状态_V1 = globalThis.__LWCS_MVU_数据源加载状态__ || {
  时间线开始时间: 0,
  时间线完成时间: 0,
  时间线错误: '',
  情报开始时间: 0,
  情报完成时间: 0,
  情报错误: '',
};

function 同步MVU全局字段_V1(字段名, 字段值) {
  globalThis[字段名] = 字段值;
  try { if (globalThis.parent && globalThis.parent !== globalThis) globalThis.parent[字段名] = 字段值; } catch (错误) {}
  try { if (globalThis.top && globalThis.top !== globalThis) globalThis.top[字段名] = 字段值; } catch (错误) {}
}

同步MVU全局字段_V1('__LWCS_MVU_数据源加载状态__', MVU数据源加载状态_V1);

async function 加载MVU数据源模块_V1(文件名, 导出名, 开始字段, 完成字段, 错误字段) {
  MVU数据源加载状态_V1[开始字段] = Date.now();
  MVU数据源加载状态_V1[错误字段] = '';
  发布MVU模块状态_V1(文件名, 'loading', '下载并执行');
  try {
    const 模块 = await 导入MVU候选模块_V1(文件名);
    const 数据源 = 模块 && 模块[导出名] ? 模块[导出名] : {};
    同步MVU全局字段_V1(导出名, 数据源);
    MVU数据源加载状态_V1[完成字段] = Date.now();
    MVU数据源加载状态_V1[错误字段] = '';
    发布MVU模块状态_V1(文件名, 'loaded', '完成');
    return 数据源;
  } catch (错误) {
    const 错误文本 = 错误 && 错误.message ? 错误.message : String(错误 || 'unknown_error');
    MVU数据源加载状态_V1[错误字段] = 错误文本;
    发布MVU模块状态_V1(文件名, 'degraded', '降级', 错误文本);
    console.warn(`[LWCS] MVU数据源加载失败：${文件名}`, 错误);
    return {};
  }
}

async function 加载MVU经典依赖_V1(文件名, 已就绪 = () => false) {
  const 文档 = globalThis.document;
  if (!文档 || !文档.createElement) throw new Error(`MVU依赖加载缺少document：${文件名}`);
  const 标记 = `lwcs-mvu-zod-entry-${文件名.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const 旧脚本 = 文档.getElementById(标记);
  if (旧脚本) 旧脚本.remove();
  const 错误列表 = [];
  let 地址 = '';
  let 代码文本 = '';
  发布MVU模块状态_V1(文件名, 'loading', '下载中');
  for (const 候选地址 of 构建MVU候选资源地址列表_V1(文件名)) {
    try {
      const 响应 = await MVU_FETCH_V1(候选地址);
      if (!响应.ok) throw new Error(`[${响应.status}]`);
      地址 = 候选地址;
      代码文本 = await 响应.text();
      break;
    } catch (错误) {
      错误列表.push(`${候选地址} ${错误 && 错误.message ? 错误.message : String(错误 || 'unknown_error')}`);
    }
  }
  if (!代码文本) {
    const 错误 = new Error(`MVU依赖加载失败：${文件名} ${错误列表.join(' | ')}`);
    发布MVU模块状态_V1(文件名, 'failed', '失败', 错误.message);
    throw 错误;
  }
  发布MVU模块状态_V1(文件名, 'loading', '执行中');
  try {
    const 脚本 = 文档.createElement('script');
    脚本.id = 标记;
    脚本.text = `${代码文本}\n//# sourceURL=${地址}`;
    (文档.body || 文档.documentElement).appendChild(脚本);
    if (!已就绪()) throw new Error(`MVU依赖未暴露预期接口：${文件名}`);
    发布MVU模块状态_V1(文件名, 'loaded', '完成');
  } catch (错误) {
    发布MVU模块状态_V1(文件名, 'failed', '失败', 错误 && 错误.message ? 错误.message : String(错误 || 'unknown_error'));
    throw 错误;
  }
}

async function 确保库数据运行时_V1() {
  const 宿主 = MVU共享宿主窗口_V1;
  const 就绪 = 宿主.__LWCS_LIBRARY_DATA_RUNTIME_V1__ || globalThis.__LWCS_LIBRARY_DATA_RUNTIME_V1__;
  if (就绪 && 就绪.version === '1.0.0') return 就绪;
  const 已有加载 = 宿主.__LWCS_LIBRARY_DATA_RUNTIME_LOADING_V1__ || globalThis.__LWCS_LIBRARY_DATA_RUNTIME_LOADING_V1__;
  if (已有加载 && typeof 已有加载.then === 'function') return await 已有加载;
  const 文档 = 宿主.document || globalThis.document;
  if (!文档 || !文档.createElement) throw new Error('LibraryData_Runtime加载缺少document');
  const 加载承诺 = (async () => {
    发布MVU模块状态_V1('LibraryData_Runtime.js', 'loading', '下载并执行');
    const 错误列表 = [];
    let 地址 = '';
    let 代码文本 = '';
    for (const 候选地址 of 构建MVU候选资源地址列表_V1('LibraryData_Runtime.js')) {
      try {
        const 响应 = await MVU_FETCH_V1(候选地址);
        if (!响应.ok) throw new Error(`[${响应.status}]`);
        地址 = 候选地址;
        代码文本 = await 响应.text();
        break;
      } catch (错误) {
        错误列表.push(`${候选地址} ${错误 && 错误.message ? 错误.message : String(错误 || 'unknown_error')}`);
      }
    }
    if (!代码文本) throw new Error(`LibraryData_Runtime加载失败：${错误列表.join(' | ')}`);
    const 标记 = 'lwcs-library-data-runtime-v1';
    文档.getElementById(标记)?.remove();
    const 脚本 = 文档.createElement('script');
    脚本.id = 标记;
    脚本.text = `${代码文本}\n//# sourceURL=${地址}`;
    (文档.body || 文档.documentElement).appendChild(脚本);
    const 运行时 = 宿主.__LWCS_LIBRARY_DATA_RUNTIME_V1__ || globalThis.__LWCS_LIBRARY_DATA_RUNTIME_V1__;
    if (!运行时 || 运行时.version !== '1.0.0') throw new Error('LibraryData_Runtime未暴露1.0.0接口');
    发布MVU模块状态_V1('LibraryData_Runtime.js', 'loaded', '完成');
    return 运行时;
  })();
  宿主.__LWCS_LIBRARY_DATA_RUNTIME_LOADING_V1__ = 加载承诺;
  globalThis.__LWCS_LIBRARY_DATA_RUNTIME_LOADING_V1__ = 加载承诺;
  try {
    return await 加载承诺;
  } catch (错误) {
    if (宿主.__LWCS_LIBRARY_DATA_RUNTIME_LOADING_V1__ === 加载承诺) delete 宿主.__LWCS_LIBRARY_DATA_RUNTIME_LOADING_V1__;
    if (globalThis.__LWCS_LIBRARY_DATA_RUNTIME_LOADING_V1__ === 加载承诺) delete globalThis.__LWCS_LIBRARY_DATA_RUNTIME_LOADING_V1__;
    发布MVU模块状态_V1('LibraryData_Runtime.js', 'failed', '失败', 错误 && 错误.message ? 错误.message : String(错误 || 'unknown_error'));
    throw 错误;
  }
}

if (typeof waitGlobalInitialized === 'function') await waitGlobalInitialized('Mvu');
if (typeof eventOn !== 'function') throw new Error('MVU_ZOD_Entry 需要酒馆助手 eventOn 接口');

await 确保库数据运行时_V1();
const MVU执行上下文库运行时_V1 = MVU共享宿主窗口_V1.__LWCS_LIBRARY_DATA_RUNTIME_V1__ || globalThis.__LWCS_LIBRARY_DATA_RUNTIME_V1__;
if (MVU执行上下文库运行时_V1) globalThis.__LWCS_LIBRARY_DATA_RUNTIME_V1__ = MVU执行上下文库运行时_V1;
await 加载MVU经典依赖_V1('FactionLibrary.js', () => {
  const 势力库 = MVU共享宿主窗口_V1.__LWCS_内置势力库__ || globalThis.__LWCS_内置势力库__;
  return !!势力库
    && 势力库.版本 === 1
    && 势力库.势力
    && typeof 势力库.势力 === 'object';
});
await 加载MVU经典依赖_V1('LocationLibrary.js', () => {
  const 地点库 = MVU共享宿主窗口_V1.__LWCS_内置地点库__ || globalThis.__LWCS_内置地点库__;
  return !!地点库
    && 地点库.版本 === 1
    && 地点库.地点
    && typeof 地点库.地点 === 'object';
});
await 加载MVU数据源模块_V1('timeline.js', 'TimelineEvents', '时间线开始时间', '时间线完成时间', '时间线错误');
await 加载MVU数据源模块_V1('IntelEvents.js', 'IntelEvents', '情报开始时间', '情报完成时间', '情报错误');

await 加载MVU经典依赖_V1('MVU_Skill_Runtime.js', () =>
  typeof 角色穿搭上装待补全文案_V1 === 'string' &&
  typeof globalThis.__LWCS_INITIALIZE_SKILL_EFFECTS__ === 'function' &&
  typeof 创建空魂导器装配表_V1 === 'function' &&
  globalThis.__LWCS_SKILL_MECHANISM_REGISTRY__ &&
  typeof globalThis.__LWCS_SKILL_MECHANISM_REGISTRY__ === 'object' &&
  globalThis.__LWCS_PROFESSION_DERIVATION__ &&
  typeof globalThis.__LWCS_PROFESSION_DERIVATION__.派生运行时 === 'function' &&
  typeof globalThis.__LWCS_COMPILE_SKILL_STRUCTURE_TEXT__ === 'function' &&
  globalThis.__LWCS_SKILL_COST_HELPERS_V1__ &&
  typeof globalThis.__LWCS_SKILL_COST_HELPERS_V1__ === 'object' &&
  typeof globalThis.__LWCS_CALC_DIRECT_SETTLE_BUDGET__ === 'function' &&
  typeof globalThis.__LWCS_ASSERT_DIRECT_SETTLE_BUDGET__ === 'function' &&
  typeof globalThis.__LWCS_GET_BASE_STATS__ === 'function' &&
  typeof globalThis.__LWCS_CALC_ACTIVE_EQUIPMENT_BONUS__ === 'function'
);

await 加载MVU经典依赖_V1('MVU_Schema_Runtime.js', () =>
  typeof markPlayerCharacterInSchemaInput === 'function' &&
  typeof 规范化技能结构Schema_V1 === 'function' &&
  typeof 规范化装备Schema_V1 === 'function' &&
  typeof 规范化角色Schema_V1 === 'function' &&
  typeof 规范化Schema根转换_V1 === 'function'
);

await 加载MVU经典依赖_V1('MVU_Competition_Runtime.js', () =>
  globalThis.__LWCS_COMPETITION_PRIVILEGE_RUNTIME__ &&
  typeof globalThis.__LWCS_COMPETITION_PRIVILEGE_RUNTIME__.生成项目对局 === 'function' &&
  typeof globalThis.__LWCS_COMPETITION_PRIVILEGE_RUNTIME__.计算购买支付比例 === 'function'
);

await 加载MVU经典依赖_V1('MVU_Runtime_View.js', () => {
  const 运行时视图 = globalThis.__LWCS_MVU_RUNTIME_VIEW__;
  const 必需方法 = [
    '替换MVU运行时视图占位符',
    '生成MVU剧情视图',
    '生成MVU相互可见性视图',
    '生成场景背景角色补充',
    '生成场景候选角色资料',
    '生成场景审计材料',
    '生成角色基础六维对标摘要',
  ];
  const 错误状态 = globalThis.__LWCS_MVU_RUNTIME_VIEW_ERROR__;
  if (错误状态?.错误列表?.length) {
    throw new Error(`MVU运行时视图接口注册失败：${错误状态.错误列表.map(项目 => 项目.错误 || 'unknown_error').join('；')}`);
  }
  return !!运行时视图
    && typeof 运行时视图 === 'object'
    && 必需方法.every(方法名 => typeof 运行时视图[方法名] === 'function');
});

发布MVU模块状态_V1('MVU.js', 'loading', '下载并执行');
try {
  await 导入MVU候选模块_V1('MVU.js');
  发布MVU模块状态_V1('MVU.js', 'loaded', '完成');
} catch (错误) {
  发布MVU模块状态_V1('MVU.js', 'failed', '失败', 错误 && 错误.message ? 错误.message : String(错误 || 'unknown_error'));
  throw 错误;
}

globalThis.__LWCS_MVU变量结构已注册__ = true;

await 加载MVU经典依赖_V1('MVU_Hooks.js', () =>
  typeof globalThis.__LWCS_NORMALIZE_MVU_STAT_DATA__ === 'function' &&
  typeof globalThis.__LWCS_NORMALIZE_JSON_PATCH_OPS__ === 'function' &&
  typeof globalThis.__LWCS_PREPROCESS_JSON_PATCH_TEXT__ === 'function'
);

发布MVU模块状态_V1('MVU_ZOD_Entry.js', 'loaded', '完成');

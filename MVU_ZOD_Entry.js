const MVU_ZOD_ENTRY_BASE_V1 = new URL('./', import.meta.url);

async function 加载MVU经典依赖_V1(文件名, 已就绪 = () => false) {
  const 文档 = globalThis.document;
  if (!文档 || !文档.createElement) throw new Error(`MVU依赖加载缺少document：${文件名}`);
  const 地址 = new URL(文件名, MVU_ZOD_ENTRY_BASE_V1).href;
  const 标记 = `lwcs-mvu-zod-entry-${文件名.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const 旧脚本 = 文档.getElementById(标记);
  if (旧脚本) 旧脚本.remove();
  const 响应 = await fetch(地址, { cache: 'no-store' });
  if (!响应.ok) throw new Error(`MVU依赖加载失败：${文件名} [${响应.status}]`);
  const 代码文本 = await 响应.text();
  const 脚本 = 文档.createElement('script');
  脚本.id = 标记;
  脚本.text = `${代码文本}\n//# sourceURL=${地址}`;
  (文档.body || 文档.documentElement).appendChild(脚本);
  if (!已就绪()) throw new Error(`MVU依赖未暴露预期接口：${文件名}`);
}

if (typeof waitGlobalInitialized === 'function') await waitGlobalInitialized('Mvu');
if (typeof eventOn !== 'function') throw new Error('MVU_ZOD_Entry 需要酒馆助手 eventOn 接口');

await 加载MVU经典依赖_V1('MVU_Skill_Runtime.js', () =>
  typeof 角色穿搭上装待补全文案_V1 === 'string' &&
  typeof 初始化补齐角色技能效果数组_V1 === 'function' &&
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

await 加载MVU经典依赖_V1('MVU_Runtime_View.js', () =>
  globalThis.__LWCS_MVU_RUNTIME_VIEW__ &&
  typeof globalThis.__LWCS_MVU_RUNTIME_VIEW__ === 'object'
);

await import(`${new URL('MVU.js', MVU_ZOD_ENTRY_BASE_V1).href}?t=${Date.now()}`);

globalThis.__LWCS_MVU变量结构已注册__ = true;

await 加载MVU经典依赖_V1('MVU_Hooks.js', () =>
  typeof globalThis.__LWCS_NORMALIZE_MVU_STAT_DATA__ === 'function' &&
  typeof globalThis.__LWCS_NORMALIZE_JSON_PATCH_OPS__ === 'function' &&
  typeof globalThis.__LWCS_PREPROCESS_JSON_PATCH_TEXT__ === 'function'
);

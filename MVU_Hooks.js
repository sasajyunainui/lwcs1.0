// 从 MVU.js 机械拆分：MVU 事件监听、JSONPatch 预处理暴露、parseMessage 包装、魂环年限与突破事件。

function 规范化MVU数据根_V1(数据根 = {}) {
  return globalThis.__LWCS_MVU_SCHEMA__.parse(数据根 && typeof 数据根 === 'object' ? 数据根 : {});
}

globalThis.__LWCS_NORMALIZE_MVU_STAT_DATA__ = 规范化MVU数据根_V1;
try { if (globalThis.parent && globalThis.parent !== globalThis) globalThis.parent.__LWCS_NORMALIZE_MVU_STAT_DATA__ = 规范化MVU数据根_V1; } catch (错误) {}
try { if (globalThis.top && globalThis.top !== globalThis) globalThis.top.__LWCS_NORMALIZE_MVU_STAT_DATA__ = 规范化MVU数据根_V1; } catch (错误) {}
globalThis.__LWCS_应用开场时间线内置角色入库__ = 应用开场时间线内置角色入库_V1;
try { if (globalThis.parent && globalThis.parent !== globalThis) globalThis.parent.__LWCS_应用开场时间线内置角色入库__ = 应用开场时间线内置角色入库_V1; } catch (错误) {}
try { if (globalThis.top && globalThis.top !== globalThis) globalThis.top.__LWCS_应用开场时间线内置角色入库__ = 应用开场时间线内置角色入库_V1; } catch (错误) {}

function 读取事件变量数据根_V1(变量包 = {}) {
  if (变量包?.stat_data && typeof 变量包.stat_data === 'object') return 变量包.stat_data;
  return 变量包 && typeof 变量包 === 'object' ? 变量包 : {};
}

function 按路径读取对象_V1(根对象 = {}, 路径 = []) {
  let 当前 = 根对象;
  for (const 片段 of 路径) {
    if (!当前 || typeof 当前 !== 'object') return undefined;
    当前 = 当前[片段];
  }
  return 当前;
}

function 遍历数据魂环_V1(数据根 = {}, 回调 = () => {}) {
  Object.entries(数据根?.char || {}).forEach(([角色名, 角色数据]) => {
    if (!角色数据 || typeof 角色数据 !== 'object') return;
    取角色武魂条目_V1(角色数据).forEach(([武魂键, 武魂数据]) => {
      if (!武魂数据 || typeof 武魂数据 !== 'object') return;
      取武魂魂灵条目_V1(武魂数据).forEach(([魂灵键, 魂灵数据]) => {
        if (!魂灵数据 || typeof 魂灵数据 !== 'object') return;
        取魂灵魂环条目_V1(魂灵数据).forEach(([魂环键, 魂环数据]) => {
          if (!魂环数据 || typeof 魂环数据 !== 'object') return;
          回调(魂环数据, ['char', 角色名, 武魂键, 魂灵键, 魂环键], 角色数据);
        });
      });
      取武魂直接魂环条目_V1(武魂数据).forEach(([魂环键, 魂环数据]) => {
        if (!魂环数据 || typeof 魂环数据 !== 'object') return;
        回调(魂环数据, ['char', 角色名, 武魂键, 魂环键], 角色数据);
      });
    });
  });
}

function 固化本轮魂环年限变化_V1(新变量 = {}, 旧变量 = {}) {
  const 新数据 = 读取事件变量数据根_V1(新变量);
  const 旧数据 = 读取事件变量数据根_V1(旧变量);
  遍历数据魂环_V1(新数据, (新魂环, 魂环路径) => {
    const 旧魂环 = 按路径读取对象_V1(旧数据, 魂环路径);
    const 新年限 = Math.max(0, Math.floor(Number(新魂环?.年限 || 0)));
    if (!(新年限 > 0)) return;
    const 旧年限原始 = Number(旧魂环?.年限);
    const 旧年限 = Number.isFinite(旧年限原始) && 旧年限原始 > 0 ? Math.max(100, Math.floor(旧年限原始)) : 100;
    if (!(新年限 > 旧年限)) return;
    取魂环魂技条目_V1(新魂环).forEach(([, 技能数据]) => {
      应用年限变化到技能效果数组_V1(技能数据, 旧年限, 新年限);
    });
  });
}

function 清理到期炸环恢复标记_V1(新变量 = {}) {
  const 新数据 = 读取事件变量数据根_V1(新变量);
  const 当前tick = Math.max(0, Number(新数据?.world?.时间?.tick || 0));
  遍历数据魂环_V1(新数据, 魂环数据 => {
    if (!魂环数据 || typeof 魂环数据 !== 'object') return;
    const 恢复tick = Math.max(0, Number(魂环数据?.炸环恢复tick || 0));
    if (!(恢复tick > 0 && 恢复tick <= 当前tick)) return;
    delete 魂环数据.炸环恢复tick;
    if (Object.prototype.hasOwnProperty.call(魂环数据, '炸环恢复时间')) delete 魂环数据.炸环恢复时间;
  });
}

function 同步七九辅助魂技基础效果_V1(新变量 = {}) {
  const 新数据 = 读取事件变量数据根_V1(新变量);
  Object.values(新数据?.char || {}).forEach(角色数据 => {
    if (!角色数据 || typeof 角色数据 !== 'object') return;
    取角色武魂条目_V1(角色数据).forEach(([武魂键, 武魂数据]) => {
      if (!武魂数据 || typeof 武魂数据 !== 'object') return;
      if (String(武魂数据?.系别 || '').trim() !== '辅助系') return;
      const 武魂名称 = String(武魂数据?.表象名称 || 武魂键 || '').trim();
      if (!是否七九武魂名称_V1(武魂名称)) return;
      const 当前魂环数量 = Math.max(1, 计算武魂当前魂环数量_V1(武魂数据));
      const 应用到魂技表 = 魂技表 => {
        Object.values(魂技表 || {}).forEach(技能数据 => {
          if (!技能数据 || typeof 技能数据 !== 'object' || !Array.isArray(技能数据._效果数组)) return;
          应用七九辅助魂技基础效果_V1(技能数据._效果数组, { 当前魂环数量 });
        });
      };
      取武魂全部魂环条目_V1(武魂数据).forEach(({ 魂环数据 }) => {
        应用到魂技表(Object.fromEntries(取魂环魂技条目_V1(魂环数据)));
      });
    });
  });
}

function 处理七字武魂八十级突破更新_V1(新变量 = {}, 旧变量 = {}) {
  const 新数据 = 读取事件变量数据根_V1(新变量);
  const 旧数据 = 读取事件变量数据根_V1(旧变量);
  Object.entries(新数据?.char || {}).forEach(([角色名, 角色数据]) => {
    if (!角色数据 || typeof 角色数据 !== 'object' || !角色存在七字武魂_V1(角色数据)) return;
    const 新等级 = Math.max(0, Number(角色数据?.属性?.等级 || 0));
    const 旧等级 = Math.max(0, Number(旧数据?.char?.[角色名]?.属性?.等级 || 0));
    if (!(旧等级 < 80 && 新等级 >= 80)) return;
    追加系统播报文本(新数据, `[七字武魂突破] ${角色名}突破 80 级门槛。`);
  });
}

function 保留本轮已存在技能效果数组_V1(新变量 = {}, 旧变量 = {}) {
  const 新数据 = 读取事件变量数据根_V1(新变量);
  const 旧数据 = 读取事件变量数据根_V1(旧变量);
  const 是技能结构 = 对象 => {
    if (!对象 || typeof 对象 !== 'object' || Array.isArray(对象)) return false;
    return ['魂技名', '效果描述', '消耗', '_效果数组'].some(键 =>
      Object.prototype.hasOwnProperty.call(对象, 键),
    );
  };
  const 遍历 = (新节点, 旧节点) => {
    if (!新节点 || !旧节点 || typeof 新节点 !== 'object' || typeof 旧节点 !== 'object') return;
    if (Array.isArray(新节点) || Array.isArray(旧节点)) return;
    if (是技能结构(新节点) && 是技能结构(旧节点)) {
      const 新效果为空 = !Array.isArray(新节点._效果数组) || 新节点._效果数组.length === 0;
      const 旧效果存在 = Array.isArray(旧节点._效果数组) && 旧节点._效果数组.length > 0;
      if (新效果为空 && 旧效果存在) 新节点._效果数组 = clonePackedSkillEffects(旧节点._效果数组);
    }
    Object.keys(新节点).forEach(键 => 遍历(新节点[键], 旧节点[键]));
  };
  遍历(新数据, 旧数据);
}

function 等待MVU事件接口_V1(最大等待毫秒 = 15000) {
  const 开始毫秒 = Date.now();
  return new Promise(resolve => {
    const 检查 = () => {
      const 监听函数 = 读取MVU事件监听函数_V1();
      if (typeof 监听函数 === 'function') {
        resolve(true);
        return;
      }
      if (Date.now() - 开始毫秒 >= 最大等待毫秒) {
        resolve(false);
        return;
      }
      setTimeout(检查, 250);
    };
    检查();
  });
}

function 读取MVU事件监听函数_V1() {
  if (typeof eventOn === 'function') return eventOn;
  if (typeof globalThis?.eventOn === 'function') return globalThis.eventOn;
  if (typeof globalThis?.window?.eventOn === 'function') return globalThis.window.eventOn;
  return null;
}

function 暴露AIJsonPatch预处理接口_V1() {
  globalThis.__LWCS_NORMALIZE_JSON_PATCH_OPS__ = (patches = [], 数据输入 = {}, options = {}) =>
    规范化AIJsonPatch列表_V1(patches, 数据输入, options);
  globalThis.__LWCS_PREPROCESS_JSON_PATCH_TEXT__ = (文本 = '', 数据输入 = {}, options = {}) =>
    预处理AIJsonPatch文本_V1(文本, 数据输入, options);
  if (globalThis.window && globalThis.window !== globalThis) {
    globalThis.window.__LWCS_NORMALIZE_JSON_PATCH_OPS__ = globalThis.__LWCS_NORMALIZE_JSON_PATCH_OPS__;
    globalThis.window.__LWCS_PREPROCESS_JSON_PATCH_TEXT__ = globalThis.__LWCS_PREPROCESS_JSON_PATCH_TEXT__;
  }
  try {
    if (globalThis.parent && globalThis.parent !== globalThis) {
      globalThis.parent.__LWCS_NORMALIZE_JSON_PATCH_OPS__ = globalThis.__LWCS_NORMALIZE_JSON_PATCH_OPS__;
      globalThis.parent.__LWCS_PREPROCESS_JSON_PATCH_TEXT__ = globalThis.__LWCS_PREPROCESS_JSON_PATCH_TEXT__;
    }
  } catch (错误) {}
  try {
    if (globalThis.top && globalThis.top !== globalThis) {
      globalThis.top.__LWCS_NORMALIZE_JSON_PATCH_OPS__ = globalThis.__LWCS_NORMALIZE_JSON_PATCH_OPS__;
      globalThis.top.__LWCS_PREPROCESS_JSON_PATCH_TEXT__ = globalThis.__LWCS_PREPROCESS_JSON_PATCH_TEXT__;
    }
  } catch (错误) {}
}

暴露AIJsonPatch预处理接口_V1();

function 安装AIJsonPatch解析钩子_V1() {
  const 候选窗口 = [globalThis];
  try { if (globalThis.parent && globalThis.parent !== globalThis) 候选窗口.push(globalThis.parent); } catch (错误) {}
  try { if (globalThis.top && globalThis.top !== globalThis && !候选窗口.includes(globalThis.top)) 候选窗口.push(globalThis.top); } catch (错误) {}
  const 已处理接口 = new Set();
  候选窗口.forEach(窗口 => {
    let 宿主 = null;
    try { 宿主 = 窗口?.Mvu; } catch (错误) {}
    if (!宿主 || 已处理接口.has(宿主) || typeof 宿主.parseMessage !== 'function' || 宿主.__LWCS_AI_JSON_PATCH_PREPROCESS_WRAPPED__) return;
    已处理接口.add(宿主);
    const 原解析 = 宿主.parseMessage.bind(宿主);
    宿主.parseMessage = function parseMessageWithLwcsJsonPatchGuard(text, mvuData, ...args) {
      const 修正文本 = 预处理AIJsonPatch文本_V1(text, mvuData || 获取最新运行时Mvu数据根_V1());
      return 原解析(修正文本, mvuData, ...args);
    };
    宿主.__LWCS_AI_JSON_PATCH_PREPROCESS_WRAPPED__ = true;
  });
}

function 安装技能生成性能计数器_V1() {
  const 宿主 = typeof globalThis !== 'undefined' ? globalThis : null;
  if (!宿主 || 宿主.__LWCS_SKILL_GENERATION_PERF_INSTALLED__) return 宿主?.__LWCS_SKILL_GENERATION_PERF__;
  const 性能 = 宿主.__LWCS_SKILL_GENERATION_PERF__ || { 调用次数: {}, 耗时毫秒: {} };
  const 包裹 = (名称, 读取, 写入) => {
    const 原函数 = 读取();
    if (typeof 原函数 !== 'function' || 原函数.__LWCS_PERF_WRAPPED__) return;
    const 包裹函数 = function 技能生成性能计数包装(...args) {
      const 开始 = 读取性能计时毫秒_V1();
      性能.调用次数[名称] = Math.max(0, Number(性能.调用次数[名称] || 0)) + 1;
      try {
        return 原函数.apply(this, args);
      } finally {
        性能.耗时毫秒[名称] = Math.max(0, Number(性能.耗时毫秒[名称] || 0)) + Math.max(0, 读取性能计时毫秒_V1() - 开始);
      }
    };
    Object.defineProperty(包裹函数, '__LWCS_PERF_WRAPPED__', { value: true });
    写入(包裹函数);
  };
  包裹('直接自动生成技能结构_V1', () => 直接自动生成技能结构_V1, 值 => { 直接自动生成技能结构_V1 = 值; });
  包裹('autoGenerateSkill', () => autoGenerateSkill, 值 => { autoGenerateSkill = 值; });
  包裹('评估技能预算_V1', () => 评估技能预算_V1, 值 => { 评估技能预算_V1 = 值; });
  包裹('收口技能执行结构_V1', () => 收口技能执行结构_V1, 值 => { 收口技能执行结构_V1 = 值; });
  宿主.__LWCS_SKILL_GENERATION_PERF__ = 性能;
  宿主.__LWCS_SKILL_GENERATION_PERF_INSTALLED__ = true;
  return 性能;
}

try {
  if (typeof globalThis !== 'undefined') {
    globalThis.__LWCS_ENABLE_SKILL_GENERATION_PERF__ = 安装技能生成性能计数器_V1;
    if (globalThis.__LWCS_SKILL_GENERATION_PERF_AUTO__ === true) 安装技能生成性能计数器_V1();
  }
} catch (_错误) {}

async function 注册MVU变量结构_V1() {
  try {
    if (typeof waitGlobalInitialized === 'function') await waitGlobalInitialized('Mvu');
    if (!globalThis.__LWCS_MVU变量结构已注册__ && typeof globalThis.__LWCS_REGISTER_MVU_SCHEMA__ === 'function') {
      globalThis.__LWCS_REGISTER_MVU_SCHEMA__(globalThis.__LWCS_MVU_SCHEMA__);
      globalThis.__LWCS_MVU变量结构已注册__ = true;
    }
    const 事件接口可用 = await 等待MVU事件接口_V1();
    if (!事件接口可用) {
      console.warn('LWCS MVU变量结构注册等待事件接口超时');
      return;
    }
    暴露AIJsonPatch预处理接口_V1();
    安装AIJsonPatch解析钩子_V1();
  } catch (错误) {
    console.warn('LWCS MVU变量结构注册失败', 错误);
  }
}

async function 注册魂技年限与突破事件_V1() {
  try {
    if (globalThis.__LWCS_魂技年限事件已注册__) return;
    if (typeof waitGlobalInitialized === 'function') await waitGlobalInitialized('Mvu');
    const 事件接口可用 = await 等待MVU事件接口_V1();
    if (!事件接口可用) return;
    const 事件名 = globalThis.Mvu?.events?.VARIABLE_UPDATE_ENDED || globalThis.window?.Mvu?.events?.VARIABLE_UPDATE_ENDED;
    const 监听函数 = 读取MVU事件监听函数_V1();
    if (!事件名 || !监听函数) return;
    globalThis.__LWCS_魂技年限事件已注册__ = true;
    监听函数(事件名, (新变量, 旧变量) => {
      处理临时突破请求_V1(读取事件变量数据根_V1(新变量));
      固化本轮魂环年限变化_V1(新变量, 旧变量);
      清理到期炸环恢复标记_V1(新变量);
      同步七九辅助魂技基础效果_V1(新变量);
      处理七字武魂八十级突破更新_V1(新变量, 旧变量);
      保留本轮已存在技能效果数组_V1(新变量, 旧变量);
    });
  } catch (错误) {
    console.warn('LWCS 魂技年限事件注册失败', 错误);
  }
}

$(() => {
  注册MVU变量结构_V1();
  注册魂技年限与突破事件_V1();
});

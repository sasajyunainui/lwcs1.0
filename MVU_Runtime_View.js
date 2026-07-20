// 从 MVU.js 机械拆分：MVU 运行时视图、剧情视图、时间线/情报视图、命中摘要与 JSONPatch 预处理。

function 获取深渊属性(等阶, 物种) {
  const 物种名 = String(物种 || '').trim();
  let 对标等级 = 10;
  const 种族倍率 = { str: 1.0, def: 1.0, agi: 1.0, vit_max: 1.0, men_max: 1.0, sp_max: 1.0 };

  if (等阶 === '低阶生物') {
    对标等级 = 20 + Math.floor(Math.random() * 20);
    Object.assign(种族倍率, { str: 0.8, def: 0.8, agi: 1.2, vit_max: 0.8, men_max: 0.5, sp_max: 1.0 });
  } else if (等阶 === '中阶生物') {
    对标等级 = 40 + Math.floor(Math.random() * 30);
    Object.assign(种族倍率, { str: 1.2, def: 1.2, agi: 1.0, vit_max: 1.2, men_max: 0.8, sp_max: 1.2 });
  } else if (等阶 === '高阶生物') {
    对标等级 = 70 + Math.floor(Math.random() * 20);
    Object.assign(种族倍率, { str: 1.5, def: 1.5, agi: 1.5, vit_max: 1.5, men_max: 1.2, sp_max: 1.5 });
  } else if (等阶 === '深渊王者' || 等阶 === '深渊帝君') {
    对标等级 = 等阶 === '深渊帝君' || /帝$/.test(物种名) ? 99.5 : 99;
    Object.assign(种族倍率, { str: 2.0, def: 2.0, agi: 2.0, vit_max: 2.0, men_max: 2.0, sp_max: 2.0 });
  }

  if (物种名.includes('蝙蝠') || 物种名.includes('魔魅') || 物种名.includes('恶镰')) {
    种族倍率.agi *= 1.5;
    种族倍率.def *= 0.7;
  } else if (物种名.includes('巴安') || 物种名.includes('天牛') || 物种名.includes('猛犸')) {
    种族倍率.def *= 1.8;
    种族倍率.vit_max *= 1.8;
    种族倍率.agi *= 0.6;
  } else if (物种名.includes('黑皇')) {
    种族倍率.sp_max *= 1.5;
    种族倍率.men_max *= 1.5;
  }

  const 基础 = getBaseStats(对标等级);
  const 结果 = {
    种族: 物种名,
    等阶,
    对标等级,
    str: Math.floor(基础.str * 种族倍率.str),
    def: Math.floor(基础.def * 种族倍率.def),
    agi: Math.floor(基础.agi * 种族倍率.agi),
    vit_max: Math.floor(基础.vit_max * 种族倍率.vit_max),
    men_max: Math.floor(基础.men_max * 种族倍率.men_max),
    sp_max: Math.floor(基础.sp_max * 种族倍率.sp_max),
  };

  const 百级基准 = getBaseStats(100);
  if (物种名 === '灵帝') {
    结果.对标等级 = 99.5;
    结果.men_max = Math.max(结果.men_max, 百级基准.men_max);
  } else if (物种名 === '烈帝') {
    结果.对标等级 = 99.5;
    结果.sp_max = Math.max(结果.sp_max, 百级基准.sp_max);
  } else if (物种名 === '魔帝') {
    结果.对标等级 = 99.5;
    结果.vit_max = Math.max(结果.vit_max, 百级基准.vit_max);
  } else if (物种名 === '深渊圣君') {
    结果.对标等级 = 100;
    结果.str = 百级基准.str * 3;
    结果.def = 百级基准.def * 3;
    结果.vit_max = 百级基准.vit_max * 3;
    结果.sp_max = 百级基准.sp_max * 3;
    结果.men_max = 百级基准.men_max * 3;
  }

  return 结果;
}

var MAP_IMAGE_WIDTH = 3174;
var MAP_IMAGE_HEIGHT = 2246;
var MAP_COORD_SYSTEM_IMAGE = 'image';
var MAP_COORD_SYSTEM_LOCAL = 'local';

var MAP_TRAVEL_SCALE_BY_LEVEL = {
  world: 1,
  city: 0.07,
  facility: 0.02,
};
var 独立魂环来源待补全文案_V1 = '待补全(请填写该独立魂环的来源实体或出处，如具体魂兽名/神赐魂环/传承来源)';
var 角色性别待补全文案_V1 = '待补全(请填写角色性别)';
var 场景候选角色资料占位符_V1 = '{{场景候选角色资料}}';
var 场景背景角色补充占位符_V1 = '{{场景背景角色补充}}';
var 场景审计材料占位符_V1 = '{{场景审计材料}}';
var 玩家角色表占位符_V1 = '{{玩家角色表}}';

function 清理提示审计扫描文本_V1(text = '') {
  return String(text || '').replace(/<scene_audit>[\s\S]*?<\/scene_audit>/gi, ' ');
}

function 读取运行时正数属性_V1(角色 = {}, 字段 = '') {
  const 数值 = Number(角色?.属性?.[字段]);
  return Number.isFinite(数值) && 数值 > 0 ? 数值 : 0;
}

function cloneJsonValue(值, 回退值 = {}) {
  if (值 === null || typeof 值 !== 'object') {
    if (typeof 值 === 'function' || typeof 值 === 'symbol') return 回退值;
    return 值;
  }
  if (Array.isArray(值)) return 值.map(项 => cloneJsonValue(项, 项));
  const 原型 = Object.getPrototypeOf(值);
  if (原型 === Object.prototype || 原型 === null) {
    const 输出 = {};
    Object.entries(值).forEach(([键, 子值]) => {
      输出[键] = cloneJsonValue(子值, 子值);
    });
    return 输出;
  }
  try {
    return structuredClone(值);
  } catch (错误) {}
  try {
    return JSON.parse(JSON.stringify(值));
  } catch (错误) {}
  return 回退值;
}

function 读取内置角色库_V1() {
  const 候选列表 = [globalThis];
  try { if (globalThis.parent && globalThis.parent !== globalThis) 候选列表.push(globalThis.parent); } catch (错误) {}
  try { if (globalThis.top && globalThis.top !== globalThis) 候选列表.push(globalThis.top); } catch (错误) {}
  for (const 候选 of 候选列表) {
    const 角色库 = 候选?.__LWCS_内置角色库__;
    if (角色库 && typeof 角色库 === 'object' && 角色库.角色 && typeof 角色库.角色 === 'object') return 角色库;
  }
  return { 版本: 0, 每年tick: 51840, 开场节点: {}, 角色: {} };
}

function 读取内置物品库_V1() {
  const 候选列表 = [globalThis];
  try { if (globalThis.parent && globalThis.parent !== globalThis) 候选列表.push(globalThis.parent); } catch (错误) {}
  try { if (globalThis.top && globalThis.top !== globalThis) 候选列表.push(globalThis.top); } catch (错误) {}
  for (const 候选 of 候选列表) {
    const 物品库 = 候选?.__LWCS_内置物品库__;
    if (物品库 && typeof 物品库 === 'object' && !Array.isArray(物品库)) return 物品库;
  }
  return {};
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
var AIJsonPatch装备定义分类集合_V1 = new Set(['近战武器', '远程武器', '防具', '防具装备', '饰品', '魂导器', '战术装备', '功能道具', '斗铠', '斗铠部件', '机甲机体', '机甲部件']);
var AIJsonPatch装备槽位集合_V1 = new Set(['武器', '防具']);
var AIJsonPatch装备加成方向列表_V1 = Object.freeze(['魂力上限', '精神力上限', '力量', '防御', '敏捷', '体力上限', '全属性']);
var AIJsonPatch装备加成方向集合_V1 = new Set(AIJsonPatch装备加成方向列表_V1);

function 遍历物品定义_V1(物品表 = {}, 回调 = () => {}) {
  const 分类表 = 物品表 && typeof 物品表 === 'object' && !Array.isArray(物品表) ? 物品表 : {};
  物品分类列表_V1.forEach(分类 => {
    Object.entries(分类表[分类] || {}).forEach(([物品名, 定义]) => {
      if (!物品名 || !定义 || typeof 定义 !== 'object' || Array.isArray(定义)) return;
      回调(物品名, 定义, 分类);
    });
  });
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

var 古月娜融合成立tick_V1 = 643159;
var 内置角色预备出场窗口tick_V1 = 3 * 30 * 144;

function 是否古月娜融合阶段_V1(当前tick = 0, 数据根 = {}) {
  return Number(当前tick || 0) >= 古月娜融合成立tick_V1 || !!数据根?.char?.古月娜;
}

function 读取内置角色记录_V1(角色名 = '', 当前tick = 0, 数据根 = {}) {
  const 规范名 = 解析内置角色规范名_V1(角色名, 当前tick, 数据根);
  if (!规范名) return null;
  return 读取内置角色库_V1().角色?.[规范名] || null;
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

function 解析生日年内日序_V1(生日 = '') {
  const 文本 = String(生日 || '').trim();
  if (!文本 || 文本 === '待生成') return null;
  const 匹配 = 文本.match(/^(\d{1,2})\s*月\s*(\d{1,2})\s*日?$/) || 文本.match(/^(\d{1,2})\s*[-/.]\s*(\d{1,2})$/);
  if (!匹配) return null;
  const 月 = Math.max(1, Math.min(12, Math.floor(Number(匹配[1]) || 1)));
  const 日 = Math.max(1, Math.min(30, Math.floor(Number(匹配[2]) || 1)));
  return (月 - 1) * 30 + (日 - 1);
}

function 计算tick年内日序_V1(当前tick = 0) {
  const 总天数 = Math.floor(Math.max(0, Number(当前tick || 0)) / 144);
  return ((总天数 % 360) + 360) % 360;
}

function 计算角色有效年龄_V1(年龄 = 0, 生日 = '', 当前tick = null) {
  const 年龄数值 = Number(年龄);
  if (!Number.isFinite(年龄数值)) return null;
  const 基础年龄 = Math.max(0, 年龄数值);
  if (当前tick === null || 当前tick === undefined) return 基础年龄;
  const 生日序 = 解析生日年内日序_V1(生日);
  if (生日序 === null) return 基础年龄;
  const 当前序 = 计算tick年内日序_V1(当前tick);
  const 距上次生日天数 = (当前序 - 生日序 + 360) % 360;
  return 基础年龄 + 距上次生日天数 / 360;
}

function 格式化年龄岁月文本_V1(年龄 = 0, 生日 = '', 当前tick = null) {
  const 有效年龄 = 计算角色有效年龄_V1(年龄, 生日, 当前tick);
  if (!Number.isFinite(有效年龄)) return '';
  const 总月数 = Math.max(0, Math.floor(有效年龄 * 12 + 1e-6));
  const 年 = Math.floor(总月数 / 12);
  const 月 = 总月数 % 12;
  return `${年}岁零${月}个月`;
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

function 构建内置角色命中摘要_V1(数据根 = {}, 文本 = '') {
  const 当前tick = Number(数据根?.world?.时间?.tick || 0);
  return 收集当前时间线命中内置角色名_V1(当前tick, 文本, 数据根)
    .filter(角色名 => !数据根?.char?.[角色名])
    .map(角色名 => 读取内置角色记录_V1(角色名, 当前tick, 数据根)?.摘要 || '')
    .filter(Boolean)
    .slice(0, 6);
}

var 常规魂骨槽位列表_V1 = Object.freeze(['头部魂骨', '躯干魂骨', '右臂魂骨', '左臂魂骨', '右腿魂骨', '左腿魂骨']);
var 外附魂骨槽位列表_V1 = Object.freeze(['外附魂骨1', '外附魂骨2']);
var 魂骨槽位列表_V1 = Object.freeze([...常规魂骨槽位列表_V1, ...外附魂骨槽位列表_V1]);
var 魂骨倍率属性列表_V1 = Object.freeze(['力量', '防御', '敏捷', '体力上限', '精神力上限', '魂力上限']);

function 是外附魂骨槽位_V1(槽位 = '') {
  return 外附魂骨槽位列表_V1.includes(String(槽位 || '').trim());
}

function 是外附魂骨记录_V1(魂骨 = {}, 槽位 = '') {
  return 是外附魂骨槽位_V1(槽位);
}

function 创建空魂骨倍率_V1() {
  return Object.fromEntries(魂骨倍率属性列表_V1.map(属性 => [属性, 0]));
}

var 外附魂骨品质倍率档位_V1 = Object.freeze({ F: 0.05, D: 0.10, C: 0.15, B: 0.20, A: 0.25, S: 0.30, 'S+': 0.35 });

function 按品质派生外附魂骨属性倍率_V1(品质 = '') {
  const 文本 = String(品质 || '').trim().toUpperCase().replace('＋', '+').replace(/\s+/g, '');
  const 系数 = Object.prototype.hasOwnProperty.call(外附魂骨品质倍率档位_V1, 文本) ? 外附魂骨品质倍率档位_V1[文本] : 0;
  return Object.fromEntries(魂骨倍率属性列表_V1.map(属性 => [属性, 系数]));
}

function 创建空魂骨记录_V1(槽位 = '魂骨') {
  const 外附 = 是外附魂骨槽位_V1(槽位);
  const 记录 = {
    名称: '',
    表象名称: '无',
    年限: 0,
    来源: '',
    品质: '无',
    品阶: '无',
    描述: '无',
    附带技能: {},
    属性加成: { 力量: 0, 防御: 0, 敏捷: 0, 体力上限: 0, 精神力上限: 0, 魂力上限: 0 },
  };
  if (外附) 记录.属性倍率 = 创建空魂骨倍率_V1();
  return 记录;
}

function 补齐角色魂骨槽位_V1(char = {}) {
  if (!char || typeof char !== 'object') return {};
  if (!char.魂骨 || typeof char.魂骨 !== 'object' || Array.isArray(char.魂骨)) char.魂骨 = {};
  魂骨槽位列表_V1.forEach(槽位 => {
    if (!char.魂骨[槽位] || typeof char.魂骨[槽位] !== 'object' || Array.isArray(char.魂骨[槽位])) {
      char.魂骨[槽位] = 创建空魂骨记录_V1(槽位);
      return;
    }
    delete char.魂骨[槽位].类型;
    if (是外附魂骨槽位_V1(槽位)) char.魂骨[槽位].属性倍率 = 按品质派生外附魂骨属性倍率_V1(char.魂骨[槽位].品质);
  });
  return char.魂骨;
}

var MVU_RUNTIME_VIEW_PLACEHOLDER_V1 = '{{MVU_RUNTIME_VIEW}}';
var MVU_RUNTIME_UPDATE_PLACEHOLDER_V1 = '{{MVU_RUNTIME_UPDATE}}';
var MVU_UPDATE_STRUCTURE_HINTS_PLACEHOLDER_V1 = '{{MVU_UPDATE_STRUCTURE_HINTS}}';
var MVU相互可见性视图占位符_V1 = '{{MVU_MUTUAL_VISIBILITY_VIEW}}';
var 临时突破默认提示词_V1 = '当正文里出现临时突破时填写该角色突破后的等级数字';

var MVU正文视图排除路径模板_V1 = ["当前","当前.地点","当前.时间","当前.时间._上次结算tick","当前.时间._calendar","当前.时间.tick","当前.玩家","当前.玩家行动","当前.系统播报","剧情钩子","剧情钩子._引导","剧情钩子.机密情报","剧情钩子.机密情报.示例情报","剧情钩子.机密情报.示例情报.内容","剧情钩子.拍卖","剧情钩子.拍卖.地点","剧情钩子.委托板","剧情钩子.委托板.示例委托","剧情钩子.委托板.示例委托.标题","剧情钩子.委托板.示例委托.描述","剧情钩子.战斗","物品.示例物品.基础耐久","物品.示例物品.阶位","物品.示例物品.使用效果","物品.示例物品.使用效果.[]","物品.示例物品.使用效果.[].持续tick","物品.示例物品.使用效果.[].描述","物品.示例物品.使用效果.[].目标","物品.示例物品.使用效果.[].属性","物品.示例物品.使用效果.[].数值","物品.示例物品.使用效果.[].原型","物品.示例物品.属性加成","物品.示例物品.属性加成.示例项","物品.示例物品.装备槽位","物品.示例物品.装备技能","物品.示例物品.装备技能.示例项","物品.示例物品.装备技能.示例项._效果数组","物品.示例物品.装备技能.示例项._效果数组.[]","物品.示例物品.装备技能.示例项.附带属性","物品.示例物品.装备技能.示例项.附带属性.[]","物品.示例物品.装备技能.示例项.画面描述","物品.示例物品.装备技能.示例项.魂技名","物品.示例物品.装备技能.示例项.机制决策临时","物品.示例物品.装备技能.示例项.前摇","物品.示例物品.装备技能.示例项.消耗","物品.示例物品.装备技能.示例项.效果描述","相关实体索引","相关实体索引.角色","相关实体索引.角色.[]","相关实体索引.命物品","相关实体索引.命物品.[]","相关实体索引.命中地点","相关实体索引.命中地点.[]","相关实体索引.命中动态地点","相关实体索引.命中动态地点.[]","相关实体索引.命中势力","相关实体索引.命中势力.[]","char.示例角色.__mvu_isPlayer","char.示例角色.临时突破","char.示例角色.第1武魂.第1魂灵.品质","char.示例角色.第1武魂.可调用元素","char.示例角色.第1武魂.可调用元素.[]","char.示例角色.第1武魂.属性体系","char.示例角色.*.第1魂环.第1魂技._效果数组","char.示例角色.*.第1魂环.第1魂技._效果数组.[]","char.示例角色.魂骨.示例项.附带技能.示例项","char.示例角色.魂骨.示例项.附带技能.示例项._效果数组","char.示例角色.魂骨.示例项.附带技能.示例项._效果数组.[]","char.示例角色.魂骨.示例项.附带技能.示例项.附带属性","char.示例角色.魂骨.示例项.附带技能.示例项.附带属性.[]","char.示例角色.魂骨.示例项.附带技能.示例项.机制决策临时","char.示例角色.魂骨.示例项.附带技能.示例项.技能掌控度","char.示例角色.魂骨.示例项.附带技能.示例项.技能掌控度.圆满等级","char.示例角色.魂骨.示例项.附带技能.示例项.技能掌控度.中心等级","char.示例角色.魂骨.示例项.附带技能.示例项.前摇","char.示例角色.魂骨.示例项.附带技能.示例项.消耗","char.示例角色.魂骨.示例项.属性加成","char.示例角色.魂骨.示例项.属性加成.防御","char.示例角色.魂骨.示例项.属性加成.魂力上限","char.示例角色.魂骨.示例项.属性加成.精神力上限","char.示例角色.魂骨.示例项.属性加成.力量","char.示例角色.魂骨.示例项.属性加成.敏捷","char.示例角色.魂骨.示例项.属性加成.体力上限","char.示例角色.捐献请求","char.示例角色.捐献请求.目标势力","char.示例角色.捐献请求.数量","char.示例角色.捐献请求.物品名称","char.示例角色.社交.称号.示例项.声望加成","char.示例角色.社交.势力.示例势力.权限级","char.示例角色.属性.等级惩罚","char.示例角色.属性.底子波动","char.示例角色.属性.防御","char.示例角色.属性.魂力","char.示例角色.属性.魂力上限","char.示例角色.属性.精神境界","char.示例角色.属性.精神力","char.示例角色.属性.精神力上限","char.示例角色.属性.力量","char.示例角色.属性.敏捷","char.示例角色.属性.上次灵物等级","char.示例角色.属性.体力","char.示例角色.属性.体力上限","char.示例角色.属性.天赋梯队","char.示例角色.属性.训练加成","char.示例角色.属性.训练加成.防御","char.示例角色.属性.训练加成.精神力上限","char.示例角色.属性.训练加成.力量","char.示例角色.属性.训练加成.敏捷","char.示例角色.属性.训练加成.体力上限","char.示例角色.属性.状态效果","char.示例角色.属性.状态效果.示例项","char.示例角色.属性.状态效果.示例项.层数","char.示例角色.属性.状态效果.示例项.持续回合","char.示例角色.属性.状态效果.示例项.类型","char.示例角色.属性.状态效果.示例项.面板倍率","char.示例角色.属性.状态效果.示例项.面板倍率.防御","char.示例角色.属性.状态效果.示例项.面板倍率.魂力上限","char.示例角色.属性.状态效果.示例项.面板倍率.力量","char.示例角色.属性.状态效果.示例项.面板倍率.敏捷","char.示例角色.属性.状态效果.示例项.描述","char.示例角色.属性.状态效果.示例项.战斗效果","char.示例角色.属性.状态效果.示例项.战斗效果.持续伤害","char.示例角色.属性.状态效果.示例项.战斗效果.破防比例","char.示例角色.属性.状态效果.示例项.战斗效果.跳过回合","char.示例角色.属性.HP","char.示例角色.属性.HP上限","char.示例角色.武魂融合技.示例项","char.示例角色.武魂融合技.示例项.技能数据","char.示例角色.武魂融合技.示例项.技能数据._效果数组","char.示例角色.武魂融合技.示例项.技能数据._效果数组.[]","char.示例角色.武魂融合技.示例项.技能数据.附带属性","char.示例角色.武魂融合技.示例项.技能数据.附带属性.[]","char.示例角色.武魂融合技.示例项.技能数据.机制决策临时","char.示例角色.武魂融合技.示例项.技能数据.技能掌控度","char.示例角色.武魂融合技.示例项.技能数据.技能掌控度.圆满等级","char.示例角色.武魂融合技.示例项.技能数据.技能掌控度.中心等级","char.示例角色.武魂融合技.示例项.技能数据.前摇","char.示例角色.武魂融合技.示例项.技能数据.消耗","char.示例角色.血脉之力.被动.示例项._效果数组","char.示例角色.血脉之力.被动.示例项._效果数组.[]","char.示例角色.血脉之力.被动.示例项.附带属性","char.示例角色.血脉之力.被动.示例项.附带属性.[]","char.示例角色.血脉之力.被动.示例项.机制决策临时","char.示例角色.血脉之力.被动.示例项.技能掌控度","char.示例角色.血脉之力.被动.示例项.技能掌控度.圆满等级","char.示例角色.血脉之力.被动.示例项.技能掌控度.中心等级","char.示例角色.血脉之力.被动.示例项.前摇","char.示例角色.血脉之力.被动.示例项.消耗","char.示例角色.血脉之力.技能.示例项","char.示例角色.血脉之力.技能.示例项._效果数组","char.示例角色.血脉之力.技能.示例项._效果数组.[]","char.示例角色.血脉之力.技能.示例项.附带属性","char.示例角色.血脉之力.技能.示例项.附带属性.[]","char.示例角色.血脉之力.技能.示例项.机制决策临时","char.示例角色.血脉之力.技能.示例项.技能掌控度","char.示例角色.血脉之力.技能.示例项.技能掌控度.圆满等级","char.示例角色.血脉之力.技能.示例项.技能掌控度.中心等级","char.示例角色.血脉之力.技能.示例项.前摇","char.示例角色.血脉之力.技能.示例项.消耗","char.示例角色.血脉之力.永久加成","char.示例角色.血脉之力.永久加成.示例项","char.示例角色.血脉之力.永久加成.示例项.来源层级","char.示例角色.血脉之力.永久加成.示例项.属性加成","char.示例角色.血脉之力.永久加成.示例项.属性加成.防御","char.示例角色.血脉之力.永久加成.示例项.属性加成.魂力上限","char.示例角色.血脉之力.永久加成.示例项.属性加成.精神力上限","char.示例角色.血脉之力.永久加成.示例项.属性加成.力量","char.示例角色.血脉之力.永久加成.示例项.属性加成.敏捷","char.示例角色.血脉之力.永久加成.示例项.属性加成.体力上限","char.示例角色.血脉之力.永久加成.示例项.效果描述","char.示例角色.装备.斗铠._属性加成","char.示例角色.装备.斗铠._属性加成.等效等级","char.示例角色.装备.斗铠._属性加成.防御","char.示例角色.装备.斗铠._属性加成.魂力上限","char.示例角色.装备.斗铠._属性加成.精神力上限","char.示例角色.装备.斗铠._属性加成.力量","char.示例角色.装备.斗铠._属性加成.敏捷","char.示例角色.装备.斗铠._属性加成.体力上限","char.示例角色.装备.斗铠._已排异","char.示例角色.装备.斗铠.部件","char.示例角色.装备.斗铠.部件.示例项","char.示例角色.装备.斗铠.部件.示例项.品质系数","char.示例角色.装备.斗铠.部件.示例项.状态","char.示例角色.装备.机甲","char.示例角色.装备.机甲._属性加成","char.示例角色.装备.机甲._属性加成.防御","char.示例角色.装备.机甲._属性加成.魂力上限","char.示例角色.装备.机甲._属性加成.精神力上限","char.示例角色.装备.机甲._属性加成.力量","char.示例角色.装备.机甲._属性加成.敏捷","char.示例角色.装备.机甲._属性加成.体力上限","char.示例角色.装备.机甲.品质系数","char.示例角色.装备.武器.属性加成","char.示例角色.装备.武器.属性加成.防御","char.示例角色.装备.武器.属性加成.魂力上限","char.示例角色.装备.武器.属性加成.精神力上限","char.示例角色.装备.武器.属性加成.力量","char.示例角色.装备.武器.属性加成.敏捷","char.示例角色.装备.武器.属性加成.体力上限","char.示例角色.状态.横坐标","char.示例角色.状态.纵坐标","char.示例角色.自创魂技","char.示例角色.自创魂技.示例项","char.示例角色.自创魂技.示例项._效果数组","char.示例角色.自创魂技.示例项._效果数组.[]","char.示例角色.自创魂技.示例项.附带属性","char.示例角色.自创魂技.示例项.附带属性.[]","char.示例角色.自创魂技.示例项.机制决策临时","char.示例角色.自创魂技.示例项.技能掌控度","char.示例角色.自创魂技.示例项.技能掌控度.圆满等级","char.示例角色.自创魂技.示例项.技能掌控度.中心等级","char.示例角色.自创魂技.示例项.前摇","char.示例角色.自创魂技.示例项.消耗","sys","sys.玩家名","world.地点.示例地点.经济状况","world.地点.示例地点.子节点.示例项","world.地点.示例地点.x","world.地点.示例地点.y","world.动态地点.示例动态地点.x","world.动态地点.示例动态地点.y","world.累计击杀年限","world.偏差倍率","world.偏差值","world.时间._上次结算tick","world.时间._calendar","world.时间.tick","world.图鉴","world.图鉴.示例图鉴","world.图鉴.示例图鉴.成长倾向","world.图鉴.示例图鉴.当前档经验","world.图鉴.示例图鉴.击杀次数","world.图鉴.示例图鉴.交手次数","world.图鉴.示例图鉴.情报协同系数","world.图鉴.示例图鉴.任务协同系数","world.图鉴.示例图鉴.探索收益","world.图鉴.示例图鉴.图鉴档位","world.图鉴.示例图鉴.下档需求","world.图鉴.示例图鉴.战斗标签样本","world.图鉴.示例图鉴.战斗标签样本.示例项","world.图鉴.示例图鉴.战斗收益","world.图鉴.示例图鉴.战斗样本数","world.图鉴.示例图鉴.最近活跃tick","world.图鉴.示例图鉴.最近升档tick","world.图鉴.示例图鉴.最近战斗标签","world.委托板","world.委托板.示例委托","world.委托板.示例委托.承接者","world.委托板.示例委托.发布者","world.委托板.示例委托.奖励币","world.委托板.示例委托.奖励声望","world.委托板.示例委托.面向","world.委托板.示例委托.难度","world.委托板.示例委托.生成tick","world.委托板.示例委托.指定对象","world.委托板.示例委托.状态","world.委托板.示例委托.资源级别","world.战斗","world.战斗.裁断结果","world.战斗.参战者","world.战斗.参战者.示例项","world.战斗.环境","world.战斗.回合","world.战斗.进行中","world.战斗.先攻","world.战斗.允许撤离","world.战斗.战斗类型","world.战斗.战斗意图"];
var MVU更新视图排除路径模板_V1 = ["当前","当前.地点","当前.时间","当前.时间._上次结算tick","当前.时间._calendar","当前.时间.tick","当前.玩家","当前.玩家行动","当前.系统播报","剧情钩子","剧情钩子._引导","剧情钩子.机密情报","剧情钩子.机密情报.示例情报","剧情钩子.机密情报.示例情报.内容","剧情钩子.拍卖","剧情钩子.拍卖.地点","剧情钩子.委托板","剧情钩子.委托板.示例委托","剧情钩子.委托板.示例委托.标题","剧情钩子.委托板.示例委托.描述","剧情钩子.战斗","物品.示例物品.属性加成.示例项","物品.示例物品.装备技能.示例项","物品.示例物品.装备技能.示例项._效果数组","物品.示例物品.装备技能.示例项._效果数组.[]","物品.示例物品.装备技能.示例项.附带属性","物品.示例物品.装备技能.示例项.附带属性.[]","物品.示例物品.装备技能.示例项.画面描述","物品.示例物品.装备技能.示例项.魂技名","物品.示例物品.装备技能.示例项.机制决策临时","物品.示例物品.装备技能.示例项.前摇","物品.示例物品.装备技能.示例项.消耗","物品.示例物品.装备技能.示例项.效果描述","相关实体索引","相关实体索引.角色","相关实体索引.角色.[]","相关实体索引.命物品","相关实体索引.命物品.[]","相关实体索引.命中地点","相关实体索引.命中地点.[]","相关实体索引.命中动态地点","相关实体索引.命中动态地点.[]","相关实体索引.命中势力","相关实体索引.命中势力.[]","char.示例角色.__mvu_isPlayer","char.示例角色.魂灵塔记录.**","char.示例角色.功法.**","char.示例角色.第1武魂.可调用元素","char.示例角色.第1武魂.可调用元素.[]","char.示例角色.魂骨.示例项.附带技能.示例项","char.示例角色.魂骨.示例项.附带技能.示例项._效果数组","char.示例角色.魂骨.示例项.附带技能.示例项._效果数组.[]","char.示例角色.魂骨.示例项.附带技能.示例项.技能掌控度","char.示例角色.魂骨.示例项.附带技能.示例项.技能掌控度.圆满等级","char.示例角色.魂骨.示例项.附带技能.示例项.技能掌控度.中心等级","char.示例角色.魂骨.示例项.附带技能.示例项.前摇","char.示例角色.魂骨.示例项.附带技能.示例项.消耗.**","char.示例角色.魂骨.示例项.属性加成","char.示例角色.魂骨.示例项.属性加成.防御","char.示例角色.魂骨.示例项.属性加成.魂力上限","char.示例角色.魂骨.示例项.属性加成.精神力上限","char.示例角色.魂骨.示例项.属性加成.力量","char.示例角色.魂骨.示例项.属性加成.敏捷","char.示例角色.魂骨.示例项.属性加成.体力上限","char.示例角色.捐献请求","char.示例角色.捐献请求.目标势力","char.示例角色.捐献请求.数量","char.示例角色.捐献请求.物品名称","char.示例角色.社交.称号","char.示例角色.社交.称号.示例项","char.示例角色.社交.称号.示例项.来源","char.示例角色.社交.称号.示例项.声望加成","char.示例角色.社交.关系.示例角色._当前关系加成","char.示例角色.社交.关系.示例角色._关系阶段","char.示例角色.社交.关系.示例角色._可切线","char.示例角色.社交.关系.示例角色._切线限制原因","char.示例角色.社交.关系.示例角色._推进提示","char.示例角色.社交.关系.示例角色._维护优先级","char.示例角色.社交.关系.示例角色._下档解锁加成","char.示例角色.社交.关系.示例角色._下档解锁阈值","char.示例角色.社交.关系.示例角色._下一阶段","char.示例角色.社交.关系.示例角色._下一阶段阈值","char.示例角色.社交.关系分析","char.示例角色.社交.关系分析.风险对象","char.示例角色.社交.关系分析.风险对象.[]","char.示例角色.社交.关系分析.关注对象","char.示例角色.社交.关系分析.可联络对象","char.示例角色.社交.关系分析.可联络对象.[]","char.示例角色.社交.关系分析.恋爱候选","char.示例角色.社交.关系分析.恋爱候选.[]","char.示例角色.社交.关系分析.受阻对象","char.示例角色.社交.关系分析.受阻对象.[]","char.示例角色.社交.关系分析.受阻对象.[].对象","char.示例角色.社交.关系分析.受阻对象.[].原因","char.示例角色.社交.关系分析.同地对象","char.示例角色.社交.关系分析.同地对象.[]","char.示例角色.社交.关系分析.信任对象","char.示例角色.社交.关系分析.信任对象.[]","char.示例角色.社交.关系分析.摘要","char.示例角色.社交.关系分析.重点对象","char.示例角色.社交.名望等级","char.示例角色.属性.等级","char.示例角色.属性.等级惩罚","char.示例角色.属性.底子波动","char.示例角色.属性.防御","char.示例角色.属性.魂力上限","char.示例角色.属性.精神境界","char.示例角色.属性.精神力上限","char.示例角色.属性.力量","char.示例角色.属性.敏捷","char.示例角色.属性.上次灵物等级","char.示例角色.属性.体力上限","char.示例角色.属性.天赋梯队","char.示例角色.属性.训练加成","char.示例角色.属性.训练加成.防御","char.示例角色.属性.训练加成.精神力上限","char.示例角色.属性.训练加成.力量","char.示例角色.属性.训练加成.敏捷","char.示例角色.属性.训练加成.体力上限","char.示例角色.属性.状态效果","char.示例角色.属性.状态效果.示例项","char.示例角色.属性.状态效果.示例项.层数","char.示例角色.属性.状态效果.示例项.持续回合","char.示例角色.属性.状态效果.示例项.类型","char.示例角色.属性.状态效果.示例项.面板倍率","char.示例角色.属性.状态效果.示例项.面板倍率.防御","char.示例角色.属性.状态效果.示例项.面板倍率.魂力上限","char.示例角色.属性.状态效果.示例项.面板倍率.力量","char.示例角色.属性.状态效果.示例项.面板倍率.敏捷","char.示例角色.属性.状态效果.示例项.描述","char.示例角色.属性.状态效果.示例项.战斗效果","char.示例角色.属性.状态效果.示例项.战斗效果.持续伤害","char.示例角色.属性.状态效果.示例项.战斗效果.破防比例","char.示例角色.属性.状态效果.示例项.战斗效果.跳过回合","char.示例角色.属性.HP上限","char.示例角色.武魂融合技.示例项","char.示例角色.武魂融合技.示例项.技能数据","char.示例角色.武魂融合技.示例项.技能数据._效果数组","char.示例角色.武魂融合技.示例项.技能数据._效果数组.[]","char.示例角色.武魂融合技.示例项.技能数据.技能掌控度","char.示例角色.武魂融合技.示例项.技能数据.技能掌控度.圆满等级","char.示例角色.武魂融合技.示例项.技能数据.技能掌控度.中心等级","char.示例角色.武魂融合技.示例项.技能数据.前摇","char.示例角色.武魂融合技.示例项.技能数据.消耗.**","char.示例角色.血脉之力","char.示例角色.血脉之力.被动","char.示例角色.血脉之力.被动.示例项","char.示例角色.血脉之力.被动.示例项._效果数组","char.示例角色.血脉之力.被动.示例项._效果数组.[]","char.示例角色.血脉之力.被动.示例项.附带属性","char.示例角色.血脉之力.被动.示例项.附带属性.[]","char.示例角色.血脉之力.被动.示例项.机制决策临时","char.示例角色.血脉之力.被动.示例项.技能掌控度","char.示例角色.血脉之力.被动.示例项.技能掌控度.圆满等级","char.示例角色.血脉之力.被动.示例项.技能掌控度.中心等级","char.示例角色.血脉之力.被动.示例项.前摇","char.示例角色.血脉之力.被动.示例项.消耗","char.示例角色.血脉之力.技能.示例项","char.示例角色.血脉之力.技能.示例项._效果数组","char.示例角色.血脉之力.技能.示例项._效果数组.[]","char.示例角色.血脉之力.技能.示例项.附带属性","char.示例角色.血脉之力.技能.示例项.附带属性.[]","char.示例角色.血脉之力.技能.示例项.机制决策临时","char.示例角色.血脉之力.技能.示例项.技能掌控度","char.示例角色.血脉之力.技能.示例项.技能掌控度.圆满等级","char.示例角色.血脉之力.技能.示例项.技能掌控度.中心等级","char.示例角色.血脉之力.技能.示例项.前摇","char.示例角色.血脉之力.技能.示例项.消耗","char.示例角色.血脉之力.永久加成","char.示例角色.血脉之力.永久加成.示例项","char.示例角色.血脉之力.永久加成.示例项.来源层级","char.示例角色.血脉之力.永久加成.示例项.属性加成","char.示例角色.血脉之力.永久加成.示例项.属性加成.防御","char.示例角色.血脉之力.永久加成.示例项.属性加成.魂力上限","char.示例角色.血脉之力.永久加成.示例项.属性加成.精神力上限","char.示例角色.血脉之力.永久加成.示例项.属性加成.力量","char.示例角色.血脉之力.永久加成.示例项.属性加成.敏捷","char.示例角色.血脉之力.永久加成.示例项.属性加成.体力上限","char.示例角色.血脉之力.永久加成.示例项.效果描述","char.示例角色.副职业","char.示例角色.副职业.示例项","char.示例角色.副职业.示例项.称号","char.示例角色.副职业.示例项.经验","char.示例角色.装备.斗铠._属性加成","char.示例角色.装备.斗铠._属性加成.等效等级","char.示例角色.装备.斗铠._属性加成.防御","char.示例角色.装备.斗铠._属性加成.魂力上限","char.示例角色.装备.斗铠._属性加成.精神力上限","char.示例角色.装备.斗铠._属性加成.力量","char.示例角色.装备.斗铠._属性加成.敏捷","char.示例角色.装备.斗铠._属性加成.体力上限","char.示例角色.装备.斗铠._已排异","char.示例角色.装备.斗铠.部件","char.示例角色.装备.斗铠.部件.示例项","char.示例角色.装备.斗铠.部件.示例项.品质系数","char.示例角色.装备.斗铠.部件.示例项.状态","char.示例角色.装备.机甲._属性加成","char.示例角色.装备.机甲._属性加成.防御","char.示例角色.装备.机甲._属性加成.魂力上限","char.示例角色.装备.机甲._属性加成.精神力上限","char.示例角色.装备.机甲._属性加成.力量","char.示例角色.装备.机甲._属性加成.敏捷","char.示例角色.装备.机甲._属性加成.体力上限","char.示例角色.装备.机甲.品质系数","char.示例角色.装备.武器.属性加成","char.示例角色.装备.武器.属性加成.防御","char.示例角色.装备.武器.属性加成.魂力上限","char.示例角色.装备.武器.属性加成.精神力上限","char.示例角色.装备.武器.属性加成.力量","char.示例角色.装备.武器.属性加成.敏捷","char.示例角色.装备.武器.属性加成.体力上限","char.示例角色.状态.横坐标","char.示例角色.状态.吸收灵物年限","char.示例角色.状态.纵坐标","char.示例角色.自创魂技","char.示例角色.自创魂技.示例项","char.示例角色.自创魂技.示例项._效果数组","char.示例角色.自创魂技.示例项._效果数组.[]","char.示例角色.自创魂技.示例项.技能掌控度","char.示例角色.自创魂技.示例项.技能掌控度.圆满等级","char.示例角色.自创魂技.示例项.技能掌控度.中心等级","char.示例角色.自创魂技.示例项.前摇","char.示例角色.自创魂技.示例项.消耗.**","sys","sys.玩家名","world.地点.示例地点.商店.示例商店","world.地点.示例地点.商店.示例商店._下次刷新tick","world.地点.示例地点.商店.示例商店.库存","world.地点.示例地点.商店.示例商店.库存.示例物品","world.地点.示例地点.商店.示例商店.库存.示例物品.价格倍率","world.地点.示例地点.商店.示例商店.库存.示例物品.库存","world.地点.示例地点.商店.示例商店.库存.示例物品.需求","world.地点.示例地点.商店.示例商店.库存.示例物品.需求.示例项","world.地点.示例地点.商店.示例商店.库存.示例物品.需求声望","world.地点.示例地点.商店.示例商店.库存.示例物品.折扣","world.地点.示例地点.子节点.示例项","world.地点.示例地点.x","world.地点.示例地点.y","world.累计击杀年限","world.拍卖.拍品","world.拍卖.拍品.示例项","world.拍卖.拍品.示例项.背景","world.拍卖.拍品.示例项.价格","world.拍卖.拍品.示例项.品级","world.拍卖.地点","world.拍卖.下次刷新tick","world.拍卖.状态","world.偏差倍率","world.时间._上次结算tick","world.时间._calendar","world.图鉴.示例图鉴.成长倾向","world.图鉴.示例图鉴.当前档经验","world.图鉴.示例图鉴.击杀次数","world.图鉴.示例图鉴.交手次数","world.图鉴.示例图鉴.情报协同系数","world.图鉴.示例图鉴.任务协同系数","world.图鉴.示例图鉴.探索收益","world.图鉴.示例图鉴.下档需求","world.图鉴.示例图鉴.战斗标签样本","world.图鉴.示例图鉴.战斗标签样本.示例项","world.图鉴.示例图鉴.战斗收益","world.图鉴.示例图鉴.战斗样本数","world.图鉴.示例图鉴.最近活跃tick","world.图鉴.示例图鉴.最近升档tick","world.图鉴.示例图鉴.最近战斗标签","world.战斗","world.战斗.裁断结果","world.战斗.参战者","world.战斗.参战者.示例项","world.战斗.环境","world.战斗.回合","world.战斗.进行中","world.战斗.先攻","world.战斗.允许撤离","world.战斗.战斗类型","world.战斗.战斗意图","char.示例角色.第1武魂.第1魂灵.第1魂环.第1魂技.前摇","char.示例角色.第1武魂.第1魂灵.第1魂环.第1魂技.消耗.**","char.示例角色.第1武魂.第1魂灵.第1魂环.第1魂技.技能掌控度","char.示例角色.第1武魂.第1魂灵.第1魂环.第1魂技.技能掌控度.圆满等级","char.示例角色.第1武魂.第1魂灵.第1魂环.第1魂技.技能掌控度.中心等级","char.示例角色.魂骨.示例项.属性倍率.**"];
var MVU视图动态段模板_V1 = new Set(['示例角色', '示例物品', '示例地点', '示例动态地点', '示例势力', '示例情报', '示例委托', '示例图鉴', '示例商店', '示例项', '示例人物', '示例身份']);

function 标准化MVU视图路径模板段_V1(片段 = '') {
  const 文本 = String(片段 || '').trim();
  if (!文本) return '';
  if (文本 === '[]' || /^第\d+/.test(文本) || MVU视图动态段模板_V1.has(文本)) return '*';
  return 文本;
}

function 编译MVU视图路径模板_V1(路径列表 = []) {
  return 路径列表
    .map(路径 => {
      const 段列表 = String(路径 || '').split('.').filter(Boolean);
      const 子树 = 段列表.length > 0 && 段列表[段列表.length - 1] === '**';
      const 有效段 = (子树 ? 段列表.slice(0, -1) : 段列表).map(标准化MVU视图路径模板段_V1);
      return { segments: 有效段, subtree: 子树 };
    })
    .filter(模板 => 模板.segments.length > 0);
}

var MVU正文视图排除路径_V1 = 编译MVU视图路径模板_V1(MVU正文视图排除路径模板_V1);
var MVU更新视图排除路径_V1 = 编译MVU视图路径模板_V1(MVU更新视图排除路径模板_V1);

function MVU视图路径匹配_V1(实际路径 = [], 模板 = null) {
  if (!Array.isArray(实际路径) || !模板 || !Array.isArray(模板.segments)) return false;
  const 段列表 = 模板.segments;
  if (模板.subtree) {
    if (实际路径.length < 段列表.length) return false;
  } else if (实际路径.length !== 段列表.length) {
    return false;
  }
  return 段列表.every((模板段, index) => 模板段 === '*' || 模板段 === String(实际路径[index] || ''));
}

function MVU视图路径排除状态_V1(实际路径 = [], 排除路径列表 = []) {
  let 精确排除 = false;
  let 子树排除 = false;
  for (const 模板 of 排除路径列表) {
    if (!MVU视图路径匹配_V1(实际路径, 模板)) continue;
    if (模板.subtree) 子树排除 = true;
    else 精确排除 = true;
    if (子树排除 && 精确排除) break;
  }
  return { 精确排除, 子树排除 };
}

function 正文视图值已初始化_V1(值) {
  if (值 === undefined || 值 === null) return false;
  if (typeof 值 === 'string') {
    const 文本 = 值.trim();
    return !!文本 && 文本 !== '无' && 文本 !== '未知' && 文本 !== '待生成' && !/^待补全/.test(文本) && !/^AI_TODO/.test(文本);
  }
  if (typeof 值 === 'number') return Number.isFinite(Number(值)) && Number(值) !== 0;
  if (typeof 值 === 'boolean') return 值;
  return true;
}

function 格式化运行时受孕tick显示_V1(值 = 0) {
  const 数值 = Number(值);
  if (!Number.isFinite(数值) || 数值 < 0) return '未受孕';
  if (数值 === 0) return '';
  return 格式化运行时绝对tick时间_V1(数值);
}

function 格式化运行时绝对tick时间_V1(tick值 = 0) {
  if (typeof formatTickToCalendarDateText === 'function') return formatTickToCalendarDateText(tick值);
  const 安全tick = Math.max(0, Number(tick值 || 0));
  const 总分钟 = Math.round(安全tick * 10);
  const 总天数 = Math.floor(总分钟 / 1440);
  const 年 = Math.floor(总天数 / 360);
  const 月 = Math.floor((总天数 % 360) / 30) + 1;
  const 日 = (总天数 % 30) + 1;
  const 分钟余量 = 总分钟 % 1440;
  const 小时 = Math.floor(分钟余量 / 60);
  const 分钟 = Math.floor(分钟余量 % 60);
  return `斗罗历${20000 + 年}年${月}月${日}日 ${String(小时).padStart(2, '0')}:${String(分钟).padStart(2, '0')}`;
}

function 格式化运行时tick持续时间_V1(tick值 = 0) {
  if (typeof formatTickDurationAsDayText === 'function') return formatTickDurationAsDayText(tick值);
  const 总分钟 = Math.max(0, Math.round(Number(tick值 || 0) * 10));
  if (!Number.isFinite(总分钟) || 总分钟 <= 0) return '';
  const 天 = Math.floor(总分钟 / 1440);
  const 小时 = Math.floor((总分钟 % 1440) / 60);
  const 分钟 = 总分钟 % 60;
  if (天 > 0) return 小时 > 0 ? `${天}天${小时}小时` : `${天}天`;
  if (小时 > 0) return 分钟 > 0 ? `${小时}小时${分钟}分钟` : `${小时}小时`;
  return `${分钟}分钟`;
}

function 转换运行时文本tick显示_V1(文本 = '') {
  return String(文本 || '').replace(/(\d+(?:\.\d+)?)\s*tick\b/gi, (原文, 数值文本) => {
    const 时长 = 格式化运行时tick持续时间_V1(Number(数值文本));
    return 时长 || 原文;
  });
}

function 格式化运行时tick字段显示_V1(字段名 = '', 值 = '') {
  const 数值 = Number(值);
  if (!Number.isFinite(数值) || 数值 <= 0) return '';
  if (/持续|时长|保留|冷却|间隔|偏移|用时|耗时/.test(String(字段名 || ''))) return 格式化运行时tick持续时间_V1(数值);
  return 格式化运行时绝对tick时间_V1(数值);
}

function 格式化运行时显示字段名_V1(字段名 = '') {
  const 文本 = String(字段名 || '').trim();
  if (!/tick$/i.test(文本)) return 文本;
  const 去后缀 = 文本.replace(/tick$/i, '');
  if (/持续|时长|保留|冷却|间隔|偏移|用时|耗时/.test(去后缀)) return 去后缀 || '时长';
  return `${去后缀 || '发生'}时间`;
}

function 过滤MVU运行时视图值_V1(值, 路径 = [], 选项 = {}) {
  const 排除路径列表 = 选项.排除路径列表 || [];
  const 正文模式 = 选项.正文模式 === true;
  const 更新模式 = 选项.更新模式 === true;
  const 字段名 = String(路径[路径.length - 1] || '');
  if (字段名 === '生理期偏移') return undefined;
  if (字段名 === '受孕tick') return 格式化运行时受孕tick显示_V1(值) || undefined;
  if (字段名 === '死亡tick') return undefined;
  if (字段名 === '死亡类型' && (!String(值 || '').trim() || String(值 || '').trim() === '无')) return undefined;
  if (更新模式) {
    if (路径[0] === 'world' && ['拍卖', '图鉴'].includes(路径[1])) return undefined;
    if (路径[0] === 'world' && 路径[1] === '动态地点' && 字段名 === '势力') return undefined;
    if (路径[0] === 'world' && 路径[1] === '地点' && ['掌控势力', '势力'].includes(字段名)) return undefined;
    if (路径[0] === 'char' && 路径[2] === '魂核') return undefined;
    if (路径[0] === 'char' && 路径[2] === '血脉之力' && 字段名 === '核心') return undefined;
  }
  if (正文模式 && /tick$/i.test(字段名) && typeof 值 !== 'object') return 格式化运行时tick字段显示_V1(字段名, 值) || undefined;
  const 排除状态 = 更新模式
    && 路径[0] === 'char'
    && /^第\d+武魂$/.test(String(路径[2] || ''))
    && 路径[3] === '可调用元素'
    ? { 精确排除: false, 子树排除: false }
    : MVU视图路径排除状态_V1(路径, 排除路径列表);
  if (排除状态.子树排除) return undefined;
  if (排除状态.精确排除 && (值 === undefined || 值 === null || typeof 值 !== 'object')) return undefined;
  if (值 === undefined || 值 === null) return undefined;
  if (Array.isArray(值)) {
    const 数组 = 值
      .map((项, index) => 过滤MVU运行时视图值_V1(项, [...路径, String(index)], 选项))
      .filter(项 => 项 !== undefined);
    return 数组.length ? 数组 : undefined;
  }
  if (typeof 值 === 'object') {
    const 输出 = {};
    Object.entries(值).forEach(([键, 子值]) => {
      const 清理后 = 过滤MVU运行时视图值_V1(子值, [...路径, 键], 选项);
      if (清理后 !== undefined) 输出[键] = 清理后;
    });
    return Object.keys(输出).length ? 输出 : undefined;
  }
  if (正文模式) return 正文视图值已初始化_V1(值) ? (typeof 值 === 'string' ? 转换运行时文本tick显示_V1(值.trim()) : 值) : undefined;
  return 值;
}

function 过滤MVU正文视图值_V1(值, 路径 = []) {
  return 过滤MVU运行时视图值_V1(值, 路径, {
    排除路径列表: MVU正文视图排除路径_V1,
    正文模式: true,
  });
}

function 过滤MVU更新视图值_V1(值, 路径 = []) {
  return 过滤MVU运行时视图值_V1(值, 路径, {
    排除路径列表: MVU更新视图排除路径_V1,
    正文模式: false,
    更新模式: true,
  });
}

function 转义运行时正则文本_V1(文本 = '') {
  return String(文本 || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function 运行时文本命中名称_V1(文本 = '', 名称 = '') {
  const 安全名称 = String(名称 || '').trim();
  if (!安全名称 || 安全名称 === '无' || 安全名称 === '未知') return false;
  return String(文本 || '').includes(安全名称);
}

function 运行时文本命中商品名_V1(文本 = '', 名称 = '') {
  if (运行时文本命中名称_V1(文本, 名称)) return true;
  const 源文本 = String(文本 || '').replace(/\s+/g, '');
  const 商品名 = String(名称 || '').trim().replace(/\s+/g, '');
  if (!源文本 || !商品名 || 商品名 === '无' || 商品名 === '未知') return false;
  const 片段列表 = 商品名
    .split(/[·・、，,／/|｜\-\s（）()【】\[\]《》<>「」]/)
    .map(片段 => 片段.trim())
    .filter(片段 => 片段 && !/^(普通|标准|基础|高级|低级|中级|上级|下级|特制|制式|一份|一件|一瓶|一枚|一株|一个|若干)$/.test(片段));
  if (片段列表.length >= 2 && 片段列表.every(片段 => 源文本.includes(片段))) return true;
  const 核心片段 = 片段列表
    .filter(片段 => 片段.length >= 2)
    .sort((甲, 乙) => 乙.length - 甲.length)[0] || '';
  if (核心片段 && 核心片段.length >= 3 && 源文本.includes(核心片段)) return true;
  const 后缀匹配 = 商品名.match(/([\u4e00-\u9fa5A-Za-z0-9]{2,})(?:丹|药|剂|草|果|茶|酒|肉|饭|糕|饼|汤|票|券|卡|石|晶|矿|骨|甲|剑|枪|刀|锤|弓|杖|环|珠|符|卷|图|书|芯|件|瓶|包)$/);
  return !!(后缀匹配 && 源文本.includes(后缀匹配[1]));
}

function 收集运行时命中键列表_V1(文本 = '', 来源 = {}, 选项 = {}) {
  const 命中函数 = typeof 选项.命中函数 === 'function' ? 选项.命中函数 : 运行时文本命中名称_V1;
  const 结果 = [];
  Object.keys(来源 || {}).forEach(名称 => {
    if (命中函数(文本, 名称)) 结果.push(名称);
  });
  return Array.from(new Set(结果));
}

function 规范化运行时地点名_V1(名称 = '') {
  return String(名称 || '')
    .replace(/^斗罗大陆-/, '')
    .replace(/^斗灵大陆-/, '')
    .trim();
}

function 构建运行时地点路径名_V1(路径 = []) {
  return (Array.isArray(路径) ? 路径 : [])
    .map(片段 => String(片段 || '').trim())
    .filter(Boolean)
    .join('-');
}

function 取运行时地点片段列表_V1(地点 = '') {
  return 规范化运行时地点名_V1(地点)
    .split('-')
    .map(片段 => String(片段 || '').trim())
    .filter(Boolean);
}

function 收口运行时连续重复地点片段_V1(路径 = []) {
  const 结果 = [];
  (Array.isArray(路径) ? 路径 : []).forEach(片段 => {
    const 文本 = String(片段 || '').trim();
    if (文本 && 结果[结果.length - 1] !== 文本) 结果.push(文本);
  });
  return 结果;
}

function 收集运行时静态地点路径候选_V1(数据根 = {}, 地点名 = '') {
  const 目标片段 = 取运行时地点片段列表_V1(地点名);
  const 目标名 = 构建运行时地点路径名_V1(目标片段);
  const 目标叶名 = 目标片段[目标片段.length - 1] || 目标名;
  const 结果 = [];
  const 遍历 = (节点 = null, 名称 = '', 路径 = []) => {
    const 地点名文本 = String(名称 || '').trim();
    if (!地点名文本 || !节点 || typeof 节点 !== 'object' || Array.isArray(节点)) return;
    if (typeof 节点.condition === 'function' && !节点.condition(数据根)) return;
    const 当前路径 = [...路径, 地点名文本];
    const 当前路径名 = 构建运行时地点路径名_V1(当前路径);
    if (地点名文本 === 目标名 || 地点名文本 === 目标叶名 || 当前路径名 === 目标名) 结果.push(当前路径);
    Object.entries(节点.子节点 || {}).forEach(([子名, 子节点]) => 遍历(子节点, 子名, 当前路径));
  };
  Object.entries(数据根?.world?.地点 || {}).forEach(([名称, 节点]) => 遍历(节点, 名称, []));
  return 结果;
}

function 选择运行时静态地点路径_V1(数据根 = {}, 地点名 = '', 当前路径 = []) {
  const 候选 = 收集运行时静态地点路径候选_V1(数据根, 地点名);
  if (!候选.length) return [];
  const 当前 = Array.isArray(当前路径) ? 当前路径.filter(Boolean) : [];
  const 评分 = 路径 => {
    let 分数 = 0;
    const 路径名 = 构建运行时地点路径名_V1(路径);
    const 当前名 = 构建运行时地点路径名_V1(当前);
    if (当前名 && (当前名.startsWith(`${路径名}-`) || 路径名.startsWith(`${当前名}-`) || 当前名 === 路径名)) 分数 += 20;
    路径.forEach((片段, 序号) => {
      if (当前[序号] === 片段) 分数 += 3;
      else if (当前.includes(片段)) 分数 += 1;
    });
    return 分数;
  };
  return [...候选].sort((左, 右) => 评分(右) - 评分(左) || 左.length - 右.length)[0] || [];
}

function 运行时路径前缀匹配长度_V1(完整路径 = [], 前缀 = []) {
  const 路径 = Array.isArray(完整路径) ? 完整路径 : [];
  const 片段 = Array.isArray(前缀) ? 前缀 : [];
  if (!路径.length || !片段.length || 片段.length > 路径.length) return 0;
  for (let 序号 = 0; 序号 < 片段.length; 序号 += 1) {
    if (路径[序号] !== 片段[序号]) return 0;
  }
  return 片段.length;
}

function 运行时路径首尾重叠长度_V1(前段 = [], 后段 = []) {
  const 左 = Array.isArray(前段) ? 前段 : [];
  const 右 = Array.isArray(后段) ? 后段 : [];
  const 最大 = Math.min(左.length, 右.length);
  for (let 长度 = 最大; 长度 >= 1; 长度 -= 1) {
    let 匹配 = true;
    for (let 序号 = 0; 序号 < 长度; 序号 += 1) {
      if (左[左.length - 长度 + 序号] !== 右[序号]) {
        匹配 = false;
        break;
      }
    }
    if (匹配) return 长度;
  }
  return 0;
}

function 解析运行时动态地点显示模型_V1(数据根 = {}, 动态地点名 = '', 动态地点数据 = {}, 当前路径 = []) {
  const keySegments = 取运行时地点片段列表_V1(动态地点名);
  const parentRaw = String(动态地点数据?.归属父节点 || '').trim();
  const parentSegmentsRaw = 取运行时地点片段列表_V1(parentRaw);
  let parentPath = [];
  if (parentSegmentsRaw.length > 1) {
    parentPath = parentSegmentsRaw;
  } else if (parentSegmentsRaw.length === 1) {
    parentPath = 选择运行时静态地点路径_V1(数据根, parentSegmentsRaw[0], 当前路径);
    if (!parentPath.length) parentPath = parentSegmentsRaw;
  }
  if (!parentPath.length && keySegments.length > 1) parentPath = keySegments.slice(0, -1);
  parentPath = 收口运行时连续重复地点片段_V1(parentPath);

  let leafSegments = keySegments.length ? [...keySegments] : [];
  const parentPrefixLength = 运行时路径前缀匹配长度_V1(leafSegments, parentPath);
  if (parentPrefixLength) leafSegments = leafSegments.slice(parentPrefixLength);
  else {
    const rawPrefixLength = 运行时路径前缀匹配长度_V1(leafSegments, parentSegmentsRaw);
    if (rawPrefixLength) leafSegments = leafSegments.slice(rawPrefixLength);
    else {
      const overlapLength = 运行时路径首尾重叠长度_V1(parentPath, leafSegments);
      if (overlapLength) leafSegments = leafSegments.slice(overlapLength);
    }
  }
  const displayLeaf = leafSegments[leafSegments.length - 1] || keySegments[keySegments.length - 1] || String(动态地点名 || '').trim();
  const fillSegments = 收口运行时连续重复地点片段_V1([...parentPath, displayLeaf]);
  const fillTarget = 构建运行时地点路径名_V1(fillSegments) || displayLeaf;
  return {
    key: String(动态地点名 || '').trim(),
    displayLeaf,
    parentPath: 构建运行时地点路径名_V1(parentPath),
    fillTarget,
    pathSegments: fillSegments,
  };
}

function 添加运行时地点匹配词_V1(集合 = new Set(), 值 = '') {
  const 文本 = String(值 || '').trim();
  if (!文本 || 文本 === '无' || 文本 === '未知') return;
  集合.add(文本);
  const 清理名 = 规范化运行时地点名_V1(文本);
  if (清理名) 集合.add(清理名);
  const 后缀列表 = ['分会', '分部', '总部', '协会', '学院', '分店', '驻地', '拍卖场', '杂货店'];
  [文本, 清理名].forEach(原词 => {
    后缀列表.forEach(后缀 => {
      if (原词.endsWith(后缀) && 原词.length > 后缀.length) 集合.add(原词.slice(0, -后缀.length));
    });
  });
}

function 规范化运行时地点搜索文本_V1(值 = '') {
  return String(值 || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[·・、，,。；;：:！!？?'"“”‘’（）()【】\[\]《》<>「」]/g, '')
    .trim();
}

function 构建运行时地点二字片段集合_V1(值 = '') {
  const 文本 = 规范化运行时地点搜索文本_V1(值);
  const 结果 = new Set();
  for (let 序号 = 0; 序号 < 文本.length - 1; 序号 += 1) {
    const 片段 = 文本.slice(序号, 序号 + 2);
    if (/^[\u4e00-\u9fa5a-z0-9]{2}$/.test(片段)) 结果.add(片段);
  }
  return 结果;
}

function 运行时地点搜索词来自父级_V1(搜索词 = '', 父级集合 = new Set()) {
  const 词 = 规范化运行时地点搜索文本_V1(搜索词);
  if (!词 || 词.length < 2 || !(父级集合 instanceof Set) || !父级集合.size) return false;
  return Array.from(父级集合).some(父级 => {
    const 父级词 = 规范化运行时地点搜索文本_V1(父级);
    return 父级词 && 父级词 !== 词 && 父级词.includes(词);
  });
}

function 计算运行时地点词证据_V1(文本 = '', 匹配词 = '', 父级集合 = new Set()) {
  const 源文本 = 规范化运行时地点搜索文本_V1(文本);
  const 词 = 规范化运行时地点搜索文本_V1(匹配词);
  if (!源文本 || !词 || 词 === '无' || 词 === '未知') return null;
  if (!运行时地点搜索词来自父级_V1(词, 父级集合) && 源文本.includes(词)) {
    return { 等级: '完整', 分数: 1, 片段: [String(匹配词 || '').trim()] };
  }
  const 文本片段 = 构建运行时地点二字片段集合_V1(源文本);
  const 词片段 = 构建运行时地点二字片段集合_V1(词);
  const 共享片段 = Array.from(词片段).filter(片段 => 文本片段.has(片段) && !运行时地点搜索词来自父级_V1(片段, 父级集合));
  if (!共享片段.length) return null;
  const 相似度 = (共享片段.length * 2) / Math.max(1, 文本片段.size + 词片段.size);
  if (共享片段.length >= 2 || 相似度 >= 0.45) return { 等级: '向量', 分数: 相似度, 片段: 共享片段 };
  return { 等级: '双字', 分数: 相似度, 片段: 共享片段 };
}

function 运行时地点行为语义命中_V1(文本 = '') {
  return /前往|去往|赶往|抵达|进入|走进|来到|返回|离开|路过|附近|位置|地点|城市|街区|区域|学院|协会|分会|商店|店铺/.test(String(文本 || ''));
}

function 收口运行时地点父级前缀污染_V1(集合 = new Set(), 父级列表 = []) {
  if (!(集合 instanceof Set) || !集合.size) return;
  const 前缀集合 = new Set();
  const 后缀列表 = ['城', '市', '镇', '村', '国', '大陆', '区域', '地区'];
  (Array.isArray(父级列表) ? 父级列表 : []).forEach(父级 => {
    const 父级名 = 规范化运行时地点名_V1(父级);
    if (!父级名 || 父级名 === '无' || 父级名 === '未知') return;
    前缀集合.add(父级名);
    后缀列表.forEach(后缀 => {
      if (父级名.endsWith(后缀) && 父级名.length > 后缀.length + 1) 前缀集合.add(父级名.slice(0, -后缀.length));
    });
  });
  if (!前缀集合.size) return;
  Array.from(集合).forEach(词 => {
    const 匹配词 = 规范化运行时地点名_V1(词);
    if (!匹配词) return;
    for (const 前缀 of 前缀集合) {
      if (匹配词 === 前缀) {
        集合.delete(词);
        return;
      }
      if (匹配词.startsWith(前缀) && 匹配词.length > 前缀.length + 1) {
        集合.delete(词);
        添加运行时地点匹配词_V1(集合, 匹配词.slice(前缀.length));
        return;
      }
    }
  });
}

function 运行时地点匹配词命中文本_V1(文本 = '', 匹配词 = '') {
  return !!计算运行时地点词证据_V1(文本, 匹配词);
}

function 构建运行时地点索引_V1(数据根 = {}) {
  const 静态地点 = [];
  const 动态地点 = [];
  const 遍历静态 = (节点 = null, 名称 = '', 路径 = []) => {
    const 地点名 = String(名称 || '').trim();
    if (!地点名 || !节点 || typeof 节点 !== 'object' || Array.isArray(节点)) return;
    if (typeof 节点.condition === 'function' && !节点.condition(数据根)) return;
    const 当前路径 = [...路径, 地点名];
    const 地点词 = new Set();
    const 势力词 = new Set();
    const 商店词 = new Set();
    const 商品词 = new Set();
    添加运行时地点匹配词_V1(地点词, 地点名);
    添加运行时地点匹配词_V1(势力词, 节点.掌控势力);
    Object.entries(节点.商店 || {}).forEach(([商店名, 商店数据]) => {
      添加运行时地点匹配词_V1(商店词, 商店名);
      Object.keys(商店数据?.库存 || {}).forEach(商品名 => 添加运行时地点匹配词_V1(商品词, 商品名));
    });
    收口运行时地点父级前缀污染_V1(地点词, 当前路径.slice(0, -1));
    收口运行时地点父级前缀污染_V1(商店词, 当前路径.slice(0, -1));
    const 匹配词 = new Set([...地点词, ...势力词, ...商店词, ...商品词]);
    静态地点.push({
      类型: '地点',
      名称: 地点名,
      输出名: 构建运行时地点路径名_V1(当前路径),
      路径: 当前路径,
      父节点: 当前路径.length >= 2 ? 当前路径[当前路径.length - 2] : '',
      顶层: 当前路径[0] || '',
      地点词: Array.from(地点词).filter(词 => 词.length >= 2),
      势力词: Array.from(势力词).filter(词 => 词.length >= 2),
      商店词: Array.from(商店词).filter(词 => 词.length >= 2),
      商品词: Array.from(商品词).filter(词 => 词.length >= 2),
      匹配词: Array.from(匹配词).filter(词 => 词.length >= 2),
    });
    Object.entries(节点.子节点 || {}).forEach(([子名, 子节点]) => 遍历静态(子节点, 子名, 当前路径));
  };
  Object.entries(数据根?.world?.地点 || {}).forEach(([名称, 节点]) => 遍历静态(节点, 名称, []));
  const 当前范围 = 取运行时当前范围_V1(数据根);
  const 当前路径 = Array.isArray(当前范围?.当前地点信息?.path) ? 当前范围.当前地点信息.path : [];
  Object.entries(数据根?.world?.动态地点 || {}).forEach(([名称, 地点数据]) => {
    const 地点名 = String(名称 || '').trim();
    if (!地点名 || !地点数据 || typeof 地点数据 !== 'object' || Array.isArray(地点数据)) return;
    const 父节点 = String(地点数据.归属父节点 || '').trim();
    const 显示模型 = 解析运行时动态地点显示模型_V1(数据根, 地点名, 地点数据, 当前路径);
    const 地点词 = new Set();
    const 势力词 = new Set();
    添加运行时地点匹配词_V1(地点词, 地点名);
    添加运行时地点匹配词_V1(地点词, 显示模型.displayLeaf);
    添加运行时地点匹配词_V1(地点词, 显示模型.fillTarget);
    添加运行时地点匹配词_V1(地点词, 显示模型.parentPath);
    添加运行时地点匹配词_V1(势力词, 地点数据.势力);
    收口运行时地点父级前缀污染_V1(地点词, [...取运行时地点片段列表_V1(父节点), ...取运行时地点片段列表_V1(显示模型.parentPath)]);
    const 匹配词 = new Set([...地点词, ...势力词]);
    动态地点.push({
      类型: '动态地点',
      名称: 地点名,
      输出名: 显示模型.fillTarget || 地点名,
      父节点,
      显示叶名: 显示模型.displayLeaf,
      父级路径: 显示模型.parentPath,
      地点词: Array.from(地点词).filter(词 => 词.length >= 2),
      势力词: Array.from(势力词).filter(词 => 词.length >= 2),
      商店词: [],
      商品词: [],
      匹配词: Array.from(匹配词).filter(词 => 词.length >= 2),
    });
  });
  return { 静态地点, 动态地点 };
}

function 收集运行时地点父级上下文_V1(数据根 = {}, 文本 = '', 选项 = {}) {
  const 索引 = 选项.地点索引 || 构建运行时地点索引_V1(数据根);
  const 父级 = new Set();
  const 添加 = 值 => {
    const 文本值 = 规范化运行时地点名_V1(值);
    if (!文本值 || 文本值 === '无' || 文本值 === '未知') return;
    父级.add(文本值);
    文本值.split('-').map(项 => 项.trim()).filter(Boolean).forEach(片段 => 父级.add(片段));
  };
  const 当前范围 = 取运行时当前范围_V1(数据根);
  const 当前路径 = Array.isArray(当前范围?.当前地点信息?.path) ? 当前范围.当前地点信息.path : [];
  if (当前路径.length) 添加(构建运行时地点路径名_V1(当前路径));
  当前路径.forEach(添加);
  添加(当前范围?.当前上下文节点);
  [
    选项.归属父节点,
    选项.父节点,
    选项.当前地点,
    选项.模块路由?.请求?.归属父节点,
    选项.模块路由?.请求?.父节点,
  ].forEach(添加);
  索引.静态地点.forEach(条目 => {
    if (条目.路径.length === 1 && 运行时文本命中名称_V1(文本, 条目.名称)) 添加(条目.名称);
  });
  收集运行时字符串列表_V1(
    选项.命中地点,
    数据根?.相关实体索引?.命中地点,
    选项.命中动态地点,
    数据根?.相关实体索引?.命中动态地点,
  ).forEach(名称 => {
    const 动态 = 索引.动态地点.find(条目 => 条目.名称 === 名称 || 条目.输出名 === 名称);
    if (动态?.父节点) 添加(动态.父节点);
    添加(名称);
  });
  return 父级;
}

function 运行时地点条目在父级范围_V1(条目 = {}, 父级集合 = new Set()) {
  if (!(父级集合 instanceof Set) || !父级集合.size) return false;
  if (条目.类型 === '动态地点') {
    const 父节点 = 规范化运行时地点名_V1(条目.父节点);
    if (!父节点) return false;
    if (父级集合.has(父节点)) return true;
    const 顶层父节点 = 父节点.split('-').map(片段 => 片段.trim()).filter(Boolean)[0];
    return !!顶层父节点 && 父级集合.has(顶层父节点);
  }
  const 路径 = Array.isArray(条目.路径) ? 条目.路径 : [];
  if (!路径.length) return false;
  if (路径.length === 1) return 父级集合.has(路径[0]);
  for (let 长度 = 1; 长度 < 路径.length; 长度 += 1) {
    if (父级集合.has(构建运行时地点路径名_V1(路径.slice(0, 长度)))) return true;
  }
  return 父级集合.has(路径[0]);
}

function 计算运行时地点命中_V1(条目 = {}, 文本 = '', 父级集合 = new Set()) {
  const 捕获文本 = String(文本 || '');
  if (!条目 || typeof 条目 !== 'object') return null;
  const 名称 = String(条目.名称 || '').trim();
  const 输出名 = String(条目.输出名 || 名称).trim();
  if (!名称) return null;
  const 来源 = [];
  let 分数 = 0;
  const 在父级范围 = 运行时地点条目在父级范围_V1(条目, 父级集合);
  const 顶层静态地点 = 条目.类型 === '地点' && Array.isArray(条目.路径) && 条目.路径.length <= 1;
  let 强证据 = 0;
  let 中证据 = 0;
  let 弱证据 = 0;
  const 证据类别 = new Set();
  const 交易语义 = 正文需要商店库存_V1(捕获文本);
  const 地点语义 = 运行时地点行为语义命中_V1(捕获文本);
  if (运行时文本命中名称_V1(捕获文本, 输出名) || ((顶层静态地点 || 在父级范围) && 运行时文本命中名称_V1(捕获文本, 名称))) {
    分数 += 10;
    来源.push('精确名');
    强证据 += 1;
    证据类别.add('地点');
  }
  if (在父级范围) {
    [
      ['地点', 条目.地点词, 7],
      ['商店', 条目.商店词, 7],
      ['商品', 条目.商品词, 6],
      ['势力', 条目.势力词, 3],
    ].forEach(([类别, 词列表, 基准分]) => {
      (Array.isArray(词列表) ? 词列表 : []).forEach(词 => {
        const 证据 = 计算运行时地点词证据_V1(捕获文本, 词, 父级集合);
        if (!证据) return;
        const 商品弱化 = 类别 === '商品' && !交易语义;
        const 势力弱化 = 类别 === '势力';
        if (证据.等级 === '完整' && !商品弱化 && !势力弱化) {
          强证据 += 1;
          分数 += 基准分;
          来源.push(`${类别}完整:${词}`);
        } else if (证据.等级 === '向量' || (证据.等级 === '完整' && (商品弱化 || 势力弱化))) {
          中证据 += 商品弱化 || 势力弱化 ? 0 : 1;
          弱证据 += 商品弱化 || 势力弱化 ? 1 : 0;
          分数 += Math.max(2, Math.round(基准分 * (商品弱化 || 势力弱化 ? 0.45 : 0.7)));
          来源.push(`${类别}向量:${词}/${证据.片段.slice(0, 3).join('/')}`);
        } else {
          弱证据 += 1;
          分数 += Math.max(1, Math.round(基准分 * 0.35));
          来源.push(`${类别}双字:${词}/${证据.片段.slice(0, 2).join('/')}`);
        }
        证据类别.add(类别);
      });
    });
  }
  const 通过交火 =
    强证据 > 0 ||
    (在父级范围 && 中证据 > 0) ||
    (在父级范围 && 弱证据 >= 2 && 证据类别.size >= 2) ||
    (在父级范围 && 地点语义 && 弱证据 >= 1 && (证据类别.has('地点') || 证据类别.has('商店'))) ||
    (在父级范围 && 交易语义 && 证据类别.has('商品') && 弱证据 >= 1);
  if (分数 <= 0 || !通过交火) return null;
  if (在父级范围) {
    来源.push('父级限定');
  }
  return { 类型: 条目.类型, 名称: 输出名, 原名: 名称, 路径: 条目.路径, 父节点: 条目.父节点, 分数, 来源 };
}

function 收集运行时地点命中_V1(数据输入 = {}, 文本 = '', 选项 = {}) {
  const 数据根 = 读取运行时Mvu数据根_V1(数据输入) || {};
  const 源文本 = 清理提示审计扫描文本_V1(文本);
  const 索引 = 选项.地点索引 || 构建运行时地点索引_V1(数据根);
  const 父级集合 = 收集运行时地点父级上下文_V1(数据根, 源文本, { ...选项, 地点索引: 索引 });
  const 阈值 = Math.max(1, Math.floor(Number(选项.阈值 ?? 1)));
  const 上限 = Math.max(1, Math.floor(Number(选项.上限 ?? 16)));
  return 索引.静态地点
    .map(条目 => 计算运行时地点命中_V1(条目, 源文本, 父级集合))
    .filter(命中 => 命中 && 命中.分数 >= 阈值)
    .sort((左, 右) => 右.分数 - 左.分数 || 左.名称.localeCompare(右.名称, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' }))
    .slice(0, 上限);
}

function 收集运行时父级限定动态地点命中_V1(数据输入 = {}, 文本 = '', 选项 = {}) {
  const 数据根 = 读取运行时Mvu数据根_V1(数据输入) || {};
  const 源文本 = 清理提示审计扫描文本_V1(文本);
  const 索引 = 选项.地点索引 || 构建运行时地点索引_V1(数据根);
  const 父级集合 = 收集运行时地点父级上下文_V1(数据根, 源文本, { ...选项, 地点索引: 索引 });
  const 阈值 = Math.max(1, Math.floor(Number(选项.阈值 ?? 1)));
  const 上限 = Math.max(1, Math.floor(Number(选项.上限 ?? 12)));
  return 索引.动态地点
    .map(条目 => 计算运行时地点命中_V1(条目, 源文本, 父级集合))
    .filter(命中 => 命中 && 命中.分数 >= 阈值)
    .sort((左, 右) => 右.分数 - 左.分数 || 左.名称.localeCompare(右.名称, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' }))
    .slice(0, 上限);
}

function 收集运行时地图命中键列表_V1(数据根 = {}, 文本 = '') {
  return 收集运行时地点命中_V1(数据根, 文本, { 上限: 24 }).map(命中 => 命中.名称);
}

function 运行时文本包含片段_V1(文本 = '', 片段 = '') {
  const 左 = String(文本 || '').toLowerCase();
  const 右 = String(片段 || '').trim().toLowerCase();
  return 右.length >= 2 && 左.includes(右);
}

function 收集运行时字符串列表_V1(...值列表) {
  const 结果 = new Set();
  const 添加 = 值 => {
    if (Array.isArray(值)) {
      值.forEach(添加);
      return;
    }
    if (值 && typeof 值 === 'object') {
      Object.values(值).forEach(添加);
      return;
    }
    const 文本 = String(值 ?? '').trim();
    if (文本 && 文本 !== '无' && 文本 !== '未知') 结果.add(文本);
  };
  值列表.forEach(添加);
  return Array.from(结果);
}

function 切分运行时实体关键词_V1(...文本列表) {
  const 停用词 = new Set(['无', '未知', '普通', '标准', '基础', '高级', '低级', '中级', '上级', '下级', '动态地点', '物品', '道具', '装备', '材料']);
  const 关键词 = new Set();
  文本列表
    .map(文本 => String(文本 || '').trim())
    .filter(Boolean)
    .forEach(文本 => {
      文本
        .replace(/[，。；：！？、,.!?;:()[\]{}【】《》<>「」『』"'“”‘’|｜/\\]+/g, ' ')
        .split(/\s+|-/)
        .map(片段 => 片段.trim())
        .filter(片段 => 片段.length >= 2 && !停用词.has(片段))
        .slice(0, 24)
        .forEach(片段 => 关键词.add(片段));
    });
  return Array.from(关键词).sort((左, 右) => 右.length - 左.length).slice(0, 16);
}

function 构建运行时动态地点目录项_V1(地点名 = '', 地点数据 = {}) {
  const 名称片段 = String(地点名 || '').split('-').map(片段 => 片段.trim()).filter(Boolean);
  const 简称列表 = Array.from(new Set([名称片段[名称片段.length - 1] || '', ...名称片段].filter(片段 => 片段 && 片段.length >= 2)));
  const 摘要 = [
    地点名,
    地点数据?.归属父节点,
    地点数据?.势力,
    地点数据?.状态 || 地点数据?.state,
  ].filter(Boolean).join(' / ').slice(0, 160);
  return {
    归属父节点: String(地点数据?.归属父节点 || ''),
    势力: String(地点数据?.势力 || ''),
    简称列表: Array.isArray(地点数据?.简称列表) ? 地点数据.简称列表 : 简称列表,
    关键词: Array.isArray(地点数据?.关键词) ? 地点数据.关键词 : 切分运行时实体关键词_V1(地点名, 摘要, 地点数据?.描述, 地点数据?.状态),
  };
}

function 构建运行时物品目录项_V1(物品名 = '', 物品定义 = {}, 物品分类 = '') {
  const 分类 = String(物品分类 || 物品定义?.物品分类 || 物品定义?.分类 || '').trim();
  const 摘要 = [
    物品名,
    分类,
    物品定义?.品质,
    物品定义?.装备槽位,
    物品定义?.描述,
  ].filter(Boolean).join(' / ').slice(0, 160);
  return {
    物品分类: 分类,
    品质: String(物品定义?.品质 || ''),
    装备槽位: String(物品定义?.装备槽位 || ''),
    关键词: Array.isArray(物品定义?.关键词) ? 物品定义.关键词 : 切分运行时实体关键词_V1(物品名, 摘要, 物品定义?.描述),
  };
}

function 构建运行时动态地点目录_V1(数据根 = {}, 目录 = null) {
  const 来源 = 目录 && typeof 目录 === 'object' && !Array.isArray(目录) ? 目录 : 数据根?.world?.动态地点 || {};
  const 结果 = {};
  Object.entries(来源 || {}).forEach(([名称, 数据]) => {
    if (!名称 || !数据 || typeof 数据 !== 'object' || Array.isArray(数据)) return;
    结果[名称] = 构建运行时动态地点目录项_V1(名称, 数据);
  });
  return 结果;
}

function 构建运行时物品目录_V1(数据根 = {}, 目录 = null) {
  if (目录 && typeof 目录 === 'object' && !Array.isArray(目录)) {
    const 结果 = {};
    Object.entries(目录).forEach(([名称, 数据]) => {
      if (!名称 || !数据 || typeof 数据 !== 'object' || Array.isArray(数据)) return;
      结果[名称] = 构建运行时物品目录项_V1(名称, 数据, 数据.物品分类 || 数据.分类);
    });
    return 结果;
  }
  const 结果 = {};
  遍历物品定义_V1(数据根?.物品 || {}, (物品名, 定义, 分类) => {
    结果[物品名] = 构建运行时物品目录项_V1(物品名, 定义, 分类);
  });
  收集运行时商店商品名_V1(数据根).forEach(物品名 => {
    if (!物品名 || 结果[物品名]) return;
    const 命中 = 查找运行时物品定义_V1(数据根, 物品名);
    if (命中 && 命中.定义 && typeof 命中.定义 === 'object')
      结果[物品名] = 构建运行时物品目录项_V1(物品名, 命中.定义, 命中.分类);
  });
  return 结果;
}

function 构建内置物品平铺表_V1() {
  const 结果 = {};
  遍历物品定义_V1(读取内置物品库_V1(), (物品名, 定义, 分类) => {
    结果[物品名] = { ...cloneJsonValue(定义, {}), 物品分类: 分类 };
  });
  return 结果;
}

function 查找内置物品定义_V1(物品名 = '') {
  const 名称 = String(物品名 || '').trim();
  if (!名称) return null;
  let 结果 = null;
  遍历物品定义_V1(读取内置物品库_V1(), (当前名, 定义, 分类) => {
    if (!结果 && 当前名 === 名称) 结果 = { 物品名: 当前名, 定义, 分类 };
  });
  return 结果;
}

function 收集运行时商店商品名_V1(数据根 = {}) {
  const 名称集合 = new Set();
  Object.values(数据根?.world?.地点 || {}).forEach(地点 => {
    Object.values(地点?.商店 || {}).forEach(商店 => {
      Object.keys(商店?.库存 || {}).forEach(物品名 => {
        const 名称 = String(物品名 || '').trim();
        if (名称) 名称集合.add(名称);
      });
    });
  });
  return Array.from(名称集合);
}

function 收集运行时物品候选名_V1(数据根 = {}, 文本 = '', 选项 = {}) {
  const 候选 = new Set();
  const 添加 = 值 => 收集运行时字符串列表_V1(值).forEach(名称 => 候选.add(名称));
  添加(选项.命中物品);
  添加(选项.相关物品);
  添加(选项.候选物品);
  添加(数据根?.相关实体索引?.命物品);
  添加(选项.模块路由?.请求?.物品);
  添加(选项.模块路由?.请求?.目标);
  添加(选项.模块路由?.请求?.材料);
  const 角色名列表 = Array.from(选项.角色名集合 || []);
  角色名列表.forEach(角色名 => {
    const 角色 = 数据根?.char?.[角色名];
    Object.keys(角色?.背包 || {}).forEach(物品名 => {
      if (运行时文本命中商品名_V1(文本, 物品名)) 候选.add(物品名);
    });
  });
  Object.values(数据根?.world?.地点 || {}).forEach(地点 => {
    Object.values(地点?.商店 || {}).forEach(商店 => {
      Object.keys(商店?.库存 || {}).forEach(物品名 => {
        if (运行时文本命中商品名_V1(文本, 物品名)) 候选.add(物品名);
      });
    });
  });
  return Array.from(候选);
}

function 构建运行时物品候选上下文_V1(数据根 = {}, 文本 = '', 选项 = {}) {
  const 来源列表 = Array.isArray(选项.候选物品列表)
    ? 选项.候选物品列表
    : 收集运行时物品候选名_V1(数据根, 文本, 选项);
  const 候选物品列表 = Array.from(new Set(来源列表.map(名称 => String(名称 || '').trim()).filter(Boolean)));
  const 候选物品集合 = 选项.候选物品集合 instanceof Set
    ? 选项.候选物品集合
    : new Set(候选物品列表);
  return { 候选物品列表, 候选物品集合 };
}

function 计算运行时动态地点命中_V1(地点名 = '', 索引 = {}, 文本 = '', 数据根 = {}, 选项 = {}) {
  const 名称 = String(地点名 || '').trim();
  if (!名称) return null;
  const 当前地点文本 = [
    选项.当前地点,
    数据根?.当前?.地点,
    数据根?.world?.战斗?.环境?.地点,
  ].filter(Boolean).join('\n');
  const 相关动态地点 = 收集运行时字符串列表_V1(
    选项.命中动态地点,
    选项.相关动态地点,
    数据根?.相关实体索引?.命中动态地点,
  );
  let 分数 = 0;
  let 有本轮锚点 = false;
  const 来源 = [];
  if (运行时文本包含片段_V1(文本, 名称)) {
    分数 += 8;
    有本轮锚点 = true;
    来源.push('完整名');
  }
  if (相关动态地点.some(候选 => 候选 === 名称)) {
    分数 += 8;
    有本轮锚点 = true;
    来源.push('相关实体索引');
  }
  const 简称列表 = Array.isArray(索引?.简称列表) ? 索引.简称列表 : [];
  简称列表.forEach(简称 => {
    if (简称 !== 名称 && 运行时文本包含片段_V1(文本, 简称)) {
      分数 += 3;
      有本轮锚点 = true;
      来源.push(`简称:${简称}`);
    }
  });
  const 关键词命中 = (Array.isArray(索引?.关键词) ? 索引.关键词 : []).filter(关键词 => 运行时文本包含片段_V1(文本, 关键词));
  if (关键词命中.length > 0) {
    分数 += Math.min(3, 关键词命中.length);
    有本轮锚点 = true;
    来源.push(`关键词:${关键词命中.slice(0, 3).join('/')}`);
  }
  if (!有本轮锚点) return null;
  const 归属 = String(索引?.归属父节点 || '').trim();
  if (归属 && (运行时文本包含片段_V1(文本, 归属) || 运行时文本包含片段_V1(当前地点文本, 归属))) {
    分数 += 2;
    来源.push('归属父节点');
  }
  if (运行时文本包含片段_V1(当前地点文本, 名称) || (归属 && 运行时文本包含片段_V1(名称, 当前地点文本))) {
    分数 += 3;
    来源.push('当前地点');
  }
  if (归属 && 运行时文本包含片段_V1(当前地点文本, 归属)) {
    分数 += 1;
    来源.push('当前父级');
  }
  return { 类型: '动态地点', 名称, 分数, 来源 };
}

function 计算运行时物品命中_V1(物品名 = '', 索引 = {}, 文本 = '', 数据根 = {}, 选项 = {}) {
  const 名称 = String(物品名 || '').trim();
  if (!名称) return null;
  const { 候选物品列表, 候选物品集合 } = 构建运行时物品候选上下文_V1(数据根, 文本, 选项);
  let 分数 = 0;
  const 来源 = [];
  if (运行时文本命中商品名_V1(文本, 名称)) {
    分数 += 7;
    来源.push('商品名');
  }
  if (候选物品集合.has(名称)) {
    分数 += 9;
    来源.push('候选物品');
  }
  if (候选物品列表.some(候选 => 候选 !== 名称 && (运行时文本包含片段_V1(候选, 名称) || 运行时文本包含片段_V1(名称, 候选)))) {
    分数 += 5;
    来源.push('候选片段');
  }
  const 名称片段 = 名称
    .replace(/[，。；：！？、,.!?;:()[\]{}【】《》<>「」『』"'“”‘’|｜/\\]+/g, ' ')
    .split(/\s+|-/)
    .map(片段 => 片段.trim())
    .filter(片段 => 片段.length >= 2 && 片段 !== 名称);
  const 名称片段命中数 = 名称片段.filter(片段 => 运行时文本包含片段_V1(文本, 片段)).length;
  if (名称片段命中数 > 0) {
    分数 += Math.min(4, 名称片段命中数 * 2);
    来源.push('名称片段');
  }
  const 关键词命中 = (Array.isArray(索引?.关键词) ? 索引.关键词 : []).filter(关键词 => 运行时文本包含片段_V1(文本, 关键词));
  if (关键词命中.length > 0) {
    分数 += Math.min(4, 关键词命中.length);
    来源.push(`关键词:${关键词命中.slice(0, 3).join('/')}`);
  }
  ['物品分类', '品质', '装备槽位'].forEach(字段 => {
    if (运行时文本包含片段_V1(文本, 索引?.[字段])) {
      分数 += 1;
      来源.push(字段);
    }
  });
  return 分数 > 0 ? { 类型: '物品', 名称, 分数, 来源 } : null;
}

function 收集运行时动态地点命中_V1(数据输入 = {}, 文本 = '', 选项 = {}) {
  const 数据根 = 读取运行时Mvu数据根_V1(数据输入) || {};
  const 源文本 = 清理提示审计扫描文本_V1(文本);
  if (选项.动态地点目录 && typeof 选项.动态地点目录 === 'object') {
    const 目录 = 构建运行时动态地点目录_V1(数据根, 选项.动态地点目录);
    const 阈值 = Math.max(1, Math.floor(Number(选项.阈值 ?? 5)));
    const 上限 = Math.max(1, Math.floor(Number(选项.上限 ?? 8)));
    return Object.entries(目录)
      .map(([名称, 索引]) => 计算运行时动态地点命中_V1(名称, 索引, 源文本, 数据根, 选项))
      .filter(命中 => 命中 && 命中.分数 >= 阈值)
      .sort((左, 右) => 右.分数 - 左.分数 || 左.名称.localeCompare(右.名称, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' }))
      .slice(0, 上限);
  }
  return 收集运行时父级限定动态地点命中_V1(数据根, 源文本, {
    ...选项,
    阈值: Math.max(1, Math.floor(Number(选项.阈值 ?? 1))),
    上限: Math.max(1, Math.floor(Number(选项.上限 ?? 8))),
  });
}

function 收集运行时物品命中_V1(数据输入 = {}, 文本 = '', 选项 = {}) {
  const 数据根 = 读取运行时Mvu数据根_V1(数据输入) || {};
  const 源文本 = 清理提示审计扫描文本_V1(文本);
  const 目录 = 构建运行时物品目录_V1(数据根, 选项.物品目录);
  const 物品候选上下文 = 构建运行时物品候选上下文_V1(数据根, 源文本, 选项);
  const 命中选项 = { ...选项, ...物品候选上下文 };
  const 阈值 = Math.max(1, Math.floor(Number(选项.阈值 ?? 5)));
  const 上限 = Math.max(1, Math.floor(Number(选项.上限 ?? 12)));
  return Object.entries(目录)
    .map(([名称, 索引]) => 计算运行时物品命中_V1(名称, 索引, 源文本, 数据根, 命中选项))
    .filter(命中 => 命中 && 命中.分数 >= 阈值)
    .sort((左, 右) => 右.分数 - 左.分数 || 左.名称.localeCompare(右.名称, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' }))
    .slice(0, 上限);
}

function 读取运行时Mvu数据根_V1(变量包 = null) {
  const 来源 = 变量包 && typeof 变量包 === 'object' ? 变量包 : null;
  if (来源?.stat_data && typeof 来源.stat_data === 'object') return 来源.stat_data;
  if (来源?.display_data && typeof 来源.display_data === 'object') return 来源.display_data;
  return 来源 && typeof 来源 === 'object' ? 来源 : {};
}

function 获取最新运行时Mvu数据根_V1() {
  try {
    const 接口 = globalThis.Mvu && typeof globalThis.Mvu.getMvuData === 'function' ? globalThis.Mvu : null;
    const 变量包 = 接口 ? 接口.getMvuData({ type: 'message', message_id: 'latest' }) : null;
    return 读取运行时Mvu数据根_V1(变量包);
  } catch (错误) {
    return {};
  }
}

function 读取运行时Mvu数据根或最新_V1(变量包 = null) {
  if (变量包 === null || 变量包 === undefined) return 获取最新运行时Mvu数据根_V1();
  return 读取运行时Mvu数据根_V1(变量包);
}

function 取运行时玩家名_V1(数据根 = {}) {
  const 角色表 = 数据根?.char && typeof 数据根.char === 'object' ? 数据根.char : {};
  const 玩家名 = String(数据根?.sys?.玩家名 || '').trim();
  if (玩家名 && (!Object.keys(角色表).length || 角色表[玩家名])) return 玩家名;
  const 标记玩家条目 = Object.entries(角色表).find(([, 角色]) => 角色 && typeof 角色 === 'object' && 角色.__mvu_isPlayer === true);
  if (标记玩家条目?.[0]) return 标记玩家条目[0];
  if (玩家名) return 玩家名;
  const 首个角色名 = Object.keys(角色表)[0] || '';
  return 首个角色名;
}

function 标准化运行时地点片段_V1(地点 = '') {
  const raw = String(地点 || '')
    .replace(/^斗罗大陆-/, '')
    .replace(/^斗灵大陆-/, '')
    .trim();
  const segments = raw.split('-').filter(Boolean);
  return { raw, leaf: segments[segments.length - 1] || raw, segments };
}

function 运行时地点兼容_V1(当前地点 = '', 目标地点 = '') {
  if (['', '无', '未知', '待生成'].includes(String(当前地点 || '').trim())) return false;
  if (['', '无', '未知', '待生成'].includes(String(目标地点 || '').trim())) return false;
  const 当前 = 标准化运行时地点片段_V1(当前地点);
  const 目标 = 标准化运行时地点片段_V1(目标地点);
  if (!当前.raw || !目标.raw) return false;
  if (当前.raw === 目标.raw || 当前.leaf === 目标.leaf) return true;
  return 当前.segments.some(片段 => 目标.segments.includes(片段));
}

function 取运行时当前范围_V1(数据根 = {}) {
  const 玩家名 = 取运行时玩家名_V1(数据根);
  const 玩家 = 数据根?.char?.[玩家名] || {};
  const 当前地点 = 玩家?.状态?.位置 || '未知';
  const 当前地点信息 = typeof findMapNodeEntry === 'function' ? findMapNodeEntry(当前地点, 数据根) : null;
  let 当前上下文节点 = 当前地点信息?.path?.length ? 当前地点信息.path[当前地点信息.path.length - 1] : 当前地点;
  if (数据根?.world?.动态地点?.[当前地点]?.归属父节点) {
    当前上下文节点 = 数据根.world.动态地点[当前地点].归属父节点 || 当前上下文节点 || '斗罗大陆';
  }
  const 路径片段 = Array.isArray(当前地点信息?.path) ? 当前地点信息.path : [];
  const 当前地点片段 = 标准化运行时地点片段_V1(当前地点).segments;
  const 当前范围名集合 = new Set([当前上下文节点, ...路径片段, ...当前地点片段].filter(Boolean));
  return { 玩家名, 玩家, 当前地点, 当前地点信息, 当前上下文节点, 当前范围名集合 };
}

function 运行时动态地点在当前范围_V1(动态地点名 = '', 动态地点数据 = {}, 当前范围名集合 = new Set()) {
  const 父节点 = String(动态地点数据?.归属父节点 || '').trim();
  const 父节点片段 = 标准化运行时地点片段_V1(父节点).segments;
  const 动态片段 = 标准化运行时地点片段_V1(动态地点名).segments;
  if (父节点 && 当前范围名集合.has(父节点)) return true;
  if (父节点片段.some(片段 => 当前范围名集合.has(片段))) return true;
  if (动态片段.some(片段 => 当前范围名集合.has(片段))) return true;
  return false;
}

function 中文化地图状态_V1(状态 = '') {
  const 文本 = String(状态 || '').trim();
  if (!文本) return '';
  const 映射 = {
    intact: '完好',
    active: '活跃',
    inactive: '未激活',
    damaged: '受损',
    destroyed: '毁坏',
    locked: '封锁',
    sealed: '封印',
    pending: '待处理',
    opened: '已开启',
    handled: '已处理',
    unknown: '未知',
  };
  return 映射[文本] || 文本;
}

function 清理地图运行时薄片_V1(值, 当前键 = '') {
  if (值 === undefined || 值 === null) return undefined;
  const 字段 = String(当前键 || '').trim();
  if (['x', 'y'].includes(字段)) return undefined;
  if (字段 === '状态') return 清理正文运行时值_V1(中文化地图状态_V1(值));
  if (Array.isArray(值)) {
    const 数组 = 值.map(项 => 清理地图运行时薄片_V1(项, 当前键)).filter(项 => 项 !== undefined);
    return 数组.length ? 数组 : undefined;
  }
  if (typeof 值 === 'object') {
    const 对象 = {};
    Object.entries(值).forEach(([键, 子值]) => {
      const 清理后 = 清理地图运行时薄片_V1(子值, 键);
      if (清理后 !== undefined) 对象[键] = 清理后;
    });
    return Object.keys(对象).length ? 对象 : undefined;
  }
  return 清理正文运行时值_V1(值);
}

function 准备运行时地图视图数据_V1(值, 当前键 = '', 选项 = {}) {
  if (值 === undefined || 值 === null) return undefined;
  const 字段 = String(当前键 || '').trim();
  if (['x', 'y'].includes(字段)) return undefined;
  if (字段 === '状态' && 选项.隐藏默认状态 === true && String(值 || '').trim() === 'intact') return undefined;
  if (字段 === '状态' && 选项.状态中文化 === true) return 中文化地图状态_V1(值);
  if (Array.isArray(值)) {
    return 值
      .map(项 => 准备运行时地图视图数据_V1(项, 当前键, 选项))
      .filter(项 => 项 !== undefined);
  }
  if (typeof 值 === 'object') {
    const 对象 = {};
    Object.entries(值).forEach(([键, 子值]) => {
      const 处理后 = 准备运行时地图视图数据_V1(子值, 键, 选项);
      if (处理后 !== undefined) 对象[键] = 处理后;
    });
    return 对象;
  }
  return 值;
}

function 判断运行时角色间情报可见度_V1(观察者 = {}, 观察者名 = '', 目标 = {}, 目标名 = '') {
  if (!观察者 || typeof 观察者 !== 'object' || !目标 || typeof 目标 !== 'object') return null;
  const 观察名 = String(观察者名 || '').trim();
  const 目标名称 = String(目标名 || '').trim();
  if (观察名 && 目标名称 && 观察名 === 目标名称) return null;
  const 目标等级 = Number(目标?.属性?.等级);
  const 魂力水平感知依据 =
    读取运行时正数属性_V1(观察者, '精神力上限') > 3000 &&
    读取运行时正数属性_V1(观察者, '精神力上限') >= 读取运行时正数属性_V1(目标, '精神力上限') * 1.3 &&
    读取运行时正数属性_V1(观察者, '魂力上限') >= 读取运行时正数属性_V1(目标, '魂力上限') * 1.3 &&
    Number.isFinite(目标等级) && 目标等级 > 0
      ? `因远高于对方的精神力/魂力，可感知魂力水平Lv${目标等级}`
      : '';
  const 战斗记录 = 目标名称 ? 观察者?.战斗历史?.[目标名称] : null;
  const 生成可见度 = (状态, 依据) => {
    const 依据列表 = [依据, 魂力水平感知依据].map(文本 => String(文本 || '').trim()).filter(Boolean);
    return {
      观察者: 观察名,
      目标: 目标名称,
      状态,
      依据: 依据列表.join('；'),
    };
  };
  if (战斗记录 && Number(战斗记录.次数 || 0) > 0) return 生成可见度('战斗信息可见', `交手${Number(战斗记录.次数 || 0)}次`);
  const 观察者声望 = Number(观察者?.社交?.声望 || 0);
  const 目标声望 = Number(目标?.社交?.声望 || 0);
  if (目标声望 >= 5000) {
    const 声望差 = Math.max(0, 目标声望 - 观察者声望);
    const 声望圈层接近 = 观察者声望 >= 5000 && 声望差 <= 5000;
    return 声望圈层接近
      ? 生成可见度('公开详细可见', `声望${观察者声望}/${目标声望}，差${声望差}`)
      : 生成可见度('公开传闻可见', `目标声望${目标声望}，声望差${声望差}`);
  }
  const 关系 = 目标名称 ? (观察者?.社交?.关系?.[目标名称] || {}) : {};
  const 关系名 = String(关系.关系 || '陌生');
  const 关系路线 = String(关系.关系路线 || '');
  const 好感度 = Number(关系.好感度 || 0);
  if (/敌对|死敌|宿敌|对手|仇敌/.test(`${关系名}${关系路线}`)) return 生成可见度('对手信息可见', `${关系名}/${关系路线 || '敌对'}，好感${好感度}`);
  if (好感度 >= 30 && !/陌生|普通|路人/.test(关系名)) return 生成可见度('关系信息可见', `${关系名}，好感${好感度}`);
  return 生成可见度('详细情报受限', `${关系名}，好感${好感度}`);
}

function 判断运行时角色情报可见度_V1(数据根 = {}, 目标角色名 = '') {
  if (!数据根 || typeof 数据根 !== 'object') return null;
  const { 玩家名, 玩家 } = 取运行时当前范围_V1(数据根);
  const 目标名 = String(目标角色名 || '').trim();
  const 目标 = 目标名 ? 数据根?.char?.[目标名] : null;
  return 判断运行时角色间情报可见度_V1(玩家, 玩家名, 目标, 目标名);
}

function 构建运行时情报可见度索引_V1(数据根 = {}, 角色名集合 = new Set()) {
  const { 玩家名, 玩家 } = 取运行时当前范围_V1(数据根);
  const 边列表 = [];
  const 写入边 = (观察者名, 目标名, 选项 = {}) => {
    if (!观察者名 || !目标名 || 观察者名 === 目标名) return;
    if (边列表.length >= 36) return;
    const 观察者 = 数据根?.char?.[观察者名];
    const 目标 = 数据根?.char?.[目标名];
    let 可见度 = null;
    if (!观察者 || !目标) {
      if (观察者名 === 玩家名 && !目标) {
        可见度 = {
          观察者: 观察者名,
          目标: 目标名,
          状态: '新角色情报受限',
          依据: '未建档/初见，只能写外观、现场表现和调查线索',
        };
      } else if (目标名 === 玩家名 && !观察者 && 目标) {
        const 玩家声望 = Number(目标?.社交?.声望 || 0);
        可见度 = {
          观察者: 观察者名,
          目标: 目标名,
          状态: 玩家声望 > 10000 ? '公开简略可见' : '新角色情报受限',
          依据: 玩家声望 > 10000 ? `主角声望${玩家声望}，可听过名字和公开身份` : '未建档/初见，只能写外观、现场表现和调查线索',
        };
      }
    } else {
      可见度 = 判断运行时角色间情报可见度_V1(观察者, 观察者名, 目标, 目标名);
    }
    if (!可见度) return;
    if (选项.跳过普通受限 === true && 可见度.状态 === '详细情报受限') return;
    边列表.push(可见度);
  };
  const 相关角色名列表 = Array.from(角色名集合 || []).filter(角色名 => String(角色名 || '').trim());
  相关角色名列表.forEach(角色名 => {
    写入边(玩家名, 角色名);
    写入边(角色名, 玩家名);
  });
  相关角色名列表
    .filter(角色名 => 角色名 !== 玩家名)
    .forEach((甲名, 甲序号, 非玩家角色名列表) => {
      非玩家角色名列表.slice(甲序号 + 1).forEach(乙名 => {
        const 甲 = 数据根?.char?.[甲名];
        const 乙 = 数据根?.char?.[乙名];
        if (!甲 || !乙) return;
        const 同场 = 运行时地点兼容_V1(甲?.状态?.位置 || '', 乙?.状态?.位置 || '');
        const 有关系 = !!(甲?.社交?.关系?.[乙名] || 乙?.社交?.关系?.[甲名]);
        const 有战斗历史 = Number(甲?.战斗历史?.[乙名]?.次数 || 0) > 0 || Number(乙?.战斗历史?.[甲名]?.次数 || 0) > 0;
        if (!同场 && !有关系 && !有战斗历史) return;
        写入边(甲名, 乙名, { 跳过普通受限: !有关系 && !有战斗历史 });
        写入边(乙名, 甲名, { 跳过普通受限: !有关系 && !有战斗历史 });
      });
    });
  const 口径 = {
    公开详细可见: '可用公开身份、事迹、传闻和常见战斗评价；不可读隐藏底牌/私密动机',
    公开传闻可见: '只能用姓名、身份、名声和粗略传闻',
    战斗信息可见: '只限亲眼交手暴露过的能力和战斗风格',
    对手信息可见: '只限真实对手/旧怨积累；阵营泛敌对不自动知道秘密',
    关系信息可见: '只限关系内已知性格、习惯、身份和近期互动',
    公开简略可见: '只限姓名、公开身份和广泛流传的粗略名声',
    新角色情报受限: '未建档或初见角色，只能写外观、现场表现和调查线索',
    详细情报受限: '只能写外观、现场表现和调查线索，不能直接掌握完整档案',
  };
  const 观察者表 = new Map();
  边列表.forEach(边 => {
    const 观察者名 = String(边?.观察者 || '').trim();
    const 目标名 = String(边?.目标 || '').trim();
    if (!观察者名 || !目标名) return;
    const 状态 = String(边?.状态 || '').trim();
    if (!状态) return;
    if (!观察者表.has(观察者名)) 观察者表.set(观察者名, { 观察者: 观察者名, 可见: {} });
    const 观察者项 = 观察者表.get(观察者名);
    if (!观察者项.可见[状态]) 观察者项.可见[状态] = { 目标: [], 依据: [] };
    const 分组 = 观察者项.可见[状态];
    if (!分组.目标.includes(目标名)) 分组.目标.push(目标名);
    const 依据 = String(边?.依据 || '').trim();
    if (依据) 分组.依据.push(`${目标名}:${依据}`);
  });
  const 观察者 = Array.from(观察者表.values()).map(观察者项 => {
    Object.keys(观察者项.可见).forEach(状态 => {
      const 分组 = 观察者项.可见[状态];
      if (!分组.依据.length) delete 分组.依据;
    });
    return 观察者项;
  });
  return 观察者.length ? { 口径, 观察者 } : undefined;
}

function 收集运行时命中名称_V1(数据根 = {}, 文本 = '') {
  const 源文本 = 清理提示审计扫描文本_V1(文本);
  const 结果 = { 角色: new Set(), 地点: new Set(), 动态地点: new Set(), 势力: new Set(), 物品: new Set() };
  收集运行时命中键列表_V1(源文本, 数据根?.char || {}).forEach(名称 => 结果.角色.add(名称));
  收集运行时地图命中键列表_V1(数据根, 源文本).forEach(名称 => 结果.地点.add(名称));
  收集运行时父级限定动态地点命中_V1(数据根, 源文本, { 阈值: 1, 上限: 12 }).forEach(命中 => 结果.动态地点.add(命中.原名 || 命中.名称));
  收集运行时命中键列表_V1(源文本, 数据根?.org || {}).forEach(名称 => 结果.势力.add(名称));
  收集运行时命中键列表_V1(源文本, 构建运行时物品目录_V1(数据根), { 命中函数: 运行时文本命中商品名_V1 }).forEach(名称 => 结果.物品.add(名称));
  return 结果;
}

function 收集运行时命中候选名称_V1(文本 = '', 候选 = {}, 类型 = '名称') {
  const 命中函数 = 类型 === '物品' ? 运行时文本命中商品名_V1 : 运行时文本命中名称_V1;
  const 捕获文本 = 清理提示审计扫描文本_V1(文本);
  const 结果 = new Set();
  Object.entries(候选 || {}).forEach(([名称, 映射]) => {
    const 实体名 = String(名称 || '').trim();
    if (!实体名 || !命中函数(捕获文本, 实体名)) return;
    const 规范名 = typeof 映射 === 'string' && String(映射 || '').trim() ? String(映射).trim() : 实体名;
    if (类型 === '角色' && !内置角色文本命中满足二级关键词_V1(规范名, 捕获文本)) return;
    结果.add(规范名);
  });
  return Array.from(结果);
}

function 构建运行时统一实体命中_V1(数据根 = {}, 文本 = '', 选项 = {}) {
  const 源文本 = 清理提示审计扫描文本_V1(文本);
  const 当前MVU = 收集运行时命中名称_V1(数据根, 源文本);
  const 内置角色 = 收集运行时命中候选名称_V1(源文本, 选项.内置角色 || {}, '角色');
  const 冷归档角色 = 收集运行时命中候选名称_V1(源文本, 选项.冷归档角色 || {}, '角色');
  const 内置物品 = 收集运行时命中候选名称_V1(源文本, 选项.内置物品 || {}, '物品');
  const 冷归档物品 = 收集运行时命中候选名称_V1(源文本, 选项.冷归档物品 || {}, '物品');
  const 冷归档动态地点 = 收集运行时命中候选名称_V1(源文本, 选项.冷归档动态地点 || {}, '动态地点');
  return { 当前MVU, 内置角色, 冷归档角色, 内置物品, 冷归档物品, 冷归档动态地点 };
}

function 构建运行时内置角色候选表_V1() {
  const 角色表 = 读取内置角色库_V1()?.角色 || {};
  const 候选表 = {};
  Object.entries(角色表).forEach(([角色名, 角色记录]) => {
    const 规范名 = String(角色名 || 角色记录?.角色名 || '').trim();
    if (!规范名) return;
    候选表[规范名] = 规范名;
    (Array.isArray(角色记录?.别名) ? 角色记录.别名 : []).forEach(别名 => {
      const 候选名 = String(别名 || '').trim();
      if (候选名) 候选表[候选名] = 规范名;
    });
  });
  return 候选表;
}

function 构建更新前运行时草稿_V1(数据根 = {}, 命中文本 = '', 选项 = {}) {
  if (选项?.跳过提示前实例化 === true) return { 数据根, 命中角色: [] };
  const 统一命中 = 构建运行时统一实体命中_V1(数据根, 命中文本, {
    内置角色: 构建运行时内置角色候选表_V1(),
  });
  const 命中角色 = Array.isArray(统一命中.内置角色) ? 统一命中.内置角色 : [];
  if (!命中角色.length) return { 数据根, 命中角色 };
  const 草稿数据根 = cloneJsonValue(数据根, {});
  const 结果 = 应用内置角色实例化_V1(草稿数据根, {
    用户输入: 命中文本,
    命中角色,
    使用统一命中: true,
  });
  if (Array.isArray(结果?.changedNames) && 结果.changedNames.length > 0 && globalThis.__LWCS_MVU_SCHEMA__?.parse) {
    try {
      const 归一化草稿 = globalThis.__LWCS_MVU_SCHEMA__.parse(草稿数据根);
      return { 数据根: 归一化草稿, 命中角色: 结果.changedNames };
    } catch (错误) {}
  }
  return { 数据根: 草稿数据根, 命中角色: Array.isArray(结果?.changedNames) ? 结果.changedNames : [] };
}

function 构建运行时命中上下文_V1(数据根 = {}, 文本 = '', 选项 = {}) {
  const 运行时命中名称 = 选项.运行时命中名称 && typeof 选项.运行时命中名称 === 'object'
    ? 选项.运行时命中名称
    : 收集运行时命中名称_V1(数据根, 文本);
  return { 运行时命中名称 };
}

function 格式化MVU更新结构命中列表_V1(名称集合 = new Set()) {
  const 名称列表 = Array.from(名称集合 || []).filter(名称 => String(名称 || '').trim());
  if (!名称列表.length) return '无';
  return 名称列表.join(', ');
}

function 合并运行时命中集合_V1(...命中列表) {
  const 结果 = { 角色: new Set(), 地点: new Set(), 动态地点: new Set(), 势力: new Set(), 物品: new Set() };
  命中列表.forEach(命中 => {
    Object.keys(结果).forEach(类型 => {
      (命中?.[类型] instanceof Set ? Array.from(命中[类型]) : []).forEach(名称 => {
        if (String(名称 || '').trim()) 结果[类型].add(名称);
      });
    });
  });
  return 结果;
}

function 转义运行时JsonPointer片段_V1(片段 = '') {
  return String(片段 ?? '').replace(/~/g, '~0').replace(/\//g, '~1');
}

function 构建运行时JsonPointer路径_V1(路径 = []) {
  const 片段列表 = (Array.isArray(路径) ? 路径 : []).map(片段 => String(片段 ?? ''));
  return `/${片段列表.map(转义运行时JsonPointer片段_V1).join('/')}`;
}

function 解码运行时JsonPointer路径_V1(pointer = '') {
  const raw = String(pointer ?? '').trim();
  if (!raw || raw === '/') return [];
  if (!raw.startsWith('/')) throw new Error(`JSONPatch路径必须以/开头：${raw || '空'}`);
  return raw
    .split('/')
    .slice(1)
    .map(片段 => 片段.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function 运行时路径片段安全_V1(片段 = '', { 允许斜杠 = true } = {}) {
  const 文本 = String(片段 ?? '');
  if (!文本.trim()) return false;
  if (/[\u0000-\u001F\u007F]/.test(文本)) return false;
  if (['__proto__', 'constructor', 'prototype'].includes(文本)) return false;
  if (!允许斜杠 && 文本.includes('/')) return false;
  return true;
}

function 是AIJsonPatch装备属性加成路径_V1(路径 = []) {
  const 文本路径 = (Array.isArray(路径) ? 路径 : []).map(片段 => String(片段));
  if (文本路径.length >= 5 && 文本路径[0] === 'char' && 文本路径[2] === '装备' && AIJsonPatch装备槽位集合_V1.has(文本路径[3]) && 文本路径[4] === '属性加成') return true;
  if (文本路径.length >= 4 && 文本路径[0] === '物品' && AIJsonPatch装备定义分类集合_V1.has(文本路径[1]) && 文本路径[3] === '属性加成') return true;
  return false;
}

function 是AIJsonPatch装备加成方向路径_V1(路径 = []) {
  const 文本路径 = (Array.isArray(路径) ? 路径 : []).map(片段 => String(片段));
  if (文本路径.length === 5 && 文本路径[0] === 'char' && 文本路径[2] === '装备' && AIJsonPatch装备槽位集合_V1.has(文本路径[3]) && 文本路径[4] === '加成方向') return true;
  if (文本路径.length === 4 && 文本路径[0] === '物品' && AIJsonPatch装备定义分类集合_V1.has(文本路径[1]) && 文本路径[3] === '加成方向') return true;
  return false;
}

function 规范化AIJsonPatch装备加成方向值_V1(值 = [], 选项 = {}) {
  if (!Array.isArray(值) && typeof 值 !== 'string') {
    throw new Error(`装备加成方向必须为字符串数组：${选项.原始路径 || '未知路径'}`);
  }
  const 原始列表 = Array.isArray(值)
    ? 值
    : String(值 || '')
      .split(/[,\n，、|/]+/)
      .map(片段 => 片段.trim());
  const 输出 = [];
  const 非法 = [];
  原始列表.forEach(方向 => {
    const 文本 = String(方向 || '').trim();
    if (!文本) return;
    if (!AIJsonPatch装备加成方向集合_V1.has(文本)) {
      非法.push(文本);
      return;
    }
    if (!输出.includes(文本)) 输出.push(文本);
  });
  if (非法.length) throw new Error(`装备加成方向非法：${非法.join('、')}；可选=${AIJsonPatch装备加成方向列表_V1.join('、')}`);
  return 输出;
}

function 规范化AIJsonPatch装备写入值_V1(路径 = [], 值 = null, 根 = {}, 选项 = {}) {
  const 文本路径 = (Array.isArray(路径) ? 路径 : []).map(片段 => String(片段));
  if (是AIJsonPatch装备属性加成路径_V1(文本路径)) {
    throw new Error(`装备属性加成禁止由AI直接写入：${选项.原始路径 || 构建运行时JsonPointer路径_V1(文本路径)}`);
  }
  if (是AIJsonPatch装备加成方向路径_V1(文本路径)) {
    return 规范化AIJsonPatch装备加成方向值_V1(值, { 原始路径: 选项.原始路径 || 构建运行时JsonPointer路径_V1(文本路径) });
  }
  if (!值 || typeof 值 !== 'object' || Array.isArray(值)) return cloneJsonValue(值, 值);
  const 输出 = {};
  Object.entries(值).forEach(([键, 子值]) => {
    if (!运行时路径片段安全_V1(键, { 允许斜杠: false })) throw new Error(`JSONPatch对象字段非法：${键}`);
    const 子路径 = 纠正AIJsonPatch槽位漏层路径_V1([...文本路径, 键]);
    输出[键] = 规范化AIJsonPatch装备写入值_V1(子路径, 子值, 根, 选项);
  });
  return 输出;
}

var AIJsonPatch技能字段集合_V1 = Object.freeze(new Set([
  '魂技名',
  '画面描述',
  '效果描述',
  '产物描述',
  '承载方式',
  '消耗',
  '前摇',
  '附带属性',
  '使用条件',
  '触发限制',
  '场外冷却至tick',
  '机制原型',
  '技能掌控度',
  '_效果数组',
  '副作用列表',
]));

function 读取AIJsonPatch魂技序号_V1(片段 = '') {
  const 匹配 = String(片段 || '').trim().match(/^第(\d+)魂技(?:_2)?$/);
  return 匹配 ? Math.max(1, Math.floor(Number(匹配[1] || 1))) : 0;
}

function 读取AIJsonPatch血脉魂技序号_V1(片段 = '') {
  const 匹配 = String(片段 || '').trim().match(/^第(\d+)血脉魂技(?:_2)?$/);
  return 匹配 ? Math.max(1, Math.floor(Number(匹配[1] || 1))) : 0;
}

function 是AIJsonPatch技能字段_V1(片段 = '') {
  return AIJsonPatch技能字段集合_V1.has(String(片段 || '').trim());
}

function AIJsonPatch魂技槽位应按魂环校验_V1(路径 = [], 序号 = 0) {
  const 文本路径 = (Array.isArray(路径) ? 路径 : []).map(片段 => String(片段));
  const 父级 = 文本路径[序号 - 1];
  return 是武魂槽位键_V1(父级) || 是魂灵槽位键_V1(父级) || 是魂环槽位键_V1(父级);
}

function AIJsonPatch血脉魂技槽位应按气血魂环校验_V1(路径 = [], 序号 = 0) {
  const 文本路径 = (Array.isArray(路径) ? 路径 : []).map(片段 => String(片段));
  const 父级 = 文本路径[序号 - 1];
  return 父级 === '血脉之力' || 是气血魂环槽位键_V1(父级);
}

function 是AIJsonPatch技能容器路径_V1(路径 = []) {
  const 末段 = String((Array.isArray(路径) ? 路径 : [])[路径.length - 1] || '');
  if (路径.length >= 4 && 路径[0] === 'char' && 路径[2] === '自创魂技') return true;
  if (路径.length >= 5 && 路径[0] === 'char' && 路径[2] === '武魂融合技' && 路径[4] === '技能数据') return true;
  if (路径.length >= 5 && 路径[0] === 'char' && 路径[2] === '血脉之力' && ['技能', '被动'].includes(String(路径[3] || ''))) return true;
  if (路径.length >= 6 && 路径[0] === 'char' && 路径[2] === '魂骨' && 路径[4] === '附带技能') return true;
  if (路径.length >= 6 && 路径[0] === '物品' && 物品分类集合_V1.has(String(路径[1] || '')) && 路径[3] === '装备技能') return true;
  if (是魂技槽位键_V1(末段) || 是血脉魂技槽位键_V1(末段)) {
    if (路径.length < 2) return false;
    const 技能序号 = 路径.length - 1;
    return (
      AIJsonPatch魂技槽位应按魂环校验_V1(路径, 技能序号) ||
      AIJsonPatch血脉魂技槽位应按气血魂环校验_V1(路径, 技能序号)
    );
  }
  return false;
}

function 纠正AIJsonPatch槽位漏层路径_V1(路径 = []) {
  const 结果 = (Array.isArray(路径) ? 路径 : []).map(片段 => String(片段));
  for (let 序号 = 0; 序号 < 结果.length; 序号 += 1) {
    const 当前片段 = 结果[序号];
    const 魂技序号 = 读取AIJsonPatch魂技序号_V1(当前片段);
    if (魂技序号 > 0 && ['第1武魂', '第2武魂'].includes(String(结果[序号 - 1] || ''))) {
      结果.splice(序号, 0, '第1魂灵', `第${魂技序号}魂环`);
      序号 += 2;
      continue;
    }
    if (魂技序号 > 0 && 是魂灵槽位键_V1(结果[序号 - 1])) {
      结果.splice(序号, 0, `第${魂技序号}魂环`);
      序号 += 1;
      continue;
    }
    const 血脉魂技序号 = 读取AIJsonPatch血脉魂技序号_V1(当前片段);
    if (血脉魂技序号 > 0 && 结果[序号 - 1] === '血脉之力') {
      结果.splice(序号, 0, `第${血脉魂技序号}气血魂环`);
      序号 += 1;
    }
  }
  return 结果;
}

function 校验AIJsonPatch路径层级_V1(路径 = [], { 原始路径 = '' } = {}) {
  const 文本路径 = (Array.isArray(路径) ? 路径 : []).map(片段 => String(片段));
  const 抛错 = 原因 => {
    throw new Error(`JSONPatch路径层级错误：${原始路径 || 构建运行时JsonPointer路径_V1(文本路径)}；${原因}`);
  };
  文本路径.forEach((片段, 序号) => {
    if (是魂灵槽位键_V1(片段)) {
      if (是武魂槽位键_V1(文本路径[序号 - 1])) return;
      if (文本路径[0] === 'char') 抛错(`${片段}必须位于武魂槽位下`);
      return;
    }
    if (是魂环槽位键_V1(片段)) {
      const 父级 = 文本路径[序号 - 1];
      if (是魂灵槽位键_V1(父级)) return;
      if (文本路径[0] === 'char' && 文本路径.slice(0, 序号).some(段 => 是武魂槽位键_V1(段))) 抛错(`${片段}必须位于魂灵下`);
      return;
    }
    if (是魂技槽位键_V1(片段) && AIJsonPatch魂技槽位应按魂环校验_V1(文本路径, 序号)) {
      const 魂技序号 = 读取AIJsonPatch魂技序号_V1(片段);
      if (文本路径[序号 - 1] !== `第${魂技序号}魂环`) 抛错(`${片段}必须位于第${魂技序号}魂环下`);
      return;
    }
    if (是气血魂环槽位键_V1(片段)) {
      if (文本路径[序号 - 1] === '血脉之力') return;
      if (文本路径[0] === 'char' && 文本路径.slice(0, 序号).includes('血脉之力')) 抛错(`${片段}必须位于血脉之力下`);
      return;
    }
    if (是血脉魂技槽位键_V1(片段) && AIJsonPatch血脉魂技槽位应按气血魂环校验_V1(文本路径, 序号)) {
      const 魂技序号 = 读取AIJsonPatch血脉魂技序号_V1(片段);
      if (文本路径[序号 - 1] !== `第${魂技序号}气血魂环`) 抛错(`${片段}必须位于第${魂技序号}气血魂环下`);
      return;
    }
    if (是AIJsonPatch技能字段_V1(片段) && !是AIJsonPatch技能容器路径_V1(文本路径.slice(0, 序号))) {
      抛错(`${片段}必须写在技能对象下`);
    }
  });
  return true;
}

function 校验AIJsonPatch对象子路径层级_V1(路径 = [], 值 = null, 选项 = {}) {
  if (!值 || typeof 值 !== 'object' || Array.isArray(值)) return;
  Object.entries(值).forEach(([键, 子值]) => {
    if (!运行时路径片段安全_V1(键, { 允许斜杠: false })) {
      throw new Error(`JSONPatch对象字段非法：${键}`);
    }
    const 子路径 = 纠正AIJsonPatch槽位漏层路径_V1([...路径, 键]);
    校验AIJsonPatch路径层级_V1(子路径, 选项);
    校验AIJsonPatch对象子路径层级_V1(子路径, 子值, 选项);
  });
}

function 写入AIJsonPatch对象相对路径值_V1(目标 = {}, 相对路径 = [], 值 = null) {
  const 路径 = (Array.isArray(相对路径) ? 相对路径 : []).map(片段 => String(片段));
  if (!路径.length) return;
  let 当前 = 目标;
  路径.forEach((片段, 序号) => {
    const 末段 = 序号 === 路径.length - 1;
    if (!运行时路径片段安全_V1(片段, { 允许斜杠: false })) throw new Error(`JSONPatch对象字段非法：${片段}`);
    if (末段) {
      if (
        当前[片段] &&
        typeof 当前[片段] === 'object' &&
        !Array.isArray(当前[片段]) &&
        值 &&
        typeof 值 === 'object' &&
        !Array.isArray(值)
      ) {
        Object.entries(值).forEach(([子键, 子值]) => 写入AIJsonPatch对象相对路径值_V1(当前[片段], [子键], 子值));
        return;
      }
      当前[片段] = 值;
      return;
    }
    if (!当前[片段] || typeof 当前[片段] !== 'object' || Array.isArray(当前[片段])) 当前[片段] = {};
    当前 = 当前[片段];
  });
}

function 规范化AIJsonPatch对象层级值_V1(路径 = [], 值 = null, 根 = {}, 选项 = {}) {
  const 文本路径 = (Array.isArray(路径) ? 路径 : []).map(片段 => String(片段));
  const 装备值 = 规范化AIJsonPatch装备写入值_V1(文本路径, 值, 根, 选项);
  if (!装备值 || typeof 装备值 !== 'object' || Array.isArray(装备值)) return cloneJsonValue(装备值, 装备值);
  const 类型值 = 规范化AIJsonPatch对象值_V1(文本路径, 装备值, 根);
  if (!类型值 || typeof 类型值 !== 'object' || Array.isArray(类型值)) return cloneJsonValue(类型值, 类型值);
  const 输出 = {};
  Object.entries(类型值).forEach(([键, 子值]) => {
    if (!运行时路径片段安全_V1(键, { 允许斜杠: false })) throw new Error(`JSONPatch对象字段非法：${键}`);
    const 原子路径 = [...文本路径, 键];
    const 子路径 = 纠正AIJsonPatch槽位漏层路径_V1(原子路径);
    校验AIJsonPatch路径层级_V1(子路径, 选项);
    if (子路径.length < 文本路径.length || 子路径.slice(0, 文本路径.length).some((片段, 序号) => 片段 !== 文本路径[序号])) {
      throw new Error(`JSONPatch路径无法唯一纠正：${构建运行时JsonPointer路径_V1(原子路径)}`);
    }
    const 相对路径 = 子路径.slice(文本路径.length);
    写入AIJsonPatch对象相对路径值_V1(
      输出,
      相对路径,
      规范化AIJsonPatch对象层级值_V1(子路径, 子值, 根, 选项),
    );
  });
  return 输出;
}

function 是AIJsonPatch可包裹新增结构片段_V1(片段 = '') {
  return 是魂环槽位键_V1(片段) || 是魂技槽位键_V1(片段) || 是气血魂环槽位键_V1(片段) || 是血脉魂技槽位键_V1(片段);
}

function 包裹AIJsonPatch新增缺层值_V1(路径 = [], 值 = null, 根 = {}) {
  const 文本路径 = (Array.isArray(路径) ? 路径 : []).map(片段 => String(片段));
  for (let 序号 = 文本路径.length - 1; 序号 > 0; 序号 -= 1) {
    const 父路径 = 文本路径.slice(0, 序号);
    const 当前片段 = 文本路径[序号];
    if (!运行时路径存在_V1(根, 父路径) || 运行时路径存在_V1(根, [...父路径, 当前片段])) continue;
    if (!是AIJsonPatch可包裹新增结构片段_V1(当前片段)) continue;
    const 输出 = {};
    写入AIJsonPatch对象相对路径值_V1(输出, 文本路径.slice(序号 + 1), cloneJsonValue(值, 值));
    return { 路径: [...父路径, 当前片段], 值: 输出 };
  }
  return null;
}

function 记录AIJsonPatch本批新增路径_V1(集合 = new Set(), 路径 = [], 值 = undefined) {
  const 文本路径 = (Array.isArray(路径) ? 路径 : []).map(片段 => String(片段));
  if (!文本路径.length) return;
  集合.add(构建运行时JsonPointer路径_V1(文本路径));
  if (!值 || typeof 值 !== 'object' || Array.isArray(值)) return;
  Object.entries(值).forEach(([键, 子值]) => {
    if (!运行时路径片段安全_V1(键, { 允许斜杠: false })) return;
    记录AIJsonPatch本批新增路径_V1(集合, [...文本路径, 键], 子值);
  });
}

function AIJsonPatch路径已存在或本批新增_V1(根 = {}, 路径 = [], 本批新增路径集合 = new Set()) {
  return 运行时路径存在_V1(根, 路径) || 本批新增路径集合.has(构建运行时JsonPointer路径_V1(路径));
}

function AIJsonPatch写入父路径可用_V1(根 = {}, 路径 = [], 本批新增路径集合 = new Set()) {
  const 文本路径 = (Array.isArray(路径) ? 路径 : []).map(片段 => String(片段));
  if (!文本路径.length) return false;
  const 末段 = 文本路径[文本路径.length - 1];
  if (!运行时路径片段安全_V1(末段, { 允许斜杠: false })) return false;
  return AIJsonPatch路径已存在或本批新增_V1(根, 文本路径.slice(0, -1), 本批新增路径集合);
}

function 规范化AIJsonPatch交付需求值_V1(值 = {}) {
  const 输入 = 值 && typeof 值 === 'object' && !Array.isArray(值) ? 值 : {};
  if (!Object.keys(输入).length) return null;
  const 品质集合 = new Set(['普通', '优秀', '稀有', '史诗', '传说', '神器', '超神器']);
  const 名称 = String(输入.名称 || '').trim();
  if (!名称) return null;
  const 数量 = Math.max(1, Math.floor(Number(输入.数量 || 1)));
  const 品质下限 = String(输入.品质下限 || '').trim();
  const 输出 = { 类型: '物品', 名称, 数量 };
  if (品质集合.has(品质下限)) 输出.品质下限 = 品质下限;
  return 输出;
}

function 写入AIJsonPatch任务可选字段_V1(输出 = {}, 输入 = {}) {
  const 截止tick = Math.max(0, Math.floor(Number(输入.截止tick || 0)));
  const 交付需求 = 规范化AIJsonPatch交付需求值_V1(输入.交付需求);
  if (截止tick > 0) 输出.截止tick = 截止tick;
  if (交付需求) 输出.交付需求 = 交付需求;
  return 输出;
}

function 规范化AIJsonPatch任务对象值_V1(路径 = [], 值 = {}, 根 = {}) {
  const 文本路径 = (Array.isArray(路径) ? 路径 : []).map(片段 => String(片段));
  if (!(文本路径.length === 4 && 文本路径[0] === 'char' && 文本路径[2] === '我的任务')) return cloneJsonValue(值, 值);
  const 输入 = 值 && typeof 值 === 'object' && !Array.isArray(值) ? cloneJsonValue(值, {}) : {};
  if (Object.prototype.hasOwnProperty.call(输入, '目前进度') && !Object.prototype.hasOwnProperty.call(输入, '当前进度')) {
    输入.当前进度 = 输入.目前进度;
    delete 输入.目前进度;
  }
  const 当前tick = Math.max(0, Number(根?.world?.时间?.tick || 0));
  return 写入AIJsonPatch任务可选字段_V1({
    任务线: String(输入.任务线 || '支线').trim() || '支线',
    状态: String(输入.状态 || '进行中').trim() || '进行中',
    当前进度: Math.max(0, Math.min(100, Number(输入.当前进度 || 0))),
    奖励币: Math.max(0, Number(输入.奖励币 || 0)),
    奖励声望: Math.max(0, Number(输入.奖励声望 || 0)),
    描述: String(输入.描述 || '待生成').trim() || '待生成',
    最后更新时间tick: Math.max(0, Number(输入.最后更新时间tick || 当前tick || 0)),
  }, 输入);
}

function 规范化AIJsonPatch委托对象值_V1(路径 = [], 值 = {}, 根 = {}) {
  const 文本路径 = (Array.isArray(路径) ? 路径 : []).map(片段 => String(片段));
  if (!(文本路径.length === 3 && 文本路径[0] === 'world' && 文本路径[1] === '委托板')) return cloneJsonValue(值, 值);
  const 输入 = 值 && typeof 值 === 'object' && !Array.isArray(值) ? cloneJsonValue(值, {}) : {};
  const 当前tick = Math.max(0, Number(根?.world?.时间?.tick || 0));
  return 写入AIJsonPatch任务可选字段_V1({
    标题: String(输入.标题 || 文本路径[2] || '无').trim() || '无',
    描述: String(输入.描述 || 输入.框架描述 || '无').trim() || '无',
    框架描述: String(输入.框架描述 || 输入.描述 || '无').trim() || '无',
    发布者: String(输入.发布者 || '系统').trim() || '系统',
    面向: String(输入.面向 || '公开').trim() || '公开',
    指定对象: String(输入.指定对象 || '无').trim() || '无',
    状态: String(输入.状态 || '待接取').trim() || '待接取',
    难度: String(输入.难度 || '中').trim() || '中',
    资源级别: String(输入.资源级别 || '无').trim() || '无',
    奖励币: Math.max(0, Number(输入.奖励币 || 0)),
    奖励声望: Math.max(0, Number(输入.奖励声望 || 0)),
    承接者: String(输入.承接者 || '无').trim() || '无',
    生成tick: Math.max(0, Number(输入.生成tick || 当前tick || 0)),
  }, 输入);
}

function 规范化AIJsonPatch状态效果值_V1(路径 = [], 值 = {}) {
  const 文本路径 = (Array.isArray(路径) ? 路径 : []).map(片段 => String(片段));
  if (!(文本路径.length === 5 && 文本路径[0] === 'char' && 文本路径[2] === '属性' && 文本路径[3] === '状态效果')) return cloneJsonValue(值, 值);
  const 输入 = 值 && typeof 值 === 'object' && !Array.isArray(值) ? cloneJsonValue(值, {}) : {};
  if (Object.prototype.hasOwnProperty.call(输入, '状态描述') && !Object.prototype.hasOwnProperty.call(输入, '描述')) {
    输入.描述 = 输入.状态描述;
    delete 输入.状态描述;
  }
  if (Object.prototype.hasOwnProperty.call(输入, 'duration') && !Object.prototype.hasOwnProperty.call(输入, '持续回合')) {
    输入.持续回合 = 输入.duration;
    delete 输入.duration;
  }
  return {
    类型: String(输入.类型 || '状态').trim() || '状态',
    描述: String(输入.描述 || '待生成').trim() || '待生成',
    层数: Math.max(1, Number(输入.层数 || 1)),
    持续回合: Math.max(0, Number(输入.持续回合 || 0)),
    ...Object.fromEntries(Object.entries(输入).filter(([键]) => !['类型', '描述', '层数', '持续回合'].includes(键))),
  };
}

function 规范化AIJsonPatch对象值_V1(路径 = [], 值 = {}, 根 = {}) {
  const 任务值 = 规范化AIJsonPatch任务对象值_V1(路径, 值, 根);
  const 委托值 = 规范化AIJsonPatch委托对象值_V1(路径, 任务值, 根);
  const 状态值 = 规范化AIJsonPatch状态效果值_V1(路径, 委托值);
  return cloneJsonValue(状态值, 状态值);
}

function 读取运行时路径值_V1(根 = {}, 路径 = []) {
  let 当前 = 根;
  for (const 片段 of Array.isArray(路径) ? 路径 : []) {
    if (当前 == null || typeof 当前 !== 'object') return undefined;
    const 键 = Array.isArray(当前) && /^\d+$/.test(String(片段)) ? Number(片段) : 片段;
    if (!Object.prototype.hasOwnProperty.call(当前, 键)) return undefined;
    当前 = 当前[键];
  }
  return 当前;
}

function 运行时路径存在_V1(根 = {}, 路径 = []) {
  if (!Array.isArray(路径)) return false;
  if (!路径.length) return true;
  let 当前 = 根;
  for (const 片段 of 路径) {
    if (当前 == null || typeof 当前 !== 'object') return false;
    const 键 = Array.isArray(当前) && /^\d+$/.test(String(片段)) ? Number(片段) : 片段;
    if (!Object.prototype.hasOwnProperty.call(当前, 键)) return false;
    当前 = 当前[键];
  }
  return true;
}

function 收集运行时真实路径索引_V1(根 = {}) {
  const 列表 = [];
  const 指针表 = new Map();
  const 加入 = 路径 => {
    if (!Array.isArray(路径) || !路径.length) return;
    const 指针 = 构建运行时JsonPointer路径_V1(路径);
    if (指针表.has(指针)) return;
    const 记录 = { path: 路径.map(片段 => String(片段)), pointer: 指针 };
    指针表.set(指针, 记录);
    列表.push(记录);
  };
  const 遍历 = (节点, 路径 = []) => {
    if (节点 === undefined) return;
    加入(路径);
    if (!节点 || typeof 节点 !== 'object') return;
    if (Array.isArray(节点)) {
      节点.forEach((子节点, 序号) => 遍历(子节点, [...路径, String(序号)]));
      return;
    }
    Object.entries(节点).forEach(([键, 值]) => 遍历(值, [...路径, 键]));
  };
  遍历(根, []);
  return { 列表, 指针表 };
}

function AIJsonPatch路径同根_V1(请求路径 = [], 候选路径 = []) {
  if (!请求路径.length || !候选路径.length || 请求路径[0] !== 候选路径[0]) return false;
  if (请求路径[0] === 'char') return 请求路径[1] && 请求路径[1] === 候选路径[1];
  if (['world', 'org', '物品'].includes(请求路径[0])) return true;
  return false;
}

function AIJsonPatch路径有序子序列_V1(短路径 = [], 长路径 = []) {
  let 指针 = 0;
  for (const 片段 of 长路径) {
    if (String(片段) === String(短路径[指针])) 指针 += 1;
    if (指针 >= 短路径.length) return true;
  }
  return false;
}

function 查找AIJsonPatch唯一真实路径_V1(路径 = [], 路径索引 = {}) {
  const 请求路径 = Array.isArray(路径) ? 路径.map(片段 => String(片段)) : [];
  if (请求路径.length < 2) return null;
  const 末段 = 请求路径[请求路径.length - 1];
  const 候选 = (路径索引.列表 || []).filter(记录 => {
    const 候选路径 = 记录.path || [];
    return (
      候选路径.length > 请求路径.length &&
      候选路径[候选路径.length - 1] === 末段 &&
      AIJsonPatch路径同根_V1(请求路径, 候选路径) &&
      AIJsonPatch路径有序子序列_V1(请求路径, 候选路径)
    );
  });
  return 候选.length === 1 ? 候选[0].path : null;
}

function 尝试AIJsonPatch前缀纠正_V1(路径 = [], 前缀映射表 = new Map()) {
  const 父路径 = 路径.slice(0, -1);
  const 父键 = 构建运行时JsonPointer路径_V1(父路径);
  const 纠正父路径 = 前缀映射表.get(父键);
  return 纠正父路径 ? [...纠正父路径, 路径[路径.length - 1]] : null;
}

function 纠正AIJsonPatch新增父容器路径_V1(父路径 = [], 值 = {}, 根 = {}) {
  const 路径 = Array.isArray(父路径) ? 父路径.map(片段 => String(片段)) : [];
  if (路径.length === 2 && 路径[0] === 'world' && ['任务板', '委托', '委托任务'].includes(路径[1])) return ['world', '委托板'];
  if (路径.length === 1 && ['item', 'items', '物品表'].includes(路径[0])) return ['物品'];
  if (路径.length === 3 && 路径[0] === 'char' && ['物品', '库存'].includes(路径[2])) return ['char', 路径[1], '背包'];
  return null;
}

function 读取赛事权限运行时_V1() {
  const 候选 = [
    globalThis.__LWCS_COMPETITION_PRIVILEGE_RUNTIME__,
    globalThis.window?.__LWCS_COMPETITION_PRIVILEGE_RUNTIME__,
    globalThis.parent?.__LWCS_COMPETITION_PRIVILEGE_RUNTIME__,
  ];
  return 候选.find(接口 => 接口 && typeof 接口 === 'object') || null;
}

function 整理赛事权限视图根_V1(数据根 = {}) {
  const 克隆根 = cloneJsonValue(数据根, {}) || {};
  const 运行时 = 读取赛事权限运行时_V1();
  if (运行时?.整理特殊权限) 运行时.整理特殊权限(克隆根);
  return 克隆根;
}

function 校验赛事权限输入字段_V1(对象 = {}, 允许字段 = [], 标签 = '对象') {
  if (!对象 || typeof 对象 !== 'object' || Array.isArray(对象)) throw new Error(`${标签}必须是对象`);
  const 未知字段 = Object.keys(对象).filter(字段 => !允许字段.includes(字段));
  if (未知字段.length) throw new Error(`${标签}包含未知字段：${未知字段.join('、')}`);
}

function 读取赛事权限私有UID计数器_V1() {
  const 读取器 = globalThis.TavernHelper?.getVariables || globalThis.getVariables;
  if (typeof 读取器 !== 'function') return {};
  try {
    const 变量 = 读取器({ type: 'chat' });
    if (变量 && typeof 变量.then !== 'function' && 变量?.lwcs_赛事权限UID计数器 && typeof 变量.lwcs_赛事权限UID计数器 === 'object') {
      return { ...变量.lwcs_赛事权限UID计数器 };
    }
  } catch (错误) {}
  return {};
}

function 保存赛事权限私有UID计数器_V1(计数器 = {}) {
  const 写入器 = globalThis.TavernHelper?.insertOrAssignVariables || globalThis.insertOrAssignVariables;
  if (typeof 写入器 !== 'function') return;
  try {
    写入器({ lwcs_赛事权限UID计数器: { ...计数器 } }, { type: 'chat' });
  } catch (错误) {}
}

function 扫描赛事权限最大UID_V1(记录表 = {}, 前缀 = '') {
  return Object.keys(记录表 || {}).reduce((最大值, 键) => {
    const 匹配 = String(键).match(new RegExp(`^${前缀}_(\\d+)$`));
    return 匹配 ? Math.max(最大值, Number(匹配[1]) || 0) : 最大值;
  }, 0);
}

function 创建赛事权限UID分配器_V1(根 = {}) {
  const 计数器 = 读取赛事权限私有UID计数器_V1();
  const 已用表 = {
    privilege: new Set(Object.keys(根?.world?.特殊权限 || {})),
    competition: new Set(Object.keys(根?.world?.赛事 || {})),
    participant: new Set(Object.values(根?.world?.赛事 || {}).flatMap(赛事 =>
      Object.values(赛事?.项目 || {}).flatMap(项目 => Object.keys(项目?.参赛者 || {})),
    )),
    match: new Set(Object.values(根?.world?.赛事 || {}).flatMap(赛事 =>
      Object.values(赛事?._进度 || {}).flatMap(进度 => Object.keys(进度?.对局 || {})),
    )),
  };
  Object.keys(已用表).forEach(前缀 => {
    const 扫描表 = Object.fromEntries([...已用表[前缀]].map(键 => [键, true]));
    计数器[前缀] = Math.max(Number(计数器[前缀] || 0), 扫描赛事权限最大UID_V1(扫描表, 前缀));
  });
  return {
    分配(前缀) {
      do {
        计数器[前缀] = Math.max(0, Number(计数器[前缀] || 0)) + 1;
      } while (已用表[前缀]?.has(`${前缀}_${String(计数器[前缀]).padStart(3, '0')}`));
      const UID = `${前缀}_${String(计数器[前缀]).padStart(3, '0')}`;
      已用表[前缀]?.add(UID);
      return UID;
    },
    提交() {
      保存赛事权限私有UID计数器_V1(计数器);
    },
  };
}

function 规范化AI权限配额_V1(输入 = {}, 当前tick = 0, 运行时 = null) {
  const 使用次数 = 输入.使用次数;
  if (输入.使用配额 !== undefined) throw new Error('使用配额由脚本维护，AI不能直接填写');
  if (使用次数 === undefined && 输入.重置周期 === undefined) return undefined;
  const 上限 = 使用次数 === undefined ? 1 : 运行时.解析使用次数(使用次数);
  const 配额 = { 上限, 剩余: 上限 };
  if (输入.重置周期 !== undefined && String(输入.重置周期 || '').trim()) {
    const 周期 = 运行时.解析重置周期(输入.重置周期);
    配额.重置周期 = 周期;
    配额.下次重置tick = Math.floor(Number(当前tick || 0) + 运行时.解析重置周期tick(周期));
  }
  return 配额;
}

function 查找AI权限物品定义_V1(根 = {}, 物品名 = '') {
  for (const [分类, 定义表] of Object.entries(根?.物品 || {})) {
    if (定义表 && typeof 定义表 === 'object' && 定义表[物品名]) return { 分类, 定义: 定义表[物品名] };
  }
  return null;
}

function 规范化AI特殊权限记录_V1(输入 = {}, 根 = {}, 运行时 = null) {
  校验赛事权限输入字段_V1(
    输入,
    ['名称', '持有人', '权限', '使用次数', '重置周期', '有效期'],
    '特殊权限',
  );
  const 当前tick = Number(根?.world?.时间?.tick || 0);
  const 名称 = String(输入.名称 || '').trim();
  const 持有人 = String(输入.持有人 || '').trim();
  if (!名称 || !持有人) throw new Error('特殊权限必须填写名称和持有人');
  const 权限 = 输入.权限;
  if (!权限 || typeof 权限 !== 'object' || Array.isArray(权限)) throw new Error('特殊权限.权限必须是对象');
  const 类型 = String(权限.类型 || '').trim();
  let 正式权限;
  if (类型 === '资格') {
    校验赛事权限输入字段_V1(权限, ['类型', '项目'], '资格权限');
    const 项目 = String(权限.项目 || '').trim();
    if (!项目) throw new Error('资格项目不能为空');
    正式权限 = { 类型, 项目 };
  } else if (类型 === '折扣') {
    校验赛事权限输入字段_V1(权限, ['类型', '地点', '商店', '物品分类', '物品', '支付比例'], '折扣权限');
    const 地点 = String(权限.地点 || '').trim();
    const 商店 = String(权限.商店 || '').trim();
    const 物品分类 = String(权限.物品分类 || '').trim();
    const 物品 = String(权限.物品 || '').trim();
    if (!地点 && !商店 && !物品分类 && !物品) throw new Error('折扣至少限定地点、商店、物品分类或物品');
    if (商店 && !地点) throw new Error('限定商店时必须同时限定地点');
    if (地点 && !根?.world?.地点?.[地点]) throw new Error(`折扣地点不存在：${地点}`);
    if (商店 && !根?.world?.地点?.[地点]?.商店?.[商店]) throw new Error(`商店不属于地点：${地点}-${商店}`);
    const 物品定义 = 物品 ? 查找AI权限物品定义_V1(根, 物品) : null;
    if (物品 && !物品定义) throw new Error(`折扣物品不存在：${物品}`);
    if (物品分类 && 物品定义 && 物品定义.分类 !== 物品分类) throw new Error(`物品分类不一致：${物品}`);
    const 支付比例 = Number(权限.支付比例);
    if (!Number.isFinite(支付比例) || 支付比例 < 0 || 支付比例 > 99) throw new Error('支付比例必须为0至99');
    正式权限 = { 类型, ...(地点 ? { 地点 } : {}), ...(商店 ? { 商店 } : {}), ...(物品分类 ? { 物品分类 } : {}), ...(物品 ? { 物品 } : {}), 支付比例 };
  } else if (类型 === '物品选择') {
    校验赛事权限输入字段_V1(权限, ['类型', '来源', '数量', '品质', '分类'], '物品选择权限');
    const 来源 = String(权限.来源 || '').trim();
    if (来源 !== '全局物品库') {
      const 分隔 = 来源.indexOf('-');
      const 地点 = 分隔 > 0 ? 来源.slice(0, 分隔) : '';
      const 商店 = 分隔 > 0 ? 来源.slice(分隔 + 1) : '';
      if (!地点 || !商店 || !根?.world?.地点?.[地点]?.商店?.[商店]) throw new Error(`物品选择来源不存在：${来源}`);
    }
    正式权限 = {
      类型,
      来源,
      数量: Math.max(1, Math.floor(Number(权限.数量 || 1))),
      ...(权限.品质 ? { 品质: String(权限.品质).trim() } : {}),
      ...(权限.分类 ? { 分类: String(权限.分类).trim() } : {}),
    };
    if (!运行时.生成物品选择候选(根, { 权限: 正式权限 }).length) throw new Error(`物品选择没有可执行候选：${名称}`);
  } else if (类型 === '奖励加成') {
    校验赛事权限输入字段_V1(权限, ['类型', '来源', '倍率'], '奖励加成权限');
    const 来源 = String(权限.来源 || '').trim();
    if (来源 !== '全部委托' && !rootWorldCommissionExists_V1(根, 来源)) throw new Error(`奖励加成委托不存在：${来源}`);
    const 倍率 = Number(权限.倍率);
    if (!Number.isFinite(倍率) || 倍率 < 0) throw new Error('奖励倍率必须是非负数');
    正式权限 = { 类型, 来源, 倍率 };
  } else {
    throw new Error(`不支持的权限类型：${类型 || '空'}`);
  }
  const 输出 = { 名称, 持有人, 权限: 正式权限 };
  const 使用配额 = 规范化AI权限配额_V1(输入, 当前tick, 运行时);
  if (使用配额) 输出.使用配额 = 使用配额;
  if (输入.有效期 !== undefined) {
    const 到期tick = 运行时.解析时长tick(输入.有效期, 当前tick);
    if (到期tick !== null) 输出.到期tick = 到期tick;
  }
  return 输出;
}

function 合并AI特殊权限更新_V1(输入 = {}, 当前记录 = {}, 根 = {}, 运行时 = null) {
  const 规范记录 = 规范化AI特殊权限记录_V1(输入, 根, 运行时);
  const 当前tick = Number(根?.world?.时间?.tick || 0);
  const 输出 = {
    名称: 规范记录.名称,
    持有人: 规范记录.持有人,
    权限: 规范记录.权限,
  };
  const 原配额 = 当前记录?.使用配额 && typeof 当前记录.使用配额 === 'object' && !Array.isArray(当前记录.使用配额)
    ? cloneJsonValue(当前记录.使用配额, {})
    : null;
  if (输入.使用次数 !== undefined || 输入.重置周期 !== undefined) {
    const 新上限 = 输入.使用次数 !== undefined
      ? 运行时.解析使用次数(输入.使用次数)
      : Math.max(1, Math.floor(Number(原配额?.上限 || 1)));
    const 配额 = {
      上限: 新上限,
      剩余: 原配额 ? Math.min(Math.max(0, Math.floor(Number(原配额.剩余 || 0))), 新上限) : 新上限,
    };
    if (输入.重置周期 !== undefined) {
      const 周期文本 = String(输入.重置周期 || '').trim();
      if (周期文本) {
        const 周期 = 运行时.解析重置周期(周期文本);
        配额.重置周期 = 周期;
        配额.下次重置tick = Math.floor(当前tick + 运行时.解析重置周期tick(周期));
      }
    } else if (原配额?.重置周期) {
      配额.重置周期 = 原配额.重置周期;
      if (原配额.下次重置tick !== undefined) 配额.下次重置tick = 原配额.下次重置tick;
    }
    输出.使用配额 = 配额;
  } else if (原配额) {
    输出.使用配额 = 原配额;
  }
  if (输入.有效期 !== undefined) {
    const 到期tick = 运行时.解析时长tick(输入.有效期, 当前tick);
    if (到期tick !== null) 输出.到期tick = 到期tick;
  } else if (当前记录?.到期tick !== undefined) {
    输出.到期tick = 当前记录.到期tick;
  }
  return 输出;
}

function rootWorldCommissionExists_V1(根 = {}, 委托名 = '') {
  return !!委托名 && !!根?.world?.委托板?.[委托名];
}

function 特殊权限重复条件键_V1(记录 = {}) {
  const 权限 = 记录?.权限 || {};
  return JSON.stringify([
    String(记录?.持有人 || '').trim(),
    String(权限.类型 || '').trim(),
    String(权限.项目 || '').trim(),
    String(权限.地点 || '').trim(),
    String(权限.商店 || '').trim(),
    String(权限.物品分类 || '').trim(),
    String(权限.物品 || '').trim(),
    String(权限.来源 || '').trim(),
    String(权限.分类 || '').trim(),
    String(权限.品质 || '').trim(),
  ]);
}

function 规范化AI参赛限制_V1(输入 = {}, 根 = {}, 运行时 = null) {
  校验赛事权限输入字段_V1(输入, ['队伍人数上限', '年龄上限', '等级上限', '允许身份', '必需装备', '禁止装备', '报名费用'], '参赛限制');
  const 输出 = {};
  if (输入.队伍人数上限 !== undefined) 输出.队伍人数上限 = Math.max(1, Math.floor(Number(输入.队伍人数上限 || 1)));
  if (输入.年龄上限 !== undefined) 输出.年龄上限 = Math.max(0, Math.floor(Number(输入.年龄上限 || 0)));
  if (输入.等级上限 !== undefined) 输出.等级上限 = Math.max(0, Math.floor(Number(输入.等级上限 || 0)));
  ['允许身份', '必需装备', '禁止装备'].forEach(字段 => {
    if (输入[字段] !== undefined) {
      if (!Array.isArray(输入[字段])) throw new Error(`${字段}必须是数组`);
      输出[字段] = Array.from(new Set(输入[字段].map(值 => String(值 || '').trim()).filter(Boolean)));
    }
  });
  if (输入.报名费用 !== undefined) {
    校验赛事权限输入字段_V1(输入.报名费用, ['货币', '金额'], '报名费用');
    输出.报名费用 = {
      货币: String(输入.报名费用.货币 || '').trim(),
      金额: Math.max(0, Number(输入.报名费用.金额 || 0)),
    };
  }
  return 输出;
}

function 规范化AI参赛者记录_V1(输入 = {}) {
  校验赛事权限输入字段_V1(输入, ['名称', '成员', '状态'], '参赛者');
  const 名称 = String(输入.名称 || '').trim();
  const 成员 = Array.isArray(输入.成员) ? 输入.成员.map(值 => String(值 || '').trim()).filter(Boolean) : [];
  if (!名称 || !成员.length) throw new Error('参赛者必须填写名称和成员');
  return {
    名称,
    成员: Array.from(new Set(成员)),
    状态: ['参赛', '退赛', '取消资格'].includes(输入.状态) ? 输入.状态 : '参赛',
  };
}

function 规范化AI赛事项目_V1(输入 = {}, 根 = {}, UID分配器, 运行时, 赛事ID = '', 项目名 = '') {
  校验赛事权限输入字段_V1(输入, ['流程', '参赛总数', '参赛者', '参赛限制'], `${项目名}项目`);
  if (!运行时.常量.流程表.includes(String(输入.流程 || '').trim())) throw new Error(`${项目名}流程无效`);
  if (输入.参赛总数 === undefined) throw new Error(`${项目名}必须提供参赛总数`);
  const 参赛总数 = Math.floor(Number(输入.参赛总数));
  if (!Number.isFinite(参赛总数) || 参赛总数 < 2) throw new Error(`${项目名}参赛总数至少为2`);
  const 参赛者表 = {};
  const 输入列表 = Array.isArray(输入.参赛者) ? 输入.参赛者 : Object.values(输入.参赛者 || {});
  输入列表.forEach(项 => {
    const 参赛者 = 规范化AI参赛者记录_V1(项);
    if (Object.values(参赛者表).some(已有 => 已有.名称 === 参赛者.名称)) throw new Error(`参赛者名称重名：${参赛者.名称}`);
    参赛者表[UID分配器.分配('participant')] = 参赛者;
  });
  if (输入列表.length > 参赛总数) throw new Error(`${项目名}已登记名单超过参赛总数`);
  if (输入.流程 === '单场' && 参赛总数 !== 2) throw new Error(`${项目名}单场流程的参赛总数必须为2`);
  return {
    流程: String(输入.流程).trim(),
    参赛总数,
    参赛者: 参赛者表,
    ...(输入.参赛限制 !== undefined ? { 参赛限制: 规范化AI参赛限制_V1(输入.参赛限制, 根, 运行时) } : {}),
  };
}

function 规范化AI赛事记录_V1(输入 = {}, 根 = {}, UID分配器, 运行时) {
  校验赛事权限输入字段_V1(输入, ['名称', '状态', '日程', '开始时间', '总时长', '项目'], '赛事');
  const 赛事 = {
    名称: String(输入.名称 || '').trim(),
    状态: '筹备',
    日程: {},
    项目: {},
  };
  if (!赛事.名称) throw new Error('赛事必须填写名称');
  const 当前tick = Number(根?.world?.时间?.tick || 0);
  const 开始tick = 输入.开始时间 === undefined ? 当前tick : 运行时.解析时长tick(输入.开始时间, 当前tick);
  const 时长tick = 运行时.解析时长tick(输入.总时长, 0);
  if (开始tick === null || 时长tick === null || 时长tick <= 0) throw new Error('赛事必须填写有限的总时长');
  赛事.日程 = { 开始tick, 结束tick: 开始tick + 时长tick };
  const 项目输入 = 输入.项目 || {};
  Object.keys(项目输入).forEach(项目名 => {
    if (!['个人赛', '团体赛'].includes(项目名)) throw new Error(`赛事项目无效：${项目名}`);
    赛事.项目[项目名] = 规范化AI赛事项目_V1(项目输入[项目名], 根, UID分配器, 运行时, '', 项目名);
  });
  if (!Object.keys(赛事.项目).length) throw new Error('赛事至少需要个人赛或团体赛');
  if (输入.状态 && 输入.状态 !== '筹备') {
    throw new Error('赛事状态只能通过请求启动进入进行中');
  }
  return 赛事;
}

function 预处理特殊权限赛事补丁_V2(补丁列表 = [], 根 = {}) {
  const 运行时 = 读取赛事权限运行时_V1();
  if (!运行时) return { 补丁: 补丁列表, UID分配器: { 提交() {} } };
  const UID = 创建赛事权限UID分配器_V1(根);
  const 临时根 = cloneJsonValue(根, {}) || {};
  临时根.world ||= {};
  临时根.world.特殊权限 ||= {};
  临时根.world.赛事 ||= {};
  const 映射 = new Map();
  const 引用 = (表, 值, 类型) => 运行时.唯一引用(tableOrEmptyForRuntimeView_V1(表), 值, 类型);
  const 输出 = [];
  (Array.isArray(补丁列表) ? 补丁列表 : []).forEach((原补丁, index) => {
    const 补丁 = { ...原补丁 };
    const 路径 = 解码运行时JsonPointer路径_V1(补丁.path);
    if (路径[0] !== 'world' || !['特殊权限', '赛事', '战斗'].includes(路径[1])) {
      输出.push(补丁);
      return;
    }
    if (路径[1] === '战斗') throw new Error(`JSONPatch[${index}]战斗上下文由脚本维护`);
    if (路径.length < 3) throw new Error(`JSONPatch[${index}]不能整体覆盖${路径[1]}表`);
    if (路径[1] === '特殊权限') {
      let ID = 路径[2];
      if (/^新增(?:_\d+)?$/.test(ID)) {
        if (!['add', 'insert', 'replace'].includes(补丁.op)) throw new Error(`JSONPatch[${index}]新增权限操作无效`);
        const 记录 = 规范化AI特殊权限记录_V1(补丁.value, 临时根, 运行时);
        const 重复键 = 特殊权限重复条件键_V1(记录);
        const 重复 = Object.entries(临时根.world.特殊权限).find(([, 已有]) => 特殊权限重复条件键_V1(已有) === 重复键);
        ID = 重复?.[0] || UID.分配('privilege');
        映射.set(`privilege:${路径[2]}`, ID);
        const 写入记录 = 重复
          ? 合并AI特殊权限更新_V1(补丁.value, 重复[1], 临时根, 运行时)
          : 记录;
        临时根.world.特殊权限[ID] = 写入记录;
        输出.push({ ...补丁, op: 重复 ? 'replace' : 'add', path: 构建运行时JsonPointer路径_V1(['world', '特殊权限', ID]), value: 写入记录 });
        return;
      }
      ID = 映射.get(`privilege:${ID}`) || 引用(临时根.world.特殊权限, ID, '特殊权限');
      路径[2] = ID;
      if (路径.length === 3 && 补丁.op === 'remove') {
        delete 临时根.world.特殊权限[ID];
        输出.push({ ...补丁, path: 构建运行时JsonPointer路径_V1(路径) });
        return;
      }
      if (路径.length === 3 && ['add', 'replace'].includes(补丁.op)) {
        const 记录 = 合并AI特殊权限更新_V1(补丁.value, 临时根.world.特殊权限[ID], 临时根, 运行时);
        临时根.world.特殊权限[ID] = 记录;
        输出.push({ ...补丁, op: 'replace', path: 构建运行时JsonPointer路径_V1(路径), value: 记录 });
        return;
      }
      if (路径.slice(3).some(字段 => ['剩余', '下次重置tick', '到期tick'].includes(字段))) throw new Error(`JSONPatch[${index}]权限运行字段由脚本维护`);
      if (!['名称', '持有人', '权限'].includes(路径[3])) throw new Error(`JSONPatch[${index}]特殊权限字段无效：${路径[3] || '空'}`);
      const 当前记录 = 临时根.world.特殊权限?.[ID];
      if (!当前记录) throw new Error(`JSONPatch[${index}]特殊权限不存在`);
      if (路径[3] === '权限') {
        if (!['add', 'replace'].includes(补丁.op)) throw new Error(`JSONPatch[${index}]权限配置只能修改`);
        const 当前类型 = 当前记录.权限?.类型;
        const 可写字段 = {
          资格: ['项目'],
          折扣: ['地点', '商店', '物品分类', '物品', '支付比例'],
          物品选择: ['来源', '数量', '品质', '分类'],
          奖励加成: ['来源', '倍率'],
        }[当前类型] || [];
        if (路径.length > 5) throw new Error(`JSONPatch[${index}]权限字段路径过深`);
        if (路径[4] && (路径[4] === '类型' || !可写字段.includes(路径[4]))) {
          throw new Error(`JSONPatch[${index}]权限类型或分支字段无效`);
        }
        const 下一个权限 = 路径[4]
          ? { ...当前记录.权限, [路径[4]]: 补丁.value }
          : 补丁.value;
        const 规范记录 = 规范化AI特殊权限记录_V1({
          名称: 当前记录.名称,
          持有人: 当前记录.持有人,
          权限: 下一个权限,
        }, 临时根, 运行时);
        临时根.world.特殊权限[ID] = { ...当前记录, 权限: 规范记录.权限 };
        输出.push({
          ...补丁,
          op: 'replace',
          path: 构建运行时JsonPointer路径_V1(路径),
          value: 路径[4] ? 规范记录.权限[路径[4]] : 规范记录.权限,
        });
        return;
      }
      if (!['add', 'replace'].includes(补丁.op) || 路径.length !== 4) {
        throw new Error(`JSONPatch[${index}]特殊权限字段只能修改`);
      }
      const 文本值 = String(补丁.value || '').trim();
      if (!文本值) throw new Error(`JSONPatch[${index}]特殊权限名称和持有人不能为空`);
      当前记录[路径[3]] = 文本值;
      输出.push({ ...补丁, op: 'replace', path: 构建运行时JsonPointer路径_V1(路径), value: 文本值 });
      return;
    }
    let 赛事ID = 路径[2];
    if (/^新增(?:_\d+)?$/.test(赛事ID)) {
      const 赛事 = 规范化AI赛事记录_V1(补丁.value, 临时根, UID, 运行时);
      if (Object.values(临时根.world.赛事).some(已有 => 已有?.名称 === 赛事.名称)) throw new Error(`赛事名称重名：${赛事.名称}`);
      赛事ID = UID.分配('competition');
      映射.set(`competition:${路径[2]}`, 赛事ID);
      临时根.world.赛事[赛事ID] = 赛事;
      输出.push({ ...补丁, op: 'add', path: 构建运行时JsonPointer路径_V1(['world', '赛事', 赛事ID]), value: 赛事 });
      return;
    }
    赛事ID = 映射.get(`competition:${赛事ID}`) || 引用(临时根.world.赛事, 赛事ID, '赛事');
    路径[2] = 赛事ID;
    const 赛事 = 临时根.world.赛事[赛事ID];
    if (!赛事) throw new Error(`JSONPatch[${index}]赛事不存在`);
    if (路径.length === 3 && 补丁.op === 'remove') {
      delete 临时根.world.赛事[赛事ID];
      输出.push({ ...补丁, path: 构建运行时JsonPointer路径_V1(路径) });
      return;
    }
    if (路径.length === 3 && ['add', 'replace'].includes(补丁.op)) {
      if (赛事.状态 !== '筹备') throw new Error('赛事开始后不能替换赛事配置');
      const 记录 = 规范化AI赛事记录_V1(补丁.value, 临时根, UID, 运行时);
      临时根.world.赛事[赛事ID] = 记录;
      输出.push({ ...补丁, op: 'replace', path: 构建运行时JsonPointer路径_V1(路径), value: 记录 });
      return;
    }
    if (路径.includes('_进度') || 路径[3] === '状态' || 路径[3] === '日程') throw new Error(`JSONPatch[${index}]赛事运行状态与绝对tick由脚本维护`);
    if (赛事.状态 !== '筹备') throw new Error('赛事开始后AI不能修改赛事配置或名单');
    if (路径[3] === '开始时间') {
      if (!['add', 'replace'].includes(补丁.op)) throw new Error('开始时间只能修改，不能删除');
      const 开始tick = 运行时.解析时长tick(补丁.value, Number(临时根?.world?.时间?.tick || 0));
      if (开始tick === null) throw new Error('赛事开始时间必须是有限时间');
      const 原时长 = Math.max(1, Number(赛事.日程?.结束tick || 0) - Number(赛事.日程?.开始tick || 0));
      赛事.日程 = { 开始tick, 结束tick: 开始tick + 原时长 };
      输出.push(
        { op: 'replace', path: 构建运行时JsonPointer路径_V1(['world', '赛事', 赛事ID, '日程', '开始tick']), value: 赛事.日程.开始tick },
        { op: 'replace', path: 构建运行时JsonPointer路径_V1(['world', '赛事', 赛事ID, '日程', '结束tick']), value: 赛事.日程.结束tick },
      );
      return;
    }
    if (路径[3] === '总时长') {
      if (!['add', 'replace'].includes(补丁.op)) throw new Error('总时长只能修改，不能删除');
      const 时长tick = 运行时.解析时长tick(补丁.value, 0);
      if (时长tick === null || 时长tick <= 0) throw new Error('赛事总时长必须是有限正时间');
      赛事.日程.结束tick = Number(赛事.日程.开始tick || 0) + 时长tick;
      输出.push({ op: 'replace', path: 构建运行时JsonPointer路径_V1(['world', '赛事', 赛事ID, '日程', '结束tick']), value: 赛事.日程.结束tick });
      return;
    }
    if (路径[3] === '名称') {
      const 名称 = String(补丁.value || '').trim();
      if (!名称) throw new Error('赛事名称不能为空');
      赛事.名称 = 名称;
      输出.push({ ...补丁, path: 构建运行时JsonPointer路径_V1(路径), value: 名称 });
      return;
    }
    if (路径[3] !== '项目' || !路径[4]) throw new Error(`JSONPatch[${index}]赛事字段无效：${路径[3] || '空'}`);
    if (路径[3] === '项目' && 路径[4]) {
      const 项目名 = 路径[4];
      if (!['个人赛', '团体赛'].includes(项目名)) throw new Error(`赛事项目无效：${项目名}`);
      路径[4] = 项目名;
      if (路径.length === 5 && ['add', 'replace'].includes(补丁.op)) {
        const 已存在 = !!赛事.项目?.[项目名];
        const 项目 = 规范化AI赛事项目_V1(补丁.value, 临时根, UID, 运行时, 赛事ID, 项目名);
        赛事.项目[项目名] = 项目;
        输出.push({ ...补丁, op: 已存在 ? 'replace' : 'add', path: 构建运行时JsonPointer路径_V1(路径), value: 项目 });
        return;
      }
      if (!赛事.项目?.[项目名]) throw new Error(`赛事项目不存在：${项目名}`);
      if (路径[5] === '参赛者' && 路径[6]) {
        let 参赛者ID = 路径[6];
        if (/^新增(?:_\d+)?$/.test(参赛者ID)) {
          const 参赛者 = 规范化AI参赛者记录_V1(补丁.value);
          if (Object.values(赛事.项目[项目名].参赛者 || {}).some(已有 => 已有?.名称 === 参赛者.名称)) throw new Error(`参赛者名称重名：${参赛者.名称}`);
          const 报名校验 = 运行时.校验赛事报名(临时根, 赛事ID, {
            项目: 项目名,
            名称: 参赛者.名称,
            成员: 参赛者.成员,
            持有人: 参赛者.成员[0],
            允许未知成员: true,
          });
          if (!报名校验.ok) throw new Error(`JSONPatch[${index}]${报名校验.reason}`);
          参赛者ID = UID.分配('participant');
          赛事.项目[项目名].参赛者[参赛者ID] = 报名校验.参赛者;
          映射.set(`participant:${赛事ID}:${项目名}:${路径[6]}`, 参赛者ID);
          输出.push({ ...补丁, op: 'add', path: 构建运行时JsonPointer路径_V1(['world', '赛事', 赛事ID, '项目', 项目名, '参赛者', 参赛者ID]), value: 报名校验.参赛者 });
          return;
        }
        参赛者ID = 映射.get(`participant:${赛事ID}:${项目名}:${参赛者ID}`) || 引用(赛事.项目[项目名].参赛者, 参赛者ID, '参赛者');
        路径[6] = 参赛者ID;
        if (路径.length === 7 && 补丁.op === 'remove') {
          delete 赛事.项目[项目名].参赛者[参赛者ID];
          输出.push({ ...补丁, path: 构建运行时JsonPointer路径_V1(路径) });
          return;
        }
        if (路径[7] !== '状态' || !['退赛', '取消资格'].includes(String(补丁.value || '').trim())) {
          throw new Error(`JSONPatch[${index}]已有参赛者只允许改为退赛或取消资格`);
        }
        赛事.项目[项目名].参赛者[参赛者ID].状态 = String(补丁.value).trim();
        输出.push({ ...补丁, op: 'replace', path: 构建运行时JsonPointer路径_V1(路径), value: String(补丁.value).trim() });
        return;
      }
      if (路径[5] === '参赛者') throw new Error(`JSONPatch[${index}]不能整体覆盖参赛者表`);
      if (路径.length === 6 && ['add', 'replace'].includes(补丁.op)) {
        const 当前项目 = 赛事.项目[项目名];
        if (路径[5] === '流程') {
          const 流程 = String(补丁.value || '').trim();
          if (!运行时.常量.流程表.includes(流程)) throw new Error(`${项目名}流程无效`);
          if (流程 === '单场' && 当前项目.参赛总数 !== 2) throw new Error(`${项目名}单场流程的参赛总数必须为2`);
          当前项目.流程 = 流程;
        } else if (路径[5] === '参赛总数') {
          const 参赛总数 = Math.floor(Number(补丁.value));
          if (!Number.isFinite(参赛总数) || 参赛总数 < 2) throw new Error(`${项目名}参赛总数至少为2`);
          if (运行时.有效参赛者条目(当前项目).length > 参赛总数) throw new Error(`${项目名}已登记名单超过参赛总数`);
          if (当前项目.流程 === '单场' && 参赛总数 !== 2) throw new Error(`${项目名}单场流程的参赛总数必须为2`);
          当前项目.参赛总数 = 参赛总数;
        } else if (路径[5] === '参赛限制') {
          当前项目.参赛限制 = 规范化AI参赛限制_V1(补丁.value, 临时根, 运行时);
        } else {
          throw new Error(`JSONPatch[${index}]赛事项目字段无效：${路径[5] || '空'}`);
        }
        输出.push({ op: 'replace', path: 构建运行时JsonPointer路径_V1(路径), value: cloneJsonValue(当前项目[路径[5]], 当前项目[路径[5]]) });
        return;
      }
    }
    throw new Error(`JSONPatch[${index}]赛事项目字段无效或路径过深`);
  });
  return { 补丁: 输出, UID分配器: UID };
}

function tableOrEmptyForRuntimeView_V1(值) {
  return 值 && typeof 值 === 'object' && !Array.isArray(值) ? 值 : {};
}

function 规范化AIJsonPatch列表_V1(patches = [], 数据输入 = {}, options = {}) {
  const 根 = 读取运行时Mvu数据根_V1(数据输入) || {};
  const 赛事权限预处理结果 = 预处理特殊权限赛事补丁_V2(Array.isArray(patches) ? patches : [], 根);
  const 来源列表 = 赛事权限预处理结果.补丁;
  const 路径索引 = 收集运行时真实路径索引_V1(根);
  const 前缀映射表 = new Map();
  const 本批新增路径集合 = new Set();
  const 输出 = 来源列表.map((patch, index) => {
    if (!patch || typeof patch !== 'object') throw new Error(`JSONPatch[${index}]不是对象`);
    const op = String(patch.op || '').trim();
    if (!['replace', 'remove', 'add', 'insert', 'delta'].includes(op)) throw new Error(`JSONPatch[${index}]操作无效：${op || '空'}`);
    const 原路径 = 解码运行时JsonPointer路径_V1(patch.path);
    if (!原路径.length) throw new Error(`JSONPatch[${index}]路径为空`);
    原路径.forEach(片段 => {
      if (!运行时路径片段安全_V1(片段, { 允许斜杠: true })) throw new Error(`JSONPatch[${index}]路径片段非法：${片段}`);
    });
    let 路径 = 纠正AIJsonPatch槽位漏层路径_V1(原路径);
    校验AIJsonPatch路径层级_V1(路径, { 原始路径: patch.path });
    if (['add', 'insert', 'replace', 'delta'].includes(op) && 是AIJsonPatch装备属性加成路径_V1(路径)) {
      throw new Error(`装备属性加成禁止由AI直接写入：${patch.path}`);
    }
    const 原父路径 = 原路径.slice(0, -1);
    let 精确存在 = AIJsonPatch路径已存在或本批新增_V1(根, 路径, 本批新增路径集合);
    const replace可按父级写入 = op === 'replace' && !精确存在 && AIJsonPatch写入父路径可用_V1(根, 路径, 本批新增路径集合);
    if (['replace', 'remove', 'delta'].includes(op) && !精确存在 && !replace可按父级写入) {
      const 前缀纠正 = 尝试AIJsonPatch前缀纠正_V1(路径, 前缀映射表);
      const 唯一路径 = 前缀纠正 && AIJsonPatch路径已存在或本批新增_V1(根, 前缀纠正, 本批新增路径集合)
        ? 前缀纠正
        : 查找AIJsonPatch唯一真实路径_V1(路径, 路径索引);
      if (!唯一路径) throw new Error(`JSONPatch[${index}]路径无法唯一纠正：${patch.path}`);
      校验AIJsonPatch路径层级_V1(唯一路径, { 原始路径: patch.path });
      前缀映射表.set(构建运行时JsonPointer路径_V1(原父路径), 唯一路径.slice(0, -1));
      路径 = 唯一路径;
      精确存在 = true;
    }
    if (构建运行时JsonPointer路径_V1(原路径) !== 构建运行时JsonPointer路径_V1(路径)) {
      前缀映射表.set(构建运行时JsonPointer路径_V1(原父路径), 路径.slice(0, -1));
    }
    if (['add', 'insert'].includes(op)) {
      let 新父路径 = 路径.slice(0, -1);
      let 新键 = String(路径[路径.length - 1] || '');
      if (!运行时路径片段安全_V1(新键, { 允许斜杠: false })) throw new Error(`JSONPatch[${index}]新增键非法：${新键}`);
      if (!AIJsonPatch路径已存在或本批新增_V1(根, 新父路径, 本批新增路径集合)) {
        const 纠正父路径 = 纠正AIJsonPatch新增父容器路径_V1(新父路径, patch.value, 根);
        if (!纠正父路径 || (!AIJsonPatch路径已存在或本批新增_V1(根, 纠正父路径.slice(0, -1), 本批新增路径集合) && !options.宽松新增)) {
          const 包裹结果 = 包裹AIJsonPatch新增缺层值_V1(路径, patch.value, 根);
          if (!包裹结果) throw new Error(`JSONPatch[${index}]新增父容器不存在：${patch.path}`);
          const value = 规范化AIJsonPatch对象层级值_V1(包裹结果.路径, 包裹结果.值, 根, { 原始路径: patch.path });
          校验AIJsonPatch对象子路径层级_V1(包裹结果.路径, value, { 原始路径: patch.path });
          const 输出Patch = { ...patch, op, path: 构建运行时JsonPointer路径_V1(包裹结果.路径), value };
          记录AIJsonPatch本批新增路径_V1(本批新增路径集合, 包裹结果.路径, value);
          return 输出Patch;
        }
        校验AIJsonPatch路径层级_V1([...纠正父路径, 新键], { 原始路径: patch.path });
        前缀映射表.set(构建运行时JsonPointer路径_V1(新父路径), 纠正父路径);
        新父路径 = 纠正父路径;
        路径 = [...新父路径, 新键];
      }
      const value = 规范化AIJsonPatch对象层级值_V1(路径, patch.value, 根, { 原始路径: patch.path });
      校验AIJsonPatch对象子路径层级_V1(路径, value, { 原始路径: patch.path });
      const 输出Patch = { ...patch, op, path: 构建运行时JsonPointer路径_V1(路径), value };
      记录AIJsonPatch本批新增路径_V1(本批新增路径集合, 路径, value);
      return 输出Patch;
    }
    if (op === 'replace' && !精确存在) {
      if (!AIJsonPatch写入父路径可用_V1(根, 路径, 本批新增路径集合)) {
        const 包裹结果 = 包裹AIJsonPatch新增缺层值_V1(路径, patch.value, 根);
        if (!包裹结果) throw new Error(`JSONPatch[${index}]路径无法唯一纠正：${patch.path}`);
        const value = 规范化AIJsonPatch对象层级值_V1(包裹结果.路径, 包裹结果.值, 根, { 原始路径: patch.path });
        校验AIJsonPatch对象子路径层级_V1(包裹结果.路径, value, { 原始路径: patch.path });
        const 输出Patch = { ...patch, op: 'add', path: 构建运行时JsonPointer路径_V1(包裹结果.路径), value };
        记录AIJsonPatch本批新增路径_V1(本批新增路径集合, 包裹结果.路径, value);
        return 输出Patch;
      }
      const value = 规范化AIJsonPatch对象层级值_V1(路径, patch.value, 根, { 原始路径: patch.path });
      校验AIJsonPatch对象子路径层级_V1(路径, value, { 原始路径: patch.path });
      const 输出Patch = { ...patch, op: 'add', path: 构建运行时JsonPointer路径_V1(路径), value };
      记录AIJsonPatch本批新增路径_V1(本批新增路径集合, 路径, value);
      return 输出Patch;
    }
    if (op === 'replace') {
      const value = 规范化AIJsonPatch对象层级值_V1(路径, patch.value, 根, { 原始路径: patch.path });
      校验AIJsonPatch对象子路径层级_V1(路径, value, { 原始路径: patch.path });
      const 输出Patch = { ...patch, op, path: 构建运行时JsonPointer路径_V1(路径), value };
      记录AIJsonPatch本批新增路径_V1(本批新增路径集合, 路径, value);
      return 输出Patch;
    }
    return { ...patch, op, path: 构建运行时JsonPointer路径_V1(路径) };
  });
  赛事权限预处理结果.UID分配器.提交();
  return 输出;
}

function 替换AIJsonPatch文本块_V1(文本 = '', patches = []) {
  return String(文本 || '').replace(/<JSONPatch>\s*[\s\S]*?\s*<\/JSONPatch>/i, `<JSONPatch>\n${JSON.stringify(patches, null, 2)}\n</JSONPatch>`);
}

function 预处理AIJsonPatch文本_V1(文本 = '', 数据输入 = {}, options = {}) {
  const 源文本 = String(文本 || '');
  const 匹配 = 源文本.match(/<JSONPatch>\s*([\s\S]*?)\s*<\/JSONPatch>/i);
  if (!匹配) return 源文本;
  let patches = [];
  try {
    const 解析 = JSON.parse(匹配[1]);
    if (!Array.isArray(解析)) throw new Error('JSONPatch不是数组');
    patches = 解析;
  } catch (错误) {
    throw new Error(`JSONPatch解析失败：${错误?.message || 错误}`);
  }
  return 替换AIJsonPatch文本块_V1(源文本, 规范化AIJsonPatch列表_V1(patches, 数据输入, options));
}

function 判断运行时占位分类_V1(路径 = []) {
  const 文本路径 = (Array.isArray(路径) ? 路径 : []).map(片段 => String(片段 || '').trim()).filter(Boolean);
  if (文本路径.includes('外貌')) return '外貌占位';
  if (文本路径.includes('第1武魂') || 文本路径.includes('第2武魂') || 文本路径.some(片段 => /武魂/.test(片段))) {
    if (文本路径.some(片段 => /魂技|技能/.test(片段))) return '魂技占位';
    if (文本路径.some(片段 => /魂灵/.test(片段))) return '魂灵占位';
    if (文本路径.some(片段 => /魂环/.test(片段))) return '魂环占位';
    return '武魂占位';
  }
  if (文本路径.some(片段 => /魂技|技能/.test(片段))) return '魂技占位';
  if (文本路径.includes('状态')) return '状态占位';
  if (文本路径.includes('属性')) return '属性占位';
  if (文本路径.includes('社交')) return '社交占位';
  if (文本路径.includes('穿搭')) return '穿搭占位';
  if (文本路径.includes('背包')) return '背包占位';
  return '其他占位';
}

function 取运行时占位归属角色_V1(路径 = []) {
  const 文本路径 = (Array.isArray(路径) ? 路径 : []).map(片段 => String(片段 || '').trim());
  if (文本路径[0] === 'char' && 文本路径[1]) return 文本路径[1];
  return '角色外';
}

function 收集运行时可见占位统计_V1(视图 = {}) {
  const 角色统计 = new Map();
  let 总数 = 0;
  let 角色外 = 0;
  const 遍历 = (节点, 路径 = []) => {
    if (节点 === undefined || 节点 === null) return;
    const 末段 = String(路径[路径.length - 1] || '');
    if (末段.startsWith('_')) return;
    if (Array.isArray(节点)) {
      节点.forEach((子节点, 序号) => 遍历(子节点, [...路径, String(序号)]));
      return;
    }
    if (typeof 节点 === 'object') {
      Object.entries(节点).forEach(([键, 子节点]) => 遍历(子节点, [...路径, 键]));
      return;
    }
    if (!运行时文本需要补全_V1(节点)) return;
    const 归属角色 = 取运行时占位归属角色_V1(路径);
    角色统计.set(归属角色, (角色统计.get(归属角色) || 0) + 1);
    if (归属角色 === '角色外') 角色外 += 1;
    总数 += 1;
  };
  遍历(视图, []);
  return { 总数, 角色外, 角色: Array.from(角色统计.entries()).map(([名称, 数量]) => ({ 名称, 数量 })) };
}

function 收集运行时魂技待补全路径_V1(视图 = {}) {
  const 结果 = [];
  const 文本字段 = new Set(['魂技名', '画面描述', '效果描述', '产物描述']);
  const 是魂技路径 = 路径 => (Array.isArray(路径) ? 路径 : []).some(片段 => 是魂技槽位键_V1(片段));
  const 遍历 = (节点, 路径 = []) => {
    if (!节点 || typeof 节点 !== 'object') return;
    if (Array.isArray(节点)) {
      节点.forEach((子节点, 序号) => 遍历(子节点, [...路径, String(序号)]));
      return;
    }
    Object.entries(节点).forEach(([键, 值]) => {
      const 下一路径 = [...路径, 键];
      if (文本字段.has(键) && 是魂技路径(路径) && 运行时文本需要补全_V1(值)) {
        结果.push({
          路径: 构建运行时JsonPointer路径_V1(下一路径),
          技能路径: 路径.slice(0, -1),
          字段: 键,
        });
        return;
      }
      遍历(值, 下一路径);
    });
  };
  遍历(视图?.char ? { char: 视图.char } : {}, []);
  return 结果;
}

function 格式化运行时魂技待补全路径提示_V1(路径列表 = []) {
  const 列表 = Array.isArray(路径列表) ? 路径列表 : [];
  if (!列表.length) return [];
  const 前言 = [
    '',
    '[魂技待补全路径]',
    '只能写下列已存在路径；不要自造魂灵名、魂环名或魂技路径。',
  ];
  if (列表.length <= 3) {
    return [
      ...前言,
      ...列表.map(项 => `- ${项.路径}`),
      '只补文本字段；不要改 _效果数组、消耗、前摇、机制决策临时。',
    ];
  }
  const 聚合 = new Map();
  列表.forEach(项 => {
    const 技能路径 = Array.isArray(项.技能路径) ? 项.技能路径 : [];
    const key = 技能路径.join('\u0001');
    if (!聚合.has(key)) 聚合.set(key, { 技能路径, 字段: [] });
    聚合.get(key).字段.push(项.字段);
  });
  return [
    ...前言,
    ...Array.from(聚合.values()).map(项 => {
      const 显示路径 = 项.技能路径.slice(1).join(' / ');
      const 字段列表 = Array.from(new Set(项.字段)).join('、');
      return `- ${显示路径}：${字段列表}`;
    }),
    '只补文本字段；不要改 _效果数组、消耗、前摇、机制决策临时。',
  ];
}

function 格式化运行时占位统计_V1(统计 = {}) {
  const 总数 = Number(统计?.总数 || 0);
  if (!总数) return '待补全总数=0/0; 角色=无; 角色外=0/0项. 只把 xx 替换为本轮实际补全数量；未补全项只写数量和原因，不列路径或具体值。';
  const 角色文本 = (Array.isArray(统计.角色) ? 统计.角色 : [])
    .filter(项 => 项 && 项.名称 !== '角色外' && Number(项.数量 || 0) > 0)
    .map(项 => `${项.名称}xx/${Number(项.数量 || 0)}项`)
    .join('、');
  const 角色外总数 = Number(统计?.角色外 || 0);
  return `本次补全数量=xx/${总数}; 角色=${角色文本 || '无'}; 角色外=xx/${角色外总数}项. 只把 xx 替换为本轮实际补全数量；不要列路径或具体值。不准因为“剧情尚未涉及”“正文未直接描写”等原因拒绝补全。可根据当前角色设定、武魂/魂灵来源、字段名、父级对象和世界观常识推断稳定值。 是否全部补全:是/否`;
}

function 读取运行时最后角色消息文本_V1() {
  const 窗口列表 = [];
  const 已访问 = new Set();
  const 加入窗口 = 窗口 => {
    if (!窗口 || 已访问.has(窗口)) return;
    已访问.add(窗口);
    窗口列表.push(窗口);
  };
  try { 加入窗口(globalThis.window); } catch (错误) {}
  try { 加入窗口(globalThis.parent); } catch (错误) {}
  try { 加入窗口(globalThis.top); } catch (错误) {}
  try { 加入窗口(globalThis); } catch (错误) {}
  for (const 窗口 of 窗口列表) {
    try {
      const 上下文 = typeof 窗口?.SillyTavern?.getContext === 'function' ? 窗口.SillyTavern.getContext() : null;
      const 聊天列表 = Array.isArray(上下文?.chat) ? 上下文.chat : (Array.isArray(窗口?.chat) ? 窗口.chat : []);
      for (let index = 聊天列表.length - 1; index >= 0; index -= 1) {
        const 消息 = 聊天列表[index];
        if (!消息 || 消息.is_user) continue;
        const 文本 = String(消息.mes || 消息.message || 消息.content || '').trim();
        if (文本) return 文本;
      }
    } catch (错误) {}
  }
  return '';
}

function 生成MVU更新结构提示_V1(数据输入 = null, userInput = '', 最后角色消息输入 = '', plotText = '', 选项 = {}) {
  const 原始数据根 = 读取运行时Mvu数据根_V1(数据输入) || {};
  const 最后角色消息文本 = String(最后角色消息输入 || '').trim() || 读取运行时最后角色消息文本_V1();
  const 命中文本 = [userInput, 最后角色消息文本].map(文本 => String(文本 || '').trim()).filter(Boolean).join('\n');
  const 原始命中 = 构建运行时命中上下文_V1(原始数据根, 命中文本).运行时命中名称;
  const 草稿上下文 = 构建更新前运行时草稿_V1(原始数据根, 命中文本);
  const 数据根 = 草稿上下文.数据根;
  const 草稿命中 = 构建运行时命中上下文_V1(数据根, 命中文本).运行时命中名称;
  const 更新提示命中 = 合并运行时命中集合_V1(原始命中, 草稿命中);
  (Array.isArray(草稿上下文.命中角色) ? 草稿上下文.命中角色 : []).forEach(角色名 => {
    if (数据根?.char?.[角色名]) 更新提示命中.角色.add(角色名);
  });
  const 角色名集合 = 取运行时基础角色名集合_V1(数据根, 命中文本, { 运行时命中名称: 草稿命中 });
  (Array.isArray(草稿上下文.命中角色) ? 草稿上下文.命中角色 : []).forEach(角色名 => {
    if (数据根?.char?.[角色名]) 角色名集合.add(角色名);
  });
  const 物品候选上下文 = 构建运行时物品候选上下文_V1(数据根, 命中文本, { 角色名集合 });
  const 更新视图选项 = {
    运行时命中名称: 草稿命中,
    角色名集合,
    ...物品候选上下文,
    跳过提示前实例化: true,
    运行时提示已使用类型: 选项.运行时提示已使用类型,
  };
  const 更新视图 = 生成MVU更新视图_V1(数据根, userInput, 最后角色消息文本, plotText, 更新视图选项);
  const 可见占位统计 = 收集运行时可见占位统计_V1(更新视图);
  const 魂技待补全路径 = 收集运行时魂技待补全路径_V1(更新视图);
 
  return [
    'Existing MVU Entity Hits:',
    'Only names listed here count as already existing in MVU. Lore-known, worldbook-known, narratively familiar, or previously mentioned names do NOT count as existing unless listed here.',
    `char=${格式化MVU更新结构命中列表_V1(更新提示命中.角色)}; world.地点=${格式化MVU更新结构命中列表_V1(更新提示命中.地点)}; world.动态地点=${格式化MVU更新结构命中列表_V1(更新提示命中.动态地点)}; org=${格式化MVU更新结构命中列表_V1(更新提示命中.势力)}; 物品=${格式化MVU更新结构命中列表_V1(更新提示命中.物品)}.`,
    '',
    'Visible Placeholder Summary:',
    `待补全总数=${Number(可见占位统计?.总数 || 0)}; 角色=${(Array.isArray(可见占位统计.角色) ? 可见占位统计.角色 : []).filter(项 => 项 && 项.名称 !== '角色外' && Number(项.数量 || 0) > 0).map(项 => `${项.名称}${Number(项.数量 || 0)}项`).join('、') || '无'}; 角色外=${Number(可见占位统计?.角色外 || 0)}项.`,
    '',
    '[Placeholder Check]',
    格式化运行时占位统计_V1(可见占位统计),
    ...格式化运行时魂技待补全路径提示_V1(魂技待补全路径),
    '',
    '[Death State Rule]',
    'If a character dies, write 状态.存活=false and choose 状态.死亡类型 as 自然 or 意外. Do NOT write 死亡tick; the script records the current tick automatically.',
    '',
  '[Scene Presence & New Entity Check]',
  'You MUST audit and register newly introduced, durable entities before patching:',
  '1. 【Important Entity Diff】: Compare characters/places in this reply with "Existing MVU Entity Hits". First check if the entity already exists in the hits; if it exists, you are strictly PROHIBITED from adding it again! Only register when a completely NEW character/place with a proper name enters the long-term plot.',
  '2. 【Filter Passing NPCs/Scenes】: Strictly IGNORE generic descriptive NPCs (e.g., "板寸头", "瘦高个", "胖宿管") and one-off background places. Do NOT create MVU entities for them.',
  '3. 【Location Granularity Lock (FATAL)】: ABSOLUTELY FORBIDDEN to register micro-locations (e.g., specific rooms like "104号宿舍", floors, seats, corridors) as new locations! You MUST snap them to the parent 【Major Building/Functional Area】 (e.g., "宿舍区", "教学楼"). If a character enters "104号宿舍" and "宿舍区" is already in Hits, the location is deemed ALREADY EXISTING. DO NOT register it in the table!',
  '',
'New Entity Table:',
'char=Insert new durable characters with formal names (if none, write 无); world.动态地点=Insert new building-level locations (Micro-rooms/floors STRICTLY PROHIBITED. If parent area exists, force 无); org=Insert new factions (if none, write 无); 物品=Insert new mechanically relevant items only (important items/equipment/usable props/special materials/lasting access credentials; generic keys/clothes/routine documents/daily supplies write 无).',
'',
  ].join('\n');
}

function 收集运行时相关物品名_V1(数据根 = {}, 文本 = '', 角色名集合 = new Set(), 选项 = {}) {
  const 物品名集合 = new Set();
  const 物品候选上下文 = 构建运行时物品候选上下文_V1(数据根, 文本, { ...选项, 角色名集合 });
  收集运行时物品命中_V1(数据根, 文本, { ...选项, 角色名集合, ...物品候选上下文, 阈值: 5, 上限: 16 }).forEach(命中 => 物品名集合.add(命中.名称));
  return 物品名集合;
}

function 取运行时基础角色名集合_V1(数据根 = {}, 文本 = '', 选项 = {}) {
  const { 玩家名 } = 取运行时当前范围_V1(数据根);
  const 角色名集合 = new Set([玩家名].filter(Boolean));
  const 命中名称 = 构建运行时命中上下文_V1(数据根, 文本, 选项).运行时命中名称;
  命中名称.角色.forEach(角色名 => 角色名集合.add(角色名));
  return 角色名集合;
}

function 取运行时地点名集合_V1(数据根 = {}, 文本 = '', 选项 = {}) {
  const { 当前地点信息, 当前上下文节点 } = 取运行时当前范围_V1(数据根);
  const 地点名集合 = new Set([当前上下文节点].filter(Boolean));
  const 当前路径 = Array.isArray(当前地点信息?.path) ? 当前地点信息.path : [];
  当前路径.forEach((地点名, 序号) => {
    地点名集合.add(地点名);
    if (序号 > 0) 地点名集合.add(构建运行时地点路径名_V1(当前路径.slice(0, 序号 + 1)));
  });
  const 命中名称 = 构建运行时命中上下文_V1(数据根, 文本, 选项).运行时命中名称;
  命中名称.地点.forEach(地点名 => 地点名集合.add(地点名));
  return 地点名集合;
}

function 取运行时动态地点名集合_V1(数据根 = {}, 文本 = '') {
  const { 当前地点 } = 取运行时当前范围_V1(数据根);
  const 动态地点名集合 = new Set();
  if (数据根?.world?.动态地点?.[当前地点]) 动态地点名集合.add(当前地点);
  收集运行时父级限定动态地点命中_V1(数据根, 文本, {
    当前地点,
    命中动态地点: 数据根?.相关实体索引?.命中动态地点,
    阈值: 1,
    上限: 12,
  }).forEach(命中 => 动态地点名集合.add(命中.原名 || 命中.名称));
  return 动态地点名集合;
}

function 构建运行时地点候选_V1(数据根 = {}, userInput = '', 最后剧情文本 = '', 上限 = 12) {
  const 文本 = 清理提示审计扫描文本_V1([userInput, 最后剧情文本].map(值 => String(值 || '').trim()).filter(Boolean).join('\n'));
  const 索引 = 构建运行时地点索引_V1(数据根);
  const { 玩家, 当前地点, 当前地点信息, 当前上下文节点 } = 取运行时当前范围_V1(数据根);
  const 静态候选 = new Set();
  const 动态候选 = new Set();
  const 添加静态 = 名称 => {
    const 文本值 = 构建运行时地点路径名_V1(String(名称 || '').split('-').map(片段 => 片段.trim()).filter(Boolean));
    if (文本值 && 文本值 !== '无' && 文本值 !== '未知') 静态候选.add(文本值);
  };
  const 添加动态 = 名称 => {
    const 文本值 = String(名称 || '').trim();
    if (文本值 && 文本值 !== '无' && 文本值 !== '未知') 动态候选.add(文本值);
  };
  const 当前路径 = Array.isArray(当前地点信息?.path) ? 当前地点信息.path : [];
  当前路径.forEach((地点名, 序号) => {
    if (序号 > 0) 添加静态(构建运行时地点路径名_V1(当前路径.slice(0, 序号 + 1)));
    else 添加静态(地点名);
  });
  if (!当前路径.length) 添加静态(当前上下文节点);
  收集运行时地点命中_V1(数据根, 文本, {
    地点索引: 索引,
    命中地点: 数据根?.相关实体索引?.命中地点,
    命中动态地点: 数据根?.相关实体索引?.命中动态地点,
    阈值: 1,
    上限,
  }).forEach(命中 => 添加静态(命中.名称));
  收集运行时父级限定动态地点命中_V1(数据根, 文本, {
    地点索引: 索引,
    当前地点: 当前路径.length ? 构建运行时地点路径名_V1(当前路径) : 当前上下文节点,
    命中动态地点: 数据根?.相关实体索引?.命中动态地点,
    阈值: 1,
    上限,
  }).forEach(命中 => 添加动态(命中.名称));
  const 当前地点叶名 = 标准化运行时地点片段_V1(当前地点).leaf;
  const 当前地点数据 =
    当前地点信息?.node ||
    数据根?.world?.动态地点?.[当前地点] ||
    数据根?.world?.动态地点?.[当前地点叶名] ||
    {};
  return {
    已有地点: Array.from(静态候选).slice(0, 上限),
    动态地点: Array.from(动态候选).slice(0, 上限),
    表格行: 构建运行时地点候选表格行_V1(数据根, {
      已有地点: Array.from(静态候选).slice(0, 上限),
      动态地点: Array.from(动态候选).slice(0, 上限),
      玩家,
      当前地点,
      当前地点数据,
      当前路径: 当前路径.length ? 当前路径 : 标准化运行时地点片段_V1(当前地点).segments,
    }),
  };
}

function 取运行时地点候选坐标_V1(地点数据 = {}) {
  const x = Number(地点数据?.x);
  const y = Number(地点数据?.y);
  return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 ? { x, y } : null;
}

function 构建运行时地点候选关系_V1(候选路径 = [], 当前路径 = []) {
  const 候选 = (Array.isArray(候选路径) ? 候选路径 : []).filter(Boolean);
  const 当前 = (Array.isArray(当前路径) ? 当前路径 : []).filter(Boolean);
  if (!候选.length || !当前.length) return '相关候选';
  const 候选名 = 候选.join('-');
  const 当前名 = 当前.join('-');
  if (候选名 === 当前名) return '当前';
  if (当前名.startsWith(`${候选名}-`)) return 候选.length === 当前.length - 1 ? '父级' : '祖先';
  if (候选名.startsWith(`${当前名}-`)) return 候选.length === 当前.length + 1 ? '子级' : '后代';
  return '相关候选';
}

function 构建运行时地点候选步行描点_V1(地点数据 = {}, 当前地点数据 = {}, 玩家 = {}, 关系 = '', 数据根 = {}, 当前路径 = [], 目标路径 = []) {
  if (关系 === '当前') return '当前所在';
  if (关系 === '父级' || 关系 === '祖先') return '当前所属区域';
  if (关系 === '子级' || 关系 === '后代') return '当前地点内部';
  const 当前 = (Array.isArray(当前路径) ? 当前路径 : []).filter(Boolean);
  const 目标 = (Array.isArray(目标路径) ? 目标路径 : []).filter(Boolean);
  let 首个不同层级 = 0;
  while (首个不同层级 < 当前.length && 首个不同层级 < 目标.length && 当前[首个不同层级] === 目标[首个不同层级]) {
    首个不同层级 += 1;
  }
  if (首个不同层级 >= 当前.length || 首个不同层级 >= 目标.length) return '';
  const 当前比较节点 = 首个不同层级 === 当前.length - 1
    ? 当前地点数据
    : findMapNodeEntry(构建运行时地点路径名_V1(当前.slice(0, 首个不同层级 + 1)), 数据根)?.node;
  const 目标比较节点 = 首个不同层级 === 目标.length - 1
    ? 地点数据
    : findMapNodeEntry(构建运行时地点路径名_V1(目标.slice(0, 首个不同层级 + 1)), 数据根)?.node;
  const 目标坐标 = 取运行时地点候选坐标_V1(目标比较节点);
  const 起点坐标 =
    取运行时地点候选坐标_V1(当前比较节点) ||
    (首个不同层级 === 当前.length - 1 ? 取MVU角色卡有效坐标_V1(玩家) : null);
  if (!目标坐标 || !起点坐标) return '';
  const 距离 = Math.hypot(目标坐标.x - 起点坐标.x, 目标坐标.y - 起点坐标.y);
  if (!Number.isFinite(距离)) return '';
  if (距离 < 0.5) return '与主角同坐标';
  const 地图层级 = 首个不同层级 === 0 ? 'world' : 首个不同层级 === 1 ? 'city' : 'facility';
  const 层级倍率 = getTravelScaleByMapLevel(地图层级);
  return `距主角步行约${格式化运行时tick跨度文本_V1(Math.max(1, Math.floor(距离 * 1.5 * 层级倍率)))}`;
}

function 清理运行时地点候选表格行_V1(行 = {}) {
  return {
    类型: String(行.类型 || '').trim() || '无',
    可填目标地点: String(行.可填目标地点 || 行.完整路径 || '').trim() || '无',
    距离耗时: String(行.距离耗时 || 行.步行描点 || '').trim() || '无',
    状态: String(行.状态 || '').trim() || '无',
  };
}

function 构建运行时地点候选表格行_V1(数据根 = {}, 候选 = {}) {
  const 当前路径 = Array.isArray(候选.当前路径) ? 候选.当前路径 : [];
  const 当前地点数据 = 候选.当前地点数据 || {};
  const 玩家 = 候选.玩家 || {};
  const 行列表 = [];
  (Array.isArray(候选.已有地点) ? 候选.已有地点 : []).forEach(地点名 => {
    const 条目 = findMapNodeEntry(地点名, 数据根);
    const 路径 = Array.isArray(条目?.path) && 条目.path.length
      ? 条目.path
      : 标准化运行时地点片段_V1(地点名).segments;
    const 完整路径 = 路径.length ? 构建运行时地点路径名_V1(路径) : String(地点名 || '').trim();
    const 父级路径 = 路径.length >= 2 ? 构建运行时地点路径名_V1(路径.slice(0, -1)) : '';
    const 关系 = 构建运行时地点候选关系_V1(路径, 当前路径);
    if (关系 === '祖先') return;
    const 状态 = 中文化地图状态_V1(条目?.node?.状态);
    行列表.push(清理运行时地点候选表格行_V1({
      类型: '已有地点',
      可填目标地点: 完整路径,
      距离耗时: 构建运行时地点候选步行描点_V1(条目?.node, 当前地点数据, 玩家, 关系, 数据根, 当前路径, 路径),
      状态: 状态 && 状态 !== '完好' ? 状态 : '',
    }));
  });
  (Array.isArray(候选.动态地点) ? 候选.动态地点 : []).forEach(地点名 => {
    const 动态 = 数据根?.world?.动态地点?.[地点名] || {};
    const 显示模型 = 解析运行时动态地点显示模型_V1(数据根, 地点名, 动态, 当前路径);
    const 完整路径 = 显示模型.fillTarget || String(地点名 || '').trim();
    if (!完整路径) return;
    const 路径 = 标准化运行时地点片段_V1(完整路径).segments;
    const 关系 = 构建运行时地点候选关系_V1(路径, 当前路径);
    if (关系 === '祖先') return;
    const 状态 = 中文化地图状态_V1(动态?.状态);
    行列表.push(清理运行时地点候选表格行_V1({
      类型: '动态地点',
      可填目标地点: 完整路径,
      距离耗时: 构建运行时地点候选步行描点_V1(动态, 当前地点数据, 玩家, 关系, 数据根, 当前路径, 路径),
      状态: 状态 && 状态 !== '完好' ? 状态 : '',
    }));
  });
  return 行列表;
}

function 清理正文运行时值_V1(值) {
  return 过滤MVU正文视图值_V1(值, []);
}

function 正文文本可发送_V1(值) {
  return 正文视图值已初始化_V1(值);
}

function 构建运行时物品摘要_V1(物品定义 = {}) {
  return 过滤MVU正文视图值_V1(cloneJsonValue(物品定义, {}), ['物品', '示例物品']) || {};
}

function 正文需要商店库存_V1(文本 = '') {
  return /商店|店铺|购买|出售|交易|库存|价格|折扣|商品|逛店|采购|补给/.test(String(文本 || ''));
}

function 构建运行时商店摘要_V1(商店数据 = {}, 数据根 = {}, 文本 = '', 命中商店 = false, 选项 = {}) {
  if (!商店数据 || typeof 商店数据 !== 'object') return undefined;
  const 输出 = {};
  const 刷新tick = Number(商店数据._下次刷新tick || 0);
  if (命中商店 && 刷新tick > 0) 输出.下次进货时间 = formatTickToCalendarDateText(刷新tick);
  const 商品输出 = {};
  const 物品候选上下文 = 构建运行时物品候选上下文_V1(数据根, 文本, 选项);
  const 命中选项 = { ...选项, ...物品候选上下文 };
  const 优先物品集合 = 选项.优先物品 instanceof Set ? 选项.优先物品 : new Set();
  const 有优先物品 = 优先物品集合.size > 0;
  const 库存物品上限 = Math.max(1, Math.floor(Number(选项.库存物品上限 ?? 16)));
  const 候选商品列表 = Object.entries(商店数据?.库存 || {})
    .map(([商品名, 交易数据], 原序号) => {
      const 商品命中文本 = 运行时文本命中商品名_V1(文本, 商品名);
      const 商品命中优先 = 优先物品集合.has(商品名);
      if (!命中商店 && !商品命中文本 && !商品命中优先) return null;
      if (命中商店 && 有优先物品 && !商品命中文本 && !商品命中优先) return null;
      const 运行时定义 = 查找运行时物品定义_V1(数据根, 商品名);
      const 目录项 = 运行时定义?.定义 ? 构建运行时物品目录项_V1(商品名, 运行时定义.定义, 运行时定义.分类) : {};
      const 命中 = 计算运行时物品命中_V1(商品名, 目录项, 文本, 数据根, 命中选项);
      const 分数 = (商品命中优先 ? 100 : 0) + (命中?.分数 || (商品命中文本 ? 1 : 0));
      return { 商品名, 交易数据, 运行时定义, 分数, 原序号 };
    })
    .filter(Boolean)
    .sort((左, 右) => 右.分数 - 左.分数 || 左.原序号 - 右.原序号)
    .slice(0, 库存物品上限);
  候选商品列表.forEach(({ 商品名, 交易数据, 运行时定义 }) => {
    const 物品摘要 = 构建运行时物品摘要_V1(运行时定义?.定义 || {});
    const 条目 = 清理正文运行时值_V1({
      ...物品摘要,
      库存: 交易数据?.库存,
      价格倍率: 交易数据?.价格倍率,
      折扣: 交易数据?.折扣,
      需求声望: 交易数据?.需求声望,
    });
    if (条目) {
      商品输出[商品名] = 条目;
      if (选项.已发送物品 instanceof Set) 选项.已发送物品.add(商品名);
    }
  });
  if (Object.keys(商品输出).length) 输出.库存 = 商品输出;
  return Object.keys(输出).length ? 输出 : undefined;
}

function 构建正文商店库存摘要_V1(地点数据 = {}, 数据根 = {}, 文本 = '', 选项 = {}) {
  if (!地点数据 || typeof 地点数据 !== 'object' || !正文需要商店库存_V1(文本)) return undefined;
  const 输出 = {};
  Object.entries(地点数据.商店 || {}).forEach(([商店名, 商店数据]) => {
    const 命中商店 = 运行时文本命中名称_V1(文本, 商店名);
    const 命中商品 = Object.keys(商店数据?.库存 || {}).some(商品名 => 运行时文本命中商品名_V1(文本, 商品名));
    if (!命中商店 && !命中商品) return;
    const 商店摘要 = 构建运行时商店摘要_V1(商店数据, 数据根, 文本, 命中商店, 选项);
    if (商店摘要) 输出[商店名] = 商店摘要;
  });
  return Object.keys(输出).length ? 输出 : undefined;
}

function 构建更新地点薄片_V1(地点数据 = {}, 文本 = '') {
  const 地点 = 地点数据 && typeof 地点数据 === 'object' ? 地点数据 : {};
  const 输出 = {};
  ['人口', '守护军团', '经济状况', '状态'].forEach(字段 => {
    const 忽略列表 = 字段 === '状态' ? ['intact'] : [];
    if (更新视图字段有运行值_V1(地点[字段], { 忽略文本列表: 忽略列表 })) 输出[字段] = 地点[字段];
  });
  return 过滤MVU更新视图值_V1(准备运行时地图视图数据_V1(输出), ['world', '地点', '示例地点']) || {};
}

function 写入运行时地点树薄片_V1(地点输出 = {}, 地图条目 = null, 薄片 = {}) {
  if (!地点输出 || typeof 地点输出 !== 'object' || !地图条目?.path?.length || !薄片 || typeof 薄片 !== 'object' || Array.isArray(薄片)) return;
  let 当前 = 地点输出;
  地图条目.path.forEach((路径名, 序号) => {
    const 名称 = String(路径名 || '').trim();
    if (!名称) return;
    if (序号 === 0) {
      if (!当前[名称] || typeof 当前[名称] !== 'object' || Array.isArray(当前[名称])) 当前[名称] = {};
      当前 = 当前[名称];
      return;
    }
    if (!当前.子节点 || typeof 当前.子节点 !== 'object' || Array.isArray(当前.子节点)) 当前.子节点 = {};
    if (!当前.子节点[名称] || typeof 当前.子节点[名称] !== 'object' || Array.isArray(当前.子节点[名称])) 当前.子节点[名称] = {};
    当前 = 当前.子节点[名称];
  });
  Object.assign(当前, 薄片);
}

function 构建更新动态地点条目_V1(地点数据 = {}, 地点名 = '') {
  const 地点 = 地点数据 && typeof 地点数据 === 'object' ? 地点数据 : {};
  const 输出 = {};
  if (更新视图字段有运行值_V1(地点.状态, { 忽略文本列表: ['intact'] })) 输出.状态 = 地点.状态;
  return 过滤MVU更新视图值_V1(输出, ['world', '动态地点', '示例动态地点']) || {};
}

function 构建更新视图标准结构样例_V1(字段 = '') {
  switch (字段) {
    case '时间线':
      return { 示例事件: { 事件: '无', 触发tick: 0, 地点: '无', 状态: 'pending', 后续: '' } };
    case '委托板':
      return { 示例委托: { 标题: '无', 描述: '无', 框架描述: '无', 发布者: '系统', 面向: '公开', 指定对象: '无', 状态: '待接取', 难度: '中', 资源级别: '无', 奖励币: 0, 奖励声望: 0, 承接者: '无', 生成tick: 0 } };
    case '战斗':
      return { 进行中: false, 战斗类型: '未知', 先攻: '无', 允许撤离: true, 回合: 0, 环境: '正常', 战斗意图: '点到为止', 裁断结果: '', 参战者: {} };
    case '地点':
      return { 示例地点: { 人口: 0, 守护军团: '无', 经济状况: '未知', 状态: 'intact' } };
    case '动态地点':
      return { 示例动态地点: { 状态: 'intact' } };
    default:
      return {};
  }
}

function 为运行时物品定义注入提示_V1(物品定义 = {}) {
  const 定义 = cloneJsonValue(物品定义, {});
  const 装备技能 = 构建更新视图技能表薄片_V1(定义.装备技能);
  if (装备技能) 定义.装备技能 = 装备技能;
  else delete 定义.装备技能;
  const 输出 = 过滤MVU更新视图值_V1(定义, ['物品', '示例物品']) || {};
  if (装备技能) 输出.装备技能 = 装备技能;
  return 输出;
}

function 构建运行时委托草案条目_V1(条目 = {}) {
  return cloneJsonValue({
    标题: 条目?.标题,
    描述: 条目?.描述,
    框架描述: 条目?.框架描述,
    发布者: 条目?.发布者,
    面向: 条目?.面向,
    指定对象: 条目?.指定对象,
    状态: 条目?.状态,
    难度: 条目?.难度,
    资源级别: 条目?.资源级别,
    奖励币: 条目?.奖励币,
    奖励声望: 条目?.奖励声望,
    承接者: 条目?.承接者,
    生成tick: 条目?.生成tick,
  }, {}) || {};
}

function 构建运行时图鉴摘要条目_V1(条目 = {}) {
  return cloneJsonValue({
    类型: 条目?.类型,
    名称: 条目?.名称,
    年限档: 条目?.年限档,
    物种品质: 条目?.物种品质,
    常见级别: 条目?.常见级别,
    常见系别: 条目?.常见系别,
    标准技能数: 条目?.标准技能 && typeof 条目.标准技能 === 'object' ? Object.keys(条目.标准技能).length : 0,
  }, {}) || {};
}

function 格式化运行时tick日期文本_V1(tickValue = 0) {
  const safeTick = Math.max(0, Number(tickValue || 0));
  const totalMinutes = Math.round(safeTick * 10);
  const days = Math.floor(totalMinutes / (24 * 60));
  const years = Math.floor(days / 360);
  const months = Math.floor((days % 360) / 30) + 1;
  const currentDay = (days % 30) + 1;
  const remainderMinutes = totalMinutes % (24 * 60);
  const hours = Math.floor(remainderMinutes / 60);
  const mins = Math.floor(remainderMinutes % 60);
  return `斗罗历${20000 + years}年${months}月${currentDay}日 ${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function 格式化运行时tick跨度文本_V1(tickValue = 0) {
  const safeTick = Math.max(0, Number(tickValue || 0));
  const totalMinutes = Math.max(10, Math.round(safeTick * 10));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const mins = totalMinutes % 60;
  if (days > 0) return hours > 0 ? `${days}天${hours}小时` : `${days}天`;
  if (hours > 0) return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  if (mins === 30) return '半小时';
  return `${mins}分钟`;
}

function 格式化运行时未来事件剩余时间_V1(触发tick = 0, 当前tick = 0) {
  const 目标tick = Number(触发tick || 0);
  const 基准tick = Number(当前tick || 0);
  if (!Number.isFinite(目标tick) || 目标tick <= 0 || !Number.isFinite(基准tick) || 基准tick <= 0) return '';
  const 距离 = 目标tick - 基准tick;
  if (Math.abs(距离) < 0.0001) return '即将触发';
  return 距离 > 0
    ? `约${格式化运行时tick跨度文本_V1(距离)}后`
    : `已过${格式化运行时tick跨度文本_V1(Math.abs(距离))}`;
}

function 格式化远端原著时间线最大单位发生文本_V1(触发tick = 0, 当前tick = 0) {
  const 距离tick = Number(触发tick || 0) - Number(当前tick || 0);
  if (!Number.isFinite(距离tick) || 距离tick <= 0) return '即将发生';
  const 总天数 = Math.floor((距离tick * 10) / (24 * 60));
  const 年数 = Math.floor(总天数 / 360);
  if (年数 > 0) return `${年数}年后发生`;
  const 月数 = Math.floor(总天数 / 30);
  if (月数 > 0) return `${月数}个月后发生`;
  if (总天数 > 0) return `${总天数}天后发生`;
  return '1天内发生';
}

function 解析运行时tick日历片段_V1(tick值 = 0) {
  const 安全tick = Math.max(0, Number(tick值 || 0));
  const 总分钟 = Math.floor(安全tick * 10);
  const 总天数 = Math.floor(总分钟 / (24 * 60));
  const 年 = Math.floor(总天数 / 360);
  const 月 = Math.floor((总天数 % 360) / 30) + 1;
  const 日 = (总天数 % 30) + 1;
  const 当日分钟 = 总分钟 % (24 * 60);
  const 时 = Math.floor(当日分钟 / 60);
  const 分 = 当日分钟 % 60;
  return {
    日期键: `${20000 + 年}-${月}-${日}`,
    日期: `斗罗历${20000 + 年}年${月}月${日}日`,
    时间: `${时.toString().padStart(2, '0')}:${分.toString().padStart(2, '0')}`,
  };
}

function 收集后续原著时间线预览项_V1(当前tick = 0, 最大数量 = 20, 时间线事件源 = 读取原著时间线事件源_V1()) {
  const 当前tick数值 = Number(当前tick || 0);
  const 事件列表 = Array.isArray(时间线事件源) ? 时间线事件源 : Object.values(时间线事件源 || {}).flat();
  return 事件列表
    .map(事件 => {
      const 标识 = String(事件?.标识 || '').trim();
      const 触发tick = Number(事件?.触发tick || 0);
      return {
        标识,
        触发tick,
        剩余tick: 触发tick - 当前tick数值,
        描述: String(事件?.描述 || '').trim() || '无',
        简述: String(事件?.简述 || '').trim() || '无',
      };
    })
    .filter(事件 => 事件.标识 && Number.isFinite(事件.触发tick) && 事件.触发tick > 当前tick数值)
    .sort((左事件, 右事件) => 左事件.触发tick - 右事件.触发tick)
    .slice(0, Math.max(1, Number(最大数量 || 20)));
}

function 构建运行时原著时间线预览文本_V1(当前tick = 0, 最大数量 = 20) {
  const 预览列表 = 收集后续原著时间线预览项_V1(当前tick, 最大数量);
  if (!预览列表.length) return '当前暂无后续原著时间线参考节点。';
  let 上条日期键 = '';
  return 预览列表
    .map((事件, 序号) => {
      const 日历 = 解析运行时tick日历片段_V1(事件.触发tick);
      const 日期变化 = !上条日期键 || 上条日期键 !== 日历.日期键;
      上条日期键 = 日历.日期键;
      const 时间头 = 日期变化 ? `${日历.日期} ${日历.时间}` : 日历.时间;
      const 剩余时间 = 格式化运行时tick跨度文本_V1(事件.剩余tick);
      const 文本 = 序号 < 3 ? 事件.描述 : 事件.简述;
      return `${时间头}（约${剩余时间}后）｜${文本}`;
    })
    .join('\n');
}

var 远端原著时间线泛主角名_V1 = Object.freeze(new Set(['唐舞麟']));
var 远端原著时间线最低入选分_V1 = 9;
var 远端原著时间线高置信入选分_V1 = 13.5;
var 远端原著时间线同域入选分_V1 = 8.5;
var 远端原著时间线单锚点候选上限_V1 = 3;
var 远端原著时间线事件词_V1 = Object.freeze([
  '收留', '离别', '离开', '觉醒', '交易', '受伤', '拜师', '身份暴露',
  '魂灵', '魂导器', '斗铠', '升灵台', '魂灵塔', '比赛', '袭击', '救下',
  '融合', '突破', '失踪', '死亡', '入学', '锻造', '修炼', '告别', '追杀',
  '传灵塔', '史莱克', '唐门', '任务', '试炼', '暴露', '重逢',
]);
var 远端原著时间线强事件词_V1 = Object.freeze(new Set([
  '收留', '离别', '离开', '交易', '受伤', '拜师', '身份暴露',
  '升灵台', '魂灵塔', '比赛', '袭击', '救下', '失踪', '死亡',
  '入学', '告别', '追杀', '任务', '试炼', '暴露', '重逢',
]));
var 远端原著时间线事件词别名组_V1 = Object.freeze([
  Object.freeze(['入学', '报到', '报道', '登记', '开学', '新生', '分班']),
  Object.freeze(['比赛', '升班赛', '对抗赛', '挑战', '切磋']),
  Object.freeze(['交易', '购买', '出售', '竞拍', '拍卖']),
]);
var 远端原著时间线泛场景锚点_V1 = Object.freeze(new Set([
  '学生', '学员', '教师', '老师', '班级', '年级', '学院', '学校', '新生',
  '普通班', '普通学生', '高级学院', '中级学院', '初级学院',
]));

function 读取原著时间线事件源_V1() {
  try {
    return typeof TimelineEvents === 'undefined' ? {} : TimelineEvents;
  } catch (错误) {
    return {};
  }
}

function 收集原著时间线事件列表_V1(时间线事件源 = 读取原著时间线事件源_V1()) {
  if (Array.isArray(时间线事件源)) return 时间线事件源;
  if (!时间线事件源 || typeof 时间线事件源 !== 'object') return [];
  return Object.values(时间线事件源).flat().filter(事件 => 事件 && typeof 事件 === 'object');
}

function 标准化远端原著时间线人物列表_V1(人物 = []) {
  return 收集运行时字符串列表_V1(人物)
    .flatMap(名称 => String(名称 || '').split(/[、，,\/|｜\s]+/))
    .map(名称 => String(名称 || '').trim())
    .filter(Boolean);
}

function 构建远端原著时间线事件字段文本_V1(事件 = {}) {
  const 事件人物 = 标准化远端原著时间线人物列表_V1(事件?.人物);
  return {
    章节: String(事件?.章节 || ''),
    人物: 事件人物.join(' '),
    简述: String(事件?.简述 || ''),
    描述: String(事件?.描述 || ''),
  };
}

function 构建远端原著时间线事件检索文本_V1(事件 = {}) {
  const 字段文本 = 构建远端原著时间线事件字段文本_V1(事件);
  return [字段文本.章节, 字段文本.人物, 字段文本.简述, 字段文本.描述].filter(Boolean).join('\n');
}

function 是有效远端原著时间线命中词_V1(词 = '') {
  const 文本 = String(词 || '').trim();
  return 文本.length >= 2 && 文本 !== '无' && 文本 !== '未知' && !/^\d+$/.test(文本);
}

function 是具体远端原著时间线场景锚点_V1(词 = '') {
  const 文本 = String(词 || '').trim();
  if (!是有效远端原著时间线命中词_V1(文本) || 远端原著时间线泛场景锚点_V1.has(文本)) return false;
  if (/^[一二三四五六七八九十百千万\d]+班$/.test(文本) && !文本.includes('年级')) return false;
  return 文本.length >= 3 || /^[一二三四五六七八九十百千万\d]+班$/.test(文本);
}

function 是远端原著时间线班级锚点_V1(词 = '') {
  return /^[一二三四五六七八九十百千万\d]+年级(?:[一二三四五六七八九十百千万\d]+班)?$/.test(String(词 || '').trim());
}

function 是远端原著时间线组织场景锚点_V1(词 = '') {
  return /学院|传灵塔|唐门|协会|分会|分部|总部|拍卖场/.test(String(词 || '').trim());
}

function 是远端原著时间线精确场景强锚点_V1(词 = '') {
  const 文本 = String(词 || '').trim();
  if (!是具体远端原著时间线场景锚点_V1(文本)) return false;
  if (/^[\u4e00-\u9fa5A-Za-z0-9]{2,12}(?:城|市|大陆|联邦)$/.test(文本)) return false;
  if (/^[\u4e00-\u9fa5A-Za-z0-9]{2,12}学院$/.test(文本)) return false;
  return /年级|班|宿舍|寝室|接待点|食堂|教室|操场|办公室|教导处|门口|工作室|拍卖场|博物馆|协会|分会|升灵台|魂灵塔/.test(文本);
}

function 远端原著时间线文本含事件词_V1(文本 = '', 关键词 = '') {
  const 源文本 = String(文本 || '');
  const 词 = String(关键词 || '').trim();
  if (!词 || !源文本.includes(词)) return false;
  if (词 !== '入学') return true;
  let 位置 = 源文本.indexOf(词);
  while (位置 >= 0) {
    if (源文本[位置 - 1] !== '写') return true;
    位置 = 源文本.indexOf(词, 位置 + 1);
  }
  return false;
}

function 收集远端原著时间线事件词_V1(查询文本 = '', 事件文本 = '') {
  const 结果 = new Set();
  const 事件存在 = String(事件文本 || '').trim();
  远端原著时间线事件词_V1.forEach(关键词 => {
    if (远端原著时间线文本含事件词_V1(查询文本, 关键词) && (!事件存在 || 远端原著时间线文本含事件词_V1(事件文本, 关键词))) {
      结果.add(关键词);
    }
  });
  远端原著时间线事件词别名组_V1.forEach(词组 => {
    const 查询命中 = 词组.some(词 => 远端原著时间线文本含事件词_V1(查询文本, 词));
    const 事件命中 = !事件存在 || 词组.some(词 => 远端原著时间线文本含事件词_V1(事件文本, 词));
    if (查询命中 && 事件命中) 结果.add(词组[0]);
  });
  return Array.from(结果);
}

function 收集远端原著时间线事件词邻接词_V1(事件词列表 = []) {
  const 结果 = new Set();
  const 事件词集合 = new Set(收集运行时字符串列表_V1(事件词列表));
  远端原著时间线事件词别名组_V1.forEach(词组 => {
    if (词组.some(词 => 事件词集合.has(词))) 词组.forEach(词 => 结果.add(词));
  });
  return Array.from(结果);
}

function 收集远端原著时间线身份场景锚点_V1(...文本列表) {
  const 结果 = new Set();
  const 添加 = 词 => {
    const 文本 = String(词 || '').trim()
      .replace(/^(?:去|前往|赶往|进入|走进|来到|返回|离开|到|在|于|当前|作为|成为|加入)+/, '');
    if (!是有效远端原著时间线命中词_V1(文本)) return;
    if (/^[一二三四五六七八九十百千万\d]+(?:岁|级|环|阶)$/.test(文本)) return;
    if (结果.size < 40) 结果.add(文本);
  };
  收集运行时字符串列表_V1(文本列表).forEach(原文本 => {
    String(原文本 || '')
      .replace(/[，。；：！？、,.!?;:()[\]{}【】《》<>「」『』"'“”‘’|｜\\]+/g, ' ')
      .split(/\s+|\/|／|-/)
      .map(片段 => 片段.trim())
      .filter(Boolean)
      .forEach(片段 => {
        if (/(?:学院|传灵塔|唐门|协会|分会|分部|总部|拍卖场|年级|班|学生|学员|教师|老师|班主任|院长|主任)/.test(片段)) 添加(片段);
        (片段.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,18}(?:学院|传灵塔|唐门|协会|分会|分部|总部|拍卖场)/g) || []).forEach(添加);
        (片段.match(/[一二三四五六七八九十百千万\d]+年级(?:[一二三四五六七八九十百千万\d]+班)?/g) || []).forEach(命中 => {
          添加(命中);
          const 班级 = 命中.match(/[一二三四五六七八九十百千万\d]+班$/);
          if (班级) 添加(班级[0]);
        });
        (片段.match(/[一二三四五六七八九十百千万\d]+班/g) || []).forEach(添加);
      });
  });
  return Array.from(结果).sort((左, 右) => 右.length - 左.length || 左.localeCompare(右, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' }));
}

function 提取远端原著时间线显式物品词_V1(文本 = '') {
  const 结果 = new Set();
  const 源文本 = String(文本 || '')
    .split(/\n+/)
    .filter(行 => !/^\s*(?:开始剧情|当前地点|基础信息|家世描述|性格|外貌|武魂|副职业|职业)\s*[：:]/.test(String(行 || '').trim()))
    .join('\n');
  const 前缀噪声 = /^(?:我|你|他|她|它|我们|你们|他们|想|要|先|提前|准备|尝试|调查|寻找|找|获得|取得|收集|购买|买|出售|卖|使用|拿|取|去|来|把|将|这个|那个|一枚|一株|一张|一把|一件|一瓶|百年|千年|万年)+/;
  源文本
    .split(/[，。；：！？、,.!?;:()[\]{}【】《》<>「」『』"'“”‘’|｜/\\\s]+|以及|还有|或者|和|与|及|或/)
    .map(片段 => 片段.trim().replace(前缀噪声, ''))
    .filter(Boolean)
    .forEach(片段 => {
      const 匹配 = 片段.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,8}(?:丹|药|剂|草|果|茶|酒|肉|饭|糕|饼|汤|票|券|卡|石|晶|矿|骨|甲|剑|枪|刀|锤|弓|杖|环|珠|符|卷|图|书|芯|件|瓶|包|令|牌)$/);
      if (匹配 && 是有效远端原著时间线命中词_V1(匹配[0])) 结果.add(匹配[0]);
  });
  return Array.from(结果);
}

function 构建远端原著时间线频率上下文_V1(事件列表 = [], 词列表 = []) {
  const 统计词列表 = Array.from(new Set(
    收集运行时字符串列表_V1(词列表).filter(是有效远端原著时间线命中词_V1)
  ));
  const 频率 = new Map(统计词列表.map(词 => [词, 0]));
  const 字段频率 = new Map(统计词列表.map(词 => [词, new Map()]));
  事件列表.forEach(事件 => {
    const 事件文本 = 构建远端原著时间线事件检索文本_V1(事件);
    const 字段文本 = 构建远端原著时间线事件字段文本_V1(事件);
    统计词列表.forEach(词 => {
      const 统计证据词列表 = 收集远端原著时间线字段证据词_V1(词, '事件词');
      if (统计证据词列表.some(证据词 => 运行时文本包含片段_V1(事件文本, 证据词))) 频率.set(词, (频率.get(词) || 0) + 1);
      Object.entries(字段文本).forEach(([字段, 文本]) => {
        if (!统计证据词列表.some(证据词 => 运行时文本包含片段_V1(文本, 证据词))) return;
        const 词字段频率 = 字段频率.get(词);
        词字段频率.set(字段, (词字段频率.get(字段) || 0) + 1);
      });
    });
  });
  return { 总事件数: 事件列表.length, 频率, 字段频率 };
}

function 计算远端原著时间线字段频率倍率_V1(词 = '', 字段 = '', 频率上下文 = {}) {
  const 词字段频率 = 频率上下文?.字段频率?.get(String(词 || '').trim());
  const 频次 = Math.max(0, Number(词字段频率?.get(String(字段 || '').trim()) || 0));
  return Math.max(0.72, Math.min(1.28, 0.62 + 1.15 / Math.pow(频次 + 1, 0.32)));
}

function 收集远端原著时间线字段证据词_V1(词 = '', 标签 = '') {
  const 文本 = String(词 || '').trim();
  const 结果 = new Set([文本].filter(Boolean));
  if (标签 === '事件词') {
    远端原著时间线事件词别名组_V1.forEach(词组 => {
      if (词组.includes(文本)) 词组.forEach(别名 => 结果.add(别名));
    });
  }
  return Array.from(结果);
}

function 计算远端原著时间线字段证据_V1(事件 = {}, 词 = '', 标签 = '', 频率上下文 = {}) {
  const 文本 = String(词 || '').trim();
  if (!文本) return { 倍率: 0, 字段: '' };
  const 字段文本 = 构建远端原著时间线事件字段文本_V1(事件);
  const 证据词列表 = 收集远端原著时间线字段证据词_V1(文本, 标签);
  const 候选 = [];
  const 添加 = (字段, 基础倍率) => {
    const 命中词 = 证据词列表.find(证据词 => 运行时文本包含片段_V1(字段文本[字段], 证据词));
    if (!命中词) return;
    候选.push({
      字段,
      倍率: 基础倍率 * 计算远端原著时间线字段频率倍率_V1(命中词, 字段, 频率上下文),
    });
  };
  if (标签 === '人物' || 标签 === '泛主角') 添加('人物', 标签 === '人物' ? 1.2 : 0.95);
  添加('章节', 标签 === '地点' || 标签 === '势力' || 标签 === '场景锚点' ? 1.18 : 1.08);
  添加('简述', 标签 === '地点' || 标签 === '势力' || 标签 === '场景锚点' ? 1.06 : 1);
  添加('描述', 标签 === '地点' || 标签 === '势力' || 标签 === '场景锚点' ? 0.78 : 0.88);
  const 最佳 = 候选.sort((左, 右) => 右.倍率 - 左.倍率)[0];
  return 最佳 ? { 倍率: Math.max(0.45, Math.min(1.45, 最佳.倍率)), 字段: 最佳.字段 } : { 倍率: 0, 字段: '' };
}

function 选择远端原著时间线主导锚点_V1(锚点分值列表 = [], 命中原因 = '') {
  const 锚点汇总 = new Map();
  (Array.isArray(锚点分值列表) ? 锚点分值列表 : []).forEach((锚点, 序号) => {
    const 标签 = String(锚点?.标签 || '').trim();
    const 词 = String(锚点?.词 || '').trim();
    const 分值 = Number(锚点?.分值 || 0);
    if (!标签 || !是有效远端原著时间线命中词_V1(词) || !Number.isFinite(分值) || 分值 <= 0) return;
    const 键 = `${标签}:${词}`;
    const 已有 = 锚点汇总.get(键);
    if (已有) 已有.分值 += 分值;
    else 锚点汇总.set(键, { 标签, 词, 分值, 序号 });
  });
  const 有效锚点 = Array.from(锚点汇总.values())
    .map(锚点 => ({
      标签: String(锚点?.标签 || '').trim(),
      词: String(锚点?.词 || '').trim(),
      分值: Number(锚点?.分值 || 0),
      序号: Number(锚点?.序号 || 0),
    }))
    .filter(锚点 => 锚点.标签 && 是有效远端原著时间线命中词_V1(锚点.词) && Number.isFinite(锚点.分值) && 锚点.分值 > 0)
    .sort((左, 右) => 右.分值 - 左.分值 || 左.序号 - 右.序号);
  if (有效锚点.length) return `${有效锚点[0].标签}:${有效锚点[0].词}`;

  const 标签基础分 = new Map([
    ['人物', 10],
    ['物品', 9.5],
    ['事件词', 6.8],
    ['场景锚点', 5.8],
    ['势力', 3.5],
    ['地点', 2.2],
    ['关键词', 2.2],
    ['泛主角', 0.7],
    ['泛场景', 0.8],
  ]);
  const 原因文本 = String(命中原因 || '');
  return 原因文本
    .split('；')
    .map((片段, 序号) => {
      const 匹配 = String(片段 || '').match(/^([^:：]+)[:：]([^；]+)$/);
      const 标签 = String(匹配?.[1] || '').trim();
      const 词 = String(匹配?.[2] || '').split('/')[0].trim();
      return { 标签, 词, 分值: Number(标签基础分.get(标签) || 0), 序号 };
    })
    .filter(锚点 => 锚点.标签 && 是有效远端原著时间线命中词_V1(锚点.词) && 锚点.分值 > 0)
    .sort((左, 右) => 右.分值 - 左.分值 || 左.序号 - 右.序号)
    .map(锚点 => `${锚点.标签}:${锚点.词}`)[0] || '';
}

function 筛选远端原著时间线单锚点候选_V1(候选列表 = [], 最大数量 = 20, 锚点计数 = new Map()) {
  const 输出 = [];
  const 上限 = Math.max(1, Number(远端原著时间线单锚点候选上限_V1 || 3));
  const 目标数量 = Math.max(1, Number(最大数量 || 20));
  (Array.isArray(候选列表) ? 候选列表 : []).forEach(候选 => {
    if (!候选 || 输出.length >= 目标数量) return;
    const 主导锚点 = String(候选.主导锚点 || 选择远端原著时间线主导锚点_V1(候选.锚点分值, 候选.命中原因)).trim();
    if (主导锚点) {
      const 已有数量 = Math.max(0, Number(锚点计数.get(主导锚点) || 0));
      if (已有数量 >= 上限) return;
      锚点计数.set(主导锚点, 已有数量 + 1);
      候选.主导锚点 = 主导锚点;
    }
    输出.push(候选);
  });
  return 输出;
}

function 计算远端原著时间线逆频率倍率_V1(词 = '', 频率上下文 = {}) {
  const 频次 = Math.max(0, Number(频率上下文?.频率?.get(String(词 || '').trim()) || 0));
  return Math.max(0.4, Math.min(2.1, 0.35 + 1.85 / Math.pow(频次 + 1, 0.35)));
}

function 构建远端原著时间线运行补充文本_V1(数据根 = {}) {
  const { 玩家名, 当前地点, 当前地点信息, 当前上下文节点 } = 取运行时当前范围_V1(数据根);
  const 玩家 = 数据根?.char?.[玩家名] || {};
  const 当前路径 = Array.isArray(当前地点信息?.path) ? 当前地点信息.path : [];
  const 动态地点 = 数据根?.world?.动态地点?.[当前地点] || {};
  const 稳定当前地点 = 动态地点?.归属父节点 ? '' : 当前地点;
  return [
    数据根?.world?.时间?._calendar,
    稳定当前地点,
    当前上下文节点,
    当前路径.join(' '),
    当前路径.length ? 构建运行时地点路径名_V1(当前路径) : '',
    玩家名,
    玩家?.社交?.主身份,
    玩家?.社交?.势力身份,
    数据根?.sys?.系统播报,
    数据根?.world?.战斗?.环境?.地点,
    数据根?.world?.战斗?.战斗意图,
    动态地点?.归属父节点 ? 动态地点.归属父节点 : 玩家?.状态?.位置,
    动态地点?.归属父节点,
    动态地点?.势力,
    收集运行时字符串列表_V1(
      数据根?.相关实体索引?.角色,
      数据根?.相关实体索引?.命中地点,
      数据根?.相关实体索引?.命中势力,
      数据根?.相关实体索引?.命物品,
    ).join(' '),
  ].filter(Boolean).join('\n');
}

function 构建远端原著时间线查询文本_V1(数据根 = {}, 用户输入 = '') {
  return [
    用户输入,
    构建远端原著时间线运行补充文本_V1(数据根),
  ].filter(Boolean).join('\n');
}

function 收集远端原著时间线实体锚点_V1(数据根 = {}, 捕获文本 = '', 运行补充文本 = '') {
  const 当前tick = Number(数据根?.world?.时间?.tick || 0);
  const { 玩家名, 当前地点, 当前地点信息, 当前上下文节点 } = 取运行时当前范围_V1(数据根);
  const 玩家 = 数据根?.char?.[玩家名] || {};
  const 当前路径 = Array.isArray(当前地点信息?.path) ? 当前地点信息.path : [];
  const 当前动态地点数据 = 数据根?.world?.动态地点?.[当前地点] || {};
  const 角色 = new Set();
  const 地点 = new Set();
  const 势力 = new Set();
  const 物品 = new Set();
  const 场景锚点 = new Set();
  const 源权重 = new Map();
  const 添加 = (集合, 值列表, 权重) => {
    收集运行时字符串列表_V1(值列表).forEach(名称 => {
      if (!是有效远端原著时间线命中词_V1(名称)) return;
      集合.add(名称);
      源权重.set(名称, Math.max(Number(源权重.get(名称) || 0), 权重));
    });
  };
  const 合并文本命中 = (文本, 权重) => {
    const 命中名称 = 收集运行时命中名称_V1(数据根, 文本);
    添加(角色, Array.from(命中名称.角色 || []), 权重);
    添加(角色, Array.from(匹配文本内置角色名_V1(文本, 当前tick, 数据根)), 权重);
    添加(地点, Array.from(命中名称.地点 || []), 权重);
    Array.from(命中名称.动态地点 || []).forEach(地点名 => {
      const 地点数据 = 数据根?.world?.动态地点?.[地点名] || {};
      添加(地点, 地点数据?.归属父节点, Math.min(权重, 0.65));
      添加(势力, 地点数据?.势力, Math.min(权重, 0.65));
    });
    添加(势力, Array.from(命中名称.势力 || []), 权重);
    添加(物品, Array.from(命中名称.物品 || []), 权重);
    添加(物品, 提取远端原著时间线显式物品词_V1(文本), 权重);
  };
  合并文本命中(捕获文本, 1);
  合并文本命中(运行补充文本, 0.45);
  const 稳定当前地点 = 当前动态地点数据?.归属父节点 ? '' : 当前地点;
  添加(地点, [稳定当前地点, 当前上下文节点, 当前路径, 当前路径.length ? 构建运行时地点路径名_V1(当前路径) : ''], 0.7);
  添加(地点, 当前动态地点数据?.归属父节点, 0.65);
  添加(势力, 当前动态地点数据?.势力, 0.65);
  添加(场景锚点, 收集远端原著时间线身份场景锚点_V1(
    捕获文本,
    玩家?.社交?.主身份,
    玩家?.社交?.势力身份,
    稳定当前地点,
    当前上下文节点,
    当前路径,
    当前动态地点数据?.归属父节点,
    当前动态地点数据?.势力,
  ), 0.82);
  添加(角色, 数据根?.相关实体索引?.角色, 0.55);
  添加(地点, 数据根?.相关实体索引?.命中地点, 0.45);
  收集运行时字符串列表_V1(数据根?.相关实体索引?.命中动态地点).forEach(地点名 => {
    const 地点数据 = 数据根?.world?.动态地点?.[地点名] || {};
    添加(地点, 地点数据?.归属父节点, 0.45);
    添加(势力, 地点数据?.势力, 0.45);
  });
  添加(势力, 数据根?.相关实体索引?.命中势力, 0.45);
  添加(物品, 数据根?.相关实体索引?.命物品, 0.55);
  添加(场景锚点, 收集远端原著时间线身份场景锚点_V1(
    数据根?.相关实体索引?.命中地点,
    数据根?.相关实体索引?.命中势力,
  ), 0.55);
  return {
    角色,
    地点,
    势力,
    物品,
    场景锚点,
    实体: new Set([...地点, ...势力, ...物品, ...场景锚点]),
    源权重,
  };
}

function 计算远端原著时间线候选分数_V1(事件 = {}, 上下文 = {}) {
  const 事件人物 = 标准化远端原著时间线人物列表_V1(事件?.人物);
  const 事件文本 = 构建远端原著时间线事件检索文本_V1(事件);
  const 查询组织场景锚点 = Array.from(上下文.场景锚点 || []).filter(是远端原著时间线组织场景锚点_V1);
  const 需要组织约束的事件词 = new Set(['入学']);
  const 命中当前组织 = !查询组织场景锚点.length || 查询组织场景锚点.some(名称 => 运行时文本包含片段_V1(事件文本, 名称));
  const 是组织约束下的强场景 = 名称 => {
    if (!是远端原著时间线精确场景强锚点_V1(名称)) return false;
    if (是远端原著时间线班级锚点_V1(名称) && !命中当前组织) return false;
    return true;
  };
  let 分数 = 0;
  const 原因 = [];
  const 已计分词 = new Set();
  const 锚点分值 = [];
  let 明确命中类别数 = 0;
  const 组合命中 = new Set();
  const 强命中 = {
    精确场景: [],
    人物: [],
    物品: [],
    事件词: [],
  };
  const 计分 = (标签, 命中列表, 基础分, 显示数量 = 3) => {
    const 有效列表 = Array.from(new Set(命中列表 || []))
      .map(词 => String(词 || '').trim())
      .filter(词 => 是有效远端原著时间线命中词_V1(词) && !已计分词.has(词));
    if (!有效列表.length) return [];
    let 小计 = 0;
    let 最高来源倍率 = 0;
    有效列表.forEach(词 => {
      已计分词.add(词);
      const 来源倍率 = Math.max(0.35, Math.min(1, Number(上下文.源权重?.get(词) || 1)));
      const 字段证据 = 计算远端原著时间线字段证据_V1(事件, 词, 标签, 上下文.频率上下文);
      const 词分值 = 基础分 * 计算远端原著时间线逆频率倍率_V1(词, 上下文.频率上下文) * 来源倍率 * 字段证据.倍率;
      最高来源倍率 = Math.max(最高来源倍率, 来源倍率);
      小计 += 词分值;
      锚点分值.push({ 标签, 词, 分值: 词分值, 字段: 字段证据.字段 });
    });
    分数 += 小计;
    if (最高来源倍率 >= 0.8) 明确命中类别数 += 1;
    原因.push(`${标签}:${有效列表.slice(0, 显示数量).join('/')}`);
    return 有效列表;
  };
  const 人物命中 = 事件人物.filter(名称 => 上下文.角色.has(名称) || 运行时文本包含片段_V1(上下文.查询文本, 名称));
  const 非主角人物命中 = 人物命中.filter(名称 => !远端原著时间线泛主角名_V1.has(名称));
  计分('人物', 非主角人物命中, 10, 3);
  强命中.人物 = 非主角人物命中.filter(名称 => Number(上下文.源权重?.get(名称) || 0) >= 0.8);
  const 泛主角命中 = 人物命中.filter(名称 => 远端原著时间线泛主角名_V1.has(名称));
  计分('泛主角', 泛主角命中, 非主角人物命中.length ? 1.2 : 0.7, 2);
  const 物品命中 = Array.from(上下文.物品 || []).filter(名称 => 运行时文本包含片段_V1(事件文本, 名称));
  计分('物品', 物品命中, 9.5, 3);
  强命中.物品 = 物品命中.filter(名称 => Number(上下文.源权重?.get(名称) || 0) >= 0.8);
  const 场景锚点命中 = Array.from(上下文.场景锚点 || []).filter(名称 => 运行时文本包含片段_V1(事件文本, 名称));
  const 具体场景锚点命中 = 场景锚点命中.filter(是具体远端原著时间线场景锚点_V1);
  const 泛场景锚点命中 = 场景锚点命中.filter(名称 => !具体场景锚点命中.includes(名称));
  计分('场景锚点', 具体场景锚点命中, 5.8, 3);
  强命中.精确场景 = 具体场景锚点命中.filter(名称 => 是组织约束下的强场景(名称) && Number(上下文.源权重?.get(名称) || 0) >= 0.8);
  计分('泛场景', 泛场景锚点命中, 0.8, 2);
  const 势力命中 = Array.from(上下文.势力 || []).filter(名称 => 运行时文本包含片段_V1(事件文本, 名称));
  计分('势力', 势力命中, 3.5, 3);
  const 地点命中 = Array.from(上下文.地点 || []).filter(名称 => 运行时文本包含片段_V1(事件文本, 名称));
  计分('地点', 地点命中, 2.2, 3);
  const 事件词命中 = 收集远端原著时间线事件词_V1(上下文.查询文本, 事件文本);
  计分('事件词', 事件词命中, 6.8, 3);
  强命中.事件词 = 事件词命中.filter(词 => 远端原著时间线强事件词_V1.has(词) && Number(上下文.源权重?.get(词) || 0) >= 0.8 && (!需要组织约束的事件词.has(词) || 命中当前组织 || 强命中.精确场景.length || 强命中.人物.length || 强命中.物品.length));
  const 关键词命中 = (上下文.关键词 || []).filter(关键词 => 运行时文本包含片段_V1(事件文本, 关键词));
  计分('关键词', 关键词命中, 2.2, 4);
  const 组织场景锚点命中 = 具体场景锚点命中.filter(是远端原著时间线组织场景锚点_V1);
  const 班级场景锚点命中 = 具体场景锚点命中.filter(是远端原著时间线班级锚点_V1);
  const 查询班级锚点 = Array.from(上下文.场景锚点 || []).filter(是远端原著时间线班级锚点_V1);
  const 有组织同场命中 = !!(组织场景锚点命中.length || 地点命中.length || 势力命中.length);
  const 同域锚点命中 = Array.from(new Set([
    ...组织场景锚点命中,
    ...地点命中,
    ...势力命中,
  ])).filter(名称 => Number(上下文.源权重?.get(名称) || 0) >= 0.45);
  const 有同域锚点 = 同域锚点命中.length >= 2 && 同域锚点命中.some(名称 => Number(上下文.源权重?.get(名称) || 0) >= 0.65);
  const 追加组合命中 = (左 = '', 右 = '', 加分 = 0) => {
    const 左词 = String(左 || '').trim();
    const 右词 = String(右 || '').trim();
    if (!左词 || !右词 || 左词 === 右词) return false;
    分数 += 加分;
    组合命中.add(`${左词}+${右词}`);
    return true;
  };
  if (事件词命中.length && 同域锚点命中.length) {
    追加组合命中(同域锚点命中[0], 事件词命中[0], 1.4);
  }
  const 强精确场景命中 = 具体场景锚点命中.filter(是组织约束下的强场景);
  if (强精确场景命中.length && 事件词命中.length && (!班级场景锚点命中.length || 有组织同场命中)) {
    追加组合命中(
      强精确场景命中[0],
      事件词命中[0],
      查询班级锚点.length && !班级场景锚点命中.length ? 1.2 : 3,
    );
  }
  if (强精确场景命中.length && 非主角人物命中.length && (!班级场景锚点命中.length || 有组织同场命中)) {
    追加组合命中(强精确场景命中[0], 非主角人物命中[0], 2.5);
  }
  if (班级场景锚点命中.length && 有组织同场命中) {
    追加组合命中(班级场景锚点命中[0], 组织场景锚点命中[0] || 地点命中[0] || 势力命中[0], 2.8);
  }
  if (明确命中类别数 >= 2) 分数 += Math.min(3, (明确命中类别数 - 1) * 1.5);
  if (组合命中.size) 原因.push(`组合命中:${Array.from(组合命中).slice(0, 3).join('/')}`);
  if (分数 < (有同域锚点 ? 远端原著时间线同域入选分_V1 : 远端原著时间线最低入选分_V1)) return null;
  const 有强锚点 = Object.values(强命中).some(列表 => Array.isArray(列表) && 列表.length > 0);
  const 命中原因 = 原因.length ? 原因.join('；') : '文本相关';
  return {
    标识: String(事件?.标识 || '').trim(),
    触发tick: Number(事件?.触发tick || 0),
    章节: String(事件?.章节 || '').trim(),
    人物: 事件人物,
    原著事件: String(事件?.描述 || 事件?.简述 || '').trim() || '无',
    命中原因,
    分数,
    有强锚点,
    有同域锚点,
    强命中,
    锚点分值,
    主导锚点: 选择远端原著时间线主导锚点_V1(锚点分值, 命中原因),
  };
}

function 计算远端原著时间线链式扩展分数_V1(候选 = {}, 种子 = {}, 上下文 = {}) {
  if (!候选 || !种子 || 候选.标识 === 种子.标识) return null;
  const tick距离 = Math.abs(Number(候选.触发tick || 0) - Number(种子.触发tick || 0));
  const 种子事件文本 = 构建远端原著时间线事件检索文本_V1(种子);
  const 候选事件文本 = 构建远端原著时间线事件检索文本_V1(候选);
  const 种子人物 = 标准化远端原著时间线人物列表_V1(种子?.人物).filter(名称 => !远端原著时间线泛主角名_V1.has(名称));
  const 候选人物 = 标准化远端原著时间线人物列表_V1(候选?.人物).filter(名称 => !远端原著时间线泛主角名_V1.has(名称));
  const 共享人物 = 种子人物.filter(名称 => 候选人物.includes(名称));
  const 强场景 = 收集运行时字符串列表_V1(种子?.强命中?.精确场景, 上下文.场景锚点)
    .filter(是远端原著时间线精确场景强锚点_V1)
    .filter(名称 => 运行时文本包含片段_V1(候选事件文本, 名称));
  const 共享事件词 = 收集远端原著时间线事件词邻接词_V1(种子?.强命中?.事件词)
    .filter(词 => 远端原著时间线文本含事件词_V1(候选事件文本, 词));
  const 同章节 = String(候选?.章节 || '').trim() && String(候选?.章节 || '').trim() === String(种子?.章节 || '').trim();
  let 分数 = Math.max(0, Number(种子.分数 || 0) - 3.5);
  const 原因 = [];
  if (同章节) {
    分数 += 2.5;
    原因.push('同章节');
  }
  if (tick距离 <= 1440) {
    分数 += 2.2;
    原因.push('短tick距离');
  } else if (tick距离 <= 10080) {
    分数 += 1.1;
    原因.push('近邻tick');
  }
  if (强场景.length) {
    分数 += 3;
    原因.push(`同精确场景:${强场景.slice(0, 2).join('/')}`);
  }
  if (共享人物.length) {
    分数 += 2;
    原因.push(`同人物:${共享人物.slice(0, 2).join('/')}`);
  }
  if (共享事件词.length) {
    分数 += 1.6;
    原因.push(`同事件链:${共享事件词.slice(0, 2).join('/')}`);
  }
  if (!原因.length) return null;
  const 锚点分值 = [
    ...强场景.map(词 => ({ 标签: '场景锚点', 词, 分值: 3 })),
    ...共享人物.map(词 => ({ 标签: '人物', 词, 分值: 2 })),
    ...共享事件词.map(词 => ({ 标签: '事件词', 词, 分值: 1.6 })),
  ];
  return {
    标识: String(候选?.标识 || '').trim(),
    触发tick: Number(候选?.触发tick || 0),
    章节: String(候选?.章节 || '').trim(),
    人物: 标准化远端原著时间线人物列表_V1(候选?.人物),
    原著事件: String(候选?.描述 || 候选?.简述 || '').trim() || '无',
    命中原因: `链式扩展：由 ${种子.标识} 延伸（${原因.join('；')}）`,
    分数,
    有强锚点: true,
    强命中: { 精确场景: 强场景, 人物: 共享人物, 物品: [], 事件词: 共享事件词 },
    锚点分值,
    主导锚点: String(种子?.主导锚点 || '').trim() || 选择远端原著时间线主导锚点_V1(锚点分值, ''),
  };
}

function 收集远端原著时间线链式扩展候选_V1(全部事件列表 = [], 直接候选 = [], 上下文 = {}, 当前tick = 0, 排除标识 = new Set(), 最大数量 = 20) {
  const 事件索引 = new Map();
  全部事件列表.forEach((事件, 索引) => {
    if (事件?.标识) 事件索引.set(事件.标识, 索引);
  });
  const 扩展候选 = [];
  直接候选.slice(0, 6).forEach(种子 => {
    const 种子索引 = 事件索引.get(种子.标识);
    if (!Number.isInteger(种子索引)) return;
    for (let 偏移 = -3; 偏移 <= 5; 偏移++) {
      if (偏移 === 0) continue;
      const 候选 = 全部事件列表[种子索引 + 偏移];
      if (!候选 || !候选.标识 || 排除标识.has(候选.标识)) continue;
      if (!Number.isFinite(候选.触发tick) || 候选.触发tick <= 当前tick) continue;
      const 结果 = 计算远端原著时间线链式扩展分数_V1(候选, 种子, 上下文);
      if (结果) 扩展候选.push(结果);
    }
  });
  const 最佳 = new Map();
  扩展候选.forEach(候选 => {
    const 已有 = 最佳.get(候选.标识);
    if (!已有 || 候选.分数 > 已有.分数) 最佳.set(候选.标识, 候选);
  });
  return Array.from(最佳.values())
    .sort((左, 右) => {
      const 分差 = 右.分数 - 左.分数;
      if (Math.abs(分差) >= 2) return 分差;
      return 左.触发tick - 右.触发tick || 分差 || 左.标识.localeCompare(右.标识, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' });
    })
    .slice(0, Math.max(0, Number(最大数量 || 0)));
}

function 收集远端原著时间线候选_V1(数据根 = {}, 用户输入 = '', 最大数量 = 20) {
  const 当前tick = Number(数据根?.world?.时间?.tick || 0);
  const 捕获文本 = String(用户输入 || '');
  const 运行补充文本 = 构建远端原著时间线运行补充文本_V1(数据根);
  const 查询文本 = [捕获文本, 运行补充文本].filter(Boolean).join('\n');
  if (!查询文本.trim()) return [];
  const 近端标识 = new Set(收集后续原著时间线预览项_V1(当前tick, 3, 读取原著时间线事件源_V1()).map(事件 => 事件.标识));
  const 锚点 = 收集远端原著时间线实体锚点_V1(数据根, 捕获文本, 运行补充文本);
  const 关键词 = 切分运行时实体关键词_V1(查询文本, Array.from(锚点.实体).join(' '), Array.from(锚点.角色).join(' '))
    .filter(是有效远端原著时间线命中词_V1);
  const 全部事件列表 = 收集原著时间线事件列表_V1()
    .map(事件 => ({
      ...事件,
      标识: String(事件?.标识 || '').trim(),
      触发tick: Number(事件?.触发tick || 0),
    }));
  const 事件词 = 收集远端原著时间线事件词_V1(查询文本);
  [...事件词, ...关键词].forEach(词 => {
    const 证据词列表 = 收集远端原著时间线字段证据词_V1(词, '事件词');
    锚点.源权重.set(词, Math.max(Number(锚点.源权重.get(词) || 0), 证据词列表.some(证据词 => 运行时文本包含片段_V1(捕获文本, 证据词)) ? 1 : 0.45));
  });
  const 事件词证据词 = 事件词.flatMap(词 => 收集远端原著时间线字段证据词_V1(词, '事件词'));
  const 频率上下文 = 构建远端原著时间线频率上下文_V1(全部事件列表, [
    ...Array.from(锚点.角色),
    ...Array.from(锚点.地点),
    ...Array.from(锚点.势力),
    ...Array.from(锚点.物品),
    ...Array.from(锚点.场景锚点),
    ...事件词,
    ...事件词证据词,
    ...关键词,
  ]);
  const 上下文 = {
    查询文本,
    角色: 锚点.角色,
    地点: 锚点.地点,
    势力: 锚点.势力,
    物品: 锚点.物品,
    场景锚点: 锚点.场景锚点,
    关键词,
    源权重: 锚点.源权重,
    频率上下文,
  };
  const 可扫描事件列表 = 全部事件列表
    .filter(事件 => 事件.标识 && Number.isFinite(事件.触发tick) && 事件.触发tick > 当前tick && !近端标识.has(事件.标识))
    .map(事件 => 计算远端原著时间线候选分数_V1(事件, 上下文))
    .filter(Boolean)
    .sort((左, 右) => {
      const 分差 = 右.分数 - 左.分数;
      if (Math.abs(分差) >= 2) return 分差;
      return 左.触发tick - 右.触发tick || 分差 || 左.标识.localeCompare(右.标识, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' });
    });
  const 目标数量 = Math.max(1, Number(最大数量 || 20));
  const 锚点计数 = new Map();
  const 直接候选 = 筛选远端原著时间线单锚点候选_V1(
    可扫描事件列表.filter(事件 =>
      (事件.有强锚点 && 事件.分数 >= 远端原著时间线高置信入选分_V1)
      || (事件.有同域锚点 && 事件.分数 >= 远端原著时间线同域入选分_V1)
    ),
    目标数量,
    锚点计数,
  );
  if (!直接候选.length) return [];
  const 已选标识 = new Set(直接候选.map(事件 => 事件.标识));
  const 链式扩展候选池 = 直接候选.length >= 目标数量
    ? []
    : 收集远端原著时间线链式扩展候选_V1(
      全部事件列表,
      直接候选,
      上下文,
      当前tick,
      new Set([...近端标识, ...已选标识]),
      Math.max(目标数量 * 3, 目标数量 - 直接候选.length),
    );
  const 链式扩展 = 筛选远端原著时间线单锚点候选_V1(链式扩展候选池, 目标数量 - 直接候选.length, 锚点计数);
  return [...直接候选, ...链式扩展]
    .sort((左, 右) => {
      const 左链式 = String(左.命中原因 || '').includes('链式扩展') ? 1 : 0;
      const 右链式 = String(右.命中原因 || '').includes('链式扩展') ? 1 : 0;
      if (左链式 !== 右链式) return 左链式 - 右链式;
      const 分差 = 右.分数 - 左.分数;
      if (Math.abs(分差) >= 2) return 分差;
      return 左.触发tick - 右.触发tick || 分差 || 左.标识.localeCompare(右.标识, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' });
    })
    .slice(0, 目标数量);
}

function 构建远端原著时间线候选文本_V1(数据根 = {}, 用户输入 = '', 最大数量 = 20) {
  const 候选列表 = 收集远端原著时间线候选_V1(数据根, 用户输入, 最大数量);
  if (!候选列表.length) return '无远端原著时间线候选。';
  const 当前tick = Number(数据根?.world?.时间?.tick || 0);
  return 候选列表.map(事件 => {
    const 原本发生时间 = 格式化远端原著时间线最大单位发生文本_V1(事件.触发tick, 当前tick);
    return `${事件.标识}｜原本世界线于${原本发生时间}｜原著事件：${事件.原著事件}｜命中原因：${事件.命中原因}`;
  }).join('\n');
}

function 构建运行时未来事件条目_V1(条目 = {}, 选项 = {}) {
  const 触发tick = Number(条目?.触发tick || 0);
  const 输出 = {
    事件: 条目?.事件,
    触发tick,
    地点: 条目?.地点,
    状态: 条目?.状态,
    后续: 条目?.后续,
  };
  if (选项 && 选项.派生时间文本) {
    if (触发tick > 0) 输出.触发时间 = 格式化运行时tick日期文本_V1(触发tick);
    const 剩余时间 = 格式化运行时未来事件剩余时间_V1(触发tick, Number(选项.当前tick || 0));
    if (剩余时间) 输出.剩余时间 = 剩余时间;
  }
  return cloneJsonValue(输出, {}) || {};
}

function 构建运行时未来事件视图_V1(时间线 = {}, 最大数量 = 8, 选项 = {}) {
  const 输出 = {};
  Object.entries(时间线 || {})
    .filter(([, 条目]) => 条目 && typeof 条目 === 'object' && !Array.isArray(条目))
    .filter(([, 条目]) => !/done|handled|完成|已处理|取消|cancel/i.test(String(条目?.状态 || 'pending')))
    .sort((左项, 右项) => Number(左项?.[1]?.触发tick || 0) - Number(右项?.[1]?.触发tick || 0))
    .slice(0, Math.max(1, 最大数量))
    .forEach(([事件名, 条目]) => {
      const 片段 = 构建运行时未来事件条目_V1(条目, 选项);
      if (片段 && typeof 片段 === 'object' && Object.keys(片段).length) 输出[事件名] = 片段;
    });
  return 输出;
}

function 复制运行时命中记录表片段_V1(记录表 = {}, 文本 = '', 最大数量 = 8, 构建条目 = 记录 => cloneJsonValue(记录, {})) {
  const 输出 = {};
  Object.entries(记录表 || {}).forEach(([键, 记录]) => {
    if (Object.keys(输出).length >= 最大数量) return;
    if (!运行时记录命中文本_V1(键, 记录, 文本)) return;
    const 片段 = 构建条目(记录, 键);
    if (片段 && typeof 片段 === 'object' && Object.keys(片段).length) 输出[键] = 片段;
  });
  return 输出;
}

function 构建正文机密情报条目_V1(条目 = {}) {
  return cloneJsonValue({
    内容: 条目?.内容,
    知情规则: Array.isArray(条目?.知情规则) ? 条目.知情规则 : undefined,
  }, {}) || {};
}

function 删除运行时对象字段_V1(对象 = null, 字段列表 = []) {
  if (!对象 || typeof 对象 !== 'object') return;
  字段列表.forEach(字段 => {
    if (Object.prototype.hasOwnProperty.call(对象, 字段)) delete 对象[字段];
  });
}

function 运行时文本需要补全_V1(值) {
  const 文本 = String(值 ?? '').trim();
  return 文本 === '待生成' || /^待补全/.test(文本) || /^AI_TODO/.test(文本);
}

function 读取运行时本轮模块结算只读路径_V1() {
  try {
    const 当前时间 = Date.now();
    const 运行时根列表 = [];
    const 追加运行时根 = 运行时根 => {
      try {
        if (运行时根 && typeof 运行时根 === 'object' && !运行时根列表.includes(运行时根)) 运行时根列表.push(运行时根);
      } catch (错误) {}
    };
    try { 追加运行时根(window); } catch (错误) {}
    try { 追加运行时根(window.parent); } catch (错误) {}
    try { 追加运行时根(window.top); } catch (错误) {}
    try { 追加运行时根(globalThis); } catch (错误) {}
    const 记录 = 运行时根列表
      .map(运行时根 => {
        try { return 运行时根.__LWCS_本轮模块结算路径__; } catch (错误) { return null; }
      })
      .find(候选记录 => 候选记录 && typeof 候选记录 === 'object' && Number(候选记录.过期时间 || 0) > 当前时间);
    if (!记录 || typeof 记录 !== 'object' || Number(记录.过期时间 || 0) <= 当前时间) return [];
    return (Array.isArray(记录.路径列表) ? 记录.路径列表 : [])
      .filter(路径 => Array.isArray(路径) && 路径.length > 1)
      .map(路径 => 路径.map(片段 => String(片段 ?? '').trim()).filter(Boolean))
      .filter(路径 => 路径.length > 1 && ['sys', 'world', 'org', 'char', '物品'].includes(路径[0]));
  } catch (错误) {
    return [];
  }
}

function 构建运行时本轮模块结算视图只读路径列表_V1(只读路径列表 = []) {
  const 输出 = [];
  const 追加路径 = 路径 => {
    if (!Array.isArray(路径) || 路径.length < 2) return;
    const 路径键 = 路径.join('\u0001');
    if (输出.some(已有路径 => 已有路径.join('\u0001') === 路径键)) return;
    输出.push(路径);
  };
  (Array.isArray(只读路径列表) ? 只读路径列表 : []).forEach(原路径 => {
    const 路径 = Array.isArray(原路径) ? 原路径.map(片段 => String(片段 ?? '').trim()).filter(Boolean) : [];
    if (路径.length < 2) return;
    追加路径(路径);
  });
  return 输出;
}

function 投影运行时本轮模块结算只读字段_V1(视图 = {}, 只读路径列表 = []) {
  if (!视图 || typeof 视图 !== 'object' || !Array.isArray(只读路径列表) || 只读路径列表.length === 0) return 视图;
  构建运行时本轮模块结算视图只读路径列表_V1(只读路径列表).forEach(路径 => {
    if (!Array.isArray(路径) || 路径.length < 2) return;
    let 当前节点 = 视图;
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
  return 视图;
}

function 运行时记录命中文本_V1(键 = '', 记录 = {}, 文本 = '') {
  if (运行时文本命中名称_V1(文本, 键)) return true;
  if (!记录 || typeof 记录 !== 'object') return false;
  return ['名称', '事件', '标题', '内容', '请求名', '委托名', '拍品名', '地点', '势力', '角色'].some(字段 =>
    运行时文本命中名称_V1(文本, 记录?.[字段]),
  );
}

function 复制运行时命中记录表_V1(记录表 = {}, 文本 = '', 最大数量 = 12) {
  const 输出 = {};
  Object.entries(记录表 || {}).forEach(([键, 记录]) => {
    if (Object.keys(输出).length >= 最大数量) return;
    if (运行时记录命中文本_V1(键, 记录, 文本)) 输出[键] = cloneJsonValue(记录, {});
  });
  return 输出;
}

function 构建运行时拍卖薄片_V1(拍卖 = {}, 文本 = '', 最大拍品数 = 6) {
  if (!拍卖 || typeof 拍卖 !== 'object') return {};
  const 拍品 = {};
  const 拍品表 = 拍卖.拍品 && typeof 拍卖.拍品 === 'object' ? 拍卖.拍品 : {};
  const 拍品名列表 = Object.keys(拍品表);
  const 拍卖开市 = String(拍卖.状态 || '休市') !== '休市' && 拍品名列表.length > 0;
  const 拍卖文本命中 = /拍卖|竞拍|竞价|拍品/.test(String(文本 || ''));
  const 拍卖地点命中 = 运行时文本命中名称_V1(文本, 拍卖.地点);
  const 拍卖命中 = 拍卖文本命中
    || 拍卖地点命中
    || 运行时文本命中名称_V1(文本, 拍卖.状态);
  Object.entries(拍品表).forEach(([拍品名, 拍品数据]) => {
    if (Object.keys(拍品).length >= 最大拍品数) return;
    if (拍卖开市 || 拍卖命中 || 运行时记录命中文本_V1(拍品名, 拍品数据, 文本)) 拍品[拍品名] = cloneJsonValue(拍品数据, {});
  });
  if (!拍卖开市 && !拍卖文本命中 && !拍卖地点命中 && !Object.keys(拍品).length) return {};
  const 输出 = {
    状态: 拍卖.状态 || '休市',
    地点: 拍卖.地点 || '无',
    下次刷新时间: formatTickToCalendarDateText(拍卖.下次刷新tick || 0),
  };
  if (Object.keys(拍品).length) 输出.拍品 = 拍品;
  return cloneJsonValue(输出, {}) || {};
}

function 运行时对象有内容_V1(值 = null) {
  if (!值 || typeof 值 !== 'object') return false;
  return Object.keys(值).length > 0;
}

function 写入运行时场外冷却文本_V1(节点 = null, 当前tick = 0) {
  if (!节点 || typeof 节点 !== 'object' || !Object.prototype.hasOwnProperty.call(节点, '场外冷却至tick')) return;
  const 冷却至tick = Math.max(0, Number(节点.场外冷却至tick || 0));
  if (冷却至tick > Math.max(0, Number(当前tick || 0))) 节点.场外冷却 = `冷却中至${formatTickToCalendarDateText(冷却至tick)}`;
  delete 节点.场外冷却至tick;
}

function 删除正文视图机制字段_V1(节点 = null, 当前tick = 0) {
  if (!节点 || typeof 节点 !== 'object') return;
  if (Array.isArray(节点)) {
    节点.forEach(项 => 删除正文视图机制字段_V1(项, 当前tick));
    return;
  }
  写入运行时场外冷却文本_V1(节点, 当前tick);
  ['_效果数组', '使用效果', '属性加成', '属性倍率', '装备技能', '副职业参数', '消耗', '前摇'].forEach(键 => {
    if (Object.prototype.hasOwnProperty.call(节点, 键)) delete 节点[键];
  });
  if (节点.战力面板 && typeof 节点.战力面板 === 'object' && !Array.isArray(节点.战力面板)) {
    const 对标等级 = Number(节点.战力面板.对标等级 || 0);
    if (Number.isFinite(对标等级) && 对标等级 > 0) 节点.战力面板 = { 对标等级 };
    else delete 节点.战力面板;
  }
  Object.values(节点).forEach(子节点 => 删除正文视图机制字段_V1(子节点, 当前tick));
}

function 清理运行时已补全技能效果数组_V1(节点 = null) {
  if (!节点 || typeof 节点 !== 'object') return;
  if (Array.isArray(节点)) {
    节点.forEach(项 => 清理运行时已补全技能效果数组_V1(项));
    return;
  }
  if (
    Array.isArray(节点._效果数组) &&
    正文视图值已初始化_V1(节点.画面描述) &&
    正文视图值已初始化_V1(节点.效果描述)
  ) {
    delete 节点._效果数组;
    delete 节点.画面描述;
    delete 节点.效果描述;
  }
  Object.values(节点).forEach(子节点 => 清理运行时已补全技能效果数组_V1(子节点));
}

function 更新视图字段有运行值_V1(值, 选项 = {}) {
  if (值 === undefined || 值 === null) return false;
  if (typeof 值 === 'string') {
    const 文本 = 值.trim();
    if (!文本 || 文本 === '无' || 文本 === '未知') return false;
    if (Array.isArray(选项.忽略文本列表) && 选项.忽略文本列表.includes(文本)) return false;
    if (选项.允许待补全 !== true && (/^待补全/.test(文本) || /^AI_TODO/.test(文本))) return false;
    return true;
  }
  if (typeof 值 === 'number') return Number.isFinite(Number(值));
  if (typeof 值 === 'boolean') return 值 === true;
  if (Array.isArray(值)) return 值.some(项 => 更新视图字段有运行值_V1(项, 选项));
  if (typeof 值 === 'object') return Object.keys(值).length > 0;
  return false;
}

function 更新视图技能存在待补字段_V1(技能 = {}) {
  if (!技能 || typeof 技能 !== 'object' || Array.isArray(技能)) return false;
  return ['魂技名', '画面描述', '效果描述', '产物描述'].some(字段 => 运行时文本需要补全_V1(技能[字段]));
}

function 更新视图技能节点已补全_V1(技能 = {}) {
  if (!技能 || typeof 技能 !== 'object' || Array.isArray(技能)) return false;
  if (更新视图技能存在待补字段_V1(技能)) return false;
  const 效果已补全 = 正文视图值已初始化_V1(技能.效果描述 || 技能.描述);
  const 画面已补全 = 正文视图值已初始化_V1(技能.画面描述);
  if (!效果已补全 || !画面已补全) return false;
  if (Object.prototype.hasOwnProperty.call(技能, '魂技名') && !正文视图值已初始化_V1(技能.魂技名)) return false;
  if (Object.prototype.hasOwnProperty.call(技能, '产物描述') && !正文视图值已初始化_V1(技能.产物描述)) return false;
  return true;
}

function 构建更新视图技能薄片_V1(技能 = {}) {
  if (!技能 || typeof 技能 !== 'object' || Array.isArray(技能)) return undefined;
  if (更新视图技能节点已补全_V1(技能)) return undefined;
  const 输出 = {};
  ['魂技名', '_简易效果描述', '画面描述', '效果描述', '产物描述'].forEach(字段 => {
    if (更新视图字段有运行值_V1(技能[字段], { 允许待补全: true })) 输出[字段] = cloneJsonValue(技能[字段], 技能[字段]);
  });
  return Object.keys(输出).length ? 输出 : undefined;
}

function 构建更新视图技能表薄片_V1(技能表 = {}) {
  if (!技能表 || typeof 技能表 !== 'object' || Array.isArray(技能表)) return undefined;
  const 输出 = {};
  Object.entries(技能表).forEach(([技能名, 技能]) => {
    const 技能薄片 = 构建更新视图技能薄片_V1(技能);
    if (技能薄片) 输出[技能名] = 技能薄片;
  });
  return Object.keys(输出).length ? 输出 : undefined;
}

function 收口更新视图魂环技能_V1(魂环 = {}) {
  if (!魂环 || typeof 魂环 !== 'object' || Array.isArray(魂环)) return;
  取魂环魂技条目_V1(魂环).forEach(([魂技键, 魂技]) => {
    const 技能薄片 = 构建更新视图技能薄片_V1(魂技);
    if (技能薄片) 魂环[魂技键] = 技能薄片;
    else delete 魂环[魂技键];
  });
}

function 收口更新视图气血魂环技能_V1(魂环 = {}) {
  if (!魂环 || typeof 魂环 !== 'object' || Array.isArray(魂环)) return;
  取气血魂环魂技条目_V1(魂环).forEach(([魂技键, 魂技]) => {
    const 技能薄片 = 构建更新视图技能薄片_V1(魂技);
    if (技能薄片) 魂环[魂技键] = 技能薄片;
    else delete 魂环[魂技键];
  });
}

function 收口更新视图角色技能_V1(角色 = {}) {
  if (!角色 || typeof 角色 !== 'object' || Array.isArray(角色)) return;
  取角色武魂条目_V1(角色).forEach(([, 武魂]) => {
    取武魂魂灵条目_V1(武魂).forEach(([, 魂灵]) => {
      取魂灵魂环条目_V1(魂灵).forEach(([, 魂环]) => 收口更新视图魂环技能_V1(魂环));
    });
    取武魂直接魂环条目_V1(武魂).forEach(([, 魂环]) => 收口更新视图魂环技能_V1(魂环));
  });
  const 自创魂技 = 构建更新视图技能表薄片_V1(角色.自创魂技);
  if (自创魂技) 角色.自创魂技 = 自创魂技;
  else delete 角色.自创魂技;

  Object.entries(角色.武魂融合技 || {}).forEach(([技能名, 融合技]) => {
    const 技能薄片 = 构建更新视图技能薄片_V1(融合技?.技能数据);
    if (技能薄片) 角色.武魂融合技[技能名] = { 技能数据: 技能薄片 };
    else delete 角色.武魂融合技[技能名];
  });
  if (角色.武魂融合技 && !Object.keys(角色.武魂融合技).length) delete 角色.武魂融合技;

  if (角色.血脉之力 && typeof 角色.血脉之力 === 'object' && !Array.isArray(角色.血脉之力)) {
    const 血脉技能 = 构建更新视图技能表薄片_V1(角色.血脉之力.技能);
    const 血脉被动 = 构建更新视图技能表薄片_V1(角色.血脉之力.被动);
    if (血脉技能) 角色.血脉之力.技能 = 血脉技能;
    else delete 角色.血脉之力.技能;
    if (血脉被动) 角色.血脉之力.被动 = 血脉被动;
    else delete 角色.血脉之力.被动;
    取血脉气血魂环条目_V1(角色.血脉之力).forEach(([, 魂环]) => 收口更新视图气血魂环技能_V1(魂环));
    if (!Object.keys(角色.血脉之力).length) delete 角色.血脉之力;
  }

  Object.values(角色.魂骨 || {}).forEach(魂骨 => {
    if (!魂骨 || typeof 魂骨 !== 'object' || Array.isArray(魂骨)) return;
    const 附带技能 = 构建更新视图技能表薄片_V1(魂骨.附带技能);
    if (附带技能) 魂骨.附带技能 = 附带技能;
    else delete 魂骨.附带技能;
  });
}

function 更新视图值等于默认值_V1(值, 默认值) {
  if (Array.isArray(默认值)) {
    if (!Array.isArray(值) || 值.length !== 默认值.length) return false;
    return 默认值.every((项, index) => 更新视图值等于默认值_V1(值[index], 项));
  }
  return String(值 ?? '').trim() === String(默认值 ?? '').trim();
}

function 更新视图值包含待补文本_V1(值) {
  if (Array.isArray(值)) return 值.some(项 => 更新视图值包含待补文本_V1(项));
  if (值 && typeof 值 === 'object') return Object.values(值).some(项 => 更新视图值包含待补文本_V1(项));
  return 运行时文本需要补全_V1(值);
}

function 更新视图待补字段_V1(节点 = {}, 字段 = '', 默认值) {
  if (!节点 || typeof 节点 !== 'object' || Array.isArray(节点)) return;
  if (!更新视图值等于默认值_V1(节点[字段], 默认值) && !更新视图值包含待补文本_V1(节点[字段])) delete 节点[字段];
}

function 更新视图对象有内容_V1(节点 = {}) {
  return !!节点 && typeof 节点 === 'object' && !Array.isArray(节点) && Object.keys(节点).length > 0;
}

function 裁剪更新视图魂技默认字段_V1(魂技 = {}) {
  if (!魂技 || typeof 魂技 !== 'object' || Array.isArray(魂技)) return false;
  const 存在待补字段 = 更新视图技能存在待补字段_V1(魂技);
  ['魂技名', '画面描述', '效果描述', '产物描述', '_简易效果描述'].forEach(字段 => {
    if (字段 === '_简易效果描述' && 存在待补字段 && 更新视图字段有运行值_V1(魂技[字段], { 允许待补全: true })) return;
    if (!运行时文本需要补全_V1(魂技[字段])) delete 魂技[字段];
  });
  Object.keys(魂技).forEach(字段 => {
    if (!['魂技名', '画面描述', '效果描述', '产物描述', '_简易效果描述'].includes(字段)) delete 魂技[字段];
  });
  return 更新视图对象有内容_V1(魂技);
}

function 裁剪更新视图魂环默认字段_V1(魂环 = {}, 选项 = {}) {
  if (!魂环 || typeof 魂环 !== 'object' || Array.isArray(魂环)) return false;
  const 保留来源 = 选项.保留来源 === true;
  更新视图待补字段_V1(魂环, '颜色', '无');
  if (保留来源) {
    const 来源文本 = String(魂环.来源 ?? '').trim();
    if (!来源文本 || 来源文本 === '无') 魂环.来源 = 独立魂环来源待补全文案_V1;
    更新视图待补字段_V1(魂环, '来源', 独立魂环来源待补全文案_V1);
  } else delete 魂环.来源;
  取魂环魂技条目_V1(魂环).forEach(([魂技键, 魂技]) => {
    if (!裁剪更新视图魂技默认字段_V1(魂技)) delete 魂环[魂技键];
  });
  Object.keys(魂环).forEach(字段 => {
    if (字段 !== '颜色' && 字段 !== '来源' && !是魂技槽位键_V1(字段)) delete 魂环[字段];
  });
  return 更新视图对象有内容_V1(魂环);
}

function 裁剪更新视图魂灵默认字段_V1(魂灵 = {}) {
  if (!魂灵 || typeof 魂灵 !== 'object' || Array.isArray(魂灵)) return false;
  更新视图待补字段_V1(魂灵, '表象名称', AI_TODO_SOUL_SPIRIT_NAME);
  if (!运行时文本需要补全_V1(魂灵.描述)) delete 魂灵.描述;
  更新视图待补字段_V1(魂灵, '品质', AI_TODO_SOUL_SPIRIT_QUALITY);
  取魂灵魂环条目_V1(魂灵).forEach(([魂环键, 魂环]) => {
    if (!裁剪更新视图魂环默认字段_V1(魂环, { 保留来源: false })) delete 魂灵[魂环键];
  });
  Object.keys(魂灵).forEach(字段 => {
    if (!['表象名称', '描述', '品质'].includes(字段) && !是魂环槽位键_V1(字段)) delete 魂灵[字段];
  });
  return 更新视图对象有内容_V1(魂灵);
}

function 裁剪更新视图武魂默认字段_V1(武魂 = {}, 武魂槽位 = '') {
  if (!武魂 || typeof 武魂 !== 'object' || Array.isArray(武魂)) return false;
  const 是第二武魂 = String(武魂槽位 || '').trim() === '第2武魂';
  const 武魂主体字段 = ['表象名称', '描述', '系别', '属性体系', '可调用元素'];
  const 武魂参考字段 = {};
  武魂主体字段.forEach(字段 => {
    if (Object.prototype.hasOwnProperty.call(武魂, 字段)) 武魂参考字段[字段] = cloneJsonValue(武魂[字段], 武魂[字段]);
  });
  const 读取武魂主体字段默认值 = 字段 => {
    if (字段 === '表象名称') return 是第二武魂 ? '未展露' : AI_TODO_SPIRIT_NAME;
    if (字段 === '描述') return 是第二武魂 ? '无' : AI_TODO_SPIRIT_DESC;
    if (字段 === '系别') return 武魂系别待补全文案_V1;
    if (字段 === '属性体系') return AI_TODO_ATTRIBUTE_SYSTEM;
    if (字段 === '可调用元素') return [AI_TODO_CALLABLE_ELEMENTS];
    return '';
  };
  const 取武魂主体上下文值 = 字段 => {
    const 值 = 武魂参考字段[字段];
    if (字段 === '属性体系') {
      const 文本 = String(值 ?? '').trim();
      return 文本 && 文本 !== '未知' && !运行时文本需要补全_V1(文本) ? cloneJsonValue(值, 值) : AI_TODO_ATTRIBUTE_SYSTEM;
    }
    if (字段 === '可调用元素') {
      if (Array.isArray(值) && 值.some(项 => String(项 ?? '').trim()) && !更新视图值包含待补文本_V1(值)) return cloneJsonValue(值, []);
      return String(武魂参考字段.属性体系 ?? '').trim() === '无' ? ['无'] : [AI_TODO_CALLABLE_ELEMENTS];
    }
    if (运行时文本需要补全_V1(值) || 正文视图值已初始化_V1(值) || (是第二武魂 && 字段 === '表象名称' && String(值 ?? '').trim() === '未展露')) {
      return cloneJsonValue(值, 值);
    }
    return 读取武魂主体字段默认值(字段);
  };
  const 原属性体系文本 = String(武魂.属性体系 ?? '').trim();
  if (!是第二武魂 && (!原属性体系文本 || 原属性体系文本 === '未知')) 武魂.属性体系 = AI_TODO_ATTRIBUTE_SYSTEM;
  更新视图待补字段_V1(武魂, '表象名称', 是第二武魂 ? '未展露' : AI_TODO_SPIRIT_NAME);
  更新视图待补字段_V1(武魂, '描述', 是第二武魂 ? '无' : AI_TODO_SPIRIT_DESC);
  更新视图待补字段_V1(武魂, '系别', 武魂系别待补全文案_V1);
  更新视图待补字段_V1(武魂, '属性体系', AI_TODO_ATTRIBUTE_SYSTEM);
  if (!更新视图值等于默认值_V1(武魂.可调用元素, [AI_TODO_CALLABLE_ELEMENTS]) && !更新视图值包含待补文本_V1(武魂.可调用元素)) delete 武魂.可调用元素;
  取武魂魂灵条目_V1(武魂).forEach(([魂灵键, 魂灵]) => {
    if (!裁剪更新视图魂灵默认字段_V1(魂灵)) delete 武魂[魂灵键];
  });
  取武魂直接魂环条目_V1(武魂).forEach(([魂环键, 魂环]) => {
    if (!裁剪更新视图魂环默认字段_V1(魂环, { 保留来源: true })) delete 武魂[魂环键];
  });
  const 存在待补子级 = Object.keys(武魂).some(字段 => 是魂灵槽位键_V1(字段) || 是魂环槽位键_V1(字段));
  const 存在待补主体 = 武魂主体字段.some(字段 => 更新视图值包含待补文本_V1(武魂[字段]));
  if (存在待补子级 || 存在待补主体) {
    武魂主体字段.forEach(字段 => {
      武魂[字段] = 取武魂主体上下文值(字段);
    });
  }
  Object.keys(武魂).forEach(字段 => {
    if (
      !武魂主体字段.includes(字段) &&
      !是魂灵槽位键_V1(字段) &&
      !是魂环槽位键_V1(字段)
    ) delete 武魂[字段];
  });
  return 更新视图对象有内容_V1(武魂);
}

function 裁剪更新视图角色默认字段_V1(角色 = {}, 角色名 = '', 数据根 = {}) {
  if (!角色 || typeof 角色 !== 'object' || Array.isArray(角色)) return;
  const 玩家名 = 取运行时玩家名_V1(数据根);
  if (String(角色名 || '').trim() !== 玩家名) delete 角色.临时突破;
  else 更新视图待补字段_V1(角色, '临时突破', 临时突破默认提示词_V1);
  if (角色.属性 && typeof 角色.属性 === 'object' && !Array.isArray(角色.属性)) {
    更新视图待补字段_V1(角色.属性, '年龄', 0);
    更新视图待补字段_V1(角色.属性, '生日', '待生成');
    if (String(角色.属性.性别 ?? '').trim() === '') 角色.属性.性别 = 角色性别待补全文案_V1;
    更新视图待补字段_V1(角色.属性, '性别', 角色性别待补全文案_V1);
    if (!Object.keys(角色.属性).length) delete 角色.属性;
  }
  取角色武魂条目_V1(角色).forEach(([武魂槽位, 武魂]) => {
    if (!裁剪更新视图武魂默认字段_V1(武魂, 武魂槽位)) delete 角色[武魂槽位];
  });
}

function 构建更新视图状态物品薄片_V1(记录 = {}, 字段列表 = []) {
  if (!记录 || typeof 记录 !== 'object' || Array.isArray(记录)) return undefined;
  const 输出 = {};
  字段列表.forEach(字段 => {
    const 忽略列表 = 字段 === '装备状态' ? ['未装备'] : 字段 === '状态' ? ['未装备', 'intact', '完好', '无'] : [];
    if (更新视图字段有运行值_V1(记录[字段], { 忽略文本列表: 忽略列表 })) 输出[字段] = cloneJsonValue(记录[字段], 记录[字段]);
  });
  const 装备技能 = 构建更新视图技能表薄片_V1(记录.装备技能);
  if (装备技能) 输出.装备技能 = 装备技能;
  return Object.keys(输出).length ? 输出 : undefined;
}

function 构建更新视图斗铠薄片_V1(斗铠 = {}) {
  if (!斗铠 || typeof 斗铠 !== 'object' || Array.isArray(斗铠)) return undefined;
  const 输出 = {};
  const 部件输出 = {};
  Object.entries(斗铠.部件 || {}).forEach(([部件名, 部件]) => {
    if (!部件 || typeof 部件 !== 'object' || Array.isArray(部件)) return;
    const 部件薄片 = {};
    ['状态', '耐久', '绑定者'].forEach(字段 => {
      const 忽略列表 = 字段 === '状态' ? ['完好', '未打造', '无'] : [];
      if (更新视图字段有运行值_V1(部件[字段], { 忽略文本列表: 忽略列表 })) 部件薄片[字段] = cloneJsonValue(部件[字段], 部件[字段]);
    });
    if (Object.keys(部件薄片).length) 部件输出[部件名] = 部件薄片;
  });
  if (Object.keys(部件输出).length) 输出.部件 = 部件输出;
  if (更新视图字段有运行值_V1(斗铠.装备状态, { 忽略文本列表: ['未装备'] })) 输出.装备状态 = cloneJsonValue(斗铠.装备状态, 斗铠.装备状态);
  return Object.keys(输出).length ? 输出 : undefined;
}

function 构建更新视图魂导器薄片_V1(魂导器 = {}) {
  const 装配 = 魂导器?.装配 && typeof 魂导器.装配 === 'object' && !Array.isArray(魂导器.装配) ? 魂导器.装配 : {};
  const 输出装配 = {};
  Object.entries(装配).forEach(([槽位, 记录]) => {
    const 薄片 = 构建更新视图状态物品薄片_V1(记录, ['耐久', '剩余使用次数', '绑定者']);
    if (薄片) 输出装配[槽位] = 薄片;
  });
  return Object.keys(输出装配).length ? { 装配: 输出装配 } : undefined;
}

function 构建更新视图装备薄片_V1(装备 = {}) {
  if (!装备 || typeof 装备 !== 'object' || Array.isArray(装备)) return undefined;
  const 输出 = {};
  const 武器 = 构建更新视图状态物品薄片_V1(装备.武器, ['耐久', '剩余使用次数', '绑定者']);
  const 防具 = 构建更新视图状态物品薄片_V1(装备.防具, ['装备状态', '耐久', '绑定者']);
  const 斗铠 = 构建更新视图斗铠薄片_V1(装备.斗铠);
  const 机甲 = 构建更新视图状态物品薄片_V1(装备.机甲, ['状态', '装备状态', '耐久', '绑定者']);
  const 魂导器 = 构建更新视图魂导器薄片_V1(装备.魂导器);
  if (武器) 输出.武器 = 武器;
  if (防具) 输出.防具 = 防具;
  if (斗铠) 输出.斗铠 = 斗铠;
  if (机甲) 输出.机甲 = 机甲;
  if (魂导器) 输出.魂导器 = 魂导器;
  return Object.keys(输出).length ? 输出 : undefined;
}

function 注入运行时简易效果描述_V1(节点 = null, 选项 = {}) {
  if (!节点 || typeof 节点 !== 'object') return;
  if (Array.isArray(节点)) {
    节点.forEach(项 => 注入运行时简易效果描述_V1(项, 选项));
    return;
  }
  const 添加简易描述 = 文本 => {
    const 描述 = String(文本 || '').trim();
    if (描述 && 描述 !== '无') 节点._简易效果描述 = 描述;
  };
  if (Array.isArray(节点._效果数组)) {
    添加简易描述(编译技能结构为人类语言_V1(节点, { 当前tick: 选项.当前tick }));
    delete 节点._效果数组;
  }
  技能执行嵌套效果数组字段表_V1.forEach(字段 => {
    if (!Array.isArray(节点[字段])) return;
    const 描述 = 编译效果数组为人类语言_V1(节点[字段]);
    if (描述 && 描述 !== '无') {
      节点._简易效果描述 = [节点._简易效果描述, 描述].filter(Boolean).join('；');
    }
    delete 节点[字段];
  });
  写入运行时场外冷却文本_V1(节点, 选项.当前tick);
  Object.values(节点).forEach(子节点 => 注入运行时简易效果描述_V1(子节点, 选项));
}

function 读取MVU战斗资源比例文本_V1(单位 = {}, 当前字段 = '', 上限字段 = '') {
  const 属性 = 单位?.属性 && typeof 单位.属性 === 'object' ? 单位.属性 : {};
  const 当前值 = Number(单位?.[当前字段] ?? 属性?.[当前字段]);
  const 上限值 = Number(单位?.[上限字段] ?? 属性?.[上限字段]);
  if (!Number.isFinite(当前值) || !Number.isFinite(上限值) || 上限值 <= 0) return undefined;
  const 比例 = Math.max(0, Math.min(999, Math.round((当前值 / 上限值) * 100)));
  return `${比例}%`;
}

function 读取MVU战斗关键状态_V1(单位 = {}) {
  const 状态集合 = new Set();
  const 收集状态键 = 值 => {
    if (!值 || typeof 值 !== 'object' || Array.isArray(值)) return;
    Object.entries(值).forEach(([键, 状态值]) => {
      if (状态值 === undefined || 状态值 === null || 状态值 === false) return;
      if (typeof 状态值 === 'number' && 状态值 <= 0) return;
      const 名称 = String(键 || '').trim();
      if (名称 && 名称 !== '存活') 状态集合.add(名称);
    });
  };
  收集状态键(单位?.状态效果);
  收集状态键(单位?.状态?.状态效果);
  收集状态键(单位?.属性?.状态效果);
  ['眩晕', '混乱', '封技', '中毒', '灼烧', '冻伤', '虚弱', '护盾', '领域', '蓄力', '隐身', '禁锢'].forEach(键 => {
    const 值 = 单位?.[键] ?? 单位?.状态?.[键];
    if (值 !== undefined && 值 !== null && 值 !== false && !(typeof 值 === 'number' && 值 <= 0)) 状态集合.add(键);
  });
  return Array.from(状态集合).slice(0, 8);
}

function 构建MVU战斗参战者摘要_V1(单位 = {}) {
  if (!单位 || typeof 单位 !== 'object' || Array.isArray(单位)) return null;
  const 属性 = 单位.属性 && typeof 单位.属性 === 'object' ? 单位.属性 : {};
  const 摘要 = {};
  const 名称 = String(单位.名称 || 单位.name || '').trim();
  if (名称) 摘要.名称 = 名称;
  ['势力', '阵营', '单位性质', '身份', '系别'].forEach(字段 => {
    const 值 = String(单位?.[字段] ?? 属性?.[字段] ?? '').trim();
    if (值) 摘要[字段] = 值;
  });
  const 等级 = Number(单位.等级 ?? 属性.等级);
  if (Number.isFinite(等级) && 等级 > 0) 摘要.等级 = Math.round(等级);
  const 存活候选 = 单位.存活 !== undefined ? 单位.存活 : 单位?.状态?.存活;
  if (存活候选 !== undefined) 摘要.存活 = 存活候选 !== false;
  [
    ['HP比例', 'HP', 'HP上限'],
    ['魂力比例', '魂力', '魂力上限'],
    ['精神力比例', '精神力', '精神力上限'],
    ['体力比例', '体力', '体力上限'],
  ].forEach(([输出字段, 当前字段, 上限字段]) => {
    const 比例 = 读取MVU战斗资源比例文本_V1(单位, 当前字段, 上限字段);
    if (比例) 摘要[输出字段] = 比例;
  });
  const 关键状态 = 读取MVU战斗关键状态_V1(单位);
  if (关键状态.length) 摘要.关键状态 = 关键状态;
  const 压制 = 单位.实力压制 && typeof 单位.实力压制 === 'object' ? 单位.实力压制 : null;
  if (压制) {
    const 等级文本 = 压制.原始等级 !== undefined && 压制.压制等级 !== undefined
      ? `Lv.${压制.原始等级}->Lv.${压制.压制等级}`
      : '';
    const 说明 = String(压制.说明 || '').trim();
    摘要.实力压制摘要 = [等级文本, 说明].filter(Boolean).join('；');
  }
  return Object.keys(摘要).length ? 摘要 : null;
}

function 构建MVU战斗摘要_V1(战斗数据 = null) {
  if (!战斗数据 || typeof 战斗数据 !== 'object' || 战斗数据.进行中 !== true) return {};
  const 摘要 = { 进行中: true };
  ['战斗类型', '回合', '战斗意图', '环境', '先攻', '允许撤离'].forEach(字段 => {
    if (战斗数据[字段] !== undefined && 战斗数据[字段] !== null && String(战斗数据[字段]).trim() !== '') 摘要[字段] = 战斗数据[字段];
  });
  if (String(战斗数据.裁断结果 || '').trim()) 摘要.裁断结果 = String(战斗数据.裁断结果).trim();
  const 参战者 = 战斗数据.参战者 && typeof 战斗数据.参战者 === 'object' ? 战斗数据.参战者 : {};
  const 参战者摘要 = {};
  ['team_player', 'team_enemy'].forEach(队伍字段 => {
    const 队伍 = Array.isArray(参战者[队伍字段]) ? 参战者[队伍字段].map(构建MVU战斗参战者摘要_V1).filter(Boolean) : [];
    if (队伍.length) 参战者摘要[队伍字段] = 队伍;
  });
  if (Object.keys(参战者摘要).length) 摘要.参战者 = 参战者摘要;
  return 摘要;
}

function 构建MVU正文角色属性薄片_V1(角色 = {}) {
  const 属性 = 角色?.属性 && typeof 角色.属性 === 'object' ? 角色.属性 : {};
  const 输出 = {};
  ['年龄', '生日', '性别', '等级', '邪魂师', '精神境界'].forEach(字段 => {
    if (正文视图值已初始化_V1(属性[字段])) 输出[字段] = 属性[字段];
  });
  ['魂力', '魂力上限', '精神力', '精神力上限', 'HP', 'HP上限', '体力', '体力上限'].forEach(字段 => {
    const 数值 = Number(属性[字段]);
    if (Number.isFinite(数值)) 输出[字段] = 属性[字段];
  });
  return 输出;
}

function 构建MVU正文角色状态薄片_V1(角色 = {}) {
  const 状态 = 角色?.状态 && typeof 角色.状态 === 'object' ? 角色.状态 : {};
  const 输出 = {};
  if (正文视图值已初始化_V1(状态.位置)) 输出.位置 = 状态.位置;
  if (状态.存活 === false) 输出.存活 = false;
  if (正文视图值已初始化_V1(状态.死亡类型) && 状态.死亡类型 !== '无') 输出.死亡类型 = 状态.死亡类型;
  if (状态.受伤部位 && typeof 状态.受伤部位 === 'object' && Object.keys(状态.受伤部位).length) 输出.受伤部位 = 状态.受伤部位;
  Object.entries(状态).forEach(([字段, 值]) => {
    if (['位置', '横坐标', '纵坐标', '存活', '死亡tick', '死亡类型', '受伤部位', '吸收灵物年限'].includes(字段)) return;
    if (正文视图值已初始化_V1(值)) 输出[字段] = 值;
  });
  return 输出;
}

function 构建MVU正文角色薄片_V1(原角色 = {}, 当前tick = null) {
  const 清理后 = 过滤MVU正文视图值_V1(cloneJsonValue(原角色, null), ['char', '示例角色']);
  if (!清理后) return null;
  delete 清理后.属性;
  delete 清理后.状态;
  delete 清理后.__mvu_isPlayer;
  delete 清理后.__mvu_显式天赋梯队;
  const 属性薄片 = 构建MVU正文角色属性薄片_V1(原角色);
  if (属性薄片 && Object.keys(属性薄片).length) 清理后.属性 = 属性薄片;
  const 状态薄片 = 构建MVU正文角色状态薄片_V1(原角色);
  if (状态薄片 && Object.keys(状态薄片).length) 清理后.状态 = 状态薄片;
  删除正文视图机制字段_V1(清理后, 当前tick);
  return Object.keys(清理后).length ? 清理后 : null;
}

function 构建赛事权限正文薄片_V1(数据根 = {}, 文本 = '') {
  const 运行时 = 读取赛事权限运行时_V1();
  const 玩家名 = 取运行时玩家名_V1(数据根);
  const 当前tick = Number(数据根?.world?.时间?.tick || 0);
  const 权限 = {};
  (运行时?.列出持有人权限?.(数据根, 玩家名, 当前tick) || []).forEach(({ 权限ID, 记录 }) => {
      权限[记录.名称 || `权限${权限ID}`] = {
      名称: 记录.名称,
      类型: 记录.权限?.类型,
      效果: cloneJsonValue(记录.权限, {}),
      ...(记录.使用配额 ? {
        可用状态: 记录.使用配额.剩余 > 0 ? '可用' : '等待重置',
        剩余次数: 记录.使用配额.剩余,
      } : {}),
      ...(记录.到期tick !== undefined ? { 有效期: 格式化赛事权限剩余时间_V1(Number(记录.到期tick) - 当前tick) } : {}),
    };
  });
  const 赛事 = {};
  Object.entries(数据根?.world?.赛事 || {}).forEach(([赛事ID, 记录]) => {
    if (!记录 || 记录.状态 === '已完成') return;
    const 玩家项目条目 = Object.entries(记录.项目 || {}).find(([, 项目]) =>
      Object.values(项目?.参赛者 || {}).some(参赛者 => 参赛者?.名称 === 玩家名 ||参赛者?.成员?.includes(玩家名)),
    );
    const 玩家项目 = 玩家项目条目?.[0];
    const 相关 = 玩家项目 || String(文本 || '').includes(String(记录.名称 || '')) || 记录.状态 === '进行中';
    if (!相关) return;
    const 项目摘要 = {};
    Object.entries(记录.项目 || {}).forEach(([项目名, 项目]) => {
      const 进度 = 记录._进度?.[项目名];
      if (!进度) return;
      const 玩家参赛者ID = Object.entries(项目?.参赛者 || {}).find(([, 参赛者]) =>
        参赛者?.名称 === 玩家名 ||参赛者?.成员?.includes(玩家名),
      )?.[0];
      const 下一场 = Object.entries(进度.对局 || {}).find(([, 对局]) =>
        !运行时?.对局已完成?.(对局) && (!玩家参赛者ID || 对局.参赛者?.includes(玩家参赛者ID)),
      );
      const 显示名 = ID => 进度.实体?.[ID]?.名称 || '待实体化参赛者';
      const 排名摘要 = 运行时?.生成循环积分表?.(记录, 项目名) || {};
      项目摘要[项目名] = {
        流程: 项目.流程,
        状态: 进度.状态 || '未开始',
        参赛总数: 项目.参赛总数,
        ...(下一场 ? { 下一场: 下一场[1].参赛者.map(显示名) } : {}),
        ...(项目.流程 === '循环' || 项目.流程 === '循环后淘汰' ? {
          积分榜: Object.fromEntries(Object.entries(排名摘要).map(([分组, 排名]) => [
            分组,
            排名.slice(0, 8).map(({ 名称, 场次, 胜, 平, 负, 积分, 净胜分, 排名: 名次 }) => ({
              名称, 场次, 胜, 平, 负, 积分, 净胜分, 排名: 名次,
            })),
          ])),
        } : {}),
      };
    });
    const 摘要 = {
      名称: 记录.名称,
      状态: 记录.状态,
      开始时间: 格式化赛事权限剩余时间_V1(Number(记录.日程?.开始tick || 0) - 当前tick),
      项目: 项目摘要,
    };
    赛事[记录.名称] = 摘要;
  });
  return { 权限, 赛事 };
}

function 构建赛事权限更新投影_V1(数据根 = {}, 文本 = '') {
  const 玩家名 = 取运行时玩家名_V1(数据根);
  const 权限 = {};
  Object.entries(数据根?.world?.特殊权限 || {}).forEach(([权限ID, 记录]) => {
    if (!记录 || (记录.持有人 !== 玩家名 && !String(文本 || '').includes(String(记录.名称 || '')))) return;
    权限[记录.名称 || `权限${权限ID}`] = {
      名称: 记录.名称,
      持有人: 记录.持有人,
      权限: cloneJsonValue(记录.权限, {}),
      ...(记录.使用配额?.上限 !== undefined ? { 使用次数: 记录.使用配额.上限 } : {}),
      ...(记录.使用配额?.重置周期 ? { 重置周期: 记录.使用配额.重置周期 } : {}),
      ...(记录.到期tick !== undefined ? { 有效期: 格式化赛事权限剩余时间_V1(Number(记录.到期tick) - Number(数据根?.world?.时间?.tick || 0)) } : {}),
    };
  });
  const 赛事 = {};
  Object.entries(dataRootOrEmptyForCompetitionView_V1(数据根?.world?.赛事)).forEach(([, 记录]) => {
    if (!记录 || 记录.状态 === '已完成') return;
    if (记录.状态 !== '筹备' && !String(文本 || '').includes(String(记录.名称 || ''))) return;
    const 项目 = {};
    Object.entries(记录.项目 || {}).forEach(([项目名, 项目记录]) => {
      项目[项目名] = {
        流程: 项目记录.流程,
        参赛总数: 项目记录.参赛总数,
        ...(项目记录.参赛限制 ? { 参赛限制: cloneJsonValue(项目记录.参赛限制, {}) } : {}),
        ...(记录.状态 === '筹备' ? {
          参赛者: Object.values(项目记录.参赛者 || {}).map(参赛者 => cloneJsonValue(参赛者, {})),
        } : {}),
      };
    });
    赛事[记录.名称] = {
      名称: 记录.名称,
      开始时间: 格式化赛事权限剩余时间_V1(Number(记录.日程?.开始tick || 0) - Number(数据根?.world?.时间?.tick || 0)),
      总时长: 格式化赛事权限剩余时间_V1(Number(记录.日程?.结束tick || 0) - Number(记录.日程?.开始tick || 0)),
      项目,
    };
  });
  return { 权限, 赛事 };
}

function 格式化赛事权限剩余时间_V1(剩余tick = 0) {
  const tick = Math.max(0, Number(剩余tick || 0));
  if (tick >= 51840) return `${Number((tick / 51840).toFixed(1))}年`;
  if (tick >= 4320) return `${Number((tick / 4320).toFixed(1))}个月`;
  if (tick >= 144) return `${Number((tick / 144).toFixed(1))}天`;
  return `${Math.floor(tick)}tick`;
}

function dataRootOrEmptyForCompetitionView_V1(值) {
  return 值 && typeof 值 === 'object' && !Array.isArray(值) ? 值 : {};
}

function 构建场景赛事权限钩子_V1(数据根 = {}, 当前地点 = '', 文本 = '') {
  数据根 = 整理赛事权限视图根_V1(数据根);
  const 运行时 = 读取赛事权限运行时_V1();
  const 玩家名 = 取运行时玩家名_V1(数据根);
  const 可用权限 = [];
  const 当前tick = Number(数据根?.world?.时间?.tick || 0);
  (运行时?.列出持有人权限?.(数据根, 玩家名) || []).forEach(({ 记录 }) => {
    const 权限 = 记录.权限 || {};
    if (权限.类型 === '资格' || (权限.类型 === '折扣' && (!权限.地点 || 权限.地点 === 当前地点))) {
      可用权限.push({
        名称: 记录.名称,
        权限: cloneJsonValue(权限, {}),
        可用状态: 记录.使用配额?.剩余 === 0 ? '等待重置' : '可用',
        ...(记录.使用配额 ? { 剩余次数: 记录.使用配额.剩余 } : {}),
        ...(记录.到期tick !== undefined ? { 有效期: 格式化赛事权限剩余时间_V1(Number(记录.到期tick) - 当前tick) } : {}),
        ...(记录.使用配额 &&
          typeof 记录.使用配额 === 'object' &&
          !Array.isArray(记录.使用配额) &&
          记录.使用配额.下次重置tick !== undefined &&
          记录.使用配额.剩余 <= 0
          ? { 下次可用: 格式化赛事权限剩余时间_V1(Number(记录.使用配额.下次重置tick) - 当前tick) }
          : {}),
      });
    }
  });
  const 赛事 = Object.entries(数据根?.world?.赛事 || {})
    .filter(([, 记录]) => 记录?.状态 !== '已完成')
    .filter(([, 记录]) => 记录?.状态 === '进行中' || String(文本 || '').includes(String(记录?.名称 || '')))
    .map(([, 记录]) => ({
      名称: 记录.名称,
      状态: 记录.状态,
      开始时间: 格式化赛事权限剩余时间_V1(Number(记录.日程?.开始tick || 0) - Number(数据根?.world?.时间?.tick || 0)),
      项目: Object.fromEntries(Object.entries(记录.项目 || {}).map(([项目名, 项目]) => [
        项目名,
        {
          流程: 项目.流程,
          参赛总数: 项目.参赛总数,
          ...(项目.参赛限制 ? { 参赛限制: cloneJsonValue(项目.参赛限制, {}) } : {}),
          ...(记录._进度?.[项目名] ? {
            当前环节: 记录._进度[项目名].当前环节,
            当前轮次: 记录._进度[项目名].当前轮次,
          } : {}),
        },
      ])),
    }));
  return { 可用权限, 赛事 };
}

function 生成MVU正文视图_V1(数据输入 = null, userInput = '', plotText = '') {
  const 数据根 = 整理赛事权限视图根_V1(读取运行时Mvu数据根或最新_V1(数据输入) || {});
  const 文本 = [userInput, 读取运行时最后角色消息文本_V1()].map(文本 => String(文本 || '').trim()).filter(Boolean).join('\n');
  const 当前tick = Number(数据根?.world?.时间?.tick || 0);
  const 运行时命中上下文 = 构建运行时命中上下文_V1(数据根, 文本);
  const 时间线视图 = 构建运行时未来事件视图_V1(数据根?.world?.时间线 || {}, 8, { 派生时间文本: true, 当前tick });
  const 角色名集合 = 取运行时基础角色名集合_V1(数据根, 文本, { 运行时命中名称: 运行时命中上下文.运行时命中名称 });
  const 物品候选上下文 = 构建运行时物品候选上下文_V1(数据根, 文本, { 角色名集合 });
  const 地点名集合 = 取运行时地点名集合_V1(数据根, 文本, { 运行时命中名称: 运行时命中上下文.运行时命中名称 });
  const 动态地点名集合 = 取运行时动态地点名集合_V1(数据根, 文本);
  const 物品名集合 = 收集运行时相关物品名_V1(数据根, 文本, 角色名集合, {
    运行时命中名称: 运行时命中上下文.运行时命中名称,
    ...物品候选上下文,
  });
  const 已发送角色名集合 = new Set();
  const 已发送动态地点名集合 = new Set();
  const 已发送物品名集合 = new Set();
  const 情报可见度 = 构建运行时情报可见度索引_V1(数据根, 角色名集合);
  const 机密情报视图 = 复制运行时命中记录表片段_V1(数据根?.world?.机密情报 || {}, 文本, 8, 构建正文机密情报条目_V1);
  const 战斗摘要 = 构建MVU战斗摘要_V1(数据根?.world?.战斗);
  const 赛事权限薄片 = 构建赛事权限正文薄片_V1(数据根, 文本);
  const 视图 = {
    sys: 过滤MVU正文视图值_V1({ 世界线日志: 数据根?.sys?.系统播报 }, ['sys']) || {},
    world: 过滤MVU正文视图值_V1({
      时间: {
        tick: Number(数据根?.world?.时间?.tick || 0),
      },
      时间线: 运行时对象有内容_V1(时间线视图) ? 时间线视图 : undefined,
      机密情报: 运行时对象有内容_V1(机密情报视图) ? 机密情报视图 : undefined,
      战斗: 运行时对象有内容_V1(战斗摘要) ? 战斗摘要 : undefined,
      特殊权限: 运行时对象有内容_V1(赛事权限薄片.权限) ? 赛事权限薄片.权限 : undefined,
      赛事: 运行时对象有内容_V1(赛事权限薄片.赛事) ? 赛事权限薄片.赛事 : undefined,
      地点: {},
      动态地点: {},
    }, ['world']) || {},
    char: {},
    物品: {},
  };
  if (运行时对象有内容_V1(战斗摘要)) 视图.world.战斗 = 战斗摘要;
  地点名集合.forEach(地点名 => {
    const 地图条目 = findMapNodeEntry(地点名, 数据根);
    const 地点 = 地图条目?.node;
    const 地点基础 = cloneJsonValue(地点, {});
    if (地点基础 && typeof 地点基础 === 'object') delete 地点基础.商店;
    const 清理后 = 过滤MVU正文视图值_V1(准备运行时地图视图数据_V1(地点基础, '', { 隐藏默认状态: true }), ['world', '地点', '示例地点']);
    const 商店摘要 = 构建正文商店库存摘要_V1(地点, 数据根, 文本, {
      已发送物品: 已发送物品名集合,
      优先物品: 物品名集合,
      库存物品上限: 16,
      运行时命中名称: 运行时命中上下文.运行时命中名称,
      ...物品候选上下文,
    });
    if (清理后 && 商店摘要) 清理后.商店 = 商店摘要;
    if (清理后) {
      if (!视图.world.地点) 视图.world.地点 = {};
      写入运行时地点树薄片_V1(视图.world.地点, 地图条目, 清理后);
    }
  });
  动态地点名集合.forEach(地点名 => {
    const 地点 = 数据根?.world?.动态地点?.[地点名];
    const 清理后 = 过滤MVU正文视图值_V1(准备运行时地图视图数据_V1(cloneJsonValue(地点, {}), '', { 隐藏默认状态: true }), ['world', '动态地点', '示例动态地点']);
    if (清理后) {
      if (!视图.world.动态地点) 视图.world.动态地点 = {};
      视图.world.动态地点[地点名] = 清理后;
      已发送动态地点名集合.add(地点名);
    }
  });
  角色名集合.forEach(角色名 => {
    const 原角色 = 数据根?.char?.[角色名];
    const 清理后 = 构建MVU正文角色薄片_V1(原角色, 当前tick);
    if (清理后) {
      视图.char[角色名] = 清理后;
      已发送角色名集合.add(角色名);
    }
  });
  物品名集合.forEach(物品名 => {
    const 摘要 = 构建运行时物品摘要_V1(查找运行时物品定义_V1(数据根, 物品名)?.定义 || {});
    if (摘要 && Object.keys(摘要).length) {
      视图.物品[物品名] = 摘要;
      已发送物品名集合.add(物品名);
    }
  });
  if (Object.keys(情报可见度 || {}).length) 视图.情报可见度 = 情报可见度;
  记录运行时冷实体发送_V1({ 角色: 已发送角色名集合, 动态地点: 已发送动态地点名集合, 物品: 已发送物品名集合 });
  return cloneJsonValue(视图, {}) || {};
}

function 生成MVU更新视图_V1(数据输入 = null, userInput = '', 最后一条角色消息 = '', plotText = '', 选项 = {}) {
  const 原始数据根 = 整理赛事权限视图根_V1(读取运行时Mvu数据根或最新_V1(数据输入) || {});
  const 最后角色消息文本 = String(最后一条角色消息 || '').trim() || 读取运行时最后角色消息文本_V1();
  const 文本 = [userInput, 最后角色消息文本].map(文本 => String(文本 || '').trim()).filter(Boolean).join('\n');
  const 草稿上下文 = 构建更新前运行时草稿_V1(原始数据根, 文本, 选项);
  const 数据根 = 草稿上下文.数据根;
  const 当前tick = Number(数据根?.world?.时间?.tick || 0);
  const 运行时命中上下文 = 构建运行时命中上下文_V1(数据根, 文本, 选项);
  const 运行时提示限流 = 创建运行时提示限流器_V1(选项.运行时提示已使用类型);
  const 注入数据根 = { ...数据根, __运行时提示限流__: 运行时提示限流 };
  const 角色名集合 = 选项.角色名集合 instanceof Set
    ? new Set([取运行时当前范围_V1(数据根).玩家名].filter(Boolean).concat(Array.from(选项.角色名集合)))
    : 取运行时基础角色名集合_V1(数据根, 文本, { 运行时命中名称: 运行时命中上下文.运行时命中名称 });
  (Array.isArray(草稿上下文.命中角色) ? 草稿上下文.命中角色 : []).forEach(角色名 => {
    if (数据根?.char?.[角色名]) 角色名集合.add(角色名);
  });
  const 物品候选上下文 = 构建运行时物品候选上下文_V1(数据根, 文本, { ...选项, 角色名集合 });
  const 地点名集合 = 取运行时地点名集合_V1(数据根, 文本, { 运行时命中名称: 运行时命中上下文.运行时命中名称 });
  const 动态地点名集合 = 取运行时动态地点名集合_V1(数据根, 文本);
  const 命中 = 运行时命中上下文.运行时命中名称;
  const 已发送角色名集合 = new Set();
  const 已发送动态地点名集合 = new Set();
  const 已发送物品名集合 = new Set();
  const 魂骨命中 = /魂骨|头骨|颅骨|躯干骨|臂骨|腿骨|外附|千年|万年|十万年|百万年/.test(文本);
  const 战斗进行中 = !!数据根?.world?.战斗?.进行中;
  const 战斗中无关字段_V1 = ['性格', '社交', '外貌', '副职业', '背包', '我的任务', '捐献请求'];
  const 势力名集合 = new Set([...命中.势力]);
  角色名集合.forEach(角色名 => {
    Object.keys(数据根?.char?.[角色名]?.社交?.势力 || {}).forEach(势力名 => 势力名集合.add(势力名));
  });
  const 物品名集合 = 收集运行时相关物品名_V1(数据根, 文本, 角色名集合, {
    运行时命中名称: 命中,
    ...物品候选上下文,
  });
  const 拍卖视图 = 构建运行时拍卖薄片_V1(数据根?.world?.拍卖 || {}, 文本, 8);
  const 委托板视图 = 复制运行时命中记录表片段_V1(数据根?.world?.委托板 || {}, 文本, 8, 构建运行时委托草案条目_V1);
  const 图鉴视图 = 复制运行时命中记录表片段_V1(数据根?.world?.图鉴 || {}, 文本, 8, 构建运行时图鉴摘要条目_V1);
  const 时间线视图 = 构建运行时未来事件视图_V1(数据根?.world?.时间线 || {}, 8);
  const 战斗摘要 = 构建MVU战斗摘要_V1(数据根?.world?.战斗);
  const 赛事权限投影 = 构建赛事权限更新投影_V1(数据根, 文本);
  const 视图 = {
    world: {
      时间: {
        tick: Number(数据根?.world?.时间?.tick || 0),
      },
      时间线: 时间线视图,
      拍卖: 拍卖视图,
      委托板: 委托板视图,
      图鉴: 图鉴视图,
      战斗: 战斗摘要,
      特殊权限: 赛事权限投影.权限,
      赛事: 赛事权限投影.赛事,
      地点: {},
      动态地点: {},
    },
    org: {},
    char: {},
    物品: {},
  };
  地点名集合.forEach(地点名 => {
    const 地图条目 = findMapNodeEntry(地点名, 数据根);
    if (地图条目?.node) 写入运行时地点树薄片_V1(视图.world.地点, 地图条目, 构建更新地点薄片_V1(地图条目.node, 文本));
  });
  动态地点名集合.forEach(地点名 => {
    if (数据根?.world?.动态地点?.[地点名]) {
      视图.world.动态地点[地点名] = 构建更新动态地点条目_V1(数据根.world.动态地点[地点名], 地点名);
      已发送动态地点名集合.add(地点名);
    }
  });
  按玩家优先排序名称_V1(角色名集合, 取运行时玩家名_V1(数据根)).forEach(角色名 => {
    const 角色 = cloneJsonValue(数据根?.char?.[角色名], null);
    if (!角色 || typeof 角色 !== 'object') return;
    injectRuntimeCharacterTodoDefaults_V1(角色, 角色名, 数据根?.char?.[角色名], 注入数据根);
    注入运行时简易效果描述_V1(角色, { 当前tick });
    收口更新视图角色技能_V1(角色);
    清理运行时已补全技能效果数组_V1(角色);
    裁剪更新视图角色默认字段_V1(角色, 角色名, 数据根);
    const 过滤后角色 = 过滤MVU更新视图值_V1(角色, ['char', '示例角色']) || {};
    const 装备薄片 = 构建更新视图装备薄片_V1(角色.装备);
    if (装备薄片) 过滤后角色.装备 = 装备薄片;
    else delete 过滤后角色.装备;
    if (Object.keys(过滤后角色).length) {
      if (!魂骨命中 && 过滤后角色.魂骨) delete 过滤后角色.魂骨;
      if (战斗进行中) {
        战斗中无关字段_V1.forEach(字段 => { if (字段 in 过滤后角色) delete 过滤后角色[字段]; });
        if (过滤后角色.属性 && typeof 过滤后角色.属性 === 'object') delete 过滤后角色.属性.背景;
      }
      if (Object.keys(过滤后角色).length) {
        视图.char[角色名] = 过滤后角色;
        已发送角色名集合.add(角色名);
      }
    }
    Object.keys(角色?.社交?.势力 || {}).forEach(势力名 => 势力名集合.add(势力名));
  });
  势力名集合.forEach(势力名 => {
    if (数据根?.org?.[势力名]) {
      const 过滤后势力 = 过滤MVU更新视图值_V1(cloneJsonValue(数据根.org[势力名], {}), ['org', '示例势力']);
      if (过滤后势力) 视图.org[势力名] = 过滤后势力;
    }
  });
  物品名集合.forEach(物品名 => {
    const 定义 = cloneJsonValue(查找运行时物品定义_V1(数据根, 物品名)?.定义, null);
    if (定义 && typeof 定义 === 'object') {
      注入运行时简易效果描述_V1(定义, { 当前tick });
      const 过滤后物品 = 为运行时物品定义注入提示_V1(定义);
      if (过滤后物品) {
        视图.物品[物品名] = 过滤后物品;
        已发送物品名集合.add(物品名);
      }
    }
  });
  视图.world = 过滤MVU更新视图值_V1(视图.world, ['world']) || {};
  if (运行时对象有内容_V1(战斗摘要)) 视图.world.战斗 = 战斗摘要;
  const 更新视图结构字段 = 战斗进行中
    ? [['战斗', 战斗摘要]]
    : [
    ['时间线', 时间线视图],
    ['委托板', 委托板视图],
    ['战斗', 战斗摘要],
    ['地点', 视图.world.地点 || {}],
    ['动态地点', 视图.world.动态地点 || {}],
  ];
  更新视图结构字段.forEach(([字段, 值]) => {
    if (视图.world[字段] === undefined) 视图.world[字段] = cloneJsonValue(值, {});
    if (
      !战斗进行中 &&
      视图.world[字段] &&
      typeof 视图.world[字段] === 'object' &&
      !Array.isArray(视图.world[字段]) &&
      !Object.keys(视图.world[字段]).length
    ) {
      视图.world[字段] = 构建更新视图标准结构样例_V1(字段);
    }
  });
  Object.keys(视图.world).forEach(键 => {
    if (视图.world[键] === undefined) delete 视图.world[键];
  });
  const 输出视图 = 投影运行时本轮模块结算只读字段_V1(视图, 读取运行时本轮模块结算只读路径_V1());
  记录运行时冷实体发送_V1({ 角色: 已发送角色名集合, 动态地点: 已发送动态地点名集合, 物品: 已发送物品名集合 });
  return 输出视图;
}

function 生成MVU剧情视图_V1(数据输入 = null, userInput = '', 最后剧情文本 = '') {
  const 数据根 = 读取运行时Mvu数据根或最新_V1(数据输入) || {};
  const { 玩家名, 当前地点 } = 取运行时当前范围_V1(数据根);
  const 文本 = String(userInput || '');
  const 当前tick = Number(数据根?.world?.时间?.tick || 0);
  const 战斗摘要 = 构建MVU战斗摘要_V1(数据根?.world?.战斗);
  const 委托摘要 = 复制运行时命中记录表片段_V1(数据根?.world?.委托板 || {}, 文本, 6, 构建运行时委托草案条目_V1);
  const 内置角色摘要 = 构建内置角色命中摘要_V1(数据根, 文本);
  const 角色简表 = 构建MVU剧情角色简表_V1(数据根, userInput, 最后剧情文本);
  const 地点候选 = 构建运行时地点候选_V1(数据根, userInput, 最后剧情文本);
  const 剧情视图 = {
    当前: {
      时间: {
        当前: 数据根?.world?.时间?._calendar || '',
      },
      地点: 当前地点,
      玩家: 玩家名,
      玩家行动: userInput || '',
      世界线日志: 数据根?.sys?.系统播报 || '',
    },
    角色简表,
    剧情钩子: {
      _引导: {
        时间线预览: 构建运行时原著时间线预览文本_V1(当前tick, 20),
        远端原著时间线候选: 构建远端原著时间线候选文本_V1(数据根, userInput, 20),
      },
      时间线: 构建运行时未来事件视图_V1(数据根?.world?.时间线 || {}, 8, { 派生时间文本: true, 当前tick }),
      委托板: 委托摘要,
      拍卖: 构建运行时拍卖薄片_V1(数据根?.world?.拍卖 || {}, 文本, 4),
      战斗: 战斗摘要,
      地点候选,
      内置角色档案命中: 内置角色摘要.length ? 内置角色摘要 : undefined,
      赛事与权限: 构建场景赛事权限钩子_V1(数据根, 当前地点, 文本),
    },
  };
  return 过滤MVU剧情视图值_V1(剧情视图);
}

function 过滤MVU剧情视图值_V1(剧情视图 = {}) {
  const 清理后 = 过滤MVU运行时视图值_V1(剧情视图, [], {
    排除路径列表: [],
    正文模式: true,
  }) || {};
  const 剧情钩子 = 清理后.剧情钩子 && typeof 清理后.剧情钩子 === 'object' && !Array.isArray(清理后.剧情钩子)
    ? 清理后.剧情钩子
    : {};
  return {
    当前: 清理后.当前 && typeof 清理后.当前 === 'object' && !Array.isArray(清理后.当前) ? 清理后.当前 : {},
    角色简表: Array.isArray(清理后.角色简表) ? 清理后.角色简表 : [],
    剧情钩子: {
      ...剧情钩子,
      _引导: 剧情钩子._引导 && typeof 剧情钩子._引导 === 'object' && !Array.isArray(剧情钩子._引导) ? 剧情钩子._引导 : {},
    },
  };
}

function 格式化MVU剧情提示单元_V1(值 = '') {
  return 转换运行时文本tick显示_V1(String(值 ?? '').replace(/\s+/g, ' ').replace(/\|/g, '/').trim());
}

function 格式化MVU剧情提示原子值_V1(值, 选项 = {}) {
  if (值 === undefined || 值 === null) return '';
  if (typeof 值 === 'string') {
    const 文本 = 值.trim();
    return 正文视图值已初始化_V1(文本) ? 转换运行时文本tick显示_V1(文本) : '';
  }
  if (typeof 值 === 'number') {
    const 数值 = Number(值);
    if (!Number.isFinite(数值)) return '';
    if (数值 === 0 && 选项.允许零 !== true) return '';
    return String(数值);
  }
  if (typeof 值 === 'boolean') return 值 ? '是' : '';
  return '';
}

function 格式化MVU剧情提示值_V1(值, 选项 = {}) {
  if (Array.isArray(值)) {
    return 值
      .map(项 => (项 && typeof 项 === 'object' ? 格式化MVU剧情提示对象片段_V1(项, 选项.最大字段数 || 4) : 格式化MVU剧情提示原子值_V1(项, 选项)))
      .filter(Boolean)
      .join('、');
  }
  if (值 && typeof 值 === 'object') return 格式化MVU剧情提示对象片段_V1(值, 选项.最大字段数 || 5);
  return 格式化MVU剧情提示原子值_V1(值, 选项);
}

function 格式化MVU剧情提示对象片段_V1(对象 = {}, 最大字段数 = 5) {
  const 片段列表 = [];
  Object.entries(对象 || {}).forEach(([字段, 值]) => {
    if (片段列表.length >= 最大字段数) return;
    if (字段 === '生理期偏移') return;
    const 文本 = 格式化MVU剧情提示值_V1(值);
    if (文本) 片段列表.push(`${格式化运行时显示字段名_V1(字段)}:${文本}`);
  });
  return 片段列表.join('，');
}

function 格式化MVU剧情提示记录表_V1(记录表 = {}, 最大条目数 = 4, 最大字段数 = 5) {
  if (!记录表 || typeof 记录表 !== 'object' || Array.isArray(记录表)) return '';
  const 行列表 = [];
  Object.entries(记录表).forEach(([键, 值]) => {
    if (行列表.length >= 最大条目数) return;
    const 内容 = 值 && typeof 值 === 'object'
      ? 格式化MVU剧情提示对象片段_V1(值, 最大字段数)
      : 格式化MVU剧情提示原子值_V1(值);
    if (内容) 行列表.push(`${键}(${内容})`);
  });
  return 行列表.join('；');
}

function 追加MVU剧情提示片段_V1(片段列表 = [], 标签 = '', 值 = '', 选项 = {}) {
  const 文本 = 格式化MVU剧情提示值_V1(值, 选项);
  if (文本) 片段列表.push(`${标签}:${文本}`);
}

function 取运行时剧情提示角色名集合_V1(数据根 = {}, userInput = '', 最后剧情文本 = '') {
  const { 玩家名 } = 取运行时当前范围_V1(数据根);
  const 角色名集合 = new Set();
  if (玩家名 && 数据根?.char?.[玩家名]) 角色名集合.add(玩家名);
  收集运行时命中名称_V1(数据根, [userInput, 最后剧情文本].filter(Boolean).join('\n')).角色.forEach(角色名 => {
    if (!数据根?.char?.[角色名] || 角色名集合.has(角色名)) return;
    角色名集合.add(角色名);
  });
  return 角色名集合;
}

function 格式化MVU剧情提示当前时间_V1(时间 = {}) {
  const 片段列表 = [];
  const 日历 = 格式化MVU剧情提示原子值_V1(时间?._calendar || 时间?.当前 || '');
  if (日历) 片段列表.push(日历);
  const tick = 格式化MVU剧情提示原子值_V1(Number(时间?.tick || 0));
  if (tick) 片段列表.push(`tick:${tick}`);
  return 片段列表.join('，');
}

function 格式化MVU剩余资源数值_V1(数值 = 0) {
  const 安全数值 = Math.max(0, Math.floor(Number(数值) || 0));
  const 格式化 = (除数, 单位) => {
    const 显示值 = 安全数值 / 除数;
    return `${显示值.toFixed(1).replace(/\.0$/, '')}${单位}`;
  };
  if (安全数值 >= 100000000) return 格式化(100000000, '亿');
  if (安全数值 >= 10000) return 格式化(10000, '万');
  return String(安全数值);
}

function 构建MVU剩余资源摘要_V1(角色 = {}) {
  const 属性 = 角色?.属性 && typeof 角色.属性 === 'object' ? 角色.属性 : {};
  const 构建百分比资源 = (标签, 当前字段, 上限字段) => {
    const 当前 = Number(属性?.[当前字段]);
    const 上限 = Number(属性?.[上限字段]);
    if (!Number.isFinite(当前) || !Number.isFinite(上限) || 上限 <= 0) return '';
    const 百分比 = Math.max(0, Math.min(999, Math.round((Math.max(0, Math.min(当前, 上限)) / 上限) * 100)));
    return `${标签} ${百分比}%`;
  };
  const 构建绝对资源 = (标签, 当前字段, 上限字段) => {
    const 当前 = Number(属性?.[当前字段]);
    const 上限 = Number(属性?.[上限字段]);
    if (!Number.isFinite(当前) || !Number.isFinite(上限) || 上限 <= 0) return '';
    const 安全当前 = Math.max(0, Math.min(当前, 上限));
    const 百分比 = Math.max(0, Math.min(999, Math.round((安全当前 / 上限) * 100)));
    return `${标签} ${格式化MVU剩余资源数值_V1(安全当前)}/${格式化MVU剩余资源数值_V1(上限)}(${百分比}%)`;
  };
  return [
    构建百分比资源('血量', 'HP', 'HP上限'),
    构建绝对资源('魂力', '魂力', '魂力上限'),
    构建绝对资源('精神力', '精神力', '精神力上限'),
    构建百分比资源('体力', '体力', '体力上限'),
  ].filter(Boolean).join('｜');
}

function 构建MVU剧情提示财富_V1(角色 = {}) {
  const 财富 = 角色?.财富 && typeof 角色.财富 === 'object' ? 角色.财富 : {};
  const 势力表 = 角色?.社交?.势力 && typeof 角色.社交.势力 === 'object' ? 角色.社交.势力 : {};
  const 所属势力文本 = Object.keys(势力表).join(' ');
  const 片段列表 = [];
  追加MVU剧情提示片段_V1(片段列表, '联邦币', 财富.联邦币, { 允许零: true });
  追加MVU剧情提示片段_V1(片段列表, '星罗币', 财富.星罗币, { 允许零: true });
  if (所属势力文本.includes('唐门')) 追加MVU剧情提示片段_V1(片段列表, '唐门积分', 财富.唐门积分, { 允许零: true });
  if (所属势力文本.includes('史莱克')) 追加MVU剧情提示片段_V1(片段列表, '学院积分', 财富.学院积分, { 允许零: true });
  追加MVU剧情提示片段_V1(片段列表, '战功', 财富.战功);
  return 片段列表.join('；');
}

function 构建MVU剧情提示身份关系_V1(角色 = {}, 角色名 = '', 角色名列表 = []) {
  const 社交 = 角色?.社交 && typeof 角色.社交 === 'object' ? 角色.社交 : {};
  const 片段列表 = [];
  追加MVU剧情提示片段_V1(片段列表, '主身份', 社交.主身份);
  追加MVU剧情提示片段_V1(片段列表, '家世', 社交.家世描述);
  追加MVU剧情提示片段_V1(片段列表, '名望', 社交.名望等级);
  const 势力身份 = Object.entries(社交.势力 || {})
    .map(([势力名, 势力数据]) => {
      const 身份 = 格式化MVU剧情提示原子值_V1(势力数据?.身份);
      return 身份 ? `${势力名}:${身份}` : '';
    })
    .filter(Boolean)
    .join('、');
  if (势力身份) 片段列表.push(`势力:${势力身份}`);
  const 关系表 = 社交.关系 && typeof 社交.关系 === 'object' ? 社交.关系 : {};
  角色名列表.forEach(目标名 => {
    if (!目标名 || 目标名 === 角色名) return;
    const 关系 = 关系表[目标名];
    if (!关系 || typeof 关系 !== 'object') return;
    const 关系名 = String(关系.关系 || '').trim();
    const 好感度 = Number(关系.好感度 || 0);
    const 关系路线 = String(关系.关系路线 || '').trim();
    if ((!关系名 || 关系名 === '陌生') && 好感度 === 0 && (!关系路线 || 关系路线 === '朋友线')) return;
    const 关系片段 = [];
    追加MVU剧情提示片段_V1(关系片段, '关系', 关系名);
    追加MVU剧情提示片段_V1(关系片段, '好感', 好感度);
    追加MVU剧情提示片段_V1(关系片段, '路线', 关系路线);
    if (关系片段.length) 片段列表.push(`${目标名}(${关系片段.join('，')})`);
  });
  return 片段列表.join('；');
}

var MVU剧情当前段字段表_V1 = Object.freeze([
  Object.freeze({ 标签: '时间', 取值: 当前 => 格式化MVU剧情提示当前时间_V1(当前?.时间 || {}) }),
  Object.freeze({ 标签: '地点', 取值: 当前 => 当前?.地点 }),
  Object.freeze({ 标签: '玩家', 取值: 当前 => 当前?.玩家 }),
  Object.freeze({ 标签: '玩家行动', 取值: 当前 => 当前?.玩家行动 }),
  Object.freeze({ 标签: '世界线日志', 取值: 当前 => 当前?.世界线日志 }),
]);

function 构建MVU剧情角色简表_V1(数据根 = {}, userInput = '', 最后剧情文本 = '') {
  const 角色名集合 = 取运行时剧情提示角色名集合_V1(数据根, userInput, 最后剧情文本);
  const 角色名列表 = 按玩家优先排序名称_V1(角色名集合, 取运行时玩家名_V1(数据根));
  const 当前tick = Number(数据根?.world?.时间?.tick || 0);
  const 命中角色表 = {};
  角色名列表.forEach(角色名 => {
    const 角色 = 构建MVU正文角色薄片_V1(数据根?.char?.[角色名], 当前tick);
    if (!角色 || typeof 角色 !== 'object') return;
    命中角色表[角色名] = 角色;
  });
  const 主体段 = 构建MVU角色卡表格文本_V1(命中角色表, 当前tick);
  return 主体段 && 主体段 !== '无' ? [{ 角色: 角色名列表.join('、'), 主体段 }] : [];
}

function 提取场景线索种子正文_V1(场景线索种子 = '') {
  const 文本 = String(场景线索种子 || '').trim();
  if (!文本) return '';
  const 匹配 = 文本.match(/<\s*scene_clue_seed\s*>([\s\S]*?)<\s*\/\s*scene_clue_seed\s*>/i);
  return String(匹配 ? 匹配[1] : 文本).trim();
}

function 解析场景线索候选人物列表_V1(场景线索种子 = '') {
  const 正文 = 提取场景线索种子正文_V1(场景线索种子);
  if (!正文) return [];
  const 候选文本列表 = [];
  const 行正则 = /(?:候选人物|候选角色|地缘常驻人物|同域候选人物|背景候选人物|学院流程候选)\s*[:：]\s*([^\n\r]+)/g;
  let 匹配 = null;
  while ((匹配 = 行正则.exec(正文)) !== null) {
    const 内容 = String(匹配[1] || '').trim();
    if (内容) 候选文本列表.push(内容);
  }
  return 候选文本列表
    .join('、')
    .split(/[、，,；;\n\r]/)
    .map(候选 => String(候选 || '')
      .replace(/[“”"'`]/g, '')
      .replace(/[（(][^（）()]*[）)]/g, '')
      .trim())
    .filter(候选 => 候选 && !/^(无|暂无|未知|无相关|无候选|没有)$/.test(候选))
    .filter((候选, 序号, 列表) => 列表.indexOf(候选) === 序号);
}

function 解析场景线索字段值列表_V1(文本 = '', 字段名列表 = []) {
  const 正文 = 提取场景线索种子正文_V1(文本);
  if (!正文) return [];
  const 字段名文本 = (Array.isArray(字段名列表) ? 字段名列表 : [])
    .map(字段名 => String(字段名 || '').trim())
    .filter(Boolean)
    .join('|');
  if (!字段名文本) return [];
  const 行正则 = new RegExp(`(?:${字段名文本})\\s*[:：]\\s*([^\\n\\r]+)`, 'g');
  const 结果 = [];
  let 匹配 = null;
  while ((匹配 = 行正则.exec(正文)) !== null) {
    String(匹配[1] || '')
      .split(/[、，,；;\/／|｜\s]+/)
      .map(片段 => 片段.replace(/[“”"'`]/g, '').trim())
      .filter(Boolean)
      .forEach(片段 => 结果.push(片段));
  }
  return Array.from(new Set(结果)).filter(片段 => !/^(无|暂无|未知|无相关|无候选|没有)$/.test(片段));
}

var 场景背景角色补充生态词_V1 = Object.freeze([
  '一年级一班',
  '百年最强新生班',
  '最强新生班',
  '新生班',
  '三名二环',
  '二环魂师',
  '二环学员',
  '一班天才',
  '天才资源',
  '资源倾斜',
  '升班赛',
  '分班',
  '同届',
  '同年级',
  '班级竞争',
  '班级对抗',
  '一班',
]);

var 场景背景角色补充新生探针词_V1 = Object.freeze([
  '一年级一班',
  '百年最强新生班',
  '最强新生班',
  '三名二环',
  '二环魂师',
  '一班天才',
  '升班赛',
  '分班',
  '同届',
  '同年级',
  '新生班',
]);

var 场景背景角色补充近邻词_V1 = Object.freeze([
  '一班',
  '新生班',
  '二环',
  '核心',
  '带队',
  '登场',
  '天才',
  '教师',
  '学员',
  '挑衅',
  '对阵',
  '参赛',
  '升班赛',
  '班级竞争',
]);

var 场景背景角色补充弱生态词_V1 = Object.freeze(new Set(['分班', '同届', '同年级', '升班赛']));

function 有场景背景角色强生态词_V1(词列表 = []) {
  return (Array.isArray(词列表) ? 词列表 : []).some(词 => {
    const 文本 = String(词 || '').trim();
    return 文本 && !场景背景角色补充弱生态词_V1.has(文本);
  });
}

function 是有效场景背景角色锚点_V1(词 = '') {
  const 文本 = String(词 || '').trim();
  if (!是具体远端原著时间线场景锚点_V1(文本)) return false;
  if (/远端|原著|候选|依据|来源|背景设定|前文剧情/.test(文本)) return false;
  if (文本.length > 14 && /我|你|他|她|来到|准备|办理|进入|前往|本轮|上述|剧情|自然|开始/.test(文本)) return false;
  return 是远端原著时间线组织场景锚点_V1(文本)
    || 是远端原著时间线班级锚点_V1(文本)
    || /新生|学生|学员|教师|老师|班主任|同届|班级|接待点|宿舍|食堂|教室|操场|办公室|教导处/.test(文本);
}

function 提取场景背景角色组织锚点_V1(词 = '') {
  const 文本 = String(词 || '').trim();
  return Array.from(new Set((文本.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,18}(?:学院|传灵塔|唐门|协会|分会|分部|总部|拍卖场)/g) || [])
    .filter(是有效远端原著时间线命中词_V1)));
}

function 场景背景角色事件命中组织_V1(事件文本 = '', 组织锚点 = '') {
  const 文本 = String(事件文本 || '');
  const 组织 = String(组织锚点 || '').trim();
  if (!文本 || !组织) return false;
  if (运行时文本包含片段_V1(文本, 组织)) return true;
  const 匹配 = 组织.match(/^(.{2,16}?)(学院|传灵塔|唐门|协会|分会|分部|总部|拍卖场)$/);
  if (!匹配) return false;
  const 前缀 = 匹配[1];
  const 类型 = 匹配[2];
  return 前缀.length >= 2 && 文本.includes(前缀) && (文本.includes(类型) || (类型 === '学院' && 文本.includes('学院')));
}

function 计算场景背景角色人物邻近分_V1(角色名 = '', 命中 = {}) {
  const 名称 = String(角色名 || '').trim();
  const 事件文本 = [命中?.事件?.简述, 命中?.事件?.描述].filter(Boolean).join('\n');
  if (!名称 || !事件文本 || !事件文本.includes(名称)) return 0;
  let 最高分 = 0;
  String(事件文本 || '')
    .split(/[。；;！!？?\n\r]+/)
    .map(片段 => 片段.trim())
    .filter(片段 => 片段 && 片段.includes(名称))
    .forEach(片段 => {
      const 生态命中数 = (命中.命中生态词 || []).filter(词 => 片段.includes(词)).length;
      const 近邻命中数 = 场景背景角色补充近邻词_V1.filter(词 => 片段.includes(词)).length;
      let 分数 = 生态命中数 * 4 + 近邻命中数 * 2;
      if (/一班由|三名二环|组成核心|一班天才|百年最强新生班|最强新生班/.test(片段)) 分数 += 8;
      if (/带队|核心|二环学员|二环魂师|挑衅|对阵/.test(片段)) 分数 += 4;
      if (/五班|零班/.test(片段) && !/一班由|三名二环|一班天才|一年级一班|新生班|同届|同年级/.test(片段)) 分数 -= 8;
      if (/五班|零班/.test(片段) && !/一班由|三名二环|组成核心|带队登场|一班天才/.test(片段)) 分数 -= 4;
      最高分 = Math.max(最高分, 分数);
    });
  return Math.max(0, 最高分);
}

function 构建场景背景角色锚点_V1(数据根 = {}, userInput = '', 最后剧情文本 = '', 场景线索种子 = '') {
  const { 玩家名, 当前地点, 当前地点信息, 当前上下文节点 } = 取运行时当前范围_V1(数据根);
  const 玩家 = 数据根?.char?.[玩家名] || {};
  const 当前路径 = Array.isArray(当前地点信息?.path) ? 当前地点信息.path : [];
  const 动态地点 = 数据根?.world?.动态地点?.[当前地点] || {};
  const 种子锚点 = 解析场景线索字段值列表_V1(场景线索种子, ['当前主身份', '场景锚点', '候选设定关键词']);
  const 锚点来源列表 = [
    种子锚点,
    玩家?.社交?.主身份,
    玩家?.社交?.势力身份,
    当前地点,
    当前上下文节点,
    当前路径,
    当前路径.length ? 构建运行时地点路径名_V1(当前路径) : '',
    动态地点?.归属父节点,
    动态地点?.势力,
  ];
  const 查询文本 = 收集运行时字符串列表_V1(userInput, 最后剧情文本, 场景线索种子, 锚点来源列表).join('\n');
  const 场景锚点 = 收集远端原著时间线身份场景锚点_V1(...锚点来源列表)
    .filter(是有效场景背景角色锚点_V1)
    .slice(0, 20);
  const 组织锚点 = Array.from(new Set(场景锚点.flatMap(提取场景背景角色组织锚点_V1))).slice(0, 8);
  const 事件词 = 收集远端原著时间线事件词_V1(查询文本).slice(0, 12);
  const 原始生态词 = 场景背景角色补充生态词_V1.filter(词 => 运行时文本包含片段_V1(查询文本, 词) || 场景锚点.some(锚点词 => 运行时文本包含片段_V1(锚点词, 词))).slice(0, 12);
  const 需要班级生态 = /新生|报到|报道|入学|分班|同届|同年级|升班赛|[一二三四五六七八九十百千万\d]+年级|[一二三四五六七八九十百千万\d]+班/.test(查询文本);
  const 需要新生探针 = 需要班级生态 && 组织锚点.length && !有场景背景角色强生态词_V1(原始生态词);
  const 生态词 = Array.from(new Set([
    ...原始生态词,
    ...(需要新生探针 ? 场景背景角色补充新生探针词_V1 : []),
  ])).slice(0, 16);
  const 关键词 = 切分运行时实体关键词_V1(...锚点来源列表)
    .filter(词 => 是有效远端原著时间线命中词_V1(词) && !/远端|原著|候选|依据|来源|背景设定|前文剧情/.test(词))
    .slice(0, 16);
  return {
    玩家名,
    场景锚点,
    组织锚点,
    事件词,
    生态词,
    关键词,
    需要班级生态,
  };
}

function 计算场景背景角色事件命中_V1(事件 = {}, 锚点 = {}) {
  const 事件文本 = 构建远端原著时间线事件检索文本_V1(事件);
  if (!事件文本) return null;
  const 命中组织 = (锚点.组织锚点 || []).filter(词 => 场景背景角色事件命中组织_V1(事件文本, 词));
  const 命中场景 = (锚点.场景锚点 || []).filter(词 => 运行时文本包含片段_V1(事件文本, 词));
  const 命中事件词 = (锚点.事件词 || []).filter(词 => 远端原著时间线文本含事件词_V1(事件文本, 词));
  const 命中生态词 = (锚点.生态词 && 锚点.生态词.length ? 锚点.生态词 : 场景背景角色补充生态词_V1)
    .filter(词 => 运行时文本包含片段_V1(事件文本, 词));
  const 命中关键词 = (锚点.关键词 || []).filter(词 => 运行时文本包含片段_V1(事件文本, 词));
  if (锚点.需要班级生态 && (!命中组织.length || !有场景背景角色强生态词_V1(命中生态词))) return null;
  const 分数 = 命中组织.length * 6 + Math.min(命中场景.length, 3) * 3 + 命中事件词.length * 2 + 命中生态词.length * 5 + Math.min(命中关键词.length, 3);
  if (分数 < (锚点.需要班级生态 ? 12 : 9) || (!命中组织.length && !命中场景.length && 命中事件词.length < 2)) return null;
  return {
    事件,
    分数,
    命中组织,
    命中场景,
    命中事件词,
    命中生态词,
    命中关键词,
  };
}

function 生成场景背景角色补充_V1(数据输入 = null, userInput = '', 最后剧情文本 = '', 场景线索种子 = '', 最大数量 = 8) {
  const 数据根 = 读取运行时Mvu数据根或最新_V1(数据输入) || {};
  const 当前tick = Number(数据根?.world?.时间?.tick || 0);
  const 锚点 = 构建场景背景角色锚点_V1(数据根, userInput, 最后剧情文本, 场景线索种子);
  const 已有候选 = new Set(解析场景线索候选人物列表_V1(场景线索种子)
    .map(名称 => 解析内置角色规范名_V1(名称, 当前tick, 数据根) || 名称)
    .filter(Boolean));
  const 事件命中列表 = 收集原著时间线事件列表_V1()
    .map(事件 => 计算场景背景角色事件命中_V1(事件, 锚点))
    .filter(Boolean)
    .sort((左, 右) => 右.分数 - 左.分数 || Number(左.事件?.触发tick || 0) - Number(右.事件?.触发tick || 0));
  const 人物分数 = new Map();
  事件命中列表.slice(0, 24).forEach(命中 => {
    标准化远端原著时间线人物列表_V1(命中.事件?.人物).forEach(名称 => {
      const 规范名 = 解析内置角色规范名_V1(名称, 当前tick, 数据根);
      if (!规范名 || 规范名 === 锚点.玩家名 || 已有候选.has(规范名)) return;
      const 邻近分 = 计算场景背景角色人物邻近分_V1(名称, 命中);
      if (邻近分 < 6) return;
      人物分数.set(规范名, Math.max(Number(人物分数.get(规范名) || 0), 命中.分数 + 邻近分));
    });
  });
  const 候选人物 = Array.from(人物分数.entries())
    .sort((左, 右) => 右[1] - 左[1] || 左[0].localeCompare(右[0], 'zh-Hans-CN', { numeric: true, sensitivity: 'base' }))
    .slice(0, Math.max(1, Number(最大数量 || 8)))
    .map(([名称]) => 名称);
  if (!候选人物.length) return '无';
  return `同域候选人物：${候选人物.join('、')}`;
}

function 取候选角色武魂条目_V1(角色 = {}) {
  if (!角色 || typeof 角色 !== 'object') return [];
  return Object.entries(角色)
    .filter(([键, 值]) => /^第\d+武魂$/.test(String(键 || '').trim()) && 值 && typeof 值 === 'object')
    .sort(([左], [右]) => Number(String(左).match(/\d+/)?.[0] || 0) - Number(String(右).match(/\d+/)?.[0] || 0));
}

function 取MVU正文武魂显示名_V1(武魂键 = '') {
  const 文本 = String(武魂键 || '').trim();
  if (文本 === '第1武魂' || 文本 === '第一武魂') return '武魂';
  if (文本 === '第2武魂' || 文本 === '第二武魂') return '第二武魂';
  return 文本;
}

function 裁剪候选角色资料片段_V1(文本 = '', 最大长度 = 80) {
  const 内容 = 格式化MVU正文提示原子值_V1(文本);
  if (!内容) return '';
  const 上限 = Math.max(8, Math.floor(Number(最大长度 || 80)));
  return 内容.length > 上限 ? `${内容.slice(0, 上限)}...` : 内容;
}

function 构建候选角色武魂摘要_V1(角色 = {}) {
  return 取候选角色武魂条目_V1(角色)
    .slice(0, 2)
    .map(([武魂键, 武魂]) => {
      const 片段列表 = [];
      const 名称 = 格式化MVU正文提示原子值_V1(武魂?.表象名称 || 武魂?.名称);
      if (名称) 片段列表.push(名称);
      const 系别 = 格式化MVU正文提示原子值_V1(武魂?.系别);
      if (系别) 片段列表.push(`系别=${系别}`);
      const 显示名 = 取MVU正文武魂显示名_V1(武魂键);
      return 片段列表.length ? `${显示名}(${片段列表.join('；')})` : '';
    })
    .filter(Boolean)
    .join('；');
}

function 构建场景候选角色资料行_V1(角色名 = '', 角色 = {}, 角色记录 = {}, 当前tick = 0) {
  const 片段列表 = [];
  const 性别 = 格式化MVU正文提示原子值_V1(角色?.属性?.性别);
  if (性别) 片段列表.push(`性别=${性别}`);
  const 年龄 = Number(角色?.属性?.年龄);
  const 生日 = 角色?.属性?.生日;
  if (Number.isFinite(年龄)) 片段列表.push(`年龄=${格式化年龄岁月文本_V1(年龄, 生日, 当前tick)}`);
  const 等级 = Number(角色?.属性?.等级);
  if (Number.isFinite(等级)) 片段列表.push(`等级=Lv${等级}`);
  const 主身份 = 格式化MVU正文提示原子值_V1(角色?.社交?.主身份);
  if (主身份) 片段列表.push(`当前身份=${主身份}`);
  const 位置 = 格式化MVU正文提示原子值_V1(角色?.状态?.位置);
  if (位置) 片段列表.push(`当前位置=${位置}`);
  const 武魂摘要 = 构建候选角色武魂摘要_V1(角色);
  if (武魂摘要) 片段列表.push(`武魂=${武魂摘要}`);
  const 性格 = 裁剪候选角色资料片段_V1(角色?.性格 || 角色记录?.摘要, 80);
  if (性格) 片段列表.push(`定位/性格=${性格}`);
  return 片段列表.length ? `- ${角色名}：${片段列表.join('；')}` : '';
}

function 计算场景候选角色年龄差_V1(角色名 = '', 数据根 = {}, 主角年龄 = null, 当前tick = 0) {
  if (!Number.isFinite(主角年龄)) return Infinity;
  const 角色 = 数据根?.char?.[角色名];
  const 已实例年龄 = Number(角色?.属性?.年龄);
  if (Number.isFinite(已实例年龄)) {
    return Math.abs(计算角色有效年龄_V1(已实例年龄, 角色?.属性?.生日, 当前tick) - 主角年龄);
  }
  const 角色记录 = 读取内置角色记录_V1(角色名, 当前tick, 数据根);
  const 快照 = 取内置角色最近快照_V1(角色记录 || {}, 当前tick);
  const 投影年龄 = 快照 ? 计算内置角色投影年龄_V1(快照, 当前tick) : NaN;
  return Number.isFinite(投影年龄) ? Math.abs(投影年龄 - 主角年龄) : Infinity;
}

function 生成场景候选角色资料_V1(数据输入 = null, userInput = '', 最后剧情文本 = '', 场景线索种子 = '', 最大数量 = 10, 场景背景角色补充 = '') {
  const 原数据根 = 读取运行时Mvu数据根或最新_V1(数据输入) || {};
  const 当前tick = Number(原数据根?.world?.时间?.tick || 0);
  const 已发送角色集合 = 取运行时剧情提示角色名集合_V1(原数据根, userInput, 最后剧情文本);
  const { 玩家 } = 取运行时当前范围_V1(原数据根);
  const 主角年龄 = Number.isFinite(Number(玩家?.属性?.年龄))
    ? 计算角色有效年龄_V1(Number(玩家.属性.年龄), 玩家?.属性?.生日, 当前tick)
    : null;
  const 候选名称列表 = Array.from(new Set([
    ...解析场景线索候选人物列表_V1(场景线索种子),
    ...解析场景线索候选人物列表_V1(场景背景角色补充),
  ]));
  if (!候选名称列表.length) return '无';
  const 待展开角色名 = [];
  const 未展开候选 = [];
  候选名称列表.forEach(候选名 => {
    const 规范名 = 解析内置角色规范名_V1(候选名, 当前tick, 原数据根);
    if (!规范名) {
      未展开候选.push(`${候选名}（内置角色库无匹配）`);
      return;
    }
    if (已发送角色集合.has(规范名) || 待展开角色名.includes(规范名)) return;
    待展开角色名.push(规范名);
  });
  if (!待展开角色名.length && !未展开候选.length) return '无';
  const 展开上限 = Math.max(1, Math.floor(Number(最大数量 || 10)));
  const 排序角色名 = 待展开角色名
    .map((角色名, 序号) => ({
      角色名,
      序号,
      年龄差: 计算场景候选角色年龄差_V1(角色名, 原数据根, 主角年龄, 当前tick),
    }))
    .sort((左, 右) => 左.年龄差 - 右.年龄差 || 左.序号 - 右.序号)
    .map(条目 => 条目.角色名);
  const 展开角色名 = 排序角色名.slice(0, 展开上限);
  const 超出角色名 = 排序角色名.slice(展开上限);
  const 草稿数据根 = cloneJsonValue(原数据根, {});
  if (展开角色名.length) {
    const 结果 = 应用内置角色实例化_V1(草稿数据根, {
      用户输入: 展开角色名.join('、'),
      命中角色: 展开角色名,
      使用统一命中: true,
    });
    if (Array.isArray(结果?.changedNames) && 结果.changedNames.length > 0 && globalThis.__LWCS_MVU_SCHEMA__?.parse) {
      try {
        Object.assign(草稿数据根, globalThis.__LWCS_MVU_SCHEMA__.parse(草稿数据根));
      } catch (错误) {}
    }
  }
  const 行列表 = 展开角色名
    .map(角色名 => 构建场景候选角色资料行_V1(角色名, 草稿数据根?.char?.[角色名] || {}, 读取内置角色记录_V1(角色名, 当前tick, 原数据根) || {}, 当前tick))
    .filter(Boolean);
  if (超出角色名.length) 行列表.push(`超出展开上限：${超出角色名.join('、')}`);
  if (未展开候选.length) 行列表.push(`未匹配候选：${未展开候选.join('、')}`);
  return 行列表.length ? 行列表.join('\n') : '无';
}

function 生成场景审计材料_V1(数据输入 = null, userInput = '', 最后剧情文本 = '', 场景线索种子 = '', 最大资料数量 = 10, 场景背景角色补充 = '', 场景候选角色资料 = '') {
  const 数据根 = 读取运行时Mvu数据根或最新_V1(数据输入) || {};
  const 当前tick = Number(数据根?.world?.时间?.tick || 0);
  const { 玩家名, 当前地点, 当前地点信息, 当前上下文节点 } = 取运行时当前范围_V1(数据根);
  const 玩家 = 数据根?.char?.[玩家名] || {};
  const 当前路径 = Array.isArray(当前地点信息?.path) ? 当前地点信息.path : [];
  const 主身份列表 = Array.from(new Set([
    ...解析场景线索字段值列表_V1(场景线索种子, ['当前主身份']),
    格式化MVU正文提示原子值_V1(玩家?.社交?.主身份),
  ].filter(Boolean))).slice(0, 3);
  const 场景锚点列表 = Array.from(new Set([
    ...解析场景线索字段值列表_V1(场景线索种子, ['场景锚点']),
    当前地点,
    当前上下文节点,
    当前路径.length ? 构建运行时地点路径名_V1(当前路径) : '',
  ].map(片段 => 格式化MVU正文提示原子值_V1(片段)).filter(Boolean))).slice(0, 10);
  const 背景补充文本 = String(场景背景角色补充 || 生成场景背景角色补充_V1(数据根, userInput, 最后剧情文本, 场景线索种子) || '').trim();
  const 候选人物 = [];
  [
    ...解析场景线索候选人物列表_V1(场景线索种子),
    ...解析场景线索候选人物列表_V1(背景补充文本),
  ].forEach(候选名 => {
    const 名称 = 解析内置角色规范名_V1(候选名, 当前tick, 数据根) || 候选名;
    if (!名称 || 名称 === 玩家名 || 候选人物.includes(名称)) return;
    候选人物.push(名称);
  });
  const 资料文本 = String(场景候选角色资料 || 生成场景候选角色资料_V1(数据根, userInput, 最后剧情文本, 场景线索种子, 最大资料数量, 背景补充文本) || '').trim() || '无';
  return [
    `当前主身份：${主身份列表.length ? 主身份列表.join('、') : '无'}`,
    `场景锚点：${场景锚点列表.length ? 场景锚点列表.join('、') : '无'}`,
    `候选人物：${候选人物.length ? 候选人物.join('、') : '无'}`,
    '候选角色资料：',
    资料文本,
  ].join('\n');
}

function 构建MVU剧情提示当前段_V1(剧情视图 = {}) {
  const 当前 = 剧情视图?.当前 && typeof 剧情视图.当前 === 'object' ? 剧情视图.当前 : {};
  const 片段列表 = [];
  MVU剧情当前段字段表_V1.forEach(字段 => {
    const 值 = typeof 字段.取值 === 'function' ? 字段.取值(当前, 剧情视图) : '';
    追加MVU剧情提示片段_V1(片段列表, 字段.标签, 值, 字段.选项 || {});
  });
  return ['【当前】', ...片段列表.map(片段 => `- ${片段}`)].join('\n');
}

function 构建MVU剧情提示角色段_V1(剧情视图 = {}) {
  const 角色简表 = Array.isArray(剧情视图?.角色简表) ? 剧情视图.角色简表 : [];
  if (!角色简表.length) return '【角色简表】\n无';
  const 角色块列表 = 角色简表
    .map(条目 => String(条目?.主体段 || '').trim())
    .filter(Boolean);
  return 角色块列表.length ? `【角色简表】\n\n${角色块列表.join('\n\n---\n\n')}` : '【角色简表】\n无';
}

function 构建MVU剧情提示赛事权限段_V1(剧情视图 = {}) {
  const 赛事权限 = 剧情视图?.剧情钩子?.赛事与权限;
  if (!赛事权限 || typeof 赛事权限 !== 'object' || Array.isArray(赛事权限)) return '';
  const 行列表 = [];
  const 构建记录行列表 = (记录列表 = [], 默认名称 = '') => (Array.isArray(记录列表) ? 记录列表 : [])
    .map(记录 => {
      if (!记录 || typeof 记录 !== 'object' || Array.isArray(记录)) return '';
      const 名称 = String(记录.名称 || 默认名称 || '').trim();
      const 内容 = cloneJsonValue(记录, {});
      delete 内容.名称;
      return 构建MVU正文普通行_V1(名称, 内容, 2);
    })
    .filter(Boolean);
  添加MVU正文块_V1(行列表, '特殊权限', 构建记录行列表(赛事权限.可用权限, '未命名权限'));
  添加MVU正文块_V1(行列表, '赛事', 构建记录行列表(赛事权限.赛事, '未命名赛事'));
  return 行列表.join('\n');
}

function 构建MVU剧情提示引导段_V1(剧情视图 = {}) {
  const 剧情钩子 = 剧情视图?.剧情钩子 && typeof 剧情视图.剧情钩子 === 'object' ? 剧情视图.剧情钩子 : {};
  const 行列表 = ['【剧情引导】'];
  [
    ['时间线', 剧情钩子.时间线],
    ['委托板', 剧情钩子.委托板],
    ['拍卖', 剧情钩子.拍卖],
    ['战斗', 剧情钩子.战斗],
  ].forEach(([类型, 值]) => {
    const 内容 = 格式化MVU剧情提示记录表_V1(值, 4, 5) || 格式化MVU剧情提示值_V1(值);
    if (内容) 行列表.push(`- ${类型}：${格式化MVU剧情提示单元_V1(内容)}`);
  });
  return 行列表.length > 1 ? 行列表.join('\n') : '【剧情引导】\n无';
}

function 构建MVU剧情提示地点候选段_V1(剧情视图 = {}) {
  const 候选 = 剧情视图?.剧情钩子?.地点候选;
  const 表格行 = Array.isArray(候选?.表格行) ? 候选.表格行 : [];
  if (表格行.length) {
    const 表格 = 渲染MVU角色卡表格_V1('地点候选表', ['类型', '可填目标地点', '距离耗时', '状态'], 表格行);
    return 表格 ? ['【地点候选】', 表格].join('\n') : '';
  }
  const 已有地点 = Array.isArray(候选?.已有地点) ? 候选.已有地点.map(格式化MVU剧情提示单元_V1).filter(Boolean) : [];
  const 动态地点 = Array.isArray(候选?.动态地点) ? 候选.动态地点.map(格式化MVU剧情提示单元_V1).filter(Boolean) : [];
  if (!已有地点.length && !动态地点.length) return '';
  const 行列表 = ['【地点候选】'];
  if (已有地点.length) 行列表.push(`- 已有地点: ${已有地点.join('、')}`);
  if (动态地点.length) 行列表.push(`- 动态地点: ${动态地点.join('、')}`);
  return 行列表.join('\n');
}

function 生成MVU剧情提示文本_V1(数据输入 = null, userInput = '', 最后剧情文本 = '') {
  const 剧情视图 = 生成MVU剧情视图_V1(数据输入, userInput, 最后剧情文本);
  return [
    构建MVU剧情提示当前段_V1(剧情视图),
    构建MVU剧情提示角色段_V1(剧情视图),
    构建MVU剧情提示地点候选段_V1(剧情视图),
    构建MVU剧情提示赛事权限段_V1(剧情视图),
    构建MVU剧情提示引导段_V1(剧情视图),
  ].filter(Boolean).join('\n\n');
}

function 格式化MVU正文提示原子值_V1(值) {
  if (值 === undefined || 值 === null) return '';
  if (typeof 值 === 'boolean') return 值 ? '是' : '';
  if (typeof 值 === 'number') return Number.isFinite(值) ? String(值) : '';
  const 文本 = String(值).trim();
  return 正文视图值已初始化_V1(文本) ? 转换运行时文本tick显示_V1(文本) : '';
}

function 格式化MVU正文提示值_V1(值, 最大深度 = 2) {
  if (值 === undefined || 值 === null) return '';
  if (Array.isArray(值)) {
    return 值
      .map(项 => 格式化MVU正文提示值_V1(项, Math.max(0, 最大深度 - 1)))
      .filter(Boolean)
      .join('、');
  }
  if (typeof 值 === 'object') {
    if (最大深度 <= 0) return '';
    return Object.entries(值)
      .map(([键, 子值]) => {
        const 文本 = 格式化MVU正文提示值_V1(子值, 最大深度 - 1);
        return 文本 ? `${格式化运行时显示字段名_V1(键)}:${文本}` : '';
      })
      .filter(Boolean)
      .join('；');
  }
  return 格式化MVU正文提示原子值_V1(值);
}

function 添加MVU正文块_V1(行列表 = [], 标题 = '', 子行列表 = []) {
  const 标题文本 = String(标题 || '').trim();
  const 有效子行 = (Array.isArray(子行列表) ? 子行列表 : [子行列表]).map(行 => String(行 || '').trim()).filter(Boolean);
  if (!标题文本 || !有效子行.length) return;
  行列表.push(`【${标题文本}】`);
  有效子行.forEach(行 => 行列表.push(行.startsWith('- ') ? 行 : `- ${行}`));
}

function 添加MVU正文键值片段_V1(片段列表 = [], 标签 = '', 值 = '', 最大深度 = 2) {
  const 标签文本 = 格式化运行时显示字段名_V1(标签);
  const 内容文本 = 格式化MVU正文提示值_V1(值, 最大深度);
  if (标签文本 && 内容文本) 片段列表.push(`${标签文本}=${内容文本}`);
}

function 构建MVU正文普通行_V1(名称 = '', 内容 = '', 最大深度 = 2) {
  const 名称文本 = 格式化运行时显示字段名_V1(名称);
  const 内容文本 = 格式化MVU正文提示值_V1(内容, 最大深度);
  return 名称文本 && 内容文本 ? `- ${名称文本}：${内容文本}` : '';
}

function 构建MVU正文状态摘要_V1(角色 = {}) {
  const 状态 = 角色?.状态 && typeof 角色.状态 === 'object' ? cloneJsonValue(角色.状态, {}) : {};
  if (状态.存活 === true) delete 状态.存活;
  delete 状态.死亡tick;
  if (!String(状态.死亡类型 || '').trim() || String(状态.死亡类型 || '').trim() === '无') delete 状态.死亡类型;
  const 剩余资源 = 构建MVU剩余资源摘要_V1(角色);
  if (剩余资源) 状态.剩余资源 = 剩余资源;
  return 状态;
}

function 构建MVU正文外貌穿搭摘要_V1(角色 = {}) {
  return {
    外貌: 角色?.外貌,
    穿搭: 角色?.穿搭,
    性格: 角色?.性格,
  };
}

function 构建MVU正文财富摘要_V1(角色 = {}) {
  return 角色?.财富 && typeof 角色.财富 === 'object' ? 角色.财富 : {};
}

function 构建MVU正文身份摘要_V1(角色 = {}) {
  const 社交 = 角色?.社交 && typeof 角色.社交 === 'object' ? 角色.社交 : {};
  return {
    主身份: 社交.主身份,
    家世描述: 社交.家世描述,
    名望等级: 社交.名望等级,
    声望: 社交.声望,
  };
}

function 构建MVU正文势力摘要_V1(角色 = {}) {
  const 势力 = 角色?.社交?.势力 && typeof 角色.社交.势力 === 'object' ? cloneJsonValue(角色.社交.势力, {}) : {};
  Object.values(势力 || {}).forEach(势力数据 => {
    if (!势力数据 || typeof 势力数据 !== 'object') return;
    delete 势力数据.权限级;
  });
  return 势力;
}

function 构建MVU正文关系摘要_V1(角色 = {}) {
  const 关系表 = 角色?.社交?.关系 && typeof 角色.社交.关系 === 'object' ? cloneJsonValue(角色.社交.关系, {}) : {};
  Object.values(关系表).forEach(关系 => {
    if (!关系 || typeof 关系 !== 'object') return;
    Object.keys(关系).forEach(键 => {
      if (String(键 || '').startsWith('_')) delete 关系[键];
    });
  });
  return 关系表;
}

function 构建MVU正文称号摘要_V1(角色 = {}) {
  return 角色?.社交?.称号 && typeof 角色.社交.称号 === 'object' ? 角色.社交.称号 : {};
}

function 构建MVU正文关系分析摘要_V1(角色 = {}) {
  return 角色?.社交?.关系分析 && typeof 角色.社交.关系分析 === 'object' ? 角色.社交.关系分析 : {};
}

function 读取副职业显示名_V1(副职业名 = '') {
  return { 制造师: '机甲制造师', 设计师: '机甲设计师', 修理师: '机甲修理师' }[String(副职业名 || '').trim()] || String(副职业名 || '').trim();
}

function 构建MVU正文副职业摘要_V1(角色 = {}) {
  const 输出 = {};
  Object.entries(角色?.副职业 || {}).forEach(([副职业名, 副职业数据]) => {
    const 派生 = 派生副职业运行时_V1(副职业名, 副职业数据);
    输出[读取副职业显示名_V1(副职业名)] = {
      等级: 派生.等级,
      经验: 派生.经验,
      称号: 派生.称号,
      核心技艺: 派生.核心技艺,
      支持融锻数: 派生.支持融锻数,
      基础成功率: `${派生.基础成功率}%`,
    };
  });
  return 输出;
}

function 读取MVU正文可见融合源名_V1(正文角色表 = {}, 角色名 = '', 来源引用 = '') {
  const 角色 = 正文角色表?.[角色名];
  const 引用 = String(来源引用 || '').trim();
  if (!角色 || typeof 角色 !== 'object') return { 文本: '', 可见: false };
  if (/血脉|金龙王|银龙王|龙神/.test(引用)) {
    const 血脉名 = String(角色?.血脉之力?.血脉 || '').trim();
    const 血脉可见 = 正文视图值已初始化_V1(血脉名) && !['未觉醒血脉', '未知隐性变异(尚未觉醒)'].includes(血脉名);
    return 血脉可见 ? { 文本: 血脉名, 可见: true } : { 文本: '血脉未公开', 可见: false };
  }
  const 武魂 = 引用 && 角色[引用] && typeof 角色[引用] === 'object'
    ? 角色[引用]
    : Object.values(角色)
      .filter(值 => 值 && typeof 值 === 'object' && !Array.isArray(值))
      .find(值 => String(值?.表象名称 || '').trim() === 引用);
  const 表象名称 = String(武魂?.表象名称 || '').trim();
  if (正文视图值已初始化_V1(表象名称) && 表象名称 !== '未展露') return { 文本: 表象名称, 可见: true };
  return 引用 ? { 文本: '融合源未公开', 可见: false } : { 文本: '', 可见: false };
}

function 读取MVU正文融合参与者信息_V1(融合技 = {}, 当前角色名 = '', 正文角色表 = {}) {
  const 参与者列表 = Array.isArray(融合技?.融合参与者) ? 融合技.融合参与者 : [];
  let 存在不可见融合源 = false;
  const 摘要列表 = 参与者列表
    .map(参与者 => {
      if (!参与者 || typeof 参与者 !== 'object') return '';
      const 角色名 = String(参与者.角色名 || 参与者.角色键 || '').trim();
      const 显示角色名 = 角色名 && 角色名 !== '无' ? 角色名 : 当前角色名;
      const 来源引用 = String(参与者.血脉 || 参与者.融合源 || 参与者.武魂 || '').trim();
      const 融合源 = 读取MVU正文可见融合源名_V1(正文角色表, 显示角色名, 来源引用);
      if (来源引用 && !融合源.可见) 存在不可见融合源 = true;
      return [显示角色名, 融合源.文本].filter(Boolean).join(':');
    })
    .filter(Boolean);
  if (摘要列表.length) return { 文本: Array.from(new Set(摘要列表)).join(' + '), 存在不可见融合源 };
  const 融合对象 = String(融合技?.融合对象 || '').trim();
  if (融合技?.融合模式 === 'self') {
    const 来源列表 = (Array.isArray(融合技?.来源血脉) ? 融合技.来源血脉 : []).concat(
      Array.isArray(融合技?.来源武魂) ? 融合技.来源武魂 : [],
    );
    const 来源文本 = 来源列表
      .map(来源 => {
        const 融合源 = 读取MVU正文可见融合源名_V1(正文角色表, 当前角色名, 来源);
        if (String(来源 || '').trim() && !融合源.可见) 存在不可见融合源 = true;
        return 融合源.文本;
      })
      .filter(Boolean);
    return { 文本: 来源文本.length ? `${当前角色名}:${来源文本.join('+')}` : 当前角色名, 存在不可见融合源 };
  }
  return { 文本: 融合对象 && 融合对象 !== '无' ? 融合对象 : '', 存在不可见融合源 };
}

function 构建MVU正文武魂融合技摘要_V1(角色名 = '', 角色 = {}, 正文角色表 = {}) {
  const 输出 = {};
  Object.entries(角色?.武魂融合技 || {}).forEach(([记录名, 融合技]) => {
    if (!融合技 || typeof 融合技 !== 'object') return;
    const 技能数据 = 融合技.技能数据 && typeof 融合技.技能数据 === 'object' ? 融合技.技能数据 : {};
    const 技能名 = String(技能数据.魂技名 || 技能数据.name || '').trim();
    const 类型 = 融合技.融合模式 === 'self' ? '自体融合' : '武魂融合';
    const 参与者信息 = 读取MVU正文融合参与者信息_V1(融合技, 角色名, 正文角色表);
    const 摘要 = {
      类型,
      参与者: 参与者信息.文本,
      用法: 融合技.用法模式,
    };
    if (!参与者信息.存在不可见融合源) 摘要.效果 = 技能数据.效果描述 || 技能数据.描述 || 技能数据.画面描述;
    输出[格式化MVU正文提示原子值_V1(技能名) || '未命名武魂融合技'] = 摘要;
  });
  return 输出;
}

function 构建MVU正文对象行列表_V1(对象 = {}, 最大条目数 = 8, 最大深度 = 2) {
  if (!对象 || typeof 对象 !== 'object' || Array.isArray(对象)) return [];
  return Object.entries(对象)
    .slice(0, Math.max(1, 最大条目数))
    .map(([键, 值]) => 构建MVU正文普通行_V1(键, 值, 最大深度))
    .filter(Boolean);
}

function 构建MVU正文武魂基础行_V1(武魂键 = '', 武魂 = {}) {
  const 片段列表 = [];
  const 表象名称 = 格式化MVU正文提示原子值_V1(武魂?.表象名称 || 武魂?.名称 || '');
  if (表象名称) 片段列表.push(表象名称);
  const 系别 = 格式化MVU正文提示原子值_V1(武魂?.系别);
  if (系别) 片段列表.push(系别);
  添加MVU正文键值片段_V1(片段列表, '描述', 武魂?.描述, 1);
  return 片段列表.length ? `- ${取MVU正文武魂显示名_V1(武魂键)}：${片段列表.join('；')}` : '';
}

function 构建MVU正文魂灵行_V1(魂灵键 = '', 魂灵 = {}) {
  const 片段列表 = [];
  const 表象名称 = 格式化MVU正文提示原子值_V1(魂灵?.表象名称 || 魂灵?.名称 || '');
  if (表象名称) 片段列表.push(表象名称);
  添加MVU正文键值片段_V1(片段列表, '年限', 魂灵?.年限, 1);
  添加MVU正文键值片段_V1(片段列表, '契合度', 魂灵?.契合度, 1);
  添加MVU正文键值片段_V1(片段列表, '状态', 魂灵?.状态, 1);
  添加MVU正文键值片段_V1(片段列表, '对标等级', 魂灵?.战力面板?.对标等级, 1);
  return 片段列表.length ? `- ${魂灵键}：${片段列表.join('；')}` : '';
}

function 构建MVU正文魂技文本_V1(魂技 = {}) {
  const 魂技名 = 格式化MVU正文提示原子值_V1(魂技?.魂技名 || 魂技?.name);
  const 效果 = 格式化MVU正文提示原子值_V1(魂技?.效果描述 || 魂技?.描述);
  const 画面 = 格式化MVU正文提示原子值_V1(魂技?.画面描述);
  const 产物 = 格式化MVU正文提示原子值_V1(魂技?.产物描述);
  const 片段列表 = [];
  if (魂技名) 片段列表.push(`魂技=${魂技名}`);
  if (效果) 片段列表.push(`效果=${效果}`);
  if (画面) 片段列表.push(`画面=${画面}`);
  if (产物) 片段列表.push(`产物=${产物}`);
  return 片段列表.join('；');
}

function 构建MVU正文魂环行列表_V1(魂环键 = '', 魂环 = {}) {
  const 基础片段 = [];
  const 年限 = 格式化MVU正文提示原子值_V1(魂环?.年限);
  const 颜色 = 格式化MVU正文提示原子值_V1(魂环?.颜色);
  if (年限) 基础片段.push(`${年限}年`);
  if (颜色) 基础片段.push(颜色);
  const 基础文本 = `${魂环键}：${基础片段.join('/') || '魂环'}`;
  const 魂技行 = 取魂环魂技条目_V1(魂环)
    .map(([魂技键, 魂技]) => {
      const 魂技文本 = 构建MVU正文魂技文本_V1(魂技);
      return 魂技文本 ? `- ${基础文本}；${魂技文本}` : '';
    })
    .filter(Boolean);
  return 魂技行.length ? 魂技行 : [`- ${基础文本}`];
}

function 构建MVU正文武魂魂技行列表_V1(角色 = {}) {
  const 行列表 = [];
  取角色武魂条目_V1(角色).forEach(([武魂键, 武魂]) => {
    const 武魂行 = 构建MVU正文武魂基础行_V1(武魂键, 武魂);
    if (武魂行) 行列表.push(武魂行);
    取武魂魂灵条目_V1(武魂).forEach(([魂灵键, 魂灵]) => {
      const 魂灵行 = 构建MVU正文魂灵行_V1(魂灵键, 魂灵);
      if (魂灵行) 行列表.push(魂灵行);
      取魂灵魂环条目_V1(魂灵).forEach(([魂环键, 魂环]) => {
        行列表.push(...构建MVU正文魂环行列表_V1(魂环键, 魂环));
      });
    });
    取武魂直接魂环条目_V1(武魂).forEach(([魂环键, 魂环]) => {
      行列表.push(...构建MVU正文魂环行列表_V1(魂环键, 魂环));
    });
  });
  return 行列表;
}

function MVU正文装备内容有效_V1(值, 字段 = '') {
  if (值 === undefined || 值 === null) return false;
  if (字段 === '品质系数' || 字段 === '_已排异') return false;
  if (typeof 值 === 'string') {
    const 文本 = 值.trim();
    return 正文视图值已初始化_V1(文本) && 文本 !== '未装备';
  }
  if (typeof 值 === 'number') return Number.isFinite(值) && Number(值) !== 0;
  if (typeof 值 === 'boolean') return 值 === true;
  if (Array.isArray(值)) return 值.some(项 => MVU正文装备内容有效_V1(项));
  if (typeof 值 === 'object') {
    return Object.entries(值).some(([子字段, 子值]) => MVU正文装备内容有效_V1(子值, 子字段));
  }
  return false;
}

function 清理MVU正文装备槽_V1(装备槽 = null) {
  if (!装备槽 || typeof 装备槽 !== 'object' || Array.isArray(装备槽)) return undefined;
  const 装备数据 = cloneJsonValue(装备槽, {});
  const 已装备 = String(装备数据.装备状态 || '').trim() === '已装备';
  const 有有效内容 = Object.entries(装备数据).some(([字段, 值]) => 字段 !== '装备状态' && MVU正文装备内容有效_V1(值, 字段));
  return 已装备 || 有有效内容 ? 装备数据 : undefined;
}

function 构建MVU正文装备摘要_V1(装备 = {}) {
  const 输出 = {};
  [['武器', 装备.武器], ['防具', 装备.防具], ['斗铠', 装备.斗铠], ['机甲', 装备.机甲]].forEach(([槽位, 数据]) => {
    const 清理后 = 清理MVU正文装备槽_V1(数据);
    if (清理后) 输出[槽位] = 清理后;
  });
  return 输出;
}

function 构建MVU正文装备背包行列表_V1(角色 = {}) {
  const 装备 = 角色?.装备 && typeof 角色.装备 === 'object' ? 角色.装备 : {};
  const 装备摘要 = 构建MVU正文装备摘要_V1(装备);
  return [
    构建MVU正文普通行_V1('装备', 装备摘要, 2),
    构建MVU正文普通行_V1('背包', 角色?.背包, 2),
  ].filter(Boolean);
}

function 构建MVU正文任务行列表_V1(角色 = {}) {
  return [
    ...构建MVU正文对象行列表_V1(角色?.我的任务, 6, 2),
  ];
}

function 构建MVU正文身份关系行列表_V1(角色 = {}) {
  return [
    构建MVU正文普通行_V1('身份', 构建MVU正文身份摘要_V1(角色), 2),
    构建MVU正文普通行_V1('势力', 构建MVU正文势力摘要_V1(角色), 2),
    构建MVU正文普通行_V1('关系', 构建MVU正文关系摘要_V1(角色), 2),
    构建MVU正文普通行_V1('称号', 构建MVU正文称号摘要_V1(角色), 2),
    构建MVU正文普通行_V1('关系分析', 构建MVU正文关系分析摘要_V1(角色), 2),
  ].filter(Boolean);
}

function 构建MVU正文武魂融合技行列表_V1(融合摘要 = {}) {
  return Object.entries(融合摘要 || {}).map(([技能名, 摘要]) => 构建MVU正文普通行_V1(技能名, 摘要, 2)).filter(Boolean);
}

function 构建MVU正文场景行列表_V1(正文视图 = {}) {
  const 场景表 = {
    ...(正文视图.world?.地点 && typeof 正文视图.world.地点 === 'object' ? 正文视图.world.地点 : {}),
    ...(正文视图.world?.动态地点 && typeof 正文视图.world.动态地点 === 'object' ? 正文视图.world.动态地点 : {}),
  };
  return Object.entries(场景表).map(([名称, 场景]) => {
    if (!场景 || typeof 场景 !== 'object') return '';
    const 片段列表 = [];
    ['类型', '掌控势力', '势力', '归属父节点', '人口', '守护军团', '描述', '状态'].forEach(字段 => {
      添加MVU正文键值片段_V1(片段列表, 字段, 场景[字段], 1);
    });
    const 子节点列表 = 场景.子节点 && typeof 场景.子节点 === 'object' && !Array.isArray(场景.子节点)
      ? Object.keys(场景.子节点).filter(Boolean).slice(0, 12)
      : [];
    if (子节点列表.length) 片段列表.push(`子节点=${子节点列表.join('/')}`);
    return 片段列表.length ? `- ${名称}：${片段列表.join('；')}` : '';
  }).filter(Boolean);
}

function 构建MVU正文情报可见度行列表_V1(情报可见度 = {}) {
  const 观察者列表 = Array.isArray(情报可见度?.观察者) ? 情报可见度.观察者 : [];
  return 观察者列表.flatMap(观察者项 => {
    const 观察者名 = 格式化MVU正文提示原子值_V1(观察者项?.观察者);
    if (!观察者名) return [];
    return Object.entries(观察者项?.可见 || {}).map(([状态, 分组]) => {
      const 目标列表 = Array.isArray(分组?.目标) ? 分组.目标.map(目标 => 格式化MVU正文提示原子值_V1(目标)).filter(Boolean) : [];
      if (!目标列表.length) return '';
      const 依据 = Array.isArray(分组?.依据) ? 分组.依据.map(项 => 格式化MVU正文提示原子值_V1(项)).filter(Boolean).slice(0, 3).join('；') : '';
      return `- ${观察者名} -> ${目标列表.join('/')}：${状态}${依据 ? `；依据=${依据}` : ''}`;
    }).filter(Boolean);
  });
}

var MVU角色卡排除路径_V1 = Object.freeze([
  '状态.横坐标',
  '状态.纵坐标',
  '状态.吸收灵物年限',
  '__mvu_isPlayer',
  '__mvu_显式天赋梯队',
]);

function 创建MVU角色卡覆盖记录器_V1() {
  const 覆盖路径 = new Set();
  const 覆盖子树 = new Set();
  const 排除路径 = new Set(MVU角色卡排除路径_V1);
  const 路径文本 = 路径 => (Array.isArray(路径) ? 路径 : [路径]).map(段 => String(段 || '').trim()).filter(Boolean).join('.');
  return {
    覆盖路径,
    覆盖子树,
    排除路径,
    mark(路径) {
      const 文本 = 路径文本(路径);
      if (文本) 覆盖路径.add(文本);
    },
    markMany(路径列表 = []) {
      路径列表.forEach(路径 => this.mark(路径));
    },
    markSubtree(路径) {
      const 文本 = 路径文本(路径);
      if (文本) 覆盖子树.add(文本);
    },
    isExcluded(路径) {
      const 文本 = 路径文本(路径);
      if (!文本) return false;
      if (排除路径.has(文本)) return true;
      return 文本.split('.').some((_, 索引, 列表) => 排除路径.has(列表.slice(0, 索引 + 1).join('.')));
    },
    isCovered(路径) {
      const 文本 = 路径文本(路径);
      if (!文本) return false;
      if (覆盖路径.has(文本)) return true;
      return Array.from(覆盖子树).some(前缀 => 文本 === 前缀 || 文本.startsWith(`${前缀}.`));
    },
  };
}

function 转义MVU角色卡表格单元_V1(值 = '') {
  const 文本 = 格式化MVU正文提示值_V1(值, 2);
  return String(文本 || '').replace(/\|/g, '/').replace(/[\r\n]+/g, ' ').trim();
}

function 添加MVU角色卡表格行_V1(行列表 = [], 行 = {}, 覆盖器 = null, 路径列表 = []) {
  if (!行 || typeof 行 !== 'object') return false;
  const 有效 = Object.entries(行).some(([键, 值]) => 键 !== '角色' && 转义MVU角色卡表格单元_V1(值));
  if (!有效) return false;
  行列表.push(行);
  if (覆盖器) 覆盖器.markMany(路径列表);
  return true;
}

function 渲染MVU角色卡表格_V1(标题 = '', 表头 = [], 行列表 = []) {
  const 有效行 = (Array.isArray(行列表) ? 行列表 : []).filter(行 => 行 && typeof 行 === 'object');
  if (!有效行.length) return '';
  const 原表头 = 表头.map(列 => String(列 || '').trim()).filter(Boolean);
  const 头 = 原表头.filter((列, 索引) => 索引 === 0 || 有效行.some(行 => 转义MVU角色卡表格单元_V1(行[列])));
  if (!头.length) return '';
  const 表格行 = [
    `【${标题}】`,
    `| ${头.join(' | ')} |`,
    `| ${头.map(() => '---').join(' | ')} |`,
    ...有效行.map(行 => `| ${头.map(列 => 转义MVU角色卡表格单元_V1(行[列])).join(' | ')} |`),
  ];
  return 表格行.join('\n');
}

function 构建MVU武魂与魂技文本_V1(武魂概览行 = [], 魂技行 = []) {
  const 角色表 = new Map();
  const 取角色 = 角色名 => {
    const 名称 = String(角色名 || '').trim();
    if (!名称) return null;
    if (!角色表.has(名称)) 角色表.set(名称, { 武魂: new Map() });
    return 角色表.get(名称);
  };
  const 取武魂 = (角色, 键, 基础 = {}) => {
    const 武魂键 = String(键 || '').trim();
    if (!角色 || !武魂键) return null;
    if (!角色.武魂.has(武魂键)) 角色.武魂.set(武魂键, { ...基础, 魂技: [] });
    else Object.assign(角色.武魂.get(武魂键), Object.fromEntries(Object.entries(基础).filter(([, 值]) => 值 !== undefined && 值 !== null && 值 !== '')));
    return 角色.武魂.get(武魂键);
  };
  (Array.isArray(武魂概览行) ? 武魂概览行 : []).forEach(行 => {
    const 角色 = 取角色(行?.角色);
    const 槽位 = String(行?.武魂槽位 || '').trim();
    const 名称 = String(行?.名称 || '').trim();
    const 键 = [槽位, 名称].filter(Boolean).join('：');
    取武魂(角色, 键, {
      槽位: 槽位 || '武魂',
      名称,
      系别: 行?.系别,
      属性体系: 行?.属性体系,
      容纳属性: 行?.容纳属性,
      描述: 行?.描述,
    });
  });
  (Array.isArray(魂技行) ? 魂技行 : []).forEach(行 => {
    const 角色 = 取角色(行?.角色);
    const 键 = String(行?.武魂 || '').trim();
    if (!角色 || !键) return;
    const 分隔位置 = 键.indexOf('：');
    const 槽位 = 分隔位置 >= 0 ? 键.slice(0, 分隔位置).trim() : 键;
    const 名称 = 分隔位置 >= 0 ? 键.slice(分隔位置 + 1).trim() : '';
    const 武魂 = 取武魂(角色, 键, { 槽位, 名称 });
    武魂.魂技.push(行);
  });
  if (!角色表.size) return '';
  const 输出 = ['【武魂与魂技】'];
  角色表.forEach((角色, 角色名) => {
    输出.push('', `【角色武魂开始：${角色名}】`);
    角色.武魂.forEach(武魂 => {
      const 槽位 = String(武魂.槽位 || '武魂').trim();
      const 名称 = String(武魂.名称 || '').trim();
      输出.push('', `${槽位}${名称 ? `：${名称}` : ''}`);
      [
        ['系别', 武魂.系别],
        ['属性体系', 武魂.属性体系],
        ['容纳属性', 武魂.容纳属性],
        ['描述', 武魂.描述],
      ].forEach(([字段, 值]) => {
        const 文本 = 转义MVU角色卡表格单元_V1(值);
        if (文本) 输出.push(`${字段}：${文本}`);
      });
      const 魂灵分组 = new Map();
      (Array.isArray(武魂.魂技) ? 武魂.魂技 : []).forEach(魂技 => {
        const 魂灵 = String(魂技?.魂灵 || '').trim();
        if (!魂灵分组.has(魂灵)) 魂灵分组.set(魂灵, []);
        魂灵分组.get(魂灵).push(魂技);
      });
      魂灵分组.forEach((技能列表, 魂灵) => {
        if (魂灵) {
          const 魂灵文本 = 魂灵.replace(/^(\S+)\s+/, '$1：');
          输出.push('', 魂灵文本);
        }
        技能列表.forEach(魂技 => {
          const 魂环 = String(魂技?.魂环 || '').trim();
          const 魂技名 = String(魂技?.魂技 || '').trim();
          输出.push('', `- ${[角色名, 槽位, 魂环, 魂技名].filter(Boolean).join('｜')}`);
          [
            ['效果', 魂技?.效果],
            ['画面', 魂技?.画面],
            ['产物', 魂技?.产物],
            ['备注', 魂技?.备注],
          ].forEach(([字段, 值]) => {
            const 文本 = 转义MVU角色卡表格单元_V1(值);
            if (文本) 输出.push(`  ${字段}：${文本}`);
          });
        });
      });
    });
    输出.push('', `【角色武魂结束：${角色名}】`);
  });
  return 输出.join('\n');
}

function 取MVU角色卡有效坐标_V1(角色 = {}) {
  const x = Number(角色?.状态?.横坐标);
  const y = Number(角色?.状态?.纵坐标);
  return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 ? { x, y } : null;
}

function 构建MVU角色卡地点描述_V1(角色 = {}, 主角 = null) {
  const 位置 = 格式化MVU正文提示原子值_V1(角色?.状态?.位置);
  if (!主角 || 主角 === 角色) return 位置;
  const 角色坐标 = 取MVU角色卡有效坐标_V1(角色);
  const 主角坐标 = 取MVU角色卡有效坐标_V1(主角);
  if (!角色坐标 || !主角坐标) return 位置;
  const 距离 = Math.hypot(角色坐标.x - 主角坐标.x, 角色坐标.y - 主角坐标.y);
  if (!Number.isFinite(距离)) return 位置;
  const 相对 = 距离 < 0.5 ? '与主角同坐标' : `距主角步行约${格式化运行时tick跨度文本_V1(Math.max(1, Math.floor(距离 * 1.5)))}`;
  return [位置, 相对].filter(Boolean).join('；');
}

function 收集MVU角色卡有效叶子路径_V1(值, 当前路径 = [], 输出 = []) {
  if (!正文视图值已初始化_V1(值)) return 输出;
  if (Array.isArray(值)) {
    if (!值.length) return 输出;
    输出.push({ 路径: 当前路径.join('.'), 值 });
    return 输出;
  }
  if (值 && typeof 值 === 'object') {
    const 条目 = Object.entries(值 || {});
    if (!条目.length) return 输出;
    条目.forEach(([键, 子值]) => 收集MVU角色卡有效叶子路径_V1(子值, [...当前路径, 键], 输出));
    return 输出;
  }
  输出.push({ 路径: 当前路径.join('.'), 值 });
  return 输出;
}

function 构建MVU角色卡魂核摘要_V1(角色 = {}) {
  const 核心 = 角色?.魂核?.核心 && typeof 角色.魂核.核心 === 'object' ? 角色.魂核.核心 : null;
  if (!核心) return '';
  const 数量 = Number(核心.数量);
  const 进度 = Number(核心.进度);
  const 片段 = [];
  if (Number.isFinite(数量) && 数量 > 0) 片段.push(`魂核数量:${数量}`);
  if (Number.isFinite(进度) && 进度 > 0) 片段.push(`下一魂核进度:${进度}%`);
  return 片段.join('；');
}

function 清理MVU角色卡持有状态详情_V1(值 = null) {
  if (!值 || typeof 值 !== 'object') return 值;
  const 副本 = cloneJsonValue(值, 值);
  const 清理 = 节点 => {
    if (!节点 || typeof 节点 !== 'object') return;
    if (Array.isArray(节点)) {
      节点.forEach(清理);
      return;
    }
    ['描述', '效果描述', '画面描述', '产物描述', '背景', '说明'].forEach(字段 => delete 节点[字段]);
    Object.values(节点).forEach(清理);
  };
  清理(副本);
  return 副本;
}

function 构建MVU角色卡物品定义摘要_V1(物品名 = '', 物品定义源 = {}) {
  const 名称 = String(物品名 || '').trim();
  if (!名称 || typeof 查找运行时物品定义_V1 !== 'function') return '';
  const 定义 = 查找运行时物品定义_V1({ 物品: 物品定义源 || {} }, 名称)?.定义 || null;
  if (!定义 || typeof 定义 !== 'object') return '';
  return {
    分类: 定义.类型 || 定义.分类 || 定义.物品分类,
    品质: 定义.品质 || 定义.品级,
    描述: 定义.描述,
    效果: 定义.效果描述 || 定义.效果,
  };
}

function 构建MVU角色卡表格数据_V1(角色表 = {}, 当前tick = null, 物品定义源 = {}) {
  const 覆盖器 = 创建MVU角色卡覆盖记录器_V1();
  const 覆盖统计 = { 有效字段数: 0, 排除字段数: 0, 扩展字段数: 0, 遗漏字段数: 0 };
  const 表 = {
    基础: [],
    现场: [],
    武魂概览: [],
    血脉状态: [],
    武魂: [],
    副职业: [],
    功法: [],
    自创魂技: [],
    精神领域: [],
    复制效果: [],
    武魂融合技: [],
    关系: [],
    势力: [],
    称号: [],
    装备: [],
    魂骨: [],
    背包: [],
    财富: [],
    任务: [],
    情报: [],
    战斗历史: [],
    私密档案: [],
    扩展: [],
  };
  const 角色名集合 = new Set(Object.keys(角色表 || {}).filter(角色名 => 角色表?.[角色名] && typeof 角色表[角色名] === 'object'));
  const 主角 = Object.values(角色表 || {}).find(角色 => 角色 && typeof 角色 === 'object' && 角色.__mvu_isPlayer === true) || null;
  Object.entries(角色表 || {}).forEach(([角色名, 角色]) => {
    if (!角色 || typeof 角色 !== 'object') return;
    const 属性 = 角色.属性 && typeof 角色.属性 === 'object' ? 角色.属性 : {};
    const 社交 = 角色.社交 && typeof 角色.社交 === 'object' ? 角色.社交 : {};
    添加MVU角色卡表格行_V1(表.基础, {
      角色: 角色名,
      性别: 属性.性别,
      年龄: 格式化年龄岁月文本_V1(属性.年龄, 属性.生日, 当前tick),
      生日: 属性.生日,
      等级: Number.isFinite(Number(属性.等级)) ? `Lv${属性.等级}` : '',
      精神境界: 属性.精神境界,
      魂核: 构建MVU角色卡魂核摘要_V1(角色),
      主身份: 社交.主身份,
      家世: 社交.家世描述,
      外貌: 角色.外貌,
      穿搭: 角色.穿搭,
      性格: 角色.性格,
      名望: [社交.名望等级, 社交.声望 ? `声望${社交.声望}` : ''].filter(Boolean).join(' '),
      邪魂师: 属性.邪魂师 === true ? '是' : '否',
    }, 覆盖器, ['属性.性别', '属性.年龄', '属性.生日', '属性.等级', '属性.精神境界', '属性.邪魂师', '社交.主身份', '社交.家世描述', '外貌', '穿搭', '性格', '社交.名望等级', '社交.声望']);
    ['外貌', '穿搭', '性格', '魂核'].forEach(字段 => 覆盖器.markSubtree(字段));
    const 状态摘要 = 构建MVU正文状态摘要_V1(角色);
    添加MVU角色卡表格行_V1(表.现场, {
      角色: 角色名,
      当前地点: 构建MVU角色卡地点描述_V1(角色, 主角),
      生死: 角色?.状态?.存活 === false ? '死亡' : '',
      死亡类型: 角色?.状态?.死亡类型,
      伤势: 角色?.状态?.受伤部位,
      当前状态: Object.fromEntries(Object.entries(状态摘要 || {}).filter(([键]) => !['位置', '横坐标', '纵坐标', '吸收灵物年限', '剩余资源', '受伤部位'].includes(键))),
      剩余资源: 状态摘要.剩余资源,
    }, 覆盖器, ['状态.位置', '状态.存活', '状态.死亡类型', '状态.受伤部位', '属性.HP', '属性.HP上限', '属性.魂力', '属性.魂力上限', '属性.精神力', '属性.精神力上限', '属性.体力', '属性.体力上限']);
    取角色武魂条目_V1(角色).forEach(([武魂键, 武魂]) => {
      const 武魂名 = 格式化MVU正文提示原子值_V1(武魂?.表象名称 || 武魂?.名称 || '');
      const 武魂显示名 = [取MVU正文武魂显示名_V1(武魂键), 武魂名].filter(Boolean).join('：');
      添加MVU角色卡表格行_V1(表.武魂概览, {
        角色: 角色名,
        武魂槽位: 取MVU正文武魂显示名_V1(武魂键),
        名称: 武魂名,
        系别: 武魂?.系别,
        属性体系: 武魂?.属性体系,
        容纳属性: 武魂?.可调用元素,
        描述: 武魂?.描述,
      }, 覆盖器, []);
      取武魂魂灵条目_V1(武魂).forEach(([魂灵键, 魂灵]) => {
        const 魂灵文本 = [魂灵?.表象名称 || 魂灵?.名称, 魂灵?.年限 ? `${魂灵.年限}年` : '', 魂灵?.状态].filter(Boolean).join(' ');
        取魂灵魂环条目_V1(魂灵).forEach(([魂环键, 魂环]) => {
          取魂环魂技条目_V1(魂环).forEach(([魂技键, 魂技]) => {
            添加MVU角色卡表格行_V1(表.武魂, { 角色: 角色名, 武魂: 武魂显示名, 魂灵: [魂灵键, 魂灵文本].filter(Boolean).join(' '), 魂环: [魂环键, 魂环?.年限 ? `${魂环.年限}年` : '', 魂环?.颜色].filter(Boolean).join(' '), 魂技: 魂技?.魂技名 || 魂技?.name || 魂技键, 效果: 魂技?.效果描述 || 魂技?.描述, 画面: 魂技?.画面描述, 产物: 魂技?.产物描述, 备注: '' }, 覆盖器, []);
          });
        });
      });
      取武魂直接魂环条目_V1(武魂).forEach(([魂环键, 魂环]) => {
        const 魂技条目 = 取魂环魂技条目_V1(魂环);
        魂技条目.forEach(([魂技键, 魂技]) => {
          添加MVU角色卡表格行_V1(表.武魂, { 角色: 角色名, 武魂: 武魂显示名, 魂灵: '', 魂环: [魂环键, 魂环?.年限 ? `${魂环.年限}年` : '', 魂环?.颜色].filter(Boolean).join(' '), 魂技: 魂技?.魂技名 || 魂技?.name || 魂技键, 效果: 魂技?.效果描述 || 魂技?.描述, 画面: 魂技?.画面描述, 产物: 魂技?.产物描述, 备注: '' }, 覆盖器, []);
        });
      });
      覆盖器.markSubtree(武魂键);
    });
    const 血脉之力 = 角色?.血脉之力 && typeof 角色.血脉之力 === 'object' ? 角色.血脉之力 : null;
    if (血脉之力) {
      const 血脉名 = 血脉之力.血脉 || 血脉之力.名称;
      const 血脉显示名 = ['血脉之力', 血脉名].filter(Boolean).join('：');
      const 是金龙王血脉 = String(血脉名 || '').trim() === '金龙王';
      添加MVU角色卡表格行_V1(表.血脉状态, { 角色: 角色名, 血脉: 血脉名, 系别: 血脉之力.系别 || (是金龙王血脉 ? '强攻系' : ''), 属性体系: 血脉之力.属性体系, 容纳属性: 血脉之力.可调用元素, 显化状态: 血脉之力.状态, 凝聚核心: 血脉之力.核心, 描述: 血脉之力.描述 || 血脉之力.效果描述 || (是金龙王血脉 ? '一种带有金色龙鳞特征的未知血脉，日常处于被封印状态，但能赋予宿主恐怖的气血总量和极致的肉体力量' : '') }, 覆盖器, []);
      ['技能', '被动'].forEach(分组 => {
        Object.entries(血脉之力[分组] || {}).forEach(([魂技键, 魂技]) => {
          添加MVU角色卡表格行_V1(表.武魂, { 角色: 角色名, 武魂: 血脉显示名, 魂灵: '', 魂环: 分组, 魂技: 魂技?.魂技名 || 魂技?.name || 魂技键, 效果: 魂技?.效果描述 || 魂技?.描述, 画面: 魂技?.画面描述, 产物: 魂技?.产物描述, 备注: '' }, 覆盖器, []);
        });
      });
      取血脉气血魂环条目_V1(血脉之力).forEach(([魂环键, 魂环]) => {
        取气血魂环魂技条目_V1(魂环).forEach(([魂技键, 魂技]) => {
          添加MVU角色卡表格行_V1(表.武魂, { 角色: 角色名, 武魂: 血脉显示名, 魂灵: '', 魂环: [魂环键, 魂环?.年限 ? `${魂环.年限}年` : '', 魂环?.颜色].filter(Boolean).join(' '), 魂技: 魂技?.魂技名 || 魂技?.name || 魂技键, 效果: 魂技?.效果描述 || 魂技?.描述, 画面: 魂技?.画面描述, 产物: 魂技?.产物描述, 备注: '' }, 覆盖器, []);
        });
      });
      覆盖器.markSubtree('血脉之力');
    }
    Object.entries(构建MVU正文副职业摘要_V1(角色)).forEach(([副职业, 内容]) => 添加MVU角色卡表格行_V1(表.副职业, { 角色: 角色名, 副职业, 等级: 内容?.等级, 经验: 内容?.经验, 称号: 内容?.称号, 核心技艺: 内容?.核心技艺, 支持融锻数: 内容?.支持融锻数, 基础成功率: 内容?.基础成功率 }, 覆盖器, []));
    Object.entries(角色?.功法 || {}).forEach(([功法, 内容]) => 添加MVU角色卡表格行_V1(表.功法, { 角色: 角色名, 功法, 详情: 内容 }, 覆盖器, []));
    if (角色?.功法) 覆盖器.markSubtree('功法');
    Object.entries(角色?.自创魂技 || {}).forEach(([魂技, 内容]) => 添加MVU角色卡表格行_V1(表.自创魂技, { 角色: 角色名, 魂技, 效果: 内容?.效果描述 || 内容?.描述, 画面: 内容?.画面描述, 产物: 内容?.产物描述, 详情: 内容 }, 覆盖器, []));
    if (角色?.自创魂技) 覆盖器.markSubtree('自创魂技');
    if (角色?.精神领域 && typeof 角色.精神领域 === 'object') {
      添加MVU角色卡表格行_V1(表.精神领域, { 角色: 角色名, 领域: 角色.精神领域.名称, 描述: 角色.精神领域.描述, 详情: 角色.精神领域 }, 覆盖器, []);
      覆盖器.markSubtree('精神领域');
    }
    Object.entries(角色?.复制效果 || {}).forEach(([复制项, 内容]) => 添加MVU角色卡表格行_V1(表.复制效果, { 角色: 角色名, 复制项, 当前复制: 内容?.当前复制, 描述: 内容?.描述, 详情: 内容 }, 覆盖器, []));
    if (角色?.复制效果) 覆盖器.markSubtree('复制效果');
    Object.entries(构建MVU正文武魂融合技摘要_V1(角色名, 角色, 角色表)).forEach(([融合技, 内容]) => 添加MVU角色卡表格行_V1(表.武魂融合技, { 角色: 角色名, 融合技, 详情: 内容 }, 覆盖器, []));
    if (角色?.副职业) 覆盖器.markSubtree('副职业');
    if (角色?.武魂融合技) 覆盖器.markSubtree('武魂融合技');
    Object.entries(社交.关系 || {}).forEach(([对象, 关系]) => {
      添加MVU角色卡表格行_V1(表.关系, { 角色: 角色名, 对象, 关系: 关系?.关系, 好感度: 关系?.好感度, 路线: 关系?.关系路线, 阶段: 关系?._关系阶段, 推进提示: 关系?._推进提示 }, 覆盖器, []);
    });
    覆盖器.markSubtree('社交.关系');
    覆盖器.markSubtree('社交.关系分析');
    Object.entries(社交.势力 || {}).forEach(([势力, 数据]) => 添加MVU角色卡表格行_V1(表.势力, { 角色: 角色名, 势力, 身份: 数据?.身份, 权限: 数据?.权限级 }, 覆盖器, []));
    Object.entries(社交.称号 || {}).forEach(([称号, 数据]) => 添加MVU角色卡表格行_V1(表.称号, { 角色: 角色名, 称号, 来源: 数据?.来源, 声望加成: 数据?.声望加成 }, 覆盖器, []));
    覆盖器.markSubtree('社交.势力');
    覆盖器.markSubtree('社交.称号');
    const 已占用物品名 = new Set();
    Object.entries(构建MVU正文装备摘要_V1(角色?.装备 || {})).forEach(([槽位, 内容]) => {
      if (内容?.名称) 已占用物品名.add(String(内容.名称).trim());
      添加MVU角色卡表格行_V1(表.装备, { 角色: 角色名, 装备槽: 槽位, 装备状态: 内容?.装备状态, 等级: 内容?.等级, 品质: 内容?.品质, 名称: 内容?.名称, 详情: 清理MVU角色卡持有状态详情_V1(内容), 定义: 构建MVU角色卡物品定义摘要_V1(内容?.名称, 物品定义源) }, 覆盖器, []);
    });
    Object.entries(角色?.魂骨 || {}).forEach(([名称, 内容]) => {
      已占用物品名.add(String(名称 || '').trim());
      if (内容?.名称) 已占用物品名.add(String(内容.名称).trim());
      添加MVU角色卡表格行_V1(表.魂骨, { 角色: 角色名, 魂骨: 名称, 部位: 内容?.部位, 年限: 内容?.年限, 状态: 内容?.装备状态 || 内容?.状态, 技能: 清理MVU角色卡持有状态详情_V1(内容?.附带技能), 详情: 清理MVU角色卡持有状态详情_V1(内容), 定义: 构建MVU角色卡物品定义摘要_V1(内容?.名称 || 名称, 物品定义源) }, 覆盖器, []);
    });
    Object.entries(角色?.背包 || {}).forEach(([名称, 内容]) => {
      if (已占用物品名.has(String(名称 || '').trim())) return;
      添加MVU角色卡表格行_V1(表.背包, { 角色: 角色名, 物品: 名称, 数量: 内容?.数量, 批次: 清理MVU角色卡持有状态详情_V1(内容?.批次) }, 覆盖器, []);
    });
    Object.entries(构建MVU正文财富摘要_V1(角色)).forEach(([名称, 内容]) => 添加MVU角色卡表格行_V1(表.财富, { 角色: 角色名, 项目: 名称, 数量: 内容 }, 覆盖器, []));
    ['装备', '魂骨', '背包', '财富'].forEach(字段 => 覆盖器.markSubtree(字段));
    Object.entries(角色?.我的任务 || {}).forEach(([任务, 内容]) => 添加MVU角色卡表格行_V1(表.任务, { 角色: 角色名, 任务, 任务线: 内容?.任务线, 状态: 内容?.状态, 进度: 内容?.当前进度, 描述: 内容?.描述, 截止tick: 内容?.截止tick, 奖励币: 内容?.奖励币, 奖励声望: 内容?.奖励声望 }, 覆盖器, []));
    (Array.isArray(角色?.已掌握情报) ? 角色.已掌握情报 : []).forEach((内容, 索引) => 添加MVU角色卡表格行_V1(表.情报, { 角色: 角色名, 条目: `情报${索引 + 1}`, 内容 }, 覆盖器, []));
    Object.entries(角色?.战斗历史 || {}).forEach(([对象, 内容]) => {
      if (!角色名集合.has(对象)) return;
      添加MVU角色卡表格行_V1(表.战斗历史, { 角色: 角色名, 对象, 次数: 内容?.次数, 胜: 内容?.胜, 负: 内容?.负, 平: 内容?.平, 最近结果: 内容?.最近结果, 最近tick: 内容?.最近tick }, 覆盖器, []);
    });
    ['我的任务', '任务', '已掌握情报', '魂灵塔记录', '战斗历史'].forEach(字段 => 覆盖器.markSubtree(字段));
    const 私密档案 = 角色?.私密档案 && typeof 角色.私密档案 === 'object' ? 角色.私密档案 : null;
    if (私密档案) {
      添加MVU角色卡表格行_V1(表.私密档案, {
        角色: 角色名,
        发情度: 私密档案.发情度,
        敏感度: 私密档案.敏感度,
        开发度: 私密档案.开发度,
        性癖: 私密档案.性癖,
        性幻想: 私密档案.性幻想,
        受孕: [私密档案.受孕对象 && 私密档案.受孕对象 !== '无' ? `对象:${私密档案.受孕对象}` : '', 私密档案._怀孕天数 ? `怀孕${私密档案._怀孕天数}天` : '', 私密档案.受孕tick && Number(私密档案.受孕tick) > 0 ? `tick:${私密档案.受孕tick}` : ''].filter(Boolean).join('；'),
        生理: [私密档案._生理阶段, 私密档案._已来初潮 ? '已来初潮' : '', 私密档案.生理期偏移 ? `偏移:${私密档案.生理期偏移}` : ''].filter(Boolean).join('；'),
        身材: 私密档案.身材数据,
        身体部位: 私密档案.身体部位,
        贴身衣物: 私密档案.贴身衣物,
        经历次数: 私密档案.经历次数,
      }, 覆盖器, []);
      覆盖器.markSubtree('私密档案');
    }
    收集MVU角色卡有效叶子路径_V1(角色).forEach(({ 路径, 值 }) => {
      if (!路径) return;
      if (覆盖器.isExcluded(路径)) {
        覆盖统计.排除字段数 += 1;
        return;
      }
      if (覆盖器.isCovered(路径)) {
        覆盖统计.有效字段数 += 1;
        return;
      }
      if (添加MVU角色卡表格行_V1(表.扩展, { 角色: 角色名, 字段路径: 路径, 内容: 值 }, 覆盖器, [路径])) {
        覆盖统计.有效字段数 += 1;
        覆盖统计.扩展字段数 += 1;
      } else {
        覆盖统计.遗漏字段数 += 1;
      }
    });
  });
  return { 表, 覆盖率: 覆盖统计 };
}

function 构建MVU角色卡表格文本_V1(角色表 = {}, 当前tick = null, 物品定义源 = {}) {
  const { 表 } = 构建MVU角色卡表格数据_V1(角色表, 当前tick, 物品定义源);
  return [
    渲染MVU角色卡表格_V1('角色基础表', ['角色', '性别', '年龄', '生日', '等级', '精神境界', '魂核', '主身份', '家世', '外貌', '穿搭', '性格', '名望', '邪魂师'], 表.基础),
    渲染MVU角色卡表格_V1('角色状态表', ['角色', '当前地点', '生死', '死亡类型', '伤势', '当前状态', '剩余资源'], 表.现场),
    构建MVU武魂与魂技文本_V1(表.武魂概览, 表.武魂),
    渲染MVU角色卡表格_V1('血脉状态表', ['角色', '血脉', '系别', '属性体系', '容纳属性', '显化状态', '凝聚核心', '描述'], 表.血脉状态),
    渲染MVU角色卡表格_V1('副职业表', ['角色', '副职业', '等级', '经验', '称号', '核心技艺', '支持融锻数', '基础成功率'], 表.副职业),
    渲染MVU角色卡表格_V1('功法表', ['角色', '功法', '详情'], 表.功法),
    渲染MVU角色卡表格_V1('自创魂技表', ['角色', '魂技', '效果', '画面', '产物', '详情'], 表.自创魂技),
    渲染MVU角色卡表格_V1('精神领域表', ['角色', '领域', '描述', '详情'], 表.精神领域),
    渲染MVU角色卡表格_V1('复制效果表', ['角色', '复制项', '当前复制', '描述', '详情'], 表.复制效果),
    渲染MVU角色卡表格_V1('武魂融合技表', ['角色', '融合技', '详情'], 表.武魂融合技),
    渲染MVU角色卡表格_V1('社交关系表', ['角色', '对象', '关系', '好感度', '路线', '阶段', '推进提示'], 表.关系),
    渲染MVU角色卡表格_V1('势力身份表', ['角色', '势力', '身份', '权限'], 表.势力),
    渲染MVU角色卡表格_V1('称号表', ['角色', '称号', '来源', '声望加成'], 表.称号),
    渲染MVU角色卡表格_V1('装备表', ['角色', '装备槽', '装备状态', '等级', '品质', '名称', '详情', '定义'], 表.装备),
    渲染MVU角色卡表格_V1('魂骨表', ['角色', '魂骨', '部位', '年限', '状态', '技能', '详情', '定义'], 表.魂骨),
    渲染MVU角色卡表格_V1('背包物品表', ['角色', '物品', '数量', '批次'], 表.背包),
    渲染MVU角色卡表格_V1('财富表', ['角色', '项目', '数量'], 表.财富),
    渲染MVU角色卡表格_V1('任务表', ['角色', '任务', '任务线', '状态', '进度', '描述', '截止tick', '奖励币', '奖励声望'], 表.任务),
    渲染MVU角色卡表格_V1('已掌握情报表', ['角色', '条目', '内容'], 表.情报),
    渲染MVU角色卡表格_V1('战斗历史表', ['角色', '对象', '次数', '胜', '负', '平', '最近结果', '最近tick'], 表.战斗历史),
    渲染MVU角色卡表格_V1('私密档案表', ['角色', '发情度', '敏感度', '开发度', '性癖', '性幻想', '受孕', '生理', '身材', '身体部位', '贴身衣物', '经历次数'], 表.私密档案),
  ].filter(Boolean).join('\n\n') || '无';
}

function 生成MVU角色卡覆盖率检查_V1(数据输入 = null, userInput = '', plotText = '') {
  const 正文视图 = 生成MVU正文视图_V1(数据输入, userInput, plotText);
  const 当前tick = 正文视图?.world?.时间?.tick ?? null;
  const { 表, 覆盖率 } = 构建MVU角色卡表格数据_V1(正文视图?.char || {}, 当前tick);
  return {
    ...覆盖率,
    表行数: Object.fromEntries(Object.entries(表).map(([表名, 行列表]) => [表名, Array.isArray(行列表) ? 行列表.length : 0])),
  };
}

function 构建MVU正文角色卡_V1(角色名 = '', 角色 = {}, 正文角色表 = {}, 当前tick = null) {
  const 角色键 = String(角色名 || '').trim();
  return 角色键 ? 构建MVU角色卡表格文本_V1({ [角色键]: 角色 }, 当前tick) : '无';
}

function 生成MVU玩家角色表_V1(数据输入 = null) {
  const 数据根 = 读取运行时Mvu数据根或最新_V1(数据输入) || {};
  const 角色表 = 数据根?.char && typeof 数据根.char === 'object' ? 数据根.char : {};
  const 配置玩家名 = String(数据根?.sys?.玩家名 || '').trim();
  const 标记玩家名 = Object.entries(角色表).find(([, 角色]) => 角色 && typeof 角色 === 'object' && 角色.__mvu_isPlayer === true)?.[0] || '';
  const 玩家名 = 配置玩家名 && 角色表[配置玩家名] ? 配置玩家名 : 标记玩家名;
  const 玩家 = 数据根?.char?.[玩家名];
  if (!玩家名 || !玩家 || typeof 玩家 !== 'object') return '无';
  return 构建MVU正文角色卡_V1(玩家名, 玩家, 数据根.char || {}, 数据根?.world?.时间?.tick ?? null);
}

function 构建MVU正文角色卡主体行列表_V1(角色名 = '', 角色 = {}, 正文角色表 = {}, 当前tick = null) {
  return 构建MVU正文角色卡_V1(角色名, 角色, 正文角色表, 当前tick).split('\n');
}

function 构建MVU正文其他信息卡_V1(正文视图 = {}) {
  const 行列表 = ['【其他信息卡】'];
  添加MVU正文块_V1(行列表, '系统', [
    构建MVU正文普通行_V1('世界线日志', 正文视图.sys?.世界线日志, 1),
    构建MVU正文普通行_V1('时间', 正文视图.world?.时间?.当前, 1),
  ]);
  添加MVU正文块_V1(行列表, '场景', 构建MVU正文场景行列表_V1(正文视图));
  添加MVU正文块_V1(行列表, '情报可见度', 构建MVU正文情报可见度行列表_V1(正文视图.情报可见度));
  添加MVU正文块_V1(行列表, '物品', 构建MVU正文对象行列表_V1(正文视图.物品, 8, 2));
  添加MVU正文块_V1(行列表, '时间线', 构建MVU正文对象行列表_V1(正文视图.world?.时间线, 8, 2));
  添加MVU正文块_V1(行列表, '战斗', 构建MVU正文对象行列表_V1(正文视图.world?.战斗, 8, 2));
  Object.entries(正文视图.world || {}).forEach(([字段, 值]) => {
    if (['时间', '时间线', '战斗', '地点', '动态地点'].includes(字段)) return;
    添加MVU正文块_V1(行列表, 字段, 构建MVU正文对象行列表_V1(值, 8, 2));
  });
  return 行列表.length > 1 ? 行列表.join('\n') : '【其他信息卡】\n无';
}

function 生成MVU正文提示文本_V1(数据输入 = null, userInput = '', plotText = '', 已生成正文视图 = null) {
  const 正文视图 = 已生成正文视图 && typeof 已生成正文视图 === 'object'
    ? 已生成正文视图
    : 生成MVU正文视图_V1(数据输入, userInput, plotText);
  const 当前tick = 正文视图.world?.时间?.tick ?? null;
  const 数据根 = 读取运行时Mvu数据根_V1(数据输入) || 数据输入 || {};
  const 角色卡文本 = 构建MVU角色卡表格文本_V1(正文视图.char || {}, 当前tick, 数据根?.物品 || {});
  return [
    '【角色卡】',
    角色卡文本,
    构建MVU正文其他信息卡_V1(正文视图),
  ].filter(Boolean).join('\n\n');
}

function 生成MVU相互可见性视图_V1(数据输入 = null, userInput = '', 最后一条角色消息 = '') {
  const 数据根 = 读取运行时Mvu数据根或最新_V1(数据输入) || {};
  const 最后角色消息文本 = String(最后一条角色消息 || '').trim() || 读取运行时最后角色消息文本_V1();
  const 文本 = [最后角色消息文本, userInput].map(文本片段 => String(文本片段 || '').trim()).filter(Boolean).join('\n');
  const 运行时命中上下文 = 构建运行时命中上下文_V1(数据根, 文本);
  const 角色名集合 = 取运行时基础角色名集合_V1(数据根, 文本, {
    运行时命中名称: 运行时命中上下文.运行时命中名称,
  });
  const 情报可见度 = 构建运行时情报可见度索引_V1(数据根, 角色名集合);
  const 行列表 = 构建MVU正文情报可见度行列表_V1(情报可见度);
  return 行列表.length ? 行列表.join('\n') : '无';
}

var 角色基础六维对标字段_V1 = Object.freeze([
  Object.freeze({ 标签: '力量', 字段: '力量' }),
  Object.freeze({ 标签: '防御', 字段: '防御' }),
  Object.freeze({ 标签: '敏捷', 字段: '敏捷' }),
  Object.freeze({ 标签: '体力/气血', 字段: '体力上限' }),
  Object.freeze({ 标签: '精神力', 字段: '精神力上限' }),
]);

function 读取年龄段对标天赋档位_V1(年龄 = 0) {
  const 年龄值 = Math.max(0, Number(年龄 || 0));
  if (年龄值 < 9) return '正常';
  if (年龄值 < 13) return '优秀';
  if (年龄值 < 21) return '天才';
  return '顶级天才';
}

function 读取年龄对标天赋档位列表_V1(年龄 = 0) {
  const 年龄值 = Math.max(0, Number(年龄 || 0));
  if (年龄值 < 9) return ['正常', '优秀', '天才'];
  if (年龄值 < 13) return ['优秀', '天才'];
  if (年龄值 < 21) return ['天才', '顶级天才'];
  return ['顶级天才'];
}

function 读取年龄对标天赋显示名_V1(天赋档位 = '') {
  const 档位 = String(天赋档位 || '').trim();
  return 档位 === '正常' ? '普通' : 档位;
}

var 天赋梯队一般分布说明_V1 = Object.freeze([
  '天赋极差：没有魂力的普通人，处于魂师修炼体系之外。',
  '劣等：能够修炼，但终生通常不会超过29级，主要分布在魂师体系基层。',
  '普通：达到中级学院的基础门槛；成年后广泛分布于各类学院、组织和行业，构成各层级的常规骨干。',
  '优秀：在同层次群体中属于精英，具有突破70级的可能。',
  '天才：通常是中级学院每年的尖子生，具有突破90级的可能。',
  '顶级天才：属于大陆范围内每年出现的顶尖人才，具有成为极限斗罗的可能。',
  '绝世妖孽：百年难遇的时代级特例，其成长潜力超出常规培养体系。',
]);

function 构建天赋梯队一般分布行列表_V1(数据根 = {}) {
  const 玩家名 = 取运行时玩家名_V1(数据根);
  const 玩家 = 数据根?.char?.[玩家名];
  const 年龄 = 计算角色有效年龄_V1(玩家?.属性?.年龄, 玩家?.属性?.生日, 数据根?.world?.时间?.tick ?? null);
  if (!Number.isFinite(年龄)) return [];
  const 最大条目数 = 年龄 < 12 ? 5 : 年龄 < 20 ? 6 : 7;
  return 天赋梯队一般分布说明_V1.slice(0, 最大条目数);
}

function 读取六维对标训练系数_V1(天赋档位 = '正常') {
  return { 绝世妖孽: 1.6, 顶级天才: 1.2, 天才: 1.0, 优秀: 0.8, 正常: 0.5, 劣等: 0.2, 天赋极差: 0 }[
    String(天赋档位 || '').trim()
  ] ?? 0.5;
}

function 读取六维对标精神训练系数_V1(天赋档位 = '正常') {
  return String(天赋档位 || '').trim() === '绝世妖孽' ? 2.0 : 读取六维对标训练系数_V1(天赋档位);
}

function 读取角色六维对标天赋档位_V1(角色 = {}) {
  const 年龄 = Number(角色?.属性?.年龄 || 0);
  if (Number.isFinite(年龄) && 年龄 >= 6) return 读取年龄段对标天赋档位_V1(年龄);
  const 档位 = String(角色?.属性?.天赋梯队 || '').trim();
  return 档位 || '正常';
}

function 读取角色六维对标底子波动_V1(角色 = {}) {
  const 波动 = Number(角色?.属性?.底子波动);
  return Number.isFinite(波动) && 波动 > 0 ? 波动 : 1;
}

function 读取六维对标标准魂环年限_V1(魂环位 = 1, 等级 = 1, 天赋档位 = '正常', 精神境界 = '') {
  const 安全魂环位 = Math.max(1, Math.min(9, Math.floor(Number(魂环位 || 1))));
  const 等级值 = Math.max(1, Number(等级 || 1));
  if (等级值 >= 98) {
    const 九十八级目标 = [36000, 40000, 46000, 52000, 60000, 69000, 80000, 92000, 106000][安全魂环位 - 1] || 36000;
    const 九十九级目标 = [82000, 86000, 91000, 96000, 102000, 108000, 115000, 124000, 138000][安全魂环位 - 1] || 82000;
    const 天赋倍率 = { 绝世妖孽: 1.06, 顶级天才: 1, 天才: 0.94, 优秀: 0.88, 正常: 0.82, 劣等: 0.74, 天赋极差: 0.62 }[
      String(天赋档位 || '').trim()
    ] || 0.82;
    const 上限 = { 神元境: 999999, 灵域境: 999999, 灵渊境: 100000, 灵海境: 15000, 灵通境: 3000, 灵元境: 400 }[
      String(精神境界 || '').trim()
    ] || 400;
    const 进度 = Math.max(0, Math.min(1, 等级值 - 98));
    return Math.max(50, Math.min(上限, Math.floor((九十八级目标 + (九十九级目标 - 九十八级目标) * 进度) * 天赋倍率)));
  }

  const 天赋分 = { 绝世妖孽: 100, 顶级天才: 80, 天才: 60, 优秀: 40, 正常: 20, 劣等: 0, 天赋极差: -100 }[
    String(天赋档位 || '').trim()
  ] || 20;
  const 序号分 = [0, 40, 90, 150, 220, 300, 400, 500, 600][安全魂环位 - 1] || (安全魂环位 - 1) * 80;
  const 总分 = 50 + 天赋分 + 等级值 * 2 + 序号分 + (等级值 > 95 ? Math.floor(等级值 - 95) * 50 : 0);
  let 年限 = 50;
  if (总分 >= 600) 年限 = 100000 + (总分 - 600) * 1000;
  else if (总分 >= 300) 年限 = 10000 + (总分 - 300) * 200;
  else if (总分 >= 240) 年限 = 1000 + (总分 - 240) * 100;
  else if (总分 >= 180) 年限 = 100 + (总分 - 180) * 10;

  if (安全魂环位 === 1 && 等级值 < 30) {
    if (['绝世妖孽', '顶级天才', '天才'].includes(String(天赋档位 || '').trim())) {
      年限 = Math.min(400, Math.max(100, 100 + Math.max(0, 总分 - 80) * 2));
    } else {
      年限 = Math.min(100, Math.max(50, 年限));
    }
  }
  return Math.max(50, Math.floor(年限));
}

function 读取六维对标标准魂环加成_V1(等级 = 1, 天赋档位 = '正常', 精神境界 = '') {
  const 魂环数 = Math.max(0, Math.min(9, Math.floor(Number(等级 || 1) / 10)));
  const 结果 = { 力量: 0, 防御: 0, 敏捷: 0, 体力上限: 0, 精神力上限: 0 };
  if (!魂环数 || typeof getRingBonus !== 'function') return 结果;
  for (let 魂环位 = 1; 魂环位 <= 魂环数; 魂环位 += 1) {
    const 加成 = getRingBonus(读取六维对标标准魂环年限_V1(魂环位, 等级, 天赋档位, 精神境界));
    结果.力量 += Math.floor(Number(加成?.str || 0));
    结果.防御 += Math.floor(Number(加成?.def || 0));
    结果.敏捷 += Math.floor(Number(加成?.agi || 0));
    结果.体力上限 += Math.floor(Number(加成?.vit_max || 0));
    结果.精神力上限 += Math.floor(Number(加成?.men_max || 0));
  }
  return 结果;
}

function 读取初始化修为同龄描点_V1(角色 = {}, 当前tick = null) {
  const 属性 = 角色?.属性 && typeof 角色.属性 === 'object' ? 角色.属性 : {};
  const 年龄 = Math.max(0, Number(属性.年龄 || 0));
  if (年龄 < 6) return null;
  const 计算函数 = typeof globalThis.__LWCS_CALC_INITIAL_CULTIVATION_LEVEL__ === 'function'
    ? globalThis.__LWCS_CALC_INITIAL_CULTIVATION_LEVEL__
    : null;
  if (!计算函数) return null;
  const 档位 = 读取年龄段对标天赋档位_V1(年龄);
  const 等级 = Number(计算函数({
    天赋梯队: 档位,
    年龄,
    底子波动: Number(属性.底子波动 || 1),
    生日: String(属性.生日 || '').trim(),
    当前tick,
  }));
  return Number.isFinite(等级) ? { 档位, 等级: Math.max(0, Math.floor(等级)) } : null;
}

function 读取指定天赋年龄描点等级_V1(天赋档位 = '正常', 年龄 = 6) {
  const 计算函数 = typeof globalThis.__LWCS_CALC_INITIAL_CULTIVATION_LEVEL__ === 'function'
    ? globalThis.__LWCS_CALC_INITIAL_CULTIVATION_LEVEL__
    : null;
  if (!计算函数) return null;
  const 等级 = Number(计算函数({
    天赋梯队: String(天赋档位 || '正常').trim() || '正常',
    年龄: Math.max(0, Number(年龄 || 0)),
    底子波动: 1,
    生日: '',
    当前tick: null,
  }));
  return Number.isFinite(等级) ? Math.max(0, Math.floor(等级)) : null;
}

function 读取初始化修为同龄比较文本_V1(当前等级 = 0, 同龄等级 = 0) {
  const 当前 = Number(当前等级) || 0;
  const 同龄 = Number(同龄等级) || 0;
  if (Math.abs(当前 - 同龄) < 0.001) return '同龄持平';
  return 当前 > 同龄 ? '高于同龄' : '低于同龄';
}

function 是角色基础对标非魂师_V1(角色 = {}) {
  const 属性 = 角色?.属性 && typeof 角色.属性 === 'object' ? 角色.属性 : {};
  return String(属性.天赋梯队 || '').trim() === '天赋极差'
    || Math.max(0, Number(属性.等级 || 0)) <= 0
    || Math.max(0, Number(属性.魂力 || 0)) <= 0
    || Math.max(0, Number(属性.魂力上限 || 0)) <= 0;
}

function 读取角色六维强攻系对标倍率_V1() {
  return TypeMultipliers['强攻系'] || { sp_max: 1, men_max: 1, str: 1, def: 1, agi: 1, vit_max: 1 };
}

function 构建角色六维对标参照值_V1(角色 = {}, 等级 = 1) {
  const 安全等级 = Math.max(1, Math.min(99, Math.floor(Number(等级) || 1)));
  const 基准 = getBaseStats(安全等级);
  const 系别倍率 = 读取角色六维强攻系对标倍率_V1();
  const 天赋档位 = 读取角色六维对标天赋档位_V1(角色);
  const 底子波动 = 读取角色六维对标底子波动_V1(角色);
  const 训练倍率 = 安全等级 > 10 ? 0.005 * (安全等级 - 10) * 读取六维对标训练系数_V1(天赋档位) : 0;
  const 精神训练倍率 = 安全等级 > 10 ? 0.005 * (安全等级 - 10) * 读取六维对标精神训练系数_V1(天赋档位) : 0;
  const 魂环加成 = 读取六维对标标准魂环加成_V1(安全等级, 天赋档位, 角色?.属性?.精神境界);
  return {
    力量: Math.floor(Number(基准.str || 0) * Number(系别倍率.str || 1) * 底子波动) + Math.floor(Number(基准.str || 0) * 训练倍率) + 魂环加成.力量,
    防御: Math.floor(Number(基准.def || 0) * Number(系别倍率.def || 1) * 底子波动) + Math.floor(Number(基准.def || 0) * 训练倍率) + 魂环加成.防御,
    敏捷: Math.floor(Number(基准.agi || 0) * Number(系别倍率.agi || 1) * 底子波动) + Math.floor(Number(基准.agi || 0) * 训练倍率) + 魂环加成.敏捷,
    体力上限: Math.floor(Number(基准.vit_max || 0) * Number(系别倍率.vit_max || 1) * 底子波动) + Math.floor(Number(基准.vit_max || 0) * 训练倍率) + 魂环加成.体力上限,
    精神力上限: Math.floor(Number(基准.men_max || 0) * Number(系别倍率.men_max || 1) * 底子波动) + Math.floor(Number(基准.men_max || 0) * 精神训练倍率) + 魂环加成.精神力上限,
  };
}

function 读取角色装备六维加成_V1(角色 = {}) {
  const 装备 = 角色?.装备 && typeof 角色.装备 === 'object' ? 角色.装备 : {};
  const 武器加成 = 计算装备属性加成_V1(装备.武器, { ...角色, 属性基准模式: '已含本武器加成' });
  const 防具加成 = 装备.防具?.装备状态 === '已装备'
    ? 计算装备属性加成_V1(装备.防具, { ...角色, 属性基准模式: '已含本武器加成' })
    : {};
  const 斗铠加成 = 装备.斗铠?.装备状态 === '已装备'
    ? (装备.斗铠?._属性加成 || 计算斗铠属性加成_V1(装备.斗铠).属性加成 || {})
    : {};
  const 机甲加成 = 装备.机甲?.装备状态 === '已装备'
    ? (装备.机甲?._属性加成 || 计算机甲属性加成_V1(装备.机甲) || {})
    : {};
  const 求和 = 字段 =>
    Number(武器加成?.[字段] || 0) +
    Number(防具加成?.[字段] || 0) +
    Number(斗铠加成?.[字段] || 0) +
    Number(机甲加成?.[字段] || 0);
  return {
    力量: 求和('力量'),
    防御: 求和('防御'),
    敏捷: 求和('敏捷'),
    体力上限: 求和('体力上限'),
    精神力上限: 求和('精神力上限'),
  };
}

function 读取角色非装备六维_V1(角色 = {}) {
  const 属性 = 角色?.属性 && typeof 角色.属性 === 'object' ? 角色.属性 : {};
  const 装备加成 = 读取角色装备六维加成_V1(角色);
  return Object.fromEntries(角色基础六维对标字段_V1.map(({ 字段 }) => {
    const 原值 = Number(属性?.[字段] ?? (字段 === '体力上限' ? 属性?.HP上限 : 0));
    return [字段, Math.max(1, Math.floor((Number.isFinite(原值) ? 原值 : 0) - Number(装备加成?.[字段] || 0)))];
  }));
}

function 计算角色属性对标等级文本_V1(角色 = {}, 字段 = '', 数值 = 0) {
  const 安全数值 = Math.max(0, Number(数值) || 0);
  const 参照天赋 = 读取年龄对标天赋显示名_V1(读取角色六维对标天赋档位_V1(角色));
  const 参照前缀 = `${参照天赋}强攻系`;
  const 一级参照 = Math.max(1, Number(构建角色六维对标参照值_V1(角色, 1)?.[字段] || 1));
  const 九十九级参照 = Math.max(一级参照, Number(构建角色六维对标参照值_V1(角色, 99)?.[字段] || 一级参照));
  if (安全数值 < 一级参照) return `${参照前缀}1级以下`;
  if (安全数值 > 九十九级参照) return `${参照前缀}99+级`;
  let 最佳等级 = 1;
  let 最小差值 = Infinity;
  for (let 等级 = 1; 等级 <= 99; 等级 += 1) {
    const 参照 = Number(构建角色六维对标参照值_V1(角色, 等级)?.[字段] || 0);
    const 差值 = Math.abs(参照 - 安全数值);
    if (差值 < 最小差值) {
      最小差值 = 差值;
      最佳等级 = 等级;
    }
  }
  return `${参照前缀}${最佳等级}级`;
}

function 构建角色基础六维对标条目_V1(角色 = {}, 当前tick = null) {
  if (!角色 || typeof 角色 !== 'object' || !角色.属性 || typeof 角色.属性 !== 'object') return {};
  if (是角色基础对标非魂师_V1(角色)) return { 非魂师: true };
  const 六维 = 读取角色非装备六维_V1(角色);
  const 条目 = {};
  const 年龄文本 = 格式化年龄岁月文本_V1(角色?.属性?.年龄, 角色?.属性?.生日, 当前tick);
  if (年龄文本) 条目.年龄 = 年龄文本;
  const 等级 = Number(角色.属性.等级);
  if (Number.isFinite(等级)) {
    条目.等级 = `Lv${等级}`;
  }
  角色基础六维对标字段_V1.forEach(({ 标签, 字段 }) => {
    const 数值 = Math.max(1, Math.floor(Number(六维?.[字段] || 1)));
    const 对标 = 计算角色属性对标等级文本_V1(角色, 字段, 数值);
    条目[标签] = 字段 === '精神力上限' ? `${格式化MVU剩余资源数值_V1(数值)}≈${对标}` : 对标;
  });
  const 副职业文本 = Object.entries(角色?.副职业 || {})
    .map(([副职业名, 副职业数据]) => {
      const 派生 = 派生副职业运行时_V1(副职业名, 副职业数据);
      if (!派生.等级) return '';
      return `${读取副职业显示名_V1(副职业名)}${派生.等级}级=${派生.核心技艺}`;
    })
    .filter(Boolean)
    .join('，');
  if (副职业文本) 条目.副职业 = 副职业文本;
  return 条目;
}

function 格式化角色基础六维对标条目_V1(角色名 = '', 条目 = {}) {
  if (!条目 || typeof 条目 !== 'object' || !Object.keys(条目).length) return '';
  if (条目.非魂师) return `${角色名}：非魂师`;
  const 片段列表 = [];
  const 年龄文本 = String(条目.年龄 || '').trim();
  if (年龄文本) 片段列表.push(`年龄 ${年龄文本}`);
  const 字段文本 = 角色基础六维对标字段_V1.map(({ 标签 }) => {
    const 文本 = String(条目?.[标签] || '').trim();
    if (!文本) return '';
    return 标签 === '精神力' ? `${标签} ${文本}` : `${标签}≈${文本}`;
  }).filter(Boolean).join('，');
  const 副职业文本 = String(条目.副职业 || '').trim();
  if (字段文本) 片段列表.push(字段文本);
  if (!片段列表.length && !副职业文本) return '';
  return `${角色名} ${String(条目.等级 || 'Lv?').trim()}：${片段列表.join('，')}${副职业文本 ? `；副职业：${副职业文本}` : ''}`;
}

function 构建年龄对标等级行列表_V1(数据根 = {}, 角色名集合 = new Set()) {
  const 年龄对标表 = new Map();
  const 当前tick = 数据根?.world?.时间?.tick ?? null;
  Array.from(角色名集合 || []).forEach(角色名 => {
    const 角色 = 数据根?.char?.[角色名];
    const 有效年龄 = 计算角色有效年龄_V1(角色?.属性?.年龄, 角色?.属性?.生日, 当前tick);
    if (!Number.isFinite(有效年龄) || 有效年龄 < 6 || 有效年龄 >= 30) return;
    const 整岁 = Math.floor(有效年龄);
    const 已记录年龄 = 年龄对标表.get(整岁);
    if (!Number.isFinite(已记录年龄) || 有效年龄 > 已记录年龄) 年龄对标表.set(整岁, 有效年龄);
  });
  return Array.from(年龄对标表.entries())
    .sort(([年龄A], [年龄B]) => 年龄A - 年龄B)
    .map(([年龄, 计算年龄]) => {
      const 档位文本 = 读取年龄对标天赋档位列表_V1(计算年龄)
        .map(档位 => {
          const 等级 = 读取指定天赋年龄描点等级_V1(档位, 计算年龄);
          return Number.isFinite(Number(等级)) ? `${读取年龄对标天赋显示名_V1(档位)}${等级}级` : '';
        })
        .filter(Boolean)
        .join('，');
      return 档位文本 ? `${年龄}岁对标等级：${档位文本}` : '';
    })
    .filter(Boolean);
}

function 生成角色基础六维对标摘要_V1(数据输入 = null, userInput = '') {
  const 数据根 = 读取运行时Mvu数据根或最新_V1(数据输入) || {};
  const 角色名集合 = 取运行时基础角色名集合_V1(数据根, String(userInput || ''));
  const 角色名列表 = 按玩家优先排序名称_V1(角色名集合, 取运行时玩家名_V1(数据根));
  const 行列表 = [];
  const 天赋梯队一般分布行列表 = 构建天赋梯队一般分布行列表_V1(数据根);
  if (天赋梯队一般分布行列表.length) {
    行列表.push('【天赋梯队一般分布】', ...天赋梯队一般分布行列表);
  }
  const 年龄对标行列表 = 构建年龄对标等级行列表_V1(数据根, 角色名集合);
  if (年龄对标行列表.length) {
    行列表.push('【年龄等级描点】', ...年龄对标行列表);
  }
  const 角色六维对标行列表 = [];
  角色名列表.forEach(角色名 => {
    const 角色 = 数据根?.char?.[角色名];
    const 行文本 = 格式化角色基础六维对标条目_V1(角色名, 构建角色基础六维对标条目_V1(角色, 数据根?.world?.时间?.tick ?? null));
    if (行文本) 角色六维对标行列表.push(行文本);
  });
  if (角色六维对标行列表.length) {
    行列表.push('【角色六维对标】', ...角色六维对标行列表);
  }
  return 行列表.length ? 行列表.join('\n') : '无';
}

function 序列化MVU运行时视图_V1(视图 = {}) {
  try {
    return JSON.stringify(视图 || {}, null, 2);
  } catch (错误) {
    return '{}';
  }
}

function 读取运行时视图诊断_V1() {
  const 诊断 = globalThis.__LWCS_MVU_RUNTIME_VIEW_DIAGNOSTICS__;
  return 诊断 && typeof 诊断 === 'object'
    ? cloneJsonValue(诊断, { 错误列表: [] })
    : { 错误列表: [] };
}

function 写入运行时视图诊断_V1(错误列表 = []) {
  const 诊断 = {
    时间: Date.now(),
    错误列表: Array.isArray(错误列表) ? 错误列表 : [],
  };
  globalThis.__LWCS_MVU_RUNTIME_VIEW_DIAGNOSTICS__ = 诊断;
  try {
    if (globalThis.parent && globalThis.parent !== globalThis) {
      globalThis.parent.__LWCS_MVU_RUNTIME_VIEW_DIAGNOSTICS__ = 诊断;
    }
  } catch (错误) {}
  try {
    if (globalThis.top && globalThis.top !== globalThis) {
      globalThis.top.__LWCS_MVU_RUNTIME_VIEW_DIAGNOSTICS__ = 诊断;
    }
  } catch (错误) {}
  return 诊断;
}

function 替换MVU运行时视图占位符_V1(文本 = '', 视图类型 = 'empty', 上下文 = {}) {
  const 源文本 = String(文本 || '');
  const 需要主视图 = 源文本.includes(MVU_RUNTIME_VIEW_PLACEHOLDER_V1);
  const 需要更新视图 = 源文本.includes(MVU_RUNTIME_UPDATE_PLACEHOLDER_V1);
  const 需要结构提示 = 源文本.includes(MVU_UPDATE_STRUCTURE_HINTS_PLACEHOLDER_V1);
  const 需要相互可见性 = 源文本.includes(MVU相互可见性视图占位符_V1);
  const 需要场景候选角色资料 = 源文本.includes(场景候选角色资料占位符_V1);
  const 需要场景背景角色补充 = 源文本.includes(场景背景角色补充占位符_V1);
  const 需要场景审计材料 = 源文本.includes(场景审计材料占位符_V1);
  const 需要玩家角色表 = 源文本.includes(玩家角色表占位符_V1);
  if (!需要主视图 && !需要更新视图 && !需要结构提示 && !需要相互可见性 && !需要场景候选角色资料 && !需要场景背景角色补充 && !需要场景审计材料 && !需要玩家角色表) return 源文本;
  写入运行时视图诊断_V1([]);
  const 数据根 = 上下文?.statData || 获取最新运行时Mvu数据根_V1();
  const userInput = 上下文?.userInput || '';
  const 最后角色消息输入 = String(上下文?.lastCharMessage || 上下文?.aiText || '').trim() || 读取运行时最后角色消息文本_V1();
  const plotText = 上下文?.plotText || '';
  const 视图类型文本 = String(视图类型 || '').toLowerCase();
  let 正文视图 = null;
  let 更新视图 = null;
  const 读取正文视图 = () => {
    if (!正文视图) 正文视图 = 生成MVU正文视图_V1(数据根, userInput, plotText);
    return 正文视图;
  };
  const 读取更新视图 = () => {
    if (!更新视图) 更新视图 = 生成MVU更新视图_V1(数据根, userInput, 最后角色消息输入, plotText, {
      运行时提示已使用类型: 上下文?.运行时提示已使用类型,
    });
    return 更新视图;
  };
  const 错误列表 = [];
  const 替换值 = new Map();
  const 尝试生成 = (阶段, 占位符, 生成器) => {
    try {
      替换值.set(占位符, String(生成器() ?? ''));
      return true;
    } catch (错误) {
      错误列表.push({
        阶段,
        占位符,
        错误: 错误?.message || String(错误 || 'unknown_error'),
      });
      return false;
    }
  };
  if (需要主视图) {
    尝试生成('主剧情视图', MVU_RUNTIME_VIEW_PLACEHOLDER_V1, () => {
      if (视图类型文本 === 'plot') return 生成MVU剧情提示文本_V1(数据根, userInput, String(最后角色消息输入 || ''));
      if (视图类型文本 === 'story') return 生成MVU正文提示文本_V1(数据根, userInput, plotText, 读取正文视图());
      const 主视图 = 视图类型文本 === 'empty' ? {} : (视图类型文本 === 'update' ? 读取更新视图() : 读取正文视图());
      return 序列化MVU运行时视图_V1(主视图);
    });
  }
  if (需要更新视图) {
    尝试生成('更新视图', MVU_RUNTIME_UPDATE_PLACEHOLDER_V1, () => 序列化MVU运行时视图_V1(读取更新视图()));
  }
  if (需要结构提示) {
    尝试生成('更新结构提示', MVU_UPDATE_STRUCTURE_HINTS_PLACEHOLDER_V1, () => 生成MVU更新结构提示_V1(数据根, userInput, 最后角色消息输入, plotText, {
      运行时提示已使用类型: 上下文?.运行时提示已使用类型,
    }));
  }
  if (需要相互可见性) {
    尝试生成('相互可见性视图', MVU相互可见性视图占位符_V1, () => 生成MVU相互可见性视图_V1(数据根, userInput, 最后角色消息输入));
  }
  let 场景背景角色补充文本 = '';
  let 场景候选角色资料文本 = '';
  let 场景背景角色补充成功 = true;
  let 场景候选角色资料成功 = true;
  if (需要场景背景角色补充 || 需要场景候选角色资料 || 需要场景审计材料) {
    场景背景角色补充成功 = 尝试生成('场景背景角色补充', 场景背景角色补充占位符_V1, () =>
      生成场景背景角色补充_V1(数据根, userInput, 最后角色消息输入, 上下文?.场景线索种子文本 || ''));
    场景背景角色补充文本 = 替换值.get(场景背景角色补充占位符_V1) || '';
  }
  if (需要场景候选角色资料 || 需要场景审计材料) {
    if (场景背景角色补充成功) {
      场景候选角色资料成功 = 尝试生成('场景候选角色资料', 场景候选角色资料占位符_V1, () =>
        生成场景候选角色资料_V1(数据根, userInput, 最后角色消息输入, 上下文?.场景线索种子文本 || '', 10, 场景背景角色补充文本));
      场景候选角色资料文本 = 替换值.get(场景候选角色资料占位符_V1) || '';
    } else {
      场景候选角色资料成功 = false;
      错误列表.push({ 阶段: '场景候选角色资料', 占位符: 场景候选角色资料占位符_V1, 错误: '依赖场景背景角色补充失败' });
    }
  }
  if (需要场景审计材料) {
    if (场景背景角色补充成功 && 场景候选角色资料成功) {
      尝试生成('场景审计材料', 场景审计材料占位符_V1, () =>
        生成场景审计材料_V1(数据根, userInput, 最后角色消息输入, 上下文?.场景线索种子文本 || '', 10, 场景背景角色补充文本, 场景候选角色资料文本));
    } else {
      错误列表.push({ 阶段: '场景审计材料', 占位符: 场景审计材料占位符_V1, 错误: '依赖场景资料生成失败' });
    }
  }
  if (需要玩家角色表) {
    尝试生成('玩家角色表', 玩家角色表占位符_V1, () => 生成MVU玩家角色表_V1(数据根));
  }
  写入运行时视图诊断_V1(错误列表);
  const 替换后 = Array.from(替换值.entries()).reduce(
    (文本值, [占位符, 值]) => 文本值.replaceAll(占位符, 值),
    源文本,
  );
  return 替换后.replace(/<status_current_variables>\s*(?:\{\}|\[\]|\s*)\s*<\/status_current_variables>/gi, '').trim();
}

function 创建运行时提示限流器_V1(共享已使用类型 = null) {
  const 已使用类型 = 共享已使用类型 instanceof Set ? 共享已使用类型 : new Set();
  return (类型 = '', 完整提示 = '') => {
    const 提示类型 = String(类型 || '').trim();
    if (!提示类型) return 完整提示 || '待生成';
    if (已使用类型.has(提示类型)) return '待生成';
    已使用类型.add(提示类型);
    return 完整提示 || '待生成';
  };
}

function 按玩家优先排序名称_V1(名称集合 = [], 玩家名 = '') {
  const 玩家 = String(玩家名 || '').trim();
  const 名称列表 = Array.from(名称集合 || []).filter(名称 => String(名称 || '').trim());
  if (!玩家) return 名称列表;
  return 名称列表.sort((a, b) => (a === 玩家 ? -1 : b === 玩家 ? 1 : 0));
}

function 注入运行时技能默认提示_V1(skill = {}, context = {}) {
  if (!skill || typeof skill !== 'object') return;
  const hasPackedEffects = Array.isArray(skill._效果数组) && skill._效果数组.length > 0;
  const textContext = context?.textContext || context || {};
  const 允许机制决策临时 = context?.允许机制决策临时 === true;
  const 取提示 = typeof context?.取运行时提示 === 'function' ? context.取运行时提示 : null;
  const 限流提示 = (类型, 完整提示) => (取提示 ? 取提示(类型, 完整提示) : 完整提示);
  if (String(skill.魂技名 ?? '').trim() === '') skill.魂技名 = 限流提示('技能名', buildSkillNameTodoText(textContext));
  if (String(skill.画面描述 ?? '').trim() === '')
    skill.画面描述 = 限流提示('技能画面描述', AI_TODO_SKILL_VISUAL);
  if (String(skill.效果描述 ?? '').trim() === '' || String(skill.效果描述 ?? '').trim() === SKILL_TEXT_UNKNOWN || isSkillTodoText(skill.效果描述))
    skill.效果描述 = 限流提示('技能效果描述', AI_TODO_SKILL_EFFECT);
  const 是造物承载技能 = String(skill.承载方式 || '').trim() === '造物承载' || 是造物承载效果数组_V1(skill._效果数组);
  if (!是造物承载技能) delete skill.产物描述;
  if (hasPackedEffects && 是造物承载技能 && (!String(skill.产物描述 ?? '').trim() || String(skill.产物描述 ?? '').trim() === '无')) {
    const 产物提示 = buildSkillProductDescriptionTodoText(skill._效果数组);
    if (产物提示) skill.产物描述 = 限流提示('技能产物描述', 产物提示);
  }
  if (!hasPackedEffects && 允许机制决策临时) skill[技能机制决策临时字段_V1] = 构建技能机制决策临时数据_V1(skill, context);
}

function 注入运行时技能图默认提示_V1(skillMap = {}, contextFactory = () => ({})) {
  Object.entries(skillMap || {}).forEach(([skillName, skill]) => {
    if (!skill || typeof skill !== 'object') return;
    注入运行时技能默认提示_V1(skill, contextFactory(skillName, skill) || {});
  });
}

function 注入运行时文本默认值_V1(obj = {}, key = '', fallbackText = '') {
  if (!obj || typeof obj !== 'object') return;
  if (String(obj[key] ?? '').trim() === '') obj[key] = fallbackText;
}

function 注入运行时限流文本默认值_V1(obj = {}, key = '', fallbackText = '', 类型 = '', 取提示 = null) {
  if (!obj || typeof obj !== 'object') return;
  if (String(obj[key] ?? '').trim() !== '') return;
  obj[key] = typeof 取提示 === 'function' ? 取提示(类型 || key, fallbackText) : fallbackText;
}

function 注入运行时限流数组默认值_V1(obj = {}, key = '', fallbackList = [], 类型 = '', 取提示 = null) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj[key]) && obj[key].some(item => String(item ?? '').trim())) return;
  const 默认列表 = Array.isArray(fallbackList) ? fallbackList : [fallbackList];
  obj[key] = 默认列表.map(项 => (typeof 取提示 === 'function' ? 取提示(类型 || key, 项) : 项));
}

function injectRuntimeCharacterTodoDefaults_V1(charData = {}, charName = '', sourceChar = null, rootData = {}) {
  if (!charData || typeof charData !== 'object') return charData;
  const 玩家名 = 取运行时玩家名_V1(rootData);
  const { 玩家 } = 取运行时当前范围_V1(rootData);
  const 允许机制决策临时 = charName === 玩家名 || 运行时地点兼容_V1(sourceChar?.状态?.位置 || '', 玩家?.状态?.位置 || '');
  const 取提示 = typeof rootData?.__运行时提示限流__ === 'function' ? rootData.__运行时提示限流__ : null;
  charData.临时突破 = 临时突破默认提示词_V1;
  注入运行时限流文本默认值_V1(charData, '性格', AI_TODO_PERSONALITY, '角色性格', 取提示);
  if (charData.社交 && typeof charData.社交 === 'object') {
    注入运行时限流文本默认值_V1(charData.社交, '主身份', AI_TODO_MAIN_IDENTITY, '主身份', 取提示);
    注入运行时限流文本默认值_V1(charData.社交, '家世描述', AI_TODO_FAMILY_BACKGROUND, '家世描述', 取提示);
    Object.values(charData.社交.关系 || {}).forEach(relData => {
      if (relData && typeof relData === 'object') 规范武魂相关度基础字段(relData);
    });
  }
  if (charData.状态 && typeof charData.状态 === 'object') 注入运行时限流文本默认值_V1(charData.状态, '位置', AI_TODO_STATUS_LOC, '角色位置', 取提示);
  if (charData.外貌 && typeof charData.外貌 === 'object') {
    注入运行时限流文本默认值_V1(charData.外貌, '发色', '待补全(根据角色外貌补全发色)', '角色外貌', 取提示);
    注入运行时限流文本默认值_V1(charData.外貌, '发型', '待补全(根据角色发质与气质补全发型)', '角色外貌', 取提示);
    注入运行时限流文本默认值_V1(charData.外貌, '瞳色', '待补全(根据角色外貌补全瞳色)', '角色外貌', 取提示);
    注入运行时限流文本默认值_V1(charData.外貌, '身高', '待补全(根据角色设定补全身高)', '角色外貌', 取提示);
    注入运行时限流文本默认值_V1(charData.外貌, '体型', '待补全(根据角色体态补全体型)', '角色外貌', 取提示);
    注入运行时限流文本默认值_V1(charData.外貌, '长相描述', '待补全(根据角色面部特征补全长相描述)', '角色外貌', 取提示);
  }
  if (!charData.穿搭 || typeof charData.穿搭 !== 'object' || Array.isArray(charData.穿搭)) charData.穿搭 = {};
  注入运行时限流文本默认值_V1(charData.穿搭, '上装', 角色穿搭上装待补全文案_V1, '穿搭上装', 取提示);
  注入运行时限流文本默认值_V1(charData.穿搭, '下装', 角色穿搭下装待补全文案_V1, '穿搭下装', 取提示);
  注入运行时限流文本默认值_V1(charData.穿搭, '鞋子', 角色穿搭鞋子待补全文案_V1, '穿搭鞋子', 取提示);
  注入运行时限流文本默认值_V1(charData.穿搭, '描述', 角色穿搭描述待补全文案_V1, '穿搭描述', 取提示);
  取角色武魂条目_V1(charData).forEach(([spiritKey, spiritData]) => {
    if (!spiritData || typeof spiritData !== 'object') return;
    const 武魂系别 = 取角色主武魂系别_V1(charData);
    const isSecondarySpirit = spiritKey === '第2武魂';
    if (isSecondarySpirit) 注入运行时文本默认值_V1(spiritData, '表象名称', '未展露');
    else 注入运行时限流文本默认值_V1(spiritData, '表象名称', AI_TODO_SPIRIT_NAME, '武魂名', 取提示);
    注入运行时限流文本默认值_V1(spiritData, '描述', isSecondarySpirit ? '无' : AI_TODO_SPIRIT_DESC, '武魂描述', isSecondarySpirit ? null : 取提示);
    注入运行时限流文本默认值_V1(spiritData, '系别', 武魂系别待补全文案_V1, '武魂系别', 取提示);
    注入运行时限流文本默认值_V1(spiritData, '属性体系', AI_TODO_ATTRIBUTE_SYSTEM, '武魂属性体系', 取提示);
    注入运行时限流数组默认值_V1(spiritData, '可调用元素', [AI_TODO_CALLABLE_ELEMENTS], '武魂可调用元素', 取提示);
    取武魂魂灵条目_V1(spiritData).forEach(([soulSpiritKey, soulSpirit]) => {
      if (!soulSpirit || typeof soulSpirit !== 'object') return;
      注入运行时限流文本默认值_V1(soulSpirit, '表象名称', AI_TODO_SOUL_SPIRIT_NAME, '魂灵名', 取提示);
      if (String(soulSpirit.描述 ?? '').trim() === '')
        soulSpirit.描述 = 取提示 ? 取提示('魂灵描述', buildSoulSpiritDescriptionTodoText(soulSpirit)) : buildSoulSpiritDescriptionTodoText(soulSpirit);
      注入运行时限流文本默认值_V1(soulSpirit, '品质', AI_TODO_SOUL_SPIRIT_QUALITY, '魂灵品质', 取提示);
      取魂灵魂环条目_V1(soulSpirit).forEach(([, ringData]) => {
        注入运行时文本默认值_V1(ringData, '颜色', '无');
        注入运行时技能图默认提示_V1(Object.fromEntries(取魂环魂技条目_V1(ringData)), skillName => ({
          type: 武魂系别,
          允许机制决策临时,
          取运行时提示: 取提示,
          textContext: {
            spiritName: soulSpirit.表象名称 || spiritData.表象名称 || soulSpiritKey || skillName,
            martialSoulName: spiritData.表象名称 || spiritKey,
            soulSpiritName: soulSpirit.表象名称 || soulSpiritKey,
            type: 武魂系别,
          },
        }));
      });
    });
    取武魂直接魂环条目_V1(spiritData).forEach(([, ringData]) => {
      注入运行时文本默认值_V1(ringData, '颜色', '无');
      注入运行时限流文本默认值_V1(ringData, '来源', 独立魂环来源待补全文案_V1, '独立魂环来源', 取提示);
      注入运行时技能图默认提示_V1(Object.fromEntries(取魂环魂技条目_V1(ringData)), skillName => ({
        type: 武魂系别,
        允许机制决策临时,
        取运行时提示: 取提示,
        textContext: {
          spiritName: spiritData.表象名称 || spiritKey || skillName,
          martialSoulName: spiritData.表象名称 || spiritKey,
          ringSource: String(ringData?.来源 || '').trim(),
          type: 武魂系别,
        },
      }));
    });
  });
  Object.values(charData.魂骨 || {}).forEach(boneData => {
    if (!boneData || typeof boneData !== 'object') return;
    const 主武魂系别 = 取角色主武魂系别_V1(charData);
    注入运行时技能图默认提示_V1(boneData.附带技能, skillName => ({
      type: 主武魂系别,
      允许机制决策临时,
      取运行时提示: 取提示,
      textContext: { spiritName: boneData?.名称 || skillName, type: 主武魂系别 },
    }));
  });
  if (charData.血脉之力 && typeof charData.血脉之力 === 'object') {
    同步内置血脉技能模板_V1(charData);
    const bloodlineType = 取角色主武魂系别_V1(charData);
    注入运行时技能图默认提示_V1(charData.血脉之力.被动, skillName => ({
      type: bloodlineType,
      sourceCategory: '血脉技能',
      来源: '血脉技能',
      跳过预算门禁: true,
      血脉技能: true,
      允许机制决策临时,
      取运行时提示: 取提示,
      textContext: { spiritName: charData.血脉之力?.血脉 || skillName, type: bloodlineType },
    }));
    注入运行时技能图默认提示_V1(charData.血脉之力.技能, skillName => ({
      type: bloodlineType,
      sourceCategory: '血脉技能',
      来源: '血脉技能',
      跳过预算门禁: true,
      血脉技能: true,
      允许机制决策临时,
      取运行时提示: 取提示,
      textContext: { spiritName: charData.血脉之力?.血脉 || skillName, type: bloodlineType },
    }));
    取血脉气血魂环条目_V1(charData.血脉之力).forEach(([, ringData]) => {
      注入运行时文本默认值_V1(ringData, '颜色', '金');
      注入运行时技能图默认提示_V1(Object.fromEntries(取气血魂环魂技条目_V1(ringData)), skillName => ({
        type: bloodlineType,
        sourceCategory: '气血魂技',
        来源: '气血魂技',
        跳过预算门禁: true,
        血脉技能: true,
        允许机制决策临时,
        取运行时提示: 取提示,
        textContext: { spiritName: charData.血脉之力?.血脉 || skillName, type: bloodlineType },
      }));
    });
  }
  const 主武魂系别 = 取角色主武魂系别_V1(charData);
  注入运行时技能图默认提示_V1(charData.自创魂技, skillName => ({
    type: 主武魂系别,
    允许机制决策临时,
    取运行时提示: 取提示,
    textContext: { spiritName: skillName, type: 主武魂系别 },
  }));
  Object.entries(charData.武魂融合技 || {}).forEach(([fusionName, fusionData]) => {
    if (fusionData?.技能数据) 注入运行时技能默认提示_V1(fusionData.技能数据, {
      type: 主武魂系别,
      允许机制决策临时,
      取运行时提示: 取提示,
      textContext: { spiritName: fusionName, type: 主武魂系别 },
    });
  });
  return charData;
}

try {
  const 运行时视图接口 = Object.freeze({
    占位符: MVU_RUNTIME_VIEW_PLACEHOLDER_V1,
    更新视图占位符: MVU_RUNTIME_UPDATE_PLACEHOLDER_V1,
    更新结构提示占位符: MVU_UPDATE_STRUCTURE_HINTS_PLACEHOLDER_V1,
    相互可见性视图占位符: MVU相互可见性视图占位符_V1,
    玩家角色表占位符: 玩家角色表占位符_V1,
    生成MVU正文视图: 生成MVU正文视图_V1,
    生成MVU正文提示文本: 生成MVU正文提示文本_V1,
    生成MVU相互可见性视图: 生成MVU相互可见性视图_V1,
    生成MVU更新视图: 生成MVU更新视图_V1,
    生成MVU剧情视图: 生成MVU剧情视图_V1,
    生成MVU剧情提示文本: 生成MVU剧情提示文本_V1,
    生成MVU玩家角色表: 生成MVU玩家角色表_V1,
    生成MVU角色卡覆盖率检查: 生成MVU角色卡覆盖率检查_V1,
    生成场景背景角色补充: 生成场景背景角色补充_V1,
    生成场景候选角色资料: 生成场景候选角色资料_V1,
    生成场景审计材料: 生成场景审计材料_V1,
    生成角色基础六维对标摘要: 生成角色基础六维对标摘要_V1,
    生成MVU更新结构提示: 生成MVU更新结构提示_V1,
    读取内置角色库: 读取内置角色库_V1,
    读取内置物品库: 读取内置物品库_V1,
    构建运行时地点索引: 构建运行时地点索引_V1,
    构建运行时地点候选: 构建运行时地点候选_V1,
    收集运行时地点命中: 收集运行时地点命中_V1,
    收集运行时动态地点命中: 收集运行时动态地点命中_V1,
    收集运行时父级限定动态地点命中: 收集运行时父级限定动态地点命中_V1,
    收集运行时物品命中: 收集运行时物品命中_V1,
    收集运行时命中候选名称: 收集运行时命中候选名称_V1,
    构建运行时统一实体命中: 构建运行时统一实体命中_V1,
    查找运行时物品定义: 查找运行时物品定义_V1,
    应用内置角色实例化: 应用内置角色实例化_V1,
    应用内置物品实例化: 应用内置物品实例化_V1,
    构建内置角色命中摘要: 构建内置角色命中摘要_V1,
    替换MVU运行时视图占位符: 替换MVU运行时视图占位符_V1,
    读取运行时视图诊断: 读取运行时视图诊断_V1,
  });
  globalThis.__LWCS_MVU_RUNTIME_VIEW__ = 运行时视图接口;
  delete globalThis.__LWCS_MVU_RUNTIME_VIEW_ERROR__;
  try { if (globalThis.parent && globalThis.parent !== globalThis) globalThis.parent.__LWCS_MVU_RUNTIME_VIEW__ = 运行时视图接口; } catch (错误) {}
  try { if (globalThis.parent && globalThis.parent !== globalThis) delete globalThis.parent.__LWCS_MVU_RUNTIME_VIEW_ERROR__; } catch (错误) {}
  try { if (globalThis.top && globalThis.top !== globalThis) globalThis.top.__LWCS_MVU_RUNTIME_VIEW__ = 运行时视图接口; } catch (错误) {}
  try { if (globalThis.top && globalThis.top !== globalThis) delete globalThis.top.__LWCS_MVU_RUNTIME_VIEW_ERROR__; } catch (错误) {}
} catch (错误) {
  const 诊断 = {
    时间: Date.now(),
    错误列表: [{
      阶段: '运行时视图接口注册',
      占位符: '',
      错误: 错误?.message || String(错误 || 'unknown_error'),
    }],
  };
  globalThis.__LWCS_MVU_RUNTIME_VIEW_ERROR__ = 诊断;
  globalThis.__LWCS_MVU_RUNTIME_VIEW_DIAGNOSTICS__ = 诊断;
  try {
    if (globalThis.parent && globalThis.parent !== globalThis) {
      globalThis.parent.__LWCS_MVU_RUNTIME_VIEW_ERROR__ = 诊断;
      globalThis.parent.__LWCS_MVU_RUNTIME_VIEW_DIAGNOSTICS__ = 诊断;
    }
  } catch (错误) {}
}

function 追加系统播报文本(数据对象 = {}, 文本 = '', 分隔符 = ' ') {
  if (!数据对象 || typeof 数据对象 !== 'object') return '';
  if (!数据对象.sys || typeof 数据对象.sys !== 'object') 数据对象.sys = {};
  const 清洗文本 = String(文本 || '').trim();
  if (!清洗文本) return String(数据对象.sys.系统播报 || '');
  const 原播报 = String(数据对象.sys.系统播报 || '').trim();
  const 现有播报 = 原播报 && 原播报 !== '初始化' ? 原播报 : '';
  const 安全分隔符 = String(分隔符 || ' ').trim() || ' ';
  数据对象.sys.系统播报 = `${现有播报}${现有播报 ? 安全分隔符 : ''}${清洗文本}`.trim();
  return 数据对象.sys.系统播报;
}

function normalizeTravelMapLevel(level = 'world') {
  const safeLevel = String(level || 'world')
    .trim()
    .toLowerCase();
  if (safeLevel === 'facility' || safeLevel === 'district') return 'facility';
  if (safeLevel === 'city') return 'city';
  if (safeLevel === 'world' || safeLevel === 'continent' || safeLevel === 'region') return 'world';
  return 'world';
}

function getTravelScaleByMapLevel(level = 'world') {
  return MAP_TRAVEL_SCALE_BY_LEVEL[normalizeTravelMapLevel(level)] || MAP_TRAVEL_SCALE_BY_LEVEL.world;
}

function getMapNodeCommonPathDepth(startPath = [], endPath = []) {
  const a = Array.isArray(startPath) ? startPath : [];
  const b = Array.isArray(endPath) ? endPath : [];
  const maxDepth = Math.min(a.length, b.length);
  let depth = 0;
  for (let i = 0; i < maxDepth; i++) {
    if (a[i] !== b[i]) break;
    depth++;
  }
  return depth;
}

function resolveTravelMapLevel(startLoc, endLoc, sd = null, coordSystem = MAP_COORD_SYSTEM_IMAGE) {
  const safeCoordSystem = String(coordSystem || MAP_COORD_SYSTEM_IMAGE).trim();
  if (safeCoordSystem === MAP_COORD_SYSTEM_IMAGE) return 'world';
  if (!sd) return 'city';
  const startEntry = findMapNodeEntry(startLoc, sd);
  const endEntry = findMapNodeEntry(endLoc, sd);
  const startPath = Array.isArray(startEntry?.path) ? startEntry.path : [];
  const endPath = Array.isArray(endEntry?.path) ? endEntry.path : [];
  const commonDepth = getMapNodeCommonPathDepth(startPath, endPath);
  if (commonDepth >= 3) return 'facility';
  if (commonDepth >= 2) return 'city';
  if (startPath.length >= 3 || endPath.length >= 3) return 'facility';
  if (startPath.length >= 2 || endPath.length >= 2) return 'city';
  return 'world';
}

var FLAT_LOCATIONS = {};
function refreshFlatLocationsFromTree(node, name) {
  if (node.x !== undefined && node.y !== undefined) {
    FLAT_LOCATIONS[name] = { x: node.x, y: node.y };
  }
  if (node.子节点) {
    for (const childName in node.子节点) {
      refreshFlatLocationsFromTree(node.子节点[childName], childName);
    }
  }
}

function calculateTravelResourceCost(method, distance, char = {}) {
  const 属性 = char.属性 || {};
  const 财富 = char.财富 || {};
  const 装备 = char.装备 || {};
  const lv = Number(属性.等级 || 0);
  const hasDoukai = Number(装备?.斗铠?.等级 || 0) > 0 && String(装备?.斗铠?.装备状态 || '未装备') === '已装备';
  const hasMecha =
    String(装备?.机甲?.等级 || '无') !== '无' && String(装备?.机甲?.装备状态 || '未装备') === '已装备';

  let fedCoin = 0;
  let sp = 0;
  let vit = 0;
  let canAfford = true;
  let reason = '';
  let note = '';

  if (method === '步行') {
    vit = Math.max(1, Math.floor(distance * 4));
  } else if (method === '校园短驳车') {
    fedCoin = Math.max(1, Math.floor(distance * 2));
    note = '校内通勤';
  } else if (['魂导列车', '魂导汽车', '远洋巨轮'].includes(method)) {
    fedCoin = Math.floor(distance * 10);
  } else if (method === '飞行(机甲/斗铠)') {
    if (hasDoukai) {
      sp = Math.floor(distance * 12);
      vit = Math.max(1, Math.floor(distance * 2));
      note = '斗铠飞行';
    } else if (hasMecha) {
      sp = Math.floor(distance * 10);
      vit = Math.max(1, Math.floor(distance));
      fedCoin = Math.max(1, Math.floor(distance * 3));
      note = '机甲飞行';
    } else if (lv >= 70) {
      sp = Math.floor(distance * 20);
      vit = Math.max(1, Math.floor(distance * 5));
      note = '肉身飞行';
    } else {
      canAfford = false;
      reason = '需70级以上或装备机甲/斗铠';
    }
  } else if (method === '空间传送(极限斗罗)') {
    if (lv >= 98) {
      note = '极限传送';
    } else {
      canAfford = false;
      reason = '需极限斗罗或特殊权限';
    }
  } else if (method === '空间传送(神级)') {
    note = '神级传送';
  }

  const curCoin = Number(财富.联邦币 || 0);
  const curSp = Number(属性.魂力 || 0);
  const curVit = Number(属性.体力 || 0);
  if (canAfford && fedCoin > curCoin) {
    canAfford = false;
    reason = '联邦币不足';
  }
  if (canAfford && sp > curSp) {
    canAfford = false;
    reason = '魂力不足';
  }
  if (canAfford && vit > curVit) {
    canAfford = false;
    reason = '体力不足';
  }

  return { fedCoin, sp, vit, canAfford, reason, note };
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

function isWorldLocationName(locName, sd) {
  if (!locName || !sd) return false;
  const entry = findMapNodeEntry(locName, sd);
  return !!(entry && Array.isArray(entry.path) && entry.path.length <= 1);
}

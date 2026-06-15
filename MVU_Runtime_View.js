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
  '近战武器',
  '远程武器',
  '防具',
  '饰品',
  '魂导器',
  '斗铠',
  '机甲机体',
  '机甲部件',
  '锻造金属',
  '灵物',
  '丹药',
  '魂灵',
  '食物',
  '一次性道具',
  '设计图纸',
  '修炼秘籍',
  '任务物品',
  '其他',
]);

function 遍历物品定义_V1(物品表 = {}, 回调 = () => {}) {
  const 分类表 = 物品表 && typeof 物品表 === 'object' && !Array.isArray(物品表) ? 物品表 : {};
  物品分类列表_V1.forEach(分类 => {
    Object.entries(分类表[分类] || {}).forEach(([物品名, 定义]) => {
      if (!物品名 || !定义 || typeof 定义 !== 'object' || Array.isArray(定义)) return;
      回调(物品名, 定义, 分类);
    });
  });
}

function normalizeDynamicLocationNodeType(value = '', level = 4, locName = '') {
  const text = String(value || '').trim();
  const nameText = String(locName || '').trim();
  const lower = `${text} ${nameText}`.toLowerCase();
  if (['城市', '主城', '城镇', '大陆节点', '世界节点'].includes(text)) return '城市';
  if (['学院', '宗门', '协会', '组织驻地', '大型设施', '设施'].includes(text)) return text === '设施' ? '设施' : text;
  if (['街区', '小店', '营地', '建筑', '房间', '场景'].includes(text)) return text;
  if (/学院|school|academy/.test(lower)) return '学院';
  if (/协会|公会|guild|association/.test(lower)) return '协会';
  if (/宗门|唐门|传灵塔|史莱克|组织|总部/.test(lower)) return '组织驻地';
  if (/城|市|镇|大陆|region|city/.test(lower) || Number(level || 4) <= 2) return '城市';
  if (/街|坊|区|market|street/.test(lower)) return '街区';
  if (/店|铺|馆|商|shop|store/.test(lower)) return '小店';
  if (/营地|营区|camp/.test(lower)) return '营地';
  if (/房|室|宿舍|包厢|room/.test(lower)) return '房间';
  if (Number(level || 4) === 3) return '设施';
  if (Number(level || 4) >= 4) return '场景';
  return text || '未知';
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
var 内置角色预备出场窗口tick_V1 = 1440;

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
  const 之前快照 = 有tick快照.filter(快照 => Number(快照.tick) <= tick).sort((a, b) => Number(b.tick) - Number(a.tick))[0];
  if (之前快照) return 之前快照;
  return 有tick快照.sort((a, b) => Number(a.tick) - Number(b.tick))[0] || 快照列表[0] || null;
}

function 计算内置角色投影年龄_V1(快照 = {}, 当前tick = 0) {
  const 快照年龄 = Math.max(0, Number(快照?.年龄 ?? 快照?.角色?.属性?.年龄 ?? 0) || 0);
  if (快照?.固定年龄投影 === true) return 快照年龄;
  const 快照tick = Number(快照?.tick);
  if (!Number.isFinite(快照tick)) return 快照年龄;
  const 每年tick = Math.max(1, Number(读取内置角色库_V1().每年tick || 51840));
  return Math.max(0, 快照年龄 + (Number(当前tick || 0) - 快照tick) / 每年tick);
}

function 匹配文本内置角色名_V1(文本 = '', 当前tick = 0, 数据根 = {}) {
  const 内容 = String(文本 || '');
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

var MVU正文视图排除路径模板_V1 = ["当前","当前.地点","当前.时间","当前.时间._上次结算tick","当前.时间._calendar","当前.时间.tick","当前.玩家","当前.玩家行动","当前.系统播报","剧情钩子","剧情钩子._引导","剧情钩子.机密情报","剧情钩子.机密情报.示例情报","剧情钩子.机密情报.示例情报.内容","剧情钩子.拍卖","剧情钩子.拍卖.地点","剧情钩子.委托板","剧情钩子.委托板.示例委托","剧情钩子.委托板.示例委托.标题","剧情钩子.委托板.示例委托.描述","剧情钩子.战斗","物品.示例物品.基础耐久","物品.示例物品.阶位","物品.示例物品.使用效果","物品.示例物品.使用效果.[]","物品.示例物品.使用效果.[].持续tick","物品.示例物品.使用效果.[].描述","物品.示例物品.使用效果.[].目标","物品.示例物品.使用效果.[].属性","物品.示例物品.使用效果.[].数值","物品.示例物品.使用效果.[].原型","物品.示例物品.属性加成","物品.示例物品.属性加成.示例项","物品.示例物品.装备槽位","物品.示例物品.装备技能","物品.示例物品.装备技能.示例项","物品.示例物品.装备技能.示例项._效果数组","物品.示例物品.装备技能.示例项._效果数组.[]","物品.示例物品.装备技能.示例项.附带属性","物品.示例物品.装备技能.示例项.附带属性.[]","物品.示例物品.装备技能.示例项.画面描述","物品.示例物品.装备技能.示例项.魂技名","物品.示例物品.装备技能.示例项.机制决策临时","物品.示例物品.装备技能.示例项.前摇","物品.示例物品.装备技能.示例项.消耗","物品.示例物品.装备技能.示例项.效果描述","相关实体索引","相关实体索引.角色","相关实体索引.角色.[]","相关实体索引.命物品","相关实体索引.命物品.[]","相关实体索引.命中地点","相关实体索引.命中地点.[]","相关实体索引.命中动态地点","相关实体索引.命中动态地点.[]","相关实体索引.命中势力","相关实体索引.命中势力.[]","char.示例角色.__mvu_isPlayer","char.示例角色.临时突破","char.示例角色.第1武魂.第1魂灵.品质","char.示例角色.第1武魂.可调用元素","char.示例角色.第1武魂.可调用元素.[]","char.示例角色.第1武魂.属性体系","char.示例角色.*.第1魂环.第1魂技._效果数组","char.示例角色.*.第1魂环.第1魂技._效果数组.[]","char.示例角色.魂骨.示例项.附带技能.示例项","char.示例角色.魂骨.示例项.附带技能.示例项._效果数组","char.示例角色.魂骨.示例项.附带技能.示例项._效果数组.[]","char.示例角色.魂骨.示例项.附带技能.示例项.附带属性","char.示例角色.魂骨.示例项.附带技能.示例项.附带属性.[]","char.示例角色.魂骨.示例项.附带技能.示例项.机制决策临时","char.示例角色.魂骨.示例项.附带技能.示例项.技能掌控度","char.示例角色.魂骨.示例项.附带技能.示例项.技能掌控度.圆满等级","char.示例角色.魂骨.示例项.附带技能.示例项.技能掌控度.中心等级","char.示例角色.魂骨.示例项.附带技能.示例项.前摇","char.示例角色.魂骨.示例项.附带技能.示例项.消耗","char.示例角色.魂骨.示例项.属性加成","char.示例角色.魂骨.示例项.属性加成.防御","char.示例角色.魂骨.示例项.属性加成.魂力上限","char.示例角色.魂骨.示例项.属性加成.精神力上限","char.示例角色.魂骨.示例项.属性加成.力量","char.示例角色.魂骨.示例项.属性加成.敏捷","char.示例角色.魂骨.示例项.属性加成.体力上限","char.示例角色.魂骨.示例项.状态","char.示例角色.捐献请求","char.示例角色.捐献请求.目标势力","char.示例角色.捐献请求.数量","char.示例角色.捐献请求.物品名称","char.示例角色.社交.称号.示例项.声望加成","char.示例角色.社交.势力.示例势力.权限级","char.示例角色.属性.背景","char.示例角色.属性.背景阶层","char.示例角色.属性.等级惩罚","char.示例角色.属性.底子波动","char.示例角色.属性.防御","char.示例角色.属性.魂力","char.示例角色.属性.魂力上限","char.示例角色.属性.精神境界","char.示例角色.属性.精神力","char.示例角色.属性.精神力上限","char.示例角色.属性.力量","char.示例角色.属性.敏捷","char.示例角色.属性.上次灵物等级","char.示例角色.属性.体力","char.示例角色.属性.体力上限","char.示例角色.属性.天赋评级","char.示例角色.属性.天赋梯队","char.示例角色.属性.训练加成","char.示例角色.属性.训练加成.防御","char.示例角色.属性.训练加成.精神力上限","char.示例角色.属性.训练加成.力量","char.示例角色.属性.训练加成.敏捷","char.示例角色.属性.训练加成.体力上限","char.示例角色.属性.状态效果","char.示例角色.属性.状态效果.示例项","char.示例角色.属性.状态效果.示例项.层数","char.示例角色.属性.状态效果.示例项.持续回合","char.示例角色.属性.状态效果.示例项.类型","char.示例角色.属性.状态效果.示例项.面板倍率","char.示例角色.属性.状态效果.示例项.面板倍率.防御","char.示例角色.属性.状态效果.示例项.面板倍率.魂力上限","char.示例角色.属性.状态效果.示例项.面板倍率.力量","char.示例角色.属性.状态效果.示例项.面板倍率.敏捷","char.示例角色.属性.状态效果.示例项.描述","char.示例角色.属性.状态效果.示例项.战斗效果","char.示例角色.属性.状态效果.示例项.战斗效果.持续伤害","char.示例角色.属性.状态效果.示例项.战斗效果.破防比例","char.示例角色.属性.状态效果.示例项.战斗效果.跳过回合","char.示例角色.属性.HP","char.示例角色.属性.HP上限","char.示例角色.武魂融合技.示例项","char.示例角色.武魂融合技.示例项.技能数据","char.示例角色.武魂融合技.示例项.技能数据._效果数组","char.示例角色.武魂融合技.示例项.技能数据._效果数组.[]","char.示例角色.武魂融合技.示例项.技能数据.附带属性","char.示例角色.武魂融合技.示例项.技能数据.附带属性.[]","char.示例角色.武魂融合技.示例项.技能数据.机制决策临时","char.示例角色.武魂融合技.示例项.技能数据.技能掌控度","char.示例角色.武魂融合技.示例项.技能数据.技能掌控度.圆满等级","char.示例角色.武魂融合技.示例项.技能数据.技能掌控度.中心等级","char.示例角色.武魂融合技.示例项.技能数据.前摇","char.示例角色.武魂融合技.示例项.技能数据.消耗","char.示例角色.血脉之力.被动.示例项._效果数组","char.示例角色.血脉之力.被动.示例项._效果数组.[]","char.示例角色.血脉之力.被动.示例项.附带属性","char.示例角色.血脉之力.被动.示例项.附带属性.[]","char.示例角色.血脉之力.被动.示例项.机制决策临时","char.示例角色.血脉之力.被动.示例项.技能掌控度","char.示例角色.血脉之力.被动.示例项.技能掌控度.圆满等级","char.示例角色.血脉之力.被动.示例项.技能掌控度.中心等级","char.示例角色.血脉之力.被动.示例项.前摇","char.示例角色.血脉之力.被动.示例项.消耗","char.示例角色.血脉之力.技能.示例项","char.示例角色.血脉之力.技能.示例项._效果数组","char.示例角色.血脉之力.技能.示例项._效果数组.[]","char.示例角色.血脉之力.技能.示例项.附带属性","char.示例角色.血脉之力.技能.示例项.附带属性.[]","char.示例角色.血脉之力.技能.示例项.机制决策临时","char.示例角色.血脉之力.技能.示例项.技能掌控度","char.示例角色.血脉之力.技能.示例项.技能掌控度.圆满等级","char.示例角色.血脉之力.技能.示例项.技能掌控度.中心等级","char.示例角色.血脉之力.技能.示例项.前摇","char.示例角色.血脉之力.技能.示例项.消耗","char.示例角色.血脉之力.永久加成","char.示例角色.血脉之力.永久加成.示例项","char.示例角色.血脉之力.永久加成.示例项.来源层级","char.示例角色.血脉之力.永久加成.示例项.属性加成","char.示例角色.血脉之力.永久加成.示例项.属性加成.防御","char.示例角色.血脉之力.永久加成.示例项.属性加成.魂力上限","char.示例角色.血脉之力.永久加成.示例项.属性加成.精神力上限","char.示例角色.血脉之力.永久加成.示例项.属性加成.力量","char.示例角色.血脉之力.永久加成.示例项.属性加成.敏捷","char.示例角色.血脉之力.永久加成.示例项.属性加成.体力上限","char.示例角色.血脉之力.永久加成.示例项.效果描述","char.示例角色.血脉之力.永久加成.示例项.状态","char.示例角色.装备.斗铠._属性加成","char.示例角色.装备.斗铠._属性加成.等效等级","char.示例角色.装备.斗铠._属性加成.防御","char.示例角色.装备.斗铠._属性加成.魂力上限","char.示例角色.装备.斗铠._属性加成.精神力上限","char.示例角色.装备.斗铠._属性加成.力量","char.示例角色.装备.斗铠._属性加成.敏捷","char.示例角色.装备.斗铠._属性加成.体力上限","char.示例角色.装备.斗铠._已排异","char.示例角色.装备.斗铠.部件","char.示例角色.装备.斗铠.部件.示例项","char.示例角色.装备.斗铠.部件.示例项.品质系数","char.示例角色.装备.斗铠.部件.示例项.状态","char.示例角色.装备.机甲","char.示例角色.装备.机甲._属性加成","char.示例角色.装备.机甲._属性加成.防御","char.示例角色.装备.机甲._属性加成.魂力上限","char.示例角色.装备.机甲._属性加成.精神力上限","char.示例角色.装备.机甲._属性加成.力量","char.示例角色.装备.机甲._属性加成.敏捷","char.示例角色.装备.机甲._属性加成.体力上限","char.示例角色.装备.机甲.品质系数","char.示例角色.装备.武器.属性加成","char.示例角色.装备.武器.属性加成.防御","char.示例角色.装备.武器.属性加成.魂力上限","char.示例角色.装备.武器.属性加成.精神力上限","char.示例角色.装备.武器.属性加成.力量","char.示例角色.装备.武器.属性加成.敏捷","char.示例角色.装备.武器.属性加成.体力上限","char.示例角色.状态.横坐标","char.示例角色.状态.纵坐标","char.示例角色.状态.HP","char.示例角色.自创魂技","char.示例角色.自创魂技.示例项","char.示例角色.自创魂技.示例项._效果数组","char.示例角色.自创魂技.示例项._效果数组.[]","char.示例角色.自创魂技.示例项.附带属性","char.示例角色.自创魂技.示例项.附带属性.[]","char.示例角色.自创魂技.示例项.机制决策临时","char.示例角色.自创魂技.示例项.技能掌控度","char.示例角色.自创魂技.示例项.技能掌控度.圆满等级","char.示例角色.自创魂技.示例项.技能掌控度.中心等级","char.示例角色.自创魂技.示例项.前摇","char.示例角色.自创魂技.示例项.消耗","sys","sys.玩家名","sys.最终成功率","world.地点.示例地点.经济状况","world.地点.示例地点.子节点.示例项","world.地点.示例地点.x","world.地点.示例地点.y","world.动态地点.示例动态地点.层级","world.动态地点.示例动态地点.重要度","world.动态地点.示例动态地点.x","world.动态地点.示例动态地点.y","world.累计击杀年限","world.偏差倍率","world.偏差值","world.时间._上次结算tick","world.时间._calendar","world.时间.tick","world.图鉴","world.图鉴.示例图鉴","world.图鉴.示例图鉴.成长倾向","world.图鉴.示例图鉴.当前档经验","world.图鉴.示例图鉴.击杀次数","world.图鉴.示例图鉴.交手次数","world.图鉴.示例图鉴.情报协同系数","world.图鉴.示例图鉴.任务协同系数","world.图鉴.示例图鉴.探索收益","world.图鉴.示例图鉴.图鉴档位","world.图鉴.示例图鉴.下档需求","world.图鉴.示例图鉴.战斗标签样本","world.图鉴.示例图鉴.战斗标签样本.示例项","world.图鉴.示例图鉴.战斗收益","world.图鉴.示例图鉴.战斗样本数","world.图鉴.示例图鉴.最近活跃tick","world.图鉴.示例图鉴.最近升档tick","world.图鉴.示例图鉴.最近战斗标签","world.委托板","world.委托板.示例委托","world.委托板.示例委托.承接者","world.委托板.示例委托.发布者","world.委托板.示例委托.奖励币","world.委托板.示例委托.奖励声望","world.委托板.示例委托.面向","world.委托板.示例委托.难度","world.委托板.示例委托.生成tick","world.委托板.示例委托.指定对象","world.委托板.示例委托.状态","world.委托板.示例委托.资源级别","world.战斗","world.战斗.裁断结果","world.战斗.参战者","world.战斗.参战者.示例项","world.战斗.环境","world.战斗.回合","world.战斗.进行中","world.战斗.先攻","world.战斗.允许撤离","world.战斗.战斗类型","world.战斗.战斗意图"];
var MVU更新视图排除路径模板_V1 = ["当前","当前.地点","当前.时间","当前.时间._上次结算tick","当前.时间._calendar","当前.时间.tick","当前.玩家","当前.玩家行动","当前.系统播报","剧情钩子","剧情钩子._引导","剧情钩子.机密情报","剧情钩子.机密情报.示例情报","剧情钩子.机密情报.示例情报.内容","剧情钩子.拍卖","剧情钩子.拍卖.地点","剧情钩子.委托板","剧情钩子.委托板.示例委托","剧情钩子.委托板.示例委托.标题","剧情钩子.委托板.示例委托.描述","剧情钩子.战斗","物品.示例物品.属性加成.示例项","物品.示例物品.装备技能.示例项","物品.示例物品.装备技能.示例项._效果数组","物品.示例物品.装备技能.示例项._效果数组.[]","物品.示例物品.装备技能.示例项.附带属性","物品.示例物品.装备技能.示例项.附带属性.[]","物品.示例物品.装备技能.示例项.画面描述","物品.示例物品.装备技能.示例项.魂技名","物品.示例物品.装备技能.示例项.机制决策临时","物品.示例物品.装备技能.示例项.前摇","物品.示例物品.装备技能.示例项.消耗","物品.示例物品.装备技能.示例项.效果描述","相关实体索引","相关实体索引.角色","相关实体索引.角色.[]","相关实体索引.命物品","相关实体索引.命物品.[]","相关实体索引.命中地点","相关实体索引.命中地点.[]","相关实体索引.命中动态地点","相关实体索引.命中动态地点.[]","相关实体索引.命中势力","相关实体索引.命中势力.[]","char.示例角色.__mvu_isPlayer","char.示例角色.第1武魂.可调用元素","char.示例角色.第1武魂.可调用元素.[]","char.示例角色.魂骨.示例项.附带技能.示例项","char.示例角色.魂骨.示例项.附带技能.示例项._效果数组","char.示例角色.魂骨.示例项.附带技能.示例项._效果数组.[]","char.示例角色.魂骨.示例项.附带技能.示例项.技能掌控度","char.示例角色.魂骨.示例项.附带技能.示例项.技能掌控度.圆满等级","char.示例角色.魂骨.示例项.附带技能.示例项.技能掌控度.中心等级","char.示例角色.魂骨.示例项.附带技能.示例项.前摇","char.示例角色.魂骨.示例项.附带技能.示例项.消耗.**","char.示例角色.魂骨.示例项.属性加成","char.示例角色.魂骨.示例项.属性加成.防御","char.示例角色.魂骨.示例项.属性加成.魂力上限","char.示例角色.魂骨.示例项.属性加成.精神力上限","char.示例角色.魂骨.示例项.属性加成.力量","char.示例角色.魂骨.示例项.属性加成.敏捷","char.示例角色.魂骨.示例项.属性加成.体力上限","char.示例角色.魂骨.示例项.状态","char.示例角色.捐献请求","char.示例角色.捐献请求.目标势力","char.示例角色.捐献请求.数量","char.示例角色.捐献请求.物品名称","char.示例角色.社交.称号","char.示例角色.社交.称号.示例项","char.示例角色.社交.称号.示例项.来源","char.示例角色.社交.称号.示例项.声望加成","char.示例角色.社交.关系.示例角色._当前关系加成","char.示例角色.社交.关系.示例角色._关系阶段","char.示例角色.社交.关系.示例角色._可切线","char.示例角色.社交.关系.示例角色._切线限制原因","char.示例角色.社交.关系.示例角色._推进提示","char.示例角色.社交.关系.示例角色._维护优先级","char.示例角色.社交.关系.示例角色._下档解锁加成","char.示例角色.社交.关系.示例角色._下档解锁阈值","char.示例角色.社交.关系.示例角色._下一阶段","char.示例角色.社交.关系.示例角色._下一阶段阈值","char.示例角色.社交.关系分析","char.示例角色.社交.关系分析.风险对象","char.示例角色.社交.关系分析.风险对象.[]","char.示例角色.社交.关系分析.关注对象","char.示例角色.社交.关系分析.可联络对象","char.示例角色.社交.关系分析.可联络对象.[]","char.示例角色.社交.关系分析.恋爱候选","char.示例角色.社交.关系分析.恋爱候选.[]","char.示例角色.社交.关系分析.受阻对象","char.示例角色.社交.关系分析.受阻对象.[]","char.示例角色.社交.关系分析.受阻对象.[].对象","char.示例角色.社交.关系分析.受阻对象.[].原因","char.示例角色.社交.关系分析.同地对象","char.示例角色.社交.关系分析.同地对象.[]","char.示例角色.社交.关系分析.信任对象","char.示例角色.社交.关系分析.信任对象.[]","char.示例角色.社交.关系分析.摘要","char.示例角色.社交.关系分析.重点对象","char.示例角色.社交.名望等级","char.示例角色.属性.背景","char.示例角色.属性.背景阶层","char.示例角色.属性.等级","char.示例角色.属性.等级惩罚","char.示例角色.属性.底子波动","char.示例角色.属性.防御","char.示例角色.属性.魂力上限","char.示例角色.属性.精神境界","char.示例角色.属性.精神力上限","char.示例角色.属性.力量","char.示例角色.属性.敏捷","char.示例角色.属性.上次灵物等级","char.示例角色.属性.体力上限","char.示例角色.属性.天赋评级","char.示例角色.属性.天赋梯队","char.示例角色.属性.训练加成","char.示例角色.属性.训练加成.防御","char.示例角色.属性.训练加成.精神力上限","char.示例角色.属性.训练加成.力量","char.示例角色.属性.训练加成.敏捷","char.示例角色.属性.训练加成.体力上限","char.示例角色.属性.状态效果","char.示例角色.属性.状态效果.示例项","char.示例角色.属性.状态效果.示例项.层数","char.示例角色.属性.状态效果.示例项.持续回合","char.示例角色.属性.状态效果.示例项.类型","char.示例角色.属性.状态效果.示例项.面板倍率","char.示例角色.属性.状态效果.示例项.面板倍率.防御","char.示例角色.属性.状态效果.示例项.面板倍率.魂力上限","char.示例角色.属性.状态效果.示例项.面板倍率.力量","char.示例角色.属性.状态效果.示例项.面板倍率.敏捷","char.示例角色.属性.状态效果.示例项.描述","char.示例角色.属性.状态效果.示例项.战斗效果","char.示例角色.属性.状态效果.示例项.战斗效果.持续伤害","char.示例角色.属性.状态效果.示例项.战斗效果.破防比例","char.示例角色.属性.状态效果.示例项.战斗效果.跳过回合","char.示例角色.属性.HP上限","char.示例角色.武魂融合技.示例项","char.示例角色.武魂融合技.示例项.技能数据","char.示例角色.武魂融合技.示例项.技能数据._效果数组","char.示例角色.武魂融合技.示例项.技能数据._效果数组.[]","char.示例角色.武魂融合技.示例项.技能数据.技能掌控度","char.示例角色.武魂融合技.示例项.技能数据.技能掌控度.圆满等级","char.示例角色.武魂融合技.示例项.技能数据.技能掌控度.中心等级","char.示例角色.武魂融合技.示例项.技能数据.前摇","char.示例角色.武魂融合技.示例项.技能数据.消耗.**","char.示例角色.血脉之力","char.示例角色.血脉之力.被动","char.示例角色.血脉之力.被动.示例项","char.示例角色.血脉之力.被动.示例项._效果数组","char.示例角色.血脉之力.被动.示例项._效果数组.[]","char.示例角色.血脉之力.被动.示例项.附带属性","char.示例角色.血脉之力.被动.示例项.附带属性.[]","char.示例角色.血脉之力.被动.示例项.机制决策临时","char.示例角色.血脉之力.被动.示例项.技能掌控度","char.示例角色.血脉之力.被动.示例项.技能掌控度.圆满等级","char.示例角色.血脉之力.被动.示例项.技能掌控度.中心等级","char.示例角色.血脉之力.被动.示例项.前摇","char.示例角色.血脉之力.被动.示例项.消耗","char.示例角色.血脉之力.技能.示例项","char.示例角色.血脉之力.技能.示例项._效果数组","char.示例角色.血脉之力.技能.示例项._效果数组.[]","char.示例角色.血脉之力.技能.示例项.附带属性","char.示例角色.血脉之力.技能.示例项.附带属性.[]","char.示例角色.血脉之力.技能.示例项.机制决策临时","char.示例角色.血脉之力.技能.示例项.技能掌控度","char.示例角色.血脉之力.技能.示例项.技能掌控度.圆满等级","char.示例角色.血脉之力.技能.示例项.技能掌控度.中心等级","char.示例角色.血脉之力.技能.示例项.前摇","char.示例角色.血脉之力.技能.示例项.消耗","char.示例角色.血脉之力.永久加成","char.示例角色.血脉之力.永久加成.示例项","char.示例角色.血脉之力.永久加成.示例项.来源层级","char.示例角色.血脉之力.永久加成.示例项.属性加成","char.示例角色.血脉之力.永久加成.示例项.属性加成.防御","char.示例角色.血脉之力.永久加成.示例项.属性加成.魂力上限","char.示例角色.血脉之力.永久加成.示例项.属性加成.精神力上限","char.示例角色.血脉之力.永久加成.示例项.属性加成.力量","char.示例角色.血脉之力.永久加成.示例项.属性加成.敏捷","char.示例角色.血脉之力.永久加成.示例项.属性加成.体力上限","char.示例角色.血脉之力.永久加成.示例项.效果描述","char.示例角色.血脉之力.永久加成.示例项.状态","char.示例角色.副职业","char.示例角色.副职业.示例项","char.示例角色.副职业.示例项.称号","char.示例角色.副职业.示例项.经验","char.示例角色.装备.斗铠._属性加成","char.示例角色.装备.斗铠._属性加成.等效等级","char.示例角色.装备.斗铠._属性加成.防御","char.示例角色.装备.斗铠._属性加成.魂力上限","char.示例角色.装备.斗铠._属性加成.精神力上限","char.示例角色.装备.斗铠._属性加成.力量","char.示例角色.装备.斗铠._属性加成.敏捷","char.示例角色.装备.斗铠._属性加成.体力上限","char.示例角色.装备.斗铠._已排异","char.示例角色.装备.斗铠.部件","char.示例角色.装备.斗铠.部件.示例项","char.示例角色.装备.斗铠.部件.示例项.品质系数","char.示例角色.装备.斗铠.部件.示例项.状态","char.示例角色.装备.机甲._属性加成","char.示例角色.装备.机甲._属性加成.防御","char.示例角色.装备.机甲._属性加成.魂力上限","char.示例角色.装备.机甲._属性加成.精神力上限","char.示例角色.装备.机甲._属性加成.力量","char.示例角色.装备.机甲._属性加成.敏捷","char.示例角色.装备.机甲._属性加成.体力上限","char.示例角色.装备.机甲.品质系数","char.示例角色.装备.武器.属性加成","char.示例角色.装备.武器.属性加成.防御","char.示例角色.装备.武器.属性加成.魂力上限","char.示例角色.装备.武器.属性加成.精神力上限","char.示例角色.装备.武器.属性加成.力量","char.示例角色.装备.武器.属性加成.敏捷","char.示例角色.装备.武器.属性加成.体力上限","char.示例角色.状态.横坐标","char.示例角色.状态.吸收灵物年限","char.示例角色.状态.纵坐标","char.示例角色.自创魂技","char.示例角色.自创魂技.示例项","char.示例角色.自创魂技.示例项._效果数组","char.示例角色.自创魂技.示例项._效果数组.[]","char.示例角色.自创魂技.示例项.技能掌控度","char.示例角色.自创魂技.示例项.技能掌控度.圆满等级","char.示例角色.自创魂技.示例项.技能掌控度.中心等级","char.示例角色.自创魂技.示例项.前摇","char.示例角色.自创魂技.示例项.消耗.**","sys","sys.玩家名","sys.最终成功率","world.地点.示例地点.商店.示例商店","world.地点.示例地点.商店.示例商店._下次刷新tick","world.地点.示例地点.商店.示例商店.库存","world.地点.示例地点.商店.示例商店.库存.示例物品","world.地点.示例地点.商店.示例商店.库存.示例物品.价格倍率","world.地点.示例地点.商店.示例商店.库存.示例物品.库存","world.地点.示例地点.商店.示例商店.库存.示例物品.需求","world.地点.示例地点.商店.示例商店.库存.示例物品.需求.示例项","world.地点.示例地点.商店.示例商店.库存.示例物品.需求声望","world.地点.示例地点.商店.示例商店.库存.示例物品.折扣","world.地点.示例地点.子节点.示例项","world.地点.示例地点.x","world.地点.示例地点.y","world.动态地点.示例动态地点.重要度","world.累计击杀年限","world.拍卖.拍品","world.拍卖.拍品.示例项","world.拍卖.拍品.示例项.背景","world.拍卖.拍品.示例项.价格","world.拍卖.拍品.示例项.品级","world.拍卖.下次刷新tick","world.拍卖.状态","world.偏差倍率","world.时间._上次结算tick","world.时间._calendar","world.图鉴.示例图鉴.成长倾向","world.图鉴.示例图鉴.当前档经验","world.图鉴.示例图鉴.击杀次数","world.图鉴.示例图鉴.交手次数","world.图鉴.示例图鉴.情报协同系数","world.图鉴.示例图鉴.任务协同系数","world.图鉴.示例图鉴.探索收益","world.图鉴.示例图鉴.下档需求","world.图鉴.示例图鉴.战斗标签样本","world.图鉴.示例图鉴.战斗标签样本.示例项","world.图鉴.示例图鉴.战斗收益","world.图鉴.示例图鉴.战斗样本数","world.图鉴.示例图鉴.最近活跃tick","world.图鉴.示例图鉴.最近升档tick","world.图鉴.示例图鉴.最近战斗标签","world.战斗","world.战斗.裁断结果","world.战斗.参战者","world.战斗.参战者.示例项","world.战斗.环境","world.战斗.回合","world.战斗.进行中","world.战斗.先攻","world.战斗.允许撤离","world.战斗.战斗类型","world.战斗.战斗意图","char.示例角色.第1武魂.第1魂灵.第1魂环.第1魂技.前摇","char.示例角色.第1武魂.第1魂灵.第1魂环.第1魂技.消耗.**","char.示例角色.第1武魂.第1魂灵.第1魂环.第1魂技.技能掌控度","char.示例角色.第1武魂.第1魂灵.第1魂环.第1魂技.技能掌控度.圆满等级","char.示例角色.第1武魂.第1魂灵.第1魂环.第1魂技.技能掌控度.中心等级","char.示例角色.魂骨.示例项.属性倍率.**"];
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

function 过滤MVU运行时视图值_V1(值, 路径 = [], 选项 = {}) {
  const 排除路径列表 = 选项.排除路径列表 || [];
  const 正文模式 = 选项.正文模式 === true;
  const 字段名 = String(路径[路径.length - 1] || '');
  if (正文模式 && 字段名 === '死亡tick' && Number(值) < 0) return undefined;
  if (正文模式 && 字段名 === '死亡类型' && (!String(值 || '').trim() || String(值 || '').trim() === '无')) return undefined;
  const 排除状态 = MVU视图路径排除状态_V1(路径, 排除路径列表);
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
  if (正文模式) return 正文视图值已初始化_V1(值) ? (typeof 值 === 'string' ? 值.trim() : 值) : undefined;
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
    地点数据?.节点类型,
    地点数据?.势力,
    地点数据?.状态 || 地点数据?.state,
  ].filter(Boolean).join(' / ').slice(0, 160);
  return {
    归属父节点: String(地点数据?.归属父节点 || ''),
    节点类型: String(地点数据?.节点类型 || ''),
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
  const 目录 = 构建运行时动态地点目录_V1(数据根, 选项.动态地点目录);
  const 阈值 = Math.max(1, Math.floor(Number(选项.阈值 ?? 5)));
  const 上限 = Math.max(1, Math.floor(Number(选项.上限 ?? 8)));
  return Object.entries(目录)
    .map(([名称, 索引]) => 计算运行时动态地点命中_V1(名称, 索引, 文本, 数据根, 选项))
    .filter(命中 => 命中 && 命中.分数 >= 阈值)
    .sort((左, 右) => 右.分数 - 左.分数 || 左.名称.localeCompare(右.名称, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' }))
    .slice(0, 上限);
}

function 收集运行时物品命中_V1(数据输入 = {}, 文本 = '', 选项 = {}) {
  const 数据根 = 读取运行时Mvu数据根_V1(数据输入) || {};
  const 目录 = 构建运行时物品目录_V1(数据根, 选项.物品目录);
  const 物品候选上下文 = 构建运行时物品候选上下文_V1(数据根, 文本, 选项);
  const 命中选项 = { ...选项, ...物品候选上下文 };
  const 阈值 = Math.max(1, Math.floor(Number(选项.阈值 ?? 5)));
  const 上限 = Math.max(1, Math.floor(Number(选项.上限 ?? 12)));
  return Object.entries(目录)
    .map(([名称, 索引]) => 计算运行时物品命中_V1(名称, 索引, 文本, 数据根, 命中选项))
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
  const 战斗记录 = 目标名称 ? 观察者?.战斗历史?.[目标名称] : null;
  const 生成可见度 = (状态, 依据) => ({
    观察者: 观察名,
    目标: 目标名称,
    状态,
    依据,
  });
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
  const 源文本 = String(文本 || '');
  const 结果 = { 角色: new Set(), 地点: new Set(), 动态地点: new Set(), 势力: new Set(), 物品: new Set() };
  Object.keys(数据根?.char || {}).forEach(名称 => {
    if (运行时文本命中名称_V1(源文本, 名称)) 结果.角色.add(名称);
  });
  Object.keys(数据根?.world?.地点 || {}).forEach(名称 => {
    if (运行时文本命中名称_V1(源文本, 名称)) 结果.地点.add(名称);
  });
  Object.keys(数据根?.world?.动态地点 || {}).forEach(名称 => {
    if (运行时文本命中名称_V1(源文本, 名称)) 结果.动态地点.add(名称);
  });
  Object.keys(数据根?.org || {}).forEach(名称 => {
    if (运行时文本命中名称_V1(源文本, 名称)) 结果.势力.add(名称);
  });
  Object.keys(构建运行时物品目录_V1(数据根)).forEach(名称 => {
    if (运行时文本命中商品名_V1(源文本, 名称)) 结果.物品.add(名称);
  });
  return 结果;
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
  if (!值 || typeof 值 !== 'object' || Array.isArray(值)) return cloneJsonValue(值, 值);
  const 文本路径 = (Array.isArray(路径) ? 路径 : []).map(片段 => String(片段));
  const 类型值 = 规范化AIJsonPatch对象值_V1(文本路径, 值, 根);
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

function 规范化AIJsonPatch任务对象值_V1(路径 = [], 值 = {}, 根 = {}) {
  const 文本路径 = (Array.isArray(路径) ? 路径 : []).map(片段 => String(片段));
  if (!(文本路径.length === 4 && 文本路径[0] === 'char' && 文本路径[2] === '我的任务')) return cloneJsonValue(值, 值);
  const 输入 = 值 && typeof 值 === 'object' && !Array.isArray(值) ? cloneJsonValue(值, {}) : {};
  if (Object.prototype.hasOwnProperty.call(输入, '目前进度') && !Object.prototype.hasOwnProperty.call(输入, '当前进度')) {
    输入.当前进度 = 输入.目前进度;
    delete 输入.目前进度;
  }
  const 当前tick = Math.max(0, Number(根?.world?.时间?.tick || 0));
  return {
    任务线: String(输入.任务线 || '支线').trim() || '支线',
    状态: String(输入.状态 || '进行中').trim() || '进行中',
    当前进度: Math.max(0, Math.min(100, Number(输入.当前进度 || 0))),
    奖励币: Math.max(0, Number(输入.奖励币 || 0)),
    奖励声望: Math.max(0, Number(输入.奖励声望 || 0)),
    描述: String(输入.描述 || '待生成').trim() || '待生成',
    最后更新时间tick: Math.max(0, Number(输入.最后更新时间tick || 当前tick || 0)),
    ...Object.fromEntries(Object.entries(输入).filter(([键]) => !['任务线', '状态', '当前进度', '奖励币', '奖励声望', '描述', '最后更新时间tick'].includes(键))),
  };
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
  const 状态值 = 规范化AIJsonPatch状态效果值_V1(路径, 任务值);
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
  if (路径.length === 3 && 路径[0] === 'char' && 路径[2] === '任务') return ['char', 路径[1], '我的任务'];
  if (路径.length === 2 && 路径[0] === 'world' && ['任务板', '委托', '委托任务'].includes(路径[1])) return ['world', '委托板'];
  if (路径.length === 1 && ['item', 'items', '物品表'].includes(路径[0])) return ['物品'];
  if (路径.length === 3 && 路径[0] === 'char' && ['物品', '库存'].includes(路径[2])) return ['char', 路径[1], '背包'];
  return null;
}

function 规范化AIJsonPatch列表_V1(patches = [], 数据输入 = {}, options = {}) {
  const 根 = 读取运行时Mvu数据根_V1(数据输入) || {};
  const 来源列表 = Array.isArray(patches) ? patches : [];
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
    return { ...patch, op, path: 构建运行时JsonPointer路径_V1(路径) };
  });
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
  return `待补全总数=xx/${总数}; 角色=${角色文本 || '无'}; 角色外=xx/${角色外总数}项. 只把 xx 替换为本轮实际补全数量；不要列路径或具体值。“剧情尚未涉及”“正文未直接描写”“暂不补全”不是有效理由。可根据当前角色设定、武魂/魂灵来源、字段名、父级对象和世界观常识推断稳定值。不能泛称剧情尚未涉及。`;
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

function 生成MVU更新结构提示_V1(数据输入 = null, userInput = '', 最后角色消息输入 = '', plotText = '') {
  const 数据根 = 读取运行时Mvu数据根_V1(数据输入) || {};
  const 最后角色消息文本 = String(最后角色消息输入 || '').trim() || 读取运行时最后角色消息文本_V1();
  const 命中文本 = [userInput, 最后角色消息文本].map(文本 => String(文本 || '').trim()).filter(Boolean).join('\n');
  const 运行时命中上下文 = 构建运行时命中上下文_V1(数据根, 命中文本);
  const 命中 = 运行时命中上下文.运行时命中名称;
  const 角色名集合 = 取运行时基础角色名集合_V1(数据根, 命中文本, { 运行时命中名称: 命中 });
  const 物品候选上下文 = 构建运行时物品候选上下文_V1(数据根, 命中文本, { 角色名集合 });
  const 更新视图选项 = { 运行时命中名称: 命中, 角色名集合, ...物品候选上下文 };
  const 更新视图 = 生成MVU更新视图_V1(数据根, userInput, 最后角色消息文本, plotText, 更新视图选项);
  const 可见占位统计 = 收集运行时可见占位统计_V1(更新视图);
  const 魂技待补全路径 = 收集运行时魂技待补全路径_V1(更新视图);
 
  return [
    'Existing MVU Entity Hits:',
    'Only names listed here count as already existing in MVU. Lore-known, worldbook-known, narratively familiar, or previously mentioned names do NOT count as existing unless listed here.',
    `char=${格式化MVU更新结构命中列表_V1(命中.角色)}; world.地点=${格式化MVU更新结构命中列表_V1(命中.地点)}; world.动态地点=${格式化MVU更新结构命中列表_V1(命中.动态地点)}; org=${格式化MVU更新结构命中列表_V1(命中.势力)}; 物品=${格式化MVU更新结构命中列表_V1(命中.物品)}.`,
    '',
    'Visible Placeholder Summary:',
    `待补全总数=${Number(可见占位统计?.总数 || 0)}; 角色=${(Array.isArray(可见占位统计.角色) ? 可见占位统计.角色 : []).filter(项 => 项 && 项.名称 !== '角色外' && Number(项.数量 || 0) > 0).map(项 => `${项.名称}${Number(项.数量 || 0)}项`).join('、') || '无'}; 角色外=${Number(可见占位统计?.角色外 || 0)}项.`,
    '',
    '[Placeholder Check]',
    格式化运行时占位统计_V1(可见占位统计),
    ...格式化运行时魂技待补全路径提示_V1(魂技待补全路径),
    '',
  '[Scene Presence & New Entity Check]',
  'You MUST audit and register newly introduced, durable entities before patching:',
  '1. 【Important Entity Diff】: Compare characters/places in this reply with "Existing MVU Entity Hits". First check if the entity already exists in the hits; if it exists, you are strictly PROHIBITED from adding it again! Only register when a completely NEW character/place with a proper name enters the long-term plot.',
  '2. 【Filter Passing NPCs/Scenes】: Strictly IGNORE generic descriptive NPCs (e.g., "板寸头", "瘦高个", "胖宿管") and one-off background places. Do NOT create MVU entities for them.',
  '3. 【Location Granularity Lock (FATAL)】: ABSOLUTELY FORBIDDEN to register micro-locations (e.g., specific rooms like "104号宿舍", floors, seats, corridors) as new locations! You MUST snap them to the parent 【Major Building/Functional Area】 (e.g., "宿舍区", "教学楼"). If a character enters "104号宿舍" and "宿舍区" is already in Hits, the location is deemed ALREADY EXISTING. DO NOT register it in the table!',
  '',
  'New Entity Table:',
  'char=Insert new durable characters with formal names (if none, write 无); world.动态地点=Insert new building-level locations (Micro-rooms/floors STRICTLY PROHIBITED. If parent area exists, force 无); org=Insert new factions (if none, write 无); 物品=Insert new important plot items (generic keys/clothes write 无).',
    '',
    'When registering a NEW character via /char/${name}',
    'TIER 1 — Init-critical inputs (MUST provide on insert;): 属性.年龄 (number), 属性.生日 (e.g. "3月14日"), 属性.背景阶层 (e.g. 顶级势力/一流势力/普通势力/平民), 属性.天赋评级 (1-100 number).',
    '特殊剧情突破：不要直接写 属性.等级；当正文里出现临时突破时，只在更新视图里把对应角色的 临时突破 改为突破后的等级数字。',
    '',
    '[Task/Commission Creation]',
    '剧情中新出现长期个人目标时，直接写 /char/${角色名}/我的任务/${任务名}，字段={任务线,状态,当前进度,奖励币,奖励声望,描述,最后更新时间tick}；任务线=主线/支线；当前进度按百分比数字填写，0=刚开始，100=完成。',
    '剧情中新出现公开/指定委托时，直接写 /world/委托板/${委托名}，字段={标题,描述,框架描述,发布者,面向,指定对象,状态,难度,资源级别,奖励币,奖励声望,承接者,生成tick}.',
    '若剧情中委托已被角色当场接下，同时写 char.我的任务 与 world.委托板；若只是一次性小动作，不创建持久任务或委托。',
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
  (Array.isArray(当前地点信息?.path) ? 当前地点信息.path : []).forEach(地点名 => 地点名集合.add(地点名));
  const 命中名称 = 构建运行时命中上下文_V1(数据根, 文本, 选项).运行时命中名称;
  命中名称.地点.forEach(地点名 => 地点名集合.add(地点名));
  return 地点名集合;
}

function 取运行时动态地点名集合_V1(数据根 = {}, 文本 = '') {
  const { 当前地点, 当前范围名集合 } = 取运行时当前范围_V1(数据根);
  const 动态地点名集合 = new Set();
  Object.entries(数据根?.world?.动态地点 || {}).forEach(([动态地点名, 动态地点数据]) => {
    if (运行时动态地点在当前范围_V1(动态地点名, 动态地点数据, 当前范围名集合)) 动态地点名集合.add(动态地点名);
  });
  收集运行时动态地点命中_V1(数据根, 文本, {
    当前地点,
    命中动态地点: 数据根?.相关实体索引?.命中动态地点,
    阈值: 5,
    上限: 12,
  }).forEach(命中 => 动态地点名集合.add(命中.名称));
  return 动态地点名集合;
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
  const 刷新tick = Number(商店数据.下次刷新tick || 0);
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
  const 地点基础 = cloneJsonValue(地点数据, {});
  if (地点基础 && typeof 地点基础 === 'object') delete 地点基础.商店;
  return 过滤MVU更新视图值_V1(准备运行时地图视图数据_V1(地点基础), ['world', '地点', '示例地点']) || {};
}

function 构建更新动态地点条目_V1(地点数据 = {}, 地点名 = '') {
  const 地点 = 地点数据 && typeof 地点数据 === 'object' ? 地点数据 : {};
  return 过滤MVU更新视图值_V1({
    归属父节点: 地点.归属父节点 || '',
    层级: Number.isFinite(Number(地点.层级)) ? Number(地点.层级) : 4,
    描述: 地点.描述 || '',
    x: Number.isFinite(Number(地点.x)) ? Number(地点.x) : -1,
    y: Number.isFinite(Number(地点.y)) ? Number(地点.y) : -1,
    节点类型: normalizeDynamicLocationNodeType(地点.节点类型, 地点.层级, 地点名),
    势力: 地点.势力 || '未知',
    状态: 地点.状态 || 'intact',
  }, ['world', '动态地点', '示例动态地点']) || {};
}

function 构建更新视图标准结构样例_V1(字段 = '') {
  switch (字段) {
    case '时间线':
      return { 示例事件: { 事件: '无', 触发tick: 0, 地点: '无', 状态: 'pending', 后续: '' } };
    case '拍卖':
      return { 状态: '休市', 下次刷新tick: 0, 地点: '无', 拍品: { 示例项: { 分类: '剧情杂物', 品级: '低阶', 背景: '无', 价格: 0 } } };
    case '委托板':
      return { 示例委托: { 标题: '无', 描述: '无', 框架描述: '无', 发布者: '系统', 面向: '公开', 指定对象: '无', 状态: '待接取', 难度: '中', 资源级别: '无', 奖励币: 0, 奖励声望: 0, 承接者: '无', 生成tick: 0 } };
    case '图鉴':
      return { 示例图鉴: { 类型: '怪物', 名称: '未知', 具体物种: '', 标准物种: '', 物种品质: '', 年限档: '', 年限下限: 0, 年限上限: 0, 标准种族: '', 常见级别: '', 对标等级: 0, 常见系别: '未知系', 标准技能: {} } };
    case '战斗':
      return { 进行中: false, 战斗类型: '未知', 先攻: '无', 允许撤离: true, 回合: 0, 环境: '正常', 战斗意图: '点到为止', 裁断结果: '', 参战者: {} };
    case '地点':
      return { 示例地点: { 掌控势力: '未知', 人口: 0, 守护军团: '无', 经济状况: '未知', x: -1, y: -1, 类型: '地图节点', 描述: '无', 状态: 'intact', 子节点: {}, 商店: {} } };
    case '动态地点':
      return { 示例动态地点: { 归属父节点: '父节点名称', 层级: 4, 描述: '无', x: -1, y: -1, 节点类型: '设施', 势力: '未知', 状态: 'intact' } };
    default:
      return {};
  }
}

function 为运行时物品定义注入提示_V1(物品定义 = {}) {
  return 过滤MVU更新视图值_V1(cloneJsonValue(物品定义, {}), ['物品', '示例物品']) || {};
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
  const totalMinutes = safeTick * 10;
  const days = Math.floor(totalMinutes / (24 * 60));
  const years = Math.floor(days / 360);
  const months = Math.floor((days % 360) / 30) + 1;
  const currentDay = (days % 30) + 1;
  const remainderMinutes = totalMinutes % (24 * 60);
  const hours = Math.floor(remainderMinutes / 60);
  const mins = remainderMinutes % 60;
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

function 收集后续原著时间线预览项_V1(当前tick = 0, 最大数量 = 20, 时间线事件源 = TimelineEvents) {
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
var 远端原著时间线事件词_V1 = Object.freeze([
  '收留', '离别', '离开', '觉醒', '交易', '受伤', '拜师', '身份暴露',
  '魂灵', '魂导器', '斗铠', '升灵台', '魂灵塔', '比赛', '袭击', '救下',
  '融合', '突破', '失踪', '死亡', '入学', '锻造', '修炼', '告别', '追杀',
  '传灵塔', '史莱克', '唐门', '任务', '试炼', '暴露', '重逢',
]);

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

function 构建远端原著时间线事件检索文本_V1(事件 = {}) {
  const 事件人物 = 标准化远端原著时间线人物列表_V1(事件?.人物);
  return [
    事件?.章节,
    事件人物.join(' '),
    事件?.描述,
    事件?.简述,
  ].filter(Boolean).join('\n');
}

function 是有效远端原著时间线命中词_V1(词 = '') {
  const 文本 = String(词 || '').trim();
  return 文本.length >= 2 && 文本 !== '无' && 文本 !== '未知' && !/^\d+$/.test(文本);
}

function 提取远端原著时间线显式物品词_V1(文本 = '') {
  const 结果 = new Set();
  const 源文本 = String(文本 || '');
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
  事件列表.forEach(事件 => {
    const 事件文本 = 构建远端原著时间线事件检索文本_V1(事件);
    统计词列表.forEach(词 => {
      if (运行时文本包含片段_V1(事件文本, 词)) 频率.set(词, (频率.get(词) || 0) + 1);
    });
  });
  return { 总事件数: 事件列表.length, 频率 };
}

function 计算远端原著时间线逆频率倍率_V1(词 = '', 频率上下文 = {}) {
  const 频次 = Math.max(0, Number(频率上下文?.频率?.get(String(词 || '').trim()) || 0));
  return Math.max(0.4, Math.min(2.1, 0.35 + 1.85 / Math.pow(频次 + 1, 0.35)));
}

function 构建远端原著时间线运行补充文本_V1(数据根 = {}) {
  const { 玩家名, 当前地点 } = 取运行时当前范围_V1(数据根);
  const 玩家 = 数据根?.char?.[玩家名] || {};
  return [
    数据根?.world?.时间?._calendar || 数据根?.world?.时间?.当前,
    当前地点,
    玩家名,
    数据根?.sys?.系统播报,
    数据根?.world?.战斗?.环境?.地点,
    数据根?.world?.战斗?.战斗意图,
    玩家?.状态?.位置,
    收集运行时字符串列表_V1(
      数据根?.相关实体索引?.角色,
      数据根?.相关实体索引?.命中地点,
      数据根?.相关实体索引?.命中动态地点,
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
  const 角色 = new Set();
  const 地点 = new Set();
  const 动态地点 = new Set();
  const 势力 = new Set();
  const 物品 = new Set();
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
    添加(动态地点, Array.from(命中名称.动态地点 || []), 权重);
    添加(势力, Array.from(命中名称.势力 || []), 权重);
    添加(物品, Array.from(命中名称.物品 || []), 权重);
    添加(物品, 提取远端原著时间线显式物品词_V1(文本), 权重);
  };
  合并文本命中(捕获文本, 1);
  合并文本命中(运行补充文本, 0.45);
  添加(角色, 数据根?.相关实体索引?.角色, 0.55);
  添加(地点, 数据根?.相关实体索引?.命中地点, 0.45);
  添加(动态地点, 数据根?.相关实体索引?.命中动态地点, 0.45);
  添加(势力, 数据根?.相关实体索引?.命中势力, 0.45);
  添加(物品, 数据根?.相关实体索引?.命物品, 0.55);
  return {
    角色,
    地点,
    动态地点,
    势力,
    物品,
    实体: new Set([...地点, ...动态地点, ...势力, ...物品]),
    源权重,
  };
}

function 计算远端原著时间线候选分数_V1(事件 = {}, 上下文 = {}) {
  const 事件人物 = 标准化远端原著时间线人物列表_V1(事件?.人物);
  const 事件文本 = 构建远端原著时间线事件检索文本_V1(事件);
  let 分数 = 0;
  const 原因 = [];
  const 已计分词 = new Set();
  let 明确命中类别数 = 0;
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
      最高来源倍率 = Math.max(最高来源倍率, 来源倍率);
      小计 += 基础分 * 计算远端原著时间线逆频率倍率_V1(词, 上下文.频率上下文) * 来源倍率;
    });
    分数 += 小计;
    if (最高来源倍率 >= 0.8) 明确命中类别数 += 1;
    原因.push(`${标签}:${有效列表.slice(0, 显示数量).join('/')}`);
    return 有效列表;
  };
  const 人物命中 = 事件人物.filter(名称 => 上下文.角色.has(名称) || 运行时文本包含片段_V1(上下文.查询文本, 名称));
  const 非主角人物命中 = 人物命中.filter(名称 => !远端原著时间线泛主角名_V1.has(名称));
  计分('人物', 非主角人物命中, 10, 3);
  const 泛主角命中 = 人物命中.filter(名称 => 远端原著时间线泛主角名_V1.has(名称));
  计分('泛主角', 泛主角命中, 非主角人物命中.length ? 1.2 : 0.7, 2);
  const 物品命中 = Array.from(上下文.物品 || []).filter(名称 => 运行时文本包含片段_V1(事件文本, 名称));
  计分('物品', 物品命中, 9.5, 3);
  const 势力命中 = Array.from(上下文.势力 || []).filter(名称 => 运行时文本包含片段_V1(事件文本, 名称));
  计分('势力', 势力命中, 3.5, 3);
  const 动态地点命中 = Array.from(上下文.动态地点 || []).filter(名称 => 运行时文本包含片段_V1(事件文本, 名称));
  计分('动态地点', 动态地点命中, 2.5, 3);
  const 地点命中 = Array.from(上下文.地点 || []).filter(名称 => 运行时文本包含片段_V1(事件文本, 名称));
  计分('地点', 地点命中, 2.2, 3);
  const 事件词命中 = 远端原著时间线事件词_V1.filter(关键词 => (
    运行时文本包含片段_V1(上下文.查询文本, 关键词) && 运行时文本包含片段_V1(事件文本, 关键词)
  ));
  计分('事件词', 事件词命中, 6.8, 3);
  const 关键词命中 = (上下文.关键词 || []).filter(关键词 => 运行时文本包含片段_V1(事件文本, 关键词));
  计分('关键词', 关键词命中, 2.2, 4);
  if (明确命中类别数 >= 2) 分数 += Math.min(3, (明确命中类别数 - 1) * 1.5);
  if (分数 < 远端原著时间线最低入选分_V1) return null;
  return {
    标识: String(事件?.标识 || '').trim(),
    触发tick: Number(事件?.触发tick || 0),
    人物: 事件人物,
    原著事件: String(事件?.描述 || 事件?.简述 || '').trim() || '无',
    命中原因: 原因.length ? 原因.join('；') : '文本相关',
    分数,
  };
}

function 收集远端原著时间线候选_V1(数据根 = {}, 用户输入 = '', 最大数量 = 20) {
  const 当前tick = Number(数据根?.world?.时间?.tick || 0);
  const 捕获文本 = String(用户输入 || '');
  const 运行补充文本 = 构建远端原著时间线运行补充文本_V1(数据根);
  const 查询文本 = [捕获文本, 运行补充文本].filter(Boolean).join('\n');
  if (!查询文本.trim()) return [];
  const 近端标识 = new Set(收集后续原著时间线预览项_V1(当前tick, 20, 读取原著时间线事件源_V1()).map(事件 => 事件.标识));
  const 锚点 = 收集远端原著时间线实体锚点_V1(数据根, 捕获文本, 运行补充文本);
  const 关键词 = 切分运行时实体关键词_V1(查询文本, Array.from(锚点.实体).join(' '), Array.from(锚点.角色).join(' '))
    .filter(是有效远端原著时间线命中词_V1);
  const 全部事件列表 = 收集原著时间线事件列表_V1()
    .map(事件 => ({
      ...事件,
      标识: String(事件?.标识 || '').trim(),
      触发tick: Number(事件?.触发tick || 0),
    }));
  const 事件词 = 远端原著时间线事件词_V1.filter(关键词 => 运行时文本包含片段_V1(查询文本, 关键词));
  [...事件词, ...关键词].forEach(词 => {
    锚点.源权重.set(词, Math.max(Number(锚点.源权重.get(词) || 0), 运行时文本包含片段_V1(捕获文本, 词) ? 1 : 0.45));
  });
  const 频率上下文 = 构建远端原著时间线频率上下文_V1(全部事件列表, [
    ...Array.from(锚点.角色),
    ...Array.from(锚点.地点),
    ...Array.from(锚点.动态地点),
    ...Array.from(锚点.势力),
    ...Array.from(锚点.物品),
    ...事件词,
    ...关键词,
  ]);
  const 上下文 = {
    查询文本,
    角色: 锚点.角色,
    地点: 锚点.地点,
    动态地点: 锚点.动态地点,
    势力: 锚点.势力,
    物品: 锚点.物品,
    关键词,
    源权重: 锚点.源权重,
    频率上下文,
  };
  return 全部事件列表
    .filter(事件 => 事件.标识 && Number.isFinite(事件.触发tick) && 事件.触发tick > 当前tick && !近端标识.has(事件.标识))
    .map(事件 => 计算远端原著时间线候选分数_V1(事件, 上下文))
    .filter(Boolean)
    .sort((左, 右) => {
      const 分差 = 右.分数 - 左.分数;
      if (Math.abs(分差) >= 2) return 分差;
      return 左.触发tick - 右.触发tick || 分差 || 左.标识.localeCompare(右.标识, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' });
    })
    .slice(0, Math.max(1, Number(最大数量 || 20)));
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
    if (路径[0] === 'world' && 路径[1] === '时间' && (路径[2] === 'tick' || 路径[2] === '_calendar')) {
      追加路径(['world', '时间', '当前']);
    }
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
  const 拍卖命中 = /拍卖|竞拍|竞价|拍品/.test(String(文本 || ''))
    || 运行时文本命中名称_V1(文本, 拍卖.地点)
    || 运行时文本命中名称_V1(文本, 拍卖.状态);
  Object.entries(拍品表).forEach(([拍品名, 拍品数据]) => {
    if (Object.keys(拍品).length >= 最大拍品数) return;
    if (拍卖命中 || 运行时记录命中文本_V1(拍品名, 拍品数据, 文本)) 拍品[拍品名] = cloneJsonValue(拍品数据, {});
  });
  if (!拍卖命中 && !Object.keys(拍品).length) return {};
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

function 生成MVU正文视图_V1(数据输入 = null, userInput = '', plotText = '') {
  const 数据根 = 读取运行时Mvu数据根或最新_V1(数据输入) || {};
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
  const 视图 = {
    sys: 过滤MVU正文视图值_V1({ 系统播报: 数据根?.sys?.系统播报 }, ['sys']) || {},
    world: 过滤MVU正文视图值_V1({
      时间: {
        当前: 数据根?.world?.时间?._calendar || 数据根?.world?.时间?.当前 || '',
      },
      时间线: 运行时对象有内容_V1(时间线视图) ? 时间线视图 : undefined,
      机密情报: 运行时对象有内容_V1(机密情报视图) ? 机密情报视图 : undefined,
      战斗: 运行时对象有内容_V1(战斗摘要) ? 战斗摘要 : undefined,
      地点: {},
      动态地点: {},
    }, ['world']) || {},
    char: {},
    物品: {},
  };
  if (运行时对象有内容_V1(战斗摘要)) 视图.world.战斗 = 战斗摘要;
  地点名集合.forEach(地点名 => {
    const 地点 = 数据根?.world?.地点?.[地点名];
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
      视图.world.地点[地点名] = 清理后;
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
    const 清理后 = 过滤MVU正文视图值_V1(cloneJsonValue(原角色, null), ['char', '示例角色']);
    if (清理后) {
      const 基础六维对标 = 过滤MVU正文视图值_V1(构建角色基础六维对标条目_V1(原角色), ['char', '示例角色', '基础六维对标']);
      delete 清理后.属性;
      if (基础六维对标) 清理后.基础六维对标 = 基础六维对标;
      删除正文视图机制字段_V1(清理后, 当前tick);
      if (Object.keys(清理后).length) {
        视图.char[角色名] = 清理后;
        已发送角色名集合.add(角色名);
      }
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
  const 数据根 = 读取运行时Mvu数据根或最新_V1(数据输入) || {};
  const 最后角色消息文本 = String(最后一条角色消息 || '').trim() || 读取运行时最后角色消息文本_V1();
  const 文本 = [userInput, 最后角色消息文本].map(文本 => String(文本 || '').trim()).filter(Boolean).join('\n');
  const 当前tick = Number(数据根?.world?.时间?.tick || 0);
  const 运行时命中上下文 = 构建运行时命中上下文_V1(数据根, 文本, 选项);
  const 运行时提示限流 = 创建运行时提示限流器_V1();
  const 注入数据根 = { ...数据根, __运行时提示限流__: 运行时提示限流 };
  const 角色名集合 = 选项.角色名集合 instanceof Set
    ? new Set([取运行时当前范围_V1(数据根).玩家名].filter(Boolean).concat(Array.from(选项.角色名集合)))
    : 取运行时基础角色名集合_V1(数据根, 文本, { 运行时命中名称: 运行时命中上下文.运行时命中名称 });
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
  const 视图 = {
    sys: cloneJsonValue({ 系统播报: 数据根?.sys?.系统播报 }, {}),
    world: {
      时间: {
        tick: Number(数据根?.world?.时间?.tick || 0),
        当前: 数据根?.world?.时间?._calendar || 数据根?.world?.时间?.当前 || '',
      },
      时间线: 时间线视图,
      拍卖: 拍卖视图,
      委托板: 委托板视图,
      图鉴: 图鉴视图,
      战斗: 战斗摘要,
      地点: {},
      动态地点: {},
    },
    org: {},
    char: {},
    物品: {},
  };
  地点名集合.forEach(地点名 => {
    if (数据根?.world?.地点?.[地点名]) 视图.world.地点[地点名] = 构建更新地点薄片_V1(数据根.world.地点[地点名], 文本);
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
    清理运行时已补全技能效果数组_V1(角色);
    const 过滤后角色 = 过滤MVU更新视图值_V1(角色, ['char', '示例角色']);
    if (过滤后角色) {
      if (!魂骨命中 && 过滤后角色.魂骨) delete 过滤后角色.魂骨;
      if (战斗进行中) {
        战斗中无关字段_V1.forEach(字段 => { if (字段 in 过滤后角色) delete 过滤后角色[字段]; });
        if (过滤后角色.属性 && typeof 过滤后角色.属性 === 'object') delete 过滤后角色.属性.背景;
      }
      视图.char[角色名] = 过滤后角色;
      已发送角色名集合.add(角色名);
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
    ['拍卖', 拍卖视图],
    ['委托板', 委托板视图],
    ['图鉴', 图鉴视图],
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
  const 剧情视图 = {
    当前: {
      时间: {
        当前: 数据根?.world?.时间?._calendar || 数据根?.world?.时间?.当前 || '',
        tick: Number(数据根?.world?.时间?.tick || 0),
      },
      地点: 当前地点,
      玩家: 玩家名,
      玩家行动: userInput || '',
      系统播报: 数据根?.sys?.系统播报 || '',
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
      内置角色档案命中: 内置角色摘要.length ? 内置角色摘要 : undefined,
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
  return String(值 ?? '').replace(/\s+/g, ' ').replace(/\|/g, '/').trim();
}

function 格式化MVU剧情提示原子值_V1(值, 选项 = {}) {
  if (值 === undefined || 值 === null) return '';
  if (typeof 值 === 'string') {
    const 文本 = 值.trim();
    return 正文视图值已初始化_V1(文本) ? 文本 : '';
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
    const 文本 = 格式化MVU剧情提示值_V1(值);
    if (文本) 片段列表.push(`${字段}:${文本}`);
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
  Object.freeze({ 标签: '系统播报', 取值: 当前 => 当前?.系统播报 }),
]);

var MVU剧情角色简表字段表_V1 = Object.freeze([
  Object.freeze({ 标签: '角色', 取值: (角色, 上下文) => 上下文.角色名 }),
  Object.freeze({ 标签: '性别', 取值: 角色 => 角色?.属性?.性别 }),
  Object.freeze({ 标签: '年龄', 取值: 角色 => 角色?.属性?.年龄 }),
  Object.freeze({ 标签: '位置', 取值: 角色 => 角色?.状态?.位置 }),
  Object.freeze({ 标签: '行动', 取值: 角色 => 角色?.状态?.行动 }),
  Object.freeze({ 标签: '长相', 取值: 角色 => 角色?.外貌?.长相描述 }),
  Object.freeze({ 标签: '特征', 取值: 角色 => 角色?.外貌?.特殊特征 }),
  Object.freeze({ 标签: '穿搭', 取值: 角色 => 角色?.穿搭?.描述 }),
  Object.freeze({ 标签: '性格', 取值: 角色 => 角色?.性格 }),
  Object.freeze({ 标签: '财富', 取值: 角色 => 构建MVU剧情提示财富_V1(角色) }),
  Object.freeze({ 标签: '身份关系', 取值: (角色, 上下文) => 构建MVU剧情提示身份关系_V1(角色, 上下文.角色名, 上下文.角色名列表) }),
  Object.freeze({ 标签: '剩余资源', 取值: 角色 => 构建MVU剩余资源摘要_V1(角色) }),
  Object.freeze({ 标签: '私密档案', 取值: 角色 => 角色?.私密档案, 选项: { 最大字段数: 20 } }),
]);

function 构建MVU剧情角色简表_V1(数据根 = {}, userInput = '', 最后剧情文本 = '') {
  const 角色名集合 = 取运行时剧情提示角色名集合_V1(数据根, userInput, 最后剧情文本);
  const 角色名列表 = 按玩家优先排序名称_V1(角色名集合, 取运行时玩家名_V1(数据根));
  const 角色简表 = [];
  角色名列表.forEach(角色名 => {
    const 角色 = 数据根?.char?.[角色名];
    if (!角色 || typeof 角色 !== 'object') return;
    const 上下文 = { 角色名, 角色名列表 };
    const 条目 = {};
    MVU剧情角色简表字段表_V1.forEach(字段 => {
      const 值 = typeof 字段.取值 === 'function' ? 字段.取值(角色, 上下文) : '';
      const 文本 = 格式化MVU剧情提示值_V1(值, 字段.选项 || {});
      if (文本) 条目[字段.标签] = 文本;
    });
    if (条目.角色) 角色简表.push(条目);
  });
  return 角色简表;
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
  const 角色块列表 = [];
  角色简表.forEach(条目 => {
    if (!条目 || typeof 条目 !== 'object') return;
    const 角色名 = 格式化MVU剧情提示单元_V1(条目.角色);
    if (!角色名) return;
    const 行列表 = [`【角色：${角色名}】`];
    MVU剧情角色简表字段表_V1.forEach(字段 => {
      if (字段.标签 === '角色') return;
      const 内容 = 格式化MVU剧情提示单元_V1(条目[字段.标签]);
      if (内容) 行列表.push(`- ${字段.标签}: ${内容}`);
    });
    if (行列表.length > 1) 角色块列表.push(行列表.join('\n'));
  });
  return 角色块列表.length ? `【角色简表】\n\n${角色块列表.join('\n\n---\n\n')}` : '【角色简表】\n无';
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

function 生成MVU剧情提示文本_V1(数据输入 = null, userInput = '', 最后剧情文本 = '') {
  const 剧情视图 = 生成MVU剧情视图_V1(数据输入, userInput, 最后剧情文本);
  return [
    构建MVU剧情提示当前段_V1(剧情视图),
    构建MVU剧情提示角色段_V1(剧情视图),
    构建MVU剧情提示引导段_V1(剧情视图),
  ].filter(Boolean).join('\n\n');
}

function 格式化MVU正文提示原子值_V1(值) {
  if (值 === undefined || 值 === null) return '';
  if (typeof 值 === 'boolean') return 值 ? '是' : '';
  if (typeof 值 === 'number') return Number.isFinite(值) ? String(值) : '';
  const 文本 = String(值).trim();
  return 正文视图值已初始化_V1(文本) ? 文本 : '';
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
        return 文本 ? `${键}:${文本}` : '';
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
  const 标签文本 = String(标签 || '').trim();
  const 内容文本 = 格式化MVU正文提示值_V1(值, 最大深度);
  if (标签文本 && 内容文本) 片段列表.push(`${标签文本}=${内容文本}`);
}

function 构建MVU正文普通行_V1(名称 = '', 内容 = '', 最大深度 = 2) {
  const 名称文本 = String(名称 || '').trim();
  const 内容文本 = 格式化MVU正文提示值_V1(内容, 最大深度);
  return 名称文本 && 内容文本 ? `- ${名称文本}：${内容文本}` : '';
}

function 构建MVU正文状态摘要_V1(角色 = {}) {
  const 状态 = 角色?.状态 && typeof 角色.状态 === 'object' ? cloneJsonValue(角色.状态, {}) : {};
  if (状态.存活 === true) delete 状态.存活;
  if (Number(状态.死亡tick || -1) < 0) delete 状态.死亡tick;
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
  return 片段列表.length ? `- ${武魂键}：${片段列表.join('；')}` : '';
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
    ...构建MVU正文对象行列表_V1(角色?.任务, 6, 2),
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
    ['类型', '节点类型', '掌控势力', '势力', '归属父节点', '人口', '守护军团', '描述', '状态'].forEach(字段 => {
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

function 构建MVU正文角色卡_V1(角色名 = '', 角色 = {}, 正文角色表 = {}) {
  const 行列表 = [`━━━━━━━━ ${角色名} ━━━━━━━━`];
  添加MVU正文块_V1(行列表, '状态', 构建MVU正文对象行列表_V1(构建MVU正文状态摘要_V1(角色), 8, 2));
  添加MVU正文块_V1(行列表, '基础六维对标', 构建MVU正文对象行列表_V1(角色?.基础六维对标, 8, 1));
  添加MVU正文块_V1(行列表, '外貌穿搭', 构建MVU正文对象行列表_V1(构建MVU正文外貌穿搭摘要_V1(角色), 8, 2));
  添加MVU正文块_V1(行列表, '财富', 构建MVU正文对象行列表_V1(构建MVU正文财富摘要_V1(角色), 8, 1));
  添加MVU正文块_V1(行列表, '身份关系', 构建MVU正文身份关系行列表_V1(角色));
  添加MVU正文块_V1(行列表, '武魂魂技', 构建MVU正文武魂魂技行列表_V1(角色));
  添加MVU正文块_V1(行列表, '装备背包', 构建MVU正文装备背包行列表_V1(角色));
  添加MVU正文块_V1(行列表, '任务', 构建MVU正文任务行列表_V1(角色));
  添加MVU正文块_V1(行列表, '副职业', 构建MVU正文对象行列表_V1(构建MVU正文副职业摘要_V1(角色), 6, 2));
  添加MVU正文块_V1(行列表, '武魂融合技', 构建MVU正文武魂融合技行列表_V1(构建MVU正文武魂融合技摘要_V1(角色名, 角色, 正文角色表)));
  const 已展示字段 = new Set(['状态', '基础六维对标', '外貌', '穿搭', '性格', '财富', '社交', '副职业', '武魂融合技', '装备', '背包', '我的任务', '任务', '属性']);
  const 其他行 = Object.entries(角色 || {}).flatMap(([字段, 值]) => {
    if (已展示字段.has(字段) || 是武魂槽位键_V1(字段)) return [];
    const 行 = 构建MVU正文普通行_V1(字段, 值, 2);
    return 行 ? [行] : [];
  });
  添加MVU正文块_V1(行列表, '其他', 其他行);
  return 行列表.length > 1 ? 行列表.join('\n') : `━━━━━━━━ ${角色名} ━━━━━━━━\n无`;
}

function 构建MVU正文其他信息卡_V1(正文视图 = {}) {
  const 行列表 = ['【其他信息卡】'];
  添加MVU正文块_V1(行列表, '系统', [
    构建MVU正文普通行_V1('系统播报', 正文视图.sys?.系统播报, 1),
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
  const 角色块 = Object.entries(正文视图.char || {})
    .map(([角色名, 角色]) => 构建MVU正文角色卡_V1(角色名, 角色, 正文视图.char || {}))
    .filter(Boolean);
  return [
    '【角色卡】',
    ...(角色块.length ? 角色块 : ['无']),
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
  Object.freeze({ 标签: '魂力', 字段: '魂力上限' }),
  Object.freeze({ 标签: '精神力', 字段: '精神力上限' }),
]);

function 读取六维对标天赋档位_V1(等级 = 1) {
  const 数值 = Math.max(1, Math.min(99, Math.floor(Number(等级) || 1)));
  if (数值 <= 20) return '正常';
  if (数值 <= 60) return '优秀';
  if (数值 <= 90) return '天才';
  return '顶级天才';
}

function 读取六维对标训练系数_V1(天赋档位 = '正常') {
  return { 绝世妖孽: 1.6, 顶级天才: 1.2, 天才: 1.0, 优秀: 0.8, 正常: 0.5, 劣等: 0.2, 天赋极差: 0 }[
    String(天赋档位 || '').trim()
  ] ?? 0.5;
}

function 读取角色六维强攻系对标倍率_V1() {
  return TypeMultipliers['强攻系'] || { sp_max: 1, men_max: 1, str: 1, def: 1, agi: 1, vit_max: 1 };
}

function 构建角色六维对标参照值_V1(角色 = {}, 等级 = 1) {
  const 安全等级 = Math.max(1, Math.min(99, Math.floor(Number(等级) || 1)));
  const 基准 = getBaseStats(安全等级);
  const 系别倍率 = 读取角色六维强攻系对标倍率_V1();
  const 天赋档位 = 读取六维对标天赋档位_V1(安全等级);
  const 训练系数 = 读取六维对标训练系数_V1(天赋档位);
  const 训练倍率 = 安全等级 > 10 ? 0.005 * (安全等级 - 10) * 训练系数 : 0;
  return {
    力量: Math.floor(Number(基准.str || 0) * Number(系别倍率.str || 1)) + Math.floor(Number(基准.str || 0) * 训练倍率),
    防御: Math.floor(Number(基准.def || 0) * Number(系别倍率.def || 1)) + Math.floor(Number(基准.def || 0) * 训练倍率),
    敏捷: Math.floor(Number(基准.agi || 0) * Number(系别倍率.agi || 1)) + Math.floor(Number(基准.agi || 0) * 训练倍率),
    体力上限: Math.floor(Number(基准.vit_max || 0) * Number(系别倍率.vit_max || 1)) + Math.floor(Number(基准.vit_max || 0) * 训练倍率),
    魂力上限: Math.floor(Number(基准.sp_max || 0) * Number(系别倍率.sp_max || 1)),
    精神力上限: Math.floor(Number(基准.men_max || 0) * Number(系别倍率.men_max || 1)) + Math.floor(Number(基准.men_max || 0) * 训练倍率),
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
    魂力上限: 0,
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
  const 一级参照 = Math.max(1, Number(构建角色六维对标参照值_V1(角色, 1)?.[字段] || 1));
  const 九十九级参照 = Math.max(一级参照, Number(构建角色六维对标参照值_V1(角色, 99)?.[字段] || 一级参照));
  if (安全数值 < 一级参照) return '强攻系1级以下';
  if (安全数值 > 九十九级参照) return '强攻系99+级';
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
  return `强攻系${最佳等级}级`;
}

function 构建角色基础六维对标条目_V1(角色 = {}) {
  if (!角色 || typeof 角色 !== 'object' || !角色.属性 || typeof 角色.属性 !== 'object') return {};
  const 六维 = 读取角色非装备六维_V1(角色);
  const 条目 = {};
  const 等级 = Number(角色.属性.等级);
  if (Number.isFinite(等级)) 条目.等级 = `Lv${等级}`;
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
  const 字段文本 = 角色基础六维对标字段_V1.map(({ 标签 }) => {
    const 文本 = String(条目?.[标签] || '').trim();
    if (!文本) return '';
    return 标签 === '精神力' ? `${标签} ${文本}` : `${标签}≈${文本}`;
  }).filter(Boolean).join('，');
  const 副职业文本 = String(条目.副职业 || '').trim();
  if (!字段文本 && !副职业文本) return '';
  return `${角色名} ${String(条目.等级 || 'Lv?').trim()}：${字段文本}${副职业文本 ? `；副职业：${副职业文本}` : ''}`;
}

function 生成角色基础六维对标摘要_V1(数据输入 = null, userInput = '') {
  const 数据根 = 读取运行时Mvu数据根或最新_V1(数据输入) || {};
  const 角色名集合 = 取运行时基础角色名集合_V1(数据根, String(userInput || ''));
  const 角色名列表 = 按玩家优先排序名称_V1(角色名集合, 取运行时玩家名_V1(数据根));
  const 行列表 = [];
  角色名列表.forEach(角色名 => {
    const 角色 = 数据根?.char?.[角色名];
    const 行文本 = 格式化角色基础六维对标条目_V1(角色名, 构建角色基础六维对标条目_V1(角色));
    if (行文本) 行列表.push(行文本);
  });
  return 行列表.length ? 行列表.join('\n') : '无';
}

function 序列化MVU运行时视图_V1(视图 = {}) {
  try {
    return JSON.stringify(视图 || {}, null, 2);
  } catch (错误) {
    return '{}';
  }
}

function 替换MVU运行时视图占位符_V1(文本 = '', 视图类型 = 'empty', 上下文 = {}) {
  const 源文本 = String(文本 || '');
  const 需要主视图 = 源文本.includes(MVU_RUNTIME_VIEW_PLACEHOLDER_V1);
  const 需要更新视图 = 源文本.includes(MVU_RUNTIME_UPDATE_PLACEHOLDER_V1);
  const 需要结构提示 = 源文本.includes(MVU_UPDATE_STRUCTURE_HINTS_PLACEHOLDER_V1);
  const 需要相互可见性 = 源文本.includes(MVU相互可见性视图占位符_V1);
  if (!需要主视图 && !需要更新视图 && !需要结构提示 && !需要相互可见性) return 源文本;
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
    if (!更新视图) 更新视图 = 生成MVU更新视图_V1(数据根, userInput, 最后角色消息输入, plotText);
    return 更新视图;
  };
  let 主视图文本 = '';
  if (需要主视图) {
    if (视图类型文本 === 'plot') {
      主视图文本 = 生成MVU剧情提示文本_V1(数据根, userInput, String(最后角色消息输入 || ''));
    } else if (视图类型文本 === 'story') {
      主视图文本 = 生成MVU正文提示文本_V1(数据根, userInput, plotText, 读取正文视图());
    } else {
      const 主视图 = 视图类型文本 === 'empty' ? {} : (视图类型文本 === 'update' ? 读取更新视图() : 读取正文视图());
      主视图文本 = 序列化MVU运行时视图_V1(主视图);
    }
  }
  const 更新视图文本 = 需要更新视图 ? 序列化MVU运行时视图_V1(读取更新视图()) : '';
  const 结构提示 = 需要结构提示 ? 生成MVU更新结构提示_V1(数据根, userInput, 最后角色消息输入, plotText) : '';
  const 相互可见性文本 = 需要相互可见性 ? 生成MVU相互可见性视图_V1(数据根, userInput, 最后角色消息输入) : '';
  const 替换后 = 源文本
    .replaceAll(MVU_RUNTIME_VIEW_PLACEHOLDER_V1, 主视图文本)
    .replaceAll(MVU_RUNTIME_UPDATE_PLACEHOLDER_V1, 更新视图文本)
    .replaceAll(MVU_UPDATE_STRUCTURE_HINTS_PLACEHOLDER_V1, 结构提示)
    .replaceAll(MVU相互可见性视图占位符_V1, 相互可见性文本);
  return 替换后.replace(/<status_current_variables>\s*(?:\{\}|\[\]|\s*)\s*<\/status_current_variables>/gi, '').trim();
}

function 创建运行时提示限流器_V1() {
  const 已使用类型 = new Set();
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
    skill.画面描述 = 限流提示('技能画面描述', hasPackedEffects ? AI_TODO_SKILL_VISUAL : AI_TODO_SKILL_VISUAL_STAGE1);
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

function injectRuntimeCharacterTodoDefaults_V1(charData = {}, charName = '', sourceChar = null, rootData = {}) {
  if (!charData || typeof charData !== 'object') return charData;
  const 玩家名 = 取运行时玩家名_V1(rootData);
  const { 玩家 } = 取运行时当前范围_V1(rootData);
  const 允许机制决策临时 = charName === 玩家名 || 运行时地点兼容_V1(sourceChar?.状态?.位置 || '', 玩家?.状态?.位置 || '');
  const 取提示 = typeof rootData?.__运行时提示限流__ === 'function' ? rootData.__运行时提示限流__ : null;
  charData.临时突破 = 临时突破默认提示词_V1;
  注入运行时限流文本默认值_V1(charData, '性格', AI_TODO_PERSONALITY, '角色性格', 取提示);
  if (charData.属性 && typeof charData.属性 === 'object') {
    const 背景 = String(charData.属性.背景 ?? '').trim();
    if (!背景 || 背景 === '无' || isAiTodoText(背景)) charData.属性.背景 = 取提示 ? 取提示('角色背景', AI_TODO_BACKGROUND) : AI_TODO_BACKGROUND;
    if (Object.prototype.hasOwnProperty.call(sourceChar?.属性 || {}, '天赋评级')) {
      const 天赋评级 = String(charData.属性.天赋评级 ?? '').trim();
      if (!天赋评级 || 天赋评级 === '无' || isAiTodoText(天赋评级))
        charData.属性.天赋评级 = 取提示 ? 取提示('天赋评级', AI_TODO_TALENT_RATING) : AI_TODO_TALENT_RATING;
    }
  }
  if (charData.社交 && typeof charData.社交 === 'object') {
    注入运行时限流文本默认值_V1(charData.社交, '主身份', AI_TODO_MAIN_IDENTITY, '主身份', 取提示);
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
    const 武魂系别 = String(spiritData?.系别 || '强攻系').trim() || '强攻系';
    const isSecondarySpirit = spiritKey === '第2武魂';
    注入运行时文本默认值_V1(spiritData, '表象名称', isSecondarySpirit ? '未展露' : AI_TODO_SPIRIT_NAME);
    注入运行时文本默认值_V1(spiritData, '描述', isSecondarySpirit ? '无' : AI_TODO_SPIRIT_DESC);
    注入运行时文本默认值_V1(spiritData, '属性体系', AI_TODO_ATTRIBUTE_SYSTEM);
    if (!Array.isArray(spiritData.可调用元素) || !spiritData.可调用元素.some(item => String(item ?? '').trim())) spiritData.可调用元素 = [AI_TODO_CALLABLE_ELEMENTS];
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
      注入运行时文本默认值_V1(ringData, '来源', '无');
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
    生成MVU正文视图: 生成MVU正文视图_V1,
    生成MVU正文提示文本: 生成MVU正文提示文本_V1,
    生成MVU相互可见性视图: 生成MVU相互可见性视图_V1,
    生成MVU更新视图: 生成MVU更新视图_V1,
    生成MVU剧情视图: 生成MVU剧情视图_V1,
    生成MVU剧情提示文本: 生成MVU剧情提示文本_V1,
    生成角色基础六维对标摘要: 生成角色基础六维对标摘要_V1,
    生成MVU更新结构提示: 生成MVU更新结构提示_V1,
    收集运行时动态地点命中: 收集运行时动态地点命中_V1,
    收集运行时物品命中: 收集运行时物品命中_V1,
    查找运行时物品定义: 查找运行时物品定义_V1,
    应用内置角色实例化: 应用内置角色实例化_V1,
    应用内置物品实例化: 应用内置物品实例化_V1,
    构建内置角色命中摘要: 构建内置角色命中摘要_V1,
    替换MVU运行时视图占位符: 替换MVU运行时视图占位符_V1,
  });
  globalThis.__LWCS_MVU_RUNTIME_VIEW__ = 运行时视图接口;
  try { if (globalThis.parent && globalThis.parent !== globalThis) globalThis.parent.__LWCS_MVU_RUNTIME_VIEW__ = 运行时视图接口; } catch (错误) {}
  try { if (globalThis.top && globalThis.top !== globalThis) globalThis.top.__LWCS_MVU_RUNTIME_VIEW__ = 运行时视图接口; } catch (错误) {}
} catch (错误) {}

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
  if (sd?.world?.动态地点?.[locName]) {
    return Number(sd.world.动态地点[locName].层级 || 4) <= 2;
  }
  const entry = findMapNodeEntry(locName, sd);
  return !!(entry && Array.isArray(entry.path) && entry.path.length <= 1);
}

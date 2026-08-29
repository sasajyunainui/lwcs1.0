// 从 MVU.js 机械拆分：技能机制注册表、技能生成、COST、预算、技能编译、基础属性与派生结算。

function cloneJsonValue(值, 回退值 = {}) {
  try {
    if (typeof structuredClone === 'function') return structuredClone(值);
  } catch (_错误) {}
  try {
    return JSON.parse(JSON.stringify(值));
  } catch (_错误) {}
  return 回退值;
}

function 读取时代修炼运行时_V1() {
  const 候选列表 = [globalThis];
  try { if (globalThis.parent && globalThis.parent !== globalThis) 候选列表.push(globalThis.parent); } catch (_错误) {}
  try { if (globalThis.top && globalThis.top !== globalThis) 候选列表.push(globalThis.top); } catch (_错误) {}
  return 候选列表
    .map(候选 => 候选 && 候选.__LWCS_ERA_CULTIVATION_RUNTIME_V1__)
    .find(接口 => 接口 && typeof 接口 === 'object') || null;
}

function 读取性能计时毫秒_V1() {
  try {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
  } catch (_错误) {}
  return Date.now();
}

function 读取技能生成统计器_V1(context = {}) {
  const 上下文统计器 = context?.技能生成统计器;
  if (上下文统计器 && typeof 上下文统计器 === 'object') return 上下文统计器;
  try {
    const 全局统计器 = typeof globalThis !== 'undefined' ? globalThis.__LWCS_SKILL_GENERATION_TRACE__ : null;
    return 全局统计器 && typeof 全局统计器 === 'object' ? 全局统计器 : null;
  } catch (_错误) {
    return null;
  }
}

function 记录技能生成事件_V1(context = {}, 事件 = {}) {
  const 统计器 = 读取技能生成统计器_V1(context);
  if (!统计器) return;
  const 记录 = {
    时间毫秒: 读取性能计时毫秒_V1(),
    ...(事件 && typeof 事件 === 'object' ? 事件 : {}),
  };
  if (typeof 统计器.记录 === 'function') {
    try { 统计器.记录(记录); } catch (_错误) {}
    return;
  }
  if (Array.isArray(统计器.事件列表)) 统计器.事件列表.push(记录);
}

function 记录技能生成阶段耗时_V1(context = {}, 阶段 = '', 开始毫秒 = 0, 额外 = {}) {
  if (!读取技能生成统计器_V1(context)) return;
  记录技能生成事件_V1(context, {
    类型: '阶段耗时',
    阶段: String(阶段 || '').trim() || '未命名阶段',
    耗时毫秒: Number(Math.max(0, 读取性能计时毫秒_V1() - Number(开始毫秒 || 0)).toFixed(3)),
    ...(额外 && typeof 额外 === 'object' ? 额外 : {}),
  });
}

function 归类技能生成错误_V1(错误 = null) {
  const 文本 = String(错误?.message || 错误 || '').trim();
  if (/COST仍超预算|最低COST超预算/.test(文本)) return 'COST仍超预算';
  if (/兜底失败/.test(文本)) return '兜底失败';
  if (/利用率不达标/.test(文本)) return '利用率不达标';
  if (/五环/.test(文本)) return '五环重复门禁';
  if (/三环/.test(文本)) return '三环重复门禁';
  if (/没有合法子原型/.test(文本)) return '没有合法子原型';
  if (/没有合法主机制/.test(文本)) return '没有合法主机制';
  if (/没有共享原型编译定义/.test(文本)) return '没有共享原型编译定义';
  if (/不满足当前品质门槛/.test(文本)) return '不满足品质门槛';
  if (/未生成可执行/.test(文本)) return '未生成可执行原型';
  if (/造物承载/.test(文本)) return '造物承载失败';
  return 文本 ? '其它错误' : '未知错误';
}

function 匹配技能生成失败机制_V1(错误 = null) {
  const 文本 = String(错误?.message || 错误 || '').trim();
  const 匹配 = 文本.match(/技能生成错误:([^:：\s]+?)(?:COST仍超预算|最低COST超预算|兜底失败|利用率不达标|五环重复|三环|不可调机制低于最低有效COST|不满足当前品质门槛|没有共享原型编译定义|已被本轮排除|未生成可执行原型|没有合法子原型)/);
  return String(匹配?.[1] || '').trim();
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

var TypeMultipliers = {
  强攻系: { sp_max: 1.0, men_max: 1.0, str: 1.0, def: 1.0, agi: 1.0, vit_max: 1.0 },
  防御系: { sp_max: 1.0, men_max: 1.0, str: 0.9, def: 1.5, agi: 0.7, vit_max: 1.0 },
  敏攻系: { sp_max: 1.0, men_max: 1.0, str: 0.8, def: 0.7, agi: 1.6, vit_max: 0.8 },
  控制系: { sp_max: 1.0, men_max: 1.2, str: 0.9, def: 0.8, agi: 1.1, vit_max: 0.9 },
  辅助系: { sp_max: 1.0, men_max: 1.2, str: 0.7, def: 0.6, agi: 0.8, vit_max: 0.7 },
  食物系: { sp_max: 1.0, men_max: 1.2, str: 0.7, def: 0.6, agi: 0.8, vit_max: 0.7 },
  治疗系: { sp_max: 1.0, men_max: 1.2, str: 0.7, def: 0.6, agi: 0.8, vit_max: 0.7 },
  精神系: { sp_max: 1.0, men_max: 1.7, str: 0.7, def: 0.6, agi: 0.8, vit_max: 0.7 },
  元素系: { sp_max: 1.0, men_max: 1.5, str: 0.8, def: 0.6, agi: 0.8, vit_max: 0.7 },
  召唤系: { sp_max: 1.0, men_max: 1.35, str: 0.8, def: 0.8, agi: 0.8, vit_max: 0.8 },
};

var 魂力获取速度系数表 = Object.freeze({
  强攻系: 1.0,
  控制系: 0.95,
  敏攻系: 0.9,
  精神系: 0.9,
  防御系: 0.8,
  辅助系: 0.7,
  食物系: 0.7,
  治疗系: 0.7,
  元素系: 0.7,
  召唤系: 0.7,
});

var 魂力上限曲线锚点_V1 = Object.freeze([
  Object.freeze({ 等级: 1, 魂力上限: 100 }),
  Object.freeze({ 等级: 10, 魂力上限: 800 }),
  Object.freeze({ 等级: 20, 魂力上限: 2000 }),
  Object.freeze({ 等级: 30, 魂力上限: 4500 }),
  Object.freeze({ 等级: 40, 魂力上限: 8500 }),
  Object.freeze({ 等级: 50, 魂力上限: 15000 }),
  Object.freeze({ 等级: 60, 魂力上限: 26000 }),
  Object.freeze({ 等级: 70, 魂力上限: 55000 }),
  Object.freeze({ 等级: 80, 魂力上限: 95000 }),
  Object.freeze({ 等级: 90, 魂力上限: 180000 }),
  Object.freeze({ 等级: 95, 魂力上限: 360000 }),
]);

function 平滑插值比例_V1(比例 = 0) {
  const 安全比例 = Math.max(0, Math.min(1, Number(比例) || 0));
  return 安全比例 * 安全比例 * (3 - 2 * 安全比例);
}

function 计算旧版魂力曲线值_V1(等级值 = 1) {
  const 等级 = Math.max(1, Math.min(100, Number(等级值) || 1));
  if (等级 <= 29) return 100 + ((2200 - 100) / 28) * (等级 - 1);
  if (等级 === 30) return 3000;
  if (等级 <= 69) return 3200 + ((9000 - 3200) / 38) * (等级 - 31);
  if (等级 === 70) return 14000;
  if (等级 <= 89) return 14500 + ((17000 - 14500) / 18) * (等级 - 71);
  if (等级 === 90) return 18500;
  if (等级 <= 94) return 18875 + ((20000 - 18875) / 3) * (等级 - 91);
  if (等级 <= 99) return 20000 * Math.pow(2, 等级 - 94);
  if (等级 <= 99.5) return 20000 * Math.pow(2, 99 - 94) * 2;
  return 20000 * Math.pow(2, 99 - 94) * 4;
}

function 计算魂力曲线值_V1(等级值 = 1) {
  const 等级 = Math.max(1, Math.min(180, Number(等级值) || 1));
  const 最后锚点 = 魂力上限曲线锚点_V1[魂力上限曲线锚点_V1.length - 1];
  if (等级 >= 最后锚点.等级 && 等级 <= 99) {
    return 最后锚点.魂力上限 * Math.pow(2, 等级 - 最后锚点.等级);
  }
  if (等级 > 99 && 等级 <= 99.5) {
    return 最后锚点.魂力上限 * 16 * Math.pow(2, (等级 - 99) / 0.5);
  }
  if (等级 > 99.5 && 等级 <= 100) {
    return 最后锚点.魂力上限 * 32 * Math.pow(2, (等级 - 99.5) / 0.5);
  }
  if (等级 > 100) {
    return 最后锚点.魂力上限 * 64 * Math.pow(10, (等级 - 100) / 10);
  }
  for (let 序号 = 0; 序号 < 魂力上限曲线锚点_V1.length - 1; 序号 += 1) {
    const 起点 = 魂力上限曲线锚点_V1[序号];
    const 终点 = 魂力上限曲线锚点_V1[序号 + 1];
    if (等级 >= 起点.等级 && 等级 <= 终点.等级) {
      const 比例 = 平滑插值比例_V1((等级 - 起点.等级) / (终点.等级 - 起点.等级));
      return 起点.魂力上限 + (终点.魂力上限 - 起点.魂力上限) * 比例;
    }
  }
  return 魂力上限曲线锚点_V1[0].魂力上限;
}

function 计算修炼魂力曲线校准倍率_V1(当前等级 = 1, 下一等级 = null) {
  const 起点等级 = Math.max(1, Number(当前等级) || 1);
  const 终点等级 = Math.max(起点等级, Number(下一等级 ?? getNextCultivationLevelStep(起点等级) ?? 起点等级) || 起点等级);
  const 旧差值 = Math.max(0.0001, 计算旧版魂力曲线值_V1(终点等级) - 计算旧版魂力曲线值_V1(起点等级));
  const 新差值 = Math.max(0.0001, 计算魂力曲线值_V1(终点等级) - 计算魂力曲线值_V1(起点等级));
  return Math.max(0.01, 新差值 / 旧差值);
}

var 装备等效锚点 = Object.freeze({
  斗铠: Object.freeze({
    1: Object.freeze({ 起始等级: 50, 目标等级: 70 }),
    2: Object.freeze({ 起始等级: 70, 目标等级: 90 }),
    3: Object.freeze({ 起始等级: 80, 目标等级: 93 }),
    4: Object.freeze({ 起始等级: 90, 目标等级: 98 }),
  }),
  机甲: Object.freeze({
    黄级: Object.freeze({ 起始等级: 40, 目标等级: 47.5 }),
    紫级: Object.freeze({ 起始等级: 50, 目标等级: 56.8 }),
    黑级: Object.freeze({ 起始等级: 60, 目标等级: 77 }),
    红级: Object.freeze({ 起始等级: 94, 目标等级: 96 }),
    规格外机甲: Object.freeze({ 起始等级: 1, 目标等级: 97 }),
  }),
});

function 计算装备等效属性包(起始等级 = 1, 目标等级 = 1) {
  const 起始 = Math.max(1, Number(起始等级) || 1);
  const 目标 = Math.max(起始, Number(目标等级) || 起始);
  const 起始基准 = getBaseStats(起始);
  const 目标基准 = getBaseStats(目标);
  return {
    sp_max: Math.max(0, Math.floor(目标基准.sp_max - 起始基准.sp_max)),
    men_max: Math.max(0, Math.floor(目标基准.men_max - 起始基准.men_max)),
    str: Math.max(0, Math.floor(目标基准.str - 起始基准.str)),
    agi: Math.max(0, Math.floor(目标基准.agi - 起始基准.agi)),
    vit_max: Math.max(0, Math.floor(目标基准.vit_max - 起始基准.vit_max)),
  };
}

function 获取斗铠等效属性包(斗铠等级 = 1) {
  const 等级 = Number(斗铠等级) || 1;
  const 锚点 = 装备等效锚点.斗铠[等级] || 装备等效锚点.斗铠[1];
  return 计算装备等效属性包(锚点.起始等级, 锚点.目标等级);
}

function 获取机甲等效属性包(机甲等级 = '黄级') {
  const 等级 = String(机甲等级 || '黄级');
  const 锚点 = 装备等效锚点.机甲[等级] || 装备等效锚点.机甲.黄级;
  return 计算装备等效属性包(锚点.起始等级, 锚点.目标等级);
}

var ArmorBaseStats = {
  1: 获取斗铠等效属性包(1),
  2: 获取斗铠等效属性包(2),
  3: 获取斗铠等效属性包(3),
  4: 获取斗铠等效属性包(4),
};
var MechBaseStats = {
  黄级: 获取机甲等效属性包('黄级'),
  紫级: 获取机甲等效属性包('紫级'),
  黑级: 获取机甲等效属性包('黑级'),
  红级: 获取机甲等效属性包('红级'),
  规格外机甲: 获取机甲等效属性包('规格外机甲'),
};

function 创建空装备属性加成_V1(包含等效等级 = false) {
  const 加成 = { 魂力上限: 0, 精神力上限: 0, 力量: 0, 防御: 0, 敏捷: 0, 体力上限: 0 };
  if (包含等效等级) 加成.等效等级 = 0;
  return 加成;
}

function 读取装备品质档位_V1(品质 = 0) {
  const 数值 = Number(品质 || 0);
  if (数值 < 1.0) return 0;
  if (数值 <= 1.2) return 1;
  if (数值 <= 1.5) return 2;
  if (数值 <= 1.8) return 3;
  return 4;
}

function 计算斗铠属性加成_V1(斗铠 = {}) {
  if (!(Number(斗铠?.等级 || 0) > 0)) {
    return { 属性加成: 创建空装备属性加成_V1(true), 已排异: false };
  }

  let 总品质 = 0;
  let 部件数 = 0;
  let 最高品质 = -Infinity;
  let 最低品质 = Infinity;
  Object.values(斗铠?.部件 || {}).forEach(部件 => {
    if (!部件 || 部件.状态 === '未打造' || 部件.状态 === '重创') return;
    const 品质 = Number(部件.品质系数 || 0);
    总品质 += 品质;
    部件数 += 1;
    if (品质 > 最高品质) 最高品质 = 品质;
    if (品质 < 最低品质) 最低品质 = 品质;
  });

  if (部件数 <= 0) return { 属性加成: 创建空装备属性加成_V1(true), 已排异: false };

  const 基准 = ArmorBaseStats[斗铠.等级] || ArmorBaseStats[1];
  const 平均品质 = 总品质 / 部件数;
  let 倍率 = 部件数 === 10 ? 平均品质 : 0.05 * 平均品质 * 部件数;
  const 已排异 = 部件数 > 1 && 读取装备品质档位_V1(最高品质) !== 读取装备品质档位_V1(最低品质);
  if (已排异) 倍率 *= 0.2;

  return {
    属性加成: {
      等效等级: 0,
      魂力上限: Math.floor(Number(基准?.sp_max || 0) * 倍率),
      精神力上限: Math.floor(Number(基准?.men_max || 0) * 倍率),
      力量: Math.floor(Number(基准?.str || 0) * 倍率),
      防御: Math.floor(Number(基准?.str || 0) * 倍率),
      敏捷: Math.floor(Number(基准?.agi || 0) * 倍率),
      体力上限: Math.floor(Number(基准?.vit_max || 0) * 倍率),
    },
    已排异,
  };
}

function 计算机甲属性加成_V1(机甲 = {}) {
  if (String(机甲?.等级 || '无') === '无' || String(机甲?.状态 || '') === '重创') {
    return 创建空装备属性加成_V1(false);
  }
  const 基准 = MechBaseStats[机甲.等级];
  if (!基准) return 创建空装备属性加成_V1(false);
  const 倍率 = Number(机甲?.品质系数 || 1.0);
  return {
    魂力上限: Math.floor(Number(基准.sp_max || 0) * 倍率),
    精神力上限: Math.floor(Number(基准.men_max || 0) * 倍率),
    力量: Math.floor(Number(基准.str || 0) * 倍率),
    防御: Math.floor(Number(基准.str || 0) * 倍率),
    敏捷: Math.floor(Number(基准.agi || 0) * 倍率),
    体力上限: Math.floor(Number(基准.vit_max || 0) * 倍率),
  };
}

function 计算当前装备生效属性加成_V1(角色或装备 = {}) {
  const 装备 = 角色或装备?.装备 && typeof 角色或装备.装备 === 'object' ? 角色或装备.装备 : 角色或装备;
  const 总加成 = 创建空装备属性加成_V1(false);
  const 追加加成 = 加成 => {
    ['魂力上限', '精神力上限', '力量', '防御', '敏捷', '体力上限'].forEach(字段 => {
      总加成[字段] += Math.floor(Number(加成?.[字段] || 0));
    });
  };
  if (装备?.斗铠?.装备状态 === '已装备') {
    追加加成(计算斗铠属性加成_V1(装备.斗铠).属性加成);
  }
  if (装备?.防具?.装备状态 === '已装备') {
    追加加成(计算装备属性加成_V1(装备.防具, 角色或装备));
  }
  if (装备?.机甲?.装备状态 === '已装备') {
    追加加成(计算机甲属性加成_V1(装备.机甲));
  }
  return 总加成;
}

var 物品被动战斗外原型集合_V1 = new Set(['修炼增益', '战斗外复活', '灵物吸收', '天赋提升', '永久属性提升', '魂骨年限提升']);
var 物品被动常驻原型集合_V1 = new Set(['属性修正', '结算修正', '判定修正', '规则防御']);
var 物品被动触发字段集合_V1 = new Set([
  '条件分支', '触发限制', '触发方式', '触发条件', '延迟回合', '持续回合', '有效期',
  '死亡时限', '复活代价时限', '复活后状态时限',
]);

function 读取物品被动技能条目_V1(物品 = {}, 选项 = {}) {
  if (!物品 || typeof 物品 !== 'object' || Array.isArray(物品)) return [];
  const 条目 = [];
  const 已见 = new Set();
  ['装备技能', '附带技能', '附带魂技'].forEach(字段名 => {
    const 技能表 = 物品[字段名] && typeof 物品[字段名] === 'object' && !Array.isArray(物品[字段名]) ? 物品[字段名] : {};
    Object.entries(技能表).forEach(([技能名, 技能]) => {
      if (!技能 || typeof 技能 !== 'object' || Array.isArray(技能) || String(技能.承载方式 || '').trim() !== '被动') return;
      const 效果数组 = Array.isArray(技能._效果数组)
        ? 技能._效果数组
        : Array.isArray(技能.效果数组) ? 技能.效果数组 : [];
      if (!效果数组.length) return;
      const 身份键 = `${字段名}|${技能名}|${JSON.stringify(效果数组)}`;
      if (已见.has(身份键)) return;
      已见.add(身份键);
      条目.push({
        字段: 字段名,
        技能名: String(技能名 || 技能.魂技名 || '被动技能').trim() || '被动技能',
        技能: cloneJsonValue(技能, {}),
        效果数组: cloneJsonValue(效果数组, []),
        来源物品: String(选项.来源物品 || 物品.名称 || 物品.name || 物品.物品名 || '').trim(),
        来源槽位: String(选项.来源槽位 || '').trim(),
      });
    });
  });
  return 条目;
}

function 物品被动效果含触发字段_V1(效果 = {}) {
  if (!效果 || typeof 效果 !== 'object') return false;
  return [...物品被动触发字段集合_V1].some(字段名 => {
    const 值 = 效果[字段名];
    return Array.isArray(值) ? 值.length > 0 : 值 !== undefined && 值 !== null && 值 !== '';
  });
}

function 物品被动效果可常驻_V1(效果 = {}, 技能 = {}) {
  const 原型 = String(效果?.原型 || '').trim();
  const 目标 = String(效果?.目标 || '自身').trim();
  return 物品被动常驻原型集合_V1.has(原型)
    && 目标 === '自身'
    && !物品被动效果含触发字段_V1(技能)
    && !物品被动效果含触发字段_V1(效果);
}

function 装备要求满足_V1(角色 = {}, 要求 = {}) {
  if (!要求 || typeof 要求 !== 'object' || Array.isArray(要求) || !Object.keys(要求).length) return true;
  if (!角色 || typeof 角色 !== 'object' || Array.isArray(角色)) return false;
  const 装备文本 = () => {
    try {
      return JSON.stringify({ 装备: 角色.装备 || {}, 已装备: 角色.已装备 || {}, 装备栏: 角色.装备栏 || {}, 魂骨: 角色.魂骨 || {} });
    } catch (_error) {
      return '';
    }
  };
  const 装备身份文本 = () => {
    const values = [];
    const visit = (value, key = '') => {
      if (!value || typeof value !== 'object') {
        if (key) values.push(key);
        if (value !== undefined && value !== null) values.push(String(value));
        return;
      }
      if (Array.isArray(value)) {
        value.forEach(entry => visit(entry));
        return;
      }
      if (key) values.push(key);
      ['名称', 'name', '物品名', 'id', '物品ID', '装备槽位', '装备状态', '材质', '品质', '品阶']
        .forEach(field => {
          if (value[field] !== undefined) values.push(String(value[field] || ''));
        });
      Object.entries(value).forEach(([childKey, child]) => {
        if (['描述', '效果描述', '画面描述', '说明', '备注', '使用限制或归属说明'].includes(childKey)) return;
        if (child && typeof child === 'object') visit(child, childKey);
      });
    };
    visit({ 装备: 角色.装备 || {}, 已装备: 角色.已装备 || {}, 装备栏: 角色.装备栏 || {}, 魂骨: 角色.魂骨 || {} });
    return values.filter(Boolean).join('|');
  };
  const 单位文本 = () => {
    try {
      const identity = {};
      [
        'id', 'name', '名称', '类型', '单位类型', '种族', '阵营', '系别', '武魂',
        '武魂类型', '血脉', '天赋', '天赋梯队', '描述', '摘要',
      ].forEach(field => {
        if (角色[field] !== undefined) identity[field] = cloneJsonValue(角色[field]);
      });
      if (角色.属性 && typeof 角色.属性 === 'object' && !Array.isArray(角色.属性)) {
        const statIdentity = {};
        ['武魂', '武魂类型', '血脉', '天赋', '天赋梯队', '类型', '单位类型', '种族', '阵营', '系别'].forEach(field => {
          if (角色.属性[field] !== undefined) statIdentity[field] = cloneJsonValue(角色.属性[field]);
        });
        if (Object.keys(statIdentity).length) identity.属性 = statIdentity;
      }
      return JSON.stringify(identity);
    } catch (_error) {
      return '';
    }
  };
  const 血脉文本 = [
    角色?.血脉之力?.血脉,
    角色?.血脉?.血脉,
    角色?.血脉,
    角色?.属性?.血脉,
  ].map(value => String(value || '').trim()).filter(Boolean).join('|');
  const 武器材质 = String(角色?.装备?.武器?.材质 || '').trim();
  const 文本匹配 = (actual, expected, comparison = '包含') => {
    const left = String(actual || '').trim();
    const right = String(expected || '').trim();
    if (!right) return false;
    if (comparison === '==') return left === right;
    if (comparison === '!=') return left !== right;
    if (comparison === '不包含') return !left.includes(right);
    if (comparison === '有') return right ? left.includes(right) : Boolean(left);
    if (comparison === '无') return right ? !left.includes(right) : !left;
    return left.includes(right);
  };
  return Object.entries(要求).every(([字段名, raw]) => {
    if (字段名 === '单位文本') {
      const 条件 = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : { 比较: '包含', 值: raw };
      return 文本匹配(单位文本(), 条件.值, String(条件.比较 || '包含').trim());
    }
    if (字段名 === '武器材质') {
      const wanted = Array.isArray(raw) ? raw.map(value => String(value || '').trim()).filter(Boolean) : [String(raw || '').trim()];
      return wanted.some(value => {
        if (!武器材质) return false;
        if (value === '非金属' || /非金属/.test(value)) return /非金属/.test(武器材质) || !/金属/.test(武器材质);
        if (value === '金属' || /金属/.test(value)) return /金属/.test(武器材质) && !/非金属/.test(武器材质);
        return 武器材质.includes(value);
      });
    }
    if (字段名 === '血脉') return (Array.isArray(raw) ? raw : [raw]).some(value => 血脉文本.includes(String(value || '').trim()));
    if (字段名 === '装备包含') return (Array.isArray(raw) ? raw : [raw]).some(value => 装备身份文本().includes(String(value || '').trim()));
    if (字段名 === '装备品质' || 字段名 === '武器品质') {
      const 品质文本 = 装备身份文本();
      return (Array.isArray(raw) ? raw : [raw]).some(value => 品质文本.includes(String(value || '').trim()));
    }
    if (字段名 === '装备状态') return 文本匹配(装备身份文本(), raw, '包含');
    return false;
  });
}

function 读取物品被动受击门槛_V1(物品 = {}, 技能 = {}) {
  const 文本 = [
    物品?.描述,
    技能?.效果描述,
    技能?.画面描述,
  ].map(value => String(value || '').trim()).filter(Boolean).join('；');
  if (!文本 || !/(承受|抵御|防护|不破|抗住)/.test(文本)) return 0;
  const 匹配 = 文本.match(/第([零〇一二三四五六七八九十百千万\d]+)魂技(?:级别)?(?:以下|以内)?/);
  if (!匹配) return 0;
  const 原始 = String(匹配[1] || '').trim();
  const 阿拉伯 = Number(原始);
  if (Number.isFinite(阿拉伯) && 阿拉伯 > 0) return Math.max(1, Math.floor(阿拉伯 * 10));
  const 数字 = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (原始.length === 1 && Number.isFinite(数字[原始])) return 数字[原始] * 10;
  const 十位 = 原始.indexOf('十');
  if (十位 >= 0) {
    const 前 = 十位 === 0 ? 1 : Number(数字[原始[十位 - 1]] || 0);
    const 后 = 十位 === 原始.length - 1 ? 0 : Number(数字[原始[十位 + 1]] || 0);
    const 魂技位 = 前 * 10 + 后;
    return 魂技位 > 0 ? 魂技位 * 10 : 0;
  }
  return 0;
}

function 编译物品被动消费者_V1(物品 = {}, 选项 = {}) {
  const 技能条目 = 读取物品被动技能条目_V1(物品, 选项);
  const 常驻效果 = [];
  const 动作效果 = [];
  const 非战斗路由 = [];
  const 未支持路由 = [];
  const 角色 = 选项?.角色 && typeof 选项.角色 === 'object' && !Array.isArray(选项.角色) ? 选项.角色 : null;
  const 条目结果 = 技能条目.map(条目 => {
    const 技能装备要求 = 条目?.技能?.装备要求;
    if (角色 && 技能装备要求 !== undefined && !装备要求满足_V1(角色, 技能装备要求)) return null;
    const 有效效果数组 = 条目.效果数组.filter(效果 => {
      const 效果装备要求 = 效果?.装备要求;
      return !角色 || 效果装备要求 === undefined || 装备要求满足_V1(角色, 效果装备要求);
    });
    const 受击门槛 = 读取物品被动受击门槛_V1(物品, 条目.技能);
    if (
      受击门槛 > 0 &&
      !有效效果数组.some(效果 =>
        String(效果?.原型 || '').trim() === '结算修正' &&
        String(效果?.结算 || '').trim() === '受到伤害' &&
        String(效果?.对应等级用途 || '').trim() === '受击门槛',
      )
    ) {
      有效效果数组.push({
        原型: '结算修正',
        目标: '自身',
        生效方式: '独立生效',
        结算: '受到伤害',
        数值: '-0%',
        对应等级: 受击门槛,
        对应等级用途: '受击门槛',
      });
    }
    if (!有效效果数组.length) return null;
    const 条目副本 = {
      ...条目,
      技能: {
        ...条目.技能,
        _效果数组: cloneJsonValue(有效效果数组, []),
      },
      效果数组: cloneJsonValue(有效效果数组, []),
    };
    const 常驻 = [];
    const 动作 = [];
    const 非战斗 = [];
    const 未支持 = [];
    有效效果数组.forEach(效果 => {
      const 原型 = String(效果?.原型 || '').trim();
      const 来源 = {
        来源物品: 条目.来源物品,
        来源槽位: 条目.来源槽位,
        来源字段: 条目.字段,
        技能名: 条目.技能名,
        ...(条目?.技能?.装备要求 !== undefined ? { 技能装备要求: cloneJsonValue(条目.技能.装备要求) } : {}),
        ...(效果?.装备要求 !== undefined ? { 效果装备要求: cloneJsonValue(效果.装备要求) } : {}),
      };
      if (!原型 || !SKILL_PROTOTYPE_REGISTRY_V1[原型]) {
        未支持.push({ 效果: cloneJsonValue(效果, {}), 来源 });
        未支持路由.push({ 路由: 'battle-prototype-registry', 效果: cloneJsonValue(效果, {}), 来源 });
        return;
      }
      if (物品被动战斗外原型集合_V1.has(原型)) {
        非战斗.push(效果);
        非战斗路由.push({ 路由: 'EquipmentManager.结算战斗外使用效果列表', 效果: cloneJsonValue(效果, {}), 来源 });
        return;
      }
      if (物品被动效果可常驻_V1(效果, 条目.技能)) {
        常驻.push(效果);
        常驻效果.push({ 效果: cloneJsonValue(效果, {}), 来源 });
        return;
      }
      动作.push(效果);
      const 技能触发方式 = String(条目.技能?.触发方式 || '').trim();
      const 效果触发方式 = String(效果?.触发方式 || '').trim();
      动作效果.push({
        效果: cloneJsonValue(效果, {}),
        来源,
        ...(技能触发方式 || 效果触发方式
          ? { 触发方式: 效果触发方式 || 技能触发方式 }
          : {}),
      });
    });
    return {
      ...条目副本,
      常驻效果: cloneJsonValue(常驻, []),
      动作效果: cloneJsonValue(动作, []),
      非战斗效果: cloneJsonValue(非战斗, []),
      未支持效果: cloneJsonValue(未支持, []),
      分类: 未支持.length
        ? 'unsupported'
        : 非战斗.length && (常驻.length || 动作.length)
          ? 'mixed'
          : 非战斗.length
            ? 'non-battle'
            : 常驻.length && 动作.length
              ? 'mixed'
              : 常驻.length ? 'persistent' : 'battle-action',
    };
  }).filter(Boolean);
  return {
    版本: 'item-passive-consumer-v1',
    有效: 条目结果.length > 0,
    来源物品: String(选项.来源物品 || 物品.名称 || 物品.name || 物品.物品名 || '').trim(),
    来源槽位: String(选项.来源槽位 || '').trim(),
    技能条目: 条目结果,
    常驻效果,
    动作效果,
    非战斗路由,
    未支持路由,
  };
}

function 编译角色装备被动消费者_V1(角色 = {}) {
  if (!角色 || typeof 角色 !== 'object' || Array.isArray(角色)) return { 版本: 'item-passive-consumer-v1', 有效: false, 来源物品列表: [], 技能条目: [], 常驻效果: [], 动作效果: [], 非战斗路由: [], 未支持路由: [] };
  const 物品列表 = [];
  const 记录物品 = (槽位, 物品, 已生效 = true) => {
    if (!已生效) return;
    if (!物品 || typeof 物品 !== 'object' || Array.isArray(物品)) return;
    const 名称 = String(物品.名称 || 物品.name || 物品.物品名 || '').trim();
    if (名称 && 名称 !== '无') 物品列表.push({ 槽位, 物品: { ...物品, 名称 }, 名称 });
  };
  const 装备 = 角色.装备 && typeof 角色.装备 === 'object' && !Array.isArray(角色.装备) ? 角色.装备 : {};
  记录物品('武器', 装备.武器);
  记录物品('防具', 装备.防具, 装备.防具?.装备状态 === '已装备');
  记录物品('机甲', 装备.机甲, 装备.机甲?.装备状态 === '已装备');
  Object.entries(装备.魂导器?.装配 || {}).forEach(([子槽位, 子物品]) => {
    const 状态 = String(子物品?.装备状态 || '').trim();
    记录物品(`魂导器.${子槽位}`, 子物品, !状态 || ['已装配', '已装备', '已装载', '在线'].includes(状态));
  });
  const 斗铠已装备 = 装备.斗铠?.装备状态 === '已装备';
  Object.entries(装备.斗铠?.部件 || {}).forEach(([部件槽位, 部件]) => 记录物品(`斗铠.${部件槽位}`, 部件, 斗铠已装备));
  Object.entries(角色.魂骨 || {}).forEach(([槽位, 魂骨]) => 记录物品(`魂骨.${槽位}`, 魂骨));
  const 合并 = {
    版本: 'item-passive-consumer-v1',
    有效: false,
    来源物品列表: 物品列表.map(条目 => ({ 槽位: 条目.槽位, 名称: 条目.名称 })),
    技能条目: [],
    常驻效果: [],
    动作效果: [],
    非战斗路由: [],
    未支持路由: [],
  };
  物品列表.forEach(({ 槽位, 物品, 名称 }) => {
    const 结果 = 编译物品被动消费者_V1(物品, { 来源物品: 名称, 来源槽位: 槽位, 角色 });
    if (!结果.有效) return;
    合并.有效 = true;
    合并.技能条目.push(...结果.技能条目);
    合并.常驻效果.push(...结果.常驻效果);
    合并.动作效果.push(...结果.动作效果);
    合并.非战斗路由.push(...结果.非战斗路由);
    合并.未支持路由.push(...结果.未支持路由);
  });
  return 合并;
}

var JobExpThresholds = [0, 1000, 5000, 12000, 60000, 80000, 400000, 500000, 3000000, 99999999];
var 魂导师能力映射_V1 = Object.freeze({
  1: Object.freeze({ 锻造师: 1, 设计师: 1, 制造师: 1 }),
  2: Object.freeze({ 锻造师: 1, 设计师: 2, 制造师: 2 }),
  3: Object.freeze({ 锻造师: 2, 设计师: 3, 制造师: 3 }),
  4: Object.freeze({ 锻造师: 3, 设计师: 3, 制造师: 3 }),
  5: Object.freeze({ 锻造师: 4, 设计师: 4, 制造师: 4 }),
  6: Object.freeze({ 锻造师: 4, 设计师: 5, 制造师: 5 }),
  7: Object.freeze({ 锻造师: 5, 设计师: 5, 制造师: 5 }),
  8: Object.freeze({ 锻造师: 6, 设计师: 6, 制造师: 6 }),
  9: Object.freeze({ 锻造师: 7, 设计师: 7, 制造师: 7 }),
  10: Object.freeze({ 锻造师: 8, 设计师: 8, 制造师: 8 }),
});
function 读取副职业最高等级_V1(副职业名 = '') {
  return String(副职业名 || '').trim() === '魂导师' ? 10 : 9;
}

function 读取副职业显示名_V1(副职业名 = '') {
  return { 制造师: '机甲制造师', 设计师: '机甲设计师', 修理师: '机甲修理师' }[String(副职业名 || '').trim()] || String(副职业名 || '').trim();
}

var 副职业中文等级数字_V1 = Object.freeze({ 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 });
function 解析副职业称号认证等级_V1(文本 = '', 最高等级 = 9) {
  const 内容 = String(文本 || '').trim();
  if (!内容 || 内容 === '无' || /^准\s*[一二两三四五六七八九十\d]/.test(内容)) return 0;
  const 数字匹配 = 内容.match(/(?:^|[^\d])([1-9]|10)\s*级/);
  if (数字匹配) return Math.max(0, Math.min(最高等级, Math.floor(Number(数字匹配[1] || 0))));
  const 中文匹配 = 内容.match(/([一二两三四五六七八九十])\s*级/);
  if (中文匹配) return Math.max(0, Math.min(最高等级, 副职业中文等级数字_V1[中文匹配[1]] || 0));
  return 0;
}

function 读取副职业称号认证等级_V1(副职业名 = '', 副职业数据 = {}) {
  const 数据 = 副职业数据 && typeof 副职业数据 === 'object' && !Array.isArray(副职业数据) ? 副职业数据 : {};
  const 最高等级 = 读取副职业最高等级_V1(副职业名);
  return 解析副职业称号认证等级_V1([数据.称号, 数据.认证身份, 数据.身份].filter(Boolean).join(' '), 最高等级);
}

function 读取副职业认证等级_V1(副职业名 = '', 副职业数据 = {}) {
  const 数据 = 副职业数据 && typeof 副职业数据 === 'object' && !Array.isArray(副职业数据) ? 副职业数据 : {};
  const 最高等级 = 读取副职业最高等级_V1(副职业名);
  const 显式等级 = Math.max(0, Math.floor(Number(数据.等级 || 0)));
  const 称号等级 = 读取副职业称号认证等级_V1(副职业名, 数据);
  return Math.max(0, Math.min(最高等级, Math.max(显式等级, 称号等级)));
}

function 读取魂导师解锁能力等级_V1(魂导师等级 = 0, 副职业名 = '') {
  const 等级 = Math.max(0, Math.min(10, Math.floor(Number(魂导师等级 || 0))));
  const 能力名 = String(副职业名 || '').trim();
  return Math.max(0, Math.floor(Number(魂导师能力映射_V1[等级]?.[能力名] || 0)));
}

function 读取副职业等级_V1(副职业名 = '', 副职业数据 = {}) {
  return 读取副职业认证等级_V1(副职业名, 副职业数据);
}

function 读取副职业等级进度_V1(等级 = 0, 经验 = 0) {
  const 等级数值 = Math.max(0, Math.min(10, Math.floor(Number(等级 || 0))));
  if (等级数值 >= 10) return 0;
  const 当前经验 = Math.max(0, Number(经验 || 0));
  const 当前底线 = JobExpThresholds[Math.max(0, 等级数值 - 1)] || 0;
  const 下级底线 = JobExpThresholds[Math.min(等级数值, 9)] || JobExpThresholds[9];
  return Math.max(0, Math.min(0.999, (当前经验 - 当前底线) / Math.max(1, 下级底线 - 当前底线)));
}

function 读取副职业经验成功率加成_V1(等级 = 0, 经验 = 0) {
  const 等级数值 = Math.max(0, Math.min(10, Math.floor(Number(等级 || 0))));
  if (等级数值 <= 0 || 等级数值 >= 10) return 0;
  return Math.max(0, Math.min(30, Math.floor(读取副职业等级进度_V1(等级数值, 经验) * 30)));
}

function 读取副职业基础成功率_V1(等级 = 0, 经验 = 0) {
  const 等级数值 = Math.max(0, Math.min(10, Math.floor(Number(等级 || 0))));
  if (等级数值 <= 0) return 0;
  const 认证基准 = 等级数值 >= 9 ? 50 : 30;
  return Math.max(0, Math.min(100, 认证基准 + 读取副职业经验成功率加成_V1(等级数值, 经验)));
}

function 读取副职业核心技艺文本_V1(_副职业名 = '', 等级 = 0) {
  const 副职业名 = String(_副职业名 || '').trim();
  const 等级数值 = Math.max(0, Math.min(读取副职业最高等级_V1(副职业名), Math.floor(Number(等级 || 0))));
  if (副职业名 === '魂导师') {
    if (等级数值 >= 10) return '十级魂导师（十级魂导器独立制造）';
    if (等级数值 >= 9) return '九级魂导师（九级魂导器与阵列工程组装）';
    if (等级数值 >= 1) {
      const 映射 = 魂导师能力映射_V1[等级数值] || {};
      return `魂导器制作（锻造${映射.锻造师 || 0}/设计${映射.设计师 || 0}/制造${映射.制造师 || 0}）`;
    }
    return '未掌握';
  }
  const 能力档位 = 等级数值 >= 9
    ? { 锻造师: '天锻', 设计师: '四字斗铠/红级以上机甲设计', 制造师: '四字斗铠/红级以上机甲制造', 修理师: '四字斗铠/红级以上机甲修理' }
    : 等级数值 >= 7
      ? { 锻造师: '魂锻', 设计师: '三字斗铠/红级机甲设计', 制造师: '三字斗铠/红级机甲制造', 修理师: '三字斗铠/红级机甲修理' }
      : 等级数值 >= 5
        ? { 锻造师: '灵锻', 设计师: '二字斗铠/黑级机甲设计', 制造师: '二字斗铠/黑级机甲制造', 修理师: '二字斗铠/黑级机甲修理' }
        : 等级数值 >= 3
          ? { 锻造师: '千锻', 设计师: '一字斗铠/紫级机甲设计', 制造师: '一字斗铠/紫级机甲制造', 修理师: '一字斗铠/紫级机甲修理' }
          : 等级数值 >= 1
            ? { 锻造师: '百锻', 设计师: '黄级机甲设计', 制造师: '黄级机甲制造', 修理师: '黄级机甲修理' }
            : null;
  if (能力档位?.[副职业名]) return 能力档位[副职业名];
  return '未掌握';
}

function 读取副职业支持融锻数值表_V1(等级 = 0) {
  const 等级数值 = Math.max(0, Math.min(9, Math.floor(Number(等级 || 0))));
  if (等级数值 >= 9) return { 天锻: 7, 低阶默认可承接: true };
  if (等级数值 >= 8) return { 千锻: 7, 灵锻: 7, 魂锻: 5 };
  if (等级数值 >= 7) return { 千锻: 7, 灵锻: 5, 魂锻: 2 };
  if (等级数值 >= 6) return { 千锻: 5, 灵锻: 3 };
  if (等级数值 >= 5) return { 千锻: 2, 灵锻: 1 };
  if (等级数值 >= 4) return { 千锻: 2 };
  return {};
}

function 读取副职业支持融锻文本_V1(等级 = 0) {
  const 等级数值 = Math.max(0, Math.min(9, Math.floor(Number(等级 || 0))));
  if (等级数值 >= 9) return '天锻+7，低阶默认可承接';
  if (等级数值 >= 8) return '千锻+7，灵锻+7，魂锻+5';
  if (等级数值 >= 7) return '千锻+7，灵锻+5，魂锻+2';
  if (等级数值 >= 6) return '千锻+5，灵锻+3';
  if (等级数值 >= 5) return '千锻+2，灵锻';
  if (等级数值 >= 4) return '千锻+2';
  return '未开放';
}

function 读取副职业阶位融锻数_V1(等级 = 0, 阶位 = 1) {
  const 等级数值 = Math.max(0, Math.min(9, Math.floor(Number(等级 || 0))));
  const 阶位数值 = Math.max(1, Math.min(5, Math.floor(Number(阶位 || 1))));
  if (等级数值 >= 9) return 7;
  const 档位名 = { 2: '千锻', 3: '灵锻', 4: '魂锻', 5: '天锻' }[阶位数值] || '';
  const 数值表 = 读取副职业支持融锻数值表_V1(等级数值);
  return Math.max(1, Number(数值表[档位名] || 1));
}

function 读取副职业最高支持融锻数_V1(等级 = 0) {
  const 数值表 = 读取副职业支持融锻数值表_V1(等级);
  const 数值列表 = Object.entries(数值表)
    .filter(([键]) => 键 !== '低阶默认可承接')
    .map(([, 值]) => Number(值 || 0))
    .filter(值 => Number.isFinite(值) && 值 > 0);
  return Math.max(1, ...数值列表);
}

function 派生副职业运行时_V1(副职业名 = '', 副职业数据 = {}) {
  const 数据 = 副职业数据 && typeof 副职业数据 === 'object' && !Array.isArray(副职业数据) ? 副职业数据 : {};
  const 经验 = Math.max(0, Math.floor(Number(数据.经验 || 0)));
  const 等级 = 读取副职业认证等级_V1(副职业名, 数据);
  const 是魂导师 = String(副职业名 || '').trim() === '魂导师';
  const 支持融锻数值表 = 是魂导师 ? {} : 读取副职业支持融锻数值表_V1(等级);
  return {
    副职业: String(副职业名 || '').trim(),
    等级,
    经验,
    称号: String(数据.称号 || '无').trim() || '无',
    核心技艺: 读取副职业核心技艺文本_V1(副职业名, 等级),
    支持融锻数: 是魂导师 ? '按魂导师能力映射解锁' : 读取副职业支持融锻文本_V1(等级),
    支持融锻数值表,
    最高支持融锻数: 是魂导师 ? 1 : 读取副职业最高支持融锻数_V1(等级),
    基础成功率: 读取副职业基础成功率_V1(等级, 经验),
    经验成功率加成: 读取副职业经验成功率加成_V1(等级, 经验),
    本级进度: 读取副职业等级进度_V1(等级, 经验),
  };
}

try {
  const 副职业派生接口_V1 = Object.freeze({
    经验阈值: JobExpThresholds,
    读取等级: 读取副职业等级_V1,
    读取认证等级: 读取副职业认证等级_V1,
    读取最高等级: 读取副职业最高等级_V1,
    读取魂导师解锁能力等级: 读取魂导师解锁能力等级_V1,
    读取等级进度: 读取副职业等级进度_V1,
    读取基础成功率: 读取副职业基础成功率_V1,
    读取经验成功率加成: 读取副职业经验成功率加成_V1,
    读取核心技艺文本: 读取副职业核心技艺文本_V1,
    读取支持融锻文本: 读取副职业支持融锻文本_V1,
    读取支持融锻数值表: 读取副职业支持融锻数值表_V1,
    读取阶位融锻数: 读取副职业阶位融锻数_V1,
    读取最高支持融锻数: 读取副职业最高支持融锻数_V1,
    读取显示名: 读取副职业显示名_V1,
    派生运行时: 派生副职业运行时_V1,
  });
  globalThis.__LWCS_PROFESSION_DERIVATION__ = 副职业派生接口_V1;
  try { if (globalThis.parent && globalThis.parent !== globalThis) globalThis.parent.__LWCS_PROFESSION_DERIVATION__ = 副职业派生接口_V1; } catch (错误) {}
  try { if (globalThis.top && globalThis.top !== globalThis) globalThis.top.__LWCS_PROFESSION_DERIVATION__ = 副职业派生接口_V1; } catch (错误) {}
} catch (错误) {}
function getRingBonus(age) {
  return {
    str: Math.floor(age * 0.005),
    def: Math.floor(age * 0.005),
    agi: Math.floor(age * 0.005),
    vit_max: Math.floor(age * 0.005),
    men_max: Math.floor(age * 0.001),
    sp_max: Math.floor(age * 0.01),
  };
}
function getRingColorByAge(age) {
  const safeAge = Math.max(0, Math.floor(Number(age) || 0));
  if (safeAge >= 200000) return '橙金';
  if (safeAge >= 100000) return '红';
  if (safeAge >= 10000) return '黑';
  if (safeAge >= 1000) return '紫';
  if (safeAge >= 100) return '黄';
  return '白';
}

var 自动生成魂灵最低年限_V1 = 10;

function 读取魂灵年限承载上限_V1(魂灵数据 = {}) {
  const 年限 = Math.max(0, Math.floor(Number(typeof 魂灵数据 === 'number' ? 魂灵数据 : 魂灵数据?.年限 || 0)));
  if (年限 >= 10000) return 4;
  if (年限 >= 1000) return 3;
  if (年限 >= 100) return 2;
  if (年限 >= 自动生成魂灵最低年限_V1) return 1;
  return 0;
}

function 读取突破魂灵序位承载上限_V1(武魂槽位 = '第1武魂', 魂灵序号 = 0) {
  if (String(武魂槽位 || '').trim() === '第2武魂') return 4;
  return Math.max(0, Math.floor(Number(魂灵序号 || 0))) <= 1 ? 2 : 4;
}

function 读取突破魂灵承载上限_V1(魂灵数据 = {}, 武魂槽位 = '第1武魂', 魂灵序号 = 0) {
  return Math.min(
    读取魂灵年限承载上限_V1(魂灵数据),
    读取突破魂灵序位承载上限_V1(武魂槽位, 魂灵序号),
  );
}

var SOUL_TOWER_MAX_AGE = 30;

function createEmptySoulTowerDiscountSpiritRecord() {
  return {
    层数: 0,
    名称: '',
    标准物种: '',
    年限: 0,
    品质: '',
    已使用: false,
  };
}

function normalizeSoulTowerDiscountSpiritRecord(record = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return createEmptySoulTowerDiscountSpiritRecord();
  }
  const next = createEmptySoulTowerDiscountSpiritRecord();
  next.层数 = Math.max(0, Math.floor(Number(record.层数 || 0)));
  next.名称 = String(record.名称 || '').trim();
  next.标准物种 = String(record.标准物种 || '').trim();
  next.年限 = Math.max(0, Math.floor(Number(record.年限 || 0)));
  next.品质 = normalizeSoulSpiritQuality(record.品质 || '');
  next.已使用 = record.已使用 === true;
  if (!(next.层数 > 0 && next.标准物种 && next.年限 > 0 && next.品质 && next.已使用 === false)) {
    return createEmptySoulTowerDiscountSpiritRecord();
  }
  if (!next.名称) next.名称 = `${next.标准物种}魂灵`;
  return next;
}

function formatSoulTowerDiscountSpiritSummary(record = {}) {
  const normalized = normalizeSoulTowerDiscountSpiritRecord(record);
  if (!(normalized.层数 > 0)) return '无';
  return `第${normalized.层数}层 ${normalized.标准物种} ${normalized.年限}年 ${normalized.品质}`;
}

function getCharacterAgeNumber(char = {}) {
  const rawAge = char?.属性?.年龄;
  if (typeof rawAge === 'number') return Number.isFinite(rawAge) ? rawAge : NaN;
  const text = String(rawAge == null ? '' : rawAge).trim();
  if (!text) return NaN;
  const directNumber = Number(text);
  if (Number.isFinite(directNumber)) return directNumber;
  const numericText = text.match(/-?\d+(?:\.\d+)?/);
  return numericText ? Number(numericText[0]) : NaN;
}

function isSoulTowerEligibleCharacter(char = {}) {
  const ageValue = getCharacterAgeNumber(char);
  return Number.isFinite(ageValue) && ageValue > 0 && ageValue <= SOUL_TOWER_MAX_AGE;
}

function syncSoulTowerRecordEligibility(char = {}) {
  if (!char || typeof char !== 'object') return;
  if (!isSoulTowerEligibleCharacter(char)) {
    delete char.魂灵塔记录;
    return;
  }
  if (!char.魂灵塔记录 || typeof char.魂灵塔记录 !== 'object' || Array.isArray(char.魂灵塔记录)) {
    char.魂灵塔记录 = { 最高层: 0, 当前五折魂灵: createEmptySoulTowerDiscountSpiritRecord() };
    return;
  }
  char.魂灵塔记录.最高层 = Math.max(0, Math.floor(Number(char.魂灵塔记录.最高层 || 0)));
  char.魂灵塔记录.当前五折魂灵 = normalizeSoulTowerDiscountSpiritRecord(char.魂灵塔记录.当前五折魂灵 || {});
}

function createDefaultRingSkillShell() {
  return {
    ['\u9b42\u6280\u540d']: AI_TODO_SKILL_NAME,
    ['\u753b\u9762\u63cf\u8ff0']: AI_TODO_SKILL_VISUAL,
    ['\u6548\u679c\u63cf\u8ff0']: AI_TODO_SKILL_EFFECT,
    _\u6548\u679c\u6570\u7ec4: [],
  };
}

function buildDefaultRingSkillMap(ringIndex, ringAge) {
  const 技能序号 = Math.max(1, Math.floor(Number(ringIndex) || 1));
  const baseSkillKey = `第${技能序号}魂技`;
  if (技能序号 === 7) {
    return {
      [baseSkillKey]: { ...createDefaultRingSkillShell(), 魂技名: '武魂真身' },
    };
  }
  const skills = {
    [baseSkillKey]: createDefaultRingSkillShell(),
  };
  if (Math.floor(Number(ringAge) || 0) >= 100000) {
    skills[`${baseSkillKey}_2`] = createDefaultRingSkillShell();
  }
  return skills;
}

function buildDefaultBloodlineRingSkillMap(ringIndex, ringAge) {
  const 技能序号 = Math.max(1, Math.floor(Number(ringIndex) || 1));
  const baseSkillKey = `第${技能序号}血脉魂技`;
  const skills = { [baseSkillKey]: createDefaultRingSkillShell() };
  if (Math.floor(Number(ringAge) || 0) >= 100000) skills[`${baseSkillKey}_2`] = createDefaultRingSkillShell();
  return skills;
}

function 读取槽位序号_V1(槽位名 = '', 默认值 = 1) {
  const 数字匹配 = String(槽位名 || '').match(/第(\d+)/);
  return Math.max(1, Math.floor(Number(数字匹配 ? 数字匹配[1] : 默认值) || 默认值 || 1));
}

function 是武魂槽位键_V1(键 = '') {
  return /^第\d+武魂$/.test(String(键 || '').trim());
}

function 是魂灵槽位键_V1(键 = '') {
  return /^第\d+魂灵$/.test(String(键 || '').trim());
}

function 是魂环槽位键_V1(键 = '') {
  return /^第\d+魂环$/.test(String(键 || '').trim());
}

function 是魂技槽位键_V1(键 = '') {
  return /^第\d+魂技(?:_2)?$/.test(String(键 || '').trim());
}

function 是气血魂环槽位键_V1(键 = '') {
  return /^第\d+气血魂环$/.test(String(键 || '').trim());
}

function 是血脉魂技槽位键_V1(键 = '') {
  return /^第\d+血脉魂技(?:_2)?$/.test(String(键 || '').trim());
}

function 取对象槽位条目_V1(对象 = {}, 判断函数 = () => false) {
  return Object.entries(对象 || {}).filter(([, 值]) => 值 && typeof 值 === 'object' && !Array.isArray(值)).filter(([键]) => 判断函数(键));
}

function 取角色武魂条目_V1(char = {}) {
  return 取对象槽位条目_V1(char, 是武魂槽位键_V1);
}

function 取角色主武魂系别_V1(char = {}, fallback = '强攻系') {
  const 条目 = 取角色武魂条目_V1(char);
  const 第1武魂 = 条目.find(([键]) => 键 === '第1武魂')?.[1] || 条目[0]?.[1] || {};
  const 系别 = String(第1武魂?.系别 || '').trim();
  return 系别 && 系别 !== '未知系' && !/待补全|AI_TODO/.test(系别) ? 系别 : fallback;
}

function 取武魂魂灵条目_V1(武魂数据 = {}) {
  return 取对象槽位条目_V1(武魂数据, 是魂灵槽位键_V1);
}

function 取武魂直接魂环条目_V1(武魂数据 = {}) {
  return 取对象槽位条目_V1(武魂数据, 是魂环槽位键_V1);
}

function 是否真实武魂数据_V1(武魂数据 = {}) {
  if (!武魂数据 || typeof 武魂数据 !== 'object' || Array.isArray(武魂数据)) return false;
  const 武魂名 = String(武魂数据.表象名称 || 武魂数据.名称 || '').trim();
  const 武魂文本 = [武魂名, 武魂数据.系别, 武魂数据.描述].join('\n');
  if (/非魂师|无魂力|无魂师战斗修为/.test(武魂文本)) return false;
  return (
    取武魂魂灵条目_V1(武魂数据).length > 0 ||
    取武魂直接魂环条目_V1(武魂数据).length > 0 ||
    !!(武魂名 && !['未展露', '无', '未知'].includes(武魂名) && !isAiTodoText(武魂名))
  );
}

function 取魂灵魂环条目_V1(魂灵数据 = {}) {
  return 取对象槽位条目_V1(魂灵数据, 是魂环槽位键_V1);
}

function 取魂环魂技条目_V1(魂环数据 = {}) {
  return 取对象槽位条目_V1(魂环数据, 是魂技槽位键_V1);
}

function 读取武魂下一个魂灵槽位_V1(武魂数据 = {}) {
  let 序号 = 1;
  while (武魂数据 && Object.prototype.hasOwnProperty.call(武魂数据, `第${序号}魂灵`)) 序号 += 1;
  return `第${序号}魂灵`;
}

function 构建直挂魂环承载魂灵_V1(武魂数据 = {}) {
  const 武魂名 = String(武魂数据?.表象名称 || '').trim();
  return {
    表象名称: AI_TODO_SOUL_SPIRIT_NAME,
    描述: buildSoulSpiritDescriptionTodoText({
      表象名称: AI_TODO_SOUL_SPIRIT_NAME,
      描述: 武魂名 ? `承载${武魂名}魂环的魂灵，具体物种与能力待补全。` : AI_TODO_SOUL_SPIRIT_DESC,
      品质: AI_TODO_SOUL_SPIRIT_QUALITY,
      状态: '活跃',
    }),
    年限: 自动生成魂灵最低年限_V1,
    品质: AI_TODO_SOUL_SPIRIT_QUALITY,
    契合度: 60,
    状态: '活跃',
  };
}

function 归入武魂直挂魂环到魂灵_V1(武魂数据 = {}) {
  if (!武魂数据 || typeof 武魂数据 !== 'object' || Array.isArray(武魂数据)) return 武魂数据;
  const 直挂魂环条目 = 取武魂直接魂环条目_V1(武魂数据);
  if (!直挂魂环条目.length) return 武魂数据;
  const 魂灵键 = 取武魂魂灵条目_V1(武魂数据)[0]?.[0] || 读取武魂下一个魂灵槽位_V1(武魂数据);
  if (!武魂数据[魂灵键] || typeof 武魂数据[魂灵键] !== 'object' || Array.isArray(武魂数据[魂灵键])) {
    武魂数据[魂灵键] = 构建直挂魂环承载魂灵_V1(武魂数据);
  }
  直挂魂环条目.forEach(([魂环键, 魂环数据]) => {
    if (!武魂数据[魂灵键][魂环键]) 武魂数据[魂灵键][魂环键] = 魂环数据;
    delete 武魂数据[魂环键];
  });
  return 武魂数据;
}

function 取血脉气血魂环条目_V1(血脉数据 = {}) {
  return 取对象槽位条目_V1(血脉数据, 是气血魂环槽位键_V1);
}

function 取气血魂环魂技条目_V1(魂环数据 = {}) {
  return 取对象槽位条目_V1(魂环数据, 是血脉魂技槽位键_V1);
}

function 取武魂全部魂环条目_V1(武魂数据 = {}) {
  const 结果 = [];
  取武魂魂灵条目_V1(武魂数据).forEach(([魂灵键, 魂灵数据]) => {
    取魂灵魂环条目_V1(魂灵数据).forEach(([魂环键, 魂环数据]) => {
      结果.push({ 魂环键, 魂环数据, 魂灵键, 魂灵数据, 独立: false });
    });
  });
  取武魂直接魂环条目_V1(武魂数据).forEach(([魂环键, 魂环数据]) => {
    结果.push({ 魂环键, 魂环数据, 魂灵键: '', 魂灵数据: null, 独立: true });
  });
  return 结果;
}

function 创建默认魂环数据_V1(魂环位 = 1, 年限 = 0, 来源 = '') {
  const 安全年限 = Math.max(自动生成魂灵最低年限_V1, Math.floor(Number(年限 || 自动生成魂灵最低年限_V1)));
  const 魂环 = { 年限: 安全年限, 颜色: getRingColorByAge(安全年限) };
  if (String(来源 || '').trim()) 魂环.来源 = String(来源 || '').trim();
  Object.assign(魂环, buildDefaultRingSkillMap(魂环位, 安全年限));
  return 魂环;
}

function 读取角色精神力上限_V1(char = {}) {
  return Math.max(
    0,
    Number(
      char?.属性?.精神力上限 ??
        char?.属性?.men_max ??
        char?.final?.men_max ??
        char?.men_max ??
        0,
    ),
  );
}

function 读取精神力魂灵总年限上限_V1(精神力上限 = 0) {
  const 精神力 = Math.max(0, Number(精神力上限 || 0));
  if (精神力 >= 50000) return 999999;
  if (精神力 >= 20000) return 500000;
  if (精神力 >= 15000) return 200000;
  if (精神力 >= 5000) return 100000;
  if (精神力 >= 500) return 15000;
  if (精神力 >= 50) return 3000;
  return 400;
}

function 读取角色魂灵年限总和_V1(char = {}) {
  let 总和 = 0;
  取角色武魂条目_V1(char).forEach(([, 武魂]) => {
    取武魂魂灵条目_V1(武魂).forEach(([, 魂灵]) => {
      总和 += Math.max(0, Math.floor(Number(魂灵?.年限 || 0)));
    });
  });
  return 总和;
}

function 读取角色剩余魂灵年限预算_V1(char = {}) {
  return Math.max(0, 读取精神力魂灵总年限上限_V1(读取角色精神力上限_V1(char)) - 读取角色魂灵年限总和_V1(char));
}

function getBeastStats(age, species) {
  let lv = 1;
  if (age >= 100000) {
    lv = 90 + Math.floor((age - 100000) / 100000);
  } else if (age >= 10000) {
    lv = 50 + Math.floor((age - 10000) / 2250);
  } else if (age >= 1000) {
    lv = 30 + Math.floor((age - 1000) / 450);
  } else if (age >= 100) {
    lv = 10 + Math.floor((age - 100) / 45);
  } else {
    lv = Math.max(1, Math.floor(age / 10));
  }

  const speciesType = resolveSoulSpiritSpeciesCategory(species);
  const qualityKey = normalizeSoulSpiritQuality(species?.品质 || '') || normalizeSoulSpiritQuality(arguments[2] || '');
  const qualityMult = SOUL_SPIRIT_QUALITY_MULTIPLIER_MAP[qualityKey] || 1.0;
  const qualityLevelOffset = SOUL_SPIRIT_QUALITY_LEVEL_OFFSET_MAP[qualityKey] || 0;
  lv = Math.max(1, lv + qualityLevelOffset);

  const base = getBaseStats(lv);

  const speciesMult = {
    龙类: { str: 1.5, vit_max: 1.5, def: 1.3, agi: 0.9 },
    蛛类: { agi: 1.6, str: 0.8, def: 0.8 },
    熊类: { str: 1.8, def: 1.5, agi: 0.6 },
    植物系: { vit_max: 2.0, str: 0.7, def: 0.8 },
    海魂兽: { sp_max: 1.3, men_max: 1.2, agi: 1.1 },
    鸟类: { agi: 1.8, str: 0.7, vit_max: 0.8 },
    猫科: { agi: 1.5, str: 1.2, def: 0.9 },
    蛇类: { agi: 1.4, str: 1.0, def: 0.9, men_max: 1.1 },
  }[speciesType] || { str: 1.0, def: 1.0, agi: 1.0, vit_max: 1.0, men_max: 1.0, sp_max: 1.0 };

  return {
    年限: age,
    对标等级: lv,
    str: Math.floor(base.str * (speciesMult.str || 1.0) * qualityMult),
    def: Math.floor(base.def * (speciesMult.def || 1.0) * qualityMult),
    agi: Math.floor(base.agi * (speciesMult.agi || 1.0) * qualityMult),
    vit_max: Math.floor(base.vit_max * (speciesMult.vit_max || 1.0) * qualityMult),
    men_max: Math.floor(base.men_max * (speciesMult.men_max || 1.0) * qualityMult),
    sp_max: Math.floor(base.sp_max * (speciesMult.sp_max || 1.0) * qualityMult),
  };
}

function isSoulBeastCharacter(char = {}) {
  return !!(Number(char?.属性?.年龄 || 0) >= 10000 || char?.社交?.势力?.['魂兽一族']);
}

function formatCultivationLevelText(level, fallback = '未知') {
  const numericLevel = Number(level);
  if (Number.isFinite(numericLevel)) {
    if (Math.abs(numericLevel - 99.5) < 0.001) return '准神';
    return String(numericLevel);
  }
  const text = String(level ?? '').trim();
  return text || fallback;
}

function getNextCultivationLevelStep(currentLevel = 0) {
  const safeLevel = Math.max(0, Number(currentLevel) || 0);
  if (safeLevel >= 100) return Math.floor(safeLevel) + 1;
  if (safeLevel >= 99.5) return 100;
  if (safeLevel >= 99) return 99.5;
  return Math.floor(safeLevel) + 1;
}

function 计算等级提升结果_V1(currentLevel = 0, effect = {}, character = null) {
  const 当前等级 = Number(currentLevel);
  const 等级上限 = Math.max(1, Math.min(120, Math.floor(Number(effect?.等级上限 ?? 120) || 120)));
  if (!Number.isFinite(当前等级) || 当前等级 < 0) return { success: false, reason: 'LEVEL_INVALID' };
  if (当前等级 >= 等级上限) return { success: false, reason: 'LEVEL_CAP_REACHED', currentLevel: 当前等级, levelCap: 等级上限 };
  const 目标等级 = getNextCultivationLevelStep(当前等级);
  if (!(目标等级 > 当前等级) || 目标等级 > 等级上限) {
    return { success: false, reason: 'NEXT_LEVEL_EXCEEDS_CAP', currentLevel: 当前等级, targetLevel: 目标等级, levelCap: 等级上限 };
  }
  const 目标魂力上限 = character && typeof character === 'object' && character.属性 && typeof character.属性 === 'object'
    ? getCharacterBaseSoulPowerRequirementAtLevel(character, 目标等级)
    : Math.floor(计算魂力曲线值_V1(目标等级));
  return {
    success: true,
    currentLevel: 当前等级,
    targetLevel: 目标等级,
    levelCap: 等级上限,
    soulPowerCap: Math.max(0, Math.floor(目标魂力上限)),
  };
}

function 应用等级提升_V1(characterOrAttributes = {}, effect = {}) {
  if (!characterOrAttributes || typeof characterOrAttributes !== 'object' || Array.isArray(characterOrAttributes)) return { success: false, reason: 'ATTRIBUTES_INVALID' };
  const character = characterOrAttributes.属性 && typeof characterOrAttributes.属性 === 'object' && !Array.isArray(characterOrAttributes.属性)
    ? characterOrAttributes
    : null;
  const attributes = character ? character.属性 : characterOrAttributes;
  const result = 计算等级提升结果_V1(attributes.等级, effect, character);
  if (!result.success) return result;
  attributes.等级 = result.targetLevel;
  const currentSoulPowerCap = Math.max(0, Math.floor(Number(attributes.魂力上限) || 0));
  attributes.魂力上限 = Math.max(currentSoulPowerCap, result.soulPowerCap);
  result.soulPowerCap = attributes.魂力上限;
  return result;
}

function 计算群体撤离成功率_V1(effect = {}, participantCount = 1) {
  const count = Math.max(1, Math.floor(Number(participantCount) || 1));
  const base = Math.max(0, Math.min(1, Number(effect?.基础成功率 ?? 1)));
  const multiplier = Math.max(0, Number(effect?.每增加一人成功率倍率 ?? 0.9));
  return Math.max(0, Math.min(1, base * Math.pow(multiplier, count - 1)));
}

function 解析绝对资源消耗_V1(costText = '') {
  const result = { 魂力: 0, 精神力: 0, 体力: 0 };
  String(costText || '').split(/\s*\|\s*/).forEach(entry => {
    const match = /^(魂力|精神力|体力):([1-9]\d*)$/.exec(String(entry || '').trim());
    if (match) result[match[1]] = Number(match[2]);
  });
  return result;
}

function 结算群体撤离_V1(statData = {}, userKey = '', participantKeys = [], effect = {}, randomFn = Math.random) {
  const roleTable = statData?.char && typeof statData.char === 'object' ? statData.char : {};
  const keys = [...new Set((Array.isArray(participantKeys) ? participantKeys : []).map(value => String(value || '').trim()).filter(Boolean))];
  if (!keys.length || !keys.includes(String(userKey || '').trim())) throw new Error('GROUP_ESCAPE_USER_NOT_INCLUDED');
  const user = roleTable[userKey];
  if (!user || typeof user !== 'object') throw new Error('GROUP_ESCAPE_USER_MISSING');
  const userLocation = String(user?.状态?.位置 || '').trim();
  if (!userLocation) throw new Error('GROUP_ESCAPE_LOCATION_MISSING');
  const participants = keys.map(key => roleTable[key]).map((role, index) => {
    if (!role || typeof role !== 'object' || role?.状态?.存活 === false || role?.存活 === false) throw new Error(`GROUP_ESCAPE_PARTICIPANT_INVALID:${keys[index]}`);
    if (String(role?.状态?.位置 || '').trim() !== userLocation) throw new Error(`GROUP_ESCAPE_PARTICIPANT_LOCATION_INVALID:${keys[index]}`);
    return role;
  });
  const userAttributes = user.属性 && typeof user.属性 === 'object' ? user.属性 : null;
  if (!userAttributes) throw new Error('GROUP_ESCAPE_USER_ATTRIBUTES_MISSING');
  const cost = 解析绝对资源消耗_V1(effect?.消耗);
  if (Number(userAttributes.魂力 || 0) < cost.魂力 || Number(userAttributes.精神力 || 0) < cost.精神力 || Number(userAttributes.体力 || 0) < cost.体力) {
    return { started: false, success: false, reason: 'RESOURCE_INSUFFICIENT', cost, participantCount: keys.length };
  }
  const probability = 计算群体撤离成功率_V1(effect, keys.length);
  const roll = Math.max(0, Math.min(1, Number((typeof randomFn === 'function' ? randomFn : Math.random)()) || 0));
  const success = roll < probability;
  if (effect?.失败仍消耗资源 !== false || success) {
    userAttributes.魂力 = Math.max(0, Number(userAttributes.魂力 || 0) - cost.魂力);
    userAttributes.精神力 = Math.max(0, Number(userAttributes.精神力 || 0) - cost.精神力);
    userAttributes.体力 = Math.max(0, Number(userAttributes.体力 || 0) - cost.体力);
  }
  if (success) participants.forEach(role => {
    role.状态 ||= {};
    role.状态.位置 = String(effect?.目的地 || '亡灵半位面').trim() || '亡灵半位面';
  });
  return { started: true, success, probability, roll, cost, participantCount: keys.length, destination: String(effect?.目的地 || '亡灵半位面').trim() || '亡灵半位面' };
}

function 读取正式物品消费规则_V1(value = {}) {
  const itemDefinition = value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  if (itemDefinition && Object.prototype.hasOwnProperty.call(itemDefinition, '使用后消耗')) {
    if (typeof itemDefinition.使用后消耗 !== 'boolean') throw new Error('使用后消耗必须是布尔值');
    let effectCount = 0;
    const countEffects = current => {
      if (!current || typeof current !== 'object') return;
      if (Array.isArray(current)) {
        current.forEach(countEffects);
        return;
      }
      if (Object.prototype.hasOwnProperty.call(current, '原型')) effectCount += 1;
      Object.values(current).forEach(countEffects);
    };
    countEffects(itemDefinition.使用效果 ?? itemDefinition._效果数组 ?? []);
    return { consume: itemDefinition.使用后消耗, explicit: true, effectCount };
  }
  let effectCount = 0;
  let allExplicitlyReusable = true;
  const visited = new WeakSet();
  const visit = current => {
    if (!current || typeof current !== 'object') return;
    if (visited.has(current)) return;
    visited.add(current);
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (Object.prototype.hasOwnProperty.call(current, '原型')) {
      effectCount += 1;
      if (current.消耗道具 !== false) allExplicitlyReusable = false;
    }
    Object.values(current).forEach(visit);
  };
  visit(value);
  return {
    consume: effectCount === 0 || !allExplicitlyReusable,
    explicit: effectCount > 0,
    effectCount,
  };
}

function 读取状态效果表_V1(unit = {}) {
  const direct = unit?.状态效果 && typeof unit.状态效果 === 'object' && !Array.isArray(unit.状态效果) ? unit.状态效果 : null;
  const attribute = unit?.属性?.状态效果 && typeof unit.属性.状态效果 === 'object' && !Array.isArray(unit.属性.状态效果) ? unit.属性.状态效果 : null;
  const sustain = unit?.持续效果 && typeof unit.持续效果 === 'object' && !Array.isArray(unit.持续效果) ? unit.持续效果 : null;
  return [direct, attribute, sustain].filter(Boolean);
}

function 读取坚挺金苍蝇成功授予_V1(unit = {}) {
  for (const states of 读取状态效果表_V1(unit)) {
    for (const [stateKey, state] of Object.entries(states)) {
      if (!state || typeof state !== 'object') continue;
      const trigger = String(state.授予触发条件 || state.触发条件 || '').trim();
      if (trigger !== '下次魂技成功释放' || !Array.isArray(state.授予效果) || !state.授予效果.length) continue;
      const uses = Math.max(0, Math.floor(Number(state.可用次数 ?? 1) || 0));
      if (uses > 0) return { states, stateKey, state, uses };
    }
  }
  return null;
}

function 缩放技能效果数组_V1(effects = [], multiplier = 1) {
  const scale = Number(multiplier);
  if (!Number.isFinite(scale) || scale <= 0) return Array.isArray(effects) ? effects.map(effect => JSON.parse(JSON.stringify(effect))) : [];
  const scaleValue = value => {
    if (typeof value === 'number' && Number.isFinite(value)) return Number((value * scale).toFixed(4));
    if (typeof value !== 'string') return value;
    const text = value.trim();
    const percent = /^([+-]?)(\d+(?:\.\d+)?)%$/.exec(text);
    if (percent) return `${percent[1] === '-' ? '-' : '+'}${Number((Number(percent[2]) * scale).toFixed(4))}%`;
    const numeric = Number(text);
    return Number.isFinite(numeric) && text !== '' ? Number((numeric * scale).toFixed(4)) : value;
  };
  const visit = effect => {
    if (!effect || typeof effect !== 'object' || Array.isArray(effect)) return effect;
    const next = JSON.parse(JSON.stringify(effect));
    ['数值', '副数值', '威力倍率'].forEach(key => {
      if (next[key] !== undefined) next[key] = scaleValue(next[key]);
    });
    ['使用效果', '授予效果', '结算效果', '替换效果', '追加效果'].forEach(key => {
      if (Array.isArray(next[key])) next[key] = next[key].map(visit);
    });
    if (Array.isArray(next.条件分支)) next.条件分支 = next.条件分支.map(branch => ({
      ...branch,
      ...(Array.isArray(branch?.替换效果) ? { 替换效果: branch.替换效果.map(visit) } : {}),
      ...(Array.isArray(branch?.追加效果) ? { 追加效果: branch.追加效果.map(visit) } : {}),
    }));
    return next;
  };
  return (Array.isArray(effects) ? effects : []).map(visit);
}

function 读取坚挺金苍蝇自用倍率_V1(unit = {}) {
  for (const states of 读取状态效果表_V1(unit)) {
    for (const state of Object.values(states)) {
      if (!state || typeof state !== 'object') continue;
      const isActiveMaintenance = state.维持态 === true
        && Boolean(String(state.维持消耗 || '').trim())
        && (state.effect_type === 'c2_food_maintain' || state.来源技能 === '坚挺金苍蝇' || state.状态 === '坚挺金苍蝇·武魂真身维持');
      if (isActiveMaintenance) {
        const production = Math.max(1, Number(state.制造速度倍率 || 1.3) || 1.3);
        const effect = Math.max(1, Number(state.产物效果倍率 || 1.3) || 1.3);
        return { 制造速度倍率: production, 产物效果倍率: effect };
      }
    }
  }
  return { 制造速度倍率: 1, 产物效果倍率: 1 };
}

function 消费坚挺金苍蝇成功魂技_V1(unit = {}, actionKind = '', success = false) {
  if (String(actionKind || '').trim().toUpperCase() !== 'RELEASE_SKILL' || success !== true) return { consumed: false, multiplier: 1 };
  let consumed = false;
  let stateKey = '';
  let effects = [];
  const visited = new Set();
  for (const states of 读取状态效果表_V1(unit)) {
    if (!states || visited.has(states)) continue;
    visited.add(states);
    for (const [key, state] of Object.entries(states)) {
      if (!state || typeof state !== 'object') continue;
      const trigger = String(state.授予触发条件 || state.触发条件 || '').trim();
      const uses = Math.max(0, Math.floor(Number(state.可用次数 ?? 1) || 0));
      if (trigger !== '下次魂技成功释放' || !Array.isArray(state.授予效果) || uses <= 0) continue;
      if (!consumed) {
        stateKey = key;
        effects = JSON.parse(JSON.stringify(state.授予效果));
      }
      consumed = true;
      if (uses > 1) state.可用次数 = uses - 1;
      else delete states[key];
    }
  }
  return consumed ? { consumed: true, multiplier: 1.5, stateKey, effects } : { consumed: false, multiplier: 1 };
}

function 计算魂骨年限提升_V1(oldAge = 0, ratio = 0.1, cap = 10000) {
  const oldValue = Math.max(0, Math.floor(Number(oldAge) || 0));
  const limit = Math.min(10000, Math.max(1, Math.floor(Number(cap) || 10000)));
  return Math.min(limit, Math.max(oldValue + 1, Math.floor(oldValue * (1 + Math.max(0, Number(ratio) || 0)))));
}

function isSoulRingGateLevel(level) {
  const numericLevel = Number(level);
  if (!Number.isFinite(numericLevel) || numericLevel >= 100) return false;
  if (Math.abs(numericLevel - Math.round(numericLevel)) > 0.001) return false;
  return Math.round(numericLevel) % 10 === 0;
}

function formatBreakthroughLevelText(level) {
  const numericLevel = Number(level);
  const text = formatCultivationLevelText(level, '未知');
  return Number.isFinite(numericLevel) && Math.abs(numericLevel - 99.5) < 0.001 ? text : `${text}级`;
}

function 是否同地图节点组(数据, 左角色, 右角色) {
  if (!左角色 || !右角色) return false;
  const 左位置 = 左角色.状态?.位置 || '';
  const 右位置 = 右角色.状态?.位置 || '';
  if (左位置 && 右位置 && 左位置 === 右位置) return true;
  const 动态地点 = 数据?.world?.动态地点 || {};
  const 左父节点 = 动态地点[左位置]?.归属父节点 || 左位置.split('-').slice(0, -1).join('-');
  const 右父节点 = 动态地点[右位置]?.归属父节点 || 右位置.split('-').slice(0, -1).join('-');
  return !!(左父节点 && 右父节点 && 左父节点 === 右父节点);
}

var 本轮等级上升角色记录_V1 = new WeakMap();
var 本轮等级上升角色名记录_V1 = new Map();
var 本轮原始角色等级记录_V1 = new Map();
var 本轮轻量非魂师角色名记录_V1 = new Map();
var 当前归一化批次_V1 = 0;

function 开始MVU归一化批次_V1() {
  当前归一化批次_V1 = (当前归一化批次_V1 + 1) % Number.MAX_SAFE_INTEGER || 1;
}

function 读取本轮角色记录键_V1(角色名 = '') {
  const 名称 = String(角色名 || '').trim();
  return 名称 ? `${当前归一化批次_V1}:${名称}` : '';
}

function 记录本轮原始角色等级_V1(角色名 = '', 等级 = 0) {
  const 记录键 = 读取本轮角色记录键_V1(角色名);
  if (记录键) 本轮原始角色等级记录_V1.set(记录键, Math.max(0, Number(等级 || 0) || 0));
}

function 读取本轮原始角色等级_V1(角色名 = '') {
  const 记录键 = 读取本轮角色记录键_V1(角色名);
  return 记录键 && 本轮原始角色等级记录_V1.has(记录键) ? 本轮原始角色等级记录_V1.get(记录键) : null;
}

function 记录本轮轻量非魂师角色_V1(角色名 = '') {
  const 记录键 = 读取本轮角色记录键_V1(角色名);
  if (记录键) 本轮轻量非魂师角色名记录_V1.set(记录键, true);
}

function 判断本轮轻量非魂师角色_V1(角色名 = '') {
  const 记录键 = 读取本轮角色记录键_V1(角色名);
  return !!(记录键 && 本轮轻量非魂师角色名记录_V1.get(记录键) === true);
}

function 标记本轮等级上升角色_V1(角色 = null, 角色名 = '') {
  if (角色 && typeof 角色 === 'object') 本轮等级上升角色记录_V1.set(角色, 当前归一化批次_V1);
  const 记录键 = 读取本轮角色记录键_V1(角色名);
  if (记录键) 本轮等级上升角色名记录_V1.set(记录键, true);
}

function 判断本轮等级上升角色_V1(角色 = null, 角色名 = '') {
  const 记录键 = 读取本轮角色记录键_V1(角色名);
  return !!(
    (角色 && typeof 角色 === 'object' && 本轮等级上升角色记录_V1.get(角色) === 当前归一化批次_V1) ||
    (记录键 && 本轮等级上升角色名记录_V1.get(记录键) === true)
  );
}

function autoBreakthrough(data) {
  _(data.char).forEach((c, charName) => {
    if (!c.状态?.存活) return;
    const isBeast = isSoulBeastCharacter(c);
    if (isBeast) return;
    const pendingRingState = String(c.状态?.待选魂环?.状态 || '').trim();
    if (pendingRingState && !['已处理', 'handled', '无'].includes(pendingRingState)) return;
    const currentTick = Number(data?.world?.时间?.tick || 0);
    const cultivationRuntime = 读取时代修炼运行时_V1();

    while (true) {
      const currentLv = Math.max(0, Number(c.属性?.等级 || 0));
      const finalCap = cultivationRuntime && typeof cultivationRuntime.finalLevelCap === 'function'
        ? Number(cultivationRuntime.finalLevelCap(c, { currentTick }))
        : 100;
      if (currentLv >= finalCap) return;
      const nextLevelStep = getNextCultivationLevelStep(currentLv);
      if (nextLevelStep === null) return;

      const baseSoulPowerForBreakthrough = Math.max(
        0,
        Math.floor(Number(c.属性?.魂力上限 || 0) - getCharacterCurrentRingAndBoneSoulPowerBonus_ACU(c)),
      );
      const nextLevelSoulRequirement = getCharacterBaseSoulPowerRequirementAtLevel(c, nextLevelStep);
      if (baseSoulPowerForBreakthrough < nextLevelSoulRequirement) return;

      const coreCap = cultivationRuntime && typeof cultivationRuntime.getLevelCapForCoreCount === 'function'
        ? Number(cultivationRuntime.getLevelCapForCoreCount(c, { currentTick }))
        : Number.POSITIVE_INFINITY;
      const naturalCap = cultivationRuntime && typeof cultivationRuntime.finalLevelCap === 'function'
        ? Number(cultivationRuntime.finalLevelCap(c, { currentTick }))
        : 100;
      const ringCap = currentLv >= 100 ? Number.POSITIVE_INFINITY : getCharacterSoulRingLevelCap(c);
      const maxLv = Math.min(coreCap, naturalCap, ringCap);
      if (currentLv >= maxLv) return;

      c.属性.等级 = nextLevelStep;
      标记本轮等级上升角色_V1(c, charName);
      const newLv = Number(c.属性.等级 || nextLevelStep);
      const newLvText = formatBreakthroughLevelText(newLv);
      let shouldStopAfterThisBreak = false;
      if (isSoulRingGateLevel(newLv)) {
        const ringIndex = Math.round(newLv / 10);
        const spiritEntries = 取角色武魂条目_V1(c);
        if (spiritEntries.length === 0) return;

        const isPlayer = charName === data.sys?.玩家名;
        const playerChar = data.char[data.sys?.玩家名];
        const isNearPlayer = !isPlayer && 是否同地图节点组(data, c, playerChar);

        for (const [spiritKey, targetSpirit] of spiritEntries) {
          if (!targetSpirit || typeof targetSpirit !== 'object') continue;

          let ringAssigned = false;
          let candidateSpirit = null;

          取武魂魂灵条目_V1(targetSpirit).forEach(([ssName, ss], 魂灵索引) => {
            if (ringAssigned || candidateSpirit) return;

            const cap = 读取突破魂灵承载上限_V1(ss, spiritKey, 魂灵索引);
            const currentRingsCount = 取魂灵魂环条目_V1(ss).length;
            if (currentRingsCount < cap) {
              candidateSpirit = { ss, ssName };
            }
          });

          if (candidateSpirit) {
            const { ss, ssName } = candidateSpirit;
            if (isPlayer) {
              if (!c.状态) c.状态 = {};
              c.状态.待选魂环 = {
                武魂槽位: spiritKey,
                候选魂灵: [ssName],
                待生成魂环位: ringIndex,
                状态: '待选择',
                来源: '修为突破',
              };
              ringAssigned = true;
              shouldStopAfterThisBreak = true;
              if (data.sys.系统播报 === '初始化' || !data.sys.系统播报) data.sys.系统播报 = '';
              data.sys.系统播报 += ` [修为突破] ${charName} 踏入 ${newLvText}！已达到第 ${ringIndex} 魂环门槛，当前魂灵【${ssName}】可继续衍生魂环，请决定是否立即生成。`;
            } else if (isNearPlayer && data.sys?.系统播报 !== '初始化') {
              ringAssigned = true;
              shouldStopAfterThisBreak = true;
              if (data.sys.系统播报 === '初始化' || !data.sys.系统播报) data.sys.系统播报 = '';
              data.sys.系统播报 += ` [修为突破] ${charName} 踏入 ${newLvText}！已达到第 ${ringIndex} 魂环门槛，但当前场景内请通过剧情决定其【${ssName}】是否为【${spiritKey}】衍生新魂环。`;
            } else {
              const newRingColor = getRingColorByAge(ss.年限);
              const ringKey = `第${ringIndex}魂环`;
              ss[ringKey] = 创建默认魂环数据_V1(ringIndex, ss.年限);
              ss[ringKey].颜色 = newRingColor;
              const 武魂属性状态 = normalizeSpiritAttributeState(targetSpirit, spiritKey, c);
              const 武魂元素画像 = buildElementProfileFromAttributeState(武魂属性状态);
              const 武魂系别 = String(targetSpirit?.系别 || 取角色主武魂系别_V1(c)).trim() || '强攻系';
              ensureSkillMapGenerated(Object.fromEntries(取魂环魂技条目_V1(ss[ringKey])), (_, skillName) => ({
                type: 武魂系别,
                武魂系别,
                角色: c,
                武魂数据: targetSpirit,
                魂环数据: ss[ringKey],
                path: `char.${charName}.${spiritKey}.${ssName}.${ringKey}.${skillName}`,
                talentTier: c.属性?.天赋梯队 || '正常',
                age: ss.年限,
                ringAge: ss.年限,
                ringIndex,
                当前魂环数量: Math.max(1, 计算武魂当前魂环数量_V1(targetSpirit)),
                martialSoulName: String(targetSpirit?.表象名称 || spiritKey || '').trim(),
                compatibility: ss.契合度 || 100,
                sourceQuality: normalizeSoulSpiritQuality(ss?.品质 || '') || inferSoulSpiritQuality(ss) || '',
                preferredSecondary: [],
                elementProfile: 武魂元素画像,
                可调用元素: 武魂属性状态.可调用元素,
                callableElements: 武魂属性状态.可调用元素,
                elementTrigger: '继承武魂',
                sourceCategory: '魂技',
                forceTrueBody: ringIndex === 7,
                允许自动生成技能结构: true,
                textContext: {
                  spiritName:
                    !isAiTodoText(ss.表象名称) && ss.表象名称 !== '未展露'
                      ? ss.表象名称
                      : targetSpirit?.表象名称 || skillName,
                  type: 武魂系别,
                  spiritDesc: String(ss?.描述 || '').trim(),
                  martialSoulName: String(targetSpirit?.表象名称 || spiritKey || '').trim(),
                  soulSpiritName: String(ss?.表象名称 || '').trim(),
                  ringSource: String(ss[ringKey]?.来源 || '').trim(),
                },
              }));
              ringAssigned = true;
              if (data.sys.系统播报 === '初始化' || !data.sys.系统播报) data.sys.系统播报 = '';
              data.sys.系统播报 += ` [修为突破] ${charName} 踏入 ${newLvText}！其【${ssName}】底蕴深厚，自动为【${spiritKey}】衍生出第 ${ringIndex} 个魂环！`;
            }
          }

          if (!ringAssigned) {
            let currentSpiritsCount = 0;
            取角色武魂条目_V1(c).forEach(([, sp]) => {
              currentSpiritsCount += 取武魂魂灵条目_V1(sp).length;
            });
            const 剩余魂灵年限预算 = 读取角色剩余魂灵年限预算_V1(c);

            if (data.sys.系统播报 === '初始化' || !data.sys.系统播报) data.sys.系统播报 = '';
            if (剩余魂灵年限预算 < 自动生成魂灵最低年限_V1) {
              data.sys.系统播报 += ` [修为突破] ${charName} 踏入 ${newLvText}！但精神力仅为【${c.属性.精神境界}】，无法承载更多魂灵，【${spiritKey}】暂缓附加魂环！`;
            } else if (isPlayer) {
              data.sys.系统播报 += ` [修为突破] ${charName} 踏入 ${newLvText}！达到魂环门槛，但当前未有可继续产环的魂灵，需通过剧情吸收新魂灵后方可附环。`;
            } else if (isNearPlayer) {
              data.sys.系统播报 += ` [修为突破] ${charName} 踏入 ${newLvText}！达到魂环门槛，但当前场景内禁止后台立即生成新魂灵，请通过剧情处理。`;
            }
            shouldStopAfterThisBreak = true;
          }

          if (ringAssigned || shouldStopAfterThisBreak) break;
        }
      } else {
        if (data.sys.系统播报 === '初始化' || !data.sys.系统播报) data.sys.系统播报 = '';
        data.sys.系统播报 += ` [修为突破] ${charName} 踏入 ${newLvText}！`;
      }

      if (shouldStopAfterThisBreak) return;
    }
  });
}

function 获取角色魂力获取速度系数_ACU(char = {}) {
  let 获取速度列表 = [];
  const spiritEntries = 取角色武魂条目_V1(char);
  if (spiritEntries.length > 0) {
    spiritEntries.forEach(([, spiritData]) => {
      const 系别 = String(spiritData?.系别 || '').trim();
      if (系别) 获取速度列表.push(Number(魂力获取速度系数表[系别] ?? 0.7));
    });
  }
  if (获取速度列表.length) return Math.max(0.1, Math.max(...获取速度列表));
  return 1;
}

function getCharacterBaseSoulPowerRequirementAtLevel(char = {}, level = 1) {
  const safeLevel = Math.max(1, Number(level) || 1);
  const dualSpiritSoulCoeff = getDualSpiritSoulPowerCoeff(char);
  const hiddenVar = Math.max(0.1, Number(char?.属性?.底子波动 || 1));
  const cultivationRuntime = 读取时代修炼运行时_V1();
  if (cultivationRuntime && typeof cultivationRuntime.soulPowerRequirement === 'function') {
    const runtimeRequirement = Number(cultivationRuntime.soulPowerRequirement(safeLevel, hiddenVar));
    if (Number.isFinite(runtimeRequirement)) return Math.floor(runtimeRequirement * dualSpiritSoulCoeff);
  }
  return Math.floor(getBaseStats(safeLevel).sp_max * dualSpiritSoulCoeff * hiddenVar);
}

function getCharacterCurrentRingAndBoneSoulPowerBonus_ACU(char = {}) {
  let boneBonus = 0;
  _(char?.魂骨 || {}).forEach((bone, part) => {
    if (是外附魂骨记录_V1(bone, part)) return;
    if (Number(bone?.年限 || 0) <= 0) return;
    const ringBonus = getRingBonus(Number(bone.年限 || 0));
    if (part === '躯干魂骨') boneBonus += ringBonus.sp_max * 2;
    else boneBonus += ringBonus.sp_max;
  });

  let ringBonusTotal = 0;
  取角色武魂条目_V1(char).forEach(([, spiritData]) => {
    取武魂全部魂环条目_V1(spiritData).forEach(({ 魂环数据: ring, 魂灵数据: ss }) => {
      const compMult = ss ? Math.max(0.1, (ss?.契合度 !== undefined ? ss.契合度 : 100) / 100) : 1;
      if (Number(ring?.年限 || 0) > 0) {
        ringBonusTotal += Math.floor(getRingBonus(Number(ring.年限 || 0)).sp_max * compMult);
      }
    });
  });
  return Math.max(0, Math.floor(ringBonusTotal + boneBonus));
}

function getCharacterActualSoulRingCount(char = {}) {
  let total = 0;
  取角色武魂条目_V1(char).forEach(([, spiritData]) => {
    取武魂全部魂环条目_V1(spiritData).forEach(({ 魂环数据: ringData }) => {
      if (!ringData || typeof ringData !== 'object') return;
      const hasAge = Number(ringData?.年限 || 0) > 0;
      const hasSkill = 取魂环魂技条目_V1(ringData).length > 0;
      if (hasAge || hasSkill) total += 1;
    });
  });
  return Math.max(0, total);
}

function 计算武魂当前魂环数量_V1(spiritData = {}) {
  return Math.max(0, 取武魂全部魂环条目_V1(spiritData).length);
}

function 角色存在七字武魂_V1(char = {}) {
  return 取角色武魂条目_V1(char).some(([武魂键, 武魂数据]) => {
    const 名称 = String(武魂数据?.表象名称 || 武魂键 || '').trim();
    return 名称.includes('七');
  });
}

function getCharacterSoulRingLevelCap(char = {}) {
  const ringCount = getCharacterActualSoulRingCount(char);
  return Math.min(100, Math.max(10, (ringCount + 1) * 10));
}

function 同步临时突破魂核_V1(char = {}, 目标等级 = 1, options = {}) {
  if (!char || typeof char !== 'object') return;
  const 安全目标等级 = Math.max(1, Number(目标等级) || 1);
  if (!char.魂核 || typeof char.魂核 !== 'object') char.魂核 = {};
  if (!char.魂核.核心 || typeof char.魂核.核心 !== 'object') char.魂核.核心 = { 数量: 0, 进度: 0 };
  const 当前数量 = Math.max(0, Math.floor(Number(char.魂核.核心.数量 || 0)));
  const cultivationRuntime = 读取时代修炼运行时_V1();
  const currentTick = Number(options?.currentTick ?? 0);
  const 目标数量 = cultivationRuntime && typeof cultivationRuntime.requiredCoreCountForLevel === 'function'
    ? Math.max(当前数量, Number(cultivationRuntime.requiredCoreCountForLevel(cultivationRuntime.resolveEra(char, { currentTick }), 安全目标等级)))
    : 当前数量;
  if (目标数量 > 当前数量) {
    char.魂核.核心.数量 = 目标数量;
    char.魂核.核心.进度 = 0;
  }
}

function 处理临时突破请求_V1(数据根 = {}) {
  if (!数据根 || typeof 数据根 !== 'object') return false;
  let 有处理 = false;
  Object.entries(数据根.char || {}).forEach(([角色名, 角色数据]) => {
    if (!角色数据 || typeof 角色数据 !== 'object') return;
    const 原始值 = 角色数据.临时突破;
    const 目标等级 = Number(原始值);
    if (!Number.isFinite(目标等级) || 目标等级 <= 0) {
      delete 角色数据.临时突破;
      return;
    }
    if (!角色数据.属性 || typeof 角色数据.属性 !== 'object') 角色数据.属性 = {};
    const 安全目标等级 = Math.max(1, 目标等级);
    const 当前等级 = Math.max(0, Number(角色数据.属性.等级 || 0));
    if (安全目标等级 > 当前等级) {
      同步临时突破魂核_V1(角色数据, 安全目标等级, { currentTick: Number(数据根?.world?.时间?.tick || 0) });
      const 目标需求 = getCharacterBaseSoulPowerRequirementAtLevel(角色数据, 安全目标等级);
      const 当前魂力上限 = Math.max(0, Number(角色数据.属性.魂力上限 || 0));
      角色数据.属性.魂力上限 = Math.max(当前魂力上限, 目标需求);
      if (数据根.sys) {
        追加系统播报文本(数据根, `[临时突破] ${角色名}获得特殊机缘，修为储备提升至 ${formatBreakthroughLevelText(安全目标等级)} 对应层级。`);
      }
      有处理 = true;
    }
    delete 角色数据.临时突破;
  });
  if (有处理 && 数据根.char) autoBreakthrough(数据根);
  return 有处理;
}

var FactionDistribution = {
  唐门: {
    hq: '史莱克城',
    branches: [
      '天斗城',
      '东海城',
      '明都',
      '天海城',
      '星罗城',
      '灵波城',
      '傲来城',
      '北海城',
      '烈火盆地',
      '上陵城',
      '天定城',
      '海陆城',
    ],
  },
  传灵塔: {
    hq: '史莱克城',
    branches: [
      '天斗城',
      '东海城',
      '明都',
      '天海城',
      '星罗城',
      '灵波城',
      '傲来城',
      '北海城',
      '烈火盆地',
      '上陵城',
      '天定城',
      '海陆城',
    ],
  },

  锻造师协会: {
    hq: '明都',
    branches: [
      '天斗城',
      '东海城',
      '明都',
      '天海城',
      '星罗城',
      '灵波城',
      '傲来城',
      '北海城',
      '烈火盆地',
      '上陵城',
      '天定城',
      '海陆城',
    ],
  },
  机甲师协会: {
    hq: '明都',
    branches: [
      '天斗城',
      '东海城',
      '明都',
      '天海城',
      '星罗城',
      '灵波城',
      '傲来城',
      '北海城',
      '烈火盆地',
      '上陵城',
      '天定城',
      '海陆城',
    ],
  },
  制造师协会: {
    hq: '明都',
    branches: [
      '天斗城',
      '东海城',
      '明都',
      '天海城',
      '星罗城',
      '灵波城',
      '傲来城',
      '北海城',
      '烈火盆地',
      '上陵城',
      '天定城',
      '海陆城',
    ],
  },
  设计师协会: {
    hq: '明都',
    branches: [
      '天斗城',
      '东海城',
      '明都',
      '天海城',
      '星罗城',
      '灵波城',
      '傲来城',
      '北海城',
      '烈火盆地',
      '上陵城',
      '天定城',
      '海陆城',
    ],
  },
  修理师协会: {
    hq: '明都',
    branches: [
      '天斗城',
      '东海城',
      '明都',
      '天海城',
      '星罗城',
      '灵波城',
      '傲来城',
      '北海城',
      '烈火盆地',
      '上陵城',
      '天定城',
      '海陆城',
    ],
  },
  战神殿: {
    hq: '明都',
    branches: [],
  },
  圣灵教: {
    hq: '秘密据点',
    branches: ['天斗城', '灵波城', '极北之地'],
  },

  史莱克学院: {
    hq: '史莱克城',
    branches: [],
  },
  日月皇家魂师学院: {
    hq: '明都',
    branches: [],
  },
  怪物学院: {
    hq: '星罗城',
    branches: [],
  },
  星罗皇家学院: {
    hq: '星罗城',
    branches: [],
  },
  天定星空魂师学院: {
    hq: '天定城',
    branches: [],
  },
  东海学院: {
    hq: '东海城',
    branches: [],
  },
  天海中级学院: {
    hq: '天海城',
    branches: [],
  },
  海陆中级学院: {
    hq: '海陆城',
    branches: [],
  },
  红山学院: {
    hq: '傲来城',
    branches: [],
  },

  斗罗联邦: {
    hq: '明都',
    branches: ['斗罗大陆'],
  },
  星罗帝国: {
    hq: '星罗城',
    branches: ['星罗大陆'],
  },
  斗灵帝国: {
    hq: '天斗城(斗灵帝国)',
    branches: ['灵波城', '斗灵大陆'],
  },
  血神军团: {
    hq: '无尽山脉',
    branches: [],
  },
  本体宗: {
    hq: '天斗城',
    branches: [],
  },
  泰坦巨猿家族: {
    hq: '天斗城',
    branches: [],
  },
  蓝电霸王龙家族: {
    hq: '隐世之地',
    branches: [],
  },
};

function getBaseStats(lv) {
  const 等级值 = Math.max(1, Math.min(180, Number(lv) || 1));
  const 百级后 = 百级基值 => 百级基值 * Math.pow(10, (等级值 - 100) / 10);

  const 魂力上限 = 计算魂力曲线值_V1(等级值);

  let 力量 = 10;
  if (等级值 <= 29) 力量 = 10 + ((900 - 10) / 28) * (等级值 - 1);
  else if (等级值 === 30) 力量 = 1200;
  else if (等级值 <= 69) 力量 = 1300 + ((4200 - 1300) / 38) * (等级值 - 31);
  else if (等级值 === 70) 力量 = 7000;
  else if (等级值 <= 89) 力量 = 7200 + ((8600 - 7200) / 18) * (等级值 - 71);
  else if (等级值 === 90) 力量 = 9000;
  else if (等级值 <= 94) 力量 = 9250 + ((10000 - 9250) / 3) * (等级值 - 91);
  else if (等级值 <= 99.5) 力量 = 10000 * Math.pow(1.5, 等级值 - 94);
  else if (等级值 <= 100) 力量 = 10000 * Math.pow(1.5, 99.5 - 94) * 2;
  else {
    力量 = 百级后(10000 * Math.pow(1.5, 99.5 - 94) * 2);
  }

  let 精神力上限 = 等级值;
  if (等级值 <= 10) 精神力上限 = 8 + ((27 - 8) / 9) * (等级值 - 1);
  else if (等级值 <= 20) 精神力上限 = 27 + ((30 - 27) / 10) * (等级值 - 10);
  else if (等级值 <= 21) 精神力上限 = 32;
  else if (等级值 <= 30) 精神力上限 = 32 + ((160 - 32) / 9) * (等级值 - 21);
  else if (等级值 <= 40) 精神力上限 = 160 + ((800 - 160) / 10) * (等级值 - 30);
  else if (等级值 <= 50) 精神力上限 = 800 + ((850 - 800) / 10) * (等级值 - 40);
  else if (等级值 <= 60) 精神力上限 = 850 + ((900 - 850) / 10) * (等级值 - 50);
  else if (等级值 <= 70) 精神力上限 = 900 + ((950 - 900) / 10) * (等级值 - 60);
  else if (等级值 <= 80) 精神力上限 = 950 + ((1050 - 950) / 10) * (等级值 - 70);
  else if (等级值 <= 90) 精神力上限 = 1050 + ((2300 - 1050) / 10) * (等级值 - 80);
  else if (等级值 < 98) 精神力上限 = 2300 + ((3750 - 2300) / 8) * (等级值 - 90);
  else if (等级值 === 98) 精神力上限 = 3750;
  else if (等级值 === 99) 精神力上限 = 4200;
  else if (等级值 === 99.5) 精神力上限 = 6500;
  else if (等级值 <= 100) 精神力上限 = 15000;
  else {
    精神力上限 = 百级后(15000);
  }

  return {
    sp_max: Math.floor(魂力上限),
    men_max: Math.floor(精神力上限),
    str: Math.floor(力量),
    def: Math.floor(力量),
    agi: Math.floor(力量 / 2),
    vit_max: Math.floor(力量),
  };
}

globalThis.__LWCS_GET_BASE_STATS__ = getBaseStats;
try { if (globalThis.parent && globalThis.parent !== globalThis) globalThis.parent.__LWCS_GET_BASE_STATS__ = getBaseStats; } catch (错误) {}
try { if (globalThis.top && globalThis.top !== globalThis) globalThis.top.__LWCS_GET_BASE_STATS__ = getBaseStats; } catch (错误) {}

function hashBattleSeedValue(seedText = '') {
  const text = String(seedText || '');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createBattleSeedRng(seedText = '') {
  let state = hashBattleSeedValue(seedText) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function withBattleSeedRandom(seedText, runner) {
  const nativeRandom = Math.random;
  const rng = createBattleSeedRng(seedText);
  Math.random = () => rng();
  try {
    return runner(rng);
  } finally {
    Math.random = nativeRandom;
  }
}

function pickBattleSeedItem(items = [], rng = Math.random) {
  if (!Array.isArray(items) || !items.length) return '';
  return items[Math.max(0, Math.min(items.length - 1, Math.floor(rng() * items.length)))] || items[0];
}

function pickBattleSeedInt(min = 0, max = min, rng = Math.random) {
  const low = Math.floor(Math.min(min, max));
  const high = Math.floor(Math.max(min, max));
  if (high <= low) return low;
  return low + Math.floor(rng() * (high - low + 1));
}

function estimateTemporaryHumanSkillCount(level = 1) {
  const safeLevel = Math.max(1, Math.floor(Number(level || 1)));
  if (safeLevel >= 80) return 4;
  if (safeLevel >= 50) return 3;
  if (safeLevel >= 30) return 2;
  return 1;
}

function estimateTemporaryMonsterSkillCount(unitNature = '魂兽', seed = {}) {
  if (unitNature === '魂兽') {
    const age = Math.max(0, Math.floor(Number(seed?.年限 || 0)));
    if (age >= 100000) return 4;
    if (age >= 10000) return 3;
    if (age >= 1000) return 2;
    return 1;
  }
  const tier = String(seed?.级别 || '').trim();
  if (tier === '深渊帝君' || tier === '深渊王者') return 4;
  if (tier === '高阶生物') return 3;
  if (tier === '中阶生物') return 2;
  return 1;
}

function estimateTemporaryHumanSkillAge(level = 1) {
  const safeLevel = Math.max(1, Math.floor(Number(level || 1)));
  if (safeLevel >= 90) return 100000;
  if (safeLevel >= 70) return 50000;
  if (safeLevel >= 50) return 10000;
  if (safeLevel >= 30) return 1000;
  if (safeLevel >= 20) return 300;
  return 100;
}

function buildTemporaryCombatSkillMap(seedText, unitName, combatType, level, skillCount, ageEquivalent, talentTier = '正常') {
  const total = Math.max(0, Math.min(4, Math.floor(Number(skillCount || 0))));
  if (total <= 0) return {};
  const skillMap = {};
  for (let index = 1; index <= total; index += 1) {
    skillMap[`魂技${index}`] = createDefaultRingSkillShell();
  }
  withBattleSeedRandom(`${seedText}|skills|${unitName}|${combatType}|${level}`, () => {
    ensureSkillMapGenerated(skillMap, (_, skillName) => ({
      type: combatType || '强攻系',
      talentTier: talentTier || '正常',
      age: Math.max(100, Number(ageEquivalent || 100)),
      ringIndex: Math.max(1, Number(String(skillName || '').replace(/[^\d]/g, '') || 1)),
      compatibility: 100,
      preferredSecondary: [],
      currentTick: 0,
      允许自动生成技能结构: true,
      textContext: {
        spiritName: unitName || skillName,
        type: combatType || '强攻系',
      },
    }));
  });
  return skillMap;
}

var 魂导器装配槽位列表_V1 = Object.freeze(['一号位', '二号位', '三号位', '四号位', '五号位', '六号位', '七号位', '八号位', '九号位', '十号位']);
function 创建空魂导器装配表_V1() {
  return Object.fromEntries(魂导器装配槽位列表_V1.map(槽位 => [槽位, { 名称: '无' }]));
}

function buildTemporaryCombatEquipmentShell() {
  return {
    武器: { 名称: '无', 品阶: '无', 属性加成: { 魂力上限: 0, 精神力上限: 0, 力量: 0, 防御: 0, 敏捷: 0, 体力上限: 0 } },
    防具: { 名称: '无', 品阶: '无', 装备状态: '未装备', 特性: {}, 属性加成: { 魂力上限: 0, 精神力上限: 0, 力量: 0, 防御: 0, 敏捷: 0, 体力上限: 0 } },
    斗铠: { 等级: 0, 名称: '无', 领域: '无', 材质: '无', 装备状态: '未装备', 部件: {} },
    机甲: { 等级: '无', 名称: '无', 型号: '无', 材质: '无', 状态: '无', 装备状态: '未装备', 武装: '无', 品质系数: 1.0 },
    魂导器: { 装配: 创建空魂导器装配表_V1() },
  };
}

function resolveTemporaryHumanCombatType(identity = '魂师', rng = Math.random, explicitType = '') {
  const requestedType = String(explicitType || '').trim();
  if (requestedType && TypeMultipliers[requestedType]) return requestedType;
  if (identity === '军人') {
    return pickBattleSeedItem(['强攻系', '强攻系', '防御系', '敏攻系', '控制系'], rng) || '强攻系';
  }
  return pickBattleSeedItem(['强攻系', '敏攻系', '防御系', '控制系', '辅助系', '治疗系', '食物系', '召唤系'], rng) || '强攻系';
}

function 取临时斗铠部件列表_V1(性别文本 = '') {
  return [
    '头盔',
    '胸铠',
    '左肩',
    '右肩',
    '左臂',
    '右臂',
    ...(String(性别文本 || '').includes('女') ? ['战裙'] : ['左腿', '右腿']),
    '战靴',
  ];
}

function 填充临时斗铠部件(斗铠, 性别文本 = '') {
  if (!斗铠 || typeof 斗铠 !== 'object') return;
  const 部件名列表 = 取临时斗铠部件列表_V1(性别文本);
  if (!斗铠.部件 || typeof 斗铠.部件 !== 'object') 斗铠.部件 = {};
  部件名列表.forEach(部件名 => {
    if (!斗铠.部件[部件名]) 斗铠.部件[部件名] = { 状态: '完好', 品质系数: 1.0 };
  });
}

function applyTemporaryHumanEquipment(stats, equipment, identity = '魂师', level = 1, rng = Math.random, seed = {}) {
  if (identity === '普通人' || !equipment || typeof equipment !== 'object') return stats;
  const request = seed && typeof seed === 'object' ? seed.装备 || {} : {};
  const mechGrade = String(request?.机甲 || request?.mech || '').trim();
  if (['黄级', '紫级', '黑级', '红级'].includes(mechGrade)) {
    equipment.机甲.等级 = mechGrade;
    equipment.机甲.名称 = `${mechGrade}制式机甲`;
    equipment.机甲.型号 = level >= 70 ? '远程' : '近战';
    equipment.机甲.状态 = '完好';
    equipment.机甲.装备状态 = '未装备';
  }
  const armorLevel = Math.max(0, Math.min(4, Math.floor(Number(request?.斗铠 ?? request?.armor ?? 0))));
  if (armorLevel > 0) {
    equipment.斗铠.等级 = armorLevel;
    equipment.斗铠.名称 = `${armorLevel}字斗铠`;
    equipment.斗铠.装备状态 = '未装备';
    填充临时斗铠部件(equipment.斗铠, String(seed?.性别 ?? seed?.gender ?? seed?.属性?.性别 ?? request?.性别 ?? request?.gender ?? ''));
  }
  return stats;
}

function inferTemporarySoulBeastCombatType(species = '', stats = {}) {
  const text = String(species || '').trim();
  if (/植物|藤|草|花|树/.test(text)) return '控制系';
  if (/海|鱼|鲸|鲨|章|蚌/.test(text)) return '控制系';
  if (/蛛|鸟|鹰|雕|蛇|猫|豹|狼|狐|蝠/.test(text)) return '敏攻系';
  if (/熊|猿|牛|犀|龟|象/.test(text)) return '防御系';
  if (Number(stats?.men_max || 0) > Number(stats?.str || 0) * 1.3) return '控制系';
  if (Number(stats?.agi || 0) > Number(stats?.def || 0) * 1.2) return '敏攻系';
  if (Number(stats?.def || 0) > Number(stats?.agi || 0) * 1.2) return '防御系';
  return '强攻系';
}

function inferTemporaryAbyssCombatType(species = '', stats = {}) {
  const text = String(species || '').trim();
  if (/蝙蝠|魔魅|恶镰/.test(text)) return '敏攻系';
  if (/灵帝|智帝|附体魔|黑皇/.test(text)) return '控制系';
  if (/巴安|天牛|猛犸|魔傀/.test(text)) return '防御系';
  if (Number(stats?.men_max || 0) > Number(stats?.str || 0) * 1.3) return '控制系';
  if (Number(stats?.agi || 0) > Number(stats?.def || 0) * 1.2) return '敏攻系';
  if (Number(stats?.def || 0) > Number(stats?.agi || 0) * 1.2) return '防御系';
  return '强攻系';
}

function buildTemporaryCombatSkeleton(name = '未知单位', unitNature = '人类') {
  return {
    name,
    来源: '临时单位',
    单位性质: unitNature,
    系别: '未知系',
    属性: {
      等级: 0,
      HP: 1,
      HP上限: 1,
      体力: 1,
      体力上限: 1,
      魂力: 0,
      魂力上限: 0,
      精神力: 1,
      精神力上限: 1,
      力量: 1,
      防御: 1,
      敏捷: 1,
      状态效果: {},
    },
    状态: {
      存活: true,
      死亡tick: -1,
      死亡类型: '无',
      当前领域: '无',
    },
    装备: buildTemporaryCombatEquipmentShell(),
    自创魂技: {},
    社交: { 势力: {} },
  };
}

function buildTemporaryHumanCombatant(seed = {}, slotName = 'enemy') {
  const identity = String(seed?.身份 || '普通人').trim();
  const quantity = Math.max(1, Math.floor(Number(seed?.数量 || 1)));
  const level = identity === '普通人' ? 0 : Math.max(1, Math.floor(Number(seed?.等级 || 1)));
  const unitName = String(seed?.名称 || seed?.name || slotName || '临时单位').trim() || '临时单位';
  const battleSeedText = `${unitName}|${identity}|${quantity}|${level}|${slotName}`;
  return withBattleSeedRandom(battleSeedText, rng => {
    const next = buildTemporaryCombatSkeleton(unitName, '人类');
    next.身份 = identity;
    next.数量 = quantity;
    if (identity === '普通人') {
      const hpMax = pickBattleSeedInt(48, 82, rng);
      const menMax = pickBattleSeedInt(8, 16, rng);
      next.属性.等级 = 0;
      next.系别 = '普通人';
      next.属性.HP上限 = hpMax;
      next.属性.HP = hpMax;
      next.属性.体力上限 = hpMax;
      next.属性.体力 = hpMax;
      next.属性.魂力上限 = 0;
      next.属性.魂力 = 0;
      next.属性.精神力上限 = menMax;
      next.属性.精神力 = menMax;
      next.属性.力量 = pickBattleSeedInt(6, 10, rng);
      next.属性.防御 = pickBattleSeedInt(5, 9, rng);
      next.属性.敏捷 = pickBattleSeedInt(6, 10, rng);
      return next;
    }

    const combatType = resolveTemporaryHumanCombatType(identity, rng, seed?.系别 || seed?.type);
    const base = getBaseStats(level);
    const typeMult = TypeMultipliers[combatType] || TypeMultipliers['强攻系'];
    const variance = 0.92 + rng() * 0.16;
    const derived = {
      str: Math.floor(base.str * typeMult.str * variance),
      def: Math.floor(base.def * typeMult.def * variance),
      agi: Math.floor(base.agi * typeMult.agi * variance),
      vit_max: Math.floor(base.vit_max * typeMult.vit_max * variance),
      men_max: Math.floor(base.men_max * typeMult.men_max * variance),
      sp_max: Math.floor(base.sp_max * typeMult.sp_max * variance),
    };
    applyTemporaryHumanEquipment(derived, next.装备, identity, level, rng, seed);
    next.系别 = combatType;
    next.属性.等级 = level;
    next.属性.HP上限 = Math.max(1, derived.vit_max);
    next.属性.HP = next.属性.HP上限;
    next.属性.体力上限 = next.属性.HP上限;
    next.属性.体力 = next.属性.体力上限;
    next.属性.魂力上限 = Math.max(1, derived.sp_max);
    next.属性.魂力 = next.属性.魂力上限;
    next.属性.精神力上限 = Math.max(1, derived.men_max);
    next.属性.精神力 = next.属性.精神力上限;
    next.属性.力量 = Math.max(1, derived.str);
    next.属性.防御 = Math.max(1, derived.def);
    next.属性.敏捷 = Math.max(1, derived.agi);
    next.自创魂技 = buildTemporaryCombatSkillMap(
      battleSeedText,
      unitName,
      combatType,
      level,
      estimateTemporaryHumanSkillCount(level),
      estimateTemporaryHumanSkillAge(level),
      identity === '军人' ? '优秀' : '正常',
    );
    return next;
  });
}

function buildTemporarySoulBeastCombatant(seed = {}, slotName = 'enemy') {
  const unitName = String(seed?.名称 || seed?.name || slotName || '魂兽').trim() || '魂兽';
  const species = String(seed?.标准物种 || '').trim();
  const age = Math.max(1, Math.floor(Number(seed?.年限 || 1)));
  const quantity = Math.max(1, Math.floor(Number(seed?.数量 || 1)));
  const quality = String(seed?.品质 || '').trim();
  const stats = getBeastStats(age, species, quality);
  const combatType = inferTemporarySoulBeastCombatType(species, stats);
  const next = buildTemporaryCombatSkeleton(unitName, '魂兽');
  next.数量 = quantity;
  next.年限 = age;
  next.标准物种 = species;
  if (quality) next.品质 = quality;
  next.系别 = combatType;
  next.属性.年龄 = age;
  next.属性.等级 = Number(stats.对标等级 || 1);
  next.属性.HP上限 = Math.max(1, Number(stats.vit_max || 1));
  next.属性.HP = next.属性.HP上限;
  next.属性.体力上限 = next.属性.HP上限;
  next.属性.体力 = next.属性.体力上限;
  next.属性.魂力上限 = Math.max(1, Number(stats.sp_max || 1));
  next.属性.魂力 = next.属性.魂力上限;
  next.属性.精神力上限 = Math.max(1, Number(stats.men_max || 1));
  next.属性.精神力 = next.属性.精神力上限;
  next.属性.力量 = Math.max(1, Number(stats.str || 1));
  next.属性.防御 = Math.max(1, Number(stats.def || 1));
  next.属性.敏捷 = Math.max(1, Number(stats.agi || 1));
  next.社交.势力['魂兽一族'] = { 身份: '敌对', 权限级: 1 };
  next.自创魂技 = buildTemporaryCombatSkillMap(
    `${unitName}|魂兽|${species}|${age}|${slotName}`,
    unitName,
    combatType,
    Number(stats.对标等级 || 1),
    estimateTemporaryMonsterSkillCount('魂兽', seed),
    age,
    '正常',
  );
  return next;
}

function buildTemporaryAbyssCombatant(seed = {}, slotName = 'enemy') {
  const unitName = String(seed?.名称 || seed?.name || slotName || '深渊生物').trim() || '深渊生物';
  const race = String(seed?.标准种族 || '').trim();
  const tier = String(seed?.级别 || '').trim();
  const quantity = Math.max(1, Math.floor(Number(seed?.数量 || 1)));
  const stats = withBattleSeedRandom(`${unitName}|深渊|${race}|${tier}|${slotName}`, () => 获取深渊属性(tier, race));
  const combatType = inferTemporaryAbyssCombatType(race, stats);
  const next = buildTemporaryCombatSkeleton(unitName, '深渊');
  next.数量 = quantity;
  next.级别 = tier;
  next.标准种族 = race;
  next.系别 = combatType;
  next.属性.等级 = Number(stats.对标等级 || 1);
  next.属性.HP上限 = Math.max(1, Number(stats.vit_max || 1));
  next.属性.HP = next.属性.HP上限;
  next.属性.体力上限 = next.属性.HP上限;
  next.属性.体力 = next.属性.体力上限;
  next.属性.魂力上限 = Math.max(1, Number(stats.sp_max || 1));
  next.属性.魂力 = next.属性.魂力上限;
  next.属性.精神力上限 = Math.max(1, Number(stats.men_max || 1));
  next.属性.精神力 = next.属性.精神力上限;
  next.属性.力量 = Math.max(1, Number(stats.str || 1));
  next.属性.防御 = Math.max(1, Number(stats.def || 1));
  next.属性.敏捷 = Math.max(1, Number(stats.agi || 1));
  next.社交.势力['深渊生物'] = { 身份: '敌对', 权限级: 1 };
  next.自创魂技 = buildTemporaryCombatSkillMap(
    `${unitName}|深渊|${race}|${tier}|${slotName}`,
    unitName,
    combatType,
    Number(stats.对标等级 || 1),
    estimateTemporaryMonsterSkillCount('深渊', seed),
    Math.max(1000, Number(stats.对标等级 || 1) * 1000),
    '正常',
  );
  return next;
}

function mergeTemporaryCombatRuntimeState(existing = {}, generated = {}) {
  const next = _.cloneDeep(generated || {});
  const existingStat = existing?.属性 && typeof existing.属性 === 'object' ? existing.属性 : {};
  const existingStatus = existing?.状态 && typeof existing.状态 === 'object' ? existing.状态 : {};
  if (!next.属性 || typeof next.属性 !== 'object') next.属性 = {};
  if (!next.状态 || typeof next.状态 !== 'object') next.状态 = {};

  ['HP', 'HP上限', '体力', '体力上限', '魂力', '魂力上限', '精神力', '精神力上限', '力量', '防御', '敏捷', '等级', '年龄', '状态效果'].forEach(key => {
    if (existingStat[key] !== undefined) next.属性[key] = _.cloneDeep(existingStat[key]);
  });
  ['系别', 'type'].forEach(key => {
    if (existing?.[key] !== undefined) next[key] = _.cloneDeep(existing[key]);
  });
  ['存活', '死亡tick', '死亡类型', '当前领域', '行动', '位置', '横坐标', '纵坐标'].forEach(key => {
    if (existingStatus[key] !== undefined) next.状态[key] = _.cloneDeep(existingStatus[key]);
  });
  if (existing?.装备 && typeof existing.装备 === 'object') next.装备 = _.cloneDeep(existing.装备);
  if (existing?.自创魂技 && typeof existing.自创魂技 === 'object') next.自创魂技 = _.cloneDeep(existing.自创魂技);
  return next;
}

function findCombatCharKeyByName(data = {}, participantName = '') {
  const safeName = String(participantName || '').trim();
  if (!safeName || !data?.char || typeof data.char !== 'object') return '';
  if (data.char[safeName]) return safeName;
  const match = Object.keys(data.char).find(charKey => {
    const charData = data.char[charKey];
    const displayName = String(charData?.name || charData?.base?.name || '').trim();
    return displayName && displayName === safeName;
  });
  return match || '';
}

function buildExpandedBattleParticipantFromChar(data = {}, charKey = '', roleName = '敌对') {
  const sourceChar = data?.char?.[charKey];
  if (!sourceChar || typeof sourceChar !== 'object') return null;
  const participant = _.cloneDeep(sourceChar);
  participant.name = String(participant.name || participant?.base?.name || charKey).trim() || charKey;
  participant.势力 = roleName;
  if (!participant.状态 || typeof participant.状态 !== 'object') participant.状态 = {};
  participant.状态.存活 = participant.状态.存活 !== false;
  participant.状态.死亡tick = participant.状态.存活 ? -1 : Math.max(-1, Number(participant.状态.死亡tick ?? -1));
  participant.状态.死亡类型 = participant.状态.存活 ? '无' : String(participant.状态.死亡类型 || '意外').trim() || '意外';
  return participant;
}

function buildExpandedTemporaryBattleParticipant(seed = {}, slotKey = 'enemy') {
  const unitNature = String(seed?.单位性质 || '').trim();
  if (unitNature === '人类') return buildTemporaryHumanCombatant(seed, slotKey);
  if (unitNature === '魂兽') return buildTemporarySoulBeastCombatant(seed, slotKey);
  if (unitNature === '深渊') return buildTemporaryAbyssCombatant(seed, slotKey);
  return null;
}

function expandBattleParticipantEntry(data = {}, participant = null, slotKey = 'enemy') {
  if (!participant || typeof participant !== 'object' || Array.isArray(participant)) return null;
  const participantName = String(participant.name || '').trim();
  const charKey = findCombatCharKeyByName(data, participantName);
  if (charKey) return buildExpandedBattleParticipantFromChar(data, charKey, String(slotKey || '').includes('team_player') ? '己方' : '敌对');

  const generated = buildExpandedTemporaryBattleParticipant(participant, slotKey);
  if (!generated) return _.cloneDeep(participant);
  return mergeTemporaryCombatRuntimeState(participant, generated);
}

function expandBattleParticipantArray(data = {}, items = [], slotKey = 'team_enemy') {
  return (Array.isArray(items) ? items : []).flatMap((participant, index) =>
    explodeBattleParticipantQuantity(data, participant, `${slotKey}_${index + 1}`),
  ).filter(Boolean);
}

function explodeBattleParticipantQuantity(data = {}, participant = null, slotKey = 'enemy') {
  const expanded = expandBattleParticipantEntry(data, participant, slotKey);
  if (!expanded) return [];
  const hasExpandedStats = !!(expanded.属性 && typeof expanded.属性 === 'object');
  if (hasExpandedStats) return [expanded];
  const quantity = Math.max(1, Math.floor(Number(participant?.数量 || expanded?.数量 || 1)));
  const results = [];
  for (let index = 1; index <= quantity; index += 1) {
    const cloneSeed = _.cloneDeep(participant);
    const baseName = String(cloneSeed?.name || '').trim() || `临时单位${index}`;
    const displayName = index === 1 ? baseName : `${baseName}·${index}`;
    cloneSeed.name = displayName;
    cloneSeed.数量 = 1;
    const nextExpanded = expandBattleParticipantEntry(data, cloneSeed, `${slotKey}_${index}`);
    if (nextExpanded) results.push(nextExpanded);
  }
  return results;
}

function expandWorldBattleParticipants(data = {}) {
  const battle = data?.world?.战斗;
  const participants = battle?.参战者;
  if (!battle || typeof battle !== 'object' || !participants || typeof participants !== 'object') return;

  const nextParticipants = {
    team_player: [],
    team_enemy: [],
  };

  nextParticipants.team_player.push(...expandBattleParticipantArray(data, participants.team_player, 'team_player'));
  nextParticipants.team_enemy.push(...expandBattleParticipantArray(data, participants.team_enemy, 'team_enemy'));

  nextParticipants.team_player.forEach(unit => {
    if (unit && typeof unit === 'object') unit.势力 = '己方';
  });
  nextParticipants.team_enemy.forEach(unit => {
    if (unit && typeof unit === 'object') unit.势力 = '敌对';
  });

  battle.参战者 = nextParticipants;
}

if (typeof globalThis !== 'undefined') {
  globalThis.__MVU_EXPAND_WORLD_BATTLE_PARTICIPANTS__ = function attachExpandedBattleParticipants(rootData = {}) {
    if (!rootData || typeof rootData !== 'object') return rootData;
    expandWorldBattleParticipants(rootData);
    return rootData;
  };
}

var SKILL_GENERATION_LAYERS = {
  L1: { name: '主机制大类', purpose: '决定技能的核心骨架' },
  L2: { name: '子机制', purpose: '决定技能的主要表现方式' },
  L3: { name: '副机制', purpose: '给技能附加第二效果' },
  L4: { name: '品质层', purpose: '决定数值强弱，与1-100抽到的机制种类无关' },
  L5: { name: '表现层', purpose: '用于命名、画面描述、特效摘要' },
};

var SKILL_MAIN_MECHANIC_POOL_V1 = {
  伤害类: {
    desc: '以直接造成伤害为核心结果的技能骨架',
    children: ['单体伤害', '群体伤害', '多段伤害', '持续伤害'],
  },
  控制类: {
    desc: '以限制行动、施法、位置或节奏为核心结果的技能骨架',
    children: ['硬控', '软控', '迟缓', '节奏打断'],
  },
  削弱类: {
    desc: '以压制面板、恢复效率、消耗或节奏为核心结果的技能骨架',
    children: ['单属性削弱', '多属性削弱', '禁疗', '消耗', '前摇', '掌控压制', '元素封禁'],
  },
  增益类: {
    desc: '以强化自身或友方面板、掌控或行动效率为核心结果的技能骨架',
    children: ['单属性增益', '多属性增益', '全属性增益', '威力增幅', '技能效果增幅', '消耗', '前摇', '掌控提升', '速度提升'],
  },
  防御类: {
    desc: '以承伤、生存、防反、免疫类效果为核心结果的技能骨架',
    children: ['护盾', '承伤修正', '免伤', '霸体', '免死/锁血'],
  },
  回复类: {
    desc: '以恢复当前生命、魂力、精神力或清除异常为核心结果的技能骨架',
    children: ['体力恢复', '魂力恢复', '精神恢复', '持续恢复', '净化/解控'],
  },
  '感知/认知类': {
    desc: '以干涉感知、认知、情报或判断为核心结果的技能骨架',
    children: ['感知干扰', '标记锁定', '共享视野', '幻境', '催眠', '认知扭曲'],
  },
  位移类: {
    desc: '以改变自身、敌方或双方空间位置关系为核心结果的技能骨架',
    children: ['自身位移', '强制位移', '位移交换', '追击位移', '脱离位移'],
  },
  特殊规则类: {
    desc: '以修改战斗规则、效果归属或目标关系为核心结果的技能骨架',
    children: ['召唤', '分身', '复制', '反制', '转化', '状态交换', '强制绑定/锁定', '规则改写', '炸环', '时光回溯', '气运干涉'],
  },
};

var SKILL_DELIVERY_FORM_POOL_V1 = [
  '直接生效',
  '造物承载',
];

var SKILL_MAIN_MECHANIC_DISTRIBUTION_V1 = {
  强攻系: [
    { min: 1, max: 50, main: '伤害类' },
    { min: 51, max: 66, main: '增益类' },
    { min: 67, max: 80, main: '防御类' },
    { min: 81, max: 88, main: '控制类' },
    { min: 89, max: 94, main: '削弱类' },
    { min: 95, max: 97, main: '位移类' },
    { min: 98, max: 99, main: '回复类' },
    { min: 100, max: 100, main: '特殊规则类' },
  ],
  控制系: [
    { min: 1, max: 34, main: '控制类' },
    { min: 35, max: 60, main: '削弱类' },
    { min: 61, max: 76, main: '感知/认知类' },
    { min: 77, max: 86, main: '位移类' },
    { min: 87, max: 93, main: '伤害类' },
    { min: 94, max: 99, main: '防御类' },
    { min: 100, max: 100, main: '特殊规则类' },
  ],
  食物系: [
    { min: 1, max: 44, main: '回复类' },
    { min: 45, max: 80, main: '增益类' },
    { min: 81, max: 86, main: '防御类' },
    { min: 87, max: 90, main: '削弱类' },
    { min: 91, max: 94, main: '控制类' },
    { min: 95, max: 97, main: '感知/认知类' },
    { min: 98, max: 99, main: '特殊规则类' },
    { min: 100, max: 100, main: '伤害类' },
  ],
  精神系: [
    { min: 1, max: 26, main: '感知/认知类' },
    { min: 27, max: 46, main: '控制类' },
    { min: 47, max: 62, main: '削弱类' },
    { min: 63, max: 78, main: '伤害类' },
    { min: 79, max: 90, main: '增益类' },
    { min: 91, max: 100, main: '特殊规则类' },
  ],
  防御系: [
    { min: 1, max: 42, main: '防御类' },
    { min: 43, max: 62, main: '增益类' },
    { min: 63, max: 76, main: '伤害类' },
    { min: 77, max: 86, main: '控制类' },
    { min: 87, max: 93, main: '削弱类' },
    { min: 94, max: 99, main: '回复类' },
    { min: 100, max: 100, main: '特殊规则类' },
  ],
  敏攻系: [
    { min: 1, max: 42, main: '伤害类' },
    { min: 43, max: 62, main: '位移类' },
    { min: 63, max: 76, main: '增益类' },
    { min: 77, max: 86, main: '控制类' },
    { min: 87, max: 93, main: '削弱类' },
    { min: 94, max: 99, main: '防御类' },
    { min: 100, max: 100, main: '特殊规则类' },
  ],
  元素系: [
    { min: 1, max: 38, main: '伤害类' },
    { min: 39, max: 58, main: '控制类' },
    { min: 59, max: 72, main: '削弱类' },
    { min: 73, max: 84, main: '防御类' },
    { min: 85, max: 92, main: '增益类' },
    { min: 93, max: 97, main: '位移类' },
    { min: 98, max: 100, main: '特殊规则类' },
  ],
  辅助系: [
    { min: 1, max: 44, main: '增益类' },
    { min: 45, max: 54, main: '回复类' },
    { min: 55, max: 64, main: '防御类' },
    { min: 65, max: 74, main: '感知/认知类' },
    { min: 75, max: 79, main: '削弱类' },
    { min: 80, max: 89, main: '特殊规则类' },
    { min: 90, max: 94, main: '控制类' },
    { min: 95, max: 99, main: '位移类' },
    { min: 100, max: 100, main: '伤害类' },
  ],
  治疗系: [
    { min: 1, max: 44, main: '回复类' },
    { min: 45, max: 66, main: '防御类' },
    { min: 67, max: 82, main: '增益类' },
    { min: 83, max: 90, main: '感知/认知类' },
    { min: 91, max: 96, main: '特殊规则类' },
    { min: 97, max: 100, main: '伤害类' },
  ],
  召唤系: [
    { min: 1, max: 78, main: '特殊规则类' },
    { min: 79, max: 100, main: '增益类' },
  ],
};

var SKILL_ARCHETYPE_POOL_V1 = {
  伤害类: ['直接伤害', '多段伤害', '持续伤害'],
  控制类: ['硬控', '软控', '迟缓', '节奏打断'],
  削弱类: ['单属性削弱', '多属性削弱', '禁疗', '消耗', '前摇', '掌控压制', '元素封禁'],
  增益类: ['单属性增益', '多属性增益', '全属性增益', '威力增幅', '技能效果增幅', '消耗', '前摇', '掌控提升', '速度提升', '修炼增益'],
  防御类: ['护盾', '承伤修正', '免伤', '霸体', '免死/锁血', '无敌金身', '伤害反射', '伤害转移', '伤害分摊', '消耗分摊'],
  回复类: ['体力恢复', '魂力恢复', '精神恢复', '持续恢复', '净化/解控'],
  '感知/认知类': ['感知干扰', '标记锁定', '共享视野', '幻境', '催眠', '认知扭曲'],
  位移类: ['自身位移', '强制位移', '位移交换', '追击位移', '脱离位移'],
  特殊规则类: ['召唤', '分身', '复制', '反制', '转化', '状态交换', '状态转移', '强制绑定/锁定', '规则改写', '引爆持续伤害', '斩盾', '吞噬', '能力共享', '机制抹消', '炸环', '时光回溯', '气运干涉', '资源燃烧', '资源锁定'],
};
var 自动生成禁止主机制原型集合_V1 = new Set(['消耗', '前摇']);

var AUTO_GENERATED_EXCLUSIVE_MAIN_ARCHETYPES_V1 = new Set([
  '吞噬',
  '能力共享',
  '机制抹消',
  '状态转移',
  '引爆持续伤害',
  '斩盾',
  '无敌金身',
  '伤害分摊',
  '消耗分摊',
  '伤害反射',
  '伤害转移',
]);

var SPECIAL_RULE_EXPANDED_ARCHETYPE_SET_V1 = new Set([
  '吞噬',
  '能力共享',
  '机制抹消',
  '状态转移',
  '引爆持续伤害',
  '斩盾',
]);

var SKILL_DELIVERY_FORM_BY_TYPE_V1 = {
  强攻系: ['直接生效'],
  控制系: ['直接生效'],
  食物系: ['造物承载', '直接生效'],
  精神系: ['直接生效'],
  防御系: ['直接生效'],
  敏攻系: ['直接生效'],
  元素系: ['直接生效'],
  辅助系: ['直接生效', '造物承载'],
  治疗系: ['直接生效', '造物承载'],
  召唤系: ['直接生效'],
};

var SKILL_ATTRIBUTE_HINTS_BY_TYPE_V1 = {
  强攻系: ['力量', '魂力', '防御'],
  控制系: ['魂力', '精神力', '敏捷'],
  食物系: ['力量', '防御', '敏捷', '魂力', '精神力'],
  精神系: ['精神力', '魂力'],
  防御系: ['防御', '魂力'],
  敏攻系: ['敏捷', '力量', '魂力'],
  元素系: ['精神力', '魂力', '敏捷'],
  辅助系: ['魂力', '精神力', '防御'],
  治疗系: ['魂力', '精神力'],
  召唤系: ['精神力', '魂力', '防御'],
};

function pickRandom(list = []) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

var SKILL_SECONDARY_BY_MAIN_V1 = {
  伤害类: ['穿透', '伤害吸收', '斩杀补伤', '流血DOT', '打断', '反击', '追击', '引爆持续伤害', '斩盾', '吞噬', '延长持续伤害', '压缩持续伤害'],
  控制类: ['打断', '沉默', '减速', '致盲', '迟缓', '禁疗', '嘲讽', '破隐', '封技'],
  削弱类: ['禁疗', '减速', '迟缓', '标记弱点', '驱散增益', '破隐', '治疗反转', '封技', '元素封禁', '斩盾', '吞噬', '机制抹消', '速度压制', '资源燃烧', '资源锁定'],
  增益类: ['小护盾', '净化', '解控', '共享视野', '隐身', '护卫', '威力增幅', '技能效果增幅', '无敌金身', '能力共享', '修炼增益'],
  防御类: ['小护盾', '反击', '净化', '解控', '护卫', '嘲讽', '无敌金身', '伤害反射', '伤害转移', '伤害分摊', '消耗分摊', '生命链接'],
  回复类: ['净化', '解控', '小护盾', '魂力恢复', '精神恢复', '驱散增益', '护卫', '能力共享', '修炼增益'],
  '感知/认知类': ['标记弱点', '共享视野', '目标锁定', '打断', '沉默', '驱散增益', '窃取增益', '破隐'],
  位移类: ['打断', '反击', '标记弱点', '隐身', '破隐'],
  特殊规则类: ['共享视野', '标记弱点', '净化', '驱散增益', '窃取增益', '隐身', '护卫', '状态转移', '引爆持续伤害', '斩盾', '吞噬', '能力共享', '机制抹消', '炸环', '时光回溯', '气运干涉', '规则改写', '治疗反转', '封技', '无敌金身', '伤害反射', '伤害转移', '伤害分摊', '消耗分摊', '生命链接', '资源燃烧', '资源锁定'],
};

var SKILL_SECONDARY_TYPE_BIAS_V1 = {
  强攻系: ['斩盾', '引爆持续伤害', '无敌金身', '伤害反射', '反击', '追击'],
  防御系: ['伤害反射', '护卫'],
  敏攻系: ['隐身', '追击', '破隐', '无敌金身', '斩盾'],
  控制系: ['封技', '治疗反转', '目标锁定', '驱散增益', '嘲讽', '伤害分摊', '吞噬', '机制抹消'],
  精神系: ['状态转移', '封技', '治疗反转', '窃取增益', '目标锁定', '隐身', '吞噬', '能力共享', '机制抹消'],
  元素系: ['引爆持续伤害', '斩盾', '封技', '治疗反转', '驱散增益', '破隐', '吞噬', '机制抹消'],
  辅助系: ['护卫', '共享视野', '驱散增益', '无敌金身', '伤害分摊', '消耗分摊', '能力共享'],
  治疗系: ['护卫', '驱散增益', '共享视野', '无敌金身', '伤害分摊', '消耗分摊', '能力共享'],
  食物系: ['净化', '解控', '驱散增益', '禁疗', '减速', '迟缓', '治疗反转', '资源锁定', '护卫', '共享视野'],
  召唤系: ['共享视野', '护卫', '能力共享', '伤害分摊'],
};

var SKILL_MECHANISM_DEFAULT_META_V1 = Object.freeze({
  可主机制: false,
  可副机制: false,
  目标语义: '上下文',
  群体赋予: false,
  仅自身: false,
  副作用模板: Object.freeze([]),
  摘要提示: Object.freeze({}),
  说明: '',
  设计台参数定义: Object.freeze([]),
  designerMainHint: '',
  designerSubHint: '',
  designerSecondaryHint: '',
});

function createSkillMechanismParamDefV1(type = 'text', key = '', label = '', placeholder = '', extra = {}) {
  return Object.freeze({
    type,
    key: String(key || '').trim(),
    label: String(label || '').trim(),
    placeholder: String(placeholder || '').trim(),
    ...extra,
  });
}

function createSkillMechanismMetaV1(meta = {}) {
  return Object.freeze({
    ...SKILL_MECHANISM_DEFAULT_META_V1,
    ...meta,
    说明: String(meta.说明 || '').trim(),
    摘要提示: Object.freeze(meta.摘要提示 && typeof meta.摘要提示 === 'object' ? meta.摘要提示 : {}),
    设计台参数定义: Object.freeze(Array.isArray(meta.设计台参数定义) ? meta.设计台参数定义.filter(Boolean) : []),
    副作用模板: Object.freeze(
      Array.isArray(meta.副作用模板)
        ? meta.副作用模板
            .map(item => normalizeSkillSideEffectEntry(item))
            .filter(Boolean)
        : [],
    ),
  });
}

var SKILL_SIDE_EFFECT_TRIGGER_OPTIONS_V1 = Object.freeze(['效果生效后', '命中后', '回合结束时', '效果结束后']);
var SKILL_SIDE_EFFECT_TARGET_OPTIONS_V1 = Object.freeze(['技能释放者', '效果承受者', '双方']);
var SKILL_SIDE_EFFECT_TYPE_OPTIONS_V1 = Object.freeze([
  '全属性降低',
  '自损反噬',
  '致死献祭',
  '精神紊乱',
  '魂力反噬',
  '命中下降',
  '动作迟缓',
  '目标错乱',
  '施法僵直',
]);
var SKILL_SIDE_EFFECT_TYPE_META_V1 = Object.freeze({
  全属性降低: Object.freeze({ 状态: '虚弱', 数值: '+10%', 副数值: '', 持续回合: 2 }),
  自损反噬: Object.freeze({ 状态: '反噬', 数值: '+5%', 副数值: '', 持续回合: 1 }),
  致死献祭: Object.freeze({ 致死: true }),
  精神紊乱: Object.freeze({ 状态: '精神紊乱', 数值: '+25%', 副数值: '+8%', 持续回合: 2 }),
  魂力反噬: Object.freeze({ 状态: '魂力枯竭', 数值: '+5%', 副数值: '', 持续回合: 1 }),
  命中下降: Object.freeze({ 状态: '精神紊乱', 数值: '+10%', 副数值: '', 持续回合: 2 }),
  动作迟缓: Object.freeze({ 状态: '迟缓', 数值: '+15%', 副数值: '+10%', 持续回合: 1 }),
  目标错乱: Object.freeze({ 状态: '混乱', 数值: '+30%', 副数值: '', 持续回合: 1 }),
  施法僵直: Object.freeze({ 状态: '僵直', 数值: '+20%', 副数值: '', 持续回合: 1 }),
});

function normalizeSkillSideEffectEntry(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const 副作用类型 = String(value.副作用类型 || '').trim();
  if (!SKILL_SIDE_EFFECT_TYPE_OPTIONS_V1.includes(副作用类型)) return null;
  const rawTrigger = String(value.触发时机 || '效果生效后').trim();
  const 触发时机 = SKILL_SIDE_EFFECT_TRIGGER_OPTIONS_V1.includes(rawTrigger) ? rawTrigger : '效果生效后';
  const rawTarget = String(value.生效对象 || '技能释放者').trim();
  const 生效对象 = SKILL_SIDE_EFFECT_TARGET_OPTIONS_V1.includes(rawTarget) ? rawTarget : '技能释放者';
  const 类型配置 = SKILL_SIDE_EFFECT_TYPE_META_V1[副作用类型] || {};
  const rawDuration = Number(value.持续回合 ?? 类型配置.持续回合 ?? 0);
  const 持续回合 = Number.isFinite(rawDuration) ? Math.max(0, Math.round(rawDuration)) : 0;
  const rawChance = Number(value.触发概率 ?? 1);
  const 触发概率 = Number.isFinite(rawChance) ? Math.max(0, Math.min(1, Number(rawChance.toFixed(4)))) : 1;
  const normalized = {
    副作用类型,
    触发时机,
    生效对象,
    触发概率,
  };
  if (副作用类型 !== '致死献祭') {
    const 副作用状态 = String(类型配置.状态 || 副作用类型).trim();
    const 数值 = String(value.数值 ?? 类型配置.数值 ?? '').trim();
    const 副数值 = String(value.副数值 ?? 类型配置.副数值 ?? '').trim();
    normalized.持续回合 = 持续回合;
    if (副作用状态) normalized.副作用状态 = 副作用状态;
    if (数值) normalized.数值 = 数值;
    if (副数值) normalized.副数值 = 副数值;
  }
  if (触发时机 === '效果结束后') {
    const 关联状态 = String(value.关联状态 || '').trim();
    if (关联状态) normalized.关联状态 = 关联状态;
  }
  return normalized;
}

function normalizeSkillSideEffectList(value = []) {
  const source = Array.isArray(value) ? value : [];
  return source
    .map(item => normalizeSkillSideEffectEntry(item))
    .filter(Boolean);
}

var SKILL_MECHANISM_META_V1 = (() => {
  const map = {};
  const num = (key, label, placeholder = '', step = '0.1', extra = {}) =>
    createSkillMechanismParamDefV1('number', key, label, placeholder, { step, ...extra });
  const text = (key, label, placeholder = '', extra = {}) =>
    createSkillMechanismParamDefV1('text', key, label, placeholder, extra);
  const select = (key, label, optionsKey = '', placeholder = '未设置', extra = {}) =>
    createSkillMechanismParamDefV1('select', key, label, placeholder, { optionsKey, ...extra });
  const register = (labels, meta = {}) => {
    const normalizedLabels = Array.isArray(labels) ? labels : [labels];
    normalizedLabels
      .map(label => String(label || '').trim())
      .filter(Boolean)
      .forEach(label => {
        map[label] = createSkillMechanismMetaV1({
          designerMainHint: label,
          designerSubHint: label,
          designerSecondaryHint: label,
          ...meta,
        });
      });
  };

  register(['直接伤害', '单体伤害'], {
    可主机制: true,
    目标语义: '敌对',
    说明: '对单个敌人打出一次伤害结算。',
    摘要提示: { skillType: '输出', mainType: '伤害类', effectMode: '瞬发' },
    designerMainHint: '伤害类',
    designerSubHint: '单体伤害',
    设计台参数定义: [num('powerRatio', '威力倍率', '100'), num('hitCount', '攻击段数', '1', '1')],
  });
  register('群体伤害', {
    可主机制: true,
    目标语义: '敌对',
    说明: '对范围内多个敌人各打一次伤害结算。',
    摘要提示: { skillType: '输出', mainType: '伤害类', cooperation: '高', effectMode: '瞬发' },
    designerMainHint: '伤害类',
    designerSubHint: '群体伤害',
    设计台参数定义: [num('powerRatio', '威力倍率', '105'), text('range', '作用范围', '前方扇形 / 半径8米')],
  });
  register('多段伤害', {
    可主机制: true,
    目标语义: '敌对',
    说明: '一次施放拆成多段连续结算，每段独立判定命中。',
    摘要提示: { skillType: '输出', mainType: '伤害类', effectMode: '持续' },
    designerMainHint: '伤害类',
    designerSubHint: '多段伤害',
    设计台参数定义: [
      num('segmentCount', '段数', '3', '1'),
    ],
  });
  register('持续伤害', {
    可主机制: true,
    目标语义: '敌对',
    说明: '给目标挂持续创伤状态，之后每回合按倍率扣血。',
    摘要提示: { skillType: '输出', mainType: '伤害类', effectMode: '持续' },
    designerMainHint: '伤害类',
    designerSubHint: '持续伤害',
    设计台参数定义: [
      num('dotRatio', '每跳倍率', '35'),
      num('duration', '持续回合', '3', '1'),
      num('stackLimit', '叠层上限', '1', '1'),
    ],
  });
  register('硬控', {
    说明: '让目标完全无法行动，直到回合结束或满足解除条件。',
    可主机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '控制类', controlStrength: '硬控' },
    designerMainHint: '控制类',
    designerSubHint: '硬控',
    设计台参数定义: [
      num('duration', '持续回合', '2', '1'),
      num('controlPower', '控制强度', '1.0'),
      text('breakRule', '解除条件', '受击 / 净化'),
    ],
  });
  register('软控', {
    说明: '限制目标的行动能力，但不完全剥夺其行动。',
    可主机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '控制类', controlStrength: '软控' },
    designerMainHint: '控制类',
    designerSubHint: '软控',
    设计台参数定义: [num('slowRatio', '控制幅度', '0.3'), num('duration', '持续回合', '2', '1')],
  });
  register(['节奏打断', '打断'], {
    说明: '打断目标正在进行的动作，并追加一段僵直。',
    可主机制: true,
    可副机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '控制类', effectMode: '瞬发' },
    designerMainHint: '控制类',
    designerSubHint: '节奏打断',
    designerSecondaryHint: '打断',
    设计台参数定义: [select('interruptWindow', '打断时机', 'INTERRUPT_WINDOW'), num('extraDelay', '追加僵直', '0.5')],
  });
  register('封技', {
    说明: '封住目标的技能，使其在持续期内无法施放。',
    可主机制: true,
    可副机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '控制类', controlStrength: '软控' },
    designerMainHint: '控制类',
    designerSubHint: '封技',
    designerSecondaryHint: '封技',
    设计台参数定义: [num('duration', '持续回合', '2', '1'), select('muteScope', '限制范围', 'MUTE_SCOPE')],
  });
  register('单属性削弱', {
    说明: '按倍率压低目标的某一项属性。',
    可主机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '削弱类' },
    designerMainHint: '削弱类',
    designerSubHint: '单属性削弱',
    设计台参数定义: [
      select('debuffAttr', '削弱属性', 'ATTRIBUTE'),
      num('reduceRatio', '压制倍率', '0.8'),
      num('duration', '持续回合', '2', '1'),
    ],
  });
  register('多属性削弱', {
    说明: '按倍率同时压低目标的多项属性。',
    可主机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '削弱类' },
    designerMainHint: '削弱类',
    designerSubHint: '多属性削弱',
    设计台参数定义: [
      select('debuffAttrGroup', '属性组', 'ATTRIBUTE_GROUP'),
      num('reduceRatio', '压制倍率', '0.8'),
      num('duration', '持续回合', '2', '1'),
    ],
  });
  register('禁疗', {
    说明: '按幅度削减目标受到的治疗量。',
    可主机制: true,
    可副机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '削弱类', controlStrength: '软控' },
    designerMainHint: '削弱类',
    designerSubHint: '禁疗',
    designerSecondaryHint: '禁疗',
    设计台参数定义: [num('banHealRatio', '禁疗幅度', '1.0'), num('duration', '持续回合', '2', '1')],
  });
  register('治疗反转', {
    说明: '把目标受到的治疗按倍率转成伤害。',
    可主机制: true,
    可副机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '削弱类', controlStrength: '软控' },
    designerMainHint: '削弱类',
    designerSubHint: '治疗反转',
    designerSecondaryHint: '治疗反转',
    设计台参数定义: [num('invertRatio', '反转倍率', '1.0'), num('duration', '持续回合', '2', '1')],
  });
  register('掌控压制', {
    说明: '按倍率压低目标的技能掌控度。',
    可主机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '削弱类' },
    designerMainHint: '削弱类',
    designerSubHint: '掌控压制',
    设计台参数定义: [num('reduceRatio', '压制倍率', '0.85'), num('duration', '持续回合', '2', '1')],
  });
  register('速度压制', {
    说明: '按幅度压低目标的速度相关判定。',
    可副机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '削弱类' },
    designerSecondaryHint: '减速',
    设计台参数定义: [num('slowRatio', '压制幅度', '0.3'), num('duration', '持续回合', '2', '1')],
  });
  register('单属性增益', {
    说明: '按倍率提升自己或队友的某一项属性。',
    可主机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '辅助', mainType: '增益类', cooperation: '中' },
    designerMainHint: '增益类',
    designerSubHint: '单属性增益',
    设计台参数定义: [
      select('buffAttr', '增幅对象', 'ATTRIBUTE'),
      num('gainRatio', '增幅倍率', '1.3'),
      num('duration', '持续回合', '3', '1'),
    ],
  });
  register('多属性增益', {
    说明: '按倍率同时提升多项属性。',
    可主机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '辅助', mainType: '增益类', cooperation: '高' },
    designerMainHint: '增益类',
    designerSubHint: '多属性增益',
    设计台参数定义: [
      select('buffAttrGroup', '属性组', 'ATTRIBUTE_GROUP'),
      num('gainRatio', '增幅倍率', '1.2'),
      num('duration', '持续回合', '3', '1'),
    ],
  });
  register('全属性增益', {
    说明: '按倍率提升全部主属性。',
    可主机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '辅助', mainType: '增益类', cooperation: '高' },
    designerMainHint: '增益类',
    designerSubHint: '全属性增益',
    设计台参数定义: [num('allGainRatio', '全属性倍率', '1.15'), num('duration', '持续回合', '2', '1')],
  });
  register('消耗', {
    说明: '修改技能自身的资源消耗。',
    可主机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '辅助', mainType: '增益类' },
    designerMainHint: '增益类',
    designerSubHint: '消耗',
    设计台参数定义: [num('gainRatio', '修正数值', '-20%'), num('duration', '持续回合', '3', '1')],
  });
  register('前摇', {
    说明: '修改技能自身的前摇。',
    可主机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '辅助', mainType: '增益类' },
    designerMainHint: '增益类',
    designerSubHint: '前摇',
    设计台参数定义: [num('gainRatio', '修正数值', '-20%'), num('duration', '持续回合', '2', '1')],
  });
  register('掌控提升', {
    说明: '按倍率提升技能掌控度。',
    可主机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '辅助', mainType: '增益类' },
    designerMainHint: '增益类',
    designerSubHint: '掌控提升',
    设计台参数定义: [num('gainRatio', '提升倍率', '1.2'), num('duration', '持续回合', '3', '1')],
  });
  register('速度提升', {
    说明: '按倍率提升速度相关判定。',
    可主机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '辅助', mainType: '增益类' },
    designerMainHint: '增益类',
    designerSubHint: '速度提升',
    设计台参数定义: [num('gainRatio', '提升倍率', '1.15'), num('duration', '持续回合', '2', '1')],
  });
  register('修炼增益', {
    说明: '提升战斗外的修炼收益。',
    可主机制: true,
    可副机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '辅助', mainType: '增益类', effectMode: '持续' },
    designerMainHint: '增益类',
    designerSubHint: '修炼增益',
    designerSecondaryHint: '修炼增益',
    设计台参数定义: [num('收益倍率', '收益倍率', '1.2'), num('duration', '持续回合', '6', '1')],
  });
  register(['护盾', '小护盾'], {
    说明: '为目标附加一层护盾，优先承受伤害。',
    可主机制: true,
    可副机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '防御', mainType: '防御类', defenseNature: '护盾', effectMode: '持续' },
    designerMainHint: '防御类',
    designerSubHint: '护盾',
    designerSecondaryHint: '小护盾',
    设计台参数定义: [
      num('shieldRatio', '护盾倍率', '0.8'),
      num('duration', '持续回合', '2', '1'),
      select('shieldCap', '护盾上限', 'SHIELD_CAP'),
    ],
  });
  register('承伤修正', {
    说明: '修改目标受到伤害的倍率。',
    可主机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '防御', mainType: '防御类', defenseNature: '承伤修正', effectMode: '持续' },
    designerMainHint: '防御类',
    designerSubHint: '承伤修正',
    设计台参数定义: [
      num('reduceRatio', '承伤修正', '0.35'),
      num('duration', '持续回合', '2', '1'),
      text('damageType', '覆盖类型', '物理 / 元素 / 全伤'),
    ],
  });
  register('免伤', {
    说明: '在触发条件下完全免除若干次伤害。',
    可主机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '防御', mainType: '防御类', defenseNature: '免伤', effectMode: '触发' },
    designerMainHint: '防御类',
    designerSubHint: '免伤',
    设计台参数定义: [
      num('blockCount', '免伤次数', '1', '1'),
      text('blockCap', '单次上限', '最多抵消一次大招'),
      text('triggerRule', '触发条件', '受击瞬间'),
    ],
  });
  register('霸体', {
    说明: '在持续期内免疫指定级别以下的控制。',
    可主机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '防御', mainType: '防御类', defenseNature: '霸体', effectMode: '持续' },
    designerMainHint: '防御类',
    designerSubHint: '霸体',
    设计台参数定义: [
      num('duration', '持续回合', '2', '1'),
      select('immuneLevel', '免控级别', 'IMMUNE_LEVEL'),
      num('reduceRatio', '额外减伤', '0.2'),
    ],
  });
  register(['免死', '免死/锁血'], {
    说明: '生命降到阈值时锁血不死。',
    可主机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '防御', mainType: '防御类', defenseNature: '免死', effectMode: '触发' },
    designerMainHint: '防御类',
    designerSubHint: '免死/锁血',
    设计台参数定义: [
      text('triggerThreshold', '触发阈值', '低于20%生命'),
      text('lockBloodFloor', '锁血下限', '保留1点 / 10%'),
      num('triggerCount', '触发次数', '1', '1'),
    ],
  });
  register('无敌金身', {
    说明: '在持续期内完全免疫伤害。',
    可主机制: true,
    可副机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '防御', mainType: '防御类', defenseNature: '无视异常', effectMode: '触发' },
    designerMainHint: '防御类',
    designerSubHint: '无敌金身',
    designerSecondaryHint: '无敌金身',
    设计台参数定义: [
      num('duration', '持续回合', '2', '1'),
      num('每日触发次数', '每日触发', '3', '1'),
    ],
  });
  register('伤害反射', {
    说明: '把受到的伤害按比例反弹给攻击者。',
    可主机制: true,
    可副机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '防御', mainType: '防御类', defenseNature: '反射', effectMode: '触发' },
    designerMainHint: '防御类',
    designerSubHint: '伤害反射',
    designerSecondaryHint: '伤害反射',
    设计台参数定义: [
      num('reflectRatio', '反射比例', '0.25'),
      num('duration', '持续回合', '2', '1'),
      text('reflectRule', '触发条件', '受击后'),
    ],
  });
  register('伤害转移', {
    说明: '把受到的伤害按比例转给指定对象。',
    可主机制: true,
    可副机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '防御', mainType: '防御类', defenseNature: '反射', effectMode: '触发' },
    designerMainHint: '防御类',
    designerSubHint: '伤害转移',
    designerSecondaryHint: '伤害转移',
    设计台参数定义: [
      num('transferRatio', '转移比例', '0.25'),
      select('transferTarget', '转移对象', 'DAMAGE_TRANSFER_TARGET'),
      num('duration', '持续回合', '2', '1'),
    ],
  });
  register('伤害分摊', {
    说明: '把受到的伤害按比例分给多名队友承担。',
    可主机制: true,
    可副机制: true,
    目标语义: '可赋予',
    群体赋予: true,
    摘要提示: { skillType: '防御', mainType: '防御类', defenseNature: '分摊', cooperation: '高', effectMode: '触发' },
    designerMainHint: '防御类',
    designerSubHint: '伤害分摊',
    designerSecondaryHint: '伤害分摊',
    设计台参数定义: [
      num('shareRatio', '分摊比例', '0.35'),
      num('shareCount', '分摊人数', '1', '1'),
      num('duration', '持续回合', '2', '1'),
    ],
  });
  register('消耗分摊', {
    说明: '把技能消耗按比例分给多名队友承担。',
    可主机制: true,
    可副机制: true,
    目标语义: '可赋予',
    群体赋予: true,
    摘要提示: { skillType: '防御', mainType: '防御类', defenseNature: '分摊', cooperation: '高', effectMode: '触发' },
    designerMainHint: '防御类',
    designerSubHint: '消耗分摊',
    designerSecondaryHint: '消耗分摊',
    设计台参数定义: [
      num('shareRatio', '分摊比例', '0.35'),
      num('shareCount', '分摊人数', '1', '1'),
      num('duration', '持续回合', '2', '1'),
    ],
  });
  register('体力恢复', {
    说明: '按倍率回复体力。',
    可主机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '辅助', mainType: '回复类', recoverNature: '体力恢复' },
    designerMainHint: '回复类',
    designerSubHint: '体力恢复',
    设计台参数定义: [num('recoverRatio', '回复倍率', '0.35'), num('repeatCount', '生效次数', '1', '1')],
  });
  register('魂力恢复', {
    说明: '按倍率回复魂力。',
    可主机制: true,
    可副机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '辅助', mainType: '回复类', recoverNature: '资源回复' },
    designerMainHint: '回复类',
    designerSubHint: '魂力恢复',
    designerSecondaryHint: '魂力恢复',
    设计台参数定义: [num('recoverRatio', '回复倍率', '0.35'), num('repeatCount', '生效次数', '1', '1')],
  });
  register('精神恢复', {
    说明: '按倍率回复精神力。',
    可主机制: true,
    可副机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '辅助', mainType: '回复类', recoverNature: '资源回复' },
    designerMainHint: '回复类',
    designerSubHint: '精神恢复',
    designerSecondaryHint: '精神恢复',
    设计台参数定义: [num('recoverRatio', '回复倍率', '0.35'), num('repeatCount', '生效次数', '1', '1')],
  });
  register('持续恢复', {
    说明: '挂上持续回复状态，之后每回合按倍率回血。',
    可主机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '辅助', mainType: '回复类', recoverNature: '持续恢复', effectMode: '持续' },
    designerMainHint: '回复类',
    designerSubHint: '持续恢复',
    设计台参数定义: [
      num('recoverRatio', '每回合倍率', '0.2'),
      num('duration', '持续回合', '3', '1'),
      num('stackLimit', '叠层上限', '2', '1'),
    ],
  });
  register(['净化/解控', '净化', '解控'], {
    说明: '清除目标身上的负面状态。',
    可主机制: true,
    可副机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '辅助', mainType: '回复类', recoverNature: '净化' },
    designerMainHint: '回复类',
    designerSubHint: '净化/解控',
    designerSecondaryHint: '解控',
    设计台参数定义: [
      num('cleanseCount', '清除条目数', '2', '1'),
      select('cleansePriority', '净化优先级', 'CLEANSE_PRIORITY'),
      select('extraGain', '附带收益', 'CLEANSE_GAIN'),
    ],
  });
  register('感知干扰', {
    说明: '干扰目标的感知，使其判断出现偏差。',
    可主机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '感知/认知类', controlStrength: '软控' },
    designerMainHint: '感知/认知类',
    designerSubHint: '感知干扰',
    设计台参数定义: [num('disturbPower', '干扰强度', '0.12'), num('duration', '持续回合', '2', '1')],
  });
  register('标记锁定', {
    说明: '标记目标并持续追踪，使其难以脱离。',
    可主机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '感知/认知类', controlStrength: '软控' },
    designerMainHint: '感知/认知类',
    designerSubHint: '标记锁定',
    设计台参数定义: [
      num('markDuration', '标记时长', '2', '1'),
      num('targetCap', '锁定目标数', '1', '1'),
      select('trackingRule', '追踪规则', 'TRACKING_RULE'),
    ],
  });
  register('共享视野', {
    说明: '把自己的视野共享给队友。',
    可主机制: true,
    可副机制: true,
    目标语义: '上下文',
    摘要提示: { skillType: '辅助', mainType: '感知/认知类', cooperation: '高', effectMode: '持续' },
    designerMainHint: '感知/认知类',
    designerSubHint: '共享视野',
    designerSecondaryHint: '共享视野',
    设计台参数定义: [
      text('shareRange', '共享范围', '队伍 / 半径30米'),
      num('duration', '持续回合', '3', '1'),
      select('infoDepth', '共享深度', 'INFO_DEPTH'),
    ],
  });
  register('幻境', {
    说明: '在范围内制造幻境，影响其中单位的认知。',
    可主机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '感知/认知类', controlStrength: '硬控' },
    designerMainHint: '感知/认知类',
    designerSubHint: '幻境',
    设计台参数定义: [
      text('illusionRange', '幻境范围', '半径8米'),
      num('duration', '持续回合', '2', '1'),
      num('illusionPower', '幻术强度', '1.1'),
    ],
  });
  register('催眠', {
    说明: '使目标进入睡眠，直到满足唤醒条件。',
    可主机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '感知/认知类', controlStrength: '硬控' },
    designerMainHint: '感知/认知类',
    designerSubHint: '催眠',
    设计台参数定义: [
      num('duration', '睡眠回合', '2', '1'),
      select('wakeRule', '唤醒条件', 'WAKE_RULE'),
      text('hitRule', '命中条件', '视线锁定 / 声波接触'),
    ],
  });
  register('认知扭曲', {
    说明: '扭曲目标的认知，使其误判局势。',
    可主机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '感知/认知类', controlStrength: '软控' },
    designerMainHint: '感知/认知类',
    designerSubHint: '认知扭曲',
    设计台参数定义: [num('twistPower', '扭曲强度', '0.18'), num('duration', '持续回合', '2', '1')],
  });
  register('目标锁定', {
    说明: '锁定目标，提升对其的命中。',
    可副机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '感知/认知类', controlStrength: '软控' },
    designerMainHint: '感知/认知类',
    designerSubHint: '标记锁定',
    designerSecondaryHint: '目标锁定',
    设计台参数定义: [
      num('duration', '持续回合', '2', '1'),
      num('hitBonus', '命中增益', '0.1'),
      num('lockLevel', '锁定强度', '1', '1'),
    ],
  });
  register('自身位移', {
    说明: '让自己移动一段距离。',
    可主机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '辅助', mainType: '位移类', effectMode: '持续' },
    designerMainHint: '位移类',
    designerSubHint: '自身位移',
    设计台参数定义: [text('moveDistance', '位移幅度', '5米')],
  });
  register('强制位移', {
    说明: '强制移动目标。',
    可主机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '位移类', controlStrength: '软控' },
    designerMainHint: '位移类',
    designerSubHint: '强制位移',
    设计台参数定义: [text('moveDistance', '位移幅度', '4米')],
  });
  register('位移交换', {
    说明: '与目标交换位置。',
    可主机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '位移类', controlStrength: '软控' },
    designerMainHint: '位移类',
    designerSubHint: '位移交换',
    设计台参数定义: [
      text('exchangeRange', '交换范围', '8米'),
      num('duration', '持续回合', '2', '1'),
      text('triggerRule', '交换条件', '命中标记目标'),
    ],
  });
  register('追击位移', {
    说明: '在追击窗口内贴近目标并追加结算。',
    可主机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '位移类', effectMode: '持续' },
    designerMainHint: '位移类',
    designerSubHint: '追击位移',
    设计台参数定义: [
      text('moveDistance', '追击距离', '6米'),
      text('followWindow', '追击窗口', '命中后1秒'),
      num('extraRatio', '追加倍率', '0.3'),
    ],
  });
  register('脱离位移', {
    说明: '拉开与目标的距离。',
    可主机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '辅助', mainType: '位移类', effectMode: '持续' },
    designerMainHint: '位移类',
    designerSubHint: '脱离位移',
    设计台参数定义: [
      text('moveDistance', '脱离距离', '7米'),
      text('escapeRule', '脱离条件', '生命低于50%'),
      select('extraGain', '脱离收益', 'ESCAPE_GAIN'),
    ],
  });
  register(['追击'], {
    说明: '在追击窗口内对目标追加一次结算。',
    可副机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '辅助', mainType: '位移类', effectMode: '持续' },
    designerMainHint: '位移类',
    designerSubHint: '追击位移',
    designerSecondaryHint: '追击',
    设计台参数定义: [
      text('followWindow', '追击窗口', '命中后1秒'),
      num('bonusRatio', '追击倍率', '1.2'),
      num('duration', '持续回合', '2', '1'),
    ],
  });
  register('分身', {
    说明: '生成分身协同作战。',
    可主机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '防御', mainType: '特殊规则类', defenseNature: '分身', effectMode: '持续' },
    designerMainHint: '特殊规则类',
    designerSubHint: '分身',
    设计台参数定义: [
      select('cloneType', '分身类型', 'CLONE_TYPE'),
      num('cloneCount', '分身数量', '2', '1'),
      num('stealthRatio', '隐蔽度', '0.45'),
      num('inheritRatio', '实力继承', '0.55'),
      num('duration', '持续回合', '2', '1'),
      text('cloneName', '分身称谓', '影分身 / 心像'),
    ],
  });
  register('复制', {
    可主机制: true,
    目标语义: '上下文',
    摘要提示: { skillType: '辅助', mainType: '特殊规则类' },
    说明: '复制技能、属性或整套能力；即时镜像响应战斗动作，复刻友方需剧情裁定。',
    designerMainHint: '特殊规则类',
    designerSubHint: '复制',
    设计台参数定义: [
      select('copyTarget', '复制类型', 'COPY_TARGET'),
      select('copyMode', '复制模式', 'COPY_MODE'),
      num('saveLimit', '保存上限', '1', '1'),
      num('reductionRatio', '削减比例', '0.2'),
      num('useCount', '可用次数', '1', '1'),
      num('duration', '持续回合', '2', '1'),
      num('keepDurationTick', '保留时长tick', '144', '1'),
    ],
  });
  register('召唤', {
    可主机制: true,
    目标语义: '仅自身',
    仅自身: true,
    摘要提示: { skillType: '辅助', mainType: '特殊规则类', cooperation: '高', effectMode: '持续' },
    说明: '在战斗内临时生成召唤物协同作战。',
    designerMainHint: '特殊规则类',
    designerSubHint: '召唤',
    设计台参数定义: [
      select('召唤单位类型', '召唤单位类型', 'SUMMON_UNIT_TYPE'),
      text('summonName', '召唤物名称', '本命召唤兽'),
      num('summonCount', '召唤数量', '1', '1'),
      num('召唤强度', '固定强度', '1.0'),
      num('力量继承比例', '力量继承', '0.45', '0.01'),
      num('防御继承比例', '防御继承', '0.45', '0.01'),
      num('敏捷继承比例', '敏捷继承', '0.45', '0.01'),
      num('体力继承比例', '体力继承', '0.45', '0.01'),
      num('魂力继承比例', '魂力继承', '0.45', '0.01'),
      num('精神继承比例', '精神继承', '0.45', '0.01'),
      num('duration', '持续回合', '3', '1'),
      select('summonMode', '行动模式', 'SUMMON_ACTION_MODE'),
      select('damageRule', '承伤规则', 'SUMMON_DAMAGE_RULE'),
    ],
  });
  register('反制', {
    说明: '在触发条件下反制目标的指定行为。',
    可主机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '防御', mainType: '特殊规则类', defenseNature: '反制', effectMode: '触发' },
    designerMainHint: '特殊规则类',
    designerSubHint: '反制',
    设计台参数定义: [
      select('counterTarget', '反制对象', 'COUNTER_TARGET'),
      text('triggerRule', '触发条件', '被锁定时 / 命中前'),
      num('duration', '持续回合', '2', '1'),
      num('counterRatio', '反制倍率', '1.0'),
    ],
  });
  register(['转化', '伤害转回复'], {
    说明: '把伤害按比率转成回复。',
    可主机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '辅助', mainType: '特殊规则类' },
    designerMainHint: '特殊规则类',
    designerSubHint: '转化',
    设计台参数定义: [text('convertPath', '转化方向', '伤害→回复'), num('convertRatio', '转化比率', '0.6')],
  });
  register('回复转伤害', {
    说明: '把回复按比率转成伤害。',
    可主机制: false,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '特殊规则类' },
    designerMainHint: '特殊规则类',
    designerSubHint: '转化',
    设计台参数定义: [text('convertPath', '转化方向', '回复→伤害'), num('convertRatio', '转化比率', '0.6')],
  });
  register('状态交换', {
    说明: '与目标交换身上的状态。',
    可主机制: true,
    目标语义: '上下文',
    摘要提示: { skillType: '辅助', mainType: '特殊规则类' },
    designerMainHint: '特殊规则类',
    designerSubHint: '状态交换',
    设计台参数定义: [
      select('状态', '交出状态', '状态'),
      num('duration', '持续回合', '1', '1'),
    ],
  });
  register('状态转移', {
    说明: '把状态从一方转移到另一方。',
    可主机制: true,
    可副机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '特殊规则类' },
    designerMainHint: '特殊规则类',
    designerSubHint: '状态转移',
    designerSecondaryHint: '状态转移',
    设计台参数定义: [
      select('状态', '状态筛选', '状态'),
      select('来源', '来源', '', '未设置', { options: ['自身', '目标', '友方', '敌方'] }),
      select('去向', '去向', '', '未设置', { options: ['自身', '目标', '友方', '敌方'] }),
      num('数量', '数量', '1', '1'),
      num('duration', '持续回合', '1', '1'),
    ],
  });
  register('强制绑定/锁定', {
    说明: '把目标与自己强制绑定，直到满足解除条件。',
    可主机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '特殊规则类', controlStrength: '软控' },
    designerMainHint: '特殊规则类',
    designerSubHint: '强制绑定/锁定',
    设计台参数定义: [
      num('bindDuration', '绑定回合', '2', '1'),
      num('targetCap', '绑定目标数', '1', '1'),
      text('releaseRule', '解除条件', '超距离 / 净化'),
    ],
  });
  register('规则改写', {
    可主机制: true,
    可副机制: true,
    目标语义: '上下文',
    摘要提示: { skillType: '控制', mainType: '特殊规则类', effectMode: '规则' },
    说明: '临时改写指定战斗规则，支持缴械或死亡转存活。',
    designerMainHint: '特殊规则类',
    designerSubHint: '规则改写',
    designerSecondaryHint: '规则改写',
    设计台参数定义: [
      select('rewriteRule', '规则', 'RULE_REWRITE'),
      num('rewriteValue', '复活恢复比例', '25%'),
      num('duration', '规则持续回合', '1', '1'),
    ],
  });
  register('战斗外复活', {
    可主机制: false,
    可副机制: false,
    目标语义: '可赋予',
    摘要提示: { skillType: '辅助', mainType: '战斗外' },
    说明: '战斗外复活意外死亡目标，并按代价与复活后状态写回日常状态。',
    designerMainHint: '战斗外',
    designerSubHint: '战斗外复活',
    designerSecondaryHint: '战斗外复活',
    设计台参数定义: [],
  });
  register('威力增幅', {
    可主机制: true,
    可副机制: true,
    目标语义: '可赋予',
    群体赋予: true,
    摘要提示: { skillType: '辅助', mainType: '增益类' },
    说明: '提升技能最终威力；可配合限定元素只增幅对应元素技能，高阶主要提升倍率和覆盖对象。',
    designerMainHint: '增益类',
    designerSubHint: '威力增幅',
    designerSecondaryHint: '威力增幅',
    设计台参数定义: [num('finalDamageMult', '威力倍率', '1.2'), text('limitedElements', '限定元素', '火,水,风')],
  });
  register('技能效果增幅', {
    可主机制: true,
    可副机制: true,
    目标语义: '可赋予',
    群体赋予: true,
    摘要提示: { skillType: '辅助', mainType: '增益类', effectMode: '持续' },
    说明: '提升后续技能效果；若技能同时存在数量字段和效果数值，优先增幅数量字段。倍率可按技能自由填写。',
    designerMainHint: '增益类',
    designerSubHint: '技能效果增幅',
    designerSecondaryHint: '技能效果增幅',
    设计台参数定义: [num('effectMult', '效果倍率', '1.5'), num('duration', '持续回合', '2', '1')],
  });
  register('元素封禁', {
    可主机制: true,
    可副机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '削弱类' },
    说明: '压制指定元素技能；当前结算为命中元素时降低威力并提高消耗/前摇，强度受品质和实力差缩放。',
    designerMainHint: '削弱类',
    designerSubHint: '元素封禁',
    designerSecondaryHint: '元素封禁',
    设计台参数定义: [text('limitedElements', '封禁元素', '火,冰,雷'), num('sealRatio', '封禁强度', '0.35')],
  });
  register('时光回溯', {
    可主机制: true,
    可副机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '防御', mainType: '特殊规则类' },
    说明: '主动释放时压低目标反应；被动登记目标结算前回溯规避，触发后回到本回合开始战斗态并阻断本次落地。',
    designerMainHint: '特殊规则类',
    designerSubHint: '时光回溯',
    designerSecondaryHint: '时光回溯',
    设计台参数定义: [],
  });
  register('气运干涉', {
    可主机制: true,
    可副机制: true,
    目标语义: '上下文',
    摘要提示: { skillType: '辅助', mainType: '特殊规则类' },
    说明: '正负修正战斗概率判定；当前结算会影响命中偏转、打断等概率型判定。',
    designerMainHint: '特殊规则类',
    designerSubHint: '气运干涉',
    designerSecondaryHint: '气运干涉',
    设计台参数定义: [num('luckModifier', '气运修正', '0.12')],
  });
  register('自身也受影响', {
    说明: '让本次效果同时作用于自己。',
    目标语义: '仅自身',
    仅自身: true,
    摘要提示: { skillType: '辅助', mainType: '特殊规则类' },
  });
  register('自残换收益', {
    说明: '以自身代价换取更强的效果。',
    目标语义: '仅自身',
    仅自身: true,
    摘要提示: { skillType: '辅助', mainType: '特殊规则类' },
  });
  register('炸环', {
    可主机制: true,
    可副机制: true,
    目标语义: '仅自身',
    仅自身: true,
    摘要提示: { skillType: '辅助', mainType: '特殊规则类' },
    说明: '战斗中选择并炸掉魂环，按魂环年限强化下一次魂技。',
    designerMainHint: '特殊规则类',
    designerSubHint: '炸环',
    designerSecondaryHint: '炸环',
    设计台参数定义: [num('burstEnhanceRatio', '强化倍率', '100')],
  });
  register('引爆持续伤害', {
    说明: '立刻引爆目标身上的持续伤害。',
    可主机制: true,
    可副机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '输出', mainType: '特殊规则类', effectMode: '瞬发' },
    designerMainHint: '特殊规则类',
    designerSubHint: '引爆持续伤害',
    designerSecondaryHint: '引爆持续伤害',
    设计台参数定义: [num('detonateRatio', '引爆倍率', '1.2'), text('consumeMode', '消耗规则', '消耗全部持续伤害')],
  });
  register('斩盾', {
    说明: '削除目标的护盾。',
    可主机制: true,
    可副机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '输出', mainType: '特殊规则类' },
    designerMainHint: '特殊规则类',
    designerSubHint: '斩盾',
    designerSecondaryHint: '斩盾',
    设计台参数定义: [],
  });
  register('吞噬', {
    说明: '吞噬目标资源并按比例转化给自己。',
    可主机制: true,
    可副机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '特殊规则类', controlStrength: '软控' },
    designerMainHint: '特殊规则类',
    designerSubHint: '吞噬',
    designerSecondaryHint: '吞噬',
    设计台参数定义: [
      select('resourceType', '吞噬资源', 'RESOURCE_TRANSFER_TYPE'),
      num('drainRatio', '吞噬比例', '0.18'),
      num('convertRatio', '转化比例', '1.0'),
    ],
  });
  register('能力共享', {
    说明: '把自己的资源按比例共享给队友。',
    可主机制: true,
    可副机制: true,
    目标语义: '可赋予',
    群体赋予: true,
    摘要提示: { skillType: '辅助', mainType: '回复类', recoverNature: '资源回复', cooperation: '高' },
    designerMainHint: '特殊规则类',
    designerSubHint: '能力共享',
    designerSecondaryHint: '能力共享',
    设计台参数定义: [
      select('resourceType', '共享资源', 'RESOURCE_TRANSFER_TYPE'),
      num('refeedRatio', '共享比例', '0.2'),
    ],
  });
  register('机制抹消', {
    说明: '抹消目标身上指定的机制。',
    可主机制: true,
    可副机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '特殊规则类', controlStrength: '软控', effectMode: '持续' },
    designerMainHint: '特殊规则类',
    designerSubHint: '机制抹消',
    designerSecondaryHint: '机制抹消',
    设计台参数定义: [
      text('suppressObject', '抹消对象', '{"原型":"机制授予"}'),
    ],
  });
  register('驱散增益', {
    说明: '移除目标身上指定数量的增益状态。',
    可副机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '削弱类' },
    designerMainHint: '削弱类',
    designerSubHint: '单属性削弱',
    designerSecondaryHint: '驱散增益',
    设计台参数定义: [num('dispelCount', '驱散数量', '1', '1')],
  });
  register('窃取增益', {
    说明: '夺取目标身上的增益状态。',
    可副机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '特殊规则类' },
    designerMainHint: '特殊规则类',
    designerSubHint: '复制',
    designerSecondaryHint: '窃取增益',
    设计台参数定义: [num('stealCount', '窃取数量', '1', '1')],
  });
  register('隐身', {
    说明: '进入隐匿状态，直到持续结束或被破隐。',
    可副机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '辅助', mainType: '增益类', effectMode: '持续' },
    designerMainHint: '增益类',
    designerSubHint: '单属性增益',
    designerSecondaryHint: '隐身',
    设计台参数定义: [
      num('duration', '持续回合', '2', '1'),
    ],
  });
  register('护卫', {
    说明: '替被护卫者承受伤害。',
    可主机制: true,
    可副机制: true,
    目标语义: '可赋予',
    群体赋予: true,
    摘要提示: { skillType: '防御', mainType: '防御类', cooperation: '高', effectMode: '持续' },
    designerMainHint: '防御类',
    designerSubHint: '伤害分摊',
    designerSecondaryHint: '护卫',
    设计台参数定义: [num('duration', '持续回合', '2', '1'), num('reduceRatio', '护卫减伤', '0.1')],
  });
  register('嘲讽', {
    说明: '强制目标优先攻击自己。',
    可副机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '控制类', controlStrength: '软控' },
    designerMainHint: '控制类',
    designerSubHint: '软控',
    designerSecondaryHint: '嘲讽',
    设计台参数定义: [num('duration', '持续回合', '2', '1'), text('focusRule', '聚火规则', '强制优先自身')],
  });
  register('破隐', {
    说明: '使目标脱离隐匿状态。',
    可副机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '控制类' },
    designerMainHint: '控制类',
    designerSubHint: '节奏打断',
    designerSecondaryHint: '破隐',
    设计台参数定义: [],
  });
  register('减速', {
    说明: '降低目标的行动速度。',
    可副机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '控制类', controlStrength: '软控' },
    designerMainHint: '控制类',
    designerSubHint: '软控',
    designerSecondaryHint: '减速',
    设计台参数定义: [num('slowRatio', '减速幅度', '0.3'), num('duration', '持续回合', '2', '1')],
  });
  register('迟缓', {
    说明: '拉长目标的出手间隔。',
    可主机制: true,
    可副机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '控制类', controlStrength: '软控' },
    designerMainHint: '控制类',
    designerSubHint: '软控',
    designerSecondaryHint: '迟缓',
    设计台参数定义: [num('slowRatio', '迟缓幅度', '0.3'), num('duration', '持续回合', '2', '1')],
  });
  register('致盲', {
    说明: '让目标在持续期内命中大幅下降。',
    可副机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '控制类', controlStrength: '软控' },
    designerMainHint: '控制类',
    designerSubHint: '软控',
    designerSecondaryHint: '致盲',
    设计台参数定义: [num('duration', '致盲回合', '2', '1'), select('blindEffect', '影响内容', 'BLIND_EFFECT')],
  });
  // v3 阶段 7：'沉默'已删除（与'封技'语义重合，统一走封技）。BattleUI 内残留硬编码作为兼容白名单保留，旧档自动迁移
  register('标记弱点', {
    说明: '给目标挂上弱点标记，使后续结算对其更有效。',
    可副机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '削弱类' },
    designerMainHint: '削弱类',
    designerSubHint: '单属性削弱',
    designerSecondaryHint: '标记弱点',
    设计台参数定义: [select('weakPointType', '弱点类型', 'WEAK_POINT_TYPE'), num('duration', '持续回合', '2', '1')],
  });
  register('斩杀补伤', {
    可副机制: true,
    目标语义: '敌对',
    说明: '目标血量低于触发血线时，追加一次结算。',
    摘要提示: { skillType: '输出', mainType: '伤害类' },
    designerMainHint: '伤害类',
    designerSubHint: '单体伤害',
    designerSecondaryHint: '斩杀补伤',
    设计台参数定义: [text('executeLine', '触发血线', '低于25%'), num('bonusRatio', '补伤倍率', '0.5')],
  });
  register('穿透', {
    可副机制: true,
    目标语义: '敌对',
    说明: '让本次伤害忽略目标一部分防御，不是额外伤害。',
    摘要提示: { skillType: '输出', mainType: '伤害类' },
    designerMainHint: '伤害类',
    designerSubHint: '单体伤害',
    designerSecondaryHint: '穿透',
    设计台参数定义: [
      num('penetrationRatio', '穿透比例', '0.25'),
      select('penetrationTarget', '穿透对象', 'PENETRATION_TARGET'),
    ],
  });
  register('伤害吸收', {
    可副机制: true,
    目标语义: '上下文',
    说明: '把伤害按比例转成自己的资源。',
    摘要提示: { skillType: '输出', mainType: '伤害类' },
    designerMainHint: '伤害类',
    designerSubHint: '单体伤害',
    designerSecondaryHint: '伤害吸收',
    设计台参数定义: [
      num('absorbRatio', '吸收比例', '0.2'),
      select('absorbSource', '吸收来源', 'ABSORB_SOURCE'),
      select('resourceType', '吸收资源', 'ABSORB_RESOURCE'),
    ],
  });
  register('流血DOT', {
    可副机制: true,
    目标语义: '敌对',
    说明: '主效果命中后追加持续创伤，每回合掉血。',
    摘要提示: { skillType: '输出', mainType: '伤害类', effectMode: '持续' },
    designerMainHint: '伤害类',
    designerSubHint: '持续伤害',
    designerSecondaryHint: '流血DOT',
    设计台参数定义: [num('dotRatio', '每跳倍率', '20'), num('duration', '持续回合', '3', '1')],
  });
  register('生命链接', {
    说明: '与目标建立生命链接，按比例分摊伤害。',
    可主机制: true,
    可副机制: true,
    目标语义: '上下文',
    摘要提示: { skillType: '防御', mainType: '特殊规则类', defenseNature: '分摊', cooperation: '高', effectMode: '持续' },
    designerMainHint: '特殊规则类',
    designerSubHint: '生命链接',
    designerSecondaryHint: '生命链接',
    设计台参数定义: [
      num('shareRatio', '分摊比例', '0.35'),
      num('duration', '持续回合', '3', '1'),
      text('linkRule', '链接规则', '双方同步承受比例伤害'),
    ],
  });
  register('延长持续伤害', {
    说明: '延长目标身上持续伤害的回合。',
    可主机制: true,
    可副机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '特殊规则类', effectMode: '持续' },
    designerMainHint: '特殊规则类',
    designerSubHint: '延长持续伤害',
    designerSecondaryHint: '延长持续伤害',
    设计台参数定义: [
      num('extendRounds', '延长回合', '1', '1'),
      num('stackDelta', '层数变化', '0', '1'),
      text('scope', '作用范围', '目标全部DOT'),
    ],
  });
  register('压缩持续伤害', {
    说明: '把持续伤害压缩成更短更高的形态。',
    可主机制: true,
    可副机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '输出', mainType: '特殊规则类', effectMode: '瞬发' },
    designerMainHint: '特殊规则类',
    designerSubHint: '压缩持续伤害',
    designerSecondaryHint: '压缩持续伤害',
    设计台参数定义: [
      num('compressRatio', '压缩倍率', '1.35'),
      num('consumeRounds', '压缩回合', '1', '1'),
      text('convertRule', '转化规则', '将后续DOT折算为本回合伤害'),
    ],
  });
  register('资源燃烧', {
    说明: '让目标每回合持续损失指定资源。',
    可主机制: true,
    可副机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '特殊规则类', controlStrength: '软控', effectMode: '持续' },
    designerMainHint: '特殊规则类',
    designerSubHint: '资源燃烧',
    designerSecondaryHint: '资源燃烧',
    设计台参数定义: [
      select('resourceType', '燃烧资源', 'RESOURCE_TRANSFER_TYPE'),
      num('burnRatio', '每回合燃烧', '0.12'),
      num('duration', '持续回合', '2', '1'),
    ],
  });
  register('资源锁定', {
    说明: '锁定目标的资源，使其无法回复或使用。',
    可主机制: true,
    可副机制: true,
    目标语义: '敌对',
    摘要提示: { skillType: '控制', mainType: '特殊规则类', controlStrength: '软控', effectMode: '持续' },
    designerMainHint: '特殊规则类',
    designerSubHint: '资源锁定',
    designerSecondaryHint: '资源锁定',
    设计台参数定义: [
      select('lockType', '锁定类型', 'RESOURCE_LOCK_TYPE'),
      select('resourceType', '锁定资源', 'RESOURCE_TRANSFER_TYPE'),
      num('lockRatio', '锁定比例', '0.5'),
      num('duration', '持续回合', '2', '1'),
    ],
  });
  register(['反击', '受击反击'], {
    说明: '被攻击时按倍率反击攻击者。',
    可副机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '防御', mainType: '防御类', defenseNature: '反制', effectMode: '触发' },
    designerMainHint: '防御类',
    designerSubHint: '伤害反射',
    designerSecondaryHint: '反击',
    设计台参数定义: [select('counterRule', '反击条件', 'COUNTER_RULE'), num('counterRatio', '反击倍率', '0.8')],
  });
  register('机制授予', {
    说明: '把一组效果授予目标，在触发条件下生效。',
    可主机制: false,
    可副机制: true,
    目标语义: '可赋予',
    摘要提示: { skillType: '辅助', mainType: '特殊规则类', cooperation: '高', effectMode: '触发' },
    designerMainHint: '特殊规则类',
    designerSubHint: '机制授予',
    designerSecondaryHint: '机制授予',
    设计台参数定义: [select('grantTrigger', '触发条件', 'MECHANISM_GRANT_TRIGGER'), num('useCount', '可用次数', '1', '1'), num('duration', '持续回合', '1', '1')],
  });
  register('等级提升', {
    说明: '战斗外主动将目标提升至当前合法等级序列的下一等级，并受等级上限与冷却约束。',
    可主机制: false,
    可副机制: true,
    目标语义: '仅自身',
    仅自身: true,
    摘要提示: { skillType: '辅助', mainType: '特殊规则类', effectMode: '瞬发' },
    designerMainHint: '特殊规则类',
    designerSubHint: '等级提升',
    designerSecondaryHint: '等级提升',
    设计台参数定义: [],
  });
  register('群体撤离', {
    说明: '战斗外按人数倍率执行一次群体撤离，所有成员共享同一次成败结果。',
    可主机制: false,
    可副机制: true,
    目标语义: '上下文',
    摘要提示: { skillType: '辅助', mainType: '特殊规则类', cooperation: '高', effectMode: '瞬发' },
    designerMainHint: '特殊规则类',
    designerSubHint: '群体撤离',
    designerSecondaryHint: '群体撤离',
    设计台参数定义: [],
  });
  return Object.freeze(map);
})();

function buildSkillMechanismTargetSemanticsV1(metaMap = {}) {
  const 可赋予 = [];
  const 群体赋予 = [];
  const 敌对 = [];
  const 上下文 = [];
  const 仅自身 = [];
  Object.entries(metaMap || {}).forEach(([label, meta]) => {
    if (!meta || typeof meta !== 'object') return;
    if (meta.仅自身 === true || meta.目标语义 === '仅自身') 仅自身.push(label);
    if (meta.群体赋予 === true) 群体赋予.push(label);
    if (meta.目标语义 === '可赋予') 可赋予.push(label);
    else if (meta.目标语义 === '敌对') 敌对.push(label);
    else if (meta.目标语义 === '上下文') 上下文.push(label);
  });
  return Object.freeze({
    可赋予: Object.freeze(Array.from(new Set(可赋予)).sort()),
    群体赋予: Object.freeze(Array.from(new Set(群体赋予)).sort()),
    敌对: Object.freeze(Array.from(new Set(敌对)).sort()),
    上下文: Object.freeze(Array.from(new Set(上下文)).sort()),
    仅自身: Object.freeze(Array.from(new Set(仅自身)).sort()),
  });
}

var SKILL_MECHANISM_TARGET_SEMANTICS_V1 = buildSkillMechanismTargetSemanticsV1(SKILL_MECHANISM_META_V1);
var SKILL_MECHANISM_SELF_ONLY_V1 = SKILL_MECHANISM_TARGET_SEMANTICS_V1.仅自身;

var 原型编译条目 = (原型, 默认字段 = {}) => Object.freeze({ 原型, ...默认字段 });

var SKILL_MECHANISM_NAME_TO_PROTOTYPES_V1 = Object.freeze({
  直接伤害: [原型编译条目('伤害结算')],
  单体伤害: [原型编译条目('伤害结算')],
  群体伤害: [原型编译条目('伤害结算')],
  多段伤害: [原型编译条目('伤害结算')],
  持续伤害: [原型编译条目('状态施加', { 状态: '持续创伤' })],
  硬控: [原型编译条目('状态施加', { 状态: '眩晕' })],
  软控: [原型编译条目('判定修正', { 判定: '反应', 数值: '-12%' }), 原型编译条目('判定修正', { 判定: '闪避', 数值: '-10%' }), 原型编译条目('结算修正', { 结算: '前摇', 数值: '+10%' })],
  节奏打断: [原型编译条目('判定修正', { 判定: '反应', 数值: '-100%', 打断效果: true })],
  打断: [原型编译条目('判定修正', { 判定: '反应', 数值: '-100%', 打断效果: true })],
  封技: [原型编译条目('状态施加', { 状态: '封技' })],
  单属性削弱: [原型编译条目('属性修正')],
  多属性削弱: [原型编译条目('属性修正')],
  禁疗: [原型编译条目('状态施加', { 状态: '禁疗', 数值: '+40%' })],
  治疗反转: [原型编译条目('状态施加', { 状态: '治疗反转' })],
  掌控压制: [原型编译条目('判定修正', { 判定: '命中', 数值: '-12%' })],
  速度压制: [原型编译条目('属性修正', { 属性: '敏捷' })],
  单属性增益: [原型编译条目('属性修正')],
  多属性增益: [原型编译条目('属性修正')],
  全属性增益: [原型编译条目('属性修正')],
  消耗: [原型编译条目('结算修正', { 结算: '消耗', 数值: '-20%' })],
  前摇: [原型编译条目('结算修正', { 结算: '前摇', 数值: '-20%' })],
  掌控提升: [原型编译条目('判定修正', { 判定: '命中', 数值: '+12%' })],
  速度提升: [原型编译条目('属性修正', { 属性: '敏捷' })],
  修炼增益: [原型编译条目('修炼增益')],
  护盾: [原型编译条目('护盾变化')],
  小护盾: [原型编译条目('护盾变化')],
  承伤修正: [原型编译条目('结算修正', { 结算: '受到伤害', 数值: '-20%' })],
  免伤: [原型编译条目('规则防御', { 规则: '免伤' })],
  霸体: [原型编译条目('状态施加', { 状态: '霸体' })],
  免死: [原型编译条目('规则防御', { 规则: '免死' })],
  '免死/锁血': [原型编译条目('规则防御', { 规则: '免死' })],
  无敌金身: [原型编译条目('状态施加', { 状态: '无视异常' })],
  伤害反射: [原型编译条目('结算修正', { 结算: '反伤', 数值: '+20%' })],
  伤害转移: [原型编译条目('结算修正', { 结算: '伤害转移', 数值: '+20%' })],
  伤害分摊: [原型编译条目('结算修正', { 结算: '伤害分摊', 数值: '+20%' })],
  消耗分摊: [原型编译条目('结算修正', { 结算: '消耗分摊', 数值: '+20%' })],
  体力恢复: [原型编译条目('资源变化', { 资源: '生命' })],
  魂力恢复: [原型编译条目('资源变化', { 资源: '魂力' })],
  精神恢复: [原型编译条目('资源变化', { 资源: '精神力' })],
  持续恢复: [原型编译条目('状态施加', { 状态: '持续恢复' })],
  '净化/解控': [原型编译条目('状态移除', { 状态: '任意负面' })],
  净化: [原型编译条目('状态移除', { 状态: '任意负面' })],
  解控: [原型编译条目('状态移除', { 状态: '任意负面' })],
  感知干扰: [原型编译条目('决策干扰', { 干扰: '索敌干扰' }), 原型编译条目('判定修正', { 判定: '命中', 数值: '-12%' }), 原型编译条目('判定修正', { 判定: '反应', 数值: '-12%' }), 原型编译条目('结算修正', { 结算: '前摇', 数值: '+12%' })],
  标记锁定: [原型编译条目('状态施加', { 状态: '标记', 数值: '-100%' }), 原型编译条目('判定修正', { 判定: '命中', 数值: '+10%' }), 原型编译条目('判定修正', { 判定: '闪避', 数值: '-10%' })],
  共享视野: [原型编译条目('状态施加', { 状态: '共享视野' })],
  幻境: [原型编译条目('状态施加', { 状态: '混乱' }), 原型编译条目('属性修正', { 属性: '敏捷', 数值: '-18%' }), 原型编译条目('判定修正', { 判定: '反应', 数值: '-16%' })],
  催眠: [原型编译条目('状态施加', { 状态: '眩晕' })],
  认知扭曲: [原型编译条目('状态施加', { 状态: '精神紊乱' }), 原型编译条目('决策干扰', { 干扰: '索敌干扰' }), 原型编译条目('判定修正', { 判定: '命中', 数值: '-12%' }), 原型编译条目('结算修正', { 结算: '前摇', 数值: '+12%' })],
  目标锁定: [原型编译条目('状态施加', { 状态: '标记', 数值: '-100%' }), 原型编译条目('判定修正', { 判定: '命中', 数值: '+10%' })],
  自身位移: [原型编译条目('位移执行', { 目标: '自身', 位移类型: '瞬移', 位移对象: '自身' }), 原型编译条目('判定修正', { 目标: '自身', 判定: '闪避' })],
  强制位移: [原型编译条目('位移执行', { 目标: '单体', 位移类型: '击退', 位移对象: '目标', 驱动属性: '魂力上限', 影响方向: '效果强度' }), 原型编译条目('判定修正', { 目标: '单体', 判定: '闪避' })],
  位移交换: [原型编译条目('位移执行', { 目标: '单体', 位移类型: '换位', 位移对象: '自身与目标', 驱动属性: '魂力上限', 影响方向: '效果强度' })],
  追击位移: [原型编译条目('位移执行', { 目标: '单体', 位移类型: '拉近', 位移对象: '自身' }), 原型编译条目('判定修正', { 目标: '单体', 判定: '命中', 数值: '+10%' })],
  脱离位移: [原型编译条目('位移执行', { 目标: '自身', 位移类型: '脱离', 位移对象: '自身' }), 原型编译条目('判定修正', { 目标: '自身', 判定: '闪避' }), 原型编译条目('结算修正', { 目标: '自身', 结算: '前摇', 数值: '-20%' })],
  追击: [原型编译条目('判定修正', { 目标: '单体', 判定: '命中', 数值: '+10%' }), 原型编译条目('结算修正', { 目标: '单体', 结算: '受到伤害', 数值: '+20%' })],
  分身: [原型编译条目('召唤生成', { 召唤物名称: '分身' }), 原型编译条目('判定修正', { 判定: '闪避' }), 原型编译条目('结算修正', { 结算: '受到伤害', 数值: '-20%' })],
  复制: [原型编译条目('复制执行')],
  召唤: [原型编译条目('召唤生成')],
  反制: [原型编译条目('机制授予', { 授予效果: [{ 原型: '结算修正', 目标: '自身', 结算: '反击', 数值: '+20%', 生效方式: '独立生效' }] })],
  转化: [原型编译条目('结算修正', { 结算: '伤害转治疗' })],
  伤害转回复: [原型编译条目('结算修正', { 结算: '伤害转治疗' })],
  回复转伤害: [原型编译条目('结算修正', { 结算: '治疗转伤害' })],
  状态交换: [原型编译条目('状态交换')],
  状态转移: [原型编译条目('状态转移')],
  '强制绑定/锁定': [原型编译条目('状态施加', { 状态: '迟缓', 数值: '-15%', 副数值: '-10%' })],
  规则改写: [原型编译条目('规则改写', { 规则: '缴械' })],
  威力增幅: [原型编译条目('结算修正', { 结算: '造成伤害', 数值: '+20%' })],
  技能效果增幅: [原型编译条目('结算修正', { 结算: '技能效果', 数值: '+20%' })],
  元素封禁: [原型编译条目('状态施加', { 状态: '封技' })],
  时光回溯: [原型编译条目('时光回溯')],
  气运干涉: [原型编译条目('决策干扰', { 干扰: '判断干扰' })],
  自身也受影响: [],
  自残换收益: [],
  炸环: [原型编译条目('炸环')],
  引爆持续伤害: [原型编译条目('结算修正', { 结算: '持续伤害引爆', 数值: '+100%' })],
  斩盾: [原型编译条目('护盾变化', { 数值: '-100%' })],
  吞噬: [原型编译条目('资源转移', { 目标: '单体', 资源转移方式: '吞噬' })],
  能力共享: [原型编译条目('资源转移', { 目标: '单体', 资源转移方式: '共享' })],
  机制抹消: [原型编译条目('机制抹消')],
  驱散增益: [原型编译条目('状态移除', { 状态: '任意增益' })],
  窃取增益: [原型编译条目('状态转移', { 状态: '任意增益', 来源: '目标', 去向: '自身' })],
  隐身: [原型编译条目('状态施加', { 状态: '隐匿' })],
  护卫: [原型编译条目('状态施加', { 状态: '护卫', 数值: '+10%' })],
  嘲讽: [原型编译条目('状态施加', { 状态: '嘲讽' })],
  破隐: [原型编译条目('状态移除', { 状态: '隐匿' }), 原型编译条目('判定修正', { 判定: '命中', 数值: '+8%' })],
  减速: [原型编译条目('属性修正', { 属性: '敏捷' })],
  迟缓: [原型编译条目('状态施加', { 状态: '迟缓' })],
  致盲: [原型编译条目('状态施加', { 状态: '致盲' })],
  沉默: [原型编译条目('状态施加', { 状态: '沉默' })],
  标记弱点: [原型编译条目('结算修正', { 结算: '防御剥夺', 数值: '+20%' }), 原型编译条目('结算修正', { 结算: '精神抗性剥夺', 数值: '+20%' })],
  斩杀补伤: [原型编译条目('伤害结算', { 威力倍率: 50 }), 原型编译条目('结算修正', { 结算: '受到伤害', 数值: '+15%' })],
  穿透: [原型编译条目('结算修正', { 结算: '防御穿透', 数值: '+20%' })],
  伤害吸收: [原型编译条目('结算修正', { 结算: '伤害吸收', 数值: '+20%', 吸收来源: '造成伤害', 吸收资源: '生命' })],
  流血DOT: [原型编译条目('状态施加', { 状态: '持续创伤' })],
  生命链接: [原型编译条目('结算修正', { 结算: '伤害分摊', 数值: '+20%' })],
  延长持续伤害: [原型编译条目('时窗修正', { 调整字段: '持续回合', 调整方式: '延长' })],
  压缩持续伤害: [原型编译条目('时窗修正', { 调整字段: '持续回合', 调整方式: '压缩' })],
  资源燃烧: [原型编译条目('状态施加', { 目标: '单体', 状态: '资源燃烧' })],
  资源锁定: [原型编译条目('资源锁定')],
  反击: [原型编译条目('机制授予', { 授予效果: [{ 原型: '结算修正', 目标: '自身', 结算: '反击', 数值: '+20%', 生效方式: '独立生效' }] })],
  受击反击: [原型编译条目('机制授予', { 授予效果: [{ 原型: '结算修正', 目标: '自身', 结算: '反击', 数值: '+20%', 生效方式: '独立生效' }] })],
  机制授予: [原型编译条目('机制授予')],
  等级提升: [原型编译条目('等级提升')],
  群体撤离: [原型编译条目('群体撤离')],
});

var 技能状态选项_V1 = Object.freeze(['中毒', '流血', '灼烧', '冻伤', '持续创伤', '持续恢复', '迟缓', '资源燃烧', '眩晕', '沉默', '致盲', '禁疗', '治疗反转', '隐匿', '探查屏蔽', '共享视野', '护盾', '无视异常', '霸体', '标记', '封技', '护卫', '嘲讽', '防御剥夺', '精神抗性剥夺', '虚弱', '失控', '反噬', '精神紊乱', '魂力枯竭', '僵直', '麻痹', '混乱', '坚挺金苍蝇·武魂真身维持']);
var 技能负面状态选项_V1 = Object.freeze(['中毒', '流血', '灼烧', '冻伤', '持续创伤', '迟缓', '资源燃烧', '眩晕', '沉默', '致盲', '禁疗', '治疗反转', '标记', '封技', '嘲讽', '防御剥夺', '精神抗性剥夺', '虚弱', '失控', '反噬', '精神紊乱', '魂力枯竭', '僵直', '麻痹', '混乱']);
var 战斗外可继承技能状态选项_V1 = Object.freeze(['中毒', '灼烧', '冻伤', '虚弱', '反噬', '精神紊乱', '魂力枯竭']);
var 日常系统状态选项_V1 = Object.freeze(['饥饿']);
var 战斗内限定技能状态选项_V1 = Object.freeze(技能状态选项_V1.filter(状态 => !战斗外可继承技能状态选项_V1.includes(状态)));
var 战斗外复活代价类型选项_V1 = Object.freeze(['状态代价', '封印能力', '永久代价', '消耗实体物品']);
var 战斗外复活物品代价对象选项_V1 = Object.freeze(['神器', '魂骨', '复活类丹药', '绑定祭器']);
var 战斗外复活封印代价对象选项_V1 = Object.freeze(['武魂', '魂技', '魂环', '魂骨', '精神力', '魂力']);
var 战斗外复活永久代价对象选项_V1 = Object.freeze(['等级上限', '力量', '防御', '敏捷', '体力上限', '魂力上限', '精神力上限']);
var 技能正式资源选项_V1 = Object.freeze(['生命', '体力', '魂力', '精神力']);
var 技能限定攻击类型选项_V1 = Object.freeze(['近身攻击', '远程攻击', '精神攻击', '真实攻击', '碾压', '冲击']);

var SKILL_PASSIVE_TRIGGER_PHASE_OPTIONS_V1 = Object.freeze([
  '战斗开始',
  '回合开始',
  '受击前',
  '受击后',
  '濒死时',
  '被控制时',
  '命中后',
]);

var SKILL_PROTOTYPE_FIELD_OPTIONS_V1 = Object.freeze({
  原型: Object.freeze([]),
  目标: Object.freeze(['自身', '单体', '群体', '全场', '召唤物']),
  生效方式: Object.freeze(['独立生效', '跟随主原型']),
  触发方式: Object.freeze(['立即触发', '延迟触发', '遥控触发', ...SKILL_PASSIVE_TRIGGER_PHASE_OPTIONS_V1]),
  发动方式: Object.freeze(['主动', '被动']),
  触发条件: Object.freeze(['计时结束', '主动触发', '随下次行动触发', '下次魂技成功释放']),
  提升方式: Object.freeze(['下一合法等级']),
  目的地: Object.freeze(['亡灵半位面']),
  结算方式: Object.freeze(['全员同成败']),
  护盾模式: Object.freeze(['正向护盾', '斩盾', '窃盾']),
  伤害类型: Object.freeze(['近身攻击', '远程攻击', '精神攻击', '真实攻击']),
  驱动属性: Object.freeze(['无', '力量', '防御', '敏捷', '魂力上限', '精神力上限', '体力上限']),
  影响方向: Object.freeze(['成功率', '效果强度', '持续时间', '消耗', '前摇']),
  资源: 技能正式资源选项_V1,
  限定资源: 技能正式资源选项_V1,
  触发概率: Object.freeze([]),
  限定探查者: Object.freeze([]),
  限定来源: Object.freeze([]),
  限定攻击类型: 技能限定攻击类型选项_V1,
  转化效果: Object.freeze(['立即恢复', '下次造成伤害']),
  触发消耗: Object.freeze([]),
  属性: Object.freeze(['力量', '防御', '敏捷', '生命上限', '体力上限', '魂力上限', '精神力上限']),
  判定: Object.freeze(['命中', '闪避', '反应']),
  结算: Object.freeze(['造成伤害', '受到伤害', '治疗', '资源恢复', '消耗', '前摇', '反伤', '伤害转移', '伤害吸收', '伤害转治疗', '治疗转伤害', '伤害分摊', '消耗分摊', '防御穿透', '防御剥夺', '精神抗性剥夺', '技能效果', '反击', '持续伤害引爆']),
  转移对象: Object.freeze(['攻击者', '攻击方队友', '攻击方任意', '防守方队友']),
  吸收来源: Object.freeze(['造成伤害', '受到伤害']),
  吸收资源: 技能正式资源选项_V1,
  锁定类型: Object.freeze(['资源池锁定', '回复锁定', '转化锁定']),
  调整方式: Object.freeze(['延长', '压缩']),
  调整字段: Object.freeze(['持续回合', '有效期tick', '触发次数', '使用次数']),
  状态: 技能状态选项_V1,
  匹配原型: Object.freeze(['无', '资源变化', '护盾变化']),
  数值方向: Object.freeze(['负向', '正向', '任意']),
  类型: Object.freeze(['负面', '增益', '控制', '隐匿', '斩盾', '窃取']),
  规则: Object.freeze(['缴械', '死亡转存活']),
  复活代价类型: 战斗外复活代价类型选项_V1,
  复活代价对象: Object.freeze([...战斗外可继承技能状态选项_V1, ...日常系统状态选项_V1, ...战斗外复活物品代价对象选项_V1, ...战斗外复活封印代价对象选项_V1, ...战斗外复活永久代价对象选项_V1]),
  复活后状态: Object.freeze([...战斗外可继承技能状态选项_V1, ...日常系统状态选项_V1]),
  机制: Object.freeze([...Object.keys(SKILL_MECHANISM_META_V1 || {}), '控制机制', '回复机制', '护盾', '隐身', '增益'].sort()),
  来源: Object.freeze(['自身', '目标', '双方', '召唤物']),
  去向: Object.freeze(['自身', '目标', '双方', '召唤物']),
  范围: Object.freeze(['单个', '全部', '随机']),
  复制类型: Object.freeze(['复制技能', '复制属性', '复制全部']),
  复制模式: Object.freeze(['即时镜像', '复刻友方']),
  触发限制周期: Object.freeze(['每日', '每战', '每回合', '每次行动', '每次施放', '下次行动', '下次命中', '主动使用']),
  资源转移方式: Object.freeze(['吞噬', '共享', '均分', '转移']),
  结算标签: Object.freeze(['标准伤害', '真实伤害']),
  抗性类型: Object.freeze(['物理抗性', '精神抗性', '元素抗性', '毒素抗性', '真实无视']),
  干扰: Object.freeze(['判断干扰', '索敌干扰']),
  限定元素: Object.freeze(['五行类', '元素类', '金', '木', '水', '火', '土', '风', '雷', '冰', '光', '暗', '精神', '空间', '时间', '创造', '毁灭']),
  位移类型: Object.freeze(['拉近', '击退', '换位', '瞬移', '脱离']),
  位移对象: Object.freeze(['自身', '目标', '自身与目标']),
  消耗道具: Object.freeze([]),
  收益类型: Object.freeze(['属性修炼速度', '训练方式收益']),
  修炼属性: Object.freeze(['力量', '防御', '敏捷', '体力上限', '魂力上限', '精神力上限']),
  上限梯队: Object.freeze(['劣等', '正常', '优秀', '天才', '顶级天才', '绝世妖孽']),
  训练方式: Object.freeze(['冥想', '肉体训练', '精神训练', '日常训练', '副职业经验']),
  行动模式: Object.freeze(['自主行动', '护卫', '协同攻击']),
  召唤单位类型: Object.freeze(['魂师', '魂兽', '本命召唤兽', '分身', '深渊生物', '其他召唤生物']),
  承伤规则: Object.freeze(['可承伤', '护卫承伤', '分摊承伤']),
  条件类型: Object.freeze(['当前行动', '命中', '被闪避', '状态存在', '护盾', '生命比例', '体力比例', '魂力比例', '精神力比例', '生命数值', '体力数值', '魂力数值', '精神力数值', '等级', '技能属性', '攻击段数', '终结', '生命体', '装备品质', '反抗状态', '血脉', '目标', '使用者', '环境满足', '时间', '装备状态', '自身状态', '连携前提', '天赋梯队', '单位文本']),
  条件对象: Object.freeze(['目标', '自身', '施术者', '召唤物', '使用者', '制作者', '本次行动']),
  条件比较: Object.freeze(['==', '!=', '>', '>=', '<', '<=', '有', '无', '包含']),
  条件处理: Object.freeze(['生效', '替换效果', '追加效果', '禁用']),
});

var SKILL_PROTOTYPE_FIELD_TYPE_V1 = Object.freeze({
  原型: '枚举',
  目标: '枚举',
  生效方式: '枚举',
  触发方式: '枚举',
  发动方式: '枚举',
  触发条件: '枚举',
  提升方式: '枚举',
  目的地: '枚举',
  结算方式: '枚举',
  基础成功率: '概率',
  每增加一人成功率倍率: '数字',
  等级上限: '整数',
  冷却年数: '整数',
  失败仍消耗资源: '布尔',
  消耗道具: '布尔',
  消耗: 'COST',
  装备要求: '对象',
  触发概率: '概率',
  限定探查者: '文本',
  限定来源: '文本',
  限定攻击类型: '多枚举',
  限定资源: '枚举',
  转化效果: '枚举',
  触发消耗: 'COST',
  伤害类型: '枚举',
  驱动属性: '枚举',
  影响方向: '枚举',
  资源: '多枚举',
  转移对象: '枚举',
  吸收来源: '枚举',
  吸收资源: '枚举',
  锁定类型: '枚举',
  属性: '多枚举',
  判定: '枚举',
  结算: '枚举',
  干扰: '枚举',
  限定元素: '多枚举',
  调整方式: '枚举',
  调整字段: '枚举',
  状态: '枚举',
  匹配原型: '枚举',
  数值方向: '枚举',
  类型: '多枚举',
  规则: '枚举',
  复活代价类型: '枚举',
  复活代价对象: '枚举',
  复活后状态: '枚举',
  机制: '枚举',
  抹消对象: '对象',
  来源: '枚举',
  去向: '枚举',
  范围: '枚举',
  复制类型: '枚举',
  复制模式: '枚举',
  保存上限: '整数',
  年限上限: '整数',
  削减比例: '数字',
  造物名称: '文本',
  调整tick: '整数',
  调整次数: '整数',
  单日使用次数上限: '整数',
  触发限制: '对象',
  资源转移方式: '枚举',
  结算标签: '枚举',
  抗性类型: '枚举',
  打断效果: '布尔',
  位移类型: '枚举',
  位移对象: '枚举',
  距离: '数字',
  收益类型: '枚举',
  修炼属性: '枚举',
  训练方式: '枚举',
  上限梯队: '枚举',
  提升档数: '整数',
  威力倍率: '数字',
  攻击段数: '整数',
  对应等级: '数字',
  延迟回合: '整数',
  调整回合: '整数',
  结算倍率: '带符号数值',
  强化倍率: '带符号数值',
  防御穿透: '数字',
  数值: '带符号数值',
  副数值: '带符号数值',
  概率: '带符号数值',
  数量: '整数',
  次数: '整数',
  持续回合: '整数',
  持续tick: '整数',
  有效期tick: '整数',
  继承属性比例: '数字',
  强度: '数字',
  可用次数: '整数',
  保留回合: '整数',
  保留时长tick: '整数',
  保留回合数: '整数',
  召唤单位类型: '枚举',
  召唤物名称: '文本',
  承伤规则: '枚举',
  行动模式: '枚举',
  值: '文本',
  使用效果: '原型列表',
  授予效果: '原型列表',
  结算效果: '原型列表',
  条件分支: '条件分支',
});

var SKILL_PROTOTYPE_FIELD_DEFAULT_V1 = Object.freeze({
  目标: '单体',
  生效方式: '独立生效',
  触发方式: '立即触发',
  发动方式: '被动',
  触发条件: '计时结束',
  提升方式: '下一合法等级',
  目的地: '亡灵半位面',
  结算方式: '全员同成败',
  基础成功率: 1,
  每增加一人成功率倍率: 0.9,
  等级上限: 120,
  冷却年数: 3,
  失败仍消耗资源: true,
  消耗道具: false,
  护盾模式: '正向护盾',
  伤害类型: '近身攻击',
  驱动属性: '魂力上限',
  影响方向: '效果强度',
  资源: '魂力',
  转移对象: '攻击者',
  吸收来源: '造成伤害',
  吸收资源: '生命',
  属性: '力量',
  判定: '命中',
  结算: '造成伤害',
  限定元素: '火',
  调整方式: '延长',
  调整字段: '持续回合',
  状态: '眩晕',
  匹配原型: '资源变化',
  数值方向: '任意',
  类型: '负面',
  规则: '缴械',
  复活代价类型: '状态代价',
  复活代价对象: '虚弱',
  复活代价值: '+1',
  复活后状态: '虚弱',
  抹消对象: Object.freeze({ 原型: '机制授予' }),
  来源: '目标',
  去向: '自身',
  范围: '单个',
  复制类型: '复制技能',
  复制模式: '即时镜像',
  保存上限: 1,
  年限上限: 10000,
  削减比例: 0.2,
  结算标签: '标准伤害',
  抗性类型: '物理抗性',
  干扰: '判断干扰',
  打断效果: false,
  锁定类型: '回复锁定',
  位移类型: '瞬移',
  位移对象: '自身',
  距离: 1,
  收益类型: '训练方式收益',
  修炼属性: '魂力上限',
  训练方式: '冥想',
  授予效果: Object.freeze([Object.freeze({ 原型: '判定修正', 目标: '自身', 判定: '命中', 数值: '+10%' })]),
  召唤物名称: '召唤物',
  行动模式: '自主行动',
  条件类型: '生命比例',
  条件对象: '目标',
  条件比较: '<=',
  条件处理: '生效',
  威力倍率: 100,
  攻击段数: 1,
  延迟回合: 0,
  调整回合: 1,
  调整tick: 6,
  调整次数: 1,
  单日使用次数上限: 1,
  结算倍率: '+100%',
  强化倍率: '+100%',
  防御穿透: 0,
  数值: '+10%',
  副数值: '+5%',
  概率: '100%',
  数量: 1,
  次数: 1,
  持续回合: 0,
  持续tick: 0,
  有效期tick: 0,
  继承属性比例: 0,
  强度: 1,
  可用次数: 1,
  召唤单位类型: '魂兽',
  承伤规则: '护卫承伤',
});

function 召唤生成使用继承属性比例_V1(效果 = {}) {
  return 读取召唤生成继承比例表_V1(效果).some(([, 比例]) => 比例 > 0);
}

function 召唤生成允许继承属性比例_V1(效果 = {}) {
  return ['本命召唤兽', '分身'].includes(String(效果?.召唤单位类型 || '').trim());
}

function 召唤生成允许普通批量_V1(效果 = {}) {
  return String(效果?.召唤单位类型 || '').trim() === '其他召唤生物';
}

function 读取召唤生成继承比例表_V1(效果 = {}) {
  const 统一比例 = Number(效果?.继承属性比例 || 0);
  const 读取 = () => Math.max(0, Math.min(1, Number(统一比例 || 0)));
  return [
    ['力量', 读取('力量')],
    ['防御', 读取('防御')],
    ['敏捷', 读取('敏捷')],
    ['体力上限', 读取('体力上限')],
    ['魂力上限', 读取('魂力上限')],
    ['精神力上限', 读取('精神力上限')],
  ];
}

function 规范化召唤生成继承属性比例_V1(效果 = {}, 默认比例 = 0.45) {
  return Math.max(0.01, Math.min(1, Number(效果?.继承属性比例 || 默认比例)));
}

function 读取召唤生成平均继承比例_V1(效果 = {}) {
  const 表 = 读取召唤生成继承比例表_V1(效果).map(([, 比例]) => 比例).filter(比例 => 比例 > 0);
  if (!表.length) return 0;
  return 表.reduce((总和, 比例) => 总和 + 比例, 0) / 表.length;
}

var 机制抹消全部字段值_V1 = new Set(['全部', '抹消全部', '全部状态', '全部规则', '全部资源', '全部结算', '全部属性', '全部原型', '全部转移方式', '全部复制类型']);

function 规范化机制抹消字段值_V1(值) {
  const 来源列表 = Array.isArray(值) ? 值 : String(值 ?? '').split(/[、,，|/]/);
  if (来源列表.some(item => 机制抹消全部字段值_V1.has(String(item ?? '').trim()))) return undefined;
  const 列表 = Array.from(new Set(
    来源列表
      .map(item => String(item ?? '').trim())
      .filter(item => item && item !== '无' && !机制抹消全部字段值_V1.has(item)),
  ));
  if (!列表.length) return undefined;
  return 列表.length === 1 ? 列表[0] : 列表;
}

function 格式化机制抹消字段值_V1(值) {
  return Array.isArray(值) ? 值.map(item => String(item ?? '').trim()).filter(Boolean).join('、') : String(值 ?? '').trim();
}

function 规范化技能机制抹消对象_V1(值 = {}) {
  const 来源 = 值 && typeof 值 === 'object' && !Array.isArray(值)
    ? 值
    : { 原型: String(值 || '').trim() || '机制授予' };
  const 原型 = String(来源.原型 || '机制授予').trim() || '机制授予';
  const 结果 = { 原型 };
  读取机制抹消可匹配字段_V1(原型).forEach(key => {
    const 字段值 = 规范化机制抹消字段值_V1(来源[key]);
    if (字段值 !== undefined) 结果[key] = 字段值;
  });
  return 结果;
}

function 读取技能机制抹消对象摘要_V1(对象 = {}) {
  const 匹配器 = 规范化技能机制抹消对象_V1(对象);
  const 原型 = String(匹配器?.原型 || '').trim() || '机制';
  const 片段 = [原型];
  读取机制抹消可匹配字段_V1(原型).forEach(key => {
    const 字段值 = 格式化机制抹消字段值_V1(匹配器?.[key]);
    if (字段值) 片段.push(`${key}:${字段值}`);
  });
  return 片段.join(' ');
}

function 构建技能机制抹消对象_V1(原型 = '机制授予', 附加 = {}) {
  return 规范化技能机制抹消对象_V1({ 原型: String(原型 || '').trim() || '机制授予', ...(附加 || {}) });
}

var SKILL_PROTOTYPE_CONTROL_TYPE_V1 = Object.freeze({
  枚举: '下拉',
  多枚举: '多选',
  布尔: '勾选',
  数字: '数字框',
  整数: '整数框',
  带符号数值: '受限数值输入',
  原型列表: '原型列表编辑器',
  条件分支: '条件分支编辑器',
  对象: '对象编辑器',
  文本: '文本输入',
  概率: '概率输入',
  COST: 'COST输入',
});

var 分身目标允许原型集合_V1 = new Set(['资源变化', '属性修正', '判定修正', '结算修正']);

function 原型允许分身目标_V1(原型 = '') {
  return 分身目标允许原型集合_V1.has(String(原型 || '').trim());
}

var 读取原型字段选项_V1 = (原型 = '', 字段名 = '') => {
  const 原型名 = String(原型 || '').trim();
  const key = String(字段名 || '').trim();
  if (key === '目标') {
    const 基础目标 = SKILL_PROTOTYPE_FIELD_OPTIONS_V1.目标.filter(目标 => 目标 !== '分身');
    return Object.freeze(原型允许分身目标_V1(原型名) ? [...基础目标, '分身'] : 基础目标);
  }
  if (原型名 === '规则防御' && key === '规则') return Object.freeze(['免伤', '免死']);
  if (原型名 === '护盾变化' && key === '护盾模式') return Object.freeze(['正向护盾', '斩盾', '窃盾']);
  if (原型名 === '规则改写' && key === '规则') return Object.freeze(['缴械', '死亡转存活']);
  if (原型名 === '战斗外复活' && key === '复活代价对象') return SKILL_PROTOTYPE_FIELD_OPTIONS_V1.复活代价对象;
  if (原型名 === '状态交换' && key === '状态') return Object.freeze(['任意负面', ...技能负面状态选项_V1]);
  if (['状态移除', '状态转移'].includes(原型名) && key === '状态') return Object.freeze(['任意状态', '任意负面', '任意增益', ...SKILL_PROTOTYPE_FIELD_OPTIONS_V1.状态]);
  if (原型名 === '状态移除' && key === '匹配原型') return Object.freeze(['无', '资源变化', '护盾变化']);
  if (原型名 === '状态移除' && key === '资源') return Object.freeze(['生命']);
  if (原型名 === '状态转移' && ['来源', '去向'].includes(key)) return Object.freeze(['自身', '目标', '友方', '敌方']);
  if (原型名 === '等级提升' && key === '提升方式') return SKILL_PROTOTYPE_FIELD_OPTIONS_V1.提升方式;
  if (原型名 === '群体撤离' && key === '目的地') return SKILL_PROTOTYPE_FIELD_OPTIONS_V1.目的地;
  if (原型名 === '群体撤离' && key === '结算方式') return SKILL_PROTOTYPE_FIELD_OPTIONS_V1.结算方式;
  if (原型名 === '机制授予' && key === '触发条件') return Object.freeze(['主动触发', '随下次行动触发', '下次魂技成功释放']);
  if (key === '影响方向') {
    const 通用方向列表 = Object.freeze(['成功率', '效果强度', '持续时间', '消耗', '前摇']);
    const 保留消耗前摇 = 方向列表 => Object.freeze(Array.from(new Set([...(方向列表 || []), '消耗', '前摇'])));
    if (原型名 === '时光回溯') return Object.freeze(['成功率', '效果强度']);
    if (原型名 === '位移执行') return 保留消耗前摇(['成功率', '效果强度']);
    if (原型名 === '资源锁定') return 保留消耗前摇(['成功率', '效果强度']);
    if (原型名 === '复制执行') return 保留消耗前摇(['效果强度']);
    if (['判定修正', '决策干扰', '机制抹消', '规则改写'].includes(原型名)) return 保留消耗前摇(['成功率']);
    if (原型名 === '伤害结算') return Object.freeze(['效果强度']);
    if (['资源变化', '资源转移', '护盾变化', '属性修正'].includes(原型名)) return 保留消耗前摇(['效果强度']);
    if (原型名 === '机制授予') return 通用方向列表;
    if (原型名 === '炸环') return 保留消耗前摇(['效果强度']);
    if (原型名 === '结算修正') return Object.freeze(['效果强度', '消耗', '前摇']);
  if (原型名 === '状态施加') return 保留消耗前摇(['成功率', '效果强度', '持续时间']);
    if (原型名 === '时窗修正') return 保留消耗前摇(['持续时间', '效果强度']);
  }
  return SKILL_PROTOTYPE_FIELD_OPTIONS_V1[key] || Object.freeze([]);
};

var 读取原型字段默认值_V1 = (原型 = '', 字段名 = '') => {
  const 原型名 = String(原型 || '').trim();
  const key = String(字段名 || '').trim();
  if (原型名 === '规则防御' && key === '规则') return '免伤';
  if (原型名 === '护盾变化' && key === '护盾模式') return '正向护盾';
  if (原型名 === '规则改写' && key === '规则') return '缴械';
  if (原型名 === '规则改写' && key === '数值') return '+25%';
  if (原型名 === '战斗外复活' && key === '数值') return '+25%';
  if (原型名 === '战斗外复活' && key === '死亡时限tick') return 144;
  if (原型名 === '战斗外复活' && key === '复活代价时限tick') return 144;
  if (原型名 === '战斗外复活' && key === '复活后状态时限tick') return 144;
  if (原型名 === '时光回溯' && key === '驱动属性') return '精神力上限';
  if (原型名 === '时光回溯' && key === '影响方向') return '成功率';
  if (原型名 === '机制授予' && key === '触发条件') return '主动触发';
  if (原型名 === '等级提升' && key === '提升方式') return '下一合法等级';
  if (原型名 === '等级提升' && key === '等级上限') return 120;
  if (原型名 === '等级提升' && key === '冷却年数') return 3;
  if (原型名 === '群体撤离' && key === '目的地') return '亡灵半位面';
  if (原型名 === '群体撤离' && key === '基础成功率') return 1;
  if (原型名 === '群体撤离' && key === '每增加一人成功率倍率') return 0.9;
  if (原型名 === '群体撤离' && key === '结算方式') return '全员同成败';
  if (原型名 === '群体撤离' && key === '失败仍消耗资源') return true;
  if (原型名 === '群体撤离' && key === '消耗道具') return false;
  if (原型名 === '位移执行' && key === '影响方向') return '效果强度';
  if (原型名 === '位移执行' && key === '持续回合') return 1;
  if (原型名 === '状态交换' && key === '状态') return '任意负面';
  if (原型名 === '状态转移' && key === '来源') return '自身';
  if (原型名 === '状态转移' && key === '去向') return '目标';
  return SKILL_PROTOTYPE_FIELD_DEFAULT_V1[key];
};

var 构建原型字段定义_V1 = (字段名, 原型 = '') => Object.freeze({
  字段: 字段名,
  类型: 原型 === '群体撤离' && 字段名 === '对应等级'
    ? '整数'
    : ['状态施加', '结算修正'].includes(原型) && ['资源', '限定资源'].includes(字段名)
    ? '枚举'
    : SKILL_PROTOTYPE_FIELD_TYPE_V1[字段名] || '文本',
  选项: 字段名 === '原型'
    ? Object.freeze(SKILL_PROTOTYPE_DEFINITION_LIST_V1.map(([原型]) => 原型))
    : 读取原型字段选项_V1(原型, 字段名),
  默认值: 读取原型字段默认值_V1(原型, 字段名),
  设计台控件类型: SKILL_PROTOTYPE_CONTROL_TYPE_V1[
    ['状态施加', '结算修正'].includes(原型) && ['资源', '限定资源'].includes(字段名)
      ? '枚举'
      : SKILL_PROTOTYPE_FIELD_TYPE_V1[字段名] || '文本'
  ] || '文本输入',
});

var SKILL_PROTOTYPE_DEFINITION_LIST_V1 = Object.freeze([
  ['伤害结算', '战斗结算', '敌对', ['威力倍率', '伤害类型', '攻击段数', '防御穿透', '对应等级', '结算标签', '抗性类型', '触发消耗'], ['威力倍率', '伤害类型'], '造成一次或多段直接伤害'],
  ['资源变化', '战斗结算', '上下文', ['资源', '数值', '持续回合', '触发限制', '驱动属性', '影响方向', '对应等级'], ['资源', '数值'], '恢复资源或扣除体力、魂力、精神力；生命负数必须使用伤害结算'],
  ['资源转移', '战斗结算', '上下文', ['资源', '数值', '资源转移方式', '转化比例', '持续回合', '驱动属性', '影响方向'], ['资源', '数值', '资源转移方式'], '吞噬、共享、转移或均分目标资源，可用持续回合表达短期资源流转'],
  ['护盾变化', '战斗结算', '上下文', ['护盾模式', '数值', '限定来源', '持续回合', '驱动属性', '影响方向'], ['护盾模式', '数值'], '获得护盾、斩除护盾或窃取护盾'],
  ['属性修正', '战斗结算', '上下文', ['属性', '数值', '限定来源', '持续回合', '驱动属性', '影响方向', '对应等级'], ['属性', '数值'], '修正力量、防御、敏捷、资源上限等属性'],
  ['判定修正', '战斗结算', '上下文', ['判定', '数值', '限定来源', '持续回合', '打断效果', '驱动属性', '影响方向', '对应等级'], ['判定', '数值'], '修正命中、闪避或反应判定，可用持续回合表达短期判定增减益'],
  ['结算修正', '战斗结算', '上下文', ['结算', '数值', '数量', '转移对象', '吸收来源', '吸收资源', '资源', '限定资源', '限定攻击类型', '转化效果', '限定元素', '限定来源', '持续回合', '驱动属性', '影响方向'], ['结算', '数值'], '修正常规结算倍率、比例、消耗、前摇等结果'],
  ['炸环', '战斗结算', '可赋予', ['强化倍率'], ['强化倍率'], '战斗中选择并炸掉魂环，按魂环年限临时增幅下一次魂技释放时的自身属性'],
  ['状态施加', '战斗结算', '上下文', ['状态', '触发方式', '触发概率', '资源', '限定探查者', '限定来源', '数值', '副数值', '持续回合', '延迟回合', '触发限制', '打断效果', '驱动属性', '影响方向', '对应等级'], ['状态'], '施加中毒、冻伤、沉默、隐匿、霸体、无视异常等概括状态，可设置延迟回合登记后施加'],
  ['时窗修正', '战斗结算', '敌对', ['调整字段', '调整方式', '调整回合', '调整tick', '调整次数', '单日使用次数上限', '结算倍率', '驱动属性', '影响方向'], ['调整字段', '调整方式'], '延长或压缩目标身上对应类型的时间与次数窗口'],
  ['状态移除', '战斗结算', '上下文', ['状态', '匹配原型', '资源', '数值方向', '数量', '持续回合', '驱动属性', '影响方向', '对应等级'], [], '按状态名或状态内部原型效果移除状态，可用持续回合表达持续净化或驱散窗口'],
  ['规则防御', '战斗结算', '可赋予', ['规则', '次数', '限定来源', '持续回合', '触发限制'], ['规则', '次数'], '免伤、免死等防御规则'],
  ['状态转移', '战斗结算', '上下文', ['状态', '来源', '去向', '数量', '持续回合'], ['状态', '来源', '去向'], '把状态从一方转移到另一方，可用持续回合表达持续转移窗口'],
  ['状态交换', '战斗结算', '上下文', ['状态', '持续回合'], ['状态'], '交出自身负面状态并夺取敌方目标增益状态，可用持续回合表达持续交换窗口'],
  ['资源锁定', '战斗结算', '敌对', ['资源', '锁定类型', '数值', '持续回合', '驱动属性', '影响方向'], ['资源', '锁定类型', '数值'], '锁定目标资源池、回复或转化通道'],
  ['规则改写', '战斗结算', '上下文', ['规则', '数值', '持续回合', '驱动属性', '影响方向'], ['规则'], '临时改写指定结算规则'],
  ['机制抹消', '战斗结算', '敌对', ['抹消对象', '持续回合', '驱动属性', '影响方向'], ['抹消对象'], '按机制链节点全链路抹消目标机制'],
  ['机制授予', '战斗结算', '可赋予', ['授予效果', '触发条件', '触发限制', '可用次数', '持续回合', '驱动属性', '影响方向'], ['授予效果', '触发条件'], '临时授予技能、状态或效果'],
  ['复制执行', '战斗结算', '上下文', ['复制类型', '复制模式', '保存上限', '削减比例', '可用次数', '保留回合', '保留时长tick', '驱动属性', '影响方向'], ['复制类型', '复制模式'], '复制技能、属性或全部'],
  ['时光回溯', '战斗结算', '可赋予', ['发动方式', '驱动属性', '影响方向'], [], '主动释放时压低目标反应；被动在目标结算前回到本回合开始战斗态并阻断落地'],
  ['位移执行', '行为推导', '上下文', ['位移类型', '位移对象', '距离', '数值', '持续回合', '驱动属性', '影响方向'], ['位移类型', '位移对象'], '拉近、击退、换位、瞬移或脱离，并按位移幅度折算战斗收益或压制'],
  ['决策干扰', '行为推导', '上下文', ['干扰', '数值', '持续回合', '驱动属性', '影响方向'], ['干扰', '数值'], '干扰行动判断或索敌判断的候选权重池'],
  ['修炼增益', '战斗外', '可赋予', ['收益类型', '修炼属性', '训练方式', '数值', '有效期tick', '对应等级'], ['收益类型', '数值'], '修正指定属性修炼速度或指定训练方式收益'],
  ['天赋提升', '战斗外', '可赋予', ['上限梯队', '提升档数', '对应等级'], [], '提升角色天赋梯队，默认提升一级；上限梯队限制提升后不得超过的档位'],
  ['永久属性提升', '战斗外', '可赋予', ['属性', '数值', '对应等级'], ['属性', '数值'], '永久提升指定属性上限，写入角色训练加成并由属性重算生效'],
  ['魂骨年限提升', '战斗外', '可赋予', ['数值', '年限上限'], ['数值', '年限上限'], '以一次性魂骨材料提升角色已融合魂骨的现有年限，并受年限上限限制'],
  ['战斗外复活', '战斗外', '可赋予', ['数值', '死亡时限tick', '复活代价类型', '复活代价对象', '复活代价值', '复活代价时限tick', '复活后状态', '复活后状态时限tick'], ['数值', '死亡时限tick', '复活代价类型', '复活代价对象', '复活后状态'], '战斗外复活意外死亡目标并写回复活代价'],
  ['等级提升', '战斗外', '可赋予', ['提升方式', '等级上限', '冷却年数'], ['提升方式', '等级上限', '冷却年数'], '将目标提升至下一合法等级，并受等级上限约束；成功后进入指定年数冷却', 'formal-non-battle'],
  ['群体撤离', '战斗外', '上下文', ['目的地', '基础成功率', '每增加一人成功率倍率', '结算方式', '失败仍消耗资源', '消耗道具', '对应等级', '消耗'], ['目的地', '基础成功率', '每增加一人成功率倍率', '结算方式', '失败仍消耗资源', '消耗道具', '对应等级', '消耗'], '按人数计算一次群体撤离成功率，成功全员同成败；失败仍消耗资源且道具本身不消耗', 'formal-non-battle'],
  ['召唤生成', '战斗结算', '召唤物', ['召唤单位类型', '召唤物名称', '数量', '行动模式', '继承属性比例', '强度', '持续回合', '承伤规则', '触发限制'], ['召唤单位类型', '召唤物名称', '数量'], '生成战斗召唤单位并折算为短期战斗收益'],
]);

// ============ 阶段 2 v3：COST 真值表常量（魂技 COST 全链路收口） ============
// 第 N 魂技运转标准消耗：普通魂环魂技按来源分类承载；真身来源才按武魂真身百分比消耗分流，魂环位本身不自动等于真身。
var SKILL_STANDARD_COST_BY_TIER_V1 = Object.freeze(
  Array.from({ length: 9 }, (_, 序号) => 计算魂技资源消耗_V1('魂力', 获取魂技位对应等级_V1(序号 + 1), 50)),
);
var SKILL_STANDARD_CAST_TIME_V1 = 20;
var SKILL_AVATAR_STANDARD_COST_RATIO_V1 = 0.10;
var 武魂真身基础预算_V1 = 220;
var 武魂融合技基础预算_V1 = 300;
var 特殊魂技天赋预算倍率表_V1 = Object.freeze({
  天赋极差: 0.35,
  劣等: 0.5,
  正常: 0.75,
  优秀: 1,
  天才: 1.18,
  顶级天才: 1.35,
  绝世妖孽: 1.55,
});
// 第一魂技仍要消耗对应阶层约半数资源，预算 10 生成的伤害却常低于或只略高于
// 免费普攻（威力 50），会让低阶角色在整场战斗里理性地拒绝魂技。只抬高第一档，
// 保持第二至第九档及所有资源消耗口径不变，避免同步放大中高阶爆发。
var SKILL_BASE_BUDGET_BY_TIER_V1 = Object.freeze([15, 20, 30, 40, 50, 60, 70, 80, 90]);

function 是武魂真身魂技位_V1(魂技位 = 1) {
  return Math.floor(Number(魂技位 || 1)) === 7;
}

function 获取标准消耗_V1(魂技位 = 1) {
  const 位 = Math.max(1, Math.floor(Number(魂技位 || 1)));
  if (位 <= SKILL_STANDARD_COST_BY_TIER_V1.length) return SKILL_STANDARD_COST_BY_TIER_V1[位 - 1];
  return 计算魂技资源消耗_V1('魂力', 获取魂技位对应等级_V1(位), 50);
}
function 获取运转标准消耗_V1(魂技位 = 1) {
  if (是武魂真身魂技位_V1(魂技位)) return null;
  return 获取标准消耗_V1(魂技位);
}
function 获取武魂真身运转标准消耗比例_V1() { return SKILL_AVATAR_STANDARD_COST_RATIO_V1; }
function 构建武魂真身默认承载消耗_V1(type = '强攻系', grade = 'B', delivery = '直接生效') {
  const 系别 = String(type || '强攻系').trim() || '强攻系';
  const 品质基准 = 获取魂技品质消耗基准_V1(grade);
  const 释放倍率 = delivery === '造物承载' ? 0.32 : 0.5;
  const 分摊表 = {
    精神主导: { 魂力: 0.3, 精神力: 0.7 },
    附加微量精神力: { 魂力: 0.9, 精神力: 0.1 },
    魂神平摊: { 魂力: 0.5, 精神力: 0.5 },
    纯耗魂力: { 魂力: 1 },
  };
  const 燃料模型 =
    系别 === '精神系' || 系别 === '召唤系'
      ? '精神主导'
      : 系别 === '元素系'
        ? '魂神平摊'
        : ['辅助系', '食物系', '治疗系'].includes(系别)
          ? '附加微量精神力'
          : '纯耗魂力';
  return Object.fromEntries(
    Object.entries(分摊表[燃料模型] || 分摊表.纯耗魂力)
      .map(([资源名, 分摊比例]) => [资源名, `${Math.max(1, Math.round(品质基准 * 释放倍率 * Math.max(0, Number(分摊比例 || 0))))}%`]),
  );
}
function 获取标准前摇_V1() { return SKILL_STANDARD_CAST_TIME_V1; }
function 获取基础预算_V1(魂技位 = 1) {
  const 序号 = Math.max(1, Math.min(9, Math.floor(Number(魂技位 || 1)))) - 1;
  return SKILL_BASE_BUDGET_BY_TIER_V1[序号];
}

function 计算运转代价能量_V1(消耗倍数 = 1, 前摇倍数 = 1) {
  const 乘积 = Math.max(0, Number(消耗倍数 || 0) * Number(前摇倍数 || 0));
  if (!Number.isFinite(乘积)) return 1;
  return 乘积 < 1 ? 乘积 : Math.cbrt(乘积);
}

function 运转代价能量反推乘积_V1(目标代价能量 = 1) {
  const 目标 = Math.max(0.05, Math.min(Math.cbrt(16), Number(目标代价能量 || 0)));
  return 目标 < 1 ? 目标 : Math.pow(目标, 3);
}

// 11 种预定义副作用 → 强度档默认映射（来源于 lwcs/MVU.js:3639-3664 副作用列表注册）
var SKILL_SIDE_EFFECT_TIER_V1 = Object.freeze({
  致死献祭: '重',
  自损反噬: '中', 魂力反噬: '中', 精神紊乱: '中', 目标错乱: '中',
  全属性降低: '轻', 命中下降: '轻', 动作迟缓: '轻', 施法僵直: '轻',
});

var SKILL_DELAY_ROUND_PROTOTYPES_V1 = new Set(['伤害结算', '护盾变化', '属性修正', '状态施加']);
var 技能原型允许延迟回合_V1 = 原型 => SKILL_DELAY_ROUND_PROTOTYPES_V1.has(String(原型 || '').trim());

// SKILL_UNIT_COST_TABLE_V1：单位 COST 真值表（口径来自 artifacts/魂技COST矩阵.csv）
// 此处是唯一真源；export 脚本仅作"导出视图"。
var SKILL_UNIT_COST_TABLE_V1 = Object.freeze({
  伤害结算: Object.freeze({
    威力倍率: { 类型: '威力曲线', 公式: '10*POWER(威力倍率/70, LN(9)/LN(30))' },
    攻击段数: 0, 防御穿透: 0.45, 结算标签: 1,
    伤害类型: Object.freeze({ 近身攻击: 1, 远程攻击: 1.08, 精神攻击: 1.15, 真实攻击: 1.45 }),
    抗性类型: Object.freeze({ 物理抗性: 1, 元素抗性: 1.05, 精神抗性: 1.1, 真实无视: 1.35, 毒素抗性: 1 }),
  }),
  资源变化: Object.freeze({
    生命: Object.freeze({ 正向: 1.0 }),
    体力: Object.freeze({ 正向: 0.8, 负向: 0.65 }),
    魂力: Object.freeze({ 正向: 0.95, 负向: 0.95 }),
    精神力: Object.freeze({ 正向: 1.1, 负向: 0.9 }),
  }),
  资源转移: Object.freeze({ 共享: 0.9, 均分: 0.75, 转移: 0.9, 吞噬: 1.35 }),
  护盾变化: Object.freeze({ 正向护盾: 0.9, 斩盾: 0.75, 窃盾: 0.95 }),
  属性修正: Object.freeze({
    力量: Object.freeze({ 正向: 0.85, 负向: 0.81 }),
    防御: Object.freeze({ 正向: 0.8, 负向: 0.76 }),
    敏捷: Object.freeze({ 正向: 0.9, 负向: 0.85 }),
    生命上限: Object.freeze({ 正向: 1.15, 负向: 1.09 }),
    体力上限: Object.freeze({ 正向: 0.95, 负向: 0.9 }),
    魂力上限: Object.freeze({ 正向: 1.25, 负向: 1.19 }),
    精神力上限: Object.freeze({ 正向: 1.2, 负向: 1.14 }),
  }),
  判定修正: Object.freeze({ 命中: 0.6, 闪避: 0.7, 反应: 0.95, 打断效果: 18 }),
  结算修正: Object.freeze({
    造成伤害: 1.5, 受到伤害: 1.4, 治疗: 0.95, 消耗: 0.85, 前摇: 1.7,
    反伤: 1.15, 伤害转移: 2.5, 伤害吸收: 2, 伤害转治疗: 1.8, 治疗转伤害: 1.8,
    伤害分摊: 1.1, 消耗分摊: 0.9, 防御穿透: 1.3, 防御剥夺: 1.8, 精神抗性剥夺: 2.3,
    技能效果: 2.0, 反击: 18, 持续伤害引爆: 20,
  }),
  状态施加: Object.freeze({
    中毒: Object.freeze({ 数值: 1.05, 副数值: 0.6 }),
    流血: Object.freeze({ 数值: 1.05, 副数值: 0.7 }),
    灼烧: Object.freeze({ 数值: 0.9, 副数值: 0.7 }),
    冻伤: Object.freeze({ 数值: 0.95, 副数值: 0.75 }),
    持续创伤: Object.freeze({ 数值: 1.25, 副数值: 0.95 }),
    持续恢复: Object.freeze({ 数值: 0.95 }),
    迟缓: Object.freeze({ 数值: 0.75, 副数值: 0.7 }),
    资源燃烧: Object.freeze({ 数值: 0.95, 副数值: 0.85 }),
    眩晕: Object.freeze({ 固定COST: 60 }),
    致盲: Object.freeze({ 数值: 1.2, 固定COST: 11 }),
    禁疗: Object.freeze({ 数值: 1.3, 固定COST: 12 }),
    治疗反转: Object.freeze({ 数值: 1.6, 固定COST: 16 }),
    隐匿: Object.freeze({ 数值: 1.8, 副数值: 0.9, 固定COST: 18 }),
    探查屏蔽: Object.freeze({ 数值: 0.9, 固定COST: 8 }),
    共享视野: Object.freeze({ 数值: 0.6, 副数值: 0.6, 固定COST: 5 }),
    护盾: Object.freeze({ 数值: 0.9 }),
    无视异常: Object.freeze({ 固定COST: 60 }),
    霸体: Object.freeze({ 固定COST: 18 }),
    标记: Object.freeze({ 数值: 0.8, 固定COST: 30 }),
    封技: Object.freeze({ 固定COST: 50 }),
    护卫: Object.freeze({ 数值: 0.9, 固定COST: 8 }),
    嘲讽: Object.freeze({ 数值: 1.0, 固定COST: 10 }),
    防御剥夺: Object.freeze({ 数值: 1.1, 固定COST: 12 }),
    精神抗性剥夺: Object.freeze({ 数值: 1.2, 固定COST: 12 }),
    虚弱: Object.freeze({ 数值: 0.8, 固定COST: 8 }),
    失控: Object.freeze({ 数值: 1.5, 固定COST: 18 }),
    反噬: Object.freeze({ 数值: 1.4, 固定COST: 14 }),
    精神紊乱: Object.freeze({ 数值: 1.4, 副数值: 0.95, 固定COST: 14 }),
    魂力枯竭: Object.freeze({ 数值: 1.4, 副数值: 0.95, 固定COST: 14 }),
    僵直: Object.freeze({ 数值: 1.3, 副数值: 0.9, 固定COST: 12 }),
    麻痹: Object.freeze({ 数值: 1.4, 副数值: 0.9, 固定COST: 14 }),
    混乱: Object.freeze({ 数值: 1.5, 副数值: 0.7, 固定COST: 18 }),
    触发方式: Object.freeze({ 立即触发: 0, 延迟触发: 3, 遥控触发: 8 }),
  }),
  时窗修正: Object.freeze({ 回合型: 5, tick型: 0.35 }),
  状态移除: Object.freeze({ 任意状态: 10, 任意负面: 8, 任意增益: 9 }),
  规则防御: Object.freeze({ 免伤: 50, 免死: 80 }),
  状态转移: 10,
  状态交换: 12,
  资源锁定: Object.freeze({ 回复锁定: 1.2, 转化锁定: 1.0, 资源池锁定: 1.0 }),
  规则改写: Object.freeze({ 缴械: 18, 死亡转存活: 50 }),
  修炼增益: Object.freeze({ 属性修炼速度: 0.8, 训练方式收益: 0.7 }),
  战斗外复活: 250,
  机制抹消: 25,
  机制授予: 25,
  复制执行: Object.freeze({ 复制属性: 70, 复制技能: 90, 复制全部: 130 }),
  时光回溯: 200,
  位移执行: Object.freeze({ 换位: 14, 脱离: 10, 拉近: 8, 击退: 8, 瞬移: 50 }),
  决策干扰: Object.freeze({ 判断干扰: 0.6, 索敌干扰: 0.75 }),
  召唤生成: Object.freeze({
    本命召唤兽: 50, 分身: 28, 器灵: 35, 其他召唤生物: 30, 魂师: 30, 魂兽: 30, 深渊生物: 30,
  }),
});

function 获取单位COST_V1(原型, 选项字段, 选项值) {
  const 表 = SKILL_UNIT_COST_TABLE_V1[原型];
  if (表 === undefined) return undefined;
  if (typeof 表 === 'number') return 表;
  const 字段表 = 表[选项字段];
  if (字段表 !== undefined) {
    if (typeof 字段表 === 'number') return 字段表;
    if (字段表 && typeof 字段表 === 'object' && 选项值 in 字段表) return 字段表[选项值];
  }
  if (表 && typeof 表 === 'object' && 选项值 in 表) return 表[选项值];
  return undefined;
}


var SKILL_PROTOTYPE_COMMON_FIELDS_V1 = Object.freeze([
  '原型',
  '目标',
  '生效方式',
  '条件分支',
  '触发方式',
  '触发限制',
  '装备要求',
]);

var SKILL_MECHANISM_SUPPRESS_MATCHABLE_FIELDS_V1 = Object.freeze({
  状态施加: Object.freeze(['状态']),
  状态移除: Object.freeze(['状态', '匹配原型', '资源']),
  状态转移: Object.freeze(['状态']),
  状态交换: Object.freeze(['状态']),
  规则防御: Object.freeze(['规则']),
  规则改写: Object.freeze(['规则']),
  资源变化: Object.freeze(['资源']),
  资源转移: Object.freeze(['资源', '资源转移方式']),
  资源锁定: Object.freeze(['资源']),
  结算修正: Object.freeze(['结算']),
  属性修正: Object.freeze(['属性']),
  复制执行: Object.freeze(['复制类型']),
});

var SKILL_MECHANISM_SUPPRESS_SUPPORTED_PROTOTYPES_V1 = Object.freeze([
  '资源变化',
  '资源转移',
  '护盾变化',
  '属性修正',
  '判定修正',
  '结算修正',
  '炸环',
  '状态施加',
  '时窗修正',
  '状态移除',
  '规则防御',
  '状态转移',
  '状态交换',
  '资源锁定',
  '规则改写',
  '机制授予',
  '复制执行',
  '时光回溯',
  '位移执行',
  '决策干扰',
  '召唤生成',
]);

function 读取机制抹消可匹配字段_V1(原型 = '') {
  const 原型名 = String(原型 || '').trim();
  return Array.isArray(SKILL_MECHANISM_SUPPRESS_MATCHABLE_FIELDS_V1[原型名])
    ? SKILL_MECHANISM_SUPPRESS_MATCHABLE_FIELDS_V1[原型名]
    : Object.freeze([]);
}

function 机制抹消支持原型_V1(原型 = '') {
  return SKILL_MECHANISM_SUPPRESS_SUPPORTED_PROTOTYPES_V1.includes(String(原型 || '').trim());
}

var SKILL_PROTOTYPE_REGISTRY_V1 = Object.freeze(
  Object.fromEntries(
    SKILL_PROTOTYPE_DEFINITION_LIST_V1.map(([原型, 类别, 默认方向, 允许字段, 必填字段, 描述, 审计分类]) => {
      const 原始字段列表 = [...SKILL_PROTOTYPE_COMMON_FIELDS_V1, ...允许字段];
      const 字段列表 = 技能原型允许延迟回合_V1(原型) && !原始字段列表.includes('延迟回合')
        ? [...原始字段列表, '延迟回合']
        : 原始字段列表;
      const 字段定义表 = Object.fromEntries(字段列表.map(字段名 => [字段名, 构建原型字段定义_V1(字段名, 原型)]));
      return [
      原型,
      Object.freeze({
        原型,
        类别,
        默认方向,
        允许字段: Object.freeze(字段列表),
        必填字段: Object.freeze(Array.isArray(必填字段) ? [...必填字段] : []),
        字段定义: Object.freeze(字段定义表),
        默认值: Object.freeze(Object.fromEntries(字段列表.map(字段名 => [字段名, 字段定义表[字段名]?.默认值]).filter(([, 默认值]) => 默认值 !== undefined))),
        参数定义: Object.freeze([]),
        编译目标: Object.freeze({ 运行入口: 原型 }),
        运行编译入口: 原型,
        设计台控件类型: Object.freeze(Object.fromEntries(字段列表.map(字段名 => [字段名, 字段定义表[字段名]?.设计台控件类型 || '文本输入']))),
        描述,
        ...(审计分类 ? { 审计分类 } : {}),
        表现语义: Object.freeze([描述].filter(Boolean)),
        推荐语义: Object.freeze([原型, 描述].filter(Boolean)),
      }),
    ];
    }),
  ),
);

function 技能原型支持驱动判定字段_V1(原型 = '', 字段 = {}) {
  const 原型名 = String(原型 || '').trim();
  if (原型名 === '结算修正') {
    const 支持字段 = 读取结算修正支持字段_V1(字段?.结算);
    return !!支持字段 && 支持字段.includes('驱动属性') && 支持字段.includes('影响方向');
  }
  const 定义 = SKILL_PROTOTYPE_REGISTRY_V1[原型名];
  const 字段列表 = Array.isArray(定义?.允许字段) ? 定义.允许字段 : [];
  return 字段列表.includes('驱动属性') && 字段列表.includes('影响方向');
}

function 技能原型数值为百分比_V1(字段 = {}) {
  if (!字段 || typeof 字段 !== 'object') return false;
  const 候选字段 = ['数值', '结算倍率', '转化比例', '概率'];
  return 候选字段.some(key => {
    const 原值 = 字段[key];
    if (原值 === undefined || 原值 === null) return false;
    if (Array.isArray(原值)) return 原值.some(item => /%$/.test(String(item ?? '').trim()));
    return /%$/.test(String(原值).trim());
  });
}

function 技能原型命中绝对值默认无驱动_V1(字段 = {}) {
  if (!字段 || typeof 字段 !== 'object') return false;
  const 数值列表 = ['数值', '结算倍率', '转化比例', '概率'].flatMap(key => {
    const 原值 = 字段[key];
    if (原值 === undefined || 原值 === null) return [];
    return Array.isArray(原值) ? 原值 : [原值];
  });
  if (!数值列表.length) return false;
  return 数值列表.every(原值 => {
    if (typeof 原值 === 'number') return Number.isFinite(原值);
    const 文本 = String(原值 ?? '').trim();
    return !!文本 && /^[+-]?\d+(?:\.\d+)?$/.test(文本);
  });
}

function 技能原型需要默认驱动判定_V1(原型 = '', 字段 = {}) {
  if (!字段 || typeof 字段 !== 'object') return false;
  const 原型名 = String(原型 || '').trim();
  if (原型名 === '伤害结算') return false;
  if (!技能原型支持驱动判定字段_V1(原型名, 字段)) return false;
  if (Number(字段.对应等级 || 0) > 0) return false;
  if (原型名 === '时光回溯') return true;
  if (原型名 === '机制授予') return true;
  if (原型名 === '复制执行') return /属性|全部/.test(String(字段.复制类型 || '').trim());
  if (String(字段.目标 || '').trim() === '自身' && 原型名 !== '位移执行') return false;
  if (原型名 === '状态施加') return !技能原型命中绝对值默认无驱动_V1(字段);
  if (原型名 === '状态移除') return true;
  return 技能原型数值为百分比_V1(字段);
}

function 应用技能原型目标驱动契约_V1(原型 = '', 字段 = {}) {
  if (!字段 || typeof 字段 !== 'object') return;
  const 原型名 = String(原型 || '').trim();
  if (原型名 === '伤害结算' || !技能原型支持驱动判定字段_V1(原型名, 字段)) {
    delete 字段.驱动属性;
    delete 字段.影响方向;
    return;
  }
  if (!['机制授予', '时光回溯', '位移执行', '复制执行'].includes(原型名) && String(字段.目标 || '').trim() === '自身') {
    delete 字段.驱动属性;
    delete 字段.影响方向;
    return;
  }
  if (!技能原型需要默认驱动判定_V1(原型名, 字段)) {
    delete 字段.驱动属性;
    delete 字段.影响方向;
    return;
  }
  if (String(字段.驱动属性 ?? '').trim() === '无') {
    delete 字段.驱动属性;
    delete 字段.影响方向;
    return;
  }
  if (!String(字段.驱动属性 || '').trim()) 字段.驱动属性 = 选择技能原型默认驱动属性_V1(原型名, 字段);
  const 方向选项 = 读取原型字段选项_V1(原型名, '影响方向');
  if (!String(字段.影响方向 || '').trim() || !方向选项.includes(String(字段.影响方向 || '').trim())) {
    字段.影响方向 = 选择技能原型默认影响方向_V1(原型名, 字段, '效果强度');
  }
}

var SKILL_MECHANISM_TEMPLATE_COMPILER_TABLE_V1 = Object.freeze(
  Object.fromEntries(
    Object.entries(SKILL_MECHANISM_META_V1).map(([机制名]) => {
      const 原型列表 = SKILL_MECHANISM_NAME_TO_PROTOTYPES_V1[机制名] || [];
      return [
        机制名,
        Object.freeze({
          机制名,
          类型: 原型列表.length ? '可编译' : '纯设计语义',
          原型列表: Object.freeze(原型列表.map(entry => Object.freeze({ ...entry }))),
        }),
      ];
    }),
  ),
);

var 状态施加状态分类矩阵_V1 = Object.freeze({
  持续伤害类: Object.freeze(['中毒', '流血', '灼烧', '冻伤', '持续创伤']),
  恢复资源类: Object.freeze(['持续恢复']),
  硬控封禁类: Object.freeze(['眩晕', '沉默', '致盲', '封技', '麻痹', '混乱', '僵直', '失控', '精神紊乱']),
  防御布尔类: Object.freeze(['霸体', '无视异常']),
  防御数值类: Object.freeze(['护盾', '护卫']),
  增益类: Object.freeze(['隐匿', '探查屏蔽', '共享视野']),
  削弱标记类: Object.freeze(['标记', '嘲讽', '防御剥夺', '精神抗性剥夺', '虚弱', '禁疗', '治疗反转', '迟缓', '资源燃烧', '反噬', '魂力枯竭']),
});

function 读取技能效果持续系数_V1(效果 = {}) {
  const 持续 = Math.max(1, Number(效果?.持续回合 ?? 1));
  if (
    String(效果?.原型 || '').trim() === '状态施加' &&
    状态施加状态分类矩阵_V1.硬控封禁类.includes(String(效果?.状态 || '').trim())
  ) {
    if (持续 <= 1) return 1;
    if (持续 === 2) return 2.5;
    if (持续 === 3) return 4.5;
    return 4.5 + (持续 - 3) * 2;
  }
  return 持续 <= 1 ? 1 : 持续 === 2 ? 1.45 : 持续 === 3 ? 1.8 : 1.8 + (持续 - 3) * 0.25;
}

var 技能执行嵌套效果数组字段表_V1 = Object.freeze(['使用效果', '授予效果', '结算效果']);
var 技能条件分支效果数组字段表_V1 = Object.freeze(['替换效果', '追加效果']);
var 技能定义效果槽位字段表_V1 = Object.freeze([
  '_效果数组',
  ...技能执行嵌套效果数组字段表_V1,
  ...技能条件分支效果数组字段表_V1,
]);

var SKILL_MECHANISM_REGISTRY_V1 = Object.freeze({
  mainArchetypes: Object.freeze(SKILL_ARCHETYPE_POOL_V1),
  secondaryByMain: Object.freeze(SKILL_SECONDARY_BY_MAIN_V1),
  secondaryTypeBias: Object.freeze(SKILL_SECONDARY_TYPE_BIAS_V1),
  机制定义: Object.freeze(SKILL_MECHANISM_META_V1),
  原型定义: SKILL_PROTOTYPE_REGISTRY_V1,
  机制抹消可匹配字段: SKILL_MECHANISM_SUPPRESS_MATCHABLE_FIELDS_V1,
  机制抹消支持原型: SKILL_MECHANISM_SUPPRESS_SUPPORTED_PROTOTYPES_V1,
  机制编译表: SKILL_MECHANISM_TEMPLATE_COMPILER_TABLE_V1,
  仅自身: SKILL_MECHANISM_SELF_ONLY_V1,
  目标语义表: SKILL_MECHANISM_TARGET_SEMANTICS_V1,
  技能状态选项: 技能状态选项_V1,
  战斗内限定技能状态选项: 战斗内限定技能状态选项_V1,
  战斗外可继承技能状态选项: 战斗外可继承技能状态选项_V1,
  日常系统状态选项: 日常系统状态选项_V1,
  状态施加状态分类矩阵: 状态施加状态分类矩阵_V1,
  嵌套效果数组字段: 技能执行嵌套效果数组字段表_V1,
  条件分支效果数组字段: 技能条件分支效果数组字段表_V1,
  技能效果槽位字段: 技能定义效果槽位字段表_V1,
});

if (typeof globalThis !== 'undefined') {
  globalThis.__LWCS_SKILL_MECHANISM_REGISTRY__ = SKILL_MECHANISM_REGISTRY_V1;
  // v3 阶段 2-7：暴露 COST 真值表与评估函数给 mvu_logic_bridge / 检查器 / 生成器调用
  globalThis.__LWCS_SKILL_COST_HELPERS_V1__ = Object.freeze({
    SKILL_UNIT_COST_TABLE_V1,
    SKILL_STANDARD_COST_BY_TIER_V1,
    SKILL_STANDARD_CAST_TIME_V1,
    SKILL_BASE_BUDGET_BY_TIER_V1,
    SKILL_SIDE_EFFECT_TIER_V1,
    判定技能消耗来源_V1,
    解析技能来源_V1,
    解析技能阶段消耗_V1,
    获取标准消耗_V1,
    获取运转标准消耗_V1,
    获取武魂真身运转标准消耗比例_V1,
    构建武魂真身默认承载消耗_V1,
    获取标准前摇_V1,
    获取基础预算_V1,
    计算魂技资源消耗_V1,
    构建魂技消耗结构_V1,
    是武魂真身魂技位_V1,
    计算运转代价能量_V1,
    运转代价能量反推乘积_V1,
    获取单位COST_V1,
    读取技能百分比百分点_V1,
    读取技能比例值_V1,
    读取技能绝对数值_V1,
    计算消耗倍数_V1,
    计算前摇倍数_V1,
    倍数到比例_V1,
    评估副作用预算档_V1,
    评估触发限制档_V1,
    计算单项副作用COST_V1,
    计算技能副作用COST_V1,
    计算单项效果COST_V1,
    计算技能效果累计COST_V1,
    计算魂环年限修正_V1,
    计算魂环年限COST修正_V1,
    计算天赋梯队COST修正_V1,
    读取特殊魂技天赋预算倍率_V1,
    计算武魂真身年限预算倍率_V1,
    计算武魂真身预算基准_V1,
    计算融合相关度预算倍率_V1,
    计算武魂融合技预算基准_V1,
    计算天赋预算利用率_V1,
    计算生成目标COST_V1,
    读取普通回复随机权重表_V1,
    rollSubModelByGrade,
    rollAttributeDirectionByType,
    自动生成机制满足五环恢复增益约束_V1,
    断言技能五环恢复增益不重复_V1,
    SKILL_ATTRIBUTE_HINTS_BY_TYPE_V1,
    评估技能预算_V1,
    让技能符合预算_V1,
    收敛技能到预算区间_V1,
    断言技能预算_V1,
    构建预算可行候选池_V1,
    读取技能机制预算档案_V1,
    估算自动生成机制预算范围_V1,
    应用生成阶段目标COST收口_V1,
    最终同步生成预算承载_V1,
    断言并同步自动生成最终预算_V1,
    条件分支约束_V1,
    // 食物造物直接食用口径：结算/判定修正的增益方向语义，供 BattleDecision 目标侧写共用同一口径
    结算修正是否增益语义_V1,
    判定修正是否增益语义_V1,
    食物造物效果可直接食用_V1,
  });
  globalThis.__LWCS_ITEM_PASSIVE_CONSUMER_V1__ = Object.freeze({
    读取物品被动技能条目_V1,
    装备要求满足_V1,
    编译物品被动消费者_V1,
    编译角色装备被动消费者_V1,
  });
  try { if (globalThis.parent && globalThis.parent !== globalThis) globalThis.parent.__LWCS_ITEM_PASSIVE_CONSUMER_V1__ = globalThis.__LWCS_ITEM_PASSIVE_CONSUMER_V1__; } catch (_错误) {}
  try { if (globalThis.top && globalThis.top !== globalThis) globalThis.top.__LWCS_ITEM_PASSIVE_CONSUMER_V1__ = globalThis.__LWCS_ITEM_PASSIVE_CONSUMER_V1__; } catch (_错误) {}
  try {
    if (typeof window !== 'undefined' && window.parent && window.parent !== window && !window.parent.__LWCS_SKILL_MECHANISM_REGISTRY__) {
      window.parent.__LWCS_SKILL_MECHANISM_REGISTRY__ = SKILL_MECHANISM_REGISTRY_V1;
      window.parent.__LWCS_SKILL_COST_HELPERS_V1__ = globalThis.__LWCS_SKILL_COST_HELPERS_V1__;
    }
  } catch (error) {}
  try {
    if (typeof window !== 'undefined' && window.top && window.top !== window && !window.top.__LWCS_SKILL_MECHANISM_REGISTRY__) {
      window.top.__LWCS_SKILL_MECHANISM_REGISTRY__ = SKILL_MECHANISM_REGISTRY_V1;
      window.top.__LWCS_SKILL_COST_HELPERS_V1__ = globalThis.__LWCS_SKILL_COST_HELPERS_V1__;
    }
  } catch (error) {}
}

var SOUL_SPIRIT_SECONDARY_OPTIONS_V1 = Array.from(
  new Set(Object.values(SKILL_SECONDARY_BY_MAIN_V1).flat().filter(label => !!SKILL_MECHANISM_META_V1[String(label || '').trim()])),
).sort();

function normalizeSkillGradeSymbol(value = 'B') {
  const text = String(value || '').trim().toUpperCase();
  if (['S+', 'S', 'A', 'B', 'C', 'D', 'F'].includes(text)) return text;
  if (/S\+/.test(text)) return 'S+';
  if (/S/.test(text)) return 'S';
  if (/A/.test(text)) return 'A';
  if (/B/.test(text)) return 'B';
  if (/C/.test(text)) return 'C';
  if (/D/.test(text)) return 'D';
  if (/F/.test(text)) return 'F';
  return 'B';
}

function normalizeSkillTableGrade(value = 'B') {
  return normalizeSkillGradeSymbol(value);
}

function 读取技能品质文本_V1(grade = 'B') {
  const 品质 = normalizeSkillGradeSymbol(grade);
  return { F: 'F级_残缺', D: 'D级_粗糙', C: 'C级_劣质', B: 'B级_普通', A: 'A级_优秀', S: 'S级_极品', 'S+': 'S+级_神品' }[品质] || 'B级_普通';
}

function normalizeSkillLegacyTableGrade(value = 'B') {
  const grade = normalizeSkillGradeSymbol(value);
  if (grade === 'S+') return 'S';
  if (grade === 'D' || grade === 'F') return 'C';
  return ['S', 'A', 'B', 'C'].includes(grade) ? grade : 'B';
}

var SKILL_GRADE_ORDER_V1 = Object.freeze({ F: 1, D: 2, C: 3, B: 4, A: 5, S: 6, 'S+': 7 });

function pickSkillGradeTableRangeV1(table = {}, grade = 'B') {
  const safeGrade = normalizeSkillGradeSymbol(grade);
  if (Array.isArray(table?.[safeGrade])) return table[safeGrade];
  const fallbackMap = { 'S+': 'S', S: 'S', A: 'A', B: 'B', C: 'C', D: 'C', F: 'C' };
  const fallback = fallbackMap[safeGrade] || 'B';
  return table?.[fallback] || table?.B || table?.C || [1, 1];
}

function getSecondaryGenerationChance(grade = 'B', ringIndex = 1) {
  const normalizedGrade = normalizeSkillGradeSymbol(grade);
  const table = {
    F: 8,
    D: 14,
    C: 40,
    B: 46,
    A: 16,
    S: 3,
    'S+': 1,
  };
  return Number(table[normalizedGrade] ?? table.B);
}

function getSecondaryDoubleChance(grade = 'B', ringIndex = 1) {
  const normalizedGrade = normalizeSkillGradeSymbol(grade);
  const table = {
    F: 0,
    D: 0,
    C: 2,
    B: 4,
    A: 1,
    S: 0,
    'S+': 0,
  };
  return Number(table[normalizedGrade] ?? 0);
}

function getSecondaryMutationChance(grade = 'B', ringIndex = 1) {
  const normalizedGrade = normalizeSkillGradeSymbol(grade);
  const table = {
    F: 0,
    D: 0,
    C: 1,
    B: 2,
    A: 1,
    S: 0,
    'S+': 0,
  };
  return Number(table[normalizedGrade] ?? 0);
}

function getSecondaryRingScale(ringIndex = 1) {
  const ring = Math.max(1, Number(ringIndex || 1));
  if (ring < 3) return 0;
  if (ring === 3) return 0.35;
  if (ring === 4) return 0.5;
  if (ring === 5) return 0.7;
  if (ring === 6) return 0.85;
  if (ring === 7) return 1.0;
  if (ring === 8) return 1.15;
  return 1.3;
}

var 魂技年限档位阈值_V1 = Object.freeze([100, 1000, 10000, 100000, 1000000]);
var 魂技年限次数进阶阈值_V1 = Object.freeze([1000, 10000, 100000, 1000000]);
var 魂技年限次数字段集合_V1 = new Set([
  '攻击段数',
  '触发次数',
  '抵消次数',
  '分摊人数',
  '驱散数量',
  '窃取数量',
  '转移数量',
  '召唤数量',
]);

function 限幅数值_V1(值, 下限 = -Infinity, 上限 = Infinity) {
  const 数值 = Number(值);
  if (!Number.isFinite(数值)) return Math.max(下限, Math.min(上限, 0));
  return Math.max(下限, Math.min(上限, 数值));
}

function 四舍五入技能数值_V1(值, 位数 = 2) {
  const 数值 = Number(值);
  if (!Number.isFinite(数值)) return 0;
  return Number(数值.toFixed(位数));
}

function 获取魂技位伤害倍率_V1(魂环位 = 1) {
  const 魂技位 = Math.max(1, Math.floor(Number(魂环位 || 1)));
  const 倍率表 = Object.freeze({
    1: 1,
    2: 1.55,
    3: 2.35,
    4: 3.55,
    5: 5.35,
    6: 8,
    7: 1,
    8: 14.5,
    9: 25,
  });
  if (倍率表[魂技位]) return 倍率表[魂技位];
  return 四舍五入技能数值_V1(25 * Math.pow(1.22, 魂技位 - 9), 2);
}

function 获取魂技位防御倍率_V1(魂环位 = 1) {
  const 魂技位 = Math.max(1, Math.floor(Number(魂环位 || 1)));
  const 倍率表 = Object.freeze({
    1: 1,
    2: 1.25,
    3: 1.6,
    4: 2.05,
    5: 2.65,
    6: 3.4,
    7: 1,
    8: 4.4,
    9: 5.6,
  });
  if (倍率表[魂技位]) return 倍率表[魂技位];
  return 四舍五入技能数值_V1(5.6 * Math.pow(1.15, 魂技位 - 9), 2);
}

function 获取年限档位信息_V1(年限 = 0) {
  const 安全年限 = Math.max(0, Math.floor(Number(年限 || 0)));
  let 档位起点 = 0;
  let 档位终点 = 100;
  for (let 序号 = 0; 序号 < 魂技年限档位阈值_V1.length; 序号 += 1) {
    const 当前阈值 = 魂技年限档位阈值_V1[序号];
    if (安全年限 >= 当前阈值) {
      档位起点 = 当前阈值;
      档位终点 = 魂技年限档位阈值_V1[序号 + 1] || 当前阈值 * 10;
    }
  }
  const 档内跨度 = Math.max(1, 档位终点 - 档位起点);
  const 档内进度 = 档位起点 > 0 ? 限幅数值_V1((安全年限 - 档位起点) / 档内跨度, 0, 1) : 0;
  return { 年限: 安全年限, 档位起点, 档位终点, 档内进度 };
}

function 计算年限档内消耗系数_V1(年限 = 0) {
  const 档位 = 获取年限档位信息_V1(年限);
  if (档位.档位起点 <= 0) return 1;
  return 四舍五入技能数值_V1(1 - 0.5 * 档位.档内进度, 4);
}

function 计算年限跨档次数增量_V1(旧年限 = 0, 新年限 = 0) {
  const 旧值 = Math.max(0, Math.floor(Number(旧年限 || 0)));
  const 新值 = Math.max(0, Math.floor(Number(新年限 || 0)));
  if (!(新值 > 旧值)) return 0;
  return 魂技年限次数进阶阈值_V1.filter(阈值 => 旧值 < 阈值 && 新值 >= 阈值).length;
}

function 获取魂技位对应等级_V1(魂环位 = 1) {
  const 安全魂环位 = Math.max(1, Math.floor(Number(魂环位 || 1)));
  return 安全魂环位 * 10 + 1;
}

function 获取魂技品质消耗基准_V1(品质等级 = 'B') {
  const 等级 = normalizeSkillGradeSymbol(品质等级);
  return (
    {
      F: 35,
      D: 40,
      C: 45,
      B: 50,
      A: 55,
      S: 60,
      'S+': 65,
    }[等级] || 50
  );
}

function 计算魂技资源消耗_V1(资源名 = '魂力', 对应等级 = 1, 消耗基准 = 0) {
  const 等级 = Math.max(1, Number(对应等级 || 1));
  const 基准属性 = getBaseStats(等级);
  const 比例 = Math.max(0, Number(消耗基准 || 0)) / 100;
  if (资源名 === '精神力') return Math.round(Math.max(1, Number(基准属性?.men_max || 1)) * 比例);
  if (资源名 === '体力') return Math.round(Math.max(1, Number(基准属性?.vit_max || 1)) * 比例);
  return Math.round(Math.max(1, Number(基准属性?.sp_max || 1)) * 比例);
}

function 构建魂技消耗结构_V1(燃料模型 = '纯耗魂力', 消耗基准 = 50, 魂环位 = 1, 额外消耗 = []) {
  const 基准 = Math.max(1, Number(消耗基准 || 50));
  const 对应等级 = 获取魂技位对应等级_V1(魂环位);
  const 模型 = String(燃料模型 || '纯耗魂力').trim();
  const 分摊表 = {
    精神主导: { 魂力: 0.3, 精神力: 0.7 },
    附加微量精神力: { 魂力: 0.9, 精神力: 0.1 },
    附加常规体力: { 魂力: 0.85, 体力: 0.15 },
    附加大量体力: { 魂力: 0.75, 体力: 0.25 },
    魂神平摊: { 魂力: 0.5, 精神力: 0.5 },
    纯耗魂力: { 魂力: 1 },
  };
  const 分摊 = 分摊表[模型] || 分摊表.纯耗魂力;
  const 消耗 = {};
  [
    ...Object.entries(分摊).map(([资源名, 比例]) => [资源名, 基准 * Math.max(0, Number(比例 || 0))]),
    ...(Array.isArray(额外消耗) ? 额外消耗 : []),
  ]
    .forEach(([资源名, 基准]) => {
      const 数值 = 计算魂技资源消耗_V1(资源名, 对应等级, 基准);
      if (数值 > 0) 消耗[资源名] = Math.max(0, Number(消耗[资源名] || 0)) + 数值;
    });
  return 消耗;
}

function 格式化魂技消耗结构文本_V1(消耗值 = '无') {
  if (消耗值 === undefined || 消耗值 === null || 消耗值 === '') return '无';
  if (typeof 消耗值 !== 'object') return String(消耗值 || '无').trim() || '无';
  const 资源名映射 = { sp: '魂力', vit: '体力', men: '精神力' };
  const 格式化原子 = 值 => {
    if (值 === undefined || 值 === null || 值 === '') return '';
    if (typeof 值 === 'number') return Number.isFinite(值) ? String(Math.max(0, Math.round(值))) : '';
    if (typeof 值 === 'string') return 值.trim();
    return '';
  };
  const 格式化资源对象 = 资源对象 => {
    if (!资源对象 || typeof 资源对象 !== 'object') return 格式化原子(资源对象);
    return Object.entries(资源对象)
      .filter(([资源名]) => !['启动', 'upfront', '维持', 'sustain'].includes(String(资源名 || '')))
      .map(([资源名, 数值]) => {
        const 文本 = 格式化原子(数值);
        if (!文本) return '';
        return `${资源名映射[资源名] || 资源名}:${文本}`;
      })
      .filter(Boolean)
      .join(' | ');
  };
  if (Array.isArray(消耗值)) {
    const 文本 = 消耗值.map(条目 => 格式化魂技消耗结构文本_V1(条目)).filter(条目 => 条目 && 条目 !== '无').join(' | ');
    return 文本 || '无';
  }
  const 启动消耗 = 消耗值.启动 || 消耗值.upfront || null;
  const 维持消耗 = 消耗值.维持 || 消耗值.sustain || null;
  const 基础文本 = 格式化资源对象(启动消耗 || 消耗值);
  const 维持文本 = 格式化资源对象(维持消耗);
  return [基础文本, 维持文本 ? `维持:${维持文本}` : ''].filter(Boolean).join(' ') || '无';
}

function 构建魂技消耗文本_V1(燃料模型 = '纯耗魂力', 消耗基准 = 50, 魂环位 = 1, 额外消耗 = []) {
  return 格式化魂技消耗结构文本_V1(构建魂技消耗结构_V1(燃料模型, 消耗基准, 魂环位, 额外消耗));
}

function 缩放消耗文本数值_V1(消耗文本 = '', 倍率 = 1) {
  const 系数 = Number(倍率);
  if (!Number.isFinite(系数) || Math.abs(系数 - 1) <= 0.0001) return 消耗文本;
  return String(消耗文本 || '无').replace(/(魂力|体力|精神力)([:：])(\d+)(%?)/g, (原文, 名称, 分隔, 数字, 百分号) => {
    if (百分号) return 原文;
    const 新值 = Math.max(0, Math.round(Number(数字 || 0) * 系数));
    return `${名称}${分隔}${新值}`;
  });
}

function 缩放消耗结构数值_V1(消耗值, 倍率 = 1) {
  if (typeof 消耗值 === 'string') return 缩放消耗文本数值_V1(消耗值, 倍率);
  if (Array.isArray(消耗值)) return 消耗值.map(条目 => 缩放消耗结构数值_V1(条目, 倍率));
  if (消耗值 && typeof 消耗值 === 'object') {
    Object.keys(消耗值).forEach(键名 => {
      const 原值 = 消耗值[键名];
      if (['魂力', '体力', '精神力', 'sp', 'vit', 'men'].includes(String(键名))) {
        const 数值 = Number(原值);
        if (Number.isFinite(数值)) 消耗值[键名] = Math.max(0, Math.round(数值 * 倍率));
        return;
      }
      消耗值[键名] = 缩放消耗结构数值_V1(原值, 倍率);
    });
  }
  return 消耗值;
}

function 遍历技能效果数值容器_V1(效果 = {}, 回调 = () => {}) {
  if (!效果 || typeof 效果 !== 'object') return;
  const 已访问 = new Set();
  const 访问 = 容器 => {
    if (!容器 || typeof 容器 !== 'object' || 已访问.has(容器)) return;
    已访问.add(容器);
    回调(容器);
  };
  访问(效果);
  访问(效果.参数);
  访问(效果.面板修改比例);
}

function 缩放容器数值字段_V1(容器 = {}, 字段 = '', 倍率 = 1, 选项 = {}) {
  if (!容器 || typeof 容器 !== 'object' || !(字段 in 容器)) return;
  const 原值 = Number(容器[字段]);
  if (!Number.isFinite(原值) || 原值 <= 0) return;
  const 下限 = Number.isFinite(Number(选项.下限)) ? Number(选项.下限) : 0;
  const 上限 = Number.isFinite(Number(选项.上限)) ? Number(选项.上限) : Infinity;
  const 位数 = Number.isFinite(Number(选项.位数)) ? Number(选项.位数) : 2;
  容器[字段] = 四舍五入技能数值_V1(限幅数值_V1(原值 * 倍率, 下限, 上限), 位数);
}

function 缩放倍率型字段_V1(容器 = {}, 字段 = '', 倍率 = 1, 上限 = 8) {
  if (!容器 || typeof 容器 !== 'object' || !(字段 in 容器)) return;
  const 原值 = Number(容器[字段]);
  if (!Number.isFinite(原值) || Math.abs(原值 - 1) <= 0.001) return;
  const 增幅倍率 = Math.sqrt(Math.max(0.01, Number(倍率 || 1)));
  容器[字段] = 四舍五入技能数值_V1(限幅数值_V1(1 + (原值 - 1) * 增幅倍率, 0, 上限), 2);
}

function 放大比例型字段_V1(容器 = {}, 字段 = '', 倍率 = 1, 上限 = 0.85) {
  if (!容器 || typeof 容器 !== 'object' || !(字段 in 容器)) return;
  const 原值 = Number(容器[字段]);
  if (!Number.isFinite(原值) || 原值 <= 0) return;
  const 基础比例 = 限幅数值_V1(原值, 0, 上限);
  const 指数 = Math.sqrt(Math.max(0.01, Number(倍率 || 1)));
  容器[字段] = 四舍五入技能数值_V1(限幅数值_V1(1 - Math.pow(1 - 基础比例, 指数), 0, 上限), 4);
}

function 技能效果是伤害结算相关_V1(效果 = {}) {
  const 原型 = String(效果?.原型 || '').trim();
  if (原型 === '伤害结算') return true;
  if (原型 === '护盾变化' && /^-/.test(String(效果?.数值 || '').trim())) return true;
  if (原型 === '结算修正') {
    const 结算 = String(效果?.结算 || '').trim();
    const 数值 = parseSkillSignedChangeNumber(效果?.数值);
    if (((结算 === '造成伤害' || 结算 === '受到伤害') && 数值 > 0) || ['防御穿透', '持续伤害引爆', '反击'].includes(结算)) return true;
  }
  if (原型 === '状态施加' && 持续伤害状态集合_V1.has(String(效果?.状态 || '').trim())) return true;
  let 命中 = false;
  遍历技能效果数值容器_V1(效果, 容器 => {
    if (
      容器.威力倍率 !== undefined ||
      容器.每回合伤害 !== undefined ||
      容器.持续伤害 !== undefined ||
      容器.引爆倍率 !== undefined ||
      String(容器.原型 || '').trim() === '护盾变化' && /^-/.test(String(容器.数值 || '').trim())
    )
      命中 = true;
    if (String(容器.属性 || '').trim() === '威力') 命中 = true;
  });
  return 命中;
}

function 技能效果是防御结算相关_V1(效果 = {}) {
  const 原型 = String(效果?.原型 || '').trim();
  if (原型 === '规则防御') return true;
  if (原型 === '护盾变化' && !/^-/.test(String(效果?.数值 || '').trim())) return true;
  if (原型 === '结算修正') {
    const 结算 = String(效果?.结算 || '').trim();
    const 数值 = parseSkillSignedChangeNumber(效果?.数值);
    if ((结算 === '受到伤害' && 数值 < 0) || ['反伤', '伤害转移', '伤害分摊', '消耗分摊', '治疗'].includes(结算)) return true;
  }
  if (原型 === '状态施加' && /霸体|免死|无视异常|护盾|护卫/.test(String(效果?.状态 || '').trim())) return true;
  let 命中 = false;
  遍历技能效果数值容器_V1(效果, 容器 => {
    if (
      容器.护盾值 !== undefined ||
      容器.受到伤害修正 !== undefined ||
      容器.反射比例 !== undefined ||
      容器.分摊比例 !== undefined
    )
      命中 = true;
    if (String(容器.属性 || '').trim() === 'def') 命中 = true;
  });
  return 命中;
}

function 应用伤害类魂技位倍率_V1(效果 = {}, 倍率 = 1) {
  遍历技能效果数值容器_V1(效果, 容器 => {
    ['威力倍率', '每回合伤害', '持续伤害'].forEach(字段 =>
      缩放容器数值字段_V1(容器, 字段, 倍率, { 下限: 0, 位数: 2 }),
    );
    ['引爆倍率'].forEach(字段 => 缩放容器数值字段_V1(容器, 字段, Math.sqrt(倍率), { 下限: 0, 位数: 2 }));
    if (String(容器.属性 || '').trim() === '威力' && Number(容器.数值 || 0) > 1) 缩放倍率型字段_V1(容器, '数值', 倍率, 12);
  });
}

function 应用防御类魂技位倍率_V1(效果 = {}, 倍率 = 1) {
  遍历技能效果数值容器_V1(效果, 容器 => {
    ['护盾值'].forEach(字段 =>
      缩放容器数值字段_V1(容器, 字段, 倍率, { 下限: 0, 位数: 2 }),
    );
    ['受到伤害修正'].forEach(字段 => 放大比例型字段_V1(容器, 字段, 倍率, 0.82));
    ['反射比例', '转移比例'].forEach(字段 => 放大比例型字段_V1(容器, 字段, 倍率, 0.9));
    ['分摊比例'].forEach(字段 => 放大比例型字段_V1(容器, 字段, 倍率, 0.88));
    if (String(容器.属性 || '').trim() === 'def' && Number(容器.数值 || 0) > 1) 缩放倍率型字段_V1(容器, '数值', 倍率, 10);
  });
}

function 是否七九武魂名称_V1(武魂名称 = '') {
  return /[七九]/.test(String(武魂名称 || '').trim());
}

function 是否辅助系名称_V1(系别 = '') {
  return String(系别 || '').trim() === '辅助系';
}

function 读取七九辅助单体目标_V1(值 = '') {
  const 文本 = String(值 || '').trim();
  if (!文本) return '';
  const 目标 = 归一化执行效果作用目标_V1(文本, '');
  if (['自身', '单体', '群体', '全场'].includes(目标)) return '单体';
  if (/自身|全员|全体|全场/.test(文本)) return '单体';
  return '';
}

function 写入七九辅助单体目标_V1(容器 = {}) {
  if (!容器 || typeof 容器 !== 'object' || Array.isArray(容器)) return;
  if ('目标' in 容器) {
    const 单体目标 = 读取七九辅助单体目标_V1(容器.目标);
    if (单体目标) 容器.目标 = 单体目标;
  }
}

function 应用七九辅助魂技基础效果_V1(效果数组 = [], 上下文 = {}) {
  const 当前魂环数量 = Math.max(1, Math.floor(Number(上下文.当前魂环数量 || 1)));
  const 基础倍率 = 四舍五入技能数值_V1(1 + 当前魂环数量 * 0.1, 2);
  const 基础比例 = 四舍五入技能数值_V1(当前魂环数量 * 0.1, 2);
  效果数组.forEach(效果 => {
    写入七九辅助单体目标_V1(效果);
    遍历技能效果数值容器_V1(效果, 容器 => {
      写入七九辅助单体目标_V1(容器);
      const 属性 = String(容器.属性 || '').trim();
      const 动作 = String(容器.动作 || '').trim();
      if (['str', 'def', 'agi', 'men_max', 'sp_max', 'vit_max', '威力', '控制', '掌控', '速度'].includes(属性) && /倍率提升|提升/.test(动作)) {
        容器.数值 = 基础倍率;
      }
      if (容器.面板修改比例 && typeof 容器.面板修改比例 === 'object') {
        Object.keys(容器.面板修改比例).forEach(键名 => {
          if (Number(容器.面板修改比例[键名] || 0) > 1) 容器.面板修改比例[键名] = 基础倍率;
        });
      }
    });
  });
}

function 应用生成魂技固化数值规则_V1(效果数组 = [], 上下文 = {}) {
  if (!Array.isArray(效果数组) || !效果数组.length) return 效果数组;
  const 来源类别 = String(上下文.来源类别 || 上下文.sourceCategory || '').trim() || '魂技';
  const 是魂兽自创魂技 = 来源类别 === '魂兽自创魂技';
  if (来源类别 !== '魂技' && !是魂兽自创魂技) return 效果数组;
  const 魂环位 = Math.max(1, Math.floor(Number(上下文.魂环位 || 上下文.ringIndex || 1)));
  if (魂环位 === 7 && !是魂兽自创魂技) return 效果数组;
  const 系别 = String(上下文.系别 || 上下文.type || '').trim();
  const 武魂名称 = String(上下文.武魂名称 || 上下文.martialSoulName || '').trim();
  if (是否辅助系名称_V1(系别) && 是否七九武魂名称_V1(武魂名称)) {
    应用七九辅助魂技基础效果_V1(效果数组, 上下文);
    return 效果数组;
  }
  const 伤害倍率 = 是魂兽自创魂技 && 魂环位 === 7 ? 10.8 : 获取魂技位伤害倍率_V1(魂环位);
  const 防御倍率 = 是魂兽自创魂技 && 魂环位 === 7 ? 3.9 : 获取魂技位防御倍率_V1(魂环位);
  效果数组.forEach(效果 => {
    if (技能效果是伤害结算相关_V1(效果)) 应用伤害类魂技位倍率_V1(效果, 伤害倍率);
    if (技能效果是防御结算相关_V1(效果)) 应用防御类魂技位倍率_V1(效果, 防御倍率);
  });
  if (!是否辅助系名称_V1(系别) && 是否七九武魂名称_V1(武魂名称)) {
    效果数组.forEach(效果 => {
      if (技能效果是伤害结算相关_V1(效果)) 应用伤害类魂技位倍率_V1(效果, 1.4);
    });
  }
  return 效果数组;
}

function 应用年限变化到技能效果数组_V1(skill = {}, 旧年限 = 0, 新年限 = 0) {
  if (!skill || typeof skill !== 'object' || !Array.isArray(skill._效果数组)) return false;
  const 旧值 = Math.max(0, Math.floor(Number(旧年限 || 0)));
  const 新值 = Math.max(0, Math.floor(Number(新年限 || 0)));
  if (!(新值 > 旧值)) return false;
  const 旧消耗系数 = 计算年限档内消耗系数_V1(旧值);
  const 新消耗系数 = 计算年限档内消耗系数_V1(新值);
  const 消耗缩放系数 = 旧消耗系数 > 0 ? 新消耗系数 / 旧消耗系数 : 1;
  if (Math.abs(消耗缩放系数 - 1) > 0.0001) {
    if (skill.消耗 !== undefined) skill.消耗 = 缩放消耗结构数值_V1(skill.消耗, 消耗缩放系数);
  }
  const 次数增量 = 计算年限跨档次数增量_V1(旧值, 新值);
  if (次数增量 > 0) {
    skill._效果数组.forEach(效果 => {
      遍历技能效果数值容器_V1(效果, 容器 => {
        魂技年限次数字段集合_V1.forEach(字段 => {
          if (!(字段 in 容器)) return;
          const 原值 = Number(容器[字段]);
          if (!Number.isFinite(原值) || 原值 <= 0) return;
          容器[字段] = Math.max(1, Math.round(原值 + 次数增量));
        });
      });
    });
  }
  return Math.abs(消耗缩放系数 - 1) > 0.0001 || 次数增量 > 0;
}

function getPotentialSecondaryOptionsByType(type = '强攻系') {
  const mainTable = SKILL_MAIN_MECHANIC_DISTRIBUTION_V1[type] || SKILL_MAIN_MECHANIC_DISTRIBUTION_V1['强攻系'] || [];
  const mains = Array.from(new Set(mainTable.map(item => item?.main).filter(Boolean)));
  const typeBias = SKILL_SECONDARY_TYPE_BIAS_V1[type] || [];
  return Array.from(new Set([...typeBias, ...mains.flatMap(main => SKILL_SECONDARY_BY_MAIN_V1[main] || [])]));
}

function pickUniqueRandom(list = [], count = 1) {
  const pool = Array.isArray(list) ? [...list] : [];
  const result = [];
  while (pool.length > 0 && result.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    result.push(pool[index]);
    pool.splice(index, 1);
  }
  return result;
}

function buildFuelModelByType(type, main) {
  if (type === '精神系') return '精神主导';
  if (type === '食物系') return '纯耗魂力';
  if (type === '控制系') return main === '控制类' || main === '削弱类' ? '附加微量精神力' : '纯耗魂力';
  if (type === '治疗系') return '附加微量精神力';
  if (type === '辅助系') return '魂神平摊';
  if (type === '元素系') return '魂神平摊';
  if (type === '防御系') return main === '防御类' ? '附加常规体力' : '纯耗魂力';
  if (type === '敏攻系') return main === '位移类' ? '附加常规体力' : '纯耗魂力';
  return '纯耗魂力';
}

function 读取自动生成初始消耗前摇倍率_V1(blueprint = {}, 上下文 = {}) {
  const 品质符号 = normalizeSkillGradeSymbol(上下文?.grade || 上下文?.品质 || 上下文?.quality || 'B');
  const 品质倍率 = Math.max(0.05, 获取魂技品质消耗基准_V1(品质符号) / 50);
  const 释放形态 = String(blueprint?.释放形态 || 上下文?.释放形态 || '直接生效').trim() || '直接生效';
  const 来源 = String(上下文?.sourceCategory || 上下文?.来源 || 上下文?.来源类别 || '魂技').trim() || '魂技';
  const 非魂技被动 = (上下文?.passiveMode === true || 释放形态 === '被动') && 来源 !== '魂技';
  const 释放倍率 = 非魂技被动 ? 0.35 : 1;
  const 摘要 = 来源 === '魂技'
    ? (上下文?.预算评估摘要 && typeof 上下文.预算评估摘要 === 'object'
      ? 上下文.预算评估摘要
      : 估算自动生成预算摘要_V1(上下文))
    : null;
  const 运转基准 = Math.max(0.5, Number(摘要?.运转基准 || 0));
  const 最低有效COST = Math.max(0, Number(摘要?.低COST线 || 0));
  const 最低代价能量 = 运转基准 > 0 && 最低有效COST > 0
    ? Math.max(0.05, Math.min(Math.cbrt(16), (最低有效COST + 技能预算超预算容差_V1) / 运转基准))
    : 0;
  const 最低倍率 = 最低代价能量 > 0
    ? (最低代价能量 < 1 ? Math.sqrt(最低代价能量) : Math.pow(最低代价能量, 1.5))
    : 0.5;
  const 方案 = 上下文?.消耗前摇收口方案;
  const 倍率上限 = Math.max(
    0.5,
    Math.min(
      1.5,
      Number(方案?.消耗?.倍率上限 || 1.5),
      Number(方案?.前摇?.倍率上限 || 1.5),
    ),
  );
  const 总倍率 = Math.max(0.5, Math.min(倍率上限, Math.max(品质倍率 * 释放倍率, 最低倍率)));
  return {
    品质倍率: Number(品质倍率.toFixed(3)),
    释放倍率: Number(释放倍率.toFixed(3)),
    消耗倍率: Number(总倍率.toFixed(3)),
    前摇倍率: Number(总倍率.toFixed(3)),
  };
}

function rollWeightedBucket(table = [], roll = 1) {
  const normalizedRoll = Math.max(1, Math.min(100, Number(roll) || 1));
  let cursor = 0;
  for (const item of table) {
    cursor += Number(item.weight || 0);
    if (normalizedRoll <= cursor) return item.value;
  }
  return table[table.length - 1]?.value || null;
}

function judgeSkillGrade(talentTier, ringAge, ringIndex, compatibility = 100, sourceQuality = '') {
  const roll = Math.floor(Math.random() * 100) + 1;
  const talentScore = { 绝世妖孽: 100, 顶级天才: 80, 天才: 60, 优秀: 40, 正常: 20, 劣等: 0, 天赋极差: -100 }[talentTier] || 20;
  const normalizedQuality = normalizeSoulSpiritQuality(sourceQuality);
  const sourceQualityScore =
    {
      F: -55,
      D: -30,
      C: -8,
      B: 18,
      A: 46,
      S: 74,
      'S+': 96,
    }[normalizedQuality] || 0;
  const totalScore = roll + talentScore + sourceQualityScore;
  const grade =
    totalScore >= 248
      ? 'S+'
      : totalScore >= 220
        ? 'S'
        : totalScore >= 152
          ? 'A'
          : totalScore >= 96
            ? 'B'
            : totalScore >= 52
              ? 'C'
              : totalScore >= 18
                ? 'D'
                : 'F';
  return {
    grade,
    totalScore,
    quality: 读取技能品质文本_V1(grade),
    scoreRoll: roll,
    sourceQuality: normalizedQuality || '无',
  };
}

function rollMainMechanicByGrade(type, grade, roll, ringIndex = 1, options = {}) {
  const safeGrade = normalizeSkillTableGrade(grade);
  const context = { ...(options || {}), type, grade: safeGrade, ringIndex };
  const 排除大类 = new Set(Array.isArray(options?.排除主机制大类) ? options.排除主机制大类.map(项 => String(项 || '').trim()).filter(Boolean) : []);
  let table = 过滤合法生成主机制大类权重表_V1(
    SKILL_MAIN_MECHANIC_DISTRIBUTION_V1[type] || SKILL_MAIN_MECHANIC_DISTRIBUTION_V1['强攻系'],
    context,
  ).filter(item => !排除大类.has(String(item?.main || '').trim()));
  const gradeCap = { F: 60, D: 70, C: 80, B: 90, A: 100, S: 100, 'S+': 100 }[safeGrade] || 100;
  const effectiveRoll = Math.min(Math.max(1, roll), gradeCap);
  if (!table.length) return '';
  const 权重表 = table.map(item => ({
    value: item.main,
    weight: Math.max(1, Number(item.max || 0) - Number(item.min || 0) + 1),
  }));
  return rollWeightedBucket(normalizeWeightedTableTotal(权重表), effectiveRoll) || table[0]?.main || '';
}

function normalizeWeightedTableTotal(table = [], totalWeight = 100) {
  const source = Array.isArray(table)
    ? table
        .map(item => ({
          value: item?.value,
          weight: Math.max(0, Number(item?.weight || 0)),
        }))
        .filter(item => item.value && item.weight > 0)
    : [];
  if (!source.length) return [];
  const safeTotal = Math.max(1, Math.floor(Number(totalWeight || 100)));
  const currentTotal = source.reduce((sum, item) => sum + item.weight, 0);
  if (!(currentTotal > 0)) return source;
  let assigned = 0;
  return source.map((item, index) => {
    if (index === source.length - 1) {
      return { ...item, weight: Math.max(1, safeTotal - assigned) };
    }
    const scaled = Math.max(1, Math.round((item.weight / currentTotal) * safeTotal));
    assigned += scaled;
    return { ...item, weight: scaled };
  });
}

function isAutoGeneratedExclusiveMainArchetype(archetype = '') {
  return AUTO_GENERATED_EXCLUSIVE_MAIN_ARCHETYPES_V1.has(String(archetype || '').trim());
}

function isRouguRabbitFlavorSource(text = '') {
  const safeText = String(text || '').trim();
  if (!safeText) return false;
  return /(柔骨兔|柔骨|骨兔|月兔|玉兔|魅兔|兔)/.test(safeText);
}

function rebalanceWeightedTableWithPreferredValue(table = [], preferredValue = '', preferredWeight = 0) {
  const source = Array.isArray(table) ? table.map(item => ({ ...item })) : [];
  const target = source.find(item => item?.value === preferredValue);
  if (!target || !(preferredWeight > 0)) return source;
  const remainingWeight = Math.max(0, 100 - preferredWeight);
  const otherItems = source.filter(item => item?.value !== preferredValue);
  const otherTotal = otherItems.reduce((sum, item) => sum + Math.max(0, Number(item?.weight || 0)), 0);
  target.weight = preferredWeight;
  if (!(otherTotal > 0)) return source;
  let assigned = 0;
  otherItems.forEach((item, index) => {
    if (index === otherItems.length - 1) {
      item.weight = Math.max(0, remainingWeight - assigned);
      return;
    }
    const scaled = Math.max(0, Math.round((Math.max(0, Number(item.weight || 0)) / otherTotal) * remainingWeight));
    item.weight = scaled;
    assigned += scaled;
  });
  return source;
}

function buildDefenseArchetypeWeightedTableByContext(grade, type = '强攻系', sourceName = '') {
  const safeGrade = normalizeSkillTableGrade(grade);
  const baseTables = {
    C: [
      { value: '护盾', weight: 48 },
      { value: '承伤修正', weight: 23 },
      { value: '免伤', weight: 16 },
      { value: '无敌金身', weight: 5 },
      { value: '伤害反射', weight: 4 },
      { value: '伤害分摊', weight: 4 },
      { value: '消耗分摊', weight: 2 },
    ],
    B: [
      { value: '护盾', weight: 30 },
      { value: '承伤修正', weight: 18 },
      { value: '免伤', weight: 18 },
      { value: '霸体', weight: 15 },
      { value: '免死/锁血', weight: 5 },
      { value: '无敌金身', weight: 6 },
      { value: '伤害反射', weight: 4 },
      { value: '伤害分摊', weight: 4 },
      { value: '消耗分摊', weight: 3 },
    ],
    A: [
      { value: '护盾', weight: 20 },
      { value: '承伤修正', weight: 18 },
      { value: '免伤', weight: 22 },
      { value: '霸体', weight: 12 },
      { value: '免死/锁血', weight: 8 },
      { value: '无敌金身', weight: 9 },
      { value: '伤害反射', weight: 6 },
      { value: '伤害分摊', weight: 5 },
      { value: '消耗分摊', weight: 4 },
    ],
    S: [
      { value: '护盾', weight: 12 },
      { value: '承伤修正', weight: 13 },
      { value: '免伤', weight: 20 },
      { value: '霸体', weight: 10 },
      { value: '免死/锁血', weight: 16 },
      { value: '无敌金身', weight: 15 },
      { value: '伤害反射', weight: 8 },
      { value: '伤害分摊', weight: 6 },
      { value: '消耗分摊', weight: 5 },
    ],
  };
  let table = (baseTables[safeGrade] || baseTables.B).map(item => ({ ...item }));
    if (type === '防御系') {
      table = rebalanceWeightedTableWithPreferredValue(table, '无敌金身', { C: 2, B: 3, A: 4, S: 6 }[safeGrade] || 3);
      table = rebalanceWeightedTableWithPreferredValue(table, '伤害反射', { C: 12, B: 15, A: 20, S: 26 }[safeGrade] || 15);
      table = rebalanceWeightedTableWithPreferredValue(table, '伤害分摊', { C: 4, B: 5, A: 6, S: 8 }[safeGrade] || 5);
      table = rebalanceWeightedTableWithPreferredValue(table, '消耗分摊', { C: 3, B: 4, A: 5, S: 7 }[safeGrade] || 4);
  } else if (type === '敏攻系') {
    table = rebalanceWeightedTableWithPreferredValue(table, '无敌金身', { C: 16, B: 24, A: 34, S: 45 }[safeGrade] || 24);
    table = rebalanceWeightedTableWithPreferredValue(table, '免伤', { C: 24, B: 34, A: 44, S: 56 }[safeGrade] || 34);
  } else if (type === '强攻系') {
    table = rebalanceWeightedTableWithPreferredValue(table, '无敌金身', { C: 8, B: 12, A: 18, S: 24 }[safeGrade] || 12);
    table = rebalanceWeightedTableWithPreferredValue(table, '伤害反射', { C: 10, B: 16, A: 24, S: 32 }[safeGrade] || 16);
  } else if (type === '控制系') {
    table = rebalanceWeightedTableWithPreferredValue(table, '伤害分摊', { C: 14, B: 22, A: 30, S: 40 }[safeGrade] || 22);
  } else if (type === '辅助系') {
    table = rebalanceWeightedTableWithPreferredValue(table, '伤害分摊', { C: 18, B: 28, A: 38, S: 48 }[safeGrade] || 28);
    table = rebalanceWeightedTableWithPreferredValue(table, '消耗分摊', { C: 12, B: 20, A: 28, S: 36 }[safeGrade] || 20);
  } else if (type === '治疗系') {
    table = rebalanceWeightedTableWithPreferredValue(table, '伤害分摊', { C: 12, B: 20, A: 28, S: 36 }[safeGrade] || 20);
    table = rebalanceWeightedTableWithPreferredValue(table, '消耗分摊', { C: 8, B: 14, A: 20, S: 28 }[safeGrade] || 14);
  }
  if (isRouguRabbitFlavorSource(sourceName)) {
    table = rebalanceWeightedTableWithPreferredValue(table, '无敌金身', { C: 30, B: 45, A: 58, S: 72 }[safeGrade] || 45);
  }
  return table;
}

function buildSpecialRuleArchetypeWeightedTableByContext(grade, type = '强攻系') {
  const safeGrade = normalizeSkillTableGrade(grade);
  const baseTables = {
    C: [
      { value: '召唤', weight: 8 },
      { value: '分身', weight: 21 },
      { value: '强制绑定/锁定', weight: 10 },
      { value: '反制', weight: 10 },
      { value: '转化', weight: 8 },
      { value: '状态交换', weight: 3 },
      { value: '复制', weight: 2 },
      { value: '规则改写', weight: 2 },
      { value: '状态转移', weight: 1 },
      { value: '引爆持续伤害', weight: 1 },
      { value: '斩盾', weight: 1 },
      { value: '吞噬', weight: 2 },
      { value: '能力共享', weight: 2 },
      { value: '机制抹消', weight: 1 },
    ],
    B: [
      { value: '召唤', weight: 10 },
      { value: '分身', weight: 18 },
      { value: '强制绑定/锁定', weight: 16 },
      { value: '反制', weight: 12 },
      { value: '转化', weight: 10 },
      { value: '状态交换', weight: 6 },
      { value: '复制', weight: 4 },
      { value: '规则改写', weight: 3 },
      { value: '状态转移', weight: 2 },
      { value: '引爆持续伤害', weight: 2 },
      { value: '斩盾', weight: 1 },
      { value: '吞噬', weight: 2 },
      { value: '能力共享', weight: 2 },
      { value: '机制抹消', weight: 2 },
    ],
    A: [
      { value: '召唤', weight: 12 },
      { value: '分身', weight: 12 },
      { value: '复制', weight: 10 },
      { value: '反制', weight: 16 },
      { value: '转化', weight: 9 },
      { value: '状态交换', weight: 12 },
      { value: '强制绑定/锁定', weight: 10 },
      { value: '规则改写', weight: 10 },
      { value: '状态转移', weight: 5 },
      { value: '引爆持续伤害', weight: 4 },
      { value: '斩盾', weight: 3 },
      { value: '吞噬', weight: 4 },
      { value: '能力共享', weight: 4 },
      { value: '机制抹消', weight: 3 },
    ],
    S: [
      { value: '召唤', weight: 12 },
      { value: '分身', weight: 10 },
      { value: '复制', weight: 9 },
      { value: '反制', weight: 15 },
      { value: '转化', weight: 8 },
      { value: '状态交换', weight: 10 },
      { value: '强制绑定/锁定', weight: 9 },
      { value: '规则改写', weight: 12 },
      { value: '状态转移', weight: 8 },
      { value: '引爆持续伤害', weight: 5 },
      { value: '斩盾', weight: 5 },
      { value: '吞噬', weight: 5 },
      { value: '能力共享', weight: 5 },
      { value: '机制抹消', weight: 4 },
      { value: '炸环', weight: 3 },
      { value: '时光回溯', weight: 2 },
      { value: '气运干涉', weight: 4 },
    ],
  };
  let table = (baseTables[safeGrade] || baseTables.B).map(item => ({ ...item }));
  table = table.filter(item => 技能机制满足品质门槛_V1(item?.value, { grade }) && 机制具备共享原型编译_V1(item?.value));
  if (type === '精神系') {
    table = rebalanceWeightedTableWithPreferredValue(table, '状态转移', { C: 18, B: 28, A: 38, S: 50 }[safeGrade] || 28);
    table = rebalanceWeightedTableWithPreferredValue(table, '吞噬', { C: 14, B: 22, A: 32, S: 44 }[safeGrade] || 22);
    table = rebalanceWeightedTableWithPreferredValue(table, '能力共享', { C: 10, B: 16, A: 24, S: 34 }[safeGrade] || 16);
    table = rebalanceWeightedTableWithPreferredValue(table, '机制抹消', { C: 12, B: 20, A: 30, S: 40 }[safeGrade] || 20);
  }
  if (type === '控制系') {
    table = rebalanceWeightedTableWithPreferredValue(table, '状态转移', { C: 12, B: 20, A: 28, S: 36 }[safeGrade] || 20);
    table = rebalanceWeightedTableWithPreferredValue(table, '机制抹消', { C: 14, B: 22, A: 34, S: 46 }[safeGrade] || 22);
  }
  if (type === '强攻系') {
    table = rebalanceWeightedTableWithPreferredValue(table, '斩盾', { C: 10, B: 16, A: 24, S: 32 }[safeGrade] || 16);
  }
  if (type === '敏攻系') {
    table = rebalanceWeightedTableWithPreferredValue(table, '斩盾', { C: 14, B: 22, A: 30, S: 38 }[safeGrade] || 22);
  }
  if (type === '元素系') {
    table = rebalanceWeightedTableWithPreferredValue(table, '斩盾', { C: 12, B: 20, A: 30, S: 40 }[safeGrade] || 20);
    table = rebalanceWeightedTableWithPreferredValue(table, '引爆持续伤害', { C: 16, B: 24, A: 34, S: 46 }[safeGrade] || 24);
    table = rebalanceWeightedTableWithPreferredValue(table, '吞噬', { C: 12, B: 18, A: 26, S: 34 }[safeGrade] || 18);
  }
  if (type === '辅助系' || type === '治疗系') {
    table = rebalanceWeightedTableWithPreferredValue(table, '能力共享', { C: 14, B: 22, A: 32, S: 42 }[safeGrade] || 22);
  }
  if (type === '食物系') {
    table = rebalanceWeightedTableWithPreferredValue(table, '能力共享', { C: 12, B: 18, A: 28, S: 36 }[safeGrade] || 18);
  }
  return table;
}

function getSpecialRuleExpansionChance(grade = 'B', type = '强攻系') {
  const gradeKey = normalizeSkillGradeSymbol(grade);
  const base = { F: 2, D: 4, C: 6, B: 10, A: 16, S: 22, 'S+': 25 }[gradeKey] || 10;
  const bonus =
    {
      精神系: 10,
      控制系: 8,
      元素系: 6,
      辅助系: 4,
      治疗系: 4,
      食物系: 3,
    }[String(type || '强攻系').trim()] || 0;
  return Math.max(4, Math.min(40, base + bonus));
}

function rollSpecialRuleArchetypeByContext(grade, type = '强攻系', roll = 1) {
  const sourceTable = buildSpecialRuleArchetypeWeightedTableByContext(grade, type);
  const baseTable = normalizeWeightedTableTotal(
    sourceTable.filter(item => !SPECIAL_RULE_EXPANDED_ARCHETYPE_SET_V1.has(String(item?.value || '').trim())),
  );
  const expandedTable = normalizeWeightedTableTotal(
    sourceTable.filter(item => SPECIAL_RULE_EXPANDED_ARCHETYPE_SET_V1.has(String(item?.value || '').trim())),
  );
  const normalizedRoll = Math.max(1, Math.min(100, Number(roll) || 1));
  const expansionChance = expandedTable.length ? getSpecialRuleExpansionChance(grade, type) : 0;
  if (expandedTable.length && normalizedRoll <= expansionChance) {
    const expansionRoll = Math.max(1, Math.min(100, Math.ceil((normalizedRoll / Math.max(1, expansionChance)) * 100)));
    return rollWeightedBucket(expandedTable, expansionRoll) || expandedTable[0]?.value || '规则改写';
  }
  if (baseTable.length) {
    const baseWindow = Math.max(1, 100 - expansionChance);
    const shiftedRoll = Math.max(1, normalizedRoll - expansionChance);
    const baseRoll = Math.max(1, Math.min(100, Math.ceil((shiftedRoll / baseWindow) * 100)));
    return rollWeightedBucket(baseTable, baseRoll) || baseTable[0]?.value || '规则改写';
  }
  return rollWeightedBucket(expandedTable, 50) || expandedTable[0]?.value || '规则改写';
}

function 机制是合法生成主机制_V1(机制名 = '', context = {}) {
  const 机制 = String(机制名 || '').trim();
  if (!机制 || ['无', '无效', '未设置'].includes(机制)) return false;
  if (自动生成禁止主机制原型集合_V1.has(机制)) return false;
  const 系别 = String(context?.type || context?.系别 || '').trim();
  const 魂环位 = Math.max(1, Number(context?.ringIndex ?? context?.魂环位 ?? 1) || 1);
  if (['辅助系', '治疗系'].includes(系别) && 魂环位 <= 2 && ['直接伤害', '多段伤害', '持续伤害'].includes(机制)) return false;
  if (['辅助系', '治疗系', '食物系'].includes(系别) && 魂环位 <= 2 && ['直接伤害', '多段伤害', '持续伤害', '硬控', '节奏打断', '迟缓', '多属性削弱', '掌控压制', '掌控提升', '元素封禁', '禁疗'].includes(机制)) return false;
  return (
    SKILL_MECHANISM_META_V1[机制]?.可主机制 === true &&
    机制具备共享原型编译_V1(机制) &&
    技能机制满足品质门槛_V1(机制, context)
  );
}

function 机制大类适配自动生成系别_V1(主机制大类 = '', context = {}) {
  const 大类 = String(主机制大类 || '').trim();
  const 系别 = String(context?.type || context?.系别 || '').trim();
  const 魂环位 = Math.max(1, Number(context?.ringIndex ?? context?.魂环位 ?? 1) || 1);
  if (大类 === '伤害类' && ['辅助系', '治疗系'].includes(系别) && 魂环位 <= 2) return false;
  if (['控制类', '削弱类', '位移类'].includes(大类) && ['辅助系', '治疗系', '食物系'].includes(系别) && 魂环位 <= 2) return false;
  return !!大类;
}

function 机制属于当前系别主候选池_V1(机制名 = '', context = {}) {
  const 机制 = String(机制名 || '').trim();
  if (!机制) return false;
  const 大类 = findMainMechanicGroupByArchetype(机制);
  if (!机制大类适配自动生成系别_V1(大类, context)) return false;
  const 系别 = String(context?.type || context?.系别 || '强攻系').trim() || '强攻系';
  const 品质 = normalizeSkillTableGrade(context?.gradeOverride || context?.grade || context?.sourceQuality || context?.品质 || 'B');
  if (!(SKILL_MAIN_MECHANIC_DISTRIBUTION_V1[系别] || SKILL_MAIN_MECHANIC_DISTRIBUTION_V1['强攻系'] || []).some(item => String(item?.main || '').trim() === 大类)) return false;
  if (大类 === '防御类') return buildDefenseArchetypeWeightedTableByContext(品质, 系别, context?.sourceName || '').some(item => String(item?.value || '').trim() === 机制);
  if (大类 === '特殊规则类') return buildSpecialRuleArchetypeWeightedTableByContext(品质, 系别).some(item => String(item?.value || '').trim() === 机制);
  return (Array.isArray(SKILL_ARCHETYPE_POOL_V1[大类]) ? SKILL_ARCHETYPE_POOL_V1[大类] : []).includes(机制);
}

function 过滤合法生成主机制大类权重表_V1(table = [], context = {}) {
  return (Array.isArray(table) ? table : []).filter(item => {
    const 大类 = String(item?.main || '').trim();
    return 机制大类适配自动生成系别_V1(大类, context) && !!查找合法生成主机制原型_V1(大类, context);
  });
}

function 过滤合法生成主机制权重表_V1(table = [], context = {}) {
  return (Array.isArray(table) ? table : []).filter(item => 机制是合法生成主机制_V1(item?.value, context));
}

function 读取普通回复随机原型池_V1() {
  return ['魂力恢复', '体力恢复', '精神恢复'];
}

var 普通回复随机权重表_V1 = Object.freeze({
  F: Object.freeze([
    Object.freeze({ value: '魂力恢复', weight: 50 }),
    Object.freeze({ value: '体力恢复', weight: 35 }),
    Object.freeze({ value: '精神恢复', weight: 15 }),
  ]),
  D: Object.freeze([
    Object.freeze({ value: '魂力恢复', weight: 50 }),
    Object.freeze({ value: '体力恢复', weight: 35 }),
    Object.freeze({ value: '精神恢复', weight: 15 }),
  ]),
  C: Object.freeze([
    Object.freeze({ value: '魂力恢复', weight: 50 }),
    Object.freeze({ value: '体力恢复', weight: 35 }),
    Object.freeze({ value: '精神恢复', weight: 15 }),
  ]),
  B: Object.freeze([
    Object.freeze({ value: '魂力恢复', weight: 45 }),
    Object.freeze({ value: '体力恢复', weight: 35 }),
    Object.freeze({ value: '精神恢复', weight: 20 }),
  ]),
  A: Object.freeze([
    Object.freeze({ value: '魂力恢复', weight: 1 }),
    Object.freeze({ value: '体力恢复', weight: 1 }),
    Object.freeze({ value: '精神恢复', weight: 1 }),
  ]),
  S: Object.freeze([
    Object.freeze({ value: '魂力恢复', weight: 1 }),
    Object.freeze({ value: '体力恢复', weight: 1 }),
    Object.freeze({ value: '精神恢复', weight: 1 }),
  ]),
  'S+': Object.freeze([
    Object.freeze({ value: '魂力恢复', weight: 1 }),
    Object.freeze({ value: '体力恢复', weight: 1 }),
    Object.freeze({ value: '精神恢复', weight: 1 }),
  ]),
});

function 读取普通回复随机权重表_V1(品质 = 'B') {
  const 档位 = normalizeSkillTableGrade(品质);
  return (普通回复随机权重表_V1[档位] || 普通回复随机权重表_V1.B).map(项 => ({ ...项 }));
}

var 普通恢复原型资源映射_V1 = Object.freeze({
  魂力恢复: '魂力',
  体力恢复: '生命',
  精神恢复: '精神力',
});
var 自动生成增益属性集合_V1 = new Set(['力量', '防御', '敏捷', '魂力', '精神力']);
var 自动生成恢复资源集合_V1 = new Set(['魂力', '体力', '精神力']);
var 自动生成全属性增益列表_V1 = Object.freeze(['力量', '防御', '敏捷', '魂力', '精神力']);
var 自动生成全恢复资源列表_V1 = Object.freeze(['魂力', '体力', '精神力']);

function 读取自动生成同武魂数据_V1(context = {}) {
  if (context?.武魂数据 && typeof context.武魂数据 === 'object' && !Array.isArray(context.武魂数据)) return context.武魂数据;
  const 角色 = context?.角色 && typeof context.角色 === 'object' && !Array.isArray(context.角色) ? context.角色 : null;
  if (!角色) return null;
  const 当前魂环数据 = context?.魂环数据 || context?.ringData || null;
  if (当前魂环数据 && typeof 当前魂环数据 === 'object') {
    for (const [, 武魂数据] of 取角色武魂条目_V1(角色)) {
      if (取武魂全部魂环条目_V1(武魂数据).some(条目 => 条目?.魂环数据 === 当前魂环数据)) return 武魂数据;
    }
  }
  const 武魂名称 = String(context?.martialSoulName || context?.武魂名称 || context?.textContext?.martialSoulName || '').trim();
  if (武魂名称) {
    const 命名武魂 = 取角色武魂条目_V1(角色).find(([键, 武魂数据]) =>
      键 === 武魂名称 || String(武魂数据?.表象名称 || '').trim() === 武魂名称);
    if (命名武魂?.[1]) return 命名武魂[1];
  }
  return null;
}

function 创建恢复增益重复条目_V1() {
  return {
    属性单项: new Set(),
    属性多项: new Set(),
    属性全项: false,
    恢复单项: new Set(),
    恢复多项: new Set(),
    恢复全项: false,
  };
}

function 创建恢复增益重复账本_V1() {
  return {
    属性单项五环: new Set(),
    属性多项三环: new Set(),
    属性全项三环: false,
    恢复单项五环: new Set(),
    恢复多项三环: new Set(),
    恢复全项三环: false,
  };
}

function 创建恢复增益重复账本缓存_V1() {
  return {
    有当前魂环: new WeakMap(),
    无当前魂环: new WeakMap(),
  };
}

function 清空恢复增益重复账本缓存_V1(缓存) {
  if (!缓存 || typeof 缓存 !== 'object') return;
  缓存.有当前魂环 = new WeakMap();
  缓存.无当前魂环 = new WeakMap();
}

function 读取恢复增益重复账本缓存_V1(缓存, 武魂数据, 当前魂环数据, 当前魂环位) {
  if (!缓存 || !武魂数据 || typeof 武魂数据 !== 'object') return null;
  const 键 = String(Math.max(1, Math.floor(Number(当前魂环位 || 1)) || 1));
  if (当前魂环数据 && typeof 当前魂环数据 === 'object') {
    if (!(缓存.有当前魂环 instanceof WeakMap)) 缓存.有当前魂环 = new WeakMap();
    let 当前魂环表 = 缓存.有当前魂环.get(当前魂环数据);
    if (!当前魂环表) {
      当前魂环表 = new WeakMap();
      缓存.有当前魂环.set(当前魂环数据, 当前魂环表);
    }
    let 武魂表 = 当前魂环表.get(武魂数据);
    if (!武魂表) {
      武魂表 = new Map();
      当前魂环表.set(武魂数据, 武魂表);
    }
    return { 表: 武魂表, 键 };
  }
  if (!(缓存.无当前魂环 instanceof WeakMap)) 缓存.无当前魂环 = new WeakMap();
  let 武魂表 = 缓存.无当前魂环.get(武魂数据);
  if (!武魂表) {
    武魂表 = new Map();
    缓存.无当前魂环.set(武魂数据, 武魂表);
  }
  return { 表: 武魂表, 键 };
}

function 归一化自动生成增益属性名_V1(属性 = '') {
  const 文本 = String(属性 || '').trim();
  if (文本 === '魂力上限') return '魂力';
  if (文本 === '精神力上限') return '精神力';
  return 自动生成增益属性集合_V1.has(文本) ? 文本 : '';
}

function 归一化自动生成恢复资源名_V1(资源 = '') {
  const 文本 = String(资源 || '').trim();
  return 自动生成恢复资源集合_V1.has(文本) ? 文本 : '';
}

function 读取技能恢复增益占用_V1(技能 = {}) {
  const 结果 = 创建恢复增益重复条目_V1();
  const 读取列表 = 值 => (Array.isArray(值) ? 值 : [值]).map(项 => String(项 || '').trim()).filter(Boolean);
  const 属性集合 = new Set();
  const 恢复集合 = new Set();
  const 访问效果 = 效果 => {
    if (!效果 || typeof 效果 !== 'object') return;
    if (Array.isArray(效果)) {
      效果.forEach(访问效果);
      return;
    }
    const 原型 = String(效果.原型 || '').trim();
    const 数值 = parseSkillSignedChangeNumber(效果.数值);
    const 正向 = Number.isFinite(数值) && 数值 > 0 && !/^-/.test(String(效果.数值 || ''));
    if (原型 === '资源变化' && 正向) {
      const 资源列表 = Array.from(new Set(读取列表(效果.资源).map(归一化自动生成恢复资源名_V1).filter(Boolean)));
      资源列表.forEach(资源 => 恢复集合.add(资源));
    }
    if (原型 === '属性修正' && 正向) {
      const 属性列表 = Array.from(new Set(读取列表(效果.属性).map(归一化自动生成增益属性名_V1).filter(Boolean)));
      属性列表.forEach(属性 => 属性集合.add(属性));
    }
    Object.values(效果).forEach(访问效果);
  };
  访问效果(技能?._效果数组 || []);
  const 属性列表 = [...属性集合];
  if (属性列表.length === 1) 结果.属性单项.add(属性列表[0]);
  else if (属性列表.length > 1) {
    if (自动生成全属性增益列表_V1.every(属性 => 属性列表.includes(属性))) 结果.属性全项 = true;
    else 属性列表.forEach(属性 => 结果.属性多项.add(属性));
  }
  const 恢复列表 = [...恢复集合];
  if (恢复列表.length === 1) 结果.恢复单项.add(恢复列表[0]);
  else if (恢复列表.length > 1) {
    if (自动生成全恢复资源列表_V1.every(资源 => 恢复列表.includes(资源))) 结果.恢复全项 = true;
    else 恢复列表.forEach(资源 => 结果.恢复多项.add(资源));
  }
  return 结果;
}

function 收集五环内恢复增益占用_V1(context = {}, ringIndex = 1) {
  const 结果 = 创建恢复增益重复账本_V1();
  const 武魂数据 = 读取自动生成同武魂数据_V1(context);
  if (!武魂数据) return 结果;
  const 当前魂环位 = Math.max(1, Math.floor(Number(ringIndex || context?.ringIndex || context?.魂环位 || 1)) || 1);
  const 当前魂环数据 = context?.魂环数据 || context?.ringData || null;
  const 缓存记录 = 读取恢复增益重复账本缓存_V1(context?.恢复增益重复账本缓存, 武魂数据, 当前魂环数据, 当前魂环位);
  if (缓存记录?.表?.has(缓存记录.键)) return 缓存记录.表.get(缓存记录.键);
  取武魂全部魂环条目_V1(武魂数据).forEach(({ 魂环键, 魂环数据 }) => {
    if (!魂环数据 || 魂环数据 === 当前魂环数据) return;
    const 魂环位 = 读取槽位序号_V1(魂环键, 0);
    const 间隔 = 当前魂环位 - 魂环位;
    if (!魂环位 || 间隔 <= 0 || 间隔 > 4) return;
    取魂环魂技条目_V1(魂环数据).forEach(([, 技能]) => {
      const 占用 = 读取技能恢复增益占用_V1(技能);
      占用.属性单项.forEach(属性 => 结果.属性单项五环.add(属性));
      占用.恢复单项.forEach(资源 => 结果.恢复单项五环.add(资源));
      if (间隔 <= 3) {
        占用.属性多项.forEach(属性 => 结果.属性多项三环.add(属性));
        占用.恢复多项.forEach(资源 => 结果.恢复多项三环.add(资源));
        if (占用.属性全项) 结果.属性全项三环 = true;
        if (占用.恢复全项) 结果.恢复全项三环 = true;
      }
    });
  });
  if (缓存记录?.表) 缓存记录.表.set(缓存记录.键, 结果);
  return 结果;
}

function 恢复增益属性已被占用_V1(已占用 = {}, 属性 = '') {
  const 标准属性 = 归一化自动生成增益属性名_V1(属性);
  if (!标准属性) return false;
  return !!已占用.属性全项三环 || !!已占用.属性单项五环?.has(标准属性) || !!已占用.属性多项三环?.has(标准属性);
}

function 恢复增益资源已被占用_V1(已占用 = {}, 资源 = '') {
  const 标准资源 = 归一化自动生成恢复资源名_V1(资源);
  if (!标准资源) return false;
  return !!已占用.恢复全项三环 || !!已占用.恢复单项五环?.has(标准资源) || !!已占用.恢复多项三环?.has(标准资源);
}

function 已有任意属性增益占用_V1(已占用 = {}) {
  return !!已占用.属性全项三环 || !!已占用.属性单项五环?.size || !!已占用.属性多项三环?.size;
}

function 已有任意恢复占用_V1(已占用 = {}) {
  return !!已占用.恢复全项三环 || !!已占用.恢复单项五环?.size || !!已占用.恢复多项三环?.size;
}

function 读取增益机制所需属性数_V1(机制 = '') {
  const 原型 = String(机制 || '').trim();
  if (原型 === '单属性增益' || 原型 === '速度提升') return 1;
  if (原型 === '多属性增益') return 2;
  if (原型 === '全属性增益') return 自动生成全属性增益列表_V1.length;
  return 0;
}

function 过滤自动生成增益属性候选_V1(type = '强攻系', 机制 = '', 候选 = [], context = {}) {
  const 原型 = String(机制 || '').trim();
  if (!['单属性增益', '多属性增益', '全属性增益', '速度提升'].includes(原型)) {
    return Array.isArray(候选) ? 候选.map(项 => String(项 || '').trim()).filter(Boolean) : [];
  }
  const 占用 = 收集五环内恢复增益占用_V1(context, context?.ringIndex || context?.魂环位 || 1);
  if (原型 === '全属性增益') return 已有任意属性增益占用_V1(占用) ? [] : [...自动生成全属性增益列表_V1];
  const 来源 = 原型 === '速度提升'
    ? ['敏捷']
    : (Array.isArray(候选) && 候选.length ? 候选 : (SKILL_ATTRIBUTE_HINTS_BY_TYPE_V1[type] || ['魂力']));
  return Array.from(new Set(来源.map(归一化自动生成增益属性名_V1).filter(Boolean)))
    .filter(属性 => !恢复增益属性已被占用_V1(占用, 属性));
}

function 替换技能重复增益属性_V1(技能 = {}, context = {}) {
  if (!技能 || typeof 技能 !== 'object') return false;
  const 占用 = 收集五环内恢复增益占用_V1(context, context?.ringIndex || context?.魂环位 || 1);
  if (!已有任意属性增益占用_V1(占用)) return false;
  const 系别 = String(context?.type || context?.系别 || context?.武魂系别 || '强攻系').trim() || '强攻系';
  const 可用属性 = 读取自动生成可用增益属性列表_V1(系别, context, '多属性增益');
  if (!可用属性.length) return false;
  let 已改 = false;
  const 访问 = 效果 => {
    if (!效果 || typeof 效果 !== 'object') return;
    if (Array.isArray(效果)) {
      效果.forEach(访问);
      return;
    }
    if (String(效果.原型 || '').trim() === '属性修正') {
      const 数值 = parseSkillSignedChangeNumber(效果.数值);
      const 正向 = Number.isFinite(数值) && 数值 > 0 && !/^-/.test(String(效果.数值 || ''));
      if (正向) {
        const 原列表 = (Array.isArray(效果.属性) ? 效果.属性 : [效果.属性]).map(归一化自动生成增益属性名_V1).filter(Boolean);
        const 保留 = 原列表.filter(属性 => !恢复增益属性已被占用_V1(占用, 属性));
        for (const 属性 of 可用属性) {
          if (保留.length >= 原列表.length) break;
          if (!保留.includes(属性)) 保留.push(属性);
        }
        if (保留.length && 保留.join('|') !== 原列表.join('|')) {
          效果.属性 = 保留.length === 1 ? 保留[0] : 保留;
          已改 = true;
        }
      }
    }
    Object.values(效果).forEach(访问);
  };
  访问(技能._效果数组 || []);
  return 已改;
}

function 断言技能五环恢复增益不重复_V1(技能 = {}, context = {}, 失败标签 = '自动生成') {
  const 已占用 = 收集五环内恢复增益占用_V1(context, context?.ringIndex || context?.魂环位 || 1);
  const 当前占用 = 读取技能恢复增益占用_V1(技能);
  if (当前占用.属性全项 && 已有任意属性增益占用_V1(已占用)) throw new Error(`技能生成错误:${失败标签}五环已有增益后全属性重复`);
  for (const 属性 of [...当前占用.属性单项, ...当前占用.属性多项]) {
    if (恢复增益属性已被占用_V1(已占用, 属性)) throw new Error(`技能生成错误:${失败标签}五环重复增益${属性}`);
  }
  if (当前占用.恢复全项 && 已有任意恢复占用_V1(已占用)) throw new Error(`技能生成错误:${失败标签}五环已有恢复后全恢复重复`);
  for (const 资源 of [...当前占用.恢复单项, ...当前占用.恢复多项]) {
    if (恢复增益资源已被占用_V1(已占用, 资源)) throw new Error(`技能生成错误:${失败标签}五环重复恢复${资源}`);
  }
}

function 读取自动生成可用增益属性列表_V1(type = '强攻系', context = {}, 机制 = '单属性增益') {
  const 占用 = 收集五环内恢复增益占用_V1(context, context?.ringIndex || context?.魂环位 || 1);
  const 原型 = String(机制 || '').trim();
  if (占用.属性全项三环) return [];
  if (原型 === '全属性增益') return 已有任意属性增益占用_V1(占用) ? [] : [...自动生成全属性增益列表_V1];
  let 候选 = SKILL_ATTRIBUTE_HINTS_BY_TYPE_V1[type] || ['魂力'];
  if (type === '强攻系' && ['单属性增益', '多属性增益'].includes(原型)) {
    const 优先候选 = ['力量', '魂力'].filter(属性 => 候选.includes(属性));
    const 补充候选 = 候选.filter(属性 => !优先候选.includes(属性));
    候选 = 原型 === '多属性增益'
      ? [...优先候选, ...补充候选]
      : (优先候选.length ? 优先候选 : 候选);
  }
  const 可用候选 = 候选.filter(属性 => !恢复增益属性已被占用_V1(占用, 属性));
  if (原型 === '多属性增益') return 可用候选;
  return 可用候选;
}

function 自动生成单项增益属性可用_V1(属性 = '', context = {}) {
  const 标准属性 = 归一化自动生成增益属性名_V1(属性);
  if (!标准属性) return false;
  const 占用 = 收集五环内恢复增益占用_V1(context, context?.ringIndex || context?.魂环位 || 1);
  return !恢复增益属性已被占用_V1(占用, 标准属性);
}

function 自动生成单项恢复资源可用_V1(资源 = '', context = {}) {
  const 标准资源 = 归一化自动生成恢复资源名_V1(资源);
  if (!标准资源) return false;
  const 占用 = 收集五环内恢复增益占用_V1(context, context?.ringIndex || context?.魂环位 || 1);
  return !恢复增益资源已被占用_V1(占用, 标准资源);
}

function 自动生成机制满足五环恢复增益约束_V1(机制 = '', context = {}) {
  const 原型 = String(机制 || '').trim();
  const 占用 = 收集五环内恢复增益占用_V1(context, context?.ringIndex || context?.魂环位 || 1);
  const 恢复资源 = 普通恢复原型资源映射_V1[原型];
  if (恢复资源) return 自动生成单项恢复资源可用_V1(恢复资源, context);
  if (原型 === '单属性增益') return 读取自动生成可用增益属性列表_V1(context?.type || context?.系别 || '强攻系', context, 原型).length >= 1;
  if (原型 === '速度提升') return 自动生成单项增益属性可用_V1('敏捷', context);
  if (原型 === '多属性增益') return 读取自动生成可用增益属性列表_V1(context?.type || context?.系别 || '强攻系', context, 原型).length >= 2;
  if (原型 === '全属性增益') return !已有任意属性增益占用_V1(占用);
  return true;
}

function 查找合法生成主机制原型_V1(主机制大类 = '', context = {}) {
  const 大类列表 = [];
  const 指定大类 = String(主机制大类 || '').trim();
  const 排除原型 = new Set(Array.isArray(context?.排除子原型) ? context.排除子原型.map(项 => String(项 || '').trim()).filter(Boolean) : []);
  if (指定大类) 大类列表.push(指定大类);
  if (!指定大类) {
    Object.keys(SKILL_ARCHETYPE_POOL_V1 || {}).forEach(大类 => {
      if (!大类列表.includes(大类)) 大类列表.push(大类);
    });
  }
  for (const 大类 of 大类列表) {
    if (!机制大类适配自动生成系别_V1(大类, context)) continue;
    const 原型池 = 大类 === '回复类' ? 读取普通回复随机原型池_V1() : (SKILL_ARCHETYPE_POOL_V1[大类] || []);
    const 合法列表 = 原型池.filter(机制 =>
      !排除原型.has(String(机制 || '').trim()) &&
      自动生成机制满足五环恢复增益约束_V1(机制, context) &&
      机制是合法生成主机制_V1(机制, context) &&
      (context?.跳过预算范围预筛 === true || 自动生成机制满足预算范围_V1(机制, context))
    );
    if (合法列表.length) return 合法列表[0];
  }
  return '';
}

function 提取技能生成失败子原型_V1(错误) {
  const 错误文本 = String(错误?.message || 错误 || '');
  const 统一匹配 = 匹配技能生成失败机制_V1(错误);
  if (统一匹配) return 统一匹配;
  const 超预算匹配 = 错误文本.match(/技能生成错误:([^:：]+?)(?:COST仍超预算|最低COST超预算|兜底失败|五环重复|三环)/);
  if (超预算匹配?.[1]) return String(超预算匹配[1]).trim();
  const 原型匹配 = 错误文本.match(/技能生成错误:([^:：]+?)不满足当前品质门槛|技能生成错误:([^:：]+?)没有共享原型编译定义|技能生成错误:[^:：]+不允许主机制原型([^:：]+)/);
  return String(原型匹配?.[1] || 原型匹配?.[2] || 原型匹配?.[3] || '').trim();
}

function 估算自动生成预算评估_V1(context = {}) {
  const 魂环位 = Math.max(1, Number(context?.ringIndex ?? context?.魂环位 ?? 1) || 1);
  const 年限 = Math.max(100, Number(context?.age ?? context?.ringAge ?? 1000) || 1000);
  const 原始角色 = context?.角色 && typeof context.角色 === 'object' && !Array.isArray(context.角色)
    ? context.角色
    : getBaseStats(Math.max(1, 10 * 魂环位 + 1));
  const 角色 = {
    ...(原始角色 || {}),
    属性: {
      ...((原始角色 && typeof 原始角色.属性 === 'object' && !Array.isArray(原始角色.属性)) ? 原始角色.属性 : {}),
    },
    魂环年限: Array.isArray(原始角色?.魂环年限) ? [...原始角色.魂环年限] : [],
  };
  if (!Array.isArray(角色.魂环年限)) 角色.魂环年限 = [];
  角色.魂环年限[魂环位 - 1] = 年限;
  const 是武魂真身 = 魂环位 === 7 && context?.forceTrueBody === true;
  const 评估 = 评估技能预算_V1({
    消耗: 是武魂真身 ? { 魂力: '100%' } : { 魂力: Number.MAX_SAFE_INTEGER },
    前摇: 999,
    _效果数组: [],
  }, {
    ...(context || {}),
    角色,
    魂环位,
    来源: context?.sourceCategory || context?.来源 || '魂技',
    启用位级硬上限: context?.启用位级硬上限 ?? true,
  });
  return 评估;
}

function 构建自动生成预算摘要键_V1(context = {}) {
  const 角色 = context?.角色 && typeof context.角色 === 'object' && !Array.isArray(context.角色) ? context.角色 : {};
  const 属性 = 角色?.属性 && typeof 角色.属性 === 'object' && !Array.isArray(角色.属性) ? 角色.属性 : {};
  const 魂环位 = Math.max(1, Math.floor(Number(context?.ringIndex ?? context?.魂环位 ?? 1) || 1));
  const 年限 = Math.max(100, Number(context?.age ?? context?.ringAge ?? context?.年限 ?? 1000) || 1000);
  return [
    魂环位,
    年限,
    String(context?.type || context?.系别 || context?.武魂系别 || '').trim(),
    String(context?.sourceCategory || context?.来源 || context?.来源类别 || '').trim(),
    String(context?.sourceQuality || context?.来源品质 || '').trim(),
    String(context?.forceTrueBody === true ? '真身' : ''),
    String(属性.天赋梯队 ?? 角色?.天赋梯队 ?? context?.talentTier ?? '').trim(),
    String(属性.等级 ?? 角色?.等级 ?? '').trim(),
    String(Array.isArray(角色?.魂环年限) ? 角色.魂环年限[魂环位 - 1] ?? '' : ''),
  ].join('|');
}

function 估算自动生成预算摘要_V1(context = {}) {
  const 缓存 = context?.自动生成预算摘要缓存 instanceof Map ? context.自动生成预算摘要缓存 : null;
  const 缓存键 = 缓存 ? 构建自动生成预算摘要键_V1(context) : '';
  if (缓存 && 缓存.has(缓存键)) return 缓存.get(缓存键);
  const 魂环位 = Math.max(1, Math.floor(Number(context?.ringIndex ?? context?.魂环位 ?? 1) || 1));
  const 来源 = String(context?.sourceCategory || context?.来源 || context?.来源类别 || '魂技').trim() || '魂技';
  const 标准等级 = Math.max(1, 10 * Math.min(9, 魂环位) + 1);
  const 原始角色 = context?.角色 && typeof context.角色 === 'object' && !Array.isArray(context.角色)
    ? context.角色
    : getBaseStats(标准等级);
  const 角色 = {
    ...(原始角色 || {}),
    属性: {
      ...((原始角色 && typeof 原始角色.属性 === 'object' && !Array.isArray(原始角色.属性)) ? 原始角色.属性 : {}),
    },
    魂环年限: Array.isArray(原始角色?.魂环年限) ? [...原始角色.魂环年限] : [],
  };
  if (!Number.isFinite(Number(角色.属性.等级)) && !Number.isFinite(Number(角色.等级))) 角色.属性.等级 = 标准等级;
  const 年限 = context?.ringAge ?? context?.age ?? context?.年限 ?? context?.魂环数据?.年限;
  if (年限 !== undefined) 角色.魂环年限[魂环位 - 1] = Math.max(100, Number(年限) || 1000);
  const 虚拟魂技位 = 推断虚拟魂技位_V1(来源, { ...(context || {}), 角色, 魂环位 });
  const 特殊预算 = context?.forceTrueBody === true && 是武魂真身魂技位_V1(虚拟魂技位)
    ? 计算武魂真身预算基准_V1(角色, 虚拟魂技位, context)
    : null;
  const 运转基准 = Math.max(
    0.5,
    特殊预算
      ? Number(特殊预算.特殊运转基准 || 0)
      : 获取基础预算_V1(虚拟魂技位) * 来源承载系数_V1(来源) + 计算魂环年限COST修正_V1(角色, 魂环位, context) + 计算天赋梯队COST修正_V1(角色),
  );
  const 初始倍率 = 读取自动生成初始消耗前摇倍率_V1({}, { ...(context || {}), 预算评估摘要: { 运转基准 } });
  const 代价能量 = 计算运转代价能量_V1(初始倍率.消耗倍率, 初始倍率.前摇倍率);
  const 位级倍率上限 = 读取魂技位COST倍率上限_V1(虚拟魂技位);
  const 位级硬上限 = context?.forceTrueBody === true || 来源 === '武魂融合技' || 来源 === '魂骨技能'
    ? Infinity
    : (Number.isFinite(位级倍率上限) ? Math.max(0.5, 运转基准 * 位级倍率上限) : Infinity);
  const 预算门禁 = 来源 === '魂骨技能'
    ? 计算魂骨技能预算门禁_V1(读取魂骨技能年限_V1(context))
    : Math.min(Math.max(0.5, 运转基准 * 代价能量),位级硬上限);
  const 摘要 = {
    预算门禁: Math.max(0, Number(预算门禁 || 0)),
    运转基准: Math.max(0, Number(运转基准 || 0)),
    低COST线: 读取预算评估最低有效COST_V1({ 运转基准, 实际门禁: 预算门禁 }, { ...(context || {}), 角色 }),
    位级硬上限: Number.isFinite(位级硬上限) ? Number(位级硬上限.toFixed(2)) : null,
  };
  if (缓存) 缓存.set(缓存键, 摘要);
  return 摘要;
}

function 估算自动生成预算门禁_V1(context = {}) {
  return 估算自动生成预算摘要_V1(context).预算门禁;
}

function 读取自动生成当前最高承载COST_V1(context = {}) {
  const 摘要 = context?.预算评估摘要 && typeof context.预算评估摘要 === 'object'
    ? context.预算评估摘要
    : 估算自动生成预算摘要_V1(context);
  const 理论门禁 = Math.max(0, Number(摘要?.预算门禁 || 0));
  const 显式门禁 = Number(context?.最高预算门禁 ?? context?.预算门禁 ?? 0);
  if (context?.预算门禁优先 === true && 显式门禁 > 0) return 显式门禁;
  const 方案 = context?.消耗前摇收口方案;
  if (方案 && typeof 方案 === 'object') {
    const 运转基准 = Math.max(0.5, Number(摘要?.运转基准 || 0));
    const 消耗上限 = Math.max(0.05, Number(方案?.消耗?.倍率上限 || 1));
    const 前摇上限 = Math.max(0.05, Number(方案?.前摇?.倍率上限 || 1));
    return Number(Math.min(理论门禁 || Infinity, 运转基准 * 计算运转代价能量_V1(消耗上限, 前摇上限)).toFixed(2));
  }
  if (显式门禁 > 0) return 显式门禁;
  return 理论门禁;
}

function 读取自动生成候选筛选门禁_V1(上下文 = {}, 默认倍率 = 0) {
  const 倍率 = Math.max(0, Number(上下文?.候选筛选最大消耗前摇倍率 ?? 默认倍率 ?? 0));
  if (!(倍率 > 0)) return 读取自动生成当前最高承载COST_V1(上下文);
  const 摘要 = 上下文?.预算评估摘要 && typeof 上下文.预算评估摘要 === 'object'
    ? 上下文.预算评估摘要
    : 估算自动生成预算摘要_V1(上下文);
  const 运转基准 = Math.max(0.5, Number(摘要?.运转基准 || 0));
  const 候选门禁 = 运转基准 * 计算运转代价能量_V1(倍率, 倍率);
  const 位级硬上限 = Number(摘要?.位级硬上限);
  return Number(Math.min(候选门禁, Number.isFinite(位级硬上限) && 位级硬上限 > 0 ? 位级硬上限 : Infinity).toFixed(2));
}

function 读取自动生成机制估算属性候选_V1(系别 = '强攻系', 机制 = '', context = {}) {
  if (Array.isArray(context?.属性候选) && context.属性候选.length) return context.属性候选;
  return rollAttributeDirectionByType(系别, 机制, 50, context);
}

function 自动生成机制预算范围允许缓存_V1(context = {}) {
  return true;
}

function 归一化自动生成档案目标_V1(目标 = '单体') {
  const 文本 = String(目标 || '单体').trim();
  if (文本 === '自身' || 文本.includes('自身')) return '自身';
  if (文本 === '全场' || 文本.includes('全场')) return '全场';
  if (文本 === '群体' || 文本.includes('群体') || 文本.includes('多个')) return '群体';
  if (文本 === '召唤物' || 文本.includes('召唤')) return '召唤物';
  if (文本 === '分身' || 文本.includes('分身')) return '分身';
  return '单体';
}

function 读取自动生成档案目标系数_V1(目标 = '单体') {
  const 正式目标 = 归一化自动生成档案目标_V1(目标 || '单体');
  return ({ 自身: 1, 单体: 1, 群体: 1.8, 全场: 2.6, 召唤物: 1, 分身: 1 })[正式目标] || 1;
}

function 构建自动生成档案估算效果_V1(条目 = {}, 上下文 = {}) {
  const 原型 = String(条目?.原型 || '').trim();
  const 机制 = String(上下文?.机制名 || 上下文?.机制 || '').trim();
  const 目标 = 上下文?.预算档案初始化中
    ? 归一化自动生成档案目标_V1(条目?.目标 || 上下文?.目标 || '单体')
    : 约束技能原型正式目标_V1(
      原型,
      归一化执行效果作用目标_V1(上下文?.目标 || 条目?.目标 || '单体', '单体'),
      { ...(上下文 || {}), ...(条目 || {}) },
    );
  const 效果 = { ...(条目 || {}), 原型, 目标 };
  const 负向机制 = /削弱|压制|减速|迟缓|禁疗|治疗反转|封技|硬控|软控|打断|干扰|燃烧|锁定|抹消|剥夺|斩盾|吞噬/.test(机制);
  if (!String(效果.数值 ?? '').trim()) {
    if (原型 === '结算修正' && String(效果.结算 || '').trim() === '受到伤害') 效果.数值 = '-5%';
    else if (原型 === '护盾变化') 效果.数值 = String(效果.护盾模式 || '').trim() === '斩盾' ? '-5%' : '+5%';
    else if (['资源变化', '资源转移', '属性修正', '判定修正', '结算修正', '决策干扰', '资源锁定'].includes(原型)) 效果.数值 = 负向机制 ? '-5%' : '+5%';
  }
  return 效果;
}

function 读取自动生成档案条目目标系数_V1(条目 = {}, 上下文 = {}) {
  if (上下文?.预算档案初始化中) return 读取自动生成档案目标系数_V1(条目?.目标 || 上下文?.目标 || '单体');
  return 读取效果目标系数信息_V1(构建自动生成档案估算效果_V1(条目, 上下文), 上下文).目标系数;
}

function 读取技能机制原型条目基础预算档_V1(条目 = {}, 上下文 = {}) {
  if (!条目 || typeof 条目 !== 'object' || Array.isArray(条目)) return null;
  const 原型 = String(条目.原型 || '').trim();
  const 机制 = String(上下文?.机制名 || 上下文?.机制 || '').trim();
  if (!原型) return null;
  const 固定 = 值 => ({
    最低COST: Math.max(0, Number(值 || 0)),
    最高常规COST: Math.max(0, Number(值 || 0)),
    固定COST: Math.max(0, Number(值 || 0)),
    可调整: false,
    主调字段: [],
    次调字段: [],
  });
  const 可调 = (最低, 最高, 主调字段 = ['数值'], 次调字段 = ['持续回合']) => ({
    最低COST: Math.max(0, Number(最低 || 0)),
    最高常规COST: Math.max(Math.max(0, Number(最低 || 0)), Number(最高 || 0)),
    固定COST: null,
    可调整: true,
    主调字段,
    次调字段,
  });
  if (原型 === '伤害结算') return 可调(10, 95, ['威力倍率'], ['攻击段数']);
  if (原型 === '资源变化') {
    const 资源 = String(条目.资源 || (机制 === '魂力恢复' ? '魂力' : 机制 === '精神恢复' ? '精神力' : '生命')).trim() || '生命';
    const 负向 = String(构建自动生成档案估算效果_V1(条目, 上下文).数值 || '').trim().startsWith('-');
    const 单位 = Number(SKILL_UNIT_COST_TABLE_V1.资源变化?.[资源]?.[负向 ? '负向' : '正向'] ?? SKILL_UNIT_COST_TABLE_V1.资源变化?.[资源]?.正向 ?? SKILL_UNIT_COST_TABLE_V1.资源变化?.[资源]?.负向 ?? 1);
    return 可调(单位 * 5, 单位 * 80, ['数值'], ['持续回合']);
  }
  if (原型 === '资源转移') {
    const 方式 = String(条目.资源转移方式 || '吞噬').trim() || '吞噬';
    const 单位 = Number(SKILL_UNIT_COST_TABLE_V1.资源转移?.[方式] ?? 1);
    return 可调(单位 * 5, 单位 * 80, ['数值'], ['持续回合']);
  }
  if (原型 === '护盾变化') {
    const 模式 = String(条目.护盾模式 || '正向护盾').trim() || '正向护盾';
    const 单位 = Number(SKILL_UNIT_COST_TABLE_V1.护盾变化?.[模式] ?? SKILL_UNIT_COST_TABLE_V1.护盾变化?.正向护盾 ?? 1);
    return 可调(单位 * 5, 单位 * 90, ['数值'], ['持续回合']);
  }
  if (原型 === '属性修正') {
    let 属性值 = Array.isArray(条目.属性) ? 条目.属性 : (String(条目.属性 || '').trim() ? [String(条目.属性).trim()] : []);
    if (!属性值.length) {
      if (机制 === '全属性增益') 属性值 = ['力量', '防御', '敏捷', '魂力上限', '精神力上限'];
      else if (/多属性/.test(机制)) 属性值 = (Array.isArray(上下文?.属性候选) && 上下文.属性候选.length ? 上下文.属性候选 : ['力量', '敏捷']).slice(0, 2);
      else if (/速度/.test(机制)) 属性值 = ['敏捷'];
      else 属性值 = (Array.isArray(上下文?.属性候选) && 上下文.属性候选.length ? 上下文.属性候选 : ['力量']).slice(0, 1);
    }
    const 负向 = String(构建自动生成档案估算效果_V1(条目, 上下文).数值 || '').trim().startsWith('-');
    const 单位列表 = 属性值.map(属性 => {
      const 项 = SKILL_UNIT_COST_TABLE_V1.属性修正?.[属性];
      if (typeof 项 === 'number') return 项;
      if (项 && typeof 项 === 'object') return Number(项[负向 ? '负向' : '正向'] ?? 项.正向 ?? 项.负向 ?? 1);
      return 1;
    }).filter(值 => Number.isFinite(值));
    const 单位 = 单位列表.length ? 单位列表.reduce((和, 值) => 和 + 值, 0) / 单位列表.length : 1;
    const 数量系数 = Math.max(1, Math.pow(Math.max(1, 属性值.length), 0.85));
    return 可调(单位 * 5 * 数量系数, 单位 * 80 * 数量系数, ['数值'], ['持续回合']);
  }
  if (原型 === '判定修正') {
    const 判定 = String(条目.判定 || '命中').trim() || '命中';
    const 单位 = Number(SKILL_UNIT_COST_TABLE_V1.判定修正?.[判定] ?? 0.8);
    const 附加 = 条目.打断效果 === true ? Number(SKILL_UNIT_COST_TABLE_V1.判定修正?.打断效果 || 0) : 0;
    return 可调(单位 * 5 + 附加, 单位 * 70 + 附加, ['数值'], ['持续回合']);
  }
  if (原型 === '结算修正') {
    const 结算 = String(条目.结算 || '造成伤害').trim() || '造成伤害';
    const 单位 = Number(SKILL_UNIT_COST_TABLE_V1.结算修正?.[结算] ?? 1);
    const 下限 = 结算 === '反击' || 结算 === '持续伤害引爆' ? Math.max(单位 * 5, 20) : 单位 * 5;
    return 可调(下限, Math.max(下限, 单位 * 85), ['数值'], ['持续回合', '数量']);
  }
  if (原型 === '状态施加') {
    const 状态 = (String(条目.状态 || '虚弱').trim() || '虚弱') === '沉默' ? '封技' : (String(条目.状态 || '虚弱').trim() || '虚弱');
    const 配置 = SKILL_UNIT_COST_TABLE_V1.状态施加?.[状态];
    const 数值单位 = Number(typeof 配置 === 'object' ? (配置.数值 ??配置.固定COST) : 配置);
    const 副数值单位 = Number(typeof 配置 === 'object' ? (配置.副数值 ?? 0) : 0);
    const 固定COST = Math.max(0, Number(typeof 配置 === 'object' ? 配置.固定COST : 配置));
    if (Number.isFinite(数值单位) && 数值单位 > 0 && (String(条目.数值 || '').trim() || 固定COST === 0)) {
      const 最低 = 数值单位 * 5 + (Number.isFinite(副数值单位) && String(条目.副数值 || '').trim() ?副数值单位 * 5 : 0);
      return 可调(最低, Math.max(最低, 数值单位 * 70 +副数值单位 * 50 + 固定COST), ['数值', '副数值'], ['持续回合']);
    }
    if (固定COST > 0) {
      const 可持续 = !['眩晕', '封技', '无视异常'].includes(状态);
      return 可持续
        ? 可调(固定COST, Math.max(固定COST, 固定COST * 2.5), ['持续回合'], [])
        : 固定(固定COST);
    }
  }
  if (原型 === '时窗修正') return 可调(Number(SKILL_UNIT_COST_TABLE_V1.时窗修正?.回合型 || 5), 45, ['调整回合', '调整tick'], ['调整次数']);
  if (原型 === '状态移除') return 可调(8, 35, ['数量'], ['持续回合']);
  if (原型 === '规则防御') {
    const 规则 = String(条目.规则 || '免伤').trim() || '免伤';
    const 单位 = Number(SKILL_UNIT_COST_TABLE_V1.规则防御?.[规则] ?? 50);
    return 可调(单位, Math.max(单位, 单位 * 3), ['次数'], ['持续回合']);
  }
  if (原型 === '状态转移') {
    const 单位 = Number(SKILL_UNIT_COST_TABLE_V1.状态转移 || 10);
    return 可调(单位, 单位 * 读取技能效果持续系数_V1({ 原型: '状态转移', 持续回合: 10 }), ['持续回合'], []);
  }
  if (原型 === '状态交换') return 可调(Number(SKILL_UNIT_COST_TABLE_V1.状态交换 || 12), 36, ['持续回合'], []);
  if (原型 === '资源锁定') {
    const 锁定类型 = String(条目.锁定类型 || '回复锁定').trim() || '回复锁定';
    const 单位 = Number(SKILL_UNIT_COST_TABLE_V1.资源锁定?.[锁定类型] ?? 1);
    return 可调(单位 * 5, 单位 * 70, ['数值'], ['持续回合']);
  }
  if (原型 === '规则改写') {
    const 规则 = String(条目.规则 || '缴械').trim() || '缴械';
    const 单位 = Number(SKILL_UNIT_COST_TABLE_V1.规则改写?.[规则] ?? 18);
    return 可调(单位, Math.max(单位, 单位 * 2.5), ['数值'], ['持续回合']);
  }
  if (原型 === '机制抹消') return 可调(Number(SKILL_UNIT_COST_TABLE_V1.机制抹消 || 25), 75, ['持续回合'], []);
  if (原型 === '机制授予') return 可调(Number(SKILL_UNIT_COST_TABLE_V1.机制授予 || 25), 100, ['可用次数'], ['持续回合']);
  if (原型 === '复制执行') {
    const 类型 = String(条目.复制类型 || '复制技能').trim() || '复制技能';
    const 单位 = Number(SKILL_UNIT_COST_TABLE_V1.复制执行?.[类型] ?? 90);
    return 可调(单位, Math.max(单位, 单位 * 1.6), ['保存上限', '可用次数'], ['削减比例']);
  }
  if (原型 === '时光回溯') return 固定(Number(SKILL_UNIT_COST_TABLE_V1.时光回溯 || 200));
  if (原型 === '位移执行') {
    const 类型 = String(条目.位移类型 || '击退').trim() || '击退';
    const 单位 = Number(SKILL_UNIT_COST_TABLE_V1.位移执行?.[类型] ?? 8);
    return 可调(单位, Math.max(单位, 单位 * 6), ['距离', '数值'], ['次数']);
  }
  if (原型 === '决策干扰') {
    const 干扰 = String(条目.干扰 || '判断干扰').trim() || '判断干扰';
    const 单位 = Number(SKILL_UNIT_COST_TABLE_V1.决策干扰?.[干扰] ?? 0.6);
    return 可调(单位 * 5, 单位 * 80, ['数值'], ['持续回合']);
  }
  if (原型 === '召唤生成') {
    const 类型 = String(条目.召唤单位类型 || '魂兽').trim() || '魂兽';
    const 单位 = Number(SKILL_UNIT_COST_TABLE_V1.召唤生成?.[类型] ?? 30);
    return 可调(单位 * 0.5, Math.max(单位, 单位 * 3), ['强度', '继承属性比例'], ['数量', '持续回合']);
  }
  if (原型 === '修炼增益') {
    const 类型 = String(条目.收益类型 || '训练方式收益').trim() || '训练方式收益';
    const 单位 = Number(SKILL_UNIT_COST_TABLE_V1.修炼增益?.[类型] ?? 0.8);
    return 可调(单位 * 5, 单位 * 80, ['数值'], ['有效期tick']);
  }
  if (原型 === '战斗外复活') return 可调(Number(SKILL_UNIT_COST_TABLE_V1.战斗外复活 || 250), 360, ['数值'], ['死亡时限tick']);
  return null;
}

function 合并机制预算档案条目_V1(条目列表 = [], 上下文 = {}) {
  const 初始 = {
    最低COST: 0,
    最高常规COST: 0,
    固定COST: 0,
    可调整: false,
    主调字段: [],
    次调字段: [],
    缺档案: [],
  };
  (Array.isArray(条目列表) ? 条目列表 : []).forEach(条目 => {
    const 原型 = String(条目?.原型 || '').trim();
    const 档 = 读取技能机制原型条目基础预算档_V1(条目, 上下文);
    if (!档) {
      if (原型) 初始.缺档案.push(原型);
      return;
    }
    const 估算条目 = 上下文?.预算档案初始化中 || !上下文?.目标
      ? 条目
      : { ...(条目 || {}), 目标: 上下文.目标 };
    const 系数 = 原型 === '召唤生成' ? 1 : 读取自动生成档案条目目标系数_V1(估算条目, 上下文);
    初始.最低COST += Math.max(0, Number(档.最低COST || 0)) * 系数;
    初始.最高常规COST += Math.max(0, Number(档.最高常规COST || 档.最低COST || 0)) * 系数;
    if (档.固定COST !== null &&档.固定COST !== undefined) 初始.固定COST += Math.max(0, Number(档.固定COST || 0)) * 系数;
    else 初始.固定COST = null;
    初始.可调整 = 初始.可调整 || 档.可调整 === true;
    初始.主调字段.push(...(Array.isArray(档.主调字段) ? 档.主调字段 : []));
    初始.次调字段.push(...(Array.isArray(档.次调字段) ? 档.次调字段 : []));
    技能执行嵌套效果数组字段表_V1.forEach(字段 => {
      if (!Array.isArray(条目?.[字段]) || !条目[字段].length) return;
      const 嵌套 = 合并机制预算档案条目_V1(条目[字段], { ...上下文, 目标: undefined });
      初始.最低COST += Math.max(0, Number(嵌套.最低COST || 0));
      初始.最高常规COST += Math.max(0, Number(嵌套.最高常规COST || 0));
      if (嵌套.固定COST !== null && 嵌套.固定COST !== undefined && 初始.固定COST !== null) 初始.固定COST += Math.max(0, Number(嵌套.固定COST || 0));
      else 初始.固定COST = null;
      初始.可调整 = 初始.可调整 || 嵌套.可调整 === true;
      初始.主调字段.push(...(Array.isArray(嵌套.主调字段) ? 嵌套.主调字段 : []));
      初始.次调字段.push(...(Array.isArray(嵌套.次调字段) ? 嵌套.次调字段 : []));
      初始.缺档案.push(...(Array.isArray(嵌套.缺档案) ? 嵌套.缺档案 : []));
    });
  });
  初始.最低COST = Number(初始.最低COST.toFixed(2));
  初始.最高常规COST = Number(Math.max(初始.最低COST, 初始.最高常规COST).toFixed(2));
  if (初始.固定COST !== null) 初始.固定COST = Number(初始.固定COST.toFixed(2));
  初始.主调字段 = Array.from(new Set(初始.主调字段.filter(Boolean)));
  初始.次调字段 = Array.from(new Set(初始.次调字段.filter(Boolean)));
  初始.缺档案 = Array.from(new Set(初始.缺档案.filter(Boolean)));
  return 初始;
}

var 技能机制预算档案表_V1 = (() => {
  const 表 = new Map();
  Object.entries(SKILL_MECHANISM_TEMPLATE_COMPILER_TABLE_V1 || {}).forEach(([机制名, 编译项]) => {
    const 原型列表 = Array.isArray(编译项?.原型列表) ? 编译项.原型列表 : [];
    if (!原型列表.length) return;
    const 档案 = 合并机制预算档案条目_V1(原型列表, { 目标: '单体', 机制名, 预算档案初始化中: true });
    表.set(机制名, Object.freeze({
      机制名,
      最低COST: 档案.最低COST,
      最高常规COST: 档案.最高常规COST,
      固定COST: 档案.固定COST,
      可调整: 档案.可调整,
      主调字段: Object.freeze(档案.主调字段),
      次调字段: Object.freeze(档案.次调字段),
      目标语义: String(SKILL_MECHANISM_META_V1?.[机制名]?.目标语义 || '上下文').trim() || '上下文',
      释放形态限制: Object.freeze([]),
      壳成本类型: '',
      缺档案: Object.freeze(档案.缺档案),
    }));
  });
  const 覆盖档案 = {
    反制: { 最低COST: 115, 最高常规COST: 115, 固定COST: 115, 可调整: false },
    免伤: { 最低COST: 50, 最高常规COST: 90, 固定COST: 50, 可调整: false, 主调字段: [], 次调字段: [] },
    '免死/锁血': { 最低COST: 80, 最高常规COST: 120, 固定COST: null, 可调整: true, 主调字段: ['次数'], 次调字段: ['持续回合'] },
    霸体: { 最低COST: 43, 最高常规COST: 43, 固定COST: 43, 可调整: false },
    标记锁定: { 最低COST: 35.5, 最高常规COST: 160, 固定COST: null, 可调整: true, 主调字段: ['数值'], 次调字段: ['持续回合'] },
    幻境: { 最低COST: 45, 最高常规COST: 140, 固定COST: null, 可调整: true, 主调字段: ['数值'], 次调字段: ['持续回合'] },
    认知扭曲: { 最低COST: 48.5, 最高常规COST: 150, 固定COST: null, 可调整: true, 主调字段: ['数值'], 次调字段: ['持续回合'] },
  };
  Object.entries(覆盖档案).forEach(([机制名, 覆盖]) => {
    const 原档案 = 表.get(机制名) || {};
    表.set(机制名, Object.freeze({
      机制名,
      最低COST: Number(覆盖.最低COST),
      最高常规COST: Number(覆盖.最高常规COST),
      固定COST: 覆盖.固定COST === null ? null : Number(覆盖.固定COST),
      可调整: 覆盖.可调整 === true,
      主调字段: Object.freeze(Array.isArray(覆盖.主调字段) ? 覆盖.主调字段 : Array.from(原档案.主调字段 || [])),
      次调字段: Object.freeze(Array.isArray(覆盖.次调字段) ? 覆盖.次调字段 : Array.from(原档案.次调字段 || [])),
      目标语义: String(原档案.目标语义 || SKILL_MECHANISM_META_V1?.[机制名]?.目标语义 || '上下文').trim() || '上下文',
      释放形态限制: Object.freeze([]),
      壳成本类型: '',
      缺档案: Object.freeze([]),
    }));
  });
  return 表;
})();

function 读取技能机制预算档案_V1(机制名 = '') {
  const 机制 = String(机制名 || '').trim();
  return 技能机制预算档案表_V1.get(机制) || null;
}

function 食物造物机制需要授予壳预算_V1(机制名 = '', context = {}) {
  const 原型列表 = 读取机制编译原型列表_V1(机制名);
  if (!原型列表.length) return false;
  return 原型列表.some(条目 => {
    const 原型 = String(条目?.原型 || '').trim();
    if (!原型 || 原型 === '机制授予') return false;
    if (!机制授予允许授予原型集合_V1.has(原型)) return false;
    return !食物造物效果可直接食用_V1(构建自动生成档案估算效果_V1(条目, { ...(context || {}), 机制名 }));
  });
}

function 自动生成机制需要运行授予壳预算_V1(机制名 = '', context = {}) {
  const 系别 = String(context?.系别 || context?.type || '').trim();
  const 释放形态 = String(context?.释放形态 || '').trim();
  if (!['辅助系', '食物系'].includes(系别) || 释放形态 === '造物承载') return false;
  const 原型列表 = 读取机制编译原型列表_V1(机制名);
  if (!原型列表.length) return false;
  return 原型列表.some(条目 => {
    const 原型 = String(条目?.原型 || '').trim();
    if (!机制授予允许授予原型集合_V1.has(原型)) return false;
    if (系别 === '食物系') {
      if (['复制执行', '时光回溯'].includes(原型)) return true;
      const 估算效果 = 构建自动生成档案估算效果_V1(条目, { ...(context || {}), 机制名 });
      if (String(估算效果?.目标 || '').trim() === '自身') return false;
      return shouldWrapSkillEffectAsGrant(估算效果);
    }
    return shouldWrapSkillEffectAsGrant(构建自动生成档案估算效果_V1(条目, { ...(context || {}), 机制名 }));
  });
}

function 食物造物机制可作为食用效果_V1(机制名 = '') {
  const 原型列表 = 读取机制编译原型列表_V1(机制名);
  if (!原型列表.length) return false;
  return 原型列表.every(条目 => {
    const 原型 = String(条目?.原型 || '').trim();
    if (!原型) return false;
    if (原型 === '机制授予') return true;
    if (['资源变化', '属性修正', '护盾变化'].includes(原型)) return true;
    if (原型 === '状态移除') return true;
    if (原型 === '状态施加') return true;
    return 机制授予允许授予原型集合_V1.has(原型);
  });
}

function 估算机制组合预算区间_V1(机制名 = '', context = {}) {
  const 机制 = String(机制名 || '').trim();
  const 档案 = 读取技能机制预算档案_V1(机制);
  const 预算摘要 = context?.预算评估摘要 && typeof context.预算评估摘要 === 'object'
    ? context.预算评估摘要
    : 估算自动生成预算摘要_V1(context);
  const 门禁 = 读取自动生成当前最高承载COST_V1({ ...(context || {}), 预算评估摘要: 预算摘要 });
  const 低COST线 = Math.max(0.5, Number(预算摘要?.低COST线 || 0) || 读取预算评估最低有效COST_V1({ 运转基准: Number(预算摘要?.运转基准 || 0) }, context));
  if (!档案 || (Array.isArray(档案.缺档案) && 档案.缺档案.length)) {
    return { 可用: false, 默认COST: Infinity, 固定COST: Infinity, 最低可达COST: Infinity, 补强可达COST: Infinity, 可调整: false, 门禁, 低COST线, 缺档案: 档案?.缺档案 || [机制] };
  }
  if (
    String(context?.系别 || context?.type || '').trim() === '食物系' &&
    String(context?.释放形态 || '').trim() === '造物承载' &&
    !食物造物机制可作为食用效果_V1(机制)
  ) {
    return { 可用: false, 默认COST: Infinity, 固定COST: Infinity, 最低可达COST: Infinity, 补强可达COST: Infinity, 可调整: false, 门禁, 低COST线, 缺档案: [`食物造物非法食用效果:${机制}`] };
  }
  const 原型列表 = 读取机制编译原型列表_V1(机制);
  const 显式目标 = 归一化执行效果作用目标_V1(context?.目标 || context?.target || '', '');
  const 目标 = 显式目标
    ? 约束技能原型正式目标_V1(
      String(原型列表[0]?.原型 || 机制).trim(),
      显式目标,
      { ...(context || {}), ...(原型列表[0] || {}) },
    )
    : 生成技能机制正式目标_V1(机制, {
    ...(context || {}),
    释放形态: context?.释放形态 || '直接生效',
    造物使用效果: String(context?.释放形态 || '').trim() === '造物承载' || context?.造物使用效果 === true,
  });
  const 动态档案 = 原型列表.length
    ? 合并机制预算档案条目_V1(原型列表, {
      ...(context || {}),
      目标,
      机制名: 机制,
    })
    : null;
  const 使用档案 = 动态档案 && !(Array.isArray(动态档案.缺档案) && 动态档案.缺档案.length)
    ? 动态档案
    : 档案;
  if (!使用档案 || (Array.isArray(使用档案.缺档案) && 使用档案.缺档案.length)) {
    return { 可用: false, 默认COST: Infinity, 固定COST: Infinity, 最低可达COST: Infinity, 补强可达COST: Infinity, 可调整: false, 门禁, 低COST线, 缺档案: 使用档案?.缺档案 || [机制] };
  }
  const 需要食物造物授予壳 = String(context?.系别 || context?.type || '').trim() === '食物系' &&
    String(context?.释放形态 || '').trim() === '造物承载' &&
    食物造物机制需要授予壳预算_V1(机制, { ...(context || {}), 目标 });
  const 需要运行授予壳 = 自动生成机制需要运行授予壳预算_V1(机制, { ...(context || {}), 目标 });
  const 壳COST = 需要食物造物授予壳 || 需要运行授予壳 ? Number(SKILL_UNIT_COST_TABLE_V1.机制授予 || 25) : 0;
  const 最低可达COST = Number((使用档案.最低COST + 壳COST).toFixed(2));
  const 补强可达COST = Number((Math.max(使用档案.最高常规COST, 使用档案.最低COST) + 壳COST).toFixed(2));
  return {
    可用: true,
    默认COST: 补强可达COST,
    固定COST: 使用档案.固定COST === null ? null : Number((使用档案.固定COST + 壳COST).toFixed(2)),
    最低可达COST,
    补强可达COST,
    最高常规COST: 补强可达COST,
    可调整: 使用档案.可调整 === true,
    主调字段: 使用档案.主调字段 || [],
    次调字段: 使用档案.次调字段 || [],
    目标语义: 档案.目标语义,
    目标,
    目标系数: null,
    壳COST,
    壳成本类型: 壳COST > 0 ? (需要食物造物授予壳 ? '食物造物机制授予' : '运行机制授予') : '',
    门禁: Number(门禁.toFixed(2)),
    低COST线: Number(低COST线.toFixed(2)),
  };
}

function 构建自动生成机制预算范围键_V1(机制 = '', context = {}, 属性候选 = []) {
  const 角色 = context?.角色 && typeof context.角色 === 'object' && !Array.isArray(context.角色) ? context.角色 : {};
  const 属性 = 角色?.属性 && typeof 角色.属性 === 'object' && !Array.isArray(角色.属性) ? 角色.属性 : {};
  const 魂环位 = Math.max(1, Math.floor(Number(context?.ringIndex ?? context?.魂环位 ?? 1) || 1));
  return [
    String(机制 || '').trim(),
    String(context?.主机制大类 || '').trim(),
    String(context?.type || context?.系别 || '').trim(),
    normalizeSkillTableGrade(context?.grade || context?.品质 || context?.sourceQuality || context?.来源品质 || 'B'),
    魂环位,
    String(context?.age ?? context?.ringAge ?? context?.年限 ?? '').trim(),
    String(context?.sourceCategory || context?.来源 || context?.来源类别 || '').trim(),
    String(context?.sourceName || context?.martialSoulName || context?.武魂名称 || '').trim(),
    String(context?.释放形态 || '').trim(),
    String(context?.目标 || context?.target || '').trim(),
    String(context?.预算门禁 ?? '').trim(),
    String(context?.forceTrueBody === true ? '真身' : ''),
    String(属性.天赋梯队 ?? 角色?.天赋梯队 ?? context?.talentTier ?? '').trim(),
    String(属性.等级 ?? 角色?.等级 ?? '').trim(),
    (Array.isArray(属性候选) ? 属性候选 : []).map(项 => String(项 || '').trim()).filter(Boolean).join(','),
  ].join('|');
}

function 判断技能效果预算可调整_V1(效果 = {}) {
  if (!效果 || typeof 效果 !== 'object' || Array.isArray(效果)) return false;
  const 原型 = String(效果?.原型 || '').trim();
  if (!原型) return false;
  if (['伤害结算', '资源变化', '资源转移', '护盾变化', '属性修正', '判定修正', '结算修正', '状态施加', '时窗修正', '资源锁定', '规则改写', '位移执行', '决策干扰', '召唤生成', '复制执行', '修炼增益', '战斗外复活'].includes(原型)) return true;
  if (['规则防御', '状态转移', '状态交换', '机制授予'].includes(原型)) {
    return ['持续回合', '次数', '可用次数', '数量', '保存上限', '保留回合', '保留时长tick'].some(字段 => Number(效果?.[字段] || 0) > 1);
  }
  if (原型 === '机制抹消') return Number(效果?.持续回合 || 0) > 1;
  return false;
}

function 判断自动生成技能预算可调整_V1(技能 = {}) {
  let 可调整 = false;
  遍历直接结算预算效果_V1(Array.isArray(技能?._效果数组) ? 技能._效果数组 : [], 效果 => {
    if (!可调整 && 判断技能效果预算可调整_V1(效果)) 可调整 = true;
  });
  return 可调整;
}

function 估算自动生成机制预算范围_V1(机制名 = '', context = {}) {
  const 机制 = String(机制名 || '').trim();
  if (!机制 || !机制具备共享原型编译_V1(机制)) return { 可用: false, 默认COST: Infinity, 固定COST: Infinity, 最低可达COST: Infinity, 补强可达COST: Infinity, 可调整: false, 门禁: 0, 低COST线: 0 };
  const 魂环位 = Math.max(1, Math.floor(Number(context?.ringIndex ?? context?.魂环位 ?? 1) || 1));
  const 系别 = String(context?.type || context?.系别 || '强攻系').trim() || '强攻系';
  const 品质 = normalizeSkillTableGrade(context?.grade || context?.品质 || context?.gradeOverride || context?.sourceQuality || context?.来源品质 || 'B');
  const 主机制大类 = String(context?.主机制大类 || findMainMechanicGroupByArchetype(机制) || '').trim();
  const 释放形态 = String(context?.释放形态 || (系别 === '食物系' ? '造物承载' : '直接生效')).trim() || '直接生效';
  const 目标 = 归一化执行效果作用目标_V1(
    context?.目标 || context?.target || 生成技能机制正式目标_V1(机制, { ...(context || {}), type: 系别, 系别, grade: 品质, 主机制大类, 释放形态, 造物使用效果: 释放形态 === '造物承载' }),
    '单体',
  );
  const 属性候选 = 读取自动生成机制估算属性候选_V1(系别, 机制, context);
  const 缓存 = 自动生成机制预算范围允许缓存_V1(context) && context?.自动生成预算范围缓存 instanceof Map
    ? context.自动生成预算范围缓存
    : null;
  const 缓存键 = 缓存 ? 构建自动生成机制预算范围键_V1(机制, {
    ...(context || {}),
    type: 系别,
    系别,
    grade: 品质,
    魂环位,
    ringIndex: 魂环位,
    释放形态,
    目标,
    主机制大类,
  }, 属性候选) : '';
  if (缓存 && 缓存.has(缓存键)) return { ...缓存.get(缓存键) };
  const 品质文本 = 读取技能品质文本_V1(品质);
  const 预算摘要 = context?.预算评估摘要 && typeof context.预算评估摘要 === 'object'
    ? context.预算评估摘要
    : 估算自动生成预算摘要_V1({ ...(context || {}), type: 系别, 系别, grade: 品质, 魂环位, ringIndex: 魂环位 });
  const 门禁 = 读取自动生成当前最高承载COST_V1({ ...(context || {}), 预算评估摘要: 预算摘要 });
  const 低COST线 = Math.max(
    0.5,
    Number(预算摘要?.低COST线 || 0) || 读取预算评估最低有效COST_V1({ 运转基准: Number(预算摘要?.运转基准 || 0) }, context),
  );
  const 返回范围 = 范围 => {
    if (缓存) 缓存.set(缓存键, { ...范围 });
    return 范围;
  };
  void 品质文本;
  const 范围 = 估算机制组合预算区间_V1(机制, {
    ...(context || {}),
    type: 系别,
    系别,
    grade: 品质,
    魂环位,
    ringIndex: 魂环位,
    释放形态,
    目标,
    主机制大类,
    预算评估摘要: 预算摘要,
    预算门禁: 门禁,
  });
  return 返回范围({
    ...范围,
    最低可达失败: 范围?.可用 !== true,
    门禁: Number(门禁.toFixed(2)),
    低COST线: Number(低COST线.toFixed(2)),
  });
}

function 自动生成机制满足预算范围_V1(机制名 = '', context = {}) {
  const 范围 = 估算自动生成机制预算范围_V1(机制名, context);
  if (!范围.可用) return false;
  if (范围.最低可达失败 === true) return false;
  if (范围.门禁 > 0 && Number(范围.最低可达COST || Infinity) > 范围.门禁 + 技能预算COST容差_V1) return false;
  if (范围.低COST线 > 0 && Number(范围.补强可达COST ?? 范围.固定COST ?? 0) < 范围.低COST线 - 技能预算COST容差_V1) return false;
  if (!范围.可调整 && 范围.低COST线 > 0 && Number(范围.固定COST || 0) < 范围.低COST线 - 技能预算COST容差_V1) return false;
  return true;
}

function 计算预算区间匹配度_V1(最低COST = 0, 最高COST = 0, 低COST线 = 0, 门禁 = 0) {
  const 左 = Math.max(Number(最低COST || 0), Number(低COST线 || 0));
  const 右 = Math.min(Number(最高COST || 0), Number(门禁 || Infinity));
  if (!(右 >= 左)) return 0;
  const 生成宽度 = Math.max(0.5, Number(门禁 || 0) - Number(低COST线 || 0));
  const 区间宽度 = Math.max(0.1, 右 - 左);
  const 中点 = (左 + 右) / 2;
  const 目标中点 = (Number(低COST线 || 0) + Number(门禁 || 0)) / 2;
  const 贴合 = 1 - Math.min(0.75, Math.abs(中点 - 目标中点) / Math.max(1, 生成宽度));
  return Math.max(0.1, 区间宽度 / 生成宽度) * Math.max(0.25, 贴合);
}

function 构建预算可行候选池_V1(原始权重表 = [], 上下文 = {}) {
  const 表 = Array.isArray(原始权重表) ? 原始权重表 : [];
  const 预算摘要 = 上下文?.预算评估摘要 && typeof 上下文.预算评估摘要 === 'object'
    ? 上下文.预算评估摘要
    : 估算自动生成预算摘要_V1(上下文);
  const 门禁 = 上下文?.候选筛选最大消耗前摇倍率 !== undefined
    ? 读取自动生成候选筛选门禁_V1({ ...(上下文 || {}), 预算评估摘要: 预算摘要 })
    : 读取自动生成当前最高承载COST_V1({ ...(上下文 || {}), 预算评估摘要: 预算摘要 });
  const 低COST线 = Math.max(0.5, Number(预算摘要?.低COST线 || 0) || 读取预算评估最低有效COST_V1({ 运转基准: Number(预算摘要?.运转基准 || 0) }, 上下文));
  const 排除原型 = new Set(Array.isArray(上下文?.排除子原型) ? 上下文.排除子原型.map(项 => String(项 || '').trim()).filter(Boolean) : []);
  const 主机制最低COST = Math.max(0, Number(上下文?.主机制COST || 0));
  const 主机制最高COST = Math.max(主机制最低COST, Number(上下文?.主机制最高COST ?? 上下文?.主机制补强COST ?? 主机制最低COST));
  const 结果 = [];
  const 过滤 = [];
  表.forEach(item => {
    const 机制 = String(item?.value || item?.机制 || '').trim();
    if (!机制 || 排除原型.has(机制)) return;
    const 范围 = 估算自动生成机制预算范围_V1(机制, { ...上下文, 预算评估摘要: 预算摘要, 预算门禁: 门禁, 预算门禁优先: true });
    if (范围?.可用 !== true) {
      过滤.push({ 机制, 原因: '缺预算档案', 范围 });
      return;
    }
    const 自身最低 = Math.max(0, Number(范围.最低可达COST || 0));
    const 自身最高 = Math.max(自身最低, Number(范围.补强可达COST ?? 范围.最高常规COST ?? 范围.最低可达COST ?? 0));
    const 最低 = 主机制最低COST + 自身最低;
    const 最高 = 主机制最高COST + 自身最高;
    const 固定 = 范围.固定COST !== null && 范围.固定COST !== undefined ? 主机制最低COST + Number(范围.固定COST || 0) : null;
    const 有交集 = 范围.可调整
      ? 最低 <= 门禁 + 技能预算超预算容差_V1 && 最高 >= 低COST线 - 技能预算超预算容差_V1
      : 固定 !== null && 固定 >= 低COST线 - 技能预算超预算容差_V1 && 固定 <= 门禁 + 技能预算超预算容差_V1;
    if (!有交集) {
      过滤.push({ 机制, 原因: '预算区间无交集', 最低, 最高, 固定, 门禁, 低COST线 });
      return;
    }
    const 匹配度 = 计算预算区间匹配度_V1(最低, 最高, 低COST线, 门禁);
    const 多样性 = Array.isArray(上下文?.最近原型) && 上下文.最近原型.includes(机制) ? 0.65 : 1;
    const 权重 = Math.max(0.01, Number(item?.weight || 1) * 匹配度 * 多样性);
    结果.push({
      ...item,
      value: 机制,
      weight: Number(权重.toFixed(4)),
      预算范围: { ...范围, 组合最低COST: Number(最低.toFixed(2)), 组合最高常规COST: Number(最高.toFixed(2)) },
    });
  });
  return {
    候选表: normalizeWeightedTableTotal(结果),
    过滤,
    门禁: Number(门禁.toFixed(2)),
    低COST线: Number(低COST线.toFixed(2)),
  };
}

function rollSubModelByGrade(mainMechanic, grade, roll, context = {}) {
  const safeGrade = normalizeSkillTableGrade(grade);
  const 机制上下文 = { ...context, grade: safeGrade, 主机制大类: mainMechanic };
  const 系别 = String(context?.type || '强攻系').trim() || '强攻系';
  const 增益表 = 系别 === '强攻系'
    ? {
      C: [
        { value: '单属性增益', weight: 48 },
        { value: '威力增幅', weight: 28 },
        { value: '技能效果增幅', weight: 18 },
        { value: '速度提升', weight: 2 },
        { value: '消耗', weight: 2 },
        { value: '前摇', weight: 2 },
      ],
      B: [
        { value: '单属性增益', weight: 38 },
        { value: '威力增幅', weight: 28 },
        { value: '技能效果增幅', weight: 18 },
        { value: '多属性增益', weight: 8 },
        { value: '速度提升', weight: 2 },
        { value: '消耗', weight: 3 },
        { value: '前摇', weight: 3 },
      ],
      A: [
        { value: '威力增幅', weight: 30 },
        { value: '技能效果增幅', weight: 22 },
        { value: '单属性增益', weight: 24 },
        { value: '多属性增益', weight: 10 },
        { value: '全属性增益', weight: 5 },
        { value: '掌控提升', weight: 5 },
        { value: '速度提升', weight: 2 },
        { value: '消耗', weight: 1 },
        { value: '前摇', weight: 1 },
      ],
      S: [
        { value: '威力增幅', weight: 28 },
        { value: '技能效果增幅', weight: 24 },
        { value: '单属性增益', weight: 18 },
        { value: '多属性增益', weight: 12 },
        { value: '全属性增益', weight: 8 },
        { value: '掌控提升', weight: 6 },
        { value: '速度提升', weight: 2 },
        { value: '消耗', weight: 1 },
        { value: '前摇', weight: 1 },
      ],
    }
    : 系别 === '敏攻系'
      ? {
        C: [
          { value: '单属性增益', weight: 52 },
          { value: '速度提升', weight: 22 },
          { value: '前摇', weight: 12 },
          { value: '威力增幅', weight: 10 },
          { value: '消耗', weight: 4 },
        ],
        B: [
          { value: '单属性增益', weight: 34 },
          { value: '速度提升', weight: 22 },
          { value: '前摇', weight: 16 },
          { value: '威力增幅', weight: 14 },
          { value: '多属性增益', weight: 8 },
          { value: '技能效果增幅', weight: 6 },
        ],
        A: [
          { value: '速度提升', weight: 22 },
          { value: '前摇', weight: 18 },
          { value: '威力增幅', weight: 18 },
          { value: '单属性增益', weight: 16 },
          { value: '多属性增益', weight: 12 },
          { value: '技能效果增幅', weight: 8 },
          { value: '全属性增益', weight: 4 },
          { value: '掌控提升', weight: 2 },
        ],
        S: [
          { value: '速度提升', weight: 24 },
          { value: '威力增幅', weight: 20 },
          { value: '前摇', weight: 16 },
          { value: '技能效果增幅', weight: 14 },
          { value: '多属性增益', weight: 12 },
          { value: '单属性增益', weight: 8 },
          { value: '全属性增益', weight: 4 },
          { value: '掌控提升', weight: 2 },
        ],
      }
      : null;
  const tables = {
    伤害类: {
      C: [
        { value: '直接伤害', weight: 70 },
        { value: '多段伤害', weight: 20 },
        { value: '持续伤害', weight: 10 },
      ],
      B: [
        { value: '直接伤害', weight: 55 },
        { value: '多段伤害', weight: 27 },
        { value: '持续伤害', weight: 18 },
      ],
      A: [
        { value: '直接伤害', weight: 45 },
        { value: '多段伤害', weight: 30 },
        { value: '持续伤害', weight: 25 },
      ],
      S: [
        { value: '直接伤害', weight: 34 },
        { value: '多段伤害', weight: 33 },
        { value: '持续伤害', weight: 33 },
      ],
    },
    控制类: {
      C: [
        { value: '软控', weight: 70 },
        { value: '节奏打断', weight: 20 },
        { value: '迟缓', weight: 10 },
      ],
      B: [
        { value: '软控', weight: 45 },
        { value: '硬控', weight: 25 },
        { value: '节奏打断', weight: 20 },
        { value: '迟缓', weight: 10 },
      ],
      A: [
        { value: '软控', weight: 30 },
        { value: '硬控', weight: 30 },
        { value: '节奏打断', weight: 15 },
        { value: '迟缓', weight: 15 },
        { value: '软控', weight: 10 },
      ],
      S: [
        { value: '软控', weight: 20 },
        { value: '硬控', weight: 35 },
        { value: '节奏打断', weight: 15 },
        { value: '迟缓', weight: 20 },
        { value: '节奏打断', weight: 10 },
      ],
    },
    削弱类: {
      C: [
        { value: '单属性削弱', weight: 70 },
        { value: '消耗', weight: 15 },
        { value: '前摇', weight: 10 },
        { value: '禁疗', weight: 5 },
        { value: '速度压制', weight: 5 },
      ],
      B: [
        { value: '单属性削弱', weight: 40 },
        { value: '多属性削弱', weight: 25 },
        { value: '消耗', weight: 10 },
        { value: '前摇', weight: 10 },
        { value: '掌控压制', weight: 10 },
        { value: '禁疗', weight: 5 },
        { value: '速度压制', weight: 6 },
      ],
      A: [
        { value: '单属性削弱', weight: 25 },
        { value: '多属性削弱', weight: 25 },
        { value: '消耗', weight: 12 },
        { value: '前摇', weight: 12 },
        { value: '掌控压制', weight: 11 },
        { value: '元素封禁', weight: 7 },
        { value: '禁疗', weight: 15 },
        { value: '速度压制', weight: 8 },
      ],
      S: [
        { value: '单属性削弱', weight: 16 },
        { value: '多属性削弱', weight: 20 },
        { value: '消耗', weight: 14 },
        { value: '前摇', weight: 14 },
        { value: '掌控压制', weight: 16 },
        { value: '元素封禁', weight: 10 },
        { value: '禁疗', weight: 20 },
        { value: '速度压制', weight: 10 },
      ],
    },
    增益类: 增益表 || {
      C: [
        { value: '单属性增益', weight: 70 },
        { value: '消耗', weight: 15 },
        { value: '前摇', weight: 10 },
        { value: '速度提升', weight: 5 },
      ],
      B: [
        { value: '单属性增益', weight: 40 },
        { value: '多属性增益', weight: 20 },
        { value: '消耗', weight: 12 },
        { value: '前摇', weight: 12 },
        { value: '掌控提升', weight: 8 },
        { value: '速度提升', weight: 8 },
      ],
      A: [
        { value: '单属性增益', weight: 25 },
        { value: '多属性增益', weight: 20 },
        { value: '全属性增益', weight: 10 },
        { value: '威力增幅', weight: 8 },
        { value: '技能效果增幅', weight: 6 },
        { value: '消耗', weight: 15 },
        { value: '前摇', weight: 10 },
        { value: '掌控提升', weight: 10 },
        { value: '速度提升', weight: 10 },
      ],
      S: [
        { value: '单属性增益', weight: 15 },
        { value: '多属性增益', weight: 20 },
        { value: '全属性增益', weight: 15 },
        { value: '威力增幅', weight: 10 },
        { value: '技能效果增幅', weight: 10 },
        { value: '消耗', weight: 15 },
        { value: '前摇', weight: 10 },
        { value: '掌控提升', weight: 15 },
        { value: '速度提升', weight: 10 },
      ],
    },
    防御类: {
      C: buildDefenseArchetypeWeightedTableByContext('C', context?.type || '强攻系', context?.sourceName || ''),
      B: buildDefenseArchetypeWeightedTableByContext('B', context?.type || '强攻系', context?.sourceName || ''),
      A: buildDefenseArchetypeWeightedTableByContext('A', context?.type || '强攻系', context?.sourceName || ''),
      S: buildDefenseArchetypeWeightedTableByContext('S', context?.type || '强攻系', context?.sourceName || ''),
    },
    回复类: {
      F: 读取普通回复随机权重表_V1('F'),
      D: 读取普通回复随机权重表_V1('D'),
      C: 读取普通回复随机权重表_V1('C'),
      B: 读取普通回复随机权重表_V1('B'),
      A: 读取普通回复随机权重表_V1('A'),
      S: 读取普通回复随机权重表_V1('S'),
      'S+': 读取普通回复随机权重表_V1('S+'),
    },
    '感知/认知类': {
      C: [
        { value: '感知干扰', weight: 35 },
        { value: '标记锁定', weight: 35 },
        { value: '幻境', weight: 20 },
        { value: '催眠', weight: 10 },
      ],
      B: [
        { value: '感知干扰', weight: 20 },
        { value: '标记锁定', weight: 25 },
        { value: '共享视野', weight: 15 },
        { value: '幻境', weight: 20 },
        { value: '催眠', weight: 10 },
        { value: '认知扭曲', weight: 10 },
      ],
      A: [
        { value: '感知干扰', weight: 15 },
        { value: '标记锁定', weight: 20 },
        { value: '共享视野', weight: 20 },
        { value: '幻境', weight: 15 },
        { value: '催眠', weight: 15 },
        { value: '认知扭曲', weight: 15 },
      ],
      S: [
        { value: '标记锁定', weight: 20 },
        { value: '共享视野', weight: 20 },
        { value: '幻境', weight: 15 },
        { value: '催眠', weight: 15 },
        { value: '认知扭曲', weight: 30 },
      ],
    },
    特殊规则类: {
      C: buildSpecialRuleArchetypeWeightedTableByContext('C', context?.type || '强攻系'),
      B: buildSpecialRuleArchetypeWeightedTableByContext('B', context?.type || '强攻系'),
      A: buildSpecialRuleArchetypeWeightedTableByContext('A', context?.type || '强攻系'),
      S: buildSpecialRuleArchetypeWeightedTableByContext('S', context?.type || '强攻系'),
    },
    位移类: {
      C: [
        { value: '自身位移', weight: 70 },
        { value: '强制位移', weight: 30 },
      ],
      B: [
        { value: '自身位移', weight: 45 },
        { value: '强制位移', weight: 25 },
        { value: '位移交换', weight: 15 },
        { value: '追击位移', weight: 15 },
      ],
      A: [
        { value: '自身位移', weight: 30 },
        { value: '强制位移', weight: 25 },
        { value: '位移交换', weight: 20 },
        { value: '追击位移', weight: 15 },
        { value: '脱离位移', weight: 10 },
      ],
      S: [
        { value: '自身位移', weight: 20 },
        { value: '强制位移', weight: 20 },
        { value: '位移交换', weight: 20 },
        { value: '追击位移', weight: 20 },
        { value: '脱离位移', weight: 20 },
      ],
    },
  };
  let table = 过滤合法生成主机制权重表_V1(tables[mainMechanic]?.[safeGrade] || [
    { value: SKILL_ARCHETYPE_POOL_V1[mainMechanic]?.[0] || '无', weight: 100 },
  ], 机制上下文);
  const 排除原型 = new Set(Array.isArray(机制上下文?.排除子原型) ? 机制上下文.排除子原型.map(项 => String(项 || '').trim()).filter(Boolean) : []);
  table = table.filter(item =>
    !排除原型.has(String(item?.value || '').trim()) &&
    自动生成机制满足五环恢复增益约束_V1(item?.value, 机制上下文)
  );
  const 预算过滤前数量 = table.length;
  const 结构合法表 = table;
  const 候选池 = 构建预算可行候选池_V1(table, 机制上下文);
  table = 候选池.候选表;
  候选池.过滤.forEach(项 => {
    记录技能生成事件_V1(context, {
      类型: '候选前置过滤',
      阶段: 'rollSubModelByGrade',
      主机制大类: mainMechanic,
      主机制原型: 项.机制,
      过滤原因: 项.原因,
      最低COST: Number.isFinite(Number(项.最低)) ? Number(项.最低) : Number(项.范围?.最低可达COST ?? 0),
      门禁: Number(候选池.门禁 || 0),
    });
  });
  if (预算过滤前数量 !== table.length) {
    记录技能生成事件_V1(context, { 类型: '候选前置过滤汇总', 主机制大类: mainMechanic, 过滤数: 预算过滤前数量 - table.length, 剩余数: table.length });
  }
  if (!table.length && 结构合法表.length) 记录技能生成事件_V1(context, { 类型: '预算预筛清空子原型池', 主机制大类: mainMechanic, 候选数: 结构合法表.length });
  if (mainMechanic === '特殊规则类') {
    const 特殊规则原型 = rollSpecialRuleArchetypeByContext(safeGrade, context?.type || '强攻系', roll);
    if (
      机制是合法生成主机制_V1(特殊规则原型, 机制上下文) &&
      !排除原型.has(String(特殊规则原型 || '').trim()) &&
      自动生成机制满足五环恢复增益约束_V1(特殊规则原型, 机制上下文) &&
      自动生成机制满足预算范围_V1(特殊规则原型, 机制上下文)
    ) return 特殊规则原型;
  }
  if (table.length) {
    const 抽取原型 = rollWeightedBucket(normalizeWeightedTableTotal(table), roll) || table[0]?.value || '';
    if (机制是合法生成主机制_V1(抽取原型, 机制上下文)) return 抽取原型;
    const 合法原型 = 查找合法生成主机制原型_V1(mainMechanic, 机制上下文);
    if (合法原型) return 合法原型;
  }
  const 合法原型 = 查找合法生成主机制原型_V1(mainMechanic, 机制上下文);
  if (合法原型) return 合法原型;
  throw new Error(`技能生成错误:${mainMechanic || '未命名大类'}没有合法子原型`);
}

function rollTargetScaleByGrade(mainMechanic, grade, roll, subModel = '', type = '') {
  const safeGrade = normalizeSkillTableGrade(grade);
  const offensive = {
    C: [{ value: '敌方单体', weight: 100 }],
    B: [
      { value: '敌方单体', weight: 80 },
      { value: '敌方群体', weight: 20 },
    ],
    A: [
      { value: '敌方单体', weight: 50 },
      { value: '敌方群体', weight: 45 },
      { value: '全场', weight: 5 },
    ],
    S: [
      { value: '敌方单体', weight: 35 },
      { value: '敌方群体', weight: 50 },
      { value: '全场', weight: 15 },
    ],
  };
  const support = {
    C: [
      { value: '自身', weight: 70 },
      { value: '友方单体', weight: 30 },
    ],
    B: [
      { value: '自身', weight: 45 },
      { value: '友方单体', weight: 40 },
      { value: '友方群体', weight: 15 },
    ],
    A: [
      { value: '自身', weight: 20 },
      { value: '友方单体', weight: 45 },
      { value: '友方群体', weight: 35 },
    ],
    S: [
      { value: '自身', weight: 10 },
      { value: '友方单体', weight: 30 },
      { value: '友方群体', weight: 50 },
      { value: '全场', weight: 10 },
    ],
  };
  const foodSupport = {
    C: [
      { value: '友方单体', weight: 55 },
      { value: '友方群体', weight: 40 },
      { value: '全场', weight: 5 },
    ],
    B: [
      { value: '友方单体', weight: 35 },
      { value: '友方群体', weight: 55 },
      { value: '全场', weight: 10 },
    ],
    A: [
      { value: '友方单体', weight: 20 },
      { value: '友方群体', weight: 60 },
      { value: '全场', weight: 20 },
    ],
    S: [
      { value: '友方单体', weight: 10 },
      { value: '友方群体', weight: 60 },
      { value: '全场', weight: 30 },
    ],
  };
  const cognitiveShared = {
    C: [
      { value: '自身', weight: 60 },
      { value: '友方单体', weight: 40 },
    ],
    B: [
      { value: '自身', weight: 30 },
      { value: '友方单体', weight: 45 },
      { value: '友方群体', weight: 25 },
    ],
    A: [
      { value: '自身', weight: 10 },
      { value: '友方单体', weight: 35 },
      { value: '友方群体', weight: 55 },
    ],
    S: [
      { value: '友方单体', weight: 25 },
      { value: '友方群体', weight: 60 },
      { value: '全场', weight: 15 },
    ],
  };
  const cognitiveHostile = {
    C: [{ value: '敌方单体', weight: 100 }],
    B: [
      { value: '敌方单体', weight: 75 },
      { value: '敌方群体', weight: 25 },
    ],
    A: [
      { value: '敌方单体', weight: 45 },
      { value: '敌方群体', weight: 45 },
      { value: '全场', weight: 10 },
    ],
    S: [
      { value: '敌方单体', weight: 30 },
      { value: '敌方群体', weight: 50 },
      { value: '全场', weight: 20 },
    ],
  };
  const special = {
    C: [
      { value: '敌方单体', weight: 70 },
      { value: '自身', weight: 30 },
    ],
    B: [
      { value: '敌方单体', weight: 50 },
      { value: '自身', weight: 20 },
      { value: '友方单体', weight: 20 },
      { value: '敌方群体', weight: 10 },
    ],
    A: [
      { value: '敌方单体', weight: 35 },
      { value: '敌方群体', weight: 25 },
      { value: '自身', weight: 15 },
      { value: '友方单体', weight: 15 },
      { value: '全场', weight: 10 },
    ],
    S: [
      { value: '敌方单体', weight: 20 },
      { value: '敌方群体', weight: 20 },
      { value: '自身', weight: 15 },
      { value: '友方单体', weight: 15 },
      { value: '友方群体', weight: 15 },
      { value: '全场', weight: 15 },
    ],
  };
  const mobility = {
    C: [
      { value: '自身', weight: 70 },
      { value: '敌方单体', weight: 30 },
    ],
    B: [
      { value: '自身', weight: 45 },
      { value: '敌方单体', weight: 40 },
      { value: '敌方群体', weight: 15 },
    ],
    A: [
      { value: '自身', weight: 25 },
      { value: '敌方单体', weight: 45 },
      { value: '敌方群体', weight: 25 },
      { value: '全场', weight: 5 },
    ],
    S: [
      { value: '自身', weight: 15 },
      { value: '敌方单体', weight: 35 },
      { value: '敌方群体', weight: 35 },
      { value: '全场', weight: 15 },
    ],
  };
  if (type === '强攻系' && mainMechanic === '增益类') return '自身';
  let tableSet = offensive;
  if (type === '食物系' && ['增益类', '防御类', '回复类', '特殊规则类'].includes(mainMechanic)) tableSet = foodSupport;
  else if (['增益类', '防御类', '回复类'].includes(mainMechanic)) tableSet = support;
  else if (['辅助系', '治疗系'].includes(type) && mainMechanic === '特殊规则类') tableSet = support;
  else if (mainMechanic === '感知/认知类') tableSet = subModel === '共享视野' ? cognitiveShared : cognitiveHostile;
  else if (mainMechanic === '特殊规则类' && subModel === '分身') tableSet = support;
  else if (mainMechanic === '特殊规则类') tableSet = special;
  else if (mainMechanic === '位移类') tableSet = mobility;
  return rollWeightedBucket(tableSet[safeGrade] || tableSet.C, roll) || '敌方单体';
}

function rollAttributeDirectionByType(type, subModel, roll, context = {}) {
  void roll;
  const 机制 = String(subModel || '').trim();
  const hints = ['单属性增益', '多属性增益'].includes(机制)
    ? 读取自动生成可用增益属性列表_V1(type, { ...(context || {}), type, 系别: type }, 机制)
    : (SKILL_ATTRIBUTE_HINTS_BY_TYPE_V1[type] || ['魂力']);
  if (机制 === '全属性增益') return 过滤自动生成增益属性候选_V1(type, 机制, 自动生成全属性增益列表_V1, { ...(context || {}), type, 系别: type });
  if (type === '强攻系' && ['单属性增益', '多属性增益'].includes(机制)) {
    const 强攻候选 = ['力量', '魂力'].filter(属性 => hints.includes(属性));
    if (机制 === '多属性增益') return Array.from(new Set([...强攻候选, ...hints])).slice(0, 2);
    return (强攻候选.length ? 强攻候选 : hints).slice(0, 1);
  }
  if (机制 === '魂力恢复') return ['魂力'];
  if (机制 === '精神恢复') return ['精神力'];
  if (['体力恢复', '持续恢复', '净化/解控'].includes(机制)) return ['体力'];
  if (['多属性增益', '多属性削弱'].includes(机制)) return pickUniqueRandom(hints, 2);
  return pickUniqueRandom(hints, 1);
}

function rollExtraMechanics(main, grade, ringIndex, preferredSecondary = [], type = '强攻系', context = {}) {
  const 排除原型 = new Set(Array.isArray(context?.排除子原型) ? context.排除子原型.map(项 => String(项 || '').trim()).filter(Boolean) : []);
  let weightedPool = buildSecondaryWeightedPool(main, type, preferredSecondary);
  const 主机制COST = Math.max(0, Number(context?.主机制COST || 0));
  const 主机制最高COST = Math.max(主机制COST, Number(context?.主机制最高COST ?? context?.主机制补强COST ?? 主机制COST));
  const 当前门禁 = 读取自动生成当前最高承载COST_V1(context);
  const 预算摘要 = context?.预算评估摘要 && typeof context.预算评估摘要 === 'object'
    ? context.预算评估摘要
    : 估算自动生成预算摘要_V1(context);
  const 低COST线 = Math.max(0.5, Number(预算摘要?.低COST线 || 0) || 读取预算评估最低有效COST_V1({ 运转基准: Number(预算摘要?.运转基准 || 0) }, context));
  let 剩余预算 = 当前门禁 > 0 ? Math.max(0, 当前门禁 - 主机制COST) : Infinity;
  let 组合最高COST = 主机制最高COST;
  const 估算副机制预算范围 = 机制 => {
    const 原型 = String(机制 || '').trim();
    const 副机制目标 = 生成技能机制正式目标_V1(原型, {
      ...(context || {}),
      type,
      系别: type,
      grade,
      ringIndex,
      魂环位: ringIndex,
      主机制大类: findMainMechanicGroupByArchetype(原型),
      释放形态: context?.释放形态 || '直接生效',
    });
    return 估算自动生成机制预算范围_V1(原型, {
      ...(context || {}),
      type,
      系别: type,
      grade,
      ringIndex,
      魂环位: ringIndex,
      释放形态: context?.释放形态 || '直接生效',
      目标: 副机制目标,
      预算门禁: Number.isFinite(剩余预算) ? 剩余预算 : context?.预算门禁,
    });
  };
  const secondaryChance = getSecondaryGenerationChance(grade, ringIndex);
  const doubleChance = getSecondaryDoubleChance(grade, ringIndex);
  const 目标数量 = Math.random() * 100 < secondaryChance
    ? (Math.random() * 100 < doubleChance ? 2 : 1)
    : 0;
  if (!(目标数量 > 0)) return { secondary: [] };
  const 副机制可进入 = (item, 剩余副槽 = 0) => {
    const 范围 = 估算副机制预算范围(item?.value);
    const 最低COST = Number(范围?.最低可达COST ?? Infinity);
    const 最高COST = Math.max(最低COST, Number(范围?.补强可达COST ?? 范围?.最高常规COST ?? 范围?.最低可达COST ?? 0));
    if (范围?.可用 !== true || !Number.isFinite(最低COST)) return false;
    if (Number.isFinite(剩余预算) && 最低COST > 剩余预算 + 技能预算COST容差_V1) return false;
    if (组合最高COST + 最高COST < 低COST线 - 技能预算超预算容差_V1 && !(剩余副槽 > 0)) return false;
    return true;
  };
  weightedPool = weightedPool.filter(item =>
    !排除原型.has(String(item?.value || '').trim()) &&
    自动生成机制满足五环恢复增益约束_V1(item?.value, { ...(context || {}), type, 系别: type, grade, ringIndex }) &&
    副机制可进入(item, Math.max(0, 目标数量 - 1))
  );
  let secondary = [];
  for (let 序号 = 0; 序号 < 目标数量 && weightedPool.length > 0; 序号 += 1) {
    const 可选 = weightedPool.filter(item => {
      const 机制 = String(item?.value || '').trim();
      return 副机制可进入({ ...item, value: 机制 }, Math.max(0, 目标数量 - 序号 - 1));
    });
    const 选中 = pickUniqueWeightedRandom(可选, 1)[0];
    if (!选中) break;
    const 选中机制 = String(选中?.value || '').trim();
    if (!选中机制) break;
    secondary.push(选中机制);
    const 选中范围 = 估算副机制预算范围(选中机制);
    const 已用最低COST = Number(选中范围?.最低可达COST ?? Infinity);
    const 已用最高COST = Math.max(Number.isFinite(已用最低COST) ? 已用最低COST : 0, Number(选中范围?.补强可达COST ?? 选中范围?.最高常规COST ?? 选中范围?.最低可达COST ?? 0));
    if (Number.isFinite(剩余预算)) 剩余预算 = Math.max(0, 剩余预算 - Math.max(0, 已用最低COST));
    组合最高COST += Math.max(0, 已用最高COST);
    weightedPool = weightedPool.filter(item => String(item?.value || '').trim() !== 选中机制);
  }
  return { secondary };
}

function 构建召唤系技能蓝图_V1(grade = 'B', ringIndex = 1, preferredSecondary = [], options = {}) {
  const safeGrade = normalizeSkillTableGrade(grade);
  const roll = Math.floor(Math.random() * 100) + 1;
  const 排除原型 = new Set(Array.isArray(options?.排除子原型) ? options.排除子原型.map(项 => String(项 || '').trim()).filter(Boolean) : []);
  const 召唤上下文 = { ...options, type: '召唤系', 系别: '召唤系', grade: safeGrade, ringIndex, 魂环位: ringIndex };
  const 估算召唤机制范围 = (机制, 主机制大类 = findMainMechanicGroupByArchetype(机制) || '特殊规则类', 预算门禁 = 读取自动生成当前最高承载COST_V1(召唤上下文)) => {
    const 目标 = 生成技能机制正式目标_V1(机制, {
      ...召唤上下文,
      主机制大类,
      释放形态: '直接生效',
    });
    return 估算自动生成机制预算范围_V1(机制, {
      ...召唤上下文,
      主机制大类,
      释放形态: '直接生效',
      目标,
      预算门禁,
    });
  };
  const 选择合法召唤原型 = 候选列表 => (Array.isArray(候选列表) ? 候选列表 : [])
    .map(项 => String(项 || '').trim())
    .filter(机制 =>
      机制 &&
      !排除原型.has(机制) &&
      机制是合法生成主机制_V1(机制, 召唤上下文) &&
      自动生成机制满足五环恢复增益约束_V1(机制, 召唤上下文) &&
      自动生成机制满足预算范围_V1(机制, 召唤上下文),
    );
  let main = '特殊规则类';
  let subModel = '召唤';
  if (roll > 60) {
    main = '增益类';
    const 候选 = 选择合法召唤原型(['技能效果增幅', '消耗', '前摇']);
    subModel = pickRandom(候选) || 候选[0] || '技能效果增幅';
  } else if (排除原型.has('召唤') || !自动生成机制满足预算范围_V1('召唤', 召唤上下文)) {
    const 候选 = 选择合法召唤原型(['技能效果增幅', '消耗', '前摇']);
    main = '增益类';
    subModel = pickRandom(候选) || 候选[0] || '技能效果增幅';
  }
  const 预算门禁 = 读取自动生成当前最高承载COST_V1(召唤上下文);
  const 主机制目标 = 生成技能机制正式目标_V1(subModel, {
    ...召唤上下文,
    主机制大类: main,
    释放形态: '直接生效',
  });
  const 主机制最低COST = Number(估算召唤机制范围(subModel, main, 预算门禁)?.最低可达COST ?? Infinity);
  let 剩余预算 = 预算门禁 > 0 && Number.isFinite(主机制最低COST)
    ? Math.max(0, 预算门禁 - 主机制最低COST)
    : Infinity;
  const secondary = [];
  规范化机制枚举数组_V1([
    ...preferredSecondary,
    ...(subModel === '召唤' ? ['共享视野'] : ['护卫']),
  ]).filter(机制 =>
    !排除原型.has(String(机制 || '').trim()) &&
    技能机制满足品质门槛_V1(机制, { ...options, type: '召唤系', grade: safeGrade }) &&
    SKILL_MECHANISM_META_V1[机制]?.可副机制 === true &&
    机制具备共享原型编译_V1(机制),
  ).forEach(机制 => {
    if (secondary.includes(机制)) return;
    const 副机制目标 = 生成技能机制正式目标_V1(机制, {
      ...召唤上下文,
      主机制大类: findMainMechanicGroupByArchetype(机制),
      释放形态: '直接生效',
    });
    const 副机制最低COST = Number(估算召唤机制范围(机制, findMainMechanicGroupByArchetype(机制), Number.isFinite(剩余预算) ? 剩余预算 : 预算门禁)?.最低可达COST ?? Infinity);
    if (Number.isFinite(剩余预算) && (!Number.isFinite(副机制最低COST) || 副机制最低COST > 剩余预算 + 技能预算COST容差_V1)) return;
    secondary.push(机制);
    if (Number.isFinite(剩余预算)) 剩余预算 = Math.max(0, 剩余预算 - Math.max(0, 副机制最低COST));
  });
  return {
    系别来源: '召唤系',
    主机制大类: main,
    主机制原型: subModel,
    副机制: secondary.slice(0, 2),
    释放形态: '直接生效',
    目标: 主机制目标,
    加成属性候选: ['精神力', '魂力'],
    燃料模型: buildFuelModelByType('召唤系', main),
    独占主机制: isAutoGeneratedExclusiveMainArchetype(subModel),
    _主机制骰: roll,
    _子模型骰: roll,
    _属性方向骰: 50,
  };
}

// v9.3：主机制多样性约束——保留最近生成的主机制大类，避免连续 3 次出同一类
var v9_3_最近主机制队列_V1 = [];
function v9_3_推入主机制(main = '') {
  if (!main) return;
  v9_3_最近主机制队列_V1.push(main);
  while (v9_3_最近主机制队列_V1.length > 2) v9_3_最近主机制队列_V1.shift();
}

function rollSkillBlueprint(type, grade, ringIndex, preferredSecondary = [], options = {}) {
  if (String(type || '').trim() === '召唤系') return 构建召唤系技能蓝图_V1(grade, ringIndex, preferredSecondary, options);
  const 是治疗系第一魂技 =
    String(type || '').trim() === '治疗系' &&
    Number(ringIndex) === 1 &&
    String(options?.sourceCategory || '魂技').trim() === '魂技';
  const 蓝图总开始毫秒 = 读取性能计时毫秒_V1();
  const 预算摘要 = 估算自动生成预算摘要_V1({
    ...(options || {}),
    type,
    grade,
    ringIndex,
  });
  const 预算门禁 = 读取自动生成候选筛选门禁_V1({
    ...(options || {}),
    type,
    系别: type,
    grade,
    ringIndex,
    魂环位: ringIndex,
    预算评估摘要: 预算摘要,
    候选筛选最大消耗前摇倍率: 2,
  });
  const mainRoll = Math.floor(Math.random() * 100) + 1;
  const 本轮排除主机制大类 = new Set(Array.isArray(options?.排除主机制大类) ? options.排除主机制大类.map(项 => String(项 || '').trim()).filter(Boolean) : []);
  let main = 是治疗系第一魂技
    ? '回复类'
    : rollMainMechanicByGrade(type, grade, mainRoll, ringIndex, { ...options, 排除主机制大类: [...本轮排除主机制大类] });
  if (!main) throw new Error(`技能生成错误:${type || '未知系别'}没有合法主机制`);
  // v9.3：若与最近 2 次主机制大类重复，最多重 roll 3 次以避让（避免连续 3 次相同）
  for (let 尝试 = 0; !是治疗系第一魂技 && 尝试 < 3 && v9_3_最近主机制队列_V1.includes(main); 尝试 += 1) {
    const 重roll = Math.floor(Math.random() * 100) + 1;
    const 候选 = rollMainMechanicByGrade(type, grade, 重roll, ringIndex, options);
    if (候选 && !v9_3_最近主机制队列_V1.includes(候选)) {
      main = 候选;
      break;
    }
  }
  v9_3_推入主机制(main);
  const sourceName =
    String(options?.sourceName || options?.spiritName || options?.speciesName || options?.martialSoulName || '').trim();
  const 初始排除子原型 = Array.isArray(options?.排除子原型)
    ? options.排除子原型.map(项 => String(项 || '').trim()).filter(Boolean)
    : [];
  // 普通自动生成无法同时提供复制来源或回溯快照；显式编写的完整结构仍由正式运行时处理。
  // 保留原候选池与随机映射，仅在实际抽中时重选/剔除，避免无关种子的生成结果整体漂移。
  const 自动生成缺少上下文子原型 = new Set(['复制', '时光回溯']);
  const 本轮排除子原型 = new Set(初始排除子原型);
  const 本轮失败子原型 = new Set();
  const deliveryPool = SKILL_DELIVERY_FORM_BY_TYPE_V1[type] || ['直接生效'];
  let 最后子原型错误 = null;
  for (let 子原型尝试 = 0; 子原型尝试 < 6; 子原型尝试 += 1) {
    const 子原型开始毫秒 = 读取性能计时毫秒_V1();
    let subModel = 是治疗系第一魂技 ? '体力恢复' : '';
    const subRoll = Math.floor(Math.random() * 100) + 1;
    try {
      if (!是治疗系第一魂技) {
        subModel = rollSubModelByGrade(main, grade, subRoll, {
          ...options,
          type,
          系别: type,
          sourceName,
          ringIndex,
          魂环位: ringIndex,
          age: options?.age,
          ringAge: options?.ringAge,
          sourceCategory: options?.sourceCategory,
          预算门禁,
          预算门禁优先: true,
          排除子原型: [...本轮排除子原型],
        });
      }
    } catch (错误) {
      最后子原型错误 = 错误;
      记录技能生成事件_V1(options, {
        类型: '子原型重选',
        阶段: 'rollSubModelByGrade',
        系别: type,
        品质: grade,
        魂环位: ringIndex,
        主机制大类: main,
        子原型尝试,
        失败类型: 归类技能生成错误_V1(错误),
        错误信息: String(错误?.message || 错误 || ''),
        耗时毫秒: Number(Math.max(0, 读取性能计时毫秒_V1() - 子原型开始毫秒).toFixed(3)),
      });
      if (main) 本轮排除主机制大类.add(main);
      const 新主机制 = rollMainMechanicByGrade(type, grade, Math.floor(Math.random() * 100) + 1, ringIndex, {
        ...options,
        排除主机制大类: [...本轮排除主机制大类],
      });
      if (新主机制 && 新主机制 !== main) {
        main = 新主机制;
        continue;
      }
      break;
    }
    if (自动生成缺少上下文子原型.has(subModel)) {
      最后子原型错误 = new Error(`技能生成错误:${subModel}缺少自动生成所需上下文`);
      本轮排除子原型.add(subModel);
      本轮失败子原型.add(subModel);
      记录技能生成事件_V1(options, {
        类型: '子原型重选',
        阶段: '自动生成上下文门禁',
        系别: type,
        品质: grade,
        魂环位: ringIndex,
        主机制大类: main,
        主机制原型: subModel,
        子原型尝试,
        失败类型: '缺少复制来源或回溯快照',
        耗时毫秒: Number(Math.max(0, 读取性能计时毫秒_V1() - 子原型开始毫秒).toFixed(3)),
      });
      continue;
    }
    const attrRoll = Math.floor(Math.random() * 100) + 1;
    const attrHints = rollAttributeDirectionByType(type, subModel, attrRoll, {
      ...options,
      type,
      系别: type,
      ringIndex,
      魂环位: ringIndex,
    });
    const 指定释放形态 = String(options?.释放形态 || '').trim();
    const delivery = type === '食物系' ? '造物承载' : (指定释放形态 || pickRandom(deliveryPool) || '直接生效');
    const target = 生成技能机制正式目标_V1(subModel, {
      type,
      系别: type,
      grade,
      主机制大类: main,
      释放形态: delivery,
      造物使用效果: delivery === '造物承载',
    });
    const 主机制范围 = 估算自动生成机制预算范围_V1(subModel, {
      ...options,
      type,
      系别: type,
      grade,
      ringIndex,
      age: options?.age,
      ringAge: options?.ringAge,
      sourceCategory: options?.sourceCategory,
      主机制大类: main,
      释放形态: delivery,
      目标: target,
      属性候选: attrHints,
      预算门禁,
      预算门禁优先: true,
    });
    const 主机制最低COST = Number(主机制范围?.最低可达COST ?? Infinity);
    if (!Number.isFinite(主机制最低COST) || (预算门禁 > 0 && 主机制最低COST > 预算门禁 + 技能预算COST容差_V1)) {
      最后子原型错误 = new Error(`技能生成错误:${subModel || '未命名机制'}最低COST超预算 ${Number(主机制最低COST || 0).toFixed(1)}/${Number(预算门禁 || 0).toFixed(1)}`);
      本轮排除子原型.add(subModel);
      本轮失败子原型.add(subModel);
      记录技能生成事件_V1(options, {
        类型: '子原型重选',
        阶段: '预算范围',
        系别: type,
        品质: grade,
        魂环位: ringIndex,
        主机制大类: main,
        主机制原型: subModel,
        子原型尝试,
        失败类型: '最低COST超预算',
        最低COST: Number.isFinite(主机制最低COST) ? 主机制最低COST : null,
        门禁: Number(预算门禁 || 0),
        耗时毫秒: Number(Math.max(0, 读取性能计时毫秒_V1() - 子原型开始毫秒).toFixed(3)),
      });
      continue;
    }
    const isExclusiveMain = isAutoGeneratedExclusiveMainArchetype(subModel);
    const extra = isExclusiveMain ? { secondary: [] } : rollExtraMechanics(main, grade, ringIndex, preferredSecondary, type, {
      ...options,
      type,
      系别: type,
      grade,
      ringIndex,
      魂环位: ringIndex,
      释放形态: delivery,
      造物使用效果: delivery === '造物承载',
      预算门禁,
      预算门禁优先: true,
      sourceName,
      排除子原型: [...本轮排除子原型],
      主机制COST: 主机制最低COST,
      主机制最高COST: Number(主机制范围?.补强可达COST ?? 主机制范围?.最高常规COST ?? 主机制最低COST),
    });
    const 蓝图 = {
      系别来源: type,
      主机制大类: main,
      主机制原型: subModel,
      副机制: extra.secondary.filter(机制 => !自动生成缺少上下文子原型.has(String(机制 || '').trim())),
      释放形态: delivery,
      目标: target,
      加成属性候选: [...attrHints],
      燃料模型: buildFuelModelByType(type, main),
      独占主机制: isExclusiveMain,
      _主机制骰: mainRoll,
      _子模型骰: subRoll,
      _属性方向骰: attrRoll,
    };
    记录技能生成事件_V1(options, {
      类型: '蓝图成功',
      系别: type,
      品质: grade,
      魂环位: ringIndex,
      主机制大类: main,
      主机制原型: subModel,
      子原型尝试,
      耗时毫秒: Number(Math.max(0, 读取性能计时毫秒_V1() - 蓝图总开始毫秒).toFixed(3)),
    });
    return 蓝图;
  }
  if (最后子原型错误 && 本轮失败子原型.size) 最后子原型错误.失败子原型列表 = [...本轮失败子原型];
  throw 最后子原型错误 || new Error(`技能生成错误:${main || '未命名大类'}没有合法子原型`);
}

function findMainMechanicGroupByArchetype(主机制原型 = '') {
  const normalizedArchetype = String(主机制原型 || '').trim();
  if (!normalizedArchetype) return '';
  if (自动生成禁止主机制原型集合_V1.has(normalizedArchetype)) return '';
  for (const [主机制大类, 原型列表] of Object.entries(SKILL_ARCHETYPE_POOL_V1 || {})) {
    if ((Array.isArray(原型列表) ? 原型列表 : []).includes(normalizedArchetype)) return 主机制大类;
  }
  return '';
}

function normalizeBlueprintOverrideForAutoGenerate(blueprintOverride = {}, type = '强攻系', grade = 'B', ringIndex = 1, preferredSecondary = [], options = {}) {
  const sourceName =
    String(options?.sourceName || options?.spiritName || options?.textContext?.spiritName || options?.speciesName || options?.martialSoulName || '')
      .trim();
  const 预算摘要 = 估算自动生成预算摘要_V1({
    ...(options || {}),
    type,
    grade,
    ringIndex,
  });
  const 预算门禁 = 读取自动生成候选筛选门禁_V1({
    ...(options || {}),
    type,
    系别: type,
    grade,
    ringIndex,
    魂环位: ringIndex,
    预算评估摘要: 预算摘要,
    候选筛选最大消耗前摇倍率: 2,
  });
  const explicitMain = String(blueprintOverride?.主机制大类 || '').trim();
  const explicitArchetype = String(blueprintOverride?.主机制原型 || '').trim();
  if (!explicitMain && !explicitArchetype) {
    return rollSkillBlueprint(type, grade, ringIndex, preferredSecondary, {
      ...options,
      释放形态: String(blueprintOverride?.释放形态 || '').trim(),
      目标: blueprintOverride?.目标,
    });
  }
  const 排除原型 = new Set(Array.isArray(options?.排除子原型) ? options.排除子原型.map(项 => String(项 || '').trim()).filter(Boolean) : []);
  if (explicitArchetype && 排除原型.has(explicitArchetype)) throw new Error(`技能生成错误:${explicitArchetype}已被本轮排除`);
  let main = explicitMain || findMainMechanicGroupByArchetype(explicitArchetype) || rollMainMechanicByGrade(type, grade, 50, ringIndex, options);
  const 指定机制基础上下文 = { ...options, type, 系别: type, grade, gradeOverride: grade, sourceQuality: options?.sourceQuality || grade, ringIndex, 魂环位: ringIndex };
  if (!机制大类适配自动生成系别_V1(main, 指定机制基础上下文)) {
    throw new Error(`技能生成错误:${type || '未知系别'}不允许主机制${main || '未命名大类'}`);
  }
  let archetype = explicitArchetype || rollSubModelByGrade(main, grade, 50, {
    ...options,
    type,
    系别: type,
    sourceName,
    ringIndex,
    魂环位: ringIndex,
    预算门禁,
    预算门禁优先: true,
    排除子原型: options?.排除子原型,
  });
  if (!机制是合法生成主机制_V1(archetype, 指定机制基础上下文)) {
    throw new Error(`技能生成错误:${type || '未知系别'}不允许主机制原型${archetype || '未命名机制'}`);
  }
  if (!机制属于当前系别主候选池_V1(archetype, { ...指定机制基础上下文, sourceName })) {
    throw new Error(`技能生成错误:${type || '未知系别'}不允许主机制原型${archetype || '未命名机制'}`);
  }
  if (!机制具备共享原型编译_V1(archetype)) {
    throw new Error(`技能生成错误:${archetype || '未命名机制'}没有共享原型编译定义`);
  }
  if (!技能机制满足品质门槛_V1(archetype, 指定机制基础上下文)) {
    throw new Error(`技能生成错误:${archetype}不满足当前品质门槛`);
  }
  const 重复门禁上下文 = { ...指定机制基础上下文, sourceName, 预算门禁, 预算门禁优先: true };
  if (!自动生成机制满足五环恢复增益约束_V1(archetype, 重复门禁上下文)) {
    throw new Error(`技能生成错误:${archetype || '未命名机制'}五环重复门禁不满足`);
  }
  const deliveryPool = SKILL_DELIVERY_FORM_BY_TYPE_V1[type] || ['直接生效'];
  const delivery =
    String(blueprintOverride?.释放形态 || '').trim() ||
    (type === '食物系' ? '造物承载' : pickRandom(deliveryPool) || '直接生效');
  const 指定机制范围 = 估算自动生成机制预算范围_V1(archetype, {
    ...options,
    type,
    系别: type,
    grade,
    ringIndex,
    魂环位: ringIndex,
    sourceName,
    预算门禁,
    预算门禁优先: true,
    目标: blueprintOverride?.目标,
    释放形态: delivery,
  });
  const 指定机制最低COST = Number(指定机制范围?.最低可达COST ?? Infinity);
  if (!Number.isFinite(指定机制最低COST) || (预算门禁 > 0 && 指定机制最低COST > 预算门禁 + 技能预算COST容差_V1)) {
    throw new Error(`技能生成错误:${archetype || '未命名机制'}最低COST超预算 ${Number(指定机制最低COST || 0).toFixed(1)}/${Number(预算门禁 || 0).toFixed(1)}`);
  }
  const attrHints =
    Array.isArray(blueprintOverride?.加成属性候选) && blueprintOverride.加成属性候选.length
      ? 过滤自动生成增益属性候选_V1(type, archetype, blueprintOverride.加成属性候选, 重复门禁上下文)
      : [...rollAttributeDirectionByType(type, archetype, 50, 重复门禁上下文)];
  const 所需属性数 = 读取增益机制所需属性数_V1(archetype);
  if (所需属性数 > 0 && attrHints.length < 所需属性数) {
    throw new Error(`技能生成错误:${archetype || '未命名机制'}五环重复门禁不满足`);
  }
  const isExclusiveMain = isAutoGeneratedExclusiveMainArchetype(archetype);
  const 输入副机制 = isExclusiveMain
    ? []
    : Array.isArray(blueprintOverride?.副机制)
      ? [...blueprintOverride.副机制]
      : [...preferredSecondary];
  if (!isExclusiveMain && Array.isArray(blueprintOverride?.副机制)) {
    规范化机制枚举数组_V1(输入副机制).forEach(机制 => {
      if (!机制具备共享原型编译_V1(机制)) throw new Error(`技能生成错误:${机制}没有共享原型编译定义`);
    });
  }
  const fuelModel =
    blueprintOverride?.燃料模型 && typeof blueprintOverride.燃料模型 === 'object'
      ? { ...blueprintOverride.燃料模型 }
      : buildFuelModelByType(type, main);
  return {
    系别来源: type,
    主机制大类: main,
    主机制原型: archetype,
    副机制: 规范化机制枚举数组_V1(输入副机制).filter(机制 =>
      机制具备共享原型编译_V1(机制) &&
      技能机制满足品质门槛_V1(机制, 指定机制基础上下文) &&
      自动生成机制满足五环恢复增益约束_V1(机制, 重复门禁上下文) &&
      自动生成机制满足预算范围_V1(机制, { ...options, type, 系别: type, grade, ringIndex, 魂环位: ringIndex, sourceName, 预算门禁, 预算门禁优先: true, 释放形态: delivery }),
    ),
    释放形态: delivery,
    目标: 归一化执行效果作用目标_V1(blueprintOverride?.目标 || '', ''),
    加成属性候选: attrHints,
    燃料模型: fuelModel,
    独占主机制: isExclusiveMain,
    _主机制骰: Number(blueprintOverride?._主机制骰 ?? -1),
    _子模型骰: Number(blueprintOverride?._子模型骰 ?? -1),
    _属性方向骰: Number(blueprintOverride?._属性方向骰 ?? -1),
  };
}

function 生成被动技能蓝图_V1(type = '强攻系', grade = 'B', ringIndex = 1, preferredSecondary = [], options = {}) {
  const sourceName =
    String(options?.sourceName || options?.spiritName || options?.textContext?.spiritName || options?.speciesName || options?.martialSoulName || '')
      .trim();
  const 排除原型 = new Set(Array.isArray(options?.排除子原型) ? options.排除子原型.map(项 => String(项 || '').trim()).filter(Boolean) : []);
  const 被动上下文 = { ...options, type, 系别: type, grade, ringIndex, 魂环位: ringIndex, 释放形态: '直接生效', 目标: '自身', passiveMode: true };
  const 结构候选表 = Array.from(自动生成被动主机制候选集合_V1)
    .filter(机制 =>
      SKILL_MECHANISM_META_V1[机制]?.可主机制 === true &&
      !排除原型.has(机制) &&
      机制是合法生成主机制_V1(机制, 被动上下文) &&
      机制具备共享原型编译_V1(机制) &&
      技能机制满足品质门槛_V1(机制, 被动上下文) &&
      自动生成机制满足五环恢复增益约束_V1(机制, 被动上下文)
    )
    .map(机制 => ({ value: 机制, weight: 1 }));
  const 候选池 = 构建预算可行候选池_V1(结构候选表, 被动上下文);
  候选池.过滤.forEach(项 => {
    记录技能生成事件_V1(options, {
      类型: '候选前置过滤',
      阶段: '生成被动技能蓝图',
      主机制原型: 项.机制,
      过滤原因: 项.原因,
      最低COST: Number.isFinite(Number(项.最低)) ? Number(项.最低) : Number(项.范围?.最低可达COST ?? 0),
      门禁: Number(候选池.门禁 || 0),
    });
  });
  const 候选 = 候选池.候选表.map(项 => String(项?.value || '').trim()).filter(Boolean);
  if (!候选.length) throw new Error('技能生成错误:缺少可用被动共享原型机制');
  const archetype = rollWeightedBucket(候选池.候选表, Math.floor(Math.random() * 100) + 1) || 候选[0];
  const main = findMainMechanicGroupByArchetype(archetype) || '增益类';
  const 被动属性上下文 = { ...options, type, 系别: type, grade, ringIndex, 魂环位: ringIndex, sourceName };
  const attrHints = rollAttributeDirectionByType(type, archetype, 50, 被动属性上下文);
  const 所需属性数 = 读取增益机制所需属性数_V1(archetype);
  if (所需属性数 > 0 && attrHints.length < 所需属性数) {
    throw new Error(`技能生成错误:${archetype || '未命名机制'}五环重复门禁不满足`);
  }
  const secondary = (Array.isArray(preferredSecondary) ? preferredSecondary : [])
    .filter(机制 => 自动生成被动主机制候选集合_V1.has(String(机制 || '').trim()))
    .filter(机制 => !排除原型.has(String(机制 || '').trim()))
    .slice(0, 2);
  return {
    系别来源: type,
    主机制大类: main,
    主机制原型: archetype,
    副机制: secondary,
    释放形态: '直接生效',
    加成属性候选: [...attrHints],
    燃料模型: buildFuelModelByType(type, main),
    独占主机制: isAutoGeneratedExclusiveMainArchetype(archetype),
    _主机制骰: -1,
    _子模型骰: -1,
    _属性方向骰: 50,
    _来源名称: sourceName,
  };
}

function normalizeConstructTarget(target, fallback = '自身') {
  const text = String(target || fallback || '自身');
  if (/全场敌方|敌方全场|全体敌|所有敌|全部敌/.test(text)) return '敌方群体';
  if (/友方群体|己方\/群体|全员/.test(text)) return '友方群体';
  if (/友方单体|己方\/单体/.test(text)) return '友方单体';
  if (/敌方群体/.test(text)) return '敌方群体';
  if (/敌方单体/.test(text)) return '敌方单体';
  if (/全场/.test(text)) return '全场';
  return '自身';
}

var 生成期目标语义值_V1 = Object.freeze(['自身', '敌方单体', '敌方群体', '友方单体', '友方群体', '全场敌方', '全场友方', '全场', '召唤物', '分身']);
var SKILL_TARGET_SCALE_VALUES_V1 = Object.freeze(['自身', '单体', '群体', '全场', '召唤物', '分身']);
var SKILL_EFFECT_TARGET_VALUES_V1 = Object.freeze(['自身', '单体', '群体', '全场', '召唤物', '分身']);
var 技能效果非法归属目标集合_V1 = new Set(['友方单体', '友方群体', '敌方单体', '敌方群体', '己方/单体', '己方/群体', '敌方/单体', '敌方/群体']);
var SKILL_TARGET_MODIFIER_VALUES_V1 = Object.freeze([
  '受隐身筛选',
  '可被破隐',
  '可被嘲讽',
  '可被护卫重定向',
  '可被锁定强化',
]);
var 自动生成被动主机制候选集合_V1 = new Set([
  '单属性增益',
  '多属性增益',
  '全属性增益',
  '威力增幅',
  '技能效果增幅',
  '速度提升',
  '掌控提升',
  '体力恢复',
  '魂力恢复',
  '精神恢复',
  '持续恢复',
  '标记锁定',
  '幻境',
  '催眠',
  '认知扭曲',
  '承伤修正',
  '免伤',
  '霸体',
  '免死/锁血',
  '无敌金身',
  '伤害反射',
  '伤害分摊',
  '消耗分摊',
  '反制',
  '时光回溯',
  '隐身',
  '护卫',
]);

function 查找合法被动生成主机制原型_V1(主机制大类 = '', context = {}) {
  const 指定大类 = String(主机制大类 || '').trim();
  const 被动上下文 = { ...(context || {}), passiveMode: true, 释放形态: '直接生效', 目标: '自身' };
  const 结构候选表 = Array.from(自动生成被动主机制候选集合_V1)
    .filter(机制 =>
      SKILL_MECHANISM_META_V1[机制]?.可主机制 === true &&
      机制具备共享原型编译_V1(机制) &&
      技能机制满足品质门槛_V1(机制, 被动上下文) &&
      机制是合法生成主机制_V1(机制, 被动上下文) &&
      (!指定大类 || findMainMechanicGroupByArchetype(机制) === 指定大类)
    )
    .map(机制 => ({ value: 机制, weight: 1 }));
  const 候选池 = 构建预算可行候选池_V1(结构候选表, 被动上下文);
  return String(候选池.候选表[0]?.value || '').trim();
}

function normalizeSkillTargetScale(value = '', fallback = '单体') {
  const text = String(value || '').trim();
  if (SKILL_TARGET_SCALE_VALUES_V1.includes(text)) return text;
  if (text === '自身') return '自身';
  if (text === '全场') return '全场';
  if (/群体/.test(text)) return '群体';
  if (/单体/.test(text)) return '单体';
  return SKILL_TARGET_SCALE_VALUES_V1.includes(fallback) ? fallback : '单体';
}

var 技能执行黑名单键表_V1 = Object.freeze([
  '文本',
  '描述',
  '效果描述',
  '副作用说明',
  '运行机制',
  '战斗效果',
  '计算层效果',
  '状态名称',
  '特殊机制标识',
  '瞬时结算',
  '状态承载',
  '场地承载',
  '结算参数',
  '机制标签',
  '基础威力倍率',
  '护盾绝对值',
  'dot_damage',
  'armor_pen',
  'final_damage_mult',
  'shield_gain_bonus',
  '加成属性',
  '持续伤害值',
  '防御穿透值',
  '造成伤害倍率',
  '护盾获得加值',
  '副作用列表',
  '机制决策临时',
]);
var 技能条件分支类型候选_V1 = Object.freeze(['当前行动', '命中', '被闪避', '状态存在', '护盾', '生命比例', '体力比例', '魂力比例', '精神力比例', '生命数值', '体力数值', '魂力数值', '精神力数值', '等级', '技能属性', '攻击段数', '终结', '生命体', '装备品质', '反抗状态', '血脉', '目标', '使用者', '环境满足', '时间', '装备状态', '自身状态', '连携前提', '天赋梯队', '单位文本']);
var 技能条件分支对象候选_V1 = Object.freeze(['目标', '自身', '施术者', '召唤物', '使用者', '制作者']);
var 技能条件分支比较候选_V1 = Object.freeze(['==', '!=', '>', '>=', '<', '<=', '有', '无', '包含']);
var 技能条件分支处理候选_V1 = Object.freeze(['生效', '替换效果', '追加效果', '禁用']);
var 技能释放前结算禁用条件类型_V1 = Object.freeze(['命中', '被闪避']);
var 技能执行黑名单键集合_V1 = new Set(技能执行黑名单键表_V1);
var 技能执行效果保留键集合_V1 = new Set([
  '机制',
  '目标',
  '持续回合',
  '持续tick',
  '有效期tick',
  '触发时机',
  '参数',
  '条件分支',
]);
var 技能正式根字段集合_V1 = new Set([
  '魂技名',
  '画面描述',
  '效果描述',
  '承载方式',
  '消耗',
  '前摇',
  '附带属性',
  '使用条件',
  '触发方式',
  '触发限制',
  '装备要求',
  '场外冷却至tick',
  '技能掌控度',
  '_效果数组',
  '副作用列表',
  '产物描述',
]);
var 技能机制可见键中文名映射_V1 = Object.freeze({});
var 技能机制属性键中文名映射_V1 = Object.freeze({
  str: '力量',
  def: '防御',
  agi: '敏捷',
  vit: '体力',
  vit_max: '体力上限',
  hp: '生命',
  hp_ratio: '生命比例',
  sp: '魂力',
  sp_max: '魂力上限',
  sp_ratio: '魂力比例',
  men: '精神力',
  men_max: '精神力上限',
  men_ratio: '精神力比例',
});

function 中文化技能机制参数键_V1(value) {
  if (Array.isArray(value)) return value.map(item => 中文化技能机制参数键_V1(item));
  if (!value || typeof value !== 'object') return value;
  const result = {};
  Object.entries(value).forEach(([key, raw]) => {
    const nextKey = 技能机制可见键中文名映射_V1[key] || 技能机制属性键中文名映射_V1[key] || key;
    result[nextKey] = 中文化技能机制参数键_V1(raw);
  });
  return result;
}

function 中文化技能机制参数值_V1(value) {
  if (Array.isArray(value)) return value.map(item => 中文化技能机制参数值_V1(item));
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string') return 技能机制属性键中文名映射_V1[value] || value;
    return value;
  }
  const result = {};
  Object.entries(value).forEach(([key, raw]) => {
    const nextKey = 技能机制可见键中文名映射_V1[key] || 技能机制属性键中文名映射_V1[key] || key;
    result[nextKey] = 中文化技能机制参数值_V1(raw);
  });
  return result;
}

function 归一化执行效果目标_V1(value = '', fallback = '单体') {
  const text = String(value || '').trim();
  if (SKILL_EFFECT_TARGET_VALUES_V1.includes(text)) return text;
  if (技能效果非法归属目标集合_V1.has(text)) return SKILL_EFFECT_TARGET_VALUES_V1.includes(fallback) ? fallback : '单体';
  if (/全场敌方|敌方全场|全体敌|所有敌|全部敌/.test(text)) return '群体';
  if (/分身/.test(text)) return '分身';
  if (/召唤物|召唤/.test(text)) return '召唤物';
  if (/自身|施术者/.test(text)) return '自身';
  if (/全场/.test(text)) return '全场';
  if (/群体|全员|范围/.test(text)) return '群体';
  if (/单体|目标/.test(text)) return '单体';
  return SKILL_EFFECT_TARGET_VALUES_V1.includes(fallback) ? fallback : '单体';
}

function 归一化执行效果作用目标_V1(value = '', fallback = '单体') {
  const text = String(value || '').trim();
  if (!text) return 归一化执行效果目标_V1(fallback, '单体');
  return 归一化执行效果目标_V1(text, fallback);
}

function 归一化生成期目标语义_V1(value = '', fallback = '敌方单体') {
  const text = String(value || '').trim();
  if (生成期目标语义值_V1.includes(text)) return text;
  if (/全场敌方|敌方全场|全体敌|所有敌|全部敌/.test(text)) return '全场敌方';
  if (/全场友方|友方全场|己方全场|全体友|全体己|所有友|全部友/.test(text)) return '全场友方';
  if (/敌方群体|敌方\/群体|敌群/.test(text)) return '敌方群体';
  if (/敌方单体|敌方\/单体|敌单/.test(text)) return '敌方单体';
  if (/友方群体|己方\/群体|友方全员|己方全员|全员/.test(text)) return '友方群体';
  if (/友方单体|己方\/单体/.test(text)) return '友方单体';
  if (/分身/.test(text)) return '分身';
  if (/召唤物|召唤/.test(text)) return '召唤物';
  if (/自身|施术者/.test(text)) return '自身';
  if (/全场/.test(text)) return '全场';
  if (/群体|范围/.test(text)) return /友|己/.test(text) ? '友方群体' : '敌方群体';
  if (/单体|目标/.test(text)) return /友|己/.test(text) ? '友方单体' : '敌方单体';
  return 生成期目标语义值_V1.includes(fallback) ? fallback : '敌方单体';
}

function 生成期目标语义转正式目标_V1(原型 = '', 目标语义 = '', 上下文 = {}) {
  const 原型名 = String(原型 || '').trim();
  const 默认目标 = 归一化执行效果作用目标_V1(上下文?.默认目标 || '单体', '单体');
  const 语义 = 归一化生成期目标语义_V1(目标语义 || 默认目标, 默认目标 === '自身' ? '自身' : '敌方单体');
  let 目标;
  if (语义 === '自身') 目标 = '自身';
  else if (语义 === '召唤物') 目标 = '召唤物';
  else if (语义 === '分身') 目标 = '分身';
  else if (语义 === '全场') 目标 = '全场';
  else if (语义 === '敌方群体' || 语义 === '友方群体' || 语义 === '全场敌方' || 语义 === '全场友方') 目标 = '群体';
  else 目标 = '单体';
  if (原型名 === '召唤生成') return '自身';
  if (['状态转移', '状态交换'].includes(原型名)) return '单体';
  if (原型名 === '结算修正') return 约束结算修正目标_V1(String(上下文?.结算 || '').trim(), 约束原型分身目标_V1(原型名, 目标));
  return 约束第三批原型顶层目标_V1(原型名, 目标);
}

function 约束原型分身目标_V1(原型 = '', 目标 = '') {
  const 当前目标 = String(目标 || '').trim();
  if (当前目标 === '分身' && !原型允许分身目标_V1(原型)) return '单体';
  return 当前目标;
}

function 约束第三批原型顶层目标_V1(原型 = '', 目标 = '') {
  const 原型名 = String(原型 || '').trim();
  const 当前目标 = 约束原型分身目标_V1(原型名, 目标);
  if (['状态转移', '状态交换'].includes(原型名)) return '单体';
  if (原型名 === '状态移除') return ['自身', '单体', '群体'].includes(当前目标) ? 当前目标 : '单体';
  if (原型名 === '规则防御') return ['自身', '单体', '群体'].includes(当前目标) ? 当前目标 : '自身';
  return 当前目标;
}

function 生成技能机制正式目标_V1(机制名 = '', 上下文 = {}) {
  const 机制 = String(机制名 || '').trim();
  const 系别 = String(上下文?.系别 || 上下文?.type || '强攻系').trim() || '强攻系';
  const 品质 = normalizeSkillTableGrade(上下文?.品质 || 上下文?.grade || 'B');
  const 主机制大类 = String(上下文?.主机制大类 || findMainMechanicGroupByArchetype(机制) || '').trim();
  const 释放形态 = String(上下文?.释放形态 || '').trim();
  const 造物使用效果 = 上下文?.造物使用效果 === true || 释放形态 === '造物承载';
  const 语义表 = SKILL_MECHANISM_REGISTRY_V1?.目标语义表 || {};
  const 是仅自身 = (Array.isArray(语义表.仅自身) ? 语义表.仅自身 : []).includes(机制);
  const 是敌对 = (Array.isArray(语义表.敌对) ? 语义表.敌对 : []).includes(机制);
  const 是可赋予 = (Array.isArray(语义表.可赋予) ? 语义表.可赋予 : []).includes(机制);
  const 是群体赋予 = (Array.isArray(语义表.群体赋予) ? 语义表.群体赋予 : []).includes(机制);
  const 是食物造物 = 系别 === '食物系' && 造物使用效果;
  const 允许全场机制 = new Set(['时光回溯', '规则改写', '气运干涉', '持续伤害', '引爆持续伤害']);
  const 按品质抽取 = 表 => rollWeightedBucket(表[品质] || 表.B || 表.C || [], Math.floor(Math.random() * 100) + 1);
  if (是食物造物 && !是敌对 && 主机制大类 !== '伤害类') return '自身';
  if (是仅自身) return '自身';
  if (机制 === '召唤') return '自身';
  if (系别 === '召唤系' && ['技能效果增幅', '消耗', '前摇'].includes(机制)) return '召唤物';
  if (是敌对 || 主机制大类 === '伤害类' || ['控制类', '削弱类', '位移类'].includes(主机制大类)) {
    const 表 = {
      C: [{ value: '单体', weight: 100 }],
      B: [{ value: '单体', weight: 80 }, { value: '群体', weight: 20 }],
      A: 允许全场机制.has(机制)
        ? [{ value: '单体', weight: 55 }, { value: '群体', weight: 40 }, { value: '全场', weight: 5 }]
        : [{ value: '单体', weight: 58 }, { value: '群体', weight: 42 }],
      S: 允许全场机制.has(机制)
        ? [{ value: '单体', weight: 40 }, { value: '群体', weight: 50 }, { value: '全场', weight: 10 }]
        : [{ value: '单体', weight: 45 }, { value: '群体', weight: 55 }],
    };
    return 按品质抽取(表) || '单体';
  }
  if (是可赋予 || ['增益类', '防御类', '回复类'].includes(主机制大类)) {
    const 表 = 是群体赋予
      ? {
          C: [{ value: '自身', weight: 55 }, { value: '单体', weight: 45 }],
          B: [{ value: '自身', weight: 35 }, { value: '单体', weight: 45 }, { value: '群体', weight: 20 }],
          A: [{ value: '自身', weight: 20 }, { value: '单体', weight: 45 }, { value: '群体', weight: 35 }],
          S: [{ value: '自身', weight: 10 }, { value: '单体', weight: 35 }, { value: '群体', weight: 55 }],
        }
      : {
          C: [{ value: '自身', weight: 65 }, { value: '单体', weight: 35 }],
          B: [{ value: '自身', weight: 45 }, { value: '单体', weight: 45 }, { value: '群体', weight: 10 }],
          A: [{ value: '自身', weight: 25 }, { value: '单体', weight: 50 }, { value: '群体', weight: 25 }],
          S: [{ value: '自身', weight: 15 }, { value: '单体', weight: 40 }, { value: '群体', weight: 45 }],
        };
    return 按品质抽取(表) || '自身';
  }
  if (主机制大类 === '感知/认知类') return 机制 === '共享视野' ? (品质 === 'S' ? '群体' : '单体') : '单体';
  return '单体';
}

function 约束技能原型正式目标_V1(原型 = '', 目标 = '', 上下文 = {}) {
  const 原型名 = String(原型 || '').trim();
  const 状态名 = String(上下文?.状态 || '').trim();
  let 当前目标 = 约束原型分身目标_V1(原型名, 归一化执行效果作用目标_V1(目标, '单体'));
  if (原型名 === '状态施加' && 状态名 === '护卫') return ['单体', '群体', '全场'].includes(当前目标) ? 当前目标 : '单体';
  if (['状态转移', '状态交换'].includes(原型名)) return '单体';
  if (原型名 === '状态移除') return ['自身', '单体', '群体'].includes(当前目标) ? 当前目标 : '单体';
  if (原型名 === '规则防御') return ['自身', '单体', '群体'].includes(当前目标) ? 当前目标 : '自身';
  if (原型名 === '时光回溯') return ['单体', '群体', '全场'].includes(当前目标) ? 当前目标 : '单体';
  if (['召唤生成', '炸环'].includes(原型名)) return '自身';
  if (['伤害结算', '资源转移'].includes(原型名) && !['单体', '群体', '全场'].includes(当前目标)) return '单体';
  if (原型名 === '修炼增益' && 当前目标 === '召唤物') return String(上下文?.默认目标 || '').trim() === '自身' ? '自身' : '单体';
  return 当前目标;
}

function 机制授予目标允许下次行动触发_V1(目标 = '') {
  return 归一化执行效果作用目标_V1(目标, '单体') === '自身';
}

function 约束结算修正目标_V1(结算 = '', 目标 = '') {
  const 结算名 = String(结算 || '').trim();
  const 当前目标 = String(目标 || '').trim();
  if (['伤害分摊', '消耗分摊'].includes(结算名)) return 当前目标 === '群体' ? '群体' : '单体';
  return 当前目标;
}

const 技能阶段消耗正式资源_V1 = new Set(['魂力', '精神力', '体力']);

function 解析技能阶段消耗_V1(value, context = {}) {
  const result = { 启动: [], 维持: [], 形式: 'none', 非法项: [] };
  const addInvalid = (阶段, 原始值, 原因, 资源 = '') => {
    result.非法项.push({ 阶段, 资源, 原始值, 原因 });
  };
  const addEntry = (阶段, 资源, 原始值) => {
    const 资源名 = String(资源 || '').trim();
    if (!技能阶段消耗正式资源_V1.has(资源名)) {
      addInvalid(阶段, 原始值, 'unknown-resource', 资源名);
      return;
    }
    if (typeof 原始值 === 'number') {
      if (!Number.isFinite(原始值)) addInvalid(阶段, 原始值, 'non-finite', 资源名);
      else if (原始值 < 0) addInvalid(阶段, 原始值, 'negative', 资源名);
      else result[阶段].push({ 资源: 资源名, 数值: 原始值, 百分比: false });
      return;
    }
    const 文本 = String(原始值 ?? '').trim();
    const 匹配 = /^([+-]?\d+(?:\.\d+)?)(%)?$/.exec(文本);
    if (!匹配) {
      addInvalid(阶段, 原始值, 'invalid-value', 资源名);
      return;
    }
    const 数值 = Number(匹配[1]);
    const 百分比 = !!匹配[2];
    if (!Number.isFinite(数值)) addInvalid(阶段, 原始值, 'non-finite', 资源名);
    else if (数值 < 0) addInvalid(阶段, 原始值, 'negative', 资源名);
    else if (百分比 && 数值 > 100) addInvalid(阶段, 原始值, 'percent-out-of-range', 资源名);
    else result[阶段].push({ 资源: 资源名, 数值, 百分比 });
  };
  const parseText = (默认阶段, text) => {
    const 文本 = String(text ?? '').trim();
    if (!文本 || 文本 === '无') return;
    const phasePattern = /(?:^|[\s|｜+，,;；])(启动|维持)\s*[:：]/g;
    let 当前阶段 = 默认阶段;
    let cursor = 0;
    for (const match of 文本.matchAll(phasePattern)) {
      parseTextPart(当前阶段, 文本.slice(cursor, match.index));
      当前阶段 = match[1] === '维持' ? '维持' : '启动';
      cursor = match.index + match[0].length;
    }
    parseTextPart(当前阶段, 文本.slice(cursor));
  };
  const parseTextPart = (阶段, text) => {
    const 片段 = String(text ?? '').trim();
    if (!片段) return;
    const pattern = /([^\s|｜+，,;；:：]+)\s*[:：]\s*([+-]?\d+(?:\.\d+)?%?)/g;
    const matches = [...片段.matchAll(pattern)];
    matches.forEach(match => addEntry(阶段, match[1], match[2]));
    const 残余 = 片段.replace(pattern, '').replace(/[\s|｜+，,;；]/g, '').trim();
    if (!matches.length || 残余) addInvalid(阶段, 片段, 'unparsed');
  };
  const parseValue = (原始值, 阶段 = '启动') => {
    if (原始值 === undefined || 原始值 === null) return;
    if (Array.isArray(原始值)) {
      原始值.forEach(条目 => parseValue(条目, 阶段));
      return;
    }
    if (typeof 原始值 === 'object') {
      Object.entries(原始值).forEach(([字段, 值]) => {
        if (字段 === '启动' || 字段 === 'upfront') parseValue(值, '启动');
        else if (字段 === '维持' || 字段 === 'sustain') parseValue(值, '维持');
        else addEntry(阶段, 字段, 值);
      });
      return;
    }
    if (typeof 原始值 === 'string') {
      parseText(阶段, 原始值);
      return;
    }
    addInvalid(阶段, 原始值, 'missing-resource');
  };
  parseValue(value);
  const skill = context?.技能 || context?.skill || context?.技能数据 || {};
  const hasSourceContext = !!(
    context?.sourceCategory || context?.来源类别 || context?.来源 || context?.path || context?.写入路径
    || context?.技能类型 || context?.技能分类 || context?.融合参与者 || context?.fusionParticipantIds
    || context?.融合模式 || context?.fusionMode || context?.actionKind || context?.动作类型
    || context?.技能名 || context?.魂技名 || context?.name || context?.名称 || context?.效果模式
    || context?.effectMode || context?.技能效果模式 || context?.释放形态 || context?.画面描述
    || context?.效果描述 || context?.技能描述 || context?.描述 || context?.触发关键词 || context?.关键词
    || context?.forceTrueBody !== undefined || context?.强制真身 !== undefined
    || context?.技能 || context?.skill || context?.技能数据
  );
  if (hasSourceContext) {
    const 来源判定 = 判定技能消耗来源_V1(skill, context);
    if (来源判定.成本类型 === 'ordinary') {
      [...result.启动, ...result.维持]
        .filter(项 => 项.百分比)
        .forEach(项 => addInvalid(项.阶段 || (result.启动.includes(项) ? '启动' : '维持'), `${项.数值}%`, 'source-percent-forbidden', 项.资源));
    }
  }
  const 条目 = [...result.启动, ...result.维持];
  const 有百分比 = 条目.some(项 => 项.百分比) || result.非法项.some(项 => /%/.test(String(项.原始值 ?? '')));
  const 有绝对值 = 条目.some(项 => !项.百分比);
  if (result.非法项.length) result.形式 = 'invalid';
  else if (!条目.length) result.形式 = 'none';
  else if (有百分比 && 有绝对值) result.形式 = 'mixed';
  else if (有百分比) result.形式 = 'percentage';
  else result.形式 = 'absolute';
  return result;
}

function 规范化执行效果数值_V1(value, action = '') {
  if (value === undefined || value === null) return value;
  if (typeof value === 'string') return value.trim();
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  const 动作 = String(action || '').trim();
  if (['倍率提升', '倍率压制'].includes(动作)) {
    return formatSkillSignedChangeValue(num - 1, true);
  }
  if (动作 === '减值') return formatSkillSignedChangeValue(-Math.abs(num), Math.abs(num) <= 1);
  if (动作 === '加值' || 动作 === '持续恢复') return formatSkillSignedChangeValue(Math.abs(num), Math.abs(num) <= 1);
  return num;
}

function 断言技能根层正式字段_V1(skill = {}, path = '技能') {
  if (!skill || typeof skill !== 'object') return skill;
  const 非法字段 = Object.keys(skill).filter(字段名 => !技能正式根字段集合_V1.has(字段名));
  if (非法字段.length) throw new Error(`技能执行结构错误:${path}根层包含非法字段:${非法字段.join('、')}`);
  return skill;
}

function 收口执行条件分支条件条目_V1(value = {}, recordViolation = () => {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  Object.keys(value).forEach(key => {
    if (技能执行黑名单键集合_V1.has(key)) recordViolation(`条件分支.条件.${key}`);
  });
  const 条件类型别名 = {
    状态: '状态存在',
  };
  const 条件值别名 = {
    武器: '已装备主武器',
    防具: '已装备防具',
    斗铠: '已装备斗铠',
    机甲: '已装备机甲',
    蓄力: '蓄力中',
    潜行: '隐匿中',
  };
  const 类型 = 条件类型别名[String(value.类型 || '').trim()] || String(value.类型 || '').trim();
  if (!技能条件分支类型候选_V1.includes(类型)) {
    recordViolation(`条件分支.条件.类型`);
    return null;
  }
  const 对象 = 技能条件分支对象候选_V1.includes(String(value.对象 || '').trim())
    ? String(value.对象 || '').trim()
    : '目标';
  const 比较源 = String(value.比较 || '').trim();
  const 比较 = 技能条件分支比较候选_V1.includes(比较源)
    ? 比较源
    : (['状态存在', '护盾', '命中', '被闪避'].includes(类型) ? '有' : '==');
  const 条件 = { 类型, 对象, 比较 };
  const 值源 = value.值 ?? value.数值 ?? '';
  if (值源 !== undefined && 值源 !== null && String(值源).trim()) {
    const 值文本 = String(中文化技能机制参数值_V1(cloneJsonValue(值源)) || '').trim();
    条件.值 = 条件值别名[值文本] || 值文本;
  }
  const 状态 = String(value.状态 || '').trim();
  if (状态) 条件.状态 = 状态;
  return 条件;
}

function 规范化等价比较效果条目_V1(效果 = {}) {
  if (!效果 || typeof 效果 !== 'object' || Array.isArray(效果)) return 效果;
  const 副本 = cloneJsonValue(效果);
  delete 副本.条件分支;
  if (副本.目标 === undefined || 副本.目标 === null || String(副本.目标).trim() === '') delete 副本.目标;
  Object.keys(副本).forEach(键 => {
    const 值 = 副本[键];
    if (值 === undefined || 值 === null || (typeof 值 === 'string' && !值.trim())) delete 副本[键];
  });
  return 副本;
}

function 稳定序列化技能效果_V1(值) {
  if (Array.isArray(值)) return `[${值.map(稳定序列化技能效果_V1).join(',')}]`;
  if (值 && typeof 值 === 'object') {
    return `{${Object.keys(值).sort().map(键 => `${JSON.stringify(键)}:${稳定序列化技能效果_V1(值[键])}`).join(',')}}`;
  }
  return JSON.stringify(值);
}

var 状态施加分类索引_V1 = Object.freeze(Object.fromEntries(
  Object.entries(状态施加状态分类矩阵_V1).flatMap(([分类, 状态列表]) => 状态列表.map(状态 => [状态, 分类])),
));
var 状态施加默认驱动属性表_V1 = Object.freeze({
  中毒: '魂力上限',
  流血: '魂力上限',
  灼烧: '魂力上限',
  冻伤: '魂力上限',
  持续创伤: '魂力上限',
  持续恢复: '魂力上限',
  护盾: '魂力上限',
  无视异常: '魂力上限',
  麻痹: '魂力上限',
  僵直: '魂力上限',
  迟缓: '魂力上限',
  虚弱: '魂力上限',
  防御剥夺: '魂力上限',
  资源燃烧: '魂力上限',
  魂力枯竭: '魂力上限',
  眩晕: '精神力上限',
  沉默: '精神力上限',
  致盲: '精神力上限',
  封技: '精神力上限',
  混乱: '精神力上限',
  失控: '精神力上限',
  精神紊乱: '精神力上限',
  隐匿: '精神力上限',
  探查屏蔽: '精神力上限',
  共享视野: '精神力上限',
  标记: '精神力上限',
  嘲讽: '精神力上限',
  精神抗性剥夺: '精神力上限',
  禁疗: '精神力上限',
  治疗反转: '精神力上限',
  反噬: '精神力上限',
  霸体: '体力上限',
  护卫: '体力上限',
});

function 判定修正默认开启打断效果_V1(字段 = {}) {
  if (!字段 || typeof 字段 !== 'object') return false;
  if (Number(字段.持续回合 || 0) > 0) return false;
  return parseSkillSignedChangeNumber(字段.数值) < 0;
}

function 读取状态施加分类_V1(状态 = '') {
  return 状态施加分类索引_V1[String(状态 || '').trim()] || '';
}

function 状态施加允许数值字段_V1(状态 = '') {
  const 状态名 = String(状态 || '').trim();
  return ['持续伤害类', '恢复资源类', '防御数值类'].includes(读取状态施加分类_V1(状态)) ||
    ['禁疗', '治疗反转', '标记', '嘲讽', '防御剥夺', '精神抗性剥夺', '虚弱', '迟缓', '资源燃烧', '失控', '反噬', '精神紊乱', '僵直', '麻痹', '混乱', '魂力枯竭'].includes(状态名);
}

function 状态施加允许副数值字段_V1(状态 = '') {
  return ['中毒', '流血', '灼烧', '冻伤', '持续创伤', '资源燃烧', '迟缓', '失控', '精神紊乱', '魂力枯竭', '僵直', '麻痹', '混乱'].includes(String(状态 || '').trim());
}

function 读取状态施加默认数值_V1(状态 = '') {
  const 状态名 = String(状态 || '').trim();
  if (状态名 === '中毒') return '-5%';
  if (状态名 === '流血') return '-5%';
  if (状态名 === '持续恢复') return '+5%';
  if (状态名 === '护盾') return '+10%';
  if (状态名 === '禁疗') return '+40%';
  if (状态名 === '治疗反转') return '+100%';
  if (状态名 === '护卫') return '+10%';
  if (状态名 === '嘲讽') return '+100%';
  if (状态名 === '共享视野') return '+10%';
  if (['资源燃烧', '魂力枯竭'].includes(状态名)) return '+5%';
  if (状态名 === '冻伤') return '-5%';
  if (状态名 === '迟缓') return '-10%';
  if (状态名 === '虚弱') return '-8%';
  if (状态名 === '失控') return '+35%';
  if (状态名 === '反噬') return '+5%';
  if (状态名 === '精神紊乱') return '+25%';
  if (状态名 === '僵直') return '-50%';
  if (状态名 === '麻痹') return '-50%';
  if (状态名 === '混乱') return '+40%';
  if (状态名 === '标记') return '-100%';
  if (['防御剥夺', '精神抗性剥夺'].includes(状态名)) return '+20%';
  return '-5%';
}

function 读取状态施加默认副数值_V1(状态 = '') {
  const 状态名 = String(状态 || '').trim();
  if (状态名 === '中毒') return '-5%';
  if (状态名 === '流血') return '+5%';
  if (['灼烧', '冻伤'].includes(状态名)) return '+20%';
  if (['持续创伤', '资源燃烧', '魂力枯竭'].includes(状态名)) return 状态名 === '资源燃烧' || 状态名 === '魂力枯竭' ? '+5%' : '-5%';
  if (状态名 === '共享视野') return '+10%';
  if (状态名 === '迟缓') return '-8%';
  if (['失控', '混乱'].includes(状态名)) return '-10%';
  if (状态名 === '精神紊乱') return '-8%';
  if (['僵直', '麻痹'].includes(状态名)) return '-20%';
  return '+5%';
}

function 格式化状态施加比例字段_V1(value, fallback = '+5%') {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  const parsed = parseSkillSignedChangeNumber(text);
  if (!Number.isFinite(parsed)) return fallback;
  const 比例 = Math.abs(parsed) <= 1 || /%$/.test(text) ? parsed : parsed / 100;
  return (比例 >= 0 ? '+' : '') + formatSkillPercent(比例);
}

function 限制状态施加比例字段_V1(状态 = '', 字段名 = '', value = '') {
  const 状态名 = String(状态 || '').trim();
  const 字段 = String(字段名 || '').trim();
  const parsed = parseSkillSignedChangeNumber(value);
  if (!Number.isFinite(parsed)) return value;
  if (字段 === '数值' && 持续伤害状态集合_V1.has(状态名))
    return '-' + formatSkillPercent(Math.max(0.05, Math.abs(parsed)));
  if (字段 === '数值' && 状态名 === '持续恢复')
    return formatSkillSignedChangeValue(Math.max(0.05, Math.abs(parsed)), true);
  if (字段 === '数值' && ['资源燃烧', '魂力枯竭'].includes(状态名))
    return formatSkillSignedChangeValue(Math.max(0.05, Math.abs(parsed)), true);
  if (字段 === '数值' && ['护盾', '禁疗', '治疗反转', '防御剥夺', '精神抗性剥夺'].includes(状态名))
    return formatSkillSignedChangeValue(Math.max(0.05, Math.abs(parsed)), true);
  if (字段 === '数值' && 状态施加允许数值字段_V1(状态名) && Math.abs(parsed) < 0.05)
    return formatSkillSignedChangeValue(parsed < 0 ? -0.05 : 0.05, true);
  if (字段 === '副数值' && 状态施加允许副数值字段_V1(状态名) && Math.abs(parsed) < 0.05)
    return formatSkillSignedChangeValue(parsed < 0 ? -0.05 : 0.05, true);
  return value;
}

function 状态施加是布尔无数值类_V1(状态 = '') {
  return ['硬控封禁类', '防御布尔类', '增益类'].includes(读取状态施加分类_V1(状态)) ||
    !状态施加允许数值字段_V1(状态);
}

function 状态施加应清理驱动字段_V1(状态 = '', 目标 = '') {
  const 分类 = 读取状态施加分类_V1(状态);
  return ['硬控封禁类', '防御布尔类', '增益类'].includes(分类) &&
    ['自身', '召唤物', '分身'].includes(String(目标 || '').trim());
}

function 状态施加是否负面语义_V1(状态 = '') {
  const 分类 = 读取状态施加分类_V1(状态);
  return ['持续伤害类', '硬控封禁类', '削弱标记类'].includes(分类) || String(状态 || '').trim() === '资源燃烧';
}

function 状态施加使用正向强度数值_V1(状态 = '') {
  return ['持续恢复', '资源燃烧', '魂力枯竭', '护盾', '护卫', '禁疗', '治疗反转', '防御剥夺', '精神抗性剥夺'].includes(String(状态 || '').trim());
}

function 状态施加是否防护语义_V1(状态 = '') {
  return ['防御布尔类', '防御数值类'].includes(读取状态施加分类_V1(状态));
}

function 状态施加允许触发限制_V1(状态 = '', 目标 = '') {
  const 状态名 = String(状态 || '').trim();
  const 目标名 = String(目标 || '').trim();
  const 分类 = 读取状态施加分类_V1(状态名);
  return 状态名 === '无视异常' ||
    (['群体', '全场'].includes(目标名) && (分类 === '硬控封禁类' || 状态施加是否防护语义_V1(状态名)));
}

function 状态施加强度约束错误_V1(effect = {}, path = '_效果数组', index = 0) {
  const 状态 = String(effect?.状态 || '').trim();
  const 目标 = String(effect?.目标 || '').trim();
  const 顶层 = path === '_效果数组';
  const 嵌套或代价 = !顶层 || /\.(授予效果|结算效果|使用效果|副作用)(?:\[|$)/.test(path);
  const 持续回合 = Math.round(Number(effect?.持续回合 || 0));
  const 有触发限制 = !!(effect?.触发限制 && typeof effect.触发限制 === 'object' && !Array.isArray(effect.触发限制));
  if (顶层 && !嵌套或代价 && 目标 === '自身' && 状态施加是否负面语义_V1(状态)) {
    return `技能执行结构错误:${path}[${index}]负面状态顶层不能直接作用自身，需放入副作用或代价槽位`;
  }
  if (['群体', '全场'].includes(目标) && 读取状态施加分类_V1(状态) === '硬控封禁类') {
    if (!(持续回合 > 0 || 有触发限制)) return `技能执行结构错误:${path}[${index}]群体硬控必须有持续或触发约束`;
    if (持续回合 > 1 && !有触发限制) return `技能执行结构错误:${path}[${index}]群体硬控持续回合必须为短窗或带触发限制`;
  }
  if (['群体', '全场'].includes(目标) && 状态施加是否防护语义_V1(状态) && !(持续回合 > 0 || 有触发限制)) {
    return `技能执行结构错误:${path}[${index}]群体防护状态必须有持续或触发约束`;
  }
  if (['群体', '全场'].includes(目标) && 持续伤害状态集合_V1.has(状态) && 持续回合 > 3) {
    return `技能执行结构错误:${path}[${index}]群体DOT持续回合过长`;
  }
  return '';
}

function 收口生成状态施加目标与强度_V1(效果数组 = []) {
  if (!Array.isArray(效果数组)) return;
  效果数组.forEach((effect, index) => {
    if (!effect || typeof effect !== 'object' || Array.isArray(effect)) return;
    const 原型 = String(effect.原型 || '').trim();
    if (原型 === '状态施加') {
      const 状态 = String(effect.状态 || '').trim();
      const 目标 = String(effect.目标 || '').trim();
      if (状态施加是否负面语义_V1(状态) && 目标 === '自身') effect.目标 = '单体';
      if (状态 === '护卫' && (!String(effect.目标 || '').trim() || String(effect.目标 || '').trim() === '自身')) effect.目标 = '单体';
      else if (状态施加是否防护语义_V1(状态) && !String(effect.目标 || '').trim()) effect.目标 = '自身';
      if (effect.数值 !== undefined) {
        effect.数值 = 格式化状态施加比例字段_V1(effect.数值, 读取状态施加默认数值_V1(状态));
        effect.数值 = 限制状态施加比例字段_V1(状态, '数值', effect.数值);
      }
      if (!状态施加允许数值字段_V1(状态)) delete effect.数值;
      if (!状态施加允许副数值字段_V1(状态)) delete effect.副数值;
      if (effect.副数值 !== undefined) {
        effect.副数值 = 格式化状态施加比例字段_V1(effect.副数值, 读取状态施加默认副数值_V1(状态));
        effect.副数值 = 限制状态施加比例字段_V1(状态, '副数值', effect.副数值);
      }
      if (String(effect.目标 || '').trim() === '全场' && !Array.isArray(effect.条件分支)) {
        effect.条件分支 = [{
          条件: [{ 类型: '目标', 对象: 状态施加是否负面语义_V1(状态) ? '目标' : '自身', 比较: '有', 值: 状态施加是否负面语义_V1(状态) ? '敌对' : '友方' }],
          处理: '生效',
        }];
      }
      if (['群体', '全场'].includes(String(effect.目标 || '').trim()) && 读取状态施加分类_V1(状态) === '硬控封禁类') {
        effect.持续回合 = Math.max(1, Math.min(1, Math.round(Number(effect.持续回合 || 1))));
      }
      if (['群体', '全场'].includes(String(effect.目标 || '').trim()) && 持续伤害状态集合_V1.has(状态)) {
        effect.持续回合 = Math.max(1, Math.min(3, Math.round(Number(effect.持续回合 || 2))));
      }
      if (['群体', '全场'].includes(String(effect.目标 || '').trim()) && 状态施加是否防护语义_V1(状态)) {
        if (!(Number(effect.持续回合 || 0) > 0) && !effect.触发限制) effect.持续回合 = 1;
      }
    }
    if (原型 === '结算修正') {
      effect.目标 = 约束结算修正目标_V1(effect.结算, effect.目标);
    }
    effect.目标 = 约束技能原型正式目标_V1(原型, effect.目标, effect);
    if (原型 === '护盾变化' && parseSkillSignedChangeNumber(effect.数值) <= 0) delete effect.持续回合;
    effect.目标 = 约束技能原型正式目标_V1(原型, effect.目标, effect);
    const 当前目标 = String(effect.目标 || '').trim();
    if (
      index > 0 &&
      String(effect.生效方式 || '').trim() === '跟随主原型' &&
      当前目标 &&
      当前目标 !== String(效果数组[0]?.目标 || '').trim()
    ) {
      effect.生效方式 = '独立生效';
    }
    应用技能原型目标驱动契约_V1(原型, effect);
    技能执行嵌套效果数组字段表_V1.forEach(字段名 => {
      if (Array.isArray(effect[字段名])) 收口生成状态施加目标与强度_V1(effect[字段名]);
    });
    if (Array.isArray(effect.条件分支)) {
      effect.条件分支.forEach(分支 => {
        技能条件分支效果数组字段表_V1.forEach(字段名 => {
          if (Array.isArray(分支?.[字段名])) 收口生成状态施加目标与强度_V1(分支[字段名]);
        });
      });
    }
  });
}

function 条件分支替换效果等价_V1(父效果 = {}, 替换效果列表 = []) {
  const 替换列表 = Array.isArray(替换效果列表) ? 替换效果列表 : [];
  if (替换列表.length !== 1) return false;
  const 基础 = 规范化等价比较效果条目_V1(父效果);
  const 替换 = 规范化等价比较效果条目_V1(替换列表[0]);
  if (!替换.目标 && 基础.目标) 替换.目标 = 基础.目标;
  if (!基础.目标 && 替换.目标 === '自身') delete 替换.目标;
  else if (!基础.目标 && 替换.目标) 基础.目标 = 替换.目标;
  return 稳定序列化技能效果_V1(基础) === 稳定序列化技能效果_V1(替换);
}

function 清理等价替换条件分支_V1(值) {
  if (!值 || typeof 值 !== 'object') return 值;
  if (Array.isArray(值)) {
    值.forEach(条目 => 清理等价替换条件分支_V1(条目));
    return 值;
  }
  if (Array.isArray(值.条件分支)) {
    值.条件分支 = 值.条件分支
      .filter(分支 => !(String(分支?.处理 || '').trim() === '替换效果' && 条件分支替换效果等价_V1(值, 分支?.替换效果 || [])))
      .map(分支 => {
        技能条件分支效果数组字段表_V1.forEach(键 => {
          if (Array.isArray(分支?.[键])) 清理等价替换条件分支_V1(分支[键]);
        });
        return 分支;
      });
    if (!值.条件分支.length) delete 值.条件分支;
  }
  技能执行嵌套效果数组字段表_V1.forEach(键 => {
    if (Array.isArray(值[键])) 清理等价替换条件分支_V1(值[键]);
  });
  return 值;
}

function 收口执行条件分支条目_V1(原始分支 = {}, 记录违规 = () => {}, 父效果 = {}) {
  if (!原始分支 || typeof 原始分支 !== 'object' || Array.isArray(原始分支)) return null;
  Object.keys(原始分支).forEach(键 => {
    if (技能执行黑名单键集合_V1.has(键)) 记录违规(`条件分支.${键}`);
  });
  const 条件 = (Array.isArray(原始分支.条件) ? 原始分支.条件 : [])
    .map(条目 => 收口执行条件分支条件条目_V1(条目, 记录违规))
    .filter(Boolean);
  if (!条件.length) {
    记录违规('条件分支.条件.必填');
    return null;
  }
  const 处理源 = String(原始分支.处理 || '').trim();
  const 处理 =
    技能条件分支处理候选_V1.includes(处理源)
      ? 处理源
      : Array.isArray(原始分支.替换效果) && 原始分支.替换效果.length
        ? '替换效果'
        : Array.isArray(原始分支.追加效果) && 原始分支.追加效果.length
          ? '追加效果'
          : '生效';
  const 收口结果 = { 条件, 处理 };
  if (处理 === '生效') {
    if ((Array.isArray(原始分支.替换效果) && 原始分支.替换效果.length) || (Array.isArray(原始分支.追加效果) && 原始分支.追加效果.length)) {
      记录违规('条件分支.生效.禁止携带改写效果');
      return null;
    }
    return 收口结果;
  }
  if (处理 === '替换效果' || 处理 === '追加效果') {
    const 字段名 = 处理 === '替换效果' ? '替换效果' : '追加效果';
    const 源列表 = Array.isArray(原始分支[字段名]) ? 原始分支[字段名] : [];
    const 效果列表 = 源列表
      .flatMap(效果 => 收口执行效果条目列表_V1(效果, 父效果.目标 || '单体', 记录违规, { 嵌套字段: 字段名 }))
      .filter(Boolean);
    if (!效果列表.length) {
      记录违规(`条件分支.${字段名}.必填`);
      return null;
    }
    if (技能条件列表包含释放后条件_V1(条件) && 技能效果列表包含释放前降低结算_V1(效果列表)) {
      记录违规(`条件分支.${字段名}.释放前结算`);
      return null;
    }
    if (处理 === '替换效果' && 条件分支替换效果等价_V1(父效果, 效果列表)) return null;
    收口结果[字段名] = 效果列表;
  }
  return 收口结果;
}

function 收口执行条件分支列表_V1(原始列表 = [], 记录违规 = () => {}, 父效果 = {}) {
  const 已有分支 = new Set();
  return (Array.isArray(原始列表) ? 原始列表 : [])
    .map(条目 => 收口执行条件分支条目_V1(条目, 记录违规, 父效果))
    .filter(条目 => {
      if (!条目) return false;
      const 分支键 = 稳定序列化技能效果_V1(条目);
      if (已有分支.has(分支键)) return false;
      已有分支.add(分支键);
      return true;
    });
}

function 收口执行副作用条目_V1(value = {}, recordViolation = () => {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  Object.keys(value).forEach(key => {
    if (技能执行黑名单键集合_V1.has(key)) recordViolation(`副作用列表.${key}`);
  });
  const 副作用类型 = String(value.副作用类型 || '').trim();
  if (!副作用类型) return null;
  if (!SKILL_SIDE_EFFECT_TYPE_OPTIONS_V1.includes(副作用类型)) recordViolation('副作用列表.副作用类型');
  if (!SKILL_SIDE_EFFECT_TRIGGER_OPTIONS_V1.includes(String(value.触发时机 || '效果生效后').trim())) recordViolation('副作用列表.触发时机');
  if (!SKILL_SIDE_EFFECT_TARGET_OPTIONS_V1.includes(String(value.生效对象 || '技能释放者').trim())) recordViolation('副作用列表.生效对象');
  if (value.参数 !== undefined || value.战斗效果 !== undefined || value.面板修改比例 !== undefined || value.面板固定修正 !== undefined)
    recordViolation('副作用列表.旧自由效果字段');
  Object.keys(value).forEach(key => {
    const 允许字段 = 副作用类型 === '致死献祭'
      ? ['副作用类型', '触发时机', '生效对象', '触发概率']
      : ['副作用类型', '触发时机', '生效对象', '触发概率', '持续回合', '副作用状态', '数值', '副数值', '关联状态'];
    if (!允许字段.includes(key) && !技能执行黑名单键集合_V1.has(key)) recordViolation(`副作用列表.${key}`);
  });
  if (副作用类型 !== '致死献祭') {
    const 正式状态 = String(SKILL_SIDE_EFFECT_TYPE_META_V1[副作用类型]?.状态 || 副作用类型).trim();
    const 输入状态 = String(value.副作用状态 || 正式状态).trim();
    if (输入状态 && 输入状态 !== 正式状态) recordViolation('副作用列表.副作用状态');
  }
  const 持续源 = value.持续回合;
  if (副作用类型 !== '致死献祭' && 持续源 !== undefined) {
    const 持续回合 = Number(持续源);
    if (!Number.isFinite(持续回合) || 持续回合 < 0 || Math.round(持续回合) !== 持续回合) recordViolation('副作用列表.持续回合');
  }
  const 概率源 = Number(value.触发概率 ?? 1);
  if (!Number.isFinite(概率源) || 概率源 < 0 || 概率源 > 1) recordViolation('副作用列表.触发概率');
  if (String(value.触发时机 || '效果生效后').trim() === '效果结束后' && !String(value.关联状态 || '').trim())
    recordViolation('副作用列表.关联状态');
  const normalized = normalizeSkillSideEffectEntry(value);
  if (!normalized) return null;
  return normalized;
}

function 收口执行副作用列表_V1(value = [], recordViolation = () => {}) {
  return (Array.isArray(value) ? value : [])
    .map(item => 收口执行副作用条目_V1(item, recordViolation))
    .filter(Boolean);
}

function 标准化原型字段值_V1(value) {
  if (Array.isArray(value)) return value.map(item => 标准化原型字段值_V1(item));
  if (!value || typeof value !== 'object') return 中文化技能机制参数值_V1(value);
  const result = {};
  Object.entries(value).forEach(([key, raw]) => {
    if (!key || 技能执行黑名单键集合_V1.has(key)) return;
    if (raw === undefined) return;
    if (typeof raw === 'string' && !raw.trim()) return;
    const 可见键名 = 技能机制可见键中文名映射_V1[key] || 技能机制属性键中文名映射_V1[key] || key;
    result[可见键名] = 标准化原型字段值_V1(raw);
  });
  return result;
}

function 解析技能触发概率_V1(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 && value <= 1 ? Number(value.toFixed(4)) : null;
  }
  const 文本 = String(value ?? '').trim();
  const 匹配 = /^(\d+(?:\.\d+)?)(%)?$/.exec(文本);
  if (!匹配) return null;
  const 原始值 = Number(匹配[1]);
  const 概率 = 匹配[2] ? 原始值 / 100 : 原始值;
  return Number.isFinite(概率) && 概率 >= 0 && 概率 <= 1 ? Number(概率.toFixed(4)) : null;
}

function 归一化技能原型字段同义值_V1(原型 = '', 字段 = {}) {
  if (!字段 || typeof 字段 !== 'object') return 字段;
  if (原型 === '属性修正') {
    const 归一属性 = 属性 => {
      const 文本 = String(属性 || '').trim();
      if (['攻击', '攻击力', '物攻', '力量输出'].includes(文本)) return '力量';
      if (['速度', '行动速度', '身法'].includes(文本)) return '敏捷';
      if (['血量上限', '生命值上限'].includes(文本)) return '生命上限';
      return 文本;
    };
    if (Array.isArray(字段.属性)) 字段.属性 = 字段.属性.map(归一属性);
    else if (字段.属性 !== undefined) 字段.属性 = 归一属性(字段.属性);
  }
  if (原型 === '判定修正') {
    const 判定 = String(字段.判定 || '').trim();
    if (['格挡', '招架', '格挡判定', '防御反应', '意志', '意志判定', '抗压'].includes(判定)) 字段.判定 = '反应';
    if (['精准', '命中率'].includes(判定)) 字段.判定 = '命中';
    if (['速度', '身法'].includes(判定)) 字段.判定 = '闪避';
  }
  if (原型 === '结算修正') {
    const 结算 = String(字段.结算 || '').trim();
    const 映射 = {
      元素伤害: '造成伤害',
      复合元素伤害: '造成伤害',
      音波伤害: '造成伤害',
      黑暗火焰伤害: '造成伤害',
      对阴邪伤害: '造成伤害',
      对龙族伤害: '造成伤害',
      神圣伤害: '造成伤害',
      黑暗伤害: '造成伤害',
      龙威压制: '技能效果',
      元素剥离效果: '技能效果',
      魂技威力: '技能效果',
      能量防御削减: '技能效果',
      冰属性抗性: '受到伤害',
      控制效果: '技能效果',
      近身控制: '技能效果',
      行动时序: '前摇',
      反射伤害: '反伤',
    };
    if (映射[结算]) 字段.结算 = 映射[结算];
  }
  if (原型 === '状态施加') {
    const 状态 = String(字段.状态 || '').trim();
    const 映射 = {
      减速: '迟缓',
      感知错乱: '精神紊乱',
      元素剥离: '防御剥夺',
      星光混乱: '混乱',
      苍穹镇压: '僵直',
      音波压制: '精神紊乱',
      地狱遮断: '迟缓',
      缠扰: '迟缓',
    };
    if (映射[状态]) 字段.状态 = 映射[状态];
    if (字段.触发概率 !== undefined) {
      const 概率 = 解析技能触发概率_V1(字段.触发概率);
      if (概率 !== null) 字段.触发概率 = 概率;
    }
  }
  if (原型 === '位移执行') {
    const 位移类型 = String(字段.位移类型 || '').trim();
    const 映射 = {
      突进: '拉近',
      冲锋: '拉近',
      冲刺: '拉近',
      飞掠: '拉近',
      击飞: '击退',
      震退: '击退',
      闪避: '脱离',
      闪现: '瞬移',
    };
    if (映射[位移类型]) 字段.位移类型 = 映射[位移类型];
  }
  if (原型 === '规则防御') {
    const 防御对象 = String(字段.防御对象 || '').trim();
    if (!String(字段.规则 || '').trim()) {
      字段.规则 = /致命|死亡|免死|锁血/.test(防御对象) ? '免死' : '免伤';
    }
    字段.次数 = Math.max(1, Math.round(Number(字段.次数 || 1)));
    delete 字段.防御对象;
    delete 字段.强度;
  }
  if (原型 === '召唤生成') {
    const 单位类型 = String(字段.召唤单位类型 || '').trim();
    const 映射 = {
      地狱生物: '其他召唤生物',
      蛇影: '其他召唤生物',
      镜像复制体: '其他召唤生物',
    };
    if (映射[单位类型]) 字段.召唤单位类型 = 映射[单位类型];
    const 行动模式 = String(字段.行动模式 || '').trim();
    if (行动模式 && !SKILL_PROTOTYPE_FIELD_OPTIONS_V1.行动模式.includes(行动模式)) 字段.行动模式 = '协同攻击';
  }
  return 字段;
}

function 读取机制编译原型列表_V1(机制 = '') {
  const 机制名 = String(机制 || '').trim();
  if (!机制名) return [];
  const 编译项 = SKILL_MECHANISM_REGISTRY_V1?.机制编译表?.[机制名];
  if (编译项 && Array.isArray(编译项.原型列表) && 编译项.原型列表.length) return 编译项.原型列表.map(entry => ({ ...entry }));
  return [];
}

function 构建机制编译输入覆盖列表_V1(机制名 = '', 原型列表 = [], 上下文 = {}) {
  const 机制 = String(机制名 || '').trim();
  const 品质 = normalizeSkillTableGrade(上下文?.品质 || 上下文?.grade || 'B');
  const 系别 = String(上下文?.系别 || 上下文?.type || '强攻系').trim() || '强攻系';
  const 目标 = 归一化执行效果作用目标_V1(上下文?.目标 || '单体', '单体');
  const 规划目标 = 归一化执行效果作用目标_V1(上下文?.规划目标 || 目标, 目标);
  const 伤害意图 = 上下文?.伤害意图 && typeof 上下文.伤害意图 === 'object' ? 上下文.伤害意图 : {};
  const 效果意图 = 上下文?.效果意图 && typeof 上下文.效果意图 === 'object' ? 上下文.效果意图 : {};
  const 结算参数 = 上下文?.结算参数 && typeof 上下文.结算参数 === 'object' ? 上下文.结算参数 : {};
  const 属性候选 = Array.isArray(上下文?.属性候选) && 上下文.属性候选.length ? 上下文.属性候选 : ['魂力'];
  const 副机制 = String(上下文?.主副机制上下文 || '').trim() === '副机制' || 上下文?.副机制 === true;
  const 效果缩放 = 副机制 ? Math.max(0.1, Number(上下文?.副机制效果倍率 || 上下文?.secondaryEffectScale || 1)) : 1;
  const 持续缩放 = 副机制 ? Math.max(0.1, Number(上下文?.副机制持续倍率 || 上下文?.secondaryDurationScale || 效果缩放)) : 1;
  const 基础持续回合 = Math.max(1, Math.round(Number(效果意图.持续回合 || 结算参数.持续回合 || (副机制 ? 1 : 2))));
  const 持续回合 = Math.max(1, Math.round(基础持续回合 * 持续缩放));
  const 数值倍率 = (值, 默认值 = 0, 方向 = 1, 按倍率 = false) => {
    const 原始值 = Number.isFinite(Number(值)) ? Number(值) : Number(默认值 || 0);
    if (按倍率) {
      const 差值 = 原始值 > 0 && 原始值 <= 2 ? 原始值 - 1 : 原始值;
      return formatSkillSignedChangeValue(差值 * 效果缩放 * Number(方向 || 1), true);
    }
    return 格式化原型比例变化_V1(原始值 * 效果缩放, 方向, false);
  };
  const 品质范围 = (表, 默认值 = 0) => {
    const [下限, 上限] = pickSkillGradeTableRangeV1(表, 品质);
    if (!Number.isFinite(Number(下限)) || !Number.isFinite(Number(上限))) return 默认值;
    return Number(((Number(下限) + Math.random() * (Number(上限) - Number(下限))) * 效果缩放).toFixed(4));
  };
  const 属性列表 = 数量 => {
    const 合法 = 属性候选
      .map(属性 => 中文化技能机制参数值_V1(属性))
      .filter(属性 => SKILL_PROTOTYPE_FIELD_OPTIONS_V1.属性.includes(属性));
    if (机制 === '全属性增益') return ['力量', '防御', '敏捷', '魂力上限', '精神力上限'];
    if (机制 === '速度提升' || 机制 === '速度压制' || 机制 === '减速') return ['敏捷'];
    return (合法.length ? 合法 : ['力量']).slice(0, Math.max(1, 数量));
  };
  const 属性数值 = 正向 => {
    const 倍率表 = 效果意图.属性倍率 && typeof 效果意图.属性倍率 === 'object' ? 效果意图.属性倍率 : {};
    const 原始倍率 = Object.values(倍率表).find(值 => Number.isFinite(Number(值)) && Math.abs(Number(值) - 1) > 0.001);
    const 默认倍率 = 正向 ? (副机制 ? 1.1 : 1.18) : (副机制 ? 0.9 : 0.82);
    const 倍率 = Number.isFinite(Number(原始倍率)) ? Number(原始倍率) : 默认倍率;
    return 格式化原型比例变化_V1(倍率, 1, true);
  };
  const 资源类型 = () => {
    if (系别 === '精神系') return '精神力';
    if (['辅助系', '治疗系', '食物系'].includes(系别)) return 机制 === '能力共享' ? ['魂力', '精神力'] : '魂力';
    return 机制 === '能力共享' ? '魂力' : ['魂力', '精神力'];
  };
  const 抹消对象 = () => {
    const 目标机制 = 系别 === '控制系'
      ? '控制机制'
      : 系别 === '元素系'
        ? '护盾'
        : '防御机制';
    if (目标机制 === '控制机制') return 构建技能机制抹消对象_V1('状态施加', { 状态: '沉默' });
    if (目标机制 === '护盾') return 构建技能机制抹消对象_V1('护盾变化');
    return 构建技能机制抹消对象_V1('规则防御');
  };
  const 默认源 = 原型条目 => {
    const 原型 = String(原型条目?.原型 || '').trim();
    const 字段 = { ...cloneJsonValue(原型条目), 目标: 原型条目?.目标 || 目标 };
    if (副机制) 字段.生效方式 = '独立生效';
    if (['状态施加', '判定修正', '结算修正', '属性修正', '决策干扰', '资源变化', '资源转移', '资源锁定', '规则改写', '机制抹消', '时窗修正'].includes(原型)) 字段.持续回合 ??= 持续回合;
    if (原型 === '伤害结算') {
      字段.威力倍率 ??= Math.max(1, Math.round(Number(伤害意图.威力倍率 || 获取魂技位伤害倍率_V1(上下文?.魂环位 || 1) * 100)));
      字段.伤害类型 ??= String(伤害意图.伤害类型 || (系别 === '精神系' ? '精神攻击' : 系别 === '元素系' ? '远程攻击' : '近身攻击')).trim() || '近身攻击';
      if (机制 === '多段伤害') 字段.攻击段数 = Math.max(2, Math.round(Number(效果意图.攻击段数 || 3)));
      if (Number(伤害意图.防御穿透 || 0) > 0) 字段.防御穿透 = Number(伤害意图.防御穿透 || 0);
    } else if (原型 === '状态施加') {
      if (!String(字段.状态 || '').trim()) 字段.状态 = String(效果意图.状态 || '').trim() || '眩晕';
      if (机制 === '持续伤害' || 机制 === '流血DOT') {
        字段.状态 = 机制 === '流血DOT' ? '流血' : (String(效果意图.状态 || '').trim() && String(效果意图.状态 || '').trim() !== '无' ? String(效果意图.状态).trim() : '持续创伤');
        字段.数值 = '-5%';
      }
      if (机制 === '持续恢复') {
        字段.状态 = '持续恢复';
        字段.数值 = 数值倍率((伤害意图.恢复比例 || 8) / 100, 0.08, 1);
      }
      if (机制 === '资源燃烧') {
        字段.状态 = '资源燃烧';
        字段.数值 = 数值倍率({ C: 0.1, B: 0.14, A: 0.2, S: 0.28, 'S+': 0.36 }[品质], 0.14, 1);
        字段.副数值 = '+5%';
      }
      if (机制 === '禁疗') 字段.数值 = 数值倍率(结算参数.禁疗比例, 副机制 ? 0.28 : 0.4, 1);
      if (机制 === '治疗反转') 字段.数值 = 数值倍率(结算参数.治疗反转比例, 1, 1);
      if (机制 === '标记锁定' || 机制 === '目标锁定') 字段.数值 ??= '-100%';
      if (机制 === '护卫') 字段.数值 = 数值倍率(结算参数.受到伤害降低, 0.15, 1);
      字段.驱动属性 ??= 系别 === '精神系' ? '精神力上限' : '魂力上限';
      字段.影响方向 ??= '效果强度';
    } else if (原型 === '属性修正') {
      const 正向 = !/削弱|压制|减速/.test(机制);
      字段.属性 ??= 属性列表(/多属性/.test(机制) ? 2 : 1);
      字段.数值 ??= 属性数值(正向);
    } else if (原型 === '判定修正') {
      const 判定 = String(字段.判定 || '').trim();
      const 正向 = /提升|增益|追击|共享视野|掌控提升/.test(机制);
      const 默认值 = 判定 === '反应' ? 0.12 : 0.1;
      字段.数值 ??= 数值倍率(
        判定 === '命中' ? (正向 ? 结算参数.命中加成 : 结算参数.命中压制)
          : 判定 === '闪避' ? (正向 ? 结算参数.闪避加成 : 结算参数.闪避压制)
            : (正向 ? 结算参数.反应加成 : 结算参数.反应压制),
        默认值,
        正向 ? 1 : -1,
      );
      if (机制 === '打断' || 机制 === '节奏打断') {
        字段.数值 = '-100%';
        字段.打断效果 = true;
      }
    } else if (原型 === '结算修正') {
      const 结算 = String(字段.结算 || '').trim();
      const 中性倍率转默认 = (值, 默认值) => {
        const 数值 = Number(值);
        return Number.isFinite(数值) && Math.abs(数值 - 1) > 0.0001 ? 值 : 默认值;
      };
      const 默认表 = {
        造成伤害: [中性倍率转默认(结算参数.伤害倍率系数, 副机制 ? 1.12 : 1.2), 副机制 ? 1.12 : 1.2, 1, true],
        受到伤害: [机制 === '承伤修正' ? 结算参数.受到伤害降低 : 中性倍率转默认(结算参数.伤害倍率系数, 1.2), 机制 === '承伤修正' ? 0.15 : 1.2, 机制 === '承伤修正' ? -1 : 1, 机制 !== '承伤修正'],
        治疗: [中性倍率转默认(结算参数.治疗倍率, 1.2), 1.2, 1, true],
        消耗: [中性倍率转默认(结算参数.消耗修正倍率, 0.8), 0.8, 1, true],
        前摇: [中性倍率转默认(结算参数.前摇修正倍率 || 结算参数.施放速度压制, 机制 === '感知干扰' || 机制 === '软控' || 机制 === '认知扭曲' ? 1.12 : 0.8), 机制 === '感知干扰' || 机制 === '软控' || 机制 === '认知扭曲' ? 1.12 : 0.8, 机制 === '感知干扰' || 机制 === '软控' || 机制 === '认知扭曲' ? 1 : 1, true],
        反伤: [结算参数.反伤比例, 0.2, 1, false],
        伤害转移: [结算参数.伤害转移比例, 0.2, 1, false],
        伤害吸收: [结算参数.伤害吸收比例, 0.2, 1, false],
        伤害转治疗: [结算参数.伤害转治疗比例, 品质范围({ C: [0.12, 0.18], B: [0.18, 0.28], A: [0.24, 0.38], S: [0.28, 0.42], 'S+': [0.42, 0.6] }, 0.24), 1, false],
        治疗转伤害: [结算参数.治疗转伤害比例, 品质范围({ C: [0.12, 0.18], B: [0.18, 0.28], A: [0.24, 0.38], S: [0.28, 0.42], 'S+': [0.42, 0.6] }, 0.24), 1, false],
        伤害分摊: [结算参数.伤害分摊比例, 0.25, 1, false],
        消耗分摊: [结算参数.消耗分摊比例, 0.25, 1, false],
        防御穿透: [结算参数.防御穿透比例, 0.2, 1, false],
        防御剥夺: [结算参数.防御剥夺比例, 0.15, 1, false],
        精神抗性剥夺: [结算参数.精神抗性剥夺比例, 0.15, 1, false],
        技能效果: [中性倍率转默认(结算参数.技能效果倍率, 1.2), 1.2, 1, true],
        反击: [结算参数.反击倍率, 1.2, 1, true],
        持续伤害引爆: [结算参数.引爆倍率, 副机制 ? 1.2 : 1.55, 1, true],
      };
      const 参数 = 默认表[结算] || [undefined, 0.2, 1, false];
      字段.数值 ??= 数值倍率(...参数);
      if (['伤害分摊', '消耗分摊'].includes(结算)) 字段.数量 = Math.max(1, Math.round(Number(结算 === '伤害分摊' ? 结算参数.伤害分摊数量 : 结算参数.消耗分摊数量) || 1));
      if (结算 === '伤害转移') 字段.转移对象 = String(结算参数.伤害转移对象 || '攻击者').trim() || '攻击者';
      if (结算 === '伤害吸收') {
        字段.吸收来源 = String(字段.吸收来源 || 结算参数.吸收来源 || 效果意图.吸收来源 || '造成伤害').trim() || '造成伤害';
        字段.吸收资源 = String(字段.吸收资源 || 结算参数.吸收资源 || 效果意图.吸收资源 || '生命').trim() || '生命';
      }
      if (结算 === '持续伤害引爆') 字段.条件分支 ??= 构建缺少状态禁用条件分支_V1('持续创伤');
      if (机制 === '斩杀补伤') {
        字段.结算 = '受到伤害';
        const 斩杀倍率 = Math.abs(Number(结算参数.伤害倍率系数) - 1) > 0.0001 ? 结算参数.伤害倍率系数 : 1.15;
        const 斩杀补伤数值 = 数值倍率(斩杀倍率, 1.15, 1, true);
        if (parseSkillSignedChangeNumber(斩杀补伤数值) !== 0) 字段.数值 = 斩杀补伤数值;
      }
    } else if (原型 === '资源变化') {
      const 资源 = 机制 === '魂力恢复' ? '魂力' : 机制 === '精神恢复' ? '精神力' : '生命';
      字段.资源 ??= 资源;
      字段.数值 ??= 数值倍率(机制 === '体力恢复' ? (伤害意图.恢复比例 || 8) / 100 : 0.1, 0.1, 1);
    } else if (原型 === '资源转移') {
      字段.资源 ??= 资源类型();
      字段.资源转移方式 ??= 机制 === '能力共享' ? '共享' : '吞噬';
      字段.转化比例 ??= 机制 === '能力共享' ? 1 : ({ C: 0.9, B: 1, A: 1.1, S: 1.2, 'S+': 1.3 }[品质] || 1);
      字段.数值 ??= 数值倍率(机制 === '能力共享' ? 0.18 : 0.16, 0.16, 机制 === '能力共享' ? 1 : -1);
    } else if (原型 === '护盾变化') {
      字段.护盾模式 ??= 机制 === '斩盾' ? '斩盾' : '正向护盾';
      字段.数值 ??= 机制 === '斩盾'
        ? 数值倍率({ C: 0.7, B: 0.95, A: 1.2, S: 1.5, 'S+': 1.8 }[品质], 0.95, -1)
        : Math.max(1, Number(伤害意图.护盾数值 || 100));
      if (机制 === '斩盾') 字段.条件分支 ??= 构建缺少护盾禁用条件分支_V1();
    } else if (原型 === '规则防御') {
      字段.次数 ??= Math.max(1, Math.round(Number(结算参数.免死次数 || (品质 === 'S' || 品质 === 'S+' ? 2 : 1))));
    } else if (原型 === '规则改写') {
      字段.规则 ??= '缴械';
      if (字段.规则 === '死亡转存活') 字段.数值 ??= 数值倍率(品质范围({ C: [0.12, 0.18], B: [0.18, 0.28], A: [0.24, 0.38], S: [0.28, 0.42], 'S+': [0.42, 0.6] }, 0.24), 0.24, 1);
      else delete 字段.数值;
    } else if (原型 === '机制抹消') {
      字段.抹消对象 ??= 抹消对象();
    } else if (原型 === '状态交换') {
      字段.状态 ??= '任意负面';
      字段.条件分支 ??= 构建缺少状态禁用条件分支_V1('任意负面', '禁用', '自身');
    } else if (原型 === '状态转移') {
      字段.状态 ??= '任意状态';
      字段.来源 ??= '自身';
      字段.去向 ??= '目标';
      字段.数量 ??= 品质 === 'S' || 品质 === 'S+' ? 3 : 品质 === 'A' ? 2 : 1;
    } else if (原型 === '复制执行') {
      字段.复制类型 ??= '复制技能';
      字段.复制模式 ??= '即时镜像';
      字段.保存上限 ??= Math.max(1, ({ F: 1, D: 1, C: 1, B: 2, A: 2, S: 3, 'S+': 4 }[品质] || 1));
      字段.可用次数 ??= 1;
      字段.保留回合 ??= 持续回合;
    } else if (原型 === '召唤生成') {
      const 元数据 = 效果意图.召唤元数据 || {};
      字段.目标 = '自身';
      字段.召唤单位类型 ??= 机制 === '分身' ? '分身' : String(元数据.召唤单位类型 || '魂兽').trim() || '魂兽';
      字段.召唤物名称 ??= 机制 === '分身' ? String(效果意图.状态 || '分身').trim() || '分身' : String(元数据.召唤物名称 || '待命召唤物').trim() || '待命召唤物';
      字段.数量 ??= Math.max(1, Math.round(Number(机制 === '分身' ? 效果意图.分身元数据?.分身数量 : 元数据.召唤数量) || 1));
      字段.继承属性比例 ??= 机制 === '分身' ? Number(效果意图.分身元数据?.实力继承比例 || 0.45) : undefined;
      字段.强度 ??= Number(元数据.强度 || 1);
      字段.行动模式 ??= 元数据.行动模式 || '协同攻击';
      if (字段.行动模式 === '护卫') 字段.承伤规则 = 元数据.承伤规则 || '护卫承伤';
    } else if (原型 === '资源锁定') {
      字段.资源 ??= 资源类型();
      字段.锁定类型 ??= '回复锁定';
      字段.数值 ??= formatSkillSignedChangeValue(Number(({ C: 0.18, B: 0.25, A: 0.34, S: 0.45, 'S+': 0.58 }[品质] || 0.25) * 效果缩放), true);
    } else if (原型 === '决策干扰') {
      字段.干扰 ??= '判断干扰';
      字段.数值 ??= 数值倍率(结算参数.判断干扰强度 || 结算参数.随机索敌率, 0.12, 1);
    } else if (原型 === '时窗修正') {
      字段.调整字段 ??= '持续回合';
      字段.调整方式 ??= /压缩/.test(机制) ? '压缩' : '延长';
      字段.调整回合 ??= 1;
      if (字段.调整方式 === '压缩') {
        字段.结算倍率 ??= '+100%';
        字段.条件分支 ??= 构建缺少状态禁用条件分支_V1('持续创伤');
      }
    } else if (原型 === '时光回溯') {
      字段.目标 = ['单体', '群体', '全场'].includes(规划目标) ? 规划目标 : '单体';
      字段.发动方式 ??= '被动';
      字段.驱动属性 ??= '精神力上限';
      字段.影响方向 ??= '成功率';
    } else if (原型 === '炸环') {
      字段.目标 = '自身';
      字段.强化倍率 ??= '+100%';
    } else if (原型 === '修炼增益') {
      字段.收益类型 ??= '训练方式收益';
      字段.训练方式 ??= '冥想';
      字段.数值 ??= 数值倍率(品质范围({ C: [1.08, 1.12], B: [1.15, 1.22], A: [1.24, 1.34], S: [1.36, 1.5], 'S+': [1.5, 1.65] }, 1.15), 1.15, 1, true);
      字段.有效期tick ??= Math.max(6, 持续回合 * 6);
    }
    return 字段;
  };
  return (Array.isArray(原型列表) ? 原型列表 : []).map(默认源);
}

function 编译技能机制为正式效果列表_V1(机制名 = '', 上下文 = {}) {
  const 机制 = String(机制名 || '').trim();
  if (!机制) return [];
  const 原型列表 = 读取机制编译原型列表_V1(机制);
  if (!原型列表.length) return [];
  const 目标 = 归一化执行效果作用目标_V1(上下文?.目标 || '单体', '单体');
  const 编译输入列表 = 构建机制编译输入覆盖列表_V1(机制, 原型列表, 上下文);
  const recordViolation = path => {
    if (path) throw new Error(`技能机制编译错误:${机制}.${path}`);
  };
  const 正式效果列表 = 原型列表
    .flatMap((原型条目, index) => {
      const 编译输入 = 编译输入列表[index] && typeof 编译输入列表[index] === 'object'
        ? 编译输入列表[index]
        : {};
      const 输入条目 = {
        ...cloneJsonValue(原型条目),
        ...cloneJsonValue(编译输入),
        原型: 原型条目.原型,
        目标: 原型条目.目标 || 目标,
      };
      if (编译输入.目标) 输入条目.目标 = 编译输入.目标;
      if (上下文?.生效方式 && !输入条目.生效方式) 输入条目.生效方式 = 上下文.生效方式;
      return 收口执行效果条目列表_V1(输入条目, 输入条目.目标 || 目标, recordViolation, {
        ...上下文,
        机制名: 机制,
        来自共享机制编译表: true,
      });
    })
    .filter(Boolean);
  return 收口生成正式效果终态_V1(正式效果列表, {
    目标,
    path: `机制编译.${机制}`,
    技能: 上下文?.技能,
  });
}

function 效果原型来自共享机制编译_V1(effect = {}, 机制名 = '') {
  if (!effect || typeof effect !== 'object' || Array.isArray(effect)) return false;
  const 原型 = String(effect.原型 || '').trim();
  if (!原型) return false;
  return 读取机制编译原型列表_V1(机制名).some(条目 => String(条目?.原型 || '').trim() === 原型);
}

function 断言效果来自共享机制编译_V1(effect = {}, 机制名 = '', path = '技能效果') {
  if (!机制名 || !String(effect?.原型 || '').trim()) return effect;
  if (!效果原型来自共享机制编译_V1(effect, 机制名)) {
    throw new Error(`${path}:${机制名}不能生成原型${String(effect?.原型 || '无')}`);
  }
  return effect;
}

function 编译机制补充效果列表为正式效果_V1(机制名 = '', 原始效果列表 = [], 上下文 = {}) {
  const 机制 = String(机制名 || '').trim();
  const 原型集合 = new Set(读取机制编译原型列表_V1(机制).map(条目 => String(条目?.原型 || '').trim()).filter(Boolean));
  if (!机制 || !原型集合.size) return [];
  const 正式效果列表 = (Array.isArray(原始效果列表) ? 原始效果列表 : [原始效果列表])
    .filter(effect => effect && typeof effect === 'object' && !Array.isArray(effect) && 原型集合.has(String(effect.原型 || '').trim()))
    .flatMap(effect => 收口执行效果条目列表_V1(effect, effect.目标 || 上下文?.目标 || '单体', path => {
      if (path) throw new Error(`技能机制补充效果错误:${机制}.${path}`);
    }, { ...上下文, 机制名: 机制, 来自共享机制编译表: true }))
    .filter(Boolean);
  return 收口生成正式效果终态_V1(正式效果列表, {
    目标: 上下文?.目标 || '单体',
    path: `机制补充.${机制}`,
    技能: 上下文?.技能,
  });
}

function 机制具备共享原型编译_V1(机制名 = '') {
  return 读取机制编译原型列表_V1(机制名).length > 0;
}

var 技能执行批量字段键表_V1 = Object.freeze(['原型', '属性', '资源', '状态', '类型']);
var 技能执行嵌套效果数组字段集合_V1 = new Set(技能执行嵌套效果数组字段表_V1);
var 技能执行原型禁用字段集合_V1 = new Set([ '对象', '结算策略', '动作', '状态持续', 'cast_time', '应用' + '原型', '参数', '判定属性', '判定阈值', '成功参数', '失败参数', '事件优先级', '快照规则']);

function 转换原型资源字段_V1(value = '') {
  const text = String(value || '').trim();
  if (text === '双资源') return ['魂力', '精神力'];
  return ({ vit: '体力', hp: '生命', sp: '魂力', men: '精神力' }[text]) || text || '魂力';
}

function 格式化原型比例变化_V1(value, 方向 = 1, 按倍率 = false) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const num = /%$/.test(text) ? Number(text.replace('%', '')) / 100 : Number(text);
  if (!Number.isFinite(num)) return text;
  const abs = Math.abs(按倍率 && num > 1 ? num - 1 : num);
  return formatSkillSignedChangeValue(abs * (方向 < 0 ? -1 : 1), true);
}

function 规范化资源锁定比例_V1(value, fallback = 0.5) {
  const text = String(value ?? '').trim();
  const fallbackRatio = Math.max(0.01, Math.min(1, Math.abs(Number(fallback) || 0.5)));
  if (!text) return formatSkillSignedChangeValue(fallbackRatio, true);
  const raw = Number(text.replace('%', ''));
  if (!Number.isFinite(raw)) return formatSkillSignedChangeValue(fallbackRatio, true);
  const ratio = Math.abs(/%$/.test(text) || Math.abs(raw) > 1 ? raw / 100 : raw);
  return formatSkillSignedChangeValue(Math.max(0.01, Math.min(1, ratio)), true);
}

function 读取技能比例数值_V1(value = 0) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = String(value ?? '').trim();
  if (!text) return 0;
  const match = text.match(/[-+]?\d+(?:\.\d+)?/);
  if (!match) return 0;
  const num = Number(match[0]);
  if (!Number.isFinite(num)) return 0;
  return text.includes('%') ? num / 100 : num;
}

function 格式化技能资源转移数值方向_V1(value = '', 方式 = '吞噬') {
  const text = String(value ?? '').trim();
  if (/%$/.test(text)) {
    const 百分比 = Math.abs(Number(text.replace('%', '')) || 0);
    const 符号 = 方式 === '吞噬' ? '-' : '+';
    return `${符号}${formatSkillNumber(百分比, Math.abs(百分比 % 1) < 0.0001 ? 0 : 2)}%`;
  }
  const 数值 = Math.abs(Number(text) || 0);
  const 符号 = 方式 === '吞噬' ? '-' : '+';
  return `${符号}${formatSkillNumber(数值, Math.abs(数值 % 1) < 0.0001 ? 0 : 2)}`;
}

function 构建资源转移原型组_V1({
  目标 = '单体',
  资源 = '魂力',
  比例 = 0.1,
  转化比例 = 1,
  生效方式 = '独立生效',
  转移类型 = '吞噬',
  持续回合 = 0,
} = {}) {
  const 基础比例 = Math.max(0, Number(比例 || 0));
  const 转移方式 = 转移类型 === '共享' ? '共享' : 转移类型 === '均分' ? '均分' : 转移类型 === '转移' ? '转移' : '吞噬';
  const 字段 = {
    原型: '资源转移',
    目标,
    资源: 转换原型资源字段_V1(资源),
    数值: 格式化原型比例变化_V1(基础比例, 转移方式 === '共享' ? 1 : -1),
    生效方式,
    资源转移方式: 转移方式,
  };
  if (Number(持续回合 || 0) > 0) 字段.持续回合 = Math.max(1, Math.round(Number(持续回合 || 1)));
  if (转移方式 === '吞噬' || 转移方式 === '共享' || 转移方式 === '转移') 字段.转化比例 = Number(Math.max(0, Number(转化比例 || 1)).toFixed(4));
  return [字段];
}

function 构建资源燃烧状态原型_V1({ 目标 = '单体', 资源 = '魂力', 比例 = 0.1, 持续回合 = 2 } = {}) {
  void 资源;
  return {
    原型: '状态施加',
    目标,
    状态: '资源燃烧',
    数值: 格式化原型比例变化_V1(Math.min(0.03, Math.max(0, Number(比例 || 0))), 1),
    副数值: '+5%',
    持续回合: Math.max(1, Math.round(Number(持续回合 || 2))),
    驱动属性: '魂力上限',
    影响方向: '效果强度',
  };
}

function 构建缺少状态禁用条件分支_V1(状态 = '持续创伤', 处理 = '禁用', 对象 = '目标') {
  return [{
    条件: [{ 类型: '状态存在', 对象, 比较: '无', 状态 }],
    处理,
  }];
}

function 构建缺少护盾禁用条件分支_V1() {
  return [{
    条件: [{ 类型: '护盾', 对象: '目标', 比较: '无' }],
    处理: '禁用',
  }];
}

var 状态转移端点集合_V1 = Object.freeze(['自身', '目标', '友方', '敌方']);

function 状态转移端点有效_V1(值 = '') {
  return 状态转移端点集合_V1.includes(String(值 || '').trim());
}

function 状态交换状态筛选有效_V1(值 = '') {
  const 状态 = String(值 || '').trim();
  return 状态 === '任意负面' || 技能负面状态选项_V1.includes(状态);
}

function 规范化状态转移数量_V1(值 = 1) {
  const 文本 = String(值 ?? '').trim();
  if (文本 === '全部') return '全部';
  return Math.max(1, Math.round(Number(文本 || 1) || 1));
}

function 补足机制模板原型数值_V1(原型 = '', 字段 = {}, source = {}, 上下文 = {}) {
  if (!字段 || typeof 字段 !== 'object') return;
  const 取首个数值 = keys => {
    for (const key of keys) {
      if (source[key] !== undefined && source[key] !== null && String(source[key]).trim() !== '') return source[key];
    }
    return undefined;
  };
  if (原型 === '伤害结算') {
    if (字段.威力倍率 === undefined) {
      const rawPower = 取首个数值(['威力倍率', 'powerRatio', '强度倍率', '单段倍率', '爆发倍率', '每跳倍率', '数值']);
      const powerNumber = Number(rawPower);
      if (Number.isFinite(powerNumber)) 字段.威力倍率 = Math.max(1, Math.round(powerNumber));
    }
    if (字段.伤害类型 === undefined) 字段.伤害类型 = String(source.伤害类型 || source.damageType || '近身攻击').trim() || '近身攻击';
    if (字段.攻击段数 === undefined) {
      const rawHitCount = 取首个数值(['攻击段数', '段数', 'hitCount', 'segmentCount']);
      if (rawHitCount !== undefined) 字段.攻击段数 = Math.max(1, Math.round(Number(rawHitCount) || 1));
    }
    if (字段.防御穿透 === undefined) {
      const rawPen = 取首个数值(['防御穿透', '破甲比例']);
      if (rawPen !== undefined) 字段.防御穿透 = Number(rawPen) || 0;
    }
    return;
  }
  if (原型 === '护盾变化') {
    if (字段.数值 === undefined) {
      const rawShield = 取首个数值(['数值', '护盾值']);
      if (rawShield !== undefined) 字段.数值 = 规范化执行效果数值_V1(rawShield, Number(rawShield) < 0 ? '减值' : '加值');
    }
    if (!['正向护盾', '斩盾', '窃盾'].includes(String(字段.护盾模式 || '').trim())) {
      字段.护盾模式 = parseSkillSignedChangeNumber(字段.数值) < 0 ? '斩盾' : '正向护盾';
    }
    return;
  }
  if (原型 === '资源变化' || 原型 === '资源转移') {
    if (字段.资源 === undefined) {
      const rawResource = String(原型 === '资源转移' ? source.资源 || '' : source.资源 || source.属性 || source.资源类型 || '').trim();
      字段.资源 = 转换原型资源字段_V1(rawResource);
    }
    if (字段.数值 === undefined) {
      const 目标 = String(字段.目标 || source.目标 || '').trim();
      const rawDrain = 取首个数值(['夺取比例']);
      const rawBurn = 取首个数值(['燃烧比例']);
      const rawRefeed = 取首个数值(['反灌比例', '共享比例']);
      const rawRecover = 取首个数值(['数值', '恢复比例', '回复比例', '资源变化', '消耗比例']);
      if (原型 === '资源变化' && rawBurn !== undefined) 字段.数值 = 格式化原型比例变化_V1(rawBurn, -1);
      else if (原型 === '资源转移' && rawDrain !== undefined) {
        const 转化比例 = Math.max(0, Number(source.转化比例 ?? 1) || 1);
        字段.数值 = 格式化原型比例变化_V1(Number(rawDrain || 0) * (目标 === '自身' ? 转化比例 : 1), 目标 === '自身' ? 1 : -1);
      } else if (原型 === '资源转移' && rawRefeed !== undefined) 字段.数值 = 格式化原型比例变化_V1(rawRefeed, 1);
      else if (rawRecover !== undefined) 字段.数值 = 规范化执行效果数值_V1(rawRecover, Number(rawRecover) < 0 ? '减值' : '加值');
    }
    if (字段.持续回合 === undefined && source.持续回合 !== undefined) {
      字段.持续回合 = Math.max(0, Math.round(Number(source.持续回合 || 0)));
    }
    return;
  }
  if (原型 === '属性修正') {
    归一化技能原型字段同义值_V1(原型, 字段);
    if (字段.属性 === undefined) {
      const rawProperty = String(source.属性 || '').trim();
      if (rawProperty) 字段.属性 = 中文化技能机制参数值_V1(rawProperty);
    }
    if (字段.数值 === undefined) {
      const rawAttributeValue = 取首个数值(['数值', '属性倍率', '倍率']);
      if (rawAttributeValue !== undefined) 字段.数值 = 规范化执行效果数值_V1(rawAttributeValue, source.动作 || source.action || '');
    }
    return;
  }
  if (原型 === '结算修正' && String(字段.结算 || source.结算 || '').trim() === '持续伤害引爆' && 字段.条件分支 === undefined) {
    字段.条件分支 = 构建缺少状态禁用条件分支_V1(String(source.状态 || '持续创伤').trim() || '持续创伤');
  }
  if (原型 === '时窗修正' && 字段.调整字段 === undefined) 字段.调整字段 = '持续回合';
  if (原型 === '判定修正' && 字段.持续回合 !== undefined) 字段.持续回合 = Math.max(1, Math.min(10, Math.round(Number(字段.持续回合 || 1))));
  if (字段.数值 !== undefined) return;
  let raw;
  if (原型 === '判定修正') {
    归一化技能原型字段同义值_V1(原型, 字段);
    const 判定 = String(字段.判定 || '').trim();
    const map = {
      命中: ['增加命中', '降低命中'],
      闪避: ['增加闪避', '降低闪避'],
      反应: ['增加反应', '降低反应'],
    };
    raw = 取首个数值(map[判定] || []);
    if (字段.持续回合 !== undefined) 字段.持续回合 = Math.max(1, Math.min(10, Math.round(Number(字段.持续回合 || 1))));
  } else if (原型 === '决策干扰') {
    const 干扰 = String(字段.干扰 || '').trim();
    const map = {
      判断干扰: ['数值'],
      索敌干扰: ['数值'],
    };
    raw = 取首个数值(map[干扰] || []);
  } else if (原型 === '结算修正') {
    归一化技能原型字段同义值_V1(原型, 字段);
    const 结算 = String(字段.结算 || '').trim();
      const map = {
        造成伤害: ['数值'],
        受到伤害: ['数值'],
        治疗: ['数值'],
        消耗: ['数值'],
        前摇: ['数值'],
        技能效果: ['技能效果倍率'],
        反伤: ['反射比例'],
        伤害转移: ['转移比例'],
        伤害吸收: ['吸收比例'],
        伤害转治疗: ['转化比例', 'rewriteValue', '数值'],
        治疗转伤害: ['转化比例', 'rewriteValue', '数值'],
        伤害分摊: ['分摊比例'],
        消耗分摊: ['分摊比例'],
        防御穿透: ['破甲比例'],
        防御剥夺: ['防御剥夺'],
        精神抗性剥夺: ['精神抗性剥夺'],
        反击: ['反击倍率'],
        持续伤害引爆: ['引爆倍率', 'detonateRatio'],
      };
      raw = 取首个数值(map[结算] || []);
      if (raw !== undefined) {
        const 按倍率 = ['造成伤害', '受到伤害', '治疗', '消耗', '前摇', '技能效果'].includes(结算);
        const 格式化数值 = 格式化原型比例变化_V1(raw, 1, 按倍率);
        if (parseSkillSignedChangeNumber(格式化数值) === 0) return;
        字段.数值 = 格式化数值;
        if (['反伤', '伤害转移', '伤害吸收', '伤害转治疗', '治疗转伤害', '伤害分摊', '消耗分摊', '防御穿透', '防御剥夺', '精神抗性剥夺', '反击', '持续伤害引爆'].includes(结算)) {
          字段.数值 = formatSkillSignedChangeValue(Math.abs(parseSkillSignedChangeNumber(字段.数值)), true);
        }
        if (结算 === '伤害转移') 字段.转移对象 = String(source.转移对象 || source.transferTarget || '攻击者').trim() || '攻击者';
        if (结算 === '伤害吸收') {
          字段.吸收来源 = String(source.吸收来源 || source.absorbSource || '造成伤害').trim() || '造成伤害';
          字段.吸收资源 = String(source.吸收资源 || source.resourceType || '生命').trim() || '生命';
        }
        if (结算 === '持续伤害引爆' && 字段.条件分支 === undefined) 字段.条件分支 = 构建缺少状态禁用条件分支_V1(String(source.状态 || '持续创伤').trim() || '持续创伤');
        return;
      }
  } else if (原型 === '时窗修正') {
    const 调整字段 = String(字段.调整字段 || '持续回合').trim() || '持续回合';
    if (字段.调整方式 === undefined) {
      const sourceText = String(source.调整方式 || source.机制 || source.动作 || '').trim();
      字段.调整方式 = /压缩|引爆|缩短/.test(sourceText) ? '压缩' : '延长';
    }
    if (调整字段 === '持续回合') {
      if (字段.调整回合 === undefined) {
        const rawRounds = 取首个数值(['调整回合', '持续回合', '延长回合', '压缩回合', 'consumeRounds', 'extendRounds']);
        字段.调整回合 = Math.max(1, Math.min(3, Math.round(Number(rawRounds || 1))));
      }
      if (字段.结算倍率 === undefined) {
        const rawRatio = 取首个数值(['结算倍率', '引爆倍率', '压缩倍率', 'compressRatio']);
        if (rawRatio !== undefined) 字段.结算倍率 = 格式化原型比例变化_V1(rawRatio, 1, true);
      }
    } else if (调整字段 === '有效期tick') {
      if (字段.调整tick === undefined) {
        const rawTick = 取首个数值(['调整tick', '有效期tick', '持续tick']);
        字段.调整tick = Math.max(1, Math.min(1008, Math.round(Number(rawTick || 6))));
      }
    } else if (['触发次数', '使用次数'].includes(调整字段)) {
      if (字段.调整次数 === undefined) {
        const rawCount = 取首个数值(['调整次数']);
        字段.调整次数 = Math.max(1, Math.min(3, Math.round(Number(rawCount || 1))));
      }
    }
    return;
  } else if (原型 === '规则防御') {
    归一化技能原型字段同义值_V1(原型, 字段);
    raw = 取首个数值(['次数', '免伤次数', '免死次数', '抵消次数']);
    if (raw !== undefined) 字段.次数 = Math.max(1, Math.round(Number(raw) || 1));
    else if (字段.次数 === undefined) 字段.次数 = 1;
    const 规则 = String(字段.规则 || source.规则 || '').trim();
    if (规则 === '免死' && (!字段.触发限制 || typeof 字段.触发限制 !== 'object' || Array.isArray(字段.触发限制))) {
      字段.触发限制 = { 周期: '每战', 次数: Math.max(1, Math.round(Number(字段.次数 || 1))) };
    }
    return;
  } else if (原型 === '规则改写') {
    const 规则 = SKILL_PROTOTYPE_FIELD_OPTIONS_V1.规则.includes(String(字段.规则 || source.规则 || '').trim())
      ? String(字段.规则 || source.规则 || '').trim()
      : '缴械';
    字段.规则 = 规则;
    if (规则 === '死亡转存活') {
      字段.目标 = '自身';
      delete 字段.持续回合;
      delete 字段.死亡时限tick;
      delete 字段.复活代价类型;
      delete 字段.复活代价对象;
      delete 字段.复活代价值;
      delete 字段.复活代价时限tick;
      delete 字段.复活后状态;
      delete 字段.复活后状态时限tick;
      if (字段.数值 === undefined) 字段.数值 = 格式化原型比例变化_V1(取首个数值(['数值', 'rewriteValue']) ?? 0.25, 0.25, 1, true);
    } else {
      delete 字段.数值;
      if (字段.持续回合 === undefined) 字段.持续回合 = Math.max(1, Math.round(Number(source.持续回合 || source.duration || 1)));
      delete 字段.死亡时限tick;
      delete 字段.复活代价类型;
      delete 字段.复活代价对象;
      delete 字段.复活代价值;
      delete 字段.复活代价时限tick;
      delete 字段.复活后状态;
      delete 字段.复活后状态时限tick;
    }
    return;
  } else if (原型 === '战斗外复活') {
    字段.数值 = 格式化原型比例变化_V1(取首个数值(['数值']) ?? 0.25, 0.25, 1, true);
    字段.死亡时限tick = Math.max(1, Math.round(Number(字段.死亡时限tick || source.死亡时限tick || 144)));
    字段.复活代价类型 = 战斗外复活代价类型选项_V1.includes(String(字段.复活代价类型 || source.复活代价类型 || '').trim())
      ? String(字段.复活代价类型 || source.复活代价类型).trim()
      : '状态代价';
    字段.复活代价对象 = String(字段.复活代价对象 || source.复活代价对象 || (字段.复活代价类型 === '消耗实体物品' ? '复活类丹药' : 字段.复活代价类型 === '封印能力' ? '魂技' : 字段.复活代价类型 === '永久代价' ? '等级上限' : '虚弱')).trim();
    字段.复活代价值 = String(字段.复活代价值 || source.复活代价值 || '+1').trim() || '+1';
    字段.复活代价时限tick = Math.max(1, Math.round(Number(字段.复活代价时限tick || source.复活代价时限tick || 144)));
    字段.复活后状态 = String(字段.复活后状态 || source.复活后状态 || '虚弱').trim() || '虚弱';
    字段.复活后状态时限tick = Math.max(1, Math.round(Number(字段.复活后状态时限tick || source.复活后状态时限tick || 144)));
    return;
  } else if (原型 === '机制抹消') {
    字段.抹消对象 = 规范化技能机制抹消对象_V1(字段.抹消对象 ?? source.抹消对象);
    return;
  } else if (原型 === '状态施加') {
    归一化技能原型字段同义值_V1(原型, 字段);
    if (字段.状态 === undefined) 字段.状态 = String(source.状态 || '持续创伤').trim() || '持续创伤';
    const 每回合伤害 = 取首个数值(['每回合伤害']);
    if (
      (!SKILL_PROTOTYPE_FIELD_OPTIONS_V1.状态.includes(String(字段.状态 || '').trim()) || String(字段.状态 || '').trim() === '标记') &&
      每回合伤害 !== undefined
    ) 字段.状态 = '持续创伤';
    const 状态名 = String(字段.状态 || '').trim();
    const 敏捷倍率 = 取首个数值(['敏捷倍率']);
    if (每回合伤害 !== undefined && 状态施加允许数值字段_V1(状态名)) {
      const 文本 = String(每回合伤害 ?? '').trim();
      const 数值 = Number(文本.replace('%', ''));
      const 比例 = Number.isFinite(数值)
        ? Math.min(0.03, Math.abs(/%$/.test(文本) || Math.abs(数值) > 1 ? 数值 / 100 : 数值))
        : Math.min(0.03, Math.abs(读取技能比例数值_V1(每回合伤害)));
      字段.数值 = formatSkillSignedChangeValue(-比例, true);
    } else if (状态名 === '迟缓' && 敏捷倍率 !== undefined) {
      字段.数值 = 格式化原型比例变化_V1(敏捷倍率, 1, true);
    }
    return;
  } else if (原型 === '状态交换') {
    字段.状态 = String(字段.状态 || source.状态 || '').trim() || '任意负面';
    if (字段.条件分支 === undefined) 字段.条件分支 = 构建缺少状态禁用条件分支_V1(字段.状态, '禁用', '自身');
    return;
  } else if (原型 === '状态转移') {
    if (字段.状态 === undefined) 字段.状态 = String(source.状态 || '任意状态').trim() || '任意状态';
    if (字段.数量 === undefined) 字段.数量 = 规范化状态转移数量_V1(source.数量);
    const 来源 = String(source.来源 || '自身').trim() || '自身';
    const 去向 = String(source.去向 || '目标').trim() || '目标';
    if (字段.来源 === undefined) 字段.来源 = 状态转移端点有效_V1(来源) ? 来源 : '自身';
    if (字段.去向 === undefined) 字段.去向 = 状态转移端点有效_V1(去向) ? 去向 : '目标';
    return;
  } else if (原型 === '复制执行') {
    const 复制类型 = String(字段.复制类型 || source.复制类型 || '').trim();
    字段.复制类型 = SKILL_PROTOTYPE_FIELD_OPTIONS_V1.复制类型.includes(复制类型) ? 复制类型 : '复制技能';
    const 复制模式 = String(字段.复制模式 || source.复制模式 || '').trim();
    字段.复制模式 = SKILL_PROTOTYPE_FIELD_OPTIONS_V1.复制模式.includes(复制模式) ? 复制模式 : '即时镜像';
    if (!/属性|全部/.test(String(字段.复制类型 || ''))) delete 字段.削减比例;
    if (!['复制技能', '复制全部'].includes(String(字段.复制类型 || ''))) {
      delete 字段.保存上限;
      delete 字段.可用次数;
    }
    if (!/属性|全部/.test(String(字段.复制类型 || ''))) {
      delete 字段.驱动属性;
      delete 字段.影响方向;
    }
    if (字段.保留时长tick !== undefined) {
      const 保留时长tick = Math.max(0, Math.floor(Number(字段.保留时长tick || 0)));
      if (保留时长tick > 0) 字段.保留时长tick = 保留时长tick;
      else delete 字段.保留时长tick;
    }
    return;
  } else if (原型 === '资源锁定') {
    if (字段.资源 === undefined && source.资源 !== undefined) 字段.资源 = 转换原型资源字段_V1(String(source.资源).trim());
    if (字段.锁定类型 === undefined && source.锁定类型 !== undefined) 字段.锁定类型 = String(source.锁定类型).trim();
    if (字段.数值 === undefined && source.数值 !== undefined) 字段.数值 = 规范化资源锁定比例_V1(source.数值, 0.5);
    return;
  } else if (原型 === '召唤生成') {
    if (字段.召唤单位类型 === undefined) 字段.召唤单位类型 = String(source.召唤单位类型 || '魂兽').trim() || '魂兽';
    if (字段.召唤物名称 === undefined) 字段.召唤物名称 = String(source.召唤物名称 || source.实体名称 || '召唤物').trim() || '召唤物';
    const 原始数量 = Math.max(1, Math.round(Number(source.数量 || source.召唤数量 || source.repeatCount || 1)));
    if (字段.数量 === undefined) 字段.数量 = 召唤生成允许普通批量_V1(字段) || String(字段.召唤单位类型 || '').trim() === '分身' ? 原始数量 : 1;
    if (召唤生成允许继承属性比例_V1(字段) && 召唤生成使用继承属性比例_V1(字段)) {
      字段.继承属性比例 = 规范化召唤生成继承属性比例_V1(字段, 字段.召唤单位类型 === '分身' ? 0.45 : 0.35);
      delete 字段.强度;
    } else {
      delete 字段.继承属性比例;
      if (字段.强度 === undefined) 字段.强度 = Math.max(0.01, Number(source.强度 || source.召唤强度 || 1) * (字段.数量 === 1 ? 原始数量 : 1));
    }
    return;
  } else if (原型 === '修炼增益') {
    const 收益类型 = String(字段.收益类型 || source.收益类型 || '').trim() || '训练方式收益';
    字段.收益类型 = SKILL_PROTOTYPE_FIELD_OPTIONS_V1.收益类型.includes(收益类型) ? 收益类型 : '训练方式收益';
    if (字段.收益类型 === '属性修炼速度') {
      const 修炼属性 = 中文化技能机制参数值_V1(String(字段.修炼属性 || source.修炼属性 || '').trim());
      字段.修炼属性 = SKILL_PROTOTYPE_FIELD_OPTIONS_V1.修炼属性.includes(修炼属性) ? 修炼属性 : '魂力上限';
      delete 字段.训练方式;
    } else {
      const 训练方式 = String(字段.训练方式 || source.训练方式 || '').trim();
      字段.训练方式 = SKILL_PROTOTYPE_FIELD_OPTIONS_V1.训练方式.includes(训练方式) ? 训练方式 : '冥想';
      delete 字段.修炼属性;
    }
    raw = 取首个数值(['数值', '收益倍率']);
  }
  if (raw !== undefined) {
    字段.数值 = 原型 === '修炼增益'
      ? 格式化原型比例变化_V1(raw, 1, true)
      : 规范化执行效果数值_V1(raw);
  }
}

function 展开技能执行批量字段_V1(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  if (String(value.原型 || '').trim() === '属性修正') return [value];
  const 批量字段列表 = 技能执行批量字段键表_V1.filter(key => Array.isArray(value[key]) && value[key].some(item => String(item || '').trim()));
  if (!批量字段列表.length) return [value];
  const seed = cloneJsonValue(value);
  let entries = [seed];
  const expandTopLevel = key => {
    entries = entries.flatMap(entry => {
      const raw = entry && entry[key];
      if (!Array.isArray(raw)) return [entry];
      const list = raw.map(item => String(item || '').trim()).filter(Boolean);
      if (!list.length) return [entry];
      return list.map(item => ({ ...entry, [key]: item }));
    });
  };
  批量字段列表.forEach(expandTopLevel);
  return entries;
}

function 技能原型值需要默认驱动判定_V1(原型 = '', 字段 = {}) {
  if (!字段 || typeof 字段 !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(字段, '驱动属性')) return false;
  return 技能原型需要默认驱动判定_V1(原型, 字段);
}

function 选择技能原型默认影响方向_V1(原型 = '', 字段 = {}, fallback = '效果强度') {
  const 原型名 = String(原型 || '').trim();
  const 结算 = String(字段?.结算 || '').trim();
  const 调整字段 = String(字段?.调整字段 || '').trim();
  let 默认方向 = fallback;
  if (原型名 === '位移执行') 默认方向 = '效果强度';
  else if (原型名 === '状态施加') 默认方向 = '效果强度';
  else if (原型名 === '复制执行') 默认方向 = '效果强度';
  else if (['判定修正', '状态移除', '决策干扰', '机制抹消', '资源锁定', '规则改写'].includes(原型名)) 默认方向 = '成功率';
  else if (原型名 === '时光回溯') 默认方向 = '成功率';
  else if (原型名 === '结算修正' && 结算 === '消耗分摊') 默认方向 = '效果强度';
  else if (原型名 === '结算修正' && 结算 === '消耗') 默认方向 = '消耗';
  else if (原型名 === '结算修正' && 结算 === '前摇') 默认方向 = '前摇';
  else if (原型名 === '时窗修正') 默认方向 = ['持续回合', '有效期tick'].includes(调整字段) ? '持续时间' : '效果强度';
  else 默认方向 = '效果强度';
  const 选项列表 = 读取原型字段选项_V1(原型名, '影响方向');
  return 选项列表.includes(默认方向) ? 默认方向 : 选项列表[0] || fallback;
}

function 选择技能原型默认驱动属性_V1(原型 = '', 字段 = {}) {
  const 原型名 = String(原型 || '').trim();
  const 状态名 = String(字段?.状态 || '').trim();
  if (原型名 === '时光回溯' || 原型名 === '状态移除') return '精神力上限';
  if (原型名 === '复制执行') return '精神力上限';
  if (原型名 === '状态施加') return 状态施加默认驱动属性表_V1[状态名] || '魂力上限';
  return '魂力上限';
}

function 补齐非固定数值默认驱动判定_V1(原型 = '', 字段 = {}) {
  if (!技能原型值需要默认驱动判定_V1(原型, 字段)) return;
  字段.驱动属性 = 选择技能原型默认驱动属性_V1(原型, 字段);
  字段.影响方向 = 选择技能原型默认影响方向_V1(原型, 字段, '效果强度');
}

function 收口技能效果影响方向_V1(原型 = '', 字段 = {}) {
  if (!字段 || typeof 字段 !== 'object') return;
  if (!String(字段.影响方向 || '').trim()) return;
  const 原型名 = String(原型 || '').trim();
  let 可选 = 原型名 === '时光回溯'
    ? 读取时光回溯影响方向选项_V1(字段)
    : 原型名 === '时窗修正'
      ? 读取时窗修正影响方向选项_V1(字段)
    : 读取原型字段选项_V1(原型名, '影响方向');
  if (原型名 === '状态施加' && !(Number(字段.持续回合 || 0) > 0)) 可选 = 可选.filter(方向 => 方向 !== '持续时间');
  if (!可选.length) {
    delete 字段.影响方向;
    return;
  }
  if (!可选.includes(String(字段.影响方向 || '').trim())) 字段.影响方向 = 选择技能原型默认影响方向_V1(原型名, 字段, 可选[0]);
  if (String(字段.影响方向 || '').trim() === '成功率' && !String(字段.驱动属性 || '').trim()) 字段.驱动属性 = '精神力上限';
}

var 持续伤害状态集合_V1 = new Set(状态施加状态分类矩阵_V1.持续伤害类);
var 机制授予禁止授予原型集合_V1 = new Set(['伤害结算', '机制授予', '修炼增益']);
var 机制授予允许授予原型集合_V1 = new Set(
  Object.keys(SKILL_PROTOTYPE_REGISTRY_V1 || {}).filter(原型 => !机制授予禁止授予原型集合_V1.has(String(原型 || '').trim())),
);

function 读取时光回溯影响方向选项_V1(effect = {}) {
  return String(effect?.发动方式 || '被动').trim() === '主动'
    ? ['成功率', '效果强度']
    : ['成功率'];
}

function 读取时窗修正影响方向选项_V1(effect = {}) {
  const 调整字段 = String(effect?.调整字段 || '持续回合').trim();
  return ['持续回合', '有效期tick'].includes(调整字段)
    ? ['持续时间', '消耗', '前摇']
    : ['效果强度', '消耗', '前摇'];
}

function 归一化时光回溯目标_V1(value = '', fallback = '单体') {
  const 文本 = String(value || '').trim();
  const 回退 = ['单体', '群体', '全场'].includes(String(fallback || '').trim()) ? String(fallback || '').trim() : '单体';
  if (文本 === '全场') return '全场';
  if (文本 === '群体') return '群体';
  if (文本 === '单体' || 文本 === '目标' || 文本 === '双方') return '单体';
  return 回退;
}

function 技能组合器效果含结构化持续伤害_V1(effect = {}) {
  return String(effect?.原型 || '').trim() === '状态施加' && 持续伤害状态集合_V1.has(String(effect?.状态 || '').trim());
}

function 读取技能组合器DOT前置状态列表_V1(effect = {}) {
  const 状态列表 = [];
  (Array.isArray(effect?.条件分支) ? effect.条件分支 : []).forEach(分支 => {
    (Array.isArray(分支?.条件) ? 分支.条件 : []).forEach(条件 => {
      if (String(条件?.类型 || '').trim() !== '状态存在') return;
      const 状态 = String(条件?.状态 || 条件?.值 || '').trim();
      if (状态 && 持续伤害状态集合_V1.has(状态)) 状态列表.push(状态);
    });
  });
  return 状态列表;
}

function 技能组合器效果含指定状态前置_V1(effect = {}, 状态 = '') {
  const 目标状态 = String(状态 || '').trim();
  if (!目标状态) return false;
  return (Array.isArray(effect?.条件分支) ? effect.条件分支 : []).some(分支 =>
    (Array.isArray(分支?.条件) ? 分支.条件 : []).some(条件 =>
      String(条件?.类型 || '').trim() === '状态存在' &&
      [条件?.状态, 条件?.值].some(值 => String(值 || '').trim() === 目标状态),
    ),
  );
}

function 技能组合器效果含自身状态前置_V1(effect = {}, 状态 = '') {
  const 目标状态 = String(状态 || '').trim();
  if (!目标状态) return false;
  return (Array.isArray(effect?.条件分支) ? effect.条件分支 : []).some(分支 =>
    (Array.isArray(分支?.条件) ? 分支.条件 : []).some(条件 =>
      String(条件?.类型 || '').trim() === '状态存在' &&
      String(条件?.对象 || '').trim() === '自身' &&
      String(条件?.比较 || '').trim() === '无' &&
      [条件?.状态, 条件?.值].some(值 => String(值 || '').trim() === 目标状态),
    ),
  );
}

function 推断位移执行对象_V1(字段 = {}) {
  const 位移类型 = String(字段?.位移类型 || '').trim();
  const 目标 = String(字段?.目标 || '').trim();
  const 显式对象 = String(字段?.位移对象 || '').trim();
  if (['自身', '目标', '自身与目标'].includes(显式对象)) return 显式对象;
  if (位移类型 === '换位') return '自身与目标';
  if (['瞬移', '脱离'].includes(位移类型)) return '自身';
  if (目标 === '自身' || 目标 === '友方') return '自身';
  if (位移类型 === '拉近') return '自身';
  return '目标';
}

function 位移执行对象包含目标_V1(位移对象 = '') {
  return ['目标', '自身与目标'].includes(String(位移对象 || '').trim());
}

function 位移执行目标需要判定_V1(字段 = {}) {
  const 目标 = String(字段?.目标 || '').trim();
  if (['自身', '召唤物', '分身'].includes(目标)) return false;
  return 位移执行对象包含目标_V1(字段?.位移对象);
}

function 是造物承载效果数组_V1(effectArray = []) {
  return Array.isArray(effectArray) && effectArray.some(effect =>
    effect &&
    typeof effect === 'object' &&
    !Array.isArray(effect) &&
    !String(effect.原型 || '').trim() &&
    Array.isArray(effect.使用效果),
  );
}

function 清理执行效果原型语义_V1(原型 = '', 字段 = {}, 上下文 = {}) {
  if (!字段 || typeof 字段 !== 'object') return;
  delete 字段.事件优先级;
  delete 字段.快照规则;
  const 枚举默认即删除 = (字段名, 默认值 = '无') => {
    if (String(字段[字段名] || '').trim() === 默认值) delete 字段[字段名];
  };
  delete 字段.打断类型;
  delete 字段.中断概率;
  if (字段.触发限制 && typeof 字段.触发限制 === 'object' && !Array.isArray(字段.触发限制)) {
    字段.触发限制 = {
      周期: String(字段.触发限制.周期 || '主动使用').trim() || '主动使用',
      次数: Math.max(1, Math.round(Number(字段.触发限制.次数 || 1))),
    };
  }
  if (原型 === '规则防御') {
    delete 字段.驱动属性;
    delete 字段.影响方向;
  }
  if (原型 === '判定修正') {
    清理判定修正打断效果_V1(字段);
  }
  if (原型 === '状态交换') {
    字段.目标 = '单体';
    if (!String(字段.状态 || '').trim()) 字段.状态 = '任意负面';
    if (字段.条件分支 === undefined) 字段.条件分支 = 构建缺少状态禁用条件分支_V1(字段.状态, '禁用', '自身');
  }
  if (原型 === '状态转移') {
    字段.目标 = '单体';
  }
  if (原型 === '状态移除') {
    const 数量 = String(字段.数量 || '').trim();
    if (数量) 字段.数量 = 数量 === '全部' ? '全部' : Math.max(1, Math.min(3, Math.round(Number(数量) || 1)));
    const 匹配原型 = String(字段.匹配原型 || '').trim();
    if (!['资源变化', '护盾变化'].includes(匹配原型)) {
      delete 字段.匹配原型;
      delete 字段.资源;
      delete 字段.数值方向;
    } else if (匹配原型 === '资源变化') {
      字段.资源 = '生命';
      const 数值方向 = String(字段.数值方向 || '任意').trim();
      字段.数值方向 = ['负向', '正向', '任意'].includes(数值方向) ? 数值方向 : '任意';
    } else {
      delete 字段.资源;
      delete 字段.数值方向;
    }
  }
  if (原型 === '规则改写') {
    字段.规则 = SKILL_PROTOTYPE_FIELD_OPTIONS_V1.规则.includes(String(字段.规则 || '').trim()) ? String(字段.规则 || '').trim() : '缴械';
    if (字段.规则 === '死亡转存活') {
      字段.目标 = '自身';
      delete 字段.持续回合;
      delete 字段.死亡时限tick;
      delete 字段.复活代价类型;
      delete 字段.复活代价对象;
      delete 字段.复活代价值;
      delete 字段.复活代价时限tick;
      delete 字段.复活后状态;
      delete 字段.复活后状态时限tick;
      字段.数值 = String(字段.数值 || '+25%').trim() || '+25%';
    } else {
      字段.持续回合 = Math.max(1, Math.min(10, Math.round(Number(字段.持续回合 || 1))));
      delete 字段.数值;
      delete 字段.死亡时限tick;
      delete 字段.复活代价类型;
      delete 字段.复活代价对象;
      delete 字段.复活代价值;
      delete 字段.复活代价时限tick;
      delete 字段.复活后状态;
      delete 字段.复活后状态时限tick;
    }
  }
  if (['规则防御', '状态移除', '状态转移', '状态交换'].includes(原型) && 字段.持续回合 !== undefined) {
    const 持续回合 = Math.max(0, Math.min(10, Math.round(Number(字段.持续回合 || 0))));
    if (持续回合 > 0) 字段.持续回合 = 持续回合;
    else delete 字段.持续回合;
  }
  if (技能原型允许延迟回合_V1(原型) && 字段.延迟回合 !== undefined) {
    const 延迟回合 = Math.max(0, Math.round(Number(字段.延迟回合 || 0)));
    if (延迟回合 > 0) 字段.延迟回合 = 延迟回合;
    else delete 字段.延迟回合;
  }
  if (原型 === '时窗修正') {
    const 调整字段 = SKILL_PROTOTYPE_FIELD_OPTIONS_V1.调整字段.includes(String(字段.调整字段 || '').trim())
      ? String(字段.调整字段 || '').trim()
      : '持续回合';
    字段.调整字段 = 调整字段;
    字段.单日使用次数上限 = Math.max(1, Math.min(3, Math.round(Number(字段.单日使用次数上限 || 1))));
    if (调整字段 === '持续回合') {
      字段.调整回合 = Math.max(1, Math.min(3, Math.round(Number(字段.调整回合 || 字段.持续回合 || 1))));
      delete 字段.状态;
      delete 字段.调整tick;
      delete 字段.调整次数;
      delete 字段.造物名称;
      if (String(字段.调整方式 || '').trim() !== '压缩') delete 字段.结算倍率;
      else 字段.结算倍率 = String(字段.结算倍率 || '').trim() || '+100%';
    } else if (调整字段 === '有效期tick') {
      字段.调整tick = Math.max(1, Math.min(1008, Math.round(Number(字段.调整tick || 字段.有效期tick || 6))));
      delete 字段.状态;
      delete 字段.调整回合;
      delete 字段.调整次数;
      delete 字段.造物名称;
      delete 字段.结算倍率;
    } else {
      字段.调整次数 = Math.max(1, Math.min(3, Math.round(Number(字段.调整次数 || 字段.调整回合 || 1))));
      delete 字段.状态;
      delete 字段.调整回合;
      delete 字段.调整tick;
      delete 字段.造物名称;
      delete 字段.结算倍率;
    }
  }
  if (原型 === '位移执行') {
    归一化技能原型字段同义值_V1(原型, 字段);
    delete 字段.方位;
    delete 字段.数量;
    字段.距离 = Math.max(1, Math.min(30, Number(字段.距离 || 1)));
    字段.持续回合 = Math.max(1, Math.min(10, Math.round(Number(字段.持续回合 || 1))));
    if (字段.数值 !== undefined) {
      const 数值文本 = String(字段.数值 ?? '').trim();
      if (技能原型字段值是百分比修正_V1(数值文本)) 字段.数值 = formatSkillSignedChangeValue(parseSkillSignedChangeNumber(数值文本), true);
      else delete 字段.数值;
    }
    if (String(字段.目标 || '').trim() === '自身' && String(字段.位移类型 || '').trim() === '换位') 字段.位移类型 = '瞬移';
    字段.位移对象 = 推断位移执行对象_V1(字段);
    if (String(字段.目标 || '').trim() === '自身') 字段.位移对象 = '自身';
    if (位移执行目标需要判定_V1(字段)) {
      if (!String(字段.驱动属性 || '').trim()) 字段.驱动属性 = '魂力上限';
      if (!String(字段.影响方向 || '').trim()) 字段.影响方向 = '效果强度';
    } else {
      if (String(字段.影响方向 || '').trim() === '成功率' && !技能原型值需要默认驱动判定_V1(原型, 字段)) {
        delete 字段.驱动属性;
        delete 字段.影响方向;
      }
    }
    return;
  }
  if (原型 === '伤害结算') {
    ['每段倍率', '段间隔', '范围半径', '目标数量上限', '装备条件', '姿态条件', '连招条件', '动作时窗', '中断条件', '主驱动资源', '触发限制', '延迟回合'].forEach(字段名 => {
      delete 字段[字段名];
    });
    delete 字段.驱动属性;
    delete 字段.影响方向;
    if (!['单体', '群体', '全场'].includes(String(字段.目标 || '').trim())) {
      delete 字段.目标;
    }
    字段.攻击段数 = Math.max(1, Math.round(Number(字段.攻击段数 || 1)));
    字段.威力倍率 = Math.max(1, Number(字段.威力倍率 || 100));
    if (字段.对应等级 !== undefined) {
      const 对应等级 = Math.round(Number(字段.对应等级 || 0));
      if (Number.isFinite(对应等级) && 对应等级 > 0) 字段.对应等级 = Math.max(1, Math.min(180, 对应等级));
      else delete 字段.对应等级;
    }
    const 伤害类型 = String(字段.伤害类型 || '近身攻击').trim();
    字段.伤害类型 = SKILL_PROTOTYPE_FIELD_OPTIONS_V1.伤害类型.includes(伤害类型) ? 伤害类型 : '近身攻击';
    if (字段.伤害类型 === '真实攻击') {
      字段.结算标签 = '真实伤害';
      字段.抗性类型 = '真实无视';
    } else {
      字段.结算标签 = '标准伤害';
      字段.抗性类型 = 字段.伤害类型 === '精神攻击' ? '精神抗性' : 字段.伤害类型 === '远程攻击' ? '元素抗性' : '物理抗性';
    }
  }
  if (原型 === '护盾变化') {
    if (!['正向护盾', '斩盾', '窃盾'].includes(String(字段.护盾模式 || '').trim())) 字段.护盾模式 = parseSkillSignedChangeNumber(字段.数值) < 0 ? '斩盾' : '正向护盾';
    const 符号数值 = Math.abs(parseSkillSignedChangeNumber(字段.数值));
    字段.数值 = formatSkillSignedChangeValue((字段.护盾模式 === '正向护盾' ? 1 : -1) * 符号数值, 技能原型字段值是百分比修正_V1(字段.数值));
    ['斩盾倍率', '窃盾比例', 'shield_break_ratio', 'shield_steal_ratio'].forEach(字段名 => {
      if (字段[字段名] !== undefined) throw new Error(`技能执行结构错误:${上下文?.path || '_效果数组'}[${上下文?.index || 0}]护盾变化不允许${字段名}`);
    });
  }
  if (原型 === '资源变化') {
    delete 字段.持续tick;
    delete 字段.主驱动资源;
    delete 字段.结算标签;
    delete 字段.资源转移方式;
    delete 字段.转化比例;
    if (String(字段.资源 || '').trim() === '生命' && parseSkillSignedChangeNumber(字段.数值) < 0) {
      throw new Error(`技能执行结构错误:${上下文?.path || '_效果数组'}[${上下文?.index || 0}]资源变化生命不允许负数，请使用伤害结算`);
    }
    if (字段.持续回合 !== undefined) {
      const 持续回合 = Math.max(0, Math.min(10, Math.round(Number(字段.持续回合 || 0))));
      if (持续回合 > 0) 字段.持续回合 = 持续回合;
      else delete 字段.持续回合;
    }
  }
  if (原型 === '资源转移') {
    if (字段.资源转移角色 !== undefined) throw new Error(`技能执行结构错误:${上下文?.path || '_效果数组'}[${上下文?.index || 0}]资源转移角色已删除`);
    delete 字段.持续tick;
    delete 字段.主驱动资源;
    delete 字段.结算标签;
    if (字段.持续回合 !== undefined) {
      const 持续回合 = Math.max(0, Math.min(10, Math.round(Number(字段.持续回合 || 0))));
      if (持续回合 > 0) 字段.持续回合 = 持续回合;
      else delete 字段.持续回合;
    }
    const 资源转移方式 = String(字段.资源转移方式 || '').trim();
    if (!SKILL_PROTOTYPE_FIELD_OPTIONS_V1.资源转移方式.includes(资源转移方式)) {
      throw new Error(`技能执行结构错误:${上下文?.path || '_效果数组'}[${上下文?.index || 0}]资源转移方式无效`);
    }
    if (字段.资源转移方式 === '均分') {
      delete 字段.转化比例;
    } else {
      const 转化比例 = Number(字段.转化比例 ?? 1);
      if (!Number.isFinite(转化比例) || 转化比例 < 0 || 转化比例 > 2) throw new Error(`资源转移转化比例必须在0到2之间`);
      字段.转化比例 = 转化比例;
    }
    字段.数值 = 格式化技能资源转移数值方向_V1(字段.数值, 字段.资源转移方式);
  }
  if (原型 === '属性修正') {
    归一化技能原型字段同义值_V1(原型, 字段);
    const 合法属性 = SKILL_PROTOTYPE_FIELD_OPTIONS_V1.属性;
    if (Array.isArray(字段.属性)) {
      const 属性列表 = 字段.属性.map(item => String(item || '').trim()).filter(item => 合法属性.includes(item));
      字段.属性 = 属性列表.length > 1 ? Array.from(new Set(属性列表)) : 属性列表[0] || '力量';
    } else {
      const 属性 = String(字段.属性 || '').trim();
      字段.属性 = 合法属性.includes(属性) ? 属性 : '力量';
    }
    if (字段.数值 !== undefined) {
      字段.数值 = formatSkillSignedChangeValue(parseSkillSignedChangeNumber(字段.数值), true);
      字段.数值 = 收口正式百分比最低值_V1(字段.数值, 5);
    }
  }
  if (原型 === '结算修正') {
    归一化技能原型字段同义值_V1(原型, 字段);
    const 合法结算 = 读取原型字段选项_V1('结算修正', '结算');
    const 结算 = String(字段.结算 || '').trim();
    字段.结算 = 合法结算.includes(结算) ? 结算 : '';
    字段.目标 = 约束结算修正目标_V1(字段.结算, 字段.目标);
    if (字段.数值 !== undefined) 字段.数值 = formatSkillSignedChangeValue(parseSkillSignedChangeNumber(字段.数值), !['消耗', '前摇'].includes(字段.结算) || 技能原型字段值是百分比修正_V1(字段.数值));
    const 支持字段 = 读取结算修正支持字段_V1(字段.结算);
    if (支持字段) {
      Object.keys(字段).forEach(字段名 => {
        if (!支持字段.includes(字段名)) delete 字段[字段名];
      });
    }
    if (['伤害分摊', '消耗分摊'].includes(字段.结算)) {
      if (String(字段.目标 || '').trim() === '群体') 字段.数量 = Math.max(1, Math.round(Number(字段.数量 || 1)));
      else delete 字段.数量;
    }
    if (字段.限定元素 !== undefined) {
      const 限定元素列表 = 读取技能限定元素字段列表_V1(字段.限定元素);
      if (限定元素列表.length) {
        字段.限定元素 = 限定元素列表.length > 1 ? 限定元素列表 : 限定元素列表[0];
      } else {
        delete 字段.限定元素;
      }
    }
    if (字段.结算 === '持续伤害引爆' && 字段.条件分支 === undefined) 字段.条件分支 = 构建缺少状态禁用条件分支_V1('持续创伤');
    if (字段.结算 === '技能效果' && 字段.条件分支 === undefined && 字段.限定元素 === undefined) {
      字段.条件分支 = [{ 条件: [{ 类型: '当前行动', 对象: '自身', 比较: '!=', 值: '常规攻击' }], 处理: '生效' }];
    }
    if (字段.结算 === '伤害吸收') {
      字段.吸收来源 = SKILL_PROTOTYPE_FIELD_OPTIONS_V1.吸收来源.includes(String(字段.吸收来源 || '').trim())
        ? String(字段.吸收来源 || '').trim()
        : '造成伤害';
      字段.吸收资源 = SKILL_PROTOTYPE_FIELD_OPTIONS_V1.吸收资源.includes(String(字段.吸收资源 || '').trim())
        ? String(字段.吸收资源 || '').trim()
        : '生命';
    }
  }
  if (原型 === '炸环') {
    字段.目标 = '自身';
    const 强化倍率 = Math.max(0.01, parseSkillSignedChangeNumber(字段.强化倍率 || '+100%'));
    字段.强化倍率 = formatSkillSignedChangeValue(强化倍率, true);
  }
  if (原型 === '护盾变化' && typeof 字段.数值 === 'string' && /^-\d+(?:\.\d+)?%$/.test(字段.数值.trim())) {
    const 数值 = Math.abs(Number(字段.数值.replace('%', '')));
    if (Number.isFinite(数值) && 数值 > 100) 字段.数值 = '-100%';
  }
  if (原型 === '护盾变化') {
    if (!['正向护盾', '斩盾', '窃盾'].includes(String(字段.护盾模式 || '').trim())) 字段.护盾模式 = parseSkillSignedChangeNumber(字段.数值) < 0 ? '斩盾' : '正向护盾';
    const 符号数值 = Math.abs(parseSkillSignedChangeNumber(字段.数值));
    字段.数值 = formatSkillSignedChangeValue((字段.护盾模式 === '正向护盾' ? 1 : -1) * 符号数值, 技能原型字段值是百分比修正_V1(字段.数值));
    if (字段.护盾模式 !== '正向护盾') {
      delete 字段.持续回合;
    }
  }
  if (原型 === '召唤生成') {
    归一化技能原型字段同义值_V1(原型, 字段);
    字段.召唤单位类型 = String(字段.召唤单位类型 || '魂兽').trim() || '魂兽';
    if (!SKILL_PROTOTYPE_FIELD_OPTIONS_V1.召唤单位类型.includes(字段.召唤单位类型)) 字段.召唤单位类型 = '魂兽';
    字段.目标 = '自身';
    字段.数量 = Math.max(1, Math.round(Number(字段.数量 || 1)));
    const 默认行动模式 = ['魂师', '魂兽', '本命召唤兽', '深渊生物'].includes(字段.召唤单位类型) ? '自主行动' : '协同攻击';
    if (!SKILL_PROTOTYPE_FIELD_OPTIONS_V1.行动模式.includes(String(字段.行动模式 || '').trim())) 字段.行动模式 = 默认行动模式;
    if (字段.召唤单位类型 === '分身' || 字段.召唤单位类型 === '本命召唤兽') {
      delete 字段.强度;
      字段.继承属性比例 = 规范化召唤生成继承属性比例_V1(字段, 0.45);
    } else {
      delete 字段.继承属性比例;
      字段.强度 = Math.max(0.01, Number(字段.强度 || 1));
    }
    if (String(字段.行动模式 || '').trim() === '护卫') {
      if (!['可承伤', '护卫承伤', '分摊承伤'].includes(String(字段.承伤规则 || '').trim())) 字段.承伤规则 = '护卫承伤';
    } else delete 字段.承伤规则;
    return;
  }
  if (原型 === '修炼增益') {
    const 收益类型 = String(字段.收益类型 || '').trim();
    字段.收益类型 = SKILL_PROTOTYPE_FIELD_OPTIONS_V1.收益类型.includes(收益类型) ? 收益类型 : '训练方式收益';
    if (字段.收益类型 === '属性修炼速度') {
      const 修炼属性 = String(字段.修炼属性 || '').trim();
      字段.修炼属性 = SKILL_PROTOTYPE_FIELD_OPTIONS_V1.修炼属性.includes(修炼属性) ? 修炼属性 : '魂力上限';
      delete 字段.训练方式;
    } else {
      const 训练方式 = String(字段.训练方式 || '').trim();
      字段.训练方式 = SKILL_PROTOTYPE_FIELD_OPTIONS_V1.训练方式.includes(训练方式) ? 训练方式 : '冥想';
      delete 字段.修炼属性;
    }
    return;
  }
  if (原型 !== '状态施加') return;
  const 状态名 = String(字段.状态 || '').trim();
  if (!SKILL_PROTOTYPE_FIELD_OPTIONS_V1.触发方式.includes(String(字段.触发方式 || '').trim())) 字段.触发方式 = '立即触发';
  if (字段.触发方式 === '延迟触发' && !(Number(字段.延迟回合 || 0) > 0)) 字段.延迟回合 = 1;
  if (字段.触发方式 !== '延迟触发') delete 字段.延迟回合;
  if (['任意负面', '任意增益', '任意状态'].includes(状态名)) 字段.状态 = '眩晕';
  if (
    String(字段.状态 || '').trim() &&
    (!SKILL_PROTOTYPE_FIELD_OPTIONS_V1.状态.includes(String(字段.状态 || '').trim()) || String(字段.状态 || '').trim() === '标记')
  ) {
    if (!SKILL_PROTOTYPE_FIELD_OPTIONS_V1.状态.includes(String(字段.状态 || '').trim())) 字段.状态 = '标记';
  }
  const 正式状态名 = String(字段.状态 || '').trim();
  const 目标 = String(字段.目标 || '').trim();
  if (!(Number(字段.持续回合 || 0) > 0)) 字段.持续回合 = 3;
  if (状态施加允许数值字段_V1(正式状态名) && 字段.数值 === undefined) 字段.数值 = 读取状态施加默认数值_V1(正式状态名);
  if (状态施加允许副数值字段_V1(正式状态名) && 字段.副数值 === undefined) 字段.副数值 = 读取状态施加默认副数值_V1(正式状态名);
  if (['禁疗', '治疗反转'].includes(正式状态名) && 字段.数值 !== undefined) {
    字段.数值 = formatSkillSignedChangeValue(
      Math.abs(parseSkillSignedChangeNumber(字段.数值)),
      技能原型字段值是百分比修正_V1(字段.数值),
    );
  }
  if (状态施加使用正向强度数值_V1(正式状态名) && 字段.数值 !== undefined) {
    字段.数值 = formatSkillSignedChangeValue(
      Math.abs(parseSkillSignedChangeNumber(字段.数值)),
      技能原型字段值是百分比修正_V1(字段.数值),
    );
  }
  delete 字段.打断效果;
  if (!状态施加允许数值字段_V1(正式状态名)) delete 字段.数值;
  if (!状态施加允许副数值字段_V1(正式状态名)) delete 字段.副数值;
  if (字段.数值 !== undefined) 字段.数值 = 格式化状态施加比例字段_V1(字段.数值, 读取状态施加默认数值_V1(正式状态名));
  if (字段.副数值 !== undefined) 字段.副数值 = 格式化状态施加比例字段_V1(字段.副数值, 读取状态施加默认副数值_V1(正式状态名));
  if (字段.数值 !== undefined) 字段.数值 = 限制状态施加比例字段_V1(正式状态名, '数值', 字段.数值);
  if (字段.副数值 !== undefined) 字段.副数值 = 限制状态施加比例字段_V1(正式状态名, '副数值', 字段.副数值);
  if (状态施加应清理驱动字段_V1(正式状态名, 目标)) {
    delete 字段.驱动属性;
    delete 字段.影响方向;
  }
  if (!状态施加允许触发限制_V1(正式状态名, 目标)) delete 字段.触发限制;
  delete 字段.概率;
}

function 清理判定修正打断效果_V1(字段 = {}) {
  if (!字段 || typeof 字段 !== 'object') return;
  delete 字段.打断类型;
  delete 字段.中断概率;
  if (Number(字段.持续回合 || 0) > 0) {
    delete 字段.打断效果;
    return;
  }
  if (!Object.prototype.hasOwnProperty.call(字段, '打断效果')) {
    if (判定修正默认开启打断效果_V1(字段)) 字段.打断效果 = true;
    return;
  }
  if (!判定修正默认开启打断效果_V1(字段)) {
    delete 字段.打断效果;
    return;
  }
  字段.打断效果 = !!字段.打断效果;
}

var 精神系默认驱动原型集合_V1 = new Set([
  '状态移除',
  '状态施加',
  '状态转移',
  '状态交换',
  '时窗修正',
  '判定修正',
  '决策干扰',
  '机制抹消',
  '资源锁定',
  '规则改写',
]);

function 应用生成魂技系别驱动属性_V1(效果数组 = [], 系别 = '') {
  if (String(系别 || '').trim() !== '精神系') return;
  const 处理 = 效果 => {
    if (!效果 || typeof 效果 !== 'object' || Array.isArray(效果)) return;
    if (
      精神系默认驱动原型集合_V1.has(String(效果.原型 || '').trim()) &&
      String(效果.驱动属性 || '').trim() === '魂力上限'
    ) {
      效果.驱动属性 = '精神力上限';
    }
    技能执行嵌套效果数组字段表_V1.forEach(键 => {
      if (Array.isArray(效果[键])) 效果[键].forEach(处理);
    });
    if (Array.isArray(效果.条件分支)) {
      效果.条件分支.forEach(分支 => {
        技能条件分支效果数组字段表_V1.forEach(键 => {
          if (Array.isArray(分支?.[键])) 分支[键].forEach(处理);
        });
      });
    }
  };
  (Array.isArray(效果数组) ? 效果数组 : []).forEach(处理);
}

function 收口原型效果条目_V1(value = {}, fallbackTargetKind = '单体', recordViolation = () => {}, forcedPrototype = '', 上下文 = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const 来自机制模板 = forcedPrototype && typeof forcedPrototype === 'object' && !Array.isArray(forcedPrototype);
  const 强制条目 = forcedPrototype && typeof forcedPrototype === 'object' && !Array.isArray(forcedPrototype)
    ? forcedPrototype
    : { 原型: forcedPrototype };
  const 原型 = String(强制条目.原型 || value.原型 || '').trim();
  const 原型定义 = SKILL_PROTOTYPE_REGISTRY_V1[原型];
  if (!原型 || !原型定义) return null;
  const 允许字段集合 = new Set(Array.isArray(原型定义.允许字段) ? 原型定义.允许字段 : SKILL_PROTOTYPE_COMMON_FIELDS_V1);
  if (原型 === '结算修正') {
    const 结算字段列表 = 结算修正支持字段矩阵_V1[String(value.结算 || '').trim()];
    if (结算字段列表) 结算字段列表.forEach(字段名 => 允许字段集合.add(字段名));
  }
  Object.keys(value).forEach(key => {
    if (技能执行黑名单键集合_V1.has(key) || 技能执行原型禁用字段集合_V1.has(key)) recordViolation(`${原型}.${key}`);
  });
  const 旧独立条件字段 = ['环境条件', '装备条件', '姿态条件', '连招条件', '动作时窗', '中断条件'].find(字段名 => value[字段名] !== undefined);
  if (旧独立条件字段) recordViolation(`${原型}.${旧独立条件字段}.已删除`);
  const 原始目标 = String(value.目标 || '').trim();
  const 目标 = 约束技能原型正式目标_V1(
    原型,
    归一化执行效果作用目标_V1(原始目标 || fallbackTargetKind, 归一化执行效果作用目标_V1(fallbackTargetKind, '单体')),
    { ...上下文, 默认目标: fallbackTargetKind },
  );
  const 持续回合 = Math.max(0, Math.round(Number(value.持续回合 ?? 0)));
  const 持续tick = Math.max(0, Math.round(Number(value.持续tick ?? 0)));
  const 有效期tick = Math.max(0, Math.round(Number(value.有效期tick ?? 0)));
  const normalized = { 原型, 目标 };
  const 原型字段 = {};
  const 字段允许数组 = key =>
    技能执行批量字段键表_V1.includes(key) ||
    技能执行嵌套效果数组字段集合_V1.has(key) ||
    String(原型定义.字段定义?.[key]?.类型 || '').trim() === '多枚举';
  if (持续回合 > 0 && 允许字段集合.has('持续回合')) 原型字段.持续回合 = 持续回合;
  if (持续tick > 0 && 允许字段集合.has('持续tick')) 原型字段.持续tick = 持续tick;
  if (有效期tick > 0 && 允许字段集合.has('有效期tick')) 原型字段.有效期tick = 有效期tick;
  Object.entries(强制条目).forEach(([key, raw]) => {
    if (key === '原型' || key === '目标' || raw === undefined || raw === null) return;
    if (技能执行黑名单键集合_V1.has(key) || 技能执行原型禁用字段集合_V1.has(key)) {
      recordViolation(`${原型}.${key}`);
      return;
    }
    if (!允许字段集合.has(key)) return;
    if (Array.isArray(raw) && !字段允许数组(key)) {
      recordViolation(`${原型}.${key}.数组`);
      return;
    }
    原型字段[key] = 标准化原型字段值_V1(cloneJsonValue(raw));
  });
  Object.entries(value).forEach(([key, raw]) => {
    if (
      [
        '原型',
        '机制',
        '目标',
        '持续回合',
        '持续tick',
        '有效期tick',
        '条件分支',
        '表现语义',
        '推荐语义',
      ].includes(key)
    )
      return;
    if (技能执行黑名单键集合_V1.has(key) || 技能执行原型禁用字段集合_V1.has(key)) {
      recordViolation(`${原型}.${key}`);
      return;
    }
    if (raw === undefined) return;
    const 可见键名 = 技能机制可见键中文名映射_V1[key] || 技能机制属性键中文名映射_V1[key] || key;
    if (typeof raw === 'string' && !raw.trim()) {
      const 严格非空字段 = 原型 === '状态施加'
        ? ['触发概率', '资源', '限定探查者']
        : 原型 === '结算修正'
          ? ['资源', '限定资源', '转化效果']
          : 原型 === '伤害结算'
            ? ['触发消耗']
            : [];
      if (严格非空字段.includes(可见键名)) recordViolation(`${原型}.${可见键名}`);
      return;
    }
    if (原型 === '规则防御' && 可见键名 === '防御对象') {
      const 防御对象 = String(raw || '').trim();
      if (!String(原型字段.规则 || '').trim()) 原型字段.规则 = /致命|死亡|免死|锁血/.test(防御对象) ? '免死' : '免伤';
      return;
    }
    if (原型 === '规则防御' && 可见键名 === '强度') return;
    if (Array.isArray(raw) && !字段允许数组(可见键名)) {
      recordViolation(`${原型}.${可见键名}.数组`);
      return;
    }
    if (!允许字段集合.has(可见键名)) {
      if (!来自机制模板) recordViolation(`${原型}.${可见键名}`);
      return;
    }
    原型字段[可见键名] = 标准化原型字段值_V1(cloneJsonValue(raw));
  });
  if (原型字段.属性 !== undefined) 原型字段.属性 = 中文化技能机制参数值_V1(原型字段.属性);
  if (原型字段.驱动属性 !== undefined) 原型字段.驱动属性 = 中文化技能机制参数值_V1(原型字段.驱动属性);
  归一化技能原型字段同义值_V1(原型, 原型字段);
  if (原型 === '时光回溯') {
    normalized.目标 = 归一化时光回溯目标_V1(normalized.目标, '单体');
    原型字段.发动方式 = ['主动', '被动'].includes(String(原型字段.发动方式 || '').trim()) ? String(原型字段.发动方式 || '').trim() : '被动';
    if (!String(原型字段.驱动属性 || '').trim()) 原型字段.驱动属性 = '精神力上限';
    const 方向选项 = 读取时光回溯影响方向选项_V1(原型字段);
    if (!方向选项.includes(String(原型字段.影响方向 || '').trim())) 原型字段.影响方向 = '成功率';
  }
  if (原型字段.数值 !== undefined) 原型字段.数值 = 规范化执行效果数值_V1(原型字段.数值);
  if (原型字段.副数值 !== undefined) 原型字段.副数值 = 规范化执行效果数值_V1(原型字段.副数值);
  原型字段.原型 = 原型;
  收口正式绝对值字段最低值_V1(原型字段);
  delete 原型字段.原型;
  if (原型字段.结算倍率 !== undefined) 原型字段.结算倍率 = 规范化执行效果数值_V1(原型字段.结算倍率);
  if (原型字段.防御穿透 !== undefined) 原型字段.防御穿透 = Math.max(0, Math.min(100, Math.round(Number(原型字段.防御穿透) || 0)));
  if (!['独立生效', '跟随主原型'].includes(String(原型字段.生效方式 || '').trim())) 原型字段.生效方式 = '独立生效';
  if (原型字段.生效方式 === '跟随主原型' && String(原型字段.目标 || '').trim() === '自身') {
      delete 原型字段.驱动属性;
      delete 原型字段.影响方向;
    }
  if (原型字段.匹配原型 === '无') delete 原型字段.匹配原型;
  if (原型 === '状态移除') {
    const 匹配原型 = String(原型字段.匹配原型 || '').trim();
    if (匹配原型 === '资源变化') {
    } else if (原型字段.资源 !== undefined || 原型字段.数值方向 !== undefined) {
    }
    if (!['资源变化', '护盾变化'].includes(匹配原型)) {
      delete 原型字段.匹配原型;
      delete 原型字段.资源;
      delete 原型字段.数值方向;
    } else if (匹配原型 === '资源变化') {
      原型字段.资源 = '生命';
      const 数值方向 = String(原型字段.数值方向 || '任意').trim();
      原型字段.数值方向 = ['负向', '正向', '任意'].includes(数值方向) ? 数值方向 : '任意';
    } else {
      delete 原型字段.资源;
      delete 原型字段.数值方向;
    }
  } else {
    delete 原型字段.数值方向;
  }
  补足机制模板原型数值_V1(原型, 原型字段, value, 上下文);
  if (原型 === '资源锁定') 原型字段.数值 = 规范化资源锁定比例_V1(原型字段.数值, 0.5);
  if (原型 === '机制授予') {
    const 触发条件 = String(原型字段.触发条件 || value.触发条件 || '主动触发').trim();
    const 是下一魂技成功触发 = 触发条件 === '下次魂技成功释放';
    原型字段.触发条件 = 机制授予目标允许下次行动触发_V1(目标) && ['主动触发', '随下次行动触发', '下次魂技成功释放'].includes(触发条件) ? 触发条件 : '主动触发';
    if (原型字段.触发条件 === '随下次行动触发') {
      delete 原型字段.可用次数;
      delete 原型字段.持续回合;
    } else if (是下一魂技成功触发) {
      原型字段.可用次数 = Math.max(1, Math.round(Number(原型字段.可用次数 || value.可用次数 || value.useCount || 1)));
      delete 原型字段.持续回合;
    } else {
      原型字段.可用次数 = Math.max(1, Math.round(Number(原型字段.可用次数 || value.可用次数 || value.useCount || 1)));
      原型字段.持续回合 = Math.max(1, Math.round(Number(原型字段.持续回合 || value.持续回合 || value.duration || 1)));
    }
  }
  if (原型 === '机制抹消') {
    原型字段.抹消对象 = 规范化技能机制抹消对象_V1(原型字段.抹消对象);
  }
  原型字段.目标 = 约束技能原型正式目标_V1(原型, 目标, { ...上下文, 默认目标: fallbackTargetKind });
  if (原型 === '召唤生成' || 原型 === '位移执行') 清理执行效果原型语义_V1(原型, 原型字段, 上下文);
  补齐非固定数值默认驱动判定_V1(原型, 原型字段);
  清理执行效果原型语义_V1(原型, 原型字段, 上下文);
  收口技能效果影响方向_V1(原型, 原型字段);
  应用技能原型目标驱动契约_V1(原型, 原型字段);
  if (原型 === '状态施加') {
    if (原型字段.资源 !== undefined) {
      const 资源 = typeof 原型字段.资源 === 'string' ? 原型字段.资源.trim() : '';
      if (!技能正式资源选项_V1.includes(资源)) recordViolation(`${原型}.资源`);
      else 原型字段.资源 = 资源;
    }
    if (原型字段.触发概率 !== undefined && 解析技能触发概率_V1(原型字段.触发概率) === null) {
      recordViolation(`${原型}.触发概率`);
    }
    if (原型字段.限定探查者 !== undefined) {
      const 探查者 = typeof 原型字段.限定探查者 === 'string' ? 原型字段.限定探查者.trim() : '';
      if (!探查者) recordViolation(`${原型}.限定探查者`);
      else 原型字段.限定探查者 = 探查者;
    }
  }
  if (原型 === '结算修正') {
    ['资源', '限定资源'].forEach(字段名 => {
      if (原型字段[字段名] === undefined) return;
      const 资源 = typeof 原型字段[字段名] === 'string' ? 原型字段[字段名].trim() : '';
      if (!技能正式资源选项_V1.includes(资源)) recordViolation(`${原型}.${字段名}`);
      else 原型字段[字段名] = 资源;
    });
    if (原型字段.限定攻击类型 !== undefined) {
      const 攻击类型 = Array.isArray(原型字段.限定攻击类型)
        ? 原型字段.限定攻击类型.map(item => typeof item === 'string' ? item.trim() : '')
        : [];
      if (!攻击类型.length || 攻击类型.some(item => !技能限定攻击类型选项_V1.includes(item))) recordViolation(`${原型}.限定攻击类型`);
      else 原型字段.限定攻击类型 = Array.from(new Set(攻击类型));
    }
    if (原型字段.转化效果 !== undefined) {
      const 转化效果 = typeof 原型字段.转化效果 === 'string' ? 原型字段.转化效果.trim() : '';
      if (!['立即恢复', '下次造成伤害'].includes(转化效果)) recordViolation(`${原型}.转化效果`);
      else 原型字段.转化效果 = 转化效果;
    }
  }
  Object.entries(原型字段).forEach(([key, raw]) => {
    const 字段定义 = 原型定义.字段定义?.[key] || {};
    const 类型 = String(字段定义.类型 || '').trim();
    const 选项 = Array.isArray(字段定义.选项) ? 字段定义.选项 : [];
    if (!选项.length || !['枚举', '多枚举'].includes(类型)) return;
    if (Array.isArray(raw)) {
      const 合法列表 = raw.filter(item => 选项.includes(String(item || '').trim()));
      if (合法列表.length) 原型字段[key] = 合法列表;
      else delete 原型字段[key];
      return;
    }
    if (!选项.includes(String(raw || '').trim())) {
      delete 原型字段[key];
    }
  });
  技能执行嵌套效果数组字段表_V1.forEach(key => {
    const 嵌套源 = Array.isArray(value[key]) ? value[key] : [];
    if (!嵌套源.length) return;
    if (!允许字段集合.has(key)) {
      recordViolation(`${原型}.${key}`);
      return;
    }
    原型字段[key] = 嵌套源
      .flatMap(effect => 收口执行效果条目列表_V1(effect, 目标, recordViolation, { ...上下文, 嵌套字段: key, 父原型: 原型 }))
      .filter(Boolean);
  });
  if (上下文?.来自共享机制编译表 === true) {
    (Array.isArray(原型定义.必填字段) ? 原型定义.必填字段 : []).forEach(key => {
      const raw = 原型字段[key];
      if (
        (raw === undefined || raw === null || (typeof raw === 'string' && !raw.trim()) || (Array.isArray(raw) && !raw.length)) &&
        Object.prototype.hasOwnProperty.call(SKILL_PROTOTYPE_FIELD_DEFAULT_V1, key)
      ) {
        原型字段[key] = cloneJsonValue(SKILL_PROTOTYPE_FIELD_DEFAULT_V1[key]);
      }
    });
  }
  Object.assign(normalized, 原型字段);
  normalized.目标 = 约束技能原型正式目标_V1(
    原型,
    归一化执行效果作用目标_V1(normalized.目标, 目标),
    { ...上下文, 默认目标: fallbackTargetKind },
  );
  const 条件分支源 = Array.isArray(原型字段.条件分支) && 原型字段.条件分支.length
    ? 原型字段.条件分支
    : (Array.isArray(value.条件分支) ? value.条件分支 : []);
  delete 原型字段.条件分支;
  const 条件分支 = 收口执行条件分支列表_V1(条件分支源, recordViolation, { ...normalized, ...原型字段 });
  if (持续回合 > 0 && Object.prototype.hasOwnProperty.call(原型字段, '持续回合')) normalized.持续回合 = Math.max(1, Math.round(Number(原型字段.持续回合 || 持续回合)));
  if (持续tick > 0 && Object.prototype.hasOwnProperty.call(原型字段, '持续tick')) normalized.持续tick = 持续tick;
  if (有效期tick > 0 && Object.prototype.hasOwnProperty.call(原型字段, '有效期tick')) normalized.有效期tick = 有效期tick;
  if (条件分支.length > 0) normalized.条件分支 = 条件分支;
  清理执行效果原型语义_V1(原型, normalized, 上下文);
  应用技能原型目标驱动契约_V1(原型, normalized);
  normalized.目标 = 约束技能原型正式目标_V1(
    原型,
    归一化执行效果作用目标_V1(normalized.目标, 目标),
    { ...上下文, 默认目标: fallbackTargetKind },
  );
  return normalized;
}

function 收口执行效果条目列表_V1(value = {}, fallbackTargetKind = '单体', recordViolation = () => {}, 上下文 = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const 批量条目列表 = 展开技能执行批量字段_V1(value);
  if (批量条目列表.length !== 1 || 批量条目列表[0] !== value) {
    return 批量条目列表.flatMap(entry => 收口执行效果条目列表_V1(entry, fallbackTargetKind, recordViolation, 上下文));
  }
  const 显式原型 = String(value.原型 || '').trim();
  if (显式原型) {
    const normalized = 收口原型效果条目_V1(value, fallbackTargetKind, recordViolation, 显式原型, 上下文);
    return normalized ? [normalized] : [];
  }
  if (String(value.机制 || '').trim()) recordViolation('机制字段');
  return [];
}

function 收口执行效果条目_V1(value = {}, fallbackTargetKind = '单体', recordViolation = () => {}) {
  return 收口执行效果条目列表_V1(value, fallbackTargetKind, recordViolation)[0] || null;
}

function 收口技能执行效果数组_V1(effectArray = [], options = {}) {
  const source = Array.isArray(effectArray) ? effectArray : [];
  const path = String(options?.path || '技能效果').trim() || '技能效果';
  const recordViolation = violation => {
    throw new Error(`技能执行结构错误:${path}.${violation}`);
  };
  const fallbackTargetKind = 归一化执行效果作用目标_V1(options.目标 || '单体', '单体');
  const 上下文 = { ...options, 技能: options.技能 || options.skill || null };
  const effectList = source
    .flatMap(effect => 收口执行效果条目列表_V1(effect, fallbackTargetKind, recordViolation, 上下文))
    .filter(Boolean);
  return effectList;
}

function 技能执行效果数组存在匹配_V1(effectArray = [], predicate = () => false) {
  const visit = effect => {
    if (!effect || typeof effect !== 'object' || Array.isArray(effect)) return false;
    if (predicate(effect)) return true;
    if (Array.isArray(effect.条件分支)) {
      for (const 分支 of effect.条件分支) {
        if (技能条件分支效果数组字段表_V1.some(键 => Array.isArray(分支?.[键]) && 分支[键].some(visit))) return true;
      }
    }
    return 技能执行嵌套效果数组字段表_V1.some(键 => Array.isArray(effect[键]) && effect[键].some(visit));
  };
  return Array.isArray(effectArray) && effectArray.some(visit);
}

function 断言技能执行效果原型契约_V1(effectArray = [], path = '_效果数组', 上下文 = {}) {
  if (!Array.isArray(effectArray)) return;
  const 主目标 = String(effectArray[0]?.目标 || '').trim();
  const 根技能 = 上下文?.技能 && typeof 上下文.技能 === 'object' ? 上下文.技能 : { _效果数组: effectArray };
  const 结构化DOT存在 = 技能执行效果数组存在匹配_V1(effectArray, effect => String(effect?.原型 || '').trim() === '状态施加' && 技能组合器效果含结构化持续伤害_V1(effect));
  const 是顶层路径 = path === '_效果数组';
  const 标记消费存在 = 技能执行效果数组存在匹配_V1(effectArray, effect => {
    const 原型 = String(effect?.原型 || '').trim();
    return (
      (原型 === '状态施加' && ['标记', '迟缓'].includes(String(effect?.状态 || '').trim())) ||
      (原型 === '结算修正' && (String(effect?.结算 || '').trim() === '技能效果' || (String(effect?.结算 || '').trim() === '造成伤害' && parseSkillSignedChangeNumber(effect?.数值) > 0)))
    );
  });
  effectArray.forEach((effect, index) => {
    if (!effect || typeof effect !== 'object' || Array.isArray(effect)) {
      throw new Error(`技能执行结构错误:${path}[${index}]不是效果对象`);
    }
    const 原型 = String(effect.原型 || '').trim();
    if (!原型) throw new Error(`技能执行结构错误:${path}[${index}]缺少原型`);
    if (!SKILL_PROTOTYPE_REGISTRY_V1[原型]) throw new Error(`技能执行结构错误:${path}[${index}]未知原型${原型}`);
    const 原型定义 = SKILL_PROTOTYPE_REGISTRY_V1[原型];
    const 缺失必填字段 = (Array.isArray(原型定义.必填字段) ? 原型定义.必填字段 : []).filter(字段名 => {
      const 原值 = effect[字段名];
      return 原值 === undefined || 原值 === null || (typeof 原值 === 'string' && !原值.trim()) || (Array.isArray(原值) && !原值.length);
    });
    if (
      原型 === '状态移除' &&
      !String(effect.状态 || '').trim() &&
      !String(effect.匹配原型 || '').trim()
    ) {
      缺失必填字段.push('状态/匹配原型');
    }
    if (缺失必填字段.length) throw new Error(`技能执行结构错误:${path}[${index}]缺少必填字段${缺失必填字段.join('、')}`);
    if (原型 === '伤害结算' && effect.持续回合 !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]伤害结算不支持持续回合`);
    if (effect.资源转移角色 !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]资源转移角色已删除`);
    const 正式字段集合 = new Set(原型定义.允许字段 || []);
    if (原型 === '结算修正') {
      const 结算字段列表 = 结算修正支持字段矩阵_V1[String(effect.结算 || '').trim()];
      if (结算字段列表) 结算字段列表.forEach(字段名 => 正式字段集合.add(字段名));
    }
    Object.keys(effect).forEach(字段名 => {
      if (!正式字段集合.has(字段名)) throw new Error(`技能执行结构错误:${path}[${index}]${原型}不支持字段${字段名}`);
    });
    if (技能效果非法归属目标集合_V1.has(String(effect.目标 || '').trim())) throw new Error(`技能执行结构错误:${path}[${index}]原型目标不允许写友方/敌方归属目标`);
    if (是顶层路径 && ['状态转移', '状态交换'].includes(原型) && String(effect.目标 || '').trim() !== '单体') throw new Error(`技能执行结构错误:${path}[${index}]${原型}顶层目标只允许单体`);
    if (是顶层路径 && 原型 === '状态移除' && !['自身', '单体', '群体'].includes(String(effect.目标 || '').trim())) throw new Error(`技能执行结构错误:${path}[${index}]状态移除顶层目标只允许自身/单体/群体`);
    if (是顶层路径 && 原型 === '规则防御' && !['自身', '单体', '群体'].includes(String(effect.目标 || '').trim())) throw new Error(`技能执行结构错误:${path}[${index}]规则防御顶层目标只允许自身/单体/群体`);
    if (原型 === '规则防御' && (effect.驱动属性 !== undefined || effect.影响方向 !== undefined)) throw new Error(`技能执行结构错误:${path}[${index}]${原型}不允许驱动属性或影响方向`);
    if (原型 === '结算修正' && ['伤害分摊', '消耗分摊'].includes(String(effect.结算 || '').trim()) && !['单体', '群体'].includes(String(effect.目标 || '').trim())) throw new Error(`技能执行结构错误:${path}[${index}]${String(effect.结算 || '').trim()}目标只允许单体/群体`);
    if (原型 === '修炼增益' && !['自身', '单体', '群体', '全场'].includes(String(effect.目标 || '').trim())) throw new Error(`技能执行结构错误:${path}[${index}]修炼增益目标只允许自身/单体/群体/全场`);
    if (原型 === '魂骨年限提升') {
      if (String(effect.目标 || '').trim() !== '自身') throw new Error(`技能执行结构错误:${path}[${index}]魂骨年限提升目标必须是自身`);
      if (!技能原型字段值是百分比修正_V1(effect.数值)) throw new Error(`技能执行结构错误:${path}[${index}]魂骨年限提升数值必须使用百分比`);
      const 提升比例 = parseSkillSignedChangeNumber(effect.数值);
      if (!(提升比例 > 0 && 提升比例 <= 1)) throw new Error(`技能执行结构错误:${path}[${index}]魂骨年限提升比例必须在0到100%之间`);
      const 年限上限 = Number(effect.年限上限);
      if (!Number.isInteger(年限上限) || 年限上限 < 1 || 年限上限 > 10000) throw new Error(`技能执行结构错误:${path}[${index}]魂骨年限提升年限上限必须是1到10000的整数`);
    }
    if (原型 === '等级提升') {
      if (String(effect.目标 || '').trim() !== '自身') throw new Error(`技能执行结构错误:${path}[${index}]等级提升目标必须是自身`);
      if (String(effect.提升方式 || '').trim() !== '下一合法等级') throw new Error(`技能执行结构错误:${path}[${index}]等级提升方式必须是下一合法等级`);
      const 等级上限 = Number(effect.等级上限);
      if (!Number.isInteger(等级上限) || 等级上限 < 1 || 等级上限 > 120) throw new Error(`技能执行结构错误:${path}[${index}]等级提升上限必须是1到120的整数`);
      const 冷却年数 = Number(effect.冷却年数);
      if (!Number.isInteger(冷却年数) || 冷却年数 < 0) throw new Error(`技能执行结构错误:${path}[${index}]等级提升冷却年数必须是非负整数`);
    }
    if (原型 === '群体撤离') {
      if (String(effect.目标 || '').trim() !== '群体') throw new Error(`技能执行结构错误:${path}[${index}]群体撤离目标必须是群体`);
      if (String(effect.目的地 || '').trim() !== '亡灵半位面') throw new Error(`技能执行结构错误:${path}[${index}]群体撤离目的地无效`);
      const 基础成功率 = Number(effect.基础成功率);
      const 人数倍率 = Number(effect.每增加一人成功率倍率);
      if (!Number.isFinite(基础成功率) || 基础成功率 < 0 || 基础成功率 > 1) throw new Error(`技能执行结构错误:${path}[${index}]群体撤离基础成功率必须在0到1之间`);
      if (!Number.isFinite(人数倍率) || 人数倍率 < 0 || 人数倍率 > 1) throw new Error(`技能执行结构错误:${path}[${index}]群体撤离人数成功率倍率必须在0到1之间`);
      if (String(effect.结算方式 || '').trim() !== '全员同成败') throw new Error(`技能执行结构错误:${path}[${index}]群体撤离结算方式必须是全员同成败`);
      if (effect.失败仍消耗资源 !== true) throw new Error(`技能执行结构错误:${path}[${index}]群体撤离必须声明失败仍消耗资源`);
      if (effect.消耗道具 !== false) throw new Error(`技能执行结构错误:${path}[${index}]群体撤离必须声明消耗道具为false`);
      const 对应等级 = Number(effect.对应等级);
      if (!Number.isInteger(对应等级) || 对应等级 < 1 || 对应等级 > 180) throw new Error(`技能执行结构错误:${path}[${index}]群体撤离对应等级必须是1到180的整数`);
      const 消耗解析 = 解析技能阶段消耗_V1(effect.消耗);
      if (消耗解析.形式 !== 'absolute' || 消耗解析.非法项.length === 0 && 消耗解析.启动.length === 0 && 消耗解析.维持.length === 0) throw new Error(`技能执行结构错误:${path}[${index}]群体撤离消耗必须是最终绝对整数COST`);
    }
    if (原型 === '战斗外复活') {
      if (String(effect.目标 || '').trim() === '自身') throw new Error(`技能执行结构错误:${path}[${index}]战斗外复活目标不能是自身`);
      if (!['单体', '群体', '全场'].includes(String(effect.目标 || '').trim())) throw new Error(`技能执行结构错误:${path}[${index}]战斗外复活目标只允许单体/群体/全场`);
      if (!战斗外复活代价类型选项_V1.includes(String(effect.复活代价类型 || '').trim())) throw new Error(`技能执行结构错误:${path}[${index}]战斗外复活代价类型无效`);
      ['死亡时限tick', '复活代价时限tick', '复活后状态时限tick'].forEach(字段名 => {
        const 数值 = Number(effect[字段名]);
        if (!Number.isFinite(数值) || 数值 < 1 || Math.round(数值) !== 数值) throw new Error(`技能执行结构错误:${path}[${index}]${字段名}必须为正整数`);
      });
    }
    if (原型 === '状态移除' && effect.概率 !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]状态移除不允许概率，成功率由驱动属性修正`);
    if (原型 === '状态移除' && effect.抵抗判定 !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]状态移除不允许抵抗判定，成功率由驱动属性修正`);
    if (原型 === '状态移除') {
      const 匹配原型 = String(effect.匹配原型 || '').trim();
      if (匹配原型 && !['资源变化', '护盾变化'].includes(匹配原型)) throw new Error(`技能执行结构错误:${path}[${index}]状态移除匹配原型只允许资源变化/护盾变化`);
      if (匹配原型 === '资源变化') {
        if (String(effect.资源 || '').trim() !== '生命') throw new Error(`技能执行结构错误:${path}[${index}]状态移除资源变化只支持生命`);
        if (!['负向', '正向', '任意'].includes(String(effect.数值方向 || '').trim())) throw new Error(`技能执行结构错误:${path}[${index}]状态移除数值方向无效`);
      } else if (effect.资源 !== undefined || effect.数值方向 !== undefined) {
        throw new Error(`技能执行结构错误:${path}[${index}]状态移除非资源变化不允许资源或数值方向`);
      }
      if (effect.持续回合 !== undefined) {
        const 持续回合 = Number(effect.持续回合);
        if (!Number.isFinite(持续回合) || 持续回合 < 1 || 持续回合 > 10 || Math.round(持续回合) !== 持续回合) throw new Error(`技能执行结构错误:${path}[${index}]状态移除持续回合必须为1到10的整数`);
      }
    }
    if (原型 === '状态交换' && !状态交换状态筛选有效_V1(effect.状态)) throw new Error(`技能执行结构错误:${path}[${index}]状态交换只允许自身负面状态筛选`);
    if (原型 === '状态交换' && !技能组合器效果含自身状态前置_V1(effect, String(effect.状态 || '任意负面').trim() || '任意负面')) throw new Error(`技能执行结构错误:${path}[${index}]状态交换缺少状态前置条件`);
    if (原型 === '状态交换' && effect.持续回合 !== undefined) {
      const 持续回合 = Number(effect.持续回合);
      if (!Number.isFinite(持续回合) || 持续回合 < 1 || 持续回合 > 10 || Math.round(持续回合) !== 持续回合) throw new Error(`技能执行结构错误:${path}[${index}]状态交换持续回合必须为1到10的整数`);
    }
    if (原型 === '状态转移' && (!状态转移端点有效_V1(effect.来源) || !状态转移端点有效_V1(effect.去向))) throw new Error(`技能执行结构错误:${path}[${index}]状态转移来源或去向无效`);
    if (原型 === '状态转移') {
      const 数量文本 = String(effect.数量 ?? '').trim();
      const 数量合法 = 数量文本 === '全部' || (Number.isInteger(Number(数量文本)) && Number(数量文本) > 0);
      if (!数量合法) throw new Error(`技能执行结构错误:${path}[${index}]状态转移数量只允许正整数或全部`);
      if (effect.持续回合 !== undefined) {
        const 持续回合 = Number(effect.持续回合);
        if (!Number.isFinite(持续回合) || 持续回合 < 1 || 持续回合 > 10 || Math.round(持续回合) !== 持续回合) throw new Error(`技能执行结构错误:${path}[${index}]状态转移持续回合必须为1到10的整数`);
      }
    }
    if (原型 === '复制执行') {
      const 复制类型 = String(effect.复制类型 || '').trim();
      if (!SKILL_PROTOTYPE_FIELD_OPTIONS_V1.复制类型.includes(复制类型))
        throw new Error(`技能执行结构错误:${path}[${index}]复制类型无效`);
      if (!SKILL_PROTOTYPE_FIELD_OPTIONS_V1.复制模式.includes(String(effect.复制模式 || '即时镜像').trim()))
        throw new Error(`技能执行结构错误:${path}[${index}]复制模式无效`);
      const 允许字段 = new Set(['原型', '目标', '复制类型', '复制模式', '保存上限', '削减比例', '可用次数', '保留回合', '保留时长tick', '条件分支', '生效方式', '驱动属性', '影响方向']);
      Object.keys(effect).forEach(字段名 => {
        if (!允许字段.has(字段名)) throw new Error(`技能执行结构错误:${path}[${index}]复制执行包含不支持字段`);
      });
      if (effect.削减比例 !== undefined && !/属性|全部/.test(String(复制类型)))
        throw new Error(`技能执行结构错误:${path}[${index}]复制削减比例只允许属性或全部复制使用`);
      ['保存上限', '可用次数'].forEach(字段名 => {
        if (effect[字段名] !== undefined && !['复制技能', '复制全部'].includes(String(复制类型)))
          throw new Error(`技能执行结构错误:${path}[${index}]复制${字段名}只允许复制技能或复制全部使用`);
      });
      if (!/属性|全部/.test(String(复制类型)) && (effect.驱动属性 !== undefined || effect.影响方向 !== undefined))
        throw new Error(`技能执行结构错误:${path}[${index}]复制技能不允许驱动属性或影响方向`);
    }
    if (原型 === '规则防御' && !['免伤', '免死'].includes(String(effect.规则 || '').trim())) throw new Error(`技能执行结构错误:${path}[${index}]规则防御规则只允许免伤/免死`);
    if (原型 === '规则防御' && effect.持续回合 !== undefined) {
      const 持续回合 = Number(effect.持续回合);
      if (!Number.isFinite(持续回合) || 持续回合 < 1 || 持续回合 > 99 || Math.round(持续回合) !== 持续回合) throw new Error(`技能执行结构错误:${path}[${index}]规则防御持续回合必须为1到99的整数`);
    }
    if (原型 === '规则改写') {
      if (!SKILL_PROTOTYPE_FIELD_OPTIONS_V1.规则.includes(String(effect.规则 || '').trim())) throw new Error(`技能执行结构错误:${path}[${index}]规则改写规则无效`);
      if (String(effect.规则 || '').trim() === '死亡转存活') {
        if (String(effect.目标 || '').trim() === '自身') {
          if (上下文?.passiveMode !== true) throw new Error(`技能执行结构错误:${path}[${index}]死亡转存活战斗内只能用于被动技能`);
          const 战斗内禁用字段 = ['死亡时限tick', '复活代价类型', '复活代价对象', '复活代价值', '复活代价时限tick', '复活后状态', '复活后状态时限tick', '持续回合'].find(字段名 => effect[字段名] !== undefined);
          if (战斗内禁用字段) throw new Error(`技能执行结构错误:${path}[${index}]自身死亡转存活不支持字段${战斗内禁用字段}`);
        }
      } else {
        const 持续回合 = Number(effect.持续回合);
        if (!Number.isFinite(持续回合) || 持续回合 < 1 || 持续回合 > 10 || Math.round(持续回合) !== 持续回合) throw new Error(`技能执行结构错误:${path}[${index}]规则改写持续回合必须为1到10的整数`);
        const 复活字段 = ['死亡时限tick', '复活代价类型', '复活代价对象', '复活代价值', '复活代价时限tick', '复活后状态', '复活后状态时限tick'].find(字段名 => effect[字段名] !== undefined);
        if (复活字段) throw new Error(`技能执行结构错误:${path}[${index}]非死亡转存活不支持字段${复活字段}`);
      }
    }
    if (原型 === '机制抹消') {
      if (
        effect.抹消对象 &&
        typeof effect.抹消对象 === 'object' &&
        !Array.isArray(effect.抹消对象) &&
        effect.抹消对象.授予效果 !== undefined
      ) throw new Error(`技能执行结构错误:${path}[${index}]机制抹消抹消对象不允许授予效果`);
      if (!effect.抹消对象 || typeof effect.抹消对象 !== 'object' || Array.isArray(effect.抹消对象)) throw new Error(`技能执行结构错误:${path}[${index}]机制抹消缺少抹消对象`);
      const 抹消对象原型 = String(effect.抹消对象.原型 || '').trim();
      if (!抹消对象原型 || !机制抹消支持原型_V1(抹消对象原型)) throw new Error(`技能执行结构错误:${path}[${index}]机制抹消对象原型无效`);
      const 抹消对象允许字段 = new Set(['原型', ...读取机制抹消可匹配字段_V1(抹消对象原型)]);
      const 无效字段 = Object.keys(effect.抹消对象).filter(字段 => !抹消对象允许字段.has(字段));
      if (无效字段.length) throw new Error(`技能执行结构错误:${path}[${index}]机制抹消对象不支持字段${无效字段[0]}`);
    }
    if (String(effect.机制 || '').trim()) throw new Error(`技能执行结构错误:${path}[${index}]仍写入机制字段`);
    if (String(effect.运行机制 || '').trim()) throw new Error(`技能执行结构错误:${path}[${index}]仍写入运行机制字段`);
    if (String(effect.副作用列表 || '').trim() || Array.isArray(effect.副作用列表)) throw new Error(`技能执行结构错误:${path}[${index}]仍写入副作用列表`);
    if (effect.机制决策临时 && typeof effect.机制决策临时 === 'object') throw new Error(`技能执行结构错误:${path}[${index}]仍写入机制决策临时`);
    if (effect.事件优先级 !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]事件优先级已删除`);
    if (effect.快照规则 !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]快照规则已删除`);
    if (原型 === '伤害结算' && (effect.驱动属性 !== undefined || effect.影响方向 !== undefined)) throw new Error(`技能执行结构错误:${path}[${index}]伤害结算不允许驱动属性或影响方向`);
    if (原型 === '时光回溯') {
      if (!['单体', '群体', '全场'].includes(String(effect.目标 || '').trim())) throw new Error(`技能执行结构错误:${path}[${index}]时光回溯目标只允许单体、群体或全场`);
      if (!读取时光回溯影响方向选项_V1(effect).includes(String(effect.影响方向 || '').trim())) throw new Error(`技能执行结构错误:${path}[${index}]时光回溯影响方向不适用于当前发动方式`);
    }
    if (原型 !== '伤害结算' && 技能原型支持驱动判定字段_V1(原型)) {
      if (!['机制授予', '时光回溯', '位移执行', '复制执行'].includes(原型) && String(effect.目标 || '').trim() === '自身' && (effect.驱动属性 !== undefined || effect.影响方向 !== undefined)) throw new Error(`技能执行结构错误:${path}[${index}]自身目标不允许驱动属性或影响方向`);
      if (技能原型需要默认驱动判定_V1(原型, effect) && (!String(effect.驱动属性 || '').trim() || !String(effect.影响方向 || '').trim())) throw new Error(`技能执行结构错误:${path}[${index}]目标驱动效果必须提供驱动属性和影响方向`);
    }
    if (原型 === '伤害结算' && effect.触发限制 !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]伤害结算不允许触发限制`);
    if (原型 === '伤害结算' && !['单体', '群体', '全场'].includes(String(effect.目标 || '').trim())) throw new Error(`技能执行结构错误:${path}[${index}]主伤害目标无效`);
    if (effect.延迟回合 !== undefined && !技能原型允许延迟回合_V1(原型)) throw new Error(`技能执行结构错误:${path}[${index}]延迟回合只允许用于正式战斗或行为原型`);
    if (技能原型允许延迟回合_V1(原型) && effect.延迟回合 !== undefined && !(Number(effect.延迟回合) > 0)) throw new Error(`技能执行结构错误:${path}[${index}]延迟回合必须大于0，未设置请不要落盘`);
    if (原型 === '判定修正' && !SKILL_PROTOTYPE_FIELD_OPTIONS_V1.判定.includes(String(effect.判定 || '').trim())) {
      throw new Error(`技能执行结构错误:${path}[${index}]判定修正判定类型无效`);
    }
    if (原型 === '判定修正' && !技能原型字段值是百分比修正_V1(effect.数值)) {
      throw new Error(`技能执行结构错误:${path}[${index}]判定修正数值必须使用百分比`);
    }
    if (原型 === '判定修正' && effect.持续回合 !== undefined) {
      const 持续回合 = Number(effect.持续回合);
      if (!Number.isFinite(持续回合) || 持续回合 < 1 || 持续回合 > 10 || Math.round(持续回合) !== 持续回合) throw new Error(`技能执行结构错误:${path}[${index}]判定修正持续回合必须为1到10的整数`);
      if (effect.打断效果 !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]持续判定修正不允许附带打断效果`);
    }
    if (原型 === '决策干扰') {
      const 旧字段 = [
        '决' + '策',
        '行动' + '权重',
        '目标' + '权重',
        '锁' + '定',
        '护' + '卫',
        '嘲' + '讽',
        '追' + '击',
        '弱' + '点',
        'decision_' + 'action_' + 'weight',
        'decision_' + 'target_' + 'weight',
      ].find(字段名 => effect[字段名] !== undefined);
      if (旧字段) throw new Error(`技能执行结构错误:${path}[${index}]决策干扰不允许旧字段${旧字段}`);
      const 干扰 = String(effect.干扰 || '').trim();
      if (!SKILL_PROTOTYPE_FIELD_OPTIONS_V1.干扰.includes(干扰)) throw new Error(`技能执行结构错误:${path}[${index}]决策干扰类型无效`);
      if (!技能原型字段值是百分比修正_V1(effect.数值)) throw new Error(`技能执行结构错误:${path}[${index}]决策干扰数值必须使用百分比`);
      const 数值 = parseSkillSignedChangeNumber(effect.数值);
      if (!(数值 >= 0.01 && 数值 <= 1)) throw new Error(`技能执行结构错误:${path}[${index}]决策干扰数值必须在1%到100%之间`);
      if (effect.决策 !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]决策字段已删除，请使用干扰`);
    }
    if (原型 === '结算修正') 断言结算修正字段范围_V1(effect, path, index);
    断言释放后分支不携带释放前降低结算_V1(effect, path, index);
    if (原型 === '炸环') 断言炸环字段范围_V1(effect, path, index);
    if (原型 === '资源变化') {
      ['持续tick', '主驱动资源', '结算标签'].forEach(字段名 => {
        if (effect[字段名] !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]资源变化不允许${字段名}`);
      });
      if (effect.持续回合 !== undefined && (!Number.isFinite(Number(effect.持续回合)) || Number(effect.持续回合) < 1 || Number(effect.持续回合) > 10)) throw new Error(`技能执行结构错误:${path}[${index}]资源变化持续回合必须为1到10`);
      if (effect.资源转移方式 !== undefined || effect.转化比例 !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]资源变化不允许资源转移字段`);
      if (effect.资源转移角色 !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]资源转移角色已删除`);
      if (String(effect.资源 || '').trim() === '生命' && parseSkillSignedChangeNumber(effect.数值) < 0) throw new Error(`技能执行结构错误:${path}[${index}]资源变化生命不允许负数，请使用伤害结算`);
    }
    if (原型 === '资源转移') {
      ['持续tick', '主驱动资源', '结算标签'].forEach(字段名 => {
        if (effect[字段名] !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]资源转移不允许${字段名}`);
      });
      if (effect.持续回合 !== undefined) {
        const 持续回合 = Number(effect.持续回合);
        if (!Number.isFinite(持续回合) || 持续回合 < 1 || 持续回合 > 10 || Math.round(持续回合) !== 持续回合) throw new Error(`技能执行结构错误:${path}[${index}]资源转移持续回合必须为1到10的整数`);
      }
      if (effect.资源转移角色 !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]资源转移角色已删除`);
      const 转移方式 = String(effect.资源转移方式 || '').trim();
      if (!['吞噬', '共享', '均分', '转移'].includes(转移方式)) throw new Error(`技能执行结构错误:${path}[${index}]资源转移方式无效`);
      const 目标 = String(effect.目标 || '').trim();
      const 合法目标 = 转移方式 === '均分' ? ['单体', '群体', '全场'] : ['单体', '群体'];
      if (!合法目标.includes(目标)) throw new Error(`技能执行结构错误:${path}[${index}]${转移方式}不允许目标${目标 || '空'}`);
      if (转移方式 === '均分' && effect.转化比例 !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]${转移方式}不允许转化比例`);
      if (['吞噬', '共享', '转移'].includes(转移方式)) {
        const 转化比例 = Number(effect.转化比例 ?? 1);
        if (!Number.isFinite(转化比例) || 转化比例 < 0 || 转化比例 > 2) throw new Error(`技能执行结构错误:${path}[${index}]转化比例必须在0到2之间`);
      }
    }
    if (原型 === '资源锁定') {
      const 资源列表 = Array.isArray(effect.资源) ? effect.资源 : [effect.资源];
      if (资源列表.some(资源 => !SKILL_PROTOTYPE_FIELD_OPTIONS_V1.资源.includes(String(资源 || '').trim()))) throw new Error(`技能执行结构错误:${path}[${index}]资源锁定资源无效`);
      if (!SKILL_PROTOTYPE_FIELD_OPTIONS_V1.锁定类型.includes(String(effect.锁定类型 || '').trim())) throw new Error(`技能执行结构错误:${path}[${index}]资源锁定类型无效`);
      if (!技能原型字段值是百分比修正_V1(effect.数值)) throw new Error(`技能执行结构错误:${path}[${index}]资源锁定数值必须使用百分比`);
      const 数值 = parseSkillSignedChangeNumber(effect.数值);
      if (!(数值 > 0) || 数值 > 1) throw new Error(`技能执行结构错误:${path}[${index}]资源锁定数值必须为0%~100%的正百分比`);
      if (!(Number(effect.持续回合) > 0)) throw new Error(`技能执行结构错误:${path}[${index}]资源锁定必须提供持续回合`);
    }
    if (原型 === '护盾变化' && parseSkillSignedChangeNumber(effect.数值) <= 0 && effect.持续回合 !== undefined) {
      throw new Error(`技能执行结构错误:${path}[${index}]非正数护盾不允许持续回合`);
    }
    if (原型 === '护盾变化') {
      const 模式 = String(effect.护盾模式 || '').trim();
      if (!['正向护盾', '斩盾', '窃盾'].includes(模式)) throw new Error(`技能执行结构错误:${path}[${index}]护盾变化护盾模式无效`);
      const 护盾数值 = parseSkillSignedChangeNumber(effect.数值);
      if (模式 === '正向护盾' && !(护盾数值 > 0)) throw new Error(`技能执行结构错误:${path}[${index}]正向护盾数值必须为正`);
      if (模式 !== '正向护盾' && !(护盾数值 < 0)) throw new Error(`技能执行结构错误:${path}[${index}]斩盾/窃盾数值必须为负`);
      ['斩盾倍率', '窃盾比例', 'shield_break_ratio', 'shield_steal_ratio'].forEach(字段名 => {
        if (effect[字段名] !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]护盾变化不允许${字段名}`);
      });
    }
    if (原型 === '属性修正') {
      const 属性列表 = Array.isArray(effect.属性) ? effect.属性 : [effect.属性];
      if (属性列表.some(属性 => !SKILL_PROTOTYPE_FIELD_OPTIONS_V1.属性.includes(String(属性 || '').trim()))) {
        throw new Error(`技能执行结构错误:${path}[${index}]属性修正属性无效`);
      }
    }
    if (原型 === '结算修正') {
      const 结算 = String(effect.结算 || '').trim();
      if (结算 === '反击' && !/\.授予效果(?:\[|$)/.test(path)) {
        throw new Error(`技能执行结构错误:${path}[${index}]反击只能放在后续触发槽位`);
      }
      if (结算 === '持续伤害引爆') {
        const DOT状态名 = String(effect.状态 || '').trim();
        const DOT前置状态列表 = Array.from(new Set([DOT状态名, ...读取技能组合器DOT前置状态列表_V1(effect)].filter(Boolean)));
        const skillHasAnyDot = 技能执行效果数组存在匹配_V1(effectArray, item =>
          String(item?.原型 || '').trim() === '状态施加' &&
          持续伤害状态集合_V1.has(String(item?.状态 || '').trim()),
        );
        const DOT前置成立 =
          DOT前置状态列表.some(状态名 =>
            技能执行效果数组存在匹配_V1(effectArray, item =>
              String(item?.原型 || '').trim() === '状态施加' &&
              String(item?.状态 || '').trim() === 状态名 &&
              技能组合器效果含结构化持续伤害_V1(item),
            ) ||
            技能组合器效果含指定状态前置_V1(effect, 状态名),
          ) ||
          (!DOT前置状态列表.length && skillHasAnyDot) ||
          /\.授予效果(?:\[|$)/.test(path);
        if (!DOT前置成立) throw new Error(`技能执行结构错误:${path}[${index}]持续伤害引爆缺少DOT前置`);
      }
    }
    if (原型 === '位移执行' && effect.方位 !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]位移方位没有行为约束`);
    if (原型 === '位移执行') {
      const 位移类型 = String(effect.位移类型 || '').trim();
      const 目标 = String(effect.目标 || '').trim();
      const 位移对象 = String(effect.位移对象 || '').trim();
      if (!['拉近', '击退', '换位', '瞬移', '脱离'].includes(位移类型)) throw new Error(`技能执行结构错误:${path}[${index}]位移类型无效`);
      if (!['自身', '目标', '自身与目标'].includes(位移对象)) throw new Error(`技能执行结构错误:${path}[${index}]位移对象无效`);
      if (目标 === '自身' && 位移对象 !== '自身') throw new Error(`技能执行结构错误:${path}[${index}]自身目标必须使用自身位移对象`);
      if ((位移类型 === '换位' || 位移对象 === '自身与目标') && (!目标 || 目标 === '自身')) throw new Error(`技能执行结构错误:${path}[${index}]换位必须提供自身以外目标`);
      if (位移类型 === '换位' && 位移对象 !== '自身与目标') throw new Error(`技能执行结构错误:${path}[${index}]换位必须声明自身与目标双参与者`);
      if (位移类型 !== '换位' && 位移对象 === '自身与目标') throw new Error(`技能执行结构错误:${path}[${index}]非换位不能使用自身与目标双参与者`);
      if (['瞬移', '脱离'].includes(位移类型) && 位移对象 !== '自身') throw new Error(`技能执行结构错误:${path}[${index}]${位移类型}只能移动自身`);
      if (effect.数量 !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]位移执行不允许触发次数或数量`);
      if (Number(effect.距离 || 0) <= 0) throw new Error(`技能执行结构错误:${path}[${index}]位移幅度必须大于0`);
      if (Number(effect.距离 || 0) > 30) throw new Error(`技能执行结构错误:${path}[${index}]位移幅度不能超过30`);
      if (effect.数值 !== undefined && !技能原型字段值是百分比修正_V1(effect.数值)) throw new Error(`技能执行结构错误:${path}[${index}]位移收益强度覆写必须是百分比`);
      if (effect.数值 !== undefined && Math.abs(parseSkillSignedChangeNumber(effect.数值)) > 0.45) throw new Error(`技能执行结构错误:${path}[${index}]位移收益强度覆写不能超过45%`);
      if (effect.持续回合 !== undefined && (!Number.isFinite(Number(effect.持续回合)) || Number(effect.持续回合) < 1 || Number(effect.持续回合) > 10)) throw new Error(`技能执行结构错误:${path}[${index}]位移持续回合必须为1到10`);
    }
    if (原型 === '伤害结算') {
      const 结算标签 = String(effect.结算标签 || '').trim();
      const 抗性类型 = String(effect.抗性类型 || '').trim();
      const 伤害类型 = String(effect.伤害类型 || '').trim();
      if (effect.对应等级 !== undefined && (!Number.isFinite(Number(effect.对应等级)) || Number(effect.对应等级) <= 0)) throw new Error(`技能执行结构错误:${path}[${index}]对应等级必须大于0`);
      if (!['标准伤害', '真实伤害'].includes(结算标签)) throw new Error(`技能执行结构错误:${path}[${index}]伤害结算标签无效`);
      if (!['物理抗性', '精神抗性', '元素抗性', '毒素抗性', '真实无视'].includes(抗性类型)) throw new Error(`技能执行结构错误:${path}[${index}]抗性类型无效`);
      const 预期结算标签 = 伤害类型 === '真实攻击'
        ? '真实伤害'
        : '标准伤害';
      const 预期抗性类型 = 伤害类型 === '真实攻击'
        ? '真实无视'
        : 伤害类型 === '精神攻击'
          ? '精神抗性'
          : 伤害类型 === '远程攻击'
            ? '元素抗性'
          : '物理抗性';
      if (结算标签 !== 预期结算标签 || 抗性类型 !== 预期抗性类型) throw new Error(`技能执行结构错误:${path}[${index}]伤害类型自动绑定字段不一致`);
      if (effect.触发消耗 !== undefined) {
        const 触发消耗 = 解析技能阶段消耗_V1(effect.触发消耗);
        if (触发消耗.非法项.length || 触发消耗.形式 !== 'absolute' || !触发消耗.启动.length || 触发消耗.维持.length) {
          throw new Error(`技能执行结构错误:${path}[${index}]伤害结算触发消耗必须是仅启动阶段的绝对值COST`);
        }
      }
    }
    if (原型 === '结算修正') {
      const 结算 = String(effect.结算 || '').trim();
      if (结算 === '反击' && !/\.授予效果(?:\[|$)/.test(path)) {
        throw new Error(`技能执行结构错误:${path}[${index}]反击只能放在后续触发槽位`);
      }
      if (结算 === '持续伤害引爆') {
        const DOT状态名 = String(effect.状态 || '').trim();
        const DOT前置状态列表 = Array.from(new Set([DOT状态名, ...读取技能组合器DOT前置状态列表_V1(effect)].filter(Boolean)));
        const skillHasAnyDot = 技能执行效果数组存在匹配_V1(effectArray, item =>
          String(item?.原型 || '').trim() === '状态施加' &&
          持续伤害状态集合_V1.has(String(item?.状态 || '').trim()),
        );
        const DOT前置成立 =
          DOT前置状态列表.some(状态名 =>
            技能执行效果数组存在匹配_V1(effectArray, item =>
              String(item?.原型 || '').trim() === '状态施加' &&
              String(item?.状态 || '').trim() === 状态名 &&
              技能组合器效果含结构化持续伤害_V1(item),
            ) ||
            技能组合器效果含指定状态前置_V1(effect, 状态名),
          ) ||
          (!DOT前置状态列表.length && skillHasAnyDot) ||
          /\.授予效果(?:\[|$)/.test(path);
        if (!DOT前置成立) throw new Error(`技能执行结构错误:${path}[${index}]持续伤害引爆缺少DOT前置`);
      }
    }
    if (原型 !== '时光回溯' && effect.影响方向 !== undefined) {
      let 影响方向选项 = 原型 === '时窗修正' ? 读取时窗修正影响方向选项_V1(effect) : 读取原型字段选项_V1(原型, '影响方向');
      if (原型 === '状态施加' && !(Number(effect.持续回合 || 0) > 0)) 影响方向选项 = 影响方向选项.filter(方向 => 方向 !== '持续时间');
      if (!影响方向选项.includes(String(effect.影响方向 || '').trim())) throw new Error(`技能执行结构错误:${path}[${index}]影响方向不适用于${原型}`);
    }
    if (
      index > 0 &&
      String(effect.生效方式 || '').trim() === '跟随主原型' &&
      主目标 &&
      String(effect.目标 || '').trim() !== 主目标
    ) {
      throw new Error(`技能执行结构错误:${path}[${index}]目标不同不能跟随主原型`);
    }
    if (原型 === '状态施加') {
      const 状态 = String(effect.状态 || '').trim();
      if (['任意负面', '任意增益', '任意状态'].includes(状态)) throw new Error(`技能执行结构错误:${path}[${index}]状态施加不能使用匹配占位状态`);
      if (日常系统状态选项_V1.includes(状态)) throw new Error(`技能执行结构错误:${path}[${index}]${状态}是日常系统状态，不能通过状态施加赋予`);
      if (!SKILL_PROTOTYPE_FIELD_OPTIONS_V1.状态.includes(状态)) throw new Error(`技能执行结构错误:${path}[${index}]状态施加状态无效`);
      if (状态 === '护卫' && String(effect.目标 || '').trim() === '自身') throw new Error(`技能执行结构错误:${path}[${index}]护卫目标不能是自身`);
      const 触发方式 = String(effect.触发方式 || '立即触发').trim();
      const 数值 = parseSkillSignedChangeNumber(effect.数值);
      if (!SKILL_PROTOTYPE_FIELD_OPTIONS_V1.触发方式.includes(触发方式)) throw new Error(`技能执行结构错误:${path}[${index}]状态触发方式无效`);
      if (触发方式 === '延迟触发' && !(Number(effect.延迟回合 || 0) > 0)) throw new Error(`技能执行结构错误:${path}[${index}]延迟触发必须提供延迟回合`);
      if (触发方式 !== '延迟触发' && effect.延迟回合 !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]非延迟触发不允许延迟回合`);
      if (!状态施加允许数值字段_V1(状态) && effect.数值 !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]${状态}不允许数值`);
      if (!状态施加允许副数值字段_V1(状态) && effect.副数值 !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]${状态}不允许副数值`);
      if (持续伤害状态集合_V1.has(状态) && !(数值 < 0)) throw new Error(`技能执行结构错误:${path}[${index}]${状态}数值必须为负`);
      if (状态 === '持续恢复' && !(数值 > 0)) throw new Error(`技能执行结构错误:${path}[${index}]持续恢复数值必须为正`);
      if (状态 === '资源燃烧' && !(数值 > 0)) throw new Error(`技能执行结构错误:${path}[${index}]资源燃烧数值必须为正`);
      if (状态 === '魂力枯竭' && !(数值 > 0)) throw new Error(`技能执行结构错误:${path}[${index}]魂力枯竭数值必须为正`);
      if (状态 === '护盾' && !(数值 > 0)) throw new Error(`技能执行结构错误:${path}[${index}]护盾数值必须为正`);
      if (['禁疗', '治疗反转', '防御剥夺', '精神抗性剥夺'].includes(状态) && !(数值 > 0)) throw new Error(`技能执行结构错误:${path}[${index}]${状态}数值必须为正`);
      if (状态施加应清理驱动字段_V1(状态, effect.目标)) {
        ['驱动属性', '影响方向'].forEach(字段名 => {
          if (effect[字段名] !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]${状态}不应携带${字段名}`);
        });
      }
      if (effect.概率 !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]状态施加不允许概率`);
      if (effect.资源 !== undefined && (typeof effect.资源 !== 'string' || !技能正式资源选项_V1.includes(effect.资源.trim()))) {
        throw new Error(`技能执行结构错误:${path}[${index}]状态施加资源无效`);
      }
      if (effect.触发概率 !== undefined && 解析技能触发概率_V1(effect.触发概率) === null) {
        throw new Error(`技能执行结构错误:${path}[${index}]状态施加触发概率必须是0到100%的合法概率`);
      }
      if (effect.限定探查者 !== undefined && (typeof effect.限定探查者 !== 'string' || !effect.限定探查者.trim())) {
        throw new Error(`技能执行结构错误:${path}[${index}]状态施加限定探查者必须是非空字符串`);
      }
      if (effect.打断效果 !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]该状态不允许打断效果`);
      if (effect.触发限制 !== undefined && !状态施加允许触发限制_V1(状态, effect.目标)) {
        throw new Error(`技能执行结构错误:${path}[${index}]该状态不允许触发限制`);
      }
      const 强度约束错误 = 状态施加强度约束错误_V1(effect, path, index);
      if (强度约束错误) throw new Error(强度约束错误);
    }
    if (原型 === '判定修正') {
      if (effect.打断效果 !== undefined && !判定修正默认开启打断效果_V1(effect)) {
        throw new Error(`技能执行结构错误:${path}[${index}]正向判定修正不允许开启打断效果`);
      }
    }
    if (原型 === '时窗修正') {
      const 调整字段 = String(effect.调整字段 || '').trim();
      if (effect.状态 !== undefined || effect.造物名称 !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]时窗修正不允许指定状态或造物`);
      if (调整字段 !== '持续回合' && effect.结算倍率 !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]时窗修正结算倍率仅允许持续回合压缩`);
      if (调整字段 === '持续回合') {
        if (effect.调整tick !== undefined || effect.调整次数 !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]时窗修正字段组合无效`);
        const 调整回合 = Math.round(Number(effect.调整回合 || 1));
        if (!(调整回合 >= 1 && 调整回合 <= 3)) throw new Error(`技能执行结构错误:${path}[${index}]时窗修正调整回合必须为1~3`);
        if (effect.结算倍率 !== undefined) {
          const 调整方式 = String(effect.调整方式 || '').trim();
          if (调整方式 !== '压缩') throw new Error(`技能执行结构错误:${path}[${index}]时窗修正结算倍率仅允许压缩`);
          const 倍率文本 = String(effect.结算倍率 || '').trim();
          const 倍率数值 = parseSkillSignedChangeNumber(倍率文本);
          if (!/%$/.test(倍率文本) || !(倍率数值 >= 0.5 && 倍率数值 <= 3)) throw new Error(`技能执行结构错误:${path}[${index}]时窗修正结算倍率必须为+50%~+300%`);
          const DOT前置成立 = 读取技能组合器DOT前置状态列表_V1(effect).length > 0 || 技能执行效果数组存在匹配_V1(effectArray, item =>
            String(item?.原型 || '').trim() === '状态施加' &&
            技能组合器效果含结构化持续伤害_V1(item),
          ) || /\.授予效果(?:\[|$)/.test(path);
          if (!DOT前置成立) throw new Error(`技能执行结构错误:${path}[${index}]时窗修正缺少DOT前置`);
        }
      }
      if (调整字段 === '有效期tick' && (effect.调整回合 !== undefined || effect.调整次数 !== undefined || effect.结算倍率 !== undefined)) throw new Error(`技能执行结构错误:${path}[${index}]时窗修正字段组合无效`);
      if (调整字段 === '有效期tick') {
        const 调整tick = Math.round(Number(effect.调整tick || 1));
        if (!(调整tick >= 1 && 调整tick <= 1008)) throw new Error(`技能执行结构错误:${path}[${index}]时窗修正有效期调整必须为1~1008tick`);
      }
      if (['触发次数', '使用次数'].includes(调整字段) && (effect.调整回合 !== undefined || effect.调整tick !== undefined || effect.结算倍率 !== undefined)) throw new Error(`技能执行结构错误:${path}[${index}]时窗修正字段组合无效`);
      if (['触发次数', '使用次数'].includes(调整字段)) {
        const 调整次数 = Math.round(Number(effect.调整次数 || 1));
        if (!(调整次数 >= 1 && 调整次数 <= 3)) throw new Error(`技能执行结构错误:${path}[${index}]时窗修正调整次数必须为1~3`);
      }
      const 单日使用次数上限 = Math.round(Number(effect.单日使用次数上限 || 1));
      if (!(单日使用次数上限 >= 1 && 单日使用次数上限 <= 3)) throw new Error(`技能执行结构错误:${path}[${index}]时窗修正单日使用次数上限必须为1~3`);
    }
    技能执行嵌套效果数组字段表_V1.forEach(key => {
      if (Array.isArray(effect[key])) 断言技能执行效果原型契约_V1(effect[key], `${path}[${index}].${key}`);
    });
  if (原型 === '机制授予') {
    const 触发条件 = String(effect.触发条件 || '主动触发').trim();
    if (!['主动触发', '随下次行动触发', '下次魂技成功释放'].includes(触发条件)) throw new Error(`技能执行结构错误:${path}[${index}]机制授予触发条件无效`);
    if (触发条件 === '随下次行动触发' && !机制授予目标允许下次行动触发_V1(effect.目标)) throw new Error(`技能执行结构错误:${path}[${index}]非自身机制授予不允许随下次行动触发`);
    if (触发条件 === '随下次行动触发' && (effect.可用次数 !== undefined || effect.持续回合 !== undefined)) throw new Error(`技能执行结构错误:${path}[${index}]随下次行动触发不支持可用次数或持续回合`);
    if (触发条件 === '下次魂技成功释放' && !机制授予目标允许下次行动触发_V1(effect.目标)) throw new Error(`技能执行结构错误:${path}[${index}]非自身机制授予不允许在下次魂技成功释放时触发`);
    if (触发条件 === '下次魂技成功释放' && (!(Number.isInteger(Number(effect.可用次数)) && Number(effect.可用次数) > 0) || effect.持续回合 !== undefined)) throw new Error(`技能执行结构错误:${path}[${index}]下次魂技成功释放机制授予必须有正整数可用次数且不设置回合期限`);
    if (触发条件 === '主动触发' && !(Number(effect.可用次数 || 0) > 0 && Number(effect.持续回合 || 0) > 0)) throw new Error(`技能执行结构错误:${path}[${index}]主动触发机制授予缺少可用次数或持续回合`);
    if ((Array.isArray(effect.授予效果) ? effect.授予效果 : []).some(item => String(item?.原型 || '').trim() === '机制授予')) throw new Error(`技能执行结构错误:${path}[${index}]机制授予不能嵌套机制授予`);
    if ((Array.isArray(effect.授予效果) ? effect.授予效果 : []).some(item => !机制授予允许授予原型集合_V1.has(String(item?.原型 || '').trim()))) throw new Error(`技能执行结构错误:${path}[${index}]机制授予授予效果原型无效`);
  }
    if (原型 === '召唤生成') {
      const 单位类型 = String(effect.召唤单位类型 || '').trim();
      if (String(effect.目标 || '').trim() !== '自身') throw new Error(`技能执行结构错误:${path}[${index}]召唤生成只能挂载自身`);
      if (!SKILL_PROTOTYPE_FIELD_OPTIONS_V1.召唤单位类型.includes(单位类型)) throw new Error(`技能执行结构错误:${path}[${index}]召唤单位类型无效`);
      if (!SKILL_PROTOTYPE_FIELD_OPTIONS_V1.行动模式.includes(String(effect.行动模式 || '').trim())) throw new Error(`技能执行结构错误:${path}[${index}]召唤行动模式无效`);
      if (单位类型 === '分身' && !召唤生成使用继承属性比例_V1(effect)) throw new Error(`技能执行结构错误:${path}[${index}]分身必须携带继承属性比例`);
      if (单位类型 === '本命召唤兽' && !召唤生成使用继承属性比例_V1(effect)) throw new Error(`技能执行结构错误:${path}[${index}]本命召唤兽必须携带继承属性比例`);
      if (!召唤生成允许继承属性比例_V1(effect) && (effect.继承属性比例 !== undefined || effect.属性继承比例 !== undefined)) throw new Error(`技能执行结构错误:${path}[${index}]${单位类型}不允许继承属性比例`);
      if (召唤生成使用继承属性比例_V1(effect) && effect.强度 !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]继承型召唤不应携带强度`);
      if (!召唤生成使用继承属性比例_V1(effect) && effect.强度 === undefined) throw new Error(`技能执行结构错误:${path}[${index}]模板召唤缺少强度`);
      const 召唤数量 = Math.max(1, Math.round(Number(effect.数量 || effect.召唤数量 || 1)));
      if (单位类型 === '本命召唤兽' && 召唤数量 !== 1) throw new Error(`技能执行结构错误:${path}[${index}]本命召唤兽数量必须为1`);
      if (单位类型 !== '分身' && !召唤生成允许普通批量_V1(effect) && 召唤数量 !== 1) throw new Error(`技能执行结构错误:${path}[${index}]${单位类型}不允许批量召唤`);
      if (String(effect.行动模式 || '').trim() === '护卫' && !['可承伤', '护卫承伤', '分摊承伤'].includes(String(effect.承伤规则 || '').trim())) throw new Error(`技能执行结构错误:${path}[${index}]护卫召唤必须允许承伤`);
      if (String(effect.行动模式 || '').trim() !== '护卫' && effect.承伤规则 !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]非护卫召唤不应携带承伤规则`);
    }
    if (String(effect.目标 || '').trim() === '分身' && !原型允许分身目标_V1(原型)) {
      throw new Error(`技能执行结构错误:${path}[${index}]只有资源变化/属性修正/判定修正/结算修正可以选择分身目标`);
    }
    if (Array.isArray(effect.条件分支)) {
      effect.条件分支.forEach((branch, branchIndex) => {
        技能条件分支效果数组字段表_V1.forEach(key => {
          if (Array.isArray(branch?.[key])) 断言技能执行效果原型契约_V1(branch[key], `${path}[${index}].条件分支[${branchIndex}].${key}`);
        });
      });
    }
  });
}

function 收口生成正式效果终态_V1(效果列表 = [], options = {}) {
  const 目标 = 归一化执行效果作用目标_V1(options?.目标 || '单体', '单体');
  const path = String(options?.path || '生成后效果').trim() || '生成后效果';
  const 技能 = options?.技能 && typeof options.技能 === 'object'
    ? options.技能
    : { _效果数组: Array.isArray(效果列表) ? 效果列表 : [] };
  const 收口列表 = 收口技能执行效果数组_V1(效果列表, { ...options, 目标, 技能 });
  收口生成状态施加目标与强度_V1(收口列表);
  补齐状态交换自身前置_V1(收口列表);
  清理等价替换条件分支_V1(收口列表);
  递归收口正式技能效果树_V1(收口列表, path);
  断言技能执行效果原型契约_V1(收口列表, path, { ...options, 技能 });
  return 收口列表;
}

function 收口造物承载物品模板数组_V1(effectArray = [], skill = {}, options = {}) {
  const source = Array.isArray(effectArray) ? effectArray : [];
  const templates = source.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (String(raw.原型 || '').trim()) return null;
    const 数量 = Math.max(1, Math.round(Number(raw.数量 || 1)));
    const 有效期tick = Math.max(0, Math.round(Number(raw.有效期tick || 0)));
    const 副作用违规列表 = [];
    const 副作用列表 = 收口执行副作用列表_V1(raw.副作用列表 || [], path => {
      if (path) 副作用违规列表.push(path.replace(/^副作用列表/, `_效果数组[${index}].副作用列表`));
    });
    if (副作用违规列表.length) throw new Error(`技能执行结构错误:造物使用副作用包含非法字段:${Array.from(new Set(副作用违规列表)).join('、')}`);
    const 使用效果 = 收口生成正式效果终态_V1(raw.使用效果 || [], {
      ...options,
      目标: '单体',
      path: '_效果数组.使用效果',
      技能: skill,
    });
    if (!使用效果.length) return null;
    const template = { 数量, 使用效果 };
    if (副作用列表.length) template.副作用列表 = 副作用列表;
    if (有效期tick > 0) template.有效期tick = 有效期tick;
    return template;
  }).filter(Boolean);
  return templates;
}

function 递归收口正式技能效果树_V1(value = {}, path = '_效果数组') {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    value.forEach((item, index) => 递归收口正式技能效果树_V1(item, `${path}[${index}]`));
    return value;
  }
  if (String(value.原型 || '').trim()) {
    清理执行效果原型语义_V1(String(value.原型 || '').trim(), value, {});
    应用技能原型目标驱动契约_V1(String(value.原型 || '').trim(), value);
    value.目标 = 约束技能原型正式目标_V1(String(value.原型 || '').trim(), value.目标);
    收口正式百分比字段最低值_V1(value);
  }
  技能执行嵌套效果数组字段表_V1.forEach(字段名 => {
    if (Array.isArray(value[字段名])) 递归收口正式技能效果树_V1(value[字段名], `${path}.${字段名}`);
  });
  if (Array.isArray(value.条件分支)) {
    value.条件分支.forEach((分支, index) => {
      技能条件分支效果数组字段表_V1.forEach(字段名 => {
        if (Array.isArray(分支?.[字段名])) 递归收口正式技能效果树_V1(分支[字段名], `${path}.条件分支[${index}].${字段名}`);
      });
    });
  }
  return value;
}

function 读取技能同资源消耗绝对值表_V1(消耗 = '无', 上下文 = {}) {
  const 结果 = { 体力: 0, 魂力: 0, 精神力: 0 };
  const 写入 = (资源, 原始值) => {
    const 资源名 = String(资源 || '').trim();
    if (!Object.prototype.hasOwnProperty.call(结果, 资源名)) return;
    const 文本 = String(原始值 ?? '').trim();
    if (!文本 || 文本 === '无') return;
    if (/%$/.test(文本)) {
      const 百分比 = Number(文本.replace('%', '').replace(/^\+/, ''));
      if (Number.isFinite(百分比) && 百分比 > 0) 结果[资源名] += 读取直接结算预算资源上限_V1(资源名, 上下文) * 百分比 / 100;
      return;
    }
    const 数值 = Number(文本.replace(/^\+/, ''));
    if (Number.isFinite(数值) && 数值 > 0) 结果[资源名] += 数值;
  };
  if (消耗 && typeof 消耗 === 'object' && !Array.isArray(消耗)) {
    Object.entries(消耗).forEach(([资源, 值]) => 写入(资源, 值));
    return 结果;
  }
  String(消耗 || '')
    .split(/[|｜\s]+/)
    .map(片段 => String(片段 || '').trim())
    .filter(Boolean)
    .forEach(片段 => {
      if (/^维持[:：]/.test(片段)) return;
      const 匹配 = 片段.replace(/^启动[:：]/, '').match(/^(体力|魂力|精神力)[:：]([+-]?\d+(?:\.\d+)?%?)$/);
      if (匹配) 写入(匹配[1], 匹配[2]);
    });
  return 结果;
}

function 格式化资源恢复封顶正式数值_V1(绝对值 = 0, 资源 = '', 上下文 = {}, 输出百分比 = true) {
  const 安全绝对值 = Math.max(0, Number(绝对值) || 0);
  if (!(安全绝对值 > 0)) return '+0';
  const 资源上限 = 读取直接结算预算资源上限_V1(资源, 上下文);
  const 百分点 = 安全绝对值 / Math.max(1, 资源上限) * 100;
  if (输出百分比 && 百分点 >= 5) return `+${formatSkillNumber(百分点, 2)}%`;
  return `+${formatSkillNumber(安全绝对值, Math.abs(安全绝对值 % 1) < 0.0001 ? 0 : 2)}`;
}

function 限制技能自身资源恢复不覆盖消耗_V1(技能 = {}, 上下文 = {}) {
  const 消耗表 = 读取技能同资源消耗绝对值表_V1(技能?.消耗 || '无', 上下文);
  if (!Object.values(消耗表).some(值 => Number.isFinite(值) && 值 > 0)) return;
  const 自身目标 = new Set(['自身', '使用者', '施术者', '制作者']);
  const 限制效果 = 效果 => {
    if (!效果 || typeof 效果 !== 'object' || Array.isArray(效果)) return;
    const 原型 = String(效果.原型 || '').trim();
    const 资源 = String(效果.资源 || '').trim();
    if (
      ['资源变化', '资源转移'].includes(原型) &&
      Object.prototype.hasOwnProperty.call(消耗表, 资源) &&
      自身目标.has(String(效果.目标 || '').trim())
    ) {
      const 消耗绝对值 = Number(消耗表[资源] || 0);
      const 原始数值 = 规范化执行效果数值_V1(效果.数值, 效果.动作 || '');
      const 当前值 = parseSkillSignedChangeNumber(原始数值);
      if (消耗绝对值 > 0 && Number.isFinite(当前值) && 当前值 > 0) {
        const 是百分比 = /%$/.test(String(原始数值 || '').trim());
        const 资源上限 = 读取直接结算预算资源上限_V1(资源, 上下文);
        const 上限值 = 是百分比 ? 消耗绝对值 / Math.max(1, 资源上限) * 0.95 : 消耗绝对值 * 0.95;
        if (当前值 >= 上限值) {
          const 上限绝对值 = 是百分比 ? 上限值 * Math.max(1, 资源上限) : 上限值;
          效果.数值 = 格式化资源恢复封顶正式数值_V1(上限绝对值, 资源, 上下文, 是百分比);
        }
      }
    }
    技能执行嵌套效果数组字段表_V1.forEach(字段名 => {
      (Array.isArray(效果?.[字段名]) ? 效果[字段名] : []).forEach(限制效果);
    });
    (Array.isArray(效果.条件分支) ? 效果.条件分支 : []).forEach(分支 => {
      技能条件分支效果数组字段表_V1.forEach(字段名 => {
        (Array.isArray(分支?.[字段名]) ? 分支[字段名] : []).forEach(限制效果);
      });
    });
  };
  (Array.isArray(技能?._效果数组) ? 技能._效果数组 : []).forEach(限制效果);
}

function 收口技能执行结构_V1(skill = {}, options = {}) {
  if (!skill || typeof skill !== 'object') return skill;
  const path = String(options?.path || '技能').trim() || '技能';
  断言技能根层正式字段_V1(skill, path);
  const 副作用违规列表 = [];
  const 副作用列表 = 收口执行副作用列表_V1(skill.副作用列表 || [], path => {
    if (path) 副作用违规列表.push(path);
  });
  if (副作用违规列表.length) throw new Error(`技能执行结构错误:副作用列表包含非法字段:${Array.from(new Set(副作用违规列表)).join('、')}`);
  if (!String(skill.承载方式 || '').trim() && 是造物承载效果数组_V1(skill._效果数组)) skill.承载方式 = '造物承载';
  const 效果路径 = path === '技能' ? '_效果数组' : `${path}._效果数组`;
  skill._效果数组 = String(skill.承载方式 || '').trim() === '造物承载'
    ? 收口造物承载物品模板数组_V1(skill._效果数组 || [], skill, options)
    : 收口生成正式效果终态_V1(skill._效果数组 || [], { ...options, path: 效果路径, 技能: skill });
  限制技能自身资源恢复不覆盖消耗_V1(skill, options);
  if (副作用列表.length) skill.副作用列表 = 副作用列表;
  else delete skill.副作用列表;
  return skill;
}

function 补齐状态交换自身前置_V1(效果数组 = []) {
  (Array.isArray(效果数组) ? 效果数组 : []).forEach(effect => {
    if (!effect || typeof effect !== 'object' || Array.isArray(effect)) return;
    if (String(effect.原型 || '').trim() === '状态交换') {
      const 状态 = String(effect.状态 || '任意负面').trim() || '任意负面';
      if (!技能组合器效果含自身状态前置_V1(effect, 状态)) {
        effect.条件分支 = [
          ...(Array.isArray(effect.条件分支) ? effect.条件分支 : []),
          ...构建缺少状态禁用条件分支_V1(状态, '禁用', '自身'),
        ];
      }
    }
    技能执行嵌套效果数组字段表_V1.forEach(键 => {
      if (Array.isArray(effect[键])) 补齐状态交换自身前置_V1(effect[键]);
    });
    if (Array.isArray(effect.条件分支)) {
      effect.条件分支.forEach(分支 => {
        技能条件分支效果数组字段表_V1.forEach(键 => {
          if (Array.isArray(分支?.[键])) 补齐状态交换自身前置_V1(分支[键]);
        });
      });
    }
  });
}

function normalizeSkillTargetModifierList(value = []) {
  const source = Array.isArray(value) ? value : [value];
  return Array.from(
    new Set(
      source
        .map(item => String(item || '').trim())
        .filter(item => SKILL_TARGET_MODIFIER_VALUES_V1.includes(item)),
    ),
  );
}

function buildSkillCombatProfile(blueprint, qualityCtx = {}) {
  const main = blueprint?.主机制大类 || '伤害类';
  const archetype = blueprint?.主机制原型 || '单体伤害';
  const attrs = Array.isArray(blueprint?.加成属性候选) ? blueprint.加成属性候选 : ['魂力'];
  const delivery = blueprint?.释放形态 || '直接生效';
  const secondary = Array.isArray(blueprint?.副机制) ? blueprint.副机制 : [];
  const quality = qualityCtx.quality || 'B级_普通';
  const ringIndex = Number(qualityCtx.ringIndex || 1);
  const ringAge = Math.max(100, Number(qualityCtx.ringAge || 1000));
  const type = blueprint?.系别来源 || qualityCtx.type || '强攻系';
  const fuelModel = blueprint?.燃料模型 || buildFuelModelByType(type, main);
  const targetKind = 归一化执行效果作用目标_V1(blueprint?.目标 || '单体', '单体');

  // v5：powerMap 按 quality × ringIndex 二维表（魂技位决定威力基数曲线，品质决定倍率）
  // 第N魂技位 B 级标准威力 = 70 × 30^((N-1)/8)，让 70=1魂(10 COST) ... 2100=9魂(90 COST)
  const v5_魂技位B级威力 = [70, 104, 155, 232, 346, 516, 770, 1149, 2100];
  const v5_品质倍率 = { F级_残缺: 0.21, D级_粗糙: 0.33, C级_劣质: 0.5, B级_普通: 1.0, A级_优秀: 1.67, S级_极品: 2.5, 'S+级_神品': 3.17 };
  const v5_魂技位序 = Math.max(1, Math.min(9, Math.floor(Number(ringIndex || 1)))) - 1;
  const v5_品质倍 = v5_品质倍率[quality] || 1.0;
  // v9.2：powerBase ±25% 随机波动，避免同位同品质的伤害技能威力完全一致
  const v9_2_威力波动 = 0.75 + Math.random() * 0.5;  // 0.75-1.25
  const powerMap = { [quality]: Math.round(v5_魂技位B级威力[v5_魂技位序] * v5_品质倍 * v9_2_威力波动) };
  const powerBase = Math.max(1, Math.round(powerMap[quality] || 120));
  const randomRangeRaw = (min, max) => (min === max ? min : min + Math.random() * (max - min));
  const grade = { F级_残缺: 'F', D级_粗糙: 'D', C级_劣质: 'C', B级_普通: 'B', A级_优秀: 'A', S级_极品: 'S', 'S+级_神品': 'S+' }[quality] || 'B';
  const gradeFactor = { F: 0.6, D: 0.8, C: 1, B: 2, A: 3, S: 4, 'S+': 5 }[grade] || 2;
  const secondaryEffectScale = getSecondaryRingScale(ringIndex);
  const secondaryDurationScale = Math.max(0.7, secondaryEffectScale);
  const randomInRange = table => {
    const [min, max] = pickSkillGradeTableRangeV1(table, grade);
    if (min === max) return min;
    return Number((min + Math.random() * (max - min)).toFixed(2));
  };
  const pickStatKey = (directions = []) => {
    const ordered = Array.isArray(directions) ? directions : [];
    if (ordered.includes('力量')) return 'str';
    if (ordered.includes('防御')) return 'def';
    if (ordered.includes('敏捷')) return 'agi';
    if (ordered.includes('精神力')) return 'men_max';
    if (ordered.includes('魂力')) return 'sp_max';
    return 'str';
  };
  const pickStatKeys = (directions = [], count = 2) => {
    const map = { 力量: 'str', 防御: 'def', 敏捷: 'agi', 精神力: 'men_max', 魂力: 'sp_max' };
    const keys = directions.map(d => map[d]).filter(Boolean);
    return Array.from(new Set(keys)).slice(0, count);
  };

  const 伤害意图 = { 威力倍率: 0, 伤害类型: '无', 防御穿透: 0, 护盾数值: 0, 恢复比例: 0 };
  const 效果意图 = {
    状态: '无',
    持续回合: 0,
    属性倍率: { str: 1.0, def: 1.0, agi: 1.0, men_max: 1.0, sp_max: 1.0 },
    持续伤害数值: 0,
    结算参数: {
      跳过回合: false,
      无法反应: false,
      无视异常: false,
      封技: false,
      持续伤害数值: 0,
      防御穿透比例: 0,
      反应加成: 0,
      反应压制: 0,
      攻击速度加成: 0,
      施放速度加成: 0,
      施放速度压制: 0,
      命中加成: 0,
      命中压制: 0,
      闪避加成: 0,
      闪避压制: 0,
      锁定强度: 0,
      打断强度: 0,
      伤害倍率系数: 1.0,
      造成伤害加值: 0,
      治疗倍率: 1.0,
      治疗加值: 0,
      护盾获得倍率: 1.0,
      护盾补充值: 0,
      技能效果倍率: 1.0,
      魂力恢复比例: 0,
      精神恢复比例: 0,
      禁疗比例: 0,
      持续恢复比例: 0,
      生命保底: 0,
      免死次数: 0,
      复活次数: 0,
      复活治疗比例: 0,
      反伤比例: 0,
      伤害转移比例: 0,
      伤害转移对象: '',
      伤害分摊比例: 0,
      伤害分摊数量: 0,
      消耗分摊比例: 0,
      消耗分摊数量: 0,
      治疗反转比例: 0,
      隐匿等级: 0,
      附加真伤比例: 0,
      伤害吸收比例: 0,
      消耗修正倍率: 1.0,
      前摇修正倍率: 1.0,
      掌控倍率: 1.0,
      速度倍率: 1.0,
    },
  };
  const 造物意图 = { 实体名称: '无', 持续回合: 0, 继承属性比例: 0, 核心机制描述: '无' };
  const 战斗 = {
    前摇: 0,
    消耗: '无',
    伤害意图,
    效果意图,
    造物意图,
  };

  const scaleStatMods = factor => {
    ['str', 'def', 'agi', 'men_max', 'sp_max'].forEach(k => {
      const value = 效果意图.属性倍率[k];
      if (value !== undefined && value !== 1.0) {
        效果意图.属性倍率[k] = Number((1 + (value - 1) * factor).toFixed(2));
      }
    });
  };
  const targetFactor = (() => {
    if (['伤害类'].includes(main)) {
      if (targetKind === '群体') return Number(randomRangeRaw(0.6, 0.75).toFixed(2));
      if (targetKind === '全场') return Number(randomRangeRaw(0.4, 0.55).toFixed(2));
      return 1;
    }
    if (['控制类', '削弱类'].includes(main)) {
      if (targetKind === '群体') return Number(randomRangeRaw(0.7, 0.85).toFixed(2));
      if (targetKind === '全场') return Number(randomRangeRaw(0.5, 0.7).toFixed(2));
      return 1;
    }
    if (['增益类', '回复类'].includes(main)) {
      if (targetKind === '群体') return Number(randomRangeRaw(0.65, 0.8).toFixed(2));
      if (targetKind === '全场') return Number(randomRangeRaw(0.45, 0.6).toFixed(2));
      return 1;
    }
    if (['防御类'].includes(main)) {
      if (targetKind === '单体') return Number(randomRangeRaw(0.9, 1.0).toFixed(2));
      if (targetKind === '群体') return Number(randomRangeRaw(0.6, 0.75).toFixed(2));
      if (targetKind === '全场') return Number(randomRangeRaw(0.45, 0.6).toFixed(2));
      return 1;
    }
    return 1;
  })();

  const getDamageType = () => {
    if (type === '精神系') return '精神攻击';
    if (type === '食物系' || type === '控制系' || type === '元素系') return '远程攻击';
    return '近身攻击';
  };

  if (main === '伤害类') {
    战斗.技能分类 = '输出';
    伤害意图.威力倍率 = Math.round(powerBase * targetFactor);
    伤害意图.伤害类型 = getDamageType();
    if (archetype === '多段伤害') 伤害意图.威力倍率 = Math.round(powerBase * 0.85);
    if (archetype === '持续伤害') {
      效果意图.状态 = '持续创伤';
      效果意图.持续回合 = 3;
      效果意图.持续伤害数值 = Math.round(powerBase * 0.4 * targetFactor);
      效果意图.结算参数.持续伤害数值 = 效果意图.持续伤害数值;
    }
  } else if (main === '控制类') {
    战斗.技能分类 = '控制';
    效果意图.状态 = archetype;
    效果意图.持续回合 = archetype === '硬控' ? 1 : 2;
    if (archetype === '软控') {
      效果意图.结算参数.反应压制 = Number(
        randomInRange({ C: [0.05, 0.08], B: [0.08, 0.12], A: [0.12, 0.18], S: [0.18, 0.25] }).toFixed(2),
      );
      效果意图.结算参数.施放速度压制 = Number(
        randomInRange({ C: [0.15, 0.25], B: [0.25, 0.4], A: [0.4, 0.6], S: [0.6, 0.9] }).toFixed(2),
      );
      效果意图.结算参数.闪避压制 = Number(
        randomInRange({ C: [0.03, 0.05], B: [0.05, 0.08], A: [0.08, 0.12], S: [0.12, 0.18] }).toFixed(2),
      );
    }
    if (archetype === '迟缓') {
      效果意图.结算参数.反应压制 = Number(
        randomInRange({ C: [0.05, 0.08], B: [0.08, 0.12], A: [0.12, 0.18], S: [0.18, 0.25] }).toFixed(2),
      );
      效果意图.结算参数.闪避压制 = Number(
        randomInRange({ C: [0.05, 0.08], B: [0.08, 0.12], A: [0.12, 0.18], S: [0.18, 0.25] }).toFixed(2),
      );
    }
    if (archetype === '节奏打断') {
      效果意图.结算参数.打断强度 = 1.0;
      效果意图.结算参数.施放速度压制 = Number(
        randomInRange({ C: [0.1, 0.2], B: [0.2, 0.35], A: [0.35, 0.55], S: [0.55, 0.8] }).toFixed(2),
      );
      效果意图.结算参数.前摇修正倍率 = Number((1 + (效果意图.结算参数.施放速度压制 || 0)).toFixed(2));
    }
    if (archetype === '硬控') 效果意图.结算参数.跳过回合 = true;
  } else if (main === '削弱类') {
    战斗.技能分类 = '控制';
    效果意图.状态 = archetype;
    效果意图.持续回合 = { C: 1, B: 2, A: 3, S: 4 }[grade] || 2;
    if (archetype === '单属性削弱') {
      效果意图.属性倍率[pickStatKey(attrs)] = randomInRange({
        C: [0.88, 0.92],
        B: [0.8, 0.88],
        A: [0.7, 0.8],
        S: [0.55, 0.7],
      });
    }
    if (archetype === '多属性削弱') {
      const keys = pickStatKeys(attrs, 2);
      keys.forEach(k => {
        效果意图.属性倍率[k] = randomInRange({ C: [0.92, 0.95], B: [0.86, 0.9], A: [0.78, 0.84], S: [0.68, 0.76] });
      });
    }
    if (archetype === '禁疗') {
      效果意图.结算参数.禁疗比例 = Number(
        randomInRange({ C: [0.2, 0.3], B: [0.35, 0.5], A: [0.5, 0.7], S: [0.75, 1.0] }).toFixed(2),
      );
    }
    if (archetype === '消耗') {
      const ratio = randomInRange({ C: [1.08, 1.15], B: [1.15, 1.25], A: [1.25, 1.4], S: [1.4, 1.6] });
      效果意图.结算参数.消耗修正倍率 = Number(ratio.toFixed(2));
    }
    if (archetype === '前摇') {
      const ratio = randomInRange({ C: [1.08, 1.14], B: [1.14, 1.24], A: [1.24, 1.38], S: [1.38, 1.55] });
      效果意图.结算参数.前摇修正倍率 = Number(ratio.toFixed(2));
      效果意图.结算参数.施放速度压制 = Number((ratio - 1).toFixed(2));
    }
    if (archetype === '掌控压制') {
      const ratio = randomInRange({ C: [0.92, 0.96], B: [0.84, 0.92], A: [0.74, 0.84], S: [0.62, 0.76] });
      效果意图.结算参数.掌控倍率 = Number(ratio.toFixed(2));
      效果意图.结算参数.命中压制 = Number((1 - ratio).toFixed(2));
    }
    if (archetype === '元素封禁') {
      const ratio = randomInRange({ A: [0.22, 0.34], S: [0.34, 0.5], 'S+': [0.5, 0.68] });
      效果意图.结算参数.元素封禁比例 = Number(ratio.toFixed(2));
      效果意图.结算参数.伤害倍率系数 = Number(Math.max(0.2, 1 - ratio).toFixed(2));
      效果意图.结算参数.消耗修正倍率 = Number((1 + ratio * 0.8).toFixed(2));
      效果意图.结算参数.前摇修正倍率 = Number((1 + ratio * 0.6).toFixed(2));
    }
    if (targetFactor < 1) 效果意图.持续回合 = Math.max(1, Math.round(效果意图.持续回合 * targetFactor));
    scaleStatMods(targetFactor);
  } else if (main === '增益类') {
    战斗.技能分类 = '辅助';
    效果意图.状态 = archetype;
    效果意图.持续回合 = { C: 2, B: 3, A: 3, S: 4 }[grade] || 3;
    if (archetype === '单属性增益') {
      const key = pickStatKey(attrs);
      效果意图.属性倍率[key] = randomInRange({ C: [1.08, 1.12], B: [1.15, 1.28], A: [1.3, 1.55], S: [1.6, 2.0] });
    } else if (archetype === '多属性增益') {
      const keys = pickStatKeys(attrs, 2);
      const ratio = randomInRange({ C: [1.05, 1.08], B: [1.1, 1.18], A: [1.18, 1.32], S: [1.3, 1.5] });
      keys.forEach(k => {
        效果意图.属性倍率[k] = ratio;
      });
    } else if (archetype === '全属性增益') {
      const ratio = randomInRange({ C: [1.02, 1.05], B: [1.06, 1.12], A: [1.12, 1.22], S: [1.22, 1.38] });
      ['str', 'def', 'agi', 'men_max', 'sp_max'].forEach(k => {
        效果意图.属性倍率[k] = ratio;
      });
    } else if (archetype === '威力增幅') {
      const ratio = randomInRange({ A: [1.18, 1.3], S: [1.3, 1.48], 'S+': [1.48, 1.7] });
      效果意图.结算参数.伤害倍率系数 = Number(ratio.toFixed(2));
    } else if (archetype === '技能效果增幅') {
      const ratio = randomInRange({ A: [1.25, 1.45], S: [1.45, 1.8], 'S+': [1.8, 2.2] });
      效果意图.结算参数.技能效果倍率 = Number(ratio.toFixed(2));
    } else if (archetype === '消耗') {
      const ratio = randomInRange({ C: [0.94, 0.97], B: [0.88, 0.95], A: [0.8, 0.9], S: [0.72, 0.84] });
      效果意图.结算参数.消耗修正倍率 = Number(ratio.toFixed(2));
    } else if (archetype === '前摇') {
      const ratio = randomInRange({ C: [0.94, 0.97], B: [0.88, 0.94], A: [0.8, 0.9], S: [0.72, 0.84] });
      效果意图.结算参数.前摇修正倍率 = Number(ratio.toFixed(2));
      效果意图.结算参数.施放速度加成 = Number((1 - ratio).toFixed(2));
    } else if (archetype === '掌控提升') {
      const ratio = randomInRange({ C: [1.05, 1.08], B: [1.08, 1.15], A: [1.15, 1.25], S: [1.25, 1.4] });
      效果意图.结算参数.掌控倍率 = Number(ratio.toFixed(2));
      效果意图.结算参数.命中加成 = Number((ratio - 1).toFixed(2));
    } else if (archetype === '速度提升') {
      const ratio = randomInRange({ C: [1.05, 1.08], B: [1.08, 1.14], A: [1.14, 1.22], S: [1.22, 1.35] });
      const bonus = Number((ratio - 1).toFixed(2));
      效果意图.结算参数.速度倍率 = Number(ratio.toFixed(2));
      效果意图.结算参数.攻击速度加成 = bonus;
      效果意图.结算参数.反应加成 = Number((bonus * 0.9).toFixed(2));
      效果意图.结算参数.闪避加成 = Number((bonus * 0.75).toFixed(2));
    }
    if (targetFactor < 1) 效果意图.持续回合 = Math.max(1, Math.round(效果意图.持续回合 * Math.max(0.8, targetFactor)));
    scaleStatMods(targetFactor);
  } else if (main === '防御类') {
    战斗.技能分类 = '防御';
    效果意图.状态 = archetype;
    效果意图.持续回合 = { C: 1, B: 2, A: 2, S: 3 }[grade] || 2;
    if (archetype === '护盾') {
      const mult = randomInRange({ C: [10, 15], B: [15, 22], A: [22, 32], S: [30, 45] });
      伤害意图.护盾数值 = Math.round(powerBase * mult * targetFactor);
    }
    if (archetype === '承伤修正') {
      const reduce = randomInRange({ C: [0.1, 0.15], B: [0.15, 0.25], A: [0.25, 0.4], S: [0.4, 0.6] });
      效果意图.结算参数.受到伤害降低 = Math.max(
        Number(效果意图.结算参数.受到伤害降低 || 0),
        Number((reduce * targetFactor).toFixed(2)),
      );
    }
    if (archetype === '霸体') {
      效果意图.结算参数.受到伤害降低 = Number(
        randomInRange({ C: [0.08, 0.12], B: [0.12, 0.18], A: [0.18, 0.25], S: [0.25, 0.35] }).toFixed(2),
      );
    }
    if (archetype === '免死/锁血') {
      效果意图.结算参数.生命保底 = 1;
      效果意图.结算参数.免死次数 = gradeFactor >= 4 ? 2 : 1;
    }
    if (archetype === '无敌金身') {
      效果意图.持续回合 = Math.max(效果意图.持续回合, { C: 1, B: 2, A: 3, S: 4 }[grade] || 2);
      const reduce = randomInRange({ C: [0.12, 0.16], B: [0.18, 0.24], A: [0.24, 0.34], S: [0.34, 0.45] });
      效果意图.结算参数.霸体 = true;
      效果意图.结算参数.受到伤害降低 = Number((reduce * Math.max(0.9, targetFactor)).toFixed(2));
      效果意图.结算参数.无视异常 = true;
    }
    if (archetype === '伤害反射') {
      效果意图.持续回合 = Math.max(效果意图.持续回合, { C: 1, B: 2, A: 3, S: 4 }[grade] || 2);
      const reflect = randomInRange({ C: [0.18, 0.26], B: [0.26, 0.36], A: [0.36, 0.5], S: [0.5, 0.65] });
      效果意图.结算参数.反伤比例 = Number((reflect * Math.max(0.9, targetFactor)).toFixed(2));
      效果意图.结算参数.受到伤害降低 = Math.max(
        Number(效果意图.结算参数.受到伤害降低 || 0),
        Number((reflect * 0.35).toFixed(2)),
      );
    }
    if (archetype === '伤害分摊') {
      效果意图.持续回合 = Math.max(效果意图.持续回合, { C: 1, B: 2, A: 3, S: 4 }[grade] || 2);
      const share = randomInRange({ C: [0.24, 0.3], B: [0.32, 0.42], A: [0.42, 0.55], S: [0.55, 0.7] });
      const shareCount = grade === 'S' ? 3 : gradeFactor >= 2 ? 2 : 1;
      效果意图.结算参数.伤害分摊比例 = Number((share * Math.max(0.9, targetFactor)).toFixed(2));
      效果意图.结算参数.伤害分摊数量 = shareCount;
    }
    if (archetype === '消耗分摊') {
      效果意图.持续回合 = Math.max(效果意图.持续回合, { C: 1, B: 2, A: 3, S: 4 }[grade] || 2);
      const share = randomInRange({ C: [0.2, 0.28], B: [0.28, 0.38], A: [0.38, 0.5], S: [0.5, 0.62] });
      const shareCount = grade === 'S' ? 3 : gradeFactor >= 2 ? 2 : 1;
      效果意图.结算参数.消耗分摊比例 = Number((share * Math.max(0.9, targetFactor)).toFixed(2));
      效果意图.结算参数.消耗分摊数量 = shareCount;
    }
    if (targetFactor < 1) 效果意图.持续回合 = Math.max(1, Math.round(效果意图.持续回合 * Math.max(0.8, targetFactor)));
  } else if (main === '回复类') {
    战斗.技能分类 = '辅助';
    if (archetype === '体力恢复')
      伤害意图.恢复比例 = Number(
        (randomInRange({ C: [8, 12], B: [12, 20], A: [20, 35], S: [35, 60] }) * targetFactor).toFixed(2),
      );
    if (archetype === '魂力恢复') {
      const restore = Math.round(randomInRange({ C: [5, 8], B: [8, 12], A: [12, 18], S: [18, 25] }) * targetFactor);
      效果意图.结算参数.魂力恢复比例 = Number((restore / 100).toFixed(2));
    }
    if (archetype === '精神恢复') {
      const restore = Math.round(randomInRange({ C: [5, 8], B: [8, 12], A: [12, 18], S: [18, 25] }) * targetFactor);
      效果意图.结算参数.精神恢复比例 = Number((restore / 100).toFixed(2));
    }
    if (archetype === '持续恢复') {
      效果意图.状态 = '持续恢复';
      效果意图.持续回合 = { C: 2, B: 3, A: 3, S: 4 }[grade] || 3;
      效果意图.持续伤害数值 = 0;
      伤害意图.恢复比例 = Number(
        (randomInRange({ C: [3, 5], B: [5, 7], A: [7, 10], S: [10, 15] }) * targetFactor).toFixed(2),
      );
    }
    if (targetFactor < 1)
      效果意图.持续回合 = Math.max(1, Math.round((效果意图.持续回合 || 0) * Math.max(0.8, targetFactor))) || 效果意图.持续回合;
  } else if (main === '感知/认知类') {
    战斗.技能分类 = '辅助';
    效果意图.状态 = archetype;
    效果意图.持续回合 = 2;
    if (archetype === '感知干扰') {
      效果意图.结算参数.命中压制 = Number(
        randomInRange({ C: [0.05, 0.1], B: [0.1, 0.16], A: [0.16, 0.24], S: [0.24, 0.35] }).toFixed(2),
      );
      效果意图.结算参数.反应压制 = Number(
        randomInRange({ C: [0.04, 0.08], B: [0.08, 0.12], A: [0.12, 0.2], S: [0.2, 0.28] }).toFixed(2),
      );
      if (gradeFactor >= 3) {
        效果意图.结算参数.施放速度压制 = Number(
          randomInRange({ A: [0.08, 0.14], S: [0.14, 0.22] }).toFixed(2),
        );
      }
    }
    if (archetype === '标记锁定') {
      效果意图.结算参数.锁定强度 = { C: 1, B: 1, A: 2, S: 3 }[grade] || 1;
      效果意图.结算参数.命中加成 = Number(
        randomInRange({ C: [0.05, 0.1], B: [0.1, 0.15], A: [0.15, 0.25], S: [0.25, 0.35] }).toFixed(2),
      );
      效果意图.结算参数.闪避压制 = Number(
        randomInRange({ C: [0.05, 0.08], B: [0.08, 0.12], A: [0.12, 0.18], S: [0.18, 0.25] }).toFixed(2),
      );
    }
    if (archetype === '共享视野') {
      效果意图.结算参数.反应加成 = Number(
        randomInRange({ C: [0.05, 0.1], B: [0.1, 0.15], A: [0.15, 0.25], S: [0.25, 0.35] }).toFixed(2),
      );
      效果意图.结算参数.命中加成 = Number(
        randomInRange({ C: [0.05, 0.1], B: [0.1, 0.15], A: [0.15, 0.25], S: [0.25, 0.35] }).toFixed(2),
      );
      效果意图.结算参数.锁定强度 = { C: 1, B: 1, A: 2, S: 2 }[grade] || 1;
    }
    if (archetype === '幻境') {
      const generalRatio = randomInRange({ C: [0.93, 0.97], B: [0.88, 0.94], A: [0.8, 0.9], S: [0.68, 0.85] });
      const agiRatio = randomInRange({ C: [0.9, 0.95], B: [0.82, 0.9], A: [0.72, 0.82], S: [0.6, 0.75] });
      效果意图.属性倍率.str = generalRatio;
      效果意图.属性倍率.def = generalRatio;
      效果意图.属性倍率.men_max = generalRatio;
      效果意图.属性倍率.agi = agiRatio;
      效果意图.结算参数.反应压制 = Number(
        randomInRange({ C: [0.05, 0.1], B: [0.1, 0.2], A: [0.2, 0.35], S: [0.35, 0.5] }).toFixed(2),
      );
      if (gradeFactor >= 3) {
        效果意图.结算参数.跳过回合 = true;
        效果意图.结算参数.无法反应 = true;
      }
    }
    if (archetype === '催眠') {
      效果意图.结算参数.跳过回合 = true;
      效果意图.结算参数.无法反应 = true;
    }
    if (archetype === '认知扭曲') {
      效果意图.结算参数.命中压制 = Number(
        randomInRange({ C: [0.08, 0.12], B: [0.12, 0.18], A: [0.18, 0.26], S: [0.26, 0.36] }).toFixed(2),
      );
      效果意图.结算参数.命中压制 = Number(
        randomInRange({ C: [0.05, 0.08], B: [0.08, 0.12], A: [0.12, 0.18], S: [0.18, 0.26] }).toFixed(2),
      );
      效果意图.结算参数.施放速度压制 = Number(
        randomInRange({ C: [0.04, 0.08], B: [0.08, 0.12], A: [0.12, 0.18], S: [0.18, 0.24] }).toFixed(2),
      );
      效果意图.结算参数.随机索敌率 = Number(
        randomInRange({ C: [0.12, 0.2], B: [0.2, 0.3], A: [0.3, 0.42], S: [0.42, 0.56] }).toFixed(2),
      );
    }
  } else if (main === '位移类') {
    战斗.技能分类 = '辅助';
    效果意图.状态 = archetype;
    效果意图.持续回合 = ['位移交换'].includes(archetype) ? 2 : 1;
    if (archetype === '自身位移') {
      效果意图.结算参数.闪避加成 = Number(
        randomInRange({ C: [0.05, 0.08], B: [0.08, 0.12], A: [0.12, 0.18], S: [0.18, 0.25] }).toFixed(2),
      );
      效果意图.结算参数.攻击速度加成 = Number(
        randomInRange({ C: [0.03, 0.05], B: [0.05, 0.08], A: [0.08, 0.12], S: [0.12, 0.18] }).toFixed(2),
      );
      效果意图.结算参数.反应加成 = Number(
        randomInRange({ C: [0.03, 0.05], B: [0.05, 0.08], A: [0.08, 0.12], S: [0.12, 0.18] }).toFixed(2),
      );
    }
    if (archetype === '强制位移') {
      效果意图.结算参数.闪避压制 = Number(
        randomInRange({ C: [0.05, 0.08], B: [0.08, 0.12], A: [0.12, 0.18], S: [0.18, 0.25] }).toFixed(2),
      );
      效果意图.结算参数.反应压制 = Number(
        randomInRange({ C: [0.03, 0.05], B: [0.05, 0.08], A: [0.08, 0.12], S: [0.12, 0.18] }).toFixed(2),
      );
      效果意图.结算参数.锁定强度 = { C: 1, B: 1, A: 2, S: 2 }[grade] || 1;
    }
    if (archetype === '位移交换') {
      效果意图.结算参数.闪避压制 = Number(
        randomInRange({ C: [0.08, 0.12], B: [0.12, 0.18], A: [0.18, 0.25], S: [0.25, 0.35] }).toFixed(2),
      );
      效果意图.结算参数.反应压制 = Number(
        randomInRange({ C: [0.05, 0.08], B: [0.08, 0.12], A: [0.12, 0.18], S: [0.18, 0.25] }).toFixed(2),
      );
      效果意图.结算参数.锁定强度 = { C: 1, B: 2, A: 2, S: 3 }[grade] || 1;
    }
    if (archetype === '追击位移') {
      效果意图.结算参数.攻击速度加成 = Number(
        randomInRange({ C: [0.05, 0.08], B: [0.08, 0.12], A: [0.12, 0.18], S: [0.18, 0.25] }).toFixed(2),
      );
      效果意图.结算参数.命中加成 = Number(
        randomInRange({ C: [0.05, 0.08], B: [0.08, 0.12], A: [0.12, 0.18], S: [0.18, 0.25] }).toFixed(2),
      );
      效果意图.结算参数.伤害倍率系数 = Number(
        randomInRange({ C: [1.05, 1.12], B: [1.12, 1.2], A: [1.2, 1.3], S: [1.3, 1.45] }).toFixed(2),
      );
    }
    if (archetype === '脱离位移') {
      效果意图.结算参数.闪避加成 = Number(
        randomInRange({ C: [0.08, 0.12], B: [0.12, 0.18], A: [0.18, 0.25], S: [0.25, 0.35] }).toFixed(2),
      );
      效果意图.结算参数.施放速度加成 = Number(
        randomInRange({ C: [0.03, 0.05], B: [0.05, 0.08], A: [0.08, 0.12], S: [0.12, 0.18] }).toFixed(2),
      );
      效果意图.结算参数.反应加成 = Number(
        randomInRange({ C: [0.05, 0.08], B: [0.08, 0.12], A: [0.12, 0.18], S: [0.18, 0.25] }).toFixed(2),
      );
    }
  } else if (main === '特殊规则类') {
    战斗.技能分类 = '辅助';
    效果意图.状态 = archetype;
    效果意图.持续回合 = 2;
    if (archetype === '强制绑定/锁定') {
      战斗.技能分类 = '控制';
      效果意图.持续回合 = { C: 1, B: 2, A: 2, S: 3 }[grade] || 2;
      效果意图.结算参数.锁定强度 = { C: 1, B: 2, A: 2, S: 3 }[grade] || 1;
      效果意图.结算参数.闪避压制 = Number(
        randomInRange({ C: [0.05, 0.08], B: [0.08, 0.12], A: [0.12, 0.18], S: [0.18, 0.25] }).toFixed(2),
      );
      效果意图.结算参数.反应压制 = Number(
        randomInRange({ C: [0.05, 0.08], B: [0.08, 0.12], A: [0.12, 0.18], S: [0.18, 0.25] }).toFixed(2),
      );
    }
    if (archetype === '反制') {
      战斗.技能分类 = '防御';
      效果意图.持续回合 = { C: 1, B: 2, A: 2, S: 3 }[grade] || 2;
      效果意图.结算参数.反击倍率 = Number(
        randomInRange({ C: [0.35, 0.5], B: [0.5, 0.75], A: [0.75, 1.0], S: [1.0, 1.25] }).toFixed(2),
      );
      效果意图.结算参数.受到伤害降低 = Number(
        randomInRange({ C: [0.08, 0.12], B: [0.12, 0.18], A: [0.18, 0.25], S: [0.25, 0.35] }).toFixed(2),
      );
    }
    if (archetype === '转化') {
      战斗.技能分类 = '输出';
      效果意图.持续回合 = 0;
      伤害意图.威力倍率 = Math.max(
        Number(伤害意图.威力倍率 || 0),
        Math.round(powerBase * randomInRange({ C: [0.55, 0.75], B: [0.75, 1.0], A: [1.0, 1.25], S: [1.25, 1.55] })),
      );
      伤害意图.伤害类型 = 伤害意图.伤害类型 === '无' ? getDamageType() : 伤害意图.伤害类型;
      效果意图.结算参数.伤害转治疗比例 = Number(
        randomInRange({ C: [0.08, 0.12], B: [0.12, 0.18], A: [0.18, 0.25], S: [0.25, 0.35] }).toFixed(2),
      );
    }
    if (archetype === '吞噬') {
      战斗.技能分类 = '控制';
      效果意图.持续回合 = 0;
    }
    if (archetype === '能力共享') {
      战斗.技能分类 = '辅助';
      效果意图.持续回合 = 0;
    }
    if (archetype === '机制抹消') {
      战斗.技能分类 = '控制';
      效果意图.持续回合 = { F: 1, D: 1, C: 1, B: 2, A: 2, S: 3, 'S+': 4 }[grade] || 2;
    }
    if (archetype === '复制') {
      战斗.技能分类 = '辅助';
      效果意图.持续回合 = { C: 1, B: 2, A: 2, S: 3 }[grade] || 2;
    }
    if (archetype === '召唤') {
      战斗.技能分类 = '辅助';
      战斗.对象 = '自身';
      const 召唤数量 = Math.min({ F: 1, D: 1, C: 2, B: 3, A: 5, S: 8, 'S+': 12 }[grade] || 3, Math.max(1, gradeFactor + 1));
      const 召唤强度 = Number(({ F: 0.45, D: 0.55, C: 0.7, B: 0.9, A: 1.1, S: 1.35, 'S+': 1.65 }[grade] || 0.9).toFixed(2));
      效果意图.状态 = '召唤物';
      效果意图.持续回合 = { F: 1, D: 1, C: 2, B: 3, A: 4, S: 5, 'S+': 6 }[grade] || 3;
      效果意图.召唤元数据 = {
        召唤单位类型: 召唤数量 > 1 ? '其他召唤生物' : '魂兽',
        召唤物名称: '待命召唤物',
        召唤数量,
        强度: 召唤强度,
        行动模式: type === '防御系' ? '护卫' : '协同攻击',
        承伤规则: type === '防御系' ? '可承伤' : '不替主承伤',
      };
      效果意图.结算参数.伤害倍率系数 = Number(Math.min(1.45, 1 + 召唤强度 * 0.12 + 召唤数量 * 0.03).toFixed(2));
      if (效果意图.召唤元数据.承伤规则 === '可承伤') 效果意图.结算参数.受到伤害降低 = Number(Math.min(0.28, 召唤强度 * 0.08).toFixed(2));
    }
    if (archetype === '分身') {
      战斗.技能分类 = '辅助';
      战斗.对象 = '自身';
      const cloneType =
        type === '精神系' || type === '控制系'
          ? '精神力分身'
          : type === '敏攻系' || type === '强攻系'
            ? '物理分身'
            : gradeFactor >= 3
              ? '精神力分身'
              : '物理分身';
      const cloneCount = Math.min(4, Math.max(1, gradeFactor >= 4 ? 3 : gradeFactor >= 2 ? 2 : 1));
      const stealth = randomInRange({ C: [0.25, 0.38], B: [0.38, 0.52], A: [0.52, 0.68], S: [0.68, 0.85] });
      const inheritRatio = randomInRange({ C: [0.35, 0.45], B: [0.45, 0.6], A: [0.6, 0.78], S: [0.78, 0.9] });
      效果意图.状态 = cloneType;
      效果意图.持续回合 = { C: 1, B: 2, A: 2, S: 3 }[grade] || 2;
      效果意图.分身元数据 = {
        分身类型: cloneType,
        分身数量: cloneCount,
        隐蔽度: Number(stealth.toFixed(2)),
        实力继承比例: Number(inheritRatio.toFixed(2)),
      };
      if (cloneType === '精神力分身') {
        效果意图.结算参数.反应加成 = Number(Math.min(0.28, 0.04 + stealth * 0.16 + inheritRatio * 0.08).toFixed(2));
        效果意图.结算参数.命中加成 = Number(Math.min(0.3, 0.04 + inheritRatio * 0.15 + cloneCount * 0.03).toFixed(2));
        效果意图.结算参数.锁定强度 = Math.min(3, Math.max(1, Math.round(1 + inheritRatio * 1.2 + stealth * 0.8)));
        效果意图.结算参数.受到伤害降低 = Number(Math.min(0.18, 0.02 + stealth * 0.05 + cloneCount * 0.01).toFixed(2));
      } else {
        效果意图.结算参数.闪避加成 = Number(Math.min(0.35, 0.05 + stealth * 0.18 + inheritRatio * 0.08 + cloneCount * 0.03).toFixed(2));
        效果意图.结算参数.攻击速度加成 = Number(Math.min(0.24, 0.03 + inheritRatio * 0.12 + cloneCount * 0.02).toFixed(2));
        效果意图.结算参数.受到伤害降低 = Number(Math.min(0.22, 0.02 + stealth * 0.08 + cloneCount * 0.015).toFixed(2));
        效果意图.结算参数.伤害倍率系数 = Number(Math.min(1.28, 1 + inheritRatio * 0.12 + Math.max(0, cloneCount - 1) * 0.04).toFixed(2));
      }
    }
    if (archetype === '状态交换') {
      战斗.技能分类 = '辅助';
      效果意图.持续回合 = 0;
    }
    if (archetype === '规则改写') {
      战斗.技能分类 = '控制';
      效果意图.持续回合 = { S: 1, 'S+': 2 }[grade] || 1;
    }
    if (archetype === '炸环') {
      战斗.技能分类 = '辅助';
      战斗.对象 = '自身';
      效果意图.状态 = '炸环';
      效果意图.持续回合 = 0;
    }
    if (archetype === '时光回溯') {
      战斗.技能分类 = '防御';
      战斗.对象 = '自身';
      效果意图.状态 = '时光回溯';
      效果意图.持续回合 = 1;
    }
    if (archetype === '气运干涉') {
      战斗.技能分类 = '辅助';
      效果意图.状态 = '气运干涉';
      效果意图.持续回合 = { A: 2, S: 3, 'S+': 4 }[grade] || 2;
      效果意图.结算参数.判断干扰强度 = Number(randomInRange({ A: [0.08, 0.14], S: [0.14, 0.22], 'S+': [0.22, 0.32] }).toFixed(2));
    }
  }

  if (secondary.includes('穿透')) {
    const pierceBase = quality === 'S级_极品' ? 50 : quality === 'A级_优秀' ? 35 : quality === 'B级_普通' ? 20 : 10;
    伤害意图.防御穿透 = Math.max(伤害意图.防御穿透, Math.max(1, Math.round(pierceBase * secondaryEffectScale)));
  }
  if (secondary.includes('伤害吸收')) {
    const leechBase = quality === 'S级_极品' ? 35 : quality === 'A级_优秀' ? 20 : quality === 'B级_普通' ? 10 : 5;
    伤害意图.恢复比例 = Math.max(伤害意图.恢复比例, Math.max(1, Math.round(leechBase * secondaryEffectScale)));
  }
  if (secondary.includes('流血DOT')) {
    效果意图.状态 = 效果意图.状态 === '无' ? '流血' : 效果意图.状态;
    效果意图.持续回合 = Math.max(效果意图.持续回合, 2);
    效果意图.持续伤害数值 = Math.max(效果意图.持续伤害数值, Math.max(1, Math.round(powerBase * 0.18 * secondaryEffectScale)));
    效果意图.结算参数.持续伤害数值 = Math.max(Number(效果意图.结算参数.持续伤害数值 || 0), Number(效果意图.持续伤害数值 || 0));
  }
  if (secondary.includes('小护盾'))
    伤害意图.护盾数值 = Math.max(伤害意图.护盾数值, Math.max(1, Math.round(powerBase * 1.2 * secondaryEffectScale)));
  if (secondary.includes('斩杀补伤')) {
    const executeThreshold = { C: 15, B: 20, A: 25, S: 30 }[grade] || 20;
    const executeBonusBase =
      { C: 10, B: 15, A: Math.round(randomRangeRaw(20, 30)), S: Math.round(randomRangeRaw(30, 50)) }[grade] || 15;
    const executeBonus = Math.max(5, Math.round(executeBonusBase * secondaryEffectScale));
    效果意图.结算参数.伤害倍率系数 = Math.max(
      Number((1 + executeBonus / 100).toFixed(2)),
      效果意图.结算参数.伤害倍率系数 || 1.0,
    );
  }
  if (secondary.includes('反击')) {
    效果意图.结算参数.反击倍率 = Math.max(
      Number(效果意图.结算参数.反击倍率 || 0),
      Number(((gradeFactor >= 3 ? 1.0 : 0.5) * Math.max(0.02, secondaryEffectScale)).toFixed(2)),
    );
  }
  if (secondary.includes('沉默')) {
    效果意图.状态 = 效果意图.状态 === '无' ? '沉默' : 效果意图.状态;
    效果意图.持续回合 = Math.max(
      效果意图.持续回合,
      Math.max(
        1,
        Math.round(
          ({ C: 1, B: Math.round(randomRangeRaw(1, 2)), A: 2, S: Math.round(randomRangeRaw(2, 3)) }[grade] || 1) *
            secondaryDurationScale,
        ),
      ),
    );
  }
  if (secondary.includes('减速') || secondary.includes('迟缓')) {
    效果意图.状态 = 效果意图.状态 === '无' ? (secondary.includes('迟缓') ? '迟缓' : '减速') : 效果意图.状态;
    效果意图.持续回合 = Math.max(
      效果意图.持续回合,
      Math.max(1, Math.round(({ C: 1, B: 2, A: 3, S: 3 }[grade] || 2) * secondaryDurationScale)),
    );
    效果意图.属性倍率.agi = Math.min(
      效果意图.属性倍率.agi,
      randomInRange({ C: [0.92, 0.96], B: [0.85, 0.92], A: [0.75, 0.85], S: [0.65, 0.78] }),
    );
  }
  if (secondary.includes('致盲')) {
    效果意图.状态 = 效果意图.状态 === '无' ? '致盲' : 效果意图.状态;
    效果意图.持续回合 = Math.max(
      效果意图.持续回合,
      Math.max(1, Math.round(({ C: 1, B: 1, A: 2, S: 2 }[grade] || 1) * secondaryDurationScale)),
    );
    效果意图.结算参数.致盲 = true;
  }
  if (secondary.includes('标记弱点')) {
    const weaknessDuration = Math.max(1, Math.round(({ C: 1, B: 2, A: 3, S: 4 }[grade] || 1) * secondaryDurationScale));
    const weaknessStrip = Number(
      (({ C: 0.1, B: 0.15, A: 0.2, S: 0.3 }[grade] || 0.15) * secondaryEffectScale).toFixed(2),
    );
    效果意图.状态 = 效果意图.状态 === '无' ? '标记弱点' : 效果意图.状态;
    效果意图.持续回合 = Math.max(效果意图.持续回合, weaknessDuration);
    效果意图.结算参数.防御剥夺比例 = Math.max(Number(效果意图.结算参数.防御剥夺比例 || 0), weaknessStrip);
    效果意图.结算参数.精神抗性剥夺比例 = Math.max(Number(效果意图.结算参数.精神抗性剥夺比例 || 0), weaknessStrip);
  }
  if (secondary.includes('目标锁定')) {
    const lockDuration = Math.max(1, Math.round(({ C: 1, B: 2, A: 2, S: 3 }[grade] || 1) * secondaryDurationScale));
    const lockHitBonus = Number(
      (({ C: 0.04, B: 0.07, A: 0.1, S: 0.14 }[grade] || 0.07) * secondaryEffectScale).toFixed(2),
    );
    const lockLevel = Math.max(1, Math.round(({ C: 1, B: 1, A: 2, S: 2 }[grade] || 1) * secondaryDurationScale));
    效果意图.状态 = 效果意图.状态 === '无' ? '目标锁定' : 效果意图.状态;
    效果意图.持续回合 = Math.max(效果意图.持续回合, lockDuration);
    效果意图.结算参数.命中加成 = Math.max(Number(效果意图.结算参数.命中加成 || 0), lockHitBonus);
    效果意图.结算参数.锁定强度 = Math.max(Number(效果意图.结算参数.锁定强度 || 0), lockLevel);
  }
  if (secondary.includes('隐身')) {
    const stealthDuration = Math.max(1, Math.round(({ C: 1, B: 2, A: 2, S: 3 }[grade] || 1) * secondaryDurationScale));
    效果意图.状态 = 效果意图.状态 === '无' ? '隐身' : 效果意图.状态;
    效果意图.持续回合 = Math.max(效果意图.持续回合, stealthDuration);
    效果意图.结算参数.隐匿等级 = 1;
  }
  if (secondary.includes('护卫')) {
    const guardDuration = Math.max(1, Math.round(({ C: 1, B: 2, A: 2, S: 3 }[grade] || 1) * secondaryDurationScale));
    const guardReduction = Number(
      (({ C: 0.06, B: 0.1, A: 0.14, S: 0.18 }[grade] || 0.1) * secondaryEffectScale).toFixed(2),
    );
    效果意图.状态 = 效果意图.状态 === '无' ? '护卫' : 效果意图.状态;
    效果意图.持续回合 = Math.max(效果意图.持续回合, guardDuration);
    效果意图.结算参数.受到伤害降低 = Math.max(Number(效果意图.结算参数.受到伤害降低 || 0), guardReduction);
  }
  if (secondary.includes('嘲讽')) {
    const tauntDuration = Math.max(1, Math.round(({ C: 1, B: 1, A: 2, S: 2 }[grade] || 1) * secondaryDurationScale));
    效果意图.状态 = 效果意图.状态 === '无' ? '嘲讽' : 效果意图.状态;
    效果意图.持续回合 = Math.max(效果意图.持续回合, tauntDuration);
  }
  if (secondary.includes('追击')) {
    const chaseDuration = Math.max(1, Math.round(({ C: 1, B: 1, A: 2, S: 2 }[grade] || 1) * secondaryDurationScale));
    const chaseHitBonus = Number(
      (({ C: 0.03, B: 0.06, A: 0.09, S: 0.12 }[grade] || 0.06) * secondaryEffectScale).toFixed(2),
    );
    const chaseSpeedBonus = Number(
      (({ C: 0.03, B: 0.05, A: 0.08, S: 0.1 }[grade] || 0.05) * secondaryEffectScale).toFixed(2),
    );
    const chaseDamageMult = Number(
      (1 + ({ C: 0.04, B: 0.06, A: 0.1, S: 0.14 }[grade] || 0.06) * secondaryEffectScale).toFixed(2),
    );
    效果意图.状态 = 效果意图.状态 === '无' ? '追击' : 效果意图.状态;
    效果意图.持续回合 = Math.max(效果意图.持续回合, chaseDuration);
    效果意图.结算参数.命中加成 = Math.max(Number(效果意图.结算参数.命中加成 || 0), chaseHitBonus);
    效果意图.结算参数.攻击速度加成 = Math.max(Number(效果意图.结算参数.攻击速度加成 || 0), chaseSpeedBonus);
    效果意图.结算参数.伤害倍率系数 = Math.max(Number(效果意图.结算参数.伤害倍率系数 || 1), chaseDamageMult);
  }
  if (secondary.includes('无敌金身')) {
    const goldenDuration = Math.max(1, Math.round(({ C: 1, B: 1, A: 1, S: 2 }[grade] || 1) * Math.max(0.75, secondaryDurationScale)));
    效果意图.状态 = 效果意图.状态 === '无' ? '无视异常' : 效果意图.状态;
    效果意图.持续回合 = Math.max(效果意图.持续回合, goldenDuration);
    效果意图.结算参数.霸体 = true;
    效果意图.结算参数.受到伤害降低 = Math.max(Number(效果意图.结算参数.受到伤害降低 || 0), Number(({ C: 0.05, B: 0.08, A: 0.12, S: 0.18 }[grade] || 0.08)));
    效果意图.结算参数.无视异常 = true;
  }
  if (secondary.includes('伤害反射')) {
    const reflectDuration = Math.max(1, Math.round(({ C: 1, B: 1, A: 2, S: 2 }[grade] || 1) * Math.max(0.75, secondaryDurationScale)));
    const reflectRatio = Number((({ C: 0.1, B: 0.16, A: 0.24, S: 0.36 }[grade] || 0.16) * secondaryEffectScale).toFixed(2));
    效果意图.状态 = 效果意图.状态 === '无' ? '伤害反射' : 效果意图.状态;
    效果意图.持续回合 = Math.max(效果意图.持续回合, reflectDuration);
    效果意图.结算参数.反伤比例 = Math.max(Number(效果意图.结算参数.反伤比例 || 0), reflectRatio);
  }
  if (secondary.includes('伤害分摊')) {
    const shareDuration = Math.max(1, Math.round(({ C: 1, B: 1, A: 2, S: 2 }[grade] || 1) * Math.max(0.75, secondaryDurationScale)));
    const shareRatio = Number((({ C: 0.14, B: 0.22, A: 0.3, S: 0.4 }[grade] || 0.22) * secondaryEffectScale).toFixed(2));
    const shareCount = 1;
    效果意图.状态 = 效果意图.状态 === '无' ? '伤害分摊' : 效果意图.状态;
    效果意图.持续回合 = Math.max(效果意图.持续回合, shareDuration);
    效果意图.结算参数.伤害分摊比例 = Math.max(Number(效果意图.结算参数.伤害分摊比例 || 0), shareRatio);
    效果意图.结算参数.伤害分摊数量 = Math.max(Number(效果意图.结算参数.伤害分摊数量 || 0), shareCount);
  }
  if (secondary.includes('消耗分摊')) {
    const shareDuration = Math.max(1, Math.round(({ C: 1, B: 1, A: 2, S: 2 }[grade] || 1) * Math.max(0.75, secondaryDurationScale)));
    const shareRatio = Number((({ C: 0.12, B: 0.18, A: 0.26, S: 0.34 }[grade] || 0.18) * secondaryEffectScale).toFixed(2));
    const shareCount = 1;
    效果意图.状态 = 效果意图.状态 === '无' ? '消耗分摊' : 效果意图.状态;
    效果意图.持续回合 = Math.max(效果意图.持续回合, shareDuration);
    效果意图.结算参数.消耗分摊比例 = Math.max(Number(效果意图.结算参数.消耗分摊比例 || 0), shareRatio);
    效果意图.结算参数.消耗分摊数量 = Math.max(Number(效果意图.结算参数.消耗分摊数量 || 0), shareCount);
  }
  if (secondary.includes('治疗反转')) {
    const invertDuration = Math.max(1, Math.round(({ C: 1, B: 1, A: 2, S: 2 }[grade] || 1) * secondaryDurationScale));
    const invertRatio = Number((({ C: 1.0, B: 1.0, A: 1.15, S: 1.3 }[grade] || 1.0) * secondaryEffectScale).toFixed(2));
    效果意图.状态 = 效果意图.状态 === '无' ? '治疗反转' : 效果意图.状态;
    效果意图.持续回合 = Math.max(效果意图.持续回合, invertDuration);
    效果意图.结算参数.治疗反转比例 = Math.max(Number(效果意图.结算参数.治疗反转比例 || 0), invertRatio);
  }
  if (secondary.includes('封技')) {
    const sealDuration = Math.max(1, Math.round(({ C: 1, B: 1, A: 2, S: 2 }[grade] || 1) * secondaryDurationScale));
    效果意图.状态 = 效果意图.状态 === '无' ? '封技' : 效果意图.状态;
    效果意图.持续回合 = Math.max(效果意图.持续回合, sealDuration);
    效果意图.结算参数.封技 = true;
  }

  const 初始倍率 = 读取自动生成初始消耗前摇倍率_V1(blueprint, { ...qualityCtx, grade });
  战斗.消耗 = 构建魂技消耗结构_V1(fuelModel, 50 * 初始倍率.消耗倍率, ringIndex);
  战斗.前摇 = Math.max(1, Math.round(获取标准前摇_V1() * 初始倍率.前摇倍率));

  return 战斗;
}

function isSkillTodoText(text) {
  const value = String(text || '').trim();
  return !value || value === '未知' || /待补全|AI_TODO/i.test(value);
}

function clonePackedSkillEffects(effects) {
  return JSON.parse(JSON.stringify(Array.isArray(effects) ? effects : []));
}

function isSkillSummaryEffect(effect = {}) {
  void effect;
  return false;
}

function getSkillSummaryEffects(packedEffects) {
  void packedEffects;
  return [];
}

function getSkillSummaryEffectByMechanism(packedEffects, mechanism = '') {
  void packedEffects;
  void mechanism;
  return null;
}

function getMeaningfulSkillEffects(packedEffects) {
  return (Array.isArray(packedEffects) ? packedEffects : []).filter(
    effect =>
      effect &&
      typeof effect === 'object' &&
      (String(effect.原型 || '').trim() || (!String(effect.原型 || '').trim() && Array.isArray(effect.使用效果))),
  );
}

function buildSkillTargetLabel(target) {
  const normalizedTarget = 归一化执行效果目标_V1(target, String(target || '目标'));
  const map = {
    自身: '自身',
    单体: '单体目标',
    群体: '群体目标',
    友方单体: '己方单体目标',
    友方群体: '己方群体',
    敌方单体: '敌方单体目标',
    敌方群体: '敌方群体',
    全场: '全场（不分敌我）',
    召唤物: '召唤物',
    分身: '分身',
  };
  return map[normalizedTarget] || String(normalizedTarget || target || '目标');
}

function formatTickToCalendarDateText(tickValue) {
  const safeTick = Math.max(0, Number(tickValue || 0));
  const totalMinutes = safeTick * 10;
  const days = Math.floor(totalMinutes / (24 * 60));
  const years = Math.floor(days / 360);
  const months = Math.floor((days % 360) / 30) + 1;
  const currentDay = (days % 30) + 1;
  const remainderMinutes = totalMinutes % (24 * 60);
  const hours = Math.floor(remainderMinutes / 60);
  const mins = remainderMinutes % 60;
  return `斗罗历${years}年${months}月${currentDay}日 ${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function formatTickToCalendarDateTimeText(tickValue) {
  return formatTickToCalendarDateText(tickValue);
}

function formatTickDurationAsDayText(tickValue) {
  const safeTick = Math.max(0, Number(tickValue || 0));
  const totalMinutes = Math.max(10, Math.round(safeTick * 10));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const mins = totalMinutes % 60;
  if (days > 0) {
    return hours > 0 ? `${days}天${hours}小时` : `${days}天`;
  }
  if (hours > 0) {
    if (mins > 0) return `${hours}小时${mins}分钟`;
    return `${hours}小时`;
  }
  if (mins === 30) return '半小时';
  return `${mins}分钟`;
}

function buildConstructExpiryText(durationTick = 0, expiryTick = 0) {
  const absoluteTick = Math.max(0, Number(expiryTick || 0));
  if (absoluteTick > 0) return `有效期至${formatTickToCalendarDateText(absoluteTick)}`;
  const duration = Math.max(0, Number(durationTick || 0));
  if (duration > 0) return `约可保留${formatTickDurationAsDayText(duration)}`;
  return '';
}

function shouldWrapSkillEffectAsGrant(effect = {}) {
  const 原型 = String(effect?.原型 || '').trim();
  if (!原型 || 原型 === '机制授予') return false;
  if (
    [
      '属性修正',
      '资源变化',
      '护盾变化',
      '结算修正',
      '修炼增益',
    ].includes(原型)
  )
    return false;
  const 原型定义 = SKILL_PROTOTYPE_REGISTRY_V1[原型] || {};
  return ['敌对', '上下文', '仅自身'].includes(String(原型定义.默认方向 || '').trim());
}

function 食物造物效果为正向数值_V1(effect = {}) {
  const 原始数值 = 规范化执行效果数值_V1(effect?.数值, effect?.动作 || '');
  const 数值 = parseSkillSignedChangeNumber(原始数值);
  return Number.isFinite(数值) && 数值 > 0 && !/^-/.test(String(原始数值 || '').trim());
}

// 结算修正的增益方向表：符号结算按 数值×方向>0 判增益；集合内结算为正向百分比防御/输出增益。
// 反击（仅限后续触发槽位）与 持续伤害引爆（需要敌方DOT时机）刻意排除，必须继续走机制授予壳。
var 结算修正符号增益方向表_V1 = Object.freeze({ 造成伤害: 1, 治疗: 1, 技能效果: 1, 受到伤害: -1, 消耗: -1, 前摇: -1 });
var 结算修正正向增益结算集合_V1 = new Set(['反伤', '伤害转移', '伤害吸收', '伤害转治疗', '防御穿透']);

function 结算修正是否增益语义_V1(effect = {}) {
  const 结算 = String(effect?.结算 || '').trim();
  if (结算修正正向增益结算集合_V1.has(结算)) return true;
  const 方向 = Number(结算修正符号增益方向表_V1[结算] || 0);
  if (!方向) return false;
  const 数值 = parseSkillSignedChangeNumber(effect?.数值);
  return Number.isFinite(数值) && 数值 * 方向 > 0;
}

function 判定修正是否增益语义_V1(effect = {}) {
  if (effect?.打断效果 === true) return false;
  const 数值 = parseSkillSignedChangeNumber(effect?.数值);
  return Number.isFinite(数值) && 数值 > 0;
}

function 食物造物效果可直接食用_V1(effect = {}) {
  const 原型 = String(effect?.原型 || '').trim();
  const 目标 = String(effect?.目标 || '').trim();
  const 自身目标 = !目标 || 目标 === '自身';
  if (原型 === '资源变化' || 原型 === '属性修正' || 原型 === '护盾变化') return 食物造物效果为正向数值_V1(effect);
  if (原型 === '状态移除') return true;
  if (原型 === '状态施加') return !状态施加是否负面语义_V1(effect?.状态);
  if (原型 === '结算修正') return 自身目标 && 结算修正是否增益语义_V1(effect);
  if (原型 === '判定修正') return 自身目标 && 判定修正是否增益语义_V1(effect);
  if (原型 === '规则防御') return 自身目标;
  return 原型 === '机制授予';
}

function 食物造物授予效果_V1(effect = {}) {
  const next = cloneJsonValue(effect, {});
  const 原型 = String(next?.原型 || '').trim();
  if (
    String(next.目标 || '').trim() === '自身' &&
    (
      (原型 === '状态施加' && 状态施加是否负面语义_V1(next?.状态)) ||
      ['判定修正', '决策干扰', '资源锁定', '结算修正', '资源转移', '位移执行'].includes(原型)
    )
  ) {
    next.目标 = '单体';
  }
  return next;
}

function buildCreationUsageEffects(packedEffects, type = '') {
  const 效果列表 = clonePackedSkillEffects(getMeaningfulSkillEffects(packedEffects))
    .map(effect => {
      if (!effect || typeof effect !== 'object') return effect;
      return { ...effect };
    });
  if (String(type || '').trim() !== '食物系') return 效果列表;
  const 输出列表 = [];
  const 授予效果列表 = [];
  效果列表.forEach(effect => {
    if (!effect || typeof effect !== 'object') return;
    if (食物造物效果可直接食用_V1(effect)) {
      输出列表.push(effect);
      return;
    }
    const 原型 = String(effect?.原型 || '').trim();
    if (!机制授予允许授予原型集合_V1.has(原型)) {
      throw new Error(`技能生成错误:食物造物不能把${原型 || '空原型'}作为食用效果`);
    }
    授予效果列表.push(食物造物授予效果_V1(effect));
  });
  if (授予效果列表.length) {
    输出列表.push({
      原型: '机制授予',
      目标: '自身',
      生效方式: '独立生效',
      触发条件: '主动触发',
      可用次数: 1,
      持续回合: 1,
      授予效果: 授予效果列表,
    });
  }
  return 输出列表;
}

function wrapGrantableRuntimeEffectsForSupport(packedEffects = [], type = '强攻系', skillName = '') {
  if (!['辅助系', '食物系'].includes(String(type || '').trim())) return false;
  const 系别 = String(type || '').trim();
  const 有效效果列表 = clonePackedSkillEffects(getMeaningfulSkillEffects(packedEffects));
  const 可授予效果列表 = 有效效果列表
    .filter(效果 => 机制授予允许授予原型集合_V1.has(String(效果?.原型 || '').trim()));
  if (!可授予效果列表.length) return false;
  const 食物需要授予 = 效果 => {
    const 原型 = String(效果?.原型 || '').trim();
    if (['复制执行', '时光回溯'].includes(原型)) return true;
    if (String(效果?.目标 || '').trim() === '自身') return false;
    return shouldWrapSkillEffectAsGrant(效果);
  };
  const 需要授予 = 系别 === '食物系' ? 食物需要授予 : shouldWrapSkillEffectAsGrant;
  const 授予效果 = 可授予效果列表.filter(需要授予);
  if (!授予效果.length) return false;
  packedEffects.length = 0;
  if (系别 === '食物系') {
    有效效果列表.forEach(效果 => {
      if (!需要授予(效果)) packedEffects.push(效果);
    });
  }
  packedEffects.push({
    原型: '机制授予',
    目标: 系别 === '食物系' ? '自身' : '单体',
    生效方式: '独立生效',
    触发条件: '主动触发',
    可用次数: 1,
    持续回合: 1,
    授予效果,
  });
  return true;
}

function formatSkillNumber(value, digits = 0) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return '0';
  const fixed = digits > 0 ? num.toFixed(digits) : String(Math.round(num));
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
}

function formatSkillPercent(value, alreadyPercent = false) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return '0%';
  const percentValue = alreadyPercent ? num : num * 100;
  const digits = Math.abs(percentValue % 1) < 0.0001 ? 0 : 2;
  return formatSkillNumber(percentValue, digits) + '%';
}

var SKILL_EFFECT_PROPERTY_LABELS = Object.freeze({
  str: '力量',
  def: '防御',
  agi: '敏捷',
  vit_max: '体力上限',
  sp_max: '魂力上限',
  men_max: '精神力上限',
  vit: '体力',
  sp: '魂力',
  men: '精神力',
  掌控: '掌控',
  威力: '威力',
  消耗: '消耗',
  前摇: '前摇',
  控制: '控制',
  速度: '速度',
});

function buildSkillEffectPropertyLabel(property = '') {
  const key = String(property || '').trim();
  return SKILL_EFFECT_PROPERTY_LABELS[key] || key || '属性';
}

function getSkillEffectDuration(effect = {}) {
  const raw = effect?.持续回合 !== undefined ? effect.持续回合 : effect?.持续;
  const duration = Number(raw || 0);
  return Number.isFinite(duration) ? Math.max(0, duration) : 0;
}

function normalizeSkillPackedNumericValue(value, digits = 2) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;
  return Number(num.toFixed(digits));
}

function formatSkillSignedChangeValue(value, asPercent = true) {
  let num = Number(value || 0);
  if (!Number.isFinite(num)) return asPercent ? '+0%' : '+0';
  if (asPercent && num !== 0 && Math.abs(num) < 0.05) num = num > 0 ? 0.05 : -0.05;
  if (asPercent) return (num >= 0 ? '+' : '') + formatSkillPercent(num);
  return (num >= 0 ? '+' : '') + formatSkillNumber(num, Math.abs(num % 1) < 0.0001 ? 0 : 2);
}

function parseSkillSignedChangeNumber(value) {
  const text = String(value ?? '').trim();
  if (!text) return 0;
  if (/%$/.test(text)) {
    const num = Number(text.replace('%', ''));
    return Number.isFinite(num) ? num / 100 : 0;
  }
  const num = Number(text);
  return Number.isFinite(num) ? num : 0;
}

function 读取技能百分比百分点_V1(value) {
  const text = String(value ?? '').trim();
  if (!/%$/.test(text)) return null;
  const num = Number(text.replace('%', '').replace(/^\+/, ''));
  return Number.isFinite(num) ? num : null;
}

function 读取技能比例值_V1(value) {
  const 数值 = parseSkillSignedChangeNumber(value);
  return Number.isFinite(数值) ? 数值 : 0;
}

function 读取技能绝对数值_V1(value) {
  const text = String(value ?? '').trim();
  if (!text || /%$/.test(text)) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function 收口正式百分比最低值_V1(value, 最低百分点 = 5) {
  const text = String(value ?? '').trim();
  if (!/%$/.test(text)) return value;
  const 数值 = 读取技能百分比百分点_V1(text);
  if (!Number.isFinite(数值) || Math.abs(数值) >= 最低百分点 || 数值 === 0) return value;
  return `${数值 < 0 ? '-' : '+'}${最低百分点}%`;
}

function 收口正式百分比字段最低值_V1(effect = {}) {
  if (!effect || typeof effect !== 'object') return effect;
  const 原型 = String(effect?.原型 || '').trim();
  if (原型 === '状态施加') return effect;
  const 需要收口 = ['属性修正', '资源变化', '资源转移', '护盾变化', '判定修正', '结算修正', '决策干扰', '资源锁定'].includes(原型);
  if (!需要收口) return effect;
  ['数值', '副数值'].forEach(字段名 => {
    if (effect[字段名] !== undefined) effect[字段名] = 收口正式百分比最低值_V1(effect[字段名], 5);
  });
  收口正式绝对值字段最低值_V1(effect);
  return effect;
}

var 技能绝对值效果最低点数_V1 = 150;

function 读取效果正式最低绝对值_V1(effect = {}, 字段名 = '数值') {
  if (!effect || typeof effect !== 'object') return 1;
  const 原型 = String(effect?.原型 || '').trim();
  if (!['资源变化', '资源转移', '护盾变化'].includes(原型)) return 1;
  const 当前文本 = String(effect?.[字段名] ?? '').trim();
  const 当前数值 = Number(当前文本);
  const 符号 = Number.isFinite(当前数值) && 当前数值 < 0 ? -1 : 1;
  const 百分比影子 = cloneJsonValue(effect, {});
  百分比影子[字段名] = `${符号 < 0 ? '-' : '+'}${读取效果正式最低百分点_V1(effect, 字段名)}%`;
  const 影子COST = Number(计算单项效果COST_V1(百分比影子).COST || 0);
  const 目标系数 = Math.max(0.01, Number(计算单项效果COST_V1({ ...effect, [字段名]: `${符号 < 0 ? '-' : '+'}${技能绝对值效果最低点数_V1}` }).目标系数 || 1));
  const 持续系数 = Math.max(0.01, Number(读取技能效果持续系数_V1(effect) || 1));
  const 点数 = Math.ceil(Math.max(技能绝对值效果最低点数_V1, 影子COST * 资源绝对值每COST点数_V1 / Math.max(0.01, 目标系数 * 持续系数)));
  return Number.isFinite(点数) ? 点数 : 技能绝对值效果最低点数_V1;
}

function 收口正式绝对值字段最低值_V1(effect = {}) {
  if (!effect || typeof effect !== 'object') return effect;
  const 原型 = String(effect?.原型 || '').trim();
  if (!['资源变化', '资源转移', '护盾变化'].includes(原型)) return effect;
  ['数值', '副数值'].forEach(字段名 => {
    const 文本 = String(effect?.[字段名] ?? '').trim();
    if (!文本 || /%$/.test(文本)) return;
    const 数值 = Number(文本);
    const 最低绝对值 = 读取效果正式最低绝对值_V1(effect, 字段名);
    if (!Number.isFinite(数值) || 数值 === 0 || Math.abs(数值) >= 最低绝对值) return;
    effect[字段名] = `${数值 < 0 ? '-' : '+'}${最低绝对值}`;
  });
  return effect;
}

function 读取效果正式最低百分点_V1(effect = {}, 字段名 = '数值') {
  return 5;
}

function 压低自动生成技能到正式最低预算形态_V1(技能 = {}) {
  let 改动数 = 0;
  const 压低数值字段 = (效果, 字段名) => {
    const 文本 = String(效果?.[字段名] ?? '').trim();
    if (!文本) return;
    if (/%$/.test(文本)) {
      const 百分点 = 读取技能百分比百分点_V1(文本);
      if (!Number.isFinite(百分点) || 百分点 === 0) return;
      const 最低百分点 = 读取效果正式最低百分点_V1(效果, 字段名);
      const 新文本 = `${百分点 < 0 ? '-' : '+'}${最低百分点}%`;
      if (文本 !== 新文本) {
        效果[字段名] = 新文本;
        改动数 += 1;
      }
      return;
    }
    const 数值 = Number(文本);
    if (!Number.isFinite(数值) || 数值 === 0) return;
    const 原型 = String(效果?.原型 || '').trim();
    const 最低绝对值 = ['资源变化', '资源转移', '护盾变化'].includes(原型) ? 读取效果正式最低绝对值_V1(效果, 字段名) : 1;
    const 新文本 = `${数值 < 0 ? '-' : '+'}${最低绝对值}`;
    if (文本 !== 新文本) {
      效果[字段名] = 新文本;
      改动数 += 1;
    }
  };
  const 访问 = 效果 => {
    if (!效果 || typeof 效果 !== 'object' || Array.isArray(效果)) return;
    if (String(效果.原型 || '').trim()) {
      ['数值', '副数值'].forEach(字段名 => {
        if (效果[字段名] !== undefined) 压低数值字段(效果, 字段名);
      });
      if (效果.威力倍率 !== undefined) {
        const 原值 = Number(效果.威力倍率);
        if (Number.isFinite(原值) && 原值 > 1) {
          效果.威力倍率 = 1;
          改动数 += 1;
        }
      }
      if (String(效果.原型 || '').trim() === '召唤生成') {
        if (召唤生成使用继承属性比例_V1(效果)) {
          const 原比例 = Number(效果.继承属性比例);
          if (Number.isFinite(原比例) && 原比例 > 0.01) {
            效果.继承属性比例 = 0.01;
            改动数 += 1;
          }
        } else {
          const 原强度 = Number(效果.强度);
          if (Number.isFinite(原强度) && 原强度 > 0.1) {
            效果.强度 = 0.1;
            改动数 += 1;
          }
        }
      }
    }
    ['持续回合', '可用次数', '次数', '数量', '持续tick', '有效期tick', '调整tick'].forEach(字段名 => {
      const 原值 = Number(效果[字段名]);
      if (Number.isFinite(原值) && 原值 > 1) {
        效果[字段名] = 1;
        改动数 += 1;
      }
    });
    技能执行嵌套效果数组字段表_V1.forEach(字段名 => {
      (Array.isArray(效果?.[字段名]) ? 效果[字段名] : []).forEach(访问);
    });
    (Array.isArray(效果.条件分支) ? 效果.条件分支 : []).forEach(分支 => {
      技能条件分支效果数组字段表_V1.forEach(字段名 => {
        (Array.isArray(分支?.[字段名]) ? 分支[字段名] : []).forEach(访问);
      });
    });
  };
  (Array.isArray(技能?._效果数组) ? 技能._效果数组 : []).forEach(访问);
  return 改动数;
}

var 直接结算收益预算系数_V1 = Object.freeze({
  基准收益: 100,
  宽容系数: 1.15,
  中绑定折扣: 0.55,
  目标系数: Object.freeze({ 自身: 1, 单体: 1, 群体: 1.6, 全场: 2.2 }),
  持续回合衰减: 0.65,
  真实伤害系数: 1.8,
  伤害改写系数: 1.25,
  转化规则系数: 1.5,
  资源收益系数: 0.75,
  消耗基准比例: 0.1,
  前摇基准tick: 10,
  消耗承载指数: 0.78,
  前摇承载指数: 0.72,
  承载下限: 0.03,
  短板惩罚指数: 0.85,
  预警阈值: 0.85,
  来源承载: Object.freeze({
    默认: 1,
    魂技: 1,
    自创魂技: 1.25,
    武魂融合技: 2.4,
    血脉技能: 1.6,
    气血魂技: 1.45,
    魂骨技能: 1.25,
    精神领域: 1.35,
    装备技能: 1.35,
    物品技能: 1.15,
  }),
});

function 读取直接结算收益预算系数_V1() {
  return 直接结算收益预算系数_V1;
}

function 限制直接结算预算数值_V1(数值 = 0, 下限 = 0, 上限 = 1) {
  const 数字 = Number(数值);
  if (!Number.isFinite(数字)) return 下限;
  return Math.max(下限, Math.min(上限, 数字));
}

function 计算直接结算软承载_V1(值 = 0, 基准 = 1, 指数 = 1) {
  const 安全值 = Math.max(0, Number(值 || 0));
  const 安全基准 = Math.max(0.0001, Number(基准 || 1));
  const 安全指数 = Math.max(0.0001, Number(指数 || 1));
  return (Math.pow(1 + 安全值 / 安全基准, 安全指数) - 1) / (Math.pow(2, 安全指数) - 1);
}

function 读取直接结算预算来源承载_V1(上下文 = {}) {
  const 来源文本 = String(
    上下文?.来源类别 ||
      上下文?.来源分类 ||
      上下文?.sourceCategory ||
      '默认',
  ).trim();
  const 来源别名 = {
    blood_skill: '血脉技能',
    blood_passive: '血脉技能',
    blood_ring_skill: '气血魂技',
    soul_bone_skill: '魂骨技能',
    equipment_skill: '装备技能',
    item_skill: '物品技能',
    art: '精神领域',
    independent_ring_skill: '魂技',
  };
  const 来源 = 来源别名[来源文本] || 来源文本 || '默认';
  const 系数表 = 直接结算收益预算系数_V1.来源承载 || {};
  return Number(系数表[来源] || 系数表.默认 || 1);
}

function 读取直接结算预算目标系数_V1(目标 = '') {
  const 文本 = String(目标 || '').trim();
  if (文本 === '自身') return 直接结算收益预算系数_V1.目标系数.自身;
  if (文本 === '全场') return 直接结算收益预算系数_V1.目标系数.全场;
  if (/群体|友方群体|敌方群体/.test(文本)) return 直接结算收益预算系数_V1.目标系数.群体;
  return 直接结算收益预算系数_V1.目标系数.单体;
}

function 读取直接结算预算持续系数_V1(效果 = {}) {
  const 回合 = Math.max(1, Number(效果?.持续回合 || 1));
  return 1 + (回合 - 1) * 直接结算收益预算系数_V1.持续回合衰减;
}

function 读取直接结算预算百分强度_V1(值, 默认值 = 0) {
  const 原始 = 值 === undefined || 值 === null || 值 === '' ? 默认值 : 值;
  const 结果 = parseSkillSignedChangeNumber(原始);
  return Number.isFinite(结果) ? 结果 : 0;
}

function 读取直接结算预算资源变化压力强度_V1(值, 默认值 = 0) {
  const 原始 = 值 === undefined || 值 === null || 值 === '' ? 默认值 : 值;
  const 文本 = String(原始 ?? '').trim();
  const 数值 = parseSkillSignedChangeNumber(文本);
  if (!Number.isFinite(数值)) return 0;
  return /%$/.test(文本) ? 数值 * 100 : 数值;
}

function 读取直接结算预算资源上限_V1(资源 = '', 上下文 = {}) {
  const 角色 = 上下文?.角色 || 上下文?.施术者 || 上下文?.caster || 上下文?.actor || {};
  const 属性 = 角色?.属性 && typeof 角色.属性 === 'object' ? 角色.属性 : {};
  const 标准 = getBaseStats(Math.max(1, Number(上下文?.等级 || 50)));
  const 取候选 = (...字段列表) => 字段列表.flatMap(字段 => [属性?.[字段], 角色?.[字段]]);
  const 映射 = {
    生命: [...取候选('hp_max', 'HP上限', '生命上限', 'vit_max', '体力上限'), 标准?.体力上限],
    HP: [...取候选('hp_max', 'HP上限', '生命上限', 'vit_max', '体力上限'), 标准?.体力上限],
    体力: [...取候选('vit_max', '体力上限', 'sta_max', 'HP上限', '生命上限'), 标准?.体力上限],
    魂力: [...取候选('sp_max', '魂力上限'), 标准?.魂力上限],
    精神力: [...取候选('men_max', '精神力上限'), 标准?.精神力上限],
  };
  const 候选 = 映射[String(资源 || '').trim()] || 映射.魂力;
  const 上限 = 候选.map(Number).find(值 => Number.isFinite(值) && 值 > 0);
  return Math.max(1, Number(上限 || 标准?.魂力上限 || 100));
}

function 读取直接结算预算消耗比例_V1(消耗 = '无', 上下文 = {}) {
  const 解析结果 = 解析技能阶段消耗_V1(消耗, 上下文);
  return 解析结果.启动.reduce((总和, 项) => {
    const 资源上限 = 读取直接结算预算资源上限_V1(项.资源, 上下文);
    return 总和 + (项.百分比 ? 项.数值 / 100 : 项.数值 / 资源上限);
  }, 0);
}

function 判定技能消耗来源_V1(skill = {}, 上下文 = {}) {
  const 文本化 = value => {
    if (Array.isArray(value)) return value.map(文本化).join('|');
    if (value && typeof value === 'object') return Object.entries(value).map(([key, item]) => `${key}:${文本化(item)}`).join('|');
    return String(value ?? '');
  };
  const skillData = 上下文?.技能 || 上下文?.skill || 上下文?.技能数据 || skill || {};
  const sourceCandidate = [
    上下文?.sourceCategory,
    上下文?.来源类别,
    上下文?.来源,
    上下文?.category,
    上下文?.source_category,
    skillData?.来源类别,
    skillData?.来源类型,
    skillData?.内容类型,
    skillData?.__战斗来源类别,
    上下文?.技能类型,
    上下文?.技能分类,
    skillData?.技能类型,
    skillData?.技能分类,
    skillData?.类型,
  ].find(value => String(value ?? '').trim());
  const sourceCandidateText = String(sourceCandidate ?? 推断技能来源_V1(上下文?.path)).trim() || '魂技';
  const explicitSourceValues = [
    上下文?.sourceCategory,
    上下文?.来源类别,
    上下文?.来源,
    上下文?.source_category,
    上下文?.sourceType,
    上下文?.来源类型,
    skillData?.来源类别,
    skillData?.来源类型,
    skillData?.__战斗来源类别,
  ];
  const explicitTypeCategoryValues = [上下文?.技能类型, 上下文?.技能分类, skillData?.技能类型, skillData?.技能分类, skillData?.类型];
  const explicitFusionCategory = [...explicitSourceValues, ...explicitTypeCategoryValues]
    .some(value => /^(?:融合|武魂融合技|融合技|融合技能)$/i.test(String(value ?? '').trim()));
  const 来源文本 = /^(?:融合|武魂融合技|融合技|融合技能)$/i.test(sourceCandidateText)
    ? '武魂融合技'
    : /自创魂技/.test(sourceCandidateText)
      ? '自创魂技'
      : /魂骨/.test(sourceCandidateText)
        ? '魂骨技能'
        : /气血魂技|魂兽能力/.test(sourceCandidateText)
          ? '气血魂技'
          : /魂环魂技|普通魂技|魂技/.test(sourceCandidateText)
            ? '魂技'
            : sourceCandidateText;
  const pathText = 文本化([
    上下文?.path,
    上下文?.写入路径,
    上下文?.writePath,
    上下文?.路径,
    上下文?.写入类型,
    上下文?.来源类别,
    上下文?.sourceCategory,
    上下文?.来源明细,
    上下文?.sourceDetail,
    skillData?.写入路径,
    skillData?.写入类型,
    skillData?.需求魂环数,
    skillData?.魂环位,
    上下文?.需求魂环数,
    上下文?.需求魂环槽位,
    skillData?.path,
    skillData?.路径,
    skillData?.写入类型,
  ]);
  const skillText = 文本化([
    上下文?.技能名,
    上下文?.魂技名,
    上下文?.name,
    上下文?.名称,
    上下文?.类型,
    上下文?.技能类型,
    上下文?.技能分类,
    上下文?.效果模式,
    上下文?.effectMode,
    上下文?.技能效果模式,
    上下文?.释放形态,
    skillData?.魂技名,
    skillData?.name,
    skillData?.技能名,
    skillData?.名称,
    skillData?.类型,
    skillData?.技能类型,
    skillData?.技能分类,
    skillData?.效果模式,
    skillData?.effectMode,
    skillData?.技能效果模式,
    skillData?.释放形态,
    skillData?.来源类别,
    skillData?.来源类型,
  ]);
  const descriptionText = 文本化([
    上下文?.画面描述,
    上下文?.效果描述,
    上下文?.技能描述,
    上下文?.描述,
    skillData?.画面描述,
    skillData?.效果描述,
    skillData?.技能描述,
    skillData?.描述,
  ]);
  const keywordText = 文本化([
    上下文?.触发关键词,
    上下文?.关键词,
    上下文?.标签,
    上下文?.附带属性,
    skillData?.触发关键词,
    skillData?.关键词,
    skillData?.标签,
    skillData?.keywords,
    skillData?.附带属性,
  ]);
  const actionText = 文本化([
    上下文?.动作,
    上下文?.动作类型,
    上下文?.action,
    上下文?.actionKind,
    上下文?.actionType,
    上下文?.action_kind,
    上下文?.来源模块,
    上下文?.sourceModule,
    上下文?.外部动作,
    上下文?.actionContext,
  ]);
  const participantValues = [
    上下文?.融合参与者,
    上下文?.fusionParticipantIds,
    skillData?.融合参与者,
    skillData?.fusionParticipantIds,
  ];
  const hasFusionParticipants = participantValues.some(value => Array.isArray(value)
    ? value.length > 0
    : value && typeof value === 'object'
      ? Object.keys(value).length > 0
      : String(value ?? '').trim() !== '');
  const modeValues = [
    上下文?.融合模式,
    上下文?.fusionMode,
    上下文?.fusionUsageMode,
    skillData?.融合模式,
    skillData?.fusionMode,
  ];
  const hasFusionMode = modeValues.some(value => String(value ?? '').trim() !== '');
  const fusionSignalText = [sourceCandidateText, pathText, skillText, actionText].join('|');
  const 武魂融合技 = explicitFusionCategory
    || /武魂融合技|融合技|融合技能|fusion[-_ ]?(?:skill|technique)|release[_ -]?fusion/i.test(fusionSignalText)
    || hasFusionParticipants
    || hasFusionMode
    || !!(上下文?.融合技 && typeof 上下文.融合技 === 'object' && Object.keys(上下文.融合技).length);
  const ringValue = [
    上下文?.ringIndex,
    上下文?.魂环位,
    上下文?.ringSlot,
    上下文?.需求魂环数,
    上下文?.需求魂环槽位,
    skillData?.ringIndex,
    skillData?.魂环位,
    skillData?.需求魂环数,
  ].map(Number).find(value => Number.isFinite(value) && value > 0);
  const ring = Number.isFinite(ringValue) && ringValue > 0
    ? Math.max(1, Math.floor(ringValue))
    : null;
  const trueBodyDependencyPattern = /(?:(?:需要|需|必须|须(?:要)?|依赖|依附于|借助|配合)[^。！？；，,|]{0,16}(?:武魂)?真身|(?:武魂)?真身[^。！？；，,|]{0,16}(?:状态下|为引|需要|需|必须|依赖|依附于|借助|配合))/i;
  const isPositiveTrueBodyDescription = text => {
    const 文本 = String(text || '').trim();
    if (!文本 || trueBodyDependencyPattern.test(文本) || !/武魂真身|真身|true[-_ ]?body/i.test(文本)) return false;
    return /(?:武魂真身形态|真身形态|真身附体|真身降临|进入[^。！？；，,|]*真身|化为[^。！？；，,|]*真身|化作[^。！？；，,|]*真身|变为[^。！？；，,|]*真身|显现[^。！？；，,|]*真身|开启[^。！？；，,|]*真身|施展[^。！？；，,|]*真身|true[-_ ]?body)/i.test(文本);
  };
  const identityText = [
    sourceCandidateText,
    文本化(explicitSourceValues),
    文本化(explicitTypeCategoryValues),
    pathText,
    skillText,
  ].join('|');
  const identityTrueBodySignal = /武魂真身|真身|true[-_ ]?body/i.test(identityText);
  const descriptionTrueBodySignal = isPositiveTrueBodyDescription(descriptionText);
  const keywordTrueBodySignal = /武魂真身|真身|true[-_ ]?body/i.test(keywordText)
    && !trueBodyDependencyPattern.test(keywordText);
  const trueBodySignal = 上下文?.forceTrueBody === true
    || 上下文?.强制真身 === true
    || skillData?.forceTrueBody === true
    || skillData?.强制真身 === true
    || identityTrueBodySignal
    || descriptionTrueBodySignal
    || keywordTrueBodySignal;
  // 来源分类只接受显式真身标记或文本语义；第七魂环/自创需求 7 只提供位级，不自动放行百分比 COST。
  const 武魂真身 = !武魂融合技 && trueBodySignal;
  const 有效来源 = 武魂融合技 ? '武魂融合技' : 武魂真身 ? '魂技' : 来源文本;
  const 成本类型 = 武魂融合技
    ? 'fusion'
    : 武魂真身
      ? 'true-body'
      : ['魂技', '自创魂技'].includes(来源文本)
        ? 'ordinary'
        : 'not-applicable';
  return {
    来源: 来源文本,
    声明来源: sourceCandidateText,
    有效来源,
    武魂融合技,
    武魂真身,
    魂环位: 武魂真身 ? 7 : ring,
    成本类型,
    语义来源: 武魂融合技 ? '武魂融合技' : 武魂真身 ? '武魂真身' : 来源文本,
  };
}

// 对外统一命名；内部旧调用继续使用“判定技能消耗来源_V1”。
function 解析技能来源_V1(skill = {}, 上下文 = {}) {
  return 判定技能消耗来源_V1(skill, 上下文);
}

function 技能消耗包含百分比_V1(消耗 = '无', 上下文 = {}) {
  const 解析结果 = 解析技能阶段消耗_V1(消耗, 上下文);
  return [...解析结果.启动, ...解析结果.维持].some(项 => 项.百分比)
    || 解析结果.非法项.some(项 => /%/.test(String(项.原始值 ?? '')));
}

function 技能启动消耗包含百分比_V1(消耗 = '无', 上下文 = {}) {
  const 解析结果 = 解析技能阶段消耗_V1(消耗, 上下文);
  return 解析结果.启动.some(项 => 项.百分比)
    || 解析结果.非法项.some(项 => 项.阶段 === '启动' && /%/.test(String(项.原始值 ?? '')));
}

function 普通魂技禁止百分比启动消耗_V1(skill = {}, 上下文 = {}) {
  const 来源判定 = 判定技能消耗来源_V1(skill, 上下文);
  const 来源 = 来源判定.来源;
  if (!['魂技', '自创魂技'].includes(来源)) return false;
  if (来源判定.武魂融合技 || 来源判定.武魂真身) return false;
  const 解析结果 = 解析技能阶段消耗_V1(skill?.消耗, { ...上下文, 技能: skill });
  return 解析结果.启动.some(项 => 项.百分比)
    || 解析结果.维持.some(项 => 项.百分比)
    || 解析结果.非法项.some(项 => /%/.test(String(项.原始值 ?? '')));
}

function 强制普通魂技固定启动消耗_V1(skill = {}, 上下文 = {}) {
  if (!普通魂技禁止百分比启动消耗_V1(skill, 上下文)) return false;
  const 来源 = String(上下文?.sourceCategory || 上下文?.来源类别 || 上下文?.来源 || '魂技').trim() || '魂技';
  const 魂技位 = Math.max(1, Math.floor(Number(上下文?.ringIndex ?? 上下文?.魂环位 ?? 推断虚拟魂技位_V1(来源, 上下文) ?? 1)) || 1);
  const 角色 = 上下文?.角色 || 上下文?.施术者 || {};
  const 转换资源 = (资源, 原始值) => {
    const 文本 = String(原始值 ?? '').trim();
    if (!/%$/.test(文本)) return 原始值;
    const 比例 = Math.max(0, Number(文本.replace('%', '')) || 0) / 100;
    const 资源上限 = 读取直接结算预算资源上限_V1(资源, { ...上下文, 角色 });
    return Math.max(1, Math.round(资源上限 * 比例));
  };
  const 转换对象 = value => {
    if (Array.isArray(value)) return value.map(转换对象);
    if (value && typeof value === 'object') {
      const next = {};
      Object.entries(value).forEach(([key, raw]) => {
        if (['启动', 'upfront'].includes(String(key))) next[key] = 转换对象(raw);
        else if (['维持', 'sustain'].includes(String(key))) next[key] = raw;
        else if (['魂力', '体力', '精神力', '生命', 'HP'].includes(String(key))) next[key] = 转换资源(key === 'HP' ? '生命' : key, raw);
        else next[key] = raw;
      });
      return next;
    }
    const 文本 = String(value ?? '').trim();
    if (文本 && 文本 !== '无') {
      const [启动段, 维持段 = ''] = 文本.split(/\s+维持[:：]/);
      const 已转换 = String(启动段 || '').replace(/(生命|HP|体力|魂力|精神力)([:：])([+-]?\d+(?:\.\d+)?)%/g, (_原文, 资源名, 分隔, 数字) => {
        const 标准资源 = 资源名 === 'HP' ? '生命' : 资源名;
        const 比例 = Math.max(0, Number(数字 || 0) || 0) / 100;
        const 资源上限 = 读取直接结算预算资源上限_V1(标准资源, { ...上下文, 角色 });
        return `${资源名}${分隔}${Math.max(1, Math.round(资源上限 * 比例))}`;
      }).trim();
      if (/%/.test(已转换)) return 格式化魂技消耗结构文本_V1({ 魂力: Math.max(1, Math.round(获取标准消耗_V1(魂技位))) });
      return `${已转换 || 格式化魂技消耗结构文本_V1({ 魂力: Math.max(1, Math.round(获取标准消耗_V1(魂技位))) })}${维持段 ? ` 维持:${维持段}` : ''}`;
    }
    return 格式化魂技消耗结构文本_V1({ 魂力: Math.max(1, Math.round(获取标准消耗_V1(魂技位))) });
  };
  skill.消耗 = 转换对象(skill.消耗);
  return true;
}

// ============ v3 反推方案：从 skill.消耗 / skill.前摇 反推倍数 → COST 修正比例 ============
function 解析消耗为绝对值_V1(消耗字段 = '无', 上下文 = {}) {
  const 解析结果 = 解析技能阶段消耗_V1(消耗字段, 上下文);
  return 解析结果.启动.reduce((总和, 项) => {
    const 资源上限 = 读取直接结算预算资源上限_V1(项.资源, 上下文);
    return 总和 + (项.百分比 ? 资源上限 * 项.数值 / 100 : 项.数值);
  }, 0);
}

function 技能消耗字段缺失_V1(skill = {}) {
  if (!skill || typeof skill !== 'object') return true;
  if (!Object.prototype.hasOwnProperty.call(skill, '消耗')) return true;
  const 值 = skill.消耗;
  if (值 === undefined || 值 === null) return true;
  return typeof 值 === 'string' && 值.trim() === '';
}

function 读取技能实际消耗_V1(skill = {}, 上下文 = {}, 标准消耗 = 0) {
  if (技能消耗字段缺失_V1(skill)) return 标准消耗;
  const 实际 = 解析消耗为绝对值_V1(skill.消耗, 上下文);
  return Number.isFinite(实际) ? Math.max(0, 实际) : 标准消耗;
}

function 读取技能承载消耗比例_V1(skill = {}, 上下文 = {}) {
  return Math.max(0, 读取直接结算预算消耗比例_V1(skill?.消耗, 上下文));
}

function 读取技能实际前摇_V1(skill = {}, 上下文 = {}) {
  if (!skill || typeof skill !== 'object' || !Object.prototype.hasOwnProperty.call(skill, '前摇')) return 获取标准前摇_V1();
  const 值 = skill.前摇;
  if (值 === undefined || 值 === null || String(值).trim() === '') return 获取标准前摇_V1();
  const 实际 = Number(值);
  if (!Number.isFinite(实际)) return 获取标准前摇_V1();
  const 前摇 = Math.max(0, 实际);
  if (技能包含战斗外专用原型_V1(skill)) return 前摇;
  const 来源 = String(上下文?.来源 || 上下文?.来源类别 || 上下文?.scope || '').trim();
  return 来源 === '战斗外' ? 前摇 / 10 : 前摇;
}

function 计算消耗倍数_V1(skill = {}, 魂技位 = 1, 上下文 = {}) {
  const 来源判定 = 判定技能消耗来源_V1(skill, { ...上下文, ringIndex: 魂技位, 魂环位: 魂技位 });
  const 来源 = 来源判定.有效来源 || 来源判定.来源;
  const 技能上下文 = { ...上下文, 技能: skill, ringIndex: 魂技位, 魂环位: 魂技位 };
  const 武魂融合技百分比消耗 = 来源判定.武魂融合技 && 技能消耗包含百分比_V1(skill?.消耗, 技能上下文);
  const 武魂真身百分比消耗 = !武魂融合技百分比消耗 && 来源判定.武魂真身 && 技能消耗包含百分比_V1(skill?.消耗, 技能上下文);
  const 标准 = 武魂真身百分比消耗 ? null : 获取标准消耗_V1(魂技位);
  if (武魂真身百分比消耗 || 武魂融合技百分比消耗) {
    const 实际比例 = 读取技能承载消耗比例_V1(skill, 技能上下文);
    return Math.max(0.05, Math.min(4, 实际比例 / 获取武魂真身运转标准消耗比例_V1()));
  }
  if (!Number.isFinite(标准) || 标准 <= 0) return 1;
  const 实际 = 读取技能实际消耗_V1(skill, 技能上下文, 标准);
  return Math.max(0.05, Math.min(4, 实际 / 标准));
}

function 计算前摇倍数_V1(skill = {}, 上下文 = {}) {
  const 实际 = 读取技能实际前摇_V1(skill, 上下文);
  return Math.max(0.05, Math.min(4, 实际 / SKILL_STANDARD_CAST_TIME_V1));
}

// 倍数 → 比例：1.0× 对应 0；倍数>1 时上扬到 上限比例（按 4× 封顶）；倍数<1 时下降到 下限比例（按 0.25× 封顶）
function 倍数到比例_V1(倍数 = 1, 上限比例 = 0.6, 下限比例 = -0.45) {
  const 值 = Number(倍数);
  if (!Number.isFinite(值)) return 0;
  if (值 >= 1) return Math.min(上限比例, (值 - 1) * (上限比例 / 3));
  return Math.max(下限比例, (值 - 1) * Math.abs(下限比例) / 0.75);
}

function 读取技能分阶段副作用列表_V1(skill = {}) {
  const 结果 = normalizeSkillSideEffectList(skill?.副作用列表 || []).map((条目, 序号) => ({
    条目,
    路径: `副作用列表[${序号}]`,
    来源: '施展副作用',
  }));
  if (String(skill?.承载方式 || '').trim() === '造物承载' || 是造物承载效果数组_V1(skill?._效果数组)) {
    (Array.isArray(skill?._效果数组) ? skill._效果数组 : []).forEach((效果, 效果序号) => {
      normalizeSkillSideEffectList(效果?.副作用列表 || []).forEach((条目, 副作用序号) => {
        结果.push({
          条目,
          路径: `_效果数组[${效果序号}].副作用列表[${副作用序号}]`,
          来源: '使用副作用',
        });
      });
    });
  }
  return 结果;
}

// 评估副作用预算档：只从正式副作用列表反推，不落盘手填档位。
function 评估副作用预算档_V1(skill = {}) {
  const 列表 = 读取技能分阶段副作用列表_V1(skill).map(项 => 项.条目);
  const 档级序 = ['无', '轻', '中', '重'];
  let 最高 = '无';
  列表.forEach(项 => {
    const 名称 = String(项?.副作用类型 || '').trim();
    const 档 = SKILL_SIDE_EFFECT_TIER_V1[名称] || '无';
    if (档级序.indexOf(档) > 档级序.indexOf(最高)) 最高 = 档;
  });
  return 最高;
}

// 评估触发限制档：根据各效果触发限制取最严档；若无则 '无'
function 评估触发限制档_V1(skill = {}) {
  const 抵扣上限 = 读取技能限制抵扣上限_V1(skill);
  const 读取档位 = 限制 => {
    const 抵扣率 = Math.min(抵扣上限, 解析次数限制抵扣率_V1(限制));
    if (抵扣率 >= 0.60) return '重';
    if (抵扣率 >= 0.35) return '中';
    if (抵扣率 > 0) return '轻';
    return '无';
  };
  const 候选 = [];
  (Array.isArray(skill?._效果数组) ? skill._效果数组 : []).forEach(效果 => {
    if (效果 && typeof 效果 === 'object') 候选.push(读取档位(效果?.触发限制));
  });
  const 档级序 = ['无', '轻', '中', '重'];
  let 最高 = '无';
  候选.forEach(档 => {
    if (档级序.indexOf(档) > 档级序.indexOf(最高)) 最高 = 档;
  });
  return 最高;
}

function 读取副作用数值百分数_V1(输入值, 回退值 = 0) {
  const 文本 = String(输入值 ?? '').trim();
  if (!文本) return 回退值;
  const 数字 = Number(文本.replace(/[+%-]/g, ''));
  return Number.isFinite(数字) ? Math.abs(数字) : 回退值;
}

function 计算单项副作用COST_V1(副作用 = {}) {
  const 条目 = normalizeSkillSideEffectEntry(副作用);
  if (!条目) return { COST: 0 };
  const 类型 = String(条目.副作用类型 || '').trim();
  const 配置 = SKILL_SIDE_EFFECT_TYPE_META_V1[类型] || {};
  const 概率 = Math.max(0, Math.min(1, Number(条目.触发概率 ?? 1)));
  if (类型 === '致死献祭') {
    return {
      COST: Number((100 * 概率).toFixed(2)),
      副作用类型: 类型,
      触发时机: 条目.触发时机 || '效果生效后',
      生效对象: 条目.生效对象 || '技能释放者',
      触发概率: 概率,
    };
  }
  const 持续 = Math.max(0, Number(条目.持续回合 ?? 配置.持续回合 ?? 1));
  const 默认持续 = Math.max(1, Number((配置.持续回合 ?? 持续) || 1));
  const 持续修正 = 持续 / 默认持续;
  const 数值 = 读取副作用数值百分数_V1(条目.数值, 读取副作用数值百分数_V1(配置.数值, 0));
  const 副数值 = 读取副作用数值百分数_V1(条目.副数值, 读取副作用数值百分数_V1(配置.副数值, 0));
  const 基准 = ({
    全属性降低: 数值 / 5,
    自损反噬: 数值 / 2,
    精神紊乱: 数值 / 5 + 副数值 / 10,
    魂力反噬: 数值 / 2.5,
    命中下降: 数值 / 5,
    动作迟缓: 数值 / 6 + 副数值 / 8,
    目标错乱: 数值 / 5,
    施法僵直: 数值 / 5,
  })[类型] || 0;
  return {
    COST: Number(Math.max(0, 基准 * 持续修正 * 概率).toFixed(2)),
    副作用类型: 类型,
    触发时机: 条目.触发时机 || '效果生效后',
    生效对象: 条目.生效对象 || '技能释放者',
    触发概率: 概率,
    持续回合: 持续,
    数值: 条目.数值 || '',
    副数值: 条目.副数值 || '',
    副作用状态: 条目.副作用状态 || 配置.状态 || '',
  };
}

function 计算技能副作用COST_V1(技能 = {}) {
  const 明细 = 读取技能分阶段副作用列表_V1(技能)
    .map(项 => ({ 路径: 项.路径, 来源: 项.来源, ...计算单项副作用COST_V1(项.条目) }))
    .filter(项 => Number(项.COST || 0) > 0);
  const 总COST = 明细.reduce((总和, 项) => 总和 + Number(项.COST || 0), 0);
  return { 总COST: Number(总COST.toFixed(2)), 明细 };
}

function 解析次数限制抵扣率_V1(输入值 = null) {
  if (!输入值) return 0;
  let 周期 = '';
  let 次数 = 0;
  if (typeof 输入值 === 'object' && !Array.isArray(输入值)) {
    周期 = String(输入值.周期 || '').trim();
    次数 = Number(输入值.次数 ?? 0);
  } else {
    const 文本 = String(输入值 || '').trim();
    const 匹配 = 文本.match(/(每日|每战|每回合).{0,4}?(\d+)\s*次/);
    if (匹配) {
      周期 = 匹配[1];
      次数 = Number(匹配[2]);
    }
  }
  if (!Number.isFinite(次数) || 次数 <= 0) return 0;
  if (周期 === '每日') return 次数 <= 1 ? 0.70 : 次数 <= 3 ? 0.50 : 0.30;
  if (周期 === '每战') return 次数 <= 1 ? 0.40 : 次数 <= 3 ? 0.25 : 0.12;
  if (周期 === '每回合') return 次数 <= 1 ? 0.10 : 次数 <= 3 ? 0.06 : 0.03;
  return 0;
}

function 读取技能限制抵扣上限_V1(技能 = {}) {
  return String(技能?.承载方式 || '').trim() === '造物承载' ? 0.10 : 0.80;
}

function 读取魂技位COST倍率上限_V1(魂技位 = 1) {
  const 位 = Math.max(1, Math.min(9, Math.floor(Number(魂技位 || 1)) || 1));
  if (位 <= 7) return 1.5;
  if (位 === 8) return 2;
  return Infinity;
}

function 读取限定元素限制信息_V1(效果 = {}) {
  const 候选 = [];
  const 收集 = value => {
    if (Array.isArray(value)) value.forEach(收集);
    else {
      const 文本 = String(value ?? '').trim();
      if (文本) 候选.push(文本);
    }
  };
  收集(效果?.限定元素);
  const 去重候选 = Array.from(new Set(候选));
  const 宽类 = 去重候选.filter(项 => ['元素类', '五行类'].includes(项));
  const 单元素 = 去重候选.filter(项 => SKILL_PROTOTYPE_FIELD_OPTIONS_V1.限定元素.includes(项) && !['元素类', '五行类'].includes(项));
  if (单元素.length) return { 抵扣率: 0.30, 来源: `限定${格式化技能限定元素显示_V1(单元素)}` };
  if (宽类.length) return { 抵扣率: 0.20, 来源: `限定${宽类.join('、')}` };
  return { 抵扣率: 0, 来源: '' };
}

function 读取效果限制抵扣信息_V1(效果 = {}, 继承抵扣率 = 0, 上下文 = {}) {
  let 抵扣率 = Math.max(0, Number(继承抵扣率 || 0));
  let 限制来源 = 抵扣率 > 0 ? '技能限制' : '';
  const 应用 = (值, 来源) => {
    const 数值 = Math.max(0, Number(值 || 0));
    if (数值 > 抵扣率) {
      抵扣率 = 数值;
      限制来源 = 来源;
    }
  };
  应用(解析次数限制抵扣率_V1(效果?.触发限制), '触发限制');
  应用(解析次数限制抵扣率_V1(效果?.次数限制), '次数限制');
  const 限定信息 = 读取限定元素限制信息_V1(效果);
  应用(限定信息.抵扣率, 限定信息.来源);
  const 抵扣上限 = Math.max(0, Math.min(0.80, Number(上下文?.限制抵扣上限 ?? 0.80)));
  return {
    抵扣率: Math.min(抵扣上限, 抵扣率),
    限制来源,
    限定元素: 格式化技能限定元素显示_V1(效果?.限定元素) || 限定信息.来源.replace(/^限定/, ''),
  };
}

function 读取效果限制抵扣率_V1(效果 = {}, 继承抵扣率 = 0, 上下文 = {}) {
  return 读取效果限制抵扣信息_V1(效果, 继承抵扣率, 上下文).抵扣率;
}

function 读取技能效果关键字段_V1(效果 = {}) {
  const 原型 = String(效果?.原型 || '').trim();
  const 字段 = ({
    资源变化: '资源', 资源转移: '资源转移方式', 护盾变化: '护盾模式',
    属性修正: '属性', 判定修正: '判定', 结算修正: '结算',
    状态施加: '状态', 状态移除: '状态', 状态转移: '状态', 状态交换: '状态',
    资源锁定: '锁定类型', 规则改写: '规则', 规则防御: '规则',
    复制执行: '复制类型', 位移执行: '位移类型', 决策干扰: '干扰',
    召唤生成: '召唤单位类型', 时窗修正: '调整字段',
  })[原型] || '';
  return { 字段, 值: 字段 ? String(效果?.[字段] || '').trim() : '' };
}

// 累计单项效果 COST：按 SKILL_UNIT_COST_TABLE_V1 + 字段值 + 持续 + 目标系数
// v10：百分比/绝对值效果统一进入同一 COST 池；这里仅保留分类用于诊断展示。
var v5_百分比型原型_V1 = new Set([
  '资源变化', '资源转移', '护盾变化',
  '属性修正', '判定修正',
  '决策干扰', '资源锁定', '时窗修正',
]);
var 技能预算COST容差_V1 = 0.01;
var 技能预算超预算容差_V1 = 1;

function 技能COST超预算_V1(实际COST = 0, 门禁 = 0) {
  return Number(实际COST || 0) - Number(门禁 || 0) > 技能预算超预算容差_V1;
}

function 读取预算评估最低有效COST_V1(评估 = {}, 上下文 = {}) {
  const 运转基准 = Math.max(0.5, Number(评估?.运转基准 || 上下文?.运转基准 || 0));
  const 门禁候选 = Number(
    评估?.实际门禁 ??
      评估?.预算门禁 ??
      评估?.门禁 ??
      上下文?.实际门禁 ??
      上下文?.预算门禁 ??
      上下文?.最高预算门禁 ??
      上下文?.阶段最高预算门禁 ??
      0,
  );
  const 当前门禁 = Number.isFinite(门禁候选) && 门禁候选 > 0 ? 门禁候选 : 0;
  const 角色 = 上下文?.角色 || 评估?.角色 || {};
  const 利用率下限 = 读取天赋预算利用率下限_V1(角色, 上下文);
  return Number(Math.max(0.5, (当前门禁 > 0 ? 当前门禁 : 运转基准) * 利用率下限).toFixed(2));
}

function 判定效果是百分比型_V1(原型 = '') {
  return v5_百分比型原型_V1.has(String(原型 || '').trim());
}

function 读取预算上下文系别_V1(上下文 = {}) {
  const 角色 = 上下文?.角色 || {};
  return String(
    上下文?.系别 ||
      上下文?.武魂系别 ||
      上下文?.type ||
      角色?.系别 ||
      取角色主武魂系别_V1(角色) ||
      '强攻系',
  ).trim() || '强攻系';
}

function 效果是正向辅助_V1(效果 = {}) {
  const 原型 = String(效果?.原型 || '').trim();
  const 数值 = 读取技能比例值_V1(效果?.数值);
  if (['属性修正', '资源变化', '资源转移', '判定修正', '资源锁定', '决策干扰'].includes(原型)) return 数值 > 0;
  if (原型 === '护盾变化') return String(效果?.护盾模式 || '').trim() === '正向护盾' || 数值 > 0;
  if (原型 === '结算修正') {
    const 结算 = String(效果?.结算 || '').trim();
    if (['治疗', '技能效果', '伤害转治疗'].includes(结算)) return 数值 > 0;
    if (结算 === '受到伤害') return 数值 < 0;
    if (['伤害分摊', '消耗分摊', '伤害吸收'].includes(结算)) return true;
  }
  if (原型 === '状态施加') {
    const 状态 = String(效果?.状态 || '').trim();
    return ['持续恢复', '护盾', '隐匿', '共享视野', '无视异常', '霸体', '护卫'].includes(状态);
  }
  return false;
}

function 效果是防御辅助_V1(效果 = {}) {
  const 原型 = String(效果?.原型 || '').trim();
  if (原型 === '护盾变化' || 原型 === '规则防御') return true;
  if (原型 === '结算修正') {
    const 结算 = String(效果?.结算 || '').trim();
    return ['受到伤害', '伤害分摊', '伤害吸收', '伤害转移'].includes(结算);
  }
  if (原型 === '状态施加') return ['护盾', '无视异常', '霸体', '护卫'].includes(String(效果?.状态 || '').trim());
  return false;
}

function 读取效果目标系数信息_V1(效果 = {}, 上下文 = {}) {
  const 目标 = String(效果?.目标 || '单体').trim();
  const 基础 = ({ 自身: 1, 单体: 1, 群体: 1.8, 全场: 2.6, 召唤物: 1 })[目标] || 1;
  const 系别 = 读取预算上下文系别_V1(上下文);
  if (
    效果是正向辅助_V1(效果) &&
    !['自身', '召唤物'].includes(目标) &&
    !['精神系', '辅助系', '治疗系', '食物系'].includes(系别) &&
    !(系别 === '防御系' && 效果是防御辅助_V1(效果))
  ) {
    if (目标 === '单体') return { 目标系数: 1.4, 目标系数原因: '辅助单体' };
    if (目标 === '群体') return { 目标系数: 1.9, 目标系数原因: '辅助群体' };
  }
  return { 目标系数: 基础, 目标系数原因: '目标范围' };
}

function 计算防御穿透COST系数_V1(穿透 = 0) {
  const 原始穿透 = Math.max(0, Number(穿透 || 0));
  const 有效穿透 = 原始穿透 >= 100
    ? 100
    : 原始穿透 <= 70
      ? 原始穿透
      : Math.min(92, 70 + (原始穿透 - 70) * 0.35);
  return Math.max(1, Math.min(12.5, 1 / Math.max(0.08, 1 - 有效穿透 / 100)));
}

function 读取伤害结算COST系数_V1(效果 = {}, 上下文 = {}) {
  const 目标系数 = 读取效果目标系数信息_V1(效果, 上下文).目标系数;
  const 伤害类型乘数 = 获取单位COST_V1('伤害结算', '伤害类型', 效果?.伤害类型) ?? 1;
  const 穿透系数 = 计算防御穿透COST系数_V1(效果?.防御穿透);
  // 战斗结算会把总伤害均分到各段；段数改变命中分布，不会线性放大总伤害。
  // COST 真值表也明确将“攻击段数”记为 0，因此不能再按段数重复收费。
  return Math.max(0.01, 目标系数 * 伤害类型乘数 * 穿透系数);
}

function 按伤害COST反推威力倍率_V1(目标COST = 0, 效果 = {}, 上下文 = {}) {
  const 威力指数 = Math.log(9) / Math.log(30);
  const 系数 = 读取伤害结算COST系数_V1(效果, 上下文);
  const 单体COST = Math.max(0.01, Number(目标COST || 0) / 系数);
  return Math.max(1, Math.round(70 * Math.pow(单体COST / 10, 1 / 威力指数)));
}

var 资源绝对值每COST点数_V1 = 30;

function 技能效果是战斗外专用原型_V1(效果 = {}) {
  return ['修炼增益', '战斗外复活', '等级提升', '群体撤离'].includes(String(效果?.原型 || '').trim());
}

function 技能包含战斗外专用原型_V1(skill = {}) {
  const 访问 = 效果 => {
    if (!效果 || typeof 效果 !== 'object' || Array.isArray(效果)) return false;
    if (技能效果是战斗外专用原型_V1(效果)) return true;
    return 技能执行嵌套效果数组字段表_V1.some(字段名 =>
      (Array.isArray(效果?.[字段名]) ? 效果[字段名] : []).some(访问),
    );
  };
  return (Array.isArray(skill?._效果数组) ? skill._效果数组 : []).some(访问);
}

function 计算复活规则COST_V1(基础COST = 50, 数值文本 = '+25%', 目标系数 = 1, 目标信息 = {}) {
  const 恢复百分点 = Math.max(0, Number(读取技能百分比百分点_V1(String(数值文本 || '').trim() || '+25%') || 25));
  const 规则COST = Math.max(0, Number(基础COST || 0));
  const 恢复COST = 恢复百分点 * 0.5;
  const 总COST = (规则COST + 恢复COST) * Math.max(0.01, Number(目标系数 || 1));
  return {
    COST: 总COST,
    百分比: false,
    数值类型: '复活恢复比例',
    百分点: Number(恢复百分点.toFixed(4)),
    单位COST: Number(规则COST.toFixed(4)),
    数值倍率: Number(((规则COST + 恢复COST) / Math.max(0.01, 规则COST)).toFixed(4)),
    目标系数: Number(Math.max(0.01, Number(目标系数 || 1)).toFixed(4)),
    目标系数原因: 目标信息.目标系数原因,
    持续系数: 1,
  };
}

function 读取状态施加数值通道COST_V1(状态配置, 字段名 = '数值') {
  if (typeof 状态配置 === 'number') return 状态配置;
  if (!状态配置 || typeof 状态配置 !== 'object') return undefined;
  const 值 = Number(状态配置[字段名]);
  return Number.isFinite(值) ? 值 : undefined;
}

function 计算状态施加COST_V1(效果 = {}, 状态配置 = {}, 目标系数 = 1, 目标信息 = {}, 持续系数 = 1) {
  const 数值文本 = String(效果?.数值 ?? '').trim();
  const 副数值文本 = String(效果?.副数值 ?? '').trim();
  const 数值百分点 = 读取技能百分比百分点_V1(数值文本);
  const 副数值百分点 = 读取技能百分比百分点_V1(副数值文本);
  const 数值单位COST = 读取状态施加数值通道COST_V1(状态配置, '数值');
  const 副数值单位COST = 读取状态施加数值通道COST_V1(状态配置, '副数值');
  const 主数值COST = Number.isFinite(数值百分点) && Number.isFinite(数值单位COST) ? Math.abs(数值百分点) * 数值单位COST : 0;
  const 副数值COST = Number.isFinite(副数值百分点) && Number.isFinite(副数值单位COST) ? Math.abs(副数值百分点) * 副数值单位COST : 0;
  const 百分比数值COST = 主数值COST + 副数值COST;
  const 固定COST = 百分比数值COST > 0 ? 0 : Math.max(0, Number(typeof 状态配置 === 'number' ? 状态配置 : 状态配置?.固定COST || 0));
  const 触发方式 = String(效果?.触发方式 || '立即触发').trim() || '立即触发';
  const 触发方式COST = Number(SKILL_UNIT_COST_TABLE_V1.状态施加?.触发方式?.[触发方式] || 0);
  const 延迟回合 = Math.max(0, Number(效果?.延迟回合 || 0));
  const 延迟回合COST = 触发方式 === '延迟触发' ? 延迟回合 * 0.5 : 0;
  const 基础COST = 百分比数值COST + 固定COST + 触发方式COST + 延迟回合COST;
  const 主单位 = Number.isFinite(数值单位COST) ? 数值单位COST : 固定COST;
  return {
    COST: 基础COST * 目标系数 * 持续系数,
    百分比: 百分比数值COST > 0,
    数值类型: 百分比数值COST > 0 ? '状态百分比通道' : '固定状态',
    百分点: Number.isFinite(数值百分点) ? Number(数值百分点.toFixed(4)) : null,
    副数值百分点: Number.isFinite(副数值百分点) ? Number(副数值百分点.toFixed(4)) : null,
    绝对值: null,
    绝对值折算百分点: null,
    固定值系数: null,
    绝对值每COST点数: null,
    单位COST: Number(Math.max(0, 主单位 || 0).toFixed(4)),
    副数值单位COST: Number.isFinite(副数值单位COST) ? Number(副数值单位COST.toFixed(4)) : null,
    数值倍率: Number((Number.isFinite(数值百分点) ? Math.abs(数值百分点) : (固定COST > 0 ? 1 : 0)).toFixed(4)),
    副数值倍率: Number((Number.isFinite(副数值百分点) ? Math.abs(副数值百分点) : 0).toFixed(4)),
    主数值COST: Number(主数值COST.toFixed(4)),
    副数值COST: Number(副数值COST.toFixed(4)),
    固定规则COST: Number(固定COST.toFixed(4)),
    触发方式COST: Number(触发方式COST.toFixed(4)),
    延迟回合COST: Number(延迟回合COST.toFixed(4)),
    数量系数: 1,
    目标系数: Number(目标系数.toFixed(4)),
    目标系数原因: 目标信息.目标系数原因,
    持续系数: Number(持续系数.toFixed(4)),
  };
}

function 计算单项效果COST_V1(效果 = {}, 上下文 = {}) {
  if (!效果 || typeof 效果 !== 'object') return { COST: 0, 百分比: false };
  const 原型 = String(效果.原型 || '').trim();
  if (!原型) return { COST: 0, 百分比: false };
  const 目标信息 = 读取效果目标系数信息_V1(效果, 上下文);
  const 目标系数 = 目标信息.目标系数;
  const 持续 = Math.max(1, Number(效果.持续回合 ?? 1));
  const 持续系数 = 读取技能效果持续系数_V1(效果);
  const 百分比 = 判定效果是百分比型_V1(原型);
  if (原型 === '伤害结算') {
    const 威力 = Math.max(0, Number(效果.威力倍率 ?? 0));
    if (威力 <= 0) return { COST: 0, 百分比: false };
    const 单位COST = 读取伤害结算COST系数_V1(效果, 上下文);
    const 数值倍率 = Math.pow(威力 / 70, Math.log(9) / Math.log(30));
    return {
      COST: 10 * 数值倍率 * 单位COST,
      百分比: false,
      数值类型: '威力倍率',
      单位COST: Number((10 * 单位COST).toFixed(4)),
      数值倍率: Number(数值倍率.toFixed(4)),
      目标系数: Number(目标系数.toFixed(4)),
      目标系数原因: 目标信息.目标系数原因,
      持续系数: 1,
    };
  }
  const 关键字段 = ({
    资源变化: '资源', 资源转移: '资源转移方式', 护盾变化: '护盾模式',
    属性修正: '属性', 判定修正: '判定', 结算修正: '结算',
    状态施加: '状态', 状态移除: '状态', 状态转移: '状态', 状态交换: '状态',
    资源锁定: '锁定类型', 规则改写: '规则', 规则防御: '规则',
    复制执行: '复制类型', 位移执行: '位移类型', 决策干扰: '干扰',
    召唤生成: '召唤单位类型', 时窗修正: '调整字段',
    修炼增益: '收益类型',
  })[原型];
  const 选项原值 = 关键字段 ? 效果?.[关键字段] : '';
  const 选项值 = Array.isArray(选项原值)
    ? 选项原值.map(项 => String(项 || '').trim()).filter(Boolean).join('|')
    : String(选项原值 || '').trim();
  const 选项列表 = Array.isArray(选项原值)
    ? 选项原值.map(项 => String(项 || '').trim()).filter(Boolean)
    : (选项值 ? [选项值] : []);
  let 单位COST = 获取单位COST_V1(原型, 关键字段, 选项值);
  // v5：处理"两层结构"（属性修正/资源变化/资源转移/判定修正/资源锁定 等按 选项→正/负向 分）
  if (typeof 单位COST !== 'number' && 选项值) {
    const 候选 = (单位COST && typeof 单位COST === 'object')
      ? 单位COST
      : (SKILL_UNIT_COST_TABLE_V1[原型]?.[选项值]);
    if (候选 && typeof 候选 === 'object') {
      if (原型 === '状态施加') return 计算状态施加COST_V1(效果, 候选, 目标系数, 目标信息, 持续系数);
      const 数值文本2 = String(效果?.数值 ?? '').trim();
      const 数值符号 = 读取技能比例值_V1(数值文本2);
      const 方向 = 数值符号 < 0 ? '负向' : '正向';
      if (typeof 候选[方向] === 'number') 单位COST = 候选[方向];
      else if (typeof 候选.正向 === 'number') 单位COST = 候选.正向;
    }
  }
  if (原型 === '属性修正' && typeof 单位COST !== 'number' && 选项列表.length > 1) {
    const 数值文本2 = String(效果?.数值 ?? '').trim();
    const 数值符号 = 读取技能比例值_V1(数值文本2);
    const 方向 = 数值符号 < 0 ? '负向' : '正向';
    const 单位列表 = 选项列表.map(属性 => {
      const 候选 = SKILL_UNIT_COST_TABLE_V1.属性修正?.[属性];
      if (typeof 候选 === 'number') return 候选;
      if (候选 && typeof 候选 === 'object') return Number(候选[方向] ?? 候选.正向);
      return NaN;
    }).filter(值 => Number.isFinite(值));
    if (单位列表.length) 单位COST = 单位列表.reduce((总和, 值) => 总和 + 值, 0) / 单位列表.length;
  }
  if (typeof 单位COST !== 'number' || !Number.isFinite(单位COST)) return { COST: 0, 百分比 };
  const 数值文本 = String(效果?.数值 ?? '').trim();
  const 附加规则COST = 原型 === '判定修正' && 效果?.打断效果 === true
    ? Number(SKILL_UNIT_COST_TABLE_V1.判定修正?.打断效果 || 0)
    : 0;
  if (原型 === '规则改写' && 选项值 === '缴械') {
    return {
      COST: 单位COST * 目标系数 * 持续系数,
      百分比: false,
      数值类型: '固定规则',
      单位COST: Number(单位COST.toFixed(4)),
      数值倍率: 1,
      目标系数: Number(目标系数.toFixed(4)),
      目标系数原因: 目标信息.目标系数原因,
      持续系数: Number(持续系数.toFixed(4)),
    };
  }
  if (原型 === '规则改写' && 选项值 === '死亡转存活') {
    return 计算复活规则COST_V1(单位COST, 数值文本 || '+25%', 目标系数, 目标信息);
  }
  if (原型 === '战斗外复活') {
    return 计算复活规则COST_V1(单位COST, 数值文本 || '+25%', 目标系数, 目标信息);
  }
  const 百分点 = 读取技能百分比百分点_V1(数值文本);
  const 绝对值 = 读取技能绝对数值_V1(数值文本);
  const 资源绝对值 = ['资源变化', '资源转移', '护盾变化'].includes(原型) && 绝对值 !== null && Math.abs(绝对值) > 0;
  const 召唤数值倍率 = (() => {
    if (原型 !== '召唤生成') return null;
    const 数量 = Math.max(1, Number(效果?.数量 || 1));
    if (召唤生成使用继承属性比例_V1(效果)) {
      const 基准继承比例 = String(效果?.召唤单位类型 || '').trim() === '分身' ? 0.45 : 0.35;
      return 数量 * Math.max(0.1, 读取召唤生成平均继承比例_V1(效果) / Math.max(0.01, 基准继承比例));
    }
    return 数量 * Math.max(0.1, Number(效果?.强度 || 1));
  })();
  const 属性数量系数 = 原型 === '属性修正' ? Math.max(1, Math.pow(Math.max(1, 选项列表.length), 0.85)) : 1;
  const 实际单位COST = 资源绝对值 ? 1 : 单位COST;
  const 基础数值倍率 = 资源绝对值
    ? Math.abs(绝对值) / 资源绝对值每COST点数_V1
    : 召唤数值倍率 !== null
      ? 召唤数值倍率
      : Number.isFinite(百分点)
      ? Math.abs(百分点)
      : Number.isFinite(绝对值) && Math.abs(绝对值) > 0
        ? Math.abs(绝对值)
        : 1;
  const 数值倍率 = 基础数值倍率;
  const 数值类型 = 资源绝对值
    ? '绝对值点数'
    : 召唤数值倍率 !== null
      ? '召唤强度'
    : Number.isFinite(百分点)
      ? '百分比百分点'
      : Number.isFinite(绝对值)
        ? '绝对值'
        : '固定值';
  return {
    COST: (实际单位COST * 数值倍率 * 属性数量系数 + 附加规则COST) * 目标系数 * 持续系数,
    百分比,
    数值类型,
    百分点: Number.isFinite(百分点) ? Number(百分点.toFixed(4)) : null,
    绝对值: Number.isFinite(绝对值) ? Number(绝对值.toFixed(4)) : null,
    绝对值折算百分点: null,
    固定值系数: null,
    绝对值每COST点数: 资源绝对值 ? 资源绝对值每COST点数_V1 : null,
    单位COST: Number(实际单位COST.toFixed(4)),
    数值倍率: Number(数值倍率.toFixed(4)),
    附加规则COST: Number(附加规则COST.toFixed(4)),
    数量系数: Number(属性数量系数.toFixed(4)),
    目标系数: Number(目标系数.toFixed(4)),
    目标系数原因: 目标信息.目标系数原因,
    持续系数: Number(持续系数.toFixed(4)),
  };
}

function 计算技能效果累计COST_V1(技能 = {}, 上下文 = {}) {
  const 效果数组 = Array.isArray(技能?._效果数组) ? 技能._效果数组 : (Array.isArray(技能) ? 技能 : []);
  const 限制抵扣上限 = 读取技能限制抵扣上限_V1(技能);
  const 新建统计 = () => ({ 百分比累计: 0, 绝对值累计: 0, 限制累计: 0, 明细: [] });
  const 合并统计 = (目标, 来源) => {
    目标.百分比累计 += 来源.百分比累计 || 0;
    目标.绝对值累计 += 来源.绝对值累计 || 0;
    目标.限制累计 += 来源.限制累计 || 0;
    目标.明细.push(...(Array.isArray(来源.明细) ? 来源.明细 : []));
    return 目标;
  };
  const 统计原始COST = 统计 => Number(((统计?.百分比累计 || 0) + (统计?.绝对值累计 || 0)).toFixed(2));
  const 统计净COST = 统计 => Number(Math.max(0, 统计原始COST(统计) - Number(统计?.限制累计 || 0)).toFixed(2));
  const 标记明细 = (统计, 分支角色, 计入COST) => ({
    百分比累计: 统计.百分比累计 || 0,
    绝对值累计: 统计.绝对值累计 || 0,
    限制累计: 计入COST ? (统计.限制累计 || 0) : 0,
    明细: (Array.isArray(统计.明细) ? 统计.明细 : []).map(项 => ({
      ...项,
      分支角色: 分支角色 === '基础' && 项.分支角色 === '追加' ? '追加' : 分支角色,
      计入COST,
    })),
  });
  const 访问列表 = (列表, 路径, 继承抵扣率 = 0, 分支角色 = '基础') => {
    const 统计 = 新建统计();
    (Array.isArray(列表) ? 列表 : []).forEach((效果, 序号) => {
      合并统计(统计, 访问(效果, `${路径}[${序号}]`, 继承抵扣率, 分支角色));
    });
    return 统计;
  };
  const 访问 = (效果, 路径, 继承抵扣率 = 0, 分支角色 = '基础') => {
    if (!效果 || typeof 效果 !== 'object' || Array.isArray(效果)) return 新建统计();
    const 基础统计 = 新建统计();
    const 单项 = 计算单项效果COST_V1(效果, 上下文);
    const 原始COST = Number(单项.COST || 0);
    const 限制信息 = 读取效果限制抵扣信息_V1(效果, 继承抵扣率, { 限制抵扣上限 });
    const 抵扣率 = 限制信息.抵扣率;
    const 限制抵扣 = Number(Math.min(原始COST * 0.8, 原始COST * 抵扣率).toFixed(2));
    const 净COST = Number(Math.max(0, 原始COST - 限制抵扣).toFixed(2));
    if (Number.isFinite(原始COST) && 原始COST > 0) {
      if (单项.百分比) 基础统计.百分比累计 += 原始COST;
      else 基础统计.绝对值累计 += 原始COST;
      基础统计.限制累计 += 限制抵扣;
      const 关键字段 = 读取技能效果关键字段_V1(效果);
      基础统计.明细.push({
        路径,
        分支角色,
        计入COST: true,
        原型: String(效果.原型 || '').trim(),
        关键字段: 关键字段.字段,
        关键值: 关键字段.值,
        目标: String(效果.目标 || '单体').trim(),
        持续回合: Number(效果.持续回合 ?? 1),
        数值: 效果.数值 ?? '',
        副数值: 效果.副数值 ?? '',
        威力倍率: 效果.威力倍率 ?? '',
        伤害类型: 效果.伤害类型 ?? '',
        数值类型: 单项.数值类型 || '',
        百分点: 单项.百分点,
        绝对值: 单项.绝对值,
        绝对值折算百分点: 单项.绝对值折算百分点,
        固定值系数: 单项.固定值系数,
        单位COST: 单项.单位COST,
        副数值单位COST: 单项.副数值单位COST ?? null,
        数值倍率: 单项.数值倍率,
        副数值倍率: 单项.副数值倍率 ?? null,
        主数值COST: 单项.主数值COST ?? null,
        副数值COST: 单项.副数值COST ?? null,
        固定规则COST: 单项.固定规则COST ?? null,
        触发方式COST: 单项.触发方式COST ?? null,
        延迟回合COST: 单项.延迟回合COST ?? null,
        附加规则COST: 单项.附加规则COST ?? null,
        目标系数: 单项.目标系数,
        目标系数原因: 单项.目标系数原因 || '',
        持续系数: 单项.持续系数,
        限定元素: 限制信息.限定元素 || '',
        限制来源: 限制信息.限制来源 || '',
        限制抵扣率: Number((限制信息.抵扣率 || 0).toFixed(4)),
        原始COST: Number(原始COST.toFixed(2)),
        限制抵扣,
        净COST,
      });
    }
    技能执行嵌套效果数组字段表_V1.forEach(字段名 => {
      (Array.isArray(效果?.[字段名]) ? 效果[字段名] : []).forEach((子效果, 序号) => {
        合并统计(基础统计, 访问(子效果, `${路径}.${字段名}[${序号}]`, 抵扣率, 分支角色));
      });
    });
    const 候选统计列表 = [标记明细(基础统计, 分支角色, true)];
    (Array.isArray(效果.条件分支) ? 效果.条件分支 : []).forEach((分支, 分支序号) => {
      if (Array.isArray(分支?.替换效果) && 分支.替换效果.length) {
        候选统计列表.push(访问列表(分支.替换效果, `${路径}.条件分支[${分支序号}].替换效果`, 抵扣率, '替换'));
      }
      if (Array.isArray(分支?.追加效果) && 分支.追加效果.length) {
        合并统计(候选统计列表[0], 访问列表(分支.追加效果, `${路径}.条件分支[${分支序号}].追加效果`, 抵扣率, '追加'));
      }
    });
    const 选中序号 = 候选统计列表.reduce((最佳序号, 当前, 序号, 列表) => (
      统计净COST(当前) > 统计净COST(列表[最佳序号]) ? 序号 : 最佳序号
    ), 0);
    const 返回统计 = 新建统计();
    候选统计列表.forEach((统计, 序号) => {
      const 计入COST = 序号 === 选中序号;
      const 角色 = 序号 === 0 ? (计入COST ? 分支角色 : `${分支角色}候选`) : (计入COST ? '替换' : '替换候选');
      const 标记统计 = 标记明细(统计, 角色, 计入COST);
      if (计入COST) {
        返回统计.百分比累计 += 标记统计.百分比累计 || 0;
        返回统计.绝对值累计 += 标记统计.绝对值累计 || 0;
        返回统计.限制累计 += 标记统计.限制累计 || 0;
      }
      返回统计.明细.push(...标记统计.明细);
    });
    return 返回统计;
  };
  const 总统计 = 访问列表(效果数组, Array.isArray(技能) ? '' : '_效果数组', 0, '基础');
  const 百分比累计 = 总统计.百分比累计;
  const 绝对值累计 = 总统计.绝对值累计;
  const 限制累计 = 总统计.限制累计;
  const 明细 = 总统计.明细;
  const 总COST = 百分比累计 + 绝对值累计;
  return {
    总COST: Number(总COST.toFixed(2)),
    百分比COST: Number(百分比累计.toFixed(2)),
    绝对值COST: Number(绝对值累计.toFixed(2)),
    限制COST: Number(限制累计.toFixed(2)),
    净COST: Number(Math.max(0, 总COST - 限制累计).toFixed(2)),
    明细,
  };
}

function 读取魂环年限原始值_V1(角色 = {}, 魂技位 = 1, 上下文 = {}) {
  const 序号 = Math.max(1, Math.floor(Number(魂技位 || 1)));
  if (上下文?.魂环数据 && typeof 上下文.魂环数据 === 'object') return 上下文.魂环数据.年限 ?? 上下文.魂环数据.颜色 ?? 0;
  if (Array.isArray(上下文?.魂环)) {
    const 当前魂环 = 上下文.魂环[序号 - 1];
    if (当前魂环 && typeof 当前魂环 === 'object' && !Array.isArray(当前魂环)) return 当前魂环.年限 ?? 当前魂环.颜色 ?? 0;
    if (当前魂环 !== undefined) return 当前魂环;
  }
  if (上下文?.魂环 && typeof 上下文.魂环 === 'object') return 上下文.魂环.年限 ?? 上下文.魂环.颜色 ?? 0;
  if (上下文?.ringAge !== undefined || 上下文?.age !== undefined) return 上下文.ringAge ?? 上下文.age;
  if (Array.isArray(角色?.魂环)) {
    const 当前魂环 = 角色.魂环[序号 - 1];
    if (当前魂环 && typeof 当前魂环 === 'object' && !Array.isArray(当前魂环)) return 当前魂环.年限 ?? 当前魂环.颜色 ?? 0;
    if (当前魂环 !== undefined) return 当前魂环;
  }
  return Array.isArray(角色?.魂环年限) ? 角色.魂环年限[序号 - 1] : 0;
}

function 读取魂环颜色文本_V1(角色 = {}, 魂技位 = 1, 上下文 = {}) {
  const 候选 = [
    上下文?.魂环数据?.颜色,
    上下文?.魂环?.颜色,
    上下文?.魂环颜色,
    上下文?.ringColor,
    读取魂环年限原始值_V1(角色, 魂技位, 上下文),
  ];
  return 候选.map(值 => String(值 ?? '').trim()).filter(Boolean).join(' ');
}

function 读取魂环年限数值_V1(角色 = {}, 魂技位 = 1, 上下文 = {}) {
  const 原始 = 读取魂环年限原始值_V1(角色, 魂技位, 上下文);
  const 数值 = Number(原始);
  if (Number.isFinite(数值) && 数值 > 0) return 数值;
  const 文本 = String(原始 ?? '').trim();
  const 匹配 = 文本.match(/(\d+(?:\.\d+)?)\s*(万|千|百)?年?/);
  if (!匹配) return 0;
  const 基数 = Number(匹配[1]);
  const 单位 = 匹配[2] || '';
  if (!Number.isFinite(基数) || 基数 <= 0) return 0;
  if (单位 === '万') return 基数 * 10000;
  if (单位 === '千') return 基数 * 1000;
  if (单位 === '百') return 基数 * 100;
  return 基数;
}

function 魂环是百万金色_V1(角色 = {}, 魂技位 = 1, 上下文 = {}) {
  const 年限 = 读取魂环年限数值_V1(角色, 魂技位, 上下文);
  const 文本 = 读取魂环颜色文本_V1(角色, 魂技位, 上下文);
  return 年限 >= 1000000 || /百万年|绿金|白金|灿金|赤金|金色|金环|金魂环/.test(文本);
}

function 计算魂环年限COST修正_V1(角色 = {}, 魂技位 = 1, 上下文 = {}) {
  const 位 = Math.max(1, Math.floor(Number(魂技位 || 1)));
  const 年限 = 读取魂环年限数值_V1(角色, 位, 上下文);
  if (魂环是百万金色_V1(角色, 位, 上下文)) return 位 >= 10 ? 30 : 40;
  if (位 >= 10) {
    if (年限 >= 1000000) return 30;
    if (年限 >= 200000) return 10;
    if (年限 >= 100000) return 5;
    return 0;
  }
  if (位 <= 2) {
    if (年限 >= 1000) return 10;
    if (年限 >= 100) return 5;
    return 0;
  }
  if (位 === 3) {
    if (年限 >= 10000) return 15;
    if (年限 >= 1000) return 5;
    return 0;
  }
  if (位 === 4) {
    if (年限 >= 10000) return 10;
    if (年限 >= 1000) return 5;
    return 0;
  }
  if (年限 >= 200000) return 20;
  if (年限 >= 100000) return 15;
  if (年限 >= 10000) return 5;
  return 0;
}
function 计算魂环年限修正_V1(角色 = {}, 魂技位 = 1) {
  return 计算魂环年限COST修正_V1(角色, 魂技位);
}

function 读取特殊魂技天赋预算倍率_V1(角色 = {}, 上下文 = {}) {
  const 天赋梯队 = String(角色?.属性?.天赋梯队 ?? 角色?.天赋梯队 ?? 上下文?.talentTier ?? '正常').trim() || '正常';
  return Number(特殊魂技天赋预算倍率表_V1[天赋梯队] ?? 特殊魂技天赋预算倍率表_V1.正常);
}

function 计算武魂真身年限预算倍率_V1(年限 = 0) {
  const 安全年限 = Math.max(0, Number(年限 || 0));
  if (!(安全年限 >= 10000)) return 0.7;
  const 插值 = (当前, 起点, 终点, 起值, 终值) => {
    const 比例 = Math.max(0, Math.min(1, Math.log10(Math.max(1, 当前 / 起点)) / Math.log10(终点 / 起点)));
    return 起值 + (终值 - 起值) * 平滑插值比例_V1(比例);
  };
  if (安全年限 < 100000) return 插值(安全年限, 10000, 100000, 1, 1.5);
  if (安全年限 < 1000000) return 插值(安全年限, 100000, 1000000, 1.5, 2.2);
  return 2.2;
}

function 计算武魂真身预算基准_V1(角色 = {}, 魂技位 = 7, 上下文 = {}) {
  const 年限 = 读取魂环年限数值_V1(角色, 魂技位, 上下文);
  const 天赋倍率 = 读取特殊魂技天赋预算倍率_V1(角色, 上下文);
  const 年限倍率 = 计算武魂真身年限预算倍率_V1(年限);
  return {
    类型: '武魂真身',
    基准: 武魂真身基础预算_V1,
    天赋倍率,
    年限,
    年限倍率,
    特殊运转基准: Number((武魂真身基础预算_V1 * 天赋倍率 * 年限倍率).toFixed(2)),
  };
}

function 读取预算融合参与者列表_V1(融合技 = {}, 上下文 = {}) {
  const 来源列表 = Array.isArray(融合技?.融合参与者) && 融合技.融合参与者.length
    ? 融合技.融合参与者
    : (Array.isArray(上下文?.融合参与者) ? 上下文.融合参与者 : []);
  const 列表 = 来源列表.map(项 => {
    if (typeof 项 === 'string') return { 角色名: 项, 类型: '搭档' };
    if (!项 || typeof 项 !== 'object') return null;
    return {
      类型: String(项.类型 || 项.role || '').trim(),
      角色键: String(项.角色键 || 项.charKey || 项.key || '').trim(),
      角色名: String(项.角色名 || 项.charName || 项.name || 项.角色键 || 项.charKey || '').trim(),
    };
  }).filter(Boolean);
  if (列表.length) return 列表;
  const 融合对象 = String(融合技?.融合对象 || 上下文?.融合对象 || '').trim();
  return 融合对象 ? [{ 类型: '搭档', 角色名: 融合对象 }] : [];
}

function 读取预算数据根_V1(上下文 = {}) {
  return 上下文?.rootData || 上下文?.数据根 || 上下文?.mvuData || 上下文?.根数据 || null;
}

function 读取预算参与者角色_V1(参与者 = {}, 默认角色 = {}, 上下文 = {}) {
  if (/自身|self/i.test(String(参与者?.类型 || '').trim())) return 默认角色;
  const 数据根 = 读取预算数据根_V1(上下文);
  const 角色键 = String(参与者?.角色键 || '').trim();
  if (角色键 && 数据根?.char?.[角色键]) return 数据根.char[角色键];
  const 角色名 = String(参与者?.角色名 || '').trim();
  if (角色名 && 数据根?.char?.[角色名]) return 数据根.char[角色名];
  return null;
}

function 计算预算融合相关度总分_V1(角色 = {}, 融合技 = {}, 上下文 = {}) {
  const 模式 = String(融合技?.融合模式 || 上下文?.融合模式 || '').trim();
  if (模式 === 'self') return 100;
  const 参与者列表 = 读取预算融合参与者列表_V1(融合技, 上下文).filter(项 => !/自身|self/i.test(String(项?.类型 || '').trim()));
  const 关系表 = 角色?.社交?.关系 && typeof 角色.社交.关系 === 'object' ? 角色.社交.关系 : {};
  const 分数 = 参与者列表.map(项 => {
    const 名称 = String(项?.角色名 || 项?.角色键 || '').trim();
    const 关系 = 名称 ? 关系表[名称] : null;
    if (!关系 || typeof 关系 !== 'object') return null;
    return 计算武魂相关度总分(关系);
  }).filter(值 => Number.isFinite(值));
  if (!分数.length) return 70;
  return Math.max(0, Math.min(100, Math.floor(Math.min(...分数))));
}

function 计算融合相关度预算倍率_V1(相关度总分 = 70) {
  const 安全总分 = Math.max(0, Math.min(100, Number(相关度总分 || 0)));
  if (安全总分 < 70) return 1;
  return Number((1 + ((安全总分 - 70) / 30) * 0.25).toFixed(4));
}

function 计算武魂融合技预算基准_V1(技能 = {}, 角色 = {}, 上下文 = {}) {
  const 融合技 = 上下文?.融合技 && typeof 上下文.融合技 === 'object' ? 上下文.融合技 : 上下文;
  const 参与者列表 = 读取预算融合参与者列表_V1(融合技, 上下文);
  const 全部参与者 = 参与者列表.some(项 => /自身|self/i.test(String(项?.类型 || '').trim()))
    ? 参与者列表
    : [{ 类型: '自身' }, ...参与者列表];
  const 参与者数量 = Math.max(2, 全部参与者.length || 2);
  const 天赋倍率列表 = 全部参与者.map(项 => {
    const 参与者角色 = 读取预算参与者角色_V1(项, 角色, 上下文);
    return 读取特殊魂技天赋预算倍率_V1(参与者角色 || {}, 参与者角色 ? 上下文 : { ...上下文, talentTier: '正常' });
  });
  const 平均天赋倍率 = 天赋倍率列表.length
    ? 天赋倍率列表.reduce((总和, 值) => 总和 + Number(值 || 0), 0) / 天赋倍率列表.length
    : 特殊魂技天赋预算倍率表_V1.正常;
  const 人数系数 = Math.max(1, 参与者数量 / 2);
  const 融合度总分 = 计算预算融合相关度总分_V1(角色, 融合技, 上下文);
  const 融合度倍率 = 计算融合相关度预算倍率_V1(融合度总分);
  return {
    类型: '武魂融合技',
    基准: 武魂融合技基础预算_V1,
    参与者数量,
    平均天赋倍率: Number(平均天赋倍率.toFixed(4)),
    人数系数: Number(人数系数.toFixed(4)),
    融合度总分,
    融合度倍率,
    特殊运转基准: Number((武魂融合技基础预算_V1 * 平均天赋倍率 * 人数系数 * 融合度倍率).toFixed(2)),
  };
}

// v4：从 path 推断来源类别（path 可为数组 ['char','魂技',0] 或字符串 'char.魂技[0]'）
function 推断技能来源_V1(path = []) {
  const 数组 = Array.isArray(path)
    ? path.map(段 => String(段 ?? ''))
    : String(path ?? '').split(/[./[\]]/).filter(Boolean);
  if (数组.includes('武魂融合技')) return '武魂融合技';
  if (数组.includes('魂骨')) return '魂骨技能';
  if (数组.includes('自创魂技')) return '自创魂技';
  if (数组.includes('血脉之力')) {
    if (数组.some(段 => 是气血魂环槽位键_V1(段) || 是血脉魂技槽位键_V1(段))) return '气血魂技';
    if (数组.includes('技能') || 数组.includes('被动')) return '血脉技能';
  }
  if (数组.includes('血脉技能')) return '血脉技能';
  if (数组.includes('气血魂技')) return '气血魂技';
  if (数组.includes('精神领域')) return '精神领域';
  if (数组.includes('装备技能')) return '装备技能';
  if (数组.includes('物品技能')) return '物品技能';
  if (数组.includes('魂技') || 数组.includes('魂环')) return '魂技';
  return '魂技';
}

// v4：从来源 + 上下文映射虚拟魂技位（用于无固有位级的来源）
function 推断虚拟魂技位_V1(来源 = '魂技', 上下文 = {}) {
  const { 角色 = {}, 魂骨年限, 魂环位 } = 上下文 || {};
  const 角色等级 = Number(角色?.等级 ?? 0);
  if (来源 === '魂技' || 来源 === '自创魂技') {
    if (Number.isFinite(Number(魂环位))) return Math.max(1, Math.min(9, Math.floor(Number(魂环位))));
    if (角色等级 > 0) return Math.max(1, Math.min(9, Math.floor(角色等级 / 10)));
    return 1;
  }
  if (来源 === '武魂融合技') {
    if (角色等级 > 0) return Math.max(1, Math.min(9, Math.floor(角色等级 / 10)));
    return 5;
  }
  if (来源 === '魂骨技能') {
    const 年限 = Number(魂骨年限 ?? 0);
    if (年限 >= 1000000) return 9;
    if (年限 >= 100000) return 7;
    if (年限 >= 10000) return 5;
    if (年限 >= 1000) return 3;
    return 1;
  }
  // 血脉/气血/精神领域/装备/物品 等：用角色等级映射，否则中位
  if (角色等级 > 0) return Math.max(1, Math.min(9, Math.floor(角色等级 / 10)));
  return 5;
}

function 读取魂骨技能年限_V1(上下文 = {}) {
  const 年限 = Number(上下文?.魂骨年限 ?? 上下文?.boneAge ?? 上下文?.age ?? 上下文?.ringAge ?? 上下文?.年限 ?? 0);
  return Number.isFinite(年限) && 年限 > 0 ? Math.floor(年限) : 0;
}

function 计算魂骨技能预算门禁_V1(年限 = 0) {
  const 安全年限 = Math.max(0, Math.floor(Number(年限 || 0)));
  if (安全年限 < 1000) return 15;
  if (安全年限 < 10000) return Math.floor((安全年限 / 1000) * 3 + 15);
  return Math.floor((安全年限 / 10000) * 5 + 40);
}

function 是血脉技能预算豁免上下文_V1(上下文 = {}, path = '') {
  const 来源文本 = String(上下文?.sourceCategory || 上下文?.来源 || 上下文?.来源类别 || '').trim();
  if (['血脉技能', '气血魂技'].includes(来源文本)) return true;
  if (上下文?.跳过预算门禁 === true && 上下文?.血脉技能 === true) return true;
  const 路径源 = Array.isArray(path) ? path : `${String(path ?? '')}.${String(上下文?.path ?? '')}`;
  const 路径数组 = Array.isArray(路径源)
    ? 路径源.map(段 => String(段 ?? ''))
    : String(路径源).split(/[./[\]]/).filter(Boolean);
  if (!路径数组.includes('血脉之力')) return false;
  return 路径数组.includes('技能') ||
    路径数组.includes('被动') ||
    路径数组.some(段 => 是气血魂环槽位键_V1(段) || 是血脉魂技槽位键_V1(段));
}

// v4：来源承载系数——复用项目已有 直接结算收益预算系数_V1.来源承载
// v4：来源承载覆盖表——用户口径：魂骨与魂技相同（强度梯度：魂技/魂骨=1.0、自创比魂技强、武魂融合技碾压）
// 不动旧体系 直接结算收益预算系数_V1.来源承载，仅在 v4 评估中应用此覆盖
var v4来源承载覆盖_V1 = Object.freeze({
  魂骨技能: 1.0,
});

function 来源承载系数_V1(来源 = '魂技') {
  // 优先 v4 覆盖
  if (v4来源承载覆盖_V1[来源] !== undefined) return v4来源承载覆盖_V1[来源];
  try {
    const 表 = 直接结算收益预算系数_V1?.来源承载 || {};
    const 值 = 表[来源];
    if (typeof 值 === 'number' && Number.isFinite(值) && 值 > 0) return 值;
    return 表.默认 ?? 1;
  } catch (e) {
    return 1;
  }
}

function 计算天赋梯队COST修正_V1(角色 = {}) {
  const 梯队表 = ['天赋极差', '劣等', '正常', '优秀', '天才', '顶级天才', '绝世妖孽'];
  const 天赋梯队 = String(角色?.属性?.天赋梯队 ?? 角色?.天赋梯队 ?? '正常').trim() || '正常';
  const 当前序号 = 梯队表.includes(天赋梯队) ? 梯队表.indexOf(天赋梯队) : 梯队表.indexOf('正常');
  return (当前序号 - 梯队表.indexOf('正常')) * 3;
}

var 生成预算利用率档位_V1 = Object.freeze({
  天赋极差: Object.freeze([0.80, 0.82]),
  劣等: Object.freeze([0.80, 0.83]),
  正常: Object.freeze([0.80, 0.85]),
  优秀: Object.freeze([0.82, 0.87]),
  天才: Object.freeze([0.85, 0.90]),
  顶级天才: Object.freeze([0.90, 0.95]),
  绝世妖孽: Object.freeze([0.95, 1.00]),
});

function 读取生成随机数_V1(上下文 = {}, 盐 = 0) {
  if (typeof 上下文?.随机函数 === 'function') {
    const 值 = Number(上下文.随机函数(盐));
    return Number.isFinite(值) ? Math.max(0, Math.min(0.999999, 值)) : Math.random();
  }
  const 种子源 = 上下文?.随机种子 ?? 上下文?.seed;
  if (种子源 !== undefined && 种子源 !== null && String(种子源).trim() !== '') {
    let 状态 = 0;
    String(`${种子源}:${盐}`).split('').forEach(字符 => {
      状态 = (状态 * 31 + 字符.charCodeAt(0)) % 2147483647;
    });
    状态 = 状态 <= 0 ? 1 : 状态;
    状态 = (状态 * 16807) % 2147483647;
    return (状态 - 1) / 2147483646;
  }
  return Math.random();
}

function 计算天赋预算利用率_V1(角色 = {}, 上下文 = {}) {
  const 天赋梯队 = String(角色?.属性?.天赋梯队 ?? 角色?.天赋梯队 ?? 上下文?.talentTier ?? '正常').trim() || '正常';
  const 档位 = 生成预算利用率档位_V1[天赋梯队] || 生成预算利用率档位_V1.正常;
  const 浮动 = 读取生成随机数_V1(上下文, 17);
  return Number((档位[0] + (档位[1] - 档位[0]) * 浮动).toFixed(4));
}

function 计算生成目标COST_V1(评估 = {}, 上下文 = {}) {
  const 运转基准 = Math.max(0.5, Number(评估?.运转基准 || 0));
  if (评估?.特殊预算 && typeof 评估.特殊预算 === 'object') {
    const 当前门禁 = Math.max(0.5, Number(评估?.实际门禁 || 0) || 运转基准);
    const 比例 = Math.max(0.8, Math.min(1, Number(上下文?.目标比例 || 0) || (0.8 + 读取生成随机数_V1(上下文, 29) * 0.2)));
    return {
      生成目标COST: Number((当前门禁 * 比例).toFixed(2)),
      生成目标比例: Number(比例.toFixed(4)),
    };
  }
  const 魂技位 = Math.max(1, Math.floor(Number(评估?.魂技位 ?? 上下文?.魂环位 ?? 上下文?.ringIndex ?? 1)) || 1);
  const 位级倍率上限 = 读取魂技位COST倍率上限_V1(魂技位);
  const 比例上限 = Number.isFinite(位级倍率上限) ? 位级倍率上限 : Math.cbrt(16);
  const 比例 = Math.max(0.8, Math.min(比例上限, Number(上下文?.目标比例 || 0) || (0.8 + 读取生成随机数_V1(上下文, 29) * Math.max(0, 比例上限 - 0.8))));
  return {
    生成目标COST: Number((运转基准 * 比例).toFixed(2)),
    生成目标比例: Number(比例.toFixed(4)),
  };
}

function 构建自动生成预算上下文_V1(上下文 = {}) {
  const 魂环位 = Math.max(1, Math.floor(Number(上下文?.ringIndex ?? 上下文?.魂环位 ?? 1) || 1));
  const 标准等级 = Math.max(1, 10 * Math.min(9, 魂环位) + 1);
  const 原始角色 = 上下文?.角色 && typeof 上下文.角色 === 'object' && !Array.isArray(上下文.角色) ? 上下文.角色 : null;
  const 角色 = 原始角色 ? cloneJsonValue(原始角色, {}) : getBaseStats(标准等级);
  if (!角色.属性 || typeof 角色.属性 !== 'object' || Array.isArray(角色.属性)) 角色.属性 = {};
  const 天赋梯队 = String(
    角色?.属性?.天赋梯队 ??
      角色?.天赋梯队 ??
      上下文?.talentTier ??
      '正常',
  ).trim() || '正常';
  角色.属性.天赋梯队 = 天赋梯队;
  if (!Number.isFinite(Number(角色.属性.等级)) && !Number.isFinite(Number(角色.等级))) 角色.属性.等级 = 标准等级;
  const 魂环数据 = 上下文?.魂环数据 && typeof 上下文.魂环数据 === 'object' && !Array.isArray(上下文.魂环数据)
    ? 上下文.魂环数据
    : (上下文?.魂环 && typeof 上下文.魂环 === 'object' && !Array.isArray(上下文.魂环) ? 上下文.魂环 : undefined);
  const 年限 = 上下文?.ringAge ?? 上下文?.age ?? 上下文?.年限 ?? 魂环数据?.年限;
  return {
    ...(上下文 || {}),
    角色,
    施术者: 上下文?.施术者 || 角色,
    魂环位,
    ringIndex: 魂环位,
    ...(年限 !== undefined ? { ringAge: 年限, age: 年限 } : {}),
    ...(魂环数据 ? { 魂环数据 } : {}),
    来源: 上下文?.来源 || 上下文?.sourceCategory || '魂技',
    来源类别: 上下文?.来源类别 || 上下文?.sourceCategory || 上下文?.来源 || '魂技',
    sourceCategory: 上下文?.sourceCategory || 上下文?.来源类别 || 上下文?.来源 || '魂技',
    系别: String(上下文?.系别 || 上下文?.type || 上下文?.武魂系别 || 角色?.系别 || 取角色主武魂系别_V1(角色) || '强攻系').trim() || '强攻系',
    武魂系别: String(上下文?.武魂系别 || 上下文?.系别 || 上下文?.type || 角色?.系别 || 取角色主武魂系别_V1(角色) || '强攻系').trim() || '强攻系',
  };
}

// 总预算评估：阶段 3-7 共用入口
// v4：双目标体系 — 目标1（消耗/前摇 ↔ 效果对等，全场景）+ 目标2（生成位级硬上限，仅生成器）
// 调用签名：评估技能预算_V1(技能, 上下文)；数字第二参仅保留给当前内部旧调用入口。
function 评估技能预算_V1(技能 = {}, 上下文或魂技位 = {}, 旧上下文 = {}) {
  // 兼容签名：第二参传数字时按旧版（魂技位）；传对象时按 v10 上下文
  const 上下文 = (typeof 上下文或魂技位 === 'number')
    ? { ...(旧上下文 || {}), 魂环位: 上下文或魂技位 }
    : (上下文或魂技位 || {});

  if (上下文?.魂环位 === undefined && 上下文?.ringIndex !== undefined) {
    上下文.魂环位 = Math.max(1, Math.floor(Number(上下文.ringIndex || 1)) || 1);
  }
  const 来源判定 = 判定技能消耗来源_V1(技能, 上下文);
  const 来源 = 来源判定.有效来源 || 来源判定.来源;
  const 来源承载 = 来源承载系数_V1(来源);
  const 魂技位 = 来源判定.武魂真身 ? 7 : 推断虚拟魂技位_V1(来源, 上下文);
  const 角色 = 上下文?.角色 || {};

  const 技能上下文 = { ...上下文, 技能 };
  const 武魂融合技百分比消耗 = 来源判定.武魂融合技 && 技能消耗包含百分比_V1(技能?.消耗, 技能上下文);
  const 武魂真身百分比消耗 = !武魂融合技百分比消耗 && 来源判定.武魂真身 && 技能消耗包含百分比_V1(技能?.消耗, 技能上下文);
  const 标准消耗 = 武魂真身百分比消耗 || 武魂融合技百分比消耗 ? null : 获取标准消耗_V1(魂技位);
  const 实际魂环位 = Math.max(1, Math.floor(Number(上下文?.魂环位 ?? 上下文?.ringIndex ?? 魂技位 ?? 1) || 1));
  const 魂环年限COST修正 = 计算魂环年限COST修正_V1(角色, 实际魂环位, 上下文);
  const 天赋修正 = 计算天赋梯队COST修正_V1(角色);

  const 资源上下文 = { ...上下文, 技能, 角色, 等级: 上下文?.等级 ?? 角色?.属性?.等级 };
  const 承载消耗比例 = 读取技能承载消耗比例_V1(技能, 资源上下文);
  const 实际消耗 = Number.isFinite(标准消耗) ? 读取技能实际消耗_V1(技能, 资源上下文, 标准消耗) : 0;
  const 消耗倍数 = 武魂真身百分比消耗 || 武魂融合技百分比消耗
    ? Math.max(0.05, Math.min(4, 承载消耗比例 / 获取武魂真身运转标准消耗比例_V1()))
    : Number.isFinite(标准消耗) && 标准消耗 > 0
      ? Math.max(0.05, Math.min(4, 实际消耗 / Math.max(1, 标准消耗)))
      : 1;
  const 前摇倍数 = 计算前摇倍数_V1(技能, 上下文);
  const 标准前摇 = 获取标准前摇_V1();
  const 实际前摇 = 读取技能实际前摇_V1(技能, 上下文);
  const 基础参考 = 获取基础预算_V1(魂技位);

  const COST明细 = 计算技能效果累计COST_V1(技能, { ...上下文, 角色, 等级: 角色?.属性?.等级 });
  const 副作用明细 = 计算技能副作用COST_V1(技能);
  const 效果原始COST = COST明细.总COST;
  const 限制COST = COST明细.限制COST;
  const 副作用原始COST = 副作用明细.总COST;
  const 百分比COST = COST明细.百分比COST;
  const 绝对值COST = COST明细.绝对值COST;

  const 触发档 = 评估触发限制档_V1(技能);
  const 副作用档 = 评估副作用预算档_V1(技能);

  const 代价能量 = 计算运转代价能量_V1(消耗倍数, 前摇倍数);
  const 特殊预算 = 武魂真身百分比消耗
    ? 计算武魂真身预算基准_V1(角色, 实际魂环位, 上下文)
    : 来源 === '武魂融合技'
      ? 计算武魂融合技预算基准_V1(技能, 角色, 上下文)
      : null;
  const 运转基准 = Math.max(
    0.5,
    特殊预算
      ? Number(特殊预算.特殊运转基准 || 0)
      : 基础参考 * 来源承载 + 魂环年限COST修正 + 天赋修正,
  );
  const 抵扣前净COST = Number(Math.max(0, 效果原始COST - 限制COST).toFixed(2));
  const 对等基线 = 运转基准 * 代价能量;
  const 允许上限 = Math.max(0.5, 对等基线);

  const 魂技位倍率上限 = 读取魂技位COST倍率上限_V1(魂技位);
  const 魂骨技能年限 = 来源 === '魂骨技能' ? 读取魂骨技能年限_V1(上下文) : 0;
  const 魂骨技能门禁 = 来源 === '魂骨技能' ? 计算魂骨技能预算门禁_V1(魂骨技能年限) : null;
  const 位级硬上限 = 武魂真身百分比消耗 || 来源 === '武魂融合技'
    ? Infinity
    : (来源 === '魂骨技能'
      ? Infinity
      : (Number.isFinite(魂技位倍率上限) ? Math.max(0.5, 运转基准 * 魂技位倍率上限) : Infinity));
  const 实际门禁 = 来源 === '魂骨技能'
    ? Math.max(0.5, Number(魂骨技能门禁 || 0))
    : Math.min(允许上限, 位级硬上限);
  const 最低有效COST = 读取预算评估最低有效COST_V1({ 运转基准, 实际门禁 }, 上下文);
  const 副作用COST = Number(Math.min(
    Math.max(0, 副作用原始COST),
    Math.max(0, 抵扣前净COST - 最低有效COST),
  ).toFixed(2));
  const 实际COST = Number(Math.max(0, 抵扣前净COST - 副作用COST).toFixed(2));

  return {
    来源,
    魂技位,
    实际COST,
    效果原始COST,
    副作用COST,
    副作用原始COST: Number(Math.max(0, 副作用原始COST).toFixed(2)),
    副作用有效COST: 副作用COST,
    限制COST,
    抵扣前净COST,
    最低有效COST,
    超出COST: Number(Math.max(0, 实际COST - 实际门禁).toFixed(2)),
    百分比COST,
    绝对值COST,
    效果明细: COST明细.明细 || [],
    副作用明细: 副作用明细.明细 || [],
    限制明细: (COST明细.明细 || []).filter(项 => Number(项.限制抵扣 || 0) > 0),
    标准消耗: Number.isFinite(标准消耗) ? 标准消耗 : null,
    运转标准消耗: Number.isFinite(标准消耗) ? 标准消耗 : null,
    标准前摇,
    武魂真身百分比消耗,
    武魂融合技百分比消耗,
    特殊预算,
    武魂真身运转标准消耗比例: 武魂真身百分比消耗 || 武魂融合技百分比消耗 ? 获取武魂真身运转标准消耗比例_V1() : null,
    实际消耗,
    实际前摇,
    承载消耗比例: Number(承载消耗比例.toFixed(4)),
    消耗倍数,
    前摇倍数,
    基础参考,
    来源承载,
    运转基准: Number(运转基准.toFixed(2)),
    代价能量: Number(代价能量.toFixed(3)),
    允许上限: Number(允许上限.toFixed(2)),
    位级硬上限: Number.isFinite(位级硬上限) ? Number(位级硬上限.toFixed(2)) : null,
    魂技位倍率上限: Number.isFinite(魂技位倍率上限) ? Number(魂技位倍率上限.toFixed(2)) : null,
    实际门禁: Number(实际门禁.toFixed(2)),
    触发档,
    副作用档,
    触发比例: 0,
    副作用比例: 0,
    魂环年限COST修正,
    天赋修正,
    对等基线: Number(对等基线.toFixed(2)),
    魂骨技能年限,
    魂骨技能门禁,
    是否超预算: 技能COST超预算_V1(实际COST, 实际门禁),
  };
}

// v8.2：条件分支三道约束 — (a) ≤3 个 (b) 嵌套 ≤2 层（拍平第 3 层） (c) 近似合并（强度差<20%）
function 条件分支约束_V1(skill = {}, 当前深度 = 0) {
  if (!skill || typeof skill !== 'object') return { 截断分支: 0, 拍平层: 0, 合并对: 0 };
  const 效果数组 = Array.isArray(skill._效果数组) ? skill._效果数组 : (Array.isArray(skill) ? skill : null);
  const 工作集 = 效果数组 ? 效果数组 : [skill];
  let 截断分支 = 0;
  let 拍平层 = 0;
  let 合并对 = 0;
  工作集.forEach(效果 => {
    if (!效果 || typeof 效果 !== 'object') return;
    if (Array.isArray(效果.条件分支)) {
      // (a) ≤3 个：超出截断
      if (效果.条件分支.length > 3) {
        截断分支 += 效果.条件分支.length - 3;
        效果.条件分支 = 效果.条件分支.slice(0, 3);
      }
      // (b) 嵌套 ≤2 层：在每个分支的"替换效果"内若再有"条件分支"则拍平到外层
      if (当前深度 >= 1) {
        效果.条件分支.forEach(分支 => {
          ['替换效果', '追加效果'].forEach(键 => {
            if (Array.isArray(分支?.[键])) {
              分支[键].forEach(子 => {
                if (Array.isArray(子?.条件分支) && 子.条件分支.length > 0) {
                  delete 子.条件分支;
                  拍平层 += 1;
                }
              });
            }
          });
        });
      }
      // (c) 近似合并：相邻"替换效果"中相同字段强度差 <20% 时只保留首条
      if (效果.条件分支.length >= 2) {
        const 取强度 = 项 => {
          const 子 = Array.isArray(项?.替换效果) ? 项.替换效果[0] : null;
          if (!子) return null;
          const 数值 = String(子?.数值 ?? 子?.威力倍率 ?? '').trim();
          const 数 = Number(数值.replace(/[+%-]/g, ''));
          return Number.isFinite(数) ? 数 : null;
        };
        const 新分支 = [效果.条件分支[0]];
        for (let i = 1; i < 效果.条件分支.length; i += 1) {
          const 前强度 = 取强度(新分支[新分支.length - 1]);
          const 当前强度 = 取强度(效果.条件分支[i]);
          if (前强度 != null && 当前强度 != null && 前强度 > 0) {
            const 差比 = Math.abs(当前强度 - 前强度) / 前强度;
            if (差比 < 0.20) {
              合并对 += 1;
              continue; // 跳过当前分支
            }
          }
          新分支.push(效果.条件分支[i]);
        }
        效果.条件分支 = 新分支;
      }
      // 递归处理嵌套的"替换效果/追加效果"
      效果.条件分支.forEach(分支 => {
        ['替换效果', '追加效果'].forEach(键 => {
          if (Array.isArray(分支?.[键])) {
            const 子统计 = 条件分支约束_V1({ _效果数组: 分支[键] }, 当前深度 + 1);
            截断分支 += 子统计.截断分支;
            拍平层 += 子统计.拍平层;
            合并对 += 子统计.合并对;
          }
        });
      });
    }
    // 嵌套 _效果数组 字段（如 授予效果 / 使用效果）也要递归
    if (Array.isArray(技能执行嵌套效果数组字段表_V1)) {
      技能执行嵌套效果数组字段表_V1.forEach(键 => {
        if (Array.isArray(效果?.[键])) {
          const 子统计 = 条件分支约束_V1({ _效果数组: 效果[键] }, 当前深度);
          截断分支 += 子统计.截断分支;
          拍平层 += 子统计.拍平层;
          合并对 += 子统计.合并对;
        }
      });
    }
  });
  return { 截断分支, 拍平层, 合并对 };
}

// v3 阶段 7：旧档迁移——把效果数组内 状态:'沉默' 改为 '封技'
function 迁移沉默到封技_V1(效果数组 = []) {
  if (!Array.isArray(效果数组)) return;
  效果数组.forEach(效果 => {
    if (!效果 || typeof 效果 !== 'object') return;
    if (效果.状态 === '沉默') 效果.状态 = '封技';
    if (Array.isArray(技能执行嵌套效果数组字段表_V1)) {
      技能执行嵌套效果数组字段表_V1.forEach(键 => {
        if (Array.isArray(效果?.[键])) 迁移沉默到封技_V1(效果[键]);
      });
    }
  });
}

function 让技能符合预算_V1(技能 = {}, 魂技位 = 1, 上下文 = {}) {
  if (!技能 || typeof 技能 !== 'object' || !Array.isArray(技能._效果数组)) return { skill: 技能, 降级记录: null, 成功: true };
  const 预算上下文 = {
    ...(上下文 || {}),
    魂环位: Math.max(1, Number(魂技位 || 上下文?.魂环位 || 上下文?.ringIndex || 1) || 1),
    ringIndex: Math.max(1, Number(魂技位 || 上下文?.魂环位 || 上下文?.ringIndex || 1) || 1),
    启用位级硬上限: 上下文?.启用位级硬上限 ?? true,
  };
  const 前评估 = 评估技能预算_V1(技能, 预算上下文);
  try {
    const 收敛结果 = 收敛技能到预算区间_V1(技能, 预算上下文, 上下文?.候选预算档案 || null);
    const 断言结果 = 断言技能预算_V1(技能, 预算上下文, 上下文?.机制标签 || '技能');
    return { skill: 技能, 成功: true, 评估: 断言结果?.评估 || 收敛结果?.评估 || null, 降级记录: null };
  } catch (error) {
    const 后评估 = 评估技能预算_V1(技能, 预算上下文);
    return {
      skill: 技能,
      成功: false,
      评估: 后评估,
      降级记录: {
        前COST: Number(Number(前评估?.实际COST || 0).toFixed(2)),
        后COST: Number(Number(后评估?.实际COST || 0).toFixed(2)),
        目标上限: Number(Number(后评估?.实际门禁 || 0).toFixed(2)),
        超出COST: Number(Math.max(0, Number(后评估?.实际COST || 0) - Number(后评估?.实际门禁 || 0)).toFixed(2)),
        字段变化: [],
        处理记录: [],
        新增副作用: [],
        阻止保存: true,
        原因: String(error?.message || error || '预算收敛失败'),
      },
    };
  }
}

function 缩减技能效果数值份额_V1(效果数组 = [], 份额 = 0, 评估 = {}, 目标COST = null) {
  if (!Array.isArray(效果数组)) return 0;
  const 实际COST = Math.max(1, Number(评估?.实际COST || 1));
  const 指定目标 = Number(目标COST);
  const 缩放 = Number.isFinite(指定目标) && 指定目标 > 0
    ? Math.max(0.05, Math.min(0.98, 指定目标 / 实际COST))
    : Math.max(0.05, Math.min(0.98, 1 - Math.max(0, Number(份额 || 0)) / 实际COST));
  let 改动数 = 0;
  const 访问 = 效果 => {
    if (!效果 || typeof 效果 !== 'object' || Array.isArray(效果)) return;
    ['数值', '副数值', '威力倍率'].forEach(键 => {
      const 原值 = 效果[键];
      if (原值 === undefined || 原值 === null || 原值 === '') return;
      const 文本 = String(原值);
      const 是百分比 = 文本.includes('%');
      const 符号 = 文本.startsWith('+') ? '+' : (文本.startsWith('-') ? '-' : '');
      const 数 = Number(文本.replace(/[+%-]/g, ''));
      if (!Number.isFinite(数)) return;
      const 下限 = 是百分比 ? 5 : 读取效果正式最低绝对值_V1(效果, 键);
      const 新绝对值 = Number(Math.max(下限, Math.abs(数) * 缩放).toFixed(2));
      if (新绝对值 >= Math.abs(数) - 0.001) return;
      效果[键] = 是百分比 ? `${符号}${新绝对值}%` : (符号 === '-' ? -新绝对值 : 新绝对值);
      改动数 += 1;
    });
    if (String(效果.原型 || '').trim() === '召唤生成') {
      if (召唤生成使用继承属性比例_V1(效果)) {
        const 原比例 = Number(效果.继承属性比例);
        if (Number.isFinite(原比例) && 原比例 > 0.01) {
          const 新比例 = Number(Math.max(0.01, 原比例 * 缩放).toFixed(3));
          if (新比例 < 原比例) {
            效果.继承属性比例 = 新比例;
            改动数 += 1;
          }
        }
      } else {
        const 原强度 = Number(效果.强度);
        if (Number.isFinite(原强度) && 原强度 > 0.1) {
          const 新强度 = Number(Math.max(0.1, 原强度 * 缩放).toFixed(3));
          if (新强度 < 原强度) {
            效果.强度 = 新强度;
            改动数 += 1;
          }
        }
      }
    }
    技能执行嵌套效果数组字段表_V1.forEach(字段 => {
      (Array.isArray(效果?.[字段]) ? 效果[字段] : []).forEach(访问);
    });
    (Array.isArray(效果.条件分支) ? 效果.条件分支 : []).forEach(分支 => {
      技能条件分支效果数组字段表_V1.forEach(字段 => {
        (Array.isArray(分支?.[字段]) ? 分支[字段] : []).forEach(访问);
      });
    });
  };
  效果数组.forEach(访问);
  return 改动数;
}

function 缩减技能持续次数份额_V1(效果数组 = [], 份额 = 0, 评估 = {}) {
  if (!Array.isArray(效果数组)) return 0;
  const 实际COST = Math.max(1, Number(评估?.实际COST || 1));
  const 缩放 = Math.max(0.20, Math.min(0.95, 1 - Math.max(0, Number(份额 || 0)) / 实际COST));
  let 改动数 = 0;
  const 访问 = 效果 => {
    if (!效果 || typeof 效果 !== 'object' || Array.isArray(效果)) return;
    ['持续回合', '可用次数', '次数', '数量', '持续tick', '有效期tick', '调整tick'].forEach(键 => {
      const 原值 = Number(效果[键]);
      if (!Number.isFinite(原值) || 原值 <= 1) return;
      const 新值 = Math.max(1, Math.min(原值 - 1, Math.floor(原值 * Math.sqrt(缩放))));
      if (新值 >= 原值) return;
      效果[键] = 新值;
      改动数 += 1;
    });
    技能执行嵌套效果数组字段表_V1.forEach(字段 => {
      (Array.isArray(效果?.[字段]) ? 效果[字段] : []).forEach(访问);
    });
    (Array.isArray(效果.条件分支) ? 效果.条件分支 : []).forEach(分支 => {
      技能条件分支效果数组字段表_V1.forEach(字段 => {
        (Array.isArray(分支?.[字段]) ? 分支[字段] : []).forEach(访问);
      });
    });
  };
  效果数组.forEach(访问);
  return 改动数;
}

function 读取生成补强数值上限_V1(效果 = {}, 字段名 = '数值') {
  const 原型 = String(效果?.原型 || '').trim();
  if (字段名 === '威力倍率') return 5000;
  if (字段名 === '继承属性比例') return 1;
  if (字段名 === '强度') return 8;
  if (字段名 === '副数值') return 300;
  if (原型 === '状态施加') {
    const 状态 = String(效果?.状态 || '').trim();
    if (['眩晕', '封技', '无视异常'].includes(状态)) return 0;
    if (['标记', '治疗反转', '嘲讽'].includes(状态)) return 100;
    if (['僵直', '麻痹', '混乱', '失控'].includes(状态)) return 80;
  }
  return 300;
}

function 提高生成补强数值字段_V1(效果 = {}, 倍率 = 1) {
  if (!效果 || typeof 效果 !== 'object' || Array.isArray(效果)) return 0;
  const 原型 = String(效果?.原型 || '').trim();
  let 改动数 = 0;
  ['数值', '副数值'].forEach(字段名 => {
    const 原值 = 效果[字段名];
    if (原值 === undefined || 原值 === null || 原值 === '') return;
    const 文本 = String(原值).trim();
    const 数 = Number(文本.replace(/[+%-]/g, ''));
    if (!Number.isFinite(数) || Math.abs(数) <= 0) return;
    const 上限 = 读取生成补强数值上限_V1(效果, 字段名);
    if (!(上限 > 0)) return;
    const 是百分比 = 文本.includes('%');
    const 符号 = 文本.startsWith('-') ? '-' : '+';
    const 新绝对值 = Number(Math.min(上限, Math.max(Math.abs(数), Math.abs(数) * 倍率)).toFixed(2));
    if (新绝对值 <= Math.abs(数) + 0.001) return;
    效果[字段名] = 是百分比 ? `${符号}${新绝对值}%` : (符号 === '-' ? -新绝对值 : 新绝对值);
    改动数 += 1;
  });
  if (原型 === '伤害结算') {
    const 原威力 = Math.max(1, Number(效果.威力倍率 || 0));
    const 新威力 = Math.min(读取生成补强数值上限_V1(效果, '威力倍率'), Math.round(原威力 * 倍率));
    if (新威力 > 原威力) {
      效果.威力倍率 = 新威力;
      改动数 += 1;
    }
  }
  if (原型 === '召唤生成') {
    if (召唤生成使用继承属性比例_V1(效果)) {
      const 原比例 = Math.max(0.01, Number(效果.继承属性比例 || 0));
      const 新比例 = Number(Math.min(读取生成补强数值上限_V1(效果, '继承属性比例'), 原比例 * 倍率).toFixed(3));
      if (新比例 > 原比例 + 0.001) {
        效果.继承属性比例 = 新比例;
        改动数 += 1;
      }
    } else {
      const 原强度 = Math.max(0.1, Number(效果.强度 || 1));
      const 新强度 = Number(Math.min(读取生成补强数值上限_V1(效果, '强度'), 原强度 * 倍率).toFixed(3));
      if (新强度 > 原强度 + 0.001) {
        效果.强度 = 新强度;
        改动数 += 1;
      }
    }
  }
  return 改动数;
}

function 按明细目标COST补强效果数值_V1(效果 = {}, 明细 = {}, 目标COST = 0) {
  if (!效果 || typeof 效果 !== 'object' || Array.isArray(效果)) return 0;
  const 原型 = String(效果?.原型 || '').trim();
  const 字段名 = 原型 === '伤害结算' ? '威力倍率' : '数值';
  const 原值 = 字段名 === '威力倍率' ? 效果.威力倍率 : 效果.数值;
  if (原值 === undefined || 原值 === null || 原值 === '') return 0;
  const 目标 = Math.max(0, Number(目标COST || 0));
  const 单位COST = Math.max(0.0001, Number(明细?.单位COST || 0) || 1);
  const 数量系数 = Math.max(0.0001, Number(明细?.数量系数 || 1) || 1);
  const 目标系数 = Math.max(0.0001, Number(明细?.目标系数 || 1) || 1);
  const 持续系数 = Math.max(0.0001, Number(明细?.持续系数 || 1) || 1);
  const 附加规则COST = Math.max(0, Number(明细?.附加规则COST || 0) || 0);
  const 可分配COST = Math.max(0, 目标 - 附加规则COST);
  const 数值基数 = 可分配COST / Math.max(0.0001, 单位COST * 数量系数 * 目标系数 * 持续系数);
  if (!(数值基数 > 0)) return 0;
  if (字段名 === '威力倍率') {
    const 上限 = 读取生成补强数值上限_V1(效果, '威力倍率');
    const 新值 = Math.min(上限, Math.max(Number(效果.威力倍率 || 0), Math.round(数值基数 * 100)));
    if (新值 <= Number(效果.威力倍率 || 0)) return 0;
    效果.威力倍率 = 新值;
    return 1;
  }
  const 文本 = String(原值).trim();
  const 是百分比 = 文本.includes('%') || 明细?.数值类型 === '百分比';
  const 符号 = 文本.startsWith('-') ? '-' : '+';
  const 原数 = Math.abs(Number(文本.replace(/[+%-]/g, '')));
  if (!Number.isFinite(原数)) return 0;
  const 上限 = 读取生成补强数值上限_V1(效果, '数值');
  const 新绝对值 = Number(Math.min(上限, Math.max(原数, 数值基数 * (是百分比 ? 100 : 1))).toFixed(2));
  if (新绝对值 <= 原数 + 0.001) return 0;
  效果.数值 = 是百分比 ? `${符号}${新绝对值}%` : (符号 === '-' ? -新绝对值 : 新绝对值);
  return 1;
}

function 读取生成补强数字字段上限_V1(效果 = {}, 字段名 = '') {
  const 原型 = String(效果?.原型 || '').trim();
  if (字段名 === '持续回合') {
    if (['资源变化', '资源转移', '护盾变化', '属性修正', '判定修正', '结算修正', '状态施加', '状态移除', '规则防御', '状态转移', '状态交换', '资源锁定', '规则改写', '机制抹消', '位移执行', '决策干扰', '召唤生成'].includes(原型)) return 10;
    if (原型 === '机制授予' && String(效果?.触发条件 || '').trim() === '主动触发') return 10;
    return 0;
  }
  if (字段名 === '可用次数') return 原型 === '机制授予' && String(效果?.触发条件 || '').trim() === '主动触发' ? 5 : 0;
  if (字段名 === '次数') return 原型 === '规则防御' ? 5 : 0;
  if (字段名 === '攻击段数') return 原型 === '伤害结算' ? 5 : 0;
  if (字段名 === '数量') {
    if (原型 === '状态移除' || 原型 === '状态转移') return 3;
    if (原型 === '召唤生成' && 召唤生成允许普通批量_V1(效果)) return 3;
    if (原型 === '结算修正' && ['伤害分摊', '消耗分摊'].includes(String(效果?.结算 || '').trim())) return 3;
  }
  if (字段名 === '距离') return 原型 === '位移执行' ? 30 : 0;
  if (字段名 === '保存上限') return 原型 === '复制执行' && ['复制技能', '复制全部'].includes(String(效果?.复制类型 || '').trim()) ? 5 : 0;
  if (字段名 === '调整回合') return 原型 === '时窗修正' && String(效果?.调整字段 || '').trim() === '持续回合' ? 3 : 0;
  if (字段名 === '调整tick') return 原型 === '时窗修正' && String(效果?.调整字段 || '').trim() === '有效期tick' ? 1008 : 0;
  if (字段名 === '调整次数') return 原型 === '时窗修正' && ['触发次数', '使用次数'].includes(String(效果?.调整字段 || '').trim()) ? 3 : 0;
  if (字段名 === '有效期tick') return 原型 === '修炼增益' ? 1008 : 0;
  if (字段名 === '死亡时限tick') return 原型 === '战斗外复活' ? 1008 : 0;
  if (字段名 === '保留回合') return 原型 === '复制执行' ? 10 : 0;
  if (字段名 === '保留时长tick') return 原型 === '复制执行' ? 1008 : 0;
  return 0;
}

function 提高生成补强数字字段_V1(效果 = {}, 倍率 = 1) {
  if (!效果 || typeof 效果 !== 'object' || Array.isArray(效果)) return 0;
  let 改动数 = 0;
  ['持续回合', '可用次数', '次数', '攻击段数', '数量', '距离', '保存上限', '调整回合', '调整tick', '调整次数', '有效期tick', '死亡时限tick', '保留回合', '保留时长tick'].forEach(字段名 => {
    const 上限 = 读取生成补强数字字段上限_V1(效果, 字段名);
    if (!(上限 > 0)) return;
    const 原值 = Math.max(字段名 === '持续回合' ? 0 : 1, Math.round(Number(效果[字段名] || (字段名 === '持续回合' ? 1 : 1))));
    const 新值 = Math.min(上限, Math.max(原值 + 1, Math.round(原值 * Math.sqrt(Math.max(1, 倍率)))));
    if (新值 <= 原值) return;
    效果[字段名] = 新值;
    改动数 += 1;
  });
  return 改动数;
}

function 提高技能效果到目标COST_V1(技能 = {}, 上下文 = {}, 目标COST = 0) {
  if (!技能 || typeof 技能 !== 'object' || !Array.isArray(技能._效果数组)) return { 改动: false, 无可缩放: true, 评估: null };
  const 预算上下文 = { ...(上下文 || {}), 启用位级硬上限: 上下文?.启用位级硬上限 ?? true };
  let 评估 = 评估技能预算_V1(技能, 预算上下文);
  const 目标 = Math.max(0, Number(目标COST || 0));
  if (!(目标 > 0) || Number(评估.实际COST || 0) >= 目标 - 技能预算COST容差_V1) return { 改动: false, 无可缩放: false, 评估 };
  let 总改动 = 0;
  let 有可调字段 = false;
  const 收口并评估 = () => {
    收口技能执行结构_V1(技能, {
      ...预算上下文,
      目标: 上下文?.目标 || (String(技能.承载方式 || '').trim() === '造物承载' ? '自身' : '单体'),
      技能,
      passiveMode: 上下文?.passiveMode === true,
    });
    if (预算上下文.系别) 应用生成魂技系别驱动属性_V1(技能._效果数组, 预算上下文.系别);
    评估 = 评估技能预算_V1(技能, 预算上下文);
  };
  const 执行补强 = (倍率, 模式 = '数值') => {
    let 本轮改动 = 0;
    const 访问 = 效果 => {
      if (!效果 || typeof 效果 !== 'object' || Array.isArray(效果)) return;
      const 改动前 = 本轮改动;
      本轮改动 += 模式 === '数值'
        ? 提高生成补强数值字段_V1(效果, 倍率)
        : 提高生成补强数字字段_V1(效果, 倍率);
      if (本轮改动 > 改动前) 有可调字段 = true;
      技能执行嵌套效果数组字段表_V1.forEach(字段 => {
        (Array.isArray(效果?.[字段]) ? 效果[字段] : []).forEach(访问);
      });
      (Array.isArray(效果.条件分支) ? 效果.条件分支 : []).forEach(分支 => {
        技能条件分支效果数组字段表_V1.forEach(字段 => {
          (Array.isArray(分支?.[字段]) ? 分支[字段] : []).forEach(访问);
        });
      });
    };
    技能._效果数组.forEach(访问);
    return 本轮改动;
  };
  for (let 轮次 = 0; 轮次 < 8 && Number(评估.实际COST || 0) < 目标 - 技能预算COST容差_V1; 轮次 += 1) {
    const 轮前COST = Number(评估.实际COST || 0);
    const 当前COST = Math.max(0.5, 轮前COST);
    const 倍率 = Math.max(1.05, Math.min(2.2, 目标 / 当前COST));
    let 本轮改动 = 执行补强(倍率, '数值');
    if (本轮改动 > 0) {
      总改动 += 本轮改动;
      收口并评估();
      if (Number(评估.实际COST || 0) >= 目标 - 技能预算COST容差_V1) break;
      if (Number(评估.实际COST || 0) > 轮前COST + 0.05) continue;
    }
    const 持续前COST = Number(评估.实际COST || 0);
    const 持续倍率 = Math.max(1.05, Math.min(2.2, 目标 / Math.max(0.5, 持续前COST)));
    本轮改动 = 执行补强(持续倍率, '持续次数');
    if (!(本轮改动 > 0)) {
      if (Number(评估.实际COST || 0) <= 轮前COST + 0.05) break;
      continue;
    }
    总改动 += 本轮改动;
    收口并评估();
    if (Number(评估.实际COST || 0) <= Math.max(轮前COST, 持续前COST) + 0.05) break;
  }
  return { 改动: 总改动 > 0, 无可缩放: !有可调字段, 评估 };
}

function 构建预算收敛失败信息_V1(机制标签 = '未命名机制', 诊断 = {}) {
  const 初始 = 诊断?.初始评估 || {};
  const 最终 = 诊断?.最终评估 || {};
  const 强制门禁 = Number(诊断?.强制预算门禁 || 0) > 0 ? Number(诊断.强制预算门禁) : null;
  const 初始门禁 = 强制门禁 != null ? Math.min(Number(初始?.实际门禁 || 0) || 强制门禁, 强制门禁) : Number(初始?.实际门禁 || 0);
  const 最终门禁 = 强制门禁 != null ? Math.min(Number(最终?.实际门禁 || 0) || 强制门禁, 强制门禁) : Number(最终?.实际门禁 || 0);
  const 摘要 = [
    `初始${Number(初始?.实际COST || 0).toFixed(1)}/${初始门禁.toFixed(1)}`,
    `收敛后${Number(最终?.实际COST || 0).toFixed(1)}/${最终门禁.toFixed(1)}`,
    `系别:${诊断?.系别 || ''}`,
    `魂环位:${诊断?.魂环位 || ''}`,
    `品质:${诊断?.品质 || ''}`,
    `消耗:${诊断?.消耗倍数变化 || '无'}`,
    `前摇:${诊断?.前摇倍数变化 || '无'}`,
    `数值:${诊断?.数值变化 || 0}`,
    `持续次数:${诊断?.持续次数变化 || 0}`,
    `限制:${诊断?.限制变化 || 0}`,
    `副作用:${诊断?.副作用变化 || 0}`,
  ].filter(Boolean).join('；');
  return `技能生成错误:${机制标签}COST仍超预算 ${Number(最终?.实际COST || 0).toFixed(1)}/${最终门禁.toFixed(1)}；预算收敛诊断:${摘要}`;
}

function 读取技能预算合法区间_V1(评估 = {}, 上下文 = {}, 候选档案 = null) {
  const 阶段最高门禁 = Number(上下文?.阶段最高预算门禁 || 0) > 0 ? Number(上下文.阶段最高预算门禁) : null;
  const 当前实际门禁 = Math.max(0.5, Number(评估?.实际门禁 || 0));
  const 位级硬上限 = Number(评估?.位级硬上限 || Infinity);
  const 可达门禁 = 阶段最高门禁 != null
    ? Math.min(Number.isFinite(位级硬上限) ? 位级硬上限 : Infinity, 阶段最高门禁)
    : 当前实际门禁;
  const 阶段目标门禁 = 阶段最高门禁 != null
    ? Math.min(当前实际门禁, 阶段最高门禁)
    : 当前实际门禁;
  const 最低有效COST = Math.max(0.5, Number(评估?.最低有效COST || 0) || 读取预算评估最低有效COST_V1(评估, 上下文));
  const 档案最低 = Number(候选档案?.最低可达COST ?? 候选档案?.组合最低COST ?? 0);
  const 档案最高 = Number(候选档案?.补强可达COST ?? 候选档案?.组合最高常规COST ?? 可达门禁);
  const 下限 = Math.max(最低有效COST, Number.isFinite(档案最低) && 档案最低 > 0 ? Math.min(档案最低, 可达门禁) : 0.5);
  const 上限 = Math.max(0.5, Math.min(可达门禁, Number.isFinite(档案最高) && 档案最高 > 0 ? Math.max(档案最高, 下限) : 可达门禁));
  const 风格随机 = 读取生成随机数_V1(上下文, 421);
  const 风格 = 风格随机 < 0.30 ? '保守档' : (风格随机 < 0.82 ? '标准档' : '爆发档');
  const 宽度 = Math.max(0, 上限 - 下限);
  const 子区间 = 风格 === '保守档'
    ? [下限, 下限 + 宽度 * 0.38]
    : 风格 === '爆发档'
      ? [下限 + 宽度 * 0.62, 上限]
      : [下限 + 宽度 * 0.25, 下限 + 宽度 * 0.75];
  return {
    下限: Number(Math.min(子区间[0], 上限).toFixed(2)),
    上限: Number(Math.max(Math.min(子区间[1], 上限), Math.min(子区间[0], 上限)).toFixed(2)),
    硬上限: Number(当前实际门禁.toFixed(2)),
    阶段目标上限: Number(阶段目标门禁.toFixed(2)),
    可达硬上限: Number(Math.max(0.5, 可达门禁).toFixed(2)),
    最低有效COST: Number(最低有效COST.toFixed(2)),
    风格,
  };
}

function 断言技能预算_V1(技能 = {}, 上下文 = {}, 机制标签 = '技能') {
  if (!技能 || typeof 技能 !== 'object' || !Array.isArray(技能._效果数组)) return { 评估: null, 通过: true };
  const 预算上下文 = {
    ...构建自动生成预算上下文_V1(上下文 || {}),
    启用位级硬上限: 上下文?.启用位级硬上限 ?? true,
  };
  const 评估 = 评估技能预算_V1(技能, 预算上下文);
  if (技能COST超预算_V1(评估.实际COST, 评估.实际门禁)) {
    throw new Error(`技能生成错误:${机制标签}COST仍超预算 ${Number(评估.实际COST || 0).toFixed(1)}/${Number(评估.实际门禁 || 0).toFixed(1)}`);
  }
  const 最低有效COST = Math.max(0.5, Number(评估?.最低有效COST || 0) || 读取预算评估最低有效COST_V1(评估, 预算上下文));
  if (Number(评估.实际COST || 0) < 最低有效COST - 技能预算超预算容差_V1) {
    throw new Error(`技能生成错误:${机制标签}利用率不达标 ${Number(评估.实际COST || 0).toFixed(1)}/${最低有效COST.toFixed(1)}`);
  }
  return { 评估, 通过: true };
}

function 包装技能预算路径错误_V1(错误, 上下文 = {}, 机制标签 = '技能') {
  const 路径 = String(上下文?.path || 上下文?.路径 || '').trim();
  const 技能键 = String(上下文?.技能键 || 上下文?.skillName || '').trim();
  const 前缀 = [
    路径 ? `路径:${路径}` : '',
    技能键 ? `技能:${技能键}` : '',
    机制标签 ? `机制:${机制标签}` : '',
  ].filter(Boolean).join('；');
  if (!前缀 || String(错误?.message || '').includes('路径:')) return 错误;
  const 新错误 = new Error(`${String(错误?.message || 错误 || '技能预算错误')}；${前缀}`);
  if (错误 && typeof 错误 === 'object') {
    Object.keys(错误).forEach(键 => {
      try { 新错误[键] = 错误[键]; } catch (忽略) {}
    });
  }
  return 新错误;
}

function 收敛技能到预算区间_V1(技能 = {}, 上下文 = {}, 候选档案 = null) {
  if (!技能 || typeof 技能 !== 'object' || !Array.isArray(技能._效果数组)) return { 技能, 改动: false, 评估: null, 诊断: null };
  const 预算上下文 = {
    ...构建自动生成预算上下文_V1(上下文 || {}),
    启用位级硬上限: 上下文?.启用位级硬上限 ?? true,
  };
  const 机制标签 = String(上下文?.机制标签 || 上下文?.archetype || 候选档案?.机制名 || '技能').trim() || '技能';
  const 收口当前技能 = () => {
    收口技能执行结构_V1(技能, {
      ...预算上下文,
      目标: 上下文?.目标 || (String(技能.承载方式 || '').trim() === '造物承载' ? '自身' : '单体'),
      技能,
      passiveMode: 上下文?.passiveMode === true,
    });
    if (Array.isArray(技能._效果数组) && 预算上下文.系别) 应用生成魂技系别驱动属性_V1(技能._效果数组, 预算上下文.系别);
  };
  收口当前技能();
  let 评估 = 评估技能预算_V1(技能, 预算上下文);
  const 初始评估 = { ...评估 };
  let 区间 = 读取技能预算合法区间_V1(评估, 预算上下文, 候选档案);
  const 诊断 = {
    系别: 预算上下文.系别,
    魂环位: 预算上下文.魂环位,
    品质: String(上下文?.gradeOverride || 上下文?.grade || 上下文?.品质 || 上下文?.sourceQuality || '').trim(),
    初始评估,
    最低合法COST: Number(候选档案?.最低可达COST ?? 0),
    目标区间: 区间,
    数值变化: 0,
    持续次数变化: 0,
    限制变化: 0,
    副作用变化: 0,
    消耗倍数变化: '',
    前摇倍数变化: '',
    未参与原因: [],
  };
  let 改动 = false;
  const 重新评估 = () => {
    收口当前技能();
    评估 = 评估技能预算_V1(技能, 预算上下文);
    区间 = 读取技能预算合法区间_V1(评估, 预算上下文, 候选档案);
    诊断.目标区间 = 区间;
  };
  if (Number(区间.硬上限 || 0) < Number(区间.最低有效COST || 0) - 技能预算超预算容差_V1) {
    诊断.最终评估 = { ...评估 };
    const 错误 = new Error(`技能生成错误:${机制标签}当前承载低于最低有效COST ${Number(区间.硬上限 || 0).toFixed(1)}/${Number(区间.最低有效COST || 0).toFixed(1)}；预算收敛诊断:${构建预算收敛失败信息_V1(机制标签, 诊断).replace(/^技能生成错误:[^；]+；预算收敛诊断:/, '')}`);
    错误.预算收敛诊断 = 诊断;
    错误.预算收敛技能 = cloneJsonValue(技能, {});
    throw 错误;
  }
  const 读取补强目标COST = () => {
    const 下限 = Math.max(Number(区间.最低有效COST || 0), Number(区间.下限 || 0));
    const 档案上限 = Number(候选档案?.补强可达COST ?? 候选档案?.组合最高常规COST ?? 0);
    const 上限候选 = Math.min(
      Number(区间.硬上限 || 0) > 0 ? Number(区间.硬上限) : Infinity,
      Number.isFinite(档案上限) && 档案上限 > 0 ? 档案上限 : Infinity,
    );
    const 上限 = Math.max(下限, Number.isFinite(上限候选) ? 上限候选 : 下限);
    const 随机 = 读取生成随机数_V1(预算上下文, 431);
    return Number((下限 + (上限 - 下限) * 随机).toFixed(2));
  };
  const 补强到合法下限 = () => {
    if (!(Number(评估.实际COST || 0) < Number(区间.最低有效COST || 0) - 技能预算超预算容差_V1)) return;
    const 目标COST = 读取补强目标COST();
    const 补强 = 生成阶段收敛目标COST填充_V1(技能, {
      ...预算上下文,
      角色: 预算上下文.角色,
      来源: 预算上下文.来源,
      来源类别: 预算上下文.来源类别,
      sourceCategory: 预算上下文.sourceCategory,
      系别: 预算上下文.系别,
      type: 预算上下文.系别,
      魂环位: 预算上下文.魂环位,
      ringIndex: 预算上下文.魂环位,
      目标: 上下文?.目标 || (String(技能.承载方式 || '').trim() === '造物承载' ? '自身' : '单体'),
      目标COST,
      最低目标COST: Number(区间.最低有效COST || 目标COST),
    });
    改动 = 改动 || !!补强?.改动;
    重新评估();
    if (Number(评估.实际COST || 0) < Number(区间.最低有效COST || 0) - 技能预算超预算容差_V1) {
      const 二次补强 = 提高技能效果到目标COST_V1(技能, 预算上下文, Number(区间.最低有效COST || 目标COST));
      改动 = 改动 || !!二次补强?.改动;
      if (二次补强?.无可缩放 === true) 诊断.未参与原因.push('效果补强:无可缩放字段');
      重新评估();
    }
  };
  const 压缩到当前硬上限 = () => {
    let 压缩改动 = false;
    let 当前上限 = Math.min(Number(区间.上限 || 区间.硬上限 || 0), Number(区间.硬上限 || 0));
    if (!(当前上限 > 0)) 当前上限 = Number(区间.硬上限 || 0);
    for (let 轮次 = 0; 轮次 < 8 && Number(评估.实际COST || 0) > 当前上限 + 技能预算超预算容差_V1; 轮次 += 1) {
      const 当前COST = Math.max(0.5, Number(评估.实际COST || 0));
      const 硬门禁目标 = Math.max(Number(区间.最低有效COST || 0), Number(区间.硬上限 || 当前上限 || 0) - 技能预算超预算容差_V1 * 0.75);
      const 收缩目标 = Number(Math.min(
        当前COST - 技能预算超预算容差_V1,
        Math.max(Number(区间.最低有效COST || 0), Math.min(当前上限, 硬门禁目标)),
      ).toFixed(2));
      const 数值改动 = 缩减技能效果数值份额_V1(技能._效果数组, 0, 评估, 收缩目标);
      诊断.数值变化 += 数值改动;
      const 持续改动 = 缩减技能持续次数份额_V1(技能._效果数组, Math.max(0, Number(评估.实际COST || 0) - 当前上限), 评估);
      诊断.持续次数变化 += 持续改动;
      改动 = 改动 || 数值改动 > 0 || 持续改动 > 0;
      压缩改动 = 压缩改动 || 数值改动 > 0 || 持续改动 > 0;
      重新评估();
      当前上限 = Math.min(Number(区间.上限 || 区间.硬上限 || 0), Number(区间.硬上限 || 0));
      if (!(当前上限 > 0)) 当前上限 = Number(区间.硬上限 || 0);
      if (!(数值改动 > 0 || 持续改动 > 0)) break;
    }
    if (
      !技能COST超预算_V1(Number(评估.实际COST || 0), 区间.硬上限) &&
      Number(评估.实际COST || 0) < Number(区间.最低有效COST || 0) - 技能预算超预算容差_V1
    ) {
      补强到合法下限();
    }
    return 压缩改动;
  };
  const 补足消耗前摇承载 = () => {
    const 策略 = 构建自动生成预算收敛策略_V1({ ...预算上下文, 承载方式: 技能.承载方式 });
    let 有改动 = false;
    for (let 轮次 = 0; 轮次 < 6 && 技能COST超预算_V1(Number(评估.实际COST || 0), Number(评估.实际门禁 || 区间.硬上限 || 0)); 轮次 += 1) {
      const 缺口 = Math.max(0, Number(评估.实际COST || 0) - Number(评估.实际门禁 || 区间.硬上限 || 0) - 技能预算超预算容差_V1 * 0.5);
      if (!(缺口 > 0)) break;
      const 消耗剩余 = Math.max(0, Number(策略.消耗倍率上限 || 1) - Number(评估.消耗倍数 || 1));
      const 前摇剩余 = Math.max(0, Number(策略.前摇倍率上限 || 1) - Number(评估.前摇倍数 || 1));
      const 调整顺序 = 消耗剩余 >= 前摇剩余 ? ['消耗', '前摇'] : ['前摇', '消耗'];
      let 本轮改动 = false;
      for (const 类型 of 调整顺序) {
        if (!技能COST超预算_V1(Number(评估.实际COST || 0), Number(评估.实际门禁 || 区间.硬上限 || 0))) break;
        const 当前缺口 = Math.max(0, Number(评估.实际COST || 0) - Number(评估.实际门禁 || 区间.硬上限 || 0) - 技能预算超预算容差_V1 * 0.5);
        const 结果 = 按预算份额提高消耗前摇_V1(技能, 预算上下文, 评估, Math.max(0.25, 当前缺口 * 1.15), 类型, 策略);
        if (结果.改动) {
          if (类型 === '消耗') 诊断.消耗倍数变化 = `${Number(结果.前倍数 || 0).toFixed(2)}->${Number(结果.后倍数 || 0).toFixed(2)}`;
          else 诊断.前摇倍数变化 = `${Number(结果.前倍数 || 0).toFixed(2)}->${Number(结果.后倍数 || 0).toFixed(2)}`;
          有改动 = true;
          本轮改动 = true;
          改动 = true;
          重新评估();
        } else {
          const 原因 = `${类型}:${结果.原因 || '未改动'}`;
          if (!诊断.未参与原因.includes(原因)) 诊断.未参与原因.push(原因);
        }
      }
      if (!本轮改动) break;
    }
    return 有改动;
  };
  补强到合法下限();
  let 收敛上限 = Math.min(Number(区间.上限 || 区间.硬上限 || 0), Number(区间.硬上限 || 0));
  if (!(收敛上限 > 0)) 收敛上限 = Number(区间.硬上限 || 0);
  if (Number(评估.实际COST || 0) > 收敛上限 + 技能预算超预算容差_V1) {
    if (技能COST超预算_V1(Number(评估.实际COST || 0), 区间.硬上限) && 上下文?.禁止副作用 !== true) {
      const 副作用数量 = 尝试生成阶段副作用降压_V1(技能, 预算上下文);
      if (副作用数量 > 0) {
        诊断.副作用变化 += 副作用数量;
        改动 = true;
        重新评估();
      }
    }
    压缩到当前硬上限();
    if (技能COST超预算_V1(Number(评估.实际COST || 0), 区间.硬上限)) {
      补足消耗前摇承载();
      if (技能COST超预算_V1(Number(评估.实际COST || 0), 区间.硬上限)) 压缩到当前硬上限();
    }
    if (技能COST超预算_V1(Number(评估.实际COST || 0), 区间.硬上限)) 补足消耗前摇承载();
  }
  诊断.最终评估 = { ...评估 };
  记录技能生成事件_V1(预算上下文, {
    类型: '区间预算收敛',
    机制原型: 机制标签,
    初始COST: Number(初始评估.实际COST || 0),
    初始门禁: Number(初始评估.实际门禁 || 0),
    收敛后COST: Number(评估.实际COST || 0),
    收敛后门禁: Number(评估.实际门禁 || 0),
    目标区间: `${区间.下限}-${区间.上限}`,
    数值变化: 诊断.数值变化,
    持续次数变化: 诊断.持续次数变化,
    副作用变化: 诊断.副作用变化,
  });
  const 最终硬上限 = Math.max(0.5, Number(评估?.实际门禁 || 区间.硬上限 || 0));
  if (技能COST超预算_V1(Number(评估.实际COST || 0), 最终硬上限)) {
    const 错误 = new Error(构建预算收敛失败信息_V1(机制标签, 诊断));
    错误.预算收敛诊断 = 诊断;
    错误.预算收敛技能 = cloneJsonValue(技能, {});
    throw 错误;
  }
  if (Number(评估.实际COST || 0) < 区间.最低有效COST - 技能预算超预算容差_V1) {
    const 错误 = new Error(`技能生成错误:${机制标签}利用率不达标 ${Number(评估.实际COST || 0).toFixed(1)}/${Number(区间.最低有效COST || 0).toFixed(1)}；预算收敛诊断:${构建预算收敛失败信息_V1(机制标签, 诊断).replace(/^技能生成错误:[^；]+；预算收敛诊断:/, '')}`);
    错误.预算收敛诊断 = 诊断;
    错误.预算收敛技能 = cloneJsonValue(技能, {});
    throw 错误;
  }
  return { 技能, 改动, 评估, 诊断 };
}

function 收敛自动生成候选预算_V1(技能 = {}, 上下文 = {}, 机制标签 = '未命名机制') {
  return 收敛技能到预算区间_V1(技能, { ...(上下文 || {}), 机制标签 }, 上下文?.候选预算档案 || null);
}

function 技能结算效果仅作用自身_V1(技能 = {}) {
  const 效果数组 = (() => {
    if (Array.isArray(技能)) return 技能;
    if (String(技能?.承载方式 || '').trim() === '造物承载') {
      return (Array.isArray(技能?._效果数组) ? 技能._效果数组 : [])
        .flatMap(模板 => Array.isArray(模板?.使用效果) ? 模板.使用效果 : []);
    }
    return Array.isArray(技能?._效果数组) ? 技能._效果数组 : [];
  })();
  let 有效果 = false;
  let 仅自身 = true;
  遍历直接结算预算效果_V1(效果数组, 效果 => {
    if (!效果 || typeof 效果 !== 'object') return;
    const 原型 = String(效果?.原型 || '').trim();
    if (!原型) return;
    有效果 = true;
    const 目标 = String(效果?.目标 || '单体').trim() || '单体';
    if (目标 !== '自身') 仅自身 = false;
  });
  return 有效果 && 仅自身;
}

function 生成技能属于食物辅助系_V1(上下文 = {}) {
  const 系别 = 读取预算上下文系别_V1(上下文);
  return 系别 === '食物系' || 系别 === '辅助系' || 系别 === '治疗系';
}

function 技能是增幅类魂技_V1(技能 = {}) {
  if (!技能 || typeof 技能 !== 'object') return false;
  let 命中 = false;
  遍历直接结算预算效果_V1(Array.isArray(技能._效果数组) ? 技能._效果数组 : [], 效果 => {
    if (命中 || !效果 || typeof 效果 !== 'object') return;
    const 原型 = String(效果?.原型 || '').trim();
    const 数值 = 读取技能比例值_V1(效果?.数值);
    if (原型 === '属性修正' && 数值 > 0) {
      命中 = true;
      return;
    }
    if (原型 !== '结算修正') return;
    const 结算 = String(效果?.结算 || '').trim();
    if (['造成伤害', '治疗', '技能效果'].includes(结算) && 数值 > 0) 命中 = true;
    if (['受到伤害', '消耗', '前摇'].includes(结算) && 数值 < 0) 命中 = true;
  });
  return 命中;
}

function 允许生成阶段自动副作用_V1(技能 = {}, 上下文 = {}) {
  if (!生成技能属于食物辅助系_V1(上下文)) return true;
  return 技能是增幅类魂技_V1(技能);
}

function 生成技能命中原型_V1(技能 = {}, 原型列表 = []) {
  const 原型集合 = new Set((Array.isArray(原型列表) ? 原型列表 : []).map(项 => String(项 || '').trim()).filter(Boolean));
  if (!原型集合.size) return false;
  let 命中 = false;
  遍历直接结算预算效果_V1(Array.isArray(技能?._效果数组) ? 技能._效果数组 : [], 效果 => {
    if (命中 || !效果 || typeof 效果 !== 'object') return;
    if (原型集合.has(String(效果?.原型 || '').trim())) 命中 = true;
  });
  return 命中;
}

function 计算生成阶段自动副作用概率_V1(技能 = {}, 上下文 = {}) {
  if (!允许生成阶段自动副作用_V1(技能, 上下文)) return 0;
  if (生成技能命中原型_V1(技能, ['属性修正'])) {
    let 全属性 = false;
    let 多属性 = false;
    遍历直接结算预算效果_V1(Array.isArray(技能?._效果数组) ? 技能._效果数组 : [], 效果 => {
      if (!效果 || typeof 效果 !== 'object' || String(效果?.原型 || '').trim() !== '属性修正') return;
      const 属性 = Array.isArray(效果.属性) ? 效果.属性 : String(效果.属性 || '').split(/[\/、,，]/).map(项 => 项.trim()).filter(Boolean);
      if (属性.includes('全属性') || 属性.length >= 5) 全属性 = true;
      else if (属性.length >= 2) 多属性 = true;
    });
    if (全属性) return 0.40;
    if (多属性) return 0.20;
  }
  return 生成技能属于食物辅助系_V1(上下文) ? 0.10 : 0.05;
}

function 生成阶段已有自动副作用_V1(技能 = {}) {
  const 顶层 = normalizeSkillSideEffectList(技能?.副作用列表 || []);
  if (顶层.some(项 => String(项?.副作用类型 || '').trim() === '施法僵直')) return true;
  if (String(技能?.承载方式 || '').trim() === '造物承载' || 是造物承载效果数组_V1(技能?._效果数组)) {
    return (Array.isArray(技能?._效果数组) ? 技能._效果数组 : []).some(模板 =>
      normalizeSkillSideEffectList(模板?.副作用列表 || []).some(项 => String(项?.副作用类型 || '').trim() === '施法僵直'),
    );
  }
  return false;
}

function 写入生成阶段自动副作用_V1(技能 = {}, 副作用 = null, 上下文 = {}) {
  const 条目 = normalizeSkillSideEffectEntry(副作用 || {});
  if (!条目) return false;
  const 是造物承载 = String(技能?.承载方式 || '').trim() === '造物承载' || 是造物承载效果数组_V1(技能?._效果数组);
  const 生效对象 = String(条目.生效对象 || '').trim();
  if (是造物承载 && 生效对象 === '效果承受者') {
    const 模板 = (Array.isArray(技能._效果数组) ? 技能._效果数组 : []).find(项 => 项 && typeof 项 === 'object' && !String(项?.原型 || '').trim() && Array.isArray(项?.使用效果));
    if (!模板) return false;
    const 当前列表 = normalizeSkillSideEffectList(模板.副作用列表 || []);
    模板.副作用列表 = [...当前列表, 条目];
    记录技能生成事件_V1(上下文, { 类型: '造物模板副作用', 副作用类型: 条目.副作用类型 });
    return true;
  }
  const 当前列表 = normalizeSkillSideEffectList(技能.副作用列表 || []);
  技能.副作用列表 = [...当前列表, 条目];
  return true;
}

function 裁剪最低COST附加效果_V1(效果数组 = []) {
  const 候选列表 = [];
  const 收集 = (列表, 路径) => {
    if (!Array.isArray(列表)) return;
    const 有效索引 = 列表
      .map((效果, 序号) => ({ 效果, 序号 }))
      .filter(项 => 项.效果 && typeof 项.效果 === 'object' && String(项.效果.原型 || '').trim());
    if (有效索引.length > 1) {
      有效索引.forEach(项 => {
        const COST = Number(计算技能效果累计COST_V1([项.效果]).总COST || 0);
        候选列表.push({
          列表,
          序号: 项.序号,
          路径: `${路径}[${项.序号}]`,
          原型: String(项.效果.原型 || '').trim(),
          COST,
        });
      });
    }
    列表.forEach((效果, 序号) => {
      if (!效果 || typeof 效果 !== 'object') return;
      技能执行嵌套效果数组字段表_V1.forEach(字段 => {
        if (Array.isArray(效果?.[字段])) 收集(效果[字段], `${路径}[${序号}].${字段}`);
      });
      (Array.isArray(效果.条件分支) ? 效果.条件分支 : []).forEach((分支, 分支序号) => {
        技能条件分支效果数组字段表_V1.forEach(字段 => {
          if (Array.isArray(分支?.[字段])) 收集(分支[字段], `${路径}[${序号}].条件分支[${分支序号}].${字段}`);
        });
      });
    });
  };
  收集(效果数组, '_效果数组');
  const 候选 = 候选列表
    .filter(项 => Number.isFinite(项.COST) && 项.COST > 0)
    .sort((左, 右) => Number(左.COST || 0) - Number(右.COST || 0))[0];
  if (!候选) return null;
  候选.列表.splice(候选.序号, 1);
  return {
    路径: 候选.路径,
    原型: 候选.原型,
    COST: Number(候选.COST.toFixed(2)),
  };
}

function 执行统一技能预算审核_V1(技能 = {}, 上下文 = {}, 机制标签 = '技能') {
  if (!技能 || typeof 技能 !== 'object' || !Array.isArray(技能._效果数组)) return { skill: 技能, 成功: true, 评估: null };
  if (是血脉技能预算豁免上下文_V1(上下文, 上下文?.path || '')) return { skill: 技能, 成功: true, 评估: null, 跳过预算门禁: true };
  const 预算上下文 = {
    ...(上下文 || {}),
    目标: 上下文?.目标 || (String(技能.承载方式 || '').trim() === '造物承载' ? '自身' : '单体'),
    passiveMode: 上下文?.passiveMode === true,
    系别: 上下文?.type || 上下文?.系别 || '强攻系',
    启用位级硬上限: 上下文?.启用位级硬上限 ?? true,
  };
  const 预算档案 = 上下文?.候选预算档案 || 估算自动生成机制预算范围_V1(机制标签, {
    ...预算上下文,
    释放形态: 技能.承载方式,
  });
  try {
    const 收敛结果 = 收敛技能到预算区间_V1(技能, { ...预算上下文, 机制标签 }, 预算档案);
    const 断言结果 = 断言技能预算_V1(技能, 预算上下文, 机制标签);
    return { skill: 技能, 成功: true, 评估: 断言结果?.评估 || 收敛结果?.评估 || null, 收敛结果 };
  } catch (错误) {
    throw 包装技能预算路径错误_V1(错误, 上下文, 机制标签);
  }
}

function 收口支援系低位伤害生成_V1(技能 = {}, 上下文 = {}) {
  if (!技能 || typeof 技能 !== 'object') return 技能;
  const 系别 = String(上下文?.系别 || 上下文?.type || '').trim();
  const 魂环位 = Math.max(1, Number(上下文?.魂环位 || 上下文?.ringIndex || 1));
  if (!['辅助系', '治疗系', '食物系'].includes(系别) || 魂环位 > 2) return 技能;
  let 命中伤害 = false;
  const 访问 = 效果 => {
    if (!效果 || typeof 效果 !== 'object' || Array.isArray(效果)) return;
    if (String(效果?.原型 || '').trim() === '伤害结算') 命中伤害 = true;
    技能执行嵌套效果数组字段表_V1.forEach(字段名 => (Array.isArray(效果[字段名]) ? 效果[字段名] : []).forEach(访问));
    (Array.isArray(效果.条件分支) ? 效果.条件分支 : []).forEach(分支 => {
      技能条件分支效果数组字段表_V1.forEach(字段名 => {
        (Array.isArray(分支?.[字段名]) ? 分支[字段名] : []).forEach(访问);
      });
    });
  };
  (Array.isArray(技能._效果数组) ? 技能._效果数组 : []).forEach(访问);
  if (命中伤害) throw new Error(`技能生成错误:${系别}低位魂技不允许伤害结算主效果`);
  return 技能;
}

function 提升生成技能运转门禁到目标COST_V1(技能 = {}, 上下文 = {}, 目标COST = 0) {
  if (!技能 || typeof 技能 !== 'object') return false;
  const 目标 = Number(目标COST || 0);
  if (!(目标 > 0)) return false;
  let 改动 = false;
  for (let 次 = 0; 次 < 5; 次 += 1) {
    const 评估 = 评估技能预算_V1(技能, 上下文);
    if (!技能COST超预算_V1(目标, 评估.实际门禁)) break;
    const 当前基线 = Math.max(0.1, Number(评估.对等基线 || 0));
    const 倍率 = Math.min(1.8, Math.max(1.05, 目标 / 当前基线));
    const 原消耗 = 技能.消耗;
    const 当前消耗 = 解析消耗为绝对值_V1(原消耗 ?? '无', 上下文);
    if (!(当前消耗 > 0) || String(原消耗 ?? '').trim() === '无') {
      const 标准消耗 = 获取运转标准消耗_V1(上下文?.魂环位 || 上下文?.ringIndex || 1);
      if (Number.isFinite(标准消耗) && 标准消耗 > 0) 技能.消耗 = 格式化魂技消耗结构文本_V1({ 魂力: Math.max(1, Math.round(标准消耗 * 倍率)) });
    } else {
      技能.消耗 = 格式化魂技消耗结构文本_V1(缩放消耗结构数值_V1(cloneJsonValue(原消耗 ?? '无'), 倍率));
    }
    const 当前前摇 = Math.max(1, Number(技能.前摇 ?? 获取标准前摇_V1()));
    技能.前摇 = Math.max(当前前摇, Math.min(80, Math.round(当前前摇 * 倍率)));
    改动 = true;
  }
  return 改动;
}

function 效果支持生成触发限制_V1(效果 = {}) {
  const 原型 = String(效果?.原型 || '').trim();
  if (原型 === '状态施加') return 状态施加允许触发限制_V1(效果?.状态, 效果?.目标);
  return ['规则防御', '机制授予', '召唤生成'].includes(原型);
}

function 尝试生成阶段触发限制降压_V1(技能 = {}, 上下文 = null) {
  if (!技能 || typeof 技能 !== 'object') return 0;
  if (读取技能限制抵扣上限_V1(技能) <= 0.10) return 0;
  const 写入前快照 = 上下文 && typeof 上下文 === 'object' ? cloneJsonValue(技能, {}) : null;
  let 改动 = 0;
  遍历直接结算预算效果_V1(技能._效果数组, 效果 => {
    if (!效果 || typeof 效果 !== 'object') return;
    if (!效果支持生成触发限制_V1(效果)) return;
    if (解析次数限制抵扣率_V1(效果.触发限制) >= 0.40) return;
    效果.触发限制 = { 周期: '每战', 次数: 1 };
    改动 += 1;
  });
  if (改动 > 0 && 写入前快照) {
    const 评估 = 评估技能预算_V1(技能, 上下文);
    const 低COST线 = 读取预算评估最低有效COST_V1(评估, 上下文);
    if (
      Number(评估.实际COST || 0) < 低COST线 - 技能预算COST容差_V1 &&
      !技能COST超预算_V1(评估.实际COST, 评估.实际门禁)
    ) {
      Object.keys(技能).forEach(键 => delete 技能[键]);
      Object.assign(技能, 写入前快照);
      记录技能生成事件_V1(上下文, {
        类型: '触发限制回滚',
        原因: '低于最低有效COST',
        写入后COST: Number(评估.实际COST || 0),
        最低有效COST: Number(低COST线.toFixed(2)),
      });
      return 0;
    }
  }
  return 改动;
}

function 尝试生成阶段副作用降压_V1(技能 = {}, 上下文 = {}, 选项 = {}) {
  if (!技能 || typeof 技能 !== 'object') return 0;
  if (!允许生成阶段自动副作用_V1(技能, 上下文)) return 0;
  if (生成阶段已有自动副作用_V1(技能)) return 0;
  const 写入前评估 = 评估技能预算_V1(技能, 上下文);
  const 强制门禁 = Number(上下文?.强制预算门禁 || 0) > 0 ? Number(上下文.强制预算门禁) : null;
  const 当前门禁 = 强制门禁 != null ? Math.min(Number(写入前评估?.实际门禁 || 0) || 强制门禁, 强制门禁) : Number(写入前评估?.实际门禁 || 0);
  if (!技能COST超预算_V1(写入前评估.实际COST, 当前门禁)) {
    记录技能生成事件_V1(上下文, {
      类型: '副作用跳过',
      原因: '未超预算',
      实际COST: Number(写入前评估.实际COST || 0),
      门禁: Number(当前门禁 || 0),
    });
    return 0;
  }
  const 概率 = 计算生成阶段自动副作用概率_V1(技能, 上下文);
  if (选项?.强制概率检查 !== false && 读取生成随机数_V1(上下文, 83) >= 概率) {
    记录技能生成事件_V1(上下文, { 类型: '副作用概率未命中', 概率 });
    return 0;
  }
  const 系别 = 读取预算上下文系别_V1(上下文);
  const 关联状态 = 查找技能首个持续状态_V1(技能._效果数组);
  const 结束后副作用 = ['辅助系', '食物系', '治疗系'].includes(系别);
  if (结束后副作用 && !关联状态) return 0;
  const 生效对象 = String(技能?.承载方式 || '').trim() === '造物承载' ? '效果承受者' : '技能释放者';
  const 副作用 = normalizeSkillSideEffectEntry({
    副作用类型: '施法僵直',
    触发时机: 结束后副作用 ? '效果结束后' : '效果生效后',
    生效对象,
    触发概率: 1,
    持续回合: 1,
    数值: '+20%',
    关联状态,
  });
  if (!副作用) return 0;
  const 写入前快照 = cloneJsonValue(技能, {});
  if (!写入生成阶段自动副作用_V1(技能, 副作用, 上下文)) return 0;
  const 写入后评估 = 评估技能预算_V1(技能, 上下文);
  if (Number(写入后评估.实际COST || 0) < Number(写入后评估.最低有效COST || 0) - 技能预算COST容差_V1) {
    Object.keys(技能).forEach(键 => delete 技能[键]);
    Object.assign(技能, 写入前快照);
    记录技能生成事件_V1(上下文, {
      类型: '副作用回滚',
      原因: '低于最低有效COST',
      写入后COST: Number(写入后评估.实际COST || 0),
      最低有效COST: Number(写入后评估.最低有效COST || 0),
    });
    return 0;
  }
  记录技能生成事件_V1(上下文, { 类型: '自动副作用生成', 副作用类型: 副作用.副作用类型, 概率, 触发时机: 副作用.触发时机, 生效对象: 副作用.生效对象 });
  return 1;
}

function 选择消耗前摇收口方案_V1(上下文 = {}) {
  const 读取档位 = (盐, 中档标签, 极端标签) => {
    const 随机 = 读取生成随机数_V1(上下文, 盐);
    if (随机 < 0.05) return { 标签: 极端标签, 承担比例: 0.35, 倍率上限: 4 };
    if (随机 < 0.20) return { 标签: 中档标签, 承担比例: 0.24, 倍率上限: 2.5 };
    return { 标签: '常规', 承担比例: 0.14, 倍率上限: 1.5 };
  };
  const 消耗 = 读取档位(71, '消耗中档', '消耗极端');
  const 前摇 = 读取档位(72, '前摇中档', '前摇极端');
  return { 消耗, 前摇, 档位: `${消耗.标签}/${前摇.标签}` };
}

function 构建自动生成候选消耗前摇方案_V1(候选序号 = 0) {
  const 序号 = Math.max(0, Number(候选序号 || 0));
  if (序号 <= 0) {
    return {
      消耗: { 标签: '消耗常规', 承担比例: 0.14, 常规倍率上限: 1.5, 倍率上限: 2 },
      前摇: { 标签: '前摇常规', 承担比例: 0.10, 常规倍率上限: 1.5, 倍率上限: 2 },
      档位: '消耗常规/前摇常规',
    };
  }
  const 消耗 = 序号 >= 2
    ? { 标签: '消耗常规', 承担比例: 0.18, 常规倍率上限: 1.5, 倍率上限: 2 }
    : { 标签: '消耗常规', 承担比例: 0.16, 常规倍率上限: 1.5, 倍率上限: 2 };
  const 前摇 = 序号 >= 2
    ? { 标签: '前摇常规', 承担比例: 0.14, 常规倍率上限: 1.5, 倍率上限: 2 }
    : { 标签: '前摇常规', 承担比例: 0.12, 常规倍率上限: 1.5, 倍率上限: 2 };
  return { 消耗, 前摇, 档位: `${消耗.标签}/${前摇.标签}` };
}

function 构建自动生成预算收敛策略_V1(上下文 = {}) {
  const 系别 = 读取预算上下文系别_V1(上下文);
  const 造物 = String(上下文?.承载方式 || 上下文?.释放形态 || '').trim() === '造物承载';
  const 基础权重 = {
    效果数值: 0.36,
    持续次数: 0.22,
    消耗: 0.14,
    前摇: 0.10,
    触发限制: 0.10,
    副作用: 0.08,
  };
  if (['辅助系', '治疗系', '食物系'].includes(系别)) {
    基础权重.效果数值 += 0.08;
    基础权重.持续次数 += 0.05;
    基础权重.消耗 -= 0.04;
    基础权重.前摇 -= 0.03;
  } else if (['强攻系', '敏攻系'].includes(系别)) {
    基础权重.消耗 += 0.05;
    基础权重.前摇 -= 0.02;
    基础权重.触发限制 -= 0.02;
  } else if (['控制系', '防御系'].includes(系别)) {
    基础权重.持续次数 += 0.08;
    基础权重.效果数值 -= 0.03;
    基础权重.前摇 += 0.02;
  } else if (系别 === '召唤系') {
    基础权重.效果数值 += 0.05;
    基础权重.持续次数 += 0.08;
    基础权重.消耗 -= 0.03;
  }
  if (造物) {
    基础权重.效果数值 += 0.06;
    基础权重.持续次数 += 0.04;
    基础权重.消耗 -= 0.04;
    基础权重.前摇 -= 0.03;
  }
  if (上下文?.预算收敛模式 === '最低形态') {
    基础权重.效果数值 += 0.18;
    基础权重.持续次数 += 0.12;
    基础权重.消耗 += 0.05;
    基础权重.前摇 += 0.04;
    基础权重.触发限制 += 0.04;
    基础权重.副作用 = 0;
  }
  if (上下文?.禁止副作用 === true) 基础权重.副作用 = 0;
  const 随机扰动 = 名称 => 0.85 + 读取生成随机数_V1(上下文, 211 + 名称.length * 17) * 0.30;
  const 权重 = Object.fromEntries(Object.entries(基础权重).map(([名称, 值]) => [名称, Math.max(0, Number(值 || 0) * 随机扰动(名称))]));
  const 总权重 = Object.values(权重).reduce((总和, 值) => 总和 + Math.max(0, Number(值 || 0)), 0) || 1;
  Object.keys(权重).forEach(名称 => { 权重[名称] = Number((权重[名称] / 总权重).toFixed(4)); });
  const 方案 = 上下文?.消耗前摇收口方案 || 选择消耗前摇收口方案_V1(上下文);
  return {
    权重,
    消耗倍率上限: Math.max(1, Number(方案?.消耗?.倍率上限 || 1.35)),
    前摇倍率上限: Math.max(1, Number(方案?.前摇?.倍率上限 || 1.35)),
    档位: 方案?.档位 || '自动权重',
    顺序: Object.keys(权重)
      .map(名称 => ({ 名称, 优先级: 读取生成随机数_V1(上下文, 307 + 名称.length * 31) }))
      .sort((左, 右) => 左.优先级 - 右.优先级)
      .map(项 => 项.名称),
  };
}

function 设置技能消耗倍数_V1(技能 = {}, 评估 = {}, 倍数 = 1) {
  const 标准消耗 = Number(评估?.标准消耗 || 0);
  if (!(标准消耗 > 0)) return false;
  const 目标消耗 = Math.max(1, Math.round(标准消耗 * Math.max(0.05, Number(倍数 || 1))));
  const 当前消耗 = Math.max(0, Number(评估?.实际消耗 || 0));
  if (Math.abs(目标消耗 - Math.round(当前消耗)) <= 1) return false;
  if (!(当前消耗 > 0) || 技能消耗字段缺失_V1(技能) || String(技能.消耗 ?? '').trim() === '无') {
    技能.消耗 = { 魂力: 目标消耗 };
    return true;
  }
  技能.消耗 = 缩放消耗结构数值_V1(cloneJsonValue(技能.消耗), 目标消耗 / 当前消耗);
  return true;
}

function 设置技能前摇倍数_V1(技能 = {}, 倍数 = 1) {
  const 新前摇 = Math.max(0, Math.round(获取标准前摇_V1() * Math.max(0.05, Number(倍数 || 1))));
  const 当前前摇 = Math.max(0, Math.round(Number(技能?.前摇 || 0)));
  if (Math.abs(新前摇 - 当前前摇) <= 0) return false;
  技能.前摇 = 新前摇;
  return true;
}

function 按预算份额提高消耗前摇_V1(技能 = {}, 预算上下文 = {}, 评估 = {}, 份额 = 0, 类型 = '消耗', 策略 = {}) {
  const 目标增加 = Math.max(0, Number(份额 || 0));
  if (!(目标增加 > 0)) return { 改动: false, 原因: '无预算份额' };
  const 运转基准 = Math.max(0.5, Number(评估?.运转基准 || 0));
  const 当前门禁 = Math.max(0.5, Number(评估?.实际门禁 || 0));
  const 目标门禁 = Math.min(
    Math.max(Number(评估?.实际COST || 当前门禁), Number(策略?.目标门禁 || 0)),
    当前门禁 + 目标增加,
  );
  if (!(目标门禁 > 当前门禁 + 0.01)) return { 改动: false, 原因: '硬门禁无需提高' };
  if (!Number.isFinite(Number(评估?.标准消耗)) || Number(评估?.标准消耗) <= 0) return { 改动: false, 原因: '百分比消耗不可改' };
  if (Number(评估?.位级硬上限 || Infinity) <= 当前门禁 + 0.01) return { 改动: false, 原因: '已到位级硬上限' };
  const 目标代价能量 = Math.max(0.05, Math.min(Math.cbrt(16), 目标门禁 / 运转基准));
  const 目标乘积 = 运转代价能量反推乘积_V1(目标代价能量);
  const 当前消耗倍数 = Math.max(0.05, Number(评估?.消耗倍数 || 1));
  const 当前前摇倍数 = Math.max(0.05, Number(评估?.前摇倍数 || 1));
  if (类型 === '消耗') {
    const 倍率上限 = Number(策略?.消耗倍率上限 || 1.35);
    if (当前消耗倍数 >= 倍率上限 - 0.001) return { 改动: false, 原因: '消耗已达阶段上限', 前倍数: 当前消耗倍数, 后倍数: 当前消耗倍数 };
    const 目标倍数 = Math.min(倍率上限, Math.max(当前消耗倍数, 目标乘积 / 当前前摇倍数));
    const 改动 = 设置技能消耗倍数_V1(技能, 评估, 目标倍数);
    return { 改动, 原因: 改动 ? '' : '消耗已达目标或上限', 前倍数: 当前消耗倍数, 后倍数: 目标倍数 };
  }
  const 倍率上限 = Number(策略?.前摇倍率上限 || 1.35);
  if (当前前摇倍数 >= 倍率上限 - 0.001) return { 改动: false, 原因: '前摇已达阶段上限', 前倍数: 当前前摇倍数, 后倍数: 当前前摇倍数 };
  const 目标倍数 = Math.min(倍率上限, Math.max(当前前摇倍数, 目标乘积 / 当前消耗倍数));
  const 改动 = 设置技能前摇倍数_V1(技能, 目标倍数);
  return { 改动, 原因: 改动 ? '' : '前摇已达目标或上限', 前倍数: 当前前摇倍数, 后倍数: 目标倍数 };
}

function 按目标COST反推消耗前摇_V1(技能 = {}, 上下文 = {}, 目标COST = 0) {
  if (!技能 || typeof 技能 !== 'object') return { 改动: false, 代价来源: [] };
  const 评估 = 评估技能预算_V1(技能, 上下文);
  const 角色 = 上下文?.角色 || {};
  const 利用率 = Math.max(0.05, Math.min(0.999, Number(计算天赋预算利用率_V1(角色, 上下文)) || 0.8));
  if (!Number.isFinite(Number(评估.标准消耗)) || Number(评估.标准消耗) <= 0) {
    return { 改动: false, 已收口: false, 利用率: null, 目标代价能量: Number(评估.代价能量 || 1), 代价来源: ['百分比消耗'] };
  }
  const 运转基准 = Math.max(0.5, Number(评估.运转基准 || 0));
  const 目标代价能量 = Math.max(0.05, Math.min(Math.cbrt(16), Number(目标COST || 0) / Math.max(0.5, 运转基准 * 利用率)));
  const 需要乘积 = Math.max(0.0025, Math.min(16, 运转代价能量反推乘积_V1(目标代价能量)));
  const 当前乘积 = Math.max(0.0025, Number(评估.消耗倍数 || 1) * Number(评估.前摇倍数 || 1));
  const 方案 = 上下文?.消耗前摇收口方案 || 选择消耗前摇收口方案_V1(上下文);
  const 目标乘积 = 当前乘积 + Math.max(0, 需要乘积 - 当前乘积) * Math.min(1, Number(方案.消耗.承担比例 || 0) + Number(方案.前摇.承担比例 || 0));
  let 消耗倍数 = Math.max(0.05, Math.min(Number(方案.消耗.倍率上限 || 1.35), Math.sqrt(目标乘积)));
  let 前摇倍数 = Math.max(0.05, Math.min(Number(方案.前摇.倍率上限 || 1.35), 目标乘积 / Math.max(0.05, 消耗倍数)));
  const 代价来源 = [];
  const 新前摇 = Math.max(0, Math.round(获取标准前摇_V1() * 前摇倍数));
  const 当前前摇 = Math.round(读取技能实际前摇_V1(技能, 上下文));
  const 消耗已改 = 设置技能消耗倍数_V1(技能, 评估, 消耗倍数);
  const 前摇已改 = Math.abs(当前前摇 - 新前摇) > 0 ? 设置技能前摇倍数_V1(技能, 前摇倍数) : false;
  if (消耗已改 || 前摇已改) {
    代价来源.push('消耗/前摇');
    记录技能生成事件_V1(上下文, {
      类型: '消耗前摇收口',
      档位: 方案.档位,
      消耗承担比例: Number(方案.消耗.承担比例 || 0),
      前摇承担比例: Number(方案.前摇.承担比例 || 0),
      消耗倍数: Number(消耗倍数.toFixed(3)),
      前摇倍数: Number(前摇倍数.toFixed(3)),
    });
  }
  return {
    改动: 代价来源.length > 0,
    已收口: true,
    利用率: Number(利用率.toFixed(4)),
    目标代价能量: Number(目标代价能量.toFixed(3)),
    档位: 方案.档位,
    消耗承担比例: Number(方案.消耗.承担比例 || 0),
    前摇承担比例: Number(方案.前摇.承担比例 || 0),
    代价来源,
  };
}

function 判定生成收口情况_V1(评估 = {}, 上下文 = {}) {
  const 运转基准 = Math.max(0.5, Number(评估?.运转基准 || 0));
  const 生成目标COST = Math.max(0.5, Number(上下文?.生成目标COST || 上下文?.目标COST || 0) || 运转基准);
  const 魂技位 = Math.max(1, Math.floor(Number(评估?.魂技位 ?? 上下文?.魂环位 ?? 上下文?.ringIndex ?? 1)) || 1);
  const 位级倍率上限 = 读取魂技位COST倍率上限_V1(魂技位);
  const 特殊预算 = 评估?.特殊预算 && typeof 评估.特殊预算 === 'object';
  const 生成范围倍率上限 = 特殊预算
    ? Math.max(0.7, Number(评估?.实际门禁 || 0) / Math.max(0.5, 运转基准))
    : (Number.isFinite(位级倍率上限) ? 位级倍率上限 : Math.cbrt(16));
  const 生成范围下沿 = 读取预算评估最低有效COST_V1(评估, 上下文);
  const 生成范围上沿 = Math.max(生成范围下沿, 运转基准 * 生成范围倍率上限);
  const 实际净COST = Math.max(0, Number(评估?.实际COST || 0));
  const 当前承载上限 = Math.max(0.5, Number(评估?.实际门禁 || 0));
  const 最大承载上限 = 特殊预算
    ? Math.max(0.5, Number(评估?.实际门禁 || 0))
    : Math.min(运转基准 * Math.cbrt(16), Number(评估?.位级硬上限 || Infinity) || Infinity);
  const 接近承载上限 = 当前承载上限 - 实际净COST <= Math.max(1, 当前承载上限 * 0.08);
  const 无可缩放 = 上下文?.无可缩放 === true;
  let 编号 = 3;
  let 名称 = '生成范围内';
  if (无可缩放) {
    编号 = 9;
    名称 = '机制不可缩放或规则类技能';
  } else if (实际净COST < 生成范围下沿) {
    编号 = 1;
    名称 = '实际COST低于生成范围';
  } else if (实际净COST <= 生成范围上沿) {
    编号 = 3;
    名称 = '生成范围内';
  } else if (实际净COST > 生成范围上沿 && 实际净COST <= 当前承载上限 && 接近承载上限) {
    编号 = 6;
    名称 = '超目标且接近承载上限';
  } else if (实际净COST > 生成范围上沿 && 实际净COST <= 当前承载上限) {
    编号 = 5;
    名称 = '高于生成范围但仍可承载';
  } else if (实际净COST > 最大承载上限) {
    编号 = 8;
    名称 = '超出最大可承载';
  } else if (实际净COST > 当前承载上限) {
    编号 = 7;
    名称 = '超出当前承载但可通过消耗前摇承载';
  }
  return {
    编号,
    名称,
    运转基准,
    生成目标COST: Number(生成目标COST.toFixed(2)),
    生成范围下沿: Number(生成范围下沿.toFixed(2)),
    生成范围上沿: Number(生成范围上沿.toFixed(2)),
    生成范围倍率上限: Number(生成范围倍率上限.toFixed(4)),
    实际净COST: Number(实际净COST.toFixed(2)),
    当前承载上限: Number(当前承载上限.toFixed(2)),
    最大承载上限: Number(最大承载上限.toFixed(2)),
  };
}

function 执行生成收口情况_V1(技能 = {}, 上下文 = {}) {
  if (!技能 || typeof 技能 !== 'object') return { 改动: false, 情况: null, 动作: [] };
  const 动作 = [];
  const 已有生成触发限制降压 = () => {
    const 抵扣上限 = 读取技能限制抵扣上限_V1(技能);
    let 命中 = false;
    遍历直接结算预算效果_V1(技能._效果数组, 效果 => {
      if (命中 || !效果 || typeof 效果 !== 'object') return;
      if (效果支持生成触发限制_V1(效果) && Math.min(抵扣上限, 解析次数限制抵扣率_V1(效果.触发限制)) >= 0.40) 命中 = true;
    });
    return 命中;
  };
  let 评估 = 评估技能预算_V1(技能, 上下文);
  let 情况 = 判定生成收口情况_V1(评估, 上下文);
  if (情况.编号 === 1) {
    const 结果 = 生成阶段按目标COST填充效果强度_V1(技能, {
      ...上下文,
      目标COST: 情况.生成目标COST,
      最低目标COST: 情况.生成目标COST,
    });
    if (结果?.无可缩放) {
      动作.push('无可缩放');
      return { 改动: 动作.length > 0, 情况: 判定生成收口情况_V1(结果?.评估 || 评估, { ...上下文, 无可缩放: true }), 动作 };
    }
    if (结果?.改动) 动作.push('增强效果到生成目标');
    评估 = 结果?.评估 || 评估技能预算_V1(技能, 上下文);
    情况 = 判定生成收口情况_V1(评估, 上下文);
  }
  if (情况.编号 === 8) {
    const 触发限制数 = 尝试生成阶段触发限制降压_V1(技能);
    if (触发限制数 > 0) {
      动作.push(`触发限制×${触发限制数}`);
      评估 = 评估技能预算_V1(技能, 上下文);
      情况 = 判定生成收口情况_V1(评估, 上下文);
    }
  }
  if ([3, 4, 5, 6, 7, 8].includes(情况.编号)) {
    const 代价结果 = 按目标COST反推消耗前摇_V1(技能, 上下文, Number(评估.实际COST || 0));
    if (代价结果?.改动) 动作.push(`消耗前摇:${代价结果.档位 || '默认'}`);
    if (代价结果?.改动) 评估 = 评估技能预算_V1(技能, 上下文);
    情况 = 判定生成收口情况_V1(评估, 上下文);
  }
  if ([5, 6, 8].includes(情况.编号)) {
    const 目标 = 情况.编号 === 8 ? Math.min(情况.生成范围上沿, 情况.最大承载上限) : 情况.生成范围上沿;
    const 缩放 = Math.max(0.05, Math.min(0.98, 目标 / Math.max(1, Number(评估.实际COST || 1))));
    const 缩减数 = 缩减效果数值百分比_V1(技能._效果数组, 缩放);
    if (缩减数 > 0) {
      动作.push(`压缩效果×${缩减数}`);
      记录技能生成事件_V1(上下文, { 类型: '效果收口', 缩减数, 缩放: Number(缩放.toFixed(3)) });
      评估 = 评估技能预算_V1(技能, 上下文);
    }
    情况 = 判定生成收口情况_V1(评估, 上下文);
  }
  if ([4, 5, 6, 7, 8].includes(情况.编号) && !已有生成触发限制降压() && 尝试生成阶段副作用降压_V1(技能, 上下文) > 0) {
    动作.push('副作用');
    评估 = 评估技能预算_V1(技能, 上下文);
    情况 = 判定生成收口情况_V1(评估, 上下文);
  }
  if (情况.编号 === 8) {
    const 收口 = 让技能符合预算_V1(技能, Number(评估.魂技位 || 上下文?.魂环位 || 1), { ...上下文, 强制上限: 情况.最大承载上限 });
    if (收口?.降级记录?.处理记录?.length) 动作.push('最大承载降级');
    评估 = 收口?.评估 || 评估技能预算_V1(技能, 上下文);
    情况 = 判定生成收口情况_V1(评估, 上下文);
  }
  return { 改动: 动作.length > 0, 情况, 动作, 评估 };
}

function 生成阶段按目标COST填充效果强度_V1(技能 = {}, 上下文 = {}) {
  if (!技能 || typeof 技能 !== 'object' || !Array.isArray(技能._效果数组)) return { 改动: false, 无可缩放: true };
  const 预算上下文 = {
    ...(上下文 || {}),
    魂环位: Math.max(1, Number(上下文?.ringIndex ?? 上下文?.魂环位 ?? 1) || 1),
    启用位级硬上限: 上下文?.启用位级硬上限 ?? true,
  };
  let 评估 = 评估技能预算_V1(技能, 预算上下文);
  const 目标COST = Math.max(0, Number(上下文?.目标COST || 0) || 计算生成目标COST_V1(评估, 预算上下文).生成目标COST);
  const 最低目标COST = Math.max(0, Number(上下文?.最低目标COST || 0) || 目标COST);
  if (!(目标COST > 0) || Number(评估.实际COST || 0) >= 最低目标COST) {
    return { 改动: false, 无可缩放: false, 目标COST, 最低目标COST, 评估 };
  }
  const 统一补强结果 = 提高技能效果到目标COST_V1(技能, 预算上下文, Math.max(目标COST, 最低目标COST));
  if (统一补强结果?.改动 || 统一补强结果?.无可缩放 === true) {
    const 补强后评估 = 统一补强结果?.评估 || 评估技能预算_V1(技能, 预算上下文);
    if (Number(补强后评估.实际COST || 0) >= 最低目标COST - 技能预算COST容差_V1 || 统一补强结果?.无可缩放 === true) {
      return { 改动: !!统一补强结果?.改动, 无可缩放: 统一补强结果?.无可缩放 === true, 目标COST, 最低目标COST, 评估: 补强后评估 };
    }
    评估 = 补强后评估;
  }
  const 读取效果对象 = 路径 => {
    const 片段 = String(路径 || '')
      .split(/[.[\]]/)
      .map(项 => String(项 || '').trim())
      .filter(Boolean);
    if (片段[0] === '_效果数组') return 读取运行时路径值_V1(技能._效果数组, 片段.slice(1));
    return 读取运行时路径值_V1(技能, 片段);
  };
  const 候选 = (Array.isArray(评估?.效果明细) ? 评估.效果明细 : []).map(明细 => {
    if (明细?.计入COST !== true) return null;
    const 路径 = String(明细?.路径 || '');
    const 效果 = 读取效果对象(明细?.路径);
    if (!效果 || typeof 效果 !== 'object') return null;
    const 原型 = String(效果?.原型 || '').trim();
    const COST = Math.max(0, Number(明细?.净COST ?? 明细?.原始COST ?? 0) || 0);
    if (!(COST > 0)) return;
    if (原型 === '伤害结算') {
      return { 效果, COST, 类型: '伤害', 明细 };
    }
    if (原型 === '召唤生成') {
      return { 效果, COST, 类型: '召唤', 明细 };
    }
    if (效果.数值 !== undefined && !['规则防御', '状态移除', '状态转移', '状态交换'].includes(原型)) {
      const 文本 = String(效果.数值 ?? '').trim();
      const 数值 = Number(文本.replace(/[+%-]/g, ''));
      if (Number.isFinite(数值) && Math.abs(数值) > 0) {
        const 关联效果 = [];
        const 条件分支位置 = 路径.indexOf('.条件分支[');
        if (条件分支位置 > 0) {
          const 父效果 = 读取效果对象(路径.slice(0, 条件分支位置));
          const 父数值 = Number(String(父效果?.数值 ?? '').trim().replace(/[+%-]/g, ''));
          if (父效果 && 父效果 !== 效果 && String(父效果?.原型 || '').trim() === 原型 && Number.isFinite(父数值) && Math.abs(父数值) > 0) {
            关联效果.push(父效果);
          }
        }
        return { 效果, COST, 类型: '数值', 关联效果, 明细 };
      }
    }
    return null;
  }).filter(Boolean);
  const 候选总COST = 候选.reduce((总和, 项) => 总和 + Number(项.COST || 0), 0);
  if (!(候选总COST > 0)) return { 改动: false, 无可缩放: true, 目标COST, 最低目标COST, 评估 };
  const 基础COST = Math.max(0, Number(评估.实际COST || 0) - 候选总COST);
  const 候选目标总COST = Math.max(0, 目标COST - 基础COST);
  if (!(候选目标总COST > 候选总COST * 1.01)) return { 改动: false, 无可缩放: false, 目标COST, 最低目标COST, 评估 };
  候选.forEach(项 => {
    const 分配COST = 候选目标总COST * (项.COST / 候选总COST);
    const 明细补强 = 按明细目标COST补强效果数值_V1(项.效果, 项.明细 || {}, 分配COST);
    if (明细补强 > 0) {
      (Array.isArray(项.关联效果) ? 项.关联效果 : []).forEach(关联效果 => {
        按明细目标COST补强效果数值_V1(关联效果, 项.明细 || {}, 分配COST);
      });
      return;
    }
    if (项.类型 === '伤害') {
      项.效果.威力倍率 = 按伤害COST反推威力倍率_V1(分配COST, 项.效果, 预算上下文);
      return;
    }
    const 倍率 = Math.max(1, 分配COST / Math.max(0.01, 项.COST));
    if (项.类型 === '召唤') {
      if (召唤生成使用继承属性比例_V1(项.效果)) {
        项.效果.继承属性比例 = Number(Math.min(1, 读取召唤生成平均继承比例_V1(项.效果) * 倍率).toFixed(3));
      } else {
        项.效果.强度 = Number(Math.min(5, Math.max(0.1, Number(项.效果.强度 || 1) * 倍率)).toFixed(3));
      }
      return;
    }
    const 文本 = String(项.效果.数值 ?? '').trim();
    const 是百分比 = /%$/.test(文本);
    const 符号 = 文本.startsWith('-') ? '-' : (文本.startsWith('+') ? '+' : '');
    const 原值 = Number(文本.replace(/[+%-]/g, ''));
    if (!Number.isFinite(原值)) return;
    const 新值 = Number(Math.max(5, Math.abs(原值) * 倍率).toFixed(2));
    项.效果.数值 = 是百分比 ? `${符号 || '+'}${新值}%` : (符号 === '-' ? -新值 : 新值);
    (Array.isArray(项.关联效果) ? 项.关联效果 : []).forEach(关联效果 => {
      const 关联文本 = String(关联效果?.数值 ?? '').trim();
      const 关联原值 = Number(关联文本.replace(/[+%-]/g, ''));
      if (!Number.isFinite(关联原值)) return;
      const 关联百分比 = /%$/.test(关联文本);
      const 关联符号 = 关联文本.startsWith('-') ? '-' : (关联文本.startsWith('+') ? '+' : '');
      const 关联新值 = Number(Math.max(5, Math.abs(关联原值) * 倍率).toFixed(2));
      关联效果.数值 = 关联百分比 ? `${关联符号 || '+'}${关联新值}%` : (关联符号 === '-' ? -关联新值 : 关联新值);
    });
  });
  评估 = 评估技能预算_V1(技能, 预算上下文);
  return { 改动: true, 无可缩放: false, 目标COST, 最低目标COST, 评估 };
}

function 生成阶段收敛目标COST填充_V1(技能 = {}, 上下文 = {}) {
  if (!技能 || typeof 技能 !== 'object' || !Array.isArray(技能._效果数组)) return { 改动: false, 无可缩放: true };
  const 预算上下文 = {
    ...(上下文 || {}),
    魂环位: Math.max(1, Number(上下文?.ringIndex ?? 上下文?.魂环位 ?? 1) || 1),
    启用位级硬上限: 上下文?.启用位级硬上限 ?? true,
  };
  const 初始评估 = 评估技能预算_V1(技能, 预算上下文);
  const 目标摘要 = 计算生成目标COST_V1(初始评估, 预算上下文);
  const 硬上限 = Math.max(0.5, Number(初始评估?.实际门禁 || 0));
  const 生成目标COST = Math.min(
    硬上限,
    Number(上下文?.目标COST || 0) > 0 ? Number(上下文.目标COST) : 目标摘要.生成目标COST,
  );
  const 低COST线 = 读取预算评估最低有效COST_V1(初始评估, 预算上下文);
  const 最低目标COST = Math.min(
    硬上限,
    Number(上下文?.最低目标COST || 0) > 0 ? Number(上下文.最低目标COST) : 生成目标COST,
  );
  let 结果 = { 改动: false, 无可缩放: false, 目标COST: 生成目标COST, 最低目标COST, 评估: 初始评估 };
  if (Number(初始评估.实际COST || 0) >= Math.max(低COST线, 最低目标COST) - 技能预算COST容差_V1) return 结果;
  for (let 次 = 0; 次 < 4; 次 += 1) {
    结果 = 生成阶段按目标COST填充效果强度_V1(技能, {
      ...预算上下文,
      目标COST: 生成目标COST,
      最低目标COST,
    });
    收口技能执行结构_V1(技能, {
      目标: 上下文?.目标 || '单体',
      passiveMode: 上下文?.passiveMode === true,
      技能,
    });
    if (Array.isArray(技能._效果数组) && 上下文?.系别) 应用生成魂技系别驱动属性_V1(技能._效果数组, 上下文.系别);
    const 后评估 = 评估技能预算_V1(技能, 预算上下文);
    结果 = { ...(结果 || {}), 评估: 后评估 };
    if (Number(后评估.实际COST || 0) >= Math.max(0, 最低目标COST - 技能预算COST容差_V1)) break;
    if (结果?.无可缩放) break;
  }
  return 结果;
}

function 应用生成阶段目标COST收口_V1(技能 = {}, 上下文 = {}) {
  if (!技能 || typeof 技能 !== 'object' || !Array.isArray(技能._效果数组)) return { 技能, 目标填充结果: null, 评估: null };
  const 预算上下文 = {
    ...构建自动生成预算上下文_V1(上下文 || {}),
    魂环位: Math.max(1, Number(上下文?.ringIndex ?? 上下文?.魂环位 ?? 1) || 1),
    启用位级硬上限: 上下文?.启用位级硬上限 ?? true,
  };
  const 收敛结果 = 收敛技能到预算区间_V1(技能, 预算上下文, 上下文?.候选预算档案 || null);
  return { 技能, 目标填充结果: null, 收口情况结果: 收敛结果, 评估: 收敛结果?.评估 || null };
}

function 读取天赋预算利用率下限_V1(角色 = {}, 上下文 = {}) {
  const 天赋梯队 = String(角色?.属性?.天赋梯队 ?? 角色?.天赋梯队 ?? 上下文?.talentTier ?? '正常').trim() || '正常';
  const 档位 = 生成预算利用率档位_V1[天赋梯队] || 生成预算利用率档位_V1.正常;
  return Math.max(0.05, Math.min(1, Number(档位?.[0] || 0.75)));
}

function 补足自动生成技能预算承载_V1(技能 = {}, 上下文 = {}) {
  if (!技能 || typeof 技能 !== 'object' || !Array.isArray(技能._效果数组)) return false;
  const 结果 = 收敛技能到预算区间_V1(技能, 上下文, 上下文?.候选预算档案 || null);
  return !!结果?.改动;
}

function 压缩自动生成最终超预算效果_V1(技能 = {}, 预算上下文 = {}, 失败标签 = '未命名机制') {
  const 收敛结果 = 收敛技能到预算区间_V1(技能, { ...(预算上下文 || {}), 机制标签: 失败标签 }, 预算上下文?.候选预算档案 || null);
  return { 改动: !!收敛结果?.改动, 评估: 收敛结果?.评估 || null };
}

function 最终同步生成预算承载_V1(技能 = {}, 上下文 = {}, 失败标签 = '未命名机制') {
  if (!技能 || typeof 技能 !== 'object' || !Array.isArray(技能._效果数组)) return { 改动: false, 评估: null };
  const 结果 = 断言技能预算_V1(技能, 上下文, 失败标签);
  return { 改动: false, 评估: 结果?.评估 || null };
}

var 最终收口自动生成技能预算_V1 = 最终同步生成预算承载_V1;

function 断言并同步自动生成最终预算_V1(技能 = {}, 上下文 = {}, 机制标签 = '未命名机制') {
  const 结果 = 断言技能预算_V1(技能, 上下文, 机制标签);
  return { 改动: false, 评估: 结果?.评估 || null };
}

function 收紧高价值布尔效果限制_V1(效果数组 = [], 技能 = {}) {
  let 改动数 = 0;
  const 允许写入触发限制 = 读取技能限制抵扣上限_V1(技能) > 0.10;
  遍历直接结算预算效果_V1(效果数组, 效果 => {
    if (!效果 || typeof 效果 !== 'object') return;
    const 原型 = String(效果?.原型 || '').trim();
    const 状态 = String(效果?.状态 || '').trim();
    const 规则 = String(效果?.规则 || '').trim();
    const 是高价值布尔 =
      (原型 === '状态施加' && ['无视异常', '霸体'].includes(状态)) ||
      (原型 === '规则防御' && ['免伤', '免死'].includes(规则));
    if (!是高价值布尔) return;
    if (Number.isFinite(Number(效果.持续回合)) && Number(效果.持续回合) > 1) {
      效果.持续回合 = 1;
      改动数 += 1;
    }
    if (Number.isFinite(Number(效果.次数)) && Number(效果.次数) > 1) {
      效果.次数 = 1;
      改动数 += 1;
    }
    if (Number.isFinite(Number(效果.可用次数)) && Number(效果.可用次数) > 1) {
      效果.可用次数 = 1;
      改动数 += 1;
    }
    const 已有触发限制 = 效果.触发限制 && typeof 效果.触发限制 === 'object' && !Array.isArray(效果.触发限制);
    if (允许写入触发限制 && !已有触发限制) {
      效果.触发限制 = { 周期: '每日', 次数: 1 };
      改动数 += 1;
    }
  });
  return 改动数;
}

function 查找技能首个持续状态_V1(效果数组 = []) {
  let 命中 = '';
  遍历直接结算预算效果_V1(效果数组, 效果 => {
    if (命中) return;
    if (String(效果?.原型 || '').trim() === '状态施加' && Number(效果?.持续回合 || 0) > 0) {
      const 状态 = String(效果?.状态 || '').trim();
      if (状态) 命中 = 状态;
    }
  });
  return 命中;
}

function 抓取效果字段快照_V1(效果数组 = [], 前缀 = '_效果数组') {
  if (!Array.isArray(效果数组)) return [];
  const 快照 = [];
  效果数组.forEach((效果, 序号) => {
    if (!效果 || typeof 效果 !== 'object') return;
    const 路径 = `${前缀}[${序号}]`;
    快照.push({
      路径,
      原型: String(效果?.原型 || '').trim(),
      威力倍率: 效果?.威力倍率,
      数值: 效果?.数值,
      副数值: 效果?.副数值,
      强度: 效果?.强度,
      继承属性比例: 效果?.继承属性比例,
      持续回合: 效果?.持续回合,
      可用次数: 效果?.可用次数,
    });
    技能执行嵌套效果数组字段表_V1.forEach(键 => {
      if (Array.isArray(效果?.[键])) 快照.push(...抓取效果字段快照_V1(效果[键], `${路径}.${键}`));
    });
    (Array.isArray(效果.条件分支) ? 效果.条件分支 : []).forEach((分支, 分支序号) => {
      技能条件分支效果数组字段表_V1.forEach(键 => {
        if (Array.isArray(分支?.[键])) 快照.push(...抓取效果字段快照_V1(分支[键], `${路径}.条件分支[${分支序号}].${键}`));
      });
    });
  });
  return 快照;
}

function 对比效果字段快照_V1(前 = [], 后 = []) {
  if (!Array.isArray(前) || !Array.isArray(后)) return [];
  const 后表 = new Map(后.map(项 => [项.路径, 项]));
  const 变化列表 = [];
  前.forEach(前项 => {
    const 后项 = 后表.get(前项?.路径);
    if (!前项 || !后项) return;
    ['威力倍率', '数值', '副数值', '强度', '继承属性比例', '持续回合', '可用次数'].forEach(字段 => {
      const 前值 = 前项[字段];
      const 后值 = 后项[字段];
      if (前值 === 后值 || 前值 === undefined || 后值 === undefined) return;
      变化列表.push({ 路径: 前项.路径, 原型: 前项.原型, 字段, 前值, 后值 });
    });
  });
  return 变化列表
    .sort((a, b) => Math.abs(Number(String(b.前值).replace(/[+%-]/g, '')) || 0) - Math.abs(Number(String(a.前值).replace(/[+%-]/g, '')) || 0))
    .slice(0, 5);
}

function 缩减效果数值百分比_V1(效果数组 = [], 缩放 = 1) {
  if (!Array.isArray(效果数组) || 缩放 >= 1) return 0;
  let 改动数 = 0;
  效果数组.forEach(效果 => {
    if (!效果 || typeof 效果 !== 'object') return;
    ['数值', '副数值', '威力倍率'].forEach(键 => {
      const 原值 = 效果[键];
      if (原值 === undefined || 原值 === null || 原值 === '') return;
      const 文本 = String(原值);
      const 是百分比 = 文本.includes('%');
      const 符号 = 文本.startsWith('+') ? '+' : (文本.startsWith('-') ? '-' : '');
      const 数 = Number(文本.replace(/[+%-]/g, ''));
      if (!Number.isFinite(数)) return;
      const 新数 = Number(Math.max(是百分比 ? 5 : 1, 数 * 缩放).toFixed(2));
      if (新数 >= 数) return;
      效果[键] = 是百分比 ? `${符号}${新数}%` : (符号 === '-' ? -新数 : 新数);
      改动数 += 1;
    });
    if (Number.isFinite(Number(效果.持续回合)) && Number(效果.持续回合) > 1) {
      const 新持续 = Math.max(1, Math.round(Number(效果.持续回合) * Math.sqrt(缩放)));
      if (新持续 < Number(效果.持续回合)) {
        效果.持续回合 = 新持续;
        改动数 += 1;
      }
    }
    if (Number.isFinite(Number(效果.可用次数)) && Number(效果.可用次数) > 1) {
      const 新次数 = Math.max(1, Math.round(Number(效果.可用次数) * Math.sqrt(缩放)));
      if (新次数 < Number(效果.可用次数)) {
        效果.可用次数 = 新次数;
        改动数 += 1;
      }
    }
    if (String(效果.原型 || '').trim() === '召唤生成') {
      if (召唤生成使用继承属性比例_V1(效果)) {
        const 原比例 = Number(效果.继承属性比例);
        if (Number.isFinite(原比例) && 原比例 > 0.01) {
          const 新比例 = Number(Math.max(0.01, 原比例 * 缩放).toFixed(3));
          if (新比例 < 原比例) {
            效果.继承属性比例 = 新比例;
            改动数 += 1;
          }
        }
      } else {
        const 原强度 = Number(效果.强度);
        if (Number.isFinite(原强度) && 原强度 > 0.1) {
          const 新强度 = Number(Math.max(0.1, 原强度 * 缩放).toFixed(3));
          if (新强度 < 原强度) {
            效果.强度 = 新强度;
            改动数 += 1;
          }
        }
      }
    }
    技能执行嵌套效果数组字段表_V1.forEach(键 => {
      if (Array.isArray(效果?.[键])) 改动数 += 缩减效果数值百分比_V1(效果[键], 缩放);
    });
    (Array.isArray(效果.条件分支) ? 效果.条件分支 : []).forEach(分支 => {
      技能条件分支效果数组字段表_V1.forEach(键 => {
        if (Array.isArray(分支?.[键])) 改动数 += 缩减效果数值百分比_V1(分支[键], 缩放);
      });
    });
  });
  return 改动数;
}

function 遍历直接结算预算效果_V1(效果数组 = [], 回调 = () => {}, 结算倍率 = 1) {
  (Array.isArray(效果数组) ? 效果数组 : []).forEach(效果 => {
    if (!效果 || typeof 效果 !== 'object' || Array.isArray(效果)) return;
    回调(效果, 结算倍率);
    // 造物承载会按数量生成多个物品，每个使用后都触发一次 使用效果，
    // 因此使用效果要按数量线性放大；这与 伤害结算 乘 攻击段数 是同一口径。
    // 授予效果 / 结算效果 不随数量重复，保持原倍率。
    const 造物数量 = Math.max(1, Number(效果?.数量 || 1) || 1);
    技能执行嵌套效果数组字段表_V1.forEach(字段名 => {
      const 子倍率 = 字段名 === '使用效果' ? 结算倍率 * 造物数量 : 结算倍率;
      遍历直接结算预算效果_V1(效果?.[字段名], 回调, 子倍率);
    });
    // 条件分支之间互斥，只会命中一条，不叠乘
    (Array.isArray(效果.条件分支) ? 效果.条件分支 : []).forEach(分支 => {
      遍历直接结算预算效果_V1(分支?.替换效果, 回调, 结算倍率);
      遍历直接结算预算效果_V1(分支?.追加效果, 回调, 结算倍率);
    });
  });
}

function 计算直接结算收益预算效果压力_V1(效果 = {}) {
  const 原型 = String(效果?.原型 || '').trim();
  const 目标系数 = 读取直接结算预算目标系数_V1(效果?.目标 || '目标');
  const 持续系数 = 读取直接结算预算持续系数_V1(效果);
  if (原型 === '伤害结算') {
    const 威力倍率 = Math.max(0, Number(效果?.威力倍率 || 100));
    const 穿透系数 = 计算防御穿透COST系数_V1(效果?.防御穿透);
    const 伤害类型系数 = String(效果?.伤害类型 || '').includes('真实') ? 直接结算收益预算系数_V1.真实伤害系数 : 1;
    // 攻击段数只拆分同一总伤害，不复制总威力；收益压力必须与正式结算和 COST 真值表使用同一量纲。
    return { 高绑定压力: 威力倍率 * 目标系数 * 伤害类型系数 * 穿透系数, 中绑定压力: 0 };
  }
  if (原型 === '结算修正') {
    const 结算 = String(效果?.结算 || '').trim();
    const 强度 = 读取直接结算预算百分强度_V1(效果?.数值, 0);
    const 正向强度 = Math.max(0, 强度);
    const 绝对强度 = Math.max(0, Math.abs(强度));
    if (['造成伤害', '受到伤害', '防御穿透'].includes(结算) && 正向强度 > 0) {
      return { 高绑定压力: 正向强度 * 100 * 目标系数 * 持续系数, 中绑定压力: 0 };
    }
    if (['反伤', '反击', '伤害转移', '伤害分摊', '伤害吸收'].includes(结算) && 绝对强度 > 0) {
      return { 高绑定压力: 绝对强度 * 100 * 目标系数 * 持续系数 * 直接结算收益预算系数_V1.伤害改写系数, 中绑定压力: 0 };
    }
    if (['伤害转治疗', '治疗转伤害'].includes(结算) && 绝对强度 > 0) {
      return { 高绑定压力: 绝对强度 * 100 * 目标系数 * 持续系数 * 直接结算收益预算系数_V1.转化规则系数, 中绑定压力: 0 };
    }
    if (结算 === '持续伤害引爆' && 绝对强度 > 0) {
      return { 高绑定压力: 绝对强度 * 100 * 目标系数 * 直接结算收益预算系数_V1.伤害改写系数, 中绑定压力: 0 };
    }
    if (['治疗', '消耗分摊'].includes(结算) && 正向强度 > 0) {
      return { 高绑定压力: 0, 中绑定压力: 正向强度 * 100 * 目标系数 * 持续系数 * 直接结算收益预算系数_V1.资源收益系数 };
    }
  }
  if (原型 === '资源变化') {
    const 强度 = 读取直接结算预算资源变化压力强度_V1(效果?.数值, 0);
    if (强度 > 0) return { 高绑定压力: 0, 中绑定压力: 强度 * 目标系数 * 持续系数 * 直接结算收益预算系数_V1.资源收益系数 };
  }
  if (原型 === '资源转移') {
    const 方式 = String(效果?.资源转移方式 || '').trim();
    if (['吞噬', '共享', '均分', '转移'].includes(方式)) {
      const 强度 = Math.max(0, Math.abs(读取直接结算预算百分强度_V1(效果?.数值, '100%')) || 1);
      return { 高绑定压力: 0, 中绑定压力: 强度 * 100 * 目标系数 * 持续系数 * 直接结算收益预算系数_V1.资源收益系数 };
    }
  }
  return { 高绑定压力: 0, 中绑定压力: 0 };
}

function 计算直接结算收益预算_V1(技能 = {}, 上下文 = {}) {
  const 技能对象 = Array.isArray(技能) ? { _效果数组: 技能 } : (技能 && typeof 技能 === 'object' ? 技能 : {});
  let 高绑定压力 = 0;
  let 中绑定压力 = 0;
  const 压力来源列表 = [];
  遍历直接结算预算效果_V1(技能对象._效果数组 || [], (效果, 结算倍率 = 1) => {
    const 倍率 = Math.max(1, Number(结算倍率 || 1) || 1);
    const 压力 = 计算直接结算收益预算效果压力_V1(效果);
    const 高绑定 = Number(压力.高绑定压力 || 0) * 倍率;
    const 中绑定 = Number(压力.中绑定压力 || 0) * 倍率;
    高绑定压力 += 高绑定;
    中绑定压力 += 中绑定;
    const 折算压力 = 高绑定 + 中绑定 * 直接结算收益预算系数_V1.中绑定折扣;
    if (折算压力 > 0) {
      压力来源列表.push({
        原型: String(效果?.原型 || '').trim() || '未知',
        目标: String(效果?.目标 || '').trim() || '单体',
        结算: String(效果?.结算 || 效果?.资源 || 效果?.规则 || '').trim(),
        压力: Number(折算压力.toFixed(4)),
        结算倍率: 倍率 > 1 ? 倍率 : undefined,
      });
    }
  });
  const 总效果压力 = 高绑定压力 + 中绑定压力 * 直接结算收益预算系数_V1.中绑定折扣;
  const 有收益预算 = 总效果压力 > 0;
  if (
    有收益预算 &&
    (技能消耗字段缺失_V1(技能对象) || String(技能对象.消耗 ?? '').trim() === '无') &&
    (!Object.prototype.hasOwnProperty.call(技能对象, '前摇') || Number(技能对象.前摇 ?? 0) <= 0)
  ) {
    const 允许压力 = 直接结算收益预算系数_V1.基准收益 * 直接结算收益预算系数_V1.宽容系数;
    const 预算系数 = Math.min(1, 允许压力 / Math.max(1, 总效果压力));
    return {
      有收益预算,
      高绑定压力: Number(高绑定压力.toFixed(4)),
      中绑定压力: Number(中绑定压力.toFixed(4)),
      总效果压力: Number(总效果压力.toFixed(4)),
      消耗比例: 0,
      前摇: 0,
      消耗承载: 1,
      前摇承载: 1,
      综合承载: 1,
      允许压力: Number(允许压力.toFixed(4)),
      预算系数: Number(预算系数.toFixed(4)),
      通过: true,
      主要压力来源: 压力来源列表
        .sort((左, 右) => Number(右.压力 || 0) - Number(左.压力 || 0))
        .slice(0, 5),
      短板: '',
      提示: 预算系数 >= 0.995 ? '' : `收益承载不足，直接效果按${Math.round(预算系数 * 100)}%生效`,
    };
  }
  const 消耗比例 = Math.max(0, 读取直接结算预算消耗比例_V1(技能对象.消耗, 上下文));
  const 前摇 = Math.max(0, Number(技能对象.前摇 ?? 0));
  const 消耗承载 = Math.max(
    直接结算收益预算系数_V1.承载下限,
    计算直接结算软承载_V1(
      消耗比例,
      直接结算收益预算系数_V1.消耗基准比例,
      直接结算收益预算系数_V1.消耗承载指数,
    ),
  );
  const 前摇承载 = Math.max(
    直接结算收益预算系数_V1.承载下限,
    计算直接结算软承载_V1(
      前摇,
      直接结算收益预算系数_V1.前摇基准tick,
      直接结算收益预算系数_V1.前摇承载指数,
    ),
  );
  const 短板惩罚 = Math.pow(
    Math.min(1, 消耗承载, 前摇承载),
    直接结算收益预算系数_V1.短板惩罚指数,
  );
  const 来源承载 = Math.max(0.01, 读取直接结算预算来源承载_V1(上下文));
  const 条件承载 = Math.max(0.01, Number(上下文?.条件承载 || 1));
  const 综合承载 = 计算运转代价能量_V1(消耗承载, 前摇承载) * 短板惩罚 * 来源承载 * 条件承载;
  const 允许压力 = 直接结算收益预算系数_V1.基准收益 * 综合承载 * 直接结算收益预算系数_V1.宽容系数;
  const 运转折减 = Math.min(
    1,
    1 / Math.max(1, 消耗比例 / Math.max(0.0001, 直接结算收益预算系数_V1.消耗基准比例)),
    1 / Math.max(1, 前摇 / Math.max(0.0001, 直接结算收益预算系数_V1.前摇基准tick)),
  );
  const 预算系数 = !有收益预算 ? 1 : Math.min(1, 允许压力 / Math.max(1, 总效果压力));
  const 通过 = true;
  const 主要压力来源 = 压力来源列表
    .sort((左, 右) => Number(右.压力 || 0) - Number(左.压力 || 0))
    .slice(0, 5);
  const 短板候选 = [
    { 名称: '消耗', 值: 消耗承载 },
    { 名称: '前摇', 值: 前摇承载 },
  ].sort((左, 右) => Number(左.值 || 0) - Number(右.值 || 0));
  return {
    有收益预算,
    高绑定压力: Number(高绑定压力.toFixed(4)),
    中绑定压力: Number(中绑定压力.toFixed(4)),
    总效果压力: Number(总效果压力.toFixed(4)),
    消耗比例: Number(消耗比例.toFixed(4)),
    消耗承载: Number(消耗承载.toFixed(4)),
    前摇: Number(前摇.toFixed(4)),
    前摇承载: Number(前摇承载.toFixed(4)),
    运转折减: Number(运转折减.toFixed(4)),
    短板惩罚: Number(短板惩罚.toFixed(4)),
    综合承载: Number(综合承载.toFixed(4)),
    来源承载: Number(来源承载.toFixed(4)),
    条件承载: Number(条件承载.toFixed(4)),
    允许压力: Number(允许压力.toFixed(4)),
    预算系数: Number(预算系数.toFixed(4)),
    主要压力来源,
    主要短板: 短板候选.length ? 短板候选[0].名称 : '',
    通过,
    提示: !有收益预算 || 预算系数 >= 0.995
      ? ''
      : `收益承载不足，直接效果按${Math.round(预算系数 * 100)}%生效`,
  };
}

function 断言直接结算收益预算_V1(技能 = {}, path = '技能', 上下文 = {}) {
  if (是血脉技能预算豁免上下文_V1(上下文, path)) {
    return { 通过: true, 跳过预算门禁: true, 预算系数: 1, 提示: '' };
  }
  const 预算 = 计算直接结算收益预算_V1(技能, 上下文);
  void path;
  return 预算;
}

function 缩放直接结算预算效果数值_V1(效果 = {}, 系数 = 1, 默认值 = '+0%') {
  const 收缩值 = 格式化直接结算预算有效数值_V1(效果.数值, 系数, 默认值);
  if (收缩值) 效果.数值 = 收缩值;
}

function 应用直接结算收益预算生成修正_V1(技能 = {}, 上下文 = {}) {
  const 执行缩放 = 系数 => {
    if (!(系数 > 0 && 系数 < 1)) return;
    遍历直接结算预算效果_V1(技能?._效果数组 || [], 效果 => {
      const 原型 = String(效果?.原型 || '').trim();
      if (原型 === '伤害结算') {
        效果.威力倍率 = Math.max(1, Math.floor(Math.max(1, Number(效果.威力倍率 || 100)) * 系数));
        return;
      }
      if (原型 === '结算修正') {
        const 结算 = String(效果?.结算 || '').trim();
        const 强度 = 读取直接结算预算百分强度_V1(效果?.数值, 0);
        if (['造成伤害', '受到伤害', '防御穿透'].includes(结算) && 强度 > 0) {
          缩放直接结算预算效果数值_V1(效果, 系数, '+0%');
        } else if (['反伤', '反击', '伤害转移', '伤害分摊', '伤害吸收', '伤害转治疗', '治疗转伤害', '持续伤害引爆'].includes(结算) && Math.abs(强度) > 0) {
          缩放直接结算预算效果数值_V1(效果, 系数, '+0%');
        } else if (['治疗', '消耗分摊'].includes(结算) && 强度 > 0) {
          缩放直接结算预算效果数值_V1(效果, 系数, '+0%');
        }
        return;
      }
      if (原型 === '资源变化' && 读取直接结算预算资源变化压力强度_V1(效果?.数值, 0) > 0) {
        缩放直接结算预算效果数值_V1(效果, 系数, '+0%');
        return;
      }
      if (原型 === '资源转移' && ['吞噬', '共享', '均分', '转移'].includes(String(效果?.资源转移方式 || '').trim())) {
        缩放直接结算预算效果数值_V1(效果, 系数, '100%');
      }
    });
  };
  const 预算 = 计算直接结算收益预算_V1(技能, 上下文);
  const 系数 = Number(预算?.预算系数 || 1);
  if (预算.有收益预算 && 系数 > 0 && 系数 < 1) {
    执行缩放(系数);
  }
  let 修正后预算 = 计算直接结算收益预算_V1(技能, 上下文);
  if (修正后预算.有收益预算 && Number(修正后预算?.预算系数 || 1) < 0.995) {
    const 二次系数 = Number(修正后预算?.预算系数 || 1);
    if (二次系数 > 0 && 二次系数 < 1) {
      执行缩放(二次系数);
      修正后预算 = 计算直接结算收益预算_V1(技能, 上下文);
    }
  }
  return 修正后预算;
}

function 格式化直接结算预算有效数值_V1(原始值, 预算系数 = 1, 默认值 = '') {
  const 使用默认值 = 原始值 === undefined || 原始值 === null || 原始值 === '';
  const 文本 = String(使用默认值 ? (默认值 ?? '') : 原始值).trim();
  const 数值 = 读取直接结算预算百分强度_V1(文本, 默认值);
  if (!Number.isFinite(数值)) return '';
  if (/%$/.test(文本) || (使用默认值 && String(默认值).includes('%'))) {
    let 输出比例 = 数值 * 预算系数;
    if (输出比例 !== 0 && Math.abs(输出比例) < 0.05) 输出比例 = 输出比例 < 0 ? -0.05 : 0.05;
    return `${formatSkillNumber(输出比例 * 100, 2)}%`;
  }
  return formatSkillNumber(数值 * 预算系数, 2);
}

function 读取直接结算预算预览文本_V1(效果 = {}, 预算 = null) {
  const 系数 = Number(预算?.预算系数 || 1);
  if (!(预算?.有收益预算) || !(系数 < 0.995)) return '';
  const 原型 = String(效果?.原型 || '').trim();
  if (原型 === '伤害结算') {
    const 原始 = Math.max(0, Number(效果?.威力倍率 || 100));
    return `威力倍率${formatSkillNumber(原始)}，折算后${formatSkillNumber(原始 * 系数, 2)}`;
  }
  if (原型 === '结算修正') {
    const 结算 = String(效果?.结算 || '').trim();
    if (['造成伤害', '受到伤害', '防御穿透', '反伤', '反击', '持续伤害引爆', '伤害转移', '伤害分摊', '伤害吸收', '伤害转治疗', '治疗转伤害', '治疗', '消耗分摊'].includes(结算)) {
      return `折算后${格式化直接结算预算有效数值_V1(效果?.数值, 系数, '+0%')}`;
    }
  }
  if (原型 === '资源变化' && 读取直接结算预算资源变化压力强度_V1(效果?.数值, 0) > 0) {
    return `折算后${格式化直接结算预算有效数值_V1(效果?.数值, 系数, '+0%')}`;
  }
  if (原型 === '资源转移' && ['吞噬', '共享', '均分', '转移'].includes(String(效果?.资源转移方式 || '').trim())) {
    const 方式 = String(效果?.资源转移方式 || '').trim();
    const 原始 = String(格式化技能结构转译字段_V1(效果?.数值, '100%')).replace(/^[+-]/, '');
    const 有效 = String(格式化直接结算预算有效数值_V1(效果?.数值, 系数, '100%')).replace(/^[+-]/, '');
    return `${方式}${原始}，折算后${有效}`;
  }
  return '';
}

function 技能原型字段值是百分比修正_V1(value) {
  return /^[-+]?\d+(?:\.\d+)?%$/.test(String(value ?? '').trim());
}

function 技能原型字段值是数值修正_V1(value) {
  return /^[-+]?\d+(?:\.\d+)?%?$/.test(String(value ?? '').trim());
}

var 结算修正支持字段矩阵_V1 = Object.freeze({
  造成伤害: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '持续回合', '限定元素', '驱动属性', '影响方向']),
  受到伤害: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '持续回合', '限定元素', '限定攻击类型', '驱动属性', '影响方向']),
  资源恢复: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '资源', '限定资源', '数值', '持续回合', '驱动属性', '影响方向']),
  治疗: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '持续回合', '驱动属性', '影响方向']),
  消耗: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '持续回合', '限定元素', '驱动属性', '影响方向']),
  前摇: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '持续回合', '限定元素', '驱动属性', '影响方向']),
  反伤: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '持续回合']),
  伤害转移: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '转移对象', '持续回合']),
  伤害吸收: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '对应等级', '吸收来源', '吸收资源', '转化效果', '增幅上限', '持续回合']),
  伤害转治疗: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '持续回合']),
  治疗转伤害: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '持续回合']),
  伤害分摊: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '数量', '持续回合']),
  消耗分摊: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '数量', '持续回合']),
  防御穿透: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '持续回合']),
  防御剥夺: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '持续回合', '驱动属性', '影响方向']),
  精神抗性剥夺: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '持续回合', '驱动属性', '影响方向']),
  技能效果: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '持续回合', '限定元素', '驱动属性', '影响方向']),
  反击: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值', '持续回合', '触发限制']),
  持续伤害引爆: Object.freeze(['目标', '原型', '生效方式', '条件分支', '结算', '数值']),
});

function 读取结算修正支持字段_V1(结算 = '') {
  return 结算修正支持字段矩阵_V1[String(结算 || '').trim()] || null;
}

function 技能条件分支包含释放后条件_V1(effect = {}) {
  const 禁用集合 = new Set(技能释放前结算禁用条件类型_V1);
  return (Array.isArray(effect?.条件分支) ? effect.条件分支 : []).some(分支 =>
    (Array.isArray(分支?.条件) ? 分支.条件 : []).some(条件 => 禁用集合.has(String(条件?.类型 || '').trim())),
  );
}

function 技能条件列表包含释放后条件_V1(条件列表 = []) {
  const 禁用集合 = new Set(技能释放前结算禁用条件类型_V1);
  return (Array.isArray(条件列表) ? 条件列表 : []).some(条件 => 禁用集合.has(String(条件?.类型 || '').trim()));
}

function 技能效果列表包含释放前降低结算_V1(效果列表 = []) {
  return (Array.isArray(效果列表) ? 效果列表 : []).some(effect => {
    if (!effect || typeof effect !== 'object' || Array.isArray(effect)) return false;
    const 原型 = String(effect.原型 || '').trim();
    const 结算 = String(effect.结算 || '').trim();
    if (原型 === '结算修正' && ['消耗', '前摇'].includes(结算) && parseSkillSignedChangeNumber(effect.数值) < 0) return true;
    return 技能执行嵌套效果数组字段表_V1.some(键 => 技能效果列表包含释放前降低结算_V1(effect[键]))
      || (Array.isArray(effect.条件分支) ? effect.条件分支 : []).some(分支 =>
        技能条件分支效果数组字段表_V1.some(键 => 技能效果列表包含释放前降低结算_V1(分支?.[键])),
      );
  });
}

function 断言释放后分支不携带释放前降低结算_V1(effect = {}, path = '_效果数组', index = 0) {
  if (!Array.isArray(effect?.条件分支)) return;
  effect.条件分支.forEach((分支, 分支序号) => {
    if (!技能条件列表包含释放后条件_V1(分支?.条件)) return;
    技能条件分支效果数组字段表_V1.forEach(字段名 => {
      if (技能效果列表包含释放前降低结算_V1(分支?.[字段名])) {
        throw new Error(`技能执行结构错误:${path}[${index}].条件分支[${分支序号}]${字段名}不能用命中/被闪避条件降低消耗或前摇`);
      }
    });
  });
}

function 读取技能限定元素列表_V1(value) {
  const 原始列表 = Array.isArray(value) ? value : String(value || '').split(/[、,，/|｜；;\s]+/g);
  const 展开表 = {
    五行类: ['金', '木', '水', '火', '土'],
    元素类: ['水', '火', '风', '土', '光', '暗'],
  };
  return Array.from(new Set(原始列表
    .map(项 => String(项 || '').trim())
    .filter(Boolean)
    .flatMap(项 => 展开表[项] || [项])));
}

function 格式化技能限定元素显示_V1(value) {
  const 原始列表 = Array.isArray(value) ? value : String(value || '').split(/[、,，/|｜；;\s]+/g);
  const 原始集合 = new Set(原始列表.map(项 => String(项 || '').trim()).filter(Boolean));
  if (原始集合.has('元素类')) return '元素类';
  if (原始集合.has('五行类')) return '五行类';
  const 元素类 = ['水', '火', '风', '土', '光', '暗'];
  const 五行类 = ['金', '木', '水', '火', '土'];
  const 列表 = 读取技能限定元素列表_V1(value)
    .filter(元素 => SKILL_PROTOTYPE_FIELD_OPTIONS_V1.限定元素.includes(元素) && !['元素类', '五行类'].includes(元素));
  const 等于集合 = 目标 => 列表.length === 目标.length && 目标.every(元素 => 列表.includes(元素));
  if (等于集合(元素类)) return '元素类';
  if (等于集合(五行类)) return '五行类';
  if (!列表.length) return '';
  if (列表.length <= 6) return 列表.join('、');
  return `${列表.slice(0, 6).join('、')}等${列表.length}项`;
}

function 读取技能限定元素字段列表_V1(value) {
  const 原始列表 = Array.isArray(value) ? value : String(value || '').split(/[、,，/|｜；;\s]+/g);
  return Array.from(new Set(原始列表
    .map(项 => String(项 || '').trim())
    .filter(项 => SKILL_PROTOTYPE_FIELD_OPTIONS_V1.限定元素.includes(项))));
}

function 读取技能默认限定元素_V1(上下文 = {}) {
  const 技能 = 上下文?.技能 || 上下文?.skill || {};
  const 元素构型 = getStoredSkillElementStructure(技能);
  const 上下文可调用元素 = buildSkillAttributeGateContext(上下文).callableElements;
  const 候选列表 = [
    ...(Array.isArray(技能?.附带属性) ? 技能.附带属性 : 读取技能限定元素列表_V1(技能?.附带属性)),
    ...上下文可调用元素,
    getStoredSkillDisplayElement(技能),
    ...(元素构型.核心元素 || []),
    ...(元素构型.驱动元素 || []),
    ...(元素构型.触发元素 || []),
  ];
  return 候选列表.map(项 => String(项 || '').trim()).find(项 => SKILL_PROTOTYPE_FIELD_OPTIONS_V1.限定元素.includes(项)) || '火';
}

function 断言结算修正字段范围_V1(effect = {}, path = '_效果数组', index = 0) {
  const 结算 = String(effect.结算 || '').trim();
  const 支持字段 = 读取结算修正支持字段_V1(结算);
  if (!支持字段) throw new Error(`技能执行结构错误:${path}[${index}]结算修正选项无效`);
  Object.keys(effect || {}).forEach(字段名 => {
    if (!支持字段.includes(字段名)) throw new Error(`技能执行结构错误:${path}[${index}]${结算}不支持字段${字段名}`);
  });
  const 允许绝对值 = ['消耗', '前摇'].includes(结算);
  if (允许绝对值 ? !技能原型字段值是数值修正_V1(effect.数值) : !技能原型字段值是百分比修正_V1(effect.数值)) {
    throw new Error(`技能执行结构错误:${path}[${index}]${结算}数值${允许绝对值 ? '只能填写百分比或绝对值' : '必须使用百分比'}`);
  }
  const 数值 = parseSkillSignedChangeNumber(effect.数值);
  if (!Number.isFinite(数值) || 数值 === 0) throw new Error(`技能执行结构错误:${path}[${index}]结算修正数值不能为0`);
  if (['消耗', '前摇'].includes(结算) && 数值 < 0 && 技能条件分支包含释放后条件_V1(effect)) {
    throw new Error(`技能执行结构错误:${path}[${index}]${结算}降低不能使用命中/被闪避条件`);
  }
  const 正向百分比结算列表 = ['反伤', '伤害转移', '伤害吸收', '伤害转治疗', '治疗转伤害', '伤害分摊', '消耗分摊', '防御穿透', '防御剥夺', '精神抗性剥夺', '反击', '持续伤害引爆'];
  if (正向百分比结算列表.includes(结算)) {
    if (数值 <= 0) {
      throw new Error(`技能执行结构错误:${path}[${index}]${结算}数值必须为正向百分比`);
    }
    if (数值 > 1) {
      throw new Error(`技能执行结构错误:${path}[${index}]${结算}数值不能超过100%`);
    }
  }
  if (结算 === '伤害转移') {
    if (!SKILL_PROTOTYPE_FIELD_OPTIONS_V1.转移对象.includes(String(effect.转移对象 || '攻击者').trim())) throw new Error(`技能执行结构错误:${path}[${index}]伤害转移对象无效`);
  } else if (effect.转移对象 !== undefined) {
    throw new Error(`技能执行结构错误:${path}[${index}]${结算}不支持字段转移对象`);
  }
  if (结算 === '伤害吸收') {
    if (!SKILL_PROTOTYPE_FIELD_OPTIONS_V1.吸收来源.includes(String(effect.吸收来源 || '造成伤害').trim())) throw new Error(`技能执行结构错误:${path}[${index}]伤害吸收来源无效`);
    if (!SKILL_PROTOTYPE_FIELD_OPTIONS_V1.吸收资源.includes(String(effect.吸收资源 || '生命').trim())) throw new Error(`技能执行结构错误:${path}[${index}]伤害吸收资源无效`);
    if (effect.对应等级 !== undefined && (!Number.isInteger(Number(effect.对应等级)) || Number(effect.对应等级) <= 0)) throw new Error(`技能执行结构错误:${path}[${index}]伤害吸收对应等级必须为正整数`);
    const 转化效果 = String(effect.转化效果 || '').trim();
    if (转化效果 && !['立即恢复', '下次造成伤害'].includes(转化效果)) throw new Error(`技能执行结构错误:${path}[${index}]伤害吸收转化效果无效`);
    if (effect.增幅上限 !== undefined && !技能原型字段值是百分比修正_V1(effect.增幅上限)) throw new Error(`技能执行结构错误:${path}[${index}]伤害吸收增幅上限必须使用百分比`);
  } else if (effect.吸收资源 !== undefined) {
    throw new Error(`技能执行结构错误:${path}[${index}]${结算}不支持字段吸收资源`);
  } else if (effect.吸收来源 !== undefined) {
    throw new Error(`技能执行结构错误:${path}[${index}]${结算}不支持字段吸收来源`);
  } else if (effect.转化效果 !== undefined) {
    throw new Error(`技能执行结构错误:${path}[${index}]${结算}不支持字段转化效果`);
  } else if (effect.增幅上限 !== undefined) {
    throw new Error(`技能执行结构错误:${path}[${index}]${结算}不支持字段增幅上限`);
  }
  if (effect.限定攻击类型 !== undefined) {
    if (结算 !== '受到伤害' || !Array.isArray(effect.限定攻击类型) || !effect.限定攻击类型.length) {
      throw new Error(`技能执行结构错误:${path}[${index}]${结算}限定攻击类型必须是非空数组且仅用于受到伤害`);
    }
    if (effect.限定攻击类型.some(item => typeof item !== 'string' || !技能限定攻击类型选项_V1.includes(item.trim()))) {
      throw new Error(`技能执行结构错误:${path}[${index}]${结算}限定攻击类型无效`);
    }
  }
  if (结算 === '资源恢复') {
    ['资源', '限定资源'].forEach(字段名 => {
      if (effect[字段名] !== undefined && (typeof effect[字段名] !== 'string' || !技能正式资源选项_V1.includes(effect[字段名].trim()))) {
        throw new Error(`技能执行结构错误:${path}[${index}]资源恢复${字段名}无效`);
      }
    });
  } else if (effect.资源 !== undefined || effect.限定资源 !== undefined) {
    throw new Error(`技能执行结构错误:${path}[${index}]${结算}不支持字段资源或限定资源`);
  }
  if (['伤害分摊', '消耗分摊'].includes(结算)) {
    if (String(effect.目标 || '').trim() !== '群体' && effect.数量 !== undefined) throw new Error(`技能执行结构错误:${path}[${index}]${结算}单体目标不支持数量`);
    if (String(effect.目标 || '').trim() === '群体' && effect.数量 !== undefined) {
      const 数量 = Number(effect.数量);
      if (!(Number.isInteger(数量) && 数量 >= 1)) throw new Error(`技能执行结构错误:${path}[${index}]${结算}数量必须为正整数`);
    }
  }
  if (effect.持续回合 !== undefined) {
    const 持续回合 = Number(effect.持续回合);
    if (!(Number.isInteger(持续回合) && 持续回合 >= 1)) {
      throw new Error(`技能执行结构错误:${path}[${index}]结算修正持续回合必须为正整数`);
    }
  }
  if (effect.限定元素 !== undefined) {
    const 限定元素列表 = 读取技能限定元素字段列表_V1(effect.限定元素);
    if (!限定元素列表.length) throw new Error(`技能执行结构错误:${path}[${index}]${结算}必须填写限定元素`);
    if (限定元素列表.some(元素 => !SKILL_PROTOTYPE_FIELD_OPTIONS_V1.限定元素.includes(元素))) throw new Error(`技能执行结构错误:${path}[${index}]${结算}限定元素无效`);
  }
  if (结算 === '反击' && path === '_效果数组') {
    throw new Error(`技能执行结构错误:${path}[${index}]反击只能放在后续触发槽位`);
  }
  if (结算 === '技能效果' && !Array.isArray(effect.条件分支) && effect.限定元素 === undefined) {
    throw new Error(`技能执行结构错误:${path}[${index}]技能效果必须绑定条件`);
  }
}

function 断言炸环字段范围_V1(effect = {}, path = '_效果数组', index = 0) {
  const 支持字段 = ['目标', '原型', '生效方式', '条件分支', '强化倍率'];
  Object.keys(effect || {}).forEach(字段名 => {
    if (!支持字段.includes(字段名)) throw new Error(`技能执行结构错误:${path}[${index}]炸环不支持字段${字段名}`);
  });
  if (String(effect.目标 || '自身').trim() !== '自身') throw new Error(`技能执行结构错误:${path}[${index}]炸环目标必须为自身`);
  if (!(parseSkillSignedChangeNumber(effect.强化倍率) > 0)) throw new Error(`技能执行结构错误:${path}[${index}]炸环强化倍率必须为正百分比`);
}

function buildPackedAttributeEffect(mechanism, target, property, action, value, duration = 0, 上下文 = {}) {
  const num = normalizeSkillPackedNumericValue(value);
  if (!Number.isFinite(num)) return null;
  const 动作 = String(action || '').trim();
  const 属性 = buildSkillEffectPropertyLabel(property);
  const 资源表 = { 生命: '生命', 体力: '体力', 魂力: '魂力', 精神力: '精神力', vit: '体力', hp: '生命', sp: '魂力', men: '精神力' };
  const 资源 = 资源表[属性] || 资源表[String(property || '').trim()] || '';
  const 机制 = String(mechanism || '').trim();
  const 原型 = 资源 && (动作 === '加值' || 动作 === '减值' || 动作 === '持续恢复')
    ? '资源变化'
    : 机制 === '掌控修正' || 属性 === '掌控'
      ? '判定修正'
      : ['消耗', '前摇'].includes(属性)
        ? '结算修正'
        : '属性修正';
  const effect = {
    原型,
    目标: 归一化执行效果作用目标_V1(target || '自身', '自身'),
    数值: 规范化执行效果数值_V1(num, 动作),
  };
  if (原型 === '资源变化') effect.资源 = 资源;
  else if (原型 === '判定修正') effect.判定 = 动作 === '倍率压制' ? '反应' : '命中';
  else if (原型 === '结算修正') {
    if (属性 === '消耗') effect.结算 = '消耗';
    else if (属性 === '前摇') effect.结算 = '前摇';
    else effect.结算 = 属性;
    if (['消耗', '前摇'].includes(effect.结算) && ['倍率提升', '倍率压制', ''].includes(动作)) {
      effect.数值 = formatSkillSignedChangeValue(num, true);
    }
  }
  else effect.属性 = 属性;
  const 持续回合 = Math.max(0, Number(duration || 0));
  if (持续回合 > 0) effect.持续回合 = 持续回合;
  return effect;
}

function buildPackedAttributeEffectsFromRatios(target, statMods = {}, duration = 0) {
  const effects = [];
  Object.entries(statMods || {}).forEach(([property, ratio]) => {
    const num = Number(ratio || 0);
    if (!Number.isFinite(num) || Math.abs(num - 1) <= 0.001) return;
    effects.push(
      buildPackedAttributeEffect(
        '属性变化',
        target,
        property,
        num >= 1 ? '倍率提升' : '倍率压制',
        num,
        duration,
      ),
    );
  });
  return effects.filter(Boolean);
}

function buildPackedRecoverAttributeEffect(target, property, ratio, duration = 0, overtime = false) {
  const num = Number(ratio || 0);
  if (!Number.isFinite(num) || num <= 0) return null;
  if (!overtime) {
    return buildPackedAttributeEffect('属性变化', target, property, '加值', num, 0);
  }
  return {
    原型: '状态施加',
    目标: 归一化执行效果作用目标_V1(target || '自身', '自身'),
    状态: '持续恢复',
    数值: formatSkillSignedChangeValue(Math.abs(num), true),
    持续回合: Math.max(1, Math.round(Number(duration || 1))),
    生效方式: '独立生效',
  };
}

function 格式化技能结构转译字段_V1(值, 兜底 = '') {
  if (值 === undefined || 值 === null) return 兜底;
  if (Array.isArray(值)) return 值.map(条目 => 格式化技能结构转译字段_V1(条目, 兜底)).filter(Boolean).join('/');
  if (typeof 值 === 'object') return Object.entries(值)
    .map(([键, 原始值]) => `${键}:${格式化技能结构转译字段_V1(原始值, '')}`)
    .filter(Boolean)
    .join('，') || 兜底;
  const 文本 = String(值).trim();
  return 文本 || 兜底;
}

function 格式化技能结构数值_V1(值, 兜底 = '') {
  const 文本 = String(值 ?? '').trim();
  if (!文本) return 兜底;
  if (/%$/.test(文本)) return 文本;
  const 数值 = Number(文本);
  if (!Number.isFinite(数值)) return 文本;
  if (Math.abs(数值) > 0 && Math.abs(数值) < 1) {
    return `${数值 > 0 ? '+' : ''}${formatSkillPercent(数值)}`;
  }
  return `${数值 > 0 ? '+' : ''}${formatSkillNumber(数值, Math.abs(数值 % 1) < 0.0001 ? 0 : 2)}`;
}

function 读取技能结构增减数值_V1(值, 兜底 = '') {
  const 文本 = 格式化技能结构转译字段_V1(值, 兜底);
  return {
    文本,
    正数值: String(文本 || '').replace(/^[+-]/, ''),
    是负向: /^-/.test(String(文本 || '')),
  };
}

function 转译技能结构增减语义_V1(值, 正向词 = '提高', 负向词 = '降低', 兜底 = '') {
  const 结果 = 读取技能结构增减数值_V1(值, 兜底);
  if (!结果.正数值) return '';
  return `${结果.是负向 ? 负向词 : 正向词}${结果.正数值}`;
}

function 转译技能消耗字段_V1(消耗 = null) {
  if (!消耗 || typeof 消耗 !== 'object' || Array.isArray(消耗)) return 格式化技能结构转译字段_V1(消耗, '');
  return Object.entries(消耗)
    .map(([资源, 数值]) => `${资源}${格式化技能结构数值_V1(数值, '0')}`)
    .filter(Boolean)
    .join('，');
}

function 拼接技能结构转译片段_V1(列表 = [], 分隔符 = '，') {
  return (Array.isArray(列表) ? 列表 : [])
    .map(条目 => String(条目 || '').trim())
    .filter(Boolean)
    .join(分隔符);
}

function 转译技能掌控度_V1(技能掌控度 = {}) {
  const 圆满等级 = Number(技能掌控度 && 技能掌控度.圆满等级);
  if (!Number.isFinite(圆满等级) || 圆满等级 <= 0) return '低等级时无法完全发挥此技能威力。';
  const 掌控门槛 =
    圆满等级 >= 150
      ? '神王'
      : 圆满等级 >= 120
        ? '一级神'
        : 圆满等级 >= 110
          ? '二级神祗'
          : 圆满等级 >= 100
            ? '神级'
            : `${formatSkillNumber(圆满等级)}级`;
  return `低等级时无法完全发挥此技能威力。要${掌控门槛}才能完美掌控。`;
}

function 转译技能tick时长_V1(tick值 = 0) {
  const 总分钟 = Math.max(0, Math.round(Number(tick值 || 0) * 10));
  if (!Number.isFinite(总分钟) || 总分钟 <= 0) return '';
  const 分钟每年 = 360 * 24 * 60;
  const 分钟每月 = 30 * 24 * 60;
  const 分钟每天 = 24 * 60;
  const 分钟每小时 = 60;
  let 剩余分钟 = 总分钟;
  const 年 = Math.floor(剩余分钟 / 分钟每年);
  剩余分钟 -= 年 * 分钟每年;
  const 月 = Math.floor(剩余分钟 / 分钟每月);
  剩余分钟 -= 月 * 分钟每月;
  const 日 = Math.floor(剩余分钟 / 分钟每天);
  剩余分钟 -= 日 * 分钟每天;
  const 小时 = Math.floor(剩余分钟 / 分钟每小时);
  剩余分钟 -= 小时 * 分钟每小时;
  const 片段 = [];
  if (年 > 0) 片段.push(`${formatSkillNumber(年)}年`);
  if (月 > 0) 片段.push(`${formatSkillNumber(月)}月`);
  if (日 > 0) 片段.push(`${formatSkillNumber(日)}日`);
  if (!片段.length && 小时 > 0) 片段.push(`${formatSkillNumber(小时)}小时`);
  if (!片段.length && 剩余分钟 > 0) 片段.push(`${formatSkillNumber(剩余分钟)}分钟`);
  return 片段.join('');
}

function 转译技能结构目标_V1(值 = '') {
  const 文本 = String(值 || '目标').trim();
  if (文本 === '单体') return '任意对象';
  if (文本 === '群体') return '群体';
  return buildSkillTargetLabel(文本 || '目标');
}

function 转译技能结构条件条目_V1(条件 = {}) {
  const 类型 = String(条件?.类型 || '').trim();
  if (!类型) return '';
  const 对象 = String(条件?.对象 || '目标').trim() || '目标';
  const 比较 = String(条件?.比较 || '==').trim() || '==';
  const 值 = 格式化技能结构转译字段_V1(条件?.值 ?? 条件?.状态, '');
  const 对象文本 = 对象 === '目标' ? '目标' : 对象;
  const 比较文本 = {
    '==': '为',
    '!=': '不为',
    '>=': '不低于',
    '<=': '不高于',
    '>': '高于',
    '<': '低于',
    包含: '包含',
    不包含: '不包含',
  }[比较] || 比较;
  if (类型 === '目标') {
    return `${对象文本}${比较文本}${值 || '指定目标'}`;
  }
  if (类型 === '状态存在') {
    const 状态 = 格式化技能结构转译字段_V1(条件?.状态 || 条件?.值, '指定状态');
    return `${对象文本}${比较 === '无' ? '不存在' : '存在'}【${状态}】`;
  }
  if (类型 === '护盾') return `${对象文本}${比较 === '无' ? '没有护盾' : '存在护盾'}`;
  if (类型 === '环境满足') return `战斗环境满足【${值 || '指定环境'}】`;
  if (类型 === '时间') return `当前时间${比较 === '!=' ? '不是' : '处于'}【${值 || '指定时段'}】`;
  if (类型 === '装备状态') return `${对象文本}${比较 === '!=' ? '未满足' : '满足'}【${值 || '指定装备状态'}】`;
  if (类型 === '自身状态') return `${对象文本}${比较 === '!=' ? '不是' : '处于'}【${值 || '指定状态'}】`;
  if (类型 === '连携前提') return `${比较 === '!=' ? '不满足' : '满足'}【${值 || '指定连携前提'}】`;
  if (类型 === '单位文本') return `${对象文本}文本${比较文本}${值 || '指定文本'}`;
  if (类型 === '使用者') {
    const 对象 = 格式化技能结构转译字段_V1(条件?.对象, '使用者');
    const 右值 = 格式化技能结构转译字段_V1(条件?.值, '制作者');
    if (对象 === '使用者' && 右值 === '制作者') return 比较 === '!=' ? '食用者不是制作者' : '制作者自用';
    return `${对象}${比较 === '!=' ? '不是' : '是'}${右值}`;
  }
  if (['邪魂师', '深渊生物', '魂兽', '命中', '被闪避'].includes(类型)) {
    return `${对象文本}${比较 === '无' ? '不满足' : '满足'}${类型}`;
  }
  if (/^(生命|体力|魂力|精神力)(比例|数值)$/.test(类型)) return `${对象文本}${类型}${比较文本}${值 || '0'}`;
  return 值 ? `${对象文本}${类型}${比较文本}${值}` : '';
}

function 读取技能结构生效条件文本_V1(效果 = {}) {
  return (Array.isArray(效果?.条件分支) ? 效果.条件分支 : [])
    .filter(分支 => String(分支?.处理 || '').trim() === '生效')
    .map(分支 => (Array.isArray(分支?.条件) ? 分支.条件 : [])
      .map(转译技能结构条件条目_V1)
      .filter(Boolean)
      .filter((文本, 序号, 列表) => 列表.indexOf(文本) === 序号)
      .join('且'))
    .filter(Boolean)
    .filter((文本, 序号, 列表) => 列表.indexOf(文本) === 序号)
    .map(压缩条件文本_V1)
    .filter(Boolean)
    .join('且');
}

function 压缩条件文本_V1(文本 = '') {
  const 片段 = String(文本 || '')
    .split('且')
    .map(项 => String(项 || '').trim())
    .filter(Boolean);
  return Array.from(new Set(片段)).join('且');
}

function 转译技能结构条件分支_V1(分支 = {}, 深度 = 0) {
  const 条件文本 = (Array.isArray(分支?.条件) ? 分支.条件 : [])
    .map(转译技能结构条件条目_V1)
    .filter(Boolean)
    .filter((文本, 序号, 列表) => 列表.indexOf(文本) === 序号)
    .join('且');
  const 压缩后条件文本 = 压缩条件文本_V1(条件文本);
  if (!压缩后条件文本) return '';
  const 处理 = String(分支?.处理 || '').trim();
  if (处理 === '生效') return `仅当${压缩后条件文本}时生效`;
  if (处理 === '禁用') return `若${压缩后条件文本}，不生效`;
  const 字段名 = 处理 === '追加效果' ? '追加效果' : '替换效果';
  if (处理 === '替换效果' && 条件分支替换效果等价_V1(分支?.__父效果 || {}, 分支?.[字段名] || [])) return '';
  const 效果文本 = 编译效果数组为人类语言_V1(分支?.[字段名] || [], { depth: 深度 + 1, maxDepth: 4, 不加跟随前缀: 处理 === '替换效果' });
  if (处理 === '追加效果') return `满足${压缩后条件文本}时，额外产生：${效果文本 || '指定效果'}`;
  if (压缩后条件文本 === '制作者自用') return `若制作者自用，改为自用效果：${效果文本 || '指定效果'}`;
  return `满足${压缩后条件文本}时，改为：${效果文本 || '指定效果'}`;
}

function 转译技能触发限制_V1(触发限制 = null) {
  if (!触发限制 || typeof 触发限制 !== 'object' || Array.isArray(触发限制)) return '';
  const 周期 = String(触发限制.周期 || '').trim();
  const 次数 = Math.max(0, Number(触发限制.次数 || 0));
  if (!周期 && !(次数 > 0)) return '';
  if (次数 > 0) return `${周期 || '限定周期'}${formatSkillNumber(次数)}次`;
  return 周期 || '';
}

function 转译技能比例描述_V1(值, 兜底 = '') {
  const 数值 = Number(值);
  if (!Number.isFinite(数值)) return 格式化技能结构转译字段_V1(值, 兜底);
  if (Math.abs(数值) <= 1) return formatSkillPercent(数值);
  return 格式化技能结构转译字段_V1(数值, 兜底);
}

function 转译状态施加数值说明_V1(状态 = '', 效果 = {}) {
  const 状态名 = String(状态 || '').trim();
  const 数值 = 格式化技能结构数值_V1(效果?.数值, '');
  const 副数值 = 格式化技能结构数值_V1(效果?.副数值, '');
  const 去正号 = 文本 => String(文本 || '').replace(/^\+/, '');
  const 表 = {
    中毒: () => `每回合生命${数值 || '-3%'}，命中率${副数值 || '-5%'}`,
    流血: () => `每回合生命${数值 || '-3%'}，受到伤害${副数值 || '+5%'}`,
    灼烧: () => `每回合生命${数值 || '-3%'}，火元素承伤${副数值 || '+20%'}`,
    冻伤: () => `每回合生命${数值 || '-2%'}，冰元素承伤${副数值 || '+20%'}`,
    持续创伤: () => `每回合生命${数值 || '-3%'}，反应${副数值 || '-5%'}`,
    持续恢复: () => `每回合生命${数值 || '+5%'}`,
    迟缓: () => `敏捷${数值 || '-10%'}，反应${副数值 || '-8%'}`,
    资源燃烧: () => `每回合燃烧魂力${去正号(数值 || '+3%')}，技能消耗${副数值 || '+5%'}`,
    禁疗: () => `治疗降低${去正号(数值 || '+40%')}`,
    治疗反转: () => `治疗按${去正号(数值 || '+100%')}转化为伤害`,
    护盾: () => `获得生命上限${去正号(数值 || '+10%')}的护盾`,
    标记: () => `闪避率${数值 || '-100%'}`,
    防御剥夺: () => `防御参与伤害结算时，防御按${去正号(数值 || '+20%')}剥夺`,
    精神抗性剥夺: () => `防守精神参与精神伤害结算时，精神抗性按${去正号(数值 || '+20%')}剥夺`,
    护卫: () => `护卫者承伤降低${去正号(数值 || '+10%')}`,
    嘲讽: () => `强制吸引目标攻击施术者`,
    虚弱: () => `力量、防御、敏捷各${数值 || '-8%'}`,
    失控: () => `${去正号(数值 || '+35%')}概率偏转目标，命中率${副数值 || '-10%'}`,
    反噬: () => `主动施技后受到自身生命上限${去正号(数值 || '+3%')}伤害`,
    精神紊乱: () => `${去正号(数值 || '+25%')}概率偏转目标，反应${副数值 || '-8%'}`,
    魂力枯竭: () => `每回合流失魂力${去正号(数值 || '+3%')}，技能消耗${副数值 || '+5%'}`,
    僵直: () => `反应${数值 || '-50%'}，闪避率${副数值 || '-20%'}`,
    麻痹: () => `反应${数值 || '-50%'}，闪避率${副数值 || '-20%'}`,
    混乱: () => `${去正号(数值 || '+40%')}概率偏转目标，命中率${副数值 || '-10%'}`,
    共享视野: () => `命中率${数值 || '+10%'}，反应${副数值 || '+10%'}`,
  };
  return typeof 表[状态名] === 'function' ? 表[状态名]() : '';
}

var 技能状态施加转译语义_V1 = Object.freeze({
  标记: (目标, 效果) => `标记${目标}，${转译状态施加数值说明_V1('标记', 效果)}`,
  防御剥夺: (目标, 效果) => `剥夺${目标}防御，${转译状态施加数值说明_V1('防御剥夺', 效果)}`,
  精神抗性剥夺: (目标, 效果) => `削弱${目标}防守精神抗性，${转译状态施加数值说明_V1('精神抗性剥夺', 效果)}`,
  中毒: (目标, 效果) => `使${目标}中毒，${转译状态施加数值说明_V1('中毒', 效果)}`,
  流血: (目标, 效果) => `使${目标}流血，${转译状态施加数值说明_V1('流血', 效果)}`,
  灼烧: (目标, 效果) => `使${目标}灼烧，${转译状态施加数值说明_V1('灼烧', 效果)}`,
  冻伤: (目标, 效果) => `使${目标}冻伤，${转译状态施加数值说明_V1('冻伤', 效果)}`,
  持续创伤: (目标, 效果) => `使${目标}承受持续创伤，${转译状态施加数值说明_V1('持续创伤', 效果)}`,
  持续恢复: (目标, 效果) => `使${目标}持续恢复，${转译状态施加数值说明_V1('持续恢复', 效果)}`,
  迟缓: (目标, 效果) => `使${目标}迟缓，${转译状态施加数值说明_V1('迟缓', 效果)}`,
  资源燃烧: (目标, 效果) => `使${目标}资源燃烧，${转译状态施加数值说明_V1('资源燃烧', 效果)}`,
  眩晕: 目标 => `使${目标}进入眩晕状态`,
  沉默: 目标 => `使${目标}进入沉默状态`,
  致盲: 目标 => `使${目标}进入致盲状态`,
  禁疗: (目标, 效果) => `使${目标}禁疗，${转译状态施加数值说明_V1('禁疗', 效果)}`,
  治疗反转: (目标, 效果) => `使${目标}治疗反转，${转译状态施加数值说明_V1('治疗反转', 效果)}`,
  隐匿: 目标 => `使${目标}进入隐匿状态`,
  探查屏蔽: 目标 => `屏蔽${目标}被精神力感知、目标锁定与精神标记捕捉`,
  共享视野: (目标, 效果) => `使${目标}共享视野，${转译状态施加数值说明_V1('共享视野', 效果)}`,
  护盾: (目标, 效果) => `使${目标}获得护盾，${转译状态施加数值说明_V1('护盾', 效果)}`,
  无视异常: 目标 => `使${目标}进入无视异常状态，免疫负面状态与削减类效果`,
  霸体: 目标 => `使${目标}进入霸体状态`,
  封技: 目标 => `使${目标}进入封技状态`,
  护卫: (目标, 效果) => `护卫${目标}，替其拦截攻击，${转译状态施加数值说明_V1('护卫', 效果)}`,
  嘲讽: (目标, 效果) => `使${目标}嘲讽，${转译状态施加数值说明_V1('嘲讽', 效果)}`,
  虚弱: (目标, 效果) => `使${目标}虚弱，${转译状态施加数值说明_V1('虚弱', 效果)}`,
  失控: (目标, 效果) => `使${目标}失控，${转译状态施加数值说明_V1('失控', 效果)}`,
  反噬: (目标, 效果) => `使${目标}反噬，${转译状态施加数值说明_V1('反噬', 效果)}`,
  精神紊乱: (目标, 效果) => `使${目标}精神紊乱，${转译状态施加数值说明_V1('精神紊乱', 效果)}`,
  魂力枯竭: (目标, 效果) => `使${目标}魂力枯竭，${转译状态施加数值说明_V1('魂力枯竭', 效果)}`,
  僵直: (目标, 效果) => `使${目标}僵直，${转译状态施加数值说明_V1('僵直', 效果)}`,
  麻痹: (目标, 效果) => `使${目标}麻痹，${转译状态施加数值说明_V1('麻痹', 效果)}`,
  混乱: (目标, 效果) => `使${目标}混乱，${转译状态施加数值说明_V1('混乱', 效果)}`,
});

function 转译技能状态施加描述_V1(效果 = {}, 目标 = '目标') {
  const 状态 = 格式化技能结构转译字段_V1(效果?.状态 || 效果?.状态, '状态');
  const 转译 = 技能状态施加转译语义_V1[状态];
  const 触发方式 = String(效果?.触发方式 || '立即触发').trim();
  const 触发前缀 = 触发方式 === '延迟触发' && Number(效果?.延迟回合 || 0) > 0
    ? `延迟${formatSkillNumber(效果.延迟回合)}回合后，`
    : 触发方式 === '遥控触发'
      ? '遥控触发时，'
      : '';
  if (typeof 转译 === 'function') return `${触发前缀}${转译(目标, 效果)}`;
  return `${触发前缀}使${目标}进入【${状态}】状态`;
}

function 转译状态移除对象_V1(效果 = {}) {
  const 状态 = 格式化技能结构转译字段_V1(效果?.状态, '');
  const 匹配原型 = 格式化技能结构转译字段_V1(效果?.匹配原型, '');
  const 资源 = 格式化技能结构转译字段_V1(效果?.资源, '');
  const 数值方向 = 格式化技能结构转译字段_V1(效果?.数值方向 || '任意', '任意');
  const 状态文本 =
    状态 === '任意负面'
      ? '负面状态'
      : 状态 === '任意增益'
        ? '增益状态'
        : 状态 === '任意状态'
          ? '匹配状态'
          : 状态
            ? `【${状态}】状态`
            : '';
  let 筛选文本 = '';
  if (匹配原型 === '资源变化') {
    const 资源文本 = 资源 || '资源';
    if (数值方向 === '负向') 筛选文本 = `持续扣${资源文本}类状态`;
    else if (数值方向 === '正向') 筛选文本 = `持续恢复${资源文本}类状态`;
    else 筛选文本 = `带${资源文本}变化的状态`;
  } else if (匹配原型 === '护盾变化') 筛选文本 = '护盾状态';
  if (状态文本 && 筛选文本 && !['匹配状态', 筛选文本].includes(状态文本)) return `${状态文本}中${筛选文本}`;
  return 筛选文本 || 状态文本 || '匹配状态';
}

function 转译状态转移状态名_V1(状态 = '') {
  const 文本 = 格式化技能结构转译字段_V1(状态, '匹配状态');
  if (文本 === '任意负面') return '负面状态';
  if (文本 === '任意增益') return '增益状态';
  if (文本 === '任意状态' || 文本 === '匹配状态') return '匹配状态';
  return `【${文本}】状态`;
}

function 转译状态转移描述_V1(效果 = {}, 附加 = '') {
  const 状态文本 = 转译状态转移状态名_V1(效果?.状态);
  const 数量文本 = 效果?.数量 ? `，数量${formatSkillNumber(效果.数量)}` : '';
  const 来源 = 格式化技能结构转译字段_V1(效果?.来源, '自身');
  const 去向 = 格式化技能结构转译字段_V1(效果?.去向, '目标');
  if (来源 === '目标' && 去向 === '自身') return `若目标存在${状态文本}，则夺取目标的${状态文本}并转移到自身${数量文本}${附加}`;
  if (来源 === '自身' && 去向 === '目标') return `若自身存在${状态文本}，则将自身的${状态文本}转移给目标${数量文本}${附加}`;
  if (来源 === '目标') return `若目标存在${状态文本}，则将目标的${状态文本}转移给${去向}${数量文本}${附加}`;
  if (去向 === '目标') return `若${来源}存在${状态文本}，则将${来源}的${状态文本}转移给目标${数量文本}${附加}`;
  return `若${来源}存在${状态文本}，则将${来源}的${状态文本}转移给${去向}${数量文本}${附加}`;
}

function 转译状态移除附加语义_V1(效果 = {}, 深度 = 0) {
  const 片段 = [];
  const 通用 = 转译技能结构附加语义_V1({ ...效果, 驱动属性: undefined, 影响方向: undefined }, 深度);
  const 通用文本 = 通用 ? 通用.replace(/^（|）$/g, '') : '';
  const 驱动属性 = 格式化技能结构转译字段_V1(效果?.驱动属性, '');
  if (驱动属性) 片段.push(`以${驱动属性}驱动成功率`);
  if (通用文本) 片段.push(通用文本);
  return 片段.length ? `（${片段.join('；')}）` : '';
}

function 转译技能结构附加语义_V1(效果 = {}, 深度 = 0) {
  const 片段 = [];
  const 触发条件 = String(效果?.触发条件 || '').trim();
  const 触发限制 = 转译技能触发限制_V1(效果?.触发限制);
  const 隐藏生效条件 = String(效果?.__隐藏生效条件 || '').trim();
  const 消耗 = 格式化技能结构转译字段_V1(效果?.消耗, '');
  const 持续回合 = Math.max(0, Number(效果?.持续回合 || 0));
  const 持续tick = Math.max(0, Number(效果?.持续tick || 0));
  const 驱动属性 = 格式化技能结构转译字段_V1(效果?.驱动属性, '');
  const 影响方向 = 格式化技能结构转译字段_V1(效果?.影响方向, '');
  const 触发概率值 = 解析技能触发概率_V1(效果?.触发概率 ?? 效果?.概率);
  const 概率 = 触发概率值 === null ? '' : `${formatSkillNumber(触发概率值 * 100)}%`;
  const 原型 = String(效果?.原型 || '').trim();
  const 关联资源 = 原型 === '状态施加' ? 格式化技能结构转译字段_V1(效果?.资源, '') : '';
  const 限定探查者 = 原型 === '状态施加' ? 格式化技能结构转译字段_V1(效果?.限定探查者, '') : '';
  const 触发消耗 = 原型 === '伤害结算' ? 格式化技能结构转译字段_V1(效果?.触发消耗, '') : '';
  const 副作用文本 = 转译技能副作用列表_V1(效果?.副作用列表 || []);
  const 覆盖规则 = 格式化技能结构转译字段_V1(效果?.覆盖规则, '');
  if (触发条件 && !['主动触发', '随下次行动触发', '下次魂技成功释放'].includes(触发条件)) 片段.push(`触发:${触发条件}`);
  if (触发限制) 片段.push(触发限制);
  if (覆盖规则) 片段.push(`覆盖:${覆盖规则}`);
  if (消耗) 片段.push(`消耗:${消耗}`);
  if (持续回合 > 0) 片段.push(`持续${formatSkillNumber(持续回合)}回合`);
  if (持续tick > 0) 片段.push(`持续${formatSkillNumber(持续tick)}tick`);
  if (概率) 片段.push(`概率:${概率}`);
  if (关联资源) 片段.push(`关联资源:${关联资源}`);
  if (限定探查者) 片段.push(`限定探查者:${限定探查者}`);
  if (触发消耗) 片段.push(`触发消耗:${触发消耗}`);
  if (副作用文本) 片段.push(`副作用:${副作用文本}`);
  const 条件文本 = (Array.isArray(效果?.条件分支) ? 效果.条件分支 : [])
    .map(分支 => 转译技能结构条件分支_V1({ ...分支, __父效果: 效果 }, 深度))
    .filter(Boolean)
    .filter(文本 => !(隐藏生效条件 && 文本 === `仅当${隐藏生效条件}时生效`))
    .filter((文本, 序号, 列表) => 列表.indexOf(文本) === 序号)
    .join('；');
  if (条件文本) 片段.push(条件文本);
  return 片段.length ? `（${片段.join('；')}）` : '';
}

function 转译机制抹消描述_V1(效果 = {}, 目标 = '目标') {
  const 对象文本 = 读取技能机制抹消对象摘要_V1(效果?.抹消对象 || { 原型: '机制授予' });
  const 持续文本 = Number(效果?.持续回合 || 0) > 0 ? `，持续${formatSkillNumber(效果.持续回合)}回合` : '';
  return `全链路抹消并封锁${目标}的【${对象文本}】机制${持续文本}`;
}

function 转译机制授予描述_V1(效果 = {}, 选项 = {}) {
  const 触发条件 = String(效果?.触发条件 || '主动触发').trim();
  const 授予效果文本 = 编译效果数组为人类语言_V1(效果?.授予效果 || [], {
    depth: Math.max(0, Number(选项.depth || 0)) + 1,
    maxDepth: Math.max(1, Number(选项.maxDepth || 5)),
    预算: 选项.预算,
  }) || '后续效果';
  if (触发条件 === '随下次行动触发') return `下次行动时附带：${授予效果文本}`;
  if (触发条件 === '下次魂技成功释放') return `下一次魂技成功释放时附带：${授予效果文本}；成功后消费${formatSkillNumber(效果?.可用次数 || 1)}次，无回合期限`;
  const 回合 = Math.max(1, Number(效果?.持续回合 || 1));
  const 次数 = Math.max(1, Number(效果?.可用次数 || 1));
  return `使用/食用者可在${formatSkillNumber(回合)}回合内获得一个新技能，仅限使用${formatSkillNumber(次数)}次；技能效果为：${授予效果文本}；`;
}

function 转译单条执行效果_V1(效果 = {}, 选项 = {}) {
  if (!效果 || typeof 效果 !== 'object' || Array.isArray(效果)) return '';
  const 深度 = Math.max(0, Number(选项.depth || 0));
  const 最大深度 = Math.max(1, Number(选项.maxDepth || 5));
  const 隐藏生效条件 = String(选项.隐藏生效条件 || '').trim();
  if (深度 > 最大深度) return '嵌套效果略';
  if (!String(效果?.原型 || '').trim() && Array.isArray(效果?.使用效果)) {
    const 数量 = Math.max(1, Number(效果.数量 || 1));
    const 有效期文本 = 转译技能tick时长_V1(效果.有效期tick);
    const 有效期 = 有效期文本 ? `，有效期${有效期文本}` : '';
    const 使用效果 = 编译效果数组为人类语言_V1(效果.使用效果 || [], { depth: 深度 + 1, maxDepth: 最大深度 });
    const 使用副作用 = 转译技能副作用列表_V1(效果.副作用列表 || []);
    return `生成物品×${formatSkillNumber(数量)}${有效期}${使用效果 ? `；物品使用/食用后：${使用效果}` : ''}${使用副作用 ? `；使用副作用：${使用副作用}` : ''}`;
  }
  const 原型 = String(效果?.原型 || '').trim();
  const 目标 = 转译技能结构目标_V1(效果?.目标 || '目标');
  const 附加 = 转译技能结构附加语义_V1(隐藏生效条件 ? { ...效果, __隐藏生效条件: 隐藏生效条件 } : 效果, 深度);
  const 数值 = 格式化技能结构转译字段_V1(效果?.数值, '');
  const 预算预览 = 读取直接结算预算预览文本_V1(效果, 选项.预算);
  const 预算附加 = 预算预览 ? `，${预算预览}` : '';
  const 嵌套 = (键, 标签) => {
    const 文本 = 编译效果数组为人类语言_V1(效果?.[键] || [], { depth: 深度 + 1, maxDepth: 最大深度, 预算: 选项.预算 });
    return 文本 ? `；${标签}：${文本}` : '';
  };
  switch (原型) {
    case '伤害结算': {
      const 对应等级文本 = Number(效果.对应等级 || 0) > 0 ? `，对应等级${formatSkillNumber(效果.对应等级)}` : '';
      return `${Number(效果.延迟回合 || 0) > 0 ? `延迟${formatSkillNumber(效果.延迟回合)}回合后，` : ''}对${目标}造成${格式化技能结构转译字段_V1(效果.伤害类型, '伤害')}，威力倍率${格式化技能结构转译字段_V1(效果.威力倍率, '0')}${Number(效果.攻击段数 || 0) > 1 ? `，${formatSkillNumber(效果.攻击段数)}段顺序结算` : ''}${效果.防御穿透 ? `，防御穿透${格式化技能结构转译字段_V1(效果.防御穿透)}` : ''}${对应等级文本}${预算附加}${附加}`;
    }
    case '资源变化': {
      const 资源 = 格式化技能结构转译字段_V1(效果.资源, '资源');
      if (/^-/.test(String(效果.数值 || ''))) return `${资源 === '生命' ? `生命负数需改用伤害结算` : `泯灭${目标}${数值.replace(/^-/, '')}${资源}`}${预算附加}${附加}`;
      if (资源 === '体力') return `为${目标}恢复体力/气血${数值 ? `${String(数值).replace(/^\+/, '')}` : ''}，溢出转为体力增幅${预算附加}${附加}`;
      return `为${目标}恢复${资源}${数值 ? `${String(数值).replace(/^\+/, '')}` : ''}${预算附加}${附加}`;
    }
    case '资源转移': {
      const 资源 = 格式化技能结构转译字段_V1(效果.资源, '资源');
      const 方式 = String(效果.资源转移方式 || '').trim();
      const 正数值 = String(数值 || '').replace(/^[+-]/, '');
      const 转化比例文本 = 效果.转化比例 !== undefined ? 格式化技能结构转译字段_V1(效果.转化比例) : '';
      const 是否等额转化 = !转化比例文本 || ['1', '100%', '1.0'].includes(转化比例文本);
      if (方式 === '吞噬') return `吞噬${目标}${正数值}${资源}${是否等额转化 ? `，并转化为自身${资源}` : `，并按${转化比例文本}转化为自身${资源}`}${预算附加}${附加}`;
      if (方式 === '共享') return `向${目标}共享${正数值}${资源}${是否等额转化 ? '' : `，自身消耗按${转化比例文本}换算`}${预算附加}${附加}`;
      if (方式 === '均分') return `使${目标}${资源}按${数值 || '100%'}向平均值均分${预算附加}${附加}`;
      if (方式 === '转移') return `将自身${正数值}${资源}转移给${目标}${是否等额转化 ? '' : `，目标获得按${转化比例文本}换算`}${预算附加}${附加}`;
      return `转移${目标}${数值 || ''}${资源}${附加}`;
    }
    case '护盾变化':
      if (String(效果.护盾模式 || '').trim() === '窃盾') return `窃取${目标}护盾${String(数值 || '').replace(/^[+-]/, '')}${附加}`;
      if (String(效果.护盾模式 || '').trim() === '斩盾' || /^-/.test(String(效果.数值 || ''))) return `削减${目标}护盾${String(数值 || '').replace(/^[+-]/, '')}${附加}`;
      return `为${目标}生成护盾${String(数值 || '').replace(/^\+/, '')}${附加}`;
    case '属性修正': {
      const 属性文本 = 格式化技能结构转译字段_V1(效果.属性, '属性');
      const 变化 = 读取技能结构增减数值_V1(效果.数值, '');
      const 文本 = 变化.正数值 ? `${变化.是负向 ? '降低' : '提高'}${目标}${属性文本}${变化.正数值}` : `调整${目标}${属性文本}`;
      return `${文本}${附加}`;
    }
    case '判定修正': {
      const 判定文本 = 格式化技能结构转译字段_V1(效果.判定, '判定');
      const 变化 = 读取技能结构增减数值_V1(效果.数值, '');
      const 文本 = 变化.正数值 ? `${变化.是负向 ? '降低' : '提高'}${目标}${判定文本}${变化.正数值}` : `调整${目标}${判定文本}`;
      return `${文本}${效果.打断效果 === true ? '，成立时打断当前动作' : ''}${附加}`;
    }
    case '等级提升':
      return `战斗外主动：将${目标}提升至当前合法等级序列的下一等级，最高${formatSkillNumber(效果.等级上限 || 120)}级；成功后冷却${formatSkillNumber(效果.冷却年数 || 0)}年${附加}`;
    case '群体撤离':
      return `战斗外群体撤离至${格式化技能结构转译字段_V1(效果.目的地, '目的地')}：基础成功率${格式化技能结构转译字段_V1(效果.基础成功率, '1')}，每增加一人乘${格式化技能结构转译字段_V1(效果.每增加一人成功率倍率, '0.9')}；${效果.结算方式 || '全员同成败'}，失败仍消耗资源，密钥不消耗${效果.消耗 ? `，消耗${效果.消耗}` : ''}${附加}`;
    case '魂骨年限提升':
      return `战斗外一次性效果：将${目标}已融合魂骨的现有年限提高${数值 || '+10%'}，上限${formatSkillNumber(效果.年限上限 || 10000)}年${附加}`;
    case '结算修正': {
      const 限定元素 = 格式化技能结构转译字段_V1(效果.限定元素, '');
      const 限定攻击类型 = 格式化技能结构转译字段_V1(效果.限定攻击类型, '');
      const 限定资源 = 格式化技能结构转译字段_V1(效果.限定资源, '');
      const 限定文本 = [
        限定元素 ? `限定${限定元素}元素` : '',
        限定攻击类型 ? `限定${限定攻击类型}攻击` : '',
        限定资源 ? `限定${限定资源}` : '',
      ].filter(Boolean).map(文本 => `，${文本}`).join('');
      const 结算 = String(效果.结算 || '').trim();
      const 正数值 = String(数值 || '').replace(/^[+-]/, '');
      if (结算 === '伤害吸收') {
        const 吸收来源 = SKILL_PROTOTYPE_FIELD_OPTIONS_V1.吸收来源.includes(String(效果.吸收来源 || '').trim())
          ? String(效果.吸收来源 || '').trim()
          : '造成伤害';
        const 吸收资源 = SKILL_PROTOTYPE_FIELD_OPTIONS_V1.吸收资源.includes(String(效果.吸收资源 || '').trim())
          ? String(效果.吸收资源 || '').trim()
          : '生命';
        const 转化效果 = String(效果.转化效果 || '').trim();
        const 对应等级文本 = Number(效果.对应等级 || 0) > 0 ? `，按等效${formatSkillNumber(效果.对应等级)}级${吸收资源}上限储存` : '';
        const 增幅上限文本 = 效果.增幅上限 ? `，下一击增幅上限${格式化技能结构转译字段_V1(效果.增幅上限, '')}` : '';
        if (转化效果 === '下次造成伤害') return `${吸收来源}时，将伤害量${正数值 || '0%'}储存为下一次造成伤害的增幅${增幅上限文本}${对应等级文本}${预算附加}${附加}`;
        if (转化效果 === '立即恢复') return `${吸收来源}时，将伤害量${正数值 || '0%'}立即恢复为${吸收资源}${预算附加}${附加}`;
        return `${吸收来源}时，将伤害量${正数值 || '0%'}转化为${吸收资源}${预算附加}${附加}`;
      }
      if (结算 === '资源恢复') {
        const 资源 = 格式化技能结构转译字段_V1(效果.资源 || 效果.限定资源, '资源');
        return `使${目标}恢复${资源}${正数值 || '0%'}${预算附加}${附加}`;
      }
      if (结算 === '伤害转治疗') return `将伤害结算转为治疗，比例${正数值 || '0%'}${预算附加}${附加}`;
      if (结算 === '治疗转伤害') return `将治疗结算转为伤害，比例${正数值 || '0%'}${预算附加}${附加}`;
      const 是负向 = /^-/.test(String(数值 || ''));
      const 变化 = (正向, 负向) => `${是负向 ? 负向 : 正向}${正数值}`;
      if (结算 === '造成伤害') return `使${目标}造成伤害${变化('提高', '降低')}${限定文本}${预算附加}${附加}`;
      if (结算 === '受到伤害') return `使${目标}受到伤害${变化('提高', '降低')}${限定文本}${预算附加}${附加}`;
      if (结算 === '治疗') return `使${目标}治疗效果${变化('提高', '降低')}${预算附加}${附加}`;
      if (结算 === '消耗') return `使${目标}技能消耗${变化('增加', '降低')}${限定文本}${附加}`;
      if (结算 === '前摇') return `使${目标}前摇${变化('延长', '缩短')}${限定文本}${附加}`;
      if (结算 === '技能效果') return `使${目标}技能效果${变化('提高', '降低')}${限定文本}${附加}`;
      if (结算 === '防御穿透') return `使${目标}防御穿透${变化('提高', '降低')}${预算附加}${附加}`;
      if (结算 === '防御剥夺') return `剥夺${目标}防御${正数值}${附加}`;
      if (结算 === '精神抗性剥夺') return `削弱${目标}精神抗性${正数值}${附加}`;
      if (结算 === '反击') return `使${目标}反击强度${变化('提高', '降低')}${预算附加}${附加}`;
      if (结算 === '反伤') return `使${目标}反伤${变化('提高', '降低')}${预算附加}${附加}`;
      if (结算 === '伤害转移') return `将${目标}承受伤害的${正数值}转移给${格式化技能结构转译字段_V1(效果.转移对象, '攻击者')}${预算附加}${附加}`;
      if (结算 === '持续伤害引爆') return `引爆${目标}持续伤害，倍率${正数值}${预算附加}${附加}`;
      if (结算 === '伤害分摊') return `使${目标}伤害分摊比例${变化('提高', '降低')}${预算附加}${附加}`;
      if (结算 === '消耗分摊') return `使${目标}消耗分摊比例${变化('提高', '降低')}${预算附加}${附加}`;
      const 句子 = `调整${目标}${格式化技能结构转译字段_V1(效果.结算, '结算')}${数值 || ''}${限定文本}${预算附加}${附加}`;
      return 句子;
    }
    case '状态施加':
      return `${转译技能状态施加描述_V1(效果, 目标)}${附加}`;
    case '时窗修正': {
      const 调整字段 = String(效果.调整字段 || '持续回合').trim() || '持续回合';
      const 调整值文本 =
        调整字段 === '有效期tick'
          ? 转译技能tick时长_V1(效果.调整tick || 效果.调整回合 || 1)
          : ['触发次数', '使用次数'].includes(调整字段)
              ? `${formatSkillNumber(效果.调整次数 || 效果.调整回合 || 1)}次`
              : `${formatSkillNumber(效果.调整回合 || 1)}回合`;
      const 目标文本 = 目标 === '全场' ? '全场（不分敌我）' : 目标;
      const 结算文本 = ['持续回合', '持续tick'].includes(调整字段) && 效果.结算倍率 ? `，结算${效果.结算倍率}` : '';
      const 上限文本 = `，单日最多使用${formatSkillNumber(效果.单日使用次数上限 || 1)}次`;
      if (调整字段 === '有效期tick') {
        return `调整本次技能生成造物有效期：${格式化技能结构转译字段_V1(效果.调整方式, '调整')}${调整值文本}${上限文本}${附加}`;
      }
      if (['触发次数', '使用次数'].includes(调整字段)) {
        return `调整${目标文本}全部${调整字段}窗口：${效果.调整方式 === '压缩' ? '减少' : '增加'}${调整值文本}${上限文本}${附加}`;
      }
      return `调整${目标文本}全部持续回合窗口：${格式化技能结构转译字段_V1(效果.调整方式, '调整')}${调整值文本}${结算文本}${上限文本}${附加}`;
    }
    case '状态移除':
      return `若${目标}存在${转译状态移除对象_V1(效果)}，则移除${转译状态移除对象_V1(效果)}${效果.数量 ? `，数量${formatSkillNumber(效果.数量)}` : ''}${转译状态移除附加语义_V1(效果, 深度)}`;
    case '规则防御': {
      const 规则 = String(效果.规则 || '').trim();
      const 次数文本 = 效果.次数 ? formatSkillNumber(效果.次数) : '1';
      if (规则 === '免死') return `使${目标}在致命结算时锁血，最多${次数文本}次${附加}`;
      if (规则 === '免伤') return `使${目标}抵消伤害，最多${次数文本}次${附加}`;
      return `使${目标}获得规则防御【${格式化技能结构转译字段_V1(效果.规则, '规则')}】×${次数文本}${附加}`;
    }
    case '状态转移':
      return 转译状态转移描述_V1(效果, 附加);
    case '状态交换': {
      const 状态 = String(效果.状态 || '任意负面').trim();
      const 交出文本 = 状态 === '任意负面' ? '一个负面状态' : `【${格式化技能结构转译字段_V1(状态, '状态')}】`;
      return `将自身的${交出文本}转给${目标}，并夺取目标一个增益状态${附加}`;
    }
    case '资源锁定':
      return `锁定${目标}${格式化技能结构转译字段_V1(效果.资源, '资源')}的${格式化技能结构转译字段_V1(效果.锁定类型, '资源通道')}${数值 ? `，比例${数值}` : ''}${附加}`;
    case '规则改写':
      if (String(效果.规则 || '').trim() === '死亡转存活') return `战斗内被动复活：致命结算时使${目标}转为存活${数值 ? `，恢复${数值}生命` : ''}${附加}`;
      return `在${formatSkillNumber(Math.max(1, Number(效果.持续回合 || 1)))}回合内改写${目标}规则【${格式化技能结构转译字段_V1(效果.规则, '规则')}】${预算附加}${附加}`;
    case '机制抹消':
      return `${转译机制抹消描述_V1(效果, 目标)}${附加}`;
    case '机制授予':
      return `${转译机制授予描述_V1(效果, 选项)}`;
    case '炸环':
      return `炸掉魂环强化下一次魂技${效果.强化倍率 ? `，强化倍率${格式化技能结构转译字段_V1(效果.强化倍率)}` : ''}${附加}`;
    case '复制执行': {
      const 复制类型 = String(效果.复制类型 || '复制技能').trim();
      const 复制显示 = 复制类型.replace(/^复制/, '') || '技能';
      return `复制${目标}${复制显示}${效果.复制模式 ? `，模式${格式化技能结构转译字段_V1(效果.复制模式)}` : ''}${['复制技能', '复制全部'].includes(复制类型) && 效果.保存上限 ? `，保存上限${formatSkillNumber(效果.保存上限)}` : ''}${['复制技能', '复制全部'].includes(复制类型) && 效果.可用次数 ? `，可用${formatSkillNumber(效果.可用次数)}次` : ''}${/属性|全部/.test(复制类型) && 效果.削减比例 ? `，属性削减${格式化技能结构转译字段_V1(效果.削减比例)}` : ''}${效果.保留回合 ? `，维持${formatSkillNumber(效果.保留回合)}回合` : ''}${效果.保留时长tick ? `，保留${formatSkillNumber(效果.保留时长tick)}tick` : ''}${附加}`;
    }
    case '时光回溯':
      return String(效果.发动方式 || '被动').trim() === '主动'
        ? `主动抢占时序，压低${目标}反应${附加}`
        : `可短暂回溯时间`;
    case '位移执行': {
      const 位移类型 = 格式化技能结构转译字段_V1(效果.位移类型, '位移');
      const 距离 = Math.max(1, Number(效果.距离 || 1));
      const 位移对象 = String(效果.位移对象 || '').trim();
      if (位移对象 === '自身与目标') return `按位移幅度扰乱自身与${目标}的战斗节奏，折算为双方反应与闪避变化${附加}`;
      if (位移对象 === '自身') {
        return `自身以${目标}为参照执行${位移类型}，按位移幅度转化为自身闪避与命中窗口${附加}`;
      }
      return `以${位移类型}扰乱${目标}行动，按位移幅度折算为反应、闪避与命中压制${附加}`;
    }
    case '决策干扰':
      return `${格式化技能结构转译字段_V1(效果.干扰, '判断干扰') === '索敌干扰' ? '干扰' + 目标 + '索敌判断' : '干扰' + 目标 + '行动判断'}${数值 ? `，干扰强度${数值}` : ''}${附加}`;
    case '修炼增益': {
      const 收益类型 = String(效果.收益类型 || '训练方式收益').trim();
      const 对象 = 收益类型 === '属性修炼速度'
        ? `${格式化技能结构转译字段_V1(效果.修炼属性, '魂力上限')}修炼速度`
        : `${格式化技能结构转译字段_V1(效果.训练方式, '冥想')}收益`;
      const 变化 = 读取技能结构增减数值_V1(效果.数值, '');
      const 效果文本 = 变化.正数值 ? `${变化.是负向 ? '降低' : '提高'}${目标}${对象}${变化.正数值}` : `调整${目标}${对象}`;
      return `战斗外收益，不作为主动战斗结算：${效果文本}${效果.有效期tick ? `，有效${formatSkillNumber(效果.有效期tick)}tick` : ''}${附加}`;
    }
    case '魂骨年限提升':
      return `战斗外一次性效果：将${目标}已融合魂骨的现有年限提高${数值 || '+10%'}，上限${formatSkillNumber(效果.年限上限 || 10000)}年${附加}`;
    case '战斗外复活':
      return `战斗外复活${目标}：意外死亡${formatSkillNumber(效果.死亡时限tick || 144)}tick内可用，恢复${数值 || '+25%'}生命，代价${格式化技能结构转译字段_V1(效果.复活代价类型, '状态代价')}【${格式化技能结构转译字段_V1(效果.复活代价对象, '虚弱')}】×${formatSkillNumber(效果.复活代价值 || '+1')}，复活后获得【${格式化技能结构转译字段_V1(效果.复活后状态, '虚弱')}】${附加}`;
    case '召唤生成': {
      const 召唤单位类型 = 格式化技能结构转译字段_V1(效果.召唤单位类型, '魂兽');
      const 名称 = 格式化技能结构转译字段_V1(效果.召唤物名称, '召唤物');
      const 使用继承属性 = 召唤生成使用继承属性比例_V1(效果);
      const 强度文本 = !使用继承属性 && 效果.强度 ? `，模板强度约${formatSkillNumber(效果.强度)}` : '';
      const 继承文本 = 使用继承属性 ? `，平均继承施术者约${转译技能比例描述_V1(读取召唤生成平均继承比例_V1(效果))}属性` : '';
      return `召唤${召唤单位类型}【${名称}】×${formatSkillNumber(效果.数量 || 1)}${效果.行动模式 ? `，${效果.行动模式}` : ''}${强度文本}${继承文本}${附加}`;
    }
    default: {
      const 注册原型 = SKILL_PROTOTYPE_REGISTRY_V1[原型];
      const 字段文本 = Object.entries(效果)
        .filter(([键]) => !['原型', '目标', '生效方式', '条件分支', '触发限制', '消耗', '副作用列表', ...技能执行嵌套效果数组字段表_V1].includes(键))
        .map(([键, 原始值]) => `${键}:${格式化技能结构转译字段_V1(原始值, '')}`)
        .filter(Boolean)
        .slice(0, 8)
        .join('，');
      return `执行${原型 || '未命名效果'}${注册原型?.描述 ? `（${注册原型.描述}）` : ''}${目标 ? `，作用于${目标}` : ''}${字段文本 ? `，${字段文本}` : ''}${附加}`;
    }
  }
}

function 编译效果数组为人类语言_V1(效果数组 = [], 选项 = {}) {
  const 深度 = Math.max(0, Number(选项.depth || 0));
  const 最大深度 = Math.max(1, Number(选项.maxDepth || 5));
  const 列表 = (Array.isArray(效果数组) ? 效果数组 : []);
  const 生效条件列表 = 列表.map(读取技能结构生效条件文本_V1);
  const 共享生效条件 = Array.from(new Set(生效条件列表.filter(Boolean)));
  const 统一生效条件 = 列表.length > 1 && 生效条件列表.every(Boolean) && 共享生效条件.length === 1 ? 共享生效条件[0] : '';
  const 片段列表 = 列表
    .map(效果 => {
      const 文本 = 转译单条执行效果_V1(效果, { depth: 深度, maxDepth: 最大深度, 预算: 选项.预算, 隐藏生效条件: 统一生效条件 });
      if (!文本) return '';
      return !选项.不加跟随前缀 && String(效果?.生效方式 || '').trim() === '跟随主原型' ? `附加${文本}` : 文本;
    })
    .filter(Boolean)
    .filter((文本, 序号, 列表) => 列表.indexOf(文本) === 序号);
  // v6 通顺化后处理：1) 数值符号转自然词 2) 持续回合后缀合并 3) 重复词简化 4) 多效果合并
  const 通顺化后 = 通顺化后处理_V1(片段列表);
  const 正文 = 通顺化后.join('；');
  return 统一生效条件 && 正文 ? `满足${统一生效条件}时：${正文}` : 正文;
}

// v6 翻译器通顺化后处理：在 编译效果数组为人类语言_V1 末尾统一应用 4 项优化
function 通顺化后处理_V1(片段列表 = []) {
  if (!Array.isArray(片段列表) || 片段列表.length === 0) return 片段列表;
  // v6.1 数值符号转义：把 +X%/-X% 转为更直白的"增强 X%"/"削弱 X%"
  // 仅作用于 "<动词中性词>+/-X%" 模式，避免误伤已有"造成/恢复/泯灭"等明确动作的句子
  const 数值符号转义 = 片段 => {
    let 文本 = String(片段 || '');
    // "干扰强度+12%" → "干扰强度增强 12%"；"目标命中-12%" → "目标命中削弱 12%"
    // 限定模式：在非动作动词后紧跟 +/- 数字 % 的位置
    文本 = 文本.replace(/([一-龥]{1,8})\+(\d+(?:\.\d+)?%)/g, (匹配, 名词, 数字) => {
      // 跳过已经是动作开头的（造成/恢复/吸收/转化/转移/分摊）
      if (/^(造成|恢复|吸收|转化|转移|分摊|提高|增加|延长|附加|获得)/.test(名词)) return 匹配;
      return `${名词}增强${数字}`;
    });
    文本 = 文本.replace(/([一-龥]{1,8})-(\d+(?:\.\d+)?%)/g, (匹配, 名词, 数字) => {
      if (/^(削弱|降低|消耗|泯灭|减少|压制|缩短)/.test(名词)) return 匹配;
      return `${名词}削弱${数字}`;
    });
    return 文本;
  };

  // v6.3 重复词简化：消除一句内"目标"和"状态"的多余重复
  const 重复词简化 = 片段 => {
    let 文本 = String(片段 || '');
    // "若目标存在【X】，则夺取目标的【X】并转移到自身" → "若目标存在【X】，夺取并转移到自身"
    文本 = 文本.replace(/若(目标|自身)存在(【[^】]+】)，则夺取\1的\2并转移到/g, '若$1存在$2，夺取并转移到');
    // "使目标进入【X】状态" 后紧跟"，目标..." → 删第二个"目标"前缀
    文本 = 文本.replace(/(使目标进入【[^】]+】状态)，目标/g, '$1，');
    return 文本;
  };

  // 应用单片段级转换
  const 转换后 = 片段列表.map(片段 => 重复词简化(数值符号转义(片段)));

  // v6.4 多效果合并：相邻同前缀同后缀的状态施加合并
  // 例：[使目标进入眩晕状态（持续3回合）, 使目标进入封技状态（持续3回合）]
  //  → [使目标进入眩晕、封技状态（持续3回合）]
  // 状态名可能带【】或不带，都支持
  const 状态合并模式 = /^(使(?:目标|自身|单体|群体|全场|召唤物|己方)?进入)(【?[一-龥A-Za-z0-9]+?】?)(状态(?:（持续\d+回合）)?)$/;
  const 状态合并后 = [];
  for (let i = 0; i < 转换后.length; i++) {
    const 当前 = 转换后[i];
    const m1 = 状态合并模式.exec(当前);
    if (m1 && i + 1 < 转换后.length) {
      // 收集同前缀同后缀的连续片段
      const 状态名集合 = [m1[2]];
      const 前缀 = m1[1];
      const 后缀 = m1[3];
      let j = i + 1;
      while (j < 转换后.length) {
        const m2 = 状态合并模式.exec(转换后[j]);
        if (!m2 || m2[1] !== 前缀 || m2[3] !== 后缀) break;
        状态名集合.push(m2[2]);
        j += 1;
      }
      if (状态名集合.length > 1) {
        状态合并后.push(`${前缀}${状态名集合.join('、')}${后缀}`);
        i = j - 1;
        continue;
      }
    }
    状态合并后.push(当前);
  }

  // v6.2 持续回合后缀合并：相邻多个 "...（持续X回合）" 把括号提到末尾
  // 仅当连续 ≥3 项同后缀且合并后总长 ≤100 字时才合并（避免把短句拼成长句反触发风险）
  const 持续后缀模式 = /^(.+?)（持续(\d+)回合）$/;
  const 持续合并后 = [];
  for (let i = 0; i < 状态合并后.length; i++) {
    const 当前 = 状态合并后[i];
    const m1 = 持续后缀模式.exec(当前);
    if (m1) {
      const 持续 = m1[2];
      const 主体集合 = [m1[1]];
      let j = i + 1;
      while (j < 状态合并后.length) {
        const m2 = 持续后缀模式.exec(状态合并后[j]);
        if (!m2 || m2[2] !== 持续) break;
        主体集合.push(m2[1]);
        j += 1;
      }
      if (主体集合.length >= 3) {
        const 合并文本 = `${主体集合.join('、')}（持续${持续}回合）`;
        // 合并后总长 ≤100 字才采用，否则保持原样
        if (合并文本.length <= 100) {
          持续合并后.push(合并文本);
          i = j - 1;
          continue;
        }
      }
    }
    持续合并后.push(当前);
  }

  // v7.3 并列脱动词：v6 合并产物里相邻"使自身/使目标/使单体"重复时，第二个起省略
  // 例：[使自身A、使自身B、使自身C（持续1回合）] → [使自身A、B、C（持续1回合）]（已被 v6.4 合并）
  // 例：[使自身A、提高自身B、使自身C] 内"使自身"重复出现 → 第二个起删掉
  const 脱动词后 = 持续合并后.map(片段 => {
    let 文本 = String(片段 || '');
    // 处理 "使自身/使目标/使单体/使群体/使全场" 在顿号后重复
    文本 = 文本.replace(/(、)使(自身|目标|单体|群体|全场|召唤物|己方)/g, '$1$2');
    // 处理"提高/降低/增强/削弱"重复时也只保留首个
    文本 = 文本.replace(/(、)(提高|降低|增强|削弱)(自身|目标|单体|群体|全场|召唤物|己方)/g, '$1$3$2');
    return 文本;
  });

  // v7.2 长句拆分：超长句中嵌套"（持续X回合；若制作者自用，改为自用效果：...）"提取为独立片段
  // 例：A（持续2回合；若制作者自用，改为自用效果：B（持续2回合）） → A（持续2回合）；若制作者自用：B（持续2回合）
  const 拆分后 = [];
  脱动词后.forEach(片段 => {
    const 文本 = String(片段 || '');
    if (文本.length <= 150) {
      拆分后.push(文本);
      return;
    }
    // 匹配尾部嵌套的"若制作者自用"分支
    const m = 文本.match(/^(.+?)（持续(\d+)回合；若制作者自用，改为(?:较低效果|自用效果)：(.+?)（持续(\d+)回合）\)?\）?$/);
    if (m) {
      const 主句 = `${m[1]}（持续${m[2]}回合）`;
      const 替补句 = `若制作者自用：${m[3]}（持续${m[4]}回合）`;
      拆分后.push(主句, 替补句);
      return;
    }
    // 匹配中间嵌套（不在末尾）
    const m2 = 文本.match(/^(.+?)（持续(\d+)回合；若制作者自用，改为(?:较低效果|自用效果)：(.+?)（持续(\d+)回合）\)?\）?(.*)$/);
    if (m2 && m2[5]) {
      const 主句 = `${m2[1]}（持续${m2[2]}回合）`;
      const 替补句 = `若制作者自用：${m2[3]}（持续${m2[4]}回合）`;
      // 清理 m2[5] 残留的开头分号 / 顿号
      const 尾部 = m2[5].replace(/^[；、，。\s]+/, '');
      if (尾部) 拆分后.push(主句, 替补句, 尾部);
      else 拆分后.push(主句, 替补句);
      return;
    }
    拆分后.push(文本);
  });

  // v7.2 后清理：消除可能残留的 `；；` `、；` 等重复分隔符
  const 最终 = 拆分后.map(片段 =>
    String(片段 || '')
      .replace(/[；、，]\s*[；、，]+/g, '；')
      .replace(/^[；、，]+/, '')
      .replace(/[；、，]+$/, '')
  ).filter(Boolean);

  return 最终;
}

function 转译技能副作用列表_V1(副作用列表 = []) {
  return (Array.isArray(副作用列表) ? 副作用列表 : [])
    .map(条目 => {
      if (!条目 || typeof 条目 !== 'object') return '';
      const 类型 = 格式化技能结构转译字段_V1(条目.副作用类型, '');
      if (!类型) return '';
      const 触发时机 = 格式化技能结构转译字段_V1(条目.触发时机 || '效果生效后', '效果生效后');
      const 生效对象 = 格式化技能结构转译字段_V1(条目.生效对象 || '技能释放者', '技能释放者');
      const 概率 = Math.max(0, Math.min(1, Number(条目.触发概率 ?? 1)));
      const 概率文本 = `${formatSkillPercent(概率)}使${生效对象}`;
      const 持续 = Number(条目.持续回合 || 0) > 0 ? `，持续${formatSkillNumber(条目.持续回合)}回合` : '';
      const 关联 = 条目.关联状态 ? `，关联${格式化技能结构转译字段_V1(条目.关联状态, '')}` : '';
      const 数值 = 读取副作用数值百分数_V1(条目.数值, 0);
      const 副数值 = 读取副作用数值百分数_V1(条目.副数值, 0);
      const 效果文本 = ({
        全属性降低: `虚弱：力量、防御、敏捷降低${formatSkillNumber(数值)}%`,
        自损反噬: `反噬：承受相当于自身上限${formatSkillNumber(数值)}%的反噬伤害`,
        致死献祭: '献祭：技能释放者进入致死代价',
        精神紊乱: `精神紊乱：${formatSkillNumber(数值)}%概率偏转目标${副数值 ? `，反应降低${formatSkillNumber(副数值)}%` : ''}`,
        魂力反噬: `魂力枯竭：魂力流失${formatSkillNumber(数值)}%`,
        命中下降: `精神紊乱：命中率降低${formatSkillNumber(数值)}%`,
        动作迟缓: `迟缓：反应降低${formatSkillNumber(数值)}%${副数值 ? `，闪避降低${formatSkillNumber(副数值)}%` : ''}`,
        目标错乱: `混乱：${formatSkillNumber(数值)}%概率错乱目标`,
        施法僵直: `僵直：施法僵直强度${formatSkillNumber(数值)}%`,
      })[类型] || `${类型}${数值 ? `：强度${formatSkillNumber(数值)}%` : ''}`;
      return `${触发时机}，${概率文本}${效果文本}${持续}${关联}。`;
    })
    .filter(Boolean)
    .join('；');
}

function 读取技能结构魂环位_V1(技能 = {}) {
  const 数值 = Math.max(0, Math.floor(Number(技能.__魂环位 || 技能.魂环位 || 技能.ringIndex || 0)));
  return 数值 >= 1 && 数值 <= 9 ? 数值 : 0;
}

function 技能结构包含伤害结算_V1(效果数组 = []) {
  const 访问 = effect => {
    if (!effect || typeof effect !== 'object') return false;
    if (Array.isArray(effect)) return effect.some(访问);
    if (String(effect.原型 || '').trim() === '伤害结算') return true;
    return 技能执行嵌套效果数组字段表_V1.some(字段 => 访问(effect[字段])) ||
      (Array.isArray(effect.条件分支) && effect.条件分支.some(分支 => 技能条件分支效果数组字段表_V1.some(字段 => 访问(分支?.[字段]))));
  };
  return 访问(效果数组);
}

function 格式化技能结构运行态消耗_V1(技能 = {}, 基础消耗 = '') {
  void 技能;
  return 格式化技能结构转译字段_V1(基础消耗, '');
}

function 读取技能场外冷却档_V1(技能 = {}) {
  const 前摇 = Math.max(0, Number(技能?.前摇 || 0));
  if (!(前摇 >= 30)) return { 标签: '无冷却', 冷却tick: 0 };
  if (前摇 < 60) return { 标签: '每小时一次', 冷却tick: 6 };
  if (前摇 < 90) return { 标签: '每日一次', 冷却tick: 144 };
  return { 标签: '每周', 冷却tick: 1008 };
}

function 技能结构可场外使用_V1(技能 = {}) {
  const 效果数组 = Array.isArray(技能?._效果数组) ? 技能._效果数组 : [];
  if (String(技能?.承载方式 || '').trim() === '造物承载' || 是造物承载效果数组_V1(效果数组)) return true;
  const 可写回原型 = new Set(['资源变化', '属性修正', '状态施加', '状态移除', '修炼增益', '战斗外复活', '等级提升', '群体撤离', '灵物吸收', '护盾变化', '机制授予', '复制执行']);
  return 技能执行效果数组存在匹配_V1(效果数组, 效果 => 可写回原型.has(String(效果?.原型 || '').trim()));
}

function 转译技能场外冷却_V1(技能 = {}, 选项 = {}) {
  if (!技能结构可场外使用_V1(技能)) return '';
  const 当前tick = Number(选项.当前tick ?? 选项.currentTick);
  const 冷却至tick = Math.max(0, Number(技能?.场外冷却至tick || 0));
  if (Number.isFinite(当前tick) && 冷却至tick > 当前tick) return '冷却中';
  return 读取技能场外冷却档_V1(技能).标签;
}

function 推断技能结构分类_V1(技能 = {}) {
  const 效果数组 = Array.isArray(技能._效果数组) ? 技能._效果数组 : [];
  const has = predicate => 技能执行效果数组存在匹配_V1(效果数组, predicate);
  const 名称文本 = `${技能.魂技名 || 技能.name || ''}${技能.效果描述 || ''}`;
  if (/真身/.test(名称文本)) return '真身';
  if (/领域/.test(名称文本)) return '领域';
  if (has(effect => String(effect?.原型 || '').trim() === '召唤生成')) return '召唤';
  if (has(effect => String(effect?.原型 || '').trim() === '位移执行')) return '位移';
  if (has(effect => String(effect?.原型 || '').trim() === '伤害结算')) return '输出';
  if (has(effect => ['护盾变化', '规则防御', '资源锁定'].includes(String(effect?.原型 || '').trim()))) return '防御';
  if (has(effect => String(effect?.原型 || '').trim() === '状态施加')) {
    const 状态集合 = new Set(
      效果数组
        .filter(effect => String(effect?.原型 || '').trim() === '状态施加')
        .map(effect => String(effect?.状态 || '').trim()),
    );
    if (['护盾', '霸体', '无视异常'].some(状态 => 状态集合.has(状态))) return '防御';
    if (['持续恢复', '净化', '治疗'].some(状态 => 状态集合.has(状态))) return '辅助';
    return '控制';
  }
  if (has(effect => ['状态移除', '修炼增益', '机制授予'].includes(String(effect?.原型 || '').trim()))) return '辅助';
  if (has(effect => String(effect?.原型 || '').trim() === '资源变化')) {
    const 有正向资源变化 = 效果数组.some(effect => {
      if (String(effect?.原型 || '').trim() !== '资源变化') return false;
      const 数值 = parseSkillSignedChangeNumber(effect?.数值);
      return Number.isFinite(数值) && 数值 > 0;
    });
    if (有正向资源变化) return '辅助';
  }
  return '辅助';
}

function 编译技能结构为人类语言_V1(技能或效果数组 = {}, 选项 = {}) {
  const 技能 = Array.isArray(技能或效果数组) ? { _效果数组: 技能或效果数组 } : (技能或效果数组 && typeof 技能或效果数组 === 'object' ? 技能或效果数组 : {});
  const 显示预算诊断 = 选项.显示预算诊断 === true;
  const 预算 = 显示预算诊断 ? (选项.预算 || 计算直接结算收益预算_V1(技能, 选项)) : null;
  const 片段 = [];
  const 名称 = 格式化技能结构转译字段_V1(技能.魂技名 || 技能.name, '');
  const 类型 = 格式化技能结构转译字段_V1(推断技能结构分类_V1(技能), '');
  const 消耗 = 格式化技能结构运行态消耗_V1(技能, 技能.消耗);
  const 前摇 = 技能.前摇 !== undefined ? Math.max(0, Number(技能.前摇 || 0)) : null;
  const 场外 = 转译技能场外冷却_V1(技能, 选项);
  const 掌控度 = 技能.技能掌控度 && typeof 技能.技能掌控度 === 'object' ? 转译技能掌控度_V1(技能.技能掌控度) : '';
  const 附带属性 = Array.isArray(技能.附带属性) && 技能.附带属性.length ? 技能.附带属性.join('/') : '';
  const 融合参与者 = Array.isArray(技能.融合参与者) && 技能.融合参与者.length ? 技能.融合参与者.join('/') : '';
  const 效果文本 = 编译效果数组为人类语言_V1(技能._效果数组 || [], { maxDepth: Math.max(1, Number(选项.maxDepth || 5)), 预算 });
  const 副作用文本 = 转译技能副作用列表_V1(技能.副作用列表 || []);
  const 是造物承载技能 = String(技能.承载方式 || '').trim() === '造物承载' || 是造物承载效果数组_V1(技能._效果数组);
  if (消耗) 片段.push(`消耗:${消耗}`);
  if (场外) 片段.push(`场外:${场外}`);
  if (掌控度) 片段.push(`掌控度:${掌控度}`);
  if (附带属性) 片段.push(`附带属性:${附带属性}`);
  if (融合参与者) 片段.push(`融合参与者:${融合参与者}${技能.失败回滚 ? '；失败不扣资源' : ''}`);
  if (效果文本) 片段.push(`效果:${效果文本}`);
  if (显示预算诊断 && 预算?.有收益预算 && 预算.预算系数 < 0.995) 片段.push('实际收益会受消耗与前摇折减');
  else if (
    显示预算诊断 &&
    预算?.有收益预算 &&
    Number(预算.总效果压力 || 0) > 0 &&
    Number(预算.允许压力 || 0) > 0 &&
    Number(预算.总效果压力 || 0) / Math.max(1, Number(预算.允许压力 || 0)) >= 直接结算收益预算系数_V1.预警阈值
  ) 片段.push('收益承载接近上限');
  if (副作用文本) 片段.push(`${是造物承载技能 ? '施展副作用' : '副作用'}:${副作用文本}`);
  const 文本 = 片段.join('；');
  return 选项.asObject ? {
    技能: 名称,
    类型,
    消耗,
    前摇: 前摇 || 0,
    场外,
    掌控度,
    附带属性,
    效果: 效果文本,
    副作用: 副作用文本,
    文本,
  } : 文本;
}

function buildSingleSkillEffectSummary(effect) {
  if (effect && typeof effect === 'object' && !String(effect?.原型 || '').trim() && Array.isArray(effect?.使用效果)) {
    const itemCount = Math.max(1, Number(effect.数量 || 1));
    const expiryText = String(buildConstructExpiryText(effect.有效期tick || 0, 0));
    const usageSegments = getMeaningfulSkillEffects(effect.使用效果)
      .map(buildSingleSkillEffectSummary)
      .filter(Boolean)
      .slice(0, 2);
    let text = '生成造物';
    if (itemCount > 1) text += '×' + itemCount;
    if (expiryText) text += '，' + expiryText;
    if (usageSegments.length > 0) text += `，使用后${usageSegments.join('；')}`;
    const 使用副作用 = 转译技能副作用列表_V1(effect.副作用列表 || []);
    if (使用副作用) text += `，使用副作用:${使用副作用}`;
    return text;
  }
  const 原型 = String(effect?.原型 || '').trim();
  const target = buildSkillTargetLabel(effect?.目标 || '目标');
  const 持续文本 = Number(effect?.持续回合 || 0) > 0 ? `，持续${formatSkillNumber(effect.持续回合)}回合` : '';
  switch (原型) {
    case '伤害结算': {
      const damageType = effect.伤害类型 && effect.伤害类型 !== '无' ? effect.伤害类型 : '伤害';
      const 对应等级文本 = Number(effect.对应等级 || 0) > 0 ? '，对应等级' + formatSkillNumber(effect.对应等级) : '';
      return (Number(effect.延迟回合 || 0) > 0 ? '延迟' + formatSkillNumber(effect.延迟回合) + '回合后，' : '') + '对' + target + '造成' + damageType + '打击，威力倍率' + formatSkillNumber(effect.威力倍率) + 对应等级文本;
    }
    case '资源变化': {
      const resource = String(effect.资源 || '资源');
      if (/^-/.test(String(effect.数值 || ''))) return (resource === '生命' ? '生命负数需改用伤害结算' : '泯灭' + target + String(effect.数值 || '0').replace(/^-/, '') + resource) + 持续文本;
      if (resource === '体力') return '恢复' + target + '体力/气血' + String(effect.数值 || '0').replace(/^\+/, '') + '，溢出转为体力增幅' + 持续文本;
      return '恢复' + target + resource + String(effect.数值 || '0').replace(/^\+/, '') + 持续文本;
    }
    case '资源转移': {
      const transferMode = String(effect.资源转移方式 || '').trim();
      const resource = String(effect.资源 || '资源');
      const value = String(effect.数值 || '0');
      if (transferMode === '吞噬') return '吞噬' + target + value + resource + (effect.转化比例 !== undefined ? '，按' + formatSkillNumber(effect.转化比例) + '转化为自身' + resource : '') + 持续文本;
      if (transferMode === '共享') return '自身消耗资源，向' + target + '共享' + value + resource + 持续文本;
      if (transferMode === '均分') return '使' + target + resource + '按' + (value || '100%') + '向平均值均分' + 持续文本;
      return '转移' + target + value + resource + 持续文本;
    }
    case '护盾变化':
      return (String(effect.护盾模式 || '').trim() || (/^-/.test(String(effect.数值 || '')) ? '斩盾' : '正向护盾')) + target + String(effect.数值 || '0') + 持续文本;
    case '属性修正': {
      const 属性 = Array.isArray(effect.属性) ? effect.属性.join('/') : String(effect.属性 || '属性');
      return '修正' + target + '的' + 属性 + String(effect.数值 || '') + 持续文本;
    }
    case '判定修正':
      return '修正' + target + '的' + String(effect.判定 || '判定') + String(effect.数值 || '') + (effect.打断效果 === true ? '，附带打断' : '') + 持续文本;
    case '结算修正': {
      const 结算 = String(effect.结算 || '结算').trim();
      const 限定攻击类型 = 格式化技能结构转译字段_V1(effect.限定攻击类型, '');
      const 限定资源 = 格式化技能结构转译字段_V1(effect.限定资源, '');
      const 限定文本 = `${限定攻击类型 ? '，限定' + 限定攻击类型 + '攻击' : ''}${限定资源 ? '，限定' + 限定资源 : ''}`;
      if (结算 === '伤害吸收') {
        const 吸收来源 = SKILL_PROTOTYPE_FIELD_OPTIONS_V1.吸收来源.includes(String(effect.吸收来源 || '').trim()) ? String(effect.吸收来源 || '').trim() : '造成伤害';
        const 吸收资源 = SKILL_PROTOTYPE_FIELD_OPTIONS_V1.吸收资源.includes(String(effect.吸收资源 || '').trim()) ? String(effect.吸收资源 || '').trim() : '生命';
        if (String(effect.转化效果 || '').trim() === '下次造成伤害') return 吸收来源 + '时，将伤害量' + String(effect.数值 || '+0%') + '储存为下一次造成伤害增幅' + (effect.增幅上限 ? '，上限' + String(effect.增幅上限) : '') + (Number(effect.对应等级 || 0) > 0 ? '，按等效' + formatSkillNumber(effect.对应等级) + '级' + 吸收资源 + '上限储存' : '') + 持续文本;
        if (String(effect.转化效果 || '').trim() === '立即恢复') return 吸收来源 + '时，将伤害量' + String(effect.数值 || '+0%') + '立即恢复为' + 吸收资源 + 持续文本;
        return 吸收来源 + '时，将伤害量' + String(effect.数值 || '+0%') + '转化为' + 吸收资源 + 持续文本;
      }
      if (结算 === '资源恢复') return '使' + target + '恢复' + String(effect.资源 || effect.限定资源 || '资源') + String(effect.数值 || '+0%') + 限定文本 + 持续文本;
      if (结算 === '伤害转治疗') return '伤害结算转为治疗，比例' + String(effect.数值 || '+0%') + 持续文本;
      if (结算 === '治疗转伤害') return '治疗结算转为伤害，比例' + String(effect.数值 || '+0%') + 持续文本;
      return '修正' + target + '的' + 结算 + String(effect.数值 || '') + 限定文本 + 持续文本;
    }
    case '状态施加':
      return 转译技能状态施加描述_V1(effect, target) + 持续文本;
    case '状态移除':
      return '若' + target + '存在' + 转译状态移除对象_V1(effect) + '，则移除' + 转译状态移除对象_V1(effect) + (effect.数量 ? '，数量' + formatSkillNumber(effect.数量) : '') + 持续文本 + 转译状态移除附加语义_V1(effect);
    case '规则防御':
      return '使' + target + '获得' + String(effect.规则 || '防御规则') + (effect.次数 !== undefined ? '×' + formatSkillNumber(effect.次数) : '') + 持续文本;
    case '状态转移':
      return 转译状态转移描述_V1(effect, 持续文本);
    case '状态交换': {
      const 状态 = String(effect.状态 || '任意负面').trim();
      const 交出文本 = 状态 === '任意负面' ? '一个负面状态' : `【${状态}】`;
      return '将自身的' + 交出文本 + '转给' + target + '，并夺取目标一个增益状态' + 持续文本;
    }
    case '资源锁定':
      return '锁定' + target + '的' + String(effect.资源 || '资源') + '：' + String(effect.锁定类型 || '回复锁定') + '，比例' + String(effect.数值 || '') + 持续文本;
    case '规则改写':
      if (String(effect.规则 || '').trim() === '死亡转存活') return '战斗内被动复活：致命结算时使' + target + '转为存活，恢复' + String(effect.数值 || '+25%') + '生命';
      return '在' + formatSkillNumber(Math.max(1, Number(effect.持续回合 || 1))) + '回合内改写' + target + '的' + String(effect.规则 || '规则');
    case '机制抹消':
      return 转译机制抹消描述_V1(effect, target);
    case '机制授予': {
      const 授予文本 = (Array.isArray(effect?.授予效果) ? effect.授予效果 : [])
        .map(buildSingleSkillEffectSummary)
        .filter(Boolean)
        .slice(0, 3)
        .join('；') || '后续效果';
      const 触发条件 = String(effect?.触发条件 || '主动触发').trim();
      if (触发条件 === '随下次行动触发') return '下次行动时附带：' + 授予文本;
      if (触发条件 === '下次魂技成功释放') return '下一次魂技成功释放时附带：' + 授予文本 + '；成功后消费' + formatSkillNumber(effect?.可用次数 || 1) + '次，无回合期限';
      return '可在' + formatSkillNumber(effect?.持续回合 || 1) + '回合内主动触发' + formatSkillNumber(effect?.可用次数 || 1) + '次：' + 授予文本;
    }
    case '复制执行': {
      const 复制类型 = String(effect.复制类型 || '复制技能').trim();
      const 复制显示 = 复制类型.replace(/^复制/, '') || '技能';
      return '复制' + target + '的' + 复制显示 + '，模式' + String(effect.复制模式 || '即时镜像') + (['复制技能', '复制全部'].includes(复制类型) ? '，保存上限' + formatSkillNumber(effect.保存上限 || 1) + '，可用' + formatSkillNumber(effect.可用次数 || 1) + '次' : '') + (/属性|全部/.test(复制类型) && effect.削减比例 ? '，属性削减' + 格式化技能结构转译字段_V1(effect.削减比例) : '') + (effect.保留时长tick ? '，保留' + formatSkillNumber(effect.保留时长tick) + 'tick' : '');
    }
    case '时光回溯':
      return String(effect.发动方式 || '被动').trim() === '主动'
        ? '主动释放时压低' + target + '反应' + (String(effect.目标 || '').trim() === '全场' ? '（全场不分敌我，排除施术者）' : '')
        : '为' + target + '登记目标结算前回溯规避，触发时回到本回合开始战斗态并阻断本次落地';
    case '位移执行': {
      const 距离 = Math.max(1, Number(effect.距离 || 1));
      const 位移类型 = String(effect.位移类型 || '位移');
      const 位移对象 = String(effect.位移对象 || '').trim();
      if (位移对象 === '自身与目标' || 位移类型 === '换位') return '扰乱自身与' + target + '的战斗节奏，位移幅度' + formatSkillNumber(距离) + 持续文本;
      if (位移对象 === '自身') return '自身以' + target + '为参照执行' + 位移类型 + '，位移幅度' + formatSkillNumber(距离) + 持续文本;
      return '以' + 位移类型 + '扰乱' + target + '行动，位移幅度' + formatSkillNumber(距离) + 持续文本;
    }
    case '决策干扰':
      return (String(effect.干扰 || '').trim() === '索敌干扰' ? '干扰' + target + '索敌判断' : '干扰' + target + '行动判断') + '，干扰强度' + String(effect.数值 || '') + 持续文本;
    case '修炼增益': {
      const 收益类型 = String(effect.收益类型 || '训练方式收益').trim();
      const 对象 = 收益类型 === '属性修炼速度'
        ? String(effect.修炼属性 || '魂力上限') + '修炼速度'
        : String(effect.训练方式 || '冥想') + '收益';
      return '战斗外收益，不作为主动战斗结算：使' + target + 对象 + String(effect.数值 || '') + 持续文本;
    }
    case '等级提升':
      return '战斗外主动：将' + target + '提升至当前合法等级序列的下一等级，最高' + formatSkillNumber(effect.等级上限 || 120) + '级；成功后冷却' + formatSkillNumber(effect.冷却年数 || 0) + '年';
    case '群体撤离':
      return '战斗外群体撤离至' + String(effect.目的地 || '亡灵半位面') + '：基础成功率' + formatSkillNumber(effect.基础成功率 ?? 1) + '，每增加一人乘' + formatSkillNumber(effect.每增加一人成功率倍率 ?? 0.9) + '；' + String(effect.结算方式 || '全员同成败') + '，失败仍消耗资源，密钥不消耗' + (effect.消耗 ? '，消耗' + String(effect.消耗) : '');
    case '魂骨年限提升':
      return '战斗外一次性效果：将' + target + '已融合魂骨的现有年限提高' + String(effect.数值 || '+10%') + '，上限' + formatSkillNumber(effect.年限上限 || 10000) + '年';
    case '战斗外复活':
      return '战斗外复活' + target + '：意外死亡' + formatSkillNumber(effect.死亡时限tick || 144) + 'tick内可用，恢复' + String(effect.数值 || '+25%') + '生命，代价' + String(effect.复活代价类型 || '状态代价') + '【' + String(effect.复活代价对象 || '虚弱') + '】×' + formatSkillNumber(effect.复活代价值 || '+1') + '，复活后获得【' + String(effect.复活后状态 || '虚弱') + '】';
    case '召唤生成': {
      const 召唤单位类型 = String(effect.召唤单位类型 || '魂兽').trim() || '魂兽';
      const 使用继承属性 = 召唤生成使用继承属性比例_V1(effect);
      const 强度文本 = !使用继承属性 && effect.强度 ? '，模板强度约' + formatSkillNumber(effect.强度) : '';
      const 继承文本 = 使用继承属性 ? '，平均继承约' + Math.round(读取召唤生成平均继承比例_V1(effect) * 100) + '%属性' : '';
      return '召唤' + 召唤单位类型 + '【' + String(effect.召唤物名称 || '召唤物') + '】×' + formatSkillNumber(effect.数量 || 1) + 强度文本 + 继承文本 + 持续文本;
    }
  }
  const 机甲 = 原型;
  const 注册原型 = SKILL_PROTOTYPE_REGISTRY_V1[原型];
  if (注册原型?.描述) {
    return '执行【' + 原型 + '】：' + 注册原型.描述 + (target ? '，目标=' + target : '') + 持续文本;
  }
  switch (机甲) {
    case '直接伤害': {
      const damageType = effect.伤害类型 && effect.伤害类型 !== '无' ? effect.伤害类型 : '伤害';
      return '对' + target + '造成1次' + damageType + '打击，威力倍率' + formatSkillNumber(effect.威力倍率);
    }
    case '多段伤害': {
      const damageType = effect.伤害类型 && effect.伤害类型 !== '无' ? effect.伤害类型 : '伤害';
      return '对' + target + '打出多段' + damageType + '，总威力倍率约为' + formatSkillNumber(effect.威力倍率);
    }
    case '群体伤害': {
      const damageType = effect.伤害类型 && effect.伤害类型 !== '无' ? effect.伤害类型 : '伤害';
      return '对' + target + '造成群体' + damageType + '，威力倍率' + formatSkillNumber(effect.威力倍率);
    }
    case '持续伤害':
      return '对' + target + '施加持续伤害，基础威力倍率' + formatSkillNumber(effect.威力倍率);
    case '护盾':
      return '为' + target + '附加' + formatSkillNumber(effect.护盾值) + '点护盾';
    case '属性变化': {
      const property = String(effect?.属性 || '').trim();
      const action = String(effect?.动作 || '').trim();
      const value = parseSkillSignedChangeNumber(effect?.数值);
      const duration = getSkillEffectDuration(effect);
      const label = buildSkillEffectPropertyLabel(property);
      const durationText = duration > 0 ? `，持续${formatSkillNumber(duration)}回合` : '';
      if (action === '加值') {
        if (['vit', 'sp', 'men'].includes(property)) return '为' + target + '每回合恢复' + formatSkillPercent(value) + label;
        return '使' + target + '的' + label + '提高' + formatSkillPercent(value) + durationText;
      }
      if (action === '减值') return '使' + target + '的' + label + '降低' + formatSkillPercent(value) + durationText;
      if (action === '倍率提升') return '使' + target + '的' + label + '提升' + formatSkillPercent(Math.abs(value - 1)) + durationText;
      if (action === '倍率压制') return '使' + target + '的' + label + '压低' + formatSkillPercent(Math.abs(1 - value)) + durationText;
      if (!action && Number.isFinite(value) && Math.abs(value) > 0.001) {
        return '使' + target + '的' + label + (value >= 0 ? '提升' : '压低') + formatSkillPercent(Math.abs(value)) + durationText;
      }
      return '使' + target + '的' + label + '发生变化' + durationText;
    }
    case '持续恢复': {
      const property = String(effect?.属性 || '').trim();
      const value = Number(effect?.数值 || 0);
      const duration = getSkillEffectDuration(effect);
      const label = buildSkillEffectPropertyLabel(property);
      return (
        '使' +
        target +
        '每回合恢复' +
        formatSkillPercent(value) +
        label +
        '，持续' +
        formatSkillNumber(duration) +
        '回合'
      );
    }
    case '结算修正': {
      const 结算 = String(effect?.结算 || '').trim();
      if (结算 === '伤害吸收') {
        const 吸收来源 = SKILL_PROTOTYPE_FIELD_OPTIONS_V1.吸收来源.includes(String(effect?.吸收来源 || '').trim()) ? String(effect.吸收来源 || '').trim() : '造成伤害';
        const 吸收资源 = SKILL_PROTOTYPE_FIELD_OPTIONS_V1.吸收资源.includes(String(effect?.吸收资源 || '').trim()) ? String(effect.吸收资源 || '').trim() : '生命';
        return 吸收来源 + '时，将伤害量' + String(effect?.数值 || '+0%') + '转化为' + 吸收资源 + 持续文本;
      }
      if (结算 === '伤害转治疗') return '伤害结算转为治疗，比例' + String(effect?.数值 || '+0%') + 持续文本;
      if (结算 === '治疗转伤害') return '治疗结算转为伤害，比例' + String(effect?.数值 || '+0%') + 持续文本;
      if (!['消耗', '前摇'].includes(结算)) break;
      const value = Number(effect?.数值 || 0);
      const duration = getSkillEffectDuration(effect);
      const durationText = duration > 0 ? `，持续${formatSkillNumber(duration)}回合` : '';
      return '使' + target + '的自身能力' + 结算 + (value >= 0 ? '提高' : '降低') + formatSkillPercent(Math.abs(value)) + durationText;
    }
    case '掌控修正': {
      const value = Number(effect?.数值 || 0);
      const duration = getSkillEffectDuration(effect);
      const durationText = duration > 0 ? `，持续${formatSkillNumber(duration)}回合` : '';
      if (String(effect?.动作 || '').trim() === '倍率压制')
        return '使' + target + '的掌控压制' + formatSkillPercent(Math.abs(1 - value)) + durationText;
      return '使' + target + '的掌控提升' + formatSkillPercent(Math.abs(value - 1)) + durationText;
    }
    case '速度修正': {
      const value = Number(effect?.数值 || 0);
      const duration = getSkillEffectDuration(effect);
      const durationText = duration > 0 ? `，持续${formatSkillNumber(duration)}回合` : '';
      if (String(effect?.动作 || '').trim() === '倍率压制')
        return '使' + target + '的速度压制' + formatSkillPercent(Math.abs(1 - value)) + durationText;
      return '使' + target + '的速度提升' + formatSkillPercent(Math.abs(value - 1)) + durationText;
    }
    case '技能效果增幅': {
      const effectMult = Math.max(1, Number(effect?.效果倍率 || effect?.技能效果倍率 || 1));
      const duration = getSkillEffectDuration(effect);
      const durationText = duration > 0 ? `，持续${formatSkillNumber(duration)}回合` : '';
      return (
        '使' +
        target +
        '后续技能效果提升至 x' +
        formatSkillNumber(effectMult, 2) +
        '，有数量时优先提升数量' +
        durationText
      );
    }
    case '体力恢复':
      return '为' + target + '恢复体力/气血，溢出转为体力增幅，回复倍率' + formatSkillPercent(effect.回复倍率 || effect.数值 || 0);
    case '魂力恢复':
      return '为' + target + '恢复魂力，回复倍率' + formatSkillPercent(effect.回复倍率 || effect.数值 || 0);
    case '精神恢复':
      return '为' + target + '恢复精神力，回复倍率' + formatSkillPercent(effect.回复倍率 || effect.数值 || 0);
    case '软控':
      return '限制' + target + '的反应、前摇或闪避，持续' + formatSkillNumber(effect.持续回合) + '回合';
    case '迟缓':
      return '使' + target + '动作迟缓，敏捷、闪避与反应下降' + 持续文本;
    case '单属性削弱':
    case '多属性削弱':
      return '压制' + target + '的属性，持续' + formatSkillNumber(effect.持续回合 || effect.持续) + '回合';
    case '单属性增益':
    case '多属性增益':
    case '全属性增益':
      return '强化' + target + '的属性，持续' + formatSkillNumber(effect.持续回合 || effect.持续) + '回合';
    case '掌控压制':
    case '速度压制':
      return '压制' + target + '的' + 机甲.replace('压制', '') + '，持续' + formatSkillNumber(effect.持续回合 || effect.持续) + '回合';
    case '掌控提升':
    case '速度提升':
      return '提升' + target + '的' + 机甲.replace('提升', '') + '，持续' + formatSkillNumber(effect.持续回合 || effect.持续) + '回合';
    case '解控':
    case '净化':
      return (
        '为' +
        target +
        '清除负面状态' +
        (Number(effect.数量 || effect.清除数量 || 0) > 0 ? '（数量' + formatSkillNumber(effect.数量 || effect.清除数量) + '）' : '')
      );
    case '驱散增益':
      return '驱散' + target + '的增益状态' + (Number(effect.驱散数量 || 0) > 0 ? '（数量' + formatSkillNumber(effect.驱散数量) + '）' : '');
    case '窃取增益':
      return '窃取' + target + '的增益状态' + (Number(effect.窃取数量 || 0) > 0 ? '（数量' + formatSkillNumber(effect.窃取数量) + '）' : '');
    case '吞噬':
      return (
        '吞噬' +
        target +
        '的' +
        String(effect.资源类型 || '魂力/精神力') +
        '并回流给施术者' +
        (Number(effect.夺取比例 || 0) > 0 ? '（比例' + formatSkillPercent(effect.夺取比例) + '）' : '')
      );
    case '能力共享':
      return (
        '与' +
        target +
        '共享' +
        String(effect.资源类型 || '魂力/精神力') +
        (Number(effect.反灌比例 || 0) > 0 ? '（比例' + formatSkillPercent(effect.反灌比例) + '）' : '')
      );
    case '复制': {
      const copyType = String(effect.复制类型 || '复制技能');
      const copyMode = String(effect.复制模式 || '即时镜像');
      const useCount = Math.max(1, Number(effect.可用次数 || 1));
      const copyDisplay = copyType.replace(/^复制/, '') || '技能';
      return '复制' + target + '的' + copyDisplay + '，模式为' + copyMode + (copyType === '复制技能' ? '，保存上限' + formatSkillNumber(effect.保存上限 || 1) + '，可用' + formatSkillNumber(useCount) + '次' : '') + (effect.保留时长tick ? '，保留' + String(effect.保留时长tick) + 'tick' : '');
    }
    case '反制':
      return '为' + target + '建立反制层，受触发后按系数' + formatSkillNumber(effect.反击倍率 || effect.反制倍率 || 1, 2) + '反击';
    case '状态交换': {
      const 状态 = String(effect.状态 || '任意负面').trim();
      const 交出文本 = 状态 === '任意负面' ? '一个负面状态' : `【${状态}】`;
      return '将自身的' + 交出文本 + '转给' + target + '，并夺取目标一个增益状态' + 持续文本;
    }
    case '强制绑定/锁定':
      return '强制绑定' + target + '，持续' + formatSkillNumber(effect.持续回合) + '回合，限制位移与反应';
    case '规则改写':
      if (String(effect.规则 || '').trim() === '死亡转存活') return '战斗内被动复活：致命结算时使' + target + '转为存活，恢复' + String(effect.数值 || '+25%') + '生命';
      return '在' + formatSkillNumber(Math.max(1, Number(effect.持续回合 || 1))) + '回合内改写' + target + '的' + String(effect.规则 || '缴械');
    case '威力增幅':
      return '使' + target + '后续威力提升至 x' + formatSkillNumber(effect.威力倍率 || 1.2, 2);
    case '元素封禁':
      return '封禁' + target + '的' + String(effect.限定元素 || '指定元素') + '调用，强度' + formatSkillPercent(effect.封禁强度 || effect.元素封禁比例 || 0);
    case '时光回溯':
      return String(effect.发动方式 || '被动').trim() === '主动'
        ? '主动释放时压低' + target + '反应' + (String(effect.目标 || '').trim() === '全场' ? '（全场不分敌我，排除施术者）' : '')
        : '为' + target + '登记目标结算前回溯规避，触发时回到本回合开始战斗态并阻断本次落地';
    case '气运干涉':
      return '干扰' + target + '行动判断，干扰强度' + formatSkillPercent(effect.判断干扰强度 || effect.数值 || 0);
    case '自残换收益':
      return '牺牲自身状态换取短时收益';
    case '炸环':
      return '炸环临时增幅下一次魂技释放时的自身属性，倍率' + String(effect.强化倍率 || '+100%') + '×年限/40万';
    case '穿透':
      return '攻击穿透' + target + '的防御，穿透比例' + formatSkillPercent(effect.穿透比例 || effect.防御穿透 || 0);
    case '伤害吸收':
      return '造成伤害后按伤害量吸收' + String(effect.吸收资源 || '生命') + '，比例' + formatSkillPercent(effect.吸收比例 || 0);
    case '流血DOT':
      return '对' + target + '施加流血，持续' + formatSkillNumber(effect.持续回合) + '回合';
    case '生命链接':
      return '将' + target + '纳入生命链接，分摊或传导伤害';
    case '延长持续伤害':
      return '延长' + target + '身上的持续伤害时间';
    case '压缩持续伤害':
      return '压缩' + target + '身上的持续伤害为即时结算';
    case '资源燃烧':
      return '燃烧' + target + '的' + String(effect.资源类型 || '资源') + '，比例' + formatSkillPercent(effect.夺取比例 || effect.燃烧比例 || 0);
    case '资源锁定':
      return '锁定' + target + '的' + String(effect.资源 || '资源') + String(effect.锁定类型 || '通道') + '，持续' + formatSkillNumber(effect.持续回合) + '回合';
    case '感知干扰':
      return '扰乱' + target + '的感知判断，持续' + formatSkillNumber(effect.持续回合) + '回合';
    case '标记锁定':
      return '锁定' + target + '，持续' + formatSkillNumber(effect.持续回合) + '回合，并提高命中与锁定强度';
    case '目标锁定':
      return '锁定' + target + '的行动轨迹，持续' + formatSkillNumber(effect.持续回合) + '回合，提高追踪命中';
    case '自身位移':
      return '使' + target + '获得短时闪避与命中窗口';
    case '强制位移':
      return '压制' + target + '的反应与闪避';
    case '位移交换':
      return '扰乱与' + target + '的战斗节奏并制造锁定窗口';
    case '追击位移':
      return '追击' + target + '并提高后续命中与伤害';
    case '脱离位移':
      return '使' + target + '获得脱离收益并提高反应';
    case '隐身':
      return '使' + target + '进入隐身状态，持续' + formatSkillNumber(effect.持续回合) + '回合';
    case '破隐':
      return '强制拆除' + target + '的隐身伪装，并提高后续命中';
    case '共享视野':
      return '与' + target + '共享视野，持续' + formatSkillNumber(effect.持续回合) + '回合，提高反应与命中';
    case '幻境':
      return '对' + target + '施加幻境干扰，持续' + formatSkillNumber(effect.持续回合) + '回合';
    case '催眠':
      return '尝试催眠' + target + '，成功后持续' + formatSkillNumber(effect.持续回合) + '回合';
    case '认知扭曲':
      return '扭曲' + target + '的认知与判断，持续' + formatSkillNumber(effect.持续回合) + '回合';
    case '禁疗':
      return '对' + target + '施加禁疗，持续' + formatSkillNumber(effect.持续回合) + '回合';
    case '致盲':
      return '干扰' + target + '视野，持续' + formatSkillNumber(effect.持续回合) + '回合';
    case '沉默':
      return '使' + target + '沉默' + formatSkillNumber(effect.持续回合) + '回合';
    case '减速':
      return '使' + target + '减速，持续' + formatSkillNumber(effect.持续回合) + '回合';
    case '追击':
      return '对' + target + '建立追击节奏，持续' + formatSkillNumber(effect.持续回合) + '回合，提高速度、命中与追击伤害';
    case '引爆持续伤害':
      return '引爆' + target + '身上的持续伤害效果，转化为即时伤害';
    case '护卫':
      return '为' + target + '提供护卫拦截，持续' + formatSkillNumber(effect.持续回合) + '回合';
    case '嘲讽':
      return '迫使' + target + '优先把火力集中到施术者身上，持续' + formatSkillNumber(effect.持续回合) + '回合';
    case '无敌金身':
      return '使' + target + '进入无视异常状态，' + (转译技能触发限制_V1(effect.触发限制) || '每日3次') + '免疫负面状态与削减类效果';
    case '伤害反射':
      return '使' + target + '在受击后反弹部分伤害，持续' + formatSkillNumber(effect.持续回合) + '回合';
    case '伤害分摊':
      return '使' + target + '将部分伤害分摊给友军，持续' + formatSkillNumber(effect.持续回合) + '回合';
    case '消耗分摊':
      return '使' + target + '将部分技能启动消耗分摊给友军，持续' + formatSkillNumber(effect.持续回合) + '回合';
    case '状态转移':
      return 转译状态转移描述_V1(effect, 持续文本);
    case '斩盾':
      return '直接斩碎' + target + '的护盾并转化为额外伤害';
    case '治疗反转':
      return '使' + target + '受到的治疗在持续期间反转为伤害';
    case '封技':
      return '封锁' + target + '的技能回路，持续' + formatSkillNumber(effect.持续回合) + '回合';
    case '硬控':
      return '强行控制' + target + '，持续' + formatSkillNumber(effect.持续回合) + '回合';
    case '打断':
      return '对' + target + '附带高优先级打断';
    case '斩杀补伤':
      return '在目标血量低于阈值时，对' + target + '追加斩杀补伤';
    case '标记弱点':
      return '剥开' + target + '抗性，使后续物理与精神攻击更容易打穿';
    case '受击反击':
      return '使自身在受击后触发一次反击，反击系数' + formatSkillNumber(effect.反击倍率, 2);
    case '承伤修正':
      return '使' + target + '受到伤害修正' + formatSkillPercent(effect.承伤修正 || effect.数值 || 0);
    case '免伤':
      return '使' + target + '获得' + formatSkillNumber(effect.抵消次数) + '次免伤';
    case '霸体':
      return '使' + target + '进入霸体状态，持续' + formatSkillNumber(effect.持续回合) + '回合';
    case '分身': {
      const cloneType = String(effect.分身类型 || '分身');
      const cloneCount = Math.max(1, Number(effect.分身数量 || 1));
      const stealth = Number(effect.隐蔽度 || 0);
      const inheritRatio = Number(effect.实力继承比例 || 0);
      return (
        '使' +
        target +
        '分出' +
        formatSkillNumber(cloneCount) +
        '体' +
        cloneType +
        '，隐蔽度' +
        formatSkillPercent(stealth) +
        '，继承实力' +
        formatSkillPercent(inheritRatio)
      );
    }
    case '免死':
      return (
        '使' +
        target +
        '在' +
        formatSkillNumber(effect.持续回合) +
        '回合内获得' +
        formatSkillNumber(effect.触发次数) +
        '次濒死保护'
      );
    case '自身也受影响':
      return '技能效果会同步反馈至自身';
    case '回复转伤害':
      return '将原本的回复效果转化为伤害输出';
    case '伤害转回复':
      return '将部分伤害转化为自身回复';
    case '属性永久强化':
      return (
        '永久强化基础属性' + (Number(effect.强化值 || 0) > 0 ? '，强化幅度约' + formatSkillPercent(effect.强化值) : '')
      );
    case '召唤': {
      const summonName = String(effect.召唤物名称 || '召唤物');
      const count = Math.max(1, Number(effect.召唤数量 || 1));
      const duration = Number(effect.持续回合 || 0);
      const mode = String(effect.行动模式 || '').trim();
      let text = '召唤【' + summonName + '】×' + count;
      if (duration > 0) text += '，持续' + formatSkillNumber(duration) + '回合';
      if (mode) text += '，' + mode;
      return text;
    }
    default:
      if (Number(effect?.持续回合 || 0) > 0)
        return '对' + target + '施加【' + 机甲 + '】效果，持续' + formatSkillNumber(effect.持续回合) + '回合';
      return '对' + target + '施加【' + 机甲 + '】效果';
  }
}

function buildSkillEffectDescriptionFromPackedEffects(packedEffects) {
  const effects = getMeaningfulSkillEffects(packedEffects);
  if (effects.length === 0) return '无';
  const compiled = 编译效果数组为人类语言_V1(effects);
  if (compiled) return compiled + '。';
  const isConstructEffect = effect => !String(effect?.原型 || '').trim() && Array.isArray(effect?.使用效果);
  const itemTemplateEffects = effects.filter(isConstructEffect);
  const normalEffects = effects.filter(effect => !isConstructEffect(effect));
  const orderedEffects = itemTemplateEffects.length > 0 ? itemTemplateEffects : normalEffects;
  const segments = [];
  orderedEffects.forEach(effect => {
    const summary = buildSingleSkillEffectSummary(effect);
    if (summary && !segments.includes(summary)) segments.push(summary);
  });
  if (segments.length === 0) return '无';
  return segments.join('；') + '。';
}

function buildSkillEffectReferenceText(packedEffects) {
  const summary = buildSkillEffectDescriptionFromPackedEffects(packedEffects);
  return summary && summary !== '无' ? summary.replace(/。$/, '') : '';
}

function buildSkillProductReferenceText(packedEffects) {
  const effects = getMeaningfulSkillEffects(packedEffects);
  const products = [];
  const visit = effect => {
    if (!effect || typeof effect !== 'object') return;
    if (!String(effect.原型 || '').trim() && Array.isArray(effect.使用效果)) {
      const ttl = Number(effect.有效期tick || 0);
      products.push(`造物×${Math.max(1, Number(effect.数量 || 1))}${ttl > 0 ? `，有效${ttl}tick` : ''}`);
    }
    if (String(effect.原型 || '').trim() === '召唤生成') {
      const 名称 = String(effect.召唤物名称 || '召唤物').trim() || '召唤物';
      const 数量 = Math.max(1, Number(effect.数量 || 1));
      const 持续回合 = Number(effect.持续回合 || 0);
      const 单位类型 = String(effect.召唤单位类型 || '魂兽').trim() || '魂兽';
      const 继承比例 = 召唤生成使用继承属性比例_V1(effect) ? 读取召唤生成平均继承比例_V1(effect) : 0;
      const 强度 = !召唤生成使用继承属性比例_V1(effect) ? Number(effect.强度 || 0) : 0;
      products.push(`${单位类型}【${名称}】×${数量}${持续回合 > 0 ? `，持续${持续回合}回合` : ''}${继承比例 > 0 ? `，继承约${Math.round(继承比例 * 100)}%属性` : ''}${强度 > 0 ? `，强度约${formatSkillNumber(强度)}` : ''}`);
    }
    技能执行嵌套效果数组字段表_V1.forEach(key => {
      if (Array.isArray(effect[key])) effect[key].forEach(visit);
    });
    if (Array.isArray(effect.条件分支)) {
      effect.条件分支.forEach(branch => {
        技能条件分支效果数组字段表_V1.forEach(key => {
          if (Array.isArray(branch?.[key])) branch[key].forEach(visit);
        });
      });
    }
  };
  effects.forEach(visit);
  return Array.from(new Set(products)).slice(0, 4).join('；');
}

function getSkillAttributeGateGuideText() {
  return '技能只写本招实际调用到的属性与演化；元素系技能必须从武魂可调用元素中调用，未手动指定时默认调用全部可调用元素；高阶属性表现优先遵守“可调用元素 + 魂力/精神力负荷”双门槛，不直接写死等级线；五行相关必须先集齐金木水火土后才可写五行剥离/五行遁法；元素融合的基础源属性为水/火/风/土，四基础元素齐备可导向元素剥离，雷若出现只能作为四元素归元后的法则性显化；水火风土光暗空间齐备时才可导向七元素爆裂';
}

function compactSkillHintText(text = '', maxLen = 72) {
  const raw = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw) return '';
  if (raw.length <= maxLen) return raw;
  return raw.slice(0, maxLen) + '...';
}

function buildSkillProductDescriptionTodoText(packedEffects) {
  const productText = compactSkillHintText(buildSkillProductReferenceText(packedEffects), 96);
  if (!productText) return '';
  return `待补全（产物摘要：${productText}；只写生成物/食物/召唤物/场地实体的外观、质感、用途和可辨识特征，不写技能机制结算）`;
}

function buildTemporaryConstructDurationTicks(grade, ringIndex) {
  const baseMap = { C: 96, B: 144, A: 288, S: 432 };
  return (baseMap[grade] || 144) + Math.max(0, Number(ringIndex || 1) - 1) * 24;
}

function buildTemporaryConstructUsageText(usageEffects) {
  const list = Array.isArray(usageEffects) ? usageEffects : [];
  if (!list.length) return '';
  const hasPackedEffects = list.some(
    effect => effect && typeof effect === 'object' && String(effect.原型 || '').trim(),
  );
  if (hasPackedEffects) {
    const effectText = buildSkillEffectReferenceText(list);
    return effectText;
  }
  const simpleSegments = list.map(effect => String(effect?.description || '').trim()).filter(Boolean);
  return simpleSegments.length ? simpleSegments.slice(0, 3).join('；') : '';
}

function buildTemporaryConstructDescription(itemName, usageEffects, ttl, options = {}) {
  const typeText = String(options.type || '');
  const isFood = typeText === '食物' || typeText === '食物系';
  const effectText = buildTemporaryConstructUsageText(usageEffects);
  const triggerText = '使用';
  let text = '【' + itemName + '】。';
  if (effectText && effectText !== '无') {
    text += triggerText + '后效果：' + effectText.replace(/。$/, '') + '。';
  } else {
    text += triggerText + '后会触发对应魂技效果。';
  }
  return text;
}

function hydrateSkillTextByPackedEffects(skill) {
  if (!skill || !Array.isArray(skill._效果数组) || skill._效果数组.length === 0) return skill;
  清理技能效果数组AI文本字段_V1(skill._效果数组);
  const 是造物承载技能 = String(skill.承载方式 || '').trim() === '造物承载' || 是造物承载效果数组_V1(skill._效果数组);
  if (!是造物承载技能) {
    delete skill.产物描述;
    return skill;
  }
  if (
    typeof skill.产物描述 !== 'string' ||
    !skill.产物描述.trim() ||
    skill.产物描述 === '无' ||
    isSkillTodoText(skill.产物描述)
  ) {
    const productTodo = buildSkillProductDescriptionTodoText(skill._效果数组);
    if (productTodo) skill.产物描述 = productTodo;
  }
  return skill;
}

var SKILL_SECONDARY_MECHANIC_TYPES_V1 = {
  伤害附加: ['穿透', '伤害吸收', '斩杀补伤', '流血DOT', '追击', '反击', '引爆持续伤害', '斩盾', '吞噬'],
  控制附加: ['打断', '沉默', '减速', '致盲', '迟缓', '禁疗', '封技'],
  防御附加: ['小护盾', '短减伤', '反伤', '霸体短附加', '护卫', '嘲讽', '无敌金身', '伤害反射', '伤害转移', '伤害分摊', '消耗分摊'],
  回复附加: ['魂力恢复', '精神恢复', '净化', '解控', '驱散增益', '护卫', '治疗反转', '能力共享'],
  情报附加: ['标记弱点', '共享视野', '目标锁定', '感知干扰', '认知扭曲', '破隐'],
  特殊附加: ['窃取增益', '隐身', '嘲讽', '护卫', '状态转移', '吞噬', '能力共享', '机制抹消'],
  代价附加: ['自损', '异常耗蓝', '随机副作用'],
};

var NUMERIC_STAT_BONUS_KEYS = ['力量', '防御', '敏捷', '体力上限', '精神力上限', '魂力上限'];

function normalizeDiscreteStatBonusInteger(value = 0) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric > 0) return Math.floor(numeric);
  if (numeric < 0) return Math.ceil(numeric);
  return 0;
}

function createNumericStatBonusMap(seed = {}) {
  const source = seed && typeof seed === 'object' ? seed : {};
  return {
    力量: normalizeDiscreteStatBonusInteger(source.力量),
    防御: normalizeDiscreteStatBonusInteger(source.防御),
    敏捷: normalizeDiscreteStatBonusInteger(source.敏捷),
    体力上限: normalizeDiscreteStatBonusInteger(source.体力上限),
    精神力上限: normalizeDiscreteStatBonusInteger(source.精神力上限),
    魂力上限: normalizeDiscreteStatBonusInteger(source.魂力上限),
  };
}

function createExtendedStatBonusMap(seed = {}) {
  return {
    ...createNumericStatBonusMap(seed),
    魂力上限: normalizeDiscreteStatBonusInteger(seed && seed.魂力上限),
  };
}

function addNumericStatBonusValue(bonusMap = {}, statKey = '', delta = 0) {
  if (!NUMERIC_STAT_BONUS_KEYS.includes(statKey)) return 0;
  const total = Number((bonusMap && bonusMap[statKey]) || 0) + Number(delta || 0);
  if (!Number.isFinite(total)) return Number((bonusMap && bonusMap[statKey]) || 0);
  bonusMap[statKey] = normalizeDiscreteStatBonusInteger(total);
  return bonusMap[statKey];
}

function addNumericStatBonusEntries(bonusMap = {}, deltaMap = {}) {
  Object.entries(deltaMap || {}).forEach(([statKey, delta]) => {
    addNumericStatBonusValue(bonusMap, statKey, delta);
  });
}

function ensureNumericStatBonusMap(target = {}, fieldName = '') {
  const normalized = createNumericStatBonusMap(fieldName ? target?.[fieldName] : target);
  if (fieldName) {
    target[fieldName] = normalized;
    return target[fieldName];
  }
  Object.assign(target, normalized);
  return target;
}

var 武魂相关度基础待补全提示词 = '待补全(请根据双方武魂系别/属性体系与剧情协同填写0-100基础分，通常为0)';

function 计算武魂相关度关系加成(好感度 = 0) {
  const 安全好感度 = Number(好感度 || 0);
  if (!Number.isFinite(安全好感度)) return 0;
  return Math.max(0, Math.min(20, Math.floor(Math.max(0, 安全好感度) / 10)));
}

function 读取武魂相关度基础值(关系数据 = {}) {
  const 原值 = Number(关系数据?.武魂相关度基础);
  if (!Number.isFinite(原值)) return null;
  return Math.max(0, Math.min(100, Math.floor(原值)));
}

function 规范武魂相关度基础字段(关系数据 = {}) {
  if (!关系数据 || typeof 关系数据 !== 'object') return;
  const 基础值 = 读取武魂相关度基础值(关系数据);
  关系数据.武魂相关度基础 = 基础值 == null ? 武魂相关度基础待补全提示词 : 基础值;
  delete 关系数据.武魂相关度关系加成;
  delete 关系数据.武魂相关度总分;
  delete 关系数据.武魂相关度状态;
  delete 关系数据.武魂相关度说明;
  delete 关系数据.武魂相关度更新时间tick;
}

function 计算武魂相关度总分(关系数据 = {}) {
  const 基础值 = 读取武魂相关度基础值(关系数据);
  const 关系加成 = 计算武魂相关度关系加成(关系数据?.好感度);
  const 原始总分 = (基础值 == null ? 0 : 基础值) + 关系加成;
  return Math.max(0, Math.min(100, Math.floor(原始总分)));
}

function 构建默认社交关系数据() {
  return {
    关系: '陌生',
    好感度: 0,
    对方身份: '无',
    武魂相关度基础: 武魂相关度基础待补全提示词,
  };
}

function buildNumericStatBonusSummary(bonusMap = {}) {
  const labels = {
    力量: '力量',
    防御: '防御',
    敏捷: '敏捷',
    体力上限: '体力上限',
    精神力上限: '精神力上限',
    魂力上限: '魂力上限',
  };
  const segments = [];
  Object.entries(createExtendedStatBonusMap(bonusMap)).forEach(([key, value]) => {
    const amount = Math.floor(Number(value || 0));
    if (amount > 0 && labels[key]) segments.push(`${labels[key]}+${amount}`);
  });
  return segments.join('，') || '无';
}

function getPersistentSoulPowerBonusFromPermanentRecords(char = {}) {
  return Object.values(char?.血脉之力?.永久加成 || {}).reduce(
    (total, record) => total + normalizeDiscreteStatBonusInteger(record?.属性加成?.魂力上限),
    0,
  );
}

function 读取深渊帝君百级侧重点_V1(char = {}, 角色名 = '') {
  const 识别文本 = [
    角色名,
    char?.name,
    char?.base?.name,
    char?.属性?.姓名,
    char?.属性?.背景,
    char?.社交?.主身份,
    char?.第1武魂?.表象名称,
    char?.第1武魂?.属性体系,
    char?.第1武魂?.描述,
    char?.血脉之力?.血脉,
  ].map(值 => String(值 || '').trim()).filter(Boolean).join('|');
  if (!识别文本.includes('深渊')) return {};
  return {
    精神力上限: /灵帝|深渊灵龙|深渊灵族帝君/.test(识别文本),
    魂力上限: /烈帝/.test(识别文本),
    体力上限: /魔帝|深渊魔傀/.test(识别文本),
  };
}

function isNoSoulPowerTalentTier(talentTier = '') {
  return String(talentTier || '').trim() === '天赋极差';
}

var TOP_TALENT_LATE_BLOOM_THRESHOLD_ACU = 1.03;
var TOP_TALENT_LATE_BLOOM_GROWTH_MULTIPLIER_ACU = 1.0;
var TOP_TALENT_LATE_BLOOM_STAGE3_CHANCE_MULTIPLIER_ACU = 1.0;
var TOP_TALENT_LATE_BLOOM_STAGE3_BOTTLENECK_MULTIPLIER_ACU = 2.45;
var GOOD_TALENT_LATE_BLOOM_THRESHOLD_ACU = 1.0456;
var GOOD_TALENT_LATE_BLOOM_GROWTH_MULTIPLIER_ACU = 1.0;
var GOOD_TALENT_LATE_BLOOM_STAGE12_CHANCE_MULTIPLIER_ACU = 1.0;
var GOOD_TALENT_LATE_BLOOM_STAGE1_BOTTLENECK_MULTIPLIER_ACU = 2.45;
var GOOD_TALENT_LATE_BLOOM_STAGE2_BOTTLENECK_MULTIPLIER_ACU = 2.45;
var GOOD_TALENT_STAGE1_GROWTH_MULTIPLIER_ACU = 1.0;
var GOOD_TALENT_STAGE2_GROWTH_MULTIPLIER_ACU = 1.0;
var GOOD_TALENT_STAGE3_GROWTH_MULTIPLIER_ACU = 1.0;
var GOOD_TALENT_LATE_BLOOM_START_AGE_ACU = 33;
var 正式修炼天赋魂核倍率表 = Object.freeze({
  劣等: Object.freeze([0.45, 0.02, 0.01, 0.01]),
  正常: Object.freeze([0.88, 0.03, 0.02, 0.01]),
  优秀: Object.freeze([1.10, 1.85, 0.08, 0.04]),
  天才: Object.freeze([0.95, 1.08, 6.10, 0.80]),
  顶级天才: Object.freeze([1.05, 0.50, 18.00, 160.00]),
  绝世妖孽: Object.freeze([1.15, 0.68, 30.00, 180.00]),
});

function 获取早期有效修炼天赋(年龄 = 0, 天赋梯队 = '') {
  const 年龄值 = Math.max(0, Number(年龄 || 0));
  const 天赋 = String(天赋梯队 || '').trim();
  if (年龄值 < 15 && ['天才', '顶级天才', '绝世妖孽'].includes(天赋)) return '天才';
  if (年龄值 < 20 && ['顶级天才', '绝世妖孽'].includes(天赋)) return '顶级天才';
  return 天赋 || '正常';
}

function 获取正式修炼魂核倍率(角色 = {}) {
  const 年龄 = Number(角色?.属性?.年龄 || 0);
  const 有效天赋 = 获取早期有效修炼天赋(年龄, 角色?.属性?.天赋梯队);
  const 魂核数 = Math.max(0, Math.min(3, Math.floor(Number(角色?.魂核?.核心?.数量 || 0))));
  const 倍率表 = 正式修炼天赋魂核倍率表[有效天赋] || 正式修炼天赋魂核倍率表.正常;
  return Math.max(0, Number(倍率表[魂核数] || 0));
}

function 解析生日年内日序(生日 = '') {
  const 文本 = String(生日 || '').trim();
  if (!文本 || 文本 === '待生成') return null;
  const 匹配 = 文本.match(/^(\d{1,2})\s*月\s*(\d{1,2})\s*日?$/) || 文本.match(/^(\d{1,2})\s*[-/.]\s*(\d{1,2})$/);
  if (!匹配) return null;
  const 月 = Math.max(1, Math.min(12, Math.floor(Number(匹配[1]) || 1)));
  const 日 = Math.max(1, Math.min(30, Math.floor(Number(匹配[2]) || 1)));
  return (月 - 1) * 30 + (日 - 1);
}

function 计算tick年内日序(tick = 0) {
  const 总天数 = Math.floor(Math.max(0, Number(tick || 0)) / 144);
  return ((总天数 % 360) + 360) % 360;
}

function 计算生日有效年龄(年龄 = 0, 生日 = '', 当前tick = null) {
  const 基础年龄 = Math.max(0, Number(年龄 || 0));
  if (当前tick === null || 当前tick === undefined) return 基础年龄;
  const 生日序 = 解析生日年内日序(生日);
  if (生日序 === null) return 基础年龄;
  const 当前序 = 计算tick年内日序(当前tick);
  const 距上次生日天数 = (当前序 - 生日序 + 360) % 360;
  return 基础年龄 + 距上次生日天数 / 360;
}

function 需要初始化生日(生日 = '') {
  const 文本 = String(生日 || '').trim();
  return !文本 || 文本 === '待生成' || isAiTodoText(文本);
}

function 随机生成生日() {
  const 月 = 1 + Math.floor(Math.random() * 12);
  const 日 = 1 + Math.floor(Math.random() * 30);
  return `${月}月${日}日`;
}

function 规避魂环门槛等级(等级 = 1) {
  const 等级值 = Number(等级 || 1);
  if (等级值 >= 99.5) return 99.5;
  if (Number.isInteger(等级值) && 等级值 >= 20 && 等级值 <= 90 && 等级值 % 10 === 0) {
    return 等级值 + 1;
  }
  return 等级值;
}

function 计算初始化修为等级(天赋梯队 = '正常', 年龄 = 6, 底子波动 = 1, 生日 = '', 当前tick = null, 时代 = '') {
  const 年龄值 = 计算生日有效年龄(年龄, 生日, 当前tick);
  const 运行时 = 读取时代修炼运行时_V1();
  if (!运行时 || typeof 运行时.estimateInitialLevel !== 'function') throw new Error('四时代修炼初始化接口未就绪');
  const 估算等级 = Number(运行时.estimateInitialLevel({
    talent: String(天赋梯队 || '').trim() || '正常',
    age: 年龄值,
    baseVariation: Math.max(0.95, Math.min(1.05, Number(底子波动 || 1))),
    ...(当前tick === null || 当前tick === undefined ? {} : { currentTick: 当前tick }),
    ...(时代 ? { era: 时代 } : {}),
  }));
  if (!Number.isFinite(估算等级)) throw new Error('四时代修炼初始化计算返回无效等级');
  if (估算等级 <= 0) return 0;
  const 结果 = 估算等级 >= 99.5 ? 99.5 : Math.floor(估算等级);
  return Math.max(1, 规避魂环门槛等级(结果));
}

function 计算开场初始化修为等级_V1(选项 = {}) {
  const 参数 = 选项 && typeof 选项 === 'object' ? 选项 : {};
  return 计算初始化修为等级(
    参数.天赋梯队 || '正常',
    参数.年龄 === undefined ? 6 : 参数.年龄,
    参数.底子波动 === undefined ? 1 : 参数.底子波动,
    参数.生日 || '',
    参数.当前tick ?? null,
    参数.时代 || '',
  );
}
function isTopTalentLateBloom_ACU(char = {}) {
  return (
    String(char?.属性?.天赋梯队 || '').trim() === '顶级天才' &&
    Number(char?.属性?.底子波动 || 0) >= TOP_TALENT_LATE_BLOOM_THRESHOLD_ACU
  );
}

function isGoodTalentLateBloom_ACU(char = {}) {
  return (
    String(char?.属性?.天赋梯队 || '').trim() === '优秀' &&
    Number(char?.属性?.底子波动 || 0) >= GOOD_TALENT_LATE_BLOOM_THRESHOLD_ACU
  );
}

function getSpiritHerbSoulPowerGain_ACU(age = 0) {
  return Math.max(10, Math.floor(Math.max(0, Number(age || 0)) * 0.1));
}

function getUpgradedTalentTier_ACU(currentTier = '') {
  const talentOrder = ['天赋极差', '劣等', '正常', '优秀', '天才', '顶级天才', '绝世妖孽'];
  const normalizedTier = String(currentTier || '').trim();
  const index = talentOrder.indexOf(normalizedTier);
  if (index < 0) return normalizedTier || '正常';
  if (index >= talentOrder.length - 1) return talentOrder[index];
  return talentOrder[index + 1];
}

function applyHundredThousandSpiritHerbBonus_ACU(char = {}) {
  if (!char?.属性 || Number(char?.状态?.吸收灵物年限 || 0) < 100000) return [];
  const messages = [];
  const originalHiddenVar = Math.max(0.1, Math.min(1.05, Number(char.属性?.底子波动 || 1)));
  char.属性.底子波动 = Number(Math.min(1.05, originalHiddenVar + 0.03).toFixed(4));
  messages.push(`底子提升至 ${char.属性.底子波动.toFixed(4)}`);

  if (originalHiddenVar > 1.02) {
    const currentTier = String(char.属性?.天赋梯队 || '').trim() || '正常';
    const nextTier = getUpgradedTalentTier_ACU(currentTier);
    if (nextTier && nextTier !== currentTier) {
      char.属性.天赋梯队 = nextTier;
      char.属性.底子波动 = Number((0.95 + Math.random() * 0.1).toFixed(4));
      messages.push(`天赋由【${currentTier}】提升为【${nextTier}】`);
      messages.push(`底子波动重抽为 ${char.属性.底子波动.toFixed(4)}`);
    }
  }
  return messages;
}

function getTalentCultivationStopAge_ACU(talentTier = '') {
  return (
    {
      劣等: 40,
      正常: 50,
      优秀: 60,
      天才: 90,
      顶级天才: 100,
      绝世妖孽: 120,
    }[String(talentTier || '').trim()] ?? null
  );
}

function canTalentContinueCultivating_ACU(char = {}) {
  const stopAge = getTalentCultivationStopAge_ACU(char?.属性?.天赋梯队);
  if (!Number.isFinite(Number(stopAge))) return true;
  return Number(char?.属性?.年龄 || 0) < Number(stopAge);
}

function normalizeNoSoulPowerCharacterData(char = {}) {
  if (!char || typeof char !== 'object') return char;
  if (是否已有明确魂师数据_V1(char)) return char;
  if (!char.属性 || typeof char.属性 !== 'object') char.属性 = {};
  if (!char.装备 || typeof char.装备 !== 'object') char.装备 = {};
  if (!char.装备.斗铠 || typeof char.装备.斗铠 !== 'object') char.装备.斗铠 = {};
  if (!char.装备.机甲 || typeof char.装备.机甲 !== 'object') char.装备.机甲 = {};
  if (!char.装备.武器 || typeof char.装备.武器 !== 'object') char.装备.武器 = {};
  if (!char.装备.防具 || typeof char.装备.防具 !== 'object') char.装备.防具 = {};
  if (!char.装备.魂导器 || typeof char.装备.魂导器 !== 'object') char.装备.魂导器 = { 装配: 创建空魂导器装配表_V1() };

  char.属性.等级 = 0;
  char.属性.等级惩罚 = 0;
  char.属性.魂力 = 0;
  char.属性.魂力上限 = 0;
  char.属性.精神境界 = '无';
  char.属性.上次灵物等级 = -20;

  if (char.状态 && typeof char.状态 === 'object') delete char.状态.待选魂环;

  取角色武魂条目_V1(char).forEach(([spiritKey]) => { delete char[spiritKey]; });
  delete char.武魂;

  char.魂核 = {};
  char.魂骨 = {};
  char.武魂融合技 = {};
  char.魂灵塔记录 = {};
  char.自创魂技 = {};

  if (char.血脉之力 && typeof char.血脉之力 === 'object') {
    char.血脉之力.核心 = '未凝聚';
    char.血脉之力.解封层数 = 0;
    char.血脉之力.技能 = {};
    char.血脉之力.被动 = {};
    Object.keys(char.血脉之力).forEach(键 => {
      if (是气血魂环槽位键_V1(键)) delete char.血脉之力[键];
    });
  }

  return char;
}

function getDualSpiritSoulPowerCoeff(char = {}) {
  const spiritEntries = 取角色武魂条目_V1(char);
  return spiritEntries.length >= 2 ? 1.2 : 1.0;
}

function normalizeStatHpFields(stat = {}) {
  if (!stat || typeof stat !== 'object') return { HP: 0, HP上限: 1 };
  const hpMaxFallback = Math.max(1, Number(stat.体力上限 || 1));
  const hpMax = Math.max(1, Number.isFinite(Number(stat.HP上限)) ? Number(stat.HP上限) : hpMaxFallback);
  const hpFallback = Number.isFinite(Number(stat.体力)) ? Number(stat.体力) : hpMax;
  const hp = Math.max(0, Math.min(hpMax, Number.isFinite(Number(stat.HP)) ? Number(stat.HP) : hpFallback));
  stat.HP上限 = hpMax;
  stat.HP = hp;
  return { HP: hp, HP上限: hpMax };
}

function getComputedWoundLevelFromStat(stat = {}) {
  const { HP, HP上限 } = normalizeStatHpFields(stat);
  const ratio = HP / Math.max(1, HP上限);
  if (ratio <= 0.05 && HP > 0) return '濒死';
  if (ratio <= 0.2) return '重伤';
  if (ratio <= 0.5) return '轻伤';
  return '无';
}

function getComputedWoundRecoveryRatioFromStat(stat = {}) {
  const woundLevel = getComputedWoundLevelFromStat(stat);
  if (woundLevel === '轻伤') return 0.7;
  if (woundLevel === '重伤') return 0.3;
  if (woundLevel === '濒死') return 0.05;
  return 1.0;
}

function getComputedFatiguePenaltyMultiplierFromStat(stat = {}) {
  const vitMax = Math.max(1, Number(stat?.体力上限 || 1));
  const vit = Math.max(0, Math.min(vitMax, Number(stat?.体力 || 0)));
  const ratio = vit / vitMax;
  if (ratio > 0.5) return 1.0;
  if (ratio > 0.3) return 0.9;
  if (ratio > 0.1) return 0.7;
  return 0.5;
}

var 金龙王全属性永久成长比例_V1 = Object.freeze({
  力量: 0.05,
  防御: 0.05,
  敏捷: 0.05,
  体力上限: 0.05,
  精神力上限: 0.05,
  魂力上限: 0.05,
});

var 金龙王层级名称表_V1 = Object.freeze({
  1: '【1层·金龙爪(右)】',
  2: '【2层·黄金龙体】',
  3: '【3层·血脉反哺(一)】',
  4: '【4层·金龙霸体】',
  5: '【5层·金龙爪(左)】',
  6: '【6层·黄金龙吼】',
  7: '【7层·血脉反哺(二)】',
  8: '【8层·金龙狂暴领域】',
  9: '【9层·气血漩涡(被动)】',
  10: '【10层·金龙震爆】',
  11: '【11层·龙罡与龙威(被动)】',
  12: '【12层·金龙镇狱杀】',
  13: '【13层·血脉反哺(三)】',
  14: '【14层·金龙不灭真身】',
  15: '【15层·血脉反哺(四)】',
  16: '【16层·黄金瀑布】',
});

var GOLDEN_DRAGON_PERMANENT_BONUS_NODES = Object.freeze(Object.fromEntries(
  Object.entries(金龙王层级名称表_V1).map(([层级, 名称]) => [
    层级,
    Object.freeze({
      名称: `${名称}·永久成长`,
      描述: '解封时按当前力量、防御、敏捷、体力上限、精神力上限、魂力上限各固化5%永久成长。',
      百分比: 金龙王全属性永久成长比例_V1,
    }),
  ]),
));

var GOLDEN_DRAGON_NON_SKILL_NODE_NAMES = new Set(
  Object.entries(GOLDEN_DRAGON_PERMANENT_BONUS_NODES)
    .filter(([seal]) => [3, 7, 13, 15].includes(Number(seal)))
    .map(([, node]) => node?.名称)
    .filter(Boolean),
);

function applyGoldenDragonPermanentBonusNodes(char, currentStats = {}) {
  if (!char?.血脉之力 || !String(char.血脉之力.血脉 || '').includes('金龙王'))
    return createExtendedStatBonusMap();
  if (!char.属性 || typeof char.属性 !== 'object') return createExtendedStatBonusMap();
  if (!char.血脉之力.永久加成 || typeof char.血脉之力.永久加成 !== 'object')
    char.血脉之力.永久加成 = {};
  const trainedBonus = ensureNumericStatBonusMap(char.属性, '训练加成');
  const totalAdded = createExtendedStatBonusMap();
  const virtualStats = createExtendedStatBonusMap(currentStats);
  Object.entries(GOLDEN_DRAGON_PERMANENT_BONUS_NODES)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .forEach(([sealKey, node]) => {
      const sealLv = Number(sealKey || 0);
      if (sealLv <= 0 || sealLv > Number(char.血脉之力?.解封层数 || 0)) return;
      const recordKey = String(node?.名称 || `第${sealLv}层永久成长`);
      if (char.血脉之力.永久加成[recordKey]) return;
      const appliedBonus = createExtendedStatBonusMap();
      Object.entries(node?.百分比 || {}).forEach(([statKey, ratio]) => {
        const gain = Math.max(
          0,
          Math.floor(Math.max(0, Number(virtualStats[statKey] || 0)) * Math.max(0, Number(ratio || 0))),
        );
        appliedBonus[statKey] = gain;
        totalAdded[statKey] += gain;
        if (statKey !== '魂力上限') {
          trainedBonus[statKey] = Number(trainedBonus[statKey] || 0) + gain;
        }
        virtualStats[statKey] = Number(virtualStats[statKey] || 0) + gain;
      });
      const effectText = buildNumericStatBonusSummary(appliedBonus);
      char.血脉之力.永久加成[recordKey] = {
        来源层级: sealLv,
        属性加成: appliedBonus,
        效果描述: effectText === '无' ? String(node?.描述 || '无') : `解封时已按当前属性固化：${effectText}`,
      };
    });
  return totalAdded;
}

var GoldenDragonSkills = {
  1: {
    魂技名: '【1层·金龙爪(右)】',
    画面描述: '右臂化为暗金龙爪，粉碎之力集中于五指，正面捏碎敌方防御。',
    效果描述: '消耗约一成体力，对单体造成重击并穿透防御；若目标带护盾，同步撕裂护盾。',
    消耗: { 体力: 590 },
    前摇: 10,
    _效果数组: [
      { 原型: '伤害结算', 目标: '单体', 生效方式: '独立生效', 威力倍率: 190, 伤害类型: '近身攻击', 防御穿透: 35 },
      { 原型: '护盾变化', 目标: '单体', 生效方式: '跟随主原型', 数值: '-60%', 驱动属性: '体力上限', 影响方向: '效果强度' },
    ],
  },
  2: {
    魂技名: '【2层·黄金龙体】',
    画面描述: '金鳞蔓延，气血透体，肉体强度在短时间内全面拔高。',
    效果描述: '开启后短期强化自身力量与防御，并获得霸体。',
    消耗: { 启动: { 体力: 1800 }, 维持: { 体力: 360 } },
    前摇: 5,
    _效果数组: [
      { 原型: '状态施加', 目标: '自身', 生效方式: '独立生效', 状态: '霸体', 持续回合: 3 },
      { 原型: '属性修正', 目标: '自身', 生效方式: '独立生效', 属性: ['力量', '防御'], 数值: '+30%', 持续回合: 3 },
    ],
  },
  3: null,
  4: {
    魂技名: '【4层·金龙霸体】',
    画面描述: '全身龙鳞瞬间闭合，化作坚不可摧的暗金铠甲硬抗毁灭打击。',
    效果描述: '短期获得霸体、防御翻倍，并将承受伤害的一部分蓄为下次攻击增幅。',
    消耗: { 体力: 5200 },
    前摇: 5,
    _效果数组: [
      { 原型: '状态施加', 目标: '自身', 生效方式: '独立生效', 状态: '霸体', 持续回合: 2 },
      { 原型: '属性修正', 目标: '自身', 生效方式: '独立生效', 属性: '防御', 数值: '+100%', 持续回合: 2 },
      { 原型: '结算修正', 目标: '自身', 生效方式: '独立生效', 结算: '伤害吸收', 数值: '+35%', 吸收来源: '受到伤害', 吸收资源: '体力', 转化效果: '下次造成伤害', 增幅上限: '+50%', 持续回合: 2 },
    ],
  },
  5: {
    魂技名: '【5层·金龙爪(左)】',
    画面描述: '左臂化为撕裂龙爪，双爪交击时迸发破除精神幻境的金色光晕。',
    效果描述: '对单体造成撕裂伤害并施加流血，同时解除自身部分负面状态。',
    消耗: { 体力: 6800 },
    前摇: 10,
    _效果数组: [
      { 原型: '伤害结算', 目标: '单体', 生效方式: '独立生效', 威力倍率: 165, 伤害类型: '近身攻击', 防御穿透: 20 },
      {
        原型: '状态施加',
        目标: '单体',
        生效方式: '跟随主原型',
        状态: '流血',
        数值: '-5%',
        副数值: '+5%',
        持续回合: 3,
        驱动属性: '体力上限',
        影响方向: '效果强度',
      },
      { 原型: '状态移除', 目标: '自身', 生效方式: '独立生效', 状态: '任意负面', 数量: 3 },
    ],
  },
  6: {
    魂技名: '【6层·黄金龙吼】',
    画面描述: '纯正龙吟蕴含至高血脉威压，声浪正面压垮敌方气血与精神。',
    效果描述: '对敌方群体造成精神冲击，降低其主要属性并干扰当前行动。',
    消耗: { 体力: 9000, 精神力: 900 },
    前摇: 10,
    _效果数组: [
      { 原型: '伤害结算', 目标: '群体', 生效方式: '独立生效', 威力倍率: 110, 伤害类型: '精神攻击' },
      { 原型: '属性修正', 目标: '群体', 生效方式: '跟随主原型', 属性: ['力量', '防御', '敏捷'], 数值: '-15%', 持续回合: 2, 驱动属性: '精神力上限', 影响方向: '效果强度' },
      { 原型: '判定修正', 目标: '群体', 生效方式: '跟随主原型', 判定: '反应', 数值: '-35%', 打断效果: true, 驱动属性: '精神力上限', 影响方向: '成功率' },
    ],
  },
  7: null,
  8: {
    魂技名: '【8层·金龙狂暴领域】',
    画面描述: '暗金光环轰然扩散，点燃领域内友军的气血与战意。',
    效果描述: '展开领域，提升友军力量、体力上限与防御。',
    消耗: { 启动: { 体力: 15000 }, 维持: { 体力: 3300 } },
    前摇: 20,
    _效果数组: [
      { 原型: '属性修正', 目标: '群体', 生效方式: '独立生效', 属性: ['力量', '防御', '体力上限'], 数值: '+15%', 持续回合: 5, 驱动属性: '体力上限', 影响方向: '效果强度' },
    ],
  },
  9: {
    魂技名: '【9层·气血漩涡(被动)】',
    画面描述: '胸口凝聚暗金气血漩涡，心脏如战鼓，气血生生不息。',
    效果描述: '被动提升体力上限，并强化体力恢复。',
    消耗: {},
    前摇: 0,
    _效果数组: [
      { 原型: '属性修正', 目标: '自身', 生效方式: '独立生效', 属性: '体力上限', 数值: '+10%' },
      { 原型: '资源变化', 目标: '自身', 生效方式: '独立生效', 资源: '体力', 数值: '+5%', 持续回合: 99 },
    ],
  },
  10: {
    魂技名: '【10层·金龙震爆】',
    画面描述: '凝聚龙核并展开双翼，毁灭气血打入敌人体内，从内部震爆防御。',
    效果描述: '对单体造成高额穿透伤害，并附带一段真实伤害。',
    消耗: { 体力: 36000 },
    前摇: 15,
    _效果数组: [
      { 原型: '伤害结算', 目标: '单体', 生效方式: '独立生效', 威力倍率: 300, 伤害类型: '近身攻击', 防御穿透: 50 },
      { 原型: '伤害结算', 目标: '单体', 生效方式: '跟随主原型', 威力倍率: 80, 伤害类型: '真实攻击' },
    ],
  },
  11: {
    魂技名: '【11层·龙罡与龙威(被动)】',
    画面描述: '体表自然流转暗金龙罡，举手投足散发龙族威压。',
    效果描述: '被动提升自身防御；文本含龙的敌方目标受到龙威压制。',
    消耗: {},
    前摇: 0,
    _效果数组: [
      { 原型: '属性修正', 目标: '自身', 生效方式: '独立生效', 属性: '防御', 数值: '+20%' },
      {
        原型: '属性修正',
        目标: '群体',
        生效方式: '独立生效',
        属性: ['力量', '防御', '敏捷', '体力上限', '精神力上限', '魂力上限'],
        数值: '-10%',
        持续回合: 1,
        条件分支: [{ 条件: [{ 类型: '单位文本', 对象: '目标', 比较: '包含', 值: '龙' }], 处理: '生效' }],
      },
    ],
  },
  12: {
    魂技名: '【12层·金龙镇狱杀】',
    画面描述: '无数暗金巨龙虚影从天而降，化作重力囚笼镇杀整片空间。',
    效果描述: '对敌方群体造成大范围伤害，并以现有控制状态限制行动和闪避。',
    消耗: { 体力: 40000, 精神力: 5000 },
    前摇: 30,
    _效果数组: [
      { 原型: '伤害结算', 目标: '群体', 生效方式: '独立生效', 威力倍率: 250, 伤害类型: '近身攻击', 防御穿透: 30 },
      {
        原型: '状态施加',
        目标: '群体',
        生效方式: '跟随主原型',
        状态: '迟缓',
        持续回合: 1,
        驱动属性: '体力上限',
        影响方向: '效果强度',
      },
      { 原型: '状态施加', 目标: '群体', 生效方式: '跟随主原型', 状态: '眩晕', 持续回合: 1 },
      { 原型: '属性修正', 目标: '群体', 生效方式: '跟随主原型', 属性: '敏捷', 数值: '-80%', 持续回合: 1, 驱动属性: '体力上限', 影响方向: '效果强度' },
    ],
  },
  13: null,
  14: {
    魂技名: '【14层·金龙不灭真身】',
    画面描述: '彻底化身百米纯血暗金巨龙，气血不枯，不死不灭。',
    效果描述: '进入金龙不灭真身，获得多次免死保护并大幅强化造成伤害。',
    消耗: { 启动: { 体力: 30000 }, 维持: { 体力: 6000 } },
    前摇: 20,
    _效果数组: [
      { 原型: '规则防御', 目标: '自身', 生效方式: '独立生效', 规则: '免死', 次数: 5, 持续回合: 5 },
      { 原型: '结算修正', 目标: '自身', 生效方式: '独立生效', 结算: '造成伤害', 数值: '+100%', 持续回合: 5 },
      { 原型: '资源变化', 目标: '自身', 生效方式: '独立生效', 资源: '魂力', 数值: '-100%', 条件分支: [{ 条件: [{ 类型: '生命比例', 对象: '自身', 比较: '<=', 值: '1%' }], 处理: '生效' }] },
      { 原型: '资源变化', 目标: '自身', 生效方式: '独立生效', 资源: '体力', 数值: '+100%', 条件分支: [{ 条件: [{ 类型: '生命比例', 对象: '自身', 比较: '<=', 值: '1%' }], 处理: '生效' }] },
    ],
  },
  15: null,
  16: {
    魂技名: '【16层·黄金瀑布】',
    画面描述: '第八血脉魂环化作液态黄金光辉环绕周身，拥有独立神级灵性，自动护主。',
    效果描述: '被动防御。面临致命攻击或强控时消耗最大体力的一成，抵消该次威胁并提供短期增益。',
    消耗: { 体力: '10%' },
    前摇: 0,
    _效果数组: [
      { 原型: '规则防御', 目标: '自身', 生效方式: '独立生效', 规则: '免伤', 次数: 1, 持续回合: 99, 触发限制: { 周期: '每回合', 次数: 1 } },
      { 原型: '规则防御', 目标: '自身', 生效方式: '独立生效', 规则: '免死', 次数: 1, 持续回合: 99, 触发限制: { 周期: '每回合', 次数: 1 } },
      { 原型: '属性修正', 目标: '自身', 生效方式: '独立生效', 属性: ['防御', '敏捷'], 数值: '+20%', 持续回合: 1, 条件分支: [{ 条件: [{ 类型: '自身状态', 对象: '自身', 比较: '==', 值: '蓄力中' }], 处理: '禁用' }] },
    ],
  },
};

var 金龙王血脉被动层级集合_V1 = new Set([9, 11, 16]);

Object.entries(GoldenDragonSkills).forEach(([层级文本, skill]) => {
  if (skill && Array.isArray(skill._效果数组)) {
    收口技能执行结构_V1(skill, { 目标: '单体', passiveMode: 金龙王血脉被动层级集合_V1.has(Number(层级文本 || 0)) });
  }
});

var 银龙王初始可调用元素_V1 = Object.freeze(['水', '火', '风', '土', '光', '暗', '空间']);
var 银龙王九元素_V1 = Object.freeze([...银龙王初始可调用元素_V1, '创造', '毁灭']);

var 银龙王血脉技能_V1 = {
  '火元素调用·火球': {
    魂技名: '火元素调用·火球',
    画面描述: '火元素在掌心凝聚成炽烈球体，沿锁定轨迹爆发。',
    效果描述: '调用火元素攻击单体，造成高威力远程攻击伤害。',
    消耗: '魂力:8% | 精神力:4%',
    前摇: 8,
    附带属性: ['火'],
    _效果数组: [
      { 原型: '伤害结算', 目标: '单体', 生效方式: '独立生效', 威力倍率: 150, 伤害类型: '远程攻击' },
    ],
  },
  '水元素调用·水球': {
    魂技名: '水元素调用·水球',
    画面描述: '水元素凝成流动球体，随目标性质转为冲击或滋养。',
    效果描述: '对敌方造成水元素冲击并压低反应；对友方恢复生命与体力。',
    消耗: '魂力:7% | 精神力:5%',
    前摇: 8,
    附带属性: ['水'],
    _效果数组: [
      { 原型: '伤害结算', 目标: '单体', 生效方式: '独立生效', 威力倍率: 110, 伤害类型: '远程攻击', 条件分支: [{ 条件: [{ 类型: '目标', 对象: '目标', 比较: '==', 值: '敌方' }], 处理: '生效' }] },
      { 原型: '判定修正', 目标: '单体', 生效方式: '跟随主原型', 判定: '反应', 数值: '-12%', 持续回合: 2, 条件分支: [{ 条件: [{ 类型: '目标', 对象: '目标', 比较: '==', 值: '敌方' }], 处理: '生效' }] },
      { 原型: '资源变化', 目标: '单体', 生效方式: '独立生效', 资源: ['生命', '体力'], 数值: '+12%', 条件分支: [{ 条件: [{ 类型: '目标', 对象: '目标', 比较: '==', 值: '己方' }], 处理: '生效' }] },
    ],
  },
  '风元素调用·切割': {
    魂技名: '风元素调用·切割',
    画面描述: '风线压缩成锋刃，瞬间掠过目标要害。',
    效果描述: '低前摇单体切割，命中稳定并造成多段远程攻击伤害。',
    消耗: '魂力:6% | 精神力:4%',
    前摇: 5,
    附带属性: ['风'],
    _效果数组: [
      { 原型: '伤害结算', 目标: '单体', 生效方式: '独立生效', 威力倍率: 80, 攻击段数: 2, 伤害类型: '远程攻击' },
      { 原型: '判定修正', 目标: '自身', 生效方式: '独立生效', 判定: '命中', 数值: '+10%', 持续回合: 1 },
    ],
  },
  '土元素调用·岩盾': {
    魂技名: '土元素调用·岩盾',
    画面描述: '土元素隆起为厚重岩盾，并可牵制敌方脚下地面。',
    效果描述: '为友方生成护盾；对敌方施加短暂迟缓。',
    消耗: '魂力:7% | 精神力:4%',
    前摇: 8,
    附带属性: ['土'],
    _效果数组: [
      { 原型: '护盾变化', 目标: '单体', 生效方式: '独立生效', 护盾模式: '正向护盾', 数值: '+18%', 条件分支: [{ 条件: [{ 类型: '目标', 对象: '目标', 比较: '==', 值: '己方' }], 处理: '生效' }] },
      { 原型: '状态施加', 目标: '单体', 生效方式: '独立生效', 状态: '迟缓', 持续回合: 1, 条件分支: [{ 条件: [{ 类型: '目标', 对象: '目标', 比较: '==', 值: '敌方' }], 处理: '生效' }] },
    ],
  },
  '光元素调用·生命共享': {
    魂技名: '光元素调用·生命共享',
    画面描述: '光元素牵引生命力，从自身流向被指定的友方。',
    效果描述: '将自身生命力转移给单体友方。',
    消耗: '魂力:6% | 精神力:8%',
    前摇: 8,
    附带属性: ['光'],
    _效果数组: [
      { 原型: '资源转移', 目标: '单体', 生效方式: '独立生效', 资源: '生命', 资源转移方式: '转移', 数值: '+15%', 转化比例: 1 },
    ],
  },
  '暗元素调用·暗蚀': {
    魂技名: '暗元素调用·暗蚀',
    画面描述: '暗元素渗入目标感知与防护缝隙，持续侵蚀其判断。',
    效果描述: '降低目标命中、反应与精神抗性。',
    消耗: '魂力:6% | 精神力:7%',
    前摇: 8,
    附带属性: ['暗'],
    _效果数组: [
      { 原型: '判定修正', 目标: '单体', 生效方式: '独立生效', 判定: '命中', 数值: '-12%', 持续回合: 2 },
      { 原型: '判定修正', 目标: '单体', 生效方式: '独立生效', 判定: '反应', 数值: '-12%', 持续回合: 2 },
      { 原型: '结算修正', 目标: '单体', 生效方式: '独立生效', 结算: '精神抗性剥夺', 数值: '+12%', 持续回合: 2 },
    ],
  },
  '空间元素调用·瞬移': {
    魂技名: '空间元素调用·瞬移',
    画面描述: '空间折叠成短距通道，将自身或友方瞬间送离原位。',
    效果描述: '瞬移自身，降低下次行动前摇并提高闪避。',
    消耗: '魂力:8% | 精神力:8%',
    前摇: 3,
    附带属性: ['空间'],
    _效果数组: [
      { 原型: '位移执行', 目标: '自身', 生效方式: '独立生效', 位移类型: '瞬移', 位移对象: '自身', 距离: 12 },
      { 原型: '结算修正', 目标: '自身', 生效方式: '独立生效', 结算: '前摇', 数值: '-20%', 持续回合: 1 },
      { 原型: '判定修正', 目标: '自身', 生效方式: '独立生效', 判定: '闪避', 数值: '+15%', 持续回合: 1 },
    ],
  },
  '水火交融': {
    魂技名: '水火交融',
    画面描述: '水火互逆交叠，冷热冲击在目标周围炸开。',
    效果描述: '双元素冷热冲击，造成四环水平伤害并降低反应。',
    消耗: '魂力:20% | 精神力:20%',
    前摇: 12,
    附带属性: ['水', '火'],
    _效果数组: [
      { 原型: '伤害结算', 目标: '群体', 生效方式: '独立生效', 威力倍率: 210, 伤害类型: '远程攻击' },
      { 原型: '判定修正', 目标: '群体', 生效方式: '跟随主原型', 判定: '反应', 数值: '-18%', 持续回合: 2 },
    ],
  },
  '四元素风暴': {
    魂技名: '四元素风暴',
    画面描述: '水火风土四基础元素互相牵引，化作覆盖战场的复合风暴。',
    效果描述: '四元素群体压制，造成六环水平伤害并附带迟缓。',
    消耗: '魂力:25% | 精神力:25%',
    前摇: 30,
    附带属性: ['水', '火', '风', '土'],
    _效果数组: [
      { 原型: '伤害结算', 目标: '群体', 生效方式: '独立生效', 威力倍率: 430, 伤害类型: '远程攻击' },
      { 原型: '判定修正', 目标: '群体', 生效方式: '跟随主原型', 判定: '反应', 数值: '-25%', 持续回合: 2 },
      { 原型: '状态施加', 目标: '群体', 生效方式: '跟随主原型', 状态: '迟缓', 持续回合: 1 },
    ],
  },
  '五元素空间裂变': {
    魂技名: '五元素空间裂变',
    画面描述: '四元素风暴被空间权柄切开，敌方阵形被错位撕裂。',
    效果描述: '高阶群体控场，造成空间错位与防御压制。',
    消耗: '魂力:30% | 精神力:30%',
    前摇: 35,
    附带属性: ['水', '火', '风', '土', '空间'],
    _效果数组: [
      { 原型: '伤害结算', 目标: '群体', 生效方式: '独立生效', 威力倍率: 620, 伤害类型: '远程攻击', 防御穿透: 20 },
      { 原型: '状态施加', 目标: '群体', 生效方式: '跟随主原型', 状态: '迟缓', 持续回合: 2 },
      { 原型: '结算修正', 目标: '群体', 生效方式: '跟随主原型', 结算: '防御剥夺', 数值: '+15%', 持续回合: 2 },
    ],
  },
  '光暗轮转': {
    魂技名: '光暗轮转',
    画面描述: '光与暗在目标周身轮转，友方得以回稳，敌方遭受逆转压制。',
    效果描述: '对友方恢复并净化；对敌方削弱并治疗反转。',
    消耗: '魂力:18% | 精神力:18%',
    前摇: 15,
    附带属性: ['光', '暗'],
    _效果数组: [
      { 原型: '资源变化', 目标: '群体', 生效方式: '独立生效', 资源: ['生命', '体力'], 数值: '+18%', 条件分支: [{ 条件: [{ 类型: '目标', 对象: '目标', 比较: '==', 值: '己方' }], 处理: '生效' }] },
      { 原型: '状态移除', 目标: '群体', 生效方式: '独立生效', 状态: '任意负面', 数量: 2, 条件分支: [{ 条件: [{ 类型: '目标', 对象: '目标', 比较: '==', 值: '己方' }], 处理: '生效' }] },
      { 原型: '状态施加', 目标: '群体', 生效方式: '独立生效', 状态: '治疗反转', 持续回合: 2, 条件分支: [{ 条件: [{ 类型: '目标', 对象: '目标', 比较: '==', 值: '敌方' }], 处理: '生效' }] },
      { 原型: '结算修正', 目标: '群体', 生效方式: '独立生效', 结算: '精神抗性剥夺', 数值: '+15%', 持续回合: 2, 条件分支: [{ 条件: [{ 类型: '目标', 对象: '目标', 比较: '==', 值: '敌方' }], 处理: '生效' }] },
    ],
  },
  '元素剥离': {
    魂技名: '元素剥离',
    画面描述: '银色法则扫过全场，将元素调用从战场结构中强行剥离。',
    效果描述: '前摇三回合后剥离全场元素调用五回合。',
    消耗: '魂力:15% | 精神力:15%',
    前摇: 30,
    附带属性: [...银龙王初始可调用元素_V1],
    _效果数组: [
      { 原型: '状态施加', 目标: '全场', 生效方式: '独立生效', 状态: '封技', 持续回合: 5, 驱动属性: '精神力上限', 影响方向: '效果强度' },
      { 原型: '结算修正', 目标: '全场', 生效方式: '独立生效', 结算: '技能效果', 数值: '-60%', 限定元素: '元素类', 持续回合: 5 },
    ],
  },
  '七元素爆裂': {
    魂技名: '七元素爆裂',
    画面描述: '七元素在银龙王权柄下压缩为一枚毁灭性核心后轰然爆裂。',
    效果描述: '七元素大范围终结爆发，造成九环水平伤害并压制行动。',
    消耗: '魂力:35% | 精神力:35%',
    前摇: 35,
    附带属性: [...银龙王初始可调用元素_V1],
    _效果数组: [
      { 原型: '伤害结算', 目标: '群体', 生效方式: '独立生效', 威力倍率: 1000, 伤害类型: '远程攻击', 防御穿透: 30 },
      { 原型: '状态施加', 目标: '群体', 生效方式: '跟随主原型', 状态: '眩晕', 持续回合: 1 },
      { 原型: '判定修正', 目标: '群体', 生效方式: '跟随主原型', 判定: '反应', 数值: '-35%', 持续回合: 2 },
    ],
  },
  '宇宙溯源': {
    魂技名: '宇宙溯源',
    画面描述: '九元素沿宇宙初始秩序回流，短暂重构友方状态与上限。',
    效果描述: '120级后可用，群体获得百倍全属性增幅并完全恢复四项资源。',
    消耗: '魂力:1%',
    前摇: 5,
    附带属性: [...银龙王九元素_V1],
    使用条件: { 最低等级: 120 },
    _效果数组: [
      { 原型: '属性修正', 目标: '群体', 生效方式: '独立生效', 属性: ['力量', '防御', '敏捷', '体力上限', '魂力上限', '精神力上限'], 数值: '+10000%', 持续回合: 1, 驱动属性: '魂力上限', 影响方向: '效果强度' },
      { 原型: '资源变化', 目标: '群体', 生效方式: '独立生效', 资源: ['生命', '体力', '魂力', '精神力'], 数值: '+100%', 驱动属性: '魂力上限', 影响方向: '效果强度' },
    ],
  },
};

Object.values(银龙王血脉技能_V1).forEach(skill => {
  if (skill && Array.isArray(skill._效果数组)) 收口技能执行结构_V1(skill, { 目标: '单体' });
});

var 武魂真身基础增幅机制_V1 = Object.freeze(['单属性增益', '多属性增益', '全属性增益']);
var 武魂真身通用增幅机制_V1 = Object.freeze(['威力增幅', '技能效果增幅', '掌控提升', '速度提升']);
var 武魂真身自身辅助增幅机制_V1 = Object.freeze(['技能效果增幅', '多属性增益', '修炼增益']);

function 获取武魂真身增幅机制候选_V1(type = '强攻系', grade = 'B', context = {}) {
  const 系别 = String(type || '强攻系').trim() || '强攻系';
  const 排除原型 = new Set(Array.isArray(context?.排除子原型) ? context.排除子原型.map(项 => String(项 || '').trim()).filter(Boolean) : []);
  let 候选 = [...武魂真身基础增幅机制_V1, ...武魂真身通用增幅机制_V1];
  if (系别 === '敏攻系') 候选.push('速度提升');
  if (['控制系', '精神系', '元素系'].includes(系别)) 候选.push('掌控提升');
  if (系别 === '防御系') 候选 = ['护卫', '承伤修正', '护盾', '免伤', '伤害分摊', '消耗分摊', ...候选];
  if (系别 === '治疗系') 候选 = ['护卫', '持续恢复', '净化/解控', '护盾', '魂力恢复', '精神恢复', ...候选];
  if (['辅助系', '食物系'].includes(系别)) 候选 = [...武魂真身自身辅助增幅机制_V1];
  if (系别 === '食物系') 候选 = ['护卫', '持续恢复', '净化/解控', '护盾', ...候选];
  if (系别 === '召唤系') 候选 = ['技能效果增幅'];
  const 真身预算 = 计算武魂真身预算基准_V1(context?.角色 || context?.施术者 || {}, context?.ringIndex || 7, context);
  const 真身低COST线 = 读取预算评估最低有效COST_V1({ 运转基准: Number(真身预算?.特殊运转基准 || 0) }, context);
  return 规范化机制枚举数组_V1(候选).filter(机制 => {
    if (排除原型.has(String(机制 || '').trim())) return false;
    if (!机制是合法生成主机制_V1(机制, { ...context, type: 系别, 系别, grade, gradeOverride: grade })) return false;
    if (!自动生成机制满足五环恢复增益约束_V1(机制, {
      ...context,
      type: 系别,
      系别,
      grade,
      gradeOverride: grade,
      ringIndex: context?.ringIndex || 7,
      魂环位: context?.ringIndex || 7,
    })) return false;
    const 真身预算上下文 = {
      ...context,
      type: 系别,
      系别,
      grade,
      gradeOverride: grade,
      ringIndex: context?.ringIndex || 7,
      魂环位: context?.ringIndex || 7,
      释放形态: 系别 === '食物系' ? '造物承载' : '直接生效',
      目标: '自身',
    };
    const 范围 = 估算自动生成机制预算范围_V1(机制, 真身预算上下文);
    const 最低COST = Number(范围?.最低可达COST ?? Infinity);
    const 门禁 = 读取自动生成当前最高承载COST_V1(真身预算上下文);
    if (范围?.可用 !== true) return false;
    if (!Number.isFinite(最低COST)) return false;
    if (门禁 > 0 && 最低COST > 门禁 + 技能预算COST容差_V1) return false;
    if (最低COST < 真身低COST线 - 技能预算COST容差_V1) return false;
    return true;
  });
}

function 查找机制大类_V1(机制 = '') {
  const 机制名 = String(机制 || '').trim();
  return (
    Object.keys(SKILL_ARCHETYPE_POOL_V1 || {}).find(大类 =>
      Array.isArray(SKILL_ARCHETYPE_POOL_V1[大类]) && SKILL_ARCHETYPE_POOL_V1[大类].includes(机制名),
    ) || ''
  );
}

function 构建武魂真身消耗文本_V1(type = '强攻系', grade = 'B', ringIndex = 7, delivery = '直接生效', 工具分支 = false) {
  const 系别 = String(type || '强攻系').trim() || '强攻系';
  const 品质基准 = 获取魂技品质消耗基准_V1(grade);
  const 释放倍率 = delivery === '造物承载' ? 0.32 : 0.5;
  const 维持倍率 = delivery === '造物承载' ? 0.1 : 0.16;
  const 工具倍率 = 工具分支 ? 1.18 : 1;
  const 分摊表 = {
    精神主导: { 魂力: 0.3, 精神力: 0.7 },
    附加微量精神力: { 魂力: 0.9, 精神力: 0.1 },
    魂神平摊: { 魂力: 0.5, 精神力: 0.5 },
    纯耗魂力: { 魂力: 1 },
  };
  const 燃料模型 =
    系别 === '精神系' || 系别 === '召唤系'
      ? '精神主导'
      : 系别 === '元素系'
        ? '魂神平摊'
        : ['辅助系', '食物系', '治疗系'].includes(系别)
          ? '附加微量精神力'
          : '纯耗魂力';
  const 构建比例消耗 = 消耗基准 => {
    const 基准 = Math.max(1, Number(消耗基准 || 0));
    return Object.entries(分摊表[燃料模型] || 分摊表.纯耗魂力)
      .map(([资源名, 分摊比例]) => {
        const 百分比 = Math.max(1, Math.round(基准 * Math.max(0, Number(分摊比例 || 0))));
        return `${资源名}:${百分比}%`;
      })
      .join(' | ') || '无';
  };
  const 释放消耗 = 构建比例消耗(Math.max(6, Math.round(品质基准 * 释放倍率 * 工具倍率)));
  const 维持消耗 = 构建比例消耗(Math.max(2, Math.round(品质基准 * 维持倍率 * 工具倍率)));
  return `${释放消耗} 维持:${维持消耗}`;
}

function 放大武魂真身效果倍率_V1(effect = {}, grade = 'B', 工具分支 = false) {
  return effect;
}

function 生成武魂真身基础技能_V1(配置 = {}) {
  const 系别 = String(配置.type || '强攻系').trim() || '强攻系';
  const 机制 = String(配置.archetype || '技能效果增幅').trim() || '技能效果增幅';
  const skill = autoGenerateSkill(
    系别,
    配置.talentTier || '正常',
    Math.max(100, Number(配置.ringAge || 10000)),
    Math.max(1, Number(配置.ringIndex || 7)),
    Math.max(0, Math.min(100, Number(配置.compatibility || 100))),
    [],
    0,
    {
      sourceCategory: '真身生成',
      sourceQuality: String(配置.sourceQuality || '').trim(),
      gradeOverride: String(配置.grade || 配置.sourceQuality || '').trim(),
      textContext: 配置.textContext || {},
      forceTrueBody: false,
      blueprintOverride: {
        主机制大类: 查找机制大类_V1(机制) || '增益类',
        主机制原型: 机制,
        副机制: [],
        释放形态: String(配置.delivery || '直接生效').trim() || '直接生效',
        目标: '自身',
        加成属性候选: Array.isArray(配置.加成属性候选) && 配置.加成属性候选.length ? [...配置.加成属性候选] : undefined,
      },
    },
  );
  return skill;
}

function 食物效果需要制作者自服折损_V1(effect = {}) {
  const 原型 = String(effect?.原型 || '').trim();
  const 正向数值 = 读取技能比例数值_V1(effect.数值) > 0 && !/^-/.test(String(effect.数值 || ''));
  if (!正向数值) return false;
  if (原型 === '资源变化') return ['生命', '体力', '魂力', '精神力'].includes(String(effect?.资源 || '').trim());
  return 原型 === '属性修正';
}

function 读取食物自用恢复上限表_V1(消耗 = '无') {
  const 消耗表 = 读取技能同资源消耗绝对值表_V1(消耗);
  return Object.freeze({
    生命: 0,
    体力: Math.max(0, Number(消耗表.体力 || 0) * 0.95),
    魂力: Math.max(0, Number(消耗表.魂力 || 0) * 0.95),
    精神力: Math.max(0, Number(消耗表.精神力 || 0) * 0.95),
  });
}

function 附加食物制作者自服折损条件分支_V1(effect = {}, 系数 = 0.72, 恢复上限表 = null) {
  if (!effect || typeof effect !== 'object' || !食物效果需要制作者自服折损_V1(effect)) return;
  const 原始数值 = 规范化执行效果数值_V1(effect.数值, effect.动作 || '');
  const 数值 = parseSkillSignedChangeNumber(原始数值);
  if (!Number.isFinite(数值)) return;
  const 资源 = String(effect.资源 || '').trim();
  const 是恢复 = String(effect.原型 || '').trim() === '资源变化' && ['生命', '体力', '魂力', '精神力'].includes(资源);
  const 自服绝对上限 = 是恢复 && 恢复上限表 && Number.isFinite(Number(恢复上限表[资源]))
    ? Math.max(0, Number(恢复上限表[资源]))
    : 0;
  const 折损数值 = 数值 * 系数;
  const 原始是百分比 = /%$/.test(String(原始数值 || '')) || Math.abs(数值) <= 1;
  const 自服数值 = 是恢复 && 自服绝对上限 > 0 && !原始是百分比 ? Math.min(自服绝对上限, 折损数值) : 折损数值;
  const 自服效果 = cloneJsonValue(effect);
  delete 自服效果.条件分支;
  自服效果.数值 = 是恢复 && 自服绝对上限 > 0 && !原始是百分比
    ? formatSkillSignedChangeValue(自服数值, false)
    : formatSkillSignedChangeValue(自服数值, 原始是百分比);
  effect.条件分支 = [
    ...(Array.isArray(effect.条件分支) ? clonePackedSkillEffects(effect.条件分支) : []),
    {
      条件: [{ 类型: '使用者', 对象: '使用者', 比较: '==', 值: '制作者' }],
      处理: '替换效果',
      替换效果: [自服效果],
    },
  ];
}

function 刷新食物制作者自服恢复绝对值_V1(技能 = {}, 上下文 = {}) {
  const 恢复上限表 = 读取食物自用恢复上限表_V1(技能?.消耗 || '无', 上下文);
  const 访问 = 效果 => {
    if (!效果 || typeof 效果 !== 'object' || Array.isArray(效果)) return;
    技能执行嵌套效果数组字段表_V1.forEach(字段名 => (Array.isArray(效果[字段名]) ? 效果[字段名] : []).forEach(访问));
    (Array.isArray(效果.条件分支) ? 效果.条件分支 : []).forEach(分支 => {
      const 是制作者自用 = (Array.isArray(分支?.条件) ? 分支.条件 : []).some(条件 =>
        String(条件?.类型 || '').trim() === '使用者' &&
        String(条件?.对象 || '').trim() === '使用者' &&
        String(条件?.比较 || '').trim() === '==' &&
        String(条件?.值 || '').trim() === '制作者',
      );
      技能条件分支效果数组字段表_V1.forEach(字段名 => {
        (Array.isArray(分支?.[字段名]) ? 分支[字段名] : []).forEach(子效果 => {
          if (
            是制作者自用 &&
            String(子效果?.原型 || '').trim() === '资源变化' &&
            ['生命', '体力', '魂力', '精神力'].includes(String(子效果?.资源 || '').trim())
          ) {
            const 绝对值 = Number(恢复上限表[String(子效果.资源).trim()] || 0);
            const 当前值 = parseSkillSignedChangeNumber(规范化执行效果数值_V1(子效果.数值, 子效果.动作 || ''));
            const 当前是百分比 = /%$/.test(String(子效果.数值 || ''));
            const 自用上限 = Number.isFinite(绝对值) && 绝对值 > 0 ? 绝对值 : 0;
            if (自用上限 > 0 && Number.isFinite(当前值) && 当前值 > 0) {
              const 当前绝对值 = 当前是百分比
                ? 读取直接结算预算资源上限_V1(String(子效果.资源).trim(), 上下文) * 当前值
                : 当前值;
              子效果.数值 = formatSkillSignedChangeValue(Math.min(自用上限, 当前绝对值), false);
            }
          }
          访问(子效果);
        });
      });
    });
  };
  (Array.isArray(技能?._效果数组) ? 技能._效果数组 : []).forEach(访问);
}

function 缩放食物自用替换效果数值_V1(效果数组 = [], 缩放 = 1) {
  (Array.isArray(效果数组) ? 效果数组 : []).forEach(效果 => {
    if (!效果 || typeof 效果 !== 'object' || Array.isArray(效果)) return;
    if (效果.数值 !== undefined) {
      const 文本 = String(效果.数值 ?? '').trim();
      const 数值 = parseSkillSignedChangeNumber(规范化执行效果数值_V1(效果.数值, 效果.动作 || ''));
      if (Number.isFinite(数值) && 数值 > 0) {
        效果.数值 = formatSkillSignedChangeValue(数值 * 缩放, /%$/.test(文本) || Math.abs(数值) <= 1);
        收口正式百分比字段最低值_V1(效果);
      }
    }
    技能执行嵌套效果数组字段表_V1.forEach(字段名 => 缩放食物自用替换效果数值_V1(效果?.[字段名], 缩放));
  });
}

function 收紧食物制作者自服分支COST_V1(技能 = {}, 上下文 = {}) {
  const 访问 = 效果 => {
    if (!效果 || typeof 效果 !== 'object' || Array.isArray(效果)) return;
    技能执行嵌套效果数组字段表_V1.forEach(字段名 => (Array.isArray(效果[字段名]) ? 效果[字段名] : []).forEach(访问));
    (Array.isArray(效果.条件分支) ? 效果.条件分支 : []).forEach(分支 => {
      const 是制作者自用 = (Array.isArray(分支?.条件) ? 分支.条件 : []).some(条件 =>
        String(条件?.类型 || '').trim() === '使用者' &&
        String(条件?.对象 || '').trim() === '使用者' &&
        String(条件?.比较 || '').trim() === '==' &&
        String(条件?.值 || '').trim() === '制作者',
      );
      if (!是制作者自用 || !Array.isArray(分支?.替换效果) || !分支.替换效果.length) return;
      const 他用效果 = cloneJsonValue(效果);
      delete 他用效果.条件分支;
      const 他用COST = Number(计算技能效果累计COST_V1([他用效果], 上下文).净COST || 0);
      let 自用COST = Number(计算技能效果累计COST_V1(分支.替换效果, 上下文).净COST || 0);
      if (!(他用COST > 0 && 自用COST >= 他用COST)) return;
      缩放食物自用替换效果数值_V1(分支.替换效果, Math.max(0.05, Math.min(0.95, 他用COST * 0.72 / Math.max(0.01, 自用COST))));
      自用COST = Number(计算技能效果累计COST_V1(分支.替换效果, 上下文).净COST || 0);
      if (自用COST >= 他用COST) 缩放食物自用替换效果数值_V1(分支.替换效果, 0.5);
    });
  };
  (Array.isArray(技能?._效果数组) ? 技能._效果数组 : []).forEach(访问);
}

function buildSeventhRingTrueBodySkill(
  type = '强攻系',
  talentTier = '正常',
  ringAge = 10000,
  ringIndex = 7,
  compatibility = 100,
  textContext = {},
  sourceQuality = '',
  options = {},
) {
  const gradeInfo = judgeSkillGrade(talentTier, ringAge, ringIndex, compatibility, sourceQuality);
  const grade = normalizeSkillTableGrade(gradeInfo.grade);
  const quality = gradeInfo.quality;
  const 系别 = String(type || '强攻系').trim() || '强攻系';
  const 真身上下文 = {
    ...(options || {}),
    age: ringAge,
    ringAge,
    ringIndex,
    魂环位: ringIndex,
    grade,
    gradeOverride: grade,
    sourceQuality,
    textContext,
    sourceCategory: '真身生成',
    来源: '真身生成',
    来源类别: '真身生成',
  };
  const 排除原型 = new Set(Array.isArray(options?.排除子原型) ? options.排除子原型.map(项 => String(项 || '').trim()).filter(Boolean) : []);
  const 真身机制可用 = 机制 => {
    const 上下文 = { ...真身上下文, type: 系别, 系别, grade };
    return (
      !排除原型.has(机制) &&
      机制是合法生成主机制_V1(机制, 上下文) &&
      机制属于当前系别主候选池_V1(机制, 上下文) &&
      自动生成机制满足五环恢复增益约束_V1(机制, 上下文)
    );
  };
  const 候选 = 获取武魂真身增幅机制候选_V1(系别, grade, 真身上下文)
    .map(机制 => String(机制 || '').trim())
    .filter(机制 => 机制 && !['无', '无效', '未设置'].includes(机制) && 真身机制可用(机制));
  const 兜底机制 = ['技能效果增幅', '威力增幅', '单属性增益', '掌控提升', '速度提升', '护盾', '承伤修正']
    .find(真身机制可用) || 候选.find(真身机制可用) || '';
  const 默认机制 = 候选.includes('技能效果增幅')
    ? '技能效果增幅'
    : 候选[0] || 兜底机制;
  const 食物工具分支 = 系别 === '食物系' && Math.random() >= 0.5;
  const 食物分支 = 系别 === '食物系' && !食物工具分支;
  if (!默认机制) throw new Error(`技能生成错误:${系别}武魂真身缺少合法增幅机制`);
  const 机制 = 食物工具分支 ? 默认机制 : pickRandom(候选) || 默认机制;
  const 释放形态 = 食物分支 ? '造物承载' : '直接生效';
  const 加成属性候选 = rollAttributeDirectionByType(系别, 机制, 50, 真身上下文);
  const skill = 生成武魂真身基础技能_V1({
    ...真身上下文,
    type: 系别,
    talentTier,
    ringAge,
    ringIndex,
    compatibility,
    textContext,
    sourceQuality,
    grade,
    archetype: 机制,
    delivery: 释放形态,
    targetKind: '自身',
    加成属性候选,
  });
  skill.魂技名 = '武魂真身';
  skill.画面描述 = AI_TODO_SKILL_VISUAL;
  skill.效果描述 = AI_TODO_SKILL_EFFECT;
  const 效果数组 = clonePackedSkillEffects(skill._效果数组 || []);
  效果数组.forEach(effect => 放大武魂真身效果倍率_V1(effect, grade, 食物工具分支));
  skill.消耗 = 构建武魂真身消耗文本_V1(系别, grade, ringIndex, 释放形态, 食物工具分支);
  skill.前摇 = 20;
  if (食物分支) {
    const 自用恢复上限表 = 读取食物自用恢复上限表_V1(skill.消耗);
    const 造物 = 效果数组.find(effect => !String(effect?.原型 || '').trim() && Array.isArray(effect?.使用效果));
    if (造物 && Array.isArray(造物.使用效果)) {
      造物.使用效果.forEach(效果 => {
        if (!效果 || typeof 效果 !== 'object') return;
        const 原型 = String(效果.原型 || '').trim();
        const 原始数值 = 规范化执行效果数值_V1(效果.数值, 效果.动作 || '');
        const 数值 = parseSkillSignedChangeNumber(原始数值);
        const 正向数值 = Number.isFinite(数值) && 数值 > 0 && !/^-/.test(String(效果.数值 || ''));
        if (!正向数值 || !食物效果需要制作者自服折损_V1(效果)) return;
        const 百分比数值 = /%$/.test(String(原始数值 || '')) || Math.abs(数值) <= 1;
        效果.数值 = formatSkillSignedChangeValue(数值 * 0.82, 百分比数值);
        附加食物制作者自服折损条件分支_V1(效果, 0.72, 自用恢复上限表);
      });
    }
  }
  skill._效果数组 = 效果数组.filter(Boolean);
  return 收口技能执行结构_V1(skill, { 目标: '自身' });
}

function autoGenerateSkill(
  type,
  talentTier,
  ringAge,
  ringIndex,
  compatibility = 100,
  preferredSecondary = [],
  currentTick = 0,
  options = {},
) {
  const 自动生成开始毫秒 = 读取性能计时毫秒_V1();
  if (!(options?.自动生成预算范围缓存 instanceof Map)) options.自动生成预算范围缓存 = new Map();
  if (!(options?.自动生成预算摘要缓存 instanceof Map)) options.自动生成预算摘要缓存 = new Map();
  const gradeInfo = judgeSkillGrade(
    talentTier,
    ringAge,
    ringIndex,
    compatibility,
    String(options?.sourceQuality || options?.来源品质 || '').trim(),
  );
  const overrideGrade = String(options?.gradeOverride || '').trim();
  const overrideQuality = String(options?.qualityOverride || '').trim();
  const rawGrade = normalizeSkillGradeSymbol(overrideGrade || gradeInfo.grade);
  const grade = normalizeSkillTableGrade(rawGrade);
  const quality = overrideQuality || 读取技能品质文本_V1(grade);
  const roll = gradeInfo.scoreRoll;
  const skillSourceCategory = String(options?.sourceCategory || '魂技').trim() || '魂技';
  if (skillSourceCategory === '魂技' && options?.forceTrueBody === true && Math.max(1, Number(ringIndex || 1)) === 7) {
    return buildSeventhRingTrueBodySkill(
      type,
      talentTier,
      ringAge,
      ringIndex,
      compatibility,
      options?.textContext || {},
      String(options?.sourceQuality || options?.来源品质 || '').trim(),
      options,
    );
  }

  const passiveMode = options?.passiveMode === true;
  const 蓝图开始毫秒 = 读取性能计时毫秒_V1();
  const blueprint =
    options?.blueprintOverride && typeof options.blueprintOverride === 'object'
      ? normalizeBlueprintOverrideForAutoGenerate(options.blueprintOverride, type, grade, ringIndex, preferredSecondary, options)
      : passiveMode
        ? 生成被动技能蓝图_V1(type, grade, ringIndex, preferredSecondary, options)
      : rollSkillBlueprint(type, rawGrade, ringIndex, preferredSecondary, {
          ...options,
          spiritName: String(options?.textContext?.spiritName || '').trim(),
          sourceName: String(options?.textContext?.spiritName || '').trim(),
          age: ringAge,
          ringAge,
          sourceCategory: skillSourceCategory,
        });
  记录技能生成阶段耗时_V1(options, '蓝图生成', 蓝图开始毫秒, {
    系别: type,
    天赋: talentTier,
    魂环位: ringIndex,
    来源: skillSourceCategory,
    主机制大类: blueprint?.主机制大类,
    主机制原型: blueprint?.主机制原型,
  });
  const 战斗 = buildSkillCombatProfile(blueprint, {
    ...(options || {}),
    quality,
    ringIndex,
    ringAge,
    type,
    系别: type,
    passiveMode,
    grade,
    sourceCategory: skillSourceCategory,
    来源: skillSourceCategory,
  });
  const main = blueprint.主机制大类;
  const archetype = blueprint.主机制原型;
  const secondary = blueprint.副机制 || [];
  const 副作用列表 = normalizeSkillSideEffectList(
    Array.isArray(options?.副作用列表) && options.副作用列表.length ? options.副作用列表 : [],
  );
  const attrs = Array.isArray(blueprint?.加成属性候选) ? blueprint.加成属性候选 : ['魂力'];
  const gradeFactor = { F: 0.6, D: 0.8, C: 1, B: 2, A: 3, S: 4, 'S+': 5 }[grade] || 1;
  const secondaryEffectScale = getSecondaryRingScale(ringIndex);
  const secondaryDurationScale = Math.max(0.7, secondaryEffectScale);
  const passiveNameHint = String(options?.passiveName || '').trim();
  const 共享机制注册表 =
    typeof globalThis !== 'undefined' &&
    globalThis.__LWCS_SKILL_MECHANISM_REGISTRY__ &&
    typeof globalThis.__LWCS_SKILL_MECHANISM_REGISTRY__ === 'object'
      ? globalThis.__LWCS_SKILL_MECHANISM_REGISTRY__
      : SKILL_MECHANISM_REGISTRY_V1;
  const 解析打包语义目标 = (机制名输入 = '', 回退目标 = '') => {
    const 机制名 = String(机制名输入 || '').trim();
    const 蓝图目标 = String(blueprint?.目标 || '').trim();
    const 指定目标 = 机制名 === archetype && 蓝图目标 ? 归一化执行效果作用目标_V1(蓝图目标, '单体') : '';
    if (指定目标) return 指定目标;
    if (!机制名) return 归一化执行效果作用目标_V1(回退目标 || '单体', '单体');
    return 生成技能机制正式目标_V1(机制名, {
      系别: type,
      品质: grade,
      释放形态: blueprint.释放形态,
      主机制大类: 机制名 === archetype ? main : findMainMechanicGroupByArchetype(机制名),
      造物使用效果: blueprint.释放形态 === '造物承载',
    });
  };
  const 解析分摊结算目标 = 回退目标 => 约束结算修正目标_V1('伤害分摊', 解析打包语义目标('伤害分摊', 回退目标));
  const 生成目标 = (原型名, 候选目标 = '单体') => 约束第三批原型顶层目标_V1(
    原型名,
    归一化执行效果作用目标_V1(候选目标, '单体'),
  );
  const 共享机制编译上下文 = 机制名 => ({
    目标: 解析打包语义目标(机制名, '单体'),
    规划目标: 解析打包语义目标(机制名, '单体'),
    执行目标: 解析打包语义目标(机制名, '单体'),
    品质: grade,
    魂环位: ringIndex,
    系别: type,
    属性候选: attrs,
    主机制原型: archetype,
    主机制大类: main,
    战斗,
    伤害意图,
    效果意图,
    造物意图,
    结算参数,
    副机制效果倍率: secondaryEffectScale,
    副机制持续倍率: secondaryDurationScale,
  });
  const 编译共享机制效果 = (机制名, extra = {}) =>
    编译技能机制为正式效果列表_V1(机制名, { ...共享机制编译上下文(机制名), ...extra });
  const 写入已编译效果列表_V1 = (效果列表 = [], 目标 = '单体') => {
    const 正式效果列表 = 收口生成正式效果终态_V1(效果列表, {
      目标,
      path: '生成后效果',
      技能: { _效果数组: 效果列表 },
    });
    packedEffects.push(...正式效果列表);
  };

  const 按品级随机范围 = table => {
    const [min, max] = pickSkillGradeTableRangeV1(table, grade);
    return min + Math.random() * (max - min);
  };

  const 伤害意图 = 战斗.伤害意图 || {};
  const 效果意图 = 战斗.效果意图 || {};
  const 造物意图 = 战斗.造物意图 || {};
  const 结算参数 = 效果意图.结算参数 || {
    跳过回合: false,
    无法反应: false,
    持续伤害数值: 0,
    防御穿透比例: 0,
    反应加成: 0,
    反应压制: 0,
    攻击速度加成: 0,
    施放速度加成: 0,
    施放速度压制: 0,
    命中加成: 0,
    命中压制: 0,
    闪避加成: 0,
    闪避压制: 0,
    锁定强度: 0,
    打断强度: 0,
    伤害倍率系数: 1.0,
    造成伤害加值: 0,
    治疗倍率: 1.0,
    治疗加值: 0,
    护盾获得倍率: 1.0,
    护盾补充值: 0,
    魂力恢复比例: 0,
    精神恢复比例: 0,
    禁疗比例: 0,
    持续恢复比例: 0,
    生命保底: 0,
    免死次数: 0,
    复活次数: 0,
    复活治疗比例: 0,
    反伤比例: 0,
    伤害转移比例: 0,
    伤害转移对象: '',
    伤害分摊比例: 0,
    伤害分摊数量: 0,
    消耗分摊比例: 0,
    消耗分摊数量: 0,
    治疗反转比例: 0,
    无视异常: false,
    封技: false,
    隐匿等级: 0,
    附加真伤比例: 0,
    伤害吸收比例: 0,
    消耗修正倍率: 1.0,
    前摇修正倍率: 1.0,
    掌控倍率: 1.0,
    速度倍率: 1.0,
  };
  const packedEffects = [];
  const 是否食物系 = String(type || '').trim() === '食物系';
  const 是否神圣治疗风格 =
    ['治疗系', '辅助系'].includes(String(type || '').trim()) &&
    Array.isArray(attrs) &&
    attrs.some(token => ['神圣', '光明', '生命'].includes(String(token || '').trim()));
  const 神圣逆邪分支 = Object.freeze([
    Object.freeze({
      条件: Object.freeze([Object.freeze({ 类型: '邪魂师', 对象: '目标', 比较: '有' })]),
      处理: '替换效果',
      转为伤害: true,
      伤害类型: '远程攻击',
    }),
    Object.freeze({
      条件: Object.freeze([Object.freeze({ 类型: '深渊生物', 对象: '目标', 比较: '有' })]),
      处理: '替换效果',
      转为伤害: true,
      伤害类型: '远程攻击',
    }),
  ]);
  const appendPackedEffectConditionBranches = (effect, branchList = []) => {
    if (!effect || !Array.isArray(branchList) || !branchList.length) return effect;
    const baseBranches = Array.isArray(effect.条件分支) ? clonePackedSkillEffects(effect.条件分支) : [];
      const newBranches = branchList.map(branch => {
      const next = cloneJsonValue(branch);
      if (next.处理 !== '替换效果') return next;
      const replacement = cloneJsonValue(effect);
      delete replacement.条件分支;
      if (next.转为伤害) {
        replacement.原型 = '伤害结算';
        replacement.伤害类型 = next.伤害类型 || replacement.伤害类型 || '远程攻击';
        if (!(Number(replacement.威力倍率 || 0) > 0)) {
          const 基准数值 = Math.abs(parseSkillSignedChangeNumber(规范化执行效果数值_V1(effect.数值, effect.动作)));
          replacement.威力倍率 = Math.max(1, Math.round((Number.isFinite(基准数值) ? 基准数值 : 1) * 100));
        }
        delete replacement.数值;
        delete next.转为伤害;
        delete next.伤害类型;
      }
      next.替换效果 = [replacement];
      return next;
    }).filter(Boolean);
    if (!newBranches.length) return effect;
    effect.条件分支 = [...baseBranches, ...newBranches];
    return effect;
  };
  const 标记副机制跟随主原型_V1 = effect => {
    if (!effect || typeof effect !== 'object' || Array.isArray(effect)) return effect;
    const 当前主目标 = 归一化执行效果作用目标_V1(
      packedEffects.find(item => item && typeof item === 'object' && !Array.isArray(item) && String(item.原型 || '').trim())?.目标 || '',
      '',
    );
    const 副机制目标 = 归一化执行效果作用目标_V1(effect.目标 || '', '');
    if (!当前主目标 || 副机制目标 !== 当前主目标) return effect;
    return { ...effect, 生效方式: '跟随主原型' };
  };
  const 收口生成后正式效果列表_V1 = (效果列表 = packedEffects, 目标 = '单体') => {
    return 收口生成正式效果终态_V1(效果列表, {
      目标,
      path: '生成后效果',
      技能: { _效果数组: 效果列表 },
    });
  };
  const requireTargetDotState = (effect, 状态 = '持续创伤') => appendPackedEffectConditionBranches(effect, 构建缺少状态禁用条件分支_V1(状态));
  const requireTargetShield = effect => appendPackedEffectConditionBranches(effect, 构建缺少护盾禁用条件分支_V1());
  const 效果编译开始毫秒 = 读取性能计时毫秒_V1();
  const 共享主机制原型列表 = 编译共享机制效果(archetype);
  if (!共享主机制原型列表.length) {
    throw new Error(`技能生成错误:${archetype || '未命名机制'}没有共享原型编译定义`);
  }
  写入已编译效果列表_V1(clonePackedSkillEffects(共享主机制原型列表), 解析打包语义目标(archetype, '单体'));

  secondary.forEach(机制名 => {
    const 机制 = String(机制名 || '').trim();
    if (!机制) return;
    if (!机制具备共享原型编译_V1(机制)) throw new Error(`技能生成错误:${机制}没有共享原型编译定义`);
    const 副机制效果列表 = 编译共享机制效果(机制, {
      主副机制上下文: '副机制',
      副机制: true,
      生效方式: '跟随主原型',
    }).map(标记副机制跟随主原型_V1);
    if (!副机制效果列表.length) throw new Error(`技能生成错误:${机制}未生成可执行副机制原型`);
    packedEffects.push(...副机制效果列表);
    packedEffects.splice(0, packedEffects.length, ...收口生成后正式效果列表_V1(packedEffects, 解析打包语义目标(机制, '单体')));
  });

  if (是否神圣治疗风格) {
    packedEffects.forEach(effect => {
      if (!effect || typeof effect !== 'object' || Array.isArray(effect)) return;
      const 原型 = String(effect.原型 || '').trim();
      const 是生命恢复 =
        (原型 === '资源变化' && String(effect.资源 || '').trim() === '生命' && 读取技能比例数值_V1(effect.数值) > 0 && !/^-/.test(String(effect.数值 || ''))) ||
        (原型 === '状态施加' && String(effect.状态 || '').trim() === '持续恢复');
      if (是生命恢复) appendPackedEffectConditionBranches(effect, 神圣逆邪分支);
    });
  }
  packedEffects.splice(0, packedEffects.length, ...收口生成后正式效果列表_V1(packedEffects, blueprint.释放形态 === '造物承载' ? '自身' : '单体'));

  if (是否食物系) {
    const 自用恢复上限表 = 读取食物自用恢复上限表_V1(战斗.消耗 || '无');
    packedEffects.forEach(effect => {
      if (!effect || typeof effect !== 'object') return;
      const 原型 = String(effect.原型 || '').trim();
      if (!原型) return;
      if (shouldWrapSkillEffectAsGrant(effect)) return;
      if (食物效果需要制作者自服折损_V1(effect)) {
        const 原始数值 = 规范化执行效果数值_V1(effect.数值, effect.动作 || '');
        const 数值 = parseSkillSignedChangeNumber(原始数值);
        if (Number.isFinite(数值)) effect.数值 = formatSkillSignedChangeValue(数值 * 0.82, Math.abs(数值) <= 1 || /%$/.test(String(原始数值 || '')));
        附加食物制作者自服折损条件分支_V1(effect, 0.72, 自用恢复上限表);
      }
    });
    packedEffects.splice(0, packedEffects.length, ...收口生成后正式效果列表_V1(packedEffects, blueprint.释放形态 === '造物承载' ? '自身' : '单体'));
  }

  应用生成魂技固化数值规则_V1(packedEffects, {
    来源类别: skillSourceCategory,
    系别: type,
    魂环位: ringIndex,
    武魂名称: String(options?.martialSoulName || options?.textContext?.martialSoulName || options?.textContext?.spiritName || '').trim(),
    当前魂环数量: Math.max(1, Math.floor(Number(options?.当前魂环数量 || options?.ringCount || 1))),
  });
  packedEffects.splice(0, packedEffects.length, ...收口生成后正式效果列表_V1(
    packedEffects,
    blueprint.释放形态 === '造物承载' ? '自身' : 解析打包语义目标(archetype, '单体'),
  ));

  if (
    skillSourceCategory === '魂技' &&
    是否辅助系名称_V1(type) &&
    是否七九武魂名称_V1(String(options?.martialSoulName || options?.textContext?.martialSoulName || options?.textContext?.spiritName || '').trim())
  ) {
  }

  if (passiveMode) {
    战斗.技能分类 = String(战斗.技能分类 || '').trim() ? `被动/${战斗.技能分类}` : '被动';
    if (skillSourceCategory !== '魂技') {
      战斗.前摇 = 0;
      战斗.消耗 = '无';
    }

    const 被动可保留原型集合 = new Set([
      '属性修正',
      '状态施加',
      '结算修正',
      '判定修正',
      '资源变化',
      '资源锁定',
      '规则防御',
      '机制授予',
      '修炼增益',
      '时窗修正',
      '时光回溯',
    ]);
    const 生成被动保留效果_V1 = effect => {
      const 原型 = String(effect?.原型 || '').trim();
      if (!被动可保留原型集合.has(原型)) return null;
      const next = cloneJsonValue(effect, {});
      next.目标 = 约束第三批原型顶层目标_V1(原型, 原型 === '时光回溯' ? '单体' : '自身');
      return next;
    };
    const passiveEffects = [];
    packedEffects.forEach(effect => {
      const 保留效果 = 生成被动保留效果_V1(effect);
      if (保留效果) passiveEffects.push(保留效果);
    });

    const hasStablePassiveCore = passiveEffects.some(effect =>
      被动可保留原型集合.has(String(effect?.原型 || '')),
    );
    if (!hasStablePassiveCore) {
      const 默认被动效果列表 = 编译共享机制效果(archetype, { 目标: '自身' })
        .map(生成被动保留效果_V1)
        .filter(Boolean);
      passiveEffects.unshift(...默认被动效果列表);
    }
    if (skillSourceCategory === '魂骨技能' && !passiveEffects.some(effect => String(effect?.原型 || '').trim())) {
      passiveEffects.unshift(
        ...编译共享机制效果(archetype, { 目标: '自身' })
          .map(生成被动保留效果_V1)
          .filter(Boolean),
      );
    }
    if (!passiveEffects.some(effect => String(effect?.原型 || '').trim())) {
      throw new Error(`技能生成错误:${archetype || '未命名机制'}未生成可执行被动原型`);
    }

    packedEffects.length = 0;
    写入已编译效果列表_V1(passiveEffects, '自身');
    packedEffects.splice(0, packedEffects.length, ...收口生成后正式效果列表_V1(packedEffects, '自身'));
  }

  if (!packedEffects.some(effect => effect && typeof effect === 'object' && (String(effect.原型 || '').trim() || Array.isArray(effect.使用效果)))) {
    throw new Error(`技能生成错误:${archetype || '未命名机制'}未生成可执行原型`);
  }

  if (blueprint.释放形态 !== '造物承载') wrapGrantableRuntimeEffectsForSupport(packedEffects, type, AI_TODO_SKILL_NAME);
  packedEffects.splice(0, packedEffects.length, ...收口生成后正式效果列表_V1(packedEffects, blueprint.释放形态 === '造物承载' ? '自身' : '单体'));

  if (blueprint.释放形态 === '造物承载') {
    let usageEffects = 收口生成正式效果终态_V1(buildCreationUsageEffects(packedEffects, type), {
      目标: '单体',
      path: '造物使用效果',
      技能: { _效果数组: packedEffects },
    });
    const 造物使用效果可收口 = (() => {
      try {
        usageEffects = 收口生成正式效果终态_V1(usageEffects, {
          目标: '单体',
          path: '造物使用效果',
          技能: { _效果数组: packedEffects },
        });
        return usageEffects.length > 0;
      } catch (_error) {
        return false;
      }
    })();
    if (!造物使用效果可收口) {
      throw new Error(`技能生成错误:${archetype || '未命名机制'}造物承载缺少可执行使用效果`);
    }
    packedEffects.length = 0;
    const itemName = AI_TODO_SKILL_NAME;
    const ttl = buildTemporaryConstructDurationTicks(grade, ringIndex);
    const itemDesc = buildTemporaryConstructDescription(itemName, usageEffects, ttl, { type: '造物' });
    const 造物模板列表 = 收口造物承载物品模板数组_V1([{
      数量: gradeFactor >= 4 ? 2 : 1,
      有效期tick: ttl,
      描述: itemDesc,
      使用效果: usageEffects,
    }], { 承载方式: '造物承载' });
    if (!造物模板列表.length) throw new Error(`技能生成错误:${archetype || '未命名机制'}造物承载模板收口失败`);
    packedEffects.splice(0, packedEffects.length, ...造物模板列表);
  }
  if (blueprint.释放形态 !== '造物承载') {
    packedEffects.splice(0, packedEffects.length, ...收口生成后正式效果列表_V1(
      packedEffects,
      解析打包语义目标(archetype, '单体'),
    ));
  }
  记录技能生成阶段耗时_V1(options, '效果编译', 效果编译开始毫秒, {
    系别: type,
    天赋: talentTier,
    魂环位: ringIndex,
    来源: skillSourceCategory,
    主机制大类: main,
    主机制原型: archetype,
  });

  const 生成结果 = {
    魂技名: AI_TODO_SKILL_NAME,
    画面描述: AI_TODO_SKILL_VISUAL,
    效果描述: AI_TODO_SKILL_EFFECT,
    消耗: 战斗.消耗 || '无',
    前摇: 战斗.前摇 || 0,
    承载方式: blueprint.释放形态 || '直接生效',
    _效果数组: packedEffects,
  };
  if (!passiveMode && archetype === '反制') 生成结果.触发方式 = '受击前';
  if (副作用列表.length) 生成结果.副作用列表 = 副作用列表;
  let 收口结果 = 收口技能执行结构_V1(生成结果, { 目标: blueprint.释放形态 === '造物承载' ? '自身' : '单体', passiveMode });
  应用生成魂技系别驱动属性_V1(收口结果._效果数组, type);
  const 预算上下文 = 构建自动生成预算上下文_V1({
    ...(options || {}),
    角色: options?.角色,
    talentTier,
    age: ringAge,
    ringAge,
    魂环数据: options?.魂环数据 || options?.ringData,
    魂环位: Math.max(1, Number(ringIndex || 1)),
    ringIndex: Math.max(1, Number(ringIndex || 1)),
    来源: skillSourceCategory,
    sourceCategory: skillSourceCategory,
    系别: type,
    武魂系别: options?.武魂系别 || type,
    path: options?.path || ['char', '魂技'],
  });
  const 生成预算上下文 = {
    ...预算上下文,
    启用位级硬上限: true,
    系别: type,
    type,
    目标: blueprint.释放形态 === '造物承载' ? '自身' : '单体',
    passiveMode,
  };
  if ((skillSourceCategory === '魂技' && options?.forceTrueBody === true && Math.max(1, Number(ringIndex || 1)) === 7) || skillSourceCategory === '武魂融合技') {
    收口结果.消耗 = 构建武魂真身默认承载消耗_V1(type, grade, blueprint.释放形态);
    收口结果.前摇 = 获取标准前摇_V1();
  }
  const 收口食物自服分支_V1 = () => {
    if (!是否食物系) return;
    刷新食物制作者自服恢复绝对值_V1(收口结果, 预算上下文);
    收紧食物制作者自服分支COST_V1(收口结果, 预算上下文);
  };
  收口食物自服分支_V1();
  收口技能执行结构_V1(收口结果, { 目标: blueprint.释放形态 === '造物承载' ? '自身' : '单体', passiveMode });
  应用生成魂技系别驱动属性_V1(收口结果._效果数组, type);
  断言直接结算收益预算_V1(收口结果, '生成技能', 预算上下文);
  // 在预算前只做条件分支结构约束；效果强度统一交给 COST 收口。
  条件分支约束_V1(收口结果);
  收口食物自服分支_V1();
  断言直接结算收益预算_V1(收口结果, '生成技能', 预算上下文);
  收口支援系低位伤害生成_V1(收口结果, {
    path: ['char', '魂技'],
    角色: 预算上下文.角色,
    来源: skillSourceCategory,
    魂环位: Math.max(1, Number(ringIndex || 1)),
    启用位级硬上限: true,
    系别: type,
    type,
  });
  收口食物自服分支_V1();
  替换技能重复增益属性_V1(收口结果, 生成预算上下文);
  断言技能五环恢复增益不重复_V1(收口结果, 生成预算上下文, archetype || '未命名机制');
  Object.defineProperty(收口结果, '机制原型', {
    value: archetype,
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(收口结果, '品质等级', {
    value: grade,
    enumerable: false,
    configurable: true,
  });
  记录技能生成阶段耗时_V1(options, 'autoGenerateSkill总耗时', 自动生成开始毫秒, {
    系别: type,
    天赋: talentTier,
    魂环位: ringIndex,
    来源: skillSourceCategory,
    主机制大类: main,
    主机制原型: archetype,
  });
  return 收口结果;
}

var 技能定义旧字段扫描集合_V1 = new Set([
  '运行机制',
  '战斗效果',
  '计算层效果',
  '状态名称',
  '特殊机制标识',
  '瞬时结算',
  '状态承载',
  '场地承载',
  '基础威力倍率',
  '护盾绝对值',
  'dot_damage',
  'armor_pen',
  'final_damage_mult',
  'shield_gain_bonus',
  '伤害意图',
  '效果意图',
  '造物意图',
  '结算参数',
  '机制标签',
  'cast_time',
  '加成属性',
  '持续伤害值',
  '防御穿透值',
  '造成伤害倍率',
  '护盾获得加值',
]);

var 技能定义效果槽位集合_V1 = new Set(技能定义效果槽位字段表_V1);

function 扫描技能定义槽位旧字段_V1(value = {}, path = 'root', insideEffectSlot = false, results = []) {
  if (!value || typeof value !== 'object') return results;
  if (Array.isArray(value)) {
    value.forEach((item, index) => 扫描技能定义槽位旧字段_V1(item, `${path}[${index}]`, insideEffectSlot, results));
    return results;
  }
  Object.entries(value).forEach(([key, raw]) => {
    const 当前路径 = `${path}.${key}`;
    const 在效果槽位 = insideEffectSlot || 技能定义效果槽位集合_V1.has(key);
    if (在效果槽位 && 技能定义旧字段扫描集合_V1.has(key)) results.push({ path: 当前路径, field: key });
    if (raw && typeof raw === 'object') 扫描技能定义槽位旧字段_V1(raw, 当前路径, 在效果槽位, results);
  });
  return results;
}

function 校验生成技能正式结构_V1(skill = {}, path = '生成技能', options = {}) {
  const cloned = cloneJsonValue(skill, {});
  const 收口选项 = {
    ...(options || {}),
    目标: options?.目标 || (String(cloned.承载方式 || '').trim() === '造物承载' ? '自身' : '单体'),
    技能: cloned,
  };
  强制普通魂技固定启动消耗_V1(cloned, 收口选项);
  收口技能执行结构_V1(cloned, 收口选项);
  if (String(cloned.承载方式 || '').trim() === '造物承载') {
    (Array.isArray(cloned._效果数组) ? cloned._效果数组 : []).forEach((template, index) => {
      断言技能执行效果原型契约_V1(template?.使用效果 || [], `${path}._效果数组[${index}].使用效果`, 收口选项);
    });
  } else {
    断言技能执行效果原型契约_V1(cloned._效果数组 || [], `${path}._效果数组`, 收口选项);
  }
  const 旧字段 = 扫描技能定义槽位旧字段_V1(cloned, path);
  if (旧字段.length) throw new Error(`技能执行结构错误:${path}正式效果槽位残留旧字段${旧字段[0].path}`);
  if (普通魂技禁止百分比启动消耗_V1(cloned, 收口选项)) throw new Error(`技能执行结构错误:${path}普通魂技启动消耗必须为固定数值`);
  return cloned;
}

function 运行结算修正原型矩阵探针_V1(options = {}) {
  const 结算列表 = Array.isArray(options.结算列表) && options.结算列表.length
    ? options.结算列表.map(item => String(item || '').trim()).filter(Boolean)
    : Object.keys(结算修正支持字段矩阵_V1);
  const 失败列表 = [];
  const 默认值 = 结算 => {
    if (['消耗', '前摇'].includes(结算)) return '-20%';
    if (['受到伤害'].includes(结算)) return '-20%';
    if (结算 === '持续伤害引爆') return '+100%';
    return '+20%';
  };
  结算列表.forEach((结算, index) => {
    const effect = {
      原型: '结算修正',
      目标: ['伤害分摊', '消耗分摊'].includes(结算) ? '群体' : '单体',
      结算,
      数值: 默认值(结算),
    };
    if (结算 === '伤害转移') effect.转移对象 = '攻击者';
    if (结算 === '伤害吸收') {
      effect.吸收来源 = '造成伤害';
      effect.吸收资源 = '生命';
    }
    if (结算 === '反击') effect.触发限制 = { 周期: '每战', 次数: 1 };
    if (['伤害分摊', '消耗分摊'].includes(结算)) effect.数量 = 1;
    try {
      const 输入列表 = 结算 === '反击'
        ? [{ 原型: '机制授予', 目标: '自身', 触发条件: '主动触发', 可用次数: 1, 持续回合: 1, 授予效果: [effect] }]
        : [effect];
      const 收口列表 = 收口生成正式效果终态_V1(输入列表, { 目标: effect.目标, path: `结算修正矩阵[${index}]` });
      const 输出 = 结算 === '反击' ? 收口列表[0]?.授予效果?.[0] || {} : 收口列表[0] || {};
      const 输出数值 = parseSkillSignedChangeNumber(输出.数值);
      if (!Number.isFinite(输出数值) || 输出数值 === 0) {
        throw new Error(`结算修正输出数值无效:${String(输出.数值 ?? '')}`);
      }
    } catch (错误) {
      失败列表.push({
        index,
        结算,
        输入数值: effect.数值,
        message: String(错误?.message || 错误),
      });
    }
  });
  return {
    ok: 失败列表.length === 0,
    count: 结算列表.length,
    failed: 失败列表.length,
    failures: 失败列表,
  };
}

function 运行自动生成正式原型探针_V1(options = {}) {
  const 默认机制列表 = ['硬控', '软控', '机制抹消', '时光回溯', '消耗', '前摇', '召唤', '规则改写', '能力共享', '资源锁定', '伤害吸收', '状态转移', '状态交换', '持续伤害', '引爆持续伤害', '斩杀补伤', '穿透', '追击', '反击', '生命链接', '标记弱点', '威力增幅', '技能效果增幅', '转化', '伤害转回复', '回复转伤害'];
  const 机制列表 = Array.isArray(options.机制列表) && options.机制列表.length
    ? 规范化机制枚举数组_V1(options.机制列表)
    : 默认机制列表;
  const 目标列表 = Array.isArray(options.目标列表) && options.目标列表.length
    ? options.目标列表.map(item => String(item || '').trim()).filter(Boolean)
    : ['自身', '单体', '群体', '全场'];
  const 系别列表 = Array.isArray(options.系别列表) && options.系别列表.length
    ? options.系别列表
    : ['强攻系', '控制系', '辅助系', '防御系', '敏攻系', '治疗系', '食物系', '精神系', '召唤系'];
  const 品质列表 = Array.isArray(options.品质列表) && options.品质列表.length ? options.品质列表 : ['C', 'B', 'A', 'S'];
  const 释放形态列表 = Array.isArray(options.释放形态列表) && options.释放形态列表.length ? options.释放形态列表 : ['直接生效', '被动', '机制授予', '造物承载'];
  const 定点用例列表 = [];
  机制列表.forEach((机制, 机制序号) => {
    if (!机制具备共享原型编译_V1(机制)) return;
    目标列表.forEach((目标, 目标序号) => {
      释放形态列表.forEach((释放形态, 形态序号) => {
        if (释放形态 === '被动' && !自动生成被动主机制候选集合_V1.has(机制)) return;
        const 系别 = 系别列表[(机制序号 + 目标序号 + 形态序号) % 系别列表.length] || '强攻系';
        const 品质 = 品质列表[(机制序号 + 形态序号) % 品质列表.length] || 'B';
        定点用例列表.push({ 机制, 目标, 释放形态, 系别, 品质 });
      });
    });
  });
  const 总次数 = Math.max(1, Math.round(Number(options.次数 || options.count || Math.max(30000, 定点用例列表.length))));
  const 失败列表 = [];
  const 分布 = {};
  const 摘要效果 = skill => {
    const 摘要列表 = [];
    const 访问 = effect => {
      if (!effect || typeof effect !== 'object' || Array.isArray(effect)) return;
      if (String(effect.原型 || '').trim()) {
        摘要列表.push([
          String(effect.原型 || '').trim(),
          String(effect.目标 || '').trim(),
          String(effect.状态 || effect.结算 || effect.规则 || effect.资源 || '').trim(),
          String(effect.数值 ?? effect.威力倍率 ?? '').trim(),
        ].filter(Boolean).join(':'));
      }
      技能执行嵌套效果数组字段表_V1.forEach(key => (Array.isArray(effect[key]) ? effect[key] : []).forEach(访问));
      (Array.isArray(effect.条件分支) ? effect.条件分支 : []).forEach(branch => {
        技能条件分支效果数组字段表_V1.forEach(key => (Array.isArray(branch?.[key]) ? branch[key] : []).forEach(访问));
      });
    };
    (Array.isArray(skill?._效果数组) ? skill._效果数组 : []).forEach(访问);
    return 摘要列表.slice(0, 12);
  };
  const 记录分布 = skill => {
    const 原型列表 = [];
    const 访问 = effect => {
      if (!effect || typeof effect !== 'object' || Array.isArray(effect)) return;
      if (String(effect.原型 || '').trim()) 原型列表.push(String(effect.原型).trim());
      技能执行嵌套效果数组字段表_V1.forEach(key => (Array.isArray(effect[key]) ? effect[key] : []).forEach(访问));
      (Array.isArray(effect.条件分支) ? effect.条件分支 : []).forEach(branch => {
        技能条件分支效果数组字段表_V1.forEach(key => (Array.isArray(branch?.[key]) ? branch[key] : []).forEach(访问));
      });
    };
    (Array.isArray(skill?._效果数组) ? skill._效果数组 : []).forEach(访问);
    原型列表.forEach(原型 => {
      分布[原型] = (分布[原型] || 0) + 1;
    });
  };
  for (let index = 0; index < 总次数; index += 1) {
    const 定点用例 = 定点用例列表[index] || null;
    const 系别 = 定点用例?.系别 || 系别列表[index % 系别列表.length];
    const 品质 = 定点用例?.品质 || 品质列表[Math.floor(index / 系别列表.length) % 品质列表.length];
    const 普通魂技探针位列表 = [1, 2, 3, 4, 5, 6, 8, 9];
    const 魂环位 = 普通魂技探针位列表[index % 普通魂技探针位列表.length];
    const 年限 = 魂环位 % 3 === 0 ? 100000 : 1000 + 魂环位 * 1000;
    const 释放形态 = 定点用例?.释放形态 || 释放形态列表[Math.floor(index / (系别列表.length * 品质列表.length)) % 释放形态列表.length];
    const 机制 = 定点用例?.机制 || '';
    const 目标 = 定点用例?.目标 || '';
    let skill = null;
    try {
      if (机制) {
        const 主机制大类 = findMainMechanicGroupByArchetype(机制);
        const 探针蓝图覆盖 = {
          主机制大类: 主机制大类 || '特殊规则类',
          主机制原型: 机制,
          副机制: [],
          释放形态: 释放形态 === '被动' ? '直接生效' : (释放形态 === '机制授予' ? '直接生效' : 释放形态),
          目标: 目标 || '单体',
        };
        const 探针上下文 = {
          type: 系别,
          系别,
          grade: 品质,
          gradeOverride: 品质,
          sourceQuality: 品质,
          ringIndex: 魂环位,
          魂环位,
          age: 年限,
          ringAge: 年限,
          目标: 目标 || '单体',
          释放形态: 释放形态 === '机制授予' ? '直接生效' : 释放形态,
          sourceCategory: '魂技',
          来源: '魂技',
        };
        if (
          !机制大类适配自动生成系别_V1(主机制大类, 探针上下文) ||
          !机制是合法生成主机制_V1(机制, 探针上下文) ||
          !机制属于当前系别主候选池_V1(机制, 探针上下文) ||
          !自动生成机制满足预算范围_V1(机制, 探针上下文)
        ) {
          continue;
        }
        try {
          normalizeBlueprintOverrideForAutoGenerate(探针蓝图覆盖, 系别, 品质, 魂环位, [], 探针上下文);
        } catch (错误) {
          continue;
        }
      }
      const 被动形态 = 释放形态 === '被动';
      const 蓝图覆盖 = 机制
        ? {
            主机制大类: findMainMechanicGroupByArchetype(机制) || '特殊规则类',
            主机制原型: 机制,
            副机制: [],
            释放形态: 被动形态 ? '直接生效' : (释放形态 === '机制授予' ? '直接生效' : 释放形态),
            目标: 目标 || '单体',
          }
        : 释放形态 === '机制授予'
          ? {
              主机制大类: ['辅助系', '食物系'].includes(系别) ? '增益类' : '',
              主机制原型: ['辅助系', '食物系'].includes(系别) ? '单属性增益' : '',
              副机制: [],
              释放形态: '直接生效',
              目标: ['辅助系', '食物系'].includes(系别) ? '友方单体' : '敌方单体',
            }
          : 被动形态
            ? null
            : { 释放形态 };
      const skillOptions = {
        允许自动生成技能结构: true,
        gradeOverride: 品质,
        grade: 品质,
        sourceQuality: 品质,
        forceTrueBody: false,
        passiveMode: 被动形态,
        age: 年限,
        ringAge: 年限,
        ringIndex: 魂环位,
        魂环位,
        compatibility: 100,
        talentTier: '正常',
        sourceCategory: '魂技',
        来源: '魂技',
        系别,
        type: 系别,
      };
      if (蓝图覆盖) skillOptions.blueprintOverride = 蓝图覆盖;
      skill = { 魂技名: `探针_${index + 1}`, _效果数组: [] };
      直接自动生成技能结构_V1(skill, skillOptions);
      const checked = 校验生成技能正式结构_V1(skill, `探针[${index}]`, {
        type: 系别,
        系别,
        talentTier: '正常',
        age: 年限,
        ringAge: 年限,
        ringIndex: 魂环位,
        魂环位,
        sourceQuality: 品质,
        gradeOverride: 品质,
        grade: 品质,
        sourceCategory: '魂技',
        来源: '魂技',
        forceTrueBody: false,
        passiveMode: 被动形态,
      });
      记录分布(checked);
    } catch (错误) {
      失败列表.push({
        index,
        系别,
        品质,
        魂环位,
        释放形态,
        机制,
        目标,
        message: String(错误?.message || 错误),
        效果摘要: 摘要效果(skill),
        收敛效果摘要: 摘要效果(错误?.预算收敛技能),
      });
      if (失败列表.length >= Math.max(1, Number(options.最大失败 || 20))) break;
    }
  }
  return {
    ok: 失败列表.length === 0,
    count: 总次数,
    failed: 失败列表.length,
    failures: 失败列表,
    distribution: 分布,
  };
}

function 注册自动生成正式原型探针入口_V1() {
  const 注册到根 = root => {
    if (!root || typeof root !== 'object') return;
    root.__LWCS_SCAN_SKILL_DEFINITION_OLD_FIELDS__ = 扫描技能定义槽位旧字段_V1;
    root.__LWCS_RUN_AUTO_GENERATE_PROTOTYPE_PROBE__ = 运行自动生成正式原型探针_V1;
    root.__LWCS_RUN_SETTLEMENT_MODIFIER_MATRIX_PROBE__ = 运行结算修正原型矩阵探针_V1;
  };
  注册到根(globalThis);
  try { if (globalThis.parent && globalThis.parent !== globalThis) 注册到根(globalThis.parent); } catch (错误) {}
  try { if (globalThis.top && globalThis.top !== globalThis) 注册到根(globalThis.top); } catch (错误) {}
}

注册自动生成正式原型探针入口_V1();

var AI_TODO_TEXT_PREFIX = '待补全';
var SKILL_TEXT_UNKNOWN = '未知';
var AI_TODO_SKILL_NAME =
  '待补全（填写魂技名；命名必须与所属武魂/魂灵同源，禁止无关命名；若为造物承载类技能，此名称同时作为生成物名称）';
var AI_TODO_SKILL_VISUAL = '待补全（依据魂技名与_简易效果描述补全发动画面，文字须有小说分镜感与视觉张力，严禁新增未提及的机制）';
var AI_TODO_SKILL_EFFECT = '待补全（效果描述。将_简易效果描述转化为自然语言。 须逻辑严密，明确消耗与效果等具体数值';
var AI_TODO_SPIRIT_NAME = '待补全(填写具体武魂名，如蓝银草/蓝银皇)';
var AI_TODO_SPIRIT_DESC = '待补全(描述武魂外形、核心能力与战斗特征)';
var 武魂系别待补全文案_V1 = '待补全(填写武魂系别：强攻系/敏攻系/防御系/控制系/辅助系/食物系/治疗系/精神系/元素系/召唤系)';
var AI_TODO_SPIRIT_ELEMENT = '待补全(填写元素倾向；无属性也请明确写无)';
var AI_TODO_ATTRIBUTE_SYSTEM = '待补全（填写属性体系：无/元素/五行）';
var AI_TODO_CALLABLE_ELEMENTS = '待补全（填写可调用元素列表：金 / 木 / 水 / 火 / 土 / 风 / 雷 / 冰 / 光 / 暗 / 精神 / 空间 / 时间 / 创造 / 毁灭，无属性体系请填“无”）';
var AI_TODO_SOUL_SPIRIT_NAME = '待补全（魂兽名）';
var AI_TODO_SOUL_SPIRIT_DESC = '待补全（魂灵设定。结合物种、年限与品质，生动补全其形体细节、血脉威压与战斗风格）';
var AI_TODO_SOUL_SPIRIT_QUALITY ='待补全（可选f/d/c/b/a/s/s+；f为劣质魂灵，如草蛇等杂血弱种；d为低劣魂灵，如普通凶性野兽型魂灵；c为普通魂灵，具备基础血脉与战斗价值；b为良品魂灵，常见强势魂兽；a为精英魂灵，稀有异种或强族后裔；s为顶尖魂灵，王族血脉或顶级龙种；s+为神话级魂灵，真龙、神兽后裔或极端变异个体）';
var AI_TODO_SOUL_BONE_SOURCE = '待补全(请填写魂骨来源的魂兽名)';
var AI_TODO_MAIN_IDENTITY = '待补全(填写当前主要公开身份)';
var AI_TODO_PERSONALITY = '待补全(根据角色设定补全性格特征)';
var AI_TODO_STATUS_LOC = '斗罗大陆-待补全(按大陆-城市-地点完整路径填写，禁止只填单一地名)';
var AI_TODO_FAMILY_BACKGROUND = '待补全(请结合角色家庭出身、成长环境、资源条件、父母来历与公开身份，补全家世或出身背景描述)';
var 角色穿搭上装待补全文案_V1 = '待补全(根据当前场景补完上装)';
var 角色穿搭下装待补全文案_V1 = '待补全(根据当前场景补完下装)';
var 角色穿搭鞋子待补全文案_V1 = '待补全(根据当前场景补完鞋子)';
var 角色穿搭描述待补全文案_V1 = '待补全(根据当前地点、身份、年龄、行动与场景补完整体穿着)';
function isAiTodoText(value) {
  const text = String(value || '').trim();
  return text.startsWith(AI_TODO_TEXT_PREFIX);
}

function buildSkillNameTodoText(context = {}) {
  const rawSpiritName = String(context?.spiritName || '').trim();
  const spiritName =
    rawSpiritName && !isAiTodoText(rawSpiritName) && rawSpiritName !== '未展露' ? rawSpiritName : '所属武魂';
  const typeText = String(context?.type || '').trim();
  const foodHint = typeText === '食物系' ? '食物系命名必须围绕该武魂名，不得替换为无关食材。' : '';
  return `待补全（填写魂技名；必须围绕【${spiritName}】同源命名并体现该武魂能力特征，禁止无关命名；若为造物承载类技能，此名称同时作为生成物名称。${foodHint}）`;
}

function 构建魂骨名称待生成提示词_V1(骨部位 = '魂骨') {
  const 安全部位 = String(骨部位 || '魂骨').trim() || '魂骨';
  return `待补全(名称格式：魂兽名+${安全部位}，例如暗金恐爪熊${安全部位})`;
}

function 是否有效魂骨来源_V1(value = '') {
  const 文本 = String(value || '').trim();
  if (!文本 || 文本 === '无' || 文本 === '未知') return false;
  if (isAiTodoText(文本)) return false;
  return true;
}

function 归一化魂骨名称_V1(名称 = '', 来源 = '', 骨部位 = '魂骨') {
  const 安全名称 = String(名称 || '').trim();
  const 安全部位 = String(骨部位 || '魂骨').trim() || '魂骨';
  if (是否有效魂骨来源_V1(来源)) {
    if (!安全名称 || isAiTodoText(安全名称) || /^【未鉴定之/.test(安全名称) || 安全名称 === '无') {
      return `${String(来源).trim()}${安全部位}`;
    }
    return 安全名称;
  }
  if (安全名称 && !/^【未鉴定之/.test(安全名称) && 安全名称 !== '无') return 安全名称;
  return 构建魂骨名称待生成提示词_V1(安全部位);
}

function createEmptySoulSpiritPowerPanel() {
  return {
    对标等级: 0,
    str: 0,
    def: 0,
    agi: 0,
    vit_max: 0,
    men_max: 0,
    sp_max: 0,
  };
}

var SOUL_SPIRIT_QUALITY_VALUES = Object.freeze(['F', 'D', 'C', 'B', 'A', 'S', 'S+']);
var SOUL_SPIRIT_QUALITY_MULTIPLIER_MAP = Object.freeze({
  F: 0.82,
  D: 0.9,
  C: 1.0,
  B: 1.08,
  A: 1.18,
  S: 1.32,
  'S+': 1.48,
});
var SOUL_SPIRIT_QUALITY_LEVEL_OFFSET_MAP = Object.freeze({ F: -6, D: -3, C: 0, B: 2, A: 5, S: 8, 'S+': 12 });
var SOUL_SPIRIT_SPECIES_CATEGORY_RULES = Object.freeze([
  {
    category: '海魂兽',
    keywords: ['海龙', '海蛇', '海马', '海魂', '鲸', '鲨', '鱼', '龟', '蟹', '虾', '贝', '章鱼', '水母', '鳗'],
  },
  { category: '龙类', keywords: ['真龙', '圣龙', '祖龙', '龙王', '龙皇', '应龙', '蛟龙', '蛟', '龙'] },
  { category: '蛛类', keywords: ['蛛', '蜘蛛'] },
  { category: '熊类', keywords: ['熊', '罴'] },
  { category: '鸟类', keywords: ['凤凰', '凤', '凰', '鸟', '鹰', '雕', '鹏', '鹤', '雀', '鸦', '隼'] },
  { category: '猫科', keywords: ['猫', '虎', '狮', '豹', '猞猁'] },
  { category: '蛇类', keywords: ['蛇', '蟒', '蚺'] },
  { category: '植物系', keywords: ['蓝银', '草', '藤', '树', '木', '花', '莲', '竹', '蘑', '植物'] },
]);

function normalizeSoulSpiritQuality(value = '') {
  const text = String(value || '')
    .trim()
    .toUpperCase()
    .replace('＋', '+')
    .replace(/\s+/g, '');
  return SOUL_SPIRIT_QUALITY_VALUES.includes(text) ? text : '';
}

function resolveSoulSpiritSpeciesCategory(species = '') {
  const text = String(species || '').trim();
  if (!text || text === '未知' || text === '未展露' || isAiTodoText(text)) return '未知';
  const direct = ['龙类', '蛛类', '熊类', '植物系', '海魂兽', '鸟类', '猫科', '蛇类'].find(item => item === text);
  if (direct) return direct;
  const matched = SOUL_SPIRIT_SPECIES_CATEGORY_RULES.find(rule =>
    rule.keywords.some(keyword => text.includes(keyword)),
  );
  return matched?.category || '未知';
}

function inferSoulSpiritQuality(武魂 = {}) {
  const age = Math.max(0, Number(武魂?.年限 || 0));
  const species = String(武魂?.表象名称 || '').trim();
  const 状态 = String(武魂?.状态 || '').trim();
  if (age <= 0 && (!species || species === '未展露' || isAiTodoText(species))) return '';

  let score = 2;
  if (age >= 200000) score += 3;
  else if (age >= 100000) score += 2;
  else if (age >= 10000) score += 1;
  else if (age > 0 && age < 30) score -= 2;
  else if (age > 0 && age < 100) score -= 1;

  if (/(真龙|圣龙|祖龙|龙王|龙皇|神兽|麒麟|凤凰|鲲鹏|比蒙|银龙|金龙)/.test(species)) score += 2;
  else if (/(龙|凤|凰|王|皇|帝|君|圣|天狐|九尾|泰坦|邪眼)/.test(species)) score += 1;
  else if (/(草|藤|虫|鼠|兔|雀|蚁)/.test(species)) score -= 1;

  if (/(残|衰|濒死|破碎|虚弱)/.test(状态)) score -= 1;
  return SOUL_SPIRIT_QUALITY_VALUES[_.clamp(score, 0, SOUL_SPIRIT_QUALITY_VALUES.length - 1)] || '';
}

function buildSoulSpiritDescriptionTodoText(武魂 = {}) {
  const species = String(武魂?.表象名称 || '').trim();
  const quality = normalizeSoulSpiritQuality(武魂?.品质 || '');
  const age = Math.max(0, Math.floor(Number(武魂?.年限 || 0)));
  const category = resolveSoulSpiritSpeciesCategory(species);
  const segments = [];
  if (species && species !== '未展露' && !isAiTodoText(species)) segments.push(`物种=${species}`);
  if (age > 0) segments.push(`年限=${age}年`);
  if (quality) segments.push(`品质=${quality}`);
  if (category !== '未知') segments.push(`类别=${category}`);
  if (!segments.length) return AI_TODO_SOUL_SPIRIT_DESC;
  return `待补全（请结合${segments.join('；')}补全魂灵外形、血脉特征、行动风格与能力倾向，避免空泛套话）`;
}

function syncSoulSpiritRuntimeData(武魂 = {}) {
  if (!武魂 || typeof 武魂 !== 'object') return 武魂;
  const currentQualityText = String(武魂?.品质 || '').trim();
  const explicitQuality = normalizeSoulSpiritQuality(currentQualityText);
  武魂.品质 = explicitQuality || currentQualityText || AI_TODO_SOUL_SPIRIT_QUALITY;

  const currentDesc = String(武魂.描述 || '').trim();
  if (!currentDesc || currentDesc === '无' || isAiTodoText(currentDesc) || currentDesc.startsWith('待补全')) {
    武魂.描述 = buildSoulSpiritDescriptionTodoText({
      ...武魂,
      品质: explicitQuality || inferSoulSpiritQuality(武魂) || 武魂.品质,
    });
  }

  const visibleSpecies =
    !isAiTodoText(武魂.表象名称) && String(武魂.表象名称 || '').trim() && 武魂.表象名称 !== '未展露'
      ? String(武魂.表象名称).trim()
      : '未知';
  const hasReadyDescription =
    currentDesc &&
    currentDesc !== '无' &&
    !isAiTodoText(currentDesc) &&
    !currentDesc.startsWith('待补全');
  const shouldExposePowerPanel = Number(武魂.年限 || 0) > 0 && visibleSpecies !== '未知' && !!explicitQuality && hasReadyDescription;
  if (!shouldExposePowerPanel) {
    delete 武魂.战力面板;
    return 武魂;
  }

  if (!武魂.战力面板 || typeof 武魂.战力面板 !== 'object') {
    武魂.战力面板 = createEmptySoulSpiritPowerPanel();
  }
  const stats = getBeastStats(武魂.年限, visibleSpecies, explicitQuality);
  武魂.战力面板.对标等级 = Number(stats.对标等级 || 0);
  武魂.战力面板.str = Number(stats.str || 0);
  武魂.战力面板.def = Number(stats.def || 0);
  武魂.战力面板.agi = Number(stats.agi || 0);
  武魂.战力面板.vit_max = Number(stats.vit_max || 0);
  武魂.战力面板.men_max = Number(stats.men_max || 0);
  武魂.战力面板.sp_max = Number(stats.sp_max || 0);
  return 武魂;
}

var SILVER_DRAGON_NINE_ELEMENTS = ['水', '火', '风', '土', '光', '暗', '空间', '创造', '毁灭'];
var WUXING_ELEMENT_SEQUENCE = ['金', '木', '水', '火', '土'];
var BASIC_SKILL_ATTRIBUTE_SEQUENCE = Object.freeze(['金', '木', '水', '火', '土', '风', '雷', '冰']);
var ADVANCED_SKILL_ATTRIBUTE_SEQUENCE = Object.freeze(['光', '暗', '精神']);
var SUPREME_SKILL_ATTRIBUTE_SEQUENCE = Object.freeze(['空间', '时间']);
var ARCANA_SKILL_ATTRIBUTE_SEQUENCE = Object.freeze(['创造', '毁灭']);
var ELEMENT_ATTRIBUTE_SEQUENCE = Object.freeze([
  ...BASIC_SKILL_ATTRIBUTE_SEQUENCE,
  ...ADVANCED_SKILL_ATTRIBUTE_SEQUENCE,
  ...SUPREME_SKILL_ATTRIBUTE_SEQUENCE,
  ...ARCANA_SKILL_ATTRIBUTE_SEQUENCE,
]);
var SKILL_ATTRIBUTE_SEQUENCE = Object.freeze([...ELEMENT_ATTRIBUTE_SEQUENCE, '五行']);
var SUPPORTED_ELEMENT_TOKENS = Object.freeze([...ELEMENT_ATTRIBUTE_SEQUENCE]);

function createSpiritElementProfile(seed = {}) {
  const rawElements = Array.isArray(seed?.elements) ? seed.elements : [];
  const elements = Array.from(new Set(rawElements.map(item => String(item || '').trim()).filter(Boolean)));
  const rawMastery = Number(seed?.mastery || 0);
  const system = String(seed?.system || (elements.length ? '元素' : '无属性'));
  const rawControlTier = Number(seed?.controlTier ?? (system === '元素' ? elements.length : 0));
  const rawWuxingTier = Number(
    seed?.wuxingTier ??
      (system === '五行' ? elements.filter(item => WUXING_ELEMENT_SEQUENCE.includes(item)).length : 0),
  );
  const controlTier = Math.max(0, Math.min(9, Number.isFinite(rawControlTier) ? Math.round(rawControlTier) : 0));
  const wuxingTier = Math.max(0, Math.min(5, Number.isFinite(rawWuxingTier) ? Math.round(rawWuxingTier) : 0));
  const derivedMode =
    system === '五行'
      ? wuxingTier >= 5
        ? '五行轮转'
        : wuxingTier === 4
          ? '四行压场'
          : wuxingTier === 3
            ? '三行扩链'
            : wuxingTier === 2
              ? '二行成链'
              : wuxingTier === 1
                ? '一行调用'
                : '无属性'
      : system === '元素'
        ? controlTier >= 9
          ? '九元素掌控'
          : controlTier >= 7
            ? '七元素掌控'
            : controlTier === 5
              ? '五元素掌控'
              : controlTier === 4
                ? '四元素掌控'
                : controlTier === 3
                  ? '三元素掌控'
                  : controlTier === 2
                    ? '双元素掌控'
                    : controlTier === 1
                      ? '单元素'
                      : '无属性'
        : '无属性';
  return {
    system,
    mode: String(seed?.mode || derivedMode),
    elements,
    controlTier,
    wuxingTier,
    polarityUnlocked: !!seed?.polarityUnlocked,
    polarityMode: String(seed?.polarityMode || '无'),
    mastery: Math.max(0, Math.min(100, Number.isFinite(rawMastery) ? rawMastery : 0)),
  };
}

function normalizeElementToken(token = '') {
  const text = String(token || '').trim();
  if (!text) return '';
  const aliasMap = {
    光明: '光',
    黑暗: '暗',
    创世: '创造',
    灭世: '毁灭',
    大地: '土',
    寒冰: '冰',
    冰霜: '冰',
  };
  const normalized = aliasMap[text] || text;
  return SUPPORTED_ELEMENT_TOKENS.includes(normalized) ? normalized : '';
}

function sortAttributeTokensBySequence(tokens = [], sequence = []) {
  const orderMap = new Map((Array.isArray(sequence) ? sequence : []).map((token, index) => [token, index]));
  return [...(Array.isArray(tokens) ? tokens : [])].sort((left, right) => {
    const leftOrder = orderMap.has(left) ? orderMap.get(left) : Number.MAX_SAFE_INTEGER;
    const rightOrder = orderMap.has(right) ? orderMap.get(right) : Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return String(left).localeCompare(String(right), 'zh-Hans-CN');
  });
}

function normalizeSkillAttributeToken(token = '') {
  const text = String(token || '').trim();
  if (!text) return '';
  if (text === '五行') return '五行';
  return normalizeElementToken(text);
}

function tokenizeElementText(raw = '') {
  const text = String(raw || '').trim();
  if (!text || text === '无' || isAiTodoText(text)) return [];
  if (/九大?元素|九元素/.test(text)) return [...SILVER_DRAGON_NINE_ELEMENTS];
  if (/五行/.test(text)) return [...WUXING_ELEMENT_SEQUENCE];
  const expanded = text
    .replace(/[、,，|｜+＋]/g, '/')
    .replace(/多元素混合|多元素掌控/g, '')
    .replace(/\s+/g, '/');
  return Array.from(new Set(expanded.split('/').map(normalizeElementToken).filter(Boolean)));
}

function normalizeAttributeTokenArray(value) {
  const rawList = Array.isArray(value) ? value : tokenizeElementText(value);
  return sortAttributeTokensBySequence(
    Array.from(new Set((Array.isArray(rawList) ? rawList : []).map(normalizeElementToken).filter(Boolean))),
    ELEMENT_ATTRIBUTE_SEQUENCE,
  );
}

function normalizeSkillAttachedAttributeArray(value = []) {
  const rawList = Array.isArray(value) ? value : [];
  return sortAttributeTokensBySequence(
    Array.from(new Set(rawList.map(normalizeSkillAttributeToken).filter(Boolean))),
    SKILL_ATTRIBUTE_SEQUENCE,
  );
}

function normalizeSkillStringArray(value = []) {
  const rawList = Array.isArray(value) ? value : [];
  return Array.from(new Set(rawList.map(item => String(item || '').trim()).filter(Boolean)));
}

function normalizeSpiritAttributeState(spiritData = {}, spiritName = '', ownerChar = {}) {
  void spiritName;
  void ownerChar;
  const rawSystem = String(spiritData?.属性体系 || '').trim();
  const explicitSystem = isAiTodoText(rawSystem) ? '' : rawSystem;
  const rawCallableElements = spiritData?.可调用元素;
  const explicitCallableElements = normalizeAttributeTokenArray(rawCallableElements);
  if (explicitSystem || explicitCallableElements.length) {
    const system = ['元素', '五行'].includes(explicitSystem) ? explicitSystem : '无';
    let callableElements = explicitCallableElements;
    if (!callableElements.length) {
      if (system === '五行') callableElements = [...WUXING_ELEMENT_SEQUENCE];
      else if (system === '无' && rawSystem === '无') callableElements = ['无'];
      else callableElements = [AI_TODO_CALLABLE_ELEMENTS];
    }
    return { 属性体系: system, 可调用元素: callableElements };
  }
  return { 属性体系: AI_TODO_ATTRIBUTE_SYSTEM, 可调用元素: [AI_TODO_CALLABLE_ELEMENTS] };
}

function shouldKeepExtendedBloodlineData(charName = '', charData = null) {
  const 血脉名 = String(charData?.血脉之力?.血脉 || '').trim();
  return ['金龙王', '银龙王', '龙神'].some(关键词 => 血脉名.includes(关键词));
}

function 清理银龙王血脉字段_V1(血脉 = null) {
  if (!血脉 || typeof 血脉 !== 'object' || Array.isArray(血脉)) return;
  const 血脉名 = String(血脉.血脉 || '').trim();
  if (!血脉名.includes('银龙王') || 血脉名.includes('金龙王') || 血脉名.includes('龙神')) return;
  delete 血脉.解封层数;
  delete 血脉.核心;
  delete 血脉.生命之火;
  delete 血脉.永久加成;
  delete 血脉.气血魂环;
  Object.keys(血脉).forEach(键 => {
    if (是气血魂环槽位键_V1(键)) delete 血脉[键];
  });
  if (!血脉.技能 || typeof 血脉.技能 !== 'object' || Array.isArray(血脉.技能)) 血脉.技能 = {};
  if (!血脉.被动 || typeof 血脉.被动 !== 'object' || Array.isArray(血脉.被动)) 血脉.被动 = {};
}

function pruneExtendedBloodlineData(charData = null, charName = '') {
  if (!charData || typeof charData !== 'object') return;
  if (shouldKeepExtendedBloodlineData(charName, charData)) return;
  const bloodline = charData.血脉之力;
  if (!bloodline || typeof bloodline !== 'object') return;
  delete bloodline.解封层数;
  delete bloodline.核心;
  delete bloodline.技能;
  delete bloodline.被动;
  delete bloodline.永久加成;
  Object.keys(bloodline).forEach(键 => {
    if (是气血魂环槽位键_V1(键)) delete bloodline[键];
  });
}

function 写入内置血脉技能模板_V1(技能表 = {}, 技能名 = '', 模板技能 = null) {
  if (!技能表 || typeof 技能表 !== 'object' || Array.isArray(技能表) || !模板技能) return;
  const 原技能 = 技能表[技能名] && typeof 技能表[技能名] === 'object' && !Array.isArray(技能表[技能名])
    ? 技能表[技能名]
    : {};
  const 下个技能 = cloneSkillStructData(模板技能);
  ['魂技名', '画面描述', '效果描述'].forEach(字段名 => {
    const 模板文本 = String(模板技能?.[字段名] || '').trim();
    if (模板文本) 下个技能[字段名] = 模板文本;
  });
  ['状态', '场外冷却至tick', '技能掌控度'].forEach(字段名 => {
    if (原技能[字段名] !== undefined) 下个技能[字段名] = cloneJsonValue(原技能[字段名]);
  });
  技能表[技能名] = 下个技能;
}

function 同步银龙王血脉技能模板_V1(血脉 = null) {
  if (!血脉 || typeof 血脉 !== 'object' || Array.isArray(血脉)) return;
  const 血脉名 = String(血脉.血脉 || '').trim();
  if (!血脉名.includes('银龙王') || 血脉名.includes('金龙王') || 血脉名.includes('龙神')) return;
  if (!血脉.技能 || typeof 血脉.技能 !== 'object' || Array.isArray(血脉.技能)) 血脉.技能 = {};
  Object.entries(银龙王血脉技能_V1).forEach(([技能名, 模板技能]) => {
    写入内置血脉技能模板_V1(血脉.技能, 技能名, 模板技能);
  });
  清理银龙王血脉字段_V1(血脉);
}

function 同步金龙王血脉技能模板_V1(血脉 = null) {
  if (!血脉 || typeof 血脉 !== 'object' || Array.isArray(血脉)) return;
  if (!String(血脉.血脉 || '').includes('金龙王')) return;
  const 解封层数 = Math.max(0, Math.floor(Number(血脉.解封层数 || 0)) || 0);
  if (!血脉.技能 || typeof 血脉.技能 !== 'object' || Array.isArray(血脉.技能)) 血脉.技能 = {};
  if (!血脉.被动 || typeof 血脉.被动 !== 'object' || Array.isArray(血脉.被动)) 血脉.被动 = {};
  const 固定名称 = new Set([
    ...Object.values(GoldenDragonSkills || {})
      .map(技能 => 技能?.魂技名 || 技能?.技能名称 || 技能?.name)
      .filter(Boolean),
    ...Array.from(GOLDEN_DRAGON_NON_SKILL_NODE_NAMES),
  ]);
  固定名称.forEach(名称 => {
    delete 血脉.技能[名称];
    delete 血脉.被动[名称];
  });
  for (let 层级 = 1; 层级 <= 解封层数; 层级 += 1) {
    const 模板技能 = GoldenDragonSkills[层级];
    if (!模板技能) continue;
    const 技能名 = String(模板技能.魂技名 || 模板技能.技能名称 || 模板技能.name || '').trim();
    if (!技能名) continue;
    const 技能表 = 金龙王血脉被动层级集合_V1.has(层级) ? 血脉.被动 : 血脉.技能;
    写入内置血脉技能模板_V1(技能表, 技能名, 模板技能);
  }
}

function 同步内置血脉技能模板_V1(charData = null) {
  if (!charData || typeof charData !== 'object' || !charData.血脉之力 || typeof charData.血脉之力 !== 'object') return;
  同步金龙王血脉技能模板_V1(charData.血脉之力);
  同步银龙王血脉技能模板_V1(charData.血脉之力);
}

var LIFE_FIRE_STATE_CACHE = Object.create(null);
var COMBAT_DEATH_STATE_CACHE = Object.create(null);

function buildElementProfileFromAttributeState(attributeState = {}, existingProfile = {}) {
  const rawSystem = String(attributeState?.属性体系 || '无').trim();
  const system = ['元素', '五行'].includes(rawSystem) ? rawSystem : '无';
  const profileElements = normalizeAttributeTokenArray(attributeState?.可调用元素);
  const controlTier = system === '元素' ? profileElements.length : 0;
  const wuxingTier =
    system === '五行' ? profileElements.filter(attr => WUXING_ELEMENT_SEQUENCE.includes(attr)).length : 0;
  return createSpiritElementProfile({
    system: system === '无' ? '无属性' : system,
    elements: profileElements,
    controlTier,
    wuxingTier,
    polarityUnlocked: !!existingProfile?.polarityUnlocked,
    polarityMode: String(existingProfile?.polarityMode || '无'),
    mastery: Number(existingProfile?.mastery || 0),
  });
}

function mergeSpiritAttributeStates(attributeStates = []) {
  const states = (Array.isArray(attributeStates) ? attributeStates : []).filter(state => state && typeof state === 'object');
  const callableElements = normalizeAttributeTokenArray(states.flatMap(state => state.可调用元素 || []));
  const hasWuxingSystem =
    states.some(state => String(state.属性体系 || '').trim() === '五行') ||
    callableElements.some(attr => WUXING_ELEMENT_SEQUENCE.includes(attr));
  const hasElementSystem =
    states.some(state => ['元素', '五行'].includes(String(state.属性体系 || '').trim())) ||
    callableElements.length > 0;
  return {
    属性体系: hasWuxingSystem ? '五行' : hasElementSystem ? '元素' : '无',
    可调用元素: callableElements,
  };
}

function safeEntries(obj) {
  return obj && typeof obj === 'object' ? Object.entries(obj) : [];
}

function buildCharacterCustomSkillAttributeState(char = {}) {
  const spiritStates = 取角色武魂条目_V1(char).map(([spiritKey, spiritData]) =>
    normalizeSpiritAttributeState(spiritData, spiritKey, char),
  );
  const 基础属性状态 = mergeSpiritAttributeStates(spiritStates);
  const 技能附带属性集合 = [];
  const 追加技能图谱附带属性 = 技能图谱 => {
    技能附带属性集合.push(...collectSkillMapAttachedAttributes(技能图谱));
  };
  取角色武魂条目_V1(char).forEach(([, spiritData]) => {
    取武魂全部魂环条目_V1(spiritData).forEach(({ 魂环数据 }) => {
      追加技能图谱附带属性(Object.fromEntries(取魂环魂技条目_V1(魂环数据)));
    });
  });
  safeEntries(char?.魂骨 || {}).forEach(([, boneData]) => {
    追加技能图谱附带属性(boneData?.附带技能);
  });
  追加技能图谱附带属性(char?.血脉之力?.技能);
  追加技能图谱附带属性(char?.血脉之力?.被动);
  追加技能图谱附带属性(char?.自创魂技);

  const 技能附带属性列表 = normalizeAttributeTokenArray(技能附带属性集合);
  if (!技能附带属性列表.length) return 基础属性状态;

  const 技能附带属性状态 = {
    属性体系: 技能附带属性列表.some(属性 => WUXING_ELEMENT_SEQUENCE.includes(属性)) ? '五行' : '元素',
    可调用元素: 技能附带属性列表,
  };
  return mergeSpiritAttributeStates([基础属性状态, 技能附带属性状态]);
}

function getCombatParticipantName(participant = null) {
  return String(participant?.name || '').trim();
}

function collectBattleSideNames(battleData = {}, sideKey = 'enemy') {
  const participants = battleData?.参战者 && typeof battleData.参战者 === 'object' ? battleData.参战者 : {};
  const result = [];
  const teamKey = sideKey === 'player' ? 'team_player' : sideKey === 'enemy' ? 'team_enemy' : '';
  const team = teamKey ? participants[teamKey] : null;
  if (Array.isArray(team)) {
    team.forEach(member => {
      const name = getCombatParticipantName(member);
      if (name) result.push(name);
    });
  }
  return result;
}

function pickUniqueWeightedRandom(entries = [], count = 1) {
  const pool = (Array.isArray(entries) ? entries : [])
    .map(entry => ({
      value: entry?.value,
      weight: Math.max(0, Number(entry?.weight || 0)),
    }))
    .filter(entry => entry.value && entry.weight > 0);
  const result = [];
  while (pool.length > 0 && result.length < count) {
    const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
    if (!(totalWeight > 0)) break;
    let roll = Math.random() * totalWeight;
    let pickedIndex = 0;
    for (let index = 0; index < pool.length; index += 1) {
      roll -= pool[index].weight;
      if (roll <= 0) {
        pickedIndex = index;
        break;
      }
    }
    result.push(pool[pickedIndex].value);
    pool.splice(pickedIndex, 1);
  }
  return result;
}

function buildSecondaryWeightedPool(main = '', type = '强攻系', preferredSecondary = []) {
  const mainSet = new Set(SKILL_SECONDARY_BY_MAIN_V1[main] || []);
  const typePotentialSet = new Set(getPotentialSecondaryOptionsByType(type));
  const typeBiasSet = new Set(SKILL_SECONDARY_TYPE_BIAS_V1[type] || []);
  const preferredSet = new Set(
    (Array.isArray(preferredSecondary) ? preferredSecondary : [])
      .map(item => String(item || '').trim())
      .filter(item =>
        SOUL_SPIRIT_SECONDARY_OPTIONS_V1.includes(item) &&
        SKILL_MECHANISM_META_V1[item]?.可副机制 === true &&
        机制具备共享原型编译_V1(item),
      ),
  );
  return SOUL_SPIRIT_SECONDARY_OPTIONS_V1.map(option => {
    let weight = 1;
    if (mainSet.has(option)) weight += 7;
    if (typePotentialSet.has(option)) weight += 2;
    if (typeBiasSet.has(option)) weight += 4;
    if (preferredSet.has(option)) weight += 10;
    return { value: option, weight };
  }).filter(entry =>
    entry.weight > 0 &&
    SKILL_MECHANISM_META_V1[String(entry.value || '').trim()]?.可副机制 === true &&
    机制具备共享原型编译_V1(entry.value),
  );
}

function getBattleRewardRecipientName(data = {}, defeatedName = '') {
  const targetName = String(defeatedName || '').trim();
  if (!targetName) return '';
  const battleData = data?.world?.战斗 && typeof data.world.战斗 === 'object' ? data.world.战斗 : null;
  if (!battleData) return '';
  const enemyNames = collectBattleSideNames(battleData, 'enemy');
  if (!enemyNames.includes(targetName)) return '';
  const playerNames = collectBattleSideNames(battleData, 'player');
  return playerNames[0] || '';
}

function getCombatSpeciesFlags(char = {}) {
  const social = char?.社交 && typeof char.社交 === 'object' ? char.社交 : {};
  const factionMap = social?.势力 && typeof social.势力 === 'object' ? social.势力 : {};
  const factionNames = Object.keys(factionMap);
  const age = Math.max(0, Math.floor(Number(char?.属性?.年龄 || 0)));
  const isBeast =
    factionNames.includes('魂兽一族') ||
    factionNames.some(name => String(name || '').includes('魂兽')) ||
    age >= 100;
  const isAbyss =
    factionNames.includes('深渊生物') ||
    factionNames.some(name => String(name || '').includes('深渊'));
  return { isBeast, isAbyss, age };
}

function settleInternalAbyssKillReward(data = {}, winner = {}, winnerName = '', defeated = {}, defeatedName = '') {
  const level = String(defeated?.级别 || defeated?.属性?.级别 || '').trim();
  let pts = 0;
  if (level === '低阶生物') pts = 10;
  else if (level === '中阶生物') pts = 100;
  else if (level === '高阶生物') pts = 1000;
  else if (level === '深渊王者') pts = 50000;
  if (pts <= 0) {
    追加系统播报文本(data, `[深渊战功] ${winnerName} 击杀【${defeatedName}】未识别级别，未获战功，军方评价不变。`);
    return;
  }
  if (!winner.财富 || typeof winner.财富 !== 'object') winner.财富 = {};
  winner.财富.战功 = Math.max(0, Number(winner.财富.战功 || 0) + pts);
  追加系统播报文本(data, `[深渊战功] ${winnerName} 击杀【${defeatedName}】，获得 ${pts} 点战功，军方记录已更新。`);
}

function getDeviationMultiplierValue(data = {}) {
  const raw = Number(data?.world?.偏差倍率 ?? 1);
  return Number.isFinite(raw) && raw >= 0 ? raw : 1;
}

function scaleDeviationDeltaValue(data = {}, rawDelta = 0) {
  const safeDelta = Number(rawDelta ?? 0);
  if (!Number.isFinite(safeDelta) || safeDelta === 0) return 0;
  return Number((safeDelta * getDeviationMultiplierValue(data)).toFixed(4));
}

function applyDeviationDeltaValue(data = {}, rawDelta = 0) {
  const scaledDelta = scaleDeviationDeltaValue(data, rawDelta);
  if (!data.world || typeof data.world !== 'object') data.world = {};
  const baseValue = Number(data.world.偏差值 || 0);
  const nextValue = (Number.isFinite(baseValue) ? baseValue : 0) + scaledDelta;
  data.world.偏差值 = Math.max(0, Number(nextValue.toFixed(4)));
  return scaledDelta;
}

function settleInternalSoulBeastReward(data = {}, winner = {}, winnerName = '', defeated = {}, defeatedName = '') {
  const age = Math.max(0, Math.floor(Number(defeated?.属性?.年龄 || defeated?.年限 || 0)));
  if (age <= 0) {
    追加系统播报文本(data, `[现实狩猎] ${winnerName} 击败了【${defeatedName}】，但未识别有效年限，背包无新增。`);
    return;
  }
  let msg = `[现实狩猎] ${winnerName} 击杀了【${defeatedName}】，魂环随现场消散，不写入背包。`;

  if (winner.状态?.位置 && String(winner.状态.位置).includes('星斗大森林')) {
    data.world.累计击杀年限 = Math.max(0, Number(data.world.累计击杀年限 || 0) + age);
    if (data.world.累计击杀年限 >= 1000000 && !data.world.兽潮已触发) {
      msg += `\n🚨 [大区警报] 星斗大森林魂兽死伤惨重(累计超100万年)，血腥气彻底引爆凶兽怒火！【兽潮】开始集结！`;
      data.world.兽潮已触发 = true;
    }
  }

  if (age >= 100000) {
    if (!winner.属性.状态效果 || typeof winner.属性.状态效果 !== 'object') winner.属性.状态效果 = {};
    winner.属性.状态效果['魂兽公敌'] = {
      类型: 'debuff',
      层数: 1,
      描述: '击杀顶级魂兽染上的极致怨气，野外魂兽仇恨锁定',
    };
    msg += `\n💀 [命运烙印] 击杀十万年/凶兽！烙上【魂兽公敌】印记！`;
  }

  追加系统播报文本(data, msg);
}

function normalizeSkillAttributeCoefficients(value = {}) {
  const fallback = { 掌控: 1, 威力: 1, 消耗: 1, 前摇: 1, 控制: 1, 速度: 1 };
  const normalized = { ...fallback };
  Object.keys(fallback).forEach(key => {
    const raw = Number(value?.[key] ?? fallback[key]);
    normalized[key] = Number.isFinite(raw) && raw > 0 ? raw : fallback[key];
  });
  return normalized;
}

var ATTRIBUTE_COEFF_MAP = Object.freeze({
  金: Object.freeze({ 掌控: 1.02, 威力: 1.08, 消耗: 1.0, 前摇: 0.98, 控制: 0.98, 速度: 1.02 }),
  木: Object.freeze({ 掌控: 1.08, 威力: 0.96, 消耗: 0.96, 前摇: 1.0, 控制: 1.05, 速度: 1.0 }),
  水: Object.freeze({ 掌控: 1.06, 威力: 0.98, 消耗: 0.95, 前摇: 1.0, 控制: 1.04, 速度: 1.0 }),
  火: Object.freeze({ 掌控: 0.96, 威力: 1.15, 消耗: 1.06, 前摇: 1.0, 控制: 0.95, 速度: 1.02 }),
  土: Object.freeze({ 掌控: 1.0, 威力: 1.05, 消耗: 1.0, 前摇: 1.04, 控制: 1.02, 速度: 0.95 }),
  风: Object.freeze({ 掌控: 1.0, 威力: 1.02, 消耗: 0.96, 前摇: 0.94, 控制: 0.98, 速度: 1.12 }),
  雷: Object.freeze({ 掌控: 1.0, 威力: 1.1, 消耗: 1.03, 前摇: 0.92, 控制: 0.98, 速度: 1.12 }),
  冰: Object.freeze({ 掌控: 1.04, 威力: 1.02, 消耗: 1.0, 前摇: 1.02, 控制: 1.12, 速度: 0.95 }),
  光: Object.freeze({ 掌控: 1.05, 威力: 1.03, 消耗: 0.98, 前摇: 0.98, 控制: 1.02, 速度: 1.0 }),
  暗: Object.freeze({ 掌控: 1.03, 威力: 1.08, 消耗: 1.02, 前摇: 0.98, 控制: 1.04, 速度: 1.0 }),
  精神: Object.freeze({ 掌控: 1.08, 威力: 1.02, 消耗: 1.0, 前摇: 0.98, 控制: 1.14, 速度: 1.0 }),
  空间: Object.freeze({ 掌控: 1.12, 威力: 1.0, 消耗: 1.08, 前摇: 0.96, 控制: 1.08, 速度: 1.02 }),
  时间: Object.freeze({ 掌控: 1.12, 威力: 1.0, 消耗: 1.08, 前摇: 0.9, 控制: 1.1, 速度: 1.08 }),
  创造: Object.freeze({ 掌控: 1.18, 威力: 1.12, 消耗: 1.1, 前摇: 1.0, 控制: 1.12, 速度: 1.0 }),
  毁灭: Object.freeze({ 掌控: 1.08, 威力: 1.22, 消耗: 1.14, 前摇: 1.04, 控制: 1.08, 速度: 0.98 }),
  五行: Object.freeze({ 掌控: 1.2, 威力: 1.16, 消耗: 0.92, 前摇: 0.95, 控制: 1.12, 速度: 1.04 }),
});

var SKILL_ATTRIBUTE_DIM_KEYS = Object.freeze(['掌控', '威力', '消耗', '前摇', '控制', '速度']);
var SKILL_ATTRIBUTE_SOURCE_VALUES = Object.freeze(['无', '自身操控', '魂技调用']);
var SKILL_ATTRIBUTE_ROLE_VALUES = Object.freeze(['无', '增幅器', '结构术式']);
var WUXING_TEN_STEM_TO_ELEMENT = Object.freeze({
  甲: '木',
  乙: '木',
  丙: '火',
  丁: '火',
  戊: '土',
  己: '土',
  庚: '金',
  辛: '金',
  壬: '水',
  癸: '水',
});
var ELEMENT_STRUCTURE_ROLE_COEFF_MAP = Object.freeze({
  核心元素: Object.freeze({ 掌控: 1.02, 威力: 1.08, 消耗: 1.03, 前摇: 1.01, 控制: 1.01, 速度: 1.0 }),
  驱动元素: Object.freeze({ 掌控: 1.08, 威力: 1.01, 消耗: 0.98, 前摇: 0.94, 控制: 1.0, 速度: 1.08 }),
  约束元素: Object.freeze({ 掌控: 1.06, 威力: 1.02, 消耗: 0.97, 前摇: 1.0, 控制: 1.08, 速度: 0.96 }),
  触发元素: Object.freeze({ 掌控: 0.99, 威力: 1.1, 消耗: 1.02, 前摇: 0.95, 控制: 1.04, 速度: 1.04 }),
});
var ELEMENT_STRUCTURE_MODE_COEFF_MAP = Object.freeze({
  元素硬控: Object.freeze({ 掌控: 1.06, 威力: 1.05, 消耗: 1.04, 前摇: 1.02, 控制: 1.05, 速度: 1.02 }),
  单元素掌控: Object.freeze({ 掌控: 1.03, 威力: 1.03, 消耗: 0.98, 前摇: 0.97, 控制: 1.02, 速度: 1.01 }),
});
var SKILL_ROLE_COEFF_MAP = Object.freeze({
  增幅器: Object.freeze({ 掌控: 1.03, 威力: 1.06, 消耗: 0.96, 前摇: 0.97, 控制: 1.02, 速度: 1.02 }),
  结构术式: Object.freeze({ 掌控: 1.06, 威力: 1.02, 消耗: 0.97, 前摇: 0.99, 控制: 1.05, 速度: 1.0 }),
});
var WUXING_INVOCATION_MODE_COEFF_MAP = Object.freeze({
  一行调用: Object.freeze({ 掌控: 1.02, 威力: 1.01, 消耗: 0.99, 前摇: 0.99, 控制: 1.01, 速度: 1.0 }),
  二行成链: Object.freeze({ 掌控: 1.05, 威力: 1.04, 消耗: 0.97, 前摇: 0.98, 控制: 1.03, 速度: 1.0 }),
  三行扩链: Object.freeze({ 掌控: 1.08, 威力: 1.07, 消耗: 0.95, 前摇: 0.97, 控制: 1.06, 速度: 1.0 }),
  四行压场: Object.freeze({ 掌控: 1.12, 威力: 1.11, 消耗: 0.93, 前摇: 0.96, 控制: 1.1, 速度: 1.01 }),
  五行轮转: Object.freeze({ 掌控: 1.18, 威力: 1.18, 消耗: 0.9, 前摇: 0.94, 控制: 1.14, 速度: 1.02 }),
  相生循环: Object.freeze({ 掌控: 1.2, 威力: 1.2, 消耗: 0.89, 前摇: 0.93, 控制: 1.15, 速度: 1.02 }),
  逆演归一: Object.freeze({ 掌控: 1.1, 威力: 1.12, 消耗: 1.08, 前摇: 1.05, 控制: 1.08, 速度: 0.98 }),
  阴阳合璧: Object.freeze({ 掌控: 1.12, 威力: 1.15, 消耗: 1.1, 前摇: 1.06, 控制: 1.1, 速度: 1.0 }),
});
var WUXING_RELATION_COEFF_MAP = Object.freeze({
  二链: Object.freeze({ 掌控: 1.03, 威力: 1.02, 消耗: 0.99, 前摇: 0.99, 控制: 1.02, 速度: 1.0 }),
  三链: Object.freeze({ 掌控: 1.05, 威力: 1.04, 消耗: 0.98, 前摇: 0.98, 控制: 1.04, 速度: 1.0 }),
  四链: Object.freeze({ 掌控: 1.08, 威力: 1.07, 消耗: 0.96, 前摇: 0.97, 控制: 1.07, 速度: 1.0 }),
  闭环: Object.freeze({ 掌控: 1.08, 威力: 1.03, 消耗: 0.94, 前摇: 0.96, 控制: 1.04, 速度: 0.99 }),
  回溯: Object.freeze({ 掌控: 1.06, 威力: 1.06, 消耗: 1.04, 前摇: 1.03, 控制: 1.06, 速度: 0.99 }),
});
var POLARITY_MODE_COEFF_MAP = Object.freeze({
  阴阳归一: Object.freeze({ 掌控: 1.08, 威力: 1.1, 消耗: 1.06, 前摇: 1.03, 控制: 1.08, 速度: 1.0 }),
  阴阳对冲: Object.freeze({ 掌控: 1.04, 威力: 1.12, 消耗: 1.08, 前摇: 1.02, 控制: 1.05, 速度: 1.02 }),
});

function multiplySkillAttributeCoefficientProfiles(list = []) {
  const profiles = (Array.isArray(list) ? list : []).map(profile => normalizeSkillAttributeCoefficients(profile || {}));
  if (!profiles.length) return normalizeSkillAttributeCoefficients();
  const multiplied = {};
  SKILL_ATTRIBUTE_DIM_KEYS.forEach(key => {
    multiplied[key] = profiles.reduce((product, profile) => product * Number(profile?.[key] ?? 1), 1);
  });
  return normalizeSkillAttributeCoefficients(multiplied);
}

function normalizeSkillAttributeSource(value = '', fallback = '无') {
  const text = String(value || '').trim();
  return SKILL_ATTRIBUTE_SOURCE_VALUES.includes(text) ? text : fallback;
}

function normalizeSkillRoleType(value = '', fallback = '无') {
  const text = String(value || '').trim();
  return SKILL_ATTRIBUTE_ROLE_VALUES.includes(text) ? text : fallback;
}

function normalizeSkillElementStructure(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    模式: String(source?.模式 || '无').trim() || '无',
    核心元素: normalizeSkillAttachedAttributeArray(source?.核心元素),
    驱动元素: normalizeSkillAttachedAttributeArray(source?.驱动元素),
    约束元素: normalizeSkillAttachedAttributeArray(source?.约束元素),
    触发元素: normalizeSkillAttachedAttributeArray(source?.触发元素),
    关系: Array.isArray(source?.关系) ? JSON.parse(JSON.stringify(source.关系)) : [],
  };
}

function hasSkillElementStructure(structure = {}) {
  const normalized = normalizeSkillElementStructure(structure);
  return (
    normalized.模式 !== '无' ||
    normalized.核心元素.length > 0 ||
    normalized.驱动元素.length > 0 ||
    normalized.约束元素.length > 0 ||
    normalized.触发元素.length > 0 ||
    normalized.关系.length > 0
  );
}

function collectSkillElementStructureAttributes(structure = {}) {
  const normalized = normalizeSkillElementStructure(structure);
  return Array.from(
    new Set([...normalized.核心元素, ...normalized.驱动元素, ...normalized.约束元素, ...normalized.触发元素]),
  );
}

function normalizeSkillWuxingInvocation(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    模式: String(source?.模式 || '无').trim() || '无',
    调用链: normalizeSkillStringArray(source?.调用链),
    回路闭合: !!source?.回路闭合,
    层级回溯: normalizeSkillStringArray(source?.层级回溯),
    终态: String(source?.终态 || '无').trim() || '无',
    结果: String(source?.结果 || '无').trim() || '无',
  };
}

function hasSkillWuxingInvocation(invocation = {}) {
  const normalized = normalizeSkillWuxingInvocation(invocation);
  return (
    normalized.模式 !== '无' ||
    normalized.调用链.length > 0 ||
    normalized.回路闭合 ||
    normalized.层级回溯.length > 0 ||
    normalized.终态 !== '无' ||
    normalized.结果 !== '无'
  );
}

function mapWuxingInvocationTokenToElement(token = '') {
  const text = String(token || '').trim();
  return WUXING_TEN_STEM_TO_ELEMENT[text] || normalizeElementToken(text);
}

function normalizeOrderedWuxingInvocationElements(list = []) {
  const source = Array.isArray(list) ? list : [];
  const ordered = [];
  const seen = new Set();
  source.forEach(token => {
    const attr = mapWuxingInvocationTokenToElement(token);
    if (!WUXING_ELEMENT_SEQUENCE.includes(attr) || seen.has(attr)) return;
    seen.add(attr);
    ordered.push(attr);
  });
  return ordered;
}

function resolveHighestLegalWuxingChain(list = []) {
  const ordered = normalizeOrderedWuxingInvocationElements(list);
  if (!ordered.length) return [];
  const available = new Set(ordered);
  const sequence = [...WUXING_ELEMENT_SEQUENCE, ...WUXING_ELEMENT_SEQUENCE];
  let best = [ordered[0]];
  for (let start = 0; start < WUXING_ELEMENT_SEQUENCE.length; start++) {
    const first = sequence[start];
    if (!available.has(first)) continue;
    const chain = [first];
    for (let step = 1; step < WUXING_ELEMENT_SEQUENCE.length; step++) {
      const next = sequence[start + step];
      if (!available.has(next) || chain.includes(next)) break;
      chain.push(next);
    }
    if (chain.length > best.length) best = chain;
  }
  return best;
}

function extractWuxingInvocationElements(invocation = {}) {
  const normalized = normalizeSkillWuxingInvocation(invocation);
  return resolveHighestLegalWuxingChain(normalized.调用链);
}

function normalizeSkillPolarityInfo(value = {}, fallback = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const fallbackMode = String(fallback?.polarityMode || fallback?.polarity || '无').trim() || '无';
  const fallbackUnlocked = !!(fallback?.polarityUnlocked || (fallbackMode && fallbackMode !== '无'));
  const normalizedMode = String(source?.polarityMode || source?.polarity || fallbackMode || '无').trim() || '无';
  return {
    polarityUnlocked: !!(source?.polarityUnlocked ?? fallbackUnlocked),
    polarityMode: normalizedMode,
  };
}

function hasSkillPolarityInfo(info = {}) {
  const normalized = normalizeSkillPolarityInfo(info);
  return normalized.polarityUnlocked || normalized.polarityMode !== '无';
}

function isNeutralSkillAttributeCoefficientProfile(coeff = {}) {
  const normalized = normalizeSkillAttributeCoefficients(coeff);
  return SKILL_ATTRIBUTE_DIM_KEYS.every(key => Math.abs(Number(normalized?.[key] ?? 1) - 1) < 0.0001);
}

function getStoredSkillSystemBase(skill = {}) {
  return skill && typeof skill === 'object' && !Array.isArray(skill) ? skill : {};
}

function getStoredSkillSystemBaseParam(skill = {}, key = '') {
  const systemBase = getStoredSkillSystemBase(skill);
  const params = systemBase?.参数;
  if (params && typeof params === 'object' && !Array.isArray(params) && params[key] !== undefined) return params[key];
  return systemBase[key];
}

function getStoredSkillElementStructure(skill = {}) {
  return normalizeSkillElementStructure(getStoredSkillSystemBaseParam(skill, '元素构型') || {});
}

function getStoredSkillWuxingInvocation(skill = {}) {
  return normalizeSkillWuxingInvocation(getStoredSkillSystemBaseParam(skill, '五行调用结构') || {});
}

function getStoredSkillPolarityInfo(skill = {}) {
  return normalizeSkillPolarityInfo(getStoredSkillSystemBaseParam(skill, '极性信息') || {});
}

function getStoredSkillAttributeCoefficients(skill = {}) {
  return normalizeSkillAttributeCoefficients(getStoredSkillSystemBaseParam(skill, '属性系数') || {});
}

function getStoredSkillDisplayElement(skill = {}) {
  return String(getStoredSkillSystemBaseParam(skill, '显示元素') || '').trim();
}

function formatSkillAttributeCoefficientSummaryText(coeff = {}) {
  const normalized = normalizeSkillAttributeCoefficients(coeff);
  const segments = SKILL_ATTRIBUTE_DIM_KEYS.map(key => {
    const value = Number(normalized?.[key] ?? 1);
    if (!Number.isFinite(value) || Math.abs(value - 1) < 0.001) return '';
    return `${key}×${formatSkillNumber(value, 2)}`;
  }).filter(Boolean);
  return segments.length ? `属性系数：${segments.join('，')}` : '';
}

function buildSkillElementStructureSummaryText(structure = {}) {
  const normalized = normalizeSkillElementStructure(structure);
  const segments = [];
  const allElements = Array.from(
    new Set([...normalized.核心元素, ...normalized.驱动元素, ...normalized.约束元素, ...normalized.触发元素]),
  );
  if (normalized.模式 && normalized.模式 !== '无') segments.push(`模式:${normalized.模式}`);
  if (normalized.核心元素.length) segments.push(`核心:${normalized.核心元素.join('/')}`);
  if (normalized.驱动元素.length) segments.push(`驱动:${normalized.驱动元素.join('/')}`);
  if (normalized.约束元素.length) segments.push(`约束:${normalized.约束元素.join('/')}`);
  if (normalized.触发元素.length) segments.push(`触发:${normalized.触发元素.join('/')}`);
  if (allElements.length) segments.push('门槛:高阶元素演化优先看可调用元素与魂力/精神力负荷');
  if (['水', '火', '风', '土'].every(token => allElements.includes(token)))
    segments.push('高阶提示:四基础元素齐备可导向元素剥离，雷仅是四元素归元后的法则性显化');
  if (['水', '火', '风', '土', '光', '暗', '空间'].every(token => allElements.includes(token)))
    segments.push('高阶提示:七元素爆裂须以水火风土光暗空间齐备为前提');
  return segments.length ? `构型：${segments.join('；')}` : '';
}

function buildSkillWuxingInvocationSummaryText(invocation = {}) {
  const normalized = normalizeSkillWuxingInvocation(invocation);
  const segments = [];
  const hasFullWuxing = WUXING_ELEMENT_SEQUENCE.every(token => normalized.调用链.includes(token));
  if (normalized.模式 && normalized.模式 !== '无') segments.push(`模式:${normalized.模式}`);
  if (normalized.调用链.length) segments.push(`调用链:${normalized.调用链.join('→')}`);
  if (normalized.回路闭合) segments.push('回路:闭环');
  if (normalized.层级回溯.length) segments.push(`回溯:${normalized.层级回溯.join('/')}`);
  if (normalized.终态 && normalized.终态 !== '无') segments.push(`终态:${normalized.终态}`);
  if (normalized.结果 && normalized.结果 !== '无') segments.push(`结果:${normalized.结果}`);
  if (normalized.调用链.length) segments.push('规则:五行调用按最高合法链理解，不按简单数量堆叠');
  if (normalized.调用链.length) segments.push('门槛:五行高阶演化优先看可调用元素与魂力/精神力负荷');
  if (hasFullWuxing) segments.push('高阶提示:金木水火土齐备后方可导向五行剥离/五行遁法');
  else if (normalized.调用链.length) segments.push('限制:未集齐金木水火土前，不得直接写五行剥离/五行遁法');
  return segments.length ? `术式：${segments.join('；')}` : '';
}

function buildSkillPolaritySummaryText(polarityInfo = {}) {
  const normalized = normalizeSkillPolarityInfo(polarityInfo);
  if (!normalized.polarityUnlocked && normalized.polarityMode === '无') return '';
  return `极性：${normalized.polarityMode && normalized.polarityMode !== '无' ? normalized.polarityMode : '已开启'}`;
}

function replaceSkillRuntimeSummaryEffects(skill = {}, summaryEffects = []) {
  void summaryEffects;
  const baseEffects = clonePackedSkillEffects(Array.isArray(skill?._效果数组) ? skill._效果数组 : []);
  skill._效果数组 = baseEffects;
  return skill;
}

function stripSkillLegacyRuntimeFields(skill = {}) {
  ['属性来源', '魂技作用', '属性系数', '元素构型', '五行调用结构', '极性信息'].forEach(key => {
    if (key in skill) delete skill[key];
  });
  return skill;
}

function buildSkillRuntimeSummaryEffects(runtime = {}) {
  void runtime;
  return [];
}

function buildSkillMasteryAdjustmentCoefficients(mastery = 0, source = '无') {
  const ratio = Math.max(0, Math.min(1, Number(mastery || 0) / 100));
  if (ratio <= 0) return normalizeSkillAttributeCoefficients();
  if (source === '魂技调用') {
    return normalizeSkillAttributeCoefficients({
      掌控: 1 + ratio * 0.06,
      威力: 1 + ratio * 0.03,
      消耗: Math.max(0.6, 1 - ratio * 0.04),
      前摇: Math.max(0.7, 1 - ratio * 0.03),
      控制: 1 + ratio * 0.05,
      速度: 1 + ratio * 0.01,
    });
  }
  if (source === '自身操控') {
    return normalizeSkillAttributeCoefficients({
      掌控: 1 + ratio * 0.08,
      威力: 1 + ratio * 0.04,
      消耗: Math.max(0.6, 1 - ratio * 0.05),
      前摇: Math.max(0.7, 1 - ratio * 0.04),
      控制: 1 + ratio * 0.04,
      速度: 1 + ratio * 0.03,
    });
  }
  return normalizeSkillAttributeCoefficients();
}

function buildElementStructureCoefficients(structure = {}, attachedAttributes = []) {
  const normalized = normalizeSkillElementStructure(structure);
  const roleProfiles = [];
  [
    ['核心元素', normalized.核心元素],
    ['驱动元素', normalized.驱动元素],
    ['约束元素', normalized.约束元素],
    ['触发元素', normalized.触发元素],
  ].forEach(([roleKey, attrs]) => {
    const elements = normalizeSkillAttachedAttributeArray(attrs);
    if (!elements.length) return;
    roleProfiles.push(
      multiplySkillAttributeCoefficientProfiles([
        buildSkillAttributeCoefficientsFromAttachedAttributes(elements),
        ELEMENT_STRUCTURE_ROLE_COEFF_MAP[roleKey] || normalizeSkillAttributeCoefficients(),
      ]),
    );
  });
  if (!roleProfiles.length) {
    const attached = normalizeSkillAttachedAttributeArray(attachedAttributes);
    if (attached.length) roleProfiles.push(buildSkillAttributeCoefficientsFromAttachedAttributes(attached));
  }
  const baseProfile = roleProfiles.length
    ? mergeAttributeCoefficientProfiles(roleProfiles)
    : normalizeSkillAttributeCoefficients();
  const modeProfile = ELEMENT_STRUCTURE_MODE_COEFF_MAP[normalized.模式] || normalizeSkillAttributeCoefficients();
  return multiplySkillAttributeCoefficientProfiles([baseProfile, modeProfile]);
}

function buildElementSkillAmplifierCoefficients(skill = {}, context = {}, attachedAttributes = [], profile = {}) {
  void context;
  void attachedAttributes;
  const roleCoeff =
    SKILL_ROLE_COEFF_MAP[normalizeSkillRoleType(skill?.魂技作用 || '', '无')] || normalizeSkillAttributeCoefficients();
  const masteryCoeff = buildSkillMasteryAdjustmentCoefficients(profile?.mastery || 0, '自身操控');
  return multiplySkillAttributeCoefficientProfiles([roleCoeff, masteryCoeff]);
}

function composeElementControlCoefficients(structureCoeff = {}, amplifierCoeff = {}) {
  return multiplySkillAttributeCoefficientProfiles([structureCoeff, amplifierCoeff]);
}

function buildWuxingInvocationCoefficients(invocation = {}, attachedAttributes = []) {
  const normalized = normalizeSkillWuxingInvocation(invocation);
  const invocationElements = extractWuxingInvocationElements(normalized);
  const attached = invocationElements.length
    ? invocationElements
    : normalizeSkillAttachedAttributeArray(attachedAttributes);
  const elementCoeff = attached.length
    ? buildSkillAttributeCoefficientsFromAttachedAttributes(attached)
    : normalizeSkillAttributeCoefficients();
  const modeCoeff = WUXING_INVOCATION_MODE_COEFF_MAP[normalized.模式] || normalizeSkillAttributeCoefficients();
  return multiplySkillAttributeCoefficientProfiles([elementCoeff, modeCoeff]);
}

function buildWuxingRelationCoefficients(invocation = {}) {
  const normalized = normalizeSkillWuxingInvocation(invocation);
  const invocationElements = extractWuxingInvocationElements(normalized);
  const hasFullWuxing = WUXING_ELEMENT_SEQUENCE.every(attr => invocationElements.includes(attr));
  const chainCount = invocationElements.filter(attr => WUXING_ELEMENT_SEQUENCE.includes(attr)).length;
  const relationCoeff =
    normalized.回路闭合 || hasFullWuxing
      ? WUXING_RELATION_COEFF_MAP.闭环
      : chainCount >= 4
        ? WUXING_RELATION_COEFF_MAP.四链
        : chainCount >= 3
          ? WUXING_RELATION_COEFF_MAP.三链
          : chainCount >= 2
            ? WUXING_RELATION_COEFF_MAP.二链
            : normalizeSkillAttributeCoefficients();
  const returnCoeff = normalized.层级回溯.includes('阴阳')
    ? WUXING_RELATION_COEFF_MAP.回溯
    : normalizeSkillAttributeCoefficients();
  return multiplySkillAttributeCoefficientProfiles([relationCoeff, returnCoeff]);
}

function buildPolarityReturnCoefficients(polarityInfo = {}) {
  const normalized = normalizeSkillPolarityInfo(polarityInfo);
  if (!normalized.polarityUnlocked && normalized.polarityMode === '无') return normalizeSkillAttributeCoefficients();
  return POLARITY_MODE_COEFF_MAP[normalized.polarityMode] || normalizeSkillAttributeCoefficients();
}

function composeWuxingInvocationCoefficients(
  invocationCoeff = {},
  relationCoeff = {},
  polarityCoeff = {},
  masteryCoeff = {},
) {
  return multiplySkillAttributeCoefficientProfiles([invocationCoeff, relationCoeff, polarityCoeff, masteryCoeff]);
}

function inferSkillAttributeSource(profile = {}, skill = {}, context = {}) {
  const explicit = normalizeSkillAttributeSource(getStoredSkillSystemBaseParam(skill, '属性来源') || '', '无');
  if (explicit !== '无') return explicit;
  const normalizedProfile = createSpiritElementProfile(profile);
  if (hasSkillWuxingInvocation(getStoredSkillWuxingInvocation(skill)) || normalizedProfile.system === '五行')
    return '魂技调用';
  if (
    hasSkillElementStructure(getStoredSkillElementStructure(skill)) ||
    normalizedProfile.system === '元素' ||
    String(context?.type || '').includes('元素')
  )
    return '自身操控';
  return '无';
}

function inferSkillRoleType(source = '无', skill = {}) {
  const explicit = normalizeSkillRoleType(getStoredSkillSystemBaseParam(skill, '魂技作用') || '', '无');
  if (explicit !== '无') return explicit;
  if (source === '魂技调用') return '结构术式';
  if (source === '自身操控') return '增幅器';
  return '无';
}

function finalizeSkillElementStructure(skill = {}, source = '无', attachedAttributes = []) {
  const normalized = getStoredSkillElementStructure(skill);
  if (source !== '自身操控') return normalized;
  const attached = normalizeSkillAttachedAttributeArray(attachedAttributes);
  const next = { ...normalized };
  if (!hasSkillElementStructure(next) && attached.length) next.核心元素 = [...attached];
  if ((!next.模式 || next.模式 === '无') && attached.length)
    next.模式 = attached.length > 1 ? '元素硬控' : '单元素掌控';
  return normalizeSkillElementStructure(next);
}

function finalizeSkillWuxingInvocation(skill = {}, source = '无', attachedAttributes = [], polarityInfo = {}) {
  const normalized = getStoredSkillWuxingInvocation(skill);
  if (source !== '魂技调用') return normalized;
  const attached = normalizeSkillAttachedAttributeArray(attachedAttributes);
  const next = { ...normalized };
  const seedChain = next.调用链.length ? next.调用链 : attached;
  const legalChain = resolveHighestLegalWuxingChain(seedChain);
  if (legalChain.length) next.调用链 = [...legalChain];
  else if (!next.调用链.length && attached.length) next.调用链 = [attached[0]];
  const chainCount = legalChain.length;
  const hasFullWuxing = chainCount >= 5 && WUXING_ELEMENT_SEQUENCE.every(attr => next.调用链.includes(attr));
  if (!next.模式 || next.模式 === '无') {
    if (polarityInfo?.polarityUnlocked || String(polarityInfo?.polarityMode || '无') !== '无') next.模式 = '逆演归一';
    else if (hasFullWuxing) next.模式 = '五行轮转';
    else if (chainCount >= 4) next.模式 = '四行压场';
    else if (chainCount >= 3) next.模式 = '三行扩链';
    else if (chainCount >= 2) next.模式 = '二行成链';
    else if (chainCount >= 1) next.模式 = '一行调用';
  }
  next.回路闭合 = !!((next.模式 === '相生循环' || next.模式 === '五行轮转') && next.调用链.length >= 5);
  return normalizeSkillWuxingInvocation(next);
}

function resolveSkillAttachedAttributes(
  skill = {},
  context = {},
  profile = {},
  source = '无',
  elementStructure = {},
  wuxingInvocation = {},
) {
  const explicitAttached = normalizeSkillAttachedAttributeArray(skill?.附带属性);
  if (explicitAttached.length) return explicitAttached;
  const structureAttrs = collectSkillElementStructureAttributes(elementStructure);
  if (source === '自身操控' && structureAttrs.length) return structureAttrs;
  const invocationAttrs = extractWuxingInvocationElements(wuxingInvocation);
  if (source === '魂技调用' && invocationAttrs.length) return invocationAttrs;
  void context;
  void profile;
  return [];
}

function buildSkillAttributeGateContext(context = {}) {
  const callableElements = normalizeSkillAttachedAttributeArray(
    context?.可调用元素 || context?.callableElements || context?.elementProfile?.elements || [],
  );
  return {
    callableElements,
  };
}

function applySkillAttachedAttributeHardGate(attachedAttributes = [], context = {}) {
  const gateContext = buildSkillAttributeGateContext(context);
  let filtered = normalizeSkillAttachedAttributeArray(attachedAttributes);
  const warnings = [];

  if (gateContext.callableElements.length) {
    const missingCallable = filtered.filter(attr => !gateContext.callableElements.includes(attr));
    if (missingCallable.length) {
      warnings.push(`硬拦截: 不在可调用元素内 ${missingCallable.join('/')}`);
      filtered = filtered.filter(attr => gateContext.callableElements.includes(attr));
    }
  }

  return {
    attachedAttributes: filtered,
    warnings,
    gateContext,
  };
}

function constrainSkillElementStructureByAttached(structure = {}, allowedAttributes = []) {
  const normalized = normalizeSkillElementStructure(structure);
  const allowed = new Set(normalizeSkillAttachedAttributeArray(allowedAttributes));
  if (!allowed.size) return normalized;

  const next = {
    ...normalized,
    核心元素: normalized.核心元素.filter(attr => allowed.has(attr)),
    驱动元素: normalized.驱动元素.filter(attr => allowed.has(attr)),
    约束元素: normalized.约束元素.filter(attr => allowed.has(attr)),
    触发元素: normalized.触发元素.filter(attr => allowed.has(attr)),
  };
  const hasAny = next.核心元素.length || next.驱动元素.length || next.约束元素.length || next.触发元素.length;
  if (!hasAny) {
    next.模式 = '无';
    next.关系 = [];
  }
  return normalizeSkillElementStructure(next);
}

function constrainSkillWuxingInvocationByAttached(invocation = {}, allowedAttributes = []) {
  const normalized = normalizeSkillWuxingInvocation(invocation);
  const allowed = new Set(
    normalizeSkillAttachedAttributeArray(allowedAttributes).filter(attr => WUXING_ELEMENT_SEQUENCE.includes(attr)),
  );
  if (!allowed.size) return normalized;

  const filteredChain = resolveHighestLegalWuxingChain(
    normalized.调用链.map(token => mapWuxingInvocationTokenToElement(token)).filter(attr => allowed.has(attr)),
  );
  const next = { ...normalized, 调用链: filteredChain };
  if (!filteredChain.length) {
    next.模式 = '无';
    next.回路闭合 = false;
    next.层级回溯 = [];
    next.终态 = '无';
    next.结果 = '无';
  } else if (filteredChain.length < 5) {
    next.回路闭合 = false;
  }
  return normalizeSkillWuxingInvocation(next);
}

function buildSkillAttributeCoefficientsV2(skill = {}, context = {}) {
  return buildSkillRuntimeAttributeContext(skill, context).attributeCoeff;
}

function buildSkillRuntimeAttributeContext(skill = {}, context = {}) {
  const profile =
    context?.elementProfile && typeof context.elementProfile === 'object'
      ? createSpiritElementProfile(context.elementProfile)
      : createSpiritElementProfile();
  const preResolvedAttached = normalizeSkillAttachedAttributeArray(skill?.附带属性);
  const source = normalizeSkillAttributeSource(inferSkillAttributeSource(profile, skill, context), '无');
  const role = normalizeSkillRoleType(inferSkillRoleType(source, skill), '无');
  const normalizedPolarity = normalizeSkillPolarityInfo(getStoredSkillPolarityInfo(skill), {
    polarityUnlocked: profile?.polarityUnlocked,
    polarityMode: profile?.polarityMode || '无',
  });
  const initialElementStructure = finalizeSkillElementStructure(skill, source, preResolvedAttached);
  const initialWuxingInvocation = finalizeSkillWuxingInvocation(skill, source, preResolvedAttached, normalizedPolarity);
  const resolvedAttached = resolveSkillAttachedAttributes(
    skill,
    context,
    profile,
    source,
    initialElementStructure,
    initialWuxingInvocation,
  );
  const gateResult = applySkillAttachedAttributeHardGate(resolvedAttached, context);
  const attached = normalizeSkillAttachedAttributeArray(gateResult.attachedAttributes);
  const elementStructure = constrainSkillElementStructureByAttached(
    finalizeSkillElementStructure(skill, source, attached),
    attached,
  );
  const wuxingInvocation = constrainSkillWuxingInvocationByAttached(
    finalizeSkillWuxingInvocation(skill, source, attached, normalizedPolarity),
    attached,
  );
  let attributeCoeff = getStoredSkillAttributeCoefficients(skill);

  if (source === '自身操控') {
    const hasEntry = attached.length > 0 || hasSkillElementStructure(elementStructure);
    if (hasEntry) {
      const structureCoeff = buildElementStructureCoefficients(elementStructure, attached);
      const amplifierCoeff = buildElementSkillAmplifierCoefficients({ 魂技作用: role }, context, attached, profile);
      attributeCoeff = composeElementControlCoefficients(structureCoeff, amplifierCoeff);
    }
  } else if (source === '魂技调用') {
    const hasEntry =
      attached.length > 0 || hasSkillWuxingInvocation(wuxingInvocation) || hasSkillPolarityInfo(normalizedPolarity);
    if (hasEntry) {
      const invocationCoeff = buildWuxingInvocationCoefficients(wuxingInvocation, attached);
      const relationCoeff = buildWuxingRelationCoefficients(wuxingInvocation);
      const polarityCoeff = buildPolarityReturnCoefficients(normalizedPolarity);
      const masteryCoeff = buildSkillMasteryAdjustmentCoefficients(profile?.mastery || 0, '魂技调用');
      attributeCoeff = composeWuxingInvocationCoefficients(invocationCoeff, relationCoeff, polarityCoeff, masteryCoeff);
    }
  } else if (isNeutralSkillAttributeCoefficientProfile(attributeCoeff)) {
    attributeCoeff = buildDefaultSkillAttributeCoefficients(profile, context, attached);
  }

  const displayElementLabel =
    getStoredSkillDisplayElement(skill) ||
    (attached.length ? attached.join('/') : getElementProfilePrimaryLabel(profile));
  return {
    profile,
    source,
    role,
    attachedAttributes: attached,
    elementStructure,
    wuxingInvocation,
    polarityInfo: normalizedPolarity,
    attributeCoeff,
    displayElementLabel: String(displayElementLabel || '无').trim() || '无',
  };
}

function mergeAttributeCoefficientProfiles(list = []) {
  const profiles = (Array.isArray(list) ? list : []).map(profile => normalizeSkillAttributeCoefficients(profile || {}));
  if (!profiles.length) return normalizeSkillAttributeCoefficients();
  const merged = {};
  const keys = Object.keys(normalizeSkillAttributeCoefficients());
  keys.forEach(key => {
    const total = profiles.reduce((sum, profile) => sum + Number(profile?.[key] ?? 1), 0);
    merged[key] = total / profiles.length;
  });
  return normalizeSkillAttributeCoefficients(merged);
}

function buildSkillAttributeCoefficientsFromAttachedAttributes(attachedAttributes = []) {
  const attached = normalizeSkillAttachedAttributeArray(attachedAttributes);
  if (!attached.length) return normalizeSkillAttributeCoefficients();
  const profiles = attached.map(attr => ATTRIBUTE_COEFF_MAP[attr] || normalizeSkillAttributeCoefficients());
  return mergeAttributeCoefficientProfiles(profiles);
}

function pickDeterministicAttributeToken(list = [], seed = '') {
  const pool = Array.from(new Set((Array.isArray(list) ? list : []).map(normalizeSkillAttributeToken).filter(Boolean)));
  if (!pool.length) return '';
  const text = String(seed || '').trim();
  if (!text) return pool[0];
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 131 + text.charCodeAt(i)) % 2147483647;
  }
  return pool[Math.abs(hash) % pool.length];
}

function collectSkillMapAttachedAttributes(skillMap = {}) {
  const collected = [];
  Object.values(skillMap || {}).forEach(skill => {
    collected.push(...normalizeSkillAttachedAttributeArray(skill?.附带属性));
  });
  return Array.from(new Set(collected));
}

function buildDefaultSkillAttributeCoefficients(profile = {}, context = {}, attachedAttributes = []) {
  void profile;
  void context;
  return buildSkillAttributeCoefficientsFromAttachedAttributes(attachedAttributes);
}

function getElementProfilePrimaryLabel(profile = {}) {
  const normalized = createSpiritElementProfile(profile);
  if (normalized.system === '五行')
    return normalized.wuxingTier >= 5 ? '五行' : normalized.wuxingTier > 0 ? `${normalized.wuxingTier}行` : '无';
  if (normalized.controlTier >= 9) return '九元素';
  if (normalized.controlTier >= 7) return '七元素';
  if (normalized.controlTier >= 2) return `${normalized.controlTier}元素`;
  if (normalized.controlTier === 1) return normalized.elements[0] || '无';
  return '无';
}

function applySkillElementInheritance(skill = {}, context = {}) {
  if (!skill || typeof skill !== 'object') return skill;
  if (!Array.isArray(skill._效果数组)) skill._效果数组 = [];
  const runtime = buildSkillRuntimeAttributeContext(skill, context);
  skill.附带属性 = runtime.attachedAttributes;
  stripSkillLegacyRuntimeFields(skill);
  return skill;
}

function normalizeFusionRuntimeParticipants(participants = []) {
  if (!Array.isArray(participants)) return [];
  return participants
    .map(participant => {
      const safeParticipant = participant && typeof participant === 'object' ? participant : {};
      const 类型文本 = String(safeParticipant.role || safeParticipant.类型 || safeParticipant.身份 || '').trim();
      return {
        role: 类型文本 === 'self' || /自身|自体|本体|自己/.test(类型文本) ? 'self' : 'partner',
        charKey: String(safeParticipant.charKey || safeParticipant.角色键 || '').trim(),
        charName: String(safeParticipant.charName || safeParticipant.角色名 || '').trim(),
        spirit: String(safeParticipant.spirit || safeParticipant.武魂 || safeParticipant.来源武魂 || '').trim(),
      };
    })
    .filter(participant => participant.charKey || participant.charName || participant.spirit);
}

function findFusionSpiritDataByReference(charData = {}, spiritRef = '') {
  const safeRef = String(spiritRef || '').trim();
  if (!safeRef) return null;
  if (!charData || typeof charData !== 'object') return null;
  if (charData[safeRef] && typeof charData[safeRef] === 'object' && 是武魂槽位键_V1(safeRef)) {
    return { spiritKey: safeRef, spiritData: charData[safeRef] };
  }
  const matchedEntry = 取角色武魂条目_V1(charData).find(([spiritKey, spiritData]) => {
    if (!spiritData || typeof spiritData !== 'object') return false;
    return spiritKey === safeRef || String(spiritData.表象名称 || '').trim() === safeRef;
  });
  return matchedEntry ? { spiritKey: matchedEntry[0], spiritData: matchedEntry[1] } : null;
}

function resolveFusionParticipantCharData(rootData = {}, ownerCharKey = '', ownerChar = {}, participant = {}) {
  const safeParticipant = participant && typeof participant === 'object' ? participant : {};
  if (safeParticipant.role === 'self') return ownerChar;
  if (safeParticipant.charKey && rootData?.char?.[safeParticipant.charKey]) return rootData.char[safeParticipant.charKey];
  const byNameKey = findCombatCharKeyByName(rootData, safeParticipant.charName || safeParticipant.charKey || '');
  return byNameKey && rootData?.char?.[byNameKey] ? rootData.char[byNameKey] : null;
}

function buildFusionSkillAttributeStateFromData(fusionSkill = {}, ownerCharKey = '', rootData = {}) {
  const ownerChar = rootData?.char?.[ownerCharKey] || {};
  const normalizedParticipants = normalizeFusionRuntimeParticipants(fusionSkill?.融合参与者 || []);
  const mergedStates = [];
  if (normalizedParticipants.length > 0) {
    normalizedParticipants.forEach(participant => {
      const charData = resolveFusionParticipantCharData(rootData, ownerCharKey, ownerChar, participant);
      const spiritMatch = findFusionSpiritDataByReference(charData, participant.spirit);
      if (!spiritMatch) return;
      mergedStates.push(normalizeSpiritAttributeState(spiritMatch.spiritData, spiritMatch.spiritKey, charData));
    });
  }
  if (!mergedStates.length) {
    const slots = getNormalizedFusionSourceSpirits(fusionSkill, ownerChar);
    slots.forEach(slot => {
      const spiritData = ownerChar?.[slot];
      if (!spiritData || typeof spiritData !== 'object') return;
      mergedStates.push(normalizeSpiritAttributeState(spiritData, slot, ownerChar));
    });
  }
  return mergeSpiritAttributeStates(mergedStates);
}

function getFusionSkillElementProfile(fusionSkill = {}, char = {}, ownerCharKey = '', rootData = null) {
  if (rootData && typeof rootData === 'object' && ownerCharKey) {
    return buildElementProfileFromAttributeState(buildFusionSkillAttributeStateFromData(fusionSkill, ownerCharKey, rootData));
  }
  const slots = getNormalizedFusionSourceSpirits(fusionSkill, char);
  const mergedStates = [];
  slots.forEach(slot => {
    const spiritData = char?.[slot];
    if (!spiritData || typeof spiritData !== 'object') return;
    mergedStates.push(normalizeSpiritAttributeState(spiritData, slot, char));
  });
  return buildElementProfileFromAttributeState(mergeSpiritAttributeStates(mergedStates));
}

function cloneSkillStructData(skill = {}) {
  const packedEffects = clonePackedSkillEffects(skill?._效果数组 || []);
  const attachedAttributes = normalizeSkillAttachedAttributeArray(skill?.附带属性);
  const 副作用列表 = normalizeSkillSideEffectList(skill?.副作用列表 || []);
  const 是造物承载技能 = String(skill?.承载方式 || '').trim() === '造物承载' || 是造物承载效果数组_V1(packedEffects);
  const working = {
    魂技名: String(skill?.魂技名 || skill?.技能名称 || skill?.name || AI_TODO_SKILL_NAME),
    画面描述: String(skill?.画面描述 || AI_TODO_SKILL_VISUAL),
    效果描述: String(skill?.效果描述 || AI_TODO_SKILL_EFFECT),
    承载方式: String(skill?.承载方式 || (是造物承载技能 ? '造物承载' : '直接生效')).trim() || '直接生效',
    消耗: cloneJsonValue(skill?.消耗 ?? '无'),
    前摇: Math.max(0, Number(skill?.前摇 ?? 0) || 0),
    附带属性: attachedAttributes,
    使用条件: skill?.使用条件 && typeof skill.使用条件 === 'object' && !Array.isArray(skill.使用条件) ? cloneJsonValue(skill.使用条件, {}) : undefined,
    触发方式: String(skill?.触发方式 || '').trim() || undefined,
    _效果数组: packedEffects,
  };
  const 场外冷却至tick = Math.max(0, Number(skill?.场外冷却至tick || 0));
  if (场外冷却至tick > 0) working.场外冷却至tick = 场外冷却至tick;
  if (副作用列表.length) working.副作用列表 = 副作用列表;
  if (是造物承载技能) working.产物描述 = String(skill?.产物描述 || '无');
  applySkillElementInheritance(working, {});
  syncConstructSkillMetadata(working);
  hydrateSkillTextByPackedEffects(working);
  const result = {
    魂技名: working.魂技名,
    画面描述: working.画面描述,
    效果描述: working.效果描述,
    承载方式: String(working.承载方式 || (是造物承载效果数组_V1(working._效果数组) ? '造物承载' : '直接生效')).trim() || '直接生效',
    消耗: cloneJsonValue(working.消耗 ?? '无'),
    前摇: Math.max(0, Number(working.前摇 || 0)),
    附带属性: normalizeSkillAttachedAttributeArray(working.附带属性 || []),
    _效果数组: clonePackedSkillEffects(working._效果数组 || []),
  };
  if (Math.max(0, Number(working.场外冷却至tick || 0)) > 0) result.场外冷却至tick = Math.max(0, Number(working.场外冷却至tick || 0));
  if (working.使用条件 && typeof working.使用条件 === 'object' && !Array.isArray(working.使用条件)) result.使用条件 = cloneJsonValue(working.使用条件, {});
  if (String(working.触发方式 || '').trim()) result.触发方式 = String(working.触发方式).trim();
  const 收口副作用列表 = normalizeSkillSideEffectList(working.副作用列表 || []);
  if (收口副作用列表.length) result.副作用列表 = 收口副作用列表;
  if (String(result.承载方式 || '').trim() === '造物承载' || 是造物承载效果数组_V1(result._效果数组)) result.产物描述 = working.产物描述 || '无';
  return result;
}

function syncConstructSkillMetadata(skill = {}) {
  if (!skill || !Array.isArray(skill._效果数组)) return skill;
  if (!String(skill.承载方式 || '').trim() && 是造物承载效果数组_V1(skill._效果数组)) skill.承载方式 = '造物承载';
  if (String(skill.承载方式 || '').trim() === '造物承载') {
    skill._效果数组 = 收口造物承载物品模板数组_V1(skill._效果数组, skill);
  }
  return skill;
}

function 清理技能效果数组AI文本字段_V1(value) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach(item => 清理技能效果数组AI文本字段_V1(item));
    return;
  }
  ['描述', '画面描述', '效果描述', '表现'].forEach(key => {
    if (Object.prototype.hasOwnProperty.call(value, key)) delete value[key];
  });
  Object.values(value).forEach(child => 清理技能效果数组AI文本字段_V1(child));
}

var FUSION_SPIRIT_SLOTS = ['第1武魂', '第2武魂'];

function getNormalizedFusionMode(fusionSkill = {}) {
  return fusionSkill?.融合模式 === 'self' ? 'self' : 'partner';
}

function 获取规范化武魂融合技用法模式(fusionSkill = {}) {
  const text = String(fusionSkill?.用法模式 || fusionSkill?.融合用法 || '').trim();
  if (/增幅|共享|持续/.test(text)) return '融合增幅';
  return '一次性释放';
}

function getNormalizedFusionSourceSpirits(fusionSkill = {}, char = {}) {
  const rawSlots = Array.isArray(fusionSkill?.来源武魂) ? fusionSkill.来源武魂 : [];
  let slots = rawSlots.map(slot => String(slot || '').trim()).filter(slot => FUSION_SPIRIT_SLOTS.includes(slot));
  if (!slots.length) slots = getNormalizedFusionMode(fusionSkill) === 'self' ? [...FUSION_SPIRIT_SLOTS] : ['第1武魂'];
  return Array.from(new Set(slots));
}

function ensureFusionSkillMentalCost(skill, currentRatio = 0.5) {
  if (!skill || typeof skill !== 'object') return skill;
  if (!Array.isArray(skill._效果数组)) skill._效果数组 = [];
  const parsed = 解析技能阶段消耗_V1(skill.消耗, { 来源: '武魂融合技', sourceCategory: '武魂融合技', path: '武魂融合技.技能数据', 技能: skill });
  const toCostMap = entries => (Array.isArray(entries) ? entries : []).reduce((result, item) => {
    const value = item.百分比 ? `${item.数值}%` : item.数值;
    result[item.资源] = result[item.资源] === undefined ? value : value;
    return result;
  }, {});
  const startup = toCostMap(parsed.启动);
  startup.精神力 = `${Math.max(0, Math.min(100, Number(currentRatio || 0) * 100))}%`;
  const sustain = toCostMap(parsed.维持);
  skill.消耗 = Object.keys(sustain).length ? { 启动: startup, 维持: sustain } : startup;
  skill.前摇 = Math.max(0, Number(skill.前摇 ?? 30) || 30);
  收口技能执行结构_V1(skill, { 目标: '单体', path: '武魂融合技.技能数据', 技能: skill });
  return skill;
}

function getBonePreferredSecondary(part = '') {
  const text = String(part || '');
  if (text.includes('头部')) return ['共享视野', '沉默', '标记弱点'];
  if (text.includes('躯干')) return ['小护盾', '净化', '解控'];
  if (text.includes('臂')) return ['穿透', '反击', '打断'];
  if (text.includes('腿')) return ['减速', '追击', '标记弱点'];
  return [];
}

var 技能机制决策临时字段_V1 = '机制决策临时';

var 技能机制最低品质_V1 = Object.freeze({
  直接伤害: 'F',
  单体伤害: 'F',
  群体伤害: 'F',
  多段伤害: 'D',
  持续伤害: 'C',
  软控: 'F',
  硬控: 'C',
  迟缓: 'D',
  节奏打断: 'C',
  单属性削弱: 'F',
  多属性削弱: 'F',
  禁疗: 'D',
  消耗: 'B',
  前摇: 'C',
  掌控压制: 'A',
  元素封禁: 'A',
  单属性增益: 'F',
  多属性增益: 'D',
  全属性增益: 'C',
  威力增幅: 'A',
  技能效果增幅: 'A',
  掌控提升: 'C',
  速度提升: 'C',
  修炼增益: 'A',
  护盾: 'D',
  承伤修正: 'D',
  免伤: 'F',
  霸体: 'C',
  免死: 'C',
  '免死/锁血': 'C',
  无敌金身: 'S',
  伤害反射: 'B',
  伤害分摊: 'B',
  消耗分摊: 'B',
  体力恢复: 'F',
  魂力恢复: 'F',
  精神恢复: 'D',
  持续恢复: 'D',
  '净化/解控': 'D',
  感知干扰: 'D',
  标记锁定: 'D',
  共享视野: 'A',
  幻境: 'C',
  催眠: 'C',
  认知扭曲: 'C',
  自身位移: 'D',
  强制位移: 'C',
  位移交换: 'C',
  追击位移: 'C',
  脱离位移: 'C',
  召唤: 'C',
  分身: 'A',
  复制: 'A',
  反制: 'B',
  转化: 'B',
  状态交换: 'A',
  状态转移: 'A',
  '强制绑定/锁定': 'A',
  规则改写: 'S',
  引爆持续伤害: 'B',
  斩盾: 'C',
  吞噬: 'A',
  能力共享: 'A',
  机制抹消: 'A',
  炸环: 'S',
  时光回溯: 'S',
  气运干涉: 'A',
  治疗反转: 'A',
});

var 技能基础属性辅助机制集合_V1 = new Set(['单属性增益', '多属性增益', '全属性增益']);
var 技能非基础属性辅助机制集合_V1 = new Set([
  '威力增幅',
  '技能效果增幅',
  '消耗',
  '前摇',
  '掌控提升',
  '速度提升',
  '修炼增益',
  '护盾',
  '承伤修正',
  '免伤',
  '霸体',
  '免死',
  '免死/锁血',
  '无敌金身',
  '伤害反射',
  '伤害分摊',
  '消耗分摊',
  '共享视野',
  '能力共享',
]);

function 提升技能品质等级_V1(品质 = 'F', 增量 = 1) {
  const 当前 = normalizeSkillGradeSymbol(品质);
  const 等级表 = Object.entries(SKILL_GRADE_ORDER_V1).sort((a, b) => Number(a[1]) - Number(b[1]));
  const 当前序号 = 等级表.findIndex(([键]) => 键 === 当前);
  const 目标序号 = Math.min(等级表.length - 1, Math.max(0, 当前序号 < 0 ? 0 : 当前序号) + Math.max(0, Number(增量 || 0)));
  return 等级表[目标序号]?.[0] || 当前 || 'F';
}

function 规范化机制枚举数组_V1(list = []) {
  return Array.from(
    new Set(
      (Array.isArray(list) ? list : [])
        .map(item => String(item || '').trim())
        .filter(Boolean),
    ),
  );
}

var 技能副作用类型候选_V1 = Object.freeze([
  '全属性降低',
  '自损反噬',
  '致死献祭',
  '精神紊乱',
  '命中下降',
  '动作迟缓',
  '目标错乱',
  '施法僵直',
]);

function 获取技能机制品质等级_V1(context = {}) {
  const 显式等级文本 = String(context?.gradeOverride || context?.grade || context?.品质等级 || '').trim();
  const 显式等级 = 显式等级文本 ? normalizeSkillGradeSymbol(显式等级文本) : '';
  if (显式等级) return 显式等级;
  const 显式品质 = String(context?.qualityOverride || context?.quality || context?.品质 || '').trim();
  if (显式品质) {
    const 品质命中 = normalizeSkillGradeSymbol(显式品质);
    if (品质命中) return 品质命中;
  }
  const 来源品质 = String(context?.sourceQuality || context?.来源品质 || '').trim();
  const 来源品质等级 = normalizeSoulSpiritQuality(来源品质);
  if (来源品质等级 && 来源品质等级 !== '无') return normalizeSkillGradeSymbol(来源品质等级);
  const 年限 = Math.max(0, Number(context?.age || context?.ringAge || context?.年限 || 0));
  if (年限 >= 1000000) return 'S+';
  if (年限 >= 100000) return 'S';
  if (年限 >= 10000) return 'A';
  if (年限 >= 1000) return 'B';
  if (年限 >= 100) return 'C';
  if (年限 >= 10) return 'D';
  return 'F';
}

function 技能机制满足品质门槛_V1(机制名 = '', context = {}) {
  const 机制 = String(机制名 || '').trim();
  const 原门槛 = normalizeSkillGradeSymbol(技能机制最低品质_V1[机制] || 'F');
  const 系别 = String(context?.type || context?.系别 || '').trim();
  const 门槛 =
    ['辅助系', '食物系'].includes(系别) &&
    技能非基础属性辅助机制集合_V1.has(机制) &&
    !技能基础属性辅助机制集合_V1.has(机制)
      ? 提升技能品质等级_V1(原门槛, 1)
      : 原门槛;
  const 当前 = 获取技能机制品质等级_V1(context);
  return (SKILL_GRADE_ORDER_V1[当前] || 1) >= (SKILL_GRADE_ORDER_V1[门槛] || 1);
}

function 构建主机制大类候选_V1(context = {}) {
  const 系别 = String(context?.type || context?.系别 || '强攻系').trim() || '强攻系';
  if (系别 === '辅助系') return Object.keys(SKILL_ARCHETYPE_POOL_V1 || {});
  const 分布表 = SKILL_MAIN_MECHANIC_DISTRIBUTION_V1[系别] || SKILL_MAIN_MECHANIC_DISTRIBUTION_V1['强攻系'] || [];
  return 规范化机制枚举数组_V1(
    [...分布表]
      .sort((a, b) => (Number(b?.max || 0) - Number(b?.min || 0)) - (Number(a?.max || 0) - Number(a?.min || 0)))
      .slice(0, 4)
      .map(item => item?.main),
  );
}

function 构建精简技能机制候选池_V1(context = {}) {
  const 主机制大类候选 = 构建主机制大类候选_V1(context);
  const 主机制候选 = [];
  const 系别 = String(context?.type || context?.系别 || '强攻系').trim() || '强攻系';
  const 全机制支持 = ['辅助系', '食物系'].includes(系别);
  主机制大类候选.forEach(大类 => {
    const 原型列表 = Array.isArray(SKILL_ARCHETYPE_POOL_V1[大类]) ? SKILL_ARCHETYPE_POOL_V1[大类] : [];
    主机制候选.push(...(全机制支持 ? 原型列表 : 原型列表.slice(0, 4)));
  });
  const 副机制候选 = [];
  副机制候选.push(...(SKILL_SECONDARY_TYPE_BIAS_V1[系别] || []));
  主机制大类候选.forEach(大类 => {
    const 列表 = Array.isArray(SKILL_SECONDARY_BY_MAIN_V1[大类]) ? SKILL_SECONDARY_BY_MAIN_V1[大类] : [];
    副机制候选.push(...(全机制支持 ? 列表 : 列表.slice(0, 8)));
  });
  return {
    主机制候选: 规范化机制枚举数组_V1(主机制候选).filter(机制名 => 技能机制满足品质门槛_V1(机制名, context)),
    副机制候选: 规范化机制枚举数组_V1(副机制候选).filter(机制名 => 技能机制满足品质门槛_V1(机制名, context)),
  };
}

function 构建技能机制候选池_V1(context = {}) {
  const 精简候选 = 构建精简技能机制候选池_V1(context);
  const 候选上下文 = {
    ...(context || {}),
    候选筛选最大消耗前摇倍率: 2,
  };
  const 已选主机制 = String(context?.机制决策已选主机制 || '').trim();
  const 主机制源表 = 精简候选.主机制候选
    .filter(name => SKILL_MECHANISM_META_V1[name]?.可主机制 === true && 机制具备共享原型编译_V1(name))
    .map(name => ({ value: name, weight: 1 }));
  let 主机制候选表 = 构建预算可行候选池_V1(
    主机制源表,
    候选上下文,
  ).候选表;
  if (已选主机制) 主机制候选表 = 主机制候选表.filter(item => String(item?.value || '').trim() === 已选主机制);
  const 副机制源表 = 精简候选.副机制候选
    .filter(name => SKILL_MECHANISM_META_V1[name]?.可副机制 === true && 机制具备共享原型编译_V1(name))
    .map(name => ({ value: name, weight: 1 }));
  const 副机制字段数量 = 脚本判定副机制字段数量_V1(context);
  let 副机制候选 = [];
  if (副机制字段数量 > 0 && 主机制候选表.length && 副机制源表.length) {
    let 共同副机制集合 = null;
    主机制候选表.forEach(主机制项 => {
      const 主机制范围 = 主机制项?.预算范围 && typeof 主机制项.预算范围 === 'object' ? 主机制项.预算范围 : {};
      const 主机制最低COST = Math.max(0, Number(主机制范围.组合最低COST ?? 主机制范围.最低可达COST ?? 0));
      const 主机制最高COST = Math.max(
        主机制最低COST,
        Number(主机制范围.组合最高常规COST ?? 主机制范围.补强可达COST ?? 主机制范围.最高常规COST ?? 主机制最低COST),
      );
      const 当前副机制集合 = new Set(
        构建预算可行候选池_V1(副机制源表, {
          ...候选上下文,
          主机制大类: '',
          主机制COST: 主机制最低COST,
          主机制最高COST,
        }).候选表.map(item => String(item?.value || '').trim()).filter(Boolean),
      );
      共同副机制集合 = 共同副机制集合 === null
        ? 当前副机制集合
        : new Set([...共同副机制集合].filter(机制 => 当前副机制集合.has(机制)));
    });
    副机制候选 = [...(共同副机制集合 || new Set())];
  }
  const 主机制候选 = 主机制候选表.map(item => String(item?.value || '').trim()).filter(Boolean);
  return {
    全机制候选: 规范化机制枚举数组_V1([...主机制候选, ...副机制候选]),
    主机制候选: 规范化机制枚举数组_V1(主机制候选),
    副机制候选: 规范化机制枚举数组_V1(副机制候选),
    建议副机制字段数量: Math.min(副机制字段数量, 副机制候选.length),
  };
}

function 脚本判定副机制字段数量_V1(context = {}) {
  const 魂环位 = Math.max(1, Number(context?.ringIndex || 1));
  const 契合度原始 = Number(context?.compatibility);
  const 契合度 = Math.max(0, Math.min(100, Number.isFinite(契合度原始) ? 契合度原始 : 0));
  if (魂环位 < 2 && 契合度 < 65) return 0;
  if (魂环位 >= 5 || 契合度 >= 85) return 2;
  return 1;
}

function 脚本判定是否出现副作用字段_V1(context = {}) {
  const 品质 = String(context?.sourceQuality || context?.来源品质 || '').trim().toUpperCase();
  if (/[SＡ]/i.test(品质) || /A/.test(品质)) return false;
  const 魂环位 = Math.max(1, Number(context?.ringIndex || 1));
  return 魂环位 <= 6;
}

function 构建机制待生成提示词_V1(字段名 = '主机制', 候选列表 = [], 附加规则 = '') {
  const 名称 = String(字段名 || '机制').trim() || '机制';
  const 候选文本 = 规范化机制枚举数组_V1(候选列表).join('、') || '无';
  const 规则文本 = String(附加规则 || '').trim();
  return `待补全（请结合武魂特性、魂环来源魂兽特性与当前剧情上下文，从候选中选择最合适的${名称}并写回候选原文；同时与魂技名、画面描述保持一致；禁止输出候选外内容。候选：${候选文本}${规则文本 ? `；${规则文本}` : ''}）`;
}

function 规范化机制限选单值_V1(值 = '', 候选列表 = [], 默认值 = '待补全') {
  const 候选项 = 规范化机制枚举数组_V1(候选列表);
  if (!候选项.length) return 默认值;
  const 文本 = String(值 || '').trim();
  if (!文本 || /^待补全/.test(文本)) return 默认值;
  return 候选项.includes(文本) ? 文本 : 默认值;
}

function 规范化机制限选多值_V1(值 = [], 候选列表 = []) {
  const 候选项 = 规范化机制枚举数组_V1(候选列表);
  if (!候选项.length) return [];
  const 值数组 = Array.isArray(值) ? 值 : [值];
  return 规范化机制枚举数组_V1(值数组).filter(item => 候选项.includes(item));
}

function 规范化机制限选多值或待补全文本_V1(值 = [], 候选列表 = [], 默认值 = '待补全') {
  const 命中列表 = 规范化机制限选多值_V1(值, 候选列表);
  if (命中列表.length) return 命中列表;
  const 文本 = String(值 || '').trim();
  if (文本 && /^待补全/.test(文本)) return 文本;
  return 默认值;
}

function 提取机制限选命中值_V1(字段值, 候选列表 = [], 选项 = {}) {
  const 候选项 = 规范化机制枚举数组_V1(候选列表);
  if (!候选项.length) return [];
  const 允许多选 = 选项?.allowMultiple === true;
  if (允许多选) {
    return 规范化机制限选多值_V1(字段值, 候选项);
  }
  const 已选单值 = 规范化机制限选单值_V1(Array.isArray(字段值) ? 字段值[0] : 字段值, 候选项, '');
  return 已选单值 ? [已选单值] : [];
}

function 是否机制待生成文本_V1(字段值 = '') {
  return /^待补全/.test(String(字段值 || '').trim());
}

function 断言机制决策临时输入_V1(临时决策 = {}) {
  if (!临时决策 || typeof 临时决策 !== 'object' || Array.isArray(临时决策)) return;
  const 非法字段 = Object.keys(临时决策).filter(key => !['主机制', '副机制1', '副机制2', '副作用类型'].includes(key));
  if (非法字段.length) throw new Error(`技能生成错误:机制决策临时包含非法字段:${非法字段.join('、')}`);
}

function 构建技能机制决策临时数据_V1(skill = {}, context = {}) {
  const 现有决策 = skill?.[技能机制决策临时字段_V1];
  断言机制决策临时输入_V1(现有决策);
  const 候选池 = 构建技能机制候选池_V1(context);
  const 上下文 = context && typeof context === 'object' ? context : {};
  const 原机制选择 = 现有决策 && typeof 现有决策 === 'object' && !Array.isArray(现有决策)
    ? cloneJsonValue(现有决策)
    : {};
  const 临时选择 = {};
  const 取提示 = typeof 上下文?.取运行时提示 === 'function' ? 上下文.取运行时提示 : null;
  const 限流提示 = (类型, 完整提示) => (取提示 ? 取提示(类型, 完整提示) : 完整提示);
  const 副机制字段数量 = Math.min(
    脚本判定副机制字段数量_V1(上下文),
    Math.max(0, Number(候选池?.建议副机制字段数量 ?? 候选池?.副机制候选?.length ?? 0)),
  );
  const 需要副作用字段 = 脚本判定是否出现副作用字段_V1(上下文);
  临时选择.主机制 = 规范化机制限选单值_V1(
    原机制选择.主机制,
    候选池.主机制候选,
    限流提示('机制主机制', 构建机制待生成提示词_V1('主机制', 候选池.主机制候选)),
  );
  if (副机制字段数量 >= 1) {
    临时选择.副机制1 = 规范化机制限选单值_V1(
      原机制选择.副机制1,
      候选池.副机制候选,
      限流提示('机制副机制', 构建机制待生成提示词_V1('副机制1', 候选池.副机制候选, '若出现副机制则先填写副机制1')),
    );
  }
  if (副机制字段数量 >= 2) {
    临时选择.副机制2 = 规范化机制限选单值_V1(
      原机制选择.副机制2,
      候选池.副机制候选,
      限流提示('机制副机制', 构建机制待生成提示词_V1('副机制2', 候选池.副机制候选, '仅在脚本要求2个副机制时填写，且不能与副机制1重复')),
    );
  }
  if (需要副作用字段) {
    临时选择.副作用类型 = 规范化机制限选单值_V1(
      原机制选择.副作用类型,
      技能副作用类型候选_V1,
      限流提示('机制副作用', 构建机制待生成提示词_V1('副作用类型', 技能副作用类型候选_V1, '仅在脚本判定出现副作用时填写')),
    );
  }
  return 临时选择;
}

function 构建机制决策蓝图覆盖_V1(临时决策 = {}, context = {}) {
  const 选择 = 临时决策 && typeof 临时决策 === 'object' && !Array.isArray(临时决策)
    ? 临时决策
    : {};
  断言机制决策临时输入_V1(选择);
  const 主机制原型 = String(选择.主机制 || '').trim();
  if (!主机制原型 || /^待补全/.test(主机制原型)) return null;
  if (!机制具备共享原型编译_V1(主机制原型)) throw new Error(`技能生成错误:${主机制原型}没有共享原型编译定义`);
  const 副机制 = [];
  [选择.副机制1, 选择.副机制2].forEach(原始值 => {
    const 值 = String(原始值 || '').trim();
    if (!值 || /^待补全/.test(值)) return;
    if (!机制具备共享原型编译_V1(值)) throw new Error(`技能生成错误:${值}没有共享原型编译定义`);
    if (!副机制.includes(值)) 副机制.push(值);
  });
  const 系别 = String(context?.type || context?.系别 || '').trim();
  const 主机制大类 = ['消耗', '前摇'].includes(主机制原型) && ['辅助系', '食物系', '治疗系'].includes(系别)
    ? '增益类'
    : findMainMechanicGroupByArchetype(主机制原型);
  const 蓝图 = {
    主机制大类,
    主机制原型,
  };
  if (副机制.length) 蓝图.副机制 = 副机制;
  return 蓝图;
}

function 构建机制决策副作用列表_V1(临时决策 = {}, context = {}) {
  const 选择 = 临时决策 && typeof 临时决策 === 'object' && !Array.isArray(临时决策)
    ? 临时决策
    : {};
  const 副作用类型 = 规范化机制限选单值_V1(选择.副作用类型, 技能副作用类型候选_V1, '');
  const 副作用条目 = 副作用类型 ? 构建副作用条目_V1(副作用类型, context) : null;
  return 副作用条目 ? [副作用条目] : [];
}

function 读取技能合法自动生成机制标签_V1(skill = {}, context = {}) {
  const 候选 = [
    context?.archetype,
    context?.主机制原型,
    context?.候选预算档案?.机制名,
    skill?.[技能机制决策临时字段_V1]?.主机制,
  ];
  for (const 项 of 候选) {
    const 机制 = String(项 || '').trim();
    if (机制 && 机制具备共享原型编译_V1(机制)) return 机制;
  }
  return '';
}

function 技能需要自动生成结构_V1(skill = {}, context = {}) {
  if (!skill || typeof skill !== 'object') return false;
  if (context?.允许自动生成技能结构 !== true) return false;
  const hasPackedEffects = Array.isArray(skill._效果数组) && skill._效果数组.length > 0;
  if (!hasPackedEffects) return true;
  const 临时决策 = skill?.[技能机制决策临时字段_V1];
  if (!临时决策 || typeof 临时决策 !== 'object' || Array.isArray(临时决策)) return false;
  return !!读取技能合法自动生成机制标签_V1(skill, context);
}

function 是技能生成可软化错误_V1(错误 = null) {
  const 文本 = String(错误?.message || 错误 || '').trim();
  return /技能生成错误|预算收敛诊断/.test(文本) || !!错误?.预算收敛技能 || Array.isArray(错误?.生成失败记录);
}

function 技能生成失败软落地_V1(skill = {}, context = {}, 错误 = null, 备选技能 = null) {
  if (!skill || typeof skill !== 'object') return skill;
  const 收敛技能 =
    错误 && typeof 错误 === 'object' && 错误.预算收敛技能 && typeof 错误.预算收敛技能 === 'object' && !Array.isArray(错误.预算收敛技能)
      ? 错误.预算收敛技能
      : null;
  const 备选对象 = 备选技能 && typeof 备选技能 === 'object' && !Array.isArray(备选技能) ? 备选技能 : null;
  const 下个技能 = cloneJsonValue(收敛技能 || 备选对象 || skill, {});
  if (!Array.isArray(下个技能._效果数组)) 下个技能._效果数组 = [];
  delete 下个技能[技能机制决策临时字段_V1];
  if (typeof 下个技能.魂技名 !== 'string' || !下个技能.魂技名.trim() || isSkillTodoText(下个技能.魂技名)) {
    下个技能.魂技名 = buildSkillNameTodoText(context?.textContext || context);
  }
  if (typeof 下个技能.画面描述 !== 'string' || !下个技能.画面描述.trim() || 下个技能.画面描述 === SKILL_TEXT_UNKNOWN) {
    下个技能.画面描述 = AI_TODO_SKILL_VISUAL;
  }
  if (typeof 下个技能.效果描述 !== 'string' || !下个技能.效果描述.trim() || 下个技能.效果描述 === SKILL_TEXT_UNKNOWN) {
    下个技能.效果描述 = AI_TODO_SKILL_EFFECT;
  }
  if (Array.isArray(下个技能._效果数组) && 下个技能._效果数组.length > 0) 清理技能效果数组AI文本字段_V1(下个技能._效果数组);
  Object.keys(skill).forEach(键 => delete skill[键]);
  Object.assign(skill, 下个技能);
  记录技能生成事件_V1(context, {
    类型: '生成软失败保留收敛结果',
    失败类型: 归类技能生成错误_V1(错误),
    错误信息: String(错误?.message || 错误 || ''),
    保留效果数: Array.isArray(skill._效果数组) ? skill._效果数组.length : 0,
    来源: 收敛技能 ? '预算收敛技能' : (备选对象 ? '候选技能' : '原技能'),
    path: String(context?.path || context?.路径 || ''),
    技能键: String(context?.技能键 || context?.skillName || ''),
  });
  return hydrateSkillTextByPackedEffects(skill);
}

function 构建副作用条目_V1(副作用类型 = '', context = {}) {
  const 类型文本 = String(副作用类型 || '').trim();
  if (!类型文本) return null;
  const 状态名 = String(context?.状态 || context?.主机制原型 || '技能副作用').trim() || '技能副作用';
  const 默认生效对象 = String(context?.type || context?.系别 || '').trim() === '食物系' ? '效果承受者' : '技能释放者';
  const 副作用映射 = {
    全属性降低: {
      副作用类型: '全属性降低',
      触发时机: '效果结束后',
      生效对象: '效果承受者',
      持续回合: 2,
      触发概率: 1,
      关联状态: 状态名,
      副作用状态: '虚弱',
      数值: '+10%',
    },
    自损反噬: {
      副作用类型: '自损反噬',
      触发时机: '效果生效后',
      生效对象: 默认生效对象,
      持续回合: 1,
      触发概率: 1,
      副作用状态: '反噬',
      数值: '+5%',
    },
    致死献祭: {
      副作用类型: '致死献祭',
      触发时机: '效果生效后',
      生效对象: 默认生效对象,
      触发概率: 1,
    },
    精神紊乱: {
      副作用类型: '精神紊乱',
      触发时机: '效果生效后',
      生效对象: 默认生效对象,
      持续回合: 2,
      触发概率: 0.5,
      副作用状态: '精神紊乱',
      数值: '+10%',
    },
    命中下降: {
      副作用类型: '命中下降',
      触发时机: '效果生效后',
      生效对象: 默认生效对象,
      持续回合: 2,
      触发概率: 1,
      副作用状态: '精神紊乱',
      数值: '+10%',
    },
    动作迟缓: {
      副作用类型: '动作迟缓',
      触发时机: '效果生效后',
      生效对象: 默认生效对象,
      持续回合: 1,
      触发概率: 1,
      副作用状态: '迟缓',
      数值: '+15%',
      副数值: '+10%',
    },
    目标错乱: {
      副作用类型: '目标错乱',
      触发时机: '效果生效后',
      生效对象: 默认生效对象,
      持续回合: 1,
      触发概率: 1,
      副作用状态: '混乱',
      数值: '+30%',
    },
    施法僵直: {
      副作用类型: '施法僵直',
      触发时机: '效果生效后',
      生效对象: 默认生效对象,
      持续回合: 1,
      触发概率: 1,
      副作用状态: '僵直',
      数值: '+20%',
    },
  };
  return 副作用映射[类型文本] ? normalizeSkillSideEffectEntry(副作用映射[类型文本]) : null;
}

function 直接自动生成技能结构_V1(skill = {}, context = {}) {
  if (!skill || typeof skill !== 'object') return false;
  const 直接生成开始毫秒 = 读取性能计时毫秒_V1();
  const 恢复增益重复账本缓存 = context?.恢复增益重复账本缓存 || 创建恢复增益重复账本缓存_V1();
  const 临时决策 = skill?.[技能机制决策临时字段_V1];
  const 临时蓝图 = 临时决策 && typeof 临时决策 === 'object' ? 构建机制决策蓝图覆盖_V1(临时决策, context) : null;
  const 临时副作用列表 = 临时决策 && typeof 临时决策 === 'object' ? 构建机制决策副作用列表_V1(临时决策, context) : [];
  const 系别 = String(context?.type || context?.系别 || context?.武魂系别 || '强攻系').trim() || '强攻系';
  const 天赋层级 = String(context?.talentTier || context?.角色?.属性?.天赋梯队 || context?.角色?.天赋梯队 || '正常').trim() || '正常';
  const 魂环年限 = Math.max(100, Number(context?.魂骨年限 ?? context?.age ?? context?.ringAge ?? context?.魂环数据?.年限 ?? 1000));
  const 魂环位 = Math.max(1, Number(context?.ringIndex ?? context?.魂环位 ?? 1));
  const 契合度 = Math.max(0, Math.min(100, Number(context?.compatibility || 100)));
  const 偏好副机制 = Array.isArray(context?.preferredSecondary) ? context.preferredSecondary : [];
  const 当前tick = Number(context?.currentTick || 0);
  const 自动生成预算范围缓存 = context?.自动生成预算范围缓存 instanceof Map ? context.自动生成预算范围缓存 : new Map();
  const 自动生成预算摘要缓存 = context?.自动生成预算摘要缓存 instanceof Map ? context.自动生成预算摘要缓存 : new Map();
  const 基础生成选项 = {
    角色: context?.角色,
    武魂数据: context?.武魂数据,
    魂环数据: context?.魂环数据 || context?.ringData,
    ringData: context?.ringData || context?.魂环数据,
    武魂系别: context?.武魂系别 || 系别,
    path: context?.path,
    passiveMode: context?.passiveMode === true,
    passiveName: String(context?.passiveName || skill?.魂技名 || '').trim(),
    sourceCategory: String(context?.sourceCategory || '魂技').trim() || '魂技',
    魂骨年限: context?.魂骨年限,
    age: 魂环年限,
    ringAge: 魂环年限,
    ringIndex: 魂环位,
    魂环位,
    gradeOverride: context?.gradeOverride,
    grade: context?.grade,
    qualityOverride: context?.qualityOverride,
    sourceQuality: String(context?.sourceQuality || context?.来源品质 || '').trim(),
    textContext: context?.textContext || {},
    martialSoulName: String(context?.martialSoulName || context?.textContext?.martialSoulName || '').trim(),
    当前魂环数量: Math.max(1, Math.floor(Number(context?.当前魂环数量 || context?.ringCount || 1))),
    elementProfile: context?.elementProfile || null,
    可调用元素: Array.isArray(context?.可调用元素) ? context.可调用元素 : [],
    callableElements: Array.isArray(context?.callableElements) ? context.callableElements : [],
    elementTrigger: String(context?.elementTrigger || '').trim(),
    forceTrueBody: 临时蓝图 ? false : context?.forceTrueBody,
    副作用列表: Array.isArray(context?.副作用列表) && context.副作用列表.length ? context.副作用列表 : 临时副作用列表,
    技能生成统计器: context?.技能生成统计器,
    恢复增益重复账本缓存,
    自动生成预算范围缓存,
    自动生成预算摘要缓存,
  };
  const 蓝图覆盖 = context?.blueprintOverride && typeof context.blueprintOverride === 'object' ? context.blueprintOverride : null;
  const 蓝图指定机制 = 蓝图覆盖 && (
    String(蓝图覆盖?.主机制原型 || '').trim() ||
    String(蓝图覆盖?.主机制大类 || '').trim()
  );
  const 指定蓝图 = 蓝图指定机制 ? 蓝图覆盖 : (临时蓝图 || null);
  const 显式生成品质 = String(context?.gradeOverride || context?.grade || context?.品质 || context?.sourceQuality || context?.来源品质 || '').trim();
  let 固定生成品质 = 显式生成品质 ? normalizeSkillTableGrade(显式生成品质) : '';
  let 临时技能 = null;
  let 最后错误 = null;
  const 失败记录 = [];
  const 失败主机制大类 = new Set();
  const 失败子原型 = new Set();
  const 基础预算摘要 = 估算自动生成预算摘要_V1({
    ...(context || {}),
    type: 系别,
    系别,
    ringIndex: 魂环位,
    魂环位,
    age: 魂环年限,
    ringAge: 魂环年限,
    sourceCategory: 基础生成选项.sourceCategory,
    来源: 基础生成选项.sourceCategory,
    自动生成预算摘要缓存,
  });
  const 读取候选预算门禁 = 候选序号 => {
    if (候选序号 <= 0) return null;
    const 运转基准 = Math.max(0.5, Number(基础预算摘要?.运转基准 || 0));
    const 原始门禁 = Math.max(0.5, Number(基础预算摘要?.预算门禁 || 0));
    const 阶段倍率 = 候选序号 >= 2 ? 1 : 1.5;
    return Number(Math.min(原始门禁, 运转基准 * 阶段倍率).toFixed(2));
  };
  const 最大候选次数 = 指定蓝图 ? 1 : 3;
  for (let 候选序号 = 0; 候选序号 < 最大候选次数; 候选序号 += 1) {
    const 候选开始毫秒 = 读取性能计时毫秒_V1();
    let 候选蓝图 = undefined;
    let 当前候选机制原型 = '';
    let 当前候选保留技能 = null;
    记录技能生成事件_V1(context, {
      类型: '候选尝试',
      候选序号,
      阶段: 候选序号 === 0 ? '随机候选' : (候选序号 === 1 ? '预算收敛重抽' : '预算收敛兜底'),
      系别,
      天赋: 天赋层级,
      魂环位,
      来源: 基础生成选项.sourceCategory,
      指定蓝图: !!候选蓝图,
      排除主机制大类: [...失败主机制大类],
      排除子原型: [...失败子原型],
    });
    try {
      候选蓝图 = 指定蓝图 && 候选序号 === 0 ? 指定蓝图 : undefined;
      当前候选机制原型 = String(候选蓝图?.主机制原型 || '').trim();
      const 候选预算门禁 = 读取候选预算门禁(候选序号);
      const 候选消耗前摇方案 = 构建自动生成候选消耗前摇方案_V1(候选序号);
      const 是武魂真身候选 = context?.forceTrueBody === true && !临时蓝图 && !候选蓝图;
      const 生成结果 = 是武魂真身候选
        ? buildSeventhRingTrueBodySkill(
            系别,
            天赋层级,
            魂环年限,
            魂环位,
            契合度,
            context?.textContext || {},
            String(context?.sourceQuality || '').trim(),
            基础生成选项,
        )
        : autoGenerateSkill(系别, 天赋层级, 魂环年限, 魂环位, 契合度, 偏好副机制, 当前tick, {
            ...基础生成选项,
            消耗前摇收口方案: 候选消耗前摇方案,
            ...(候选序号 > 0 ? {
              ...(固定生成品质 ? { gradeOverride: 固定生成品质 } : {}),
              阶段最高预算门禁: 候选预算门禁,
            } : {}),
            排除主机制大类: [...失败主机制大类],
            排除子原型: [...失败子原型],
            blueprintOverride: 候选蓝图 || 蓝图覆盖,
          });
      if (候选蓝图 && String(生成结果?.机制原型 || '').trim() && String(生成结果.机制原型).trim() !== String(候选蓝图.主机制原型 || '').trim()) {
        throw new Error(`技能生成错误:${候选蓝图.主机制原型 || '临时机制'}机制决策生成偏离:${生成结果.机制原型}`);
      }
      if (!固定生成品质 && String(生成结果?.品质等级 || '').trim()) 固定生成品质 = normalizeSkillTableGrade(生成结果.品质等级);
      当前候选机制原型 = String(生成结果?.机制原型 || 候选蓝图?.主机制原型 || '随机机制').trim();
      const 效果数组 = Array.isArray(生成结果?._效果数组) ? clonePackedSkillEffects(生成结果._效果数组) : [];
      if (getMeaningfulSkillEffects(效果数组).length === 0) {
        throw new Error(`技能生成错误:${候选蓝图?.主机制原型 || '随机机制'}未生成可执行原型`);
      }
      const 候选技能 = cloneJsonValue(skill, {});
      候选技能.承载方式 = String(生成结果.承载方式 || 候选技能.承载方式 || (是造物承载效果数组_V1(效果数组) ? '造物承载' : '直接生效')).trim() || '直接生效';
      候选技能.消耗 = cloneJsonValue(生成结果.消耗 ?? 候选技能.消耗 ?? '无');
      候选技能.前摇 = Math.max(0, Number(生成结果.前摇 ?? 候选技能.前摇 ?? 0) || 0);
      if (String(生成结果.触发方式 || '').trim()) 候选技能.触发方式 = String(生成结果.触发方式).trim();
      else delete 候选技能.触发方式;
      候选技能._效果数组 = 效果数组;
      const 副作用列表 = normalizeSkillSideEffectList(生成结果.副作用列表 || 候选技能.副作用列表 || []);
      if (副作用列表.length) 候选技能.副作用列表 = 副作用列表;
      else delete 候选技能.副作用列表;
      清理技能效果数组AI文本字段_V1(候选技能._效果数组);
      delete 候选技能[技能机制决策临时字段_V1];
      applySkillElementInheritance(候选技能, context);
      收口技能执行结构_V1(候选技能, {
        目标: String(候选技能.承载方式 || '').trim() === '造物承载' ? '自身' : '单体',
        技能: 候选技能,
        passiveMode: context?.passiveMode === true,
      });
      syncConstructSkillMetadata(候选技能);
      const 候选预算上下文 = {
        ...(context || {}),
        消耗前摇收口方案: 候选消耗前摇方案,
        ...(候选序号 > 0 ? {
          阶段最高预算门禁: 候选预算门禁,
        } : {}),
        目标: String(候选技能.承载方式 || '').trim() === '造物承载' ? '自身' : '单体',
        passiveMode: context?.passiveMode === true,
        系别,
        启用位级硬上限: true,
        恢复增益重复账本缓存,
      };
      替换技能重复增益属性_V1(候选技能, {
        ...(context || {}),
        目标: String(候选技能.承载方式 || '').trim() === '造物承载' ? '自身' : '单体',
        passiveMode: context?.passiveMode === true,
        系别,
        恢复增益重复账本缓存,
      });
      断言技能五环恢复增益不重复_V1(候选技能, {
        ...(context || {}),
        目标: String(候选技能.承载方式 || '').trim() === '造物承载' ? '自身' : '单体',
        passiveMode: context?.passiveMode === true,
        系别,
        恢复增益重复账本缓存,
      }, 生成结果?.机制原型 || 候选蓝图?.主机制原型 || '随机机制');
      const 候选机制标签 = 生成结果?.机制原型 || 候选蓝图?.主机制原型 || '随机机制';
      const 候选预算档案 = 估算自动生成机制预算范围_V1(候选机制标签, {
        ...候选预算上下文,
        释放形态: 候选技能.承载方式,
      });
      const 最终正式技能 = 校验生成技能正式结构_V1(候选技能, '生成技能最终预算', 候选预算上下文);
      当前候选保留技能 = 最终正式技能;
      if (!是武魂真身候选) {
        收敛技能到预算区间_V1(最终正式技能, { ...候选预算上下文, 机制标签: 候选机制标签 }, 候选预算档案);
        断言并同步自动生成最终预算_V1(最终正式技能, {
          ...候选预算上下文,
          仅断言预算: true,
        }, 候选机制标签);
        断言直接结算收益预算_V1(最终正式技能, '生成技能', context || {});
      }
      临时技能 = 最终正式技能;
      记录技能生成事件_V1(context, {
        类型: '候选成功',
        候选序号,
        系别,
        天赋: 天赋层级,
        魂环位,
        来源: 基础生成选项.sourceCategory,
        主机制原型: 当前候选机制原型,
        耗时毫秒: Number(Math.max(0, 读取性能计时毫秒_V1() - 候选开始毫秒).toFixed(3)),
      });
      break;
    } catch (错误) {
      最后错误 = 错误;
      if (
        错误 &&
        typeof 错误 === 'object' &&
        !错误.预算收敛技能 &&
        当前候选保留技能 &&
        typeof 当前候选保留技能 === 'object'
      ) {
        错误.预算收敛技能 = cloneJsonValue(当前候选保留技能, {});
      }
      const 错误文本 = String(错误?.message || 错误 || '未知错误');
      const 大类匹配 = 错误文本.match(/技能生成错误:([^:：]+?)没有合法子原型/);
      if (大类匹配?.[1]) 失败主机制大类.add(String(大类匹配[1]).trim());
      const 超预算匹配 = 错误文本.match(/技能生成错误:([^:：]+?)(?:COST仍超预算|最低COST超预算|兜底失败|五环重复|三环)/);
      if (超预算匹配?.[1]) 失败子原型.add(String(超预算匹配[1]).trim());
      if (Array.isArray(错误?.失败子原型列表)) {
        错误.失败子原型列表.forEach(项 => {
          const 原型 = String(项 || '').trim();
          if (原型) 失败子原型.add(原型);
        });
      }
      const 统一失败机制 = 匹配技能生成失败机制_V1(错误);
      if (统一失败机制) 失败子原型.add(统一失败机制);
      const 原型匹配 = 错误文本.match(/技能生成错误:([^:：]+?)不满足当前品质门槛|技能生成错误:([^:：]+?)没有共享原型编译定义|技能生成错误:[^:：]+不允许主机制原型([^:：]+)/);
      const 原型 = String(原型匹配?.[1] || 原型匹配?.[2] || 原型匹配?.[3] || '').trim();
      if (原型) 失败子原型.add(原型);
      if (!当前候选机制原型) 当前候选机制原型 = 统一失败机制 || 原型 || String(大类匹配?.[1] || 超预算匹配?.[1] || '').trim();
      if (候选蓝图?.主机制原型) 失败子原型.add(String(候选蓝图.主机制原型).trim());
      失败记录.push(错误文本);
      记录技能生成事件_V1(context, {
        类型: '候选失败',
        候选序号,
        阶段: 候选序号 === 0 ? '随机候选' : (候选序号 === 1 ? '预算收敛重抽' : '预算收敛兜底'),
        系别,
        天赋: 天赋层级,
        魂环位,
        来源: 基础生成选项.sourceCategory,
        主机制原型: 当前候选机制原型,
        失败类型: 归类技能生成错误_V1(错误),
        错误信息: 错误文本,
        失败子原型: [...失败子原型],
        耗时毫秒: Number(Math.max(0, 读取性能计时毫秒_V1() - 候选开始毫秒).toFixed(3)),
      });
      if (指定蓝图) break;
    }
  }
  if (!临时技能) {
    const 错误 = 最后错误 || new Error('技能生成错误:未生成预算内技能');
    if (失败记录.length && 错误 && typeof 错误 === 'object') {
      错误.生成失败记录 = 失败记录;
      错误.message = `${String(错误.message || 错误)}；三次失败记录:${失败记录.slice(0, 3).join(' | ')}`;
    }
    记录技能生成事件_V1(context, {
      类型: '生成最终失败',
      系别,
      天赋: 天赋层级,
      魂环位,
      来源: 基础生成选项.sourceCategory,
      失败类型: 归类技能生成错误_V1(错误),
      错误信息: String(错误?.message || 错误 || ''),
      失败记录: [...失败记录],
      耗时毫秒: Number(Math.max(0, 读取性能计时毫秒_V1() - 直接生成开始毫秒).toFixed(3)),
    });
    if (context?.技能生成失败软落地 === true) {
      清空恢复增益重复账本缓存_V1(恢复增益重复账本缓存);
      return 技能生成失败软落地_V1(skill, context, 错误, null);
    }
    throw 错误;
  }
  Object.keys(skill).forEach(键 => delete skill[键]);
  强制普通魂技固定启动消耗_V1(临时技能, 基础生成选项);
  const 角色资源上限 = {
    魂力: Number(基础生成选项?.角色?.属性?.魂力上限 || 0),
    体力: Number(基础生成选项?.角色?.属性?.体力上限 || 0),
    精神力: Number(基础生成选项?.角色?.属性?.精神力上限 || 0),
    生命: Number(基础生成选项?.角色?.属性?.HP上限 || 0),
    HP: Number(基础生成选项?.角色?.属性?.HP上限 || 0),
  };
  if (临时技能.消耗 && typeof 临时技能.消耗 === 'object' && !Array.isArray(临时技能.消耗)) {
    Object.entries(临时技能.消耗).forEach(([资源, 原始消耗]) => {
      const 消耗 = Number(原始消耗);
      const 上限 = Number(角色资源上限[资源] || 0);
      if (Number.isFinite(消耗) && 消耗 > 0 && 上限 > 0 && 消耗 > 上限) {
        临时技能.消耗[资源] = Math.max(1, Math.floor(上限));
      }
    });
  }
  Object.assign(skill, 临时技能);
  清空恢复增益重复账本缓存_V1(恢复增益重复账本缓存);
  记录技能生成事件_V1(context, {
    类型: '生成最终成功',
    系别,
    天赋: 天赋层级,
    魂环位,
    来源: 基础生成选项.sourceCategory,
    重抽次数: Math.max(0, 失败记录.length),
    失败记录: [...失败记录],
    耗时毫秒: Number(Math.max(0, 读取性能计时毫秒_V1() - 直接生成开始毫秒).toFixed(3)),
  });
  return skill;
}

function ensureSkillStructGenerated(skill, context = {}) {
  if (!skill || typeof skill !== 'object') return skill;
  const 魂技位 = Math.max(1, Math.floor(Number(context?.获得阶段魂环数 ?? context?.ringIndex ?? context?.魂环位 ?? 读取技能结构魂环位_V1(skill) ?? 1)) || 1);
  context = {
    ...(context || {}),
    ringIndex: 魂技位,
    魂环位: 魂技位,
    type: context?.type || context?.系别 || context?.武魂系别 || '强攻系',
    系别: context?.系别 || context?.type || context?.武魂系别 || '强攻系',
    talentTier: context?.talentTier || context?.角色?.属性?.天赋梯队 || '正常',
    恢复增益重复账本缓存: context?.恢复增益重复账本缓存 || 创建恢复增益重复账本缓存_V1(),
  };
  if (!Array.isArray(skill._效果数组)) skill._效果数组 = [];
  if (typeof skill.魂技名 !== 'string' || !skill.魂技名.trim() || isSkillTodoText(skill.魂技名)) {
    skill.魂技名 = buildSkillNameTodoText(context?.textContext || context);
  }
  let hasPackedEffects = Array.isArray(skill._效果数组) && skill._效果数组.length > 0;
  let 本次已自动生成 = false;
  if (技能需要自动生成结构_V1(skill, context)) {
    try {
      直接自动生成技能结构_V1(skill, { ...context, 技能生成失败软落地: true });
    } catch (错误) {
      if (!是技能生成可软化错误_V1(错误)) throw 错误;
      技能生成失败软落地_V1(skill, context, 错误, null);
    }
    hasPackedEffects = Array.isArray(skill._效果数组) && skill._效果数组.length > 0;
    本次已自动生成 = hasPackedEffects;
  }

  if (!hasPackedEffects) {
    if (typeof skill.画面描述 !== 'string' || !skill.画面描述.trim() || isSkillTodoText(skill.画面描述))
      skill.画面描述 = AI_TODO_SKILL_VISUAL;
    if (typeof skill.效果描述 !== 'string' || !skill.效果描述.trim() || isSkillTodoText(skill.效果描述))
      skill.效果描述 = AI_TODO_SKILL_EFFECT;
  } else {
    if (typeof skill.画面描述 !== 'string' || !skill.画面描述.trim() || isSkillTodoText(skill.画面描述))
      skill.画面描述 = AI_TODO_SKILL_VISUAL;
    if (typeof skill.效果描述 !== 'string' || !skill.效果描述.trim() || isSkillTodoText(skill.效果描述))
      skill.效果描述 = AI_TODO_SKILL_EFFECT;
  }

  if (typeof skill.魂技名 !== 'string' || !skill.魂技名.trim() || isSkillTodoText(skill.魂技名)) {
    skill.魂技名 = buildSkillNameTodoText(context?.textContext || context);
  }

  applySkillElementInheritance(skill, context);
  if (!Array.isArray(skill._效果数组) || skill._效果数组.length === 0) return skill;
  delete skill[技能机制决策临时字段_V1];
  if (skill.画面描述 === SKILL_TEXT_UNKNOWN) skill.画面描述 = AI_TODO_SKILL_VISUAL;
  if (skill.效果描述 === SKILL_TEXT_UNKNOWN) skill.效果描述 = AI_TODO_SKILL_EFFECT;
  if (本次已自动生成) return hydrateSkillTextByPackedEffects(skill);
  const 临时技能 = cloneJsonValue(skill, {});
  收口技能执行结构_V1(临时技能, {
    目标: String(临时技能.承载方式 || '').trim() === '造物承载' ? '自身' : '单体',
    技能: 临时技能,
    passiveMode: context?.passiveMode === true,
    path: context?.path || '技能',
  });
  const 跳过预算门禁 = context?.跳过预算门禁 === true || 是血脉技能预算豁免上下文_V1(context, context?.path || '');
  if (跳过预算门禁) {
    syncConstructSkillMetadata(临时技能);
    Object.keys(skill).forEach(键 => delete skill[键]);
    Object.assign(skill, 临时技能);
    return hydrateSkillTextByPackedEffects(skill);
  }
  try {
    syncConstructSkillMetadata(临时技能);
    收敛技能到预算区间_V1(临时技能, {
      ...context,
      path: context?.path || '技能',
      机制标签: context?.sourceCategory || context?.来源类别 || context?.来源 || '技能',
    }, context?.候选预算档案 || null);
    断言技能预算_V1(临时技能, {
      ...context,
      path: context?.path || '技能',
    }, context?.sourceCategory || context?.来源类别 || context?.来源 || '技能');
    断言直接结算收益预算_V1(临时技能, '技能', context || {});
  } catch (错误) {
    if (!是技能生成可软化错误_V1(错误)) throw 错误;
    return 技能生成失败软落地_V1(skill, context, 错误, 临时技能);
  }
  Object.keys(skill).forEach(键 => delete skill[键]);
  强制普通魂技固定启动消耗_V1(临时技能, context || {});
  Object.assign(skill, 临时技能);
  return hydrateSkillTextByPackedEffects(skill);
}

function ensureSkillMapGenerated(skillMap, contextFactory = () => ({}), 公共上下文 = {}) {
  const 恢复增益重复账本缓存 = 公共上下文?.恢复增益重复账本缓存 || 创建恢复增益重复账本缓存_V1();
  _(skillMap || {}).forEach((skill, skillName) => {
    const 技能上下文 = { ...(公共上下文 || {}), ...(contextFactory(skill, skillName) || {}) };
    if (!技能上下文.技能键) 技能上下文.技能键 = String(skillName || '').trim();
    if (!技能上下文.恢复增益重复账本缓存) 技能上下文.恢复增益重复账本缓存 = 恢复增益重复账本缓存;
    ensureSkillStructGenerated(skill, 技能上下文);
  });
  return skillMap || {};
}

var 持久魂兽自创魂技档位_V1 = Object.freeze([
  Object.freeze({ 技能键: '魂兽战技一', 魂环位: 3, 年限: 50000 }),
  Object.freeze({ 技能键: '魂兽战技二', 魂环位: 5, 年限: 100000 }),
  Object.freeze({ 技能键: '魂兽战技三', 魂环位: 7, 年限: 150000 }),
  Object.freeze({ 技能键: '魂兽战技四', 魂环位: 9, 年限: 200000 }),
]);

function 初始化补齐角色技能效果数组_V1(rootData = {}) {
  const 角色集 = rootData && rootData.char && typeof rootData.char === 'object' ? rootData.char : {};
  const 恢复增益重复账本缓存 = 创建恢复增益重复账本缓存_V1();
  const 补齐技能 = (skill, context = {}) => {
    if (!skill || typeof skill !== 'object') return;
    const 技能上下文 = { ...(context || {}), 恢复增益重复账本缓存: context?.恢复增益重复账本缓存 || 恢复增益重复账本缓存 };
    ensureSkillStructGenerated(skill, 技能上下文);
  };
  const 补齐技能映射 = (skillMap = {}, contextFactory = () => ({})) => {
    _(skillMap || {}).forEach((skill, skillName) => {
      if (!skill || typeof skill !== 'object') return;
      const 技能上下文 = contextFactory(skill, skillName) || {};
      if (!技能上下文.技能键) 技能上下文.技能键 = String(skillName || '').trim();
      if (!技能上下文.恢复增益重复账本缓存) 技能上下文.恢复增益重复账本缓存 = 恢复增益重复账本缓存;
      补齐技能(skill, 技能上下文);
    });
  };

  _(角色集 || {}).forEach((char, charName) => {
    if (!char || typeof char !== 'object') return;
    v9_3_最近主机制队列_V1 = [];
    const 通用技能年限 = Math.max(1000, Number(char?.属性?.等级 || 1) * 200);
    const 是持久魂兽 = isSoulBeastCharacter(char);
    const 魂兽名称 = String(char?.name || char?.base?.name || charName || char?.具体物种 || char?.标准物种 || '').trim();
    const 系别 = 是持久魂兽 ? inferTemporarySoulBeastCombatType(String(char?.标准物种 || char?.具体物种 || 魂兽名称 || ''), {
      str: Number(char?.属性?.力量 || 0),
      def: Number(char?.属性?.防御 || 0),
      agi: Number(char?.属性?.敏捷 || 0),
      men_max: Number(char?.属性?.精神力上限 || 0),
    }) : 取角色主武魂系别_V1(char);
    const 天赋梯队 = String(char?.属性?.天赋梯队 || '').trim() || (是持久魂兽 ? '顶级天才' : '正常');
    const 魂兽自创魂技档位 = new Map(持久魂兽自创魂技档位_V1.map(档位 => [档位.技能键, 档位]));

    if (是持久魂兽) {
      if (!char.自创魂技 || typeof char.自创魂技 !== 'object' || Array.isArray(char.自创魂技)) char.自创魂技 = {};
      if (Object.keys(char.自创魂技).length === 0) {
        持久魂兽自创魂技档位_V1.forEach(档位 => {
          char.自创魂技[档位.技能键] = createDefaultRingSkillShell();
        });
      }
    }

    取角色武魂条目_V1(char).forEach(([spiritKey, spiritData]) => {
      if (!spiritData || typeof spiritData !== 'object') return;
      const 武魂系别 = String(spiritData?.系别 || 系别 || '强攻系').trim() || '强攻系';
      const 武魂属性状态 = normalizeSpiritAttributeState(spiritData, spiritKey, char);
      const 武魂元素画像 = buildElementProfileFromAttributeState(武魂属性状态);
      取武魂魂灵条目_V1(spiritData).forEach(([魂灵键, 武魂]) => {
        if (!武魂 || typeof 武魂 !== 'object') return;
        const 来源品质 =
          normalizeSoulSpiritQuality(武魂?.品质 || '') ||
          inferSoulSpiritQuality(武魂) ||
          normalizeSoulSpiritQuality(spiritData?.品质 || '') ||
          inferSoulSpiritQuality(spiritData) ||
          '';
        取魂灵魂环条目_V1(武魂).forEach(([ringIndexStr, ring]) => {
          const 魂环位 = 读取槽位序号_V1(ringIndexStr, 1);
          const 当前魂环数量 = 计算武魂当前魂环数量_V1(spiritData);
          const 武魂名称 = String(spiritData?.表象名称 || spiritKey || '').trim();
          补齐技能映射(Object.fromEntries(取魂环魂技条目_V1(ring)), (_, skillName) => ({
            type: 武魂系别,
            武魂系别,
            角色: char,
            武魂数据: spiritData,
            魂环数据: ring,
            path: `char.${charName}.${spiritKey}.${魂灵键}.${ringIndexStr}.${skillName}`,
            talentTier: 天赋梯队,
            age: ring?.年限,
            ringAge: ring?.年限,
            ringIndex: 魂环位,
            当前魂环数量,
            martialSoulName: 武魂名称,
            compatibility: 武魂.契合度 || 100,
            sourceQuality: 来源品质,
            preferredSecondary: [],
            elementProfile: 武魂元素画像,
            可调用元素: 武魂属性状态.可调用元素,
            callableElements: 武魂属性状态.可调用元素,
            elementTrigger: '继承武魂',
            sourceCategory: '魂技',
            允许自动生成技能结构: true,
            forceTrueBody: 魂环位 === 7,
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
          }));
        });
      });

      取武魂直接魂环条目_V1(spiritData).forEach(([ringIndexStr, ring]) => {
        const 魂环位 = 读取槽位序号_V1(ringIndexStr, 1);
        const 当前魂环数量 = 计算武魂当前魂环数量_V1(spiritData);
        const 武魂名称 = String(spiritData?.表象名称 || spiritKey || '').trim();
        const 来源品质 =
          normalizeSoulSpiritQuality(spiritData?.品质 || '') ||
          inferSoulSpiritQuality(spiritData) ||
          '';
        补齐技能映射(Object.fromEntries(取魂环魂技条目_V1(ring)), (_, skillName) => ({
          type: 武魂系别,
          武魂系别,
          角色: char,
          武魂数据: spiritData,
          魂环数据: ring,
          path: `char.${charName}.${spiritKey}.${ringIndexStr}.${skillName}`,
          talentTier: 天赋梯队,
          age: ring?.年限,
          ringAge: ring?.年限,
          ringIndex: 魂环位,
          当前魂环数量,
          martialSoulName: 武魂名称,
          compatibility: 100,
          sourceQuality: 来源品质,
          preferredSecondary: [],
          elementProfile: 武魂元素画像,
          可调用元素: 武魂属性状态.可调用元素,
          callableElements: 武魂属性状态.可调用元素,
          elementTrigger: '继承武魂',
          sourceCategory: '魂技',
          允许自动生成技能结构: true,
          forceTrueBody: 魂环位 === 7,
          textContext: {
            spiritName: spiritData?.表象名称 || skillName,
            type: 武魂系别,
            spiritDesc: String(spiritData?.描述 || '').trim(),
            martialSoulName: 武魂名称,
            ringSource: String(ring?.来源 || '').trim(),
          },
        }));
      });
    });

    _(char.魂骨 || {}).forEach((bone, bonePart) => {
      补齐技能映射(bone?.附带技能, (_, skillName) => ({
        type: 系别,
        武魂系别: 系别,
        角色: char,
        path: `char.${charName}.魂骨.${bonePart}.附带技能.${skillName}`,
        talentTier: 天赋梯队,
        age: bone?.年限 || bone?.age || 通用技能年限,
        ringAge: bone?.年限 || bone?.age || 通用技能年限,
        魂骨年限: bone?.年限 || bone?.age || 通用技能年限,
        ringIndex: 1,
        compatibility: 100,
        passiveMode: true,
        passiveName: skillName,
        preferredSecondary: getBonePreferredSecondary(bonePart),
        sourceCategory: '魂骨技能',
        textContext: {
          spiritName: bone?.名称 || bonePart || skillName,
          type: 系别,
        },
      }));
    });

    const 自创属性状态 = buildCharacterCustomSkillAttributeState(char);
    const 自创元素画像 = buildElementProfileFromAttributeState(自创属性状态);
    补齐技能映射(char.自创魂技, (_, skillName) => {
      const 魂兽档位 = 是持久魂兽 ? 魂兽自创魂技档位.get(String(skillName || '').trim()) : null;
      return {
        type: 系别,
        武魂系别: 系别,
        角色: char,
        path: `char.${charName}.自创魂技.${skillName}`,
        talentTier: 天赋梯队,
        age: 魂兽档位 ? 魂兽档位.年限 : Math.max(1000, 通用技能年限),
        ringAge: 魂兽档位 ? 魂兽档位.年限 : Math.max(1000, 通用技能年限),
        ringIndex: 魂兽档位 ? 魂兽档位.魂环位 : Math.max(1, Math.ceil(Number(char?.属性?.等级 || 1) / 10)),
        compatibility: 100,
        preferredSecondary: [],
        elementProfile: 自创元素画像,
        可调用元素: 自创属性状态.可调用元素,
        callableElements: 自创属性状态.可调用元素,
        elementTrigger: 是持久魂兽 ? '魂兽本体' : '自创',
        sourceCategory: 魂兽档位 ? '魂兽自创魂技' : '自创魂技',
        允许自动生成技能结构: 魂兽档位 ? true : undefined,
        martialSoulName: 是持久魂兽 ? 魂兽名称 : '',
        forceTrueBody: false,
        textContext: {
          spiritName: 是持久魂兽
            ? (魂兽名称 || String(char?.具体物种 || char?.标准物种 || '').trim() || skillName)
            : skillName,
          type: 系别,
          martialSoulName: 是持久魂兽 ? 魂兽名称 : '',
          ringSource: '',
        },
      };
    });

    同步内置血脉技能模板_V1(char);
    补齐技能映射(char.血脉之力?.被动, (_, skillName) => ({
      type: 系别,
      武魂系别: 系别,
      角色: char,
      path: `char.${charName}.血脉之力.被动.${skillName}`,
      talentTier: 天赋梯队,
      age: Math.max(10000, 通用技能年限),
      ringAge: Math.max(10000, 通用技能年限),
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
        type: 系别,
      },
    }));

    补齐技能映射(char.血脉之力?.技能, (_, skillName) => ({
      type: 系别,
      武魂系别: 系别,
      角色: char,
      path: `char.${charName}.血脉之力.技能.${skillName}`,
      talentTier: 天赋梯队,
      age: Math.max(10000, 通用技能年限),
      ringAge: Math.max(10000, 通用技能年限),
      sourceCategory: '血脉技能',
      来源: '血脉技能',
      跳过预算门禁: true,
      血脉技能: true,
      compatibility: 100,
      preferredSecondary: [],
      elementTrigger: '继承血脉',
      textContext: {
        spiritName: char.血脉之力?.血脉 || skillName,
        type: 系别,
      },
    }));

    取血脉气血魂环条目_V1(char.血脉之力).forEach(([ringIndexStr, ringData]) => {
      const 魂环位 = 读取槽位序号_V1(ringIndexStr, 1);
      补齐技能映射(Object.fromEntries(取气血魂环魂技条目_V1(ringData)), (_, skillName) => ({
        type: 系别,
        武魂系别: 系别,
        角色: char,
        魂环数据: ringData,
        path: `char.${charName}.血脉之力.${ringIndexStr}.${skillName}`,
        talentTier: 天赋梯队,
        age: Math.max(1000, 魂环位 * 5000),
        ringAge: Math.max(1000, 魂环位 * 5000),
        ringIndex: 魂环位,
        sourceCategory: '气血魂技',
        来源: '气血魂技',
        跳过预算门禁: true,
        血脉技能: true,
        compatibility: 100,
        preferredSecondary: [],
        elementTrigger: '继承血脉',
        textContext: {
          spiritName: char.血脉之力?.血脉 || skillName,
          type: 系别,
        },
      }));
    });

    _(char.武魂融合技 || {}).forEach((fusionData, fusionName) => {
      if (!fusionData || typeof fusionData !== 'object') return;
      const 融合元素画像 = getFusionSkillElementProfile(fusionData, char);
      补齐技能(fusionData?.技能数据, {
        type: 系别,
        武魂系别: 系别,
        角色: char,
        path: `char.${charName}.武魂融合技.${fusionName}.技能数据`,
        talentTier: 天赋梯队,
        age: Math.max(10000, 通用技能年限),
        ringAge: Math.max(10000, 通用技能年限),
        ringIndex: Math.max(1, Math.ceil(Number(char?.属性?.等级 || 1) / 10)),
        compatibility: 100,
        preferredSecondary: [],
        elementProfile: 融合元素画像,
        可调用元素: 融合元素画像?.elements || [],
        callableElements: 融合元素画像?.elements || [],
        elementTrigger: '融合',
        sourceCategory: '武魂融合技',
        来源: '武魂融合技',
        来源类别: '武魂融合技',
        rootData,
        融合技: fusionData,
        融合参与者: fusionData?.融合参与者,
        融合模式: fusionData?.融合模式,
        融合对象: fusionData?.融合对象,
        textContext: {
          spiritName: fusionName,
          type: 系别,
        },
      });
    });
  });
  return rootData;
}

function 注册技能正式结构补齐接口_V1() {
  const 注册到根 = root => {
    if (!root || typeof root !== 'object') return;
    root.__LWCS_INITIALIZE_SKILL_EFFECTS__ = 初始化补齐角色技能效果数组_V1;
  };
  注册到根(globalThis);
  try { if (globalThis.parent && globalThis.parent !== globalThis) 注册到根(globalThis.parent); } catch (错误) {}
  try { if (globalThis.top && globalThis.top !== globalThis) 注册到根(globalThis.top); } catch (错误) {}
}

注册技能正式结构补齐接口_V1();

function 创建战斗事件纯契约_V1() {
  const operations = Object.freeze([
    'HP_DELTA',
    'SHIELD_DELTA',
    'RESOURCE_PAY',
    'RESOURCE_RESTORE',
    'RESOURCE_REDUCE',
    'RESOURCE_LOCK',
    'RESOURCE_UNLOCK',
    'RESOURCE_REFUND',
    'NATURAL_RECOVERY',
    'SUSTAIN_COST',
    'STATE_APPLY',
    'STATE_REFRESH',
    'STATE_REPLACE',
    'STATE_REMOVE',
    'DOT_TICK',
    'HOT_TICK',
    'SUMMON_CREATE',
    'SUMMON_WINDOW',
    'SUMMON_EXPIRE',
    'HOST_INVALID',
    'OPPORTUNITY_CANCEL',
    'OPPORTUNITY_GRANT',
  ]);
  const operationSet = new Set(operations);
  const phasePriority = Object.freeze({
    RESOURCE_RESTORE: 10,
    NATURAL_RECOVERY: 10,
    RESOURCE_REFUND: 15,
    RESOURCE_UNLOCK: 20,
    RESOURCE_REDUCE: 30,
    RESOURCE_LOCK: 35,
    RESOURCE_PAY: 40,
    SUSTAIN_COST: 45,
    HP_DELTA: 50,
    SHIELD_DELTA: 50,
    STATE_REMOVE: 55,
    STATE_REPLACE: 56,
    STATE_REFRESH: 57,
    STATE_APPLY: 58,
    DOT_TICK: 60,
    HOT_TICK: 60,
    SUMMON_CREATE: 65,
    HOST_INVALID: 66,
    SUMMON_WINDOW: 70,
    OPPORTUNITY_CANCEL: 75,
    OPPORTUNITY_GRANT: 80,
    SUMMON_EXPIRE: 90,
  });
  const compareBattleEventPosition = (left = {}, right = {}) =>
    Number(left?.round || 0) - Number(right?.round || 0) ||
    Number(left?.opportunitySequence || 0) - Number(right?.opportunitySequence || 0) ||
    Number(left?.actionSequence || 0) - Number(right?.actionSequence || 0) ||
    Number(left?.phasePriority || 0) - Number(right?.phasePriority || 0) ||
    Number(left?.effectSequence || 0) - Number(right?.effectSequence || 0) ||
    String(left?.eventId || '').localeCompare(String(right?.eventId || ''));
  const validateOutcomeGroup = group => {
    if (!group || typeof group !== 'object') {
      throw new TypeError('BATTLE_OUTCOME_GROUP_INVALID');
    }
    if (String(group.schemaVersion || '') !== '8.3-outcome-group-1') {
      throw new Error('BATTLE_OUTCOME_GROUP_SCHEMA_MISMATCH');
    }
    const groupKey = String(group.groupKey || '').trim();
    if (!groupKey) throw new Error('BATTLE_OUTCOME_GROUP_KEY_MISSING');
    const outcomes = Array.isArray(group.outcomes) ? group.outcomes : [];
    if (!outcomes.length) throw new Error(`BATTLE_OUTCOME_GROUP_EMPTY:${groupKey}`);
    const outcomeIds = new Set();
    let probabilityTotal = 0;
    outcomes.forEach(outcome => {
      const outcomeId = String(outcome?.outcomeId || '').trim();
      const probability = Number(outcome?.probability);
      if (!outcomeId || outcomeIds.has(outcomeId)) {
        throw new Error(`BATTLE_OUTCOME_ID_INVALID:${groupKey}:${outcomeId || 'missing'}`);
      }
      if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
        throw new Error(`BATTLE_OUTCOME_PROBABILITY_INVALID:${groupKey}:${outcomeId}`);
      }
      outcomeIds.add(outcomeId);
      probabilityTotal += probability;
    });
    if (Math.abs(probabilityTotal - 1) > 1e-9) {
      throw new Error(`BATTLE_OUTCOME_PROBABILITY_SUM_INVALID:${groupKey}:${probabilityTotal}`);
    }
    return true;
  };
  const validateProjectedEvent = event => {
    if (!event || typeof event !== 'object') {
      throw new TypeError('BATTLE_PROJECTED_EVENT_INVALID');
    }
    if (String(event.schemaVersion || '') !== '8.3-projected-event-1') {
      throw new Error('BATTLE_PROJECTED_EVENT_SCHEMA_MISMATCH');
    }
    const eventId = String(event.eventId || '').trim();
    const operation = String(event.operation || '').trim().toUpperCase();
    if (!eventId) throw new Error('BATTLE_PROJECTED_EVENT_ID_MISSING');
    if (!operationSet.has(operation)) {
      throw new Error(`BATTLE_PROJECTED_EVENT_OPERATION_INVALID:${eventId}:${operation || 'missing'}`);
    }
    for (const key of [
      'round',
      'opportunitySequence',
      'actionSequence',
      'phasePriority',
      'effectSequence',
    ]) {
      const value = Number(event[key]);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`BATTLE_PROJECTED_EVENT_POSITION_INVALID:${eventId}:${key}`);
      }
    }
    return true;
  };
  return Object.freeze({
    schemaVersion: '8.3-battle-event-contract-1',
    operations,
    phasePriority,
    compareBattleEventPosition,
    validateOutcomeGroup,
    validateProjectedEvent,
  });
}

function 注册战斗事件纯契约_V1() {
  const contract = 创建战斗事件纯契约_V1();
  const register = target => {
    if (!target || typeof target !== 'object') return;
    target.__LWCS_BATTLE_EVENT_CONTRACT__ = contract;
  };
  register(globalThis);
  try { if (globalThis.parent && globalThis.parent !== globalThis) register(globalThis.parent); } catch (错误) {}
  try { if (globalThis.top && globalThis.top !== globalThis) register(globalThis.top); } catch (错误) {}
}

注册战斗事件纯契约_V1();


globalThis.__LWCS_COMPILE_SKILL_STRUCTURE_TEXT__ = 编译技能结构为人类语言_V1;
try { if (globalThis.parent && globalThis.parent !== globalThis) globalThis.parent.__LWCS_COMPILE_SKILL_STRUCTURE_TEXT__ = 编译技能结构为人类语言_V1; } catch (错误) {}
try { if (globalThis.top && globalThis.top !== globalThis) globalThis.top.__LWCS_COMPILE_SKILL_STRUCTURE_TEXT__ = 编译技能结构为人类语言_V1; } catch (错误) {}
globalThis.__LWCS_CALC_INITIAL_CULTIVATION_LEVEL__ = 计算开场初始化修为等级_V1;
globalThis.__LWCS_CALC_SOUL_POWER_CAP__ = 计算魂力曲线值_V1;
globalThis.__LWCS_GET_NEXT_CULTIVATION_LEVEL__ = getNextCultivationLevelStep;
globalThis.__LWCS_C2_CONSUMER_RULES_V1__ = Object.freeze({
  getNextCultivationLevelStep,
  getCharacterBaseSoulPowerRequirementAtLevel,
  计算等级提升结果_V1,
  应用等级提升_V1,
  计算群体撤离成功率_V1,
  结算群体撤离_V1,
  读取正式物品消费规则_V1,
  读取坚挺金苍蝇成功授予_V1,
  消费坚挺金苍蝇成功魂技_V1,
  读取坚挺金苍蝇自用倍率_V1,
  缩放技能效果数组_V1,
  计算魂骨年限提升_V1,
});
globalThis.__LWCS_CALC_DIRECT_SETTLE_BUDGET__ = 计算直接结算收益预算_V1;
globalThis.__LWCS_ASSERT_DIRECT_SETTLE_BUDGET__ = 断言直接结算收益预算_V1;
globalThis.__LWCS_GET_DIRECT_SETTLE_BUDGET_CONFIG__ = 读取直接结算收益预算系数_V1;
globalThis.__LWCS_CALC_ACTIVE_EQUIPMENT_BONUS__ = 计算当前装备生效属性加成_V1;
try { if (globalThis.parent && globalThis.parent !== globalThis) globalThis.parent.__LWCS_CALC_INITIAL_CULTIVATION_LEVEL__ = 计算开场初始化修为等级_V1; } catch (错误) {}
try { if (globalThis.top && globalThis.top !== globalThis) globalThis.top.__LWCS_CALC_INITIAL_CULTIVATION_LEVEL__ = 计算开场初始化修为等级_V1; } catch (错误) {}
try { if (globalThis.parent && globalThis.parent !== globalThis) globalThis.parent.__LWCS_CALC_SOUL_POWER_CAP__ = 计算魂力曲线值_V1; } catch (错误) {}
try { if (globalThis.top && globalThis.top !== globalThis) globalThis.top.__LWCS_CALC_SOUL_POWER_CAP__ = 计算魂力曲线值_V1; } catch (错误) {}
try { if (globalThis.parent && globalThis.parent !== globalThis) globalThis.parent.__LWCS_GET_NEXT_CULTIVATION_LEVEL__ = getNextCultivationLevelStep; } catch (错误) {}
try { if (globalThis.top && globalThis.top !== globalThis) globalThis.top.__LWCS_GET_NEXT_CULTIVATION_LEVEL__ = getNextCultivationLevelStep; } catch (错误) {}
try { if (globalThis.parent && globalThis.parent !== globalThis) globalThis.parent.__LWCS_C2_CONSUMER_RULES_V1__ = globalThis.__LWCS_C2_CONSUMER_RULES_V1__; } catch (错误) {}
try { if (globalThis.top && globalThis.top !== globalThis) globalThis.top.__LWCS_C2_CONSUMER_RULES_V1__ = globalThis.__LWCS_C2_CONSUMER_RULES_V1__; } catch (错误) {}
try { if (globalThis.parent && globalThis.parent !== globalThis) globalThis.parent.__LWCS_CALC_DIRECT_SETTLE_BUDGET__ = 计算直接结算收益预算_V1; } catch (错误) {}
try { if (globalThis.top && globalThis.top !== globalThis) globalThis.top.__LWCS_CALC_DIRECT_SETTLE_BUDGET__ = 计算直接结算收益预算_V1; } catch (错误) {}
try { if (globalThis.parent && globalThis.parent !== globalThis) globalThis.parent.__LWCS_ASSERT_DIRECT_SETTLE_BUDGET__ = 断言直接结算收益预算_V1; } catch (错误) {}
try { if (globalThis.top && globalThis.top !== globalThis) globalThis.top.__LWCS_ASSERT_DIRECT_SETTLE_BUDGET__ = 断言直接结算收益预算_V1; } catch (错误) {}
try { if (globalThis.parent && globalThis.parent !== globalThis) globalThis.parent.__LWCS_GET_DIRECT_SETTLE_BUDGET_CONFIG__ = 读取直接结算收益预算系数_V1; } catch (错误) {}
try { if (globalThis.top && globalThis.top !== globalThis) globalThis.top.__LWCS_GET_DIRECT_SETTLE_BUDGET_CONFIG__ = 读取直接结算收益预算系数_V1; } catch (错误) {}
try { if (globalThis.parent && globalThis.parent !== globalThis) globalThis.parent.__LWCS_CALC_ACTIVE_EQUIPMENT_BONUS__ = 计算当前装备生效属性加成_V1; } catch (错误) {}
try { if (globalThis.top && globalThis.top !== globalThis) globalThis.top.__LWCS_CALC_ACTIVE_EQUIPMENT_BONUS__ = 计算当前装备生效属性加成_V1; } catch (错误) {}

// 特殊权限与赛事纯运行时。只处理业务规则和派生计算，不操作 UI、不发起剧情请求。

!(function () {
  'use strict';

  const 每日tick = 144;
  const 每月tick = 4320;
  const 每年tick = 51840;
  const 小时tick = 6;
  const 周期tick表 = Object.freeze({ 每日: 每日tick, 每月: 每月tick, 每年: 每年tick });
  const 权限类型表 = Object.freeze(['资格', '折扣', '物品选择', '奖励加成']);
  const 赛事状态表 = Object.freeze(['筹备', '进行中', '已完成']);
  const 项目名表 = Object.freeze(['个人赛', '团体赛']);
  const 流程表 = Object.freeze(['单场', '循环', '淘汰', '循环后淘汰']);

  const 文本 = 值 => String(值 ?? '').trim();
  const 数值 = (值, 兜底 = 0) => Number.isFinite(Number(值)) ? Number(值) : 兜底;
  const 整数 = (值, 最小 = 0, 最大 = Number.MAX_SAFE_INTEGER) =>
    Math.min(最大, Math.max(最小, Math.floor(数值(值, 最小))));
  const 对象 = 值 => !!值 && typeof 值 === 'object' && !Array.isArray(值);
  const 克隆 = (值, 兜底 = null) => {
    try { return structuredClone(值); } catch (错误) {}
    try { return JSON.parse(JSON.stringify(值)); } catch (错误) {}
    return 兜底;
  };

  const 中文数字 = Object.freeze({ 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 });

  function 解析中文数字(输入 = '') {
    const 原文 = 文本(输入);
    if (/^\d+(?:\.\d+)?$/.test(原文)) return Number(原文);
    if (原文 === '半') return 0.5;
    if (!原文 || !/^[零一二两三四五六七八九十百千万]+$/.test(原文)) return NaN;
    let 总数 = 0;
    let 当前 = 0;
    const 单位表 = { 十: 10, 百: 100, 千: 1000, 万: 10000 };
    for (const 字符 of 原文) {
      if (Object.prototype.hasOwnProperty.call(中文数字, 字符)) {
        当前 = 中文数字[字符];
      } else {
        const 单位 = 单位表[字符];
        if (单位 === 10000) {
          总数 = (总数 + 当前) * 单位;
          当前 = 0;
        } else {
          总数 += (当前 || 1) * 单位;
          当前 = 0;
        }
      }
    }
    return 总数 + 当前;
  }

  function 解析时长tick值(输入) {
    if (输入 === undefined || 输入 === null || 输入 === '') return null;
    if (Number.isFinite(Number(输入))) return Math.max(0, Math.floor(Number(输入)));
    let 原文 = 文本(输入).replaceAll('　', '').replaceAll(' ', '').replaceAll('每', '');
    if (!原文) return null;
    if (/终生|永久|无限期/.test(原文)) return null;
    if (原文 === '半年') return 每年tick / 2;
    if (原文 === '半个月') return 每月tick / 2;
    if (原文 === '半天' || 原文 === '半日') return 每日tick / 2;
    let 总tick = 0;
    let 命中 = 0;
    const 单位表 = [
      { 词: '小时', tick: 小时tick },
      { 词: '时', tick: 小时tick },
      { 词: '分钟', tick: 小时tick / 60 },
      { 词: '分', tick: 小时tick / 60 },
      { 词: '年', tick: 每年tick },
      { 词: '个月', tick: 每月tick },
      { 词: '月', tick: 每月tick },
      { 词: '周', tick: 每日tick * 7 },
      { 词: '天', tick: 每日tick },
      { 词: '日', tick: 每日tick },
    ];
    while (原文) {
      const 匹配 = 原文.match(/^(\d+(?:\.\d+)?|半|[零一二两三四五六七八九十百千万]+)?/);
      const 数量文本 = 匹配?.[1] || '';
      const 数量 = 数量文本 ? 解析中文数字(数量文本) : 1;
      if (!Number.isFinite(数量) || 数量 <= 0) break;
      原文 = 原文.slice(数量文本.length);
      const 单位 = 单位表.find(候选 => 原文.startsWith(候选.词));
      if (!单位) break;
      原文 = 原文.slice(单位.词.length);
      总tick += 数量 * 单位.tick;
      命中 += 1;
    }
    if (!命中 || 原文 || !(总tick > 0)) throw new Error(`无法识别时间范围：${文本(输入)}`);
    return Math.max(1, Math.floor(总tick));
  }

  function 解析时长tick(输入, 当前tick = 0) {
    const 时长tick = 解析时长tick值(输入);
    return 时长tick === null ? null : Math.max(0, Math.floor(Number(当前tick) + 时长tick));
  }

  function 解析重置周期(输入 = '') {
    const 原文 = 文本(输入).replaceAll('　', '').replaceAll(' ', '');
    if (!原文) return '';
    const 周期tick = 解析时长tick值(原文);
    if (周期tick === null) throw new Error(`重置周期不能为永久时长：${原文}`);
    const 规范文本 = 原文.replace(/^每/, '');
    return /^[小时日天月年周分]/.test(规范文本) ? `1${规范文本}` : 规范文本;
  }

  function 解析重置周期tick(输入 = '') {
    const 周期 = 解析重置周期(输入);
    return 周期 ? 解析时长tick值(周期) : 0;
  }

  function 解析使用次数(输入) {
    if (typeof 输入 === 'number') {
      if (!Number.isFinite(输入) || 输入 < 1 || Math.floor(输入) !== 输入) throw new Error('使用次数必须是正整数');
      return 输入;
    }
    const 文本值 = 文本(输入);
    const 匹配 = 文本值.match(/^(?:使用)?(\d+(?:\.\d+)?|半|[零一二两三四五六七八九十百千万]+)次?$/);
    if (!匹配) throw new Error('使用次数必须是正整数或次数表达');
    const 次数 = 解析中文数字(匹配[1]);
    if (!Number.isFinite(次数) || 次数 < 1 || Math.floor(次数) !== 次数) throw new Error('使用次数必须是正整数');
    return 次数;
  }

  function 唯一引用(表 = {}, 引用 = '', 类型 = '记录') {
    const 名称 = 文本(引用);
    if (Object.prototype.hasOwnProperty.call(tableOrEmpty(表), 名称)) return 名称;
    const 命中 = Object.entries(tableOrEmpty(表)).filter(([, 记录]) => 文本(记录?.名称) === 名称);
    if (命中.length !== 1) throw new Error(命中.length ? `${类型}名称重名：${名称}` : `${类型}不存在：${名称}`);
    return 命中[0][0];
  }

  function tableOrEmpty(值) {
    return 对象(值) ? 值 : {};
  }

  function 整理特殊权限(数据根 = {}, 选项 = {}) {
    const 当前tick = Math.max(0, 数值(选项.当前tick ?? 数据根?.world?.时间?.tick, 0));
    const 表 = 数据根?.world?.特殊权限;
    if (!对象(表)) return { 权限表: {}, 删除ID: [] };
    const 删除ID = [];
    Object.entries(表).forEach(([权限ID, 记录]) => {
      if (!对象(记录) || !对象(记录.权限) || !权限类型表.includes(文本(记录.权限.类型))) {
        删除ID.push(权限ID);
        return;
      }
      if (Number.isFinite(Number(记录.到期tick)) && Number(记录.到期tick) <= 当前tick) {
        删除ID.push(权限ID);
        return;
      }
      const 配额 = 记录.使用配额;
      if (配额 === undefined) return;
      if (!对象(配额)) {
        删除ID.push(权限ID);
        return;
      }
      const 原上限 = Number(配额.上限);
      const 原剩余 = Number(配额.剩余);
      if (!Number.isFinite(原上限) || !Number.isFinite(原剩余) || 原上限 < 1 || 原剩余 < 0) {
        删除ID.push(权限ID);
        return;
      }
      配额.上限 = 整数(配额.上限, 1);
      配额.剩余 = 整数(配额.剩余, 0, 配额.上限);
      const 周期 = 文本(配额.重置周期);
      let 周期tick = 0;
      try { 周期tick = 解析重置周期tick(周期); } catch (错误) {
        if (周期) 删除ID.push(权限ID);
        return;
      }
      if (配额.下次重置tick !== undefined && !Number.isFinite(Number(配额.下次重置tick))) {
        删除ID.push(权限ID);
        return;
      }
      if (周期tick > 0) {
        let 下次 = 数值(配额.下次重置tick, 当前tick + 周期tick);
        while (下次 <= 当前tick) {
          配额.剩余 = 配额.上限;
          下次 += 周期tick;
        }
        配额.下次重置tick = Math.floor(下次);
      } else if (配额.剩余 <= 0) {
        删除ID.push(权限ID);
      }
    });
    删除ID.forEach(ID => delete 表[ID]);
    return { 权限表: 表, 删除ID };
  }

  function 权限当前可用(记录 = {}, 当前tick = 0) {
    if (记录?.使用配额 !== undefined && !对象(记录.使用配额)) return false;
    return 对象(记录?.权限) &&
      (!Number.isFinite(Number(记录.到期tick)) || Number(记录.到期tick) > 当前tick) &&
      (!对象(记录.使用配额) || 整数(记录.使用配额.剩余) > 0);
  }

  function 列出持有人权限(数据根 = {}, 持有人 = '', 当前tick = null) {
    const tick = Math.max(0, 数值(当前tick ?? 数据根?.world?.时间?.tick, 0));
    return Object.entries(tableOrEmpty(数据根?.world?.特殊权限))
      .filter(([, 记录]) => 文本(记录?.持有人) === 文本(持有人) && 权限当前可用(记录, tick))
      .map(([权限ID, 记录]) => ({ 权限ID, 记录 }));
  }

  function 折扣适用(权限 = {}, 上下文 = {}) {
    if (权限.类型 !== '折扣') return false;
    if (权限.地点 && 文本(权限.地点) !== 文本(上下文.地点)) return false;
    if (权限.商店 && 文本(权限.商店) !== 文本(上下文.商店)) return false;
    if (权限.物品分类 && 文本(权限.物品分类) !== 文本(上下文.物品分类)) return false;
    if (权限.物品 && 文本(权限.物品) !== 文本(上下文.物品)) return false;
    return true;
  }

  function 计算购买支付比例(数据根 = {}, 持有人 = '', 上下文 = {}) {
    const 命中 = 列出持有人权限(数据根, 持有人)
      .filter(({ 记录 }) => 折扣适用(记录.权限, 上下文))
      .map(({ 权限ID, 记录 }) => ({ 权限ID, 记录, 支付比例: Math.min(99, Math.max(0, 数值(记录.权限.支付比例, 99))) }))
      .sort((a, b) => a.支付比例 - b.支付比例 || a.权限ID.localeCompare(b.权限ID));
    return 命中[0] || { 权限ID: '', 记录: null, 支付比例: 100 };
  }

  function 查找物品定义(数据根 = {}, 物品名 = '') {
    for (const [分类, 定义表] of Object.entries(tableOrEmpty(数据根?.物品))) {
      if (对象(定义表) && 对象(定义表[物品名])) return { 分类, 定义: 定义表[物品名] };
    }
    return null;
  }

  function 生成物品选择候选(数据根 = {}, 权限记录 = {}) {
    const 权限 = 权限记录?.权限 || 权限记录;
    if (!对象(权限) || 权限.类型 !== '物品选择') return [];
    const 名称列表 = [];
    if (权限.来源 === '全局物品库') {
      Object.values(tableOrEmpty(数据根?.物品)).forEach(表 => { if (对象(表)) 名称列表.push(...Object.keys(表)); });
    } else {
      const [地点, 商店] = 文本(权限.来源).split('-', 2);
      // 斗一 / 斗二城市挂在「斗罗大陆」根下、斗四在行星下：顶层没有就按名逐层找（共用地点解析）
      const 地点节点 = 数据根?.world?.地点?.[地点] || (typeof globalThis !== 'undefined' ? globalThis : window).__LWCS_LOCATION_PATH_V1__?.find(数据根, 地点)?.node;
      const 库存 = 地点节点?.商店?.[商店]?.库存;
      if (!对象(库存)) return [];
      Object.entries(库存).forEach(([名称, 记录]) => { if (数值(记录?.库存) > 0) 名称列表.push(名称); });
    }
    return Array.from(new Set(名称列表)).map(物品名 => ({ 物品名, ...(查找物品定义(数据根, 物品名) || {}) }))
      .filter(记录 => !权限.分类 || 文本(记录.分类) === 文本(权限.分类))
      .filter(记录 => !权限.品质 || 文本(记录.定义?.品质 || 记录.定义?.品级) === 文本(权限.品质))
      .sort((a, b) => a.物品名.localeCompare(b.物品名, 'zh-CN'));
  }

  function 计算委托奖励倍率(数据根 = {}, 持有人 = '', 委托名 = '') {
    const 命中 = 列出持有人权限(数据根, 持有人)
      .filter(({ 记录 }) => 记录.权限?.类型 === '奖励加成' && ['全部委托', 文本(委托名)].includes(文本(记录.权限.来源)))
      .map(({ 权限ID, 记录 }) => ({ 权限ID, 记录, 倍率: Math.max(0, 数值(记录.权限.倍率, 1)) }))
      .sort((a, b) => b.倍率 - a.倍率 || a.权限ID.localeCompare(b.权限ID));
    return 命中[0] || { 权限ID: '', 记录: null, 倍率: 1 };
  }

  function 消费特殊权限(数据根 = {}, 权限ID = '', 数量 = 1) {
    const 记录 = 数据根?.world?.特殊权限?.[权限ID];
    if (!记录 || !权限当前可用(记录, 数值(数据根?.world?.时间?.tick))) return false;
    if (!对象(记录.使用配额)) return true;
    const 消耗 = 整数(数量, 1);
    if (整数(记录.使用配额.剩余) < 消耗) return false;
    记录.使用配额.剩余 -= 消耗;
    if (记录.使用配额.剩余 <= 0 && !记录.使用配额.重置周期) delete 数据根.world.特殊权限[权限ID];
    return true;
  }

  function 收集角色装备名称(角色 = {}) {
    const 名称 = new Set();
    const 加入 = 值 => { const 文本值 = 文本(值); if (文本值 && !['无', '未装备'].includes(文本值)) 名称.add(文本值); };
    加入(角色?.装备?.武器?.名称);
    加入(角色?.装备?.防具?.名称);
    加入(角色?.装备?.斗铠?.名称);
    加入(角色?.装备?.机甲?.名称);
    Object.values(角色?.装备?.魂导器?.装配 || {}).forEach(装备 => 加入(装备?.名称));
    return 名称;
  }

  function 角色匹配身份(角色 = {}, 允许身份 = []) {
    if (!允许身份.length) return true;
    const 身份 = new Set([文本(角色?.社交?.主身份)]);
    Object.values(角色?.社交?.势力 || {}).forEach(势力 => 身份.add(文本(势力?.身份)));
    return 允许身份.some(值 => 身份.has(文本(值)));
  }

  function 取项目(赛事, 项目名) {
    return 赛事?.项目?.[项目名] || null;
  }

  function 有效参赛者条目(项目 = {}) {
    return Object.entries(tableOrEmpty(项目?.参赛者)).filter(([, 记录]) => 文本(记录?.状态 || '参赛') === '参赛');
  }

  function 校验赛事报名(数据根 = {}, 赛事ID = '', 报名 = {}) {
    const 赛事 = 数据根?.world?.赛事?.[赛事ID];
    const 项目名 = 项目名表.includes(文本(报名.项目)) ? 文本(报名.项目) : '个人赛';
    const 项目 = 取项目(赛事, 项目名);
    if (!赛事 || !项目) return { ok: false, reason: '赛事项目不存在' };
    if (赛事.状态 !== '筹备' || 数值(数据根?.world?.时间?.tick) >= 数值(赛事.日程?.开始tick, Number.MAX_SAFE_INTEGER)) {
      return { ok: false, reason: '赛事已经开始报名截止' };
    }
    const 名称 = 文本(报名.名称);
    const 成员 = Array.from(new Set((Array.isArray(报名.成员) ? 报名.成员 : [报名.成员]).map(文本).filter(Boolean)));
    if (!名称 || !成员.length) return { ok: false, reason: '报名名称和成员不能为空' };
    if (有效参赛者条目(项目).length >= Math.max(0, 整数(项目.参赛总数, 0))) {
      return { ok: false, reason: `${项目名}已达到参赛总数` };
    }
    if (项目名 === '个人赛' && 成员.length !== 1) return { ok: false, reason: '个人赛每个参赛者只能有一名成员' };
    if (项目名 === '团体赛' && 项目.参赛限制?.队伍人数上限 && 成员.length > 项目.参赛限制.队伍人数上限) {
      return { ok: false, reason: `队伍人数不能超过${项目.参赛限制.队伍人数上限}人` };
    }
    if (Object.values(tableOrEmpty(项目.参赛者)).some(记录 =>
      文本(记录?.名称) === 名称 || 成员.some(成员名 => 记录?.成员?.includes(成员名)),
    )) return { ok: false, reason: '参赛者或成员已经报名' };
    const 限制 = 项目.参赛限制 || {};
    for (const 成员名 of 成员) {
      const 角色 = 数据根?.char?.[成员名];
      if (!角色) {
        if (报名.允许未知成员 === true) continue;
        return { ok: false, reason: `成员档案不存在：${成员名}` };
      }
      const 年龄 = 数值(角色?.属性?.年龄, NaN);
      const 等级 = 数值(角色?.属性?.等级, NaN);
      if (限制.年龄上限 !== undefined && !(年龄 <= Number(限制.年龄上限))) return { ok: false, reason: `${成员名}超过年龄上限` };
      if (限制.等级上限 !== undefined && !(等级 <= Number(限制.等级上限))) return { ok: false, reason: `${成员名}超过等级上限` };
      if (!角色匹配身份(角色, 限制.允许身份 || [])) return { ok: false, reason: `${成员名}身份不符合报名要求` };
      const 装备 = 收集角色装备名称(角色);
      const 缺少 = (限制.必需装备 || []).find(名称项 => !装备.has(文本(名称项)));
      if (缺少) return { ok: false, reason: `${成员名}缺少必需装备：${缺少}` };
      const 禁止 = (限制.禁止装备 || []).find(名称项 => 装备.has(文本(名称项)));
      if (禁止) return { ok: false, reason: `${成员名}装备了禁止物品：${禁止}` };
    }
    const 费用 = 限制.报名费用;
    const 持有人 = 文本(报名.持有人 || 成员[0]);
    if (费用 && !数据根?.char?.[持有人]) {
      return { ok: false, reason: `报名持有人档案不存在：${持有人}` };
    }
    if (费用 && 数值(数据根?.char?.[持有人]?.财富?.[费用.货币]) < 数值(费用.金额)) {
      return { ok: false, reason: `${费用.货币}不足` };
    }
    return {
      ok: true,
      项目名,
      持有人,
      报名费用: 费用 ? { 货币: 文本(费用.货币), 金额: Math.max(0, 数值(费用.金额)) } : null,
      参赛者: { 名称, 成员, 状态: '参赛' },
    };
  }

  function 计算模拟强度(赛事ID, 项目名, 参赛者ID, 项目 = {}) {
    const 限制 = 项目.参赛限制 || {};
    const 上限 = Math.max(1, 数值(限制.等级上限, 100));
    const 年龄上限 = Math.max(1, 数值(限制.年龄上限, 60));
    let 哈希 = 2166136261;
    for (const 字符 of `${赛事ID}|${项目名}|${参赛者ID}`) { 哈希 ^= 字符.charCodeAt(0); 哈希 = Math.imul(哈希, 16777619); }
    const 比例 = ((哈希 >>> 0) % 1000) / 1000;
    const 等级 = Math.max(1, Math.floor(上限 - Math.pow(比例, 2) * Math.max(1, 上限 * 0.35)));
    const 年龄 = Math.max(1, Math.floor(年龄上限 - Math.pow(比例, 2) * Math.max(1, 年龄上限 * 0.3)));
    return { 等级, 年龄, 强度: Math.max(1, Math.min(100, Math.round((等级 / 上限) * 100))), 来源: '模拟' };
  }

  function 蛇形分组(参赛者ID列表 = [], 分组数 = 1) {
    const 数量 = Math.max(1, Math.min(分组数, 参赛者ID列表.length));
    const 分组 = Array.from({ length: 数量 }, (_, index) => ({ 名称: String.fromCharCode(65 + index), 参赛者: [] }));
    参赛者ID列表.forEach((ID, index) => {
      const 位置 = index % (数量 * 2);
      分组[位置 < 数量 ? 位置 : 数量 * 2 - 1 - 位置].参赛者.push(ID);
    });
    return 分组;
  }

  function 圆桌对阵(列表 = []) {
    const 队列 = [...列表];
    if (队列.length % 2) 队列.push('');
    const 输出 = [];
    for (let 轮次 = 1; 轮次 < 队列.length; 轮次 += 1) {
      for (let index = 0; index < 队列.length / 2; index += 1) {
        const 左 = 队列[index];
        const 右 = 队列[队列.length - 1 - index];
        if (左 && 右) 输出.push({ 轮次, 参赛者: [左, 右] });
      }
      队列.splice(1, 0, 队列.pop());
    }
    return 输出;
  }

  function 下一二次幂(数量) {
    let 值 = 1;
    while (值 < 数量) 值 *= 2;
    return 值;
  }

  function 生成项目对局(赛事ID, 项目名, 项目, UID = () => '') {
    const IDs = 有效参赛者条目(项目).map(([ID]) => ID);
    if (IDs.length < 2) throw new Error(`${项目名}至少需要两名有效参赛者`);
    if (项目.流程 === '单场' && IDs.length !== 2) throw new Error(`${项目名}单场流程只能有两名参赛者`);
    const 分组数 = Math.max(1, Math.ceil(IDs.length / 5));
    const 对局 = [];
    if (项目.流程 === '单场') {
      对局.push({ 轮次: 1, 参赛者: IDs.slice(0, 2) });
    } else {
      const 分组 = 蛇形分组(IDs, 分组数);
      if (项目.流程 === '循环' || 项目.流程 === '循环后淘汰') {
        分组.forEach(组 => 圆桌对阵(组.参赛者).forEach(记录 => 对局.push({ ...记录, 分组: 组.名称 })));
      } else {
        const 容量 = 下一二次幂(IDs.length);
        const 席位 = [...IDs, ...Array(Math.max(0, 容量 - IDs.length)).fill('')];
        for (let index = 0; index < 席位.length / 2; index += 1) {
          const 左 = 席位[index];
          const 右 = 席位[席位.length - 1 - index];
          if (左 || 右) 对局.push({ 轮次: 1, 参赛者: [左, 右].filter(Boolean) });
        }
      }
    }
    const 结果 = {};
    对局.forEach(记录 => {
      结果[UID('match')] = {
        轮次: 记录.轮次,
        参赛者: 记录.参赛者,
        ...(记录.分组 ? { 分组: 记录.分组 } : {}),
      };
    });
    return 结果;
  }

  function 取对局结果(对局 = {}) {
    return 对象(对局.赛果) ? 对局.赛果 : null;
  }

  function 结算赛事对局(数据根 = {}, 上下文 = {}, 赛果 = {}) {
    const 赛事 = 数据根?.world?.赛事?.[上下文.赛事ID];
    const 进度 = 赛事?._进度?.[上下文.项目];
    const 对局 = 进度?.对局?.[上下文.对局ID];
    if (!赛事 || !进度 || !对局 || !上下文.结算ID) throw new Error('赛事结算上下文无效');
    if (对局.赛果) {
      if (对局.赛果.结算ID === 上下文.结算ID) return { changed: false, duplicate: true };
      if (对局.赛果.结果 !== '无效') throw new Error('赛事对局已经结算，禁止覆盖');
    }
    let 结果 = 文本(赛果.结果);
    if (![...(对局.参赛者 || []), '平局', '无效'].includes(结果)) throw new Error(`赛事赛果无效：${结果}`);
    // 淘汰赛不能平局：记为无效，对局重打（此前平局让双方都出局，晋级名单少人甚至直接判项目结束）。
    const 项目 = 赛事.项目?.[上下文.项目];
    if (结果 === '平局' && (项目?.流程 === '淘汰' || (项目?.流程 === '循环后淘汰' && 进度.当前环节 === '淘汰'))) 结果 = '无效';
    对局.赛果 = {
      结果,
      ...(Array.isArray(赛果.比分) ? { 比分: 赛果.比分.slice(0, 2).map(值 => Math.max(0, 数值(值))) } : {}),
      结算ID: 上下文.结算ID,
    };
    return { changed: true, duplicate: false, 赛事ID: 上下文.赛事ID, 项目: 上下文.项目, 对局ID: 上下文.对局ID };
  }

  function 对局已完成(对局 = {}) {
    return 对象(对局.赛果) && 对局.赛果.结果 !== '无效';
  }

  function 确定性模拟对局(赛事ID, 项目名, 对局ID, 左 = {}, 右 = {}) {
    const 左强度 = Math.max(1, 数值(左?.强度, 50));
    const 右强度 = Math.max(1, 数值(右?.强度, 50));
    let 哈希 = 2166136261;
    for (const 字符 of `${赛事ID}|${项目名}|${对局ID}`) { 哈希 ^= 字符.charCodeAt(0); 哈希 = Math.imul(哈希, 16777619); }
    const 随机 = (哈希 >>> 0) / 4294967296;
    const 左概率 = 左强度 / (左强度 + 右强度);
    return 随机 <= 左概率 ? { 结果: '左', 比分: [1, 0] } : { 结果: '右', 比分: [0, 1] };
  }

  function 生成循环积分表(赛事 = {}, 项目名 = '个人赛') {
    const 项目 = 取项目(赛事, 项目名);
    const 进度 = 赛事?._进度?.[项目名] || {};
    const 表 = {};
    const 参赛者ID = new Set(有效参赛者条目(项目).map(([ID]) => ID));
    Object.values(进度.对局 || {}).forEach(对局 => (对局.参赛者 || []).forEach(ID => { if (ID) 参赛者ID.add(ID); }));
    参赛者ID.forEach(ID => {
      const 公开记录 = 项目?.参赛者?.[ID];
      const 私有记录 = 进度?.实体?.[ID];
      表[ID] = {
        参赛者ID: ID,
        名称: 文本(私有记录?.名称 || 公开记录?.名称 || 进度?.实体代号?.[ID] || '待实体化参赛者'),
        场次: 0,
        胜: 0,
        平: 0,
        负: 0,
        积分: 0,
        净胜分: 0,
        分组: '',
      };
    });
    Object.values(进度.对局 || {}).forEach(对局 => {
      const 赛果 = 取对局结果(对局);
      if (!赛果 || 对局.参赛者?.length !== 2) return;
      const [左, 右] = 对局.参赛者;
      if (!表[左] || !表[右]) return;
      表[左].场次 += 1; 表[右].场次 += 1;
      表[左].分组 = 对局.分组 || ''; 表[右].分组 = 对局.分组 || '';
      const 比分 = Array.isArray(赛果.比分) ? 赛果.比分 : 赛果.结果 === '平局' ? [0, 0] : 赛果.结果 === 左 ? [1, 0] : [0, 1];
      表[左].净胜分 += 比分[0] - 比分[1]; 表[右].净胜分 += 比分[1] - 比分[0];
      if (赛果.结果 === '平局') { 表[左].平 += 1; 表[右].平 += 1; 表[左].积分 += 1; 表[右].积分 += 1; }
      else if (赛果.结果 === 左 || 赛果.结果 === 右) { 表[赛果.结果].胜 += 1; 表[赛果.结果 === 左 ? 右 : 左].负 += 1; 表[赛果.结果].积分 += 3; }
    });
    const 分组表 = {};
    Object.values(表).forEach(记录 => { (分组表[记录.分组 || 'A'] ||= []).push(记录); });
    Object.values(分组表).forEach(列表 => 列表.sort((a, b) => b.积分 - a.积分 || b.净胜分 - a.净胜分 || b.胜 - a.胜 || a.参赛者ID.localeCompare(b.参赛者ID)).forEach((记录, index) => { 记录.排名 = index + 1; }));
    return 分组表;
  }

  function 推进赛事状态(数据根 = {}, 赛事ID = '', UID = () => '') {
    const 赛事 = 数据根?.world?.赛事?.[赛事ID];
    if (!赛事 || 赛事.状态 !== '进行中') return { changed: false };
    const 进度表 = 赛事._进度 || {};
    let 完成数量 = 0;
    Object.entries(进度表).forEach(([项目名, 进度]) => {
      const 项目 = 赛事.项目?.[项目名];
      if (!项目 || 进度.状态 === '已完成') { if (项目) 完成数量 += 1; return; }
      const 对局条目 = Object.entries(进度.对局 || {});
      对局条目.forEach(([对局ID, 对局]) => {
        if (对局.参赛者?.length === 1 && !对局.赛果) 对局.赛果 = { 结果: 对局.参赛者[0], 结算ID: `bye:${赛事ID}:${项目名}:${对局ID}` };
      });
      if (!对局条目.length || !对局条目.every(([, 对局]) => 对局已完成(对局))) return;
      const 当前最大轮次 = Math.max(1, ...对局条目.map(([, 对局]) => 整数(对局.轮次, 1)));
      const 当前轮 = 对局条目.filter(([, 对局]) => 整数(对局.轮次, 1) === 当前最大轮次);
      if (项目.流程 === '循环后淘汰' && 进度.当前环节 === '循环') {
        const 晋级者 = Object.keys(生成循环积分表(赛事, 项目名)).sort((a, b) => a.localeCompare(b, 'zh-CN'))
          .flatMap(分组 => 生成循环积分表(赛事, 项目名)[分组].slice(0, 2).map(记录 => 记录.参赛者ID));
        if (晋级者.length < 2) throw new Error(`${项目名}循环阶段没有足够晋级者`);
        进度.当前环节 = '淘汰';
        进度.当前轮次 = 1;
        写入淘汰轮(进度, 晋级者, UID, 1);
        return;
      }
      if (项目.流程 === '淘汰' || (项目.流程 === '循环后淘汰' && 进度.当前环节 === '淘汰')) {
        const 胜者 = 当前轮.map(([, 对局]) => 对局.参赛者?.includes(对局.赛果?.结果) ? 对局.赛果.结果 : '').filter(Boolean);
        if (胜者.length > 1) {
          进度.当前轮次 = 当前最大轮次 + 1;
          写入淘汰轮(进度, 胜者, UID, 进度.当前轮次);
          return;
        }
      }
      进度.状态 = '已完成';
      进度.结束tick = 数值(数据根?.world?.时间?.tick);
      完成数量 += 1;
    });
    const 项目总数 = Object.keys(赛事.项目 || {}).length;
    if (项目总数 && 完成数量 >= 项目总数) {
      赛事.状态 = '已完成';
      return { changed: true, 赛事完成: true, 赛事ID };
    }
    return { changed: 完成数量 > 0, 赛事ID };
  }

  function 写入淘汰轮(进度 = {}, 参赛者ID列表 = [], UID = () => '', 轮次 = 1) {
    const 最大开始tick = Math.max(数值(进度.开始tick), ...Object.values(进度.对局 || {}).map(对局 => 数值(对局.开始tick)));
    const 间隔 = Math.max(1, Math.floor((数值(进度.结束tick) - 数值(进度.开始tick)) / Math.max(2, Object.keys(进度.对局 || {}).length + 1)));
    for (let index = 0; index < 参赛者ID列表.length; index += 2) {
      const ID = UID('match');
      const 开始tick = 最大开始tick + 间隔 * (Math.floor(index / 2) + 1);
      if (开始tick > 数值(进度.结束tick)) throw new Error('赛事剩余日程不足，无法生成下一轮');
      进度.对局[ID] = {
        轮次,
        参赛者: 参赛者ID列表.slice(index, index + 2),
        开始tick,
      };
    }
    进度.下一场tick = Math.min(...Object.values(进度.对局).filter(对局 => !对局.赛果).map(对局 => 数值(对局.开始tick, Number.MAX_SAFE_INTEGER)));
  }

  // ───────────── 团体赛对局赛制与排兵布阵（11-15 用户定）─────────────
  // 团体赛的一个对局按「对局赛制」拆成若干子场：
  //   团战：全体上场人员一场打完。
  //   擂台：一对一，负者下台、胜者留场接着打下一位，平局双方都下台；一方全部下台即结束。每胜一场记 1 小分。
  //   擂台团战积分：先打擂台，再打团战；团战分 = 上场人数 − 1（小分比团战分高 1 分）。
  //   单双团积分：三场一对一、两场二对二（各记 1 小分），再打团战；团战分 = 4。
  // 积分赛里领先超过团战分（只有小分全拿时）就不用打团战。总分高者胜对局，相同为平局。放弃剩余擂台：对方按己方
  // 还没下台的人数各得 1 小分（原文「唐门放弃剩余个人赛…明玉宗积七分」）。子场之间的伤、资源、状态由桥接层带入。
  const 对局赛制表 = Object.freeze(['团战', '擂台', '擂台团战积分', '单双团积分']);
  const 单双团席位 = Object.freeze([1, 1, 1, 2, 2]);
  const 战魂师系别 = Object.freeze(['强攻系', '敏攻系', '防御系', '召唤系']);
  const 看魂技系别 = Object.freeze(['控制系', '精神系', '元素系']);

  // 战魂师（用户「纯控魂师，辅助型精神系，元素系也不算战魂师」）：强攻、敏攻、防御、召唤系算；辅助、治疗、食物系不算；
  // 控制、精神、元素系看魂技组——攻击型魂技（含伤害结算）至少占三分之一才算。攻击型魂技数由调用方数好传入
  // （成员.攻击魂技数 / 成员.魂技数），没传的这三系按不算。
  function 是战魂师系别(系别 = '', 攻击魂技数 = 0, 魂技数 = 0) {
    const 值 = 文本(系别);
    if (战魂师系别.includes(值)) return true;
    if (!看魂技系别.includes(值)) return false;
    return 数值(魂技数) > 0 && 数值(攻击魂技数) * 3 >= 数值(魂技数);
  }

  function 种子随机(种子 = '') {
    let 状态 = 2166136261;
    for (const 字符 of 文本(种子)) { 状态 ^= 字符.charCodeAt(0); 状态 = Math.imul(状态, 16777619); }
    return () => {
      状态 = (状态 + 0x6D2B79F5) | 0;
      let t = Math.imul(状态 ^ (状态 >>> 15), 1 | 状态);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function 洗牌(列表 = [], 随机 = Math.random) {
    const 结果 = [...列表];
    for (let index = 结果.length - 1; index > 0; index -= 1) {
      const 交换 = Math.floor(随机() * (index + 1));
      [结果[index], 结果[交换]] = [结果[交换], 结果[index]];
    }
    return 结果;
  }

  function 读取项目对局赛制(项目 = {}) {
    return 对局赛制表.includes(文本(项目?.对局赛制)) ? 文本(项目.对局赛制) : '团战';
  }

  function 读取每队上场人数(项目 = {}) {
    return 整数(项目?.每队上场人数 ?? 7, 1, 7);
  }

  // 脚本随机排阵（用户「脚本随机先排」）：成员 [{名称, 等级, 系别, 攻击魂技数, 魂技数}]，等级未知按 0、同级随机。每段各自挑人
  // （用户「团体战上限7人，但是前面出场的不一定是团体战出场的」「要考虑系别平衡，比如7个强攻要弱于6强攻1辅助要弱于5强攻1控制1辅助。
  // 擂台肯定不能把辅助啥的非战魂师抽上去，除非没人」）：
  //   团战（上场人数，最多 7）：带上等级最高的一名辅助类（辅助、治疗、食物系）和一名控制系，其余按等级取战魂师，不够再按等级补。
  //   擂台（同样人数）：按等级取战魂师；不够才用其他人补，补上的排在出场顺序最后。
  //   单双团分场：三场一对一只上战魂师；两场二对二各配一名辅助类或控制系搭档，没有就两名战魂师。
  // 等级最高的战魂师落在第一场或最后一场的概率合计 50%（各 25%），其余 50% 均分给中间各场（只在战魂师能上的场次里算）。
  // 哪一段都没选上的是替补。
  function 生成随机排阵(成员 = [], 赛制 = '团战', 上场人数 = 7, 种子 = '') {
    const 随机 = 种子随机(种子);
    const 人数 = Math.max(1, Math.min(7, 整数(上场人数, 1, 7)));
    const 名单 = 洗牌((Array.isArray(成员) ? 成员 : []).map(记录 => (对象(记录) ? 记录 : { 名称: 记录 }))
      .map(记录 => ({ 名称: 文本(记录.名称), 等级: 数值(记录.等级, 0), 系别: 文本(记录.系别),
        战魂师: 是战魂师系别(记录.系别, 记录.攻击魂技数, 记录.魂技数) })).filter(记录 => 记录.名称), 随机)
      .sort((x, y) => y.等级 - x.等级);
    const 辅助类 = 记录 => ['辅助系', '治疗系', '食物系'].includes(记录.系别);
    const 控制位 = 记录 => 记录.系别 === '控制系';
    const 战魂师 = 名单.filter(记录 => 记录.战魂师);
    const 主将 = 战魂师.find(记录 => 记录.等级 > 0);
    // 按「场」分概率放主将：场次是若干组席位，落到某场再在场内随机挑席位；能放的场次由调用方给。
    const 放主将 = (场次 = [], 席位 = []) => {
      if (!主将 || !场次.length) return false;
      const 中间 = 场次.slice(1, -1);
      const 骰 = 随机();
      const 落场 = 场次.length === 1 ? 场次[0] : 骰 < 0.25 || (!中间.length && 骰 < 0.5) ? 场次[0]
        : 骰 < 0.5 || !中间.length ? 场次[场次.length - 1] : 中间[Math.floor(随机() * 中间.length)];
      席位[落场[Math.floor(随机() * 落场.length)]] = 主将.名称;
      return true;
    };

    // 团战阵容
    const 团战 = [];
    const 取 = 记录 => { if (记录 && !团战.includes(记录) && 团战.length < 人数) 团战.push(记录); };
    if (人数 >= 3) { 取(名单.find(辅助类)); 取(名单.find(控制位)); }
    战魂师.forEach(取);
    名单.forEach(取);
    const 结果 = { 上场: 团战.map(记录 => 记录.名称) };
    const 用到 = new Set(结果.上场);

    if (赛制 === '擂台' || 赛制 === '擂台团战积分') {
      const 选 = [...战魂师.slice(0, 人数)];
      名单.filter(记录 => !记录.战魂师).forEach(记录 => { if (选.length < 人数) 选.push(记录); });
      const 战段 = 选.filter(记录 => 记录.战魂师), 补段 = 洗牌(选.filter(记录 => !记录.战魂师), 随机);
      const 席位 = Array(战段.length).fill('');
      const 已放 = 战段.includes(主将) && 放主将(席位.map((_, index) => [index]), 席位);
      const 待排 = 洗牌(战段.filter(记录 => !已放 || 记录 !== 主将), 随机);
      for (let index = 0; index < 席位.length; index += 1) if (!席位[index]) 席位[index] = 待排.shift().名称;
      结果.顺序 = [...席位, ...补段.map(记录 => 记录.名称)];
      结果.顺序.forEach(名称 => 用到.add(名称));
    }

    if (赛制 === '单双团积分') {
      // 三场一对一 + 两组二对二的战魂师；搭档优先辅助类，其次控制系。
      const 搭档池 = [...名单.filter(辅助类), ...名单.filter(记录 => 控制位(记录) && !辅助类(记录))].filter(记录 => !记录.战魂师);
      const 搭档 = 搭档池.slice(0, 2);
      const 战位数 = 3 + (2 - 搭档.length) + 2;
      const 战选 = [...战魂师.slice(0, 战位数)];
      名单.filter(记录 => !战选.includes(记录) && !搭档.includes(记录)).forEach(记录 => { if (战选.length < 战位数) 战选.push(记录); });
      // 席位：0-2 一对一，3-4 第一组二对二，5-6 第二组；每组二对二的第二个席位留给搭档。
      const 席位 = Array(7).fill('');
      搭档.forEach((记录, 序) => { 席位[序 === 0 ? 4 : 6] = 记录.名称; });
      const 战席 = [0, 1, 2, 3, 5, ...(搭档.length < 2 ? [6] : []), ...(搭档.length < 1 ? [4] : [])];
      const 场次 = [[0], [1], [2], 战席.filter(位 => 位 === 3 || 位 === 4), 战席.filter(位 => 位 === 5 || 位 === 6)].filter(组 => 组.length);
      const 已放 = 战选.includes(主将) && 放主将(场次, 席位);
      const 待排 = 洗牌(战选.filter(记录 => !已放 || 记录 !== 主将), 随机);
      战席.forEach(位 => { if (!席位[位] && 待排.length) 席位[位] = 待排.shift().名称; });
      let 游标 = 0;
      结果.分场 = 单双团席位.map(数 => { const 组 = 席位.slice(游标, 游标 + 数).filter(Boolean); 游标 += 数; return 组; });
      结果.分场.flat().forEach(名称 => 用到.add(名称));
    }
    结果.替补 = 名单.map(记录 => 记录.名称).filter(名称 => !用到.has(名称));
    return 结果;
  }

  // 对局开打时写入 对局.赛程：两边的排阵按 对局.参赛者 的左右顺序给。
  function 初始化对局赛程(对局 = {}, 项目 = {}, 左排阵 = {}, 右排阵 = {}) {
    const 赛制 = 读取项目对局赛制(项目);
    const 上场人数 = 读取每队上场人数(项目);
    const 团战分 = 赛制 === '擂台团战积分' ? Math.max(1, 上场人数 - 1) : 赛制 === '单双团积分' ? 单双团席位.length - 1 : 0;
    对局.赛程 = {
      赛制, 阶段: 赛制 === '团战' ? '团战' : 赛制 === '单双团积分' ? '分场' : '擂台',
      排阵: [克隆(左排阵, {}), 克隆(右排阵, {})], 小分: [0, 0], 团战分, 子场: [],
      ...(赛制 === '擂台' || 赛制 === '擂台团战积分' ? { 擂台位: [0, 0] } : {}),
      ...(赛制 === '单双团积分' ? { 分场位: 0 } : {}),
    };
    return 对局.赛程;
  }

  // 下一个子场：{ 序号, 类型: '一对一'|'二对二'|'团战', 左: [名称], 右: [名称] }；对局已结束返回 null。
  function 读取下一子场(对局 = {}) {
    const 赛程 = 对局?.赛程;
    if (!对象(赛程) || 赛程.阶段 === '结束') return null;
    const [左阵, 右阵] = 赛程.排阵 || [{}, {}];
    const 序号 = (赛程.子场 || []).length;
    if (赛程.阶段 === '擂台') {
      const [左位, 右位] = 赛程.擂台位;
      return { 序号, 类型: '一对一', 左: [左阵.顺序?.[左位]].filter(Boolean), 右: [右阵.顺序?.[右位]].filter(Boolean) };
    }
    if (赛程.阶段 === '分场') {
      const 位 = 赛程.分场位;
      return { 序号, 类型: 单双团席位[位] === 2 ? '二对二' : '一对一', 左: [...(左阵.分场?.[位] || [])], 右: [...(右阵.分场?.[位] || [])] };
    }
    return { 序号, 类型: '团战', 左: [...(左阵.上场 || [])], 右: [...(右阵.上场 || [])] };
  }

  function 小分阶段结束(赛程 = {}) {
    if (!赛程.团战分 || Math.abs(赛程.小分[0] - 赛程.小分[1]) > 赛程.团战分) { 赛程.阶段 = '结束'; return; }
    赛程.阶段 = '团战';
  }

  // 记一个子场的结果（'左' | '右' | '平局'），推进赛程。返回 { 结束, 结果?: '左'|'右'|'平局', 比分? }。
  function 记录子场结果(对局 = {}, 结果 = '', 结算ID = '') {
    const 赛程 = 对局?.赛程;
    const 子场 = 读取下一子场(对局);
    if (!子场) throw new Error('对局赛程已结束或未初始化');
    if (!['左', '右', '平局'].includes(结果)) throw new Error(`子场结果无效：${结果}`);
    const 胜方 = 结果 === '左' ? 0 : 结果 === '右' ? 1 : -1;
    赛程.子场.push({ ...子场, 结果, ...(结算ID ? { 结算ID } : {}) });
    if (赛程.阶段 === '擂台') {
      if (胜方 >= 0) 赛程.小分[胜方] += 1;
      if (胜方 !== 0) 赛程.擂台位[0] += 1;
      if (胜方 !== 1) 赛程.擂台位[1] += 1;
      const 剩余 = [0, 1].map(方 => Math.max(0, (赛程.排阵[方]?.顺序 || []).length - 赛程.擂台位[方]));
      if (剩余.some(数 => 数 === 0)) {
        if (赛程.赛制 === '擂台') 赛程.阶段 = '结束';
        else 小分阶段结束(赛程);
      }
    } else if (赛程.阶段 === '分场') {
      if (胜方 >= 0) 赛程.小分[胜方] += 1;
      赛程.分场位 += 1;
      while (赛程.分场位 < 单双团席位.length) {
        const 下一 = 读取下一子场(对局);
        // 一方凑不齐这一场的人：判对方赢这一场。
        if (下一.左.length && 下一.右.length) break;
        const 判给 = 下一.左.length ? 0 : 下一.右.length ? 1 : -1;
        if (判给 >= 0) 赛程.小分[判给] += 1;
        赛程.子场.push({ ...下一, 结果: 判给 === 0 ? '左' : 判给 === 1 ? '右' : '平局', 缺席: true });
        赛程.分场位 += 1;
      }
      if (赛程.分场位 >= 单双团席位.length) 小分阶段结束(赛程);
    } else {
      if (胜方 >= 0) 赛程.小分[胜方] += 赛程.团战分 || 1;
      赛程.阶段 = '结束';
    }
    return 赛程结束结果(对局);
  }

  // 放弃剩余擂台（'左' | '右' 放弃）：对方按放弃方还没下台的人数各得 1 小分，然后进团战或结束。
  function 放弃剩余擂台(对局 = {}, 放弃方 = '') {
    const 赛程 = 对局?.赛程;
    if (!对象(赛程) || 赛程.阶段 !== '擂台') throw new Error('当前不在擂台阶段');
    const 方 = 放弃方 === '左' ? 0 : 放弃方 === '右' ? 1 : -1;
    if (方 < 0) throw new Error('放弃方无效');
    const 剩余 = Math.max(0, (赛程.排阵[方]?.顺序 || []).length - 赛程.擂台位[方]);
    赛程.小分[1 - 方] += 剩余;
    赛程.擂台位[方] += 剩余;
    赛程.放弃 = 放弃方;
    if (赛程.赛制 === '擂台') 赛程.阶段 = '结束';
    else 小分阶段结束(赛程);
    return 赛程结束结果(对局);
  }

  function 赛程结束结果(对局 = {}) {
    const 赛程 = 对局?.赛程;
    if (!对象(赛程) || 赛程.阶段 !== '结束') return { 结束: false };
    let 结果 = 赛程.小分[0] > 赛程.小分[1] ? '左' : 赛程.小分[0] < 赛程.小分[1] ? '右' : '平局';
    // 只打擂台：一方全部下台才结束，留在场上的一方胜。
    if (赛程.赛制 === '擂台') {
      const 剩余 = [0, 1].map(方 => Math.max(0, (赛程.排阵[方]?.顺序 || []).length - 赛程.擂台位[方]));
      结果 = 剩余[0] > 剩余[1] ? '左' : 剩余[0] < 剩余[1] ? '右' : '平局';
    }
    return { 结束: true, 结果, 比分: [...赛程.小分] };
  }

  const 接口 = Object.freeze({
    常量: Object.freeze({ 每日tick, 每月tick, 每年tick, 周期tick表, 权限类型表, 赛事状态表, 项目名表, 流程表 }),
    解析时长tick, 解析重置周期, 解析重置周期tick, 解析中文数字, 解析使用次数, 唯一引用, 整理特殊权限, 列出持有人权限,
    计算购买支付比例, 生成物品选择候选, 计算委托奖励倍率, 消费特殊权限,
    收集角色装备名称, 校验赛事报名, 有效参赛者条目, 计算模拟强度, 蛇形分组, 圆桌对阵,
    生成项目对局, 取对局结果, 结算赛事对局, 对局已完成, 确定性模拟对局, 生成循环积分表, 推进赛事状态, 克隆,
    对局赛制表, 是战魂师系别, 读取项目对局赛制, 读取每队上场人数, 生成随机排阵, 初始化对局赛程, 读取下一子场, 记录子场结果,
    放弃剩余擂台, 赛程结束结果,
  });
  globalThis.__LWCS_COMPETITION_PRIVILEGE_RUNTIME__ = 接口;
  try { if (globalThis.parent && globalThis.parent !== globalThis) globalThis.parent.__LWCS_COMPETITION_PRIVILEGE_RUNTIME__ = 接口; } catch (错误) {}
  try { if (globalThis.top && globalThis.top !== globalThis) globalThis.top.__LWCS_COMPETITION_PRIVILEGE_RUNTIME__ = 接口; } catch (错误) {}
})();

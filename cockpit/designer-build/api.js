  // 说明：本段手写。原版设计台的保存链是「designerDraft → 拼 HTML → 挂载时同步若干控件 → 从 DOM 回读 →
  // buildSkillDesignerUpdatedSkill」。这里用「虚拟控件树」逐函数复刻那条 HTML/DOM 链：
  //   描述* 系列 ≙ 构建技能设计台*（原版 HTML 生成器），产出控件描述而非 HTML；
  //   同步* 系列 ≙ onMount 里的 syncScalingField / 同步原型行默认驱动判定 / syncConditionRow 等；
  //   读取* 系列 ≙ readSkillDesignerFormState / 读取技能设计台原型效果状态（DOM 回读）。
  // 控件值一律保存「DOM 里 input.value 会读到的字符串」，下拉值遵循浏览器 <select> 的选中规则。

  // ───────────── 0. 根数据与快照 ─────────────
  let 设计台根数据 = null;
  function readLatestMvuDataByEditor() {
    // 原版从 MVU 宿主读取最新变量；独立页面里改为返回当前注入的根数据
    return 设计台根数据 || null;
  }
  function 设计台取根(root, meta) {
    if (root && typeof root === 'object') return root;
    if (meta && meta.root && typeof meta.root === 'object') return meta.root;
    if (设计台根数据) return 设计台根数据;
    if (typeof window !== 'undefined' && window.LWCS_SAVE) return window.LWCS_SAVE;
    return {};
  }
  function 设计台规范元数据(meta = {}) {
    // 去掉便捷参数 root，其余原样作为 previewMeta 传给原版函数
    const { root, ...rest } = meta && typeof meta === 'object' ? meta : {};
    void root;
    return { path: Array.isArray(rest.path) ? rest.path : [], label: toText(rest.label, '技能'), category: toText(rest.category, '技能'), scope: toText(rest.scope, '魂技'), ...rest };
  }
  // 建立原版依赖的 liveSnapshot：rootData + 当前角色（取 previewMeta.path[1]，否则玩家名）
  function 设计台使用快照(root, meta) {
    const 根 = 设计台取根(root, meta);
    设计台根数据 = 根;
    const 路径 = Array.isArray(meta && meta.path) ? meta.path : [];
    const 玩家 = toText(deepGet(根, 'sys.玩家名', ''), '');
    const 角色名 = 路径[0] === 'char' && 根 && 根.char && 根.char[路径[1]] ? 路径[1] : 玩家;
    const 快照 = { rootData: 根, activeName: 角色名, activeChar: (根 && 根.char && 根.char[角色名]) || {} };
    liveSnapshot = 快照;
    lastRenderableSnapshot = 快照;
    return 快照;
  }

  // ───────────── 1. HTML 往返等价 ─────────────
  // 原版把值写进 HTML 属性/文本再由浏览器解析，这里按同样的转义 + 解码计算出 DOM 中的值
  function 解码实体(文本) {
    return String(文本).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|#39);/gi, (m, e) => {
      const k = e.toLowerCase();
      if (k === 'amp') return '&'; if (k === 'lt') return '<'; if (k === 'gt') return '>'; if (k === 'quot') return '"'; if (k === '#39') return "'";
      return String.fromCodePoint(k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
    });
  }
  const 属性回读 = 值 => 解码实体(escapeHtmlAttr(值));
  const 文本回读 = 值 => 解码实体(htmlEscape(值));
  // <input type="number"> 的取值净化：非合法浮点数文本读出为空串（浏览器行为）
  const 数字输入回读 = 值 => {
    const 文本 = 属性回读(值);
    return /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(文本) ? 文本 : '';
  };
  const 数字净化 = 文本 => (/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(String(文本)) ? String(文本) : '');
  // <textarea> 解析会吃掉开头一个换行
  const 文本域回读 = 值 => 文本回读(值).replace(/^\n/, '');

  // ───────────── 2. 下拉 ≙ buildSkillDesignerSelectOptions ─────────────
  function 设计台下拉(选项列表 = [], 当前值 = '', 空状态文本 = '') {
    const 规范条目列表 = normalizeSkillDesignerOptionEntries(选项列表);
    const 规范选项列表 = normalizeSkillDesignerOptionList(选项列表);
    const 不允许空值 = 规范选项列表.length > 0 && 规范选项列表.every(选项 => 选项.value !== '无');
    if (!规范选项列表.length) {
      const 空文本 =
        normalizeSkillUiText(空状态文本, '') && !/未设置/.test(normalizeSkillUiText(空状态文本, ''))
          ? normalizeSkillUiText(空状态文本, '')
          : '暂无可选';
      return { options: [{ value: '', label: 空文本, disabled: true }], value: '', empty: true };
    }
    const 输出选项列表 = [];
    const 输出条目列表 = [];
    const 已见 = new Set();
    const 加入选项 = 选项 => {
      if (已见.has(选项.value)) return;
      已见.add(选项.value);
      输出选项列表.push(选项);
      return 选项;
    };
    规范条目列表.forEach(条目 => {
      if (条目.type === 'group') {
        const 组选项 = 条目.options.map(加入选项).filter(Boolean);
        if (组选项.length) 输出条目列表.push({ ...条目, options: 组选项 });
        return;
      }
      const 选项 = 加入选项(条目);
      if (选项) 输出条目列表.push({ type: 'option', ...选项 });
    });
    const 当前文本 = toText(当前值, '').trim();
    const 选中值 = 输出选项列表.some(选项 => 选项.value === 当前文本)
      ? toText(当前值, '').trim()
      : 不允许空值 && 当前文本 === '无'
        ? 输出选项列表[0].value
        : 输出选项列表[0].value;
    const options = [];
    const 推入 = (选项, 分组) => {
      const 安全值 = toText(选项.value, '');
      const 项 = { value: 属性回读(安全值), label: 文本回读(toText(选项.label, 安全值)) };
      if (分组) 项.group = 分组;
      项.__selected = 安全值 === 选中值;
      options.push(项);
    };
    输出条目列表.forEach(条目 => {
      if (条目.type !== 'group') 推入(条目);
      else 条目.options.forEach(选项 => 推入(选项, 条目.label));
    });
    return 下拉收口({ options });
  }
  // 依 <select> 规则求当前值：有 selected 取最后一个，否则首个非 disabled 选项
  function 下拉收口(下拉) {
    const 选中 = 下拉.options.filter(项 => 项.__selected);
    let value = '';
    if (选中.length) value = 选中[选中.length - 1].value;
    else { const 首个 = 下拉.options.find(项 => !项.disabled); value = 首个 ? 首个.value : ''; }
    下拉.options.forEach(项 => { delete 项.__selected; });
    下拉.value = value;
    return 下拉;
  }
  // 给 select 控件赋值：浏览器里赋不存在的值会变为未选中（value 读出空串）
  function 设控件值(控件, 值) {
    if (!控件) return;
    const 文本 = String(值 == null ? '' : 值);
    if (控件.kind === 'select') 控件.value = 控件.options.some(项 => 项.value === 文本) ? 文本 : '';
    else if (控件.kind === 'number') 控件.value = 数字净化(文本);
    else 控件.value = 文本;
  }
  // 选项说明：原版在标签里用「值｜说明」的，拆出 hint；状态施加的状态取原版一句话说明
  function 补选项说明(控件, 原型 = '', 字段 = '') {
    if (!控件 || !Array.isArray(控件.options)) return 控件;
    控件.options.forEach(项 => {
      const 分隔 = String(项.label || '').indexOf('｜');
      if (分隔 > 0) 项.hint = 项.label.slice(分隔 + 1);
      if (字段 === '状态' && ['状态施加', '状态移除', '状态转移', '状态交换', '__条件'].includes(原型) && 项.value) {
        const 说明 = 技能设计台状态一句话说明(项.value);
        if (说明) 项.hint = 说明;
      }
    });
    return 控件;
  }

  // ───────────── 3. 原型行 ≙ 构建技能设计台原型效果行列表 / 字段编辑器 / 字段输入 ─────────────
  const 设计台驱动例外原型 = ['机制授予', '时光回溯', '位移执行', '复制执行'];
  function 设计台原型下拉(当前原型 = '') {
    // ≙ 构建技能设计台原型选项：分「战斗内 / 战斗外」两组，组标题是 disabled 选项
    const 当前值 = normalizeSkillUiText(当前原型, '');
    const options = [];
    [
      ['战斗内', 读取技能设计台原型名称列表().filter(原型名 => 读取技能设计台原型摘要(原型名).类别 !== '战斗外')],
      ['战斗外', 读取技能设计台原型名称列表().filter(原型名 => 读取技能设计台原型摘要(原型名).类别 === '战斗外')],
    ].forEach(([标题, 列表]) => {
      if (!列表.length) return;
      options.push({ value: '', label: `── ${标题} ──`, disabled: true, header: true, group: 标题 });
      列表.forEach(原型名 => {
        const 摘要 = 读取技能设计台原型摘要(原型名);
        options.push({ value: 原型名, label: `${原型名}｜${摘要.描述 || 原型名}`, hint: 摘要.描述 || '', group: 标题, category: 摘要.类别, direction: 摘要.方向, __selected: 原型名 === 当前值 });
      });
    });
    return 下拉收口({ kind: 'select', options });
  }
  function 设计台原型字段标签(原型 = '', 字段 = '', 显示名 = '', effect = {}) {
    // ≙ 构建技能设计台原型字段标签：返回 { label, hint }
    const 提示 = 获取技能设计台原型字段提示(原型, 字段, effect);
    const 原型名 = normalizeSkillUiText(原型, '');
    const 字段名 = normalizeSkillUiText(字段, '');
    const 基础标签 = 原型名 === '炸环' && 字段名 === '强化倍率'
      ? '强化倍率 × 年限'
      : 原型名 === '状态施加' && ['数值', '副数值'].includes(字段名)
        ? 技能设计台状态施加字段显示名(effect && effect['状态'], 字段名)
        : 显示名 || 字段;
    return { label: 文本回读(基础标签), hint: 提示 ? 属性回读(提示) : '' };
  }
  function 描述tick输入(标签 = {}, 字段名 = '', value = 0, options = {}) {
    // ≙ 构建技能设计台tick时长输入：日/时/分三格 + 隐藏 tick
    const 最小tick = Math.max(0, parseSkillDesignerIntegerInputValue(options.最小tick, 0, 0));
    const 最大tick = Number.isFinite(Number(options.最大tick)) ? Math.max(最小tick, Math.round(Number(options.最大tick))) : 0;
    const 时长 = 拆分技能设计台tick时长(value, { 最小tick, 最大tick, 默认tick: options.默认tick ?? 最小tick });
    return {
      kind: 'tick', key: 字段名, field: true, ...标签,
      value: 属性回读(时长.tick), tick: 时长.tick,
      parts: { 日: 时长.日, 时: 时长.小时, 分: 时长.分钟 },
      partLimits: { 日: { min: 0, max: 最大tick > 0 ? Math.floor((最大tick * 技能设计台每tick分钟) / 1440) : undefined, step: 1 }, 时: { min: 0, max: 23, step: 1 }, 分: { min: 0, max: 59, step: 10 } },
      minTick: 最小tick, maxTick: 最大tick,
    };
  }
  function 描述原型字段输入(原型 = '', key = '', value = '', fallbackTarget = '单体', options = {}) {
    const 定义 = 读取技能设计台原型字段定义(原型, key, options);
    const 类型 = normalizeSkillUiText(定义['类型'], '文本');
    const 选项 = 读取技能设计台原型字段选项(原型, key, options);
    const 嵌套字段 = normalizeSkillUiText(options && options.嵌套字段, '');
    const effect = options && options.当前效果 && typeof options.当前效果 === 'object' ? options.当前效果 : { ...(options || {}), [key]: value };
    const 时窗字段显示名 = 原型 === '时窗修正'
      ? ({
          调整字段: '调整对象',
          调整方式: '方向',
          调整回合: '回合数',
          调整tick: '时长',
          调整次数: effect['调整字段'] === '触发次数' ? '触发次数' : effect['调整字段'] === '使用次数' ? '使用次数' : '次数',
          结算倍率: '压缩结算',
        }[key] || '')
      : '';
    const 显示字段名 = 时窗字段显示名 || (key === '防御穿透'
      ? '伤害内联穿透%'
      : 原型 === '规则改写' && key === '数值' && normalizeSkillUiText(effect && effect['规则'], '') === '死亡转存活'
        ? '复活恢复比例'
      : 原型 === '战斗外复活' && key === '数值'
        ? '复活恢复比例'
      : key === '资源转移方式'
        ? '转移模式'
      : 原型 === '状态移除' && key === '状态'
        ? '移除状态'
      : 原型 === '状态移除' && key === '匹配原型'
        ? '内部效果'
      : 原型 === '状态移除' && key === '数值方向'
        ? '方向'
      : key === '目标' && 原型 === '机制授予'
        ? '授予对象'
        : key === '目标' && 嵌套字段 === '授予效果'
            ? '作用目标'
              : key === '目标' && 嵌套字段 === '结算效果'
                ? '结算目标'
                : key);
    const 标签 = 设计台原型字段标签(原型, key, 显示字段名, effect);
    const 公共 = { key, field: true, ...标签, type: 类型, default: 定义['默认值'] };
    if (key === '条件分支' && options && options.禁用条件分支) return null;
    if (key === '条件分支') return 描述条件分支编辑器(原型, value, fallbackTarget, 标签.hint);
    if (类型 === '原型列表') return 描述嵌套原型列表编辑器(key, value, fallbackTarget, 标签.hint);
    if (原型 === '机制抹消' && key === '抹消对象') {
      const 对象 = 规范化技能设计台机制抹消对象(value);
      return { ...公共, kind: 'object', value: 对象, json: JSON.stringify(对象), subfields: 描述机制抹消对象字段(对象) };
    }
    const 是必填 = key === '目标' || key === '生效方式' || 技能设计台原型字段是否必填(原型, key);
    const 禁用空值 = Boolean(options && options.禁用空值);
    if (原型 === '炸环' && key === '目标') return { ...公共, kind: 'static', value: '自身', display: '自身', required: true };
    if (key === '生效方式' && options && options.强制独立) return { key, field: true, kind: 'hidden', value: '独立生效', label: '', hint: '', hidden: true };
    if (key === '生效方式' && options && options.固定生效方式) {
      const 固定值 = normalizeSkillUiText(options.固定生效方式, '独立生效');
      return { ...公共, kind: 'static', value: 属性回读(固定值), display: 文本回读(固定值), required: true };
    }
    if (类型 === '枚举') {
      const 可用选项 =
        key === '目标'
          ? 读取技能设计台目标候选(原型, { ...options, 当前效果: options?.当前效果 || { ...(options || {}), [key]: value } })
          : 选项;
      if (!可用选项.length) return null;
      const 下拉选项 = 构建技能设计台原型字段下拉选项(key, 可用选项, 是必填 || 禁用空值);
      const 渲染选项 = 原型 === '状态施加' && key === '状态'
        ? 构建技能设计台状态施加分组选项(normalizeSkillDesignerOptionList(下拉选项).map(item => item.value))
        : 下拉选项;
      const 首个合法值 = Array.isArray(可用选项[0]?.options) ? 可用选项[0].options[0] : 可用选项[0];
      const 当前值 =
        value ||
        (key === '生效方式' && options && options.默认生效方式 ? options.默认生效方式 : '') ||
        ((是必填 || 禁用空值) ? 首个合法值 : '无') ||
        '';
      const 控件 = { ...公共, kind: 'select', required: !!(是必填 || 禁用空值), ...设计台下拉(渲染选项, 当前值) };
      补选项说明(控件, 原型, key);
      if (原型 === '状态施加' && key === '状态') 控件.summary = 技能设计台状态摘要({ ...(options?.当前效果 || {}), 状态: 当前值 });
      if (原型 === '位移执行' && key === '位移类型') 控件.summary = 技能设计台位移执行摘要({ ...(options?.当前效果 || {}), 位移类型: 当前值 });
      return 控件;
    }
    if (类型 === '多枚举') {
      const 可选项 = key === '限定元素' ? SKILL_LIMITED_ELEMENT_OPTIONS : 选项;
      const selected = 读取技能设计台多枚举值(value).filter(item => 可选项.includes(item));
      return {
        ...公共, kind: 'multi', multiple: true,
        options: 可选项.map(option => ({ value: 属性回读(option), label: 文本回读(option) })),
        selected: selected.map(item => 属性回读(item)),
        value: 属性回读(selected.join('|')),
        summary: selected.length ? selected.join('、') : '默认无',
        wide: key === '限定元素',
      };
    }
    if (原型 === '时窗修正' && key === '调整tick') {
      return { ...描述tick输入(标签, '调整tick', value || 6, { 最小tick: 1, 最大tick: 技能设计台时窗最大调整tick, 默认tick: 6 }), type: 类型, default: 定义['默认值'] };
    }
    if (类型 === '数字' || 类型 === '整数') {
      if (技能设计台字段是tick时长(key)) return { ...描述tick输入(标签, key, value, { 最小tick: 0, 默认tick: 0 }), type: 类型, default: 定义['默认值'] };
      const 最大值 = 定义['最大值'] !== undefined ? String(定义['最大值']) : key === '防御穿透' ? '100' : undefined;
      const 最小值 = 定义['最小值'] !== undefined ? String(定义['最小值']) : '0';
      return {
        ...公共, kind: 'number',
        min: 最小值, max: 最大值, step: 类型 === '整数' || key === '防御穿透' ? '1' : '0.01',
        value: 数字输入回读(value), placeholder: '留空 = 无',
        wide: 原型 === '时窗修正' && key === '延迟回合',
      };
    }
    if (类型 === '带符号数值') {
      const 结算 = normalizeSkillUiText(
        options && options.当前效果 && options.当前效果['结算'] !== undefined ? options.当前效果['结算'] : options && options['结算'],
        '',
      );
      const 状态名 = normalizeSkillUiText(
        options && options.当前效果 && options.当前效果['状态'] !== undefined ? options.当前效果['状态'] : options && options['状态'],
        '',
      );
      const 只允许正向强度 = normalizeSkillUiText(原型, '') === '状态施加' && key === '数值' && 技能设计台状态施加使用正向强度数值(状态名);
      const 允许结算绝对值 = normalizeSkillUiText(原型, '') === '结算修正' && ['消耗', '前摇'].includes(结算) && key === '数值';
      const 必须百分比修正 =
        (['判定修正', '结算修正', '位移执行', '决策干扰'].includes(normalizeSkillUiText(原型, '')) && key === '数值') &&
        !允许结算绝对值;
      const pattern = 只允许正向强度
        ? '\\+?[0-9]+(\\.[0-9]+)?%?'
        : 必须百分比修正
        ? '(?:\\+|-)?[0-9]+(\\.[0-9]+)?%'
        : '(?:\\+|-)?[0-9]+(\\.[0-9]+)?%?|x[0-9]+(\\.[0-9]+)?';
      const 占位文本 = 允许结算绝对值
        ? (结算 === '前摇' ? '+20% / -20% / +2 / -2' : '+20% / -20% / +500 / -500')
        : 只允许正向强度 ? '例如 10%'
        : normalizeSkillUiText(原型, '') === '决策干扰' && key === '数值' ? '例如 20%，越高干扰越强'
          : 必须百分比修正 ? '例如 +12%' : '留空 = 无';
      const 数值单位口径 = 读取技能设计台数值字段口径(原型, key, effect);
      if (技能设计台数值字段使用单位下拉(原型, key, effect)) {
        const 当前单位 = 数值单位口径 === '混合' ? 读取技能设计台数值单位(value) : 数值单位口径;
        const 当前值 = 数值单位口径 === '百分比'
          ? 格式化技能设计台百分比字段值(value, '')
          : 格式化技能设计台单位数值(value, 当前单位);
        const 单位禁用 = 数值单位口径 !== '混合';
        // 单位下拉 ≙ 构建技能设计台数值单位下拉：当前单位若非「点数/百分比」则浏览器默认选首项「点数」
        const 单位值 = ['点数', '百分比'].includes(当前单位) ? 当前单位 : '点数';
        return {
          ...公共, kind: 数值单位口径 === '百分比' ? 'percent' : 'signed',
          value: 属性回读(当前值), pattern, placeholder: 占位文本, positiveOnly: 只允许正向强度,
          unit: { value: 单位值, locked: 单位禁用, options: [{ value: '点数', label: '点数' }, { value: '百分比', label: '百分比' }], basis: 数值单位口径 },
        };
      }
      return { ...公共, kind: 'signed', value: 属性回读(value), pattern, placeholder: 占位文本, positiveOnly: 只允许正向强度 };
    }
    if (类型 === '布尔') {
      const 已启用 = value === true || normalizeSkillUiText(value, '') === 'true' || normalizeSkillUiText(value, '') === '启用';
      return { ...公共, kind: 'bool', value: 已启用 };
    }
    if (类型 === '对象') return null;
    return { ...公共, kind: 'text', value: 属性回读(value), placeholder: '留空 = 无' };
  }
  function 描述机制抹消对象字段(对象 = {}) {
    // ≙ 构建技能设计台机制抹消对象字段控件 + 「原型」下拉
    const 匹配器 = 规范化技能设计台机制抹消对象(对象);
    const 原型 = normalizeSkillUiText(匹配器['原型'], '机制授予');
    const 原型下拉 = 设计台下拉(构建技能设计台原型字段下拉选项('原型', 技能设计台机制抹消对象原型选项, true), 对象['原型']);
    const 字段列表 = [{ key: '原型', kind: 'select', label: '原型', hint: '', ...原型下拉 }];
    读取技能设计台机制抹消可匹配字段(原型).forEach(字段 => {
      const 选项 = 读取技能设计台机制抹消对象字段选项(原型, 字段);
      const 值列表 = Array.isArray(匹配器[字段])
        ? 匹配器[字段].map(item => normalizeSkillUiText(item, '')).filter(Boolean)
        : [normalizeSkillUiText(匹配器[字段], '')].filter(Boolean);
      if (选项.length) {
        const 全部标签 = 读取技能设计台机制抹消全部标签(字段);
        const 全部选中 = !值列表.length;
        const options = [{ value: 属性回读(全部标签), label: 文本回读(全部标签), all: true, selected: 全部选中 }];
        normalizeSkillDesignerOptionList(选项).forEach(option => {
          const v = normalizeSkillUiText(option.value, '');
          options.push({ value: 属性回读(v), label: 文本回读(option.label || v), selected: 值列表.includes(v) });
        });
        字段列表.push({ key: 字段, kind: 'multi', multiple: true, label: 文本回读(字段), hint: '', options, selected: options.filter(o => o.selected).map(o => o.value), allLabel: 全部标签 });
      } else {
        字段列表.push({ key: 字段, kind: 'text', label: 文本回读(字段), hint: '', value: 属性回读(格式化技能设计台机制抹消字段值(匹配器[字段])), placeholder: '留空 = 无' });
      }
    });
    return 字段列表;
  }
  function 描述驱动判定属性编辑器(effect = {}) {
    // ≙ 构建技能设计台驱动判定属性编辑器
    const 原型 = normalizeSkillUiText(effect && effect['原型'], '');
    const 目标 = normalizeSkillUiText(effect && effect['目标'], '');
    if (原型 === '伤害结算' || (目标 === '自身' && !设计台驱动例外原型.includes(原型)) || !技能设计台原型需要默认驱动判定(原型, effect)) {
      return {
        kind: 'scaling', hidden: true, rendered: 'hidden',
        controls: [
          { key: '驱动属性', field: true, kind: 'hidden', value: '无', scalingDriver: true, label: '', hint: '' },
          { key: '影响方向', field: true, kind: 'hidden', value: '无', label: '', hint: '' },
        ],
      };
    }
    const 驱动属性 = String((effect && effect['驱动属性']) ?? '无').trim() || '无';
    const 有驱动 = 驱动属性 && 驱动属性 !== '无';
    const 方向原始选项 = 读取技能设计台原型字段选项(原型, '影响方向', { 当前效果: effect });
    const 首个合法方向 = 选择技能设计台默认影响方向(原型, effect, '效果强度');
    const 方向值 = normalizeSkillUiText(effect && effect['影响方向'], 首个合法方向);
    const 方向列表 = 读取技能设计台影响方向选项值(原型, effect);
    const 影响方向 = 有驱动 ? (方向列表.includes(方向值) ? 方向值 : 首个合法方向) : '无';
    const 驱动选项 = 构建技能设计台原型字段下拉选项('驱动属性', 读取技能设计台原型字段选项(原型, '驱动属性'), 有驱动);
    const 驱动标签 = 设计台原型字段标签(原型, '驱动属性', '驱动/判定属性');
    if (原型 === '状态移除') {
      return {
        kind: 'scaling', hidden: false, rendered: 'remove',
        controls: [
          补选项说明({ key: '驱动属性', field: true, kind: 'select', scalingDriver: true, ...驱动标签, ...设计台下拉(驱动选项, 有驱动 ? 驱动属性 : 选择技能设计台默认驱动属性(原型, effect)) }),
          { key: '影响方向', field: true, kind: 'hidden', value: '成功率', label: '', hint: '' },
        ],
      };
    }
    const 方向选项 = 构建技能设计台原型字段下拉选项('影响方向', 方向原始选项, true);
    return {
      kind: 'scaling', hidden: false, rendered: 'full',
      controls: [
        补选项说明({ key: '驱动属性', field: true, kind: 'select', scalingDriver: true, ...驱动标签, ...设计台下拉(驱动选项, 有驱动 ? 驱动属性 : '无') }),
        补选项说明({ key: '影响方向', field: true, kind: 'select', directionField: true, hidden: !有驱动, ...设计台原型字段标签(原型, '影响方向', '影响方向'), ...设计台下拉(方向选项, 有驱动 ? 影响方向 : 首个合法方向) }),
      ],
    };
  }
  function 描述状态移除内部筛选编辑器(effect = {}, fallbackTarget = '单体', options = {}) {
    const 内部字段 = ['匹配原型', '资源', '数值方向']
      .filter(key => 读取技能设计台原型字段列表('状态移除', effect).includes(key))
      .map(key => 描述原型字段输入('状态移除', key, 格式化技能设计台原型字段值(effect && effect[key]), fallbackTarget, options))
      .filter(Boolean);
    if (!内部字段.length) return null;
    const 已启用 = normalizeSkillUiText(effect && effect['匹配原型'], '') && normalizeSkillUiText(effect && effect['匹配原型'], '') !== '无';
    const 匹配原型 = normalizeSkillUiText(effect && effect['匹配原型'], '');
    const 资源 = normalizeSkillUiText(effect && effect['资源'], '');
    const 数值方向 = normalizeSkillUiText(effect && effect['数值方向'], '任意');
    const 摘要 = (() => {
      if (!已启用) return '未启用';
      if (匹配原型 === '资源变化') {
        if (资源 === '生命' && 数值方向 === '负向') return '扣生命状态';
        if (资源 === '生命' && 数值方向 === '正向') return '恢复生命状态';
        if (资源) return `${资源}${数值方向 === '负向' ? '扣减' : 数值方向 === '正向' ? '恢复' : '变化'}状态`;
        return '资源变化状态';
      }
      if (匹配原型 === '护盾变化') return '护盾状态';
      return '内部筛选';
    })();
    return { kind: 'group', label: '内部效果筛选', summary: 摘要, open: !!已启用, controls: 内部字段 };
  }
  function 描述原型字段编辑器(effect = {}, options = {}) {
    // ≙ 构建技能设计台原型字段编辑器（字段顺序、驱动/条件分支放末尾、时窗修正固定顺序全部照搬）
    const prototype = normalizeSkillUiText(effect && effect['原型'], 读取技能设计台原型名称列表()[0] || '伤害结算');
    const target = normalizeSkillDesignerEffectTargetValue(effect && effect['目标'], '单体');
    const 当前效果 = 技能设计台清理并水合原型效果(effect, target, {
      嵌套字段: options && options.嵌套字段,
      强制独立: options && options.强制独立,
      允许对应等级: options && options.允许对应等级,
    });
    const 原始字段列表 = 读取技能设计台原型字段列表(prototype, 当前效果, options);
    const 字段列表 =
      prototype === '时窗修正'
        ? (() => {
            const 调整字段 = normalizeSkillUiText(当前效果 && 当前效果['调整字段'], '持续回合');
            const 模式字段 =
              调整字段 === '有效期tick'
                ? ['调整tick']
                : ['触发次数', '使用次数'].includes(调整字段)
                  ? ['调整次数']
                  : ['调整回合', '结算倍率'];
            const 固定顺序 = ['目标', '生效方式', '调整字段', '调整方式', ...模式字段, '单日使用次数上限', '驱动属性', '影响方向', '条件分支'];
            return [
              ...固定顺序.filter(key => 原始字段列表.includes(key)),
              ...原始字段列表.filter(key => !固定顺序.includes(key)),
            ];
          })()
        : 原始字段列表;
    const 内部筛选字段 = prototype === '状态移除' ? new Set(['匹配原型', '资源', '数值方向']) : new Set();
    const 字段内容 = 字段列表
      .filter(key => !['驱动属性', '影响方向', '条件分支'].includes(key) && !内部筛选字段.has(key))
      .map(key => {
        const rawValue = 当前效果 && 当前效果[key];
        const value = Array.isArray(rawValue) ? rawValue : 格式化技能设计台原型字段值(rawValue);
        return 描述原型字段输入(prototype, key, value, target, { ...options, 当前效果 });
      });
    if (prototype === '状态移除') 字段内容.push(描述状态移除内部筛选编辑器(当前效果, target, options));
    if (字段列表.includes('驱动属性') && 字段列表.includes('影响方向')) 字段内容.push(描述驱动判定属性编辑器(当前效果));
    if (字段列表.includes('条件分支'))
      字段内容.push(描述原型字段输入(prototype, '条件分支', 当前效果 && 当前效果['条件分支'], target, options));
    return { 当前效果, controls: 字段内容.filter(Boolean) };
  }
  function 描述原型效果行列表(effects = [], fallbackTarget = '单体', 允许删空 = false, options = {}, 网格 = {}) {
    // ≙ 构建技能设计台原型效果行列表；网格 = { name: main|condition-replace|condition-append|nested, nestedKind, conditionEffect, branchEntry }
    const source = Array.isArray(effects) ? effects : [];
    const normalized = 允许删空 && !source.length ? [] : 规范化技能设计台原型效果列表(source, fallbackTarget, options);
    const prototypeOptions = 读取技能设计台原型名称列表();
    const 网格对象 = { name: 网格.name || 'main', nestedKind: 网格.nestedKind || '', allowEmpty: !!网格.allowEmpty, conditionEffect: !!网格.conditionEffect, branchEntry: 网格.branchEntry || null, rows: [] };
    normalized.forEach((effect, index) => {
      const prototype = normalizeSkillUiText(effect['原型'], prototypeOptions[0] || '伤害结算');
      const 允许删除当前原型 = 允许删空 || normalized.length > 1;
      const 行选项 = {
        ...options,
        当前效果: effect,
        默认生效方式: options && options.默认生效方式 ? options.默认生效方式 : '跟随主原型',
        固定生效方式:
          options && options.固定首个独立生效 && index === 0 ? '独立生效' : options && options.固定生效方式,
      };
      const 行 = { kind: 'row', prototype, renderedState: prototype === '状态施加' ? normalizeSkillUiText(effect['状态'], '') : '', removable: !!允许删除当前原型, prototypeSelect: 设计台原型下拉(prototype) };
      Object.defineProperty(行, '__grid', { value: 网格对象, writable: true, enumerable: false });
      const 编辑 = 描述原型字段编辑器(effect, 行选项);
      行.fields = 编辑.controls;
      Object.defineProperty(行, '__effect', { value: 编辑.当前效果, writable: true, enumerable: false });
      绑定子网格(行);
      网格对象.rows.push(行);
    });
    Object.defineProperty(网格对象.rows, '__grid', { value: 网格对象, writable: true, enumerable: false });
    return 网格对象.rows;
  }
  // 给行内的嵌套列表 / 条件分支效果列表补父链（模拟 DOM 的 closest 关系）
  function 绑定子网格(行) {
    行.fields.forEach(控件 => {
      if (控件.kind === 'nested') 控件.rows.forEach(子行 => { Object.defineProperty(子行, '__parentRow', { value: 行, writable: true, enumerable: false }); });
      if (控件.kind === 'branch') 控件.branches.forEach(条目 => 绑定分支条目(条目, 行));
    });
  }
  function 绑定分支条目(条目, 行) {
    Object.defineProperty(条目, '__parentRow', { value: 行, writable: true, enumerable: false });
    ['替换效果', '追加效果'].forEach(键 => {
      const 列表 = 条目.effects[键].rows;
      if (列表.__grid) 列表.__grid.branchEntry = 条目;
      列表.forEach(子行 => { Object.defineProperty(子行, '__parentRow', { value: 行, writable: true, enumerable: false }); });
    });
  }

  // ───────────── 4. 条件分支 ≙ 构建技能设计台条件分支编辑器 / 条目 / 条件 ─────────────
  function 描述条件分支编辑器(原型 = '', value = [], fallbackTarget = '单体', 表内提示 = '') {
    const branches = Array.isArray(value) ? value : [];
    void 原型;
    // 原版这里的「条件分支」标签是纯文本，不显示 获取技能设计台原型字段提示 的说明（放在 tableHint）
    return { kind: 'branch', key: '条件分支', field: false, label: '条件分支', hint: '', tableHint: 表内提示 || '', enabled: !!branches.length, fallbackTarget, branches: branches.map(branch => 描述条件分支条目编辑器(branch, fallbackTarget)) };
  }
  function 描述条件分支条目编辑器(branch = {}, fallbackTarget = '单体') {
    const 处理 = normalizeSkillUiText(branch['处理'], '生效');
    const 条件 =
      Array.isArray(branch['条件']) && branch['条件'].length
        ? branch['条件']
        : [{ 类型: '生命比例', 对象: '目标', 比较: '<=', 值: '20%' }];
    const 替换效果 = Array.isArray(branch['替换效果']) ? branch['替换效果'] : [];
    const 追加效果 = Array.isArray(branch['追加效果']) ? branch['追加效果'] : [];
    const 禁用释放前降低结算 = 技能设计台条件列表包含释放后条件(条件);
    const 条目 = {
      kind: 'branchEntry', fallbackTarget,
      conditions: 条件.map(item => 描述条件分支条件编辑器(item, 条件.length > 1)),
      action: { key: '处理', kind: 'select', label: '处理', hint: 技能设计台条件字段提示.处理, ...设计台下拉(SKILL_DESIGNER_CONDITION_BRANCH_ACTION_OPTIONS, 处理) },
      effects: {},
    };
    [['替换效果', 'condition-replace', 替换效果], ['追加效果', 'condition-append', 追加效果]].forEach(([键, 网格名, 列表]) => {
      条目.effects[键] = {
        key: 键, label: 键, hint: 技能设计台条件字段提示[键], hidden: 处理 !== 键, grid: 网格名,
        rows: 列表.length
          ? 描述原型效果行列表(列表, fallbackTarget, true, { 禁用条件分支: true, 禁用释放前降低结算 }, { name: 网格名, allowEmpty: true, conditionEffect: true })
          : 描述原型效果行列表([], fallbackTarget, true, {}, { name: 网格名, allowEmpty: true, conditionEffect: true }),
      };
    });
    return 条目;
  }
  function 条件类型下拉(当前值 = '') {
    // ≙ 构建技能设计台条件类型分组选项
    const 选中值 = SKILL_DESIGNER_CONDITION_BRANCH_TYPE_OPTIONS.includes(toText(当前值, '').trim())
      ? toText(当前值, '').trim()
      : SKILL_DESIGNER_CONDITION_BRANCH_TYPE_OPTIONS[0];
    const options = [];
    SKILL_DESIGNER_CONDITION_BRANCH_TYPE_GROUPS.forEach(分组 => {
      分组.options.filter(选项 => SKILL_DESIGNER_CONDITION_BRANCH_TYPE_OPTIONS.includes(选项)).forEach(选项 => {
        options.push({ value: 选项, label: 选项, group: 分组.label, __selected: 选项 === 选中值 });
      });
    });
    return 下拉收口({ options });
  }
  function 条件比较下拉(类型 = '', 当前值 = '') {
    // ≙ 构建技能设计台条件分支比较控件选项（旗标/状态类型显示「是/否」）
    const type = normalizeSkillUiText(类型, '生命比例');
    const current = 规范化技能设计台条件分支比较值(type, 当前值);
    const options = 构建技能设计台条件分支比较选项(type).map(value => ({
      value,
      label: SKILL_DESIGNER_CONDITION_BRANCH_FLAG_TYPES.includes(type) || type === '状态存在' ? (value === '无' ? '否' : '是') : value,
      __selected: value === current,
    }));
    return 下拉收口({ options });
  }
  function 条件值控件(类型 = '', 比较 = '', value = '') {
    // ≙ 构建技能设计台条件分支值控件
    const 显示配置 = 读取技能设计台条件分支值控件配置(类型, 比较);
    if (显示配置.值控件 === '无') return null;
    if (显示配置.值控件 === '数字') return { key: '值', kind: 'number', min: '0', step: '1', value: 数字输入回读(value) };
    return { key: '值', kind: 'select', ...设计台下拉(显示配置.值选项, value) };
  }
  function 条件状态下拉(状态) {
    return 补选项说明({ key: '状态', kind: 'select', label: '状态', hint: '', ...设计台下拉(构建技能设计台状态施加分组选项(读取技能设计台原型字段选项('状态施加', '状态')), 状态) }, '__条件', '状态');
  }
  function 描述条件分支条件编辑器(condition = {}, 允许删除 = false) {
    const 类型 = normalizeSkillUiText(condition['类型'], '生命比例');
    const 对象 = normalizeSkillUiText(condition['对象'], '目标');
    const 比较 = 规范化技能设计台条件分支比较值(类型, condition['比较']);
    const 值 = 格式化技能设计台原型字段值(condition['值'] ?? (类型 === '目标' ? '自身' : ''));
    const 状态 = normalizeSkillUiText(condition['状态'], '中毒');
    const 显示配置 = 读取技能设计台条件分支值控件配置(类型, 比较);
    const 类型控件 = { key: '类型', kind: 'select', label: '类型', hint: 技能设计台条件字段提示.类型, ...条件类型下拉(类型) };
    if (类型 === '目标') {
      return {
        kind: 'condition', isTargetRow: true, renderedType: 类型, removable: !!允许删除,
        类型: 类型控件,
        对象: { key: '对象', kind: 'hidden', value: '目标' },
        比较隐藏: { key: '比较', kind: 'hidden', value: '==', disabled: false },
        比较: null,
        值: { label: '目标', hidden: false, control: 条件值控件(类型, 比较, 值 || '自身') },
        状态: null,
        preview: 构建技能设计台条件分支条件预览({ 类型, 对象: '目标', 比较: '==', 值: 值 || '自身' }),
      };
    }
    return {
      kind: 'condition', isTargetRow: false, renderedType: 类型, removable: !!允许删除,
      类型: 类型控件,
      对象: { key: '对象', kind: 'hidden', value: 属性回读(对象) },
      比较隐藏: { key: '比较', kind: 'hidden', value: 属性回读(比较), disabled: !!显示配置.显示比较 },
      比较: { key: '比较', kind: 'select', label: 显示配置.比较标签, hint: '', tableHint: 技能设计台条件字段提示.比较, hidden: !显示配置.显示比较, ...条件比较下拉(类型, 比较) },
      值: { label: 显示配置.值标签, hidden: !显示配置.显示值, control: 条件值控件(类型, 比较, 值) },
      状态: { ...条件状态下拉(状态), hidden: !显示配置.显示状态 },
      preview: 构建技能设计台条件分支条件预览(condition),
    };
  }
  function 描述嵌套原型列表编辑器(字段名 = '', value = [], fallbackTarget = '单体', 表内提示 = '') {
    // ≙ 构建技能设计台嵌套原型列表编辑器（标签为纯文本，原版不显示说明徽标）
    const source = Array.isArray(value) ? value : [];
    const 嵌套目标 = 字段名 === '授予效果' ? '单体' : fallbackTarget;
    const 显示字段名 = 字段名 === '授予效果' ? '作用效果' : 字段名 === '结算效果' ? '结算效果' : 字段名;
    const 默认原型 = 字段名 === '结算效果' ? '伤害结算' : '判定修正';
    return {
      kind: 'nested', key: 字段名, field: false, label: 文本回读(显示字段名), hint: '', tableHint: 表内提示 || '',
      defaultPrototype: 默认原型, nestedTarget: 嵌套目标,
      rows: 描述原型效果行列表(source, 嵌套目标, true, { 嵌套字段: 字段名, 强制独立: true }, { name: 'nested', nestedKind: 字段名, allowEmpty: true }),
    };
  }

  // ───────────── 5. 虚拟 DOM 遍历（文档顺序） ─────────────
  // 行内全部「data-skill-designer-prototype-field」输入，按 DOM 顺序，包含嵌套行（owner 标出所属行）
  function* 行内输入(行) { for (const 控件 of 行.fields) yield* 控件输入(控件, 行); }
  function* 控件输入(控件, owner) {
    if (!控件) return;
    if (控件.kind === 'scaling') { for (const c of 控件.controls) yield { ctl: c, owner }; return; }
    if (控件.kind === 'group') { for (const c of 控件.controls) yield* 控件输入(c, owner); return; }
    if (控件.kind === 'nested') { for (const r of 控件.rows) yield* 行内输入(r); return; }
    if (控件.kind === 'branch') { for (const b of 控件.branches) for (const k of ['替换效果', '追加效果']) for (const r of b.effects[k].rows) yield* 行内输入(r); return; }
    if (控件.field) yield { ctl: 控件, owner };
  }
  function* 遍历行(rows) {
    for (const 行 of rows) {
      yield 行;
      for (const 控件 of 行.fields) {
        if (控件.kind === 'nested') yield* 遍历行(控件.rows);
        if (控件.kind === 'branch') for (const b of 控件.branches) for (const k of ['替换效果', '追加效果']) yield* 遍历行(b.effects[k].rows);
      }
    }
  }
  function* 遍历缩放块(rows) {
    for (const 行 of rows) for (const 控件 of 行.fields) {
      if (控件.kind === 'scaling') yield { block: 控件, row: 行 };
      else if (控件.kind === 'nested') yield* 遍历缩放块(控件.rows);
      else if (控件.kind === 'branch') for (const b of 控件.branches) for (const k of ['替换效果', '追加效果']) yield* 遍历缩放块(b.effects[k].rows);
    }
  }
  function* 遍历条件行(rows) {
    for (const 行 of rows) for (const 控件 of 行.fields) {
      if (控件.kind === 'nested') yield* 遍历条件行(控件.rows);
      else if (控件.kind === 'branch') for (const b of 控件.branches) yield* 条目内条件行(b);
    }
  }
  function* 条目内条件行(条目) {
    for (const c of 条目.conditions) yield { cond: c, entry: 条目 };
    for (const k of ['替换效果', '追加效果']) yield* 遍历条件行(条目.effects[k].rows);
  }
  function 控件读值(控件) {
    if (!控件) return undefined;
    if (控件.kind === 'object') return 控件.json;
    if (控件.kind === 'bool') return 'on';
    return 控件.value;
  }
  function 行字段控件(行, 字段名) { for (const { ctl } of 行内输入(行)) if (ctl.key === 字段名) return ctl; return null; }
  const 原型行字段值 = (行, 字段名) => normalizeSkillUiText(控件读值(行字段控件(行, 字段名)), '');

  // ───────────── 6. 挂载期同步 ≙ onMount 的 syncScalingField / 同步原型行默认驱动判定 / syncConditionRow ─────────────
  function 同步缩放块(block, 行) {
    if (!block) return;
    const 原型 = normalizeSkillUiText(行.prototypeSelect.value || 原型行字段值(行, '原型'), '');
    const 目标 = 原型行字段值(行, '目标');
    const 驱动 = block.controls.find(c => c.key === '驱动属性');
    const 方向 = block.controls.find(c => c.key === '影响方向');
    if (原型 === '伤害结算' || (!设计台驱动例外原型.includes(原型) && 目标 === '自身')) {
      block.hidden = true;
      if (驱动) 设控件值(驱动, '无');
      if (方向) 设控件值(方向, '无');
      return;
    }
    block.hidden = false;
    const driver = block.controls.find(c => c.scalingDriver);
    const direction = block.controls.find(c => c.directionField) || null;
    const 刷新方向选项 = (控件, 选项列表, 当前值, 默认值) => {
      const 下拉 = 设计台下拉(选项列表, 选项列表.includes(当前值) ? 当前值 : 默认值);
      控件.options = 下拉.options; 控件.value = 下拉.value;
    };
    const hasDriver = normalizeSkillUiText(driver && driver.value, '无') !== '无';
    const 当前字段 = {
      目标,
      发动方式: 原型行字段值(行, '发动方式'),
      状态: 原型行字段值(行, '状态'),
      数值: 原型行字段值(行, '数值'),
      持续回合: 原型行字段值(行, '持续回合'),
      结算: 原型行字段值(行, '结算'),
    };
    const 合法方向列表 = 读取技能设计台影响方向选项值(原型, 当前字段);
    const 首个合法方向 = 选择技能设计台默认影响方向(原型, 当前字段, '效果强度');
    if (direction) {
      direction.hidden = 原型 === '状态移除' || !hasDriver;
      const 当前方向 = normalizeSkillUiText(direction.value, '');
      刷新方向选项(direction, 合法方向列表, 当前方向, 首个合法方向);
      设控件值(direction, 原型 === '状态移除' && hasDriver
        ? '成功率'
        : hasDriver
          ? (当前方向 === '无' || (合法方向列表.length && !合法方向列表.includes(当前方向)) ? 首个合法方向 : 当前方向)
          : '无');
    }
  }
  function 原型行需要默认驱动判定(行) {
    if (!行) return false;
    if (原型行字段值(行, '驱动属性')) return false;
    const 原型 = normalizeSkillUiText(行.prototypeSelect.value || 原型行字段值(行, '原型'), '');
    if (原型 === '伤害结算' || (!设计台驱动例外原型.includes(原型) && 原型行字段值(行, '目标') === '自身')) return false;
    return 技能设计台原型需要默认驱动判定(原型, {
      目标: 原型行字段值(行, '目标'),
      状态: 原型行字段值(行, '状态'),
      数值: 原型行字段值(行, '数值'),
      结算: 原型行字段值(行, '结算'),
      发动方式: 原型行字段值(行, '发动方式'),
      结算倍率: 原型行字段值(行, '结算倍率'),
      转化比例: 原型行字段值(行, '转化比例'),
      概率: 原型行字段值(行, '概率'),
    });
  }
  function 同步原型行默认驱动判定(行) {
    if (!行 || !原型行需要默认驱动判定(行)) return;
    const 驱动输入 = 行字段控件(行, '驱动属性');
    const 方向输入 = 行字段控件(行, '影响方向');
    const 原型 = normalizeSkillUiText(行.prototypeSelect.value || 原型行字段值(行, '原型'), '');
    const 字段 = {};
    ['状态', '数值', '结算', '威力倍率', '发动方式'].forEach(字段名 => {
      const 字段值 = 原型行字段值(行, 字段名);
      if (字段值) 字段[字段名] = 字段值;
    });
    if (驱动输入) 设控件值(驱动输入, 选择技能设计台默认驱动属性(原型, 字段));
    if (方向输入) 设控件值(方向输入, 选择技能设计台默认影响方向(原型, 字段, '效果强度'));
    const 首块 = 遍历缩放块([行]).next().value;
    if (首块) 同步缩放块(首块.block, 首块.row);
  }
  // 原版 handleSubmit 先 setBusy(true) 把所有 [data-skill-designer-disableable] 控件设为 disabled 再回读表单。
  // 桥接 readCondition 已修（2026-11-08）：忙碌态禁用的可禁用控件照常读取，只跳过有意禁用的隐藏输入 → 保存不再丢条件分支。
  // 保存链仍按忙碌态回读（与原版流程一致），{ keepConditionBranches } 保留为兼容参数，两者结果相同。
  let 设计台回读忙碌态 = false;
  // 物品被动保持承载方式：旧设计台没有物品技能入口，这条只在数据层实现（见 api2.js 物品被动承载），默认开
  const 设计台规则 = { 物品被动保持承载方式: true };
  function 条件读值(条件, 字段名) {
    // ≙ readCondition：同名字段中第一个未有意禁用的输入（DOM 顺序：类型、对象、隐藏比较、比较下拉、值、状态）；
    // 忙碌态（设计台回读忙碌态）只禁用可禁用控件，桥接修复后照常读取，所以这里不再按忙碌态排除
    const 候选 = [条件.类型, 条件.对象, 条件.比较隐藏, 条件.比较, 条件.值 && 条件.值.control, 条件.状态].filter(Boolean);
    const 命中 = 候选.find(c => c.key === 字段名 && !c.disabled);
    return 命中 ? 读取技能设计台原型字段输入值(命中.value) : '';
  }
  function 同步条件行(条件, 条目) {
    // ≙ syncConditionRow
    if (!条件) return 条件;
    const type = normalizeSkillUiText(条件.类型.value, '生命比例');
    const 原类型 = normalizeSkillUiText(条件.renderedType, type);
    if (原类型 !== type || (type === '目标') !== 条件.isTargetRow) {
      const 默认配置 = 读取技能设计台条件分支值控件配置(type, '');
      const 当前值 = normalizeSkillUiText(条件.值 && 条件.值.control ? 条件.值.control.value : '', '');
      const nextCondition = { 类型: type, 对象: '目标', 比较: 规范化技能设计台条件分支比较值(type, '') };
      if (默认配置.显示值) nextCondition['值'] = normalizeSkillDesignerSelectValue(当前值, 默认配置.值选项, 默认配置.值选项[0] || (type === '目标' ? '自身' : ''));
      if (默认配置.显示状态) nextCondition['状态'] = normalizeSkillUiText(条件.状态 && 条件.状态.value, '中毒');
      const 新行 = 描述条件分支条件编辑器(nextCondition, !!条件.removable);
      const 序号 = 条目.conditions.indexOf(条件);
      if (序号 >= 0) 条目.conditions.splice(序号, 1, 新行);
      同步条件行(新行, 条目);
      同步条件分支后置结算限制(条目);
      return 新行;
    }
    if (type === '目标') {
      条件.preview = 构建技能设计台条件分支条件预览({ 类型: '目标', 对象: '目标', 比较: '==', 值: normalizeSkillUiText(条件.值 && 条件.值.control ? 条件.值.control.value : '', '自身') });
      return 条件;
    }
    const compareSelect = 条件.比较;
    const compareHidden = 条件.比较隐藏;
    const compareInput = compareSelect && !compareSelect.disabled ? compareSelect : compareHidden;
    const 显示配置 = 读取技能设计台条件分支值控件配置(type, compareInput && compareInput.value);
    if (compareSelect) compareSelect.label = 显示配置.比较标签;
    if (条件.值) 条件.值.label = 显示配置.值标签;
    if (compareSelect) compareSelect.hidden = !显示配置.显示比较;
    if (compareHidden) {
      compareHidden.disabled = !!显示配置.显示比较;
      compareHidden.value = 规范化技能设计台条件分支比较值(type, compareHidden.value || (compareInput && compareInput.value));
    }
    if (compareSelect) {
      const currentCompare = 规范化技能设计台条件分支比较值(type, compareSelect.value || (compareHidden && compareHidden.value));
      const 下拉 = 条件比较下拉(type, currentCompare);
      compareSelect.options = 下拉.options; compareSelect.value = 下拉.value;
    }
    const 比较源 = 显示配置.显示比较 ? compareSelect : compareHidden;
    const compare = 规范化技能设计台条件分支比较值(type, 比较源 && 比较源.value);
    const nextConfig = 读取技能设计台条件分支值控件配置(type, compare);
    const 当前值 = normalizeSkillUiText(条件.值 && 条件.值.control ? 条件.值.control.value : '', '');
    条件.值 = { label: nextConfig.值标签, hidden: !nextConfig.显示值, control: 条件值控件(type, compare, 当前值) };
    if (条件.状态) 条件.状态.hidden = !nextConfig.显示状态;
    条件.preview = 构建技能设计台条件分支条件预览({
      类型: type,
      对象: normalizeSkillUiText(条件.对象 && 条件.对象.value, '目标'),
      比较: compare,
      值: normalizeSkillUiText(条件.值.control ? 条件.值.control.value : '', ''),
      状态: normalizeSkillUiText(条件.状态 && 条件.状态.value, ''),
    });
    同步条件分支后置结算限制(条目);
    return 条件;
  }
  function 同步条件分支后置结算限制(条目) {
    if (!条目) return;
    const 条件列表 = [...条目内条件行(条目)].map(({ cond }) => ({ 类型: normalizeSkillUiText(cond.类型.value, '') }));
    const 禁用释放前降低结算 = 技能设计台条件列表包含释放后条件(条件列表);
    ['替换效果', '追加效果'].forEach(键 => {
      [...遍历行(条目.effects[键].rows)].forEach(行 => {
        const 原型 = normalizeSkillUiText(行.prototypeSelect.value, '');
        if (原型 !== '结算修正') return;
        let 结算输入 = null, 数值输入 = null;
        for (const { ctl, owner } of 行内输入(行)) {
          if (owner !== 行) continue;
          if (!结算输入 && ctl.key === '结算') 结算输入 = ctl;
          if (!数值输入 && ctl.key === '数值') 数值输入 = ctl;
        }
        if (!结算输入) return;
        const 结算 = normalizeSkillUiText(结算输入.value, '');
        const 数值 = 解析技能设计台正负数值(数值输入 && 数值输入.value);
        if (禁用释放前降低结算 && ['消耗', '前摇'].includes(结算) && 数值 < 0) {
          设控件值(结算输入, '造成伤害');
          重建原型行(行);
        }
      });
    });
  }
  function 重建原型行(行) {
    // ≙ rebuildPrototypeRowFields：按当前行值重新水合并重渲染本行字段
    if (!行) return;
    const nextPrototype = normalizeSkillUiText(行.prototypeSelect.value, '');
    if (!nextPrototype || !SKILL_DESIGNER_PROTOTYPE_REGISTRY[nextPrototype]) return;
    const renderedPrototype = normalizeSkillUiText(行.prototype, '');
    const renderedState = normalizeSkillUiText(行.renderedState, '');
    const 目标控件 = 行字段控件(行, '目标');
    const currentTarget = normalizeSkillUiText(目标控件 && 目标控件.value, '单体');
    const 网格 = 行.__grid;
    const rows = 网格 ? 网格.rows : [];
    const rowIndex = rows.indexOf(行);
    const gridName = normalizeSkillUiText(网格 && 网格.name, '');
    const 允许对应等级 = gridName === 'item-use';
    const currentEffects = 网格 ? 读取虚拟行列表(rows, currentTarget, '', true, { 允许对应等级 }) : [];
    const nestedKind = normalizeSkillUiText(网格 && 网格.nestedKind, '');
    const branchRow = 网格 && 网格.branchEntry;
    const 禁用释放前降低结算 = !!branchRow && 技能设计台条件列表包含释放后条件([...条目内条件行(branchRow)].map(({ cond }) => ({ 类型: cond.类型.value })));
    const currentSource = currentEffects[rowIndex] || {};
    const sourceEffect =
      renderedPrototype && renderedPrototype !== nextPrototype
        ? { 原型: nextPrototype, 目标: currentTarget, 生效方式: currentSource['生效方式'] }
        : { ...currentSource, 原型: nextPrototype, 目标: currentTarget };
    if (nextPrototype === '状态施加' && renderedPrototype === '状态施加' && renderedState && normalizeSkillUiText(sourceEffect['状态'], '') !== renderedState) {
      delete sourceEffect['数值'];
      delete sourceEffect['副数值'];
    }
    if (nextPrototype === '结算修正' && normalizeSkillUiText(sourceEffect['结算'], '') !== '持续伤害引爆' && 是技能设计台持续伤害引爆自动条件(sourceEffect['条件分支'])) {
      delete sourceEffect['条件分支'];
    }
    const currentEffect = 技能设计台清理并水合原型效果(sourceEffect, currentTarget, { 嵌套字段: nestedKind, 强制独立: gridName !== 'main', 允许对应等级 });
    const 禁用条件分支 = !!(网格 && 网格.conditionEffect);
    const 编辑 = 描述原型字段编辑器(currentEffect, {
      禁用条件分支,
      嵌套字段: nestedKind,
      强制独立: gridName !== 'main',
      禁用释放前降低结算,
      固定生效方式: gridName === 'main' && rowIndex === 0 ? '独立生效' : '',
      默认生效方式: '独立生效',
      当前效果: currentEffect,
      允许对应等级,
    });
    行.fields = 编辑.控件 || 编辑.controls;
    行.__effect = 编辑.当前效果;
    绑定子网格(行);
    行.prototype = currentEffect['原型'];
    行.renderedState = currentEffect['原型'] === '状态施加' ? normalizeSkillUiText(currentEffect['状态'], '') : '';
    行.prototypeSelect = 设计台原型下拉(行.prototype);
    for (const { cond, entry } of [...遍历条件行([行])]) 同步条件行(cond, entry);
    for (const { block, row } of [...遍历缩放块([行])]) 同步缩放块(block, row);
  }
  function 挂载同步行(rows) {
    // ≙ onMount 末尾：全部原型行默认驱动 → 全部缩放块 → 全部条件行（均为文档顺序）
    [...遍历行(rows)].forEach(同步原型行默认驱动判定);
    [...遍历缩放块(rows)].forEach(({ block, row }) => 同步缩放块(block, row));
    [...遍历条件行(rows)].forEach(({ cond, entry }) => 同步条件行(cond, entry));
  }

  // ───────────── 7. 回读 ≙ 读取技能设计台原型效果状态 ─────────────
  function 读取虚拟行列表(rows = [], fallbackTarget = '单体', gridName = '', 允许空列表 = false, context = {}) {
    const target = normalizeSkillDesignerEffectTargetValue(fallbackTarget, '单体');
    if (!rows.length && (gridName === 'side' || 允许空列表)) return [];
    const effects = rows
      .map(行 => {
        const prototype = normalizeSkillUiText(行.prototypeSelect && 行.prototypeSelect.value, '');
        if (!prototype || !SKILL_DESIGNER_PROTOTYPE_REGISTRY[prototype]) return null;
        const effect = { 原型: prototype, 目标: target };
        for (const { ctl, owner } of 行内输入(行)) {
          if (owner !== 行) continue;
          const key = normalizeSkillUiText(ctl.key, '');
          if (!key) continue;
          if (ctl.kind === 'bool') {
            if (ctl.value === true) effect[key] = true;
            continue;
          }
          const value = ctl.kind === 'object'
            ? (() => {
                try {
                  const parsed = JSON.parse(ctl.json || '{}');
                  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
                } catch (_) {
                  return {};
                }
              })()
            : ctl.kind === 'multi'
              ? 读取技能设计台多枚举值(ctl.value)
              : 读取技能设计台原型字段输入值(ctl.value);
          if (value === '无') continue;
          if (value !== '' && !(value && typeof value === 'object' && !Array.isArray(value) && !Object.keys(value).length))
            effect[key] = key === '防御穿透' ? Math.max(0, Math.min(100, parseSkillDesignerIntegerInputValue(value, 0, 0))) : value;
        }
        if (prototype === '状态施加' && normalizeSkillUiText(effect['状态'], '') === '无视异常' && !effect['触发限制']) {
          effect['触发限制'] = { 周期: '每日', 次数: 3 };
        }
        行.fields.filter(控件 => 控件.kind === 'branch').forEach(block => {
          if (!block.enabled) return;
          const branches = block.branches
            .map(条目 => {
              const action = normalizeSkillUiText(条目.action && 条目.action.value, '替换效果');
              const conditions = [...条目内条件行(条目)]
                .map(({ cond }) => {
                  const 类型 = normalizeSkillUiText(条件读值(cond, '类型'), '');
                  const 比较 = 规范化技能设计台条件分支比较值(类型, 条件读值(cond, '比较'));
                  const condition = { 类型, 对象: normalizeSkillUiText(条件读值(cond, '对象'), '目标'), 比较 };
                  const 显示配置 = 读取技能设计台条件分支值控件配置(类型, 比较);
                  if (显示配置.显示值) {
                    const value = 条件读值(cond, '值');
                    if (value !== '') condition['值'] = value;
                  }
                  if (显示配置.显示状态) {
                    const state = normalizeSkillUiText(条件读值(cond, '状态'), '');
                    if (state) condition['状态'] = state;
                  }
                  return condition['类型'] ? condition : null;
                })
                .filter(Boolean);
              if (!conditions.length) return null;
              const branch = { 条件: conditions, 处理: action };
              if (action === '替换效果' || action === '追加效果') {
                const effectKey = action === '替换效果' ? '替换效果' : '追加效果';
                const nestedEffects = 读取虚拟行列表(条目.effects[effectKey].rows, target, '', true, {
                  条件分支: true,
                  强制独立: true,
                  允许对应等级: context && context.允许对应等级,
                });
                if (nestedEffects.length) branch[effectKey] = nestedEffects;
              }
              return branch;
            })
            .filter(Boolean);
          if (branches.length) effect['条件分支'] = branches;
        });
        行.fields.filter(控件 => 控件.kind === 'nested').forEach(block => {
          const key = normalizeSkillUiText(block.key, '');
          if (!key) return;
          const nestedEffects = 读取虚拟行列表(block.rows, target, '', true, {
            嵌套字段: key,
            强制独立: true,
            允许对应等级: context && context.允许对应等级,
          });
          if (nestedEffects.length) effect[key] = nestedEffects;
        });
        return effect;
      })
      .filter(Boolean);
    const 规范续效果列表 = 规范化技能设计台原型生效方式列表(effects, context);
    const 归一效果列表 =
      允许空列表 && !规范续效果列表.length ? [] : 规范化技能设计台原型效果列表(规范续效果列表, target, context);
    清理技能设计台等价替换条件分支(归一效果列表);
    return 归一效果列表;
  }

  // ───────────── 8. 副作用行 ≙ 构建技能设计台副作用行列表 / readSideEffects ─────────────
  function 描述副作用行列表(副作用列表 = [], 选项 = {}) {
    const 列表 = 规范化技能设计台副作用列表(副作用列表);
    const 字段名 = normalizeSkillUiText(选项 && 选项.字段名, '副作用列表');
    return 列表.map(条目 => 描述副作用行(条目, 字段名));
  }
  function 描述副作用行(条目 = {}, 字段名 = '副作用列表') {
    const 类型 = normalizeSkillUiText(条目['副作用类型'], '自损反噬');
    const 是致死献祭 = 类型 === '致死献祭';
    const 配置 = 技能设计台副作用配置表_V1[类型] || {};
    const 效果说明 = 格式化技能设计台副作用摘要(条目);
    const 字段 = [
      { key: '副作用类型', kind: 'select', label: '类型', hint: 技能设计台副作用字段提示.类型, ...设计台下拉(技能设计台副作用类型候选_V1, 类型) },
      { key: '触发时机', kind: 'select', label: '时机', hint: 技能设计台副作用字段提示.时机, ...设计台下拉(技能设计台副作用触发时机选项_V1, 条目['触发时机'] || '效果生效后') },
      { key: '生效对象', kind: 'select', label: '对象', hint: 技能设计台副作用字段提示.对象, ...设计台下拉(技能设计台副作用生效对象选项_V1, 条目['生效对象'] || '技能释放者') },
      { key: '触发概率', kind: 'text', label: '概率', hint: 技能设计台副作用字段提示.概率, value: 属性回读(格式化技能设计台概率百分比(条目['触发概率'] ?? 1)) },
    ];
    if (!是致死献祭) {
      字段.push({ key: '持续回合', kind: 'number', label: '持续', hint: 技能设计台副作用字段提示.持续, min: '0', step: '1', value: 数字输入回读(String(条目['持续回合'] ?? 1)) });
      字段.push({ key: '数值', kind: 'text', label: 文本回读(配置.数值标签 || '强度'), hint: '', value: 属性回读(条目['数值'] || ''), placeholder: 属性回读(配置.数值 || '+10%') });
      if (配置.副数值) 字段.push({ key: '副数值', kind: 'text', label: 文本回读(配置.副数值标签 || '附加强度'), hint: '', value: 属性回读(条目['副数值'] || ''), placeholder: 属性回读(配置.副数值) });
      字段.push({ key: '关联状态', kind: 'text', label: '关联效果', hint: '', value: 属性回读(条目['关联状态'] || ''), placeholder: '食物增幅', hidden: 条目['触发时机'] !== '效果结束后' });
    }
    // 类型选项说明：原版副作用摘要（按该类型默认参数）
    字段[0].options.forEach(项 => { const 示例 = 创建技能设计台默认副作用条目(项.value); const 说明 = 示例 && 示例.副作用类型 === 项.value ? 格式化技能设计台副作用摘要(示例) : ''; if (说明) 项.hint = 说明; });
    return { kind: 'sideEffect', scope: 字段名, fields: 字段, summary: 是致死献祭 ? '' : 效果说明 };
  }
  function 读取副作用行列表(行列表 = []) {
    return 规范化技能设计台副作用列表(
      行列表.map(行 => {
        const 条目 = {};
        行.fields.forEach(控件 => {
          const key = normalizeSkillUiText(控件.key, '');
          if (!key) return;
          const value = normalizeSkillUiText(控件.value, '');
          if (value || ['触发概率', '持续回合'].includes(key)) 条目[key] = value;
        });
        return 条目;
      }),
    );
  }

  // ───────────── 9. 整张表单 ≙ 预览页模板 + readSkillDesignerFormState ─────────────
  function 构建虚拟表单(designerDraft = {}, previewMeta = {}, snapshot = {}) {
    const 上下文 = 设计台模板上下文(snapshot, previewMeta, designerDraft);
    const scopeLabels = getSkillDesignerScopeLabels(previewMeta);
    const 下拉 = (选项, 当前, 空) => ({ kind: 'select', ...设计台下拉(选项, 当前, 空) });
    const 使用限制无 = (designerDraft.使用限制周期 || '无限制') === '无限制';
    const 是紫极魔瞳功法 = previewMeta.scope === 'art' && (designerDraft.name || previewMeta.label) === '紫极魔瞳';
    const top = {
      name: { kind: 'text', value: 属性回读(designerDraft.name), placeholder: 属性回读(`请输入${scopeLabels.nameFieldLabel}`) },
      type: { kind: 'hidden', value: 属性回读(designerDraft.type || '输出') },
      typeDisplay: 文本回读(designerDraft.typeDisplay || designerDraft.type || '输出'),
      deliveryForm: 下拉(getSkillDesignerDeliveryOptions(designerDraft.type), designerDraft.deliveryForm || '直接生效'),
      使用限制周期: 下拉(技能设计台使用限制周期选项, designerDraft.使用限制周期 || '无限制'),
      使用限制次数: { kind: 'number', min: '1', step: '1', value: 数字输入回读(String(Math.max(1, toNumber(designerDraft.使用限制次数, 1)))), disabled: 使用限制无 },
      启用被动: { kind: 'bool', value: !!上下文.启用被动 },
      被动触发: 下拉(技能设计台被动触发选项, designerDraft.被动触发 || '常驻'),
      被动触发周期: 下拉(技能设计台被动触发周期选项, 上下文.被动触发限制.周期),
      被动触发次数: { kind: 'number', min: '1', step: '1', value: 数字输入回读(String(上下文.被动触发限制.次数)) },
      artStage: 是紫极魔瞳功法 ? { kind: 'text', value: 属性回读(designerDraft.artStage || '未入门') } : null,
      artLevel: 是紫极魔瞳功法 ? { kind: 'number', min: '1', max: '4', step: '1', value: 数字输入回读(String(Math.max(1, toNumber(designerDraft.artLevel, 1)))) } : null,
      constructItemCount: { kind: 'number', min: '1', step: '1', value: 数字输入回读(String(Math.max(1, toNumber(designerDraft.constructItemCount, 1)))) },
      constructDurationTick: 描述tick输入({ label: '有效期', hint: '' }, 'constructDurationTick', Math.max(0, toNumber(designerDraft.constructDurationTick, 0)), { 最小tick: 0, 默认tick: 0 }),
      constructDescription: { kind: 'text', value: 属性回读(designerDraft.constructDescription || ''), placeholder: '例如：闪烁着暗金光芒的晶体' },
      costType: 下拉(SKILL_DESIGNER_RESOURCE_TYPE_OPTIONS, designerDraft.costType),
      costValues: Object.fromEntries(SKILL_DESIGNER_COST_RESOURCE_KEYS.map(资源 => [资源, { kind: 'text', value: 属性回读(上下文.消耗值[资源] ?? ''), placeholder: '无', pattern: '[0-9]+(\\.[0-9]+)?%?' }])),
      sustainValues: Object.fromEntries(SKILL_DESIGNER_COST_RESOURCE_KEYS.map(资源 => [资源, { kind: 'text', value: 属性回读(上下文.维持消耗值[资源] ?? ''), placeholder: '无', pattern: '[0-9]+(\\.[0-9]+)?%?' }])),
      fixedCostRatio: 上下文.固定百分比消耗比例,
      前摇: { kind: 'number', min: '0', step: '1', value: 数字输入回读(String(Math.max(0, toNumber(designerDraft['前摇'], 0)))) },
      启用技能掌控度: { kind: 'bool', value: !!上下文.启用技能掌控度 },
      技能掌控度中心等级: { kind: 'number', min: '1', step: '1', value: 数字输入回读(designerDraft.技能掌控度中心等级 || ''), placeholder: '85' },
      技能掌控度圆满等级: { kind: 'number', min: '1', step: '1', value: 数字输入回读(designerDraft.技能掌控度圆满等级 || ''), placeholder: '99' },
      attachedAttributes: (() => {
        const 已选 = new Set(normalizeSkillDesignerArray(designerDraft.attachedAttributes));
        return { kind: 'multi', options: SKILL_DESIGNER_ATTRIBUTE_OPTIONS.map(项 => toText(项, '').trim()).filter(Boolean).map(项 => ({ value: 属性回读(项), label: 文本回读(项), recommended: 上下文.recommendedAttrs.has(项) })), selected: SKILL_DESIGNER_ATTRIBUTE_OPTIONS.map(项 => toText(项, '').trim()).filter(项 => 项 && 已选.has(项)).map(属性回读) };
      })(),
      visualDesc: { kind: 'textarea', value: 文本域回读(designerDraft.visualDesc), placeholder: '例如：空间剧烈震荡，一柄漆黑如墨的巨刃破空而出...' },
      effectDesc: { kind: 'textarea', value: 文本域回读(designerDraft.effectDesc), placeholder: '总结技能的实际作用，如：造成中等伤害并附带破甲效果' },
      用法模式: 上下文.isFusionDesigner ? 下拉(上下文.融合用法模式选项, designerDraft['用法模式'], '') : null,
      fusionMode: 上下文.isFusionDesigner ? 下拉(上下文.fusionModeOptions, designerDraft.fusionMode, '') : null,
      fusionParticipants: 上下文.isFusionDesigner ? 描述融合参与者行(designerDraft.fusionParticipants, snapshot.rootData, previewMeta) : [],
    };
    const vf = {
      previewMeta, scopeLabels, top,
      rows: designerDraft.prototypeEffects && designerDraft.prototypeEffects.length > 0
        ? 描述原型效果行列表(designerDraft.prototypeEffects, designerDraft.target, false, { 固定首个独立生效: true }, { name: 'main' })
        : [],
      sideEffects: 描述副作用行列表(designerDraft['副作用列表'], { 字段名: '副作用列表' }),
      isConstruct: !!上下文.是造物承载,
      isFusion: !!上下文.isFusionDesigner,
    };
    if (!vf.rows.__grid) Object.defineProperty(vf.rows, '__grid', { value: { name: 'main', nestedKind: '', allowEmpty: false, conditionEffect: false, branchEntry: null, rows: vf.rows }, writable: true, enumerable: false });
    return vf;
  }
  function 描述融合参与者行(participants = [], rootData = {}, previewMeta = {}) {
    // ≙ buildSkillDesignerFusionParticipantRows
    const participantList = normalizeSkillDesignerFusionParticipantList(participants, rootData);
    const mode = participantList.filter(participant => participant.role === 'partner').length ? 'partner' : 'self';
    const partnerCount = participantList.filter(participant => participant.role === 'partner').length;
    return participantList.map(participant => {
      const isSelf = participant.role === 'self';
      const charOptions = isSelf
        ? [{ value: participant.charKey, label: participant.charName || participant.charKey || '当前角色' }]
        : getSkillDesignerFusionCharOptions(rootData, previewMeta, participantList);
      const spiritOptions = getSkillDesignerFusionSpiritOptions(rootData, participant.charKey, participant.spirit);
      const charLabel = participant.charName || participant.charKey || '未设置';
      return {
        role: participant.role,
        char: isSelf
          ? { kind: 'static', value: 属性回读(participant.charKey), display: 文本回读(charLabel), charName: 属性回读(charLabel) }
          : { kind: 'select', ...设计台下拉(charOptions, participant.charKey, '暂无对象') },
        spirit: { kind: 'select', ...设计台下拉(spiritOptions, participant.spirit, spiritOptions.length ? '' : '未接入武魂') },
        removable: !isSelf && mode === 'partner' && partnerCount > 1,
      };
    });
  }
  function 读取虚拟表单(vf, previewMeta = {}) {
    // ≙ readSkillDesignerFormState（字段读取改为读虚拟控件，其余逻辑原样）
    const T = vf.top;
    const 字段表 = {
      name: T.name, type: T.type, deliveryForm: T.deliveryForm, 使用限制周期: T.使用限制周期, 使用限制次数: T.使用限制次数,
      启用被动: T.启用被动, 被动触发: T.被动触发, 被动触发周期: T.被动触发周期, 被动触发次数: T.被动触发次数,
      用法模式: T.用法模式, fusionMode: T.fusionMode, artStage: T.artStage, artLevel: T.artLevel,
      constructItemCount: T.constructItemCount, constructDurationTick: T.constructDurationTick, constructDescription: T.constructDescription,
      costType: T.costType, 前摇: T.前摇, 启用技能掌控度: T.启用技能掌控度, 技能掌控度中心等级: T.技能掌控度中心等级, 技能掌控度圆满等级: T.技能掌控度圆满等级,
      visualDesc: T.visualDesc, effectDesc: T.effectDesc,
    };
    const readField = key => {
      const input = 字段表[key];
      if (input && input.kind === 'bool') return input.value ? '启用' : '无';
      return input ? toText(input.value, '').trim() : '';
    };
    const readToggleField = key => (字段表[key] && 字段表[key].kind === 'bool' && 字段表[key].value ? '启用' : '无');
    const 选中资源 = () => {
      const costType = readField('costType') || '无';
      return costType === '混合' ? SKILL_DESIGNER_COST_RESOURCE_KEYS : SKILL_DESIGNER_COST_RESOURCE_KEYS.includes(costType) ? [costType] : [];
    };
    const readCostValues = () => {
      const result = {};
      选中资源().forEach(key => { const value = normalizeSkillUiText(T.costValues[key] && T.costValues[key].value, ''); if (value) result[key] = value; });
      return result;
    };
    const readSustainCostText = () => {
      const result = {};
      选中资源().forEach(key => { const value = normalizeSkillUiText(T.sustainValues[key] && T.sustainValues[key].value, ''); if (value) result[key] = value; });
      return 格式化技能设计台消耗片段(result);
    };
    const readFusionParticipants = () =>
      (T.fusionParticipants || [])
        .map(行 => {
          const role = normalizeSkillUiText(行.role, '') === 'self' ? 'self' : 'partner';
          const charKey = normalizeSkillUiText(行.char && 行.char.value, '');
          const 选中项 = 行.char && 行.char.kind === 'select' ? 行.char.options.find(项 => 项.value === 行.char.value) || null : null;
          const charName = normalizeSkillUiText(行.char && 行.char.kind === 'static' ? 行.char.charName : null, normalizeSkillUiText(选中项 && 选中项.label, charKey));
          const spirit = normalizeSkillUiText(行.spirit && 行.spirit.value, '');
          return createSkillDesignerFusionParticipant(role, charKey, charName, spirit);
        })
        .filter(participant => participant.charKey || participant.charName || participant.spirit);
    const 被动开关值 = readToggleField('启用被动');
    const 类型字段值 = readField('type');
    const typeMeta = resolveSkillDesignerTypeMeta(previewMeta, 被动开关值 === '无' ? '' : 类型字段值);
    const resolvedPrimaryMain = '';
    const resolvedPrimarySub = '';
    const resolvedTarget = getSkillDesignerDefaultTarget(previewMeta, typeMeta.value);
    const isFusionScope = toText(previewMeta && previewMeta.scope, '') === '武魂融合技';
    const fusionMode = isFusionScope ? normalizeSkillDesignerFusionMode(readField('fusionMode')) : '';
    const 用法模式 = isFusionScope ? 规范化技能设计台融合用法模式(readField('用法模式')) : '';
    const fusionParticipants = isFusionScope ? readFusionParticipants() : [];
    const derivedFusionFields = isFusionScope
      ? deriveSkillDesignerFusionFields(fusionMode, fusionParticipants, '')
      : { fusionPartner: '', fusionSourceSpirits: [], fusionParticipants: [] };
    const derivedMainRole = inferSkillDesignerMainRole(typeMeta.value, resolvedTarget, resolvedPrimaryMain, resolvedPrimarySub);
    const 启用技能掌控度 = 技能设计台启用技能掌控度(previewMeta, { type: typeMeta.value, 启用技能掌控度: readToggleField('启用技能掌控度') });
    const 启用被动 = 技能设计台启用被动(previewMeta, { type: typeMeta.value, 启用被动: 被动开关值 });
    const levelControl = 启用技能掌控度
      ? normalizeSkillDesignerLevelControl({ 中心等级: readField('技能掌控度中心等级'), 圆满等级: readField('技能掌控度圆满等级') })
      : null;
    const 被动触发限制 = 读取技能设计台被动触发限制({ 被动触发周期: readField('被动触发周期'), 被动触发次数: readField('被动触发次数') });
    const 使用限制 = 读取技能设计台使用限制({ 使用限制周期: readField('使用限制周期'), 使用限制次数: readField('使用限制次数') });
    const baseState = {
      name: readField('name') || toText(previewMeta && previewMeta.label, '未命名技能'),
      type: typeMeta.value,
      typeDisplay: typeMeta.display,
      target: 启用被动 ? '自身' : resolvedTarget,
      costType: readField('costType') || '无',
      costValues: readCostValues(),
      sustainCostText: readSustainCostText(),
      前摇: Math.max(0, toNumber(readField('前摇'), 0)),
      启用技能掌控度: 启用技能掌控度 ? '启用' : '无',
      启用被动: 启用被动 ? '启用' : '无',
      被动触发: 启用被动 ? normalizeSkillDesignerSelectValue(readField('被动触发'), 技能设计台被动触发选项, '常驻') : '',
      被动触发周期: 被动触发限制.周期,
      被动触发次数: String(被动触发限制.次数),
      使用限制周期: 使用限制.周期,
      使用限制次数: String(使用限制.次数),
      bonus: '无',
      mainRole: normalizeSkillUiText(derivedMainRole, '未知'),
      primaryMain: resolvedPrimaryMain,
      primarySub: resolvedPrimarySub,
      prototypeEffects: 读取虚拟行列表(vf.rows, resolvedTarget, 'main'),
      deliveryForm: readField('deliveryForm'),
      constructItemCount: Math.max(1, parseSkillDesignerIntegerInputValue(readField('constructItemCount'), 1, 1)),
      constructDurationTick: Math.max(0, parseSkillDesignerIntegerInputValue(readField('constructDurationTick'), 0, 0)),
      constructDescription: normalizeSkillUiText(readField('constructDescription'), ''),
      secondaryMechanics: [],
      attachedAttributes: (T.attachedAttributes.selected || []).map(值 => toText(值, '').trim()).filter(Boolean),
      attributeSource: '无',
      attributeRole: '无',
      coeff: normalizeSkillDesignerCoeffMap({}),
      visualDesc: readField('visualDesc'),
      effectDesc: readField('effectDesc'),
      artStage: readField('artStage') || '未入门',
      artLevel: Math.max(0, toNumber(readField('artLevel'), 0)),
      fusionMode,
      用法模式,
      fusionPartner: derivedFusionFields.fusionPartner,
      fusionSourceSpirits: derivedFusionFields.fusionSourceSpirits,
      fusionParticipants: derivedFusionFields.fusionParticipants,
      副作用列表: 读取副作用行列表(vf.sideEffects),
      使用副作用列表: 读取副作用行列表([]),
      技能掌控度: levelControl,
      技能掌控度中心等级: 启用技能掌控度 ? readField('技能掌控度中心等级') : '',
      技能掌控度圆满等级: 启用技能掌控度 ? readField('技能掌控度圆满等级') : '',
      阵营判定: '自动',
    };
    const firstPrototypeTarget = normalizeSkillUiText(baseState.prototypeEffects && baseState.prototypeEffects[0] && baseState.prototypeEffects[0]['目标'], '');
    if (firstPrototypeTarget) baseState.target = firstPrototypeTarget;
    if (启用被动) baseState.target = '自身';
    baseState.type = 推断技能设计台技能分类(baseState.prototypeEffects, typeMeta.value);
    baseState.typeDisplay = baseState.type;
    baseState.mainRole = normalizeSkillUiText(inferSkillDesignerMainRole(baseState.type, baseState.target, baseState.primaryMain, baseState.primarySub), '未知');
    const implicitAttributeConfig = resolveSkillDesignerImplicitAttributeConfig(baseState, previewMeta);
    return {
      ...baseState,
      attributeSource: implicitAttributeConfig.source,
      attributeRole: implicitAttributeConfig.role,
      coeff: implicitAttributeConfig.coeff,
      cost: formatSkillDesignerFullCostText(baseState.costType, baseState.costValues, baseState.sustainCostText),
      mechanicParams: readSkillDesignerMechanicParamState(null, baseState),
    };
  }
  function 同步草稿(vf, previewMeta, snapshot) {
    // ≙ syncDraftCache：回读 → (融合种子) → buildSkillDesignerFormStateFromDraft
    const formState = 读取虚拟表单(vf, previewMeta);
    const fusionSeed = vf.isFusion ? getSkillDesignerFusionDraftSeed(snapshot, previewMeta, formState) : {};
    return buildSkillDesignerFormStateFromDraft({ ...formState, ...fusionSeed }, previewMeta);
  }
  function 重建承载下拉(vf) {
    // ≙ rebuildDeliveryOptions
    const 当前值 = toText(vf.top.deliveryForm.value, '').trim();
    vf.top.deliveryForm = { kind: 'select', ...设计台下拉(getSkillDesignerDeliveryOptions(vf.top.type.value), 当前值) };
  }
  function 挂载虚拟表单(vf, previewMeta, snapshot) {
    // ≙ onMount 初始化顺序：handleInteractiveRefresh(承载下拉、融合行、refreshPreview) → 行级同步
    重建承载下拉(vf);
    if (vf.isFusion && vf.top.fusionMode) {
      const formState = 读取虚拟表单(vf, previewMeta);
      const fusionSeed = getSkillDesignerFusionDraftSeed(snapshot, previewMeta, formState);
      vf.top.fusionParticipants = 描述融合参与者行(fusionSeed.fusionParticipants, snapshot.rootData, previewMeta);
    }
    const 刷新草稿 = 同步草稿(vf, previewMeta, snapshot);
    vf.openSummaryDraft = 刷新草稿; // 打开瞬间（行级同步之前）原版摘要所用草稿
    vf.top.type.value = 属性回读(刷新草稿.type || '输出');
    vf.top.typeDisplay = 文本回读(刷新草稿.typeDisplay || 刷新草稿.type || '输出');
    重建承载下拉(vf);
    挂载同步行(vf.rows);
    return vf;
  }
  function 渲染并挂载(form, previewMeta, snapshot) {
    return 挂载虚拟表单(构建虚拟表单(form, previewMeta, snapshot), previewMeta, snapshot);
  }

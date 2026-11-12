
  // ───────────── 10. 对外描述（去掉内部链接，补 visible） ─────────────
  function 导出选项(options) {
    return (Array.isArray(options) ? options : []).map(项 => {
      const 出 = { value: 项.value, label: 项.label };
      ['hint', 'group', 'disabled', 'header', 'category', 'direction', 'recommended', 'all', 'selected'].forEach(k => { if (项[k] !== undefined && 项[k] !== '' && 项[k] !== false) 出[k] = 项[k]; });
      return 出;
    });
  }
  const 导出键 = ['key', 'kind', 'label', 'hint', 'tableHint', 'value', 'display', 'required', 'default', 'min', 'max', 'step', 'placeholder', 'pattern', 'positiveOnly', 'multiple', 'selected', 'summary', 'wide', 'tick', 'parts', 'partLimits', 'minTick', 'maxTick', 'json', 'allLabel', 'type', 'disabled'];
  function 导出控件(控件, 路径, 附加 = {}) {
    if (!控件) return null;
    if (控件.kind === 'scaling') return 控件.controls.map(c => 导出控件(c, 路径, { scaling: true, visible: !控件.hidden && !c.hidden && c.kind !== 'hidden' }));
    if (控件.kind === 'group') return { kind: 'group', label: 控件.label, summary: 控件.summary, open: !!控件.open, visible: true, fields: 控件.controls.flatMap(c => [].concat(导出控件(c, 路径) || [])) };
    if (控件.kind === 'nested') return { kind: 'nested', key: 控件.key, label: 控件.label, hint: '', tableHint: 控件.tableHint, visible: true, defaultPrototype: 控件.defaultPrototype, rows: 控件.rows.map((行, j) => 导出行(行, [...路径, 控件.key, j])) };
    if (控件.kind === 'branch') {
      return {
        kind: 'branch', key: '条件分支', label: 控件.label, hint: '', tableHint: 控件.tableHint, visible: true, enabled: !!控件.enabled,
        branches: 控件.branches.map((条目, b) => {
          const 列 = 键 => ({ label: 条目.effects[键].label, hint: 条目.effects[键].hint, visible: !条目.effects[键].hidden, rows: 条目.effects[键].rows.map((行, j) => 导出行(行, [...路径, '条件分支', b, 键, j])) });
          return { action: 导出控件(条目.action, 路径), conditions: 条目.conditions.map(导出条件), 替换效果: 列('替换效果'), 追加效果: 列('追加效果') };
        }),
      };
    }
    const 出 = {};
    导出键.forEach(k => { if (控件[k] !== undefined) 出[k] = Array.isArray(控件[k]) ? 控件[k].slice() : 控件[k]; });
    if (控件.options) 出.options = 导出选项(控件.options);
    // 驱动属性 / 影响方向：原版标签表里有逐项说明（挂载同步重建方向下拉后标签变为纯值，但说明仍属原版文本）
    if (['驱动属性', '影响方向'].includes(控件.key) && 出.options) 出.options.forEach(项 => { if (!项.hint) { const 说明 = 设计台选项说明(控件.key, 项.value); if (说明) 项.hint = 说明; } });
    if (控件.unit) 出.unit = { ...控件.unit, options: 导出选项(控件.unit.options) };
    if (控件.subfields) 出.subfields = 控件.subfields.map(c => 导出控件(c, 路径));
    出.visible = 附加.visible !== undefined ? 附加.visible : !控件.hidden && 控件.kind !== 'hidden';
    if (附加.scaling) 出.scaling = true;
    if (控件.kind === 'select' && 控件.value === '' && 控件.options && !控件.options.some(项 => 项.value === '')) 出.unselected = true;
    return 出;
  }
  function 设计台选项说明(字段, 值) {
    const 项 = 构建技能设计台原型字段下拉选项(字段, [值], true)[0];
    const 标签 = String((项 && 项.label) || '');
    const 分隔 = 标签.indexOf('｜');
    return 分隔 > 0 ? 标签.slice(分隔 + 1) : '';
  }
  function 导出条件(条件) {
    const 出 = { kind: 'condition', isTargetRow: !!条件.isTargetRow, removable: !!条件.removable, preview: 条件.preview };
    出.类型 = 导出控件(条件.类型);
    出.对象 = { key: '对象', kind: 'hidden', value: 条件.对象.value, visible: false };
    出.比较 = 条件.比较 ? 导出控件(条件.比较) : { key: '比较', kind: 'hidden', value: 条件.比较隐藏.value, visible: false };
    if (条件.比较) 出.比较隐藏 = { value: 条件.比较隐藏.value, disabled: !!条件.比较隐藏.disabled };
    出.值 = 条件.值 && 条件.值.control ? { ...导出控件(条件.值.control), label: 条件.值.label, visible: !条件.值.hidden } : { key: '值', kind: 'none', label: 条件.值 ? 条件.值.label : '', visible: false };
    if (条件.状态) 出.状态 = 导出控件(条件.状态);
    return 出;
  }
  function 导出行(行, 路径) {
    return {
      path: 路径,
      prototype: 行.prototypeSelect.value || 行.prototype,
      removable: !!行.removable,
      prototypeSelect: { key: '原型', kind: 'select', label: '原型', hint: '', value: 行.prototypeSelect.value, options: 导出选项(行.prototypeSelect.options), visible: true },
      fields: 行.fields.flatMap(控件 => [].concat(导出控件(控件, 路径) || [])),
    };
  }

  // ───────────── 11. 表单分区（原版 section 顺序 + 分页） ─────────────
  function 读取分区页名(标题, 标记 = '') {
    const 页 = 技能设计台分页定义.find(定义 => (定义.标题集 || []).includes(标题) || (标记 && (定义.标记集 || []).includes(标记)));
    return 页 ? 页.名称 : '';
  }
  const 是造物 = form => normalizeSkillUiText(form && form.deliveryForm, '') === '造物承载';
  const 设计台分区定义 = [
    { id: 'basic', title: () => '基础框架载体', hintKey: '基础框架载体', visible: () => true },
    { id: 'fusion', title: () => '融合对象', hintKey: '', visible: (form, meta) => meta.scope === '武魂融合技' },
    { id: 'artProgress', title: () => '功法进度', hintKey: '', visible: (form, meta) => meta.scope === 'art' && ((form && form.name) || meta.label) === '紫极魔瞳' },
    { id: 'construct', title: () => '实体凝结参数', hintKey: '', visible: form => 是造物(form) },
    // 模板标题「核心术式阵列 / 使用效果阵列」；挂载后 syncDeliverySections 把文本改成「原型设计 / 使用效果」，说明改走 title 属性
    { id: 'prototypes', title: form => (是造物(form) ? '使用效果' : '原型设计'), templateTitle: form => (是造物(form) ? '使用效果阵列' : '核心术式阵列'), hintKey: form => (是造物(form) ? '使用效果阵列' : '核心术式阵列'), marker: '[data-skill-designer-prototype-title]', visible: () => true },
    { id: 'sideEffects', title: form => (是造物(form) ? '施展副作用' : '副作用'), hintKey: '', marker: '[data-skill-designer-side-effect-title]', visible: () => true },
    { id: 'energy', title: () => '运转能量配置', hintKey: '运转能量配置', visible: () => true },
    { id: 'mastery', title: () => '技能掌控度', hintKey: '技能掌控度', visible: () => true },
    { id: 'attributes', title: () => '元属性特征', hintKey: '元属性特征', visible: () => true },
    { id: 'terminal', title: () => '终端解析图谱', hintKey: '终端解析图谱', visible: () => true },
  ];
  function 设计台分区列表(form = {}, meta = {}, 标题提示表 = {}) {
    return 设计台分区定义.map(定义 => {
      const title = 定义.title(form, meta);
      const 模板标题 = 定义.templateTitle ? 定义.templateTitle(form, meta) : title;
      const 提示键 = typeof 定义.hintKey === 'function' ? 定义.hintKey(form, meta) : 定义.hintKey;
      return { id: 定义.id, title, templateTitle: 模板标题, tab: 读取分区页名(模板标题, 定义.marker), hint: (提示键 && 标题提示表[提示键]) || '', visible: !!定义.visible(form, meta) };
    });
  }
  function 顶层字段描述(vf, form, previewMeta) {
    // 各分区内字段（值取挂载后的虚拟控件）。原版顶层字段没有逐项说明徽标，只有分区标题说明
    const T = vf.top;
    const L = vf.scopeLabels;
    const 字段 = (key, label, 控件, 附加 = {}) => (控件 ? { ...导出控件({ ...控件, key, label, hint: '' }), ...附加, key, label } : null);
    const 启用被动 = 技能设计台启用被动(previewMeta, form);
    const 被动周期 = normalizeSkillUiText(T.被动触发周期.value, '无限制');
    const 使用周期 = normalizeSkillUiText(T.使用限制周期.value, '无限制');
    const costType = normalizeSkillUiText(T.costType.value, '无');
    const 显示资源 = 资源 => costType === 资源 || costType === '混合';
    const 掌控显示 = 技能设计台启用技能掌控度(previewMeta, form);
    return {
      basic: [
        字段('name', L.nameFieldLabel, T.name),
        字段('deliveryForm', '承载方式', T.deliveryForm, { typeDisplay: T.typeDisplay, typeValue: T.type.value }),
        字段('使用限制周期', '使用限制', T.使用限制周期),
        字段('使用限制次数', '限制次数', T.使用限制次数, { visible: 使用周期 !== '无限制', disabled: 使用周期 === '无限制' }),
        字段('启用被动', '被动', T.启用被动, { title: '被动技能' }),
        字段('被动触发', '触发时机', T.被动触发, { visible: 启用被动 }),
        字段('被动触发周期', '次数周期', T.被动触发周期, { visible: 启用被动 }),
        字段('被动触发次数', '触发次数', T.被动触发次数, { visible: 启用被动 && 被动周期 !== '无限制' }),
      ].filter(Boolean),
      fusion: vf.isFusion
        ? [
            字段('用法模式', '用法', T.用法模式),
            字段('fusionMode', '模式', T.fusionMode),
            {
              key: 'fusionParticipants', kind: 'fusionParticipants', label: '融合对象', hint: '', visible: true,
              canAdd: normalizeSkillUiText(T.fusionMode && T.fusionMode.value, '') !== 'self',
              rows: (T.fusionParticipants || []).map(行 => ({ role: 行.role, removable: 行.removable, char: 导出控件({ ...行.char, key: 'char', label: '角色' }), spirit: 导出控件({ ...行.spirit, key: 'spirit', label: '武魂' }) })),
            },
          ].filter(Boolean)
        : [],
      artProgress: T.artStage ? [字段('artStage', '境界', T.artStage), 字段('artLevel', '等级', T.artLevel)] : [],
      construct: [
        字段('constructItemCount', '数量', T.constructItemCount),
        { ...导出控件(T.constructDurationTick), key: 'constructDurationTick', label: '有效期' },
        字段('constructDescription', '物品描述', T.constructDescription),
      ],
      energy: [
        字段('costType', '消耗资源', T.costType, { group: '启动消耗 / 维持重扫' }),
        ...SKILL_DESIGNER_COST_RESOURCE_KEYS.map(资源 => 字段(`cost.${资源}`, `${资源}消耗`, T.costValues[资源], { visible: 显示资源(资源), resource: 资源, badge: 资源 === '魂力' && T.fixedCostRatio > 0 ? `结算${(T.fixedCostRatio * 100).toFixed(0)}%` : '' })),
        ...SKILL_DESIGNER_COST_RESOURCE_KEYS.map(资源 => 字段(`sustain.${资源}`, `${资源}维持`, T.sustainValues[资源], { visible: 显示资源(资源), resource: 资源 })),
        字段('前摇', '前摇', T.前摇),
      ],
      mastery: [
        字段('启用技能掌控度', '技能掌控度', T.启用技能掌控度, { title: '技能掌控度' }),
        字段('技能掌控度中心等级', '中心等级', T.技能掌控度中心等级, { visible: 掌控显示 }),
        字段('技能掌控度圆满等级', '圆满等级', T.技能掌控度圆满等级, { visible: 掌控显示 }),
      ],
      attributes: [{ key: 'attachedAttributes', kind: 'multi', multiple: true, label: '附带属性', hint: '', visible: true, options: 导出选项(T.attachedAttributes.options), selected: T.attachedAttributes.selected.slice() }],
      terminal: [字段('visualDesc', L.visualLabel, T.visualDesc), 字段('effectDesc', L.effectLabel, T.effectDesc)],
    };
  }

  // ───────────── 12. 定位（路径 = 效果内路径） ─────────────
  // 行路径：[i] 主列表第 i 行；[i, '授予效果', j] 嵌套列表；[i, '条件分支', b, '替换效果'|'追加效果', j] 分支效果
  function 定位列表(vf, 路径 = []) {
    let rows = vf.rows;
    let 结果 = { rows };
    let i = 0;
    while (i < 路径.length) {
      const 行 = rows[路径[i]];
      if (!行) throw new Error(`路径无效：${JSON.stringify(路径)}`);
      const 键 = 路径[i + 1];
      if (键 === undefined) return { ...结果, rows, row: 行 };
      if (键 === '条件分支') {
        const 块 = 行.fields.find(c => c.kind === 'branch');
        const 条目 = 块 && 块.branches[路径[i + 2]];
        if (!条目) throw new Error(`条件分支不存在：${JSON.stringify(路径)}`);
        const 类别 = 路径[i + 3];
        if (类别 === undefined) return { rows, row: 行, block: 块, entry: 条目 };
        rows = 条目.effects[类别].rows;
        结果 = { rows, entry: 条目, kind: 类别, parentRow: 行 };
        i += 4;
        continue;
      }
      const 嵌套 = 行.fields.find(c => c.kind === 'nested' && c.key === 键);
      if (!嵌套) throw new Error(`嵌套列表不存在：${键}`);
      rows = 嵌套.rows;
      结果 = { rows, nested: 嵌套, parentRow: 行 };
      i += 2;
    }
    return 结果;
  }
  function 定位行(vf, 路径) {
    const 结果 = 定位列表(vf, 路径);
    if (!结果.row) throw new Error(`行不存在：${JSON.stringify(路径)}`);
    return 结果;
  }
  function 行内控件(行, key) {
    for (const 控件 of 行.fields) {
      if (控件.kind === 'scaling' || 控件.kind === 'group') { const 命中 = 控件.controls.find(c => c.key === key); if (命中) return 命中; }
      else if (控件.key === key && 控件.kind !== 'nested' && 控件.kind !== 'branch') return 控件;
    }
    return null;
  }
  function 同步tick(控件, parts = {}) {
    // ≙ syncTimeParts
    const 取值 = (k, fallback = 0) => parseSkillDesignerIntegerInputValue(parts[k], fallback, 0);
    const 最小tick = Math.max(0, parseSkillDesignerIntegerInputValue(控件.minTick, 0, 0));
    const 最大tick = Math.max(0, parseSkillDesignerIntegerInputValue(控件.maxTick, 0, 0));
    const 总分钟 = Math.max(0, 取值('日') * 1440 + 取值('时') * 60 + 取值('分'));
    const 原始tick = 总分钟 > 0 ? Math.ceil(总分钟 / 技能设计台每tick分钟) : 0;
    const tick = 最大tick > 0 ? Math.max(最小tick, Math.min(最大tick, 原始tick)) : Math.max(最小tick, 原始tick);
    const 显示 = 拆分技能设计台tick时长(tick, { 最小tick, 最大tick, 默认tick: 最小tick });
    控件.parts = { 日: 显示.日, 时: 显示.小时, 分: 显示.分钟 };
    控件.tick = tick;
    控件.value = String(tick);
  }
  function 写控件(控件, 值, 选项 = {}) {
    if (!控件) throw new Error('控件不存在');
    if (控件.kind === 'tick') {
      // 传 {日,时,分} 按 syncTimeParts 折算；传数字视为 tick
      同步tick(控件, 值 && typeof 值 === 'object' ? 值 : { 分: Math.max(0, parseSkillDesignerIntegerInputValue(值, 0, 0)) * 技能设计台每tick分钟 });
      return;
    }
    if (控件.kind === 'bool') { 控件.value = !!值; return; }
    if (控件.kind === 'multi') {
      const 列表 = (Array.isArray(值) ? 值 : 读取技能设计台多枚举值(值)).map(v => toText(v, '').trim()).filter(Boolean);
      const 可选 = (控件.options || []).map(项 => 项.value);
      控件.selected = 可选.filter(v => 列表.includes(v));
      控件.value = 控件.selected.join('|');
      控件.summary = 控件.selected.length ? 控件.selected.join('、') : '未选择';
      return;
    }
    let 文本 = String(值 == null ? '' : 值);
    if (控件.positiveOnly && !选项.raw) 文本 = 文本.replace(/^-+/, '');
    设控件值(控件, 文本);
  }

  // ───────────── 13. 交互动作 ≙ handleChange / handleClick ─────────────
  const 设计台重建字段键 = ['目标', '状态', '来源', '去向', '匹配原型', '选择', '触发条件', '触发方式', '延迟回合', '规则', '判断', '生效方式', '发动方式', '攻击段数', '结算', '数值', '调整字段', '调整方式', '位移类型', '复制类型'];
  function 执行动作(vf, 动作, previewMeta, snapshot) {
    const 类型 = 动作 && 动作.type;
    const 刷新位移摘要 = 行 => {
      const 控件 = 行内控件(行, '位移类型');
      if (控件) 控件.summary = 技能设计台位移执行摘要({ 位移类型: 原型行字段值(行, '位移类型'), 位移对象: 原型行字段值(行, '位移对象'), 距离: 原型行字段值(行, '距离'), 数值: 原型行字段值(行, '数值') });
    };
    const 刷新状态摘要 = 行 => {
      const 控件 = 行内控件(行, '状态');
      if (控件 && 行.prototypeSelect.value === '状态施加') 控件.summary = 技能设计台状态摘要({ 状态: 原型行字段值(行, '状态'), 数值: 原型行字段值(行, '数值'), 副数值: 原型行字段值(行, '副数值'), 触发方式: 原型行字段值(行, '触发方式'), 延迟回合: 原型行字段值(行, '延迟回合') });
    };
    // ≙ syncFusionFields / applyFusionParticipants：按种子重绘参与者行，并以 buildSkillDesignerFormStateFromDraft 结果刷新预览
    const 刷新融合行 = (覆盖 = {}) => {
      const formState = 读取虚拟表单(vf, previewMeta);
      const fusionSeed = getSkillDesignerFusionDraftSeed(snapshot, previewMeta, { ...formState, ...覆盖 });
      vf.top.fusionParticipants = 描述融合参与者行(fusionSeed.fusionParticipants, snapshot.rootData, previewMeta);
      vf.__post = { refresh: buildSkillDesignerFormStateFromDraft({ ...formState, ...fusionSeed }, previewMeta) };
    };
    if (类型 === 'top') {
      const key = 动作.key;
      if (/^cost\./.test(key)) return 写控件(vf.top.costValues[key.slice(5)], 动作.value);
      if (/^sustain\./.test(key)) return 写控件(vf.top.sustainValues[key.slice(8)], 动作.value);
      if (key === 'attachedAttributes') return 写控件(vf.top.attachedAttributes, 动作.value);
      if (key === 'constructDurationTick') return 写控件(vf.top.constructDurationTick, 动作.value);
      const 控件 = vf.top[key];
      if (!控件 || typeof 控件 !== 'object') throw new Error(`未知字段：${key}`);
      写控件(控件, 动作.value);
      if (key === 'name') {
        const 真身名称 = 规范第七魂环真身名称_桥接(控件.value, previewMeta);
        if (真身名称 && 控件.value !== 真身名称) 控件.value = 真身名称;
      }
      if (key === 'fusionMode') 刷新融合行();
      if (key === 'deliveryForm') vf.__post = { rebuildMain: 'reread', refresh: 'reread' }; // ≙ rebuildPrototypeGrid(syncDraftCache())
      return;
    }
    if (类型 === 'fusionParticipant') {
      const 行 = vf.top.fusionParticipants[动作.index];
      if (!行) throw new Error('融合对象行不存在');
      写控件(动作.key === 'spirit' ? 行.spirit : 行.char, 动作.value);
      if (动作.key !== 'spirit') 刷新融合行();
      return;
    }
    if (类型 === 'fusionAdd' || 类型 === 'fusionRemove') {
      if (!vf.top.fusionMode) return;
      if (类型 === 'fusionAdd') 写控件(vf.top.fusionMode, 'partner');
      const 当前 = 同步草稿(vf, previewMeta, snapshot);
      const 参与者 = 类型 === 'fusionAdd'
        ? [...当前.fusionParticipants, createSkillDesignerDefaultPartnerParticipant(snapshot.rootData, previewMeta, 当前.fusionParticipants.map(p => p.charKey))]
        : 当前.fusionParticipants.filter((p, i) => i !== 动作.index);
      刷新融合行({ fusionMode: vf.top.fusionMode.value, fusionParticipants: 参与者 });
      return;
    }
    if (类型 === 'prototype') {
      const { row } = 定位行(vf, 动作.path);
      写控件(row.prototypeSelect, 动作.value);
      重建原型行(row);
      同步原型行默认驱动判定(row);
      return;
    }
    if (类型 === 'effectField' || 类型 === 'unit' || 类型 === 'objectField') {
      const { row } = 定位行(vf, 动作.path);
      const 控件 = 行内控件(row, 类型 === 'objectField' ? '抹消对象' : 动作.key);
      if (!控件) throw new Error(`该行没有字段：${动作.key || '抹消对象'}`);
      if (类型 === 'unit') {
        // ≙ 同步技能设计台数值单位选择
        if (!控件.unit || 控件.unit.locked) return;
        控件.unit.value = ['点数', '百分比'].includes(动作.unit) ? 动作.unit : '';
        控件.value = 格式化技能设计台单位数值(控件.value, normalizeSkillUiText(控件.unit.value, '点数'));
        return;
      }
      if (类型 === 'objectField') {
        // 抹消对象子字段 ≙ handleChange 的 suppress-object 分支
        const sub = 控件.subfields.find(c => c.key === 动作.key);
        if (!sub) throw new Error(`抹消对象没有子字段：${动作.key}`);
        if (动作.key === '原型') {
          写控件(sub, 动作.value);
          const 当前目标 = normalizeSkillUiText((行字段控件(row, '目标') || {}).value, '单体');
          const 新效果 = { 原型: '机制抹消', 目标: 当前目标, 抹消对象: { 原型: sub.value } };
          const 编辑 = 描述原型字段编辑器(新效果, { 当前效果: 新效果 });
          row.fields = 编辑.controls; row.__effect = 编辑.当前效果; 绑定子网格(row);
          const 新控件 = 行内控件(row, '抹消对象');
          if (新控件) { 新控件.value = 规范化技能设计台机制抹消对象({ 原型: sub.value }); 新控件.json = JSON.stringify(新控件.value); }
          return;
        }
        if (sub.kind === 'multi') {
          let 列表 = (Array.isArray(动作.value) ? 动作.value : [动作.value]).map(v => normalizeSkillUiText(v, '')).filter(Boolean);
          if (列表.some(v => 技能设计台机制抹消全部字段值.has(v))) 列表 = sub.options.filter(o => 技能设计台机制抹消全部字段值.has(normalizeSkillUiText(o.value, ''))).map(o => o.value);
          sub.options.forEach(o => { o.selected = 列表.includes(o.value); });
          sub.selected = sub.options.filter(o => o.selected).map(o => o.value);
        } else 写控件(sub, 动作.value);
        const 对象 = {};
        控件.subfields.forEach(c => {
          const 值 = c.kind === 'multi' ? c.options.filter(o => o.selected).map(o => normalizeSkillUiText(o.value, '')) : normalizeSkillUiText(c.value, '');
          if (c.key && 值 && 值 !== '无') 对象[c.key] = 值;
        });
        if (!对象['原型']) 对象['原型'] = '机制授予';
        控件.value = 规范化技能设计台机制抹消对象(对象);
        控件.json = JSON.stringify(控件.value);
        return;
      }
      写控件(控件, 动作.value);
      if (控件.scalingDriver) { const 块 = row.fields.find(c => c.kind === 'scaling'); if (块) 同步缩放块(块, row); }
      if (设计台重建字段键.includes(动作.key)) 重建原型行(row);
      if (动作.key === '持续回合') { const 块 = row.fields.find(c => c.kind === 'scaling'); if (块) 同步缩放块(块, row); }
      if (['位移类型', '位移对象', '距离', '数值'].includes(动作.key)) 刷新位移摘要(row);
      if (['状态', '数值', '副数值', '触发方式', '延迟回合'].includes(动作.key)) 刷新状态摘要(row);
      同步原型行默认驱动判定(row);
      return;
    }
    if (类型 === 'addEffect') {
      const 列表路径 = Array.isArray(动作.path) ? 动作.path : [];
      if (!列表路径.length) {
        // 主列表 ≙ addPrototype：以同步草稿 + 新效果重建整列
        const 当前 = 同步草稿(vf, previewMeta, snapshot);
        const 首个原型 = 读取技能设计台原型名称列表()[0] || '伤害结算';
        const 新效果 = 技能设计台清理并水合原型效果({ 原型: 首个原型 }, 当前.target, {});
        if (Array.isArray(当前.prototypeEffects) && 当前.prototypeEffects.length > 0) 新效果['生效方式'] = '独立生效';
        const 下一草稿 = { ...当前, prototypeEffects: [...规范化技能设计台原型效果列表(当前.prototypeEffects, 当前.target), 新效果] };
        vf.__post = { rebuildMain: 下一草稿, refresh: 下一草稿 };
        return;
      }
      const 定位 = 定位列表(vf, 列表路径);
      const 网格 = 定位.rows.__grid;
      const 父行 = 定位.parentRow;
      const 目标值 = normalizeSkillUiText((父行 && (行字段控件(父行, '目标') || {}).value) || '', '单体');
      let 新行;
      if (定位.entry) {
        // ≙ addConditionEffect
        const 禁用 = 技能设计台条件列表包含释放后条件([...条目内条件行(定位.entry)].map(({ cond }) => ({ 类型: cond.类型.value })));
        const 新效果 = 技能设计台清理并水合原型效果({ 原型: '伤害结算', 生效方式: '独立生效' }, 目标值, { 强制独立: true, 禁用释放前降低结算: 禁用 });
        新行 = 描述原型效果行列表([新效果], 目标值, true, { 禁用条件分支: true, 强制独立: true, 禁用释放前降低结算: 禁用 }, { name: 网格.name, allowEmpty: true, conditionEffect: true })[0];
      } else {
        // ≙ addNestedPrototype
        const 嵌套字段 = normalizeSkillUiText(定位.nested && 定位.nested.key, '');
        const 新效果 = 技能设计台清理并水合原型效果({ 原型: (定位.nested && 定位.nested.defaultPrototype) || '判定修正', 生效方式: '独立生效' }, '单体', { 嵌套字段, 强制独立: true });
        新行 = 描述原型效果行列表([新效果], '单体', true, { 嵌套字段, 强制独立: true }, { name: 'nested', nestedKind: 嵌套字段, allowEmpty: true })[0];
      }
      新行.__grid = 网格; 网格.rows.push(新行);
      if (父行) Object.defineProperty(新行, '__parentRow', { value: 父行, writable: true, enumerable: false });
      return;
    }
    if (类型 === 'removeEffect') {
      const { rows, row } = 定位行(vf, 动作.path);
      const 网格 = rows.__grid || {};
      const 允许空 = 网格.name === 'side' || !!网格.allowEmpty;
      if (rows.length > (允许空 ? 0 : 1)) {
        rows.splice(rows.indexOf(row), 1);
        const 下一草稿 = 同步草稿(vf, previewMeta, snapshot);
        vf.__post = 网格.name === 'main' ? { rebuildMain: 下一草稿, refresh: 下一草稿 } : { refresh: 下一草稿 };
      }
      return;
    }
    if (['branchEnabled', 'addBranch', 'removeBranch', 'branchAction', 'addCondition', 'removeCondition', 'conditionField'].includes(类型)) {
      const { row } = 定位行(vf, 动作.path);
      const 块 = row.fields.find(c => c.kind === 'branch');
      if (!块) throw new Error('该行没有条件分支');
      const 目标值 = normalizeSkillUiText((行字段控件(row, '目标') || {}).value, '单体');
      const 新条目 = () => { const 条目 = 描述条件分支条目编辑器(创建技能设计台默认条件分支(目标值), 目标值); 绑定分支条目(条目, row); return 条目; };
      if (类型 === 'branchEnabled') {
        块.enabled = !!动作.value;
        if (块.enabled && !块.branches.length) { const 条目 = 新条目(); 块.branches.push(条目); 条目.conditions.slice().forEach(c => 同步条件行(c, 条目)); }
        return;
      }
      if (类型 === 'addBranch') { 块.branches.push(新条目()); return; }
      const 条目 = 块.branches[动作.branch];
      if (!条目) throw new Error('条件分支条目不存在');
      if (类型 === 'removeBranch') { 块.branches.splice(动作.branch, 1); return; }
      if (类型 === 'branchAction') {
        写控件(条目.action, 动作.value);
        const 处理 = normalizeSkillUiText(条目.action.value, '替换效果');
        ['替换效果', '追加效果'].forEach(键 => { 条目.effects[键].hidden = 键 !== 处理; });
        return;
      }
      if (类型 === 'addCondition') {
        条目.conditions.push(描述条件分支条件编辑器({ 类型: '生命比例', 对象: '目标', 比较: '<=', 值: '20%' }, true));
        条目.conditions.forEach(c => { c.removable = true; });
        同步条件行(条目.conditions[条目.conditions.length - 1], 条目);
        return;
      }
      const 条件 = 条目.conditions[动作.index];
      if (!条件) throw new Error('条件不存在');
      if (类型 === 'removeCondition') {
        const 数量 = 条目.conditions.length;
        if (数量 > 1) 条目.conditions.splice(动作.index, 1);
        if (数量 === 2) 条目.conditions.forEach(c => { c.removable = false; });
        return;
      }
      const 字段控件 = 动作.key === '类型' ? 条件.类型 : 动作.key === '比较' ? (条件.比较 || 条件.比较隐藏) : 动作.key === '值' ? 条件.值 && 条件.值.control : 动作.key === '状态' ? 条件.状态 : null;
      if (!字段控件) throw new Error(`条件没有字段：${动作.key}`);
      写控件(字段控件, 动作.value);
      if (['类型', '比较'].includes(动作.key)) 同步条件行(条件, 条目);
      return;
    }
    if (类型 === 'addSideEffect') {
      const 当前 = 同步草稿(vf, previewMeta, snapshot);
      const 下一列表 = [...规范化技能设计台副作用列表(当前['副作用列表']), 创建技能设计台默认副作用条目('自损反噬', { 生效对象: 读取技能设计台默认副作用对象(当前, '施展') })];
      vf.sideEffects = 描述副作用行列表(下一列表, { 字段名: '副作用列表' });
      vf.__post = { refresh: { ...当前, 副作用列表: 下一列表 } };
      return;
    }
    if (类型 === 'removeSideEffect') {
      vf.sideEffects.splice(动作.index, 1);
      const 下一草稿 = 同步草稿(vf, previewMeta, snapshot);
      vf.sideEffects = 描述副作用行列表(下一草稿['副作用列表'], { 字段名: '副作用列表' });
      vf.__post = { refresh: 下一草稿 };
      return;
    }
    if (类型 === 'sideEffectField') {
      const 行 = vf.sideEffects[动作.index];
      if (!行) throw new Error('副作用行不存在');
      const 控件 = 行.fields.find(c => c.key === 动作.key);
      if (!控件) throw new Error(`副作用没有字段：${动作.key}`);
      写控件(控件, 动作.value);
      if (动作.key === '副作用类型') {
        // ≙ syncSideEffectRow：按新类型规范化后重绘该行
        const 当前 = {};
        行.fields.forEach(c => { 当前[c.key] = normalizeSkillUiText(c.value, ''); });
        const 下一 = 规范化技能设计台副作用条目(当前, () => {}) || 创建技能设计台默认副作用条目();
        vf.sideEffects[动作.index] = 描述副作用行(下一, 行.scope);
      } else {
        const 时机 = normalizeSkillUiText((行.fields.find(c => c.key === '触发时机') || {}).value, '效果生效后');
        const 关联 = 行.fields.find(c => c.key === '关联状态');
        if (关联) 关联.hidden = 时机 !== '效果结束后';
      }
      return;
    }
    throw new Error(`未知动作：${类型}`);
  }

  // ───────────── 14. 公共 API ─────────────
  // 物品技能（装备 / 魂骨附带）：运行时只认承载方式「被动」为物品被动（MVU_Skill_Runtime 读取物品被动技能条目_V1），
  // 原版设计台却只有「直接生效 / 造物承载」+ 战斗被动开关，存一次物品被动就变成要手动施放的技能。
  // 规则开关打开时：设计台「被动」开关 ⇔ 承载方式「被动」。战斗技能不受影响。
  const 是物品技能范围 = previewMeta => ['equipment_skill', 'soul_bone_skill'].includes(normalizeSkillUiText(previewMeta && previewMeta.scope, ''));
  // 被动技能修复方案 2026-11-12：角色自己的被动（非物品：血脉被动、自创魂技等）原先存成「直接生效」且不写触发时机——战斗把它
  // 当主动技能放，当被动又永不触发（与金龙王 9/11/16 层同病）。规则开关打开时：「被动」开关 ⇔ 承载方式「被动」，并把所选
  // 「触发时机」写进技能级与各效果（效果自带的延迟/遥控等时机不动）；含死亡转存活的走复活通道，只给其余效果写时机。
  // 「常驻」只有物品被动认（物品消费者），角色被动选它写不出时机，战斗开局会记 PASSIVE_NEVER_TRIGGERS。
  function 战斗被动承载与时机(skill, previewMeta, formState) {
    if (!skill || !设计台规则.角色被动存为被动 || 是物品技能范围(previewMeta) || !技能设计台启用被动(previewMeta, formState)) return skill;
    skill.承载方式 = '被动';
    const 时机 = 规范化技能设计台被动触发(formState && formState.被动触发);
    if (!时机 || 时机 === '常驻') return skill;
    const 效果列表 = Array.isArray(skill._效果数组) ? skill._效果数组 : [];
    const 含复活 = 效果列表.some(effect => 技能设计台效果是自身死亡转存活(effect));
    if (!含复活) skill.触发方式 = 时机;
    效果列表.forEach(effect => {
      if (!effect || typeof effect !== 'object' || !normalizeSkillUiText(effect.原型, '') || 技能设计台效果是自身死亡转存活(effect)) return;
      const 自带 = normalizeSkillUiText(effect.触发方式, '');
      if (!自带 || 自带 === '立即触发') effect.触发方式 = 时机;
    });
    return skill;
  }
  function 物品被动承载(skill, previewMeta, formState) {
    if (skill && 设计台规则.物品被动保持承载方式 && 是物品技能范围(previewMeta) && 技能设计台启用被动(previewMeta, formState)) skill.承载方式 = '被动';
    return 战斗被动承载与时机(skill, previewMeta, formState);
  }
  function 设计台准备(meta, root) {
    const previewMeta = 设计台规范元数据(meta);
    const snapshot = 设计台使用快照(root, previewMeta);
    return { previewMeta, snapshot };
  }
  function 设计台原始草稿(skill, previewMeta, snapshot) {
    const skillSource = skill && typeof skill === 'object'
      ? skill
      : previewMeta.path.length ? deepGet(snapshot.rootData, previewMeta.path, {}) || {} : {};
    const rawDesignerDraft = readSkillDesignerDraft(skillSource, previewMeta.label, previewMeta);
    // 规则开关：物品技能承载方式「被动」→ 打开时「被动」开关为开（原版设计台没有被动承载，见 物品被动承载）
    if (设计台规则.物品被动保持承载方式 && 是物品技能范围(previewMeta) && normalizeSkillUiText(skillSource.承载方式, '') === '被动' && !normalizeSkillUiText(rawDesignerDraft.启用被动, ''))
      rawDesignerDraft.启用被动 = '启用';
    // 角色被动（战斗被动承载与时机）：存成「被动」的读回来仍是被动，所选时机读技能级（或首个效果级）触发方式。
    if (设计台规则.角色被动存为被动 && !是物品技能范围(previewMeta) && normalizeSkillUiText(skillSource.承载方式, '') === '被动') {
      if (!normalizeSkillUiText(rawDesignerDraft.启用被动, '')) rawDesignerDraft.启用被动 = '启用';
      const 存档时机 = 规范化技能设计台被动触发(skillSource.触发方式) ||
        (Array.isArray(skillSource._效果数组) ? skillSource._效果数组 : []).map(effect => 规范化技能设计台被动触发(effect && effect.触发方式)).find(Boolean) || '';
      if (存档时机) rawDesignerDraft.被动触发 = 存档时机;
    }
    const fusionDraftSeed = getSkillDesignerFusionDraftSeed(snapshot, previewMeta, rawDesignerDraft);
    return { skillSource, rawDesignerDraft, designerDraft: buildSkillDesignerFormStateFromDraft({ ...rawDesignerDraft, ...fusionDraftSeed }, previewMeta) };
  }
  function 读取COST助手() {
    return (typeof globalThis !== 'undefined' && globalThis.__LWCS_SKILL_COST_HELPERS_V1__)
      || (typeof window !== 'undefined' && window.__LWCS_SKILL_COST_HELPERS_V1__)
      || null;
  }
  // 动作执行后的收尾 ≙ rebuildPrototypeGrid(按需) + refreshPreview（类型隐藏值、承载下拉）
  function 动作后刷新(vf, previewMeta, snapshot) {
    const post = vf.__post || {};
    vf.__post = null;
    if (post.rebuildMain) {
      const 重建草稿 = post.rebuildMain === 'reread' ? 同步草稿(vf, previewMeta, snapshot) : post.rebuildMain;
      vf.rows = 描述原型效果行列表(重建草稿.prototypeEffects, 重建草稿.target, false, { 固定首个独立生效: true }, { name: 'main' });
    }
    const 草稿 = post.refresh && post.refresh !== 'reread' ? post.refresh : 同步草稿(vf, previewMeta, snapshot);
    vf.top.type.value = 属性回读(草稿.type || '输出');
    vf.top.typeDisplay = 文本回读(草稿.typeDisplay || 草稿.type || '输出');
    重建承载下拉(vf);
    return 草稿;
  }
  // ≙ handleSubmit：回读 → buildSkillDesignerUpdatedSkill → COST 截断/分支约束/预算断言 → 写回更新列表
  function 设计台保存(form, meta, baseSkill, root, 选项 = {}) {
    const { previewMeta, snapshot } = 设计台准备(meta, root);
    let vf = null;
    try { vf = 渲染并挂载(form, previewMeta, snapshot); } catch (error) { return { ok: false, skill: null, updates: [], messages: [{ level: 'error', text: error && error.message ? error.message : '技能设计写回失败。' }], formState: null }; }
    return 保存核心(vf, previewMeta, snapshot, baseSkill, 选项);
  }
  function 保存核心(vf, previewMeta, snapshot, baseSkill, 选项 = {}) {
    const messages = [];
    const 结果 = { ok: false, skill: null, updates: [], messages, formState: null };
    try {
      if (!Array.isArray(previewMeta.path) || !previewMeta.path.length) throw new Error('当前技能缺少可写回路径。');
      结果.formStateIdle = 读取虚拟表单(vf, previewMeta);
      设计台回读忙碌态 = 选项.keepConditionBranches !== true;
      let formState;
      try { formState = 读取虚拟表单(vf, previewMeta); } finally { 设计台回读忙碌态 = false; }
      结果.formState = formState;
      const skillSource = baseSkill && typeof baseSkill === 'object' ? baseSkill : deepGet(snapshot.rootData, previewMeta.path, {}) || {};
      const nextSkill = 物品被动承载(buildSkillDesignerUpdatedSkill(skillSource, formState, previewMeta, snapshot.rootData), previewMeta, formState);
      结果.skill = nextSkill;
      const COST助手 = 读取COST助手();
      if (COST助手 && typeof COST助手.评估技能预算_V1 === 'function') {
        const 预算上下文 = 构建技能设计台预算上下文(previewMeta, snapshot.rootData || {}, formState || {});
        const 魂技位 = Math.max(1, Number(previewMeta?.__魂环位 || 预算上下文.魂环位 || 1) || 1);
        const 来源标识 = (() => {
          const 路径 = Array.isArray(previewMeta.path) ? previewMeta.path : [];
          if (路径.includes('武魂融合技')) return '武魂融合技';
          if (路径.includes('魂骨')) return '魂骨技能';
          if (路径.includes('自创魂技')) return '自创魂技';
          return '魂技';
        })();
        if (typeof COST助手.按原型数上限截断_V1 === 'function') {
          const 截断结果 = COST助手.按原型数上限截断_V1(nextSkill, 魂技位, 来源标识);
          if (截断结果?.截断记录) {
            const 记录 = 截断结果.截断记录;
            messages.push({ level: 'warn', title: '原型数超限', text: `效果原型数 ${记录.原数量} 超过该魂技位上限 ${记录.上限}，已截断；丢弃 ${记录.丢弃数} 项: ${记录.丢弃原型.join('、') || '无'}` });
          }
        }
        if (typeof COST助手.条件分支约束_V1 === 'function') {
          const 分支统计 = COST助手.条件分支约束_V1(nextSkill);
          if (分支统计 && (分支统计.截断分支 > 0 || 分支统计.拍平层 > 0 || 分支统计.合并对 > 0)) {
            messages.push({ level: 'warn', title: '条件分支约束', text: `条件分支已规整：截断 ${分支统计.截断分支} 个、拍平嵌套 ${分支统计.拍平层} 层、近似合并 ${分支统计.合并对} 对` });
          }
        }
        // 供界面显示：与保存断言同一技能、同一上下文的预算求值（只读，不改变保存行为）
        try { 结果.budget = COST助手.评估技能预算_V1(nextSkill, { ...预算上下文, path: previewMeta.path, 魂环位: 魂技位, 来源: 预算上下文.来源类别, 启用位级硬上限: true }); } catch (error) { 结果.budget = null; }
        if (选项.跳过预算断言 !== true) {
          if (typeof COST助手.断言技能预算_V1 !== 'function') throw new Error('技能预算断言不可用');
          COST助手.断言技能预算_V1(nextSkill, {
            ...预算上下文,
            path: previewMeta.path,
            魂环位: 魂技位,
            来源: 预算上下文.来源类别,
            启用位级硬上限: true,
          }, normalizeSkillUiText(previewMeta.label || formState.name || '技能设计', '技能设计'));
        }
      }
      if (选项.跳过预算断言 !== true) 结果.updates = buildSkillDesignerWriteUpdates(previewMeta, nextSkill, snapshot.rootData);
      结果.ok = true;
    } catch (error) {
      messages.push({ level: 'error', text: error && error.message ? error.message : '技能设计写回失败。' });
    }
    return 结果;
  }
  function 设计台动作(form, 动作, meta, root) {
    // 无状态：从 form 渲染并挂载一次，按顺序执行全部动作（同一份虚拟 DOM），返回 refreshPreview 所用草稿
    const { previewMeta, snapshot } = 设计台准备(meta, root);
    const vf = 渲染并挂载(form, previewMeta, snapshot);
    let 草稿 = form;
    (Array.isArray(动作) ? 动作 : [动作]).forEach(单个 => { 执行动作(vf, 单个, previewMeta, snapshot); 草稿 = 动作后刷新(vf, previewMeta, snapshot); });
    return 草稿;
  }
  // 有状态会话：保留虚拟 DOM（≙ 原版设计台打开后的 DOM），动作之间不重渲染，与原版显示/回读同生命周期
  function 设计台会话(skill, meta, root) {
    const { previewMeta, snapshot } = 设计台准备(meta, root);
    const 起始 = 设计台原始草稿(skill, previewMeta, snapshot);
    const vf = 渲染并挂载(起始.designerDraft, previewMeta, snapshot);
    let 草稿 = 同步草稿(vf, previewMeta, snapshot);
    const 激活 = () => 设计台使用快照(snapshot.rootData, previewMeta);
    const 会话 = {
      meta: previewMeta,
      initialForm: 起始.designerDraft,
      /** 当前表单 ≙ syncDraftCache()（从虚拟 DOM 现读） */
      get form() { 激活(); return 同步草稿(vf, previewMeta, snapshot); },
      /** 最近一次 refreshPreview 实际使用的草稿（新增原型/副作用等动作原版直接用拼好的草稿刷新预览） */
      get previewForm() { return 草稿; },
      act(动作) {
        激活();
        (Array.isArray(动作) ? 动作 : [动作]).forEach(单个 => { 执行动作(vf, 单个, previewMeta, snapshot); 草稿 = 动作后刷新(vf, previewMeta, snapshot); });
        return 会话;
      },
      view() { 激活(); return 视图核心(vf, previewMeta, snapshot); },
      save(opts = {}) { 激活(); return 保存核心(vf, previewMeta, snapshot, 起始.skillSource, { keepConditionBranches: !!opts.keepConditionBranches }); },
      toSkill(opts = {}) {
        激活();
        const 结果 = 保存核心(vf, previewMeta, snapshot, 起始.skillSource, { 跳过预算断言: true, keepConditionBranches: !!opts.keepConditionBranches });
        const 错误 = 结果.messages.find(m => m.level === 'error');
        if (错误) throw new Error(错误.text);
        return 结果.skill;
      },
      validate(opts = {}) { return 会话.save(opts).messages; },
      tempSkill() { 激活(); const 表单 = 同步草稿(vf, previewMeta, snapshot); return 物品被动承载(构建技能设计台临时技能(表单, previewMeta).临时技能, previewMeta, 表单); },
      summary() { 激活(); return 构建技能设计台当前翻译摘要(同步草稿(vf, previewMeta, snapshot), previewMeta, snapshot.rootData) || '未设置'; },
    };
    return 会话;
  }
  function 设计台视图(form, meta, root) {
    const { previewMeta, snapshot } = 设计台准备(meta, root);
    return 视图核心(渲染并挂载(form, previewMeta, snapshot), previewMeta, snapshot);
  }
  function 视图核心(vf, previewMeta, snapshot) {
    const 当前草稿 = 同步草稿(vf, previewMeta, snapshot);
    const 上下文 = 设计台模板上下文(snapshot, previewMeta, 当前草稿);
    const 分区 = 设计台分区列表(当前草稿, previewMeta, 上下文.标题提示表);
    const 字段 = 顶层字段描述(vf, 当前草稿, previewMeta);
    const scopeLabels = getSkillDesignerScopeLabels(previewMeta);
    return {
      titles: scopeLabels,
      title: `${scopeLabels.studioTitle} / ${获取技能设计台当前标题(snapshot.rootData, previewMeta, deepGet(snapshot.rootData, previewMeta.path, {}) || {}) || 当前草稿.name || previewMeta.label || '未命名'}`,
      typeDisplay: vf.top.typeDisplay,
      sections: 分区.map(区 => ({ ...区, fields: 字段[区.id] || [] })),
      rows: vf.rows.map((行, i) => 导出行(行, [i])),
      emptyGuide: vf.rows.length ? null : { icon: '✦', title: '术式阵列未装配', desc: '请点击下方按钮，为该技能添加基础机制（如：伤害、判定修正、状态授予等）。您可以组合多个原型来构建复杂技能。' },
      sideEffects: vf.sideEffects.map((行, i) => ({ index: i, scope: 行.scope, summary: 行.summary, fields: 行.fields.map(c => 导出控件(c, [])) })),
      draft: 当前草稿,
      preview: {
        fusion: previewMeta.scope === '武魂融合技' ? buildSkillDesignerFusionSummary(当前草稿) || '未设置' : '',
        summary: 构建技能设计台当前翻译摘要(当前草稿, previewMeta, snapshot.rootData) || '未设置',
        progress: previewMeta.scope === 'art' ? buildSkillDesignerArtProgressSummary(当前草稿) || '未设置' : '',
        attribute: buildSkillDesignerAttributeSummary(当前草稿) || '未设置',
      },
    };
  }
  function 单行字段(effect, ctx = {}) {
    const 网格名 = ctx.grid || 'main';
    const 序号 = Math.max(0, Number(ctx.index) || 0);
    const fallbackTarget = ctx.fallbackTarget || (effect && effect['目标']) || '单体';
    const 选项 = 网格名 === 'main'
      ? { 固定首个独立生效: 序号 === 0 }
      : 网格名 === 'nested' ? { 嵌套字段: ctx.nestedKind || '', 强制独立: true } : { 禁用条件分支: true, 禁用释放前降低结算: !!ctx.禁用释放前降低结算 };
    const rows = 描述原型效果行列表([effect], fallbackTarget, 网格名 !== 'main', 选项, { name: 网格名, nestedKind: ctx.nestedKind || '', allowEmpty: 网格名 !== 'main', conditionEffect: /^condition/.test(网格名) });
    挂载同步行(rows);
    return rows.length ? 导出行(rows[0], [序号]).fields : [];
  }

  const 公共接口 = {
    version: 1,
    /** 规则开关（可改）：{ 物品被动保持承载方式 }（默认开） */
    rules: 设计台规则,
    /** 设置默认根数据（不传 root 的调用都用它；缺省回退 window.LWCS_SAVE） */
    setRoot(root) { 设计台根数据 = root && typeof root === 'object' ? root : null; },
    /** previewMeta 构造器（与原版各入口一致） */
    meta: {
      ring: (角色, 武魂槽, 魂灵槽, 魂环槽, 魂技键, label) => ({ path: ['char', 角色, 武魂槽, 魂灵槽, 魂环槽, 魂技键], label: label || 魂技键, category: '魂环魂技', scope: '魂技' }),
      independentRing: (角色, 武魂槽, 魂环槽, 魂技键, label) => ({ path: ['char', 角色, 武魂槽, 魂环槽, 魂技键], label: label || 魂技键, category: '独立魂环魂技', scope: 'independent_ring_skill' }),
      fusion: (角色, 记录键, label) => ({ path: ['char', 角色, '武魂融合技', 记录键, '技能数据'], label: label || 记录键, category: '武魂融合技', scope: '武魂融合技' }),
      art: (角色, 功法名) => ({ path: ['char', 角色, '功法', 功法名], label: 功法名, category: '功法', scope: 'art' }),
      custom: (角色, 技能键, label) => ({ path: ['char', 角色, '自创魂技', 技能键], label: label || 技能键, category: '自创魂技', scope: '自创魂技' }),
      // 血脉三类与魂骨：路径与 scope 同原版 buildBloodlineConfig / 构建技能设计台预算上下文（原版魂骨技能只在物品定义里改 JSON，这里补设计台入口）
      blood: (角色, 技能键, label) => ({ path: ['char', 角色, '血脉之力', '技能', 技能键], label: label || 技能键, category: '血脉散技', scope: 'blood_skill' }),
      bloodPassive: (角色, 技能键, label) => ({ path: ['char', 角色, '血脉之力', '被动', 技能键], label: label || 技能键, category: '血脉特性', scope: 'blood_passive' }),
      bloodRing: (角色, 环位, 魂技键, label) => ({ path: ['char', 角色, '血脉之力', 环位, 魂技键], label: label || 魂技键, category: '血脉魂环', scope: 'blood_ring_skill' }),
      bone: (角色, 槽位, 技能键, label) => ({ path: ['char', 角色, '魂骨', 槽位, '附带技能', 技能键], label: label || 技能键, category: '魂骨技能', scope: 'soul_bone_skill' }),
      // 装备技能：原版没有设计台入口（只在物品定义编辑器里裸改 JSON）。槽位可多段（魂导器 / 装配 / 一号位）；
      // 分类含「装备」→ 原版预算上下文的来源类别 = 装备技能（来源承载 1.35），预算角色 = 佩戴者
      equip: (角色, 槽位, 技能键, label) => ({ path: ['char', 角色, '装备', ...[].concat(槽位), '装备技能', 技能键], label: label || 技能键, category: '装备技能', scope: 'equipment_skill' }),
      fromPreviewKey: key => parseSkillDesignerPreviewKey(key),
      toPreviewKey: meta => buildSkillDesignerPreviewKey(设计台规范元数据(meta)),
    },
    /** 技能 → 原版初始表单 designerDraft（≙ readSkillDesignerDraft + 融合种子 + buildSkillDesignerFormStateFromDraft） */
    fromSkill(skill, meta, root) {
      const { previewMeta, snapshot } = 设计台准备(meta, root);
      return 设计台原始草稿(skill, previewMeta, snapshot).designerDraft;
    },
    /** 打开设计台后的实时表单：初始表单经「渲染 → 挂载同步 → 回读 → syncDraftCache」 */
    open(skill, meta, root) {
      const { previewMeta, snapshot } = 设计台准备(meta, root);
      const { designerDraft } = 设计台原始草稿(skill, previewMeta, snapshot);
      return 同步草稿(渲染并挂载(designerDraft, previewMeta, snapshot), previewMeta, snapshot);
    },
    /** 表单 → 原版保存的技能（只含正式字段；结构校验失败抛出原版错误文本；不做 COST 预算断言，断言见 validate/save） */
    toSkill(form, meta, baseSkill, root, opts = {}) {
      const 结果 = 设计台保存(form, meta, baseSkill, root, { 跳过预算断言: true, keepConditionBranches: !!(opts && opts.keepConditionBranches) });
      const 错误 = 结果.messages.find(m => m.level === 'error');
      if (错误) throw new Error(错误.text);
      return 结果.skill;
    },
    /** 完整保存链 ≙ handleSubmit：{ ok, skill, updates:[{path,value}], messages:[{level,text,title?}] } */
    save(form, meta, baseSkill, root, opts = {}) { return 设计台保存(form, meta, baseSkill, root, { keepConditionBranches: !!(opts && opts.keepConditionBranches) }); },
    /** ≙ 构建技能设计台临时技能（COST 引擎与试算用）；默认 live：先按原版 refreshPreview 刷新草稿 */
    tempSkill(form, meta, root, 选项 = {}) {
      const { previewMeta, snapshot } = 设计台准备(meta, root);
      const 草稿 = 选项.live === false ? form : 同步草稿(渲染并挂载(form, previewMeta, snapshot), previewMeta, snapshot);
      return 构建技能设计台临时技能(草稿, previewMeta).临时技能;
    },
    /** ≙「最终摘要」行文本（原版空串显示「未设置」） */
    summary(form, meta, root, 选项 = {}) {
      const { previewMeta, snapshot } = 设计台准备(meta, root);
      const 草稿 = 选项.live === false ? form : 同步草稿(渲染并挂载(form, previewMeta, snapshot), previewMeta, snapshot);
      return 构建技能设计台当前翻译摘要(草稿, previewMeta, snapshot.rootData) || '未设置';
    },
    /** 原版保存时的全部检查（按原版顺序，第一处错误即中止，与原版 toast 一致）：[{ level:'error'|'warn', text, title? }] */
    validate(form, meta, root, baseSkill, opts = {}) { return 设计台保存(form, meta, baseSkill, root, { keepConditionBranches: !!(opts && opts.keepConditionBranches) }).messages; },
    /** 新增原型 ≙ 点「新增原型」再把该行原型下拉切到 prototypeName；opts.path = 列表路径（[] 主列表 / [i,'授予效果'] / [i,'条件分支',b,'替换效果']） */
    newEffect(prototypeName, form, meta, root, opts = {}) {
      const 列表路径 = Array.isArray(opts.path) ? opts.path : [];
      const { previewMeta, snapshot } = 设计台准备(meta, root);
      let 下一 = 设计台动作(form, { type: 'addEffect', path: 列表路径 }, meta, root);
      const 列表 = 定位列表(渲染并挂载(下一, previewMeta, snapshot), 列表路径).rows;
      const 末行路径 = [...列表路径, Math.max(0, 列表.length - 1)];
      if (prototypeName && 列表.length && 列表[列表.length - 1].prototypeSelect.value !== prototypeName) {
        下一 = 设计台动作(下一, { type: 'prototype', path: 末行路径, value: prototypeName }, meta, root);
      }
      const 列表2 = 定位列表(渲染并挂载(下一, previewMeta, snapshot), 列表路径).rows;
      const 主列表 = !列表路径.length;
      const 效果们 = 读取虚拟行列表(列表2, 主列表 ? getSkillDesignerDefaultTarget(previewMeta, 下一.type) : '单体', 主列表 ? 'main' : '', !主列表, 主列表 ? {} : { 强制独立: true });
      return { effect: 效果们[效果们.length - 1] || null, form: 下一, path: 末行路径 };
    },
    /** ≙ 开启条件分支 / 新增分支：创建技能设计台默认条件分支(行目标) */
    newBranch(effect) { return 创建技能设计台默认条件分支(normalizeSkillUiText(effect && effect['目标'], '单体')); },
    /** ≙「新增条件」 */
    newCondition() { return { 类型: '生命比例', 对象: '目标', 比较: '<=', 值: '20%' }; },
    /** ≙「+ 副作用」：默认自损反噬，对象按草稿推断 */
    newSideEffect(form) { return 创建技能设计台默认副作用条目('自损反噬', { 生效对象: 读取技能设计台默认副作用对象(form || {}, '施展') }); },
    /** 交互动作（与原版事件处理同语义），返回新的实时表单；可传动作数组顺序执行 */
    act(form, action, meta, root) { return 设计台动作(form, action, meta, root); },
    /** 有状态会话（推荐 UI 使用）：session(skill|null, meta, root) → { form, act(), view(), save(), toSkill(), tempSkill(), summary(), validate() } */
    session(skill, meta, root) { return 设计台会话(skill, meta, root); },
    /** 整张设计台视图：分区/字段/原型行/副作用/摘要（值为原版挂载后 DOM 中的值） */
    view(form, meta, root) { return 设计台视图(form, meta, root); },
    schema: {
      sections: 设计台分区定义.map(定义 => ({
        id: 定义.id,
        title: 定义.title({}, {}),
        templateTitle: 定义.templateTitle ? 定义.templateTitle({}, {}) : 定义.title({}, {}),
        tab: 读取分区页名(定义.templateTitle ? 定义.templateTitle({}, {}) : 定义.title({}, {}), 定义.marker),
        hint: (() => { const 表 = 设计台模板上下文({ rootData: {} }, { path: [], scope: '魂技' }, {}).标题提示表; const 键 = typeof 定义.hintKey === 'function' ? 定义.hintKey({}, {}) : 定义.hintKey; return (键 && 表[键]) || ''; })(),
        visible: (form, meta) => !!定义.visible(form || {}, 设计台规范元数据(meta)),
      })),
      sectionsFor(form, meta, root) {
        const { previewMeta, snapshot } = 设计台准备(meta, root);
        return 设计台分区列表(form || {}, previewMeta, 设计台模板上下文(snapshot, previewMeta, form || {}).标题提示表);
      },
      tabs: 技能设计台分页定义.map(页 => ({ name: 页.名称, titles: [...页.标题集] })),
      top: {
        deliveryOptions: type => getSkillDesignerDeliveryOptions(type).map(v => ({ value: v, label: v })),
        useLimitPeriods: 技能设计台使用限制周期选项.map(v => ({ value: v, label: v })),
        passiveTriggers: 技能设计台被动触发选项.map(v => ({ value: v, label: v })),
        passivePeriods: 技能设计台被动触发周期选项.map(v => ({ value: v, label: v })),
        resourceTypes: SKILL_DESIGNER_RESOURCE_TYPE_OPTIONS.map(v => ({ value: v, label: v })),
        costKeys: [...SKILL_DESIGNER_COST_RESOURCE_KEYS],
        attributes: SKILL_DESIGNER_ATTRIBUTE_OPTIONS.map(v => ({ value: v, label: v })),
        recommendedAttributes: form => normalizeSkillDesignerArray(SKILL_DESIGNER_ATTRIBUTE_HINTS_BY_TYPE[(form && form.type) || ''] || []),
        scopeLabels: meta => getSkillDesignerScopeLabels(设计台规范元数据(meta)),
        castTimeByDelivery: { ...SKILL_DESIGNER_RUNTIME_CAST_TIME_BY_DELIVERY },
      },
      prototypes: 设计台原型下拉('').options.filter(项 => !项.header).map(项 => ({ name: 项.value, category: 项.category, group: 项.group, label: 项.label, hint: 项.hint, direction: 项.direction })),
      prototypeRegistry: name => SKILL_DESIGNER_PROTOTYPE_REGISTRY[name] || null,
      /** 单个效果行的字段（≙ 该效果在 ctx.grid 第 ctx.index 行渲染并挂载同步后的控件） */
      fields: 单行字段,
      targets(effect, ctx = {}) {
        const 原型 = normalizeSkillUiText(effect && effect['原型'], '伤害结算');
        const 当前效果 = 技能设计台清理并水合原型效果(effect || {}, normalizeSkillDesignerEffectTargetValue(effect && effect['目标'], '单体'), { 嵌套字段: ctx.nestedKind, 强制独立: !!(ctx.grid && ctx.grid !== 'main') });
        return 读取技能设计台目标候选(原型, { 嵌套字段: ctx.nestedKind || '', 当前效果 }).map(v => ({ value: v, label: v }));
      },
      condition: {
        typeGroups: SKILL_DESIGNER_CONDITION_BRANCH_TYPE_GROUPS.map(组 => ({ label: 组.label, options: 组.options.filter(o => SKILL_DESIGNER_CONDITION_BRANCH_TYPE_OPTIONS.includes(o)).map(o => ({ value: o, label: o, group: 组.label })) })),
        objects: 构建技能设计台条件分支对象选项(),
        compare: type => 条件比较下拉(type, '').options.map(({ value, label }) => ({ value, label })),
        valueControl: (type, compare) => {
          const 配置 = 读取技能设计台条件分支值控件配置(type, compare);
          return {
            kind: 配置.值控件 === '数字' ? 'number' : 配置.值控件 === '无' ? 'none' : 'select',
            options: 配置.值控件 === '数字' || 配置.值控件 === '无' ? [] : normalizeSkillDesignerOptionList(配置.值选项),
            label: 配置.值标签, compareLabel: 配置.比较标签, showCompare: 配置.显示比较, showValue: 配置.显示值, showState: 配置.显示状态,
          };
        },
        states: 条件状态下拉('中毒').options.map(({ value, label, group, hint }) => ({ value, label, group, ...(hint ? { hint } : {}) })),
        actions: SKILL_DESIGNER_CONDITION_BRANCH_ACTION_OPTIONS.map(v => ({ value: v, label: v })),
        hints: { ...技能设计台条件字段提示 },
        preview: condition => 构建技能设计台条件分支条件预览(condition || {}),
        summary: branches => 构建技能设计台条件分支摘要(branches || []),
      },
      sideEffect: {
        types: 技能设计台副作用类型候选_V1.map(v => ({ value: v, label: v, config: { ...(技能设计台副作用配置表_V1[v] || {}) } })),
        triggers: 技能设计台副作用触发时机选项_V1.map(v => ({ value: v, label: v })),
        targets: 技能设计台副作用生效对象选项_V1.map(v => ({ value: v, label: v })),
        hints: { ...技能设计台副作用字段提示 },
        fields: row => 描述副作用行(规范化技能设计台副作用条目(row || {}, () => {}) || 创建技能设计台默认副作用条目(), '副作用列表').fields.map(c => 导出控件(c, [])),
        summary: row => 格式化技能设计台副作用摘要(row || {}),
      },
      tick: {
        parts: ['日', '时', '分'],
        minutesPerTick: 技能设计台每tick分钟,
        windowMaxTick: 技能设计台时窗最大调整tick,
        toTick(parts = {}, opts = {}) { const 控件 = { minTick: opts.minTick || 0, maxTick: opts.maxTick || 0 }; 同步tick(控件, parts); return 控件.tick; },
        fromTick(tick = 0, opts = {}) { const r = 拆分技能设计台tick时长(tick, { 最小tick: opts.minTick || 0, 最大tick: opts.maxTick, 默认tick: opts.minTick || 0 }); return { 日: r.日, 时: r.小时, 分: r.分钟, tick: r.tick }; },
      },
      units: { options: [{ value: '点数', label: '点数' }, { value: '百分比', label: '百分比' }], format: (value, unit) => 格式化技能设计台单位数值(value, unit), basis: (原型, 字段, effect) => 读取技能设计台数值字段口径(原型, 字段, effect || {}) },
      hints: {
        prototypeField: (原型, 字段, effect) => 获取技能设计台原型字段提示(原型, 字段, effect || {}),
        condition: { ...技能设计台条件字段提示 },
        sideEffect: { ...技能设计台副作用字段提示 },
        sections: { ...设计台模板上下文({ rootData: {} }, { path: [], scope: '魂技' }, {}).标题提示表 },
        legacyParam: { ...技能设计台参数提示表 },
      },
    },
    /** 调试：原版 HTML 生成器与虚拟表单（对照用） */
    _debug: {
      rowHtml: (effects, fallbackTarget, 允许删空, options) => 构建技能设计台原型效果行列表(effects, fallbackTarget, 允许删空, options),
      virtualForm: (form, meta, root) => { const { previewMeta, snapshot } = 设计台准备(meta, root); return 渲染并挂载(form, previewMeta, snapshot); },
      readVirtualForm: (vf, meta) => 读取虚拟表单(vf, 设计台规范元数据(meta)),
      writeUpdates: (meta, skill, root) => { const { previewMeta, snapshot } = 设计台准备(meta, root); return buildSkillDesignerWriteUpdates(previewMeta, skill, snapshot.rootData); },
      liveDraft: (form, meta, root) => { const { previewMeta, snapshot } = 设计台准备(meta, root); return 同步草稿(渲染并挂载(form, previewMeta, snapshot), previewMeta, snapshot); },
      openSummaryDraft: (form, meta, root) => { const { previewMeta, snapshot } = 设计台准备(meta, root); return 渲染并挂载(form, previewMeta, snapshot).openSummaryDraft; },
    },
  };
  if (typeof window !== 'undefined') window.LWCS_DESIGNER_MODEL = 公共接口;
  globalThis.LWCS_DESIGNER_MODEL = 公共接口;

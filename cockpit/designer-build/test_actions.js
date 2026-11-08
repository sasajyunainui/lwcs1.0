// 交互对照：在原版 DOM 上触发真实事件处理（handleInput/handleChange/handleClick）vs LWCS_DESIGNER_MODEL.act
'use strict';
global.window = globalThis;
const vm = require('vm');
const { load: loadOrig } = require('./orig.js');
const { load: loadModel } = require('./load_model.js');
const { buildRoot } = require('./cases.js');
const { canonDomRow, canonModelRow, diffCanon } = require('./canon.js');
require('./save-data.js');
const VERBOSE = process.argv.includes('--verbose');
const O = loadOrig({ quiet: true }), MC = loadModel();

// 对拍比的是桥接原版：数据层独有的规则（物品被动保持承载方式，原版没有物品技能入口）关掉再比，规则本身见 test_rules.js
MC.LWCS_DESIGNER_MODEL.rules.物品被动保持承载方式 = false;
const B = O.__B, M = MC.LWCS_DESIGNER_MODEL;
const { root: baseRoot } = buildRoot(globalThis.LWCS_SAVE);
const 玩家 = baseRoot.sys.玩家名;
const rootJson = JSON.stringify(baseRoot);
MC.__rootJson = rootJson;
const 新根O = () => vm.runInContext(`JSON.parse(${JSON.stringify(rootJson)})`, O);
const 新根M = () => vm.runInContext('JSON.parse(__rootJson)', MC);
const J = v => JSON.stringify(v);
const 排序 = v => (Array.isArray(v) ? v.map(排序) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, 排序(v[k])])) : v);
function 首差(a, b, p = '') {
  if (J(排序(a)) === J(排序(b))) return null;
  if (a && b && typeof a === 'object' && typeof b === 'object') for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = 首差(a[k], b[k], `${p}.${k}`); if (d) return d; }
  return { path: p || '(根)', orig: a, model: b };
}
const 环 = n => ({ path: ['char', 玩家, '第1武魂', '第1魂灵', `第${n}魂环`, `第${n}魂技`], category: '魂环魂技', scope: '魂技' });
const ROW = '[data-skill-designer-prototype-row]';
// —— 原版 DOM 定位 ——
const 子行 = grid => (grid ? grid.children.filter(n => n.matches(ROW)) : []);
const 本行 = (row, sel) => row.querySelectorAll(sel).filter(el => el.closest(ROW) === row);
function 定位DOM行(mountEl, path) {
  let rows = 子行(mountEl.querySelector('[data-skill-designer-prototype-grid="main"]'));
  let row = rows[path[0]], i = 1;
  while (i < path.length) {
    if (path[i] === '条件分支') {
      const 块 = 本行(row, '[data-skill-designer-condition-branch]')[0];
      const 条目 = 块.querySelectorAll('[data-skill-designer-condition-branch-row]').filter(el => el.closest(ROW) === row)[path[i + 1]];
      if (path[i + 2] === undefined) return { row, entry: 条目 };
      const 区 = 条目.querySelector(`[data-skill-designer-condition-effect="${path[i + 2]}"]`);
      rows = 子行(区.querySelector('[data-skill-designer-prototype-grid]'));
      if (path[i + 3] === undefined) return { row, entry: 条目, block: 区 };
      row = rows[path[i + 3]]; i += 4;
    } else {
      const 区 = 本行(row, `[data-skill-designer-nested-prototype-field="${path[i]}"]`)[0];
      rows = 子行(区.querySelector('[data-skill-designer-prototype-grid]'));
      if (path[i + 1] === undefined) return { row, block: 区 };
      row = rows[path[i + 1]]; i += 2;
    }
  }
  return { row };
}
const 事件 = target => ({ target, preventDefault() {} });
function 原版执行(r, a) {
  const m = r.mountEl;
  const 改 = el => { r.handleInput(事件(el)); r.handleChange(事件(el)); };
  const 点 = el => { if (!el) throw new Error('原版按钮不存在 ' + a.type); r.handleClick(事件(el)); };
  const 设 = (el, v) => {
    if (!el) throw new Error('原版控件不存在 ' + J(a));
    if (el.localName === 'select' && el.multiple) el.options.forEach(o => { o.selected = [].concat(v).includes(o.value); });
    else if (el.type === 'checkbox') el.checked = !!v;
    else el.value = v;
    改(el);
  };
  switch (a.type) {
    case 'top': {
      if (a.key === 'constructDurationTick') {
        const 块 = m.querySelector('[data-skill-designer-construct-section] [data-skill-designer-time-parts]');
        ['日', '时', '分'].forEach(p => { 块.querySelector(`[data-skill-designer-time-part="${p}"]`).value = String(a.value[p] ?? 0); });
        return 改(块.querySelector('[data-skill-designer-time-part="分"]'));
      }
      if (/^cost\./.test(a.key)) return 设(m.querySelector(`[data-skill-designer-cost-value="${a.key.slice(5)}"]`), a.value);
      if (/^sustain\./.test(a.key)) return 设(m.querySelector(`[data-skill-designer-sustain-cost-value="${a.key.slice(8)}"]`), a.value);
      if (a.key === 'attachedAttributes') { m.querySelectorAll('input[name="skill-attribute"]').forEach(el => { el.checked = a.value.includes(el.value); }); return 改(m.querySelector('input[name="skill-attribute"]')); }
      return 设(m.querySelector(`[data-skill-designer-field="${a.key}"]`), a.value);
    }
    case 'prototype': { const { row } = 定位DOM行(m, a.path); return 设(row.querySelector('[data-skill-designer-prototype-select]'), a.value); }
    case 'effectField': { const { row } = 定位DOM行(m, a.path); return 设(本行(row, `[data-skill-designer-prototype-field="${a.key}"]`)[0], a.value); }
    case 'unit': { const { row } = 定位DOM行(m, a.path); const 控 = 本行(row, `[data-skill-designer-prototype-field="${a.key}"]`)[0].closest('[data-skill-designer-value-unit-control]'); return 设(控.querySelector('[data-skill-designer-value-unit]'), a.unit); }
    case 'objectField': { const { row } = 定位DOM行(m, a.path); return 设(本行(row, `[data-skill-designer-suppress-object-field="${a.key}"]`)[0], a.value); }
    case 'addEffect': {
      if (!a.path || !a.path.length) return 点(m.querySelector('[data-skill-designer-add-prototype="main"]'));
      const 位 = 定位DOM行(m, a.path);
      if (位.block && 位.block.hasAttribute('data-skill-designer-condition-effect')) return 点(位.block.querySelector('[data-skill-designer-add-condition-effect]'));
      return 点(位.block.querySelector('[data-skill-designer-add-nested-prototype]'));
    }
    case 'removeEffect': { const { row } = 定位DOM行(m, a.path); return 点(row.children.find(c => c.hasAttribute('data-skill-designer-remove-prototype'))); }
    case 'branchEnabled': { const { row } = 定位DOM行(m, a.path); return 设(本行(row, '[data-skill-designer-condition-branch-enabled]')[0], a.value); }
    case 'addBranch': { const { row } = 定位DOM行(m, a.path); return 点(本行(row, '[data-skill-designer-add-condition-branch]')[0]); }
    case 'branchAction': { const { entry } = 定位DOM行(m, [...a.path, '条件分支', a.branch]); return 设(entry.querySelector('[data-skill-designer-condition-branch-action]'), a.value); }
    case 'addCondition': { const { entry } = 定位DOM行(m, [...a.path, '条件分支', a.branch]); return 点(entry.querySelector('[data-skill-designer-add-condition]')); }
    case 'removeCondition': { const { entry } = 定位DOM行(m, [...a.path, '条件分支', a.branch]); return 点(entry.querySelectorAll('[data-skill-designer-condition-row]')[a.index].querySelector('[data-skill-designer-remove-condition]')); }
    case 'conditionField': {
      const { entry } = 定位DOM行(m, [...a.path, '条件分支', a.branch]);
      const 条件 = entry.querySelectorAll('[data-skill-designer-condition-row]')[a.index];
      const 候选 = 条件.querySelectorAll(`[data-skill-designer-condition-field="${a.key}"]`);
      return 设(候选.find(el => el.localName === 'select') || 候选[候选.length - 1], a.value);
    }
    case 'addSideEffect': return 点(m.querySelector('[data-skill-designer-add-side-effect]'));
    case 'removeSideEffect': return 点(m.querySelectorAll('[data-skill-designer-side-effect-row]')[a.index].querySelector('[data-skill-designer-remove-side-effect]'));
    case 'sideEffectField': return 设(m.querySelectorAll('[data-skill-designer-side-effect-row]')[a.index].querySelector(`[data-skill-designer-side-effect-field="${a.key}"]`), a.value);
    case 'fusionAdd': return 点(m.querySelector('[data-skill-designer-add-fusion-participant]'));
    case 'fusionRemove': return 点(m.querySelectorAll('[data-fusion-participant-row]')[a.index].querySelector('[data-skill-designer-remove-fusion-participant]'));
    case 'fusionParticipant': { const 行 = m.querySelectorAll('[data-fusion-participant-row]')[a.index]; return 设(行.querySelector(a.key === 'spirit' ? 'select[data-skill-designer-fusion-spirit]' : 'select[data-skill-designer-fusion-char]'), a.value); }
    default: throw new Error('未实现原版动作 ' + a.type);
  }
}
const 场景 = [
  ['状态施加 改状态', 环(7), [{ type: 'effectField', path: [0], key: '状态', value: '灼烧' }]],
  ['切换原型', 环(7), [{ type: 'prototype', path: [1], value: '判定修正' }]],
  ['伤害段数+类型', 环(5), [{ type: 'effectField', path: [0], key: '攻击段数', value: '2' }, { type: 'effectField', path: [0], key: '伤害类型', value: '精神攻击' }]],
  ['数值单位切换', 环(3), [{ type: 'unit', path: [0], key: '数值', unit: '点数' }]],
  ['开启条件分支', 环(5), [{ type: 'branchEnabled', path: [0], value: true }]],
  ['新增条件', 环(6), [{ type: 'addCondition', path: [0], branch: 0 }]],
  ['条件类型改护盾', 环(6), [{ type: 'conditionField', path: [0], branch: 0, index: 0, key: '类型', value: '护盾' }]],
  ['条件比较改值', 环(6), [{ type: 'conditionField', path: [0], branch: 0, index: 0, key: '比较', value: '>' }, { type: 'conditionField', path: [0], branch: 0, index: 0, key: '值', value: '50%' }]],
  ['主列表新增原型', 环(5), [{ type: 'addEffect', path: [] }]],
  ['新增原型再切原型', 环(5), [{ type: 'addEffect', path: [] }, { type: 'prototype', path: [2], value: '状态施加' }]],
  ['删除原型', 环(7), [{ type: 'removeEffect', path: [1] }]],
  ['新增副作用+改类型', 环(7), [{ type: 'addSideEffect' }, { type: 'sideEffectField', index: 2, key: '副作用类型', value: '致死献祭' }]],
  ['副作用时机', 环(7), [{ type: 'sideEffectField', index: 0, key: '触发时机', value: '效果结束后' }, { type: 'sideEffectField', index: 0, key: '关联状态', value: '食物增幅' }]],
  ['删除副作用', 环(7), [{ type: 'removeSideEffect', index: 0 }]],
  ['承载改造物', 环(5), [{ type: 'top', key: 'deliveryForm', value: '造物承载' }]],
  ['造物有效期日时分', 环(3), [{ type: 'top', key: 'constructDurationTick', value: { 日: 1, 时: 2, 分: 35 } }]],
  ['抹消对象子字段', 环(8), [{ type: 'objectField', path: [1], key: '状态', value: ['眩晕', '沉默'] }]],
  ['抹消对象切原型', 环(8), [{ type: 'objectField', path: [1], key: '原型', value: '属性修正' }]],
  ['嵌套新增', 环(8), [{ type: 'addEffect', path: [0, '授予效果'] }]],
  ['嵌套行改数值', 环(8), [{ type: 'effectField', path: [0, '授予效果', 0], key: '数值', value: '+20%' }]],
  ['分支效果新增', 环(6), [{ type: 'addEffect', path: [0, '条件分支', 0, '替换效果'] }]],
  ['分支处理切换', 环(6), [{ type: 'branchAction', path: [0], branch: 1, value: '替换效果' }]],
  ['删除条件', 环(6), [{ type: 'removeCondition', path: [0], branch: 1, index: 1 }]],
  ['新增分支', 环(6), [{ type: 'addBranch', path: [0] }]],
  ['驱动属性设无(会被回填)', { path: ['char', '唐舞麟', '第1武魂', '第1魂灵', '第1魂环', '第1魂技'], category: '魂环魂技', scope: '魂技' }, [{ type: 'effectField', path: [0], key: '驱动属性', value: '无' }]],
  ['目标改自身', { path: ['char', '唐舞麟', '第1武魂', '第1魂灵', '第1魂环', '第1魂技'], category: '魂环魂技', scope: '魂技' }, [{ type: 'effectField', path: [1], key: '目标', value: '群体' }]],
  ['消耗改混合+精神力', 环(5), [{ type: 'top', key: 'costType', value: '混合' }, { type: 'top', key: 'cost.精神力', value: '50' }, { type: 'top', key: 'sustain.魂力', value: '20' }]],
  ['使用限制每战×3', 环(5), [{ type: 'top', key: '使用限制周期', value: '每战' }, { type: 'top', key: '使用限制次数', value: '3' }]],
  ['开启被动', 环(5), [{ type: 'top', key: '启用被动', value: true }, { type: 'top', key: '被动触发', value: '受击后' }, { type: 'top', key: '被动触发周期', value: '每回合' }, { type: 'top', key: '被动触发次数', value: '2' }]],
  ['开启掌控度', 环(6), [{ type: 'top', key: '启用技能掌控度', value: true }, { type: 'top', key: '技能掌控度中心等级', value: '40' }, { type: 'top', key: '技能掌控度圆满等级', value: '50' }]],
  ['附带属性', 环(6), [{ type: 'top', key: 'attachedAttributes', value: ['雷', '光'] }]],
  ['时窗修正改对象', { path: ['char', 玩家, '自创魂技', '影步'], category: '自创魂技', scope: '自创魂技' }, [{ type: 'effectField', path: [2], key: '调整字段', value: '有效期tick' }]],
  ['位移改类型', { path: ['char', 玩家, '自创魂技', '影步'], category: '自创魂技', scope: '自创魂技' }, [{ type: 'effectField', path: [0], key: '位移类型', value: '拉近' }]],
  ['融合新增对象', { path: ['char', 玩家, '武魂融合技', '融合一', '技能数据'], category: '武魂融合技', scope: '武魂融合技' }, [{ type: 'fusionAdd' }]],
  ['融合新增后换角色', { path: ['char', 玩家, '武魂融合技', '融合一', '技能数据'], category: '武魂融合技', scope: '武魂融合技' }, [{ type: 'fusionAdd' }, { type: 'fusionParticipant', index: 2, key: 'char', value: '刘语心' }]],
  ['融合换自身武魂', { path: ['char', 玩家, '武魂融合技', '融合一', '技能数据'], category: '武魂融合技', scope: '武魂融合技' }, [{ type: 'fusionParticipant', index: 0, key: 'spirit', value: '五行昊天锤' }]],
  ['融合移除对象', { path: ['char', 玩家, '武魂融合技', '融合一', '技能数据'], category: '武魂融合技', scope: '武魂融合技' }, [{ type: 'fusionAdd' }, { type: 'fusionRemove', index: 2 }]],
  ['融合切自体', { path: ['char', 玩家, '武魂融合技', '融合一', '技能数据'], category: '武魂融合技', scope: '武魂融合技' }, [{ type: 'top', key: 'fusionMode', value: 'self' }]],
  ['融合自体再切回', { path: ['char', 玩家, '武魂融合技', '融合一', '技能数据'], category: '武魂融合技', scope: '武魂融合技' }, [{ type: 'top', key: 'fusionMode', value: 'self' }, { type: 'top', key: 'fusionMode', value: 'partner' }]],
  ['融合用法切换', { path: ['char', 玩家, '武魂融合技', '融合一', '技能数据'], category: '武魂融合技', scope: '武魂融合技' }, [{ type: 'top', key: '用法模式', value: '融合增幅' }]],
  ['新建融合技 加对象+原型', { path: ['char', 玩家, '武魂融合技', '武魂融合技_test01', '技能数据'], category: '武魂融合技', scope: '武魂融合技' }, [{ type: 'fusionAdd' }, { type: 'addEffect', path: [] }, { type: 'prototype', path: [0], value: '伤害结算' }]],
  ['新建自创魂技 加原型', { path: ['char', 玩家, '自创魂技', '自创魂技_test01'], category: '自创魂技', scope: '自创魂技' }, [{ type: 'addEffect', path: [] }, { type: 'prototype', path: [0], value: '结算修正' }, { type: 'top', key: 'name', value: '试作' }]],
  ['血脉散技 改数值', { path: ['char', 玩家, '血脉之力', '技能', '血爆'], category: '血脉散技', scope: 'blood_skill' }, [{ type: 'effectField', path: [0], key: '威力倍率', value: '140' }]],
  ['气血魂环魂技 改目标', { path: ['char', 玩家, '血脉之力', '第1气血魂环', '第1血脉魂技'], category: '血脉魂环', scope: 'blood_ring_skill' }, [{ type: 'effectField', path: [0], key: '数值', value: '-20%' }]],
  ['魂骨技能 加副作用', { path: ['char', 玩家, '魂骨', '右臂魂骨', '附带技能', '裂地'], category: '魂骨技能', scope: 'soul_bone_skill' }, [{ type: 'addSideEffect' }]],
  ['血脉特性 改触发', { path: ['char', 玩家, '血脉之力', '被动', '血怒'], category: '血脉特性', scope: 'blood_passive' }, [{ type: 'top', key: '被动触发', value: '受击后' }]],
  ['装备技能 改倍率', { path: ['char', 玩家, '装备', '魂导器', '装配', '一号位', '装备技能', '魂导冲击'], category: '装备技能', scope: 'equipment_skill' }, [{ type: 'effectField', path: [0], key: '威力倍率', value: '95' }]],
  ['装备被动 改数值', { path: ['char', '唐舞麟', '装备', '武器', '装备技能', '沉银叠锤'], category: '装备技能', scope: 'equipment_skill' }, [{ type: 'effectField', path: [0], key: '数值', value: '1.2' }]],
];
const 统计 = { pass: 0, fail: 0 };
const 无状态统计 = { pass: 0, fail: 0 };
const 记无状态 = ok => { 无状态统计[ok ? 'pass' : 'fail']++; };
(async () => {
  for (const [名, 基元, 动作们] of 场景) {
    const rootO = 新根O(), rootM = 新根M();
    const 源 = 基元.path.reduce((o, k) => (o ? o[k] : undefined), rootO) || {};
    const meta = { ...基元, label: B.readSkillDesignerDraft(源, 基元.path[基元.path.length - 1]).name };
    const snap = { rootData: rootO, activeName: 基元.path[1], activeChar: rootO.char[基元.path[1]] };
    B.setLive(snap);
    const 差 = [];
    let 原草稿, 模草稿, 原行, 模行;
    try {
      const r = B.__设计台挂载(snap, B.buildSkillDesignerPreviewKey(meta));
      动作们.forEach(a => 原版执行(r, a));
      原草稿 = JSON.parse(J(r.syncDraftCache()));
      原行 = 子行(r.mountEl.querySelector('[data-skill-designer-prototype-grid="main"]')).map(canonDomRow);
      O.__HLOG.lastSkill = null;
      O.__HLOG.toasts.length = 0;
      await r.handleSubmit(事件(null));
      var 原保存 = O.__HLOG.lastSkill ? JSON.parse(J(O.__HLOG.lastSkill)) : { __error: (O.__HLOG.toasts[0] || {}).text };
    } catch (e) { 差.push({ 项: '原版执行失败', path: '', orig: String(e.stack).split('\n').slice(0, 3).join(' | ') }); }
    try {
      const 会话 = M.session(null, meta, rootM).act(动作们);
      模草稿 = JSON.parse(J(会话.form));
      模行 = 会话.view().rows.map(canonModelRow);
      try { var 模保存 = JSON.parse(J(会话.toSkill())); } catch (e) { 模保存 = { __error: e.message }; }
      // 无状态 act（单次调用传整组动作）：比较保存结果
      const 无状态 = M.act(M.fromSkill(null, meta, rootM), 动作们, meta, rootM);
      try { var 无状态保存 = JSON.parse(J(M.toSkill(无状态, meta, null, rootM))); } catch (e) { 无状态保存 = { __error: e.message }; }
    } catch (e) { 差.push({ 项: '模型执行失败', path: '', model: String(e.stack).split('\n').slice(0, 3).join(' | ') }); }
    if (原草稿 && 模草稿) {
      const d = 首差(原草稿, 模草稿); if (d) 差.push({ 项: '动作后草稿', ...d });
      for (let i = 0; i < Math.max(原行.length, 模行.length); i++) { const x = diffCanon(原行[i] || [], 模行[i] || []); if (x) { 差.push({ 项: `动作后第${i}行字段`, path: x.index, orig: x.orig, model: x.model }); break; } }
      const s = 首差(原保存, 模保存); if (s) 差.push({ 项: '动作后保存', ...s });
      const s2 = 首差(原保存, 无状态保存); 记无状态(!s2); if (s2) 差.push({ 项: '无状态act保存', ...s2 });
    }
    统计[差.length ? 'fail' : 'pass']++;
    console.log(`[${差.length ? 'DIFF' : ' OK '}] ${名}`);
    差.slice(0, VERBOSE ? 10 : 2).forEach(d => console.log(`    ${d.项} @${d.path}\n      原: ${J(d.orig)?.slice(0, 300)}\n      模: ${J(d.model)?.slice(0, 300)}`));
  }
  console.log(`交互场景 ${场景.length}：会话(session) 通过 ${统计.pass}，失败 ${统计.fail}；无状态 act 保存结果 通过 ${无状态统计.pass}，失败 ${无状态统计.fail}`);
  process.exit(0);
})();

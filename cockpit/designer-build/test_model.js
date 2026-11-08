// 对照测试：原版（vm + minidom 跑 bridge 的渲染/挂载/回读/保存）vs designer-model.js
// 用法：node test_model.js [--verbose] [--only=标题片段] [--protos]
'use strict';
global.window = globalThis;
const vm = require('vm');
const { load: loadOrig } = require('./orig.js');
const { load: loadModel } = require('./load_model.js');
const { buildRoot, realCases } = require('./cases.js');
const { canonDomRow, canonModelRow, diffCanon } = require('./canon.js');
require('./save-data.js');

const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');
const ONLY = (args.find(a => a.startsWith('--only=')) || '').slice(7);
const PROTOS = args.includes('--protos');

const O = loadOrig({ quiet: true });
const MC = loadModel();

// 对拍比的是桥接原版：数据层独有的规则（物品被动保持承载方式，原版没有物品技能入口）关掉再比，规则本身见 test_rules.js
MC.LWCS_DESIGNER_MODEL.rules.物品被动保持承载方式 = false;
const B = O.__B, M = MC.LWCS_DESIGNER_MODEL;
const { root: baseRoot, 合成 } = buildRoot(globalThis.LWCS_SAVE);
const 玩家 = baseRoot.sys.玩家名;

// 每个原型一个合成技能（字段覆盖）
const 原型列表 = Object.keys(B.SKILL_DESIGNER_PROTOTYPE_REGISTRY);
const 原型用例 = [];
if (PROTOS || !ONLY) {
  const 魂灵 = baseRoot.char[玩家].第1武魂.第2魂灵 = baseRoot.char[玩家].第1武魂.第2魂灵 || { 表象名称: '测试魂灵', 年限: 5000 };
  原型列表.forEach((原型, i) => {
    const 环 = `第${i + 1}魂环`;
    魂灵[环] = { 年限: 5000, 颜色: '紫', 来源: '无' };
    魂灵[环][`第${i + 1}魂技`] = { 魂技名: `测${原型}`, 画面描述: '测试', 效果描述: '测试', 承载方式: '直接生效', 消耗: { 魂力: 300 }, 前摇: 10, _效果数组: [B.创建技能设计台默认原型效果(原型, '单体')] };
    原型用例.push({ title: `原型:${原型}`, proto: 原型, meta: { path: ['char', 玩家, '第1武魂', '第2魂灵', 环, `第${i + 1}魂技`], category: '魂环魂技', scope: '魂技' } });
  });
}
const rootJson = JSON.stringify(baseRoot);
const 新根O = () => vm.runInContext(`JSON.parse(${JSON.stringify(rootJson)})`, O);
MC.__rootJson = rootJson;
const 新根M = () => vm.runInContext('JSON.parse(__rootJson)', MC);

const J = v => JSON.stringify(v);
const 排序 = v => (Array.isArray(v) ? v.map(排序) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, 排序(v[k])])) : v);
const 等 = (a, b) => J(排序(a)) === J(排序(b));
const 严格等 = (a, b) => J(a) === J(b);
function 首差(a, b, 路径 = '') {
  if (严格等(排序(a), 排序(b))) return null;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    for (const k of keys) { const d = 首差(a[k], b[k], `${路径}.${k}`); if (d) return d; }
  }
  return { path: 路径 || '(根)', orig: a, model: b };
}

const 统计 = {};
const 记 = (项, ok) => { 统计[项] = 统计[项] || { pass: 0, fail: 0 }; 统计[项][ok ? 'pass' : 'fail']++; };
const 失败明细 = [];
const 覆盖表 = {};

async function 跑用例(用例) {
  const rootO = 新根O(), rootM = 新根M();
  const skillO = B.SKILL_DESIGNER_PROTOTYPE_REGISTRY && require('./orig.js') && null;
  void skillO;
  const 源技能 = 用例.meta.path.reduce((o, k) => (o ? o[k] : undefined), rootO) || {};
  const label = B.readSkillDesignerDraft(源技能, 用例.meta.path[用例.meta.path.length - 1]).name;
  const meta = { ...用例.meta, label: 用例.meta.label || (用例.meta.scope === 'art' ? 用例.meta.path[用例.meta.path.length - 1] : label) };
  const 角色名 = 用例.meta.path[1];
  const snapshot = { rootData: rootO, activeName: 角色名, activeChar: rootO.char[角色名] };
  B.setLive(snapshot);
  O.__HLOG.toasts.length = 0; O.__HLOG.updates.length = 0; O.__HLOG.toastr.length = 0;
  const 结果 = { title: 用例.title };
  let r;
  try { r = B.__设计台挂载(snapshot, B.buildSkillDesignerPreviewKey(meta)); }
  catch (e) { 结果.error = '原版挂载失败: ' + (e.stack || e).toString().split('\n').slice(0, 3).join(' | '); 失败明细.push(结果); return; }
  const 原 = {};
  原.draft = JSON.parse(J(r.designerDraft));
  原.openSummary = r.mountEl.querySelector('[data-skill-designer-preview="summary"]').textContent;
  原.formState = JSON.parse(J(B.readSkillDesignerFormState(r.mountEl, r.previewMeta)));
  原.live = JSON.parse(J(r.syncDraftCache()));
  原.tempLive = JSON.parse(J(B.构建技能设计台临时技能(r.syncDraftCache(), r.previewMeta).临时技能));
  原.tempRaw = JSON.parse(J(B.构建技能设计台临时技能(r.designerDraft, r.previewMeta).临时技能));
  try {
    const fsO = B.readSkillDesignerFormState(r.mountEl, r.previewMeta);
    const s = B.buildSkillDesignerUpdatedSkill(r.skillSource, fsO, r.previewMeta, rootO);
    const COST = O.__LWCS_SKILL_COST_HELPERS_V1__;
    if (COST && typeof COST.条件分支约束_V1 === 'function') COST.条件分支约束_V1(s);
    原.skill = JSON.parse(J(s));
    原.meta = s.技能设计台写回元数据 ? JSON.parse(J(s.技能设计台写回元数据)) : null;
  } catch (e) { 原.skill = { __error: e.message }; }
  原.rows = Array.from(r.mountEl.querySelector('[data-skill-designer-prototype-grid="main"]').children).filter(n => n.matches('[data-skill-designer-prototype-row]')).map(canonDomRow);
  原.sideEffects = Array.from(r.mountEl.querySelectorAll('[data-skill-designer-side-effect-row]')).map(row => Array.from(row.querySelectorAll('[data-skill-designer-side-effect-field]')).map(el => `${el.getAttribute('data-skill-designer-side-effect-field')}=${el.value}`).join(';'));
  r.refreshPreview();
  原.liveSummary = r.mountEl.querySelector('[data-skill-designer-preview="summary"]').textContent;
  O.__HLOG.lastSkill = null; O.__HLOG.lastFormState = null;
  await r.handleSubmit({ preventDefault() {} });
  原.saveSkill = O.__HLOG.lastSkill ? JSON.parse(J(O.__HLOG.lastSkill)) : { __error: (O.__HLOG.toasts[0] || {}).text };
  原.saveFormState = O.__HLOG.lastFormState ? JSON.parse(J(O.__HLOG.lastFormState)) : null;
  try { 原.writeUpd = O.__HLOG.lastSkill ? JSON.parse(J(B.buildSkillDesignerWriteUpdates(r.previewMeta, O.__HLOG.lastSkill, rootO))) : null; } catch (e) { 原.writeUpd = { __error: e.message }; }
  原.toasts = O.__HLOG.toasts.map(t => ({ text: t.text, type: t.type }));
  原.toastr = O.__HLOG.toastr.map(t => t.text);
  原.updates = JSON.parse(J(O.__HLOG.updates[0] || []));

  // —— 模型 ——
  const 模 = {};
  const form = M.fromSkill(null, meta, rootM);
  模.draft = JSON.parse(J(form));
  模.live = JSON.parse(J(M._debug.liveDraft(form, meta, rootM)));
  { const sv0 = M.save(form, meta, null, rootM); 模.formState = JSON.parse(J(sv0.formStateIdle)); 模.saveFormState = JSON.parse(J(sv0.formState)); }
  模.tempLive = JSON.parse(J(M.tempSkill(form, meta, rootM)));
  模.tempRaw = JSON.parse(J(M.tempSkill(form, meta, rootM, { live: false })));
  模.liveSummary = M.summary(form, meta, rootM);
  模.openSummary = M.summary(M._debug.openSummaryDraft(form, meta, rootM), meta, rootM, { live: false });
  try { const 存 = M.toSkill(form, meta, null, rootM); 模.saveSkill = JSON.parse(J(存)); try { 模.writeUpd = JSON.parse(J(M._debug.writeUpdates(meta, 存, rootM))); } catch (e) { 模.writeUpd = { __error: e.message }; } } catch (e) { 模.saveSkill = { __error: e.message }; 模.writeUpd = null; }
  try {
    const s = M.toSkill(form, meta, null, rootM, { keepConditionBranches: true });
    模.skill = JSON.parse(J(s));
    模.meta = s.技能设计台写回元数据 ? JSON.parse(J(s.技能设计台写回元数据)) : null;
  } catch (e) { 模.skill = { __error: e.message }; }
  const sv = M.save(form, meta, null, rootM);
  模.toasts = sv.messages.filter(m => m.level === 'error').map(m => ({ text: m.text, type: 'error' }));
  if (!模.toasts.length && sv.ok) 模.toasts = [{ text: `已更新${meta.label || '技能'}。`, type: 'info' }];
  模.toastr = sv.messages.filter(m => m.level === 'warn').map(m => m.text);
  模.updates = JSON.parse(J(sv.ok ? sv.updates : []));
  const 视图 = M.view(form, meta, rootM);
  模.rows = 视图.rows.map(canonModelRow);
  模.sideEffects = 视图.sideEffects.map(row => row.fields.map(f => `${f.key}=${f.value}`).join(';'));
  // 单行 fields() 与视图行一致性（同一行渲染）
  模.fieldsApi = (模.draft.prototypeEffects || []).map((eff, i) => M.schema.fields(eff, { index: i }));

  const 对照 = [
    ['1.fromSkill', 原.draft, 模.draft],
    ['1b.liveDraft', 原.live, 模.live],
    ['2a.formState(回读)', 原.formState, 模.formState],
    ['2.toSkill(=handleSubmit实存)', 原.saveSkill, 模.saveSkill],
    ['2f.保存回读(忙碌态)', 原.saveFormState, 模.saveFormState],
    ['2g.toSkill(保留分支)', 原.skill, 模.skill],
    ['2b.写回元数据', 原.meta, 模.meta],
    ['2c.save消息', 原.toasts, 模.toasts],
    ['2d.COST提示', 原.toastr, 模.toastr],
    ['2e.写回updates', 原.updates, 模.updates],
    ['2h.写回updates(不经COST)', 原.writeUpd, 模.writeUpd],
    ['3.tempSkill(live)', 原.tempLive, 模.tempLive],
    ['3b.tempSkill(raw)', 原.tempRaw, 模.tempRaw],
    ['4.summary(live)', 原.liveSummary, 模.liveSummary],
    ['4b.summary(打开瞬间)', 原.openSummary, 模.openSummary],
    ['6.副作用行', 原.sideEffects, 模.sideEffects],
  ];
  结果.diffs = [];
  对照.forEach(([项, a, b]) => {
    const ok = 等(a, b);
    记(项, ok);
    if (!ok) 结果.diffs.push({ 项, ...首差(a, b) });
    else if (!严格等(a, b)) 记(项 + '（键序不同）', false);
  });
  // 5. 逐行字段
  const 行数 = Math.max(原.rows.length, 模.rows.length);
  for (let i = 0; i < 行数; i++) {
    const d = diffCanon(原.rows[i] || [], 模.rows[i] || []);
    记('5.fields(行)', !d);
    if (d) 结果.diffs.push({ 项: `5.fields 第${i}行`, ...d });
  }
  // 5b. schema.fields(effect, {index}) 与整表渲染的同一行一致
  (模.fieldsApi || []).forEach((字段, i) => {
    const 视图行 = 视图.rows[i];
    const ok = !!视图行 && J(字段) === J(视图行.fields);
    记('5b.fields() API', ok);
    if (!ok) 结果.diffs.push({ 项: `5b.fields() 第${i}行`, path: '', orig: 视图行 && 视图行.fields.map(f => f.key + ':' + f.kind), model: 字段.map(f => f.key + ':' + f.kind) });
  });
  if (用例.proto) {
    const 行 = 视图.rows[0];
    覆盖表[用例.proto] = 行 ? 行.fields.flatMap(f => (f.kind === 'group' ? f.fields : [f])).map(f => `${f.key || f.kind}:${f.kind}${f.visible === false ? '(隐)' : ''}`) : [];
  }
  if (结果.diffs.length) 失败明细.push(结果);
  if (VERBOSE) console.log(`[${结果.diffs.length ? 'DIFF' : ' OK '}] ${用例.title}`);
}

(async () => {
  const 用例们 = [...realCases(globalThis.LWCS_SAVE), ...合成, ...原型用例].filter(c => !ONLY || c.title.includes(ONLY));
  for (const c of 用例们) await 跑用例(c);
  console.log(`用例数 ${用例们.length}（真实 ${用例们.filter(c => c.real).length} / 合成 ${用例们.filter(c => !c.real && !c.proto).length} / 原型覆盖 ${用例们.filter(c => c.proto).length}）`);
  Object.entries(统计).forEach(([k, v]) => console.log(`  ${k.padEnd(22)} 通过 ${v.pass}  失败 ${v.fail}`));
  失败明细.forEach(r => {
    console.log(`\n✗ ${r.title}${r.error ? ' ' + r.error : ''}`);
    (r.diffs || []).slice(0, VERBOSE ? 20 : 4).forEach(d => console.log(`   ${d.项} @${d.path ?? d.index}\n     原: ${J(d.orig)?.slice(0, 400)}\n     模: ${J(d.model)?.slice(0, 400)}`));
  });
  if (PROTOS) require('fs').writeFileSync(require('path').join(__dirname, 'coverage.json'), JSON.stringify(覆盖表, null, 1));
  process.exit(0);
})();

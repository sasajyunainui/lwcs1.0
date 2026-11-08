// 原版对照基准：在 node vm 中只读加载 MVU_Skill_Runtime.js + 截断版 bridge，
// 并把预览页里「技能设计台」分支的模板与 onMount 代码按行切片注入，配合 minidom 跑原版的渲染→挂载→回读→保存。
'use strict';
const fs = require('fs'), vm = require('vm');
const D = require('./minidom.js');
const { analyze } = require('./analyze.js');
const ts = require(require('path').join(__dirname, '..', '..', '..', 'node_modules', 'typescript'));
const LW = require('path').join(__dirname, '..', '..') + '/';

function deepStub() {
  const fn = function () { return stub; };
  const stub = new Proxy(fn, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => '';
      if (k === 'then') return undefined;
      if (k === Symbol.iterator) return function* () {};
      if (k === 'length') return 0;
      return stub;
    },
    apply() { return stub; }, construct() { return stub; }, has() { return false; },
  });
  return stub;
}

function freeIdents(code) {
  const sf = ts.createSourceFile('h.js', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const refs = new Set();
  const visit = n => {
    if (ts.isIdentifier(n)) {
      const p = n.parent;
      const isProp = p && ((ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n) || (ts.isMethodDeclaration(p) && p.name === n) || (ts.isBindingElement(p) && p.propertyName === n));
      if (!isProp) refs.add(n.text);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return refs;
}

function build() {
  const A = analyze();
  const lines = A.src.split(/\r?\n/);
  const findLine = (re, from = 0) => { for (let i = from; i < lines.length; i++) if (re.test(lines[i])) return i; return -1; };
  const cutIdx = findLine(/^  function summarizeSkillEffectArray\b/); // 0 基
  const CUT = cutIdx; // 保留 [0, cutIdx)
  const branch = findLine(/^    if \(String\(previewKey \|\| ''\)\.startsWith\(SKILL_DESIGNER_PREVIEW_PREFIX\)\) \{/);
  const preludeEnd = findLine(/const 技能COST试算内容 = /, branch);
  const onMountStart = findLine(/^        onMount: mountEl => \{/, preludeEnd) + 1;
  let onMountEnd = -1;
  for (let i = onMountStart; i < lines.length; i++) if (/^          return \{\s*$/.test(lines[i]) && /destroy\(\)/.test(lines[i + 1])) { onMountEnd = i; break; }
  const bodyStart = findLine(/^        body: `/, onMountEnd);
  const bodyEnd = findLine(/^          `,\s*$/, bodyStart);
  const prelude = lines.slice(branch + 1, preludeEnd + 1).join('\n');
  const onMountBody = lines.slice(onMountStart, onMountEnd).join('\n');
  const body = lines.slice(bodyStart, bodyEnd + 1).join('\n').replace(/^        body: `/, '        const __body = `').replace(/`,\s*$/, '`;');
  const harnessFn = `
  function __设计台挂载(snapshot, previewKey) {
    // 只在注入函数内遮蔽：写回/缓存/toast/纯视觉增强 → 记录或空操作
    const replaceStatDataByEditor = u => { globalThis.__HLOG.updates.push(u); return Promise.resolve(true); };
    const showUiToast = (text, type) => { globalThis.__HLOG.toasts.push({ text, type }); };
    const readCachedSkillDesignerDraft = () => null;
    const writeCachedSkillDesignerDraft = () => {};
    const clearCachedSkillDesignerDraft = () => {};
    const refreshLiveSnapshot = () => Promise.resolve(null);
    const 装配技能设计台分页 = () => {};
    const 装配技能设计台效果分层 = () => {};
    const 装配技能设计台条件分支分层 = () => {};
    const 增强技能设计台下拉控件 = () => {};
    const 挂载技能设计标题操作 = () => null;
    const buildSkillDesignerUpdatedSkill = (...a) => { const s = __原buildSkillDesignerUpdatedSkill(...a); globalThis.__HLOG.lastSkill = s; return s; };
    const readSkillDesignerFormState = (...a) => { const s = __原readSkillDesignerFormState(...a); globalThis.__HLOG.lastFormState = s; return s; };
${prelude}
${body}
    const mountEl = __MiniDOM.parseFragment(__body);
    const __mount = mountEl => {
${onMountBody}
      return { form, handleChange, handleInput, handleClick, handleSubmit, syncDraftCache, refreshPreview, rebuildPrototypeRowFields, syncConditionRow, syncScalingField, 同步原型行默认驱动判定 };
    };
    const __h = __mount(mountEl);
    return { previewMeta, skillSource, rawDesignerDraft, designerDraft, html: __body, mountEl, ...__h };
  }`;
  // 截断点之前的代码与注入函数里引用、但定义在截断点之后的顶层名字 → 记录型桩
  const after = new Map();
  A.stmts.forEach(s => { if (s.line - 1 >= CUT) s.names.forEach(n => { if (!after.has(n)) after.set(n, s); }); });
  const before = new Set();
  A.stmts.forEach(s => { if (s.line - 1 < CUT) s.names.forEach(n => before.add(n)); });
  const need = new Set();
  A.stmts.forEach(s => { if (s.line - 1 < CUT) s.refs.forEach(r => { if (after.has(r) && !before.has(r)) need.add(r); }); });
  freeIdents(harnessFn).forEach(r => { if (after.has(r) && !before.has(r)) need.add(r); });
  const stubs = [...need].map(n => `  function ${n}(...a) { return globalThis.__HSTUB(${JSON.stringify(n)}, a); }`).join('\n');
  const exportNames = [
    'readSkillDesignerDraft', 'buildSkillDesignerFormStateFromDraft', 'readSkillDesignerFormState', 'buildSkillDesignerUpdatedSkill', 'buildSkillDesignerWriteUpdates',
    '构建技能设计台临时技能', '构建技能设计台当前翻译摘要', '构建技能设计台原型效果行列表', '构建技能设计台副作用行列表', '构建技能设计台原型字段编辑器', '构建技能设计台预算上下文',
    'getSkillDesignerFusionDraftSeed', 'buildSkillDesignerPreviewKey', 'parseSkillDesignerPreviewKey', '读取技能设计台原型效果状态', '技能设计台清理并水合原型效果',
    '规范化技能设计台原型效果列表', '创建技能设计台默认原型效果', '创建技能设计台默认条件分支', '创建技能设计台默认副作用条目', '构建技能设计台条件分支条目编辑器', '构建技能设计台条件分支条件编辑器',
    'SKILL_DESIGNER_PROTOTYPE_REGISTRY', '读取技能设计台原型名称列表', 'buildSkillDesignerSimulationHtml',
  ];
  const tail = `
${stubs}
  const __原buildSkillDesignerUpdatedSkill = buildSkillDesignerUpdatedSkill;
  const __原readSkillDesignerFormState = readSkillDesignerFormState;
${harnessFn}
  globalThis.__B = { ${exportNames.join(', ')}, __设计台挂载,
    setLive(v) { liveSnapshot = v; lastRenderableSnapshot = v; } };
})();`;
  return { code: lines.slice(0, CUT).join('\n') + '\n' + tail, CUT, stubs: [...need] };
}

function load(options = {}) {
  const ctx = { console: options.quiet ? { log() {}, warn() {}, error() {}, info() {}, debug() {} } : console, structuredClone, setTimeout, clearTimeout, setInterval, clearInterval, performance, Intl, URL, TextEncoder, TextDecoder, queueMicrotask, encodeURIComponent, decodeURIComponent };
  ctx.globalThis = ctx; ctx.window = ctx; ctx.self = ctx;
  ctx.document = deepStub(); ctx.navigator = deepStub();
  ctx.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; ctx.sessionStorage = ctx.localStorage;
  Object.assign(ctx, { HTMLElement: D.HTMLElement, HTMLInputElement: D.HTMLInputElement, HTMLSelectElement: D.HTMLSelectElement, HTMLTextAreaElement: D.HTMLTextAreaElement, HTMLOptionElement: D.HTMLOptionElement, HTMLButtonElement: D.HTMLButtonElement, Element: D.Element, Node: D.Node });
  ctx.MutationObserver = class { observe() {} disconnect() {} }; ctx.ResizeObserver = ctx.MutationObserver; ctx.IntersectionObserver = ctx.MutationObserver;
  ctx.CustomEvent = class {}; ctx.Event = class {};
  ctx.addEventListener = () => {}; ctx.removeEventListener = () => {};
  ctx.requestAnimationFrame = () => 0; ctx.cancelAnimationFrame = () => {};
  ctx.getComputedStyle = () => deepStub();
  ctx.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  ctx.__LWCS_MESSAGE_SEMANTICS_V1__ = deepStub();
  ctx.__MiniDOM = D;
  const log = { toasts: [], updates: [], stubCalls: [], toastr: [] };
  ctx.__HLOG = log;
  ctx.toastr = { warning: (m, t) => log.toastr.push({ level: 'warn', text: m, title: t }), info: (m, t) => log.toastr.push({ level: 'info', text: m, title: t }), error: (m, t) => log.toastr.push({ level: 'error', text: m, title: t }), success() {} };
  ctx.__HSTUB = (name, args) => {
    log.stubCalls.push(name);
    if (name === 'showUiToast') { log.toasts.push({ text: args[0], type: args[1] }); return undefined; }
    if (name === 'replaceStatDataByEditor') { log.updates.push(args[0]); return Promise.resolve(true); }
    if (/^(readCachedSkillDesignerDraft|buildSkillDesignConfirmState)$/.test(name)) return null;
    if (/^(refreshLiveSnapshot|dispatchUiAiRequest)$/.test(name)) return Promise.resolve(null);
    return undefined;
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(LW + 'MVU_Skill_Runtime.js', 'utf8'), ctx, { filename: 'MVU_Skill_Runtime.js' });
  const { code, stubs } = build();
  vm.runInContext(code, ctx, { filename: 'bridge_cut.js' });
  ctx.__stubs = stubs;
  return ctx;
}
module.exports = { load, build };
if (require.main === module) {
  const ctx = load();
  console.log('bridge loaded:', !!ctx.__B, 'stubs:', ctx.__stubs.length, ctx.__stubs.join(' '));
}

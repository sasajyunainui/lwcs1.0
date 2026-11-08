// 生成 proto/designer-model.js：原版顶层代码（依赖闭包，逐字抽取）+ 预览页局部代码切片 + 手写移植层 api.js
'use strict';
const fs = require('fs');
const path = require('path');
const { analyze, closure } = require('./analyze.js');
const roots = require('./roots.js');
const OUT = path.join(__dirname, '..', 'designer-model.js');

const A = analyze();
const lines = A.src.split(/\r?\n/);
// 由宿主数据读取的函数改为模型内桩（见 api.js 顶部）
const EXCLUDE = new Set(['readLatestMvuDataByEditor']);
// 移植层里直接引用的原版顶层名字也纳入闭包起点
const ts = require(require('path').join(__dirname, '..', '..', '..', 'node_modules', 'typescript'));
const apiSrc = ['api.js', 'api2.js'].map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
const apiRefs = new Set();
(function visit(n) { if (ts.isIdentifier(n)) { const p = n.parent; const isProp = p && ((ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n) || (ts.isMethodDeclaration(p) && p.name === n)); if (!isProp) apiRefs.add(n.text); } ts.forEachChild(n, visit); })(ts.createSourceFile('api.js', '(function(){' + apiSrc + '})', ts.ScriptTarget.Latest, true, ts.ScriptKind.JS));
const apiDeclared = new Set([...apiSrc.matchAll(/^  (?:function\*?|const|let) ([^\s(=]+)/gm)].map(m => m[1]));
const 扩展根 = [...roots, ...[...apiRefs].filter(n => A.declMap.has(n) && !apiDeclared.has(n) && !EXCLUDE.has(n))];
const { need, missing } = closure(A, 扩展根, EXCLUDE);
if (missing.size) throw new Error('缺少根符号：' + [...missing].join(' '));
const picked = [...need].sort((a, b) => a - b).map(i => A.stmts[i]);
const 冲突 = picked.flatMap(st => st.names).filter(n => apiDeclared.has(n));
if (冲突.length) throw new Error('移植层与原版顶层重名：' + 冲突.join(' '));
let extracted = picked.map(s => `  // —— B:${s.line}${s.endLine > s.line ? '-' + s.endLine : ''}\n` + A.src.slice(s.start, s.end).replace(/^/, '  ')).join('\n');

// 有意偏离桥接原版的规则：以开关织入抽取出的代码（[原文, 替换]，须恰好命中 1 处）。
// 目前为空——用户定的规则改动已直接落在桥接里（2026-11-08：战斗外原型任何来源可存、保存不丢条件分支），抽取即为现行规则。
const 偏离 = [];
for (const [from, to] of 偏离) {
  const n = extracted.split(from).length - 1;
  if (n !== 1) throw new Error(`偏离规则须恰好命中 1 处（实际 ${n}）：${from.slice(0, 60)}`);
  extracted = extracted.replace(from, to);
}

// 预览页「技能设计台」分支里的局部量（模板上下文：推荐属性、融合选项、标题提示表…）逐字切片
const findLine = (re, from = 0) => { for (let i = from; i < lines.length; i++) if (re.test(lines[i])) return i; return -1; };
const branch = findLine(/^    if \(String\(previewKey \|\| ''\)\.startsWith\(SKILL_DESIGNER_PREVIEW_PREFIX\)\) \{/);
const ctxStart = findLine(/^      const recommendedAttrs = new Set\(/, branch);
const ctxEnd = findLine(/^      const 标题提示 = 标题 => /, ctxStart); // 不含
if (branch < 0 || ctxStart < 0 || ctxEnd < 0) throw new Error('预览页切片定位失败');
const templateCtx = lines.slice(ctxStart, ctxEnd).join('\n');
const 局部名 = [...templateCtx.matchAll(/^      const (?:\{ charData: )?([^\s=}]+)/gm)].map(m => m[1]);

const api = apiSrc;
const head = `/*
 * LWCS 技能设计台数据层（独立浏览器脚本）
 * ------------------------------------------------------------------
 * 用途：给新 UI 原型提供与原版 SillyTavern 技能设计台（lwcs/mvu_logic_bridge.js）一致的
 *       「技能 → 表单 → 字段描述 → 保存技能 / 临时技能 / 摘要 / 校验」数据层，不含任何 DOM 渲染。
 * 依赖：页面须先加载 MVU_Skill_Runtime.js（提供 __LWCS_SKILL_MECHANISM_REGISTRY__、
 *       __LWCS_COMPILE_SKILL_STRUCTURE_TEXT__、__LWCS_SKILL_COST_HELPERS_V1__ 等）。
 * 结构：
 *   一、原版代码：由 build_model.js 依赖闭包从 bridge 逐字抽取（每段标注 B:行号），勿手改；
 *   二、预览页局部量切片：技能设计台分支内的模板上下文（标题提示表、融合选项等），逐字切片；
 *   三、移植层：把原版「渲染 HTML → 挂载同步 → DOM 回读」改写为纯数据，并对外暴露 window.LWCS_DESIGNER_MODEL。
 * 生成时间：${new Date().toISOString()}；抽取 ${picked.length} 段顶层声明。
 *
 * 用法（M = window.LWCS_DESIGNER_MODEL，root 缺省用 setRoot() 的值，再缺省 window.LWCS_SAVE）：
 *   const meta = M.meta.ring('唐凌雪','第1武魂','第1魂灵','第2魂环','第2魂技', 魂技名);   // 也有 fusion / art / custom / independentRing
 *   const s = M.session(null, meta, root);      // 推荐：有状态会话，保留虚拟 DOM，与原版设计台同生命周期
 *   s.view()  → { sections[{id,title,tab,hint,visible,fields}], rows[{path,prototypeSelect,fields}], sideEffects, preview:{summary,…} }
 *   s.act({ type:'effectField', path:[0], key:'数值', value:'-20%' })   // 动作见 act 说明；返回会话本身
 *   s.save() → { ok, skill, updates, messages }   s.toSkill() / s.tempSkill() / s.summary() / s.validate()
 *   无状态版：fromSkill / open / toSkill / save / tempSkill / summary / validate / act / view / schema.fields(effect, ctx)
 * 规则（与桥接现行代码一致）：任何来源都能保存修炼增益 / 战斗外复活；保存时忙碌态禁用的控件照常回读，条件分支不丢。
 * 规则开关：M.rules.物品被动保持承载方式（默认开）→ 物品技能（装备 / 魂骨附带）的「被动」开关 ⇔ 承载方式「被动」。
 */
(function () {
  if (typeof globalThis === 'undefined' || !globalThis.__LWCS_SKILL_MECHANISM_REGISTRY__) {
    console.error('[LWCS_DESIGNER_MODEL] 未检测到 __LWCS_SKILL_MECHANISM_REGISTRY__：请先加载 MVU_Skill_Runtime.js 再加载本脚本。');
  }
  // ════════════════ 一、原版代码（逐字抽取） ════════════════
`;
const part2 = `
  // ════════════════ 二、预览页局部量（B:${ctxStart + 1}-${ctxEnd}，逐字切片） ════════════════
  function 设计台模板上下文(snapshot, previewMeta, designerDraft) {
${templateCtx}
    return { ${局部名.join(', ')} };
  }
`;
const out = head + extracted + '\n' + part2 + '\n  // ════════════════ 三、移植层 ════════════════\n' + api + '\n})();\n';
fs.writeFileSync(OUT, out);
console.log('写出', OUT, (out.length / 1024).toFixed(0) + 'KB', '抽取段数', picked.length, '模板局部量', 局部名.join(','));

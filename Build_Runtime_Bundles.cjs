const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

const 工作目录 = __dirname;
const 指定输出 = new Set(process.argv.slice(2));
const 需要构建 = 输出文件 => 指定输出.size === 0 || 指定输出.has(输出文件);
// 球体座舱（新状态栏界面）：框架 → 页面 → 技能设计台（数据层 / 试算 / 界面）。顺序即加载顺序
const 座舱脚本列表 = Object.freeze([
  'cockpit/designer-model.js',
  'cockpit/locations.js',
  'cockpit/cockpit.js',
  'cockpit/pages-role.js',
  'cockpit/designer-sim.js',
  'cockpit/designer-ui.js',
  'cockpit/pages-ability.js',
  'cockpit/pages-supplies.js',
  'cockpit/pages-map.js',
  'cockpit/pages-world.js',
  'cockpit/pages-terminal.js',
]);
const 打包定义 = Object.freeze({
  'MVU_Engine_Bundle.js': [
    'LWCS_Message_Semantics.js',
    'LWCS_Persistence_Adapter.js',
    'LWCS_MVU_Persistence_Provider.js',
    'MVU_Engine_Runtime.js',
  ],
  'LWCS_MVU_Project_Runtime_Bundle.js': [
    'LWCS_TT_AutoUpdate_Debug.js',
    'LibraryData_Runtime.js',
    'EraDataRegistry.js',
    'EraCurrencyRegistry.js',
    'TimelineRuntime.js',
    'EraRuntime_Integration.js',
    'EraCultivation_Runtime.js',
    'IntelEvents.js',
    'MVU_Skill_Runtime.js',
    'MVU_Schema_Runtime.js',
    'MVU_Competition_Runtime.js',
    'MVU_Runtime_View.js',
  ],
  'LWCS_Era_Current_Data_Bundle.js': [
    'CharacterLibrary.js',
    'ItemLibrary.js',
    'FactionLibrary.js',
    'LocationLibrary.js',
    'timeline.js',
  ],
  'LWCS_UI_Integration_Bundle.js': [
    'LWCS_Message_Semantics.js',
    'LWCS_Host_Compatibility.js',
    'LWCS_TT_AutoUpdate_Debug.js',
    'LWCS_Database_Adapter.js',
    'mvu_logic_bridge.js',
    ...座舱脚本列表,
  ],
  // R11 战斗线程包：在 Web Worker 里加载的第二份战斗引擎（并行估值候选），不含任何界面模块；顺序即加载顺序
  'LWCS_Battle_Worker_Bundle.js': [
    'MVU_Skill_Runtime.js',
    'MVU_Schema_Runtime.js',
    'BattlePreview_Module.js',
    'BehaviorDecisionPipeline_Module.js',
    'BattleDecision_Module.js',
    'BattleRuntime_Module.js',
  ],
  'LWCS_UI_Gameplay_Bundle.js': [
    'TradeUI_Module.js',
    'ProfessionUI_Module.js',
    'CompetitionPrivilegeUI_Module.js',
    'BattlePreview_Module.js',
    'BehaviorDecisionPipeline_Module.js',
    'BattleDecision_Module.js',
    'BattleRuntime_Module.js',
    'BattleReport_Module.js',
    'BattleUI_Module.js',
  ],
  'LWCS_UI_Runtime_Bundle.js': [
    'LWCS_Message_Semantics.js',
    'LWCS_Host_Compatibility.js',
    'LWCS_TT_AutoUpdate_Debug.js',
    'LWCS_Database_Adapter.js',
    'mvu_logic_bridge.js',
    ...座舱脚本列表,
    'TradeUI_Module.js',
    'ProfessionUI_Module.js',
    'CompetitionPrivilegeUI_Module.js',
    'BattlePreview_Module.js',
    'BehaviorDecisionPipeline_Module.js',
    'BattleDecision_Module.js',
    'BattleRuntime_Module.js',
    'BattleReport_Module.js',
    'BattleUI_Module.js',
    'Database_Module.js',
  ],
});

const 座舱样式列表 = Object.freeze([
  'cockpit/cockpit.css',
  'cockpit/cockpit-v6.css',
  'cockpit/cockpit-motion.css',
  'cockpit/cockpit-home.css',
  'cockpit/cockpit-pages.css',
  'cockpit/designer-ui.css',
  'cockpit/cockpit-battle.css',
  'cockpit/cockpit-embed.css',
]);

const 样式源文件列表 = Object.freeze([
  ['lwcs-style-mvu-core', 'mvu_styles.css'],
  ['lwcs-style-soul-ring', 'soul_ring_engine.css'],
  ['lwcs-style-cockpit', 座舱样式列表, 作用域化座舱样式],
]);

// 座舱样式作用域化：所有选择器收到 .lwcs-ck 之下（座舱根与 body 级浮层容器都带这个类），:root / html / body 映射为 .lwcs-ck；
// 原型页的 body 页面级规则不带进来（嵌入后的根样式在 cockpit-embed.css）；@keyframes 统一加 ck- 前缀并改写引用，避免与酒馆 / 旧界面同名动画互相覆盖。
// 不依赖外部 CSS 解析库：去注释后按花括号配对递归处理 @media / @container / @supports，其余 @ 规则原样保留
function 作用域化座舱样式(全文) {
  const 作用域 = '.lwcs-ck';
  const 文本 = 全文.replace(/\/\*[\s\S]*?\*\//g, '');
  const 动画名 = new Set([...文本.matchAll(/@keyframes\s+([\w-]+)/g)].map(m => m[1]));
  const 配对 = (s, i) => { let d = 0; for (let j = i; j < s.length; j++) { if (s[j] === '{') d++; else if (s[j] === '}' && --d === 0) return j; } throw new Error('座舱样式花括号不配对'); };
  const 拆选择器 = sel => { const out = []; let d = 0, cur = ''; for (const ch of sel) { if (ch === '(' || ch === '[') d++; else if (ch === ')' || ch === ']') d--; if (ch === ',' && d === 0) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(x => x.trim()).filter(Boolean); };
  // 已经以作用域类开头的（座舱根 / 浮层容器自身的规则）原样保留
  const 加前缀 = sel => 拆选择器(sel).map(x => /^\.lwcs-ck/.test(x) ? x : /^(:root|html|body)$/.test(x) ? 作用域 : /^(:root|html|body)[\s>]/.test(x) ? 作用域 + x.replace(/^(:root|html|body)/, '') : `${作用域} ${x}`).join(',');
  const 改动画 = body => body.replace(/(animation(?:-name)?\s*:)([^;}]*)/g, (m, k, v) => k + v.replace(/[\w-]+/g, w => 动画名.has(w) ? 'ck-' + w : w));
  const 处理 = s => {
    let out = '', i = 0;
    while (i < s.length) {
      const 开 = s.indexOf('{', i);
      if (开 < 0) { out += s.slice(i).trim() ? s.slice(i) : ''; break; }
      const 前 = s.slice(i, 开).trim(), 闭 = 配对(s, 开), 体 = s.slice(开 + 1, 闭);
      if (/^@(media|container|supports|layer)\b/.test(前)) out += `${前}{${处理(体)}}`;
      else if (/^@keyframes\s/.test(前)) out += `${前.replace(/@keyframes\s+([\w-]+)/, (m, n) => '@keyframes ck-' + n)}{${体}}`;
      else if (/^@/.test(前)) out += `${前}{${体}}`;
      else if (/^body$/.test(前)) { /* 原型页的页面级 body 规则，嵌入后不用 */ }
      else out += `${加前缀(前)}{${改动画(体)}}`;
      i = 闭 + 1;
    }
    return out;
  };
  return 处理(文本);
}

function 读取源文件(文件名) {
  const 原始内容 = readFileSync(resolve(工作目录, 文件名), 'utf8').replace(/^\uFEFF/, '');
  const ESM数据源 = {
    'IntelEvents.js': ['IntelEvents', 'IntelEvents'],
    'timeline.js': ['TimelineEvents', '__LWCS_TIMELINE_SOURCE_current__'],
  }[文件名];
  let 内容 = 原始内容;
  if (ESM数据源) {
    const [导出名, 全局键] = ESM数据源;
    const 导出声明 = `export const ${导出名} =`;
    if (!内容.startsWith(导出声明)) throw new Error(`${文件名} 缺少预期导出声明: ${导出声明}`);
    内容 = 内容.replace(导出声明, `const ${导出名} =`) + `\n;[globalThis, globalThis.parent, globalThis.top].forEach(目标 => { try { if (目标) 目标[${JSON.stringify(全局键)}] = ${导出名}; } catch (_) {} });`;
  }
  return {
    文件名,
    内容,
    哈希: createHash('sha256').update(原始内容, 'utf8').digest('hex'),
  };
}

for (const [输出文件, 源文件列表] of Object.entries(打包定义)) {
  if (!需要构建(输出文件)) continue;
  const 源记录 = 源文件列表.map(读取源文件);
  const 清单 = 源记录.map(({ 文件名, 哈希 }) => `${文件名}:${哈希}`).join('|');
  const 内容 = [
    '/* 此文件由 Build_Runtime_Bundles.cjs 生成，禁止直接编辑。 */',
    `/* sources-sha256: ${清单} */`,
    ...源记录.map(({ 文件名, 内容: 源码 }) => `/* source: ${文件名} */\n${源码}`),
    '',
  ].join('\n;\n');
  writeFileSync(resolve(工作目录, 输出文件), 内容, 'utf8');
  console.log(`${输出文件}\t${Buffer.byteLength(内容, 'utf8')} bytes\t${源文件列表.length} sources`);
}

if (需要构建('LWCS_UI_Styles_Bundle.js')) {
  const 样式源记录 = 样式源文件列表.map(([节点ID, 文件名, 转换]) => {
    const 列表 = [].concat(文件名).map(读取源文件), 原文 = 列表.map(r => r.内容).join('\n');
    return { 节点ID, 文件名: 列表.map(r => r.文件名).join('+'), 内容: 转换 ? 转换(原文) : 原文, 哈希: 列表.map(r => r.哈希).join('+') };
  });
  const 样式清单 = 样式源记录.map(({ 文件名, 哈希 }) => `${文件名}:${哈希}`).join('|');
  const 样式内容 = [
    '/* 此文件由 Build_Runtime_Bundles.cjs 生成，禁止直接编辑。 */',
    `/* sources-sha256: ${样式清单} */`,
    '(function () {',
    "  'use strict';",
    `  const styles = ${JSON.stringify(样式源记录.map(({ 节点ID, 内容 }) => ({ id: 节点ID, text: 内容 })))};`,
    '  for (const style of styles) {',
    '    let node = document.getElementById(style.id);',
    "    if (!node || node.tagName !== 'STYLE') {",
    "      node = document.createElement('style');",
    '      node.id = style.id;',
    '      document.head.appendChild(node);',
    '    }',
    '    if (node.textContent !== style.text) node.textContent = style.text;',
    '  }',
    '  globalThis.__LWCS_UI_STYLES_READY_V1__ = true;',
    '})();',
    '',
  ].join('\n');
  writeFileSync(resolve(工作目录, 'LWCS_UI_Styles_Bundle.js'), 样式内容, 'utf8');
  console.log(`LWCS_UI_Styles_Bundle.js\t${Buffer.byteLength(样式内容, 'utf8')} bytes\t${样式源记录.length} sources`);
}

const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

const 工作目录 = __dirname;
const 指定输出 = new Set(process.argv.slice(2));
const 需要构建 = 输出文件 => 指定输出.size === 0 || 指定输出.has(输出文件);
const 打包定义 = Object.freeze({
  'MVU_Engine_Bundle.js': [
    'LWCS_Persistence_Adapter.js',
    'LWCS_MVU_Persistence_Provider.js',
    'MVU_Engine_Runtime.js',
  ],
  'LWCS_MVU_Project_Runtime_Bundle.js': [
    'LWCS_MVU_Prompt_Projector.js',
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
    'LWCS_Database_Adapter.js',
    'mvu_logic_bridge.js',
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
    'LWCS_Database_Adapter.js',
    'mvu_logic_bridge.js',
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

const 样式源文件列表 = Object.freeze([
  ['lwcs-style-mvu-core', 'mvu_styles.css'],
  ['lwcs-style-soul-ring', 'soul_ring_engine.css'],
]);

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
  const 样式源记录 = 样式源文件列表.map(([节点ID, 文件名]) => ({ 节点ID, ...读取源文件(文件名) }));
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

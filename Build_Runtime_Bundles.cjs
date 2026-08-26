const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

const 工作目录 = __dirname;
const 打包定义 = Object.freeze({
  'LWCS_MVU_Persistence_Bundle.js': [
    'LWCS_Persistence_Adapter.js',
    'LWCS_MVU_Persistence_Provider.js',
    'LWCS_MVU_Prompt_Projector.js',
  ],
  'LWCS_MVU_Era_Runtime_Bundle.js': [
    'LibraryData_Runtime.js',
    'EraDataRegistry.js',
    'EraCurrencyRegistry.js',
    'TimelineRuntime.js',
    'EraRuntime_Integration.js',
    'EraCultivation_Runtime.js',
  ],
  'LWCS_MVU_Schema_Runtime_Bundle.js': [
    'MVU_Skill_Runtime.js',
    'MVU_Schema_Runtime.js',
    'MVU_Competition_Runtime.js',
    'MVU_Runtime_View.js',
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
});

for (const [输出文件, 源文件列表] of Object.entries(打包定义)) {
  const 源记录 = 源文件列表.map(文件名 => {
    const 内容 = readFileSync(resolve(工作目录, 文件名), 'utf8').replace(/^\uFEFF/, '');
    return {
      文件名,
      内容,
      哈希: createHash('sha256').update(内容, 'utf8').digest('hex'),
    };
  });
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

// 规则回归（2026-11-08 用户定的规则改动，均为现行默认）：
// 物品被动保持承载方式、任何来源可存战斗外原型、造物无双行动抵扣、保存不丢条件分支；普通魂技被动开关默认关
'use strict';
global.window = globalThis;
const { load } = require('./load_model.js');
require('./save-data.js');
const { buildRoot } = require('./cases.js');

const ctx = load(), M = ctx.LWCS_DESIGNER_MODEL;
const { root } = buildRoot(globalThis.LWCS_SAVE);
const rootJ = JSON.stringify(root), 新根 = () => require('vm').runInContext(`JSON.parse(${JSON.stringify(rootJ)})`, ctx);
const 结果 = [];
const 断言 = (名, 条件, 详情 = '') => 结果.push([名, !!条件, 详情]);
const 条件分支数 = skill => (JSON.stringify(skill || {}).match(/条件分支/g) || []).length;

// 1 物品被动（武器定义技能 沉银叠锤：被动 + 修炼增益）存成被动；关掉被动开关存成直接生效
const r0 = 新根(), 定义 = r0.物品.近战武器.千锻沉银锤.装备技能.沉银叠锤;
const s1 = M.session(定义, M.meta.equip('唐舞麟', '武器', '沉银叠锤', '沉银叠锤'), r0), v1 = s1.save();
断言('物品被动可保存且仍为被动', v1.ok && v1.skill.承载方式 === '被动', JSON.stringify(v1.messages));
s1.act({ type: 'top', key: '启用被动', value: false });
断言('关掉被动开关存成直接生效', s1.save().skill.承载方式 === '直接生效');
// 2 普通魂技换成战斗外原型：不再被拦截，只剩 COST 校验
const s2 = M.session(null, M.meta.ring('刘语心', '第1武魂', '第1魂灵', '第2魂环', '第2魂技'), 新根());
s2.act({ type: 'prototype', path: [0], value: '修炼增益' });
const t2 = s2.save().messages.map(m => m.text).join();
断言('魂技换修炼增益不被拦截', !/战斗外原型不可保存/.test(t2), t2);
// 3 造物承载：无双行动抵扣
const b3 = M.session(null, M.meta.ring('唐凌雪', '第1武魂', '第1魂灵', '第1魂环', '第1魂技'), 新根()).save().budget;
断言('造物承载无双行动抵扣', !(b3?.限制明细 || []).some(x => x.限制来源 === '造物双行动' && Number(x.限制抵扣率) > 0) && !b3?.限制COST, `限制COST=${b3?.限制COST}`);
// 4 普通魂技（非物品）被动开关默认关
const s4 = M.session(null, M.meta.ring('刘语心', '第1武魂', '第1魂灵', '第1魂环', '第1魂技'), 新根());
断言('魂技被动开关默认关', s4.view().sections.flatMap(x => x.fields).find(f => f.key === '启用被动')?.value === false);
// 5 默认保存（模拟原版保存时的忙碌态）保留条件分支：找夹具里带条件分支的技能，默认保存与 keepConditionBranches 结果一致
const 带分支 = [];
for (const [名, 角色] of Object.entries(新根().char || {})) {
  for (const [武魂键, 武魂] of Object.entries(角色 || {})) if (/^第\d武魂$/.test(武魂键)) for (const [灵键, 灵] of Object.entries(武魂 || {})) if (/^第\d魂灵$/.test(灵键))
    for (const [环键, 环] of Object.entries(灵 || {})) if (/^第\d魂环$/.test(环键)) { const 技键 = 环键.replace('魂环', '魂技'); if (条件分支数(环?.[技键]) > 0) 带分支.push([名, 武魂键, 灵键, 环键, 技键]); }
}
断言('夹具里有带条件分支的技能', 带分支.length > 0, '无');
for (const p of 带分支.slice(0, 4)) {
  const 默认 = M.session(null, M.meta.ring(...p), 新根()).save(), 保留 = M.session(null, M.meta.ring(...p), 新根()).save({ keepConditionBranches: true });
  断言(`默认保存保留条件分支 ${p[0]}·${p[3]}`, 条件分支数(默认.skill) > 0 && 条件分支数(默认.skill) === 条件分支数(保留.skill), `默认 ${条件分支数(默认.skill)} / 保留 ${条件分支数(保留.skill)}`);
}
for (const [名, ok, 详情] of 结果) console.log(`[${ok ? ' OK ' : 'FAIL'}] ${名}${ok ? '' : '  ' + 详情}`);
const 失败 = 结果.filter(x => !x[1]).length;
console.log(`规则回归 ${结果.length} 项：通过 ${结果.length - 失败}，失败 ${失败}`);
process.exitCode = 失败 ? 1 : 0;

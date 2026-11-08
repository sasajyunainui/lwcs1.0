// 在独立 vm 上下文里加载 MVU_Skill_Runtime.js + proto/designer-model.js（模拟原型页加载顺序）
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const LW = require('path').join(__dirname, '..', '..') + '/';
function load() {
  const ctx = { console, structuredClone, setTimeout, clearTimeout, performance, Intl, URL, encodeURIComponent, decodeURIComponent };
  ctx.globalThis = ctx; ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(LW + 'MVU_Skill_Runtime.js', 'utf8'), ctx, { filename: 'MVU_Skill_Runtime.js' });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'designer-model.js'), 'utf8'), ctx, { filename: 'designer-model.js' });
  if (!ctx.LWCS_DESIGNER_MODEL) throw new Error('LWCS_DESIGNER_MODEL 未导出');
  return ctx;
}
module.exports = { load };
if (require.main === module) { const c = load(); console.log('model ok', Object.keys(c.LWCS_DESIGNER_MODEL)); }

!(function () {
  'use strict';

  const 终极斗罗物品库 = {};

  Object.values(终极斗罗物品库).forEach(分类表 => {
    Object.values(分类表 || {}).forEach(物品定义 => Object.freeze(物品定义));
    Object.freeze(分类表);
  });
  Object.freeze(终极斗罗物品库);

  globalThis.__LWCS_终极斗罗物品库__ = 终极斗罗物品库;
  try { if (globalThis.parent && globalThis.parent !== globalThis) globalThis.parent.__LWCS_终极斗罗物品库__ = 终极斗罗物品库; } catch (错误) {}
  try { if (globalThis.top && globalThis.top !== globalThis) globalThis.top.__LWCS_终极斗罗物品库__ = 终极斗罗物品库; } catch (错误) {}
})();

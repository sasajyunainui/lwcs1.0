/* 座舱地点解析：各页共用 */
(() => {
  // 斗一 / 斗二的地点库按完整路径实例化：位置串和存档地点树都以「斗罗大陆」为根，城市挂在根的子节点下；斗三库没有这一层；
  // 斗四是「星系 / 行星 / 城市」三层。各页统一经这里跳过根、取所在城市
  const ROOTS = new Set(['斗罗大陆', '斗罗星际']);
  const isTown = n => /城|都|镇|村|聚落/.test(String(n?.类型 || ''));
  window.LWCS_COCKPIT_LOC = (S, rt) => {
    // 时代地图配置（斗一斗罗大陆1地图、斗二 / 斗三 MAP、斗四星际总图）；原型页没有时代运行时，按陆地处理
    const profile = () => { try { const p = rt?.('__LWCS_ERA_RUNTIME_INTEGRATION_V1__')?.getMapProfileForTick?.(Number(S?.world?.时间?.tick)); if (p?.asset) return p; } catch (e) { /* 时间未就绪 */ } return { asset: 'MAP.webp', topology: 'terrestrial' }; };
    const stellar = () => profile().topology === 'stellar';
    const rootKey = () => { const w = S?.world?.地点 || {}; return Object.keys(w).find(k => ROOTS.has(k) && w[k]?.子节点) || ''; };
    // 存档地点树的顶层（已跳过根）；写回时由 path 补回真实键路径
    const top = () => { const w = S?.world?.地点 || {}, r = rootKey(); return r ? { ...Object.fromEntries(Object.entries(w).filter(([k]) => k !== r)), ...w[r].子节点 } : w; };
    const path = names => { const r = rootKey(), lead = r && (S.world.地点[r].子节点 || {})[names[0]] ? [r, '子节点'] : []; return ['world', '地点', ...lead, ...names.flatMap((n, i) => i ? ['子节点', n] : [n])]; };
    const segs = pos => String(pos || '').split('-').filter(p => p && !ROOTS.has(p));
    // 位置串逐段落到存档地点树上；树上没有的段跳过
    const chain = pos => { const out = []; let pool = top(); for (const p of segs(pos)) if (pool && pool[p]) { out.push([p, pool[p]]); pool = pool[p].子节点 || {}; } return out; };
    // 所在城市：链上第一个城镇类地点；没有时陆地取顶层、斗四取第三层
    const cityIndex = ch => { const i = ch.findIndex(([, n]) => isTown(n)); return i >= 0 ? i : Math.min(stellar() ? 2 : 0, Math.max(0, ch.length - 1)); };
    const city = pos => { const ch = chain(pos), ci = cityIndex(ch), e = ch[ci]; return { chain: ch, ci, name: e?.[0] || '', node: e?.[1] || {}, path: e ? path(ch.slice(0, ci + 1).map(x => x[0])) : null }; };
    return { roots: ROOTS, isTown, profile, stellar, rootName: () => stellar() ? '斗罗星际' : '斗罗大陆', top, path, segs, chain, cityIndex, city };
  };
  // 不依赖存档的部分也挂在工厂上，页面模块顶层可直接用
  Object.assign(window.LWCS_COCKPIT_LOC, { roots: ROOTS, isTown });
})();

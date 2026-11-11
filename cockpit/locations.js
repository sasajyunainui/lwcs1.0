/* 座舱地点解析：各页共用 */
(() => {
  // 存档地点树的解析（跳过「斗罗大陆」根、所在城市、真实键路径）与交易模块、桥接共用 LWCS_Location_Path.js；这里只补时代地图配置，
  // 并转成座舱页面用的形状：chain 为 [名称, 节点]，top 为 { 名称: 节点 }
  const P = (typeof globalThis !== 'undefined' ? globalThis : window).__LWCS_LOCATION_PATH_V1__;
  window.LWCS_COCKPIT_LOC = (S, rt) => {
    // 时代地图配置（斗一斗罗大陆1地图、斗二 / 斗三 MAP、斗四星际总图）；原型页没有时代运行时，按陆地处理
    const profile = () => { try { const p = rt?.('__LWCS_ERA_RUNTIME_INTEGRATION_V1__')?.getMapProfileForTick?.(Number(S?.world?.时间?.tick)); if (p?.asset) return p; } catch (e) { /* 时间未就绪 */ } return { asset: 'MAP.webp', topology: 'terrestrial' }; };
    const stellar = () => profile().topology === 'stellar';
    const top = () => Object.fromEntries(Object.entries(P.top(S)).map(([k, e]) => [k, e.node]));
    // 写回路径：按名称逐级落到地点树上取真实键（斗一 / 斗二补回根）；树上没有时按顶层拼
    const path = names => { const hit = P.chain(S, names.join('-')); return hit.length === names.length ? hit.at(-1).keys : ['world', '地点', ...names.flatMap((n, i) => i ? ['子节点', n] : [n])]; };
    const chain = pos => P.chain(S, pos).map(e => [e.name, e.node]);
    const cityIndex = ch => P.cityIndex(ch.map(([, node]) => ({ node })), stellar());
    const city = pos => { const list = P.chain(S, pos), ci = P.cityIndex(list, stellar()), e = list[ci]; return { chain: list.map(x => [x.name, x.node]), ci, name: e?.name || '', node: e?.node || {}, path: e ? e.keys : null }; };
    return { roots: P.roots, isTown: P.isTown, profile, stellar, rootName: () => stellar() ? '斗罗星际' : '斗罗大陆', top, path, segs: P.segs, chain, cityIndex, city };
  };
  // 不依赖存档的部分也挂在工厂上，页面模块顶层可直接用
  Object.assign(window.LWCS_COCKPIT_LOC, { roots: P.roots, isTown: P.isTown });
})();

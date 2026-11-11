/* LWCS 地点路径：存档地点树的共用解析（交易模块、桥接、座舱共用） */
(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : window;
  const KEY = '__LWCS_LOCATION_PATH_V1__';
  if (root[KEY]) return;
  // 斗一 / 斗二的地点库按完整路径实例化：位置串和 world.地点 都以「斗罗大陆」为根，城市挂在根的子节点下；斗三没有这一层；
  // 斗四是「星系 / 行星 / 城市」三层。位置串里的根一律跳过，写回时再按存档里的真实键补回
  const ROOTS = new Set(['斗罗大陆', '斗灵大陆', '斗罗星际']);
  const isRecord = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const isTown = node => /城|都|镇|村|聚落/.test(String(node?.类型 || ''));
  const segs = pos => String(pos || '').split('-').map(s => s.trim()).filter(s => s && !ROOTS.has(s));
  const tree = dataRoot => isRecord(dataRoot?.world?.地点) ? dataRoot.world.地点 : {};
  const rootKey = dataRoot => { const w = tree(dataRoot); return Object.keys(w).find(k => ROOTS.has(k) && isRecord(w[k]?.子节点)) || ''; };
  // 顶层（已跳过根）：{ 名称: { node, keys } }，keys 是 world.地点 下的真实键路径
  const top = dataRoot => {
    const w = tree(dataRoot), r = rootKey(dataRoot), out = {};
    for (const [k, v] of Object.entries(w)) if (k !== r && isRecord(v)) out[k] = { node: v, keys: ['world', '地点', k] };
    if (r) for (const [k, v] of Object.entries(w[r].子节点)) if (isRecord(v)) out[k] = { node: v, keys: ['world', '地点', r, '子节点', k] };
    return out;
  };
  // 位置串逐段落到地点树上；树上没有的段跳过
  const chain = (dataRoot, pos) => {
    const out = []; let level = top(dataRoot);
    for (const name of segs(pos)) {
      const hit = level[name]; if (!hit) continue;
      out.push({ name, node: hit.node, keys: hit.keys });
      level = Object.fromEntries(Object.entries(isRecord(hit.node.子节点) ? hit.node.子节点 : {}).filter(([, v]) => isRecord(v)).map(([k, v]) => [k, { node: v, keys: [...hit.keys, '子节点', k] }]));
    }
    return out;
  };
  // 所在城市：链上第一个城镇类地点；没有时陆地取顶层、斗四（stellar）取第三层
  const cityIndex = (list, stellar = false) => { const i = list.findIndex(e => isTown(e.node)); return i >= 0 ? i : Math.min(stellar ? 2 : 0, Math.max(0, list.length - 1)); };
  const city = (dataRoot, pos, options = {}) => { const list = chain(dataRoot, pos); return list.length ? { ...list[cityIndex(list, !!options.stellar)], chain: list } : null; };
  // 按真实键路径取节点（只认 world / 地点 / … / 子节点 / … 形状）
  const atKeys = (dataRoot, keys) => {
    if (!Array.isArray(keys) || keys.length < 3 || keys[0] !== 'world' || keys[1] !== '地点') return null;
    for (let i = 3; i < keys.length; i += 2) if (keys[i] !== '子节点') return null;
    let cur = dataRoot; for (const k of keys) { cur = cur?.[k]; if (cur === undefined) return null; }
    return isRecord(cur) ? cur : null;
  };
  // 按地点名找节点：先顶层（含根下），再逐层广度查找
  const find = (dataRoot, name) => {
    const target = String(name || '').trim(); if (!target) return null;
    let level = Object.entries(top(dataRoot));
    while (level.length) {
      const hit = level.find(([k]) => k === target); if (hit) return { name: target, node: hit[1].node, keys: hit[1].keys };
      level = level.flatMap(([, e]) => Object.entries(isRecord(e.node.子节点) ? e.node.子节点 : {}).filter(([, v]) => isRecord(v)).map(([k, v]) => [k, { node: v, keys: [...e.keys, '子节点', k] }]));
    }
    return null;
  };
  const pointer = keys => '/' + keys.map(k => String(k).replace(/~/g, '~0').replace(/\//g, '~1')).join('/');
  root[KEY] = Object.freeze({ roots: ROOTS, isTown, segs, top, chain, cityIndex, city, atKeys, find, pointer });
})();

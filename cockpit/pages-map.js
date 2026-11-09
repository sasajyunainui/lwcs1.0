/* 探索领域：星图 · 地点 · 人物 · 行程 */
(() => {
  // 总图底图：资源基址取 lwcs 运行时给的素材目录（角色素材目录的上一级），原型页回落本地 39281
  const MAP = { get src() { return (document.documentElement.dataset.lwcsCharacterAssets || 'http://127.0.0.1:39281/assets/characters/').replace(/assets\/characters\/$/, '') + 'MAP.webp'; }, w: 3174, h: 2246 };
  const pathOf = c => String(c.ch.状态?.位置 || '').split('-').filter(Boolean);
  const nodeOf = c => {
    const parts = pathOf(c).filter(p => p !== '斗罗大陆');
    let node = null, chain = [];
    let pool = c.S.world.地点 || {};
    for (const p of parts) { if (pool && pool[p]) { node = pool[p]; chain.push([p, node]); pool = node.子节点 || {}; } }
    return { node, chain, city: chain[0] };
  };
  const locals = c => Object.entries(c.S.char).filter(([n, x]) => n !== c.name && x.状态?.位置 === c.ch.状态?.位置);
  const statusText = s => ({ intact: '完好', damaged: '受损', destroyed: '已毁', ruins: '废墟' }[s] || s || '未知');
  // 坐标目的地：dest 写成「@x,y」（总图坐标）
  const ptOf = dest => { const m = /^@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(String(dest || '')); return m ? { x: Number(m[1]), y: Number(m[2]) } : null; };
  const RUINED = /^(ruins|destroyed|damaged|废弃|损毁|破坏|遗址)$/i;
  // ---------- 全息沙盘 ----------
  // 底图（子图为全息底板）铺在倾斜平面里；地标不进 3D：平面里只放 0 尺寸锚点，地标画在平面外的 2D 层，
  // 每次平移 / 缩放后按锚点的屏幕位置摆放——大小、文字不随缩放与透视变形，地名牌立在光柱顶上。
  // 子图同原版「进入子图」：坐标契约是「x/y 为直接父节点子图的局部坐标」（与总图同一坐标系尺寸），不改变当前位置
  // 城市先判：「沿海城市」「海外首都」「军事城市」这类类型名里带海 / 军字，仍是城市
  const KINDS = [[/城|都|镇|村/, '#6fb4ff', '城市'], [/学院|学校/, '#b28bff', '学院'], [/宗|总部|据点|分部|组织|军/, '#ff9a62', '势力据点'], [/森林|山|海|岛|湖|原|谷|渊|位面/, '#5ee0ae', '地域']];
  const kindOf = t => KINDS.find(([re]) => re.test(String(t || ''))) || [null, '#cfd8e6', '其他'];
  const pct = (v, total) => (v / total * 100).toFixed(2);
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  const libRows = () => Object.values(window.COCKPIT.library('location')?.地点 || {}).map(e => ({ path: Object.values(e.目标路径 || {}), n: e.节点 || {}, rules: e.世界规则 }));
  const herePath = c => pathOf(c).filter(p => p !== '斗罗大陆');
  const under = (rows, prefix, depth) => rows.filter(r => r.path.length === depth && prefix.every((t, i) => r.path[i] === t));
  const worldNodes = c => {
    const out = {}, rows = libRows();
    for (const r of under(rows, [], 1)) if (Number.isFinite(r.n.x) && Number.isFinite(r.n.y)) out[r.path[0]] = { name: r.path[0], ...r.n, rules: r.rules, kids: [] };
    for (const r of under(rows, [], 2)) if (out[r.path[0]]) out[r.path[0]].kids.push(r.path[1]);
    for (const [n, v] of Object.entries(c.S.world.地点 || {})) if (Number.isFinite(v.x)) out[n] = { ...(out[n] || {}), name: n, ...v, kids: [...new Set([...(out[n]?.kids || []), ...Object.keys(v.子节点 || {})])], rules: out[n]?.rules };
    for (const [n, v] of Object.entries(c.S.world.动态地点 || {})) if (v && !out[n] && Number.isFinite(v.x) && Number.isFinite(v.y) && (!v.归属父节点 || v.归属父节点 === '斗罗大陆')) out[n] = { name: n, ...v, dyn: true, kids: [] };
    return Object.values(out);
  };
  // 某一层（trail = 从总图往下的地点名）上可画的地点：内置地点库 + 存档地点树；能否继续下钻看库里 / 存档里有没有更深一层
  const levelNodes = (c, trail) => {
    const rows = libRows(), kidsOf = p => [...new Set([...under(rows, p, p.length + 1).map(r => r.path.at(-1)), ...Object.keys(savedAt(c, p) || {})])];
    const base = trail.length ? (() => {
      const out = {};
      for (const r of under(rows, trail, trail.length + 1)) out[r.path.at(-1)] = { name: r.path.at(-1), ...r.n, rules: r.rules };
      for (const [k, v] of Object.entries(savedAt(c, trail) || {})) out[k] = { ...(out[k] || {}), name: k, ...v };
      return Object.values(out).filter(n => Number.isFinite(n.x) && Number.isFinite(n.y));
    })() : worldNodes(c);
    return base.map(n => { const kids = kidsOf([...trail, n.name]); return { ...n, kids, enterable: kids.length > 0 }; });
  };
  // 存档地点树里 trail 这一层的子节点表
  const savedAt = (c, trail) => { let pool = c.S.world.地点 || {}; for (const t of trail) pool = pool?.[t]?.子节点; return pool; };
  // 地标分级：0 当前位置 · 1 近处 · 2 其他 · 3 地域（总图上地域类默认只留光点）。光柱高度随级别
  const BEAM = [40, 26, 18, 10];
  const sandTable = (c, trail) => {
    const hp = herePath(c), onPath = trail.every((t, i) => hp[i] === t), hereName = onPath ? hp[trail.length] : null, sub = trail.length > 0;
    const nodes = levelNodes(c, trail), f = nodes.find(n => n.name === hereName);
    const ref = f || { x: MAP.w / 2, y: MAP.h / 2 }, d = n => Math.hypot(n.x - ref.x, n.y - ref.y);
    const near = new Set(nodes.filter(n => n !== f).sort((p, q) => d(p) - d(q)).slice(0, sub ? 12 : 8).map(n => n.name));
    const rank = n => n === f ? 0 : near.has(n.name) ? 1 : !sub && kindOf(n.类型)[2] === '地域' ? 3 : 2;
    const key = n => [...trail, n.name].join('/');
    const pt = !sub && ptOf(c.state.ui.dest), pin = pt ? { x: pt.x, y: pt.y } : null;
    const holo = sub ? `<div class="holo-base" style="background-image:${[...nodes.map(n => `radial-gradient(circle at ${pct(n.x, MAP.w)}% ${pct(n.y, MAP.h)}%,${rgba(kindOf(n.类型)[1], .3)} 0,transparent 8%)`), 'radial-gradient(ellipse at 50% 50%,rgba(70,150,255,.22),transparent 68%)'].join(',')}"><b>${c.esc(trail.at(-1))}</b></div>` : '';
    return `<div class="table${sub ? ' sub' : ''}" data-table data-no-tilt data-trail="${c.esc(trail.join('/'))}">
      <div class="plane">${sub ? holo : `<img src="${MAP.src}" alt="斗罗大陆总图" draggable="false">`}<div class="grid"></div>${nodes.map(n => `<i class="anc" style="left:${pct(n.x, MAP.w)}%;top:${pct(n.y, MAP.h)}%"></i>`).join('')}${pin ? `<i class="anc" style="left:${pct(pin.x, MAP.w)}%;top:${pct(pin.y, MAP.h)}%"></i>` : ''}<i class="anc cn" style="left:0;top:0"></i><i class="anc cn" style="left:100%;top:0"></i><i class="anc cn" style="left:100%;top:100%"></i><i class="anc cn" style="left:0;top:100%"></i></div>
      <div class="marks">${nodes.map(n => { const r = rank(n), color = r === 0 ? '#ffd36b' : kindOf(n.类型)[1]; return `<button class="mk r${r}${r === 0 ? ' here' : ''}" type="button" style="--pc:${color};--bh:${BEAM[r]}px" data-rank="${r}" data-inspect="node:${c.esc(key(n))}" data-hover-delay="320"${n.enterable ? ` data-map-enter="${c.esc(key(n))}"` : ''} aria-label="${c.esc(n.name)}"><i class="mk-lead"></i><i class="mk-beam"></i><i class="mk-base"></i><span class="mk-tag">${c.esc(n.name)}${n.enterable ? '<i class="fa-solid fa-layer-group"></i>' : ''}</span></button>`; }).join('')}${pin ? `<button class="mk r0 fpin" type="button" style="--pc:#ff7ab6;--bh:${BEAM[0]}px" data-rank="0" data-set="dest=" aria-label="清除坐标目的地" data-hint="坐标目的地 · 点一下清除"><i class="mk-lead"></i><i class="mk-beam"></i><i class="mk-base"></i><span class="mk-tag"><i class="fa-solid fa-location-crosshairs"></i> ${Math.round(pin.x)}, ${Math.round(pin.y)}</span></button>` : ''}</div>
      ${sub ? `<div class="table-crumb"><button class="key-s" type="button" data-map-up aria-label="返回上级"><i class="fa-solid fa-chevron-left"></i></button><span>${['斗罗大陆', ...trail].map((t, i) => i === trail.length ? `<b aria-current="location">${c.esc(t)}</b>` : `<button type="button" data-map-to="${c.esc(trail.slice(0, i).join('/'))}">${c.esc(t)}</button>`).join('<i class="fa-solid fa-angle-right"></i>')}</span>${onPath ? '' : `<span class="chip s" data-hint="${c.esc(`这里只能查看；要在「${trail[0]}」里行动，先前往那里。`)}">远端预览</span>`}</div>` : ''}
      <div class="table-ui"><button class="key-s" type="button" data-zoom="1.25" aria-label="放大">＋</button><button class="key-s" type="button" data-zoom="0.8" aria-label="缩小">－</button><button class="key-s" type="button" data-zoom="home" aria-label="${f ? '回到当前位置' : '回到中心'}"><i class="fa-solid fa-crosshairs"></i></button></div>
      <div class="table-legend">${KINDS.map(([, col, l]) => `<span><i style="--pc:${col}"></i>${l}</span>`).join('')}<span><i style="--pc:#ffd36b"></i>当前位置</span><span><b class="fa-solid fa-layer-group"></b>可进入子图</span></div>
    </div>`;
  };
  // 交互：拖动平移（开始拖动才捕获指针，单击仍是点地标）· 滚轮 / 双指以指针处为中心缩放 · 按钮缩放与回中走短补间
  const mountTable = face => {
    const table = face.querySelector('[data-table]'); if (!table) return;
    const plane = table.querySelector('.plane'), ancs = [...plane.querySelectorAll('.anc:not(.cn)')], marks = [...table.querySelectorAll('.mk')], corners = [...plane.querySelectorAll('.anc.cn')];
    const COS = Math.cos(50 * Math.PI / 180), Z = [.7, 5], st = { z: 1.6, tx: 0, ty: 0 };
    const ui = window.COCKPIT.ctx().state.ui, viewKey = table.dataset.trail || '/', views = ui.mapView ||= {};
    let raf = 0, pw = 1;
    const clampZ = z => Math.max(Z[0], Math.min(Z[1], z));
    // 平移限位：画面中心始终落在地图上，拖不丢；视角按地图尺寸归一后记进 ui，重绘（设目的地、数据刷新）后原样恢复
    const apply = () => {
      const ph = pw * MAP.h / MAP.w;
      st.tx = Math.max(-pw / 2, Math.min(pw / 2, st.tx)); st.ty = Math.max(-ph / 2, Math.min(ph / 2, st.ty));
      views[viewKey] = { z: st.z, x: st.tx / pw, y: st.ty / ph };
      plane.style.setProperty('--z', st.z); plane.style.setProperty('--tx', st.tx + 'px'); plane.style.setProperty('--ty', st.ty + 'px'); if (!raf) raf = requestAnimationFrame(place);
    };
    // 上一帧的散开分组与地名牌落点：本帧优先沿用，拖动时牌子不在上 / 左 / 右之间来回跳
    let prevGroup = [];
    // 摆地标：读锚点的屏幕位置（只有 transform 变了，不触发重排）；越靠上（越远）越小；地名牌按级别先占位，被挡住的只留光点
    const place = () => {
      raf = 0;
      // 图例 / 路径条 / 缩放键占的区域先记为已占，地名牌不钻到它们底下
      const tr = table.getBoundingClientRect(), showMinor = st.z >= 2.6;
      const placed = [...table.querySelectorAll('.table-legend,.table-crumb,.table-ui')].map(el => { const r = el.getBoundingClientRect(); return [r.left - tr.left, r.top - tr.top, r.right - tr.left, r.bottom - tr.top]; });
      const pts = ancs.map(a => { const r = a.getBoundingClientRect(); return [r.left - tr.left, r.top - tr.top]; });
      const vis = pts.map(([x, y]) => x > -60 && x < tr.width + 60 && y > -10 && y < tr.height + 70);
      // 坐标重合 / 挨得太近（屏幕上底座相距不到 22px）的地标就地散开：两个左右分开，三个以上绕一圈；
      // 散开的地标拉一条虚线回到真实位置。放大到点自然分开后不再散开
      // 分组带回差：上一帧同组的放宽到 34px 才拆开，免得在临界距离上反复散开 / 合拢
      const off = pts.map(() => [0, 0]), grouped = new Set(), group = [];
      const close = (k, j) => Math.hypot(pts[k][0] - pts[j][0], pts[k][1] - pts[j][1]) < (prevGroup[k] != null && prevGroup[k] === prevGroup[j] ? 34 : 22);
      for (let i = 0; i < pts.length; i++) {
        if (!vis[i] || grouped.has(i)) continue;
        const g = [i];
        for (let j = i + 1; j < pts.length; j++) if (vis[j] && !grouped.has(j) && g.some(k => close(k, j))) g.push(j);
        if (g.length < 2) continue;
        g.forEach(k => { grouped.add(k); group[k] = i; });
        const cx = g.reduce((s, k) => s + pts[k][0], 0) / g.length, cy = g.reduce((s, k) => s + pts[k][1], 0) / g.length, rad = g.length === 2 ? 22 : 12 + 6 * g.length;
        g.sort((a, b) => pts[a][0] - pts[b][0] || pts[a][1] - pts[b][1]).forEach((k, n) => {
          const ang = g.length === 2 ? (n ? 0 : Math.PI) : -Math.PI / 2 + n * 2 * Math.PI / g.length;
          off[k] = [cx + Math.cos(ang) * rad - pts[k][0], cy + Math.sin(ang) * rad * .6 - pts[k][1]];
        });
      }
      prevGroup = group;
      const order = marks.map((m, i) => i).sort((a, b) => marks[a].dataset.rank - marks[b].dataset.rank || pts[b][1] - pts[a][1]);
      for (const i of order) {
        const m = marks[i], r = +m.dataset.rank;
        m.hidden = !vis[i]; if (!vis[i]) continue;
        const x = pts[i][0] + off[i][0], y = pts[i][1] + off[i][1], ds = Math.max(.74, Math.min(1.1, .72 + .45 * y / tr.height));
        m.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${ds.toFixed(3)})`;
        m.style.zIndex = Math.round(y);
        // 引线：从散开后的底座指回真实位置（标记自身被 ds 缩放，长度要除回去）
        const ll = Math.hypot(...off[i]);
        m.classList.toggle('spread', ll > .5);
        if (ll > .5) { m.style.setProperty('--ll', (ll / ds).toFixed(1) + 'px'); m.style.setProperty('--lr', Math.atan2(-off[i][1], -off[i][0]).toFixed(3) + 'rad'); }
        let label = r <= 2 || showMinor;
        if (label) {
          const tag = m.querySelector('.mk-tag'), w = (m._tw ||= tag.offsetWidth) * ds, h = (m._th ||= tag.offsetHeight) * ds, top = y - (BEAM[r] + 2) * ds - h;
          // 先放光柱正上方，撞了依次试偏右 / 偏左 / 上抬一行（及其左右），都撞才只留光点
          const hit = bx => placed.some(b => bx[0] < b[2] + 4 && bx[2] > b[0] - 4 && bx[1] < b[3] + 2 && bx[3] > b[1] - 2);
          const at = ([ox, oy]) => [x + ox - w / 2, top + oy, x + ox + w / 2, top + oy + h];
          const up = -(h + 3), cands = [[0, 0], [w * .55, 0], [-w * .55, 0], [0, up], [w * .55, up], [-w * .55, up]];
          const pi = [m._pick ?? 0, ...cands.keys()].find(n => !hit(at(cands[n])));
          m._pick = pi;
          if (pi == null) label = false;
          else { const pick = cands[pi]; placed.push(at(pick)); m.style.setProperty('--lx', (pick[0] / ds).toFixed(1) + 'px'); m.style.setProperty('--ly', (pick[1] / ds).toFixed(1) + 'px'); }
        }
        m.classList.toggle('nolabel', !label);
      }
    };
    const tween = (to, ms = 260) => {
      const from = { ...st }, t0 = performance.now();
      const step = t => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); for (const p of ['z', 'tx', 'ty']) st[p] = from[p] + (to[p] - from[p]) * e; apply(); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    };
    // 以屏幕点（相对平面中心的偏移 cx / cy）为中心缩放：保持该点下的地图位置不动（忽略透视的近似）
    const zoomAt = (nz, cx, cy) => { nz = clampZ(nz); st.tx += cx / nz - cx / st.z; st.ty += cy / (nz * COS) - cy / (st.z * COS); st.z = nz; apply(); };
    const centerOff = (x, y) => { const tr = table.getBoundingClientRect(); return [x - (tr.left + tr.width / 2), y - (tr.top + tr.height * .56)]; };
    // 回中取景：总图对准当前位置；子图地点少，把全部地点框进画面（避开四角的图例与路径条）
    const homeState = () => {
      const pw = table.clientWidth * 1.05, ph = pw * MAP.h / MAP.w;
      if (table.classList.contains('sub') && ancs.length) {
        const xs = ancs.map(a => parseFloat(a.style.left) / 100), ys = ancs.map(a => parseFloat(a.style.top) / 100);
        const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
        const z = Math.max(.9, Math.min(3, (table.clientWidth * .62) / Math.max((x1 - x0) * pw, 1), (table.clientHeight * .5) / Math.max((y1 - y0) * ph * COS, 1)));
        return { pw, s: { z, tx: (.5 - (x0 + x1) / 2) * pw, ty: (.5 - (y0 + y1) / 2) * ph } };
      }
      const here = marks.find(m => m.classList.contains('here')), a = here ? ancs[marks.indexOf(here)] : null;
      const fx = a ? parseFloat(a.style.left) / 100 : .5, fy = a ? parseFloat(a.style.top) / 100 : .5;
      return { pw, s: { z: 1.6, tx: (.5 - fx) * pw, ty: (.5 - fy) * ph } };
    };
    const h = homeState(); pw = h.pw; plane.style.setProperty('--pw', pw + 'px');
    // 进出子图：下钻从拉远处推近，返回从推近处拉远（只是入场感，落点同回中）；同一层重绘时沿用上次的视角
    const depth = (ui.mapTrail || []).length, prev = ui.mapDepthShown ?? depth, saved = views[viewKey]; ui.mapDepthShown = depth;
    if (depth !== prev) { Object.assign(st, h.s, { z: depth > prev ? .9 : 2.8 }); apply(); tween(h.s, 420); }
    else { Object.assign(st, saved ? { z: clampZ(saved.z), tx: saved.x * pw, ty: saved.y * pw * MAP.h / MAP.w } : h.s); apply(); }
    const ro = new ResizeObserver(() => {
      if (!table.isConnected) return ro.disconnect();
      const k = table.clientWidth * 1.05 / pw; pw *= k; st.tx *= k; st.ty *= k; plane.style.setProperty('--pw', pw + 'px'); apply();
    });
    ro.observe(table);

    // 拖动期间桥接送来的新数据先挂起，松手再重绘，免得拖到一半整张图被换掉
    const ptrs = new Map(); let drag = null, pinch = null, moved = false;
    const hold = on => window.COCKPIT.hold?.(on);
    // 按住拖动不选中文字（否则拖出界会把整页选成一片）
    table.addEventListener('selectstart', e => e.preventDefault());
    table.addEventListener('pointerdown', e => {
      if (e.target.closest('.table-ui,.table-crumb') || e.button > 0) return;
      if (e.pointerType === 'mouse') { e.preventDefault(); getSelection()?.removeAllRanges(); }
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); hold(true);
      if (ptrs.size === 1) { drag = { x: e.clientX, y: e.clientY, tx: st.tx, ty: st.ty, id: e.pointerId }; moved = false; }
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: st.z }; drag = null; }
    });
    table.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()], [cx, cy] = centerOff((a.x + b.x) / 2, (a.y + b.y) / 2); moved = true; zoomAt(pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, cx, cy); return; }
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!moved) {
        if (Math.hypot(dx, dy) < 5) return;
        moved = true; table.classList.add('grabbing'); try { table.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件没有活动指针 */ }
        if (window.COCKPIT.ctx().state.inspect) window.COCKPIT.closeInspector();
      }
      st.tx = drag.tx + dx / st.z; st.ty = drag.ty + dy / (st.z * COS); apply();
    });
    const end = e => { if (!ptrs.delete(e.pointerId)) return; if (ptrs.size < 2) pinch = null; if (!ptrs.size) { drag = null; table.classList.remove('grabbing'); hold(false); } };
    table.addEventListener('pointerup', end); table.addEventListener('pointercancel', end);
    table.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
    table.addEventListener('click', e => {
      if (table.classList.contains('sub') || corners.length !== 4 || e.target.closest('.mk,.table-ui,.table-crumb,.table-legend')) return;
      const uv = screenToPlane(corners.map(a => { const r = a.getBoundingClientRect(); return [r.left, r.top]; }), e.clientX, e.clientY);
      if (!uv || uv[0] < 0 || uv[0] > 1 || uv[1] < 0 || uv[1] > 1) return;
      const c = window.COCKPIT.ctx(); c.state.ui.dest = `@${Math.round(uv[0] * MAP.w)},${Math.round(uv[1] * MAP.h)}`;
      if (c.state.inspect) window.COCKPIT.closeInspector();
      window.COCKPIT.refresh();
    });
    // 滚轮缩放：记下目标倍率，逐帧以指针处为中心逼近（鼠标滚轮一格不再一下跳 15%），触控板的细碎增量照样连续
    let wz = 0, wat = [0, 0], wraf = 0;
    const wheelStep = () => {
      wraf = 0; const nz = Math.abs(wz - st.z) < .004 ? wz : st.z + (wz - st.z) * .35;
      zoomAt(nz, ...wat); if (st.z !== wz) wraf = requestAnimationFrame(wheelStep); else wz = 0;
    };
    table.addEventListener('wheel', e => {
      e.preventDefault(); if (!e.deltaY) return;
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      wat = centerOff(e.clientX, e.clientY); wz = clampZ((wz || st.z) * Math.exp(-dy * .0016));
      if (!wraf) wraf = requestAnimationFrame(wheelStep);
    }, { passive: false });
    table.querySelector('.table-ui').addEventListener('click', e => {
      const b = e.target.closest('[data-zoom]'); if (!b) return; e.stopPropagation();
      if (b.dataset.zoom === 'home') return tween(homeState().s);
      const nz = clampZ(st.z * Number(b.dataset.zoom)); tween({ z: nz, tx: st.tx, ty: st.ty }, 200);
    });
  };
  // 单位正方形 → 屏幕四边形的透视映射（Heckbert），再求逆把屏幕点映回平面 [0,1]² 坐标；四角顺序：左上、右上、右下、左下
  const screenToPlane = ([[x0, y0], [x1, y1], [x2, y2], [x3, y3]], X, Y) => {
    const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3, den = dx1 * dy2 - dx2 * dy1;
    const g = den ? (dx3 * dy2 - dx2 * dy3) / den : 0, h = den ? (dx1 * dy3 - dx3 * dy1) / den : 0;
    const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, cc = x0, d = y1 - y0 + g * y1, ee = y3 - y0 + h * y3, ff = y0;
    // 逆矩阵（伴随矩阵 / 行列式），齐次坐标除回
    const A = ee - ff * h, B = cc * h - b, C = b * ff - cc * ee, D = ff * g - d, E = a - cc * g, F = cc * d - a * ff, G = d * h - ee * g, H = b * g - a * h, I = a * ee - b * d;
    const w = G * X + H * Y + I; if (!w) return null;
    return [(A * X + B * Y + C) / w, (D * X + E * Y + F) / w];
  };
  // 子图导航：双击可下钻的地标 / 浮窗「进入子图」进入；路径条返回任一级。只是查看，不改变当前位置
  const setTrail = trail => { const c = window.COCKPIT.ctx(); c.state.ui.mapTrail = trail; if (c.state.inspect) window.COCKPIT.closeInspector(); window.COCKPIT.refresh(); };
  document.addEventListener('dblclick', e => { const m = e.target.closest('.mk[data-map-enter]'); if (m) setTrail(m.dataset.mapEnter.split('/')); });
  document.addEventListener('click', e => {
    const en = e.target.closest('[data-map-enter-btn]'); if (en) return setTrail(en.dataset.mapEnterBtn.split('/'));
    if (e.target.closest('[data-map-up]')) return setTrail((window.COCKPIT.ctx().state.ui.mapTrail || []).slice(0, -1));
    const to = e.target.closest('[data-map-to]'); if (to) setTrail(to.dataset.mapTo ? to.dataset.mapTo.split('/') : []);
  });
  const nodeInspect = (c, kind, id) => {
    const path = String(id).split('/'), name = path.at(-1), trail = path.slice(0, -1);
    const n = levelNodes(c, trail).find(x => x.name === name); if (!n) return '';
    const [, color, kname] = kindOf(n.类型), hp = herePath(c), here = path.every((t, i) => hp[i] === t);
    const desc = String(n.描述 || '').split('\n')[0];
    const funcs = Object.values(n.rules?.功能档案 || {});
    // 行动：总图上的地点 / 所在城市里的地点可设为目的地；别的城市的子图地点要先前往那座城
    const act = here ? '<button class="cta" type="button" data-go="page-map/place"><i class="fa-solid fa-city"></i>查看所在地点</button>'
      : !trail.length || trail[0] === hp[0] ? `<button class="cta" type="button" data-go="page-map/star" data-set-dest="${c.esc(name)}"><i class="fa-solid fa-route"></i>设为目的地</button>`
        : `<button class="cta" type="button" data-go="page-map/star" data-set-dest="${c.esc(trail[0])}"><i class="fa-solid fa-route"></i>前往${c.esc(trail[0])}</button>`;
    return `<div class="insp-head"><span class="sock" style="--s:2.4em;--tint:${color}"><i class="fa-solid fa-location-dot"></i></span><div><strong style="font-size:1.15em">${c.esc(name)}</strong><br><small>${c.esc(n.类型 || kname)}${n.掌控势力 ? ' · ' + c.esc(n.掌控势力) : ''}</small></div><button class="x" type="button" data-close-inspector aria-label="关闭">×</button></div>
      ${trail.length ? `<div class="crumb">${['斗罗大陆', ...trail].map(c.esc).join('<i class="fa-solid fa-angle-right"></i>')}</div>` : ''}
      ${desc ? `<p class="quote">${c.esc(desc)}</p>` : ''}
      ${!trail.length ? `<div class="minigrid" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div><b>${n.人口 ? c.fmt(n.人口) : '—'}</b><small>人口</small></div><div><b>${c.esc(n.经济状况 || '—')}</b><small>经济</small></div><div><b>${c.esc(n.守护军团 || '—')}</b><small>守军</small></div></div>` : n.状态 ? `<div class="minigrid" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div><b>${c.esc(statusText(n.状态))}</b><small>状态</small></div><div><b>${c.esc(n.掌控势力 || '—')}</b><small>掌控</small></div></div>` : ''}
      ${funcs.length ? `<div style="display:flex;gap:.3em;flex-wrap:wrap">${funcs.map(x => `<span class="chip s">${c.esc(x)}</span>`).join('')}</div>` : ''}
      ${n.kids.length ? `<section class="sec"><h3>下辖地点 · ${n.kids.length}</h3><div style="display:flex;gap:.3em;flex-wrap:wrap">${n.kids.slice(0, 14).map(k => `<span class="chip s">${c.esc(k)}</span>`).join('')}${n.kids.length > 14 ? `<span class="chip s">+${n.kids.length - 14}</span>` : ''}</div></section>` : ''}
      ${n.enterable ? `<button class="key-s" type="button" data-map-enter-btn="${c.esc(path.join('/'))}" style="align-self:flex-start"><i class="fa-solid fa-layer-group"></i> 进入子图</button>` : ''}
      ${act}
      ${maintRow(c, name, n.状态, !!n.dyn || !!c.S.world.动态地点?.[name])}`;
  };

  const place = c => {
    const { node, chain } = nodeOf(c), city = chain[0]?.[1] || {};
    const desc = String(city.描述 || '').split('\n')[0];
    const shops = Object.entries(city.商店 || {});
    const dyn = Object.entries(c.S.world.动态地点 || {});
    const loc = locals(c), rel = c.ch.社交?.关系 || {};
    return {
      tag: 'CORE · LOCATION',
      core: `<div class="pad">
        ${c.head('city', chain[0]?.[0] || '未知地点', city.类型 || 'Location', 'gd')}
        <div class="crumb">${['斗罗大陆', ...chain.map(x => x[0])].map(c.esc).join('<i class="fa-solid fa-angle-right"></i>')}</div>
        <p class="prose">${c.esc(desc)}${!c.blank(city.现状描述) ? `<br><b>现状：</b>${c.esc(city.现状描述)}` : ''}</p>
        <div class="fame even" style="--n:5">${[['掌控', '掌控势力', city.掌控势力], ['守军', '守护军团', city.守护军团], ['人口', '人口', city.人口, 'number'], ['经济', '经济状况', city.经济状况, 'enum'], ['状态', null, String(statusText(city.状态)).replace(/<[^>]+>/g, '')]].map(([l, k, v, kind]) => `<div><small>${l}</small><b>${k && chain[0] ? c.ed(kind === 'number' ? c.fmt(v || 0) : (v || '—'), ['world', '地点', chain[0][0], k], kind === 'number' ? { kind: 'number', integer: true, min: 0, raw: c.num(v) } : kind === 'enum' ? { kind: 'enum', options: ['繁荣', '富足', '一般', '萧条', '凋敝'] } : { raw: v || '' }) : c.esc(v || '—')}</b></div>`).join('')}</div>
        <section class="sec"><h3>商店<span class="en">${shops.length}</span></h3><div class="list two">${shops.map(([n, s]) => `<button class="row" type="button" data-go="page-terminal/trade" data-go-set="venue=shop:${c.esc(n)};good=;tqty=1"><span class="sock" style="--s:1.8em"><i class="fa-solid fa-store"></i></span><div><strong>${c.esc(n)}</strong><small>${Object.keys(s.库存 || {}).length} 种商品${s._下次刷新tick ? ` · ${c.tickDate(s._下次刷新tick).replace('斗罗历', '')} 补货` : ''}</small></div><i class="fa-solid fa-chevron-right"></i></button>`).join('')}</div></section>
      </div>`,
      left: `<div class="pad">
        ${c.head('users', '在场人物', 'Locals', 'gd')}
        ${loc.length ? `<div class="list">${loc.map(([n, x]) => { const r = rel[n], aff = c.num(r?.好感度); return `<button class="row" type="button" data-inspect="npc:${c.esc(n)}">${c.miniAva(n)}<div><strong>${c.esc(n)}</strong><small>Lv.${c.esc(x.属性?.等级)} · ${c.esc(x.社交?.主身份 || '')}</small></div>${r ? `<span class="rc-tag ${aff >= 0 ? 'warm' : 'cold'}">${aff >= 0 ? '+' : ''}${c.fmt(aff)}</span>` : '<span class="rc-tag dim">未结识</span>'}</button>`; }).join('')}</div>` : '<span class="lbl">这里没有其他人。</span>'}
        <div class="act-row">${[['comments', '交谈', 'talk', '与在场人员交谈'], ['circle-question', '请教', 'intel', '向在场人员请教情报'], ['clipboard-list', '汇报', 'brief', '向在场人员汇报情况']].map(([ic, l, op, cf]) => `<button class="key-s" type="button" data-hint="不指定对象，由在场的人回应" data-confirm="${cf}" data-act="${c.esc(JSON.stringify({ name: 'npc', op, npc: '' }))}"><i class="fa-solid fa-${ic}"></i> ${l}</button>`).join('')}</div>
        ${dyn.length ? `<div class="groove"></div>${c.head('location-crosshairs', '动态地点', 'Dynamic')}<div class="list">${dyn.map(([n, d]) => `<button class="row" type="button" data-inspect="dyn:${c.esc(n)}"><span class="sock" style="--s:1.8em"><i class="fa-solid fa-location-crosshairs"></i></span><div><strong>${c.esc(n)}</strong><small>${c.esc(d.归属父节点 || '未归属')} · ${c.esc(d.势力 || '未知')}</small></div><i class="fa-solid fa-chevron-right"></i></button>`).join('')}</div>` : ''}
      </div>`,
      right: `<div class="pad">
        ${c.head('door-open', '设施', 'Facilities')}
        <div class="list">
          <button class="row" type="button" data-go="page-terminal/trial"><span class="sock" style="--s:1.8em"><i class="fa-solid fa-tower-observation"></i></span><div><strong>升灵台 / 魂灵塔</strong><small>需门票</small></div><i class="fa-solid fa-chevron-right"></i></button>
          <button class="row" type="button" data-go="page-terminal/workshop"><span class="sock" style="--s:1.8em"><i class="fa-solid fa-hammer"></i></span><div><strong>工坊委托</strong><small>副职业</small></div><i class="fa-solid fa-chevron-right"></i></button>
        </div>
        <button class="cta" type="button" disabled style="font-size:.95em"><i class="fa-solid fa-person-walking-arrow-right"></i>已在此处</button>
      </div>`,
    };
  };

  // 在场人物：与角色目录同款选角牌（头像 · 等级角标 · 称号 · 身份 · 好感标签）；互动按钮在人物浮窗里，两翼折成侧轨
  const dynInspect = (c, name) => {
    const d = c.S.world.动态地点?.[name]; if (!d) return '';
    const dp = ['world', '动态地点', name], none = v => c.blank(v) || v === '无';
    const s = (k, dflt = '未记录') => c.ed(none(d[k]) ? dflt : d[k], [...dp, k], { raw: none(d[k]) ? '' : d[k] });
    const t = (k, dflt) => c.ed(none(d[k]) ? dflt : d[k], [...dp, k], { kind: 'text', raw: none(d[k]) ? '' : d[k] });
    return `<div class="insp-head">${c.sock('location-crosshairs', 'gd')}<div><strong style="font-size:1.1em">${c.esc(name)}</strong><br><small class="lbl">动态地点 · ${c.esc(statusText(d.状态))}</small></div><button class="x" type="button" data-close-inspector aria-label="关闭">×</button></div>
      ${c.kv([['归属', s('归属父节点')], ['类型', s('类型')], ['势力', s('势力', '未知')]])}
      <section class="sec"><h3>描述</h3><p class="prose">${t('描述', '未记录描述')}</p></section>
      <section class="sec"><h3>现状</h3><p class="prose">${t('现状描述', '暂无变化')}</p></section>
      ${maintRow(c, name, d.状态, true)}`;
  };
  const npcInspect = (c, kind, name) => {
    const x = c.S.char[name]; if (!x) return '';
    const r = c.ch.社交?.关系?.[name];
    // 与原项目星图人物交互同一组动作；对话 / 请教 / 汇报 / 切磋 会推进剧情或开战斗，先确认；交易 / 委托只是打开面板
    const acts = [['comments', '对话', 'talk', `与${name}对话`], ['circle-question', '请教', 'intel', `向${name}请教`], ['clipboard-list', '汇报', 'brief', `向${name}汇报情况`], ['hand-fist', '切磋', 'battle', `与${name}切磋，打开战斗终端`], ['scale-balanced', '交易', 'trade', ''], ['file-signature', '委托', 'commission', '']];
    return `<div class="insp-head">${c.miniAva(name)}<div><strong style="font-size:1.1em">${c.esc(name)}</strong><br><small class="lbl">Lv.${c.esc(x.属性?.等级)} · ${c.esc(x.第1武魂?.表象名称 || '')}</small></div><button class="x" type="button" data-close-inspector aria-label="关闭">×</button></div>
      ${c.kv([['身份', c.esc(x.社交?.主身份 || '')], ['关系', r ? `${c.esc(r.关系)} · 好感 ${c.fmt(r.好感度)}` : '<span class="dim">尚未结识</span>']])}
      <div class="opts">${acts.map(([ic, l, op, confirm]) => `<button class="opt" type="button" style="min-height:52px"${confirm ? ` data-confirm="${c.esc(confirm)}"` : ''} data-act="${c.esc(JSON.stringify({ name: 'npc', op, npc: name }))}"><i class="fa-solid fa-${ic}"></i>${l}</button>`).join('')}</div>
      <button class="key-s" type="button" data-view-char="${c.esc(name)}" style="align-self:flex-start"><i class="fa-solid fa-id-card"></i> 查看档案</button>`;
  };

  // 目的地在地点树里的路径：总图地点就是自己；所在城市里的地点从城市往下找（库 + 存档）
  const destPath = (c, dest) => {
    const city = herePath(c)[0];
    if (worldNodes(c).some(n => n.name === dest)) return [dest];
    const row = libRows().find(r => r.path[0] === city && r.path.at(-1) === dest);
    if (row) return row.path;
    const walk = (pool, trail) => { for (const [k, v] of Object.entries(pool || {})) { const p = [...trail, k]; if (k === dest) return p; const r = walk(v?.子节点, p); if (r) return r; } return null; };
    return (city && walk(c.S.world.地点?.[city]?.子节点, [city])) || [dest];
  };
  // 移动预演：选定目的地后向运行时取一次（耗时、各移动方式的消耗、能否成行），位置 / 时间 / 资源变了再重取
  const planKey = (c, dest) => JSON.stringify([c.name, dest, c.ch.状态?.位置, c.S.world?.时间?.tick, c.ch.属性?.魂力, c.ch.属性?.体力]);
  const planOf = (c, dest) => {
    const ui = c.state.ui, key = planKey(c, dest);
    if (ui.travelPlan?.key === key) return ui.travelPlan;
    if (ui.travelPlanPending !== key) {
      ui.travelPlanPending = key;
      window.COCKPIT.previewAsync('travel', ptOf(dest) ? { point: ptOf(dest) } : { node: dest, path: destPath(c, dest) }).then(data => {
        if (ui.travelPlanPending !== key) return;
        ui.travelPlan = { key, data };
        ui.travelPlanPending = null;
        window.COCKPIT.refresh();
      });
    }
    return null;
  };
  const routeBox = (c, dest) => {
    const plan = planOf(c, dest), p = plan?.data, ui = c.state.ui;
    const lockBtn = why => `<span class="cta-wrap" data-hint="${c.esc(why)}"><button class="cta" type="button" disabled><i class="fa-solid fa-person-walking-arrow-right"></i>出发</button></span>`;
    if (!plan) return `<div class="warn" style="color:var(--ink2);background:rgba(47,124,246,.1);box-shadow:inset 2px 0 0 var(--blue)"><i class="fa-solid fa-route"></i><span>正在规划前往「${c.esc(ptOf(dest) ? '坐标点' : dest)}」的路线</span></div>${lockBtn('路线规划中')}`;
    // 原型页没有运行时：只给出发确认
    if (!p) return `<button class="cta" type="button" data-confirm="${c.esc(`前往「${dest}」`)}"><i class="fa-solid fa-person-walking-arrow-right"></i>出发</button>`;
    if (p.alreadyThere) return lockBtn('已经在这里了');
    if (!p.ok) return `<div class="warn"><i class="fa-solid fa-triangle-exclamation"></i><span>${c.esc(p.reason || '现在去不了')}</span></div>${lockBtn(p.reason || '现在去不了')}`;
    const methods = Array.isArray(p.methods) && p.methods.length ? p.methods : [{ method: p.method, duration: p.duration, costText: p.costText, canAfford: p.canAfford !== false, reason: p.reason }];
    // 默认方式：运行时默认方式负担得起就用它，否则用第一个负担得起的
    const pick = (ui.travelMethodFor === dest && methods.find(m => m.method === ui.travelMethod)) || (p.canAfford !== false && methods.find(m => m.method === p.method)) || methods.find(m => m.canAfford) || methods[0];
    const target = p.mode === 'via' ? p.via : p.mode === 'point' ? (p.target || '坐标点') : dest;
    const lead = p.mode === 'point' ? `前往坐标点「${c.esc(target)}」` : p.mode === 'via' ? `「${c.esc(dest)}」在「${c.esc(p.via)}」城内，先前往${c.esc(p.via)}${c.hint('抵达后再在城内选择这个地点。')}` : p.mode === 'local' ? `城内前往「${c.esc(dest)}」` : `前往「${c.esc(dest)}」`;
    const sel = methods.length > 1
      ? `<span class="lbl">移动方式${c.hint('只列出这段路能用的方式；用不了的注明原因。')}</span><div class="pick-row">${c.pick('travelMethod', pick.method, methods.map(m => ({ value: m.method, label: m.canAfford ? `${m.method} · ${m.duration || ''}` : `${m.method}（${m.reason || '不可用'}）`, hint: m.canAfford ? `消耗 ${m.costText || '无'}` : m.reason })))}</div>`
      : '';
    const info = c.kv([['方式', c.esc(pick.method || '步行')], ['耗时', c.esc(pick.duration || '—')], ['消耗', c.esc(pick.costText || '无消耗')]]);
    // 到达后接着做（原项目「移动后待执行动作」）：只给直达的星图节点，选项是该节点自己的动作槽
    const thens = p.mode === 'map' && Array.isArray(p.followUps) ? p.followUps : [];
    const then = (ui.travelThenFor === dest && thens.find(t => t.action === ui.travelThen)) || null;
    const thenSel = thens.length ? `<span class="lbl">到达后${c.hint('到达后接着在目的地执行这个动作。')}</span><div class="pick-row">${c.pick('travelThen', then ? then.action : '', [{ value: '', label: '只移动' }, ...thens.map(t => ({ value: t.action, label: t.label }))])}</div>` : '';
    const btn = pick.canAfford === false ? lockBtn(pick.reason || '现在去不了')
      : `<button class="cta" type="button" data-confirm="${c.esc(`前往「${target}」：${[pick.method, pick.duration && `约 ${pick.duration}`, pick.costText && `消耗 ${pick.costText}`].filter(Boolean).join('，')}${then ? `，到达后${then.label}` : ''}`)}" data-act="${c.esc(JSON.stringify(ptOf(dest) ? { name: 'travel', point: ptOf(dest), method: pick.method } : { name: 'travel', node: dest, path: destPath(c, dest), method: p.mode === 'local' ? '' : pick.method, then: then ? then.action : '' }))}"><i class="fa-solid fa-person-walking-arrow-right"></i>${p.mode === 'via' ? `前往${c.esc(p.via)}` : '出发'}</button>`;
    return `<div class="warn" style="color:var(--ink2);background:rgba(47,124,246,.1);box-shadow:inset 2px 0 0 var(--blue)"><i class="fa-solid fa-route"></i><span>${lead}</span></div>${sel}${info}${thenSel}${btn}`;
  };
  // 在坐标处新增地点（原项目地图维护「新增地点」）：类型同原项目模板；普通地点 / 城市可附带商店、工坊
  const addHere = (c, pt) => {
    const ui = c.state.ui, f = ui.mm = ui.mm || {}, tpls = window.COCKPIT.preview('mapTemplates') || [];
    if (!tpls.length) return '';
    const tpl = tpls.some(t => t.key === f.模板键) ? f.模板键 : tpls[0].key, extra = tpl === 'place' || tpl === 'city';
    const tog = (k, l) => `<button class="key-s${f[k] ? ' on' : ''}" type="button" aria-pressed="${!!f[k]}" data-mm-tog="${k}">${l}</button>`;
    return `<div class="groove"></div>${c.head('map-pin', '在此新增地点', 'Add')}
      <div class="dz2-grid"><div class="dzf wide"><span class="dzf-l">名称</span><input type="text" data-mm="地点名" value="${c.esc(f.地点名 || '')}" placeholder="临时地点" aria-label="地点名"></div>
      <div class="dzf wide"><span class="dzf-l">类型</span>${c.pick('mm:模板键', tpl, tpls.map(t => ({ value: t.key, label: t.label })))}</div>
      ${extra ? `<div class="dzf wide"><span class="dzf-l">附带</span><div class="act-row">${tog('启用商店', '商店')}${tog('启用工坊', '工坊')}</div></div>` : ''}
      <label class="dzf wide"><span class="dzf-l">描述</span><textarea data-mm="描述" rows="2" aria-label="描述">${c.esc(f.描述 || '')}</textarea></label></div>
      <button class="key-s" type="button" data-mm-submit><i class="fa-solid fa-plus"></i> 新增地点</button>`;
  };
  document.addEventListener('input', e => { const t = e.target.closest?.('[data-mm]'); if (t) (window.COCKPIT.ctx().state.ui.mm ||= {})[t.dataset.mm] = t.value; });
  document.addEventListener('picker:change', e => { if (e.detail.path !== 'mm:模板键') return; (window.COCKPIT.ctx().state.ui.mm ||= {}).模板键 = e.detail.value; window.COCKPIT.refresh(); });
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-mm-tog]'); if (!t) return;
    const f = (window.COCKPIT.ctx().state.ui.mm ||= {}); f[t.dataset.mmTog] = !f[t.dataset.mmTog]; window.COCKPIT.refresh();
  });
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-mm-submit]'); if (!t) return;
    const ui = window.COCKPIT.ctx().state.ui, f = ui.mm || {}, pt = ptOf(ui.dest), tpls = window.COCKPIT.preview('mapTemplates') || [];
    const tpl = tpls.find(x => x.key === f.模板键) || tpls[0], name = String(f.地点名 || '').trim(), extra = tpl && (tpl.key === 'place' || tpl.key === 'city');
    delete t.dataset.blocked;
    if (!pt || !tpl) { t.dataset.blocked = '先在总图上点选位置'; delete t.dataset.act; return; }
    if (!name) { t.dataset.blocked = '先填写地点名'; delete t.dataset.act; return; }
    t.dataset.confirm = `在坐标 ${pt.x}, ${pt.y} 新增${tpl.label}「${name}」`;
    t.dataset.act = JSON.stringify({ name: 'mapMaint', op: 'add', x: pt.x, y: pt.y, 地点名: name, 模板键: tpl.key, 启用商店: !!(extra && f.启用商店), 启用工坊: !!(extra && f.启用工坊), 描述: String(f.描述 || '').trim() });
  }, true);
  // 地点维护键（原项目地图维护）：受损的给修复，完好的给破坏；动态地点可删除（有人停留时由运行时拒绝）
  const maintRow = (c, name, state, dyn) => {
    const act = (op, label, icon, confirm, danger) => `<button class="key-s${danger ? ' danger' : ''}" type="button" data-confirm="${c.esc(confirm)}" data-act="${c.esc(JSON.stringify({ name: 'mapMaint', op, 焦点名: name, 描述: '' }))}"><i class="fa-solid fa-${icon}"></i> ${label}</button>`;
    const ruined = RUINED.test(String(state || ''));
    return `<div class="act-row">${ruined ? act('repair', '修复', 'trowel-bricks', `修复「${name}」，恢复节点动作`) : act('damage', '破坏', 'house-crack', `破坏「${name}」，节点动作暂停`, true)}${dyn ? act('delete', '删除', 'trash', `删除动态地点「${name}」`, true) : ''}</div>`;
  };
  const travel = c => {
    const { city } = nodeOf(c);
    const here = pathOf(c).slice(-1)[0], dest = c.state.ui.dest || '';
    const nodes = worldNodes(c), cur = nodes.find(n => n.name === city?.[0]);
    const near = cur ? nodes.filter(n => n !== cur).map(n => ({ n, d: Math.hypot(n.x - cur.x, n.y - cur.y) })).sort((a, b) => a.d - b.d).slice(0, 6) : [];
    const kids = Object.keys(city?.[1]?.子节点 || {}).map(k => ({ name: k, 类型: city[1].子节点[k].类型 }));
    return {
      tag: 'CORE · STAR MAP', wide: 'l',
      core: `<div class="pad">${c.head('map', '行旅星图', 'Star Map', 'gd', c.hint('点地标看详情、设目的地；带层叠标记的地标可双击（或在详情里）进入子图，子图只是查看，不改变当前位置。拖动平移，滚轮或双指缩放。'))}${sandTable(c, c.state.ui.mapTrail || [])}</div>`,
      mount: mountTable,
      railL: `<div class="rail door" data-go="page-map/place" role="link" tabindex="0" data-hint="查看当地">${c.sock('location-dot')}<small>${c.esc(here || '')}</small></div>`,
      right: `<div class="pad">
        ${c.head('flag-checkered', '目的地', 'Destination')}
        ${ptOf(dest) ? `<div class="relic-card">${c.sock('location-crosshairs', 'gd')}<div><strong>${ptOf(dest).x}, ${ptOf(dest).y}</strong><small>坐标目的地</small></div><button class="key-s" type="button" data-set="dest=" aria-label="清除坐标目的地"><i class="fa-solid fa-xmark"></i></button></div>${routeBox(c, dest)}${addHere(c, ptOf(dest))}<div class="groove"></div>` : ''}
        ${kids.length ? `<span class="lbl">${c.esc(city[0])} 城内</span><div class="list">${kids.map(k => `<button class="row ${k.name === dest ? 'on' : ''}" type="button" data-set="dest=${c.esc(k.name)}" ${k.name === here ? 'disabled' : ''}><span class="chip s">${c.esc(k.类型 || '')}</span><div><strong>${c.esc(k.name)}</strong>${k.name === here ? '<small>当前位置</small>' : ''}</div><span></span></button>`).join('')}</div>` : ''}
        <span class="lbl">邻近城市</span>
        <div class="list">${near.map(({ n, d }) => `<button class="row ${n.name === dest ? 'on' : ''}" type="button" data-set="dest=${c.esc(n.name)}"><span class="chip s">${c.esc(kindOf(n.类型)[2])}</span><div><strong>${c.esc(n.name)}</strong><small>图上距离 ${Math.round(d)}</small></div><span></span></button>`).join('')}</div>
        ${ptOf(dest) ? '' : dest ? routeBox(c, dest) : `<span class="lbl">未选择目的地${c.hint('选择一个目的地查看移动预演。')}</span><span class="cta-wrap" data-hint="先在星图或上面的列表里选一个目的地"><button class="cta" type="button" disabled><i class="fa-solid fa-person-walking-arrow-right"></i>出发</button></span>`}
      </div>`,
    };
  };

  document.addEventListener('picker:change', e => {
    if (e.detail.path !== 'travelThen') return;
    const ui = window.COCKPIT.ctx().state.ui; ui.travelThenFor = ui.dest; ui.travelThen = e.detail.value;
    window.COCKPIT.refresh();
  });
  document.addEventListener('picker:change', e => {
    if (e.detail.path !== 'travelMethod') return;
    const ui = window.COCKPIT.ctx().state.ui; ui.travelMethodFor = ui.dest; ui.travelMethod = e.detail.value;
    window.COCKPIT.refresh();
  });

  window.COCKPIT.register('page-map', {
    label: '探索', icon: 'compass', tag: 'CORE · STAR MAP',
    keys: [
      { id: 'star', icon: 'map', label: '地图', view: travel, inspect: nodeInspect },
      { id: 'place', icon: 'city', label: '当地', view: place, inspect: (c, kind, id, mode) => kind === 'dyn' ? dynInspect(c, id) : npcInspect(c, kind, id, mode) },
    ],
  });
})();

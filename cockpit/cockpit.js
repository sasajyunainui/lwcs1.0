/* 球体座舱：导航、三种模式、检视器、动效、手机转向。页面内容由 pages-*.js 注册。
   数据与写回经适配器：lwcs 里由 mvu_logic_bridge.js 提供（读当前聊天 MVU 根数据、经编辑器写回、切换查看角色）；
   没有适配器时（原型页）直接读写 window.LWCS_SAVE。挂载：COCKPIT.mount(host, adapter)。 */
(() => {
  let S = window.LWCS_SAVE || null, ADP = null, ROOT = document, mounted = false;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = ROOT) => r.querySelector(s);
  const $$ = (s, r = ROOT) => [...r.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const fmt = v => Number.isFinite(Number(v)) ? Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(v ?? '—');
  const entries = o => (o && typeof o === 'object' && !Array.isArray(o)) ? Object.entries(o) : [];
  const blank = v => v === undefined || v === null || v === '' || v === '无' || /待补全|待生成/.test(String(v));

  // 斗罗历：144 tick 一日，30 日一月，360 日一年
  const tickDate = t => {
    const d = num(t) / 144, Y = Math.floor(d / 360), M = Math.floor((d % 360) / 30) + 1, D = Math.floor(d % 30) + 1;
    const m = Math.floor((d % 1) * 1440);
    return `斗罗历${Y}年${M}月${D}日 ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };
  const rankTitle = lv => { lv = num(lv); return lv >= 91 ? '封号斗罗' : lv >= 81 ? '魂斗罗' : lv >= 71 ? '魂圣' : lv >= 61 ? '魂帝' : lv >= 51 ? '魂王' : lv >= 41 ? '魂宗' : lv >= 31 ? '魂尊' : lv >= 21 ? '大魂师' : lv >= 11 ? '魂师' : '魂士'; };
  const ringColorClass = r => {
    const c = String(r?.颜色 || ''), y = num(r?.年限);
    if (/红/.test(c) || y >= 100000) return 'color-red';
    if (/黑/.test(c) || y >= 10000) return 'color-black';
    if (/紫/.test(c) || y >= 1000) return 'color-purple';
    if (/黄/.test(c) || y >= 100) return 'color-yellow';
    if (/金/.test(c)) return 'color-gold';
    return 'color-white';
  };
  const yearTier = y => { y = num(y); return y >= 100000 ? '十万年' : y >= 10000 ? '万年' : y >= 1000 ? '千年' : y >= 100 ? '百年' : '十年'; };

  // ---------- 魂环：与 mvu_logic_bridge.js 渲染魂环SVG 同构 ----------
  const ringSvg = () => {
    const base = 'var(--c-base)'; let major = '', minor = '', fleur = '';
    for (let a = 0; a < 360; a += 90) major += `<use href="#spike-major" transform="rotate(${a} 100 100)"/>`;
    for (let a = 0; a < 360; a += 15) if (a % 90) minor += `<use href="#spike-minor" transform="rotate(${a} 100 100)"/>`;
    for (let a = 0; a < 360; a += 45) fleur += `<use href="#fleur-inner" transform="rotate(${a} 100 100)"/>`;
    return `<svg class="mvu-soul-ring-svg" viewBox="0 0 200 200" aria-hidden="true"><defs>
      <g id="spike-major"><polygon points="100,2 108,22 100,35 92,22" fill="none" stroke="${base}" stroke-width="1.5" stroke-linejoin="round"/><polygon points="100,6 103,22 100,32 97,22" fill="var(--c-acc)"/></g>
      <g id="spike-minor"><polygon points="100,18 103,28 100,35 97,28" fill="none" stroke="${base}" stroke-width="1.5" stroke-linejoin="round"/><polygon points="100,20 101,28 100,33 99,28" fill="var(--c-acc)"/></g>
      <g id="fleur-inner"><polygon points="100,32 104,45 100,58 96,45" fill="var(--c-acc)"/><path d="M 100 35 Q 115 40 108 52 Q 104 46 100 42 Q 96 46 92 52 Q 85 40 100 35 Z" fill="none" stroke="${base}" stroke-width="1.5"/></g>
      </defs><g class="spin-cw"><circle cx="100" cy="100" r="66" fill="none" stroke="var(--c-band)" stroke-width="14"/><circle cx="100" cy="100" r="59" fill="none" stroke="${base}" stroke-width="1.5" opacity=".8"/><circle cx="100" cy="100" r="73" fill="none" stroke="${base}" stroke-width="1.5" opacity=".8"/>${major}${minor}${fleur}</g>
      <g class="spin-ccw"><circle cx="100" cy="100" r="66" fill="none" stroke="var(--c-acc)" stroke-width="2" stroke-dasharray="2 4 8 4 3 10"/></g><circle class="mvu-soul-ring-hit" cx="100" cy="100" r="66" fill="none" stroke="transparent" stroke-width="22"/></svg>`;
  };
  // 魂环舞台（soul_ring_engine 原样）：平时同心叠环，悬停倾斜为 3D 魂环塔；attrs(ring, i) 可给每一圈挂额外属性
  const ringStage = (rings, attrs) => {
    const n = rings.length;
    if (!n) return '<div class="mvu-soul-ring-showcase mvu-soul-ring-showcase--empty"><div class="mvu-soul-ring-empty-core"></div></div>';
    const slots = rings.map((ring, i) => {
      const r = n > 1 ? i / (n - 1) : .5, d = n > 1 ? 1 - r : .5;
      // 塔间距：原公式固定铺满 -80~120px，两三环时会被拉到舞台两端；改为每圈 ≤28px、总高 ≤200px、以舞台中心对称（只动间距，不动魂环造型）
      const step = n > 1 ? Math.min(28, 200 / (n - 1)) : 0, z = ((n - 1) / 2 - i) * step;
      return `<div class="mvu-soul-ring-slot ${ringColorClass(ring)}" tabindex="0" data-ring-index="${i + 1}" aria-label="第${i + 1}魂环" ${attrs ? attrs(ring, i) : ''} style="--ring-scale:${(.58 + r * 1.22).toFixed(3)};--ring-depth-scale:${(1.34 - d * .74).toFixed(3)};--ring-z:${z.toFixed(0)}px;--ring-depth-opacity:${(.78 + r * .22).toFixed(2)};--ring-z-index:${n - i}">${ringSvg()}</div>`;
    }).join('');
    return `<div class="mvu-soul-ring-showcase mvu-soul-ring-showcase--standard"><div class="mvu-soul-ring-stage" data-ring-count="${n}">${slots}</div></div>`;
  };
  const ringMedal = (ring, label, micro = false) => `<div class="medal"><div class="mvu-soul-ring-showcase${micro ? ' mvu-soul-ring-showcase--micro' : ''}"><div class="mvu-soul-ring-stage" data-ring-count="1"><div class="mvu-soul-ring-slot ${ringColorClass(ring)}" style="--ring-scale:1">${ringSvg()}</div></div></div>${label === '' ? '' : `<b>${esc(label)}</b>`}</div>`;

  // ---------- 角色数据读取 ----------
  const souls = ch => entries(ch).filter(([k, v]) => /^第\d+武魂$/.test(k) && v && v.表象名称).map(([slot, v]) => {
    const spirits = entries(v).filter(([k, x]) => /^第\d+魂灵$/.test(k) && x && typeof x === 'object').map(([sk, sp]) => ({
      slot: sk, ...sp,
      rings: entries(sp).filter(([k, x]) => /^第\d+魂环$/.test(k) && x && typeof x === 'object').map(([rk, ring]) => ({
        slot: rk, ...ring, skills: entries(ring).filter(([, x]) => x && typeof x === 'object' && x.魂技名).map(([kk, sk2]) => ({ slot: kk, ...sk2 })),
      })),
    }));
    // 独立魂环：直接挂在武魂下的「第N魂环」（同原项目 取武魂直接魂环条目），排在魂灵魂环之后
    const direct = entries(v).filter(([k, x]) => /^第\d+魂环$/.test(k) && x && typeof x === 'object').map(([rk, ring]) => ({
      slot: rk, independent: true, ...ring, skills: entries(ring).filter(([, x]) => x && typeof x === 'object' && x.魂技名).map(([kk, sk2]) => ({ slot: kk, ...sk2 })),
    }));
    return { slot, ...v, spirits, direct, rings: [...spirits.flatMap(sp => sp.rings), ...direct] };
  });
  // 运行时全局：lwcs 里 MVU 运行时（技能 / 结构 / 商品池 / 修炼公式等）跑在酒馆助手的脚本 iframe 里，只有部分 __LWCS_* 对象共享到主页面。
  // 先找本窗口与顶层窗口，再找各 iframe（记住找到的窗口）；原型页这些都在本窗口
  const rtWin = {};
  const rt = name => {
    try { const w = rtWin[name]; if (w && w[name] !== undefined) return w[name]; } catch (e) {}
    const wins = [window]; try { if (window.top && window.top !== window) wins.push(window.top); } catch (e) {}
    document.querySelectorAll('iframe').forEach(f => { try { if (f.contentWindow) wins.push(f.contentWindow); } catch (e) {} });
    for (const w of wins) { try { if (w[name] !== undefined) { rtWin[name] = w; return w[name]; } } catch (e) {} }
    return undefined;
  };
  // 内置库（地点 / 势力）：按当前 tick 所在的资源时代取该时代的库（时代数据注册表给出 globalKey），没加载就请求加载、加载完重绘；
  // 原型页没有时代运行时，直接用页面里的 __LWCS_内置地点库__ / __LWCS_内置势力库__
  const libAsked = new Set();
  const library = type => {
    const fallback = { location: '__LWCS_内置地点库__', faction: '__LWCS_内置势力库__' }[type];
    const I = rt('__LWCS_ERA_RUNTIME_INTEGRATION_V1__'), reg = rt('__LWCS_ERA_DATA_REGISTRY_V1__'), tick = num(S?.world?.时间?.tick);
    if (!I || !reg || !S?.world?.时间) return rt(fallback);
    let key = '', era = '';
    try { era = I.resolveResourceEraAtTick(tick); key = reg.getResourceDescriptor(era, type)?.globalKey || ''; } catch (e) { return rt(fallback); }
    const lib = key ? rt(key) : undefined;
    if (!lib && key && !libAsked.has(era + '/' + type)) {
      libAsked.add(era + '/' + type);
      Promise.resolve(I.ensureEraResourcesForTick(tick, [type])).then(() => C.refresh()).catch(err => console.warn('[座舱] 内置库加载失败', type, err));
    }
    return lib;
  };
  const portraitIndex = {};
  const portraitBase = () => document.documentElement.dataset.lwcsCharacterAssets || 'http://127.0.0.1:39281/assets/characters/';
  const loadPortraits = () => fetch(portraitBase() + 'manifest.json').then(r => r.json()).then(m => {
    for (const c of m.characters || []) { if (!portraitIndex[c.name] || c.book === 'dl3') portraitIndex[c.name] = c; }
    C.refresh();
  }).catch(() => {});
  const AVATAR_KEY = 'lwcs-cockpit-avatar-';
  const avatarSrc = name => {
    const own = ADP?.avatarSrc?.(name); if (own) return own;
    try { const up = localStorage.getItem(AVATAR_KEY + name); if (up) return up; } catch (e) {}
    const p = portraitIndex[name]; return p ? portraitBase() + p.avatar : '';
  };
  // 只有头像、没有立绘的角色（如从百科补的头像）不拼立绘地址
  const standingSrc = name => { const p = portraitIndex[name]; return p && p.standing ? portraitBase() + p.standing : ''; };
  const miniAva = name => { const src = avatarSrc(name); return `<span class="mini-ava">${src ? `<img src="${esc(src)}" alt="">` : esc(String(name).slice(-2, -1) || name[0])}</span>`; };

  // ---------- 小部件 ----------
  const bar = (cls, cur, max) => { const pct = max > 0 ? Math.max(0, Math.min(100, cur / max * 100)) : 0; return `<div class="bar ${cls}" role="meter" aria-valuenow="${num(cur)}" aria-valuemax="${num(max)}"><div class="tr"><i data-w="${pct.toFixed(2)}"></i></div></div>`; };
  const count = (v, cls = '') => `<b class="${cls}" data-count="${num(v)}">0</b>`;
  const sock = (icon, tint = '') => `<span class="sock ${tint}"><i class="fa-solid fa-${icon}"></i></span>`;
  const head = (icon, title, en, tint = '', aside = '') => `<h2 class="h">${sock(icon, tint)}${esc(title)}${en ? `<span class="en">${esc(en)}</span>` : ''}${aside}</h2>`;
  // 说明一律悬停显示，不占版面：hintMark 是标签旁的小「?」，桌面悬停、键盘聚焦、手机点按都能看
  const hintMark = text => text ? `<i class="hint" tabindex="0" role="button" aria-label="说明" data-hint="${esc(text)}">?</i>` : '';
  const empty = (icon, title, hint = '') => `<div class="void"><span class="sock" style="--s:2.6em"><i class="fa-solid fa-${icon}"></i></span><strong>${esc(title)}${hintMark(hint)}</strong></div>`;
  // 选择控件：带逐项说明的下拉（原生 select 无法给选项配悬停说明）。options 为字符串或 { value, label, hint, group }；
  // 选中后在控件上派发 picker:change（detail: { path, value }）。悬停控件本身显示当前选项的说明
  const optOf = o => o && typeof o === 'object' ? { value: String(o.value ?? o.label ?? ''), label: String(o.label ?? o.value ?? ''), hint: o.hint || '', group: o.group || '' } : { value: String(o ?? ''), label: String(o ?? ''), hint: '', group: '' };
  let pointerHeld = false;
  document.addEventListener('pointerdown', () => { pointerHeld = true; }, true);
  document.addEventListener('pointerup', () => { pointerHeld = false; }, true);
  const pick = (path, value, options = [], o = {}) => {
    const opts = options.map(optOf), v = String(value ?? ''), cur = opts.find(x => x.value === v);
    return `<span class="picker${o.cls ? ' ' + o.cls : ''}" data-picker="${esc(path)}" data-picker-opts="${esc(JSON.stringify(opts))}" data-picker-value="${esc(v)}"><button type="button" class="picker-btn" aria-haspopup="listbox" aria-expanded="false"${o.disabled ? ' disabled' : ''}${cur?.hint ? ` data-hint="${esc(cur.hint)}"` : ''}><span>${esc(cur ? cur.label : (v || o.placeholder || '请选择'))}</span><i class="fa-solid fa-chevron-down"></i></button></span>`;
  };
  const kv = rows => `<dl class="kv">${rows.filter(Boolean).map(([k, v, cls]) => `<dt>${esc(k)}</dt><dd class="${cls || ''}">${v}</dd>`).join('')}</dl>`;
  const val = (v, fallback = '未记录') => blank(v) ? `<span class="dim">${esc(fallback)}</span>` : esc(v);

  // ---------- 注册表与状态 ----------
  const order = ['page-archive', 'page-ability', 'page-supplies', 'page-map', 'page-world', 'page-terminal'];
  const domains = {};
  // 跳转处理器：原项目流程要打开旧详情面时，桥接改为 COCKPIT.route({ to, … })，由页面登记的处理器接手
  const routes = {};
  const state = { domain: null, page: {}, inspect: null, view: S?.sys?.玩家名 || '', face: 0, ui: {} };
  // ---------- 内联编辑（与原项目 makeInlineEditableValue / beginInlineEdit 同一语义）----------
  // 常驻：点击可编辑值即原地编辑；kind = string | number | enum | text（多行）。path 是存档根下的键路径数组。
  // 原型写回内存存档后重绘；移植时换成 replaceStatDataByEditor → 整根 MVU schema 校验 → replaceMvuData。
  const ed = (text, path, o = {}) => `<span class="ie" tabindex="0" role="button" data-ie-path="${esc(JSON.stringify(path))}" data-ie-kind="${o.kind || 'string'}" data-ie-meta="${esc(JSON.stringify({ min: o.min, max: o.max, integer: o.integer, options: o.options, suffix: o.suffix, renameKey: o.renameKey }))}" data-ie-raw="${esc(String(o.raw ?? text ?? ''))}" title="点击编辑">${o.html ?? esc(String(text ?? ''))}</span>`;
  // 列表检索（原项目角色目录 / 技能检索 / 图鉴检索）：输入框按同一面板里列表行的文字筛选，不重绘、不丢焦点；
  // 关键词存在 ui.qs，面板重绘后重新套用
  const search = (key, ph) => `<label class="q-search"><i class="fa-solid fa-magnifying-glass"></i><input type="search" data-qs="${esc(key)}" value="${esc(state.ui.qs?.[key] || '')}" placeholder="${esc(ph)}" aria-label="${esc(ph)}" autocomplete="off"></label>`;
  const filterRows = inp => {
    const q = inp.value.trim().toLowerCase(), pad = inp.closest('.pad') || inp.parentElement;
    $$('.list .row, .roster .rc', pad).forEach(r => { r.hidden = !!q && !r.textContent.toLowerCase().includes(q); });
  };
  document.addEventListener('input', e => { const t = e.target.closest?.('[data-qs]'); if (!t) return; (state.ui.qs ||= {})[t.dataset.qs] = t.value; filterRows(t); });
  const ctx = () => {
    if (!S.char[state.view]) state.view = S.sys.玩家名;
    const ch = S.char[state.view] || {};
    return { rt, library, S, name: state.view, ch, st: ch.属性 || {}, isPlayer: state.view === S.sys.玩家名, player: S.sys.玩家名, souls: souls(ch), tickDate, rankTitle, yearTier, ringStage, ringMedal, ringColorClass, bar, count, sock, head, empty, kv, val, hint: hintMark, pick, esc, fmt, num, entries, blank, avatarSrc, standingSrc, miniAva, state, ed, search, P: (...p) => ['char', state.view, ...p] };
  };

  // 写回：ops = [{ path, value }] 或 [{ path, del: true }]，path 是存档根下的键路径。
  // 有适配器时交给桥接（整根 MVU 校验后落楼，桥接刷新后经 setData 回灌）；原型直接改内存存档并重绘
  const getAt = p => p.reduce((o, k) => (o == null ? o : o[k]), S);
  const setAt = (p, v) => { let o = S; for (const k of p.slice(0, -1)) { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; } o[p[p.length - 1]] = v; };
  const delAt = p => { const parent = getAt(p.slice(0, -1)), k = p[p.length - 1]; if (Array.isArray(parent)) parent.splice(Number(k), 1); else if (parent) delete parent[k]; };
  const write = async ops => {
    ops = (ops || []).filter(o => o && Array.isArray(o.path) && o.path.length);
    if (!ops.length) return true;
    if (ADP?.write) {
      try { await ADP.write(ops); return true; }
      catch (err) { console.error('[座舱] 写回失败', err); ADP.toast?.(err?.message || '变量写回失败', 'error'); api.refresh?.(); return false; }
    }
    for (const o of ops) o.del ? delAt(o.path) : setAt(o.path, o.value);
    api.refresh?.(); api.syncReadout?.();
    return true;
  };
  let api = {};
  const C = window.COCKPIT = {
    ctx: () => ctx(),
    register(id, def) { domains[id] = def; },
    has(id) { return !!domains[id]; },
    write,
    rt,
    library,
    // 动作：lwcs 交给桥接调原项目执行函数，返回 { ok, message }；原型页没有运行时
    act: async (name, payload = {}) => { if (!ADP?.act) return { ok: true, message: '原型页：未连接运行时' }; try { return await ADP.act(name, payload) || { ok: true, message: '' }; } catch (err) { return { ok: false, message: err?.message || String(err) }; } },
    preview: (name, payload = {}) => { try { return ADP?.preview?.(name, payload) ?? null; } catch (err) { return { ok: false, allowed: false, reason: err?.message || String(err) }; } },
    // 需要先同步运行时状态的预演（如移动要先刷新星图节点表）；没有异步实现时退回同步预演
    previewAsync: async (name, payload = {}) => { try { return (await (ADP?.previewAsync ? ADP.previewAsync(name, payload) : ADP?.preview?.(name, payload))) ?? null; } catch (err) { return { ok: false, allowed: false, reason: err?.message || String(err) }; } },
    privateArchiveKey: () => (ADP?.privateArchiveAllowed?.() ? ADP.privateArchiveKey : ''),
    // 待处理事项（待选魂环、待确认技能设计）；原型页没有运行时，返回 null
    pending: () => { try { return ADP?.pending?.() || null; } catch (err) { return null; } },
    addRoute(name, fn) { routes[name] = fn; },
    // 返回 true 表示座舱已接手（桥接据此不再打开旧面板）
    route(spec = {}) {
      if (!mounted) return false;
      // ui：跳过去时顺带选中的条目（如第二武魂、某个武装挂点）
      if (spec.to === 'page') { if (!domains[spec.domain]) return false; if (spec.ui && typeof spec.ui === 'object') Object.assign(state.ui, spec.ui); api.switchDomain?.(spec.domain, spec.page); return true; }
      const fn = routes[spec.to]; if (typeof fn !== 'function') return false;
      try { return fn(spec) !== false; } catch (err) { console.error('[座舱] 跳转失败', err); return false; }
    },
    battleActive: () => !!ADP?.battleActive?.(),
    get mounted() { return mounted; },
    refresh() { api.refresh?.(); },
    // 输入框失焦后的重绘：按键还没松开时等这次点击结束再重绘，免得按钮被换掉、点击落空
    refreshSoon() { if (!pointerHeld) return api.refresh?.(); document.addEventListener('click', () => setTimeout(() => api.refresh?.()), { once: true, capture: true }); },
    go(id, page) { api.switchDomain?.(id, page); },
    page(key) { api.switchPage?.(key); },
    inspect(kind, id) { api.openInspector?.(kind, id); },
    closeInspector() { api.closeInspector?.(); },
    reproject() { api.reproject?.(); },
    view(name) { if (!S?.char?.[name]) return; state.view = name; state.inspect = null; ADP?.setActive?.(name); api.refresh?.(); },
    // 桥接刷新后回灌最新根数据：编辑进行中先记下，提交 / 取消后再重绘，不打断输入
    setData(root) { if (!root || typeof root !== 'object') return; S = root; if (!S.char?.[state.view]) state.view = S.sys?.玩家名 || state.view; if (!mounted) return; if (api.isEditing?.()) { api.pending = true; return; } api.refresh?.(); api.syncReadout?.(); },
    // 挂到宿主元素里：首次构建座舱 DOM 并初始化；之后宿主重建时把同一棵 DOM 移过去（事件监听随节点保留）
    mount(host, adapter) {
      if (adapter) ADP = adapter;
      const root0 = ADP?.getRoot?.(); if (root0) S = root0;
      if (!S || !host) return false;
      // 先挂进宿主再初始化：窄屏判断、画布尺寸、滑块位置都要读真实宽度
      // 重排只在首次挂载与换宿主时做；同宿主的数据刷新不重排（读宽度会强制布局），宽度变化由座舱的 ResizeObserver 处理
      if (!mounted) { state.view = ADP?.activeName?.() || S.sys?.玩家名 || ''; buildDom(); host.appendChild(ROOT); init(); mounted = true; loadPortraits(); api.start(); api.relayout?.(); }
      else if (ROOT.parentElement !== host) { host.appendChild(ROOT); api.relayout?.(); }
      return true;
    },
    unmount() { if (ROOT.parentElement) ROOT.remove(); },
  };
  // 座舱外壳：作用域类 lwcs-ck（样式全部收在其下，不污染酒馆与其他界面）；浮层（悬停说明 / 下拉 / 浮动编辑器）挂在同作用域的 body 级容器里
  let OVERLAY = null;
  const buildDom = () => {
    ROOT = document.createElement('div'); ROOT.className = 'lwcs-ck lwcs-ck-root';
    ROOT.innerHTML = `<section class="cockpit" aria-label="球体座舱">
  <canvas class="motes" aria-hidden="true"></canvas>
  <div class="stage">
    <nav class="arc" aria-label="状态栏领域"><div class="bz"><div class="b2"><div class="b3"><div class="track" id="ck-track"><span class="slider" aria-hidden="true"></span></div></div></div></div></nav>
    <div class="screens">
      <span class="hinge l" aria-hidden="true"></span><span class="hinge r" aria-hidden="true"></span>
      <div class="wing l"><div class="float"><div class="bz"><div class="b2"><div class="b3">
        <span class="tagline" aria-hidden="true">SM-L01</span><span class="led tr" aria-hidden="true"></span><span class="screw br" aria-hidden="true"></span>
        <div class="scr"><div class="host" id="ck-wingL"></div></div>
      </div></div></div></div></div>
      <div class="center"><div class="float"><div class="bz"><div class="b2"><div class="b3">
        <span class="tagline" aria-hidden="true" id="ck-coreTag">CORE</span><span class="led tr" aria-hidden="true"></span><span class="led bl" aria-hidden="true"></span><span class="screw br" aria-hidden="true"></span><span class="screw tl" aria-hidden="true"></span>
        <div class="scr"><div class="host" id="ck-core"></div></div>
      </div></div></div></div></div>
      <div class="wing r"><div class="float"><div class="bz"><div class="b2"><div class="b3">
        <span class="tagline" aria-hidden="true">SM-R01</span><span class="led tr" aria-hidden="true"></span><span class="screw br" aria-hidden="true"></span>
        <div class="scr"><div class="host" id="ck-wingR"></div></div>
      </div></div></div></div></div>
    </div>
    <nav class="dots" aria-label="切换屏面"><button type="button" data-face="-1">根基</button><button type="button" data-face="0" class="on">主屏</button><button type="button" data-face="1">操作</button></nav>
    <div class="deck"><div class="bz"><div class="b2"><div class="b3">
      <div class="keybed"><nav class="keys" id="ck-keys" aria-label="领域页面"></nav></div>
    </div></div></div></div>
    <div class="readout">
        <span class="door" data-go="page-map/place" role="link" tabindex="0" title="查看当地"><i class="fa-solid fa-location-dot"></i> <span id="ck-rLoc"></span></span>
        <span class="num"><i class="fa-regular fa-clock"></i> <span id="ck-rTime"></span></span>
        <span class="pends" id="ck-rPend" aria-label="待处理"></span>
        <span class="res" id="ck-rRes" aria-label="随行资源"></span>
        <div class="tick" aria-label="系统播报"><span><b>播报</b><span id="ck-rTick"></span></span></div>
        <i class="fa-solid fa-bullhorn tick-ico" tabindex="0" role="button" aria-label="系统播报" data-hint=""></i>
    </div>
  </div>
</section>`;
    OVERLAY = document.createElement('div'); OVERLAY.className = 'lwcs-ck lwcs-ck-overlay'; document.body.append(OVERLAY);
  };

  function init() {
  // ---------- DOM ----------
  const track = $('#ck-track'), slider = $('.slider', track), screens = $('.screens');
  const host = { l: $('#ck-wingL'), c: $('#ck-core'), r: $('#ck-wingR') };
  const wingEl = { l: $('.wing.l'), r: $('.wing.r') };
  // 窄屏判断缓存座舱宽度：切换和视差循环里反复调用，现读 clientWidth 会在 DOM 刚改完时触发强制同步布局。
  // 窗口 resize（本监听最先注册，先于其他 resize 处理）与 ResizeObserver 两处更新
  let mobileNow = $('.cockpit').clientWidth <= 700;
  const syncMobile = () => { mobileNow = $('.cockpit').clientWidth <= 700; };
  addEventListener('resize', syncMobile);
  // 座舱宽度变化（窗口之外还有酒馆侧栏开合、聊天栏宽度设置）：下一帧整体重排一次；只看宽度，内容撑高不触发
  let lastWidth = -1, relayoutQueued = false;
  new ResizeObserver(entries => {
    syncMobile();
    const w = Math.round(entries[0]?.contentRect?.width || 0);
    if (w === lastWidth || relayoutQueued) return;
    lastWidth = w; relayoutQueued = true;
    requestAnimationFrame(() => { relayoutQueued = false; api.relayout?.(); });
  }).observe($('.cockpit'));
  const isMobile = () => mobileNow;

  const charge = (root, quiet = false) => {
    $$('[data-qs]', root).forEach(i => { if (i.value) filterRows(i); });
    if (quiet) {
      $$('.bar i[data-w]', root).forEach(i => { i.style.width = i.dataset.w + '%'; });
      $$('.dial .arc[data-off]', root).forEach(a => { a.style.strokeDashoffset = a.dataset.off; });
      $$('[data-count]', root).forEach(el => { el.textContent = fmt(Number(el.dataset.count)); });
      return;
    }
    // 入场：条目按顺序扫描显现（clip 擦出 + 扫描线），不做透明度闪烁
    if (!reduce && !root.closest?.('.fcard')) $$('.row,.card,.dark,.fx,.tile,.meter,.stat,.outfit>div,.strip,.cast,.dial,.radar', root).slice(0, 36).forEach((el, i) => { el.classList.add('reveal'); el.style.setProperty('--i', i); });
    requestAnimationFrame(() => requestAnimationFrame(() => $$('.bar i[data-w]', root).forEach(i => { i.style.width = i.dataset.w + '%'; })));
    requestAnimationFrame(() => requestAnimationFrame(() => $$('.dial .arc[data-off]', root).forEach(a => { a.style.strokeDashoffset = a.dataset.off; })));
    $$('[data-count]', root).forEach(el => {
      const to = Number(el.dataset.count);
      if (reduce) { el.textContent = fmt(to); return; }
      // 数字滚动约每 50ms 换一次字（每次换字都要重排所在行）；高刷屏上逐帧换字会把切换动画拖慢
      const t0 = performance.now(), dur = 850; let shown = 0;
      const step = now => { const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3); if (p === 1 || now - shown >= 50) { shown = now; el.textContent = fmt(Math.round(to * e)); } if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  };
  // 页内状态变化（页签 / 筛选 / 编辑写回）走静默更新：内容没变的区域原样保留（返回 null，不重复挂载），变了的就地替换、保留滚动位置
  const lastHtml = new WeakMap();
  const SCROLLERS = '.scroll,.dz-body,.pad,.list';
  const scrollOf = root => [root, ...$$(SCROLLERS, root)].map(e => e.scrollTop);
  const put = (el, html, anim, quiet = false) => {
    // 只保留当前一层：先清掉上次切换残留的退场层（动画被打断、或窗口在后台不推进动画时 onfinish 不会触发）
    $$('.face.leaving', el).forEach(f => f.remove());
    const old = $$('.face', el).pop();
    if (quiet && old && lastHtml.get(el) === html) return null;
    lastHtml.set(el, html);
    const next = document.createElement('div'); next.className = 'face'; next.innerHTML = html;
    if (quiet && old) { const st = scrollOf(old); el.replaceChildren(next); charge(next, true); [next, ...$$(SCROLLERS, next)].forEach((e, i) => { if (st[i]) e.scrollTop = st[i]; }); return next; }
    if (!old || reduce || !anim) { el.replaceChildren(next); charge(next); return next; }
    old.classList.add('leaving'); el.appendChild(next);
    const drop = () => old.remove();
    old.animate([{ transform: 'none', opacity: 1 }, { transform: anim.out, opacity: 0 }], { duration: 300, easing: 'cubic-bezier(.4,0,1,1)' }).onfinish = drop;
    setTimeout(drop, 380);
    next.animate([{ transform: anim.in, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 480, delay: 80, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
    charge(next);
    return next;
  };
  const angle = side => parseFloat(getComputedStyle(wingEl[side]).getPropertyValue(side === 'l' ? '--la' : '--ra')) || 26;
  // 两翼动作：fold=领域切换（向后收折），dip=子页 / 检视器（轻点头）。
  // from / to = 切换前后的翼板角度：收窄 / 展开时角度由这段动画带过去（只走合成），列宽已在切换瞬间一次到位
  const swing = (side, html, mode, from = angle(side), to = from) => {
    const el = wingEl[side], sign = side === 'l' ? 1 : -1;
    if (reduce || isMobile()) { put(host[side], html, isMobile() ? { out: 'translateY(-3%)', in: 'translateY(3%)' } : null); return; }
    const rot = a => `rotateY(${sign * a}deg)`;
    const frames = mode === 'fold'
      ? [{ transform: rot(from) }, { transform: `rotateY(${sign * -72}deg) translateZ(-40px)`, offset: .42 }, { transform: rot(to + 5), offset: .8 }, { transform: rot(to) }]
      : [{ transform: rot(from) }, { transform: rot(to + 16), offset: .45 }, { transform: rot(to) }];
    const dur = mode === 'fold' ? 900 : 560;
    el.animate(frames, { duration: dur, easing: 'cubic-bezier(.45,0,.25,1)' });
    // 宽度变了的一侧立即换内容（旧内容不该挤在新宽度里转回去）；宽度没变的照旧在翻到最远处时换
    if (from !== to) put(host[side], html, null);
    else setTimeout(() => put(host[side], html, null), dur * (mode === 'fold' ? .42 : .45));
  };
  const keysFor = d => d.keys.map(k => `<button class="key" type="button" data-page="${k.id}" aria-label="${esc(k.label)}"><i class="fa-solid fa-${k.icon}"></i><span class="lb">${esc(k.label)}</span></button>`).join('');
  const markKeys = () => $$('#ck-keys .key').forEach(k => { const on = k.dataset.page === state.page[state.domain]; k.classList.toggle('on', on); on ? k.setAttribute('aria-current', 'page') : k.removeAttribute('aria-current'); });
  const swapKeys = (d, first) => {
    const keys = $('#ck-keys');
    const set = () => { keys.innerHTML = keysFor(d); markKeys(); };
    const away = getComputedStyle(keys).flexDirection === 'column' ? 'translateX(120%)' : 'translateY(120%)';
    if (reduce) { set(); return; }
    if (first) { set(); keys.animate([{ transform: away }, { transform: 'none' }], { duration: 600, delay: 250, easing: 'cubic-bezier(.2,.9,.3,1.2)', fill: 'backwards' }); return; }
    // 换键只执行一次：动画结束或超时兜底（窗口在后台时动画不推进，onfinish 不触发）
    let done = false;
    const swap = () => { if (done) return; done = true; set(); keys.animate([{ transform: away }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1.25)' }); };
    keys.animate([{ transform: 'none' }, { transform: away }], { duration: 240, easing: 'ease-in' }).onfinish = swap;
    setTimeout(swap, 320);
  };
  // 领域标签竖排（宽屏侧轨）时滑块按纵向定位，横排时按横向；另一方向交回样式表
  const moveSlider = tab => {
    if (!tab) return;
    const column = getComputedStyle(track).flexDirection === 'column';
    Object.assign(slider.style, column ? { left: '', width: '', top: tab.offsetTop + 'px', height: tab.offsetHeight + 'px' } : { top: '', height: '', left: tab.offsetLeft + 'px', width: tab.offsetWidth + 'px' });
  };

  const currentView = () => {
    const d = domains[state.domain], key = state.page[state.domain] || d.keys[0].id;
    const page = d.keys.find(k => k.id === key) || d.keys[0];
    return { d, page, v: page.view(ctx()) };
  };
  const applyWide = v => {
    $('.cockpit').dataset.view = `${state.domain}/${state.page[state.domain] || domains[state.domain].keys[0].id}`;
    const wide = isMobile() ? '' : (v.wide || '');
    screens.classList.toggle('wide-l', wide === 'both' || wide === 'l');
    screens.classList.toggle('wide-r', wide === 'both' || wide === 'r');
  };
  const wingHtml = (v, side) => {
    const wideSide = !isMobile() && (v.wide === 'both' || v.wide === side);
    if (wideSide) return v[side === 'l' ? 'railL' : 'railR'] || `<div class="rail"></div>`;
    return v[side === 'l' ? 'left' : 'right'] || v[side === 'l' ? 'railL' : 'railR'] || '';
  };
  // 手机端三面切换的标签：页面可用 faces 指定；否则取该翼第一个标题（背包 / 钱包 …），只有侧轨时取侧轨小字，都没有才用通用名
  const faceLabel = (html, rail, dflt) => (String(html || '').match(/<h2 class="h"><span class="sock[^"]*"><i[^>]*><\/i><\/span>([^<]+)/) || [])[1]?.trim()
    || (!html && (String(rail || '').match(/<small>([^<]+)<\/small>/) || [])[1]?.trim()) || dflt;
  const setFaceLabels = v => { const [l, , r] = $$('.dots button'); if (l) l.textContent = v.faces?.l || faceLabel(v.left, v.railL, '根基'); if (r) r.textContent = v.faces?.r || faceLabel(v.right, v.railR, '详情'); };
  const setFace = i => {
    state.face = i;
    screens.style.setProperty('--turn', `${-i * 60}deg`);
    $$('.dots button').forEach(b => b.classList.toggle('on', Number(b.dataset.face) === i));
    requestAnimationFrame(fitCarousel);
  };
  const fitCarousel = () => {
    if (!isMobile()) { screens.style.removeProperty('--carousel-h'); return; }
    const el = state.face === -1 ? wingEl.l : state.face === 1 ? wingEl.r : $('.center');
    screens.style.setProperty('--carousel-h', Math.max(320, el.scrollHeight) + 'px');
  };

  // 页面可提供 mount(face, ctx) 挂交互（沙盘拖拽、缩放等），每次主屏换面后调用
  const mount = (v, face) => { if (face && typeof v.mount === 'function') try { v.mount(face, ctx()); } catch (err) { console.error(err); } };
  function renderPage(how) {
    const { d, v } = currentView();
    $('#ck-coreTag').textContent = v.tag || d.tag || 'CORE';
    // 两翼宽度在切换瞬间一次到位：原先列宽过渡 0.7s，每帧整个座舱重排重绘（世界页两翼都收窄，最卡）
    // 翼板角度只给领域 / 子页切换的动画用；数据刷新不读（读 CSS 自定义属性会强制整页样式重算，酒馆页面很重）
    const animated = how.kind === 'domain' || how.kind === 'page';
    const fromA = animated ? { l: angle('l'), r: angle('r') } : null;
    applyWide(v); setFaceLabels(v);
    const toA = animated ? { l: angle('l'), r: angle('r') } : null;
    if (how.kind === 'domain') {
      mount(v, put(host.c, v.core, { out: `translateX(${-how.dir * 9}%)`, in: `translateX(${how.dir * 9}%)` }));
      swing('l', wingHtml(v, 'l'), how.first ? 'none' : 'fold', fromA.l, toA.l);
      swing('r', wingHtml(v, 'r'), how.first ? 'none' : 'fold', fromA.r, toA.r);
    } else if (how.kind === 'page') {
      mount(v, put(host.c, v.core, { out: 'translateY(-4%)', in: 'translateY(4%)' }));
      swing('l', wingHtml(v, 'l'), 'dip', fromA.l, toA.l);
      swing('r', wingHtml(v, 'r'), 'dip', fromA.r, toA.r);
    } else {
      mount(v, put(host.c, v.core, null, true)); put(host.l, wingHtml(v, 'l'), null, true); put(host.r, wingHtml(v, 'r'), null, true);
    }
    setTimeout(fitCarousel, 700);
  }

  let busy = 0;
  function switchDomain(id, page, first = false) {
    if (!domains[id]) return;
    if (id === state.domain && !page) return;
    const dir = state.domain ? Math.sign(order.indexOf(id) - order.indexOf(state.domain)) || 1 : 1;
    state.domain = id; state.inspect = null; clearFloat();
    if (page) state.page[id] = page; else state.page[id] = state.page[id] || domains[id].keys[0].id;
    $$('.tab', track).forEach(t => { const on = t.dataset.tab === id; t.classList.toggle('on', on); on ? t.setAttribute('aria-current', 'page') : t.removeAttribute('aria-current'); if (on) moveSlider(t); });
    swapKeys(domains[id], first);
    if (isMobile()) setFace(0);
    renderPage({ kind: 'domain', dir, first });
    if (first && !reduce) $('.center').animate([{ transform: 'translateZ(-160px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 800, easing: 'cubic-bezier(.2,.9,.25,1)' });
  }
  function switchPage(key) {
    const d = domains[state.domain];
    if (!d.keys.some(k => k.id === key) || state.page[state.domain] === key) return;
    state.page[state.domain] = key; state.inspect = null; clearFloat(); markKeys();
    if (isMobile()) setFace(0);
    renderPage({ kind: 'page' });
  }
  // 锚定浮窗：贴在来源元素旁浮出，无遮罩、不阻断其他操作（严格禁止模态弹窗）；手机上在原位展开
  const cockpitEl = $('.cockpit');
  const layer = document.createElement('div'); layer.className = 'float-layer'; cockpitEl.appendChild(layer);
  const floatOpen = () => !!layer.firstChild || !!$('.inline-detail');
  function clearFloat() { layer.replaceChildren(); $$('.inline-detail').forEach(el => el.remove()); }
  function project(html, anchor, swap = false) {
    const old = swap && !isMobile() ? $('.fcard', layer) : null;
    if (old) { $('.holo-in', old).innerHTML = html; old.style.transition = reduce ? '' : 'top .2s cubic-bezier(.2,.8,.2,1)'; place(old, anchor); return; }
    clearFloat();
    const body = `<div class="holo" role="region" aria-label="详情"><div class="holo-in">${html}</div></div>`;
    if (isMobile() && anchor) {
      const box = document.createElement('div'); box.className = 'inline-detail'; box.innerHTML = body;
      // 锚点在成排容器（如魂环舞台）里时，详情插在整个容器之后，不塞进绝对定位的舞台内部
      (anchor.closest('[data-float]') || anchor).insertAdjacentElement('afterend', box); charge(box);
      if (!reduce) box.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'ease-out' });
      requestAnimationFrame(fitCarousel); return;
    }
    layer.innerHTML = `<svg class="float-link" aria-hidden="true"><path></path><circle r="3.5"></circle></svg><div class="fcard">${body}</div>`;
    const card = $('.fcard', layer), side = place(card, anchor);
    charge(card);
    if (!reduce) card.animate([{ opacity: 0, transform: `translate(${side === 'r' ? -10 : side === 'l' ? 10 : 0}px,${side === 'b' ? -8 : side === 't' ? 8 : 0}px) scale(.96)` }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
  let floatHost = null;
  function place(card, anchor) {
    const cr = cockpitEl.getBoundingClientRect(), sr = $('.screens').getBoundingClientRect();
    const top0 = sr.top - cr.top, bot0 = sr.bottom - cr.top;
    card.style.maxHeight = `${Math.max(160, bot0 - top0)}px`;
    const ar = anchor ? anchor.getBoundingClientRect() : { left: cr.left + cr.width / 2, right: cr.left + cr.width / 2, top: cr.top + cr.height / 2, bottom: cr.top + cr.height / 2, width: 0, height: 0 };
    // 成排锚点：先按容器外侧可用宽度收窄浮窗（不低于 280px），钉住的完整卡也能放在外侧
    const host = anchor?.closest('[data-float]'), hr = host?.getBoundingClientRect(); floatHost = host || null; card.style.width = '';
    const hl = hr ? hr.left - cr.left : 0, hrt = hr ? hr.right - cr.left : 0, room = Math.floor(host?.dataset.float === 'l' ? hl : host?.dataset.float === 'r' ? cr.width - hrt : Math.max(cr.width - hrt, hl)) - 28;
    if (host && room >= 280 && card.offsetWidth > room) card.style.width = `${room}px`;
    const w = card.offsetWidth, h = card.offsetHeight, gap = 16, pad = 8;
    const a = { l: ar.left - cr.left, r: ar.right - cr.left, t: ar.top - cr.top, b: ar.bottom - cr.top };
    let x, y, side;
    // 成排锚点（data-float 容器，如魂环网格）：浮窗整个放到容器外侧，任何一个锚点都不被遮住；两侧都放不下才退到 t / b 偏好
    const pref = host?.dataset.float;
    const fitT = a.t - top0 >= h + gap, fitB = bot0 - a.b >= h + gap;
    const vside = pref === 't' ? (fitT ? 't' : fitB ? 'b' : '') : pref === 'b' ? (fitB ? 'b' : fitT ? 't' : '') : '';
    const fitR = host && cr.width - hrt >= w + gap + pad, fitL = host && hl >= w + gap + pad;
    if (pref === 'l' && fitL) { x = hl - gap - w; side = 'l'; }
    else if (fitR) { x = hrt + gap; side = 'r'; }
    else if (fitL) { x = hl - gap - w; side = 'l'; }
    else if (vside) { side = vside; x = Math.min(Math.max(pad, (a.l + a.r) / 2 - w / 2), cr.width - w - pad); }
    else if (cr.width - a.r >= w + gap + pad) { x = a.r + gap; side = 'r'; }
    else if (a.l >= w + gap + pad) { x = a.l - gap - w; side = 'l'; }
    else { x = Math.min(Math.max(pad, (a.l + a.r) / 2 - w / 2), cr.width - w - pad); side = a.t > cr.height / 2 ? 't' : 'b'; }
    if (side === 'r' || side === 'l') y = Math.min(Math.max(top0, (a.t + a.b) / 2 - h / 2), bot0 - h);
    else y = side === 'b' ? Math.min(a.b + gap, bot0 - h) : Math.max(top0, a.t - gap - h);
    y = Math.max(top0, y);
    card.style.left = x + 'px'; card.style.top = y + 'px';
    // 成排锚点放在外侧时，连线从容器边缘出发，不横穿同排其他锚点
    const ax = side === 'r' ? (host ? hrt : a.r) : side === 'l' ? (host ? hl : a.l) : (a.l + a.r) / 2, ay =side === 't' ? a.t : side === 'b' ? a.b : (a.t + a.b) / 2;
    const ex = side === 'r' ? x : side === 'l' ? x + w : ax, ey = side === 't' ? y + h : side === 'b' ? y : Math.min(Math.max(ay, y + 18), y + h - 18);
    $('.float-link path', layer).setAttribute('d', `M${ax} ${ay} L${ex} ${ey}`);
    const dot = $('.float-link circle', layer); dot.setAttribute('cx', ax); dot.setAttribute('cy', ay);
    return side;
  }
  // mode：hover（鼠标悬停预览）/ click（点击：桌面端钉住浮窗，触屏端原位展开或收起）
  let pinned = false;
  function openInspector(kind, id, anchor, mode = 'click') {
    const { page } = currentView();
    if (!page.inspect) return;
    const same = state.inspect && state.inspect.kind === kind && state.inspect.id === id && floatOpen();
    if (same && (mode === 'hover' || mode === 'scan')) return;
    if (same && mode === 'click' && !(hoverable() && !pinned)) return closeInspector();
    const html = page.inspect(ctx(), kind, id, mode === 'click' ? 'full' : 'hover');
    if (!html) return;
    const swap = mode === 'scan' && floatOpen() && !pinned && anchor?.closest('[data-float]') === floatHost;
    state.inspect = { kind, id }; pinned = mode === 'click' && hoverable(); layer.classList.toggle('pinned', pinned);
    $$('[data-inspect]').forEach(el => { const on = el.dataset.inspect === `${kind}:${id}`; el.classList.toggle('on', on); ringSlotOf(el)?.classList.toggle('mvu-hover-floating-active', on); });
    project(html, anchor, swap);
  }
  // 浮窗打开时给对应魂环挂引擎激活态（.mvu-hover-floating-active），魂环舞台随之保持塔形
  function ringSlotOf(el) { return el.matches('.mvu-soul-ring-slot') ? el : el.querySelector('.mvu-soul-ring-slot'); }
  function closeInspector() {
    if (!floatOpen()) return;
    pinned = false; layer.classList.remove('pinned');
    state.inspect = null; $$('[data-inspect].on').forEach(el => { el.classList.remove('on'); ringSlotOf(el)?.classList.remove('mvu-hover-floating-active'); });
    const card = $('.fcard', layer);
    // 淡出后清除；超时兜底只清这一张（期间若已打开新浮窗，旧卡已脱离文档，不会误清）
    if (card && !reduce) { const kill = () => { if (card.isConnected) clearFloat(); }; card.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: 'ease-in' }).onfinish = kill; setTimeout(kill, 220); }
    else clearFloat();
    requestAnimationFrame(fitCarousel);
  }
  addEventListener('keydown', e => { if (e.key === 'Escape' && floatOpen()) closeInspector(); });
  // 悬停浮窗：鼠标停在条目上约 0.15 秒浮出；移开（且没有移进浮窗）约 0.25 秒后收起；钉住后只在点外部 / Esc 时收起
  const hoverable = () => matchMedia('(hover: hover) and (pointer: fine)').matches && !isMobile();
  let openTimer = 0, closeTimer = 0;
  // 设置页的交互偏好（悬停快慢 / 魂环扫描开关），每次读取，改完立即生效
  const pref = k => { try { return JSON.parse(localStorage.getItem('lwcs-cockpit-settings') || '{}')[k]; } catch (e) { return undefined; } };
  const hoverMs = () => ({ 快: 80, 标准: 150, 慢: 320 }[pref('hover')] || 150);
  cockpitEl.addEventListener('pointerover', e => {
    // 拖着沙盘时不弹浮窗（经过的地标太多）
    if (!hoverable() || e.pointerType !== 'mouse' || editing || e.target.closest('.grabbing')) return;
    const item = e.target.closest('[data-inspect]'), inCard = e.target.closest('.fcard');
    if (!inCard && pref('scan') !== '关闭' && e.target.closest('[data-scan]')) { clearTimeout(closeTimer); return; }
    if (item && !inCard) {
      clearTimeout(closeTimer); clearTimeout(openTimer);
      if (pinned && state.inspect && item.dataset.inspect !== `${state.inspect.kind}:${state.inspect.id}`) return;
      // 条目可用 data-hover-delay 放慢（沙盘地标密，扫过时不该频频弹出）
      openTimer = setTimeout(() => { const [kind, ...rest] = item.dataset.inspect.split(':'); openInspector(kind, rest.join(':'), item, 'hover'); }, Number(item.dataset.hoverDelay) || hoverMs());
      return;
    }
    clearTimeout(openTimer);
    if (inCard) { clearTimeout(closeTimer); return; }
    if (floatOpen() && !pinned) { clearTimeout(closeTimer); closeTimer = setTimeout(closeInspector, 250); }
  });
  // 魂环扫描：魂环的命中带是细窄的环线（成塔后只剩几像素高），直接悬停很难瞄准。
  // 声明 data-scan 的容器（武魂卡）整片都是扫描区：取离鼠标最近的一圈。首次打开约 0.09 秒防误触，之后切换即时、浮窗复用不闪。
  const nearestRing = (host, x, y) => {
    const tower = host.matches(':hover,:focus-within') || !!host.querySelector('.mvu-hover-floating-active');
    let best = null, bd = Infinity;
    for (const el of host.querySelectorAll('[data-inspect]')) {
      const r = (el.querySelector('svg') || el).getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const d = tower ? Math.abs(y - cy) : Math.abs(Math.hypot(x - cx, y - cy) - r.width * .33);
      if (d < bd) { bd = d; best = el; }
    }
    return best;
  };
  // 按时间节流（约 30ms 一次，末次移动必处理），不依赖绘帧：窗口在后台时 rAF 会暂停
  let scanAt = 0, scanTimer = 0, scanEv = null;
  const scanPick = () => {
    scanAt = performance.now(); scanTimer = 0;
    const { host, x, y } = scanEv, el = nearestRing(host, x, y); if (!el || pinned) return;
    const [kind, ...rest] = el.dataset.inspect.split(':'), id = rest.join(':');
    if (floatOpen() && state.inspect?.kind === kind && state.inspect?.id === id) return;
    clearTimeout(openTimer);
    if (floatOpen()) openInspector(kind, id, el, 'scan');
    else openTimer = setTimeout(() => openInspector(kind, id, el, 'scan'), 90);
  };
  cockpitEl.addEventListener('pointermove', e => {
    if (!hoverable() || e.pointerType !== 'mouse' || pinned || editing || pref('scan') === '关闭') return;
    const host = e.target.closest('[data-scan]');
    if (!host || e.target.closest('.fcard')) return;
    clearTimeout(closeTimer); scanEv = { host, x: e.clientX, y: e.clientY };
    const dt = performance.now() - scanAt;
    if (dt >= 30) scanPick(); else if (!scanTimer) scanTimer = setTimeout(scanPick, 30 - dt);
  });
  cockpitEl.addEventListener('pointerleave', () => { clearTimeout(openTimer); if (floatOpen() && !pinned) closeTimer = setTimeout(closeInspector, 250); });
  // 点浮窗与条目以外的地方、或屏内滚动时收起（浮窗锚点会移动）
  addEventListener('pointerdown', e => { if (floatOpen() && !e.target.closest('.fcard,.inline-detail,[data-inspect],[data-scan],.picker-list,.ie-floatbox')) closeInspector(); });
  cockpitEl.addEventListener('scroll', e => { if (layer.firstChild && !e.target.closest?.('.fcard')) closeInspector(); }, true);

  let editing = null;
  // 编辑结束后若桥接在编辑期间送来过新数据，补一次重绘
  const flushPending = () => { if (api.pending && !editing) { api.pending = false; renderPage({ kind: 'refresh' }); syncReadout(); } };
  const parseEdit = (kind, meta, str) => {
    const t = String(str).trim();
    if (kind === 'number') {
      if (t === '' || !Number.isFinite(Number(t))) return { err: '请输入数字' };
      const n = Number(t);
      if (meta.integer && !Number.isInteger(n)) return { err: '需为整数' };
      if (meta.min != null && n < meta.min) return { err: `不能小于 ${meta.min}` };
      if (meta.max != null && n > meta.max) return { err: `不能大于 ${meta.max}` };
      return { value: n };
    }
    if (kind === 'enum') return (meta.options || []).includes(t) ? { value: t } : { err: '只能从选项中选择' };
    return { value: kind === 'text' ? String(str) : t };
  };
  function beginEdit(el) {
    if (editing) commitEdit();
    const kind = el.dataset.ieKind, meta = JSON.parse(el.dataset.ieMeta || '{}'), raw = el.dataset.ieRaw;
    if (kind === 'enum' && !(meta.options || []).includes(raw)) meta.options = [raw, ...(meta.options || [])];
    const path = JSON.parse(el.dataset.iePath), inFloat = !!el.closest('.fcard');
    const wrap = document.createElement('span');
    // 单行编辑（数字 / 文字 / 枚举）浮在原值正上方：原位留一个同尺寸的占位，编辑器挂到页面最外层按原值的屏幕位置摆放——
    // 不挤开旁边的内容（「9 岁」这类小字段原先会被输入框撑开、压到旁边的资源条），也不会被带切角的外框裁掉。多行文本仍原地展开
    const keep = kind === 'text' ? null : el.getBoundingClientRect(), fs0 = Math.max(14, parseFloat(getComputedStyle(el).fontSize) || 14) + 'px';
    let box = null;
    const floatIt = () => {
      if (!keep) return;
      wrap.classList.add('float'); wrap.style.width = keep.width + 'px'; wrap.style.height = keep.height + 'px';
      box = document.createElement('div'); box.className = 'ie-floatbox'; box.style.fontSize = fs0;
      box.append(...wrap.childNodes); OVERLAY.append(box); placeBox(wrap, box);
    };
    // 枚举：原地换成座舱选择控件并展开；选中即提交，未选就收起则取消（closePick 里处理）
    if (kind === 'enum') {
      wrap.className = 'ie-edit ie-pick'; wrap.innerHTML = pick('__ie', raw, meta.options || []);
      el.replaceWith(wrap); floatIt();
      const host = (box || wrap).firstElementChild, val = { value: raw, focus: () => $('.picker-btn', host)?.focus() };
      editing = { el, wrap, box, input: val, kind, meta, path, inFloat, pickHost: host };
      host.addEventListener('picker:change', e => { e.stopPropagation(); val.value = e.detail.value; commitEdit(); });
      openPick(host);
      return;
    }
    let input;
    if (kind === 'text') { input = document.createElement('textarea'); input.rows = 4; input.value = raw; }
    else { input = document.createElement('input'); input.type = kind === 'number' ? 'number' : 'text'; input.value = raw; if (kind === 'number') { if (meta.min != null) input.min = meta.min; if (meta.max != null) input.max = meta.max; input.step = meta.integer ? '1' : 'any'; } }
    input.className = 'ie-input';
    wrap.className = 'ie-edit' + (kind === 'text' ? ' multi' : kind === 'number' ? ' num' : '');
    // 操作提示（范围 / 回车提交 / Esc 取消）走悬停说明，不在版面上放字
    input.dataset.hint = [kind !== 'number' ? '' : meta.min != null && meta.max != null ? `范围 ${meta.min} ~ ${meta.max}` : meta.min != null ? `最小 ${meta.min}` : meta.max != null ? `最大 ${meta.max}` : '', kind === 'text' ? 'Ctrl+回车提交' : '回车提交', 'Esc 取消'].filter(Boolean).join(' · ');
    if (kind === 'number') {
      // 数字：两侧步进键；按下时不抢焦点，避免输入框失焦提前提交
      const step = d => { const st = meta.integer || !String(input.value).includes('.') ? 1 : 0.1, n = (Number(input.value) || 0) + d * st; input.value = String(Number(Math.min(meta.max ?? Infinity, Math.max(meta.min ?? -Infinity, n)).toFixed(4))); };
      const mk = d => { const b = document.createElement('button'); b.type = 'button'; b.className = 'ie-step'; b.tabIndex = -1; b.setAttribute('aria-label', d < 0 ? '减少' : '增加'); b.innerHTML = `<i class="fa-solid fa-${d < 0 ? 'minus' : 'plus'}"></i>`; b.addEventListener('pointerdown', e => e.preventDefault()); b.addEventListener('click', e => { e.stopPropagation(); step(d); }); return b; };
      const row = document.createElement('span'); row.className = 'ie-numrow'; row.append(mk(-1), input, mk(1)); wrap.append(row);
    } else wrap.append(input);
    el.replaceWith(wrap); floatIt();
    // 输入框按内容定宽：数字按位数，单行文字按字数（中文约 1em 一字）
    const fit = () => { if (kind === 'text') return; const n = String(input.value || '').length; input.style.width = kind === 'number' ? `${Math.max(2, n) + 1.4}ch` : `${Math.max(4, Math.min(22, n * 1.05 + 1.6))}em`; };
    fit(); input.addEventListener('input', fit);
    editing = { el, wrap, box, input, kind, meta, path, inFloat };
    input.focus(); if (input.select) input.select();
    input.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
      else if (e.key === 'Enter' && (kind !== 'text' || e.ctrlKey || e.metaKey)) { e.preventDefault(); commitEdit(); }
    });
    input.addEventListener('blur', () => setTimeout(() => { if (editing && editing.input === input) commitEdit(); }, 0));
  }
  function commitEdit() {
    const cur = editing; if (!cur) return;
    const r = parseEdit(cur.kind, cur.meta, cur.input.value);
    const host = cur.box || cur.wrap;
    if (r.err) { let tip = host.querySelector('.ie-err'); if (!tip) { tip = document.createElement('small'); tip.className = 'ie-err'; host.append(tip); } tip.textContent = r.err; cur.input.focus(); return; }
    // 改键名（如伤势部位）：path 指向条目本身，值是新键名——写到同级新键并删掉旧键，同名已存在则不改
    if (cur.meta.renameKey) {
      const name = String(r.value).trim(), parent = cur.path.slice(0, -1), old = cur.path.at(-1);
      if (name && name !== old && getAt([...parent, name]) !== undefined) { let tip = host.querySelector('.ie-err'); if (!tip) { tip = document.createElement('small'); tip.className = 'ie-err'; host.append(tip); } tip.textContent = '已有同名条目'; cur.input.focus(); return; }
      editing = null; cur.box?.remove();
      if (!name || name === old) { cur.wrap.replaceWith(cur.el); flushPending(); return; }
      cur.el.textContent = name; cur.wrap.replaceWith(cur.el);
      write([{ path: [...parent, name], value: getAt(cur.path) }, { path: cur.path, del: true }]).then(() => { flushPending(); if (cur.inFloat) reproject(); });
      return;
    }
    editing = null; cur.box?.remove();
    if (r.value === getAt(cur.path)) { cur.wrap.replaceWith(cur.el); flushPending(); return; }
    // 先在界面上落下新值（原值处显示），写回完成后由桥接回灌刷新
    cur.el.textContent = String(r.value); cur.wrap.replaceWith(cur.el);
    const ev = new CustomEvent('cockpit:edited', { detail: { path: cur.path, value: r.value, extra: [] } }); document.dispatchEvent(ev);
    write([{ path: cur.path, value: r.value }, ...ev.detail.extra]).then(() => { flushPending(); if (cur.inFloat) reproject(); });
  }
  function cancelEdit() { const cur = editing; editing = null; if (cur) { cur.box?.remove(); cur.wrap.replaceWith(cur.el); } flushPending(); }
  // 浮动编辑器跟住占位：面板滚动时重新摆放
  const placeBox = (wrap, box) => { const r = wrap.getBoundingClientRect(); box.style.left = r.left + r.width / 2 + 'px'; box.style.top = r.top + r.height / 2 + 'px'; };
  addEventListener('scroll', () => { if (editing?.box) placeBox(editing.wrap, editing.box); }, true);
  // ---------- 悬停说明层 ----------
  const tip = document.createElement('div'); tip.className = 'hint-tip'; tip.setAttribute('role', 'tooltip'); OVERLAY.append(tip);
  let tipFor = null, tipTimer = 0;
  const showTip = el => {
    const text = el?.dataset.hint; if (!text) return;
    tipFor = el; tip.textContent = text; tip.className = 'hint-tip';
    tip.style.maxWidth = Math.min(300, innerWidth - 24) + 'px'; tip.style.left = '0px'; tip.style.top = '0px';
    const r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight, side = el.dataset.hintSide;
    let x, y, cls = 'top';
    if (side === 'r' && r.right + 10 + tw <= innerWidth - 8) { x = r.right + 10; y = r.top + r.height / 2 - th / 2; cls = 'right'; }
    else if (side === 'r' && r.left - 10 - tw >= 8) { x = r.left - 10 - tw; y = r.top + r.height / 2 - th / 2; cls = 'left'; }
    else { x = r.left + r.width / 2 - tw / 2; y = r.top - th - 9; if (y < 8) { y = r.bottom + 9; cls = 'bottom'; } }
    tip.style.left = Math.max(8, Math.min(innerWidth - tw - 8, x)) + 'px'; tip.style.top = Math.max(8, Math.min(innerHeight - th - 8, y)) + 'px';
    tip.classList.add(cls, 'on');
  };
  const hideTip = () => { clearTimeout(tipTimer); tipFor = null; tip.classList.remove('on'); };
  document.addEventListener('pointerover', e => {
    if (e.pointerType === 'touch') return;
    const el = e.target.closest?.('[data-hint]'); if (el === tipFor) return;
    clearTimeout(tipTimer); if (!el) { if (tipFor) hideTip(); return; }
    tipTimer = setTimeout(() => showTip(el), tipFor ? 60 : 220);
  });
  document.addEventListener('focusin', e => { const el = e.target.closest?.('[data-hint]'); if (el && e.target.matches(':focus-visible')) showTip(el); });
  document.addEventListener('focusout', () => { if (tipFor) hideTip(); });
  document.addEventListener('click', e => {
    const h = e.target.closest('.hint');
    if (h) { e.preventDefault(); e.stopPropagation(); tipFor === h && tip.classList.contains('on') ? hideTip() : showTip(h); return; }
    if (tipFor) hideTip();
  }, true);
  addEventListener('scroll', () => { if (tipFor && !pickOpen) hideTip(); }, true);

  // ---------- 选择控件：展开 / 选择 / 键盘 ----------
  let pickOpen = null;
  const closePick = () => {
    if (!pickOpen) return; const h = pickOpen.host;
    pickOpen.list.remove(); pickOpen.btn.setAttribute('aria-expanded', 'false'); h.classList.remove('open'); pickOpen = null; hideTip();
    // 内联编辑的枚举选择：收起时若没有选出新值（choosePick 会同步提交），就取消编辑、还原成原值
    if (editing?.pickHost === h) setTimeout(() => { if (editing?.pickHost === h) cancelEdit(); }, 0);
  };
  const openPick = host => {
    closePick();
    const btn = $('.picker-btn', host), opts = JSON.parse(host.dataset.pickerOpts || '[]'), val = host.dataset.pickerValue;
    const list = document.createElement('div'); list.className = 'picker-list'; list.setAttribute('role', 'listbox');
    let g = null, html = '';
    for (const x of opts) {
      if (x.group && x.group !== g) { g = x.group; html += `<div class="picker-group">${esc(g)}</div>`; }
      html += `<button type="button" role="option" class="picker-opt${x.value === val ? ' on' : ''}" aria-selected="${x.value === val}" data-v="${esc(x.value)}"${x.hint ? ` data-hint="${esc(x.hint)}" data-hint-side="r"` : ''}><span>${esc(x.label)}</span>${x.hint ? '<i class="fa-solid fa-circle-info"></i>' : ''}</button>`;
    }
    list.innerHTML = html; OVERLAY.append(list);
    const r = btn.getBoundingClientRect();
    list.style.minWidth = Math.max(r.width, 150) + 'px';
    const room = innerHeight - r.bottom - 12, need = Math.min(list.scrollHeight, 340), below = room >= Math.min(need, 220) || r.top < need;
    list.style.maxHeight = Math.min(340, below ? room : r.top - 12) + 'px';
    list.style.left = Math.max(8, Math.min(innerWidth - list.offsetWidth - 8, r.left)) + 'px';
    list.style.top = (below ? r.bottom + 4 : r.top - list.offsetHeight - 4) + 'px';
    btn.setAttribute('aria-expanded', 'true'); host.classList.add('open');
    pickOpen = { host, btn, list };
    const on = $('.picker-opt.on', list) || $('.picker-opt', list); on?.focus({ preventScroll: true }); on?.scrollIntoView({ block: 'nearest' });
  };
  const choosePick = v => {
    const { host, btn } = pickOpen; closePick(); btn.focus({ preventScroll: true });
    if (v === host.dataset.pickerValue) return;
    const o = JSON.parse(host.dataset.pickerOpts || '[]').find(x => x.value === v);
    host.dataset.pickerValue = v; $('span', btn).textContent = o ? o.label : v;
    if (o?.hint) btn.dataset.hint = o.hint; else delete btn.dataset.hint;
    host.dispatchEvent(new CustomEvent('picker:change', { bubbles: true, detail: { path: host.dataset.picker, value: v } }));
  };
  document.addEventListener('click', e => {
    const opt = e.target.closest('.picker-opt'); if (opt && pickOpen) return choosePick(opt.dataset.v);
    const btn = e.target.closest('.picker-btn'); if (btn) { const host = btn.closest('.picker'); return pickOpen?.host === host ? closePick() : openPick(host); }
    if (pickOpen && !e.target.closest('.picker-list')) closePick();
  });
  document.addEventListener('keydown', e => {
    if (!pickOpen) { if (e.key === 'ArrowDown' && e.target.classList?.contains('picker-btn')) { e.preventDefault(); openPick(e.target.closest('.picker')); } return; }
    const opts = $$('.picker-opt', pickOpen.list), i = opts.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); const b = pickOpen.btn; closePick(); b.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); opts[Math.min(opts.length - 1, i + 1)]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); opts[Math.max(0, i - 1)]?.focus(); }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); opts[e.key === 'Home' ? 0 : opts.length - 1]?.focus(); }
    else if (e.key === 'Tab') closePick();
  });
  addEventListener('scroll', e => { if (pickOpen && !pickOpen.list.contains(e.target)) closePick(); }, true);
  addEventListener('resize', () => closePick());

  // 确认条 / 结果条：插在触发按钮旁（翼底主按钮插在上方，免得落到面板外被裁掉）
  const stripAt = (t, html, cls = '') => {
    const inPad = t.parentElement.matches('.pad'), host = inPad ? t : t.parentElement;
    (inPad ? t.parentElement : host.parentElement).querySelector('.confirm-strip')?.remove();
    host.insertAdjacentHTML(inPad ? 'beforebegin' : 'afterend', `<div class="confirm-strip ${cls}">${html}</div>`);
    return inPad ? host.previousElementSibling : host.nextElementSibling;
  };
  // 执行动作：确认条里显示执行中 → 结果（成功文本 / 失败原因）；没有确认条的直接执行，失败时在按钮旁给原因
  const runAct = async (spec, strip, from) => {
    if (strip) { strip.className = 'confirm-strip busy'; strip.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>执行中…</span>'; }
    if (from) from.disabled = true;
    const r = await C.act(spec.name, spec);
    if (from) from.disabled = false;
    const ok = !!r?.ok, msg = r?.message || (ok ? '' : '执行失败');
    if (strip?.isConnected) { if (!msg && ok) strip.remove(); else { strip.className = `confirm-strip ${ok ? 'done' : 'fail'}`; strip.innerHTML = `<i class="fa-solid fa-${ok ? 'circle-check' : 'triangle-exclamation'}"></i><span>${esc(msg)}</span>${ok ? '' : '<button class="key-s" type="button" data-confirm-no>知道了</button>'}`; } }
    else if (!ok && from?.isConnected) stripAt(from, `<i class="fa-solid fa-triangle-exclamation"></i><span>${esc(msg)}</span><button class="key-s" type="button" data-confirm-no>知道了</button>`, 'fail');
    return r;
  };
  // 编辑浮窗里的字段后：用新数据重绘浮窗内容，保持钉住与锚点
  function reproject() {
    if (!state.inspect || !floatOpen()) return;
    const { kind, id } = state.inspect, { page } = currentView();
    const html = page.inspect?.(ctx(), kind, id, pinned ? 'full' : 'hover'); if (!html) return closeInspector();
    const anchor = $$('[data-inspect]').find(el => el.dataset.inspect === `${kind}:${id}`), card = $('.fcard', layer);
    if (anchor) { anchor.classList.add('on'); ringSlotOf(anchor)?.classList.add('mvu-hover-floating-active'); }
    if (card) { $('.holo-in', card).innerHTML = html; if (anchor) place(card, anchor); }
  }
  cockpitEl.addEventListener('keydown', e => { const el = e.target.closest?.('.ie'); if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); beginEdit(el); } });

  // ---------- 事件委托 ----------
  track.addEventListener('click', e => { const t = e.target.closest('.tab'); if (t) switchDomain(t.dataset.tab); });
  $('.cockpit').addEventListener('click', e => { const r = e.target.closest('[data-route]'); if (r) C.route({ to: r.dataset.route }); });
  $('#ck-keys').addEventListener('click', e => { const k = e.target.closest('.key'); if (k) switchPage(k.dataset.page); });
  // 滚轮归屏：桌面三屏里指针在哪块屏就只滚那块屏。落在屏框 / 屏内不可滚的地方也滚这块屏的内容；
  // 屏里内容滚到头时吞掉这次滚轮，不再串到酒馆聊天区。只有整块屏根本没有可滚内容才放行（让聊天区照常滚）
  const scrollable = el => el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY);
  screens.addEventListener('wheel', e => {
    if (e.defaultPrevented || e.ctrlKey || isMobile()) return;
    const panel = e.target.closest('.wing,.center'); if (!panel) return;
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? panel.clientHeight : 1); if (!dy) return;
    const room = el => dy > 0 ? el.scrollHeight - el.clientHeight - el.scrollTop > 1 : el.scrollTop > 0;
    for (let el = e.target; el && el !== panel; el = el.parentElement) if (scrollable(el) && room(el)) return;
    const main = $$('.face:not(.leaving) :is(.pad,.scroll,.list,.q-list,.dz-body,.set-tiles,.dz2-skills)', panel).find(scrollable);
    if (!main) return;
    e.preventDefault();
    if (!main.contains(e.target) && room(main)) main.scrollTop += dy;
  }, { passive: false });
  $('.cockpit').addEventListener('click', e => {
    if (e.target.closest('.ie-edit')) return;
    const ieEl = e.target.closest('.ie'); if (ieEl) { e.stopPropagation(); return beginEdit(ieEl); }
    const scanHost = !e.target.closest('.fcard,.inline-detail,[data-go]') && e.target.closest('[data-scan]');
    if (scanHost) {
      const el = (state.inspect && scanHost.querySelector('[data-inspect].on')) || nearestRing(scanHost, e.clientX, e.clientY);
      if (el) { const [kind, ...rest] = el.dataset.inspect.split(':'); return openInspector(kind, rest.join(':'), el); }
    }
    const t = e.target.closest('[data-confirm],[data-confirm-go],[data-confirm-no],[data-del-path],[data-inspect],[data-go],[data-view-char],[data-close-inspector],[data-pick],[data-set],[data-clamp],[data-dur],[data-act]');
    if (!t) return;
    // 改变状态的操作先确认：展开「将要…」条，写明要做什么，再点「确认」才执行
    if (t.dataset.confirmNo !== undefined) { t.closest('.confirm-strip')?.remove(); return; }
    if (t.dataset.confirmGo !== undefined) {
      const strip = t.closest('.confirm-strip'), spec = strip._act;
      if (!spec) { strip.innerHTML = `<i class="fa-solid fa-circle-info"></i><span>${ADP ? '这个操作暂未接通' : '已提交，等待叙事结算'}</span>`; strip.classList.add('done'); return; }
      runAct(spec, strip); return;
    }
    // 不能执行：直接给出原因，不出确认
    if (t.dataset.blocked) { stripAt(t, `<i class="fa-solid fa-ban"></i><span>${esc(t.dataset.blocked)}</span><button class="key-s" type="button" data-confirm-no>知道了</button>`, 'fail'); return; }
    if (t.dataset.confirm) {
      // 按钮直接放在面板里（翼底主按钮）时确认条插在按钮上方，否则插在按钮所在行后面——不能落到面板外被裁掉
      const inPad = t.parentElement.matches('.pad'), host = inPad ? t : t.parentElement;
      (inPad ? t.parentElement : host.parentElement).querySelector('.confirm-strip')?.remove();
      host.insertAdjacentHTML(inPad ? 'beforebegin' : 'afterend', `<div class="confirm-strip"><i class="fa-solid fa-circle-question"></i><span>将要：${esc(t.dataset.confirm)}</span><button class="key-s" type="button" data-confirm-go>确认</button><button class="key-s" type="button" data-confirm-no>取消</button></div>`);
      const strip = inPad ? host.previousElementSibling : host.nextElementSibling;
      if (strip && t.dataset.act) { try { strip._act = JSON.parse(t.dataset.act); } catch (err) {} }
      return;
    }
    // 不需要确认的动作（打开原项目工坊、魂环待选、返回战斗）直接执行
    if (t.dataset.act) { let spec = null; try { spec = JSON.parse(t.dataset.act); } catch (err) {} if (spec) runAct(spec, null, t); return; }
    // 危险操作原地二次确认：第一次点亮为「再点一次确认删除」，3 秒内再点才执行
    if (t.dataset.delPath) {
      if (!t.classList.contains('armed')) {
        t.classList.add('armed'); t.dataset.label = t.innerHTML; t.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> 再点一次确认删除';
        clearTimeout(t._disarm); t._disarm = setTimeout(() => { t.classList.remove('armed'); t.innerHTML = t.dataset.label; }, 3000); return;
      }
      if (t.closest('.fcard')) closeInspector();
      write([{ path: JSON.parse(t.dataset.delPath), del: true }]); return;
    }
    if (t.dataset.closeInspector !== undefined) return closeInspector();
    if (t.dataset.clamp !== undefined) return t.classList.toggle('clamp');
    if (t.dataset.inspect) { const [kind, ...rest] = t.dataset.inspect.split(':'); return openInspector(kind, rest.join(':'), t); }
    if (t.closest(".fcard,.inline-detail") && t.dataset.pick === undefined) closeInspector();
    if (t.dataset.setDest) state.ui.dest = t.dataset.setDest;
    if (t.dataset.go && t.dataset.goSet) for (const kv of t.dataset.goSet.split(';')) { const [k, v] = kv.split('='); state.ui[k] = v; }
    if (t.dataset.go) { const [dom, pg] = t.dataset.go.split('/'); return dom === state.domain ? switchPage(pg) : switchDomain(dom, pg); }
    if (t.dataset.viewChar) return C.view(t.dataset.viewChar);
    if (t.dataset.set) {
      const [key, value] = t.dataset.set.split('='); state.ui[key] = value; state.inspect = null; clearFloat(); renderPage({ kind: 'refresh' });
      // 手机端：在左翼列表里点选后转到主屏看详情；主屏里的选择（星图 / 竖牌）可用 data-face-after 指定转去哪一面
      if (isMobile()) {
        const f = t.dataset.faceAfter !== undefined ? Number(t.dataset.faceAfter) : t.closest('.wing.l') && t.matches('.row, .hpt, .tz') ? 0 : null;
        if (f !== null && f !== state.face) setFace(f);
      }
      return;
    }
    if (t.dataset.dur) {
      const box = t.closest('[data-dur-box]'), out = box.querySelector('output');
      const m = Math.max(10, Math.min(1440, num(out.dataset.min) + num(t.dataset.dur)));
      out.dataset.min = m; out.textContent = `${m} 分钟`;
      const end = box.querySelector('[data-dur-end]'); if (end && C.endAt) end.textContent = C.endAt(ctx(), m);
      return;
    }
    if (t.dataset.pick !== undefined) { const group = t.closest('[data-pick-group]'); $$('[data-pick]', group || t.parentElement).forEach(b => { b.classList.toggle('on', b === t); b.setAttribute('aria-pressed', b === t); }); }
  });
  $('.cockpit').addEventListener('change', e => {
    const f = e.target.closest('.ava-file'); if (!f || !f.files[0]) return;
    const r = new FileReader(); r.onload = async () => { if (ADP?.saveAvatar) await ADP.saveAvatar(f.dataset.name, r.result); else { try { localStorage.setItem(AVATAR_KEY + f.dataset.name, r.result); } catch (err) {} } C.refresh(); }; r.readAsDataURL(f.files[0]);
  });

  // ---------- 手机：滑动绕球心转向 ----------
  const dots = $('.dots');
  dots.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setFace(Number(b.dataset.face)); });
  let drag = null;
  screens.addEventListener('pointerdown', e => { if (!isMobile() || e.target.closest('button,input,select,textarea,a,label')) return; drag = { x: e.clientX, y: e.clientY, base: -state.face * 60, moved: false }; });
  addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 8) return;
    if (!drag.moved && Math.abs(e.clientY - drag.y) > Math.abs(dx)) { drag = null; return; }
    drag.moved = true; screens.classList.add('dragging');
    const turn = Math.max(-75, Math.min(75, drag.base + dx / screens.clientWidth * 70));
    screens.style.setProperty('--turn', `${turn}deg`);
  });
  addEventListener('pointerup', e => {
    if (!drag) return;
    screens.classList.remove('dragging');
    if (drag.moved) { const turn = parseFloat(screens.style.getPropertyValue('--turn')) || 0; setFace(Math.max(-1, Math.min(1, Math.round(-turn / 60)))); }
    drag = null;
  });

  // ---------- 惯性视差 ----------
  const cockpit = $('.cockpit'), stage = $('.stage'), arc = $('.arc'), deck = $('.deck');
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
  // 台面后推深度由样式表决定（原型页 -120px，嵌入宽屏 0）；重排时读一次，动画帧里不读样式
  let stageZ = '-120px';
  const readStageZ = () => { stageZ = getComputedStyle(stage).getPropertyValue('--stage-z').trim() || '0px'; };
  const loop = () => {
    cx += (tx - cx) * .07; cy += (ty - cy) * .07;
    if (!isMobile()) {
      stage.style.transform = `translateZ(${stageZ}) rotateX(${(-cy * 2.6).toFixed(3)}deg) rotateY(${(cx * 3.6).toFixed(3)}deg)`;
      arc.style.translate = `${(-cx * 10).toFixed(2)}px ${(-cy * 4).toFixed(2)}px`;
      deck.style.translate = `${(cx * 8).toFixed(2)}px ${(cy * 3).toFixed(2)}px`;
    }
    raf = Math.abs(tx - cx) + Math.abs(ty - cy) > .001 ? requestAnimationFrame(loop) : 0;
  };
  const kick = () => { if (!raf && !reduce) raf = requestAnimationFrame(loop); };
  // 视差：指针在声明了 data-no-tilt 的区域（沙盘）里时回正，免得拖动、瞄准时整个场景跟着歪
  cockpit.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; if (e.target.closest('[data-no-tilt]')) { if (tx || ty) { tx = 0; ty = 0; kick(); } return; } const r = cockpit.getBoundingClientRect(); tx = (e.clientX - r.left) / r.width - .5; ty = (e.clientY - r.top) / r.height - .5; kick(); });
  cockpit.addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); });

  // ---------- 魂力光尘 ----------
  // 整幅画布每帧重画会让合成器整屏重绘，和切换动画抢 GPU：光点预渲染成两张贴图（不再每粒每帧新建径向渐变），
  // 并限到 30fps、按实际间隔推进（光尘漂得慢，30fps 看不出差别）
  const cv = $('.motes'), g2 = cv.getContext('2d');
  let W = 0, H = 0, motes = [], lastDraw = 0;
  // 光尘画布被样式关掉时（lwcs 嵌入）不分配画布、不跑动画循环
  const motesOn = () => getComputedStyle(cv).display !== 'none';
  const size = () => { W = cockpit.clientWidth; H = cockpit.clientHeight; if (!motesOn()) { cv.width = cv.height = 0; return; } const dpr = Math.min(2, devicePixelRatio || 1); cv.width = W * dpr; cv.height = H * dpr; g2.setTransform(dpr, 0, 0, dpr, 0, 0); };
  const spawn = y => ({ x: Math.random() * W, y: y ?? H + 10, r: .8 + Math.random() * 1.8, v: .15 + Math.random() * .35, a: .15 + Math.random() * .45, s: Math.random() * 6.28, gold: Math.random() < .3 });
  const sprite = rgb => {
    const c = document.createElement('canvas'), s = 64; c.width = c.height = s;
    const g = c.getContext('2d'), gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(0, 0, s, s);
    return c;
  };
  const SPRITE = { gold: sprite('255,214,120'), blue: sprite('140,200,255') };
  const draw = now => {
    requestAnimationFrame(draw);
    if (now - lastDraw < 33) return;
    const k = lastDraw ? Math.min(4, (now - lastDraw) / 16.7) : 1; lastDraw = now;
    g2.clearRect(0, 0, W, H);
    for (const m of motes) {
      m.y -= m.v * k; m.s += .012 * k; const x = m.x + Math.sin(m.s) * 8;
      if (m.y < -10) Object.assign(m, spawn());
      const d = m.r * 8; g2.globalAlpha = m.a; g2.drawImage(m.gold ? SPRITE.gold : SPRITE.blue, x - d / 2, m.y - d / 2, d, d);
    }
    g2.globalAlpha = 1;
  };

  // ---------- 读数条 ----------
  const syncReadout = () => {
    const me = S.char?.[S.sys?.玩家名] || {}, st = me.属性 || {};
    $('#ck-rLoc').textContent = String(me.状态?.位置 || '').replace(/^斗罗大陆-/, '').replace(/-/g, ' · ');
    // 时间：指挥栏里只放月日与时刻，完整历法放悬停
    const cal = S.world.时间._calendar || tickDate(S.world.时间.tick);
    $('#ck-rTime').textContent = String(cal).replace(/^(斗罗历|斗灵历)?\d+年/, ''); $('#ck-rTime').parentElement.title = cal;
    $('#ck-rTick').textContent = S.sys.系统播报 || '暂无播报'; $('.readout .tick').title = S.sys.系统播报 || ''; $('.readout .tick-ico').dataset.hint = S.sys.系统播报 || '暂无播报';
    // 待处理（原项目「待处理能力」）：待生成的魂环、待确认的新技能，点了直接去处理
    const pend = ADP?.pending?.() || {}, ring = pend.soulRing, sd = pend.skillDesign;
    $('#ck-rPend').innerHTML = [ring ? `<button class="pend" type="button" data-route="ringPick" title="${esc([ring.charName, ring.spiritName, `第 ${ring.ringIndex} 魂环`].filter(Boolean).join(' · '))}"><i class="fa-solid fa-circle-plus"></i>待生成魂环</button>` : '', sd ? `<button class="pend" type="button" data-route="skillConfirm" title="${esc([sd.charName, sd.skillName].filter(Boolean).join(' · '))}"><i class="fa-solid fa-wand-sparkles"></i>新技能待确认</button>` : ''].join('');
    const m = [['hp', st.HP, st.HP上限], ['sp', st.魂力, st.魂力上限], ['vp', st.体力, st.体力上限], ['mp', st.精神力, st.精神力上限]];
    $('#ck-rRes').innerHTML = m.map(([c, a, b]) => `<span class="mini ${c}" title="${a} / ${b}"><i style="width:${b > 0 ? Math.min(100, a / b * 100) : 0}%"></i></span>`).join('');
  };

  const start = () => {
    track.insertAdjacentHTML('beforeend', order.filter(id => domains[id]).map(id => `<button class="tab" type="button" data-tab="${id}" aria-label="${esc(domains[id].label)}" data-hint="${esc(domains[id].label)}"><i class="fa-solid fa-${domains[id].icon}"></i><span class="lb">${esc(domains[id].label)}</span></button>`).join(''));
    syncReadout();
    slider.style.transition = 'none';
    switchDomain(order[0], null, true);
    requestAnimationFrame(() => { slider.style.transition = ''; });
    addEventListener('resize', () => { moveSlider($('.tab.on', track)); size(); applyWide(currentView().v); fitCarousel(); });
    size(); motes = Array.from({ length: 42 }, () => spawn(Math.random() * H));
    if (!reduce && motesOn()) requestAnimationFrame(draw);
  };
  // 宿主尺寸变化（挂到新宿主、聊天栏宽度变化）后重排
  const relayout = () => { syncMobile(); readStageZ(); moveSlider($('.tab.on', track)); size(); if (state.domain) { applyWide(currentView().v); fitCarousel(); } };
  api = { refresh: () => { if (!state.domain) return; if (editing) { api.pending = true; return; } renderPage({ kind: 'refresh' }); }, switchDomain, switchPage, openInspector, closeInspector, reproject, syncReadout, start, relayout, isEditing: () => !!editing, pending: false };
  }
})();

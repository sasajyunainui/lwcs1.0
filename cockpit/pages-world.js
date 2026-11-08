/* 世界领域：概况 · 编年 · 势力 · 阵营 · 赛事 · 图鉴 */
(() => {
  const lib = () => window.COCKPIT.library('faction')?.势力 || {};
  const factions = c => {
    const merged = { ...lib(), ...(c.S.world && c.S.org) };
    return Object.entries(merged).map(([n, f]) => ({ name: n, ...f })).sort((a, b) => (b.影响力 || 0) - (a.影响力 || 0));
  };
  const deviationTier = v => v >= 80 ? '崩坏' : v >= 50 ? '剧变' : v >= 20 ? '偏移' : '平稳';
  const cityOf = c => { const p = String(c.ch.状态?.位置 || '').split('-').filter(x => x && x !== '斗罗大陆'); return [p[0], c.S.world.地点?.[p[0]] || {}]; };
  const upcoming = c => {
    const w = c.S.world, now = c.num(w.时间.tick), out = [];
    for (const [n, e] of Object.entries(w.时间线 || {})) out.push({ t: c.num(e.触发tick), icon: 'scroll', kind: '世界事件', title: e.事件 || n, sub: `${e.地点 || ''} · ${e.状态 || ''}`, ref: { e } });
    if (w.拍卖?.下次刷新tick) out.push({ t: c.num(w.拍卖.下次刷新tick), icon: 'gavel', kind: '拍卖', title: '拍卖会换季', sub: `${w.拍卖.地点} · 本期 ${Object.keys(w.拍卖.拍品 || {}).length} 件拍品`, ref: { lots: Object.entries(w.拍卖.拍品 || {}) } });
    for (const [n, q] of Object.entries(w.委托板 || {})) if (q.截止tick) out.push({ t: c.num(q.截止tick), icon: 'file-signature', kind: '委托截止', title: q.标题 || n, sub: `${q.难度} · ${q.发布者}`, ref: { id: n, q } });
    for (const [n, q] of Object.entries(c.ch.我的任务 || {})) if (q.截止tick) out.push({ t: c.num(q.截止tick), icon: 'flag', kind: '任务截止', title: n, sub: q.任务线, ref: { id: n, q } });
    const [cn, city] = cityOf(c); const shops = Object.entries(city.商店 || {}).filter(([, s]) => c.num(s._下次刷新tick)), restock = shops.map(([, s]) => c.num(s._下次刷新tick));
    if (restock.length) out.push({ t: Math.min(...restock), icon: 'store', kind: '商店补货', title: '各商店补货', sub: `${cn} · ${restock.length} 家`, ref: { shops } });
    return out.filter(x => x.t >= now).sort((a, b) => a.t - b.t);
  };
  const days = (c, t) => { const d = (t - c.num(c.S.world.时间.tick)) / 144; return d < 1 ? `${Math.max(1, Math.round(d * 24))} 小时后` : `${Math.round(d)} 天后`; };

  // 大数按「万 / 亿」缩写（四列图块放不下 1,000,000）
  const wan = (c, n) => { n = c.num(n); return n >= 1e8 ? `${Number((n / 1e8).toFixed(2))}亿` : n >= 1e4 ? `${Number((n / 1e4).toFixed(n % 1e4 ? 1 : 0))}万` : c.fmt(n); };
  const tile = (c, icon, value, label, cls = '') => `<div class="tile${cls ? ' ' + cls : ''}">${c.sock(icon)}<b>${value}</b><small>${label}</small></div>`;

  // 概况：左翼 = 所在城市，主屏 = 时空中枢（日期、世界线、魂兽森林、拍卖），右翼 = 近期安排
  const overview = c => {
    const w = c.S.world, [cn, city] = cityOf(c), kill = c.num(w.累计击杀年限), cap = 1000000;
    const here = Object.entries(c.S.char).filter(([n, x]) => n !== c.name && x.状态?.位置 === c.ch.状态?.位置).length, soon = upcoming(c).slice(0, 6);
    const lots = Object.entries(w.拍卖?.拍品 || {});
    return {
      tag: 'CORE · WORLD',
      left: `<div class="pad">${c.head('city', cn || '未知地点', city.类型 || 'City', 'gd')}
        <div class="tiles">${tile(c, 'chart-line', c.esc(city.经济状况 || '—'), '经济')}${tile(c, 'people-group', city.人口 ? c.fmt(city.人口) : '—', '人口')}${tile(c, 'flag', c.esc(city.掌控势力 || '—'), '掌控势力')}${tile(c, 'shield-halved', c.esc(city.守护军团 || '—'), '守军')}${tile(c, 'store', Object.keys(city.商店 || {}).length, '商店')}${tile(c, 'user-group', here, '同地人物')}</div>
        <button class="key-s" type="button" data-go="page-map/place"><i class="fa-solid fa-city"></i> 查看当地</button>
      </div>`,
      core: `<div class="pad">
        ${c.head('globe', '时空中枢', 'Chronos', 'gd')}
        <div class="chronos"><span class="lv">${c.esc((w.时间._calendar || '').replace(/ .*/, ''))}</span><span class="num">${c.esc((w.时间._calendar || '').split(' ')[1] || '')}</span></div>
        <div class="fame even" style="--n:3">
          <div><small>世界线偏差</small><b>${deviationTier(c.num(w.偏差值))}</b><em>偏差值 ${c.fmt(w.偏差值)} · 倍率 ×${c.fmt(w.偏差倍率)}</em></div>
          <div><small>核心阶段</small><b>${Object.keys(w.时间线 || {}).length ? c.esc(Object.values(w.时间线)[0].事件) : '未记录'}</b><em>${Object.keys(w.时间线 || {}).length ? '主线进行中' : '尚无主线节点'}</em></div>
          <div><small>拍卖</small><b>${c.esc(w.拍卖?.状态 || '休市')}</b><em>${c.esc(w.拍卖?.地点 || '')} · ${Object.keys(w.拍卖?.拍品 || {}).length} 件拍品</em></div>
        </div>
        <section class="sec"><h3>魂兽森林<span class="en">Forest</span>${c.hint('人类累计猎杀的魂兽年限；接近上限会引发兽潮。')}</h3>
          <div class="q-meter"><div class="q-mh"><small>累计击杀年限</small><b>${c.fmt(kill)}</b><em>${w.兽潮已触发 ? '兽潮已爆发' : kill / cap > .7 ? '仇恨高涨' : '相对安全'} · 上限 ${c.fmt(cap)}</em></div>${c.bar('hp', kill, cap)}</div></section>
        ${lots.length ? `<section class="sec"><h3>拍卖行<span class="en">${c.esc(w.拍卖?.地点 || '')} · ${lots.length} 件</span></h3><div class="list two">${lots.map(([n, a]) => `<button class="row" type="button" data-go="page-terminal/trade" data-go-set="venue=auction;good=${c.esc(n)};tqty=1">${c.sock('gavel')}<div><strong>${c.esc(n)}</strong><small>${c.esc([a.品级, a.分类].filter(Boolean).join(' · '))}</small></div><span class="end">${wan(c, a.价格)}</span></button>`).join('')}</div></section>` : ''}
      </div>`,
      right: `<div class="pad">${c.head('calendar-day', '近期安排', 'Upcoming')}
        ${soon.length ? `<div class="list q-list">${soon.map(x => `<button class="row" type="button" data-go="page-world/chronicle" data-go-set="csel=${c.esc(x.kind + ':' + x.title)}">${c.sock(x.icon)}<div><strong>${c.esc(x.title)}</strong><small>${c.esc([x.kind, x.sub].filter(Boolean).join(' · '))}</small></div><span class="end">${days(c, x.t)}</span></button>`).join('')}</div>` : c.empty('calendar-day', '近期没有安排')}
      </div>`,
    };
  };

  // 编年：左翼 = 未来节点（按类别分页），主屏 = 选中节点（倒计时、日期、地点 / 状态、去处），右翼 = 今天与各类计数
  const nodeDetail = (c, x) => {
    const r = x.ref || {}, q = r.q, mine = q && q.承接者 === c.name;
    if (x.kind === '委托截止' && q) return `<section class="sec"><h3>${mine ? '委托内容' : '公开简报'}<span class="en">Brief</span></h3><p class="prose">${c.esc((mine ? q.描述 : q.框架描述) || q.描述 || '—')}</p></section>
        <div class="tiles four">${tile(c, 'user-tie', c.esc(q.发布者 || '—'), '发布者')}${tile(c, 'bullhorn', c.esc(q.面向 || '公开'), '面向')}${tile(c, 'coins', c.fmt(q.奖励币 || 0), '联邦币')}${tile(c, 'star', c.fmt(q.奖励声望 || 0), '声望')}</div>`;
    if (x.kind === '任务截止' && q) return `<section class="sec"><h3>任务<span class="en">Quest</span></h3><p class="prose">${c.esc(q.描述 || q.目标 || '—')}</p></section><div class="tiles">${tile(c, 'flag', c.esc(q.任务线 || '支线'), '任务线')}${tile(c, 'circle-half-stroke', c.esc(q.状态 || '进行中'), '状态')}</div>`;
    if (r.lots) return `<section class="sec"><h3>本期拍品<span class="en">${r.lots.length} 件</span></h3><div class="list two">${r.lots.map(([n, a]) => `<button class="row" type="button" data-go="page-terminal/trade" data-go-set="venue=auction;good=${c.esc(n)};tqty=1">${c.sock('gavel')}<div><strong>${c.esc(n)}</strong><small>${c.esc([a.品级, a.分类].filter(Boolean).join(' · '))}</small></div><span class="end">${wan(c, a.价格)}</span></button>`).join('')}</div></section>`;
    if (r.shops) return `<section class="sec"><h3>各店补货<span class="en">${r.shops.length} 家</span></h3><div class="list two">${r.shops.sort((a, b) => c.num(a[1]._下次刷新tick) - c.num(b[1]._下次刷新tick)).map(([n, sh]) => `<button class="row" type="button" data-go="page-terminal/trade" data-go-set="venue=shop:${c.esc(n)};good=;tqty=1">${c.sock('store')}<div><strong>${c.esc(n)}</strong><small>${Object.keys(sh.库存 || {}).length} 种商品</small></div><span class="end">${days(c, c.num(sh._下次刷新tick))}</span></button>`).join('')}</div></section>`;
    if (r.e) return `<div class="tiles">${tile(c, 'location-dot', c.esc(r.e.地点 || '—'), '地点')}${tile(c, 'circle-half-stroke', c.esc(r.e.状态 || '—'), '状态')}</div>${r.e.描述 ? `<section class="sec"><h3>事件<span class="en">Event</span></h3><p class="prose">${c.esc(r.e.描述)}</p></section>` : ''}`;
    return `<section class="sec"><h3>详情<span class="en">Detail</span></h3><p class="prose">${c.esc(x.sub || '—')}</p></section>`;
  };
  const KIND_GO = { 委托截止: ['page-terminal/quests', 'qtab=委托板'], 任务截止: ['page-terminal/quests', ''], 拍卖: ['page-terminal/trade', 'venue=auction'], 商店补货: ['page-terminal/trade', ''] };
  const chronicle = c => {
    const all = upcoming(c), kinds = [...new Set(all.map(x => x.kind))], now = c.num(c.S.world.时间.tick);
    const tab = kinds.includes(c.state.ui.ctab) ? c.state.ui.ctab : '全部', list = tab === '全部' ? all : all.filter(x => x.kind === tab);
    const key = x => x.kind + ':' + x.title, sel = list.find(x => key(x) === c.state.ui.csel) || list[0], go = sel && KIND_GO[sel.kind];
    return {
      tag: 'CORE · CHRONICLE',
      left: `<div class="pad">${c.head('timeline', '未来节点', 'Timeline', 'gd')}
        ${all.length ? `<div class="pick-row">${c.pick('ctab', tab, ['全部', ...kinds].map(k => ({ value: k, label: `${k} · ${k === '全部' ? all.length : all.filter(x => x.kind === k).length}` })))}</div>
        <div class="list q-list timeline-list">${list.map(x => `<button class="row${x === sel ? ' on' : ''}" type="button" data-set="csel=${c.esc(key(x))}" aria-current="${x === sel}">${c.sock(x.icon)}<div><strong>${c.esc(x.title)}</strong><small>${c.esc(c.tickDate(x.t).replace(/^斗罗历\d+年/, ''))}</small></div><span class="end">${days(c, x.t)}</span></button>`).join('')}</div>` : c.empty('timeline', '还没有记录未来事件')}
      </div>`,
      core: sel ? `<div class="pad">
        <div class="q-title">${c.sock(sel.icon, 'gd')}<span class="chip">${sel.kind}</span><h2>${c.esc(sel.title)}</h2></div>
        <div class="q-meters"><div class="q-meter"><div class="q-mh"><small>距今</small><b>${days(c, sel.t)}</b><em>${c.esc(c.tickDate(sel.t))}</em></div>${c.bar('vp', Math.max(0, 1440 - (sel.t - now)), 1440)}</div></div>
        ${nodeDetail(c, sel)}
        ${go ? `<button class="key-s" type="button" style="align-self:flex-start" data-go="${go[0]}" data-go-set="${c.esc([go[1], sel.ref?.id && sel.kind === '委托截止' ? `qsel=${sel.ref.id}` : '', sel.ref?.id && sel.kind === '任务截止' ? `qsel=${sel.ref.id}` : ''].filter(Boolean).join(';'))}"><i class="fa-solid fa-arrow-right"></i> 前往处理</button>` : ''}
      </div>` : `<div class="pad sparse">${c.empty('timeline', '还没有记录未来事件')}</div>`,
      right: `<div class="pad">${c.head('hourglass-half', '今日', 'Today')}
        <div class="chronos small"><span class="lv">${c.esc((c.S.world.时间._calendar || '').replace(/ .*/, ''))}</span><span class="num">${c.esc((c.S.world.时间._calendar || '').split(' ')[1] || '')}</span></div>
        <div class="tiles">${tile(c, 'book-open', Object.keys(c.S.world.时间线 || {}).length, '世界事件')}${tile(c, 'hourglass-half', all.length, '未来节点')}${kinds.map(k => tile(c, all.find(x => x.kind === k).icon, all.filter(x => x.kind === k).length, k)).join('')}</div>
      </div>`,
    };
  };

  // 势力：左翼 = 势力列表（类型筛选，我所属的置顶），主屏 = 选中势力的档案，右翼 = 对外态度与我在其中的身份
  const factionView = c => {
    const all = factions(c), mineMap = c.ch.社交?.势力 || {}, types = [...new Set(all.map(f => f.类型 || '其他'))];
    const ftype = types.includes(c.state.ui.ftype) ? c.state.ui.ftype : '全部';
    const list = (ftype === '全部' ? all : all.filter(f => (f.类型 || '其他') === ftype)).sort((a, b) => (mineMap[b.name] ? 1 : 0) - (mineMap[a.name] ? 1 : 0));
    const f = list.find(x => x.name === c.state.ui.fsel) || list[0], st = f?.战力统计 || {}, me = f && mineMap[f.name];
    const desc = f ? String(f.描述 || '').replace(/[#*]/g, '').split('\n').map(s => s.trim()).filter(Boolean).join(' ') : '';
    const rel = f ? Object.entries(f.关系 || {}) : [], editable = f && c.S.org?.[f.name];
    return {
      tag: 'CORE · FACTIONS',
      left: `<div class="pad">${c.head('chess-rook', '势力', 'Factions', 'gd')}
        <div class="pick-row">${c.pick('ftype', ftype, ['全部', ...types].map(t => ({ value: t, label: `${t} · ${t === '全部' ? all.length : all.filter(x => (x.类型 || '其他') === t).length}` })))}</div>
        <div class="list q-list">${list.map(x => `<button class="row${x === f ? ' on' : ''}" type="button" data-set="fsel=${c.esc(x.name)}" aria-current="${x === f}"><span class="chip${mineMap[x.name] ? ' gold' : ''}">${mineMap[x.name] ? '所属' : c.esc(x.状态 || x.类型 || '—')}</span><div><strong>${c.esc(x.name)}</strong><small>${c.esc(x.类型 || '')}</small></div><span class="end">${wan(c, x.影响力)}</span></button>`).join('')}</div>
      </div>`,
      core: f ? `<div class="pad">
        <div class="q-title">${c.sock('chess-rook', 'gd')}<span class="chip">${c.esc(f.类型 || '势力')}</span><h2>${c.esc(f.name)}</h2><span class="q-state">${c.esc(f.状态 || '—')}</span></div>
        ${f.上级势力 && f.上级势力 !== '无' ? `<div class="q-from">上级 ${c.esc(f.上级势力)}</div>` : ''}
        <div class="tiles four">${tile(c, 'crown', wan(c, f.影响力), '影响力')}${tile(c, 'users', wan(c, f.规模), '规模')}${tile(c, 'bolt', c.fmt(st.极限斗罗 || 0), '极限斗罗')}${tile(c, 'star', c.fmt(st.超级斗罗 || 0), '超级斗罗')}</div>
        ${!c.blank(f.现状描述) ? `<section class="sec"><h3>现状<span class="en">Now</span></h3><p class="prose">${c.esc(f.现状描述)}</p></section>` : ''}
        <section class="sec"><h3>简介<span class="en">Profile</span></h3><p class="prose">${c.esc(desc || '没有收录简介')}</p></section>
      </div>` : `<div class="pad sparse">${c.empty('chess-rook', '没有势力资料')}</div>`,
      right: `<div class="pad">${c.head('handshake', '关系', 'Relations')}
        ${me ? `<div class="spirit-card">${c.sock('id-badge', 'gd')}<div><strong>${c.esc(me.身份 || '成员')}</strong><small>权限级 ${c.fmt(me.权限级 || 0)}</small></div><span class="q-state">所属</span></div>` : ''}
        ${rel.length ? `<div class="list q-list">${rel.map(([k, v]) => `<div class="row" style="cursor:default"><span class="chip">${c.esc(typeof v === 'object' ? v.态度 || v.关系 || '—' : v)}</span><div><strong>${c.esc(k)}</strong>${editable ? '' : '<small>内置资料</small>'}</div><span></span></div>`).join('')}</div>` : c.empty('handshake', '没有记录对外态度')}
      </div>`,
    };
  };

  // 赛事：左翼 = 赛事列表，主屏 = 选中赛事（日程、项目、参赛规模），右翼 = 我的参赛
  // 赛事（数据与校验在原项目赛事运行时，操作走 __LWCS_COMPETITION_PRIVILEGE_ACTION__）：左翼 = 未结束的赛事 + 归档；
  // 主屏 = 项目切换与总览（赛程 / 循环分组积分）、参赛者、规则；右翼 = 我的参赛与当前阶段能做的操作（报名、启动、推进场外赛）
  const GPAGES = ['总览', '参赛者', '规则'];
  const inEntry = (c, p) => Object.values(p?.参赛者 || {}).some(r => r?.名称 === c.player || (r?.成员 || []).includes(c.player));
  const games = c => {
    const ui = c.state.ui, all = Object.entries(c.S.world.赛事 || {}), list = all.filter(([, x]) => x?.状态 !== '已完成'), done = all.filter(([, x]) => x?.状态 === '已完成');
    const [id, g] = list.find(([k]) => k === ui.gsel) || list[0] || [];
    const projs = g ? Object.keys(g.项目 || {}) : [], proj = projs.includes(ui.gproj) ? ui.gproj : projs[0] || '个人赛', p = g?.项目?.[proj], prog = g?._进度?.[proj];
    const page = GPAGES.includes(ui.gpage) ? ui.gpage : '总览', rt = c.rt('__LWCS_COMPETITION_PRIVILEGE_RUNTIME__');
    if (ui.garch === undefined && c.rt('__LWCS_ERA_RUNTIME_INTEGRATION_V1__')) { ui.garch = null; window.COCKPIT.previewAsync('competitionArchive').then(a => { ui.garch = Array.isArray(a) ? a : []; window.COCKPIT.refresh(); }); }
    const mine = list.filter(([, x]) => Object.values(x.项目 || {}).some(q => inEntry(c, q)));
    const act = (action, payload, confirm) => `${confirm ? `data-confirm="${c.esc(confirm)}" ` : ''}data-act="${c.esc(JSON.stringify({ name: 'competition', action, payload }))}"`;
    const nameOf = pid => prog?.实体?.[pid]?.名称 || p?.参赛者?.[pid]?.名称 || '待定';
    const overview = () => {
      if (!prog) return '<div class="void"><strong>项目尚未启动</strong></div>';
      const groups = (p?.流程 === '循环' || p?.流程 === '循环后淘汰') ? Object.entries(rt?.生成循环积分表?.(g, proj) || {}) : [];
      const groupHtml = groups.length ? `<section class="sec"><h3>循环分组<span class="en">${groups.length} 组</span></h3>${groups.slice(0, 4).map(([gn, rows]) => `<div class="cost-table" role="table"><div class="ct-row ct-head" role="row"><span>${c.esc(gn)} 组</span><span>赛</span><span>胜</span><span>负</span><span>积分</span></div>${rows.map(r => `<div class="ct-row" role="row"><span>${c.esc(nameOf(r.参赛者ID))}</span><span>${c.fmt(r.场次 ?? r.赛 ?? 0)}</span><span>${c.fmt(r.胜 ?? 0)}</span><span>${c.fmt(r.负 ?? 0)}</span><span>${c.fmt(r.积分 ?? 0)}</span></div>`).join('')}</div>`).join('')}</section>` : '';
      const matches = Object.entries(prog.对局 || {}).slice(0, 80);
      return groupHtml + `<section class="sec"><h3>赛程<span class="en">${matches.length}</span></h3><div class="list">${matches.map(([mid, m]) => { const sides = (m.参赛者 || []).map(nameOf), me = (m.参赛者 || []).some(pid => (prog.实体?.[pid]?.成员 || []).includes(c.player) || prog.实体?.[pid]?.名称 === c.player), win = m.赛果?.结果;
        return `<div class="row${me ? ' on' : ''}"><span class="chip s">${m.分组 ? c.esc(m.分组) + ' · ' : ''}第 ${c.fmt(m.轮次)} 轮</span><div><strong>${sides.map((n, i) => `<span class="${win && m.参赛者[i] === win ? 'winner' : ''}">${c.esc(n)}</span>`).join(' <small>VS</small> ')}</strong><small>${m.赛果 ? `胜者 ${c.esc(nameOf(win))}` : '待赛'}</small></div>${me && !m.赛果 ? `<button class="key-s" type="button" ${act('准备玩家对局', { 赛事ID: id, 项目: proj, 对局ID: mid }, `进入「${g.名称 || id}」${proj}第 ${m.轮次} 轮：${sides.join(' 对 ')}`)}><i class="fa-solid fa-flag-checkered"></i> 进入比赛</button>` : '<span></span>'}</div>`; }).join('') || '<span class="lbl">还没有排出对局</span>'}</div></section>`;
    };
    const entrants = () => {
      const rows = Object.entries(p?.参赛者 || {});
      return `<div class="tiles">${tile(c, 'users', c.fmt(p?.参赛总数 || 0), '参赛总数')}${tile(c, 'user-check', rows.length, '已登记')}${tile(c, 'robot', c.fmt(prog?.模拟数量 ?? Math.max(0, c.num(p?.参赛总数) - rows.length)), '模拟池')}</div>
        <div class="list">${rows.slice(0, 100).map(([, r]) => `<div class="row${(r.成员 || []).includes(c.player) || r.名称 === c.player ? ' on' : ''}">${c.sock(proj === '团体赛' ? 'people-group' : 'user')}<div><strong>${c.esc(r.名称)}</strong><small>${c.esc((r.成员 || []).join('、'))}</small></div><span class="chip s">${c.esc(r.状态 || '已登记')}</span></div>`).join('') || '<span class="lbl">还没有人报名</span>'}</div>`;
    };
    const rules = () => { const l = p?.参赛限制 || {}; return `<div class="chips-row">${[`流程 ${p?.流程 || '未设置'}`, `参赛总数 ${c.fmt(p?.参赛总数 || 0)}`, l.队伍人数上限 ? `队伍最多 ${l.队伍人数上限} 人` : '', l.年龄上限 !== undefined ? `年龄不超过 ${l.年龄上限} 岁` : '', l.等级上限 !== undefined ? `等级不超过 ${l.等级上限} 级` : '', (l.允许身份 || []).length ? `身份 ${l.允许身份.join('、')}` : '', (l.必需装备 || []).length ? `必需装备 ${l.必需装备.join('、')}` : '', (l.禁止装备 || []).length ? `禁止装备 ${l.禁止装备.join('、')}` : ''].filter(Boolean).map(t => `<span class="chip s">${c.esc(t)}</span>`).join('')}</div>`; };
    // 报名表：名称 + 成员（默认自己；团体赛可多选）
    const members = String(ui.gmem || c.player).split('|').filter(Boolean), regName = ui.gname ?? (proj === '团体赛' ? '' : c.player);
    const cands = [c.player, ...Object.keys(c.S.char || {}).filter(n => n !== c.player)];
    const regForm = g?.状态 === '筹备' && p ? `<div class="groove"></div><span class="lbl">${c.esc(proj)}报名${c.hint('报名资格（年龄、等级、身份、装备、队伍人数）由赛事规则校验，不合格会给出原因')}</span>
        <div class="dzf"><span class="dzf-l">${proj === '团体赛' ? '队伍名' : '选手名'}</span><input type="text" data-gname value="${c.esc(regName)}" aria-label="${proj === '团体赛' ? '队伍名' : '选手名'}"></div>
        <div class="dzf"><span class="dzf-l">成员</span><div class="dz-chips">${(proj === '团体赛' ? cands : [c.player]).map(n => `<button type="button" class="dz-chip${members.includes(n) ? ' on' : ''}" data-gmem="${c.esc(n)}" aria-pressed="${members.includes(n)}">${c.esc(n)}</button>`).join('')}</div></div>
        <button class="cta" type="button" data-game-join="${c.esc(id)}" data-proj="${c.esc(proj)}"><i class="fa-solid fa-signature"></i>报名参赛</button>` : '';
    const stage = !g ? '' : g.状态 === '筹备' ? `<button class="key-s" type="button" ${act('启动赛事', { 赛事ID: id }, `启动「${g.名称 || id}」：截止报名并排出赛程`)}><i class="fa-solid fa-play"></i> 启动赛事</button>`
      : g.状态 === '进行中' ? `<button class="key-s" type="button" ${act('模拟场外比赛', { 赛事ID: id }, `推进「${g.名称 || id}」与你无关的场外对局`)}><i class="fa-solid fa-forward"></i> 推进场外赛</button>` : '';
    const arch = [...done.map(([k, x]) => ({ id: k, name: x.名称 || k, note: '归档待重试', action: '归档重试', label: '重试' })), ...(ui.garch || []).map(x => ({ id: x.赛事ID, name: x.名称, note: x.项目摘要 || `${x.参赛数量 || 0} 个参赛单位`, action: '恢复归档', label: '恢复' }))];
    return {
      tag: 'CORE · TOURNAMENT', wide: list.length || arch.length ? '' : 'both',
      railR: `<div class="rail">${c.sock('user-check')}<b>${mine.length}</b><small>我的参赛</small></div>`, railL: `<div class="rail">${c.sock('trophy')}<b>${list.length}</b><small>赛事</small></div>`,
      left: `<div class="pad">${c.head('trophy', '赛事', 'Tournament', 'gd')}
        ${list.length ? `<div class="list q-list">${list.map(([k, x]) => `<button class="row${k === id ? ' on' : ''}" type="button" data-set="gsel=${c.esc(k)}"><span class="chip">${c.esc(x.状态 || '筹备')}</span><div><strong>${c.esc(x.名称 || k)}</strong><small>${c.esc(c.tickDate(x.日程?.开始tick || 0))}</small></div><span></span></button>`).join('')}</div>` : c.empty('trophy', '暂无赛事', '赛事由剧情发起；筹备期可以报名参赛')}
        ${arch.length ? `<section class="sec"><h3>归档<span class="en">Archive</span></h3><div class="list">${arch.map(x => `<div class="row">${c.sock('box-archive')}<div><strong>${c.esc(x.name)}</strong><small>${c.esc(x.note)}</small></div><button class="key-s" type="button" ${act(x.action, { 赛事ID: x.id }, `${x.label}「${x.name}」`)}>${x.label}</button></div>`).join('')}</div></section>` : ''}
      </div>`,
      core: g ? `<div class="pad">
        <div class="q-title">${c.sock('trophy', 'gd')}<span class="chip">${c.esc(g.状态 || '筹备')}</span><h2>${c.esc(g.名称 || id)}</h2></div>
        <div class="q-meters"><div class="q-meter"><div class="q-mh"><small>日程</small><b>${c.esc(c.tickDate(g.日程?.开始tick || 0))}</b><em>至 ${c.esc(c.tickDate(g.日程?.结束tick || 0))}</em></div></div></div>
        ${projs.length > 1 ? `<div class="seg">${projs.map(k => `<button class="key-s${k === proj ? ' on' : ''}" type="button" data-set="gproj=${c.esc(k)}">${c.esc(k)}</button>`).join('')}</div>` : ''}
        <div class="seg">${GPAGES.map(k => `<button class="key-s${k === page ? ' on' : ''}" type="button" data-set="gpage=${k}">${k}</button>`).join('')}</div>
        ${page === '参赛者' ? entrants() : page === '规则' ? rules() : overview()}
      </div>` : `<div class="pad sparse">${c.empty('trophy', '暂无赛事', '赛事由剧情发起；筹备期可以报名参赛')}</div>`,
      right: `<div class="pad">${c.head('user-check', '我的参赛', 'Entry')}
        <div class="tiles">${tile(c, 'user-check', mine.length, '已报名')}${tile(c, 'trophy', list.filter(([, x]) => x.状态 === '进行中').length, '进行中')}</div>
        ${g && p && inEntry(c, p) ? `<div class="okline"><i class="fa-solid fa-circle-check"></i>已报名${c.esc(proj)}</div>` : regForm}
        ${stage ? `<div class="act-row">${stage}</div>` : ''}
      </div>`,
    };
  };

  // 图鉴：左翼 = 已收录条目，主屏 = 选中条目档案（可原地改），右翼 = 研究档位与收集奖励。
  // 档位 / 奖励同原项目：研究档位门槛从 50 起每档翻倍（见习生态学者 → 世界边境观察者）；每 25 条反应校准 +1%，至多 +6%
  const RANKS = ['见习生态学者', '野外调查员', '生态编目官', '危险谱系研究员', '世界边境观察者'];
  const rankOf = n => { let need = 50, left = n, i = 0; while (left >= need && need < 51200) { left -= need; i = Math.min(i + 1, RANKS.length - 1); need *= 2; } return { name: RANKS[i], cur: Math.min(need, left), need }; };
  const bestiary = c => {
    const list = Object.entries(c.S.world.图鉴 || {}), [key, b] = list.find(([k]) => k === c.state.ui.bsel) || list[0] || [];
    const rk = rankOf(list.length), reward = Math.min(6, Math.floor(list.length / 25));
    const bp = ['world', '图鉴', key];
    const s = (k, dflt = '未记录') => c.ed(c.blank(b[k]) ? dflt : b[k], [...bp, k], { raw: c.blank(b[k]) ? '' : b[k] });
    const n = k => c.ed(b[k] == null ? '—' : c.fmt(b[k]), [...bp, k], { kind: 'number', integer: true, min: 0, raw: b[k] ?? '' });
    return {
      tag: 'CORE · BESTIARY', wide: list.length ? '' : 'l', railL: `<div class="rail">${c.sock('dragon')}<b>0</b><small>图鉴</small></div>`,
      left: `<div class="pad">${c.head('dragon', '图鉴', 'Bestiary', 'gd')}
        ${list.length ? `<div class="list q-list">${list.map(([k, x]) => `<button class="row${k === key ? ' on' : ''}" type="button" data-set="bsel=${c.esc(k)}"><span class="chip">${c.esc(x.年限档 || '—')}</span><div><strong>${c.esc(x.名称 || k)}</strong><small>对标 ${c.fmt(x.对标等级)} 级</small></div><span></span></button>`).join('')}</div>` : c.empty('dragon', '还没有收录魂兽', '遭遇或击败魂兽后会自动收录')}
      </div>`,
      core: b ? `<div class="pad">
        <div class="q-title">${c.sock('dragon', 'gd')}<span class="chip">${c.esc(b.年限档 || b.类型 || '魂兽')}</span><h2>${c.ed(b.名称 || key, [...bp, '名称'])}</h2></div>
        <div class="q-from">${c.esc(key)}</div>
        <div class="tiles four">${tile(c, 'chart-simple', n('对标等级'), '对标等级')}${tile(c, 'hourglass-start', n('年限下限'), '年限下限')}${tile(c, 'hourglass-end', n('年限上限'), '年限上限')}${tile(c, 'gem', s('物种品质'), '物种品质')}</div>
        <section class="sec"><h3>物种<span class="en">Species</span></h3>${c.kv([['类型', s('类型', '怪物')], ['具体物种', s('具体物种')], ['标准物种', s('标准物种')], ['标准种族', s('标准种族')], ['常见级别', s('常见级别')]])}</section>
        ${c.entries(b.标准技能).length ? `<section class="sec"><h3>标准技能<span class="en">${c.entries(b.标准技能).length}</span></h3><div class="chips-row">${c.entries(b.标准技能).map(([k]) => `<span class="chip s">${c.esc(k)}</span>`).join('')}</div></section>` : ''}
      </div>` : `<div class="pad sparse">${c.empty('dragon', '还没有收录魂兽')}</div>`,
      right: `<div class="pad">${c.head('microscope', '研究', 'Research')}
        <div class="q-meter"><div class="q-mh"><small>研究档位</small><b>${rk.name}</b><em>下一档还需 ${c.fmt(rk.need - rk.cur)} 条</em></div>${c.bar('vp', rk.cur, rk.need)}</div>
        <div class="tiles">${tile(c, 'book', list.length, '已收录')}${tile(c, 'crosshairs', `+${reward}%`, '反应校准')}</div>
      </div>`,
    };
  };
  // 下拉筛选（编年类别 / 势力类型）：选中即切换
  document.addEventListener('picker:change', e => {
    const k = e.detail.path; if (!['ctab', 'ftype'].includes(k)) return;
    const c = window.COCKPIT.ctx(); c.state.ui[k] = e.detail.value; window.COCKPIT.refresh();
  });

  document.addEventListener('click', e => {
    const m = e.target.closest('[data-gmem]');
    if (m) { const ui = window.COCKPIT.ctx().state.ui, c = window.COCKPIT.ctx(), set = new Set(String(ui.gmem || c.player).split('|').filter(Boolean)); set.has(m.dataset.gmem) ? set.delete(m.dataset.gmem) : set.add(m.dataset.gmem); ui.gmem = [...set].join('|'); return window.COCKPIT.refresh(); }
    const t = e.target.closest('[data-game-join]'); if (!t) return;
    const c = window.COCKPIT.ctx(), ui = c.state.ui, name = String(c.ui?.gname ?? ui.gname ?? '').trim() || (t.dataset.proj === '团体赛' ? '' : c.player), mem = String(ui.gmem || c.player).split('|').filter(Boolean);
    if (!name) { t.dataset.blocked = '先填写队伍名'; delete t.dataset.act; return; }
    delete t.dataset.blocked;
    t.dataset.confirm = `报名「${t.dataset.proj}」：${name}${mem.length ? `（${mem.join('、')}）` : ''}`;
    t.dataset.act = JSON.stringify({ name: 'competition', action: '报名', payload: { 赛事ID: t.dataset.gameJoin, 项目: t.dataset.proj, 名称: name, 成员: mem, 持有人: c.player } });
  }, true);
  document.addEventListener('change', e => { const t = e.target.closest?.('[data-gname]'); if (t) window.COCKPIT.ctx().state.ui.gname = t.value; });

  window.COCKPIT.register('page-world', {
    label: '世界', icon: 'globe', tag: 'CORE · WORLD',
    keys: [
      { id: 'overview', icon: 'globe', label: '概况', view: overview },
      { id: 'chronicle', icon: 'timeline', label: '编年', view: chronicle },
      { id: 'faction', icon: 'chess-rook', label: '势力', view: factionView },
      { id: 'games', icon: 'trophy', label: '赛事', view: games },
      { id: 'bestiary', icon: 'dragon', label: '图鉴', view: bestiary },
    ],
  });
})();

/* 事务领域：任务 · 试炼 · 工坊 · 情报 · 交易 · 战斗 · 设置 */
(() => {
  const left = (c, t) => { const d = (c.num(t) - c.num(c.S.world.时间.tick)) / 144; return d <= 0 ? '已截止' : d < 1 ? `剩 ${Math.max(1, Math.round(d * 24))} 小时` : `剩 ${Math.round(d)} 天`; };

  // 任务：左翼 = 分页列表（主线 / 支线 / 委托板），主屏 = 选中任务的简报（进度、时限、要求、说明、奖励），右翼 = 操作。
  // 同原项目「列表 + 焦点详情 + 操作条」：推进 / 提交 / 放弃 / 接取走 AI 请求（data-quest-action，移植时接 buildQuestDispatchRequest），
  // 删除走记录删除。分组同原版：任务线不是「主线」的都算支线
  const QUEST_ICON = { 主线: 'crown', 支线: 'route', 委托板: 'file-signature' };
  const quests = c => {
    const ui = c.state.ui, now = c.num(c.S.world.时间.tick);
    const mine = Object.entries(c.ch.我的任务 || {}), board = Object.entries(c.S.world.委托板 || {});
    const lines = { 主线: mine.filter(([, q]) => q.任务线 === '主线'), 支线: mine.filter(([, q]) => q.任务线 !== '主线'), 委托板: board };
    const tab = lines[ui.qtab] ? ui.qtab : lines.主线.length ? '主线' : lines.支线.length ? '支线' : '委托板';
    const list = lines[tab], selId = list.some(([id]) => id === ui.qsel) ? ui.qsel : list[0]?.[0], sel = list.find(([id]) => id === selId)?.[1];
    const isBoard = tab === '委托板', active = mine.filter(([, q]) => q.状态 === '进行中').length, open = board.filter(([, q]) => (q.状态 || '待接取') === '待接取').length;
    const rowOf = ([id, q]) => `<button class="row${id === selId ? ' on' : ''}" type="button" data-set="qsel=${c.esc(id)}" aria-current="${id === selId}"><span class="chip">${c.esc(isBoard ? q.难度 || '委托' : q.状态 || '进行中')}</span><div><strong>${c.esc(isBoard ? q.标题 || id : id)}</strong><small>${c.esc(isBoard ? q.发布者 || '' : `进度 ${c.fmt(q.当前进度)}%`)}</small></div><span class="end">${q.截止tick ? left(c, q.截止tick) : ''}</span></button>`;
    return {
      tag: 'CORE · QUESTS',
      left: `<div class="pad">${c.head('list-check', '任务', 'Quest Log', 'gd')}
        <div class="seg q-tabs" role="tablist">${Object.entries(lines).map(([k, l]) => `<button class="key-s${k === tab ? ' on' : ''}" type="button" role="tab" aria-selected="${k === tab}" data-set="qtab=${k}"><i class="fa-solid fa-${QUEST_ICON[k]}"></i> ${k}<b>${l.length}</b></button>`).join('')}</div>
        ${c.isPlayer ? `<button class="key-s${ui.qnew ? ' on' : ''}" type="button" data-set="qnew=${isBoard ? 'board' : 'record'}"><i class="fa-solid fa-plus"></i> ${isBoard ? '发布委托' : `新建${tab}任务`}</button>` : ''}
        ${list.length ? `<div class="list q-list">${list.map(rowOf).join('')}</div>` : c.empty(QUEST_ICON[tab], isBoard ? '委托板是空的' : `没有${tab}任务`)}
      </div>`,
      ...(ui.qnew ? questNew(c, ui.qnew === 'board' ? 'board' : 'record', tab) : {}),
      core: ui.qnew ? questNew(c, ui.qnew === 'board' ? 'board' : 'record', tab).core : sel ? questBrief(c, tab, selId, sel, now) : `<div class="pad sparse">${c.empty('clipboard-list', isBoard ? '委托板是空的' : `没有${tab}任务`)}${!isBoard && board.length ? `<button class="key-s" type="button" data-set="qtab=委托板" style="align-self:center"><i class="fa-solid fa-file-signature"></i> 看委托板 · ${board.length}</button>` : ''}</div>`,
      // 右翼：上方是总览数字，操作键沉到底部（主按钮 .cta 自带 margin-top:auto）
      right: ui.qnew ? questNew(c, ui.qnew === 'board' ? 'board' : 'record', tab).right : `<div class="pad">${c.head('bolt', '行动', 'Actions')}
        <div class="tiles"><div class="tile">${c.sock('list-check')}<b>${active}</b><small>进行中</small></div><div class="tile">${c.sock('file-signature')}<b>${open}</b><small>待接取委托</small></div></div>
        ${sel ? questActions(c, isBoard, selId, sel) : c.empty('bolt', '暂无可执行的操作')}
      </div>`,
    };
  };
  // 新建个人任务 / 发布委托：字段与选项同原项目「任务界面」；表单值存在界面状态 qf 里，提交时由桥接按原逻辑写回
  const QF_OPTS = { 任务线: ['主线', '支线'], 状态: ['进行中', '可提交', '已完成', '已放弃', '失败'], 面向: ['公开', '指定对象'], 难度: ['低', '中', '高', '极高'], 资源级别: ['无', '低', '中', '高', '稀有'] };
  const questNew = (c, kind, tab) => {
    const ui = c.state.ui, f = ui.qf = ui.qf || {}, board = kind === 'board';
    if (f._kind !== kind) Object.assign(f, { _kind: kind, 名称: '', 描述: '', 任务线: tab === '主线' ? '主线' : '支线', 状态: '进行中', 发布者: '传灵塔', 面向: '公开', 指定对象: '', 难度: '中', 资源级别: '无', 时限天数: 0, 奖励币: 0, 奖励声望: 0 });
    const text = (k, label, ph = '') => `<div class="dzf"><span class="dzf-l">${label}</span><input type="text" data-qf="${k}" value="${c.esc(f[k] || '')}" placeholder="${c.esc(ph)}" aria-label="${label}"></div>`;
    const num = (k, label, hint = '') => `<div class="dzf"><span class="dzf-l">${label}${hint ? c.hint(hint) : ''}</span><input type="number" min="0" step="1" data-qf="${k}" value="${c.esc(f[k] ?? 0)}" aria-label="${label}"></div>`;
    const sel = (k, label, opts) => `<div class="dzf"><span class="dzf-l">${label}</span>${c.pick('qf:' + k, f[k], opts)}</div>`;
    const chars = Object.keys(c.S.char || {}).filter(n => n !== c.player);
    const fields = board
      ? [text('名称', '委托名', '护送样本'), text('发布者', '发布者'), sel('面向', '面向', QF_OPTS.面向), f.面向 === '指定对象' ? sel('指定对象', '指定对象', chars) : '', sel('难度', '难度', QF_OPTS.难度), sel('资源级别', '资源级别', QF_OPTS.资源级别)]
      : [text('名称', '任务名'), sel('任务线', '任务线', QF_OPTS.任务线), sel('状态', '状态', QF_OPTS.状态)];
    fields.push(num('时限天数', '时限（天）', '0 表示不限时'), num('奖励币', '奖励货币'), num('奖励声望', '奖励声望'));
    return {
      core: `<div class="pad"><div class="q-title">${c.sock(board ? 'file-signature' : 'plus', 'gd')}<span class="chip">${board ? '委托板' : c.esc(f.任务线)}</span><h2>${board ? '发布委托' : '新建任务'}</h2></div>
        <div class="dz2-grid">${fields.join('')}<label class="dzf wide"><span class="dzf-l">${board ? '委托目标' : '任务目标'}</span><textarea data-qf="描述" rows="4" aria-label="目标">${c.esc(f.描述 || '')}</textarea></label></div></div>`,
      right: `<div class="pad">${c.head(board ? 'file-signature' : 'plus', board ? '发布' : '新建', 'Create')}${c.kv([[board ? '委托名' : '任务名', c.esc(f.名称 || '—')], ['时限', f.时限天数 > 0 ? `${c.fmt(f.时限天数)} 天` : '不限'], ['奖励', `${c.fmt(f.奖励币 || 0)} · 声望 ${c.fmt(f.奖励声望 || 0)}`]])}
        <button class="cta" type="button" data-qf-submit="${kind}"><i class="fa-solid fa-${board ? 'bullhorn' : 'check'}"></i>${board ? '发布委托' : '新建任务'}</button>
        <div class="act-row"><button class="key-s" type="button" data-set="qnew="><i class="fa-solid fa-xmark"></i> 取消</button></div></div>`,
    };
  };
  document.addEventListener('input', e => { const t = e.target.closest?.('[data-qf]'); if (t) (window.COCKPIT.ctx().state.ui.qf ||= {})[t.dataset.qf] = t.type === 'number' ? Math.max(0, Math.floor(Number(t.value) || 0)) : t.value; });
  document.addEventListener('change', e => { if (e.target.closest?.('[data-qf]')) window.COCKPIT.refreshSoon(); });
  document.addEventListener('picker:change', e => { if (!String(e.detail.path).startsWith('qf:')) return; (window.COCKPIT.ctx().state.ui.qf ||= {})[e.detail.path.slice(3)] = e.detail.value; window.COCKPIT.refresh(); });
  // 提交：捕获阶段把表单写进动作；缺必填项时直接给原因
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-qf-submit]'); if (!t) return;
    const f = window.COCKPIT.ctx().state.ui.qf || {}, board = t.dataset.qfSubmit === 'board';
    delete t.dataset.blocked;
    const miss = !String(f.名称 || '').trim() ? (board ? '先填写委托名' : '先填写任务名') : !String(f.描述 || '').trim() ? (board ? '先填写委托目标' : '先填写任务目标') : '';
    if (miss) { t.dataset.blocked = miss; delete t.dataset.act; return; }
    const form = Object.fromEntries(Object.entries(f).filter(([k]) => !k.startsWith('_')));
    t.dataset.confirm = board ? `发布委托「${f.名称}」（${f.难度} · ${f.面向 === '指定对象' ? '指定 ' + (f.指定对象 || '未选') : '公开'}）` : `新建${f.任务线}任务「${f.名称}」`;
    t.dataset.act = JSON.stringify({ name: 'questCreate', kind: board ? 'board' : 'record', form });
  }, true);

  // 简报：委托未接取时只给公开的框架描述（完整描述接取后公开，同原版）
  const questBrief = (c, tab, id, q, now) => {
    const isBoard = tab === '委托板', qp = isBoard ? ['world', '委托板', id] : c.P('我的任务', id);
    const start = c.num(isBoard ? q.生成tick : q.最后更新时间tick), end = c.num(q.截止tick);
    const timeLeft = end ? Math.max(0, end - now) : 0, span = end && start && end > start ? end - start : 0, urgent = span && timeLeft / span < .25;
    const need = q.交付需求, have = need ? c.num(c.ch.背包?.[need.名称]?.数量) : 0;
    const desc = isBoard ? q.框架描述 || '' : q.描述 || '';
    return `<div class="pad">
      <div class="q-title">${c.sock(QUEST_ICON[tab], 'gd')}<span class="chip">${c.esc(isBoard ? q.难度 || '委托' : q.任务线 || '支线')}</span><h2>${isBoard ? c.ed(q.标题 || id, [...qp, '标题']) : c.esc(id)}</h2><span class="q-state">${c.esc(isBoard ? q.状态 || '待接取' : q.状态 || '进行中')}</span></div>
      <div class="q-from">${c.esc(isBoard ? `${q.发布者 || '未知发布者'} · ${q.面向 || '公开'}${q.指定对象 && q.指定对象 !== '无' ? ` · 指定 ${q.指定对象}` : ''}` : `${q.任务线 || '支线'}任务`)}</div>
      <div class="q-meters">
        ${isBoard ? '' : `<div class="q-meter"><div class="q-mh"><small>进度</small><b>${c.ed(c.fmt(q.当前进度), [...qp, '当前进度'], { kind: 'number', min: 0, max: 100, raw: c.num(q.当前进度) })}%</b></div>${c.bar('mp', c.num(q.当前进度), 100)}</div>`}
        ${end ? `<div class="q-meter"><div class="q-mh"><small>时限</small><b${urgent ? ' class="warn-t"' : ''}>${left(c, end)}</b><em>截止 ${c.esc(c.tickDate(end))}</em></div>${span ? c.bar(urgent ? 'hp' : 'vp', timeLeft, span) : ''}</div>` : '<div class="q-meter"><div class="q-mh"><small>时限</small><b>无</b></div></div>'}
      </div>
      <section class="sec"><h3>${isBoard ? '公开简报' : '任务说明'}<span class="en">Brief</span></h3>
        <p class="prose">${c.ed(desc || '未记录', [...qp, isBoard ? '框架描述' : '描述'], { kind: 'text', raw: desc })}</p>
        ${isBoard ? `<div class="q-locked"><i class="fa-solid fa-lock"></i><span>完整内容</span>${c.hint('接取后公开目标坐标、比对要求或路线与交接人。')}</div>` : ''}
      </section>
      ${need || q.资源级别 ? `<section class="sec"><h3>要求<span class="en">Requirement</span></h3><div class="tiles">
        ${need ? `<div class="tile wide">${c.sock('box')}<b>${c.esc(need.名称)} × ${c.fmt(need.数量)}${need.品质下限 ? ` · ${c.esc(need.品质下限)}以上` : ''}</b><small>持有 ${c.fmt(have)}${have >= c.num(need.数量) ? ' · 可交付' : ''}</small></div>` : ''}
        ${q.资源级别 ? `<div class="tile wide">${c.sock('flask')}<b>${c.esc(q.资源级别)}</b><small>资源级别</small></div>` : ''}
      </div></section>` : ''}
      <section class="sec"><h3>奖励<span class="en">Reward</span></h3><div class="tiles">
        <div class="tile">${c.sock('coins', 'gd')}<b>${c.ed(c.fmt(q.奖励币 || 0), [...qp, '奖励币'], { kind: 'number', integer: true, min: 0, raw: c.num(q.奖励币) })}</b><small>联邦币</small></div>
        <div class="tile">${c.sock('star', 'gd')}<b>${c.ed(c.fmt(q.奖励声望 || 0), [...qp, '奖励声望'], { kind: 'number', integer: true, raw: c.num(q.奖励声望) })}</b><small>声望</small></div>
      </div></section>
    </div>`;
  };
  // 操作：同原版按状态给出——委托待接取才可接取；任务未结束才可推进 / 提交 / 放弃；有交付需求或「可提交」时主按钮是提交
  const questActions = (c, isBoard, id, q) => {
    const st = q.状态 || (isBoard ? '待接取' : '进行中'), done = ['已完成', '已放弃', '失败', '已失败'].includes(st), del = JSON.stringify(isBoard ? ['world', '委托板', id] : c.P('我的任务', id));
    if (isBoard) return `${st === '待接取' ? `<button class="cta" type="button" data-quest-action="accept" data-quest-target="${c.esc(id)}"><i class="fa-solid fa-signature"></i>接取委托</button>` : `<span class="lbl">${c.esc(st)}</span>`}
      <button class="key-s danger" type="button" data-del-path="${c.esc(del)}"><i class="fa-solid fa-trash"></i> 删除委托</button>`;
    const submitFirst = q.交付需求 || st === '可提交';
    return `${done ? `<span class="lbl">${c.esc(st)}</span>` : `${submitFirst ? `<button class="cta" type="button" data-quest-action="submit" data-quest-target="${c.esc(id)}"><i class="fa-solid fa-box-open"></i>提交任务</button>` : `<button class="cta" type="button" data-quest-action="progress" data-quest-target="${c.esc(id)}"><i class="fa-solid fa-forward"></i>推进任务</button>`}
      <div class="q-acts">${submitFirst ? '' : `<button class="key-s" type="button" data-quest-action="submit" data-quest-target="${c.esc(id)}"><i class="fa-solid fa-box-open"></i> 提交</button>`}<button class="key-s" type="button" data-quest-action="abandon" data-quest-target="${c.esc(id)}"><i class="fa-solid fa-flag"></i> 放弃</button></div>`}
      <button class="key-s danger" type="button" data-del-path="${c.esc(del)}"><i class="fa-solid fa-trash"></i> 删除任务</button>`;
  };

  // 试炼（魂灵塔）：左翼 = 塔层阶梯（四个魂灵区，点选），主屏 = 选中魂灵区的详情与五折资格，右翼 = 冲塔 / 门票 / 兑换。
  // 分区、年限、品质档、组队限制同原项目 SOUL_TOWER_*（B:33273-33330）：共 108 层，队伍至多 7 人、30 岁以下、年龄差不超过 3 岁
  const TOWER = [
    { key: 'thousand', label: '千年魂灵区', from: 1, to: 18, age: [1000, 9999], q: ['C', 'B', 'A'], color: '#b28bff' },
    { key: 'ten_thousand', label: '万年魂灵区', from: 19, to: 36, age: [10000, 99999], q: ['B', 'A', 'S'], color: '#ff9a62' },
    { key: 'pre_beast', label: '万年以上魂灵区', from: 37, to: 99, age: [10000, 99999], q: ['A', 'S'], color: '#ff6b6b' },
    { key: 'beast', label: '凶兽魂灵区', from: 100, to: 108, age: [100000, 200000], q: ['S+'], color: '#ffd36b' },
  ];
  const TOWER_TOP = 108, TEAM = { size: 7, age: 30, gap: 3 };
  const ticketsOf = (c, re) => Object.entries(c.ch.背包 || {}).filter(([n]) => re.test(n)).reduce((s, [, it]) => s + (c.num(it?.数量) || 1), 0);
  // 升灵台：有门票才出现；不在传灵塔入口时给出原因（同原项目入场校验），多种门票时先选用哪张
  const ascend = c => {
    const p = window.COCKPIT.preview('ascension') || {}, list = Array.isArray(p.tickets) ? p.tickets : [];
    if (!list.length) return '';
    const ticket = list.includes(c.state.ui.ascTicket) ? c.state.ui.ascTicket : list[0];
    const btn = p.here
      ? `<button class="key-s" type="button" data-confirm="${c.esc(`进入升灵台（消耗 ${ticket}）`)}" data-act="${c.esc(JSON.stringify({ name: 'ascension', ticket }))}"><i class="fa-solid fa-place-of-worship"></i> 进入升灵台</button>`
      : `<span class="cta-wrap" data-hint="升灵台只能从传灵塔入口进入"><button class="key-s" type="button" disabled><i class="fa-solid fa-place-of-worship"></i> 进入升灵台</button></span>`;
    return `<section class="sec"><h3>升灵台<span class="en">Ascension</span></h3>${list.length > 1 ? `<div class="pick-row">${c.pick('ascTicket', ticket, list)}</div>` : ''}<div class="act-row">${btn}</div></section>`;
  };
  const trial = c => {
    const tower = c.ch.魂灵塔记录 || {}, top = c.num(tower.最高层), next = Math.min(TOWER_TOP, top + 1), half = tower.当前五折魂灵 || {};
    const here = TOWER.find(z => next >= z.from && next <= z.to) || TOWER[0], zone = TOWER.find(z => z.key === c.state.ui.tzone) || here;
    const tickets = ticketsOf(c, /魂灵塔门票/), hallTickets = ticketsOf(c, /升灵台门票/), ticketKey = Object.keys(c.ch.背包 || {}).find(n => /魂灵塔门票/.test(n)) || '';
    const cleared = z => Math.max(0, Math.min(z.to, top) - z.from + 1), span = z => z.to - z.from + 1;
    return {
      tag: 'CORE · TRIAL',
      left: `<div class="pad">${c.head('tower-observation', '魂灵塔', 'Spirit Tower', 'gd')}
        <div class="tower">${[...TOWER].reverse().map(z => `<button class="tz${z === zone ? ' on' : ''}${z === here ? ' cur' : ''}" type="button" data-set="tzone=${z.key}" style="--zc:${z.color};--fill:${(cleared(z) / span(z) * 100).toFixed(1)}%" aria-current="${z === zone}">
          <span class="tz-fill"></span><b>${z.label}</b><small>第 ${z.from}–${z.to} 层</small><em>${cleared(z)}/${span(z)}</em></button>`).join('')}</div>
        <div class="tower-top"><span>最高</span><b>${c.ed(c.fmt(top), c.P('魂灵塔记录', '最高层'), { kind: 'number', integer: true, min: 0, max: TOWER_TOP, raw: top })}</b><small>/ ${TOWER_TOP} 层</small></div>
      </div>`,
      core: `<div class="pad">
        <div class="q-title">${c.sock('dungeon', 'gd')}<span class="chip" style="--tint:${zone.color}">第 ${zone.from}–${zone.to} 层</span><h2>${zone.label}</h2>${zone === here ? '<span class="q-state">当前进度</span>' : top >= zone.to ? '<span class="q-state done">已通关</span>' : ''}</div>
        <div class="q-meters">
          <div class="q-meter"><div class="q-mh"><small>本区进度</small><b>${cleared(zone)} / ${span(zone)}</b><em>${zone === here ? `下一层：第 ${next} 层` : top >= zone.to ? '本区已全部击破' : `从第 ${zone.from} 层开始`}</em></div>${c.bar('mp', cleared(zone), span(zone))}</div>
          <div class="q-meter"><div class="q-mh"><small>全塔</small><b>${c.fmt(top)} / ${TOWER_TOP}</b><em>${TOWER.filter(z => top >= z.to).length} 个魂灵区已通关</em></div>${c.bar('vp', top, TOWER_TOP)}</div>
        </div>
        <section class="sec"><h3>守塔魂灵<span class="en">Guardians</span></h3><div class="tiles">
          <div class="tile">${c.sock('hourglass-half')}<b>${c.fmt(zone.age[0])}–${c.fmt(zone.age[1])} 年</b><small>年限</small></div>
          <div class="tile">${c.sock('gem')}<b>${zone.q.join(' / ')}</b><small>品质档</small></div>
        </div></section>
        <section class="sec"><h3>五折魂灵资格<span class="en">Discount</span>${c.hint('击败守塔魂灵后可选择结束冲塔、保留该魂灵的五折兑换资格。')}</h3>
          ${half.名称 ? `<div class="relic-card${half.已使用 ? ' used' : ''}">${c.sock('dragon', 'gd')}<div><strong>${c.esc(half.名称)}</strong><small>${c.esc(half.标准物种 || '')} · ${c.fmt(half.年限)} 年 · ${c.esc(half.品质 || '')} · 第 ${c.fmt(half.层数)} 层</small></div><span class="q-state${half.已使用 ? ' done' : ''}">${half.已使用 ? '已使用' : '可兑换'}</span></div>` : `<div class="tile wide dim">${c.sock('dragon')}<b>暂无</b><small>还没有保留的五折资格</small></div>`}
        </section>
      </div>`,
      right: `<div class="pad">${c.head('bolt', '行动', 'Actions')}
        <div class="tiles"><div class="tile${tickets ? '' : ' dim'}">${c.sock('ticket', 'gd')}<b>${tickets}</b><small>魂灵塔门票</small></div><div class="tile${hallTickets ? '' : ' dim'}">${c.sock('ticket')}<b>${hallTickets}</b><small>升灵台门票</small></div></div>
        <section class="sec"><h3>组队规则${c.hint(`队伍至多 ${TEAM.size} 人；成员须在 ${TEAM.age} 岁以下，年龄差不超过 ${TEAM.gap} 岁；队友须是已建档角色。`)}</h3>
          <div class="chips-row"><span class="chip s">≤ ${TEAM.size} 人</span><span class="chip s">≤ ${TEAM.age} 岁</span><span class="chip s">年龄差 ≤ ${TEAM.gap}</span></div></section>
        ${half.名称 && !half.已使用 ? '<button class="key-s" type="button" data-go="page-terminal/trade"><i class="fa-solid fa-store"></i> 去特许兑换</button>' : ''}
        ${ascend(c)}
        ${tickets ? `<button class="cta" type="button" data-trial-action="climb" data-floor="${next}" data-ticket="${c.esc(ticketKey)}"><i class="fa-solid fa-dungeon"></i>冲塔 · 第 ${next} 层</button>`
          : `<button class="cta" type="button" data-go="page-terminal/trade"><i class="fa-solid fa-ticket"></i>购买门票</button>`}
      </div>`,
    };
  };

  // 工坊：左翼 = 四种工序（及我在对应副职业的等级），主屏 = 选中工序的职业档案（等级 / 经验 / 称号）与 1–5 阶消耗、经验收益，
  // 右翼 = 当前资源与开工。配置同原项目 ProfessionUI_Module PROFESSION_CONFIG（消耗三元组依次是 体力 / 魂力 / 精神力），
  // 等级经验门槛用运行时 JobExpThresholds；开工后的选目标 / 选材料 / 天数仍是原项目工坊模块，移植时接上
  const WORK = [
    { key: 'forge', name: '锻造', job: '锻造师', icon: 'hammer', act: '开始锻造', mats: '需要材料，多选同阶材料为融锻', costs: { 1: [100, 100, 0], 2: [200, 1500, 20], 3: [500, 5000, 50], 4: [15000, 15000, 5000], 5: [80000, 80000, 18000] } },
    { key: 'manufacture', name: '机甲制造', job: '制造师', icon: 'robot', act: '开始制造', mats: '需要材料：金属、图纸、模块、回路等', costs: { 1: [20, 35, 20], 2: [160, 280, 160], 3: [700, 1225, 600], 4: [3000, 5250, 2000], 5: [16000, 28000, 7200] } },
    { key: 'design', name: '机甲设计', job: '设计师', icon: 'compass-drafting', act: '开始设计', mats: '可无材料起草；选入模板 / 旧图纸视为协同设计', costs: { 1: [5, 10, 25], 2: [20, 40, 200], 3: [80, 150, 750], 4: [300, 600, 2500], 5: [1000, 2000, 9000] } },
    { key: 'repair', name: '机甲修理', job: '修理师', icon: 'screwdriver-wrench', act: '开始修理', mats: '可选维护套件、修复包、金属或零件；不选也能纯资源抢修', costs: { 1: [5, 10, 5], 2: [40, 80, 40], 3: [175, 350, 150], 4: [750, 1500, 500], 5: [4000, 8000, 2700] } },
  ];
  const WORK_EXP = { 1: 50, 2: 400, 3: 2000, 4: 10000, 5: 50000 };
  const expSteps = () => window.COCKPIT.rt('JobExpThresholds') || [0, 1000, 5000, 12000, 60000, 80000, 400000, 500000, 3000000, 99999999];
  const workshopStatic = c => {
    const jobs = c.ch.副职业 || {}, w = WORK.find(x => x.key === c.state.ui.wtab) || WORK.find(x => jobs[x.job]) || WORK[0];
    const job = jobs[w.job], lv = c.num(job?.等级), exp = c.num(job?.经验), th = expSteps(), cur = th[Math.max(0, Math.min(lv, 10) - 1)] || 0, nxt = lv >= 10 ? 0 : th[Math.min(lv, 9)] || 0;
    const st = c.st, res = [['体力', st.体力], ['魂力', st.魂力], ['精神力', st.精神力]];
    return {
      tag: 'CORE · WORKSHOP',
      left: `<div class="pad">${c.head('industry', '工序', 'Workshop', 'gd')}
        <div class="list">${WORK.map(x => { const j = jobs[x.job]; return `<button class="row${x === w ? ' on' : ''}" type="button" data-set="wtab=${x.key}" aria-current="${x === w}">${c.sock(x.icon, j ? 'gd' : '')}<div><strong>${x.name}</strong><small>${j ? `${x.job} Lv.${c.fmt(j.等级)}` : `未习得${x.job}`}</small></div><span></span></button>`; }).join('')}</div>
      </div>`,
      core: `<div class="pad">
        <div class="q-title">${c.sock(w.icon, 'gd')}<span class="chip">${w.job}</span><h2>${w.name}工序</h2>${job ? `<span class="q-state">Lv.${c.fmt(lv)}</span>` : '<span class="q-state done">未习得</span>'}</div>
        ${job ? `<div class="q-meters">
          <div class="q-meter"><div class="q-mh"><small>经验</small><b>${c.ed(c.fmt(exp), c.P('副职业', w.job, '经验'), { kind: 'number', integer: true, min: 0, raw: exp })}</b><em>${lv >= 10 ? '已满级' : `下一级需 ${c.fmt(nxt)}`}</em></div>${c.bar('mp', Math.max(0, exp - cur), Math.max(1, (nxt || exp) - cur))}</div>
          <div class="q-meter"><div class="q-mh"><small>称号</small><b>${c.ed(c.blank(job.称号) || job.称号 === '无' ? '暂无' : job.称号, c.P('副职业', w.job, '称号'), { raw: job.称号 === '无' ? '' : job.称号 || '' })}</b><em>等级 ${c.ed(c.fmt(lv), c.P('副职业', w.job, '等级'), { kind: 'number', integer: true, min: 0, max: 10, raw: lv })} / 10</em></div></div>
        </div>` : `<div class="tile wide dim">${c.sock(w.icon)}<b>未习得${w.job}${c.hint('学会后才能开工；也可以发布委托请别人代工。')}</b><small>副职业</small></div>`}
        <section class="sec"><h3>各阶消耗<span class="en">Cost</span>${c.hint(`每次开工按目标阶位扣除体力 / 魂力 / 精神力；材料要求：${w.mats}。`)}</h3>
          <div class="cost-table" role="table"><div class="ct-row ct-head" role="row"><span>阶位</span><span>体力</span><span>魂力</span><span>精神力</span><span>经验</span></div>
          ${Object.entries(w.costs).map(([t, [a, b, d]]) => `<div class="ct-row" role="row"><span><b>${t}</b> 阶</span>${[[a, st.体力], [b, st.魂力], [d, st.精神力]].map(([v, have]) => `<span class="${c.num(have) < v ? 'short' : ''}">${c.fmt(v)}</span>`).join('')}<span>+${c.fmt(WORK_EXP[t])}</span></div>`).join('')}</div>
        </section>
      </div>`,
      right: `<div class="pad">${c.head('bolt', '开工', 'Start')}
        <div class="tiles">${res.map(([k, v]) => `<div class="tile">${c.sock({ 体力: 'person-running', 魂力: 'fire', 精神力: 'brain' }[k])}<b>${c.fmt(v)}</b><small>${k}</small></div>`).join('')}</div>
        ${(why => (btn => why ? `<span class="cta-wrap" data-hint="${c.esc(why)}">${btn}</span>` : btn)(`<button class="cta" type="button" data-work="${w.key}" data-job="${w.job}"${why ? ' disabled' : ''}><i class="fa-solid fa-${w.icon}"></i>${w.act}</button>`))(!job ? `还没有学会${w.job}` : (g => g && g.ok === false ? g.reason : '')(window.COCKPIT.preview('workshop', { mode: w.key, job: w.job })))}
      </div>`,
    };
  };

  // 情报：左翼 = 情报列表（机密 / 记录 分页），主屏 = 选中条目全文（记录可原地改、删除），右翼 = 写入新情报。
  // 机密情报来自 world.机密情报，只列出知情规则里有自己的
  const intel = c => {
    const known = (c.ch.已掌握情报 || []).map((t, i) => ({ id: 'k' + i, i, kind: '记录', text: String(t) }));
    const secret = Object.entries(c.S.world.机密情报 || {}).filter(([, s]) => (s.知情规则 || []).includes(c.name)).map(([t, s]) => ({ id: 's' + t, kind: '机密', title: t, text: String(s.内容 || ''), who: s.知情规则 || [] }));
    const tabs0 = { 全部: [...secret, ...known], 机密: secret, 记录: known };
    const tab = tabs0[c.state.ui.itab] ? c.state.ui.itab : '全部', list = tabs0[tab], sel = list.find(x => x.id === c.state.ui.isel) || list[0];
    return {
      tag: 'CORE · INTEL', wide: tabs0.全部.length ? '' : 'l', railL: `<div class="rail">${c.sock('eye')}<b>0</b><small>情报</small></div>`,
      left: `<div class="pad">${c.head('eye', '情报', 'Intel', 'gd')}
        <div class="seg q-tabs" role="tablist">${Object.entries(tabs0).map(([k, l]) => `<button class="key-s${k === tab ? ' on' : ''}" type="button" role="tab" aria-selected="${k === tab}" data-set="itab=${k}">${k}<b>${l.length}</b></button>`).join('')}</div>
        ${list.length ? `<div class="list q-list">${list.map(x => `<button class="row${x === sel ? ' on' : ''}" type="button" data-set="isel=${c.esc(x.id)}" aria-current="${x === sel}"><span class="chip${x.kind === '机密' ? ' gold' : ''}">${x.kind}</span><div><strong>${c.esc(x.title || x.text.slice(0, 18))}</strong><small>${c.esc(x.title ? x.text.slice(0, 22) : x.text.slice(18, 40) || ' ')}</small></div><span></span></button>`).join('')}</div>` : c.empty('eye', '还没有掌握任何情报', '剧情中获知的秘密会记录在这里；与自己无关的机密不会显示')}
      </div>`,
      core: sel ? `<div class="pad">
        <div class="q-title">${c.sock(sel.kind === '机密' ? 'user-secret' : 'file-lines', 'gd')}<span class="chip">${sel.kind}</span><h2>${c.esc(sel.title || '情报记录')}</h2></div>
        <section class="sec intel-body"><p class="prose">${sel.kind === '记录' ? c.ed(sel.text, c.P('已掌握情报', sel.i), { kind: 'text' }) : c.esc(sel.text)}</p></section>
        ${sel.kind === '机密' ? `<section class="sec"><h3>知情者<span class="en">Who Knows</span></h3><div class="chips-row">${sel.who.map(n => `<span class="chip s">${c.esc(n)}</span>`).join('')}</div></section>` : ''}
        ${sel.kind === '记录' ? `<button class="key-s danger" type="button" style="align-self:flex-start" data-del-path="${c.esc(JSON.stringify(c.P('已掌握情报', sel.i)))}"><i class="fa-solid fa-trash"></i> 删除这条</button>` : ''}
      </div>` : `<div class="pad sparse">${c.empty('eye', '还没有掌握任何情报')}</div>`,
      right: `<div class="pad">${c.head('pen-nib', '写入情报', 'Record')}
        <textarea class="intel-new" rows="6" placeholder="记下一条情报" aria-label="新情报"></textarea>
        <button class="cta" type="button" data-intel-add><i class="fa-solid fa-floppy-disk"></i>写入</button>
      </div>`,
    };
  };
  // 交易场所下拉：选中即切换
  document.addEventListener('picker:change', e => { if (e.detail.path !== 'venue') return; const c = window.COCKPIT.ctx(); Object.assign(c.state.ui, { venue: e.detail.value, good: '', tqty: 1 }); window.COCKPIT.refresh(); });
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-intel-add]')) return;
    const c = window.COCKPIT.ctx?.(), ta = document.querySelector('.intel-new'), t = ta?.value.trim(); if (!c || !t) { ta?.focus(); return; }
    const list = [...(Array.isArray(c.ch.已掌握情报) ? c.ch.已掌握情报 : []), t];
    Object.assign(c.state.ui, { itab: '记录', isel: 'k' + (list.length - 1) });
    ta.value = '';
    window.COCKPIT.write([{ path: c.P('已掌握情报'), value: list }]);
  });

  // 交易：左翼 = 场所（本城商店 / 拍卖行）与货品列表，主屏 = 选中货品的详情（物品定义、价格、库存、购买条件），
  // 右翼 = 结算（数量、总价、钱包）。价格按物品定义的基础价格 × 店内价格倍率估算；原项目交易模块另有批次、币种按场所、黑市，移植时接上
  // 物品定义：先查存档 物品 表，再查原项目商店货源 BaseProductPool（MVU_Schema_Runtime.js；字段是 价格 / 货币 / 分类 / 描述）
  const itemDefOf = (c, name) => {
    for (const [cat, g] of Object.entries(c.S.物品 || {})) if (g && g[name]) return [cat, g[name]];
    const pool = window.COCKPIT.rt('BaseProductPool'), p = pool && typeof pool === 'object' ? pool[name] : null;
    return p ? [p.分类 || '', { ...p, 基础价格: p.价格, 默认货币: p.货币 }] : ['', null];
  };
  // 列表里的价格按万 / 亿缩写，给货品名留出宽度；主屏与结算仍显示全额

  // ---------- 工坊（lwcs）：原项目工坊模块在桥接里常驻隐藏，这里只做表单与预览；成功率、消耗、校验、开工全由模块完成 ----------
  // 执行者：自己 / 官方工坊 / 委托在场人物；由原项目流程（NPC 委托、任务）打开时沿用那次的委托上下文（flow）
  const wsExecs = c => [['self', '自己动手'], ['official', '官方工坊'],
    ...Object.entries(c.S.char).filter(([n, x]) => n !== c.name && x?.状态?.位置 && x.状态.位置 === c.ch.状态?.位置).map(([n]) => [`npc:${n}`, `委托 ${n}`]),
    ...(c.state.ui.wsExec === 'flow' ? [['flow', '当前委托']] : [])];
  const wsSig = c => JSON.stringify([c.S.world?.时间?.tick, c.st.体力, c.st.魂力, c.st.精神力, Object.keys(c.ch.背包 || {}).join('|')]);
  const wsCall = (c, payload, after) => {
    const ui = c.state.ui; ui.wsPending = true;
    window.COCKPIT.previewAsync('workshop', payload).then(st => { ui.wsPending = false; after(st); window.COCKPIT.refresh(); });
  };
  // 需要时向桥接要模块状态：换角色 / 执行者 → 重新挂载；换工序 → 只改模式；时间、资源、背包变了 → 模块同步一次
  const wsLoad = (c, w) => {
    const ui = c.state.ui, ex = ui.wsExec || 'self', want = JSON.stringify([c.name, ex]);
    if (ui.wsPending) return;
    if (ui.wsFor !== want) {
      const flow = ex === 'flow' && ui.wsFlow === '1'; ui.wsFlow = '';
      return wsCall(c, { op: 'open', mode: w.key, job: w.job, executor: ex.startsWith('npc:') ? 'npc' : ex === 'flow' ? 'self' : ex, npc: ex.startsWith('npc:') ? ex.slice(4) : '', useFlow: flow }, st => {
        ui.wsFor = want; ui.wsSig = wsSig(c);
        if (st && st.mode) { ui.ws = st; ui.wsErr = ''; if (flow) ui.wtab = st.mode; } else { ui.ws = null; ui.wsErr = st ? st.reason || '工坊模块未就绪' : ''; }
      });
    }
    if (ui.ws && ui.ws.mode !== w.key) return wsCall(c, { op: 'set', changes: { mode: w.key } }, st => { if (st) ui.ws = st; });
    if (ui.ws && ui.wsSig !== wsSig(c)) { ui.wsSig = wsSig(c); return wsCall(c, { op: 'sync' }, st => { if (st) ui.ws = st; }); }
  };
  const wsStep = (c, key, val, min, max) => `<span class="dz-num co-qty"><button type="button" class="dz-step" data-ws="${key}=${Math.max(min, val - 1)}" aria-label="减少"><i class="fa-solid fa-minus"></i></button><b>${c.fmt(val)}</b><button type="button" class="dz-step" data-ws="${key}=${Math.min(max, val + 1)}" aria-label="增加"><i class="fa-solid fa-plus"></i></button></span>`;
  const workshop = c => {
    const ui = c.state.ui, jobs = c.ch.副职业 || {}, w = WORK.find(x => x.key === ui.wtab) || WORK.find(x => jobs[x.job]) || WORK[0];
    if (!c.rt('__LWCS_ERA_RUNTIME_INTEGRATION_V1__')) return workshopStatic(c);
    wsLoad(c, w);
    const base = workshopStatic(c), ws = ui.ws && ui.ws.mode === w.key ? ui.ws : null;
    const job = jobs[w.job], lv = c.num(job?.等级), exp = c.num(job?.经验), th = expSteps(), cur = th[Math.max(0, Math.min(lv, 10) - 1)] || 0, nxt = lv >= 10 ? 0 : th[Math.min(lv, 9)] || 0;
    const ex = ui.wsExec || 'self';
    const left = base.left.replace(/<\/div>\s*$/, `<span class="lbl">执行者${c.hint('委托在场人物或官方工坊代工时，不扣你的副职业资源，按委托规则收费')}</span><div class="pick-row">${c.pick('wsExec', ex, wsExecs(c).map(([v, l]) => ({ value: v, label: l })))}</div></div>`);
    const meters = job ? `<div class="q-meters"><div class="q-meter"><div class="q-mh"><small>经验</small><b>${c.fmt(exp)}</b><em>${lv >= 10 ? '已满级' : `下一级需 ${c.fmt(nxt)}`}</em></div>${c.bar('mp', Math.max(0, exp - cur), Math.max(1, (nxt || exp) - cur))}</div><div class="q-meter"><div class="q-mh"><small>称号</small><b>${c.esc(c.blank(job.称号) || job.称号 === '无' ? '暂无' : job.称号)}</b><em>等级 ${c.fmt(lv)} / 10</em></div></div></div>` : '';
    const head = `<div class="q-title">${c.sock(w.icon, 'gd')}<span class="chip">${w.job}</span><h2>${c.esc(ws?.title || `${w.name}工序`)}</h2>${job ? `<span class="q-state">Lv.${c.fmt(lv)}</span>` : '<span class="q-state done">未习得</span>'}</div>`;
    if (!ws) return { ...base, left, core: `<div class="pad">${head}${meters}<div class="warn" style="color:var(--ink2);background:rgba(47,124,246,.1);box-shadow:inset 2px 0 0 var(--blue)"><i class="fa-solid fa-gear"></i><span>${ui.wsErr ? c.esc(ui.wsErr) : '正在准备工坊'}</span></div></div>`,
      right: `<div class="pad">${c.head('bolt', '开工', 'Start')}<span class="cta-wrap" data-hint="${c.esc(ui.wsErr || '工坊准备中')}"><button class="cta" type="button" disabled><i class="fa-solid fa-${w.icon}"></i>${w.act}</button></span></div>` };
    const mats = ws.materials.map(m => `<button type="button" class="dz-chip${m.checked ? ' on' : ''}" data-ws-mat="${c.esc(m.value)}"${m.disabled ? ' disabled' : ''} aria-pressed="${m.checked}">${c.esc(m.label)}</button>`).join('');
    const form = `<section class="sec"><h3>工序设置<span class="en">Process</span>${c.hint(ws.subtitle)}</h3><div class="dz2-grid ws-form">
        <div class="dzf"><span class="dzf-l">${c.esc(ws.tierLabel || '阶位')}</span>${c.pick('wsTier', ws.tier, ws.tiers.map(t => ({ value: t.value, label: t.disabled ? `${t.label}（不可用）` : t.label })), { disabled: ws.tierDisabled })}</div>
        <div class="dzf"><span class="dzf-l">${c.esc(ws.qtyLabel || '数量')}${c.hint(ws.qtyHint)}</span>${ws.qtyDisabled ? `<b>${c.fmt(ws.qty)}</b>` : wsStep(c, 'qty', ws.qty, 1, 999)}</div>
        <div class="dzf"><span class="dzf-l">连续模式${c.hint('连续多天开工，按每天恢复情况自动安排次数')}</span><div class="seg"><button class="key-s${ws.loop ? '' : ' on'}" type="button" data-ws="loop=0">单次</button><button class="key-s${ws.loop ? ' on' : ''}" type="button" data-ws="loop=1">连续</button></div></div>
        ${ws.loop ? `<div class="dzf"><span class="dzf-l">连续天数</span>${wsStep(c, 'days', ws.days, 1, 365)}</div>` : ''}
        <div class="dzf wide"><span class="dzf-l">${c.esc(ws.targetLabel || '目标物')}${c.hint(ws.targetHint)}</span><div class="ws-target"><input type="text" data-ws-target value="${c.esc(ws.target)}" placeholder="自动生成或手动输入" aria-label="${c.esc(ws.targetLabel || '目标物')}"><button class="key-s" type="button" data-ws="autoName=1"><i class="fa-solid fa-wand-magic-sparkles"></i> 自动命名</button></div></div>
        <div class="dzf wide"><span class="dzf-l">${c.esc(ws.materialsLabel || '材料')}${c.hint(ws.materialsHint)}</span>${mats ? `<div class="dz-chips">${mats}</div>` : '<span class="lbl">背包里没有这道工序能用的材料</span>'}</div>
      </div></section>`;
    const target = ws.target ? `「${ws.target}」` : '';
    const cta = ws.submitDisabled ? `<span class="cta-wrap" data-hint="${c.esc(ws.warning || '现在不能开工')}"><button class="cta" type="button" disabled><i class="fa-solid fa-${w.icon}"></i>${c.esc(ws.submitLabel)}</button></span>`
      : `<button class="cta" type="button" data-confirm="${c.esc(`${ws.submitLabel}${target}`)}" data-act='{"name":"workshop","op":"start"}'><i class="fa-solid fa-${w.icon}"></i>${c.esc(ws.submitLabel)}</button>`;
    return {
      tag: 'CORE · WORKSHOP', left,
      core: `<div class="pad">${head}${meters}${form}</div>`,
      right: `<div class="pad">${c.head('bolt', '开工', 'Start')}${ws.preview.length ? c.kv(ws.preview.map(([k, v]) => [k, c.esc(v)])) : ''}${ws.warning ? `<div class="warn"><i class="fa-solid fa-triangle-exclamation"></i><span>${c.esc(ws.warning)}</span></div>` : ''}${cta}</div>`,
    };
  };
  // 工坊表单 → 模块
  const wsSet = changes => { const c = window.COCKPIT.ctx(); wsCall(c, { op: 'set', changes }, st => { if (st) c.state.ui.ws = st; }); };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-ws]');
    if (b) { const [k, v] = b.dataset.ws.split('='); return wsSet(k === 'loop' ? { loop: v === '1' } : k === 'autoName' ? { autoName: true } : { [k]: Number(v) }); }
    const m = e.target.closest('[data-ws-mat]'); if (!m || m.disabled) return;
    const ws = window.COCKPIT.ctx().state.ui.ws; if (!ws) return;
    const on = new Set(ws.materials.filter(x => x.checked).map(x => x.value));
    on.has(m.dataset.wsMat) ? on.delete(m.dataset.wsMat) : on.add(m.dataset.wsMat);
    wsSet({ materials: [...on] });
  });
  document.addEventListener('change', e => { const t = e.target.closest?.('[data-ws-target]'); if (t) wsSet({ target: t.value }); });
  document.addEventListener('picker:change', e => {
    if (e.detail.path === 'wsTier') return wsSet({ tier: e.detail.value });
    if (e.detail.path === 'wsExec') { const c = window.COCKPIT.ctx(); Object.assign(c.state.ui, { wsExec: e.detail.value, wsFor: '' }); window.COCKPIT.refresh(); }
  });
  // 原项目流程打开交易网络（NPC「交易」、模块意图）：预选私下交易对象 / 黑市店 / 商店与物品
  window.COCKPIT.addRoute?.('trade', spec => {
    const c = window.COCKPIT.ctx();
    const venue = spec.black && spec.store ? 'black:' + spec.store : spec.npc ? 'npc:' + spec.npc : spec.store ? 'shop:' + spec.store : '';
    Object.assign(c.state.ui, { venue, good: spec.item || '', tqty: 1 });
    window.COCKPIT.go('page-terminal', 'trade');
    return true;
  });
  // 原项目流程（NPC 委托、任务、模块意图）打开工坊：沿用那次的委托上下文
  window.COCKPIT.addRoute?.('workshop', () => { const c = window.COCKPIT.ctx(); Object.assign(c.state.ui, { wsExec: 'flow', wsFlow: '1', wsFor: '' }); window.COCKPIT.go('page-terminal', 'workshop'); return true; });

  const shortNum = (c, n) => n >= 1e8 ? `${+(n / 1e8).toFixed(2)}亿` : n >= 1e4 ? `${+(n / 1e4).toFixed(1)}万` : c.fmt(n);

  // ---------- 私下交易 / 黑市（lwcs）：原项目交易模块常驻隐藏（私下页签），这里只做选择与显示 ----------
  const tpWant = (c, v) => JSON.stringify([c.name, c.ch.状态?.位置, v ? v.kind : 'base', v ? (v.npc || v.store) : '']);
  const tpCall = (c, payload, after) => { const ui = c.state.ui; ui.tpPending = true; window.COCKPIT.previewAsync('privateTrade', payload).then(st => { ui.tpPending = false; after(st); window.COCKPIT.refresh(); }); };
  // 进交易页先挂一次（拿模块额外加入的商店，如特许兑换）；进私下 / 黑市场所时按对象重挂
  const tpLoad = (c, v) => {
    const ui = c.state.ui, want = tpWant(c, v);
    if (ui.tpPending || ui.tpFor === want || !c.rt('__LWCS_ERA_RUNTIME_INTEGRATION_V1__')) return;
    tpCall(c, { op: 'open', mode: v?.kind === 'black' ? 'black' : 'npc', npc: v?.npc || '', store: v?.store || '' }, st => { ui.tpFor = want; ui.tpReq = ''; ui.tps = st && st.key ? st : null; ui.tpErr = st && !st.key ? st.reason || '交易模块未就绪' : ''; });
  };
  const tradePrivate = (c, v, venues) => {
    const ui = c.state.ui, act = ui.tpAct === '私下卖出' ? '私下卖出' : '私下买入', city = c.S.world.地点?.[String(c.ch.状态?.位置 || '').split('-').filter(x => x && x !== '斗罗大陆')[0]] || {};
    tpLoad(c, v);
    const pool = act === '私下卖出' ? c.ch.背包 : v.kind === 'black' ? city.商店?.[v.store]?.库存 : c.S.char?.[v.npc]?.背包;
    const goods = Object.entries(pool || {}).map(([n, x]) => ({ id: n, name: n, stock: c.num(x?.库存 ?? x?.数量) || (x?.批次 || []).reduce((s2, b) => s2 + c.num(b.数量), 0), rate: x?.价格倍率 }));
    const g = goods.find(x => x.id === ui.good) || goods[0], [cat, def] = g ? itemDefOf(c, g.name) : ['', null];
    const qty = Math.max(1, Math.min(c.num(g?.stock) || 99, c.num(ui.tqty) || 1));
    const base = g ? Math.max(1, Math.round(c.num(def?.基础价格) * (g.rate ?? 1)) || 1) : 1;
    const [pFor, pAmt] = String(ui.tpPrice || '').split('|'), price = g && pFor === g.id && c.num(pAmt) > 0 ? c.num(pAmt) : base, step = Math.max(1, Math.ceil(price * .05));
    // 只在请求的参数变了时同步给模块（模块可能修正数值，别来回打架）
    const req = JSON.stringify([act, g?.name || '', qty, price]);
    if (ui.tps && !ui.tpPending && ui.tpFor === tpWant(c, v) && ui.tpReq !== req) { ui.tpReq = req; tpCall(c, { op: 'set', changes: { action: act, item: g?.name || '', qty, price } }, st => { if (st) ui.tps = st; }); }
    const tp = ui.tps && ui.tpFor === tpWant(c, v) ? ui.tps : null, who = v.kind === 'black' ? v.store : v.npc;
    const blocked = !g ? '这里没有可交易的物品' : !tp ? (ui.tpErr || '正在准备交易') : tp.blocked ? (tp.reason || tp.attitude || '现在不能成交') : '';
    const verb = act === '私下买入' ? '求购' : '推销';
    return {
      tag: 'CORE · MARKET',
      left: `<div class="pad">${c.head('scale-balanced', '交易', 'Market', 'gd')}
        <div class="venue-pick">${c.pick('venue', v.id, venues.map(x => ({ value: x.id, label: x.name, group: x.group || (x.id.startsWith('shop:') ? '本城商店' : '其他') })))}</div>
        <div class="seg"><button class="key-s${act === '私下买入' ? ' on' : ''}" type="button" data-set="tpAct=私下买入">求购${c.hint(v.kind === 'black' ? '从黑市渠道买入' : `向${who}求购对方持有的物品`)}</button><button class="key-s${act === '私下卖出' ? ' on' : ''}" type="button" data-set="tpAct=私下卖出">推销${c.hint('把自己背包里的物品卖给对方')}</button></div>
        ${goods.length ? `<div class="list q-list">${goods.map(x => `<button class="row${x === g ? ' on' : ''}" type="button" data-set="good=${c.esc(x.id)}" aria-current="${x === g}">${c.sock(v.icon)}<div><strong>${c.esc(x.name)}</strong><small>${act === '私下买入' ? (v.kind === 'black' ? '库存' : '对方持有') : '持有'} ${c.fmt(x.stock)}</small></div><span></span></button>`).join('')}</div>` : c.empty('box-open', act === '私下买入' ? `${who}没有可交易的物品` : '背包是空的')}
      </div>`,
      core: g ? `<div class="pad">
        <div class="q-title">${c.sock(v.icon, 'gd')}<span class="chip">${c.esc(def?.品质 || cat || '物品')}</span><h2>${c.esc(g.name)}</h2><span class="q-state">${c.esc(`${verb} · ${who}`)}</span></div>
        <section class="sec"><h3>物品说明<span class="en">Item</span></h3><p class="prose">${c.esc(def?.描述 || '没有收录这件物品的说明')}</p></section>
        ${tp ? `<section class="sec"><h3>行情<span class="en">Quote</span></h3>${c.kv([['基础价', c.esc(tp.basePrice || '—')], ['市场调整', c.esc(tp.market || '—')], ['成交把握', `<span class="${tp.attitudeOk ? '' : 'warn-t'}">${c.esc(tp.attitude || '—')}</span>`]])}</section>` : ''}
      </div>` : `<div class="pad sparse">${c.empty('handshake', '选一件物品')}</div>`,
      right: `<div class="pad">${c.head('handshake', v.kind === 'black' ? '黑市' : '私下交易', 'Deal')}
        ${g ? `<div class="checkout">
          <div class="co-row"><span>数量</span><span class="dz-num co-qty"><button type="button" class="dz-step" data-set="tqty=${Math.max(1, qty - 1)}" aria-label="减少"><i class="fa-solid fa-minus"></i></button><b>${qty}</b><button type="button" class="dz-step" data-set="tqty=${qty + 1}" aria-label="增加"><i class="fa-solid fa-plus"></i></button></span></div>
          <div class="co-row"><span>出价 / 件${c.hint('每步加减 5%；出价越贴近市场价越容易成交')}</span><span class="dz-num co-qty"><button type="button" class="dz-step" data-set="tpPrice=${c.esc(g.id)}|${Math.max(1, price - step)}" aria-label="降低出价"><i class="fa-solid fa-minus"></i></button><b>${c.fmt(price)}</b><button type="button" class="dz-step" data-set="tpPrice=${c.esc(g.id)}|${price + step}" aria-label="提高出价"><i class="fa-solid fa-plus"></i></button></span></div>
          <div class="co-row total"><span>${act === '私下买入' ? '合计支付' : '合计收入'}</span><b>${c.esc(tp?.total || c.fmt(price * qty))}</b></div>
        </div>
        ${blocked ? `<span class="cta-wrap" data-hint="${c.esc(blocked)}"><button class="cta" type="button" disabled><i class="fa-solid fa-handshake"></i>${verb}</button></span>`
          : `<button class="cta" type="button" data-confirm="${c.esc(`${verb}「${g.name}」×${qty}，出价 ${c.fmt(price)} / 件`)}" data-act='{"name":"trade","op":"private"}'><i class="fa-solid fa-handshake"></i>${verb}</button>`}` : ''}
      </div>`,
    };
  };
  const trade = c => {
    const ui = c.state.ui, p = String(c.ch.状态?.位置 || '').split('-').filter(x => x && x !== '斗罗大陆');
    const city = c.S.world.地点?.[p[0]] || {}, shops = Object.entries(city.商店 || {}), auction = c.S.world.拍卖 || {}, coins = c.ch.财富 || {};
    // 商店列表（含特许兑换）取自任一已挂的交易会话；同一地点只在还没有会话时挂一次基础会话（私下场所有自己的会话，别来回重挂）
    if (!/^(npc|black):/.test(String(ui.venue || '')) && (!ui.tps || JSON.parse(ui.tpFor || '[]')[1] !== c.ch.状态?.位置)) tpLoad(c, null);
    // 本城商店 + 交易模块额外加入的商店（魂灵塔特许兑换）；黑市店单列；在场人物可私下交易
    const extra = Object.entries(ui.tps?.storeGoods || {}).filter(([n]) => !(city.商店 || {})[n]).map(([n, goods]) => [n, { 库存: goods }]);
    const locals = Object.entries(c.S.char || {}).filter(([n, x]) => n !== c.name && x?.状态?.位置 && x.状态.位置 === c.ch.状态?.位置).map(([n]) => n);
    const venues = [...[...shops.filter(([n]) => !/黑市/.test(n)), ...extra].map(([n, s]) => ({ id: 'shop:' + n, name: n.replace('分店', ''), icon: 'store', goods: Object.entries(s.库存 || {}).map(([g, x]) => ({ id: g, name: g, stock: x.库存, rate: x.价格倍率 ?? 1, rep: x.需求声望, req: x.需求 })) })),
      ...shops.filter(([n]) => /黑市/.test(n)).map(([n]) => ({ id: 'black:' + n, kind: 'black', store: n, name: n, icon: 'mask', group: '黑市' })),
      ...locals.map(n => ({ id: 'npc:' + n, kind: 'private', npc: n, name: n, icon: 'handshake', group: '私下交易' })),
      ...(Object.keys(auction.拍品 || {}).length ? [{ id: 'auction', name: '拍卖行', icon: 'gavel', goods: Object.entries(auction.拍品).map(([g, a]) => ({ id: g, name: g, price: a.价格, grade: a.品级, cat: a.分类, story: a.背景 })) }] : []),
      // 出售：背包里的物品，价格先按定义基础价格作参考（原项目出售另按批次品质折算）
      { id: 'sell', name: '出售', icon: 'hand-holding-dollar', sell: true, goods: Object.entries(c.ch.背包 || {}).map(([g, r]) => ({ id: g, name: g, stock: c.num(r?.数量) || (r?.批次 || []).reduce((s, b) => s + c.num(b.数量), 0) || 1 })) }];
    const v = venues.find(x => x.id === ui.venue) || venues[0];
    if (v?.kind) return tradePrivate(c, v, venues);
    const goods = v?.goods || [], g = goods.find(x => x.id === ui.good) || goods[0];
    const [cat, def] = g ? itemDefOf(c, g.name) : ['', null], unit = g ? Math.round(g.price ?? c.num(def?.基础价格) * (g.rate ?? 1)) : 0, cur = def?.默认货币 || '联邦币';
    const isBid = v?.id === 'auction', minBid = Math.ceil(unit * 1.05), [bidFor, bidAmt] = String(ui.tbid || '').split('|'), bid = isBid ? Math.max(minBid, bidFor === g?.id ? c.num(bidAmt) : 0) : 0, bidStep = Math.max(1, Math.ceil(unit * .05));
    const qty = isBid ? 1 : Math.max(1, Math.min(c.num(g?.stock) || 99, c.num(ui.tqty) || 1)), total = isBid ? bid : unit * qty, have = c.num(coins[cur]);
    const myFac = g?.req?.势力 ? c.ch.社交?.势力?.[g.req.势力] : null;
    // 世界规则门槛（原项目交易模块同一判定）：在不在有商业 / 拍卖设施的地点、营业与否
    const gate = g ? window.COCKPIT.preview('trade', { 动作: v.sell ? '出售' : isBid ? '竞拍' : '购买', 目标: v.id.startsWith('shop:') ? v.id.slice(5) : '' }) : null;
    const block = !g ? '' : gate && gate.ok === false ? gate.reason : v.sell ? '' : have < total ? `${cur}不足` : g.rep && c.num(c.ch.社交?.声望) < g.rep ? `声望不足：需要 ${c.fmt(g.rep)}`
      : g.req?.势力 && (!myFac || ((g.req.阶级 || []).length && !g.req.阶级.includes(myFac.身份))) ? `需要${g.req.势力}${(g.req.阶级 || []).length ? g.req.阶级.join('、') : '成员'}身份` : '';
    return {
      tag: 'CORE · MARKET',
      left: `<div class="pad">${c.head('scale-balanced', '交易', 'Market', 'gd')}
        <div class="venue-pick">${c.pick('venue', v?.id || '', venues.map(x => ({ value: x.id, label: x.name, group: x.group || (x.id.startsWith('shop:') ? '本城商店' : '其他') })))}</div>
        ${goods.length ? `<div class="list q-list">${goods.map(x => `<button class="row${x === g ? ' on' : ''}" type="button" data-set="good=${c.esc(x.id)}" aria-current="${x === g}">${(q => q ? `<span class="chip">${c.esc(q)}</span>` : c.sock(v.icon))(x.grade || itemDefOf(c, x.name)[1]?.品质)}<div><strong>${c.esc(x.name)}</strong><small>${c.esc([x.cat || itemDefOf(c, x.name)[0], x.stock !== undefined ? `库存 ${c.fmt(x.stock)}` : ''].filter(Boolean).join(' · '))}</small></div><span class="end">${shortNum(c, Math.round(x.price ?? c.num(itemDefOf(c, x.name)[1]?.基础价格) * (x.rate ?? 1)))}</span></button>`).join('')}</div>` : c.empty('store', v ? '这里暂时没有货' : `${p[0] || '当地'}没有商店`)}
      </div>`,
      core: g ? `<div class="pad">
        <div class="q-title">${c.sock(v.icon, 'gd')}<span class="chip">${c.esc(g.grade || def?.品质 || cat || '货品')}</span><h2>${c.esc(g.name)}</h2><span class="q-state">${c.esc(v.name)}</span></div>
        ${(from => from ? `<div class="q-from">${c.esc(from)}</div>` : '')([cat || g.cat, def?.装备槽位 && def.装备槽位 !== '无' ? `${def.装备槽位}装备` : ''].filter(x => x && x !== (g.grade || def?.品质 || cat)).join(' · '))}
        <section class="sec"><h3>${v.id === 'auction' ? '拍品背景' : '物品说明'}<span class="en">Item</span></h3><p class="prose">${c.esc(v.id === 'auction' ? String(g.story || '').replace(/^[^：]*：/, '') : def?.描述 || '没有收录这件物品的说明')}</p></section>
        ${Array.isArray(def?.使用效果) && def.使用效果.length ? `<section class="sec"><h3>使用效果<span class="en">Effect</span></h3><div class="chips-row">${def.使用效果.map(x => `<span class="chip s">${c.esc([x.目标 && x.目标 !== '自身' ? x.目标 : '', x.资源 || x.属性 || x.状态 || x.原型, x.数值 || ''].filter(Boolean).join(' '))}</span>`).join('')}</div></section>` : ''}
        <section class="sec"><h3>价格<span class="en">Price</span></h3><div class="tiles">
          <div class="tile">${c.sock('coins', 'gd')}<b>${c.fmt(unit)}</b><small>${cur} / 件</small></div>
          ${g.rate !== undefined && g.rate !== 1 ? `<div class="tile">${c.sock('percent')}<b>×${c.fmt(g.rate)}</b><small>本店价格倍率</small></div>` : ''}
          ${g.stock !== undefined ? `<div class="tile">${c.sock('boxes-stacked')}<b>${c.fmt(g.stock)}</b><small>库存</small></div>` : ''}
        </div></section>
        ${g.rep || g.req?.势力 ? `<section class="sec"><h3>购买条件<span class="en">Requirement</span></h3><div class="tiles">
          ${g.rep ? `<div class="tile${c.num(c.ch.社交?.声望) >= g.rep ? '' : ' dim'}">${c.sock('star')}<b>声望 ${c.fmt(g.rep)}</b><small>当前 ${c.fmt(c.ch.社交?.声望 || 0)}</small></div>` : ''}
          ${g.req?.势力 ? `<div class="tile">${c.sock('flag')}<b>${c.esc(g.req.势力)}</b><small>${c.esc((g.req.阶级 || []).join('、') || '成员')}</small></div>` : ''}
        </div></section>` : ''}
      </div>` : `<div class="pad sparse">${c.empty('scale-balanced', '选一件货品查看')}</div>`,
      right: `<div class="pad">${c.head('receipt', '结算', 'Checkout')}
        <div class="tiles wallet">${(window.COCKPIT.eraCoins || [['联邦币', '联邦币']]).map(([k, l]) => `<div class="tile${k === cur ? '' : ' dim'}">${c.sock('coins', k === cur ? 'gd' : '')}<b>${c.fmt(coins[k] || 0)}</b><small>${l}</small></div>`).join('')}</div>
        ${g ? `<div class="checkout">
          ${isBid ? `<div class="co-row"><span>出价${c.hint('必须高于当前价；每步加减当前价的 5%。')}</span><span class="dz-num co-qty"><button type="button" class="dz-step" data-set="tbid=${c.esc(g.id)}|${Math.max(minBid, bid - bidStep)}" aria-label="降低出价"><i class="fa-solid fa-minus"></i></button><b>${c.fmt(bid)}</b><button type="button" class="dz-step" data-set="tbid=${c.esc(g.id)}|${bid + bidStep}" aria-label="提高出价"><i class="fa-solid fa-plus"></i></button></span></div>`
            : `<div class="co-row"><span>数量</span><span class="dz-num co-qty"><button type="button" class="dz-step" data-set="tqty=${Math.max(1, qty - 1)}" aria-label="减少"><i class="fa-solid fa-minus"></i></button><b>${qty}</b><button type="button" class="dz-step" data-set="tqty=${qty + 1}" aria-label="增加"><i class="fa-solid fa-plus"></i></button></span></div>`}
          <div class="co-row total"><span>${v.sell ? '参考收入' : '合计'}</span><b class="${!v.sell && have < total ? 'warn-t' : ''}">${c.fmt(total)} ${cur}</b></div>
        </div>
        ${v.sell ? (btn => block ? `<span class="cta-wrap" data-hint="${c.esc(block)}">${btn}</span>` : btn)(`<button class="cta" type="button" data-sell="${c.esc(g.name)}" data-qty="${qty}"${block ? ' disabled' : ''}><i class="fa-solid fa-hand-holding-dollar"></i>出售</button>`) : (btn => block ? `<span class="cta-wrap" data-hint="${c.esc(block)}">${btn}</span>` : btn)(`<button class="cta" type="button" data-buy="${c.esc(g.name)}" data-store="${c.esc(v.id.startsWith('shop:') ? v.id.slice(5) : '')}" data-qty="${qty}" data-price="${isBid ? bid : unit}"${isBid ? ' data-auction="1"' : ''}${block ? ' disabled' : ''}><i class="fa-solid fa-cart-shopping"></i>${v.id === 'auction' ? '出价竞拍' : '确认购买'}</button>`)}` : ''}
      </div>`,
    };
  };

  // 设置：只放原项目里真实生效的选项，按用途分组。AI 维护已按用户决定移除——它的「模型接口」（选 AI 维护调用哪个 API 预设）一并去掉；
  // 角色目录 / 头像入口与别处重复，不再放这里。冷归档只在标准 ST 下工作（原项目 当前启用标准ST冷归档_桥接，TauriTavern 下全部返回
  // tt_cold_archive_disabled，冷实体激活保护同样停用），本卡跑在 TauriTavern，整组不放。原型存本机 localStorage，移植时对接原项目各自的存储键。
  const SET_KEY = 'lwcs-cockpit-settings';
  const readSet = () => { try { return JSON.parse(localStorage.getItem(SET_KEY) || '{}'); } catch (e) { return {}; } };
// 每个选项：[值, 图标, 悬停说明]；设置项图标
  const SET_ICON = { motion: 'wand-magic-sparkles', hover: 'arrow-pointer', scan: 'bullseye', battle: 'khanda' };
  const SET_OPTS = {
    motion: [['标准', 'wand-magic-sparkles'], ['柔和', 'feather'], ['关闭', 'ban']],
    hover: [['快', 'bolt'], ['标准', 'arrow-pointer'], ['慢', 'hourglass-half']],
    scan: [['开启', 'bullseye'], ['关闭', 'circle']],
    battle: [['自动', 'robot', 'AI 代为出手'], ['手动', 'hand', '每回合自己选'], ['自由', 'feather-pointed', '只叙事不结算']],
  };
  const SET_GROUPS = [
    ['显示', 'palette', [
      ['motion', '动效强度', '页面切换、魂环旋转与浮窗动画；「关闭」等同系统减少动态效果。', ['标准', '柔和', '关闭'], '标准'],
    ]],
    ['交互', 'hand-pointer', [
      ['hover', '悬停浮窗', '鼠标停留多久后浮出详情。', ['快', '标准', '慢'], '标准'],
      ['scan', '魂环扫描', '在武魂卡上移动即逐圈选中魂环，不必瞄准环线。', ['开启', '关闭'], '开启'],
    ]],
    ['战斗', 'khanda', [
      ['battle', '代理模式', '自动：AI 代为出手；手动：每回合自己选；自由：只叙事不结算。', ['自动', '手动', '自由'], '手动'],
    ]],
  ];
  try { const m = JSON.parse(localStorage.getItem('lwcs-cockpit-settings') || '{}').motion; if (m) document.querySelector('.cockpit').dataset.motion = m; } catch (e) {}
  // 战斗代理模式存在原项目（BattleUIBridge，存储键 lwcs_battle_submit_mode），座舱只做中文显示映射
  const BATTLE_MODE = { 自动: 'auto', 手动: 'manual', 自由: 'free_narrative' };
  const battleBridge = () => window.COCKPIT.rt('BattleUIBridge');
  const settings = c => {
    const v = readSet();
    { const m = battleBridge()?.getBattleSubmitMode?.(); const zh = Object.keys(BATTLE_MODE).find(k => BATTLE_MODE[k] === m); if (zh) v.battle = zh; }
    // 设置项做成整块面板（2×2 铺满）：头部是分组 + 名称，下面是一排游戏化选项键（同首页日常行动键）
    const tile = (g, [k, l, d, , def]) => `<section class="set-tile"><header>${c.sock(SET_ICON[k], 'gd')}<div><small>${g}</small><strong>${l}${c.hint(d)}</strong></div></header>
      <div class="opts set-opts" data-setting-group="${k}" style="--n:${SET_OPTS[k].length}">${SET_OPTS[k].map(([o, ic, h]) => `<button class="opt ${(v[k] || def) === o ? 'on' : ''}" type="button" data-setting="${k}=${o}" aria-pressed="${(v[k] || def) === o}"${h ? ` data-hint="${h}"` : ''}><i class="fa-solid fa-${ic}"></i>${o}</button>`).join('')}</div></section>`;
    return {
      tag: 'CORE · SYSTEM', wide: 'both',
      core: `<div class="pad">
        ${c.head('sliders', '设置', 'Settings', 'gd', c.hint('设置保存在本机，只影响这台设备。'))}
        <div class="set-tiles">${SET_GROUPS.flatMap(([g, , rows]) => rows.map(r => tile(g, r))).join('')}</div>
      </div>`,
      railL: `<div class="rail">${c.sock('sliders', 'gd')}<small>设置</small></div>`,
      // 运行环境：原型按本卡目标环境（TauriTavern）显示；移植时换成原项目 当前为TauriTavern环境_桥接()
      railR: `<div class="rail">${c.sock('circle-info')}<small>TauriTavern</small></div>`,
    };
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-setting]'); if (!b) return;
    const [k, val] = b.dataset.setting.split('='), v = readSet(); v[k] = val;
    try { localStorage.setItem(SET_KEY, JSON.stringify(v)); } catch (err) {}
    b.closest('[data-setting-group]')?.querySelectorAll('[data-setting]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
    if (k === 'motion') document.querySelector('.cockpit').dataset.motion = val;
    if (k === 'battle') battleBridge()?.setBattleSubmitMode?.(BATTLE_MODE[val]);
  });

  // 行动按钮：捕获阶段写好确认文案与动作规格（data-act），确认后由座舱交给原项目执行——
  // 任务走 buildQuestDispatchRequest + 叙事请求；冲塔走试炼入场（map-action-dispatch）；买卖 / 竞拍走交易模块的校验与结算；
  // 工坊不确认，直接打开原项目工坊（选目标 / 材料 / 天数在那里完成）
  const QUEST_VERB = { accept: '接取委托', progress: '推进任务', submit: '提交任务', abandon: '放弃任务' };
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-quest-action],[data-trial-action],[data-work],[data-buy],[data-sell]'); if (!t || t.disabled) return;
    if (t.dataset.work) { delete t.dataset.confirm; t.dataset.act = JSON.stringify({ name: 'workshop', mode: t.dataset.work, job: t.dataset.job || '' }); return; }
    const total = t.closest('.pad')?.querySelector('.co-row.total b')?.textContent || '', qty = Number(t.dataset.qty) || 1;
    const spec = t.dataset.questAction ? { name: 'quest', kind: t.dataset.questAction, quest: t.dataset.questTarget || '' }
      : t.dataset.trialAction ? { name: 'tower', floor: Number(t.dataset.floor) || 1, ticket: t.dataset.ticket || '' }
      : t.dataset.buy ? { name: 'trade', 动作: t.dataset.auction ? '竞拍' : '购买', 目标: t.dataset.store || '', 物品: t.dataset.buy, 数量: qty, 价格: Number(t.dataset.price) || 0 }
      : { name: 'trade', 动作: '出售', 物品: t.dataset.sell, 数量: qty };
    t.dataset.act = JSON.stringify(spec);
    t.dataset.confirm = spec.name === 'quest' ? `${QUEST_VERB[spec.kind] || '处理任务'}「${spec.quest}」`
      : spec.name === 'tower' ? `挑战魂灵塔第 ${spec.floor} 层（消耗 ${spec.ticket || '门票'}）`
      : spec.动作 === '竞拍' ? `出价 ${total} 竞拍 ${spec.物品}`
      : spec.动作 === '购买' ? `购买 ${spec.物品} ×${qty}，共 ${total}`
      : `出售 ${spec.物品} ×${qty}，参考收入 ${total}`;
  }, true);

  window.COCKPIT.register('page-terminal', {
    label: '事务', icon: 'clipboard-list', tag: 'CORE · AFFAIRS',
    keys: [
      { id: 'quests', icon: 'clipboard-list', label: '任务', view: quests },
      { id: 'trial', icon: 'tower-observation', label: '试炼', view: trial, brief: c => `塔 ${c.num(c.ch.魂灵塔记录?.最高层)} 层` },
      { id: 'workshop', icon: 'hammer', label: '工坊', view: workshop, brief: c => { const n = Object.keys(c.ch.副职业 || {}).length; return n ? `${n} 项副职` : '未习副职'; } },
      { id: 'intel', icon: 'eye', label: '情报', view: intel, brief: c => `${(c.ch.已掌握情报 || []).length + Object.values(c.S.world.机密情报 || {}).filter(s => (s.知情规则 || []).includes(c.name)).length} 条` },
      { id: 'trade', icon: 'scale-balanced', label: '交易', view: trade, brief: c => { const p = String(c.ch.状态?.位置 || '').split('-').filter(x => x && x !== '斗罗大陆'); const n = Object.keys(c.S.world.地点?.[p[0]]?.商店 || {}).length; return n ? `${n} 家商店` : '无商店'; } },
      { id: 'settings', icon: 'sliders', label: '设置', view: settings },
    ],
  });
})();

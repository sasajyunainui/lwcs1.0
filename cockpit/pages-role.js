/* 角色领域：总览 · 档案 · 成长 · 关系 · 身份 · 权限 · 目录（私密档案不在导航中，见 canOpenPrivateArchive 注释） */
(() => {
  const WOUND_PARTS = ['头部', '躯干', '左臂', '右臂', '左腿', '右腿'];
  const avatarBlock = c => {
    const src = c.avatarSrc(c.name);
    return `<div class="ava"><span class="ring1 oct"></span><span class="ring2 oct"></span>
      <div class="face-img oct">${src ? `<img src="${c.esc(src)}" alt="${c.esc(c.name)}头像">` : `<span class="mono">${c.esc(c.name.slice(1, 2) || c.name[0])}</span>`}</div>
      <label class="upload" title="上传头像"><i class="fa-solid fa-camera"></i><input type="file" accept="image/*" class="ava-file" data-name="${c.esc(c.name)}" aria-label="上传${c.esc(c.name)}的头像"></label></div>`;
  };
  const growthOf = c => {
    // 本级起点与下一级所需魂力：原项目运行时 getCharacterBaseSoulPowerRequirementAtLevel（MVU_Skill_Runtime.js），所有角色同一算法
    const f = c.rt('getCharacterBaseSoulPowerRequirementAtLevel'); if (typeof f !== 'function') return null;
    const lv = c.num(c.st.等级), start = c.num(f(c.ch, lv)), end = c.num(f(c.ch, lv + 1));
    return end > start ? { start, end, need: Math.max(0, end - c.num(c.st.魂力上限)) } : null;
  };
  const relationList = c => c.entries(c.ch.社交?.关系).map(([name, r]) => ({ name, ...r, aff: c.num(r.好感度) })).sort((a, b) => b.aff - a.aff);
  const affBar = v => `<div class="aff"><i style="${v >= 0 ? `left:50%;width:${Math.min(50, v / 2)}%` : `left:${50 + v / 2}%;width:${Math.min(50, -v / 2)}%;background:linear-gradient(90deg,#4a8bff,#6fb4ff)`}"></i></div>`;
  const where = c => String(c.ch.状态?.位置 || '').replace(/^斗罗大陆-/, '').replace(/-/g, ' · ');
  // 位置能否识别：内置地点库（目标路径整段相等）或存档地点树里有这一层；日常行动预演依赖它
  const placeKnown = c => {
    const p = String(c.ch.状态?.位置 || '').split('-').filter(x => x && x !== '斗罗大陆'); if (!p.length) return false;
    const lib = Object.values(c.library('location')?.地点 || {}).some(e => { const t = Object.values(e.目标路径 || {}); return t.length === p.length && t.every((x, i) => x === p[i]); });
    return lib || !!p.reduce((o, k, i) => o && (i ? o.子节点?.[k] : o[k]), c.S.world.地点 || {});
  };
  // 图标块：图标 + 大字 + 小注；值为空时整块转灰
  const tile = (c, icon, label, value, tint = '', dim = false, extra = '') => `<div class="tile ${dim ? 'dim' : ''} ${extra}">${c.sock(icon, tint)}<b title="${c.esc(value)}">${c.esc(value)}</b><small>${c.esc(label)}</small></div>`;
  // 环形刻度：本级起点 → 下一级所需魂力；没有实测需求时只画满圈刻度
  const realmDial = (c, g) => {
    const lv = c.num(c.st.等级), R = 52, L = 2 * Math.PI * R * .75;
    const pct = g ? Math.max(0, Math.min(1, (c.num(c.st.魂力上限) - g.start) / (g.end - g.start))) : 0;
    return `<div class="dial" title="${g ? `魂力上限 ${c.fmt(c.st.魂力上限)} / 晋级需 ${c.fmt(g.end)}` : ''}"><svg viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="dialGrad" x1="0" x2="1"><stop offset="0" stop-color="#5aaeff"/><stop offset="1" stop-color="#1460e3"/></linearGradient></defs>
      <g transform="rotate(135 60 60)"><circle class="track" cx="60" cy="60" r="${R}" stroke-dasharray="${L} 999"/><circle class="ticks" cx="60" cy="60" r="${R}" stroke-dasharray="1 7.5" style="stroke-dasharray:1 ${(L / 30 - 1).toFixed(2)};clip-path:none"/>
      <circle class="arc" cx="60" cy="60" r="${R}" stroke-dasharray="${L} 999" style="stroke-dashoffset:${L}" data-off="${(L * (1 - Math.max(pct, .05))).toFixed(1)}"/></g></svg>
      <div class="core"><small>当前</small><span class="lv">${lv}</span><b>${g ? (g.need ? `还需 ${c.fmt(g.need)}` : '可晋级') : '—'}</b><small>→ ${lv + 1} 级</small></div></div>`;
  };

  const ringHint = (c, s) => {
    const lv = c.num(c.st.等级), next = Array.from({ length: Math.max(0, 9 - s.rings.length) }, (_, k) => s.rings.length + k + 1);
    const open = next.filter(n => lv >= n * 10).length, locked = next.find(n => lv < n * 10);
    return open ? `<span class="nx ok">可附 ${open} 环</span>` : locked ? `<span class="nx">${locked * 10} 级开第 ${locked} 环</span>` : '';
  };
  // 武魂投影台：上方魂环舞台（引擎原样：平时同心叠环，悬停变 3D 魂环塔，塔里扫到哪一圈就浮出那一环的魂技卡），
  // 下方椭圆台座 + 银色铭牌。不用方框卡片。data-float 让魂技卡出现在外侧：左台往左、右台往右，不遮挡魂环塔。
  const soulPlate = (label, name, sub, go = '') => `<div class="soul-plate${go ? ' door' : ''}" ${go}><small>${label}</small><strong>${name}</strong>${sub ? `<div class="sp-sub">${sub}</div>` : ''}</div>`;
  const soulCard = (c, s, i) => {
    const keyOf = r => { const sk = r.skills[0], sp = s.spirits.find(x => x.rings.includes(r)); return !sk ? '' : sp ? `${s.slot}/${sp.slot}/${r.slot}/${sk.slot}` : r.independent ? `${s.slot}/${r.slot}/${sk.slot}` : ''; };
    const sub = `${!c.blank(s.系别) ? `<span class="sys">${c.esc(s.系别)}</span>` : ''}${s.rings.length ? `<em>${s.rings.length} 环</em>` : ringHint(c, s).includes('nx ok') ? '' : '<em>未附环</em>'}${ringHint(c, s)}`;
    return `<div class="soul-card" data-scan data-float="${i % 2 ? 'r' : 'l'}">
      <div class="soul-stage">${s.rings.length ? c.ringStage(s.rings, r => { const key = keyOf(r); return key ? `data-inspect="sk:${c.esc(key)}"` : ''; }) : '<div class="soul-empty"><i></i><span>尚未附环</span></div>'}</div>
      ${soulPlate(`${['第一', '第二', '第三', '第四'][i] || ''}武魂`, c.esc(s.表象名称), sub, `data-go="page-ability/martial" data-go-set="soul=${i}" role="link" tabindex="0" title="查看${c.esc(s.表象名称)}的武魂详情"`)}
    </div>`;
  };
  const bloodCard = c => {
    const bl = c.ch.血脉之力 || {}, rings = c.entries(bl).filter(([k, v]) => /魂环/.test(k) && v && typeof v === 'object').map(([, v]) => v);
    if (c.blank(bl.血脉) || !rings.length) return '';
    return `<div class="soul-card blood"><div class="soul-stage">${c.ringStage(rings)}</div>${soulPlate('血脉', c.esc(bl.血脉), `<em>${rings.length} 环</em>`)}</div>`;
  };
  const genderMark = g => g === '女' ? '♀' : g === '男' ? '♂' : '';
  // 行动时长：1 tick = 10 分钟；结束时刻跨日时标「次日」
  const endAt = (c, min) => {
    const t = c.num(c.S.world?.时间?.tick), e = t + min / 10, days = Math.floor(e / 144) - Math.floor(t / 144);
    return `${days ? (days === 1 ? '次日 ' : `${days} 日后 `) : ''}${c.tickDate(e).slice(-5)}`;
  };
  window.COCKPIT.endAt = endAt;
  const status = c => {
    const st = c.st, g = growthOf(c);
    const wounds = c.entries(c.ch.状态?.受伤部位), arts = c.entries(c.ch.功法), core = c.ch.魂核?.核心 || {};
    // 新增伤势：原地展开一行表单（部位 / 程度 / 描述），保存写入 状态.受伤部位.<部位>
    // 记录伤势：部位点选常见部位（「其他」才出输入框），程度三档分段；受伤部位在 MVU 里是自由键，所以保留自定义
    const woundForm = c.state.ui.woundForm ? `<div class="wound-form" data-deg="轻">
        <div class="wf-row"><span class="wf-l">部位</span><div class="wf-chips">${[...WOUND_PARTS, '其他'].map(p => `<button type="button" class="dz-chip" data-wf-part="${p}" aria-pressed="false">${p}</button>`).join('')}</div><input data-wf="part" placeholder="部位名称" hidden></div>
        <div class="wf-row"><span class="wf-l">程度</span><div class="wf-seg" role="group">${['轻', '中', '重'].map(d => `<button type="button" class="${d === '轻' ? 'on' : ''} d${d}" data-wf-deg="${d}" aria-pressed="${d === '轻'}">${d}</button>`).join('')}</div><input data-wf="desc" placeholder="描述"></div>
        <div class="wf-row end"><button class="key-s" type="button" data-wound-cancel>取消</button><button class="key-s on" type="button" data-wound-save>保存</button></div>
      </div>` : '';
    const fact = (icon, label, value, dim, title = '') => `<div class="fact ${dim ? 'dim' : ''}" ${title ? `title="${c.esc(title)}"` : ''}><i class="fa-solid fa-${icon}"></i><span>${label}</span><b>${c.esc(value)}</b></div>`;
    return {
      tag: 'CORE · STATUS',
      core: `<div class="pad home-core">${window.COCKPIT.battleActive?.() ? `<div class="banner battle-back"><i class="fa-solid fa-khanda"></i><div><strong>战斗进行中</strong></div><button class="key-s" type="button" data-act='{"name":"battle"}'>返回战斗</button></div>` : ''}
        <div class="home-top">
        <div class="id-row">${avatarBlock(c)}
          <div class="who">
            <div class="name-line"><h1 class="name"${(pk => pk ? ` data-longpress="${c.esc(pk)}" data-longpress-delay="600"` : '')(window.COCKPIT.privateArchiveKey?.())}>${c.esc(c.name)}</h1>${genderMark(st.性别) || c.num(st.年龄) ? `<span class="gender ${st.性别 === '女' ? 'f' : st.性别 === '男' ? 'm' : ''}" title="${c.esc(st.性别 || '')} · ${c.num(st.年龄)} 岁">${genderMark(st.性别)}<b>${c.ed(c.num(st.年龄) || '?', c.P('属性', '年龄'), { kind: 'number', integer: true, min: 0, raw: c.num(st.年龄) })}</b><small>岁</small></span>` : ''}</div>
            <div class="title-line"><span class="nw">Lv.${c.ed(c.num(st.等级), c.P('属性', '等级'), { kind: 'number', integer: true, min: 0, raw: c.num(st.等级) })} ${c.esc(c.rankTitle(st.等级))}</span> · <span class="nw">${c.ed(st.精神境界 || '灵元境', c.P('属性', '精神境界'), { kind: 'enum', options: ['灵元境', '灵通境', '灵海境', '灵渊境', '灵域境', '神元境'] })}</span></div>
            <div class="plaques">${!c.blank(c.ch.社交?.主身份) ? `<span class="plq">${c.ed(c.ch.社交.主身份, c.P('社交', '主身份'))}</span>` : ''}${st.邪魂师 ? '<span class="plq" style="--pc:#ff4d6a">邪魂师</span>' : ''}</div>
          </div>
        </div>
        <div class="meters">
          <div class="meter">${c.sock('heart', 'hp')}<div class="lb">生命 ${c.ed(null, c.P('属性', 'HP'), { kind: 'number', integer: true, min: 0, max: c.num(st.HP上限), raw: c.num(st.HP), html: c.count(st.HP) })}<span class="num">/ ${c.fmt(st.HP上限)}</span></div>${c.bar('hp', st.HP, st.HP上限)}</div>
          <div class="meter">${c.sock('fire-flame-curved', 'sp')}<div class="lb">魂力 ${c.ed(null, c.P('属性', '魂力'), { kind: 'number', integer: true, min: 0, max: c.num(st.魂力上限), raw: c.num(st.魂力), html: c.count(st.魂力) })}<span class="num">/ ${c.fmt(st.魂力上限)}</span></div>${c.bar('sp', st.魂力, st.魂力上限)}</div>
          <div class="meter">${c.sock('brain', 'mp')}<div class="lb">精神 ${c.ed(null, c.P('属性', '精神力'), { kind: 'number', integer: true, min: 0, max: c.num(st.精神力上限), raw: c.num(st.精神力), html: c.count(st.精神力) })}<span class="num">/ ${c.fmt(st.精神力上限)}</span></div>${c.bar('mp', st.精神力, st.精神力上限)}</div>
          <div class="meter">${c.sock('person-running', 'vp')}<div class="lb">体力 ${c.ed(null, c.P('属性', '体力'), { kind: 'number', integer: true, min: 0, max: c.num(st.体力上限), raw: c.num(st.体力), html: c.count(st.体力) })}<span class="num">/ ${c.fmt(st.体力上限)}</span></div>${c.bar('vp', st.体力, st.体力上限)}</div>
        </div>
        </div>
        <section class="soul-deck" aria-label="武魂与魂环">${c.souls.map((s, i) => soulCard(c, s, i)).join('')}${bloodCard(c)}</section>
        ${wounds.length
          ? `<div class="sec wound-sec"><div class="strip" style="color:#a3301f;background:linear-gradient(90deg,rgba(230,60,40,.16),transparent 70%);box-shadow:inset 2px 0 0 #d6452a"><i class="fa-solid fa-kit-medical"></i><span>伤势 ${wounds.length} 处</span><button class="key-s" type="button" style="margin-left:auto" data-wound-add><i class="fa-solid fa-plus"></i> 记录</button></div>
             <div class="list">${wounds.map(([part, w]) => `<div class="row" style="cursor:default"><span class="chip">${c.ed(w.程度 || '轻', c.P('状态', '受伤部位', part, '程度'), { kind: 'enum', options: ['轻', '中', '重'] })}</span><div><strong>${c.ed(part, c.P('状态', '受伤部位', part), { renameKey: true })}</strong><small>${c.ed(w.描述 || '未描述', c.P('状态', '受伤部位', part, '描述'), { raw: w.描述 || '' })}</small></div><button class="key-s danger" type="button" data-del-path="${c.esc(JSON.stringify(c.P('状态', '受伤部位', part)))}"><i class="fa-solid fa-trash"></i></button></div>`).join('')}</div>${woundForm}</div>`
          : `<div class="strip wound-sec"><i class="fa-solid fa-shield-heart"></i><span>身体无伤 · 气息平稳</span><button class="key-s" type="button" style="margin-left:auto" data-wound-add><i class="fa-solid fa-plus"></i> 记录伤势</button></div>${woundForm}`}
      </div>`,
      left: `<div class="pad">
        ${c.head('arrow-trend-up', '修为', 'Cultivation', 'gd')}
        <div class="door" data-go="page-archive/growth" role="link" tabindex="0" title="查看属性构成与成长">${realmDial(c, g)}</div>
        <div class="attrs compact">${[['hand-fist', '力量', st.力量, st.训练加成?.力量], ['shield-halved', '防御', st.防御, st.训练加成?.防御], ['feather-pointed', '敏捷', st.敏捷, st.训练加成?.敏捷]].map(([ic, l, v, t]) => `<div class="attr">${c.sock(ic)}<span>${l}</span><b>${c.ed(null, c.P('属性', l), { kind: 'number', integer: true, min: 0, raw: c.num(v), html: c.count(v) })}</b><em>训练 +${c.ed(c.fmt(t || 0), c.P('属性', '训练加成', l), { kind: 'number', integer: true, min: 0, raw: c.num(t) })}</em></div>`).join('')}</div>
        <div class="facts door" data-go="page-archive/growth" role="link" tabindex="0" title="查看成长">
          ${fact('atom', '魂核', c.num(core.数量) ? `${c.fmt(core.数量)} 枚` : '未凝聚', !c.num(core.数量) && !c.num(core.进度), c.num(core.进度) ? `凝聚进度 ${c.fmt(core.进度)}%` : '')}
          ${fact('scroll', '功法', arts.length ? (arts.length > 1 ? `${arts[0][0]} 等 ${arts.length} 部` : arts[0][0]) : '未修习', !arts.length)}
          ${c.num(st.等级惩罚) ? `<div class="fact bad"><i class="fa-solid fa-triangle-exclamation"></i><span>等级惩罚</span><b>-${c.fmt(st.等级惩罚)}</b></div>` : ''}
        </div>
      </div>`,
      right: `<div class="pad">
        ${c.head('gear', '日常行动', 'Routine')}
        <div class="opts" data-pick-group>
          ${[['mug-hot', '休整', '静息调养'], ['bed', '睡眠', '安眠休养'], ['person-praying', '冥想', '凝神修行'], ['dumbbell', '训练', '锤炼身心']].map(([ic, t, s], i) => `<button class="opt ${i === 0 ? 'on' : ''}" type="button" data-pick aria-pressed="${i === 0}"><i class="fa-solid fa-${ic}"></i>${t}<small>${s}</small></button>`).join('')}
        </div>
        <div class="train-pick chips-row" data-pick-group hidden>${['力量', '防御', '敏捷', '体魄', '精神'].map((p, i) => `<button class="key-s${i ? '' : ' on'}" type="button" data-pick data-project="${p}" aria-pressed="${!i}">${p}</button>`).join('')}</div>
        <div class="plan" data-dur-box>
          <div class="dur"><button type="button" data-dur="-10" aria-label="减少十分钟">−</button><output data-min="60">60 分钟</output><button type="button" data-dur="10" aria-label="增加十分钟">＋</button></div>
          <div class="plan-end"><i class="fa-regular fa-clock"></i><span>结束于</span><b data-dur-end>${endAt(c, 60)}</b></div>
        </div>
        ${(nar => nar ? `<div class="warn"><i class="fa-solid fa-triangle-exclamation"></i><span>上一项行动已结算，叙事未完成</span></div><button class="cta" type="button" data-hint="只补写叙事，不会再次结算行动收益" data-act="${c.esc(JSON.stringify({ name: 'routine', op: 'retry', receiptId: nar.receiptId }))}"><i class="fa-solid fa-rotate-right"></i>重试叙事</button>` : '')(c.isPlayer ? window.COCKPIT.preview('routineNarration') : null)}
        ${c.isPlayer && window.COCKPIT.preview('routineNarration') ? '' : placeKnown(c) || c.rt('__LWCS_ERA_RUNTIME_INTEGRATION_V1__') ? `<button class="cta" type="button" data-routine data-hint="按所选行动与时长预演体力、魂力等变化后结算"><i class="fa-solid fa-play"></i>开始行动</button>`
          : `<div class="warn"><i class="fa-solid fa-triangle-exclamation"></i><span>当前位置「${c.esc(where(c))}」未能识别，暂时无法预演行动效果。</span></div>
        <button class="cta" type="button" disabled><i class="fa-solid fa-lock"></i>暂不可行动</button>`}
      </div>`,
    };
  };

  // 颜色词 → 色块；匹配顺序由具体到笼统
  const COLOR_WORDS = [['天蓝', '#66c6ff'], ['冰蓝', '#a8e4ff'], ['湛蓝', '#2f86e0'], ['深蓝', '#24439a'], ['蓝', '#3d7bd8'], ['灰白', '#d2d4d8'], ['银', '#c3cad4'], ['白', '#f4f4f2'], ['灰', '#8c8f96'], ['暗褐', '#4e3426'], ['褐', '#6b4630'], ['棕', '#7a4e2d'], ['金', '#e3bd57'], ['黄', '#e8cf5a'], ['橙', '#e8873a'], ['红', '#c8323a'], ['粉', '#f1a3bf'], ['紫', '#8a5cd6'], ['绿', '#3f9a5a'], ['青', '#2bb3b3'], ['黑', '#1f2026']];
  const colorOf = t => (COLOR_WORDS.find(([w]) => String(t || '').includes(w)) || [])[1];
  const swatchPlq = (c, label, v, p) => c.blank(v) && !p ? '' : `<span class="plq steel swatch" title="${label}">${colorOf(v) ? `<i style="background:${colorOf(v)}"></i>` : ''}${label} · ${p ? c.ed(c.blank(v) ? '未记录' : v, p, { raw: c.blank(v) ? '' : v }) : c.esc(v)}</span>`;
  const heightRuler = (c, v, p) => {
    const cm = parseFloat(String(v || '').replace(/[^\d.]/g, ''));
    if (!Number.isFinite(cm) || cm < 50 || cm > 250) return c.blank(v) && !p ? '' : `<span class="lbl">身高 · ${p ? c.ed(c.blank(v) ? '未记录' : v, p, { raw: c.blank(v) ? '' : v }) : c.esc(v)}</span>`;
    const pct = Math.max(0, Math.min(100, (cm - 100) / 100 * 100));
    return `<div class="ruler" title="身高 ${cm}cm"><div class="scale"></div><span class="mark" style="left:${pct}%">${p ? c.ed(v, p) : `${cm}cm`}</span><small style="left:0">100</small><small style="left:50%;translate:-50% 0">150</small><small style="right:0">200</small></div>`;
  };
  // 档案：左翼身份牌（一张牌，不是一列方框）；中屏两栏——外貌（色块 · 身高尺 · 穿搭）/ 长相与性格叙述；
  // 右翼只在有内置立绘时展开，没有立绘就折成侧轨，只留上传头像入口（不做大块占位）
  const idRow = (c, icon, label, value, tint = '') => `<div class="idr ${tint}"><i class="fa-solid fa-${icon}"></i><span>${label}</span><b title="${c.esc(value)}">${c.esc(value)}</b></div>`;
  const profile = c => {
    const a = c.ch.外貌 || {}, w = c.ch.穿搭 || {}, st = c.st, standing = c.standingSrc(c.name);
    const alive = c.ch.状态?.存活 !== false;
    const upload = `<input type="file" accept="image/*" class="ava-file" data-name="${c.esc(c.name)}" aria-label="上传${c.esc(c.name)}的头像">`;
    const wear = [['shirt', '上装', w.上装], ['socks', '下装', w.下装], ['shoe-prints', '鞋子', w.鞋子]];
    return {
      tag: 'CORE · PROFILE', wide: standing ? '' : 'r',
      core: `<div class="pad">
        ${c.head('id-card', c.name, 'Profile', 'gd')}
        <div class="dossier">
          <div class="dossier-col">
            <div class="plaques">
              ${swatchPlq(c, '发色', a.发色, c.P('外貌', '发色'))}${swatchPlq(c, '瞳色', a.瞳色, c.P('外貌', '瞳色'))}
              <span class="plq steel">发型 · ${c.ed(c.blank(a.发型) ? '未记录' : a.发型, c.P('外貌', '发型'), { raw: c.blank(a.发型) ? '' : a.发型 })}</span><span class="plq steel">体型 · ${c.ed(c.blank(a.体型) ? '未记录' : a.体型, c.P('外貌', '体型'), { raw: c.blank(a.体型) ? '' : a.体型 })}</span>
              ${(a.特殊特征 || []).map(t => `<span class="plq gold">${c.esc(t)}</span>`).join('')}
            </div>
            ${heightRuler(c, a.身高, c.P('外貌', '身高'))}
            ${wear.length ? `<section class="sec"><h3>穿搭<span class="en">Outfit</span></h3><div class="wear">${wear.map(([ic, l, v]) => `<div class="wear-row">${c.sock(ic)}<small>${l}</small><b>${c.ed(v, c.P('穿搭', l))}</b></div>`).join('')}</div><p class="prose">${c.ed(c.blank(w.描述) ? '未记录整体描述' : w.描述, c.P('穿搭', '描述'), { kind: 'text', raw: c.blank(w.描述) ? '' : w.描述 })}</p></section>` : ''}
          </div>
          <div class="dossier-col">
            <section class="sec"><h3>长相<span class="en">Looks</span></h3><p class="narr">${c.ed(c.blank(a.长相描述) ? '未记录' : a.长相描述, c.P('外貌', '长相描述'), { kind: 'text', raw: c.blank(a.长相描述) ? '' : a.长相描述 })}</p></section>
            <section class="sec"><h3>性格<span class="en">Temper</span></h3><p class="narr">${c.ed(c.blank(c.ch.性格) ? '未记录' : c.ch.性格, c.P('性格'), { kind: 'text', raw: c.blank(c.ch.性格) ? '' : c.ch.性格 })}</p></section>
          </div>
        </div></div>`,
      left: `<div class="pad">
        ${c.head('user', '基础信息', 'Basic')}
        <div class="id-photo">${avatarBlock(c)}</div>
        <div class="idcard">
          ${idRow(c, 'cake-candles', '生辰', `${st.生日 || '未记录'} · ${c.num(st.年龄)} 岁`)}
          ${idRow(c, st.性别 === '女' ? 'venus' : st.性别 === '男' ? 'mars' : 'genderless', '性别', st.性别 || '未记录')}
          ${idRow(c, st.邪魂师 ? 'skull' : 'shield-halved', '阵营', st.邪魂师 ? '邪魂师' : '正统魂师', st.邪魂师 ? 'bad' : '')}
          <div class="idr"><i class="fa-solid fa-location-dot"></i><span>所在</span><b>${c.ed(c.ch.状态?.位置 || '', c.P('状态', '位置'))}</b></div>
          ${alive ? '' : idRow(c, 'cross', '状态', `已故 · ${c.ch.状态?.死亡类型 || ''}${c.num(c.ch.状态?.死亡tick) >= 0 ? ' · ' + c.tickDate(c.ch.状态.死亡tick) : ''}`, 'bad')}
        </div>
      </div>`,
      right: standing ? `<div class="pad standing-pad">
        <div class="standing"><img src="${c.esc(standing)}" alt="${c.esc(c.name)}立绘"></div>
        <label class="key-s upload-s"><i class="fa-solid fa-camera"></i> 更换头像${upload}</label>
      </div>` : '',
      faces: { r: '立绘' },
      railR: `<div class="rail" title="该角色没有内置立绘">${c.sock('image')}<small>暂无立绘</small></div>`,
    };
  };

  // 六维雷达：按六项中的最大值归一；训练所得画成内层绿色虚线
  const radar = (c, six, peak) => {
    const R = 70, cx = 100, cy = 92, pt = (i, r) => { const a = -Math.PI / 2 + i * Math.PI / 3; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
    const poly = vals => vals.map((v, i) => pt(i, R * Math.max(.04, Math.min(1, v / peak))).map(n => n.toFixed(1)).join(',')).join(' ');
    const web = [.25, .5, .75, 1].map(k => `<polygon class="web" points="${[0, 1, 2, 3, 4, 5].map(i => pt(i, R * k).map(n => n.toFixed(1)).join(',')).join(' ')}"/>`).join('');
    const axes = [0, 1, 2, 3, 4, 5].map(i => { const [x, y] = pt(i, R); return `<line class="axis" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; }).join('');
    const labels = six.map(([, l, v], i) => { const [x, y] = pt(i, R + 16); return `<text x="${x.toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="middle">${c.esc(l.replace('上限', ''))}</text>`; }).join('');
    return `<svg class="radar" viewBox="0 0 200 190" role="img" aria-label="六维雷达">${web}${axes}<g class="shape"><polygon class="base" points="${poly(six.map(x => c.num(x[2])))}"/><polygon class="gain" points="${poly(six.map(x => c.num(x[3])))}"/></g>${labels}</svg>`;
  };
  // 成长：属性构成条（基础 / 训练所得），每项按自身数值归一，不同量纲不再挤在一张雷达图里；
  // 左翼战绩 + 魂灵塔两块数据牌；右翼交战对象
  const growth = c => {
    const st = c.st, tb = st.训练加成 || {}, hist = c.entries(c.ch.战斗历史), tower = c.ch.魂灵塔记录 || {}, five = tower.当前五折魂灵 || {};
    const six = [['hand-fist', '力量', st.力量, tb.力量], ['shield-halved', '防御', st.防御, tb.防御], ['feather-pointed', '敏捷', st.敏捷, tb.敏捷], ['person-running', '体力上限', st.体力上限, tb.体力上限], ['brain', '精神力上限', st.精神力上限, tb.精神力上限], ['fire-flame-curved', '魂力上限', st.魂力上限, tb.魂力上限]];
    const sum = k => hist.reduce((s, [, h]) => s + c.num(h[k]), 0);
    return {
      tag: 'CORE · GROWTH', wide: hist.length ? '' : 'r',
      railR: `<div class="rail">${c.sock('khanda')}<b>0</b><small>交战对象</small></div>`,
      core: `<div class="pad">
        ${c.head('chart-line', '属性构成', 'Attributes', 'gd', '<span class="legend"><i class="b"></i>基础<i class="t"></i>训练所得</span>')}
        <div class="compo">${six.map(([ic, l, v, t]) => {
          const val = c.num(v), tr = Math.min(val, c.num(t)), pct = val ? tr / val * 100 : 0;
          return `<div class="cp-row">${c.sock(ic)}<div class="cp-main">
            <div class="cp-top"><span>${l}</span><b>${c.count(v)}</b>${tr ? `<em>训练 +${c.fmt(tr)}<small>${pct.toFixed(1)}%</small></em>` : '<em class="none">未经训练</em>'}</div>
            <div class="cp-bar"><i class="base" style="width:${(100 - pct).toFixed(2)}%"></i><i class="train" style="width:${pct.toFixed(2)}%"></i></div>
          </div></div>`;
        }).join('')}</div>
      </div>`,
      left: `<div class="pad">
        ${c.head('khanda', '战绩', 'Record', '', c.hint('战斗结算后自动累计。'))}
        <div class="statline ${hist.length ? '' : 'dim'}">${[['总场次', '次数'], ['胜', '胜'], ['负', '负'], ['平', '平']].map(([l, k]) => `<div><b>${c.fmt(sum(k))}</b><small>${l}</small></div>`).join('')}</div>
        <div class="groove"></div>
        ${c.head('tower-observation', '魂灵塔', 'Tower')}
        <div class="statline ${c.num(tower.最高层) ? '' : 'dim'}" style="--n:2"><div><b>${c.ed(c.fmt(tower.最高层 || 0), c.P('魂灵塔记录', '最高层'), { kind: 'number', integer: true, min: 0, raw: c.num(tower.最高层) })}</b><small>最高通关层</small></div><div><b>${c.num(five.层数) ? c.fmt(five.层数) : '—'}</b><small>五折魂灵层</small></div></div>
        ${!c.blank(five.名称) ? `<div class="idcard">${idRow(c, 'ghost', '五折魂灵', `${five.名称} · ${c.fmt(five.年限)} 年${five.品质 ? ' · ' + five.品质 : ''}${five.已使用 ? '（已使用）' : ''}`)}</div>` : '<span class="lbl">尚未挑战魂灵塔</span>'}
      </div>`,
      right: `<div class="pad">${c.head('khanda', '交战对象', 'Opponents')}
        ${hist.length ? `<div class="list q-list">${hist.map(([who, h]) => `<div class="row" style="cursor:default">${c.miniAva(who)}<div><strong>${c.esc(who)}</strong><small>${c.fmt(h.次数)} 战 · 最近${c.esc(h.最近结果 || '—')}${h.最近tick ? ' · ' + c.tickDate(h.最近tick) : ''}</small></div><span class="end">${c.fmt(h.胜)}胜 ${c.fmt(h.负)}负 ${c.fmt(h.平)}平</span></div>`).join('')}</div>` : c.empty('khanda', '还没有交战对象')}
      </div>`,
    };
  };

  // 关系：左翼 = 关系名单（已结识按好感排序 / 同地未结识），主屏 = 圆形星盘（点星选中），右翼 = 选中对象的关系档案与操作。
  // 星盘：自己居中；内轨 = 已结识（好感越高越靠近中心），外轨 = 同地未结识（暗星，不连线）
  const relations = c => {
    const list = relationList(c), others = Object.keys(c.S.char).filter(n => n !== c.name);
    const sameLoc = name => c.S.char[name] && c.S.char[name].状态?.位置 === c.ch.状态?.位置;
    const strangers = others.filter(n => !list.some(r => r.name === n) && sameLoc(n)).map(name => ({ name, stranger: true }));
    const place = (arr, r0, offset) => arr.map((r, i) => { const a = -Math.PI / 2 + offset + i * (2 * Math.PI / Math.max(arr.length, 1)); const rad = r.stranger ? r0 : r0 - Math.max(0, Math.min(100, r.aff)) / 100 * 6; return { ...r, x: 50 + Math.cos(a) * rad, y: 50 + Math.sin(a) * rad }; });
    const inner = place(list, 27, 0), outer = place(strangers, 38, Math.PI / Math.max(strangers.length, 1) / (list.length ? 1 : 2));
    const short = t => String(t || '').length > 7 ? String(t).slice(0, 7) + '…' : String(t || '');
    const total = inner.length + outer.length, sel = [...list, ...strangers].find(r => r.name === c.state.ui.relsel) || list[0] || strangers[0];
    const on = n => sel && n === sel.name ? ' on' : '';
    const row = r => `<button class="row${on(r.name)}" type="button" data-set="relsel=${c.esc(r.name)}" data-face-after="1" aria-current="${!!on(r.name)}">${c.miniAva(r.name)}<div><strong>${c.esc(r.name)}</strong><small>${c.esc(r.stranger ? '同地 · 未结识' : r.关系 || '关系未记录')}</small></div>${r.stranger ? '<span></span>' : `<span class="end ${r.aff >= 0 ? 'warm' : 'cold'}">${r.aff >= 0 ? '+' : ''}${c.fmt(r.aff)}</span>`}</button>`;
    return {
      tag: 'CORE · RELATIONS',
      left: `<div class="pad">${c.head('people-arrows', '关系', 'Relations', 'gd')}
        ${total ? `<div class="list q-list">${list.length ? `<small class="list-cap">已结识 · ${list.length}</small>${list.map(row).join('')}` : ''}${strangers.length ? `<small class="list-cap">同地未结识 · ${strangers.length}</small>${strangers.map(row).join('')}` : ''}</div>` : c.empty('people-arrows', '还没有记录任何关系', `${others.length} 位角色在目录中`)}
      </div>`,
      core: !total ? `<div class="pad sparse">${c.empty('circle-nodes', '星图是空的')}</div>` : `<div class="pad">
        ${c.head('circle-nodes', '关系星图', 'Constellation', '', `<span class="legend"><i class="fa-solid fa-handshake-simple" style="color:#e07b3a;width:auto;height:auto"></i>好感${c.hint('连线粗细与数字是好感（-100 ~ 100）；好感越高的人越靠近中心。')}</span>`)}
        <div class="constellation orbital"><div class="orbitfield">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle class="orbit" cx="50" cy="50" r="27"/><circle class="orbit outer" cx="50" cy="50" r="38"/>
            ${inner.map(r => `<line class="link" x1="50" y1="50" x2="${r.x.toFixed(2)}" y2="${r.y.toFixed(2)}" style="color:${r.aff >= 0 ? '#ffb27a' : '#7cb4ff'}" stroke="currentColor" stroke-width="${(.5 + Math.abs(r.aff) / 120).toFixed(2)}"/>`).join('')}
          </svg>
          <span class="orbit-label" style="top:${50 + 27}%">已结识 ${list.length}</span>${strangers.length ? `<span class="orbit-label dim" style="top:${50 + 38}%">同地未结识 ${strangers.length}</span>` : ''}
          ${inner.map(r => `<span class="link-tag" style="left:${50 + (r.x - 50) * .42}%;top:${50 + (r.y - 50) * .42}%;color:${r.aff >= 0 ? '#ffd9b8' : '#cfe2ff'}"><i class="fa-solid fa-handshake-simple"></i> ${r.aff >= 0 ? '+' : ''}${c.fmt(r.aff)}</span>`).join('')}
          <div class="star self" style="left:50%;top:50%">${c.miniAva(c.name)}<b>${c.esc(c.name)}</b></div>
          ${inner.map(r => `<button type="button" class="star${on(r.name)}" data-set="relsel=${c.esc(r.name)}" data-face-after="1" style="left:${r.x}%;top:${r.y}%">${c.miniAva(r.name)}<b>${c.esc(r.name)}</b><small>${c.esc(short(r.关系))}</small></button>`).join('')}
          ${outer.map(r => `<button type="button" class="star stranger${on(r.name)}" data-set="relsel=${c.esc(r.name)}" data-face-after="1" style="left:${r.x}%;top:${r.y}%">${c.miniAva(r.name)}<b>${c.esc(r.name)}</b><small>同地 · 未结识</small></button>`).join('')}
        </div></div>
      </div>`,
      right: `<div class="pad">${sel ? relDetail(c, sel.name) : c.empty('user', '选择一个人查看关系')}</div>`,
    };
  };
  // 关系档案（右翼）：已结识 = 关系 / 好感可改 + 好感条 + 所在 / 武魂相关度；未结识只给所在与查看
  const relDetail = (c, name) => {
    const r = c.ch.社交?.关系?.[name], other = c.S.char[name], loc = String(other?.状态?.位置 || '未知').replace(/^斗罗大陆-/, '').replace(/-/g, ' · ');
    const view = other ? `<button class="cta" type="button" data-view-char="${c.esc(name)}"><i class="fa-solid fa-eye"></i>查看 ${c.esc(name)}</button>` : '';
    if (!r) return `<div class="insp-head">${c.miniAva(name)}<div><strong style="font-size:1.1em">${c.esc(name)}</strong><br><small class="lbl">${c.esc(other?.社交?.主身份 || '')}</small></div></div>
      <div class="tiles"><div class="tile">${c.sock('location-dot')}<b>${c.esc(loc)}</b><small>同地 · 尚未结识</small></div></div>
      <div class="acts">${view}</div>`;
    const aff = c.num(r.好感度), base = c.num(r.武魂相关度基础);
    return `<div class="insp-head">${c.miniAva(name)}<div><strong style="font-size:1.1em">${c.esc(name)}</strong><br><small class="lbl">${c.esc(r.对方身份 || other?.社交?.主身份 || '')}</small></div></div>
      ${c.kv([['关系', c.ed(r.关系 || '', c.P('社交', '关系', name, '关系'))], ['好感', `${c.ed(`${aff >= 0 ? '+' : ''}${c.fmt(aff)}`, c.P('社交', '关系', name, '好感度'), { kind: 'number', integer: true, min: -100, max: 100, raw: aff })} / 100`]])}
      ${affBar(aff)}
      <div class="tiles">
        <div class="tile">${c.sock('location-dot')}<b>${c.esc(loc)}</b><small>所在</small></div>
        <div class="tile">${c.sock('link')}<b>${base}</b><small>武魂相关度基础${c.hint('总相关度由运行时按武魂、属性与关系计算，≥70 时可触发武魂融合。')}</small></div>
      </div>
      <div class="acts">${view}</div>`;
  };

  // 身份：不是「列表选一项」的页，所以不拆左翼——左翼折成侧轨，主屏 = 身份名片（主身份 / 名望 / 家世）+ 势力与称号两栏
  // （没有时以空状态占位，附各方势力入口）；右翼 = 特殊权限（悬停看详情）与去关系 / 情报，没有特殊权限时也折成侧轨
  const identity = c => {
    const so = c.ch.社交 || {}, titles = c.entries(so.称号), facs = c.entries(so.势力);
    const rels = c.entries(so.关系).length, intel = (c.ch.已掌握情报 || []).length;
    const privs = c.entries(c.S.world.特殊权限).filter(([, p]) => p.持有人 === c.player);
    return {
      tag: 'CORE · IDENTITY', wide: privs.length ? 'l' : 'both',
      railL: `<div class="rail rail-stack"><div class="rail-item">${c.sock('flag', 'gd')}<b>${facs.length}</b><small>势力</small></div><div class="rail-item">${c.sock('crown', 'gd')}<b>${titles.length}</b><small>称号</small></div></div>`,
      railR: `<div class="rail rail-stack"><button class="rail-item" type="button" data-go="page-archive/relations">${c.sock('people-arrows')}<b>${rels}</b><small>关系</small></button><button class="rail-item" type="button" data-go="page-terminal/intel">${c.sock('eye')}<b>${intel}</b><small>情报</small></button></div>`,
      core: `<div class="pad detail">
        <div class="q-title">${c.sock('landmark', 'gd')}<span class="chip">主身份</span><h2>${c.ed(c.blank(so.主身份) ? '身份未记录' : so.主身份, c.P('社交', '主身份'), { raw: c.blank(so.主身份) ? '' : so.主身份 })}</h2></div>
        <div class="fame"><div><small>名望</small><b>${c.val(so.名望等级, '名望未定')}</b></div><div><small>声望</small><b class="num">${c.ed(c.fmt(so.声望 || 0), c.P('社交', '声望'), { kind: 'number', integer: true, raw: c.num(so.声望) })}</b></div><div><small>称号</small><b class="num">${titles.length}</b></div><div><small>势力</small><b class="num">${facs.length}</b></div></div>
        <section class="sec"><h3>家世<span class="en">Lineage</span></h3><p class="narr">${c.ed(c.blank(so.家世描述) ? '未记录' : so.家世描述, c.P('社交', '家世描述'), { kind: 'text', raw: c.blank(so.家世描述) ? '' : so.家世描述 })}</p></section>
        <div class="dossier id-cols">
          <section class="sec"><h3>所属势力<span class="en">${facs.length || 'Factions'}</span><button class="key-s h3-act" type="button" data-go="page-world/faction"><i class="fa-solid fa-chess-rook"></i> 各方势力</button></h3>
            ${facs.length ? `<div class="wear">${facs.map(([f, x]) => `<div class="wear-row">${c.sock('flag', 'gd')}<small>${c.ed(x.身份 || '成员', c.P('社交', '势力', f, '身份'))}</small><b>${c.esc(f)}<span class="chip-s">权限 ${c.ed(c.fmt(x.权限级), c.P('社交', '势力', f, '权限级'), { kind: 'number', integer: true, min: 0, raw: c.num(x.权限级) })}</span></b></div>`).join('')}</div>` : c.empty('flag', '未加入任何势力')}</section>
          <section class="sec"><h3>称号<span class="en">${titles.length || 'Titles'}</span></h3>
            ${titles.length ? `<div class="wear">${titles.map(([t, x]) => `<div class="wear-row">${c.sock('crown', 'gd')}<small>${c.num(x.声望加成) ? `声望 +${c.fmt(x.声望加成)}` : '称号'}</small><b>${c.esc(t)}${x.来源 ? `<span class="chip-s">${c.esc(x.来源)}</span>` : ''}</b></div>`).join('')}</div>` : c.empty('crown', '暂无称号')}</section>
        </div>
      </div>`,
      right: `<div class="pad">${c.head('key', '特殊权限', 'Privileges', 'gd')}
        <div class="list q-list">${privs.map(([id, p]) => { const [ic, tint] = PRIV_KIND[p.权限?.类型] || ['key', '']; return `<button class="row priv-row" type="button" data-inspect="priv:${c.esc(id)}">${c.sock(ic, tint)}<div><strong>${c.esc(p.名称)}</strong><small>${privScope(c, p.权限)}</small></div><span class="end">${quotaPips(c, p.使用配额)}</span></button>`; }).join('')}</div>
        <div class="groove"></div>
        <div class="tiles"><button class="tile" type="button" data-go="page-archive/relations">${c.sock('people-arrows')}<b>${rels}</b><small>关系</small></button><button class="tile" type="button" data-go="page-terminal/intel">${c.sock('eye')}<b>${intel}</b><small>情报</small></button></div>
      </div>`,
    };
  };


  // 特殊权限：按 MVU 特殊权限Schema 的四种类型（资格 / 折扣 / 物品选择 / 奖励加成）各自摘要适用范围；
  // 配额用格子表示，悬停出完整浮窗；两翼折成侧轨（持有数 / 即将到期数）
  const PRIV_KIND = { 资格: ['id-badge', ''], 折扣: ['percent', 'gd'], 物品选择: ['gift', 'sp'], 奖励加成: ['arrow-up-right-dots', 'vp'] };
  const privScope = (c, q = {}) => q.类型 === '资格' ? `可参加：${c.esc(q.项目)}`
    : q.类型 === '折扣' ? `支付 ${Math.round(c.num(q.支付比例) * 100)}%${[q.地点, q.商店, q.物品分类, q.物品].filter(Boolean).length ? ' · ' + [q.地点, q.商店, q.物品分类, q.物品].filter(Boolean).map(c.esc).join(' / ') : ''}`
    : q.类型 === '物品选择' ? `从 ${c.esc(q.来源)} 选 ${c.fmt(q.数量)} 件${q.品质 ? ' · ' + c.esc(q.品质) : ''}${q.分类 ? ' · ' + c.esc(q.分类) : ''}`
    : q.类型 === '奖励加成' ? `${c.esc(q.来源)} 奖励 ×${c.num(q.倍率)}` : '';
  const quotaPips = (c, u) => !u ? '<span class="chip-s">不限次数</span>' : `<span class="pips" title="剩余 ${u.剩余} / ${u.上限}">${Array.from({ length: Math.min(12, c.num(u.上限)) }, (_, i) => `<i class="${i < c.num(u.剩余) ? 'on' : ''}"></i>`).join('')}${c.num(u.上限) > 12 ? `<b>${u.剩余}/${u.上限}</b>` : ''}</span>`;
  // 特殊权限操作（原项目赛事权限运行时）：物品选择权限从候选里领取一件；任何权限可撤销
  const privActs = (c, id, p) => {
    if (!c.isPlayer || !c.rt('__LWCS_ERA_RUNTIME_INTEGRATION_V1__')) return '';
    const q = p.权限 || {}, act = (action, payload, confirm, cls = 'key-s') => `<button class="${cls}" type="button" data-confirm="${c.esc(confirm)}" data-act="${c.esc(JSON.stringify({ name: 'competition', action, payload }))}">`;
    let claim = '';
    if (q.类型 === '物品选择') {
      const cands = (c.rt('__LWCS_COMPETITION_PRIVILEGE_RUNTIME__')?.生成物品选择候选?.(c.S, p) || []).slice(0, 100), ui = c.state.ui, pick = (ui.privPick || {})[id] || cands[0]?.物品名 || '';
      claim = cands.length ? `<div class="groove"></div><span class="lbl">领取物品</span><div class="pick-row">${c.pick('privPick:' + id, pick, cands.map(x => ({ value: x.物品名, label: x.物品名 })))}</div>${act('领取物品选择', { 权限ID: id, 物品: pick }, `用「${p.名称}」领取「${pick}」×${c.fmt(q.数量 || 1)}`, 'cta')}<i class="fa-solid fa-gift"></i>领取</button>` : '<span class="lbl">当前没有可选的物品</span>';
    }
    return claim + `<div class="act-row">${act('撤销权限', { 权限ID: id }, `撤销「${p.名称}」，撤销后不能恢复`, 'key-s danger')}<i class="fa-solid fa-ban"></i> 撤销权限</button></div>`;
  };
  document.addEventListener('picker:change', e => {
    if (!String(e.detail.path).startsWith('privPick:')) return;
    const ui = window.COCKPIT.ctx().state.ui; (ui.privPick = ui.privPick || {})[e.detail.path.slice(9)] = e.detail.value; window.COCKPIT.refresh();
  });
  const privInspect = (c, kind, id) => {
    const p = c.S.world.特殊权限?.[id]; if (!p) return '';
    const q = p.权限 || {}, u = p.使用配额, [ic, tint] = PRIV_KIND[q.类型] || ['key', ''];
    const scope = Object.entries(q).filter(([k]) => k !== '类型').map(([k, v]) => [k, k === '支付比例' ? `${Math.round(c.num(v) * 100)}%` : k === '倍率' ? `×${c.num(v)}` : c.esc(v)]);
    return `<div class="insp-head">${c.sock(ic, tint)}<div><strong style="font-size:1.1em">${c.esc(p.名称)}</strong><br><small>${c.esc(q.类型)} · ${privScope(c, q)}</small></div><button class="x" type="button" data-close-inspector aria-label="关闭">×</button></div>
      <div class="groove"></div>
      ${c.kv(scope)}
      ${c.kv([['配额', u ? `剩余 ${u.剩余} / ${u.上限}${u.重置周期 ? ` · 每${c.esc(u.重置周期)}重置` : ''}` : '不限次数'], u?.下次重置tick ? ['下次重置', c.tickDate(u.下次重置tick)] : null, ['到期', p.到期tick ? c.tickDate(p.到期tick) : '长期有效']].filter(Boolean))}
      ${privActs(c, id, p)}`;
  };

  // 角色目录：左翼 = 范围筛选（全部 / 同地 / 已结识 / 其他地点），主屏 = 选角式竖牌（点选），右翼 = 选中角色的名片与切换查看。
  // 牌上直接标玩家、正在查看、已结识与好感
  const DIR_TABS = ['全部', '同地', '已结识', '其他地点'];
  const directory = c => {
    const names = Object.keys(c.S.char), me = c.S.char[c.player], here = me?.状态?.位置;
    const rel = me?.社交?.关系 || {}, loc = n => String(c.S.char[n]?.状态?.位置 || '未知').replace(/^斗罗大陆-/, '').replace(/-/g, ' · ');
    const near = names.filter(n => c.S.char[n].状态?.位置 === here), far = names.filter(n => !near.includes(n)), known = names.filter(n => rel[n]);
    const pool = { 全部: names, 同地: near, 已结识: known, 其他地点: far }, tab = pool[c.state.ui.dtab2] ? c.state.ui.dtab2 : '全部';
    const sel = names.find(n => n === c.state.ui.dirsel) || c.name;
    const card = n => {
      const x = c.S.char[n], lv = c.num(x.属性?.等级), r = rel[n], aff = c.num(r?.好感度);
      const tags = [n === c.player ? '<span class="rc-tag gold">玩家</span>' : '', n === c.name && n !== c.player ? '<span class="rc-tag blue">正在查看</span>' : '', r ? `<span class="rc-tag ${aff >= 0 ? 'warm' : 'cold'}"><i class="fa-solid fa-handshake-simple"></i> ${aff >= 0 ? '+' : ''}${c.fmt(aff)}</span>` : ''].join('');
      return `<button class="rc${n === sel ? ' sel' : ''}${n === c.name ? ' on' : ''}" type="button" data-set="dirsel=${c.esc(n)}" data-face-after="1" aria-current="${n === sel}">
        <span class="rc-lv">Lv.${lv}</span>${c.miniAva(n)}
        <strong>${c.esc(n)}</strong><em>${c.rankTitle(lv)}${x.属性?.精神境界 ? ' · ' + c.esc(x.属性.精神境界) : ''}</em>
        <small>${c.esc(x.社交?.主身份 || '')}</small>
        ${x.状态?.位置 !== here ? `<small class="rc-loc"><i class="fa-solid fa-location-dot"></i> ${c.esc(loc(n))}</small>` : ''}
        ${tags ? `<span class="rc-tags">${tags}</span>` : ''}
      </button>`;
    };
    const groups = tab === '全部' ? [[`同在 · ${loc(c.player)}`, 'Here', near], ['其他地点', 'Elsewhere', far]] : [[tab, '', pool[tab]]];
    return {
      tag: 'CORE · ROSTER',
      left: `<div class="pad">${c.head('users', '目录', 'Roster', 'gd')}
        <div class="list">${DIR_TABS.map(k => `<button class="row${k === tab ? ' on' : ''}" type="button" data-set="dtab2=${k}" aria-current="${k === tab}">${c.sock({ 全部: 'users', 同地: 'location-dot', 已结识: 'handshake-simple', 其他地点: 'map' }[k], k === tab ? 'gd' : '')}<div><strong>${k}</strong></div><span class="end">${pool[k].length}</span></button>`).join('')}</div>
      </div>`,
      core: `<div class="pad">
        ${c.search('roster', '名字 / 身份 / 地点')}
        ${groups.filter(g => g[2].length).map(([h, en, arr]) => `<section class="sec"><h3>${c.esc(h)}${en ? `<span class="en">${en}</span>` : ''}</h3><div class="roster">${arr.map(card).join('')}</div></section>`).join('') || c.empty('users', `没有「${tab}」的角色`)}
      </div>`,
      right: `<div class="pad">${charDetail(c, sel)}</div>`,
    };
  };
  // 角色名片（右翼）：身份 / 年龄 / 武魂 / 所在 + 切换查看；删除只对非玩家、非当前查看的角色开放（两步确认）
  const charDetail = (c, name) => {
    const x = c.S.char[name]; if (!x) return '';
    const souls = [x.第1武魂?.表象名称, x.第2武魂?.表象名称].filter(v => !c.blank(v)).map(c.esc).join(' / ');
    return `<div class="insp-head">${c.miniAva(name)}<div><strong style="font-size:1.1em">${c.esc(name)}</strong><br><small class="lbl">Lv.${c.esc(x.属性?.等级)} · ${c.esc(x.属性?.精神境界 || '')}</small></div></div>
      <div class="tiles">
        <div class="tile">${c.sock('landmark')}<b>${c.esc(x.社交?.主身份 || '—')}</b><small>身份</small></div>
        <div class="tile">${c.sock('cake-candles')}<b>${c.esc(x.属性?.年龄 ?? '—')} 岁</b><small>年龄</small></div>
        <div class="tile">${c.sock('fire')}<b>${souls || '—'}</b><small>武魂</small></div>
        <div class="tile">${c.sock('location-dot')}<b>${c.esc(String(x.状态?.位置 || '未知').replace(/^斗罗大陆-/, '').replace(/-/g, ' · '))}</b><small>所在</small></div>
      </div>
      <div class="acts"><button class="cta" type="button" data-view-char="${c.esc(name)}"${name === c.name ? ' disabled' : ''}><i class="fa-solid fa-eye"></i>${name === c.name ? '正在查看' : '切换查看'}</button>
      ${name !== c.player && name !== c.name ? `<button class="key-s danger" type="button" data-confirm="${c.esc(`删除角色「${name}」，并清理其他角色关系表里对它的引用`)}" data-act="${c.esc(JSON.stringify({ name: 'deleteChar', char: name }))}"><i class="fa-solid fa-trash"></i> 删除角色</button>` : ''}</div>`;
  };

  document.addEventListener('click', e => {
    const c = window.COCKPIT.ctx?.(); if (!c) return;
    if (e.target.closest('[data-wound-add]')) { c.state.ui.woundForm = true; window.COCKPIT.refresh(); setTimeout(() => document.querySelector('[data-wf-part]')?.focus(), 30); return; }
    const wp = e.target.closest('[data-wf-part]'), wd = e.target.closest('[data-wf-deg]');
    if (wp || wd) {
      const f = (wp || wd).closest('.wound-form'), sel = wp ? '[data-wf-part]' : '[data-wf-deg]', b = wp || wd;
      f.querySelectorAll(sel).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
      if (wd) { f.dataset.deg = wd.dataset.wfDeg; return; }
      f.dataset.part = wp.dataset.wfPart; const other = f.querySelector('[data-wf="part"]'); other.hidden = wp.dataset.wfPart !== '其他'; if (!other.hidden) other.focus();
      return;
    }
    if (e.target.closest('[data-wound-cancel]')) { c.state.ui.woundForm = false; window.COCKPIT.refresh(); return; }
    if (e.target.closest('[data-wound-save]')) {
      const f = e.target.closest('.wound-form'), other = f.querySelector('[data-wf="part"]'), part = (f.dataset.part === '其他' ? other.value : f.dataset.part || '').trim();
      if (!part) { (f.dataset.part === '其他' ? other : f.querySelector('[data-wf-part]')).focus(); f.querySelector('.wf-chips').classList.add('need'); return; }
      c.state.ui.woundForm = false;
      window.COCKPIT.write([{ path: c.P('状态', '受伤部位', part), value: { 程度: f.dataset.deg || '轻', 描述: f.querySelector('[data-wf="desc"]').value.trim() } }]);
    }
  });

  // 日常行动：点下时先调原项目预演（克隆结算 + 差异），能行动就把变化写进确认条，确认后由原项目执行；不能行动直接给原因
  document.addEventListener('click', e => {
    const opt = e.target.closest('.opts .opt'); if (opt) { const pick = opt.closest('.pad')?.querySelector('.train-pick'); if (pick) pick.hidden = !/训练/.test(opt.textContent); }
    const t = e.target.closest('[data-routine]'); if (!t) return;
    const box = t.closest('.pad'), action = box?.querySelector('.opt.on')?.childNodes[1]?.textContent?.trim() || '休整';
    const minutes = Number(box?.querySelector('[data-dur-box] output')?.dataset.min) || 60, project = box?.querySelector('.train-pick [data-pick].on')?.dataset.project || '力量';
    const label = `${action}${action === '训练' ? '·' + project : ''} ${minutes} 分钟，结束于 ${window.COCKPIT.endAt(window.COCKPIT.ctx(), minutes)}`;
    delete t.dataset.blocked;
    const p = window.COCKPIT.preview('routine', { action, minutes, project });
    if (p && p.allowed === false) { t.dataset.blocked = p.reason || '当前不能进行这项行动'; delete t.dataset.confirm; delete t.dataset.act; return; }
    const changes = (p?.changes || []).map(x => `${x.label} ${x.before} → ${x.after}`).join('，');
    t.dataset.confirm = changes ? `${label}；${changes}` : label;
    t.dataset.act = JSON.stringify({ name: 'routine', action, minutes, project });
  }, true);

  window.COCKPIT.register('page-archive', {
    label: '角色', icon: 'user', tag: 'CORE · STATUS',
    keys: [
      { id: 'status', icon: 'gauge-high', label: '总览', view: status, inspect: (c, kind, id, mode) => kind === 'sk' ? window.COCKPIT.skillCard?.(c, id, mode) || '' : '' },
      { id: 'profile', icon: 'id-card', label: '档案', view: profile },
      { id: 'growth', icon: 'chart-line', label: '成长', view: growth, brief: c => `${c.entries(c.ch.战斗历史).length} 场战斗` },
      { id: 'relations', icon: 'people-arrows', label: '关系', view: relations, brief: c => `${c.entries(c.ch.社交?.关系).length} 人` },
      { id: 'identity', icon: 'landmark', label: '身份', view: identity, inspect: privInspect, brief: c => `${c.entries(c.ch.社交?.势力).length} 个势力` },
      { id: 'directory', icon: 'users', label: '目录', view: directory, brief: c => `${Object.keys(c.S.char).length} 人` },
    ],
  });
})();

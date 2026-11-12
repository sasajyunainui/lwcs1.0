/* 能力领域：武魂 · 魂环 · 魂灵 · 血脉 · 典籍 · 融合 · 设计 · 待处理 */
(() => {
  const pickSoul = c => {
    const i = Math.max(0, Math.min(c.souls.length - 1, Number(c.state.ui.soul || 0)));
    return { soul: c.souls[i], idx: i };
  };
  const costText = (c, cost) => {
    if (cost === undefined || cost === null || cost === '' || cost === '无') return '无消耗';
    if (typeof cost === 'object') return c.entries(cost).map(([k, v]) => `${c.esc(k)} ${c.fmt(v)}`).join(' · ');
    return c.esc(cost);
  };
  const allSkills = c => {
    const out = [];
    for (const s of c.souls) for (const sp of s.spirits) for (const r of sp.rings) for (const sk of r.skills) out.push({ key: `${s.slot}/${sp.slot}/${r.slot}/${sk.slot}`, group: '魂环魂技', from: `${s.表象名称} · ${r.slot}`, ring: r, ...sk });
    for (const s of c.souls) for (const r of s.direct || []) for (const sk of r.skills) out.push({ key: `${s.slot}/${r.slot}/${sk.slot}`, group: '独立魂环魂技', from: `${s.表象名称} · 独立${r.slot}`, ring: r, ...sk });
    for (const [n, sk] of c.entries(c.ch.自创魂技)) out.push({ key: `自创/${n}`, group: '自创魂技', from: '自创', ...sk, 魂技名: sk.魂技名 || n });
    // 魂骨：同原版「合并魂骨 = { ...物品定义, ...实例 }」取附带技能；表来自物品定义时记下 srcPath，设计台保存写回定义
    for (const [slot, b] of c.entries(c.ch.魂骨)) {
      if (!b || typeof b !== 'object') continue;
      const name = b.name || b.名称 || b.表象名称 || '', [cat, def] = itemDef(c, name), merged = { ...(def || {}), ...b };
      const field = merged.附带技能 ? '附带技能' : '装备技能', fromDef = !b[field] && def?.[field];
      for (const [n, sk] of c.entries(merged[field])) if (sk && typeof sk === 'object') out.push({ key: `魂骨/${slot}/${n}`, group: '魂骨附带', from: name ? `${slot} · ${name}` : slot, src: sk, srcPath: fromDef ? ['物品', cat, name, field, n] : ['char', c.name, '魂骨', slot, field, n], ...sk, 魂技名: sk.魂技名 || n });
    }
    // 装备：武器 / 防具 / 斗铠 / 机甲 + 魂导器各装配位。同原版收集口径「实例上的装备技能 || 物品定义里的」；
    // 武器防具实例只存名称，技能在物品定义里（保存写回定义）；魂导器装配时把技能复制到了实例上（写回实例）
    const gear = [...c.entries(c.ch.装备).filter(([k]) => k !== '魂导器').map(([k, v]) => [[k], v]), ...c.entries(c.ch.装备?.魂导器?.装配).map(([k, v]) => [['魂导器', '装配', k], v])];
    for (const [slot, g] of gear) {
      if (!g || typeof g !== 'object') continue;
      const name = String(g.名称 || g.name || '').trim(), [cat, def] = itemDef(c, name), own = c.entries(g.装备技能).length > 0;
      const field = own || def?.装备技能 ? '装备技能' : '附带技能', table = own ? g.装备技能 : def?.[field];
      for (const [n, sk] of c.entries(table)) if (sk && typeof sk === 'object') out.push({ key: `装备/${slot.join('/')}/${n}`, group: '装备技能', slotPath: slot, skKey: n, from: `${slot[slot.length - 1]} · ${name || '未命名'}`, src: sk, srcPath: own ? ['char', c.name, '装备', ...slot, '装备技能', n] : ['物品', cat, name, field, n], ...sk, 魂技名: sk.魂技名 || n });
    }
    // 血脉：散技 / 特性 / 气血魂环魂技三处（同原版 buildBloodlineConfig）
    const bl = c.ch.血脉之力 || {}, blName = c.blank(bl.血脉) ? '血脉' : bl.血脉;
    for (const [n, sk] of c.entries(bl.技能)) out.push({ key: `血脉/${n}`, group: '血脉散技', from: blName, ...sk, 魂技名: sk.魂技名 || n });
    for (const [n, sk] of c.entries(bl.被动)) out.push({ key: `血脉特性/${n}`, group: '血脉特性', from: blName, ...sk, 魂技名: sk.魂技名 || n });
    for (const [rs, ring] of c.entries(bl).filter(([k, v]) => /^第\d+气血魂环$/.test(k) && v && typeof v === 'object').sort((a, b) => parseInt(a[0].slice(1), 10) - parseInt(b[0].slice(1), 10)))
      for (const [n, sk] of c.entries(ring).filter(([k, v]) => /^第\d+血脉魂技(?:_2)?$/.test(k) && v && typeof v === 'object')) out.push({ key: `血脉环/${rs}/${n}`, group: '血脉魂环', from: `${blName} · ${rs}`, ring: { ...ring, slot: rs }, ...sk, 魂技名: sk.魂技名 || n });
    for (const [src, cp] of c.entries(c.ch.复制效果)) for (const [n, it] of c.entries(cp?.技能列表)) out.push({ key: `复制/${src}/${n}`, group: '复制效果', from: `复制自 ${src}${cp.到期tick ? ' · 至 ' + c.tickDate(cp.到期tick) : ''}${it.剩余次数 !== undefined ? ` · 剩 ${it.剩余次数} 次` : ''}`, ...(it.技能数据 || {}), 魂技名: it.技能数据?.魂技名 || n });
    // 功法：同原项目功法设计台（scope art，保存时写回境界 / 等级）；不是可场外施放的技能
    for (const [n, a] of c.entries(c.ch.功法)) if (a && typeof a === 'object') out.push({ key: `功法/${n}`, group: '功法', from: [a.境界, a.lv ? `${a.lv} 级` : ''].filter(Boolean).join(' · ') || '功法', ...a, 魂技名: a.魂技名 || n });
    // 融合技：技能本体在「技能数据」里，记录层只有模式 / 搭档 / 来源武魂
    for (const [n, f] of c.entries(c.ch.武魂融合技)) out.push({ key: `融合/${n}`, group: '武魂融合技', from: `${f.融合模式 === 'self' ? '自体' : '搭档'} · ${f.融合对象 || ''}`, ...(f.技能数据 || {}), 魂技名: f.技能数据?.魂技名 || f.名称 || n });
    return out;
  };
  const itemDef = (c, name) => { if (name) for (const [k, g] of c.entries(c.S.物品)) if (g && typeof g === 'object' && g[name] && typeof g[name] === 'object') return [k, g[name]]; return ['', null]; };
  const SOURCE_GROUPS = ['魂环魂技', '独立魂环魂技', '自创魂技', '武魂融合技', '魂骨附带', '装备技能', '血脉散技', '血脉特性', '血脉魂环', '功法', '复制效果'];
  const BLOOD_CHIP = { 血脉散技: '主动', 血脉特性: '被动', 血脉魂环: '环技' };
  // 武魂属性体系与可调用元素的选项（同原项目 SPIRIT_ATTRIBUTE_SYSTEM_OPTIONS / SPIRIT_ATTRIBUTE_TOKEN_OPTIONS / WUXING_ATTRIBUTE_TOKEN_OPTIONS）
  const SOUL_SYSTEMS = ['无', '元素', '五行'];
  const ELEMENTS = ['金', '木', '水', '火', '土', '风', '雷', '冰', '光', '暗', '精神', '空间', '时间', '创造', '毁灭'];
  const WUXING = ['金', '木', '水', '火', '土'];
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-callable]'); if (!t) return;
    const { path, x, on } = JSON.parse(t.dataset.callable), next = on.includes(x) ? on.filter(v => v !== x) : [...on, x];
    window.COCKPIT.write([{ path, value: next.length ? next : ['无'] }]);
  });
  // 结构化效果：读 _效果数组，把「原型 / 目标 / 数值 / 持续 / 条件分支」变成图标行，原文折叠
  // 标题写出原型的关键字段（改哪项属性、施加什么状态……），只写原型名等于没说；字段口径同设计台原型字段表
  const txt = v => (Array.isArray(v) ? v : [v]).map(x => String(x ?? '').trim()).filter(Boolean).join('、');
  const neg = e => String(e.数值 ?? '').trim().startsWith('-');
  // 结算修正：按结算项和正负说成玩家的话（造成伤害 +20% = 增伤，受到伤害 -20% = 减伤）；
  // 方向词已含正负时数值只给幅度（减伤 20%，不写 -20%），颜色按对持有者有利与否（good）
  const SETTLE = {
    造成伤害: ['burst', '增伤', '输出降低'],
    受到伤害: ['shield-halved', '易伤', '减伤', true],
    治疗: ['hand-holding-medical', '治疗增强', '治疗削弱'],
    消耗: ['fire-flame-curved', '消耗增加', '消耗降低', true],
    前摇: ['hourglass-half', '前摇延长', '前摇缩短', true],
    技能效果: ['wand-sparkles', '技能效果增强', '技能效果减弱'],
  };
  const absorbTitle = (src, res) => src === '受到伤害' ? `受击转化${res}` : res === '生命' ? '吸血' : `伤害转化${res}`;
  const settleFx = e => {
    const k = txt(e.结算), d = SETTLE[k], el = txt(e.限定元素).replace(/^无$/, ''), pre = el ? `${el}系` : '';
    if (d) { const down = neg(e), good = d[3] ? down : !down;
      return { icon: d[0], title: pre + (down ? d[2] : d[1]), good, mag: true }; }
    // 这些结算的数值都是正向百分比，标题已说明作用，数值只给幅度；易混的几项悬停说明区别（同设计台原型说明）
    const to = txt(e.转移对象) || '攻击者';
    const T = {
      反伤: ['arrow-rotate-left', '反伤', '自己照常承受伤害，再按比例把伤害反弹给攻击者'],
      伤害转移: ['people-arrows', `受伤转嫁给${to}`, `受到的伤害按比例改由${to}承担，自己少受这部分；不同于反伤（反伤自己照常承受）`],
      伤害吸收: ['magnet', absorbTitle(txt(e.吸收来源) || '造成伤害', txt(e.吸收资源) || '生命'), '按比例把伤害量转成资源'],
      伤害转治疗: ['heart-circle-plus', '伤害转为治疗', '受到的伤害按比例变成治疗'],
      治疗转伤害: ['heart-crack', '治疗转为伤害', '受到的治疗按比例变成伤害'],
      伤害分摊: ['users', '伤害分摊', '受到的伤害按比例分给队友承担'],
      消耗分摊: ['users', '消耗分摊', '施放消耗按比例分给队友承担'],
      防御穿透: ['hammer', '破甲', '无视目标一部分防御'],
      防御剥夺: ['shield-virus', '削减防御', ''],
      精神抗性剥夺: ['brain', '削减精神抗性', ''],
      反击: ['hand-fist', '反击', '受击后按比例发动一次攻击'],
      持续伤害引爆: ['explosion', '引爆持续伤害', '把目标身上的持续伤害提前一次性结算'],
    }[k];
    return T ? { icon: T[0], title: pre + T[1], mag: true, hint: T[2] } : { icon: 'shield-halved', title: `${k || '结算'}修正` };
  };
  const FX = {
    资源变化: e => ({ icon: String(e.资源 || '').includes('魂力') ? 'fire-flame-curved' : 'heart-pulse', title: `${neg(e) ? '削减' : '恢复'}${txt(e.资源) || '资源'}` }),
    资源转移: e => ({ icon: 'right-left', title: `${txt(e.资源转移方式) || '转移'}${txt(e.资源) || '资源'}` }),
    资源锁定: e => ({ icon: 'lock', title: `${txt(e.资源) || '资源'}${txt(e.锁定类型) || '锁定'}` }),
    属性修正: e => ({ icon: neg(e) ? 'arrow-trend-down' : 'arrow-trend-up', title: `${txt(e.属性) || '属性'}${neg(e) ? '降低' : '提升'}` }),
    属性变化: e => ({ icon: 'arrow-trend-up', title: `${txt(e.属性) || '属性'}变化` }),
    判定修正: e => ({ icon: 'crosshairs', title: `${txt(e.判定) || '判定'}${neg(e) ? '下降' : '提升'}` }),
    结算修正: e => settleFx(e),
    护盾变化: e => ({ icon: 'shield', title: txt(e.护盾模式) === '正向护盾' || !txt(e.护盾模式) ? '护盾' : txt(e.护盾模式) }),
    伤害结算: e => ({ icon: 'burst', title: txt(e.伤害类型) || '伤害' }),
    状态施加: e => ({ icon: 'circle-radiation', title: `施加${txt(e.状态) || '状态'}` }),
    状态移除: e => ({ icon: 'broom', title: `移除${txt(e.状态) || txt(e.匹配原型) || '状态'}` }),
    状态转移: e => ({ icon: 'arrows-turn-to-dots', title: `转移${txt(e.状态) || '状态'}` }),
    状态交换: e => ({ icon: 'arrows-rotate', title: `交换${txt(e.状态) || '状态'}` }),
    时窗修正: e => ({ icon: 'clock-rotate-left', title: `${txt(e.调整方式) || '调整'}${txt(e.调整字段) || '时窗'}` }),
    规则防御: e => ({ icon: 'shield-heart', title: txt(e.规则) || '规则防御' }),
    规则改写: e => ({ icon: 'scale-balanced', title: `改写${txt(e.规则) || '规则'}` }),
    位移执行: e => ({ icon: 'person-running', title: txt(e.位移类型) || '位移' }),
    决策干扰: e => ({ icon: 'brain', title: txt(e.干扰) || '决策干扰' }),
    修炼增益: e => ({ icon: 'seedling', title: `${txt(e.修炼属性) || txt(e.训练方式) || '修炼'}增益` }),
    召唤生成: e => ({ icon: 'ghost', title: `召唤${txt(e.召唤物名称) || txt(e.召唤单位类型) || ''}` }),
    机制授予: () => ({ icon: 'bolt', title: '获得能力' }),
  };
  const fxOf = e => (FX[e.原型] || (() => ({ icon: 'bolt', title: e.原型 || '效果' })))(e);
  // 数值：伤害结算没有「数值」，给威力倍率（百分比口径，基准 100）与段数
  const fxVal = (c, e) => !c.blank(e.数值) ? String(e.数值).trim().replace(fxOf(e).mag ? /^[+-]\s*/ : /^$/, '') : e.原型 === '伤害结算' && e.威力倍率 != null ? `${e.威力倍率}%${Number(e.攻击段数) > 1 ? ` × ${e.攻击段数} 段` : ''}` : '';
  const fxRow = (c, e) => {
    if (e.原型 === '机制授予') return grantRow(c, e);
    const f = fxOf(e), down = f.good === undefined ? neg(e) : !f.good;
    const meta = [e.目标, e.持续回合 ? `持续 ${c.fmt(e.持续回合)} 回合` : '', e.生效方式].filter(Boolean).map(c.esc).join(' · ');
    return `<div class="fx"><span class="ic ${down ? 'down' : ''}"><i class="fa-solid fa-${f.icon}"></i></span><strong${f.hint ? ` data-hint="${c.esc(f.hint)}"` : ''}>${c.esc(f.title)}</strong><span class="v ${down ? 'down' : ''}">${c.esc(fxVal(c, e))}</span><small>${meta}</small></div>`;
  };
  // 机制授予是容器：不单列一行「机制授予」，头部写谁获得、何时生效、可用次数，下面直接列授予的效果
  const GRANT_WHEN = { 主动触发: '主动使用时生效', 随下次行动触发: '下次行动时生效', 下次魂技成功释放: '下次魂技成功释放时生效' };
  const GRANT_WHO = { 自身: '自身获得', 单体: '目标获得', 群体: '群体获得', 全场: '全场获得' };
  const grantRow = (c, e) => {
    const bits = [GRANT_WHEN[e.触发条件] || e.触发条件 || GRANT_WHEN.主动触发, e.可用次数 ? `可用 ${c.fmt(e.可用次数)} 次` : '', e.持续回合 ? `持续 ${c.fmt(e.持续回合)} 回合` : ''].filter(Boolean).map(c.esc).join(' · ');
    const rows = (e.授予效果 || []).map(x => fxRow(c, x) + (x.条件分支 || []).map(b => branchRow(c, b)).join('')).join('');
    return `<div class="fx-grant"><div class="fx-grant-h"><i class="fa-solid fa-bolt"></i><b>${c.esc(GRANT_WHO[e.目标] || `${e.目标 || '自身'}获得`)}</b><span>${bits}</span></div>${rows || '<small>未填写授予效果</small>'}</div>`;
  };
  const branchRow = (c, b) => {
    const cond = (b.条件 || []).map(x => `${x.类型 === '使用者' ? '食用者' : c.esc(x.类型)}是${c.esc(x.值)}`).join('且');
    // 处理四种（同设计台）：生效 = 满足才生效；替换效果 = 改为；追加效果 = 另加；禁用 = 满足时不生效
    const list = es => (es || []).map(e => `${c.esc(fxOf(e).title)} ${c.esc(fxVal(c, e))}`.trim()).join('、');
    const act = b.处理 === '替换效果' ? `改为 ${list(b.替换效果)}` : b.处理 === '追加效果' ? `追加 ${list(b.追加效果)}` : b.处理 === '禁用' ? '不生效' : '才生效';
    return `<div class="fx-if"><i class="fa-solid fa-code-branch"></i><span>若${cond}：${act}</span></div>`;
  };
  // compact：悬停预览只给「效果 + 代价」，点击钉住后才展开产物、画面、原文与操作
  const skillDetail = (c, sk, compact = false, page = false) => {
    const cond = sk.使用条件 || {}, lim = sk.触发限制, mast = sk.技能掌控度;
    // _效果数组 两种形态：造物承载是「包」列表（数量 / 有效期 / 使用效果），其余承载直接是效果列表——后者包成一个包
    const list = Array.isArray(sk._效果数组) ? sk._效果数组.filter(Boolean) : [], pkgs = list.some(p => Array.isArray(p.使用效果)) ? list : list.length ? [{ 使用效果: list }] : [];
    const sp = typeof sk.消耗 === 'object' ? c.num(sk.消耗?.魂力) : 0, pool = c.num(c.st.魂力), casts = sp ? Math.floor(pool / sp) : 0;
    if (compact) return `<div class="insp-head">${sk.ring ? c.ringMedal(sk.ring, String(sk.ring.slot || '').replace(/\D/g, '')) : c.sock('book', 'gd')}<div><strong style="font-size:1.1em">${c.esc(sk.魂技名)}</strong><br><small>${sk.ring ? `${c.esc(sk.ring.slot)} · ${c.yearTier(sk.ring.年限)} · ${c.fmt(sk.ring.年限)} 年` : c.esc(sk.group)}${!c.blank(sk.承载方式) ? ' · ' + c.esc(sk.承载方式) : ''}</small></div></div>
      ${pkgs.flatMap(p => (p.使用效果 || []).map(e => fxRow(c, e) + (e.条件分支 || []).map(b => branchRow(c, b)).join(''))).join('')}
      <div class="peek-cost"><span><i class="fa-solid fa-fire-flame-curved"></i> ${sp ? `魂力 ${c.fmt(sp)} · 可放 ${casts} 次` : costText(c, sk.消耗)}</span><span><i class="fa-solid fa-hourglass-half"></i> 前摇 ${c.fmt(sk.前摇 || 0)}</span></div>
      <small class="peek-hint">点击钉住，查看产物、画面与施展</small>`;
    return `<div class="insp-head">${sk.ring ? c.ringMedal(sk.ring, String(sk.ring.slot || '').replace(/\D/g, '')) : c.sock('book', 'gd')}<div><strong style="font-size:1.15em">${c.esc(sk.魂技名)}</strong><br><small>${c.esc(sk.group)} · ${c.esc(sk.from)}</small></div>${page ? '' : '<button class="x" type="button" data-close-inspector aria-label="关闭">×</button>'}</div>
      <div style="display:flex;gap:.35em;flex-wrap:wrap">${sk.ring ? `<span class="chip">${c.yearTier(sk.ring.年限)} · ${c.fmt(sk.ring.年限)} 年</span>` : ''}${!c.blank(sk.承载方式) ? `<span class="chip s">${c.esc(sk.承载方式)}</span>` : ''}${sk.触发方式 ? `<span class="chip s">触发：${c.esc(sk.触发方式)}</span>` : ''}${(sk.附带属性 || []).map(a => `<span class="chip s">${c.esc(a)}</span>`).join('')}</div>
      ${pkgs.length ? `<section class="sec"><h3>效果</h3>${pkgs.map(p => `${(p.使用效果 || []).map(e => fxRow(c, e) + (e.条件分支 || []).map(b => branchRow(c, b)).join('')).join('')}${p.有效期tick || p.数量 ? `<small style="padding-left:.2em">产出 ${c.fmt(p.数量 || 1)} 份${p.有效期tick ? ` · 有效期 ${Math.floor(p.有效期tick / 6)} 小时` : ''}</small>` : ''}`).join('')}</section>` : ''}
      ${sk.ring && (sk.group === '魂环魂技' || sk.group === '独立魂环魂技') ? (rp => { const rows = [['palette', '颜色', c.ed(sk.ring.颜色 || '无', [...rp, '颜色'], { kind: 'enum', options: ['白', '黄', '紫', '黑', '红', '金', '无'] })], ['hourglass-half', '年限', c.ed(c.fmt(sk.ring.年限), [...rp, '年限'], { kind: 'number', integer: true, min: 0, raw: c.num(sk.ring.年限) })], ['map-pin', '来源', c.ed(c.blank(sk.ring.来源) ? '未记录' : sk.ring.来源, [...rp, '来源'], { raw: c.blank(sk.ring.来源) ? '' : sk.ring.来源 })]];
        // 典籍主屏用数据块；浮窗里仍是紧凑的键值行
        return `<section class="sec"><h3>魂环</h3>${page ? `<div class="tiles three">${rows.map(([i, l, v]) => `<div class="tile">${c.sock(i)}<b>${v}</b><small>${l}</small></div>`).join('')}</div>` : c.kv(rows.map(([, l, v]) => [l, v]))}</section>`; })(c.P(...sk.key.split('/').slice(0, sk.group === '独立魂环魂技' ? 2 : 3))) : ''}
      <section class="sec"><h3>代价</h3>
        <div style="display:grid;grid-template-columns:auto minmax(0,1fr);gap:.4em .9em;align-items:center">
          ${sp ? `<span class="sock sp" style="--s:2em"><i class="fa-solid fa-fire-flame-curved"></i></span><div><strong class="num" style="font-size:1.25em">魂力 ${c.fmt(sp)}</strong> <small>当前可连续施放 ${casts} 次</small><div class="pips" style="margin-top:.3em">${Array.from({ length: Math.min(12, Math.max(casts, 1)) }, (_, i) => `<i class="${i < casts ? 'on' : 'off'}"></i>`).join('')}</div></div>` : `<span class="sock" style="--s:2em"><i class="fa-solid fa-feather"></i></span><strong>${costText(c, sk.消耗)}</strong>`}
          <span class="sock" style="--s:2em"><i class="fa-solid fa-hourglass-half"></i></span><div><strong>前摇 ${c.fmt(sk.前摇 || 0)}</strong>${sk.场外冷却至tick ? ` <small>· 冷却至 ${c.tickDate(sk.场外冷却至tick)}</small>` : ''}</div>
        </div>
        ${c.kv([(cond.最低等级 || cond.最低魂力 || cond.最低精神力) ? ['条件', [cond.最低等级 ? `≥${cond.最低等级} 级` : '', cond.最低魂力 ? `魂力 ≥${c.fmt(cond.最低魂力)}` : '', cond.最低精神力 ? `精神 ≥${c.fmt(cond.最低精神力)}` : ''].filter(Boolean).join(' · ')] : null, lim ? ['限制', `${c.esc(lim.周期)} ${c.fmt(lim.次数)} 次`] : null, mast ? ['掌控度', `${c.fmt(mast.中心等级)} → ${c.fmt(mast.圆满等级)} 级圆满`] : null, sk.限定来源 ? ['限定来源', c.esc(sk.限定来源)] : null])}
      </section>
      ${!c.blank(sk.产物描述) ? `<section class="sec"><h3>产物</h3><div style="display:flex;gap:.7em;align-items:flex-start"><span class="sock gd" style="--s:2.2em;flex:none"><i class="fa-solid fa-cube"></i></span><p class="quote" style="flex:1">${c.esc(sk.产物描述)}</p></div></section>` : ''}
      ${!c.blank(sk.画面描述) ? `<section class="sec"><h3>画面</h3><p class="quote">${c.esc(sk.画面描述)}</p></section>` : ''}
      ${!c.blank(sk.效果描述) ? `<details class="fold"><summary>效果原文</summary><p class="quote" style="margin-top:.5em">${c.esc(sk.效果描述)}</p></details>` : ''}
      ${page ? '' : `<div style="display:flex;gap:.4em">${castBtn(c, sk, ' style="flex:1;font-size:.95em;margin:0"')}${sk.group === '复制效果' ? '' : `<button class="key-s" type="button" data-go="page-ability/design" data-go-set="skill=${c.esc(sk.key)};dtab=basic"><i class="fa-solid fa-pen-ruler"></i> 设计</button>`}</div>`}`;
  };
  // 日常施展：被动 / 血脉特性是常驻效果，不给施放；魂力不够时锁定并在悬停说明；可施放的走原地确认条（结算由叙事 / 运行时）
  // 技能在存档里的路径（原项目场外施展执行器按路径定位技能）；来自物品定义的装备 / 魂骨技能没有角色路径，不能场外施展
  const skillPath = (c, sk) => {
    const k = String(sk.key || '').split('/'), P = (...p) => ['char', c.name, ...p];
    switch (sk.group) {
      case '魂环魂技': case '独立魂环魂技': return P(...k);
      case '自创魂技': return P('自创魂技', k.slice(1).join('/'));
      case '魂骨附带': case '装备技能': return sk.srcPath?.[0] === 'char' ? sk.srcPath : null;
      case '血脉散技': return P('血脉之力', '技能', k.slice(1).join('/'));
      case '血脉魂环': return P('血脉之力', k[1], k.slice(2).join('/'));
      case '复制效果': return P('复制效果', k[1], '技能列表', k.slice(2).join('/'));
      case '武魂融合技': return P('武魂融合技', k.slice(1).join('/'), '技能数据');
      default: return null;
    }
  };
  const castBtn = (c, sk, extra = '') => {
    if (sk.承载方式 === '被动' || sk.group === '血脉特性') return `<button class="cta" type="button" disabled${extra}><i class="fa-solid fa-infinity"></i>被动生效</button>`;
    const lock = (label, why, icon = 'hand-sparkles') => `<span class="cta-wrap" data-hint="${c.esc(why)}"><button class="cta" type="button" disabled${extra}><i class="fa-solid fa-${icon}"></i>${label}</button></span>`;
    const path = skillPath(c, sk), st = path ? window.COCKPIT.preview('skill', { path }) : null;
    // lwcs：与原项目技能卡同一判定
    if (st) {
      if (!st.kind) return lock('战斗中施展', st.reason || '这个技能只能在战斗中施展', 'khanda');
      const label = st.kind === 'construct' ? '日常施展' : '使用';
      if (st.cooling) return lock('冷却中', st.reason, 'hourglass-half');
      return `<button class="cta" type="button"${extra} data-confirm="${c.esc(`${label}「${sk.魂技名}」`)}" data-act="${c.esc(JSON.stringify({ name: 'skill', path }))}"><i class="fa-solid fa-hand-sparkles"></i>${label}</button>`;
    }
    if (window.COCKPIT.rt('__LWCS_ERA_RUNTIME_INTEGRATION_V1__') && !path) return lock('日常施展', '这个技能来自物品定义，装备后在角色身上施展');
    const sp = typeof sk.消耗 === 'object' ? c.num(sk.消耗?.魂力) : 0, short = sp > 0 && c.num(c.st.魂力) < sp;
    const btn = `<button class="cta" type="button"${extra}${short ? ' disabled' : ` data-confirm="${c.esc(`日常施展「${sk.魂技名}」${sp ? `，消耗魂力 ${c.fmt(sp)}` : ''}`)}"`}><i class="fa-solid fa-hand-sparkles"></i>日常施展</button>`;
    return short ? `<span class="cta-wrap" data-hint="魂力不足：需要 ${c.fmt(sp)}">${btn}</span>` : btn;
  };
  const skillInspect = (c, kind, key, mode) => { const sk = allSkills(c).find(x => x.key === key); return sk ? skillDetail(c, sk, mode === 'hover') : ''; };
  window.COCKPIT.skillCard = (c, key, mode) => skillInspect(c, 'sk', key, mode);
  // 魂灵卡：标题行（名称 · 年限）+ 品质 / 契合 / 状态 / 对标芯片 + 描述；full 时附六项属性条（按对标面板自身最大值归一）
  const spiritCard = (c, sp, full = false) => {
    const p = sp.战力面板, stats = p ? [['str', '力量'], ['def', '防御'], ['agi', '敏捷'], ['vit_max', '体魄'], ['men_max', '精神'], ['sp_max', '魂力']].map(([k, l]) => [l, c.num(p[k])]) : [];
    const peak = Math.max(1, ...stats.map(x => x[1]));
    return `<div class="spirit-card">
      <div class="sc-head">${c.sock('paw', 'gd')}<div><strong>${c.esc(sp.表象名称)}</strong><small>${c.esc(sp.slot || '')}</small></div><b class="num">${c.fmt(sp.年限)}<small>年</small></b></div>
      <div class="sc-chips"><span class="chip-s">品质 ${c.esc(sp.品质)}</span><span class="chip-s">契合 ${c.fmt(sp.契合度)}%</span><span class="chip-s">${c.esc(sp.状态)}</span>${p ? `<span class="chip-s">对标 ${c.fmt(p.对标等级)} 级</span>` : ''}</div>
      ${full && !c.blank(sp.描述) ? `<p class="narr">${c.esc(sp.描述)}</p>` : ''}
      ${full && stats.length ? `<div class="sc-stats">${stats.map(([l, v]) => `<div><span>${l}</span><i><b style="width:${(v / peak * 100).toFixed(1)}%"></b></i><em>${c.fmt(v)}</em></div>`).join('')}</div>` : ''}
    </div>`;
  };

  // 武魂：左翼 = 武魂列表与魂技列表（悬停出魂技卡，点击钉住），主屏 = 选中武魂档案（投影台魂环塔为主体，魂灵档案在下），
  // 右翼 = 按当前魂力的施放次数与血脉
  // 魂环待选：左翼候选魂灵 → 主屏所选魂灵（年限、品质、契合度、魂环余量、本次魂环颜色）→ 右翼汇总与生成 / 暂缓
  const ringPick = (c, p) => {
    const ui = c.state.ui, list = p.candidates || [], cur = list.find(x => x.soulName === ui.ringCand) || list[0];
    const ringOf = x => ({ 年限: x.ageValue });
    const go = cur ? `<button class="cta" type="button" data-confirm="${c.esc(`用「${cur.displayName}」生成第 ${p.ringIndex} 魂环`)}" data-act="${c.esc(JSON.stringify({ name: 'ring', op: 'generate', candidate: cur.soulName }))}"><i class="fa-solid fa-circle-plus"></i>生成魂环</button>`
      : `<span class="cta-wrap" data-hint="当前没有可选魂灵，请先通过剧情补足候选魂灵"><button class="cta" type="button" disabled><i class="fa-solid fa-circle-plus"></i>生成魂环</button></span>`;
    return {
      tag: 'CORE · SOUL RING',
      left: `<div class="pad">${c.head('ghost', '候选魂灵', 'Candidates', 'gd')}
        ${list.length ? `<div class="list">${list.map(x => `<button class="row${x === cur ? ' on' : ''}" type="button" data-set="ringCand=${c.esc(x.soulName)}" aria-current="${x === cur}">${c.ringMedal(ringOf(x), '')}<div><strong>${c.esc(x.displayName)}</strong><small>${c.esc([x.ageText, x.quality].filter(Boolean).join(' · '))}</small></div><span class="chip s" data-hint="契合度">${c.fmt(x.compValue)}%</span></button>`).join('')}</div>` : c.empty('ghost', '没有候选魂灵', '请先通过剧情补足候选魂灵')}
      </div>`,
      core: cur ? `<div class="pad detail ring-pick">
        <div class="q-title">${c.sock('circle-plus', 'gd')}<span class="chip">第 ${p.ringIndex} 魂环</span><h2>${c.esc(cur.displayName)}</h2><span class="q-state">${c.esc(cur.state)}</span></div>
        <div class="soul-card"><div class="soul-stage">${c.ringStage([{ 年限: cur.ageValue, slot: `第${p.ringIndex}魂环`, skills: [] }], () => '')}</div><small class="lbl">本次魂环 · ${c.esc(cur.nextRingColorLabel)}</small></div>
        <div class="tiles">
          <div class="tile">${c.sock('hourglass-half', 'gd')}<b>${c.esc(cur.ageText)}</b><small>年限</small></div>
          <div class="tile">${c.sock('gem')}<b>${c.esc(cur.quality)}</b><small>品质</small></div>
          <div class="tile">${c.sock('link')}<b>${c.fmt(cur.compValue)}%</b><small>契合度</small></div>
          <div class="tile">${c.sock('circle-notch')}<b>${c.fmt(cur.ringCount)} / ${c.fmt(cur.ringCapacity)}</b><small>魂灵已附魂环 / 上限</small></div>
          <div class="tile">${c.sock('layer-group')}<b>${c.fmt(cur.remainingAfterGenerate)}</b><small>生成后剩余环位</small></div>
        </div>
        <section class="sec"><h3>魂灵描述<span class="en">Spirit</span></h3><p class="prose">${c.esc(cur.description)}</p></section>
      </div>` : `<div class="pad sparse">${c.empty('ghost', '没有候选魂灵', '请先通过剧情补足候选魂灵')}</div>`,
      right: `<div class="pad">${c.head('circle-plus', '魂环生成', 'Soul Ring', 'gd')}
        ${c.kv([['角色', c.esc(p.charName)], ['武魂', c.esc(p.spiritName)], ['魂环位', `第 ${p.ringIndex} 魂环`], ['状态', c.esc(p.status)]])}
        ${go}
        <div class="act-row"><button class="key-s" type="button" data-confirm="暂缓生成这枚魂环" data-act='{"name":"ring","op":"defer"}'><i class="fa-solid fa-pause"></i> 暂缓</button><button class="key-s" type="button" data-set="ringPick="><i class="fa-solid fa-chevron-left"></i> 返回武魂</button></div>
      </div>`,
    };
  };
  const martial = c => {
    const pending = window.COCKPIT.pending?.()?.soulRing;
    if (c.state.ui.ringPick && pending) return ringPick(c, pending);
    const { soul, idx } = pickSoul(c);
    if (!soul) return { tag: 'CORE · MARTIAL SOUL', wide: 'both', core: `<div class="pad sparse">${c.empty('fire', '尚未记录武魂')}</div>`, railL: '', railR: '' };
    const pool = c.num(c.st.魂力);
    const pendRing = c.ch.状态?.待选魂环 && typeof c.ch.状态.待选魂环 === 'object' ? c.ch.状态.待选魂环 : null;
    const bl = c.ch.血脉之力 || {}, blOn = !c.blank(bl.血脉);
    const skills = [...soul.spirits.flatMap(p => p.rings.map(r => ({ p, r, sk: r.skills[0] }))), ...(soul.direct || []).map(r => ({ p: null, r, sk: r.skills[0] }))].filter(x => x.sk);
    const skKey = ({ p, r, sk }) => c.esc(p ? `${soul.slot}/${p.slot}/${r.slot}/${sk.slot}` : `${soul.slot}/${r.slot}/${sk.slot}`);
    return {
      tag: 'CORE · MARTIAL SOUL',
      left: `<div class="pad">${c.head('fire', '武魂', 'Martial Souls', 'gd')}
        <div class="list">${c.souls.map((s, i) => `<button class="row${i === idx ? ' on' : ''}" type="button" data-set="soul=${i}" aria-current="${i === idx}">${c.sock('fire', i === idx ? 'gd' : '')}<div><strong>${c.esc(s.表象名称)}</strong><small>${c.esc([s.slot, s.系别, `${s.rings.length} 环`].filter(Boolean).join(' · '))}</small></div><span></span></button>`).join('')}</div>
        <section class="sec grow"><h3 class="door" data-go="page-ability/codex" data-go-set="skg=全部" role="link" tabindex="0">魂技<span class="en">${skills.length}</span>${c.hint('悬停查看魂技卡，点击钉住；完整档案与编辑在「典籍」。')}</h3>
        ${skills.length ? `<div class="list q-list">${skills.map(x => `<button class="row" type="button" data-inspect="sk:${skKey(x)}">${c.ringMedal(x.r, x.r.slot.replace(/\D/g, ''), true)}<div><strong>${c.esc(x.sk.魂技名)}</strong><small>${c.yearTier(x.r.年限)} · ${costText(c, x.sk.消耗)} · 前摇 ${c.fmt(x.sk.前摇 || 0)}</small></div><i class="fa-solid fa-chevron-right"></i></button>`).join('')}</div>` : '<span class="lbl">尚未附环</span>'}</section>
      </div>`,
      core: `<div class="pad detail martial-core">
        <div class="q-title">${c.sock('fire', 'gd')}<span class="chip">${c.esc(soul.slot)}</span><h2>${c.ed(soul.表象名称, [...c.P(soul.slot), '表象名称'])}</h2></div>
        ${pendRing ? `<div class="banner"><i class="fa-solid fa-circle-plus"></i><div><strong>有一枚待生成的魂环</strong><small>${c.esc(pending ? [pending.spiritName, `第 ${pending.ringIndex} 魂环`, `候选 ${pending.candidates.length} 只`, pending.status !== '待选择' ? pending.status : ''].filter(Boolean).join(' · ') : Object.entries(pendRing).slice(0, 3).map(([k, v]) => `${k} ${typeof v === 'object' ? '' : v}`).join(' · '))}</small></div>${pending ? '<button class="key-s" type="button" data-set="ringPick=1">选择魂灵生成</button>' : ''}<button class="key-s" type="button" data-confirm="暂缓生成这枚魂环" data-act='{"name":"ring","op":"defer"}'>暂不生成</button></div>` : ''}
        <div class="plaques"><span class="plq">${c.ed(c.blank(soul.系别) ? '未定系别' : soul.系别, [...c.P(soul.slot), '系别'], { raw: c.blank(soul.系别) ? '' : soul.系别 })}</span><span class="plq steel">属性 · ${c.ed(soul.属性体系 || '无', [...c.P(soul.slot), '属性体系'], { kind: 'enum', options: SOUL_SYSTEMS })}</span></div>
        ${soul.属性体系 && soul.属性体系 !== '无' ? (on => `<div class="chips-row callable"><span class="lbl">可调用${c.hint('点选这个武魂能调用的元素。')}</span>${(soul.属性体系 === '五行' ? WUXING : ELEMENTS).map(x => `<button class="key-s mini${on.includes(x) ? ' on' : ''}" type="button" aria-pressed="${on.includes(x)}" data-callable="${c.esc(JSON.stringify({ path: [...c.P(soul.slot), '可调用元素'], x, on }))}">${c.esc(x)}</button>`).join('')}</div>`)((soul.可调用元素 || []).filter(x => x && x !== '无')) : ''}
        <p class="narr">${c.ed(c.blank(soul.描述) ? '未记录' : soul.描述, [...c.P(soul.slot), '描述'], { kind: 'text', raw: c.blank(soul.描述) ? '' : soul.描述 })}</p>
        <div class="martial-stage">${soul.rings.length ? `<div class="soul-card" data-scan data-float="r"><div class="soul-stage">${c.ringStage(soul.rings, r => { const p = soul.spirits.find(x => x.rings.includes(r)), sk = r.skills[0]; return sk && (p || r.independent) ? `data-inspect="sk:${skKey({ p, r, sk })}"` : ''; })}</div></div>`
          : `<div class="soul-card"><div class="soul-stage"><div class="soul-empty"><i></i><span>尚未附环</span></div></div><small class="lbl">下一魂环于 ${Math.floor(c.num(c.st.等级) / 10 + 1) * 10} 级开放</small></div>`}
        <div class="spirit-grid">${soul.spirits.map(p => `<div class="spirit-link" data-inspect="spirit:${c.esc(`${soul.slot}/${p.slot}`)}" tabindex="0">${spiritCard(c, p)}<i class="fa-solid fa-circle-info"></i></div>`).join('')}</div></div>
      </div>`,
      right: `<div class="pad">
        ${c.head('fire-flame-curved', '施放次数', 'Casts', 'sp')}
        <div class="need"><span>当前魂力</span><b>${c.fmt(pool)} / ${c.fmt(c.st.魂力上限)}</b></div>
        ${skills.length ? `<div class="casts">${skills.map(x => { const cost = typeof x.sk.消耗 === 'object' ? c.num(x.sk.消耗?.魂力) : 0; return `<button class="cast" type="button" data-inspect="sk:${skKey(x)}" data-go="page-ability/codex" data-go-set="skg=全部;sksel=${skKey(x)}"><div><strong>${c.esc(x.sk.魂技名)}</strong><small>${cost ? `每次 ${c.fmt(cost)} 魂力` : '无魂力消耗'}</small></div><b>×${cost ? Math.floor(pool / cost) : '∞'}</b></button>`; }).join('')}</div>` : '<span class="lbl">尚无可施放的魂技</span>'}
        ${blOn ? `<div class="groove"></div>${c.head('droplet', bl.血脉, 'Bloodline', 'hp')}${c.kv([['血脉', c.ed(bl.血脉, c.P('血脉之力', '血脉'))], ['解封层数', c.ed(c.fmt(bl.解封层数 || 0), c.P('血脉之力', '解封层数'), { kind: 'number', integer: true, min: 0, raw: c.num(bl.解封层数) })], ['气血魂核', c.ed(bl.核心 || '未凝聚', c.P('血脉之力', '核心'), { raw: bl.核心 || '' })], ['生命之火', bl.生命之火 ? '已点燃' : '未点燃']])}${allSkills(c).filter(s => BLOOD_CHIP[s.group]).map(s => `<button class="row" type="button" data-inspect="sk:${c.esc(s.key)}"><span class="chip s">${BLOOD_CHIP[s.group]}</span><div><strong>${c.esc(s.魂技名)}</strong></div><i class="fa-solid fa-chevron-right"></i></button>`).join('')}` : ''}
        ${(n => `<button class="tile door self-made" type="button" data-go="page-ability/design" data-hint="设计台">${c.sock('pen-ruler', 'gd')}<b>${n} 项</b><small>${window.COCKPIT.pending()?.skillDesign ? '有待确认的设计' : '自创魂技'}</small></button>`)(c.entries(c.ch.自创魂技).length)}
      </div>`,
    };
  };

  // 典籍：左翼 = 来源筛选 + 技能列表，主屏 = 选中技能完整档案（效果 / 魂环 / 代价 / 产物 / 画面 / 原文），右翼 = 施展 / 设计与新建
  const codex = c => {
    const all = allSkills(c), have = SOURCE_GROUPS.filter(g => all.some(s => s.group === g));
    const grp = c.state.ui.skg && (c.state.ui.skg === '全部' || have.includes(c.state.ui.skg)) ? c.state.ui.skg : '全部';
    const shown = grp === '全部' ? all : all.filter(s => s.group === grp), sel = shown.find(s => s.key === c.state.ui.sksel) || shown[0];
    const src = !sel ? null : sel.group === '魂骨附带' ? ['page-supplies/bones', `bonesel=${sel.key.split('/')[1]}`, '魂骨'] : sel.group === '装备技能' ? ['page-supplies/equip', `eqsel=${sel.slotPath?.[0] || ''}`, '装备'] : sel.ring || BLOOD_CHIP[sel.group] ? ['page-ability/martial', '', '武魂'] : null;
    return {
      tag: 'CORE · CODEX',
      left: `<div class="pad">${c.head('book', '典籍', 'Codex', 'gd')}
        ${c.search('codex', '技能名或来源')}
        <div class="pick-row">${c.pick('skg', grp, [{ value: '全部', label: `全部 · ${all.length}` }, ...have.map(g => ({ value: g, label: `${g} · ${all.filter(s => s.group === g).length}` }))])}</div>
        ${shown.length ? `<div class="list q-list">${shown.map(s => `<button class="row${s === sel ? ' on' : ''}" type="button" data-set="sksel=${c.esc(s.key)}" aria-current="${s === sel}">${s.ring ? c.ringMedal(s.ring, s.ring.slot.replace(/\D/g, ''), true) : c.sock(s.group === '装备技能' ? 'shield-halved' : s.group === '魂骨附带' ? 'bone' : 'book')}<div><strong>${c.esc(s.魂技名)}</strong><small>${c.esc(s.from)}</small></div><span></span></button>`).join('')}</div>` : c.empty('book', '还没有任何技能', '附环、装备或自创后会出现在这里')}
      </div>`,
      core: sel ? `<div class="pad detail">${skillDetail(c, sel, false, true)}</div>` : `<div class="pad sparse">${c.empty('book', '还没有任何技能')}</div>`,
      right: `<div class="pad">
        ${sel ? `${c.head('hand-sparkles', '施展', 'Cast')}
        <div class="acts">${castBtn(c, sel)}
        ${sel.group === '复制效果' ? '' : `<button class="key-s" type="button" data-go="page-ability/design" data-go-set="skill=${c.esc(sel.key)};dtab=basic"><i class="fa-solid fa-pen-ruler"></i> 在设计台编辑</button>`}
        ${src ? `<button class="key-s" type="button" data-go="${src[0]}"${src[1] ? ` data-go-set="${c.esc(src[1])}"` : ''}><i class="fa-solid fa-location-arrow"></i> 查看来源 · ${src[2]}</button>` : ''}</div>
        <div class="groove"></div>` : ''}
        ${c.head('plus', '新建', 'Create')}
        <div class="acts"><button class="key-s" type="button" data-go="page-ability/design" data-go-set="dtab=basic" data-dz2-new="自创魂技"><i class="fa-solid fa-plus"></i> 新建自创魂技</button><button class="key-s" type="button" data-go="page-ability/design" data-go-set="dtab=basic" data-dz2-new="武魂融合技"><i class="fa-solid fa-link"></i> 新建武魂融合技</button></div>
      </div>`,
    };
  };
  document.addEventListener('picker:change', e => { if (e.detail.path !== 'skg') return; const c = window.COCKPIT.ctx(); Object.assign(c.state.ui, { skg: e.detail.value, sksel: '' }); window.COCKPIT.refresh(); });


  // 技能设计台的预算仪表与对抗试算（界面与表单在 designer-ui.js）：预算直接调用原项目 COST 引擎
  // （MVU_Skill_Runtime.js 的 __LWCS_SKILL_COST_HELPERS_V1__.评估技能预算_V1 / 断言技能预算_V1）。
  // 对抗试算：designer-sim.js（移植自原项目技能设计台试算）加载后才显示
  // 结论行沿用原项目文案（当前 Lv.x ⇒ 可重创 / 可承受 Lv.y）；下面补一行与同级标准强攻系的对位数字，原项目只在内部计算、不显示
  const dzSim = (c, draft) => {
    const SIM = window.LWCS_DESIGNER_SIM; if (!SIM) return '';
    let r; try { r = SIM.simulate(draft, c.ch, { name: c.name }); } catch (e) { r = { error: e.message, rows: [], warnings: [] }; }
    const notes = '';
    const head = `<h3>对抗试算${r.kind ? `<small class="sim-kind">${esc0(r.kind)} · 对同级标准强攻系</small>` : '<span class="en">Trial</span>'}${c.hint((r.warnings || []).join('\n'))}</h3>`;
    if (r.error) return `<section class="sec dz-simbox">${head}<div class="warn"><i class="fa-solid fa-triangle-exclamation"></i><span>试算失败：${esc0(r.error)}</span></div>${notes}</section>`;
    // 不试算的技能：标题行挂一枚「不适用」，原因放悬停
    if (r.hidden) return `<section class="sec dz-simbox na"><h3>对抗试算<span class="chip s" data-hint="${esc0(`${r.skillType || '这类'}技能不做对抗试算：只有伤害、防御与炸环类效果会和标准对手比较。`)}">不适用</span></h3></section>`;
    const rows = r.rows.map(x => {
      const d = x.data || {}, gap = Number.isFinite(d.maxLevel) && Number.isFinite(d.level) && !/\+$/.test(x.value) ? d.maxLevel - d.level : null;
      return `<div class="sim-row${x.muted ? ' muted' : ''}${gap == null ? '' : gap >= 0 ? ' up' : ' down'}"><small>${esc0(x.label)}</small><i class="fa-solid fa-angles-right"></i><b>${esc0(x.value)}</b>${gap == null ? '' : `<em>${gap >= 0 ? `越 ${gap}` : `低 ${-gap}`} 级</em>`}</div>`;
    }).join('');
    const dm = r.damage, df = r.defense;
    const vs = dm?.vsDefender ? `<div class="sim-vs"><span>每段 <b>${c.fmt(Math.round(dm.perHit))}</b> × ${dm.hits} 段 = <b>${c.fmt(Math.round(dm.total))}</b></span><span>占对手生命 <b>${Math.round(dm.vsDefender.ratio * 100)}%</b>${dm.vsDefender.重创 ? ' · 重创' : ''}</span></div>`
      : df?.vsAttacker ? `<div class="sim-vs"><span>对手一击 <b>${c.fmt(Math.round(df.vsAttacker.rawDamage))}</b> → 实受 <b>${c.fmt(Math.round(df.vsAttacker.incoming))}</b></span><span>自身生命 <b>${c.fmt(df.vsAttacker.hp)}</b>${df.reduction ? ` · 减伤 ${Math.round(df.reduction * 1000) / 10}%` : ''}${df.shield ? ` · 护盾 ${c.fmt(df.shield)}` : ''}${df.blockCount ? ` · 格挡 ${df.blockCount} 次` : ''}${df.deathSave ? ' · 免死' : ''}</span></div>` : '';
    return `<section class="sec dz-simbox">${head}<div class="sim-body"><div class="sim-rows">${rows}</div>${vs}</div>${notes}</section>`;
  };
  const dzCtx = (c, ring) => ({ 魂环位: ring ? Math.max(1, parseInt(String(ring.slot).replace(/\D/g, ''), 10) || 1) : 1, 角色: c.ch });
  const dzEval = (c, sk, ring) => {
    const H = window.__LWCS_SKILL_COST_HELPERS_V1__; if (!H) return { err: 'COST 引擎未加载' };
    try { const r = H.评估技能预算_V1(sk, dzCtx(c, ring)); let block = ''; try { H.断言技能预算_V1(sk, dzCtx(c, ring)); } catch (e) { block = String(e.message || e).replace(/^技能生成错误[:：]?/, ''); } return { r, block }; } catch (e) { return { err: String(e.message || e) }; }
  };
  // 造物双行动抵扣已归零（引擎 技能造物双行动抵扣率_V1 = 0），旧数据里挂在这个来源上的只可能是技能级触发限制
  const LIMIT_SRC = { 造物双行动: '技能触发限制', 技能限制: '技能触发限制', 触发限制: '效果触发限制', 次数限制: '效果次数限制' };
  const limitWhy = r => {
    const m = new Map();
    for (const x of r.限制明细 || []) { const k = x.限制来源 || '限制'; const o = m.get(k) || { rate: 0 }; o.rate = Math.max(o.rate, Number(x.限制抵扣率) || 0); m.set(k, o); }
    return [...m].map(([k, o]) => `${LIMIT_SRC[k] || (/^限定/.test(k) ? `${k}：只对特定对象生效` : k)}，按 ${Math.round(o.rate * 100)}% 抵扣`);
  };
  const energyText = (c, e) => { e = Number(e) || 0; return e > 0 && e < 0.1 ? String(Number(e.toPrecision(2))) : c.fmt(e); };
  // 预算核算悬停：效果 COST 逐条来源（引擎 效果明细：原型 / 目标 / 数值 / 持续 + 各分项 COST 与系数）
  const n2 = v => { const x = Number(v); return Number.isFinite(x) ? String(Number(x.toFixed(2))) : ''; };
  // 引擎规则（计算技能效果累计COST_V1）：每个效果的「原效果（并入追加效果）」与各条件分支的「替换效果」互为候选，只按净 COST 最高的一方计入
  const effectWhy = (c, r) => {
    const rows = (r.效果明细 || []).filter(x => x && Number(x.原始COST) > 0);
    if (!rows.length) return '还没有计入 COST 的效果';
    // 候选分组：替换效果按「所属效果 + 分支序号」分组，其余（原效果、追加效果）归所属效果的原候选
    const cand = x => { const m = String(x.路径 || '').match(/^(.*?)\.条件分支\[(\d+)\]\.替换效果/); return m ? [m[1], `替换${Number(m[2]) + 1}`] : [null, '原效果']; };
    const owner = x => { const p = String(x.路径 || ''); const m = p.match(/^(.*?)\.条件分支\[\d+\]\.替换效果/); return m ? m[1] : null; };
    const groups = new Map();
    for (const x of rows) {
      const [own, id] = cand(x);
      const key = own ?? (rows.map(owner).filter(Boolean).find(o => String(x.路径).startsWith(o)) || String(x.路径));
      if (!groups.has(key)) groups.set(key, new Map());
      const g = groups.get(key); g.set(id, (g.get(id) || 0) + Number(x.净COST ?? x.原始COST));
    }
    const chosen = new Map([...groups].map(([k, g]) => [k, [...g].reduce((best, cur) => cur[1] > best[1] ? cur : best)[0]]));
    const hasAlt = [...groups.values()].some(g => g.size > 1);
    const lines = [`效果 COST ${c.fmt(r.效果原始COST)}`];
    for (const x of rows) {
      const [own, id] = cand(x);
      const key = own ?? (rows.map(owner).filter(Boolean).find(o => String(x.路径).startsWith(o)) || String(x.路径));
      const counted = chosen.get(key) === id;
      const val = [x.目标, x.数值 !== '' ? String(x.数值) : '', Number(x.持续回合) > 1 ? `${x.持续回合}回合` : ''].filter(Boolean).join(' · ');
      const tag = id !== '原效果' ? `〔分支${id.replace('替换', '')}·替换〕` : /\.追加效果/.test(String(x.路径)) ? '〔分支·追加〕' : '';
      lines.push(`${counted ? '✓' : '·'} ${tag}${x.原型 || '效果'}${val ? `（${val}）` : ''}：${n2(x.原始COST)}${counted ? '' : '（候选，未计入）'}`);
      const segs = [['主数值', x.主数值COST], ['副数值', x.副数值COST], ['固定规则', x.固定规则COST], ['触发方式', x.触发方式COST], ['延迟回合', x.延迟回合COST], ['附加规则', x.附加规则COST]].filter(([, v]) => v != null && Number(v)).map(([k, v]) => `${k} ${n2(v)}`);
      // 没有分项时给基础算式：百分点 × 每点 COST
      const pts = Number(x.百分点) || Number(x.绝对值折算百分点);
      if (!segs.length && Number(x.单位COST) && pts) segs.push(`${n2(Math.abs(pts))} 点 × 每点 ${n2(x.单位COST)} = ${n2(Math.abs(pts) * Number(x.单位COST))}`);
      const coef = [Number(x.目标系数) && Number(x.目标系数) !== 1 ? `目标 ×${n2(x.目标系数)}${x.目标系数原因 ? `（${x.目标系数原因}）` : ''}` : '', Number(x.持续系数) && Number(x.持续系数) !== 1 ? `持续 ×${n2(x.持续系数)}` : ''].filter(Boolean);
      if (segs.length || coef.length) lines.push(`   ${segs.join(' + ')}${segs.length && coef.length ? '｜' : ''}${coef.join(' · ')}`);
      if (Number(x.限制抵扣) > 0) lines.push(`   限制抵扣 −${n2(x.限制抵扣)}（${Math.round(Number(x.限制抵扣率) * 100)}%）`);
    }
    if (hasAlt) lines.push('条件分支的替换效果与原效果二选一，按 COST 较高的一方计入；追加效果并入原效果');
    return lines.join('\n');
  };
  const sideWhy = (c, r) => {
    if (!Number(r.副作用原始COST)) return '没有副作用，不扣减';
    const rows = r.副作用明细 || [];
    const lines = [`副作用 −${c.fmt(r.副作用COST)}${Number(r.副作用原始COST) !== Number(r.副作用COST) ? `（原始 ${c.fmt(r.副作用原始COST)}，最多扣到效果 COST 用完为止）` : ''}`];
    for (const x of rows) {
      if (!x || typeof x !== 'object') continue;
      const name = x.副作用类型 || x.名称 || x.副作用状态 || '副作用', v = x.COST ?? x.原始COST ?? x.折算COST;
      lines.push(`· ${name}${x.副作用状态 && x.副作用状态 !== name ? `（${x.副作用状态}）` : ''}${v != null ? `：${n2(v)}` : ''}`);
    }
    return lines.join('\n');
  };
  const dzPreview = (c, sk, ring) => dzGauge(c, dzEval(c, sk, ring));
  // 只负责画：r = 评估技能预算_V1 的结果，block = 保存被拦截的原因（设计台 v2 传入与保存断言同源的结果）
  const dzGauge = (c, { r, block, err }) => {
    if (err) return `<div class="warn"><i class="fa-solid fa-triangle-exclamation"></i><span>${c.esc(err)}</span></div>`;
    const lo = Number(r.最低有效COST) || 0, gate = Number(r.实际门禁 ?? r.允许上限) || 0, cur = Number(r.实际COST) || 0;
    const util = gate ? cur / gate * 100 : 0;
    // 合规窗口：刻度只取「最低有效 ~ 上限」附近（全量程 0~硬上限 时窗口太窄，标记挤成一条线），指针 = 实际 COST
    const span = Math.max((gate - lo) * 1.2, gate * 0.06, 0.5), d0 = Math.max(0, Math.min(cur, lo) - span), d1 = Math.max(cur, gate) + span;
    const at = v => `${((v - d0) / (d1 - d0) * 100).toFixed(1)}%`;
    const state = r.是否超预算 ? 'over' : block ? 'low' : 'ok';
    // COST 构成：以效果 COST 为满格，四行常驻（扣减为零写「无」），实际 = 效果 − 限制抵扣 − 副作用；悬停每行看计算来源
    const full = Math.max(Number(r.效果原始COST) || 0, cur, 0.01), w = v => `${Math.max(0, Math.min(100, v / full * 100)).toFixed(1)}%`;
    const parts = [
      ['效果', Number(r.效果原始COST) || 0, effectWhy(c, r)],
      ['限制抵扣', -(Number(r.限制COST) || 0), r.限制COST ? `限制抵扣 −${c.fmt(r.限制COST)}\n${limitWhy(r).join('\n')}` : '没有触发 / 次数 / 对象限制，不抵扣'],
      ['副作用', -(Number(r.副作用COST) || 0), sideWhy(c, r)],
      ['实际', cur, `实际 COST = 效果 ${c.fmt(r.效果原始COST)} − 限制抵扣 ${c.fmt(r.限制COST || 0)} − 副作用 ${c.fmt(r.副作用COST || 0)} = ${c.fmt(cur)}\n这个数要落在最低有效与上限之间才能保存`],
    ];
    const capped = Number(r.位级硬上限) > 0 && Number(r.允许上限) > Number(r.位级硬上限);
    return `<div class="bgw ${state}">
        <div class="bgw-head"><b>${util.toFixed(0)}%</b><small>预算利用率</small></div>
        <div class="bgw-scale" role="img" aria-label="实际 ${c.fmt(cur)}，合规窗口 ${c.fmt(lo)} 至 ${c.fmt(gate)}">
          <i class="bgw-win" style="left:${at(lo)};width:calc(${at(gate)} - ${at(lo)})"></i>
          <i class="bgw-needle" style="left:${at(cur)}"><em>${c.fmt(cur)}</em></i>
          <span class="bgw-tick lo" style="left:${at(lo)}" data-hint="最低有效 COST：实际 COST 低于它超过 1 点时不能保存（引擎容差 1 点）">${c.fmt(lo)}</span>
          <span class="bgw-tick hi" style="left:${at(gate)}" data-hint="预算上限：实际 COST 不能超过">${c.fmt(gate)}</span>
        </div>
      </div>
      <section class="bgc"><h4>COST 构成</h4>${parts.map(([l, v, h]) => `<div class="bgc-row${v < 0 ? ' neg' : ''}${!v && l !== '实际' ? ' zero' : ''}${l === '实际' ? ' sum' : ''}" data-hint="${c.esc(h)}"><span>${l}</span><i><b style="width:${w(Math.abs(v))}"></b></i><em>${!v && l !== '实际' ? '无' : `${v < 0 ? '−' : ''}${c.fmt(Math.abs(v))}`}</em></div>`).join('')}</section>
      <section class="bge"><h4>上限从哪来</h4>
        <div class="bge-eq">
          <span data-hint="这个魂技位本身的预算：由魂环位、魂环年限、天赋、魂技品质决定"><b>${c.fmt(r.运转基准)}</b><small>运转基准</small></span><i>×</i>
          <span data-hint="施放代价换来的预算倍率 = 魂力消耗倍数 × 前摇倍数（乘积不到 1 时直接取乘积，到 1 以上取立方根）。消耗越多、前摇越长，上限越高"><b>${energyText(c, r.代价能量)}</b><small>代价能量</small></span><i>=</i>
          <span class="res"><b>${c.fmt(r.允许上限)}</b><small>上限</small></span>
        </div>
        ${Number.isFinite(Number(r.消耗倍数)) && Number.isFinite(Number(r.前摇倍数)) ? `<div class="bge-src"><span>消耗 ×${Number(r.消耗倍数).toFixed(2)}</span><span>前摇 ×${Number(r.前摇倍数).toFixed(2)}</span></div>` : ''}
        ${Number(r.位级硬上限) > 0 ? `<div class="bge-cap${capped ? ' on' : ''}" data-hint="这个魂技位的预算封顶，提高代价也不能超过"><i class="fa-solid fa-lock"></i>硬上限 ${c.fmt(r.位级硬上限)}${capped ? '（已封顶）' : ''}</div>` : ''}
      </section>
      ${block || r.是否超预算 ? `<div class="warn"><i class="fa-solid fa-ban"></i><span>无法保存：${c.esc(block || `超出 ${c.fmt(r.超出COST)}`)}</span></div>` : '<div class="okline"><i class="fa-solid fa-circle-check"></i>预算合规，可以保存</div>'}
      <button class="cta" type="button" data-dz-save ${block || r.是否超预算 ? 'disabled' : ''}><i class="fa-solid fa-floppy-disk"></i>保存设计</button>`;
  };
  const esc0 = v => String(v ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  // 设计台：designer-ui.js（界面）+ designer-model.js（原项目数据层）；数据层未加载时只给空状态
  const design = c => (window.LWCS_DESIGNER_UI && window.LWCS_DESIGNER_UI.design(c, { allSkills, dzPreview, dzGauge, dzSim }))
    || { tag: 'CORE · DESIGNER', wide: 'both', core: `<div class="pad sparse">${c.empty('pen-ruler', '设计台未就绪', '需要先加载 MVU_Skill_Runtime.js 与 designer-model.js')}</div>`, railL: '', railR: '' };

  // 待处理：两翼折叠；有待生成魂环时给出入口，否则空状态居中

  // 魂灵悬停档案：spirit:<武魂槽>/<魂灵槽>
  const abilityInspect = (c, kind, id, mode) => {
    if (kind !== 'spirit') return skillInspect(c, kind, id, mode);
    const [ss, ps] = id.split('/'), soul = c.souls.find(s => s.slot === ss), sp = soul?.spirits.find(p => p.slot === ps);
    if (!sp) return '';
    const pp = c.P(ss, ps);
    return `<div class="insp-head">${c.sock('paw', 'gd')}<div><strong style="font-size:1.1em">${c.ed(sp.表象名称, [...pp, '表象名称'])}</strong><br><small>${c.esc(soul.表象名称)} · ${c.esc(ps)} · 附 ${sp.rings.length} 环</small></div></div>
      ${c.kv([['品质', c.ed(sp.品质 || 'F', [...pp, '品质'], { kind: 'enum', options: ['F', 'D', 'C', 'B', 'A', 'S', 'S+'] })], ['状态', c.ed(sp.状态 || '沉睡', [...pp, '状态'])], ['年限', c.ed(c.fmt(sp.年限), [...pp, '年限'], { kind: 'number', integer: true, min: 0, raw: c.num(sp.年限) })], ['契合度', `${c.ed(c.fmt(sp.契合度), [...pp, '契合度'], { kind: 'number', integer: true, min: 0, max: 100, raw: c.num(sp.契合度) })}%`]])}
      <p class="narr">${c.ed(c.blank(sp.描述) ? '未记录' : sp.描述, [...pp, '描述'], { kind: 'text', raw: c.blank(sp.描述) ? '' : sp.描述 })}</p>
      ${spiritCard(c, sp, true).replace(/<p class="narr">[\s\S]*?<\/p>/, '')}`;
  };
  // 原项目流程打开「魂环生成确认 / 技能设计确认 / 技能设计台」时由桥接转到这里
  {
    const C = window.COCKPIT;
    const viewChar = name => { if (name && C.ctx().name !== name && C.ctx().S.char?.[name]) C.view(name); };
    const openDesigner = (p, extra = {}) => {
      if (Array.isArray(p) && p[0] === 'char') viewChar(p[1]);
      const c = C.ctx(), key = Array.isArray(p) ? window.LWCS_DESIGNER_UI?.keyOfPath?.(c, { allSkills }, p) : '';
      Object.assign(c.state.ui, { dtab: 'basic', dzErr: '', ...(key ? { skill: key } : {}), ...extra });
      C.go('page-ability', 'design');
      return true;
    };
    C.addRoute?.('ringPick', () => {
      const p = C.pending()?.soulRing; if (!p) return false;
      viewChar(p.charName);
      const c = C.ctx(), i = c.souls.findIndex(s => s.slot === p.spiritSlot);
      Object.assign(c.state.ui, { ringPick: '1', soul: String(i >= 0 ? i : 0), ringCand: '' });
      C.go('page-ability', 'martial');
      return true;
    });
    C.addRoute?.('designer', spec => openDesigner(spec.path));
    C.addRoute?.('skillConfirm', () => { const d = C.pending()?.skillDesign; if (!d) return false; viewChar(d.charName); return openDesigner(d.path); });
  }

  window.COCKPIT.register('page-ability', {
    label: '能力', icon: 'wand-sparkles', tag: 'CORE · MARTIAL SOUL',
    keys: [
      { id: 'martial', icon: 'fire', label: '武魂', view: martial, inspect: abilityInspect },
      { id: 'codex', icon: 'book', label: '典籍', view: codex, inspect: skillInspect },
      { id: 'design', icon: 'pen-ruler', label: '设计', view: design },
    ],
  });
})();

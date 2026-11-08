/* 物资领域：装备 · 魂骨 · 背包。三页都是 左翼选 → 主屏完整档案与编辑 → 右翼汇总与操作 */
(() => {
  const ERA_COINS = [['联邦币', '联邦币'], ['星罗币', '星罗币'], ['唐门积分', '唐门积分'], ['学院积分', '史莱克学院积分'], ['战功', '血神功勋']];
  window.COCKPIT.eraCoins = ERA_COINS;
  const SLOTS = [
    ['武器', 'khanda', '主武器', g => g.名称, g => g.品阶],
    ['防具', 'shield', '防具', g => g.名称, g => g.品阶],
    ['斗铠', 'user-shield', '斗铠', g => g.名称, g => g.等级 ? `${g.等级} 字斗铠` : ''],
    ['机甲', 'robot', '机甲', g => g.名称, g => g.等级],
  ];
  const BONES = [['头部魂骨', '头部'], ['躯干魂骨', '躯干'], ['左臂魂骨', '左臂'], ['右臂魂骨', '右臂'], ['左腿魂骨', '左腿'], ['右腿魂骨', '右腿'], ['外附魂骨1', '外附 I'], ['外附魂骨2', '外附 II']];
  const filled = v => v && !['无', '', undefined].includes(v);
  const sumBonus = (c, eq) => {
    const keys = ['力量', '防御', '敏捷', '体力上限', '精神力上限', '魂力上限'], total = Object.fromEntries(keys.map(k => [k, 0]));
    for (const g of [eq.武器, eq.防具]) for (const k of keys) total[k] += c.num(g?.属性加成?.[k]);
    for (const g of [eq.斗铠, eq.机甲]) for (const k of keys) total[k] += c.num(g?._属性加成?.[k]);
    return total;
  };
  const ON_OFF = ['未装备', '已装备'];
  const MECH_ROLES = ['近战', '远程', '均衡', '重装', '高速', '支援'];
  // 斗铠部件槽位与别名：与原项目 读取斗铠部件槽位列表_桥接 / resolveArmorPartData 一致
  const ARMOR_PARTS = sex => ['头盔', '胸铠', '左肩', '右肩', '左臂', '右臂', ...(sex === '女' ? ['战裙'] : ['左腿', '右腿']), '战靴'];
  const PART_ALIAS = { 头盔: ['头部'], 胸铠: ['胸甲'], 左肩: ['肩甲左'], 右肩: ['肩甲右'], 左臂: ['臂甲左'], 右臂: ['臂甲右'], 左腿: ['腿甲左'], 右腿: ['腿甲右'], 战裙: ['裙甲'], 战靴: ['靴子'] };
  // 装备档案（主屏）：武器 / 防具实例常只存名称，品质 / 耐久 / 描述 / 装备技能取物品定义——同原版收集口径「实例上的 || 物品定义里的」；
  // 定义字段改动写回物品库，实例字段写回角色。技能行直达设计台（键与能力页 allSkills 一致）
  const ROW_ICON = { 材质: 'cubes', 品阶: 'layer-group', 装备状态: 'power-off', 等级: 'star', 领域: 'circle-radiation', 级别: 'star', 定位: 'crosshairs', 机体状态: 'heart-pulse', 机载武器: 'gun', 品质系数: 'percent' };
  const MOUNTS = ['一号位', '二号位', '三号位', '四号位', '五号位', '六号位', '七号位', '八号位', '九号位', '十号位'];
  const gearSkills = (c, g) => {
    const [, def] = defOf(c, String(g?.名称 || g?.name || '').trim()), own = c.entries(g?.装备技能).length > 0;
    return c.entries(own ? g.装备技能 : def?.装备技能 || def?.附带技能).filter(([, s]) => s && typeof s === 'object');
  };
  const skillRows = (c, list, none) => list.length ? `<div class="list">${list.map(({ key, n, s, from }) => `<button class="row" type="button" data-go="page-ability/design" data-go-set="skill=${c.esc(key)};dtab=basic" data-hint="在设计台中编辑">${c.sock('bolt', 'gd')}<div><strong>${c.esc(s.魂技名 || n)}</strong><small>${c.esc([from, String(s.效果描述 || s.画面描述 || '').slice(0, 44)].filter(Boolean).join(' · '))}</small></div><span class="chip s">${c.esc(s.承载方式 || '—')}</span></button>`).join('')}</div>` : `<span class="lbl">${none}</span>`;
  const eqCore = (c, key) => {
    const g = c.ch.装备?.[key]; if (!g) return '';
    const gp = c.P('装备', key);
    if (key === '魂导器') {
      const all = [...new Set([...MOUNTS, ...Object.keys(g.装配 || {})])], on = all.filter(s => filled(g.装配?.[s]?.名称));
      const sk = on.flatMap(s => gearSkills(c, g.装配[s]).map(([n, x]) => ({ key: `装备/魂导器/装配/${s}/${n}`, n, s: x, from: s })));
      return `<div class="pad detail">
        <div class="q-title">${c.sock('microchip', 'gd')}<span class="chip">魂导器</span><h2>魂导器装配</h2><span class="q-state">${on.length} / ${all.length}</span></div>
        <section class="sec"><h3>装配位<span class="en">Mounts</span></h3><div class="part-grid">${all.map(s => { const x = g.装配?.[s]; return `<div class="pt${filled(x?.名称) ? ' on' : ''}"><b>${s}</b><span>${filled(x?.名称) ? c.ed(x.名称, [...gp, '装配', s, '名称']) : '空'}</span></div>`; }).join('')}</div></section>
        <section class="sec"><h3>装备技能<span class="en">${sk.length}</span></h3>${skillRows(c, sk, '已装配的魂导器没有附带技能')}</section>
      </div>`;
    }
    const name = String(g.名称 || '').trim(), [cat, def] = defOf(c, name), dp = ['物品', cat, name];
    const str = (k, dflt = '无') => c.ed(c.blank(g[k]) ? dflt : g[k], [...gp, k], { raw: c.blank(g[k]) ? '' : g[k] });
    const coef = (v, p) => c.ed(c.fmt(v ?? 1), p, { kind: 'number', min: 0.8, max: 2, raw: v ?? 1 });
    const onoff = () => c.ed(g.装备状态 || '未装备', [...gp, '装备状态'], { kind: 'enum', options: ON_OFF });
    const rows = key === '武器' ? [['材质', str('材质')], ['品阶', str('品阶')]]
      : key === '防具' ? [['品阶', str('品阶')], ['装备状态', onoff()]]
      : key === '斗铠' ? [['等级', `${c.ed(c.fmt(g.等级 || 0), [...gp, '等级'], { kind: 'number', integer: true, min: 0, max: 4, raw: c.num(g.等级) })} 字`], ['领域', str('领域')], ['材质', str('材质')], ['装备状态', onoff()]]
      : key === '机甲' ? [['级别', str('等级')], ['定位', c.ed(g.型号 || '无', [...gp, '型号'], { kind: 'enum', options: MECH_ROLES })], ['机体状态', str('状态', '完好')], ['装备状态', onoff()], ['机载武器', str('武装')], ['材质', str('材质')], ['品质系数', coef(g.品质系数, [...gp, '品质系数'])]]
      : [];
    const tiles = [
      def ? ['gem', c.ed(def.品质 || '普通', [...dp, '品质'], { kind: 'enum', options: ITEM_QUALITY }), '品质'] : null,
      def?.基础耐久 !== undefined ? ['shield-halved', c.ed(c.fmt(def.基础耐久), [...dp, '基础耐久'], { kind: 'number', integer: true, min: 0, raw: c.num(def.基础耐久) }), '基础耐久'] : null,
      ...rows.map(([l, v]) => [ROW_ICON[l] || 'circle', v, l]),
    ].filter(Boolean);
    const sk = gearSkills(c, g).map(([n, s]) => ({ key: `装备/${key}/${n}`, n, s }));
    const bonus = c.entries(g.属性加成 || g._属性加成 || def?.属性加成).filter(([k, v]) => c.num(v) && k !== '等效等级');
    const dirs = def?.加成方向 || [], feats = c.entries(g.特性);
    const slots = key === '斗铠' ? ARMOR_PARTS(c.st.性别) : [];
    const partKey = s => [s, ...(PART_ALIAS[s] || [])].find(k => g.部件?.[k]) || s;
    const forged = slots.filter(s => { const p = g.部件?.[partKey(s)]; return p && p.状态 && p.状态 !== '未打造'; }).length;
    const descRaw = c.blank(def?.描述) || def?.描述 === '无' ? '' : def?.描述;
    return `<div class="pad detail">
      <div class="q-title">${c.sock(EQ_KEYS.find(x => x.k === key)?.ic || 'shield-halved', 'gd')}<span class="chip">${c.esc(key)}</span><h2>${c.ed(g.名称, [...gp, '名称'])}</h2></div>
      ${def ? `<div class="q-from">${c.esc(cat)} · 物品库定义${c.hint('品质、耐久、描述与装备技能来自物品库定义，改动会影响所有同名物品。')}</div>` : ['武器', '防具'].includes(key) ? `<div class="q-from">物品库未登记${c.hint('物品库里没有这件装备的定义，只能改实例上的字段。')}</div>` : ''}
      <div class="tiles four">${tiles.map(([i, v, l]) => `<div class="tile">${c.sock(i)}<b>${v}</b><small>${l}</small></div>`).join('')}</div>
      ${def ? `<section class="sec"><h3>描述<span class="en">Lore</span></h3><p class="prose">${c.ed(descRaw || '未记录描述', [...dp, '描述'], { kind: 'text', raw: descRaw })}</p></section>` : ''}
      <section class="sec"><h3>装备技能<span class="en">${sk.length}</span></h3>${skillRows(c, sk, '这件装备没有附带技能')}</section>
      ${slots.length ? `<section class="sec"><h3>部件<span class="en">已打造 ${forged} / ${slots.length}</span></h3><div class="part-grid">${slots.map(s => { const k = partKey(s), p = g.部件?.[k] || {}, on = p.状态 && p.状态 !== '未打造'; return `<div class="pt${on ? ' on' : ''}"><b>${s}</b><span>${c.ed(p.状态 || '未打造', [...gp, '部件', k, '状态'], { raw: p.状态 || '未打造' })}</span><em>×${coef(p.品质系数, [...gp, '部件', k, '品质系数'])}</em></div>`; }).join('')}</div></section>` : ''}
      ${feats.length ? `<section class="sec"><h3>特性<span class="en">${feats.length}</span></h3>${feats.map(([n, t]) => `<p class="prose"><b>${c.esc(n)}</b>：${c.esc(t.描述)}${t.限定来源 ? `（限 ${c.esc(t.限定来源)}）` : ''}</p>`).join('')}</section>` : ''}
      ${bonus.length || dirs.length ? `<section class="sec"><h3>属性加成<span class="en">Bonus</span></h3>${bonus.length ? `<div class="chips-row">${bonus.map(([k, v]) => `<span class="chip gold">${c.esc(k)} +${c.esc(v)}</span>`).join('')}</div>` : ''}${dirs.length ? `<div class="chips-row"><span class="lbl">加成方向</span>${dirs.map(d => `<span class="chip s">${c.esc(d)}</span>`).join('')}</div>` : ''}</section>` : ''}
    </div>`;
  };

  const boneInspect = (c, kind, key) => {
    const b = c.ch.魂骨?.[key]; if (!b) return '';
    return `<div class="insp-head">${c.sock('bone', 'gd')}<div><strong style="font-size:1.1em">${c.esc(b.名称 || b.表象名称)}</strong><br><small class="lbl">${c.esc(key)}</small></div><button class="x" type="button" data-close-inspector aria-label="关闭">×</button></div>
      ${c.kv([['年限', `${c.fmt(b.年限)} 年`], ['品质', c.val(b.品质)], ['品阶', c.val(b.品阶)], ['来源', c.val(b.来源)]])}
      ${!c.blank(b.描述) ? `<p class="prose">${c.esc(b.描述)}</p>` : ''}
      ${c.entries(b.附带技能).length ? `<section class="sec"><h3>附带技能</h3>${c.entries(b.附带技能).map(([n]) => `<button class="row" type="button" data-go="page-ability/codex"><span class="chip s">技能</span><div><strong>${c.esc(n)}</strong></div><i class="fa-solid fa-chevron-right"></i></button>`).join('')}</section>` : ''}`;
  };

  // 物品定义编辑：选项与原项目同源（物品经济品质列表 / 物品装备槽位选项 / 魂灵品质选项）；改名与改分类涉及搬移键，留给移植时接原项目编辑器
  const ITEM_QUALITY = ['普通', '优秀', '稀有', '史诗', '传说', '神器', '超神器'];
  const SPIRIT_QUALITY = ['F', 'D', 'C', 'B', 'A', 'S', 'S+'];
  const EQ_SLOT = ['无', '头部', '躯干', '左臂', '右臂', '左腿', '右腿', '武器', '防具', '饰品'];
  const EQ_KINDS = new Set(['近战武器', '远程武器', '战术装备', '防具装备', '斗铠部件', '机甲机体']);
  const USABLE = new Set(['丹药', '天然灵物', '近战武器', '远程武器', '战术装备', '功能道具', '一次性道具', '魂技造物']);
  const defOf = (c, n) => { for (const [k, g] of c.entries(c.S.物品)) if (g && typeof g === 'object' && g[n] && typeof g[n] === 'object') return [k, g[n]]; return ['', null]; };
  // 大额价格按万 / 亿缩写显示，编辑时仍是原值
  const wan = n => n >= 1e8 ? `${+(n / 1e8).toFixed(2)} 亿` : n >= 1e4 ? `${+(n / 1e4).toFixed(2)} 万` : String(n);
  const ITEM_ICON = { 品质: 'gem', 基础价格: 'coins', 阶位: 'layer-group', 魂导等级: 'microchip', 魂灵品质: 'gem', 表象名称: 'dragon', 标准物种: 'paw', 年限: 'hourglass-half', 装备槽位: 'shield-halved', 基础耐久: 'wrench', 图纸目标: 'compass-drafting' };
  // 物品档案（主屏）：定义字段写回物品库，持有数量 / 批次写回背包；操作（使用 / 装备 / 丢弃）在右翼
  const itemOf = (c, name) => {
    const it = c.ch.背包?.[name]; if (!it) return null;
    const [cat, def] = defOf(c, name), batches = it.批次 || [];
    const total = batches.length ? batches.reduce((s, b) => s + c.num(b.数量), 0) : c.num(it.数量);
    const isEq = def && (EQ_KINDS.has(cat) || def.装备槽位 !== undefined);
    // lwcs：按原项目背包按钮同一判定；原型页没有运行时，按分类近似
    const caps = window.COCKPIT.preview('itemCaps', { item: name });
    return { it, cat, def, batches, total, isEq, usable: caps ? caps.usable : USABLE.has(cat), equipable: caps ? caps.equipable : isEq && def.装备槽位 !== '无' };
  };
  const itemCore = (c, name) => {
    const o = itemOf(c, name); if (!o) return '';
    const { cat, def, batches, total, isEq } = o, dp = ['物品', cat, name], coins = ERA_COINS.map(x => x[1]);
    const dstr = (k, label, x = {}) => [label, c.ed(c.blank(def[k]) ? (x.dflt || '无') : def[k], [...dp, k], { raw: c.blank(def[k]) ? '' : def[k], ...x })];
    const dnum = (k, label, x = {}) => [label, c.ed(c.fmt(def[k] || 0), [...dp, k], { kind: 'number', integer: true, min: 0, raw: c.num(def[k]), ...x })];
    const defRows = def ? [
      dstr('品质', '品质', { kind: 'enum', options: ITEM_QUALITY, dflt: '普通' }),
      ['基础价格', c.ed(wan(c.num(def.基础价格)), [...dp, '基础价格'], { kind: 'number', integer: true, min: 0, raw: c.num(def.基础价格) }), `基础价格 · ${c.ed(def.默认货币 || coins[0], [...dp, '默认货币'], { kind: 'enum', options: coins })}`],
      cat === '锻造金属' ? dnum('阶位', '阶位') : null,
      cat !== '魂灵' && (def.魂导等级 !== undefined || EQ_KINDS.has(cat)) ? dnum('魂导等级', '魂导等级') : null,
      ...(cat === '魂灵' ? [dstr('魂灵品质', '魂灵品质', { kind: 'enum', options: SPIRIT_QUALITY, dflt: 'F' }), dstr('表象名称', '表象名称'), dstr('标准物种', '标准物种'), dnum('年限', '年限')] : []),
      ...(isEq ? [dstr('装备槽位', '装备槽位', { kind: 'enum', options: EQ_SLOT }), dnum('基础耐久', '基础耐久')] : []),
      cat === '设计图纸' ? dstr('图纸目标', '图纸目标') : null,
    ].filter(Boolean) : [];
    const addon = def ? c.entries(def.属性加成).map(([k, v]) => [k, c.ed(String(v), [...dp, '属性加成', k], typeof v === 'number' ? { kind: 'number', raw: v } : { raw: v })]) : [];
    const dirs = def?.加成方向 || [];
    const skills = def ? [...(Array.isArray(def.装备技能) ? def.装备技能 : c.entries(def.装备技能).map(([k, s]) => s?.魂技名 || k)), ...(Array.isArray(def.附带魂技) ? def.附带魂技 : [])].map(x => typeof x === 'object' ? x.名称 || x.技能名 || '' : x).filter(Boolean) : [];
    const bnum = (b, i, k, label, x = {}) => b[k] !== undefined ? [label, c.ed(c.fmt(b[k]), c.P('背包', name, '批次', i, k), { kind: 'number', integer: true, min: 0, raw: c.num(b[k]), ...x })] : null;
    const batchRows = (b, i) => [b.品质 !== undefined ? ['品质', c.ed(b.品质 || '普通', c.P('背包', name, '批次', i, '品质'), ITEM_QUALITY.includes(b.品质) ? { kind: 'enum', options: ITEM_QUALITY } : { raw: b.品质 || '' })] : null, bnum(b, i, '品质系数', '品质系数', { integer: false }), bnum(b, i, '阶位', '阶位'), b.基础金属 ? ['基础金属', c.esc(b.基础金属)] : null, bnum(b, i, '魂导等级', '魂导等级'), b.副职业参数?.融合参数 ? ['融合', `${b.副职业参数.融合参数.数量} 种 · ${b.副职业参数.融合参数.融合率}%`] : null, bnum(b, i, '耐久', '耐久'), bnum(b, i, '剩余使用次数', '剩余次数'), b.绑定者 ? ['绑定', c.esc(b.绑定者)] : null, b.有效期至tick ? ['有效期', `至 ${c.tickDate(b.有效期至tick)}`] : null].filter(Boolean);
    const descRaw = c.blank(def?.描述) || def?.描述 === '无' ? '' : def?.描述;
    return `<div class="pad detail">
      <div class="q-title">${c.sock(isEq ? 'shield-halved' : 'cube', 'gd')}<span class="chip">${c.esc(cat || '未登记')}</span><h2>${c.esc(name)}</h2><span class="q-state">持有 ${batches.length ? c.fmt(total) : c.ed(c.fmt(total), c.P('背包', name, '数量'), { kind: 'number', integer: true, min: 1, raw: total })}</span></div>
      <div class="q-from">${def ? `物品库 · ${c.esc(cat)}${c.hint('品质、价格、描述等来自物品库定义，改动会影响所有同名物品；持有数量与批次只改自己的背包。')}` : `物品库未登记${c.hint('物品库里没有这件物品的定义，只能改持有数量与批次。')}`}</div>
      ${defRows.length ? `<div class="tiles four">${defRows.map(([l, v, sub]) => `<div class="tile">${c.sock(ITEM_ICON[l] || 'circle')}<b>${v}</b><small>${sub || l}</small></div>`).join('')}</div>` : ''}
      ${def ? `<section class="sec"><h3>描述<span class="en">Lore</span></h3><p class="prose">${c.ed(descRaw || '未记录描述', [...dp, '描述'], { kind: 'text', raw: descRaw })}</p></section>` : ''}
      ${addon.length || dirs.length ? `<section class="sec"><h3>属性加成<span class="en">Bonus</span></h3>${addon.length ? `<div class="tiles four">${addon.map(([k, v]) => `<div class="tile">${c.sock('arrow-trend-up')}<b class="plus">${v}</b><small>${c.esc(k)}</small></div>`).join('')}</div>` : ''}${dirs.length ? `<div class="chips-row"><span class="lbl">加成方向</span>${dirs.map(d => `<span class="chip s">${c.esc(d)}</span>`).join('')}</div>` : ''}</section>` : ''}
      ${skills.length ? `<section class="sec"><h3>附带技能<span class="en">${skills.length}</span>${c.hint('装备后可在能力页的技能图鉴与设计台中查看、编辑。')}</h3><div class="chips-row">${skills.map(s => `<span class="chip gold"><i class="fa-solid fa-bolt"></i> ${c.esc(s)}</span>`).join('')}</div></section>` : ''}
      ${batches.length ? `<section class="sec"><h3>持有批次<span class="en">${batches.length}</span></h3><div class="batches">${batches.map((b, i) => `<div class="batch"><div class="t">批次 ${i + 1}<span>×${c.ed(c.fmt(b.数量), c.P('背包', name, '批次', i, '数量'), { kind: 'number', integer: true, min: 1, raw: c.num(b.数量) })}</span></div>${c.kv(batchRows(b, i))}</div>`).join('')}</div></section>` : ''}
    </div>`;
  };
  const itemActs = (c, name) => {
    const o = itemOf(c, name); if (!o) return '';
    const act = x => `data-act="${c.esc(JSON.stringify({ name: 'item', item: name, ...x }))}"`;
    return `<div class="acts">${o.usable ? `<button class="cta" type="button" data-confirm="使用 ${c.esc(name)} ×1" ${act({ op: 'use' })}><i class="fa-solid fa-hand-sparkles"></i>使用</button>` : ''}
      <div class="act-row">${o.equipable ? `<button class="key-s" type="button" data-confirm="装备 ${c.esc(name)}" ${act({ op: 'equip' })}><i class="fa-solid fa-shield-halved"></i> 装备</button>` : ''}${o.total > 1 ? `<button class="key-s danger" type="button" data-confirm="丢弃 1 件 ${c.esc(name)}" ${act({ op: 'discard', mode: 'one' })}><i class="fa-solid fa-minus"></i> 丢弃 1 件</button>` : ''}<button class="key-s danger" type="button" data-confirm="${o.total > 1 ? `全部丢弃 ${c.esc(name)}（${o.total} 件）` : `丢弃 ${c.esc(name)}`}" ${act({ op: 'discard', mode: 'all' })}><i class="fa-solid fa-trash"></i> ${o.total > 1 ? '全部丢弃' : '丢弃'}</button></div></div>`;
  };

  // 三页同一结构：左翼选（挂点 / 魂骨位 / 物品），主屏是选中项的完整档案与编辑，右翼是汇总与操作
  const EQ_KEYS = [...SLOTS.map(([k, ic, l, n, s]) => ({ k, ic, l, n, s })), { k: '魂导器', ic: 'microchip', l: '魂导器', n: () => '', s: () => '' }];
  const equipment = c => {
    const eq = c.ch.装备 || {}, bonus = sumBonus(c, eq), gear = eq.魂导器?.装配 || {};
    const mounted = c.entries(gear).filter(([, g]) => filled(g?.名称));
    const warm = eq._温养目标 && eq._温养目标 !== '无' ? eq._温养目标 : '';
    const nameOf = x => x.k === '魂导器' ? (mounted.length ? `已装配 ${mounted.length} / 10` : '') : x.n(eq[x.k] || {});
    const sel = EQ_KEYS.find(x => x.k === c.state.ui.eqsel) || EQ_KEYS.find(x => filled(nameOf(x))) || EQ_KEYS[0], selName = nameOf(sel);
    return {
      tag: 'CORE · ARMORY',
      left: `<div class="pad">${c.head('shield-halved', '挂点', 'Hardpoints', 'gd')}
        <div class="list q-list">${EQ_KEYS.map(x => { const nm = nameOf(x); return `<button class="row${x === sel ? ' on' : ''}${filled(nm) ? '' : ' idle'}" type="button" data-set="eqsel=${x.k}" aria-current="${x === sel}">${c.sock(x.ic, filled(nm) ? 'gd' : '')}<div><strong>${c.esc(filled(nm) && x.k !== '魂导器' ? nm : x.l)}</strong><small>${!filled(nm) ? '空挂点' : x.k === '魂导器' ? nm : c.esc(x.l + (x.s(eq[x.k] || {}) ? ' · ' + x.s(eq[x.k] || {}) : ''))}</small></div><span></span></button>`; }).join('')}</div>
      </div>`,
      core: filled(selName) ? eqCore(c, sel.k) : `<div class="pad sparse">${c.empty(sel.ic, `${sel.l}挂点空着`, '在背包里选中装备后可以挂载到这里')}<button class="key-s" type="button" data-go="page-supplies/pack" style="align-self:center"><i class="fa-solid fa-box-open"></i> 去背包</button></div>`,
      right: `<div class="pad">${c.head('bolt', '武装共鸣', 'Resonance')}
        ${Object.values(bonus).some(v => v) ? `<div class="tiles">${Object.entries(bonus).filter(([, v]) => v).map(([k, v]) => `<div class="tile">${c.sock('arrow-trend-up')}<b class="plus">+${c.fmt(v)}</b><small>${k}</small></div>`).join('')}</div>` : c.empty('bolt', '暂无武装加成')}
        <section class="sec"><h3>温养<span class="en">Nurture</span>${c.hint('斗铠 / 机甲的温养进度由运行时投影。')}</h3>${warm ? `<div class="relic-card">${c.sock('temperature-half', 'gd')}<div><strong>${c.esc(warm)}</strong><small>温养中</small></div></div>` : '<span class="lbl">没有温养目标</span>'}${eq.斗铠?._已排异 ? '<span class="plq" style="--pc:#ff4d6a">斗铠已排异</span>' : ''}</section>
        <div class="groove"></div>${c.head('hand-pointer', '操作', 'Actions')}
        <div class="act-row"><button class="key-s" type="button" data-go="page-supplies/pack"><i class="fa-solid fa-box-open"></i> 从背包换装</button>${sel.k !== '魂导器' && filled(selName) ? `<button class="key-s danger" type="button" data-confirm="${c.esc(`卸下${sel.l}「${selName}」，放回背包`)}" data-act="${c.esc(JSON.stringify({ name: 'item', op: 'unequip', slot: sel.k, item: selName }))}"><i class="fa-solid fa-arrow-down"></i> 卸下</button>` : ''}${sel.k !== '魂导器' && gearSkills(c, eq[sel.k]).length ? '<button class="key-s" type="button" data-go="page-ability/codex"><i class="fa-solid fa-book"></i> 技能图鉴</button>' : ''}</div>
      </div>`,
    };
  };

  // 魂骨：左翼是八个骨位的人形图（点选），主屏是选中魂骨档案与附带技能，右翼是套装共鸣与总年限
  const bones = c => {
    const b = c.ch.魂骨 || {}, has = k => filled(b[k]?.名称) || filled(b[k]?.name) || c.num(b[k]?.年限) > 0;
    const n6 = BONES.slice(0, 6).filter(([k]) => has(k)).length, n = BONES.filter(([k]) => has(k)).length;
    const sel = BONES.find(([k]) => k === c.state.ui.bonesel) || BONES.find(([k]) => has(k)) || BONES[0], [sk, sl] = sel;
    const slot = ([k, l], i) => `<button class="hpt bone${has(k) ? '' : ' idle'}${k === sk ? ' on' : ''}" type="button" style="grid-area:b${i}" data-set="bonesel=${k}" aria-current="${k === sk}">${c.sock('bone', has(k) ? 'gd' : '')}<strong>${l}</strong><small>${has(k) ? `${c.fmt(b[k].年限)} 年` : '未装载'}</small></button>`;
    const bo = b[sk] || {}, bname = bo.名称 || bo.name || bo.表象名称 || '', merged = { ...(defOf(c, bname)[1] || {}), ...bo };
    const skills = c.entries(merged.附带技能 || merged.装备技能).filter(([, s]) => s && typeof s === 'object').map(([n, s]) => ({ key: `魂骨/${sk}/${n}`, n, s }));
    const years = BONES.reduce((s, [k]) => s + (has(k) ? c.num(b[k].年限) : 0), 0);
    return {
      tag: 'CORE · SOUL BONES',
      left: `<div class="pad">${c.head('bone', '骨位', 'Slots', 'gd')}<div class="bone-map">${BONES.map(slot).join('')}</div></div>`,
      core: has(sk) ? `<div class="pad detail">
        <div class="q-title">${c.sock('bone', 'gd')}<span class="chip">${c.esc(sl)}</span><h2>${c.esc(bname || sk)}</h2></div>
        <div class="tiles four">${[['hourglass-half', wan(c.num(merged.年限)), '年限 · 年'], ['gem', c.esc(merged.品质 || '—'), '品质'], ['layer-group', c.esc(merged.品阶 || '—'), '品阶'], ['map-pin', c.esc(merged.来源 || '—'), '来源']].map(([i, v, l]) => `<div class="tile">${c.sock(i)}<b>${v}</b><small>${l}</small></div>`).join('')}</div>
        ${!c.blank(merged.描述) ? `<section class="sec"><h3>描述<span class="en">Lore</span></h3><p class="prose">${c.esc(merged.描述)}</p></section>` : ''}
        <section class="sec"><h3>附带技能<span class="en">${skills.length}</span></h3>${skillRows(c, skills, '没有附带技能')}</section>
      </div>` : `<div class="pad sparse">${c.empty('bone', `${sl}未装载`, '击杀魂兽或通过交易获得魂骨后，在背包中装载')}<button class="key-s" type="button" data-go="page-supplies/pack" style="align-self:center"><i class="fa-solid fa-box-open"></i> 去背包</button></div>`,
      right: `<div class="pad">${c.head('link', '套装共鸣', 'Set')}
        <div class="q-meter"><div class="q-mh"><small>普通六骨</small><b>${n6} / 6</b><em>${n6 >= 6 ? '套装已激活' : `还差 ${6 - n6} 块激活共鸣`}</em></div>${c.bar('vp', n6, 6)}</div>
        <div class="tiles">${[['bone', n, '已装载'], ['hourglass-half', c.fmt(years), '总年限'], ['puzzle-piece', `${BONES.slice(6).filter(([k]) => has(k)).length} / 2`, '外附魂骨']].map(([i, v, l]) => `<div class="tile">${c.sock(i)}<b>${v}</b><small>${l}</small></div>`).join('')}</div>
      </div>`,
    };
  };

  // 背包：左翼是分类筛选与物品列表，主屏是选中物品的定义、批次与使用 / 丢弃，右翼是钱包
  const PACK_CATS = ['全部', '魂骨', '装备', '灵物', '金属', '武器', '消耗', '身份', '入场', '杂项'];
  const pack = c => {
    const items = c.entries(c.ch.背包), defs = c.S.物品 || {};
    const kindOf = n => { for (const [k, g] of c.entries(defs)) if (g && typeof g === 'object' && g[n]) return k; return '杂项'; };
    const cat = PACK_CATS.includes(c.state.ui.cat) ? c.state.ui.cat : '全部', shown = items.filter(([n]) => cat === '全部' || kindOf(n) === cat);
    const sel = shown.find(([n]) => n === c.state.ui.itemsel) || shown[0], wealth = c.ch.财富 || {};
    return {
      tag: 'CORE · INVENTORY', wide: items.length ? '' : 'l', railL: `<div class="rail">${c.sock('box-open')}<b>0</b><small>背包</small></div>`,
      left: `<div class="pad">${c.head('box-open', '背包', 'Inventory', 'gd')}
        <div class="pick-row">${c.pick('cat', cat, PACK_CATS.map(k => ({ value: k, label: `${k} · ${k === '全部' ? items.length : items.filter(([n]) => kindOf(n) === k).length}` })))}</div>
        ${shown.length ? `<div class="list q-list">${shown.map(([n, it]) => `<button class="row${sel && n === sel[0] ? ' on' : ''}" type="button" data-set="itemsel=${c.esc(n)}">${c.sock('cube')}<div><strong>${c.esc(n)}</strong><small>${c.esc(kindOf(n))}${it.批次?.[0]?.品质 ? ` · ${c.esc(it.批次[0].品质)}` : ''}</small></div><span class="end">×${c.fmt(it.数量)}</span></button>`).join('')}</div>` : c.empty('box-open', items.length ? `没有「${cat}」类物品` : '背包是空的', items.length ? '' : '获得的物品会出现在这里')}
      </div>`,
      core: sel ? itemCore(c, sel[0]) : `<div class="pad sparse">${c.empty('box-open', '背包是空的')}<button class="key-s" type="button" data-go="page-terminal/trade" style="align-self:center"><i class="fa-solid fa-store"></i> 去交易</button></div>`,
      right: `<div class="pad">${sel ? `${c.head('hand-pointer', '操作', 'Actions')}${itemActs(c, sel[0])}<div class="groove"></div>` : ''}
        ${c.head('coins', '钱包', 'Wallet', 'gd')}
        <div class="tiles wallet">${ERA_COINS.map(([k, l]) => `<div class="tile">${c.sock('coins', k === '联邦币' ? 'gd' : '')}<b>${c.ed(c.fmt(wealth[k] || 0), c.P('财富', k), { kind: 'number', integer: true, min: 0, raw: c.num(wealth[k]) })}</b><small>${l}</small></div>`).join('')}</div>
        <button class="key-s" type="button" data-go="page-terminal/trade" style="align-self:flex-start"><i class="fa-solid fa-scale-balanced"></i> 去交易</button>
      </div>`,
    };
  };
  document.addEventListener('picker:change', e => { if (e.detail.path !== 'cat') return; const c = window.COCKPIT.ctx(); c.state.ui.cat = e.detail.value; window.COCKPIT.refresh(); });

  document.addEventListener('cockpit:edited', e => {
    const p = e.detail.path, i = p.indexOf('背包'); if (i < 0 || p[i + 2] !== '批次' || p[i + 4] !== '数量') return;
    const c = window.COCKPIT.ctx?.(), it = c && p.slice(0, i + 2).reduce((o, k) => o?.[k], c.S); if (!it) return;
    const idx = Number(p[i + 3]), sum = (it.批次 || []).reduce((s, b, j) => s + c.num(j === idx ? e.detail.value : b.数量), 0);
    e.detail.extra.push({ path: [...p.slice(0, i + 2), '数量'], value: sum });
  });

  window.COCKPIT.register('page-supplies', {
    label: '物资', icon: 'cube', tag: 'CORE · ARMORY',
    keys: [
      { id: 'equip', icon: 'shield-halved', label: '装备', view: equipment },
      { id: 'bones', icon: 'bone', label: '魂骨', view: bones },
      { id: 'pack', icon: 'box-open', label: '背包', view: pack },
    ],
  });
})();

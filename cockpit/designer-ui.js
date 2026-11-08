/* 技能设计台 v2 界面层
 * 数据全部来自 designer-model.js（移植自原项目技能设计台，与原版逐项对拍一致）：分区、字段、选项、显示条件、说明、保存都走它。
 * 这里只做两件事：把 session.view() 的分区 / 字段画成座舱控件；把操作翻译成 session.act() 动作。
 * 说明文字一律走悬停（c.hint / data-hint），界面上不直接放说明。保存时保留条件分支（原版保存会误丢分支，见数据层注释）。
 */
(() => {
  const esc = v => String(v ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  const M = () => window.LWCS_DESIGNER_MODEL;
  // 页签：原版「基础」「消耗与成长」各只有几项，合成一页；分区归属仍按数据层给的 tab。[界面键, 名称, 包含的数据层页签]
  const TABS = [['basic', '基础与消耗', ['基础', '消耗与成长']], ['fx', '效果', ['效果']], ['show', '属性与呈现', ['属性与呈现']]];
  const SAVE_OPTS = { keepConditionBranches: true };

  // 选项：原型选项的 label 是「名称｜说明」，拆成名称 + 悬停说明；分隔行（── 战斗内 ──）不作为可选项
  const opts = list => (list || []).filter(o => !o.disabled && !/^──/.test(String(o.label ?? o.value ?? ''))).map(o => {
    const raw = String(o.label ?? o.value ?? ''), cut = raw.indexOf('｜');
    return { value: String(o.value ?? ''), label: cut > 0 ? raw.slice(0, cut) : raw, hint: o.hint || (cut > 0 ? raw.slice(cut + 1) : ''), group: o.group || '' };
  });
  const A = a => esc(JSON.stringify(a));
  const hintOf = (f, extra = []) => [f.hint || f.tableHint, ...extra].filter(Boolean).join('\n\n');
  const curOptHint = f => { const o = opts(f.options).find(x => x.value === String(f.value ?? '')); return o?.hint ? `当前「${o.label}」：${o.hint}` : ''; };
  const lab = (c, f, extra = []) => `<span class="dzf-l">${esc(f.label || f.key || '')}${f.required ? '<b>*</b>' : ''}${c.hint(hintOf(f, extra))}</span>`;

  // ---------- 数值类控件 ----------
  // 原版这些字段多是裸文本框。这里按字段类型（原项目字段类型表：整数 / 数字 / 带符号数值 / 概率 / COST，或带 resource 的消耗）
  // 换成步进、正负、单位、概率控件；写回的仍是原版格式的字符串（+12%、347、6%、30%、魂力:100），由 COMPOSE 拼出
  const numIn = (value, o = {}, extra = '') => `<input type="number" inputmode="decimal" value="${esc(value)}"${o.min != null && o.min !== '' ? ` min="${esc(o.min)}"` : ''}${o.max != null && o.max !== '' ? ` max="${esc(o.max)}"` : ''} step="${o.stepBy || 'any'}" placeholder="无"${extra}>`;
  const stepper = (input, attrs = '', cls = '') => `<div class="dz-num${cls ? ' ' + cls : ''}"${attrs}><button type="button" class="dz-step" data-step="-1" tabindex="-1" aria-label="减少"><i class="fa-solid fa-minus"></i></button>${input}<button type="button" class="dz-step" data-step="1" tabindex="-1" aria-label="增加"><i class="fa-solid fa-plus"></i></button></div>`;
  const unitSeg = pct => `<span class="dz-useg" role="group" aria-label="单位">${[['0', '点'], ['1', '%']].map(([k, l]) => `<button type="button" data-pctset="${k}" class="${(pct ? '1' : '0') === k ? 'on' : ''}" aria-pressed="${(pct ? '1' : '0') === k}">${l}</button>`).join('')}</span>`;
  const COST_RES = ['魂力', '精神力', '体力'];
  const COMPOSE = {
    // 正负：负数写「-」；正数只在原值 / 默认值带「+」时写「+」（修炼增益 1.15 这类原样不带号）
    signed: h => { const n = h.querySelector('input').value.trim(); return n === '' ? '' : `${h.dataset.sign === '-' ? '-' : h.dataset.plus === '1' ? '+' : ''}${n}${h.dataset.pct === '1' ? '%' : ''}`; },
    amt: h => { const n = h.querySelector('input').value.trim(); return n === '' ? '' : `${n}${h.dataset.pct === '1' ? '%' : ''}`; },
    pct: h => { const n = h.querySelector('input[type=number]').value.trim(); return n === '' ? '' : `${n}%`; },
    plain: h => h.querySelector('input').value.trim(),
    // 多资源：每格「资源:数值[%]」，逗号连接；全空 = 无
    costmap: h => [...h.querySelectorAll('[data-res]')].map(r => { const n = r.querySelector('input').value.trim(); return Number(n) > 0 ? `${r.dataset.res}:${Number(n)}${r.dataset.pct === '1' ? '%' : ''}` : ''; }).filter(Boolean).join(','),
  };
  const unitCtl = (c, f, a) => {
    if (!f.unit) return '';
    const uo = (f.unit.options || []).map(o => typeof o === 'object' ? { value: String(o.value), label: String(o.label ?? o.value) } : { value: String(o), label: String(o) });
    if (f.unit.locked || !uo.length) return `<span class="dz-ufix">${esc(f.unit.value === '百分比' ? '%' : f.unit.value || '点数')}</span>`;
    // 只有「点数 / 百分比」两档时用紧凑的「点 | %」切换（与消耗字段一致），否则用下拉
    if (uo.length === 2 && uo.every(o => ['点数', '百分比'].includes(o.value))) return `<span class="dz-useg" role="group" aria-label="单位" data-unit-act="${A({ ...a, type: 'unit' })}">${uo.map(o => `<button type="button" data-unitset="${esc(o.value)}" class="${o.value === (f.unit.value || '点数') ? 'on' : ''}" aria-pressed="${o.value === (f.unit.value || '点数')}">${o.value === '百分比' ? '%' : '点'}</button>`).join('')}</span>`;
    return c.pick(JSON.stringify({ ...a, type: 'unit' }), f.unit.value || '点数', uo);
  };
  // 百分号规则：数据层给了单位 → 按单位（锁定即固定）；没给 → 看校验式第一段：「%」结尾必带、「%?」可选（给点 / % 切换）、没有就不带
  const pctRule = f => {
    if (f.kind === 'percent') return 'force';
    if (f.unit) return f.unit.locked ? (f.unit.value === '百分比' ? 'force' : 'none') : 'model';
    const alt = String(f.pattern || '').split('|')[0];
    return /%\?$/.test(alt) ? 'toggle' : /%$/.test(alt) ? 'force' : f.pattern ? 'none' : 'toggle';
  };
  const sgnBtn = sign => `<button type="button" class="dz-sgn ${sign === '-' ? 'neg' : 'pos'}" data-sgn aria-label="正负，当前${sign === '-' ? '减少' : '增加'}"><i class="fa-solid fa-${sign === '-' ? 'minus' : 'plus'}"></i></button>`;
  const signedCtl = (c, f, a, act) => {
    const s = String(f.value ?? '').trim(), m = /^([+-]?)(\d+(?:\.\d+)?)(%?)$/.exec(s); if (s && !m) return null; // x1.5 倍率写法退回文本框
    const ref = String(f.default ?? f.placeholder ?? ''), rule = pctRule(f), sign = m?.[1] === '-' ? '-' : '+', plus = m ? m[1] === '+' : !/^\d/.test(ref);
    const pct = rule === 'force' ? true : rule === 'none' ? false : s ? !!m[3] : rule === 'model' ? f.unit.value === '百分比' : /%$/.test(ref);
    const unit = f.unit && rule !== 'toggle' ? unitCtl(c, f, a) : rule === 'toggle' ? unitSeg(pct) : rule === 'force' ? '<span class="dz-ufix">%</span>' : '<span></span>';
    // 1.15 这类小数倍率按 0.05 步进，其余按 1
    const fine = !pct && m && m[2].includes('.') && Number(m[2]) < 10;
    return `<div class="dz-signed"${act} data-compose="signed" data-sign="${sign}" data-plus="${plus ? 1 : 0}" data-pct="${pct ? 1 : 0}">${f.positiveOnly ? '<span></span>' : sgnBtn(sign)}${stepper(numIn(m?.[2] ?? '', { min: 0, stepBy: fine ? 0.05 : null }))}${unit}</div>`;
  };
  // 原版类型是「文本」、内容却是数字的字段
  const NUM_TEXT = { 转化比例: { min: 0, stepBy: 0.1 } };
  const numCtl = (c, f, a) => {
    const k = f.kind, s = String(f.value ?? '').trim(), act = ` data-act="${A(a)}"`;
    if (k === 'number') return f.unit && a.type === 'effectField' ? `<div class="dz-unit">${stepper(numIn(s, f), act)}${unitCtl(c, f, a)}</div>` : stepper(numIn(s, f), act);
    if (k === 'signed' || k === 'percent') return signedCtl(c, f, a, act);
    if (k !== 'text') return null;
    if (f.resource) { const pct = /%$/.test(s); return `<div class="dz-amt"${act} data-compose="amt" data-pct="${pct ? 1 : 0}">${stepper(numIn(s.replace(/%$/, ''), { min: 0, max: pct ? 100 : null }))}${unitSeg(pct)}</div>`; }
    if (f.type === '概率' || f.key === '触发概率') {
      const n = /%$/.test(s) ? s.slice(0, -1) : s === '' ? '' : String(Number((Number(s) * 100).toFixed(2)));
      return `<div class="dz-pct"${act} data-compose="pct"><input type="range" min="0" max="100" step="1" value="${esc(n || 0)}" style="--p:${Number(n) || 0}%" aria-label="${esc(f.label || '概率')}"${n === '' ? ' class="unset"' : ''}><span class="dz-pct-v">${numIn(n, { min: 0, max: 100 })}<i>%</i></span></div>`;
    }
    if (f.type === 'COST') {
      // 伤害结算的触发消耗只收启动阶段绝对值（原版断言），不给 % 切换
      const abs = f.key === '触发消耗', map = Object.fromEntries([...s.matchAll(/([^\s|｜+，,;；:：]+)\s*[:：]\s*(\d+(?:\.\d+)?%?)/g)].map(x => [x[1], x[2]]));
      return `<div class="dz-costmap"${act} data-compose="costmap">${COST_RES.map(r => { const v = map[r] || '', pct = /%$/.test(v); return `<div class="dz-res" data-res="${r}" data-pct="${pct ? 1 : 0}"><span>${r}</span><div class="dz-amt">${stepper(numIn(v.replace(/%$/, ''), { min: 0 }), '', 'mini')}${abs ? '' : unitSeg(pct)}</div></div>`; }).join('')}</div>`;
    }
    if (f.key === '数值') return signedCtl(c, f, a, act);
    if (NUM_TEXT[f.key] && (s === '' || /^\d+(\.\d+)?$/.test(s))) return stepper(numIn(s, NUM_TEXT[f.key]), `${act} data-compose="plain"`);
    return null;
  };

  // ---------- 单个控件 ----------
  const ctl = (c, f, a) => {
    const k = f.kind;
    const nc = numCtl(c, f, a); if (nc) return nc;
    if (k === 'select') { const o = opts(f.options); return c.pick(JSON.stringify(a), f.value ?? '', o.length ? o : [{ value: String(f.value ?? ''), label: String(f.value || '无') }]); }
    if (k === 'multi') {
      const sel = new Set(Array.isArray(f.selected) ? f.selected.map(String) : String(f.value || '').split('|').filter(Boolean));
      return `<div class="dz-chips" role="group" data-act="${A(a)}" data-multi="${f.multiple === false ? 'one' : 'many'}">${opts(f.options).map(o => `<button type="button" class="dz-chip${sel.has(o.value) ? ' on' : ''}${(f.recommended || []).includes(o.value) ? ' rec' : ''}" aria-pressed="${sel.has(o.value)}" data-v="${esc(o.value)}"${o.hint ? ` data-hint="${esc(o.hint)}"` : ''}>${esc(o.label)}</button>`).join('')}</div>`;
    }
    if (k === 'bool') return `<label class="dz-tg"><input type="checkbox" data-act="${A(a)}" data-bool${f.value === true || f.value === '启用' ? ' checked' : ''}><i></i></label>`;
    if (k === 'textarea') return `<textarea data-act="${A(a)}" rows="3"${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''}>${esc(f.value)}</textarea>`;
    if (k === 'tick') return `<div class="dz-tick" data-act="${A(a)}" data-tick>${['日', '时', '分'].map(p => { const lim = f.partLimits?.[p] || {}; return stepper(`<span class="dz-nv"><input type="number" data-part="${p}" value="${esc(f.parts?.[p] ?? 0)}" min="${lim.min ?? 0}"${lim.max != null ? ` max="${lim.max}"` : ''} step="${lim.step ?? 1}" aria-label="${p}"><i>${p}</i></span>`, '', 'mini'); }).join('')}</div>`;
    if (k === 'static') return `<span class="dz-static">${esc(f.display ?? f.value)}</span>`;
    const input = `<input type="${k === 'number' ? 'number' : 'text'}" data-act="${A(a)}" value="${esc(f.value)}"${f.min != null ? ` min="${f.min}"` : ''}${f.max != null ? ` max="${f.max}"` : ''}${f.step != null ? ` step="${f.step}"` : ''}${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''}>`;
    if (f.unit && a.type === 'effectField') return `<div class="dz-unit">${input}${unitCtl(c, f, a)}</div>`;
    return input;
  };
  // 字段 = 标签（含悬停说明）+ 控件；多选 / 时长 / 只读用 div，避免 label 把点击转给第一个按钮
  const field = (c, f, a) => {
    if (!f || f.visible === false || f.kind === 'hidden') return '';
    const wide = f.wide || ['textarea', 'multi'].includes(f.kind) && (f.options || []).length > 4 || f.kind === 'text' && /描述/.test(f.label || '');
    const extra = [f.kind === 'select' ? curOptHint(f) : '', f.summary && f.kind !== 'multi' ? `效果：${f.summary}` : ''];
    // 内含按钮的控件（步进 / 正负 / 单位）不能包在 label 里：点标签文字会触发第一个按钮
    const tag = ['multi', 'tick', 'static', 'number', 'signed', 'percent'].includes(f.kind) || f.kind === 'text' && (f.resource || ['概率', 'COST'].includes(f.type) || ['触发概率', '数值'].includes(f.key) || NUM_TEXT[f.key]) ? 'div' : 'label';
    return `<${tag} class="dzf${wide ? ' wide' : ''}">${lab(c, f, extra)}${ctl(c, f, a)}</${tag}>`;
  };
  const btn = (a, html, o = {}) => `<button type="button" class="key-s${o.cls ? ' ' + o.cls : ''}" data-dz2="${A(a)}"${o.arm ? ' data-arm' : ''}${o.title ? ` title="${esc(o.title)}"` : ''}>${html}</button>`;

  // ---------- 效果行 ----------
  const fv = (row, key) => row.fields.find(f => f.key === key)?.value;
  const rowBrief = row => {
    const key = ['数值', '威力倍率', '状态', '结算', '判定', '规则', '资源', '属性', '干扰', '位移类型', '授予效果'].map(k => fv(row, k)).find(v => v && typeof v !== 'object');
    return [fv(row, '目标'), key && String(key).replace(/\|/g, '、')].filter(Boolean).join(' · ');
  };
  // 原版把一些固定选项字段画成了文本框（如护盾模式）：引擎的原型字段选项表里有选项的，改成下拉
  const engineOpts = (proto, key) => { try { const o = window.COCKPIT.rt('读取原型字段选项_V1')?.(proto, key); return Array.isArray(o) && o.length ? [...o] : null; } catch (e) { return null; } };
  const asSelect = (f, proto) => {
    if (f.kind !== 'text') return f;
    const o = engineOpts(proto, f.key); if (!o) return f;
    const v = String(f.value ?? '');
    return { ...f, kind: 'select', options: (v && !o.includes(v) ? [v, ...o] : o).map(x => ({ value: x, label: x })) };
  };
  const rowFields = (c, row) => row.fields.map(f => {
    if (f.visible === false || f.kind === 'hidden' || f.kind === 'branch') return '';
    // 效果级「副作用列表」：原版保存时把它当黑名单字段拦下（填了就存不了），副作用在独立的副作用分区里设，这里不画
    if (f.key === '副作用列表') return '';
    f = asSelect(f, row.prototypeSelect?.value);
    if (f.kind === 'nested') return nestedBlock(c, row, f);
    if (f.kind === 'object') return `<div class="dzf wide">${lab(c, f)}<div class="dz2-grid">${(f.subfields || []).map(s => field(c, s, { type: 'objectField', path: row.path, key: s.key })).join('')}</div></div>`;
    if (f.kind === 'group') return `<details class="dz-group dzf wide"${f.open ? ' open' : ''}><summary>${esc(f.label)}<span>${esc(f.summary || '')}</span>${c.hint(f.hint || '')}</summary><div class="dz2-grid">${(f.fields || []).filter(s => s.key !== '副作用列表').map(s => field(c, asSelect(s, row.prototypeSelect?.value), { type: 'effectField', path: row.path, key: s.key })).join('')}</div></details>`;
    return field(c, f, { type: 'effectField', path: row.path, key: f.key });
  }).join('');
  // 子效果（机制授予的作用效果、条件分支的替换 / 追加效果）：紧凑块，原型可换、可删
  const subRow = (c, row) => `<div class="fx-sub">
      <div class="fx-sub-head">${field(c, { ...row.prototypeSelect, label: '原型' }, { type: 'prototype', path: row.path })}${row.removable ? btn({ type: 'removeEffect', path: row.path }, '<i class="fa-solid fa-xmark"></i>', { cls: 'danger', arm: true, title: '删除这条子效果' }) : ''}</div>
      <div class="dz2-grid">${rowFields(c, row)}</div>${branchBlock(c, row)}</div>`;
  const nestedBlock = (c, row, f) => `<div class="dzf wide fx-nested">${lab(c, f)}${(f.rows || []).map(r => subRow(c, r)).join('')}<div class="dz2-actions">${btn({ type: 'addEffect', path: [...row.path, f.key] }, `<i class="fa-solid fa-plus"></i> ${esc(f.label || '子效果')}`, { cls: 'mini' })}</div></div>`;
  const branchBlock = (c, row) => {
    const f = row.fields.find(x => x.kind === 'branch'); if (!f || f.visible === false) return '';
    const p = row.path;
    const conds = (b, bi) => b.conditions.map((cd, ci) => {
      const base = { type: 'conditionField', path: p, branch: bi, index: ci };
      const val = cd.值 && cd.值.control ? { ...cd.值.control, label: cd.值.label || '值' } : cd.值 ? { ...cd.值, label: cd.值.label || '值' } : null;
      return `<div class="fx-cond"${cd.preview ? ` data-hint="${esc(cd.preview)}"` : ''}>${field(c, cd.类型, { ...base, key: '类型' })}${cd.对象 && cd.对象.visible !== false && cd.对象.kind !== 'hidden' ? field(c, { ...cd.对象, kind: 'static' }, base) : ''}${cd.比较 && cd.比较.visible !== false ? field(c, cd.比较, { ...base, key: '比较' }) : ''}${val && val.visible !== false ? field(c, val, { ...base, key: '值' }) : ''}${cd.状态 && cd.状态.visible !== false ? field(c, cd.状态, { ...base, key: '状态' }) : ''}${cd.removable ? btn({ type: 'removeCondition', path: p, branch: bi, index: ci }, '<i class="fa-solid fa-xmark"></i>', { cls: 'danger dz2-row-del', title: '删除这个条件' }) : '<span></span>'}</div>`;
    }).join('');
    const lists = (b, bi) => ['替换效果', '追加效果'].map(k => b[k] && b[k].visible !== false ? `<div class="fx-nested"><span class="dzf-l">${esc(b[k].label || k)}${c.hint(b[k].hint || '')}</span>${(b[k].rows || []).map(r => subRow(c, r)).join('')}<div class="dz2-actions">${btn({ type: 'addEffect', path: [...p, '条件分支', bi, k] }, `<i class="fa-solid fa-plus"></i> ${esc(k)}`, { cls: 'mini' })}</div></div>` : '').join('');
    return `<div class="fx-branches">
      <div class="dz2-inline">${lab(c, { label: '条件分支', hint: f.hint, tableHint: f.tableHint })}<label class="dz-tg"><input type="checkbox" data-act="${A({ type: 'branchEnabled', path: p })}" data-bool${f.enabled ? ' checked' : ''}><i></i></label></div>
      ${f.enabled ? (f.branches || []).map((b, bi) => `<div class="fx-branch">
        <div class="fx-branch-head"><i class="fa-solid fa-code-branch"></i>分支 ${bi + 1}${btn({ type: 'removeBranch', path: p, branch: bi }, '<i class="fa-solid fa-trash"></i>', { cls: 'danger', arm: true, title: '删除这个分支' })}</div>
        ${conds(b, bi)}
        <div class="dz2-actions">${btn({ type: 'addCondition', path: p, branch: bi }, '<i class="fa-solid fa-plus"></i> 条件', { cls: 'mini' })}</div>
        <div class="dz2-grid">${field(c, b.action, { type: 'branchAction', path: p, branch: bi })}</div>
        ${lists(b, bi)}
      </div>`).join('') + `<div class="dz2-actions">${btn({ type: 'addBranch', path: p }, '<i class="fa-solid fa-code-branch"></i> 分支', { cls: 'mini' })}</div>` : ''}
    </div>`;
  };

  // ---------- 分区 ----------
  // 附带属性：原版按技能类型推荐的属性标成推荐样式（schema.top.recommendedAttributes）
  const recAttrs = form => { try { return M().schema.top.recommendedAttributes(form) || []; } catch (e) { return []; } };
  const topFields = (c, sec, v) => `<div class="dz2-grid">${(sec.fields || []).filter(f => f.kind !== 'fusionParticipants').map(f => field(c, f.key === 'attachedAttributes' ? { ...f, recommended: recAttrs(v.draft) } : f, { type: 'top', key: f.key })).join('')}</div>`;
  // 融合对象：每行「角色 + 武魂」；本人那一行角色固定、不可移除（数据层 role=self）
  const fusionRows = (c, f) => { const rows = f?.rows || [], selfN = rows.filter(r => r.role === 'self').length; let si = 0, pi = 0; return rows.map((r, i) => `<div class="dz2-item fx-party${r.role === 'self' ? ' self' : ''}"><span class="chip s">${r.role === 'self' ? `本人${selfN > 1 ? ' ' + ++si : ''}` : `搭档 ${++pi}`}</span><div class="dz2-grid">${field(c, r.char, { type: 'fusionParticipant', index: i, key: 'char' })}${field(c, r.spirit, { type: 'fusionParticipant', index: i, key: 'spirit' })}</div>${r.removable ? btn({ type: 'fusionRemove', index: i }, '<i class="fa-solid fa-xmark"></i>', { cls: 'danger', arm: true, title: '移除这个融合对象' }) : '<span></span>'}</div>`).join(''); };
  const secHead = (c, sec, en) => `<h3>${esc(sec.title)}${en ? `<span class="en">${esc(en)}</span>` : ''}${c.hint(sec.hint || '')}</h3>`;
  const effectsSec = (c, v, sec, ui) => {
    const rows = v.rows || [], sel = Math.min(Math.max(0, ui.dzRow || 0), Math.max(0, rows.length - 1)), row = rows[sel];
    const protoOpts = opts(rows[0]?.prototypeSelect?.options || []);
    return `<section class="dz2-sec">${secHead(c, sec, `${rows.length} 条`)}
      <div class="fx-strip" role="tablist">${rows.map((r, i) => `<button type="button" role="tab" class="fx-card${i === sel ? ' on' : ''}" aria-selected="${i === sel}" data-dz2-row="${i}"${opts(r.prototypeSelect.options).find(o => o.value === r.prototypeSelect.value)?.hint ? ` data-hint="${esc(opts(r.prototypeSelect.options).find(o => o.value === r.prototypeSelect.value).hint)}"` : ''}><b>${i + 1}</b><strong>${esc(r.prototypeSelect.value)}</strong><small>${esc(rowBrief(r) || '—')}</small></button>`).join('')}
        <span class="fx-add">${c.pick(JSON.stringify({ type: '__addEffect' }), '', protoOpts, { placeholder: '＋ 新增效果' })}</span></div>
      ${row ? `<div class="fx-detail">
        <div class="fx-detail-head">${field(c, { ...row.prototypeSelect, label: '原型' }, { type: 'prototype', path: row.path })}<span></span>${row.removable ? btn({ type: 'removeEffect', path: row.path }, '<i class="fa-solid fa-trash"></i> 删除', { cls: 'danger', arm: true }) : ''}</div>
        <div class="dz2-grid">${rowFields(c, row)}</div>
        ${branchBlock(c, row)}
      </div>` : `<span class="lbl">术式阵列未装配${c.hint(v.emptyGuide?.desc || v.emptyGuide || '')}</span>`}
    </section>`;
  };
  const sideSec = (c, v, sec) => {
    const list = Array.isArray(v.sideEffects) ? v.sideEffects : (v.sideEffects?.rows || []);
    return `<section class="dz2-sec">${secHead(c, sec, list.length ? `${list.length} 条` : '')}
      ${list.map((r, i) => `<div class="dz2-item"${r.summary ? ` data-hint="${esc(r.summary)}"` : ''}><div class="dz2-grid">${(r.fields || []).map(f => f.hidden ? '' : field(c, f, { type: 'sideEffectField', index: i, key: f.key })).join('')}</div>${btn({ type: 'removeSideEffect', index: i }, '<i class="fa-solid fa-xmark"></i>', { cls: 'danger', arm: true, title: '删除这条副作用' })}</div>`).join('')}
      <div class="dz2-actions">${btn({ type: 'addSideEffect' }, '<i class="fa-solid fa-plus"></i> 副作用', { cls: 'mini' })}</div></section>`;
  };
  const sectionHtml = (c, v, sec, ui) => {
    if (sec.visible === false) return '';
    if (sec.id === 'prototypes') return effectsSec(c, v, sec, ui);
    if (sec.id === 'sideEffects') return sideSec(c, v, sec);
    if (sec.id === 'fusion') { const pf = (sec.fields || []).find(f => f.kind === 'fusionParticipants'); return `<section class="dz2-sec">${secHead(c, sec, pf ? `${(pf.rows || []).length} 人` : '')}${topFields(c, sec, v)}${fusionRows(c, pf)}${pf?.canAdd ? `<div class="dz2-actions">${btn({ type: 'fusionAdd' }, '<i class="fa-solid fa-plus"></i> 融合对象', { cls: 'mini' })}</div>` : ''}</section>`; }
    if (!(sec.fields || []).some(f => f.visible !== false && f.kind !== 'hidden')) return '';
    const grow = (sec.fields || []).some(f => f.kind === 'textarea' && f.visible !== false);
    // 分区的总开关（第一个可见字段是与分区同名的开关，如「技能掌控度」）放进标题行，不再重复一行标签
    const lead = (sec.fields || []).find(f => f.visible !== false && f.kind !== 'hidden');
    if (lead?.kind === 'bool' && lead.label === sec.title) {
      const rest = { ...sec, fields: sec.fields.filter(f => f !== lead) };
      return `<section class="dz2-sec"><h3>${esc(sec.title)}${c.hint([sec.hint, lead.hint].filter(Boolean).join('\n\n'))}<span class="dz2-headtg">${ctl(c, lead, { type: 'top', key: lead.key })}</span></h3>${rest.fields.some(f => f.visible !== false && f.kind !== 'hidden') ? topFields(c, rest, v) : ''}</section>`;
    }
    return `<section class="dz2-sec${grow ? ' grow' : ''}">${secHead(c, sec)}${topFields(c, sec, v)}</section>`;
  };

  // ---------- 会话 ----------
  const metaOf = (c, cur) => {
    const m = M().meta, parts = cur.key.split('/'), rest = parts.slice(1).join('/'), tail = parts.slice(2).join('/');
    switch (cur.group) {
      case '魂环魂技': return m.ring(c.name, parts[0], parts[1], parts[2], parts[3], cur.魂技名);
      case '自创魂技': return m.custom(c.name, rest, cur.魂技名);
      case '武魂融合技': return m.fusion(c.name, rest, cur.魂技名);
      case '血脉散技': return m.blood(c.name, rest, cur.魂技名);
      case '血脉特性': return m.bloodPassive(c.name, rest, cur.魂技名);
      case '血脉魂环': return m.bloodRing(c.name, parts[1], tail, cur.魂技名);
      case '魂骨附带': return m.bone(c.name, parts[1], tail, cur.魂技名);
      case '装备技能': return m.equip(c.name, cur.slotPath, cur.skKey, cur.魂技名);
      default: return null;
    }
  };
  const samePath = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => String(x) === String(b[i]));
  const sKey = (c, cur) => `${c.name}\u0001${cur.key}`;
  const sessionOf = (c, cur) => {
    const ui = c.state.ui, k = sKey(c, cur); ui.dz2 = ui.dz2 || {};
    if (!ui.dz2[k]) {
      const meta = metaOf(c, cur); if (!meta) return null;
      // 魂骨实例上没有、取自物品定义的技能：会话仍挂在佩戴者路径上（预算按佩戴者算），技能显式传入，保存时改写到定义路径
      const writePath = cur.srcPath && !samePath(cur.srcPath, meta.path) ? cur.srcPath : null;
      ui.dz2[k] = { ss: M().session(writePath ? cur.src : null, meta, c.S), meta, writePath, entryKey: cur.key, isNew: !!cur.isNew };
    }
    return ui.dz2[k];
  };
  const DESIGNABLE = ['魂环魂技', '自创魂技', '武魂融合技', '血脉散技', '血脉特性', '血脉魂环', '魂骨附带', '装备技能'];
  // 列表图标：魂环技能用魂环章，其余按来源
  const GROUP_ICON = { 自创魂技: 'pen-nib', 武魂融合技: 'link', 血脉散技: 'droplet', 血脉特性: 'droplet', 血脉魂环: 'droplet', 魂骨附带: 'bone', 装备技能: 'hammer' };
  const designable = s => DESIGNABLE.includes(s.group);
  // 新建：同原版「新建自创魂技 / 新建武魂融合技」入口——在新路径上打开空白设计台，保存后才写进存档
  const NEW_KIND = { 自创魂技: { prefix: '自创', label: '新建自创魂技' }, 武魂融合技: { prefix: '融合', label: '新建武魂融合技' } };
  const newEntries = c => (c.state.ui.dzNew || []).filter(n => n.char === c.name);
  const createNew = (c, group) => {
    const k = NEW_KIND[group]; if (!k) return null;
    const id = `${group}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const entry = { key: `${k.prefix}/${id}`, group, 魂技名: k.label, from: '未保存', char: c.name, isNew: true };
    (c.state.ui.dzNew = c.state.ui.dzNew || []).push(entry);
    return entry;
  };
  const dropNew = (c, key) => { const ui = c.state.ui; ui.dzNew = (ui.dzNew || []).filter(n => !(n.key === key && n.char === c.name)); if (ui.dz2) delete ui.dz2[`${c.name}\u0001${key}`]; };
  const newBtns = () => `<div class="dz2-new">${Object.keys(NEW_KIND).map(g => `<button class="key-s mini" type="button" data-dz2-new="${g}"><i class="fa-solid fa-plus"></i> ${g}</button>`).join('')}</div>`;
  // 删除 / 放弃类按钮原地二次确认：第一次点亮，3 秒内再点才执行；返回 true 表示这次只是点亮
  const armFirst = b => {
    if (b.classList.contains('armed')) return false;
    b.classList.add('armed'); b.dataset.label = b.innerHTML; b.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> 再点确认';
    clearTimeout(b._t); b._t = setTimeout(() => { b.classList.remove('armed'); b.innerHTML = b.dataset.label; }, 3000);
    return true;
  };

  // 左翼底部：对抗试算；最终摘要放右翼预算明细之后（摘要只露几行，全文悬停看）
  const readout = (c, ss, deps) => `<div class="dz-sim">${deps.dzSim(c, ss.tempSkill())}</div>`;
  const summaryHtml = ss => { const sum = ss.summary(), none = sum === '未设置'; return `<div class="dz2-summary"><h3>最终摘要</h3><p class="${none ? 'empty' : 'clamp'}"${none ? '' : ` data-hint="${esc(sum)}"`}>${esc(sum)}</p></div>`; };
  const withSummary = (html, sum) => { const i = html.search(/<div class="(?:warn|okline)">/); return i < 0 ? sum + html : html.slice(0, i) + sum + html.slice(i); };
  const budget = (c, ss, cur, deps) => {
    // 一次保存试跑：拿到与保存断言同一技能、同一上下文的预算（原版魂环魂技按魂环位的标准角色算），以及原版保存校验结果
    let res; try { res = ss.save(SAVE_OPTS); } catch (e) { res = { budget: null, messages: [{ level: 'error', text: String(e.message || e) }] }; }
    const msgs = res.messages || [], err = msgs.find(m => m.level === 'error');
    let html = res.budget ? deps.dzGauge(c, { r: res.budget, block: err ? String(err.text).replace(/^技能生成错误[:：]?/, '') : '' }) : deps.dzPreview(c, ss.tempSkill(), cur.ring);
    // 保存按钮以数据层的原版保存校验为准（含 COST 断言与结构校验）
    // 魂骨 / 装备的技能取自物品定义时，保存写回定义：悬停保存键说明影响范围
    const defHint = cur.srcPath?.[0] === '物品' ? ` data-hint="${esc(`保存写回物品定义「${cur.srcPath[2]}」：持有这件物品的角色一起生效`)}"` : '';
    html = html.replace(/<button class="cta" type="button" data-dz-save[^>]*>/, `<button class="cta" type="button" data-dz2-save${err ? ' disabled' : ''}${defHint}>`);
    if (err && !/无法保存/.test(html)) html = html.replace('<button class="cta"', `<div class="warn"><i class="fa-solid fa-ban"></i><span>无法保存：${esc(err.text)}</span></div><button class="cta"`);
    html = withSummary(html, summaryHtml(ss));
    const warns = msgs.filter(m => m.level === 'warn').map(m => `<li>${esc(m.text)}</li>`).join('');
    return html + (warns ? `<div class="dz2-warns"><i class="fa-solid fa-circle-exclamation"></i><span>保存提醒 ${msgs.filter(m => m.level === 'warn').length} 条</span>${c.hint(msgs.filter(m => m.level === 'warn').map(m => m.text).join('\n'))}</div>` : '');
  };

  const design = (c, deps) => {
    if (!M()) return null;
    const ui = c.state.ui, saved = deps.allSkills(c).filter(designable);
    const all = [...saved, ...newEntries(c).filter(n => !saved.some(s => s.key === n.key))];
    if (!all.length) return { tag: 'CORE · DESIGNER', wide: 'both', core: `<div class="pad sparse">${c.empty('pen-ruler', '还没有可设计的技能')}${newBtns()}</div>`, railL: '', railR: '' };
    const cur = all.find(s => s.key === ui.skill) || all[0], tabDef = TABS.find(t => t[0] === ui.dtab) || TABS[0], tab = tabDef[0];
    const S = sessionOf(c, cur); if (!S) return null;
    const { ss } = S; let v;
    try { v = ss.view(); } catch (e) { console.error(e); return null; }
    if (ui.dzRowFor !== cur.key) { ui.dzRow = 0; ui.dzRowFor = cur.key; }
    const secs = v.sections.filter(s => tabDef[2].includes(s.tab));
    const pend = window.COCKPIT.pending?.()?.skillDesign, pendHere = !!(pend && !pend.growth && samePath(pend.path, S.meta.path));
    const pendBar = !pend ? '' : `<div class="banner"><i class="fa-solid fa-wand-sparkles"></i><div><strong>新技能待确认：${esc(pend.skillName || '新技能')}</strong><small>${esc([pend.charName, pend.sourceLabel].filter(Boolean).join(' · '))}</small></div>${
      pend.growth ? `<button class="key-s" type="button" data-act='{"name":"skillConfirm","op":"design"}'>自行设计</button>`
        : pendHere ? '' : `<button class="key-s" type="button" data-act="${esc(JSON.stringify({ name: 'skillConfirm', op: 'design' }))}">前往设计</button>`
    }<button class="key-s" type="button" data-confirm="保留原技能，不再调整" data-act='{"name":"skillConfirm","op":"continue"}'>保留原技能</button></div>`;
    const body = secs.map(s => sectionHtml(c, v, s, ui)).join('') || '<span class="lbl">本页没有可设置的项目</span>';
    return {
      tag: 'CORE · DESIGNER',
      core: `<div class="pad" data-dz2-key="${esc(sKey(c, cur))}">
        ${c.head('pen-ruler', v.draft?.name || cur.魂技名 || '技能设计台', 'Designer', 'gd', `<span class="legend">${esc(v.typeDisplay || '')} · ${esc(cur.group)}</span>`)}
        ${pendBar}
        <div class="seg" role="tablist">${TABS.map(([k, l]) => `<button class="key-s ${k === tab ? 'on' : ''}" type="button" role="tab" aria-selected="${k === tab}" data-set="dtab=${k}">${l}</button>`).join('')}</div>
        <div class="dz-body"><div class="dz2${tab === 'show' ? ' fill' : ''}">${body}</div></div>
        ${ui.dzErr ? `<div class="warn"><i class="fa-solid fa-triangle-exclamation"></i><span>${esc(ui.dzErr)}</span></div>` : ''}
      </div>`,
      mount: face => mount(face, c, cur, S, deps),
      // 左翼：选技能 → 和标准对手比（对抗试算）；右翼：预算 → 最终摘要 → 保存
      left: `<div class="pad">${c.head('book', '技能', 'Skills')}<div class="list dz2-skills">${all.map(s => `<button class="row${s === cur ? ' on' : ''}" type="button" data-set="skill=${esc(s.key)}" aria-current="${s === cur}">${s.ring ? c.ringMedal(s.ring, String(s.ring.slot).replace(/\D/g, ''), true) : c.sock(GROUP_ICON[s.group] || 'pen-ruler')}<div><strong>${esc(s.魂技名)}</strong><small>${s.isNew ? '未保存' : s.ring ? esc(s.from || '') : esc(s.group)}</small></div><span></span></button>`).join('')}</div>${newBtns()}<div class="groove"></div><div class="dz2-readout">${readout(c, ss, deps)}</div></div>`,
      railL: `<div class="rail">${c.sock('pen-ruler', 'gd')}<b>${all.length}</b><small>可设计技能</small></div>`,
      right: `<div class="pad">${c.head('scale-balanced', '预算核算', 'Budget', 'gd')}<div class="dz-preview">${pendHere ? budget(c, ss, cur, deps).replace(/(<button class="cta" type="button" data-dz2-save[^>]*)>([\s\S]*?)保存设计/, '$1 data-hint="保存后把这次设计交给叙事结算">$2保存并提交剧情') : budget(c, ss, cur, deps)}</div>${ui.dzSaved === cur.key ? '<div class="okline dz2-saved"><i class="fa-solid fa-floppy-disk"></i>已写入存档</div>' : ''}${cur.isNew ? '<button class="key-s danger dz2-discard" type="button" data-dz2-discard><i class="fa-solid fa-trash"></i> 放弃新建</button>' : ''}</div>`,
    };
  };

  // ---------- 事件 ----------
  const focusKey = () => { const el = document.activeElement; const host = el?.closest?.('[data-act],[data-picker]'); return host ? { act: host.dataset.act || host.dataset.picker, part: el.dataset.part || el.dataset.res || '' } : null; };
  const restoreFocus = k => {
    if (!k) return;
    const el = [...document.querySelectorAll('#core [data-act],#core [data-picker]')].find(x => (x.dataset.act || x.dataset.picker) === k.act); if (!el) return;
    const t = k.part ? el.querySelector(`[data-part="${k.part}"],[data-res="${k.part}"]`) : el.matches('input,textarea') ? el : el.querySelector('.picker-btn,input:not([type=range]),input,button');
    t?.focus({ preventScroll: true });
  };
  function mount(face, c, cur, S, deps) {
    const { ss } = S, ui = c.state.ui;
    // 左翼列表里选中的技能滚到可见处（新建项排在末尾）；翼板在主屏之后重绘，等下一帧
    requestAnimationFrame(() => {
      const list = [...document.querySelectorAll('.dz2-skills')].pop(), on = list?.querySelector('.row.on'); if (!on) return;
      const lr = list.getBoundingClientRect(), r = on.getBoundingClientRect();
      if (r.top < lr.top || r.bottom > lr.bottom) list.scrollTop += r.top - lr.top - (lr.height - r.height) / 2;
    });
    const run = (a, quiet = false) => {
      try { ss.act(a); ui.dzErr = ''; } catch (e) { ui.dzErr = String(e.message || e); }
      ui.dzSaved = '';
      if (quiet) return livePreview();
      const k = focusKey(); window.COCKPIT.refresh(); restoreFocus(k);
    };
    // 输入中：只刷新预算 / 摘要 / 试算，不重绘表单（保住光标）；提交（change）时再整体重绘
    const livePreview = () => {
      const pv = [...document.querySelectorAll('.dz-preview')].pop(); if (pv) pv.innerHTML = budget(c, ss, cur, deps);
      const ro = [...document.querySelectorAll('.dz2-readout')].pop(); if (ro) ro.innerHTML = readout(c, ss, deps);
    };
    const withValue = (a, value) => a.type === 'unit' ? { ...a, unit: value } : { ...a, value };
    face.addEventListener('picker:change', e => {
      const a = JSON.parse(e.detail.path);
      if (a.type === '__addEffect') { const n = (ss.view().rows || []).length; ui.dzRow = n; return run([{ type: 'addEffect', path: [] }, { type: 'prototype', path: [n], value: e.detail.value }]); }
      run(withValue(a, e.detail.value));
    });
    // 组合控件（正负 / 单位 / 概率 / 多资源）的值由 COMPOSE 从整组输入拼出；概率滑条与数字框互相同步
    const valueOf = (host, t) => {
      if (t.type === 'range') { const n = host.querySelector('input[type=number]'); n.value = t.value; t.classList.remove('unset'); t.style.setProperty('--p', t.value + '%'); }
      else if (host.dataset.compose === 'pct') { const r = host.querySelector('input[type=range]'); r.value = t.value || 0; r.classList.toggle('unset', t.value === ''); r.style.setProperty('--p', (Number(t.value) || 0) + '%'); }
      return host.dataset.compose ? COMPOSE[host.dataset.compose](host) : t.value;
    };
    face.addEventListener('input', e => {
      const t = e.target; if (t.matches('[data-part]')) return;
      const host = t.closest('[data-act]'); if (!host || t.type === 'checkbox') return;
      run(withValue(JSON.parse(host.dataset.act), valueOf(host, t)), true);
    });
    face.addEventListener('change', e => {
      const t = e.target, host = t.closest('[data-act]'); if (!host) return;
      const a = JSON.parse(host.dataset.act);
      if (host.matches('[data-tick]')) { const v = {}; host.querySelectorAll('[data-part]').forEach(i => { v[i.dataset.part] = Number(i.value) || 0; }); return run({ ...a, value: v }); }
      if (t.type === 'checkbox') return run({ ...a, value: t.checked });
      run(withValue(a, valueOf(host, t)));
    });
    // 步进：按输入框的 step（时长的「分」是 10）增减，夹在 min / max 内；空值从 0 起步。改完派发 change，走同一条写回路径
    const nudge = (input, dir) => {
      const st = Number(input.step) > 0 ? Number(input.step) : 1, cur = input.value === '' ? 0 : Number(input.value) || 0;
      let n = Number((cur + dir * st).toFixed(4));
      if (input.min !== '' && n < Number(input.min)) n = Number(input.min);
      if (input.max !== '' && n > Number(input.max)) n = Number(input.max);
      input.value = String(n); input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    face.addEventListener('click', e => {
      const step = e.target.closest('[data-step]');
      if (step) { const i = step.closest('.dz-num')?.querySelector('input'); if (i) nudge(i, Number(step.dataset.step)); return; }
      const sgn = e.target.closest('[data-sgn]');
      if (sgn) {
        const h = sgn.closest('[data-compose]'), neg = h.dataset.sign !== '-';
        h.dataset.sign = neg ? '-' : '+'; sgn.className = `dz-sgn ${neg ? 'neg' : 'pos'}`; sgn.innerHTML = `<i class="fa-solid fa-${neg ? 'minus' : 'plus'}"></i>`;
        const i = h.querySelector('input'); if (i.value !== '') i.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
      const uset = e.target.closest('[data-unitset]');
      if (uset) { if (!uset.classList.contains('on')) run({ ...JSON.parse(uset.parentElement.dataset.unitAct), unit: uset.dataset.unitset }); return; }
      const us = e.target.closest('[data-pctset]');
      // 点 / % 切换：单位记在最近的 data-pct 上（单个数值控件本身，或多资源里的那一格）；空值只改按钮状态
      if (us) { const h = us.closest('[data-pct]'); if (h.dataset.pct === us.dataset.pctset) return; h.dataset.pct = us.dataset.pctset; const i = h.querySelector('input[type=number]'); us.parentElement.querySelectorAll('[data-pctset]').forEach(x => { x.classList.toggle('on', x === us); x.setAttribute('aria-pressed', x === us); }); if (i.value !== '') i.dispatchEvent(new Event('change', { bubbles: true })); return; }
      const chip = e.target.closest('.dz-chip');
      if (chip) {
        const host = chip.closest('[data-multi]'), a = JSON.parse(host.dataset.act);
        const on = new Set([...host.querySelectorAll('.dz-chip.on')].map(x => x.dataset.v));
        if (host.dataset.multi === 'one') { on.clear(); on.add(chip.dataset.v); } else on.has(chip.dataset.v) ? on.delete(chip.dataset.v) : on.add(chip.dataset.v);
        return run({ ...a, value: [...on] });
      }
      const card = e.target.closest('[data-dz2-row]');
      if (card) { ui.dzRow = Number(card.dataset.dz2Row); return window.COCKPIT.refresh(); }
      const b = e.target.closest('[data-dz2]'); if (!b) return;
      // 删除类操作原地二次确认：第一次点亮，3 秒内再点才执行
      if (b.hasAttribute('data-arm') && armFirst(b)) return;
      const a = JSON.parse(b.dataset.dz2);
      if (a.type === 'removeEffect' && a.path.length === 1) ui.dzRow = Math.max(0, a.path[0] - 1);
      run(a);
    });
  }
  // 保存：走数据层的原版保存链（结构校验 + COST 断言 + 写回路径），通过后把 updates 写进存档
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-dz2-save]'); if (!b || b.disabled) return;
    const c = window.COCKPIT.ctx?.(), key = document.querySelector('[data-dz2-key]')?.dataset.dz2Key, S = c?.state.ui.dz2?.[key]; if (!S) return;
    const r = S.ss.save(SAVE_OPTS);
    if (!r.ok) { c.state.ui.dzErr = (r.messages.find(m => m.level === 'error') || {}).text || '保存失败'; return window.COCKPIT.refresh(); }
    // 保存结果的 updates 一次性写回（lwcs 经桥接走 MVU 校验落楼；原型改内存存档）
    const ops = (r.updates || []).map(u => ({ path: (S.writePath && samePath(u.path, S.meta.path) ? S.writePath : u.path).slice(), value: u.value }));
    if (S.isNew) dropNew(c, S.entryKey);
    delete c.state.ui.dz2[key]; c.state.ui.dzErr = ''; c.state.ui.dzSaved = S.entryKey;
    // 待确认的就是这条技能：写回后按原流程把设计交给叙事结算
    const pend = window.COCKPIT.pending?.()?.skillDesign, submit = !!(pend && !pend.growth && pend.submitAfterSave && samePath(pend.path, S.meta.path));
    Promise.resolve(window.COCKPIT.write(ops)).then(ok => { if (ok && submit) window.COCKPIT.act('skillDesignSaved', { path: S.meta.path }); });
  });
  // 新建：捕获阶段先建好条目、选中它；按钮带 data-go（典籍页入口）时再由座舱完成跳转，否则原地刷新
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-dz2-new]'); if (!b) return;
    const c = window.COCKPIT.ctx?.(); if (!c) return;
    const n = createNew(c, b.dataset.dz2New); if (!n) return;
    Object.assign(c.state.ui, { skill: n.key, dtab: 'basic', dzErr: '' });
    if (!b.dataset.go) window.COCKPIT.refresh();
  }, true);
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-dz2-discard]'); if (!b || armFirst(b)) return;
    const c = window.COCKPIT.ctx?.(), S = c?.state.ui.dz2?.[document.querySelector('[data-dz2-key]')?.dataset.dz2Key]; if (!S?.isNew) return;
    dropNew(c, S.entryKey); Object.assign(c.state.ui, { skill: '', dzErr: '' });
    window.COCKPIT.refresh();
  });

  // 按存档路径找设计台条目（桥接把「打开某技能的设计台」转来时用）
  const keyOfPath = (c, deps, p) => { const hit = deps.allSkills(c).filter(designable).find(s => samePath(metaOf(c, s)?.path, p)); return hit ? hit.key : ''; };
  window.LWCS_DESIGNER_UI = { design, keyOfPath };
})();

// 把「原版 DOM 原型行」与「模型导出行」各自规整成同一种控件序列，便于逐项对照
'use strict';
const ROW = '[data-skill-designer-prototype-row]';
function optsOf(sel) {
  return sel.options.map(o => {
    const g = o.parentNode && o.parentNode.localName === 'optgroup' ? o.parentNode.getAttribute('label') : '';
    return `${o.value}|${o.textContent}|${o.disabled ? 'D' : ''}|${g}`;
  });
}
function isBoundary(el) {
  return el.matches(ROW) || el.hasAttribute('data-skill-designer-condition-row') || el.hasAttribute('data-skill-designer-condition-branch-row') ||
    el.hasAttribute('data-skill-designer-condition-effect') || el.hasAttribute('data-skill-designer-nested-prototype-field') || el.hasAttribute('data-skill-designer-condition-branch');
}
function visibleWithin(el) {
  if (el.localName === 'input' && el.type === 'hidden') return false;
  let n = el;
  while (n && n.parentNode) {
    if (n !== el && isBoundary(n)) return true;
    if (n.hasAttribute && n.hasAttribute('hidden')) return false;
    n = n.parentNode;
  }
  return true;
}
function labelOf(el) {
  let n = el.parentNode;
  while (n && n.parentNode && !isBoundary(n)) {
    if (n.localName === 'label' || n.classList.contains('mvu-editor-field')) {
      if (el.localName === 'input' && el.type === 'hidden' && !(n.localName === 'label' && n.querySelector('.mvu-editor-static')) && !n.hasAttribute('data-skill-designer-time-parts') && !n.hasAttribute('data-skill-designer-filter-select') && !n.hasAttribute('data-skill-designer-suppress-object-editor')) return null;
      const span = n.children.find(c => c.classList.contains('mvu-editor-label'));
      if (!span) { if (n.classList.contains('skill-designer-check-toggle')) { n = n.parentNode; continue; } return null; }
      const badge = span.querySelector('.mvu-editor-hint-badge');
      const text = span.childNodes.filter(c => c !== badge).map(c => c.textContent).join('').trim();
      return { label: text, hint: badge ? badge.getAttribute('data-hint-text') : '' };
    }
    n = n.parentNode;
  }
  return null;
}
function tagOf(el) {
  if (el.localName === 'select') return el.multiple ? 'select-multiple' : 'select';
  if (el.localName === 'textarea') return 'textarea';
  const t = el.type;
  if (t === 'hidden') {
    if (el.hasAttribute('data-skill-designer-time-hidden')) return 'tick-hidden';
    if (el.hasAttribute('data-skill-designer-prototype-multiple')) return 'multi-hidden';
    if (el.hasAttribute('data-skill-designer-prototype-json')) return 'json';
    return 'hidden';
  }
  return t;
}
function fieldEntry(el, role, key) {
  const e = { role, key, tag: tagOf(el) };
  if (el.localName === 'select') { e.value = el.multiple ? el.selectedOptions.map(o => o.value) : el.value; e.options = optsOf(el); }
  else if (el.type === 'checkbox') e.checked = el.checked;
  else e.value = el.value;
  if (el.hasAttribute('disabled')) e.disabled = true;
  e.visible = visibleWithin(el);
  const lb = labelOf(el);
  if (lb) { e.label = lb.label; e.hint = lb.hint || ''; }
  ['min', 'max', 'step', 'pattern', 'placeholder'].forEach(k => { if (el.hasAttribute(k)) e[k] = el.getAttribute(k); });
  return e;
}
function canonDomRow(rowEl) {
  const out = [];
  const sel = rowEl.querySelector('[data-skill-designer-prototype-select]');
  out.push({ role: 'proto', value: sel.value, options: optsOf(sel).map(s => s.replace(/\|[^|]*$/, '|')), removable: !!rowEl.children.find(c => c.hasAttribute('data-skill-designer-remove-prototype')) });
  const fields = rowEl.children.find(c => c.hasAttribute('data-skill-designer-prototype-fields'));
  const walk = el => {
    for (const c of el.children) {
      if (c.matches(ROW)) { out.push({ role: 'row-start' }); out.push(...canonDomRow(c)); out.push({ role: 'row-end' }); continue; }
      if (c.hasAttribute('data-skill-designer-prototype-field')) out.push(fieldEntry(c, 'field', c.getAttribute('data-skill-designer-prototype-field')));
      else if (c.hasAttribute('data-skill-designer-value-unit')) out.push({ role: 'unit', value: c.value, options: optsOf(c), disabled: c.hasAttribute('disabled') });
      else if (c.hasAttribute('data-skill-designer-suppress-object-field')) out.push(fieldEntry(c, 'obj-sub', c.getAttribute('data-skill-designer-suppress-object-field')));
      else if (c.hasAttribute('data-skill-designer-condition-branch-enabled')) out.push({ role: 'branch-enabled', checked: c.checked });
      else if (c.hasAttribute('data-skill-designer-condition-branch-row')) out.push({ role: 'branch-entry' });
      else if (c.hasAttribute('data-skill-designer-condition-branch-action')) out.push(fieldEntry(c, 'branch-action', '处理'));
      else if (c.hasAttribute('data-skill-designer-condition-row')) out.push({ role: 'cond', removable: !!c.children.find(x => x.hasAttribute('data-skill-designer-remove-condition')) });
      else if (c.hasAttribute('data-skill-designer-condition-field')) out.push(fieldEntry(c, 'cond-field', c.getAttribute('data-skill-designer-condition-field')));
      else if (c.hasAttribute('data-skill-designer-condition-preview')) out.push({ role: 'cond-preview', text: c.textContent });
      else if (c.hasAttribute('data-skill-designer-condition-effect')) {
        const span = c.children.find(x => x.classList.contains('mvu-editor-label'));
        const badge = span && span.querySelector('.mvu-editor-hint-badge');
        out.push({ role: 'cond-effect', key: c.getAttribute('data-skill-designer-condition-effect'), visible: !c.hasAttribute('hidden'), hint: badge ? badge.getAttribute('data-hint-text') : '' });
      } else if (c.hasAttribute('data-skill-designer-nested-prototype-field')) {
        const span = c.children.find(x => x.classList.contains('mvu-editor-label'));
        out.push({ role: 'nested', key: c.getAttribute('data-skill-designer-nested-prototype-field'), label: span ? span.textContent.trim() : '' });
      } else if (c.hasAttribute('data-skill-designer-filter-checkbox')) out.push({ role: 'multi-opt', value: c.value, checked: c.checked });
      else if (c.hasAttribute('data-skill-designer-time-part')) out.push({ role: 'tick-part', part: c.getAttribute('data-skill-designer-time-part'), value: c.value, max: c.getAttribute('max') || '' });
      else if (c.classList.contains('skill-designer-state-summary')) out.push({ role: 'summary', text: c.textContent });
      else if (c.localName === 'details' && c.classList.contains('skill-designer-advanced-fields')) {
        const b = c.querySelector('summary b');
        out.push({ role: 'group', summary: b ? b.textContent : '' });
      }
      walk(c);
    }
  };
  if (fields) walk(fields);
  return out;
}
// —— 模型侧 ——
function mOpts(options, dropGroup) {
  return (options || []).map(o => `${o.value}|${o.label}|${o.disabled ? 'D' : ''}|${dropGroup ? '' : o.group || ''}`);
}
function canonModelRow(row) {
  const out = [{ role: 'proto', value: row.prototypeSelect.value, options: mOpts(row.prototypeSelect.options, true), removable: !!row.removable }];
  row.fields.forEach(f => emit(f, out));
  return out;
}
function base(f, tag) {
  const e = { role: 'field', key: f.key, tag };
  return e;
}
function attachCommon(e, f, withLabel) {
  if (f.disabled) e.disabled = true;
  e.visible = !!f.visible;
  if (withLabel) { e.label = f.label; e.hint = f.hint || ''; }
  ['min', 'max', 'step', 'pattern', 'placeholder'].forEach(k => { if (f[k] !== undefined && f[k] !== null) e[k] = String(f[k]); });
  return e;
}
function emit(f, out) {
  if (!f) return;
  switch (f.kind) {
    case 'select': {
      const e = base(f, 'select'); e.value = f.value; e.options = mOpts(f.options); out.push(attachCommon(e, f, true));
      if (f.summary !== undefined) out.push({ role: 'summary', text: f.summary });
      return;
    }
    case 'text': case 'signed': case 'percent': {
      const e = base(f, 'text'); e.value = f.value; out.push(attachCommon(e, f, true));
      if (f.unit) out.push({ role: 'unit', value: f.unit.value, options: mOpts(f.unit.options), disabled: !!f.unit.locked });
      return;
    }
    case 'number': { const e = base(f, 'number'); e.value = f.value; out.push(attachCommon(e, f, true)); return; }
    case 'textarea': { const e = base(f, 'textarea'); e.value = f.value; out.push(attachCommon(e, f, true)); return; }
    case 'hidden': { const e = base(f, 'hidden'); e.value = f.value; e.visible = false; if (f.disabled) e.disabled = true; out.push(e); return; }
    case 'static': { const e = base(f, 'hidden'); e.value = f.value; e.visible = false; e.label = f.label; e.hint = f.hint || ''; out.push(e); return; }
    case 'bool': { const e = base(f, 'checkbox'); e.checked = !!f.value; out.push(attachCommon(e, f, true)); return; }
    case 'tick': {
      const lim = f.partLimits || {};
      [['日', '日'], ['时', '时'], ['分', '分']].forEach(([p]) => out.push({ role: 'tick-part', part: p, value: String(f.parts[p]), max: lim[p] && lim[p].max !== undefined ? String(lim[p].max) : '' }));
      const e = base(f, 'tick-hidden'); e.value = f.value; e.visible = false; e.label = f.label; e.hint = f.hint || ''; out.push(e); return;
    }
    case 'multi': {
      (f.options || []).forEach(o => out.push({ role: 'multi-opt', value: o.value, checked: (f.selected || []).includes(o.value) }));
      const e = base(f, 'multi-hidden'); e.value = f.value; e.visible = false; e.label = f.label; e.hint = f.hint || ''; out.push(e); return;
    }
    case 'object': {
      (f.subfields || []).forEach(s => {
        const e = { role: 'obj-sub', key: s.key, tag: s.kind === 'multi' ? 'select-multiple' : s.kind === 'select' ? 'select' : 'text' };
        if (s.kind === 'multi') { e.value = (s.options || []).filter(o => o.selected).map(o => o.value); e.options = mOpts(s.options); }
        else if (s.kind === 'select') { e.value = s.value; e.options = mOpts(s.options); }
        else e.value = s.value;
        e.visible = true; e.label = s.label; e.hint = s.hint || '';
        if (s.placeholder !== undefined) e.placeholder = s.placeholder;
        out.push(e);
      });
      const e = base(f, 'json'); e.value = f.json; e.visible = false; e.label = f.label; e.hint = f.hint || ''; out.push(e); return;
    }
    case 'group': out.push({ role: 'group', summary: f.summary }); (f.fields || []).forEach(x => emit(x, out)); return;
    case 'nested':
      out.push({ role: 'nested', key: f.key, label: f.label });
      f.rows.forEach(r => { out.push({ role: 'row-start' }); out.push(...canonModelRow(r)); out.push({ role: 'row-end' }); });
      return;
    case 'branch':
      out.push({ role: 'branch-enabled', checked: !!f.enabled });
      f.branches.forEach(b => {
        out.push({ role: 'branch-entry' });
        b.conditions.forEach(c => emitCond(c, out));
        const a = { role: 'branch-action', key: '处理', tag: 'select', value: b.action.value, options: mOpts(b.action.options) };
        out.push(attachCommon(a, b.action, true));
        ['替换效果', '追加效果'].forEach(k => {
          out.push({ role: 'cond-effect', key: k, visible: !!b[k].visible, hint: b[k].hint || '' });
          b[k].rows.forEach(r => { out.push({ role: 'row-start' }); out.push(...canonModelRow(r)); out.push({ role: 'row-end' }); });
        });
      });
      return;
    default: out.push({ role: 'unknown', kind: f.kind, key: f.key });
  }
}
function emitCond(c, out) {
  out.push({ role: 'cond', removable: !!c.removable });
  const sel = (f, key) => { const e = { role: 'cond-field', key, tag: 'select', value: f.value, options: mOpts(f.options) }; return attachCommon(e, f, true); };
  out.push(sel(c.类型, '类型'));
  out.push({ role: 'cond-field', key: '对象', tag: 'hidden', value: c.对象.value, visible: false });
  if (c.isTargetRow) {
    out.push({ role: 'cond-field', key: '比较', tag: 'hidden', value: c.比较.value, visible: false });
  } else {
    const h = { role: 'cond-field', key: '比较', tag: 'hidden', value: c.比较隐藏 ? c.比较隐藏.value : c.比较.value };
    if (c.比较隐藏 && c.比较隐藏.disabled) h.disabled = true;
    h.visible = false;
    out.push(h);
    out.push(sel(c.比较, '比较'));
  }
  if (c.值 && c.值.kind !== 'none') {
    const e = { role: 'cond-field', key: '值', tag: c.值.kind === 'number' ? 'number' : 'select', value: c.值.value };
    if (c.值.options) e.options = mOpts(c.值.options);
    e.visible = !!c.值.visible; e.label = c.值.label; e.hint = '';
    ['min', 'step'].forEach(k => { if (c.值[k] !== undefined) e[k] = String(c.值[k]); });
    out.push(e);
  }
  if (c.状态) out.push(sel(c.状态, '状态'));
  out.push({ role: 'cond-preview', text: c.preview });
}
function diffCanon(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = JSON.stringify(a[i]), y = JSON.stringify(b[i]);
    if (x !== y) return { index: i, orig: a[i], model: b[i] };
  }
  return null;
}
module.exports = { canonDomRow, canonModelRow, diffCanon };

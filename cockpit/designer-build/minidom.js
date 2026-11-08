// 极简 DOM：只为在 node 里跑原版设计台的渲染/挂载/回读代码（测试用）
'use strict';
const VOID = new Set(['input', 'br', 'img', 'hr', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr']);
const RAW = new Set(['textarea', 'script', 'style']);
const decode = s => String(s).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|#39);/gi, (m, e) => {
  const k = e.toLowerCase();
  if (k === 'amp') return '&'; if (k === 'lt') return '<'; if (k === 'gt') return '>'; if (k === 'quot') return '"';
  if (k === 'apos' || k === '#39') return "'"; if (k === 'nbsp') return ' ';
  if (k[0] === '#') return String.fromCodePoint(k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
  return m;
});
const escText = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

class Node {
  constructor() { this.parentNode = null; this.childNodes = []; }
  get parentElement() { return this.parentNode instanceof Element ? this.parentNode : null; }
  get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n.__isDocRoot === true; }
  remove() { if (this.parentNode) { const p = this.parentNode; p.childNodes.splice(p.childNodes.indexOf(this), 1); this.parentNode = null; p.__changed(); } }
  __changed() { let n = this; while (n) { if (n instanceof HTMLSelectElement) n.__dirty = true; n = n.parentNode; } }
}
class Text extends Node {
  constructor(data) { super(); this.data = data; this.nodeType = 3; }
  get textContent() { return this.data; }
  set textContent(v) { this.data = String(v); }
}
class Element extends Node {
  constructor(tag) { super(); this.tagName = tag.toUpperCase(); this.localName = tag.toLowerCase(); this.nodeType = 1; this.attrs = new Map(); this.style = {}; }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  removeAttribute(k) { this.attrs.delete(k); }
  hasAttribute(k) { return this.attrs.has(k); }
  get id() { return this.getAttribute('id') || ''; }
  get className() { return this.getAttribute('class') || ''; }
  set className(v) { this.setAttribute('class', v); }
  get classList() {
    const el = this;
    const list = () => el.className.split(/\s+/).filter(Boolean);
    return {
      contains: c => list().includes(c),
      add: (...cs) => { const l = list(); cs.forEach(c => { if (!l.includes(c)) l.push(c); }); el.className = l.join(' '); },
      remove: (...cs) => { el.className = list().filter(c => !cs.includes(c)).join(' '); },
      toggle: (c, force) => { const has = list().includes(c); const want = force === undefined ? !has : !!force; if (want && !has) el.classList.add(c); if (!want && has) el.classList.remove(c); return want; },
    };
  }
  get hidden() { return this.hasAttribute('hidden'); }
  set hidden(v) { if (v) this.setAttribute('hidden', ''); else this.removeAttribute('hidden'); }
  get dataset() {
    const o = {};
    this.attrs.forEach((v, k) => { if (k.startsWith('data-')) o[k.slice(5).replace(/-([a-z])/g, (m, c) => c.toUpperCase())] = v; });
    return o;
  }
  get children() { return this.childNodes.filter(n => n instanceof Element); }
  get firstElementChild() { return this.children[0] || null; }
  get lastElementChild() { const c = this.children; return c[c.length - 1] || null; }
  get nextElementSibling() { if (!this.parentNode) return null; const s = this.parentNode.children; return s[s.indexOf(this) + 1] || null; }
  get previousElementSibling() { if (!this.parentNode) return null; const s = this.parentNode.children; return s[s.indexOf(this) - 1] || null; }
  get textContent() { return this.childNodes.map(n => n.textContent).join(''); }
  set textContent(v) { this.childNodes.forEach(n => { n.parentNode = null; }); this.childNodes = []; if (String(v) !== '') this.appendChild(new Text(String(v))); this.__changed(); }
  appendChild(n) { if (n.parentNode) n.remove(); n.parentNode = this; this.childNodes.push(n); this.__changed(); return n; }
  insertBefore(n, ref) { if (n.parentNode) n.remove(); const i = ref ? this.childNodes.indexOf(ref) : -1; n.parentNode = this; if (i < 0) this.childNodes.push(n); else this.childNodes.splice(i, 0, n); this.__changed(); return n; }
  get innerHTML() { return this.childNodes.map(serialize).join(''); }
  set innerHTML(html) { this.childNodes.forEach(n => { n.parentNode = null; }); this.childNodes = []; parseInto(this, String(html)); this.__changed(); }
  get outerHTML() { return serialize(this); }
  set outerHTML(html) {
    const p = this.parentNode; if (!p) return;
    const tmp = new HTMLElement('div'); parseInto(tmp, String(html));
    const i = p.childNodes.indexOf(this);
    const nodes = tmp.childNodes.slice(); nodes.forEach(n => { n.parentNode = p; });
    p.childNodes.splice(i, 1, ...nodes); this.parentNode = null; p.__changed();
  }
  insertAdjacentHTML(pos, html) {
    const tmp = new HTMLElement('div'); parseInto(tmp, String(html));
    const nodes = tmp.childNodes.slice();
    const p = this.parentNode;
    const where = String(pos).toLowerCase();
    if (where === 'beforeend') nodes.forEach(n => this.appendChild(n));
    else if (where === 'afterbegin') { const first = this.childNodes[0] || null; nodes.forEach(n => this.insertBefore(n, first)); }
    else if (where === 'beforebegin' && p) nodes.forEach(n => p.insertBefore(n, this));
    else if (where === 'afterend' && p) { const next = p.childNodes[p.childNodes.indexOf(this) + 1] || null; nodes.forEach(n => p.insertBefore(n, next)); }
  }
  matches(sel, scope) { return matchesList(this, parseSelectorList(sel), scope || this); }
  closest(sel) { const list = parseSelectorList(sel); let n = this; while (n instanceof Element) { if (matchesList(n, list, n)) return n; n = n.parentNode; } return null; }
  querySelectorAll(sel) { const list = parseSelectorList(sel); const out = []; walk(this, el => { if (matchesList(el, list, this)) out.push(el); }); return out; }
  querySelector(sel) { const list = parseSelectorList(sel); let found = null; walk(this, el => { if (!found && matchesList(el, list, this)) found = el; return !!found; }); return found; }
  getElementsByTagName(t) { return this.querySelectorAll(t); }
  addEventListener() {} removeEventListener() {} dispatchEvent() { return true; }
  focus() {} blur() {} click() {}
  getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
}
class HTMLElement extends Element {}
class HTMLInputElement extends HTMLElement {
  get type() { return (this.getAttribute('type') || 'text').toLowerCase(); }
  set type(v) { this.setAttribute('type', v); }
  get value() { if (this.__value !== undefined) return this.__value; const a = this.getAttribute('value'); return a === null ? (this.type === 'checkbox' || this.type === 'radio' ? 'on' : '') : a; }
  set value(v) { this.__value = String(v == null ? '' : v); }
  get checked() { return this.__checked !== undefined ? this.__checked : this.hasAttribute('checked'); }
  set checked(v) { this.__checked = !!v; }
  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) { if (v) this.setAttribute('disabled', ''); else this.removeAttribute('disabled'); }
  get name() { return this.getAttribute('name') || ''; }
  get multiple() { return this.hasAttribute('multiple'); }
}
class HTMLTextAreaElement extends HTMLElement {
  get value() { return this.__value !== undefined ? this.__value : this.textContent; }
  set value(v) { this.__value = String(v == null ? '' : v); }
  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) { if (v) this.setAttribute('disabled', ''); else this.removeAttribute('disabled'); }
}
class HTMLOptionElement extends HTMLElement {
  get value() { const a = this.getAttribute('value'); return a === null ? this.textContent.replace(/\s+/g, ' ').trim() : a; }
  set value(v) { this.setAttribute('value', v); }
  get label() { return this.textContent; }
  get disabled() { return this.hasAttribute('disabled'); }
  get selected() { const s = this.__ownerSelect(); if (s) s.__ensure(); return !!this.__selected; }
  set selected(v) { const s = this.__ownerSelect(); if (s) { s.__ensure(); if (v && !s.multiple) s.options.forEach(o => { o.__selected = false; }); } this.__selected = !!v; }
  __ownerSelect() { let n = this.parentNode; while (n) { if (n instanceof HTMLSelectElement) return n; n = n.parentNode; } return null; }
}
class HTMLSelectElement extends HTMLElement {
  constructor(t) { super(t); this.__dirty = true; }
  get multiple() { return this.hasAttribute('multiple'); }
  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) { if (v) this.setAttribute('disabled', ''); else this.removeAttribute('disabled'); }
  get options() { const out = []; walk(this, el => { if (el instanceof HTMLOptionElement) out.push(el); }); return out; }
  __ensure() {
    if (!this.__dirty) return;
    this.__dirty = false;
    const opts = this.options;
    opts.forEach(o => { o.__selected = o.hasAttribute('selected'); });
    if (!this.multiple) {
      const sel = opts.filter(o => o.__selected);
      if (sel.length > 1) sel.slice(0, -1).forEach(o => { o.__selected = false; });
      if (!sel.length) { const first = opts.find(o => !o.disabled); if (first) first.__selected = true; }
    }
  }
  get selectedOptions() { this.__ensure(); return this.options.filter(o => o.__selected); }
  get selectedIndex() { this.__ensure(); return this.options.findIndex(o => o.__selected); }
  set selectedIndex(i) { this.__ensure(); this.options.forEach((o, j) => { o.__selected = j === i; }); }
  get value() { const s = this.selectedOptions[0]; return s ? s.value : ''; }
  set value(v) { this.__ensure(); const t = String(v == null ? '' : v); let hit = false; this.options.forEach(o => { const m = !hit && o.value === t; o.__selected = m; if (m) hit = true; }); }
}
class HTMLButtonElement extends HTMLElement {}
const TAGS = { button: HTMLButtonElement, input: HTMLInputElement, select: HTMLSelectElement, option: HTMLOptionElement, textarea: HTMLTextAreaElement };
const createElement = tag => new (TAGS[tag.toLowerCase()] || HTMLElement)(tag.toLowerCase());

function walk(root, fn) {
  const stack = root.childNodes.slice().reverse();
  while (stack.length) { const n = stack.pop(); if (!(n instanceof Element)) continue; if (fn(n) === true) return; for (let i = n.childNodes.length - 1; i >= 0; i--) stack.push(n.childNodes[i]); }
}
function serialize(n) {
  if (n instanceof Text) return escText(n.data);
  if (!(n instanceof Element)) return '';
  const attrs = [...n.attrs].map(([k, v]) => v === '' ? ` ${k}` : ` ${k}="${escAttr(v)}"`).join('');
  if (VOID.has(n.localName)) return `<${n.localName}${attrs} />`;
  return `<${n.localName}${attrs}>${n.childNodes.map(serialize).join('')}</${n.localName}>`;
}
function parseInto(root, html) {
  const stack = [root];
  let i = 0;
  const cur = () => stack[stack.length - 1];
  const len = html.length;
  while (i < len) {
    const lt = html.indexOf('<', i);
    if (lt < 0) { const t = html.slice(i); if (t) cur().childNodes.push(Object.assign(new Text(decode(t)), { parentNode: cur() })); break; }
    if (lt > i) { const t = html.slice(i, lt); cur().childNodes.push(Object.assign(new Text(decode(t)), { parentNode: cur() })); }
    if (html.startsWith('<!--', lt)) { const e = html.indexOf('-->', lt + 4); i = e < 0 ? len : e + 3; continue; }
    if (html[lt + 1] === '/') {
      const e = html.indexOf('>', lt); const tag = html.slice(lt + 2, e).trim().toLowerCase();
      for (let k = stack.length - 1; k > 0; k--) { if (stack[k].localName === tag) { stack.length = k; break; } }
      i = e + 1; continue;
    }
    if (html[lt + 1] === '!') { const e = html.indexOf('>', lt); i = e + 1; continue; }
    // 开始标签
    const m = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(html.slice(lt, lt + 64));
    if (!m) { cur().childNodes.push(Object.assign(new Text('<'), { parentNode: cur() })); i = lt + 1; continue; }
    const tag = m[1].toLowerCase();
    let j = lt + m[0].length;
    const el = createElement(tag);
    let selfClose = false;
    while (j < len) {
      while (j < len && /\s/.test(html[j])) j++;
      if (html[j] === '>') { j++; break; }
      if (html[j] === '/' && html[j + 1] === '>') { selfClose = true; j += 2; break; }
      const am = /^[^\s=>\/]+/.exec(html.slice(j, j + 256));
      if (!am) { j++; continue; }
      const name = am[0].toLowerCase(); j += am[0].length;
      while (j < len && /\s/.test(html[j])) j++;
      let val = '';
      if (html[j] === '=') {
        j++; while (j < len && /\s/.test(html[j])) j++;
        const q = html[j];
        if (q === '"' || q === "'") { const e = html.indexOf(q, j + 1); val = html.slice(j + 1, e); j = e + 1; }
        else { const vm = /^[^\s>]+/.exec(html.slice(j, j + 1024)); val = vm ? vm[0] : ''; j += val.length; }
      }
      if (!el.attrs.has(name)) el.attrs.set(name, decode(val));
    }
    el.parentNode = cur(); cur().childNodes.push(el);
    if (RAW.has(tag)) {
      const close = html.toLowerCase().indexOf(`</${tag}`, j);
      let content = html.slice(j, close < 0 ? len : close);
      if (tag === 'textarea' && content[0] === '\n') content = content.slice(1);
      if (content) el.childNodes.push(Object.assign(new Text(tag === 'textarea' ? decode(content) : content), { parentNode: el }));
      const e = close < 0 ? len : html.indexOf('>', close);
      i = e < 0 ? len : e + 1; continue;
    }
    if (!VOID.has(tag) && !selfClose) stack.push(el);
    i = j;
  }
}

// ---- 选择器 ----
const selCache = new Map();
function splitTop(s, ch) {
  const out = []; let depth = 0, q = null, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '[' || c === '(') depth++;
    else if (c === ']' || c === ')') depth--;
    else if (c === ch && depth === 0) { out.push(s.slice(start, i)); start = i + 1; }
  }
  out.push(s.slice(start));
  return out;
}
function parseSelectorList(sel) {
  if (selCache.has(sel)) return selCache.get(sel);
  const list = splitTop(sel, ',').map(s => s.trim()).filter(Boolean).map(parseComplex);
  selCache.set(sel, list);
  return list;
}
function parseComplex(s) {
  // 拆成 [{compound, comb}]，comb 为与左侧的关系
  const parts = []; let i = 0; let comb = null;
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) { i++; if (comb === null && parts.length) comb = ' '; }
    if (s[i] === '>') { comb = '>'; i++; continue; }
    if (i >= s.length) break;
    let j = i, depth = 0, q = null;
    while (j < s.length) {
      const c = s[j];
      if (q) { if (c === q) q = null; j++; continue; }
      if (c === '"' || c === "'") { q = c; j++; continue; }
      if (c === '[' || c === '(') depth++;
      if (c === ']' || c === ')') depth--;
      if (depth === 0 && (/\s/.test(c) || c === '>')) break;
      j++;
    }
    parts.push({ comp: parseCompound(s.slice(i, j)), comb: parts.length ? (comb || ' ') : null });
    comb = null; i = j;
  }
  return parts;
}
function parseCompound(s) {
  const c = { tag: null, ids: [], classes: [], attrs: [], pseudos: [] };
  let i = 0;
  const tm = /^[a-zA-Z*][a-zA-Z0-9-]*/.exec(s);
  if (tm) { if (tm[0] !== '*') c.tag = tm[0].toLowerCase(); i = tm[0].length; }
  while (i < s.length) {
    const ch = s[i];
    if (ch === '#') { const m = /^#([^.#\[:\s]+)/.exec(s.slice(i)); c.ids.push(m[1]); i += m[0].length; }
    else if (ch === '.') { const m = /^\.([^.#\[:\s]+)/.exec(s.slice(i)); c.classes.push(m[1]); i += m[0].length; }
    else if (ch === '[') {
      let j = i + 1, q = null; while (j < s.length) { const cc = s[j]; if (q) { if (cc === q) q = null; } else if (cc === '"' || cc === "'") q = cc; else if (cc === ']') break; j++; }
      const body = s.slice(i + 1, j); i = j + 1;
      const m = /^\s*([^\s~|^$*=]+)\s*(?:([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+)))?\s*$/.exec(body);
      c.attrs.push({ name: m[1].toLowerCase(), op: m[2] || null, value: m[3] ?? m[4] ?? m[5] ?? null });
    } else if (ch === ':') {
      const m = /^:([a-zA-Z-]+)(?:\(([^)]*)\))?/.exec(s.slice(i)); c.pseudos.push({ name: m[1], arg: m[2] }); i += m[0].length;
    } else i++;
  }
  return c;
}
function matchCompound(el, c, scope) {
  if (c.tag && el.localName !== c.tag) return false;
  for (const id of c.ids) if (el.id !== id) return false;
  for (const cl of c.classes) if (!el.classList.contains(cl)) return false;
  for (const a of c.attrs) {
    if (!el.hasAttribute(a.name)) return false;
    if (a.op) {
      const v = el.getAttribute(a.name);
      if (a.op === '=' && v !== a.value) return false;
      if (a.op === '~=' && !v.split(/\s+/).includes(a.value)) return false;
      if (a.op === '^=' && !v.startsWith(a.value)) return false;
      if (a.op === '$=' && !v.endsWith(a.value)) return false;
      if (a.op === '*=' && !v.includes(a.value)) return false;
    }
  }
  for (const p of c.pseudos) {
    if (p.name === 'scope') { if (el !== scope) return false; }
    else if (p.name === 'checked') { if (!(el.checked === true || (el instanceof HTMLOptionElement && el.selected))) return false; }
    else if (p.name === 'not') { if (matchesList(el, parseSelectorList(p.arg), scope)) return false; }
    else if (p.name === 'disabled') { if (!el.hasAttribute('disabled')) return false; }
    else return false;
  }
  return true;
}
function matchComplex(el, parts, idx, scope) {
  const { comp, comb } = parts[idx];
  if (!matchCompound(el, comp, scope)) return false;
  if (idx === 0) return true;
  if (comb === '>') { const p = el.parentNode; return p instanceof Element && matchComplex(p, parts, idx - 1, scope); }
  let p = el.parentNode;
  while (p instanceof Element) { if (matchComplex(p, parts, idx - 1, scope)) return true; p = p.parentNode; }
  return false;
}
function matchesList(el, list, scope) { return list.some(parts => matchComplex(el, parts, parts.length - 1, scope)); }

function parseFragment(html) { const root = new HTMLElement('div'); root.__isDocRoot = true; parseInto(root, html); return root; }
module.exports = { HTMLButtonElement, Node, Text, Element, HTMLElement, HTMLInputElement, HTMLSelectElement, HTMLOptionElement, HTMLTextAreaElement, parseFragment, createElement };

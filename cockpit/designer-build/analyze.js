// 解析 bridge 顶层声明与依赖（只读）
const fs = require('fs');
const ts = require(require('path').join(__dirname, '..', '..', '..', 'node_modules', 'typescript'));
const LW = require('path').join(__dirname, '..', '..') + '/';
function analyze() {
  const src = fs.readFileSync(LW + 'mvu_logic_bridge.js', 'utf8');
  const sf = ts.createSourceFile('b.js', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const first = sf.statements[0];
  let fn = first.expression;
  while (fn && (ts.isCallExpression(fn) || ts.isParenthesizedExpression(fn))) fn = ts.isCallExpression(fn) ? fn.expression : fn.expression;
  const body = fn.body.statements;
  const stmts = [];
  const declMap = new Map();
  const lineOf = pos => sf.getLineAndCharacterOfPosition(pos).line + 1;
  const bindNames = (n, out) => {
    if (ts.isIdentifier(n)) out.push(n.text);
    else if (ts.isObjectBindingPattern(n) || ts.isArrayBindingPattern(n)) n.elements.forEach(e => { if (!ts.isOmittedExpression(e)) bindNames(e.name, out); });
  };
  body.forEach((st, i) => {
    const names = [];
    let kind = 'other';
    if (ts.isFunctionDeclaration(st) && st.name) { names.push(st.name.text); kind = 'function'; }
    else if (ts.isVariableStatement(st)) { st.declarationList.declarations.forEach(d => bindNames(d.name, names)); kind = 'var'; }
    else if (ts.isClassDeclaration(st) && st.name) { names.push(st.name.text); kind = 'class'; }
    const refs = new Set();
    const visit = n => {
      if (ts.isIdentifier(n)) {
        const p = n.parent;
        const isPropName = p && ((ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n) || (ts.isMethodDeclaration(p) && p.name === n) || (ts.isBindingElement(p) && p.propertyName === n) || (ts.isLabeledStatement(p)) || (ts.isBreakStatement(p) || ts.isContinueStatement(p)) || (ts.isPropertyDeclaration && ts.isPropertyDeclaration(p) && p.name === n) || ((ts.isGetAccessor(p) || ts.isSetAccessor(p)) && p.name === n));
        if (!isPropName) refs.add(n.text);
      }
      ts.forEachChild(n, visit);
    };
    visit(st);
    const rec = { i, kind, names, refs, start: st.getStart(sf), end: st.end, line: lineOf(st.getStart(sf)), endLine: lineOf(st.end) };
    stmts.push(rec);
    names.forEach(nm => { if (!declMap.has(nm)) declMap.set(nm, rec); else declMap.get(nm).dup = true; });
  });
  return { src, sf, stmts, declMap };
}
function closure(A, roots, exclude = new Set()) {
  const need = new Set();
  const missing = new Set();
  const queue = [...roots];
  while (queue.length) {
    const nm = queue.pop();
    const rec = A.declMap.get(nm);
    if (!rec) { missing.add(nm); continue; }
    if (need.has(rec.i) || exclude.has(nm)) continue;
    need.add(rec.i);
    rec.refs.forEach(r => { if (A.declMap.has(r) && !need.has(A.declMap.get(r).i) && !exclude.has(r)) queue.push(r); });
  }
  return { need, missing };
}
module.exports = { analyze, closure };
if (require.main === module) {
  const A = analyze();
  console.log('top stmts', A.stmts.length, 'decls', A.declMap.size);
  const roots = process.argv.slice(2);
  const { need } = closure(A, roots);
  const list = [...need].sort((a, b) => a - b).map(i => A.stmts[i]);
  let lines = 0; list.forEach(r => lines += r.endLine - r.line + 1);
  console.log('closure stmts', list.length, 'lines', lines);
  const ranges = list.map(r => r.line);
  console.log('min line', Math.min(...ranges), 'max line', Math.max(...ranges));
  // 显示 3000 行之外与 17000-31000 之外的项
  console.log(list.filter(r => r.line > 31000 || r.line < 17000).map(r => r.line + ':' + r.names.join(',') + '(' + (r.endLine - r.line + 1) + ')').join('  '));
}

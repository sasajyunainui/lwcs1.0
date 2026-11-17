// 剧情推进终端：把 style.css / body.html / script.js 拼成酒馆正则的 replaceString，写回 regex JSON。
// 用法：node plot-terminal/build.cjs （在 lwcs 目录下）。改界面只改这三个源文件，不要直接改 JSON
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const target = path.join(dir, '..', 'regex-缝合怪東方花映塚剧情推进美化v1_0.json');
const VERSION = '3.13.1';
// 每条用户消息都带一份完整的 replaceString（样式 + 脚本），酒馆助手再把它渲染成一个 iframe；体积直接决定消息 DOM 大小和每楼解析耗时。
// 无损压缩：样式用 csso（restructure 关闭，不合并不重排规则）、脚本用 terser（只去空白注释、缩短局部变量名，不动全局名与属性名）。找不到压缩工具时原样输出
const findTool = name => { const base = path.join(dir, '..', '..', 'node_modules', '.pnpm'); try { return require(name); } catch (e) {} try { const d = fs.readdirSync(base).find(x => x.startsWith(name + '@')); return d ? require(path.join(base, d, 'node_modules', name)) : null; } catch (e) { return null; } };
const csso = findTool('csso'), terser = findTool('terser');
// 消息渲染会把「&字母」当 HTML 实体：压缩后 && 与后面的标识符贴在一起（&&current），统一在 & 后补一个空格（源码字符串里本来就没有 &字母，不会改到字符串内容）
const safeAmp = text => text.replace(/&(?=[A-Za-z#])/g, '& ');
// 消息渲染（markdown）会把代码块里的「&字母」当 HTML 实体解码：child&&current → child&¤t，整段脚本语法错误、界面点不动。
// 源码里 & 后面不许直接跟字母或 #（写成 && current）
const read = name => {
  const text = fs.readFileSync(path.join(dir, name), 'utf8').replace(/\r\n/g, '\n').trimEnd();
  const bad = [...text.matchAll(/&[A-Za-z#]/g)].map(m => `${name}:${text.slice(0, m.index).split('\n').length} …${text.slice(Math.max(0, m.index - 20), m.index + 12)}…`);
  if (bad.length) { console.error('「&」后紧跟字母会被当成 HTML 实体，请在 & 后加空格：\n' + bad.join('\n')); process.exit(1); }
  return text;
};
const minCss = css => csso ? csso.minify(css, { restructure: false }).css : css;
const minJs = async js => { if (!terser) return js; const r = await terser.minify(js, { compress: { passes: 2 }, mangle: true, format: { comments: false } }); if (r.error || !r.code) throw (r.error || new Error('terser 无输出')); return r.code; };
(async () => {
const cssText = safeAmp(minCss(read('style.css'))), jsText = safeAmp(await minJs(read('script.js')));
new Function(jsText); // 压缩结果必须仍是合法脚本
const html = [
  '```html',
  '<!DOCTYPE html>',
  '<html lang="zh-CN" style="color-scheme:light">',
  '<head>',
  '<meta charset="UTF-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1">',
  '<style>',
  cssText,
  '</style>',
  '</head>',
  '<body>',
  read('body.html'),
  '<script>',
  jsText,
  '</script>',
  '</body>',
  '</html>',
  '```',
  '',
].join('\n');
const json = JSON.parse(fs.readFileSync(target, 'utf8'));
json.scriptName = `剧情推进终端v${VERSION}`;
json.replaceString = html;
fs.writeFileSync(target, JSON.stringify(json, null, 2) + '\n');
console.log(`${json.scriptName} · replaceString ${html.length} 字符（样式 ${cssText.length}，脚本 ${jsText.length}）→ ${path.basename(target)}`);
})().catch(e => { console.error(e); process.exit(1); });

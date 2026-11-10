// 剧情推进终端：把 style.css / body.html / script.js 拼成酒馆正则的 replaceString，写回 regex JSON。
// 用法：node plot-terminal/build.cjs （在 lwcs 目录下）。改界面只改这三个源文件，不要直接改 JSON
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const target = path.join(dir, '..', 'regex-缝合怪東方花映塚剧情推进美化v1_0.json');
const VERSION = '3.6.3';
// 消息渲染（markdown）会把代码块里的「&字母」当 HTML 实体解码：child&&current → child&¤t，整段脚本语法错误、界面点不动。
// 源码里 & 后面不许直接跟字母或 #（写成 && current）
const read = name => {
  const text = fs.readFileSync(path.join(dir, name), 'utf8').replace(/\r\n/g, '\n').trimEnd();
  const bad = [...text.matchAll(/&[A-Za-z#]/g)].map(m => `${name}:${text.slice(0, m.index).split('\n').length} …${text.slice(Math.max(0, m.index - 20), m.index + 12)}…`);
  if (bad.length) { console.error('「&」后紧跟字母会被当成 HTML 实体，请在 & 后加空格：\n' + bad.join('\n')); process.exit(1); }
  return text;
};
const html = [
  '```html',
  '<!DOCTYPE html>',
  '<html lang="zh-CN" style="color-scheme:light">',
  '<head>',
  '<meta charset="UTF-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1">',
  '<style>',
  read('style.css'),
  '</style>',
  '</head>',
  '<body>',
  read('body.html'),
  '<script>',
  read('script.js'),
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
console.log(`${json.scriptName} · replaceString ${html.length} 字符 → ${path.basename(target)}`);

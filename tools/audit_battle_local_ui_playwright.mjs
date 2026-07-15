import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, '..', '..');
const lwcsDir = path.resolve(root, 'lwcs');
const artifactsDir = path.resolve(root, 'artifacts', 'battle_ui_local_playwright');
fs.mkdirSync(artifactsDir, { recursive: true });

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = [
    path.resolve(root, 'node_modules', 'playwright'),
    path.resolve(process.env.USERPROFILE || '', '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', '.pnpm'),
  ];
  if (fs.existsSync(candidates[0])) return require(candidates[0]);
  const pnpmRoot = candidates[1];
  const versionDir = fs.existsSync(pnpmRoot)
    ? fs.readdirSync(pnpmRoot).find(name => /^playwright@/.test(name) && fs.existsSync(path.join(pnpmRoot, name, 'node_modules', 'playwright')))
    : '';
  if (!versionDir) throw new Error('local_playwright_runtime_missing');
  return require(path.join(pnpmRoot, versionDir, 'node_modules', 'playwright'));
}

function findChrome() {
  const candidates = [
    path.resolve(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  const executablePath = candidates.find(candidate => fs.existsSync(candidate));
  if (!executablePath) throw new Error('local_chromium_executable_missing');
  return executablePath;
}

function extractFunction(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  if (start < 0) throw new Error(`fixture_function_missing:${functionName}`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`fixture_function_unclosed:${functionName}`);
}

const styleCode = fs.readFileSync(path.resolve(lwcsDir, 'mvu_styles.css'), 'utf8');
const battleUiCode = fs.readFileSync(path.resolve(lwcsDir, 'BattleUI_Module.js'), 'utf8');
const dragFunction = extractFunction(battleUiCode, '绑定战斗记录终端拖动');
const escapeStyle = value => String(value).replace(/<\/style/gi, '<\\/style');
const escapeScript = value => String(value).replace(/<\/script/gi, '<\\/script');

function buildFixture(viewport) {
  const inline = viewport.width <= 1180;
  const roundRows = Array.from({ length: 20 }, (_, index) => `
    <div class="battle-round-dashboard-row">
      <div class="battle-round-dashboard-head"><span>第${index + 1}回合</span><b>${index % 3 === 0 ? '双方交锋' : '回合结束'}</b></div>
      <div class="battle-round-dashboard-bars"><span class="battle-round-dashboard-delta is-loss"><span class="battle-round-dashboard-delta-text">我方 -${index + 2} HP</span></span><span class="battle-round-dashboard-delta is-loss"><span class="battle-round-dashboard-delta-text">敌方 -${index + 5} HP</span></span></div>
      <div class="battle-round-dashboard-resources"><span class="battle-round-dashboard-badge battle-round-dashboard-badge--resource" data-actor="唐凌雪" data-resource="魂力" data-delta="10" data-source-event-id="recover-player-${index + 1}">唐凌雪 魂力 +10</span><span class="battle-round-dashboard-badge battle-round-dashboard-badge--resource" data-actor="韦小枫" data-resource="魂力" data-delta="10" data-source-event-id="recover-enemy-${index + 1}">韦小枫 魂力 +10</span></div>
    </div>`).join('');
  const views = {
    round: `<section class="battle-round-dashboard" aria-label="回合速览">${roundRows}</section>`,
    report: `<section class="battle-structured-report-round"><header class="battle-structured-report-round-head"><span>第1回合</span><b>双方交锋</b></header><p class="battle-structured-report-exchange"><b>交锋</b><span class="battle-structured-report-copy">唐凌雪以<button class="battle-preview-report-skill" type="button">【冰锋突袭】</button>指向韦小枫，随后韦小枫以<button class="battle-preview-report-skill" type="button">【青影蛇群】</button>指向唐凌雪</span></p><div class="battle-structured-report-actions"><article class="battle-preview-report-group"><header class="battle-structured-report-head"><span>动作</span><b>唐凌雪 · <button class="battle-preview-report-skill" type="button">【冰锋突袭】</button></b></header><p class="battle-structured-report-intent"><b>意图</b><span class="battle-structured-report-copy">以<button class="battle-preview-report-skill" type="button">【冰锋突袭】</button>抓住当前命中窗口</span></p><p class="battle-structured-report-outcome"><b>结果</b><span class="battle-structured-report-copy"><button class="battle-preview-report-skill" type="button">【冰锋突袭】</button>命中并造成 86 点伤害</span></p></article><article class="battle-preview-report-group"><header class="battle-structured-report-head"><span>动作</span><b>韦小枫 · <button class="battle-preview-report-skill" type="button">【青影蛇群】</button></b></header><p class="battle-structured-report-outcome"><b>结果</b><span class="battle-structured-report-copy"><button class="battle-preview-report-skill" type="button">【青影蛇群】</button>召唤追击造成 26 点伤害</span></p></article></div><p class="battle-structured-report-passive"><b>回合结算</b><span class="battle-structured-report-copy"><span class="battle-preview-report-badge battle-preview-report-badge--resource" data-actor="唐凌雪" data-resource="魂力" data-delta="10" data-source-event-id="report-recover-player">唐凌雪 魂力 +10</span><span class="battle-preview-report-badge battle-preview-report-badge--resource" data-actor="韦小枫" data-resource="魂力" data-delta="10" data-source-event-id="report-recover-enemy">韦小枫 魂力 +10</span></span></p></section>`,
    decision: `<div class="battle-decision-filter"><label>回合<select><option>第1回合</option></select></label><label>动作<select><option>唐凌雪 · 冰锋突袭</option></select></label></div><details class="battle-preview-trace-row" open><summary>命中与伤害判定</summary><p>命中概率 78%，检定通过，最终伤害 86。</p></details>`,
    summary: `<section class="battle-final-summary"><header class="battle-final-summary-head"><span>第10回合终态</span><b>我方获胜</b></header><div class="battle-final-summary-sides"><section class="battle-final-summary-side"><h4>我方</h4><div class="battle-final-summary-unit"><b>唐凌雪</b><span>HP 344/565</span><span>魂力 1724/2166</span></div></section><section class="battle-final-summary-side"><h4>敌方</h4><div class="battle-final-summary-unit"><b>韦小枫</b><span>HP 1/538</span><span>失去战斗力</span></div></section></div><section class="battle-final-summary-intent"><h4>下一步意图</h4><p><b>我方</b>结束交锋并确认战果</p><p><b>敌方</b>已失去战斗能力</p></section></section>`,
  };
  const fixtureScript = `
    const node = document.querySelector('#ui-battle-record-terminal');
    const component = { recordPortalPosition: null };
    const root = window;
    function 同步战斗记录终端位置() {
      if (innerWidth <= 1180 || !component.recordPortalPosition) return;
      const margin = 10;
      const rect = node.getBoundingClientRect();
      const left = Math.max(margin, Math.min(component.recordPortalPosition.left, innerWidth - margin - rect.width));
      const top = Math.max(margin, Math.min(component.recordPortalPosition.top, innerHeight - margin - rect.height));
      node.style.setProperty('--战斗记录外置-left', Math.round(left) + 'px');
      node.style.setProperty('--战斗记录外置-top', Math.round(top) + 'px');
    }
    ${dragFunction}
    绑定战斗记录终端拖动(node);
    const views = ${JSON.stringify(views)};
    const renderView = view => {
      document.querySelectorAll('[data-battle-record-view]').forEach(button => {
        const active = button.dataset.battleRecordView === view;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
        button.setAttribute('tabindex', active ? '0' : '-1');
      });
      const panel = document.querySelector('.battle-record-view');
      panel.dataset.activeView = view;
      panel.innerHTML = views[view];
    };
    document.querySelectorAll('[data-battle-record-view]').forEach(button => button.addEventListener('click', () => renderView(button.dataset.battleRecordView)));
    renderView('round');
  `;
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;min-height:100%;background:#06101a;color:#edf7ff}body::before,body::after{pointer-events:none!important}#mvu-unified-mount{padding:16px}#mvu-battle-inline-host{width:min(100%,900px)}.battle-module-scope{min-height:720px}#ui-battle-record-terminal{pointer-events:auto!important}${escapeStyle(styleCode)}</style></head><body class="mvu-layout-holo"><div id="mvu-unified-mount"><div id="mvu-battle-inline-host"><div class="battle-module-scope"></div>${inline ? '' : '</div></div>'}<div class="battle-record-terminal ${inline ? 'battle-record-terminal--inline' : 'battle-record-terminal--portal'}" id="ui-battle-record-terminal" style="${inline ? '' : '--战斗记录外置-top:20px;--战斗记录外置-left:20px;--战斗记录外置-width:clamp(480px,32vw,640px);--战斗记录外置-height:calc(100vh - 40px)'}"><div class="battle-record-header"><button class="battle-record-toggle" id="ui-battle-record-toggle" type="button" aria-expanded="true">记录</button></div><div class="battle-record-body"><div class="battle-record-tabs" role="tablist" aria-label="战斗记录"><button class="battle-record-tab active" role="tab" aria-selected="true" tabindex="0">实战记录</button><button class="battle-record-tab" role="tab" aria-selected="false" tabindex="-1">预演记录</button></div><div class="battle-preview-panel"><div class="battle-preview-head"><span>预演结果</span><b>正式结构化记录</b><em>推进20回合</em></div><div class="battle-record-view-tabs" role="tablist" aria-label="记录视图">${['round:回合','report:战报','decision:判定','summary:总结'].map(item => { const [view,label]=item.split(':'); return `<button class="battle-record-view-tab${view === 'round' ? ' active' : ''}" type="button" role="tab" data-battle-record-view="${view}" aria-selected="${view === 'round'}" tabindex="${view === 'round' ? '0' : '-1'}">${label}</button>`; }).join('')}</div><section class="battle-record-view" role="tabpanel"></section></div></div></div>${inline ? '</div></div>' : ''}<script>${escapeScript(fixtureScript)}<\/script></body></html>`;
}

const viewports = [
  { width: 1896, height: 1000 },
  { width: 1366, height: 900 },
  { width: 1024, height: 820 },
  { width: 390, height: 844 },
];
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, executablePath: findChrome() });
const results = [];
try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await page.setContent(buildFixture(viewport), { waitUntil: 'load' });
    const terminal = page.locator('#ui-battle-record-terminal');
    const initial = await page.evaluate(() => {
      const node = document.querySelector('#ui-battle-record-terminal');
      const panel = document.querySelector('.battle-preview-panel');
      const rect = node.getBoundingClientRect();
      return {
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
        viewport: { width: innerWidth, height: innerHeight },
        documentOverflow: document.documentElement.scrollWidth - innerWidth,
        panelOverflow: panel.scrollWidth - panel.clientWidth,
        panelScrollable: panel.scrollHeight > panel.clientHeight,
      };
    });
    const viewChecks = {};
    let resourceBadges = [];
    for (const view of ['round', 'report', 'decision', 'summary']) {
      await page.locator(`[data-battle-record-view="${view}"]`).click({ force: true });
      viewChecks[view] = await page.evaluate(activeView => {
        const node = document.querySelector('#ui-battle-record-terminal');
        const panel = document.querySelector('.battle-preview-panel');
        const view = document.querySelector('.battle-record-view');
        const rect = node.getBoundingClientRect();
        const contentRect = view.getBoundingClientRect();
        return {
          activeCount: document.querySelectorAll('[data-battle-record-view][aria-selected="true"]').length,
          activeView: view.dataset.activeView,
          horizontalOverflow: Math.max(0, panel.scrollWidth - panel.clientWidth),
          blankTail: Math.max(0, Math.round(rect.bottom - contentRect.bottom - 12)),
          terminalHeight: Math.round(rect.height),
          contentHeight: Math.round(contentRect.height),
        };
      }, view);
      if (view === 'report') {
        resourceBadges = await page.evaluate(() => [...document.querySelectorAll('[data-resource][data-delta][data-source-event-id]')].map(node => ({
          actor: node.getAttribute('data-actor'),
          resource: node.getAttribute('data-resource'),
          delta: node.getAttribute('data-delta'),
          sourceEventId: node.getAttribute('data-source-event-id'),
        })));
        viewChecks.report.actionReferences = await page.evaluate(() => [...document.querySelectorAll('.battle-preview-report-skill')].map(node => ({
          display: getComputedStyle(node).display,
          parentClass: node.parentElement?.className || '',
          height: Math.round(node.getBoundingClientRect().height),
          lineHeight: Math.round(parseFloat(getComputedStyle(node).lineHeight) || 0),
        })));
      }
    }
    let drag = null;
    if (viewport.width > 1180) {
      const box = await terminal.boundingBox();
      await page.mouse.move(box.x + 8, box.y + 12);
      await page.mouse.down();
      await page.mouse.move(-400, -400, { steps: 5 });
      await page.mouse.up();
      drag = await page.evaluate(() => {
        const rect = document.querySelector('#ui-battle-record-terminal').getBoundingClientRect();
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
      });
    }
    await page.locator('[data-battle-record-view="report"]').click({ force: true });
    const screenshotPath = path.resolve(artifactsDir, `battle-record-${viewport.width}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    const failures = [];
    if (initial.documentOverflow > 1 || initial.panelOverflow > 1) failures.push('horizontal_overflow');
    if (initial.rect.left < -1 || initial.rect.right > viewport.width + 1) failures.push('terminal_outside_horizontal_viewport');
    if (initial.rect.top < -1 || initial.rect.bottom > viewport.height + 1) failures.push('terminal_outside_vertical_viewport');
    if (!initial.panelScrollable) failures.push('long_round_view_not_scrollable');
    Object.entries(viewChecks).forEach(([view, check]) => {
      if (check.activeCount !== 1 || check.activeView !== view) failures.push(`${view}_view_not_exclusive`);
      if (check.horizontalOverflow > 1) failures.push(`${view}_horizontal_overflow`);
      if (view !== 'round' && check.blankTail > 28) failures.push(`${view}_excess_blank_tail:${check.blankTail}`);
    });
    if (resourceBadges.length !== 2 || resourceBadges.some(item => !item.actor || !item.resource || !item.delta || !item.sourceEventId)) failures.push('resource_badges_not_independent');
    if (!viewChecks.report.actionReferences?.length || viewChecks.report.actionReferences.some(item =>
      item.display !== 'inline' ||
      (!item.parentClass.includes('battle-structured-report-copy') && item.parentClass !== '') ||
      item.height > item.lineHeight * 1.6
    )) failures.push('report_action_reference_broke_inline_flow');
    if (drag && (drag.left < 9 || drag.top < 9 || drag.right > viewport.width - 9 || drag.bottom > viewport.height - 9)) failures.push('drag_boundary_failed');
    results.push({ viewport, initial, viewChecks, resourceBadges, drag, screenshotPath, failures });
    await page.close();
  }
} finally {
  await browser.close();
}

const summary = {
  viewportCount: results.length,
  passedViewportCount: results.filter(result => result.failures.length === 0).length,
  failureCount: results.reduce((sum, result) => sum + result.failures.length, 0),
  evidenceDir: artifactsDir,
};
console.log(JSON.stringify({ summary, results }, null, 2));
if (summary.failureCount > 0) process.exitCode = 1;

/* ProfessionUI_Module.js - 武装工坊组件 (JS 模块版) */

const ProfessionStyles = `
  .prof-module-scope {
    --panel: rgba(18, 56, 69, 0.22);
    --panel-strong: rgba(23, 68, 84, 0.30);
    --line: rgba(150, 217, 228, 0.24);
    --line-soft: rgba(150, 217, 228, 0.10);
    --cyan: #8de1ef;
    --cyan-soft: rgba(141, 225, 239, 0.16);
    --gold: #d7c070;
    --gold-soft: rgba(228, 201, 111, 0.16);
    --red: #ff8aa2;
    --green: #7dffb2;
    --text: #e4f5f9;
    --text-sub: #bfdde4;
    --text-dim: #87aeb7;
    --font-tech: 'Orbitron', sans-serif;
    --font-cjk: 'Noto Serif SC', serif;

    width: 100%;
    color: var(--text);
    font-family: var(--font-cjk);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .prof-module-scope .top-status {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .prof-module-scope .status-chip {
    background: rgba(0,0,0,0.18);
    border: 1px solid var(--line-soft);
    border-radius: 6px;
    padding: 8px;
  }

  .prof-module-scope .chip-label {
    font-size: 10px;
    color: var(--text-dim);
    margin-bottom: 4px;
    text-transform: uppercase;
  }

  .prof-module-scope .chip-value {
    font-family: var(--font-tech);
    font-size: 12px;
    color: var(--gold);
    word-break: break-all;
  }

  .prof-module-scope .tabs {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .prof-module-scope .tab-btn {
    border: 1px solid var(--line-soft);
    background: rgba(0,0,0,0.16);
    color: var(--text-dim);
    border-radius: 6px;
    padding: 8px 6px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    transition: 0.2s ease;
  }

  .prof-module-scope .tab-btn.active {
    color: var(--cyan);
    border-color: var(--cyan);
    background: rgba(141, 225, 239, 0.12);
    box-shadow: inset 0 0 8px rgba(141, 225, 239, 0.08);
  }

  .prof-module-scope .section-card {
    background: rgba(0,0,0,0.18);
    border: 1px solid var(--line-soft);
    border-radius: 8px;
    padding: 12px;
  }

  .prof-module-scope .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    font-family: var(--font-title);
    font-size: 14px;
    line-height: 1.2;
    color: var(--white);
    font-weight: 700;
    margin-bottom: 10px;
    letter-spacing: 0.55px;
    text-transform: none;
    text-shadow: 0 1px 0 rgba(255,255,255,0.05), 0 0 6px rgba(77,240,255,0.08);
  }

  .prof-module-scope .section-title::before {
    content: '◈';
    font-size: 10px;
    color: var(--cyan);
    flex: 0 0 auto;
  }

  .prof-module-scope .section-title::after {
    content: '';
    flex: 1;
    min-width: 28px;
    height: 1px;
    background: linear-gradient(90deg, rgba(103,247,239,0.38), rgba(255,226,89,0.16), transparent);
    opacity: 0.78;
  }

  .prof-module-scope .form-group {
    margin-bottom: 12px;
  }
  .prof-module-scope .form-group:last-child { margin-bottom: 0; }

  .prof-module-scope .form-group label {
    display: block;
    font-size: 11px;
    color: var(--cyan);
    margin-bottom: 6px;
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  .prof-module-scope .tech-select, .prof-module-scope .tech-input {
    width: 100%;
    background: var(--panel-strong);
    border: 1px solid var(--line-soft);
    color: var(--cyan);
    padding: 8px 9px;
    border-radius: 6px;
    font-family: var(--font-cjk);
    font-size: 12px;
    outline: none;
    transition: border-color 0.2s;
    box-sizing: border-box;
  }
  .prof-module-scope .tech-select:focus, .prof-module-scope .tech-input:focus { border-color: var(--cyan); }
  .prof-module-scope .tech-select option { background: #1a2a32; color: var(--text); }

  .prof-module-scope .inline-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .prof-module-scope .metal-list-container {
    max-height: 140px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    background: var(--panel-strong);
    border: 1px solid var(--line-soft);
    border-radius: 6px;
  }

  .prof-module-scope .material-item {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    color: var(--text);
    font-size: 12px;
    line-height: 1.4;
  }
  .prof-module-scope .material-item input {
    margin: 0;
    accent-color: var(--cyan);
  }

  .prof-module-scope .hint {
    margin-top: 4px;
    font-size: 10px;
    color: var(--text-dim);
    line-height: 1.4;
  }

  .prof-module-scope .info-panel {
    background: rgba(0,0,0,0.3);
    border: 1px dashed var(--line-soft);
    border-radius: 6px;
    padding: 10px;
    font-size: 11px;
    color: var(--text-sub);
    line-height: 1.6;
  }

  .prof-module-scope .info-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    padding: 4px 0;
  }
  .prof-module-scope .info-row:last-child { border-bottom: none; }

  .prof-module-scope .info-key {
    color: var(--text-dim);
    flex: 0 0 108px;
  }
  .prof-module-scope .info-val {
    color: var(--text);
    text-align: right;
    flex: 1;
    word-break: break-word;
  }

  .prof-module-scope .val-highlight { color: var(--gold); font-family: var(--font-tech); }
  .prof-module-scope .val-cyan { color: var(--cyan); font-family: var(--font-tech); }
  .prof-module-scope .val-red { color: var(--red); }
  .prof-module-scope .val-green { color: var(--green); }

  .prof-module-scope .action-btn {
    width: 100%;
    margin-top: 2px;
    background: linear-gradient(90deg, rgba(141,225,239,0.1), rgba(141,225,239,0.3));
    border: 1px solid var(--cyan);
    color: var(--cyan);
    padding: 11px;
    border-radius: 6px;
    font-family: var(--font-tech);
    font-weight: 700;
    letter-spacing: 1.5px;
    cursor: pointer;
    text-transform: uppercase;
    transition: all 0.2s;
  }
  .prof-module-scope .action-btn:hover:not(:disabled) {
    background: var(--cyan);
    color: #000;
    box-shadow: 0 0 10px var(--cyan);
  }
  .prof-module-scope .action-btn:disabled {
    background: rgba(255,255,255,0.05);
    border-color: var(--line-soft);
    color: var(--text-dim);
    cursor: not-allowed;
    box-shadow: none;
  }

  @media (max-width: 480px) {
    .prof-module-scope .tabs { flex-wrap: wrap; }
    .prof-module-scope .tab-btn { flex: 1 0 50%; padding: 8px 0; font-size: 11px; }
    .prof-module-scope .top-status { flex-wrap: wrap; gap: 6px; }
    .prof-module-scope .status-chip { flex: 1 0 calc(50% - 6px); }
    .prof-module-scope .section-card { padding: 10px; }
    .prof-module-scope .section-title { font-size: 12px; }
  }
`;

const ProfessionTemplate = `
<div class="prof-module-scope">
  <div class="top-status">
    <div class="status-chip">
      <div class="chip-label">体力 / 魂力</div>
      <div class="chip-value" id="chip-vs">0 / 0</div>
    </div>
    <div class="status-chip">
      <div class="chip-label">精神力</div>
      <div class="chip-value" id="chip-men">0</div>
    </div>
    <div class="status-chip">
      <div class="chip-label">精神境界</div>
      <div class="chip-value" id="chip-men-realm">未知</div>
    </div>
  </div>

  <div class="tabs">
    <button class="tab-btn active" data-mode="forge">锻造</button>
    <button class="tab-btn" data-mode="manufacture">制造</button>
    <button class="tab-btn" data-mode="design">设计</button>
    <button class="tab-btn" data-mode="repair">修理</button>
  </div>

  <div class="section-card">
    <div class="section-title" id="prof-ui-title">副职业工坊</div>
    <div class="hint" id="prof-ui-subtitle" style="margin-top:-6px;margin-bottom:12px;">-</div>

    <div class="inline-grid">
      <div class="form-group">
        <label id="tier-label">操作阶位</label>
        <select id="prof-tier" class="tech-select">
          <option value="1">1阶</option>
          <option value="2">2阶</option>
          <option value="3">3阶</option>
          <option value="4">4阶</option>
          <option value="5">5阶</option>
        </select>
      </div>
      <div class="form-group">
        <label id="qty-label">每种材料消耗</label>
        <input id="prof-cost" class="tech-input" type="number" min="1" value="1" />
        <div class="hint" id="qty-hint">锻造默认会按“每种材料消耗量”扣除材料，并同步扣除职业资源。</div>
      </div>
    </div>

    <div class="form-group">
      <label id="target-label">目标产物 / 目标对象</label>
      <input id="prof-target" class="tech-input" type="text" placeholder="自动生成或手动输入..." />
      <div class="hint" id="target-hint">锻造会尝试根据所选材料自动生成产物名；修理模式下这里填待修对象名。</div>
    </div>

    <div class="inline-grid">
      <div class="form-group">
        <label>连续模式</label>
        <select id="prof-loop-enabled" class="tech-select">
          <option value="0">关闭</option>
          <option value="1">开启</option>
        </select>
      </div>
      <div class="form-group">
        <label>连续天数</label>
        <input id="prof-loop-days" class="tech-input" type="number" min="1" value="1" />
      </div>
    </div>

    <div class="form-group">
      <label id="materials-label">材料选择</label>
      <div id="prof-materials-list" class="metal-list-container">
        <div style="color: var(--text-dim);">[读取库存中...]</div>
      </div>
      <div class="hint" id="materials-hint">锻造支持多选融锻；其余职业按材料协同处理。</div>
    </div>
  </div>

  <div class="section-card">
    <div class="section-title">职业预演</div>
    <div class="info-panel">
      <div class="info-row"><span class="info-key">当前职业</span><span class="info-val" id="prev-job">-</span></div>
      <div class="info-row"><span class="info-key">累计经验</span><span class="info-val" id="prev-exp">-</span></div>
      <div class="info-row"><span class="info-key">当前资源</span><span class="info-val" id="prev-res">-</span></div>
      <div class="info-row"><span class="info-key">本次消耗</span><span class="info-val" id="prev-costs">-</span></div>
      <div class="info-row"><span class="info-key">执行来源</span><span class="info-val" id="prev-executor">-</span></div>
      <div class="info-row"><span class="info-key">代工费用</span><span class="info-val" id="prev-fee">-</span></div>
      <div class="info-row"><span class="info-key">本次成功率</span><span class="info-val" id="prev-rate">-%</span></div>
      <div class="info-row"><span class="info-key">模式 / 融合率</span><span class="info-val" id="prev-fusion">-</span></div>
      <div class="info-row"><span class="info-key">支持融锻数</span><span class="info-val" id="prev-maxfusion">-</span></div>
      <div class="info-row"><span class="info-key">品质极限</span><span class="info-val" id="prev-maxq">-</span></div>
      <div class="info-row"><span class="info-key">连续预估</span><span class="info-val" id="prev-loop">-</span></div>
      <div class="info-row"><span class="info-key">规则提示</span><span class="info-val" id="prev-note">-</span></div>
    </div>
  </div>

  <button class="action-btn" id="prof-submit">执行操作</button>
</div>
`;

const TIER_LABELS = ['', '1阶', '2阶', '3阶', '4阶', '5阶'];

const PROFESSION_CONFIG = {
  forge: {
    mode: 'forge', jobName: '锻造师', title: '锻造工序', displayName: '锻造', actionLabel: '开始锻造',
    requiresMaterials: true, supportsFusion: true,
    costs: { 1: [100, 100, 0], 2: [200, 1500, 20], 3: [500, 5000, 50], 4: [15000, 15000, 5000], 5: [80000, 80000, 18000] },
    expGain: { 1: 50, 2: 400, 3: 2000, 4: 10000, 5: 50000 },
    targetHint: '锻造支持自动命名；多选同阶材料会触发融锻。',
    materialHint: '多选材料 = 融锻。千锻融锻要求所有材料达到 1.15 以上（一品）。'
  },
  manufacture: {
    mode: 'manufacture', jobName: '制造师', title: '制造工序', displayName: '制造', actionLabel: '开始制造',
    requiresMaterials: true, supportsFusion: false,
    costs: { 1: [20, 35, 20], 2: [160, 280, 160], 3: [700, 1225, 600], 4: [3000, 5250, 2000], 5: [16000, 28000, 7200] },
    expGain: { 1: 50, 2: 400, 3: 2000, 4: 10000, 5: 50000 },
    targetHint: '填写你想制造的成品名称。',
    materialHint: '可选择金属、图纸、模块、回路等作为制造材料。'
  },
  design: {
    mode: 'design', jobName: '设计师', title: '设计工序', displayName: '设计', actionLabel: '开始设计',
    requiresMaterials: false, supportsFusion: false,
    costs: { 1: [5, 10, 25], 2: [20, 40, 200], 3: [80, 150, 750], 4: [300, 600, 2500], 5: [1000, 2000, 9000] },
    expGain: { 1: 50, 2: 400, 3: 2000, 4: 10000, 5: 50000 },
    targetHint: '这里填写设计图名称，例如：二字斗铠设计图。',
    materialHint: '设计职业允许无材料起草，但选入模板/旧图纸会被视作协同设计材料。'
  },
  repair: {
    mode: 'repair', jobName: '修理师', title: '修理工序', displayName: '修理', actionLabel: '开始修理',
    requiresMaterials: false, supportsFusion: false,
    costs: { 1: [5, 10, 5], 2: [40, 80, 40], 3: [175, 350, 150], 4: [750, 1500, 500], 5: [4000, 8000, 2700] },
    expGain: { 1: 50, 2: 400, 3: 2000, 4: 10000, 5: 50000 },
    targetHint: '这里填写待修对象名称，建议填写背包中的现有装备/零件。',
    materialHint: '可选维护套件、修复包、金属或零件作为修理耗材；不选也允许纯资源抢修。'
  }
};

const OFFICIAL_COMMISSION_FEES = { 1: 150000, 2: 1500000, 3: 15000000, 4: 100000000, 5: 500000000 };
const PRIVATE_COMMISSION_FEES = { 1: 100000, 2: 1000000, 3: 10000000, 4: 80000000, 5: 300000000 };
const 副职业每小时tick = 6;
const 副职业每日小时 = 24;
const 副职业连续模式默认天数 = 1;

const PROF_HIDDEN_ARBITRATION_NARRATION_RULES = `
[前端仲裁器说明]
以下内容属于隐藏仲裁结果，不要在正文中直接复述“成功率 / Roll / 仲裁结束 / JSONPatch / 系统分析”等字样。
请将仲裁结论转写成自然剧情，只描写人物操作、工艺过程、制造过程、设计过程或修理过程，以及成功或失败带来的自然结果。
玩家应当看到的是经过修饰后的剧情文本，而不是系统裁定日志。
`.trim();

class ProfessionUIComponent {
  constructor(container, snapshot, options = {}) {
    this.container = container;
    this.snapshot = snapshot;
    this.options = options;
    this.activeMode = 'forge';

    this.initDOM();
    this.bindEvents();
    this.syncData();
    this.applyInitialContext();
  }

  initDOM() {
    if (!document.getElementById('profession-ui-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'profession-ui-styles';
      styleEl.textContent = ProfessionStyles;
      document.head.appendChild(styleEl);
    }
    this.container.innerHTML = ProfessionTemplate;
  }

  $(selector) { return this.container.querySelector(selector); }
  $$(selector) { return this.container.querySelectorAll(selector); }

  显示提示(消息, 类型 = 'error') {
    const 文本 = String(消息 || '').trim();
    if (!文本) return;
    if (typeof this.options.内联动作失败 === 'function') {
      try { this.options.内联动作失败({ 原因: 文本, 类型 }); } catch (错误) {}
    }
    const 窗口列表 = [];
    try { 窗口列表.push(window); } catch (错误) {}
    try {
      if (window.parent && window.parent !== window) 窗口列表.push(window.parent);
    } catch (错误) {}
    for (const 目标窗口 of 窗口列表) {
      try {
        if (目标窗口.MVU_Toast && typeof 目标窗口.MVU_Toast.show === 'function') {
          目标窗口.MVU_Toast.show(文本, 类型);
          return;
        }
        const 提示器 = 目标窗口.toastr;
        if (提示器 && typeof 提示器[类型] === 'function') {
          提示器[类型](文本);
          return;
        }
      } catch (错误) {}
    }
    if (类型 === 'error') console.warn(文本);
    else console.info(文本);
  }

  bindEvents() {
    this.$$('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.setActiveMode(btn.dataset.mode));
    });
    this.$('#prof-tier').addEventListener('change', () => {
      this.autoGenerateTargetName();
      this.updatePreview();
    });
    this.$('#prof-cost').addEventListener('input', () => this.updatePreview());
    this.$('#prof-target').addEventListener('input', () => this.updatePreview());
    this.$('#prof-loop-enabled').addEventListener('change', () => this.updatePreview());
    this.$('#prof-loop-days').addEventListener('input', () => this.updatePreview());
    this.$('#prof-submit').addEventListener('click', () => this.executeProfessionAction());
  }

  getCurrentUiState() {
    const tierVal = this.$('#prof-tier')?.value || '1';
    let parsedTier = Number(tierVal);
    let subtype = '';
    if (tierVal.startsWith('mech-')) { parsedTier = Number(tierVal.split('-')[1]); subtype = 'mech'; }
    else if (tierVal.startsWith('armor-')) { parsedTier = Number(tierVal.split('-')[1]); subtype = 'armor'; }
    return {
      activeMode: this.activeMode,
      tier: parsedTier || 1,
      subtype: subtype,
      cost: this.$('#prof-cost')?.value || '1',
      target: this.$('#prof-target')?.value || '',
      selectedMaterials: this.getSelectedMaterialNames(),
      连续模式开启: this.$('#prof-loop-enabled')?.value === '1',
      连续天数: Math.max(1, Number(this.$('#prof-loop-days')?.value || 副职业连续模式默认天数)),
    };
  }

  syncCostInputState() {
    const costInput = this.$('#prof-cost');
    if (!costInput) return;
    const state = this.getCurrentUiState();
    if (state.subtype === 'mech' || state.subtype === 'armor') {
      costInput.disabled = true;
      costInput.value = '自动锁定';
    } else {
      costInput.disabled = false;
      if (costInput.value === '自动锁定') costInput.value = '1';
    }
  }

  restoreUiState(state = {}) {
    if (state.activeMode && PROFESSION_CONFIG[state.activeMode]) {
      this.activeMode = state.activeMode;
    }
    this.$$('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === this.activeMode);
    });
    this.updateModeChrome();

    if (this.$('#prof-tier')) {
      if (this.activeMode !== 'forge') {
        if (state.subtype && state.tier) {
          this.$('#prof-tier').value = `${state.subtype}-${state.tier}`;
        }
      } else {
        this.$('#prof-tier').value = state.tier || '1';
      }
    }
    if (this.$('#prof-cost')) this.$('#prof-cost').value = state.cost || '1';
    if (this.$('#prof-target')) this.$('#prof-target').value = state.target || '';
    if (this.$('#prof-loop-enabled')) this.$('#prof-loop-enabled').value = state.连续模式开启 ? '1' : '0';
    if (this.$('#prof-loop-days')) this.$('#prof-loop-days').value = String(Math.max(1, Number(state.连续天数 || 副职业连续模式默认天数)));

    this.toggleCommissionFields();
    this.populateMaterialList();

    const selected = new Set(state.selectedMaterials || []);
    this.$$('.material-cb').forEach(cb => {
      cb.checked = selected.has(cb.value);
    });

    this.updatePreview();
    this.syncCostInputState();
    this.autoGenerateTargetName();
  }

  updateData(newSnapshot) {
    const currentState = this.getCurrentUiState();
    this.snapshot = newSnapshot;
    this.updateHeaderStatus();
    this.restoreUiState(currentState);
  }

  getInitialRequest() {
    const direct = this.options?.professionRequest;
    if (direct && typeof direct === 'object') return direct;
    const fromDispatch = this.options?.dispatchContext?.professionRequest;
    return fromDispatch && typeof fromDispatch === 'object' ? fromDispatch : {};
  }

  normalizeInitialMode(rawMode) {
    const value = String(rawMode || '').trim().toLowerCase();
    if (/manufacture|制造|组装|总装|封装/.test(value)) return 'manufacture';
    if (/design|设计|图纸|蓝图/.test(value)) return 'design';
    if (/repair|修理|维修|维护|修复|整备/.test(value)) return 'repair';
    if (/forge|锻造|锻打|融锻|百锻|千锻|灵锻|魂锻|天锻/.test(value)) return 'forge';
    return '';
  }

  parseInitialMaterials(value) {
    if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
    if (value && typeof value === 'object') return Object.keys(value).filter(Boolean);
    return String(value || '')
      .split(/[、,，|/]+/)
      .map(item => item.trim())
      .filter(Boolean);
  }

  setInitialTier(req) {
    const tierSel = this.$('#prof-tier');
    if (!tierSel) return;
    const subtype = String(req.子类型 || req.目标类型 || '').trim().toLowerCase();
    const tier = Number(req.阶级 || req.等级 || 0);
    let value = '';
    if (this.activeMode !== 'forge') {
      if (/armor|斗铠/.test(subtype) && tier) value = `armor-${tier}`;
      else if (/mech|机甲/.test(subtype) && tier) value = `mech-${tier}`;
    } else if (tier) {
      value = String(tier);
    }
    if (value && Array.from(tierSel.options || []).some(opt => opt.value === value)) {
      tierSel.value = value;
    }
    this.syncCostInputState();
  }

  applyInitialContext() {
    const req = this.getInitialRequest();
    const mode = this.normalizeInitialMode(this.options.prefillMode || req.模式 || req.动作 || req.副职业 || req.职业);
    if (mode) this.setActiveMode(mode);

    this.setInitialTier(req);

    const qty = Math.max(1, Number(this.options.prefillQty || req.数量 || 0));
    const costInput = this.$('#prof-cost');
    if (qty > 0 && costInput && !costInput.disabled) costInput.value = String(qty);

    const target = String(this.options.prefillTarget || req.目标 || req.物品 || req.产物 || '').trim();
    if (target && this.$('#prof-target')) this.$('#prof-target').value = target;

    const materials = this.parseInitialMaterials(
      this.options.prefillMaterials || req.材料 || ''
    );
    if (materials.length) {
      const materialSet = new Set(materials);
      this.$$('.material-cb').forEach(cb => {
        cb.checked = materialSet.has(cb.value);
      });
    }
    if (!target && materials.length) this.autoGenerateTargetName();

    this.updatePreview();

    const autoExecute = this.options.autoExecute === true
      || req.自动执行 === true
      || /auto|ready|执行|确认|开始|直接/.test(String(req.状态 || ''));
    if (autoExecute) {
      window.setTimeout(() => this.runInitialAutoExecute(), 100);
    }
  }

  runInitialAutoExecute() {
    const submitBtn = this.$('#prof-submit');
    if (submitBtn && !submitBtn.disabled) this.executeProfessionAction();
  }

  get charData() { return this.snapshot?.activeChar || {}; }
  get rootData() { return this.snapshot?.sd || this.snapshot?.rootData || {}; }
  get allChars() { return this.rootData?.char || {}; }
  get itemDefinitions() {
    const table = this.rootData?.物品;
    return table && typeof table === 'object' ? table : {};
  }
  get activeName() {
    const chars = this.allChars || {};
    const snapshotActive = String(this.snapshot?.activeName || '').trim();
    if (snapshotActive && chars[snapshotActive]) return snapshotActive;

    const playerName = String(this.snapshot?.sd?.sys?.玩家名 || '').trim();
    if (playerName && chars[playerName]) return playerName;
    if (chars['主角']) return '主角';

    const firstName = Object.keys(chars)[0];
    return firstName || '主角';
  }
  get activeCharBasePath() { return `/char/${this.escapeJsonPointer(this.activeName)}`; }
  get currentInventory() { return this.charData.背包 || {}; }
  resolveInventoryItem(name = '') {
    return { ...(this.itemDefinitions?.[name] || {}), ...(this.currentInventory?.[name] || {}) };
  }

  syncData() {
    this.updateHeaderStatus();
    this.updateModeChrome();
    this.toggleCommissionFields();
    this.populateMaterialList();
    this.updatePreview();
  }

  updateHeaderStatus() {
    const stat = this.charData.属性 || {};
    this.$('#chip-vs').textContent = `${Number(stat.体力 || 0).toLocaleString()} / ${Number(stat.魂力 || 0).toLocaleString()}`;
    this.$('#chip-men').textContent = Number(stat.精神力 || 0).toLocaleString();
    this.$('#chip-men-realm').textContent = stat.精神境界 || '未知';
  }

  updateModeChrome() {
    const cfg = PROFESSION_CONFIG[this.activeMode];
    this.$('#prof-ui-title').textContent = cfg.title;
    this.$('#prof-ui-subtitle').textContent = `${cfg.displayName} / ${cfg.jobName}`;
    this.$('#materials-hint').textContent = cfg.materialHint;
    this.$('#target-hint').textContent = cfg.targetHint;
    this.$('#prof-submit').textContent = cfg.actionLabel;
    this.updateTierOptions();
    this.$('#qty-hint').textContent = this.activeMode === 'forge'
      ? '锻造会按“每种材料消耗量”扣除材料，并同步扣除职业资源。'
      : '副职业会按输入数量同步扩大基础资源消耗；材料按勾选项扣除。';
  }

  getForgeTierLabel(tier) {
    return ({ 1: '百锻', 2: '千锻', 3: '灵锻', 4: '魂锻', 5: '天锻' })[Number(tier) || 1] || `${Number(tier) || 0}阶`;
  }

  getGearTierFamilyLabel(tier) {
    return ({
      1: '黄级机甲',
      2: '紫级机甲 / 一字斗铠',
      3: '黑级机甲 / 二字斗铠',
      4: '红级机甲 / 三字斗铠',
      5: '四字斗铠'
    })[Number(tier) || 1] || `${Number(tier) || 0}阶装备`;
  }

  getTierDisplayName(mode, tier) {
    if (mode === 'forge') return this.getForgeTierLabel(tier);
    const suffix = ({ manufacture: '制造', design: '设计', repair: '修理' })[mode] || '处理';
    return `${this.getGearTierFamilyLabel(tier)}${suffix}`;
  }

  getTierQualityLabel(mode, tier) {
    return mode === 'forge' ? this.getForgeTierLabel(tier) : this.getGearTierFamilyLabel(tier);
  }

  updateTierOptions() {
    const tierSel = this.$('#prof-tier');
    if (!tierSel) return;
    const currentVal = tierSel.value;
    tierSel.innerHTML = '';
    if (this.activeMode !== 'forge') {
      const suffix = ({ manufacture: '制造', design: '设计', repair: '修理' })[this.activeMode] || '处理';
      tierSel.innerHTML = `
        <option value="mech-1">黄级机甲${suffix}</option>
        <option value="armor-2">一字斗铠${suffix}</option>
        <option value="mech-2">紫级机甲${suffix}</option>
        <option value="armor-3">二字斗铠${suffix}</option>
        <option value="mech-3">黑级机甲${suffix}</option>
        <option value="armor-4">三字斗铠${suffix}</option>
        <option value="mech-4">红级机甲${suffix}</option>
        <option value="armor-5">四字斗铠${suffix}</option>
      `;
    } else {
      for (let i = 1; i <= 5; i++) {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = this.getTierDisplayName(this.activeMode, i);
        tierSel.appendChild(opt);
      }
    }
    if (Array.from(tierSel.options).some(o => o.value === currentVal)) {
      tierSel.value = currentVal;
    } else {
      tierSel.selectedIndex = 0;
    }
    this.syncCostInputState();
  }

  setActiveMode(mode) {
    this.activeMode = mode;
    this.$$('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
    this.updateModeChrome();
    this.populateMaterialList();
    this.autoGenerateTargetName();
    this.updatePreview();
  }

  autoGenerateTargetName() {
    const state = this.getCurrentUiState();
    const mode = this.activeMode;
    const targetInput = this.$('#prof-target');
    if (!targetInput) return;

    if (mode === 'forge') {
      const mat = Array.from(this.el.querySelectorAll('.material-checkbox:checked')).map(cb => cb.value)[0] || '未知金属';
      targetInput.value = `${mat}(${this.getForgeTierLabel(state.tier)})`;
    } else {
      const opt = this.$('#prof-tier').selectedOptions?.[0];
      const text = opt ? opt.textContent.replace(/制造|设计|修理|处理/, '') : '';
      if (state.subtype === 'armor') targetInput.value = `${text}胸铠`;
      else if (state.subtype === 'mech') targetInput.value = text;
      else targetInput.value = `${this.getGearTierFamilyLabel(state.tier)}部件`;
    }
    this.syncCostInputState();
  }

  // --- 职业算法核心 (移植原代码) ---
  clamp(num, min, max) { return Math.max(min, Math.min(max, num)); }
  formatFedCoin(amount) { return `${Number(amount || 0).toLocaleString()} 联邦币`; }
  escapeJsonPointer(str) { return String(str).replace(/~/g, '~0').replace(/\//g, '~1'); }

  getLevelFromTotalExp(exp) {
    return this.读取副职业派生接口().读取等级(exp);
  }

  deriveLimitSuccessRate(lv, exp) {
    return this.读取副职业派生接口().读取基础成功率(lv, exp);
  }

  读取核心技艺文本(职业名, 等级) {
    return this.读取副职业派生接口().读取核心技艺文本(职业名, 等级);
  }

  读取副职业派生接口() {
    const 根列表 = [];
    try { 根列表.push(globalThis); } catch (错误) {}
    try { 根列表.push(window); } catch (错误) {}
    try { if (window.parent && window.parent !== window) 根列表.push(window.parent); } catch (错误) {}
    try { if (window.top && window.top !== window) 根列表.push(window.top); } catch (错误) {}
    const 接口 = 根列表
      .map(根 => {
        try { return 根.__LWCS_PROFESSION_DERIVATION__; } catch (错误) { return null; }
      })
      .find(候选接口 => 候选接口 && typeof 候选接口.派生运行时 === 'function');
    if (!接口) throw new Error('副职业派生接口未加载');
    return 接口;
  }

  读取支持融锻文本(等级) {
    return this.读取副职业派生接口().读取支持融锻文本(等级);
  }

  读取阶位支持融锻数(等级, 阶位) {
    return this.读取副职业派生接口().读取阶位融锻数(等级, 阶位);
  }

  getJobRuntime(jobName, charObj = this.charData) {
    const job = charObj?.职业?.[jobName] || {};
    const totalExp = Number(job.经验 || 0);
    const 派生接口 = this.读取副职业派生接口();
    let lv = 派生接口.读取等级(totalExp);
    const 经验阈值 = Array.isArray(派生接口.经验阈值) ? 派生接口.经验阈值 : [];
    const cExp = 经验阈值[Math.max(0, lv - 1)] || 0;
    const nExp = 经验阈值[Math.min(lv, 9)] || 经验阈值[9] || 0;
    const expRatio = 派生接口.读取等级进度(lv, totalExp);
    const limitSuccessRate = 派生接口.读取基础成功率(lv, totalExp);
    const 支持融锻文本 = this.读取支持融锻文本(lv);
    const maxFusion = 派生接口.读取最高支持融锻数(lv);

    return { jobName, job, lv, exp: totalExp, expRatio, limitSuccessRate, maxFusion, 支持融锻文本, 核心技艺文本: this.读取核心技艺文本(jobName, lv), currentBaseExp: cExp, nextLevelExp: nExp };
  }

  buildOfficialCommissionRuntime(jobName) {
    return { jobName, job: {}, lv: 9, exp: 99999999, expRatio: 1, limitSuccessRate: 85, maxFusion: 3, 支持融锻文本: '协会固定支持 3 级复合工序', 核心技艺文本: this.读取核心技艺文本(jobName, 9), currentBaseExp: 0, nextLevelExp: 0 };
  }

  deriveJobLimitsFromExp(exp) {
    const lv = this.getLevelFromTotalExp(exp);
    return { lv, 支持融锻数: this.读取支持融锻文本(lv), 基础成功率: this.deriveLimitSuccessRate(lv, exp) };
  }

  getItemTier(itemName) {
    if (/天锻|四字|十万年/.test(itemName)) return 5;
    if (/魂锻|三字|红级/.test(itemName)) return 4;
    if (/灵锻|二字|黑级/.test(itemName)) return 3;
    if (/千锻|一字|紫级/.test(itemName)) return 2;
    return 1;
  }

  getForgeUnlockLevel(tier) { return [1, 3, 5, 7, 9][tier - 1] || 99; }
  getForgeFusionUnlockLevel(tier) { return [0, 4, 6, 7, 9][tier - 1] || 99; }

  getSingleTierSuccessRate(tier, runtime) {
    const { lv, expRatio } = runtime;
    if (tier === 5) return lv >= 9 ? 20 : 0;
    const uLv = this.getForgeUnlockLevel(tier);
    if (lv < uLv) return 0;
    if (lv === uLv) return 30 + Math.floor(expRatio * 30);
    if (lv === uLv + 1) return 80 + Math.floor(expRatio * 20);
    return 100;
  }

  getForgeFusionSuccessRate(runtime, materialCount, hasExtraTech) {
    let rate = runtime.limitSuccessRate - Math.max(0, materialCount - 1) * 15;
    if (hasExtraTech) rate = Math.floor(rate * 1.1);
    return this.clamp(rate, 0, 100);
  }

  getGenericCompositeRate(runtime, materialCount) { return this.clamp(runtime.limitSuccessRate - Math.max(0, materialCount - 1) * 10, 0, 100); }
  getGenericSingleRate(runtime) { return this.clamp(runtime.limitSuccessRate, 0, 100); }

  hasBlueprintMaterial(materialNames) {
    return materialNames.some(name => /设计图|蓝图|模板/.test(name) || this.resolveInventoryItem(name)?.类型 === '图纸');
  }

  getArmorBlueprintNameByTier(tier) { return { 2: '一字斗铠设计图', 3: '二字斗铠设计图', 4: '三字斗铠设计图', 5: '四字斗铠设计图' }[tier] || `${this.getGearTierFamilyLabel(tier)}设计图`; }
  getArmorTierFromName(name) { return /一字/.test(name) ? 2 : (/二字/.test(name) ? 3 : (/三字/.test(name) ? 4 : (/四字/.test(name) ? 5 : 0))); }
  getTierMetalLabel(tier) { return { 1: '百锻金属', 2: '千锻金属', 3: '灵锻金属', 4: '魂锻金属', 5: '天锻金属' }[tier] || `${this.getForgeTierLabel(tier)}金属`; }

  getSelectedTierStock(materialNames) {
    const totals = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const name of materialNames) {
      totals[this.getItemTier(name)] += Number(this.currentInventory[name]?.数量 || 0);
    }
    return totals;
  }

  getManufactureRecipe(targetName, materialNames, tier, qty = 1) {
    const state = this.currentFormState;
    const isMech = state.subtype === 'mech' || /机甲/.test(targetName);
    const isArmor = state.subtype === 'armor' || /斗铠|一字|二字|三字|四字/.test(targetName) || materialNames.some(name => /斗铠设计图/.test(name));

    if (isMech) {
      if (tier === 1 || /黄级/.test(targetName)) return { mode: 'mech', fixedTierNeeds: { 2: 1, 1: 50 }, expectedTier: 1, note: '固定配方：1份千锻金属 + 50份百锻金属' };
      if (tier === 2 || /紫级/.test(targetName)) return { mode: 'mech', fixedTierNeeds: { 3: 1, 1: 40 }, expectedTier: 2, note: '固定配方：1份灵锻金属 + 40份百锻金属' };
      if (tier === 3 || /黑级/.test(targetName)) return { mode: 'mech', fixedTierNeeds: { 4: 1, 2: 30 }, expectedTier: 3, note: '固定配方：1份魂锻金属 + 30份千锻金属' };
      if (tier === 4 || /红级/.test(targetName)) return { mode: 'mech', fixedTierNeeds: { 5: 1, 4: 10, 3: 10 }, expectedTier: 4, note: '固定配方：1份天锻金属 + 10份魂锻 + 10份灵锻' };
    }
    
    if (isArmor) {
      const blueprint = this.getArmorBlueprintNameByTier(tier);
      const isChest = /胸/.test(targetName);
      const metalCount = isChest ? 3 : 2;
      return { mode: 'armor', blueprint, blueprintCost: 1, variableQty: metalCount, note: `斗铠制造：固定消耗【${blueprint}】1张 + ${metalCount}块同阶金属 (胸铠3块，其余2块)` };
    }
    return null;
  }

  buildTierNeedConsumePlan(materialNames, tierNeeds) {
    const plan = {};
    for (const tierKey of Object.keys(tierNeeds)) {
      const tier = Number(tierKey);
      let remaining = Number(tierNeeds[tierKey] || 0);
      for (const name of materialNames) {
        if (remaining <= 0) break;
        if (this.getItemTier(name) !== tier) continue;
        const available = Number(this.currentInventory[name]?.数量 || 0) - Number(plan[name] || 0);
        const take = Math.min(available, remaining);
        if (take > 0) { plan[name] = Number(plan[name] || 0) + take; remaining -= take; }
      }
      if (remaining > 0) return null;
    }
    return plan;
  }

  getManufactureOutputMeta(targetName, materialNames, tier) {
    const armorBlueprint = materialNames.find(name => /(一字|二字|三字|四字)斗铠设计图/.test(name));
    if (armorBlueprint) return { name: armorBlueprint.replace('设计图', ''), type: '斗铠部件' };
    if (/机甲/.test(targetName)) return { name: /黄级|紫级|黑级|红级/.test(targetName) ? targetName : ({ 1: '黄级机甲组件', 2: '紫级机甲组件', 3: '黑级机甲组件', 4: '红级机甲组件' }[tier] || targetName), type: '机甲部件' };
    if (/魂导/.test(targetName)) return { name: targetName, type: '魂导器' };
    return { name: targetName, type: '制造产物' };
  }

  getDesignOutputName(targetName, tier, materialNames = []) {
    if (/(一字|二字|三字|四字)斗铠设计图/.test(targetName)) return targetName;
    if (/斗铠|护铠/.test(targetName) || materialNames.some(name => /斗铠/.test(name))) return this.getArmorBlueprintNameByTier(tier);
    return /设计图|蓝图/.test(targetName) ? targetName : `${targetName}设计图`;
  }

  getRepairDescriptor(materialNames) {
    if (materialNames.some(name => /神级重塑核心/.test(name))) return { status: '神级重塑完成', desc: '借助神级重塑核心完成了整体重塑' };
    if (materialNames.some(name => /斗铠本源蕴养液/.test(name))) return { status: '本源修复', desc: '斗铠本源已得到充分蕴养与修复' };
    if (materialNames.some(name => /精密修复模块/.test(name))) return { status: '精密修复完成', desc: '关键结构已完成精密级修复与校准' };
    if (materialNames.some(name => /基础维护套件/.test(name))) return { status: '基础维护完成', desc: '已完成日常维护、除错与常规校准' };
    return { status: '已检修', desc: '已完成标准检修' };
  }

  getRepairRequirement(targetName) {
    const item = this.resolveInventoryItem(targetName);
    const durability = Number(item?.耐久 ?? item?.完整度 ?? 100);
    const statusText = `${targetName} ${item?.来源 || ''} ${item?.描述 || ''}`;
    if (/彻底损毁|完全损毁|报废|粉碎|崩毁|重塑/.test(statusText) || durability <= 0) return { label: '彻底损毁', required: '神级重塑核心', allows: [/神级重塑核心/] };
    if (/斗铠/.test(targetName) && (/本源|根基|核心受损|灵性流失/.test(statusText) || (durability > 0 && durability < 30))) return { label: '斗铠本源伤', required: '斗铠本源蕴养液', allows: [/斗铠本源蕴养液/, /神级重塑核心/] };
    if (/严重|中度|重伤|裂纹|断裂|破损|损坏|失衡/.test(statusText) || durability < 60) return { label: '中重度损伤', required: '精密修复模块', allows: [/精密修复模块/, /斗铠本源蕴养液/, /神级重塑核心/] };
    return { label: '轻度磨损', required: '基础维护套件', allows: [/基础维护套件/, /精密修复模块/, /斗铠本源蕴养液/, /神级重塑核心/] };
  }

  getRepairRequirementSatisfied(materialNames, requirement) {
    if (!requirement) return true;
    return requirement.allows.some(pattern => materialNames.some(name => pattern.test(name)));
  }

  getProfessionCost(jobName, tier, qty = 1) {
    const config = Object.values(PROFESSION_CONFIG).find(c => c.jobName === jobName);
    const base = (config?.costs?.[tier] || [0, 0, 0]).slice();
    const m = Math.max(1, Number(qty || 1));
    return { 体力: base[0] * m, 魂力: base[1] * m, 精神力: base[2] * m };
  }

  formatResourceCost(costs) { return `体:${Number(costs.体力 || 0).toLocaleString()} / 魂:${Number(costs.魂力 || 0).toLocaleString()} / 精:${Number(costs.精神力 || 0).toLocaleString()}`; }
  formatCurrentResources() { const s = this.charData.属性 || {}; return `体:${Number(s.体力 || 0).toLocaleString()} / 魂:${Number(s.魂力 || 0).toLocaleString()} / 精:${Number(s.精神力 || 0).toLocaleString()}`; }
  hasEnoughResources(costs, 当前资源 = null) {
    const s = 当前资源 || this.charData.属性 || {};
    return Number(s.体力 || 0) >= Number(costs.体力 || 0)
      && Number(s.魂力 || 0) >= Number(costs.魂力 || 0)
      && Number(s.精神力 || 0) >= Number(costs.精神力 || 0);
  }

  获取连续模式配置() {
    const 连续模式开启 = this.$('#prof-loop-enabled')?.value === '1';
    const 连续天数 = Math.max(1, Number(this.$('#prof-loop-days')?.value || 副职业连续模式默认天数));
    const 连续总小时 = Math.max(1, 连续天数 * 副职业每日小时);
    return { 连续模式开启, 连续天数, 连续总小时 };
  }

  构建单次材料消耗计划(cfg, tier, qty, targetName, materialNames = []) {
    const 安全数量 = Math.max(1, Number(qty || 1));
    if (!materialNames.length) return {};
    if (cfg.mode === 'manufacture') {
      const recipe = this.getManufactureRecipe(targetName, materialNames, tier, 安全数量);
      if (recipe?.mode === 'mech') {
        const 计划 = this.buildTierNeedConsumePlan(materialNames, recipe.fixedTierNeeds);
        return 计划 && typeof 计划 === 'object' ? 计划 : {};
      }
      if (recipe?.mode === 'armor') {
        const 计划 = {};
        materialNames.filter(name => name !== recipe.blueprint).forEach(name => {
          计划[name] = Number(计划[name] || 0) + 安全数量;
        });
        if (materialNames.includes(recipe.blueprint)) {
          计划[recipe.blueprint] = Number(计划[recipe.blueprint] || 0) + Number(recipe.blueprintCost || 1);
        }
        return 计划;
      }
    }
    return materialNames.reduce((计划, 名称) => {
      计划[名称] = Number(计划[名称] || 0) + 安全数量;
      return 计划;
    }, {});
  }

  构建材料库存快照(materialNames = []) {
    const 快照 = {};
    materialNames.forEach(名称 => {
      快照[名称] = Math.max(0, Number(this.currentInventory[名称]?.数量 || 0));
    });
    return 快照;
  }

  检查材料是否足够(材料库存快照 = {}, 单次材料消耗计划 = {}) {
    return Object.entries(单次材料消耗计划).every(([名称, 消耗]) =>
      Math.max(0, Number(材料库存快照[名称] || 0)) >= Math.max(0, Number(消耗 || 0))
    );
  }

  扣减材料库存(材料库存快照 = {}, 单次材料消耗计划 = {}) {
    Object.entries(单次材料消耗计划).forEach(([名称, 消耗]) => {
      材料库存快照[名称] = Math.max(0, Number(材料库存快照[名称] || 0) - Math.max(0, Number(消耗 || 0)));
    });
  }

  扣减资源(资源状态 = {}, 消耗 = {}) {
    资源状态.体力 = Math.max(0, Number(资源状态.体力 || 0) - Math.max(0, Number(消耗.体力 || 0)));
    资源状态.魂力 = Math.max(0, Number(资源状态.魂力 || 0) - Math.max(0, Number(消耗.魂力 || 0)));
    资源状态.精神力 = Math.max(0, Number(资源状态.精神力 || 0) - Math.max(0, Number(消耗.精神力 || 0)));
  }

  获取恢复状态快照() {
    const 属性 = this.charData?.属性 || {};
    const 核心数量 = Math.max(0, Number(this.charData?.魂核?.核心?.数量 || 0));
    return {
      体力: Math.max(0, Number(属性.体力 || 0)),
      魂力: Math.max(0, Number(属性.魂力 || 0)),
      精神力: Math.max(0, Number(属性.精神力 || 0)),
      体力上限: Math.max(0, Number(属性.体力上限 || 0)),
      魂力上限: Math.max(0, Number(属性.魂力上限 || 0)),
      精神力上限: Math.max(0, Number(属性.精神力上限 || 0)),
      魂核数量: 核心数量,
      无魂力天赋: /无魂力/.test(String(属性.天赋梯队 || '').trim()),
    };
  }

  计算恢复增量预估(资源状态 = {}, 恢复模式 = '冥想') {
    const 魂核数量 = Math.max(0, Number(资源状态.魂核数量 || 0));
    const 无魂力天赋 = !!资源状态.无魂力天赋;
    const 魂力系数 = 恢复模式 === '冥想'
      ? (魂核数量 === 0 ? 0.05 : (魂核数量 === 1 ? 0.2 : (魂核数量 === 2 ? 0.3 : 0.4)))
      : 0.01;
    const 体力系数 = 恢复模式 === '冥想' ? 0.005 : 0.01;
    const 精神系数 = 恢复模式 === '冥想' ? 0.008 : 0.01;
    const 魂力增量 = 无魂力天赋
      ? 0
      : Math.max(0, Math.min(Number(资源状态.魂力上限 || 0), Math.floor(Number(资源状态.魂力 || 0) + Number(资源状态.魂力上限 || 0) * 魂力系数 * 副职业每小时tick)) - Number(资源状态.魂力 || 0));
    const 体力增量 = Math.max(0, Math.min(Number(资源状态.体力上限 || 0), Math.floor(Number(资源状态.体力 || 0) + Number(资源状态.体力上限 || 0) * 体力系数 * 副职业每小时tick)) - Number(资源状态.体力 || 0));
    const 精神力增量 = Math.max(0, Math.min(Number(资源状态.精神力上限 || 0), Math.floor(Number(资源状态.精神力 || 0) + Number(资源状态.精神力上限 || 0) * 精神系数 * 副职业每小时tick)) - Number(资源状态.精神力 || 0));
    return { 体力增量, 魂力增量, 精神力增量 };
  }

  应用恢复增量(资源状态 = {}, 恢复增量 = {}) {
    资源状态.体力 = Math.min(Number(资源状态.体力上限 || 0), Number(资源状态.体力 || 0) + Math.max(0, Number(恢复增量.体力增量 || 0)));
    资源状态.魂力 = Math.min(Number(资源状态.魂力上限 || 0), Number(资源状态.魂力 || 0) + Math.max(0, Number(恢复增量.魂力增量 || 0)));
    资源状态.精神力 = Math.min(Number(资源状态.精神力上限 || 0), Number(资源状态.精神力 || 0) + Math.max(0, Number(恢复增量.精神力增量 || 0)));
  }

  选择最佳恢复模式(资源状态 = {}, 消耗 = {}) {
    const 缺口体力 = Math.max(0, Number(消耗.体力 || 0) - Number(资源状态.体力 || 0));
    const 缺口魂力 = Math.max(0, Number(消耗.魂力 || 0) - Number(资源状态.魂力 || 0));
    const 缺口精神力 = Math.max(0, Number(消耗.精神力 || 0) - Number(资源状态.精神力 || 0));
    const 缺口总量 = 缺口体力 + 缺口魂力 + 缺口精神力;
    if (缺口总量 <= 0) return '睡眠';
    const 冥想增量 = this.计算恢复增量预估(资源状态, '冥想');
    const 睡眠增量 = this.计算恢复增量预估(资源状态, '睡眠');
    const 计算覆盖分 = 增量 => {
      const 体力覆盖 = 缺口体力 > 0 ? Math.min(1, Number(增量.体力增量 || 0) / 缺口体力) : 0;
      const 魂力覆盖 = 缺口魂力 > 0 ? Math.min(1, Number(增量.魂力增量 || 0) / 缺口魂力) : 0;
      const 精神覆盖 = 缺口精神力 > 0 ? Math.min(1, Number(增量.精神力增量 || 0) / 缺口精神力) : 0;
      return 体力覆盖 * 缺口体力 + 魂力覆盖 * 缺口魂力 + 精神覆盖 * 缺口精神力;
    };
    const 冥想得分 = 计算覆盖分(冥想增量);
    const 睡眠得分 = 计算覆盖分(睡眠增量);
    if (冥想得分 === 睡眠得分) {
      const 冥想总恢复 = Number(冥想增量.体力增量 || 0) + Number(冥想增量.魂力增量 || 0) + Number(冥想增量.精神力增量 || 0);
      const 睡眠总恢复 = Number(睡眠增量.体力增量 || 0) + Number(睡眠增量.魂力增量 || 0) + Number(睡眠增量.精神力增量 || 0);
      return 冥想总恢复 >= 睡眠总恢复 ? '冥想' : '睡眠';
    }
    return 冥想得分 > 睡眠得分 ? '冥想' : '睡眠';
  }

  估算连续可执行次数(options = {}) {
    const 总小时 = Math.max(1, Number(options.总小时 || 1));
    const 是否委托 = !!options.是否委托;
    const 资源消耗 = options.资源消耗 || { 体力: 0, 魂力: 0, 精神力: 0 };
    const 单次材料消耗计划 = options.单次材料消耗计划 || {};
    const 材料库存快照 = Object.assign({}, options.材料库存快照 || {});
    const 资源状态 = Object.assign({}, options.资源状态 || this.获取恢复状态快照());
    const 资金单次消耗 = Math.max(0, Number(options.资金单次消耗 || 0));
    let 当前资金 = Math.max(0, Number(options.当前资金 || 0));
    let 可执行次数 = 0;
    let 冥想小时 = 0;
    let 睡眠小时 = 0;
    let 剩余小时 = 总小时;
    while (剩余小时 > 0) {
      const 资源充足 = 是否委托 ? true : this.hasEnoughResources(资源消耗, 资源状态);
      const 材料充足 = this.检查材料是否足够(材料库存快照, 单次材料消耗计划);
      const 资金充足 = 资金单次消耗 <= 0 || 当前资金 >= 资金单次消耗;
      if (资源充足 && 材料充足 && 资金充足) {
        可执行次数 += 1;
        if (!是否委托) this.扣减资源(资源状态, 资源消耗);
        this.扣减材料库存(材料库存快照, 单次材料消耗计划);
        if (资金单次消耗 > 0) 当前资金 = Math.max(0, 当前资金 - 资金单次消耗);
        剩余小时 -= 1;
        continue;
      }
      const 恢复模式 = this.选择最佳恢复模式(资源状态, 资源消耗);
      const 恢复增量 = this.计算恢复增量预估(资源状态, 恢复模式);
      if (!资源充足 || (恢复增量.体力增量 + 恢复增量.魂力增量 + 恢复增量.精神力增量) > 0) {
        this.应用恢复增量(资源状态, 恢复增量);
      }
      if (恢复模式 === '冥想') 冥想小时 += 1;
      else 睡眠小时 += 1;
      剩余小时 -= 1;
    }
    return { 可执行次数, 冥想小时, 睡眠小时, 结束资源: 资源状态 };
  }

  resolveDispatchNpcTarget() {
    const detail = this.options?.dispatchContext || {};
    const direct = String(detail.npcTarget || '').trim();
    if (direct) return direct;
    const npcTargets = Array.isArray(detail.npcTargets) ? detail.npcTargets.map(item => String(item || '').trim()).filter(Boolean) : [];
    return npcTargets.length === 1 ? npcTargets[0] : '';
  }

  getCommissionType() {
    const detail = this.options?.dispatchContext || {};
    const executorType = String(detail.executorType || detail.craftSource || '').trim();
    if (executorType === 'official') return 'official';
    return this.resolveDispatchNpcTarget() ? 'private' : 'self';
  }

  resolveCharacterByName(name) {
    const target = String(name || '').trim();
    const chars = this.allChars && typeof this.allChars === 'object' ? this.allChars : {};
    if (!target) return { key: '', displayName: '', char: null };
    if (chars[target]) {
      const charInfo = chars[target];
      const displayName = String(charInfo?.name || charInfo?.base?.name || target).trim() || target;
      return { key: target, displayName, char: charInfo };
    }
    for (const [charKey, charInfo] of Object.entries(chars)) {
      const displayName = String(charInfo?.name || charInfo?.base?.name || charKey).trim() || charKey;
      if (displayName === target) {
        return { key: charKey, displayName, char: charInfo };
      }
    }
    return { key: '', displayName: target, char: null };
  }

  getTargetNpcName() { return this.resolveDispatchNpcTarget(); }
  getRelationScore(name) {
    const resolved = this.resolveCharacterByName(name);
    const relationName = resolved.displayName || String(name || '').trim();
    return Number(this.charData?.社交?.关系?.[name]?.好感度 || this.charData?.社交?.关系?.[relationName]?.好感度 || 0);
  }

  getFusionContext(runtime, materialNames) {
    if (materialNames.length === 1) {
      const item = this.resolveInventoryItem(materialNames[0]);
      const fMeta = item?.副职业参数?.融合参数 || item?.融合参数 || {};
      return { fusionCount: Math.max(1, Number(fMeta.数量 || 1)), fusionSync: Number(fMeta.融合率 ?? fMeta.契合度 ?? 100) };
    }
    if (materialNames.length > 1) return { fusionCount: materialNames.length, fusionSync: this.activeMode === 'forge' ? this.getForgeFusionRate(runtime, materialNames) : 0 };
    return { fusionCount: 1, fusionSync: 0 };
  }

  getModeSuccessRateForRuntime(mode, runtime, tier, materialNames, fusionCount) {
    const ef = Math.max(1, Number(fusionCount || materialNames?.length || 1));
    if (mode === 'forge') return ef > 1 ? this.getForgeFusionSuccessRate(runtime, ef, false) : this.getSingleTierSuccessRate(tier, runtime);
    return ef > 1 ? this.getGenericCompositeRate(runtime, ef) : this.getGenericSingleRate(runtime);
  }

  buildCommissionFeePatches(fee) {
    const amount = Math.max(0, Number(fee || 0));
    return amount <= 0 ? [] : [{ op: 'replace', path: `${this.activeCharBasePath}/财富/联邦币`, value: Math.max(0, Number(this.charData.财富?.联邦币 || 0) - amount) }];
  }

  toggleCommissionFields() {
    const type = this.getCommissionType();
    const targetNpcName = this.getTargetNpcName();
    const sourcePanel = this.$('#commission-source-panel');
    if (sourcePanel) sourcePanel.textContent = type === 'official' ? '地图工坊委托 / 协会代工' : (type === 'private' ? `地图工坊委托 / ${targetNpcName || '未指定对象'} 代工` : `当前角色自行操作 / ${this.activeName}`);
    const hint = this.$('#commission-hint');
    if (hint) {
      hint.textContent = type === 'official' ? '此面板作为协会工坊接口打开，委托流程受标准规章保护。'
        : (type === 'private' ? `此面板由 ${targetNpcName || '未指定对象'} 的接单行动触发。`
        : '使用角色本身能力进行工艺操作。');
    }
  }

  getOfficialCommissionLocation(jobName) {
    const name = String(jobName || '').trim();
    if (name === '锻造师') return '锻造师协会';
    if (name === '设计师') return '设计师协会';
    if (name === '修理师') return '修理师协会';
    return '制造师协会';
  }

  normalizeLocForMatch(location) {
    const raw = String(location || '').replace(/^斗罗大陆-/, '').replace(/^斗灵大陆-/, '').trim();
    const segments = raw.split('-').filter(Boolean);
    return {
      raw,
      leaf: segments[segments.length - 1] || raw,
      segments
    };
  }

  isLocationCompatible(currentLoc, targetLoc) {
    const current = this.normalizeLocForMatch(currentLoc);
    const target = this.normalizeLocForMatch(targetLoc);
    if (!current.raw || !target.raw) return current.raw === target.raw;
    if (current.raw === target.raw || current.leaf === target.leaf) return true;
    return current.segments.some(seg => target.segments.includes(seg));
  }

  getCommissionContext(cfg, runtime, tier, materialNames, targetName) {
    const type = this.getCommissionType();
    const targetNpcName = this.getTargetNpcName();
    const currentLoc = String(this.charData?.状态?.位置 || '');
    const wealth = Number(this.charData?.财富?.联邦币 || 0);
    const fusion = this.getFusionContext(runtime, materialNames);
    const ctx = {
      type, isCommission: type !== 'self', isOfficial: type === 'official', isPrivate: type === 'private',
      targetNpcName, targetName, fusionCount: fusion.fusionCount, fusionSync: fusion.fusionSync,
      relScore: 0, commissionFee: 0, successRate: null, executorName: this.activeName, executorRuntime: runtime, validationRuntime: runtime,
      note: `由${this.activeName}亲自执行，按当前角色职业熟练度仲裁。`, error: null, targetChar: null, hasEnoughFunds: true
    };

    if (type === 'self' && !this.charData?.职业?.[cfg.jobName]) { ctx.error = `${this.activeName}未掌握【${cfg.jobName}】副职业，无法发起该类操作。`; return ctx; }

    if (ctx.isOfficial) {
      ctx.executorName = `${cfg.jobName}协会`; ctx.executorRuntime = this.buildOfficialCommissionRuntime(cfg.jobName); ctx.validationRuntime = ctx.executorRuntime;
      ctx.successRate = 85; ctx.commissionFee = Number(OFFICIAL_COMMISSION_FEES[tier] || 0);
      const officialLocationName = this.getOfficialCommissionLocation(cfg.jobName);
      ctx.note = `官方代工固定成功率 85%，支持 3 级复合工序。当前代工费 ${this.formatFedCoin(ctx.commissionFee)}。`;
      if (!currentLoc.includes(officialLocationName)) ctx.error = `必须前往【${officialLocationName}】大厅才能办理官方代工委托。`;
      else if (ctx.fusionCount > 3) ctx.error = `官方流水线拒收 ${ctx.fusionCount} 级复合工序，当前超出协会工艺上限。`;
    } else if (ctx.isPrivate) {
      if (!targetNpcName) ctx.error = '请选择或填写私人代工目标 NPC。';
      else {
        const resolvedTarget = this.resolveCharacterByName(targetNpcName);
        const targetChar = resolvedTarget.char;
        const relationName = resolvedTarget.displayName || targetNpcName;
        ctx.targetChar = targetChar || null;
        if (!targetChar) ctx.error = `找不到代工目标【${targetNpcName}】。`;
        else if (!this.isLocationCompatible(currentLoc, String(targetChar?.状态?.位置 || ''))) ctx.error = `【${targetNpcName}】当前不在你身边，无法进行当面代工交接。`;
        else if (!targetChar?.职业?.[cfg.jobName]) ctx.error = `【${targetNpcName}】并未掌握【${cfg.jobName}】副职业。`;
        else {
          const npcRuntime = this.getJobRuntime(cfg.jobName, targetChar);
          ctx.executorName = relationName; ctx.executorRuntime = npcRuntime; ctx.validationRuntime = npcRuntime;
          ctx.relScore = this.getRelationScore(relationName);
          if (ctx.fusionCount > (cfg.mode === 'forge' ? this.读取阶位支持融锻数(npcRuntime.lv, tier) : npcRuntime.maxFusion)) ctx.error = `目标 NPC【${targetNpcName}】的${cfg.jobName}等级不足，无法承接 ${ctx.fusionCount} 级复合工序。`;
          else {
            const baseFee = Number(PRIVATE_COMMISSION_FEES[tier] || 100000);
            ctx.commissionFee = baseFee * Math.max(1, ctx.fusionCount);
            if (ctx.relScore >= 80) ctx.commissionFee = 0;
            else if (ctx.relScore >= 50) ctx.commissionFee = Math.floor(ctx.commissionFee * 0.5);
            const baseRate = this.getModeSuccessRateForRuntime(cfg.mode, npcRuntime, tier, materialNames, ctx.fusionCount);
            ctx.successRate = this.clamp(baseRate + Math.floor(ctx.relScore / 10), 0, 100);
            ctx.note = `私人代工由【${targetNpcName}】执行，好感度 ${ctx.relScore}，代工费 ${this.formatFedCoin(ctx.commissionFee)}，成功率已按目标 NPC 能力与关系修正重算。`;
          }
        }
      }
    }
    ctx.hasEnoughFunds = wealth >= ctx.commissionFee;
    if (ctx.isCommission && !ctx.error && !ctx.hasEnoughFunds) ctx.error = `资金不足，当前委托需要 ${this.formatFedCoin(ctx.commissionFee)}。`;
    return ctx;
  }

  getMaterialFilter(mode) {
    if (mode === 'forge') return (name, item) => /金属|铁|银|金|铜|矿|锻|合金|玉银/.test(name) || item?.类型 === '材料' || /百锻|千锻|灵锻|魂锻|天锻/.test(item?.品质);
    if (mode === 'manufacture') return (name, item) => /金属|锻|合金|玉银|设计图|蓝图|核心|回路|模块|零件|骨架|外壳|装甲|引擎|炮/.test(name) || ['材料', '图纸'].includes(item?.类型);
    if (mode === 'design') return (name, item) => /图纸|蓝图|模板|回路|模块|核心|设计/.test(name) || ['图纸', '材料'].includes(item?.类型);
    if (mode === 'repair') return (name, item) => /维护|修复|套件|金属|锻|零件|回路|模块|外壳|装甲|引擎|炮/.test(name) || ['消耗品', '材料'].includes(item?.类型);
    return () => false;
  }

  getSelectedMaterialNames() { return Array.from(this.container.querySelectorAll('.material-cb:checked')).map(node => node.value); }

  setPreviewField(id, value, cls = '') {
    const el = this.$('#' + id);
    if (!el) return;
    el.className = `info-val ${cls}`.trim();
    el.innerHTML = value;
  }

  populateMaterialList() {
    const cfg = PROFESSION_CONFIG[this.activeMode];
    const container = this.$('#prof-materials-list');
    container.innerHTML = '';
    const filter = this.getMaterialFilter(this.activeMode);
    let count = 0;
    Object.keys(this.currentInventory).forEach(itemName => {
      const item = this.resolveInventoryItem(itemName);
      if ((item?.数量 || 0) > 0 && filter(itemName, item)) {
        const label = document.createElement('label');
        label.className = 'material-item';
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.className = 'material-cb'; cb.value = itemName;
        cb.addEventListener('change', () => { this.autoGenerateTargetName(); this.updatePreview(); });
        const detail = [`剩${item.数量}`];
        const qualityFactor = item?.副职业参数?.品质系数 ?? item?.品质系数;
        if (qualityFactor) detail.push(`Q${Number(qualityFactor).toFixed(2)}`);
        const fusionRate = item?.副职业参数?.融合参数?.融合率 ?? item?.副职业参数?.融合参数?.契合度 ?? item?.融合参数?.融合率 ?? item?.融合参数?.契合度;
        if (fusionRate !== undefined) detail.push(`融合率${fusionRate}%`);
        label.appendChild(cb); label.appendChild(document.createTextNode(`${itemName} (${detail.join(' / ')})`));
        container.appendChild(label);
        count++;
      }
    });
    if (count === 0) container.innerHTML = `<div style="color: var(--text-dim);">${cfg.requiresMaterials ? '[当前背包无可用材料]' : '[当前模式材料可选为空]'}</div>`;
  }

  autoGenerateTargetName() {
    const cfg = PROFESSION_CONFIG[this.activeMode];
    const materials = this.getSelectedMaterialNames();
    const tier = Number(this.$('#prof-tier').value || 1);
    const tierLabel = this.activeMode === 'forge' ? this.getForgeTierLabel(tier) : this.getTierDisplayName(this.activeMode, tier);
    if (materials.length === 0) return;

    const rawNames = materials.map(name => name.replace(/百锻|千锻|灵锻|魂锻|天锻|极品·/g, '').trim());
    let baseName = '';

    if (this.activeMode === 'forge') {
      if (rawNames.length === 1) baseName = rawNames[0];
      else if (rawNames.length === 2 && rawNames.some(m => m.includes('沉银')) && rawNames.some(m => m.includes('魔银'))) baseName = '玉银';
      else if (rawNames.length === 2) baseName = `${rawNames.join('')}合金`;
      else baseName = `${rawNames.length}系融锻合金`;
      this.$('#prof-target').value = `${tierLabel}${baseName}`;
      return;
    }
    if (this.activeMode === 'manufacture') {
      this.$('#prof-target').value = this.getManufactureOutputMeta(this.$('#prof-target').value.trim() || rawNames[0] || '标准制件', materials, tier).name;
      return;
    }
    if (this.activeMode === 'design') {
      this.$('#prof-target').value = this.getDesignOutputName(this.$('#prof-target').value.trim() || rawNames[0] || `${tierLabel}`, tier, materials);
      return;
    }
    if (this.activeMode === 'repair' && !this.$('#prof-target').value.trim()) {
      this.$('#prof-target').value = materials[0];
    }
  }

  getForgeFusionRate(runtime, materialNames) {
    if (materialNames.length <= 1) {
      const single = this.resolveInventoryItem(materialNames[0]);
      return Number(single?.副职业参数?.融合参数?.融合率 ?? single?.副职业参数?.融合参数?.契合度 ?? single?.融合参数?.融合率 ?? single?.融合参数?.契合度 ?? 100);
    }
    const rand = Math.floor(Math.random() * 13);
    const base = 20 + Math.floor(runtime.limitSuccessRate * 0.8) + Math.floor(runtime.expRatio * 10);
    const penalty = Math.max(0, materialNames.length - 2) * 6;
    return this.clamp(base + rand - penalty, 20, 100);
  }

  getForgeMaxQ(tier, materialCount) {
    let maxQ = 1.2;
    if (materialCount >= tier) maxQ = 1.5;
    if (materialCount > tier) maxQ = 1.8;
    if (tier === 5 && materialCount >= 7) maxQ = 2.0;
    return maxQ;
  }

  validateForgeRules(runtime, tier, materialNames, targetName, options = {}) {
    if (!targetName.trim()) return '请先填写目标产物名称。';
    if (materialNames.length === 0) return '锻造至少需要选择一种材料。';
    if (tier === 5 && !options.isCommission && !['灵域境', '神元境'].includes(this.charData.属性?.精神境界 || '')) return '天锻需要精神力达到【灵域境】。';
    if (materialNames.length === 1) {
      if (runtime.lv < this.getForgeUnlockLevel(tier)) return `${this.getForgeTierLabel(tier)}单金属锻造尚未解锁，需要 Lv.${this.getForgeUnlockLevel(tier)} 锻造师。`;
      const mTier = this.getItemTier(materialNames[0]);
      const mItem = this.resolveInventoryItem(materialNames[0]);
      if (Boolean((mItem?.副职业参数?.融合参数?.数量 || mItem?.融合参数?.数量 || 0) > 1 || /合金|玉银/.test(materialNames[0])) && tier > mTier && !(mTier === 4 && tier === 5)) return '融锻合金定型后无法常规升阶；仅允许【魂锻合金 → 天锻】特例。';
      return null;
    }
    const fusionUnlockLv = this.getForgeFusionUnlockLevel(tier);
    if (runtime.lv < fusionUnlockLv) return `${this.getForgeTierLabel(tier)}融锻尚未解锁，需要 Lv.${fusionUnlockLv} 锻造师。`;
    const 当前阶位支持数 = this.读取阶位支持融锻数(runtime.lv, tier);
    if (materialNames.length > 当前阶位支持数) return `当前锻造师${this.getForgeTierLabel(tier)}支持融锻数为 ${当前阶位支持数}。`;
    for (const mName of materialNames) {
      if (this.getItemTier(mName) !== tier) return `融锻要求材料阶位与目标完全一致：当前目标 ${this.getForgeTierLabel(tier)}，材料【${mName}】是 ${this.getForgeTierLabel(this.getItemTier(mName))}。`;
      const materialItem = this.resolveInventoryItem(mName);
      if (tier === 2 && Number(materialItem?.副职业参数?.品质系数 ?? materialItem?.品质系数 ?? 1) < 1.15) return `千锻融锻要求所有材料达到“一品”(品质系数≥1.15)。`;
    }
    return null;
  }

  validateGenericRules(cfg, runtime, tier, materialNames, targetName) {
    if (!targetName.trim()) return '请先填写目标产物/对象名称。';
    const uLv = this.getForgeUnlockLevel(tier);
    if (runtime.lv < uLv) return `${this.getTierDisplayName(cfg.mode, tier)}尚未解锁，需要 Lv.${uLv} ${cfg.jobName}。`;
    if (cfg.requiresMaterials && materialNames.length === 0) return `${cfg.displayName}至少需要选择一种材料。`;
    if (materialNames.length > runtime.maxFusion) return `当前${cfg.jobName}支持协同数为 ${runtime.maxFusion}。`;
    if (cfg.mode === 'manufacture') {
      if (/斗铠|机甲/.test(targetName) && !this.hasBlueprintMaterial(materialNames)) return '制造斗铠/机甲至少需要对应设计图或蓝图。';
      const armorTier = this.getArmorTierFromName(targetName);
      if (armorTier && armorTier !== tier) return `目标【${targetName}】属 ${this.getTierDisplayName(cfg.mode, armorTier)}，阶位不匹配。`;
      const recipe = this.getManufactureRecipe(targetName, materialNames, tier, 1);
      if (/斗铠/.test(targetName) && !materialNames.includes(this.getArmorBlueprintNameByTier(tier))) return `需要对应的【${this.getArmorBlueprintNameByTier(tier)}】。`;
      if (recipe?.mode === 'armor') {
        const armorMaterials = materialNames.filter(name => name !== recipe.blueprint);
        if (armorMaterials.length === 0) return `制造【${targetName}】至少需要勾选对应位阶的金属材料。`;
        const wrongArmorMaterial = armorMaterials.find(name => this.getItemTier(name) !== tier);
        if (wrongArmorMaterial) return `当前斗铠制造要求使用${this.getTierMetalLabel(tier)}，材料【${wrongArmorMaterial}】阶位不匹配。`;
      }
      if (recipe?.mode === 'mech') {
        if (tier !== recipe.expectedTier) return `固定阶位应为 ${this.getTierDisplayName(cfg.mode, recipe.expectedTier)}。`;
        const stocks = this.getSelectedTierStock(materialNames);
        for (const tierKey in recipe.fixedTierNeeds) {
          if (Number(stocks[tierKey] || 0) < Number(recipe.fixedTierNeeds[tierKey])) return `制造材料不足：缺少${this.getTierMetalLabel(Number(tierKey))}。`;
        }
      }
    }
    if (cfg.mode === 'design') {
      if (!/设计图|蓝图/.test(targetName)) return '目标名称应包含“设计图”或“蓝图”。';
      if (/斗铠/.test(targetName) && tier < 2) return '斗铠设计图至少 2 阶。';
      const armorTier = this.getArmorTierFromName(targetName);
      if (armorTier && armorTier !== tier) return `目标阶位不匹配。`;
    }
    if (cfg.mode === 'repair') {
      if (targetName.trim() && !this.currentInventory[targetName.trim()]) return '修现存物品必须在背包中。';
      const req = this.getRepairRequirement(targetName.trim());
      if (materialNames.length === 0) return `至少需要【${req.required}】。`;
      if (!this.getRepairRequirementSatisfied(materialNames, req)) return `当前损伤为【${req.label}】，至少需要【${req.required}】。`;
    }
    return null;
  }

  updatePreview() {
    const cfg = PROFESSION_CONFIG[this.activeMode];
    const runtime = this.getJobRuntime(cfg.jobName);
    const tier = Number(this.$('#prof-tier').value || 1);
    const qty = Math.max(1, Number(this.$('#prof-cost').value || 1));
    const targetName = String(this.$('#prof-target').value || '').trim();
    const materialNames = this.getSelectedMaterialNames();
    const costs = this.getProfessionCost(cfg.jobName, tier, qty);
    const commissionCtx = this.getCommissionContext(cfg, runtime, tier, materialNames, targetName);
    const effectiveRuntime = commissionCtx.validationRuntime || runtime;
    const 连续配置 = this.获取连续模式配置();
    const enoughResources = commissionCtx.isCommission ? commissionCtx.hasEnoughFunds : this.hasEnoughResources(costs);

    let ruleError = commissionCtx.error || null;
    let rateText = '-', fusionText = '-', maxQText = '-', noteText = '-';
    let 当前成功率数值 = 0;
    let costText = commissionCtx.isCommission ? `<span class="val-cyan">委托模式不扣职业资源</span>` : this.formatResourceCost(costs);
    let feeText = commissionCtx.isCommission ? (commissionCtx.commissionFee > 0 ? `<span class="val-highlight">${this.formatFedCoin(commissionCtx.commissionFee)}</span>` : `<span class="val-green">免单</span>`) : `<span class="val-cyan">无</span>`;

    if (this.activeMode === 'forge') {
      if (!ruleError) ruleError = this.validateForgeRules(effectiveRuntime, tier, materialNames, targetName, { isCommission: commissionCtx.isCommission });
      if (!ruleError) {
        const efc = Math.max(commissionCtx.fusionCount || 1, materialNames.length || 1);
        const isFusion = efc > 1;
        const rate = commissionCtx.isCommission ? Number(commissionCtx.successRate || 0) : (isFusion ? this.getForgeFusionSuccessRate(runtime, efc, !!this.charData.功法?.['暗器百解']) : this.getSingleTierSuccessRate(tier, runtime));
        当前成功率数值 = Number(rate || 0);
        const firstMaterial = this.resolveInventoryItem(materialNames[0]);
        const dfr = isFusion ? Number(commissionCtx.fusionSync || (materialNames.length > 1 ? this.getForgeFusionRate(effectiveRuntime, materialNames) : 100)) : Number(firstMaterial?.副职业参数?.融合参数?.融合率 ?? firstMaterial?.副职业参数?.融合参数?.契合度 ?? firstMaterial?.融合参数?.融合率 ?? firstMaterial?.融合参数?.契合度 ?? 100);
        rateText = `<span class="val-highlight">${rate}%</span>`;
        fusionText = isFusion ? `<span class="val-cyan">${efc}级复合 / 融合率${dfr}%</span>` : `<span class="val-cyan">单金属 / 融合率${dfr}%</span>`;
        maxQText = `<span class="val-highlight">${this.getForgeMaxQ(tier, efc).toFixed(1)}</span>`;
        noteText = commissionCtx.isCommission ? commissionCtx.note : (isFusion ? `融锻走公式成功率；当前${this.getForgeTierLabel(tier)}支持融锻数 ${this.读取阶位支持融锻数(effectiveRuntime.lv, tier)}。` : `单金属成功率按等级表 + 经验区间计算。`);
      }
    } else {
      if (!ruleError) ruleError = this.validateGenericRules(cfg, effectiveRuntime, tier, materialNames, targetName);
      if (!ruleError) {
        const efc = Math.max(materialNames.length || 0, commissionCtx.fusionCount || 1);
        const isComp = efc > 1;
        const rate = commissionCtx.isCommission ? Number(commissionCtx.successRate || 0) : (isComp ? this.getGenericCompositeRate(runtime, efc) : this.getGenericSingleRate(runtime));
        当前成功率数值 = Number(rate || 0);
        rateText = `<span class="val-highlight">${rate}%</span>`;
        fusionText = isComp ? `<span class="val-cyan">复合工序 ${efc} 材</span>` : `<span class="val-cyan">单工序</span>`;
        maxQText = `<span class="val-highlight">${(isComp ? 1.25 : 1.15).toFixed(2)}</span>`;
        noteText = commissionCtx.isCommission ? commissionCtx.note : (isComp ? `${cfg.displayName}的多材料协同成功率按职业公式推导。` : `${cfg.displayName}单工序成功率直接读取当前职业熟练度。`);
        if (cfg.mode === 'manufacture') {
          const recipe = this.getManufactureRecipe(targetName, materialNames, tier, qty);
          if (recipe?.mode === 'mech' || recipe?.mode === 'armor') noteText = recipe.note;
        }
        if (cfg.mode === 'repair') {
          const req = this.getRepairRequirement(targetName);
          noteText = isComp ? `目标判定：${req.label} / 已选${materialNames.length}种修理耗材 / 要求：${req.required}` : `目标判定：${req.label} / 要求：${req.required}`;
        }
      }
    }

    if (!commissionCtx.isCommission && !连续配置.连续模式开启 && !enoughResources) ruleError = ruleError || '职业资源不足。';

    let 连续预估文本 = '<span class="val-cyan">关闭</span>';
    if (!ruleError) {
      const 单次材料消耗计划 = this.构建单次材料消耗计划(cfg, tier, qty, targetName, materialNames);
      const 连续估算结果 = this.估算连续可执行次数({
        总小时: 连续配置.连续总小时,
        是否委托: commissionCtx.isCommission,
        资源消耗: costs,
        单次材料消耗计划,
        材料库存快照: this.构建材料库存快照(materialNames),
        资源状态: this.获取恢复状态快照(),
        资金单次消耗: commissionCtx.isCommission ? Number(commissionCtx.commissionFee || 0) : 0,
        当前资金: Number(this.charData?.财富?.联邦币 || 0),
      });
      const 期望成功数 = Number((Number(连续估算结果.可执行次数 || 0) * Math.max(0, 当前成功率数值) / 100).toFixed(2));
      连续预估文本 = `${连续配置.连续模式开启 ? '<span class="val-green">开启</span>' : '<span class="val-cyan">未开启</span>'} / <span class="val-highlight">${连续配置.连续天数}天</span> / 可执行 <span class="val-cyan">${连续估算结果.可执行次数}</span> 次 / 期望成功 <span class="val-highlight">${期望成功数}</span> 次${!commissionCtx.isCommission ? ` / 冥想${连续估算结果.冥想小时}h 睡眠${连续估算结果.睡眠小时}h` : ''}`;
    }

    this.$('#prof-submit').disabled = Boolean(ruleError);
    this.setPreviewField('prev-job', `<span class="val-cyan">${cfg.jobName} Lv.${effectiveRuntime.lv}</span>${commissionCtx.isCommission ? ` / 执行者 ${commissionCtx.executorName}` : ''}`);
    this.setPreviewField('prev-exp', commissionCtx.isCommission ? `<span class="val-highlight">${Number(effectiveRuntime.exp || 0).toLocaleString()}</span> / 执行者熟练度` : `<span class="val-highlight">${runtime.exp.toLocaleString()}</span> / 本级进度 <span class="val-cyan">${Math.floor(runtime.expRatio * 100)}%</span>`);
    this.setPreviewField('prev-res', this.formatCurrentResources());
    this.setPreviewField('prev-costs', enoughResources ? costText : `<span class="val-red">${costText}</span>`);
    this.setPreviewField('prev-executor', `<span class="val-cyan">${commissionCtx.executorName}</span>${commissionCtx.isPrivate ? ` / 好感 ${commissionCtx.relScore}` : (commissionCtx.isOfficial ? ' / 官方代工' : ' / 自行操作')}`);
    this.setPreviewField('prev-fee', feeText);
    this.setPreviewField('prev-rate', ruleError ? `<span class="val-red">-</span>` : rateText);
    this.setPreviewField('prev-fusion', ruleError ? `<span class="val-red">-</span>` : fusionText);
    this.setPreviewField('prev-maxfusion', `<span class="val-highlight">${effectiveRuntime.支持融锻文本}</span>`);
    this.setPreviewField('prev-maxq', ruleError ? `<span class="val-red">-</span>` : maxQText);
    this.setPreviewField('prev-loop', ruleError ? `<span class="val-red">-</span>` : 连续预估文本);
    this.setPreviewField('prev-note', ruleError ? `<span class="val-red">${ruleError}</span>` : noteText);
  }

  // --- 提交操作相关补丁生成 --- 
  buildResourcePatches(costs) {
    return [
      { op: 'replace', path: `${this.activeCharBasePath}/属性/体力`, value: Math.max(0, Number(this.charData.属性?.体力 || 0) - Number(costs.体力 || 0)) },
      { op: 'replace', path: `${this.activeCharBasePath}/属性/魂力`, value: Math.max(0, Number(this.charData.属性?.魂力 || 0) - Number(costs.魂力 || 0)) },
      { op: 'replace', path: `${this.activeCharBasePath}/属性/精神力`, value: Math.max(0, Number(this.charData.属性?.精神力 || 0) - Number(costs.精神力 || 0)) }
    ];
  }

  buildResourceFinalPatches(资源状态 = {}) {
    return [
      { op: 'replace', path: `${this.activeCharBasePath}/属性/体力`, value: Math.max(0, Number(资源状态.体力 || 0)) },
      { op: 'replace', path: `${this.activeCharBasePath}/属性/魂力`, value: Math.max(0, Number(资源状态.魂力 || 0)) },
      { op: 'replace', path: `${this.activeCharBasePath}/属性/精神力`, value: Math.max(0, Number(资源状态.精神力 || 0)) }
    ];
  }

  buildMaterialFinalPatches(材料库存快照 = {}, 选中材料 = []) {
    return 选中材料.map(材料名 => {
      const 剩余数量 = Math.max(0, Number(材料库存快照[材料名] || 0));
      return 剩余数量 <= 0
        ? { op: 'remove', path: `${this.activeCharBasePath}/背包/${this.escapeJsonPointer(材料名)}` }
        : { op: 'replace', path: `${this.activeCharBasePath}/背包/${this.escapeJsonPointer(材料名)}/数量`, value: 剩余数量 };
    });
  }

  buildTimeSkipPatch(跳过小时 = 0) {
    const 当前tick = Math.max(0, Number(this.snapshot?.sd?.world?.时间?.tick || 0));
    const 目标tick = 当前tick + Math.max(0, Math.floor(Number(跳过小时 || 0) * 副职业每小时tick));
    return [{ op: 'replace', path: '/world/时间/tick', value: 目标tick }];
  }
  buildMaterialConsumePatches(materialNames, qty) {
    return materialNames.map(mName => {
      const nextQty = Number(this.currentInventory[mName]?.数量 || 0) - qty;
      return nextQty <= 0 
        ? { op: 'remove', path: `${this.activeCharBasePath}/背包/${this.escapeJsonPointer(mName)}` } 
        : { op: 'replace', path: `${this.activeCharBasePath}/背包/${this.escapeJsonPointer(mName)}/数量`, value: nextQty };
    });
  }
  buildConsumePlanPatches(plan) {
    return Object.entries(plan || {}).filter(([_, q]) => Number(q) > 0).map(([name, consumeQty]) => {
      const nextQty = Number(this.currentInventory[name]?.数量 || 0) - Number(consumeQty);
      return nextQty <= 0 
        ? { op: 'remove', path: `${this.activeCharBasePath}/背包/${this.escapeJsonPointer(name)}` } 
        : { op: 'replace', path: `${this.activeCharBasePath}/背包/${this.escapeJsonPointer(name)}/数量`, value: nextQty };
    });
  }
  buildInventoryAddPatches(itemName, itemData, amount = 1) {
    const safeItem = itemData && typeof itemData === 'object' ? itemData : {};
    const definition = {
      类型: safeItem.类型 || '副职业产物',
      阶位: Math.max(0, Math.floor(Number(safeItem.阶位 || this.getItemTier(itemName) || 0))),
      品质: safeItem.品质 || '普通',
      描述: safeItem.描述 || `副职业产物【${itemName}】`,
      基础价格: Math.max(0, Math.floor(Number(safeItem.基础价格 || 0))),
      默认货币: safeItem.默认货币 || '联邦币',
      装备槽位: safeItem.装备槽位 || '无',
      基础耐久: Math.max(0, Math.floor(Number(safeItem.基础耐久 || 0))),
      使用条件: safeItem.使用条件 && typeof safeItem.使用条件 === 'object' && !Array.isArray(safeItem.使用条件) ? safeItem.使用条件 : {},
      使用效果: Array.isArray(safeItem.使用效果) ? safeItem.使用效果 : [],
      属性加成: safeItem.属性加成 && typeof safeItem.属性加成 === 'object' && !Array.isArray(safeItem.属性加成) ? safeItem.属性加成 : {},
      装备技能: safeItem.装备技能 && typeof safeItem.装备技能 === 'object' && !Array.isArray(safeItem.装备技能) ? safeItem.装备技能 : {},
      副职业参数: {
        ...(safeItem.副职业参数 && typeof safeItem.副职业参数 === 'object' && !Array.isArray(safeItem.副职业参数) ? safeItem.副职业参数 : {}),
        ...(safeItem.品质系数 ? { 品质系数: safeItem.品质系数 } : {}),
        ...(safeItem.融合参数 ? { 融合参数: safeItem.融合参数 } : {})
      }
    };
    const patches = [];
    if (!this.itemDefinitions[itemName]) {
      patches.push({ op: 'replace', path: `/物品/${this.escapeJsonPointer(itemName)}`, value: definition });
    }
    if (this.currentInventory[itemName]) {
      patches.push({ op: 'replace', path: `${this.activeCharBasePath}/背包/${this.escapeJsonPointer(itemName)}/数量`, value: Number(this.currentInventory[itemName].数量 || 0) + amount });
      return patches;
    }
    patches.push({ op: 'replace', path: `${this.activeCharBasePath}/背包/${this.escapeJsonPointer(itemName)}`, value: { 数量: amount } });
    return patches;
  }
  buildJobProgressPatches(jobName, expGain) {
    const runtime = this.getJobRuntime(jobName);
    const nextExp = runtime.exp + expGain;
    const derived = this.deriveJobLimitsFromExp(nextExp);
    return {
      patches: [
        { op: 'replace', path: `${this.activeCharBasePath}/职业/${this.escapeJsonPointer(jobName)}/经验`, value: nextExp }
      ],
      oldLv: runtime.lv, newLv: derived.lv
    };
  }
  getProfessionExpGainMultiplier() {
    const statusMap = this.charData?.属性?.状态效果;
    if (!statusMap || typeof statusMap !== 'object') return 1;
    const currentTick = Math.max(0, Number(this.snapshot?.sd?.world?.时间?.tick || 0));
    let mult = 1;
    Object.values(statusMap).forEach(status => {
      if (!status || typeof status !== 'object') return;
      if (String(status.收益类型 || '').trim() !== '训练方式收益') return;
      if (String(status.训练方式 || '').trim() !== '副职业经验') return;
      const expireTick = Math.max(0, Number(status.结束tick || 0));
      if (expireTick > 0 && currentTick >= expireTick) return;
      const value = Number(status.收益倍率 || 0);
      if (Number.isFinite(value) && value > 0) mult *= value;
    });
    return Math.max(0.1, Math.min(5, Number(mult.toFixed(4))));
  }
  applyProfessionExpGainMultiplier(expGain) {
    const base = Number(expGain || 0);
    if (!(base > 0)) return 0;
    return Math.max(1, Math.round(base * this.getProfessionExpGainMultiplier()));
  }
  buildSystemResultPatches(resultLog, roll, successRate) {
    return [
      { op: 'replace', path: '/sys/系统播报', value: String(resultLog || '') },
      { op: 'replace', path: '/sys/最终成功率', value: Number.isFinite(Number(successRate)) ? Number(successRate) : 0 }
    ];
  }
  buildFrontEndStateBlock(analysis, patchOps) {
    const safeAnalysis = String(analysis || 'Profession action prepared.').trim();
    return `<UpdateVariable>\n<Analysis>${safeAnalysis}</Analysis>\n<JSONPatch>\n${JSON.stringify(patchOps || [], null, 2)}\n</JSONPatch>\n</UpdateVariable>`;
  }
  getForgeSingleQuality(tier, runtime) {
    const unlockLv = this.getForgeUnlockLevel(tier);
    let q = 1.0;
    if (tier === 5) q = 1.02 + Math.random() * 0.05;
    else if (runtime.lv === unlockLv) q = 1.0 + runtime.expRatio * 0.10 + Math.random() * 0.03;
    else if (runtime.lv === unlockLv + 1) q = 1.10 + runtime.expRatio * 0.10 + Math.random() * 0.02;
    else q = 1.15 + runtime.expRatio * 0.05 + Math.random() * 0.03;
    return this.clamp(Number(q.toFixed(2)), 0.8, 1.2);
  }
  getForgeFusionQuality(tier, maxQ, fusionRate, roll, isGreatSuccess) {
    const syncBonus = Math.pow(fusionRate / 100, 2);
    if (isGreatSuccess) {
      if (maxQ >= 2.0 && Math.random() * 100 <= 10) return this.clamp(Number((1.8 + 0.2 * syncBonus + Math.random() * 0.05).toFixed(2)), 0.8, maxQ);
      if (maxQ >= 1.8) return this.clamp(Number((1.5 + 0.3 * syncBonus + Math.random() * 0.05).toFixed(2)), 0.8, maxQ);
      if (maxQ >= 1.5) return this.clamp(Number((1.2 + 0.3 * syncBonus + Math.random() * 0.05).toFixed(2)), 0.8, maxQ);
      return 1.2;
    }
    let q = (maxQ >= 1.5 ? 0.95 : 0.90) + (maxQ >= 1.5 ? 0.45 : 0.25) * syncBonus + Math.random() * 0.05;
    return this.clamp(Number(q.toFixed(2)), 0.8, Math.min(maxQ, maxQ > 1.2 ? 1.5 : 1.2));
  }
  getGenericQuality(runtime, tier, isGreatSuccess) {
    const base = runtime.lv >= this.getForgeUnlockLevel(tier) + 1 ? 1.08 : 0.98;
    return this.clamp(Number((base + runtime.expRatio * 0.12 + (isGreatSuccess ? 0.15 : 0) + Math.random() * 0.05).toFixed(2)), 0.8, 1.25);
  }

  submitAction(playerInput, sysPrompt, requestKind) {
    if (this.options.onAction) {
      this.options.onAction({ playerInput, systemPrompt: sysPrompt, requestKind });
    }
  }

  executeProfessionAction() {
    const 连续配置 = this.获取连续模式配置();
    if (连续配置.连续模式开启) {
      this.executeContinuousProfession(连续配置);
      return;
    }
    if (this.activeMode === 'forge') this.executeForge();
    else this.executeGenericProfession();
  }

  executeContinuousProfession(连续配置 = this.获取连续模式配置()) {
    const cfg = PROFESSION_CONFIG[this.activeMode];
    const runtime = this.getJobRuntime(cfg.jobName);
    const tier = Number(this.$('#prof-tier').value || 1);
    const qty = Math.max(1, Number(this.$('#prof-cost').value || 1));
    const targetName = String(this.$('#prof-target').value || '').trim();
    const materialNames = this.getSelectedMaterialNames();
    const costs = this.getProfessionCost(cfg.jobName, tier, qty);
    const commissionCtx = this.getCommissionContext(cfg, runtime, tier, materialNames, targetName);
    const effectiveRuntime = commissionCtx.validationRuntime || runtime;
    let ruleError = commissionCtx.error || null;
    if (this.activeMode === 'forge') {
      if (!ruleError) ruleError = this.validateForgeRules(effectiveRuntime, tier, materialNames, targetName, { isCommission: commissionCtx.isCommission });
    } else if (!ruleError) {
      ruleError = this.validateGenericRules(cfg, effectiveRuntime, tier, materialNames, targetName);
    }
    if (ruleError) {
      this.显示提示(ruleError);
      return;
    }

    const 是否委托 = commissionCtx.isCommission;
    const 总小时 = Math.max(1, Number(连续配置.连续总小时 || 1));
    const 单次材料消耗计划 = this.构建单次材料消耗计划(cfg, tier, qty, targetName, materialNames);
    const 材料库存快照 = this.构建材料库存快照(materialNames);
    const 资源状态 = this.获取恢复状态快照();
    const 资金单次消耗 = 是否委托 ? Math.max(0, Number(commissionCtx.commissionFee || 0)) : 0;
    let 当前资金 = Math.max(0, Number(this.charData?.财富?.联邦币 || 0));
    let 剩余小时 = 总小时;

    const 统计 = {
      执行次数: 0,
      成功次数: 0,
      失败次数: 0,
      大成功次数: 0,
      冥想小时: 0,
      睡眠小时: 0,
      累计经验: 0,
      最后检定: 0,
      最后成功率: 0,
    };
    const 产物汇总 = {};
    let 修理成功标记 = false;

    const 锻造复合数 = Math.max(Number(commissionCtx.fusionCount || 1), materialNames.length || 1);
    const 锻造是否融锻 = 锻造复合数 > 1;
    const 通用复合数 = Math.max(materialNames.length || 0, commissionCtx.fusionCount || 1);
    const 通用是否复合 = 通用复合数 > 1;

    while (剩余小时 > 0) {
      const 资源充足 = 是否委托 ? true : this.hasEnoughResources(costs, 资源状态);
      const 材料充足 = this.检查材料是否足够(材料库存快照, 单次材料消耗计划);
      const 资金充足 = 资金单次消耗 <= 0 || 当前资金 >= 资金单次消耗;
      if (资源充足 && 材料充足 && 资金充足) {
        统计.执行次数 += 1;
        if (!是否委托) this.扣减资源(资源状态, costs);
        this.扣减材料库存(材料库存快照, 单次材料消耗计划);
        if (资金单次消耗 > 0) 当前资金 = Math.max(0, 当前资金 - 资金单次消耗);

        const 本次成功率 = this.activeMode === 'forge'
          ? (是否委托 ? Number(commissionCtx.successRate || 0) : (锻造是否融锻 ? this.getForgeFusionSuccessRate(runtime, 锻造复合数, !!this.charData.功法?.['暗器百解']) : this.getSingleTierSuccessRate(tier, runtime)))
          : (是否委托 ? Number(commissionCtx.successRate || 0) : (通用是否复合 ? this.getGenericCompositeRate(runtime, 通用复合数) : this.getGenericSingleRate(runtime)));
        const roll = Math.floor(Math.random() * 100) + 1;
        const isGreatSuccess = roll <= 5 && !commissionCtx.isOfficial;
        const isSuccess = isGreatSuccess || roll <= 本次成功率;
        统计.最后检定 = roll;
        统计.最后成功率 = 本次成功率;
        if (isSuccess) {
          统计.成功次数 += 1;
          if (isGreatSuccess) 统计.大成功次数 += 1;
          let 本次经验 = Number(cfg.expGain[tier] || 50);
          if (isGreatSuccess && !是否委托) 本次经验 *= 2;
          本次经验 = this.applyProfessionExpGainMultiplier(本次经验);
          if (!是否委托) 统计.累计经验 += 本次经验;

          if (this.activeMode === 'forge') {
            const firstMaterial = this.resolveInventoryItem(materialNames[0]);
            const 本次融合率 = 锻造是否融锻
              ? Number(commissionCtx.fusionSync || this.getForgeFusionRate(commissionCtx.executorRuntime || runtime, materialNames))
              : Number(firstMaterial?.副职业参数?.融合参数?.融合率 ?? firstMaterial?.副职业参数?.融合参数?.契合度 ?? firstMaterial?.融合参数?.融合率 ?? firstMaterial?.融合参数?.契合度 ?? 100);
            const 本次品质 = commissionCtx.isOfficial
              ? 1
              : (锻造是否融锻
                ? this.getForgeFusionQuality(tier, this.getForgeMaxQ(tier, 锻造复合数), 本次融合率, roll, isGreatSuccess)
                : this.clamp(isGreatSuccess ? 1.2 : this.getForgeSingleQuality(tier, commissionCtx.executorRuntime || runtime), 0.8, 1.2));
            const 产物名 = isGreatSuccess ? `极品·${targetName}` : targetName;
            if (!产物汇总[产物名]) {
              产物汇总[产物名] = {
                数量: 0,
                类型: '副职业产物',
                品质: isGreatSuccess ? '极品' : '标准',
                品质系数累计: 0,
                融合参数: 锻造是否融锻 ? { 数量: 锻造复合数, 融合率: Math.floor(本次融合率) } : null,
                描述: `由${commissionCtx.executorName}完成的${cfg.jobName}产物`,
              };
            }
            产物汇总[产物名].数量 += 1;
            产物汇总[产物名].品质系数累计 += Number(本次品质 || 1);
            if (isGreatSuccess) 产物汇总[产物名].品质 = '极品';
          } else if (this.activeMode === 'design') {
            const 产物名 = this.getDesignOutputName(targetName, tier, materialNames);
            const 品质系数 = commissionCtx.isOfficial ? 1 : this.getGenericQuality(commissionCtx.executorRuntime || runtime, tier, isGreatSuccess);
            if (!产物汇总[产物名]) {
              产物汇总[产物名] = { 数量: 0, 类型: '图纸', 品质: this.getTierQualityLabel(cfg.mode, tier), 品质系数累计: 0, 描述: `由${commissionCtx.executorName}完成的${cfg.jobName}绘制` };
            }
            产物汇总[产物名].数量 += 1;
            产物汇总[产物名].品质系数累计 += Number(品质系数 || 1);
          } else if (this.activeMode === 'manufacture') {
            const 产物信息 = this.getManufactureOutputMeta(targetName, materialNames, tier);
            const 品质系数 = commissionCtx.isOfficial ? 1 : this.getGenericQuality(commissionCtx.executorRuntime || runtime, tier, isGreatSuccess);
            if (!产物汇总[产物信息.name]) {
              产物汇总[产物信息.name] = { 数量: 0, 类型: 产物信息.type, 品质: this.getTierQualityLabel(cfg.mode, tier), 品质系数累计: 0, 描述: `由${commissionCtx.executorName}完成的${cfg.jobName}制造` };
            }
            产物汇总[产物信息.name].数量 += 1;
            产物汇总[产物信息.name].品质系数累计 += Number(品质系数 || 1);
          } else if (this.activeMode === 'repair') {
            修理成功标记 = true;
          }
        } else {
          统计.失败次数 += 1;
        }

        剩余小时 -= 1;
        continue;
      }

      if (是否委托) {
        剩余小时 -= 1;
        continue;
      }
      const 恢复模式 = this.选择最佳恢复模式(资源状态, costs);
      const 恢复增量 = this.计算恢复增量预估(资源状态, 恢复模式);
      this.应用恢复增量(资源状态, 恢复增量);
      if (恢复模式 === '冥想') 统计.冥想小时 += 1;
      else 统计.睡眠小时 += 1;
      剩余小时 -= 1;
    }

    let patchOps = [];
    if (!是否委托) patchOps.push(...this.buildResourceFinalPatches(资源状态));
    else if (资金单次消耗 > 0) patchOps.push({ op: 'replace', path: `${this.activeCharBasePath}/财富/联邦币`, value: 当前资金 });
    patchOps.push(...this.buildMaterialFinalPatches(材料库存快照, materialNames));
    patchOps.push(...this.buildTimeSkipPatch(总小时));

    Object.entries(产物汇总).forEach(([产物名, 数据]) => {
      const 平均品质系数 = Number((Number(数据.品质系数累计 || 0) / Math.max(1, Number(数据.数量 || 1))).toFixed(2));
      const 物品数据 = {
        类型: 数据.类型 || '副职业产物',
        品质: 数据.品质 || '标准',
        品质系数: 平均品质系数,
        描述: 数据.描述 || `由${commissionCtx.executorName}完成的${cfg.jobName}产物`,
      };
      if (数据.融合参数) 物品数据.融合参数 = 数据.融合参数;
      patchOps.push(...this.buildInventoryAddPatches(产物名, 物品数据, Number(数据.数量 || 1)));
    });

    if (this.activeMode === 'repair' && 修理成功标记) {
      const existing = this.currentInventory[targetName] || {};
      const repairDesc = this.getRepairDescriptor(materialNames);
      const definition = this.resolveInventoryItem(targetName);
      if (!this.itemDefinitions[targetName]) {
        patchOps.push({
          op: 'replace',
          path: `/物品/${this.escapeJsonPointer(targetName)}`,
          value: {
            类型: definition.类型 || '装备',
            阶位: Math.max(0, Math.floor(Number(definition.阶位 || this.getItemTier(targetName) || 0))),
            品质: definition.品质 || '普通',
            描述: `${definition?.描述 ? definition.描述 + ' | ' : ''}${repairDesc.desc}`,
            基础价格: Math.max(0, Math.floor(Number(definition.基础价格 || 0))),
            默认货币: definition.默认货币 || '联邦币',
            装备槽位: definition.装备槽位 || '无',
            基础耐久: Math.max(100, Math.floor(Number(definition.基础耐久 || 100))),
            使用条件: definition.使用条件 && typeof definition.使用条件 === 'object' ? definition.使用条件 : {},
            使用效果: Array.isArray(definition.使用效果) ? definition.使用效果 : [],
            属性加成: definition.属性加成 && typeof definition.属性加成 === 'object' ? definition.属性加成 : {},
            装备技能: definition.装备技能 && typeof definition.装备技能 === 'object' ? definition.装备技能 : {},
            副职业参数: definition.副职业参数 && typeof definition.副职业参数 === 'object' ? definition.副职业参数 : {}
          }
        });
      }
      patchOps.push({ op: 'replace', path: `${this.activeCharBasePath}/背包/${this.escapeJsonPointer(targetName)}/耐久`, value: Math.max(100, Number(definition.基础耐久 || 100)) });
      patchOps.push({ op: 'replace', path: `${this.activeCharBasePath}/背包/${this.escapeJsonPointer(targetName)}/来源`, value: repairDesc.status });
    }

    if (!是否委托 && 统计.累计经验 > 0) {
      const progress = this.buildJobProgressPatches(cfg.jobName, 统计.累计经验);
      patchOps.push(...progress.patches);
    }

    const 连续结果播报 = `[连续副职业] ${cfg.displayName} ${连续配置.连续天数}天（${总小时}小时）结束：执行${统计.执行次数}次，成功${统计.成功次数}次，失败${统计.失败次数}次，大成功${统计.大成功次数}次。${是否委托 ? '' : ` 冥想${统计.冥想小时}小时，睡眠${统计.睡眠小时}小时。`}时间已推进${总小时 * 副职业每小时tick}tick。`;
    patchOps.push(...this.buildSystemResultPatches(连续结果播报, 统计.最后检定, 统计.最后成功率));

    const materialText = materialNames.length > 0 ? materialNames.map(name => `${qty}份${name}`).join('、') : '无显式材料';
    const officialLocationName = this.getOfficialCommissionLocation(cfg.jobName);
    const actionLead = commissionCtx.isOfficial
      ? `我要在${officialLocationName}连续委托${cfg.displayName}${连续配置.连续天数}天，目标是【${targetName}】`
      : (commissionCtx.isPrivate
        ? `我要委托【${commissionCtx.executorName}】连续代工${cfg.displayName}${连续配置.连续天数}天，目标是【${targetName}】`
        : `我要连续进行${cfg.displayName}${连续配置.连续天数}天，目标是【${targetName}】`);
    const consumptionText = commissionCtx.isCommission
      ? `连续代工单次费用：${this.formatFedCoin(commissionCtx.commissionFee)}。本轮执行 ${统计.执行次数} 次，累计扣费 ${this.formatFedCoin(统计.执行次数 * Number(commissionCtx.commissionFee || 0))}。`
      : `单次消耗：${this.formatResourceCost(costs)}。本轮执行 ${统计.执行次数} 次后，剩余资源为 体:${Math.floor(资源状态.体力)} / 魂:${Math.floor(资源状态.魂力)} / 精:${Math.floor(资源状态.精神力)}。`;
    const sysPrompt = `${PROF_HIDDEN_ARBITRATION_NARRATION_RULES}\n\n[执行来源]\n本次执行者：${commissionCtx.executorName}。${commissionCtx.note}\n\n${连续结果播报}\n\n[副职业资源消耗]\n${consumptionText}\n${this.buildFrontEndStateBlock('Continuous profession executed.', patchOps)}`;
    this.submitAction(`${actionLead}，材料：${materialText}。`, sysPrompt, `prof_${cfg.mode}_continuous`);
  }

  executeForge() {
    const cfg = PROFESSION_CONFIG.forge;
    const runtime = this.getJobRuntime(cfg.jobName);
    const tier = Number(this.$('#prof-tier').value || 1);
    const qty = Math.max(1, Number(this.$('#prof-cost').value || 1));
    const targetName = String(this.$('#prof-target').value || '').trim();
    const materialNames = this.getSelectedMaterialNames();
    const costs = this.getProfessionCost(cfg.jobName, tier, qty);
    const commissionCtx = this.getCommissionContext(cfg, runtime, tier, materialNames, targetName);
    
    const efc = Math.max(Number(commissionCtx.fusionCount || 1), materialNames.length || 1);
    const isFusion = efc > 1;
    const successRate = commissionCtx.isCommission ? Number(commissionCtx.successRate || 0) : (isFusion ? this.getForgeFusionSuccessRate(runtime, efc, !!this.charData.功法?.['暗器百解']) : this.getSingleTierSuccessRate(tier, runtime));
    const firstMaterial = this.resolveInventoryItem(materialNames[0]);
    const fusionRate = isFusion ? Number(commissionCtx.fusionSync || this.getForgeFusionRate(commissionCtx.executorRuntime || runtime, materialNames)) : Number(firstMaterial?.副职业参数?.融合参数?.融合率 ?? firstMaterial?.融合参数?.融合率 ?? 100);
    const maxQ = this.getForgeMaxQ(tier, efc);
    
    const roll = Math.floor(Math.random() * 100) + 1;
    const isGreatSuccess = roll <= 5 && !commissionCtx.isOfficial;
    const isSuccess = isGreatSuccess || roll <= successRate;

    let finalQ = 0, resultLog = '', productName = targetName, expGain = cfg.expGain[tier] || 50;
    if (isSuccess) {
      if (commissionCtx.isOfficial) finalQ = 1.0;
      else if (isFusion) finalQ = this.getForgeFusionQuality(tier, maxQ, fusionRate, roll, isGreatSuccess);
      else finalQ = this.clamp(isGreatSuccess ? 1.2 : this.getForgeSingleQuality(tier, commissionCtx.executorRuntime || runtime), 0.8, 1.2);
      
      if (isGreatSuccess) {
        productName = `极品·${targetName}`;
        if (!commissionCtx.isCommission) expGain *= 2;
        resultLog = `[大成功] ${commissionCtx.executorName}触发极限锻压，成功打造出【${targetName}】。品质系数 ${finalQ.toFixed(2)}。`;
      } else {
        const feeMsg = commissionCtx.isCommission ? (commissionCtx.commissionFee > 0 ? ` 已支付代工费 ${this.formatFedCoin(commissionCtx.commissionFee)}。` : ' 本次代工因好感度优惠免单。') : '';
        resultLog = `${commissionCtx.isCommission ? '[委托成功]' : '[打造成功]'} ${commissionCtx.executorName}成功完成【${targetName}】的锻造，品质系数 ${finalQ.toFixed(2)}。${feeMsg}`;
      }
      expGain = this.applyProfessionExpGainMultiplier(expGain);
    } else {
      resultLog = `${commissionCtx.isCommission ? '[委托失败]' : '[打造失败]'} ${commissionCtx.executorName}尝试打造【${targetName}】失败。Roll ${roll} > 成功率 ${successRate}。`;
    }

    let patchOps = [];
    if (commissionCtx.isCommission) patchOps.push(...this.buildCommissionFeePatches(commissionCtx.commissionFee));
    else patchOps.push(...this.buildResourcePatches(costs));
    patchOps.push(...this.buildMaterialConsumePatches(materialNames, qty));

    if (isSuccess) {
      const newItem = { 数量: 1, 类型: '副职业产物', 品质: isGreatSuccess ? '极品' : '标准', 品质系数: Number(finalQ.toFixed(2)), 描述: `由${commissionCtx.executorName}完成的${cfg.jobName}产物` };
      if (isFusion) { newItem.融合参数 = { 数量: efc, 融合率: Math.floor(fusionRate) }; newItem.描述 += ` (${efc}种金属融锻)`; }
      patchOps.push(...this.buildInventoryAddPatches(productName, newItem, 1));
      if (!commissionCtx.isCommission) {
        const progress = this.buildJobProgressPatches(cfg.jobName, expGain);
        patchOps.push(...progress.patches);
        if (progress.newLv > progress.oldLv) resultLog += `\n\n[职业突破] ${cfg.jobName}等级提升至 Lv.${progress.newLv}。`;
      }
    }
    patchOps.push(...this.buildSystemResultPatches(resultLog, roll, successRate));

    const materialText = materialNames.map(name => `${qty}份${name}`).join('、');
    const officialLocationName = this.getOfficialCommissionLocation(cfg.jobName);
    const actionLead = commissionCtx.isOfficial ? `我要在${officialLocationName}办理官方代工，委托完成【${targetName}】的${cfg.displayName}` : (commissionCtx.isPrivate ? `我要委托【${commissionCtx.executorName}】代工${cfg.displayName}，目标是【${targetName}】` : `我要进行${cfg.displayName}，目标是【${targetName}】`);
    const consumptionText = commissionCtx.isCommission ? `本次代工费：${this.formatFedCoin(commissionCtx.commissionFee)}。材料仍由委托人提供。` : `本次消耗：${this.formatResourceCost(costs)}。`;
    const sysPrompt = `${PROF_HIDDEN_ARBITRATION_NARRATION_RULES}\n\n[执行来源]\n本次执行者：${commissionCtx.executorName}。${commissionCtx.note}\n\n${resultLog}\n\n[副职业资源消耗]\n${consumptionText}\n${this.buildFrontEndStateBlock('Forge executed.', patchOps)}`;
    this.submitAction(`${actionLead}，材料为：${materialText}。`, sysPrompt, 'prof_forge');
  }

  executeGenericProfession() {
    const cfg = PROFESSION_CONFIG[this.activeMode];
    const runtime = this.getJobRuntime(cfg.jobName);
    const tier = Number(this.$('#prof-tier').value || 1);
    const qty = Math.max(1, Number(this.$('#prof-cost').value || 1));
    const targetName = String(this.$('#prof-target').value || '').trim();
    const materialNames = this.getSelectedMaterialNames();
    const costs = this.getProfessionCost(cfg.jobName, tier, qty);
    const commissionCtx = this.getCommissionContext(cfg, runtime, tier, materialNames, targetName);
    
    const efc = Math.max(materialNames.length || 0, commissionCtx.fusionCount || 1);
    const isComp = efc > 1;
    const successRate = commissionCtx.isCommission ? Number(commissionCtx.successRate || 0) : (isComp ? this.getGenericCompositeRate(runtime, efc) : this.getGenericSingleRate(runtime));
    const roll = Math.floor(Math.random() * 100) + 1;
    const isGreatSuccess = roll <= 5 && !commissionCtx.isOfficial;
    const isSuccess = isGreatSuccess || roll <= successRate;
    const finalQ = isSuccess ? (commissionCtx.isOfficial ? 1.0 : this.getGenericQuality(commissionCtx.executorRuntime || runtime, tier, isGreatSuccess)) : 0;
    let expGain = cfg.expGain[tier] || 50;
    if (isGreatSuccess && !commissionCtx.isCommission) expGain *= 2;
    expGain = this.applyProfessionExpGainMultiplier(expGain);

    let patchOps = [];
    if (commissionCtx.isCommission) patchOps.push(...this.buildCommissionFeePatches(commissionCtx.commissionFee));
    else patchOps.push(...this.buildResourcePatches(costs));

    if (this.activeMode === 'manufacture') {
      const recipe = this.getManufactureRecipe(targetName, materialNames, tier, qty);
      if (recipe?.mode === 'mech') {
        patchOps.push(...this.buildConsumePlanPatches(this.buildTierNeedConsumePlan(materialNames, recipe.fixedTierNeeds)));
      } else if (recipe?.mode === 'armor') {
        const armorPlan = {};
        materialNames.filter(n => n !== recipe.blueprint).forEach(n => armorPlan[n] = Number(armorPlan[n] || 0) + qty);
        if (materialNames.includes(recipe.blueprint)) armorPlan[recipe.blueprint] = Number(armorPlan[recipe.blueprint] || 0) + Number(recipe.blueprintCost || 1);
        patchOps.push(...this.buildConsumePlanPatches(armorPlan));
      } else if (materialNames.length > 0) patchOps.push(...this.buildMaterialConsumePatches(materialNames, qty));
    } else if (materialNames.length > 0) patchOps.push(...this.buildMaterialConsumePatches(materialNames, qty));

    let resultLog = '';
    if (isSuccess) {
      if (this.activeMode === 'design') {
        const outputName = this.getDesignOutputName(targetName, tier, materialNames);
        patchOps.push(...this.buildInventoryAddPatches(outputName, { 类型: '图纸', 品质: this.getTierQualityLabel(cfg.mode, tier), 品质系数: finalQ, 描述: `由${commissionCtx.executorName}完成的${cfg.jobName}绘制` }, 1));
        resultLog = `[${commissionCtx.isCommission ? '委托成功' : cfg.displayName + '成功'}] ${commissionCtx.executorName}完成了【${outputName}】的设计绘制，完成度系数 ${finalQ.toFixed(2)}。`;
      } else if (this.activeMode === 'manufacture') {
        const mMeta = this.getManufactureOutputMeta(targetName, materialNames, tier);
        patchOps.push(...this.buildInventoryAddPatches(mMeta.name, { 类型: mMeta.type, 品质: this.getTierQualityLabel(cfg.mode, tier), 品质系数: finalQ, 描述: `由${commissionCtx.executorName}完成的${cfg.jobName}制造` }, 1));
        resultLog = `[${commissionCtx.isCommission ? '委托成功' : cfg.displayName + '成功'}] ${commissionCtx.executorName}完成了【${mMeta.name}】的制造，完成度系数 ${finalQ.toFixed(2)}。`;
      } else if (this.activeMode === 'repair') {
        const existing = this.currentInventory[targetName] || {};
        const definition = this.resolveInventoryItem(targetName);
        const repairDesc = this.getRepairDescriptor(materialNames);
        if (!this.itemDefinitions[targetName]) {
          patchOps.push({
            op: 'replace',
            path: `/物品/${this.escapeJsonPointer(targetName)}`,
            value: {
              类型: definition.类型 || '装备',
              阶位: Math.max(0, Math.floor(Number(definition.阶位 || this.getItemTier(targetName) || 0))),
              品质: definition.品质 || '普通',
              描述: `${definition?.描述 ? definition.描述 + ' | ' : ''}${repairDesc.desc}`,
              基础价格: Math.max(0, Math.floor(Number(definition.基础价格 || 0))),
              默认货币: definition.默认货币 || '联邦币',
              装备槽位: definition.装备槽位 || '无',
              基础耐久: Math.max(100, Math.floor(Number(definition.基础耐久 || 100))),
              使用条件: definition.使用条件 && typeof definition.使用条件 === 'object' ? definition.使用条件 : {},
              使用效果: Array.isArray(definition.使用效果) ? definition.使用效果 : [],
              属性加成: definition.属性加成 && typeof definition.属性加成 === 'object' ? definition.属性加成 : {},
              装备技能: definition.装备技能 && typeof definition.装备技能 === 'object' ? definition.装备技能 : {},
              副职业参数: definition.副职业参数 && typeof definition.副职业参数 === 'object' ? definition.副职业参数 : {}
            }
          });
        }
        if (!existing || !Object.keys(existing).length) patchOps.push({ op: 'replace', path: `${this.activeCharBasePath}/背包/${this.escapeJsonPointer(targetName)}`, value: { 数量: 1, 耐久: Math.max(100, Number(definition.基础耐久 || 100)), 来源: repairDesc.status } });
        else {
          patchOps.push({ op: 'replace', path: `${this.activeCharBasePath}/背包/${this.escapeJsonPointer(targetName)}/耐久`, value: Math.max(100, Number(definition.基础耐久 || 100)) });
          patchOps.push({ op: 'replace', path: `${this.activeCharBasePath}/背包/${this.escapeJsonPointer(targetName)}/来源`, value: repairDesc.status });
        }
        resultLog = `[${commissionCtx.isCommission ? '委托成功' : cfg.displayName + '成功'}] ${commissionCtx.executorName}完成了对【${targetName}】的整备修理。当前状态：${repairDesc.status}。`;
      }
      if (!commissionCtx.isCommission) {
        const progress = this.buildJobProgressPatches(cfg.jobName, expGain);
        patchOps.push(...progress.patches);
        if (progress.newLv > progress.oldLv) resultLog += `\n\n[职业突破] ${cfg.jobName}等级提升至 Lv.${progress.newLv}。`;
      }
      if (isGreatSuccess) resultLog = `[大成功] ${commissionCtx.executorName}以极高完成度完成了【${targetName}】的${cfg.displayName}操作，品质系数 ${finalQ.toFixed(2)}。`;
      else if (commissionCtx.isCommission) resultLog += (commissionCtx.commissionFee > 0 ? ` 已支付代工费 ${this.formatFedCoin(commissionCtx.commissionFee)}。` : ' 本次代工因好感度优惠免单。');
    } else {
      resultLog = `[${commissionCtx.isCommission ? '委托失败' : cfg.displayName + '失败'}] ${commissionCtx.executorName}尝试处理【${targetName}】失败。Roll ${roll} > 成功率 ${successRate}。`;
    }

    patchOps.push(...this.buildSystemResultPatches(resultLog, roll, successRate));

    const materialText = materialNames.length > 0 ? materialNames.map(name => `${qty}份${name}`).join('、') : '无显式材料';
    const officialLocationName = this.getOfficialCommissionLocation(cfg.jobName);
    const actionLead = commissionCtx.isOfficial ? `我要在${officialLocationName}办理官方代工，委托执行${cfg.displayName}，目标是【${targetName}】` : (commissionCtx.isPrivate ? `我要委托【${commissionCtx.executorName}】代工${cfg.displayName}，目标是【${targetName}】` : `我要进行${cfg.displayName}，目标是【${targetName}】`);
    const consumptionText = commissionCtx.isCommission ? `本次代工费：${this.formatFedCoin(commissionCtx.commissionFee)}。材料与目标物仍由委托人提供。` : `本次消耗：${this.formatResourceCost(costs)}。`;
    const sysPrompt = `${PROF_HIDDEN_ARBITRATION_NARRATION_RULES}\n\n[执行来源]\n本次执行者：${commissionCtx.executorName}。${commissionCtx.note}\n\n${resultLog}\n\n[副职业资源消耗]\n${consumptionText}\n${this.buildFrontEndStateBlock('Generic profession executed.', patchOps)}`;
    this.submitAction(`${actionLead}，材料：${materialText}。`, sysPrompt, `prof_${cfg.mode}`);
  }
}

window.mountProfessionUI = function(containerElement, snapshot, options = {}) {
  return new ProfessionUIComponent(containerElement, snapshot, options);
};

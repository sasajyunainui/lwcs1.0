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
        <div class="hint" id="qty-hint">锻造默认会按“每种材料消耗量”扣除材料，并同步扣除副职业资源。</div>
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
      <div class="hint" id="materials-hint">锻造支持多选融锻；其余副职业按材料协同处理。</div>
    </div>
  </div>

  <div class="section-card">
    <div class="section-title">副职业预演</div>
    <div class="info-panel">
      <div class="info-row"><span class="info-key">当前副职业</span><span class="info-val" id="prev-job">-</span></div>
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
    mode: 'manufacture', jobName: '制造师', title: '制造工序', displayName: '机甲制造', actionLabel: '开始制造',
    requiresMaterials: true, supportsFusion: false,
    costs: { 1: [20, 35, 20], 2: [160, 280, 160], 3: [700, 1225, 600], 4: [3000, 5250, 2000], 5: [16000, 28000, 7200] },
    expGain: { 1: 50, 2: 400, 3: 2000, 4: 10000, 5: 50000 },
    targetHint: '填写你想制造的成品名称。',
    materialHint: '可选择金属、图纸、模块、回路等作为制造耗材。'
  },
  design: {
    mode: 'design', jobName: '设计师', title: '设计工序', displayName: '机甲设计', actionLabel: '开始设计',
    requiresMaterials: false, supportsFusion: false,
    costs: { 1: [5, 10, 25], 2: [20, 40, 200], 3: [80, 150, 750], 4: [300, 600, 2500], 5: [1000, 2000, 9000] },
    expGain: { 1: 50, 2: 400, 3: 2000, 4: 10000, 5: 50000 },
    targetHint: '这里填写设计图名称，例如：二字斗铠设计图。',
    materialHint: '设计副职业允许无材料起草，但选入模板/旧图纸会被视作协同设计材料。'
  },
  repair: {
    mode: 'repair', jobName: '修理师', title: '修理工序', displayName: '机甲修理', actionLabel: '开始修理',
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
const 副职业物品定义分类列表 = Object.freeze([
  '锻造金属',
  '设计图纸',
  '近战武器',
  '远程武器',
  '战术装备',
  '功能道具',
  '防具装备',
  '斗铠部件',
  '机甲机体',
  '魂骨',
  '魂灵',
  '魂技造物',
  '天然灵物',
  '丹药',
  '身份凭证',
  '入场凭证',
  '修炼秘籍',
  '一次性道具',
  '剧情杂物',
]);
const 副职业物品定义分类集合 = new Set(副职业物品定义分类列表);
const 副职业装备物品分类集合 = new Set(['近战武器', '防具装备', '斗铠部件', '机甲机体', '魂骨']);
const 副职业可使用物品分类集合 = new Set(['丹药', '天然灵物', '远程武器', '战术装备', '功能道具', '一次性道具', '魂技造物']);
const 副职业物品经济品质列表 = Object.freeze(['普通', '优秀', '稀有', '史诗', '传说', '神器', '超神器']);
const 副职业物品经济品质集合 = new Set(副职业物品经济品质列表);

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
    const 阶级值 = this.$('#prof-tier')?.value || '1';
    let 解析阶级 = Number(阶级值);
    let 子类型 = '';
    if (阶级值.startsWith('mech-')) { 解析阶级 = Number(阶级值.split('-')[1]); 子类型 = 'mech'; }
    else if (阶级值.startsWith('armor-')) { 解析阶级 = Number(阶级值.split('-')[1]); 子类型 = 'armor'; }
    const 数量原文 = this.$('#prof-cost')?.value || '1';
    const 数量数值 = Number(数量原文);
    return {
      activeMode: this.activeMode,
      tier: 解析阶级 || 1,
      subtype: 子类型,
      cost: 数量原文,
      数量: Number.isFinite(数量数值) && 数量数值 > 0 ? Math.max(1, Math.floor(数量数值)) : 1,
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
    const mode = this.normalizeInitialMode(this.options.prefillMode || req.模式 || req.动作 || req.副职业);
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
  规范化物品定义分类(分类 = '', fallback = '剧情杂物') {
    const 文本 = String(分类 || '').trim();
    return 副职业物品定义分类集合.has(文本) ? 文本 : fallback;
  }
  遍历物品定义(回调 = () => {}) {
    const 物品表 = this.itemDefinitions;
    副职业物品定义分类列表.forEach(分类 => {
      const 分类表 = 物品表 && typeof 物品表 === 'object' && !Array.isArray(物品表) ? 物品表[分类] : null;
      Object.entries(分类表 && typeof 分类表 === 'object' && !Array.isArray(分类表) ? 分类表 : {}).forEach(([物品名, 定义]) => {
        if (物品名 && 定义 && typeof 定义 === 'object' && !Array.isArray(定义)) 回调(物品名, 定义, 分类);
      });
    });
  }
  查找物品定义(物品名 = '') {
    const 名称 = String(物品名 || '').trim();
    if (!名称) return null;
    let 结果 = null;
    this.遍历物品定义((当前名, 定义, 分类) => {
      if (!结果 && 当前名 === 名称) 结果 = { 物品名: 当前名, 定义, 分类 };
    });
    return 结果;
  }
  要求产物分类(物品名 = '', 物品数据 = {}, fallback = '') {
    const 数据 = 物品数据 && typeof 物品数据 === 'object' && !Array.isArray(物品数据) ? 物品数据 : {};
    const 分类 = this.规范化物品定义分类(数据.物品分类 || 数据.分类 || fallback || '', '');
    if (!分类) throw new Error(`副职业产物缺少分类：${String(物品名 || '未命名').trim() || '未命名'}`);
    return 分类;
  }
  复制JSON(值, fallback = {}) {
    if (值 === undefined || 值 === null) return fallback;
    try {
      return JSON.parse(JSON.stringify(值));
    } catch (错误) {
      return fallback;
    }
  }
  规范化物品经济品质(品质 = '', 物品名 = '', 分类 = '') {
    const 文本 = String(品质 || '').trim();
    if (副职业物品经济品质集合.has(文本)) return 文本;
    const 判定文本 = `${物品名} ${分类} ${文本}`;
    if (/超神器/.test(判定文本)) return '超神器';
    if (/神器|神级/.test(判定文本)) return '神器';
    if (/十万年|天锻|十二级|弑神|位面核心|极限斗罗|血脉核心|战略级/.test(判定文本)) return '传说';
    if (/万年|魂锻|灵锻|顶级|机密|高级|重型|最新型|九级|八级/.test(判定文本)) return '史诗';
    if (/千年|千锻|有灵合金|稀有|战术|秘密|特殊|特种|珍贵|军用/.test(判定文本)) return '稀有';
    if (/百年|黄级|优秀|高级制式/.test(判定文本)) return '优秀';
    return '普通';
  }
  按品质系数映射经济品质(品质系数 = 1) {
    const 数值 = Number(品质系数 || 1);
    if (数值 >= 1.5) return '史诗';
    if (数值 >= 1.25) return '稀有';
    if (数值 >= 1.1) return '优秀';
    return '普通';
  }
  读取背包批次列表(记录 = {}) {
    const 来源 = 记录 && typeof 记录 === 'object' && !Array.isArray(记录) ? 记录 : {};
    return (Array.isArray(来源.批次) ? 来源.批次 : []).filter(批次 => 批次 && typeof 批次 === 'object' && !Array.isArray(批次) && Number(批次.数量 || 0) > 0);
  }
  读取背包批次条目列表(记录 = {}) {
    const 来源 = 记录 && typeof 记录 === 'object' && !Array.isArray(记录) ? 记录 : {};
    return (Array.isArray(来源.批次) ? 来源.批次 : [])
      .map((批次, 索引) => ({ 批次, 索引 }))
      .filter(项 => 项.批次 && typeof 项.批次 === 'object' && !Array.isArray(项.批次) && Number(项.批次.数量 || 0) > 0);
  }
  读取背包普通数量(记录 = {}) {
    const 来源 = 记录 && typeof 记录 === 'object' && !Array.isArray(记录) ? 记录 : {};
    return Math.max(0, Math.floor(Number(来源.数量 || 0)));
  }
  读取背包总数量(记录 = {}) {
    const 来源 = 记录 && typeof 记录 === 'object' && !Array.isArray(记录) ? 记录 : {};
    const 普通数量 = this.读取背包普通数量(来源);
    const 批次数量 = this.读取背包批次列表(来源).reduce((总数, 批次) => 总数 + Math.max(0, Math.floor(Number(批次.数量 || 0))), 0);
    return 普通数量 + 批次数量;
  }
  读取首个背包批次(记录 = {}) {
    return this.读取背包批次列表(记录)[0] || null;
  }
  编码材料引用(物品名 = '', 批次索引 = -1) {
    return JSON.stringify({ 物品名: String(物品名 || '').trim(), 批次索引: Number.isFinite(Number(批次索引)) ? Math.floor(Number(批次索引)) : -1 });
  }
  解码材料引用(引用 = '') {
    const 文本 = String(引用 || '').trim();
    if (!文本) return { 物品名: '', 批次索引: -1 };
    try {
      const 数据 = JSON.parse(文本);
      if (数据 && typeof 数据 === 'object' && !Array.isArray(数据)) {
        return {
          物品名: String(数据.物品名 || '').trim(),
          批次索引: Number.isFinite(Number(数据.批次索引)) ? Math.floor(Number(数据.批次索引)) : -1,
        };
      }
    } catch (错误) {}
    return { 物品名: 文本, 批次索引: -1 };
  }
  取材料原名(引用 = '') {
    return this.解码材料引用(引用).物品名;
  }
  读取材料上下文(引用 = '') {
    const 解析 = this.解码材料引用(引用);
    const 物品名 = 解析.物品名;
    if (!物品名) return null;
    const 命中 = this.查找物品定义(物品名);
    const 背包记录 = this.currentInventory?.[物品名] || {};
    if (解析.批次索引 >= 0) {
      const 批次 = Array.isArray(背包记录.批次) ? 背包记录.批次[解析.批次索引] : null;
      const 数量 = Math.max(0, Math.floor(Number(批次?.数量 || 0)));
      return {
        引用,
        物品名,
        批次索引: 解析.批次索引,
        数量,
        物品: { ...(命中?.定义 || {}), 物品分类: 命中?.分类 || '', ...(批次 || {}), 数量 },
      };
    }
    const 数量 = this.读取背包普通数量(背包记录);
    const 首批 = 数量 > 0 ? null : this.读取首个背包批次(背包记录);
    return {
      引用,
      物品名,
      批次索引: 数量 > 0 ? -1 : (首批 ? 0 : -1),
      数量: 数量 > 0 ? 数量 : this.读取背包总数量(背包记录),
      物品: { ...(命中?.定义 || {}), 物品分类: 命中?.分类 || '', ...(数量 > 0 ? {} : (首批 || {})), 数量: 数量 > 0 ? 数量 : this.读取背包总数量(背包记录) },
    };
  }
  构建材料显示名(引用 = '', 数量 = 1) {
    const 上下文 = this.读取材料上下文(引用);
    const 名称 = 上下文?.物品名 || this.取材料原名(引用);
    if (!名称) return '';
    return `${Math.max(1, Number(数量 || 1))}份${名称}`;
  }
  规范化背包批次(来源批次 = {}, 数量 = 1, fallback = {}) {
    const 来源 = 来源批次 && typeof 来源批次 === 'object' && !Array.isArray(来源批次) ? 来源批次 : {};
    const 有耐久 = 来源.耐久 !== undefined || fallback.耐久 !== undefined;
    const 输出 = {
      数量: Math.max(0, Math.floor(Number(数量 ?? 来源.数量 ?? 0))),
      品质: this.规范化物品经济品质(来源.品质 ?? fallback.品质, fallback.物品名 || '', fallback.分类 || ''),
      品质系数: Math.max(0.1, Math.min(2, Number(来源.品质系数 ?? fallback.品质系数 ?? 1))),
      基础金属: String(来源.基础金属 ?? fallback.基础金属 ?? '').trim(),
      耐久: Math.max(0, Math.floor(Number(来源.耐久 ?? fallback.耐久 ?? 0))),
      剩余使用次数: Math.max(0, Math.floor(Number(来源.剩余使用次数 ?? fallback.剩余使用次数 ?? fallback.基础使用次数 ?? 0))),
      魂导等级: Math.max(0, Math.min(12, Math.floor(Number(来源.魂导等级 ?? fallback.魂导等级 ?? 0)))),
      基础耐久: Math.max(0, Math.floor(Number(来源.基础耐久 ?? fallback.基础耐久 ?? 0))),
      基础使用次数: Math.max(0, Math.floor(Number(来源.基础使用次数 ?? fallback.基础使用次数 ?? 0))),
      绑定者: String(来源.绑定者 ?? fallback.绑定者 ?? '').trim(),
      有效期至tick: Math.max(0, Math.floor(Number(来源.有效期至tick ?? fallback.有效期至tick ?? 0))),
    };
    if (来源.属性加成 && typeof 来源.属性加成 === 'object' && !Array.isArray(来源.属性加成)) 输出.属性加成 = this.复制JSON(来源.属性加成, {});
    else if (fallback.属性加成 && typeof fallback.属性加成 === 'object' && !Array.isArray(fallback.属性加成)) 输出.属性加成 = this.复制JSON(fallback.属性加成, {});
    if (来源.装备技能 && typeof 来源.装备技能 === 'object' && !Array.isArray(来源.装备技能)) 输出.装备技能 = this.复制JSON(来源.装备技能, {});
    else if (fallback.装备技能 && typeof fallback.装备技能 === 'object' && !Array.isArray(fallback.装备技能)) 输出.装备技能 = this.复制JSON(fallback.装备技能, {});
    if (Array.isArray(来源.使用效果) && 来源.使用效果.length) 输出.使用效果 = this.复制JSON(来源.使用效果, []);
    else if (Array.isArray(fallback.使用效果) && fallback.使用效果.length) 输出.使用效果 = this.复制JSON(fallback.使用效果, []);
    const 融合参数 = 来源?.副职业参数?.融合参数 || fallback?.副职业参数?.融合参数;
    if (
      融合参数 &&
      typeof 融合参数 === 'object' &&
      !Array.isArray(融合参数) &&
      (融合参数.数量 !== undefined || 融合参数.融合率 !== undefined)
    ) {
      输出.副职业参数 = {
        融合参数: {
          数量: Math.max(1, Math.floor(Number(融合参数.数量 || 1))),
          融合率: Math.max(0, Math.min(100, Math.floor(Number(融合参数.融合率 ?? 100)))),
        },
      };
    }
    Object.keys(输出).forEach(键 => {
      const 值 = 输出[键];
      if (
        键 !== '数量' &&
        (值 === '' ||
          值 === '无' ||
          (键 !== '耐久' && 值 === 0) ||
          (键 === '耐久' && !有耐久) ||
          (键 === '剩余使用次数' && !(来源.剩余使用次数 !== undefined || fallback.剩余使用次数 !== undefined || Number(fallback.基础使用次数 || 0) > 0)) ||
          (键 === '魂导等级' && !(Number(来源.魂导等级 ?? fallback.魂导等级 ?? 0) > 0)) ||
          (键 === '基础耐久' && !(来源.基础耐久 !== undefined || fallback.基础耐久 !== undefined)) ||
          (键 === '基础使用次数' && !(来源.基础使用次数 !== undefined || fallback.基础使用次数 !== undefined)) ||
          (键 === '品质' && 值 === '普通') ||
          (键 === '品质系数' && Number(值) === 1) ||
          (Array.isArray(值) && !值.length) ||
          (值 && typeof 值 === 'object' && !Array.isArray(值) && !Object.keys(值).length))
      ) delete 输出[键];
    });
    return 输出.数量 > 0 ? 输出 : null;
  }
  需要批次入库(数据 = {}) {
    const 来源 = 数据 && typeof 数据 === 'object' && !Array.isArray(数据) ? 数据 : {};
    if (Array.isArray(来源.批次) && 来源.批次.length) return true;
    if (来源.品质系数 !== undefined && Number(来源.品质系数) !== 1) return true;
    if (
      来源.副职业参数?.融合参数 &&
      typeof 来源.副职业参数.融合参数 === 'object' &&
      !Array.isArray(来源.副职业参数.融合参数) &&
      (来源.副职业参数.融合参数.数量 !== undefined || 来源.副职业参数.融合参数.融合率 !== undefined)
    ) return true;
    if (来源.耐久 !== undefined && Number(来源.耐久) > 0) return true;
    if (来源.剩余使用次数 !== undefined || Number(来源.基础使用次数 || 0) > 0) return true;
    if (String(来源.基础金属 || '').trim()) return true;
    if (Number(来源.魂导等级 || 0) > 0) return true;
    if (来源.基础耐久 !== undefined) return true;
    if (来源.属性加成 && typeof 来源.属性加成 === 'object' && !Array.isArray(来源.属性加成) && Object.keys(来源.属性加成).length) return true;
    if (来源.装备技能 && typeof 来源.装备技能 === 'object' && !Array.isArray(来源.装备技能) && Object.keys(来源.装备技能).length) return true;
    if (Array.isArray(来源.使用效果) && 来源.使用效果.length) return true;
    if (String(来源.绑定者 || '').trim()) return true;
    if (Number(来源.有效期至tick || 0) > 0) return true;
    return false;
  }
  构建入库批次列表(数据 = {}, 数量 = 1, fallback = {}) {
    const 来源 = 数据 && typeof 数据 === 'object' && !Array.isArray(数据) ? 数据 : {};
    if (Array.isArray(来源.批次) && 来源.批次.length) {
      let 剩余 = Math.max(0, Math.floor(Number(数量 || 0)));
      const 批次列表 = [];
      来源.批次.forEach(批次 => {
        if (剩余 <= 0) return;
        const 可取 = Math.min(剩余, Math.max(0, Math.floor(Number(批次?.数量 || 0))));
        const 新批次 = this.规范化背包批次(批次, 可取, fallback);
        if (新批次) {
          批次列表.push(新批次);
          剩余 -= 可取;
        }
      });
      return 批次列表;
    }
    if (!this.需要批次入库(来源)) return [];
    const 批次 = this.规范化背包批次(来源, 数量, fallback);
    return 批次 ? [批次] : [];
  }
  构建背包扣减值(记录 = {}, 数量 = 1) {
    if (!记录 || typeof 记录 !== 'object' || Array.isArray(记录)) return null;
    const 当前 = this.复制JSON(记录, {});
    let 剩余扣减 = Math.max(1, Math.floor(Number(数量 || 1)));
    const 批次列表 = this.读取背包批次列表(当前).map(批次 => this.复制JSON(批次, {}));
    for (const 批次 of 批次列表) {
      if (剩余扣减 <= 0) break;
      const 当前批次数量 = Math.max(0, Math.floor(Number(批次.数量 || 0)));
      const 扣减 = Math.min(当前批次数量, 剩余扣减);
      批次.数量 = 当前批次数量 - 扣减;
      剩余扣减 -= 扣减;
    }
    当前.批次 = 批次列表.filter(批次 => Math.max(0, Number(批次.数量 || 0)) > 0);
    const 普通数量 = Math.max(0, Math.floor(Number(当前.数量 || 0)));
    if (剩余扣减 > 0) {
      当前.数量 = Math.max(0, 普通数量 - 剩余扣减);
      剩余扣减 = Math.max(0, 剩余扣减 - 普通数量);
    } else {
      当前.数量 = 普通数量;
    }
    if (!当前.批次.length) delete 当前.批次;
    if (当前.数量 <= 0 && !当前.批次) return null;
    if (当前.数量 <= 0 && 当前.批次) 当前.数量 = 0;
    return 当前;
  }
  构建背包指定扣减值(记录 = {}, 数量 = 1, 批次索引 = null) {
    if (批次索引 === null || 批次索引 === undefined) return this.构建背包扣减值(记录, 数量);
    if (!记录 || typeof 记录 !== 'object' || Array.isArray(记录)) return null;
    const 当前 = this.复制JSON(记录, {});
    const 扣减数量 = Math.max(1, Math.floor(Number(数量 || 1)));
    if (Number(批次索引) >= 0) {
      const 索引 = Math.floor(Number(批次索引));
      const 批次列表 = Array.isArray(当前.批次) ? 当前.批次.map(批次 => this.复制JSON(批次, {})) : [];
      if (!批次列表[索引]) return this.读取背包总数量(当前) > 0 ? 当前 : null;
      批次列表[索引].数量 = Math.max(0, Math.floor(Number(批次列表[索引].数量 || 0)) - 扣减数量);
      当前.批次 = 批次列表.filter(批次 => Math.max(0, Number(批次?.数量 || 0)) > 0);
      if (!当前.批次.length) delete 当前.批次;
      if (当前.数量 === undefined) 当前.数量 = 0;
    } else {
      当前.数量 = Math.max(0, Math.floor(Number(当前.数量 || 0)) - 扣减数量);
    }
    if (当前.数量 <= 0 && !当前.批次) return null;
    if (当前.数量 <= 0 && 当前.批次) 当前.数量 = 0;
    return 当前;
  }
  resolveInventoryItem(name = '') {
    const 上下文 = this.读取材料上下文(name);
    if (上下文?.物品名 && 上下文.批次索引 >= 0) return 上下文.物品;
    const 物品名 = 上下文?.物品名 || String(name || '').trim();
    const 命中 = this.查找物品定义(物品名);
    const 背包记录 = this.currentInventory?.[物品名] || {};
    const 首批 = this.读取首个背包批次(背包记录);
    return {
      ...(命中?.定义 || {}),
      物品分类: 命中?.分类 || '',
      ...(背包记录 || {}),
      ...(首批 || {}),
      数量: this.读取背包总数量(背包记录),
    };
  }

  构建修理目标背包状态(targetName = '', definition = {}, repairDesc = {}) {
    const 现有记录 = this.currentInventory[targetName] && typeof this.currentInventory[targetName] === 'object' && !Array.isArray(this.currentInventory[targetName])
      ? this.复制JSON(this.currentInventory[targetName], {})
      : {};
    const 基础耐久 = Math.max(100, Math.floor(Number(definition?.基础耐久 || 100)));
    const 批次 = {
      数量: Math.max(1, Math.floor(Number(现有记录.数量 || 1))),
      品质: this.规范化物品经济品质(definition?.品质 || '普通', targetName, definition?.物品分类 || definition?.分类 || ''),
      耐久: 基础耐久,
    };
    const 首批 = this.读取首个背包批次(现有记录);
    if (首批?.品质系数 !== undefined) 批次.品质系数 = 首批.品质系数;
    if (首批?.副职业参数?.融合参数) 批次.副职业参数 = { 融合参数: this.复制JSON(首批.副职业参数.融合参数, {}) };
    if (首批?.绑定者) 批次.绑定者 = 首批.绑定者;
    if (Number(首批?.有效期至tick || 0) > 0) 批次.有效期至tick = Number(首批.有效期至tick);
    const 已有批次 = this.读取背包批次列表(现有记录).map(项 => this.复制JSON(项, {}));
    if (已有批次.length) {
      已有批次[0] = { ...已有批次[0], 耐久: 基础耐久 };
      return { 数量: 0, 批次: 已有批次 };
    }
    return { 数量: 0, 批次: [批次] };
  }

  追加修理写回补丁(patchOps = [], targetName = '', definition = {}, repairDesc = {}) {
    patchOps.push({
      op: 'replace',
      path: `${this.activeCharBasePath}/背包/${this.escapeJsonPointer(targetName)}`,
      value: this.构建修理目标背包状态(targetName, definition, repairDesc),
    });
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

  读取副职业显示名(jobName = '') {
    return ({ 制造师: '机甲制造师', 设计师: '机甲设计师', 修理师: '机甲修理师' })[String(jobName || '').trim()] || String(jobName || '').trim();
  }

  updateModeChrome() {
    const cfg = PROFESSION_CONFIG[this.activeMode];
    this.$('#prof-ui-title').textContent = cfg.title;
    this.$('#prof-ui-subtitle').textContent = `${cfg.displayName} / ${this.读取副职业显示名(cfg.jobName)}`;
    this.$('#materials-hint').textContent = cfg.materialHint;
    this.$('#target-hint').textContent = cfg.targetHint;
    this.$('#prof-submit').textContent = cfg.actionLabel;
    this.updateTierOptions();
    this.$('#qty-hint').textContent = this.activeMode === 'forge'
      ? '锻造会按“每种材料消耗量”扣除材料，并同步扣除副职业资源。'
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
    const 阶位 = Math.max(1, Number(tier || 1));
    if (阶位 >= 5) return '传说';
    if (阶位 >= 4) return '史诗';
    if (阶位 >= 3) return '稀有';
    if (阶位 >= 2) return '优秀';
    return '普通';
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

  // --- 副职业算法核心 ---
  clamp(num, min, max) { return Math.max(min, Math.min(max, num)); }
  formatFedCoin(amount) { return `${Number(amount || 0).toLocaleString()} 联邦币`; }
  escapeJsonPointer(str) { return String(str).replace(/~/g, '~0').replace(/\//g, '~1'); }

  读取核心技艺文本(副职业名, 等级) {
    return this.读取副职业派生接口().读取核心技艺文本(副职业名, 等级);
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

  读取副职业认证运行时(jobName, charObj = this.charData) {
    const job = charObj?.副职业?.[jobName] || {};
    const 派生接口 = this.读取副职业派生接口();
    const 派生运行时 = 派生接口.派生运行时(jobName, job);
    const lv = Math.max(0, Math.floor(Number(派生运行时.等级 || 0)));
    const totalExp = Math.max(0, Math.floor(Number(派生运行时.经验 || 0)));
    const 经验阈值 = Array.isArray(派生接口.经验阈值) ? 派生接口.经验阈值 : [];
    const cExp = 经验阈值[Math.max(0, Math.min(lv, 9) - 1)] || 0;
    const nExp = lv >= 10 ? 0 : (经验阈值[Math.min(lv, 9)] || 经验阈值[9] || 0);
    return {
      jobName,
      job,
      lv,
      认证等级: lv,
      exp: totalExp,
      expRatio: Number(派生运行时.本级进度 || 0),
      limitSuccessRate: Number(派生运行时.基础成功率 || 0),
      经验成功率加成: Number(派生运行时.经验成功率加成 || 0),
      maxFusion: Number(派生运行时.最高支持融锻数 || 1),
      支持融锻文本: String(派生运行时.支持融锻数 || '未开放'),
      核心技艺文本: String(派生运行时.核心技艺 || this.读取核心技艺文本(jobName, lv)),
      currentBaseExp: cExp,
      nextLevelExp: nExp,
      有效等级来源: '本职',
      魂导师等级: 0,
      魂导师解锁等级: 0,
    };
  }

  getJobRuntime(jobName, charObj = this.charData) {
    const 派生接口 = this.读取副职业派生接口();
    const 基础运行时 = this.读取副职业认证运行时(jobName, charObj);
    const 魂导师运行时 = this.读取副职业认证运行时('魂导师', charObj);
    const 魂导师解锁等级 = ['锻造师', '设计师', '制造师'].includes(String(jobName || '').trim()) && typeof 派生接口.读取魂导师解锁能力等级 === 'function'
      ? Math.max(0, Math.floor(Number(派生接口.读取魂导师解锁能力等级(魂导师运行时.lv, jobName) || 0)))
      : 0;
    if (魂导师解锁等级 <= 基础运行时.lv) return { ...基础运行时, 魂导师等级: 魂导师运行时.lv, 魂导师解锁等级 };
    const 有效经验 = 魂导师运行时.exp;
    const 有效进度 = typeof 派生接口.读取等级进度 === 'function' ? 派生接口.读取等级进度(魂导师解锁等级, 有效经验) : 0;
    return {
      ...基础运行时,
      lv: 魂导师解锁等级,
      exp: 有效经验,
      expRatio: 有效进度,
      limitSuccessRate: typeof 派生接口.读取基础成功率 === 'function' ? 派生接口.读取基础成功率(魂导师解锁等级, 有效经验) : 基础运行时.limitSuccessRate,
      maxFusion: typeof 派生接口.读取最高支持融锻数 === 'function' ? 派生接口.读取最高支持融锻数(魂导师解锁等级) : 基础运行时.maxFusion,
      支持融锻文本: this.读取支持融锻文本(魂导师解锁等级),
      核心技艺文本: this.读取核心技艺文本(jobName, 魂导师解锁等级),
      有效等级来源: '魂导师',
      魂导师等级: 魂导师运行时.lv,
      魂导师解锁等级,
    };
  }

  buildOfficialCommissionRuntime(jobName) {
    return { jobName, job: {}, lv: 9, exp: 99999999, expRatio: 1, limitSuccessRate: 85, maxFusion: 3, 支持融锻文本: '协会固定支持 3 级复合工序', 核心技艺文本: this.读取核心技艺文本(jobName, 9), currentBaseExp: 0, nextLevelExp: 0 };
  }

  读取本次作品认证等级(jobName, tier) {
    const runtime = this.读取副职业认证运行时(jobName);
    const 当前等级 = Math.max(0, Math.floor(Number(runtime.lv || 0)));
    const 目标解锁等级 = this.getForgeUnlockLevel(tier);
    const 派生接口 = this.读取副职业派生接口();
    const 最高等级 = typeof 派生接口.读取最高等级 === 'function' ? Math.max(0, Math.floor(Number(派生接口.读取最高等级(jobName) || 0))) : 9;
    if (目标解锁等级 === 当前等级 + 1) return Math.min(目标解锁等级, 最高等级);
    if (当前等级 === 目标解锁等级 && 当前等级 < 最高等级) return 当前等级 + 1;
    return 0;
  }

  读取魂导器制造进度副职业(targetName = '', materialNames = []) {
    return this.读取目标魂导等级(targetName, materialNames) > 0 ? '魂导师' : '';
  }

  读取本次进度副职业(cfg = {}, targetName = '', materialNames = []) {
    if (cfg.mode === 'manufacture') return this.读取魂导器制造进度副职业(targetName, materialNames) || cfg.jobName;
    return cfg.jobName;
  }

  读取本次工序显示名(cfg = {}, targetName = '', materialNames = []) {
    return cfg.mode === 'manufacture' && this.读取目标魂导等级(targetName, materialNames) > 0 ? '魂导器制造' : cfg.displayName;
  }

  读取本次进度作品等级(jobName, tier, targetName = '', materialNames = []) {
    if (String(jobName || '').trim() === '魂导师') return Math.min(10, this.读取目标魂导等级(targetName, materialNames));
    return this.读取本次作品认证等级(jobName, tier);
  }

  getItemTier(itemName) {
    const 原名 = this.取材料原名(itemName) || String(itemName || '').trim();
    const 定义阶位 = Number(this.查找物品定义(原名)?.定义?.阶位 || 0);
    if (定义阶位 > 0) return Math.max(1, Math.floor(定义阶位));
    if (/天锻|四字|十万年/.test(原名)) return 5;
    if (/魂锻|三字|红级/.test(原名)) return 4;
    if (/灵锻|二字|黑级/.test(原名)) return 3;
    if (/千锻|一字|紫级/.test(原名)) return 2;
    return 1;
  }

  getForgeUnlockLevel(tier) { return [1, 3, 5, 7, 9][tier - 1] || 99; }
  getForgeFusionUnlockLevel(tier) { return [0, 4, 6, 7, 9][tier - 1] || 99; }

  getSingleTierSuccessRate(tier, runtime) {
    const { lv, expRatio } = runtime;
    const uLv = this.getForgeUnlockLevel(tier);
    if (tier === 5) {
      if (lv >= 9) return 20 + Math.floor(expRatio * 30);
      return uLv === lv + 1 ? this.clamp(Number(runtime.limitSuccessRate || 0), 0, 60) : 0;
    }
    if (lv < uLv) return uLv === lv + 1 ? this.clamp(Number(runtime.limitSuccessRate || 0), 0, 60) : 0;
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
  getGenericSingleRate(runtime, tier = 0) {
    const lv = Math.max(0, Math.floor(Number(runtime?.lv || 0)));
    const expRatio = Math.max(0, Number(runtime?.expRatio || 0));
    const uLv = this.getForgeUnlockLevel(tier);
    if (!(uLv > 0 && uLv < 99)) return this.clamp(runtime.limitSuccessRate, 0, 100);
    if (lv < uLv) return uLv === lv + 1 ? this.clamp(Number(runtime.limitSuccessRate || 0), 0, 60) : 0;
    if (lv === uLv) return 30 + Math.floor(expRatio * 30);
    if (lv === uLv + 1) return 80 + Math.floor(expRatio * 20);
    return 100;
  }

  getSoulToolSingleRate(runtime, 魂导等级 = 0) {
    const lv = this.读取运行时魂导师等级(runtime);
    const expRatio = Math.max(0, Number(runtime?.expRatio || 0));
    const 目标等级 = Math.max(0, Math.min(10, Math.floor(Number(魂导等级 || 0))));
    if (!(目标等级 > 0)) return 0;
    if (目标等级 >= 10) return lv >= 10 ? 30 + Math.floor(expRatio * 30) : 0;
    if (lv < 目标等级) return 目标等级 === lv + 1 ? this.clamp(Number(runtime.limitSuccessRate || 0), 0, 60) : 0;
    if (lv === 目标等级) return 30 + Math.floor(expRatio * 30);
    if (lv === 目标等级 + 1) return 80 + Math.floor(expRatio * 20);
    return 100;
  }

  读取运行时魂导师等级(runtime = {}) {
    const 有魂导师字段 = runtime && typeof runtime === 'object' && Object.prototype.hasOwnProperty.call(runtime, '魂导师等级');
    return Math.max(0, Math.floor(Number(有魂导师字段 ? runtime.魂导师等级 : runtime?.lv || 0)));
  }

  读取本次执行运行时(cfg = {}, runtime = {}, commissionCtx = {}, targetName = '', materialNames = []) {
    if (cfg.mode !== 'manufacture' || this.读取目标魂导等级(targetName, materialNames) <= 0) return runtime;
    if (commissionCtx?.isOfficial) return { ...runtime, lv: 0, exp: 0, expRatio: 0, limitSuccessRate: 0, maxFusion: 1, 支持融锻文本: '未开放', 魂导师等级: 0, 魂导师解锁等级: 0 };
    const 执行者角色 = commissionCtx?.isPrivate && commissionCtx.targetChar ? commissionCtx.targetChar : this.charData;
    const 魂导师运行时 = this.读取副职业认证运行时('魂导师', 执行者角色);
    return { ...魂导师运行时, 魂导师等级: 魂导师运行时.lv, 魂导师解锁等级: 魂导师运行时.lv, 有效等级来源: '魂导师' };
  }

  hasBlueprintMaterial(materialNames) {
    return materialNames.some(name => /设计图|蓝图|模板/.test(this.取材料原名(name)) || this.resolveInventoryItem(name)?.物品分类 === '设计图纸');
  }

  getArmorBlueprintNameByTier(tier) { return { 2: '一字斗铠设计图', 3: '二字斗铠设计图', 4: '三字斗铠设计图', 5: '四字斗铠设计图' }[tier] || `${this.getGearTierFamilyLabel(tier)}设计图`; }
  getArmorTierFromName(name) { return /一字/.test(name) ? 2 : (/二字/.test(name) ? 3 : (/三字/.test(name) ? 4 : (/四字/.test(name) ? 5 : 0))); }
  getTierMetalLabel(tier) { return { 1: '百锻金属', 2: '千锻金属', 3: '灵锻金属', 4: '魂锻金属', 5: '天锻金属' }[tier] || `${this.getForgeTierLabel(tier)}金属`; }

  读取中文等级数字(文本 = '') {
    const 匹配 = String(文本 || '').match(/(十二|十一|十|九|八|七|六|五|四|三|二|一)级/);
    if (!匹配) return 0;
    return { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 十一: 11, 十二: 12 }[匹配[1]] || 0;
  }

  读取目标魂导等级(targetName = '', materialNames = []) {
    const 名称 = String(targetName || '').trim();
    const 定义 = this.查找物品定义(名称)?.定义 || {};
    const 判定文本 = `${名称} ${定义.描述 || ''}`;
    if (!/魂导|奶瓶|定装|炮弹|炸弹/.test(判定文本) && !(Number(定义.魂导等级 || 0) > 0)) return 0;
    const 定义等级 = Math.max(0, Math.floor(Number(定义.魂导等级 || 0)));
    if (定义等级 > 0) return Math.max(1, Math.min(12, 定义等级));
    const 数字匹配 = 判定文本.match(/(\d{1,2})\s*级/);
    if (数字匹配) return Math.max(1, Math.min(12, Math.floor(Number(数字匹配[1] || 0))));
    const 中文等级 = this.读取中文等级数字(判定文本);
    if (中文等级 > 0) return 中文等级;
    for (const 材料名 of materialNames) {
      const 材料定义 = this.resolveInventoryItem(材料名) || {};
      const 材料等级 = Math.max(0, Math.floor(Number(材料定义.魂导等级 || 0)));
      if (材料等级 > 0) return Math.max(1, Math.min(12, 材料等级));
    }
    return 0;
  }

  读取魂导器金属阶位(魂导等级 = 0) {
    const 等级 = Math.max(0, Math.floor(Number(魂导等级 || 0)));
    if (等级 <= 0) return 0;
    if (等级 <= 2) return 1;
    if (等级 <= 4) return 2;
    if (等级 <= 6) return 3;
    if (等级 <= 10) return 4;
    return 0;
  }

  读取魂导器制造耗时文本(魂导等级 = 0) {
    const 等级 = Math.max(0, Math.floor(Number(魂导等级 || 0)));
    if (等级 >= 10) return '首次制造约5年';
    if (等级 >= 9) return '首次制造约半年';
    return '常规工坊周期';
  }

  getSelectedTierStock(materialNames) {
    const totals = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const name of materialNames) {
      totals[this.getItemTier(name)] += Math.max(0, Number(this.读取材料上下文(name)?.数量 || 0));
    }
    return totals;
  }

  getManufactureRecipe(targetName, materialNames, tier, qty = 1) {
    const state = this.getCurrentUiState();
    const materialOriginalNames = materialNames.map(name => this.取材料原名(name));
    const 魂导等级 = this.读取目标魂导等级(targetName, materialNames);
    if (魂导等级 > 0) {
      if (魂导等级 >= 11) return { mode: 'soul_tool_array', 魂导等级, note: '11-12级魂导器属于9级图纸/部件/魂导师团队阵列工程，不开放单人制造配方' };
      const expectedTier = this.读取魂导器金属阶位(魂导等级);
      return { mode: 'soul_tool', 魂导等级, expectedTier, note: `${魂导等级}级魂导器制造：需要${this.getTierMetalLabel(expectedTier)}，${this.读取魂导器制造耗时文本(魂导等级)}` };
    }
    const isMech = state.subtype === 'mech' || /机甲/.test(targetName);
    const isArmor = state.subtype === 'armor' || /斗铠|一字|二字|三字|四字/.test(targetName) || materialOriginalNames.some(name => /斗铠设计图/.test(name));

    if (isMech) {
      if (tier === 1 || /黄级/.test(targetName)) return { mode: 'mech', fixedTierNeeds: { 2: 1, 1: 50 }, expectedTier: 1, note: '固定配方：1份千锻金属 + 50份百锻金属' };
      if (tier === 2 || /紫级/.test(targetName)) return { mode: 'mech', fixedTierNeeds: { 3: 1, 1: 40 }, expectedTier: 2, note: '固定配方：1份灵锻金属 + 40份百锻金属' };
      if (tier === 3 || /黑级/.test(targetName)) return { mode: 'mech', fixedTierNeeds: { 4: 1, 2: 30 }, expectedTier: 3, note: '固定配方：1份魂锻金属 + 30份千锻金属' };
      if (tier === 4 || /红级/.test(targetName)) return { mode: 'mech', fixedTierNeeds: { 5: 1, 4: 10, 3: 10 }, expectedTier: 4, note: '固定配方：1份天锻金属 + 10份魂锻 + 10份灵锻' };
    }
    
    if (isArmor) {
      const blueprintName = this.getArmorBlueprintNameByTier(tier);
      const blueprint = materialNames.find(name => this.取材料原名(name) === blueprintName) || '';
      const isChest = /胸/.test(targetName);
      const metalCount = isChest ? 3 : 2;
      return { mode: 'armor', blueprint, blueprintName, blueprintCost: 1, variableQty: metalCount, note: `斗铠制造：固定消耗【${blueprintName}】1张 + ${metalCount}块同阶金属 (胸铠3块，其余2块)` };
    }
    return null;
  }

  是配方蓝图材料(材料引用 = '', recipe = null) {
    if (!recipe?.blueprintName) return false;
    return this.取材料原名(材料引用) === recipe.blueprintName;
  }

  buildTierNeedConsumePlan(materialNames, tierNeeds) {
    const plan = {};
    for (const tierKey of Object.keys(tierNeeds)) {
      const tier = Number(tierKey);
      let remaining = Number(tierNeeds[tierKey] || 0);
      for (const name of materialNames) {
        if (remaining <= 0) break;
        if (this.getItemTier(name) !== tier) continue;
        const available = Math.max(0, Number(this.读取材料上下文(name)?.数量 || 0)) - Number(plan[name] || 0);
        const take = Math.min(available, remaining);
        if (take > 0) { plan[name] = Number(plan[name] || 0) + take; remaining -= take; }
      }
      if (remaining > 0) return null;
    }
    return plan;
  }

  getManufactureOutputMeta(targetName, materialNames, tier) {
    const 魂导等级 = this.读取目标魂导等级(targetName, materialNames);
    if (魂导等级 > 0) {
      if (/奶瓶|定装|炮弹|炸弹/.test(targetName)) return { name: targetName, 分类: '一次性道具', 魂导等级 };
      if (/防具|护具|护罩|护盾|屏障|生命维持/.test(targetName)) return { name: targetName, 分类: '防具装备', 魂导等级 };
      if (/高频|震荡|光剑|刀|剑|锤|刃|矛|戟|匕首/.test(targetName)) return { name: targetName, 分类: '近战武器', 魂导等级 };
      if (/枪|射线|炮|狙击|弓|弩|炮台/.test(targetName)) return { name: targetName, 分类: '远程武器', 魂导等级 };
      return { name: targetName, 分类: '功能道具', 魂导等级 };
    }
    const armorBlueprint = materialNames.map(name => this.取材料原名(name)).find(name => /(一字|二字|三字|四字)斗铠设计图/.test(name));
    if (armorBlueprint) return { name: armorBlueprint.replace('设计图', ''), 分类: '斗铠部件' };
    if (/机甲/.test(targetName)) return { name: /黄级|紫级|黑级|红级/.test(targetName) ? targetName : ({ 1: '黄级机甲组件', 2: '紫级机甲组件', 3: '黑级机甲组件', 4: '红级机甲组件' }[tier] || targetName), 分类: '机甲机体' };
    if (/防具|护具|护甲|护服|防护服|胸甲|铠甲|护心镜|护盾|盾牌/.test(targetName)) return { name: targetName, 分类: '防具装备' };
    if (/魂导.*枪|射线枪|手炮|狙击|炮|弓|弩|弹|炸弹|炮台/.test(targetName)) return { name: targetName, 分类: '远程武器' };
    if (/武器|剑|刀|枪|锤|棍|刃|矛|戟|匕首/.test(targetName)) return { name: targetName, 分类: '近战武器' };
    return { name: targetName, 分类: '功能道具' };
  }

  读取具体金属名(名称 = '') {
    const 文本 = String(名称 || '').trim();
    if (!文本) return '';
    const 金属表 = this.itemDefinitions?.锻造金属 && typeof this.itemDefinitions.锻造金属 === 'object' ? this.itemDefinitions.锻造金属 : {};
    if (金属表[文本]) return 文本;
    return Object.keys(金属表).find(金属名 => 文本.includes(金属名)) || '';
  }

  读取材料基础金属名(材料引用 = '') {
    const 上下文 = this.读取材料上下文(材料引用);
    const 物品 = 上下文?.物品 || {};
    const 批次基础金属 = this.读取具体金属名(物品.基础金属);
    if (批次基础金属) return 批次基础金属;
    if (物品.物品分类 !== '锻造金属') return '';
    const 原名 = this.取材料原名(材料引用);
    if (/金属块/.test(原名)) return '';
    return this.读取具体金属名(原名);
  }

  读取金属特性列表(金属名 = '') {
    const 名称 = this.读取具体金属名(金属名);
    const 定义 = 名称 ? this.itemDefinitions?.锻造金属?.[名称] : null;
    return Array.isArray(定义?.金属特性)
      ? [...new Set(定义.金属特性.map(特性 => String(特性 || '').trim()).filter(Boolean))]
      : [];
  }

  读取工坊金属上下文(targetName = '', materialNames = []) {
    const 基础金属列表 = [...new Set(materialNames.map(材料 => this.读取材料基础金属名(材料)).filter(Boolean))];
    const 目标金属 = this.读取具体金属名(targetName);
    const 特性来源 = [...new Set([...基础金属列表, 目标金属].filter(Boolean))];
    const 金属特性 = [...new Set(特性来源.flatMap(金属名 => this.读取金属特性列表(金属名)))];
    return { 基础金属列表, 目标金属, 金属特性 };
  }

  构建金属特性装备技能(特性集合, 强度) {
    const 效果数组 = [];
    if (特性集合.has('防御穿透')) 效果数组.push({ 原型: '结算修正', 目标: '自身', 结算: '防御穿透', 数值: `+${Math.min(35, 强度 * 5)}%` });
    if (特性集合.has('气息隔绝')) 效果数组.push({ 原型: '判定修正', 目标: '自身', 判定: '隐匿', 数值: `+${Math.min(30, 强度 * 4)}` });
    if (特性集合.has('空间亲和')) 效果数组.push({ 原型: '判定修正', 目标: '自身', 判定: '闪避', 数值: `+${Math.min(25, 强度 * 3)}` });
    if (!效果数组.length) return {};
    return {
      金属特性: {
        魂技名: '金属特性',
        消耗: '无',
        前摇: 0,
        _效果数组: 效果数组,
      },
    };
  }

  构建工坊产物批次数据(分类 = '', targetName = '', materialNames = [], tier = 1, 品质系数 = 1, 魂导等级 = 0) {
    const 上下文 = this.读取工坊金属上下文(targetName, materialNames);
    const 特性集合 = new Set(上下文.金属特性);
    const 输出 = {};
    const 目标基础金属 = 上下文.目标金属 || (上下文.基础金属列表.length === 1 ? 上下文.基础金属列表[0] : '');
    if (目标基础金属 && (分类 === '锻造金属' || /金属块/.test(targetName))) 输出.基础金属 = 目标基础金属;
    if (!特性集合.size) return Object.keys(输出).length ? 输出 : {};

    const 强度 = Math.max(1, Math.floor(Number(tier || 1)));
    const 质量倍率 = Math.max(0.8, Math.min(2, Number(品质系数 || 1)));
    const 数值 = Math.max(5, Math.round(强度 * 6 * 质量倍率));
    const 属性加成 = {};
    const 加属性 = (字段, 值) => { 属性加成[字段] = Math.round(Number(属性加成[字段] || 0) + 值); };

    ['高硬度', '极限硬度', '高韧性', '高坚固', '合金强化', '龙鳞化'].forEach(特性 => { if (特性集合.has(特性)) 加属性('防御', 数值); });
    ['高密度', '血脉共鸣'].forEach(特性 => { if (特性集合.has(特性)) 加属性('力量', 数值); });
    ['魂导传导', '魂力放大', '能量增幅', '元素增幅', '元素亲和', '法阵亲和', '七元素亲和', '多元素适配', '法则亲和', '武魂增幅'].forEach(特性 => { if (特性集合.has(特性)) 加属性('魂力上限', 数值); });
    ['空间亲和', '高延展'].forEach(特性 => { if (特性集合.has(特性)) 加属性('敏捷', Math.max(3, Math.round(数值 / 2))); });
    ['生命灵性', '活性灵性'].forEach(特性 => { if (特性集合.has(特性)) 加属性('体力上限', 数值); });
    if (特性集合.has('暗属性') || 特性集合.has('阴冷属性')) 加属性('精神力上限', Math.max(3, Math.round(数值 / 2)));

    if (副职业装备物品分类集合.has(分类)) {
      const 耐久加成 = ['高硬度', '极限硬度', '高韧性', '高坚固', '合金强化', '高密度', '龙鳞化'].filter(特性 => 特性集合.has(特性)).length;
      输出.基础耐久 = Math.max(100, Math.round((100 + 强度 * 80 + 耐久加成 * 40) * 质量倍率));
      输出.耐久 = 输出.基础耐久;
      if (Object.keys(属性加成).length) 输出.属性加成 = 属性加成;
      if (分类 === '近战武器') {
        输出.装备槽位 = '武器';
        const 装备技能 = this.构建金属特性装备技能(特性集合, 强度);
        if (Object.keys(装备技能).length) 输出.装备技能 = 装备技能;
      } else if (分类 === '防具装备') {
        输出.装备槽位 = '防具';
      }
      return 输出;
    }

    if (分类 === '远程武器') {
      const 等级 = Math.max(0, Math.floor(Number(魂导等级 || 0)));
      const 对应等级 = 等级 > 0 ? Math.min(120, 等级 * 10 + 9) : Math.min(99, 强度 * 20 + 19);
      const 穿透 = (特性集合.has('防御穿透') ? 12 : 0) + (特性集合.has('魂导传导') ? 5 : 0) + (特性集合.has('魂力放大') ? 5 : 0);
      const 威力倍率 = Math.round((100 + 强度 * 45 + (属性加成.魂力上限 || 0)) * 质量倍率);
      输出.基础使用次数 = /弹|炸弹/.test(targetName) ? 1 : 10;
      输出.剩余使用次数 = 输出.基础使用次数;
      输出.使用效果 = [{
        原型: '伤害结算',
        目标: /炮|炸弹|集束/.test(targetName) ? '群体' : '单体',
        类型: /暗属性|阴冷/.test(上下文.金属特性.join(' ')) ? '暗属性' : '能量',
        威力倍率,
        对应等级,
        段数: 1,
        防御穿透: Math.min(60, 穿透),
      }];
      return 输出;
    }

    if (副职业可使用物品分类集合.has(分类) && Object.keys(属性加成).length) {
      输出.使用效果 = Object.entries(属性加成).map(([属性, 数值加成]) => ({
        原型: '属性修正',
        目标: '自身',
        属性,
        数值: Math.max(1, Math.round(数值加成)),
        对应等级: Math.min(99, 强度 * 20 + 19),
        持续回合: 3,
      }));
      输出.基础使用次数 = 1;
      输出.剩余使用次数 = 1;
    }
    return Object.keys(输出).length ? 输出 : {};
  }

  getDesignOutputName(targetName, tier, materialNames = []) {
    if (/(一字|二字|三字|四字)斗铠设计图/.test(targetName)) return targetName;
    if (/斗铠|护铠/.test(targetName) || materialNames.some(name => /斗铠/.test(this.取材料原名(name)))) return this.getArmorBlueprintNameByTier(tier);
    return /设计图|蓝图/.test(targetName) ? targetName : `${targetName}设计图`;
  }

  getRepairDescriptor(materialNames) {
    const names = materialNames.map(name => this.取材料原名(name));
    if (names.some(name => /神级重塑核心/.test(name))) return { status: '神级重塑完成', desc: '借助神级重塑核心完成了整体重塑' };
    if (names.some(name => /斗铠本源蕴养液/.test(name))) return { status: '本源修复', desc: '斗铠本源已得到充分蕴养与修复' };
    if (names.some(name => /精密修复模块/.test(name))) return { status: '精密修复完成', desc: '关键结构已完成精密级修复与校准' };
    if (names.some(name => /基础维护套件/.test(name))) return { status: '基础维护完成', desc: '已完成日常维护、除错与常规校准' };
    return { status: '已检修', desc: '已完成标准检修' };
  }

  构建修理目标物品定义(targetName, definition = {}, repairDesc = {}) {
    const 分类 = this.要求产物分类(targetName, definition, '功能道具');
    const 新定义 = {
      品质: definition.品质 || '普通',
      描述: `${definition?.描述 ? definition.描述 + ' | ' : ''}${repairDesc.desc || '已完成标准检修'}`,
      基础价格: Math.max(1, Math.floor(Number(definition.基础价格 || 1))),
      默认货币: definition.默认货币 || '联邦币',
      基础耐久: Math.max(100, Math.floor(Number(definition.基础耐久 || 100))),
    };
    if (分类 === '锻造金属') 新定义.阶位 = Math.max(0, Math.min(5, Math.floor(Number(definition.阶位 || this.getItemTier(targetName) || 0))));
    if (副职业装备物品分类集合.has(分类)) {
      if (definition.装备槽位) 新定义.装备槽位 = definition.装备槽位;
      if (definition.属性加成 && typeof definition.属性加成 === 'object' && !Array.isArray(definition.属性加成)) 新定义.属性加成 = definition.属性加成;
      if (definition.装备技能 && typeof definition.装备技能 === 'object' && !Array.isArray(definition.装备技能)) 新定义.装备技能 = definition.装备技能;
    }
    Object.keys(新定义).forEach(字段名 => {
      const 值 = 新定义[字段名];
      if (值 === undefined || 值 === null || 值 === '' || (Array.isArray(值) && !值.length)) delete 新定义[字段名];
      else if (值 && typeof 值 === 'object' && !Array.isArray(值) && !Object.keys(值).length) delete 新定义[字段名];
    });
    return { 分类, 定义: 新定义 };
  }

  getRepairRequirement(targetName) {
    const item = this.resolveInventoryItem(targetName);
    const durability = Number(item?.耐久 ?? item?.完整度 ?? 100);
    const statusText = `${targetName} ${item?.描述 || ''}`;
    if (/彻底损毁|完全损毁|报废|粉碎|崩毁|重塑/.test(statusText) || durability <= 0) return { label: '彻底损毁', required: '神级重塑核心', allows: [/神级重塑核心/] };
    if (/斗铠/.test(targetName) && (/本源|根基|核心受损|灵性流失/.test(statusText) || (durability > 0 && durability < 30))) return { label: '斗铠本源伤', required: '斗铠本源蕴养液', allows: [/斗铠本源蕴养液/, /神级重塑核心/] };
    if (/严重|中度|重伤|裂纹|断裂|破损|损坏|失衡/.test(statusText) || durability < 60) return { label: '中重度损伤', required: '精密修复模块', allows: [/精密修复模块/, /斗铠本源蕴养液/, /神级重塑核心/] };
    return { label: '轻度磨损', required: '基础维护套件', allows: [/基础维护套件/, /精密修复模块/, /斗铠本源蕴养液/, /神级重塑核心/] };
  }

  getRepairRequirementSatisfied(materialNames, requirement) {
    if (!requirement) return true;
    return requirement.allows.some(pattern => materialNames.some(name => pattern.test(this.取材料原名(name))));
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
        materialNames.filter(name => !this.是配方蓝图材料(name, recipe)).forEach(name => {
          计划[name] = Number(计划[name] || 0) + 安全数量;
        });
        if (recipe.blueprint && materialNames.some(name => name === recipe.blueprint)) {
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
      快照[名称] = this.读取背包总数量(this.currentInventory[名称]);
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
    if (this.activeMode === 'forge') {
      if (materialNames.length === 1) {
        const 物品 = this.resolveInventoryItem(materialNames[0]);
        const 融合参数 = 物品?.副职业参数?.融合参数 || {};
        return { fusionCount: Math.max(1, Number(融合参数.数量 || 1)), fusionSync: Number(融合参数.融合率 ?? 100) };
      }
      if (materialNames.length > 1) return { fusionCount: materialNames.length, fusionSync: this.getForgeFusionRate(runtime, materialNames) };
    }
    return { fusionCount: 1, fusionSync: 0 };
  }

  getModeSuccessRateForRuntime(mode, runtime, tier, materialNames, fusionCount, targetName = '') {
    const 魂导等级 = mode === 'manufacture' ? this.读取目标魂导等级(targetName, materialNames) : 0;
    if (魂导等级 > 0) return this.getSoulToolSingleRate(runtime, 魂导等级);
    const ef = Math.max(1, Number(fusionCount || 1));
    if (mode === 'forge') return ef > 1 ? this.getForgeFusionSuccessRate(runtime, ef, false) : this.getSingleTierSuccessRate(tier, runtime);
    return ef > 1 ? this.getGenericCompositeRate(runtime, ef) : this.getGenericSingleRate(runtime, tier);
  }

  读取本次通用成功率(cfg = {}, runtime = {}, commissionCtx = {}, tier = 1, materialNames = [], targetName = '') {
    if (commissionCtx?.isCommission) return Number(commissionCtx.successRate || 0);
    return this.getModeSuccessRateForRuntime(cfg.mode, runtime, tier, materialNames, commissionCtx?.fusionCount || 1, targetName);
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
    const 魂导等级 = cfg.mode === 'manufacture' ? this.读取目标魂导等级(targetName, materialNames) : 0;
    const ctx = {
      type, isCommission: type !== 'self', isOfficial: type === 'official', isPrivate: type === 'private',
      targetNpcName, targetName, fusionCount: fusion.fusionCount, fusionSync: fusion.fusionSync,
      relScore: 0, commissionFee: 0, successRate: null, executorName: this.activeName, executorRuntime: runtime, validationRuntime: runtime,
      note: `由${this.activeName}亲自执行，按当前角色副职业熟练度仲裁。`, error: null, targetChar: null, hasEnoughFunds: true
    };

    const jobDisplayName = this.读取副职业显示名(cfg.jobName);
    if (type === 'self') {
      const 自行运行时 = this.读取本次执行运行时(cfg, runtime, ctx, targetName, materialNames);
      ctx.executorRuntime = 自行运行时;
      ctx.validationRuntime = 自行运行时;
      if (Number(自行运行时?.lv || 0) <= 0) {
        ctx.error = `${this.activeName}未掌握【${魂导等级 > 0 ? '魂导师' : jobDisplayName}】副职业，无法发起该类操作。`;
        return ctx;
      }
    }

    if (ctx.isOfficial) {
      ctx.executorName = `${jobDisplayName}协会`; ctx.executorRuntime = this.buildOfficialCommissionRuntime(cfg.jobName); ctx.validationRuntime = ctx.executorRuntime;
      ctx.successRate = 85; ctx.commissionFee = Number(OFFICIAL_COMMISSION_FEES[tier] || 0);
      const officialLocationName = this.getOfficialCommissionLocation(cfg.jobName);
      ctx.note = `官方代工固定成功率 85%，支持 3 级复合工序。当前代工费 ${this.formatFedCoin(ctx.commissionFee)}。`;
      if (魂导等级 > 0) ctx.error = '官方工坊不受理魂导器单人制造，请指定具备魂导师等级的执行者。';
      else if (!currentLoc.includes(officialLocationName)) ctx.error = `必须前往【${officialLocationName}】大厅才能办理官方代工委托。`;
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
        else {
          const npcRuntime = this.getJobRuntime(cfg.jobName, targetChar);
          const npc执行运行时 = this.读取本次执行运行时(cfg, npcRuntime, { ...ctx, targetChar }, targetName, materialNames);
          if (Number(npc执行运行时?.lv || 0) <= 0) {
            ctx.error = `【${targetNpcName}】并未掌握【${魂导等级 > 0 ? '魂导师' : jobDisplayName}】副职业。`;
            return ctx;
          }
          ctx.executorName = relationName; ctx.executorRuntime = npc执行运行时; ctx.validationRuntime = npc执行运行时;
          ctx.relScore = this.getRelationScore(relationName);
          if (ctx.fusionCount > (cfg.mode === 'forge' ? this.读取阶位支持融锻数(npc执行运行时.lv, tier) : npc执行运行时.maxFusion)) ctx.error = `目标 NPC【${targetNpcName}】的${jobDisplayName}等级不足，无法承接 ${ctx.fusionCount} 级复合工序。`;
          else {
            const baseFee = Number(PRIVATE_COMMISSION_FEES[tier] || 100000);
            ctx.commissionFee = baseFee * Math.max(1, ctx.fusionCount);
            if (ctx.relScore >= 80) ctx.commissionFee = 0;
            else if (ctx.relScore >= 50) ctx.commissionFee = Math.floor(ctx.commissionFee * 0.5);
            const baseRate = this.getModeSuccessRateForRuntime(cfg.mode, npc执行运行时, tier, materialNames, ctx.fusionCount, targetName);
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
    if (mode === 'forge') return (name, item) => /金属|铁|银|金|铜|矿|锻|合金|玉银/.test(name) || item?.物品分类 === '锻造金属' || /百锻|千锻|灵锻|魂锻|天锻/.test(item?.品质);
    if (mode === 'manufacture') return (name, item) => /金属|锻|合金|玉银|设计图|蓝图|核心|回路|模块|零件|骨架|外壳|装甲|引擎|炮/.test(name) || ['锻造金属', '功能道具', '设计图纸'].includes(item?.物品分类);
    if (mode === 'design') return (name, item) => /图纸|蓝图|模板|回路|模块|核心|设计/.test(name) || ['设计图纸', '功能道具', '锻造金属'].includes(item?.物品分类);
    if (mode === 'repair') return (name, item) => /维护|修复|套件|金属|锻|零件|回路|模块|外壳|装甲|引擎|炮/.test(name) || ['锻造金属', '功能道具', '一次性道具'].includes(item?.物品分类);
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
    const 添加材料项 = (itemName, 引用, item, labelText) => {
      if (!item || Number(item.数量 || 0) <= 0 || !filter(itemName, item)) return;
      const label = document.createElement('label');
      label.className = 'material-item';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.className = 'material-cb'; cb.value = 引用;
      cb.addEventListener('change', () => { this.autoGenerateTargetName(); this.updatePreview(); });
      const detail = [`剩${Math.max(0, Math.floor(Number(item.数量 || 0)))}`];
      const qualityFactor = item?.品质系数;
      if (qualityFactor !== undefined) detail.push(`Q${Number(qualityFactor).toFixed(2)}`);
      const fusionRate = item?.副职业参数?.融合参数?.融合率;
      if (fusionRate !== undefined) detail.push(`融合率${fusionRate}%`);
      if (item?.耐久 !== undefined) detail.push(`耐久${item.耐久}`);
      label.appendChild(cb); label.appendChild(document.createTextNode(`${labelText} (${detail.join(' / ')})`));
      container.appendChild(label);
      count++;
    };
    Object.keys(this.currentInventory).forEach(itemName => {
      const 背包记录 = this.currentInventory[itemName];
      const 普通数量 = this.读取背包普通数量(背包记录);
      const 命中 = this.查找物品定义(itemName);
      if (普通数量 > 0) {
        添加材料项(itemName, this.编码材料引用(itemName, -1), { ...(命中?.定义 || {}), 物品分类: 命中?.分类 || '', 数量: 普通数量 }, itemName);
      }
      this.读取背包批次条目列表(背包记录).forEach(({ 批次, 索引 }) => {
        添加材料项(
          itemName,
          this.编码材料引用(itemName, 索引),
          { ...(命中?.定义 || {}), 物品分类: 命中?.分类 || '', ...(批次 || {}), 数量: Math.max(0, Math.floor(Number(批次.数量 || 0))) },
          `${itemName} · 批次${索引 + 1}`,
        );
      });
    });
    if (count === 0) container.innerHTML = `<div style="color: var(--text-dim);">${cfg.requiresMaterials ? '[当前背包无可用材料]' : '[当前模式材料可选为空]'}</div>`;
  }

  autoGenerateTargetName() {
    const cfg = PROFESSION_CONFIG[this.activeMode];
    const materials = this.getSelectedMaterialNames();
    const tier = this.getCurrentUiState().tier;
    const tierLabel = this.activeMode === 'forge' ? this.getForgeTierLabel(tier) : this.getTierDisplayName(this.activeMode, tier);
    if (materials.length === 0) return;

    const rawNames = materials.map(name => this.取材料原名(name).replace(/百锻|千锻|灵锻|魂锻|天锻/g, '').trim());
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
      return Number(single?.副职业参数?.融合参数?.融合率 ?? 100);
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
      const 解锁等级 = this.getForgeUnlockLevel(tier);
      if (runtime.lv < 解锁等级 && 解锁等级 !== runtime.lv + 1) return `${this.getForgeTierLabel(tier)}单金属锻造尚未解锁，需要 Lv.${解锁等级} 锻造师。`;
      const mTier = this.getItemTier(materialNames[0]);
      const mItem = this.resolveInventoryItem(materialNames[0]);
      if (Boolean((mItem?.副职业参数?.融合参数?.数量 || 0) > 1 || /合金|玉银/.test(materialNames[0])) && tier > mTier && !(mTier === 4 && tier === 5)) return '融锻合金定型后无法常规升阶；仅允许【魂锻合金 → 天锻】特例。';
      return null;
    }
    const fusionUnlockLv = this.getForgeFusionUnlockLevel(tier);
    if (runtime.lv < fusionUnlockLv && fusionUnlockLv !== runtime.lv + 1) return `${this.getForgeTierLabel(tier)}融锻尚未解锁，需要 Lv.${fusionUnlockLv} 锻造师。`;
    const 当前阶位支持数 = this.读取阶位支持融锻数(runtime.lv, tier);
    if (materialNames.length > 当前阶位支持数) return `当前锻造师${this.getForgeTierLabel(tier)}支持融锻数为 ${当前阶位支持数}。`;
    for (const mName of materialNames) {
      if (this.getItemTier(mName) !== tier) return `融锻要求材料阶位与目标完全一致：当前目标 ${this.getForgeTierLabel(tier)}，材料【${mName}】是 ${this.getForgeTierLabel(this.getItemTier(mName))}。`;
      const materialItem = this.resolveInventoryItem(mName);
      if (tier === 2 && Number(materialItem?.品质系数 ?? 1) < 1.15) return `千锻融锻要求所有材料达到“一品”(品质系数≥1.15)。`;
    }
    return null;
  }

  validateGenericRules(cfg, runtime, tier, materialNames, targetName) {
    if (!targetName.trim()) return '请先填写目标产物/对象名称。';
    const jobDisplayName = this.读取副职业显示名(cfg.jobName);
    let recipe = null;
    if (cfg.mode === 'manufacture') {
      recipe = this.getManufactureRecipe(targetName, materialNames, tier, 1);
      if (recipe?.mode === 'soul_tool_array') return recipe.note;
      if (recipe?.mode === 'soul_tool') {
        if (cfg.requiresMaterials && materialNames.length === 0) return `${cfg.displayName}至少需要选择一种材料。`;
        const 魂导师等级 = this.读取运行时魂导师等级(runtime);
        if (recipe.魂导等级 >= 10 && 魂导师等级 < 10) return '10级魂导器必须由10级魂导师独立制造。';
        if (魂导师等级 < recipe.魂导等级 && recipe.魂导等级 !== 魂导师等级 + 1) return `${recipe.魂导等级}级魂导器需要 Lv.${recipe.魂导等级} 魂导师。`;
        if (tier !== recipe.expectedTier) return `${recipe.魂导等级}级魂导器需要${this.getTierMetalLabel(recipe.expectedTier)}。`;
        const 金属材料 = materialNames.filter(name => !/设计图|蓝图|模板/.test(this.取材料原名(name)));
        if (!金属材料.length) return `${recipe.魂导等级}级魂导器至少需要${this.getTierMetalLabel(recipe.expectedTier)}。`;
        const wrongMaterial = 金属材料.find(name => this.getItemTier(name) !== recipe.expectedTier);
        if (wrongMaterial) return `${recipe.魂导等级}级魂导器材料等级不匹配：${wrongMaterial}。`;
        return null;
      }
    }
    const uLv = this.getForgeUnlockLevel(tier);
    if (runtime.lv < uLv && uLv !== runtime.lv + 1) return `${this.getTierDisplayName(cfg.mode, tier)}尚未解锁，需要 Lv.${uLv} ${jobDisplayName}。`;
    if (cfg.requiresMaterials && materialNames.length === 0) return `${cfg.displayName}至少需要选择一种材料。`;
    if (cfg.mode === 'manufacture') {
      if (/斗铠|机甲/.test(targetName) && !this.hasBlueprintMaterial(materialNames)) return '制造斗铠/机甲至少需要对应设计图或蓝图。';
      const armorTier = this.getArmorTierFromName(targetName);
      if (armorTier && armorTier !== tier) return `目标【${targetName}】属 ${this.getTierDisplayName(cfg.mode, armorTier)}，阶位不匹配。`;
      if (/斗铠/.test(targetName) && !materialNames.some(name => this.取材料原名(name) === this.getArmorBlueprintNameByTier(tier))) return `需要对应的【${this.getArmorBlueprintNameByTier(tier)}】。`;
      if (recipe?.mode === 'armor') {
        const armorMaterials = materialNames.filter(name => !this.是配方蓝图材料(name, recipe));
        if (armorMaterials.length === 0) return `制造【${targetName}】至少需要勾选对应位阶的金属材料。`;
        const wrongArmorMaterial = armorMaterials.find(name => this.getItemTier(name) !== tier);
        if (wrongArmorMaterial) return `当前斗铠制造要求使用${this.getTierMetalLabel(tier)}，材料【${wrongArmorMaterial}】阶位不匹配。`;
      }
      if (recipe?.mode === 'mech') {
        if (tier !== recipe.expectedTier) return `固定阶位应为 ${this.getTierDisplayName(cfg.mode, recipe.expectedTier)}。`;
        const stocks = this.getSelectedTierStock(materialNames);
        for (const tierKey in recipe.fixedTierNeeds) {
          if (Number(stocks[tierKey] || 0) < Number(recipe.fixedTierNeeds[tierKey])) return `制造耗材不足：缺少${this.getTierMetalLabel(Number(tierKey))}。`;
        }
      }
    }
    if (this.getFusionContext(runtime, materialNames).fusionCount > runtime.maxFusion) return `当前${jobDisplayName}支持协同数为 ${runtime.maxFusion}。`;
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
    const 当前状态 = this.getCurrentUiState();
    const tier = 当前状态.tier;
    const qty = 当前状态.数量;
    const targetName = String(this.$('#prof-target').value || '').trim();
    const materialNames = this.getSelectedMaterialNames();
    const costs = this.getProfessionCost(cfg.jobName, tier, qty);
    const commissionCtx = this.getCommissionContext(cfg, runtime, tier, materialNames, targetName);
    const effectiveRuntime = commissionCtx.validationRuntime || runtime;
    const 本次进度副职业 = this.读取本次进度副职业(cfg, targetName, materialNames);
    const 自身进度运行时 = 本次进度副职业 === cfg.jobName ? runtime : this.读取副职业认证运行时(本次进度副职业);
    const 本次工序显示名 = this.读取本次工序显示名(cfg, targetName, materialNames);
    const 连续配置 = this.获取连续模式配置();
    const enoughResources = commissionCtx.isCommission ? commissionCtx.hasEnoughFunds : this.hasEnoughResources(costs);

    let ruleError = commissionCtx.error || null;
    let rateText = '-', fusionText = '-', maxQText = '-', noteText = '-';
    let 当前成功率数值 = 0;
    let costText = commissionCtx.isCommission ? `<span class="val-cyan">委托模式不扣副职业资源</span>` : this.formatResourceCost(costs);
    let feeText = commissionCtx.isCommission ? (commissionCtx.commissionFee > 0 ? `<span class="val-highlight">${this.formatFedCoin(commissionCtx.commissionFee)}</span>` : `<span class="val-green">免单</span>`) : `<span class="val-cyan">无</span>`;

    if (this.activeMode === 'forge') {
      if (!ruleError) ruleError = this.validateForgeRules(effectiveRuntime, tier, materialNames, targetName, { isCommission: commissionCtx.isCommission });
      if (!ruleError) {
        const efc = Math.max(commissionCtx.fusionCount || 1, 1);
        const isFusion = efc > 1;
        const rate = commissionCtx.isCommission ? Number(commissionCtx.successRate || 0) : (isFusion ? this.getForgeFusionSuccessRate(effectiveRuntime, efc, !!this.charData.功法?.['暗器百解']) : this.getSingleTierSuccessRate(tier, effectiveRuntime));
        当前成功率数值 = Number(rate || 0);
        const firstMaterial = this.resolveInventoryItem(materialNames[0]);
        const dfr = isFusion ? Number(commissionCtx.fusionSync || (materialNames.length > 1 ? this.getForgeFusionRate(effectiveRuntime, materialNames) : 100)) : Number(firstMaterial?.副职业参数?.融合参数?.融合率 ?? 100);
        rateText = `<span class="val-highlight">${rate}%</span>`;
        fusionText = isFusion ? `<span class="val-cyan">${efc}级复合 / 融合率${dfr}%</span>` : `<span class="val-cyan">单金属 / 融合率${dfr}%</span>`;
        maxQText = `<span class="val-highlight">${this.getForgeMaxQ(tier, efc).toFixed(1)}</span>`;
        noteText = commissionCtx.isCommission ? commissionCtx.note : (isFusion ? `融锻走公式成功率；当前${this.getForgeTierLabel(tier)}支持融锻数 ${this.读取阶位支持融锻数(effectiveRuntime.lv, tier)}。` : `单金属成功率按等级表 + 经验区间计算。`);
      }
    } else {
      if (!ruleError) ruleError = this.validateGenericRules(cfg, effectiveRuntime, tier, materialNames, targetName);
      if (!ruleError) {
        const efc = Math.max(commissionCtx.fusionCount || 1, 1);
        const isComp = efc > 1;
        const rate = this.读取本次通用成功率(cfg, effectiveRuntime, commissionCtx, tier, materialNames, targetName);
        当前成功率数值 = Number(rate || 0);
        rateText = `<span class="val-highlight">${rate}%</span>`;
        fusionText = isComp ? `<span class="val-cyan">复合工序 ${efc} 材</span>` : `<span class="val-cyan">单工序</span>`;
        maxQText = `<span class="val-highlight">${(isComp ? 1.25 : 1.15).toFixed(2)}</span>`;
        noteText = commissionCtx.isCommission ? commissionCtx.note : (isComp ? `${本次工序显示名}的多材料协同成功率按副职业公式推导。` : `${本次工序显示名}单工序成功率直接读取当前副职业熟练度。`);
        if (cfg.mode === 'manufacture') {
          const recipe = this.getManufactureRecipe(targetName, materialNames, tier, qty);
          if (recipe?.mode === 'mech' || recipe?.mode === 'armor') noteText = recipe.note;
          if (recipe?.mode === 'soul_tool') noteText = recipe.note;
        }
        if (cfg.mode === 'repair') {
          const req = this.getRepairRequirement(targetName);
          noteText = isComp ? `目标判定：${req.label} / 已选${materialNames.length}种修理耗材 / 要求：${req.required}` : `目标判定：${req.label} / 要求：${req.required}`;
        }
      }
    }

    if (!commissionCtx.isCommission && !连续配置.连续模式开启 && !enoughResources) ruleError = ruleError || '副职业资源不足。';

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
    this.setPreviewField('prev-job', `<span class="val-cyan">${this.读取副职业显示名(本次进度副职业)} Lv.${effectiveRuntime.lv}</span>${commissionCtx.isCommission ? ` / 执行者 ${commissionCtx.executorName}` : ''}`);
    this.setPreviewField('prev-exp', commissionCtx.isCommission ? `<span class="val-highlight">${Number(effectiveRuntime.exp || 0).toLocaleString()}</span> / 执行者熟练度` : `<span class="val-highlight">${自身进度运行时.exp.toLocaleString()}</span> / 本级进度 <span class="val-cyan">${Math.floor(自身进度运行时.expRatio * 100)}%</span>`);
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
    const 消耗计划 = {};
    选中材料.forEach(材料名 => {
      const 当前数量 = Math.max(0, Number(this.读取材料上下文(材料名)?.数量 || 0));
      const 剩余数量 = Math.max(0, Number(材料库存快照[材料名] || 0));
      const 消耗数量 = Math.max(0, 当前数量 - 剩余数量);
      if (消耗数量 > 0) 消耗计划[材料名] = 消耗数量;
    });
    return this.buildConsumePlanPatches(消耗计划);
  }

  buildTimeSkipPatch(跳过小时 = 0) {
    const 当前tick = Math.max(0, Number(this.snapshot?.sd?.world?.时间?.tick || 0));
    const 目标tick = 当前tick + Math.max(0, Math.floor(Number(跳过小时 || 0) * 副职业每小时tick));
    return [{ op: 'replace', path: '/world/时间/tick', value: 目标tick }];
  }
  buildMaterialConsumePatches(materialNames, qty) {
    return this.buildConsumePlanPatches(
      materialNames.reduce((计划, 名称) => {
        计划[名称] = Number(计划[名称] || 0) + Math.max(1, Number(qty || 1));
        return 计划;
      }, {})
    );
  }
  buildConsumePlanPatches(plan) {
    const 暂存 = {};
    Object.entries(plan || {})
      .filter(([_, q]) => Number(q) > 0)
      .forEach(([ref, consumeQty]) => {
        const { 物品名, 批次索引 } = this.解码材料引用(ref);
        if (!物品名) return;
        const 当前记录 = 暂存[物品名] !== undefined ? 暂存[物品名] : this.currentInventory[物品名];
        暂存[物品名] = this.构建背包指定扣减值(当前记录, Number(consumeQty), 批次索引);
      });
    return Object.entries(暂存).map(([name, nextValue]) => nextValue
      ? { op: 'replace', path: `${this.activeCharBasePath}/背包/${this.escapeJsonPointer(name)}`, value: nextValue }
      : { op: 'remove', path: `${this.activeCharBasePath}/背包/${this.escapeJsonPointer(name)}` });
  }
  buildInventoryAddPatches(itemName, itemData, amount = 1, 批次派生字段 = false) {
    const safeItem = itemData && typeof itemData === 'object' ? itemData : {};
    const 分类 = this.要求产物分类(itemName, safeItem, this.activeMode === 'forge' ? '锻造金属' : '');
    const 数量 = Math.max(1, Math.floor(Number(amount || safeItem.数量 || 1)));
    const 来源副职业参数 = safeItem.副职业参数 && typeof safeItem.副职业参数 === 'object' && !Array.isArray(safeItem.副职业参数) ? safeItem.副职业参数 : {};
    const definition = {
      品质: this.规范化物品经济品质(safeItem.品质 || this.getTierQualityLabel(this.activeMode, this.getItemTier(itemName)), itemName, 分类),
      描述: safeItem.描述 || `副职业产物【${itemName}】`,
      基础价格: Math.max(1, Math.floor(Number(safeItem.基础价格 || 1))),
      默认货币: safeItem.默认货币 || '联邦币',
    };
    if (分类 === '锻造金属') definition.阶位 = Math.max(0, Math.floor(Number(safeItem.阶位 || this.getItemTier(itemName) || 0)));
    if (Number(safeItem.魂导等级 || 0) > 0) definition.魂导等级 = Math.max(1, Math.min(12, Math.floor(Number(safeItem.魂导等级 || 0))));
    if (!批次派生字段 && Number(safeItem.基础使用次数 || 0) > 0) definition.基础使用次数 = Math.max(1, Math.floor(Number(safeItem.基础使用次数 || 1)));
    const 是魂导器 = Number(safeItem.魂导等级 || 0) > 0 && !/奶瓶|定装|炮弹|炸弹/.test(itemName);
    if (副职业装备物品分类集合.has(分类) || 是魂导器) {
      if (safeItem.装备槽位) definition.装备槽位 = safeItem.装备槽位;
    }
    if (!批次派生字段 && (副职业装备物品分类集合.has(分类) || 是魂导器)) {
      if (Number(safeItem.基础耐久 || 0) > 0) definition.基础耐久 = Math.max(0, Math.floor(Number(safeItem.基础耐久 || 0)));
      if (safeItem.属性加成 && typeof safeItem.属性加成 === 'object' && !Array.isArray(safeItem.属性加成)) definition.属性加成 = safeItem.属性加成;
      if (safeItem.装备技能 && typeof safeItem.装备技能 === 'object' && !Array.isArray(safeItem.装备技能)) definition.装备技能 = safeItem.装备技能;
    }
    if (分类 === '设计图纸') {
      definition.图纸目标 = safeItem.图纸目标 || itemName.replace(/设计图$/, '');
    }
    if (分类 === '修炼秘籍') {
      if (safeItem.获取条件) definition.获取条件 = safeItem.获取条件;
      if (safeItem.研读条件) definition.研读条件 = safeItem.研读条件;
      if (safeItem.解锁内容) definition.解锁内容 = safeItem.解锁内容;
    }
    Object.keys(definition).forEach(字段名 => {
      const 值 = definition[字段名];
      if (值 === undefined || 值 === null || 值 === '' || (Array.isArray(值) && !值.length)) delete definition[字段名];
      else if (值 && typeof 值 === 'object' && !Array.isArray(值) && !Object.keys(值).length) delete definition[字段名];
    });
    const patches = [];
    if (!this.查找物品定义(itemName)) {
      patches.push({ op: 'replace', path: `/物品/${this.escapeJsonPointer(分类)}/${this.escapeJsonPointer(itemName)}`, value: definition });
    }
    const 批次列表 = this.构建入库批次列表(safeItem, 数量, {
      物品名: itemName,
      分类,
      品质: safeItem.批次品质 || safeItem.品质,
      品质系数: safeItem.品质系数,
      基础金属: safeItem.基础金属,
      耐久: safeItem.耐久,
      剩余使用次数: safeItem.剩余使用次数,
      基础耐久: safeItem.基础耐久,
      基础使用次数: safeItem.基础使用次数,
      魂导等级: safeItem.魂导等级,
      属性加成: safeItem.属性加成,
      装备技能: safeItem.装备技能,
      使用效果: safeItem.使用效果,
      绑定者: safeItem.绑定者,
      有效期至tick: safeItem.有效期至tick,
      副职业参数: 来源副职业参数.融合参数 ? { 融合参数: 来源副职业参数.融合参数 } : undefined,
    });
    const 当前记录 = this.currentInventory[itemName] && typeof this.currentInventory[itemName] === 'object' && !Array.isArray(this.currentInventory[itemName])
      ? this.复制JSON(this.currentInventory[itemName], {})
      : null;
    if (当前记录) {
      if (批次列表.length) {
        当前记录.批次 = [...(Array.isArray(当前记录.批次) ? 当前记录.批次 : []), ...批次列表];
        if (当前记录.数量 === undefined) 当前记录.数量 = 0;
      } else {
        当前记录.数量 = Math.max(0, Math.floor(Number(当前记录.数量 || 0))) + 数量;
      }
      patches.push({ op: 'replace', path: `${this.activeCharBasePath}/背包/${this.escapeJsonPointer(itemName)}`, value: 当前记录 });
      return patches;
    }
    patches.push({
      op: 'replace',
      path: `${this.activeCharBasePath}/背包/${this.escapeJsonPointer(itemName)}`,
      value: 批次列表.length ? { 数量: 0, 批次: 批次列表 } : { 数量 },
    });
    return patches;
  }
  buildJobProgressPatches(jobName, expGain, 完成作品等级 = 0) {
    const runtime = this.读取副职业认证运行时(jobName);
    const nextExp = runtime.exp + expGain;
    const 派生接口 = this.读取副职业派生接口();
    const 最高等级 = typeof 派生接口.读取最高等级 === 'function' ? Math.max(0, Math.floor(Number(派生接口.读取最高等级(jobName) || 0))) : 9;
    const 目标等级 = Math.max(0, Math.min(最高等级, Math.floor(Number(完成作品等级 || 0))));
    const nextLv = 目标等级 === runtime.lv + 1 ? 目标等级 : runtime.lv;
    const 已有副职业记录 = this.charData?.副职业?.[jobName];
    const patches = 已有副职业记录 && typeof 已有副职业记录 === 'object' && !Array.isArray(已有副职业记录)
      ? [{ op: 'replace', path: `${this.activeCharBasePath}/副职业/${this.escapeJsonPointer(jobName)}/经验`, value: nextExp }]
      : [{ op: 'replace', path: `${this.activeCharBasePath}/副职业/${this.escapeJsonPointer(jobName)}`, value: { 等级: nextLv, 经验: nextExp, 称号: '无' } }];
    if (已有副职业记录 && nextLv > runtime.lv) patches.push({ op: 'replace', path: `${this.activeCharBasePath}/副职业/${this.escapeJsonPointer(jobName)}/等级`, value: nextLv });
    return {
      patches,
      oldLv: runtime.lv, newLv: nextLv
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
    const 当前状态 = this.getCurrentUiState();
    const tier = 当前状态.tier;
    const qty = 当前状态.数量;
    const targetName = String(this.$('#prof-target').value || '').trim();
    const materialNames = this.getSelectedMaterialNames();
    const costs = this.getProfessionCost(cfg.jobName, tier, qty);
    const commissionCtx = this.getCommissionContext(cfg, runtime, tier, materialNames, targetName);
    const effectiveRuntime = commissionCtx.validationRuntime || runtime;
    const 本次工序显示名 = this.读取本次工序显示名(cfg, targetName, materialNames);
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

    const 锻造复合数 = Math.max(Number(commissionCtx.fusionCount || 1), 1);
    const 锻造是否融锻 = 锻造复合数 > 1;
    const 通用复合数 = Math.max(Number(commissionCtx.fusionCount || 1), 1);
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
          ? (是否委托 ? Number(commissionCtx.successRate || 0) : (锻造是否融锻 ? this.getForgeFusionSuccessRate(effectiveRuntime, 锻造复合数, !!this.charData.功法?.['暗器百解']) : this.getSingleTierSuccessRate(tier, effectiveRuntime)))
          : this.读取本次通用成功率(cfg, effectiveRuntime, commissionCtx, tier, materialNames, targetName);
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
              : Number(firstMaterial?.副职业参数?.融合参数?.融合率 ?? 100);
            const 本次品质 = commissionCtx.isOfficial
              ? 1
              : (锻造是否融锻
                ? this.getForgeFusionQuality(tier, this.getForgeMaxQ(tier, 锻造复合数), 本次融合率, roll, isGreatSuccess)
                : this.clamp(isGreatSuccess ? 1.2 : this.getForgeSingleQuality(tier, commissionCtx.executorRuntime || runtime), 0.8, 1.2));
            const 产物名 = targetName;
            if (!产物汇总[产物名]) {
              产物汇总[产物名] = {
                数量: 0,
                物品分类: '锻造金属',
                品质: this.getTierQualityLabel(cfg.mode, tier),
                品质系数累计: 0,
                副职业参数: 锻造是否融锻 ? { 融合参数: { 数量: 锻造复合数, 融合率: Math.floor(本次融合率) } } : null,
                描述: `由${commissionCtx.executorName}完成的${cfg.jobName}产物`,
              };
            }
            产物汇总[产物名].数量 += 1;
            产物汇总[产物名].品质系数累计 += Number(本次品质 || 1);
          } else if (this.activeMode === 'design') {
            const 产物名 = this.getDesignOutputName(targetName, tier, materialNames);
            const 品质系数 = commissionCtx.isOfficial ? 1 : this.getGenericQuality(commissionCtx.executorRuntime || runtime, tier, isGreatSuccess);
            if (!产物汇总[产物名]) {
              产物汇总[产物名] = { 数量: 0, 物品分类: '设计图纸', 品质: this.getTierQualityLabel(cfg.mode, tier), 品质系数累计: 0, 描述: `由${commissionCtx.executorName}完成的${cfg.jobName}绘制` };
            }
            产物汇总[产物名].数量 += 1;
            产物汇总[产物名].品质系数累计 += Number(品质系数 || 1);
          } else if (this.activeMode === 'manufacture') {
            const 产物信息 = this.getManufactureOutputMeta(targetName, materialNames, tier);
            const 品质系数 = commissionCtx.isOfficial ? 1 : this.getGenericQuality(commissionCtx.executorRuntime || runtime, tier, isGreatSuccess);
            if (!产物汇总[产物信息.name]) {
              产物汇总[产物信息.name] = { 数量: 0, 物品分类: 产物信息.分类, 魂导等级: 产物信息.魂导等级 || 0, 品质: this.getTierQualityLabel(cfg.mode, tier), 品质系数累计: 0, 描述: `由${commissionCtx.executorName}完成${本次工序显示名}` };
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
      const 批次数据 = this.构建工坊产物批次数据(数据.物品分类 || '剧情杂物', 产物名, materialNames, tier, 平均品质系数, 数据.魂导等级 || 0);
      const 物品数据 = {
        物品分类: 数据.物品分类 || '剧情杂物',
        品质: 数据.品质 || '普通',
        品质系数: 平均品质系数,
        描述: 数据.描述 || `由${commissionCtx.executorName}完成${本次工序显示名}`,
        ...批次数据,
      };
      if (Number(数据.魂导等级 || 0) > 0) 物品数据.魂导等级 = Math.max(1, Math.min(12, Math.floor(Number(数据.魂导等级 || 0))));
      if (数据.副职业参数) 物品数据.副职业参数 = 数据.副职业参数;
      patchOps.push(...this.buildInventoryAddPatches(产物名, 物品数据, Number(数据.数量 || 1), Object.keys(批次数据).length > 0));
    });

    if (this.activeMode === 'repair' && 修理成功标记) {
      const repairDesc = this.getRepairDescriptor(materialNames);
      const definition = this.resolveInventoryItem(targetName);
      if (!this.查找物品定义(targetName)) {
        const 修理定义 = this.构建修理目标物品定义(targetName, definition, repairDesc);
        patchOps.push({
          op: 'replace',
          path: `/物品/${this.escapeJsonPointer(修理定义.分类)}/${this.escapeJsonPointer(targetName)}`,
          value: 修理定义.定义
        });
      }
      this.追加修理写回补丁(patchOps, targetName, definition, repairDesc);
    }

    if (!是否委托 && 统计.累计经验 > 0) {
      const 进度副职业 = this.读取本次进度副职业(cfg, targetName, materialNames);
      const progress = this.buildJobProgressPatches(进度副职业, 统计.累计经验, this.读取本次进度作品等级(进度副职业, tier, targetName, materialNames));
      patchOps.push(...progress.patches);
    }

    const 连续结果播报 = `[连续副职业] ${本次工序显示名} ${连续配置.连续天数}天（${总小时}小时）结束：执行${统计.执行次数}次，成功${统计.成功次数}次，失败${统计.失败次数}次，大成功${统计.大成功次数}次。${是否委托 ? '' : ` 冥想${统计.冥想小时}小时，睡眠${统计.睡眠小时}小时。`}时间已推进${总小时 * 副职业每小时tick}tick。`;
    patchOps.push(...this.buildSystemResultPatches(连续结果播报, 统计.最后检定, 统计.最后成功率));

    const materialText = materialNames.length > 0 ? materialNames.map(name => `${qty}份${name}`).join('、') : '无显式材料';
    const officialLocationName = this.getOfficialCommissionLocation(cfg.jobName);
    const actionLead = commissionCtx.isOfficial
      ? `我要在${officialLocationName}连续委托${本次工序显示名}${连续配置.连续天数}天，目标是【${targetName}】`
      : (commissionCtx.isPrivate
        ? `我要委托【${commissionCtx.executorName}】连续代工${本次工序显示名}${连续配置.连续天数}天，目标是【${targetName}】`
        : `我要连续进行${本次工序显示名}${连续配置.连续天数}天，目标是【${targetName}】`);
    const consumptionText = commissionCtx.isCommission
      ? `连续代工单次费用：${this.formatFedCoin(commissionCtx.commissionFee)}。本轮执行 ${统计.执行次数} 次，累计扣费 ${this.formatFedCoin(统计.执行次数 * Number(commissionCtx.commissionFee || 0))}。`
      : `单次消耗：${this.formatResourceCost(costs)}。本轮执行 ${统计.执行次数} 次后，剩余资源为 体:${Math.floor(资源状态.体力)} / 魂:${Math.floor(资源状态.魂力)} / 精:${Math.floor(资源状态.精神力)}。`;
    const sysPrompt = `${PROF_HIDDEN_ARBITRATION_NARRATION_RULES}\n\n[执行来源]\n本次执行者：${commissionCtx.executorName}。${commissionCtx.note}\n\n${连续结果播报}\n\n[副职业资源消耗]\n${consumptionText}\n${this.buildFrontEndStateBlock('Continuous profession executed.', patchOps)}`;
    this.submitAction(`${actionLead}，材料：${materialText}。`, sysPrompt, `prof_${cfg.mode}_continuous`);
  }

  executeForge() {
    const cfg = PROFESSION_CONFIG.forge;
    const runtime = this.getJobRuntime(cfg.jobName);
    const 当前状态 = this.getCurrentUiState();
    const tier = 当前状态.tier;
    const qty = 当前状态.数量;
    const targetName = String(this.$('#prof-target').value || '').trim();
    const materialNames = this.getSelectedMaterialNames();
    const costs = this.getProfessionCost(cfg.jobName, tier, qty);
    const commissionCtx = this.getCommissionContext(cfg, runtime, tier, materialNames, targetName);
    const effectiveRuntime = commissionCtx.validationRuntime || runtime;
    const ruleError = commissionCtx.error || this.validateForgeRules(effectiveRuntime, tier, materialNames, targetName, { isCommission: commissionCtx.isCommission });
    if (ruleError) {
      this.显示提示(ruleError);
      return;
    }
    
    const efc = Math.max(Number(commissionCtx.fusionCount || 1), 1);
    const isFusion = efc > 1;
    const successRate = commissionCtx.isCommission ? Number(commissionCtx.successRate || 0) : (isFusion ? this.getForgeFusionSuccessRate(effectiveRuntime, efc, !!this.charData.功法?.['暗器百解']) : this.getSingleTierSuccessRate(tier, effectiveRuntime));
    const firstMaterial = this.resolveInventoryItem(materialNames[0]);
    const fusionRate = isFusion ? Number(commissionCtx.fusionSync || this.getForgeFusionRate(commissionCtx.executorRuntime || runtime, materialNames)) : Number(firstMaterial?.副职业参数?.融合参数?.融合率 ?? 100);
    const maxQ = this.getForgeMaxQ(tier, efc);
    
    const roll = Math.floor(Math.random() * 100) + 1;
    const isGreatSuccess = roll <= 5 && !commissionCtx.isOfficial;
    const isSuccess = isGreatSuccess || roll <= successRate;

    let finalQ = 0, resultLog = '', expGain = cfg.expGain[tier] || 50;
    if (isSuccess) {
      if (commissionCtx.isOfficial) finalQ = 1.0;
      else if (isFusion) finalQ = this.getForgeFusionQuality(tier, maxQ, fusionRate, roll, isGreatSuccess);
      else finalQ = this.clamp(isGreatSuccess ? 1.2 : this.getForgeSingleQuality(tier, commissionCtx.executorRuntime || runtime), 0.8, 1.2);
      
      if (isGreatSuccess) {
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
      const newItem = { 数量: 1, 物品分类: '锻造金属', 品质: this.getTierQualityLabel(cfg.mode, tier), 品质系数: Number(finalQ.toFixed(2)), 描述: `由${commissionCtx.executorName}完成的${cfg.jobName}产物` };
      const 批次数据 = this.构建工坊产物批次数据('锻造金属', targetName, materialNames, tier, Number(finalQ.toFixed(2)), 0);
      Object.assign(newItem, 批次数据);
      if (isFusion) { newItem.副职业参数 = { 融合参数: { 数量: efc, 融合率: Math.floor(fusionRate) } }; newItem.描述 += ` (${efc}种金属融锻)`; }
      patchOps.push(...this.buildInventoryAddPatches(targetName, newItem, 1, Object.keys(批次数据).length > 0));
      if (!commissionCtx.isCommission) {
        const progress = this.buildJobProgressPatches(cfg.jobName, expGain, this.读取本次作品认证等级(cfg.jobName, tier));
        patchOps.push(...progress.patches);
        if (progress.newLv > progress.oldLv) resultLog += `\n\n[副职业突破] ${cfg.jobName}等级提升至 Lv.${progress.newLv}。`;
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
    const 当前状态 = this.getCurrentUiState();
    const tier = 当前状态.tier;
    const qty = 当前状态.数量;
    const targetName = String(this.$('#prof-target').value || '').trim();
    const materialNames = this.getSelectedMaterialNames();
    const costs = this.getProfessionCost(cfg.jobName, tier, qty);
    const commissionCtx = this.getCommissionContext(cfg, runtime, tier, materialNames, targetName);
    const effectiveRuntime = commissionCtx.validationRuntime || runtime;
    const 本次工序显示名 = this.读取本次工序显示名(cfg, targetName, materialNames);
    const ruleError = commissionCtx.error || this.validateGenericRules(cfg, effectiveRuntime, tier, materialNames, targetName);
    if (ruleError) {
      this.显示提示(ruleError);
      return;
    }
    
    const efc = Math.max(Number(commissionCtx.fusionCount || 1), 1);
    const isComp = efc > 1;
    const successRate = this.读取本次通用成功率(cfg, effectiveRuntime, commissionCtx, tier, materialNames, targetName);
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
        materialNames.filter(n => !this.是配方蓝图材料(n, recipe)).forEach(n => armorPlan[n] = Number(armorPlan[n] || 0) + qty);
        if (recipe.blueprint && materialNames.some(n => n === recipe.blueprint)) armorPlan[recipe.blueprint] = Number(armorPlan[recipe.blueprint] || 0) + Number(recipe.blueprintCost || 1);
        patchOps.push(...this.buildConsumePlanPatches(armorPlan));
      } else if (materialNames.length > 0) patchOps.push(...this.buildMaterialConsumePatches(materialNames, qty));
    } else if (materialNames.length > 0) patchOps.push(...this.buildMaterialConsumePatches(materialNames, qty));

    let resultLog = '';
    if (isSuccess) {
      if (this.activeMode === 'design') {
        const outputName = this.getDesignOutputName(targetName, tier, materialNames);
        patchOps.push(...this.buildInventoryAddPatches(outputName, { 物品分类: '设计图纸', 品质: this.getTierQualityLabel(cfg.mode, tier), 品质系数: finalQ, 描述: `由${commissionCtx.executorName}完成的${cfg.jobName}绘制` }, 1));
        resultLog = `[${commissionCtx.isCommission ? '委托成功' : cfg.displayName + '成功'}] ${commissionCtx.executorName}完成了【${outputName}】的设计绘制，完成度系数 ${finalQ.toFixed(2)}。`;
      } else if (this.activeMode === 'manufacture') {
        const mMeta = this.getManufactureOutputMeta(targetName, materialNames, tier);
        const 批次数据 = this.构建工坊产物批次数据(mMeta.分类, mMeta.name, materialNames, tier, finalQ, mMeta.魂导等级 || 0);
        patchOps.push(...this.buildInventoryAddPatches(mMeta.name, { 物品分类: mMeta.分类, 魂导等级: mMeta.魂导等级 || 0, 品质: this.getTierQualityLabel(cfg.mode, tier), 品质系数: finalQ, 描述: `由${commissionCtx.executorName}完成${本次工序显示名}`, ...批次数据 }, 1, Object.keys(批次数据).length > 0));
        resultLog = `[${commissionCtx.isCommission ? '委托成功' : 本次工序显示名 + '成功'}] ${commissionCtx.executorName}完成了【${mMeta.name}】的制造，完成度系数 ${finalQ.toFixed(2)}。`;
      } else if (this.activeMode === 'repair') {
        const definition = this.resolveInventoryItem(targetName);
        const repairDesc = this.getRepairDescriptor(materialNames);
        if (!this.查找物品定义(targetName)) {
          const 修理定义 = this.构建修理目标物品定义(targetName, definition, repairDesc);
          patchOps.push({
            op: 'replace',
            path: `/物品/${this.escapeJsonPointer(修理定义.分类)}/${this.escapeJsonPointer(targetName)}`,
            value: 修理定义.定义
          });
        }
        this.追加修理写回补丁(patchOps, targetName, definition, repairDesc);
        resultLog = `[${commissionCtx.isCommission ? '委托成功' : 本次工序显示名 + '成功'}] ${commissionCtx.executorName}完成了对【${targetName}】的整备修理。当前状态：${repairDesc.status}。`;
      }
      if (!commissionCtx.isCommission) {
        const 进度副职业 = this.读取本次进度副职业(cfg, targetName, materialNames);
        const progress = this.buildJobProgressPatches(进度副职业, expGain, this.读取本次进度作品等级(进度副职业, tier, targetName, materialNames));
        patchOps.push(...progress.patches);
        if (progress.newLv > progress.oldLv) resultLog += `\n\n[副职业突破] ${进度副职业}等级提升至 Lv.${progress.newLv}。`;
      }
      if (isGreatSuccess) resultLog = `[大成功] ${commissionCtx.executorName}以极高完成度完成了【${targetName}】的${本次工序显示名}操作，品质系数 ${finalQ.toFixed(2)}。`;
      else if (commissionCtx.isCommission) resultLog += (commissionCtx.commissionFee > 0 ? ` 已支付代工费 ${this.formatFedCoin(commissionCtx.commissionFee)}。` : ' 本次代工因好感度优惠免单。');
    } else {
      resultLog = `[${commissionCtx.isCommission ? '委托失败' : 本次工序显示名 + '失败'}] ${commissionCtx.executorName}尝试处理【${targetName}】失败。Roll ${roll} > 成功率 ${successRate}。`;
    }

    patchOps.push(...this.buildSystemResultPatches(resultLog, roll, successRate));

    const materialText = materialNames.length > 0 ? materialNames.map(name => `${qty}份${name}`).join('、') : '无显式材料';
    const officialLocationName = this.getOfficialCommissionLocation(cfg.jobName);
    const actionLead = commissionCtx.isOfficial ? `我要在${officialLocationName}办理官方代工，委托执行${本次工序显示名}，目标是【${targetName}】` : (commissionCtx.isPrivate ? `我要委托【${commissionCtx.executorName}】代工${本次工序显示名}，目标是【${targetName}】` : `我要进行${本次工序显示名}，目标是【${targetName}】`);
    const consumptionText = commissionCtx.isCommission ? `本次代工费：${this.formatFedCoin(commissionCtx.commissionFee)}。材料与目标物仍由委托人提供。` : `本次消耗：${this.formatResourceCost(costs)}。`;
    const sysPrompt = `${PROF_HIDDEN_ARBITRATION_NARRATION_RULES}\n\n[执行来源]\n本次执行者：${commissionCtx.executorName}。${commissionCtx.note}\n\n${resultLog}\n\n[副职业资源消耗]\n${consumptionText}\n${this.buildFrontEndStateBlock('Generic profession executed.', patchOps)}`;
    this.submitAction(`${actionLead}，材料：${materialText}。`, sysPrompt, `prof_${cfg.mode}`);
  }
}

window.mountProfessionUI = function(containerElement, snapshot, options = {}) {
  return new ProfessionUIComponent(containerElement, snapshot, options);
};

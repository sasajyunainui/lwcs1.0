/* TradeUI_Module.js - 交易网络组件 (JS 模块版) */

const TradeStyles = `
  /* 局部隔离：确保所有样式只在 .trade-module-scope 下生效 */
  .trade-module-scope {
    --panel: rgba(18, 56, 69, 0.20);
    --panel-strong: rgba(23, 68, 84, 0.26);
    --line: rgba(150, 217, 228, 0.22);
    --line-soft: rgba(150, 217, 228, 0.10);
    --cyan: #8de1ef;
    --cyan-soft: rgba(141, 225, 239, 0.14);
    --gold: #d7c070;
    --gold-soft: rgba(228, 201, 111, 0.14);
    --red: #ff8aa2;
    --white: #f5fcff;
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
  }

  .trade-module-scope .trade-tabs {
    display: flex;
    background: var(--panel-strong);
    border-bottom: 1px solid var(--line-soft);
    margin-bottom: 15px;
    border-radius: 4px;
    overflow: hidden;
  }

  .trade-module-scope .trade-tab {
    flex: 1;
    text-align: center;
    padding: 10px 0;
    font-size: 12px;
    color: var(--text-dim);
    cursor: pointer;
    text-transform: uppercase;
    transition: all 0.2s;
    font-family: var(--font-cjk);
    font-weight: bold;
  }

  .trade-module-scope .trade-tab.active {
    color: var(--gold);
    background: rgba(228, 201, 111, 0.1);
    border-bottom: 2px solid var(--gold);
  }

  .trade-module-scope .trade-body {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .trade-module-scope .trade-body::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }

  .trade-module-scope .tab-content {
    display: none;
  }
  .trade-module-scope .tab-content.active {
    display: block;
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .trade-module-scope .form-group {
    margin-bottom: 15px;
  }

  .trade-module-scope .form-group.is-context-locked {
    display: none;
  }

  .trade-module-scope .form-group label {
    display: block;
    font-size: 11px;
    color: var(--gold);
    margin-bottom: 6px;
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  .trade-module-scope .tech-select, .trade-module-scope .tech-input {
    width: 100%;
    background: var(--panel-strong);
    border: 1px solid var(--line-soft);
    color: var(--cyan);
    padding: 8px 10px;
    border-radius: 4px;
    font-family: var(--font-cjk);
    font-size: 13px;
    outline: none;
    transition: border-color 0.2s;
    box-sizing: border-box;
  }
  .trade-module-scope .tech-select option { background: #1a2a32; color: var(--text); }
  .trade-module-scope .tech-select:focus, .trade-module-scope .tech-input:focus { border-color: var(--gold); }

  .trade-module-scope .info-panel {
    background: rgba(0,0,0,0.3);
    border: 1px dashed var(--line-soft);
    border-radius: 4px;
    padding: 12px;
    margin-top: 15px;
    font-size: 12px;
    color: var(--text-sub);
    line-height: 1.6;
  }

  .trade-module-scope .info-row {
    display: flex;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    padding: 4px 0;
  }
  .trade-module-scope .info-row:last-child { border-bottom: none; }
  .trade-module-scope .val-highlight { color: var(--cyan); font-family: var(--font-tech); font-weight: bold; }
  .trade-module-scope .val-warn { color: var(--red); font-family: var(--font-tech); font-weight: bold; }
  .trade-module-scope .market-adjust {
    color: var(--gold);
    font-family: var(--font-cjk);
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .trade-module-scope .action-btn {
    width: 100%;
    margin-top: 20px;
    background: linear-gradient(90deg, rgba(228,201,111,0.1), rgba(228,201,111,0.3));
    border: 1px solid var(--gold);
    color: var(--gold);
    padding: 12px;
    border-radius: 4px;
    font-family: var(--font-tech);
    font-weight: 700;
    letter-spacing: 2px;
    cursor: pointer;
    text-transform: uppercase;
    transition: all 0.2s;
  }
  .trade-module-scope .action-btn:hover:not(:disabled) {
    background: var(--gold);
    color: #000;
    box-shadow: 0 0 10px var(--gold);
  }
  .trade-module-scope .action-btn:disabled {
    background: rgba(255,255,255,0.05);
    border-color: var(--line-soft);
    color: var(--text-dim);
    cursor: not-allowed;
    box-shadow: none;
  }

  .trade-module-scope .wealth-display {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: var(--text-dim);
    margin-bottom: 15px;
    padding: 12px;
    background: rgba(0,0,0,0.2);
    border-radius: 4px;
    border: 1px solid var(--line-soft);
  }
  .trade-module-scope .wealth-amt { color: var(--gold); font-family: var(--font-tech); }

  @media (max-width: 480px) {
    .trade-module-scope .trade-tabs { flex-wrap: wrap; }
    .trade-module-scope .trade-tab { flex: 1 0 50%; padding: 8px 0; font-size: 11px; }
    .trade-module-scope .form-group label { font-size: 10px; }
    .trade-module-scope .info-row { font-size: 11px; }
    .trade-module-scope .action-btn { font-size: 11px; padding: 8px; }
  }
`;

const TradeTemplate = `
<div class="trade-module-scope">
  <div class="wealth-display">
    <span>地点：<span class="val-highlight" id="ui-loc">未知</span></span>
    <span>联邦币：<span class="wealth-amt" id="ui-fedcoin">0</span></span>
    <span>声望：<span class="wealth-amt" id="ui-fame">0</span></span>
  </div>

  <div class="trade-tabs">
    <div class="trade-tab active" data-target="tab-shop">商店采购</div>
    <div class="trade-tab" data-target="tab-sell">资产出售</div>
    <div class="trade-tab" data-target="tab-private">私下交易</div>
    <div class="trade-tab" data-target="tab-auction">拍卖行</div>
  </div>

  <div class="trade-body">
    <!-- 商店采购 -->
    <div id="tab-shop" class="tab-content active">
      <div class="form-group">
        <label>选择商店</label>
        <select id="shop-store-sel" class="tech-select"></select>
      </div>
      <div class="form-group">
        <label>商品列表</label>
        <select id="shop-item-sel" class="tech-select"></select>
      </div>
      <div class="form-group">
        <label>购买数量</label>
        <input type="number" id="shop-qty" class="tech-input" value="1" min="1">
      </div>
      <div class="info-panel">
        <div class="info-row"><span>单价:</span><span class="val-highlight" id="shop-price">-</span></div>
        <div class="info-row"><span>市场调整:</span><span class="market-adjust" id="shop-market">-</span></div>
        <div class="info-row"><span>总计:</span><span class="val-highlight" id="shop-total">-</span></div>
        <div class="info-row"><span>需求声望:</span><span class="val-highlight" id="shop-fame">-</span></div>
        <div class="info-row"><span>当前库存:</span><span class="val-highlight" id="shop-stock">-</span></div>
        <div class="info-row"><span>触发方式:</span><span class="val-highlight" id="shop-trigger">-</span></div>
        <div class="info-row"><span>有效期至:</span><span class="val-highlight" id="shop-expiry">-</span></div>
        <div class="info-row"><span>来源:</span><span class="val-highlight" id="shop-source">-</span></div>
        <div class="info-row"><span>物品说明:</span><span class="val-highlight" style="white-space: normal; text-align: right;" id="shop-desc">-</span></div>
      </div>
      <button class="action-btn" id="btn-buy">确认购买</button>
    </div>

    <!-- 资产出售 -->
    <div id="tab-sell" class="tab-content">
      <div class="form-group">
        <label>背包物品</label>
        <select id="sell-item-sel" class="tech-select"></select>
      </div>
      <div class="form-group">
        <label>出售数量</label>
        <input type="number" id="sell-qty" class="tech-input" value="1" min="1">
      </div>
      <div class="info-panel">
        <div class="info-row"><span>系统估值(单价):</span><span class="val-highlight" id="sell-base-price">-</span></div>
        <div class="info-row"><span>市场调整:</span><span class="market-adjust" id="sell-market">-</span></div>
        <div class="info-row"><span>出售总收益:</span><span class="val-highlight" id="sell-total">-</span></div>
        <div class="info-row"><span>触发方式:</span><span class="val-highlight" id="sell-trigger">-</span></div>
        <div class="info-row"><span>有效期至:</span><span class="val-highlight" id="sell-expiry">-</span></div>
        <div class="info-row"><span>来源:</span><span class="val-highlight" id="sell-source">-</span></div>
        <div class="info-row"><span>物品说明:</span><span class="val-highlight" style="white-space: normal; text-align: right;" id="sell-desc">-</span></div>
      </div>
      <button class="action-btn" id="btn-sell">确认出售</button>
    </div>

    <!-- 私下交易 -->
    <div id="tab-private" class="tab-content">
      <div class="form-group">
        <label>交易类型</label>
        <select id="priv-action" class="tech-select">
          <option value="私下买入">私下买入 (向NPC求购)</option>
          <option value="私下卖出">私下卖出 (向NPC推销)</option>
        </select>
      </div>
      <div class="form-group">
        <label>交易对象</label>
        <input type="text" id="priv-npc" class="tech-input" placeholder="输入NPC名字">
      </div>
      <div class="form-group">
        <label>物品名称</label>
        <input type="text" id="priv-item" class="tech-input" placeholder="输入物品全名">
      </div>
      <div class="form-group">
        <label>数量</label>
        <input type="number" id="priv-qty" class="tech-input" value="1" min="1">
      </div>
      <div class="form-group">
        <label>你的出价 / 单价</label>
        <input type="number" id="priv-price" class="tech-input" value="1000" min="1">
      </div>
      <div class="info-panel">
        <div class="info-row"><span>系统估值(参考):</span><span class="val-highlight" id="priv-base-price">-</span></div>
        <div class="info-row"><span>市场调整:</span><span class="market-adjust" id="priv-market">-</span></div>
        <div class="info-row"><span>总金额:</span><span class="val-highlight" id="priv-total">-</span></div>
        <div class="info-row"><span>NPC态度预测:</span><span id="priv-attitude">-</span></div>
        <div class="info-row"><span>触发方式:</span><span class="val-highlight" id="priv-trigger">-</span></div>
        <div class="info-row"><span>有效期至:</span><span class="val-highlight" id="priv-expiry">-</span></div>
        <div class="info-row"><span>来源:</span><span class="val-highlight" id="priv-source">-</span></div>
        <div class="info-row"><span>物品说明:</span><span class="val-highlight" style="white-space: normal; text-align: right;" id="priv-desc">-</span></div>
      </div>
      <button class="action-btn" id="btn-private">执行交易</button>
    </div>

    <!-- 拍卖行 -->
    <div id="tab-auction" class="tab-content">
      <div class="form-group">
        <label>当前拍品</label>
        <select id="auc-item-sel" class="tech-select"></select>
      </div>
      <div class="form-group">
        <label>竞拍出价</label>
        <input type="number" id="auc-bid" class="tech-input" value="0" min="1">
      </div>
      <div class="info-panel">
        <div class="info-row"><span>当前起拍/最高价:</span><span class="val-highlight" id="auc-current-price">-</span></div>
        <div class="info-row"><span>拍品描述:</span><span class="val-highlight" style="white-space: normal; text-align: right;" id="auc-desc">-</span></div>
      </div>
      <button class="action-btn" id="btn-auc">参与竞拍</button>
    </div>
  </div>
</div>
`;

const HIDDEN_ARBITRATION_NARRATION_RULES = `
[前端仲裁器说明]
以下内容属于隐藏仲裁结果，不要在正文中直接复述“成功率 / Roll / 仲裁结果 / JSONPatch / 系统分析”等字样。
请将仲裁结论转写成自然剧情，只描写交易动作、议价还价、竞拍过程、物资流转与角色反应。
玩家应当看到的是经过修饰后的剧情文本，而不是系统裁定日志。
`.trim();

const SOUL_TOWER_DISCOUNT_STORE_NAME = '魂灵塔特许兑换';
const SOUL_TOWER_EMPTY_DISCOUNT_SPIRIT = Object.freeze({
  层数: 0,
  名称: '',
  标准物种: '',
  年限: 0,
  品质: '',
  已使用: false,
});
const 传灵塔万年魂灵开放tick = 814960;
const SOUL_TOWER_QUALITY_PRICE_MULTIPLIER = Object.freeze({
  F: 0.75,
  D: 0.9,
  C: 1.0,
  B: 1.15,
  A: 1.35,
  S: 1.65,
  'S+': 1.95,
});

const 交易物品定义分类列表 = Object.freeze([
  '锻造金属',
  '制造材料',
  '设计图纸',
  '主武器',
  '防具装备',
  '斗铠部件',
  '机甲机体',
  '魂骨',
  '魂灵',
  '魂技造物',
  '天然灵物',
  '丹药',
  '身份票据',
  '修炼秘籍',
  '一次性武器',
  '一次性道具',
  '剧情杂物',
]);
const 交易物品定义分类集合 = new Set(交易物品定义分类列表);
const 交易可使用物品分类集合 = new Set(['丹药', '天然灵物', '一次性武器', '一次性道具', '魂技造物']);
const 交易装备物品分类集合 = new Set(['主武器', '防具装备', '斗铠部件', '机甲机体', '魂骨']);
const 交易物品经济品质列表 = Object.freeze(['普通', '优秀', '稀有', '史诗', '传说', '神器', '超神器']);
const 交易物品经济品质集合 = new Set(交易物品经济品质列表);
const 交易物品经济品质倍率 = Object.freeze({ 普通: 1, 优秀: 1.25, 稀有: 2, 史诗: 5, 传说: 20, 神器: 1, 超神器: 1 });

class TradeUIComponent {
  constructor(container, snapshot, options = {}) {
    this.container = container;
    this.snapshot = snapshot;
    this.options = options;

    this.initDOM();
    this.bindEvents();
    this.syncData();
    this.applyInitialContext();
  }

  initDOM() {
    if (!document.getElementById('trade-ui-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'trade-ui-styles';
      styleEl.textContent = TradeStyles;
      document.head.appendChild(styleEl);
    }
    this.container.innerHTML = TradeTemplate;
  }

  $(selector) {
    return this.container.querySelector(selector);
  }

  $$ (selector) {
    return this.container.querySelectorAll(selector);
  }

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

  setActiveTab(targetId, shouldSync = true) {
    const safeTarget = String(targetId || '').trim();
    if (!safeTarget || !this.$(`#${safeTarget}`)) return false;
    this.$$('.trade-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.target === safeTarget);
    });
    this.$$('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === safeTarget);
    });
    if (shouldSync) this.syncData();
    return true;
  }

  getCurrentUiState() {
    return {
      activeTab: this.container.querySelector('.trade-tab.active')?.dataset.target || 'tab-shop',
      shopStore: this.$('#shop-store-sel')?.value || '',
      shopItem: this.$('#shop-item-sel')?.value || '',
      shopQty: this.$('#shop-qty')?.value || '1',
      sellItem: this.$('#sell-item-sel')?.value || '',
      sellQty: this.$('#sell-qty')?.value || '1',
      privAction: this.$('#priv-action')?.value || '私下买入',
      privNpc: this.$('#priv-npc')?.value || '',
      privItem: this.$('#priv-item')?.value || '',
      privQty: this.$('#priv-qty')?.value || '1',
      privPrice: this.$('#priv-price')?.value || '1000',
      aucItem: this.$('#auc-item-sel')?.value || '',
      aucBid: this.$('#auc-bid')?.value || '0'
    };
  }

  setSelectIfExists(selector, value) {
    const el = this.$(selector);
    if (!el) return;
    const hasValue = Array.from(el.options || []).some(opt => opt.value === value);
    if (hasValue) el.value = value;
  }

  restoreUiState(state = {}) {
    this.setSelectIfExists('#shop-store-sel', state.shopStore);
    this.updateShopItems();
    this.setSelectIfExists('#shop-item-sel', state.shopItem);
    if (this.$('#shop-qty')) this.$('#shop-qty').value = state.shopQty || '1';

    this.setSelectIfExists('#sell-item-sel', state.sellItem);
    if (this.$('#sell-qty')) this.$('#sell-qty').value = state.sellQty || '1';

    if (this.$('#priv-action')) this.$('#priv-action').value = state.privAction || '私下买入';
    if (this.$('#priv-npc')) this.$('#priv-npc').value = state.privNpc || '';
    if (this.$('#priv-item')) this.$('#priv-item').value = state.privItem || '';
    if (this.$('#priv-qty')) this.$('#priv-qty').value = state.privQty || '1';
    if (this.$('#priv-price')) this.$('#priv-price').value = state.privPrice || '1000';

    this.setSelectIfExists('#auc-item-sel', state.aucItem);
    if (this.$('#auc-bid')) this.$('#auc-bid').value = state.aucBid || '0';

    this.setActiveTab(state.activeTab || 'tab-shop', false);
    this.updateShopPreview();
    this.updateSellPreview();
    this.updatePrivPreview();
    this.updateAucPreview();
  }

  applyInitialContext() {
    const initialTab = String(this.options.initialTab || '').trim();
    if (initialTab) this.setActiveTab(initialTab, false);

    const prefillNpc = String(this.options.prefillNpc || '').trim();
    if (prefillNpc && this.$('#priv-npc')) {
      this.$('#priv-npc').value = prefillNpc;
      if (this.options.lockNpc === true) {
        this.$('#priv-npc').readOnly = true;
        const group = this.$('#priv-npc').closest('.form-group');
        if (group) group.classList.add('is-context-locked');
      }
    }

    const preferredStore = String(this.options.preferredStore || '').trim();
    const storeSel = this.$('#shop-store-sel');
    if (preferredStore && storeSel) {
      const hasStore = Array.from(storeSel.options || []).some(opt => opt.value === preferredStore);
      if (hasStore) storeSel.value = preferredStore;
    }

    this.updateShopItems();

    const prefillAction = String(this.options.prefillAction || '').trim();
    if (prefillAction && this.$('#priv-action')) {
      const actionText = /出售|卖出|sell/i.test(prefillAction) ? '私下卖出' : '私下买入';
      this.$('#priv-action').value = actionText;
    }

    const prefillItem = String(this.options.prefillItem || '').trim();
    if (prefillItem) {
      if (initialTab === 'tab-private' && this.$('#priv-item')) this.$('#priv-item').value = prefillItem;
      if (initialTab === 'tab-shop') this.setSelectIfExists('#shop-item-sel', prefillItem);
      if (initialTab === 'tab-sell') this.setSelectIfExists('#sell-item-sel', prefillItem);
      if (initialTab === 'tab-auction') this.setSelectIfExists('#auc-item-sel', prefillItem);
    }

    const prefillQty = Math.max(1, Number(this.options.prefillQty || this.options.数量 || 0));
    if (prefillQty > 0) {
      if (this.$('#shop-qty')) this.$('#shop-qty').value = String(prefillQty);
      if (this.$('#sell-qty')) this.$('#sell-qty').value = String(prefillQty);
      if (this.$('#priv-qty')) this.$('#priv-qty').value = String(prefillQty);
    }

    const prefillPrice = Math.max(0, Number(this.options.prefillPrice || this.options.价格 || 0));
    if (prefillPrice > 0) {
      if (this.$('#priv-price')) this.$('#priv-price').value = String(prefillPrice);
      if (this.$('#auc-bid')) this.$('#auc-bid').value = String(prefillPrice);
    }

    this.updateSellPreview();
    this.updatePrivPreview();
    this.updateAucPreview();

    if (this.options.autoExecute) {
      window.setTimeout(() => this.runInitialAutoExecute(), 80);
    }
  }

  runInitialAutoExecute() {
    const activeTab = this.container.querySelector('.trade-tab.active')?.dataset.target || 'tab-shop';
    if (activeTab === 'tab-shop' && !this.$('#btn-buy')?.disabled) this.executeShopBuy();
    else if (activeTab === 'tab-sell' && !this.$('#btn-sell')?.disabled) this.executeSell();
    else if (activeTab === 'tab-private' && !this.$('#btn-private')?.disabled) this.executePrivateTrade();
    else if (activeTab === 'tab-auction' && !this.$('#btn-auc')?.disabled) this.executeAuction();
  }

  bindEvents() {
    this.$$('.trade-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.setActiveTab(tab.dataset.target);
      });
    });

    // Shop Events
    this.$('#shop-store-sel').addEventListener('change', () => this.updateShopItems());
    this.$('#shop-item-sel').addEventListener('change', () => this.updateShopPreview());
    this.$('#shop-qty').addEventListener('input', () => this.updateShopPreview());
    this.$('#btn-buy').addEventListener('click', () => this.executeShopBuy());

    // Sell Events
    this.$('#sell-item-sel').addEventListener('change', () => this.updateSellPreview());
    this.$('#sell-qty').addEventListener('input', () => this.updateSellPreview());
    this.$('#btn-sell').addEventListener('click', () => this.executeSell());

    // Private Events
    this.$('#priv-action').addEventListener('change', () => this.updatePrivPreview());
    this.$('#priv-npc').addEventListener('input', () => this.updatePrivPreview());
    this.$('#priv-item').addEventListener('input', () => this.updatePrivPreview());
    this.$('#priv-qty').addEventListener('input', () => this.updatePrivPreview());
    this.$('#priv-price').addEventListener('input', () => this.updatePrivPreview());
    this.$('#btn-private').addEventListener('click', () => this.executePrivateTrade());

    // Auction Events
    this.$('#auc-item-sel').addEventListener('change', () => this.updateAucPreview());
    this.$('#auc-bid').addEventListener('input', () => this.updateAucPreview());
    this.$('#btn-auc').addEventListener('click', () => this.executeAuction());
  }

  updateData(newSnapshot) {
    const currentState = this.getCurrentUiState();
    this.snapshot = newSnapshot;
    this.syncData();
    this.restoreUiState(currentState);
  }

  destroy() {
    this.container.innerHTML = '';
  }

  get charData() {
    return this.snapshot?.activeChar || {};
  }

  get worldData() {
    return this.snapshot?.sd?.world || this.snapshot?.rootData?.world || {};
  }

  get rootData() {
    return this.snapshot?.sd || this.snapshot?.rootData || {};
  }

  get itemDefinitions() {
    const table = this.rootData?.物品;
    return table && typeof table === 'object' ? table : {};
  }

  规范化物品定义分类(分类 = '', fallback = '剧情杂物') {
    const 文本 = String(分类 || '').trim();
    return 交易物品定义分类集合.has(文本) ? 文本 : fallback;
  }

  遍历物品定义(回调 = () => {}) {
    const 物品表 = this.itemDefinitions;
    交易物品定义分类列表.forEach(分类 => {
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

  取物品定义(物品名 = '') {
    return this.查找物品定义(物品名)?.定义 || {};
  }

  读取物品定义显式分类(物品 = {}, fallback = '') {
    const 来源 = 物品 && typeof 物品 === 'object' && !Array.isArray(物品) ? 物品 : {};
    return this.规范化物品定义分类(来源.物品分类 || 来源.分类 || '', fallback);
  }

  要求物品定义分类(物品名 = '', 物品 = {}, 分类 = '') {
    const 分类名 = this.规范化物品定义分类(分类 || this.读取物品定义显式分类(物品, ''), '');
    if (!分类名) throw new Error(`交易物品缺少分类：${String(物品名 || '未命名').trim() || '未命名'}`);
    return 分类名;
  }

  规范化物品经济品质(品质 = '', 物品名 = '', 分类 = '') {
    const 文本 = String(品质 || '').trim();
    if (交易物品经济品质集合.has(文本)) return 文本;
    const 判定文本 = `${物品名} ${分类} ${文本}`;
    if (/超神器/.test(判定文本)) return '超神器';
    if (/神器|神级/.test(判定文本)) return '神器';
    if (/十万年|天锻|十二级|弑神|位面核心|极限斗罗|血脉核心|战略级/.test(判定文本)) return '传说';
    if (/万年|魂锻|灵锻|顶级|机密|高级|重型|最新型|九级|八级/.test(判定文本)) return '史诗';
    if (/千年|千锻|有灵合金|稀有|战术|秘密|特殊|特种|珍贵|军用/.test(判定文本)) return '稀有';
    if (/百年|黄级|优秀|高级制式/.test(判定文本)) return '优秀';
    return '普通';
  }

  复制JSON(值, fallback = {}) {
    if (值 === undefined || 值 === null) return fallback;
    try {
      return JSON.parse(JSON.stringify(值));
    } catch (错误) {
      return fallback;
    }
  }

  读取背包总数量(记录 = {}) {
    const 来源 = 记录 && typeof 记录 === 'object' && !Array.isArray(记录) ? 记录 : {};
    const 普通数量 = Math.max(0, Math.floor(Number(来源.数量 || 0)));
    const 批次数量 = (Array.isArray(来源.批次) ? 来源.批次 : []).reduce((总数, 批次) => 总数 + Math.max(0, Math.floor(Number(批次?.数量 || 0))), 0);
    return 普通数量 + 批次数量;
  }

  规范化交易批次(来源批次 = {}, 数量 = 1, fallback = {}) {
    const 来源 = 来源批次 && typeof 来源批次 === 'object' && !Array.isArray(来源批次) ? 来源批次 : {};
    const 输出 = {
      数量: Math.max(0, Math.floor(Number(数量 ?? 来源.数量 ?? 0))),
      品质: this.规范化物品经济品质(来源.品质 ?? fallback.品质 ?? fallback.rarity, fallback.物品名 || '', fallback.分类 || ''),
      品质系数: Math.max(0.1, Math.min(2, Number(来源.品质系数 ?? fallback.品质系数 ?? 1))),
      制作者: String(来源.制作者 ?? fallback.制作者 ?? '').trim(),
      来源: String(来源.来源 ?? fallback.来源 ?? fallback.source ?? '').trim(),
      耐久: Math.max(0, Math.floor(Number(来源.耐久 ?? fallback.耐久 ?? 0))),
      绑定者: String(来源.绑定者 ?? fallback.绑定者 ?? '').trim(),
      有效期至tick: Math.max(0, Math.floor(Number(来源.有效期至tick ?? fallback.有效期至tick ?? fallback.expiryTick ?? 0))),
    };
    const 融合参数 = 来源?.副职业参数?.融合参数 || fallback?.副职业参数?.融合参数;
    if (融合参数 && typeof 融合参数 === 'object' && !Array.isArray(融合参数)) {
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
        (值 === '' || 值 === 0 || 值 === '无' || (键 === '品质' && 值 === '普通') || (键 === '品质系数' && Number(值) === 1))
      ) delete 输出[键];
    });
    return 输出.数量 > 0 ? 输出 : null;
  }

  复制批次数量(批次列表 = [], 数量 = 1, fallback = {}) {
    let 剩余 = Math.max(0, Math.floor(Number(数量 || 0)));
    const 输出 = [];
    (Array.isArray(批次列表) ? 批次列表 : []).forEach(批次 => {
      if (剩余 <= 0) return;
      const 可取 = Math.min(剩余, Math.max(0, Math.floor(Number(批次?.数量 || 0))));
      const 新批次 = this.规范化交易批次(批次, 可取, fallback);
      if (新批次) {
        输出.push(新批次);
        剩余 -= 可取;
      }
    });
    return { 批次列表: 输出, 剩余数量: 剩余 };
  }

  需要批次入库(来源 = {}) {
    const 数据 = 来源 && typeof 来源 === 'object' && !Array.isArray(来源) ? 来源 : {};
    if (Array.isArray(数据.批次) && 数据.批次.length) return true;
    if (数据.品质系数 !== undefined && Number(数据.品质系数) !== 1) return true;
    if (数据.副职业参数?.融合参数 && typeof 数据.副职业参数.融合参数 === 'object' && !Array.isArray(数据.副职业参数.融合参数)) return true;
    if (数据.耐久 !== undefined && Number(数据.耐久) > 0) return true;
    if (String(数据.制作者 || '').trim()) return true;
    if (String(数据.来源 || '').trim()) return true;
    if (String(数据.绑定者 || '').trim()) return true;
    if (Number(数据.有效期至tick || 0) > 0) return true;
    return false;
  }

  构建交易入库批次(来源 = {}, 数量 = 1, fallback = {}) {
    const 数据 = 来源 && typeof 来源 === 'object' && !Array.isArray(来源) ? 来源 : {};
    if (Array.isArray(数据.批次) && 数据.批次.length) {
      return this.复制批次数量(数据.批次, 数量, fallback).批次列表;
    }
    if (!this.需要批次入库(数据)) return [];
    const 批次 = this.规范化交易批次(数据, 数量, fallback);
    return 批次 ? [批次] : [];
  }

  计算批次价格倍率(批次 = {}) {
    const 数据 = 批次 && typeof 批次 === 'object' && !Array.isArray(批次) ? 批次 : {};
    const 品质 = this.规范化物品经济品质(数据.品质 || '普通');
    const 品质倍率 = Number(交易物品经济品质倍率[品质] || 1);
    const 品质系数 = Math.max(0.1, Math.min(2, Number(数据.品质系数 || 1)));
    const 融合率 = 数据?.副职业参数?.融合参数?.融合率;
    const 融合倍率 = 融合率 === undefined ? 1 : Math.max(0.8, Math.min(1.2, 0.8 + Number(融合率 || 0) / 250));
    return Math.max(0.01, 品质倍率 * 品质系数 * 融合倍率);
  }

  计算来源批次平均倍率(来源 = {}, 数量 = 1) {
    const 数据 = 来源 && typeof 来源 === 'object' && !Array.isArray(来源) ? 来源 : {};
    const 目标数量 = Math.max(1, Math.floor(Number(数量 || 1)));
    const 批次结果 = Array.isArray(数据.批次) && 数据.批次.length
      ? this.复制批次数量(数据.批次, 目标数量)
      : { 批次列表: this.需要批次入库(数据) ? this.构建交易入库批次(数据, 目标数量) : [], 剩余数量: 0 };
    if (!批次结果.批次列表.length) return 1;
    const 加权 = 批次结果.批次列表.reduce((总和, 批次) => 总和 + this.计算批次价格倍率(批次) * Math.max(0, Number(批次.数量 || 0)), 0);
    const 数量合计 = 批次结果.批次列表.reduce((总和, 批次) => 总和 + Math.max(0, Number(批次.数量 || 0)), 0);
    return 数量合计 > 0 ? Math.max(0.01, 加权 / 数量合计) : 1;
  }

  构建背包扣减值(记录 = {}, 数量 = 1) {
    const 当前 = this.复制JSON(记录, {});
    let 剩余扣减 = Math.max(1, Math.floor(Number(数量 || 1)));
    const 批次列表 = Array.isArray(当前.批次) ? 当前.批次.map(批次 => this.复制JSON(批次, {})).filter(批次 => Math.max(0, Number(批次?.数量 || 0)) > 0) : [];
    for (const 批次 of 批次列表) {
      if (剩余扣减 <= 0) break;
      const 当前批次数量 = Math.max(0, Math.floor(Number(批次.数量 || 0)));
      const 扣减 = Math.min(当前批次数量, 剩余扣减);
      批次.数量 = 当前批次数量 - 扣减;
      剩余扣减 -= 扣减;
    }
    当前.批次 = 批次列表.filter(批次 => Math.max(0, Number(批次.数量 || 0)) > 0);
    if (剩余扣减 > 0) 当前.数量 = Math.max(0, Math.floor(Number(当前.数量 || 0)) - 剩余扣减);
    if (!当前.批次.length) delete 当前.批次;
    return this.读取背包总数量(当前) > 0 ? 当前 : null;
  }

  构建交易物品定义(物品名 = '', 来源物品 = {}, fallback = {}) {
    const 来源 = 来源物品 && typeof 来源物品 === 'object' && !Array.isArray(来源物品) ? JSON.parse(JSON.stringify(来源物品)) : {};
    const 分类 = this.要求物品定义分类(物品名, 来源, fallback.分类);
    const 定义 = {
      阶位: Math.max(0, Math.floor(Number(来源.阶位 || 0))),
      品质: this.规范化物品经济品质(来源.品质 || fallback.rarity || 来源.品级 || '普通', 物品名, 分类),
      描述: 来源.描述 || fallback.desc || `获得了【${物品名}】。`,
      基础价格: Math.max(0, Math.floor(Number(来源.基础价格 || 来源.价格 || this.estimateBasePrice(物品名, 分类) || 0))),
      默认货币: 来源.默认货币 || 来源.货币 || fallback.currency || '联邦币',
    };
    if (交易装备物品分类集合.has(分类)) {
      if (来源.装备槽位) 定义.装备槽位 = 来源.装备槽位;
      else if (分类 === '主武器') 定义.装备槽位 = '武器';
      else if (分类 === '防具装备') 定义.装备槽位 = '防具';
      if (Number(来源.基础耐久 || 0) > 0) 定义.基础耐久 = Math.max(0, Math.floor(Number(来源.基础耐久 || 0)));
      if (来源.属性加成 && typeof 来源.属性加成 === 'object' && !Array.isArray(来源.属性加成)) 定义.属性加成 = 来源.属性加成;
      if (来源.装备技能 && typeof 来源.装备技能 === 'object' && !Array.isArray(来源.装备技能)) 定义.装备技能 = 来源.装备技能;
      if (来源.附带魂技 && typeof 来源.附带魂技 === 'object' && !Array.isArray(来源.附带魂技)) 定义.附带魂技 = 来源.附带魂技;
    }
    if (交易可使用物品分类集合.has(分类)) {
      if (Array.isArray(来源.使用效果) && 来源.使用效果.length) {
        定义.使用效果 = 来源.使用效果.map(效果 => {
          if (!效果 || typeof 效果 !== 'object' || Array.isArray(效果)) return 效果;
          const 清理效果 = { ...效果 };
          delete 清理效果.描述;
          return 清理效果;
        });
      }
      if (Array.isArray(来源.副作用列表) && 来源.副作用列表.length) 定义.副作用列表 = 来源.副作用列表;
    }
    if (分类 === '锻造金属') {
      const 副职业参数 = {};
      const 来源副职业参数 = 来源.副职业参数 && typeof 来源.副职业参数 === 'object' && !Array.isArray(来源.副职业参数) ? 来源.副职业参数 : {};
      ['提纯度', '灵力值', '灵性', '锻造特性'].forEach(字段名 => {
        if (来源副职业参数[字段名] !== undefined) 副职业参数[字段名] = 来源副职业参数[字段名];
      });
      if (Object.keys(副职业参数).length) 定义.副职业参数 = 副职业参数;
    }
    if (分类 === '魂灵') {
      const 来源副职业参数 = 来源.副职业参数 && typeof 来源.副职业参数 === 'object' && !Array.isArray(来源.副职业参数) ? 来源.副职业参数 : {};
      const 魂灵参数 = {};
      ['年限', '标准物种'].forEach(字段名 => {
        if (来源副职业参数[字段名] !== undefined) 魂灵参数[字段名] = 来源副职业参数[字段名];
      });
      if (Object.keys(魂灵参数).length) 定义.副职业参数 = 魂灵参数;
    }
    if (分类 === '制造材料' && 来源.材料用途 !== undefined && String(来源.材料用途).trim()) {
      定义.材料用途 = String(来源.材料用途).trim();
    }
    if (分类 === '设计图纸') {
      ['图纸目标', '适用阶位', '产出方向'].forEach(字段名 => {
        if (来源[字段名] !== undefined && String(来源[字段名]).trim()) 定义[字段名] = 来源[字段名];
      });
    }
    if (分类 === '修炼秘籍') {
      if (来源.获取条件 !== undefined) 定义.获取条件 = 来源.获取条件;
      if (来源.研读条件 !== undefined) 定义.研读条件 = 来源.研读条件;
      if (来源.解锁内容 !== undefined) 定义.解锁内容 = 来源.解锁内容;
    }
    Object.keys(定义).forEach(键 => {
      const 值 = 定义[键];
      if (值 === undefined || 值 === null || 值 === '' || (Array.isArray(值) && !值.length)) delete 定义[键];
      else if (值 && typeof 值 === 'object' && !Array.isArray(值) && !Object.keys(值).length) delete 定义[键];
    });
    return { 分类, 定义 };
  }

  get marketData() {
    return this.snapshot?.市场派生 || {};
  }

  get allChars() {
    return this.snapshot?.sd?.char || this.snapshot?.rootData?.char || {};
  }

  get activeName() {
    const chars = this.allChars || {};
    const snapshotActive = String(this.snapshot?.activeName || '').trim();
    if (snapshotActive && chars[snapshotActive]) return snapshotActive;

    const playerName = String(this.snapshot?.sd?.sys?.玩家名 || this.snapshot?.rootData?.sys?.玩家名 || '').trim();
    if (playerName && chars[playerName]) return playerName;
    if (chars['主角']) return '主角';

    const firstName = Object.keys(chars)[0];
    return firstName || '主角';
  }

  get activeCharBasePath() {
    return `/char/${this.escapeJsonPointer(this.activeName)}`;
  }

  getCurrencyLabel(currency) {
    return {
      联邦币: '联邦币',
      星罗币: '星罗币',
      唐门积分: '唐门积分',
      学院积分: '学院积分',
      战功: '战功',
    }[currency] || '联邦币';
  }

  getDefaultCurrencyByContext(storeName = '', loc = '', storeData = null) {
    const storeText = String(storeName || '');
    const locText = String(loc || this.charData?.状态?.位置 || '');
    const storeFaction = String(storeData?.所属势力 || '');
    const merged = `${storeText}|${locText}|${storeFaction}`;
    if (/血神军团战备|战功商店|军需处/.test(merged)) return '战功';
    if (/唐门/.test(merged)) return '唐门积分';
    if (/史莱克|海神阁|内院|外院/.test(merged)) return '学院积分';
    if (/星罗/.test(merged)) return '星罗币';
    return '联邦币';
  }

  resolveTradeCurrency(item = {}, storeName = '', loc = '', storeData = null) {
    const explicit = String(item?.货币 || item?.默认货币 || '').trim();
    return explicit || this.getDefaultCurrencyByContext(storeName, loc, storeData);
  }

  isCurrencySpendable(currency) {
    return currency !== '战功';
  }

  getCurrencyBlockedMessage(currency) {
    if (currency === '战功') return '战功不能直接用于购物，只能用于军方晋升、审批或资格申领。';
    return '当前货币不可直接用于交易。';
  }

  syncData() {
    const loc = this.charData?.状态?.位置 || "未知区域";
    const fedCoin = this.charData?.财富?.联邦币 || 0;
    const fame = this.charData?.社交?.声望 || 0;

    this.$('#ui-loc').textContent = loc;
    this.$('#ui-fedcoin').textContent = fedCoin.toLocaleString();
    this.$('#ui-fame').textContent = fame.toLocaleString();

    const currentCity = this.resolveTradeLocationNode(loc);
    const currentStores = JSON.parse(JSON.stringify(currentCity?.data?.商店 || {}));
    if (this.canAccessSoulTowerDiscountStore(loc, currentCity)) {
      const discountStore = this.buildSoulTowerDiscountStoreEntry();
      if (discountStore) currentStores[SOUL_TOWER_DISCOUNT_STORE_NAME] = discountStore;
    }
    this.currentStores = currentStores;
    this.currentAuction = this.worldData?.拍卖 || { 状态: "休市", 拍品: {} };

    this.populateShopData();
    this.populateSellData();
    this.populateAuctionData();
    this.updatePrivPreview();
  }

  // --- 估值与上下文 ---
  estimateBasePrice(itemName, itemType = "物品") {
    const definitionPrice = Number(this.取物品定义(itemName)?.基础价格 || 0);
    if (Number.isFinite(definitionPrice) && definitionPrice > 0) return Math.floor(definitionPrice);
    if (/斗铠/.test(itemName)) return 0;
    if (/机甲/.test(itemName)) {
      if (/红级/.test(itemName)) return 5000000000;
      if (/黑级/.test(itemName)) return 1000000000;
      if (/紫级/.test(itemName)) return 80000000;
      if (/黄级/.test(itemName)) return 6000000;
      return 6000000;
    }
    let tier = 1;
    if (/天锻|十万年/.test(itemName)) tier = 5;
    else if (/魂锻|万年/.test(itemName)) tier = 4;
    else if (/灵锻|千年/.test(itemName)) tier = 3;
    else if (/千锻|百年/.test(itemName)) tier = 2;
    else if (/百锻/.test(itemName)) tier = 1;

    let metalBasePrice = 10000;
    if (tier === 5) metalBasePrice = 500000000;
    else if (tier === 4) metalBasePrice = 80000000;
    else if (tier === 3) metalBasePrice = 10000000;
    else if (tier === 2) metalBasePrice = 500000;
    else if (tier === 1) metalBasePrice = 50000;

    let metalCount = 1;
    let match = itemName.match(/(\d+)种金属/);
    if (match) metalCount = parseInt(match[1]);
    else if (/融锻/.test(itemName)) metalCount = 2;

    let totalMetalPrice = metalBasePrice * (1 + (metalCount - 1) * 0.3);

    if (itemType === "图纸") return Math.floor(totalMetalPrice * 0.2);
    else if (itemType === "消耗品" || itemType === "修复品") return Math.floor(totalMetalPrice * 0.1);
    else return Math.floor(totalMetalPrice * 1.0);
  }

  clampMarketMultiplier(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 1;
    return Math.max(0.7, Math.min(1.6, num));
  }

  getMarketMultiplier(kind = 'buy') {
    const key = kind === 'sell' ? '卖出倍率' : '买入倍率';
    return this.clampMarketMultiplier(this.marketData?.[key] ?? 1);
  }

  getMarketAdjustedPrice(basePrice, kind = 'buy', options = {}) {
    const base = Math.max(0, Math.floor(Number(basePrice || 0)));
    if (options.fixed === true) return base;
    return Math.max(0, Math.floor(base * this.getMarketMultiplier(kind)));
  }

  getMarketAdjustmentText(kind = 'buy', options = {}) {
    if (options.fixed === true) return '固定价格';
    const multiplier = this.getMarketMultiplier(kind);
    const percent = Math.round((multiplier - 1) * 100);
    const note = String(this.marketData?.说明 || '平稳').trim() || '平稳';
    const prefix = percent > 0 ? `+${percent}%` : `${percent}%`;
    return percent === 0 ? note : `${prefix} · ${note}`;
  }

  clampTrade(value, min, max) {
    return Math.max(min, Math.min(max, Number(value || 0)));
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

  isLocationCompatible(currentLoc, targetLoc) {
    const current = this.normalizeLocForMatch(currentLoc);
    const target = this.normalizeLocForMatch(targetLoc);
    if (!current.raw || !target.raw) return current.raw === target.raw;
    if (current.raw === target.raw || current.leaf === target.leaf) return true;
    return current.segments.some(seg => target.segments.includes(seg));
  }

  resolveTradeLocationNode(location) {
    const worldLocations = this.worldData?.地点 || {};
    const raw = String(location || '').trim();
    const normalized = this.normalizeLocForMatch(raw);
    const candidates = [raw, normalized.raw, normalized.segments[0] || '', normalized.leaf || ''].filter(Boolean);
    for (const key of candidates) {
      if (worldLocations[key]) return { key, data: worldLocations[key] };
    }
    return { key: '', data: null };
  }

  getPrivateTradeContext(action, targetNpcName, itemName, qty, price) {
    const ctx = {
      action, targetNpcName, targetChar: null, relationScore: 0, successRate: 0,
      basePrice: Math.max(0, this.estimateBasePrice(itemName, "物品")),
      marketPrice: 0,
      total: Math.max(0, Number(price || 0) * Math.max(1, Number(qty || 1))),
      error: null, note: '', npcItem: null, playerItem: null
    };
    if (!itemName) { ctx.error = '请输入交易物品名称。'; return ctx; }
    if (!targetNpcName) { ctx.error = '请输入交易对象 NPC。'; return ctx; }

    const resolvedTarget = this.resolveCharacterByName(targetNpcName);
    const targetChar = resolvedTarget.char;
    const relationName = resolvedTarget.displayName || targetNpcName;
    ctx.targetChar = targetChar || null;
    if (!targetChar) { ctx.error = `找不到交易对象【${targetNpcName}】。`; return ctx; }

    const currentLoc = String(this.charData?.状态?.位置 || '');
    const targetLoc = String(targetChar?.状态?.位置 || '');
    if (currentLoc && targetLoc && !this.isLocationCompatible(currentLoc, targetLoc)) {
      ctx.error = `【${targetNpcName}】当前不在你身边，无法进行私下交易。`; return ctx;
    }
    if (ctx.basePrice <= 0) {
      ctx.error = `【${itemName}】当前无法进行可靠估值，私下交易无法发起。`; return ctx;
    }
    
    ctx.relationScore = Number(this.charData?.社交?.关系?.[targetNpcName]?.好感度 || this.charData?.社交?.关系?.[relationName]?.好感度 || 0);

    if (action === "私下买入") {
      ctx.npcItem = targetChar?.背包?.[itemName] || null;
      ctx.basePrice = Math.max(0, Math.floor(ctx.basePrice * this.计算来源批次平均倍率(ctx.npcItem || {}, qty)));
      ctx.marketPrice = this.getMarketAdjustedPrice(ctx.basePrice, 'buy');
      const priceDeltaRatio = (Number(price || 0) - ctx.marketPrice) / Math.max(1, ctx.marketPrice);
      if ((this.charData?.财富?.联邦币 || 0) < ctx.total) {
        ctx.error = `联邦币不足，完成该交易需要 ${ctx.total.toLocaleString()}。`; return ctx;
      }
      if (!ctx.npcItem || this.读取背包总数量(ctx.npcItem) < qty) {
        ctx.error = `【${targetNpcName}】当前并没有足够的【${itemName}】可供出售。`; return ctx;
      }
      ctx.successRate = this.clampTrade(60 + Math.floor(ctx.relationScore * 0.25) + Math.floor(priceDeltaRatio * 50), 5, 95);
      ctx.note = `好感 ${ctx.relationScore} / 市场价 ${ctx.marketPrice.toLocaleString()} / 预计成交率 ${ctx.successRate}%`;
    } else {
      ctx.playerItem = this.charData?.背包?.[itemName] || null;
      ctx.basePrice = Math.max(0, Math.floor(ctx.basePrice * this.计算来源批次平均倍率(ctx.playerItem || {}, qty)));
      ctx.marketPrice = this.getMarketAdjustedPrice(ctx.basePrice, 'sell');
      const priceDeltaRatio = (Number(price || 0) - ctx.marketPrice) / Math.max(1, ctx.marketPrice);
      if (!ctx.playerItem || this.读取背包总数量(ctx.playerItem) < qty) {
        ctx.error = '背包数量不足。'; return ctx;
      }
      if ((targetChar?.财富?.联邦币 || 0) < ctx.total) {
        ctx.error = `【${targetNpcName}】的联邦币不足，无法完成这笔收购。`; return ctx;
      }
      ctx.successRate = this.clampTrade(60 + Math.floor(ctx.relationScore * 0.25) - Math.floor(priceDeltaRatio * 55), 5, 95);
      ctx.note = `好感 ${ctx.relationScore} / 市场价 ${ctx.marketPrice.toLocaleString()} / 预计成交率 ${ctx.successRate}%`;
    }
    return ctx;
  }

  formatTickToCalendarDateText(tickValue) {
    const safeTick = Math.max(0, Number(tickValue || 0));
    const totalMinutes = safeTick * 10;
    const days = Math.floor(totalMinutes / (24 * 60));
    const years = Math.floor(days / 360);
    const months = Math.floor((days % 360) / 30) + 1;
    const currentDay = (days % 30) + 1;
    const remainderMinutes = totalMinutes % (24 * 60);
    const hours = Math.floor(remainderMinutes / 60);
    const mins = remainderMinutes % 60;
    return `斗罗历${20000 + years}年${months}月${currentDay}日 ${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  getCurrentWorldHour() {
    const 当前tick = Math.max(0, Number(this.worldData?.时间?.tick || 0));
    const 当日分钟 = ((当前tick * 10) % (24 * 60) + (24 * 60)) % (24 * 60);
    return Math.floor(当日分钟 / 60);
  }

  getCurrentWorldTimeParts() {
    const 当前tick = Math.max(0, Number(this.worldData?.时间?.tick || 0));
    const 当日分钟 = ((当前tick * 10) % (24 * 60) + (24 * 60)) % (24 * 60);
    return {
      小时: Math.floor(当日分钟 / 60),
      分钟: Math.floor(当日分钟 % 60),
    };
  }

  isShopOpenNow() {
    const 当前小时 = this.getCurrentWorldHour();
    return 当前小时 >= 9 && 当前小时 < 22;
  }

  getShopOpenStateText() {
    const 当前时间 = this.getCurrentWorldTimeParts();
    const 时间文本 = `${String(当前时间.小时).padStart(2, '0')}:${String(当前时间.分钟).padStart(2, '0')}`;
    return this.isShopOpenNow() ? `营业中 ${时间文本}` : `已关门 ${时间文本}`;
  }

  resolveTradeItemInfo(itemName, item = {}, fallback = {}) {
    const 命中定义 = this.查找物品定义(itemName);
    const safeItem = { ...(命中定义?.定义 || {}), ...(item && typeof item === 'object' ? item : {}) };
    const type = String(this.规范化物品定义分类(命中定义?.分类 || fallback.分类 || this.读取物品定义显式分类(safeItem, ''), '剧情杂物'));
    const rarity = String(safeItem.品质 || fallback.rarity || '普通');
    const expiryTick = Number(safeItem.有效期至tick ?? fallback.expiryTick ?? 0);
    const expiry = expiryTick > 0 ? this.formatTickToCalendarDateText(expiryTick) : (String(fallback.expiry || '').trim() || '无期限');
    const trigger = '使用';
    const source = String(safeItem.来源 || safeItem.绑定者 || fallback.source || '常规流通');
    const desc = String(safeItem.描述 || fallback.desc || '暂无说明');
    return {
      name: itemName,
      type,
      rarity,
      trigger,
      expiry,
      source,
      desc,
      expiryTick,
      temporary: expiryTick > 0 || expiry !== '无期限'
    };
  }

  updateTradeMetaPanel(prefix, info = null) {
    const triggerEl = this.$(`#${prefix}-trigger`);
    const expiryEl = this.$(`#${prefix}-expiry`);
    const sourceEl = this.$(`#${prefix}-source`);
    const descEl = this.$(`#${prefix}-desc`);
    if (!triggerEl || !expiryEl || !sourceEl || !descEl) return;
    if (!info) {
      triggerEl.textContent = '-';
      expiryEl.textContent = '-';
      sourceEl.textContent = '-';
      descEl.textContent = '-';
      return;
    }
    triggerEl.textContent = info.trigger || '-';
    expiryEl.textContent = info.expiry || '-';
    sourceEl.textContent = info.source || '-';
    descEl.textContent = info.desc || '-';
  }

  buildInventoryItemFromTradeSource(itemName, sourceItem = {}, qty = 1, fallback = {}) {
    const 命中定义 = this.查找物品定义(itemName);
    const safeItem = { ...(命中定义?.定义 || {}), ...(sourceItem && typeof sourceItem === 'object' ? JSON.parse(JSON.stringify(sourceItem)) : {}) };
    const { 分类, 定义: definition } = this.构建交易物品定义(itemName, safeItem, { ...fallback, 分类: 命中定义?.分类 || fallback.分类 });
    const resolvedExpiryTick = Number(safeItem.有效期至tick ?? fallback.expiryTick ?? 0);
    const state = { 数量: Math.max(0, Math.floor(Number(qty || 1))) };
    if (resolvedExpiryTick > 0) state.有效期至tick = resolvedExpiryTick;
    if (safeItem.绑定者 !== undefined) state.绑定者 = safeItem.绑定者;
    if (fallback.source !== undefined || safeItem.来源 !== undefined) state.来源 = safeItem.来源 || fallback.source;
    if (Number(safeItem.耐久 || 0) > 0) state.耐久 = Math.max(0, Math.floor(Number(safeItem.耐久 || 0)));
    const 批次列表 = this.构建交易入库批次(safeItem, qty, {
      物品名: itemName,
      分类,
      品质: safeItem.品质 || fallback.rarity,
      来源: state.来源,
      绑定者: state.绑定者,
      有效期至tick: state.有效期至tick,
      耐久: state.耐久,
    });
    if (批次列表.length) {
      state.数量 = 0;
      state.批次 = 批次列表;
      ['来源', '绑定者', '有效期至tick', '耐久'].forEach(字段名 => delete state[字段名]);
    }
    return { definition, 分类, state };
  }

  buildTradeItemMetadataPatches(itemPath, currentItem = {}, nextItem = {}) {
    return [];
  }

  appendItemDefinitionPatch(patches, itemName, definition = {}, 分类 = '') {
    if (!itemName || !definition || typeof definition !== 'object') return;
    if (this.查找物品定义(itemName)) return;
    const 分类名 = this.要求物品定义分类(itemName, definition, 分类);
    patches.push({ op: 'replace', path: `/物品/${this.escapeJsonPointer(分类名)}/${this.escapeJsonPointer(itemName)}`, value: definition });
  }

  appendInventoryGainPatches(patches, charBasePath, inventory = {}, itemName = '', tradeItem = {}) {
    const current = inventory?.[itemName];
    const itemPath = `${charBasePath}/背包/${this.escapeJsonPointer(itemName)}`;
    if (current) {
      const next = this.复制JSON(current, {});
      const 追加批次 = Array.isArray(tradeItem.state?.批次) ? tradeItem.state.批次 : [];
      if (追加批次.length) {
        next.批次 = [...(Array.isArray(next.批次) ? next.批次 : []), ...追加批次.map(批次 => this.复制JSON(批次, {}))];
        if (next.数量 === undefined) next.数量 = 0;
      } else {
        next.数量 = Number(next.数量 || 0) + Number(tradeItem.state?.数量 || 1);
      }
      patches.push({ op: 'replace', path: itemPath, value: next });
    } else {
      patches.push({ op: 'replace', path: itemPath, value: tradeItem.state || { 数量: 1 } });
    }
  }

  appendInventoryConsumePatches(patches, charBasePath, inventory = {}, itemName = '', qty = 1) {
    const current = inventory?.[itemName];
    const itemPath = `${charBasePath}/背包/${this.escapeJsonPointer(itemName)}`;
    const next = this.构建背包扣减值(current, qty);
    if (!next) patches.push({ op: 'remove', path: itemPath });
    else patches.push({ op: 'replace', path: itemPath, value: next });
  }

  escapeJsonPointer(str) {
    return String(str).replace(/~/g, '~0').replace(/\//g, '~1');
  }

  buildTradeSystemPatches(logText, options = {}) {
    const patches = [
      { op: "replace", path: `/sys/系统播报`, value: String(logText || '') }
    ];
    if (Number.isFinite(Number(options.successRate))) {
      patches.push({ op: "replace", path: `/sys/最终成功率`, value: Number(options.successRate) });
    }
    return patches;
  }

  buildTradeNarrationPrompt(logText, sections = []) {
    const safeSections = Array.isArray(sections)
      ? sections.map(section => String(section || '').trim()).filter(Boolean)
      : [];
    return [
      HIDDEN_ARBITRATION_NARRATION_RULES,
      '[前端结算已完成]',
      '本次交易涉及的货币、库存、背包与系统播报已经写入 MVU，不要重复改账、改库存，也不要再次仲裁同一笔交易。',
      String(logText || '').trim(),
      ...safeSections,
    ].filter(Boolean).join('\n\n');
  }

  normalizeSoulTowerDiscountSpiritRecord(record = {}) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return { ...SOUL_TOWER_EMPTY_DISCOUNT_SPIRIT };
    const next = { ...SOUL_TOWER_EMPTY_DISCOUNT_SPIRIT };
    next.层数 = Math.max(0, Number(record.层数 || 0) | 0);
    next.名称 = String(record.名称 || '').trim();
    next.标准物种 = String(record.标准物种 || '').trim();
    next.年限 = Math.max(0, Number(record.年限 || 0) | 0);
    next.品质 = String(record.品质 || '').trim().toUpperCase().replace('＋', '+');
    next.已使用 = record.已使用 === true;
    if (!(next.层数 > 0 && next.标准物种 && next.年限 > 0 && next.品质 && next.已使用 === false)) {
      return { ...SOUL_TOWER_EMPTY_DISCOUNT_SPIRIT };
    }
    if (!next.名称) next.名称 = `${next.标准物种}魂灵`;
    return next;
  }

  hasActiveSoulTowerDiscountSpirit(record = {}) {
    return this.normalizeSoulTowerDiscountSpiritRecord(record).层数 > 0;
  }

  getActiveSoulTowerDiscountSpirit() {
    return this.normalizeSoulTowerDiscountSpiritRecord(this.charData?.魂灵塔记录?.当前五折魂灵 || {});
  }

  canAccessSoulTowerDiscountStore(location = '', currentCity = null) {
    if (/传灵塔/.test(String(location || ''))) return true;
    const stores = currentCity?.data?.商店;
    return !!stores && Object.keys(stores).some(name => /传灵塔/.test(String(name || '')));
  }

  判断传灵塔万年魂灵开放() {
    const 当前tick = Math.max(0, Math.floor(Number(this.worldData?.时间?.tick || 0)));
    if (当前tick < 传灵塔万年魂灵开放tick) return false;
    const 角色表 = this.allChars || {};
    return ['古月', '古月娜'].some(角色名 => {
      const 角色 =
        角色表[角色名] ||
        Object.values(角色表).find(候选 => {
          if (!候选 || typeof 候选 !== 'object' || Array.isArray(候选)) return false;
          return [候选.name, 候选?.base?.name, 候选?.属性?.姓名].some(名称 => String(名称 || '').trim() === 角色名);
        });
      if (!角色 || typeof 角色 !== 'object' || Array.isArray(角色)) return false;
      const 位置 = String(角色?.状态?.位置 || '').trim();
      const 势力 = 角色?.社交?.势力;
      return 位置.includes('传灵塔') && !!(势力 && typeof 势力 === 'object' && !Array.isArray(势力) && 势力['传灵塔']);
    });
  }

  getSoulTowerDiscountBasePrice(age = 0) {
    const safeAge = Math.max(0, Number(age || 0));
    if (safeAge >= 100000) return 500000000;
    if (safeAge >= 10000) return 100000000;
    if (safeAge >= 1000) return this.判断传灵塔万年魂灵开放() ? 6000000 : 20000000;
    if (safeAge >= 100) return 1000000;
    return 50000;
  }

  buildSoulTowerDiscountItemName(record = {}) {
    const normalized = this.normalizeSoulTowerDiscountSpiritRecord(record);
    if (!(normalized.层数 > 0)) return '';
    return `${normalized.标准物种}魂灵·${normalized.年限}年·${normalized.品质}`;
  }

  buildSoulTowerDiscountStoreEntry() {
    const record = this.getActiveSoulTowerDiscountSpirit();
    if (!(record.层数 > 0)) return null;
    const itemName = this.buildSoulTowerDiscountItemName(record);
    if (!itemName) return null;
    const basePrice = this.getSoulTowerDiscountBasePrice(record.年限);
    const qualityMult = Number(SOUL_TOWER_QUALITY_PRICE_MULTIPLIER[record.品质] || 1);
    const fullPrice = Math.max(1, Math.floor(basePrice * qualityMult));
    const discountPrice = Math.max(1, Math.floor(fullPrice * 0.5));
    return {
      库存: {
        [itemName]: {
          库存: 1,
          价格倍率: 0.5,
          折扣: 0,
          需求声望: 0,
          需求: {},
          _临时定义: {
            物品分类: '魂灵',
            阶位: 0,
            品质: record.品质,
            描述: `魂灵塔第${record.层数}层守塔魂灵特许兑换，当前为五折价格。`,
            基础价格: fullPrice,
            默认货币: '联邦币',
            副职业参数: { 标准物种: record.标准物种, 年限: record.年限 },
          },
          _tower_discount_virtual: true,
        },
      },
    };
  }

  submitAction(playerInput, sysPrompt, requestKind, patchOps = []) {
    if (this.options.onTradeAction) {
      this.options.onTradeAction({
        playerInput,
        systemPrompt: sysPrompt,
        requestKind,
        patchOps: Array.isArray(patchOps) ? patchOps : []
      });
    }
  }

  // --- 商店采购模块 ---
  populateShopData() {
    const storeSel = this.$('#shop-store-sel');
    storeSel.innerHTML = '';
    if (Object.keys(this.currentStores).length === 0) {
      storeSel.innerHTML = '<option value="">[当前区域无商店]</option>';
      this.updateShopItems();
      return;
    }
    for (const sName in this.currentStores) {
      const opt = document.createElement('option');
      opt.value = sName;
      opt.textContent = sName;
      storeSel.appendChild(opt);
    }
    this.updateShopItems();
  }

  updateShopItems() {
    const storeName = this.$('#shop-store-sel').value;
    const itemSel = this.$('#shop-item-sel');
    itemSel.innerHTML = '';
    
    if (!storeName || !this.currentStores[storeName] || !this.currentStores[storeName].库存) {
      itemSel.innerHTML = '<option value="">[该商店无货]</option>';
      this.updateShopPreview();
      return;
    }

    const inv = this.currentStores[storeName].库存;
    let hasItem = false;
    for (const iName in inv) {
      if (Number(inv[iName].库存 || 0) > 0) {
        const opt = document.createElement('option');
        opt.value = iName;
        opt.textContent = `${iName} (库存: ${Number(inv[iName].库存 || 0)})`;
        itemSel.appendChild(opt);
        hasItem = true;
      }
    }
    if (!hasItem) itemSel.innerHTML = '<option value="">[商品已售罄]</option>';
    this.updateShopPreview();
  }

  updateShopPreview() {
    const storeName = this.$('#shop-store-sel').value;
    const itemName = this.$('#shop-item-sel').value;
    const qty = parseInt(this.$('#shop-qty').value) || 1;
    const btn = this.$('#btn-buy');

    if (!storeName || !itemName || !this.currentStores[storeName]?.库存?.[itemName]) {
      this.$('#shop-price').textContent = '-';
      this.$('#shop-market').textContent = '-';
      this.$('#shop-total').textContent = '-';
      this.$('#shop-fame').textContent = '-';
      this.$('#shop-stock').textContent = '-';
      btn.disabled = true;
      this.updateTradeMetaPanel('shop', null);
      return;
    }

    const item = this.currentStores[storeName].库存[itemName];
    const storeData = this.currentStores[storeName] || {};
    const 商店营业中 = this.isShopOpenNow();
    const isSoulTowerDiscountTrade = item && item._tower_discount_virtual === true;
    const itemDefinition = item._临时定义 || this.取物品定义(itemName);
    const priceMultiplier = Number(item.价格倍率 || 1);
    const discount = Number(item.折扣 || 0);
    const 批次倍率 = this.计算来源批次平均倍率(item, qty);
    const baseUnitPrice = Math.max(0, Math.floor(Number(itemDefinition.基础价格 || 0) * 批次倍率 * priceMultiplier * Math.max(0, 1 - discount)));
    const unitPrice = this.getMarketAdjustedPrice(baseUnitPrice, 'buy', { fixed: isSoulTowerDiscountTrade });
    const total = unitPrice * qty;
    const userFame = Number(this.charData?.社交?.声望 || 0);
    const currency = this.resolveTradeCurrency(item, storeName, this.charData?.状态?.位置 || '', storeData);
    const userCoin = Number(this.charData?.财富?.[currency] || 0);

    this.$('#shop-price').textContent = `${unitPrice.toLocaleString()} ${this.getCurrencyLabel(currency)}`;
    this.$('#shop-market').textContent = 商店营业中 ? this.getMarketAdjustmentText('buy', { fixed: isSoulTowerDiscountTrade }) : this.getShopOpenStateText();
    
    const totalEl = this.$('#shop-total');
    totalEl.textContent = `${total.toLocaleString()} ${this.getCurrencyLabel(currency)}`;
    totalEl.className = (userCoin >= total) ? "val-highlight" : "val-warn";

    const fameEl = this.$('#shop-fame');
    fameEl.textContent = Number(item.需求声望 || 0);
    fameEl.className = (userFame >= Number(item.需求声望 || 0)) ? "val-highlight" : "val-warn";

    const stockEl = this.$('#shop-stock');
    stockEl.textContent = Number(item.库存 || 0);
    stockEl.className = (Number(item.库存 || 0) >= qty) ? "val-highlight" : "val-warn";

    this.updateTradeMetaPanel('shop', this.resolveTradeItemInfo(itemName, item, { source: storeName, desc: 商店营业中 ? (this.取物品定义(itemName)?.描述 || `可在 ${storeName} 购得`) : `${storeName} 当前关门，营业时间 09:00-22:00。` }));

    if (!商店营业中) {
      btn.disabled = true;
      return;
    }

    if (!this.isCurrencySpendable(currency)) {
      totalEl.className = "val-warn";
      totalEl.textContent = this.getCurrencyBlockedMessage(currency);
      btn.disabled = true;
      return;
    }

    btn.disabled = (userCoin < total || userFame < Number(item.需求声望 || 0) || Number(item.库存 || 0) < qty);
  }

  executeShopBuy() {
    const storeName = this.$('#shop-store-sel').value;
    const itemName = this.$('#shop-item-sel').value;
    const qty = parseInt(this.$('#shop-qty').value) || 1;
    if (!this.isShopOpenNow()) return this.显示提示('商店已关门，营业时间 09:00-22:00。');
    const item = this.currentStores[storeName].库存[itemName];
    const storeData = this.currentStores[storeName] || {};
    const currency = this.resolveTradeCurrency(item, storeName, this.charData?.状态?.位置 || '', storeData);
    const isSoulTowerDiscountTrade = item && item._tower_discount_virtual === true;
    const itemDefinition = item._临时定义 || this.取物品定义(itemName);
    const 批次倍率 = this.计算来源批次平均倍率(item, qty);
    const baseUnitPrice = Math.max(0, Math.floor(Number(itemDefinition.基础价格 || 0) * 批次倍率 * Number(item.价格倍率 || 1) * Math.max(0, 1 - Number(item.折扣 || 0))));
    const total = this.getMarketAdjustedPrice(baseUnitPrice, 'buy', { fixed: isSoulTowerDiscountTrade }) * qty;

    if (!this.isCurrencySpendable(currency)) return this.显示提示(this.getCurrencyBlockedMessage(currency));

    let loc = this.charData?.状态?.位置 || "";
    let isTier4_5 = /天锻|四字|红级|十万年|魂锻|三字|黑级|万年/.test(itemName);
    let isTier2_3 = /灵锻|二字|紫级|千年|千锻|一字|黄级|百年/.test(itemName);
    const locMeta = this.worldData?.地点?.[loc] || {};
    const economy = String(locMeta['经济状况'] || '未知');
    let isTier1City = economy === '繁荣';
    let isTier2_3City = economy === '繁荣' || economy === '普通';

    if (!isSoulTowerDiscountTrade && isTier4_5 && !isTier1City) return this.显示提示('当前城市级别不足，4-5阶战略资源请前往一线主城购买。');
    if (!isSoulTowerDiscountTrade && isTier2_3 && !isTier2_3City) return this.显示提示('偏远地区物资匮乏，无法提供 2-3 阶资源。');

    let patchOps = [];
    let newWealth = (this.charData.财富?.[currency] || 0) - total;
    patchOps.push({ op: "replace", path: `${this.activeCharBasePath}/财富/${this.escapeJsonPointer(currency)}`, value: newWealth });
    if (!isSoulTowerDiscountTrade) {
      patchOps.push({ op: "replace", path: `/world/地点/${this.escapeJsonPointer(loc)}/商店/${this.escapeJsonPointer(storeName)}/库存/${this.escapeJsonPointer(itemName)}/库存`, value: Number(item.库存 || 0) - qty });
    }
    
    const 采购定义 = { ...(item._临时定义 || this.取物品定义(itemName)), ...(item || {}) };
    const tradeItem = this.buildInventoryItemFromTradeSource(itemName, 采购定义, qty, { source: storeName, desc: 采购定义?.描述 || `购自${storeName}`, currency });
    this.appendItemDefinitionPatch(patchOps, itemName, tradeItem.definition, tradeItem.分类);
    this.appendInventoryGainPatches(patchOps, this.activeCharBasePath, this.charData.背包 || {}, itemName, tradeItem);

    if (isSoulTowerDiscountTrade) {
      patchOps.push({
        op: "replace",
        path: `${this.activeCharBasePath}/魂灵塔记录/当前五折魂灵`,
        value: { ...SOUL_TOWER_EMPTY_DISCOUNT_SPIRIT },
      });
    }

    const log = isSoulTowerDiscountTrade
      ? `[魂灵塔兑换][兑换热][交易触发待处理] ${this.activeName} 在${storeName}以五折价格兑换了【${itemName}】。`
      : `[交易成功][买入热][交易触发待处理] ${this.activeName} 在${storeName} 花费 ${total} ${this.getCurrencyLabel(currency)} 购买了 ${qty} 份【${itemName}】。`;
    patchOps.push(...this.buildTradeSystemPatches(log));

    const sysPrompt = this.buildTradeNarrationPrompt(log, [
      `[交易地点]\n${storeName}`,
      `[交易类型]\n商店购买`,
      `[市场调整]\n${this.getMarketAdjustmentText('buy', { fixed: isSoulTowerDiscountTrade })}`,
      `[结算摘要]\n已支付 ${total} ${this.getCurrencyLabel(currency)}；已获得 ${qty} 份【${itemName}】。`,
    ]);

    this.submitAction(`我要在【${storeName}】购买 ${qty} 份【${itemName}】。`, sysPrompt, 'trade_shop_buy', patchOps);
  }

  // --- 资产出售模块 ---
  populateSellData() {
    const invSel = this.$('#sell-item-sel');
    invSel.innerHTML = '';
    let hasItem = false;
    for (const iName in (this.charData?.背包 || {})) {
      const item = this.charData.背包[iName];
      const 总数量 = this.读取背包总数量(item);
      if (总数量 > 0) {
        const opt = document.createElement('option');
        opt.value = iName;
        opt.textContent = `${iName} (拥有: ${总数量})`;
        invSel.appendChild(opt);
        hasItem = true;
      }
    }
    if (!hasItem) invSel.innerHTML = '<option value="">[背包空空如也]</option>';
    this.updateSellPreview();
  }

  updateSellPreview() {
    const itemName = this.$('#sell-item-sel').value;
    const qty = parseInt(this.$('#sell-qty').value) || 1;
    const btn = this.$('#btn-sell');

    if (!itemName || !this.charData.背包?.[itemName]) {
      this.$('#sell-base-price').textContent = '-';
      this.$('#sell-market').textContent = '-';
      this.$('#sell-total').textContent = '-';
      btn.disabled = true;
      this.updateTradeMetaPanel('sell', null);
      return;
    }

    const 命中定义 = this.查找物品定义(itemName);
    const item = { ...(命中定义?.定义 || {}), ...(this.charData.背包[itemName] || {}) };
    const basePrice = Math.max(0, Math.floor(this.estimateBasePrice(itemName, 命中定义?.分类 || '物品') * this.计算来源批次平均倍率(this.charData.背包[itemName] || {}, qty)));
    const sellPrice = this.getMarketAdjustedPrice(Math.floor(basePrice * 0.5), 'sell');
    const total = sellPrice * qty;

    this.updateTradeMetaPanel('sell', this.resolveTradeItemInfo(itemName, item, { source: item?.来源 || item?.绑定者 || '背包持有' }));

    if (basePrice === 0) {
      this.$('#sell-base-price').textContent = "禁售物品";
      this.$('#sell-market').textContent = '-';
      this.$('#sell-total').textContent = "无法交易";
      btn.disabled = true;
    } else {
      this.$('#sell-base-price').textContent = `${sellPrice.toLocaleString()} ${this.getCurrencyLabel('联邦币')}`;
      this.$('#sell-market').textContent = this.getMarketAdjustmentText('sell');
      this.$('#sell-total').textContent = `${total.toLocaleString()} ${this.getCurrencyLabel('联邦币')}`;
      btn.disabled = (this.读取背包总数量(this.charData.背包[itemName]) < qty);
    }
  }

  executeSell() {
    const itemName = this.$('#sell-item-sel').value;
    const qty = parseInt(this.$('#sell-qty').value) || 1;
    const itemType = this.查找物品定义(itemName)?.分类 || '物品';
    const basePrice = Math.max(0, Math.floor(this.estimateBasePrice(itemName, itemType) * this.计算来源批次平均倍率(this.charData.背包[itemName] || {}, qty)));
    const totalEarn = this.getMarketAdjustedPrice(Math.floor(basePrice * 0.5), 'sell') * qty;

    let patchOps = [];
    this.appendInventoryConsumePatches(patchOps, this.activeCharBasePath, this.charData.背包 || {}, itemName, qty);
    patchOps.push({ op: "replace", path: `${this.activeCharBasePath}/财富/联邦币`, value: (this.charData.财富?.联邦币 || 0) + totalEarn });

    const log = `[交易成功][卖出热][交易触发待处理] ${this.activeName} 向系统商店出售了 ${qty} 份【${itemName}】，获得 ${totalEarn} 联邦币。`;
    patchOps.push(...this.buildTradeSystemPatches(log));

    const sysPrompt = this.buildTradeNarrationPrompt(log, [
      `[交易类型]\n系统出售`,
      `[市场调整]\n${this.getMarketAdjustmentText('sell')}`,
      `[结算摘要]\n已卖出 ${qty} 份【${itemName}】；已获得 ${totalEarn} 联邦币。`,
    ]);

    this.submitAction(`我要卖出 ${qty} 份【${itemName}】换钱。`, sysPrompt, 'trade_system_sell', patchOps);
  }

  // --- 私下交易模块 ---
  updatePrivPreview() {
    const action = this.$('#priv-action').value;
    const itemName = this.$('#priv-item').value;
    const qty = parseInt(this.$('#priv-qty').value) || 1;
    const price = parseInt(this.$('#priv-price').value) || 1;
    const btn = this.$('#btn-private');
    const targetNpc = String(this.$('#priv-npc').value || '').trim();
    const total = price * qty;
    const attEl = this.$('#priv-attitude');
    
    const ctx = this.getPrivateTradeContext(action, targetNpc, itemName, qty, price);

    this.$('#priv-base-price').textContent = ctx.marketPrice > 0 ? `${ctx.marketPrice.toLocaleString()} ${this.getCurrencyLabel('联邦币')}` : (ctx.basePrice > 0 ? `${ctx.basePrice.toLocaleString()} ${this.getCurrencyLabel('联邦币')}` : '未知/禁售');
    this.$('#priv-market').textContent = ctx.basePrice > 0 ? this.getMarketAdjustmentText(action === '私下买入' ? 'buy' : 'sell') : '-';
    this.$('#priv-total').textContent = `${total.toLocaleString()} ${this.getCurrencyLabel('联邦币')}`;

    const previewItem = action === '私下买入' ? ctx.npcItem : ctx.playerItem;
    this.updateTradeMetaPanel('priv', previewItem ? this.resolveTradeItemInfo(itemName, previewItem, { source: action === '私下买入' ? targetNpc : this.activeName }) : null);

    btn.disabled = false;
    attEl.className = "";

    if (ctx.error) {
      attEl.textContent = ctx.error;
      attEl.className = "val-warn";
      btn.disabled = true;
      return;
    }

    attEl.textContent = `${action === "私下买入" ? '可尝试成交' : '可尝试出手'} · ${ctx.note}`;
    attEl.className = ctx.successRate >= 60 ? "val-highlight" : "val-warn";
  }

  executePrivateTrade() {
    const action = this.$('#priv-action').value;
    const targetNpc = this.$('#priv-npc').value || "神秘商人";
    const itemName = this.$('#priv-item').value;
    const qty = parseInt(this.$('#priv-qty').value) || 1;
    const price = parseInt(this.$('#priv-price').value) || 1;
    const ctx = this.getPrivateTradeContext(action, targetNpc, itemName, qty, price);
    if (ctx.error) return this.显示提示(ctx.error);

    let patchOps = [];
    let log = "";
    const roll = Math.floor(Math.random() * 100) + 1;
    const isSuccess = roll <= ctx.successRate;

    if (action === "私下买入") {
      if (!isSuccess) {
        log = `[私下交易失败] ${this.activeName} 向 ${targetNpc} 报价 ${price} 联邦币，但对方没有接受。`;
      } else {
        patchOps.push({ op: "replace", path: `${this.activeCharBasePath}/财富/联邦币`, value: (this.charData.财富?.联邦币 || 0) - ctx.total });
        const tradeItem = this.buildInventoryItemFromTradeSource(itemName, ctx.npcItem, qty, { source: targetNpc, desc: `从 ${targetNpc} 处私下购得` });
        this.appendItemDefinitionPatch(patchOps, itemName, tradeItem.definition, tradeItem.分类);
        this.appendInventoryGainPatches(patchOps, this.activeCharBasePath, this.charData.背包 || {}, itemName, tradeItem);
        this.appendInventoryConsumePatches(patchOps, `/char/${this.escapeJsonPointer(targetNpc)}`, ctx.targetChar?.背包 || {}, itemName, qty);
        patchOps.push({ op: "replace", path: `/char/${this.escapeJsonPointer(targetNpc)}/财富/联邦币`, value: (ctx.targetChar?.财富?.联邦币 || 0) + ctx.total });
        log = `[私下交易成功][买入热][交易触发待处理] ${this.activeName} 以总价 ${ctx.total} 联邦币从 ${targetNpc} 处买入了 ${qty} 份【${itemName}】。`;
      }
    } else {
      if (!isSuccess) {
        log = `[私下交易失败] ${this.activeName} 向 ${targetNpc} 报价 ${price} 联邦币，但对方没有接手。`;
      } else {
        this.appendInventoryConsumePatches(patchOps, this.activeCharBasePath, this.charData.背包 || {}, itemName, qty);
        patchOps.push({ op: "replace", path: `${this.activeCharBasePath}/财富/联邦币`, value: (this.charData.财富?.联邦币 || 0) + ctx.total });
        const npcItem = this.buildInventoryItemFromTradeSource(itemName, this.charData.背包[itemName], qty, { source: this.activeName, desc: `从 ${this.activeName} 处私下收购` });
        this.appendItemDefinitionPatch(patchOps, itemName, npcItem.definition, npcItem.分类);
        this.appendInventoryGainPatches(patchOps, `/char/${this.escapeJsonPointer(targetNpc)}`, ctx.targetChar?.背包 || {}, itemName, npcItem);
        patchOps.push({ op: "replace", path: `/char/${this.escapeJsonPointer(targetNpc)}/财富/联邦币`, value: (ctx.targetChar?.财富?.联邦币 || 0) - ctx.total });
        log = `[私下交易成功][卖出热][交易触发待处理] ${this.activeName} 以单价 ${price} 联邦币向 ${targetNpc} 卖出 ${qty} 份【${itemName}】，获得 ${ctx.total} 联邦币。`;
      }
    }

    patchOps.push(...this.buildTradeSystemPatches(log, { roll, successRate: ctx.successRate }));

    const sysPrompt = this.buildTradeNarrationPrompt(log, [
      `[交易对象]\n${targetNpc}`,
      `[交易类型]\n${action}`,
      `[市场调整]\n${this.getMarketAdjustmentText(action === '私下买入' ? 'buy' : 'sell')}`,
      `[结算摘要]\n${isSuccess ? `本次成交 ${qty} 份【${itemName}】，总价 ${ctx.total} 联邦币。` : `本次未成交，报价为单价 ${price} 联邦币。`}`
    ]);

    this.submitAction(`我要和【${targetNpc}】${action} ${qty} 份【${itemName}】，单价 ${price} 联邦币。`, sysPrompt, 'trade_private', patchOps);
  }

  // --- 拍卖行模块 ---
  populateAuctionData() {
    const sel = this.$('#auc-item-sel');
    sel.innerHTML = '';
    if (this.currentAuction.状态 === "休市" || !this.currentAuction.拍品 || Object.keys(this.currentAuction.拍品).length === 0) {
      sel.innerHTML = '<option value="">[拍卖行休市或无拍品]</option>';
      this.updateAucPreview();
      return;
    }
    for (const iName in this.currentAuction.拍品) {
      const opt = document.createElement('option');
      opt.value = iName;
      opt.textContent = iName;
      sel.appendChild(opt);
    }
    this.updateAucPreview();
  }

  updateAucPreview() {
    const itemName = this.$('#auc-item-sel').value;
    const bid = parseInt(this.$('#auc-bid').value) || 0;
    const btn = this.$('#btn-auc');

    if (!itemName || !this.currentAuction.拍品?.[itemName]) {
      this.$('#auc-current-price').textContent = '-';
      this.$('#auc-desc').textContent = '-';
      btn.disabled = true;
      return;
    }

    const item = this.currentAuction.拍品[itemName];
    const currency = this.resolveTradeCurrency(item, '拍卖行', this.charData?.状态?.位置 || '', this.currentAuction || {});
    const itemDefinition = this.取物品定义(itemName) || item || {};
    const currentPrice = Number(item.价格 || itemDefinition.基础价格 || 0);
    this.$('#auc-current-price').textContent = `${currentPrice.toLocaleString()} ${this.getCurrencyLabel(currency)}`;
    this.$('#auc-desc').textContent = `[${itemDefinition.品质 || item.品级 || '普通'}] ${itemDefinition.描述 || item.背景 || item.描述 || '暂无说明'}`;

    const userCoin = this.charData?.财富?.[currency] || 0;
    if (!this.isCurrencySpendable(currency)) {
      btn.disabled = true;
      return;
    }
    btn.disabled = (bid <= currentPrice || userCoin < bid);
  }

  executeAuction() {
    const itemName = this.$('#auc-item-sel').value;
    const bid = parseInt(this.$('#auc-bid').value) || 0;
    const item = this.currentAuction.拍品[itemName];
    const currency = this.resolveTradeCurrency(item, '拍卖行', this.charData?.状态?.位置 || '', this.currentAuction || {});

    if (!this.isCurrencySpendable(currency)) return this.显示提示(this.getCurrencyBlockedMessage(currency));

    let patchOps = [];
    patchOps.push({ op: "replace", path: `${this.activeCharBasePath}/财富/${this.escapeJsonPointer(currency)}`, value: (this.charData.财富?.[currency] || 0) - bid });
    
    const tradeItem = this.buildInventoryItemFromTradeSource(itemName, item, 1, { source: '拍卖行', rarity: item.品级 || '普通', desc: item.背景 || item.描述 || '拍卖所得', currency });
    this.appendItemDefinitionPatch(patchOps, itemName, tradeItem.definition, tradeItem.分类);
    this.appendInventoryGainPatches(patchOps, this.activeCharBasePath, this.charData.背包 || {}, itemName, tradeItem);
    patchOps.push({ op: "remove", path: `/world/拍卖/拍品/${this.escapeJsonPointer(itemName)}` });

    const log = `[竞拍成功][竞拍热][交易触发待处理] ${this.activeName} 豪掷 ${bid} ${this.getCurrencyLabel(currency)} 拍下了【${itemName}】。`;
    patchOps.push(...this.buildTradeSystemPatches(log));

    const sysPrompt = this.buildTradeNarrationPrompt(log, [
      `[交易地点]\n拍卖行`,
      `[交易类型]\n竞拍成交`,
      `[结算摘要]\n已支付 ${bid} ${this.getCurrencyLabel(currency)}；已拍得【${itemName}】。`,
    ]);

    this.submitAction(`【举牌竞拍】我出价 ${bid} 竞拍【${itemName}】！`, sysPrompt, 'trade_auction', patchOps);
  }
}

// 向全局挂载
window.mountTradeUI = function(containerElement, snapshot, options = {}) {
  return new TradeUIComponent(containerElement, snapshot, options);
};


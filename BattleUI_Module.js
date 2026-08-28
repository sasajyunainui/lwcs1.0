/* BattleUI_Module.js - 战斗终端系统 (JS 模块版) */

(() => {

class BattleUIComponent {
  constructor(container, snapshot, options = {}) {
    this.container = container;
    this.snapshot = snapshot;
    this.options = options;
    this.recordPortalNode = null;
    this.recordPortalPosition = null;
    this.syncRecordPortalPosition = null;
    this.cleanupRecordPortalPosition = null;
    this.skillTooltipPortalNode = null;
    this.initDOM();
    this.initEngine();
  }

  initDOM() {
    if (!this.container.querySelector('.battle-module-scope')) {
      throw new Error('battle_ui_markup_missing');
    }
  }

  updateData(newSnapshot) {
    this.snapshot = newSnapshot;
    if (this.syncFromBattleEngine) this.syncFromBattleEngine();
    if (this.syncRecordPortalPosition) this.syncRecordPortalPosition();
  }

  destroy() {
    try {
      const 状态 = window.BattleUI?.state;
      if (状态?.智能警报弱化计时器) {
        clearTimeout(状态.智能警报弱化计时器);
        状态.智能警报弱化计时器 = null;
      }
    } catch (错误) {}
    try {
      if (typeof this.cleanupRecordPortalPosition === 'function') this.cleanupRecordPortalPosition();
      if (this.recordPortalNode?.remove) this.recordPortalNode.remove();
      this.recordPortalNode = null;
      this.recordPortalPosition = null;
      this.syncRecordPortalPosition = null;
      this.cleanupRecordPortalPosition = null;
      if (this.skillTooltipPortalNode?.remove) this.skillTooltipPortalNode.remove();
      this.skillTooltipPortalNode = null;
    } catch (错误) {}
    this.container.innerHTML = '';
  }

  initEngine() {
    const component = this;
    const snapshot = this.snapshot;
    const _options = this.options;
    const wrapperElement = this.container.querySelector('.battle-module-scope');
    if (!wrapperElement) throw new Error('battle_ui_markup_missing');
    const root = typeof globalThis !== 'undefined' ? globalThis : window;
    const globalDocument = root.document && typeof root.document.querySelector === 'function' ? root.document : null;
    const document = wrapperElement;
    const byId = id => wrapperElement.querySelector(`#${id}`);
    function 同步战斗记录终端主题(node = component.recordPortalNode) {
      if (!node || !component.container || typeof root.getComputedStyle !== 'function') return;
      const 样式 = root.getComputedStyle(component.container);
      [
        '--主题主色',
        '--资源亮色',
        '--文字主色',
        '--文字弱色',
        '--战斗主色',
        '--战斗强调色',
        '--战斗危险色',
        '--战斗警戒色',
        '--战斗玻璃底',
        '--战斗玻璃浮层',
        '--战斗边缘高光',
        '--战斗暗侧阴影',
        '--战斗扫描线',
        '--战斗环境光',
        '--战斗圆角',
      ].forEach(变量名 => {
        const 值 = 样式.getPropertyValue(变量名).trim();
        if (值) node.style.setProperty(变量名, 值);
      });
    }
    function 同步战斗记录终端位置() {
      const node = component.recordPortalNode;
      if (!node?.isConnected || !component.container?.getBoundingClientRect) return;
      同步战斗记录终端主题(node);
      const rect = component.container.getBoundingClientRect();
      const viewportWidth = Math.max(Number(root.innerWidth) || 0, Number(globalDocument?.documentElement?.clientWidth) || 0);
      const viewportHeight = Math.max(Number(root.innerHeight) || 0, Number(globalDocument?.documentElement?.clientHeight) || 0);
      if (!rect.width || !rect.height || !viewportWidth || !viewportHeight) return;
      const inline = viewportWidth <= 1180;
      node.classList.toggle('battle-record-terminal--inline', inline);
      if (inline) {
        if (node.parentNode !== wrapperElement) wrapperElement.appendChild(node);
        ['--战斗记录外置-top', '--战斗记录外置-left', '--战斗记录外置-width', '--战斗记录外置-height'].forEach(name => node.style.removeProperty(name));
        return;
      }
      if (globalDocument?.body && node.parentNode !== globalDocument.body) globalDocument.body.appendChild(node);
      const gap = 12;
      const margin = 10;
      const defaultTop = Math.max(margin, rect.top);
      const defaultLeft = (() => {
        const sideSpace = viewportWidth - rect.right - gap - margin;
        const width = Math.min(640, Math.max(480, viewportWidth * 0.32));
        return sideSpace >= width ? rect.right + gap : Math.max(margin, viewportWidth - margin - width);
      })();
      const measuredWidth = Math.max(52, Number(node.offsetWidth || 0));
      const measuredHeight = Math.max(34, Number(node.offsetHeight || 0));
      const top = component.recordPortalPosition
        ? Math.max(margin, Math.min(Number(component.recordPortalPosition.top || margin), viewportHeight - margin - Math.min(measuredHeight, viewportHeight - margin * 2)))
        : defaultTop;
      const maxHeight = Math.max(120, viewportHeight - top - margin);
      const height = Math.min(rect.height, maxHeight);
      const left = component.recordPortalPosition
        ? Math.max(margin, Math.min(Number(component.recordPortalPosition.left || margin), viewportWidth - margin - Math.min(measuredWidth, viewportWidth - margin * 2)))
        : defaultLeft;
      node.style.setProperty('--战斗记录外置-top', `${Math.round(top)}px`);
      node.style.setProperty('--战斗记录外置-left', `${Math.round(left)}px`);
      node.style.setProperty('--战斗记录外置-width', 'clamp(480px, 32vw, 640px)');
      node.style.setProperty('--战斗记录外置-height', `${Math.round(height)}px`);
    }
    component.syncRecordPortalPosition = 同步战斗记录终端位置;
    function 绑定战斗记录终端拖动(node) {
      if (!node || node.__battleRecordDragBound) return;
      let dragState = null;
      const finish = event => {
        if (!dragState || (event?.pointerId != null && event.pointerId !== dragState.pointerId)) return;
        try { node.releasePointerCapture?.(dragState.pointerId); } catch (错误) {}
        if (dragState.moved) {
          node.__battleRecordSuppressClick = true;
          root.setTimeout?.(() => { node.__battleRecordSuppressClick = false; }, 0);
        }
        dragState = null;
        node.classList.remove('battle-record-terminal--dragging');
      };
      node.addEventListener('pointerdown', event => {
        if (Number(root.innerWidth || 0) <= 1180 || event.button !== 0) return;
        const interactive = event.target?.closest?.('button, input, select, textarea, a, [contenteditable="true"], .battle-preview-panel');
        if (interactive && !node.classList.contains('battle-record-terminal--collapsed')) return;
        const rect = node.getBoundingClientRect();
        dragState = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          left: rect.left,
          top: rect.top,
          moved: false,
        };
        node.setPointerCapture?.(event.pointerId);
      });
      node.addEventListener('pointermove', event => {
        if (!dragState || event.pointerId !== dragState.pointerId) return;
        const deltaX = event.clientX - dragState.startX;
        const deltaY = event.clientY - dragState.startY;
        if (!dragState.moved && Math.hypot(deltaX, deltaY) < 5) return;
        if (!dragState.moved) {
          dragState.moved = true;
          node.classList.add('battle-record-terminal--dragging');
        }
        component.recordPortalPosition = {
          left: dragState.left + deltaX,
          top: dragState.top + deltaY,
        };
        同步战斗记录终端位置();
        event.preventDefault();
      });
      node.addEventListener('pointerup', finish);
      node.addEventListener('pointercancel', finish);
      node.__battleRecordDragBound = true;
    }
    function 读取战斗记录终端节点() {
      if (component.recordPortalNode?.isConnected) return component.recordPortalNode;
      const 本地节点 = wrapperElement.querySelector('#ui-battle-record-terminal');
      if (!本地节点) return null;
      if (globalDocument?.body) {
        globalDocument.querySelectorAll('#ui-battle-record-terminal.battle-record-terminal--portal').forEach(node => {
          if (node !== 本地节点) node.remove();
        });
        本地节点.classList.add('battle-record-terminal--portal');
        本地节点.setAttribute('tabindex', '0');
        本地节点.setAttribute('aria-label', '战斗记录');
        globalDocument.body.appendChild(本地节点);
        component.recordPortalNode = 本地节点;
        同步战斗记录终端主题(本地节点);
        绑定战斗记录终端拖动(本地节点);
        同步战斗记录终端位置();
        if (!component.cleanupRecordPortalPosition) {
          const 处理位置变化 = () => 同步战斗记录终端位置();
          let 尺寸观察器 = null;
          root.addEventListener?.('resize', 处理位置变化);
          globalDocument.addEventListener?.('scroll', 处理位置变化, true);
          if (typeof root.ResizeObserver === 'function') {
            尺寸观察器 = new root.ResizeObserver(处理位置变化);
            尺寸观察器.observe(component.container);
          }
          component.cleanupRecordPortalPosition = () => {
            root.removeEventListener?.('resize', 处理位置变化);
            globalDocument.removeEventListener?.('scroll', 处理位置变化, true);
            尺寸观察器?.disconnect();
          };
        }
      }
      return 本地节点;
    }
    const 战斗提交模式存储键 = 'lwcs_battle_submit_mode';
    const 战斗提交模式列表 = ['auto', 'manual', 'free_narrative'];
    const 战斗提交模式标签 = {
      auto: '自动',
      manual: '手动',
      free_narrative: '自由',
    };
    const 自动续推默认设置 = Object.freeze({
      maxRounds: 20,
      stopDamagePercent: 25,
      continueChancePercent: 100,
    });
    function 夹取自动续推数值(值, 回退, 下限, 上限) {
      const 数值 = Number(值);
      if (!Number.isFinite(数值)) return 回退;
      return Math.min(上限, Math.max(下限, 数值));
    }
    function 规范化自动续推设置(配置 = {}, mode = 'multi_round') {
      const 来源 = 配置 && typeof 配置 === 'object' ? 配置 : {};
      const 阈值原始值 =
        来源.stopDamagePercent ??
        来源.autoContinueStopDamagePercent ??
        来源.停推阈值百分比 ??
        (Number.isFinite(Number(来源.stopDamageRatio)) ? Number(来源.stopDamageRatio) * 100 : undefined);
      const 概率原始值 =
        来源.continueChancePercent ??
        来源.autoContinueChancePercent ??
        来源.低烈度续推概率百分比 ??
        (Number.isFinite(Number(来源.continueChance)) ? Number(来源.continueChance) * 100 : undefined);
      const 最大回合 = mode === 'multi_round'
        ? Math.round(夹取自动续推数值(
            来源.maxRounds ?? 来源.autoContinueMaxRounds ?? 来源.最大回合,
            自动续推默认设置.maxRounds,
            1,
            20,
          ))
        : 1;
      const 停推阈值百分比 = 夹取自动续推数值(阈值原始值, 自动续推默认设置.stopDamagePercent, 0, 100);
      const 低烈度续推概率百分比 = 夹取自动续推数值(概率原始值, 自动续推默认设置.continueChancePercent, 0, 100);
      return {
        maxRounds: 最大回合,
        stopDamagePercent: 停推阈值百分比,
        stopDamageRatio: 停推阈值百分比 / 100,
        continueChancePercent: 低烈度续推概率百分比,
        continueChance: 低烈度续推概率百分比 / 100,
      };
    }
    function 规范化战斗提交模式(值) {
      const 文本 = String(值 || '').trim();
      return 战斗提交模式列表.includes(文本) ? 文本 : 'manual';
    }
    function 读取战斗提交模式() {
      try {
        return 规范化战斗提交模式(root.localStorage?.getItem(战斗提交模式存储键));
      } catch (error) {
        return 'manual';
      }
    }
    function 写入战斗提交模式(模式) {
      const 下个模式 = 规范化战斗提交模式(模式);
      try {
        root.localStorage?.setItem(战斗提交模式存储键, 下个模式);
      } catch (error) {}
      return 下个模式;
    }
    function 同步战斗提交模式控件() {
      const 当前模式 = 读取战斗提交模式();
      const 标签节点 = byId('ui-battle-submit-mode-label');
      if (标签节点) 标签节点.textContent = 战斗提交模式标签[当前模式] || '手动';
      document.querySelectorAll('#ui-battle-submit-mode-group [data-submit-mode]').forEach(button => {
        button.classList.toggle('active', button.dataset.submitMode === 当前模式);
        button.setAttribute('aria-selected', button.dataset.submitMode === 当前模式 ? 'true' : 'false');
      });
      if (typeof 同步战斗下拉文本 === 'function') 同步战斗下拉文本(byId('ui-battle-submit-mode-group'), 当前模式, 'submit-mode');
      return 当前模式;
    }
    const BATTLE_RUNTIME = root.__LWCS_BATTLE_RUNTIME__;
    if (!BATTLE_RUNTIME || typeof BATTLE_RUNTIME !== 'object') throw new Error('battle_runtime_module_missing');
    const BATTLE_PREVIEW = root.__LWCS_BATTLE_PREVIEW__;
    if (!BATTLE_PREVIEW || typeof BATTLE_PREVIEW.estimateWithdrawal !== 'function') throw new Error('battle_preview_module_missing');
    const BATTLE_DECISION = root.__LWCS_BATTLE_DECISION__;
    if (BATTLE_RUNTIME.version !== '7.3-R6.3') throw new Error(`battle_runtime_version_mismatch:${BATTLE_RUNTIME.version || 'missing'}`);
    if (BATTLE_PREVIEW.version !== '7.3-R6.3-preview-2') throw new Error(`battle_preview_version_mismatch:${BATTLE_PREVIEW.version || 'missing'}`);
    if (BATTLE_DECISION?.version !== '7.3-R6.3-decision-2') throw new Error(`battle_decision_version_mismatch:${BATTLE_DECISION?.version || 'missing'}`);
    function formatBattleUiSkillCost(skill = {}, context = {}) {
      if (!BATTLE_PREVIEW || typeof BATTLE_PREVIEW.readSkillCostStages !== 'function') return '不可用：技能消耗解析器未就绪';
      return BATTLE_PREVIEW.formatSkillCostStages(skill, context);
    }
    root.__LWCS_BATTLE_UI_COST_CONSUMER__ = Object.freeze({ formatSkillCost: formatBattleUiSkillCost });
    const SHARED_SKILL_MECHANISM_REGISTRY = root.__LWCS_SKILL_MECHANISM_REGISTRY__;
    if (!SHARED_SKILL_MECHANISM_REGISTRY || BATTLE_RUNTIME.prototypeRegistry !== SHARED_SKILL_MECHANISM_REGISTRY.原型定义) {
      throw new Error('battle_runtime_registry_contract_mismatch');
    }
    const BATTLE_PROTOTYPE_RUNTIME_CONTRACT = BATTLE_RUNTIME.prototypeRuntimeContract;
    if (!BATTLE_PROTOTYPE_RUNTIME_CONTRACT || typeof BATTLE_PROTOTYPE_RUNTIME_CONTRACT !== 'object') {
      throw new Error('battle_runtime_prototype_contract_missing');
    }
    const 战斗来源类别上下文表 = new WeakMap();
    const 读取战斗来源类别上下文 = (skill = {}, 回退类别 = '魂技') => {
      const 运行态 = skill && typeof skill === 'object' ? 战斗来源类别上下文表.get(skill) || {} : {};
      const 来源类别 = String(运行态.来源类别 || skill?.__战斗来源类别 || 回退类别 || '魂技').trim() || '魂技';
      const 来源明细 = String(运行态.来源明细 || skill?.__战斗来源明细 || 来源类别).trim() || 来源类别;
      const 魂环路径 = Array.isArray(运行态.魂环路径)
        ? 运行态.魂环路径
        : Array.isArray(skill?.__魂环路径)
          ? skill.__魂环路径
          : [];
      const 魂技槽位 = String(运行态.魂技槽位 || skill?.__魂技槽位 || '').trim();
      return { 来源类别, 来源明细, 魂环路径: 魂环路径.map(片段 => String(片段)), 魂技槽位 };
    };
    const lodashGet =
      root._ && typeof root._.get === 'function'
        ? root._.get.bind(root._)
        : (obj, path, fallback) => {
            const normalized = String(path || '')
              .split('.')
              .filter(Boolean);
            let cursor = obj;
            for (const seg of normalized) {
              if (cursor == null || typeof cursor !== 'object' || !(seg in cursor)) return fallback;
              cursor = cursor[seg];
            }
            return cursor === undefined ? fallback : cursor;
          };

    function normalizeStatPath(path) {
      return String(path || '')
        .replace(/^stat_data\./, '')
        .replace(/^\.+/, '');
    }

    function getTavernHelperRuntime() {
      const host = getHostWindow();
      if (root.TavernHelper && typeof root.TavernHelper.getVariables === 'function') return root.TavernHelper;
      if (host?.TavernHelper && typeof host.TavernHelper.getVariables === 'function') return host.TavernHelper;
      return null;
    }

    function normalizeVariablesEnvelope(rawVars) {
      if (!rawVars || typeof rawVars !== 'object') return {};
      const candidates = [
        rawVars.stat_data,
        rawVars.data?.stat_data,
        rawVars.variables?.stat_data,
        rawVars.payload?.stat_data,
        rawVars.root?.stat_data,
        rawVars.data,
        rawVars.variables,
        rawVars.payload,
        rawVars.root,
        rawVars,
      ];
      const statData = candidates.find(item => item && typeof item === 'object' && (item.char || item.world || item.sys));
      return statData ? { ...rawVars, stat_data: statData } : rawVars;
    }

    const SOUL_TOWER_TOTAL_FLOORS = 108;
    const 试炼地点前缀 = '试炼-';
    const 魂灵塔退出地点 = '史莱克城传灵塔总部';
    const SOUL_TOWER_LAYER_RULES = Object.freeze([
      Object.freeze({
        key: 'thousand',
        label: '千年魂灵区',
        rewardTier: '千年',
        gateStart: 1,
        gateEnd: 18,
        minAge: 1000,
        maxAge: 9999,
        qualitySteps: Object.freeze(['C', 'B', 'A']),
      }),
      Object.freeze({
        key: 'ten_thousand',
        label: '万年魂灵区',
        rewardTier: '万年',
        gateStart: 19,
        gateEnd: 36,
        minAge: 10000,
        maxAge: 99999,
        qualitySteps: Object.freeze(['B', 'A', 'S']),
      }),
      Object.freeze({
        key: 'pre_beast',
        label: '万年以上魂灵区',
        rewardTier: '万年以上',
        gateStart: 37,
        gateEnd: 99,
        minAge: 10000,
        maxAge: 99999,
        qualitySteps: Object.freeze(['A', 'S']),
      }),
      Object.freeze({
        key: 'beast',
        label: '凶兽魂灵区',
        rewardTier: '凶兽级',
        gateStart: 100,
        gateEnd: 108,
        minAge: 100000,
        maxAge: 200000,
        qualitySteps: Object.freeze(['S+']),
      }),
    ]);
    const SOUL_SPIRIT_QUALITY_VALUES = Object.freeze(['F', 'D', 'C', 'B', 'A', 'S', 'S+']);

    function normalizeSoulSpiritQuality(value = '') {
      const text = String(value || '')
        .trim()
        .toUpperCase()
        .replace('＋', '+')
        .replace(/\s+/g, '');
      return SOUL_SPIRIT_QUALITY_VALUES.includes(text) ? text : '';
    }

    function 构建魂灵塔试炼地点(层数 = 1) {
      const floor = Math.min(SOUL_TOWER_TOTAL_FLOORS, Math.max(1, Math.floor(Number(层数) || 1)));
      return `${试炼地点前缀}魂灵塔-第${floor}层`;
    }

    function 解析角色键(角色名 = '') {
      const safeName = String(角色名 || '').trim();
      if (!safeName) return '';
      const 角色表 = getMvuValue('char', {}) || {};
      if (角色表 && typeof 角色表 === 'object' && Object.prototype.hasOwnProperty.call(角色表, safeName)) {
        return safeName;
      }
      const 匹配项 = Object.entries(角色表).find(([键, 数据]) => {
        const 显示名 = String(数据?.name || 数据?.base?.name || 键 || '').trim();
        return 显示名 === safeName;
      });
      return 匹配项 ? String(匹配项[0] || '').trim() : safeName;
    }

    function 构建角色位置补丁(角色名 = '', 位置 = '') {
      const safeName = String(角色名 || '').trim();
      const safeLocation = String(位置 || '').trim();
      if (!safeName || !safeLocation) return null;
      const charKey = 解析角色键(safeName);
      if (!charKey) return null;
      return {
        op: 'add',
        path: `/char/${escapeJsonPointerSegment(charKey)}/状态/位置`,
        value: safeLocation,
      };
    }

    function createEmptySoulTowerDiscountSpiritRecord() {
      return {
        层数: 0,
        名称: '',
        标准物种: '',
        年限: 0,
        品质: '',
        已使用: false,
      };
    }

    function normalizeSoulTowerDiscountSpiritRecord(record = {}) {
      if (!record || typeof record !== 'object' || Array.isArray(record)) return createEmptySoulTowerDiscountSpiritRecord();
      const next = createEmptySoulTowerDiscountSpiritRecord();
      next.层数 = Math.max(0, Math.floor(Number(record.层数 || 0)));
      next.名称 = String(record.名称 || '').trim();
      next.标准物种 = String(record.标准物种 || '').trim();
      next.年限 = Math.max(0, Math.floor(Number(record.年限 || 0)));
      next.品质 = normalizeSoulSpiritQuality(record.品质 || '');
      next.已使用 = record.已使用 === true;
      if (!(next.层数 > 0 && next.标准物种 && next.年限 > 0 && next.品质 && next.已使用 === false)) {
        return createEmptySoulTowerDiscountSpiritRecord();
      }
      if (!next.名称) next.名称 = `${next.标准物种}魂灵`;
      return next;
    }

    function normalizeSoulTowerPendingSettlement(record = null) {
      if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
      const floor = Math.floor(Number(record.层数 || 0));
      const discountSpirit = normalizeSoulTowerDiscountSpiritRecord(record.五折魂灵);
      if (
        String(record.状态 || '').trim() !== '待选择' ||
        !(floor > 0 && floor <= SOUL_TOWER_TOTAL_FLOORS) ||
        !(discountSpirit.层数 > 0) ||
        discountSpirit.层数 !== floor
      ) return null;
      const canContinue = floor < SOUL_TOWER_TOTAL_FLOORS && record.可继续 === true;
      return {
        状态: '待选择',
        层数: floor,
        区域标签: String(record.区域标签 || '').trim(),
        区间标签: String(record.区间标签 || '').trim(),
        守塔名称: String(record.守塔名称 || discountSpirit.名称).trim(),
        五折魂灵: discountSpirit,
        下一层: canContinue ? floor + 1 : floor,
        可继续: canContinue,
      };
    }

    function buildSoulTowerDiscountSpiritDisplay(record = {}) {
      const normalized = normalizeSoulTowerDiscountSpiritRecord(record);
      if (!(normalized.层数 > 0)) return '暂无';
      return `第${normalized.层数}层 · ${normalized.标准物种} · ${normalized.年限}年 · ${normalized.品质}`;
    }

    function getCombatUnitAgeValue(unit = {}) {
      const rawAge = unit?.属性?.年龄 ?? unit?.年龄 ?? unit?.age;
      if (typeof rawAge === 'number') return Number.isFinite(rawAge) ? rawAge : NaN;
      const text = String(rawAge == null ? '' : rawAge).trim();
      if (!text) return NaN;
      const directNumber = Number(text);
      if (Number.isFinite(directNumber)) return directNumber;
      const numericText = text.match(/-?\d+(?:\.\d+)?/);
      return numericText ? Number(numericText[0]) : NaN;
    }

    function getSoulTowerGateMeta(floor = 0) {
      const safeFloor = Math.max(1, Math.floor(Number(floor) || 1));
      const rule =
        SOUL_TOWER_LAYER_RULES.find(item => safeFloor >= item.gateStart && safeFloor <= item.gateEnd) ||
        SOUL_TOWER_LAYER_RULES[SOUL_TOWER_LAYER_RULES.length - 1];
      const gateIndex = SOUL_TOWER_LAYER_RULES.findIndex(item => item.key === rule.key) + 1;
      const layerInGate = safeFloor - rule.gateStart + 1;
      const isGateBoss = safeFloor === rule.gateEnd;
      const layerProgress = rule.gateEnd > rule.gateStart ? (safeFloor - rule.gateStart) / (rule.gateEnd - rule.gateStart) : 1;
      return {
        floor: safeFloor,
        gateIndex,
        gateStart: rule.gateStart,
        gateEnd: rule.gateEnd,
        layerInGate,
        isGateBoss,
        gateLabel: rule.label,
        gateRangeLabel: `${rule.gateStart}-${rule.gateEnd}层`,
        rewardTier: rule.rewardTier,
        layerProgress,
        minAge: rule.minAge,
        maxAge: rule.maxAge,
        qualitySteps: rule.qualitySteps,
        isTopNine: safeFloor >= 100,
        totalFloors: SOUL_TOWER_TOTAL_FLOORS,
        key: rule.key,
      };
    }

    function hasMvuRuntime() {
      return !!getTavernHelperRuntime();
    }

    function getAllVariablesSafe() {
      try {
        const helper = getTavernHelperRuntime();
        if (!helper) return {};
        const vars = helper.getVariables({ type: 'message', message_id: 'latest' });
        if (vars && typeof vars.then === 'function') {
          console.warn('BattleUIBridge: TavernHelper.getVariables returned Promise; synchronous battle read skipped');
          return {};
        }
        return normalizeVariablesEnvelope(vars);
      } catch (error) {
        console.warn('BattleUIBridge: TavernHelper.getVariables failed', error);
        return {};
      }
    }

    function getMvuValue(path, fallback) {
      const normalized = normalizeStatPath(path);
      if (normalized === 'world.战斗' || normalized.startsWith('world.战斗.')) {
        const snapshotRoot = component?.snapshot?.rootData || snapshot?.rootData;
        const snapshotValue = lodashGet(snapshotRoot, normalized, undefined);
        if (snapshotValue !== undefined) return snapshotValue;
      }
      if (!normalized) return lodashGet(getAllVariablesSafe(), 'stat_data', fallback);
      return lodashGet(getAllVariablesSafe(), `stat_data.${normalized}`, fallback);
    }

    async function waitForMvuReady() {
      try {
        const host = getHostWindow();
        const waiter =
          typeof root.waitGlobalInitialized === 'function'
            ? root.waitGlobalInitialized.bind(root)
            : typeof host?.waitGlobalInitialized === 'function'
              ? host.waitGlobalInitialized.bind(host)
              : null;
        if (waiter) {
          await waiter('Mvu');
        }
      } catch (error) {
        console.warn('BattleUIBridge: waitForMvuReady failed', error);
      }
      return hasMvuRuntime();
    }

    function subscribeMvuUpdates(handler) {
      if (typeof handler !== 'function') return false;
      const host = getHostWindow();
      const eventName = root.Mvu?.events?.VARIABLE_UPDATE_ENDED || host?.Mvu?.events?.VARIABLE_UPDATE_ENDED;
      const eventOnFn =
        typeof root.eventOn === 'function'
          ? root.eventOn.bind(root)
          : typeof host?.eventOn === 'function'
            ? host.eventOn.bind(host)
            : null;
      if (!eventName || !eventOnFn) return false;
      eventOnFn(eventName, handler);
      return true;
    }

    function cloneBattleValue(value) {
      if (value == null) return value;
      if (typeof structuredClone === 'function') return structuredClone(value);
      return JSON.parse(JSON.stringify(value));
    }

    function escapeJsonPointerSegment(segment) {
      return String(segment).replace(/~/g, '~0').replace(/\//g, '~1');
    }

    const COMBAT_STAT_KEYS = [
      '年龄',
      '等级',
      '天赋梯队',
      '邪魂师',
      'HP',
      'HP上限',
      '魂力',
      '魂力上限',
      '精神力',
      '精神力上限',
      '力量',
      '防御',
      '敏捷',
      '体力',
      '体力上限',
      '状态效果',
    ];
    const COMBAT_STATUS_KEYS = ['存活', '死亡tick', '死亡类型', '受伤部位', '行动', '当前领域', '位置', '横坐标', '纵坐标'];
    const COMBAT_PROCESS_SYNC_STAT_KEYS = COMBAT_STAT_KEYS.filter(key => !['HP', 'HP上限'].includes(key));
    const COMBAT_PROCESS_SYNC_STATUS_KEYS = COMBAT_STATUS_KEYS.filter(key => !['存活', '受伤部位'].includes(key));

    function sanitizeCombatPersistenceData(value) {
      if (Array.isArray(value)) return value.map(item => sanitizeCombatPersistenceData(item));
      if (!value || typeof value !== 'object') return value;
      const cleaned = {};
      Object.entries(value).forEach(([key, item]) => {
        if (key === 'is_controlled' || key === 'action_declared' || key === '_current_cast_time' || /^temp_/.test(key))
          return;
        cleaned[key] = sanitizeCombatPersistenceData(item);
      });
      return cleaned;
    }

    function isPlainRecord(value) {
      return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    function isDeepEqual(left, right) {
      if (left === right) return true;
      if (Number.isNaN(left) && Number.isNaN(right)) return true;

      if (Array.isArray(left) || Array.isArray(right)) {
        if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
        for (let index = 0; index < left.length; index += 1) {
          if (!isDeepEqual(left[index], right[index])) return false;
        }
        return true;
      }

      if (isPlainRecord(left) || isPlainRecord(right)) {
        if (!isPlainRecord(left) || !isPlainRecord(right)) return false;
        const leftKeys = Object.keys(left);
        const rightKeys = Object.keys(right);
        if (leftKeys.length !== rightKeys.length) return false;
        for (let index = 0; index < leftKeys.length; index += 1) {
          const key = leftKeys[index];
          if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
          if (!isDeepEqual(left[key], right[key])) return false;
        }
        return true;
      }

      return false;
    }

    function clonePersistedCombatValue(value) {
      return sanitizeCombatPersistenceData(cloneBattleValue(value));
    }

    const COMBAT_STAT_RATIO_RUNTIME_TO_SCHEMA_KEY = {
      str: '力量',
      def: '防御',
      agi: '敏捷',
      sp_max: '魂力上限',
    };
    const COMBAT_STAT_RATIO_SCHEMA_TO_RUNTIME_KEY = {
      力量: 'str',
      防御: 'def',
      敏捷: 'agi',
      魂力上限: 'sp_max',
    };
    const 战斗属性固定修正运行键到结构键 = {
      str: '力量',
      def: '防御',
      agi: '敏捷',
      vit_max: '体力上限',
      sp_max: '魂力上限',
      men_max: '精神力上限',
    };
    const 战斗属性固定修正结构键到运行键 = {
      力量: 'str',
      防御: 'def',
      敏捷: 'agi',
      体力上限: 'vit_max',
      魂力上限: 'sp_max',
      精神力上限: 'men_max',
    };
    const COMBAT_EFFECT_RUNTIME_TO_SCHEMA_KEY = {
      dot_damage: '持续伤害',
      skip_turn: '跳过回合',
      armor_pen: '破防比例',
    };
    const COMBAT_EFFECT_RUNTIME_DEFAULTS = {
      skip_turn: false,
      dot_damage: 0,
      armor_pen: 0,
    };

    const 战斗阶段枚举_V1 = Object.freeze({
      无: '无',
      宣告: '宣告阶段',
      对轰判定: '对轰判定阶段',
      回合结算: '回合结算阶段',
    });

    function buildSchemaStatRatioFromCondition(condition) {
      const schemaMods = {};
      const runtimeMods =
        condition?.面板修改比例 && typeof condition.面板修改比例 === 'object' && !Array.isArray(condition.面板修改比例)
          ? condition.面板修改比例
          : {};
      Object.entries(COMBAT_STAT_RATIO_RUNTIME_TO_SCHEMA_KEY).forEach(([runtimeKey, schemaKey]) => {
        const parsed = Number(runtimeMods[runtimeKey]);
        if (!Number.isFinite(parsed)) return;
        schemaMods[schemaKey] = parsed;
      });

      const rawSchemaMods =
        condition?.面板倍率 && typeof condition.面板倍率 === 'object' && !Array.isArray(condition.面板倍率)
          ? condition.面板倍率
          : {};
      Object.keys(COMBAT_STAT_RATIO_SCHEMA_TO_RUNTIME_KEY).forEach(schemaKey => {
        const parsed = Number(rawSchemaMods[schemaKey]);
        if (!Number.isFinite(parsed)) return;
        schemaMods[schemaKey] = parsed;
      });

      return schemaMods;
    }

    function 构建落盘属性固定值(condition) {
      const 结构固定值 = {};
      const 运行固定修正 =
        condition?.面板固定修正 && typeof condition.面板固定修正 === 'object' && !Array.isArray(condition.面板固定修正)
          ? condition.面板固定修正
          : {};
      Object.entries(战斗属性固定修正运行键到结构键).forEach(([运行键, 结构键]) => {
        const 解析值 = Number(运行固定修正[运行键]);
        if (!Number.isFinite(解析值) || Math.abs(解析值) < 0.0001) return;
        结构固定值[结构键] = 解析值;
      });

      const 原始结构固定值 =
        condition?.面板固定值 && typeof condition.面板固定值 === 'object' && !Array.isArray(condition.面板固定值)
          ? condition.面板固定值
          : {};
      Object.keys(战斗属性固定修正结构键到运行键).forEach(结构键 => {
        const 解析值 = Number(原始结构固定值[结构键]);
        if (!Number.isFinite(解析值) || Math.abs(解析值) < 0.0001) return;
        结构固定值[结构键] = 解析值;
      });

      return 结构固定值;
    }

    function buildSchemaCombatEffectsFromCondition(condition) {
      const schemaEffects = {};
      const rawEffects =
        condition?.战斗效果 && typeof condition.战斗效果 === 'object' && !Array.isArray(condition.战斗效果)
          ? condition.战斗效果
          : {};

      Object.entries(COMBAT_EFFECT_RUNTIME_TO_SCHEMA_KEY).forEach(([runtimeKey, schemaKey]) => {
        let value = rawEffects[runtimeKey];
        if (value === undefined && rawEffects[schemaKey] !== undefined) value = rawEffects[schemaKey];
        if (value === undefined) value = COMBAT_EFFECT_RUNTIME_DEFAULTS[runtimeKey];
        const normalized =
          runtimeKey === 'skip_turn' ? value === true : Number.isFinite(Number(value)) ? Number(value) : 0;
        schemaEffects[schemaKey] = normalized;
      });

      return schemaEffects;
    }

    function buildCombatConditionPersistenceSnapshot(condition) {
      const source = sanitizeCombatPersistenceData(cloneBattleValue(condition || {}));
      const durationCandidate = source.持续回合 !== undefined ? source.持续回合 : source.duration;
      const durationParsed = Number(durationCandidate);
      const duration = Number.isFinite(durationParsed) ? Math.max(0, durationParsed) : 0;
      const layerParsed = Number(source.层数);
      const snapshot = {
        ...source,
        类型: String(source.类型 || 'buff'),
        层数: Number.isFinite(layerParsed) ? layerParsed : 1,
        描述: String(source.描述 || '无'),
        持续回合: duration,
        面板倍率: buildSchemaStatRatioFromCondition(source),
        面板固定值: 构建落盘属性固定值(source),
        战斗效果: buildSchemaCombatEffectsFromCondition(source),
      };
      delete snapshot.duration;
      delete snapshot.面板修改比例;
      delete snapshot.面板固定修正;
      return snapshot;
    }

    function buildCombatConditionMapPersistenceSnapshot(conditionMap) {
      if (!conditionMap || typeof conditionMap !== 'object' || Array.isArray(conditionMap)) return {};
      const snapshot = {};
      Object.entries(conditionMap).forEach(([name, condition]) => {
        if (!name) return;
        snapshot[name] = buildCombatConditionPersistenceSnapshot(condition);
      });
      return snapshot;
    }

    function buildCanonicalCombatStatSnapshot(participant, statKeys = COMBAT_PROCESS_SYNC_STAT_KEYS) {
      if (!participant || typeof participant !== 'object') return undefined;
      const sourceStat = participant.属性 && typeof participant.属性 === 'object' ? participant.属性 : participant;
      const snapshot = {};
      statKeys.forEach(key => {
        if (sourceStat[key] === undefined) return;
        if (key === '状态效果') {
          snapshot[key] = buildCombatConditionMapPersistenceSnapshot(sourceStat[key]);
          return;
        }
        snapshot[key] = clonePersistedCombatValue(sourceStat[key]);
      });
      return Object.keys(snapshot).length ? snapshot : undefined;
    }

    function buildCanonicalCombatStatusSnapshot(participant, statusKeys = COMBAT_PROCESS_SYNC_STATUS_KEYS) {
      if (!participant || typeof participant !== 'object') return undefined;
      const sourceStatus = participant.状态 && typeof participant.状态 === 'object' ? participant.状态 : participant;
      const snapshot = {};
      statusKeys.forEach(key => {
        if (sourceStatus[key] !== undefined) snapshot[key] = clonePersistedCombatValue(sourceStatus[key]);
      });
      return Object.keys(snapshot).length ? snapshot : undefined;
    }

    function buildCanonicalParticipantPersistenceSnapshot(participant, options = {}) {
      if (!participant || typeof participant !== 'object') return undefined;
      const source = sanitizeCombatPersistenceData(participant);
      const snapshot = {};
      const statSnapshot = buildCanonicalCombatStatSnapshot(source);
      const statusSnapshot = buildCanonicalCombatStatusSnapshot(source);
      if (statSnapshot) snapshot.属性 = statSnapshot;
      if (statusSnapshot) snapshot.状态 = statusSnapshot;
      if (options.includeHpFields) {
        const hpSnapshot = buildCanonicalCombatStatSnapshot(source, ['HP', 'HP上限']);
        if (hpSnapshot) snapshot.属性 = { ...(snapshot.属性 || {}), ...hpSnapshot };
      }
      ['决策记忆', '血脉之力', '复制效果'].forEach(key => {
        if (source[key] !== undefined) snapshot[key] = clonePersistedCombatValue(source[key]);
      });
      const equipmentSnapshot = source.装备;
      if (equipmentSnapshot !== undefined) snapshot.装备 = clonePersistedCombatValue(equipmentSnapshot);
      return Object.keys(snapshot).length ? snapshot : undefined;
    }

    function appendJsonPatchDiff(ops, basePath, previousValue, nextValue) {
      if (!basePath) return;

      if (nextValue === undefined) {
        if (previousValue !== undefined) ops.push({ op: 'remove', path: basePath });
        return;
      }

      if (previousValue === undefined) {
        ops.push({ op: 'add', path: basePath, value: cloneBattleValue(nextValue) });
        return;
      }

      if (isDeepEqual(previousValue, nextValue)) return;

      const prevIsArray = Array.isArray(previousValue);
      const nextIsArray = Array.isArray(nextValue);
      if (prevIsArray || nextIsArray) {
        ops.push({ op: 'replace', path: basePath, value: cloneBattleValue(nextValue) });
        return;
      }

      const prevIsObject = isPlainRecord(previousValue);
      const nextIsObject = isPlainRecord(nextValue);
      if (prevIsObject && nextIsObject) {
        const keys = new Set([...Object.keys(previousValue), ...Object.keys(nextValue)]);
        keys.forEach(key => {
          appendJsonPatchDiff(
            ops,
            `${basePath}/${escapeJsonPointerSegment(key)}`,
            previousValue[key],
            nextValue[key],
          );
        });
        return;
      }

      ops.push({ op: 'replace', path: basePath, value: cloneBattleValue(nextValue) });
    }

    function appendNonCanonicalParticipantCleanupOps(ops, participantPath, currentCharData) {
      if (!participantPath || !currentCharData || typeof currentCharData !== 'object') return;
      const runtimeAliasKeys = new Set([...COMBAT_STAT_KEYS, ...COMBAT_STATUS_KEYS]);
      runtimeAliasKeys.forEach(key => {
        if (!Object.prototype.hasOwnProperty.call(currentCharData, key)) return;
        ops.push({ op: 'remove', path: `${participantPath}/${escapeJsonPointerSegment(key)}` });
      });
    }

    function appendParticipantHpRecoverySnapshot(nextSnapshot, previousSnapshot, participant) {
      const sourceStat = participant?.属性 && typeof participant.属性 === 'object' ? participant.属性 : participant;
      const previousStat = previousSnapshot?.属性 && typeof previousSnapshot.属性 === 'object' ? previousSnapshot.属性 : {};
      const nextHp = Number(sourceStat?.HP);
      const prevHp = Number(previousStat?.HP);
      if (!Number.isFinite(nextHp)) return nextSnapshot;
      if (Number.isFinite(prevHp) && nextHp <= prevHp) return nextSnapshot;
      const hpFields = buildCanonicalCombatStatSnapshot(participant, ['HP', 'HP上限']);
      if (!hpFields) return nextSnapshot;
      nextSnapshot.属性 = { ...(nextSnapshot.属性 || {}), ...hpFields };
      return nextSnapshot;
    }

    function isTemporaryCombatParticipant(participant) {
      return !!(
        participant &&
        typeof participant === 'object' &&
        String(participant.来源 || '').trim() === '临时单位' &&
        String(participant.单位性质 || '').trim()
      );
    }

    function buildTemporaryCombatParticipantPersistenceSnapshot(participant) {
      if (!participant || typeof participant !== 'object') return undefined;
      const source = sanitizeCombatPersistenceData(cloneBattleValue(participant));
      const snapshot = {
        name: String(source.name || '').trim() || '未知',
        来源: '临时单位',
        单位性质: String(source.单位性质 || '').trim(),
      };
      ['身份', '数量', '等级', '年限', '品质', '标准物种', '级别', '标准种族'].forEach(key => {
        if (source[key] !== undefined) snapshot[key] = clonePersistedCombatValue(source[key]);
      });
      const canonical = buildCanonicalParticipantPersistenceSnapshot(source) || {};
      Object.assign(snapshot, canonical);
      const hpFields = buildCanonicalCombatStatSnapshot(source, ['HP', 'HP上限']) || {};
      if (Object.keys(hpFields).length) {
        snapshot.属性 = { ...(snapshot.属性 || {}), ...hpFields };
      }
      if (source.状态 && typeof source.状态 === 'object') {
        snapshot.状态 = {
          ...(snapshot.状态 || {}),
          存活: source.状态.存活 !== false,
          ...(source.状态.受伤部位 !== undefined ? { 受伤部位: clonePersistedCombatValue(source.状态.受伤部位) } : {}),
        };
      }
      if (source.自创魂技 && typeof source.自创魂技 === 'object' && !Array.isArray(source.自创魂技)) {
        snapshot.自创魂技 = clonePersistedCombatValue(source.自创魂技);
      }
      return snapshot;
    }

    function pushParticipantSyncPatch(ops, participant, options = {}) {
      if (!participant || typeof participant !== 'object') return;
      if (isTemporaryCombatParticipant(participant)) return;
      if (participant.实力压制 && participant.实力压制.刻意压制等级 === true) return;
      const participantName = String(participant.name || '').trim();
      if (!participantName) return;

      const participantPath = `/char/${escapeJsonPointerSegment(participantName)}`;
      const currentCharData = getMvuValue(`char.${participantName}`, undefined);
      const 包含生命字段 = options.syncHpRecoveryOnly !== true;
      const previousSnapshot =
        buildCanonicalParticipantPersistenceSnapshot(currentCharData, { includeHpFields: 包含生命字段 }) || {};
      const nextSnapshot = buildCanonicalParticipantPersistenceSnapshot(participant, { includeHpFields: 包含生命字段 });
      if (!nextSnapshot || typeof nextSnapshot !== 'object' || Object.keys(nextSnapshot).length === 0) return;
      if (options.syncHpRecoveryOnly) appendParticipantHpRecoverySnapshot(nextSnapshot, previousSnapshot, participant);
      const fieldKeys = new Set([...Object.keys(previousSnapshot), ...Object.keys(nextSnapshot)]);

      fieldKeys.forEach(key => {
        appendJsonPatchDiff(
          ops,
          `${participantPath}/${escapeJsonPointerSegment(key)}`,
          previousSnapshot[key],
          nextSnapshot[key],
        );
      });

      appendNonCanonicalParticipantCleanupOps(ops, participantPath, currentCharData);
    }

    const COMBAT_WORLD_PERSIST_KEYS = [
      '进行中',
      '战斗类型',
      '战斗意图',
      '胜负条件',
      '先攻',
      '允许撤离',
      '环境',
      '裁断结果',
      'floor',
      '大关卡',
      '大关标签',
      '关卡范围',
      '关底战',
      '魂灵塔待结算',
      '试炼状态',
      '虚拟裁断数据',
    ];

    function compactCombatParticipantForPersistence(participant) {
      if (participant === null || participant === undefined) return undefined;
      if (typeof participant === 'string' || typeof participant === 'number') {
        return { name: String(participant) };
      }
      if (typeof participant !== 'object' || Array.isArray(participant)) return undefined;
      const source = sanitizeCombatPersistenceData(participant);
      if (isTemporaryCombatParticipant(source)) {
        return buildTemporaryCombatParticipantPersistenceSnapshot(source);
      }
      const compact = {};
      const participantName = String(source.name || '').trim();
      if (participantName) compact.name = participantName;
      if (source.势力 !== undefined) compact.势力 = String(source.势力 || '');
      if (source.实力压制 && typeof source.实力压制 === 'object') {
        compact.实力压制 = clonePersistedCombatValue(source.实力压制);
      }
      const aliveCandidate =
        source.存活 !== undefined
          ? source.存活
          : source.状态 && typeof source.状态 === 'object'
            ? source.状态.存活
            : undefined;
      if (aliveCandidate !== undefined) compact.存活 = aliveCandidate !== false;
      return Object.keys(compact).length ? compact : undefined;
    }

    function compactCombatDataForPersistence(combatData) {
      const source = sanitizeCombatPersistenceData(cloneBattleValue(combatData || {}));
      const compact = {};

      COMBAT_WORLD_PERSIST_KEYS.forEach(key => {
        if (source[key] !== undefined) compact[key] = source[key];
      });

      const roundCandidate = source.回合;
      if (roundCandidate !== undefined) {
        const roundParsed = Number(roundCandidate);
        compact.回合 = Number.isFinite(roundParsed) ? Math.max(0, roundParsed) : 0;
      }

      const participants = source.参战者 && typeof source.参战者 === 'object' ? source.参战者 : undefined;
      if (participants) {
        const compactParticipants = {};
        if (Array.isArray(participants.team_player)) {
          compactParticipants.team_player = participants.team_player
            .map(compactCombatParticipantForPersistence)
            .filter(Boolean);
        }
        if (Array.isArray(participants.team_enemy)) {
          compactParticipants.team_enemy = participants.team_enemy
            .map(compactCombatParticipantForPersistence)
            .filter(Boolean);
        }
        if (Object.keys(compactParticipants).length) compact.参战者 = compactParticipants;
      }

      return compact;
    }

    function buildCombatJsonPatch(combatData, options = {}) {
      const fullCombatData = sanitizeCombatPersistenceData(cloneBattleValue(combatData || {}));
      const safeCombatData = compactCombatDataForPersistence(fullCombatData);
      const ops = [];
      const previousRawCombatData = sanitizeCombatPersistenceData(getMvuValue('world.战斗', undefined));
      const previousCombatData = compactCombatDataForPersistence(previousRawCombatData);
      appendJsonPatchDiff(ops, '/world/战斗', previousCombatData, safeCombatData);

      const participants = fullCombatData?.参战者;
      if (!participants) return ops;
      if (options.skipParticipantSync === true) return ops;

      (participants.team_player || []).forEach(unit => pushParticipantSyncPatch(ops, unit, options));
      (participants.team_enemy || []).forEach(unit => pushParticipantSyncPatch(ops, unit, options));

      return ops;
    }

    function buildUpdateVariableText(patchOps, options = {}) {
      const analysis = String(
        options.analysis ||
          'Frontend battle arbitration already produced the exact combat result. Apply the following JSONPatch exactly as given.',
      ).trim();
      return `<UpdateVariable>\n<Analysis>${analysis}</Analysis>\n<JSONPatch>\n${JSON.stringify(patchOps || [], null, 2)}\n</JSONPatch>\n</UpdateVariable>`;
    }

    function persistCombatData(combatData, options = {}) {
      const safeCombatData = compactCombatDataForPersistence(combatData);
      const patchOps = buildCombatJsonPatch(combatData, {
        syncHpRecoveryOnly: options.syncHpRecoveryOnly !== false,
        skipParticipantSync: options.skipParticipantSync === true,
      });
      if (Array.isArray(options.extraPatchOps)) {
        patchOps.push(...options.extraPatchOps);
      }
      const updateVariableText = buildUpdateVariableText(patchOps, options);
      const detail = {
        combatData: safeCombatData,
        patchOps,
        updateVariableText,
        rootPath: '/world/战斗',
      };

      root.__lastBattleMvuUpdateRequest = detail;

      const bridge = root.BattleUIBridge || {};
      const adapter = bridge.hostAdapter || root.__battleUIHostAdapter;
      if (typeof bridge.onCombatDataChanged === 'function') {
        try {
          detail.delivery = bridge.onCombatDataChanged(detail);
        } catch (error) {
          console.warn('BattleUIBridge.onCombatDataChanged failed', error);
        }
      } else if (adapter && typeof adapter.onCombatDataChanged === 'function') {
        try {
          detail.delivery = adapter.onCombatDataChanged(detail);
        } catch (error) {
          console.warn('BattleUI hostAdapter.onCombatDataChanged failed', error);
        }
      }

      try {
        root.dispatchEvent(new CustomEvent('battle-ui-mvu-update-request', { detail }));
      } catch (error) {
        console.warn('battle-ui-mvu-update-request dispatch failed', error);
      }

      try {
        root.dispatchEvent(new CustomEvent('battle-ui-combat-data-changed', { detail }));
      } catch (error) {
        console.warn('battle-ui-combat-data-changed dispatch failed', error);
      }

      return detail;
    }

    function getHostWindow() {
      try {
        if (root.parent && root.parent !== root && root.parent.document) return root.parent;
      } catch (error) {
        console.warn('BattleUIBridge: parent window unavailable, fallback current window', error);
      }
      return root;
    }

    function getHostDocument() {
      return getHostWindow().document || document;
    }

    function findFirstElement(selectors, doc = getHostDocument()) {
      for (const selector of selectors) {
        const node = doc.querySelector(selector);
        if (node) return node;
      }
      return null;
    }

    function createInputEvent(type) {
      try {
        return new InputEvent(type, { bubbles: true, cancelable: true, composed: true });
      } catch (error) {
        return new Event(type, { bubbles: true, cancelable: true, composed: true });
      }
    }

    function setElementValue(element, value) {
      if (!element) return false;
      const nextValue = String(value ?? '');
      if (element.isContentEditable) {
        if ('textContent' in element) element.textContent = nextValue;
        if ('innerText' in element && element.innerText !== nextValue) element.innerText = nextValue;
        element.dispatchEvent(createInputEvent('input'));
        element.dispatchEvent(createInputEvent('change'));
        return true;
      }
      const prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
      if (descriptor?.set) descriptor.set.call(element, nextValue);
      else element.value = nextValue;
      element.dispatchEvent(createInputEvent('input'));
      element.dispatchEvent(createInputEvent('change'));
      return true;
    }

    function findChatInput(doc = getHostDocument()) {
      return findFirstElement(
        [
          '#send_textarea',
          '#chat_input',
          '#user-input',
          '#user_input',
          'textarea[data-testid="chat-input"]',
          'textarea[placeholder*="发送"]',
          'textarea[placeholder*="Send"]',
          'textarea[name="chat_input"]',
          'textarea[name="user_input"]',
          '[contenteditable="true"][data-testid="chat-input"]',
          'form [contenteditable="true"][role="textbox"]',
          '[contenteditable="true"][aria-label*="Send"]',
          '[contenteditable="true"][aria-label*="发送"]',
          'form textarea',
          'textarea',
        ],
        doc,
      );
    }

    function findSendButton(doc = getHostDocument()) {
      return findFirstElement(
        [
          '#send_but',
          '#send-button',
          'button[data-testid="send-button"]',
          'button[title*="Send"]',
          'button[aria-label*="Send"]',
          'button[aria-label*="发送"]',
          'button[title*="发送"]',
          'form button[type="submit"]',
        ],
        doc,
      );
    }

    function fillChatInput(text, options = {}) {
      const doc = options.document || getHostDocument();
      const input = findChatInput(doc);
      const ok = setElementValue(input, text);
      if (ok && typeof input?.focus === 'function') input.focus();
      return { ok, input };
    }

    function clickSendButton(options = {}) {
      const doc = options.document || getHostDocument();
      const button = findSendButton(doc);
      if (!button) return { ok: false, button: null };
      button.click();
      return { ok: true, button };
    }

    const BATTLE_SYSTEM_PROMPT_INJECTION_ID = 'lwcs-battle-ui-system-prompt';

    function findPromptInjectionApi() {
      const owners = [root];
      try {
        const host = getHostWindow();
        if (host && !owners.includes(host)) owners.push(host);
      } catch (_) {}
      for (const owner of owners) {
        const targets = [owner];
        try {
          const helper = owner?.TavernHelper;
          if (helper && !targets.includes(helper)) targets.push(helper);
        } catch (_) {}
        for (const target of targets) {
          try {
            if (typeof target?.injectPrompts !== 'function' || typeof target?.uninjectPrompts !== 'function') continue;
            return {
              inject: target.injectPrompts.bind(target),
              uninject: target.uninjectPrompts.bind(target),
            };
          } catch (_) {}
        }
      }
      return null;
    }

    function isTauriTavernHost() {
      const candidates = [root];
      try {
        const host = getHostWindow();
        if (host && !candidates.includes(host)) candidates.push(host);
      } catch (_) {}
      return candidates.some(candidate => {
        try {
          const tauriTavern = candidate?.__TAURITAVERN__;
          return Object.prototype.hasOwnProperty.call(candidate, '__TAURITAVERN_MAIN_READY__')
            || (!!tauriTavern && typeof tauriTavern === 'object')
            || (!!tauriTavern && Object.prototype.hasOwnProperty.call(tauriTavern, 'ready'));
        } catch (_) {
          return false;
        }
      });
    }

    function recordInjectedSystemPrompt(prompt, meta = {}) {
      const normalizedPrompt = String(prompt || '').trim();
      if (!normalizedPrompt) return '';
      root.__battleLastInjectedSystemPrompt = {
        prompt: normalizedPrompt,
        ...meta,
        at: Date.now(),
      };
      try {
        root.dispatchEvent(
          new CustomEvent('battle-ui-system-prompt-consumed', {
            detail: root.__battleLastInjectedSystemPrompt,
          }),
        );
      } catch (error) {
        console.warn('battle-ui-system-prompt-consumed dispatch failed', error);
      }
      return normalizedPrompt;
    }

    function queueSystemPrompt(text) {
      const prompt = String(text || '');
      const injectionApi = findPromptInjectionApi();
      const tauriTavern = isTauriTavernHost();
      let delivery = prompt ? 'unavailable' : 'cleared';
      let injectionMeta = null;
      let failure = null;

      if (injectionApi) {
        try {
          injectionApi.uninject([BATTLE_SYSTEM_PROMPT_INJECTION_ID]);
          if (prompt) {
            injectionApi.inject(
              [{
                id: BATTLE_SYSTEM_PROMPT_INJECTION_ID,
                position: 'in_chat',
                depth: 0,
                role: 'system',
                content: prompt,
                should_scan: false,
              }],
              { once: true },
            );
            delivery = 'injectPrompts';
            injectionMeta = {
              transport: 'injectPrompts',
              injectionId: BATTLE_SYSTEM_PROMPT_INJECTION_ID,
            };
          }
        } catch (error) {
          failure = error;
        }
      } else if (prompt && !tauriTavern) {
        if (installHostHooks()) {
          root.__battlePendingSystemPrompt = prompt;
          delivery = 'fetch-xhr-fallback';
        } else {
          failure = new Error('battle_system_prompt_fallback_unavailable');
        }
      }

      if (delivery !== 'fetch-xhr-fallback') root.__battlePendingSystemPrompt = '';
      try {
        root.dispatchEvent(new CustomEvent('battle-ui-system-prompt-ready', {
          detail: { systemPrompt: prompt, delivery },
        }));
      } catch (error) {
        console.warn('battle-ui-system-prompt-ready dispatch failed', error);
      }
      if (injectionMeta) recordInjectedSystemPrompt(prompt, injectionMeta);
      if (prompt && (failure || delivery === 'unavailable')) {
        const reason = tauriTavern
          ? 'TauriTavern 下 injectPrompts 不可用，已禁止安装全局请求 hook。'
          : 'injectPrompts 不可用且旧 fetch/XHR 兼容兜底未能安装。';
        console.warn('BattleUIBridge.queueSystemPrompt: ' + reason, failure || 'capability_unavailable');
      }
      return prompt;
    }

    function deliverBattleRequest(detail, options = {}) {
      const bridge = root.BattleUIBridge || {};
      if (typeof bridge.hostSend === 'function') {
        return bridge.hostSend({ ...detail, options });
      }
      const adapter = bridge.hostAdapter || root.__battleUIHostAdapter;
      if (adapter && typeof adapter.sendUIRequest === 'function') {
        return adapter.sendUIRequest({ ...detail, options });
      }
      if (adapter && typeof adapter.sendBattleRequest === 'function') {
        return adapter.sendBattleRequest({ ...detail, options });
      }

      return {
        ok: false,
        mode: 'host-unavailable',
        reason: 'battle_host_send_unavailable',
      };
    }

    function looksLikeGenerationUrl(url) {
      return /(generate|completion|chat-completions|text-completions|api\/backends|v1\/chat\/completions|v1\/completions)/i.test(
        String(url || ''),
      );
    }

    function appendPromptText(base, extra) {
      const baseText = String(base || '').trim();
      const extraText = String(extra || '').trim();
      if (!extraText) return base;
      if (!baseText) return extraText;
      return `${baseText}\n\n${extraText}`;
    }

    function consumeQueuedSystemPromptForInjection(meta = {}) {
      const prompt = String(root.__battlePendingSystemPrompt || '').trim();
      if (!prompt) return '';
      root.__battlePendingSystemPrompt = '';
      return recordInjectedSystemPrompt(prompt, meta);
    }

    function injectSystemPromptIntoPayload(payload, prompt) {
      if (!payload || typeof payload !== 'object' || !prompt) {
        return { payload, injected: false, channel: null };
      }

      let injected = false;
      let channel = null;

      if (Array.isArray(payload.messages)) {
        const messages = payload.messages.map(msg => ({ ...msg }));
        const firstSystemIndex = messages.findIndex(msg => msg?.role === 'system');
        if (firstSystemIndex >= 0) {
          const target = { ...messages[firstSystemIndex] };
          if (typeof target.content === 'string' || target.content == null) {
            target.content = appendPromptText(target.content || '', prompt);
            messages[firstSystemIndex] = target;
          } else {
            messages.splice(firstSystemIndex, 0, { role: 'system', content: prompt });
          }
        } else {
          messages.unshift({ role: 'system', content: prompt });
        }
        payload = { ...payload, messages };
        injected = true;
        channel = 'messages.system';
      } else if (typeof payload.system === 'string' || payload.system == null) {
        payload = { ...payload, system: appendPromptText(payload.system || '', prompt) };
        injected = true;
        channel = 'system';
      } else if (typeof payload.systemPrompt === 'string' || payload.systemPrompt == null) {
        payload = { ...payload, systemPrompt: appendPromptText(payload.systemPrompt || '', prompt) };
        injected = true;
        channel = 'systemPrompt';
      } else if (typeof payload.instruction === 'string' || payload.instruction == null) {
        payload = { ...payload, instruction: appendPromptText(payload.instruction || '', prompt) };
        injected = true;
        channel = 'instruction';
      } else if (typeof payload.instructions === 'string' || payload.instructions == null) {
        payload = { ...payload, instructions: appendPromptText(payload.instructions || '', prompt) };
        injected = true;
        channel = 'instructions';
      } else if (typeof payload.prompt === 'string') {
        payload = { ...payload, prompt: `${prompt}\n\n${payload.prompt}` };
        injected = true;
        channel = 'prompt';
      }

      return { payload, injected, channel };
    }

    function patchRequestBodyIfNeeded(bodyText, url, transport) {
      const pendingPrompt = String(root.__battlePendingSystemPrompt || '').trim();
      if (!pendingPrompt || !looksLikeGenerationUrl(url) || typeof bodyText !== 'string' || !bodyText.trim()) {
        return { bodyText, injected: false, channel: null };
      }

      try {
        const payload = JSON.parse(bodyText);
        const promptToInject = consumeQueuedSystemPromptForInjection({ url: String(url || ''), transport });
        if (!promptToInject) return { bodyText, injected: false, channel: null };
        const result = injectSystemPromptIntoPayload(payload, promptToInject);
        if (!result.injected) {
          root.__battlePendingSystemPrompt = promptToInject;
          return { bodyText, injected: false, channel: null };
        }
        return {
          bodyText: JSON.stringify(result.payload),
          injected: true,
          channel: result.channel,
        };
      } catch (error) {
        return { bodyText, injected: false, channel: null };
      }
    }

    function installFetchHook() {
      const host = getHostWindow();
      if (!host || host.__battleUIFetchHookInstalled || typeof host.fetch !== 'function') return;
      const nativeFetch = host.fetch.bind(host);
      const HostRequest = host.Request || Request;

      host.fetch = async function (input, init) {
        let nextInput = input;
        let nextInit = init;
        const url = typeof input === 'string' ? input : input?.url || init?.url || '';

        if (init?.body && typeof init.body === 'string') {
          const patched = patchRequestBodyIfNeeded(init.body, url, 'fetch:init');
          if (patched.injected) {
            nextInit = { ...init, body: patched.bodyText };
          }
        } else if (typeof HostRequest !== 'undefined' && input instanceof HostRequest && !init?.body) {
          try {
            const cloned = input.clone();
            const bodyText = await cloned.text();
            const patched = patchRequestBodyIfNeeded(bodyText, url, 'fetch:request');
            if (patched.injected) {
              nextInput = new HostRequest(input, { body: patched.bodyText });
            }
          } catch (error) {
            // ignore request body patch failure
          }
        }

        return nativeFetch(nextInput, nextInit);
      };

      host.__battleUIFetchHookInstalled = true;
    }

    function installXHRHook() {
      const host = getHostWindow();
      const XHR = host?.XMLHttpRequest;
      if (!XHR || XHR.prototype.__battleUIXHRHookInstalled) return;
      const nativeOpen = XHR.prototype.open;
      const nativeSend = XHR.prototype.send;

      XHR.prototype.open = function (method, url, ...rest) {
        this.__battleUIRequestUrl = url;
        return nativeOpen.call(this, method, url, ...rest);
      };

      XHR.prototype.send = function (body) {
        if (typeof body === 'string') {
          const patched = patchRequestBodyIfNeeded(body, this.__battleUIRequestUrl, 'xhr');
          if (patched.injected) {
            body = patched.bodyText;
          }
        }
        return nativeSend.call(this, body);
      };

      XHR.prototype.__battleUIXHRHookInstalled = true;
    }

    function installHostHooks() {
      if (isTauriTavernHost()) {
        console.warn('BattleUIBridge.installHostHooks: TauriTavern 下禁止覆盖全局 fetch/XHR。');
        return false;
      }
      installFetchHook();
      installXHRHook();
      const host = getHostWindow();
      return !!(
        host?.__battleUIFetchHookInstalled
        || host?.XMLHttpRequest?.prototype?.__battleUIXHRHookInstalled
      );
    }

    if (typeof root.sendToAI !== 'function') {
      root.sendToAI = function (playerInput, systemPrompt, meta = {}) {
        const requestKind = String(meta?.requestKind || 'battle_settlement_plot');
        const detail = {
          requestSource: 'Battle_UI',
          requestKind,
          playerInput: String(playerInput || ''),
          systemPrompt: String(systemPrompt || ''),
          mvuUpdate: meta?.mvuUpdate || null,
          channels: {
            userInput: String(playerInput || ''),
            hiddenSystemPrompt: String(systemPrompt || ''),
            updateVariableText: String(meta?.mvuUpdate?.updateVariableText || ''),
            requestKind,
          },
        };
        detail.delivery = deliverBattleRequest(detail, { autoSend: meta?.autoSend !== false });
        root.__lastBattleAIRequest = detail;
        try {
          root.dispatchEvent(new CustomEvent('battle-ui-ai-request', { detail }));
        } catch (error) {
          console.warn('battle-ui-ai-request dispatch failed', error);
        }
        return detail;
      };
    }

    function 格式化战斗模式显示文本(modeLabel = '', battleMode = '', mode = '') {
      const raw = String(modeLabel || battleMode || mode || '战斗').trim();
      if (!raw) return '战斗';
      if (/自动续推|multi_round/i.test(raw)) return '多回合';
      if (/single_round/i.test(raw)) return '单回合';
      return raw;
    }

    function registerBattleSettlementContext(payload = {}) {
      let api = null;
      try { api = root.__LWCS_REGISTER_BATTLE_SETTLEMENT_CONTEXT__; } catch (_) {}
      try { if (typeof api !== 'function') api = root.parent?.__LWCS_REGISTER_BATTLE_SETTLEMENT_CONTEXT__; } catch (_) {}
      try { if (typeof api !== 'function') api = root.top?.__LWCS_REGISTER_BATTLE_SETTLEMENT_CONTEXT__; } catch (_) {}
      if (typeof api !== 'function') return { ok: false, reason: 'battle_settlement_context_api_missing' };
      try {
        return api(payload);
      } catch (error) {
        console.warn('[battle] register battle settlement context failed', error);
        return { ok: false, reason: error && error.message ? error.message : 'battle_settlement_context_register_failed' };
      }
    }

    root.BattleUIBridge = Object.assign(root.BattleUIBridge || {}, {
      hasMvu() {
        return hasMvuRuntime();
      },
      async waitForMvuReady() {
        return waitForMvuReady();
      },
      getAllVariables() {
        return getAllVariablesSafe();
      },
      getStatData() {
        return getMvuValue('', {});
      },
      getMVU(path) {
        return getMvuValue(path);
      },
      setMVU(path, value) {
        console.warn(
          'BattleUIBridge.setMVU 未启用：当前按明月秋青规范仅从 getAllVariables()/stat_data 读取 MVU 变量。',
          path,
          value,
        );
        return false;
      },
      initCombatContext() {
        console.warn('BattleUIBridge.initCombatContext 已停用：战斗上下文应由 MVU 系统维护在 stat_data.* 下。');
        return getMvuValue('world.战斗');
      },
      getBattleContext() {
        return getMvuValue('world.战斗');
      },
      subscribeMvuUpdates(handler) {
        return subscribeMvuUpdates(handler);
      },
      getBattleSubmitMode() {
        return 读取战斗提交模式();
      },
      setBattleSubmitMode(mode) {
        const 下个模式 = 写入战斗提交模式(mode);
        同步战斗提交模式控件();
        try {
          root.dispatchEvent(new CustomEvent('battle-submit-mode-changed', { detail: { mode: 下个模式 } }));
        } catch (error) {}
        return 下个模式;
      },
      persistCombatData(combatData, options = {}) {
        return persistCombatData(combatData, options);
      },
      executePlayerBattleIntent(playerInput, options = {}) {
        const impl = root.BattleUIBridge?.__executePlayerBattleIntentImpl;
        if (typeof impl === 'function') return impl(playerInput, options);
        throw new Error('battle_player_intent_engine_not_ready');
      },
      executeBattleFlow(combatData, options = {}) {
        const impl = root.BattleUIBridge?.__executeBattleFlowImpl;
        if (typeof impl === 'function') return impl(combatData, options);
        throw new Error('battle_flow_engine_not_ready');
      },
      getBattleSnapshot(combatData) {
        const impl = root.BattleUIBridge?.__getBattleSnapshotImpl;
        if (typeof impl === 'function') return impl(combatData);
        return null;
      },
      getAvailableActions(charData, combatData) {
        const impl = root.BattleUIBridge?.__getAvailableActionsImpl;
        if (typeof impl === 'function') return impl(charData, combatData);
        return [];
      },
      buildCombatJsonPatch(combatData) {
        return buildCombatJsonPatch(combatData);
      },
      buildUpdateVariableTextFromCombat(combatData, options = {}) {
        return buildUpdateVariableText(buildCombatJsonPatch(combatData), options);
      },
      getLastMvuUpdateRequest() {
        return root.__lastBattleMvuUpdateRequest || null;
      },
      setCombatContext() {
        console.warn('BattleUIBridge.setCombatContext 已停用：请通过 MVU 系统更新 stat_data.*。');
        return getMvuValue('world.战斗');
      },
      findChatInput() {
        return findChatInput();
      },
      findSendButton() {
        return findSendButton();
      },
      pushUserInput(text, options = {}) {
        const payload = String(text || '');
        const fillResult = fillChatInput(payload, options);
        const sendResult = options.autoSend === false ? { ok: false, button: null } : clickSendButton(options);
        return {
          text: payload,
          filled: !!fillResult.ok,
          sent: !!sendResult.ok,
          inputFound: !!fillResult.input,
          sendButtonFound: !!sendResult.button,
        };
      },
      setPendingSystemPrompt(text) {
        return queueSystemPrompt(text);
      },
      getPendingSystemPrompt() {
        return root.__battlePendingSystemPrompt || '';
      },
      consumePendingSystemPrompt() {
        const prompt = root.__battlePendingSystemPrompt || '';
        root.__battlePendingSystemPrompt = '';
        return prompt;
      },
      clearPendingSystemPrompt() {
        root.__battlePendingSystemPrompt = '';
      },
      setHostAdapter(adapter) {
        root.__battleUIHostAdapter = adapter || null;
        return root.__battleUIHostAdapter;
      },
      getHostAdapter() {
        return root.__battleUIHostAdapter || null;
      },
      installHostHooks() {
        return installHostHooks();
      },
      getLastInjectedSystemPrompt() {
        return root.__battleLastInjectedSystemPrompt || null;
      },
      deliverBattleRequest(detail, options = {}) {
        return deliverBattleRequest(detail, options);
      },
      getLastAIRequest() {
        return root.__lastBattleAIRequest || null;
      },
    });

    root.getBattleUiMvuValue = getMvuValue;
    root.getBattleUiAllVariables = getAllVariablesSafe;
    root.waitBattleUiMvuReady = waitForMvuReady;

    function fallbackNumber(value, fallback = 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    }

    function 单位是魂师单位(单位 = {}) {
      const 属性 = 单位?.属性 && typeof 单位.属性 === 'object' ? 单位.属性 : {};
      const 有武魂结构 = ['第1武魂', '第2武魂', '武魂', '自创魂技', '武魂融合技'].some(字段 => {
        const 值 = 单位?.[字段] ?? 属性?.[字段];
        return !!(值 && typeof 值 === 'object' && Object.keys(值).length);
      });
      if (有武魂结构) return true;
      const 文本 = [
        单位?.单位性质,
        单位?.类型,
        单位?.身份,
        单位?.主身份,
        单位?.职业,
        单位?.来源,
        属性?.单位性质,
        属性?.类型,
        属性?.身份,
        属性?.主身份,
        属性?.职业,
      ]
        .map(条目 => String(条目 || '').trim())
        .filter(Boolean)
        .join(' ');
      if (/非魂师|不是魂师/.test(文本)) return false;
      return /魂师/.test(文本);
    }

    function 单位是魂兽单位(单位 = {}) {
      const 属性 = 单位?.属性 && typeof 单位.属性 === 'object' ? 单位.属性 : {};
      const 文本 = [单位?.单位性质, 单位?.类型, 单位?.身份, 单位?.标准物种, 单位?.具体物种, 属性?.单位性质, 属性?.类型]
        .map(条目 => String(条目 || '').trim())
        .filter(Boolean)
        .join(' ');
      return /魂兽/.test(文本) || Math.max(0, fallbackNumber(单位?.年限 ?? 属性?.年限 ?? getCombatUnitAgeValue(单位), 0)) > 0;
    }

    function 读取战斗单位徽标文本(单位 = {}) {
      const 属性 = 单位?.属性 && typeof 单位.属性 === 'object' ? 单位.属性 : {};
      if (单位是魂师单位(单位)) return `Lv.${单位?.lv ?? 单位?.等级 ?? 属性?.等级 ?? 0}`;
      if (!单位是魂兽单位(单位)) return '';
      const 年限 = Math.max(0, Math.floor(fallbackNumber(单位?.年限 ?? 属性?.年限 ?? getCombatUnitAgeValue(单位), 0)));
      return 年限 > 0 ? `${年限}年` : '';
    }

    root.__LWCS_DEBUG_RUN_BATTLE_CASE__ = options => BATTLE_RUNTIME.runBattleCase(options);

    let formalBattleTransactionInFlight = false;

    async function onPlayerAttack(playerInput, options = {}) {
        const dryRun = options.dryRun === true;
        if (!dryRun && formalBattleTransactionInFlight) throw new Error('BATTLE_TRANSACTION_IN_FLIGHT');
        if (!dryRun) formalBattleTransactionInFlight = true;
        try {
        const state = root.BattleUI?.state || {};
        const sourceCombatData = options.combatData || state.combatData;
        if (!sourceCombatData || typeof sourceCombatData !== 'object') throw new Error('battle_combat_data_missing');
        const battleMode = options.mode === 'multi_round' ? 'multi_round' : 'single_round';
        const maxRounds = battleMode === 'multi_round'
          ? Math.max(1, Math.min(20, Math.floor(Number(options.autoContinueConfig?.maxRounds || sourceCombatData?.胜负条件?.maxRounds || 20))))
          : 1;
        const executeTransaction = root.BattleUIBridge?.executeBattleTransaction;
        if (typeof executeTransaction !== 'function') throw new Error('battle_transaction_unavailable');
        const currentSnapshot = component?.snapshot && typeof component.snapshot === 'object' ? component.snapshot : {};
        const dataRoot = currentSnapshot.rootData;
        const activeName = String(currentSnapshot.activeName || '').trim();
        const characterTable = dataRoot?.char;
        const characterKey = characterTable && typeof characterTable === 'object' && !Array.isArray(characterTable)
          ? Object.prototype.hasOwnProperty.call(characterTable, activeName)
            ? activeName
            : String(Object.entries(characterTable).find(([, character]) =>
              String(character?.name || character?.base?.name || '').trim() === activeName,
            )?.[0] || '').trim()
          : '';
        const targetLocation = String(sourceCombatData?.环境?.地点 || '').trim();
        const temporaryRuleIds = Array.isArray(sourceCombatData?.环境?.临时规则ID)
          ? sourceCombatData.环境.临时规则ID
          : [];
        const durationTicks = Number(options.durationTicks ?? options.actionDeclaration?.durationTicks ?? 0);
        const libraryWindows = [];
        try {
          libraryWindows.push(root);
        } catch (_error) {}
        try {
          const parentWindow = root.parent;
          if (parentWindow && parentWindow !== root) libraryWindows.push(parentWindow);
        } catch (_error) {}
        try {
          const topWindow = root.top;
          if (topWindow && topWindow !== root && !libraryWindows.includes(topWindow)) libraryWindows.push(topWindow);
        } catch (_error) {}
        const libraryRuntime = libraryWindows
          .map(candidate => {
            try {
              return candidate?.__LWCS_LIBRARY_DATA_RUNTIME_V1__ || null;
            } catch (_error) {
              return null;
            }
          })
          .find(runtime => runtime && typeof runtime.resolveWorldActionContext === 'function') || null;
        if (!dataRoot || !activeName || !characterKey || !targetLocation || !Number.isFinite(durationTicks) || !libraryRuntime) {
          throw new Error('battle_world_action_context_unavailable');
        }
        const rawWorldActionContext = libraryRuntime.resolveWorldActionContext({
          dataRoot,
          characterKey,
          actionType: 'BATTLE',
          targetLocation,
          durationTicks: Math.max(0, Math.round(durationTicks * 10) / 10),
          temporaryRuleIds,
        });
        const worldContextKeys = [
          'era', 'time', 'location', 'terrain', 'hazards', 'facilities',
          'nearbyFacilities', 'resources', 'market', 'permissions', 'modifiers',
          'blockers', 'warnings',
        ];
        const validWorldActionContext = rawWorldActionContext &&
          typeof rawWorldActionContext === 'object' &&
          !Array.isArray(rawWorldActionContext) &&
          worldContextKeys.every(key => Object.prototype.hasOwnProperty.call(rawWorldActionContext, key)) &&
          Array.isArray(rawWorldActionContext.hazards) &&
          rawWorldActionContext.modifiers && typeof rawWorldActionContext.modifiers === 'object' &&
          !Array.isArray(rawWorldActionContext.modifiers) &&
          Array.isArray(rawWorldActionContext.blockers) &&
          Array.isArray(rawWorldActionContext.warnings);
        if (!validWorldActionContext) throw new Error('battle_world_action_context_unavailable');
        const transactionResult = await executeTransaction(cloneBattleValue(sourceCombatData), {
          mode: battleMode,
          rounds: maxRounds,
          actionDeclaration: options.actionDeclaration || null,
          intentMode: String(options.intentMode || sourceCombatData.战斗意图 || '').trim(),
          executionMode: 'manual',
          dryRun,
          commit: !dryRun,
          worldActionContext: rawWorldActionContext,
        });
          const commitReceipt = transactionResult?.commitReceipt || null;
          if (!dryRun && !commitReceipt?.committed) throw new Error('battle_package_commit_missing');
          const reportDto = transactionResult.reportDto;
        const aiStructuredSummary = reportDto?.aiStructuredSummary || {};
        const aiStructuredSummaryText = JSON.stringify(aiStructuredSummary);
          const output = {
          ...transactionResult,
          preview: dryRun,
          committed: !dryRun,
          intentText: String(playerInput || '').trim(),
          mode: dryRun ? 'preview' : 'sealed_transaction',
          battleMode,
          roundsExecuted: Number(reportDto?.actualRoundCount || 0),
          reportDto,
          finalBattleReport: reportDto?.finalSummary || null,
          aiStructuredSummary: reportDto?.aiStructuredSummary || null,
          llmBattleSummary: String(reportDto?.finalSummary?.text || ''),
          commitReceipt,
        };
        if (!dryRun && reportDto?.aiStructuredSummary) {
          /* AI 只接收经过 PLAYER 投影和审计的结构化摘要；完整因果链不再绕过 Report DTO 注入。 */
          const 战果标题 = String(reportDto.battleHeadline || '战斗已结算');
          /* 永久战果只保存终局标题；结构化摘要作为本轮唯一 AI 输入。 */
          const settlementContext = registerBattleSettlementContext({
            id: `battle-${Date.now()}`,
            结构化摘要: 战果标题,
            裁断卷宗: 战果标题,
            来源: 'BattleReport',
          });
          output.battleSettlementContext = settlementContext;
          sendToAI(
            `<battle_result>${战果标题}</battle_result>`,
            `<battle_summary>\n${aiStructuredSummaryText}\n</battle_summary>`,
            {
              requestKind: 'battle_settlement_plot',
            },
          );
          output.aiRequest = root.__lastBattleAIRequest || null;
        }
        return output;
        } finally {
          if (!dryRun) formalBattleTransactionInFlight = false;
        }
      }

      root.BattleUIBridge = Object.assign(root.BattleUIBridge || {}, {
        __executePlayerBattleIntentImpl(playerInput, options = {}) {
          return onPlayerAttack(String(playerInput || ''), options);
        },
        __executeBattleFlowImpl(combatData, options = {}) {
          const state = root.BattleUI?.state || {};
          const actionList = typeof root.BattleUI?.读取可提交战斗动作队列 === 'function'
            ? root.BattleUI.读取可提交战斗动作队列(state)
            : [state.selectedSkillActions?.at(-1) || state.selectedAction].filter(Boolean);
          const actionDeclaration = options.actionDeclaration || root.BattleUI?.buildActionDeclaration?.(actionList);
          const intentText = String(options.intentText || root.BattleUI?.buildIntentText?.(actionList) || '').trim();
          return onPlayerAttack(intentText, { ...options, combatData, actionDeclaration });
        },
      });

      function isCombatUnitAlive(unit) {
        return BATTLE_PREVIEW.isAlive(unit);
      }

                                                                                        // ==========================================
        // 📍 UI 适配器层 (对外暴露接口)
        // ==========================================

                function ui_getAvailableActions(charData, combatData) {
          if (!charData || !combatData?.参战者) return [];
          const actorName = String(charData?.name || charData?.名称 || '').trim();
          const actor = BATTLE_PREVIEW.findUnit(combatData, actorName) || combatData.参战者.team_player?.[0] || null;
          if (!actor || !BATTLE_PREVIEW.isBattleCapable(actor)) return [];
          const actorId = BATTLE_PREVIEW.unitId(actor);
          const beliefState = BATTLE_DECISION.buildInitialBelief(combatData, actorId);
          const candidates = BATTLE_DECISION.enumerateCandidates({
            worldSnapshot: combatData,
            actorId,
            actionOpportunity: { role: 'ACTIVE', sequence: Math.max(1, Number(combatData?.回合 || 0) + 1) },
            battleIntent: { mode: String(combatData?.战斗意图 || '').trim(), objectives: combatData?.胜负条件 || {} },
            beliefState,
          });
          const actionKindMeta = {
            BASIC_ATTACK: { type: 'tactical', actionType: '常规攻击', name: '普通攻击', category: '战术' },
            DEFEND: { type: 'tactical', actionType: '防御', name: '防御', category: '战术' },
            EVADE: { type: 'tactical', actionType: '闪避', name: '闪避', category: '战术' },
            COUNTER: { type: 'tactical', actionType: '反击', name: '反击', category: '战术' },
            OBSERVE: { type: 'tactical', actionType: '观察', name: '观察', category: '战术' },
            GUARD: { type: 'tactical', actionType: '护卫', name: '护卫', category: '战术' },
            WITHDRAW: { type: 'tactical', actionType: '撤离', name: '亡命奔逃', category: '特殊动作' },
            RELEASE_SKILL: { type: 'skill', actionType: '释放魂技', name: '释放魂技', category: '魂技' },
            USE_ITEM: { type: 'item', actionType: '使用物品', name: '使用物品', category: '物品' },
            EQUIP: { type: 'equip', actionType: '穿戴装备', name: '穿戴装备', category: '装备' },
          };
          const grouped = new Map();
          const unitNameById = targetId => {
            const unit = BATTLE_PREVIEW.findUnit(combatData, targetId);
            return String(BATTLE_PREVIEW.unitName(unit) || targetId || '').trim();
          };
          candidates.forEach(candidate => {
            const declaration = cloneBattleValue(candidate?.declaration || {});
            const actionKind = String(declaration.actionKind || '').trim();
            const meta = actionKindMeta[actionKind];
            if (!meta) return;
            const skill = declaration.skill && typeof declaration.skill === 'object' ? declaration.skill : {};
            const baseDisplayName = String(skill?.魂技名 || skill?.name || skill?.技能名称 || meta.name).trim() || meta.name;
            const displayName = declaration.ringLabel ? `${baseDisplayName}·${declaration.ringLabel}` : baseDisplayName;
            const sourceContext = actionKind === 'RELEASE_SKILL' ? 读取战斗来源类别上下文(skill, meta.category) : { 来源类别: meta.category, 来源明细: meta.category };
            const identity = actionKind === 'RELEASE_SKILL'
              ? `${String(skill?.id || skill?.技能ID || skill?.魂技ID || baseDisplayName).trim()}:${String(declaration.ringId || '').trim()}`
              : actionKind === 'USE_ITEM'
                ? String(skill?.__物品名 || skill?.物品名 || displayName).trim()
                : actionKind === 'EQUIP'
                  ? String(declaration.equipmentSignature || skill?.id || displayName).trim()
                  : actionKind;
            const groupKey = `${actionKind}:${identity}:${BATTLE_PREVIEW.stableHash(skill?._效果数组 || [])}`;
            const targetNames = (Array.isArray(declaration.targetIds) ? declaration.targetIds : []).map(unitNameById).filter(Boolean);
            let action = grouped.get(groupKey);
            if (!action) {
              const costs = declaration.resourceCosts && typeof declaration.resourceCosts === 'object' ? declaration.resourceCosts : {};
              const costText = actionKind === 'RELEASE_SKILL'
                ? formatBattleUiSkillCost(skill, declaration)
                : actionKind === 'USE_ITEM'
                  ? '消耗 1'
                  : BATTLE_PREVIEW.formatSkillCostStages(
                      costs && Object.prototype.hasOwnProperty.call(costs, '启动')
                        ? costs
                        : { 启动: costs, 维持: {} },
                      declaration,
                    );
              const costInvalid = actionKind === 'RELEASE_SKILL' && /^不可用：/.test(costText);
              action = {
                id: `decision_${BATTLE_PREVIEW.stableHash({ actionKind, identity }).slice(0, 16)}`,
                type: meta.type,
                action_type: meta.actionType,
                actionKind,
                name: displayName,
                category: sourceContext.来源类别 || meta.category,
                source_detail: sourceContext.来源明细 || meta.category,
                semantic_role: String(skill?.技能分类 || '').trim(),
                tags: actionKind === 'RELEASE_SKILL' || actionKind === 'USE_ITEM'
                  ? [...new Set((Array.isArray(skill?._效果数组) ? skill._效果数组 : []).map(effect => String(effect?.原型 || '').trim()).filter(Boolean))]
                  : [],
                cast_time: Math.max(0, Number(skill?.前摇 ?? skill?.cast_time ?? 10)),
                cost_text: costText,
                enabled: !costInvalid,
                reason: costInvalid ? costText : '',
                raw_skill: skill,
                skill,
                declarations: [],
                target_names: [],
                actor_name: String(BATTLE_PREVIEW.unitName(actor) || actorName).trim(),
              };
              grouped.set(groupKey, action);
            }
            action.declarations.push(declaration);
            targetNames.forEach(name => {
              if (!action.target_names.includes(name)) action.target_names.push(name);
            });
          });
          return [...grouped.values()].map(action => {
            action.target_name = action.target_names[0] || '';
            action.declaration = action.declarations.find(declaration => {
              const names = (Array.isArray(declaration.targetIds) ? declaration.targetIds : []).map(unitNameById);
              return names.includes(action.target_name);
            }) || action.declarations[0] || null;
            return action;
          });
        }

        function toUiNumber(value, fallback = 0) {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : fallback;
        }

        function htmlEscapeText(value) {
          return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        }

        function 显示战斗提示(消息, 类型 = 'error') {
          const 文本 = String(消息 || '').trim();
          if (!文本) return;
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

        function flattenUiCombatant(unit) {
          const safeUnit = unit && typeof unit === 'object' ? unit : {};
          const stat = safeUnit.属性 && typeof safeUnit.属性 === 'object' ? safeUnit.属性 : {};
          const status = safeUnit.状态 && typeof safeUnit.状态 === 'object' ? safeUnit.状态 : {};
          const merged = { ...stat, ...safeUnit };
          COMBAT_STAT_KEYS.forEach(key => {
            if (stat[key] !== undefined) merged[key] = stat[key];
          });
          merged.name = safeUnit.name || stat.name || safeUnit.base?.name || '未知';
          merged.lv = toUiNumber(merged.lv ?? merged.等级, toUiNumber(stat.等级, 0));
          merged.type = safeUnit.type || safeUnit.系别 || merged.type || merged.系别 || '未知系';
          merged.hp_max = Math.max(
            1,
            toUiNumber(merged.hp_max ?? merged.HP上限, toUiNumber(stat.HP上限, 1)),
          );
          merged.hp = Math.max(
            0,
            toUiNumber(merged.hp ?? merged.HP, toUiNumber(stat.HP, merged.hp_max)),
          );
          merged.vit_max = Math.max(1, toUiNumber(merged.vit_max ?? merged.体力上限, toUiNumber(stat.体力上限, 1)));
          merged.vit = Math.max(0, toUiNumber(merged.vit ?? merged.体力, toUiNumber(stat.体力, merged.vit_max)));
          merged.sta_max = Math.max(1, toUiNumber(merged.sta_max ?? merged.体力上限, toUiNumber(stat.体力上限, 1)));
          merged.sta = Math.max(0, toUiNumber(merged.sta ?? merged.体力, toUiNumber(stat.体力, merged.sta_max)));
          merged.sp_max = Math.max(1, toUiNumber(merged.sp_max ?? merged.魂力上限, toUiNumber(stat.魂力上限, 1)));
          merged.sp = Math.max(0, toUiNumber(merged.sp ?? merged.魂力, toUiNumber(stat.魂力, merged.sp_max)));
          merged.men_max = Math.max(
            1,
            toUiNumber(merged.men_max ?? merged.精神力上限, toUiNumber(stat.精神力上限, 1)),
          );
          merged.men = Math.max(0, toUiNumber(merged.men ?? merged.精神力, toUiNumber(stat.精神力, merged.men_max)));
          merged.str = toUiNumber(merged.str ?? merged.力量, toUiNumber(stat.力量, 0));
          merged.def = toUiNumber(merged.def ?? merged.防御, toUiNumber(stat.防御, 0));
          merged.agi = toUiNumber(merged.agi ?? merged.敏捷, toUiNumber(stat.敏捷, 0));
          merged.状态效果 = merged.状态效果 || stat.状态效果 || {};
          merged.持续效果 = merged.持续效果 || {};
          merged.isSummon = !!safeUnit.召唤键;
          merged.召唤键 = safeUnit.召唤键 || '';
          merged.行动模式 = safeUnit.行动模式 || '';
          merged.宿主名 = safeUnit.宿主名 || '';
          merged.稳定状态 = safeUnit.稳定状态 || (safeUnit.__禁用召唤技能 ? '受限' : safeUnit.__精神压缩 < 1 ? '超载' : '稳定');
          merged.alive = status.存活 !== false && safeUnit.alive !== false && merged.hp > 0;
          return merged;
        }

        function 读取界面召唤单位列表(combatData = {}, 阵营 = '') {
          const wantedSide = 阵营 === '玩家' ? 'player' : 阵营 === '敌方' ? 'enemy' : '';
          return BATTLE_PREVIEW.listUnits(combatData)
            .map(entry => entry.unit)
            .filter(unit => unit?.召唤键 && unit?.已消散 !== true)
            .filter(unit => !wantedSide || BATTLE_PREVIEW.sideOf(combatData, unit) === wantedSide);
        }

        function 获取可见装备标签(unit = {}) {
          const 装备 = unit?.装备 && typeof unit.装备 === 'object' ? unit.装备 : {};
          const 标签 = [];
          const 机甲 = 装备.机甲 && typeof 装备.机甲 === 'object' ? 装备.机甲 : null;
          const 斗铠 = 装备.斗铠 && typeof 装备.斗铠 === 'object' ? 装备.斗铠 : null;
          const 防具 = 装备.防具 && typeof 装备.防具 === 'object' ? 装备.防具 : null;
          if (机甲 && String(机甲.装备状态 || '').trim() === '已装备' && String(机甲.等级 || '无').trim() !== '无' && String(机甲.状态 || '') !== '重创') {
            标签.push(`${String(机甲.等级 || '').trim()}机甲`);
          }
          if (斗铠 && String(斗铠.装备状态 || '').trim() === '已装备' && Number(斗铠.等级 || 0) > 0) {
            标签.push(`${Number(斗铠.等级 || 0)}字斗铠`);
          }
          if (防具 && String(防具.装备状态 || '').trim() === '已装备') {
            const 防具名 = String(防具.名称 || 防具.name || '防具').trim();
            if (防具名 && 防具名 !== '无') 标签.push(防具名);
          }
          return 标签;
        }

        function setUiText(id, value) {
          const node = byId(id);
          if (node) node.textContent = String(value ?? '');
        }

        function 设置界面文本显隐(id, value, 是否显示 = true) {
          const 节点 = byId(id);
          if (!节点) return;
          节点.hidden = !是否显示;
          节点.textContent = 是否显示 ? String(value ?? '') : '';
        }

        function setUiBar(id, value, max) {
          const node = byId(id);
          if (!node) return;
          const ratio = Math.max(0, Math.min(100, (toUiNumber(value, 0) / Math.max(1, toUiNumber(max, 1))) * 100));
          node.style.width = `${ratio}%`;
          node.classList.toggle('is-critical', ratio <= 30 && /hp/.test(node.className));
        }

        function 读取战斗资源比例(单位 = {}, 当前键 = '', 上限键 = '') {
          const 当前值 = Math.max(0, toUiNumber(单位?.[当前键], 0));
          const 上限值 = Math.max(1, toUiNumber(单位?.[上限键], 1));
          return Math.max(0, Math.min(1, 当前值 / 上限值));
        }

        function 推入战斗资源警报(警报列表, 单位, 配置) {
          const 单位名 = String(单位?.name || '').trim();
          if (!单位名) return;
          const 比例 = 读取战斗资源比例(单位, 配置.当前键, 配置.上限键);
          if (比例 > 配置.阈值) return;
          const 百分比 = Math.max(0, Math.min(100, Math.floor(比例 * 100)));
          警报列表.push({
            id: `${配置.名称}:${单位名}`,
            类型: 配置.类型,
            优先级: 配置.优先级,
            签名: `${配置.名称}:${单位名}`,
            百分比,
            文本: `${配置.前缀} ${单位名} ${配置.短名} ${百分比}%`,
          });
        }

        function 读取敌方高危状态列表(单位 = {}) {
          const 状态效果 = 单位?.状态效果 && typeof 单位.状态效果 === 'object' ? 单位.状态效果 : {};
          const 状态名列表 = Object.entries(状态效果)
            .filter(([名称, 状态]) => {
              const 文本 = `${名称} ${状态?.类型 || ''} ${状态?.状态名称 || ''} ${状态?.描述 || ''} ${状态?.战斗效果?.标签 || ''}`;
              return /狂暴|蓄力|爆发|高危|危险|处决|必杀/.test(文本);
            })
            .map(([名称]) => String(名称 || '').trim())
            .filter(Boolean);
          if (单位?.蓄力技能 || Number(单位?.蓄力剩余 ?? 单位?.cast_time_left ?? 0) > 0) 状态名列表.unshift('蓄力');
          return Array.from(new Set(状态名列表)).slice(0, 2);
        }

        function 计算战斗智能警报(combatData, 上次警报列表 = []) {
          const 上次警报表 = new Map((Array.isArray(上次警报列表) ? 上次警报列表 : []).map(警报 => [警报.id, 警报]));
          const 当前时间 = Date.now();
          const 警报列表 = [];
          const 我方单位列表 = [
            ...(combatData?.参战者?.team_player || []),
            ...读取界面召唤单位列表(combatData, '玩家'),
          ].map(flattenUiCombatant);
          我方单位列表.forEach(单位 => {
            推入战斗资源警报(警报列表, 单位, { 名称: '生命危险', 短名: '生命', 当前键: 'hp', 上限键: 'hp_max', 阈值: 0.3, 类型: 'danger', 优先级: 10, 前缀: '[战术警报]' });
            推入战斗资源警报(警报列表, 单位, { 名称: '魂力警戒', 短名: '魂力', 当前键: 'sp', 上限键: 'sp_max', 阈值: 0.3, 类型: 'warning', 优先级: 7, 前缀: '[资源警戒]' });
            推入战斗资源警报(警报列表, 单位, { 名称: '精神警戒', 短名: '精神', 当前键: 'men', 上限键: 'men_max', 阈值: 0.25, 类型: 'warning', 优先级: 6, 前缀: '[资源警戒]' });
            推入战斗资源警报(警报列表, 单位, { 名称: '体力警戒', 短名: '体力', 当前键: 'sta', 上限键: 'sta_max', 阈值: 0.2, 类型: 'warning', 优先级: 5, 前缀: '[资源警戒]' });
          });

          const 目标敌方名称 = String(window.BattleUI?.state?.selectedAction?.target_name || '').trim();
          const 当前敌方 = (combatData?.参战者?.team_enemy || []).map(flattenUiCombatant).find(单位 => !目标敌方名称 || 单位.name === 目标敌方名称);
          读取敌方高危状态列表(当前敌方 || {}).forEach(状态名 => {
            const 单位名 = String(当前敌方?.name || '敌方').trim();
            警报列表.push({
              id: `敌方高危:${单位名}:${状态名}`,
              类型: 'danger',
              优先级: 8,
              签名: `敌方高危:${单位名}:${状态名}`,
              文本: `[高危目标] ${单位名} ${状态名}`,
            });
          });

          return 警报列表
            .sort((左, 右) => 右.优先级 - 左.优先级)
            .map(警报 => {
              const 上次 = 上次警报表.get(警报.id);
              const 低值恶化 = Number.isFinite(Number(警报.百分比)) && Number(警报.百分比) < Number(上次?.百分比 ?? 警报.百分比);
              const 延续旧警报 = 上次 && 上次.签名 === 警报.签名 && !低值恶化;
              const 首次时间 = 延续旧警报 ? Number(上次.首次时间 || 当前时间) : 当前时间;
              return {
                ...警报,
                首次时间,
                已确认: 当前时间 - 首次时间 >= 3000,
              };
            });
        }

        function 渲染战斗智能警报(警报列表 = []) {
          const node = byId('ui-smart-alert-layer');
          if (!node) return;
          const 状态 = window.BattleUI?.state || {};
          if (状态.智能警报弱化计时器) {
            clearTimeout(状态.智能警报弱化计时器);
            状态.智能警报弱化计时器 = null;
          }
          if (!Array.isArray(警报列表) || !警报列表.length) {
            node.innerHTML = '';
            return;
          }
          const 当前时间 = Date.now();
          const 需要折叠 = 警报列表.length > 3;
          const 显示列表 = 警报列表.slice(0, 需要折叠 ? 2 : 3);
          const 剩余数量 = Math.max(0, 警报列表.length - 显示列表.length);
          const 卡片列表 = [
            ...显示列表.map(警报 => {
              const 类型类 = 警报.类型 === 'danger' ? 'battle-alert-card--danger' : 'battle-alert-card--warning';
              const 状态类 = 警报.已确认 ? ' is-acknowledged' : ' is-new';
              return `<div class="battle-alert-card ${类型类}${状态类}"><span class="battle-alert-text">${htmlEscapeText(警报.文本)}</span></div>`;
            }),
            剩余数量 > 0
              ? `<div class="battle-alert-card battle-alert-card--system ${警报列表.slice(显示列表.length).every(警报 => 警报.已确认) ? 'is-acknowledged' : 'is-new'}"><span class="battle-alert-text">另有 ${剩余数量} 项异常</span></div>`
              : '',
          ].filter(Boolean);
          node.innerHTML = 卡片列表.join('');
          const 下次弱化延迟 = Math.min(
            ...警报列表
              .filter(警报 => !警报.已确认)
              .map(警报 => Math.max(0, 3000 - (当前时间 - Number(警报.首次时间 || 当前时间)))),
          );
          if (Number.isFinite(下次弱化延迟)) {
            状态.智能警报弱化计时器 = setTimeout(() => {
              const 下次时间 = Date.now();
              const 当前警报列表 = Array.isArray(window.BattleUI?.state?.智能警报列表) ? window.BattleUI.state.智能警报列表 : [];
              当前警报列表.forEach(警报 => {
                if (下次时间 - Number(警报.首次时间 || 下次时间) >= 3000) 警报.已确认 = true;
              });
              window.BattleUI.state.警报确认表 = 当前警报列表.reduce((表, 警报) => {
                if (警报.已确认) 表[警报.id] = 警报.首次时间;
                return 表;
              }, {});
              渲染战斗智能警报(当前警报列表);
            }, 下次弱化延迟 + 32);
          }
        }

        function renderUiStats(containerId, unit, options = {}) {
          const node = byId(containerId);
          if (!node) return;
          const stats = [
            ['力', Math.round(Number(unit.str || 0))],
            ['防', Math.round(Number(unit.def || 0))],
            ['速', Math.round(Number(unit.agi || 0))],
          ];
          node.innerHTML = stats
            .map(([label, value]) => `<div class="stat-item"><div class="stat-label">${htmlEscapeText(label)}</div><div class="stat-value">${htmlEscapeText(value)}</div></div>`)
            .join('');
        }

        function renderUiBuffs(containerId, unit) {
          const node = byId(containerId);
          if (!node) return;
          const 状态效果 = Object.entries(unit.状态效果 || {}).slice(0, 8);
          const sustains = Object.keys(unit.持续效果 || {}).slice(0, 4);
          const 装备标签 = 获取可见装备标签(unit);
          const chips = [
            ...装备标签.map(name => `<span class="tag-chip equip">${htmlEscapeText(name)}</span>`),
            ...状态效果.map(([name, condition]) => {
              const typeText = String(condition?.类型 || condition?.type || '').toLowerCase();
              const kind = /debuff|负面|伤|弱/.test(typeText) ? 'debuff' : 'buff';
              return `<span class="tag-chip ${kind}">${htmlEscapeText(name)}</span>`;
            }),
            ...sustains.map(name => `<span class="tag-chip sustain">${htmlEscapeText(name)}</span>`),
          ];
          node.innerHTML = chips.join('');
        }

        function renderUiCombatant(prefix, unit) {
          const safeUnit = flattenUiCombatant(unit);
          const 徽标文本 = 读取战斗单位徽标文本(safeUnit);
          设置界面文本显隐(`ui-${prefix}-lv`, 徽标文本, !!徽标文本);
          setUiText(`ui-${prefix}-name`, safeUnit.name || (prefix === 'player' ? '玩家' : '对手'));
          setUiText(`ui-${prefix}-type`, safeUnit.type || '未知系');
          setUiText(`ui-${prefix}-hp-text`, `${Math.round(safeUnit.hp)} / ${Math.round(safeUnit.hp_max)}`);
          setUiText(`ui-${prefix}-sta-text`, `${Math.round(safeUnit.sta)} / ${Math.round(safeUnit.sta_max)}`);
          setUiText(`ui-${prefix}-sp-text`, `${Math.round(safeUnit.sp)} / ${Math.round(safeUnit.sp_max)}`);
          setUiText(`ui-${prefix}-men-text`, `${Math.round(safeUnit.men)} / ${Math.round(safeUnit.men_max)}`);
          setUiBar(`ui-${prefix}-hp-bar`, safeUnit.hp, safeUnit.hp_max);
          setUiBar(`ui-${prefix}-sta-bar`, safeUnit.sta, safeUnit.sta_max);
          setUiBar(`ui-${prefix}-sp-bar`, safeUnit.sp, safeUnit.sp_max);
          setUiBar(`ui-${prefix}-men-bar`, safeUnit.men, safeUnit.men_max);
          renderUiStats(`ui-${prefix}-stats`, safeUnit);
          renderUiBuffs(`ui-${prefix}-buffs`, safeUnit);
          return safeUnit;
        }

        function 选择战斗动作目标(目标名 = '', 动作来源 = null) {
          const 状态 = window.BattleUI?.state || {};
          const 动作 = 动作来源 || 状态.selectedAction || null;
          const 安全目标名 = String(目标名 || '').trim();
          if (!动作 || !安全目标名) return false;
          const 候选名称列表 = 读取动作目标候选(动作, 状态).map(读取战斗单位名).filter(Boolean);
          if (!候选名称列表.includes(安全目标名)) return false;
          动作.target_name = 安全目标名;
          if (Array.isArray(动作.declarations) && 动作.declarations.length) {
            动作.declaration = 动作.declarations.find(declaration =>
              (Array.isArray(declaration?.targetIds) ? declaration.targetIds : []).some(targetId => {
                const unit = BATTLE_PREVIEW.findUnit(状态.combatData || {}, targetId);
                return String(BATTLE_PREVIEW.unitName(unit) || targetId || '').trim() === 安全目标名;
              }),
            ) || 动作.declaration;
          }
          写入普通动作目标(动作, 状态);
          刷新战斗意图输出(动作);
          return true;
        }

        function 同步主战斗面板目标态(面板前缀, 单位名 = '', 目标名称集合 = new Set(), 当前目标名 = '') {
          const 面板 = byId(`ui-${面板前缀}-panel`);
          const 安全单位名 = String(单位名 || '').trim();
          if (!面板) return;
          const 可作为目标 = !!(安全单位名 && 目标名称集合.has(安全单位名));
          面板.classList.toggle('is-targetable', 可作为目标);
          面板.classList.toggle('is-current-target', 可作为目标 && 安全单位名 === 当前目标名);
          if (可作为目标) {
            面板.setAttribute('data-target-name', 安全单位名);
            面板.setAttribute('role', 'button');
            面板.setAttribute('aria-pressed', 安全单位名 === 当前目标名 ? 'true' : 'false');
            面板.setAttribute('tabindex', '0');
          } else {
            面板.removeAttribute('data-target-name');
            面板.removeAttribute('role');
            面板.removeAttribute('aria-pressed');
            面板.removeAttribute('tabindex');
          }
          if (!面板.__battleTargetPanelBound) {
            面板.addEventListener('click', () => {
              const 目标名 = String(面板.getAttribute('data-target-name') || '').trim();
              if (目标名) 选择战斗动作目标(目标名);
            });
            面板.addEventListener('keydown', event => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              const 目标名 = String(面板.getAttribute('data-target-name') || '').trim();
              if (!目标名) return;
              event.preventDefault();
              选择战斗动作目标(目标名);
            });
            面板.__battleTargetPanelBound = true;
          }
        }

        function 同步战斗队伍展开按钮(阵营, 单位数量, 已展开) {
          const 按钮 = byId(`ui-${阵营}-team-toggle`);
          if (!按钮) return;
          按钮.hidden = 单位数量 <= 0;
          按钮.disabled = 单位数量 <= 0;
          按钮.textContent = 已展开 ? '▴' : '▾';
          按钮.setAttribute('aria-expanded', 已展开 ? 'true' : 'false');
          按钮.setAttribute('title', 已展开 ? '收起队列' : '展开队列');
          if (按钮.__battleTeamToggleBound) return;
          按钮.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            const 状态 = window.BattleUI?.state || {};
            if (!状态.队伍展开状态 || typeof 状态.队伍展开状态 !== 'object') 状态.队伍展开状态 = {};
            状态.队伍展开状态[阵营] = 按钮.getAttribute('aria-expanded') !== 'true';
            同步战斗目标显示(状态.selectedAction || null);
          });
          按钮.__battleTeamToggleBound = true;
        }

        function renderUiTeam(容器ID, 单位来源列表, 激活名称 = '', 选项 = {}) {
          const node = byId(容器ID);
          if (!node) return;
          const 阵营 = String(选项.阵营 || '').trim();
          const 目标名称集合 = new Set((Array.isArray(选项.targetNames) ? 选项.targetNames : []).map(name => String(name || '').trim()).filter(Boolean));
          const 当前目标名 = String(选项.currentTargetName || '').trim();
          const 单位列表 = (Array.isArray(单位来源列表) ? 单位来源列表 : []).map(flattenUiCombatant);
          const 展开状态表 = window.BattleUI?.state?.队伍展开状态 || {};
          const 有手动展开状态 = 阵营 && typeof 展开状态表[阵营] === 'boolean';
          const 已展开 = 单位列表.length > 0 && (有手动展开状态 ? 展开状态表[阵营] : 单位列表.length > 1);
          node.hidden = !已展开;
          node.parentElement?.classList?.toggle('has-team-open', 已展开);
          if (阵营) 同步战斗队伍展开按钮(阵营, 单位列表.length, 已展开);
          node.innerHTML = 单位列表
            .map(单位 => {
              const 激活类 = 单位.name === 激活名称 ? ' active' : '';
              const 召唤类 = 单位.isSummon ? ' summon' : '';
              const 可选目标类 = 目标名称集合.has(单位.name) ? ' is-targetable' : '';
              const 当前目标类 = 单位.name === 当前目标名 ? ' is-current-target' : '';
              const 血量比例 = Math.max(0, Math.min(100, (单位.hp / Math.max(1, 单位.hp_max)) * 100));
              const 装备标签 = 获取可见装备标签(单位).join(' · ');
              const 信息片段 = 单位.isSummon
                ? [单位.行动模式 || '召唤', 单位.稳定状态 || '稳定']
                : [装备标签];
              const 信息HTML = 信息片段.filter(Boolean).length ? `<div class="side-meta">${htmlEscapeText(信息片段.filter(Boolean).join(' · '))}</div>` : '';
              const 目标属性 = 目标名称集合.has(单位.name)
                ? ` data-target-name="${htmlEscapeText(单位.name)}" aria-pressed="${单位.name === 当前目标名 ? 'true' : 'false'}"`
                : '';
              const 目标标记 = 单位.name === 当前目标名 ? '<span class="side-target-mark" aria-hidden="true">·</span>' : '';
              return `<button class="side-card${激活类}${召唤类}${可选目标类}${当前目标类}" type="button"${目标属性}><div class="side-head"><div class="side-name">${htmlEscapeText(单位.name)}</div>${目标标记}</div>${信息HTML}<div class="side-mini-bar"><div class="side-mini-fill" style="width:${血量比例}%"></div></div></button>`;
            })
            .join('');
          node.querySelectorAll('[data-target-name]').forEach(button => {
            if (button.__battleTargetBound) return;
            button.addEventListener('click', event => {
              event.stopPropagation();
              const 状态 = window.BattleUI?.state || {};
              const 动作 = 状态.selectedAction || null;
              if (!动作) return;
              const 目标名 = String(button.getAttribute('data-target-name') || '').trim();
              选择战斗动作目标(目标名, 动作);
            });
            button.addEventListener('keydown', event => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.stopPropagation();
            });
            button.__battleTargetBound = true;
          });
        }

        function 同步战斗目标显示(动作来源 = null) {
          const state = window.BattleUI?.state || {};
          const combatData = state.combatData || {};
          if (!combatData || !combatData.参战者) {
            renderUiTargetControls(动作来源 || state.selectedAction || null);
            return;
          }
          const 当前动作 = 动作来源 || state.selectedAction || null;
          const 目标候选列表 = 读取动作目标候选(当前动作 || {}, state);
          const 目标候选名称 = 目标候选列表.map(读取战斗单位名).filter(Boolean);
          const 目标名称集合 = new Set(目标候选名称);
          const 当前目标名 = String(当前动作 && 当前动作.target_name ? 当前动作.target_name : '').trim();
          同步主战斗面板目标态('player', state.player?.name || '', 目标名称集合, 当前目标名);
          同步主战斗面板目标态('enemy', state.enemy?.name || '', 目标名称集合, 当前目标名);
          const playerTeam = [
            ...(combatData.参战者.team_player || []),
            ...读取界面召唤单位列表(combatData, '玩家'),
          ];
          const enemyTeam = [
            ...(combatData.参战者.team_enemy || []),
            ...读取界面召唤单位列表(combatData, '敌方'),
          ];
          renderUiTeam('ui-team-player', playerTeam, state.player?.name || '', {
            阵营: 'player',
            currentTargetName: 当前目标名,
            targetNames: 目标候选名称,
          });
          renderUiTeam('ui-team-enemy', enemyTeam, state.enemy?.name || '', {
            阵营: 'enemy',
            currentTargetName: 当前目标名,
            targetNames: 目标候选名称,
          });
          renderUiTargetControls(当前动作);
        }

        function renderUiSummonQueue(combatData) {
          const node = byId('ui-summon-queue');
          if (!node) return;
          const 召唤列表 = 读取界面召唤单位列表(combatData)
            .filter(单位 => !/分身/.test(String(单位?.类型 || 单位?.召唤单位类型 || '')))
            .map(flattenUiCombatant);
          node.hidden = 召唤列表.length === 0;
          if (!召唤列表.length) {
            node.innerHTML = '';
            return;
          }
          node.innerHTML = 召唤列表
            .map(单位 => {
              const hpRatio = Math.max(0, Math.min(100, (单位.hp / Math.max(1, 单位.hp_max)) * 100));
              const 状态类 = String(单位.稳定状态 || '稳定') === '稳定' ? 'stable' : 'strained';
              const 基础属性 = `力${Math.round(Number(单位.str || 0))} 防${Math.round(Number(单位.def || 0))} 敏${Math.round(Number(单位.agi || 0))}`;
              const 基础动作 = (Array.isArray(单位.技能列表) ? 单位.技能列表 : [])
                .map(技能 => String(技能?.name || 技能?.魂技名 || '').trim())
                .filter(Boolean)
                .slice(0, 3)
                .join(' / ') || '普通攻击';
              return `
                <div class="summon-card ${状态类}">
                  <div class="summon-card-head">
                    <b>${htmlEscapeText(单位.name || '召唤物')}</b>
                  </div>
                  <div class="summon-card-meta">${htmlEscapeText(单位.宿主名 || '宿主')} · ${htmlEscapeText(单位.行动模式 || '召唤')} · ${htmlEscapeText(单位.稳定状态 || '稳定')}</div>
                  <div class="summon-card-meta">${htmlEscapeText(基础属性)} · ${htmlEscapeText(基础动作)}</div>
                  <div class="summon-hp"><span style="width:${hpRatio}%"></span></div>
                  <div class="summon-card-foot">${Math.round(单位.hp)} / ${Math.round(单位.hp_max)}</div>
                </div>
              `;
            })
            .join('');
        }

        function findUiSkillCost(skill = {}, context = {}) {
          if (skill?.__fusion_display_cost_text) return String(skill.__fusion_display_cost_text);
          if (skill && typeof skill === 'object' && skill.消耗 !== undefined) {
            return formatBattleUiSkillCost(skill, context);
          }
          const direct = skill.cost_text;
          if (direct && typeof direct === 'object') return BATTLE_PREVIEW.formatSkillCostStages(direct, context);
          return direct ? String(direct) : '启动：无';
        }

        function findUiSkillCastTime(skill = {}) {
          const direct = toUiNumber(skill.前摇 ?? skill['前摇'], NaN);
          if (Number.isFinite(direct)) return direct;
          return 10;
        }

                        root.BattleUIBridge = Object.assign(root.BattleUIBridge || {}, {
          getBattleSubmitMode() {
            return 读取战斗提交模式();
          },
          setBattleSubmitMode(mode) {
            const 下个模式 = 写入战斗提交模式(mode);
            同步战斗提交模式控件();
            try {
              root.dispatchEvent(new CustomEvent('battle-submit-mode-changed', { detail: { mode: 下个模式 } }));
            } catch (error) {}
            return 下个模式;
          },
          getBattleSnapshot(combatData) {
            return BATTLE_RUNTIME.getBattleSnapshot(combatData);
          },
          getAvailableActions(charData, combatData) {
            return ui_getAvailableActions(charData, combatData);
          },
        });

        function getUiCombatData() {
          const combatData = window.BattleUIBridge?.getMVU('world.战斗');
          const 参战者 = combatData?.参战者;
          if (
            combatData &&
            typeof combatData === 'object' &&
            Array.isArray(参战者?.team_player) &&
            Array.isArray(参战者?.team_enemy)
          ) return cloneBattleValue(combatData);
          return cloneBattleValue(_options.combatData || {});
        }

        function renderUiChips(combatData, player, enemy) {
          const node = byId('ui-combat-chips');
          if (!node) return;
          const chips = [
            ['回合', Number(combatData.回合 || 0)],
            ['战斗', combatData.战斗类型 || '战斗'],
            ['阶段', combatData.阶段 || 战斗阶段枚举_V1.宣告],
            ['指向', `${player.name || '玩家'} -> ${enemy.name || '对手'}`],
          ];
          node.innerHTML = chips
            .map(([标签, 内容]) => `<span class="intent-pill"><span>${htmlEscapeText(标签)}</span><b>${htmlEscapeText(内容)}</b></span>`)
            .join('');
        }

        function 构建战斗下拉控件(配置 = {}) {
          const 控件类 = String(配置.类名 || '').trim();
          const 标签 = String(配置.标签 || '').trim();
          const 当前值 = String(配置.当前值 || '').trim();
          const 占位 = String(配置.占位 || '未定').trim();
          const 属性名 = String(配置.属性名 || 'value').trim();
          const 选项列表 = Array.isArray(配置.选项列表) ? 配置.选项列表 : [];
          const 当前项 = 选项列表.find(项 => String(项?.值 ?? 项 ?? '').trim() === 当前值) || null;
          const 当前文本 = String((当前项?.文本 ?? 当前值) || 占位).trim();
          const 选项HTML = 选项列表.length
            ? 选项列表
                .map(项 => {
                  const 值 = String(项?.值 ?? 项 ?? '').trim();
                  const 文本 = String(项?.文本 ?? 值).trim();
                  const 激活 = 值 === 当前值 ? ' active' : '';
                  return `<button class="battle-holo-option${激活}" type="button" data-${属性名}="${htmlEscapeText(值)}" role="option" aria-selected="${激活 ? 'true' : 'false'}">${htmlEscapeText(文本)}</button>`;
                })
                .join('')
            : `<span class="battle-holo-empty">无可选项</span>`;
          return `
            <div class="battle-terminal-row${控件类 ? ` ${htmlEscapeText(控件类)}` : ''}">
              <span class="battle-terminal-label">${htmlEscapeText(标签)}</span>
              <div class="battle-holo-select" data-battle-select="${htmlEscapeText(属性名)}">
                <button class="battle-holo-trigger" type="button" data-dropdown-trigger aria-haspopup="listbox" aria-expanded="false">
                  <span data-dropdown-value>${htmlEscapeText(当前文本)}</span><i aria-hidden="true">▾</i>
                </button>
                <div class="battle-holo-menu" role="listbox">${选项HTML}</div>
              </div>
            </div>
          `;
        }

        function resolveIntentTargetNameFromAction(action = {}, combatData = {}) {
          const explicitName = String(action?.target_name || '').trim();
          if (explicitName) return explicitName;
          const declaration = action?.declaration && typeof action.declaration === 'object' ? action.declaration : null;
          const targetId = Array.isArray(declaration?.targetIds) ? declaration.targetIds[0] : '';
          if (targetId) {
            const unit = BATTLE_PREVIEW.findUnit(combatData, targetId);
            return String(BATTLE_PREVIEW.unitName(unit) || targetId).trim();
          }
          return String(Array.isArray(action?.target_names) ? action.target_names[0] || '' : '').trim();
        }

        function 渲染动作摘要(action = null) {
          const node = byId('ui-action-summary');
          if (!node) return;
          const state = window.BattleUI?.state || {};
          const 当前动作 = action || state.selectedAction || null;
          if (!当前动作) {
            node.innerHTML = '<div class="battle-terminal-current"><span>当前动作</span><b>待选择</b></div>';
            return;
          }
          const 动作名 = String(当前动作.name || 当前动作.action_type || '行动').trim();
          const 消耗文本 = String(当前动作.cost_text || '').trim() || '无耗';
          const 前摇文本 = Number(当前动作.cast_time || 0) ? `${Number(当前动作.cast_time || 0)}前摇` : '即时';
          node.innerHTML = `
            <div class="battle-terminal-current">
              <span>当前动作</span>
              <b>[ ${htmlEscapeText(动作名)} ]</b>
              <em>消耗: ${htmlEscapeText(消耗文本)} | ${htmlEscapeText(前摇文本)}</em>
            </div>
          `;
        }

        function renderUiActionFilters(actions, activeCategory) {
          const node = byId('ui-action-filters');
          if (!node) return;
          const categoryOrder = ['魂技', '自创魂技', '武魂融合技', '血脉技能', '召唤', '战术', '特殊动作', '纯操控'];
          const categories = ['全部', ...Array.from(new Set(actions.map(action => action.category || '战术')))]
            .sort((left, right) => {
              if (left === '全部') return -1;
              if (right === '全部') return 1;
              const leftIndex = categoryOrder.includes(left) ? categoryOrder.indexOf(left) : Number.MAX_SAFE_INTEGER;
              const rightIndex = categoryOrder.includes(right) ? categoryOrder.indexOf(right) : Number.MAX_SAFE_INTEGER;
              if (leftIndex !== rightIndex) return leftIndex - rightIndex;
              return String(left).localeCompare(String(right), 'zh-Hans-CN');
            });
          node.innerHTML = categories
            .map(category => `<button class="filter-btn${category === activeCategory ? ' active' : ''}" type="button" data-category="${htmlEscapeText(category)}">${htmlEscapeText(category)}</button>`)
            .join('');
          node.querySelectorAll('[data-category]').forEach(button => {
            button.addEventListener('click', () => {
              const state = window.BattleUI?.state || {};
              state.activeCategory = button.dataset.category || '全部';
              renderUiActionGrid(state.availableActions || [], state.activeCategory);
              renderUiActionFilters(state.availableActions || [], state.activeCategory);
            });
          });
        }

                                        function 读取动作技能描述文本(动作 = {}) {
          const 技能 = 动作?.raw_skill || 动作?.skill || {};
          const 读取文本 = (...候选列表) => 候选列表.map(值 => String(值 ?? '').trim()).find(Boolean) || '';
          const 描述行 = [];
          const 添加描述 = (标签, 文本) => {
            const 内容 = String(文本 || '').trim();
            if (!内容 || 描述行.some(行 => 行.内容 === 内容)) return;
            描述行.push({ 标签, 内容 });
          };
          添加描述('画面', 读取文本(技能.画面描述, 技能.visualDesc));
          添加描述('效果', 读取文本(技能.效果描述, 技能.effectDesc, 技能.描述, 技能.效果));
          const 效果列表 = Array.isArray(技能._效果数组)
            ? 技能._效果数组
            : Array.isArray(技能['使用效果'])
              ? 技能['使用效果']
              : [];
          if (!描述行.length && 效果列表.length) {
            const 效果摘要 = 效果列表
              .map(效果 => {
                if (!效果 || typeof 效果 !== 'object') return '';
                const 原型 = 读取文本(效果.原型, 效果.type);
                const 目标 = 读取文本(效果.目标, 效果.target);
                const 数值 = 读取文本(效果.数值, 效果.威力倍率, 效果.状态, 效果.结算);
                if (!原型 && Array.isArray(效果.使用效果)) {
                  return 效果.使用效果.map(子效果 => 读取文本(子效果 && 子效果.原型)).filter(Boolean).join(' / ');
                }
                return [原型, 目标, 数值].filter(Boolean).join(' · ');
              })
              .filter(Boolean)
              .slice(0, 4)
              .join('；');
            添加描述('效果', 效果摘要);
          }
          if (!描述行.length) 添加描述('动作', 动作.reason || 动作.action_type || 动作.category || '无额外效果说明');
          return 描述行;
        }

        function 构建战斗魂技展示数据(动作 = {}) {
          const 技能 = 动作?.raw_skill || 动作?.skill || {};
          const 名称 = String(动作.name || 技能.name || 技能.魂技名 || 动作.action_type || '行动').trim();
          const 分类文本 = String(动作.category || 技能.技能分类 || '战术').trim() || '战术';
          const 类型文案 = 动作.action_type === '释放魂技' ? '魂技' : 分类文本;
          const 来源明细 = String(动作.source_detail || '').trim();
          const 标签集合 = new Set();
          [类型文案, 来源明细 && 来源明细 !== 类型文案 && 来源明细 !== 分类文本 ? 来源明细 : '', ...(Array.isArray(动作.tags) ? 动作.tags : [])]
            .map(值 => String(值 || '').trim())
            .filter(Boolean)
            .forEach(值 => 标签集合.add(值));
          const 消耗原文 = String(动作.cost_text || findUiSkillCost(技能, 动作?.declaration || 动作) || '').trim();
          const 消耗文本 = 消耗原文 && 消耗原文 !== '无' ? 消耗原文 : '无耗';
          const 前摇数值 = Number(动作.cast_time ?? findUiSkillCastTime(技能) ?? 0) || 0;
          const 前摇文本 = 前摇数值 ? `${前摇数值}` : '即时';
          const 动作类型 = String(动作.action_type || '').trim();
          const 目标文本 = 动作类型 === '撤离'
              ? '撤离'
              : ['防御', '闪避', '穿戴装备', '收回召唤'].includes(动作类型)
                ? '自身'
                : String(技能?.目标 || (Array.isArray(动作?.target_names) && 动作.target_names.length > 1 ? '可选单体' : 动作.target_name || '未指定')).trim();
          const 描述行 = 读取动作技能描述文本(动作);
          const 短效果摘要 = String(描述行[0]?.内容 || 动作.reason || 动作.action_type || 类型文案 || '待解析').trim();
          return {
            名称,
            类型文案,
            标签列表: Array.from(标签集合).slice(0, 5),
            消耗文本,
            前摇文本,
            目标文本,
            短效果摘要,
            描述行,
          };
        }

        function 构建动作悬浮效果Html(动作 = {}) {
          const 展示 = 构建战斗魂技展示数据(动作);
          const 标签Html = 展示.标签列表.length
            ? `<div class="battle-ring-tooltip-tags">${展示.标签列表.map(标签 => `<span class="battle-ring-tooltip-chip">${htmlEscapeText(标签)}</span>`).join('')}</div>`
            : '';
          const 显示摘要 = 展示.短效果摘要 && !展示.描述行.some(行 => 行.内容 === 展示.短效果摘要);
          const 描述Html = 展示.描述行
            .map(行 => `<div class="battle-ring-tooltip-copy"><em>${htmlEscapeText(行.标签)}</em><span>${htmlEscapeText(行.内容)}</span></div>`)
            .join('');
          return `
            <div class="battle-ring-tooltip-title">
              <b>${htmlEscapeText(展示.名称)}</b>
              <span>${htmlEscapeText(展示.类型文案)}</span>
            </div>
            ${显示摘要 ? `<div class="battle-ring-tooltip-desc">${htmlEscapeText(展示.短效果摘要)}</div>` : ''}
            <div class="battle-ring-tooltip-meta">
              <span class="battle-ring-tooltip-meta-row"><em>消耗</em><strong>${htmlEscapeText(展示.消耗文本)}</strong></span>
              <span class="battle-ring-tooltip-meta-row"><em>前摇</em><strong>${htmlEscapeText(展示.前摇文本)}</strong></span>
              <span class="battle-ring-tooltip-meta-row"><em>目标</em><strong>${htmlEscapeText(展示.目标文本)}</strong></span>
            </div>
            ${描述Html}
            ${标签Html}
          `;
        }

        function 读取战斗单位名(unit = {}) {
          return String(unit?.name || unit?.名称 || unit?.charKey || unit?.char_key || unit?.key || '').trim();
        }

        function 读取目标控制节点() {
          let node = byId('ui-target-controls');
          if (node) return node;
          const grid = byId('ui-action-grid');
          if (!grid || !grid.parentElement) return null;
          node = document.createElement('div');
          node.id = 'ui-target-controls';
          node.className = 'battle-target-controls';
          node.hidden = true;
          grid.insertAdjacentElement('afterend', node);
          return node;
        }

        function 读取技能悬浮节点() {
          if (component.skillTooltipPortalNode?.isConnected) return component.skillTooltipPortalNode;
          const node = byId('ui-skill-tooltip') || globalDocument?.getElementById?.('ui-skill-tooltip');
          if (!node) return null;
          node.classList.add('battle-skill-tooltip-floating--portal');
          if (globalDocument?.body && node.parentElement !== globalDocument.body) globalDocument.body.appendChild(node);
          同步战斗记录终端主题(node);
          component.skillTooltipPortalNode = node;
          return node;
        }

        function 关闭技能悬浮() {
          const 节点 = 读取技能悬浮节点();
          if (!节点) return;
          节点.hidden = true;
          节点.classList.remove('show');
          节点.innerHTML = '';
          节点.style.left = '';
          节点.style.top = '';
          节点.style.width = '';
          节点.style.maxHeight = '';
          节点.style.overflow = '';
        }

        function 定位技能悬浮(触发节点) {
          const 悬浮节点 = 读取技能悬浮节点();
          if (!悬浮节点 || !触发节点 || typeof 触发节点.getBoundingClientRect !== 'function') return;
          const 触发矩形 = 触发节点.getBoundingClientRect();
          悬浮节点.hidden = false;
          悬浮节点.classList.add('show');
          const 视口宽度 = Math.max(320, Number(root.innerWidth || globalDocument?.documentElement?.clientWidth || 320));
          const 视口高度 = Math.max(240, Number(root.innerHeight || globalDocument?.documentElement?.clientHeight || 240));
          const 宽度 = Math.min(420, Math.max(220, 视口宽度 - 24));
          悬浮节点.style.width = `${宽度}px`;
          悬浮节点.style.maxHeight = '';
          悬浮节点.style.overflow = 'visible';
          const 可用高度 = Math.max(160, 视口高度 - 24);
          let 实际高度 = Math.max(悬浮节点.offsetHeight || 160, 120);
          if (实际高度 > 可用高度) {
            实际高度 = 可用高度;
            悬浮节点.style.maxHeight = `${Math.round(可用高度)}px`;
            悬浮节点.style.overflow = 'hidden auto';
          }
          let 左 = 触发矩形.left;
          let 上 = 触发矩形.bottom + 8;
          if (左 + 宽度 > 视口宽度 - 12) 左 = 视口宽度 - 宽度 - 12;
          if (左 < 12) 左 = 12;
          if (上 + 实际高度 > 视口高度 - 12) 上 = 触发矩形.top - 实际高度 - 8;
          if (上 < 12) 上 = 12;
          悬浮节点.style.left = `${Math.round(左)}px`;
          悬浮节点.style.top = `${Math.round(上)}px`;
        }

        function 显示技能悬浮(触发节点, action = {}) {
          const 悬浮节点 = 读取技能悬浮节点();
          if (!悬浮节点) return;
          悬浮节点.innerHTML = 构建动作悬浮效果Html(action);
          定位技能悬浮(触发节点);
        }

        function 读取动作目标候选(action = {}, state = {}) {
          const combatData = state.combatData || {};
          const playerTeam = (combatData?.参战者?.team_player || []).filter(unit => unit && isCombatUnitAlive(unit));
          const enemyTeam = (combatData?.参战者?.team_enemy || []).filter(unit => unit && isCombatUnitAlive(unit));
          const skill = action?.raw_skill || action?.skill || {};
          if (Array.isArray(action?.declarations) && action.declarations.length > 1) {
            const candidateNames = new Set((Array.isArray(action.target_names) ? action.target_names : []).map(name => String(name || '').trim()).filter(Boolean));
            return BATTLE_PREVIEW.listUnits(combatData)
              .map(entry => entry.unit)
              .filter(unit => candidateNames.has(String(BATTLE_PREVIEW.unitName(unit) || '').trim()));
          }
          if (['防御', '闪避', '撤离', '穿戴装备', '收回召唤'].includes(String(action?.action_type || ''))) return [];
          const targetText = String(skill?.目标 || '').trim();
          if (/自身/.test(targetText)) return playerTeam.slice(0, 1);
          if (/友方|己方/.test(targetText) && !/群体|全体|全场/.test(targetText)) return playerTeam;
          if (/敌方|单体/.test(targetText) && !/群体|全体|全场/.test(targetText)) return enemyTeam;
          return [];
        }

        function 写入普通动作目标(action = {}, state = {}) {
          if (!action || typeof action !== 'object') return;
          const candidates = 读取动作目标候选(action, state);
          if (!candidates.length) {
            const 动作类型 = String(action?.action_type || '').trim();
            if (动作类型 === '收回召唤' && String(action.target_name || '').trim()) return;
            delete action.target_name;
            return;
          }
          const current = String(action.target_name || '').trim();
          const matched = candidates.find(unit => 读取战斗单位名(unit) === current);
          action.target_name = 读取战斗单位名(matched || candidates[0]);
          if (Array.isArray(action.declarations) && action.declarations.length) {
            action.declaration = action.declarations.find(declaration =>
              (Array.isArray(declaration?.targetIds) ? declaration.targetIds : []).some(targetId => {
                const unit = BATTLE_PREVIEW.findUnit(state.combatData || {}, targetId);
                return String(BATTLE_PREVIEW.unitName(unit) || targetId || '').trim() === action.target_name;
              }),
            ) || action.declaration;
          }
        }

        function 刷新战斗意图输出(action = null) {
          const state = window.BattleUI?.state || {};
          const output = byId('ui-intent-output');
          if (output) output.value = buildIntentText(action ? [action] : undefined);
          渲染动作摘要(action || state.selectedAction || null);
          同步战斗目标显示(action || state.selectedAction || null);
        }

        function renderUiTargetControls(action = null) {
          const node = 读取目标控制节点();
          if (!node) return;
          const state = window.BattleUI?.state || {};
          if (!action) {
            node.hidden = true;
            node.innerHTML = '';
            return;
          }
          写入普通动作目标(action, state);
          const candidates = 读取动作目标候选(action, state);
          if (!candidates.length) {
            node.hidden = true;
            node.innerHTML = '';
            return;
          }
          const 当前目标 = String(action.target_name || '').trim();
          const 目标选项 = candidates.map(unit => 读取战斗单位名(unit)).filter(Boolean).map(name => ({ 值: name, 文本: name }));
          node.hidden = false;
          node.innerHTML = 构建战斗下拉控件({
            标签: '施放目标',
            当前值: 当前目标,
            属性名: 'target-name',
            选项列表: 目标选项,
          });
          node.querySelectorAll('[data-target-name]').forEach(button => {
            button.addEventListener('click', () => {
              选择战斗动作目标(button.getAttribute('data-target-name') || '', action);
            });
          });
        }

        function 关闭战斗下拉控件(例外节点 = null) {
          wrapperElement.querySelectorAll('.battle-holo-select.is-open').forEach(节点 => {
            if (例外节点 && 节点 === 例外节点) return;
            节点.classList.remove('is-open');
            节点.querySelector('[data-dropdown-trigger]')?.setAttribute('aria-expanded', 'false');
          });
        }

        function 同步战斗下拉文本(根节点, 当前值 = '', 属性名 = 'value') {
          if (!根节点) return;
          const 安全当前值 = String(当前值 || '').trim();
          const 选项列表 = Array.from(根节点.querySelectorAll(`[data-${属性名}]`));
          const 命中选项 = 选项列表.find(选项 => String(选项.getAttribute(`data-${属性名}`) || '').trim() === 安全当前值) || 选项列表[0] || null;
          选项列表.forEach(选项 => {
            const 命中 = 选项 === 命中选项;
            选项.classList.toggle('active', 命中);
            选项.setAttribute('aria-selected', 命中 ? 'true' : 'false');
          });
          const 文本节点 = 根节点.querySelector('[data-dropdown-value]');
          if (文本节点 && 命中选项) 文本节点.textContent = 命中选项.textContent || 安全当前值;
        }

        function 初始化战斗下拉控件() {
          if (wrapperElement.__battleDropdownBound) return;
          wrapperElement.addEventListener('click', event => {
            const 触发器 = event.target?.closest?.('[data-dropdown-trigger]');
            if (触发器 && wrapperElement.contains(触发器)) {
              const 下拉根 = 触发器.closest('.battle-holo-select');
              if (!下拉根) return;
              const 将展开 = !下拉根.classList.contains('is-open');
              关闭战斗下拉控件(下拉根);
              下拉根.classList.toggle('is-open', 将展开);
              触发器.setAttribute('aria-expanded', 将展开 ? 'true' : 'false');
              event.preventDefault();
              event.stopPropagation();
              return;
            }
            const 选项 = event.target?.closest?.('.battle-holo-option');
            if (选项 && wrapperElement.contains(选项)) {
              关闭战斗下拉控件();
              return;
            }
            if (!event.target?.closest?.('.battle-holo-select')) 关闭战斗下拉控件();
          });
          wrapperElement.addEventListener('keydown', event => {
            if (event.key === 'Escape') 关闭战斗下拉控件();
          });
          wrapperElement.__battleDropdownBound = true;
        }

        function renderUiActionGrid(actions, activeCategory = '全部') {
          const node = byId('ui-action-grid');
          if (!node) return;
          const state = window.BattleUI?.state || {};
          const selectedId = state.selectedAction?.id || '';
          const filtered = activeCategory && activeCategory !== '全部'
            ? actions.filter(action => (action.category || '战术') === activeCategory)
            : actions;
          node.innerHTML = filtered
            .map(action => {
              const selected = action.id === selectedId ? ' is-selected' : '';
              const disabled = action.enabled === false ? ' disabled' : '';
              const 展示 = 构建战斗魂技展示数据(action);
              const 卡片标签 = 展示.标签列表[0] || 展示.类型文案;
              return `
                <button class="action-btn${selected} battle-skill-card" type="button" data-action-id="${htmlEscapeText(action.id)}"${disabled}>
                  <span class="battle-skill-head">
                    <span class="battle-skill-name">${htmlEscapeText(展示.名称)}</span>
                    <span class="battle-skill-tag">${htmlEscapeText(卡片标签)}</span>
                  </span>
                  <span class="battle-skill-meta">
                    <span><em>消耗</em><b>${htmlEscapeText(展示.消耗文本)}</b></span>
                    <span><em>前摇</em><b>${htmlEscapeText(展示.前摇文本)}</b></span>
                    <span><em>目标</em><b>${htmlEscapeText(展示.目标文本)}</b></span>
                  </span>
                </button>
              `;
            })
            .join('');
          if (!node.__battleTooltipScrollBound) {
            node.addEventListener('scroll', 关闭技能悬浮, { passive: true });
            node.__battleTooltipScrollBound = true;
          }
          node.querySelectorAll('[data-action-id]').forEach(button => {
            button.addEventListener('click', () => {
              const state = window.BattleUI?.state || {};
              const action = (state.availableActions || []).find(item => item.id === button.dataset.actionId);
              if (!action || action.enabled === false) return;
              关闭技能悬浮();
              state.selectedAction = action;
              state.selectedSkillActions = [action];
              写入普通动作目标(action, state);
              清空战斗预演面板();
              刷新战斗意图输出(action);
              renderUiActionGrid(state.availableActions || [], state.activeCategory || '全部');
            });
            button.addEventListener('mouseenter', () => {
              const state = window.BattleUI?.state || {};
              const action = (state.availableActions || []).find(item => item.id === button.dataset.actionId);
              if (!action) return;
              显示技能悬浮(button, action);
            });
            button.addEventListener('focus', () => {
              const state = window.BattleUI?.state || {};
              const action = (state.availableActions || []).find(item => item.id === button.dataset.actionId);
              if (!action) return;
              显示技能悬浮(button, action);
            });
            button.addEventListener('mouseleave', () => {
              const 悬浮节点 = 读取技能悬浮节点();
              if (!悬浮节点) return;
              if (!悬浮节点.matches(':hover')) 关闭技能悬浮();
            });
            button.addEventListener('blur', 关闭技能悬浮);
          });
          同步战斗目标显示(state.selectedAction || null);
        }

        function 读取界面自动续推设置(state = window.BattleUI?.state || {}) {
          const 设置 = 规范化自动续推设置(state.autoContinueConfig || {}, 'multi_round');
          return state.currentMode === 'multi_round' ? 设置 : { ...设置, maxRounds: 1 };
        }

        function 写入界面自动续推设置(补丁 = {}) {
          const state = window.BattleUI?.state;
          if (!state) return;
          state.autoContinueConfig = 规范化自动续推设置({ ...(state.autoContinueConfig || {}), ...补丁 }, 'multi_round');
          渲染自动续推设置控件();
        }

        function 渲染自动续推设置控件() {
          const state = window.BattleUI?.state;
          if (!state) return;
          const panel = byId('ui-auto-continue-settings');
          const maxInput = byId('ui-auto-round-max');
          const thresholdInput = byId('ui-auto-stop-threshold');
          const chanceInput = byId('ui-auto-continue-chance');
          if (!panel && !maxInput && !thresholdInput && !chanceInput) return;
          const 设置 = 规范化自动续推设置(state.autoContinueConfig || {}, 'multi_round');
          state.autoContinueConfig = 设置;
          const 同步输入 = (input, key, patchKey) => {
            if (!input) return;
            if (!input.__battleAutoContinueBound) {
              const 提交 = () => {
                const 原文 = String(input.value || '').trim();
                if (!原文) {
                  渲染自动续推设置控件();
                  return;
                }
                写入界面自动续推设置({ [patchKey]: 原文 });
              };
              input.addEventListener('input', 提交);
              input.addEventListener('change', 提交);
              input.__battleAutoContinueBound = true;
            }
            const 显示值 = String(Math.round(设置[key]));
            if (root.document?.activeElement !== input && input.value !== 显示值) input.value = 显示值;
          };
          同步输入(maxInput, 'maxRounds', 'maxRounds');
          同步输入(thresholdInput, 'stopDamagePercent', 'stopDamagePercent');
          同步输入(chanceInput, 'continueChancePercent', 'continueChancePercent');
          if (panel) {
            const 连续模式 = state.currentMode === 'multi_round';
            panel.hidden = !连续模式;
            panel.classList.toggle('is-single-round', !连续模式);
          }
        }

        function setUiBattleMode(mode) {
          const normalized = mode === 'multi_round' ? 'multi_round' : 'single_round';
          if (window.BattleUI && window.BattleUI.state) {
            window.BattleUI.state.currentMode = normalized;
          }
          document.querySelectorAll('#ui-mode-group [data-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === normalized);
            btn.setAttribute('aria-selected', btn.dataset.mode === normalized ? 'true' : 'false');
          });
          同步战斗下拉文本(byId('ui-mode-group'), normalized, 'mode');
          渲染动作摘要(window.BattleUI?.state?.selectedAction || null);
          渲染自动续推设置控件();
        }

        function setUiIntentMode(mode) {
          const normalized = String(mode || '点到为止').trim() || '点到为止';
          if (window.BattleUI && window.BattleUI.state) window.BattleUI.state.currentIntentMode = normalized;
          const input = byId('ui-intent-mode');
          if (input && input.value !== normalized) input.value = normalized;
          同步战斗下拉文本(byId('ui-intent-mode-select'), normalized, 'intent-mode');
          渲染动作摘要(window.BattleUI?.state?.selectedAction || null);
        }

        async function initBattleUiFromMvu() {
          syncFromBattleEngine();
        }

        function syncFromBattleEngine() {
          const combatData = getUiCombatData();
          if (!combatData || !combatData.参战者) return;
          BATTLE_RUNTIME.prepareCombatData(combatData, name => getMvuValue(`char.${name}`, null));
          const player = renderUiCombatant('player', combatData.参战者.team_player?.[0]);
          const enemy = renderUiCombatant('enemy', combatData.参战者.team_enemy?.[0]);
          renderUiChips(combatData, player, enemy);

          const rawCharData =
            window.BattleUIBridge?.getMVU(`char.${player.name}`) ||
            combatData.参战者.team_player?.[0];
          const charData = rawCharData && typeof rawCharData === 'object' && !Array.isArray(rawCharData)
            ? { ...rawCharData, name: String(rawCharData.name || rawCharData.名称 || player.name || '').trim() || player.name }
            : rawCharData;
          const availableActions = ui_getAvailableActions(charData, combatData);
          const previousState = window.BattleUI?.state || {};
          const activeCategory = previousState.activeCategory || '全部';
          const currentIntentMode = previousState.currentIntentMode || combatData.战斗意图 || '点到为止';
          const autoContinueConfig = 规范化自动续推设置(previousState.autoContinueConfig || {}, 'multi_round');
          const pendingTowerSettlement = normalizeSoulTowerPendingSettlement(combatData.魂灵塔待结算);
          const selectedAction =
            (previousState.selectedAction &&
              availableActions.find(action => action.id === previousState.selectedAction.id && action.enabled !== false)) ||
            availableActions.find(action => action.enabled !== false) ||
            availableActions[0] ||
            null;
          window.BattleUI = Object.assign(window.BattleUI || {}, {
            state: {
              ...previousState,
              combatData,
              player,
              enemy,
              玩家角色数据: charData,
              availableActions,
              activeCategory,
              selectedAction,
              selectedSkillActions: selectedAction ? [selectedAction] : [],
              selectedPreActions: [],
              currentMode: previousState.currentMode || 'single_round',
              currentIntentMode,
              autoContinueConfig,
              pendingTowerSettlement,
              activeBattleRecordTab: previousState.activeBattleRecordTab === 'preview' ? 'preview' : 'actual',
              activeBattleRecordView: ['report', 'round', 'decision', 'summary'].includes(previousState.activeBattleRecordView) ? previousState.activeBattleRecordView : 'report',
              activeBattleDecisionRound: Math.max(0, Number(previousState.activeBattleDecisionRound || 0)),
              activeBattleDecisionActor: String(previousState.activeBattleDecisionActor || '').trim(),
              activeBattleDecisionActionId: String(previousState.activeBattleDecisionActionId || '').trim(),
              battleRecordCollapsed: previousState.battleRecordCollapsed !== false,
            },
          });
          setUiBattleMode(window.BattleUI.state.currentMode);
          setUiIntentMode(window.BattleUI.state.currentIntentMode);
          渲染自动续推设置控件();
          renderUiActionFilters(availableActions, activeCategory);
          renderUiActionGrid(availableActions, activeCategory);
          renderUiSummonQueue(combatData);
          渲染战斗记录面板();
          const output = byId('ui-intent-output');
          if (selectedAction) {
            写入普通动作目标(selectedAction, window.BattleUI.state);
            if (output) output.value = buildIntentText([selectedAction]);
            同步战斗目标显示(selectedAction);
          }
          渲染动作摘要(selectedAction);
          renderSoulTowerSettlementPanel(pendingTowerSettlement);
          const 智能警报列表 = 计算战斗智能警报(combatData, previousState.智能警报列表 || []);
          window.BattleUI.state.智能警报列表 = 智能警报列表;
          window.BattleUI.state.警报确认表 = 智能警报列表.reduce((表, 警报) => {
            if (警报.已确认) 表[警报.id] = 警报.首次时间;
            return 表;
          }, {});
          渲染战斗智能警报(智能警报列表);
        }

        component.syncFromBattleEngine = syncFromBattleEngine;

        function buildActionDeclarationSkill(skill = {}) {
          const 来源 = skill && typeof skill === 'object' ? skill : {};
          const declaredSkill = {};
          [
            '魂技名',
            '画面描述',
            '效果描述',
            '技能分类',
            '目标',
            '承载方式',
            '消耗',
            '前摇',
            '附带属性',
            '使用条件',
            '战斗摘要',
            '战斗语义',
            '技能掌控度',
            '_效果数组',
            '副作用列表',
            '产物描述',
          ].forEach(key => {
            if (来源[key] !== undefined) declaredSkill[key] = cloneBattleValue(来源[key]);
          });
          if (!declaredSkill.魂技名 && 来源.name) declaredSkill.魂技名 = 来源.name;
          if (String(来源.__物品名 || '').trim()) declaredSkill.__物品名 = String(来源.__物品名 || '').trim();
          if (Array.isArray(来源.__魂环路径) && 来源.__魂环路径.length) declaredSkill.__魂环路径 = 来源.__魂环路径.map(片段 => String(片段));
          if (String(来源.__魂技槽位 || '').trim()) declaredSkill.__魂技槽位 = String(来源.__魂技槽位 || '').trim();
          return declaredSkill;
        }

        function buildActionDeclarationEntry(action) {
          if (!action) return null;
          if (action.declaration && typeof action.declaration === 'object') {
            return cloneBattleValue(action.declaration);
          }
          const skill = action.raw_skill || action.skill || {};
          const type = action.action_type || action.type || skill?.技能分类 || '输出';
          const resolvedTargetName = resolveIntentTargetNameFromAction(action, window.BattleUI?.state?.combatData || {});
          const combatData = window.BattleUI?.state?.combatData || {};
          const target = resolvedTargetName ? BATTLE_PREVIEW.findUnit(combatData, resolvedTargetName) : null;
          const actorName = String(action.actor_name || action.__行动者名 || window.BattleUI?.state?.player?.name || '').trim();
          const actor = actorName ? BATTLE_PREVIEW.findUnit(combatData, actorName) : combatData?.参战者?.team_player?.[0];
          const actionKind = String(action.actionKind || '').trim() ||
            (/防御|格挡|守势/.test(type) ? 'DEFEND'
              : /闪避|躲避/.test(type) ? 'EVADE'
                : /反击|防反|闪反/.test(type) ? 'COUNTER'
                  : /撤退|撤离/.test(type) ? 'WITHDRAW'
                    : /观察|试探/.test(type) ? 'OBSERVE'
                      : /保护|护卫/.test(type) ? 'GUARD'
                        : /物品|道具/.test(type) ? 'USE_ITEM'
                          : /装备|穿戴/.test(type) ? 'EQUIP'
                            : /普通攻击|常规攻击/.test(type) ? 'BASIC_ATTACK'
                              : 'RELEASE_SKILL');
          const declaration = {
            actionId: String(action.id || `${BATTLE_PREVIEW.unitId(actor)}:${actionKind}`).trim(),
            actorId: BATTLE_PREVIEW.unitId(actor) || actorName,
            actionKind,
            targetIds: target ? [BATTLE_PREVIEW.unitId(target)] : [],
            skill: buildActionDeclarationSkill(skill),
          };
          if (actionKind === 'EQUIP' && action.__equipmentSignature) declaration.equipmentSignature = String(action.__equipmentSignature);
          return declaration;
        }

        function buildIntentText(actions) {
          const state = window.BattleUI?.state || {};
          const fallbackActions = [
            ...(state.selectedPreActions || []),
            state.selectedSkillActions?.[state.selectedSkillActions.length - 1] || state.selectedAction,
          ].filter(Boolean);
          const sourceActions = Array.isArray(actions) && actions.length ? actions : fallbackActions;
          const parts = [];
          if (sourceActions.length) parts.push(sourceActions.map(action => action?.name || action?.raw_skill?.魂技名 || action?.raw_skill?.name || action?.action_type).filter(Boolean).join('，'));
          const target =
            sourceActions.find(action => String(action?.target_name || '').trim())?.target_name ||
            resolveIntentTargetNameFromAction(sourceActions.at(-1), state.combatData);
          if (target) parts.push(`[目标]${target}[/目标]`);
          return parts.join('\n');
        }

        function buildActionDeclaration(actions) {
          const state = window.BattleUI?.state || {};
          const fallbackActions = [
            ...(state.selectedPreActions || []),
            state.selectedSkillActions?.[state.selectedSkillActions.length - 1] || state.selectedAction,
          ].filter(Boolean);
          const sourceActions = Array.isArray(actions) && actions.length ? actions : fallbackActions;
          return buildActionDeclarationEntry(sourceActions.at(-1) || null);
        }

        function 读取可提交战斗动作队列(state = {}) {
          const mainAction = state.selectedSkillActions?.[state.selectedSkillActions.length - 1] || state.selectedAction;
          if (mainAction && mainAction.enabled === false) return [];
          return [
            ...(Array.isArray(state.selectedPreActions) ? state.selectedPreActions : []).filter(action => action && action.enabled !== false),
            mainAction,
          ].filter(Boolean);
        }

        function 读取战斗记录面板节点() {
          return 读取战斗记录终端节点()?.querySelector('#ui-battle-preview-panel') || null;
        }

        function 设置战斗记录展开状态(展开) {
          const state = window.BattleUI?.state || {};
          state.battleRecordCollapsed = 展开 === true ? false : true;
          const terminal = 读取战斗记录终端节点();
          if (!terminal) return;
          const collapsed = state.battleRecordCollapsed !== false;
          terminal.classList.toggle('battle-record-terminal--collapsed', collapsed);
          terminal.querySelector('.battle-record-body')?.toggleAttribute('hidden', collapsed);
          const toggle = terminal.querySelector('#ui-battle-record-toggle');
          if (toggle) {
            toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            toggle.textContent = collapsed ? '记录' : '隐藏';
          }
          if (component.syncRecordPortalPosition) component.syncRecordPortalPosition();
        }

        function 同步战斗记录展开状态() {
          const state = window.BattleUI?.state || {};
          设置战斗记录展开状态(state.battleRecordCollapsed === false);
        }

        function 读取战斗记录页签() {
          const state = window.BattleUI?.state || {};
          return state.activeBattleRecordTab === 'preview' ? 'preview' : 'actual';
        }

        function 设置战斗记录页签(tab = 'actual') {
          const activeTab = tab === 'preview' ? 'preview' : 'actual';
          if (window.BattleUI?.state) window.BattleUI.state.activeBattleRecordTab = activeTab;
          读取战斗记录终端节点()?.querySelectorAll('[data-battle-record-tab]').forEach(button => {
            const active = button.getAttribute('data-battle-record-tab') === activeTab;
            button.classList.toggle('active', active);
            button.setAttribute('aria-selected', active ? 'true' : 'false');
            button.setAttribute('tabindex', active ? '0' : '-1');
          });
          设置战斗记录展开状态(true);
          渲染战斗记录面板();
        }

        function 读取战斗记录视图() {
          const view = String(window.BattleUI?.state?.activeBattleRecordView || '').trim();
          return ['report', 'round', 'decision', 'summary'].includes(view) ? view : 'report';
        }

        function 设置战斗记录视图(view = 'report') {
          const activeView = ['report', 'round', 'decision', 'summary'].includes(view) ? view : 'report';
          if (window.BattleUI?.state) window.BattleUI.state.activeBattleRecordView = activeView;
          渲染战斗记录面板();
          读取战斗记录面板节点()?.querySelector(`[data-battle-record-view="${activeView}"]`)?.focus();
        }

        function 绑定分段控件键盘导航(容器, 属性名, 激活值, 设置值) {
          if (!容器) return;
          const buttons = Array.from(容器.querySelectorAll(`[${属性名}]`));
          buttons.forEach((button, index) => {
            const active = button.getAttribute(属性名) === 激活值;
            button.classList.toggle('active', active);
            button.setAttribute('aria-selected', active ? 'true' : 'false');
            button.setAttribute('tabindex', active ? '0' : '-1');
            button.addEventListener('click', () => 设置值(button.getAttribute(属性名) || ''));
            button.addEventListener('keydown', event => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
              const next = buttons[nextIndex];
              if (!next) return;
              设置值(next.getAttribute(属性名) || '');
            });
          });
        }

        function 清空战斗预演面板() {
          if (window.BattleUI?.state) window.BattleUI.state.previewResult = null;
          渲染战斗记录面板();
        }

        function 渲染战斗总结HTML(report = null) {
          if (!report || typeof report !== 'object') return '';
          const renderUnits = (label, units = []) => `<section class="battle-final-summary-side"><h4>${htmlEscapeText(label)}</h4>${(Array.isArray(units) ? units : []).length
            ? units.map(unit => {
                const formatSummaryNumber = (value, minimum = 0) => {
                  const numeric = Number(value);
                  return 格式化ReportDto数字值(
                    Number.isFinite(numeric) ? Math.max(minimum, numeric) : minimum,
                  );
                };
                const states = (Array.isArray(unit?.states) ? unit.states : []).map(state => `${state?.name || '状态'}(${Math.max(0, Number(state?.duration || 0))})`).filter(Boolean);
                const resources = unit?.resources || {};
                const resourceText = String(unit?.resourceVisibility || 'PUBLIC').toUpperCase() === 'HIDDEN'
                  ? '<span>资源未公开</span>'
                  : `<span>魂力 ${formatSummaryNumber(unit?.sp ?? resources.soul ?? 0)}/${formatSummaryNumber(unit?.spMax ?? resources.soulMax ?? 1, 1)}</span><span>体力 ${formatSummaryNumber(unit?.vit ?? resources.stamina ?? 0)}/${formatSummaryNumber(unit?.vitMax ?? resources.staminaMax ?? 1, 1)}</span><span>精神力 ${formatSummaryNumber(unit?.men ?? resources.spirit ?? 0)}/${formatSummaryNumber(unit?.menMax ?? resources.spiritMax ?? 1, 1)}</span>`;
                return `<div class="battle-final-summary-unit"><b>${htmlEscapeText(unit?.name || '单位')}</b><span>HP ${formatSummaryNumber(unit?.hp || 0)}/${formatSummaryNumber(unit?.hpMax || 1, 1)}</span>${resourceText}${states.length ? `<em>${htmlEscapeText(states.join('、'))}</em>` : ''}</div>`;
              }).join('')
            : '<p class="battle-final-summary-empty">无可行动单位</p>'}</section>`;
          const renderList = (title, items = []) => `<section class="battle-final-summary-list"><h4>${htmlEscapeText(title)}</h4>${(Array.isArray(items) ? items : []).length
            ? `<ul>${items.map(item => `<li>${htmlEscapeText(item)}</li>`).join('')}</ul>`
            : '<p>暂无</p>'}</section>`;
          const playerUnits = report?.sides?.player?.units || [];
          const enemyUnits = report?.sides?.enemy?.units || [];
          const summons = Array.isArray(report?.summons) ? report.summons : [];
          const summonText = summons.map(unit => `${unit?.name || '召唤物'}：${unit?.mode || '行动'}，剩余${Math.max(0, Number(unit?.remainingWindows || 0))}个窗口`).filter(Boolean);
          return `
            <section class="battle-final-summary" data-advantage="${htmlEscapeText(String(report?.advantage || 'EVEN'))}">
              <header class="battle-final-summary-head"><span>第${Math.max(0, Number(report?.round || 0))}回合终态</span><b>${htmlEscapeText(report?.headline || report?.outcomeSummary || '战况未明')}</b></header>
              <div class="battle-final-summary-sides">${renderUnits('我方', playerUnits)}${renderUnits('敌方', enemyUnits)}</div>
              <section class="battle-final-summary-intent"><h4>下一步意图</h4><p><b>我方</b>${htmlEscapeText(report?.nextIntents?.player || '暂无明确意图')}</p><p><b>敌方</b>${htmlEscapeText(report?.nextIntents?.enemy || '暂无明确意图')}</p></section>
              <div class="battle-final-summary-grid">${renderList('可利用窗口', report?.tacticalWindows || [])}${renderList('最大风险', report?.risks || [])}</div>
              ${summonText.length ? renderList('召唤物', summonText) : ''}
            </section>
          `;
        }

        function ReportDto数字来源类型(value = '') {
          const labels = {
            DECISION_TIME_PUBLIC_PROJECTION: '决策时公开信息推演',
            PROBABILITY: '概率事实',
            RANDOM: '随机判定',
            RESOURCE: '资源事实',
            REACTION: '回应事实',
            SETTLEMENT: '结算事实',
            WINDOW: '行动窗口事实',
            STATE: '状态事实',
          };
          return labels[String(value || '').trim().toUpperCase()] || '战斗事实';
        }

        function ReportDto数字计算操作(value = '') {
          const labels = {
            ADD: '相加',
            SUBTRACT: '相减',
            SET: '记录实际值',
          };
          return labels[String(value || '').trim().toUpperCase()] || '记录';
        }

        function 格式化ReportDto数字值(value, unit = '') {
          const numeric = Number(value);
          if (!Number.isFinite(numeric)) return '';
          return `${numeric.toFixed(Math.abs(numeric) < 10 ? 2 : 0)}${unit || ''}`;
        }

        function 格式化ReportDto操作数(operands = []) {
          return (Array.isArray(operands) ? operands : [])
            .filter(operand => Number.isFinite(Number(operand?.value)))
            .map(operand => `${String(operand?.name || '数值').trim()} ${格式化ReportDto数字值(operand.value, operand?.unit || '')}`)
            .join('；');
        }

        function 渲染ReportDto数字(token = {}) {
          if (!Number.isFinite(Number(token?.value))) return '';
          const operands = 格式化ReportDto操作数(token?.operands);
          const attrs = [
            'data-report-number-source="true"',
            token?.sourceName ? `data-source-name="${htmlEscapeText(token.sourceName)}"` : '',
            token?.sourceType ? `data-source-type="${htmlEscapeText(token.sourceType)}"` : '',
            token?.operation ? `data-source-operation="${htmlEscapeText(token.operation)}"` : '',
            operands ? `data-source-operands="${htmlEscapeText(operands)}"` : '',
            token?.derivationRule ? `data-source-derivation-rule="${htmlEscapeText(token.derivationRule)}"` : '',
            token?.tacticalConsequence ? `data-source-tactical-consequence="${htmlEscapeText(token.tacticalConsequence)}"` : '',
          ].filter(Boolean).join(' ');
          return `<button class="battle-preview-report-badge battle-preview-report-badge--resource" type="button"${attrs ? ` ${attrs}` : ''} aria-haspopup="true">${htmlEscapeText(`${token.label} ${格式化ReportDto数字值(token.value, token.unit || '')}`)}</button>`;
        }

        function 显示ReportDto数字来源(button) {
          const tooltip = 读取技能悬浮节点();
          if (!tooltip || !button) return;
          const sourceName = String(button.getAttribute('data-source-name') || '战斗事实').trim();
          const sourceType = ReportDto数字来源类型(button.getAttribute('data-source-type'));
          const operation = ReportDto数字计算操作(button.getAttribute('data-source-operation'));
          const operands = String(button.getAttribute('data-source-operands') || '').trim();
          const derivationRule = String(button.getAttribute('data-source-derivation-rule') || '').trim();
          const tacticalConsequence = String(button.getAttribute('data-source-tactical-consequence') || '').trim();
          tooltip.setAttribute('role', 'tooltip');
          tooltip.innerHTML = `
            <div class="battle-ring-tooltip-title"><strong>数字来源</strong><span>${htmlEscapeText(sourceName)}</span></div>
            <div class="battle-ring-tooltip-meta">
                <span class="battle-ring-tooltip-meta-row"><em>来源类型</em><strong>${htmlEscapeText(sourceType)}</strong></span>
                <span class="battle-ring-tooltip-meta-row"><em>计算操作</em><strong>${htmlEscapeText(operation)}</strong></span>
              ${operands ? `<span class="battle-ring-tooltip-meta-row battle-ring-tooltip-meta-row--detail"><em>比较数值</em><strong>${htmlEscapeText(operands)}</strong></span>` : ''}
              ${derivationRule ? `<span class="battle-ring-tooltip-meta-row battle-ring-tooltip-meta-row--detail"><em>怎么算</em><strong>${htmlEscapeText(derivationRule)}</strong></span>` : ''}
              ${tacticalConsequence ? `<span class="battle-ring-tooltip-meta-row battle-ring-tooltip-meta-row--detail"><em>这意味着</em><strong>${htmlEscapeText(tacticalConsequence)}</strong></span>` : ''}
            </div>
          `;
          button.setAttribute('aria-describedby', tooltip.id || 'ui-skill-tooltip');
          定位技能悬浮(button);
        }

        function 绑定ReportDto数字来源(node) {
          node?.querySelectorAll?.('[data-report-number-source="true"]').forEach(button => {
            button.addEventListener('mouseenter', () => 显示ReportDto数字来源(button));
            button.addEventListener('focus', () => 显示ReportDto数字来源(button));
            button.addEventListener('click', () => 显示ReportDto数字来源(button));
            button.addEventListener('mouseleave', () => {
              const tooltip = 读取技能悬浮节点();
              if (!tooltip?.matches(':hover')) 关闭技能悬浮();
            });
            button.addEventListener('blur', 关闭技能悬浮);
            button.addEventListener('keydown', event => {
              if (event.key !== 'Escape') return;
              关闭技能悬浮();
              button.focus();
            });
          });
        }

        /* 对账四态的展示口径与战报层一致：
           CONFIRMED 才是既成事实；MISSED/PREEMPTED 是有据可依的否定；
           UNCONFIRMED 是"查无此事"，只在判定依据折叠区里出现，不进正文陈述。 */
        const 对账状态标签 = Object.freeze({
          CONFIRMED: { text: '已确认', mark: '✓' },
          MISSED: { text: '未发生', mark: '✗' },
          PREEMPTED: { text: '未执行', mark: '—' },
          UNCONFIRMED: { text: '无对应事实', mark: '?' },
        });
        /* 选择模式在中立契约里是不透明字符串（战报层不解释语义），
           但直接把英文枚举摆给玩家看没有意义，所以在展示层做一张已知值的显示名表，
           未知值原样透出——换引擎时不认识的新模式仍能显示，不会变成空白。 */
        const 选择模式显示名 = Object.freeze({
          DIRECT_BEST: '明显最优',
          SEEDED_SOFTMAX: '相近取舍',
          PLAYER_LOCKED: '玩家指定',
          FORCED_FALLBACK: '无其他可行',
          FORCED_ACTION: '既定动作',
          REACTION_DECLINED: '放弃应对',
          ALL_OPTIONS_NEGATIVE: '均有损失',
        });
        const 对账种类标签 = Object.freeze({
          HP_DELTA: '伤害',
          SCHEDULED_HP_DELTA: '持续伤害',
          SHIELD_DELTA: '护盾',
          STATE_CHANGED: '状态',
          ACTION_CANCELLED: '行动取消',
          SUMMON_WINDOW: '召唤',
          IRREVERSIBLE_ASSET_LOST: '物品消耗',
          NEXT_ACTION_QUALITY_CHANGED: '能力变化',
          RULE_CHANGED: '规则改动',
          RESOURCE_OPTION_CHANGED: '资源变化',
          PAYMENT: '消耗',
          TERMINAL: '终局',
        });

        /* 玩家版只呈现"本来想做但没做到"的部分。
           已兑现的效果结算步骤里已经逐条叙述过（"打中X，扣掉160点"），
           在这里再列一遍"伤害 X 已确认"是同一件事说两遍，还会让玩家以为是两次伤害。 */
        const 未兑现说法 = Object.freeze({
          HP_DELTA: '预期的伤害没有打出',
          SCHEDULED_HP_DELTA: '预期的持续伤害没有挂上',
          SHIELD_DELTA: '预期的护盾没有建立',
          STATE_CHANGED: '状态没能加上',
          ACTION_CANCELLED: '没能打断对方的行动',
          SUMMON_WINDOW: '召唤没有成功',
          RESOURCE_OPTION_CHANGED: '预期的资源变化没有发生',
          PAYMENT: '消耗没有扣除',
          TERMINAL: '没能就此分出胜负',
          IRREVERSIBLE_ASSET_LOST: '预定要用掉的东西没有用掉',
          NEXT_ACTION_QUALITY_CHANGED: '预定的能力变化没有生效',
          RULE_CHANGED: '预定的规则改动没有生效',
        });

        /* 与战报层 groupStepsByTarget 同一套分组口径：目标多于一个时按承受者分组，
           不指向具体目标的步骤（声明、支付、窗口）留在共享段不重复。 */
        function 群体分组步骤(steps = [], actorName = '') {
          const rows = Array.isArray(steps) ? steps : [];
          const targets = [...new Set(
            rows.map(step => String(step?.targetName || '')).filter(name => name && name !== actorName),
          )];
          if (targets.length <= 1) return null;
          return {
            shared: rows.filter(step => {
              const t = String(step?.targetName || '');
              return !t || t === actorName;
            }),
            groups: targets
              .map(targetName => ({
                targetName,
                steps: rows.filter(step => String(step?.targetName || '') === targetName),
              }))
              .filter(group => group.steps.length),
          };
        }

        function 渲染因果链对账行(row = {}) {
          const status = String(row?.status || '').trim();
          if (status !== 'MISSED' && status !== 'PREEMPTED') return '';
          const kind = String(row?.kind || '').trim();
          const 说法 = 未兑现说法[kind] || `${对账种类标签[kind] || kind}没有兑现`;
          const target = String(row?.targetName || '').trim();
          const stateName = String(row?.expected?.stateName || '').trim();
          const 补充 = status === 'PREEMPTED' ? '（这次行动没能打出去）' : '';
          /* 目标要放在说法前面，"对王金玺 预期的伤害没有打出"才是自然语序；
             放后面会读成"预期的伤害没有打出 对王金玺"。 */
          const 正文 = [
            target ? `对${target}` : '',
            stateName ? `${说法}：【${stateName}】` : 说法,
            补充,
          ].filter(Boolean).join('');
          return `<li class="battle-chain-check battle-chain-check--${status.toLowerCase()}">`
            + `<span class="battle-chain-check-mark" aria-hidden="true">${对账状态标签[status].mark}</span>`
            + `<span class="battle-chain-check-kind">${htmlEscapeText(正文)}</span>`
            + '</li>';
        }

        function 渲染因果链判定依据(node = {}) {
          const decisions = Array.isArray(node?.decisions) ? node.decisions : [];
          if (!decisions.length && !(node?.reconciliation || []).length) return '';

          const 决策块 = decisions.map(entry => {
            const trace = entry?.trace || {};
            const 候选行 = (Array.isArray(trace.candidates) ? trace.candidates : [])
              .map(candidate => {
                const status = String(candidate?.status || '').trim();
                const 状态文本 = status === 'SELECTED' ? '选中' : status === 'EXCLUDED' ? '排除' : '可选';
                const 原因 = candidate?.reason || candidate?.reasonText
                  ? `<span class="battle-chain-candidate-reason">${htmlEscapeText(candidate.reason || candidate.reasonText)}</span>`
                  : '';
                /* 排除码背后"引擎检查了什么"必须能展开，否则结论只是换个说法重复一遍。 */
                const 检查 = candidate?.reasonChecked
                  ? `<span class="battle-chain-candidate-checked">检查：${htmlEscapeText(candidate.reasonChecked)}</span>`
                  : '';
                return `<li class="battle-chain-candidate battle-chain-candidate--${status.toLowerCase()}">`
                  + `<span class="battle-chain-candidate-state">${htmlEscapeText(状态文本)}</span>`
                  + `<b>${htmlEscapeText(candidate?.name || '候选')}</b>${原因}${检查}</li>`;
              })
              .join('');
            /* 首个阶段的 before 恒为 0（还没有候选），写成"0 → 10"玩家会问 0 是什么，
               这一阶段直接陈述产出数量。 */
            const 收敛 = (Array.isArray(trace.narrowing) ? trace.narrowing : [])
              .map(step => {
                const before = Math.max(0, Number(step?.before || 0));
                const after = Math.max(0, Number(step?.after || 0));
                const 变化 = before > 0 ? `${before} → ${after}` : `${after}`;
                return `<li><span>${htmlEscapeText(step?.stage || '')}</span><b>${变化}</b></li>`;
              })
              .join('');
            const 非最优 = trace.wasOptimal === false && trace.topRankedName
              ? `<p class="battle-chain-suboptimal">引擎评分更高的是${htmlEscapeText(trace.topRankedName)}，本次在可接受范围内选了当前动作</p>`
              : '';
            return `<section class="battle-chain-decision">`
              + `<h5>${htmlEscapeText(entry?.actorName || '行动者')}的判断`
              + (trace.selectionLabel ? `<span class="battle-chain-selection">${htmlEscapeText(选择模式显示名[trace.selectionLabel] || trace.selectionLabel)}</span>` : '')
              + '</h5>'
              + (收敛 ? `<ol class="battle-chain-narrowing">${收敛}</ol>` : '')
              + (候选行 ? `<ul class="battle-chain-candidates">${候选行}</ul>` : '')
              + 非最优
              + '</section>';
          }).join('');

          /* 未确认的预测只在这里出现——玩家能查，但它不会被当成已发生的事实叙述。 */
          const 未确认 = (Array.isArray(node?.reconciliation) ? node.reconciliation : [])
            .filter(row => String(row?.status || '') === 'UNCONFIRMED')
            .map(row => `<li>${htmlEscapeText(对账种类标签[row?.kind] || row?.kind || '')}${row?.targetName ? ` · ${htmlEscapeText(row.targetName)}` : ''}：预演给出了这项效果，但结算事实里没有对应记录</li>`)
            .join('');

          return '<details class="battle-preview-trace-fold battle-chain-fold">'
            + '<summary>判定依据</summary>'
            + 决策块
            + (未确认 ? `<section class="battle-chain-unconfirmed"><h5>未能确认的预测</h5><ul>${未确认}</ul></section>` : '')
            + '</details>';
        }

        function 渲染因果链节点(node = {}, factsById = new Map()) {
          const 回合 = Math.max(0, Number(node?.round || 0));
          const 行动者 = String(node?.actorName || '行动者');
          const 动作 = String(node?.action?.name || '行动');
          const 目标 = (Array.isArray(node?.targetNames) ? node.targetNames : [])
            .filter(name => name && name !== 行动者);

          /* 局面只报会在下一个窗口兑现、且不是行动者自己的蓄力；其余是噪音。 */
          const 威胁 = (node?.context?.pendingCharges || [])
            .filter(charge => charge?.imminent && String(charge?.actorName || '') !== 行动者)
            .map(charge => `<li>${htmlEscapeText(charge.actorName)}蓄力中【${htmlEscapeText(charge.actionName)}】，下个行动窗口即可打出</li>`)
            .join('');

          /* 玩家版排除原因用带"为什么"的措辞。
             只列两条，但**必须告知截断**——否则排除了 8 个和排除了 2 个在界面上没有区别，
             可疑的排除会被静默藏在截断线以下。 */
          const 全部排除 = (Array.isArray(node?.decision?.candidates) ? node.decision.candidates : [])
            .filter(candidate => candidate?.status === 'EXCLUDED' && (candidate?.reason || candidate?.reasonPlayerText || candidate?.reasonText));
          const 排除 = [
            ...全部排除.slice(0, 2).map(candidate =>
              `<li>没选${htmlEscapeText(candidate.name)}：${htmlEscapeText(candidate.reason || candidate.reasonPlayerText || candidate.reasonText)}</li>`),
            全部排除.length > 2
              ? `<li class="battle-chain-more">另有${全部排除.length - 2}个选项被排除，展开判定依据可看全部</li>`
              : '',
          ].filter(Boolean).join('');

          /* 结算按真实时序逐步渲染。回应方的步骤缩进并标记，
             让"谁在回应谁"一眼可辨，而不是读一堆并列句自己拼因果。 */
          const steps = Array.isArray(node?.settlement?.steps) ? node.settlement.steps : [];
          const 可叙述 = steps.filter(step => !(step.stepRole === 'DECLARE' && step.actorName === 行动者));
          const 渲染步骤 = (step, 额外类名 = '') => {
            const 文本 = String(step.playerText || step.text || '').trim();
            if (!文本) return '';
            const 类名 = ['battle-chain-step', step.byResponder ? 'battle-chain-step--response' : '', 额外类名]
              .filter(Boolean).join(' ');
            return `<p class="${类名}">${htmlEscapeText(文本)}</p>`;
          };
          /* 多目标 AoE 按承受者分组，否则每个目标的效果会糊成一片，
             玩家分不清哪条作用在谁身上。 */
          const 分组 = 群体分组步骤(可叙述, 行动者);
          const 结算明细 = 分组
            ? [
                ...分组.shared.map(step => 渲染步骤(step)),
                ...分组.groups.flatMap(group => [
                  `<p class="battle-chain-step battle-chain-step--target">对${htmlEscapeText(group.targetName)}</p>`,
                  ...group.steps.map(step => 渲染步骤(step, 'battle-chain-step--grouped')),
                ]),
              ].filter(Boolean)
            : 可叙述.map(step => 渲染步骤(step)).filter(Boolean);
          /* 蓄力、让过这类动作没有后续步骤，此时声明本身就是全部内容——
             不兜底会渲染出一张只有标题的空卡。
             兜底要取声明步骤的玩家版措辞，取 declarationSummary 会把 AI 版判定腔漏给玩家。 */
          if (!结算明细.length) {
            const 声明步骤 = steps.find(step => step.stepRole === 'DECLARE');
            const 声明 = String(
              声明步骤?.playerText || 声明步骤?.text || node?.settlement?.declarationSummary || '',
            ).trim();
            if (声明) 结算明细.push(`<p>${htmlEscapeText(声明)}</p>`);
          }
          const 结算 = 结算明细.join('');

          const 对账 = (Array.isArray(node?.reconciliation) ? node.reconciliation : [])
            .map(渲染因果链对账行)
            .filter(Boolean)
            .join('');

          const 失机 = node?.decisionKind === 'LOST_OPPORTUNITY' && node?.lostOpportunityReason
            ? `<p class="battle-chain-lost">失去行动：${htmlEscapeText(node.lostOpportunityReason)}</p>`
            : '';

          /* 每个数字都必须能查到来源事实。数字令牌带 data-source-* 属性，
             由 绑定ReportDto数字来源 挂上悬浮/点击展开"数字来源"面板。 */
          const 数字 = 可叙述
            .flatMap(step => Array.isArray(step?.numericTokens) ? step.numericTokens : [])
            .map(渲染ReportDto数字)
            .filter(Boolean)
            .join('');

          return '<article class="battle-preview-report-group battle-chain-node">'
            + '<header class="battle-structured-report-head">'
            + `<span>第${回合}回合 · ${htmlEscapeText(行动者)}</span>`
            + `<b>${htmlEscapeText(动作)}${目标.length ? ` → ${htmlEscapeText(目标.join('、'))}` : ''}</b>`
            + '</header>'
            + (威胁 ? `<section class="battle-chain-section battle-chain-section--threat"><h4>局面</h4><ul>${威胁}</ul></section>` : '')
            + (排除 ? `<section class="battle-chain-section battle-chain-section--why"><h4>为什么</h4><ul>${排除}</ul></section>` : '')
            + 失机
            + (结算 ? `<section class="battle-chain-section battle-chain-section--settle"><h4>结算</h4>${结算}</section>` : '')
            + (对账 ? `<section class="battle-chain-section battle-chain-section--check"><h4>没能做到</h4><ul class="battle-chain-checks">${对账}</ul></section>` : '')
            + (数字 ? `<div class="battle-preview-report-badges">${数字}</div>` : '')
            + 渲染因果链判定依据(node)
            + '</article>';
        }

        function 渲染ReportDto回合视图(roundOverview = []) {
          const rows = Array.isArray(roundOverview) ? roundOverview : [];
          if (!rows.length) return '<div class="battle-preview-empty">暂无回合结算</div>';
          return `<div class="battle-report-round-overview">${rows.map(row => {
            const summary = String(row?.summary || '').trim();
            const summaryParts = summary.split('；').map(part => part.trim()).filter(Boolean);
            const passiveParts = String(row?.passiveSummary || '').trim().split('；').map(part => part.trim()).filter(Boolean);
            const headline = String(row?.headline || '').trim();
            return `
              <article class="battle-report-round-overview-row">
                <header><b>第${Math.max(0, Number(row?.round || 0))}回合</b><span>${htmlEscapeText(headline && headline !== summary ? headline : `${summaryParts.length}组战况`)}</span></header>
                ${summaryParts.length ? `<section><h4>交锋结果</h4><ul>${summaryParts.map(part => `<li>${htmlEscapeText(part)}</li>`).join('')}</ul></section>` : ''}
                ${passiveParts.length ? `<section><h4>回合结束变化</h4><ul>${passiveParts.map(part => `<li>${htmlEscapeText(part)}</li>`).join('')}</ul></section>` : ''}
              </article>
            `;
          }).join('')}</div>`;
        }

        function 渲染ReportDto决策视图(explanations = [], narrativeChain = []) {
          const rows = Array.isArray(explanations) ? explanations : [];
          if (!rows.length) return '<div class="battle-preview-empty">暂无决策解释</div>';
          const contexts = (Array.isArray(narrativeChain) ? narrativeChain : []).flatMap(node => {
            const decisions = Array.isArray(node?.decisions) && node.decisions.length
              ? node.decisions
              : node?.decision
                ? [{ actorName: node?.actorName, isPrimary: true }]
                : [];
            return decisions.map(decision => ({ node, decision }));
          });
          const contextAligned = contexts.length === rows.length && rows.every((row, index) =>
            String(contexts[index]?.decision?.actorName || contexts[index]?.node?.actorName || '').trim() ===
            String(row?.actorName || '').trim()
          );
          const indexedRows = rows.map((row, index) => ({ row, node: contextAligned ? contexts[index]?.node || null : null }));
          const rounds = [...new Set(rows.map(row => Math.max(0, Number(row?.round || 0))).filter(Boolean))]
            .sort((left, right) => left - right);
          const actors = [...new Set(rows.map(row => String(row?.actorName || '').trim()).filter(Boolean))]
            .sort((left, right) => left.localeCompare(right, 'zh-CN'));
          const state = window.BattleUI?.state || {};
          const activeRound = rounds.includes(Number(state.activeBattleDecisionRound))
            ? Number(state.activeBattleDecisionRound)
            : 0;
          const activeActor = actors.includes(String(state.activeBattleDecisionActor || '').trim())
            ? String(state.activeBattleDecisionActor).trim()
            : '';
          if (window.BattleUI?.state) {
            window.BattleUI.state.activeBattleDecisionRound = activeRound;
            window.BattleUI.state.activeBattleDecisionActor = activeActor;
          }
          const visibleRows = indexedRows.filter(({ row }) =>
            (!activeRound || Number(row?.round || 0) === activeRound) &&
            (!activeActor || String(row?.actorName || '').trim() === activeActor)
          );
          const filters = `
            <div class="battle-decision-filter" aria-label="筛选判定记录">
              <label>回合
                <select data-battle-decision-round-filter>
                  <option value="0">全部回合（${rows.length}项）</option>
                  ${rounds.map(round => `<option value="${round}"${round === activeRound ? ' selected' : ''}>第${round}回合（${rows.filter(row => Number(row?.round || 0) === round).length}项）</option>`).join('')}
                </select>
              </label>
              <label>行动者
                <select data-battle-decision-actor-filter>
                  <option value="">全部行动者</option>
                  ${actors.map(actor => `<option value="${htmlEscapeText(actor)}"${actor === activeActor ? ' selected' : ''}>${htmlEscapeText(actor)}</option>`).join('')}
                </select>
              </label>
            </div>
          `;
          if (!visibleRows.length) {
            return `${filters}<div class="battle-preview-empty">当前筛选下没有判定记录，请调整回合或行动者。</div>`;
          }
          return `${filters}<div class="battle-report-decision-explanations">${visibleRows.map(({ row, node }) => {
            const selected = row?.selected || {};
            const alternatives = Array.isArray(row?.alternatives) ? row.alternatives : [];
            const actualTokens = Array.isArray(row?.actual?.numericTokens) ? row.actual.numericTokens : [];
            const predictedTokens = Array.isArray(row?.predicted?.numbers) ? row.predicted.numbers : [];
            const situationTokens = predictedTokens.filter(token => /当前|余量|可推进目标数/.test(String(token?.label || token?.displayName || '')));
            const forecastTokens = predictedTokens.filter(token => !situationTokens.includes(token));
            const randomTokens = actualTokens.filter(token => String(token?.label || token?.displayName || '') === '随机值');
            const resultTokens = actualTokens.filter(token => !randomTokens.includes(token));
            const mainReason = String(row?.comparisonEvidence?.explanation || '').trim();
            const selectedName = String(selected?.name || '').trim();
            const reasonPrefix = `选择${selectedName}；`;
            const displayedMainReason = selectedName && mainReason.startsWith(reasonPrefix)
              ? mainReason.slice(reasonPrefix.length).trim()
              : mainReason;
            const supportingReasons = [...new Set([
              ...(row?.objectiveTradeoffs || []),
              ...(row?.riskTradeoffs || []),
              ...(row?.resourceTradeoffs || []),
              ...(row?.futurePoolTradeoffs || []),
            ].map(reason => String(reason || '').trim()).filter(reason => {
              if (!reason || mainReason.includes(reason)) return false;
              const sharedConcept = ['目标推进', '风险', '资源', '消耗', '伤害', '控制', '防御', '生存', '行动机会']
                .some(concept => mainReason.includes(concept) && reason.includes(concept));
              const genericConceptReason = /^(?:这一手的主要价值在.+上。|当前公开信息里，这一步的.+收益更突出。|这一手的优势主要体现在.+上。|按当前公开信息，这一步在.+上更合适。)$/.test(reason);
              return !(sharedConcept && genericConceptReason);
            }))];
            const settlementTexts = (Array.isArray(row?.actual?.settlementTexts) ? row.actual.settlementTexts : [])
              .map(value => String(value || '').trim())
              .filter(Boolean);
            const actualHeadline = settlementTexts[0] || '';
            const settlementDetails = settlementTexts.length > 1 ? settlementTexts : [];
            const alternativeHTML = alternatives.length
              ? `<ul>${alternatives.map(candidate => `
                  <li><b>${htmlEscapeText(candidate?.name || '替代动作')}</b>${candidate?.reason && !mainReason.includes(String(candidate.reason).trim()) ? `：${htmlEscapeText(candidate.reason)}` : ''}</li>
                `).join('')}</ul>`
              : `<p>${htmlEscapeText(row?.comparisonEvidence?.alternativeSummary || '没有登记可比较的替代动作。')}</p>`;
            const choiceReasonHTML = (displayedMainReason || supportingReasons.length)
              ? `<section class="battle-report-decision-reason"><h4>为什么这样选</h4>${displayedMainReason ? `<p>${htmlEscapeText(displayedMainReason)}</p>` : ''}${supportingReasons.length ? `<ul>${supportingReasons.map(reason => `<li>${htmlEscapeText(reason)}</li>`).join('')}</ul>` : ''}</section>`
              : '';
            return `
              <article class="battle-report-decision-explanation">
                <header><span>第${Math.max(0, Number(row?.round || 0))}回合 · ${htmlEscapeText(row?.actorName || '行动者')}</span><b>${htmlEscapeText(selected?.name || '未记录动作')}</b></header>
                <section class="battle-report-decision-context"><h4>当时局面</h4><div class="battle-report-decision-numbers">
                  ${situationTokens.length ? situationTokens.map(渲染ReportDto数字).join(' ') : '<span class="battle-preview-empty">当时没有更多可公开的局面数字</span>'}
                </div></section>
                <div class="battle-report-decision-choice-analysis">
                  ${choiceReasonHTML}
                  <section class="battle-report-decision-alternatives"><h4>当时的主要替代</h4>${alternativeHTML}</section>
                </div>
                <section class="battle-report-decision-forecast"><h4>当时预期</h4><div class="battle-report-decision-numbers">
                  ${forecastTokens.length ? forecastTokens.map(渲染ReportDto数字).join(' ') : '<span class="battle-preview-empty">暂无可公开的预测数字</span>'}
                </div></section>
                <section class="battle-report-decision-result"><h4>实际结算</h4>
                  ${actualHeadline ? `<p>${htmlEscapeText(actualHeadline)}</p>` : `<p class="battle-preview-empty">${contextAligned ? '本次判定没有额外结算文本' : '判定记录与因果链顺序不一致，无法自动绑定局面上下文'}</p>`}
                  <div class="battle-report-decision-numbers">${resultTokens.length ? resultTokens.map(渲染ReportDto数字).join(' ') : '<span class="battle-preview-empty">暂无数值事实</span>'}</div>
                  ${settlementDetails.length ? `<details class="battle-report-decision-steps"><summary>查看完整结算过程（${settlementTexts.length}步）</summary><ol>${settlementDetails.map(text => `<li>${htmlEscapeText(text)}</li>`).join('')}</ol></details>` : ''}
                </section>
                ${randomTokens.length ? `<details class="battle-report-decision-rolls"><summary>随机判定明细</summary><div class="battle-report-decision-numbers">${randomTokens.map(渲染ReportDto数字).join(' ')}</div></details>` : ''}
              </article>
            `;
          }).join('')}</div>`;
        }

        function 渲染ReportDto记录视图(reportDto = {}, activeView = 'report') {
          if (activeView === 'summary') {
            return 渲染战斗总结HTML(reportDto?.finalSummary) || '<div class="battle-preview-empty">暂无总结</div>';
          }
          if (activeView === 'round') {
            return 渲染ReportDto回合视图(reportDto?.roundOverview);
          }
          if (activeView === 'decision') {
            return 渲染ReportDto决策视图(reportDto?.decisionExplanations, reportDto?.narrativeChain);
          }
          const chain = Array.isArray(reportDto?.narrativeChain) ? reportDto.narrativeChain : [];
          if (!chain.length) return '<div class="battle-preview-empty">暂无战报</div>';
          /* 单一因果链时间线：按回合分段，每次行动一张卡，卡内顺序即因果顺序。 */
          const 分段 = [];
          let 当前回合 = null;
          chain.forEach(node => {
            const 回合 = Math.max(0, Number(node?.round || 0));
            if (回合 !== 当前回合) {
              当前回合 = 回合;
              分段.push(`<h3 class="battle-chain-round">第${回合}回合</h3>`);
            }
            分段.push(渲染因果链节点(node));
          });
          return `<div class="battle-preview-report battle-chain">${分段.join('')}</div>`;
        }

        function isRenderablePlayerReportDto(reportDto = {}) {
          return Boolean(
            reportDto &&
            typeof reportDto === 'object' &&
            String(reportDto.schemaVersion || '').trim() === 'BattleReportDtoV2' &&
            String(reportDto.visibilityMode || '').trim() === 'PLAYER' &&
            String(reportDto.projectionStatus || '').trim() === 'PASSED',
          );
        }

        function 渲染战斗记录面板() {
          const node = 读取战斗记录面板节点();
          if (!node) return;
          const state = window.BattleUI?.state || {};
          同步战斗记录展开状态();
          const activeTab = 读取战斗记录页签();
          读取战斗记录终端节点()?.querySelectorAll('[data-battle-record-tab]').forEach(button => {
            const active = button.getAttribute('data-battle-record-tab') === activeTab;
            button.classList.toggle('active', active);
            button.setAttribute('aria-selected', active ? 'true' : 'false');
            button.setAttribute('tabindex', active ? '0' : '-1');
          });
          const result = activeTab === 'preview' ? state.previewResult : state.actualBattleResult;
          if (!result) {
            node.hidden = false;
            node.innerHTML = `
              <div class="battle-preview-head">
                <span>${activeTab === 'preview' ? '预演记录' : '实战记录'}</span>
                <b>暂无记录</b>
                <em>${activeTab === 'preview' ? '点击预演生成' : '点击结算生成'}</em>
              </div>
              <div class="battle-preview-empty">${activeTab === 'preview' ? '预演不会提交战斗，只用于查看预期战报和判定流程。' : '实战结算后会在这里保留本次战报。'}</div>
            `;
            return;
          }
          if (!isRenderablePlayerReportDto(result?.reportDto)) {
            node.hidden = false;
            node.innerHTML = `
              <div class="battle-preview-head">
                <span>${activeTab === 'preview' ? '预演记录' : '实战记录'}</span>
                <b>战报暂不可用</b>
                <em>等待经过审计的玩家战报</em>
              </div>
              <div class="battle-preview-empty">本次结果未通过玩家战报审计，已阻止显示冲突内容。</div>
            `;
            return;
          }
          if (isRenderablePlayerReportDto(result.reportDto)) {
            const activeView = 读取战斗记录视图();
            const 视图标签 = { round: '回合', report: '战报', decision: '判定', summary: '总结' };
            node.hidden = false;
            node.innerHTML = `
              <div class="battle-preview-head">
                <span>${activeTab === 'preview' ? '预演结果' : '实战结果'}</span>
                <b>${htmlEscapeText(格式化战斗模式显示文本(result.modeLabel, result.battleMode, result.mode))}</b>
                <em>${htmlEscapeText(`推进${Math.max(0, Number(result.reportDto.actualRoundCount || 0))}回合`)}</em>
              </div>
              <div class="battle-record-view-tabs" role="tablist" aria-label="记录视图">
                ${Object.entries(视图标签).map(([view, label]) => `<button class="battle-record-view-tab${view === activeView ? ' active' : ''}" type="button" role="tab" data-battle-record-view="${view}" aria-selected="${view === activeView ? 'true' : 'false'}" tabindex="${view === activeView ? '0' : '-1'}">${label}</button>`).join('')}
              </div>
              <section class="battle-record-view" role="tabpanel" aria-label="${htmlEscapeText(视图标签[activeView])}">${渲染ReportDto记录视图(result.reportDto, activeView)}</section>
            `;
            绑定分段控件键盘导航(node.querySelector('.battle-record-view-tabs'), 'data-battle-record-view', activeView, 设置战斗记录视图);
            if (activeView === 'decision') {
              const bindDecisionFilter = (selector, stateKey, normalize) => {
                const select = node.querySelector(selector);
                if (!select) return;
                select.addEventListener('change', () => {
                  if (window.BattleUI?.state) window.BattleUI.state[stateKey] = normalize(select.value);
                  渲染战斗记录面板();
                  读取战斗记录面板节点()?.querySelector(selector)?.focus();
                });
              };
              bindDecisionFilter('[data-battle-decision-round-filter]', 'activeBattleDecisionRound', value => Math.max(0, Number(value || 0)));
              bindDecisionFilter('[data-battle-decision-actor-filter]', 'activeBattleDecisionActor', value => String(value || '').trim());
            }
            绑定ReportDto数字来源(node);
            return;
          }
          return;
        }

        function 渲染战斗预演面板(result = null) {
          if (result && window.BattleUI?.state) window.BattleUI.state.previewResult = result;
          if (window.BattleUI?.state) window.BattleUI.state.activeBattleRecordTab = 'preview';
          设置战斗记录展开状态(true);
          渲染战斗记录面板();
        }

        function renderReport(reportDto = {}, options = {}) {
          if (!isRenderablePlayerReportDto(reportDto)) throw new TypeError('battle_report_dto_not_ready');
          const preview = options.preview === true;
          const result = {
            preview,
            committed: !preview,
            mode: preview ? 'preview' : 'sealed_transaction',
            battleMode: options.battleMode || 'single_round',
            roundsExecuted: Math.max(0, Number(reportDto.actualRoundCount || 0)),
            reportDto,
            finalBattleReport: reportDto.finalSummary || null,
            aiStructuredSummary: reportDto.aiStructuredSummary || null,
            llmBattleSummary: String(reportDto?.finalSummary?.text || ''),
          };
          if (window.BattleUI?.state) {
            if (preview) {
              window.BattleUI.state.previewResult = result;
              window.BattleUI.state.activeBattleRecordTab = 'preview';
            } else {
              window.BattleUI.state.actualBattleResult = result;
              window.BattleUI.state.activeBattleRecordTab = 'actual';
            }
          }
          设置战斗记录展开状态(true);
          渲染战斗记录面板();
          return result;
        }

        function renderSoulTowerSettlementPanel(pendingSettlement = null) {
          const node = byId('ui-tower-settlement');
          const arbitrateBtn = byId('ui-arbitrate');
          const previewBtn = byId('ui-battle-preview');
          const intentModeInput = byId('ui-intent-mode');
          const modeControls = Array.from(document.querySelectorAll('#ui-mode-group [data-mode], #ui-mode-group [data-dropdown-trigger]'));
          if (!node) return;
          if (!pendingSettlement) {
            node.hidden = true;
            node.innerHTML = '';
            if (arbitrateBtn) arbitrateBtn.disabled = false;
            if (previewBtn) previewBtn.disabled = false;
            if (intentModeInput) intentModeInput.disabled = false;
            modeControls.forEach(btn => {
              btn.disabled = false;
            });
            return;
          }
          node.hidden = false;
          if (arbitrateBtn) arbitrateBtn.disabled = true;
          if (previewBtn) previewBtn.disabled = true;
          if (intentModeInput) intentModeInput.disabled = true;
          modeControls.forEach(btn => {
            btn.disabled = true;
          });
          const spiritText = buildSoulTowerDiscountSpiritDisplay(pendingSettlement.五折魂灵);
          const continueButton = pendingSettlement.可继续
            ? `<button class="ghost-btn tower-settlement-action" type="button" data-tower-settlement="continue">继续下一层</button>`
            : `<span class="tower-settlement-note">已抵达魂灵塔顶层，无法继续上冲。</span>`;
          node.innerHTML = `
            <div class="tower-settlement-card">
              <div class="tower-settlement-head">
                <b>魂灵塔通关待选择</b>
                <span>${htmlEscapeText(pendingSettlement.区域标签 || '魂灵塔')}</span>
              </div>
              <div class="tower-settlement-body">
                <span>当前可五折魂灵：${htmlEscapeText(spiritText)}</span>
                <span>选择结束将保留该资格；选择继续会立即放弃它并进入第${htmlEscapeText(pendingSettlement.下一层 || pendingSettlement.层数 + 1)}层。</span>
              </div>
              <div class="tower-settlement-actions">
                <button class="ghost-btn tower-settlement-action primary" type="button" data-tower-settlement="end">结束并保留资格</button>
                ${continueButton}
              </div>
            </div>
          `;
          node.querySelectorAll('[data-tower-settlement]').forEach(button => {
            button.addEventListener('click', () => {
              const action = button.getAttribute('data-tower-settlement') || 'end';
              window.BattleUI?.resolveSoulTowerSettlement?.(action);
            });
          });
        }

        function resolveSoulTowerSettlement(action = 'end') {
          const choice = action === 'continue' ? 'continue' : 'end';
          const state = window.BattleUI?.state || {};
          const combatData = cloneBattleValue(getUiCombatData() || state.combatData || {});
          if (!combatData || !combatData.参战者) return { ok: false, reason: 'combat_missing' };
          BATTLE_RUNTIME.prepareCombatData(combatData, name => getMvuValue(`char.${name}`, null));
          const pendingSettlement = normalizeSoulTowerPendingSettlement(combatData.魂灵塔待结算);
          if (!pendingSettlement) return { ok: false, reason: 'tower_settlement_missing' };
          const playerName = String(combatData?.参战者?.team_player?.[0]?.name || state.player?.name || '').trim();
          if (!playerName) return { ok: false, reason: 'player_missing' };
          const currentRecord = window.BattleUIBridge?.getMVU(`char.${playerName}.魂灵塔记录`) || {};
          const nextHighestFloor = Math.max(
            Math.floor(Number(currentRecord?.最高层 || 0)),
            Math.floor(Number(pendingSettlement.层数 || 0)),
          );
          const nextTowerRecord = {
            最高层: nextHighestFloor,
            当前五折魂灵: choice === 'end'
              ? pendingSettlement.五折魂灵
              : createEmptySoulTowerDiscountSpiritRecord(),
          };
          delete combatData.魂灵塔待结算;
          combatData.本次操作 = undefined;
          combatData.前端建议结果 = undefined;
          combatData.裁断约束 = undefined;
          combatData.建议终点HP区间 = undefined;
          combatData.前端推荐终点HP = undefined;
          combatData.预计HP伤害 = undefined;
          const extraPatchOps = [
            {
              op: 'replace',
              path: `/char/${escapeJsonPointerSegment(playerName)}/魂灵塔记录`,
              value: nextTowerRecord,
            },
          ];

          if (choice === 'continue' && pendingSettlement.可继续) {
            const nextFloor = Math.min(SOUL_TOWER_TOTAL_FLOORS, Math.max(1, Math.floor(Number(pendingSettlement.下一层 || pendingSettlement.层数 + 1))));
            const nextMeta = getSoulTowerGateMeta(nextFloor);
            combatData.floor = nextFloor;
            combatData.回合 = 0;
            combatData.进行中 = true;
            combatData.裁断结果 = '';
            combatData.阶段 = 战斗阶段枚举_V1.宣告;
            combatData.大关卡 = nextMeta.gateIndex;
            combatData.大关标签 = nextMeta.gateLabel;
            combatData.关卡范围 = nextMeta.gateRangeLabel;
            combatData.关底战 = nextMeta.isGateBoss;
            combatData.环境 = 构建魂灵塔试炼地点(nextFloor);
            combatData.试炼状态 = 构建魂灵塔试炼地点(nextFloor);
            combatData.进行中 = false;
            if (combatData.参战者 && typeof combatData.参战者 === 'object') combatData.参战者.team_enemy = [];
            const 冲塔续层位置补丁 = 构建角色位置补丁(playerName, 构建魂灵塔试炼地点(nextFloor));
            if (冲塔续层位置补丁) extraPatchOps.push(冲塔续层位置补丁);
            extraPatchOps.push({
              op: 'replace',
              path: '/sys/系统播报',
              value: `[魂灵塔] 已放弃第${pendingSettlement.层数}层的五折资格，继续挑战第${nextFloor}层。`,
            });
          } else {
            combatData.进行中 = false;
            combatData.裁断结果 = `魂灵塔第${pendingSettlement.层数}层通关`;
            combatData.试炼状态 = '';
            const 冲塔结束位置补丁 = 构建角色位置补丁(playerName, 魂灵塔退出地点);
            if (冲塔结束位置补丁) extraPatchOps.push(冲塔结束位置补丁);
            extraPatchOps.push({
              op: 'replace',
              path: '/sys/系统播报',
              value: `[魂灵塔] 已结束本次冲塔，保留当前五折目标：${buildSoulTowerDiscountSpiritDisplay(pendingSettlement.五折魂灵)}。`,
            });
          }

          const detail =
            window.BattleUIBridge?.persistCombatData?.(combatData, {
              analysis:
                choice === 'continue'
                  ? 'Frontend soul tower settlement advanced to the next floor. Apply the patched battle state and latest tower record exactly as given.'
                  : 'Frontend soul tower settlement ended the run and preserved the latest discount target. Apply the patched tower record and close the battle context.',
              extraPatchOps,
              syncHpRecoveryOnly: false,
            }) || null;
          return {
            ok: true,
            action: choice,
            floor: pendingSettlement.层数,
            nextFloor: pendingSettlement.下一层,
            delivery: detail?.delivery || null,
          };
        }

        function 构建动作不可用战斗结果(reason = '', battleMode = '') {
          const text = String(reason || '当前动作不可用，请重新选择可执行动作').trim();
          const blocks = [{
            type: 'text',
            content: text,
            projectionSource: 'action_unavailable_ast',
          }];
          return {
            ok: false,
            mode: 'action_unavailable',
            battleMode,
            message: text,
            logs: [`[释放受限] ${text}`],
            decisionTrace: [],
            publicReport: text,
            publicReportBlocks: [{
              round: 0,
              blocks,
              text,
              projectionSource: 'action_unavailable_ast',
            }],
          };
        }

        function 设置战斗事务等待状态(pending) {
          const state = window.BattleUI?.state || {};
          state.battleTransactionPending = pending === true;
          const locked = state.battleTransactionPending || !!state.pendingTowerSettlement;
          const arbitrateBtn = byId('ui-arbitrate');
          const previewBtn = byId('ui-battle-preview');
          [arbitrateBtn, previewBtn].forEach(button => {
            if (!button) return;
            button.disabled = locked;
            if (state.battleTransactionPending) button.setAttribute('aria-busy', 'true');
            else button.removeAttribute('aria-busy');
          });
        }

        async function submitBattleIntent() {
          const state = window.BattleUI?.state || {};
          if (state.battleTransactionPending) {
            return { ok: false, mode: 'transaction_pending', message: '战斗事务正在结算。' };
          }
          if (state.pendingTowerSettlement) {
            return {
              ok: false,
              mode: 'tower_pending_choice',
              message: '魂灵塔通关后需先选择结束或继续，当前不能直接再次结算。',
            };
          }
          const battleMode = state.currentMode === 'multi_round' ? 'multi_round' : 'single_round';
          const autoContinueConfig = 读取界面自动续推设置(state);
          state.combatData.战斗意图 = state.currentIntentMode || '点到为止';
          const queue = 读取可提交战斗动作队列(state);
          if (!queue.length) {
            const selected = state.selectedSkillActions?.[state.selectedSkillActions.length - 1] || state.selectedAction;
            const reason = String(selected?.reason || '当前动作不可用，请重新选择可执行动作').trim();
            显示战斗提示(reason, 'error');
            const result = 构建动作不可用战斗结果(reason, battleMode);
            window.__battleLastIntentText = '';
            if (window.BattleUI?.state) {
              window.BattleUI.state.actualBattleResult = result;
              window.BattleUI.state.activeBattleRecordTab = 'actual';
            }
            设置战斗记录展开状态(true);
            渲染战斗记录面板();
            return result;
          }
          const intentText = buildIntentText(queue);
          const actionDeclaration = buildActionDeclaration(queue);
          const output = byId('ui-intent-output');
          if (output) output.value = intentText;
          window.__battleLastIntentText = intentText;

          设置战斗事务等待状态(true);
          try {
          let result = { intentText, mode: 'intent_only', battleMode };
          try {
              window.dispatchEvent(new CustomEvent('battle-ui-intent-submit', { detail: { intentText, actionDeclaration, battleMode, intentMode: state.currentIntentMode || '点到为止', autoContinueConfig } }));
          } catch (error) {
            console.warn('battle-ui-intent-submit dispatch failed', error);
          }

          if (typeof onPlayerAttack === 'function') {
            try {
              const engineResult = await onPlayerAttack(intentText, { mode: battleMode, intentMode: state.currentIntentMode || '点到为止', actionDeclaration, autoContinueConfig }) || {};
              if (typeof syncFromBattleEngine === 'function') syncFromBattleEngine();
              result = {
                ...engineResult,
                intentText,
                mode: engineResult.mode || 'engine_arbitrated',
                battleMode,
                aiRequest: engineResult.aiRequest || window.__lastBattleAIRequest || null,
              };
            } catch (error) {
              console.error('battle arbitration failed', error);
              result = { intentText, mode: 'engine_error', battleMode, error };
            }
          } else {
            result = { intentText, mode: 'engine_unavailable', battleMode, error: 'battle_engine_unavailable' };
          }

          try {
            if (window.BattleUI?.state) {
              window.BattleUI.state.actualBattleResult = result;
              window.BattleUI.state.activeBattleRecordTab = 'actual';
            }
            设置战斗记录展开状态(true);
            渲染战斗记录面板();
            window.dispatchEvent(new CustomEvent('battle-ui-submit-finished', { detail: result }));
          } catch (error) {
            console.warn('battle-ui-submit-finished dispatch failed', error);
          }
          return result;
          } finally {
            设置战斗事务等待状态(false);
          }
        }

        async function previewBattleIntent() {
          const state = window.BattleUI?.state || {};
          if (state.battleTransactionPending) {
            return { ok: false, mode: 'transaction_pending', message: '战斗事务正在结算。' };
          }
          if (state.pendingTowerSettlement) return { ok: false, mode: 'tower_pending_choice' };
          const battleMode = state.currentMode === 'multi_round' ? 'multi_round' : 'single_round';
          const autoContinueConfig = 读取界面自动续推设置(state);
          state.combatData.战斗意图 = state.currentIntentMode || '点到为止';
          const queue = 读取可提交战斗动作队列(state);
          if (!queue.length) {
            const selected = state.selectedSkillActions?.[state.selectedSkillActions.length - 1] || state.selectedAction;
            const reason = String(selected?.reason || '当前动作不可用，请重新选择可执行动作').trim();
            显示战斗提示(reason, 'error');
            const result = 构建动作不可用战斗结果(reason, battleMode);
            window.__battleLastIntentText = '';
            if (window.BattleUI?.state) window.BattleUI.state.previewResult = result;
            渲染战斗预演面板(result);
            return result;
          }
          const intentText = buildIntentText(queue);
          const actionDeclaration = buildActionDeclaration(queue);
          const output = byId('ui-intent-output');
          if (output) output.value = intentText;
          window.__battleLastIntentText = intentText;
          设置战斗事务等待状态(true);
          try {
            const result = await onPlayerAttack(intentText, {
              mode: battleMode,
              intentMode: state.currentIntentMode || '点到为止',
              dryRun: true,
              combatData: state.combatData,
              actionDeclaration,
              autoContinueConfig,
            });
            window.BattleUI.state.previewResult = result;
            渲染战斗预演面板(result);
            return result;
          } catch (error) {
            console.error('battle preview failed', error);
            const result = { preview: true, mode: 'engine_error', battleMode, error, logs: [`[预演失败] ${error?.message || error}`], decisionTrace: [] };
            window.BattleUI.state.previewResult = result;
            渲染战斗预演面板(result);
            return result;
          } finally {
            设置战斗事务等待状态(false);
          }
        }

        function bindUIEvents() {
          初始化战斗下拉控件();
          document.querySelectorAll('#ui-mode-group [data-mode]').forEach(btn => {
            if (btn.__battleModeBound) return;
            btn.addEventListener('click', () => {
              setUiBattleMode(btn.dataset.mode);
            });
            btn.__battleModeBound = true;
          });
          document.querySelectorAll('#ui-battle-submit-mode-group [data-submit-mode]').forEach(btn => {
            if (btn.__battleSubmitModeBound) return;
            btn.addEventListener('click', () => {
              window.BattleUIBridge?.setBattleSubmitMode?.(btn.dataset.submitMode || 'manual');
            });
            btn.__battleSubmitModeBound = true;
          });
          document.querySelectorAll('#ui-intent-mode-select [data-intent-mode]').forEach(btn => {
            if (btn.__battleIntentOptionBound) return;
            btn.addEventListener('click', () => {
              setUiIntentMode(btn.getAttribute('data-intent-mode') || '点到为止');
            });
            btn.__battleIntentOptionBound = true;
          });
          同步战斗提交模式控件();

          const intentModeInput = byId('ui-intent-mode');
          if (intentModeInput && !intentModeInput.__battleIntentBound) {
            intentModeInput.addEventListener('change', () => {
              setUiIntentMode(intentModeInput.value || '点到为止');
            });
            intentModeInput.__battleIntentBound = true;
          }

          const arbitrateBtn = byId('ui-arbitrate');
          if (arbitrateBtn && !arbitrateBtn.__battleSubmitBound) {
            arbitrateBtn.addEventListener('click', submitBattleIntent);
            arbitrateBtn.__battleSubmitBound = true;
          }
          const previewBtn = byId('ui-battle-preview');
          if (previewBtn && !previewBtn.__battlePreviewBound) {
            previewBtn.addEventListener('click', previewBattleIntent);
            previewBtn.__battlePreviewBound = true;
          }
          读取战斗记录终端节点()?.querySelectorAll('[data-battle-record-tab]').forEach(button => {
            if (button.__battleRecordTabBound) return;
            button.addEventListener('click', () => {
              设置战斗记录页签(button.getAttribute('data-battle-record-tab') || 'actual');
            });
            button.addEventListener('keydown', event => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              const buttons = Array.from(读取战斗记录终端节点()?.querySelectorAll('[data-battle-record-tab]') || []);
              const index = buttons.indexOf(button);
              if (index < 0) return;
              event.preventDefault();
              const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
              const next = buttons[nextIndex];
              if (!next) return;
              设置战斗记录页签(next.getAttribute('data-battle-record-tab') || 'actual');
              next.focus();
            });
            button.__battleRecordTabBound = true;
          });
          const recordToggle = 读取战斗记录终端节点()?.querySelector('#ui-battle-record-toggle');
          if (recordToggle && !recordToggle.__battleRecordToggleBound) {
            recordToggle.addEventListener('click', () => {
              const terminal = 读取战斗记录终端节点();
              if (terminal?.__battleRecordSuppressClick) return;
              const collapsed = window.BattleUI?.state?.battleRecordCollapsed !== false;
              设置战斗记录展开状态(collapsed);
            });
            recordToggle.__battleRecordToggleBound = true;
          }

          const closeBtn = byId('ui-battle-close');
          if (closeBtn && !closeBtn.__battleCloseBound) {
            closeBtn.addEventListener('click', () => {
              window.dispatchEvent(new CustomEvent('battle-ui-close-request', { detail: { source: 'battle_ui' } }));
            });
            closeBtn.__battleCloseBound = true;
          }
        }

        const originalInit = typeof initBattleUiFromMvu === 'function' ? initBattleUiFromMvu : null;
        if (originalInit) {
          initBattleUiFromMvu = async function () {
            await originalInit();
            bindUIEvents();
          window.BattleUI = Object.assign(window.BattleUI || {}, {
              buildIntentText,
              buildActionDeclaration,
              submitBattleIntent,
              previewBattleIntent,
              renderReport,
              读取可提交战斗动作队列,
              resolveSoulTowerSettlement,
            });
          };
        }

        initBattleUiFromMvu();
      }
}

window.BattleUIComponent = BattleUIComponent;
window.mountBattleUI = function(containerElement, snapshot, options = {}) {
  return new BattleUIComponent(containerElement, snapshot, options);
};


})();

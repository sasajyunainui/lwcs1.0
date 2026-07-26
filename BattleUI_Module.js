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
    const 战斗意图模式列表 = new Set(['点到为止', '生擒', '压制', '必杀']);
    function normalizeBattleIntentMode(value = '') {
      const normalized = String(value || '').trim();
      return 战斗意图模式列表.has(normalized) ? normalized : '点到为止';
    }
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
    const 同步召唤单位镜像 = BATTLE_RUNTIME.syncSummonUnitMirror;
    const 设置战斗延迟效果资源值 = BATTLE_RUNTIME.writeCombatResource;
    const 记录状态来源登记 = BATTLE_RUNTIME.registerStateSource;
    const 查找状态来源登记 = BATTLE_RUNTIME.findStateSource;
    const 写入回合末资源变化事实 = BATTLE_RUNTIME.writeRoundEndResourceEvent;
    const 刷新维持运行态负荷 = BATTLE_RUNTIME.refreshSustainRuntimeLoad;
    const triggerReviveEffect = BATTLE_RUNTIME.triggerRevive;
    const BATTLE_SKILL_SIDE_EFFECT_STATUS_MAP = BATTLE_RUNTIME.sideEffectStatusMap;
    const normalizeBattleSkillSideEffectList = BATTLE_RUNTIME.normalizeSideEffectList;
    if (!BATTLE_RUNTIME || typeof BATTLE_RUNTIME !== 'object') throw new Error('battle_runtime_module_missing');
    const BATTLE_PREVIEW = root.__LWCS_BATTLE_PREVIEW__;
    if (!BATTLE_PREVIEW || typeof BATTLE_PREVIEW.estimateWithdrawal !== 'function') throw new Error('battle_preview_module_missing');
    const BATTLE_DECISION = root.__LWCS_BATTLE_DECISION__;
    if (BATTLE_RUNTIME.version !== '7.3-R6.3') throw new Error(`battle_runtime_version_mismatch:${BATTLE_RUNTIME.version || 'missing'}`);
    if (BATTLE_PREVIEW.version !== '7.3-R6.3-preview-2') throw new Error(`battle_preview_version_mismatch:${BATTLE_PREVIEW.version || 'missing'}`);
    if (BATTLE_DECISION?.version !== '7.3-R6.3-decision-2') throw new Error(`battle_decision_version_mismatch:${BATTLE_DECISION?.version || 'missing'}`);
    const SHARED_SKILL_MECHANISM_REGISTRY = root.__LWCS_SKILL_MECHANISM_REGISTRY__;
    if (!SHARED_SKILL_MECHANISM_REGISTRY || BATTLE_RUNTIME.prototypeRegistry !== SHARED_SKILL_MECHANISM_REGISTRY.原型定义) {
      throw new Error('battle_runtime_registry_contract_mismatch');
    }
    const BATTLE_PROTOTYPE_REGISTRY = BATTLE_RUNTIME.prototypeRegistry;
    const BATTLE_PROTOTYPE_RUNTIME_CONTRACT = BATTLE_RUNTIME.prototypeRuntimeContract;
    if (!BATTLE_PROTOTYPE_RUNTIME_CONTRACT || typeof BATTLE_PROTOTYPE_RUNTIME_CONTRACT !== 'object') {
      throw new Error('battle_runtime_prototype_contract_missing');
    }
    const 战斗来源类别上下文表 = new WeakMap();
    const 写入战斗来源类别上下文 = (skill, 上下文 = {}) => {
      if (!skill || typeof skill !== 'object') return skill;
      const 来源类别 = String(上下文?.来源类别 || 上下文?.category || 上下文?.来源分类 || '').trim();
      const 来源明细 = String(上下文?.来源明细 || 上下文?.source_detail || 上下文?.detail || 来源类别 || '').trim();
      const 魂环路径 = Array.isArray(上下文?.魂环路径) ? 上下文.魂环路径.map(片段 => String(片段)) : [];
      const 魂技槽位 = String(上下文?.魂技槽位 || 上下文?.技能键 || '').trim();
      const 当前 = 战斗来源类别上下文表.get(skill) || {};
      战斗来源类别上下文表.set(skill, {
        ...当前,
        ...(来源类别 ? { 来源类别 } : {}),
        ...(来源明细 ? { 来源明细 } : {}),
        ...(魂环路径.length ? { 魂环路径 } : {}),
        ...(魂技槽位 ? { 魂技槽位 } : {}),
      });
      if (来源类别) skill.__战斗来源类别 = 来源类别;
      if (来源明细) skill.__战斗来源明细 = 来源明细;
      if (魂环路径.length) skill.__魂环路径 = [...魂环路径];
      if (魂技槽位) skill.__魂技槽位 = 魂技槽位;
      return skill;
    };
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
    const 规范化战斗来源类别 = (来源 = '', 回退 = '魂技') => {
      const 文本 = String(来源 || '').trim();
      if (['武魂融合技', '自创魂技', '血脉技能', '气血魂技', '魂骨技能', '装备技能', '物品技能', '精神领域', '复制技能', '状态授予技能', '战术'].includes(文本)) return 文本;
      return String(回退 || '魂技').trim() || '魂技';
    };
    const 读取战斗动作来源上下文 = (动作 = {}, skill = null, 回退类别 = '魂技') => {
      const 来源类别 = String(动作?.category || 动作?.来源类别 || 读取战斗来源类别上下文(skill, 回退类别).来源类别 || 回退类别 || '魂技').trim() || '魂技';
      const 来源明细 = String(动作?.source_detail || 动作?.来源明细 || 读取战斗来源类别上下文(skill, 来源类别).来源明细 || 来源类别).trim() || 来源类别;
      return { 来源类别, 来源明细 };
    };
    const 战斗延迟回合原型集合 = new Set(['伤害结算', '护盾变化', '属性修正', '状态施加']);
    const 战斗原型允许延迟回合 = 原型 => 战斗延迟回合原型集合.has(String(原型 || '').trim());
    const BATTLE_PROTOTYPE_ARRAY_FIELDS = Object.freeze(['原型', '属性', '资源', '判定', '结算', '状态', '类型']);
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
    const 升灵台退出地点 = '传灵塔入口';
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
    const SOUL_TOWER_GUARDIAN_SPECIES_POOL = Object.freeze([
      '龙类',
      '蛛类',
      '熊类',
      '植物系',
      '海魂兽',
      '鸟类',
      '猫科',
      '蛇类',
    ]);
    const SOUL_SPIRIT_QUALITY_VALUES = Object.freeze(['F', 'D', 'C', 'B', 'A', 'S', 'S+']);
    const SOUL_SPIRIT_QUALITY_MULTIPLIER_MAP = Object.freeze({
      F: 0.82,
      D: 0.9,
      C: 1.0,
      B: 1.08,
      A: 1.18,
      S: 1.32,
      'S+': 1.48,
    });
    const SOUL_SPIRIT_QUALITY_LEVEL_OFFSET_MAP = Object.freeze({
      F: -6,
      D: -3,
      C: 0,
      B: 2,
      A: 5,
      S: 8,
      'S+': 12,
    });

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

    function 构建试炼状态补丁(试炼状态 = '') {
      return {
        op: 'add',
        path: '/world/战斗/试炼状态',
        value: String(试炼状态 || '').trim(),
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

    function isSoulTowerCombatTypeValue(combatType = '') {
      return String(combatType || '').trim() === '魂灵塔冲塔';
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

    function getSoulTowerGuardianQualityForFloor(floor = 1) {
      const meta = getSoulTowerGateMeta(floor);
      const steps = Array.isArray(meta.qualitySteps) && meta.qualitySteps.length ? meta.qualitySteps : ['C'];
      if (steps.length === 1) return steps[0];
      const progress = Math.max(0, Math.min(1, Number(meta.layerProgress || 0)));
      const index = Math.min(steps.length - 1, Math.floor(progress * steps.length));
      return steps[index] || steps[steps.length - 1];
    }

    function pickBattleSeedInt(min = 0, max = min) {
      const lo = Math.floor(Number(min));
      const hi = Math.floor(Number(max));
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) return 0;
      if (hi <= lo) return lo;
      return lo + Math.floor(Math.random() * (hi - lo + 1));
    }

    function buildSoulTowerGuardianAgeForFloor(floor = 1) {
      const meta = getSoulTowerGateMeta(floor);
      const minAge = Math.max(1, Math.floor(Number(meta.minAge || 1)));
      const maxAge = Math.max(minAge, Math.floor(Number(meta.maxAge || minAge)));
      if (meta.isGateBoss) return maxAge;
      const gateLength = Math.max(1, meta.gateEnd - meta.gateStart);
      const progress = Math.max(0, Math.min(1, Number(meta.layerProgress || 0)));
      const anchor = minAge + Math.round((maxAge - minAge) * progress);
      const bucket = Math.max(1, Math.floor((maxAge - minAge) / Math.max(2, gateLength + 1)));
      const variance = Math.max(0, Math.floor(bucket * 0.45));
      const offset = variance > 0 ? pickBattleSeedInt(-variance, variance) : 0;
      return Math.max(minAge, Math.min(maxAge, anchor + offset));
    }

    function buildSoulTowerGuardianSeed(floor = 1) {
      const meta = getSoulTowerGateMeta(floor);
      const species =
        SOUL_TOWER_GUARDIAN_SPECIES_POOL[Math.max(0, Math.min(SOUL_TOWER_GUARDIAN_SPECIES_POOL.length - 1, Math.floor(Math.random() * SOUL_TOWER_GUARDIAN_SPECIES_POOL.length)))] ||
        '龙类';
      const age = buildSoulTowerGuardianAgeForFloor(meta.floor);
      const quality = normalizeSoulSpiritQuality(getSoulTowerGuardianQualityForFloor(meta.floor)) || 'C';
      return {
        name: '',
        来源: '临时单位',
        单位性质: '魂兽',
        数量: 1,
        标准物种: species,
        年限: age,
        品质: quality,
      };
    }

    function buildSoulTowerDiscountSpiritRecordFromGuardian(unit = {}, floor = 1) {
      const species = String(unit?.标准物种 || '').trim();
      const age = Math.max(0, Math.floor(Number(unit?.年限 || 0)));
      const quality = normalizeSoulSpiritQuality(unit?.品质 || '');
      const 名称 = String(unit?.name || unit?.名称 || '').trim();
      if (!(species && age > 0 && quality)) return createEmptySoulTowerDiscountSpiritRecord();
      return {
        层数: Math.max(1, Math.floor(Number(floor) || 1)),
        名称: 名称 || `${species}魂灵`,
        标准物种: species,
        年限: age,
        品质: quality,
        已使用: false,
      };
    }

    function 获取升灵台结算队伍(combatData = {}, 默认角色名 = '') {
      const 队伍种子 = (combatData?.参战者?.team_player || []).filter(Boolean);
      const 队伍成员 = [];
      const 已收录 = new Set();
      const 加入成员 = 成员名 => {
        const safeName = String(成员名 || '').trim();
        if (!safeName) return;
        const 角色键 = 解析角色键(safeName);
        if (!角色键 || 已收录.has(角色键)) return;
        const 角色数据 = getMvuValue(`char.${角色键}`, null);
        if (!角色数据 || typeof 角色数据 !== 'object') return;
        已收录.add(角色键);
        队伍成员.push({
          角色键,
          角色名: String(角色数据.name || safeName || 角色键).trim() || 角色键,
          角色数据,
        });
      };
      队伍种子.forEach(成员 => {
        const 成员名 = String(成员?.name || 成员?.名称 || '').trim();
        if (!成员名) return;
        加入成员(成员名);
      });
      if (!队伍成员.length && 默认角色名) {
        加入成员(默认角色名);
      }
      return 队伍成员;
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
    const COMBAT_EFFECT_SCHEMA_TO_RUNTIME_KEY = {
      持续伤害: 'dot_damage',
      跳过回合: 'skip_turn',
      破防比例: 'armor_pen',
    };
    const COMBAT_EFFECT_BOOLEAN_KEYS = new Set([
      'skip_turn',
      'cannot_react',
      'silence',
      'disarm',
      'blind',
      'super_armor',
      '探查屏蔽',
    ]);
    const COMBAT_EFFECT_RUNTIME_DEFAULTS = {
      skip_turn: false,
      dot_damage: 0,
      armor_pen: 0,
    };
    const 时光回溯反应压制值 = 0.35;

    const 战斗阶段枚举_V1 = Object.freeze({
      无: '无',
      宣告: '宣告阶段',
      对轰判定: '对轰判定阶段',
      回合结算: '回合结算阶段',
    });
    const 战斗阶段合法值集合_V1 = new Set(Object.values(战斗阶段枚举_V1));

    function normalizeCombatStageValue(value, fallback = 战斗阶段枚举_V1.宣告) {
      const stage = String(value ?? '').trim();
      if (!stage) return fallback;
      if (战斗阶段合法值集合_V1.has(stage)) return stage;
      return fallback;
    }

    function coerceRuntimeCombatEffectValue(key, value, fallback) {
      if (COMBAT_EFFECT_BOOLEAN_KEYS.has(key)) return value === true;
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return fallback;
      return parsed;
    }

    function buildRuntimeStatRatioFromCondition(condition) {
      const runtimeMods = {};
      const rawRuntimeMods =
        condition?.面板修改比例 && typeof condition.面板修改比例 === 'object' && !Array.isArray(condition.面板修改比例)
          ? condition.面板修改比例
          : {};
      Object.entries(rawRuntimeMods).forEach(([key, value]) => {
        const runtimeKey = COMBAT_STAT_RATIO_SCHEMA_TO_RUNTIME_KEY[key] || key;
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return;
        runtimeMods[runtimeKey] = parsed;
      });

      const rawSchemaMods =
        condition?.面板倍率 && typeof condition.面板倍率 === 'object' && !Array.isArray(condition.面板倍率)
          ? condition.面板倍率
          : {};
      Object.entries(COMBAT_STAT_RATIO_SCHEMA_TO_RUNTIME_KEY).forEach(([schemaKey, runtimeKey]) => {
        const parsed = Number(rawSchemaMods[schemaKey]);
        if (!Number.isFinite(parsed)) return;
        runtimeMods[runtimeKey] = parsed;
      });

      return runtimeMods;
    }

    function 构建运行态属性固定修正(condition) {
      const 运行固定修正 = {};
      const 原始运行固定修正 =
        condition?.面板固定修正 && typeof condition.面板固定修正 === 'object' && !Array.isArray(condition.面板固定修正)
          ? condition.面板固定修正
          : {};
      Object.entries(原始运行固定修正).forEach(([键, 数值]) => {
        const 运行键 = 战斗属性固定修正结构键到运行键[键] || 键;
        const 解析值 = Number(数值);
        if (!Number.isFinite(解析值)) return;
        运行固定修正[运行键] = 解析值;
      });

      const 原始结构固定修正 =
        condition?.面板固定值 && typeof condition.面板固定值 === 'object' && !Array.isArray(condition.面板固定值)
          ? condition.面板固定值
          : {};
      Object.entries(战斗属性固定修正结构键到运行键).forEach(([结构键, 运行键]) => {
        const 解析值 = Number(原始结构固定修正[结构键]);
        if (!Number.isFinite(解析值)) return;
        运行固定修正[运行键] = 解析值;
      });

      return 运行固定修正;
    }

    function buildRuntimeCombatEffectsFromCondition(condition) {
      const normalized = BATTLE_RUNTIME.createEmptyCombatEffectMap();
      const rawEffects =
        condition?.战斗效果 && typeof condition.战斗效果 === 'object' && !Array.isArray(condition.战斗效果)
          ? condition.战斗效果
          : {};

      Object.keys(normalized).forEach(runtimeKey => {
        if (rawEffects[runtimeKey] === undefined) return;
        normalized[runtimeKey] = coerceRuntimeCombatEffectValue(
          runtimeKey,
          rawEffects[runtimeKey],
          normalized[runtimeKey],
        );
      });

      Object.entries(COMBAT_EFFECT_SCHEMA_TO_RUNTIME_KEY).forEach(([schemaKey, runtimeKey]) => {
        if (rawEffects[schemaKey] === undefined) return;
        normalized[runtimeKey] = coerceRuntimeCombatEffectValue(
          runtimeKey,
          rawEffects[schemaKey],
          COMBAT_EFFECT_RUNTIME_DEFAULTS[runtimeKey] ?? normalized[runtimeKey],
        );
      });

      return normalized;
    }

    function normalizeCombatConditionForRuntime(condition) {
      const source = sanitizeCombatPersistenceData(cloneBattleValue(condition || {}));
      const durationCandidate = source.duration !== undefined ? source.duration : source.持续回合;
      const durationParsed = Number(durationCandidate);
      const duration = Number.isFinite(durationParsed) ? Math.max(0, durationParsed) : 0;
      const layerParsed = Number(source.层数);
      return {
        ...source,
        类型: String(source.类型 || 'buff'),
        层数: Number.isFinite(layerParsed) ? layerParsed : 1,
        描述: String(source.描述 || '无'),
        duration,
        面板修改比例: buildRuntimeStatRatioFromCondition(source),
        面板固定修正: 构建运行态属性固定修正(source),
        战斗效果: buildRuntimeCombatEffectsFromCondition(source),
      };
    }

    function normalizeCombatConditionMapForRuntime(conditionMap) {
      if (!conditionMap || typeof conditionMap !== 'object' || Array.isArray(conditionMap)) return {};
      const normalized = {};
      Object.entries(conditionMap).forEach(([name, condition]) => {
        if (!name) return;
        normalized[name] = normalizeCombatConditionForRuntime(condition);
      });
      return normalized;
    }

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

    function queueSystemPrompt(text) {
      const prompt = String(text || '');
      root.__battlePendingSystemPrompt = prompt;
      try {
        root.dispatchEvent(new CustomEvent('battle-ui-system-prompt-ready', { detail: { systemPrompt: prompt } }));
      } catch (error) {
        console.warn('battle-ui-system-prompt-ready dispatch failed', error);
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
      root.__battleLastInjectedSystemPrompt = {
        prompt,
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
      return prompt;
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
      installFetchHook();
      installXHRHook();
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

    function normalizeBattleSkillNameMarks(text = '') {
      return String(text || '')
        .replace(/\[([^\[\]\n]{1,40})\]/g, (match, name) => {
          const trimmed = String(name || '').trim();
          if (!trimmed || /^(第\d+回合|状态|战损|主动|命中|未完全|战前|续推|单回合|行为|规划|候选|权重|前端|暗箱|防御|危机|实战|团战|连招|应招|起招|再判定|换招|脱离|撤离|护卫|缴械|元素|造物|召唤|资源|物品|状态结算|状态施加)/.test(trimmed)) return match;
          return `【${trimmed}】`;
        });
    }

    function normalizeBattleReportNameForMatch(text = '') {
      return String(text || '')
        .replace(/[【】\[\]\s]/g, '')
        .replace(/^(我方|敌方|玩家|NPC|同窗|目标)/, '')
        .trim();
    }

    function isSameBattleReportName(left = '', right = '') {
      const a = normalizeBattleReportNameForMatch(left);
      const b = normalizeBattleReportNameForMatch(right);
      return !!a && !!b && a === b;
    }

    function normalizeBattleActionDisplayName(name = '') {
      const text = String(name || '').replace(/^【|】$/g, '').trim();
      if (!text) return '';
      const actionKindLabels = {
        BASIC_ATTACK: '普通攻击',
        DEFEND: '防御',
        EVADE: '闪避',
        COUNTER: '反击',
        OBSERVE: '观察',
        GUARD: '保护队友',
        WITHDRAW: '撤退',
        RELEASE_SKILL: '释放魂技',
        USE_ITEM: '使用物品',
        EQUIP: '穿戴装备',
      };
      if (actionKindLabels[text]) return actionKindLabels[text];
      if (text === '常规攻击') return '普通攻击';
      if (text === '主动压迫') return '普通攻击';
      if (text === '肉体兜底') return '承伤硬抗';
      if (text === '硬抗') return '承伤硬抗';
      if (text === '系统反击') return '借势反打';
      if (/系统反击$/.test(text)) return text.replace(/系统反击$/, '借势反打');
      return text;
    }

    function isBattleTacticalFallbackAction(actionName = '') {
      return /承伤硬抗|肉体兜底|硬抗|防御|危机自保|收招转防|借力守势|坚壁反制|伺机闪避|闪避|撤离/.test(String(actionName || ''));
    }

    function 判定守势待机动作(actionName = '') {
      return /战术待机|待机|观察|防御|收招转防|守势维持|守势对峙|闪避|撤离|pass|observe|defend|stance|evade|withdraw/i.test(String(actionName || ''));
    }

    function 构建守势待机短句(actorName = '行动者', actionName = '行动') {
      const actor = String(actorName || '行动者').trim();
      const action = normalizeBattleActionDisplayName(actionName || '');
      if (/防御|收招转防|守势|承伤硬抗|肉体兜底|硬抗|危机自保|坚壁|defend|stance/i.test(action)) return `${actor}收住攻势，稳住身位`;
      if (/伺机闪避|闪避|evade/i.test(action)) return `${actor}侧身规避，保留反击余地`;
      if (/撤离|withdraw/i.test(action)) return `${actor}主动后撤，脱离当前交锋`;
      if (/观察|observe/i.test(action)) return `${actor}保持距离观察，稳住节奏`;
      return '';
    }

    function 映射玩家可见失败原因(reasonCode = '', rawReason = '') {
      const code = String(reasonCode || '').trim().toUpperCase();
      const reason = String(rawReason || '').trim();
      const byCode = {
        CAP_REACHED: '场面已满，造物已达上限',
        TARGET_LOST: '目标已失去有效落点',
        OUT_OF_MANA: '魂力不足',
        RESOURCE_NOT_ENOUGH: '魂力不足',
        RANGE_INVALID: '距离不满足',
        TARGET_INVALID: '目标非法',
        CONTROLLED: '行动被控制限制',
        SILENCED: '魂技被封锁',
        DISARMED: '出手条件受限',
        INTERRUPTED: '被对手截断',
        BLOCKED: '被对手压住节奏',
        NO_EFFECTIVE_OPENING: '战机已经消散',
        ACTION_COMMITTED: '攻击已经完成结算',
        REACTION_SUCCEEDED: '对方反应已经生效',
        NO_STRUCTURED_SETTLEMENT: '本次行动没有形成有效结算',
        UNKNOWN_REASON: '当前条件不满足',
      };
      if (byCode[code]) return byCode[code];
      if (/CAP_REACHED|达到上限|造物已达上限|场面已满/.test(reason)) return byCode.CAP_REACHED;
      if (/target_lost|TARGET_LOST|目标丢失|失去有效落点/i.test(reason)) return byCode.TARGET_LOST;
      if (/魂力不足|资源不足|OUT_OF_MANA|RESOURCE_NOT_ENOUGH/i.test(reason)) return byCode.OUT_OF_MANA;
      if (/距离不够|距离不足|RANGE_INVALID/i.test(reason)) return byCode.RANGE_INVALID;
      if (/目标非法|TARGET_INVALID/i.test(reason)) return byCode.TARGET_INVALID;
      if (/抢先压制|先手压制|行动受阻|被打断|interrupted|INTERRUPTED/i.test(reason)) return byCode.INTERRUPTED;
      if (/本回合对抗结束，未能形成有效出手|未能形成有效出手|被对手压住节奏|BLOCKED/i.test(reason)) return byCode.BLOCKED;
      if (/缺少可结算效果|未形成主动结算效果|没有形成主动结算效果|NO_EFFECTIVE_OPENING|no_effective_opening/i.test(reason)) return byCode.NO_EFFECTIVE_OPENING;
      return code ? '当前条件不满足' : '';
    }

    function 解析公开战报状态来源(rawLine = '', target = '', state = '', context = {}) {
      const raw = String(rawLine || '');
      const targetName = String(target || '').trim();
      const stateName = String(state || '').trim();
      const hits = Array.isArray(context?.hits) ? context.hits : [];
      const actionDeclarations = Array.isArray(context?.actionDeclarations) ? context.actionDeclarations : [];
      const openings = Array.isArray(context?.openings) ? context.openings : [];
      const registeredSource = 查找状态来源登记(context?.combatData || {}, {
        stateName,
        targetName,
        maxRound: Number(context?.round || 0),
      });
      if (registeredSource) {
        return {
          sourceRound: Math.max(0, Number(registeredSource.sourceRound || registeredSource.round || 0)),
          sourceActorName: String(registeredSource.sourceActorName || '').trim(),
          sourceActionName: normalizeBattleActionDisplayName(registeredSource.sourceActionName || ''),
          duration: Math.max(0, Number(registeredSource.duration || 0)),
          effectSummary: String(registeredSource.effectSummary || '').trim(),
          driverAttr: String(registeredSource.driverAttr || '').trim(),
        };
      }
      const sourceMatch = raw.match(/该状态由第(\d+)回合([^施。！？\s]+)施展【([^】]+)】附加/);
      if (sourceMatch) {
        return {
          sourceRound: Math.max(0, Number(sourceMatch[1] || 0)),
          sourceActorName: String(sourceMatch[2] || '').trim(),
          sourceActionName: normalizeBattleActionDisplayName(sourceMatch[3] || ''),
        };
      }
      const hit = hits.find(item => targetName && isSameBattleReportName(item?.target || '', targetName));
      if (hit?.actor || hit?.action) {
        return {
          sourceRound: Math.max(0, Number(context?.round || 0)),
          sourceActorName: String(hit?.actor || '').trim(),
          sourceActionName: normalizeBattleActionDisplayName(hit?.action || ''),
        };
      }
      const declaration = actionDeclarations.find(item =>
        item?.kind !== 'counter' &&
        targetName &&
        item?.target &&
        isSameBattleReportName(item.target, targetName)
      );
      if (declaration?.actor || declaration?.action) {
        return {
          sourceRound: Math.max(0, Number(context?.round || 0)),
          sourceActorName: String(declaration?.actor || '').trim(),
          sourceActionName: normalizeBattleActionDisplayName(declaration?.action || ''),
        };
      }
      if (openings.length === 1) {
        return {
          sourceRound: Math.max(0, Number(context?.round || 0)),
          sourceActorName: String(openings[0]?.actor || '').trim(),
          sourceActionName: normalizeBattleActionDisplayName(openings[0]?.action || ''),
        };
      }
      return { sourceActorName: '', sourceActionName: '' };
    }

    function 选择稳定战报短语(候选 = [], seedText = '') {
      const list = (Array.isArray(候选) ? 候选 : []).map(item => String(item || '').trim()).filter(Boolean);
      if (!list.length) return '';
      const seed = String(seedText || '').trim();
      let hash = 0;
      for (let i = 0; i < seed.length; i += 1) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
      return list[Math.abs(hash) % list.length] || list[0];
    }

    const BATTLE_PUBLIC_FLAVOR_TEMPLATES = {
      blockedAction: [
        '{actor}刚欲催动【{skill}】，便被对手压住节奏，未能完成出手',
        '{actor}的【{skill}】尚未铺开，便被这轮交锋截断',
      ],
      hitDodgeFailed: [
        '{attacker}施展【{skill}】压向{target}，{target}试图闪身避让却未能摆脱攻势，承受了 {damage} 点伤害',
        '{attacker}以【{skill}】逼近{target}，{target}仓促闪避未果，仍受了 {damage} 点伤害',
      ],
      hitPlain: [
        '{attacker}施展【{skill}】指向{target}，造成了 {damage} 点伤害',
        '{attacker}以【{skill}】压出攻势，令{target}承受了 {damage} 点伤害',
      ],
      counterHit: [
        '{counterActor}抓住{target}露出的破绽，以【{counterSkill}】进行反击，造成了 {damage} 点伤害',
        '{counterActor}趁{target}攻势露隙，以【{counterSkill}】反击，造成了 {damage} 点伤害',
      ],
      counterZero: [
        '{counterActor}抓住{target}露出的破绽，以【{counterSkill}】进行反击，但未能造成实质伤害',
        '{counterActor}尝试以【{counterSkill}】反打{target}，但这次没有打出实质伤害',
      ],
      stateResisted: [
        '{target}抵住了【{state}】的附着',
        '【{state}】试图侵入{target}，却未能附着',
      ],
      stateTickDamage: [
        '{target}随后受【{state}】影响，损失了 {amount} 点{resource}{sourceText}',
        '回合流转间，【{state}】在{target}身上发作，令其损失 {amount} 点{resource}{sourceText}',
      ],
      stateTickHeal: [
        '{target}随后受【{state}】影响，恢复了 {amount} 点{resource}{sourceText}',
        '回合流转间，【{state}】为{target}带来恢复，使其回复 {amount} 点{resource}{sourceText}',
      ],
      create: [
        '{actor}趁隙催动【{skill}】{detail}',
        '{actor}催动【{skill}】在战场上凝结造物{detail}',
      ],
      hitGraze: [
        '{target}避开要害，却仍被【{skill}】余波擦中，受到 {damage} 点擦伤伤害',
        '{target}勉强卸开【{skill}】正锋，仍被余劲扫中，受到 {damage} 点擦伤伤害',
      ],
    };

    function 填充战报润色模板(template = '', data = {}) {
      return String(template || '').replace(/\{([a-zA-Z]+)\}/g, (_, key) => String(data?.[key] ?? '').trim()).replace(/\s+/g, ' ').trim();
    }

    function 选择战报润色模板(scene = '', data = {}, seedText = '') {
      const templates = BATTLE_PUBLIC_FLAVOR_TEMPLATES[scene] || [];
      const required = Array.isArray(data?.__required) ? data.__required : [];
      if (!templates.length || required.some(key => !String(data?.[key] ?? '').trim())) return '';
      return 填充战报润色模板(选择稳定战报短语(templates, seedText), data);
    }

    function 构建公开战报状态抵抗短句(event = {}, seedText = '') {
      const target = String(event?.targetName || '目标').trim();
      const state = 读取事件账本状态名(event);
      if (事件账本状态被免疫(event)) return `${target}免疫了【${state || '状态'}】`;
      return 选择战报润色模板('stateResisted', {
        target,
        state,
        __required: ['target', 'state'],
      }, seedText || `${event?.round || event?.sourceRound || 0}|stateResisted|${event?.actionId || event?.sourceActionId || ''}|${target}|${state}`);
    }

    function 构建公开战报失败短句(event = {}, round = 0) {
      const actor = String(event?.actorName || '行动者').trim();
      const action = normalizeBattleActionDisplayName(event?.finalActionName || event?.actionName || event?.sourceActionName || '');
      const reason = String(event?.failReason || event?.failureReason || event?.meta?.failureReason || '').trim();
      const outcome = String(event?.primaryOutcome || event?.meta?.primaryOutcome || '').trim();
      const reasonCode = String(event?.reasonCode || event?.meta?.reasonCode || '').trim();
      const actionText = `${action} ${event?.actionType || ''} ${event?.type || ''}`;
      const 是守势空过动作 = 判定守势待机动作(actionText);
      if (
        是守势空过动作 &&
        (
          outcome === 'no_effect' ||
          reasonCode === 'NO_EFFECTIVE_OPENING' ||
          /缺少可结算效果|未形成主动结算效果|没有形成主动结算效果|no_effective_opening|NO_EFFECTIVE_OPENING/.test(reason)
        )
      ) {
        if (!/观察|observe|防御|收招转防|守势|defend|stance/i.test(actionText)) return '';
        return 构建守势待机短句(actor, actionText);
      }
      const mappedReason = 映射玩家可见失败原因(reasonCode, reason);
      if (outcome === 'cap_reached' || reasonCode === 'CAP_REACHED' || mappedReason === '场面已满，造物已达上限') {
        return `${actor}${action ? `的【${action}】` : ''}未能展开：${mappedReason || '场面已满，造物已达上限'}`;
      }
      if (String(event?.actionType || '').trim() === 'summon_control') {
        const summonName = String(event?.meta?.summonName || event?.actorName || '召唤物').trim();
        const hostName = String(event?.meta?.summonHostName || event?.targetName || '').trim();
        const restriction = String(event?.meta?.restriction || event?.result || '').trim();
        const prefix = hostName ? `${hostName}精神负载不足，` : '精神负载不足，';
        if (/dissipated|消散/.test(restriction)) return `${prefix}${summonName}的控制链断裂，被迫消散`;
        if (/recalled|回收/.test(restriction)) return `${prefix}${summonName}的控制链收紧，被强制回收`;
        if (/overload_compressed|compressed|压缩|超载/.test(restriction)) return `${prefix}${summonName}的行动被压缩，暂时无法稳定执行指令`;
        if (/skill_limited|limited|受限/.test(restriction)) return `${prefix}${summonName}的行动受限，只能维持最低限度响应`;
        return `${prefix}${summonName}的控制链受限，未能稳定响应指令`;
      }
      if (mappedReason === '目标已失去有效落点') {
        const target = String(event?.targetName || event?.meta?.declaredTargetName || '原目标').trim();
        return `${actor}${action ? `的【${action}】` : ''}原本锁定${target}，但目标已失去有效落点，本次行动取消`;
      }
      if (mappedReason === '被对手压住节奏') {
        return 选择战报润色模板('blockedAction', {
          actor,
          skill: action,
          __required: ['actor', 'skill'],
        }, `${round || event?.round || event?.sourceRound || 0}|blocked|${event?.actionId || event?.sourceActionId || ''}|${actor}|${action}`) || `${actor}${action ? `的【${action}】` : ''}被对手压住节奏，未能完成出手`;
      }
      if (mappedReason === '被对手截断') {
        return `${actor}${action ? `的【${action}】` : ''}被对手截断，未能完成出手`;
      }
      if (mappedReason === '战机已经消散') {
        return `${actor}${action ? `的【${action}】` : ''}战机已经消散，动作收束`;
      }
      if (mappedReason) {
        return `${actor}${action ? `的【${action}】` : ''}未能完成出手：${mappedReason}`;
      }
      return `${actor}${action ? `的【${action}】` : ''}未能完成出手`;
    }

    function 判定公开战报事件是内部兜底(event = {}) {
      const kind = String(event?.eventKind || '').trim();
      const action = normalizeBattleActionDisplayName(event?.finalActionName || event?.actionName || event?.sourceActionName || '');
      const actionType = String(event?.actionType || event?.type || '').trim();
      const reason = String(event?.failReason || event?.failureReason || event?.reasonText || event?.meta?.reasonText || event?.meta?.failureReason || '').trim();
      const source = String(event?.meta?.source || event?.source || '').trim();
      if (event?.playerAction === true || event?.meta?.playerAction === true || event?.meta?.source === 'player') return false;
      if (String(event?.actorSide || event?.meta?.actorSide || '').trim() === 'player') return false;
      if (kind === 'pass' && /observe|stance_hold/.test(String(event?.result || ''))) return false;
      if (['blocked_action', 'failed_action', 'target_fail'].includes(kind)) {
        if (/CAP_REACHED|达到上限|造物已达上限|场面已满/.test(`${reason} ${event?.reasonCode || event?.meta?.reasonCode || ''}`)) return false;
        if (/战术待机|待机|观察|守势维持|守势对峙|收招转防|防御/.test(action) && /未形成主动结算效果|NO_EFFECTIVE_OPENING|no_effective_opening|没有形成主动结算效果|缺少可结算效果|稳住身位/.test(reason)) return false;
        if (/auto_actor|ai_fallback|internal|system/i.test(source)) return true;
        if (/缺少可结算效果/.test(reason) && /auto|fallback|战术待机|观察|收招转防/.test(`${source} ${actionType} ${action}`)) return true;
      }
      return false;
    }

    function 读取战报事件Outcome(event = {}) {
      const explicit = String(event?.primaryOutcome || event?.meta?.primaryOutcome || '').trim();
      if (explicit) return explicit;
      const kind = String(event?.eventKind || '').trim();
      const result = String(event?.result || event?.meta?.result || '').trim();
      if (kind === 'hit_result') {
        if (/graze|chip|擦伤/.test(result)) return 'graze';
        if (/critical|暴击/.test(result)) return 'critical';
        if (/miss|evade|dodge|未命中|闪避/.test(result)) return 'dodged';
        return 读取事件账本数值(event, 'damage') > 0 ? 'full_hit' : 'no_effect';
      }
      if (kind === 'state_apply') {
        if (事件账本状态被免疫(event)) return 'state_immune';
        if (事件账本状态被抵抗(event)) return 'state_resisted';
        return 'state_applied';
      }
      if (kind === 'state_tick') return 'state_tick';
      if (kind === 'summon_assist') return 'summon_action';
      if (kind === 'create') return 'item_created';
      if (kind === 'summon_create') return 'summon_created';
      if (kind === 'resource_change' || kind === 'round_recover') return 'resource_recovered';
      if (kind === 'blocked_action') return 'interrupted';
      if (kind === 'failed_action' || kind === 'target_fail') return /CAP_REACHED|达到上限|造物已达上限|场面已满/.test(`${event?.reasonCode || ''} ${event?.failReason || ''}`) ? 'cap_reached' : 'interrupted';
      return 'no_effect';
    }

    function 事件账本状态已附着(event = {}) {
      const result = String(event?.result || event?.meta?.result || '').trim();
      return !result || /applied|success|生效|附着|施加/.test(result);
    }

    function 事件账本状态被抵抗(event = {}) {
      return /resist|resisted|抵抗|豁免|未附着/.test(String(event?.result || event?.meta?.result || '').trim());
    }

    function 事件账本状态被免疫(event = {}) {
      return /immune|immunity|免疫|无视异常/.test(String(event?.result || event?.meta?.result || '').trim());
    }

    function formatBattleReactionPhrase(actor = '', action = '') {
      const actorName = String(actor || '防守方').trim();
      const actionName = normalizeBattleActionDisplayName(action);
      if (
        !actionName ||
        actionName === '无' ||
        /无暇反应|无法反应|无反应|来不及反应/.test(actionName)
      ) {
        return 选择稳定战报短语([
          `令${actorName}猝不及防`,
          `令${actorName}无暇招架`,
          `${actorName}一时难以规避`,
        ], `${actorName}|${actionName}|no-reaction`) || `令${actorName}猝不及防`;
      }
      if (/伺机闪避|闪避/.test(actionName)) {
        return 选择稳定战报短语([
          `${actorName}以【${actionName}】闪身避让`,
          `${actorName}借【${actionName}】迅速拉开步点`,
          `${actorName}借【${actionName}】抢先侧身周旋`,
        ], `${actorName}|${actionName}|dodge`) || `${actorName}以【${actionName}】闪身避让`;
      }
      if (/肉体兜底/.test(actionName)) return `${actorName}兜住攻势，承压寻找反打窗口`;
      if (/承伤硬抗|硬抗/.test(actionName)) return `${actorName}收缩防线，顶住这轮攻势`;
      if (/防御|危机自保|收招转防|借力守势|坚壁反制/.test(actionName)) return `${actorName}转入防御，稳住防线`;
      if (actionName) {
        return 选择稳定战报短语([
          `${actorName}以一招【${actionName}】强硬应对`,
          `${actorName}以【${actionName}】从容周旋`,
          `${actorName}借【${actionName}】稳住局面`,
        ], `${actorName}|${actionName}|generic-action`) || `${actorName}以【${actionName}】从容周旋`;
      }
      return 选择稳定战报短语([
        `${actorName}见状迅速稳住阵脚`,
        `${actorName}急忙调动魂力护体`,
        `${actorName}在千钧一发之际做出反应`,
      ], `${actorName}|generic-reaction`) || `${actorName}见状迅速稳住阵脚`;
    }

    function 读取战报日志回合号(raw = '', fallbackRound = 0) {
      const match = String(raw || '').match(/[【\[]第(\d+)回合[】\]]|第(\d+)回合[：:]|[【\[]团战第(\d+)回合开始[】\]]/);
      return Math.max(0, Number(match?.[1] || match?.[2] || match?.[3] || fallbackRound || 0));
    }

    function 查找战报上下文单位(context = {}, name = '') {
      const targetName = String(name || '').trim();
      if (!targetName) return null;
      const combatData = context?.combatData && typeof context.combatData === 'object' ? context.combatData : context;
      const participants = combatData?.参战者 && typeof combatData.参战者 === 'object' ? combatData.参战者 : {};
      const pools = [
        ...(Array.isArray(participants.team_player) ? participants.team_player : []),
        ...(Array.isArray(participants.team_enemy) ? participants.team_enemy : []),
        ...(Array.isArray(participants.player_team) ? participants.player_team : []),
        ...(Array.isArray(participants.enemy_team) ? participants.enemy_team : []),
        ...(Array.isArray(combatData?.units) ? combatData.units : []),
        ...(Array.isArray(context?.units) ? context.units : []),
      ];
      return pools.find(unit => isSameBattleReportName(getCombatReportUnitName(unit), targetName)) || null;
    }

    function 按名称解析角色战斗魂技_战报(unit = {}, name = '') {
      const query = normalizeBattleActionDisplayName(name || '');
      if (!unit || typeof unit !== 'object' || !query) return null;
      const matched = BATTLE_DECISION.collectSkills(unit).find(skill => {
        const names = [
          skill?.name,
          skill?.魂技名,
          skill?.技能名称,
          skill?.__魂技槽位,
        ].map(item => normalizeBattleActionDisplayName(item || '')).filter(Boolean);
        return names.some(item => item === query || isSameBattleReportName(item, query));
      });
      return matched || null;
    }

    function 读取战报伤害烈度文本(hit = {}, totalDamage = 0, context = {}) {
      const targetName = String(hit?.target || '').trim();
      const target = 查找战报上下文单位(context, targetName);
      if (!target) return '';
      const maxHp = Math.max(1, Number(BATTLE_PREVIEW.readHpMax(target) || 0));
      if (!(maxHp > 1)) return '';
      const ratio = Math.max(0, Number(totalDamage || 0)) / maxHp;
      if (ratio >= 0.6) return '，几乎将其逼入濒危边缘';
      if (ratio >= 0.3) return '，瞬间撕开其防线，令其遭到重创';
      if (ratio >= 0.12) return '，令其闷哼一声，身形明显受创';
      if (ratio > 0 && ratio < 0.05) return '，只在其身上留下一道轻微擦伤';
      return '';
    }

    function 构建公开战报状态附加短句(items = [], options = {}) {
      const text = String(格式化状态附着补充文本(items, options) || '').trim();
      if (!text) return '';
      return text;
    }

    function 构建公开战报状态来源短句(item = {}, options = {}) {
      const sourceActor = String(item.sourceActorName || item.actorName || '').trim();
      const sourceAction = normalizeBattleActionDisplayName(item.sourceActionName || item.actionName || '');
      const sourceRound = Math.max(0, Number(item.sourceRound || item.round || 0));
      const duration = Math.max(0, Number(item.duration || item.持续回合 || 0));
      const sourceParts = [];
      if (sourceActor && sourceAction && sourceRound > 0) sourceParts.push(`该状态由第${sourceRound}回合${sourceActor}施展【${sourceAction}】附加`);
      if (duration > 0) sourceParts.push(`持续${duration}回合`);
      if (!sourceParts.length) return '';
      if (options?.plainText === true) return '';
      const detailParts = [];
      const effectSummary = String(item.effectSummary || '').trim();
      const driverAttr = String(item.driverAttr || '').trim();
      if (effectSummary) detailParts.push(`效果：${effectSummary}`);
      if (driverAttr) detailParts.push(`驱动属性：${driverAttr}`);
      const title = detailParts.join(' | ');
      return `<span class="combat-subtext"${title ? ` title="${htmlEscapeText(title)}"` : ''}>（${htmlEscapeText(sourceParts.join('，'))}）</span>`;
    }

    function 构建公开战报反击短句(actorName = '', actionName = '', targetName = '', damage = 0) {
      const actor = String(actorName || '反击方').trim();
      const action = normalizeBattleActionDisplayName(actionName || '') || '反击';
      const target = String(targetName || '对手').trim();
      const damageValue = Math.max(0, Number(damage || 0));
      return damageValue > 0
        ? `${actor}抓住${target}露出的破绽，以【${action}】进行反击，造成了 ${damageValue} 点伤害`
        : `${actor}抓住${target}露出的破绽，以【${action}】进行反击，但未能造成实质伤害`;
    }

    function 合并回合伤害文本(hits = [], context = {}) {
      const list = (Array.isArray(hits) ? hits : []).filter(item => item?.damage > 0);
      if (!list.length) return '';
      const total = list.reduce((sum, item) => sum + Math.max(0, Number(item.damage || 0)), 0);
      const actor = String(list[0]?.actor || '攻击方').trim();
      const target = String(list[0]?.target || '目标').trim();
      const severity = 读取战报伤害烈度文本(list[0], total, context);
      if (list.length > 1) return `${actor}连续${list.length}次命中${target}，共造成 ${total} 点伤害${severity}`;
      return `${actor}对${target}造成了 ${total} 点伤害${severity}`;
    }

    function 判定战报动作是待机守势(action = '') {
      return /战术待机|待机|观察|守势维持|守势对峙|防御|危机自保|承伤硬抗|硬抗|肉体兜底|闪避|伺机闪避|撤离/.test(normalizeBattleActionDisplayName(action));
    }

    function 构建起招战报开头(opening = {}, target = '') {
      const actor = String(opening?.actor || '行动者').trim();
      const action = normalizeBattleActionDisplayName(opening?.action || '');
      const targetName = String(target || '敌方目标').trim();
      if (/战术待机|待机|观察|守势维持|守势对峙/.test(action)) return `${actor}稳住阵脚，观察${targetName}的动向`;
      if (/承伤硬抗|硬抗|肉体兜底/.test(action)) return `${actor}收缩自身防线，稳住身位`;
      if (/防御|危机自保/.test(action)) return `${actor}转入防御，收缩自身防线`;
      if (/闪避|伺机闪避/.test(action)) return `${actor}以【${action}】拉开身位，避开正面碰撞`;
      if (/撤离/.test(action)) return `${actor}尝试【${action}】，寻找脱离战场的窗口`;
      return `${actor}施展【${action || '行动'}】指向${targetName}`;
    }

    function 格式化位移战报文本(items = []) {
      const list = (Array.isArray(items) ? items : []).map(item => String(item?.text || '').trim()).filter(Boolean);
      if (!list.length) return '';
      return list
        .slice(0, 2)
        .map(text => {
          if (/换位/.test(text)) return `位置变化生效，${text.replace(/^换位/, '换位')}`;
          if (/未生效|未成立|缺少/.test(text)) return `位移尝试未能完全成立，${text}`;
          return `身位变化生效，${text}`;
        })
        .join('；');
    }

    function 格式化造物战报文本(items = []) {
      const list = (Array.isArray(items) ? items : []).map(item => String(item?.text || '').trim()).filter(Boolean);
      if (!list.length) return '';
      return list.slice(0, 2).map(text => (/^[^，。！？\s]+以【[^】]+】/.test(text) ? text : `造物凝成：${text}`)).join('；');
    }

    function 格式化状态标签HTML(state = '', extras = '', options = {}) {
      const 状态名 = String(state || '').trim();
      if (!状态名) return '';
      const 提示 = String(extras || '').trim();
      if (options?.plainText === true) return `【${状态名}】`;
      return `<span class="combat-state-tag"${提示 ? ` title="${htmlEscapeText(提示)}"` : ''}>【${htmlEscapeText(状态名)}】</span>`;
    }

    function 格式化状态附着补充文本(items = [], options = {}) {
      const list = (Array.isArray(items) ? items : []).filter(item => item && item.state && item.target);
      if (!list.length) return '';
      const seen = new Set();
      const groups = new Map();
      list.filter(item => {
        const key = `${normalizeBattleReportNameForMatch(item.target)}|${String(item.state || '').trim()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 3).forEach(item => {
        const target = String(item.target || '').trim();
        if (!groups.has(target)) groups.set(target, []);
        groups.get(target).push(item);
      });
      return Array.from(groups.entries()).map(([target, group]) => {
        const states = group.map(item => {
          const state = String(item.state || '').trim();
          const duration = Math.max(0, Number(item.duration || item.持续回合 || 0));
          const effectSummary = String(item.effectSummary || '').trim();
          const driverAttr = String(item.driverAttr || '').trim();
          const extras = [
            duration > 0 ? `持续${duration}回合` : '',
            effectSummary ? `效果：${effectSummary}` : '',
            driverAttr ? `驱动属性：${driverAttr}` : '',
          ].filter(Boolean).join('，');
          const 状态标签 = 格式化状态标签HTML(state, extras, { plainText: options?.plainText === true });
          const 次级说明 = options?.plainText === true && duration > 0 ? `（持续${duration}回合）` : '';
          return `${状态标签}${options?.plainText === true ? 次级说明 : ''}`;
        }).filter(Boolean);
        if (!states.length) return '';
        return `${group.length > 1 ? '这一击同时令' : '这一击令'}${target}陷入${states.join('与')}`;
      }).filter(Boolean).join('；');
    }

    function 规范化状态附着断句(line = '') {
      return String(line || '')
        .replace(/，(这一击(?:同时)?令)/g, '。$1')
        .replace(/；(这一击(?:同时)?令)/g, '。$1')
        .replace(/。+/g, '。')
        .replace(/。；/g, '。');
    }

    function 规范化公开战报连续回合(lines = []) {
      return (Array.isArray(lines) ? lines : [])
        .map(line => String(line || '').trim())
        .filter(Boolean);
    }

    function 归一战斗事件记录(item = {}, patch = {}) {
      const eventKind = String(patch.eventKind || item.eventKind || '').trim();
      const factType = BATTLE_RUNTIME.inferFactType(eventKind, { ...item, ...patch });
      const effectPrototype = BATTLE_RUNTIME.inferEffectPrototype(eventKind, { ...item, ...patch });
      const normalized = {
        eventId: String(patch.eventId || item.eventId || '').trim(),
        eventKind,
        round: Number(patch.round || item.round || 0),
        actorName: String(patch.actorName || item.actorName || item.actor || '').trim(),
        actorSide: String(patch.actorSide || item.actorSide || item.side || item.meta?.actorSide || item.meta?.side || '').trim(),
        targetName: String(patch.targetName || item.targetName || item.target || '').trim(),
        targetSide: String(patch.targetSide || item.targetSide || item.meta?.targetSide || '').trim(),
        targetId: String(patch.targetId || item.targetId || item.targetKey || item.target_id || '').trim(),
        targetIds: BATTLE_RUNTIME.normalizeTargetIds(
          patch.targetIds,
          item.targetIds,
          patch.targetId || item.targetId || item.targetKey || item.target_id,
          patch.targetName || item.targetName || item.target,
        ),
        targetScope: String(patch.targetScope || item.targetScope || item.meta?.targetScope || '').trim(),
        actionName: normalizeBattleActionDisplayName(patch.actionName || item.actionName || item.meta?.actionName || item.skillName || item.meta?.skillName || item.action || ''),
        initialActionName: normalizeBattleActionDisplayName(patch.initialActionName || item.initialActionName || item.meta?.initialActionName || item.actionName || item.meta?.actionName || item.skillName || item.meta?.skillName || item.action || ''),
        finalActionName: normalizeBattleActionDisplayName(patch.finalActionName || item.finalActionName || item.meta?.finalActionName || item.actionName || item.meta?.actionName || item.skillName || item.meta?.skillName || item.action || ''),
        discardedActionName: normalizeBattleActionDisplayName(patch.discardedActionName || item.discardedActionName || item.meta?.discardedActionName || ''),
        actionType: String(patch.actionType || item.actionType || '').trim(),
        actorControl: BATTLE_RUNTIME.normalizeActorControl(patch.actorControl || item.actorControl || item.meta?.actorControl, 'AI'),
        actionRole: BATTLE_RUNTIME.normalizeActionRole(patch.actionRole || item.actionRole || item.meta?.actionRole || BATTLE_RUNTIME.inferActionRole({ ...item, ...patch, eventKind })),
        actionId: String(patch.actionId || item.actionId || '').trim(),
        sourceActionName: normalizeBattleActionDisplayName(patch.sourceActionName || item.sourceActionName || item.meta?.sourceActionName || ''),
        sourceActionId: String(patch.sourceActionId || item.sourceActionId || '').trim(),
        sourceRound: Number(patch.sourceRound || item.sourceRound || 0),
        chainNodeId: String(patch.chainNodeId || item.chainNodeId || '').trim(),
        parentNodeId: String(patch.parentNodeId || item.parentNodeId || '').trim(),
        sourceNodeId: String(patch.sourceNodeId || item.sourceNodeId || '').trim(),
        reactionNodeId: String(patch.reactionNodeId || item.reactionNodeId || item.meta?.reactionNodeId || item.meta?.reactionWindowNodeId || '').trim(),
        ruleCode: String(patch.ruleCode || item.ruleCode || patch.reasonCode || item.reasonCode || item.meta?.ruleCode || item.meta?.reasonCode || '').trim().toUpperCase(),
        result: String(patch.result || item.result || '').trim(),
        resultState: String(patch.resultState || item.resultState || patch.result || item.result || patch.actionStatus || item.actionStatus || patch.primaryOutcome || item.primaryOutcome || eventKind).trim(),
        factType,
        effectPrototype,
        sourceEffectId: String(patch.sourceEffectId || item.sourceEffectId || patch.meta?.sourceEffectId || item.meta?.sourceEffectId || '').trim(),
        failReason: String(patch.failReason || item.failReason || '').trim(),
        primaryOutcome: String(patch.primaryOutcome || item.primaryOutcome || item.meta?.primaryOutcome || '').trim(),
        failureReason: String(patch.failureReason || item.failureReason || item.failReason || item.meta?.failureReason || '').trim(),
        reasonCode: String(patch.reasonCode || item.reasonCode || item.meta?.reasonCode || '').trim(),
        reasonText: String(patch.reasonText || item.reasonText || item.meta?.reasonText || '').trim(),
        replanReasonCode: String(patch.replanReasonCode || item.replanReasonCode || item.meta?.replanReasonCode || '').trim(),
        replanReasonText: String(patch.replanReasonText || item.replanReasonText || item.meta?.replanReasonText || '').trim(),
        targetPoolSide: String(patch.targetPoolSide || item.targetPoolSide || '').trim(),
        applicationId: String(patch.applicationId || item.applicationId || '').trim(),
        duration: Math.max(0, Number(patch.duration || item.duration || 0)),
        effectSummary: String(patch.effectSummary || item.effectSummary || '').trim(),
        driverAttr: String(patch.driverAttr || item.driverAttr || '').trim(),
        meta: patch.meta && typeof patch.meta === 'object' ? patch.meta : (item.meta && typeof item.meta === 'object' ? item.meta : {}),
      };
      const actionStatus = String(patch.actionStatus || item.actionStatus || item.meta?.actionStatus || '').trim();
      if (actionStatus && /action|hit_result|state_apply|resource_change|create|summon|shield|blocked|failed|target_fail/.test(eventKind)) {
        normalized.actionStatus = actionStatus;
      }
      if (['hit_result', 'counter', 'state_tick'].includes(eventKind)) {
        normalized.appliedDamage = Math.max(0, Number(patch.appliedDamage ?? item.appliedDamage ?? patch.damage ?? item.damage ?? patch.meta?.appliedDamage ?? item.meta?.appliedDamage ?? patch.meta?.damage ?? item.meta?.damage ?? 0) || 0);
        normalized.damage = Math.max(0, Number(patch.damage ?? item.damage ?? patch.appliedDamage ?? item.appliedDamage ?? patch.meta?.damage ?? item.meta?.damage ?? patch.meta?.appliedDamage ?? item.meta?.appliedDamage ?? 0) || 0);
      }
      if (eventKind === 'hit_result') {
        normalized.effectCapability = (() => {
          const capability = patch.effectCapability && typeof patch.effectCapability === 'object'
            ? patch.effectCapability
            : (item.effectCapability && typeof item.effectCapability === 'object'
              ? item.effectCapability
              : (patch.meta?.effectCapability && typeof patch.meta.effectCapability === 'object'
                ? patch.meta.effectCapability
                : (item.meta?.effectCapability && typeof item.meta.effectCapability === 'object' ? item.meta.effectCapability : null)));
          if (!capability) return null;
          return {
            hasDamageEffect: capability.hasDamageEffect === true,
            effectKinds: Array.isArray(capability.effectKinds)
              ? capability.effectKinds.map(kind => String(kind || '').trim()).filter(Boolean).slice(0, 12)
              : [],
          };
        })();
      }
      const requiredContractKeys = new Set(['targetIds', 'actorControl', 'actionRole', 'sourceActionId', 'parentNodeId', 'reactionNodeId', 'ruleCode', 'resultState', 'factType']);
      Object.keys(normalized).forEach(key => {
        if (requiredContractKeys.has(key)) return;
        if (normalized[key] === '' || normalized[key] === null) delete normalized[key];
      });
      if (normalized.meta && typeof normalized.meta === 'object' && !Object.keys(normalized.meta).length) {
        delete normalized.meta;
      }
      return normalized;
    }

    function 读取事件账本状态名(event = {}) {
      return String(event?.stateName || event?.meta?.stateName || '').trim();
    }

    function 读取事件账本数值(event = {}, key = '') {
      if (['damage', 'finalDamage', 'appliedDamage'].includes(String(key || '').trim())) {
        const value = Number(event?.appliedDamage ?? event?.meta?.appliedDamage ?? event?.[key] ?? event?.meta?.[key] ?? 0);
        return Number.isFinite(value) ? value : 0;
      }
      return Number(event?.[key] ?? event?.meta?.[key] ?? 0);
    }

    function 格式化事件账本防御短语(event = {}) {
      const actor = String(event?.actorName || '防守方').trim();
      const action = normalizeBattleActionDisplayName(event?.actionName || '');
      if (!actor) return '';
      if (!action || action === '无' || /无暇反应|无法反应|无反应|来不及反应/.test(action)) {
        return 选择稳定战报短语([
          `令${actor}猝不及防`,
          `令${actor}无暇招架`,
          `${actor}一时难以规避`,
        ], `${actor}|${action}|ledger-no-reaction`) || `令${actor}猝不及防`;
      }
      if (/闪避|伺机闪避/.test(action) || event?.eventKind === 'dodge') {
        return /evaded|miss|dodge_success|闪避成功|未命中/.test(String(event?.result || '').trim())
          ? `${actor}闪身避让`
          : `${actor}试图闪身避让`;
      }
      if (/肉体兜底/.test(action)) return `${actor}兜住攻势，承压寻找反打窗口`;
      if (/承伤硬抗|硬抗/.test(action)) return `${actor}收缩防线，顶住这轮攻势`;
      if (/防御|危机自保|收招转防|借力守势|坚壁反制/.test(action) || event?.eventKind === 'defend') return `${actor}转入防御，稳住防线`;
      if (action) return `${actor}以【${action}】从容周旋`;
      return `${actor}见状迅速稳住阵脚`;
    }

    function 构建公开战报文本块(content = '', source = {}) {
      const text = String(content || '').trim();
      if (!text) return null;
      const block = { type: 'text', content: text };
      const sourceEventId = String(source?.eventId || source?.sourceEventId || '').trim();
      const sourceNodeId = String(source?.chainNodeId || source?.nodeId || source?.sourceNodeId || '').trim();
      if (sourceEventId) block.sourceEventId = sourceEventId;
      if (sourceNodeId) block.sourceNodeId = sourceNodeId;
      const sourceEventIds = Array.isArray(source?.sourceEventIds)
        ? source.sourceEventIds.map(id => String(id || '').trim()).filter(Boolean)
        : [];
      const sourceNodeIds = Array.isArray(source?.sourceNodeIds)
        ? source.sourceNodeIds.map(id => String(id || '').trim()).filter(Boolean)
        : [];
      if (sourceEventIds.length) block.sourceEventIds = [...new Set(sourceEventIds)];
      if (sourceNodeIds.length) block.sourceNodeIds = [...new Set(sourceNodeIds)];
      return block;
    }

    function 构建公开战报Badge块(kind = '', payload = {}) {
      const badgeKind = String(kind || '').trim();
      if (!badgeKind) return null;
      const block = {
        type: 'badge',
        kind: badgeKind,
        targetId: String(payload.targetId || '').trim(),
        targetName: String(payload.targetName || '').trim(),
        isSelf: payload.isSelf === true,
        sourceEventId: String(payload.sourceEventId || '').trim(),
        sourceNodeId: String(payload.sourceNodeId || '').trim(),
      };
      if (payload.value !== undefined) block.value = Number(payload.value || 0);
      if (payload.unit) block.unit = String(payload.unit || '').trim();
      if (payload.name) block.name = String(payload.name || '').trim();
      return block;
    }

    function 应用公开战报Badge错落(entry = {}) {
      const blocks = Array.isArray(entry?.blocks) ? entry.blocks : [];
      const animatedBadges = blocks.filter(block =>
        block &&
        block.type === 'badge' &&
        ['damage', 'heal', 'resource'].includes(String(block.kind || '').trim())
      );
      if (animatedBadges.length < 2) return entry;
      animatedBadges.forEach((block, index) => {
        block.delayMs = Math.min(600, index * 120);
        block.delayQueue = 'battle_badge_stagger';
      });
      entry.badgeDelayQueue = 'battle_badge_stagger';
      return entry;
    }

    function 序列化公开战报Blocks(blocks = []) {
      return (Array.isArray(blocks) ? blocks : [])
        .map(block => {
          if (!block || typeof block !== 'object') return '';
          if (block.type === 'text') return String(block.content || '').trim();
          if (block.type === 'badge') {
            if (block.kind === 'damage') return `${Number(block.value || 0)} ${block.unit || 'HP'}`;
            if (block.kind === 'heal') return `+${Math.max(0, Number(block.value || 0))} ${block.unit || 'HP'}`;
            if (block.kind === 'resource') return `${Number(block.value || 0) > 0 ? '+' : ''}${Math.round(Number(block.value || 0))} ${block.unit || block.name || '资源'}`;
            if (['item_created', 'summon_created', 'creation', 'cap_reached'].includes(block.kind)) {
              const name = String(block.name || (block.kind === 'cap_reached' ? '上限' : '造物生成')).trim();
              const value = Math.max(0, Math.round(Number(block.value || 0)));
              return block.kind === 'cap_reached' ? `【${name}】` : `${value > 0 ? `+${value} ` : ''}${name}`;
            }
            if (block.name) return `【${block.name}】`;
          }
          return '';
        })
        .filter(Boolean)
        .join(' ')
        .trim();
    }

    function 归一公开战报Block条目(item = {}) {
      const blocks = Array.isArray(item?.blocks) ? item.blocks : (Array.isArray(item) ? item : []);
      if (!blocks.length) return null;
      const text = 序列化公开战报Blocks(blocks);
      if (!text) return null;
      return {
        ...item,
        blocks,
        text,
      };
    }

    function 构建状态Tick公开战报Block条目(eventLedger = []) {
      const events = (Array.isArray(eventLedger) ? eventLedger : [])
        .filter(event => String(event?.eventKind || '').trim() === 'state_tick');
      if (!events.length) return [];
      const 读取状态Tick来源文本 = event => {
        const meta = event?.meta && typeof event.meta === 'object' ? event.meta : {};
        const sourceActor = String(meta.sourceActorName || event?.actorName || '').trim();
        const sourceAction = String(meta.sourceActionName || event?.sourceActionName || event?.actionName || '').trim();
        const sourceRound = Number(meta.sourceRound || event?.sourceRound || 0);
        if (!sourceActor || !sourceAction || !(sourceRound > 0)) return '';
        return `（该状态由第${sourceRound}回合${sourceActor}施展【${sourceAction}】附加）`;
      };
      const byRound = new Map();
      events.forEach(event => {
        const round = Math.max(0, Number(event?.round || event?.sourceRound || 0));
        if (!byRound.has(round)) byRound.set(round, []);
        byRound.get(round).push(event);
      });
      const entries = [];
      [...byRound.entries()].sort((left, right) => Number(left[0] || 0) - Number(right[0] || 0)).forEach(([round, roundEvents]) => {
        const prefix = round > 0 ? `第${round}回合：` : '';
        const groups = new Map();
        roundEvents.forEach(item => {
          const state = 读取事件账本状态名(item) || '持续状态';
          const resource = String(item?.meta?.resource || '生命值').trim();
          const isHeal = String(item?.result || '').includes('恢复');
          const key = `${state}|${resource}|${isHeal ? 'heal' : 'damage'}`;
          if (!groups.has(key)) groups.set(key, { state, resource, isHeal, sourceText: '', items: [] });
          groups.get(key).items.push(item);
        });
        groups.forEach(grouped => {
          const sourceTexts = [...new Set(grouped.items.map(读取状态Tick来源文本).filter(Boolean))];
          grouped.sourceText = sourceTexts.length === 1 ? sourceTexts[0] : '';
          let text = '';
          if (grouped.items.length >= 2) {
            const total = grouped.items.reduce((sum, item) => sum + Math.max(0, 读取事件账本数值(item, 'amount')), 0);
            const targets = grouped.items.map(item => String(item.targetName || '目标').trim()).filter(Boolean);
            const targetText = targets.length >= 2 ? `${targets.length} 个目标` : targets.join('、');
            text = `${prefix}回合收束，${targetText || '场上目标'}共${grouped.isHeal ? '恢复' : '损失'} ${total} 点${grouped.resource}，来源为【${grouped.state}】${grouped.sourceText}。`;
          } else {
            const item = grouped.items[0];
            const target = String(item?.targetName || '目标').trim();
            const amount = Math.max(0, 读取事件账本数值(item, 'amount'));
            const flavored = 选择战报润色模板(grouped.isHeal ? 'stateTickHeal' : 'stateTickDamage', {
              target,
              state: grouped.state,
              amount,
              resource: grouped.resource,
              sourceText: grouped.sourceText,
              __required: ['target', 'state', 'amount', 'resource'],
            }, `${round}|stateTick|${target}|${grouped.state}|${amount}|${grouped.resource}|${grouped.isHeal ? 'heal' : 'damage'}`);
            text = `${prefix}${flavored || `${target}随后受【${grouped.state}】影响，${grouped.isHeal ? '恢复' : '损失'}了 ${amount} 点${grouped.resource}${grouped.sourceText}`}。`;
          }
          const sourceEventIds = grouped.items.map(item => String(item?.eventId || '').trim()).filter(Boolean);
          const sourceNodeIds = grouped.items.map(item => String(item?.chainNodeId || '').trim()).filter(Boolean);
          const textBlock = 构建公开战报文本块(text, {
            ...(grouped.items[0] || {}),
            sourceEventIds,
            sourceNodeIds,
          });
          if (textBlock) textBlock.projectionSource = 'state_tick_ast';
          const blocks = [textBlock].filter(Boolean);
          grouped.items.forEach(item => {
            const amount = Math.max(0, 读取事件账本数值(item, 'amount'));
            if (amount <= 0) return;
            const isHpResource = /生命值|HP|气血|血量/.test(grouped.resource);
            blocks.push(构建公开战报Badge块(isHpResource ? (grouped.isHeal ? 'heal' : 'damage') : 'resource', {
              value: isHpResource ? (grouped.isHeal ? amount : -amount) : (grouped.isHeal ? amount : -amount),
              unit: isHpResource ? 'HP' : grouped.resource,
              name: grouped.resource,
              targetName: String(item?.targetName || '').trim(),
              targetId: String(item?.targetId || '').trim(),
              sourceEventId: String(item?.eventId || '').trim(),
              sourceNodeId: String(item?.chainNodeId || '').trim(),
            }));
          });
          entries.push({ round, blocks, text: 序列化公开战报Blocks(blocks) || text, projectionSource: 'state_tick_ast' });
        });
      });
      return entries;
    }

    function 构建召唤生成公开战报Block条目(eventLedger = []) {
      const events = (Array.isArray(eventLedger) ? eventLedger : [])
        .filter(event => String(event?.eventKind || '').trim() === 'summon_create');
      if (!events.length) return [];
      const groups = new Map();
      events.forEach(event => {
        const round = Math.max(0, Number(event?.round || event?.sourceRound || 0));
        const actor = String(event?.actorName || '行动者').trim();
        const action = normalizeBattleActionDisplayName(event?.actionName || event?.sourceActionName || '召唤');
        const key = `${round}|${actor}|${action}`;
        if (!groups.has(key)) groups.set(key, { round, actor, action, items: [] });
        groups.get(key).items.push(event);
      });
      return [...groups.values()].sort((left, right) => Number(left.round || 0) - Number(right.round || 0)).map(group => {
        const prefix = group.round > 0 ? `第${group.round}回合：` : '';
        const summonText = group.items.map(item => {
          const summonName = String(item?.meta?.summonName || item?.summonName || '召唤物').trim();
          const summonType = String(item?.meta?.summonType || item?.summonType || '召唤单位').trim();
          const summonMode = String(item?.meta?.summonMode || item?.summonMode || '协同攻击').trim();
          const mentalLoad = Math.max(0, Math.round(Number(item?.meta?.mentalLoad ?? item?.mentalLoad ?? 0)));
          const loadText = mentalLoad > 0 ? `，精神负载 ${mentalLoad}` : '';
          const timingText = summonMode === '协同攻击'
            ? '，本动作结束时即可协同攻击'
            : summonMode === '护卫'
              ? '，生成后立即可以护卫拦截'
              : '，从下一次自身行动轴开始行动';
          return `召出${summonType}【${summonName}】。行动模式：${summonMode}${loadText}${timingText}`;
        }).filter(Boolean).join('；');
        const text = `${prefix}${group.actor}施展【${group.action || '召唤'}】，${summonText}。`;
        const sourceEventIds = group.items.map(item => String(item?.eventId || '').trim()).filter(Boolean);
        const sourceNodeIds = group.items.map(item => String(item?.chainNodeId || '').trim()).filter(Boolean);
        const textBlock = 构建公开战报文本块(text, {
          ...(group.items[0] || {}),
          sourceEventIds,
          sourceNodeIds,
        });
        if (textBlock) textBlock.projectionSource = 'summon_create_ast';
        const blocks = [textBlock].filter(Boolean);
        return { round: group.round, blocks, text: 序列化公开战报Blocks(blocks) || text, projectionSource: 'summon_create_ast' };
      });
    }

    function 构建护盾生成公开战报Block条目(eventLedger = []) {
      const events = (Array.isArray(eventLedger) ? eventLedger : [])
        .filter(event => String(event?.eventKind || '').trim() === 'shield_create');
      if (!events.length) return [];
      const groups = new Map();
      events.forEach(event => {
        const round = Math.max(0, Number(event?.round || event?.sourceRound || 0));
        const actor = String(event?.actorName || '行动者').trim();
        const action = normalizeBattleActionDisplayName(event?.actionName || event?.sourceActionName || '护盾');
        const key = `${round}|${actor}|${action}`;
        if (!groups.has(key)) groups.set(key, { round, actor, action, items: [] });
        groups.get(key).items.push(event);
      });
      return [...groups.values()].sort((left, right) => Number(left.round || 0) - Number(right.round || 0)).map(group => {
        const prefix = group.round > 0 ? `第${group.round}回合：` : '';
        const shieldText = group.items.map(item => {
          const amount = Math.max(0, 读取事件账本数值(item, 'amount'));
          const targetName = String(item?.targetName || group.actor).trim() || group.actor;
          if (isSameBattleReportName(targetName, group.actor)) return amount > 0 ? `为自身张开 ${amount} 点护盾` : '稳住自身防线';
          return amount > 0 ? `为${targetName}张开 ${amount} 点护盾` : `为${targetName}稳住防线`;
        }).filter(Boolean).join('；');
        const text = `${prefix}${group.actor}${shieldText ? `施展【${group.action || '护盾'}】，${shieldText}` : '转入防御，稳住防线'}。`;
        const sourceEventIds = group.items.map(item => String(item?.eventId || '').trim()).filter(Boolean);
        const sourceNodeIds = group.items.map(item => String(item?.chainNodeId || '').trim()).filter(Boolean);
        const textBlock = 构建公开战报文本块(text, {
          ...(group.items[0] || {}),
          sourceEventIds,
          sourceNodeIds,
        });
        if (textBlock) textBlock.projectionSource = 'shield_create_ast';
        const blocks = [textBlock].filter(Boolean);
        group.items.forEach(item => {
          const amount = Math.max(0, 读取事件账本数值(item, 'amount'));
          if (amount <= 0) return;
          const targetName = String(item?.targetName || group.actor).trim() || group.actor;
          blocks.push(构建公开战报Badge块('shield', {
            value: amount,
            targetName,
            targetId: String(item?.targetId || '').trim(),
            sourceEventId: String(item?.eventId || '').trim(),
            sourceNodeId: String(item?.chainNodeId || '').trim(),
          }));
        });
        return { round: group.round, blocks, text: 序列化公开战报Blocks(blocks) || text, projectionSource: 'shield_create_ast' };
      });
    }

    function 构建命中结算公开战报Block条目(eventLedger = []) {
      const events = (Array.isArray(eventLedger) ? eventLedger : [])
        .map(item => item && typeof item === 'object' ? item : null)
        .filter(Boolean);
      if (!events.length) return [];
      const byRound = new Map();
      events.forEach(event => {
        const round = Math.max(0, Number(event?.round || event?.sourceRound || 0));
        if (!byRound.has(round)) byRound.set(round, []);
        byRound.get(round).push(event);
      });
      const entries = [];
      const sameActionFact = (event = {}, actionEvent = {}) => {
        const actionId = String(actionEvent?.actionId || '').trim();
        if (!actionId) return false;
        return String(event?.actionId || '').trim() === actionId ||
          String(event?.sourceActionId || '').trim() === actionId;
      };
      [...byRound.entries()].sort((left, right) => Number(left[0] || 0) - Number(right[0] || 0)).forEach(([round, roundEvents]) => {
        const prefix = round > 0 ? `第${round}回合：` : '';
        const starts = roundEvents.filter(item => item.eventKind === 'action_start');
        const hits = roundEvents.filter(item =>
          item.eventKind === 'hit_result' &&
          !/^(counter|行为防反)$/.test(String(item.actionType || '').trim()) &&
          !/行为防反|系统反击|counter/i.test(String(item.actionName || ''))
        );
        const defenses = roundEvents.filter(item => ['dodge', 'defend', 'pass'].includes(String(item.eventKind || '').trim()));
        const counters = roundEvents.filter(item => item.eventKind === 'counter');
        const appliedStates = roundEvents.filter(item => item.eventKind === 'state_apply' && 事件账本状态已附着(item));
        const resistedStates = roundEvents.filter(item => item.eventKind === 'state_apply' && (事件账本状态被抵抗(item) || 事件账本状态被免疫(item)));
        hits.forEach(hit => {
          const actor = String(hit.actorName || '攻击方').trim();
          const target = String(hit.targetName || '目标').trim();
          const action = normalizeBattleActionDisplayName(hit.finalActionName || hit.actionName || starts.find(item => isSameBattleReportName(item.actorName, actor))?.actionName || '');
          const start = starts.find(item =>
            sameActionFact(hit, item) ||
            (isSameBattleReportName(item.actorName, actor) &&
              (!item.targetName || !target || isSameBattleReportName(item.targetName, target)) &&
              (!action || normalizeBattleActionDisplayName(item.actionName || '') === action))
          );
          const defense = defenses.find(item =>
            target &&
            isSameBattleReportName(item.actorName, target) &&
            (!start?.actionId || String(item.sourceActionId || '').trim() === String(start.actionId || '').trim())
          ) || defenses.find(item => target && isSameBattleReportName(item.actorName, target));
          const damage = Math.max(0, 读取事件账本数值(hit, 'damage'));
          const relatedStates = appliedStates.filter(item =>
            sameActionFact(item, start || hit) ||
            (isSameBattleReportName(item.targetName, target) &&
              (!item.actorName || !actor || isSameBattleReportName(item.actorName, actor)) &&
              (!item.sourceActionName || !action || normalizeBattleActionDisplayName(item.sourceActionName) === action))
          );
          const stateText = 构建公开战报状态附加短句(relatedStates.map(item => ({
            target: item.targetName,
            state: 读取事件账本状态名(item),
            duration: item.duration,
            effectSummary: item.effectSummary,
            driverAttr: item.driverAttr,
          })), { plainText: true });
          const resistedStateText = resistedStates.filter(item =>
            sameActionFact(item, start || hit) ||
            (isSameBattleReportName(item.targetName, target) &&
              (!item.actorName || !actor || isSameBattleReportName(item.actorName, actor)) &&
              (!item.sourceActionName || !action || normalizeBattleActionDisplayName(item.sourceActionName) === action))
          ).map(item => 构建公开战报状态抵抗短句(item, `${round}|stateResisted|${item.actionId || item.sourceActionId || ''}|${target}|${读取事件账本状态名(item)}`))
            .filter(Boolean)
            .filter((text, index, list) => list.indexOf(text) === index)
            .join('；');
          const hitActionId = String(hit.actionId || hit.sourceActionId || start?.actionId || '').trim();
          const relatedCounters = counters.filter(item => {
            if (String(item.result || '').trim() === 'fail') return false;
            if (!hitActionId || String(item.sourceActionId || '').trim() !== hitActionId) return false;
            return (
              isSameBattleReportName(item.actorName, target) &&
              isSameBattleReportName(item.targetName, actor)
            ) || String(item?.meta?.counterWindowNodeId || '').trim();
          });
          const relatedSecondCounters = relatedCounters.flatMap(counter => counters.filter(item =>
            Number(item?.meta?.counterDepth || 0) >= 2 &&
            isSameBattleReportName(item.actorName, actor) &&
            isSameBattleReportName(item.targetName, counter.actorName) &&
            (
              String(item.sourceNodeId || '').trim() === String(counter.chainNodeId || '').trim() ||
              String(item.parentNodeId || '').trim() === String(counter.chainNodeId || '').trim() ||
              String(item.sourceActionId || '').trim() === String(counter.actionId || '').trim()
            )
          ));
          const 查找防反命中事实 = counterEvent => {
            const counterAction = normalizeBattleActionDisplayName(counterEvent?.actionName || '');
            const counterDamage = Math.max(0, 读取事件账本数值(counterEvent, 'damage'));
            if (!counterAction || !(counterDamage > 0)) return null;
            return roundEvents.find(item =>
              String(item?.eventKind || '').trim() === 'hit_result' &&
              /^(counter|行为防反)$/.test(String(item?.actionType || '').trim()) &&
              normalizeBattleActionDisplayName(item?.actionName || item?.sourceActionName || '') === counterAction &&
              isSameBattleReportName(item?.actorName || '', counterEvent?.actorName || '') &&
              isSameBattleReportName(item?.targetName || '', counterEvent?.targetName || '') &&
              Math.max(0, 读取事件账本数值(item, 'damage')) === counterDamage
            ) || null;
          };
          const counterText = relatedCounters
            .map(item => {
              const counterAction = normalizeBattleActionDisplayName(item.actionName || '反击');
              const counterDamage = Math.max(0, 读取事件账本数值(item, 'damage'));
              return 选择战报润色模板(counterDamage > 0 ? 'counterHit' : 'counterZero', {
                counterActor: String(item.actorName || '').trim(),
                counterSkill: counterAction,
                target: String(item.targetName || '').trim(),
                damage: counterDamage,
                __required: ['counterActor', 'counterSkill', 'target'],
              }, `${round}|counter|${item.actionId || item.sourceActionId || ''}|${item.actorName}|${item.targetName}|${counterAction}|${counterDamage}`) || 构建公开战报反击短句(item.actorName, counterAction, item.targetName, counterDamage);
            })
            .filter((text, index, list) => list.indexOf(text) === index)
            .join('；');
          const secondCounterText = relatedSecondCounters
            .map(item => {
              const counterAction = normalizeBattleActionDisplayName(item.actionName || '反防反');
              const counterDamage = Math.max(0, 读取事件账本数值(item, 'damage'));
              return `${String(item.actorName || '攻方').trim()}顺势反压，以【${counterAction}】反防反${String(item.targetName || '目标').trim()}${counterDamage > 0 ? `，造成了 ${counterDamage} 点伤害` : '，但未能造成实质伤害'}`;
            })
            .filter((text, index, list) => list.indexOf(text) === index)
            .join('；');
          const pieces = [];
          const assistEvent = String(hit.actionType || '').trim() === 'summon_assist'
            ? roundEvents.find(item =>
                String(item?.eventKind || '').trim() === 'summon_assist' &&
                isSameBattleReportName(item.actorName || '', actor) &&
                isSameBattleReportName(item.targetName || '', target) &&
                normalizeBattleActionDisplayName(item.actionName || '') === action &&
                (!item.meta?.summonHitEventId || String(item.meta.summonHitEventId || '').trim() === String(hit.eventId || '').trim())
              )
            : null;
          const dodgeFullySucceeded = defense?.eventKind === 'dodge' &&
            (/evaded|miss|dodge_success|闪避成功|未命中/.test(String(defense.result || '').trim()) || /miss|evade|dodge|闪避|未命中/.test(String(hit.result || '')));
          const dodgeTriedAndFailed = defense?.eventKind === 'dodge' && !dodgeFullySucceeded && damage > 0;
          const outcome = 读取战报事件Outcome(hit);
          const seed = `${round}|hit|${actor}|${target}|${action}|${damage}|${outcome}|${defense?.eventKind || ''}|${defense?.result || ''}`;
          const flavoredHit = assistEvent && damage > 0
            ? `${actor}承接${String(assistEvent.meta?.hostName || assistEvent.meta?.summonHostName || '宿主').trim()}的攻势，以【${action || '协同追击'}】协同追击${target}，造成了 ${damage} 点伤害`
            : outcome === 'graze' && damage > 0
              ? 选择战报润色模板('hitGraze', {
                  target,
                  skill: action || '行动',
                  damage,
                  __required: ['target', 'skill', 'damage'],
                }, seed) || `${target}避开要害，却仍被【${action || '行动'}】余波擦中，受到 ${damage} 点擦伤伤害`
            : damage > 0
              ? 选择战报润色模板(dodgeTriedAndFailed ? 'hitDodgeFailed' : 'hitPlain', {
                  attacker: actor,
                  target,
                  skill: action || '行动',
                  damage,
                  __required: ['attacker', 'target', 'skill', 'damage'],
                }, seed)
              : '';
          if (flavoredHit) pieces.push(flavoredHit);
          else pieces.push(`${actor}施展【${action || '行动'}】指向${target}`);
          if (defense) {
            const phrase = 格式化事件账本防御短语(defense);
            if (phrase && !flavoredHit) pieces.push(phrase);
            if (defense.eventKind === 'dodge') {
              if (dodgeFullySucceeded) pieces.push('闪避成功，这一击没有命中');
              else if ((damage > 0 || stateText) && !flavoredHit) pieces.push('未能摆脱这轮压制');
            }
          }
          if (damage > 0 && !flavoredHit) pieces.push(`${actor}对${target}造成了 ${damage} 点伤害`);
          else if (!(damage > 0) && !pieces.some(text => /没有命中|未能造成/.test(text))) pieces.push('这次交锋未造成实质伤害');
          if (stateText) pieces.push(stateText);
          if (resistedStateText) pieces.push(resistedStateText);
          if (counterText) pieces.push(`随后${counterText}`);
          if (secondCounterText) pieces.push(`紧接着${secondCounterText}`);
          const text = 规范化状态附着断句(`${prefix}${pieces.join('，').replace(/，随后/g, '；随后')}。`);
          const relatedCounterHits = relatedCounters.map(查找防反命中事实).filter(Boolean);
          const relatedSecondCounterHits = relatedSecondCounters.map(查找防反命中事实).filter(Boolean);
          const sourceItems = [start, hit, defense, assistEvent, ...relatedStates, ...relatedCounters, ...relatedSecondCounters, ...relatedCounterHits, ...relatedSecondCounterHits].filter(Boolean);
          const sourceEventIds = sourceItems.map(item => String(item?.eventId || '').trim()).filter(Boolean);
          const sourceNodeIds = sourceItems.map(item => String(item?.chainNodeId || '').trim()).filter(Boolean);
          const textBlock = 构建公开战报文本块(text, {
            ...(hit || {}),
            sourceEventIds,
            sourceNodeIds,
          });
          if (textBlock) textBlock.projectionSource = 'hit_result_ast';
          const blocks = [textBlock].filter(Boolean);
          if (damage > 0) {
            blocks.push(构建公开战报Badge块('damage', {
              value: -damage,
              unit: 'HP',
              targetName: target,
              targetId: String(hit?.targetId || '').trim(),
              sourceEventId: String(hit?.eventId || '').trim(),
              sourceNodeId: String(hit?.chainNodeId || '').trim(),
            }));
          }
          relatedStates.forEach(item => {
            const stateName = 读取事件账本状态名(item);
            if (!stateName) return;
            blocks.push(构建公开战报Badge块('state', {
              name: stateName,
              targetName: String(item?.targetName || target).trim(),
              targetId: String(item?.targetId || '').trim(),
              sourceEventId: String(item?.eventId || '').trim(),
              sourceNodeId: String(item?.chainNodeId || '').trim(),
            }));
          });
          relatedCounters.forEach(item => {
            const counterDamage = Math.max(0, 读取事件账本数值(item, 'damage'));
            if (counterDamage <= 0) return;
            const counterHit = 查找防反命中事实(item);
            if (!counterHit) return;
            blocks.push(构建公开战报Badge块('damage', {
              value: -counterDamage,
              unit: 'HP',
              targetName: String(item?.targetName || actor).trim(),
              targetId: String(counterHit?.targetId || item?.targetId || '').trim(),
              sourceEventId: String(counterHit?.eventId || '').trim(),
              sourceNodeId: String(counterHit?.chainNodeId || '').trim(),
            }));
          });
          relatedSecondCounters.forEach(item => {
            const counterDamage = Math.max(0, 读取事件账本数值(item, 'damage'));
            if (counterDamage <= 0) return;
            const counterHit = 查找防反命中事实(item);
            if (!counterHit) return;
            blocks.push(构建公开战报Badge块('damage', {
              value: -counterDamage,
              unit: 'HP',
              targetName: String(item?.targetName || '').trim(),
              targetId: String(counterHit?.targetId || item?.targetId || '').trim(),
              sourceEventId: String(counterHit?.eventId || '').trim(),
              sourceNodeId: String(counterHit?.chainNodeId || '').trim(),
            }));
          });
          entries.push({ round, blocks, text: 序列化公开战报Blocks(blocks) || text, projectionSource: 'hit_result_ast' });
        });
      });
      return entries;
    }

    function 构建状态附着公开战报Block条目(eventLedger = [], context = {}) {
      const events = (Array.isArray(eventLedger) ? eventLedger : [])
        .map(item => item && typeof item === 'object' ? item : null)
        .filter(Boolean);
      if (!events.length) return [];
      const hits = events.filter(item => String(item?.eventKind || '').trim() === 'hit_result');
      const starts = events.filter(item => String(item?.eventKind || '').trim() === 'action_start');
      const defenses = events.filter(item => ['dodge', 'defend', 'pass'].includes(String(item?.eventKind || '').trim()));
      const sameActionFact = (event = {}, actionEvent = {}) => {
        const actionId = String(actionEvent?.actionId || '').trim();
        if (!actionId) return false;
        return String(event?.actionId || '').trim() === actionId ||
          String(event?.sourceActionId || '').trim() === actionId;
      };
      const hasHitForState = (stateEvent = {}) => hits.some(hit =>
        sameActionFact(stateEvent, hit) ||
        (isSameBattleReportName(hit.actorName || '', stateEvent.actorName || '') &&
          isSameBattleReportName(hit.targetName || '', stateEvent.targetName || '') &&
          (!stateEvent.sourceActionName || normalizeBattleActionDisplayName(hit.actionName || '') === normalizeBattleActionDisplayName(stateEvent.sourceActionName || '')))
      );
      const stateEvents = events.filter(item =>
        String(item?.eventKind || '').trim() === 'state_apply' &&
        !hasHitForState(item)
      );
      if (!stateEvents.length) return [];
      const groups = new Map();
      stateEvents.forEach(event => {
        const round = Math.max(0, Number(event?.round || event?.sourceRound || 0));
        const actor = String(event?.actorName || '行动者').trim();
        const action = normalizeBattleActionDisplayName(event?.actionName || event?.sourceActionName || '行动');
        const target = String(event?.targetName || '').trim();
        const key = `${round}|${actor}|${action}|${target}`;
        if (!groups.has(key)) groups.set(key, { round, actor, action, target, items: [] });
        groups.get(key).items.push(event);
      });
      const entries = [];
      [...groups.values()].sort((left, right) => Number(left.round || 0) - Number(right.round || 0)).forEach(group => {
        const start = starts.find(item =>
          isSameBattleReportName(item.actorName || '', group.actor) &&
          (!group.action || normalizeBattleActionDisplayName(item.actionName || '') === group.action)
        );
        const target = group.target || String(start?.targetName || 读取战报默认敌对名(context, group.actor)).trim();
        const stateList = group.items.filter(item => 事件账本状态已附着(item));
        const resistedList = group.items.filter(item => 事件账本状态被抵抗(item) || 事件账本状态被免疫(item));
        const defense = defenses.find(item =>
          target &&
          isSameBattleReportName(item.actorName, target) &&
          (!start?.actionId || String(item.sourceActionId || '').trim() === String(start.actionId || '').trim())
        ) || defenses.find(item => target && isSameBattleReportName(item.actorName, target));
        const stateText = 构建公开战报状态附加短句(stateList.map(item => ({
          target: item.targetName,
          state: 读取事件账本状态名(item),
          duration: item.duration,
          effectSummary: item.effectSummary,
          driverAttr: item.driverAttr,
        })), { plainText: true });
        const stateOnlyText = stateText
          .replace(/^这一击同时令/, '这股魂力同时令')
          .replace(/^这一击令/, '这股魂力令')
          .replace(/造成/g, '带来');
        const resistedStateText = resistedList
          .map(item => 构建公开战报状态抵抗短句(item, `${group.round}|stateResisted|${item.actionId || item.sourceActionId || ''}|${item.targetName}|${读取事件账本状态名(item)}`))
          .filter(Boolean)
          .filter((text, index, list) => list.indexOf(text) === index)
          .join('；');
        if (!stateText && !resistedStateText) return;
        const prefix = group.round > 0 ? `第${group.round}回合：` : '';
        const parts = [`${group.actor}施展【${group.action || '行动'}】笼向${target}`];
        if (defense) {
          const phrase = 格式化事件账本防御短语(defense);
          if (phrase) parts.push(phrase);
          if (/闪避/.test(String(defense.actionName || ''))) {
            if (/evaded|miss|dodge_success|闪避成功|未命中/.test(String(defense.result || '').trim())) parts.push('闪避成功，这一击没有命中');
            else if (stateText || resistedStateText) parts.push('未能摆脱这轮压制');
          } else if (/承伤硬抗|肉体兜底|硬抗/.test(String(defense.actionName || ''))) {
            parts.push((stateText || resistedStateText) ? '强运魂力冲撞压制' : '收缩防线，勉强扛住了这轮压制');
          } else {
            parts.push((stateText || resistedStateText) ? '在无形压迫下调整身位' : '稳住身位，暂未被压垮');
          }
        }
        const actionText = parts.join('，');
        const outcomeText = [stateOnlyText, resistedStateText]
          .filter(Boolean)
          .join('；');
        const text = 规范化状态附着断句(`${prefix}${actionText}${outcomeText ? `。${outcomeText}` : ''}。`);
        const sourceItems = [start, defense, ...group.items].filter(Boolean);
        const sourceEventIds = sourceItems.map(item => String(item?.eventId || '').trim()).filter(Boolean);
        const sourceNodeIds = sourceItems.map(item => String(item?.chainNodeId || '').trim()).filter(Boolean);
        const textBlock = 构建公开战报文本块(text, {
          ...(group.items[0] || {}),
          sourceEventIds,
          sourceNodeIds,
        });
        if (textBlock) textBlock.projectionSource = 'state_apply_ast';
        const blocks = [textBlock].filter(Boolean);
        stateList.forEach(item => {
          const stateName = 读取事件账本状态名(item);
          if (!stateName) return;
          blocks.push(构建公开战报Badge块('state', {
            name: stateName,
            targetName: String(item?.targetName || target).trim(),
            targetId: String(item?.targetId || '').trim(),
            sourceEventId: String(item?.eventId || '').trim(),
            sourceNodeId: String(item?.chainNodeId || '').trim(),
          }));
        });
        entries.push({ round: group.round, blocks, text: 序列化公开战报Blocks(blocks) || text, projectionSource: 'state_apply_ast' });
      });
      return entries;
    }

    function 构建失败动作公开战报Block条目(eventLedger = []) {
      const entries = [];
      (Array.isArray(eventLedger) ? eventLedger : [])
        .filter(item => item && typeof item === 'object')
        .filter(item => ['target_fail', 'failed_action', 'blocked_action'].includes(String(item?.eventKind || '').trim()))
        .filter(item => !判定公开战报事件是内部兜底(item))
        .forEach(event => {
          const round = Math.max(0, Number(event?.round || event?.sourceRound || 0));
          const prefix = round > 0 ? `第${round}回合：` : '';
          const failureText = 构建公开战报失败短句(event, round).replace(/[。！？\s]+$/g, '');
          if (!failureText) return;
          const text = `${prefix}${failureText}。`;
          const textBlock = 构建公开战报文本块(text, event);
          if (textBlock) textBlock.projectionSource = 'failure_ast';
          const blocks = [textBlock].filter(Boolean);
          if (读取战报事件Outcome(event) === 'cap_reached') {
            blocks.push(构建公开战报Badge块('cap_reached', {
              name: '造物上限',
              targetName: String(event?.actorName || '').trim(),
              sourceEventId: String(event?.eventId || '').trim(),
              sourceNodeId: String(event?.chainNodeId || '').trim(),
            }));
          }
          if (!blocks.length) return;
          entries.push({ round, blocks, text: 序列化公开战报Blocks(blocks) || text, projectionSource: 'failure_ast' });
      });
      return entries;
    }

    function 构建资源变化公开战报Block条目(eventLedger = []) {
      const entries = [];
      (Array.isArray(eventLedger) ? eventLedger : [])
        .filter(item => item && typeof item === 'object')
        .filter(item => String(item?.eventKind || '').trim() === 'resource_change')
        .forEach(event => {
          const round = Math.max(0, Number(event?.round || event?.sourceRound || 0));
          const prefix = round > 0 ? `第${round}回合：` : '';
          const resource = String(event?.meta?.resource || event?.resource || '资源').trim();
          const delta = Number(event?.meta?.delta ?? event?.delta ?? event?.amount ?? event?.meta?.amount ?? 0);
          if (!resource || !delta) return;
          const targetName = String(event?.targetName || event?.actorName || '目标').trim();
          const mode = String(event?.meta?.transferMode || event?.meta?.reason || '').trim();
          const modeText = mode ? `（${mode}）` : '';
          const verb = delta > 0 ? '恢复' : '消耗';
          const text = `${prefix}${targetName}的${resource}${verb} ${Math.abs(Math.round(delta))} 点${modeText}。`;
          const textBlock = 构建公开战报文本块(text, event);
          if (textBlock) textBlock.projectionSource = 'resource_change_ast';
          const blocks = [textBlock].filter(Boolean);
          blocks.push(构建公开战报Badge块(/生命值|HP|气血|血量/.test(resource) ? (delta > 0 ? 'heal' : 'damage') : 'resource', {
            value: /生命值|HP|气血|血量/.test(resource)
              ? (delta > 0 ? Math.abs(Math.round(delta)) : -Math.abs(Math.round(delta)))
              : Math.round(delta),
            unit: /生命值|HP|气血|血量/.test(resource) ? 'HP' : resource,
            name: resource,
            targetName,
            targetId: String(event?.targetId || '').trim(),
            sourceEventId: String(event?.eventId || '').trim(),
            sourceNodeId: String(event?.chainNodeId || '').trim(),
          }));
          if (textBlock) {
            const eventId = String(event?.eventId || '').trim();
            const nodeId = String(event?.chainNodeId || '').trim();
            if (eventId) textBlock.sourceEventIds = [...new Set([...(Array.isArray(textBlock.sourceEventIds) ? textBlock.sourceEventIds : []), eventId])];
            if (nodeId) textBlock.sourceNodeIds = [...new Set([...(Array.isArray(textBlock.sourceNodeIds) ? textBlock.sourceNodeIds : []), nodeId])];
          }
          if (!blocks.length) return;
          entries.push({ round, blocks, text: 序列化公开战报Blocks(blocks) || text, projectionSource: 'resource_change_ast' });
        });
      return entries;
    }

    function 构建回合流转公开战报Block条目(eventLedger = []) {
      const entries = [];
      (Array.isArray(eventLedger) ? eventLedger : [])
        .filter(item => item && typeof item === 'object')
        .filter(item => ['round_recover', 'round_stop', 'round_continue'].includes(String(item?.eventKind || '').trim()))
        .forEach(event => {
          const kind = String(event?.eventKind || '').trim();
          const round = Math.max(0, Number(event?.round || event?.sourceRound || 0));
          const prefix = round > 0 ? `第${round}回合：` : '';
          let text = '';
          if (kind === 'round_recover') {
            const actor = String(event?.actorName || '单位').trim();
            const resource = String(event?.meta?.resource || event?.resource || '').trim();
            const amount = Math.max(0, Math.round(读取事件账本数值(event, 'amount')));
            if (actor && resource && amount > 0) text = `${prefix}${actor}回合末恢复 ${amount} 点${resource}。`;
          } else {
            const reason = String(event?.failReason || event?.failureReason || event?.meta?.reason || event?.reasonText || '').trim();
            if (reason) text = `${prefix}${reason.replace(/[。！？\s]+$/g, '')}。`;
          }
          if (!text) return;
          const textBlock = 构建公开战报文本块(text, event);
          if (textBlock) textBlock.projectionSource = kind === 'round_recover' ? 'round_recover_ast' : 'round_flow_ast';
          const blocks = [textBlock].filter(Boolean);
          if (kind === 'round_recover') {
            const actor = String(event?.actorName || '单位').trim();
            const resource = String(event?.meta?.resource || event?.resource || '').trim();
            const amount = Math.max(0, Math.round(读取事件账本数值(event, 'amount')));
            if (actor && resource && amount > 0) {
              blocks.push(构建公开战报Badge块(/生命值|HP|气血|血量/.test(resource) ? 'heal' : 'resource', {
                value: amount,
                unit: /生命值|HP|气血|血量/.test(resource) ? 'HP' : resource,
                name: resource,
                targetName: actor,
                targetId: String(event?.targetId || '').trim(),
                sourceEventId: String(event?.eventId || '').trim(),
                sourceNodeId: String(event?.chainNodeId || '').trim(),
              }));
              if (textBlock) {
                const eventId = String(event?.eventId || '').trim();
                const nodeId = String(event?.chainNodeId || '').trim();
                if (eventId) textBlock.sourceEventIds = [...new Set([...(Array.isArray(textBlock.sourceEventIds) ? textBlock.sourceEventIds : []), eventId])];
                if (nodeId) textBlock.sourceNodeIds = [...new Set([...(Array.isArray(textBlock.sourceNodeIds) ? textBlock.sourceNodeIds : []), nodeId])];
              }
            }
          }
          if (!blocks.length) return;
          entries.push({ round, blocks, text: 序列化公开战报Blocks(blocks) || text, projectionSource: kind === 'round_recover' ? 'round_recover_ast' : 'round_flow_ast' });
        });
      return entries;
    }

    function 构建造物创建公开战报Block条目(eventLedger = []) {
      const groups = new Map();
      (Array.isArray(eventLedger) ? eventLedger : [])
        .filter(item => item && typeof item === 'object')
        .filter(item => String(item?.eventKind || '').trim() === 'create')
        .forEach(event => {
          const round = Math.max(0, Number(event?.round || event?.sourceRound || 0));
          const actor = String(event?.actorName || '行动者').trim();
          const action = normalizeBattleActionDisplayName(event?.finalActionName || event?.actionName || event?.sourceActionName || '造物');
          const key = `${round}|${actor}|${action}`;
          if (!groups.has(key)) groups.set(key, { round, actor, action, items: [] });
          groups.get(key).items.push(event);
        });
      const entries = [];
      [...groups.values()].sort((left, right) => Number(left.round || 0) - Number(right.round || 0)).forEach(group => {
        const detailText = group.items
          .map(item => String(item?.meta?.text || '').trim())
          .filter(Boolean)
          .map(text => text
            .replace(/^\[造物承载\]\s*/, '')
            .replace(new RegExp(`^${group.actor}(?:以【[^】]+】)?`), '')
            .replace(/^，?/, '')
            .replace(/^完成造物[:：]\s*/, '')
            .replace(/^生成了造物/, '生成造物')
            .replace(/\s+/g, ' ')
            .trim())
          .filter(Boolean)
          .filter((text, index, list) =>
            list.findIndex(item => item.replace(/[。；\s]+$/g, '') === text.replace(/[。；\s]+$/g, '')) === index
          )
          .join('；');
        const detail = detailText ? `，${detailText.replace(/[。！？\s]+$/g, '')}` : '';
        const prefix = group.round > 0 ? `第${group.round}回合：` : '';
        const flavoredCreate = 选择战报润色模板('create', {
          actor: group.actor,
          skill: group.action || '造物',
          detail,
          __required: ['actor', 'skill'],
        }, `${group.round}|create|${group.actor}|${group.action}|${detailText}`);
        const text = `${prefix}${flavoredCreate || `${group.actor}完成【${group.action || '造物'}】${detail}`}。`;
        const sourceEventIds = group.items.map(item => String(item?.eventId || '').trim()).filter(Boolean);
        const sourceNodeIds = group.items.map(item => String(item?.chainNodeId || '').trim()).filter(Boolean);
          const textBlock = 构建公开战报文本块(text, {
          ...(group.items[0] || {}),
          sourceEventIds,
          sourceNodeIds,
        });
        if (textBlock) textBlock.projectionSource = 'create_ast';
        const blocks = [textBlock].filter(Boolean);
        group.items.forEach(item => {
          const name = String(item?.createdName || item?.meta?.createdName || item?.meta?.itemName || item?.targetName || '').trim();
          const count = Math.max(1, Number(item?.count || item?.amount || item?.meta?.count || item?.meta?.amount || 1));
          blocks.push(构建公开战报Badge块('item_created', {
            value: count,
            name: name || '造物生成',
            targetName: group.actor,
            sourceEventId: String(item?.eventId || '').trim(),
            sourceNodeId: String(item?.chainNodeId || '').trim(),
          }));
        });
        if (!blocks.length) return;
        entries.push({ round: group.round, blocks, text: 序列化公开战报Blocks(blocks) || text, projectionSource: 'create_ast' });
      });
      return entries;
    }

    function 构建无伤害回合公开战报Block条目(eventLedger = []) {
      const groups = new Map();
      (Array.isArray(eventLedger) ? eventLedger : [])
        .filter(item => item && typeof item === 'object')
        .forEach(event => {
          const round = Math.max(0, Number(event?.round || event?.sourceRound || 0));
          if (!(round > 0)) return;
          if (!groups.has(round)) groups.set(round, []);
          groups.get(round).push(event);
        });
      const entries = [];
      groups.forEach((roundEvents, round) => {
        const hasHostileResult = roundEvents.some(item => ['hit_result', 'counter', 'state_apply', 'state_tick', 'create', 'summon_create', 'shield_create', 'failed_action', 'target_fail'].includes(String(item?.eventKind || '').trim()));
        if (hasHostileResult) return;
        const actorTexts = new Map();
        const sourceEventIds = [];
        const sourceNodeIds = [];
        const pushActorText = (event = {}, text = '') => {
          const actor = String(event?.actorName || '').trim();
          const line = String(text || '').trim();
          if (!actor || !line) return;
          if (!actorTexts.has(actor)) actorTexts.set(actor, []);
          const list = actorTexts.get(actor);
          if (!list.includes(line)) list.push(line);
          const eventId = String(event?.eventId || '').trim();
          const nodeId = String(event?.chainNodeId || '').trim();
          if (eventId) sourceEventIds.push(eventId);
          if (nodeId) sourceNodeIds.push(nodeId);
        };
        roundEvents.forEach(item => {
          const action = normalizeBattleActionDisplayName(item?.actionName || '');
          const kind = String(item?.eventKind || '').trim();
          const outcome = String(item?.result || '').trim();
          if (kind === 'defend') {
            if (/收招转防/.test(action) || outcome === 'stance_hold') pushActorText(item, '收招转防，稳住自身防线');
            else if (/防御|承伤硬抗|借力守势|坚壁反制|危机自保/.test(action)) pushActorText(item, '转入防御，稳住自身防线');
            return;
          }
          if (kind === 'dodge' && outcome === 'evaded') {
            pushActorText(item, '闪身避让，稳住了身位');
            return;
          }
          if (kind === 'pass') {
            if (outcome === 'observe' || /观察/.test(action)) pushActorText(item, '保持距离观察，没有贸然追击');
            else if (outcome === 'stance_hold') pushActorText(item, '收住攻势，稳住身位');
            return;
          }
          if (kind === 'action_start' && 判定守势待机动作(action)) {
            if (/观察/.test(action)) pushActorText(item, '保持距离观察，没有贸然追击');
            else if (/防御|守势|收招转防/.test(action)) pushActorText(item, '转入防御，稳住自身防线');
            return;
          }
          if (kind === 'complete' && action) pushActorText(item, `完成【${action}】`);
        });
        const roundTexts = Array.from(actorTexts.entries())
          .map(([actor, textList]) => `${actor}${textList.join('，')}`)
          .filter(Boolean);
        if (!roundTexts.length) return;
        const text = `第${round}回合：${roundTexts.join('；')}。`;
        const textBlock = 构建公开战报文本块(text, {
          ...(roundEvents[0] || {}),
          sourceEventIds: [...new Set(sourceEventIds)],
          sourceNodeIds: [...new Set(sourceNodeIds)],
        });
        if (!textBlock) return;
        textBlock.projectionSource = 'quiet_round_ast';
        const blocks = [textBlock];
        entries.push({ round, blocks, text: 序列化公开战报Blocks(blocks) || text, projectionSource: 'quiet_round_ast' });
      });
      let lastQuietText = '';
      let quietRun = 0;
      return entries.filter(entry => {
        if (String(entry?.projectionSource || '').trim() !== 'quiet_round_ast') return true;
        const normalized = String(entry?.text || '').replace(/^第\d+回合：/, '').replace(/\s+/g, ' ').trim();
        if (normalized && normalized === lastQuietText) quietRun += 1;
        else {
          lastQuietText = normalized;
          quietRun = 1;
        }
        return quietRun <= 2;
      });
    }

    function 构建状态移除公开战报Block条目(eventLedger = []) {
      return (Array.isArray(eventLedger) ? eventLedger : [])
        .filter(event => event && String(event?.eventKind || '').trim() === 'state_remove')
        .map(event => {
          const round = Math.max(0, Number(event?.round || 0));
          const actor = String(event?.actorName || '行动者').trim();
          const target = String(event?.targetName || actor).trim();
          const action = normalizeBattleActionDisplayName(event?.actionName || event?.sourceActionName || '行动');
          const stateName = 读取事件账本状态名(event) || '状态';
          const prefix = round > 0 ? `第${round}回合：` : '';
          const text = `${prefix}${actor}施展【${action}】，为${target}移除了【${stateName}】。`;
          const textBlock = 构建公开战报文本块(text, event);
          if (!textBlock) return null;
          textBlock.projectionSource = 'state_remove_ast';
          const badge = {
            type: 'badge',
            kind: 'state_removed',
            name: `移除:${stateName}`,
            targetId: String(event?.targetId || target).trim(),
            targetName: target,
            isSelf: isSameBattleReportName(target, actor),
            sourceEventId: String(event?.eventId || '').trim(),
            sourceNodeId: String(event?.chainNodeId || '').trim(),
            projectionSource: 'state_remove_ast',
          };
          return {
            round,
            blocks: [textBlock, badge],
            text: 序列化公开战报Blocks([textBlock, badge]) || text,
            projectionSource: 'state_remove_ast',
          };
        })
        .filter(Boolean);
    }

    function 构建机制生效公开战报Block条目(eventLedger = []) {
      const events = (Array.isArray(eventLedger) ? eventLedger : []).filter(event => event && typeof event === 'object');
      const concreteKinds = new Set([
        'hit_result', 'counter', 'state_apply', 'state_replace', 'state_remove',
        'state_tick', 'resource_change', 'round_recover', 'shield_create', 'shield_break',
        'create', 'summon_create', 'summon_assist',
      ]);
      return events
        .filter(event => String(event?.eventKind || '').trim() === 'effect_resolved')
        .filter(event => {
          const round = Number(event?.round || 0);
          const actor = String(event?.actorName || '').trim();
          const action = normalizeBattleActionDisplayName(event?.actionName || event?.sourceActionName || '');
          const prototype = String(event?.effectPrototype || event?.meta?.effectPrototype || '').trim();
          return !events.some(other =>
            other !== event &&
            concreteKinds.has(String(other?.eventKind || '').trim()) &&
            Number(other?.round || 0) === round &&
            String(other?.actorName || '').trim() === actor &&
            normalizeBattleActionDisplayName(other?.actionName || other?.sourceActionName || '') === action &&
            String(other?.effectPrototype || BATTLE_RUNTIME.inferEffectPrototype(other?.eventKind, other) || '').trim() === prototype
          );
        })
        .map(event => {
          const round = Math.max(0, Number(event?.round || 0));
          const actor = String(event?.actorName || '行动者').trim();
          const targetNames = Array.isArray(event?.meta?.targetNames)
            ? event.meta.targetNames.map(name => String(name || '').trim()).filter(Boolean)
            : [];
          const targets = targetNames.length
            ? [...new Set(targetNames)]
            : [String(event?.targetName || actor).trim()].filter(Boolean);
          const target = targets.join('、') || actor;
          const action = normalizeBattleActionDisplayName(event?.actionName || event?.sourceActionName || '行动');
          const prototype = String(event?.effectPrototype || event?.meta?.effectPrototype || '机制').trim();
          const prefix = round > 0 ? `第${round}回合：` : '';
          const text = `${prefix}${actor}施展【${action}】，${target && target !== actor ? `对${target}` : '为自身'}落实了【${prototype}】效果。`;
          const textBlock = 构建公开战报文本块(text, event);
          if (!textBlock) return null;
          textBlock.projectionSource = 'effect_resolution_ast';
          const badges = targets.map((targetName, index) => ({
            type: 'badge',
            kind: 'state',
            name: prototype,
            targetId: String((Array.isArray(event?.targetIds) ? event.targetIds[index] : '') || event?.targetId || targetName).trim(),
            targetName,
            isSelf: isSameBattleReportName(targetName, actor),
            sourceEventId: String(event?.eventId || '').trim(),
            sourceNodeId: String(event?.chainNodeId || '').trim(),
            projectionSource: 'effect_resolution_ast',
          }));
          return {
            round,
            blocks: [textBlock, ...badges],
            text: 序列化公开战报Blocks([textBlock, ...badges]) || text,
            projectionSource: 'effect_resolution_ast',
          };
        })
        .filter(Boolean);
    }

    function 构建事件账本公开战报Blocks(eventLedger = [], limit = 8, context = {}) {
      const allEvents = (Array.isArray(eventLedger) ? eventLedger : []).filter(event => event && typeof event === 'object');
      const events = allEvents.filter(event => {
        if (!判定公开战报事件是内部兜底(event)) return true;
        return ['hit_result', 'counter', 'state_tick', 'resource_change', 'round_recover', 'state_apply', 'state_replace', 'state_remove', 'summon_create', 'summon_assist', 'shield_create', 'shield_break'].includes(String(event?.eventKind || '').trim());
      });
      const astFirstEntries = [];
      const astFirstProjectionSet = new Set();
      const ledgerOrderByEventId = new Map();
      allEvents.forEach((event, index) => {
        const eventId = String(event?.eventId || '').trim();
        if (eventId && !ledgerOrderByEventId.has(eventId)) ledgerOrderByEventId.set(eventId, index);
      });
      const registerAstEntry = (entry = {}) => {
        应用公开战报Badge错落(entry);
        const blocks = Array.isArray(entry?.blocks) ? entry.blocks : [];
        const content = String(blocks.find(block => block?.type === 'text')?.content || '').trim();
        if (!content) return;
        const sourceEventIds = [];
        const sourceNodeIds = [];
        blocks.forEach(block => {
          if (Array.isArray(block?.sourceEventIds)) {
            block.sourceEventIds.forEach(id => {
              const value = String(id || '').trim();
              if (value && !sourceEventIds.includes(value)) sourceEventIds.push(value);
            });
          }
          const sourceEventId = String(block?.sourceEventId || '').trim();
          const sourceNodeId = String(block?.sourceNodeId || '').trim();
          if (sourceEventId && !sourceEventIds.includes(sourceEventId)) sourceEventIds.push(sourceEventId);
          if (sourceNodeId && !sourceNodeIds.includes(sourceNodeId)) sourceNodeIds.push(sourceNodeId);
        });
        const sourceKey = sourceEventIds.length || sourceNodeIds.length
          ? `events:${sourceEventIds.sort().join(',')}|nodes:${sourceNodeIds.sort().join(',')}`
          : 'no-source';
        const projectionKey = `${content}|${sourceKey}`;
        if (astFirstProjectionSet.has(projectionKey)) return;
        astFirstProjectionSet.add(projectionKey);
        astFirstEntries.push(entry);
      };
      构建状态Tick公开战报Block条目(events).forEach(entry => {
        registerAstEntry(entry);
      });
      构建召唤生成公开战报Block条目(events).forEach(entry => {
        registerAstEntry(entry);
      });
      构建护盾生成公开战报Block条目(events).forEach(entry => {
        registerAstEntry(entry);
      });
      构建命中结算公开战报Block条目(events).forEach(entry => {
        registerAstEntry(entry);
      });
      构建状态附着公开战报Block条目(events, context).forEach(entry => {
        registerAstEntry(entry);
      });
      构建状态移除公开战报Block条目(events).forEach(entry => {
        registerAstEntry(entry);
      });
      构建失败动作公开战报Block条目(events).forEach(entry => {
        registerAstEntry(entry);
      });
      构建资源变化公开战报Block条目(events).forEach(entry => {
        registerAstEntry(entry);
      });
      构建机制生效公开战报Block条目(events).forEach(entry => {
        registerAstEntry(entry);
      });
      构建回合流转公开战报Block条目(events).forEach(entry => {
        registerAstEntry(entry);
      });
      构建造物创建公开战报Block条目(events).forEach(entry => {
        registerAstEntry(entry);
      });
      构建无伤害回合公开战报Block条目(allEvents).forEach(entry => {
        registerAstEntry(entry);
      });
      构建玩家起手反馈公开战报Block条目(allEvents, astFirstEntries).forEach(entry => {
        registerAstEntry(entry);
      });
      const entryOrder = (entry = {}) => {
        const sourceIds = [];
        const blocks = Array.isArray(entry?.blocks) ? entry.blocks : [];
        blocks.forEach(block => {
          if (Array.isArray(block?.sourceEventIds)) block.sourceEventIds.forEach(id => sourceIds.push(String(id || '').trim()));
          sourceIds.push(String(block?.sourceEventId || '').trim());
        });
        const order = sourceIds
          .filter(Boolean)
          .map(id => ledgerOrderByEventId.has(id) ? ledgerOrderByEventId.get(id) : Number.MAX_SAFE_INTEGER)
          .reduce((min, value) => Math.min(min, value), Number.MAX_SAFE_INTEGER);
        return Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER;
      };
      return astFirstEntries.sort((left, right) => {
        const roundDiff = Number(left?.round || 0) - Number(right?.round || 0);
        if (roundDiff) return roundDiff;
        return entryOrder(left) - entryOrder(right);
      });
    }

    function 构建玩家起手反馈公开战报Block条目(eventLedger = [], existingEntries = []) {
      const entries = [];
      const usedEventIds = new Set();
      const usedNodeIds = new Set();
      const visibleTexts = [];
      (Array.isArray(existingEntries) ? existingEntries : []).forEach(entry => {
        const blocks = Array.isArray(entry?.blocks) ? entry.blocks : [];
        const text = String(entry?.text || 序列化公开战报Blocks(blocks) || '').trim();
        if (text) visibleTexts.push(text);
        blocks.forEach(block => {
          const eventId = String(block?.sourceEventId || '').trim();
          const nodeId = String(block?.sourceNodeId || '').trim();
          if (eventId) usedEventIds.add(eventId);
          if (nodeId) usedNodeIds.add(nodeId);
          if (Array.isArray(block?.sourceEventIds)) block.sourceEventIds.forEach(id => {
            const value = String(id || '').trim();
            if (value) usedEventIds.add(value);
          });
          if (Array.isArray(block?.sourceNodeIds)) block.sourceNodeIds.forEach(id => {
            const value = String(id || '').trim();
            if (value) usedNodeIds.add(value);
          });
        });
      });
      (Array.isArray(eventLedger) ? eventLedger : [])
        .filter(event => event && typeof event === 'object')
        .filter(event => String(event?.eventKind || '').trim() === 'action_start')
        .filter(event => BATTLE_RUNTIME.normalizeActionRole(event?.actionRole || '') !== 'STATE_TICK')
        .filter(event => String(event?.actorSide || '').trim() === 'player')
        .filter(event => event?.meta?.source !== 'summon' && event?.source !== 'summon' && !/召唤自主/.test(String(event?.actionType || '')))
        .filter(event => !判定公开战报事件是内部兜底(event))
        .forEach(event => {
          const eventId = String(event?.eventId || '').trim();
          const nodeId = String(event?.chainNodeId || '').trim();
          const actor = String(event?.actorName || '玩家').trim();
          const action = normalizeBattleActionDisplayName(event?.finalActionName || event?.actionName || '行动');
          if ((eventId && usedEventIds.has(eventId)) || (nodeId && usedNodeIds.has(nodeId))) return;
          if (visibleTexts.some(text => actor && action && text.includes(actor) && text.includes(`【${action}】`))) return;
          const round = Math.max(0, Number(event?.round || event?.sourceRound || 0));
          const prefix = round > 0 ? `第${round}回合：` : '';
          const text = `${prefix}${actor}亮出【${action}】的起手，稳住战斗节奏。`;
          const textBlock = 构建公开战报文本块(text, event);
          if (!textBlock) return;
          textBlock.projectionSource = 'player_action_start_ast';
          if (eventId) textBlock.sourceEventIds = [...new Set([...(Array.isArray(textBlock.sourceEventIds) ? textBlock.sourceEventIds : []), eventId])];
          if (nodeId) textBlock.sourceNodeIds = [...new Set([...(Array.isArray(textBlock.sourceNodeIds) ? textBlock.sourceNodeIds : []), nodeId])];
          entries.push({ round, blocks: [textBlock], text: 序列化公开战报Blocks([textBlock]) || text, projectionSource: 'player_action_start_ast' });
        });
      return entries;
    }

    function 读取战报上下文单位(context = {}) {
      const combatData = context?.combatData && typeof context.combatData === 'object' ? context.combatData : {};
      const participants = combatData?.参战者 && typeof combatData.参战者 === 'object' ? combatData.参战者 : {};
      const playerUnits = [
        context.player,
        context.attacker,
        ...(Array.isArray(participants.team_player) ? participants.team_player : []),
      ].filter(Boolean);
      const enemyUnits = [
        context.enemy,
        context.defender,
        context.target,
        ...(Array.isArray(participants.team_enemy) ? participants.team_enemy : []),
      ].filter(Boolean);
      return { playerUnits, enemyUnits };
    }

    function 读取战报回退名称(units = [], fallback = '') {
      return String((Array.isArray(units) ? units : [])
        .map(unit => unit?.name || unit?.名称 || unit?.charKey || unit?.char_key || unit?.key || '')
        .find(Boolean) || fallback || '').trim();
    }

    function getCombatReportUnitName(unit = null, fallback = '') {
      return String(unit?.name || unit?.名称 || unit?.charKey || unit?.char_key || unit?.key || fallback || '').trim();
    }

    function 读取战报单位阵营(context = {}, actorName = '') {
      const name = String(actorName || '').trim();
      if (!name) return '';
      const { playerUnits, enemyUnits } = 读取战报上下文单位(context);
      if (playerUnits.some(unit => isSameBattleReportName(unit?.name || unit?.名称 || unit?.charKey || unit?.key || '', name))) return 'player';
      if (enemyUnits.some(unit => isSameBattleReportName(unit?.name || unit?.名称 || unit?.charKey || unit?.key || '', name))) return 'enemy';
      return '';
    }

    function 读取战报默认敌对名(context = {}, actorName = '') {
      const { playerUnits, enemyUnits } = 读取战报上下文单位(context);
      const actorSide = 读取战报单位阵营(context, actorName);
      if (actorSide === 'enemy') return 读取战报回退名称(playerUnits, '我方角色');
      return 读取战报回退名称(enemyUnits, enemyUnits.length > 1 ? '敌方目标' : '敌方角色');
    }

    function replaceBattleReportGenericNames(line = '', context = {}) {
      const { playerUnits, enemyUnits } = 读取战报上下文单位(context);
      const playerName = 读取战报回退名称(playerUnits, '我方角色');
      const enemyName = 读取战报回退名称(enemyUnits, enemyUnits.length > 1 ? '敌方目标' : '敌方角色');
      return String(line || '')
        .replace(/玩家方/g, '我方')
        .replace(/(^|[^\p{L}\p{N}_])玩家(?=$|[^\p{L}\p{N}_]|[\p{Script=Han}])/gu, `$1${playerName}`)
        .replace(/(^|[^\p{L}\p{N}_])NPC(?=$|[^\p{L}\p{N}_]|[\p{Script=Han}])/gu, `$1${enemyName}`);
    }

    function 规范化公开战报文本(line = '', context = {}) {
      return String(line || '')
        .replace(/，(这一击(?:同时)?令)/g, '。$1')
        .replace(/([。！？])\1+/g, '$1')
        .trim();
    }

    function 解析战报魂技引用(line = '', refName = '', offset = 0, context = {}) {
      const name = normalizeBattleActionDisplayName(refName || '');
      if (!name) return null;
      const ledger = Array.isArray(context?.eventLedger)
        ? context.eventLedger
        : (Array.isArray(context?.combatData?.__battleEventLedger) ? context.combatData.__battleEventLedger : []);
      const candidates = ledger.filter(event => {
        const kind = String(event?.eventKind || '').trim();
        if (!['action_start', 'hit_result', 'state_apply', 'counter', 'summon_assist', 'shield_create', 'create'].includes(kind)) return false;
        const actionName = normalizeBattleActionDisplayName(event?.finalActionName || event?.actionName || event?.sourceActionName || event?.meta?.actionName || '');
        return actionName && actionName === name;
      });
      if (candidates.length) {
        const textBefore = String(line || '').slice(0, Math.max(0, Number(offset || 0)));
        const byActor = candidates.find(event => {
          const actor = String(event?.actorName || '').trim();
          return actor && textBefore.includes(actor);
        }) || candidates[0];
        return {
          action: byActor,
          displayName: normalizeBattleActionDisplayName(byActor?.finalActionName || byActor?.actionName || byActor?.sourceActionName || name),
          actorName: String(byActor?.actorName || '').trim(),
          skillSlot: String(byActor?.skillSlot || byActor?.meta?.skillSlot || byActor?.meta?.魂技槽位 || byActor?.魂技槽位 || '').trim(),
        };
      }
      const unitContext = 读取战报上下文单位(context);
      const units = Array.isArray(context?.units)
        ? context.units
        : [...unitContext.playerUnits, ...unitContext.enemyUnits];
      const findSkillInValue = (value, depth = 0) => {
        if (!value || typeof value !== 'object' || depth > 5) return null;
        const skillName = normalizeBattleActionDisplayName(value?.name || value?.魂技名 || '');
        if (skillName && skillName === name) return value;
        if (Array.isArray(value)) {
          for (const item of value) {
            const found = findSkillInValue(item, depth + 1);
            if (found) return found;
          }
          return null;
        }
        for (const child of Object.values(value)) {
          const found = findSkillInValue(child, depth + 1);
          if (found) return found;
        }
        return null;
      };
      for (const unit of units) {
        const skill = findSkillInValue(unit);
        if (!skill) continue;
        return {
          action: skill,
          displayName: normalizeBattleActionDisplayName(skill?.name || skill?.魂技名 || name),
          actorName: getCombatReportUnitName(unit, ''),
          skillSlot: String(skill?.__魂技槽位 || skill?.魂技槽位 || '').trim(),
        };
      }
      return null;
    }

    function 渲染公开战报HTML(line = '', context = {}) {
      const text = String(line || '');
      const ledger = Array.isArray(context?.eventLedger)
        ? context.eventLedger
        : (Array.isArray(context?.combatData?.__battleEventLedger) ? context.combatData.__battleEventLedger : []);
      const stateHints = new Map();
      ledger.forEach(item => {
        const name = 读取事件账本状态名(item);
        if (!name || stateHints.has(name)) return;
        const parts = [];
        const duration = Math.max(0, Number(item?.duration || item?.meta?.duration || 0));
        const effectSummary = String(item?.effectSummary || item?.meta?.effectSummary || '').trim();
        const driverAttr = String(item?.driverAttr || item?.meta?.driverAttr || '').trim();
        if (duration > 0) parts.push(`持续${duration}回合`);
        if (effectSummary) parts.push(`效果：${effectSummary}`);
        if (driverAttr) parts.push(`驱动属性：${driverAttr}`);
        stateHints.set(name, parts.join('，'));
      });
      let html = '';
      let cursor = 0;
      let changed = false;
      Array.from(text.matchAll(/【([^】]+)】/g)).forEach(match => {
        const raw = String(match?.[0] || '');
        const refName = String(match?.[1] || '').trim();
        const index = Number(match?.index || 0);
        const resolved = 解析战报魂技引用(text, refName, index, context);
        const displayName = resolved?.displayName || refName;
        html += htmlEscapeText(text.slice(cursor, index));
        if (resolved?.action) {
          changed = true;
          html += `<button class="battle-preview-report-skill" type="button" data-battle-report-skill="1" data-skill-name="${htmlEscapeText(displayName)}" data-actor-name="${htmlEscapeText(resolved.actorName || '')}" data-skill-slot="${htmlEscapeText(resolved.skillSlot || '')}">【${htmlEscapeText(displayName)}】</button>`;
        } else if (stateHints.has(refName)) {
          changed = true;
          html += `<span class="combat-state-tag"${stateHints.get(refName) ? ` title="${htmlEscapeText(stateHints.get(refName))}"` : ''}>【${htmlEscapeText(refName)}】</span>`;
          const restText = text.slice(index + raw.length);
          const detailMatch = restText.match(/^（[^）]+）/);
          if (detailMatch) {
            html += `<span class="combat-subtext">${htmlEscapeText(detailMatch[0])}</span>`;
            cursor = index + raw.length + detailMatch[0].length;
            return;
          }
        } else {
          html += htmlEscapeText(raw);
        }
        cursor = index + raw.length;
      });
      html += htmlEscapeText(text.slice(cursor));
      html = html.replace(/（该状态由[^）]+）/g, match => `<span class="combat-subtext">${match}</span>`);
      return { html, changed };
    }

    function 渲染公开战报BadgeHTML(block = {}) {
      const kind = String(block?.kind || '').trim();
      const targetName = String(block?.targetName || '').trim();
      const sourceEventId = String(block?.sourceEventId || '').trim();
      const sourceNodeId = String(block?.sourceNodeId || '').trim();
      const attrs = [
        'data-report-badge="1"',
        kind ? `data-badge-kind="${htmlEscapeText(kind)}"` : '',
        targetName ? `data-target-name="${htmlEscapeText(targetName)}"` : '',
        sourceEventId ? `data-source-event-id="${htmlEscapeText(sourceEventId)}"` : '',
        sourceNodeId ? `data-source-node-id="${htmlEscapeText(sourceNodeId)}"` : '',
        Number(block?.delayMs || 0) > 0 ? `data-badge-delay-ms="${Math.round(Number(block.delayMs || 0))}"` : '',
        Number(block?.delayMs || 0) > 0 ? `style="--battle-badge-delay:${Math.round(Number(block.delayMs || 0))}ms"` : '',
      ].filter(Boolean).join(' ');
      if (kind === 'damage') return `<span class="battle-preview-report-badge battle-preview-report-badge--damage" ${attrs}>${htmlEscapeText(`${Number(block.value || 0)} ${block.unit || 'HP'}`)}</span>`;
      if (kind === 'heal') return `<span class="battle-preview-report-badge battle-preview-report-badge--heal" ${attrs}>${htmlEscapeText(`+${Math.max(0, Number(block.value || 0))} ${block.unit || 'HP'}`)}</span>`;
      if (kind === 'shield') return `<span class="battle-preview-report-badge battle-preview-report-badge--shield" ${attrs}>${htmlEscapeText(`+${Math.max(0, Number(block.value || 0))} 护盾`)}</span>`;
      if (kind === 'resource') {
        const value = Number(block.value || 0);
        const sign = value > 0 ? '+' : '';
        return `<span class="battle-preview-report-badge battle-preview-report-badge--resource" ${attrs}>${htmlEscapeText(`${sign}${value} ${block.unit || block.name || '资源'}`)}</span>`;
      }
      if (kind === 'item_created' || kind === 'creation') {
        const value = Math.max(0, Math.round(Number(block.value || 0)));
        const name = String(block?.name || '造物生成').trim();
        return `<span class="battle-preview-report-badge battle-preview-report-badge--creation" ${attrs}>${htmlEscapeText(`${value > 0 ? `+${value} ` : ''}${name}`)}</span>`;
      }
      if (kind === 'summon_created') {
        const name = String(block?.name || '召唤入场').trim();
        return `<span class="battle-preview-report-badge battle-preview-report-badge--summon" ${attrs}>${htmlEscapeText(name)}</span>`;
      }
      if (kind === 'cap_reached') return `<span class="battle-preview-report-badge battle-preview-report-badge--cap" ${attrs}>${htmlEscapeText(block?.name || '上限')}</span>`;
      const name = String(block?.name || kind || '').trim();
      return name ? `<span class="battle-preview-report-badge battle-preview-report-badge--state" ${attrs}>${htmlEscapeText(name)}</span>` : '';
    }

    function 构建公开战报Source属性(block = {}) {
      const sourceEventId = String(block?.sourceEventId || '').trim();
      const sourceNodeId = String(block?.sourceNodeId || '').trim();
      const sourceEventIds = Array.isArray(block?.sourceEventIds)
        ? block.sourceEventIds.map(id => String(id || '').trim()).filter(Boolean)
        : [];
      const sourceNodeIds = Array.isArray(block?.sourceNodeIds)
        ? block.sourceNodeIds.map(id => String(id || '').trim()).filter(Boolean)
        : [];
      return [
        sourceEventId ? `data-source-event-id="${htmlEscapeText(sourceEventId)}"` : '',
        sourceNodeId ? `data-source-node-id="${htmlEscapeText(sourceNodeId)}"` : '',
        sourceEventIds.length ? `data-source-event-ids="${htmlEscapeText([...new Set(sourceEventIds)].join(','))}"` : '',
        sourceNodeIds.length ? `data-source-node-ids="${htmlEscapeText([...new Set(sourceNodeIds)].join(','))}"` : '',
      ].filter(Boolean).join(' ');
    }

    function 渲染公开战报BlocksHTML(blocks = [], context = {}) {
      const textParts = [];
      const badgeParts = [];
      (Array.isArray(blocks) ? blocks : []).forEach(block => {
        if (!block || typeof block !== 'object') return;
        if (block.type === 'text') {
          const textHtml = 渲染公开战报HTML(block.content || '', context).html;
          if (textHtml) {
            const sourceAttrs = 构建公开战报Source属性(block);
            textParts.push(`<span class="battle-preview-report-text-block"${sourceAttrs ? ` ${sourceAttrs}` : ''}>${textHtml}</span>`);
          }
        } else if (block.type === 'badge') {
          const badgeHtml = 渲染公开战报BadgeHTML(block);
          if (badgeHtml) badgeParts.push(badgeHtml);
        }
      });
      const textHtml = textParts.join(' ');
      const badgeHtml = badgeParts.join(' ');
      const html = badgeParts.length
        ? `<span class="battle-preview-report-line"><span class="battle-preview-report-text">${textHtml}</span><span class="battle-preview-report-badges">${badgeHtml}</span></span>`
        : textHtml;
      return { html, changed: Boolean(html) };
    }

    function 构建事件账本公开战报Block文本行(eventLedger = [], limit = 8, context = {}) {
      return 构建事件账本公开战报Blocks(eventLedger, limit, context)
        .map(entry => 序列化公开战报Blocks(entry?.blocks))
        .map(line => 规范化公开战报文本(line, context))
        .filter(Boolean);
    }

    function 序列化公开战报条目文本行(publicReportBlocks = [], context = {}) {
      return (Array.isArray(publicReportBlocks) ? publicReportBlocks : [])
        .map(entry => 序列化公开战报Blocks(entry?.blocks))
        .map(line => 规范化公开战报文本(line, context))
        .filter(Boolean);
    }

    function 格式化战斗模式显示文本(modeLabel = '', battleMode = '', mode = '') {
      const raw = String(modeLabel || battleMode || mode || '战斗').trim();
      if (!raw) return '战斗';
      if (/自动续推|multi_round/i.test(raw)) return '多回合';
      if (/single_round/i.test(raw)) return '单回合';
      return raw;
    }

    function buildPublicBattleReportBlock({ battleLog = [], combatData = {}, battleOutcome = {}, modeLabel = '', roundCount = 0, eventLedger = null } = {}) {
      const ledger = eventLedger || combatData?.__battleEventLedger || [];
      const lines = 序列化公开战报条目文本行(构建事件账本公开战报Blocks(ledger, 8, { combatData }), { combatData });
      const header = `本轮战斗已由战斗模块完成结算：${格式化战斗模式显示文本(modeLabel)}，共推进 ${Math.max(0, Number(roundCount || 0))} 回合。`;
      const outcome = `当前结果：${battleOutcome?.label || battleOutcome?.type || combatData?.裁断结果 || '未分胜负'}。`;
      const intent = combatData?.战斗意图 ? `战斗意图：${combatData.战斗意图}。` : '';
      return [
        '<战斗公开战报>',
        header,
        ...lines,
        outcome,
        intent,
        '</战斗公开战报>',
      ].filter(Boolean).join('\n');
    }







    function 构建战斗结构化结果字段(combatData = {}, eventLedger = [], publicReportBlocks = null) {
      const ledger = Array.isArray(eventLedger) ? eventLedger : [];
      const publicEntries = Array.isArray(publicReportBlocks)
        ? publicReportBlocks
        : 构建事件账本公开战报Blocks(ledger, 8, { combatData });
      const decisionTrace = BATTLE_RUNTIME.collectDecisionTrace(combatData);
      const resolutionTrace = BATTLE_RUNTIME.collectResolutionTrace(combatData);
      const snapshot = BATTLE_RUNTIME.getBattleSnapshot(combatData);
      const actionChains = BATTLE_RUNTIME.buildActionChains(ledger, resolutionTrace);
      const reportBlocks = BATTLE_RUNTIME.buildReportBlocks(ledger, decisionTrace, publicEntries);
      const { finalBattleReport, aiSummaryInput } = BATTLE_RUNTIME.buildFinalSummary(ledger, decisionTrace, snapshot, combatData);
      return {
        publicReportBlocks: publicEntries.map(item => BATTLE_RUNTIME.cloneAuditSnapshot(item)),
        decisionTrace,
        resolutionTrace,
        actionChains,
        reportBlocks,
        finalBattleReport,
        aiSummaryInput,
        snapshot,
        llmBattleSummary: BATTLE_RUNTIME.buildAiNarrativeSummary(aiSummaryInput, { maxRounds: 3 }),
      };
    }

    function buildBattleAdjudicationDossier({ combatData = {}, battleOutcome = {}, 压制战规则文本 = '', 虚拟战规则文本 = '', 裁断约束文本 = '' } = {}) {
      const participants = combatData?.参战者 && typeof combatData.参战者 === 'object' ? combatData.参战者 : {};
      const formatNames = list => (Array.isArray(list) ? list : [])
        .map(unit => String(unit?.name || unit?.名称 || '').trim())
        .filter(Boolean)
        .join('、') || '无';
      return [
        `[前端战果类型]\n${battleOutcome?.type || 'unknown'}`,
        `[前端战果说明]\n${battleOutcome?.label || ''}`,
        `[战斗类型]\n${combatData?.战斗类型 || ''}`,
        `[战斗意图]\n${combatData?.战斗意图 || ''}`,
        `[参战者]\n我方：${formatNames(participants.team_player)}\n敌方：${formatNames(participants.team_enemy)}`,
        `[前端建议结果]\n${combatData?.前端建议结果 || ''}`,
        `[建议终点HP区间]\n${combatData?.建议终点HP区间 || ''}`,
        `[前端推荐终点HP]\n${combatData?.前端推荐终点HP ?? ''}`,
        `[预计HP伤害]\n${combatData?.预计HP伤害 ?? ''}`,
        `[裁断约束]\n${裁断约束文本 || '无'}${压制战规则文本 || ''}${虚拟战规则文本 || ''}`,
      ].join('\n');
    }









    function buildBattlePreviewResult({
      intentText = '',
      mode = 'single_round',
      modeLabel = '',
      battleLog = [],
      combatData = {},
      battleOutcome = {},
      publicReport = '',
      publicReportBlocks = null,
      dossier = '',
      roundCount = 0,
      pendingSettlement = null,
      intentMode = '',
      eventLedger = null,
    } = {}) {
      const resolvedPublicReportBlocks = Array.isArray(publicReportBlocks)
        ? publicReportBlocks.map(item => BATTLE_RUNTIME.cloneAuditSnapshot(item))
        : 构建事件账本公开战报Blocks(eventLedger || combatData?.__battleEventLedger || [], 8, { combatData }).map(item => BATTLE_RUNTIME.cloneAuditSnapshot(item));
      const resolvedEventLedger = Array.isArray(eventLedger)
        ? eventLedger
        : (Array.isArray(combatData?.__battleEventLedger) ? combatData.__battleEventLedger : []);
      BATTLE_RUNTIME.prepareCombatData(combatData, name => getMvuValue(`char.${name}`, null));
      const publicReportText = 序列化公开战报条目文本行(resolvedPublicReportBlocks, { combatData }).join('\n');
      const snapshot = BATTLE_RUNTIME.getBattleSnapshot(combatData);
      const decisionTrace = BATTLE_RUNTIME.collectDecisionTrace(combatData);
      const resolutionTrace = BATTLE_RUNTIME.collectResolutionTrace(combatData);
      const actionChains = BATTLE_RUNTIME.buildActionChains(resolvedEventLedger, resolutionTrace);
      const reportBlocks = BATTLE_RUNTIME.buildReportBlocks(resolvedEventLedger, decisionTrace, resolvedPublicReportBlocks);
      const { finalBattleReport, aiSummaryInput } = BATTLE_RUNTIME.buildFinalSummary(resolvedEventLedger, decisionTrace, snapshot, combatData);
      const llmBattleSummary = BATTLE_RUNTIME.buildAiNarrativeSummary(aiSummaryInput, { maxRounds: 3 });
      const result = {
        preview: true,
        intentText: String(intentText || ''),
        mode: pendingSettlement ? 'tower_pending_preview' : 'battle_preview',
        battleMode: mode,
        modeLabel,
        intentMode: normalizeBattleIntentMode(intentMode || combatData?.战斗意图 || '点到为止'),
        logs: Array.isArray(battleLog) ? [...battleLog] : [],
        roundsExecuted: Math.max(0, Number(roundCount || 0)),
        battleOutcome: cloneBattleValue(battleOutcome || {}),
        publicReport: publicReportText,
        publicReportBlocks: resolvedPublicReportBlocks,
        actionChains,
        reportBlocks,
        finalBattleReport,
        aiSummaryInput,
        llmBattleSummary,
        dossier: String(dossier || ''),
        combatData,
        decisionTrace,
        resolutionTrace,
        eventLedger: resolvedEventLedger.map(item => BATTLE_RUNTIME.cloneAuditSnapshot(item)),
        closedLoopLedger: BATTLE_RUNTIME.cloneAuditSnapshot(combatData?.__行动闭环诊断?.事实账本 || null),
        snapshot,
      };
      if (pendingSettlement) result.pendingSettlement = cloneBattleValue(pendingSettlement);
      return result;
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
        installHostHooks();
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

    function fallbackEscape(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function fallbackUnit(unit) {
      const safeUnit = unit && typeof unit === 'object' ? unit : {};
      const stat = safeUnit.属性 && typeof safeUnit.属性 === 'object' ? safeUnit.属性 : {};
      const merged = { ...stat, ...safeUnit };
      COMBAT_STAT_KEYS.forEach(key => {
        if (stat[key] !== undefined) merged[key] = stat[key];
      });
      merged.name = safeUnit.name || stat.name || safeUnit.base?.name || '未知';
      merged.等级 = fallbackNumber(merged.等级, 0);
      merged.系别 = safeUnit.系别 || safeUnit.type || merged.系别 || '未知系';
      merged.HP上限 = Math.max(
        1,
        fallbackNumber(merged.HP上限, fallbackNumber(stat.HP上限, fallbackNumber(merged.体力上限, fallbackNumber(stat.体力上限, 1)))),
      );
      merged.HP = Math.max(
        0,
        fallbackNumber(merged.HP, fallbackNumber(stat.HP, fallbackNumber(merged.体力, fallbackNumber(stat.体力, merged.HP上限)))),
      );
      merged.体力上限 = Math.max(1, fallbackNumber(merged.体力上限, fallbackNumber(stat.体力上限, 1)));
      merged.体力 = Math.max(0, fallbackNumber(merged.体力, fallbackNumber(stat.体力, merged.体力上限)));
      merged.魂力上限 = Math.max(1, fallbackNumber(merged.魂力上限, fallbackNumber(stat.魂力上限, 1)));
      merged.魂力 = Math.max(0, fallbackNumber(merged.魂力, fallbackNumber(stat.魂力, merged.魂力上限)));
      merged.精神力上限 = Math.max(1, fallbackNumber(merged.精神力上限, fallbackNumber(stat.精神力上限, 1)));
      merged.精神力 = Math.max(0, fallbackNumber(merged.精神力, fallbackNumber(stat.精神力, merged.精神力上限)));
      merged.力量 = fallbackNumber(merged.力量, fallbackNumber(stat.力量, 0));
      merged.防御 = fallbackNumber(merged.防御, fallbackNumber(stat.防御, 0));
      merged.敏捷 = fallbackNumber(merged.敏捷, fallbackNumber(stat.敏捷, 0));
      merged.状态效果 = merged.状态效果 || stat.状态效果 || {};
      merged.持续效果 = merged.持续效果 || {};
      merged.vit_max = merged.体力上限;
      merged.vit = merged.体力;
      merged.sta_max = merged.体力上限;
      merged.sta = merged.体力;
      merged.hp_max = merged.HP上限;
      merged.hp = merged.HP;
      merged.sp_max = merged.魂力上限;
      merged.sp = merged.魂力;
      merged.men_max = merged.精神力上限;
      merged.men = merged.精神力;
      merged.str = merged.力量;
      merged.def = merged.防御;
      merged.agi = merged.敏捷;
      return merged;
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

    function fallbackText(id, value) {
      const node = byId(id);
      if (node) node.textContent = String(value ?? '');
    }

    function 切换回退文本(节点标识, 文本值, 是否显示 = true) {
      const 节点 = byId(节点标识);
      if (!节点) return;
      节点.hidden = !是否显示;
      节点.textContent = 是否显示 ? String(文本值 ?? '') : '';
    }

    function fallbackBar(id, value, max) {
      const node = byId(id);
      if (!node) return;
      const ratio = Math.max(0, Math.min(100, (fallbackNumber(value, 0) / Math.max(1, fallbackNumber(max, 1))) * 100));
      node.style.width = `${ratio}%`;
    }

    function fallbackRenderStats(id, unit) {
      const node = byId(id);
      if (!node) return;
      node.innerHTML = [
        ['系别', unit.系别 || '未知'],
        ['力', Math.round(unit.力量 || 0)],
        ['防', Math.round(unit.防御 || 0)],
        ['速', Math.round(unit.敏捷 || 0)],
      ]
        .map(([label, value]) => `<div class="stat-item"><div class="stat-label">${fallbackEscape(label)}</div><div class="stat-value">${fallbackEscape(value)}</div></div>`)
        .join('');
    }

    function fallbackRenderBuffs(id, unit) {
      const node = byId(id);
      if (!node) return;
      const conditionChips = Object.entries(unit.状态效果 || {}).slice(0, 8).map(([name, condition]) => {
        const typeText = String(condition?.类型 || condition?.type || '').toLowerCase();
        const kind = /debuff|负面|伤|弱/.test(typeText) ? 'debuff' : 'buff';
        return `<span class="tag-chip ${kind}">${fallbackEscape(name)}</span>`;
      });
      const sustainChips = Object.keys(unit.持续效果 || {}).slice(0, 4).map(name => `<span class="tag-chip sustain">${fallbackEscape(name)}</span>`);
      node.innerHTML = [...conditionChips, ...sustainChips].join('');
    }

    function fallbackRenderUnit(prefix, rawUnit) {
      const unit = fallbackUnit(rawUnit);
      const 徽标文本 = 读取战斗单位徽标文本(unit);
      切换回退文本(`ui-${prefix}-lv`, 徽标文本, !!徽标文本);
      fallbackText(`ui-${prefix}-name`, unit.name || (prefix === 'player' ? '玩家' : '对手'));
      fallbackText(`ui-${prefix}-hp-text`, `${Math.round(unit.HP)} / ${Math.round(unit.HP上限)}`);
      fallbackText(`ui-${prefix}-sta-text`, `${Math.round(unit.体力)} / ${Math.round(unit.体力上限)}`);
      fallbackText(`ui-${prefix}-sp-text`, `${Math.round(unit.魂力)} / ${Math.round(unit.魂力上限)}`);
      fallbackText(`ui-${prefix}-men-text`, `${Math.round(unit.精神力)} / ${Math.round(unit.精神力上限)}`);
      fallbackBar(`ui-${prefix}-hp-bar`, unit.HP, unit.HP上限);
      fallbackBar(`ui-${prefix}-sta-bar`, unit.体力, unit.体力上限);
      fallbackBar(`ui-${prefix}-sp-bar`, unit.魂力, unit.魂力上限);
      fallbackBar(`ui-${prefix}-men-bar`, unit.精神力, unit.精神力上限);
      fallbackRenderStats(`ui-${prefix}-stats`, unit);
      fallbackRenderBuffs(`ui-${prefix}-buffs`, unit);
      return unit;
    }

                                                                            installHostHooks();

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
        const transactionResult = await executeTransaction(cloneBattleValue(sourceCombatData), {
          mode: battleMode,
          rounds: maxRounds,
          actionDeclaration: options.actionDeclaration || null,
          intentMode: String(options.intentMode || sourceCombatData.战斗意图 || '').trim(),
          executionMode: 'manual',
          dryRun,
          commit: !dryRun,
        });
        const commitReceipt = transactionResult?.commitReceipt || null;
        if (!dryRun && !commitReceipt?.committed) throw new Error('battle_package_commit_missing');
        const reportDto = transactionResult.reportDto;
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
          aiSummaryInput: transactionResult.aiSummaryInput,
          llmBattleSummary: String(reportDto?.finalSummary?.text || ''),
          commitReceipt,
        };
        if (!dryRun && reportDto?.aiReport) {
          /* 投递分两路：
             楼层只留一行战果（玩家可读、且永久留在聊天历史里也不占上下文）；
             完整因果链走 inject，只在当轮存在，读完即弃，不进历史。
             这样 AI 有足够的事实扩写战斗，而长战斗的全量细节不会成为永久噪音。 */
          const 战果标题 = String(reportDto.battleHeadline || '战斗已结算');
          /* 裁断卷宗与 battle_report 是两个不同的注入点，不能塞同样的内容：
             卷宗只承载"不可改写的终局事实"，完整因果链由 inject 提供。 */
          const settlementContext = registerBattleSettlementContext({
            id: `battle-${Date.now()}`,
            结构化摘要: 战果标题,
            裁断卷宗: 战果标题,
            来源: 'BattleReport',
          });
          output.battleSettlementContext = settlementContext;
          sendToAI(
            `<battle_result>${战果标题}</battle_result>`,
            `<battle_report>\n${reportDto.aiReport}\n</battle_report>`,
            {
              mvuUpdate: commitReceipt,
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

      function isCombatUnitIdentityMatch(unit, rawIdentity = '') {
        if (unit && rawIdentity && unit === rawIdentity) return true;
        const wanted = rawIdentity && typeof rawIdentity === 'object'
          ? String(BATTLE_PREVIEW.unitId(rawIdentity) || BATTLE_PREVIEW.unitName(rawIdentity) || '').trim()
          : String(rawIdentity || '').trim();
        if (!unit || !wanted) return false;
        return [BATTLE_PREVIEW.unitId(unit), BATTLE_PREVIEW.unitName(unit), unit?.charKey, unit?.char_key, unit?.key]
          .map(value => String(value || '').trim())
          .filter(Boolean)
          .includes(wanted);
      }

      function isCombatUnitAlive(unit) {
        return BATTLE_PREVIEW.isAlive(unit);
      }

      function isCombatUnitAbleToFight(unit) {
        return BATTLE_PREVIEW.isBattleCapable(unit);
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
              const costText = Object.entries(costs).filter(([, value]) => Number(value) > 0).map(([key, value]) => `${key}:${Math.round(Number(value) * 100) / 100}`).join(' ') || (actionKind === 'USE_ITEM' ? '消耗 1' : '无');
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
                enabled: true,
                reason: '',
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

        function findUiSkillCost(skill = {}) {
          if (skill?.__fusion_display_cost_text) return String(skill.__fusion_display_cost_text);
          const direct = skill.消耗 || skill.cost || skill.cost_text || '';
          return direct ? String(direct) : '';
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
          const 目标名 = String(当前动作.target_name || 当前动作.物品接收者 || resolveIntentTargetNameFromAction(当前动作, state.combatData) || '自身').trim();
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
          const 消耗原文 = String(动作.cost_text || findUiSkillCost(技能) || '').trim();
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
              activeBattleRecordView: ['chain', 'summary'].includes(previousState.activeBattleRecordView) ? previousState.activeBattleRecordView : 'chain',
              activeBattleDecisionRound: Math.max(0, Number(previousState.activeBattleDecisionRound || 0)),
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
          return ['chain', 'summary'].includes(view) ? view : 'chain';
        }

        function 设置战斗记录视图(view = 'chain') {
          const activeView = ['chain', 'summary'].includes(view) ? view : 'chain';
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

        function 读取轨迹类型(trace = {}) {
          return String(trace?.type || trace?.类型 || '').trim();
        }

        function 判定轨迹是目标规划(轨迹 = {}) {
          return /索敌规划|辅助目标规划/.test(读取轨迹类型(轨迹));
        }

        function 判定轨迹是战术动作(轨迹 = {}) {
          return /战术确立|主动规划|应招审计|再判定审计|换招审计/.test(读取轨迹类型(轨迹));
        }

        function 判定轨迹是行为链校验(轨迹 = {}) {
          return /应招审计|再判定审计|换招审计/.test(读取轨迹类型(轨迹));
        }

        function 归一判定轨迹(trace = {}) {
          const 类型 = 读取轨迹类型(trace);
          return {
            ...trace,
            类型,
            行动者: String(trace?.actor || trace?.行动者 || '').trim(),
            目标: String(trace?.target || trace?.目标 || '').trim(),
            技能: normalizeBattleActionDisplayName(trace?.skill || trace?.技能 || ''),
            回合: Number(trace?.round || trace?.回合 || 0),
            最终权重: Number(trace?.最终权重 || trace?.weight || 0),
            选择原因: String(trace?.选择原因 || trace?.reason || '').trim(),
            候选来源: String(trace?.候选来源 || trace?.source || '').trim(),
            resolutionType: String(trace?.resolutionType || trace?.决断类型 || '').trim(),
            skipReason: String(trace?.skipReason || trace?.静默原因 || '').trim(),
            roundPhase: String(trace?.roundPhase || trace?.阶段 || '').trim(),
            sourceActionName: normalizeBattleActionDisplayName(trace?.sourceActionName || trace?.反击动作来源 || ''),
            actionId: String(trace?.actionId || trace?.动作ID || '').trim(),
            sourceActionId: String(trace?.sourceActionId || trace?.来源动作ID || '').trim(),
            sourceActionType: String(trace?.sourceActionType || trace?.反击动作类型 || '').trim(),
            failReason: String(trace?.failReason || trace?.失败原因 || '').trim(),
            displayTargetName: String(trace?.displayTargetName || trace?.展示目标名 || '').trim(),
            目标语义: String(trace?.targetSemantics || trace?.目标语义 || trace?.目标类型 || '').trim(),
            承载方式: String(trace?.carryMode || trace?.承载方式 || '').trim(),
            hitCandidateName: normalizeBattleActionDisplayName(trace?.hitCandidateName || trace?.命中候选名 || ''),
            finalResolvedActionName: normalizeBattleActionDisplayName(trace?.finalResolvedActionName || trace?.最终落地动作 || ''),
            actionOverrideSource: String(trace?.actionOverrideSource || trace?.动作覆写来源 || '').trim(),
            战术确立来源: String(trace?.playerLockedSource || trace?.战术确立来源 || '').trim(),
          };
        }

        function 修正支援类判定目标名(轨迹 = {}, fallbackActor = '') {
          const target = String(轨迹?.displayTargetName || 轨迹?.目标 || '').trim();
          const actorName = String(轨迹?.行动者 || 轨迹?.actor || fallbackActor || '').trim();
          const intent = String(轨迹?.战略意图 || 轨迹?.intent || '').trim();
          const semantics = String(轨迹?.目标语义 || 轨迹?.targetSemantics || '').trim();
          if (!/治疗|保核|防守|驱散|辅助|支援/.test(`${intent} ${semantics}`)) return target;
          if (!target || (actorName && target !== actorName && !/我方|友方|自身|全体|前排|后排/.test(target))) return actorName || '自身';
          return target;
        }

        function 读取判定决断类型(轨迹 = {}) {
          const explicit = String(轨迹?.resolutionType || '').trim();
          if (explicit) return explicit;
          const 类型 = 读取轨迹类型(轨迹);
          const 原因 = String(轨迹?.选择原因 || '').trim();
          if (!/再判定审计|换招审计/.test(类型)) {
            if (轨迹?.动作校正?.发生校正 || (轨迹?.actionOverrideSource && 轨迹?.finalResolvedActionName)) return 'switch_action';
            return '';
          }
          const 再判定命中项 = 读取判定流程候选列表(轨迹, 0)
            .find(item => ['EXECUTED', 'LOCKED', 'SELECTED'].includes(读取候选状态(item, 轨迹))) || null;
          if (轨迹?.动作校正?.发生校正) return 'switch_action';
          if (再判定命中项) {
            if (读取候选名称(再判定命中项) === '放弃再判定') return 'keep_original';
            return 'switch_action';
          }
          if (/放弃再判定|维持原案|维持原定|未发现更优解/.test(原因)) return 'keep_original';
          if (/再判定/.test(类型)) return '';
          return '';
        }

        function 判定轨迹是静默辅助规划(轨迹 = {}) {
          const 类型 = 读取轨迹类型(轨迹);
          if (!/辅助目标规划/.test(类型)) return false;
          const actor = String(轨迹?.行动者 || '').trim();
          const target = String(轨迹?.目标 || '').trim();
          const 理由文本 = [
            轨迹?.选择原因,
            ...(Array.isArray(轨迹?.目标理由) ? 轨迹.目标理由 : []),
            ...(Array.isArray(轨迹?.前瞻理由) ? 轨迹.前瞻理由 : []),
            ...(Array.isArray(轨迹?.职责理由) ? 轨迹.职责理由 : []),
          ].join(' ');
          if (轨迹?.skipReason) return true;
          if (actor && target && isSameBattleReportName(actor, target) && /常规观察|观察|友方目标优先表命中/.test(理由文本)) return true;
          if (!String(轨迹?.技能 || '').trim() && 读取判定流程候选列表(轨迹, 0).length <= 0) return true;
          return false;
        }

        function 判定轨迹属于中间推演(轨迹 = {}) {
          if (判定轨迹是静默辅助规划(轨迹)) return true;
          if (!/主动规划/.test(读取轨迹类型(轨迹))) return false;
          if (轨迹?.动作校正?.发生校正) return false;
          const 技能 = normalizeBattleActionDisplayName(轨迹?.技能 || '');
          const 原因 = String(轨迹?.选择原因 || '').trim();
          const 候选数 = 读取判定流程候选列表(轨迹, 0).length;
          const 行动者 = String(轨迹?.行动者 || '').trim();
          const 回合 = Number(轨迹?.回合 || 轨迹?.round || 0);
          const 是真实后续主规划 =
            !!行动者 &&
            回合 >= 2 &&
            (
              候选数 > 0 ||
              /收招转防|战术观察|守势维持|伺机闪避|承伤硬抗|危机自保|防御|反敏攻压制|支援轮换|支援补位|稳态调整/.test(原因)
            );
          if (是真实后续主规划) return false;
          return (
            !技能 ||
            /无可用候选|未形成有效出手机会|当前未形成有效出手机会|常规方案收益过低|守势观察/.test(原因)
          );
        }

        function 判定目标规划为支援检索(轨迹 = {}) {
          const 类型 = 读取轨迹类型(轨迹);
          const 来源 = String(轨迹.候选来源 || '').trim();
          return /辅助目标规划|友方目标|辅助目标/.test(`${类型} ${来源}`) || 判定侧写是友方支援动作(轨迹);
        }

        function 构建TargetPlanDTO(轨迹 = {}) {
          const normalized = 归一判定轨迹(轨迹 || {});
          const type = 读取轨迹类型(normalized);
          const isSupport = /辅助目标规划|友方目标|辅助目标/.test(`${type} ${String(normalized.候选来源 || '').trim()}`) || 判定侧写是友方支援动作(normalized);
          const targetName = String(normalized.displayTargetName || normalized.目标 || '').trim();
          const ruleCode = String(normalized.reasonCode || normalized.targetRuleCode || normalized.目标规则码 || '').trim().toUpperCase();
          return {
            __dtoKind: 'TargetPlanDTO',
            actorName: String(normalized.行动者 || '行动者').trim(),
            targetName,
            planKind: isSupport ? 'SUPPORT_TARGET' : 'HOSTILE_TARGET',
            targetRuleCode: ruleCode,
            hasTarget: Boolean(targetName),
          };
        }

        function 构建目标规划事实侧写行(轨迹 = {}) {
          const dto = 构建TargetPlanDTO(轨迹);
          const actor = dto.actorName || '行动者';
          if (dto.planKind === 'SUPPORT_TARGET') {
            return [
              `├─ 支援检索：${actor}核对己方可承接对象`,
              `├─ ${dto.hasTarget ? `候选对象：【${dto.targetName}】` : '候选对象：暂未确认'}`,
              `└─ ${dto.hasTarget ? `确认支援对象【${dto.targetName}】。` : '暂未确认合适的支援对象。'}`,
            ].map(清洗主卡战术文本).filter(Boolean);
          }
          const lockedByTaunt = /TAUNT|嘲讽/.test(dto.targetRuleCode);
          return [
            `├─ 索敌检索：${actor}核对敌方可选目标`,
            `├─ ${dto.hasTarget ? `候选目标：【${dto.targetName}】` : '候选目标：暂未确认'}`,
            `└─ ${dto.hasTarget ? `${lockedByTaunt ? '受嘲讽牵制，锁定' : '锁定'}对手【${dto.targetName}】。` : '暂未锁定合适的出手对象。'}`,
          ].map(清洗主卡战术文本).filter(Boolean);
        }

        function 构建判定侧写归一理由键(轨迹 = {}) {
          const normalized = 归一判定轨迹(轨迹);
          if (判定轨迹是目标规划(normalized)) {
            const 目标 = String(normalized.displayTargetName || normalized.目标 || '').trim();
            const 规则码 = String(normalized.reasonCode || normalized.targetRuleCode || normalized.目标规则码 || '').trim();
            return `${读取轨迹类型(normalized)}::${目标}::${规则码 || 'target-scan'}`;
          }
          const 目标 = String(normalized.displayTargetName || normalized.目标 || '').trim();
          return `${读取轨迹类型(normalized)}::${目标}::${读取判定流程过滤文本(normalized)}`;
        }

        function 判定轨迹静默目标遍历详情(轨迹 = {}) {
          const candidates = Array.isArray(轨迹?.candidates) ? 轨迹.candidates : [];
          const target = String(轨迹?.displayTargetName || 轨迹?.目标 || '').trim();
          if (!target) return false;
          return candidates.length === 1 || /ONLY_TARGET|ONLY_VALID_TARGET/i.test(String(轨迹?.reasonCode || 轨迹?.targetRuleCode || 轨迹?.目标规则码 || ''));
        }

        function 构建中间推演摘要(轨迹 = {}) {
          const normalized = 归一判定轨迹(轨迹);
          const target = String(normalized.displayTargetName || normalized.目标 || '').trim();
          const 过滤文本 = 读取判定流程过滤文本(normalized);
          if (判定轨迹是目标规划(normalized)) {
            return target ? `检索【${target}】后，未进入最终决断。` : '检索阶段未形成最终目标。';
          }
          if (target && /收益过低|未形成/.test(过滤文本)) return `评估【${target}】时，${过滤文本}。`;
          if (target) return `围绕【${target}】推演后，${过滤文本}。`;
          return `${过滤文本}。`;
        }

        function 读取候选名称(候选 = {}) {
          return normalizeBattleActionDisplayName(
            候选?.名称 ||
            候选?.skill?.name ||
            候选?.skill?.魂技名 ||
            候选?.__预览技能?.name ||
            候选?.__预览技能?.魂技名 ||
            候选?.name ||
            '',
          );
        }

        function 读取候选权重(候选 = {}) {
          return Number(候选?.权重 ?? 候选?.weight ?? 0);
        }

        function 读取候选状态(候选 = {}, 轨迹 = {}) {
          const explicit = String(候选?.candidateStatus || 候选?.状态 || 候选?.status || '').trim().toUpperCase();
          if (['SCORED', 'SAMPLED', 'LOCKED', 'EXECUTED', 'REJECTED', 'FILTERED', 'ABORTED', 'SELECTED'].includes(explicit)) return explicit;
          return '';
        }

        function 读取候选否决码(候选 = {}, 轨迹 = {}) {
          const raw = String(候选?.rejectionCode || 候选?.否决码 || 候选?.reasonCode || '').trim();
          if (raw) return raw;
          const status = 读取候选状态(候选, 轨迹);
          if (status === 'FILTERED') return 'FILTERED_BY_SCORE';
          if (status === 'REJECTED') return 'LOWER_PRIORITY';
          return '';
        }

        function 映射候选否决原因(code = '') {
          const key = String(code || '').trim().toUpperCase();
          const map = {
            OUT_OF_MANA: '魂力不足',
            COOLDOWN: '冷却未转好',
            TARGET_INVALID: '目标非法',
            INTENT_TARGET_MISMATCH: '意图与目标不匹配',
            RANGE_INVALID: '距离不满足',
            CAP_REACHED: '达到上限',
            CONTROL_GAP: '无法限制后续反扑',
            RESOURCE_PRESSURE: '资源压力过高',
            PROTECT_ALLY_GAP: '掩护价值不足',
            LETHAL_GAP: '终结收益不足',
            DIRECT_PRESSURE_GAP: '当前压制收益不足',
            LOWER_PRIORITY: '优先级不足',
            REPLACED_BY_MANUAL_ACTION: '被手动动作覆盖',
            FILTERED_BY_SCORE: '评分未达有效阈值',
            ACTION_COMMITTED: '攻击已完成锁定',
            REACTION_SUCCEEDED: '对方反应已生效',
            NO_EFFECTIVE_OPENING: '没有可利用的反应窗口',
            NO_STRUCTURED_SETTLEMENT: '本次行动没有形成有效结算',
            UNKNOWN_REASON: '当前条件不满足',
          };
          return map[key] || (key ? '当前条件不满足' : '');
        }

        function 包裹判定动作名称(名称 = '') {
          const text = normalizeBattleActionDisplayName(名称);
          return text ? `【${text.replace(/^【|】$/g, '')}】` : '';
        }

        function 判定无反应动作名(名称 = '') {
          return /^(?:无暇反应|无法反应|无反应|来不及反应)$/i.test(normalizeBattleActionDisplayName(名称));
        }

        function 判定可显示为原定反应动作(名称 = '') {
          const actionName = normalizeBattleActionDisplayName(名称);
          if (!actionName || 判定无反应动作名(actionName)) return false;
          return /^(?:敌方截击|敌方压迫|承伤硬抗|肉体兜底|伺机闪避|闪避|防御|偏转|收招转防|借力守势|坚壁|抢落点|压招|短前摇对轰)$/.test(actionName);
        }

        function 判定主动叙事Trace错路由为反应(轨迹 = {}, candidateDtos = []) {
          const normalized = 归一判定轨迹(轨迹);
          if (!/主动规划|战术确立/.test(读取轨迹类型(normalized))) return false;
          const reactionOnlyActions = name => /^(?:敌方截击|敌方压迫|承伤硬抗|肉体兜底|伺机闪避|闪避|偏转|收招转防|借力守势|坚壁|抢落点|压招|短前摇对轰)$/.test(normalizeBattleActionDisplayName(name || ''));
          const directActionNames = [
            normalized.finalResolvedActionName,
            normalized.最终落地动作,
            normalized.技能,
            normalized.skill,
            normalized.hitCandidateName,
            normalized.命中候选名,
          ];
          if (directActionNames.some(reactionOnlyActions)) return true;
          return (Array.isArray(candidateDtos) ? candidateDtos : []).some(item => reactionOnlyActions(item?.name));
        }

        function 格式化判定候选名称(名称 = '') {
          return 包裹判定动作名称(名称);
        }

        function 格式化玩家判定结果(value = '') {
          const raw = String(value || '').trim();
          if (!raw) return '';
          const mapped = 映射玩家态Outcome文本(raw);
          if (mapped) return mapped;
          if (/counter_secondary_reaction/i.test(raw)) return '反防反应';
          if (/counter_reaction/i.test(raw)) return '防反应对';
          if (/replanned/i.test(raw)) return '动作调整完成';
          if (/guarded[_\s-]+hit|hit[_\s-]+guarded/i.test(raw)) return '防守后承击';
          if (/^(dodged|evaded|dodge_success|miss)$/i.test(raw)) return '规避成功';
          if (/^(failed|fail|reaction_failed)$/i.test(raw)) return '未能截断，转为承击';
          if (/^(attempted)$/i.test(raw)) return '尝试应对';
          if (/^(guarded|blocked|defended)$/i.test(raw)) return '防守成立';
          if (/^(hit|damaged|success|applied|opened)$/i.test(raw)) return '判定成功';
          if (/^(resisted|immune|immunity)$/i.test(raw)) return /immune/i.test(raw) ? '免疫' : '抵抗成功';
          if (/^(critical)$/i.test(raw)) return '关键事件';
          return raw.replace(/_/g, ' ');
        }

        function 映射玩家态Outcome文本(value = '') {
          const raw = String(value || '').trim();
          if (!raw) return '';
          const key = raw.toLowerCase().replace(/[\s-]+/g, '_');
          const map = {
            no_effect: '未产生结算变化',
            dodged: '规避成功',
            evaded: '规避成功',
            dodge_success: '规避成功',
            interrupted: '动作截断',
            reaction_failed: '应对失败（未能截断，转为承击）',
            failed: '应对失败（未能截断，转为承击）',
            fail: '应对失败（未能截断，转为承击）',
            state_applied: '状态生效',
            control_applied: '状态生效',
            state_resisted: '状态化解',
            control_resisted: '状态化解',
            state_immune: '状态免疫',
            control_immune: '状态免疫',
            guarded: '防守成立',
            blocked: '防守成立',
            full_hit: '正面命中',
            graze: '擦伤',
            critical: '关键事件',
            action_committed: '动作成立',
            resource_recovered: '资源回稳',
            cap_reached: '达到上限',
            no_valid_window: '暂未展开',
          };
          return map[key] || '';
        }

        function 格式化反应判定结果(dto = {}) {
          const raw = String(dto.result || dto.outcome || '').trim();
          const key = raw.toLowerCase().replace(/[\s-]+/g, '_');
          const actionName = normalizeBattleActionDisplayName(dto.finalReactionName || '');
          if (key === 'no_effect') {
            if (/伺机闪避|闪避|规避/.test(actionName)) return '规避未能生效';
            if (/承伤硬抗|肉体兜底|防御|坚壁|偏转|收招转防|借力守势/.test(actionName)) return '防守未能改变承击结果';
            if (/敌方压迫|压招|抢落点|短前摇对轰|范围压制|反压/.test(actionName)) return '未能截断来袭';
            return '未能改变本次应对结果';
          }
          return 映射玩家态Outcome文本(raw) || 格式化玩家判定结果(raw);
        }

        function 格式化玩家反应类型(value = '') {
          const raw = String(value || '').trim();
          if (!raw) return '';
          const map = {
            counter_secondary_reaction: '反防反应',
            counter_reaction: '防反应对',
            agile_interrupt: '敏攻截断',
            EVADE: '闪避',
            evade: '闪避',
            dodge: '闪避应对',
            DEFEND: '防御',
            defend: '防御',
            GUARD: '护卫',
            guard_action: '护卫',
            COUNTER: '反击',
            counter: '反击',
            guard: '防御应对',
            parry: '偏转应对',
            no_reaction: '节奏受压',
            无法反应: '节奏受压',
          };
          return map[raw] || raw.replace(/_/g, ' ');
        }

        function 清洗玩家可见判定文本(line = '') {
          return String(line || '')
            .replace(/\b(counter_secondary_reaction|counter_reaction|guarded_hit|hit_guarded|replanned|reaction_failed|failed|dodged|evaded|dodge_success|guarded|blocked|defended|critical|no[_\s-]+effect|interrupted|state_applied|state_resisted|state_immune)\b/gi, match => 格式化玩家判定结果(match));
        }

        function 转义正则文本(text = '') {
          return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        function 渲染判定侧写HTML(line = '', 轨迹 = {}, evidence = []) {
          const safeLine = 清洗玩家可见判定文本(line);
          let html = htmlEscapeText(safeLine).replace(/\r?\n/g, '<br>');
          const entities = [
            { className: 'battle-preview-trace-actor', value: 轨迹.行动者 },
            { className: 'battle-preview-trace-target', value: 轨迹.目标 || 轨迹.实际目标 },
          ]
            .filter(item => String(item.value || '').trim())
            .sort((a, b) => String(b.value).length - String(a.value).length);
          entities.forEach(item => {
            html = html.replace(new RegExp(转义正则文本(htmlEscapeText(item.value)), 'g'), `<span class="${item.className}">${htmlEscapeText(item.value)}</span>`);
          });
          html = html.replace(/【([^】]+)】/g, '<span class="battle-preview-trace-skill">【$1】</span>');
          html = html.replace(/^(├─|└─)/, '<span class="battle-preview-trace-muted">$1</span>');
          html = html.replace(/\{\{e:(\d+)\}\}/g, (match, indexText) => {
            const item = Array.isArray(evidence) ? evidence[Number(indexText)] : null;
            if (!item) return '';
            const display = String(item.display ?? '').trim();
            const source = String(item.source || '').trim();
            const label = String(item.label || display || '判定数值').trim();
            if (!display) return '';
            if (!source) return htmlEscapeText(display);
            const accessibleText = `${label}：${display}。来源：${source}`;
            return `<span class="battle-trace-number-evidence" tabindex="0" data-source="${htmlEscapeText(source)}" aria-label="${htmlEscapeText(accessibleText)}">${htmlEscapeText(display)}</span>`;
          });
          if (/最终|确认|转入|执行|完成|造成|召出|命中|落地/.test(safeLine)) html = `<span class="battle-preview-trace-decision">${html}</span>`;
          return html;
        }

        function 构建CandidatePoolDTO(trace = {}) {
          return 读取判定流程候选列表(trace, 3).map(item => ({
            name: 读取候选名称(item),
            score: Math.round(读取候选权重(item)),
            status: 读取候选状态(item, trace || {}),
            explicitStatus: String(item?.candidateStatus || item?.状态 || item?.status || '').trim().toUpperCase(),
            rejectionCode: 读取候选否决码(item, trace || {}),
            recentActionCount: Number(item?.recentActionCount || 0),
            effectTags: Array.isArray(item?.effectTags) ? item.effectTags.map(tag => String(tag || '').trim()).filter(Boolean) : [],
            rejectedByEffectGap: String(item?.rejectedByEffectGap || '').trim(),
          }));
        }

        function 构建NarrativeDecisionDTO(trace = {}, options = {}) {
          const sourceTrace = trace && typeof trace === 'object' ? trace : {};
          补写NarrativeDecisionSidecar(sourceTrace);
          const sidecar = sourceTrace.__narrativeDecisionSidecar && typeof sourceTrace.__narrativeDecisionSidecar === 'object'
            ? sourceTrace.__narrativeDecisionSidecar
            : {};
          const normalized = 归一判定轨迹(sourceTrace);
          const candidates = 构建CandidatePoolDTO(normalized);
          const finalActionName = normalizeBattleActionDisplayName(normalized.finalResolvedActionName || normalized.技能 || normalized.hitCandidateName || '');
          const selected = candidates.find(item => ['EXECUTED', 'LOCKED', 'SELECTED'].includes(item.explicitStatus || '')) || null;
          const rejectedAlternatives = candidates
            .filter(item => item.name && item.name !== finalActionName)
            .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
            .slice(0, 2)
            .map(item => ({
              actionName: item.name,
              score: Number(item.score || 0),
              reasonCode: item.rejectionCode || '',
              reasonText: 映射候选否决原因(item.rejectionCode) || '',
              effectTags: item.effectTags,
              rejectedByEffectGap: item.rejectedByEffectGap,
            }));
          const narrationTrustLevel = String(sidecar.narrationTrustLevel || '').trim() || 'FACT_ONLY';
          const formulaTrustLevel = String(sidecar.formulaTrustLevel || '').trim() || 'MISSING_OPERAND';
          const fatalCodes = Array.isArray(sidecar.fatalCodes) ? sidecar.fatalCodes.slice() : [];
          const dominantReason = String(sidecar.dominantReason || '').trim();
          return {
            __dtoKind: 'NarrativeDecisionDTO',
            actorName: String(normalized.行动者 || options.actorName || '行动者').trim(),
            targetName: String(normalized.displayTargetName || normalized.目标 || options.targetName || '目标').trim(),
            finalActionName,
            selectedCandidateName: selected?.name || finalActionName,
            rejectedAlternatives,
            dominantReason,
            tieBreakReason: dominantReason === 'TIE_BREAK' ? '战术重心破平' : '',
            narrationTrustLevel,
            formulaTrustLevel,
            fatalCodes,
          };
        }

        function formatTacticalNarration(dto = {}) {
          if (!dto || dto.__dtoKind !== 'NarrativeDecisionDTO') return '';
          if (!dto || dto.narrationTrustLevel !== 'TRUSTED') return '';
          const alt = dto.rejectedAlternatives?.[0] || null;
          if (!alt?.actionName || !String(alt?.reasonCode || alt?.rejectedByEffectGap || '').trim()) return '';
          const actorName = dto.actorName || '行动者';
          const targetName = dto.targetName || '目标';
          const finalActionName = dto.finalActionName || '当前动作';
          const altText = alt?.actionName ? `【${alt.actionName}】` : '另一套方案';
          const altReasonCode = String(alt?.reasonCode || '').trim().toUpperCase();
          const 取舍句 = (() => {
            if (!alt?.actionName) return '';
            if (dto.dominantReason === 'CONTROL') {
              return altReasonCode === 'CONTROL_GAP' || alt?.rejectedByEffectGap === 'CONTROL_RESTRICTION_GAP'
                ? `${altText}的直接收益接近，却无法限制${targetName}后续反扑；`
                : '';
            }
            if (dto.dominantReason === 'RESOURCE_PRESSURE') {
              return altReasonCode === 'RESOURCE_PRESSURE'
                ? `${altText}压制更重，却会拖空后续魂力；`
                : '';
            }
            if (dto.dominantReason === 'PROTECT_ALLY') {
              return altReasonCode === 'PROTECT_ALLY_GAP'
                ? `${altText}难以及时补上己方防线缺口；`
                : '';
            }
            if (dto.dominantReason === 'LETHAL') {
              return altReasonCode === 'LETHAL_GAP'
                ? `${altText}仍留余地，难以把握眼前终结窗口；`
                : '';
            }
            if (dto.dominantReason === 'DIRECT_PRESSURE') {
              return altReasonCode === 'DIRECT_PRESSURE_GAP'
                ? `${altText}只能牵制一时，正面推进力度不足；`
                : '';
            }
            return '';
          })();
          if (dto.dominantReason === 'TIE_BREAK') {
            return `局势焦灼之下，${altText}与【${finalActionName}】收益相近，${actorName}最终按战术重心抢出【${finalActionName}】，把压力压向${targetName}。`;
          }
          if (!取舍句) return '';
          if (dto.dominantReason === 'RESOURCE_PRESSURE') {
            return `${取舍句}${actorName}转以【${finalActionName}】稳住局面，避免下一轮断档。`;
          }
          if (dto.dominantReason === 'PROTECT_ALLY') {
            return `${actorName}捕捉到战线缺口，${取舍句}改以【${finalActionName}】介入局面，为己方争回喘息空间。`;
          }
          if (dto.dominantReason === 'LETHAL') {
            return `察觉${targetName}已露颓势，${取舍句}${actorName}顺势施展【${finalActionName}】逼向终结。`;
          }
          if (dto.dominantReason === 'CONTROL') {
            return `${取舍句}${actorName}因此改以【${finalActionName}】封锁退路，试图接管节奏。`;
          }
          if (dto.dominantReason === 'DIRECT_PRESSURE') {
            return `${取舍句}${actorName}改以【${finalActionName}】压住${targetName}的身位，稳稳推进战线。`;
          }
          return '';
        }

        function 渲染判定候选对比HTML(轨迹 = {}) {
          if (判定轨迹是目标规划(轨迹) || 读取轨迹类型(轨迹) === '防反机制') return '';
          if (轨迹.动作校正?.发生校正) return '';
          if (/主动规划|战术确立/.test(读取轨迹类型(轨迹))) {
            const dto = 构建NarrativeDecisionDTO(轨迹);
            if (!dto || dto.narrationTrustLevel !== 'TRUSTED') return '';
          }
          const 最终动作 = normalizeBattleActionDisplayName(轨迹.finalResolvedActionName || 轨迹.实际技能 || 轨迹.技能 || '');
          const 覆写来源 = String(轨迹.actionOverrideSource || '').trim();
          const candidates = 读取判定流程候选列表(轨迹, 3);
          const 候选包含最终动作 = !!(最终动作 && candidates.some(item => 读取候选名称(item) === 最终动作));
          const 最终为非敌对动作 =
            判定侧写是自我应对动作({ ...轨迹, 技能: 最终动作, 实际技能: 最终动作 }) ||
            /战术观察|待机|守势维持|守势对峙/.test(最终动作);
          if (
            最终为非敌对动作 &&
            (覆写来源 || !候选包含最终动作)
          ) return '';
          if (candidates.length < 2) return '';
          const 命中技能 = normalizeBattleActionDisplayName(轨迹.hitCandidateName || 轨迹.技能 || 轨迹.实际技能 || 轨迹.动作校正?.实际技能 || '');
          const 命中标签原文 = String(轨迹.最终命中标签 || '').trim();
          const 是再判定策略候选 = name => /抢落点|压招|偏转|放弃再判定|换招/.test(normalizeBattleActionDisplayName(name || ''));
          const 命中标签 = 命中标签原文 === '最终命中'
            ? (是再判定策略候选(命中技能) && 命中技能 !== 最终动作 ? '复核命中' : 命中标签原文)
            : '';
          return `<div class="battle-preview-trace-candidate"><div class="battle-preview-trace-candidate-head">候选取舍</div>${candidates.map(item => {
            const name = 读取候选名称(item);
            const status = 读取候选状态(item, 轨迹);
            const isChosen = ['EXECUTED', 'LOCKED', 'SELECTED'].includes(status);
            const label = isChosen
              ? `${包裹判定动作名称(name)} 已锁定`
              : `${包裹判定动作名称(name)} 未成为本轮主轴`;
            return `<div class="battle-preview-trace-candidate-line"><span class="battle-preview-trace-candidate-label">${渲染判定侧写HTML(label, 轨迹)}</span>${isChosen && 命中标签 ? ` <span class="battle-preview-trace-hit-tag">${htmlEscapeText(命中标签)}</span>` : ''}</div>`;
          }).join('')}</div>`;
        }

        function 读取判定流程候选列表(轨迹 = {}, limit = 5) {
          const sorted = (Array.isArray(轨迹.候选排序结果) ? 轨迹.候选排序结果 : [])
            .slice()
            .filter(候选 => 读取候选名称(候选))
            .sort((左, 右) => 读取候选权重(右) - 读取候选权重(左));
          if (Number(limit) === 0) return sorted;
          return sorted.slice(0, Math.max(1, Number(limit || 5)));
        }

        function 格式化审计证据值(value) {
          if (value == null || value === '') return '';
          if (typeof value === 'string') return value;
          try { return JSON.stringify(value, null, 2); }
          catch (_) { return String(value); }
        }

        function 补齐判定轨迹回合(轨迹 = {}, 已有码条目 = [], 向后条目 = []) {
          const 既有回合 = Number(轨迹?.回合 || 轨迹?.round || 轨迹?.实际回合 || 0);
          if (既有回合 > 0) return 既有回合;
          const actor = String(轨迹?.行动者 || '').trim();
          if (!actor) return 0;
          const 近邻池 = [...已有码条目].reverse().concat(向后条目);
          const 近邻 = 近邻池.find(item => {
            const next = 归一判定轨迹(item || {});
            return String(next?.行动者 || '').trim() === actor && Number(next?.回合 || next?.round || next?.实际回合 || 0) > 0;
          });
          return Number(近邻?.回合 || 近邻?.round || 近邻?.实际回合 || 0);
        }

        function 构建判定流程归并键(轨迹 = {}) {
          const normalized = 归一判定轨迹(轨迹);
          const actor = String(normalized.行动者 || '').trim();
          const round = Number(normalized.回合 || 0);
          const 类型 = 读取轨迹类型(normalized);
          if (!actor || !类型) return '';
          if (类型 === '战术确立') return `${round}::${actor}::locked`;
          if (/主动规划/.test(类型)) return `${round}::${actor}::active`;
          if (/应招审计/.test(类型)) return `${round}::${actor}::reaction`;
          if (/再判定审计/.test(类型)) return `${round}::${actor}::reeval`;
          if (/换招审计/.test(类型)) return `${round}::${actor}::switch`;
          if (判定轨迹是目标规划(normalized)) return `${round}::${actor}::${/辅助目标规划/.test(类型) ? 'ally-target' : 'enemy-target'}`;
          return `${round}::${actor}::${类型}`;
        }

        function 读取判定流程分段键(轨迹 = {}) {
          const normalized = 归一判定轨迹(轨迹);
          const 类型 = 读取轨迹类型(normalized);
          if (类型 === '防反机制') return 'counter';
          if (判定轨迹是目标规划(normalized) || /战术确立|主动规划/.test(类型)) return 'decision';
          if (/应招审计|再判定审计|换招审计/.test(类型)) return 'reaction';
          return 'decision';
        }

        function 补写NarrativeDecisionSidecar(轨迹 = {}) {
          if (!轨迹 || typeof 轨迹 !== 'object') return;
          const normalized = 归一判定轨迹(轨迹);
          if (!/主动规划|战术确立/.test(读取轨迹类型(normalized))) return;
          const candidates = 读取判定流程候选列表(normalized, 0);
          const finalActionName = normalizeBattleActionDisplayName(normalized.finalResolvedActionName || normalized.技能 || normalized.hitCandidateName || '');
          const existingSidecar = 轨迹.__narrativeDecisionSidecar && typeof 轨迹.__narrativeDecisionSidecar === 'object'
            ? 轨迹.__narrativeDecisionSidecar
            : {};
          const fatalCodes = Array.isArray(existingSidecar.fatalCodes)
            ? existingSidecar.fatalCodes
                .map(code => String(code || '').trim())
                .filter(code => code === 'INVALID_ACTION_FACT')
            : [];
          if (!finalActionName || !String(normalized.行动者 || '').trim()) fatalCodes.push('INVALID_ACTION_FACT');
          if (finalActionName && candidates.length && !candidates.some(item => 读取候选名称(item) === finalActionName)) fatalCodes.push('CANDIDATE_FINAL_MISMATCH');
          if (candidates.some(item => !String(item?.candidateStatus || item?.状态 || item?.status || '').trim())) fatalCodes.push('NARRATION_CANDIDATE_STATUS_MISSING');
          if (candidates.some(item => ['SELECTED', 'LOCKED', 'EXECUTED'].includes(读取候选状态(item, normalized)) && 读取候选否决码(item, normalized))) fatalCodes.push('CANDIDATE_SELECTED_HAS_REJECTION_CODE');
          if (/回填|最终落点|执行声明|终态回填|系统/i.test(String(normalized.actionOverrideSource || ''))) fatalCodes.push('CANDIDATE_FINAL_MISMATCH');
          const terms = [
            Number(normalized.原始权重 || normalized.原始净收益 || 0),
            Number(normalized.战术修正 || 0),
            Number(normalized.目标修正 || 0) + Number(normalized.目标价值修正 || 0),
            Number(normalized.资源修正 || 0),
            Number(normalized.团队意图修正 || 0),
            Number(normalized.二回合前瞻修正 || 0),
            Number(normalized.职责修正 || 0),
          ].filter(value => Number.isFinite(value) && Math.abs(value) >= 1);
          const finalWeight = Number(normalized.最终权重 || 0);
          let formulaTrustLevel = 'TRUSTED';
          if (!Number.isFinite(finalWeight) || (terms.length < 2 && Math.abs(finalWeight) >= 1)) {
            formulaTrustLevel = 'MISSING_OPERAND';
            fatalCodes.push('FATAL_WEIGHT_FORMULA_MISSING_OPERAND');
          } else if (Math.abs(Math.round(finalWeight - terms.reduce((sum, value) => sum + value, 0))) > 1) {
            formulaTrustLevel = 'HIDDEN_UNBALANCED';
            fatalCodes.push('FATAL_WEIGHT_FORMULA_UNBALANCED');
          }
          const candidateDtos = candidates.map(item => ({
            name: 读取候选名称(item),
            score: Number(读取候选权重(item) || 0),
            status: 读取候选状态(item, normalized),
            rejectionCode: 读取候选否决码(item, normalized),
            effectTags: Array.isArray(item?.effectTags) ? item.effectTags.map(tag => String(tag || '').trim()).filter(Boolean) : [],
            rejectedByEffectGap: String(item?.rejectedByEffectGap || '').trim(),
            candidateSource: String(item?.candidateSource || item?.候选来源 || '').trim(),
          }));
          if (判定主动叙事Trace错路由为反应(normalized, candidateDtos)) fatalCodes.push('NARRATION_REACTION_TRACE_MISROUTED');
          const selected = candidateDtos.find(item => ['EXECUTED', 'LOCKED', 'SELECTED'].includes(item.status)) || null;
          if (!selected && candidates.length) fatalCodes.push('CANDIDATE_SELECTED_MISSING');
          if (selected?.name && finalActionName && selected.name !== finalActionName) fatalCodes.push('CANDIDATE_SELECTED_FINAL_MISMATCH');
          const rejectedAlternatives = candidateDtos
            .filter(item => item.name && item.name !== finalActionName)
            .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
            .slice(0, 2);
          const traceSource = String(normalized.候选来源 || normalized.source || '').trim();
          const syntheticCandidateChain = /结构化动作事实/.test(traceSource) ||
            candidateDtos.some(item => /SYNTHETIC_BASELINE|EXECUTED_ACTION_FACT/.test(item.candidateSource));
          if (syntheticCandidateChain) fatalCodes.push('NARRATION_SYNTHETIC_CANDIDATE_CHAIN');
          const finalScore = Number(normalized.最终权重 || selected?.score || 0);
          const tieCandidate = rejectedAlternatives.find(item => Math.abs(Number(item.score || 0) - finalScore) <= 1 && finalScore > 0);
          const selectedEffectTags = Array.isArray(selected?.effectTags) ? selected.effectTags : [];
          const topAlternativeEffectTags = Array.isArray(rejectedAlternatives[0]?.effectTags) ? rejectedAlternatives[0].effectTags : [];
          const topAlternativeReasonCode = String(rejectedAlternatives[0]?.rejectionCode || '').trim().toUpperCase();
          const targetBreakdown = normalized.目标价值分解 && typeof normalized.目标价值分解 === 'object' ? normalized.目标价值分解 : {};
          const controlDominates = selectedEffectTags.includes('CONTROL_RESTRICTION') &&
            !topAlternativeEffectTags.includes('CONTROL_RESTRICTION') &&
            (topAlternativeReasonCode === 'CONTROL_GAP' || rejectedAlternatives[0]?.rejectedByEffectGap === 'CONTROL_RESTRICTION_GAP');
          const lethalDominates = selectedEffectTags.some(tag => /^(?:LETHAL|EXECUTE|FINISH|KILL_WINDOW)$/.test(tag)) ||
            topAlternativeReasonCode === 'LETHAL_GAP' ||
            Number(targetBreakdown.lethalWindow || targetBreakdown.killWindow || targetBreakdown.finishWindow || 0) > 0;
          const resourceDominates = Number(normalized.资源修正 || 0) <= -12 ||
            topAlternativeReasonCode === 'RESOURCE_PRESSURE' ||
            selectedEffectTags.includes('RESOURCE_STABLE');
          const protectDominates = selectedEffectTags.some(tag => /^(?:PROTECT_ALLY|EMERGENCY_HEAL|GUARD_ALLY|ALLY_COVER)$/.test(tag)) ||
            topAlternativeReasonCode === 'PROTECT_ALLY_GAP' ||
            Number(normalized.职责修正 || 0) > 0;
          const directPressureDominates = selectedEffectTags.includes('DIRECT_DAMAGE') &&
            (topAlternativeReasonCode === 'DIRECT_PRESSURE_GAP' || rejectedAlternatives[0]?.rejectedByEffectGap === 'DIRECT_PRESSURE_GAP');
          let dominantReason = 'DIRECT_PRESSURE';
          if (tieCandidate) dominantReason = 'TIE_BREAK';
          else if (controlDominates) dominantReason = 'CONTROL';
          else if (lethalDominates) dominantReason = 'LETHAL';
          else if (resourceDominates) dominantReason = 'RESOURCE_PRESSURE';
          else if (protectDominates) dominantReason = 'PROTECT_ALLY';
          const missingAlternative = !rejectedAlternatives.length || !rejectedAlternatives[0].rejectionCode;
          if (missingAlternative) fatalCodes.push('NARRATION_MISSING_ALTERNATIVE_REASON');
          const reactionAlternativePollution = rejectedAlternatives.some(item => 判定可显示为原定反应动作(item.name) || 判定守势待机动作(item.name));
          if (reactionAlternativePollution) fatalCodes.push('NARRATION_REACTION_ALTERNATIVE_POLLUTION');
          const genericAlternativeReason = !rejectedAlternatives[0]?.rejectionCode ||
            /^(?:LOWER_PRIORITY|FILTERED_BY_SCORE)$/.test(String(rejectedAlternatives[0]?.rejectionCode || '').trim().toUpperCase()) ||
            (!rejectedAlternatives[0]?.rejectedByEffectGap && dominantReason !== 'TIE_BREAK');
          if (genericAlternativeReason) fatalCodes.push('NARRATION_GENERIC_ALTERNATIVE_REASON');
          if (dominantReason === 'DIRECT_PRESSURE' && !directPressureDominates) fatalCodes.push('NARRATION_DIRECT_PRESSURE_UNEXPLAINED');
          if (dominantReason === 'CONTROL' && !controlDominates) fatalCodes.push('NARRATION_UNVERIFIED_CONTROL_GAP');
          const invalidFatalCodes = new Set([
            'INVALID_ACTION_FACT',
            'CANDIDATE_FINAL_MISMATCH',
            'CANDIDATE_SELECTED_FINAL_MISMATCH',
            'NARRATION_REACTION_TRACE_MISROUTED',
          ]);
          const finalTrustLevel = fatalCodes.some(code => invalidFatalCodes.has(code))
            ? 'INVALID'
            : (fatalCodes.length || formulaTrustLevel !== 'TRUSTED')
              ? 'FACT_ONLY'
              : 'TRUSTED';
          const uniqueFatalCodes = fatalCodes.filter((code, index, arr) => arr.indexOf(code) === index);
          轨迹.__narrativeDecisionSidecar = {
            narrationTrustLevel: finalTrustLevel,
            formulaTrustLevel,
            fatalCodes: uniqueFatalCodes,
            dominantReason: finalTrustLevel === 'TRUSTED' ? dominantReason : '',
          };
        }

        function 构建判定流程展示数据(traceList = [], logs = [], context = {}) {
          const rawList = Array.isArray(traceList) ? traceList : [];
          rawList.forEach(trace => {
            if (!trace || typeof trace !== 'object') return;
            const type = 读取轨迹类型(trace);
            if (!/主动规划|战术确立/.test(type)) return;
            补写NarrativeDecisionSidecar(trace);
          });
          const 事件账本 = Array.isArray(context?.eventLedger)
            ? context.eventLedger
            : (Array.isArray(context?.combatData?.__battleEventLedger) ? context.combatData.__battleEventLedger : []);
          const 行动链动作事实键集合 = new Set();
          (Array.isArray(context?.resolutionTrace) ? context.resolutionTrace : [])
            .filter(node => node && typeof node === 'object' && String(node.nodeKind || '').trim() === 'action_decision')
            .forEach(node => {
              const round = Number(node.round || node.sourceRound || 0);
              const actor = String(node.actorName || '').trim();
              const action = normalizeBattleActionDisplayName(node.finalActionName || node.actionName || '');
              if (round > 0 && actor && action) 行动链动作事实键集合.add(`${round}::${actor}::${action}`);
            });
          const 账本动作落地键集合 = new Set();
          const 账本行动者回合集合 = new Set();
          const 公开战报动作键集合 = new Set();
          const 账本落地事件类型 = new Set(['hit_result', 'state_apply', 'state_tick', 'resource_change', 'defend', 'dodge', 'pass', 'counter', 'create', 'summon_create', 'summon_assist', 'shield_create', 'blocked_action', 'failed_action', 'target_fail']);
          (Array.isArray(事件账本) ? 事件账本 : []).forEach(event => {
            if (!event || typeof event !== 'object') return;
            if (!账本落地事件类型.has(String(event.eventKind || '').trim())) return;
            const round = Number(event.round || event.sourceRound || 0);
            const actor = String(event.actorName || event.actor || '').trim();
            if (!(round > 0) || !actor) return;
            账本行动者回合集合.add(`${round}::${actor}`);
            [
              event.actionName,
              event.sourceActionName,
              event.meta?.actionName,
              event.meta?.sourceActionName,
            ].map(name => normalizeBattleActionDisplayName(name || '')).filter(Boolean).forEach(action => {
              账本动作落地键集合.add(`${round}::${actor}::${action}`);
            });
          });
          const 公开战报行 = Array.isArray(context?.publicBattleLines)
            ? context.publicBattleLines
            : (事件账本.length ? 构建事件账本公开战报Block文本行(事件账本, 24, context) : []);
          公开战报行.forEach(line => {
            const text = String(line || '').trim();
            const round = Number(text.match(/^第(\d+)回合：/)?.[1] || 0);
            if (!(round > 0)) return;
            const body = text.replace(/^第\d+回合：/, '');
            for (const match of body.matchAll(/([^，。；\s]+?)施展【([^】]+)】/g)) {
              const actor = String(match[1] || '').trim();
              const action = normalizeBattleActionDisplayName(match[2] || '');
              if (actor && action) 公开战报动作键集合.add(`${round}::${actor}::${action}`);
            }
            for (const match of body.matchAll(/随后([^，。；\s]+?)抓住[^，。；]+，以【([^】]+)】进行反击/g)) {
              const actor = String(match[1] || '').trim();
              const action = normalizeBattleActionDisplayName(match[2] || '');
              if (actor && action) 公开战报动作键集合.add(`${round}::${actor}::${action}`);
            }
            for (const match of body.matchAll(/([^，。；\s]+?)的【([^】]+)】本回合对抗结束/g)) {
              const actor = String(match[1] || '').trim();
              const action = normalizeBattleActionDisplayName(match[2] || '');
              if (actor && action) 公开战报动作键集合.add(`${round}::${actor}::${action}`);
            }
          });
          const 判定轨迹有账本落地 = trace => {
            const normalized = 归一判定轨迹(trace || {});
            const round = Number(normalized.回合 || normalized.round || 0);
            const actor = String(normalized.行动者 || '').trim();
            const action = normalizeBattleActionDisplayName(normalized.finalResolvedActionName || normalized.技能 || '');
            if (!(round > 0) || !actor) return true;
            if (!事件账本.length) return true;
            if (normalized.actionId) {
              return (Array.isArray(事件账本) ? 事件账本 : []).some(event =>
                String(event?.actionId || '') === normalized.actionId ||
                String(event?.sourceActionId || '') === normalized.actionId
              );
            }
            if (action && 行动链动作事实键集合.size) return 行动链动作事实键集合.has(`${round}::${actor}::${action}`);
            if (action && 公开战报动作键集合.size && 公开战报动作键集合.has(`${round}::${actor}::${action}`)) return true;
            if (action && 公开战报动作键集合.size && !公开战报动作键集合.has(`${round}::${actor}::${action}`)) return false;
            if (action && 账本动作落地键集合.has(`${round}::${actor}::${action}`)) return true;
            if (!action && 账本行动者回合集合.has(`${round}::${actor}`)) return true;
            return false;
          };
          const 标记主动叙事缺少行动事实 = trace => {
            if (!trace || typeof trace !== 'object') return;
            补写NarrativeDecisionSidecar(trace);
            const sidecar = trace.__narrativeDecisionSidecar && typeof trace.__narrativeDecisionSidecar === 'object'
              ? trace.__narrativeDecisionSidecar
              : {};
            const fatalCodes = Array.isArray(sidecar.fatalCodes) ? sidecar.fatalCodes.slice() : [];
            if (!fatalCodes.includes('INVALID_ACTION_FACT')) fatalCodes.push('INVALID_ACTION_FACT');
            trace.__narrativeDecisionSidecar = {
              ...sidecar,
              narrationTrustLevel: 'INVALID',
              fatalCodes,
              dominantReason: '',
            };
          };
          const 绑定判定轨迹到账本动作 = trace => {
            const normalized = 归一判定轨迹(trace || {});
            const originalAction = normalizeBattleActionDisplayName(normalized.技能 || '');
            const finalAction = normalizeBattleActionDisplayName(normalized.finalResolvedActionName || '');
            const resolved = finalAction && finalAction !== originalAction
              ? {
                  ...normalized,
                  技能: finalAction,
                  审计技能: originalAction,
                  实际技能: finalAction,
                  实际执行动作: finalAction,
                  actionOverrideSource: String(normalized.actionOverrideSource || '最终落点').trim(),
                }
              : normalized;
            if (resolved.actionId) return resolved;
            const round = Number(normalized.回合 || normalized.round || 0);
            const actor = String(normalized.行动者 || '').trim();
            const action = normalizeBattleActionDisplayName(resolved.finalResolvedActionName || resolved.技能 || '');
            if (!(round > 0) || !actor || !action || !Array.isArray(事件账本) || !事件账本.length) return resolved;
            const event = 事件账本.find(item =>
              item &&
              Number(item.round || item.sourceRound || 0) === round &&
              isSameBattleReportName(String(item.actorName || '').trim(), actor) &&
              [item.actionName, item.sourceActionName, item.meta?.actionName, item.meta?.sourceActionName]
                .map(name => normalizeBattleActionDisplayName(name || ''))
                .includes(action)
            );
            if (!event) return resolved;
            return {
              ...resolved,
              actionId: String(event.actionId || event.sourceActionId || '').trim(),
              sourceActionId: String(event.sourceActionId || '').trim(),
            };
          };
          const 判定轨迹需要账本门禁 = trace => {
            const normalized = 归一判定轨迹(trace || {});
            const 类型 = 读取轨迹类型(normalized);
            if (!/主动规划|应招审计|再判定审计|换招审计/.test(类型)) return false;
            if (判定侧写是自我应对动作(normalized)) return false;
            const targetSemantics = String(normalized.目标语义 || '').trim();
            const action = normalizeBattleActionDisplayName(normalized.finalResolvedActionName || normalized.技能 || '');
            const target = String(normalized.目标 || normalized.displayTargetName || '').trim();
            return /敌方|hostile/.test(targetSemantics) || (!!target && !/收招转防|承伤硬抗|肉体兜底|伺机闪避|防御|观察|待机/.test(action));
          };
          const rows = [];
          const 玩家侧名称集合 = new Set(
            [
              ...(Array.isArray(context?.combatData?.参战者?.team_player) ? context.combatData.参战者.team_player : []),
              ...(Array.isArray(context?.units) ? context.units.filter(unit => unit?.阵营 === '玩家') : []),
            ]
              .map(unit => String(unit?.name || unit?.名称 || '').trim())
              .filter(Boolean)
          );
          const 轨迹展示优先级 = 轨迹 => {
            const 类型 = 读取轨迹类型(轨迹);
            let score = 0;
            if (判定轨迹是目标规划(轨迹)) score += 10;
            if (类型 === '战术确立') score += 28;
            if (类型 === '主动规划') score += 30;
            if (类型 === '应招审计') score += 36;
            if (类型 === '换招审计') score += 38;
            if (类型 === '再判定审计') score += 34;
            if (轨迹?.动作校正?.发生校正) score += 8;
            if (String(轨迹?.技能 || '').trim()) score += 8;
            if (Number(轨迹?.最终权重 || 0) > 0) score += 4;
            return score;
          };
          const 归并附注 = (载体, 轨迹, kind = '中间推演列表') => {
            if (!载体 || !轨迹) return;
            if (!Array.isArray(载体[kind])) 载体[kind] = [];
            const normalized = 归一判定轨迹(轨迹);
            normalized.normalizedReasonKey ||= 构建判定侧写归一理由键(normalized);
            const 已存在 = 载体[kind].some(item => {
              const prev = 归一判定轨迹(item);
              const prevTarget = String(prev.displayTargetName || prev.目标 || '').trim();
              const nextTarget = String(normalized.displayTargetName || normalized.目标 || '').trim();
              return 读取轨迹类型(prev) === 读取轨迹类型(normalized) &&
                String(prev.行动者 || '').trim() === String(normalized.行动者 || '').trim() &&
                prevTarget === nextTarget &&
                String(prev.normalizedReasonKey || 构建判定侧写归一理由键(prev)) === String(normalized.normalizedReasonKey || '');
            });
            if (!已存在) 载体[kind].push(normalized);
          };
          const 标记最终命中标签 = 轨迹 => {
            if (!轨迹 || 判定轨迹是目标规划(轨迹)) return '';
            const 决断类型 = 读取判定决断类型(轨迹);
            if (决断类型 === 'keep_original') return '再判定维持';
            if (决断类型 === 'switch_action' || 轨迹?.动作校正?.发生校正) return '最终改判';
            return '最终命中';
          };
          for (let index = 0; index < rawList.length; index += 1) {
            const current = 归一判定轨迹(rawList[index] || {});
            const 推断回合 = 补齐判定轨迹回合(current, rawList.slice(0, index), rawList.slice(index + 1));
            if (推断回合 > 0 && !(Number(current.回合 || current.round || current.实际回合 || 0) > 0)) current.回合 = 推断回合;
            const currentNoCandidate =
              /无可用候选/.test(String(current.选择原因 || '')) &&
              !String(current.技能 || '').trim() &&
              读取判定流程候选列表(current, 1).length === 0;
            const handoffIndex = currentNoCandidate
              ? rawList.findIndex((item, itemIndex) => {
                  const next = 归一判定轨迹(item || {});
                  const nextRound = 补齐判定轨迹回合(next, rawList.slice(0, itemIndex), rawList.slice(itemIndex + 1));
                  if (nextRound > 0 && !(Number(next.回合 || next.round || next.实际回合 || 0) > 0)) next.回合 = nextRound;
                  return itemIndex > index &&
                    itemIndex <= index + 8 &&
                    next.行动者 === current.行动者 &&
                    Number(next.回合 || 0) === Number(current.回合 || 0) &&
                    (String(next.技能 || '').trim() || 读取判定流程候选列表(next, 1).length > 0);
                })
              : -1;
            if (handoffIndex > index) {
              const to = 归一判定轨迹(rawList[handoffIndex] || {});
              const toRound = 补齐判定轨迹回合(to, rawList.slice(0, handoffIndex), rawList.slice(handoffIndex + 1));
              if (toRound > 0 && !(Number(to.回合 || to.round || to.实际回合 || 0) > 0)) to.回合 = toRound;
              current.phaseBucket = 读取判定流程分段键(current);
              current.kind = current.phaseBucket;
              current.normalizedReasonKey = 构建判定侧写归一理由键(current);
              to.phaseBucket = 读取判定流程分段键(to);
              to.kind = to.phaseBucket;
              to.normalizedReasonKey = 构建判定侧写归一理由键(to);
              rows.push({ type: 'handoff', from: current, to });
              continue;
            }
            const 展示轨迹 = 判定轨迹是战术动作(current) ? 绑定判定轨迹到账本动作(current) : current;
            展示轨迹.phaseBucket = 读取判定流程分段键(展示轨迹);
            展示轨迹.kind = 展示轨迹.phaseBucket;
            展示轨迹.normalizedReasonKey = 构建判定侧写归一理由键(展示轨迹);
            rows.push({
              type: 'trace',
              trace: 展示轨迹,
              rawTrace: rawList[index],
            });
          }
          for (let index = rows.length - 1; index >= 0; index -= 1) {
            const item = rows[index];
            const trace = item?.type === 'handoff' ? (item.to || item.from || {}) : item?.trace;
            let round = Number(trace?.回合 || trace?.round || 0);
            if (!(round > 0)) {
              const actor = String(trace?.行动者 || '').trim();
              const nearest = rows.slice(index + 1).find(next => {
                const nextTrace = next?.type === 'handoff' ? (next.to || next.from || {}) : next?.trace;
                return nextTrace && String(nextTrace.行动者 || '').trim() === actor && Number(nextTrace.回合 || nextTrace.round || 0) > 0;
              });
              round = Number((nearest?.type === 'handoff' ? (nearest.to || nearest.from || {}) : nearest?.trace)?.回合 || 0);
            }
            if (round > 0) {
              if (item.type === 'handoff') {
                if (item.from) item.from.回合 = Number(item.from.回合 || round);
                if (item.to) item.to.回合 = Number(item.to.回合 || round);
              } else if (item.trace) {
                item.trace.回合 = Number(item.trace.回合 || round);
              }
            }
          }
          const best = new Map();
          const fallback = new Map();
          const extras = new Map();
          const otherRows = [];
          rows.forEach((item, index) => {
            if (item?.type !== 'trace') {
              otherRows.push({ ...item, __index: index });
              return;
            }
            const trace = 归一判定轨迹(item.trace || {});
            if (判定轨迹是静默辅助规划(trace)) return;
            if (事件账本.length && 判定轨迹是战术动作(trace) && !判定轨迹有账本落地(trace)) {
              标记主动叙事缺少行动事实(item.rawTrace || item.trace || trace);
              return;
            }
            const key = 构建判定流程归并键(trace);
            const rank = 轨迹展示优先级(trace) * 1000 + index;
            const store = extras.get(key) || { 中间推演列表: [], 目标遍历详情: [] };
            const isIntermediate = 判定轨迹属于中间推演(trace);
            if (isIntermediate) {
              const detailKind = /主动规划/.test(读取轨迹类型(trace)) && String(trace.目标 || trace.displayTargetName || '').trim()
                ? '目标遍历详情'
                : '中间推演列表';
              归并附注(store, trace, detailKind);
              extras.set(key, store);
              const prevFallback = fallback.get(key);
              const 保护后续主规划 =
                /主动规划/.test(读取轨迹类型(trace)) &&
                Number(trace.回合 || trace.round || 0) >= 2;
              if (!prevFallback || rank >= prevFallback.rank || 保护后续主规划) {
                fallback.set(key, { item: { ...item, trace }, rank, index });
              }
              return;
            }
            const prev = best.get(key);
            if (!prev || rank >= prev.rank) {
              if (prev?.item?.trace) {
                归并附注(store, 归一判定轨迹(prev.item.trace), '中间推演列表');
                extras.set(key, store);
              }
              best.set(key, { item: { ...item, trace }, rank, index });
            } else {
              归并附注(store, trace, '中间推演列表');
              extras.set(key, store);
            }
          });
          const mergedTraceRows = [];
          const allKeys = new Set([...best.keys(), ...fallback.keys()]);
          [...allKeys].forEach(key => {
            const entry = best.get(key) || fallback.get(key);
            if (!entry?.item?.trace) return;
            const trace = 归一判定轨迹(entry.item.trace);
            const extra = extras.get(key);
            if (extra?.中间推演列表?.length) trace.中间推演列表 = extra.中间推演列表;
            if (extra?.目标遍历详情?.length && !判定轨迹静默目标遍历详情(trace)) trace.目标遍历详情 = extra.目标遍历详情;
            trace.最终命中标签 = 标记最终命中标签(trace);
            mergedTraceRows.push({ type: 'trace', trace, __index: entry.index });
          });
          const 主动规划主卡保留 = new Map();
          mergedTraceRows.forEach(item => {
            const trace = 归一判定轨迹(item?.trace || {});
            if (读取轨迹类型(trace) !== '主动规划') return;
            const actor = String(trace.行动者 || '').trim();
            const round = Number(trace.回合 || trace.round || 0);
            if (!actor || !(round > 0)) return;
            const key = `${round}::${actor}`;
            const action = normalizeBattleActionDisplayName(trace.finalResolvedActionName || trace.技能 || '');
            const reason = String(trace.选择原因 || '').trim();
            const score =
              (Number(trace.最终权重 || 0) > 0 ? 1000 : 0) +
              (action ? 120 : 0) +
              (/守势观察|未形成有效出手机会/.test(reason) ? 0 : 40) +
              Number(item?.__index || 0);
            const prev = 主动规划主卡保留.get(key);
            if (!prev || score >= prev.score) 主动规划主卡保留.set(key, { item, score });
          });
          const 主动规划附注 = new Set();
          mergedTraceRows.forEach(item => {
            const trace = 归一判定轨迹(item?.trace || {});
            if (读取轨迹类型(trace) !== '主动规划') return;
            const actor = String(trace.行动者 || '').trim();
            const round = Number(trace.回合 || trace.round || 0);
            if (!actor || !(round > 0)) return;
            const key = `${round}::${actor}`;
            const keep = 主动规划主卡保留.get(key)?.item;
            if (!keep || keep === item) return;
            const targetTrace = keep.trace || {};
            targetTrace.中间推演列表 ||= [];
            const 已存在 = targetTrace.中间推演列表.some(extra => {
              const prev = 归一判定轨迹(extra);
              return 读取轨迹类型(prev) === '主动规划' &&
                String(prev.行动者 || '').trim() === actor &&
                normalizeBattleActionDisplayName(prev.finalResolvedActionName || prev.技能 || '') ===
                  normalizeBattleActionDisplayName(trace.finalResolvedActionName || trace.技能 || '') &&
                String(prev.选择原因 || '').trim() === String(trace.选择原因 || '').trim();
            });
            if (!已存在) targetTrace.中间推演列表.push(trace);
            主动规划附注.add(item);
          });
          const 自保主规划键集合 = new Set(
            mergedTraceRows
              .map(item => 归一判定轨迹(item?.trace || {}))
              .filter(trace => 读取轨迹类型(trace) === '主动规划' && 判定侧写是自我应对动作(trace))
              .map(trace => `${Number(trace.回合 || trace.round || 0)}::${String(trace.行动者 || '').trim()}`)
          );
          const allRows = [...mergedTraceRows, ...otherRows]
            .filter(item => {
              if (主动规划附注.has(item)) return false;
              if (item?.type !== 'trace') return true;
              const trace = 归一判定轨迹(item.trace || {});
              if (!判定轨迹是目标规划(trace)) return true;
              return !自保主规划键集合.has(`${Number(trace.回合 || trace.round || 0)}::${String(trace.行动者 || '').trim()}`);
            })
            .sort((左, 右) =>
              Number((左?.trace || 左?.to || 左?.from || {}).回合 || 0) - Number((右?.trace || 右?.to || 右?.from || {}).回合 || 0) ||
              Number(左?.__index || 0) - Number(右?.__index || 0));
          const visibleRoundSet = new Set();
          公开战报行
            .map(line => Number(String(line || '').match(/^第(\d+)回合：/)?.[1] || 0))
            .filter(round => round > 0)
            .forEach(round => visibleRoundSet.add(round));
          (Array.isArray(事件账本) ? 事件账本 : []).forEach(event => {
            const round = Number(event?.round || event?.sourceRound || 0);
            if (!(round > 0)) return;
            const kind = String(event?.eventKind || '').trim();
            const action = normalizeBattleActionDisplayName(event?.finalActionName || event?.actionName || event?.sourceActionName || '');
            const result = String(event?.result || event?.primaryOutcome || event?.meta?.primaryOutcome || '').trim();
            const reason = String(event?.failReason || event?.failureReason || event?.meta?.failureReason || event?.reasonCode || event?.meta?.reasonCode || '').trim();
            const 是行动轴事件 = [
              'action_start', 'pass', 'defend', 'dodge', 'blocked_action', 'failed_action', 'target_fail',
              'hit_result', 'state_apply', 'state_tick', 'resource_change', 'create', 'summon_create', 'shield_create',
            ].includes(kind);
            if (!是行动轴事件) return;
            if (判定公开战报事件是内部兜底(event) && !/战术待机|待机|观察|防御|收招转防|守势|pass|observe|defend|stance/i.test(`${action} ${result} ${reason}`)) return;
            visibleRoundSet.add(round);
          });
          const visibleRows = visibleRoundSet.size
            ? allRows.filter(item => {
                const trace = item?.trace || item?.to || item?.from || {};
                const round = Number(trace?.回合 || trace?.round || 0);
                return !(round > 0) || visibleRoundSet.has(round);
              })
            : allRows;
          const groupedRows = new Map();
          const 玩家手选主卡 = [];
          if (玩家侧名称集合.size) {
            const 已有主卡键 = new Set(
              visibleRows
                .filter(item => item?.type === 'trace')
                .map(item => 归一判定轨迹(item.trace || {}))
                .filter(trace => /战术确立|主动规划/.test(读取轨迹类型(trace)))
                .map(trace => `${Number(trace.回合 || trace.round || 0)}::${String(trace.行动者 || '').trim()}`)
            );
            const 账本手选动作 = (Array.isArray(事件账本) ? 事件账本 : [])
              .filter(event =>
                event &&
                String(event.eventKind || '').trim() === 'action_start' &&
                Number(event.round || event.sourceRound || 0) > 0 &&
                玩家侧名称集合.has(String(event.actorName || event.actor || '').trim())
              )
              .sort((left, right) =>
                Number(left.round || left.sourceRound || 0) - Number(right.round || right.sourceRound || 0) ||
                String(left.actionId || '').localeCompare(String(right.actionId || ''), 'zh-Hans-CN'));
            账本手选动作.forEach((event, index) => {
                const actor = String(event.actorName || event.actor || '').trim();
                const round = Number(event.round || event.sourceRound || 0);
                const key = `${round}::${actor}`;
                if (已有主卡键.has(key)) return;
                const actionName = normalizeBattleActionDisplayName(event.actionName || event.finalActionName || event.meta?.actionName || event.meta?.finalActionName || '');
                if (!actionName || /未完成动作|行动失败|系统反击|承伤硬抗|肉体兜底|伺机闪避/.test(actionName)) return;
                const sameRoundTrace = visibleRows
                  .map(row => row?.type === 'trace' ? 归一判定轨迹(row.trace || {}) : null)
                  .find(trace =>
                    trace &&
                    Number(trace.回合 || trace.round || 0) === round &&
                    isSameBattleReportName(String(trace.行动者 || '').trim(), actor)
                  );
                const targetNameRaw = String(event.targetName || sameRoundTrace?.displayTargetName || sameRoundTrace?.目标 || sameRoundTrace?.实际目标 || '').trim();
                const targetSemantics = String(sameRoundTrace?.目标语义 || event.targetPoolSide || '').trim();
                const carryMode = String(sameRoundTrace?.承载方式 || event.actionType || '').trim();
                const ledgerTargetSide = String(event.targetPoolSide || event.targetSide || '').trim();
                const actionType = String(event.actionType || '').trim();
                const nonHostileTarget =
                  判定侧写是造物或自用动作(sameRoundTrace || {}) ||
                  判定侧写是友方支援动作(sameRoundTrace || {}) ||
                  (/自身|友方单体|友方群体|造物承载/.test(targetSemantics)) ||
                  /self|ally|support|create|summon|shield/i.test(`${ledgerTargetSide}|${actionType}`) ||
                  /造物|物品|药剂|食物|牛肉干|护壁|鼓舞/.test(actionName);
                const targetName = nonHostileTarget ? '' : targetNameRaw;
                玩家手选主卡.push({
                  type: 'trace',
                  trace: 归一判定轨迹({
                    type: '战术确立',
                    actor,
                    target: targetName,
                    skill: actionName,
                    round,
                    选择原因: '玩家已手选本轮主轴动作',
                    候选来源: '玩家手选动作',
                    finalResolvedActionName: actionName,
                    displayTargetName: targetName,
                    目标语义: targetSemantics,
                    承载方式: carryMode,
                    actionId: String(event.actionId || '').trim(),
                    sourceActionId: String(event.sourceActionId || '').trim(),
                    playerLockedSource: 'eventLedger',
                  }),
                  __index: -1000 + index,
                });
                已有主卡键.add(key);
              });
          }
          [...玩家手选主卡, ...visibleRows].forEach(item => {
            const round = Number((item?.trace || item?.to || item?.from || {}).回合 || 0);
            const key = round > 0 ? `round:${round}` : `raw:${groupedRows.size}`;
            if (!groupedRows.has(key)) groupedRows.set(key, []);
            groupedRows.get(key).push(item);
          });
          return [...groupedRows.entries()]
            .sort((左, 右) => {
              const 左回合 = Number(String(左[0]).replace(/^round:/, '') || 0);
              const 右回合 = Number(String(右[0]).replace(/^round:/, '') || 0);
              return 左回合 - 右回合;
            })
            .flatMap(([, rows]) => {
              if (rows.length <= 10) return rows;
              const lockedRows = rows.filter(item => {
                if (item?.type !== 'trace') return false;
                return 读取轨迹类型(归一判定轨迹(item.trace || {})) === '战术确立';
              });
              const lockedSet = new Set(lockedRows);
              const tailRows = rows.filter(item => !lockedSet.has(item)).slice(-(10 - Math.min(lockedRows.length, 10)));
              return [...lockedRows.slice(0, 10), ...tailRows];
            })
            .map(item => {
              if ('__index' in item) delete item.__index;
              return item;
            });
        }

        function 读取结算轨迹值(traceRows = [], key = '') {
          const row = (Array.isArray(traceRows) ? traceRows : []).find(item => String(item?.key || '').trim() === key);
          return row?.value;
        }

        function 因果链节点默认可见(node = {}) {
          const kind = String(node?.nodeKind || '').trim();
          if (kind !== 'counter_window') return true;
          const result = String(node?.result || '').trim();
          const reasonCode = String(node?.reasonCode || '').trim();
          const outcome = String(node?.primaryOutcome || '').trim();
          const failureReason = String(node?.failureReason || node?.reasonText || '').trim();
          if (result === 'opened' || reasonCode === 'COUNTER_WINDOW_OPENED') return true;
          if (reasonCode === 'COUNTER_WINDOW_MISSED' || /missed|错失/i.test(`${result} ${outcome} ${failureReason}`)) return true;
          if (reasonCode === 'NO_EFFECTIVE_OPENING' || outcome === 'no_valid_window' || /no_valid|未形成稳定|未满足门槛/.test(failureReason)) return false;
          return /missed|错失|失败|fail/i.test(`${result} ${reasonCode} ${outcome} ${failureReason}`);
        }

        function 构建因果链行动区块条目(resolutionTrace = [], decisionTrace = []) {
          const nodes = (Array.isArray(resolutionTrace) ? resolutionTrace : [])
            .filter(item => item && typeof item === 'object');
          if (!nodes.length) return [];
          const behaviorTraceByActorRound = new Map();
          (Array.isArray(decisionTrace) ? decisionTrace : [])
            .map(item => 归一判定轨迹(item || {}))
            .filter(item => item && /战术确立|主动规划|应招审计|再判定审计|换招审计/.test(读取轨迹类型(item)))
            .forEach(item => {
              const key = `${Number(item.回合 || 0)}::${String(item.行动者 || '').trim()}`;
              if (!String(item.行动者 || '').trim() || !(Number(item.回合 || 0) > 0)) return;
              if (!behaviorTraceByActorRound.has(key)) behaviorTraceByActorRound.set(key, []);
              behaviorTraceByActorRound.get(key).push(item);
            });
          const nodeById = new Map(nodes.map(node => [String(node?.nodeId || '').trim(), node]).filter(([id]) => id));
          const byParent = new Map();
          nodes.forEach(node => {
            const parent = String(node.parentNodeId || '').trim();
            if (!parent) return;
            if (!byParent.has(parent)) byParent.set(parent, []);
            byParent.get(parent).push(node);
          });
          const initialIntentByActorRound = new Map();
          nodes
            .filter(node => String(node.nodeKind || '').trim() === 'initial_intent')
            .forEach(node => {
              const key = `${Number(node.round || 0)}::${String(node.actorName || '').trim()}`;
              if (!initialIntentByActorRound.has(key)) initialIntentByActorRound.set(key, []);
              initialIntentByActorRound.get(key).push(node);
            });
          const actionRoots = nodes.filter(node => String(node.nodeKind || '') === 'action_decision' && String(node.finalActionName || '').trim());
          const blocks = actionRoots.map(root => {
            const children = byParent.get(String(root.nodeId || '').trim()) || [];
            const resultChildren = children.filter(node => ['target_branch', 'replan_decision', 'reaction_window', 'reaction_decision', 'hit_check', 'state_check', 'damage_settlement', 'state_settlement', 'counter_action', 'counter_window', 'summon_assist', 'final_result'].includes(String(node.nodeKind || '')) && 因果链节点默认可见(node));
            const intentCandidates = initialIntentByActorRound.get(`${Number(root.round || 0)}::${String(root.actorName || '').trim()}`) || [];
            const rootTarget = String(root.targetName || '').trim();
            const rootInitial = normalizeBattleActionDisplayName(root.initialActionName || root.finalActionName || '');
            const initialIntent = intentCandidates.find(node =>
              normalizeBattleActionDisplayName(node.initialActionName || '') === rootInitial &&
              (!rootTarget || !String(node.targetName || '').trim() || String(node.targetName || '').trim() === rootTarget)
            ) || intentCandidates.find(node => !rootTarget || !String(node.targetName || '').trim() || String(node.targetName || '').trim() === rootTarget) || intentCandidates[0] || null;
            return {
              type: 'resolution_action_block',
              round: Number(root.round || 0),
              回合: Number(root.round || 0),
              roundPhase: 'action_chain',
              root,
              initialIntent,
              children: resultChildren,
              behaviorTraces: behaviorTraceByActorRound.get(`${Number(root.round || 0)}::${String(root.actorName || '').trim()}`) || [],
              byParent,
              nodeById,
              fromResolutionTrace: true,
            };
          }).filter(item => item.root);
          const coveredNodeIds = new Set(blocks.flatMap(item => [item.root, ...读取因果链全量子节点(item)].map(node => String(node?.nodeId || '').trim()).filter(Boolean)));
          nodes
            .filter(node => {
              if (String(node.nodeKind || '').trim() !== 'final_result') return false;
              if (!['summon_created', 'item_created'].includes(String(node.primaryOutcome || '').trim())) return false;
              return !coveredNodeIds.has(String(node.nodeId || '').trim());
            })
            .forEach(node => {
              const outcome = String(node.primaryOutcome || '').trim();
              const isSummon = outcome === 'summon_created';
              const sourceAction = normalizeBattleActionDisplayName(读取结算轨迹值(node.calculationTrace, 'sourceAction') || node.finalActionName || node.actionName || (isSummon ? '召唤' : '造物'));
              const createdName = String(
                isSummon
                  ? (读取结算轨迹值(node.calculationTrace, 'summonName') || node.summonName || node.targetName || '')
                  : (读取结算轨迹值(node.calculationTrace, 'createdName') || node.createdName || node.targetName || '')
              ).trim();
              const presentationNodeId = `presentation:${node.nodeId || createdName || sourceAction}`;
              const actorName = String(node.actorName || 读取结算轨迹值(node.calculationTrace, 'actor') || '').trim();
              blocks.push({
                type: 'resolution_action_block',
                round: Number(node.round || 0),
                回合: Number(node.round || 0),
                roundPhase: 'action_chain',
                root: {
                  nodeId: presentationNodeId,
                  round: Number(node.round || 0),
                  nodeKind: 'action_decision',
                  actorName,
                  targetName: createdName || actorName,
                  finalActionName: sourceAction,
                  source: isSummon ? 'summon_create' : 'create',
                },
                children: [node],
                behaviorTraces: behaviorTraceByActorRound.get(`${Number(node.round || 0)}::${actorName}`) || [],
                byParent: new Map([[presentationNodeId, [node]]]),
                nodeById: new Map([[String(node?.nodeId || '').trim(), node]].filter(([id]) => id)),
                fromResolutionTrace: true,
              });
            });
          const blockKey = item => [
            Number(item?.round || item?.回合 || 0),
            String(item?.root?.actorName || '').trim(),
            normalizeBattleActionDisplayName(item?.root?.finalActionName || item?.root?.actionName || ''),
            String(item?.root?.targetName || '').trim(),
          ].join('::');
          const blockDetailScore = item => 读取因果链全量子节点(item)
            .filter(node => !['action_decision'].includes(String(node?.nodeKind || '').trim()))
            .length;
          const bestByKey = new Map();
          blocks.forEach(item => {
            const key = blockKey(item);
            const prev = bestByKey.get(key);
            if (!prev || blockDetailScore(item) > blockDetailScore(prev)) bestByKey.set(key, item);
          });
          return Array.from(bestByKey.values());
        }

        function 构建因果链回合末聚合条目(resolutionTrace = []) {
          return (Array.isArray(resolutionTrace) ? resolutionTrace : [])
            .filter(node => node && typeof node === 'object' && String(node.nodeKind || '').trim() === 'aggregation')
            .map(node => {
              const aggregateKind = String(node.aggregateKind || node.primaryOutcome || 'state_tick').trim();
              const stateName = String(node.stateName || 读取结算轨迹值(node.calculationTrace, 'stateName') || '持续状态').trim();
              const total = Math.max(0, Number(读取结算轨迹值(node.calculationTrace, 'totalAmount') || 0));
              const childCount = Math.max(0, Number(读取结算轨迹值(node.calculationTrace, 'childCount') || (Array.isArray(node.childNodeIds) ? node.childNodeIds.length : 0)));
              const isHeal = aggregateKind === 'heal_tick';
              const text = `【${stateName}】持续结算，${childCount} 个目标共${isHeal ? '恢复' : '损失'} ${Math.round(total)} 点`;
              return {
                type: 'settlement_aggregation',
                round: Number(node.round || 0),
                回合: Number(node.round || 0),
                roundPhase: 'turn_end',
                kind: 'status_tick_aggregation',
                aggregateKind,
                stateName,
                childNodeIds: Array.isArray(node.childNodeIds) ? node.childNodeIds : [],
                ledgerEventIds: Array.isArray(node.ledgerEventIds) ? node.ledgerEventIds : [],
                sourceNodeIds: Array.isArray(node.childNodeIds) ? node.childNodeIds : [],
                sourceEventIds: Array.isArray(node.ledgerEventIds) ? node.ledgerEventIds : [],
                text,
                children: [],
                fromResolutionTrace: true,
              };
            });
        }

        function 读取因果链全量子节点(条目 = {}) {
          const result = [];
          const byParent = 条目?.byParent instanceof Map ? 条目.byParent : new Map();
          const visit = node => {
            if (!node || typeof node !== 'object') return;
            result.push(node);
            (byParent.get(String(node.nodeId || '').trim()) || []).forEach(visit);
          };
          (Array.isArray(条目?.children) ? 条目.children : []).forEach(visit);
          return result;
        }

        function 计算因果链展示权重(条目 = {}) {
          const root = 条目?.root || {};
          const finalAction = normalizeBattleActionDisplayName(root.finalActionName || root.actionName || '');
          const initialAction = normalizeBattleActionDisplayName(root.initialActionName || '');
          const discardedAction = normalizeBattleActionDisplayName(root.discardedActionName || (initialAction && initialAction !== finalAction ? initialAction : ''));
          const nodes = 读取因果链全量子节点(条目);
          let score = /普通攻击/.test(finalAction) ? 1 : /魂技|真身|融合|爆发/.test(finalAction) ? 6 : 3;
          let childEscalated = false;
          const reasons = [];
          const actorSide = BATTLE_RUNTIME.normalizeBattleSide(root.actorSide || '');
          const targetSide = BATTLE_RUNTIME.normalizeBattleSide(root.targetSide || '');
          const rootSource = String(root.source || root.meta?.source || '').trim();
          const rootActorName = String(root.actorName || '').trim();
          const rootIsSummonAction = rootSource === 'summon' || /召唤/.test(String(root.actionType || root.sourceType || ''));
          const 节点是否玩家受击事实 = node => {
            const kind = String(node?.nodeKind || '').trim();
            if (BATTLE_RUNTIME.normalizeBattleSide(node?.targetSide || '') !== 'player') return false;
            const nodeTargetName = String(node?.targetName || '').trim();
            if (rootIsSummonAction && rootActorName && isSameBattleReportName(nodeTargetName, rootActorName)) return false;
            const damage = Number(读取结算轨迹值(node?.calculationTrace, 'finalDamage') || 读取结算轨迹值(node?.calculationTrace, 'damage') || 0);
            if (['damage_settlement', 'counter_action'].includes(kind)) return damage > 0;
            if (kind === 'state_settlement') {
              const stateName = String(读取结算轨迹值(node?.calculationTrace, 'stateName') || node?.stateName || '').trim();
              return !!stateName && !/immune|resist|免疫|抵抗|豁免/.test(String(node?.result || node?.primaryOutcome || ''));
            }
            return false;
          };
          if (actorSide === 'player' || root.isPlayerAction === true) {
            score += 4;
            reasons.push(rootIsSummonAction ? '召唤行动' : '玩家行动');
          }
          if (actorSide !== 'player' && targetSide === 'player') {
            score += 4;
            reasons.push('敌方行动');
          }
          if (discardedAction && discardedAction !== finalAction) {
            score += 7;
            childEscalated = true;
            reasons.push('变招');
          }
          nodes.forEach(node => {
            const kind = String(node?.nodeKind || '').trim();
            const outcome = String(node?.primaryOutcome || '').trim();
            const stateName = String(读取结算轨迹值(node?.calculationTrace, 'stateName') || node?.stateName || '').trim();
            const damage = Number(读取结算轨迹值(node?.calculationTrace, 'finalDamage') || 读取结算轨迹值(node?.calculationTrace, 'damage') || 0);
            if (节点是否玩家受击事实(node)) {
              score += 8;
              childEscalated = true;
              reasons.push('玩家受击');
            }
            if (kind === 'counter_action') {
              score += 9;
              childEscalated = true;
              reasons.push(Number(node?.counterDepth || 0) >= 2 ? '反防反' : '防反');
            } else if (kind === 'summon_assist') {
              score += 7;
              childEscalated = true;
              reasons.push('召唤协同');
            } else if (kind === 'state_settlement') {
              const control = /控制|眩晕|麻痹|僵直|禁锢|束缚|定身|冻结|沉默|封锁/.test(stateName);
              score += control ? 7 : 4;
              if (control) childEscalated = true;
              reasons.push(stateName ? `状态:${stateName}` : '状态');
            } else if (kind === 'damage_settlement') {
              if (damage >= 100) {
                score += 6;
                childEscalated = true;
                reasons.push('重创');
              } else if (damage > 0) score += 2;
              if (/kill|fatal|濒危|击杀|免死/.test(outcome)) {
                score += 10;
                childEscalated = true;
                reasons.push('致命');
              }
            } else if (kind === 'counter_window' && /missed|错失|失败/.test(String(node?.reasonCode || node?.result || ''))) {
              score += 4;
              reasons.push('窗口错失');
            }
          });
          const eventWeight = score >= 16 ? 'critical' : score >= 9 ? 'high' : score >= 4 ? 'medium' : 'low';
          return {
            score,
            eventWeight,
            childEscalated,
            collapse: eventWeight === 'low' && !childEscalated,
            reasons: [...new Set(reasons)].slice(0, 3),
          };
        }
        function 渲染因果链行动区块(条目 = {}) {
          const root = 条目?.root || {};
          const 构建ActionChainDTO = actionRoot => {
            const initial = normalizeBattleActionDisplayName(actionRoot.initialActionName || '');
            const final = normalizeBattleActionDisplayName(actionRoot.finalActionName || actionRoot.actionName || '行动');
            return {
              actorName: String(actionRoot.actorName || '行动者').trim(),
              targetName: String(actionRoot.targetName || '').trim(),
              initialActionName: initial,
              finalActionName: final,
              discardedActionName: normalizeBattleActionDisplayName(actionRoot.discardedActionName || (initial && initial !== final ? initial : '')),
              actionStatus: String(actionRoot.actionStatus || actionRoot.meta?.actionStatus || '').trim(),
            };
          };
          const actionDTO = 构建ActionChainDTO(root);
          const initialIntentNode = 条目?.initialIntent || null;
          const children = Array.isArray(条目?.children) ? 条目.children : [];
          const behaviorTraces = Array.isArray(条目?.behaviorTraces) ? 条目.behaviorTraces : [];
          const byParent = 条目?.byParent instanceof Map ? 条目.byParent : new Map();
          const nodeById = 条目?.nodeById instanceof Map ? 条目.nodeById : new Map([[String(root?.nodeId || '').trim(), root], ...children.map(node => [String(node?.nodeId || '').trim(), node])].filter(([id]) => id));
          const actor = actionDTO.actorName;
          const target = actionDTO.targetName;
          const initialAction = actionDTO.initialActionName;
          const finalAction = actionDTO.finalActionName;
          const discardedAction = actionDTO.discardedActionName;
          const lines = [];
          const detailLines = [];
          const renderedSettlementKeys = new Set();
          const renderedReplanKeys = new Set();
          const pushTimelineLine = (text, kind = 'detail', options = {}) => {
            const lineText = String(text || '').trimEnd();
            if (!lineText) return;
            const item = { text: lineText, kind: String(kind || 'detail').trim() || 'detail' };
            if (Array.isArray(options?.evidence) && options.evidence.length) item.evidence = options.evidence;
            if (options && options.detail === true) detailLines.push(item);
            else lines.push(item);
          };
          const pushDetailLine = (text, kind = 'detail', options = {}) => pushTimelineLine(text, kind, { ...options, detail: true });
          const mapTimelineKindFromNode = nodeKind => {
            const kind = String(nodeKind || '').trim();
            if (kind === 'initial_intent' || kind === 'replan_decision') return 'intent';
            if (kind === 'reaction_window' || kind === 'reaction_decision') return 'reaction';
            if (kind === 'hit_check' || kind === 'state_check') return 'check';
            if (kind === 'damage_settlement' || kind === 'state_settlement' || kind === 'final_result' || kind === 'summon_assist') return 'settlement';
            if (kind === 'counter_window' || kind === 'counter_action') return 'counter';
            if (kind === 'target_branch') return 'branch';
            return 'detail';
          };
          if (initialIntentNode) {
            const plannedAction = normalizeBattleActionDisplayName(initialIntentNode.initialActionName || '行动');
            const plannedTarget = String(initialIntentNode.targetName || target || '').trim();
            const timingBucket = String(读取结算轨迹值(initialIntentNode.calculationTrace, 'timingBucket') || '').trim();
            pushTimelineLine(`├─ 初始意图：【${plannedAction}】${plannedTarget ? ` 指向${plannedTarget}` : ''}${timingBucket ? `（行动窗口 ${timingBucket}）` : ''}`, 'intent');
          }
          const 映射行动链变招原因短语 = node => {
            const code = String(node?.replanReasonCode || node?.reasonCode || '').trim().toUpperCase();
            const text = String(node?.replanReasonText || node?.reasonText || '').trim();
            if (code === 'INTERRUPTED_BY_SPEED') return '被对手抢先压制';
            if (code === 'TARGET_REPOSITIONED' || code === 'TARGET_LOST') return '原目标失去有效落点';
            if (code === 'RESOURCE_INSUFFICIENT') return '资源不足';
            if (code === 'CONTROLLED') return '状态限制';
            if (code === 'OUT_OF_RANGE') return '距离不满足';
            if (code === 'NO_VALID_TARGET') return '缺少合法目标';
            if (code === 'NO_EFFECTIVE_OPENING') return '没有合适出手窗口';
            if (code === 'TACTICAL_DISADVANTAGE' && /抢先压制|先手压制|不宜继续前压|有效出手窗口|有效出手机会|窗口/.test(text)) {
              return text.replace(/后调整动作|调整动作/g, '').replace(/[，。；\s]+$/g, '').trim();
            }
            return '';
          };
          if (discardedAction && discardedAction !== finalAction) {
            const reason = 映射行动链变招原因短语(root);
            renderedReplanKeys.add(`${discardedAction}|${finalAction}|${reason}`);
            pushTimelineLine(`├─ 原计划【${discardedAction}】${reason ? `，因${reason}` : ''}改为【${finalAction}】`, 'intent');
          } else {
            const rootSource = String(root.source || '').trim();
            const rootOutcomes = children.map(node => String(node?.primaryOutcome || '').trim()).filter(Boolean);
            if (rootSource === 'create' || rootOutcomes.includes('item_created')) {
              const createdChild = children.find(node => String(node?.primaryOutcome || '').trim() === 'item_created') || null;
              const createdName = String(读取结算轨迹值(createdChild?.calculationTrace, 'createdName') || createdChild?.createdName || target || '').trim();
              pushTimelineLine(`├─ 最终动作：【${finalAction}】 生成${createdName ? `【${createdName}】` : '造物'}`, 'detail');
            } else if (rootSource === 'summon_create' || rootOutcomes.includes('summon_created')) {
              const summonChild = children.find(node => String(node?.primaryOutcome || '').trim() === 'summon_created') || null;
              const summonName = String(读取结算轨迹值(summonChild?.calculationTrace, 'summonName') || summonChild?.summonName || target || '').trim();
              pushTimelineLine(`├─ 最终动作：【${finalAction}】 召出${summonName ? `【${summonName}】` : '召唤物'}`, 'detail');
            } else {
              pushTimelineLine(`├─ 最终动作：【${finalAction}】${target ? ` 指向${target}` : ''}`, 'detail');
            }
          }
          const 判定候选链不可信 = trace => {
            const candidates = 构建CandidatePoolDTO(trace);
            const finalActionName = normalizeBattleActionDisplayName(trace?.finalResolvedActionName || trace?.最终动作 || trace?.技能 || trace?.finalActionName || '');
            const finalMissingFromPool = !!(finalActionName && candidates.length && !candidates.some(item => item.name === finalActionName));
            const selectedWithRejectCode = candidates.some(item => ['SELECTED', 'LOCKED', 'EXECUTED'].includes(item.status) && item.rejectionCode);
            const explicitStatusMissing = 读取判定流程候选列表(trace, 0).some(item => !String(item?.candidateStatus || item?.状态 || item?.status || '').trim());
            const backfillSource = /回填|最终落点|执行声明|终态回填|系统/i.test(String(trace?.actionOverrideSource || trace?.动作覆写来源 || ''));
            return finalMissingFromPool || selectedWithRejectCode || explicitStatusMissing || backfillSource;
          };
          const 读取权重公式信任状态 = trace => {
            const normalized = 归一判定轨迹(trace || {});
            const pieces = [
              Number(normalized.原始权重 || normalized.原始净收益 || 0),
              Number(normalized.战术修正 || 0),
              Number(normalized.目标修正 || 0) + Number(normalized.目标价值修正 || 0),
              Number(normalized.资源修正 || 0),
              Number(normalized.团队意图修正 || 0),
              Number(normalized.二回合前瞻修正 || 0),
              Number(normalized.职责修正 || 0),
            ].filter(value => Number.isFinite(value) && Math.abs(value) >= 1);
            const finalWeight = Number(normalized.最终权重 || 0);
            if (!Number.isFinite(finalWeight)) return { level: 'MISSING_OPERAND', diff: 0 };
            if (pieces.length < 2 && Math.abs(finalWeight) >= 1) return { level: 'MISSING_OPERAND', diff: 0 };
            const diff = Math.round(finalWeight - pieces.reduce((sum, value) => sum + value, 0));
            return { level: Math.abs(diff) > 1 ? 'HIDDEN_UNBALANCED' : 'TRUSTED', diff };
          };
          const 判定战术侧写可信 = trace => {
            if (!trace || /再判定审计|换招审计|应招审计/.test(读取轨迹类型(trace))) return false;
            if (判定候选链不可信(trace)) return false;
            return true;
          };
          const 构建行为演算明细行 = trace => {
            const normalized = 归一判定轨迹(trace || {});
            if (!/再判定审计|换招审计|应招审计/.test(读取轨迹类型(normalized))) return formatTacticalNarration(构建NarrativeDecisionDTO(normalized));
            const dto = /再判定审计/.test(读取轨迹类型(normalized))
              ? 构建ReplanAuditDTO(normalized)
              : 构建ActivePlanDTO(normalized);
            const label = dto.auditKind === 'replan'
              ? '再判定'
              : (/应招审计/.test(dto.auditType || '') ? '反应判定' : '主动规划');
            const parts = [`${label}：${dto.actorName || actor}`];
            if (dto.auditKind === 'replan') {
              if (dto.sourceActionName) parts.push(`应对【${dto.sourceActorName ? `${dto.sourceActorName}的` : ''}${dto.sourceActionName}】`);
              if (dto.replanActionName) parts.push(`选择【${dto.replanActionName}】`);
            } else if (/应招审计/.test(dto.auditType || '')) {
              const sourceActorName = String(dto.sourceActorName || normalized.sourceActorName || normalized.来源行动者 || '').trim();
              const sourceActionName = normalizeBattleActionDisplayName(dto.sourceActionName || normalized.sourceActionName || normalized.来源动作 || '');
              if (sourceActionName) parts.push(`应对【${sourceActorName ? `${sourceActorName}的` : ''}${sourceActionName}】`);
              else parts.push('应对当前来袭动作');
              if (dto.finalActionName) parts.push(`选择【${dto.finalActionName}】`);
            } else {
              if (dto.finalActionName) parts.push(`执行【${dto.finalActionName}】`);
              if (dto.targetName) parts.push(`目标【${dto.targetName}】`);
            }
            return parts.join('，');
          };
          const 归一玩家态意图标签 = (intent = '', dto = {}) => {
            const raw = String(intent || '').trim();
            const actorName = String(dto?.actorName || actor || '').trim();
            const targetName = String(dto?.targetName || '').trim();
            if (actorName && targetName && actorName !== targetName && !/我方|友方|自身|全体|前排|后排/.test(targetName)) {
              if (/保核/.test(raw)) return '护核压制';
              if (/防守/.test(raw)) return '守势反击';
              if (/治疗|驱散|辅助|支援/.test(raw)) return '支援转压制';
            }
            return raw;
          };
          const 构建ActivePlanDTO = trace => {
            const normalized = 归一判定轨迹(trace || {});
            const selectedCandidate = 读取判定流程候选列表(normalized, 0).find(item => ['EXECUTED', 'LOCKED', 'SELECTED'].includes(读取候选状态(item, normalized))) || null;
            const targetName = target || 修正支援类判定目标名(normalized, actor);
            const dto = {
              auditKind: 'active',
              auditType: 读取轨迹类型(normalized),
              actorName: String(normalized.行动者 || '').trim(),
              intent: String(normalized.战略意图 || '').trim(),
              hitCandidateName: normalizeBattleActionDisplayName(读取候选名称(selectedCandidate || {}) || normalized.selectedCandidateName || ''),
              finalActionName: normalizeBattleActionDisplayName(normalized.finalResolvedActionName || normalized.技能 || normalized.hitCandidateName || '行动'),
              targetName,
            };
            dto.intent = 归一玩家态意图标签(dto.intent, dto);
            return dto;
          };
          const 构建ReplanAuditDTO = trace => {
            const normalized = 归一判定轨迹(trace || {});
            const selectedCandidate = 读取判定流程候选列表(normalized, 0).find(item => ['EXECUTED', 'LOCKED', 'SELECTED'].includes(读取候选状态(item, normalized))) || null;
            const hit = normalizeBattleActionDisplayName(读取候选名称(selectedCandidate || {}) || normalized.selectedCandidateName || '');
            return {
              auditKind: 'replan',
              auditType: 读取轨迹类型(normalized),
              actorName: String(normalized.reactionActorName || normalized.行动者 || '').trim(),
              intent: String(normalized.战略意图 || '').trim(),
              sourceActorName: String(normalized.sourceActorName || normalized.来源行动者 || '').trim(),
              sourceActionName: normalizeBattleActionDisplayName(normalized.sourceActionName || normalized.来源动作 || ''),
              replanActionName: normalizeBattleActionDisplayName(normalized.replanActionName || hit || normalized.finalResolvedActionName || normalized.技能 || ''),
            };
          };
          const 构建候选池明细行 = trace => {
            return '';
          };
          const 构建再判定定义行 = trace => {
            if (!/再判定审计/.test(读取轨迹类型(trace))) return '';
            const names = 读取判定流程候选列表(trace, 0).map(读取候选名称).filter(Boolean);
            const definitions = [];
            if (names.some(name => /抢落点/.test(name))) definitions.push('抢落点：争夺动作落点或先后窗口');
            if (names.some(name => /压招/.test(name))) definitions.push('压招：用当前动作压过对方动作');
            if (names.some(name => /偏转/.test(name))) definitions.push('偏转：降低或改变来袭效果');
            if (names.some(name => /伺机闪避/.test(name))) definitions.push('伺机闪避：规避并保留反击/再判定窗口');
            if (names.some(name => /^闪避$/.test(name))) definitions.push('闪避：只规避当前攻击');
            return definitions.length ? `动作定义：${definitions.join('；')}` : '';
          };
          const 构建权重拆分明细行 = trace => {
            return '';
          };
          const 构建取舍明细行 = trace => {
            return '';
          };
          const usedBehaviorKeys = new Set();
          let primaryTacticalNarrationRendered = false;
          const 查找当前主动叙事轨迹 = () => {
            const traces = Array.isArray(behaviorTraces) ? behaviorTraces : [];
            const finalName = normalizeBattleActionDisplayName(finalAction || '');
            const initialName = normalizeBattleActionDisplayName(initialAction || '');
            return traces.find(trace => {
              if (!/主动规划|战术确立/.test(读取轨迹类型(trace))) return false;
              const names = [
                trace?.finalResolvedActionName,
                trace?.实际技能,
                trace?.技能,
              ].map(name => normalizeBattleActionDisplayName(name || '')).filter(Boolean);
              if (finalName && names.includes(finalName)) return true;
              if (initialName && names.includes(initialName)) return true;
              return false;
            }) || null;
          };
          const 主动叙事轨迹 = 查找当前主动叙事轨迹();
          if (主动叙事轨迹) {
            const narration = formatTacticalNarration(构建NarrativeDecisionDTO(主动叙事轨迹));
            if (narration) {
              pushDetailLine(`├─ ${narration}`, 'intent');
              primaryTacticalNarrationRendered = true;
              usedBehaviorKeys.add(`${读取轨迹类型(主动叙事轨迹)}::${normalizeBattleActionDisplayName(主动叙事轨迹.finalResolvedActionName || 主动叙事轨迹.技能 || '')}::${String(主动叙事轨迹.目标 || '').trim()}`);
            }
          }
          const 行为明细匹配当前动作 = trace => {
            const type = 读取轨迹类型(trace);
            if (!/战术确立|主动规划|应招审计|再判定审计|换招审计/.test(type)) return false;
            const traceTarget = String(trace?.目标 || trace?.displayTargetName || '').trim();
            if (!/再判定审计|换招审计/.test(type) && target && traceTarget && !isSameBattleReportName(traceTarget, target)) return false;
            const actionNames = [
              trace?.finalResolvedActionName,
              trace?.实际技能,
              trace?.技能,
              trace?.hitCandidateName,
            ].map(name => normalizeBattleActionDisplayName(name || '')).filter(Boolean);
            const candidates = 读取判定流程候选列表(trace, 0).map(读取候选名称).filter(Boolean);
            const sourceActionName = normalizeBattleActionDisplayName(trace?.sourceActionName || trace?.来源动作 || '');
            const matchesAction = /再判定审计/.test(type)
              ? (!!sourceActionName && (!finalAction || sourceActionName === finalAction))
              : (
                  !finalAction ||
                  actionNames.some(name => name === finalAction) ||
                  (!/主动规划|战术确立/.test(type) && candidates.some(name => name === finalAction)) ||
                  (/换招审计/.test(type) && candidates.some(name => /换招/.test(name)))
                );
            if (!matchesAction) return false;
            const reason = String(trace?.选择原因 || trace?.reason || '').trim();
            const hasPositiveCandidate = Number(trace?.最终权重 || 0) > 0 || 读取判定流程候选列表(trace, 0).some(item => 读取候选权重(item) > 0);
            if (/未形成有效出手机会|当前未形成有效出手机会/.test(reason) && !hasPositiveCandidate) return false;
            return true;
          };
          behaviorTraces
            .filter(行为明细匹配当前动作)
            .slice(0, 4)
            .forEach(trace => {
              if (primaryTacticalNarrationRendered && /战术确立|主动规划/.test(读取轨迹类型(trace))) return;
              const key = `${读取轨迹类型(trace)}::${normalizeBattleActionDisplayName(trace.finalResolvedActionName || trace.技能 || '')}::${String(trace.目标 || '').trim()}`;
              if (usedBehaviorKeys.has(key)) return;
              usedBehaviorKeys.add(key);
              [构建行为演算明细行(trace), 构建候选池明细行(trace), 构建再判定定义行(trace), 构建权重拆分明细行(trace), 构建取舍明细行(trace)]
                .filter(Boolean)
                .forEach(line => pushDetailLine(`├─ ${line}`, 'intent'));
            });
          const formatCalcNumber = value => {
            const number = Number(value);
            if (!Number.isFinite(number)) return '';
            return Math.abs(number - Math.round(number)) < 0.01 ? String(Math.round(number)) : number.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
          };
          const 格式化倍率 = value => {
            const number = Number(value);
            if (!Number.isFinite(number)) return '';
            return `${formatCalcNumber(number)}倍`;
          };
          const 格式化属性组成来源 = (breakdown, finalValue) => {
            const value = Number(breakdown?.value ?? finalValue);
            const base = Number(breakdown?.base ?? value);
            if (!Number.isFinite(value)) return '';
            const parts = [`${formatCalcNumber(value)}：基础${formatCalcNumber(Number.isFinite(base) ? base : value)}`];
            (Array.isArray(breakdown?.modifiers) ? breakdown.modifiers : []).forEach(modifier => {
              const source = String(modifier?.source || '状态修正').trim();
              const amount = Number(modifier?.value);
              if (!Number.isFinite(amount)) return;
              if (modifier.kind === 'multiply') parts.push(`×${格式化倍率(amount)}（${source}）`);
              else if (modifier.kind === 'add') parts.push(`${amount >= 0 ? '+' : '-'}${formatCalcNumber(Math.abs(amount))}（${source}）`);
              else if (modifier.kind === 'override') parts.push(`→${formatCalcNumber(amount)}（${source}）`);
            });
            return parts.join('');
          };
          const 格式化压力组成来源 = (breakdown, finalValue, stanceLabel) => {
            const value = Number(breakdown?.value ?? finalValue);
            if (!Number.isFinite(value)) return '';
            if (!breakdown || typeof breakdown !== 'object') return `${formatCalcNumber(value)}：当前${stanceLabel}压力`;
            const agility = Number(breakdown?.agility?.value || 0);
            const spirit = Number(breakdown?.spirit || 0);
            const spiritMax = Number(breakdown?.spiritMax || 0);
            const stamina = Number(breakdown?.stamina || 0);
            const staminaMax = Number(breakdown?.staminaMax || 0);
            const opposingSpirit = Number(breakdown?.opposingSpirit || 0);
            const base = Number(breakdown?.base || 0);
            const spiritRatio = Number(breakdown?.spiritRatio || 0);
            const staminaRatio = Number(breakdown?.staminaRatio || 0);
            const conditionFactor = Number(breakdown?.conditionFactor || 0);
            const resourcePressure = Number(breakdown?.resourcePressure || 0);
            const stanceMultiplier = Number(breakdown?.stanceMultiplier || 1);
            const parts = [
              `${stanceLabel}压力 ${formatCalcNumber(value)}`,
              `速度贡献 ${formatCalcNumber(agility)}×0.72=${formatCalcNumber(agility * 0.72)}`,
              `当前精神贡献 ${formatCalcNumber(spirit)}×0.012=${formatCalcNumber(spirit * 0.012)}`,
              `精神上限贡献 ${formatCalcNumber(spiritMax)}×0.025=${formatCalcNumber(spiritMax * 0.025)}`,
              `基础压力 ${formatCalcNumber(base)}`,
              `状态系数 ${formatCalcNumber(conditionFactor)}=基础0.35+精神占比${formatCalcNumber(spiritRatio * 100)}%×0.40+体力占比${formatCalcNumber(staminaRatio * 100)}%×0.25（精神 ${formatCalcNumber(spirit)}/${formatCalcNumber(spiritMax)}，体力 ${formatCalcNumber(stamina)}/${formatCalcNumber(staminaMax)}）`,
              `精神压制 ${formatCalcNumber(resourcePressure)}=（自身精神${formatCalcNumber(spirit)}/对方精神${formatCalcNumber(opposingSpirit)}）^0.35×（0.45+自身精神占比${formatCalcNumber(spiritRatio * 100)}%×0.55），结果限制在0.35至1.65`,
            ];
            if (Math.abs(stanceMultiplier - 1) > 1e-9) parts.push(`${stanceLabel}姿态倍率 ${格式化倍率(stanceMultiplier)}`);
            (Array.isArray(breakdown?.effectContributions) ? breakdown.effectContributions : []).forEach(modifier => {
              const amount = Number(modifier?.value);
              if (!Number.isFinite(amount) || !amount) return;
              const source = String(modifier?.source || '状态修正').trim();
              const sign = modifier.kind === 'subtract' ? '-' : amount >= 0 ? '+' : '-';
              parts.push(`状态修正 ${sign}${formatCalcNumber(Math.abs(amount))}（${source}）`);
            });
            parts.push(`最终 ${formatCalcNumber(value)}`);
            return parts.join('；');
          };
          const 构建数值证据标记 = (evidence, display, source, label = '') => {
            const index = evidence.length;
            evidence.push({
              display: String(display ?? '').trim(),
              source: String(source || '').trim(),
              label: String(label || '').trim(),
            });
            return `{{e:${index}}}`;
          };
          const 构建伤害计算明细行 = child => {
            const 读取 = key => 读取结算轨迹值(child.calculationTrace, key);
            const parts = [];
            const evidence = [];
            const incoming = Number(读取('incomingDamage') || 0);
            const reactive = Number(读取('reactiveDamage') || 0);
            const threshold = Number(读取('defenseThreshold') || 0);
            const finalDamage = Number(读取('finalDamage') || 0);
            const segmentIndex = Number(读取('segmentIndex') || 0);
            const segmentCount = Number(读取('segmentCount') || 0);
            if (segmentCount > 1 && segmentIndex > 0) {
              const currentSegment = 构建数值证据标记(evidence, Math.round(segmentIndex), '当前结算事实记录的伤害段序号', '当前伤害段');
              const totalSegments = 构建数值证据标记(evidence, Math.round(segmentCount), '技能效果定义的本次攻击总段数', '总伤害段数');
              parts.push(`第${currentSegment}/${totalSegments}段`);
            }
            if (incoming > 0) parts.push(`入参${构建数值证据标记(evidence, formatCalcNumber(incoming), '本段伤害进入防御、护盾与反应修正前的结算值', '入参伤害')}`);
            if (reactive > 0 && Math.round(reactive) !== Math.round(incoming)) {
              parts.push(`反应后${构建数值证据标记(evidence, formatCalcNumber(reactive), '应用本次防御、闪避或其他即时反应后的伤害值', '反应后伤害')}`);
            }
            if (threshold > 0) parts.push(`破防阈值${构建数值证据标记(evidence, formatCalcNumber(threshold), '本次伤害结算用于判断破防结果的阈值', '破防阈值')}`);
            [
              ['actualDefense', '有效防御', 0],
              ['soulDriveScale', '魂力驱动', 1],
              ['spiritDriveScale', '精神驱动', 1],
              ['positionDamageScale', '定位', 1],
              ['costDamageScale', '消耗', 1],
              ['fluctuation', '波动', 1],
              ['grazeMultiplier', '擦伤', 1],
              ['damageReduction', '减伤', 0],
              ['receivedDamageMult', '承伤', 1],
              ['elementDamageMult', '元素承伤', 1],
              ['finalDamageMult', '最终倍率', 1],
              ['finalDamageBonus', '最终加值', 0],
              ['activeReactionShield', '反应护盾', 0],
            ].forEach(([key, label, neutral]) => {
              const value = Number(读取(key));
              if (!Number.isFinite(value)) return;
              if (Math.abs(value - neutral) < 0.0001) return;
              parts.push(`${label}${构建数值证据标记(evidence, formatCalcNumber(value), `${label}来自本次伤害结算轨迹中的有效修正`, label)}`);
            });
            if (finalDamage > 0) parts.push(`最终${构建数值证据标记(evidence, formatCalcNumber(finalDamage), '完成防御、护盾、反应与伤害类型修正后实际扣除的生命值', '最终伤害')}`);
            return parts.length >= 2 ? { text: `计算明细：${parts.join(' -> ')}`, evidence } : null;
          };
          const 构建伤害路径行 = child => {
            const 读取 = key => 读取结算轨迹值(child.calculationTrace, key);
            const incoming = Number(读取('incomingDamage') || 0);
            const threshold = Number(读取('defenseThreshold') || 0);
            const finalDamage = Number(读取('finalDamage') || 0);
            if (!(incoming > 0) || !(finalDamage > 0)) return '';
            const evidence = [];
            const parts = [`入参段伤害 ${构建数值证据标记(evidence, formatCalcNumber(incoming), '本段伤害进入防御、护盾与反应修正前的结算值', '入参段伤害')}`];
            if (threshold > 0) parts.push(`破防阈值 ${构建数值证据标记(evidence, formatCalcNumber(threshold), '本次伤害结算用于判断破防结果的阈值', '破防阈值')}`);
            parts.push(`最终扣血 ${构建数值证据标记(evidence, formatCalcNumber(finalDamage), '本次伤害事实最终写入生命值变化的数值', '最终扣血')}`);
            return { text: `伤害路径：${parts.join(' -> ')}`, evidence };
          };
          const 构建闪避判定行 = child => {
            const 读取 = key => 读取结算轨迹值(child.calculationTrace, key);
            const dodgeRate = Number(读取('dodgeRate'));
            const dodgeRoll = Number(读取('dodgeRoll'));
            const reactionPressure = Number(读取('reactionPressure'));
            const attackPressure = Number(读取('attackPressure'));
            const reactionShare = Number(读取('reactionShare'));
            const reactionAgility = Number(读取('reactionAgility'));
            const sourceAgility = Number(读取('sourceAgility'));
            const reactionAgilityBreakdown = 读取('reactionAgilityBreakdown');
            const sourceAgilityBreakdown = 读取('sourceAgilityBreakdown');
            const reactionPressureBreakdown = 读取('reactionPressureBreakdown');
            const attackPressureBreakdown = 读取('attackPressureBreakdown');
            const failureReason = String(读取('failureReason') || child.failureReason || '').trim();
            const failureReasonCode = String(读取('reasonCode') || child.reasonCode || child.meta?.reasonCode || '').trim();
            const parts = [];
            const evidence = [];
            if (Number.isFinite(dodgeRate) && Number.isFinite(dodgeRoll)) {
              const dodgeSucceeded = dodgeRoll < dodgeRate;
              const reactorName = String(child.targetName || target || '应招方').trim();
              const sourceName = String(child.actorName || actor || '攻方').trim();
              if (Number.isFinite(reactionAgility) && Number.isFinite(sourceAgility)) {
                const reactorSpeed = 构建数值证据标记(
                  evidence,
                  formatCalcNumber(reactionAgility),
                  格式化属性组成来源(reactionAgilityBreakdown, reactionAgility),
                  `${reactorName}速度`,
                );
                const sourceSpeed = 构建数值证据标记(
                  evidence,
                  formatCalcNumber(sourceAgility),
                  格式化属性组成来源(sourceAgilityBreakdown, sourceAgility),
                  `${sourceName}速度`,
                );
                parts.push(`速度 ${reactorSpeed} 对 ${sourceSpeed}`);
              }
              if (Number.isFinite(reactionPressure) && Number.isFinite(attackPressure)) {
                const reactorPressure = 构建数值证据标记(
                  evidence,
                  formatCalcNumber(reactionPressure),
                  格式化压力组成来源(reactionPressureBreakdown, reactionPressure, '应招'),
                  `${reactorName}应招压力`,
                );
                const sourcePressure = 构建数值证据标记(
                  evidence,
                  formatCalcNumber(attackPressure),
                  格式化压力组成来源(attackPressureBreakdown, attackPressure, '追击'),
                  `${sourceName}攻势压力`,
                );
                parts.push(`反应压力 ${reactorPressure} 对 ${sourcePressure}`);
              }
              const probabilityText = 构建数值证据标记(
                evidence,
                `${Math.round(dodgeRate * 100)}%`,
                Number.isFinite(reactionShare)
                  ? `闪避成功率 ${Math.round(dodgeRate * 100)}%；基础成功率 18%；反应压力占比 ${formatCalcNumber(reactionShare * 100)}%；占比修正 ${formatCalcNumber((reactionShare - 0.5) * 110)}%；规则范围 3%至78%`
                  : `闪避成功率 ${Math.round(dodgeRate * 100)}%；由双方反应压力占比计算，规则范围 3%至78%`,
                '闪避成功率',
              );
              const rollText = 构建数值证据标记(
                evidence,
                `${Math.round(dodgeRoll * 100)}%`,
                `${Math.round(dodgeRoll * 100)}%：固定种子生成的本次判定值；判定值小于成功率时闪避成功`,
                '闪避判定值',
              );
              parts.push(`成功率 ${probabilityText}`);
              parts.push(`判定 ${rollText}`);
              parts.push(dodgeSucceeded ? '成功' : '失败');
            } else if (/dodged|evaded|miss/i.test(failureReason) || child.primaryOutcome === 'miss') parts.push('目标完成规避，落点失效');
            const mappedReason = 映射玩家可见失败原因(failureReasonCode, failureReason);
            if (mappedReason && !/dodged|evaded|miss/i.test(failureReason)) parts.push(`原因${mappedReason}`);
            return parts.length ? { text: `闪避判定：${parts.join(' -> ')}`, evidence } : null;
          };
          const 查找反应窗口伤害结算节点 = reactionNode => {
            const windowId = String(reactionNode?.parentNodeId || '').trim();
            if (!windowId) return null;
            const windowNode = nodeById.get(windowId) || null;
            const rootId = String(windowNode?.parentNodeId || '').trim();
            const windowChildren = byParent.get(windowId) || [];
            const rootChildren = rootId ? (byParent.get(rootId) || []) : [];
            const hitNode = windowChildren.find(node => String(node.nodeKind || '').trim() === 'hit_check') ||
              rootChildren.find(node => String(node.nodeKind || '').trim() === 'hit_check');
            if (!hitNode) return null;
            return (byParent.get(String(hitNode.nodeId || '').trim()) || []).find(node => String(node.nodeKind || '').trim() === 'damage_settlement') || null;
          };
          const 构建防御反应参数行 = reactionNode => {
            const action = normalizeBattleActionDisplayName(reactionNode?.finalActionName || reactionNode?.actionName || reactionNode?.initialActionName || '');
            if (!/承伤硬抗|肉体兜底|防御|偏转|收招转防|借力守势|坚壁/.test(action)) return '';
            const settlement = 查找反应窗口伤害结算节点(reactionNode);
            if (!settlement) return '';
            const 读取 = key => 读取结算轨迹值(settlement.calculationTrace, key);
            const finalDamage = Number(读取('finalDamage') || 0);
            const actualDefense = Number(读取('actualDefense'));
            const threshold = Number(读取('defenseThreshold'));
            const damageReduction = Number(读取('damageReduction'));
            const activeShield = Number(读取('activeReactionShield'));
            const parts = [];
            const evidence = [];
            if (Number.isFinite(actualDefense) && actualDefense > 0) {
              parts.push(`有效防御${构建数值证据标记(evidence, formatCalcNumber(actualDefense), '防守方当前防御属性与本次防御状态修正后的有效值', '有效防御')}`);
            }
            if (Number.isFinite(threshold) && threshold > 0) {
              parts.push(`破防阈值${构建数值证据标记(evidence, formatCalcNumber(threshold), '本次攻防结算用于判断破防结果的阈值', '破防阈值')}`);
            }
            if (Number.isFinite(damageReduction) && damageReduction > 0) {
              parts.push(`减伤${构建数值证据标记(evidence, `${formatCalcNumber(damageReduction * 100)}%`, '防御动作与当前状态共同提供的本次伤害减免比例', '防御减伤')}`);
            }
            if (Number.isFinite(activeShield) && activeShield > 0) {
              parts.push(`反应护盾${构建数值证据标记(evidence, formatCalcNumber(activeShield), '本次即时防御反应提供并参与吸收的护盾值', '反应护盾')}`);
            }
            if (finalDamage >= 0) {
              parts.push(`最终承伤${构建数值证据标记(evidence, formatCalcNumber(finalDamage), '完成防御、护盾与减伤结算后实际承受的伤害', '最终承伤')}`);
            }
            return parts.length >= 2 ? { text: `防御判定：${parts.join(' -> ')}`, evidence } : null;
          };
          const 查找反应来源动作节点 = reactionNode => {
            const directSourceId = String(reactionNode?.sourceNodeId || '').trim();
            if (directSourceId && nodeById.has(directSourceId)) return nodeById.get(directSourceId);
            const windowNode = nodeById.get(String(reactionNode?.parentNodeId || '').trim()) || null;
            const windowSourceId = String(windowNode?.sourceNodeId || '').trim();
            if (windowSourceId && nodeById.has(windowSourceId)) return nodeById.get(windowSourceId);
            const windowParentId = String(windowNode?.parentNodeId || '').trim();
            if (windowParentId && nodeById.has(windowParentId)) return nodeById.get(windowParentId);
            return null;
          };
          const 构建反应来源动作短语 = reactionNode => {
            const sourceNode = 查找反应来源动作节点(reactionNode);
            const sourceActionName = normalizeBattleActionDisplayName(
              读取结算轨迹值(reactionNode?.calculationTrace, 'sourceAction') ||
              reactionNode?.sourceActionName ||
              sourceNode?.finalActionName ||
              sourceNode?.actionName ||
              sourceNode?.initialActionName ||
              '',
            );
            const sourceActorName = String(
              读取结算轨迹值(reactionNode?.calculationTrace, 'sourceActorName') ||
              sourceNode?.actorName ||
              reactionNode?.targetName ||
              '',
            ).trim();
            if (sourceActionName && sourceActorName) return `【${sourceActorName}的${sourceActionName}】`;
            if (sourceActionName) return `【${sourceActionName}】`;
            return '来源未绑定的动作';
          };
          const 构建ReactionAuditDTO = reactionNode => {
            const 读取 = key => 读取结算轨迹值(reactionNode.calculationTrace, key);
            const sourceNode = 查找反应来源动作节点(reactionNode);
            const rawResult = String(读取('result') || reactionNode.result || '').trim();
            const outcome = String(reactionNode.primaryOutcome || '').trim();
            const result = /attempted|尝试/.test(rawResult) && outcome && !/reaction_failed|reaction_window_opened/.test(outcome)
              ? outcome
              : rawResult;
            return {
              sourceActionName: normalizeBattleActionDisplayName(
                读取('sourceAction') ||
                reactionNode.sourceActionName ||
                sourceNode?.finalActionName ||
                sourceNode?.actionName ||
                sourceNode?.initialActionName ||
                '',
              ),
              sourceActorName: String(读取('sourceActorName') || sourceNode?.actorName || reactionNode.targetName || '').trim(),
              reactionActorName: String(读取('reactionActorName') || reactionNode.actorName || '').trim(),
              initialReactionName: normalizeBattleActionDisplayName(读取('initialReaction') || reactionNode.initialActionName || ''),
              finalReactionName: normalizeBattleActionDisplayName(读取('finalReaction') || reactionNode.finalActionName || ''),
              reactionKind: String(读取('reactionKind') || '').trim(),
              result,
              outcome,
            };
          };
          const 构建StateCheckDTO = stateNode => {
            const meta = stateNode?.meta && typeof stateNode.meta === 'object' ? stateNode.meta : {};
            const rateRaw = 读取结算轨迹值(stateNode.calculationTrace, 'successRate') ?? stateNode.successRate ?? meta.successRate;
            const rollRaw = 读取结算轨迹值(stateNode.calculationTrace, 'roll') ?? stateNode.roll ?? meta.roll;
            const successRate = Number(rateRaw);
            const roll = Number(rollRaw);
            const result = String(stateNode.result || '').trim();
            return {
              stateName: String(读取结算轨迹值(stateNode.calculationTrace, 'stateName') || stateNode.stateName || '').trim(),
              successRateBreakdown: String(读取结算轨迹值(stateNode.calculationTrace, 'successRateBreakdown') || stateNode.successRateBreakdown || meta.successRateBreakdown || meta.stateSuccessRateBreakdown || '附着成功率：缺少 successRateBreakdown / successRateReason，无法生成计算式').trim(),
              successRate,
              roll,
              result,
              primaryOutcome: String(stateNode.primaryOutcome || '').trim(),
            };
          };
          const 构建反应决策上下文行 = reactionNode => {
            const dto = 构建ReactionAuditDTO(reactionNode);
            const outcomeText = 格式化反应判定结果(dto);
            const parts = [];
            if (dto.reactionActorName) {
              const sourceText = dto.sourceActionName
                ? (dto.sourceActorName ? `【${dto.sourceActorName}的${dto.sourceActionName}】` : `【${dto.sourceActionName}】`)
                : '来袭动作';
              parts.push(`${dto.reactionActorName}应对${sourceText}`);
            }
            else if (dto.sourceActionName) parts.push(`应对来源【${dto.sourceActionName}】`);
            const finalNoReaction = 判定无反应动作名(dto.finalReactionName);
            if (dto.initialReactionName && dto.finalReactionName && dto.initialReactionName !== dto.finalReactionName) {
              if (finalNoReaction) {
                parts.push(判定可显示为原定反应动作(dto.initialReactionName)
                  ? `原定【${dto.initialReactionName}】被压住，未能展开`
                  : '节奏被压住，未能展开应对');
              } else {
                parts.push(`原定【${dto.initialReactionName}】 -> 改为【${dto.finalReactionName}】`);
              }
            } else if (dto.finalReactionName) {
              parts.push(finalNoReaction ? '未能作出有效反应' : `选择【${dto.finalReactionName}】`);
            }
            const readableKind = 格式化玩家反应类型(dto.reactionKind);
            const readableResult = outcomeText || 格式化玩家判定结果(dto.result);
            if (!finalNoReaction && readableKind) parts.push(`类型：${readableKind}`);
            if (readableResult) parts.push(`结果：${readableResult}`);
            return parts.length >= 2 ? `反应判定：${parts.join('，')}` : '';
          };
          const 构建反应决策参数行 = reactionNode => {
            const 读取 = key => 读取结算轨迹值(reactionNode.calculationTrace, key);
            const parts = [];
            const ratio = Number(读取('reactionRatio'));
            const sourceActorName = String(读取('sourceActorName') || reactionNode.targetName || '').trim();
            const reactionActorName = String(读取('reactionActorName') || reactionNode.actorName || '').trim();
            const castTimeGap = Number(读取('castTimeGap'));
            const attackerCastTime = Number(读取('attackerCastTime'));
            const reactorCastTime = Number(读取('reactorCastTime'));
            const threatScore = Number(读取('threatScore'));
            const attackerSpeed = Number(读取('sourceActionSpeed') || 读取('attackerSpeed'));
            const defenderReaction = Number(读取('reactionValue') || 读取('defenderReaction'));
            const attackerAgility = Number(读取('sourceAgility') || 读取('attackerAgility'));
            const defenderAgility = Number(读取('reactionAgility') || 读取('defenderAgility'));
            const defenderMentalMax = Number(读取('reactionMental') || 读取('defenderMentalMax'));
            const castPenalty = Number(读取('castPenalty'));
            const attackerSpeedBonus = Number(读取('attackerSpeedBonus'));
            const defenderReactionBonus = Number(读取('defenderReactionBonus'));
            const defenderReactionPenalty = Number(读取('defenderReactionPenalty'));
            const defenderAgilityMult = Number(读取('defenderAgilityMult'));
            const maintainReactionPenalty = Number(读取('maintainReactionPenalty'));
            const defenderAgilityComponent = Number(读取('defenderAgilityComponent'));
            const defenderMentalComponent = Number(读取('defenderMentalComponent'));
            const reactionBaseBeforeMultiplier = Number(读取('reactionBaseBeforeMultiplier'));
            const maintainReactionMultiplier = Number(读取('maintainReactionMultiplier'));
            const reactionBudgetMultiplier = Number(读取('reactionBudgetMultiplier'));
            const experienceReactionMultiplier = Number(读取('experienceReactionMultiplier'));
            const ratioPostMultiplier = Number(读取('ratioPostMultiplier'));
            const firstStrikePenalty = 读取('firstStrikePenalty') === true || 读取('firstStrikePenalty') === 'true';
            if (Number.isFinite(ratio) && ratio > 0) {
              if (!(Number.isFinite(attackerSpeed) && attackerSpeed > 0 && Number.isFinite(defenderReaction) && defenderReaction > 0)) {
                return '';
              }
              const ratioFormula = [
                `${reactionActorName ? `${reactionActorName}反应` : '应招方反应'}${formatCalcNumber(defenderReaction)} / ${sourceActorName ? `${sourceActorName}攻速` : '攻方速度'}${formatCalcNumber(attackerSpeed)}`,
              ];
              if (Number.isFinite(ratioPostMultiplier) && Math.abs(ratioPostMultiplier - 1) >= 0.0001) {
                ratioFormula.push(`${firstStrikePenalty ? '先攻压制' : '比值修正'}${formatCalcNumber(ratioPostMultiplier)}`);
              }
              parts.push(`反应比值 = ${ratioFormula.join(' × ')} = ${formatCalcNumber(ratio)}`);
              const reactionBaseParts = [];
              if (Number.isFinite(defenderAgility) && defenderAgility > 0) {
                const agilityText = Number.isFinite(defenderAgilityMult) && Math.abs(defenderAgilityMult - 1) >= 0.0001
                  ? `敏捷${formatCalcNumber(defenderAgility)}×${formatCalcNumber(defenderAgilityMult)}`
                  : `敏捷${formatCalcNumber(defenderAgility)}`;
                reactionBaseParts.push(agilityText);
              } else if (Number.isFinite(defenderAgilityComponent) && defenderAgilityComponent > 0) {
                reactionBaseParts.push(`敏捷项${formatCalcNumber(defenderAgilityComponent)}`);
              }
              if (Number.isFinite(defenderMentalMax) && defenderMentalMax > 0) reactionBaseParts.push(`精神${formatCalcNumber(defenderMentalMax)}`);
              else if (Number.isFinite(defenderMentalComponent) && defenderMentalComponent > 0) reactionBaseParts.push(`精神项${formatCalcNumber(defenderMentalComponent)}`);
              if (Number.isFinite(defenderReactionBonus) && defenderReactionBonus > 0) reactionBaseParts.push(`反应加值${formatCalcNumber(defenderReactionBonus)}`);
              if (Number.isFinite(defenderReactionPenalty) && defenderReactionPenalty > 0) reactionBaseParts.push(`反应惩罚-${formatCalcNumber(defenderReactionPenalty)}`);
              const reactionMultiplierParts = [];
              if (Number.isFinite(maintainReactionMultiplier) && Math.abs(maintainReactionMultiplier - 1) >= 0.0001) {
                reactionMultiplierParts.push(`维持修正${formatCalcNumber(maintainReactionMultiplier)}`);
              } else if (Number.isFinite(maintainReactionPenalty) && maintainReactionPenalty > 0) {
                reactionMultiplierParts.push(`维持修正${formatCalcNumber(1 - Math.min(0.25, Math.max(0, maintainReactionPenalty)))}`);
              }
              if (Number.isFinite(reactionBudgetMultiplier) && Math.abs(reactionBudgetMultiplier - 1) >= 0.0001) reactionMultiplierParts.push(`反应预算${formatCalcNumber(reactionBudgetMultiplier)}`);
              if (Number.isFinite(experienceReactionMultiplier) && Math.abs(experienceReactionMultiplier - 1) >= 0.0001) reactionMultiplierParts.push(`经验修正${formatCalcNumber(experienceReactionMultiplier)}`);
              if (reactionBaseParts.length) {
                const baseText = reactionBaseParts.join(' + ').replace(/\+ 反应惩罚-/g, '- 反应惩罚');
                const baseFormula = Number.isFinite(reactionBaseBeforeMultiplier) && Math.abs(reactionBaseBeforeMultiplier - defenderReaction) >= 0.01
                  ? `(${baseText})`
                  : baseText;
                const multiplierText = reactionMultiplierParts.length ? ` × ${reactionMultiplierParts.join(' × ')}` : '';
                parts.push(`防守反应来源：${baseFormula}${multiplierText} = ${formatCalcNumber(defenderReaction)}`);
              }
              const speedParts = [];
              if (Number.isFinite(attackerAgility) && attackerAgility > 0) speedParts.push(`敏捷${formatCalcNumber(attackerAgility)}`);
              if (Number.isFinite(castPenalty) && castPenalty > 0) speedParts.push(`前摇惩罚${formatCalcNumber(castPenalty * 100)}%`);
              if (Number.isFinite(attackerSpeedBonus) && attackerSpeedBonus > 0) speedParts.push(`速度加值${formatCalcNumber(attackerSpeedBonus)}`);
              if (speedParts.length) parts.push(`攻方速度来源：${speedParts.join('，')}`);
            }
            [
              [castTimeGap, '前摇差'],
              [attackerCastTime, '攻方前摇'],
              [reactorCastTime, '应招前摇'],
              [threatScore, '威胁评分'],
            ].forEach(([value, label]) => {
              if (!Number.isFinite(value) || Math.abs(value) < 0.0001) return;
              parts.push(`${label}${formatCalcNumber(value)}`);
            });
            return parts.length ? `反应依据：${parts.join(' -> ')}` : '';
          };
          const 构建子级树前缀 = (parentPrefix = '├─', isLast = false) => {
            const raw = String(parentPrefix || '├─');
            let stem = raw;
            if (/[├└]─$/.test(stem)) stem = stem.slice(0, -2);
            if (/└─$/.test(raw)) stem += '│ ';
            else stem += '│ ';
            return `${stem}${isLast ? '└─' : '├─'}`;
          };
          const 筛选可见因果子节点 = nodes => {
            const visible = [];
            const reactionIndexByKey = new Map();
            (Array.isArray(nodes) ? nodes : []).forEach(node => {
              if (String(node?.nodeKind || '').trim() !== 'reaction_decision') {
                visible.push(node);
                return;
              }
              const action = normalizeBattleActionDisplayName(node.finalActionName || node.actionName || node.initialActionName || '行动');
              const sourceAction = String(读取结算轨迹值(node.calculationTrace, 'sourceAction') || node.sourceAction || '').trim();
              const key = [
                String(node.actorName || '').trim(),
                String(node.targetName || '').trim(),
                action,
                sourceAction,
              ].join('|');
              const score = (读取结算轨迹值(node.calculationTrace, 'initialReaction') ? 4 : 0)
                + (读取结算轨迹值(node.calculationTrace, 'reactionRatio') ? 2 : 0)
                + (!/attempted|尝试/.test(String(node.result || '').trim()) ? 3 : 0)
                + (Array.isArray(node.calculationTrace) ? Math.min(6, node.calculationTrace.length) : 0);
              const existingIndex = reactionIndexByKey.get(key);
              if (existingIndex === undefined) {
                reactionIndexByKey.set(key, visible.length);
                visible.push({ ...node, __visibleScore: score });
              } else {
                const existing = visible[existingIndex] || {};
                const mergedTrace = [];
                const seenTraceKeys = new Set();
                [...(Array.isArray(existing.calculationTrace) ? existing.calculationTrace : []), ...(Array.isArray(node.calculationTrace) ? node.calculationTrace : [])].forEach(item => {
                  const traceKey = `${String(item?.key || '').trim()}|${String(item?.label || '').trim()}`;
                  if (!traceKey.trim() || seenTraceKeys.has(traceKey)) return;
                  seenTraceKeys.add(traceKey);
                  mergedTrace.push(item);
                });
                const existingResult = String(existing.result || '').trim();
                const nextResult = String(node.result || '').trim();
                const result = (!nextResult || /attempted|尝试/.test(nextResult)) ? existingResult : nextResult;
                visible[existingIndex] = {
                  ...(score > Number(existing.__visibleScore || 0) ? node : existing),
                  result: result || existingResult || nextResult,
                  primaryOutcome: /attempted|尝试/.test(String(node.primaryOutcome || '').trim()) ? existing.primaryOutcome : (node.primaryOutcome || existing.primaryOutcome),
                  calculationTrace: mergedTrace,
                  __visibleScore: Math.max(score, Number(existing.__visibleScore || 0)),
                };
              }
            });
            return visible;
          };
          const 读取投影去重键 = child => {
            const kind = String(child?.nodeKind || '').trim();
            if (!['state_settlement', 'damage_settlement', 'final_result'].includes(kind)) return '';
            const ledgerIds = Array.isArray(child?.ledgerEventIds) ? child.ledgerEventIds.map(id => String(id || '').trim()).filter(Boolean) : [];
            if (ledgerIds.length) return `${kind}|${ledgerIds.join(',')}`;
            if (kind === 'state_settlement') {
              const stateName = String(读取结算轨迹值(child?.calculationTrace, 'stateName') || child?.stateName || '').trim();
              const targetName = String(child?.targetName || target || '').trim();
              const sourceAction = normalizeBattleActionDisplayName(读取结算轨迹值(child?.calculationTrace, 'sourceAction') || child?.sourceActionName || finalAction || '');
              if (stateName && targetName) return `${kind}|${sourceAction}|${targetName}|${stateName}`;
            }
            const nodeId = String(child?.nodeId || '').trim();
            return nodeId ? `${kind}|${nodeId}` : '';
          };
          const pushChildLine = (child, prefix = '├─') => {
            const kind = String(child.nodeKind || '').trim();
            const projectionKey = 读取投影去重键(child);
            if (projectionKey && renderedSettlementKeys.has(projectionKey)) return;
            if (projectionKey) renderedSettlementKeys.add(projectionKey);
            const timelineKind = mapTimelineKindFromNode(kind);
            const pushChildTimelineLine = text => pushTimelineLine(text, timelineKind);
            const childActor = String(child.actorName || '').trim();
            const childTarget = String(child.targetName || '').trim();
            const childAction = normalizeBattleActionDisplayName(child.finalActionName || child.actionName || child.initialActionName || '行动');
            if (kind === 'replan_decision') {
              const discarded = normalizeBattleActionDisplayName(child.discardedActionName || child.initialActionName || '原计划');
              const reason = 映射行动链变招原因短语(child);
              const replanKey = `${discarded}|${childAction}|${reason}`;
              if (renderedReplanKeys.has(replanKey)) return;
              renderedReplanKeys.add(replanKey);
              pushChildTimelineLine(`${prefix} 原计划【${discarded}】${reason ? `，因${reason}` : ''}改为【${childAction}】`);
            } else if (kind === 'reaction_window') {
              pushChildTimelineLine(`${prefix} 反应窗口：${childActor || childTarget || '目标'}捕捉到${构建反应来源动作短语(child)}`);
              筛选可见因果子节点(byParent.get(String(child.nodeId || '').trim()) || [])
                .filter(node => ['reaction_decision', 'hit_check', 'state_check', 'damage_settlement', 'state_settlement', 'final_result'].includes(String(node.nodeKind || '')))
                .forEach((node, index, list) => pushChildLine(node, 构建子级树前缀(prefix, index === list.length - 1)));
            } else if (kind === 'reaction_decision') {
              const reactionSubject = childActor || childTarget || '目标';
              if (/无暇反应|无法反应|无反应|来不及反应/.test(childAction)) {
                pushChildTimelineLine(`${prefix} 反应：${reactionSubject}错过应对窗口`);
              } else {
                pushChildTimelineLine(`${prefix} 反应：${reactionSubject}以【${childAction}】应对`);
              }
              const contextLine = 构建反应决策上下文行(child);
              if (contextLine) pushDetailLine(`${构建子级树前缀(prefix, false)} ${contextLine}`, timelineKind);
              const reactionCalcLine = 构建反应决策参数行(child);
              if (reactionCalcLine) pushDetailLine(`${构建子级树前缀(prefix, false)} ${reactionCalcLine}`, timelineKind);
              const defenseLine = 构建防御反应参数行(child);
              if (defenseLine) pushDetailLine(`${构建子级树前缀(prefix, false)} ${defenseLine.text}`, timelineKind, { evidence: defenseLine.evidence });
            } else if (kind === 'hit_check') {
              const result = String(child.result || '').trim();
              const missed = /miss|evade|dodge|未命中|闪避/.test(result) || child.primaryOutcome === 'miss';
              pushChildTimelineLine(missed
                ? `${prefix} 命中检定：${actor}的【${finalAction}】未能命中${childTarget || target || '目标'}`
                : `${prefix} 命中检定：${actor}的【${finalAction}】锁定${childTarget || target || '目标'}，攻势落定`);
              const dodgeLine = 构建闪避判定行(child);
              if (dodgeLine) pushDetailLine(`${构建子级树前缀(prefix, false)} ${dodgeLine.text}`, timelineKind, { evidence: dodgeLine.evidence });
              (byParent.get(String(child.nodeId || '').trim()) || [])
                .filter(node => ['damage_settlement', 'state_settlement', 'final_result'].includes(String(node.nodeKind || '')))
                .forEach((node, index, list) => pushChildLine(node, 构建子级树前缀(prefix, index === list.length - 1)));
            } else if (kind === 'state_check') {
              const stateDTO = 构建StateCheckDTO(child);
              const immune = /immune|immunity|免疫|无视异常/.test(stateDTO.result) || /immune/.test(stateDTO.primaryOutcome);
              const resisted = /resist|resisted|抵抗|豁免|未附着/.test(stateDTO.result) || /resisted/.test(stateDTO.primaryOutcome);
              if (stateDTO.stateName) pushChildTimelineLine(immune
                ? `${prefix} 状态检定：${childTarget || target || '目标'}免疫【${stateDTO.stateName}】附着`
                : resisted
                ? `${prefix} 状态检定：${childTarget || target || '目标'}抵住【${stateDTO.stateName}】附着`
                : `${prefix} 状态检定：【${stateDTO.stateName}】锁定${childTarget || target || '目标'}，开始附着`);
              if (Number.isFinite(stateDTO.successRate)) {
                const evidence = [];
                const normalizedRate = stateDTO.successRate <= 1 ? stateDTO.successRate : stateDTO.successRate / 100;
                const rateText = 构建数值证据标记(
                  evidence,
                  `${Math.round(normalizedRate * 100)}%`,
                  stateDTO.successRateBreakdown || '本次状态效果结合基础附着率、目标抵抗与免疫规则后的成功率',
                  '状态附着成功率',
                );
                const parts = [`附着成功率 ${rateText}`];
                if (Number.isFinite(stateDTO.roll)) {
                  const normalizedRoll = stateDTO.roll <= 1 ? stateDTO.roll : stateDTO.roll / 100;
                  const rollText = 构建数值证据标记(
                    evidence,
                    `${Math.round(normalizedRoll * 100)}%`,
                    '固定种子生成的本次状态附着判定值；判定值不高于成功率时附着成功',
                    '状态附着判定值',
                  );
                  parts.push(`判定 ${rollText}`);
                }
                parts.push(immune ? '免疫' : resisted ? '未通过' : '通过');
                pushDetailLine(`${构建子级树前缀(prefix, false)} 状态判定：${parts.join(' -> ')}`, timelineKind, { evidence });
              }
              (byParent.get(String(child.nodeId || '').trim()) || [])
                .filter(node => ['state_settlement', 'final_result'].includes(String(node.nodeKind || '')))
                .forEach((node, index, list) => pushChildLine(node, 构建子级树前缀(prefix, index === list.length - 1)));
            } else if (kind === 'damage_settlement') {
              const finalDamage = Number(读取结算轨迹值(child.calculationTrace, 'finalDamage') || 0);
              const result = String(child.result || '').trim();
              if (/miss|evade|dodge|未命中|闪避/.test(result) || child.primaryOutcome === 'miss') pushChildTimelineLine(`${prefix} 伤害结算：${childTarget || target || '目标'}未受到实质伤害`);
              else if (finalDamage > 0) {
                const evidence = [];
                const damageText = 构建数值证据标记(evidence, Math.round(finalDamage), '本次动作完成全部命中、防御、护盾与伤害修正后实际扣除的生命值', '最终伤害');
                pushTimelineLine(`${prefix} 伤害结算：${childTarget || target || '目标'}受到 ${damageText} 点伤害`, timelineKind, { evidence });
              } else pushChildTimelineLine(`${prefix} 伤害结算：${childTarget || target || '目标'}未受到实质伤害`);
              const calcLine = 构建伤害计算明细行(child);
              const pathLine = 构建伤害路径行(child);
              [pathLine, calcLine]
                .filter(Boolean)
                .forEach((line, index, list) => pushDetailLine(`${构建子级树前缀(prefix, index === list.length - 1)} ${line.text}`, timelineKind, { evidence: line.evidence }));
              (byParent.get(String(child.nodeId || '').trim()) || [])
                .filter(node => String(node.nodeKind || '') === 'summon_assist')
                .forEach((node, index, list) => pushChildLine(node, 构建子级树前缀(prefix, index === list.length - 1)));
            } else if (kind === 'state_settlement') {
              const stateName = String(读取结算轨迹值(child.calculationTrace, 'stateName') || child.stateName || '').trim();
              const duration = Math.max(0, Number(读取结算轨迹值(child.calculationTrace, 'duration') || child.duration || 0));
              const immune = /immune|immunity|免疫|无视异常/.test(String(child.result || '')) || /immune/.test(String(child.primaryOutcome || ''));
              if (stateName) {
                const evidence = [];
                const durationText = duration > 0 && !immune
                  ? `，持续${构建数值证据标记(evidence, formatCalcNumber(duration), '状态成功附着后写入战斗快照的有效持续回合数', '状态持续时间')}回合`
                  : '';
                pushTimelineLine(`${prefix} 状态结算：${childTarget || target || '目标'}${immune ? '免疫' : (/resist|resisted|抵抗|豁免/.test(String(child.result || '')) ? '抵住' : '陷入')}【${stateName}】${durationText}`, timelineKind, { evidence });
              }
            } else if (kind === 'counter_action') {
              const damage = Number(读取结算轨迹值(child.calculationTrace, 'finalDamage') || 读取结算轨迹值(child.calculationTrace, 'damage') || 0);
              const counterLabel = Number(child.counterDepth || 0) >= 2 ? '反防反分支' : '防反分支';
              const evidence = [];
              const counterDamage = damage > 0
                ? `，造成 ${构建数值证据标记(evidence, Math.round(damage), '反击动作完成全部命中、防御与伤害修正后实际扣除的生命值', '反击最终伤害')} 点伤害`
                : '';
              pushTimelineLine(`${prefix} ${counterLabel}：${childActor || '防守方'}以【${childAction}】反击${childTarget || actor}${counterDamage}`, timelineKind, { evidence });
              const pathLine = 构建伤害路径行(child);
              const calcLine = 构建伤害计算明细行(child);
              const counterCalcLines = [pathLine, calcLine].filter(Boolean);
              筛选可见因果子节点(byParent.get(String(child.nodeId || '').trim()) || [])
                .filter(node => ['reaction_window', 'reaction_decision'].includes(String(node.nodeKind || '')))
                .forEach((node, index, list) => pushChildLine(node, 构建子级树前缀(prefix, !counterCalcLines.length && index === list.length - 1)));
              counterCalcLines
                .forEach((line, index, list) => pushDetailLine(`${构建子级树前缀(prefix, index === list.length - 1)} ${line.text}`, timelineKind, { evidence: line.evidence }));
              (byParent.get(String(child.nodeId || '').trim()) || [])
                .filter(node => ['target_branch', 'counter_window'].includes(String(node.nodeKind || '')) && 因果链节点默认可见(node))
                .forEach((node, index, list) => pushChildLine(node, 构建子级树前缀(prefix, index === list.length - 1)));
            } else if (kind === 'summon_assist') {
              const damage = Number(读取结算轨迹值(child.calculationTrace, 'damage') || 读取结算轨迹值(child.calculationTrace, 'finalDamage') || 0);
              pushChildTimelineLine(`${prefix} 召唤协同追击：${childActor || '召唤物'}以【${childAction}】承接攻势${childTarget ? `追击${childTarget}` : ''}${damage > 0 ? `，造成 ${Math.round(damage)} 点伤害` : ''}`);
            } else if (kind === 'final_result' && String(child.primaryOutcome || '').trim() === 'summon_created') {
              const summonName = String(读取结算轨迹值(child.calculationTrace, 'summonName') || child.summonName || childTarget || '').trim();
              const summonType = String(读取结算轨迹值(child.calculationTrace, 'summonType') || child.summonType || '').trim();
              const summonMode = String(读取结算轨迹值(child.calculationTrace, 'summonMode') || child.summonMode || '').trim();
              const mentalLoad = Number(读取结算轨迹值(child.calculationTrace, 'mentalLoad') || child.mentalLoad || 0);
              const evidence = [];
              const mentalLoadText = mentalLoad > 0
                ? `，精神负载 ${构建数值证据标记(evidence, Math.round(mentalLoad), '该召唤物生成后占用宿主精神承载能力的实际数值', '召唤精神负载')}`
                : '';
              pushTimelineLine(`${prefix} 召唤生成：召出${summonType || '召唤物'}【${summonName || '召唤物'}】${summonMode ? `，行动模式：${summonMode}` : ''}${mentalLoadText}`, timelineKind, { evidence });
            } else if (kind === 'final_result' && String(child.primaryOutcome || '').trim() === 'item_created') {
              const createdName = String(读取结算轨迹值(child.calculationTrace, 'createdName') || child.createdName || childTarget || '').trim();
              const createdType = String(读取结算轨迹值(child.calculationTrace, 'createdType') || child.createdType || '').trim();
              pushChildTimelineLine(`${prefix} 造物生成：${childActor || actor || '行动者'}完成${createdType || '造物'}【${createdName || childAction || '造物'}】`);
            } else if (kind === 'final_result') {
              const outcome = String(child.primaryOutcome || '').trim();
              const rawReason = String(child.failureReason || child.failReason || child.reasonText || 读取结算轨迹值(child.calculationTrace, 'failureReason') || 读取结算轨迹值(child.calculationTrace, 'failReason') || '').trim();
              let reason = 映射玩家可见失败原因(child.reasonCode || child.meta?.reasonCode || 读取结算轨迹值(child.calculationTrace, 'reasonCode') || '', rawReason) ||
                (outcome === 'interrupted' ? '被对手截断' : '战机已经消散');
              reason = String(reason || '')
                .replace(/，?未能形成有效出手/g, '')
                .replace(/，?未能完成出手/g, '')
                .replace(/，?未能展开/g, '')
                .replace(/[，。；\s]+$/g, '')
                .trim();
              if (/interrupted|blocked|failed|no_effect/.test(`${outcome} ${child.result || ''}`)) {
                const actionText = `${childAction} ${child.actionType || ''} ${child.type || ''}`;
                if (判定守势待机动作(actionText) && /no_effect|no_valid_window|NO_EFFECTIVE_OPENING|未形成主动结算效果|没有形成主动结算效果|稳住身位|观察战局|no_effective_opening/i.test(`${outcome} ${child.result || ''} ${rawReason} ${child.reasonCode || child.meta?.reasonCode || ''}`)) {
                  pushChildTimelineLine(`${prefix} 守势调整：${构建守势待机短句(childActor || actor, actionText)}`);
                } else {
                  pushChildTimelineLine(`${prefix} ${childActor || actor}的【${childAction}】${reason ? `因${reason}，` : ''}未能完成出手`);
                }
              }
            } else if (kind === 'counter_window') {
              const opened = String(child.result || '').trim() === 'opened' || child.reasonCode === 'COUNTER_WINDOW_OPENED';
              const counterWindowLabel = Number(child.counterDepth || 0) >= 2 ? '反防反窗口' : '防反窗口';
              pushChildTimelineLine(opened
                ? `${prefix} ${counterWindowLabel}：${childActor || '防守方'}捕捉到${childTarget || actor || '目标'}的破绽`
                : `${prefix} ${counterWindowLabel}：${childActor || '防守方'}窥见破绽，但错失反打时机，未能反打`);
              (byParent.get(String(child.nodeId || '').trim()) || [])
                .filter(node => ['counter_action', 'damage_settlement', 'state_settlement', 'final_result'].includes(String(node.nodeKind || '')))
                .forEach((node, index, list) => pushChildLine(node, 构建子级树前缀(prefix, index === list.length - 1)));
            }
          };
          children.forEach(child => {
            const kind = String(child.nodeKind || '').trim();
            if (kind === 'target_branch') {
              const branchTarget = String(child.targetName || '目标').trim();
              pushTimelineLine(`├─ 目标分支：${branchTarget}`, 'branch');
              const branchChildren = 筛选可见因果子节点(byParent.get(String(child.nodeId || '').trim()) || []);
              branchChildren.filter(node => ['replan_decision', 'reaction_window', 'reaction_decision', 'hit_check', 'state_check', 'damage_settlement', 'state_settlement', 'counter_action', 'counter_window', 'summon_assist', 'final_result'].includes(String(node.nodeKind || '')) && 因果链节点默认可见(node)).forEach((node, index, list) => pushChildLine(node, 构建子级树前缀('├─', index === list.length - 1)));
              return;
            }
            pushChildLine(child);
          });
          if (lines.length) lines[lines.length - 1].text = String(lines[lines.length - 1].text || '').replace(/^├─/, '└─');
          const actionPrefix = String(root.source || '').trim() === 'summon' ? '召唤自主行动' : '执行';
          const title = `[行动链] ${actor} ${actionPrefix}【${finalAction}】${target ? ` -> ${target}` : ''}`;
          const 展示权重 = 计算因果链展示权重(条目);
          const summary = 展示权重.reasons.length ? `${title}｜${展示权重.reasons.join('、')}` : title;
          const treeHtml = `<div class="battle-preview-trace-tree battle-preview-trace-timeline">${lines.map(line => {
            const kind = String(line?.kind || 'detail').trim() || 'detail';
            return `<div class="battle-preview-trace-node battle-preview-trace-node--${htmlEscapeText(kind)}" data-trace-node-kind="${htmlEscapeText(kind)}"><span>${渲染判定侧写HTML(line?.text || '', {}, line?.evidence || [])}</span></div>`;
          }).join('\n')}</div>`;
          const detailHtml = detailLines.length ? `
            <details class="battle-preview-trace-detail-fold">
              <summary>展开判定明细</summary>
              <div class="battle-preview-trace-tree battle-preview-trace-timeline battle-preview-trace-detail-tree">${detailLines.map(line => {
                const kind = String(line?.kind || 'detail').trim() || 'detail';
                return `<div class="battle-preview-trace-node battle-preview-trace-node--${htmlEscapeText(kind)} battle-preview-trace-node--detail" data-trace-node-kind="${htmlEscapeText(kind)}"><span>${渲染判定侧写HTML(line?.text || '', {}, line?.evidence || [])}</span></div>`;
              }).join('\n')}</div>
            </details>
          ` : '';
          return `
            <details class="battle-preview-trace-row battle-preview-trace-card battle-preview-trace-card--action-chain battle-preview-action-chain-fold" data-smart-collapse="1" data-event-weight="${htmlEscapeText(展示权重.eventWeight)}"${展示权重.childEscalated ? ' data-child-escalated="1"' : ''}${展示权重.collapse ? '' : ' open'}>
              <summary class="battle-preview-trace-title"><b>${htmlEscapeText(summary)}</b></summary>
              ${treeHtml}
              ${detailHtml}
            </details>
          `;
        }
        function 格式化结算数值(value) {
          const number = Number(value);
          if (!Number.isFinite(number)) return '';
          return Math.abs(number - Math.round(number)) < 0.01 ? String(Math.round(number)) : number.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
        }

        function 构建基础伤害代入式(values = {}) {
          const text = String(values.formulaText || '').trim();
          const skillPower = Number(values.skillPower || 0);
          const attackValue = Number(values.attackValue || 0);
          const defenseValue = Number(values.defenseValue || 0);
          const baseDamage = Number(values.baseDamage || 0);
          if (!(skillPower > 0) || !(baseDamage > 0)) return '';
          const terms = [格式化结算数值(skillPower)];
          if (attackValue > 0 && defenseValue > 0) terms.push(`(${格式化结算数值(attackValue)}/${格式化结算数值(defenseValue)})`);
          if (/魂力驱动/.test(text) && Number.isFinite(Number(values.soulDriveScale))) terms.push(格式化结算数值(values.soulDriveScale));
          if (/精神驱动/.test(text) && Number.isFinite(Number(values.spiritDriveScale))) terms.push(格式化结算数值(values.spiritDriveScale));
          if (/定位/.test(text) && Number.isFinite(Number(values.positionDamageScale))) terms.push(格式化结算数值(values.positionDamageScale));
          if (/近身系数/.test(text) && Number.isFinite(Number(values.meleeContactScale))) terms.push(格式化结算数值(values.meleeContactScale));
          if (/消耗加成/.test(text) && Number.isFinite(Number(values.costDamageScale))) terms.push(格式化结算数值(values.costDamageScale));
          const fusionDamageMult = Number(values.fusionDamageMult || 1);
          if (Number.isFinite(fusionDamageMult) && Math.abs(fusionDamageMult - 1) >= 0.0001) terms.push(格式化结算数值(fusionDamageMult));
          return terms.length >= 2 ? `代入：${terms.join('×')}=${格式化结算数值(baseDamage)}` : '';
        }

        function 构建结算链事件明细(event = {}) {
          if (String(event?.eventKind || '').trim() !== 'hit_result') return [];
          const meta = event?.meta && typeof event.meta === 'object' ? event.meta : {};
          const result = String(event?.result || '').trim();
          const incoming = Math.max(0, Number(meta.incomingDamage || 0));
          const reactive = Math.max(0, Number(meta.reactiveDamage || 0));
          const threshold = Math.max(0, Number(meta.defenseThreshold || 0));
          const finalDamage = Math.max(0, Number(meta.damage || event.damage || 0));
          const segmentIndex = Math.max(0, Number(meta.segmentIndex || 0));
          const segmentCount = Math.max(0, Number(meta.segmentCount || 0));
          const lines = [];
          if (/miss|evade|dodge|未命中|闪避/.test(result)) {
            const dodgeRate = Number(meta.dodgeRate);
            const dodgeRoll = Number(meta.dodgeRoll);
            const parts = ['命中被规避'];
            if (Number.isFinite(dodgeRate) && dodgeRate > 0) parts.push(`闪避率 ${格式化结算数值(dodgeRate)}`);
            if (Number.isFinite(dodgeRoll) && dodgeRoll > 0) parts.push(`投点 ${格式化结算数值(dodgeRoll)}`);
            lines.push(`检定链：${parts.join(' -> ')}`);
            return lines;
          }
          const formulaTrace = meta.formulaTrace && typeof meta.formulaTrace === 'object' ? meta.formulaTrace : meta;
          const baseFormulaText = String(formulaTrace.formulaText || meta.baseFormulaText || '').trim();
          const damageType = String(formulaTrace.damageType || meta.damageType || '').trim();
          const skillPower = Number(formulaTrace.skillPower || meta.skillPower || 0);
          const attackValue = Number(formulaTrace.attackValue || meta.formulaAttackValue || 0);
          const defenseValue = Number(formulaTrace.defenseValue || meta.formulaDefenseValue || 0);
          const baseDamage = Number(formulaTrace.baseDamage || meta.baseFormulaDamage || 0);
          if (baseFormulaText && skillPower > 0 && baseDamage > 0) {
            const params = [`威力 ${格式化结算数值(skillPower)}`];
            if (attackValue > 0) params.push(`攻势 ${格式化结算数值(attackValue)}`);
            if (defenseValue > 0 && defenseValue !== 1) params.push(`防守 ${格式化结算数值(defenseValue)}`);
            const substitution = 构建基础伤害代入式({
              formulaText: baseFormulaText,
              skillPower,
              attackValue,
              defenseValue,
              baseDamage,
              soulDriveScale: Number(meta.soulDriveScale || formulaTrace.soulDriveScale || 0),
              spiritDriveScale: Number(meta.spiritDriveScale || formulaTrace.spiritDriveScale || 0),
              positionDamageScale: Number(meta.positionDamageScale || formulaTrace.positionDamageScale || 0),
              meleeContactScale: Number(meta.meleeContactScale || formulaTrace.meleeContactScale || 0),
              costDamageScale: Number(meta.costDamageScale || formulaTrace.costDamageScale || 0),
              fusionDamageMult: Number(meta.fusionDamageMult || formulaTrace.fusionDamageMult || 1),
            });
            lines.push(`基础公式：${damageType ? `【${damageType}】` : ''}${baseFormulaText}，${params.join('，')}，得出 ${格式化结算数值(baseDamage)}${substitution ? `；${substitution}` : ''}`);
          }
          const damagePath = [];
          if (segmentCount > 1 && segmentIndex > 0) damagePath.push(`第${格式化结算数值(segmentIndex)}/${格式化结算数值(segmentCount)}段`);
          if (incoming > 0) damagePath.push(`入参段伤害 ${格式化结算数值(incoming)}`);
          if (reactive > 0 && Math.round(reactive) !== Math.round(incoming)) damagePath.push(`反应/元素后 ${格式化结算数值(reactive)}`);
          if (threshold > 0) damagePath.push(`破防阈值 ${格式化结算数值(threshold)}`);
          if (finalDamage > 0) damagePath.push(`最终扣血 ${格式化结算数值(finalDamage)}`);
          if (damagePath.length >= 2) lines.push(`伤害路径：${damagePath.join(' -> ')}`);

          const attackDefenseParts = [];
          const actualDefense = Number(meta.actualDefense);
          if (Number.isFinite(actualDefense) && actualDefense > 0) attackDefenseParts.push(`有效防御 ${格式化结算数值(actualDefense)}`);
          if (Number(meta.defenseStrip || 0) > 0) attackDefenseParts.push(`防御剥夺 ${格式化结算数值(Number(meta.defenseStrip) * 100)}%`);
          if (Number(meta.spiritResistStrip || 0) > 0) attackDefenseParts.push(`精神抗性剥夺 ${格式化结算数值(Number(meta.spiritResistStrip) * 100)}%`);
          if (threshold > 0) attackDefenseParts.push(segmentCount > 1 ? '破防阈值=防御×0.008÷√段数' : '破防阈值=防御×0.008');
          if (attackDefenseParts.length) lines.push(`攻防参数：${attackDefenseParts.join('，')}`);

          const multiplierParts = [
            ['soulDriveScale', '魂力驱动', 1, 'x'],
            ['spiritDriveScale', '精神驱动', 1, 'x'],
            ['positionDamageScale', '定位', 1, 'x'],
            ['costDamageScale', '消耗', 1, 'x'],
            ['fluctuation', '波动', 1, 'x'],
            ['damageReduction', '减伤', 0, '-'],
            ['jadeHandReduction', '玄玉手', 0, '-'],
            ['receivedDamageMult', '承伤', 1, 'x'],
            ['elementDamageMult', '元素承伤', 1, 'x'],
            ['finalDamageMult', '最终倍率', 1, 'x'],
            ['finalDamageBonus', '最终加值', 0, '+'],
            ['activeReactionShield', '反应护盾', 0, '-'],
          ].map(([key, label, neutral, prefix]) => {
            const value = Number(meta[key]);
            if (!Number.isFinite(value) || Math.abs(value - neutral) < 0.0001) return '';
            const displayValue = 格式化结算数值(value);
            if (String(displayValue) === String(格式化结算数值(neutral))) return '';
            if (prefix === 'x') return `${label}×${格式化结算数值(value)}`;
            if (prefix === '-') return `${label}-${格式化结算数值(key.includes('Reduction') ? value * 100 : value)}${key.includes('Reduction') ? '%' : ''}`;
            return `${label}+${格式化结算数值(value)}`;
          }).filter(Boolean);
          if (multiplierParts.length) lines.push(`倍率修正：${multiplierParts.join('，')}`);

          const breakType = String(meta.breakType || '').trim();
          if ((/graze|chip|擦伤/.test(result) || breakType) && reactive > 0 && threshold > 0) {
            const ratio = reactive / Math.max(1, threshold);
            if (ratio >= 0.22) {
              const grazeScale = 0.32 + Math.min(0.46, ratio * 0.48);
              lines.push(`擦伤公式：破防接近度 ${格式化结算数值(ratio)}，韧性削伤=floor(${格式化结算数值(reactive)}×${格式化结算数值(grazeScale)})=${格式化结算数值(finalDamage)}`);
            } else {
              lines.push(`擦伤公式：破防接近度 ${格式化结算数值(ratio)} < 0.22，仅保留 1 点强制伤害`);
            }
          } else if (reactive > 0 && threshold > 0) {
            lines.push(`破防判定：${格式化结算数值(reactive)} ≥ ${格式化结算数值(threshold)}，进入直接伤害结算`);
          }
          return lines;
        }

        function 格式化结算链事件文本(event = {}) {
          const kind = String(event?.eventKind || '').trim();
          const actor = String(event?.actorName || '行动者').trim();
          const target = String(event?.targetName || '目标').trim();
          const action = normalizeBattleActionDisplayName(event?.actionName || event?.sourceActionName || '') || '行动';
          const stateName = 读取事件账本状态名(event);
          const amount = Math.max(0, 读取事件账本数值(event, 'damage') || 读取事件账本数值(event, 'amount'));
          const result = String(event?.result || '').trim();
          const damageDetailText = () => {
            const firstDetail = 构建结算链事件明细(event).find(line => /^伤害路径：/.test(line));
            return firstDetail ? `（计算：${firstDetail.replace(/^伤害路径：/, '')}）` : '';
          };
          const stateDetailText = () => {
            const explicitBreakdown = String(event?.meta?.successRateBreakdown || event?.meta?.stateSuccessRateBreakdown || '').trim();
            if (explicitBreakdown) return `（计算：${explicitBreakdown}）`;
            return '（计算：缺少 successRateBreakdown / successRateReason，无法生成附着成功率计算式）';
          };
           if (kind === 'hit_result') {
             if (/miss|evade|dodge|未命中|闪避/.test(result)) return `${actor}的【${action}】未能命中${target}。`;
             if (/graze|chip|擦伤/.test(result)) return `${actor}的【${action}】擦过${target}，造成 ${amount} 点擦伤${damageDetailText()}。`;
             return amount > 0
               ? `${actor}的【${action}】命中${target}，造成 ${amount} 点伤害${damageDetailText()}。`
               : `${actor}的【${action}】落到${target}身上，但未造成实质伤害。`;
           }
           if (kind === 'dodge') {
             const sourceAction = normalizeBattleActionDisplayName(event?.sourceActionName || '');
             if (/evaded|miss|dodge_success|闪避成功|未命中/.test(result) && sourceAction) {
               return `${target}的【${sourceAction}】未能命中${actor}。`;
             }
             return `${actor}以【${action}】调整身位，尝试避开${target}的攻势。`;
           }
           if (kind === 'state_apply') {
            const duration = Math.max(0, Number(event?.duration || 0));
            if (/immune|immunity|免疫|无视异常/.test(result)) {
              return `${target}免疫了${actor}的【${action}】附带的【${stateName || '状态'}】${stateDetailText()}。`;
            }
            if (/resist|resisted|抵抗|豁免/.test(result)) {
              return `${target}抵住了${actor}的【${action}】附带的【${stateName || '状态'}】${stateDetailText()}。`;
            }
            return `${actor}的【${action}】令${target}陷入【${stateName || '状态'}】${duration > 0 ? `（持续${duration}回合）` : ''}${stateDetailText()}。`;
          }
          if (kind === 'counter') {
            const failReason = 映射玩家可见失败原因(event?.reasonCode || event?.meta?.reasonCode || '', event?.failReason || event?.failureReason || event?.meta?.failureReason || '');
            if (result === 'fail') return `${actor}尝试以【${action}】反击${target}，但${failReason || '未能完成反打'}。`;
            return amount > 0
              ? `${actor}以【${action}】反击${target}，造成 ${amount} 点伤害。`
              : `${actor}以【${action}】反击${target}，但未造成实质伤害。`;
          }
          if (kind === 'summon_assist') {
            const host = String(event?.meta?.hostName || event?.meta?.summonHostName || '宿主').trim();
            const hostAction = normalizeBattleActionDisplayName(event?.meta?.hostActionName || '有效攻势');
            const hostDamage = Math.max(0, Number(event?.meta?.hostDamage || 0));
            const assistDamage = Math.max(0, 读取事件账本数值(event, 'damage'));
            return `${actor}承接${host}的【${hostAction}】协同追击${target}${assistDamage > 0 ? `，造成 ${assistDamage} 点伤害` : ''}${hostDamage > 0 ? `（触发源伤害 ${hostDamage}）` : ''}。`;
          }
          if (kind === 'blocked_action' || kind === 'failed_action' || kind === 'target_fail') {
            const reason = 映射玩家可见失败原因(event?.reasonCode || event?.meta?.reasonCode || '', event?.failReason || event?.failureReason || event?.meta?.reasonText || event?.meta?.failureReason || '') || '被对手压住节奏';
            return `${actor}的【${action}】动作受阻：${reason}。`;
          }
          if (kind === 'create') return `${actor}完成【${action}】，生成造物。`;
          if (kind === 'summon_create') {
            const summonName = String(event?.meta?.summonName || '召唤物').trim();
            const summonType = String(event?.meta?.summonType || '召唤单位').trim();
            const summonMode = String(event?.meta?.summonMode || '协同攻击').trim();
            const mentalLoad = Math.max(0, Math.round(Number(event?.meta?.mentalLoad || 0)));
            return `${actor}完成【${action}】，召出${summonType}【${summonName}】，行动模式：${summonMode}${mentalLoad > 0 ? `，精神负载 ${mentalLoad}` : ''}，下回合起纳入行动轴。`;
          }
          if (kind === 'shield_create') return `${actor}完成【${action}】，生成护盾${amount > 0 ? ` ${amount} 点` : ''}。`;
          if (kind === 'resource_change') {
            const resource = String(event?.meta?.resource || '资源').trim();
            const delta = Math.round(Number(event?.meta?.delta || 0));
            const targetLabel = target || actor || '目标';
            if (!delta) return '';
            return `${targetLabel}的${resource}${delta > 0 ? '恢复' : '消耗'} ${Math.abs(delta)} 点。`;
          }
          return '';
        }

        function 构建回合末状态聚合侧写条目(eventLedger = []) {
          const groups = new Map();
          (Array.isArray(eventLedger) ? eventLedger : [])
            .filter(event => event && String(event.eventKind || '').trim() === 'state_tick')
            .forEach(event => {
              const round = Math.max(0, Number(event.round || event.sourceRound || 0));
              const stateName = 读取事件账本状态名(event);
              const aggregateKind = BATTLE_RUNTIME.inferStateTickAggregateKind(event);
              const resource = String(event?.meta?.resource || '生命值').trim();
              if (!(round > 0) || !stateName) return;
              const key = `${round}|${aggregateKind}|${stateName}|${resource}`;
              if (!groups.has(key)) groups.set(key, { round, aggregateKind, stateName, resource, events: [] });
              groups.get(key).events.push(event);
            });
          return [...groups.values()]
            .filter(group => group.events.length >= 2)
            .map(group => {
              const isHeal = group.aggregateKind === 'heal_tick';
              const total = group.events.reduce((sum, event) => sum + Math.max(0, 读取事件账本数值(event, 'amount')), 0);
              const children = group.events.map(event => {
                const target = String(event.targetName || '目标').trim();
                const amount = Math.max(0, 读取事件账本数值(event, 'amount'));
                return `${target}${isHeal ? '恢复' : '损失'} ${amount} 点${group.resource}`;
              });
              return {
                type: 'settlement_aggregation',
                round: group.round,
                回合: group.round,
                roundPhase: 'turn_end',
                kind: 'status_tick_aggregation',
                aggregateKind: group.aggregateKind,
                stateName: group.stateName,
                childNodeIds: group.events.map(event => String(event.chainNodeId || '').trim()).filter(Boolean),
                ledgerEventIds: group.events.map(event => String(event.eventId || '').trim()).filter(Boolean),
                sourceNodeIds: group.events.map(event => String(event.chainNodeId || '').trim()).filter(Boolean),
                sourceEventIds: group.events.map(event => String(event.eventId || '').trim()).filter(Boolean),
                text: `【${group.stateName}】在 ${group.events.length} 个目标身上结算，合计${isHeal ? '恢复' : '造成'} ${Math.round(total)} 点${group.resource}`,
                children,
                fromEventLedger: true,
              };
            });
        }
        function 构建事件账本结算链侧写条目(eventLedger = []) {
          const seen = new Set();
          return (Array.isArray(eventLedger) ? eventLedger : [])
            .map(event => {
              const kind = String(event?.eventKind || '').trim();
              if (!['hit_result', 'state_apply', 'resource_change', 'counter', 'create', 'summon_create', 'summon_assist', 'shield_create', 'blocked_action', 'failed_action', 'target_fail', 'dodge'].includes(kind)) return null;
              const text = 格式化结算链事件文本(event);
              if (!text) return null;
              const round = Math.max(0, Number(event?.round || event?.sourceRound || 0));
              const key = [
                round,
                text,
              ].join('|');
              if (seen.has(key)) return null;
              seen.add(key);
              return {
                type: 'settlement',
                round,
                回合: round,
                text,
                details: 构建结算链事件明细(event),
                roundPhase: kind === 'state_tick' ? 'turn_end' : 'action_result',
                kind,
                sourceEventId: String(event?.eventId || '').trim(),
                sourceNodeId: String(event?.chainNodeId || '').trim(),
                ledgerEventIds: [String(event?.eventId || '').trim()].filter(Boolean),
                fromEventLedger: true,
              };
            })
            .filter(Boolean);
        }

        function 构建结算链侧写条目(logs = [], context = {}) {
          const ledger = context?.eventLedger || context?.combatData?.__battleEventLedger || [];
          const eventItems = 构建事件账本结算链侧写条目(ledger);
          const aggregationItems = 构建回合末状态聚合侧写条目(ledger);
          const eventLines = 构建事件账本公开战报Block文本行(ledger, 24, context);
          const rawLines = eventLines.filter(line => /随后受【/.test(String(line || '')));
          const lines = aggregationItems.length ? [] : ((typeof Formatter !== 'undefined' && Formatter.filterMechanicalDuplicates) ? Formatter.filterMechanicalDuplicates(rawLines) : rawLines.filter(line => !/^第\d+回合：结果判定：/.test(String(line || '').trim())));
          const tickItems = lines.map(line => {
            const match = String(line || '').match(/^(?:第(\d+)回合[：:]|[【\[]第(\d+)回合[】\]])\s*(.+)$/);
            const round = Number(match?.[1] || match?.[2] || 0);
            const text = String(match?.[3] || line || '').trim();
            return {
              type: 'settlement',
              round,
              回合: round,
              text,
              roundPhase: /随后受【/.test(text) ? 'turn_end' : 'action_result',
              kind: /随后受【/.test(text) ? 'status_tick' : 'settlement',
            };
          }).filter(item => item.text);
          return [...eventItems, ...aggregationItems, ...tickItems];
        }

        function 读取判定流程输入文本(轨迹 = {}) {
          const 来源 = String(轨迹.候选来源 || '').trim();
          const 类型 = 读取轨迹类型(轨迹);
          if (类型 === '战术确立') return '玩家手选动作';
          if (/主动战术|主动战略|主动/.test(来源) || 类型 === '主动规划') return '自动续推/主动规划';
          if (/应招/.test(来源) || 类型 === '应招审计') return '遭遇攻击，触发应招判定';
          if (/再判定/.test(来源) || 类型 === '再判定审计') return '行为链再判定';
          if (/换招/.test(来源) || 类型 === '换招审计') return '动作受阻，触发换招审计';
          return 来源 || 类型 || '系统判定';
        }

        function 读取过滤证据字段(轨迹 = {}) {
          const 候选 = 读取判定流程候选列表(轨迹, 0);
          const 技能名 = normalizeBattleActionDisplayName(轨迹.技能 || 轨迹.实际技能 || 轨迹.动作校正?.实际技能 || '');
          const 命中候选 = 技能名 ? 候选.find(item => 读取候选名称(item) === 技能名) : null;
          const 读取候选码 = item => [
            item?.reasonCode,
            item?.rejectionCode,
            item?.filterCode,
            item?.statusCode,
            item?.审计?.reasonCode,
            item?.审计?.rejectionCode,
            item?.审计?.filterCode,
            item?.审计?.statusCode,
          ].map(code => String(code || '').trim()).filter(Boolean);
          const 候选资源阻断 = item =>
            item?.资源可行 === false ||
            item?.审计?.资源可行 === false ||
            item?.可释放 === false ||
            item?.审计?.可释放 === false ||
            Number(item?.资源修正 ?? item?.审计?.资源修正 ?? 0) <= -30 ||
            读取候选码(item).some(code => /OUT_OF_MANA|RESOURCE|COST|CAST_RESOURCE|资源不可释放|资源不足/.test(code));
          const 候选冷却阻断 = item =>
            Number(item?.cooldownRemaining ?? item?.冷却剩余 ?? item?.审计?.cooldownRemaining ?? item?.审计?.冷却剩余 ?? 0) > 0 ||
            读取候选码(item).some(code => /COOLDOWN|CD|冷却/.test(code));
          const 候选状态阻断 = item =>
            item?.状态限制 === true ||
            item?.审计?.状态限制 === true ||
            读取候选码(item).some(code => /STATE_LOCK|CONTROLLED|SILENCED|DISARMED|STUNNED|HARD_CC|状态限制|无法行动|沉默|封技|缴械|硬控/.test(code));
          const 有资源阻断 = Number(轨迹.资源修正 || 0) <= -30 ||
            (命中候选 ? 候选资源阻断(命中候选) : (候选.length > 0 && 候选.every(候选资源阻断)));
          return {
            候选数: 候选.length,
            资源或释放条件不足: 有资源阻断,
            冷却证据: 命中候选 ? 候选冷却阻断(命中候选) : (候选.length > 0 && 候选.every(候选冷却阻断)),
            状态限制证据: 命中候选 ? 候选状态阻断(命中候选) : (候选.length > 0 && 候选.every(候选状态阻断)),
            目标条件不成立: !String(轨迹.目标 || '').trim() && !判定轨迹是目标规划(轨迹),
            无候选命中: 候选.length > 0 && !String(轨迹.技能 || '').trim(),
          };
        }

        function 读取判定流程过滤文本(轨迹 = {}) {
          const 类型 = 读取轨迹类型(轨迹);
          if (类型 === '战术确立') return '本轮主轴动作已确认并接入行动链';
          const 证据 = 读取过滤证据字段(轨迹);
          const 失败 = [];
          if (证据.资源或释放条件不足) 失败.push('资源或释放条件不足');
          if (证据.冷却证据) 失败.push('技能仍在冷却中');
          if (证据.状态限制证据) 失败.push('状态限制导致动作不可用');
          if (证据.目标条件不成立) 失败.push('目标条件不成立');
          if (失败.length) return 失败.join('；');
          if (/应招审计/.test(类型)) {
            if (证据.候选数 <= 0) return '当前未能捕捉到有效的规避或招架窗口';
            if (证据.无候选命中) return '当前未能形成有效的规避或招架方案';
            return '当前仍有规避或招架余地';
          }
          if (证据.候选数 <= 0) return '当前没有形成明确的出手机会';
          if (证据.无候选命中) return '常规方案收益过低，被暂时否决';
          return '当前仍具备出手条件';
        }

        function 读取判定流程无动作原因(轨迹 = {}) {
          const 证据 = 读取过滤证据字段(轨迹);
          const 原因 = [];
          if (证据.目标条件不成立) 原因.push('目标条件不成立');
          if (证据.资源或释放条件不足) 原因.push('资源或释放条件不足');
          if (证据.冷却证据) 原因.push('技能仍在冷却中');
          if (证据.状态限制证据) 原因.push('状态限制导致动作不可用');
          if (证据.候选数 <= 0) 原因.push('当前层未生成有效动作候选');
          if (!原因.length) 原因.push('候选因权重过低或条件不符未被采用');
          return 原因.join(' / ');
        }

        function 清洗主卡战术文本(raw = '') {
          return String(raw || '')
            .replace(/\s+/g, ' ')
            .trim();
        }

        function 判定侧写是敌方动作(轨迹 = {}) {
          const 类型 = 读取轨迹类型(轨迹);
          const 来源 = String(轨迹.候选来源 || '').trim();
          if (/辅助目标规划|友方目标|辅助目标/.test(`${类型} ${来源}`)) return false;
          const 技能 = normalizeBattleActionDisplayName(轨迹.finalResolvedActionName || 轨迹.技能 || '');
          const 命中候选名 = normalizeBattleActionDisplayName(轨迹.hitCandidateName || '');
          const 覆写来源 = String(轨迹.actionOverrideSource || '').trim();
          const 目标语义 = 读取轨迹目标语义(轨迹);
          const 分类 = 轨迹.效果原型分类 || {};
          const actor = String(轨迹.行动者 || '').trim();
          const target = String(轨迹.目标 || 轨迹.实际目标 || '').trim();
          if ((actor && target && isSameBattleReportName(actor, target)) || /自身|友方单体|友方群体/.test(目标语义)) return false;
          if (String(分类?.目标阵营 || '').trim() === '友方') return false;
          if (分类?.是否资源恢复 === true) return false;
          if (['治疗', '防护', '资源'].includes(String(分类?.主要效果类型 || '').trim())) return false;
          const 支援动作 = /治疗|防护|保核|友方|自身|资源恢复|回复|恢复|护援|护盾|庇护/.test(技能)
            && !/攻击|普通攻击|伤害|控制|封技|打断|限制|中毒|削弱|破防|收割|压制/.test(技能);
          return !!轨迹.目标 && !支援动作;
        }

        function 判定侧写是造物或自用动作(轨迹 = {}) {
          const 技能 = normalizeBattleActionDisplayName(轨迹.技能 || 轨迹.实际技能 || 轨迹.finalResolvedActionName || '');
          const 目标语义 = 读取轨迹目标语义(轨迹);
          const 承载方式 = String(轨迹.承载方式 || '').trim();
          const 分类 = 轨迹.效果原型分类 || {};
          const 文本 = `${技能} ${目标语义} ${承载方式} ${String(分类?.主要效果类型 || '')} ${String(分类?.目标阵营 || '')}`;
          if ((/造物|物品|药剂|食物/.test(文本) || /造物承载|物品使用/.test(承载方式)) && !/攻击|伤害|削弱|控制|封技|打断/.test(文本)) return true;
          if (String(分类?.目标阵营 || '').trim() === '友方' && 分类?.是否资源恢复 === true) return true;
          if (/食物|药剂|物品|造物/.test(技能) && ['资源', '治疗', '防护'].includes(String(分类?.主要效果类型 || '').trim())) return true;
          return false;
        }

        function 读取守势转入原因类别(轨迹 = {}) {
          const 技能 = normalizeBattleActionDisplayName(轨迹.finalResolvedActionName || 轨迹.实际技能 || 轨迹.技能 || '');
          const 文本 = [
            技能,
            String(轨迹.hitCandidateName || ''),
            String(轨迹.承载方式 || ''),
            String(轨迹.resolutionType || ''),
            String(轨迹.skipReason || ''),
          ].join(' ');
          const 候选文本 = 读取判定流程候选列表(轨迹, 0)
            .map(item => `${读取候选名称(item)}:${Math.round(读取候选权重(item))}`)
            .join('；');
          const 压制计数 = Number(轨迹?.threatProfile?.连续压制次数 || 轨迹?.连续压制次数 || 0);
          const 落空计数 = Number(轨迹?.threatProfile?.闪避克制次数 || 轨迹?.闪避克制次数 || 0);
          if (/压制|逼抢|贴身|强压|来袭|敌方攻势|承压|保命|保核|高威胁|当前不宜继续前压/.test(`${文本} ${候选文本}`) && (压制计数 > 0 || /承伤硬抗|坚壁反制|借力守势|伺机闪避|危机自保/.test(技能))) {
            return 'pressure';
          }
          if (/收招转防|战术观察|待机|守势维持|守势对峙/.test(技能) && (/窗口|未形成有效出手机会|收益过低|无可用候选|放弃继续执行|重校|动作受阻|改以/.test(`${文本} ${候选文本}`) || 落空计数 > 0)) {
            return 'window_lost';
          }
          if (/伺机闪避|闪避/.test(技能) && /窗口|重排|拉开|观察/.test(`${文本} ${候选文本}`)) return 'window_lost';
          return 'pressure';
        }

        function 判定侧写是自我应对动作(轨迹 = {}) {
          const 技能 = normalizeBattleActionDisplayName(轨迹.技能 || 轨迹.实际技能 || 轨迹.动作校正?.实际技能 || '');
          const actor = String(轨迹.行动者 || '').trim();
          const target = String(轨迹.目标 || 轨迹.实际目标 || '').trim();
          return /伺机闪避|闪避|承伤硬抗|肉体兜底|硬抗|防御|危机自保|坚壁反制|收招转防|借力守势|撤离|战术观察|待机|守势维持|守势对峙/.test(技能) ||
            (!!actor && !!target && isSameBattleReportName(actor, target));
        }

        function 读取轨迹目标语义(轨迹 = {}) {
          return String(
            轨迹.目标语义 ||
            轨迹.目标类型 ||
            轨迹.目标范围 ||
            轨迹.skill?.目标 ||
            轨迹.skill?.target ||
            轨迹.技能数据?.目标 ||
            '',
          ).trim();
        }

        function 判定侧写是友方支援动作(轨迹 = {}) {
          const 类型 = 读取轨迹类型(轨迹);
          const 来源 = String(轨迹.候选来源 || '').trim();
          const 技能 = normalizeBattleActionDisplayName(轨迹.技能 || 轨迹.实际技能 || 轨迹.动作校正?.实际技能 || '');
          const actor = String(轨迹.行动者 || '').trim();
          const target = String(轨迹.目标 || 轨迹.实际目标 || '').trim();
          const 目标语义 = 读取轨迹目标语义(轨迹);
          const 承载方式 = String(轨迹.承载方式 || '').trim();
          const 分类 = 轨迹.效果原型分类 || {};
          const 文本 = `${类型} ${来源} ${技能} ${目标语义} ${承载方式} ${String(分类?.主要效果类型 || '')} ${String(分类?.目标阵营 || '')}`;
          if (判定侧写是造物或自用动作(轨迹)) return true;
          if (actor && target && isSameBattleReportName(actor, target) && !isBattleTacticalFallbackAction(技能)) return true;
          if (/自身|友方单体|友方群体/.test(目标语义)) return true;
          if (/辅助目标规划|友方目标|辅助目标/.test(`${类型} ${来源}`)) return true;
          if (/治疗|防护|保核|友方|自身|资源恢复|回复|恢复|护援|护盾|庇护|造物|药剂|物品|造物承载|物品使用/.test(文本) &&
              !/攻击|普通攻击|伤害|控制|封技|打断|限制|中毒|削弱|破防|收割/.test(技能)) return true;
          return false;
        }

        function 构建行为链校验侧写行(轨迹 = {}) {
          const normalized = 归一判定轨迹(轨迹 || {});
          const 类型 = 读取轨迹类型(normalized);
          const 行动者 = String(
            normalized.reactionActorName ||
            normalized.反应行动者 ||
            normalized.行动者 ||
            '行动者'
          ).trim();
          const 来源行动者 = String(normalized.sourceActorName || normalized.来源行动者 || '').trim();
          const 来源动作 = normalizeBattleActionDisplayName(normalized.sourceActionName || normalized.来源动作 || '');
          const 当前动作 = normalizeBattleActionDisplayName(
            normalized.replanActionName ||
            normalized.finalResolvedActionName ||
            normalized.hitCandidateName ||
            normalized.技能 ||
            '当前动作'
          );
          const 候选名列表 = 读取判定流程候选列表(normalized, 0).map(读取候选名称).filter(Boolean);
          const 定义 = [];
          if ([当前动作, ...候选名列表].some(name => /抢落点/.test(name))) 定义.push('抢落点：争夺动作落点或先后窗口');
          if ([当前动作, ...候选名列表].some(name => /压招/.test(name))) 定义.push('压招：用当前动作压过对方动作');
          if ([当前动作, ...候选名列表].some(name => /偏转/.test(name))) 定义.push('偏转：降低或改变来袭效果');
          if ([当前动作, ...候选名列表].some(name => /伺机闪避/.test(name))) 定义.push('伺机闪避：规避并保留反击/再判定窗口');
          if ([当前动作, ...候选名列表].some(name => /^闪避$/.test(name))) 定义.push('闪避：只规避当前攻击');
          if (/承伤硬抗|防御|坚壁反制|借力守势|收招转防/.test(当前动作)) 定义.push(`${当前动作}：转入守势承接当前压力`);
          const 来源短语 = 来源动作 ? `应对${来源行动者 ? `${来源行动者}的` : ''}【${来源动作}】` : '处理当前动作窗口';
          const 标题 = /应招审计/.test(类型)
            ? `反应判定：${行动者}${来源短语}`
            : /再判定审计/.test(类型)
              ? `再判定：${行动者}复核${来源短语}`
              : `变招校验：${行动者}复核受阻后的动作`;
          const 动作行 = /应招审计/.test(类型)
            ? `应对动作：【${当前动作}】`
            : /再判定审计/.test(类型)
              ? `落点选择：【${当前动作}】`
              : `调整动作：【${当前动作}】`;
          return [
            `├─ ${标题}`,
            `├─ ${动作行}`,
            定义.length ? `└─ ${定义.join('；')}` : `└─ ${行动者}按当前窗口完成动作校验。`,
          ].map(清洗主卡战术文本).filter(Boolean);
        }

        function 构建通用事实侧写行(轨迹 = {}) {
          const normalized = 归一判定轨迹(轨迹 || {});
          const 类型 = 读取轨迹类型(normalized) || '判定';
          const 行动者 = String(normalized.行动者 || '行动者').trim();
          const 目标 = String(normalized.displayTargetName || normalized.目标 || '').trim();
          const 动作 = normalizeBattleActionDisplayName(
            normalized.finalResolvedActionName ||
            normalized.hitCandidateName ||
            normalized.技能 ||
            ''
          );
          return [
            `├─ ${类型}：${行动者}进入事实校验。`,
            `├─ ${目标 ? `当前对象：【${目标}】。` : '当前对象暂未确认。'}`,
            `└─ ${动作 ? `${行动者}记录动作为${包裹判定动作名称(动作)}。` : `${行动者}本段暂未记录可展示动作。`}`,
          ].map(清洗主卡战术文本).filter(Boolean);
        }

        function 构建轨迹侧写行(轨迹 = {}) {
          if (判定轨迹是目标规划(轨迹)) {
            return 构建目标规划事实侧写行(轨迹);
          }
          if (/主动规划|战术确立/.test(读取轨迹类型(轨迹))) {
            const dto = 构建NarrativeDecisionDTO(轨迹);
            const actorName = dto.actorName || 轨迹.行动者 || '行动者';
            const targetName = dto.targetName || 轨迹.目标 || '';
            const finalActionName = normalizeBattleActionDisplayName(dto.finalActionName || 轨迹.finalResolvedActionName || 轨迹.技能 || '');
            const actionText = 包裹判定动作名称(finalActionName || '当前动作');
            if (dto.narrationTrustLevel === 'INVALID') {
              return [
                '├─ 本段判定明细暂不可用。',
                `└─ ${actorName}本轮动作暂未确认。`,
              ].map(清洗主卡战术文本).filter(Boolean);
            }
            if (dto.narrationTrustLevel === 'TRUSTED') {
              const narration = formatTacticalNarration(dto);
              return [
                narration ? `├─ ${narration}` : '',
                `├─ ${targetName ? `当前指向：【${targetName}】。` : '当前没有明确目标。'}`,
                `└─ ${actorName}最终确认${actionText}${targetName ? `压向${targetName}` : ''}。`,
              ].map(清洗主卡战术文本).filter(Boolean);
            }
            return [
              `├─ ${targetName ? `当前指向：【${targetName}】。` : '当前没有明确目标。'}`,
              `└─ ${actorName}最终确认${actionText}${targetName ? `指向${targetName}` : ''}。`,
            ].map(清洗主卡战术文本).filter(Boolean);
          }
          if (判定轨迹是行为链校验(轨迹)) return 构建行为链校验侧写行(轨迹);
          return 构建通用事实侧写行(轨迹);
        }

        function 构建轨迹标题(轨迹 = {}) {
          const 类型 = 读取轨迹类型(轨迹) || '判定';
          const 行动者 = 轨迹.行动者 || '行动者';
          if (判定轨迹是目标规划(轨迹)) return `[${类型}] 🎯 ${行动者} ${判定目标规划为支援检索(轨迹) ? '确认支援对象' : '锁定对手'}`;
          if (类型 === '战术确立') return `[${类型}] ⚔️ ${行动者} 锁定${包裹判定动作名称(normalizeBattleActionDisplayName(轨迹.finalResolvedActionName || 轨迹.技能 || '当前动作'))}`;
          const 技能 = normalizeBattleActionDisplayName(轨迹.finalResolvedActionName || 轨迹.实际技能 || 轨迹.技能 || '');
          if (判定轨迹是行为链校验(轨迹)) {
            const 标签 = /应招审计/.test(类型)
              ? '应招校验'
              : /再判定审计/.test(类型)
                ? '落点校验'
                : '变招校验';
            return `[${类型}] 🧭 ${行动者} ${标签}${技能 ? 包裹判定动作名称(技能) : ''}`;
          }
          if (/收招转防/.test(技能)) return `[${类型}] ⚔️ ${行动者} 转入守势`;
          if (/战术观察/.test(技能)) return `[${类型}] ⚔️ ${行动者} 观察战局`;
          if (/待机|守势维持|守势对峙/.test(技能)) return `[${类型}] ⚔️ ${行动者} 稳住节奏`;
          if (技能) return `[${类型}] ⚔️ ${行动者} 最终执行${包裹判定动作名称(技能)}`;
          return `[${类型}] ⚔️ ${行动者} 守势观察`;
        }

        function 构建候选证据列表(轨迹 = {}) {
          return 读取判定流程候选列表(轨迹, 0).map(item => ({
            候选名: 读取候选名称(item),
            权重: 读取候选权重(item),
            目标: String(item?.目标 || item?.target || '').trim(),
            资源可行: item?.资源可行 ?? item?.审计?.资源可行 ?? null,
            资源修正: Number(item?.资源修正 ?? item?.审计?.资源修正 ?? 0),
            审计: item?.审计 || {},
          }));
        }

        function 格式化预演审计明细(轨迹 = {}, 前置 = null) {
          if (读取轨迹类型(轨迹) === '防反机制') {
            return [
              '原始类型：防反机制',
              `行动者：${轨迹.行动者 || ''}`,
              `目标：${轨迹.目标 || ''}`,
              `结果：${轨迹.result || ''}`,
              `防反原始日志：${轨迹.rawText || ''}`,
            ].join('\n');
          }
          const sidecar = 轨迹?.__narrativeDecisionSidecar && typeof 轨迹.__narrativeDecisionSidecar === 'object'
            ? 轨迹.__narrativeDecisionSidecar
            : null;
          const narrativeDto = sidecar ? 构建NarrativeDecisionDTO(轨迹) : null;
          const narrativeAudit = sidecar ? {
            actorName: String(narrativeDto?.actorName || ''),
            targetName: String(narrativeDto?.targetName || ''),
            finalActionName: String(narrativeDto?.finalActionName || ''),
            selectedCandidateName: String(narrativeDto?.selectedCandidateName || ''),
            declaredActionName: normalizeBattleActionDisplayName(轨迹.技能 || 轨迹.skill || ''),
            hitCandidateName: normalizeBattleActionDisplayName(轨迹.hitCandidateName || 轨迹.命中候选名 || ''),
            rawFinalActionName: normalizeBattleActionDisplayName(轨迹.finalResolvedActionName || 轨迹.最终落地动作 || ''),
            narrationTrustLevel: String(sidecar.narrationTrustLevel || ''),
            formulaTrustLevel: String(sidecar.formulaTrustLevel || ''),
            dominantReason: String(sidecar.dominantReason || ''),
            fatalCodes: Array.isArray(sidecar.fatalCodes) ? sidecar.fatalCodes.map(code => String(code || '')).filter(Boolean) : [],
          } : null;
          const 权重字段 = {
            原始权重: Number(轨迹.原始权重 || 0),
            战术修正: Number(轨迹.战术修正 || 0),
            团队意图修正: Number(轨迹.团队意图修正 || 0),
            recentActionCount: Number(轨迹.recentActionCount || 0),
            资源修正: Number(轨迹.资源修正 || 0),
            最终权重: Number(轨迹.最终权重 || 0),
          };
          return [
            `原始类型：${读取轨迹类型(轨迹)}`,
            `行动者：${轨迹.行动者 || ''}`,
            `目标：${轨迹.目标 || ''}`,
            `回合：${Number(轨迹.回合 || 0)}`,
            `候选来源：${轨迹.候选来源 || ''}`,
            `原始选择原因：${轨迹.选择原因 || ''}`,
            前置 ? `流转前置类型：${读取轨迹类型(前置)}` : '',
            前置 ? `流转前置选择原因：${前置.选择原因 || ''}` : '',
            narrativeAudit ? `NarrativeDecisionDTO审计：\n${格式化审计证据值(narrativeAudit)}` : '',
            `原始权重字段：\n${格式化审计证据值(权重字段)}`,
            `评分摘要：\n${格式化审计证据值(构建候选证据列表(轨迹))}`,
            `过滤证据字段：\n${格式化审计证据值(读取过滤证据字段(轨迹))}`,
            轨迹.动作校正?.发生校正 ? `执行校对证据：\n${格式化审计证据值(轨迹.动作校正)}` : '',
          ].filter(Boolean).join('\n');
        }

        function 判定显示战斗开发态明细() {
          return window?.__LWCS_BATTLE_DEBUG_VISIBLE__ === true || window?.BattleUI?.state?.showBattleDebug === true;
        }

        function 渲染战斗开发态明细(内容 = '') {
          if (!判定显示战斗开发态明细()) return '';
          return `
              <details class="battle-preview-debug">
                <summary>展开底层调试明细 (开发模式)</summary>
                <pre><code>${htmlEscapeText(内容)}</code></pre>
              </details>
            `;
        }

        function 渲染NarrativeDecision开发态摘要(decisionTrace = [], resolutionTrace = null) {
          if (!判定显示战斗开发态明细()) return '';
          const hasResolutionTraceInput = Array.isArray(resolutionTrace);
          const 行动链动作事实键集合 = new Set();
          (Array.isArray(resolutionTrace) ? resolutionTrace : [])
            .filter(node => node && typeof node === 'object' && String(node.nodeKind || '').trim() === 'action_decision')
            .forEach(node => {
              const round = Number(node.round || node.sourceRound || 0);
              const actor = String(node.actorName || '').trim();
              const action = normalizeBattleActionDisplayName(node.finalActionName || node.actionName || '');
              if (round > 0 && actor && action) 行动链动作事实键集合.add(`${round}::${actor}::${action}`);
            });
          const 标记摘要缺少行动事实 = trace => {
            if (!trace || typeof trace !== 'object') return;
            const normalized = 归一判定轨迹(trace || {});
            const round = Number(normalized.回合 || normalized.round || 0);
            const actor = String(normalized.行动者 || '').trim();
            const action = normalizeBattleActionDisplayName(normalized.finalResolvedActionName || normalized.技能 || normalized.hitCandidateName || '');
            if (!(round > 0) || !actor || !action || !hasResolutionTraceInput) return;
            if (行动链动作事实键集合.has(`${round}::${actor}::${action}`)) return;
            const sidecar = trace.__narrativeDecisionSidecar && typeof trace.__narrativeDecisionSidecar === 'object'
              ? trace.__narrativeDecisionSidecar
              : {};
            const fatalCodes = Array.isArray(sidecar.fatalCodes) ? sidecar.fatalCodes.slice() : [];
            if (!fatalCodes.includes('INVALID_ACTION_FACT')) fatalCodes.push('INVALID_ACTION_FACT');
            trace.__narrativeDecisionSidecar = {
              ...sidecar,
              narrationTrustLevel: 'INVALID',
              fatalCodes,
              dominantReason: '',
            };
          };
          const lines = (Array.isArray(decisionTrace) ? decisionTrace : [])
            .filter(trace => /主动规划|战术确立/.test(读取轨迹类型(归一判定轨迹(trace || {}))))
            .map(trace => {
              补写NarrativeDecisionSidecar(trace);
              标记摘要缺少行动事实(trace);
              const normalized = 归一判定轨迹(trace || {});
              const sidecar = trace?.__narrativeDecisionSidecar && typeof trace.__narrativeDecisionSidecar === 'object'
                ? trace.__narrativeDecisionSidecar
                : null;
              if (!sidecar) return '';
              const dto = 构建NarrativeDecisionDTO(trace);
              return `NarrativeDecisionDTO审计：\n${格式化审计证据值({
                actorName: String(dto.actorName || ''),
                targetName: String(dto.targetName || ''),
                finalActionName: String(dto.finalActionName || ''),
                selectedCandidateName: String(dto.selectedCandidateName || ''),
                declaredActionName: normalizeBattleActionDisplayName(trace?.技能 || trace?.skill || ''),
                hitCandidateName: normalizeBattleActionDisplayName(trace?.hitCandidateName || trace?.命中候选名 || ''),
                rawFinalActionName: normalizeBattleActionDisplayName(trace?.finalResolvedActionName || trace?.最终落地动作 || ''),
                narrationTrustLevel: String(sidecar.narrationTrustLevel || ''),
                formulaTrustLevel: String(sidecar.formulaTrustLevel || ''),
                dominantReason: String(sidecar.dominantReason || ''),
                fatalCodes: Array.isArray(sidecar.fatalCodes) ? sidecar.fatalCodes.map(code => String(code || '')).filter(Boolean) : [],
              })}`;
            })
            .filter(Boolean);
          return lines.length ? 渲染战斗开发态明细(lines.join('\n\n')) : '';
        }

        function 渲染判定流程卡片(轨迹 = {}, 前置 = null) {
          const normalized = 归一判定轨迹(轨迹);
          if (/主动规划|战术确立/.test(读取轨迹类型(normalized))) {
            构建NarrativeDecisionDTO(轨迹);
          }
          const 校正 = normalized.动作校正?.发生校正 ? normalized.动作校正 : null;
          const 中间推演列表 = Array.isArray(normalized.中间推演列表) ? normalized.中间推演列表 : [];
          const 目标遍历详情 = Array.isArray(normalized.目标遍历详情) ? normalized.目标遍历详情 : [];
          const cardClass = [
            'battle-preview-trace-row',
            'battle-preview-trace-card',
            判定轨迹是目标规划(normalized) ? 'battle-preview-trace-card--target' : 'battle-preview-trace-card--action',
            校正 ? 'battle-preview-trace-card--corrected' : '',
          ].filter(Boolean).join(' ');
          const 最终权重 = Math.round(Number(normalized.最终权重 || 0));
          const 零分紧凑 = /应招审计|再判定审计/.test(读取轨迹类型(normalized)) &&
            最终权重 === 0 &&
            !normalized.动作校正?.发生校正 &&
            (!normalized.中间推演列表 || normalized.中间推演列表.length === 0) &&
            (!normalized.目标遍历详情 || normalized.目标遍历详情.length === 0);
          const 校正HTML = 校正 ? `
              <div class="battle-preview-trace-correction">
                <b>${渲染判定侧写HTML(`原定倾向${包裹判定动作名称(校正.审计技能)}，改以${包裹判定动作名称(校正.实际技能)}应对。`, normalized)}</b>
              </div>
            ` : '';
          return `
            <div class="${cardClass}">
              <div class="battle-preview-trace-title">
                <b>${htmlEscapeText(构建轨迹标题(normalized))}</b>
              </div>
              ${零分紧凑 ? `
                <details class="battle-preview-trace-fold battle-preview-trace-fold--compact">
                  <summary>${htmlEscapeText(`${normalized.行动者 || '该单位'} ${/应招审计/.test(读取轨迹类型(normalized)) ? '校验当前攻势' : '复核当前动作'}（${/无法反应/.test(normalized.技能 || '') ? '节奏受压' : '暂未展开'}）`)}</summary>
                  <div class="battle-preview-trace-subtree">
                    ${构建轨迹侧写行(normalized).flatMap(line => String(line || '').split(/\r?\n/)).map(line => `<div class="battle-preview-trace-line">${渲染判定侧写HTML(line, normalized)}</div>`).join('')}
                  </div>
                </details>
              ` : `
                <div class="battle-preview-trace-tree">
                  ${构建轨迹侧写行(normalized).flatMap(line => String(line || '').split(/\r?\n/)).map(line => `<div class="battle-preview-trace-line">${渲染判定侧写HTML(line, normalized)}</div>`).join('')}
                </div>
              `}
              ${渲染判定候选对比HTML(normalized)}
              ${中间推演列表.length ? `
                <details class="battle-preview-trace-fold">
                  <summary>中间推演</summary>
                  <div class="battle-preview-trace-subtree">
                    ${中间推演列表.map(item => `<div class="battle-preview-trace-line">${渲染判定侧写HTML(`└─ ${构建中间推演摘要(item)}`, 归一判定轨迹(item))}</div>`).join('')}
                  </div>
                </details>
              ` : ''}
              ${目标遍历详情.length ? `
                <details class="battle-preview-trace-fold">
                  <summary>目标遍历详情</summary>
                  <div class="battle-preview-trace-subtree">
                    ${目标遍历详情.map(item => `<div class="battle-preview-trace-line">${渲染判定侧写HTML(`└─ ${构建中间推演摘要(item)}`, 归一判定轨迹(item))}</div>`).join('')}
                  </div>
                </details>
              ` : ''}
              ${校正HTML}
              ${渲染战斗开发态明细(格式化预演审计明细(normalized, 前置))}
            </div>
          `;
        }

        function 渲染流转侧写卡片(条目 = {}) {
          const from = 归一判定轨迹(条目.from || {});
          const to = 归一判定轨迹(条目.to || {});
          const 标题 = `[${读取轨迹类型(from) || '判定'}] 🔄 ${from.行动者 || '行动者'} 战术过渡`;
          const 明细 = [
            `流转前类型：${读取轨迹类型(from)}`,
            `流转前行动者：${from.行动者 || ''}`,
            `流转前回合：${Number(from.回合 || 0)}`,
            `流转前选择原因：${from.选择原因 || ''}`,
            `移交目标类型：${读取轨迹类型(to)}`,
            `移交目标候选来源：${to.候选来源 || ''}`,
            `移交目标技能：${to.技能 || ''}`,
          ].join('\n');
          return `
            <div class="battle-preview-trace-row battle-preview-trace-card battle-preview-trace-card--handoff">
              <div class="battle-preview-trace-title">
                <b>${htmlEscapeText(标题)}</b>
              </div>
              <div class="battle-preview-trace-tree">
                <span>${渲染判定侧写HTML('└─ 战略直觉暂未形成直接动作，转入常规战术博弈。', from)}</span>
              </div>
              ${渲染战斗开发态明细(明细)}
            </div>
          `;
        }

        function 渲染防反侧写卡片(轨迹 = {}) {
          const normalized = 归一判定轨迹(轨迹);
          const 错失 = String(normalized.result || '').trim() === 'fail';
          const 标题 = `[防反机制] ⚡ ${normalized.行动者 || '系统'} ${错失 ? '反击未成' : '完成反击'}`;
          const 反击动作 = normalizeBattleActionDisplayName(normalized.sourceActionName || '');
          const 显示动作 = 反击动作 || '反击';
          const 伤害 = Math.max(0, Number(normalized.damage || 0));
          const 原失败原因 = String(normalized.failReason || '').trim();
          const 概率片段 = String(原失败原因.match(/[（(]概率[:：]\s*\d+%[)）]/)?.[0] || '').trim();
          const 失败原因 = 原失败原因
            .replace(/[（(]概率[:：]\s*\d+%[)）]/g, '')
            .replace(/^未能完成反打$/g, '未形成稳定反打条件')
            .trim();
          const 展示失败原因 = 失败原因 || (概率片段 ? `未形成稳定反打条件${概率片段}` : '未形成稳定反打条件');
          const 目标 = String(normalized.目标 || normalized.displayTargetName || '').trim();
          return `
            <div class="battle-preview-trace-row battle-preview-trace-card battle-preview-trace-card--counter battle-preview-trace-subcard">
              <div class="battle-preview-trace-title">
                <b>${htmlEscapeText(标题)}</b>
              </div>
              <div class="battle-preview-trace-tree">
                <span>${渲染判定侧写HTML(`├─ ${错失 ? '攻防交换中短暂出现反打机会。' : '攻防交换中出现明确反击窗口。'}`, normalized)}</span>
                <span>${渲染判定侧写HTML(`└─ ${错失
                  ? `尝试以${包裹判定动作名称(显示动作)}反打，但${展示失败原因}。`
                  : (
                    伤害 > 0
                      ? `${normalized.行动者 || '反击方'}凭${包裹判定动作名称(显示动作)}抓住${目标 || '对手'}的破绽反击，造成了 ${伤害} 点伤害。`
                      : `${normalized.行动者 || '反击方'}凭${包裹判定动作名称(显示动作)}抓住${目标 || '对手'}的破绽反击，但未能造成实质伤害。`
                  )}`, normalized)}</span>
              </div>
              ${渲染战斗开发态明细(格式化预演审计明细(normalized))}
            </div>
          `;
        }

        function 渲染回合末聚合侧写卡片(条目 = {}) {
          const text = String(条目?.text || '').trim();
          if (!text) return '';
          const children = Array.isArray(条目?.children) ? 条目.children.map(item => String(item || '').trim()).filter(Boolean) : [];
          return `
            <details class="battle-preview-trace-row battle-preview-trace-card battle-preview-trace-card--settlement battle-preview-trace-subcard battle-preview-trace-card--aggregation" open>
              <summary class="battle-preview-trace-title">
                <b>${htmlEscapeText('[回合收束] 🩸 状态结算聚合')}</b>
              </summary>
              <div class="battle-preview-trace-tree">
                <span>${渲染判定侧写HTML(`├─ 🧾 摘要：${text}`)}</span>
                ${children.map((line, index) => `<span>${渲染判定侧写HTML(`${index === children.length - 1 ? '└─' : '├─'} ${line}`)}</span>`).join('\n')}
              </div>
            </details>
          `;
        }
        function 渲染结算链侧写卡片(条目 = {}) {
          const text = String(条目?.text || '').trim();
          if (!text) return '';
          const details = (Array.isArray(条目?.details) ? 条目.details : [])
            .map(line => String(line || '').trim())
            .filter(Boolean);
          const 标题 = String(条目?.kind || '') === 'status_tick' ? '[回合结算] 🩸 状态与环境影响' : '[结算链] 🧾 本回合结果';
          const detailHtml = details.length ? `
              <details class="battle-preview-trace-detail-fold">
                <summary>展开结算明细</summary>
                <div class="battle-preview-trace-tree battle-preview-trace-timeline battle-preview-trace-detail-tree">
                  ${details.map((line, index) => `<div class="battle-preview-trace-node battle-preview-trace-node--settlement battle-preview-trace-node--detail" data-trace-node-kind="settlement"><span>${渲染判定侧写HTML(`${index === details.length - 1 ? '└─' : '├─'} ${line}`)}</span></div>`).join('\n')}
                </div>
              </details>
          ` : '';
          return `
            <div class="battle-preview-trace-row battle-preview-trace-card battle-preview-trace-card--settlement ${String(条目?.kind || '') === 'status_tick' ? 'battle-preview-trace-subcard' : ''}">
              <div class="battle-preview-trace-title">
                <b>${htmlEscapeText(标题)}</b>
              </div>
              <div class="battle-preview-trace-tree">
                <span>${渲染判定侧写HTML(`└─ ${text}`)}</span>
              </div>
              ${detailHtml}
            </div>
          `;
        }

        function 格式化预演审计行(条目 = {}) {
          if (条目?.type === 'handoff') return 渲染流转侧写卡片(条目);
          if (条目?.type === 'resolution_action_block') return 渲染因果链行动区块(条目);
          if (条目?.type === 'settlement_aggregation') return 渲染回合末聚合侧写卡片(条目);
          if (条目?.type === 'settlement') return 渲染结算链侧写卡片(条目);
          const trace = 归一判定轨迹(条目?.trace || 条目 || {});
          if (读取轨迹类型(trace) === '防反机制') return 渲染防反侧写卡片(trace);
          return 渲染判定流程卡片(trace);
        }

        function 读取判定条目回合(条目 = {}, fallbackRound = 0) {
          if (条目?.type === 'settlement_aggregation' || 条目?.type === 'settlement' || 条目?.type === 'resolution_action_block') return Number(条目.round || 条目.回合 || fallbackRound || 0);
          const trace = 条目?.type === 'handoff' ? (条目.to || 条目.from || {}) : (条目.trace || 条目 || {});
          const round = Number(trace?.回合 || trace?.round || trace?.实际回合 || 0);
          return round > 0 ? round : Math.max(0, Number(fallbackRound || 0));
        }

        function 读取判定条目阶段排序值(条目 = {}) {
          const section = 读取判定条目分段键(条目);
          if (section === 'action_chain') return 5;
          if (section === 'decision') return 10;
          if (section === 'reaction') return 20;
          if (section === 'counter') return 30;
          if (section === 'action_result') return 40;
          if (section === 'turn_end') return 50;
          return 15;
        }

        function 读取判定条目分段键(条目 = {}) {
          if (条目?.type === 'resolution_action_block') return 'action_chain';
          if (条目?.type === 'settlement_aggregation') return 'turn_end';
          if (条目?.type === 'settlement') {
            return String(条目.roundPhase || '').trim() === 'turn_end' ? 'turn_end' : 'action_result';
          }
          const trace = 归一判定轨迹(条目?.type === 'handoff' ? (条目.to || 条目.from || {}) : (条目?.trace || 条目 || {}));
          return 读取判定流程分段键(trace);
        }

        function 渲染分回合判定流程(条目列表 = []) {
          const list = Array.isArray(条目列表) ? 条目列表 : [];
          if (!list.length) return '<div class="battle-preview-empty">无判定轨迹</div>';
          const 排序后列表 = list.slice().sort((左, 右) =>
            读取判定条目回合(左, 0) - 读取判定条目回合(右, 0) ||
            读取判定条目阶段排序值(左) - 读取判定条目阶段排序值(右),
          );
          const groups = [];
          let currentRound = 0;
          排序后列表.forEach(条目 => {
            const round = 读取判定条目回合(条目, currentRound);
            if (round > 0) currentRound = round;
            const key = round > 0 ? `round:${round}` : 'unassigned';
            let group = groups.find(item => item.key === key);
            if (!group) {
              group = { key, round, sections: new Map() };
              groups.push(group);
            }
            const sectionKey = 读取判定条目分段键(条目);
            const section = group.sections.get(sectionKey) || [];
            section.push(条目);
            group.sections.set(sectionKey, section);
          });
          const 顺序 = ['action_chain', 'decision', 'reaction', 'counter', 'action_result', 'turn_end'];
          const 分段标题 = {
            action_chain: '行动链',
            decision: '目标与行动',
            reaction: '应招与再判定',
            counter: '防反',
            action_result: '结算链',
            turn_end: '回合结算',
          };
          return groups.map(group => {
            const 有行动链主视图 = (group.sections.get('action_chain') || []).length > 0;
            const sectionHTML = 顺序.map(key => {
              if (有行动链主视图 && !['action_chain', 'turn_end'].includes(key)) return '';
              if (!有行动链主视图 && !['turn_end'].includes(key)) return '';
              const rows = group.sections.get(key) || [];
              if (!rows.length) return '';
              const cards = rows.map(格式化预演审计行).filter(html => String(html || '').trim());
              if (!cards.length) return '';
              return `
                <div class="battle-preview-trace-section">
                  <div class="battle-preview-trace-section-title">${htmlEscapeText(分段标题[key] || key)}</div>
                  ${cards.join('')}
                </div>
              `;
            }).filter(Boolean).join('');
            if (!sectionHTML) return '';
            return `
              <section class="battle-preview-trace-round">
                <div class="battle-preview-trace-round-title">${htmlEscapeText(group.round > 0 ? `第${group.round}回合` : '其他判定片段')}</div>
                ${sectionHTML}
              </section>
            `;
          }).filter(Boolean).join('');
        }

        function 构建战斗结果展示上下文(result = null) {
          const snapshot = result?.snapshot && typeof result.snapshot === 'object' ? result.snapshot : {};
          const teamPlayer = Array.isArray(snapshot.team_player) ? snapshot.team_player : [];
          const teamEnemy = Array.isArray(snapshot.team_enemy) ? snapshot.team_enemy : [];
          const sourceCombatData = result?.combatData && typeof result.combatData === 'object'
            ? result.combatData
            : result?.snapshot?.__父级战斗数据 && typeof result.snapshot.__父级战斗数据 === 'object'
              ? result.snapshot.__父级战斗数据
              : null;
          return {
            combatData: sourceCombatData || {
              参战者: {
                team_player: teamPlayer,
                team_enemy: teamEnemy,
              },
            },
            units: [...teamPlayer, ...teamEnemy],
          };
        }

        function 提取战斗结果战报Blocks(result = null) {
          const context = 构建战斗结果展示上下文(result);
          const ledger = result?.eventLedger || result?.combatData?.__battleEventLedger || [];
          const trace = Array.isArray(result?.resolutionTrace) ? result.resolutionTrace : (Array.isArray(result?.combatData?.__battleResolutionTrace) ? result.combatData.__battleResolutionTrace : []);
          const ledgerById = new Map((Array.isArray(ledger) ? ledger : []).map(event => [String(event?.eventId || '').trim(), event]).filter(([id]) => id));
          const traceById = new Map(trace.map(node => [String(node?.nodeId || '').trim(), node]).filter(([id]) => id));
          const 有防反来源 = (item = {}) => {
            const blocks = Array.isArray(item?.blocks) ? item.blocks : [];
            const eventIds = [];
            const nodeIds = [];
            blocks.forEach(block => {
              eventIds.push(String(block?.sourceEventId || '').trim());
              nodeIds.push(String(block?.sourceNodeId || '').trim());
              if (Array.isArray(block?.sourceEventIds)) block.sourceEventIds.forEach(id => eventIds.push(String(id || '').trim()));
              if (Array.isArray(block?.sourceNodeIds)) block.sourceNodeIds.forEach(id => nodeIds.push(String(id || '').trim()));
            });
            return eventIds.some(id => ['counter', 'counter_window'].includes(String(ledgerById.get(id)?.eventKind || '').trim())) ||
              nodeIds.some(id => ['counter_action', 'counter_window'].includes(String(traceById.get(id)?.nodeKind || '').trim()));
          };
          const sourceBlocks = Array.isArray(result?.publicReportBlocks) && result.publicReportBlocks.length
            ? result.publicReportBlocks
            : 构建事件账本公开战报Blocks(ledger, 10, context);
          return sourceBlocks
            .map(item => {
              const entry = 归一公开战报Block条目(item);
              if (!entry) return null;
              if (/反打/.test(entry.text) && !有防反来源(entry)) return null;
              return entry;
            })
            .filter(Boolean);
        }

        function 提取战斗结果战报行(result = null) {
          return 提取战斗结果战报Blocks(result).map(item => 序列化公开战报Blocks(item?.blocks)).filter(Boolean);
        }

        function 提取战斗结果结构化战报Blocks(result = null) {
          const source = Array.isArray(result?.reportBlocks) && result.reportBlocks.length
            ? result.reportBlocks
            : BATTLE_RUNTIME.buildReportBlocks(
                result?.eventLedger || result?.combatData?.__battleEventLedger || [],
                result?.decisionTrace || [],
                提取战斗结果战报Blocks(result),
              );
          return source
            .filter(block => block && typeof block === 'object')
            .filter(block => !['ROUND_SUMMARY', 'FINAL_SUMMARY'].includes(String(block?.blockType || '').trim()))
            .filter(block => Array.isArray(block?.facts) && block.facts.length > 0)
            .filter(block => String(block?.outcomeSummary || '').trim())
            .sort((left, right) => Number(left?.round || 0) - Number(right?.round || 0));
        }

        function 序列化结构化战报Block(block = {}) {
          const round = Math.max(0, Number(block?.round || 0));
          const lines = [
            String(block?.intentSummary || '').trim(),
            String(block?.outcomeSummary || '').trim(),
            String(block?.nextWindow || '').trim() ? `后续窗口：${String(block.nextWindow).trim()}` : '',
          ].filter(Boolean);
          return lines.length ? `${round > 0 ? `第${round}回合：` : ''}${lines.join('；')}` : '';
        }

        function 渲染结构化战报BlockHTML(block = {}, context = {}) {
          const facts = Array.isArray(block?.facts) ? block.facts : [];
          const primary = facts.find(fact => fact?.eventKind === 'action_start') || facts[0] || {};
          const actor = String(primary?.actorName || block?.actorId || '行动者').trim();
          const action = normalizeBattleActionDisplayName(primary?.actionName || '行动');
          const outcomeBlocks = [
            { type: 'text', content: String(block?.outcomeSummary || '').trim() },
            ...(Array.isArray(block?.badges) ? block.badges : []).map(badge => ({ type: 'badge', ...badge })),
          ];
          const outcomeHtml = 渲染公开战报BlocksHTML(outcomeBlocks, context).html;
          const intentHtml = 渲染公开战报HTML(String(block?.intentSummary || '').trim(), context).html;
          const nextWindowHtml = 渲染公开战报HTML(String(block?.nextWindow || '').trim(), context).html;
          const actionHeadHtml = 渲染公开战报HTML(`【${action}】`, context).html;
          const roundLabel = context?.showRound === false ? actor : `第${Math.max(0, Number(block?.round || 0))}回合 · ${actor}`;
          return `
            <article class="battle-preview-report-group" data-round="${Math.max(0, Number(block?.round || 0))}" data-action-group-id="${htmlEscapeText(block?.actionGroupId || '')}">
              <header class="battle-structured-report-head"><span>${roundLabel}</span><b>${actionHeadHtml}</b></header>
              ${String(block?.intentSummary || '').trim() ? `<p class="battle-structured-report-intent"><b>意图</b><span class="battle-structured-report-copy">${intentHtml}</span></p>` : ''}
              <p class="battle-structured-report-outcome"><b>结果</b><span class="battle-structured-report-copy">${outcomeHtml}</span></p>
              ${String(block?.nextWindow || '').trim() ? `<p class="battle-structured-report-window"><b>窗口</b><span class="battle-structured-report-copy">${nextWindowHtml}</span></p>` : ''}
            </article>
          `;
        }

        function 渲染结构化回合战报HTML(blocks = [], context = {}) {
          const grouped = new Map();
          (Array.isArray(blocks) ? blocks : []).forEach(block => {
            const round = Math.max(0, Number(block?.round || 0));
            if (!grouped.has(round)) grouped.set(round, []);
            grouped.get(round).push(block);
          });
          return [...grouped.entries()].sort((left, right) => left[0] - right[0]).map(([round, roundBlocks]) => {
            const activeBlocks = roundBlocks.filter(block => !['RESOURCE_CHANGE', 'STATE_TICK'].includes(String(block?.blockType || '').trim()));
            const passiveBlocks = roundBlocks.filter(block => ['RESOURCE_CHANGE', 'STATE_TICK'].includes(String(block?.blockType || '').trim()));
            const declarations = activeBlocks.map(block => {
              const facts = Array.isArray(block?.facts) ? block.facts : [];
              const primary = facts.find(fact => fact?.eventKind === 'action_start' && fact?.actionRole !== 'STATE_TICK') || facts[0] || {};
              const actor = String(primary?.actorName || block?.actorId || '行动者').trim();
              const action = normalizeBattleActionDisplayName(primary?.actionName || '行动');
              return block?.targetIds?.length
                ? `${actor}对${block.targetIds.join('、')}使用【${action}】`
                : `${actor}使用【${action}】展开行动`;
            });
            const exchangeText = declarations.length > 1
              ? `${declarations[0]}，${declarations.slice(1).map(text => `随后${text}`).join('；')}`
              : declarations[0] || '本回合没有主动交锋';
            const exchangeHtml = 渲染公开战报HTML(exchangeText, context).html;
            const passiveFacts = passiveBlocks.flatMap(block => Array.isArray(block?.facts) ? block.facts : []);
            const passiveBadges = passiveBlocks.flatMap(block => Array.isArray(block?.badges) ? block.badges : []);
            const passiveText = passiveBlocks.map(block => String(block?.outcomeSummary || '').trim()).filter(Boolean).join('；');
            const passiveHtml = passiveText
              ? 渲染公开战报BlocksHTML([
                  { type: 'text', content: passiveText },
                  ...passiveBadges.map(badge => ({ type: 'badge', ...badge })),
                ], context).html
              : '';
            return `
              <section class="battle-structured-report-round" data-round="${round}" data-active-action-count="${activeBlocks.length}" data-passive-fact-count="${passiveFacts.length}">
                <header class="battle-structured-report-round-head"><span>第${round}回合</span><b>${activeBlocks.length > 1 ? '双方交锋' : activeBlocks.length === 1 ? '单方行动' : '回合结算'}</b></header>
                <p class="battle-structured-report-exchange"><b>交锋</b><span class="battle-structured-report-copy">${exchangeHtml}</span></p>
                <div class="battle-structured-report-actions">${activeBlocks.map(block => 渲染结构化战报BlockHTML(block, { ...context, showRound: false })).join('')}</div>
                ${passiveHtml ? `<p class="battle-structured-report-passive"><b>回合结算</b><span class="battle-structured-report-copy">${passiveHtml}</span></p>` : ''}
              </section>
            `;
          }).join('');
        }



        function 序列化回合速览行(rows = []) {
          const result = [];
          const formatDelta = value => value < 0 ? `${value} HP` : value > 0 ? `+${value} HP` : '0';
          (Array.isArray(rows) ? rows : []).forEach(item => {
            const parts = [`我方${formatDelta(Number(item?.playerHpDelta || 0))}`, `敌方${formatDelta(Number(item?.enemyHpDelta || 0))}`];
            const resourceParts = (Array.isArray(item?.resourceDeltas) ? item.resourceDeltas : [])
              .map(entry => `${entry.actorName || '单位'}${entry.resourceName || '资源'}${Number(entry.value || 0) > 0 ? '+' : ''}${Math.round(Number(entry.value || 0))}`)
              .filter(Boolean);
            const highlights = (Array.isArray(item?.highlights) ? item.highlights : []).map(entry => typeof entry === 'string' ? entry : entry?.text).filter(Boolean);
            result.push(`第${Number(item?.round || 0)}回合速览：${parts.join('，')}${resourceParts.length ? `；资源：${resourceParts.join('，')}` : ''}${highlights.length ? `；高光：${highlights.join('；')}` : ''}`);
          });
          return result;
        }

        function 渲染回合速览HTML(rows = []) {
          const list = Array.isArray(rows) ? rows : [];
          if (!list.length) return '';
          const formatDelta = value => value < 0 ? `${value} HP` : value > 0 ? `+${value} HP` : '0';
          const renderHpDelta = (label, value, ratioValue = 0, sourceEventIds = []) => {
            const delta = Number(value || 0);
            const className = `battle-round-dashboard-delta${delta < 0 ? ' is-loss' : delta > 0 ? ' is-gain' : ''}`;
            const ratio = Math.max(0, Math.min(100, Math.round(Number(ratioValue || 0))));
            const sourceAttr = (Array.isArray(sourceEventIds) ? sourceEventIds : []).map(id => String(id || '').trim()).filter(Boolean).slice(0, 12).join(',');
            return `<span class="${className}" data-hp-delta="${htmlEscapeText(String(delta))}" data-delta-ratio="${ratio}"${sourceAttr ? ` data-source-event-ids="${htmlEscapeText(sourceAttr)}"` : ''}><span class="battle-round-dashboard-delta-fill" style="width:${ratio}%"></span><span class="battle-round-dashboard-delta-text">${htmlEscapeText(`${label} ${formatDelta(delta)}`)}</span></span>`;
          };
          return `<section class="battle-round-dashboard" aria-label="回合速览">${list.map(item => {
            const playerDelta = Number(item?.playerHpDelta || 0);
            const enemyDelta = Number(item?.enemyHpDelta || 0);
            const maxHpDelta = Math.max(1, Math.abs(playerDelta), Math.abs(enemyDelta));
            const playerRatio = Math.round(Math.abs(playerDelta) / maxHpDelta * 100);
            const enemyRatio = Math.round(Math.abs(enemyDelta) / maxHpDelta * 100);
            const highlights = (Array.isArray(item?.highlights) ? item.highlights : [])
              .map(entry => typeof entry === 'string' ? { text: entry } : entry)
              .filter(entry => String(entry?.text || '').trim());
            const resourceDeltas = (Array.isArray(item?.resourceDeltas) ? item.resourceDeltas : []).filter(entry => Math.round(Number(entry?.value || 0)) !== 0);
            const resourceHtml = resourceDeltas.length ? `<div class="battle-round-dashboard-resources">${resourceDeltas.map(entry => {
              const sourceAttr = (Array.isArray(entry?.sourceEventIds) ? entry.sourceEventIds : []).map(id => String(id || '').trim()).filter(Boolean).slice(0, 8).join(',');
              return `<span class="battle-round-dashboard-badge battle-round-dashboard-badge--resource" data-resource-name="${htmlEscapeText(entry.resourceName || '资源')}"${sourceAttr ? ` data-source-event-ids="${htmlEscapeText(sourceAttr)}"` : ''}>${htmlEscapeText(`${entry.actorName || '单位'} ${entry.resourceName || '资源'} ${Number(entry.value || 0) > 0 ? '+' : ''}${Math.round(Number(entry.value || 0))}`)}</span>`;
            }).join('')}</div>` : '';
            const statusLabel = (() => {
              const head = String(highlights[0]?.text || '').trim();
              if (/召出|召唤/.test(head)) return '召唤入场';
              if (/恢复|回稳|资源/.test(head)) return '资源回稳';
              if (/陷入|抵住|免疫/.test(head)) return '状态生效';
              if (/受阻|未能|截断/.test(head)) return '动作截断';
              if (/重创|伤害|防反/.test(head)) return '战果收束';
              return '回合结束';
            })();
            const highlightHtml = highlights.length ? `<div class="battle-round-dashboard-highlights">${highlights.map(entry => {
              const sourceEventId = String(entry?.sourceEventId || '').trim();
              const sourceNodeId = String(entry?.sourceNodeId || '').trim();
              const attrs = [
                sourceEventId ? `data-source-event-id="${htmlEscapeText(sourceEventId)}"` : '',
                sourceNodeId ? `data-source-node-id="${htmlEscapeText(sourceNodeId)}"` : '',
              ].filter(Boolean).join(' ');
              const stateFact = /陷入【|免疫【|抵住【/.test(String(entry.text || ''));
              return `<span class="battle-round-dashboard-badge${stateFact ? ' battle-round-dashboard-badge--state' : ' battle-round-dashboard-badge--event'}"${attrs ? ` ${attrs}` : ''}>${htmlEscapeText(entry.text)}</span>`;
            }).join('')}</div>` : '';
            return `<div class="battle-round-dashboard-row"><div class="battle-round-dashboard-head"><span>第${Number(item?.round || 0)}回合</span><b>${htmlEscapeText(statusLabel)}</b></div><div class="battle-round-dashboard-bars">${renderHpDelta('我方', playerDelta, playerRatio, item?.playerHpSourceEventIds)}${renderHpDelta('敌方', enemyDelta, enemyRatio, item?.enemyHpSourceEventIds)}</div>${resourceHtml}${highlightHtml}</div>`;
          }).join('')}</section>`;
        }

        function 渲染战斗总结HTML(report = null) {
          if (!report || typeof report !== 'object') return '';
          const renderUnits = (label, units = []) => `<section class="battle-final-summary-side"><h4>${htmlEscapeText(label)}</h4>${(Array.isArray(units) ? units : []).length
            ? units.map(unit => {
                const states = (Array.isArray(unit?.states) ? unit.states : []).map(state => `${state?.name || '状态'}(${Math.max(0, Number(state?.duration || 0))})`).filter(Boolean);
                const resources = unit?.resources || {};
                return `<div class="battle-final-summary-unit"><b>${htmlEscapeText(unit?.name || '单位')}</b><span>HP ${Math.max(0, Number(unit?.hp || 0))}/${Math.max(1, Number(unit?.hpMax || 1))}</span><span>魂力 ${Math.max(0, Number(unit?.sp ?? resources.soul ?? 0))}/${Math.max(1, Number(unit?.spMax ?? resources.soulMax ?? 1))}</span><span>体力 ${Math.max(0, Number(unit?.vit ?? resources.stamina ?? 0))}/${Math.max(1, Number(unit?.vitMax ?? resources.staminaMax ?? 1))}</span><span>精神力 ${Math.max(0, Number(unit?.men ?? resources.spirit ?? 0))}/${Math.max(1, Number(unit?.menMax ?? resources.spiritMax ?? 1))}</span>${states.length ? `<em>${htmlEscapeText(states.join('、'))}</em>` : ''}</div>`;
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

        function 渲染ReportDto数字(token = {}) {
          if (!Number.isFinite(Number(token?.value))) return '';
          const sourceEventId = String(token?.sourceEventId || '').trim();
          const sourceFactId = String(token?.sourceFactId || '').trim();
          const attrs = [
            sourceEventId ? `data-source-event-id="${htmlEscapeText(sourceEventId)}"` : '',
            sourceFactId ? `data-source-fact-id="${htmlEscapeText(sourceFactId)}"` : '',
            token?.sourceName ? `data-source-name="${htmlEscapeText(token.sourceName)}"` : '',
            token?.sourceType ? `data-source-type="${htmlEscapeText(token.sourceType)}"` : '',
            token?.operation ? `data-source-operation="${htmlEscapeText(token.operation)}"` : '',
            token?.comparisonId ? `data-comparison-id="${htmlEscapeText(token.comparisonId)}"` : '',
            token?.sourceDetail ? `data-source-detail="${htmlEscapeText(token.sourceDetail)}"` : '',
          ].filter(Boolean).join(' ');
          return `<button class="battle-preview-report-badge battle-preview-report-badge--resource" type="button"${attrs ? ` ${attrs}` : ''} aria-haspopup="true">${htmlEscapeText(`${token.label} ${Number(token.value).toFixed(Math.abs(Number(token.value)) < 10 ? 2 : 0)}${token.unit || ''}`)}</button>`;
        }

        function 显示ReportDto数字来源(button) {
          const tooltip = 读取技能悬浮节点();
          if (!tooltip || !button) return;
          const sourceName = String(button.getAttribute('data-source-name') || '战斗事实').trim();
          const sourceType = String(button.getAttribute('data-source-type') || '事实').trim();
          const operation = String(button.getAttribute('data-source-operation') || '读取').trim();
          const eventId = String(button.getAttribute('data-source-event-id') || '').trim();
          const factId = String(button.getAttribute('data-source-fact-id') || '').trim();
          const comparisonId = String(button.getAttribute('data-comparison-id') || '').trim();
          const sourceDetail = String(button.getAttribute('data-source-detail') || '').trim();
          tooltip.setAttribute('role', 'tooltip');
          tooltip.innerHTML = `
            <div class="battle-ring-tooltip-title"><strong>数字来源</strong><span>${htmlEscapeText(sourceName)}</span></div>
            <div class="battle-ring-tooltip-meta">
              <span class="battle-ring-tooltip-meta-row"><em>来源类型</em><strong>${htmlEscapeText(sourceType)}</strong></span>
              <span class="battle-ring-tooltip-meta-row"><em>计算操作</em><strong>${htmlEscapeText(operation)}</strong></span>
              <span class="battle-ring-tooltip-meta-row"><em>事件</em><strong>${htmlEscapeText(eventId || '未登记')}</strong></span>
              <span class="battle-ring-tooltip-meta-row"><em>事实</em><strong>${htmlEscapeText(factId || '未登记')}</strong></span>
              ${comparisonId || sourceDetail
                ? `<span class="battle-ring-tooltip-meta-row"><em>比较依据</em><strong>${htmlEscapeText(comparisonId || '候选比较')}</strong></span>
                   <span class="battle-ring-tooltip-meta-row battle-ring-tooltip-meta-row--detail"><em>比较明细</em><strong>${htmlEscapeText(sourceDetail || '未登记')}</strong></span>`
                : ''}
            </div>
          `;
          button.setAttribute('aria-describedby', tooltip.id || 'ui-skill-tooltip');
          定位技能悬浮(button);
        }

        function 绑定ReportDto数字来源(node) {
          node?.querySelectorAll?.('[data-source-event-id][data-source-fact-id]').forEach(button => {
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
                const 原因 = candidate?.reasonText
                  ? `<span class="battle-chain-candidate-reason">${htmlEscapeText(candidate.reasonText)}</span>`
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
            .filter(charge => charge?.imminent && String(charge?.actorId || '') !== String(node?.actorId || ''))
            .map(charge => `<li>${htmlEscapeText(charge.actorName)}蓄力中【${htmlEscapeText(charge.actionName)}】，下个行动窗口即可打出</li>`)
            .join('');

          /* 玩家版排除原因用带"为什么"的措辞。
             只列两条，但**必须告知截断**——否则排除了 8 个和排除了 2 个在界面上没有区别，
             可疑的排除会被静默藏在截断线以下。 */
          const 全部排除 = (Array.isArray(node?.decision?.candidates) ? node.decision.candidates : [])
            .filter(candidate => candidate?.status === 'EXCLUDED' && (candidate?.reasonPlayerText || candidate?.reasonText));
          const 排除 = [
            ...全部排除.slice(0, 2).map(candidate =>
              `<li>没选${htmlEscapeText(candidate.name)}：${htmlEscapeText(candidate.reasonPlayerText || candidate.reasonText)}</li>`),
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
          const 数字 = (Array.isArray(node?.factIds) ? node.factIds : [])
            .flatMap(factId => {
              const fact = factsById.get(String(factId || ''));
              return Array.isArray(fact?.numericTokens) ? fact.numericTokens : [];
            })
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

        function 渲染ReportDto记录视图(reportDto = {}, activeView = 'chain') {
          if (activeView === 'summary') {
            return 渲染战斗总结HTML(reportDto?.finalSummary) || '<div class="battle-preview-empty">暂无总结</div>';
          }
          const chain = Array.isArray(reportDto?.narrativeChain) ? reportDto.narrativeChain : [];
          if (!chain.length) return '<div class="battle-preview-empty">暂无战报</div>';
          const factsById = new Map(
            (Array.isArray(reportDto?.factRegistry) ? reportDto.factRegistry : [])
              .map(fact => [String(fact?.factId || ''), fact]),
          );
          /* 单一因果链时间线：按回合分段，每次行动一张卡，卡内顺序即因果顺序。 */
          const 分段 = [];
          let 当前回合 = null;
          chain.forEach(node => {
            const 回合 = Math.max(0, Number(node?.round || 0));
            if (回合 !== 当前回合) {
              当前回合 = 回合;
              分段.push(`<h3 class="battle-chain-round">第${回合}回合</h3>`);
            }
            分段.push(渲染因果链节点(node, factsById));
          });
          return `<div class="battle-preview-report battle-chain">${分段.join('')}</div>`;
        }

        function 解码战斗预演HTML实体(text = '') {
          return String(text || '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&');
        }

        function 提取战斗预演HTML可见文本(html = '') {
          const raw = String(html || '')
            .replace(/<details class="battle-preview-debug">[\s\S]*?<\/details>/gi, '')
            .replace(/<details class="battle-preview-trace-fold(?:\s+[^"]*)?">[\s\S]*?<\/details>/gi, '');
          if (!raw.trim()) return [];
          const withBreaks = raw
            .replace(/<div class="battle-preview-trace-round-title">/gi, '\n<div class="battle-preview-trace-round-title">')
            .replace(/<div class="battle-preview-trace-section-title">/gi, '\n<div class="battle-preview-trace-section-title">')
            .replace(/<div class="battle-preview-trace-title">/gi, '\n<div class="battle-preview-trace-title">')
            .replace(/<div class="battle-preview-trace-candidate-head">/gi, '\n<div class="battle-preview-trace-candidate-head">')
            .replace(/<div class="battle-preview-trace-candidate-line">/gi, '\n<div class="battle-preview-trace-candidate-line">')
            .replace(/<div class="battle-preview-trace-candidate-bar">/gi, '\n<div class="battle-preview-trace-candidate-bar">')
            .replace(/<\/(summary|p|div|section|details|pre|code|em|b)>/gi, '\n')
            .replace(/<(summary|p|div|section|details|pre|code|em|b)(?:\s[^>]*)?>/gi, '\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, '');
          const rows = 解码战斗预演HTML实体(withBreaks)
            .split(/\r?\n+/)
            .map(line => /^[\s│]*[├└]─/.test(String(line || '')) ? String(line || '').replace(/[ \t]+$/g, '') : String(line || '').replace(/\s+/g, ' ').trim())
            .filter(Boolean);
          const sectionTitles = new Set(['行动链', '目标与行动', '应招与再判定', '防反', '结算链', '回合结算', '中间推演', '目标遍历详情']);
          const roundTitlePattern = /^第\d+回合$|^其他判定片段$/;
          const visibleRows = rows.filter((line, index) => {
            if (!sectionTitles.has(line)) return true;
            const next = rows[index + 1] || '';
            return Boolean(next) && !sectionTitles.has(next) && !roundTitlePattern.test(next);
          });
          const seenStateSettlement = new Set();
          let currentRound = '';
          return visibleRows.filter(line => {
            const roundMatch = String(line || '').match(/^第(\d+)回合$/);
            if (roundMatch) currentRound = roundMatch[1];
            const stateMatch = String(line || '').match(/状态结算：([^【\n]+?)(?:陷入|免疫|抵住)【([^】]+)】/);
            if (!stateMatch) return true;
            const key = `${currentRound || '0'}::${String(stateMatch[1] || '').trim()}::${String(stateMatch[2] || '').trim()}`;
            if (seenStateSettlement.has(key)) return false;
            seenStateSettlement.add(key);
            return true;
          });
        }

        function 过滤已在摘要出现的结算条目(条目列表 = [], 战报行 = []) {
          const rows = Array.isArray(条目列表) ? 条目列表 : [];
          const summaryLines = (Array.isArray(战报行) ? 战报行 : [])
            .map(line => String(line || '').trim())
            .filter(Boolean);
          const summaries = new Set(summaryLines);
          return rows.filter(item => {
            if (!item || item.type !== 'settlement') return true;
            const round = Number(item.round || item.回合 || 0);
            const text = String(item.text || '').trim();
            if (!text) return false;
            if (item.fromEventLedger === true) return true;
            if (String(item.kind || '') !== 'status_tick' && round > 0) {
              const roundPrefix = `第${round}回合：`;
              if (summaryLines.some(line => line.startsWith(roundPrefix))) return false;
            }
            const prefixed = round > 0 ? `第${round}回合：${text}` : text;
            return !summaries.has(prefixed) && !summaries.has(text);
          });
        }

        function 读取判定动作筛选项(审计条目 = []) {
          return (Array.isArray(审计条目) ? 审计条目 : [])
            .filter(item => item?.type === 'resolution_action_block')
            .map(item => {
              const root = item.root || {};
              const round = Math.max(0, Number(item.round || item.回合 || root.round || 0));
              const actionId = String(root.actionId || root.sourceActionId || root.nodeId || '').trim();
              const actionName = normalizeBattleActionDisplayName(root.finalActionName || root.actionName || root.initialActionName || '');
              const actorName = String(root.actorName || '').trim();
              return round > 0 && actionId && actionName ? { round, actionId, actionName, actorName } : null;
            })
            .filter(Boolean);
        }

        function 筛选判定流程条目(审计条目 = [], round = 0, actionId = '') {
          const activeRound = Math.max(0, Number(round || 0));
          const activeActionId = String(actionId || '').trim();
          const selectedAction = 读取判定动作筛选项(审计条目).find(item => item.actionId === activeActionId) || null;
          return (Array.isArray(审计条目) ? 审计条目 : []).filter(item => {
            const itemRound = 读取判定条目回合(item, 0);
            if (activeRound > 0 && itemRound !== activeRound) return false;
            if (!selectedAction) return true;
            if (item?.type === 'resolution_action_block') {
              const root = item.root || {};
              return String(root.actionId || root.sourceActionId || root.nodeId || '').trim() === selectedAction.actionId;
            }
            return itemRound === selectedAction.round;
          });
        }

        function 导出战斗记录可见文本(result = null, activeTab = 'preview') {
          if (!result) return '';
          const logs = Array.isArray(result.logs) ? result.logs : [];
          const context = 构建战斗结果展示上下文(result);
          context.eventLedger = result?.eventLedger || result?.combatData?.__battleEventLedger || [];
          const 战报Blocks = 提取战斗结果结构化战报Blocks(result);
          const 原始战报 = 战报Blocks.map(序列化结构化战报Block).filter(Boolean);
          context.publicBattleLines = 原始战报;
          const 审计条目 = 过滤已在摘要出现的结算条目([
            ...构建因果链行动区块条目(Array.isArray(result.resolutionTrace) ? result.resolutionTrace : [], Array.isArray(result.decisionTrace) ? result.decisionTrace : []),
            ...构建判定流程展示数据(Array.isArray(result.decisionTrace) ? result.decisionTrace : [], logs, context),
            ...构建结算链侧写条目(logs, { ...context, eventLedger: result?.eventLedger || [] }),
          ], 原始战报);
          const 战报 = 战报Blocks.map(序列化结构化战报Block).filter(Boolean);
          const 流程HTML = 渲染分回合判定流程(审计条目);
          const 回合速览 = BATTLE_RUNTIME.buildRoundOverview(result, context);
          const finalSnapshot = result?.snapshot || BATTLE_RUNTIME.getBattleSnapshot(result?.combatData || context?.combatData || {});
          const finalBattleReport = result?.finalBattleReport || BATTLE_RUNTIME.buildFinalSummary(
            result?.eventLedger || result?.combatData?.__battleEventLedger || [],
            result?.decisionTrace || [],
            finalSnapshot,
            result?.combatData || context?.combatData || null,
          ).finalBattleReport;
          const 头部行 = [
            activeTab === 'preview' ? '预演结果' : '实战结果',
            格式化战斗模式显示文本(result.modeLabel, result.battleMode, result.mode),
            `推进${Math.max(0, Number(result.roundsExecuted || 0))}回合`,
          ].filter(Boolean);
          const 判定流程行 = ['判定流程', ...提取战斗预演HTML可见文本(流程HTML)];
          const 总结行 = String(finalBattleReport?.text || '').trim() ? ['总结', String(finalBattleReport.text).trim()] : [];
          return [...头部行, ...序列化回合速览行(回合速览), ...战报, ...判定流程行, ...总结行].join('\n').trim();
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
          if (result?.reportDto && typeof result.reportDto === 'object') {
            const activeView = 读取战斗记录视图();
            const 视图标签 = { chain: '战报', summary: '总结' };
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
            绑定ReportDto数字来源(node);
            return;
          }
          const logs = Array.isArray(result.logs) ? result.logs : [];
          const context = 构建战斗结果展示上下文(result);
          context.eventLedger = result?.eventLedger || result?.combatData?.__battleEventLedger || [];
          const 战报Blocks = 提取战斗结果结构化战报Blocks(result);
          const 原始战报 = 战报Blocks.map(序列化结构化战报Block).filter(Boolean);
          context.publicBattleLines = 原始战报;
          const 审计条目 = 过滤已在摘要出现的结算条目([
            ...构建因果链行动区块条目(Array.isArray(result.resolutionTrace) ? result.resolutionTrace : [], Array.isArray(result.decisionTrace) ? result.decisionTrace : []),
            ...构建判定流程展示数据(Array.isArray(result.decisionTrace) ? result.decisionTrace : [], logs, context),
            ...构建结算链侧写条目(logs, { ...context, eventLedger: result?.eventLedger || [] }),
          ], 原始战报);
          const 回合速览 = BATTLE_RUNTIME.buildRoundOverview(result, context);
          const 战报展示上下文 = { ...context, combatData: context?.combatData || result?.combatData || {} };
          const 战报单位上下文 = 读取战报上下文单位(战报展示上下文);
          战报展示上下文.units = [
            ...战报单位上下文.playerUnits,
            ...战报单位上下文.enemyUnits,
            ...(Array.isArray(context?.units) ? context.units : []),
          ];
          const finalSnapshot = result?.snapshot || BATTLE_RUNTIME.getBattleSnapshot(result?.combatData || context?.combatData || {});
          const finalBattleReport = result?.finalBattleReport || BATTLE_RUNTIME.buildFinalSummary(
            result?.eventLedger || result?.combatData?.__battleEventLedger || [],
            result?.decisionTrace || [],
            finalSnapshot,
            result?.combatData || context?.combatData || null,
          ).finalBattleReport;
          const activeView = 读取战斗记录视图();
          const 视图标签 = { chain: '战报', summary: '总结' };
          let 视图内容 = '';
          if (activeView === 'round') {
            视图内容 = 渲染回合速览HTML(回合速览) || '<div class="battle-preview-empty">暂无回合结算</div>';
          } else if (activeView === 'report') {
            视图内容 = `<div class="battle-preview-report">${战报Blocks.length
              ? 渲染结构化回合战报HTML(战报Blocks, 战报展示上下文)
              : '<p>暂无战报</p>'}</div>`;
          } else if (activeView === 'summary') {
            视图内容 = 渲染战斗总结HTML(finalBattleReport) || '<div class="battle-preview-empty">暂无总结</div>';
          } else {
            const 动作筛选项 = 读取判定动作筛选项(审计条目);
            const 回合列表 = Array.from(new Set(动作筛选项.map(item => item.round))).sort((a, b) => a - b);
            let activeRound = Math.max(0, Number(state.activeBattleDecisionRound || 0));
            if (!回合列表.includes(activeRound)) activeRound = 回合列表[0] || 0;
            let 当回合动作 = 动作筛选项.filter(item => item.round === activeRound);
            let activeActionId = String(state.activeBattleDecisionActionId || '').trim();
            if (!当回合动作.some(item => item.actionId === activeActionId)) activeActionId = String(当回合动作[0]?.actionId || '').trim();
            state.activeBattleDecisionRound = activeRound;
            state.activeBattleDecisionActionId = activeActionId;
            const 筛选后条目 = 筛选判定流程条目(审计条目, activeRound, activeActionId);
            视图内容 = `
              <div class="battle-decision-filter" aria-label="判定筛选">
                <label><span>回合</span><select data-battle-decision-round>${回合列表.map(round => `<option value="${round}"${round === activeRound ? ' selected' : ''}>第${round}回合</option>`).join('')}</select></label>
                <label><span>动作</span><select data-battle-decision-action>${当回合动作.map(item => `<option value="${htmlEscapeText(item.actionId)}"${item.actionId === activeActionId ? ' selected' : ''}>${htmlEscapeText(`${item.actorName} · ${item.actionName}`)}</option>`).join('')}</select></label>
              </div>
              <div class="battle-preview-trace">${渲染分回合判定流程(筛选后条目)}</div>
            `;
          }
          node.hidden = false;
          node.innerHTML = `
            <div class="battle-preview-head">
              <span>${activeTab === 'preview' ? '预演结果' : '实战结果'}</span>
              <b>${htmlEscapeText(格式化战斗模式显示文本(result.modeLabel, result.battleMode, result.mode))}</b>
              <em>${htmlEscapeText(`推进${Math.max(0, Number(result.roundsExecuted || 0))}回合`)}</em>
            </div>
            <div class="battle-record-view-tabs" role="tablist" aria-label="记录视图">
              ${Object.entries(视图标签).map(([view, label]) => `<button class="battle-record-view-tab${view === activeView ? ' active' : ''}" type="button" role="tab" data-battle-record-view="${view}" aria-selected="${view === activeView ? 'true' : 'false'}" tabindex="${view === activeView ? '0' : '-1'}">${label}</button>`).join('')}
            </div>
            <section class="battle-record-view" role="tabpanel" aria-label="${htmlEscapeText(视图标签[activeView])}">${视图内容}</section>
          `;
          绑定分段控件键盘导航(node.querySelector('.battle-record-view-tabs'), 'data-battle-record-view', activeView, 设置战斗记录视图);
          const roundSelect = node.querySelector('[data-battle-decision-round]');
          if (roundSelect) roundSelect.addEventListener('change', () => {
            state.activeBattleDecisionRound = Math.max(0, Number(roundSelect.value || 0));
            state.activeBattleDecisionActionId = '';
            渲染战斗记录面板();
          });
          const actionSelect = node.querySelector('[data-battle-decision-action]');
          if (actionSelect) actionSelect.addEventListener('change', () => {
            state.activeBattleDecisionActionId = String(actionSelect.value || '').trim();
            渲染战斗记录面板();
          });
          node.querySelectorAll('[data-battle-report-skill]').forEach(button => {
            const skillName = String(button.getAttribute('data-skill-name') || '').trim();
            const actorName = String(button.getAttribute('data-actor-name') || '').trim();
            const skillSlot = String(button.getAttribute('data-skill-slot') || '').trim();
            const sourceContext = { ...context, combatData: context?.combatData || result?.combatData || {} };
            const actorUnit = actorName ? 查找战报上下文单位(sourceContext, actorName) : null;
            const resolvedSkill = actorUnit ? (按名称解析角色战斗魂技_战报(actorUnit, skillSlot || skillName) || 按名称解析角色战斗魂技_战报(actorUnit, skillName)) : null;
            const basicActionTypes = {
              普通攻击: '普通攻击',
              防御: '防御',
              闪避: '闪避',
              反击: '普通攻击',
              护卫: '防御',
              撤退: '撤离',
              观察: '观察',
            };
            if (!resolvedSkill && !basicActionTypes[skillName]) return;
            const action = resolvedSkill ? {
              id: `report_hover_${String(actorName || 'unknown').replace(/[^\w\u4e00-\u9fa5-]+/g, '_')}_${String(skillName || '').replace(/[^\w\u4e00-\u9fa5-]+/g, '_')}`,
              type: 'skill',
              action_type: '释放魂技',
              name: normalizeBattleActionDisplayName(resolvedSkill?.name || resolvedSkill?.魂技名 || skillName),
              category: '魂技',
              source_detail: String(resolvedSkill?.__战斗来源明细 || resolvedSkill?.__战斗来源类别 || '魂技').trim() || '魂技',
              cast_time: findUiSkillCastTime(resolvedSkill),
              cost_text: findUiSkillCost(resolvedSkill),
              raw_skill: resolvedSkill,
              skill: resolvedSkill,
            } : {
              id: `report_hover_${String(actorName || 'unknown').replace(/[^\w\u4e00-\u9fa5-]+/g, '_')}_${String(skillName || '').replace(/[^\w\u4e00-\u9fa5-]+/g, '_')}`,
              type: 'action',
              action_type: basicActionTypes[skillName],
              name: skillName,
              category: '战术',
              source_detail: '基础行动',
              cast_time: 0,
              cost_text: '无',
              reason: skillName === '普通攻击' || skillName === '反击' ? '以当前攻击属性进行一次基础进攻' : `${skillName}行动`,
            };
            button.addEventListener('mouseenter', () => 显示技能悬浮(button, action));
            button.addEventListener('focus', () => 显示技能悬浮(button, action));
            button.addEventListener('mouseleave', () => {
              const 悬浮节点 = 读取技能悬浮节点();
              if (!悬浮节点) return;
              if (!悬浮节点.matches(':hover')) 关闭技能悬浮();
            });
            button.addEventListener('blur', 关闭技能悬浮);
          });
        }

        function 渲染战斗预演面板(result = null) {
          if (result && window.BattleUI?.state) window.BattleUI.state.previewResult = result;
          if (window.BattleUI?.state) window.BattleUI.state.activeBattleRecordTab = 'preview';
          设置战斗记录展开状态(true);
          渲染战斗记录面板();
        }

        function renderReport(reportDto = {}, options = {}) {
          if (!reportDto || typeof reportDto !== 'object') throw new TypeError('battle_report_dto_invalid');
          const preview = options.preview === true;
          const result = {
            preview,
            committed: !preview,
            mode: preview ? 'preview' : 'sealed_transaction',
            battleMode: options.battleMode || 'single_round',
            roundsExecuted: Math.max(0, Number(reportDto.actualRoundCount || 0)),
            reportDto,
            finalBattleReport: reportDto.finalSummary || null,
            aiSummaryInput: reportDto.aiSummaryInput || null,
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

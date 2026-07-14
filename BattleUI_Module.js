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
      const normalized = createEmptyCombatEffectMap();
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
      const actions = fallbackCollectActions(unit);
      const matched = actions.find(action => {
        const names = [
          action?.name,
          action?.skill?.name,
          action?.skill?.魂技名,
          action?.raw_skill?.name,
          action?.raw_skill?.魂技名,
          action?.skill?.__魂技槽位,
          action?.raw_skill?.__魂技槽位,
        ].map(item => normalizeBattleActionDisplayName(item || '')).filter(Boolean);
        return names.some(item => item === query || isSameBattleReportName(item, query));
      });
      return matched?.raw_skill || matched?.skill || null;
    }

    function 读取战报伤害烈度文本(hit = {}, totalDamage = 0, context = {}) {
      const targetName = String(hit?.target || '').trim();
      const target = 查找战报上下文单位(context, targetName);
      if (!target) return '';
      const maxHp = Math.max(1, Number(getCombatHpMaxValue(target) || 0));
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
      补水战斗运行态(combatData, resolvedEventLedger, { source: 'battle_preview' });
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

    function 读取当前世界tick_V1() {
      return Math.max(0, Number(window.BattleUIBridge?.getMVU('world.时间.tick') || 0));
    }

    function 读取魂环路径恢复标记_V1(charData, 魂环路径 = []) {
      if (!charData || typeof charData !== 'object') return { 恢复中: false, 剩余tick: 0, 恢复tick: 0 };
      if (!Array.isArray(魂环路径) || !魂环路径.length) return { 恢复中: false, 剩余tick: 0, 恢复tick: 0 };
      const 魂环数据 = 按路径读取对象_V1(charData, 魂环路径);
      const 恢复tick = Math.max(0, Number(魂环数据?.炸环恢复tick || 0));
      if (!(恢复tick > 0)) return { 恢复中: false, 剩余tick: 0, 恢复tick: 0 };
      const 当前tick = 读取当前世界tick_V1();
      if (恢复tick <= 当前tick) return { 恢复中: false, 剩余tick: 0, 恢复tick };
      return { 恢复中: true, 剩余tick: 恢复tick - 当前tick, 恢复tick };
    }

    function 读取技能魂环恢复标记_V1(skill, charData) {
      if (!skill || !charData || typeof charData !== 'object') return { 恢复中: false, 剩余tick: 0, 恢复tick: 0 };
      const 魂环路径 = Array.isArray(skill.__魂环路径) ? skill.__魂环路径 : [];
      if (!魂环路径.length) return { 恢复中: false, 剩余tick: 0, 恢复tick: 0 };
      return 读取魂环路径恢复标记_V1(charData, 魂环路径);
    }

    function 判定魂环档位类型_V1(年限 = 0) {
      const 数值 = Math.max(0, Number(年限 || 0));
      if (数值 >= 100000) return '红';
      if (数值 >= 10000) return '黑';
      if (数值 >= 1000) return '紫';
      if (数值 >= 100) return '黄';
      return '白';
    }

    function 获取炸环百级校准倍率_V1(属性键 = 'str') {
      const 取基础属性 = typeof root.__LWCS_GET_BASE_STATS__ === 'function' ? root.__LWCS_GET_BASE_STATS__ : null;
      const 九十七级 = 取基础属性 ? 取基础属性(97) : null;
      const 百级 = 取基础属性 ? 取基础属性(100) : null;
      const 基准 = Number(九十七级?.[属性键] || 0);
      const 目标 = Number(百级?.[属性键] || 0);
      if (基准 > 0 && 目标 > 基准) return 目标 / 基准;
      return {
        str: 5.511348148148148,
        def: 5.511348148148148,
        agi: 5.511348148148148,
        vit_max: 5.511348148148148,
        men_max: 4.166666666666667,
        sp_max: 16,
      }[属性键] || 5.511348148148148;
    }

    function 计算炸环属性倍率_V1(属性键 = 'str', 总年限 = 0, 强化倍率 = 1) {
      const 年限比例 = Math.max(0, Number(总年限 || 0)) / 400000;
      const 基础倍率 = Math.max(0.01, Number(强化倍率 || 1));
      const 百级倍率 = 获取炸环百级校准倍率_V1(属性键);
      return Math.max(1.005, Number((1 + 基础倍率 * 年限比例 * (百级倍率 - 1)).toFixed(4)));
    }

    function 估算炸环属性等效等级_V1(属性键 = 'str', 属性值 = 0) {
      const 取基础属性 = typeof root.__LWCS_GET_BASE_STATS__ === 'function' ? root.__LWCS_GET_BASE_STATS__ : null;
      const 数值 = Number(属性值 || 0);
      if (!取基础属性 || !(数值 > 0)) return '';
      let 最接近等级 = 1;
      let 最小差值 = Infinity;
      for (let 等级 = 1; 等级 <= 100; 等级 += 0.5) {
        const 基准 = Number(取基础属性(等级)?.[属性键] || 0);
        const 差值 = Math.abs(基准 - 数值);
        if (差值 < 最小差值) {
          最小差值 = 差值;
          最接近等级 = 等级;
        }
      }
      return Number.isInteger(最接近等级) ? String(最接近等级) : 最接近等级.toFixed(1);
    }

    function 构建炸环自身属性增幅_V1(总年限 = 0, 强化倍率 = 1) {
      return {
        str: 计算炸环属性倍率_V1('str', 总年限, 强化倍率),
        def: 计算炸环属性倍率_V1('def', 总年限, 强化倍率),
        agi: 计算炸环属性倍率_V1('agi', 总年限, 强化倍率),
        sp_max: 计算炸环属性倍率_V1('sp_max', 总年限, 强化倍率),
        men_max: 计算炸环属性倍率_V1('men_max', 总年限, 强化倍率),
        vit_max: 计算炸环属性倍率_V1('vit_max', 总年限, 强化倍率),
      };
    }

    function 构建炸环十万年基准类比文本_V1(强化倍率 = 1) {
      const 基准 = typeof root.__LWCS_GET_BASE_STATS__ === 'function' ? root.__LWCS_GET_BASE_STATS__(97) : null;
      if (!基准) return '';
      const 面板倍率 = 构建炸环自身属性增幅_V1(100000, 强化倍率);
      const 项目 = [
        ['力', 'str'],
        ['防', 'def'],
        ['速', 'agi'],
        ['魂', 'sp_max'],
        ['精', 'men_max'],
        ['体', 'vit_max'],
      ];
      return 项目
        .map(([标签, 属性]) => {
          const 等效等级 = 估算炸环属性等效等级_V1(属性, Number(基准[属性] || 0) * Number(面板倍率[属性] || 1));
          return 等效等级 ? `${标签}≈${等效等级}级` : '';
        })
        .filter(Boolean)
        .join('、');
    }

    function 计算炸环恢复时长tick_V1(已炸魂环列表 = []) {
      const 最高年限 = 已炸魂环列表.reduce((最大值, 项) => Math.max(最大值, Number(项?.年限 || 0)), 0);
      const 年限系数 = Math.max(0.5, Math.min(3, Math.log10(Math.max(100, 最高年限)) - 1));
      return Math.max(1440, Math.round(4320 * 年限系数));
    }

    function 路径相同_V1(路径甲 = [], 路径乙 = []) {
      if (!Array.isArray(路径甲) || !Array.isArray(路径乙)) return false;
      if (路径甲.length !== 路径乙.length) return false;
      for (let 索引 = 0; 索引 < 路径甲.length; 索引 += 1) {
        if (String(路径甲[索引]) !== String(路径乙[索引])) return false;
      }
      return true;
    }

    function 收集角色可炸魂环列表_V1(角色数据 = {}) {
      if (!角色数据 || typeof 角色数据 !== 'object') return [];
      const 结果 = [];
      取角色武魂条目_战斗(角色数据).forEach(([武魂键, 武魂数据]) => {
        取武魂魂灵条目_战斗(武魂数据).forEach(([魂灵键, 魂灵数据]) => {
          取魂灵魂环条目_战斗(魂灵数据).forEach(([魂环键, 魂环数据]) => {
            if (!魂环数据 || typeof 魂环数据 !== 'object') return;
            const 年限 = Math.max(100, Number(魂环数据?.年限 || 100));
            结果.push({
              路径: [武魂键, 魂灵键, 魂环键],
              年限,
              档位类型: 判定魂环档位类型_V1(年限),
              魂环键,
            });
          });
        });
        取武魂直接魂环条目_战斗(武魂数据).forEach(([魂环键, 魂环数据]) => {
          if (!魂环数据 || typeof 魂环数据 !== 'object') return;
          const 年限 = Math.max(100, Number(魂环数据?.年限 || 100));
          结果.push({
            路径: [武魂键, 魂环键],
            年限,
            档位类型: 判定魂环档位类型_V1(年限),
            魂环键,
          });
        });
      });
      return 结果;
    }

    function 写入角色魂环恢复标记_V1(角色数据, 魂环路径 = [], 恢复tick = 0, 恢复时间文本 = '') {
      if (!角色数据 || typeof 角色数据 !== 'object') return false;
      if (!Array.isArray(魂环路径) || !魂环路径.length) return false;
      let 当前 = 角色数据;
      for (let 索引 = 0; 索引 < 魂环路径.length; 索引 += 1) {
        const 片段 = 魂环路径[索引];
        if (!当前 || typeof 当前 !== 'object' || !(片段 in 当前)) return false;
        if (索引 === 魂环路径.length - 1) {
          const 魂环数据 = 当前[片段];
          if (!魂环数据 || typeof 魂环数据 !== 'object') return false;
          魂环数据.炸环恢复tick = Math.max(0, Math.floor(Number(恢复tick || 0)));
          if (恢复时间文本) 魂环数据.炸环恢复时间 = String(恢复时间文本).trim();
          return true;
        }
        当前 = 当前[片段];
      }
      return false;
    }

    function 按路径读取对象_V1(根对象 = {}, 路径 = []) {
      let 当前 = 根对象;
      for (const 片段 of 路径) {
        if (!当前 || typeof 当前 !== 'object') return undefined;
        当前 = 当前[片段];
      }
      return 当前;
    }

    function 构建魂环恢复标记补丁_V1(角色名 = '', 魂环路径 = [], 恢复tick = 0, 恢复时间文本 = '') {
      const 角色文本 = String(角色名 || '').trim();
      if (!角色文本 || !Array.isArray(魂环路径) || !魂环路径.length) return [];
      const 基础路径 =
        `/char/${escapeJsonPointerSegment(角色文本)}/` +
        魂环路径.map(片段 => escapeJsonPointerSegment(片段)).join('/');
      const 补丁 = [
        { op: 'add', path: `${基础路径}/炸环恢复tick`, value: Math.max(0, Math.floor(Number(恢复tick || 0))) },
      ];
      if (恢复时间文本) 补丁.push({ op: 'add', path: `${基础路径}/炸环恢复时间`, value: String(恢复时间文本).trim() });
      return 补丁;
    }

    function 查找战斗物品定义_战斗(物品名 = '') {
      const 名称 = String(物品名 || '').trim();
      if (!名称 || 名称 === '无') return null;
      const 物品表 = window.BattleUIBridge?.getMVU?.('物品') || {};
      for (const 分类表 of Object.values(物品表 || {})) {
        if (分类表 && typeof 分类表 === 'object' && !Array.isArray(分类表) && 分类表[名称]) return 分类表[名称];
      }
      return null;
    }

    function 合并战斗物品定义_战斗(记录 = {}) {
      if (!记录 || typeof 记录 !== 'object' || Array.isArray(记录)) return {};
      const 名称 = String(记录.名称 || 记录.name || '').trim();
      const 定义 = 查找战斗物品定义_战斗(名称) || {};
      return { ...cloneBattleValue(定义), ...记录, 名称 };
    }

    function 构建魂导器技能表_战斗(魂导器装备 = {}) {
      const 输出 = {};
      const 装配 = 魂导器装备?.装配 && typeof 魂导器装备.装配 === 'object' && !Array.isArray(魂导器装备.装配) ? 魂导器装备.装配 : {};
      const 魂导器默认魂力消耗表 = Object.freeze({ 1: 160, 2: 260, 3: 400, 4: 900, 5: 1600, 6: 2600, 7: 4500, 8: 6500, 9: 11000, 10: 16000, 11: 24000, 12: 36000 });
      Object.entries(装配).forEach(([槽位, 魂导器]) => {
        if (!魂导器 || typeof 魂导器 !== 'object' || Array.isArray(魂导器)) return;
        const 合并魂导器 = 合并战斗物品定义_战斗(魂导器);
        const 名称 = String(合并魂导器.名称 || 合并魂导器.name || '').trim();
        const 魂导等级 = Math.max(0, Math.min(12, Math.floor(Number(合并魂导器.魂导等级 || 0))));
        if (!名称 || 名称 === '无' || !(魂导等级 > 0)) return;
        const 技能表 = 合并魂导器.装备技能 && typeof 合并魂导器.装备技能 === 'object' && !Array.isArray(合并魂导器.装备技能) ? 合并魂导器.装备技能 : {};
        Object.entries(技能表).forEach(([技能名, 技能数据]) => {
          if (!技能数据 || typeof 技能数据 !== 'object' || Array.isArray(技能数据)) return;
          const 技能 = cloneBattleValue(技能数据);
          技能.魂导等级 = 魂导等级;
          技能.__魂导等级 = 魂导等级;
          技能.__魂导器名称 = 名称;
          技能.__魂导器槽位 = 槽位;
          if (!String(技能.消耗 || '').trim() || String(技能.消耗 || '').trim() === '无') 技能.消耗 = `魂力:${魂导器默认魂力消耗表[魂导等级] || 160}`;
          技能.使用条件 = 技能.使用条件 && typeof 技能.使用条件 === 'object' && !Array.isArray(技能.使用条件) ? cloneBattleValue(技能.使用条件) : {};
          if (魂导等级 >= 10) 技能.使用条件.最低等级 = Math.max(95, Number(技能.使用条件.最低等级 || 0));
          输出[`${槽位}:${技能名}`] = 技能;
        });
      });
      return 输出;
    }

    function fallbackPushSkill(actions, skill, fallbackName, category, 魂环路径 = null, 魂技槽位 = '') {
      if (!skill || typeof skill !== 'object') return;
      const name = String(skill.魂技名 || skill.name || fallbackName || '').trim();
      if (!name) return;
      const runtimeSkill = normalizeSkillData(skill, name);
      if (Array.isArray(魂环路径) && 魂环路径.length) runtimeSkill.__魂环路径 = [...魂环路径];
      const 技能槽位 = String(魂技槽位 || fallbackName || name).trim();
      if (技能槽位) runtimeSkill.__魂技槽位 = 技能槽位;
      const 来源明细 = String(category || '魂技').trim() || '魂技';
      const 来源类别 = 规范化战斗来源类别(来源明细, '魂技');
      写入战斗来源类别上下文(runtimeSkill, { 来源类别, 来源明细, 魂环路径, 魂技槽位: 技能槽位 });
      const 来源键 = [
        来源类别,
        ...(Array.isArray(魂环路径) ? 魂环路径 : []),
        技能槽位,
        name,
        actions.length,
      ].map(片段 => String(片段 || '').replace(/[^\w\u4e00-\u9fa5-]+/g, '_')).filter(Boolean).join('_');
      actions.push({
        id: `skill_${来源键 || actions.length}`,
        name,
        type: 'skill',
        action_type: '释放魂技',
        category: 来源类别,
        source_detail: 来源明细,
        skill: runtimeSkill,
        raw_skill: runtimeSkill,
        cast_time: fallbackNumber(skill.前摇, 10),
        cost_text: skill?.__fusion_display_cost_text ? String(skill.__fusion_display_cost_text) : String(skill.消耗 || ''),
        enabled: true,
      });
    }

    function fallbackCollectActions(charData) {
      const actions = [];
      const char = charData && typeof charData === 'object' ? charData : {};
      取角色武魂条目_战斗(char).forEach(([spiritName, spirit]) => {
        取武魂魂灵条目_战斗(spirit).forEach(([soulSpiritName, soulSpirit]) => {
          取魂灵魂环条目_战斗(soulSpirit).forEach(([ringIndex, ring]) => {
            取魂环魂技条目_战斗(ring).forEach(([skillName, skill]) => {
              fallbackPushSkill(
                actions,
                skill,
                skillName,
                spirit?.表象名称 || spiritName || `第${ringIndex}魂环`,
                [spiritName, soulSpiritName, ringIndex],
                skillName,
              );
            });
          });
        });
        取武魂直接魂环条目_战斗(spirit).forEach(([ringIndex, ring]) => {
          取魂环魂技条目_战斗(ring).forEach(([skillName, skill]) => {
            fallbackPushSkill(actions, skill, skillName, spirit?.表象名称 || spiritName || `第${ringIndex}魂环`, [spiritName, ringIndex], skillName);
          });
        });
      });
      Object.entries(char.自创魂技 || {}).forEach(([name, skill]) => fallbackPushSkill(actions, skill, name, '自创魂技'));
      Object.entries(char.装备 || {}).forEach(([装备键, equip]) => {
        if (装备键 === '魂导器') return;
        if (!equip || typeof equip !== 'object' || Array.isArray(equip)) return;
        const 合并装备 = 合并战斗物品定义_战斗(equip);
        if (Number(合并装备.魂导等级 || 0) > 0) return;
        Object.entries(合并装备.装备技能 || {}).forEach(([name, skill]) => fallbackPushSkill(actions, skill, name, '装备技能'));
      });
      Object.values(构建魂导器技能表_战斗(char.装备?.魂导器)).forEach(魂导技能 =>
        fallbackPushSkill(actions, 魂导技能, 魂导技能?.魂技名 || 魂导技能?.name || '魂导器技能', '装备技能'),
      );
      Object.entries(char.武魂融合技 || {}).forEach(([name, fusion]) =>
        fallbackPushSkill(actions, buildFusionCombatSkill(fusion, name, char), `武魂融合技·${name}`, '武魂融合技'),
      );
      actions.push(
        { id: 'basic_attack', name: '普通攻击', type: 'tactical', action_type: '常规攻击', category: '战术', cast_time: 10, cost_text: '无', enabled: true, skill: { name: '普通攻击' } },
        { id: 'guard', name: '防御', type: 'tactical', action_type: '防御', category: '战术', cast_time: 10, cost_text: '无', enabled: true, skill: { name: '防御' } },
        { id: 'evade', name: '闪避', type: 'tactical', action_type: '闪避', category: '战术', cast_time: 12, cost_text: '体力:5%', enabled: true, skill: { name: '闪避', 消耗: '体力:5%' } },
        { id: 'flee', name: '撤离', type: 'tactical', action_type: '撤离', category: '战术', cast_time: 20, cost_text: '无', enabled: true, skill: { name: '撤离' } },
      );
      return actions;
    }

    function resolveIntentTargetNameFromAction(action, combatData) {
      const safeAction = action || {};
      const skill = safeAction.raw_skill || safeAction.skill || {};
      if (safeAction.target_name) return String(safeAction.target_name || '').trim() || null;
      if (String(skill?.承载方式 || '').trim() === '造物承载') return null;
      const playerName = String(combatData?.参战者?.team_player?.[0]?.name || '').trim() || null;
      const enemyName = String(combatData?.参战者?.team_enemy?.[0]?.name || '').trim() || null;
      const targetKind = inferSkillPrimaryTargetKind(skill);
      if (['自身', '友方单体', '友方群体'].includes(targetKind)) return playerName;
      if (targetKind === '全场') return playerName || enemyName;
      return enemyName || playerName;
    }

    function fallbackBuildActionDeclaration(action, combatData) {
      const safeAction = action || {};
      const resolvedTargetName = resolveIntentTargetNameFromAction(safeAction, combatData);
      const skill = safeAction.raw_skill || safeAction.skill || { name: safeAction.name || '普通攻击' };
      const 来源上下文 = 读取战斗来源类别上下文(skill, safeAction.category || '魂技');
      const 魂环路径 = Array.isArray(skill?.__魂环路径) ? skill.__魂环路径.map(片段 => String(片段)) : [];
      const 魂技槽位 = String(skill?.__魂技槽位 || '').trim();
      const actions = [{
        type: safeAction.action_type || safeAction.type || '常规攻击',
        action_type: safeAction.action_type || safeAction.type || '常规攻击',
        category: safeAction.category || 来源上下文.来源类别,
        source_detail: safeAction.source_detail || 来源上下文.来源明细,
        skill,
        前摇: fallbackNumber(safeAction.cast_time, 10),
        target_name: resolvedTargetName,
        前摇已结算: safeAction.前摇已结算 === true,
      }];
      if (魂环路径.length) actions[0].__魂环路径 = 魂环路径;
      if (魂技槽位) actions[0].__魂技槽位 = 魂技槽位;
      const ownerName = String(root.BattleUI?.state?.player?.name || combatData?.参战者?.team_player?.[0]?.name || '').trim();
      if (ownerName) actions[0].actor_name = ownerName;
      if (safeAction.造物处理) actions[0].造物处理 = String(safeAction.造物处理 || '').trim();
      if (safeAction.物品接收者) actions[0].物品接收者 = String(safeAction.物品接收者 || '').trim();
      if (safeAction.立即使用 === true) actions[0].立即使用 = true;
      if (safeAction.即食 === true) actions[0].即食 = true;
      if (safeAction.食用目标) actions[0].食用目标 = String(safeAction.食用目标 || '').trim();
      return { actorName: ownerName, actions, primaryTargetName: resolvedTargetName || '' };
    }

    function fallbackBuildIntent(action, combatData) {
      const declaration = fallbackBuildActionDeclaration(action, combatData);
      const actionName = declaration.actions[0]?.skill?.魂技名 || declaration.actions[0]?.skill?.name || action?.name || '普通攻击';
      return [actionName, declaration.primaryTargetName ? `[目标]${declaration.primaryTargetName}[/目标]` : ''].filter(Boolean).join('\n');
    }

    function fallbackRenderActions(actions, selectedId) {
      const node = byId('ui-action-grid');
      if (!node) return;
      node.innerHTML = actions
        .map(action => {
          const selected = action.id === selectedId ? ' is-selected' : '';
          const disabled = action.enabled === false ? ' disabled' : '';
          const meta = [action.cost_text, action.cast_time ? `${action.cast_time}` : ''].filter(Boolean).join(' / ');
          return `<button class="action-btn${selected}" type="button" data-action-id="${fallbackEscape(action.id)}"${disabled}><span class="action-name">${fallbackEscape(action.name)}</span><span class="action-meta"><span>${fallbackEscape(action.category || '战术')}</span><span class="action-cost">${fallbackEscape(meta)}</span></span></button>`;
        })
        .join('');
      node.querySelectorAll('[data-action-id]').forEach(button => {
        button.addEventListener('click', () => {
          const state = root.BattleUI?.state || {};
          const action = (state.availableActions || []).find(item => item.id === button.dataset.actionId);
          if (!action || action.enabled === false) return;
          state.selectedAction = action;
          state.selectedSkillActions = [action];
          const output = byId('ui-intent-output');
          if (output) output.value = fallbackBuildIntent(action, state.combatData);
          fallbackRenderActions(state.availableActions || [], action.id);
        });
      });
    }

    component.syncFromBattleEngine = function syncCurrentBattlePanel() {
      const combatData = cloneBattleValue(getMvuValue('world.战斗') || _options.combatData || {});
      const participants = combatData && combatData.参战者 && typeof combatData.参战者 === 'object' ? combatData.参战者 : null;
      if (!participants) return;
      const 玩家队伍 = Array.isArray(participants.team_player) ? participants.team_player : [];
      const 敌方队伍 = Array.isArray(participants.team_enemy) ? participants.team_enemy : [];
      const player = fallbackRenderUnit('player', 玩家队伍[0]);
      const enemy = fallbackRenderUnit('enemy', 敌方队伍[0]);
      const chipNode = byId('ui-combat-chips');
      if (chipNode) {
        chipNode.innerHTML = [`回合 ${Number(combatData.回合 || 0)}`, combatData.战斗类型 || '战斗', combatData.阶段 || 战斗阶段枚举_V1.宣告, `${player.name} → ${enemy.name}`]
          .map(item => `<span class="intent-pill">${fallbackEscape(item)}</span>`)
          .join('');
      }
      const charData = getMvuValue(`char.${player.name}`) || 玩家队伍[0];
      const availableActions = fallbackCollectActions(charData);
      const previousState = root.BattleUI?.state || {};
      const currentIntentMode = previousState.currentIntentMode || combatData.战斗意图 || '点到为止';
      const autoContinueConfig = 规范化自动续推设置(previousState.autoContinueConfig || {}, 'multi_round');
      const matchedPreviousAction = previousState.selectedAction
        ? availableActions.find(action => action.id === previousState.selectedAction.id)
        : null;
      const selectedAction = matchedPreviousAction || availableActions.find(action => action.enabled !== false) || availableActions[0] || null;
      root.BattleUI = Object.assign(root.BattleUI || {}, {
        state: {
          ...previousState,
          combatData,
          player,
          enemy,
          availableActions,
          selectedAction,
          selectedSkillActions: selectedAction ? [selectedAction] : [],
          selectedPreActions: [],
          currentMode: previousState.currentMode || 'single_round',
          currentIntentMode,
          autoContinueConfig,
        },
        buildIntentText(actions = []) {
          return fallbackBuildIntent(actions[0] || root.BattleUI?.state?.selectedAction, root.BattleUI?.state?.combatData);
        },
        buildActionDeclaration(actions = []) {
          return fallbackBuildActionDeclaration(actions[0] || root.BattleUI?.state?.selectedAction, root.BattleUI?.state?.combatData);
        },
        submitBattleIntent() {
          const state = root.BattleUI?.state || {};
          const action = state.selectedAction?.enabled !== false
            ? state.selectedAction
            : (state.availableActions || []).find(item => item.enabled !== false) || state.availableActions?.[0] || null;
          const intentText = fallbackBuildIntent(action, state.combatData);
          const actionDeclaration = fallbackBuildActionDeclaration(action, state.combatData);
          const output = byId('ui-intent-output');
          if (output) output.value = intentText;
          const battleMode = state.currentMode === 'multi_round' ? 'multi_round' : 'single_round';
          state.combatData.战斗意图 = state.currentIntentMode || '点到为止';
          try {
            const result = root.BattleUIBridge?.executePlayerBattleIntent?.(intentText, {
              mode: battleMode,
              intentMode: state.currentIntentMode || '点到为止',
              actionDeclaration,
              autoContinueConfig: 规范化自动续推设置(state.autoContinueConfig || {}, battleMode),
            });
            if (typeof component.syncFromBattleEngine === 'function') component.syncFromBattleEngine();
            root.dispatchEvent(new CustomEvent('battle-ui-submit-finished', { detail: result || { intentText } }));
            return result || { intentText };
          } catch (error) {
            const result = { intentText, mode: 'engine_error', battleMode, error };
            root.dispatchEvent(new CustomEvent('battle-ui-submit-finished', { detail: result }));
            return result;
          }
        },
      });
      fallbackRenderActions(availableActions, selectedAction?.id || '');
      渲染自动续推设置控件();
      const output = byId('ui-intent-output');
      if (output && selectedAction) output.value = fallbackBuildIntent(selectedAction, combatData);
      const intentModeInput = byId('ui-intent-mode');
      if (intentModeInput && intentModeInput.value !== currentIntentMode) intentModeInput.value = currentIntentMode;
      const arbitrateBtn = byId('ui-arbitrate');
      if (arbitrateBtn && !arbitrateBtn.__fallbackBattleBound) {
        arbitrateBtn.addEventListener('click', () => root.BattleUI?.submitBattleIntent?.());
        arbitrateBtn.__fallbackBattleBound = true;
        arbitrateBtn.__battleSubmitBound = true;
      }
      document.querySelectorAll('#ui-mode-group [data-mode]').forEach(btn => {
        if (btn.__battleModeBound) return;
        btn.addEventListener('click', () => {
          const normalized = btn.dataset.mode === 'multi_round' ? 'multi_round' : 'single_round';
          if (root.BattleUI && root.BattleUI.state) root.BattleUI.state.currentMode = normalized;
          document.querySelectorAll('#ui-mode-group [data-mode]').forEach(item => {
            item.classList.toggle('active', item.dataset.mode === normalized);
          });
        });
        btn.__battleModeBound = true;
      });
      document.querySelectorAll('#ui-battle-submit-mode-group [data-submit-mode]').forEach(btn => {
        if (btn.__battleSubmitModeBound) return;
        btn.addEventListener('click', () => {
          root.BattleUIBridge?.setBattleSubmitMode?.(btn.dataset.submitMode || 'manual');
        });
        btn.__battleSubmitModeBound = true;
      });
      同步战斗提交模式控件();
      if (intentModeInput && !intentModeInput.__battleIntentBound) {
        intentModeInput.addEventListener('change', () => {
          if (root.BattleUI && root.BattleUI.state) root.BattleUI.state.currentIntentMode = intentModeInput.value || '点到为止';
        });
        intentModeInput.__battleIntentBound = true;
      }
      const closeBtn = byId('ui-battle-close');
      if (closeBtn && !closeBtn.__battleCloseBound) {
        closeBtn.addEventListener('click', () => {
          root.dispatchEvent(new CustomEvent('battle-ui-close-request', { detail: { source: 'battle_ui' } }));
        });
        closeBtn.__battleCloseBound = true;
      }
    };

    const 延后同步战斗面板 = () => {
      if (typeof component.syncFromBattleEngine === 'function') component.syncFromBattleEngine();
    };
    if (typeof root.queueMicrotask === 'function') root.queueMicrotask(延后同步战斗面板);
    else root.setTimeout(延后同步战斗面板, 0);

    installHostHooks();
    /* __BATTLE_ENGINE_INLINE__ */
    function createEmptySkillSemantics() {
      return {
        战斗定位: '无',
        作用目标: '敌方单体',
        优先条件: [],
        风险等级: '中',
        保留倾向: 0,
        目标偏好: [],
        友方偏好: [],
        是否持续: false,
        是否可打断: false,
        是否可被霸体免疫: true,
      };
    }

    function createEmptyBattleSummary() {
      return {
        目标规模: '单体',
        生效方式: '直接',
        爆发级别: '中',
        持续性: '无',
        风险等级: '中',
        属性建模: '无',
        极性层级: '无',
        控制强度: '无',
        回复性质: '无',
        防御性质: '无',
        协同性: '低',
        保留倾向: 0,
      };
    }

    function mapSemanticTargetToCombatTarget(target) {
      const mapping = {
        敌方单体: '敌方/单体',
        敌方群体: '敌方/群体',
        自身: '自身',
        友方单体: '己方/单体',
        友方群体: '己方/群体',
        全场: '全场',
      };
      return mapping[target] || target || '敌方/单体';
    }

    const BATTLE_SKILL_TARGET_KINDS = new Set(['自身', '友方单体', '友方群体', '敌方单体', '敌方群体', '全场', '召唤物', '分身']);
    const BATTLE_SKILL_TARGET_SCALES = new Set(['自身', '单体', '群体', '全场', '召唤物', '分身']);
    const BATTLE_SKILL_TARGET_MODIFIERS = new Set([
      '受隐身筛选',
      '可被破隐',
      '可被嘲讽',
      '可被护卫重定向',
      '可被锁定强化',
    ]);

    function normalizeBattleEffectTargetKind(value = '', fallback = '敌方单体') {
      const text = String(value || '').trim();
      if (BATTLE_SKILL_TARGET_KINDS.has(text)) return text;
      const derived = (() => {
        if (/分身/.test(text)) return '分身';
        if (/造物/.test(text)) return '召唤物';
        if (/召唤物|召唤/.test(text)) return '召唤物';
        if (/全场敌方|敌方全场|全体敌|所有敌|全部敌/.test(text)) return '敌方群体';
        if (/友方群体|己方\/群体|全员/.test(text)) return '友方群体';
        if (/友方单体|己方\/单体/.test(text)) return '友方单体';
        if (/敌方群体/.test(text)) return '敌方群体';
        if (/敌方单体/.test(text)) return '敌方单体';
        if (/全场/.test(text)) return '全场';
        if (/自身/.test(text)) return '自身';
        return '';
      })();
      return BATTLE_SKILL_TARGET_KINDS.has(derived) ? derived : fallback;
    }

    function mapBattleTargetKindToCombatTarget(targetKind = '敌方单体') {
      return {
        自身: '自身',
        友方单体: '己方/单体',
        友方群体: '己方/群体',
        敌方单体: '敌方/单体',
        敌方群体: '敌方/群体',
        全场: '全场',
        召唤物: '召唤物',
        分身: '分身',
      }[normalizeBattleEffectTargetKind(targetKind)] || '敌方/单体';
    }

    function normalizeBattleSkillTargetModifiers(value = []) {
      const source = Array.isArray(value) ? value : [value];
      return Array.from(
        new Set(
          source
            .map(item => String(item || '').trim())
            .filter(item => BATTLE_SKILL_TARGET_MODIFIERS.has(item)),
        ),
      );
    }

    function inferBattleTargetKindFromTargetText(text = '') {
      return normalizeBattleEffectTargetKind(text, '敌方单体');
    }

    function deriveBattleTargetResolutionStrategy(targetKind = '敌方单体') {
      return ['敌方群体', '友方群体', '全场'].includes(normalizeBattleEffectTargetKind(targetKind))
        ? '全目标独立'
        : '单目标独立';
    }

    function deriveBattleSkillTargetModifiers(skill = {}, targetKind = '敌方单体') {
      const normalizedTargetKind = normalizeBattleEffectTargetKind(targetKind, '敌方单体');
      const effects = getSkillEffects(skill);
      const mechanisms = effects
        .map(effect => String(effect?.原型 || '').trim())
        .filter(Boolean);
      const modifiers = [];
      if (normalizedTargetKind === '敌方单体') {
        modifiers.push('受隐身筛选', '可被嘲讽', '可被护卫重定向', '可被锁定强化');
      }
      if (mechanisms.includes('破隐')) modifiers.push('可被破隐');
      return normalizeBattleSkillTargetModifiers(modifiers);
    }

    function normalizeBattleSkillTargetScale(value = '', fallback = '单体') {
      const text = String(value || '').trim();
      if (BATTLE_SKILL_TARGET_SCALES.has(text)) return text;
      if (text === '自身') return '自身';
      if (text === '全场') return '全场';
      if (/分身/.test(text)) return '分身';
      if (/召唤物|召唤/.test(text)) return '召唤物';
      if (/群体/.test(text)) return '群体';
      if (/单体/.test(text)) return '单体';
      return BATTLE_SKILL_TARGET_SCALES.has(fallback) ? fallback : '单体';
    }

    function normalizeBattleEffectTargetScale(value = '', fallback = '单体') {
      const text = String(value || '').trim();
      return normalizeBattleSkillTargetScale(text, fallback);
    }

    function 读取战斗数值正负(value) {
      const text = String(value ?? '').trim();
      if (!text) return 0;
      if (/%$/.test(text)) {
        const percent = Number(text.replace('%', ''));
        return Number.isFinite(percent) ? percent / 100 : 0;
      }
      const num = Number(text);
      return Number.isFinite(num) ? num : 0;
    }

    function 读取战斗数值是否百分比(value) {
      return /%$/.test(String(value ?? '').trim());
    }

    function 当前技能元素匹配结算修正(skill = {}, effect = {}) {
      const 限定元素列表 = normalizeBattleSkillAttributeTokens(effect?.限定元素);
      if (!限定元素列表.length) return true;
      const 当前技能元素集合 = new Set(normalizeBattleSkillAttributeTokens([
        ...(Array.isArray(skill?.附带属性) ? skill.附带属性 : [skill?.附带属性]),
        getBattleSkillAttributeSummary(skill || {}).显示元素,
        ...((getBattleSkillElementStructure(skill || {}).核心元素) || []),
        ...((getBattleSkillElementStructure(skill || {}).驱动元素) || []),
        ...((getBattleSkillElementStructure(skill || {}).触发元素) || []),
      ]));
      return 限定元素列表.some(元素 => 当前技能元素集合.has(元素));
    }

    function 读取技能当前元素集合(skill = {}) {
      return new Set(normalizeBattleSkillAttributeTokens([
        ...(Array.isArray(skill?.附带属性) ? skill.附带属性 : [skill?.附带属性]),
        getBattleSkillAttributeSummary(skill || {}).显示元素,
        ...((getBattleSkillElementStructure(skill || {}).核心元素) || []),
        ...((getBattleSkillElementStructure(skill || {}).驱动元素) || []),
        ...((getBattleSkillElementStructure(skill || {}).触发元素) || []),
      ]));
    }

    function 构建状态元素承伤修正(effect = {}) {
      const 状态 = String(effect?.状态 || '').trim();
      const 已有修正 = effect?.元素承伤修正 && typeof effect.元素承伤修正 === 'object' ? cloneBattleValue(effect.元素承伤修正) : {};
      const 副数值 = 读取战斗数值正负(effect?.副数值);
      const 倍率 = Number((1 + Math.abs(副数值 || 0.2)).toFixed(4));
      if (状态 === '灼烧') 已有修正.火 = Math.max(Number(已有修正.火 || 1), 倍率);
      if (状态 === '冻伤') 已有修正.冰 = Math.max(Number(已有修正.冰 || 1), 倍率);
      return Object.keys(已有修正).length ? 已有修正 : null;
    }

    function 读取目标元素承伤倍率(target = {}, skill = {}) {
      const 当前元素集合 = 读取技能当前元素集合(skill);
      if (!当前元素集合.size) return 1;
      return Object.values(target?.状态效果 || {}).reduce((倍率, 状态) => {
        const 修正 = 状态?.元素承伤修正;
        if (!修正 || typeof 修正 !== 'object') return 倍率;
        const 本状态倍率 = Object.entries(修正).reduce((最大值, [元素, 值]) => {
          const 元素列表 = normalizeBattleSkillAttributeTokens(元素);
          if (!元素列表.some(item => 当前元素集合.has(item))) return 最大值;
          const 数值 = Number(值 || 1);
          return Number.isFinite(数值) ? Math.max(最大值, 数值) : 最大值;
        }, 1);
        return 倍率 * 本状态倍率;
      }, 1);
    }

    function 读取技能自身结算修正(skill = {}, 结算名 = '', context = {}) {
      const 技能 = skill && typeof skill === 'object' ? skill : {};
      return getSkillEffects(技能, { ...context, skill: 技能, 排除跟随主原型: true }).reduce((结果, effect) => {
        if (String(effect?.原型 || '').trim() !== '结算修正') return 结果;
        if (String(effect?.结算 || '').trim() !== 结算名) return 结果;
        if (!当前技能元素匹配结算修正(技能, effect)) return 结果;
        const 数值 = 读取战斗数值正负(effect?.数值);
        if (!Number.isFinite(数值) || 数值 === 0) return 结果;
        if (读取战斗数值是否百分比(effect?.数值)) 结果.倍率 *= Math.max(0, 1 + 数值);
        else 结果.绝对 += 数值;
        return 结果;
      }, { 倍率: 1, 绝对: 0 });
    }

    function 推断战斗机制默认方向(effect = {}) {
      const 原型 = String(effect?.原型 || '').trim();
      const 原型默认方向 = String(BATTLE_PROTOTYPE_REGISTRY[原型]?.默认方向 || '').trim();
      const 状态名 = String(effect?.状态 || effect?.状态名称 || '').trim();
      const 状态极性 = String(effect?.正负面 || effect?.类型 || effect?.状态类型 || '').trim();
      if (String(effect?.目标 || '').trim() === '召唤物') return '载体';
      if (String(effect?.目标 || '').trim() === '分身') return '载体';
      if (原型 === '召唤生成' || 原型默认方向 === '召唤物') return '无目标';
      if (原型 === '状态移除') {
        if (/负面|减益|异常|控制|debuff/i.test(`${状态名} ${状态极性}`)) return '友方';
        if (/正面|增益|强化|buff/i.test(`${状态名} ${状态极性}`)) return '敌方';
      }
      if (原型 === '状态施加') {
        if (/正面|增益|强化|buff/i.test(状态极性)) return '友方';
        if (/负面|减益|异常|控制|debuff/i.test(状态极性)) return '敌方';
        if (/护盾|持续恢复|无视异常|霸体|无敌|免伤|护卫|隐匿|共享视野|反击姿态|蓄力|祝福|强化/.test(状态名)) return '友方';
      }
      if (原型 === '规则防御') return '友方';
      if (原型默认方向 === '敌对' || 原型默认方向 === '敌方') return '敌方';
      if (原型默认方向 === '可赋予' || 原型默认方向 === '友方') return '友方';
      if (原型默认方向 === '自身') return '友方';
      if (原型 === '资源转移') {
        const 转移方式 = String(effect?.资源转移方式 || '').trim();
        if (转移方式 === '共享') return '友方';
        if (转移方式 === '均分') return '敌方';
        return '敌方';
      }
      if (['资源变化', '护盾变化', '属性修正'].includes(原型)) {
        return 读取战斗数值正负(effect?.数值) < 0 ? '敌方' : '友方';
      }
      if (原型 === '结算修正') {
        const 结算 = String(effect?.结算 || '').trim();
        if (
          (结算 === '造成伤害' && 读取战斗数值正负(effect?.数值) < 0) ||
          (结算 === '受到伤害' && 读取战斗数值正负(effect?.数值) > 0) ||
          ['反伤', '伤害转移', '治疗转伤害', '防御穿透', '反击', '持续伤害引爆'].includes(结算)
        )
          return '敌方';
        if (
          (结算 === '造成伤害' && 读取战斗数值正负(effect?.数值) > 0) ||
          (结算 === '受到伤害' && 读取战斗数值正负(effect?.数值) < 0) ||
          ['治疗', '技能效果', '伤害吸收', '伤害转治疗', '伤害分摊', '消耗分摊'].includes(结算)
        )
          return '友方';
        if (['消耗', '前摇'].includes(结算)) return 读取战斗数值正负(effect?.数值) > 0 ? '敌方' : '友方';
      }
      return '敌方';
    }

    function 推断战斗效果目标类型(effect = {}, fallbackTargetKind = '敌方单体') {
      const rawTarget = String(effect?.目标 ?? '').trim();
      const scale = normalizeBattleEffectTargetScale(rawTarget, deriveBattleSkillTargetScaleFromKind(fallbackTargetKind));
      if (scale === '自身') return '自身';
      if (scale === '全场') return '全场';
      if (scale === '召唤物') return '召唤物';
      if (scale === '分身') return '分身';
      if (/敌方|敌人|对手/.test(rawTarget)) return scale === '群体' ? '敌方群体' : '敌方单体';
      if (/友方|己方|队友/.test(rawTarget)) return scale === '群体' ? '友方群体' : '友方单体';
      const direction = 推断战斗机制默认方向(effect);
      if (direction === '友方') return scale === '群体' ? '友方群体' : '友方单体';
      return scale === '群体' ? '敌方群体' : '敌方单体';
    }

    function inferSkillPrimaryTargetKind(skill = {}) {
      const explicitTarget = String(skill?.目标 || skill?.target || '').trim();
      if (explicitTarget) return normalizeBattleExecutionEffectTargetKind(explicitTarget, '敌方单体');
      const effects = getSkillEffects(skill);
      const primaryEffect =
        effects.find(effect => effect && typeof effect === 'object' && String(effect.原型 || '').trim() === '伤害结算') ||
        effects.find(effect => effect && typeof effect === 'object' && 推断战斗效果目标类型(effect) !== '自身') ||
        effects.find(effect => effect && typeof effect === 'object' && String(effect.原型 || '').trim());
      return primaryEffect ? 推断战斗效果目标类型(primaryEffect) : '敌方单体';
    }

    function deriveBattleSkillTargetScaleFromKind(targetKind = '敌方单体') {
      const normalized = normalizeBattleEffectTargetKind(targetKind, '敌方单体');
      if (normalized === '自身') return '自身';
      if (normalized === '全场') return '全场';
      if (normalized === '召唤物') return '召唤物';
      if (normalized === '分身') return '分身';
      if (normalized.includes('群体')) return '群体';
      return '单体';
    }

    function normalizeBattleExecutionEffectTargetKind(value = '', fallback = '敌方单体') {
      const text = String(value || '').trim();
      if (!text) return normalizeBattleEffectTargetKind(fallback, '敌方单体');
      const aliasMap = {
        '己方/单体': '友方单体',
        '己方/群体': '友方群体',
        '敌方/单体': '敌方单体',
        '敌方/群体': '敌方群体',
        造物: '召唤物',
        召唤物: '召唤物',
        分身: '分身',
      };
      return normalizeBattleEffectTargetKind(aliasMap[text] || text, normalizeBattleEffectTargetKind(fallback, '敌方单体'));
    }

    const 战斗机制中文键英文名 = Object.freeze({
      增加命中: 'hit_bonus',
      降低命中: 'hit_penalty',
      增加闪避: 'dodge_bonus',
      降低闪避: 'dodge_penalty',
      增加反应: 'reaction_bonus',
      降低反应: 'reaction_penalty',
      增加攻速: 'attacker_speed_bonus',
      加快施放: 'cast_speed_bonus',
      减慢施放: 'cast_speed_penalty',
      锁定强度: 'lock_level',
      跳过回合: 'skip_turn',
      无法反应: 'cannot_react',
      每回合伤害: 'dot_damage',
      造成伤害修正: 'final_damage_mult',
      受到伤害修正: 'received_damage_mult',
      防御剥夺: 'defense_strip',
      精神抗性剥夺: 'spirit_resist_strip',
      治疗修正: 'final_heal_mult',
      技能效果倍率: 'skill_effect_mult',
      承伤修正: 'damage_reduction',
      反射比例: 'damage_reflect_ratio',
      分摊比例: 'damage_share_ratio',
      分摊人数: 'damage_share_count',
      消耗分摊比例: 'cost_share_ratio',
      消耗分摊人数: 'cost_share_count',
      免伤次数: 'block_count',
      禁疗比例: 'heal_block_ratio',
      反转比例: 'heal_inversion_ratio',
      反击倍率: 'counter_attack_ratio',
      吸收比例: 'damage_absorb_ratio',
      中断概率: 'interrupt_bonus',
      破甲比例: 'armor_pen',
      敏捷倍率: 'agi_ratio',
      隐蔽度: 'stealth_level',
      免疫等级阈值: 'invincible_tier_threshold',
      免死次数: 'death_save_count',
      最低生命保留: 'min_hp_floor',
      霸体: 'super_armor',
      无视异常: '无视异常',
      封技: 'skill_seal',
      缴械: 'disarm',
      沉默: 'silence',
      致盲: 'blind',
      探查屏蔽: '探查屏蔽',
      面板修改比例: 'stat_mods',
      力量: 'str',
      防御: 'def',
      敏捷: 'agi',
      体力: 'vit',
      体力上限: 'vit_max',
      生命: 'hp',
      生命比例: 'hp_ratio',
      魂力: 'sp',
      魂力上限: 'sp_max',
      魂力比例: 'sp_ratio',
      精神力: 'men',
      精神力上限: 'men_max',
      精神力比例: 'men_ratio',
    });

    function 补齐战斗机制英文键(数据) {
      if (Array.isArray(数据)) {
        数据.forEach(item => 补齐战斗机制英文键(item));
        return 数据;
      }
      if (!数据 || typeof 数据 !== 'object') return 数据;
      Object.entries(战斗机制中文键英文名).forEach(([中文键, 英文键]) => {
        if (数据[中文键] !== undefined && 数据[英文键] === undefined) 数据[英文键] = 数据[中文键];
      });
      Object.values(数据).forEach(value => 补齐战斗机制英文键(value));
      return 数据;
    }

    function 转换战斗机制运行值(数据) {
      if (Array.isArray(数据)) {
        数据.forEach(item => 转换战斗机制运行值(item));
        return 数据;
      }
      if (!数据 || typeof 数据 !== 'object') return 数据;
      ['属性', '驱动属性', '资源类型'].forEach(key => {
        if (typeof 数据[key] === 'string') 数据[key] = 战斗机制中文键英文名[数据[key]] || 数据[key];
      });
      Object.values(数据).forEach(value => 转换战斗机制运行值(value));
      return 数据;
    }

    function 读取原型字段数值(字段 = {}, fallback = 0) {
      const 候选 = [
        字段?.数值,
        字段?.倍率,
        字段?.比例,
        字段?.强度,
        字段?.次数,
        字段?.数量,
      ];
      for (const item of 候选) {
        if (item === undefined || item === null || item === '') continue;
        const text = String(item).trim();
        if (/^x/i.test(text)) {
          const parsed = Number(text.replace(/^x/i, ''));
          if (Number.isFinite(parsed)) return parsed;
        }
        const parsed = 读取战斗效果数值(text, fallback);
        if (Number.isFinite(parsed)) return parsed;
      }
      return fallback;
    }

    function 展开战斗原型数组字段(effect = {}) {
      if (!effect || typeof effect !== 'object' || Array.isArray(effect)) return [];
      let entries = [cloneBattleValue(effect)];
      BATTLE_PROTOTYPE_ARRAY_FIELDS.forEach(字段名 => {
        entries = entries.flatMap(entry => {
          const raw = entry && entry[字段名];
          if (!Array.isArray(raw)) return [entry];
          const values = raw.map(item => String(item || '').trim()).filter(Boolean);
          if (!values.length) return [entry];
          return values.map(value => ({ ...entry, [字段名]: value }));
        });
      });
      return entries;
    }

    function 写入原型战斗字段(计算层效果, 字段名, 数值, 模式 = '增量', 原始文本 = '') {
      if (!字段名) return;
      if (模式 === '布尔') {
        计算层效果[字段名] = true;
        return;
      }
      if (模式 === '次数') {
        计算层效果[字段名] = Math.max(1, Math.round(Number(数值 || 1)));
        return;
      }
      if (模式 === '倍率') {
        const raw = Number(数值);
        计算层效果[字段名] = raw > -1 && Math.abs(raw) < 0.5 && /^[+-]/.test(String(原始文本 || '')) ? 1 + raw : raw;
        return;
      }
      计算层效果[字段名] = Number(数值 || 0);
    }

    function 写入状态施加内置战斗效果(计算层效果, effect = {}, hydrated = {}) {
      const 状态 = String(effect?.状态 || '').trim();
      const 数值 = 读取原型字段数值(effect, 0);
      const 副数值 = 读取战斗数值正负(effect?.副数值);
      const 锁定强度 = Math.max(1, Math.round(Math.abs(Number(数值 || effect?.强度 || 1))));
      const 取比例 = (值, 默认值 = 0, 上限 = 1) => Math.min(上限, Math.abs(Number(值 || 默认值 || 0)));
      const 写比例字段 = (字段名, 值, 默认值 = 0) => {
        if (!字段名) return;
        计算层效果[字段名] = Math.max(Number(计算层效果[字段名] || 0), Math.abs(Number(值 || 默认值 || 0)));
      };
      const 写倍率字段 = (字段名, 值, 默认值 = 0) => {
        const 增量 = Number(值 || 默认值 || 0);
        计算层效果[字段名] = Math.max(Number(计算层效果[字段名] || 1), 1 + Math.abs(增量));
      };
      const 写面板倍率 = (字段名, 倍率) => {
        if (!字段名) return;
        hydrated.面板修改比例 = { ...(hydrated.面板修改比例 || {}), [字段名]: Number(倍率 || 1) };
      };
      if (状态 === '中毒') {
        写比例字段('dot_damage_ratio', 取比例(数值, 0.03, 0.03));
        写比例字段('hit_penalty', 副数值, 0.05);
      } else if (状态 === '流血') {
        写比例字段('dot_damage_ratio', 取比例(数值, 0.03, 0.03));
        写倍率字段('received_damage_mult', 副数值, 0.05);
      } else if (状态 === '灼烧') {
        写比例字段('dot_damage_ratio', 取比例(数值, 0.03, 0.03));
        写面板倍率('def', 1 - 取比例(副数值, 0.05));
      } else if (状态 === '冻伤') {
        写比例字段('dot_damage_ratio', 取比例(数值, 0.02, 0.03));
        写面板倍率('agi', 1 - 取比例(副数值, 0.05));
      } else if (状态 === '持续创伤') {
        写比例字段('dot_damage_ratio', 取比例(数值, 0.03, 0.03));
        写比例字段('reaction_penalty', 副数值, 0.05);
      } else if (状态 === '持续恢复') {
        写比例字段('hot_heal_ratio', 取比例(数值, 0.05, 0.05));
      } else if (状态 === '资源燃烧') {
        计算层效果.sp_gain_ratio = Math.min(Number(计算层效果.sp_gain_ratio || 0), -取比例(数值, 0.03, 0.03));
        计算层效果.cost_delta_ratio = Math.max(Number(计算层效果.cost_delta_ratio || 0), 取比例(副数值, 0.05));
      } else if (状态 === '迟缓') {
        写面板倍率('agi', 1 - 取比例(数值, 0.1));
        写比例字段('reaction_penalty', 副数值, 0.08);
      } else if (['眩晕', '麻痹', '僵直', '束缚', '禁锢', '定身', '冻结', '冻结束缚', '星光停滞'].includes(状态)) {
        计算层效果.skip_turn = true;
        计算层效果.cannot_react = true;
      } else if (状态 === '沉默') {
        计算层效果.silence = true;
      } else if (状态 === '致盲') {
        计算层效果.blind = true;
      } else if (状态 === '封技') {
        计算层效果.skill_seal = true;
      } else if (状态 === '禁疗') {
        计算层效果.heal_block_ratio = Math.max(计算层效果.heal_block_ratio || 0, 数值 || 0.4);
      } else if (状态 === '治疗反转') {
        计算层效果.heal_inversion_ratio = Math.max(计算层效果.heal_inversion_ratio || 0, 数值 || 1);
      } else if (状态 === '防御剥夺') {
        写比例字段('defense_strip', 数值, 0.2);
      } else if (状态 === '精神抗性剥夺') {
        写比例字段('spirit_resist_strip', 数值, 0.2);
      } else if (状态 === '隐匿') {
        计算层效果.stealth_level = 1;
      } else if (状态 === '探查屏蔽') {
        计算层效果.探查屏蔽 = true;
      } else if (状态 === '共享视野') {
        写比例字段('hit_bonus', 数值, 0.1);
        写比例字段('reaction_bonus', 副数值, 0.1);
      } else if (状态 === '标记') {
        计算层效果.dodge_penalty = Math.max(计算层效果.dodge_penalty || 0, 取比例(数值, 1));
      } else if (状态 === '护卫') {
        计算层效果.damage_reduction = Math.max(计算层效果.damage_reduction || 0, 取比例(数值, 0.1));
      } else if (状态 === '嘲讽') {
        计算层效果.lock_level = Math.max(计算层效果.lock_level || 0, 1);
      } else if (状态 === '位移限制') {
        计算层效果.lock_level = Math.max(计算层效果.lock_level || 0, 锁定强度);
        计算层效果.reaction_penalty = Math.max(计算层效果.reaction_penalty || 0, 取比例(数值, 0.15));
        计算层效果.dodge_penalty = Math.max(计算层效果.dodge_penalty || 0, 取比例(副数值, 0.1));
      } else if (状态 === '护盾') {
        写比例字段('shield_gain_bonus', 数值, 0.1);
      } else if (状态 === '无视异常') {
        计算层效果.无视异常 = true;
      } else if (状态 === '霸体') {
        计算层效果.super_armor = true;
      } else if (状态 === '虚弱') {
        const 倍率 = 1 - 取比例(数值, 0.08);
        写面板倍率('str', 倍率);
        写面板倍率('def', 倍率);
        写面板倍率('agi', 倍率);
      } else if (状态 === '失控') {
        计算层效果.random_target_rate = Math.max(计算层效果.random_target_rate || 0, 取比例(数值, 0.35));
        计算层效果.hit_penalty = Math.max(计算层效果.hit_penalty || 0, 取比例(副数值, 0.1));
      } else if (状态 === '反噬') {
        计算层效果.misfortune_backlash_ratio = Math.max(计算层效果.misfortune_backlash_ratio || 0, 取比例(数值, 0.03));
      } else if (状态 === '精神紊乱') {
        计算层效果.random_target_rate = Math.max(计算层效果.random_target_rate || 0, 取比例(数值, 0.25));
        计算层效果.reaction_penalty = Math.max(计算层效果.reaction_penalty || 0, 取比例(副数值, 0.08));
      } else if (状态 === '僵直') {
        计算层效果.cannot_react = true;
        计算层效果.reaction_penalty = Math.max(计算层效果.reaction_penalty || 0, 取比例(数值, 0.5));
        计算层效果.cast_speed_penalty = Math.max(计算层效果.cast_speed_penalty || 0, 0.35);
        计算层效果.dodge_penalty = Math.max(计算层效果.dodge_penalty || 0, 取比例(副数值, 0.2));
      } else if (状态 === '麻痹') {
        计算层效果.reaction_penalty = Math.max(计算层效果.reaction_penalty || 0, 取比例(数值, 0.5));
        计算层效果.dodge_penalty = Math.max(计算层效果.dodge_penalty || 0, 取比例(副数值, 0.2));
      } else if (状态 === '混乱') {
        计算层效果.random_target_rate = Math.max(计算层效果.random_target_rate || 0, 取比例(数值, 0.4));
        计算层效果.hit_penalty = Math.max(计算层效果.hit_penalty || 0, 取比例(副数值, 0.1));
      } else if (状态 === '魂力枯竭') {
        计算层效果.sp_gain_ratio = Math.min(Number(计算层效果.sp_gain_ratio || 0), -取比例(数值, 0.03, 0.03));
        计算层效果.cost_delta_ratio = Math.max(Number(计算层效果.cost_delta_ratio || 0), 取比例(副数值, 0.05));
      }
    }

    function 编译原型战斗效果(effect = {}, context = {}) {
      const 原型 = String(effect?.原型 || '').trim();
      if (!原型) return null;
      const 原型定义 = BATTLE_PROTOTYPE_REGISTRY[原型] || {};
      if (!原型定义.原型) return null;
      const hydrated = {
        ...cloneBattleValue(effect || {}),
        运行机制: 原型,
        原型,
      };
      if (原型 === '机制抹消') {
        if (!String(hydrated.状态名称 || '').trim()) hydrated.状态名称 = '机制抹消';
        hydrated.抹消对象 = 规范化战斗机制抹消对象(hydrated.抹消对象);
        if (!(Number(hydrated.持续回合 || 0) > 0)) hydrated.持续回合 = 2;
      }
      if (原型 === '召唤生成' && hydrated.召唤数量 === undefined && effect?.数量 !== undefined) {
        hydrated.召唤数量 = effect.数量;
      }
      const 计算层效果 = createEmptyCombatEffectMap();
      const 数值 = 读取原型字段数值(effect, 0);
      const 原始数值 = String(effect?.数值 ?? effect?.倍率 ?? '');
      const 写字段 = (字段名, 模式 = '增量', 值 = 数值) => 写入原型战斗字段(计算层效果, 字段名, 值, 模式, 原始数值);
      if (原型 === '伤害结算') {
        hydrated.运行机制 = '伤害结算';
        const 攻击段数 = Math.max(1, Math.round(Number(effect?.攻击段数 || 1)));
        const 伤害绑定 = 读取战斗伤害类型绑定(effect?.伤害类型, context?.skill || context?.技能 || {});
        hydrated.伤害类型 = 伤害绑定.伤害类型;
        hydrated.攻击段数 = 攻击段数;
        hydrated.结算标签 = 伤害绑定.结算标签;
        hydrated.抗性类型 = 伤害绑定.抗性类型;
        if (Number(effect?.防御穿透 || 0) > 0) {
          hydrated.防御穿透 = Math.max(0, Number(effect.防御穿透 || 0));
          写字段('armor_pen', '增量', hydrated.防御穿透);
        }
        if (攻击段数 > 1) {
          写字段('multi_hit_count', '次数', 攻击段数);
          写字段('segment_damage_ratio', '增量', 1 / 攻击段数);
        }
      } else if (原型 === '判定修正') {
        const 判定 = String(effect?.判定 || '').trim();
        const 驱动属性 = String(effect?.驱动属性 || '').trim();
        const 驱动系数 = 驱动属性
          ? 计算原型驱动缩放系数(effect, effect?.__actor || {}, effect?.__actor?.final || {}, effect?.__target || {}, effect?.__target?.final || {})
          : 1;
        const 缩放数值 = 数值 * (Number.isFinite(驱动系数) ? 驱动系数 : 1);
        const 正向 = 缩放数值 >= 0;
        const 判定字段表 = {
          命中: 正向 ? 'hit_bonus' : 'hit_penalty',
          闪避: 正向 ? 'dodge_bonus' : 'dodge_penalty',
          反应: 正向 ? 'reaction_bonus' : 'reaction_penalty',
        };
        写字段(判定字段表[判定], '增量', Math.abs(缩放数值));
        if (effect?.打断效果 === true && !正向) {
          hydrated.运行机制 = '打断';
          hydrated.中断概率 = Math.abs(缩放数值);
          写字段('interrupt_bonus', '增量', Math.abs(缩放数值));
        }
      } else if (原型 === '结算修正') {
        const 结算 = String(effect?.结算 || '').trim();
        if (结算 === '造成伤害') {
          写字段('final_damage_mult', '倍率', 数值);
        } else if (结算 === '受到伤害') {
          if (数值 >= 0) 写字段('received_damage_mult', '倍率', 数值);
          else 写字段('damage_reduction', '增量', Math.abs(数值));
        } else if (结算 === '治疗') {
          写字段('final_heal_mult', '倍率', 数值);
        } else if (结算 === '消耗') {
          if (读取战斗数值是否百分比(原始数值) && 数值 > 0) 计算层效果.cost_delta_ratio = Math.max(Number(计算层效果.cost_delta_ratio || 0), 数值);
          if (读取战斗数值是否百分比(原始数值)) 写字段('cost_ratio', '倍率', 数值);
          else 写字段('cost_delta', '增量', 数值);
        } else if (结算 === '前摇') {
          if (读取战斗数值是否百分比(原始数值)) 写字段('windup_ratio', '倍率', 数值);
          else 写字段('windup_delta', '增量', 数值);
        } else {
          const 结算字段表 = {
            反伤: ['damage_reflect_ratio', '增量'],
            伤害转移: ['damage_transfer_ratio', '增量'],
            伤害吸收: ['damage_absorb_ratio', '增量'],
            伤害转治疗: ['damage_to_heal_ratio', '增量'],
            治疗转伤害: ['heal_to_damage_ratio', '增量'],
            伤害分摊: ['damage_share_ratio', '增量'],
            消耗分摊: ['cost_share_ratio', '增量'],
            防御穿透: ['armor_pen', '增量'],
            防御剥夺: ['defense_strip', '增量'],
            精神抗性剥夺: ['spirit_resist_strip', '增量'],
            反击: ['counter_attack_ratio', '增量'],
            持续伤害引爆: ['dot_detonate_ratio', '增量'],
            技能效果: ['skill_effect_mult', '倍率'],
          };
          const [字段名, 模式] = 结算字段表[结算] || [];
          写字段(字段名, 模式 || '增量', ['反伤', '伤害转移', '伤害吸收', '伤害转治疗', '治疗转伤害', '伤害分摊', '消耗分摊', '防御穿透', '防御剥夺', '精神抗性剥夺', '反击', '持续伤害引爆'].includes(结算) ? Math.abs(数值) : 数值);
          if (结算 === '伤害转移') 计算层效果.damage_transfer_target = String(effect?.转移对象 || '攻击者').trim() || '攻击者';
          if (结算 === '伤害吸收') {
            计算层效果.吸收来源 = ['造成伤害', '受到伤害'].includes(String(effect?.吸收来源 || '').trim()) ? String(effect?.吸收来源 || '').trim() : '造成伤害';
            计算层效果.吸收资源 = ['生命', '体力', '魂力', '精神力'].includes(String(effect?.吸收资源 || '').trim()) ? String(effect?.吸收资源 || '').trim() : '生命';
            计算层效果.吸收转化效果 = ['恢复资源', '下次造成伤害'].includes(String(effect?.转化效果 || '').trim()) ? String(effect?.转化效果 || '').trim() : '恢复资源';
            计算层效果.伤害吸收增幅上限 = Math.max(0, Math.min(1, Math.abs(读取战斗数值正负(effect?.增幅上限 || '+50%'))));
          }
          if (结算 === '伤害分摊') {
            计算层效果.damage_share_count = String(effect?.目标 || '').trim() === '群体' ? Math.max(1, Math.round(Number(effect?.数量 || 1))) : 1;
          }
          if (结算 === '消耗分摊') {
            计算层效果.cost_share_count = String(effect?.目标 || '').trim() === '群体' ? Math.max(1, Math.round(Number(effect?.数量 || 1))) : 1;
          }
        }
        if (结算 === '持续伤害引爆') hydrated.引爆倍率 = 数值 > 0 && 数值 < 1 && /^\+/.test(原始数值) ? 1 + 数值 : Math.max(0.1, 数值 || 1);
      } else if (原型 === '属性修正') {
        const 属性列表 = (Array.isArray(effect?.属性) ? effect.属性 : [effect?.属性])
          .map(属性 => 战斗机制中文键英文名[String(属性 || '').trim()] || String(属性 || '').trim())
          .filter(Boolean);
        属性列表.forEach(属性 => {
          if (读取战斗数值是否百分比(原始数值)) {
            const 面板倍率 = Number(Math.max(0.1, 1 + 数值).toFixed(4));
            hydrated.面板修改比例 = { ...(hydrated.面板修改比例 || {}), [属性]: 面板倍率 };
          } else {
            hydrated.面板固定修正 = { ...(hydrated.面板固定修正 || {}), [属性]: 数值 };
          }
        });
      } else if (原型 === '状态施加') {
        const 状态 = String(effect?.状态 || '').trim();
        hydrated.运行机制 = '状态施加';
        hydrated.状态名称 = 状态 || '状态';
        const 元素承伤修正 = 构建状态元素承伤修正(effect);
        if (元素承伤修正) hydrated.元素承伤修正 = 元素承伤修正;
        写入状态施加内置战斗效果(计算层效果, effect, hydrated);
        const 触发限制 = effect?.触发限制 && typeof effect.触发限制 === 'object' ? effect.触发限制 : null;
        if (状态 === '无视异常' && 触发限制 && String(触发限制.周期 || '').trim() === '每日') {
          写字段('每日触发次数上限', '次数', 触发限制.次数);
        }
        if (hasMeaningfulCombatEffect(计算层效果)) {
          hydrated.计算层效果 = mergeCombatEffectMaps(hydrated.计算层效果 || createEmptyCombatEffectMap(), 计算层效果);
        }
      } else if (原型 === '规则防御') {
        const 规则 = String(effect?.规则 || '').trim();
        const 规则字段表 = {
          免伤: 'block_count',
          免死: 'death_save_count',
        };
        写字段(规则字段表[规则], '次数', 读取原型字段数值(effect, 1));
      } else if (原型 === '决策干扰') {
        const 干扰 = String(effect?.干扰 || '').trim();
        if (干扰 === '判断干扰') 写字段('判断干扰强度', '增量', Math.abs(数值));
        if (干扰 === '索敌干扰') 写字段('索敌干扰强度', '增量', Math.abs(数值));
      } else if (原型 === '资源变化') {
        const 资源 = String(effect?.资源 || '').trim();
        const 持续回合 = Math.max(0, Math.round(Number(effect?.持续回合 || 0)));
        if (资源 === '魂力') {
          hydrated.属性 = 'sp';
          hydrated.资源类型 = '魂力';
          写字段('sp_gain_ratio', '增量');
        } else if (资源 === '精神力') {
          hydrated.属性 = 'men';
          hydrated.资源类型 = '精神力';
          写字段('men_gain_ratio', '增量');
        } else if (资源 === '体力') {
          hydrated.属性 = 'vit';
          hydrated.资源类型 = '体力';
          if (持续回合 > 0) 写字段('vit_gain_ratio', '增量');
          else 写字段('final_heal_bonus', '增量');
        } else if (资源 === '生命') {
          hydrated.属性 = 'hp';
          hydrated.资源类型 = '生命';
          if (持续回合 > 0 && 数值 < 0 && !(读取战斗数值是否百分比(原始数值) || Math.abs(数值) <= 1)) 写字段('dot_damage', '增量', Math.abs(数值));
          else if (持续回合 > 0 && 数值 < 0) 写字段('dot_damage_ratio', '增量', Math.abs(数值));
          else if (持续回合 > 0) 写字段('hot_heal_ratio', '增量');
          else 写字段('final_heal_bonus', '增量');
        }
        if (持续回合 > 0) {
          hydrated.持续回合 = Math.min(10, 持续回合);
          hydrated.运行机制 = '资源持续变化';
          hydrated.状态名称 = `${hydrated.资源类型 || 资源 || '资源'}${数值 >= 0 ? '持续恢复' : '持续流失'}`;
        }
      } else if (原型 === '资源转移') {
        hydrated.运行机制 = '资源转移';
      } else if (原型 === '护盾变化') {
        if (effect?.数值 !== undefined && hydrated.护盾值 === undefined) hydrated.护盾值 = effect.数值;
        写字段('shield_gain_bonus', '增量');
      } else if (原型 === '时窗修正') {
        const 调整方式 = String(effect?.调整方式 || '').trim();
        hydrated.运行机制 = '时窗修正';
        hydrated.运行态调整方式 = 调整方式 === '压缩' ? '压缩' : '延长';
        hydrated.调整字段 = String(effect?.调整字段 || '持续回合').trim() || '持续回合';
        hydrated.单日使用次数上限 = Math.max(1, Math.min(3, Math.floor(Number(effect?.单日使用次数上限 || 1))));
        if (hydrated.调整字段 === '持续回合') {
          hydrated.持续回合 = Math.max(1, Math.min(3, Number(effect?.调整回合 || effect?.持续回合 || 1)));
          hydrated.压缩回合 = Math.max(1, Math.min(3, Number(effect?.调整回合 || 1)));
          if (调整方式 === '压缩' && effect?.结算倍率 !== undefined) {
            const 时窗倍率 = 读取战斗数值正负(effect?.结算倍率);
            hydrated.引爆倍率 = 时窗倍率 || 1;
          }
        } else if (hydrated.调整字段 === '有效期tick') {
          hydrated.调整tick = Math.max(1, Math.min(1008, Number(effect?.调整tick || effect?.有效期tick || 6)));
        } else if (['触发次数', '使用次数', '可用次数'].includes(hydrated.调整字段)) {
          hydrated.调整次数 = Math.max(1, Math.min(3, Number(effect?.调整次数 || 1)));
        } else if (hydrated.调整字段 === '冷却回合') {
          hydrated.调整回合 = Math.max(1, Math.min(3, Number(effect?.调整回合 || 1)));
        }
      } else if (原型 === '时光回溯') {
        hydrated.运行机制 = '时光回溯';
        hydrated.状态名称 = '时光回溯';
        hydrated.持续回合 = 1;
        hydrated.发动方式 = ['主动', '被动'].includes(String(effect?.发动方式 || '').trim()) ? String(effect.发动方式).trim() : '被动';
        hydrated.时光回溯成功率 = 1;
        hydrated.时光回溯反应压制值 = 时光回溯反应压制值;
      } else if (原型 === '位移执行') {
        const 位移 = String(effect?.位移类型 || effect?.位移 || effect?.方向 || effect?.类型 || '').trim();
        const 位移对象 = String(effect?.位移对象 || '').trim();
        const 位移幅度 = Math.max(1, Math.min(30, Number(effect?.距离 || 1)));
        const 位移强度 = Math.max(0.04, Math.min(0.45, Math.abs(数值) || 位移幅度 * 0.04));
        const 近身反击风险 = Math.max(0, Math.min(0.3, (6 - 位移幅度) * 0.05));
        const 写自身位移收益 = () => {
          写字段('dodge_bonus', '增量', 位移强度);
          写字段('reaction_bonus', '增量', 位移强度);
          if (位移 === '脱离') 写字段('random_target_rate', '增量', Math.min(1, 位移强度));
        };
        const 写目标位移压制 = () => {
          if (位移 === '拉近') {
            写字段('hit_bonus', '增量', 位移强度);
            写字段('lock_level', '次数', 1);
            写字段('reaction_penalty', '增量', 位移强度);
            写字段('dodge_penalty', '增量', Math.max(0.04, 位移强度 * 0.5));
          } else if (位移 === '击退') {
            写字段('reaction_penalty', '增量', 位移强度);
            写字段('dodge_penalty', '增量', Math.max(0.04, 位移强度 * 0.5));
            写字段('hit_penalty', '增量', Math.max(0.04, 位移强度 * 0.5));
          } else if (位移 === '换位') {
            写字段('random_target_rate', '增量', Math.min(1, 位移强度));
            写字段('reaction_penalty', '增量', 位移强度);
            写字段('dodge_penalty', '增量', Math.max(0.04, 位移强度 * 0.5));
          }
        };
        if (位移对象 === '自身') {
          写自身位移收益();
        } else if (位移对象 === '目标') {
          写目标位移压制();
        } else if (位移对象 === '自身与目标') {
          写自身位移收益();
          写目标位移压制();
        }
        hydrated.持续回合 = Math.max(1, Math.min(10, Math.round(Number(effect?.持续回合 || 1))));
        hydrated.位移成功率 = 1;
      }
      if (原型 !== '状态施加' && hasMeaningfulCombatEffect(计算层效果)) {
        hydrated.计算层效果 = mergeCombatEffectMaps(hydrated.计算层效果 || createEmptyCombatEffectMap(), 计算层效果);
      }
      delete hydrated.机制;
      delete hydrated.参数;
      return hydrated;
    }

    function hydrateBattleExecutionEffectEntry(effect = {}, context = {}) {
      if (!effect || typeof effect !== 'object' || Array.isArray(effect)) return null;
      const sourceEffect = effect?.原型 ? 编译原型战斗效果(effect, context) : null;
      if (!sourceEffect || typeof sourceEffect !== 'object' || Array.isArray(sourceEffect)) return null;
      const 运行机制 = String(sourceEffect?.原型 || '').trim();
      if (!运行机制 || 运行机制 === '系统基础') return null;
      const targetScale = normalizeBattleEffectTargetScale(sourceEffect?.目标 || effect?.目标 || '单体', '单体');
      const duration = Math.max(0, Math.round(Number(sourceEffect?.持续回合 ?? 0)));
      const hydrated = {
        ...cloneBattleValue(sourceEffect || {}),
        目标: targetScale,
      };
      hydrated.运行时消费器 = String(sourceEffect?.运行时消费器 || 读取战斗原型运行消费器(sourceEffect)).trim();
      if (!String(hydrated.目标 || '').trim()) hydrated.目标 = String(effect?.目标 || targetScale || '').trim();
      delete hydrated.机制;
      delete hydrated.参数;
      if (duration > 0) hydrated.持续回合 = duration;
      return 转换战斗机制运行值(补齐战斗机制英文键(hydrated));
    }

    const 驱动属性中文运行键表 = Object.freeze({
      力量: 'str',
      防御: 'def',
      敏捷: 'agi',
      体力: 'vit',
      体力上限: 'vit_max',
      魂力: 'sp_max',
      魂力上限: 'sp_max',
      精神力: 'men_max',
      精神力上限: 'men_max',
      体力比例: 'vit_ratio',
      生命比例: 'hp_ratio',
      HP比例: 'hp_ratio',
      防御比例: 'def_ratio',
      魂力比例: 'sp_ratio',
      精神力比例: 'men_ratio',
    });

    function 规范驱动属性运行键(attributeKey) {
      const key = String(attributeKey || '').trim();
      return 驱动属性中文运行键表[key] || key;
    }

    function 选择战斗原型默认影响方向(原型 = '', effect = {}, fallback = '效果强度') {
      const 原型名 = String(原型 || '').trim();
      const 结算 = String(effect?.结算 || '').trim();
      const 调整字段 = String(effect?.调整字段 || '').trim();
      let 默认方向 = fallback;
      if (原型名 === '位移执行') 默认方向 = '效果强度';
      else if (原型名 === '复制执行') 默认方向 = '效果强度';
      else if (['判定修正', '状态移除', '决策干扰', '机制抹消', '资源锁定', '规则改写'].includes(原型名)) 默认方向 = '成功率';
      else if (原型名 === '结算修正' && 结算 === '消耗分摊') 默认方向 = '效果强度';
      else if (原型名 === '结算修正' && 结算 === '消耗') 默认方向 = '消耗';
      else if (原型名 === '结算修正' && 结算 === '前摇') 默认方向 = '前摇';
      else if (原型名 === '时窗修正') 默认方向 = ['持续回合', '有效期tick'].includes(调整字段) ? '持续时间' : '效果强度';
      else 默认方向 = '效果强度';
      const 原型定义 = BATTLE_PROTOTYPE_REGISTRY[原型名] || {};
      const 方向选项 = Array.isArray(原型定义?.字段定义?.影响方向?.选项) ? 原型定义.字段定义.影响方向.选项 : [];
      return 方向选项.includes(默认方向) ? 默认方向 : 方向选项[0] || fallback;
    }

    function 战斗原型命中绝对值默认无驱动(effect = {}) {
      if (!effect || typeof effect !== 'object') return false;
      const 数值列表 = ['数值', '结算倍率', '转化比例', '概率'].flatMap(key => {
        const 原值 = effect?.[key];
        if (原值 === undefined || 原值 === null) return [];
        return Array.isArray(原值) ? 原值 : [原值];
      });
      if (!数值列表.length) return false;
      return 数值列表.every(原值 => {
        if (typeof 原值 === 'number') return Number.isFinite(原值);
        const 文本 = String(原值 ?? '').trim();
        return !!文本 && /^[-+]?\d+(?:\.\d+)?%?$/.test(文本) && !/%$/.test(文本);
      });
    }

    function 读取战斗效果数值(value, fallback = 0) {
      const text = String(value ?? '').trim();
      if (!text) return fallback;
      if (/%$/.test(text)) {
        const percent = Number(text.replace('%', ''));
        return Number.isFinite(percent) ? percent / 100 : fallback;
      }
      const num = Number(text);
      return Number.isFinite(num) ? num : fallback;
    }

    function 读取战斗属性倍率(effect = {}) {
      const action = String(effect?.动作 || '').trim();
      const rawValue = effect?.数值;
      const value = 读取战斗效果数值(rawValue, 0);
      if (['倍率提升', '倍率压制'].includes(action)) {
        const num = Number(rawValue);
        if (Number.isFinite(num) && num > 0) return num;
      }
      if (!action || ['倍率提升', '倍率压制'].includes(action)) return Math.max(0, 1 + value);
      return value;
    }

    function 格式化战斗效果数值(value, digits = 2) {
      const num = Number(value || 0);
      if (!Number.isFinite(num)) return String(value ?? '');
      return Number(num.toFixed(digits));
    }

    function 格式化战斗百分比变化(value, digits = 2) {
      const num = Number(value || 0);
      if (!Number.isFinite(num)) return '+0%';
      const percent = Number((num * 100).toFixed(digits));
      return `${percent >= 0 ? '+' : ''}${percent}%`;
    }

    function 缩放战斗属性变化数值(rawValue, factor = 1) {
      const delta = 读取战斗效果数值(rawValue, 0);
      const multiplier = Math.max(0, 1 + delta);
      const scaled = delta < 0 ? scaleBattleDebuffRatio(multiplier, factor, 1) : scaleBattleFactor(multiplier, factor, 1);
      return 格式化战斗百分比变化(scaled - 1);
    }

    function getMechanismDriveValue(entity, finalEntity, attributeKey) {
      const 运行键 = 规范驱动属性运行键(attributeKey);
      const stats = finalEntity || entity || {};
      switch (运行键) {
        case 'men_max':
          return 读取战斗资源上限值(entity, stats, 'men');
        case 'sp_max':
          return 读取战斗资源上限值(entity, stats, 'sp');
        case 'vit_max':
          return 读取战斗资源上限值(entity, stats, 'vit');
        case 'agi':
        case 'str':
        case 'def':
        case 'vit':
          if (运行键 === 'vit') {
            return Math.max(0, Number(entity?.sta ?? stats?.sta ?? entity?.体力 ?? stats?.体力 ?? entity?.vit ?? stats?.vit ?? 0));
          }
          return Number(stats[运行键] || 0);
        case 'vit_ratio':
          return (
            Math.max(0, Number(entity?.sta || stats?.sta || entity?.体力 || stats?.体力 || 0)) /
            Math.max(1, Number(entity?.sta_max || stats?.sta_max || entity?.体力上限 || stats?.体力上限 || 1))
          );
        case 'hp_ratio':
          return (
            Math.max(0, Number(entity?.hp ?? stats?.hp ?? entity?.HP ?? stats?.HP ?? 0)) /
            Math.max(1, Number(entity?.hp_max ?? stats?.hp_max ?? entity?.HP上限 ?? stats?.HP上限 ?? 1))
          );
        case 'def_ratio':
          return Number(stats.def || entity?.def || 0);
        case 'sp_ratio':
          return (
            Math.max(0, Number(entity?.sp || stats?.sp || 0)) /
            Math.max(1, Number(entity?.sp_max || stats?.sp_max || 1))
          );
        case 'men_ratio':
          return (
            Math.max(0, Number(entity?.men || stats?.men || 0)) /
            Math.max(1, Number(entity?.men_max || stats?.men_max || 1))
          );
        default:
          return 0;
      }
    }

    function 计算原型驱动缩放系数(effect = {}, attacker = {}, attackerFinalStat = {}, defender = {}, defenderFinalStat = {}) {
      const 驱动属性 = String(effect?.驱动属性 || '').trim();
      if (!驱动属性) return 1;
      const 运行键 = 规范驱动属性运行键(驱动属性);
      if (运行键 === 'sp_max') {
        if (String(effect?.影响方向 || '').trim() === '消耗') return getSupportCostScale({ ...attacker, ...attackerFinalStat }, { ...defender, ...defenderFinalStat });
        return getSupportEffectScale({ ...attacker, ...attackerFinalStat }, { ...defender, ...defenderFinalStat });
      }
      if (运行键 === 'men_max') return 计算精神机制缩放系数(attacker, attackerFinalStat, defender, defenderFinalStat, 1);
      const 攻方 = Math.max(1, getMechanismDriveValue(attacker, attackerFinalStat, 运行键));
      const 守方 = Math.max(1, getMechanismDriveValue(defender, defenderFinalStat, 运行键));
      const 比值 = 攻方 / 守方;
      if (!Number.isFinite(比值) || 比值 <= 0) return 1;
      return 限制战斗倍率(Math.pow(比值, 0.45), 0.35, 1.85);
    }

    function 缩放原型面板修改比例(面板修改比例 = {}, 缩放系数 = 1) {
      const next = {};
      Object.entries(面板修改比例 || {}).forEach(([key, raw]) => {
        const value = Number(raw);
        if (!Number.isFinite(value)) return;
        next[key] = value >= 1 ? scaleBattleFactor(value, 缩放系数, 1) : scaleBattleDebuffRatio(value, 缩放系数, 1);
      });
      return next;
    }

    function 缩放原型面板固定修正(面板固定修正 = {}, 缩放系数 = 1) {
      const next = {};
      Object.entries(面板固定修正 || {}).forEach(([key, raw]) => {
        const value = Number(raw);
        if (!Number.isFinite(value)) return;
        next[key] = Number((value * 缩放系数).toFixed(4));
      });
      return next;
    }

    const 状态施加默认驱动属性表_战斗 = Object.freeze({
      中毒: '魂力上限',
      流血: '魂力上限',
      灼烧: '魂力上限',
      冻伤: '魂力上限',
      持续创伤: '魂力上限',
      持续恢复: '魂力上限',
      护盾: '魂力上限',
      无视异常: '魂力上限',
      位移限制: '魂力上限',
      麻痹: '魂力上限',
      僵直: '魂力上限',
      迟缓: '魂力上限',
      虚弱: '魂力上限',
      防御剥夺: '魂力上限',
      资源燃烧: '魂力上限',
      魂力枯竭: '魂力上限',
      眩晕: '精神力上限',
      沉默: '精神力上限',
      致盲: '精神力上限',
      封技: '精神力上限',
      混乱: '精神力上限',
      失控: '精神力上限',
      精神紊乱: '精神力上限',
      隐匿: '精神力上限',
      探查屏蔽: '精神力上限',
      共享视野: '精神力上限',
      标记: '精神力上限',
      嘲讽: '精神力上限',
      精神抗性剥夺: '精神力上限',
      禁疗: '精神力上限',
      治疗反转: '精神力上限',
      反噬: '精神力上限',
      霸体: '体力上限',
      护卫: '体力上限',
    });

    function 读取状态施加默认驱动属性_战斗(effect = {}) {
      const 状态名 = String(effect?.状态 || '').trim();
      return 状态施加默认驱动属性表_战斗[状态名] || '魂力上限';
    }

    function 缩放状态施加计算层效果(计算层效果 = {}, hydrated = {}, 缩放系数 = 1) {
      const ratio = Number(缩放系数 || 1);
      if (!Number.isFinite(ratio) || Math.abs(ratio - 1) < 0.0001) return;
      const 正向数值字段 = [
        'dot_damage',
        'dot_damage_ratio',
        'hot_heal_ratio',
        'reaction_penalty',
        'hit_penalty',
        'dodge_penalty',
        'cast_speed_penalty',
        'random_target_rate',
        'shield_gain_bonus',
        'damage_reduction',
        'heal_block_ratio',
        'heal_inversion_ratio',
        'defense_strip',
        'spirit_resist_strip',
        'misfortune_backlash_ratio',
        'reaction_bonus',
        'hit_bonus',
        'dodge_bonus',
        'cast_speed_bonus',
        'interrupt_bonus',
      ];
      正向数值字段.forEach(key => {
        if (计算层效果[key] !== undefined) 计算层效果[key] = scaleBattleValue(计算层效果[key], ratio, { min: 0, digits: 4 });
      });
      ['sp_gain_ratio', 'men_gain_ratio', 'vit_gain_ratio'].forEach(key => {
        if (计算层效果[key] !== undefined) 计算层效果[key] = scaleBattleValue(计算层效果[key], ratio, { digits: 4 });
      });
      if (计算层效果.lock_level !== undefined) 计算层效果.lock_level = scaleBattleLockLevel(计算层效果.lock_level, ratio);
      ['received_damage_mult', 'final_damage_mult', 'final_heal_mult', 'shield_gain_mult'].forEach(key => {
        if (计算层效果[key] === undefined) return;
        const value = Number(计算层效果[key]);
        if (!Number.isFinite(value)) return;
        计算层效果[key] = value >= 1
          ? scaleBattleFactor(value, ratio, 1)
          : scaleBattleDebuffRatio(value, ratio, 1);
      });
      if (hydrated.面板修改比例) hydrated.面板修改比例 = 缩放原型面板修改比例(hydrated.面板修改比例, ratio);
      if (hydrated.面板固定修正) hydrated.面板固定修正 = 缩放原型面板固定修正(hydrated.面板固定修正, ratio);

      const 有数值强度 = 正向数值字段.some(key => Number(计算层效果[key] || 0) !== 0) ||
        ['sp_gain_ratio', 'men_gain_ratio', 'vit_gain_ratio'].some(key => Number(计算层效果[key] || 0) !== 0) ||
        Number(计算层效果.lock_level || 0) > 0 ||
        ['received_damage_mult', 'final_damage_mult', 'final_heal_mult', 'shield_gain_mult'].some(key => Math.abs(Number(计算层效果[key] || 1) - 1) > 0.0001);
      const 是布尔状态 = [
        计算层效果.skip_turn,
        计算层效果.cannot_react,
        计算层效果.silence,
        计算层效果.blind,
        计算层效果.skill_seal,
        计算层效果.super_armor,
        计算层效果.invincible,
        计算层效果.无视异常,
        计算层效果.探查屏蔽,
        Number(计算层效果.stealth_level || 0) > 0,
      ].some(Boolean);
      if (!有数值强度 && 是布尔状态 && hydrated.持续回合 !== undefined) {
        const 原持续 = Math.max(1, Math.round(Number(hydrated.持续回合 || 1)));
        let 下一持续 = Math.max(1, Math.round(原持续 * ratio));
        const 是群体硬控 = ['群体', '全场'].includes(String(hydrated.目标 || '').trim()) &&
          (计算层效果.skip_turn === true ||
            计算层效果.cannot_react === true ||
            计算层效果.silence === true ||
            计算层效果.blind === true ||
            计算层效果.skill_seal === true);
        if (是群体硬控) 下一持续 = Math.min(1, 下一持续);
        hydrated.持续回合 = 下一持续;
      }
    }

    function 原型驱动缩放(effect = {}, directPayload = {}, hydrated = {}, attacker = {}, attackerFinalStat = {}, defender = {}, defenderFinalStat = {}) {
      const 影响方向 = String(effect?.影响方向 || '').trim();
      if (!String(effect?.驱动属性 || '').trim() || !影响方向) return;
      const 缩放系数 = 计算原型驱动缩放系数(effect, attacker, attackerFinalStat, defender, defenderFinalStat);
      if (!Number.isFinite(缩放系数) || Math.abs(缩放系数 - 1) < 0.0001) return;
      if (影响方向 === '效果强度') {
        if (String(effect?.原型 || '').trim() === '状态施加') {
          缩放状态施加计算层效果(directPayload, hydrated, 缩放系数);
          return;
        }
        const scaled = scaleBattleSupportBuffCalc(directPayload, 缩放系数);
        Object.keys(directPayload).forEach(key => delete directPayload[key]);
        Object.assign(directPayload, scaled);
        if (directPayload.面板修改比例) directPayload.面板修改比例 = 缩放原型面板修改比例(directPayload.面板修改比例, 缩放系数);
        if (directPayload.面板固定修正) directPayload.面板固定修正 = 缩放原型面板固定修正(directPayload.面板固定修正, 缩放系数);
        if (hydrated.威力倍率 !== undefined && !(读取对应等级(hydrated) > 0)) hydrated.威力倍率 = scaleBattleValue(hydrated.威力倍率, 缩放系数, { min: 0, digits: 2 });
        if (hydrated.防御穿透 !== undefined) hydrated.防御穿透 = scaleBattleValue(hydrated.防御穿透, 缩放系数, { min: 0, max: 100, digits: 0 });
        if (String(effect?.原型 || '').trim() === '资源锁定' && hydrated.数值 !== undefined) {
          const 原比例 = Math.abs(读取战斗数值正负(hydrated.数值));
          if (原比例 > 0) hydrated.数值 = `${Math.round(Math.min(1, 原比例 * 缩放系数) * 100)}%`;
        }
        if (hydrated.时光回溯反应压制值 !== undefined)
          hydrated.时光回溯反应压制值 = scaleBattleValue(hydrated.时光回溯反应压制值, 缩放系数, { min: 0.05, max: 0.85, digits: 4 });
        return;
      }
      if (影响方向 === '成功率') {
        ['interrupt_bonus', 'random_target_rate'].forEach(key => {
          if (directPayload[key] !== undefined) directPayload[key] = scaleBattleValue(directPayload[key], 缩放系数, { min: 0, digits: 4 });
        });
        if (directPayload.lock_level !== undefined) directPayload.lock_level = scaleBattleLockLevel(directPayload.lock_level, 缩放系数);
        if (directPayload.hit_bonus === undefined) directPayload.hit_bonus = Math.max(0, Number((缩放系数 - 1).toFixed(4)));
        if (hydrated.时光回溯成功率 !== undefined) hydrated.时光回溯成功率 = scaleBattleValue(hydrated.时光回溯成功率, 缩放系数, { min: 0, max: 1, digits: 4 });
        if (hydrated.位移成功率 !== undefined) hydrated.位移成功率 = scaleBattleValue(hydrated.位移成功率, 缩放系数, { min: 0, max: 1, digits: 4 });
        return;
      }
      if (影响方向 === '持续时间') {
        if (hydrated.持续回合 !== undefined) hydrated.持续回合 = Math.max(1, Math.round(Number(hydrated.持续回合 || 1) * 缩放系数));
        if (hydrated.持续tick !== undefined) hydrated.持续tick = Math.max(1, Math.round(Number(hydrated.持续tick || 1) * 缩放系数));
        return;
      }
      if (影响方向 === '消耗') {
        directPayload.cost_ratio = Math.max(Number(directPayload.cost_ratio || 1), 缩放系数);
        return;
      }
      if (影响方向 === '前摇') {
        directPayload.windup_ratio = Math.max(0.25, Number(directPayload.windup_ratio || 1) * 缩放系数);
      }
    }

    function 应用战斗原型驱动判定(effect = {}, context = {}) {
      if (!effect || typeof effect !== 'object' || Array.isArray(effect)) return effect;
      if (String(effect?.原型 || '').trim() === '伤害结算') return effect;
      const 原型名 = String(effect?.原型 || '').trim();
      if (当前效果来自物品使用(context) && 读取对应等级(effect) > 0) return effect;
      if (原型名 === '复制执行' && !/属性|全部/.test(String(effect?.复制类型 || '').trim())) return effect;
      if (!['机制授予', '时光回溯', '位移执行', '复制执行'].includes(原型名) && String(effect?.目标 || '').trim() === '自身') return effect;
      if (战斗原型命中绝对值默认无驱动(effect)) return effect;
      const 原型定义 = BATTLE_PROTOTYPE_REGISTRY[原型名] || {};
      const 字段列表 = Array.isArray(原型定义?.允许字段) ? 原型定义.允许字段 : [];
      if (字段列表.includes('驱动属性') && 字段列表.includes('影响方向')) {
        if (Object.prototype.hasOwnProperty.call(effect, '驱动属性') && String(effect?.驱动属性 || '').trim() === '无') return effect;
        if (!String(effect?.驱动属性 || '').trim() || !String(effect?.影响方向 || '').trim()) {
          if (原型名 === '复制执行' && !/属性|全部/.test(String(effect?.复制类型 || '').trim())) return effect;
          const 结果 = cloneBattleValue(effect);
          结果.驱动属性 = 原型名 === '状态施加'
            ? 读取状态施加默认驱动属性_战斗(结果)
            : 原型名 === '状态移除' || 原型名 === '时光回溯' || 原型名 === '复制执行'
              ? '精神力上限'
              : '魂力上限';
          const 方向选项 = Array.isArray(原型定义?.字段定义?.影响方向?.选项) ? 原型定义.字段定义.影响方向.选项 : [];
          结果.影响方向 = 选择战斗原型默认影响方向(原型名, 结果, 方向选项[0] || '效果强度');
          effect = 结果;
        }
      }
      if (!String(effect?.驱动属性 || '').trim() || !String(effect?.影响方向 || '').trim()) return effect;
      const 攻方 = context?.造物产出者属性 || context?.actor || context?.caster || context?.attacker;
      const 守方 = context?.target || context?.defender;
      if (!攻方 || typeof 攻方 !== 'object' || !守方 || typeof 守方 !== 'object') return effect;
      const 结果 = cloneBattleValue(effect);
      const 计算层效果 = 结果.计算层效果 && typeof 结果.计算层效果 === 'object'
        ? cloneBattleValue(结果.计算层效果)
        : {};
      const 攻方终值 = context?.造物产出者属性
        ? 攻方
        : context?.attackerFinalStat || 攻方.final || BATTLE_RUNTIME.buildCombatFinalStats(攻方);
      原型驱动缩放(
        结果,
        计算层效果,
        结果,
        攻方,
        攻方终值,
        守方,
        context?.defenderFinalStat || 守方.final || BATTLE_RUNTIME.buildCombatFinalStats(守方),
      );
      if (Object.keys(计算层效果).length) 结果.计算层效果 = 计算层效果;
      return 结果;
    }

    function mergeRuntimePayloadToState(payload, pState) {
      if (!payload || typeof payload !== 'object') return;
      const calc = pState.计算层效果 || (pState.计算层效果 = createEmptyCombatEffectMap());
      const stateMods = pState.面板修改比例 || (pState.面板修改比例 = {});
      const statMods = payload.面板修改比例 || payload.面板修改 || {};
      const stateDeltas = pState.面板固定修正 || (pState.面板固定修正 = {});
      const statDeltas = payload.面板固定修正 || payload.面板固定 || {};
      ['str', 'def', 'agi', 'vit_max', 'men_max', 'sp_max'].forEach(k => {
        if (statMods[k] !== undefined) stateMods[k] = statMods[k];
        if (statDeltas[k] !== undefined) stateDeltas[k] = Number(stateDeltas[k] || 0) + Number(statDeltas[k] || 0);
      });
      [
        'skip_turn',
        'cannot_react',
        'dot_damage',
        'dot_damage_ratio',
        'silence',
        'disarm',
        'blind',
        'invincible',
        'skill_seal',
        '探查屏蔽',
        'counter_attack_ratio',
        'damage_reflect_ratio',
        'damage_transfer_ratio',
        'damage_transfer_target',
        'damage_absorb_ratio',
        '吸收来源',
        '吸收资源',
        '吸收转化效果',
        '伤害吸收增幅上限',
        'damage_share_ratio',
        'cost_share_ratio',
        'damage_reduction',
        'block_count',
        'super_armor',
        'death_save_count',
        'revive_count',
        'revive_heal_ratio',
        'armor_pen',
        'reaction_bonus',
        'reaction_penalty',
        'attacker_speed_bonus',
        'cast_speed_bonus',
        'cast_speed_penalty',
        'hit_bonus',
        'hit_penalty',
        'dodge_bonus',
        'dodge_penalty',
        'lock_level',
        'interrupt_bonus',
        'final_damage_mult',
        'received_damage_mult',
        'defense_strip',
        'spirit_resist_strip',
        'final_damage_bonus',
        'final_heal_mult',
        'final_heal_bonus',
        'shield_gain_mult',
        'shield_gain_bonus',
        'skill_effect_mult',
        'vit_gain_ratio',
        'sp_gain_ratio',
        'men_gain_ratio',
        'heal_block_ratio',
        'cost_ratio',
        'cost_delta',
        'cost_delta_ratio',
        'windup_ratio',
        'windup_delta',
        'random_target_rate',
        'heal_inversion_ratio',
        'stealth_level',
        'min_hp_floor',
        'hot_heal_ratio',
        'damage_share_count',
        'cost_share_count',
        'invincible_tier_threshold',
        '每日触发次数上限',
        'bonus_true_damage_ratio',
        'element_seal_ratio',
        'misfortune_check_rate',
        'misfortune_backlash_ratio',
        '判断干扰强度',
        '索敌干扰强度',
        'action_lock_rounds',
        'interrupt_window',
        'multi_hit_count',
        'segment_damage_ratio',
      ].forEach(k => {
        if (payload[k] !== undefined) calc[k] = payload[k];
      });
    }

    function 限制战斗倍率(数值 = 1, 下限 = 0.05, 上限 = 1.8) {
      const 数值结果 = Number(数值);
      if (!Number.isFinite(数值结果)) return 1;
      return Math.max(下限, Math.min(上限, 数值结果));
    }

    function 读取战斗资源当前值(单位 = {}, 最终属性 = {}, 资源键 = 'sp') {
      const 属性 = 单位?.属性 && typeof 单位.属性 === 'object' ? 单位.属性 : {};
      const 当前字段 = 资源键 === 'men'
        ? ['men', '精神力']
        : 资源键 === 'vit'
          ? ['vit', 'sta', '体力']
          : ['sp', '魂力'];
      for (const 字段 of 当前字段) {
        const 候选 = 最终属性?.[字段] ?? 单位?.[字段] ?? 属性?.[字段];
        const 数值 = Number(候选);
        if (Number.isFinite(数值)) return Math.max(0, 数值);
      }
      return 0;
    }

    function 读取战斗资源上限值(单位 = {}, 最终属性 = {}, 资源键 = 'sp') {
      const 属性 = 单位?.属性 && typeof 单位.属性 === 'object' ? 单位.属性 : {};
      const 上限字段 = 资源键 === 'men'
        ? ['men_max', '精神力上限']
        : 资源键 === 'vit'
          ? ['vit_max', 'sta_max', '体力上限']
          : ['sp_max', '魂力上限'];
      for (const 字段 of 上限字段) {
        const 候选 = 最终属性?.[字段] ?? 单位?.[字段] ?? 属性?.[字段];
        const 数值 = Number(候选);
        if (Number.isFinite(数值) && 数值 > 0) return 数值;
      }
      return 1;
    }

    function 计算当前资源压制倍率(攻击方 = {}, 攻击方最终 = {}, 防御方 = {}, 防御方最终 = {}, 资源键 = 'sp', 选项 = {}) {
      const 攻方当前 = 读取战斗资源当前值(攻击方, 攻击方最终, 资源键);
      const 守方当前 = 读取战斗资源当前值(防御方, 防御方最终, 资源键);
      const 攻方上限 = 读取战斗资源上限值(攻击方, 攻击方最终, 资源键);
      const 攻方比例 = Math.max(0, Math.min(1, 攻方当前 / Math.max(1, 攻方上限)));
      const 当前压制 = 攻方当前 / Math.max(1, 守方当前);
      const 当前柔化 = Math.pow(Math.max(0.01, 当前压制), Number(选项.压制指数 || 0.45));
      const 余量修正 = 0.45 + 0.55 * 攻方比例;
      const 下限 = Number(选项.下限 ?? 0.35);
      const 上限 = Number(选项.上限 ?? 1.85);
      return 限制战斗倍率(当前柔化 * 余量修正, 下限, 上限);
    }

    function 计算魂力机制缩放系数(攻击方 = {}, 攻击方最终 = {}, 防御方 = {}, 防御方最终 = {}, 基础 = 1, 选项 = {}) {
      return 限制战斗倍率(
        Number(基础 || 1) * 计算当前资源压制倍率(攻击方, 攻击方最终, 防御方, 防御方最终, 'sp', 选项),
        Number(选项.下限 ?? 0.35),
        Number(选项.上限 ?? 1.85),
      );
    }

    function 计算精神机制缩放系数(攻击方 = {}, 攻击方最终 = {}, 防御方 = {}, 防御方最终 = {}, 基础 = 1, 选项 = {}) {
      const 临时掌控 = 限制战斗倍率(Number(攻击方最终?.mastery_ratio || 攻击方?.mastery_ratio || 1), 0.85, 1.15);
      return 限制战斗倍率(
        Number(基础 || 1) * 计算当前资源压制倍率(攻击方, 攻击方最终, 防御方, 防御方最终, 'men', 选项) * 临时掌控,
        Number(选项.下限 ?? 0.2),
        Number(选项.上限 ?? 1.8),
      );
    }

    function 计算规则机制缩放系数(攻击方 = {}, 攻击方最终 = {}, 防御方 = {}, 防御方最终 = {}, 基础 = 1) {
      return 计算精神机制缩放系数(攻击方, 攻击方最终, 防御方, 防御方最终, 基础, {
        下限: 0.2,
        上限: 1.8,
        压制指数: 0.42,
      });
    }

    function 计算精神伤害攻势值(单位 = {}, 最终属性 = {}) {
      const 当前精神力 = 读取战斗资源当前值(单位, 最终属性, 'men');
      const 精神上限 = 读取战斗资源上限值(单位, 最终属性, 'men');
      return Math.max(当前精神力, 精神上限 * 0.25);
    }

    function 计算物理伤害攻势值(单位 = {}, 最终属性 = {}, 伤害类型 = '') {
      const 力量 = Math.max(1, Number(最终属性?.str || 单位?.str || 1));
      if (规范化战斗伤害类型(伤害类型) !== '远程攻击') return 力量;
      const 敏捷折算 = Math.max(0, Number(最终属性?.agi || 单位?.agi || 0)) * 0.55;
      return Math.max(1, 力量 * 0.9, 敏捷折算);
    }

    const 战斗伤害类型列表 = Object.freeze(['近身攻击', '远程攻击', '精神攻击', '真实攻击']);

    function 规范化战斗伤害类型(伤害类型 = '', 技能 = {}) {
      const 文本 = String(伤害类型 || '').trim();
      if (战斗伤害类型列表.includes(文本)) return 文本;
      const 技能文本 = `${文本} ${技能?.name || ''} ${技能?.魂技名 || ''} ${技能?.技能名称 || ''} ${技能?.效果描述 || ''}`;
      if (/真实|规则|法则|无视|穿透本源|毁灭|时光/.test(技能文本)) return '真实攻击';
      if (/精神|识海|幻境|灵魂|眩晕|混乱|封技|恐惧/.test(技能文本)) return '精神攻击';
      if (/远程|射线|光束|飞刃|投掷|炮|波|箭|弹|雷|电|冰|火|光|暗|星|空间|元素|爆炸/.test(技能文本)) return '远程攻击';
      return '近身攻击';
    }

    function 读取战斗伤害类型绑定(伤害类型 = '', 技能 = {}) {
      const 类型 = 规范化战斗伤害类型(伤害类型, 技能);
      return {
        伤害类型: 类型,
        结算标签: 类型 === '真实攻击' ? '真实伤害' : '标准伤害',
        抗性类型: 类型 === '真实攻击' ? '真实无视' : 类型 === '精神攻击' ? '精神抗性' : 类型 === '远程攻击' ? '元素抗性' : '物理抗性',
      };
    }

    const 战斗伤害是近身攻击 = 伤害类型 => 规范化战斗伤害类型(伤害类型) === '近身攻击';
    const 战斗伤害是远程攻击 = 伤害类型 => 规范化战斗伤害类型(伤害类型) === '远程攻击';
    const 战斗伤害是精神攻击 = 伤害类型 => 规范化战斗伤害类型(伤害类型) === '精神攻击';
    const 战斗伤害是真实攻击 = 伤害类型 => 规范化战斗伤害类型(伤害类型) === '真实攻击';

    const 紫极魔瞳防守境界集合_战斗 = new Set(['芥子', '浩瀚']);

    function 读取战斗单位功法表_战斗(单位 = {}) {
      if (单位?.功法 && typeof 单位.功法 === 'object' && !Array.isArray(单位.功法)) return 单位.功法;
      if (单位?.角色数据?.功法 && typeof 单位.角色数据.功法 === 'object' && !Array.isArray(单位.角色数据.功法)) return 单位.角色数据.功法;
      if (单位?.raw?.功法 && typeof 单位.raw.功法 === 'object' && !Array.isArray(单位.raw.功法)) return 单位.raw.功法;
      const 角色名 = String(单位?.name || 单位?.名称 || '').trim();
      if (!角色名) return {};
      const 功法表 = window.BattleUIBridge?.getMVU?.(`char.${角色名}.功法`);
      return 功法表 && typeof 功法表 === 'object' && !Array.isArray(功法表) ? 功法表 : {};
    }

    function 掌握唐门功法_战斗(单位 = {}, 功法名 = '') {
      const 名称 = String(功法名 || '').trim();
      return !!名称 && !!读取战斗单位功法表_战斗(单位)[名称];
    }

    function 读取功法记录_战斗(单位 = {}, 功法名 = '') {
      const 名称 = String(功法名 || '').trim();
      const 记录 = 读取战斗单位功法表_战斗(单位)[名称];
      return 记录 && typeof 记录 === 'object' && !Array.isArray(记录) ? 记录 : {};
    }

    function 判断精神力驱动攻击_战斗(效果 = {}, 技能 = {}) {
      const 文本 = [
        效果?.伤害类型,
        效果?.驱动属性,
        效果?.状态,
        效果?.结算,
        技能?.魂技名,
        技能?.name,
        技能?.效果描述,
      ].map(值 => String(值 || '').trim()).join('|');
      return /精神攻击|精神力|精神控制|精神压制|识海|幻境|眩晕|混乱|封技|恐惧/.test(文本);
    }

    function 计算紫极魔瞳防守精神攻势值_战斗(单位 = {}, 最终属性 = {}, 效果 = {}, 技能 = {}) {
      const 基础 = 计算精神伤害攻势值(单位, 最终属性);
      const 记录 = 读取功法记录_战斗(单位, '紫极魔瞳');
      return 紫极魔瞳防守境界集合_战斗.has(String(记录.境界 || '').trim()) && 判断精神力驱动攻击_战斗(效果, 技能)
        ? 基础 * 1.3
        : 基础;
    }

    function 读取对应等级(effect = {}) {
      const 等级 = Math.round(Number(effect?.对应等级 || 0));
      if (!Number.isFinite(等级) || 等级 <= 0) return 0;
      return Math.max(1, Math.min(180, 等级));
    }

    function 当前效果来自物品使用(context = {}) {
      return !!String(context?.skill?.__物品名 || context?.action?.物品名 || context?.action?.skill?.__物品名 || '').trim();
    }

    function 读取物品非伤害效果目标(effect = {}, context = {}) {
      const 目标 = String(effect?.目标 || '').trim();
      if (!目标 || /自身|召唤物/.test(目标)) return context?.actor || context?.caster || context?.attacker || {};
      return context?.target || context?.defender || {};
    }

    function 读取物品效果目标等级(目标 = {}) {
      const 候选列表 = [
        目标?.final?.lv,
        目标?.lv,
        目标?.等级,
        目标?.对标等级,
        目标?.属性?.对标等级,
        目标?.属性?.等级,
      ];
      for (const 候选 of 候选列表) {
        const 等级 = Number(候选);
        if (Number.isFinite(等级)) return 等级;
      }
      const 文本 = [目标?.境界, 目标?.属性?.境界, 目标?.战力对标, 目标?.属性?.战力对标, 目标?.称号, 目标?.属性?.称号]
        .map(value => String(value || '').trim())
        .filter(Boolean)
        .join(' ');
      if (/准神/.test(文本)) return 99.5;
      if (/神级|百级|真神|一级神|二级神|三级神/.test(文本)) return 100;
      return 0;
    }

    function 物品非伤害效果超过对应等级(effect = {}, context = {}) {
      if (!当前效果来自物品使用(context)) return false;
      if (!effect || typeof effect !== 'object' || Array.isArray(effect)) return false;
      if (String(effect?.原型 || '').trim() === '伤害结算') return false;
      const 等级 = 读取对应等级(effect);
      if (!(等级 > 0)) return false;
      return 读取物品效果目标等级(读取物品非伤害效果目标(effect, context)) > 等级;
    }

    function 构建对应等级数据(effect = {}) {
      const 等级 = 读取对应等级(effect);
      if (!(等级 > 0)) return null;
      const 读取基础属性 = typeof root.__LWCS_GET_BASE_STATS__ === 'function' ? root.__LWCS_GET_BASE_STATS__ : null;
      if (!读取基础属性) return null;
      const 基础属性 = 读取基础属性(等级) || {};
      const 最终属性 = {
        level: 等级,
        等级,
        str: Math.max(1, Number(基础属性.str || 1)),
        def: Math.max(1, Number(基础属性.def || 1)),
        agi: Math.max(1, Number(基础属性.agi || 1)),
        vit_max: Math.max(1, Number(基础属性.vit_max || 1)),
        sp_max: Math.max(0, Number(基础属性.sp_max || 0)),
        men_max: Math.max(1, Number(基础属性.men_max || 1)),
      };
      const 单位 = {
        name: `对应等级${等级}级`,
        level: 等级,
        等级,
        str: 最终属性.str,
        def: 最终属性.def,
        agi: 最终属性.agi,
        vit: 最终属性.vit_max,
        vit_max: 最终属性.vit_max,
        sp: 最终属性.sp_max,
        sp_max: 最终属性.sp_max,
        men: 最终属性.men_max,
        men_max: 最终属性.men_max,
        final: 最终属性,
      };
      return { 等级, 单位, 最终属性 };
    }

    function 读取技能启动消耗(skill = {}) {
      const rawCost = normalizeSkillData(skill).消耗 || getSkillCostText(skill);
      if (rawCost && typeof rawCost === 'object' && !Array.isArray(rawCost)) {
        return formatCostObjectToString(rawCost.启动 || rawCost.upfront || rawCost);
      }
      return String(rawCost || '无').split(/\s+维持[:：]/)[0].trim() || '无';
    }

    function 读取技能魂环位_战斗(skill = {}, 攻击方 = {}) {
      const 路径 = Array.isArray(skill?.__魂环路径) ? skill.__魂环路径 : [];
      const 命中 = 路径.map(项 => String(项 || '').match(/第(\d+)魂环/)).find(Boolean);
      if (命中) return Math.max(1, Math.floor(Number(命中[1] || 1)));
      const 名称 = String(skill?.魂技名 || skill?.name || '').trim();
      const 名称命中 = 名称.match(/第(\d+)魂技/);
      if (名称命中) return Math.max(1, Math.floor(Number(名称命中[1] || 1)));
      return Math.max(1, Math.min(9, Math.ceil(Math.max(1, Number(攻击方?.等级 || 攻击方?.level || 1)) / 10)));
    }

    function 读取战斗伤害固定百分比消耗(skill = {}, 攻击方 = {}) {
      const effects = getSkillEffects(skill, { actor: 攻击方, caster: 攻击方, attacker: 攻击方, 主原型成立: true, hit: true, 命中: true });
      if (!effects.some(effect => String(effect?.原型 || '').trim() === '伤害结算')) return 0;
      const 魂环位 = 读取技能魂环位_战斗(skill, 攻击方);
      if (魂环位 === 7) return 0;
      return Math.max(0, Math.min(0.27, 魂环位 * 0.03));
    }

    function 普通魂技含非法百分比消耗(action = {}, skill = {}, 攻击方 = {}) {
      if (!skill || typeof skill !== 'object') return false;
      const 动作类型 = String(action?.action_type || action?.type || '').trim();
      if (动作类型 !== '释放魂技') return false;
      const 明确魂技来源 =
        !!String(action?.category || action?.source_detail || action?.来源类别 || action?.来源明细 || '').trim() ||
        !!String(skill?.__战斗来源类别 || skill?.__战斗来源明细 || skill?.__魂技槽位 || '').trim() ||
        (Array.isArray(skill?.__魂环路径) && skill.__魂环路径.length > 0);
      if (!明确魂技来源) return false;
      const 来源类别 = 读取战斗动作来源上下文(action, skill, getBattleSkillSourceCategory(skill)).来源类别;
      if (!['魂技', '自创魂技'].includes(来源类别)) return false;
      if (来源类别 === '魂技' && 读取技能魂环位_战斗(skill, 攻击方) === 7) return false;
      const 标识 = [
        action?.action_type,
        action?.type,
        skill?.name,
        skill?.魂技名,
        读取战斗来源类别上下文(skill, 来源类别).来源明细,
      ].map(value => String(value || '').trim()).filter(Boolean).join(' ');
      if (/武魂融合技|武魂真身|真身/.test(标识)) return false;
      const 启动消耗 = 读取技能启动消耗(skill);
      return /%/.test(String(启动消耗 || ''));
    }

    function 检查普通魂技百分比启动消耗(skill = {}, 攻击方 = {}, action = {}) {
      if (!普通魂技含非法百分比消耗({ action_type: '释放魂技', ...action }, skill, 攻击方)) {
        return { 可用: true, 原因: '' };
      }
      return {
        可用: false,
        原因: '普通魂技启动消耗仍为百分比，请先重新生成固定数值消耗',
      };
    }

    function 计算伤害消耗加成系数(skill = {}, 攻击方 = {}) {
      const 承载消耗文本 = String(skill?.__维持释放伤害承载消耗 || '').trim();
      const 消耗 = parseSkillCostForChar({ ...skill, 消耗: 读取技能启动消耗(skill) }, 攻击方, {
        actor: 攻击方,
        caster: 攻击方,
        attacker: 攻击方,
        skill,
        当前行动: String(skill?.name || skill?.魂技名 || '释放魂技').trim(),
      });
      if (承载消耗文本) {
        const 维持消耗 = parseSkillCostForChar({ ...skill, 消耗: 承载消耗文本 }, 攻击方, {
          actor: 攻击方,
          caster: 攻击方,
          attacker: 攻击方,
          skill,
          当前行动: String(skill?.name || skill?.魂技名 || '维持释放').trim(),
        });
        消耗.reqSp = 维持消耗.reqSp;
        消耗.reqVit = 维持消耗.reqVit;
        消耗.reqMen = 维持消耗.reqMen;
      }
      const 魂力比例 = Math.max(0, Number(消耗.reqSp || 0)) / Math.max(1, 读取战斗资源上限值(攻击方, 攻击方.final || {}, 'sp'));
      const 体力比例 = Math.max(0, Number(消耗.reqVit || 0)) / Math.max(1, 读取战斗资源上限值(攻击方, 攻击方.final || {}, 'vit'));
      const 精神比例 = Math.max(0, Number(消耗.reqMen || 0)) / Math.max(1, 读取战斗资源上限值(攻击方, 攻击方.final || {}, 'men'));
      const 承载比例 = 魂力比例 + 体力比例 + 精神比例;
      const 固定比例 = 读取战斗伤害固定百分比消耗(skill, 攻击方);
      if (!(固定比例 > 0) || 承载比例 <= 固定比例) return 1;
      return Number((承载比例 / 固定比例).toFixed(4));
    }

    const BATTLE_MECHANISM_CONSUMERS = Object.freeze({
      stealth(ctx) {
        ctx.directPayload.stealth_level = Number(ctx.effect.隐蔽度 || ctx.effect.stealth_level || 0);
        ctx.directPayload.dodge_bonus = Number(ctx.effect.dodge_bonus || 0);
        ctx.directPayload.reaction_bonus = Number(ctx.effect.reaction_bonus || 0);
        ctx.ensureStateShell(ctx.effect?.状态名称 || '隐身', ['隐身']);
      },
      reveal(ctx) {
        ctx.directPayload.hit_bonus = Number(ctx.effect.hit_bonus || 0);
        ctx.directPayload.lock_level = Number(ctx.effect.lock_level || 0);
        ctx.ensureStateShell(ctx.effect?.状态名称 || '破隐', ['破隐']);
      },
      disarm(ctx) {
        ctx.directPayload.disarm = true;
        ctx.ensureStateShell('缴械', ['缴械']);
      },
      silence(ctx) {
        ctx.directPayload.silence = true;
        ctx.ensureStateShell('沉默', ['沉默']);
      },
      slow(ctx) {
        ctx.directPayload.面板修改比例 = { agi: ctx.effect.agi_ratio || 0.8 };
        ctx.ensureStateShell('减速', ['减速']);
      },
      blind(ctx) {
        ctx.directPayload.blind = true;
        ctx.ensureStateShell('致盲', ['致盲']);
      },
      mechanism_suppress(ctx) {
        const state = ctx.state || {};
        const 缩放 = 计算规则机制缩放系数(ctx.attacker, ctx.attackerFinalStat, ctx.defender, ctx.defenderFinalStat, 1);
        const 抹消对象 = 规范化战斗机制抹消对象(ctx.effect?.抹消对象);
        state.抹消规则 = [{ 抹消对象, 持续回合: Math.max(1, Number(ctx.effect?.持续回合 || 1)) }];
        ctx.ensureStateShell(ctx.effect?.状态名称 || '机制抹消', ['机制抹消']);
        if (!(Number(state.持续回合 || 0) > 0)) state.持续回合 = Math.max(1, Number(ctx.effect?.持续回合 || 1));
        if (Number(state.持续回合 || 0) > 0) state.持续回合 = Math.max(1, Math.round(Number(state.持续回合 || 1) * 缩放));
      },
      power_amplify(ctx) {
        const 缩放 = 计算魂力机制缩放系数(ctx.attacker, ctx.attackerFinalStat, ctx.defender, ctx.defenderFinalStat, 1, {
          下限: 0.45,
          上限: 1.65,
          压制指数: 0.38,
        });
        const 基础倍率 = Number(ctx.effect?.威力倍率 || ctx.effect?.final_damage_mult || 1.15);
        ctx.directPayload.final_damage_mult = Number((1 + (基础倍率 - 1) * 缩放).toFixed(4));
        ctx.ensureStateShell(ctx.effect?.状态名称 || '威力增幅', ['威力增幅']);
      },
      element_seal(ctx) {
        const 缩放 = 计算规则机制缩放系数(ctx.attacker, ctx.attackerFinalStat, ctx.defender, ctx.defenderFinalStat, 1);
        const 比例 = Math.max(0, Math.min(1, Number(ctx.effect?.封禁强度 || ctx.effect?.element_seal_ratio || 0.3) * 缩放));
        ctx.directPayload.element_seal_ratio = 比例;
        ctx.directPayload.final_damage_mult = Number(ctx.effect?.final_damage_mult || Math.max(0.2, 1 - 比例));
        ctx.directPayload.cost_ratio = Number(ctx.effect?.cost_ratio || 1 + 比例 * 0.8);
        ctx.directPayload.windup_ratio = Number(ctx.effect?.windup_ratio || 1 + 比例 * 0.6);
        ctx.ensureStateShell(ctx.effect?.状态名称 || '元素封禁', ['元素封禁']);
      },
      rule_rewrite(ctx) {
        ctx.directPayload.__规则改写已转运行态 = true;
      },
      luck_interference(ctx) {
        const 缩放 = 计算规则机制缩放系数(ctx.attacker, ctx.attackerFinalStat, ctx.defender, ctx.defenderFinalStat, 1);
        ctx.directPayload.判断干扰强度 = Number((Math.abs(读取战斗数值正负(ctx.effect?.数值 || '+10%')) * 缩放).toFixed(4));
        ctx.ensureStateShell(ctx.effect?.状态名称 || '气运干涉', ['气运干涉']);
      },
      time_rewind(ctx) {
        原型驱动缩放(ctx.effect, {}, ctx.effect, ctx.attacker, ctx.attackerFinalStat, ctx.defender, ctx.defenderFinalStat);
        const 发动方式 = 解析时光回溯发动方式(ctx.effect);
        ctx.effect.发动方式 = 发动方式;
        if (发动方式 === '主动') {
          ctx.directPayload.reaction_penalty = Math.max(
            Number(ctx.directPayload.reaction_penalty || 0),
            Number(ctx.effect?.时光回溯反应压制值 || 时光回溯反应压制值),
          );
          return;
        }
        ctx.ensureStateShell(ctx.effect?.状态名称 || '时光回溯', ['时光回溯']);
        ctx.state.持续回合 = 1;
        ctx.state.发动方式 = '被动';
        ctx.state.时光回溯消耗文本 = String(getSkillCostText(ctx.skill || {}) || '无').trim() || '无';
        ctx.state.时光回溯成功率 = Math.max(0, Math.min(1, Number(ctx.effect?.时光回溯成功率 ?? 1)));
        ctx.state.时光回溯反应压制值 = Math.max(0, Math.min(0.95, Number(ctx.effect?.时光回溯反应压制值 || 时光回溯反应压制值)));
      },
      skill_effect_amplify(ctx) {
        const 缩放 = 计算魂力机制缩放系数(ctx.attacker, ctx.attackerFinalStat, ctx.defender, ctx.defenderFinalStat, 1, {
          下限: 0.45,
          上限: 1.65,
          压制指数: 0.38,
        });
        const 效果倍率 = Math.max(1, Number(ctx.effect?.效果倍率 || ctx.effect?.skill_effect_mult || 1));
        ctx.directPayload.skill_effect_mult = Number((1 + (效果倍率 - 1) * 缩放).toFixed(4));
        ctx.ensureStateShell(ctx.effect?.状态名称 || '技能效果增幅', ['技能效果增幅']);
      },
      soft_control(ctx) {
        ctx.directPayload.reaction_penalty = Number(ctx.effect.reaction_penalty || 0);
        ctx.directPayload.cast_speed_penalty = Number(ctx.effect.cast_speed_penalty || 0);
        ctx.directPayload.dodge_penalty = Number(ctx.effect.dodge_penalty || 0);
        ctx.ensureStateShell(ctx.effect?.状态名称 || '软控', ['软控']);
      },
      position_lock(ctx) {
        ctx.directPayload.reaction_penalty = Number(ctx.effect.reaction_penalty || 0);
        ctx.directPayload.dodge_penalty = Number(ctx.effect.dodge_penalty || 0);
        ctx.directPayload.lock_level = Number(ctx.effect.lock_level || 0);
        ctx.ensureStateShell(ctx.effect?.状态名称 || '位移限制', ['位移限制']);
      },
      self_shift(ctx) {
        ctx.directPayload.dodge_bonus = Number(ctx.effect.dodge_bonus || 0);
        ctx.directPayload.attacker_speed_bonus = Number(ctx.effect.attacker_speed_bonus || 0);
        ctx.directPayload.reaction_bonus = Number(ctx.effect.reaction_bonus || 0);
      },
      hostile_shift(ctx) {
        ctx.directPayload.dodge_penalty = Number(ctx.effect.dodge_penalty || 0);
        ctx.directPayload.reaction_penalty = Number(ctx.effect.reaction_penalty || 0);
        ctx.directPayload.lock_level = Number(ctx.effect.lock_level || 0);
      },
      position_exchange(ctx) {
        ctx.directPayload.dodge_penalty = Number(ctx.effect.dodge_penalty || 0);
        ctx.directPayload.reaction_penalty = Number(ctx.effect.reaction_penalty || 0);
        ctx.directPayload.lock_level = Number(ctx.effect.lock_level || 0);
      },
      hard_lock(ctx) {
        ctx.directPayload.dodge_penalty = Number(ctx.effect.dodge_penalty || 0);
        ctx.directPayload.reaction_penalty = Number(ctx.effect.reaction_penalty || 0);
        ctx.directPayload.lock_level = Number(ctx.effect.lock_level || 0);
        ctx.ensureStateShell(ctx.effect?.状态名称 || '强制绑定/锁定', ['强制绑定/锁定']);
      },
      guard(ctx) {
        ctx.directPayload.damage_reduction = Number(ctx.effect.damage_reduction || 0);
        ctx.ensureStateShell(ctx.effect?.状态名称 || '护卫', ['护卫']);
      },
      invincible(ctx) {
        ctx.directPayload.invincible = true;
        ctx.directPayload.super_armor = true;
        ctx.directPayload.damage_reduction = Math.max(Number(ctx.directPayload.damage_reduction || 0), Number(ctx.effect.damage_reduction || 0));
        ctx.directPayload.invincible_tier_threshold = Number(ctx.effect.免疫等级阈值 || ctx.effect.invincible_tier_threshold || 100);
        ctx.ensureStateShell(ctx.effect?.状态名称 || '无敌金身', ['无敌金身']);
      },
      damage_reflect(ctx) {
        ctx.directPayload.damage_reflect_ratio = Number(ctx.effect.反射比例 || ctx.effect.damage_reflect_ratio || 0);
        ctx.ensureStateShell(ctx.effect?.状态名称 || '伤害反射', ['伤害反射']);
      },
      damage_transfer(ctx) {
        ctx.directPayload.damage_transfer_ratio = Number(ctx.effect.转移比例 || ctx.effect.damage_transfer_ratio || 0);
        ctx.directPayload.damage_transfer_target = String(ctx.effect.转移对象 || ctx.effect.damage_transfer_target || '攻击者').trim() || '攻击者';
        ctx.ensureStateShell(ctx.effect?.状态名称 || '伤害转移', ['伤害转移']);
      },
      damage_share(ctx) {
        ctx.directPayload.damage_share_ratio = Number(ctx.effect.分摊比例 || ctx.effect.damage_share_ratio || 0);
        ctx.directPayload.damage_share_count = Math.max(1, Number(ctx.effect.分摊人数 || ctx.effect.数量 || ctx.effect.damage_share_count || 1));
        ctx.ensureStateShell(ctx.effect?.状态名称 || '伤害分摊', ['伤害分摊']);
      },
      cost_share(ctx) {
        ctx.directPayload.cost_share_ratio = Number(ctx.effect.分摊比例 || ctx.effect.cost_share_ratio || 0);
        ctx.directPayload.cost_share_count = Math.max(1, Number(ctx.effect.分摊人数 || ctx.effect.数量 || ctx.effect.cost_share_count || 1));
        ctx.ensureStateShell(ctx.effect?.状态名称 || '消耗分摊', ['消耗分摊']);
      },
      skill_seal(ctx) {
        ctx.directPayload.skill_seal = true;
        ctx.ensureStateShell(ctx.effect?.状态名称 || '封技', ['封技']);
      },
      heal_inversion(ctx) {
        ctx.directPayload.heal_inversion_ratio = Number(ctx.effect.反转比例 || ctx.effect.heal_inversion_ratio || 0);
        ctx.ensureStateShell(ctx.effect?.状态名称 || '治疗反转', ['治疗反转']);
      },
      target_lock(ctx) {
        ctx.directPayload.hit_bonus = Number(ctx.effect.hit_bonus || 0);
        ctx.directPayload.lock_level = Number(ctx.effect.lock_level || 0);
        ctx.ensureStateShell('目标锁定', ['目标锁定']);
      },
      sense_block(ctx) {
        ctx.directPayload.探查屏蔽 = true;
        ctx.ensureStateShell(ctx.effect?.状态名称 || '探查屏蔽', ['探查屏蔽']);
      },
      expose_weakness(ctx) {
        const 结算 = String(ctx.effect?.结算 || '').trim();
        if (结算 === '防御剥夺') {
          ctx.directPayload.defense_strip = Number(ctx.effect?.计算层效果?.defense_strip ?? ctx.effect.defense_strip ?? 0.2);
        } else if (结算 === '精神抗性剥夺') {
          ctx.directPayload.spirit_resist_strip = Number(ctx.effect?.计算层效果?.spirit_resist_strip ?? ctx.effect.spirit_resist_strip ?? 0.2);
        } else {
          ctx.directPayload.defense_strip = Number(ctx.effect?.计算层效果?.defense_strip ?? ctx.effect.defense_strip ?? 0.2);
          ctx.directPayload.spirit_resist_strip = Number(ctx.effect?.计算层效果?.spirit_resist_strip ?? ctx.effect.spirit_resist_strip ?? 0.2);
        }
        ctx.ensureStateShell('标记弱点', ['标记弱点']);
      },
      pursuit_mark(ctx) {
        ctx.directPayload.attacker_speed_bonus = Number(ctx.effect.attacker_speed_bonus || 0);
        ctx.directPayload.hit_bonus = Number(ctx.effect.hit_bonus || 0);
        ctx.directPayload.final_damage_mult = Number(ctx.effect.final_damage_mult || 1.0);
        ctx.ensureStateShell('追击', ['追击']);
      },
      pursuit_shift(ctx) {
        ctx.directPayload.attacker_speed_bonus = Number(ctx.effect.attacker_speed_bonus || 0);
        ctx.directPayload.hit_bonus = Number(ctx.effect.hit_bonus || 0);
        ctx.directPayload.final_damage_mult = Number(ctx.effect.final_damage_mult || 1.0);
      },
      disengage_shift(ctx) {
        ctx.directPayload.dodge_bonus = Number(ctx.effect.dodge_bonus || 0);
        ctx.directPayload.cast_speed_bonus = Number(ctx.effect.cast_speed_bonus || 0);
        ctx.directPayload.reaction_bonus = Number(ctx.effect.reaction_bonus || 0);
      },
      counter(ctx) {
        ctx.directPayload.counter_attack_ratio = Number(ctx.effect.反击倍率 || ctx.effect.counter_attack_ratio || 0);
        ctx.directPayload.damage_reduction = Number(ctx.effect.damage_reduction || 0);
        ctx.ensureStateShell(ctx.effect?.状态名称 || '反制', ['反制']);
      },
      on_hit_counter(ctx) {
        ctx.directPayload.counter_attack_ratio = ctx.effect.反击倍率 || 0.5;
        ctx.ensureStateShell('受击反击', ['反击']);
      },
      damage_reduce(ctx) {
        ctx.directPayload.damage_reduction = 0.15;
        ctx.ensureStateShell('承伤修正', ['承伤修正']);
      },
      block(ctx) {
        ctx.directPayload.block_count = ctx.effect.抵消次数 || 1;
        ctx.ensureStateShell('免伤', ['免伤']);
      },
      super_armor(ctx) {
        ctx.directPayload.super_armor = true;
        ctx.directPayload.damage_reduction = Number(ctx.effect.damage_reduction || 0);
        ctx.ensureStateShell('霸体', ['霸体']);
      },
      anti_heal(ctx) {
        ctx.directPayload.heal_block_ratio = Number(ctx.effect.heal_block_ratio || 0);
        ctx.ensureStateShell('禁疗', ['禁疗']);
      },
      shared_vision(ctx) {
        ctx.directPayload.reaction_bonus = Number(ctx.effect.reaction_bonus || 0);
        ctx.directPayload.hit_bonus = Number(ctx.effect.hit_bonus || 0);
        ctx.directPayload.lock_level = Number(ctx.effect.lock_level || 0);
        ctx.ensureStateShell('共享视野', ['共享视野']);
      },
      summon(ctx) {
        const count = Math.max(1, Number(ctx.effect.召唤数量 || ctx.effect.数量 || 1));
        const 继承比例 = Math.max(0, Math.min(1, Number(ctx.effect.继承属性比例 || 0)));
        const 召唤强度 = 继承比例 > 0 ? 继承比例 : Math.max(0.01, Number(ctx.effect.强度 || 1));
        const mode = String(ctx.effect.行动模式 || '').trim();
        ctx.directPayload.final_damage_mult = Math.max(
          Number(ctx.directPayload.final_damage_mult || 1),
          Number(ctx.effect?.计算层效果?.final_damage_mult || Math.min(1.5, 1 + 召唤强度 * 0.12 + count * 0.03)),
        );
        if (/护卫|承伤/.test(mode + String(ctx.effect.承伤规则 || ''))) {
          ctx.directPayload.damage_reduction = Math.max(
            Number(ctx.directPayload.damage_reduction || 0),
            Number(ctx.effect?.计算层效果?.damage_reduction || Math.min(0.3, 召唤强度 * 0.08)),
          );
        }
        ctx.ensureStateShell(ctx.effect?.状态名称 || ctx.effect?.召唤物名称 || '召唤物', ['召唤']);
      },
      clone(ctx) {
        const cloneType = String(ctx.effect.分身类型 || '').trim();
        const cloneCount = Math.max(1, Number(ctx.effect.分身数量 || 1));
        const stealth = Math.max(0, Math.min(1, Number(ctx.effect.隐蔽度 || 0)));
        const inheritRatio = Math.max(0, Math.min(1, Number(ctx.effect.实力继承比例 || 0)));
        if (cloneType === '精神力分身') {
          ctx.directPayload.reaction_bonus = Number(
            ctx.effect.reaction_bonus || Math.min(0.28, 0.04 + stealth * 0.16 + inheritRatio * 0.08),
          );
          ctx.directPayload.hit_bonus = Number(
            ctx.effect.hit_bonus || Math.min(0.3, 0.04 + inheritRatio * 0.15 + cloneCount * 0.03),
          );
          ctx.directPayload.lock_level = Number(
            ctx.effect.lock_level || Math.min(3, Math.max(1, Math.round(1 + inheritRatio * 1.2 + stealth * 0.8))),
          );
          ctx.directPayload.damage_reduction = Number(
            ctx.effect.damage_reduction || Math.min(0.18, 0.02 + stealth * 0.05 + cloneCount * 0.01),
          );
        } else {
          ctx.directPayload.dodge_bonus = Number(
            ctx.effect.dodge_bonus || Math.min(0.35, 0.05 + stealth * 0.18 + inheritRatio * 0.08 + cloneCount * 0.03),
          );
          ctx.directPayload.attacker_speed_bonus = Number(
            ctx.effect.attacker_speed_bonus || Math.min(0.24, 0.03 + inheritRatio * 0.12 + cloneCount * 0.02),
          );
          ctx.directPayload.damage_reduction = Number(
            ctx.effect.damage_reduction || Math.min(0.22, 0.02 + stealth * 0.08 + cloneCount * 0.015),
          );
          ctx.directPayload.final_damage_mult = Number(
            ctx.effect.final_damage_mult || Math.min(1.28, 1 + inheritRatio * 0.12 + Math.max(0, cloneCount - 1) * 0.04),
          );
        }
        ctx.ensureStateShell(ctx.effect?.状态名称 || ctx.effect?.分身类型 || '分身', ['分身']);
      },
      death_save(ctx) {
        ctx.directPayload.super_armor = true;
        ctx.directPayload.min_hp_floor = 1;
        ctx.directPayload.death_save_count = ctx.effect.触发次数 || 1;
        ctx.ensureStateShell('免死', ['免死']);
      },
      hard_control(ctx) {
        ctx.directPayload.skip_turn = true;
        ctx.directPayload.cannot_react = true;
        ctx.ensureStateShell(ctx.effect?.状态名称 || '硬控', ['硬控']);
      },
      cost_increase(ctx) {
        const ratio = Number(ctx.effect?.计算层效果?.cost_ratio || ctx.effect?.cost_ratio || 1);
        ctx.directPayload.cost_ratio = ratio > 0 ? ratio : 1;
        ctx.directPayload.cost_delta_ratio = Number(ctx.effect?.计算层效果?.cost_delta_ratio || ctx.effect?.cost_delta_ratio || 0);
        ctx.ensureStateShell(ctx.effect?.状态名称 || '消耗', ['消耗']);
      },
      cost_reduce(ctx) {
        const ratio = Number(ctx.effect?.计算层效果?.cost_ratio || ctx.effect?.cost_ratio || 1);
        ctx.directPayload.cost_ratio = ratio > 0 ? ratio : 1;
        ctx.directPayload.cost_delta_ratio = Number(ctx.effect?.计算层效果?.cost_delta_ratio || ctx.effect?.cost_delta_ratio || 0);
        if (ctx.effect?.计算层效果?.cost_delta !== undefined || ctx.effect?.cost_delta !== undefined) {
          ctx.directPayload.cost_delta = Number(ctx.effect?.计算层效果?.cost_delta ?? ctx.effect?.cost_delta ?? 0);
        }
        ctx.ensureStateShell(ctx.effect?.状态名称 || '消耗', ['消耗']);
      },
      windup_increase(ctx) {
        const ratio = Number(ctx.effect?.计算层效果?.windup_ratio || ctx.effect?.windup_ratio || 1);
        ctx.directPayload.windup_ratio = ratio > 0 ? ratio : 1;
        if (ctx.effect?.计算层效果?.windup_delta !== undefined || ctx.effect?.windup_delta !== undefined) {
          ctx.directPayload.windup_delta = Number(ctx.effect?.计算层效果?.windup_delta ?? ctx.effect?.windup_delta ?? 0);
        }
        ctx.ensureStateShell(ctx.effect?.状态名称 || '前摇', ['前摇']);
      },
      windup_reduce(ctx) {
        const ratio = Number(ctx.effect?.计算层效果?.windup_ratio || ctx.effect?.windup_ratio || 1);
        ctx.directPayload.windup_ratio = ratio > 0 ? ratio : 1;
        if (ctx.effect?.计算层效果?.windup_delta !== undefined || ctx.effect?.windup_delta !== undefined) {
          ctx.directPayload.windup_delta = Number(ctx.effect?.计算层效果?.windup_delta ?? ctx.effect?.windup_delta ?? 0);
        }
        ctx.ensureStateShell(ctx.effect?.状态名称 || '前摇', ['前摇']);
      },
    });

    function applyRuntimeMechanismEffects(skill, attacker, attackerFinalStat, defender, defenderFinalStat, pState, context = {}) {
      const effects = getSkillEffects(skill, context);
      effects.forEach((effect, effectIndex) => {
        const 运行效果 = effect;
        const 原型名 = String(运行效果?.原型 || '').trim();
        if (原型名 === '时光回溯' && 解析时光回溯发动方式(运行效果) === '主动') return;
        if (Number(运行效果?.延迟回合 || 0) > 0 && 战斗原型允许延迟回合(原型名)) return;
        const mechanism = 原型名 || '';
        const targetKind = 推断战斗效果目标类型(运行效果, String(运行效果?.目标 || effect?.目标 || '敌方单体'));
        const 允许生成状态壳 = ['状态施加', '规则防御', '时窗修正', '决策干扰', '结算修正', '属性修正', '判定修正', '时光回溯'].includes(原型名);
          const ensureStateShell = (fallbackName, extraFlags = []) => {
            if (!允许生成状态壳) return;
            const nextName = String(fallbackName || mechanism || '无');
            if (!nextName || nextName === '无') return;
            if (!Array.isArray(pState.__原型来源效果列表)) pState.__原型来源效果列表 = [];
            const sourceEffectId = 读取战斗效果来源ID(运行效果, effectIndex);
            if (!pState.__原型来源效果列表.some(entry => String(entry?.sourceEffectId || '').trim() === sourceEffectId)) {
              pState.__原型来源效果列表.push({
                effect: 运行效果,
                effectPrototype: 原型名,
                sourceEffectId,
              });
            }
            if (!pState.状态名称 || pState.状态名称 === '无') {
            pState.状态名称 = nextName;
            const nextTarget = String(运行效果?.目标 || '').trim();
            if (nextTarget) pState.目标 = nextTarget;
            }
            const duration = Math.max(0, Number(运行效果?.持续回合 || effect?.持续回合 || 0));
            if (duration > 0) pState.持续回合 = Math.max(Number(pState.持续回合 || 0), duration);
            [
              '攻击段数',
              '结算标签',
              '抗性类型',
            ].forEach(字段名 => {
              if (运行效果?.[字段名] !== undefined && 运行效果?.[字段名] !== '') pState[字段名] = cloneBattleValue(运行效果[字段名]);
            });
            pState.特殊机制标识 = mergeSpecialFlags(pState.特殊机制标识 || '无', extraFlags);
          };
          const directPayload = {};
          if (运行效果?.计算层效果 && typeof 运行效果.计算层效果 === 'object') {
            Object.assign(directPayload, 运行效果.计算层效果);
          }
          if (运行效果?.面板修改比例 && typeof 运行效果.面板修改比例 === 'object') {
            directPayload.面板修改比例 = { ...(directPayload.面板修改比例 || {}), ...运行效果.面板修改比例 };
          }
          if (运行效果?.面板固定修正 && typeof 运行效果.面板固定修正 === 'object') {
            directPayload.面板固定修正 = { ...(directPayload.面板固定修正 || {}), ...运行效果.面板固定修正 };
          }
          if (原型名 === '属性修正' && (directPayload.面板修改比例 || directPayload.面板固定修正)) {
            const 属性名 = String(运行效果?.属性 || '属性修正').trim() || '属性修正';
            ensureStateShell(`${属性名}修正`, [
              Object.values(directPayload.面板固定修正 || {}).some(value => Number(value || 0) < 0) ||
              Object.values(directPayload.面板修改比例 || {}).some(value => Number(value || 1) < 1)
                ? '属性削弱'
                : '属性增益',
            ]);
          }
          const 运行时消费器 = String(读取战斗原型运行消费器(运行效果) || '').trim();
          const runtimeConsumer = 运行时消费器 ? BATTLE_MECHANISM_CONSUMERS[运行时消费器] : null;
          if (mechanism === '属性变化') {
            const property = String(运行效果?.属性 || '').trim();
            const action = String(运行效果?.动作 || '').trim();
            const value = action === '加值' || action === '减值' ? 读取战斗效果数值(运行效果?.数值, 0) : 读取战斗属性倍率(运行效果);
            if (['str', 'def', 'agi', 'vit_max', 'sp_max', 'men_max'].includes(property) && Number.isFinite(value)) {
              if (action === '加值' || action === '减值') directPayload.面板固定修正 = { [property]: value };
              else directPayload.面板修改比例 = { [property]: value };
              ensureStateShell('属性变化', [action || '属性变化']);
            }
            if (property === '威力' && Number.isFinite(value)) {
              directPayload.final_damage_mult = value;
              ensureStateShell('威力变化', [action || '威力变化']);
            }
          }
          if (mechanism === '持续恢复') {
            const property = String(effect?.属性 || '').trim();
            const value = 读取战斗效果数值(effect?.数值, 0);
            if (property === 'vit') directPayload.vit_gain_ratio = value;
            if (property === 'sp') directPayload.sp_gain_ratio = value;
            if (property === 'men') directPayload.men_gain_ratio = value;
            ensureStateShell('持续恢复', ['持续恢复']);
          }
          if (mechanism === '掌控修正') {
            const value = 读取战斗属性倍率(effect);
            const action = String(effect?.动作 || '').trim();
            if (action === '倍率压制' || (!action && value < 1)) directPayload.hit_penalty = Math.max(0, 1 - value);
            else directPayload.hit_bonus = Math.max(0, value - 1);
            ensureStateShell('掌控修正', ['掌控修正']);
          }
          if (mechanism === '速度修正') {
            const value = 读取战斗属性倍率(effect);
            const action = String(effect?.动作 || '').trim();
            if (action === '倍率压制' || (!action && value < 1)) {
              directPayload.reaction_penalty = Math.max(0, 1 - value);
              directPayload.dodge_penalty = Math.max(0, 1 - value);
            } else {
              directPayload.reaction_bonus = Math.max(0, value - 1);
              directPayload.attacker_speed_bonus = Math.max(0, value - 1);
              directPayload.dodge_bonus = Math.max(0, Math.max(0, value - 1) * 0.75);
            }
            ensureStateShell('速度修正', ['速度修正']);
          }
          if (mechanism === '打断') directPayload.interrupt_bonus = effect.中断概率 || 1.0;
          if (mechanism === '感知干扰') {
            directPayload.hit_penalty = Number(effect.hit_penalty || 0);
            directPayload.reaction_penalty = Number(effect.reaction_penalty || 0);
            directPayload.cast_speed_penalty = Number(effect.cast_speed_penalty || 0);
            ensureStateShell('感知干扰', ['感知干扰']);
          }
          if (runtimeConsumer)
            runtimeConsumer({
              effect,
              mechanism,
              directPayload,
              ensureStateShell,
              state: pState,
              attacker,
              attackerFinalStat,
              defender,
              defenderFinalStat,
              skill,
            });
          if (mechanism === '嘲讽') ensureStateShell('嘲讽', ['嘲讽']);
          if (原型名 && 原型名 !== '时光回溯') {
            原型驱动缩放(effect, directPayload, 运行效果, attacker, attackerFinalStat, defender, defenderFinalStat);
            if (原型名 === '判定修正' && Number(运行效果?.持续回合 || effect?.持续回合 || 0) > 0) {
              const 判定名 = String(运行效果?.判定 || effect?.判定 || '判定').trim() || '判定';
              const 是削弱 = Object.keys(directPayload).some(key => /penalty$/.test(key) && Number(directPayload[key] || 0) > 0);
              ensureStateShell(`${判定名}判定修正`, [是削弱 ? '判定削弱' : '判定增益']);
            }
            if (原型名 === '决策干扰' && Number(运行效果?.持续回合 || effect?.持续回合 || 0) > 0) {
              const 干扰名 = String(运行效果?.干扰 || effect?.干扰 || '决策干扰').trim() || '决策干扰';
              ensureStateShell(干扰名, ['决策干扰']);
            }
            if (原型名 === '状态施加') ensureStateShell(String(运行效果?.状态 || '').trim() || mechanism, [mechanism]);
          }
          if (Object.keys(directPayload).length > 0) {
            mergeRuntimePayloadToState(directPayload, pState);
          }
      });
    }

    function mapPrimaryRoleToSkillType(role) {
      const mapping = {
        输出: '输出',
        控制: '控制',
        防御: '防御',
        辅助: '辅助',
        特殊: '辅助',
      };
      return mapping[role] || '输出';
    }

    function mergeSpecialFlags(existing, additions = []) {
      const set = new Set(
        String(existing || '无')
          .split(/[\/、,，\s]+/)
          .filter(Boolean)
          .filter(flag => flag !== '无'),
      );
      (additions || []).forEach(flag => {
        if (flag && flag !== '无') set.add(flag);
      });
      return set.size > 0 ? Array.from(set).join('/') : '无';
    }

    function formatCostObjectToString(costObj) {
      if (!costObj || typeof costObj !== 'object') return '无';
      const buildPart = obj =>
        [
          obj?.魂力 ? `魂力:${obj.魂力}` : '',
          obj?.体力 ? `体力:${obj.体力}` : '',
          obj?.精神力 ? `精神力:${obj.精神力}` : '',
        ]
          .filter(Boolean)
          .join(' ') || '无';
      const upfront = buildPart(costObj.启动 || costObj.upfront || costObj);
      const sustain = buildPart(costObj.维持 || costObj.sustain || {});
      return sustain !== '无' ? `${upfront} 维持:${sustain}` : upfront;
    }

    function 读取槽位序号_战斗(槽位名 = '', 默认值 = 1) {
      const 匹配 = String(槽位名 || '').match(/第(\d+)/);
      return Math.max(1, Math.floor(Number(匹配 ? 匹配[1] : 默认值) || 默认值 || 1));
    }

    function 是武魂槽位键_战斗(键 = '') {
      return /^第\d+武魂$/.test(String(键 || '').trim());
    }

    function 是魂灵槽位键_战斗(键 = '') {
      return /^第\d+魂灵$/.test(String(键 || '').trim());
    }

    function 是魂环槽位键_战斗(键 = '') {
      return /^第\d+魂环$/.test(String(键 || '').trim());
    }

    function 是魂技槽位键_战斗(键 = '') {
      return /^第\d+魂技(?:_2)?$/.test(String(键 || '').trim());
    }

    function 是气血魂环槽位键_战斗(键 = '') {
      return /^第\d+气血魂环$/.test(String(键 || '').trim());
    }

    function 是血脉魂技槽位键_战斗(键 = '') {
      return /^第\d+血脉魂技(?:_2)?$/.test(String(键 || '').trim());
    }

    function 取槽位条目_战斗(对象 = {}, 判断函数 = () => false) {
      return Object.entries(对象 || {}).filter(([键, 值]) => 判断函数(键) && 值 && typeof 值 === 'object' && !Array.isArray(值));
    }

    function 取角色武魂条目_战斗(角色 = {}) {
      return 取槽位条目_战斗(角色, 是武魂槽位键_战斗);
    }

    function 取武魂魂灵条目_战斗(武魂 = {}) {
      return 取槽位条目_战斗(武魂, 是魂灵槽位键_战斗);
    }

    function 取武魂直接魂环条目_战斗(武魂 = {}) {
      return 取槽位条目_战斗(武魂, 是魂环槽位键_战斗);
    }

    function 取魂灵魂环条目_战斗(魂灵 = {}) {
      return 取槽位条目_战斗(魂灵, 是魂环槽位键_战斗);
    }

    function 取魂环魂技条目_战斗(魂环 = {}) {
      return 取槽位条目_战斗(魂环, 是魂技槽位键_战斗);
    }

    function 按魂环路径读取当前角色魂技_战斗(角色 = {}, 魂环路径 = [], 魂技槽位 = '') {
      if (!角色 || typeof 角色 !== 'object') return null;
      if (!Array.isArray(魂环路径) || !魂环路径.length) return null;
      const 魂环 = 按路径读取对象_V1(角色, 魂环路径);
      if (!魂环 || typeof 魂环 !== 'object' || Array.isArray(魂环)) return null;
      const 槽位 = String(魂技槽位 || '').trim();
      if (槽位) {
        const 技能 = 魂环[槽位];
        return 技能 && typeof 技能 === 'object' && !Array.isArray(技能) ? { 技能, 槽位 } : null;
      }
      const [默认槽位, 默认技能] = 取魂环魂技条目_战斗(魂环)[0] || [];
      return 默认技能 ? { 技能: 默认技能, 槽位: 默认槽位 } : null;
    }

    function 取血脉气血魂环条目_战斗(血脉 = {}) {
      return 取槽位条目_战斗(血脉, 是气血魂环槽位键_战斗);
    }

    function 取气血魂环魂技条目_战斗(魂环 = {}) {
      return 取槽位条目_战斗(魂环, 是血脉魂技槽位键_战斗);
    }

    function formatBattleCultivationLevelText(value, fallback = '0') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        if (Math.abs(parsed - 99.5) < 0.001) return '准神';
        return String(parsed);
      }
      const text = String(value ?? '').trim();
      return text || fallback;
    }

    function getSpiritNameList(char) {
      return 取角色武魂条目_战斗(char)
        .map(([, sp]) => sp)
        .map(sp => sp?.表象名称 || '')
        .filter(Boolean);
    }

    function 读取角色系别列表(char) {
      const 系别集合 = new Set();
      const 属性系别 = String(char?.type || char?.系别 || '').trim();
      if (属性系别) 系别集合.add(属性系别);
      取角色武魂条目_战斗(char).forEach(([, 武魂数据]) => {
        const 武魂系别 = String(武魂数据?.type || 武魂数据?.系别 || '').trim();
        if (武魂系别) 系别集合.add(武魂系别);
      });
      return Array.from(系别集合);
    }

    function 是否辅助系角色(char) {
      return 读取角色系别列表(char).includes('辅助系');
    }

    function 是否七九武魂角色(char) {
      return getSpiritNameList(char).some(名称 => /[七九]/.test(String(名称 || '')));
    }

    function isSpecialSupportMartialSoul(char) {
      return 是否辅助系角色(char) && 是否七九武魂角色(char);
    }

    function 是否七九辅助单体语义(char, skill) {
      return isSpecialSupportMartialSoul(char) && isSupportLikeSkill(skill);
    }

    function 战斗机甲可召唤(unit = {}) {
      const 机甲 = unit?.装备?.机甲;
      if (!机甲 || typeof 机甲 !== 'object') return false;
      const 等级 = String(机甲.等级 || '').trim();
      return !!等级 && 等级 !== '无' && 机甲.状态 !== '重创' && 机甲.装备状态 !== '已装备';
    }

    function 战斗机甲已装备(unit = {}) {
      const 机甲 = unit?.装备?.机甲;
      if (!机甲 || typeof 机甲 !== 'object') return false;
      const 等级 = String(机甲.等级 || '').trim();
      return !!等级 && 等级 !== '无' && 机甲.状态 !== '重创' && 机甲.装备状态 === '已装备';
    }

    function getSupportEffectScale(caster, target) {
      if (isSpecialSupportMartialSoul(caster)) return 1;
      const casterSp = Math.max(1, caster?.sp_max || 1);
      const targetSp = Math.max(1, target?.sp_max || 1);
      const ratio = casterSp / targetSp;
      if (!Number.isFinite(ratio) || ratio <= 0) return 1;
      if (ratio >= 1) return Math.min(1.35, 1 + (Math.sqrt(ratio) - 1) * 0.35);
      return Math.max(0.72, 0.72 + 0.28 * Math.sqrt(ratio));
    }

    function getSupportCostScale(caster, target) {
      if (isSpecialSupportMartialSoul(caster)) {
        const 施术者魂力 = Math.max(1, Number(caster?.sp_max || caster?.属性?.魂力上限 || 1));
        const 目标魂力 = Math.max(1, Number(target?.sp_max || target?.属性?.魂力上限 || 1));
        const 越级倍率 = 目标魂力 / 施术者魂力;
        if (!Number.isFinite(越级倍率) || 越级倍率 <= 1) return 1;
        return Math.min(8, Math.max(1, Math.pow(越级倍率, 0.65)));
      }
      const effectScale = getSupportEffectScale(caster, target);
      if (!(effectScale > 0)) return 1;
      if (effectScale >= 1) return Math.min(1.05, 1 + (effectScale - 1) * 0.2);
      return Math.max(0.78, 1 - (1 - effectScale) * 0.65);
    }

    function getSoulDriveScale(attacker, defender) {
      return 计算魂力机制缩放系数(attacker, attacker?.final || {}, defender, defender?.final || {}, 1, {
        下限: 0.35,
        上限: 1.85,
        压制指数: 0.45,
      });
    }

    function 计算定位伤害倍率(攻击方 = {}, 防御方 = {}, 伤害类型 = '') {
      const 攻方系别列表 = 读取角色系别列表(攻击方);
      const 守方系别列表 = 读取角色系别列表(防御方);
      const 类型 = 规范化战斗伤害类型(伤害类型);
      if (攻方系别列表.includes('强攻系') && 守方系别列表.some(系别 => ['辅助系', '治疗系', '食物系', '召唤系'].includes(系别))) {
        return 类型 === '近身攻击' || 类型 === '远程攻击' ? 1.9 : 1.45;
      }
      if (攻方系别列表.includes('强攻系') && 守方系别列表.includes('防御系')) return 0.92;
      return 1;
    }

    function getSpiritDriveScale(attacker, defender) {
      return 计算精神机制缩放系数(attacker, attacker?.final || {}, defender, defender?.final || {}, 1, {
        下限: 0.25,
        上限: 1.85,
        压制指数: 0.45,
      });
    }

    function 读取单位战斗效果列表(单位 = {}) {
      if (!单位?.状态效果 || typeof 单位.状态效果 !== 'object') return [];
      return Object.values(单位.状态效果)
        .map(状态 => 状态?.战斗效果 || {})
        .filter(战斗效果 => 战斗效果 && typeof 战斗效果 === 'object');
    }

    function 读取状态穿透比例(战斗效果列表 = []) {
      return 战斗效果列表.reduce((总和, 战斗效果) => {
        const 原始值 = Number(战斗效果?.armor_pen || 0);
        return 总和 + (Math.abs(原始值) <= 1 ? 原始值 * 100 : 原始值);
      }, 0);
    }

    function 计算有效穿透比例(技能穿透 = 0, 状态穿透 = 0) {
      const 原始穿透 = Math.max(0, Number(技能穿透 || 0) + Number(状态穿透 || 0));
      if (原始穿透 >= 100) return 100;
      if (原始穿透 <= 70) return 原始穿透;
      return Math.min(92, 70 + (原始穿透 - 70) * 0.35);
    }

    function 计算穿透后防御值(基础防御 = 1, 技能穿透 = 0, 状态穿透 = 0) {
      const 有效穿透 = 计算有效穿透比例(技能穿透, 状态穿透);
      return Math.max(1, Number(基础防御 || 1) * (1 - 有效穿透 / 100));
    }

    function 计算战斗基础伤害内核(options = {}) {
      const 伤害类型 = 规范化战斗伤害类型(options?.伤害类型);
      return BATTLE_RUNTIME.calculateBaseDamage({
        damageClass: 战斗伤害是真实攻击(伤害类型)
          ? 'TRUE'
          : 战斗伤害是近身攻击(伤害类型)
            ? 'MELEE'
            : 战斗伤害是远程攻击(伤害类型)
              ? 'RANGED'
              : 战斗伤害是精神攻击(伤害类型)
                ? 'MENTAL'
                : '',
        damageType: 伤害类型,
        power: options?.威力倍率,
        attack: options?.攻击值,
        defense: options?.防御值,
        soulScale: options?.魂力驱动倍率,
        spiritScale: options?.精神驱动倍率,
        positionScale: options?.定位倍率,
        costScale: options?.消耗倍率,
        contactScale: options?.近身接触倍率,
      });
    }

    function 预估技能直接伤害(attacker = {}, defender = {}, skill = {}, damageEffect = null, context = {}) {
      const effects = Array.isArray(context?.effects)
        ? context.effects
        : getSkillEffects(skill, { 行为规划: true, actor: attacker, caster: attacker, attacker, target: defender, defender });
      const effect = damageEffect && typeof damageEffect === 'object'
        ? damageEffect
        : effects.find(item => String(item?.原型 || '').trim() === '伤害结算') || null;
      if (!effect || !(Number(effect?.威力倍率 || 0) > 0)) {
        return {
          fullHitDamage: 0,
          fullHitHpDamage: 0,
          shieldDamage: 0,
          expectedDamage: 0,
          expectedHpDamage: 0,
          hitProbability: 0,
          fullHitProbability: 0,
          grazeProbability: 0,
          dodgeRate: 0,
          segmentCount: 0,
          segmentTriggerValue: 0,
        };
      }
      const attackerFinal = context?.attackerFinalStat || attacker?.final || BATTLE_RUNTIME.buildCombatFinalStats(attacker);
      const defenderFinal = context?.defenderFinalStat || defender?.final || BATTLE_RUNTIME.buildCombatFinalStats(defender);
      const attackerConditions = Array.isArray(context?.attackerConditionEffects)
        ? context.attackerConditionEffects
        : 读取单位战斗效果列表(attacker);
      const defenderConditions = Array.isArray(context?.defenderConditionEffects)
        ? context.defenderConditionEffects
        : 读取单位战斗效果列表(defender);
      const 对应等级 = 构建对应等级数据(effect);
      const 使用对应等级 = !!对应等级;
      const 攻势单位 = 使用对应等级 ? 对应等级.单位 : attacker;
      const 攻势最终属性 = 使用对应等级 ? 对应等级.最终属性 : attackerFinal;
      const 伤害类型 = 规范化战斗伤害类型(effect?.伤害类型, skill);
      const 附加穿透 = 使用对应等级 ? 0 : effects.reduce((sum, item) => {
        if (String(item?.原型 || '').trim() !== '结算修正' || String(item?.结算 || '').trim() !== '防御穿透') return sum;
        const value = Number(读取战斗数值正负(item?.数值));
        if (!Number.isFinite(value)) return sum;
        return sum + (Math.abs(value) <= 1 ? value * 100 : value);
      }, 0);
      const 防御剥夺 = Math.min(0.9, defenderConditions.reduce((value, item) => Math.max(value, Number(item?.defense_strip || 0)), 0));
      const 精神抗性剥夺 = Math.min(0.9, defenderConditions.reduce((value, item) => Math.max(value, Number(item?.spirit_resist_strip || 0)), 0));
      let effectiveDefense = 计算穿透后防御值(
        Number(defenderFinal?.def || defender?.def || 1),
        Number(effect?.防御穿透 || 0) + 附加穿透,
        使用对应等级 ? 0 : 读取状态穿透比例(attackerConditions),
      );
      if (!战斗伤害是精神攻击(伤害类型) && !战斗伤害是真实攻击(伤害类型)) {
        effectiveDefense = Math.max(1, effectiveDefense * (1 - 防御剥夺));
      }
      const attackValue = 战斗伤害是精神攻击(伤害类型) || 战斗伤害是真实攻击(伤害类型)
        ? 计算精神伤害攻势值(攻势单位, 攻势最终属性)
        : 计算物理伤害攻势值(攻势单位, 攻势最终属性, 伤害类型);
      const defenseValue = 战斗伤害是精神攻击(伤害类型)
        ? Math.max(1, 计算紫极魔瞳防守精神攻势值_战斗(defender, defenderFinal, effect, skill) * (1 - 精神抗性剥夺))
        : effectiveDefense;
      const base = 计算战斗基础伤害内核({
        伤害类型,
        威力倍率: effect?.威力倍率,
        攻击值: attackValue,
        防御值: defenseValue,
        魂力驱动倍率: 使用对应等级 ? 1 : getSoulDriveScale({ ...attacker, final: attackerFinal }, defender),
        精神驱动倍率: 使用对应等级 ? 1 : getSpiritDriveScale({ ...attacker, final: attackerFinal }, defender),
        定位倍率: 使用对应等级 ? 1 : 计算定位伤害倍率(attacker, defender, 伤害类型),
        消耗倍率: 使用对应等级 ? 1 : 计算伤害消耗加成系数(skill, attacker),
      });
      const finalDamageMult = 使用对应等级 ? 1 : attackerConditions.reduce((value, item) => value * Number(item?.final_damage_mult || 1), 1);
      const finalDamageBonus = 使用对应等级 ? 0 : attackerConditions.reduce((value, item) => value + Number(item?.final_damage_bonus || 0), 0);
      const damageReduction = Math.min(0.9, defenderConditions.reduce((value, item) => Math.max(value, Number(item?.damage_reduction || 0)), 0));
      const receivedDamageMult = defenderConditions.reduce((value, item) => value * Number(item?.received_damage_mult || 1), 1);
      const elementDamageMult = 读取目标元素承伤倍率(defender, skill);
      const extraTrueDamage = 使用对应等级 ? 0 : attackerConditions.reduce(
        (value, item) => value + Math.floor(Number(attackerFinal?.men_max || attacker?.men_max || 0) * Number(item?.bonus_true_damage_ratio || 0)),
        0,
      );
      let fullHitDamage = base.damage * (1 - damageReduction) * receivedDamageMult * elementDamageMult * finalDamageMult + finalDamageBonus + extraTrueDamage;
      const executeEffect = effects.find(item =>
        String(item?.原型 || '').trim() === '结算修正' &&
        String(item?.结算 || '').trim() === '造成伤害' &&
        读取战斗数值正负(item?.数值) > 0 &&
        String(item?.驱动属性 || '').trim() === '体力上限'
      );
      if (executeEffect && getCombatHpRatio(defender) <= 0.45) {
        fullHitDamage *= 1 + Math.max(0, 读取战斗效果数值(executeEffect?.数值, 0));
      }
      fullHitDamage = Math.max(0, Math.floor(fullHitDamage));
      const attackAgi = Math.max(1, Number(攻势最终属性?.agi || 攻势单位?.agi || 1));
      const attackMental = Math.max(1, Number(攻势最终属性?.men_max || 攻势单位?.men_max || 1));
      const defenderAgi = Math.max(0, Number(defenderFinal?.agi || defender?.agi || 0)) * Math.max(0.1, Number(defender?.temp_agi_mult || 1));
      const targetDodgeBonus = 计算有效增加闪避(Number(defender?.temp_dodge_bonus || 0));
      const targetDodgePenalty = Number(defender?.temp_dodge_penalty || 0) + Number(effect?.计算层效果?.dodge_penalty || 0);
      const targetLockLevel = Number(defender?.temp_lock_level || 0) + Number(effect?.计算层效果?.lock_level || 0);
      const attackerHitBonus = 使用对应等级 ? 0 : attackerConditions.reduce((sum, item) => sum + Number(item?.hit_bonus || 0), 0);
      const attackerHitPenalty = 使用对应等级 ? 0 : attackerConditions.reduce((sum, item) => sum + Number(item?.hit_penalty || 0), 0);
      const effectHitDelta = Number(effect?.计算层效果?.hit_bonus || 0) - Number(effect?.计算层效果?.hit_penalty || 0);
      const dodgeScale = 战斗伤害是近身攻击(伤害类型) ? 8 : 战斗伤害是远程攻击(伤害类型) ? 11 : 10;
      const targetKind = 推断战斗效果目标类型(effect, inferSkillPrimaryTargetKind(skill || {}));
      const aoePenalty = targetKind === '全场' ? 10 : String(targetKind).includes('群体') ? 7 : 0;
      let dodgeRate = (defenderAgi / Math.max(1, attackAgi + attackMental)) * dodgeScale;
      dodgeRate += targetDodgeBonus * 100 - targetDodgePenalty * 100;
      dodgeRate -= (attackerHitBonus - attackerHitPenalty + effectHitDelta) * 100;
      dodgeRate -= targetLockLevel * 8 + aoePenalty + (战斗伤害是近身攻击(伤害类型) ? 6 : 0) - (战斗伤害是远程攻击(伤害类型) ? 2 : 0);
      dodgeRate = Math.max(0, Math.min(24, dodgeRate));
      const grazeWindow = 战斗伤害是近身攻击(伤害类型) ? 4 : 6;
      const dodgeProbability = dodgeRate / 100;
      const grazeProbability = Math.min(1 - dodgeProbability, grazeWindow / 100);
      const fullHitProbability = Math.max(0, 1 - dodgeProbability - grazeProbability);
      const grazeMultiplier = 0.625;
      const impactProbability = fullHitProbability + grazeProbability;
      const expectedImpactDamage = fullHitDamage * fullHitProbability + fullHitDamage * grazeMultiplier * grazeProbability;
      const shield = Math.max(0, 读取当前护盾总量(defender));
      const shieldDamage = Math.min(shield, expectedImpactDamage);
      const expectedHpDamage = Math.max(0, expectedImpactDamage - shield);
      const fullHitHpDamage = Math.max(0, fullHitDamage - shield);
      const segmentCount = Math.max(1, Math.floor(Number(effect?.计算层效果?.multi_hit_count || effect?.攻击段数 || 1)));
      return {
        fullHitDamage,
        fullHitHpDamage,
        shieldDamage: Number(shieldDamage.toFixed(3)),
        expectedDamage: Number(expectedImpactDamage.toFixed(3)),
        expectedHpDamage: Number(expectedHpDamage.toFixed(3)),
        hitProbability: Number(impactProbability.toFixed(4)),
        fullHitProbability: Number(fullHitProbability.toFixed(4)),
        grazeProbability: Number(grazeProbability.toFixed(4)),
        dodgeRate: Number(dodgeRate.toFixed(3)),
        segmentCount,
        segmentTriggerValue: 0,
        resistanceType: String(effect?.抗性类型 || '').trim(),
        effectiveDefense: Number(effectiveDefense.toFixed(3)),
        defenseStrip: Number(防御剥夺.toFixed(4)),
        spiritResistanceStrip: Number(精神抗性剥夺.toFixed(4)),
        formula: base.formula,
        formulaAttackValue: base.attackValue,
        formulaDefenseValue: base.defenseValue,
      };
    }

    function 计算有效增加闪避(原始加值 = 0) {
      const 数值 = Number(原始加值 || 0);
      if (!(数值 > 0)) return 数值;
      if (数值 <= 0.25) return 数值;
      return Math.min(0.45, 0.25 + (数值 - 0.25) * 0.4);
    }

    function 获取施法消耗系数(单位 = {}) {
      const 战斗效果列表 = 读取单位战斗效果列表(单位);
      return 战斗效果列表.reduce((倍率, 战斗效果) => {
        const 显式倍率 = Number(战斗效果?.cost_ratio || 1);
        const 增量倍率 = 1 + Math.max(0, Number(战斗效果?.cost_delta_ratio || 0));
        return Math.max(倍率, Number.isFinite(显式倍率) && 显式倍率 > 0 ? 显式倍率 : 1, 增量倍率);
      }, 1);
    }

    function 获取施法消耗绝对修正(单位 = {}) {
      return 读取单位战斗效果列表(单位).reduce((总和, 战斗效果) => 总和 + Number(战斗效果?.cost_delta || 0), 0);
    }

    function 获取动作前摇系数(单位 = {}) {
      const 战斗效果列表 = 读取单位战斗效果列表(单位);
      const 速度加成 = 战斗效果列表.reduce((总和, 战斗效果) => 总和 + Number(战斗效果?.cast_speed_bonus || 0), 0);
      const 速度惩罚 = 战斗效果列表.reduce((总和, 战斗效果) => 总和 + Number(战斗效果?.cast_speed_penalty || 0), 0);
      const 直接倍率 = 战斗效果列表.reduce((倍率, 战斗效果) => {
        const 前摇系数 = Number(战斗效果?.windup_ratio || 1);
        return Number.isFinite(前摇系数) && 前摇系数 > 0 ? 倍率 * 前摇系数 : 倍率;
      }, 1);
      const 维持前摇系数 = Math.max(1, Number(单位?.__维持前摇系数 || 1));
      const 合成倍率 = 直接倍率 * 维持前摇系数 * (1 - 速度加成 + 速度惩罚);
      return Math.max(0.25, Math.min(3, 合成倍率));
    }

    function 获取动作前摇绝对修正(单位 = {}) {
      return 读取单位战斗效果列表(单位).reduce((总和, 战斗效果) => 总和 + Number(战斗效果?.windup_delta || 0), 0);
    }

    function 动作免除经验前摇折扣(动作 = {}) {
      const 技能 = 动作?.skill && typeof 动作.skill === 'object' ? 动作.skill : {};
      const 动作类型 = String(动作?.action_type || 动作?.type || 技能?.name || '').trim();
      const 来源类别 = 读取战斗动作来源上下文(动作, 技能, '').来源类别;
      return (
        /领域/.test(动作类型) ||
        动作类型 === '穿戴装备' ||
        /斗铠|机甲/.test(动作类型) ||
        动作类型 === '武魂融合技' ||
        来源类别 === '武魂融合技'
      );
    }

    function 读取图鉴收集奖励档位() {
      const 图鉴数据 = getMvuValue('world.图鉴', {}) || {};
      const 数量 = 图鉴数据 && typeof 图鉴数据 === 'object' ? Object.keys(图鉴数据).length : 0;
      return Math.max(0, Math.min(6, Math.floor(数量 / 25)));
    }

    function 单位获得图鉴收集奖励(单位 = {}, 战斗数据 = {}) {
      if (!单位 || typeof 单位 !== 'object') return false;
      const 阵营 = 读取规划单位阵营(单位, 战斗数据 || {});
      if (阵营) return 阵营 === '玩家';
      return 是玩家操控角色(单位, 战斗数据 || {});
    }

    function 读取图鉴收集反应加成(单位 = {}, 战斗数据 = {}) {
      return 单位获得图鉴收集奖励(单位, 战斗数据) ? 读取图鉴收集奖励档位() * 0.01 : 0;
    }

    function 读取图鉴收集前摇折扣(单位 = {}, 战斗数据 = {}) {
      return 单位获得图鉴收集奖励(单位, 战斗数据) ? (读取图鉴收集奖励档位() / 6) * 0.04 : 0;
    }

    function 计算行为经验前摇折扣(单位 = {}, 目标 = null, 战斗数据 = null) {
      if (!单位 || !目标) return 0;
      const 战斗经验 = 计算行为战斗经验(单位, 目标, 战斗数据 || {});
      const 稳定度 = Math.max(0, Math.min(1, Number(战斗经验?.稳定度 ?? 0)));
      const 超出基准 = Math.max(0, 稳定度 - 0.45);
      const 基础折扣 = Math.min(0.2, (超出基准 / 0.55) * 0.2);
      return Math.min(0.24, 基础折扣 + 读取图鉴收集前摇折扣(单位, 战斗数据 || {}));
    }

    function 计算行为经验反应倍率(单位 = {}, 目标 = null, 战斗数据 = null) {
      if (!单位 || !目标) return 1;
      const 战斗经验 = 计算行为战斗经验(单位, 目标, 战斗数据 || {});
      const 稳定度 = Math.max(0, Math.min(1, Number(战斗经验?.稳定度 ?? 0)));
      const 超出基准 = Math.max(0, 稳定度 - 0.45);
      return 1 + Math.min(0.2, (超出基准 / 0.55) * 0.2) + 读取图鉴收集反应加成(单位, 战斗数据 || {});
    }

    function 套用动作实际前摇(单位, 动作, 目标 = null, 战斗数据 = null) {
      if (!动作 || typeof 动作 !== 'object' || 动作.前摇已结算 === true) return 动作;
      const 基础前摇 = Number(动作.cast_time ?? 动作.skill?.前摇 ?? 0) || 0;
      if (!(基础前摇 > 0)) {
        动作.前摇已结算 = true;
        return 动作;
      }
      const 前摇系数 = 获取动作前摇系数(单位);
      const 经验目标 = 目标 || 战斗数据?.参战者?.team_enemy?.[0] || null;
      const 技能 = 动作.skill || 动作.raw_skill || {};
      const 条件上下文 = {
        actor: 单位,
        caster: 单位,
        attacker: 单位,
        target: 经验目标,
        defender: 经验目标,
        action: 动作,
        skill: 技能,
        combatData: 战斗数据,
        当前行动: String(动作?.action_type || 动作?.type || 技能?.name || 技能?.魂技名 || '').trim(),
      };
      const 自身前摇修正 = 读取技能自身结算修正(技能, '前摇', 条件上下文);
      const 前摇绝对修正 = 获取动作前摇绝对修正(单位) + 自身前摇修正.绝对;
      const 经验折扣 = 动作免除经验前摇折扣(动作) ? 0 : 计算行为经验前摇折扣(单位, 经验目标, 战斗数据);
      动作.cast_time = Math.max(1, Math.round(基础前摇 * 前摇系数 * 自身前摇修正.倍率 * (1 - 经验折扣) + 前摇绝对修正));
      动作.前摇已结算 = true;
      return 动作;
    }

    function 套用动作队列实际前摇(单位, 动作, 目标 = null, 战斗数据 = null) {
      if (!动作 || typeof 动作 !== 'object') return 动作;
      if (Array.isArray(动作.pre_actions)) 动作.pre_actions.forEach(副动作 => 套用动作实际前摇(单位, 副动作, 目标, 战斗数据));
      return 套用动作实际前摇(单位, 动作, 目标, 战斗数据);
    }

    function isSupportLikeSkill(skill) {
      const mainType = inferMainTypeFromEffects(skill) || '';
      const skillType = getSkillType(skill);
      const hasFriendlyGrantable = skillCanGrantFriendlyMechanism(skill);
      const hasFriendlySupportPayload =
        skillTargetsFriendlySide(skill) &&
        getSkillEffects(skill).some(effect => isBattleAttributeSupportEffect(effect) || isBattleRecoverEffect(effect));
      return (
        ['增益类', '回复类', '防御类'].includes(mainType) ||
        ['辅助', '防御'].includes(skillType) ||
        hasFriendlyGrantable ||
        hasFriendlySupportPayload
      );
    }

    function 技能需要目标消耗上下文(skill = {}) {
      if (!skill) return false;
      if (isSupportLikeSkill(skill)) return true;
      const targetKind = inferSkillPrimaryTargetKind(skill);
      if (['自身', '友方单体', '友方群体', '敌方单体', '敌方群体', '全场'].includes(targetKind)) {
        return getSkillEffects(skill, { 行为规划: true }).some(effect => {
          const 原型 = String(effect?.原型 || '').trim();
          if (原型 === '伤害结算') return false;
          return !!原型;
        });
      }
      return false;
    }

    function createEmptyCombatEffectMap() {
      return {
        skip_turn: false,
        cannot_react: false,
        invincible: false,
        无视异常: false,
        skill_seal: false,
        探查屏蔽: false,
        dot_damage: 0,
        dot_damage_ratio: 0,
        armor_pen: 0,
        reaction_bonus: 0,
        reaction_penalty: 0,
        attacker_speed_bonus: 0,
        cast_speed_bonus: 0,
        cast_speed_penalty: 0,
        hit_bonus: 0,
        hit_penalty: 0,
        dodge_bonus: 0,
        dodge_penalty: 0,
        lock_level: 0,
        interrupt_bonus: 0,
        final_damage_mult: 1.0,
        received_damage_mult: 1.0,
        defense_strip: 0,
        spirit_resist_strip: 0,
        final_damage_bonus: 0,
        final_heal_mult: 1.0,
        final_heal_bonus: 0,
        shield_gain_mult: 1.0,
        shield_gain_bonus: 0,
        skill_effect_mult: 1.0,
        vit_gain_ratio: 0,
        sp_gain_ratio: 0,
        men_gain_ratio: 0,
        heal_block_ratio: 0,
        hot_heal_ratio: 0,
        cost_ratio: 1.0,
        cost_delta: 0,
        cost_delta_ratio: 0,
        windup_ratio: 1.0,
        windup_delta: 0,
        random_target_rate: 0,
        判断干扰强度: 0,
        索敌干扰强度: 0,
        stealth_level: 0,
        min_hp_floor: 0,
        death_save_count: 0,
        revive_count: 0,
        revive_heal_ratio: 0,
        damage_reflect_ratio: 0,
        damage_transfer_ratio: 0,
        damage_transfer_target: '',
        吸收来源: '',
        吸收资源: '',
        吸收转化效果: '',
        伤害吸收增幅上限: 0,
        damage_share_ratio: 0,
        damage_share_count: 0,
        cost_share_ratio: 0,
        cost_share_count: 0,
        damage_to_heal_ratio: 0,
        heal_to_damage_ratio: 0,
        heal_inversion_ratio: 0,
        invincible_tier_threshold: 0,
        每日触发次数上限: 0,
        bonus_true_damage_ratio: 0,
        element_seal_ratio: 0,
        misfortune_check_rate: 0,
        misfortune_backlash_ratio: 0,
        silence: false,
        disarm: false,
        blind: false,
        counter_attack_ratio: 0,
        damage_reduction: 0,
        block_count: 0,
        super_armor: false,
        action_lock_rounds: 0,
        interrupt_window: 0,
        multi_hit_count: 0,
        segment_damage_ratio: 0,
      };
    }

    function mergeCombatEffectMaps(base = createEmptyCombatEffectMap(), incoming = {}) {
      const seed = createEmptyCombatEffectMap();
      const result = { ...seed, ...(base || {}) };
      Object.entries(incoming || {}).forEach(([key, value]) => {
        if (!(key in seed) || value === undefined) return;
        if (['skip_turn', 'cannot_react', 'silence', 'disarm', 'blind', 'super_armor', 'invincible', '无视异常', 'skill_seal', '探查屏蔽'].includes(key)) {
          result[key] = !!result[key] || !!value;
          return;
        }
      if (
        [
          'final_damage_mult',
          'received_damage_mult',
          'final_heal_mult',
          'shield_gain_mult',
          'skill_effect_mult',
          'cost_ratio',
          'windup_ratio',
        ].includes(key)
      ) {
        result[key] = Number(result[key] ?? 1) * Number(value ?? 1);
        return;
      }
      if (['defense_strip', 'spirit_resist_strip'].includes(key)) {
        result[key] = Math.max(Number(result[key] ?? 0), Number(value ?? 0));
        return;
      }
      if (key === 'cost_delta_ratio') {
        result[key] = Math.max(Number(result[key] ?? 0), Number(value ?? 0));
        return;
      }
      if (['damage_transfer_target', '吸收来源', '吸收资源', '吸收转化效果'].includes(key)) {
        result[key] = String(value || result[key] || '').trim();
        return;
      }
        if (
          [
            'lock_level',
            'death_save_count',
            'revive_count',
            'block_count',
            'min_hp_floor',
            'damage_share_count',
            'cost_share_count',
            'invincible_tier_threshold',
            '每日触发次数上限',
            'action_lock_rounds',
            'multi_hit_count',
          ].includes(key)
        ) {
          result[key] = Math.max(Number(result[key] ?? 0), Number(value ?? 0));
          return;
        }
        result[key] = Number(result[key] ?? 0) + Number(value ?? 0);
      });
      return result;
    }

    function hasMeaningfulCombatEffect(effectMap = {}) {
      const seed = createEmptyCombatEffectMap();
      return Object.keys(seed).some(key => {
        if (['skip_turn', 'cannot_react', 'silence', 'disarm', 'blind', 'super_armor', 'invincible', '无视异常', 'skill_seal', '探查屏蔽'].includes(key)) {
          return !!effectMap[key];
        }
        const baseValue = Number(seed[key] ?? 0);
        const nextValue = Number(effectMap[key] ?? seed[key] ?? 0);
        return nextValue !== baseValue;
      });
    }

    function isBattleSkillSummaryEffect(effect = {}) {
      if (!effect || typeof effect !== 'object' || Array.isArray(effect)) return false;
      const mechanism = String(effect?.原型 || '').trim();
      if (!mechanism || mechanism === '系统基础') return false;
      if (effect?.原型 && BATTLE_PROTOTYPE_REGISTRY[String(effect.原型).trim()]) return true;
        if (mechanism === '状态施加') {
        const stateName = String(effect?.状态名称 || '').trim();
        const duration = Math.max(0, Number(effect?.持续回合 ?? 0));
        const calc = effect?.计算层效果 && typeof effect.计算层效果 === 'object' ? effect.计算层效果 : {};
        const panelMods = effect?.面板修改比例 && typeof effect.面板修改比例 === 'object' ? effect.面板修改比例 : {};
        const panelDeltas = effect?.面板固定修正 && typeof effect.面板固定修正 === 'object' ? effect.面板固定修正 : {};
        const hasPanelDelta = Object.values(panelMods).some(value => Math.abs(Number(value || 1) - 1) > 0.001);
        const hasFixedDelta = Object.values(panelDeltas).some(value => Math.abs(Number(value || 0)) > 0.001);
        const hasCalc = hasMeaningfulCombatEffect(calc);
        const hasStateHint = String(effect?.特殊机制标识 || '').trim() && String(effect?.特殊机制标识 || '').trim() !== '无';
        return !!(stateName || duration > 0 || hasPanelDelta || hasFixedDelta || hasCalc || hasStateHint);
      }
      const runtimeMeta = getBattleEffectRuntimeMeta(effect);
      if (runtimeMeta && String(runtimeMeta?.运行时消费器 || '').trim()) return true;
      if (effect?.计算层效果 && typeof effect.计算层效果 === 'object' && hasMeaningfulCombatEffect(effect.计算层效果)) return true;
      if (effect?.战斗效果 && typeof effect.战斗效果 === 'object' && hasMeaningfulCombatEffect(effect.战斗效果)) return true;
      const duration = Math.max(0, Number(effect?.持续回合 ?? 0));
      if (duration > 0) return true;
      const keywords = ['状态名称', '伤害类型', '威力倍率', '护盾值', '数值', '动作', '资源类型', '抹消对象', '实体名称', '核心机制描述'];
      return keywords.some(key => {
        const value = effect?.[key];
        if (value === undefined || value === null) return false;
        if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) > 0;
        const text = String(value).trim();
        return !!text && text !== '无';
      });
    }

    function 无视异常阻断负面或削减(目标 = {}, 条目 = {}) {
      if (!目标?.状态效果) return false;
      const 战斗效果列表 = Object.values(目标.状态效果).map(状态 => 状态?.战斗效果 || {});
      if (!战斗效果列表.some(战斗效果 => 战斗效果?.无视异常 === true)) return false;
      const 类型 = String(条目?.类型 || '').trim();
      const 原型 = String(条目?.原型 || 条目?.来源原型摘要 || '').trim();
      const 计算层效果 = 条目?.战斗效果 || 条目?.计算层效果 || {};
      if (类型 === 'debuff') return true;
      if (原型 === '状态施加' && 类型 !== 'buff') return true;
      if (['属性修正', '判定修正', '资源锁定', '决策干扰', '机制抹消'].includes(原型)) return true;
      if (原型 === '资源变化' && 读取战斗数值正负(条目?.数值) < 0) return true;
      if (原型 === '护盾变化' && 读取战斗数值正负(条目?.数值) < 0) return true;
      if (原型 === '结算修正') {
        const 结算 = String(条目?.结算 || '').trim();
        const 数值 = 读取战斗数值正负(条目?.数值);
        if (['受到伤害', '消耗', '前摇', '治疗转伤害', '防御剥夺', '精神抗性剥夺', '持续伤害引爆'].includes(结算)) return true;
        if (['造成伤害', '治疗', '技能效果'].includes(结算) && 数值 < 0) return true;
      }
      return [
        'skip_turn',
        'cannot_react',
        'silence',
        'disarm',
        'blind',
        'skill_seal',
      ].some(key => 计算层效果?.[key] === true) ||
        ['reaction_penalty', 'hit_penalty', 'dodge_penalty', 'cast_speed_penalty', 'defense_strip', 'spirit_resist_strip', 'random_target_rate', 'lock_level', 'cost_delta_ratio', 'heal_block_ratio', 'heal_inversion_ratio'].some(key => Number(计算层效果?.[key] || 0) > 0);
    }

    function 读取战斗效果标签(effect = {}) {
      const 原型 = String(effect?.原型 || '').trim();
      if (原型 === '判定修正' && effect?.打断效果 === true && 读取战斗数值正负(effect?.数值) < 0) return '打断';
      return 原型;
    }

    function getBattleSkillSummaryEffects(skill = {}) {
      const effects = getSkillEffects(skill)
        .filter(effect => isBattleSkillSummaryEffect(effect))
        .map(effect => {
          const mechanism = 读取战斗效果标签(effect);
          const runtimeMeta = getBattleEffectRuntimeMeta(effect) || {};
          const targetKind = 推断战斗效果目标类型(effect);
          const targetScale = normalizeBattleSkillTargetScale(
            deriveBattleSkillTargetScaleFromKind(targetKind),
            deriveBattleSkillTargetScaleFromKind(targetKind),
          );
          const duration = Math.max(0, Number(effect?.持续回合 ?? 0));
          const calc = effect?.计算层效果 && typeof effect.计算层效果 === 'object'
            ? mergeCombatEffectMaps(createEmptyCombatEffectMap(), effect.计算层效果 || {})
            : createEmptyCombatEffectMap();
          const hint = runtimeMeta?.摘要提示 && typeof runtimeMeta.摘要提示 === 'object'
            ? { ...runtimeMeta.摘要提示 }
            : {};
          const stateName = String(effect?.状态名称 || '').trim();
          const stateFlag = String(effect?.特殊机制标识 || '').trim();
          return Object.freeze({
            标签: mechanism,
            运行时消费器: String(runtimeMeta?.运行时消费器 || '').trim(),
            目标语义: String(runtimeMeta?.目标语义 || '').trim() || 读取战斗效果运行语义(effect),
            目标: 归一化执行效果作用目标_V1(targetKind, '单体'),
            目标规模: targetScale,
            持续回合: duration,
            状态名称: stateName || mechanism,
            状态标识: stateFlag && stateFlag !== '无' ? stateFlag : '',
            计算层效果: calc,
            关键参数: {
              威力倍率: Number(effect?.威力倍率 || 0),
              护盾值: Number(effect?.护盾值 || 0),
              数值: Number(effect?.数值 || 0),
              资源类型: String(effect?.资源类型 || '').trim(),
              实体名称: String(effect?.实体名称 || '').trim(),
            },
            摘要提示: hint,
            原始效果: effect,
          });
        });
      const uniqueMap = new Map();
      effects.forEach(entry => {
          const key = [
          String(entry?.标签 || '').trim(),
          String(entry?.目标 || '').trim(),
          String(entry?.状态名称 || '').trim(),
          String(entry?.持续回合 || 0),
          String(entry?.状态标识 || '').trim(),
        ].join('|');
        if (!uniqueMap.has(key)) uniqueMap.set(key, entry);
      });
      return Array.from(uniqueMap.values());
    }

    function getBattleSkillSummaryEffectByMechanism(skill = {}, mechanism = '') {
      const normalized = String(mechanism || '').trim();
      if (!normalized) return null;
      return getBattleSkillSummaryEffects(skill).find(effect => 读取战斗效果标签(effect?.原始效果 || effect) === normalized || String(effect?.标签 || '').trim() === normalized) || null;
    }

    function 读取条件分支单位字段(unit = {}, field = '') {
      const stats = unit?.属性 && typeof unit.属性 === 'object' ? unit.属性 : {};
      const key = String(field || '').trim();
      if (!key) return '';
      if (unit[key] !== undefined) return unit[key];
      if (stats[key] !== undefined) return stats[key];
      return '';
    }

    function 读取条件分支状态表(unit = {}) {
      const direct = unit?.状态效果 && typeof unit.状态效果 === 'object' ? unit.状态效果 : null;
      const stats = unit?.属性 && typeof unit.属性 === 'object' ? unit.属性 : {};
      return direct || (stats?.状态效果 && typeof stats.状态效果 === 'object' ? stats.状态效果 : {});
    }

    function 读取条件分支单位文本(unit = {}) {
      if (!unit || typeof unit !== 'object') return '';
      const 文本列表 = [];
      const 追加 = value => {
        const 文本 = String(value || '').trim();
        if (文本) 文本列表.push(文本);
      };
      [
        unit.name,
        unit.名称,
        unit.id,
        unit.单位性质,
        unit.类型,
        unit.身份,
        unit.来源,
        unit.标准物种,
        unit.具体物种,
        unit.种族,
        unit.称号,
        unit.境界,
        unit.type,
        unit.系别,
        unit?.属性?.标准物种,
        unit?.属性?.具体物种,
        unit?.属性?.种族,
      ].forEach(追加);
      ['第1武魂', '第2武魂'].forEach(槽位 => {
        const 武魂 = unit?.[槽位];
        if (!武魂 || typeof 武魂 !== 'object') return;
        [武魂.名称, 武魂.武魂, 武魂.表象名称, 武魂.描述, 武魂.系别, 武魂.属性体系].forEach(追加);
      });
      Object.keys(unit?.社交?.势力 || {}).forEach(追加);
      return 文本列表.join(' ');
    }

    function 判断条件分支单位文本(unit = {}, value = '', op = '包含') {
      const 条件值 = String(value || '').trim();
      if (!条件值) return false;
      const 单位文本 = 读取条件分支单位文本(unit);
      const 命中 = 单位文本.includes(条件值);
      if (op === '无' || op === '!=') return !命中;
      if (op === '有' || op === '包含') return 命中;
      return 单位文本 === 条件值;
    }

    function 条件分支状态存在命中(stateMap = {}, 状态名 = '', 比较 = '包含') {
      const 状态列表 = Object.values(stateMap || {}).filter(state => state && typeof state === 'object');
      const 名称 = String(状态名 || '').trim() || '任意状态';
      const 存在 =
        名称 === '任意状态'
          ? 状态列表.length > 0
          : 名称 === '任意负面'
            ? 状态列表.some(state => String(state?.类型 || '').trim() === 'debuff')
            : 名称 === '任意增益'
              ? 状态列表.some(state => String(state?.类型 || '').trim() === 'buff')
              : !!(
                  stateMap?.[名称] ||
                  状态列表.find(state => {
                    const safeState = state && typeof state === 'object' ? state : {};
                    if (String(safeState.状态 || safeState.状态名称 || '').trim() === 名称) return true;
                    if (['持续创伤', '中毒', '流血', '灼烧', '冻伤'].includes(名称)) return 战斗效果含结构化持续伤害(safeState);
                    return false;
                  })
                );
      return 比较 === '无' ? !存在 : 存在;
    }

    function 解析条件分支对象(对象 = '目标', context = {}) {
      const key = String(对象 || '目标').trim();
      if (key === '自身') return context.actor || context.caster || null;
      if (key === '施术者') return context.caster || context.actor || null;
      if (key === '命中目标') return context.hitTarget || context.target || null;
      if (key === '召唤物') return context.summon || context.target || null;
      return context.target || null;
    }

    function 读取条件分支当前行动(context = {}) {
      const action = context?.action || context?.动作 || null;
      const skill = action?.skill || context?.skill || null;
      const 原始行动 = String(
        action?.action_type ||
        action?.type ||
        skill?.name ||
        skill?.魂技名 ||
        context?.当前行动 ||
        '',
      ).trim();
      const 行动别名 = {
        技能: '释放魂技',
        释放技能: '释放魂技',
        普通攻击: '常规攻击',
        普攻: '常规攻击',
        食用: '食用物品',
        即食: '食用物品',
        使用: '使用物品',
        装备: '穿戴装备',
      };
      return 行动别名[原始行动] || 原始行动;
    }

    function 比较条件分支数值(left, operator = '==', right = '') {
      const op = String(operator || '==').trim();
      if (op === '有') return !!left && left !== '无' && left !== '否';
      if (op === '无') return !left || left === '无' || left === '否';
      const leftNumber = /%$/.test(String(left)) ? Number(String(left).replace('%', '')) / 100 : Number(left);
      const rightNumber = /%$/.test(String(right)) ? Number(String(right).replace('%', '')) / 100 : Number(right);
      if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
        if (op === '>') return leftNumber > rightNumber;
        if (op === '>=') return leftNumber >= rightNumber;
        if (op === '<') return leftNumber < rightNumber;
        if (op === '<=') return leftNumber <= rightNumber;
        if (op === '!=') return leftNumber !== rightNumber;
        return leftNumber === rightNumber;
      }
      const leftText = String(left ?? '').trim();
      const rightText = String(right ?? '').trim();
      if (op === '!=') return leftText !== rightText;
      return leftText === rightText;
    }

    function 读取条件分支资源值(unit = {}, type = '生命比例') {
      const resourceMap = {
        生命: ['HP', 'hp'],
        体力: ['sta', 'vit', '体力'],
        魂力: ['sp', '魂力'],
        精神力: ['men', '精神力'],
      };
      const label = type.replace(/比例|数值/g, '') || '生命';
      const keys = resourceMap[label] || resourceMap.生命;
      const current = Math.max(0, Number(keys.map(key => 读取条件分支单位字段(unit, key)).find(value => Number(value) > 0) || 0));
      if (/数值$/.test(type)) return current;
      const maxKeys = label === '生命'
        ? ['HP上限', 'hp_max']
        : keys.map(key => `${key}_max`).concat(`${label}上限`);
      const max = Math.max(1, Number(maxKeys.map(key => 读取条件分支单位字段(unit, key)).find(value => Number(value) > 0) || 1));
      return current / max;
    }

    function 读取条件分支环境文本(context = {}) {
      return [
        context?.环境,
        context?.battleEnvironment,
        context?.combatData?.环境,
        context?.combatData?.战斗环境,
        context?.action?.环境,
        context?.skill?.环境,
        window.BattleUIBridge?.getBattleContext?.()?.环境,
        window.BattleUIBridge?.getMVU?.('world.战斗.环境'),
      ].map(value => String(value || '').trim()).filter(Boolean).join(' ');
    }

    function 判断条件分支环境满足(value = '', op = '==', context = {}) {
      const 环境值 = String(value || '').trim();
      if (!环境值) return false;
      const 环境文本 = 读取条件分支环境文本(context);
      const 命中 = 环境文本.includes(环境值);
      return op === '!=' || op === '无' ? !命中 : 命中;
    }

    function 读取条件分支当前tick(context = {}) {
      const 候选列表 = [
        context?.tick,
        context?.当前tick,
        context?.combatData?.tick,
        context?.combatData?.当前tick,
        context?.combatData?.时间?.tick,
        window.BattleUIBridge?.getMVU?.('world.时间.tick'),
      ];
      for (const 候选 of 候选列表) {
        const 数值 = Number(候选);
        if (Number.isFinite(数值) && 数值 >= 0) return Math.floor(数值);
      }
      return 0;
    }

    function 读取条件分支时间标签列表(context = {}) {
      const tick = 读取条件分支当前tick(context);
      const 当日分钟 = ((tick * 10) % 1440 + 1440) % 1440;
      const 小时 = Math.floor(当日分钟 / 60);
      const 标签 = [];
      if (小时 >= 6 && 小时 < 18) 标签.push('白天');
      else 标签.push('黑夜');
      if (小时 >= 5 && 小时 < 8) 标签.push('清晨');
      if (小时 >= 8 && 小时 < 11) 标签.push('上午');
      if (小时 >= 11 && 小时 < 13) 标签.push('中午');
      if (小时 >= 13 && 小时 < 17) 标签.push('下午');
      if (小时 >= 17 && 小时 < 19) 标签.push('黄昏');
      if (小时 >= 19 && 小时 < 23) 标签.push('夜晚');
      if (小时 >= 23 || 小时 < 5) 标签.push('深夜');
      return 标签;
    }

    function 判断条件分支时间(value = '', op = '==', context = {}) {
      const 条件值 = String(value || '').trim();
      if (!条件值) return false;
      const 命中 = 读取条件分支时间标签列表(context).includes(条件值);
      return op === '!=' || op === '无' ? !命中 : 命中;
    }

    function 判断条件分支装备状态(unit = {}, value = '', op = '==') {
      const 装备 = unit?.装备 || {};
      const 武器 = 装备?.武器;
      const 防具 = 装备?.防具;
      const 斗铠 = 装备?.斗铠;
      const 机甲 = 装备?.机甲;
      const 条件值 = String(value || '').trim();
      let 命中 = false;
      if (条件值 === '已装备主武器') {
        命中 = !!(
          (武器 && typeof 武器 === 'object' && String(武器?.名称 || 武器?.name || 武器?.id || '').trim() && String(武器?.装备状态 || '已装备').trim() !== '未装备') ||
          (typeof 武器 === 'string' && 武器.trim() && 武器.trim() !== '无')
        );
      } else if (条件值 === '已装备斗铠') {
        命中 = String(斗铠?.装备状态 || '').trim() === '已装备';
      } else if (条件值 === '已装备机甲') {
        命中 = String(机甲?.装备状态 || '').trim() === '已装备' && String(机甲?.状态 || '').trim() !== '重创';
      } else if (条件值 === '已装备防具') {
        const 防具名 = String(防具?.名称 || 防具?.name || '').trim();
        命中 = String(防具?.装备状态 || '').trim() === '已装备' && !!防具名 && 防具名 !== '无';
      }
      return op === '!=' || op === '无' ? !命中 : 命中;
    }

    function 判断条件分支自身状态(unit = {}, value = '', op = '==') {
      const 条件值 = String(value || '').trim();
      const 状态文本 = JSON.stringify(读取条件分支状态表(unit) || {});
      let 命中 = false;
      if (条件值 === '蓄力中') {
        命中 = !!unit?.蓄力技能 || Number(unit?.蓄力剩余 || unit?.cast_time_left || 0) > 0;
      } else if (条件值 === '隐匿中') {
        命中 = /隐匿|隐身|潜行/.test(状态文本) || Number(unit?.stealth_level || unit?.隐匿等级 || 0) > 0;
      }
      return op === '!=' || op === '无' ? !命中 : 命中;
    }

    function 判断条件分支控制态(unit = {}) {
      const 状态表 = 读取条件分支状态表(unit);
      const 状态文本 = JSON.stringify(状态表 || {});
      return /眩晕|沉默|缴械|封技|硬控|束缚|禁锢|定身|控制|迟缓|位移限制/.test(状态文本) ||
        Object.values(状态表 || {}).some(state => {
          const safeState = state && typeof state === 'object' ? state : {};
          const 战斗效果 = safeState.战斗效果 && typeof safeState.战斗效果 === 'object' ? safeState.战斗效果 : {};
          return !!(战斗效果.cannot_react || 战斗效果.skip_turn || 战斗效果.disarm || 战斗效果.silence);
        });
    }

    function 判断条件分支连携前提(unit = {}, value = '', op = '==', context = {}) {
      const 条件值 = String(value || '').trim();
      let 命中 = false;
      if (条件值 === '上一动作命中') {
        命中 = context?.上一动作命中 === true || context?.actor?.__上一动作命中 === true || context?.caster?.__上一动作命中 === true;
      } else if (条件值 === '目标被控制') {
        命中 = 判断条件分支控制态(unit || context?.target || {});
      }
      return op === '!=' || op === '无' ? !命中 : 命中;
    }

    function 判断条件分支目标(目标 = '', unit = {}, context = {}) {
      const value = String(目标 || '自身').trim();
      if (value === '全场') return true;
      const actor = context.actor || context.caster || null;
      const target = unit || context.target || null;
      const actorId = String(actor?.name || actor?.id || '').trim();
      const targetId = String(target?.name || target?.id || '').trim();
      const sameActor = !!actor && !!target && (actor === target || (actorId && actorId === targetId));
      if (value === '自身') return sameActor;
      if (value === '他人') return !!target && !sameActor;
      if (value === '召唤物') return !!target && (target === context.summon || /召唤/.test(String(target?.类型 || target?.身份 || target?.来源 || '')));
      if (value === '己方' || value === '敌方') {
        const actorFaction = String(读取条件分支单位字段(actor, '势力') || 读取条件分支单位字段(actor, '阵营') || '').trim();
        const targetFaction = String(读取条件分支单位字段(target, '势力') || 读取条件分支单位字段(target, '阵营') || '').trim();
        if (!actorFaction || !targetFaction) return value === '己方' ? sameActor : !sameActor;
        const sameFaction = actorFaction === targetFaction;
        return value === '己方' ? sameFaction : !sameFaction;
      }
      return false;
    }

    function 条件分支命中(condition = {}, context = {}) {
      if (!condition || typeof condition !== 'object') return false;
      const type = String(condition.类型 || '').trim();
      const unit = 解析条件分支对象(condition.对象 || '目标', context);
      const op = String(condition.比较 || '==').trim() || '==';
      const value = condition.值 ?? '';
      if (type === '目标') return 判断条件分支目标(value, unit, context);
      if (type === '环境满足') return 判断条件分支环境满足(value, op, context);
      if (type === '时间') return 判断条件分支时间(value, op, context);
      if (type === '当前技能元素') {
        const 元素结构 = getBattleSkillElementStructure(context?.skill || {});
        const 当前元素列表 = normalizeBattleSkillAttributeTokens([
          ...(Array.isArray(context?.skill?.附带属性) ? context.skill.附带属性 : [context?.skill?.附带属性]),
          getBattleSkillAttributeSummary(context?.skill || {}).显示元素,
          ...(元素结构.核心元素 || []),
          ...(元素结构.驱动元素 || []),
          ...(元素结构.触发元素 || []),
        ]);
        const 要求元素列表 = normalizeBattleSkillAttributeTokens(value || condition.元素 || '');
        if (!要求元素列表.length) return false;
        return op === '无'
          ? 要求元素列表.every(元素 => !当前元素列表.includes(元素))
          : 要求元素列表.some(元素 => 当前元素列表.includes(元素));
      }
      if (!unit && !['当前行动', '命中', '被闪避', '暴击'].includes(type)) return false;
      if (type === '当前行动') return 比较条件分支数值(读取条件分支当前行动(context), op, value);
      if (/^(生命|体力|魂力|精神力)(比例|数值)$/.test(type)) return 比较条件分支数值(读取条件分支资源值(unit, type), op, value);
      if (type === '装备状态') return 判断条件分支装备状态(unit, value, op);
      if (type === '自身状态') return 判断条件分支自身状态(unit, value, op);
      if (type === '连携前提') return 判断条件分支连携前提(unit, value, op, context);
      if (type === '单位文本') return 判断条件分支单位文本(unit, value, op);
      if (type === '状态存在') {
        const stateMap = 读取条件分支状态表(unit);
        return 条件分支状态存在命中(stateMap, condition.状态 || value, op);
      }
      if (type === '护盾') {
        const hasShield = Object.values(读取条件分支状态表(unit)).some(state => {
          const safeState = state && typeof state === 'object' ? state : {};
          return Number(safeState.shield_value || safeState.shield || 0) > 0 || /护盾/.test(String(safeState.类型 || ''));
        });
        return op === '无' ? !hasShield : hasShield;
      }
      if (type === '命中') return op === '无' ? !context.hit : !!context.hit;
      if (type === '被闪避') return op === '无' ? !context.evaded : !!context.evaded;
      if (type === '暴击') return op === '无' ? !(context.critical || context.暴击) : !!(context.critical || context.暴击);
      return false;
    }

    function 展开条件分支效果(effect = {}, context = {}) {
      const branches = Array.isArray(effect?.条件分支) ? effect.条件分支 : [];
      if (!branches.length) return [effect];
      const 生效分支列表 = branches.filter(branch => String(branch?.处理 || '').trim() === '生效');
      if (生效分支列表.length) {
        const 命中生效门 = 生效分支列表.some(branch => {
          const conditions = Array.isArray(branch?.条件) ? branch.条件 : [];
          return conditions.length && conditions.every(condition => 条件分支命中(condition, context));
        });
        if (!命中生效门) return [];
      }
      let result = [effect];
      for (const branch of branches) {
        const conditions = Array.isArray(branch?.条件) ? branch.条件 : [];
        if (!conditions.length || !conditions.every(condition => 条件分支命中(condition, context))) continue;
        const action = String(branch?.处理 || '').trim();
        if (action === '生效') continue;
        if (action === '禁用') return [];
        if (action === '替换效果') return Array.isArray(branch?.替换效果) ? branch.替换效果 : [];
        if (action === '追加效果' && Array.isArray(branch?.追加效果)) result = [...result, ...branch.追加效果];
      }
      return result;
    }

    function getSkillEffects(skill, context = {}) {
      if (Array.isArray(skill?.__规划水合效果数组)) {
        return skill.__规划水合效果数组.filter(effect => effect && typeof effect === 'object');
      }
      const isStandardRuntimeSkill = skill?.__战斗标准技能 === true;
      const 原始效果列表 = Array.isArray(skill?._效果数组) ? skill._效果数组 : [];
      const 断言正式效果输入 = (value, path = '_效果数组', insideCondition = false) => {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) {
          value.forEach((item, index) => 断言正式效果输入(item, `${path}[${index}]`, insideCondition));
          return;
        }
        const 禁止字段 = ['运行机制', '状态名称', 'cast_time', '消耗倍率', '前摇倍率', '机制标签', '结算策略'];
        const 命中字段 = 禁止字段.find(字段 => Object.prototype.hasOwnProperty.call(value, 字段));
        if (命中字段) throw new Error(`技能正式效果错误:${skill?.魂技名 || skill?.name || '未命名技能'}:${path}仍写入旧字段${命中字段}`);
        if (!insideCondition && Object.prototype.hasOwnProperty.call(value, '对象')) {
          throw new Error(`技能正式效果错误:${path}仍写入旧字段对象`);
        }
        Object.entries(value).forEach(([key, raw]) => {
          const 下级条件 = insideCondition || key === '条件';
          const 是效果槽 = ['使用效果', '授予效果', '结算效果', '替换效果', '追加效果'].includes(key);
          const 是条件分支 = key === '条件分支';
        if (raw && typeof raw === 'object' && (是效果槽 || 是条件分支 || key === '条件')) {
            断言正式效果输入(raw, `${path}.${key}`, 下级条件);
          }
        });
      };
      if (!isStandardRuntimeSkill) 断言正式效果输入(原始效果列表);
      if (原始效果列表.length) BATTLE_RUNTIME.assertSkillEffects(skill);
      const 来源效果列表 = String(skill?.承载方式 || '').trim() === '造物承载'
        ? []
        : 原始效果列表.filter(effect => effect && typeof effect === 'object' && String(effect?.原型 || '').trim());
      const shouldKeepByEffectiveMode = effect => {
        if (String(effect?.生效方式 || '').trim() !== '跟随主原型') return true;
        if (context?.行为规划 === true) return true;
        if (context?.排除跟随主原型 === true) return false;
        if (Object.prototype.hasOwnProperty.call(context || {}, 'hit')) return !!context.hit;
        if (Object.prototype.hasOwnProperty.call(context || {}, '命中')) return !!context.命中;
        if (Object.prototype.hasOwnProperty.call(context || {}, '主原型成立')) return !!context.主原型成立;
        return true;
      };
      return 来源效果列表
        .filter(shouldKeepByEffectiveMode)
        .flatMap(effect => 展开条件分支效果(effect, context))
        .filter(shouldKeepByEffectiveMode)
        .flatMap(effect => 展开战斗原型数组字段(effect))
        .map(effect => hydrateBattleExecutionEffectEntry(effect, { ...context, skill }))
        .filter(effect => !物品非伤害效果超过对应等级(effect, { ...context, skill }))
        .map(effect => 应用战斗原型驱动判定(effect, { ...context, skill }))
        .filter(Boolean);
    }

    function 读取战斗效果来源ID(effect = {}, effectIndex = 0) {
      const prototype = String(effect?.原型 || 'effect').trim() || 'effect';
      return String(effect?.effectId || effect?.sourceEffectId || `${prototype}:${Math.max(0, Number(effectIndex || 0))}`).trim();
    }

    function 技能效果依赖当前行动条件(effect = {}) {
      if (!effect || typeof effect !== 'object') return false;
      const 分支列表 = Array.isArray(effect?.条件分支) ? effect.条件分支 : [];
      if (分支列表.some(分支 =>
        (Array.isArray(分支?.条件) ? 分支.条件 : []).some(条件 => String(条件?.类型 || '').trim() === '当前行动')
      )) {
        return true;
      }
      return ['使用效果', '授予效果', '结算效果'].some(字段 =>
        Array.isArray(effect?.[字段]) && effect[字段].some(内层 => 技能效果依赖当前行动条件(内层))
      );
    }

    function 收集当前行动被动效果(角色 = {}, alliedTeam = [], context = {}) {
      if (!角色 || typeof 角色 !== 'object') return [];
      const 结果 = [];
      collectPassiveCombatSkills(角色, alliedTeam).forEach(skill => {
        const 来源效果 = Array.isArray(skill?._效果数组) ? skill._效果数组 : [];
        const 当前行动效果 = 来源效果.filter(effect =>
          技能效果依赖当前行动条件(effect) ||
          String(effect?.原型 || '').trim() === '结算修正' ||
          (String(effect?.原型 || '').trim() === '资源变化' && Array.isArray(effect?.条件分支) && effect.条件分支.length > 0)
        );
        if (!当前行动效果.length) return;
        const 临时技能 = {
          ...cloneBattleValue(skill),
          _效果数组: cloneBattleValue(当前行动效果),
        };
        const 生效效果列表 = getSkillEffects(临时技能, context);
        if (!生效效果列表.length) return;
        const 技能名 = String(skill?.name || skill?.魂技名 || '被动技能').trim() || '被动技能';
        const 效果触发限制列表 = Array.from(new Map(
          生效效果列表
            .map(effect => effect?.触发限制 && typeof effect.触发限制 === 'object' && !Array.isArray(effect.触发限制) ? effect.触发限制 : null)
            .filter(Boolean)
            .map(限制 => [`${String(限制.周期 || '').trim()}:${Math.max(0, Math.floor(Number(限制.次数 || 0)))}`, 限制]),
        ).values());
        const 命中限制列表 = [];
        for (const 触发限制 of 效果触发限制列表) {
          const 周期 = String(触发限制.周期 || '').trim();
          const 次数 = Math.max(0, Math.floor(Number(触发限制.次数 || 0)));
          if (!(次数 > 0 && ['每日', '每战', '每回合', '每次行动'].includes(周期))) continue;
          const 限制态 = 角色.__技能限制运行态 ||= {};
          const 技能限制态 = 限制态[`被动:${技能名}:${周期}:${次数}`] ||= { 已用次数: 0 };
          if (Number(技能限制态.已用次数 || 0) >= 次数) return;
          命中限制列表.push(技能限制态);
        }
        命中限制列表.forEach(技能限制态 => {
          技能限制态.已用次数 = Math.max(0, Number(技能限制态.已用次数 || 0)) + 1;
        });
        生效效果列表.forEach(effect => {
          if (!effect || typeof effect !== 'object') return;
          结果.push({ ...effect, __当前行动被动来源: String(skill?.name || skill?.魂技名 || '被动技能').trim() || '被动技能' });
        });
      });
      return 结果;
    }

    const BATTLE_SKILL_DEFAULT_ATTRIBUTE_COEFF = Object.freeze({
      掌控: 1,
      威力: 1,
      消耗: 1,
      前摇: 1,
      控制: 1,
      速度: 1,
    });
    const BATTLE_SKILL_ATTRIBUTE_COEFF_MAP = Object.freeze({
      金: Object.freeze({ 掌控: 1.02, 威力: 1.08, 消耗: 1.0, 前摇: 0.98, 控制: 0.98, 速度: 1.02 }),
      木: Object.freeze({ 掌控: 1.08, 威力: 0.96, 消耗: 0.96, 前摇: 1.0, 控制: 1.05, 速度: 1.0 }),
      水: Object.freeze({ 掌控: 1.06, 威力: 0.98, 消耗: 0.95, 前摇: 1.0, 控制: 1.04, 速度: 1.0 }),
      火: Object.freeze({ 掌控: 0.96, 威力: 1.15, 消耗: 1.06, 前摇: 1.0, 控制: 0.95, 速度: 1.02 }),
      土: Object.freeze({ 掌控: 1.0, 威力: 1.05, 消耗: 1.0, 前摇: 1.04, 控制: 1.02, 速度: 0.95 }),
      雷: Object.freeze({ 掌控: 1.0, 威力: 1.1, 消耗: 1.03, 前摇: 0.92, 控制: 0.98, 速度: 1.12 }),
      冰: Object.freeze({ 掌控: 1.04, 威力: 1.02, 消耗: 1.0, 前摇: 1.02, 控制: 1.12, 速度: 0.95 }),
      风: Object.freeze({ 掌控: 1.0, 威力: 1.02, 消耗: 0.96, 前摇: 0.94, 控制: 0.98, 速度: 1.12 }),
      光: Object.freeze({ 掌控: 1.05, 威力: 1.03, 消耗: 0.98, 前摇: 0.98, 控制: 1.02, 速度: 1.0 }),
      暗: Object.freeze({ 掌控: 1.03, 威力: 1.08, 消耗: 1.02, 前摇: 0.98, 控制: 1.04, 速度: 1.0 }),
      精神: Object.freeze({ 掌控: 1.08, 威力: 1.02, 消耗: 1.0, 前摇: 0.98, 控制: 1.14, 速度: 1.0 }),
      空间: Object.freeze({ 掌控: 1.12, 威力: 1.0, 消耗: 1.08, 前摇: 0.96, 控制: 1.08, 速度: 1.02 }),
      时间: Object.freeze({ 掌控: 1.12, 威力: 1.0, 消耗: 1.08, 前摇: 0.9, 控制: 1.1, 速度: 1.08 }),
      创造: Object.freeze({ 掌控: 1.18, 威力: 1.12, 消耗: 1.1, 前摇: 1.0, 控制: 1.12, 速度: 1.0 }),
      毁灭: Object.freeze({ 掌控: 1.08, 威力: 1.22, 消耗: 1.14, 前摇: 1.04, 控制: 1.08, 速度: 0.98 }),
    });

    function normalizeBattleSkillAttributeToken(value = '') {
      const raw = String(value || '').trim();
      if (!raw || raw === '无') return '';
      if (raw === '五行类' || raw === '元素类') return raw;
      const aliasMap = {
        金系: '金',
        木系: '木',
        水系: '水',
        火系: '火',
        土系: '土',
        雷系: '雷',
        冰系: '冰',
        风系: '风',
        光系: '光',
        暗系: '暗',
        精神系: '精神',
        精神力: '精神',
        空间系: '空间',
        时间系: '时间',
        创造系: '创造',
        毁灭系: '毁灭',
        光明: '光',
        黑暗: '暗',
        创世: '创造',
        灭世: '毁灭',
      };
      const normalized = aliasMap[raw] || raw;
      return BATTLE_SKILL_ATTRIBUTE_COEFF_MAP[normalized] ? normalized : '';
    }

    function normalizeBattleSkillAttributeTokens(list = []) {
      const source = Array.isArray(list) ? list : String(list || '').split(/[、,，/|｜；;\s]+/g);
      const expandMap = {
        五行类: ['金', '木', '水', '火', '土'],
        元素类: ['水', '火', '风', '土', '光', '暗'],
      };
      return Array.from(new Set(source
        .map(normalizeBattleSkillAttributeToken)
        .filter(Boolean)
        .flatMap(token => expandMap[token] || [token])));
    }


    const BATTLE_FUSION_BASE_ELEMENTS = Object.freeze(['水', '火', '风', '土']);
    const BATTLE_FUSION_ADVANCED_ELEMENTS = Object.freeze(['光', '暗', '空间']);
    const BATTLE_FUSION_LAW_ELEMENTS = Object.freeze(['创造', '毁灭']);
    const BATTLE_FUSION_ALLOWED_ELEMENTS = Object.freeze([
      ...BATTLE_FUSION_BASE_ELEMENTS,
      ...BATTLE_FUSION_ADVANCED_ELEMENTS,
      ...BATTLE_FUSION_LAW_ELEMENTS,
    ]);
    const BATTLE_FUSION_ELEMENT_ORDER = Object.freeze([...BATTLE_FUSION_ALLOWED_ELEMENTS]);
    const BATTLE_FUSION_SEMANTICS_MAP = Object.freeze({
      '水/火': Object.freeze({
        pattern: '水火蒸爆',
        multiplier: 1.18,
        failAdjust: 8,
        summary: '水火相激形成高压蒸爆，爆发显著提升。',
      }),
      '水/风': Object.freeze({
        pattern: '水风涡流',
        multiplier: 1.1,
        failAdjust: -4,
        summary: '水借风势形成涡流，融合稳定性更高。',
      }),
      '水/土': Object.freeze({
        pattern: '水土泽域',
        multiplier: 1.08,
        failAdjust: -2,
        summary: '水土交汇形成泥泽领域，控场更稳。',
      }),
      '火/风': Object.freeze({
        pattern: '火风炎岚',
        multiplier: 1.16,
        failAdjust: 6,
        summary: '烈焰借风成势，形成高速扩张的炎岚。',
      }),
      '冰/风': Object.freeze({
        pattern: '冰风霜灾',
        multiplier: 1.14,
        failAdjust: 2,
        summary: '寒流被风卷起，形成持续冻结的霜灾。',
      }),
      '光/暗': Object.freeze({
        pattern: '光暗蚀变',
        multiplier: 1.22,
        failAdjust: 12,
        summary: '光暗对冲本身就足够危险，容易形成湮灭蚀变。',
      }),
      '水/火/风': Object.freeze({
        pattern: '水火风暴',
        multiplier: 1.28,
        failAdjust: 10,
        summary: '蒸爆被风势卷起，形成持续爆裂风暴。',
      }),
      '水/土/风': Object.freeze({
        pattern: '水土风岚·泽域封场',
        multiplier: 1.18,
        failAdjust: 3,
        summary: '泥泽、气流与水势叠加，形成范围封场。',
      }),
      '水/火/土': Object.freeze({
        pattern: '水火土·蒸压熔壳',
        multiplier: 1.22,
        failAdjust: 8,
        summary: '蒸压与土壳并存，兼具压制与爆裂。',
      }),
      '水/火/风/土': Object.freeze({
        pattern: '四象归元·雷霆显化',
        multiplier: 1.24,
        failAdjust: 16,
        summary: '四基础元素归元后显化法则性雷霆，这不是普通雷属性，而是四象归一后的法则征兆。并且已可触发元素剥离。',
        derivedEffects: ['元素剥离'],
      }),
      '光/暗/空间': Object.freeze({
        pattern: '光暗空间·界域扭变',
        multiplier: 1.35,
        failAdjust: 14,
        summary: '光暗对冲叠加空间扭曲，形成界域级压制。',
      }),
      '水/火/风/土/光/暗/空间': Object.freeze({
        pattern: '七元素爆裂',
        multiplier: 1.38,
        failAdjust: 28,
        summary: '四基础元素与三进阶元素同时贯通，踏入真正的七元素爆裂台阶。',
      }),
      '创造/毁灭': Object.freeze({
        pattern: '创造毁灭·法则对冲',
        multiplier: 1.45,
        failAdjust: 18,
        summary: '法则互冲带来极高上限，也伴随极高失控风险。',
      }),
      '光/暗/创造/毁灭': Object.freeze({
        pattern: '光暗双法则·湮生对撞',
        multiplier: 1.6,
        failAdjust: 24,
        summary: '光暗对冲叠加双法则冲撞，接近失控边缘的极限融合。',
      }),
    });

    function sortBattleFusionElements(elements = []) {
      const normalized = normalizeBattleSkillAttributeTokens(elements).filter(token =>
        BATTLE_FUSION_ALLOWED_ELEMENTS.includes(token),
      );
      const orderIndex = token => {
        const index = BATTLE_FUSION_ELEMENT_ORDER.indexOf(token);
        return index >= 0 ? index : BATTLE_FUSION_ELEMENT_ORDER.length + token.charCodeAt(0);
      };
      return [...normalized].sort((a, b) => orderIndex(a) - orderIndex(b));
    }

    function buildBattleFusionKey(elements = []) {
      return sortBattleFusionElements(elements).join('/');
    }

    function resolveBattleFusionSemantics(elements = []) {
      const normalized = sortBattleFusionElements(elements);
      const key = normalized.join('/');
      const preset = BATTLE_FUSION_SEMANTICS_MAP[key];
      let multiplier = Number(preset?.multiplier || 1);
      let failAdjust = Number(preset?.failAdjust || 0);
      let pattern = String(preset?.pattern || (normalized.length ? normalized.join('/') : '未指定'));
      let summary = String(
        preset?.summary || (normalized.length ? `${normalized.join('/')} 并行融合。` : '未指定元素融合。'),
      );
      const derivedEffects = normalizeBattleSkillStringArray(preset?.derivedEffects || []);
      const hasLaw = normalized.some(token => token === '创造' || token === '毁灭');
      const hasSpace = normalized.includes('空间');
      const hasLightDark = normalized.includes('光') && normalized.includes('暗');
      if (!preset && hasSpace) {
        multiplier *= 1.08;
        failAdjust += 4;
        summary += ' 空间参与抬高融合上限。';
      }
      if (!preset && hasLightDark) {
        multiplier *= 1.1;
        failAdjust += 6;
        summary += ' 光暗对冲令结构更危险。';
      }
      if (!preset && hasLaw) {
        const lawCount = normalized.filter(token => token === '创造' || token === '毁灭').length;
        multiplier *= 1 + lawCount * 0.12;
        failAdjust += lawCount * 10;
        summary += ' 法则元素参与显著抬高上限与风险。';
      }
      return { key, elements: normalized, pattern, multiplier, failAdjust, summary, derivedEffects };
    }

    function extractBattleFusionElementsFromText(raw = '') {
      const text = String(raw || '').trim();
      if (!text) return [];
      if (/七元素/.test(text)) return [...BATTLE_FUSION_BASE_ELEMENTS, ...BATTLE_FUSION_ADVANCED_ELEMENTS];
      if (/四元素/.test(text)) return [...BATTLE_FUSION_BASE_ELEMENTS];
      const directMatches = [];
      ['创造', '毁灭', '空间', '光明', '黑暗', '创世', '灭世', '水', '火', '土', '风', '光', '暗'].forEach(token => {
        if (text.includes(token)) directMatches.push(normalizeBattleSkillAttributeToken(token));
      });
      const cleaned = text
        .replace(/多元素融合|元素融合|融合技|融合|蓄力|极致|调用|使用|释放|施展/g, ' ')
        .replace(/[、,，|｜/＋+]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const splitMatches = cleaned
        ? cleaned
            .split(' ')
            .map(normalizeBattleSkillAttributeToken)
            .filter(token => token && BATTLE_FUSION_ALLOWED_ELEMENTS.includes(token))
        : [];
      return Array.from(new Set([...directMatches, ...splitMatches].filter(Boolean)));
    }

    function buildBattleFusionPattern(elements = []) {
      return resolveBattleFusionSemantics(elements).pattern;
    }

    function collectBattleUnlockedAttributeTokens(char = {}) {
      const collected = [];
      取角色武魂条目_战斗(char).forEach(([, spiritData]) => {
        const unlocked = Array.isArray(spiritData?.已解锁调用权) ? spiritData.已解锁调用权 : [];
        collected.push(...normalizeBattleSkillAttributeTokens(unlocked));
      });
      const bloodlineUnlocked = Array.isArray(char?.血脉之力?.已解锁调用权)
        ? char.血脉之力.已解锁调用权
        : [];
      collected.push(...normalizeBattleSkillAttributeTokens(bloodlineUnlocked));
      return Array.from(new Set(collected));
    }

    function hasBattleUnlockedAttributeSet(char = {}, required = []) {
      const unlocked = new Set(collectBattleUnlockedAttributeTokens(char));
      return normalizeBattleSkillAttributeTokens(required).every(token => unlocked.has(token));
    }

    function normalizeBattleSkillAttributeCoefficients(value = {}) {
      const normalized = { ...BATTLE_SKILL_DEFAULT_ATTRIBUTE_COEFF };
      Object.keys(BATTLE_SKILL_DEFAULT_ATTRIBUTE_COEFF).forEach(key => {
        const raw = Number(value?.[key] ?? BATTLE_SKILL_DEFAULT_ATTRIBUTE_COEFF[key]);
        normalized[key] = Number.isFinite(raw) && raw > 0 ? raw : BATTLE_SKILL_DEFAULT_ATTRIBUTE_COEFF[key];
      });
      return normalized;
    }

    function normalizeBattleSkillStringArray(value = []) {
      const source = Array.isArray(value) ? value : [];
      return Array.from(new Set(source.map(item => String(item || '').trim()).filter(Boolean)));
    }

    function normalizeBattleSkillAttributeSource(value = '') {
      const text = String(value || '').trim();
      return ['自身操控', '魂技调用'].includes(text) ? text : '无';
    }

    function normalizeBattleSkillRole(value = '') {
      const text = String(value || '').trim();
      return ['增幅器', '结构术式'].includes(text) ? text : '无';
    }

    function normalizeBattleSkillElementStructure(value = {}) {
      const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      return {
        模式: String(source?.模式 || '无').trim() || '无',
        核心元素: normalizeBattleSkillAttributeTokens(source?.核心元素),
        驱动元素: normalizeBattleSkillAttributeTokens(source?.驱动元素),
        约束元素: normalizeBattleSkillAttributeTokens(source?.约束元素),
        触发元素: normalizeBattleSkillAttributeTokens(source?.触发元素),
        关系: Array.isArray(source?.关系) ? cloneBattleValue(source.关系) : [],
      };
    }

    function normalizeBattleSkillWuxingInvocation(value = {}) {
      const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      return {
        模式: String(source?.模式 || '无').trim() || '无',
        调用链: normalizeBattleSkillStringArray(source?.调用链),
        回路闭合: !!source?.回路闭合,
        层级回溯: normalizeBattleSkillStringArray(source?.层级回溯),
        终态: String(source?.终态 || '无').trim() || '无',
        结果: String(source?.结果 || '无').trim() || '无',
      };
    }

    function normalizeBattleSkillPolarityInfo(value = {}) {
      const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      return {
        polarityUnlocked: !!source?.polarityUnlocked,
        polarityMode: String(source?.polarityMode || source?.polarity || '无').trim() || '无',
      };
    }

    function getBattleSkillSystemBaseParam(skill = {}, key = '') {
      if (!skill || typeof skill !== 'object' || Array.isArray(skill)) return undefined;
      return skill[key];
    }

    function getBattleSkillAttributeSummary(skill = {}) {
      return {
        属性来源: String(getBattleSkillSystemBaseParam(skill, '属性来源') || '').trim(),
        魂技作用: String(getBattleSkillSystemBaseParam(skill, '魂技作用') || '').trim(),
        显示元素: String(getBattleSkillSystemBaseParam(skill, '显示元素') || '').trim(),
      };
    }

    function getBattleSkillAttributeSource(skill = {}) {
      return normalizeBattleSkillAttributeSource(getBattleSkillAttributeSummary(skill).属性来源 || '');
    }

    function getBattleSkillRole(skill = {}) {
      return normalizeBattleSkillRole(getBattleSkillAttributeSummary(skill).魂技作用 || '');
    }

    function getBattleSkillElementStructure(skill = {}) {
      return normalizeBattleSkillElementStructure(getBattleSkillSystemBaseParam(skill, '元素构型') || {});
    }

    function getBattleSkillWuxingInvocation(skill = {}) {
      return normalizeBattleSkillWuxingInvocation(getBattleSkillSystemBaseParam(skill, '五行调用结构') || {});
    }

    function getBattleSkillPolaritySummary(skill = {}) {
      return normalizeBattleSkillPolarityInfo(getBattleSkillSystemBaseParam(skill, '极性信息') || {});
    }

    function getBattleSkillRuntimeAttributeCoefficients(skill = {}) {
      return normalizeBattleSkillAttributeCoefficients(getBattleSkillSystemBaseParam(skill, '属性系数') || {});
    }

    function getBattleSkillDisplayElement(skill = {}) {
      const explicit = String(getBattleSkillAttributeSummary(skill).显示元素 || '').trim();
      if (explicit) return explicit;
      const attached = normalizeBattleSkillAttributeTokens(skill?.附带属性);
      return attached.length ? attached.join('/') : '无';
    }

    function hasBattleSkillAttributeStructure(skill = {}) {
      const elementStructure = getBattleSkillElementStructure(skill);
      const wuxingInvocation = getBattleSkillWuxingInvocation(skill);
      const polarityInfo = getBattleSkillPolaritySummary(skill);
      return (
        getBattleSkillAttributeSource(skill) !== '无' ||
        getBattleSkillRole(skill) !== '无' ||
        elementStructure.模式 !== '无' ||
        elementStructure.核心元素.length > 0 ||
        elementStructure.驱动元素.length > 0 ||
        elementStructure.约束元素.length > 0 ||
        elementStructure.触发元素.length > 0 ||
        elementStructure.关系.length > 0 ||
        wuxingInvocation.模式 !== '无' ||
        wuxingInvocation.调用链.length > 0 ||
        wuxingInvocation.回路闭合 ||
        wuxingInvocation.层级回溯.length > 0 ||
        wuxingInvocation.终态 !== '无' ||
        wuxingInvocation.结果 !== '无' ||
        polarityInfo.polarityUnlocked ||
        polarityInfo.polarityMode !== '无'
      );
    }

    function mergeBattleSkillAttributeCoefficientProfiles(list = []) {
      const profiles = (Array.isArray(list) ? list : []).map(profile =>
        normalizeBattleSkillAttributeCoefficients(profile || {}),
      );
      if (!profiles.length) return normalizeBattleSkillAttributeCoefficients();
      const merged = {};
      Object.keys(BATTLE_SKILL_DEFAULT_ATTRIBUTE_COEFF).forEach(key => {
        merged[key] = profiles.reduce((sum, profile) => sum + Number(profile?.[key] ?? 1), 0) / profiles.length;
      });
      return normalizeBattleSkillAttributeCoefficients(merged);
    }

    function buildBattleSkillAttributeCoefficientsFromAttachedAttributes(attachedAttributes = []) {
      const attached = normalizeBattleSkillAttributeTokens(attachedAttributes);
      if (!attached.length) return normalizeBattleSkillAttributeCoefficients();
      return mergeBattleSkillAttributeCoefficientProfiles(
        attached.map(attr => BATTLE_SKILL_ATTRIBUTE_COEFF_MAP[attr] || BATTLE_SKILL_DEFAULT_ATTRIBUTE_COEFF),
      );
    }

    function resolveBattleSkillAttributeCoefficients(skill = {}) {
      const attached = normalizeBattleSkillAttributeTokens(skill?.附带属性);
      const hasV2Structure = hasBattleSkillAttributeStructure(skill);
      if (!attached.length)
        return hasV2Structure
          ? getBattleSkillRuntimeAttributeCoefficients(skill)
          : normalizeBattleSkillAttributeCoefficients();
      if (hasV2Structure) return getBattleSkillRuntimeAttributeCoefficients(skill);
      return buildBattleSkillAttributeCoefficientsFromAttachedAttributes(attached);
    }

    function isNeutralBattleSkillAttributeCoefficients(coeff = {}) {
      const normalized = normalizeBattleSkillAttributeCoefficients(coeff);
      return Object.keys(BATTLE_SKILL_DEFAULT_ATTRIBUTE_COEFF).every(
        key => Math.abs(Number(normalized[key] || 1) - 1) < 0.0001,
      );
    }

    function roundBattleScaledNumber(value, digits = 2) {
      const num = Number(value);
      if (!Number.isFinite(num)) return 0;
      const scaled = Number(num.toFixed(digits));
      return Number.isInteger(scaled) ? Math.trunc(scaled) : scaled;
    }

    function scaleBattleValue(value, ratio = 1, options = {}) {
      const num = Number(value);
      if (!Number.isFinite(num)) return value;
      let next = num * Number(ratio || 1);
      if (options.min !== undefined) next = Math.max(Number(options.min), next);
      if (options.max !== undefined) next = Math.min(Number(options.max), next);
      return roundBattleScaledNumber(next, options.digits ?? 2);
    }

    function scaleBattleFactor(value, ratio = 1, neutral = 1) {
      const num = Number(value);
      if (!Number.isFinite(num)) return value;
      return roundBattleScaledNumber(Number(neutral) + (num - Number(neutral)) * Number(ratio || 1), 4);
    }

    function scaleBattleLockLevel(value, ratio = 1) {
      const num = Number(value || 0);
      if (!(num > 0)) return 0;
      return Math.max(1, Math.round(num * Number(ratio || 1)));
    }

    function scaleBattleDebuffRatio(value, ratio = 1, neutral = 1) {
      const num = Number(value);
      if (!Number.isFinite(num)) return value;
      return roundBattleScaledNumber(Number(neutral) - (Number(neutral) - num) * Number(ratio || 1), 4);
    }

    function scaleBattleSupportBuffCalc(calc = {}, supportScale = 1) {
      const next = cloneBattleValue(calc || {});
      const ratio = Number(supportScale || 1);
      if (!Number.isFinite(ratio) || Math.abs(ratio - 1) < 0.0001) return next;

      ['hit_bonus', 'reaction_bonus', 'dodge_bonus', 'attacker_speed_bonus', 'cast_speed_bonus', 'interrupt_bonus'].forEach(
        key => {
          if (next[key] !== undefined) next[key] = scaleBattleValue(next[key], ratio, { digits: 4 });
        },
      );

        ['damage_reduction', 'counter_attack_ratio', 'damage_reflect_ratio', 'damage_transfer_ratio', 'damage_share_ratio', 'cost_share_ratio', 'bonus_true_damage_ratio', 'damage_absorb_ratio', 'damage_to_heal_ratio', 'heal_to_damage_ratio', 'defense_strip', 'spirit_resist_strip', 'vit_gain_ratio', 'sp_gain_ratio', 'men_gain_ratio', 'hot_heal_ratio', 'heal_inversion_ratio', 'revive_heal_ratio', 'cost_delta_ratio'].forEach(
        key => {
          if (next[key] !== undefined) next[key] = scaleBattleValue(next[key], ratio, { min: 0, digits: 4 });
        },
      );

      ['final_damage_mult', 'received_damage_mult', 'final_heal_mult', 'shield_gain_mult', 'skill_effect_mult', 'cost_ratio', 'windup_ratio'].forEach(key => {
        if (next[key] !== undefined) next[key] = scaleBattleFactor(next[key], ratio, 1);
      });

      ['final_damage_bonus', 'final_heal_bonus', 'shield_gain_bonus'].forEach(key => {
        if (next[key] !== undefined) next[key] = scaleBattleValue(next[key], ratio, { min: 0, digits: 2 });
      });
      ['cost_delta', 'windup_delta'].forEach(key => {
        if (next[key] !== undefined) next[key] = scaleBattleValue(next[key], ratio, { digits: 2 });
      });

      if (next.min_hp_floor !== undefined) next.min_hp_floor = Math.max(0, Math.round(Number(next.min_hp_floor || 0) * ratio));
      if (next.invincible_tier_threshold !== undefined)
        next.invincible_tier_threshold = Math.max(0, Number(next.invincible_tier_threshold || 0));

      return next;
    }

    function 套用技能效果增幅(skill = {}, 战斗效果列表 = []) {
      const 效果倍率 = (Array.isArray(战斗效果列表) ? 战斗效果列表 : []).reduce(
        (倍率, 战斗效果) => 倍率 * Math.max(1, Number(战斗效果?.skill_effect_mult || 1)),
        1,
      );
      if (效果倍率 <= 1.0001) return { skill, 已增幅: false, 效果倍率 };
      const nextSkill = cloneBattleValue(skill || {});
      const effects = getSkillEffects(nextSkill);
      const 数量字段 = [
        '数量',
        '个数',
        '召唤数量',
        '制造数量',
        '分身数量',
        '驱散数量',
        '窃取数量',
        '转移数量',
      ];
      const 中性倍率字段 = [
        'final_damage_mult',
        'received_damage_mult',
        'final_heal_mult',
        'shield_gain_mult',
        'cost_ratio',
        'windup_ratio',
        'mastery_ratio',
        'speed_ratio',
      ];
      const 数值字段 = [
        '威力倍率',
        '护盾值',
        '每回合伤害',
        'dot_damage',
        'final_damage_bonus',
        'final_heal_bonus',
        'shield_gain_bonus',
        'vit_gain_ratio',
        'sp_gain_ratio',
        'men_gain_ratio',
        'hot_heal_ratio',
        'heal_block_ratio',
        'revive_heal_ratio',
        'damage_reduction',
        'damage_reflect_ratio',
        'damage_transfer_ratio',
        'damage_share_ratio',
        'counter_attack_ratio',
        'damage_absorb_ratio',
        'damage_to_heal_ratio',
        'heal_to_damage_ratio',
        'bonus_true_damage_ratio',
        '引爆倍率',
        '收益倍率',
        '封禁强度',
        '气运修正',
        '反噬系数',
      ];
      const 原始效果文本 = JSON.stringify(effects);
      effects.forEach(effect => {
        const 机制名 = String(effect?.原型 || '').trim();
        if (!effect || typeof effect !== 'object' || 机制名 === '系统基础' || 机制名 === '技能效果增幅') return;
        const 是对应等级伤害 = 机制名 === '伤害结算' && 读取对应等级(effect) > 0;
        if (是对应等级伤害) return;
        const 命中数量字段 = 数量字段.filter(字段 => Number.isFinite(Number(effect[字段])));
        if (命中数量字段.length > 0) {
          命中数量字段.forEach(字段 => {
            effect[字段] = Math.max(1, Math.round(Number(effect[字段] || 0) * 效果倍率));
          });
          return;
        }
        中性倍率字段.forEach(字段 => {
          if (!Number.isFinite(Number(effect[字段]))) return;
          const 数值 = Number(effect[字段]);
          effect[字段] = 数值 >= 1 ? scaleBattleFactor(数值, 效果倍率, 1) : scaleBattleDebuffRatio(数值, 效果倍率, 1);
        });
        if (effect.数值 !== undefined && (Number.isFinite(Number(effect.数值)) || /%$/.test(String(effect.数值).trim()))) {
          const 动作 = String(effect.动作 || '').trim();
          if (机制名 === '属性变化') {
            const 是变化量 = !动作 && /%$/.test(String(effect.数值).trim());
            const 是倍率 = ['倍率提升', '倍率压制'].includes(动作) || 是变化量 || (!动作 && Number(effect.数值) > 0 && Math.abs(Number(effect.数值) - 1) > 0.001);
            effect.数值 = 是变化量
              ? 缩放战斗属性变化数值(effect.数值, 效果倍率)
              : 是倍率
                ? 动作 === '倍率压制' || (!动作 && Number(effect.数值) < 1)
                  ? scaleBattleDebuffRatio(effect.数值, 效果倍率, 1)
                  : scaleBattleFactor(effect.数值, 效果倍率, 1)
                : scaleBattleValue(effect.数值, 效果倍率, { min: 0, digits: 4 });
          } else if (机制名 === '结算修正' && ['消耗', '前摇'].includes(String(effect?.结算 || '').trim())) {
            effect.数值 = 读取战斗数值正负(effect.数值) < 0
              ? scaleBattleDebuffRatio(effect.数值, 效果倍率, 1)
              : scaleBattleFactor(effect.数值, 效果倍率, 1);
          } else if (机制名 === '掌控修正' || 机制名 === '速度修正') {
            effect.数值 = !动作 && /%$/.test(String(effect.数值).trim())
              ? 缩放战斗属性变化数值(effect.数值, 效果倍率)
              : 动作 === '倍率压制' || (!动作 && Number(effect.数值) < 1)
                ? scaleBattleDebuffRatio(effect.数值, 效果倍率, 1)
                : scaleBattleFactor(effect.数值, 效果倍率, 1);
          } else {
            effect.数值 = scaleBattleValue(effect.数值, 效果倍率, { min: 0, digits: 4 });
          }
        }
        数值字段.forEach(字段 => {
          if (Number.isFinite(Number(effect[字段]))) effect[字段] = scaleBattleValue(effect[字段], 效果倍率, { min: 0, digits: 4 });
        });
        if (effect.计算层效果 && typeof effect.计算层效果 === 'object') {
          effect.计算层效果 = scaleBattleSupportBuffCalc(effect.计算层效果, 效果倍率);
        }
      });
      return { skill: nextSkill, 已增幅: JSON.stringify(effects) !== 原始效果文本, 效果倍率 };
    }

    function scaleSkillCostText(costText, ratio = 1) {
      const text = String(costText || '').trim();
      if (!text || text === '无' || Math.abs(Number(ratio || 1) - 1) < 0.0001) return text || '无';
      return text.replace(
        /(\d+(?:\.\d+)?)(%?)/g,
        (_, numText, suffix) =>
          `${roundBattleScaledNumber(Number(numText) * Number(ratio || 1), suffix ? 2 : 0)}${suffix}`,
      );
    }

    function ensureBattleSkillAttributeBase(skill = {}) {
      if (skill?.__attributeCoeffBase && Array.isArray(skill.__attributeCoeffBase.effects))
        return skill.__attributeCoeffBase;
      const 清理正式效果快照 = value => {
        if (Array.isArray(value)) return value.map(清理正式效果快照).filter(Boolean);
        if (!value || typeof value !== 'object') return value;
        const next = cloneBattleValue(value);
        ['运行机制', '状态名称', '计算层效果', '战斗效果', '面板修改比例', '面板固定修正', '运行时消费器'].forEach(key => {
          delete next[key];
        });
        ['使用效果', '授予效果', '结算效果'].forEach(key => {
          if (Array.isArray(next[key])) next[key] = 清理正式效果快照(next[key]);
        });
        if (Array.isArray(next.条件分支)) {
          next.条件分支 = next.条件分支.map(branch => {
            const 分支 = cloneBattleValue(branch);
            ['替换效果', '追加效果'].forEach(key => {
              if (Array.isArray(分支[key])) 分支[key] = 清理正式效果快照(分支[key]);
            });
            return 分支;
          });
        }
        return next;
      };
      const runtimeMeta = getSkillRuntimeMeta(skill);
      const base = {
        effects: 清理正式效果快照(skill?._效果数组 || []),
        前摇: Number(runtimeMeta.cast_time ?? 0) || 0,
        cost_text: runtimeMeta.消耗 || '无',
      };
      skill.__attributeCoeffBase = cloneBattleValue(base);
      return skill.__attributeCoeffBase;
    }

    function ensureBattleTransientStateEffect(skill = {}) {
      const targetText = getSkillTarget(skill);
      const stateEffect = {
        原型: '状态施加',
        运行机制: '状态施加',
        状态名称: '无',
        目标: targetText,
        持续回合: 0,
        面板修改比例: {},
        计算层效果: createEmptyCombatEffectMap(),
      };
      if (!stateEffect.状态名称 || !String(stateEffect.状态名称).trim()) stateEffect.状态名称 = '无';
      if (!stateEffect.目标) stateEffect.目标 = getSkillTarget(skill);
      return stateEffect;
    }

    function applyAttributeCoeffToCombatSkill(skill = {}) {
      if (!skill || typeof skill !== 'object') return skill;
      const base = ensureBattleSkillAttributeBase(skill);
      skill._效果数组 = cloneBattleValue(base.effects || []);
      skill.前摇 = Number(base.前摇 ?? 0) || 0;
      skill.消耗 = String(base.cost_text || '无') || '无';

      const attached = normalizeBattleSkillAttributeTokens(skill?.附带属性);
      const hasV2Structure = hasBattleSkillAttributeStructure(skill);
      skill.附带属性 = attached;
      ['属性系数', '属性来源', '魂技作用', '元素构型', '五行调用结构', '极性信息', '元素'].forEach(key => {
        if (key in skill) delete skill[key];
      });
      const coeff = resolveBattleSkillAttributeCoefficients(skill);

      if ((!attached.length && !hasV2Structure) || isNeutralBattleSkillAttributeCoefficients(coeff)) return skill;

      const normalizedCoeff = normalizeBattleSkillAttributeCoefficients(coeff);
      const effects = Array.isArray(skill._效果数组) ? skill._效果数组 : [];
          const directDamageMechanisms = new Set(['伤害结算']);

      skill.消耗 = scaleSkillCostText(skill.消耗, normalizedCoeff.消耗);
      skill.前摇 = Math.max(
        skill.前摇 > 0 ? 1 : 0,
        Math.round(Number(skill.前摇 || 0) * normalizedCoeff.前摇),
      );

      effects.forEach(effect => {
        const mechanism = String(effect?.原型 || '');
        if (!mechanism) return;

        if (directDamageMechanisms.has(mechanism) && effect.威力倍率 !== undefined && !(读取对应等级(effect) > 0)) {
          effect.威力倍率 = scaleBattleValue(effect.威力倍率, coeff.威力, { min: 0, digits: 2 });
        }
        if (mechanism === '护盾' && effect.护盾值 !== undefined) {
          effect.护盾值 = scaleBattleValue(effect.护盾值, coeff.威力, { min: 0, digits: 0 });
        }
        if (mechanism === '属性变化' && effect.数值 !== undefined) {
          const property = String(effect.属性 || '').trim();
          const action = String(effect.动作 || '').trim();
          if (action === '加值' && ['vit', 'sp', 'men'].includes(property)) {
            effect.数值 = scaleBattleValue(effect.数值, coeff.威力, { min: 0, digits: 4 });
          } else if (['倍率提升', '倍率压制'].includes(action) || (!action && /%$/.test(String(effect.数值).trim())) || (!action && Number(effect.数值) > 0 && Math.abs(Number(effect.数值) - 1) > 0.001)) {
            const factor =
              property === '掌控'
                ? coeff.掌控
                : property === '控制'
                  ? coeff.控制
                  : property === '速度'
                    ? coeff.速度
                    : property === '前摇'
                      ? coeff.前摇
                      : property === '消耗'
                        ? coeff.消耗
                        : coeff.威力;
            effect.数值 = !action && /%$/.test(String(effect.数值).trim())
              ? 缩放战斗属性变化数值(effect.数值, factor)
              : action === '倍率压制' || (!action && Number(effect.数值) < 1)
                ? scaleBattleDebuffRatio(effect.数值, factor, 1)
                : scaleBattleFactor(effect.数值, factor, 1);
          }
        }
        if (mechanism === '持续恢复' && effect.数值 !== undefined) {
          effect.数值 = scaleBattleValue(effect.数值, coeff.威力, { min: 0, digits: 4 });
        }
        if (mechanism === '结算修正' && String(effect?.结算 || '').trim() === '消耗' && effect.数值 !== undefined) {
          effect.数值 = 读取战斗数值正负(effect.数值) < 0
            ? scaleBattleDebuffRatio(effect.数值, coeff.消耗, 1)
            : scaleBattleFactor(effect.数值, coeff.消耗, 1);
        }
        if (mechanism === '结算修正' && String(effect?.结算 || '').trim() === '前摇' && effect.数值 !== undefined) {
          effect.数值 = 读取战斗数值正负(effect.数值) < 0
            ? scaleBattleDebuffRatio(effect.数值, coeff.前摇, 1)
            : scaleBattleFactor(effect.数值, coeff.前摇, 1);
        }
        if (mechanism === '掌控修正' && effect.数值 !== undefined) {
          const action = String(effect.动作 || '').trim();
          effect.数值 = !action && /%$/.test(String(effect.数值).trim())
            ? 缩放战斗属性变化数值(effect.数值, coeff.掌控)
            : action === '倍率压制' || (!action && Number(effect.数值) < 1)
              ? scaleBattleDebuffRatio(effect.数值, coeff.掌控, 1)
              : scaleBattleFactor(effect.数值, coeff.掌控, 1);
        }
        if (mechanism === '速度修正' && effect.数值 !== undefined) {
          const action = String(effect.动作 || '').trim();
          effect.数值 = !action && /%$/.test(String(effect.数值).trim())
            ? 缩放战斗属性变化数值(effect.数值, coeff.速度)
            : action === '倍率压制' || (!action && Number(effect.数值) < 1)
              ? scaleBattleDebuffRatio(effect.数值, coeff.速度, 1)
              : scaleBattleFactor(effect.数值, coeff.速度, 1);
        }
        if (mechanism === '打断' && effect.中断概率 !== undefined) {
          effect.中断概率 = scaleBattleValue(effect.中断概率, coeff.控制, { min: 0, max: 1, digits: 4 });
        }
        if (mechanism === '减速' && effect.agi_ratio !== undefined) {
          effect.agi_ratio = scaleBattleDebuffRatio(effect.agi_ratio, coeff.控制, 1);
        }
        if (mechanism === '软控') {
          if (effect.reaction_penalty !== undefined)
            effect.reaction_penalty = scaleBattleValue(effect.reaction_penalty, coeff.控制, { digits: 4 });
          if (effect.cast_speed_penalty !== undefined)
            effect.cast_speed_penalty = scaleBattleValue(effect.cast_speed_penalty, coeff.控制, { digits: 4 });
          if (effect.dodge_penalty !== undefined)
            effect.dodge_penalty = scaleBattleValue(effect.dodge_penalty, coeff.控制, { digits: 4 });
        }
        if (mechanism === '位移限制') {
          if (effect.reaction_penalty !== undefined)
            effect.reaction_penalty = scaleBattleValue(effect.reaction_penalty, coeff.控制, { digits: 4 });
          if (effect.dodge_penalty !== undefined)
            effect.dodge_penalty = scaleBattleValue(effect.dodge_penalty, coeff.控制, { digits: 4 });
          if (effect.lock_level !== undefined) effect.lock_level = scaleBattleLockLevel(effect.lock_level, coeff.控制);
        }
        if (['强制位移', '位移交换', '强制绑定/锁定'].includes(mechanism)) {
          if (effect.dodge_penalty !== undefined)
            effect.dodge_penalty = scaleBattleValue(effect.dodge_penalty, coeff.控制, { digits: 4 });
          if (effect.reaction_penalty !== undefined)
            effect.reaction_penalty = scaleBattleValue(effect.reaction_penalty, coeff.控制, { digits: 4 });
          if (effect.lock_level !== undefined) effect.lock_level = scaleBattleLockLevel(effect.lock_level, coeff.控制);
        }
        if (mechanism === '标记弱点') {
          if (effect.defense_strip !== undefined)
            effect.defense_strip = scaleBattleValue(effect.defense_strip, coeff.掌控, { min: 0, max: 1, digits: 4 });
          if (effect.spirit_resist_strip !== undefined)
            effect.spirit_resist_strip = scaleBattleValue(effect.spirit_resist_strip, coeff.掌控, { min: 0, max: 1, digits: 4 });
        }
        if (mechanism === '禁疗' && effect.heal_block_ratio !== undefined) {
          effect.heal_block_ratio = scaleBattleValue(effect.heal_block_ratio, coeff.控制, {
            min: 0,
            max: 1,
            digits: 4,
          });
        }
        if (mechanism === '共享视野') {
          if (effect.reaction_bonus !== undefined)
            effect.reaction_bonus = scaleBattleValue(effect.reaction_bonus, coeff.速度, { digits: 4 });
          if (effect.hit_bonus !== undefined)
            effect.hit_bonus = scaleBattleValue(effect.hit_bonus, coeff.掌控, { digits: 4 });
          if (effect.lock_level !== undefined) effect.lock_level = scaleBattleLockLevel(effect.lock_level, coeff.掌控);
        }
        if (mechanism === '分身') {
          if (effect.dodge_bonus !== undefined)
            effect.dodge_bonus = scaleBattleValue(effect.dodge_bonus, coeff.速度, { digits: 4 });
          if (effect.attacker_speed_bonus !== undefined)
            effect.attacker_speed_bonus = scaleBattleValue(effect.attacker_speed_bonus, coeff.速度, { digits: 4 });
          if (effect.reaction_bonus !== undefined)
            effect.reaction_bonus = scaleBattleValue(effect.reaction_bonus, coeff.速度, { digits: 4 });
          if (effect.hit_bonus !== undefined)
            effect.hit_bonus = scaleBattleValue(effect.hit_bonus, coeff.掌控, { digits: 4 });
          if (effect.lock_level !== undefined) effect.lock_level = scaleBattleLockLevel(effect.lock_level, coeff.掌控);
          if (effect.final_damage_mult !== undefined)
            effect.final_damage_mult = scaleBattleFactor(effect.final_damage_mult, coeff.威力, 1);
          if (effect.received_damage_mult !== undefined)
            effect.received_damage_mult = scaleBattleFactor(effect.received_damage_mult, coeff.威力, 1);
        }
        if (mechanism === '伤害反射' && effect.反射比例 !== undefined) {
          effect.反射比例 = scaleBattleValue(effect.反射比例, coeff.防御 || coeff.威力, { min: 0, max: 1, digits: 4 });
        }
        if (mechanism === '伤害转移' && effect.转移比例 !== undefined) {
          effect.转移比例 = scaleBattleValue(effect.转移比例, coeff.防御 || coeff.威力, { min: 0, max: 1, digits: 4 });
        }
        if (mechanism === '伤害分摊' && effect.分摊比例 !== undefined) {
          effect.分摊比例 = scaleBattleValue(effect.分摊比例, coeff.防御 || coeff.威力, { min: 0, max: 1, digits: 4 });
        }
        if (mechanism === '消耗分摊' && effect.分摊比例 !== undefined) {
          effect.分摊比例 = scaleBattleValue(effect.分摊比例, coeff.防御 || coeff.威力, { min: 0, max: 1, digits: 4 });
        }
        if (mechanism === '治疗反转' && effect.反转比例 !== undefined) {
          effect.反转比例 = scaleBattleValue(effect.反转比例, coeff.控制 || coeff.威力, { min: 0, digits: 4 });
        }
        if (mechanism === '引爆持续伤害' && effect.引爆倍率 !== undefined) {
          effect.引爆倍率 = scaleBattleValue(effect.引爆倍率, coeff.威力, { min: 0, digits: 4 });
        }
        if (mechanism === '自身位移') {
          if (effect.dodge_bonus !== undefined)
            effect.dodge_bonus = scaleBattleValue(effect.dodge_bonus, coeff.速度, { digits: 4 });
          if (effect.attacker_speed_bonus !== undefined)
            effect.attacker_speed_bonus = scaleBattleValue(effect.attacker_speed_bonus, coeff.速度, { digits: 4 });
          if (effect.reaction_bonus !== undefined)
            effect.reaction_bonus = scaleBattleValue(effect.reaction_bonus, coeff.速度, { digits: 4 });
        }
        if (mechanism === '追击位移') {
          if (effect.attacker_speed_bonus !== undefined)
            effect.attacker_speed_bonus = scaleBattleValue(effect.attacker_speed_bonus, coeff.速度, { digits: 4 });
          if (effect.hit_bonus !== undefined)
            effect.hit_bonus = scaleBattleValue(effect.hit_bonus, coeff.掌控, { digits: 4 });
          if (effect.final_damage_mult !== undefined)
            effect.final_damage_mult = scaleBattleFactor(effect.final_damage_mult, coeff.威力, 1);
          if (effect.received_damage_mult !== undefined)
            effect.received_damage_mult = scaleBattleFactor(effect.received_damage_mult, coeff.威力, 1);
        }
        if (mechanism === '脱离位移') {
          if (effect.dodge_bonus !== undefined)
            effect.dodge_bonus = scaleBattleValue(effect.dodge_bonus, coeff.速度, { digits: 4 });
          if (effect.cast_speed_bonus !== undefined)
            effect.cast_speed_bonus = scaleBattleValue(effect.cast_speed_bonus, coeff.速度, { digits: 4 });
          if (effect.reaction_bonus !== undefined)
            effect.reaction_bonus = scaleBattleValue(effect.reaction_bonus, coeff.速度, { digits: 4 });
        }
        if (effect?.原型 === '状态施加') {
          effect.计算层效果 = mergeCombatEffectMaps(createEmptyCombatEffectMap(), effect.计算层效果 || {});
          const calc = effect.计算层效果;
          if (calc.hit_bonus !== undefined)
            calc.hit_bonus = scaleBattleValue(calc.hit_bonus, coeff.掌控, { digits: 4 });
          if (calc.lock_level !== undefined) calc.lock_level = scaleBattleLockLevel(calc.lock_level, coeff.掌控);
          if (calc.final_damage_mult !== undefined)
            calc.final_damage_mult = scaleBattleFactor(calc.final_damage_mult, coeff.威力, 1);
          if (calc.received_damage_mult !== undefined)
            calc.received_damage_mult = scaleBattleFactor(calc.received_damage_mult, coeff.威力, 1);
          if (calc.final_damage_bonus !== undefined)
            calc.final_damage_bonus = scaleBattleValue(calc.final_damage_bonus, coeff.威力, { digits: 2 });
          if (calc.final_heal_mult !== undefined)
            calc.final_heal_mult = scaleBattleFactor(calc.final_heal_mult, coeff.威力, 1);
          if (calc.final_heal_bonus !== undefined)
            calc.final_heal_bonus = scaleBattleValue(calc.final_heal_bonus, coeff.威力, { digits: 2 });
          if (calc.shield_gain_mult !== undefined)
            calc.shield_gain_mult = scaleBattleFactor(calc.shield_gain_mult, coeff.威力, 1);
          if (calc.shield_gain_bonus !== undefined)
            calc.shield_gain_bonus = scaleBattleValue(calc.shield_gain_bonus, coeff.威力, { digits: 2 });
          if (calc.vit_gain_ratio !== undefined)
            calc.vit_gain_ratio = scaleBattleValue(calc.vit_gain_ratio, coeff.威力, { digits: 4 });
          if (calc.sp_gain_ratio !== undefined)
            calc.sp_gain_ratio = scaleBattleValue(calc.sp_gain_ratio, coeff.威力, { digits: 4 });
          if (calc.men_gain_ratio !== undefined)
            calc.men_gain_ratio = scaleBattleValue(calc.men_gain_ratio, coeff.威力, { digits: 4 });
          if (calc.dot_damage !== undefined)
            calc.dot_damage = scaleBattleValue(calc.dot_damage, coeff.威力, { min: 0, digits: 2 });
          if (calc.dot_damage_ratio !== undefined)
            calc.dot_damage_ratio = scaleBattleValue(calc.dot_damage_ratio, coeff.威力, { min: 0, digits: 4 });
          if (calc.reaction_penalty !== undefined)
            calc.reaction_penalty = scaleBattleValue(calc.reaction_penalty, coeff.控制, { digits: 4 });
          if (calc.cast_speed_penalty !== undefined)
            calc.cast_speed_penalty = scaleBattleValue(calc.cast_speed_penalty, coeff.控制, { digits: 4 });
          if (calc.dodge_penalty !== undefined)
            calc.dodge_penalty = scaleBattleValue(calc.dodge_penalty, coeff.控制, { digits: 4 });
          if (calc.random_target_rate !== undefined)
            calc.random_target_rate = scaleBattleValue(calc.random_target_rate, coeff.控制, {
              min: 0,
              max: 1,
              digits: 4,
            });
          if (calc.reaction_bonus !== undefined)
            calc.reaction_bonus = scaleBattleValue(calc.reaction_bonus, coeff.速度, { digits: 4 });
          if (calc.attacker_speed_bonus !== undefined)
            calc.attacker_speed_bonus = scaleBattleValue(calc.attacker_speed_bonus, coeff.速度, { digits: 4 });
          if (calc.cast_speed_bonus !== undefined)
            calc.cast_speed_bonus = scaleBattleValue(calc.cast_speed_bonus, coeff.速度, { digits: 4 });
          if (calc.dodge_bonus !== undefined)
            calc.dodge_bonus = scaleBattleValue(calc.dodge_bonus, coeff.速度, { digits: 4 });
        }
      });

      const precisionDelta = roundBattleScaledNumber(coeff.掌控 - 1, 4);
      if (Math.abs(precisionDelta) > 0.0001) {
        const precisionState = ensureBattleTransientStateEffect(skill);
        const calc = precisionState.计算层效果 || (precisionState.计算层效果 = createEmptyCombatEffectMap());
        calc.hit_bonus = roundBattleScaledNumber(Number(calc.hit_bonus || 0) + precisionDelta, 4);
      }

      return skill;
    }

    function 计算技能掌控度完整度(施术者 = {}, 技能掌控度 = null) {
      if (!技能掌控度 || typeof 技能掌控度 !== 'object' || Array.isArray(技能掌控度)) return 1;
      const 中心等级 = Number(技能掌控度.中心等级);
      const 圆满等级 = Number(技能掌控度.圆满等级);
      if (!Number.isFinite(中心等级) || !Number.isFinite(圆满等级) || 圆满等级 <= 中心等级) return 1;
      const 施术等级 = Math.max(1, Number(施术者?.lv ?? 施术者?.等级 ?? 施术者?.属性?.等级 ?? 1) || 1);
      if (施术等级 >= 圆满等级) return 1;
      const 标准差 = (圆满等级 - 中心等级) / 1.8807936081512509;
      const x = (施术等级 - 中心等级) / Math.max(0.0001, 标准差);
      const t = 1 / (1 + Math.exp(-1.702 * x));
      return Math.max(0, Math.min(1, Number(t.toFixed(4))));
    }

    function 按技能掌控度缩放倍率(数值, 完整度 = 1) {
      const 原值 = Number(数值);
      if (!Number.isFinite(原值)) return 数值;
      return roundBattleScaledNumber(1 + (原值 - 1) * 完整度, 4);
    }

    function 按技能掌控度缩放数值(数值, 完整度 = 1) {
      const 原值 = Number(数值);
      if (!Number.isFinite(原值)) return 数值;
      return roundBattleScaledNumber(原值 * 完整度, 4);
    }

    function 按技能掌控度缩放技能(skill = {}, 施术者 = {}) {
      if (skill?.__技能掌控度已缩放 === true) return skill;
      const 技能掌控度 = skill?.技能掌控度;
      const 完整度 = 计算技能掌控度完整度(施术者, 技能掌控度);
      if (完整度 >= 0.9999) return skill;
      const nextSkill = cloneBattleValue(skill || {});
      nextSkill.__技能掌控度完整度 = 完整度;
      nextSkill.__技能掌控度已缩放 = true;
      const 缩放效果列表 = effects => (Array.isArray(effects) ? effects : []).forEach(effect => {
        if (!effect || typeof effect !== 'object' || String(effect.原型 || '').trim() === '系统基础') return;
        if (effect.数值 !== undefined) {
          const 动作 = String(effect.动作 || '').trim();
          effect.数值 = !动作 && /%$/.test(String(effect.数值).trim())
            ? 缩放战斗属性变化数值(effect.数值, 完整度)
            : ['倍率提升', '倍率压制'].includes(动作) || (!动作 && Number(effect.数值) > 0 && Math.abs(Number(effect.数值) - 1) > 0.001)
              ? 按技能掌控度缩放倍率(effect.数值, 完整度)
              : 按技能掌控度缩放数值(effect.数值, 完整度);
        }
        ['护盾值', '每回合伤害', 'dot_damage', 'final_damage_bonus', 'final_heal_bonus', 'shield_gain_bonus'].forEach(key => {
          if (effect[key] !== undefined) effect[key] = 按技能掌控度缩放数值(effect[key], 完整度);
        });
        if (effect.威力倍率 !== undefined && !(String(effect.原型 || '').trim() === '伤害结算' && 读取对应等级(effect) > 0)) effect.威力倍率 = 按技能掌控度缩放数值(effect.威力倍率, 完整度);
        const 面板修改比例 = effect.面板修改比例 && typeof effect.面板修改比例 === 'object' ? effect.面板修改比例 : null;
        if (面板修改比例) {
          ['str', 'def', 'agi', 'vit_max', 'sp_max', 'men_max'].forEach(key => {
            if (面板修改比例[key] !== undefined) 面板修改比例[key] = 按技能掌控度缩放倍率(面板修改比例[key], 完整度);
          });
        }
        const 计算层效果 = effect.计算层效果 && typeof effect.计算层效果 === 'object' ? effect.计算层效果 : null;
        if (计算层效果) {
          ['final_damage_mult', 'received_damage_mult', 'final_heal_mult', 'shield_gain_mult', 'cost_ratio', 'windup_ratio'].forEach(key => {
            if (计算层效果[key] !== undefined) 计算层效果[key] = 按技能掌控度缩放倍率(计算层效果[key], 完整度);
          });
          ['cost_delta', 'windup_delta'].forEach(key => {
            if (计算层效果[key] !== undefined) 计算层效果[key] = 按技能掌控度缩放数值(计算层效果[key], 完整度);
          });
          [
            'final_damage_bonus',
            'final_heal_bonus',
            'shield_gain_bonus',
            'dot_damage',
            'dot_damage_ratio',
            'vit_gain_ratio',
            'sp_gain_ratio',
            'men_gain_ratio',
            'hot_heal_ratio',
            'heal_block_ratio',
            'cost_delta_ratio',
            'bonus_true_damage_ratio',
            'damage_absorb_ratio',
            'damage_to_heal_ratio',
            'heal_to_damage_ratio',
            'reaction_bonus',
            'reaction_penalty',
            'attacker_speed_bonus',
            'cast_speed_bonus',
            'cast_speed_penalty',
            'dodge_bonus',
            'dodge_penalty',
            'interrupt_bonus',
          ].forEach(key => {
            if (计算层效果[key] !== undefined) 计算层效果[key] = 按技能掌控度缩放数值(计算层效果[key], 完整度);
          });
        }
        ['使用效果', '授予效果'].forEach(key => 缩放效果列表(effect[key]));
        (Array.isArray(effect.条件分支) ? effect.条件分支 : []).forEach(branch => {
          if (!branch || typeof branch !== 'object') return;
          缩放效果列表(branch.替换效果);
          缩放效果列表(branch.追加效果);
        });
      });
      缩放效果列表(nextSkill._效果数组);
      return nextSkill;
    }

    function getSkillRuntimeMeta(skill) {
      const baseType = inferSkillTypeFromEffects(skill);
      const baseCostRaw = skill?.消耗 ?? '无';
      const baseCost =
        typeof baseCostRaw === 'object' ? formatCostObjectToString(baseCostRaw) : String(baseCostRaw || '无').trim() || '无';
      const baseCastTime = Number(skill?.前摇 ?? 0) || 0;
      return {
        技能分类: normalizeSkillTypeLabel(skill?.技能分类 || baseType || '无'),
        消耗: baseCost,
        cast_time: baseCastTime,
      };
    }

    function getBattleSkillSideEffectList(skill = {}) {
      return normalizeBattleSkillSideEffectList(skill?.副作用列表 || []);
    }

    function buildBattleSideEffectRuntimePayload(effect = {}) {
      const 类型 = String(effect?.副作用类型 || '').trim();
      const 数值 = Math.abs(读取战斗数值正负(effect?.数值 || '0'));
      const 副数值 = Math.abs(读取战斗数值正负(effect?.副数值 || '0'));
      const 强度 = Math.max(0, 数值);
      const 副强度 = Math.max(0, 副数值);
      const 面板修改比例 = {};
      const 战斗效果 = createEmptyCombatEffectMap();
      if (类型 === '致死献祭') 战斗效果.致死 = true;
      if (类型 === '全属性降低') {
        const 倍率 = Math.max(0.01, 1 - (强度 || 0.1));
        ['str', 'def', 'agi', 'vit_max', 'sp_max', 'men_max'].forEach(key => { 面板修改比例[key] = 倍率; });
      }
      if (类型 === '自损反噬') {
        战斗效果.misfortune_backlash_ratio = 强度 || 0.03;
        战斗效果.hit_penalty = Math.max(0.03, (强度 || 0.03) * 0.5);
      }
      if (类型 === '精神紊乱') {
        战斗效果.random_target_rate = 强度 || 0.25;
        战斗效果.reaction_penalty = 副强度 || 0.08;
      }
      if (类型 === '命中下降') 战斗效果.hit_penalty = 强度 || 0.1;
      if (类型 === '魂力反噬') {
        战斗效果.sp_gain_ratio = -(强度 || 0.05);
        战斗效果.cost_delta_ratio = 副强度 || Math.max(0.05, 强度 || 0.05);
      }
      if (类型 === '动作迟缓') {
        战斗效果.reaction_penalty = 强度 || 0.15;
        战斗效果.dodge_penalty = 副强度 || 0.1;
      }
      if (类型 === '施法僵直') 战斗效果.cast_speed_penalty = 强度 || 0.2;
      if (类型 === '目标错乱') 战斗效果.random_target_rate = 强度 || 0.3;
      return { 面板修改比例, 战斗效果 };
    }

    function estimateBattleSideEffectRisk(effect = {}, owner = null) {
      const 生效对象 = String(effect?.生效对象 || '技能释放者').trim();
      if (!['技能释放者', '双方'].includes(生效对象)) return 0;
      const 类型 = String(effect?.副作用类型 || '').trim();
      const 概率 = Math.max(0, Math.min(1, Number(effect?.触发概率 ?? 1) || 0));
      if (类型 === '致死献祭') return 3;
      const { 战斗效果 } = buildBattleSideEffectRuntimePayload(effect);
      const 持续 = Math.max(1, Number(effect?.持续回合 || 1));
      const 生命压力 = owner ? Math.max(0, 1 - getCombatHpRatio(owner)) : 0;
      const 资源压力 = owner ? Math.max(
        0,
        1 - Math.min(
          1,
          Math.max(0, Number(owner.sp || owner?.属性?.魂力 || 0)) / Math.max(1, Number(owner.sp_max || owner?.属性?.魂力上限 || 1)),
        ),
      ) : 0;
      return 概率 * Math.min(3, (
        Number(战斗效果.random_target_rate || 0) +
        Number(战斗效果.cast_speed_penalty || 0) +
        Number(战斗效果.hit_penalty || 0) +
        Math.abs(Number(战斗效果.sp_gain_ratio || 0)) +
        Number(战斗效果.cost_delta_ratio || 0) +
        Number(战斗效果.misfortune_backlash_ratio || 0) * (1 + 生命压力) +
        Number(战斗效果.dot_damage_ratio || 0) * (1 + 生命压力) +
        持续 * 0.05 +
        资源压力 * Math.abs(Number(战斗效果.sp_gain_ratio || 0))
      ));
    }

    function resolveBattleSideEffectTargets(effect = {}, caster = null, targetSet = []) {
      const targets = Array.isArray(targetSet) ? targetSet.filter(Boolean) : [];
      const targetMode = String(effect?.生效对象 || '技能释放者').trim();
      if (targetMode === '效果承受者') return targets;
      if (targetMode === '双方') return Array.from(new Set([caster, ...targets].filter(Boolean)));
      return caster ? [caster] : targets;
    }

    function 技能含正向增幅效果(skill = {}) {
      const 来源效果列表 = String(skill?.承载方式 || '').trim() === '造物承载'
        ? (Array.isArray(skill?._效果数组) ? skill._效果数组 : []).flatMap(effect => Array.isArray(effect?.使用效果) ? effect.使用效果 : [])
        : (Array.isArray(skill?._效果数组) ? skill._效果数组 : []);
      return 来源效果列表.some(effect => {
        if (!effect || typeof effect !== 'object') return false;
        const 原型 = String(effect?.原型 || '').trim();
        const 数值 = 读取战斗数值正负(effect?.数值);
        if (原型 === '属性修正') return 数值 > 0;
        if (原型 !== '结算修正') return false;
        const 结算 = String(effect?.结算 || '').trim();
        if (['造成伤害', '治疗', '技能效果'].includes(结算)) return 数值 > 0;
        if (['受到伤害', '消耗', '前摇'].includes(结算)) return 数值 < 0;
        return false;
      });
    }

    function 允许食物增幅副作用叠加(skill = {}) {
      return String(skill?.承载方式 || '').trim() === '造物承载' && 技能含正向增幅效果(skill);
    }

    function 读取虚弱状态强度(状态条目 = {}) {
      const 比例表 = 状态条目?.面板修改比例 && typeof 状态条目.面板修改比例 === 'object' ? 状态条目.面板修改比例 : {};
      const 值列表 = ['str', 'def', 'agi', 'vit_max', 'sp_max', 'men_max']
        .map(key => 1 - Number(比例表[key] ?? 1))
        .filter(value => Number.isFinite(value) && value > 0);
      return 值列表.length ? Math.max(...值列表) : 0;
    }

    function 写入虚弱状态强度(状态条目 = {}, 强度 = 0) {
      const 安全强度 = Math.max(0, Math.min(1, Number(强度 || 0)));
      const 倍率 = Math.max(0, 1 - 安全强度);
      状态条目.面板修改比例 = 状态条目.面板修改比例 && typeof 状态条目.面板修改比例 === 'object' ? 状态条目.面板修改比例 : {};
      ['str', 'def', 'agi', 'vit_max', 'sp_max', 'men_max'].forEach(key => { 状态条目.面板修改比例[key] = 倍率; });
    }

    function 叠加反噬副作用(targetChar, 强度 = 0, duration = 1, sourceName = '') {
      const 安全强度 = Math.max(0, Number(强度 || 0));
      if (!targetChar?.状态效果 || !(安全强度 > 0)) return;
      const 旧状态 = targetChar.状态效果.反噬;
      const 旧效果 = 旧状态?.战斗效果 || {};
      const 新效果 = mergeCombatEffectMaps(createEmptyCombatEffectMap(), 旧效果);
      新效果.misfortune_backlash_ratio = Number(旧效果.misfortune_backlash_ratio || 0) + 安全强度;
      targetChar.状态效果.反噬 = {
        ...(旧状态 || {}),
        类型: 'debuff',
        状态: '反噬',
        状态名称: '反噬',
        层数: Math.max(1, Number(旧状态?.层数 || 0) + 1),
        描述: `由[${sourceName || '技能'}]触发`,
        duration: Math.max(Number(旧状态?.duration || 0), Math.max(1, Number(duration || 1))),
        面板修改比例: 旧状态?.面板修改比例 || {},
        面板固定修正: 旧状态?.面板固定修正 || {},
        战斗效果: 新效果,
      };
    }

    function 叠加食物增幅副作用状态(targetChar, stateName = '', 副作用状态条目 = {}, sourceName = '', logs = []) {
      const 旧状态 = targetChar?.状态效果?.[stateName];
      if (!旧状态) return false;
      const duration = Math.max(Number(旧状态.duration || 0), Number(副作用状态条目.duration || 0), 1);
      if (stateName === '虚弱') {
        const 叠加强度 = (读取虚弱状态强度(旧状态) + 读取虚弱状态强度(副作用状态条目)) * 1.5;
        const 溢出强度 = Math.max(0, 叠加强度 - 1);
        const 下个状态 = {
          ...旧状态,
          层数: Math.max(1, Number(旧状态.层数 || 1) + 1),
          描述: `由[${sourceName || '技能'}]叠加`,
          duration,
          面板固定修正: 旧状态.面板固定修正 || {},
          战斗效果: mergeCombatEffectMaps(createEmptyCombatEffectMap(), 旧状态.战斗效果 || {}),
        };
        写入虚弱状态强度(下个状态, Math.min(1, 叠加强度));
        targetChar.状态效果[stateName] = 下个状态;
        if (溢出强度 > 0) 叠加反噬副作用(targetChar, 溢出强度, duration, sourceName);
        if (Array.isArray(logs)) logs.push(`[副作用叠加] ${targetChar.name || '目标'}的[${stateName}]叠加至${Math.round(Math.min(1, 叠加强度) * 100)}%${溢出强度 > 0 ? `，溢出${Math.round(溢出强度 * 100)}%转为[反噬]` : ''}。`);
        return true;
      }
      const 合并效果 = mergeCombatEffectMaps(旧状态.战斗效果 || createEmptyCombatEffectMap(), 副作用状态条目.战斗效果 || {});
      const 空效果 = createEmptyCombatEffectMap();
      Object.keys(合并效果).forEach(key => {
        if (typeof 合并效果[key] === 'number' && Number(合并效果[key]) !== Number(空效果[key] ?? 0)) 合并效果[key] *= 1.5;
      });
      targetChar.状态效果[stateName] = {
        ...旧状态,
        层数: Math.max(1, Number(旧状态.层数 || 1) + 1),
        描述: `由[${sourceName || '技能'}]叠加`,
        duration,
        战斗效果: 合并效果,
      };
      if (Array.isArray(logs)) logs.push(`[副作用叠加] ${targetChar.name || '目标'}的[${stateName}]副作用叠加。`);
      return true;
    }

    function applyBattleSideEffectState(targetChar, effect = {}, sourceName = '', logs = [], combatData = null, options = {}) {
      if (!targetChar) return;
      const chance = Number(effect?.触发概率 ?? 1);
      if (!BATTLE_RUNTIME.probabilitySucceeds(chance)) return;
      const { 面板修改比例, 战斗效果 } = buildBattleSideEffectRuntimePayload(effect);
      const 是否致死副作用 = 战斗效果?.致死 === true;
      if (是否致死副作用) {
        设置战斗血量值(targetChar, 0);
        let 复活结果日志 = '';
        if (getCombatHpValue(targetChar) <= 0) {
          复活结果日志 = triggerReviveEffect(targetChar, targetChar?.name || '目标') || '';
        }
        if (Array.isArray(logs)) {
          logs.push(`[副作用] ${targetChar.name || '目标'}触发[${effect?.副作用类型 || '未知副作用'}](${effect?.触发时机 || '效果生效后'})`);
          if (复活结果日志) logs.push(复活结果日志);
          else logs.push(`[副作用致死] ${targetChar.name || '目标'}受到致死反噬，生命归零。`);
        }
        return;
      }
      const duration = Math.max(1, Number(effect?.持续回合 || 0));
      const 副作用类型 = String(effect?.副作用类型 || '').trim();
      const stateName = String(effect?.副作用状态 || BATTLE_SKILL_SIDE_EFFECT_STATUS_MAP[副作用类型] || 副作用类型 || '反噬').trim();
      if (!targetChar.状态效果) targetChar.状态效果 = {};
      const nextCalc = mergeCombatEffectMaps(createEmptyCombatEffectMap(), 战斗效果);
      清理非生命流失状态伤害字段(stateName, nextCalc);
      const 副作用状态条目 = {
        类型: 'debuff',
        状态: stateName,
        状态名称: stateName,
        __本回合新附加: true,
        层数: 1,
        描述: `由[${sourceName || '技能'}]触发`,
        duration,
        面板修改比例,
        面板固定修正: {},
        战斗效果: nextCalc,
      };
      if (无视异常阻断负面或削减(targetChar, 副作用状态条目)) {
        if (Array.isArray(logs)) logs.push(`[无视异常] ${targetChar.name || '目标'}免疫了[${stateName}]副作用。`);
        return;
      }
      const 持续移除命中 = 持续状态移除阻断状态附着(targetChar, stateName, 副作用状态条目, null);
      if (持续移除命中) {
        if (Array.isArray(logs)) logs.push(`[持续状态移除] ${targetChar.name || '目标'}的[${stateName}]被[${持续移除命中.key}]拦截。`);
        return;
      }
      if (options?.允许食物增幅副作用叠加 === true && 叠加食物增幅副作用状态(targetChar, stateName, 副作用状态条目, sourceName, logs)) return;
      targetChar.状态效果[stateName] = 副作用状态条目;
      if (Array.isArray(logs)) {
        logs.push(`[副作用] ${targetChar.name || '目标'}触发[${effect?.副作用类型 || '未知副作用'}](${effect?.触发时机 || '效果生效后'})`);
      }
    }

    function getSkillType(skill) {
      return getSkillRuntimeMeta(skill).技能分类;
    }

    function getSkillCastTime(skill) {
      return getSkillRuntimeMeta(skill).cast_time;
    }

    function getSkillCostText(skill) {
      return getSkillRuntimeMeta(skill).消耗;
    }

    function getSkillTarget(skill, effect = null) {
      const targetKind = effect ? 推断战斗效果目标类型(effect) : inferSkillPrimaryTargetKind(skill);
      return mapBattleTargetKindToCombatTarget(targetKind);
    }

    function getBattleSkillSourceCategory(skill) {
      return 读取战斗来源类别上下文(skill, '魂技').来源类别;
    }

    function 装备技能跳过掌控缩放(skill = {}) {
      return getBattleSkillSourceCategory(skill) === '装备技能';
    }

    function getPrimaryDamageEffect(skill, context = {}) {
      return (
        getSkillEffects(skill, context).find(effect =>
          String(effect?.原型 || '').trim() === '伤害结算',
        ) || {}
      );
    }

    function getPrimaryStateEffect(skill) {
      return getSkillEffects(skill).find(effect => String(effect?.原型 || '').trim() === '状态施加') || {};
    }

    function 读取技能实际效果列表(skill = {}, context = {}) {
      return getSkillEffects(skill, context);
    }

    function getPrimaryStateCalc(skill) {
      return getPrimaryStateEffect(skill)?.计算层效果 || createEmptyCombatEffectMap();
    }

    function 读取状态资源锁定强度(状态 = {}) {
      return (Array.isArray(状态?.资源锁定规则) ? 状态.资源锁定规则 : []).reduce(
        (最大值, 规则) => Math.max(最大值, Number(规则?.比例 || 0)),
        0,
      );
    }

    function 技能包含资源锁定原型(skill = {}) {
      return getSkillEffects(skill).some(effect => String(effect?.原型 || '').trim() === '资源锁定');
    }

    function 计算行动打断概率(skill = {}, targetChar = {}, settleResult = {}) {
      const 打断效果列表 = getSkillEffects(skill)
        .filter(effect => 读取战斗效果标签(effect) === '打断');
      const 原型概率 = 打断效果列表
        .reduce((最大值, effect) => Math.max(最大值, Number(effect?.中断概率 || effect?.interrupt_bonus || 0)), 0);
      const 融合概率 = Number(getFusionScaledInterruptChance(skill) || 0);
      const 外部概率 = Number(settleResult?.interrupt_bonus || 0);
      const 基础概率 = Math.max(原型概率, 融合概率, 外部概率);
      if (!(基础概率 > 0)) return 0;
      return Math.max(0, Math.min(1, 基础概率));
    }

    function 是否一次性武魂融合基础属性前置(状态效果 = {}) {
      if (!状态效果 || typeof 状态效果 !== 'object') return false;
      const 标识 = String(状态效果.特殊机制标识 || '').trim();
      const 目标 = String(状态效果.目标 || '').trim();
      if (目标 && !/自身|施术者/.test(目标)) return false;
      return 标识.includes('武魂融合技') && 标识.includes('一次性释放') && 标识.includes('基础属性融合');
    }

    function 套用一次性武魂融合前置属性(基础最终属性 = {}, 状态效果 = {}) {
      const 结果 = { ...(基础最终属性 || {}) };
      const 面板修改比例 =
        状态效果?.面板修改比例 && typeof 状态效果.面板修改比例 === 'object' ? 状态效果.面板修改比例 : {};
      ['str', 'def', 'agi'].forEach(属性 => {
        if (结果[属性] !== undefined && 面板修改比例[属性] !== undefined) {
          结果[属性] = Math.round(Number(结果[属性] || 0) * Number(面板修改比例[属性] || 1));
        }
      });
      ['vit_max', 'sp_max', 'men_max'].forEach(属性 => {
        if (结果[属性] !== undefined && 面板修改比例[属性] !== undefined) {
          结果[属性] = Math.round(Number(结果[属性] || 0) * Number(面板修改比例[属性] || 1));
        }
      });
      [
        ['vit', 'vit_max'],
        ['sta', 'vit_max'],
        ['sp', 'sp_max'],
        ['men', 'men_max'],
      ].forEach(([当前属性, 上限属性]) => {
        const 倍率 = Number(面板修改比例[上限属性] ?? 1);
        if (结果[当前属性] !== undefined && Number.isFinite(倍率)) {
          结果[当前属性] = Math.min(
            Number(结果[上限属性] || Infinity),
            Math.round(Number(结果[当前属性] || 0) * 倍率),
          );
        }
      });
      return 结果;
    }

    function 读取一次性武魂融合前置战斗效果(状态效果 = {}) {
      if (!是否一次性武魂融合基础属性前置(状态效果)) return null;
      const 计算层效果 = 状态效果?.计算层效果 && typeof 状态效果.计算层效果 === 'object' ? 状态效果.计算层效果 : {};
      const 即时效果 = { ...createEmptyCombatEffectMap(), ...计算层效果 };
      即时效果.skill_effect_mult = 1;
      return 即时效果;
    }

    function getPrimaryStateName(skill) {
      const state = getPrimaryStateEffect(skill);
      if (state?.状态名称 && state.状态名称 !== '无') return state.状态名称;
      const fallback = getSkillEffects(skill).find(effect =>
        [
          '感知干扰',
          '隐身',
          '破隐',
          '标记锁定',
          '目标锁定',
          '幻境',
          '催眠',
          '认知扭曲',
          '禁疗',
          '缴械',
          '嘲讽',
          '护卫',
          '减速',
          '软控',
          '位移限制',
          '强制绑定/锁定',
          '自身位移',
          '强制位移',
          '位移交换',
          '追击',
          '追击位移',
          '脱离位移',
          '反制',
          '转化',
          '复制',
          '状态交换',
          '状态转移',
          '引爆持续伤害',
          '斩盾',
          '治疗反转',
          '封技',
          '无敌金身',
          '伤害反射',
          '伤害转移',
          '伤害分摊',
          '消耗分摊',
          '硬控',
          '霸体',
          '护盾',
        ].includes(effect?.原型),
      );
      return fallback ? 读取战斗效果标签(fallback) : '';
    }

    function getPrimaryStateFlags(skill) {
      return String(getPrimaryStateEffect(skill)?.特殊机制标识 || '无');
    }

    function 技能包含原型(skill, 原型列表 = []) {
      const targets = new Set((Array.isArray(原型列表) ? 原型列表 : [原型列表]).map(item => String(item || '').trim()).filter(Boolean));
      if (!targets.size) return false;
      return getSkillEffects(skill).some(effect => targets.has(String(effect?.原型 || '').trim()));
    }

    function 读取技能原型标签(skill) {
      return Array.from(
        new Set(
          getSkillEffects(skill)
            .flatMap(effect => [effect?.原型])
            .map(effect => String(effect || '').trim())
            .filter(Boolean),
        ),
      );
    }

    function 战斗效果含结构化持续伤害(effect = {}) {
      if (!effect || typeof effect !== 'object' || Array.isArray(effect)) return false;
      const 战斗效果 = effect?.战斗效果 && typeof effect.战斗效果 === 'object' ? effect.战斗效果 : {};
      if (Number(战斗效果.dot_damage || 0) > 0 || Number(战斗效果.dot_damage_ratio || 0) > 0) return true;
      if (
        String(effect?.原型 || '').trim() === '资源变化' &&
        String(effect?.资源 || '').trim() === '生命' &&
        Number(effect?.持续回合 || effect?.duration || 0) > 0 &&
        读取战斗数值正负(effect?.数值) < 0
      ) return true;
      return String(effect?.原型 || '').trim() === '状态施加' && Number(effect?.计算层效果?.dot_damage_ratio || 0) > 0;
    }

    function 读取结构化持续伤害数值(effect = {}) {
      if (!effect || typeof effect !== 'object' || Array.isArray(effect)) return 0;
      if (
        String(effect?.原型 || '').trim() === '资源变化' &&
        String(effect?.资源 || '').trim() === '生命' &&
        Number(effect?.持续回合 || effect?.duration || 0) > 0 &&
        !读取战斗数值是否百分比(effect?.数值)
      ) return Math.max(0, -读取战斗数值正负(effect?.数值));
      return 0;
    }

    function 读取结构化持续伤害比例(effect = {}) {
      if (!effect || typeof effect !== 'object' || Array.isArray(effect)) return 0;
      if (
        String(effect?.原型 || '').trim() === '资源变化' &&
        String(effect?.资源 || '').trim() === '生命' &&
        Number(effect?.持续回合 || effect?.duration || 0) > 0 &&
        读取战斗数值是否百分比(effect?.数值)
      ) return Math.max(0, -读取战斗数值正负(effect?.数值));
      return Math.max(0, Number(effect?.计算层效果?.dot_damage_ratio || 0));
    }

    const 非生命流失状态名集合 = new Set([
      '位移限制',
      '迟缓',
      '眩晕',
      '沉默',
      '致盲',
      '封技',
      '禁疗',
      '防御剥夺',
      '精神抗性剥夺',
      '标记',
      '嘲讽',
      '护卫',
      '僵直',
      '失控',
      '精神紊乱',
      '虚弱',
    ]);

    function 状态名禁止生命流失(状态名 = '') {
      const 名称 = String(状态名 || '').trim();
      return 非生命流失状态名集合.has(名称);
    }

    function 清理非生命流失状态伤害字段(状态名 = '', 战斗效果 = {}) {
      if (!战斗效果 || typeof 战斗效果 !== 'object' || !状态名禁止生命流失(状态名)) return 战斗效果;
      战斗效果.dot_damage = 0;
      战斗效果.dot_damage_ratio = 0;
      return 战斗效果;
    }

    function 估算单位持续伤害数值(单位 = {}, effect = {}) {
      const 固定伤害 = Math.max(读取结构化持续伤害数值(effect), Number(effect?.战斗效果?.dot_damage || effect?.dot_damage || 0));
      const 比例伤害 = Math.max(读取结构化持续伤害比例(effect), Number(effect?.战斗效果?.dot_damage_ratio || effect?.dot_damage_ratio || 0));
      return Math.max(0, 固定伤害 + (比例伤害 > 0 ? Math.floor(getCombatHpMaxValue(单位) * 比例伤害) : 0));
    }

    function 读取战斗原型运行消费器(effect = {}) {
      const 原型 = String(effect?.原型 || '').trim();
      if (!原型) return '';
      if (Number(effect?.延迟回合 || 0) > 0 && 战斗原型允许延迟回合(原型)) return 'delay_burst';
      if (原型 === '伤害结算') return Number(effect?.攻击段数 || effect?.段数 || 1) > 1 ? 'multi_damage' : 'direct_damage';
      if (原型 === '时窗修正') return effect?.引爆倍率 !== undefined || effect?.结算倍率 !== undefined ? 'dot_detonate' : 'time_window';
      if (原型 === '状态转移') return 'status_transfer';
      if (原型 === '状态交换') return 'status_exchange';
      if (原型 === '复制执行') return 'copy';
      if (原型 === '资源锁定') return 'resource_lock';
      if (原型 === '机制抹消') return 'mechanism_suppress';
      if (原型 === '机制授予') return 'mechanism_grant';
      if (原型 === '召唤生成') return 'summon';
      if (原型 === '时光回溯') return 'time_rewind';
      if (原型 === '炸环') return 'ring_burst_gain';
      if (原型 === '规则改写') {
        const 规则 = String(effect?.规则 || '').trim();
        if (规则 === '缴械') return 'disarm';
        return 'rule_rewrite';
      }
      if (原型 === '资源转移') {
        const 转移方式 = String(effect?.资源转移方式 || '').trim();
        if (转移方式 === '共享') return 'resource_refeed';
        if (转移方式 === '均分') return 'resource_refeed';
        if (转移方式 !== '吞噬') return '';
        return 'resource_drain';
      }
      if (原型 === '资源变化') {
        const 资源 = String(effect?.资源 || '').trim();
        if (资源 === '魂力') return 'recover_sp';
        if (资源 === '精神力') return 'recover_men';
        return 'recover_vit';
      }
      if (原型 === '护盾变化') return 读取战斗数值正负(effect?.数值) < 0 ? 'shield_break' : 'shield';
      if (原型 === '属性修正') {
        const 数值 = 读取战斗数值正负(effect?.数值);
        return 数值 < 0 ? 'attribute_debuff' : 'attribute_buff';
      }
      if (原型 === '判定修正') return 'judge_effect';
      if (原型 === '决策干扰') {
        return 'judge_effect';
      }
      if (原型 === '位移执行') {
        const 位移 = String(effect?.位移类型 || '').trim();
        const 位移对象 = String(effect?.位移对象 || '').trim();
        if (位移 === '换位') return 'position_exchange';
        if (位移 === '瞬移') return 'self_shift';
        if (位移 === '脱离') return 'disengage_shift';
        if (位移 === '拉近' && 位移对象 === '自身') return 'pursuit_shift';
        return 'hostile_shift';
      }
      if (原型 === '规则防御') {
        const 规则 = String(effect?.规则 || '').trim();
        if (规则 === '免伤') return 'block';
        if (规则 === '免死') return 'death_save';
      }
      if (原型 === '结算修正') {
        const 结算 = String(effect?.结算 || '').trim();
        const 数值 = 读取战斗数值正负(effect?.数值);
        const 表 = {
          技能效果: 'skill_effect_amplify',
          反伤: 'damage_reflect',
          伤害转移: 'damage_transfer',
          伤害吸收: 'damage_absorb',
          伤害转治疗: 'damage_to_heal',
          治疗转伤害: 'heal_to_damage',
          伤害分摊: 'damage_share',
          消耗分摊: 'cost_share',
          防御穿透: 'armor_penetration',
          反击: 'counter',
          持续伤害引爆: 'dot_detonate',
        };
        if (结算 === '造成伤害') return 数值 < 0 ? 'damage_reduce' : 'power_amplify';
        if (结算 === '受到伤害') return 数值 < 0 ? 'damage_reduce' : 'expose_weakness';
        if (结算 === '防御剥夺' || 结算 === '精神抗性剥夺') return 'expose_weakness';
        if (结算 === '治疗') return 'heal_amplify';
        if (结算 === '消耗') return 数值 < 0 ? 'cost_reduce' : 'cost_increase';
        if (结算 === '前摇') return 数值 < 0 ? 'windup_reduce' : 'windup_increase';
        return 表[结算] || 'judge_effect';
      }
      if (原型 === '状态移除') {
        const 状态 = String(effect?.状态 || '').trim();
        return 状态 === '隐匿' ? 'reveal' : 'cleanse';
      }
      if (原型 === '状态施加') {
        if (战斗效果含结构化持续伤害(effect)) return 'dot_damage';
        const 状态 = String(effect?.状态 || '').trim();
        const 表 = {
          眩晕: 'hard_control',
          迟缓: 'slow',
          位移限制: 'position_lock',
          封技: 'skill_seal',
          沉默: 'silence',
          缴械: 'disarm',
          致盲: 'blind',
          禁疗: 'anti_heal',
          治疗反转: 'heal_inversion',
          隐匿: 'stealth',
          探查屏蔽: 'sense_block',
          护盾: 'shield',
          无视异常: '无视异常',
          霸体: 'super_armor',
          反制: 'counter',
          受击反击: 'on_hit_counter',
          资源燃烧: 'resource_burn',
          持续恢复: 'recover_over_time',
          共享视野: 'shared_vision',
          标记: 'target_lock',
          护卫: 'guard',
          嘲讽: 'taunt',
        };
        return 表[状态] || 'judge_effect';
      }
      return '';
    }

    function 读取战斗效果运行语义(effect = {}) {
      const consumer = String(effect?.运行时消费器 || 读取战斗原型运行消费器(effect)).trim();
      if (!consumer) return '上下文';
      if (LOCAL_BATTLE_SELF_ONLY_CONSUMERS.has(consumer)) return '仅自身';
      if (BATTLE_SUPPORT_RUNTIME_CONSUMERS.has(consumer) || BATTLE_DEFENSE_RUNTIME_CONSUMERS.has(consumer)) return '可赋予';
      if (BATTLE_OUTPUT_RUNTIME_CONSUMERS.has(consumer) || BATTLE_CONTROL_RUNTIME_CONSUMERS.has(consumer)) return '敌对';
      return '上下文';
    }

    function getBattleEffectRuntimeMeta(effect = {}) {
      const 原型 = String(effect?.原型 || '').trim();
      if (!原型) return null;
      const consumer = String(effect?.运行时消费器 || 读取战斗原型运行消费器(effect)).trim();
      return {
        运行时消费器: consumer,
        目标语义: 读取战斗效果运行语义(effect),
        原型入口: 原型,
        摘要提示: {},
      };
    }

    const BATTLE_OUTPUT_RUNTIME_CONSUMERS = new Set([
      'direct_damage',
      'multi_damage',
      'dot_damage',
      'dot_detonate',
      'shield_break',
      'armor_penetration',
      'damage_absorb',
    ]);
    const BATTLE_CONTROL_RUNTIME_CONSUMERS = new Set([
      'hard_control',
      'soft_control',
      'position_lock',
      'interrupt',
      'skill_seal',
      'anti_heal',
      'heal_inversion',
      'cost_increase',
      'windup_increase',
      'mastery_reduce',
      'speed_reduce',
      'perception_disturb',
      'judge_effect',
      'target_lock',
      'hostile_shift',
      'position_exchange',
      'hard_lock',
      'status_transfer',
      'dispel_buff',
      'steal_buff',
      'resource_drain',
      'mechanism_suppress',
      'element_seal',
      'rule_rewrite',
      'misfortune_backlash',
      'taunt',
      'reveal',
      'slow',
      'blind',
      'silence',
      'disarm',
      'expose_weakness',
    ]);
    const BATTLE_DEFENSE_RUNTIME_CONSUMERS = new Set([
      'shield',
      'damage_reduce',
      'block',
      'super_armor',
      'death_save',
      'invincible',
      'damage_reflect',
      'damage_transfer',
      'damage_share',
      'cost_share',
      'revive',
      'guard',
      'clone',
      'counter',
      'on_hit_counter',
    ]);
    const BATTLE_SUPPORT_RUNTIME_CONSUMERS = new Set([
      'attribute_buff',
      'cost_reduce',
      'windup_reduce',
      'mastery_raise',
      'speed_raise',
      'recover_vit',
      'recover_sp',
      'recover_men',
      'recover_over_time',
      'cleanse',
      'shared_vision',
      'self_shift',
      'pursuit_shift',
      'disengage_shift',
      'damage_to_heal',
      'resource_refeed',
      'stealth',
      'power_amplify',
      'luck_interference',
      'time_rewind',
      'summon',
      'cost_share',
    ]);
    const BATTLE_MOBILITY_RUNTIME_CONSUMERS = new Set([
      'self_shift',
      'hostile_shift',
      'position_exchange',
      'pursuit_shift',
      'disengage_shift',
      'pursuit_mark',
      'stealth',
      'sense_block',
    ]);
    const BATTLE_SPECIAL_RULE_RUNTIME_CONSUMERS = new Set([
      'clone',
      'copy',
      'counter',
      'damage_to_heal',
      'heal_to_damage',
      'status_exchange',
      'status_transfer',
      'hard_lock',
      'judge_effect',
      'self_rule_rewrite',
      'self_random_variance',
      'self_mirror',
      'self_sacrifice_gain',
      'dot_detonate',
      'shield_break',
      'resource_drain',
      'resource_refeed',
      'mechanism_suppress',
      'ring_burst_gain',
      'rule_rewrite',
      'luck_interference',
      'misfortune_backlash',
      'time_rewind',
      'summon',
    ]);
    const BATTLE_SUSTAIN_RUNTIME_CONSUMERS = new Set([
      'dot_damage',
      'recover_over_time',
      'shield',
      'damage_reduce',
      'super_armor',
      'shared_vision',
      'clone',
      'guard',
      'stealth',
      'sense_block',
      'taunt',
      'slow',
      'blind',
      'silence',
      'disarm',
      'target_lock',
      'perception_disturb',
      'summon',
    ]);
    const BATTLE_TRIGGER_RUNTIME_CONSUMERS = new Set([
      'block',
      'death_save',
      'invincible',
      'damage_reflect',
      'damage_transfer',
      'damage_share',
      'cost_share',
      'revive',
      'counter',
      'on_hit_counter',
      'self_rule_rewrite',
    ]);

    const LOCAL_BATTLE_GROUP_GRANTABLE_CONSUMERS = new Set([
      'attribute_buff',
      'shield',
      'damage_reduce',
      'shared_vision',
      'recover_vit',
      'recover_sp',
      'recover_men',
      'recover_over_time',
      'cleanse',
      'damage_share',
      'resource_refeed',
    ]);
    const LOCAL_BATTLE_SELF_ONLY_CONSUMERS = new Set([
      'self_rule_rewrite',
      'self_random_variance',
      'self_mirror',
      'self_sacrifice_gain',
      'summon',
    ]);
    const LOCAL_BATTLE_MECHANISM_CONSUMER_BY_LABEL = Object.freeze({
      多段伤害: 'multi_damage',
      硬控: 'hard_control',
      软控: 'soft_control',
      位移限制: 'position_lock',
      打断: 'interrupt',
      封技: 'skill_seal',
      单属性削弱: 'attribute_debuff',
      多属性削弱: 'attribute_debuff',
      禁疗: 'anti_heal',
      治疗反转: 'heal_inversion',
      掌控压制: 'mastery_reduce',
      速度压制: 'speed_reduce',
      单属性增益: 'attribute_buff',
      多属性增益: 'attribute_buff',
      全属性增益: 'attribute_buff',
      掌控提升: 'mastery_raise',
      速度提升: 'speed_raise',
      威力增幅: 'power_amplify',
      技能效果增幅: 'skill_effect_amplify',
      元素封禁: 'element_seal',
      护盾: 'shield',
      承伤修正: 'damage_reduce',
      免伤: 'block',
      霸体: 'super_armor',
      免死: 'death_save',
      '免死/锁血': 'death_save',
      无敌金身: '无视异常',
      伤害反射: 'damage_reflect',
      伤害转移: 'damage_transfer',
      伤害分摊: 'damage_share',
      消耗分摊: 'cost_share',
      体力恢复: 'recover_vit',
      魂力恢复: 'recover_sp',
      精神恢复: 'recover_men',
      持续恢复: 'recover_over_time',
      解控: 'cleanse',
      净化: 'cleanse',
      感知干扰: 'perception_disturb',
      探查屏蔽: 'sense_block',
      标记锁定: 'judge_effect',
      共享视野: 'shared_vision',
      幻境: 'judge_effect',
      催眠: 'judge_effect',
      认知扭曲: 'judge_effect',
      目标锁定: 'target_lock',
      自身位移: 'self_shift',
      强制位移: 'hostile_shift',
      位移交换: 'position_exchange',
      追击位移: 'pursuit_shift',
      脱离位移: 'disengage_shift',
      追击: 'pursuit_mark',
      召唤: 'summon',
      分身: 'clone',
      复制: 'copy',
      反制: 'counter',
      受击反击: 'on_hit_counter',
      伤害转回复: 'damage_to_heal',
      回复转伤害: 'heal_to_damage',
      状态交换: 'status_exchange',
      状态转移: 'status_transfer',
      '强制绑定/锁定': 'hard_lock',
      规则改写: 'rule_rewrite',
      炸环: 'ring_burst_gain',
      时光回溯: 'time_rewind',
      气运干涉: 'luck_interference',
      引爆持续伤害: 'dot_detonate',
      斩盾: 'shield_break',
      驱散增益: 'dispel_buff',
      窃取增益: 'steal_buff',
      隐身: 'stealth',
      护卫: 'guard',
      嘲讽: 'taunt',
      破隐: 'reveal',
      减速: 'slow',
      迟缓: 'slow',
      致盲: 'blind',
      沉默: 'silence',
      缴械: 'disarm',
      标记弱点: 'expose_weakness',
      斩杀补伤: 'judge_effect',
      穿透: 'armor_penetration',
      伤害吸收: 'damage_absorb',
      吞噬: 'resource_drain',
      能力共享: 'resource_refeed',
      机制抹消: 'mechanism_suppress',
      资源锁定: 'resource_lock',
    });
    const LOCAL_BATTLE_DEFENSE_NATURE_BY_LABEL = Object.freeze({
      反制: '反制',
      受击反击: '反制',
      免死: '免死',
      '免死/锁血': '免死',
      无敌金身: '无视异常',
      伤害分摊: '分摊',
      消耗分摊: '分摊',
      伤害反射: '反射',
      伤害转移: '反射',
      霸体: '霸体',
      护卫: '护卫',
      分身: '分身',
      隐身: '分身',
      免伤: '免伤',
      承伤修正: '承伤修正',
      护盾: '护盾',
    });
    const LOCAL_BATTLE_RECOVER_NATURE_BY_LABEL = Object.freeze({
      体力恢复: '体力恢复',
      魂力恢复: '资源回复',
      精神恢复: '资源回复',
      持续恢复: '持续恢复',
      净化: '净化',
      解控: '净化',
      复活机制: '复活机制',
      能力共享: '资源回复',
    });
    function collectBattleMechanismTagsFromDescriptor(name = '', cond = {}) {
      const tags = [];
      const ce = cond?.战斗效果 || cond?.计算层效果 || {};
      const text = String(name || '').trim();
      const 原型 = String(cond?.原型 || cond?.运行机制 || '').trim();
      if (原型 === '规则防御') tags.push('防御机制');
      if (原型 === '机制抹消' || 原型 === '机制授予') tags.push('特殊规则');
      if (原型 === '状态施加') {
        const 状态名 = String(cond?.状态 || cond?.状态名称 || '').trim();
        if (['眩晕', '沉默', '缴械', '致盲', '封技', '迟缓', '位移限制'].includes(状态名)) tags.push('控制机制');
        if (['持续恢复'].includes(状态名)) tags.push('回复机制');
        if (['无视异常', '霸体', '护盾'].includes(状态名)) tags.push('防御机制', '增益');
      }
      if (cond?.类型 === 'buff') tags.push('增益');
      if (
        Number(cond?.shield_value || 0) > 0 ||
        /护盾|屏障|结界/.test(text)
      )
        tags.push('护盾', '防御机制', '增益');
      if (Number(ce.stealth_level || 0) > 0 || /隐身|潜行/.test(text)) tags.push('隐身', '增益');
      if (ce.探查屏蔽 === true || /探查屏蔽|感知屏蔽|精神屏蔽/.test(text)) tags.push('特殊规则', '增益');
      if (Number(ce.revive_count || 0) > 0 || /复活/.test(text)) tags.push('复活机制', '回复机制', '防御机制');
      if (
        Number(ce.death_save_count || 0) > 0 ||
        Number(ce.min_hp_floor || 0) > 0 ||
        ce.invincible === true ||
        ce.super_armor === true ||
        Number(ce.block_count || 0) > 0 ||
        Number(ce.damage_reduction || 0) > 0 ||
        Number(ce.damage_reflect_ratio || 0) > 0 ||
        Number(ce.damage_transfer_ratio || 0) > 0 ||
        Number(ce.damage_share_ratio || 0) > 0 ||
        Number(ce.cost_share_ratio || 0) > 0
      )
        tags.push('防御机制');
      if (
        Number(ce.final_heal_mult || 1) > 1 ||
        Number(ce.final_heal_bonus || 0) > 0 ||
        Number(ce.vit_gain_ratio || 0) > 0 ||
        Number(ce.sp_gain_ratio || 0) > 0 ||
        Number(ce.men_gain_ratio || 0) > 0 ||
        Number(ce.hot_heal_ratio || 0) > 0 ||
        /回血|治疗|再生|回复|回魂|回精神/.test(text)
      )
        tags.push('回复机制');
      if (
        ce.skip_turn === true ||
        ce.cannot_react === true ||
        ce.skill_seal === true ||
        Number(ce.lock_level || 0) > 0 ||
        Number(ce.reaction_penalty || 0) > 0 ||
        Number(ce.cast_speed_penalty || 0) > 0 ||
        Number(ce.dodge_penalty || 0) > 0 ||
        Number(ce.heal_block_ratio || 0) > 0 ||
        Number(ce.heal_inversion_ratio || 0) > 0 ||
        /封技|沉默|缴械|打断|锁定|禁疗|控制|硬控|软控|减速|迟缓|嘲讽|破隐/.test(text)
      )
        tags.push('控制机制');
      if (
        /分身|复制|状态交换|状态转移|引爆持续伤害|斩盾|吞噬|能力共享|机制抹消|共享视野|护卫/.test(text)
      )
        tags.push('特殊规则');
      return Array.from(new Set(tags));
    }

    function getActiveMechanismSuppressionEntries(targetChar) {
      if (!targetChar?.状态效果) return [];
      return Object.entries(targetChar.状态效果)
        .flatMap(([key, cond]) => (Array.isArray(cond?.抹消规则) ? cond.抹消规则 : []).map(rule => ({
          key,
          cond,
          tags: [读取战斗机制抹消对象摘要(rule?.抹消对象 || {})],
        })));
    }

    function 读取资源变化抹消规则(targetChar, 资源 = '', options = {}) {
      const 资源文本 = String(资源 || '').trim();
      return 战斗机制抹消命中(
        targetChar,
        '最终结果',
        资源文本 ? { 原型: '资源变化', 资源: 资源文本 } : { 原型: '资源变化' },
        { 用途: '封锁', ...options },
      );
    }

    function 读取战斗资源键标签(resourceKey = '') {
      if (resourceKey === 'hp') return '生命';
      if (resourceKey === 'vit') return '体力';
      if (resourceKey === 'men') return '精神力';
      return '魂力';
    }

    function 读取规则改写目标标识(单位 = {}) {
      return String(单位?.召唤键 || 单位?.name || 单位?.名称 || 单位?.charKey || 单位?.key || '').trim();
    }

    function 读取规则改写强度(规则 = {}) {
      const 原始值 = 读取战斗数值正负(规则?.强度 ?? 规则?.数值 ?? '100%');
      const 强度 = Math.abs(Number(原始值 || 0)) || 1;
      return Math.max(0, Math.min(2, 强度));
    }

    function 读取战斗规则改写运行态列表(combatData = null) {
      const 战斗数据 = combatData || getCurrentBattleContextSnapshot() || {};
      if (!Array.isArray(战斗数据.__规则改写运行态)) 战斗数据.__规则改写运行态 = [];
      return 战斗数据.__规则改写运行态;
    }

    function 规则改写目标命中(规则 = {}, 目标 = null) {
      if (!目标) return false;
      if (String(规则?.目标范围 || '').trim() === '全场') return true;
      const 目标标识 = 读取规则改写目标标识(目标);
      return !!目标标识 && String(规则?.目标标识 || '').trim() === 目标标识;
    }

    function 读取规则改写规则(combatData = null, 目标 = null, 规则名 = '') {
      const 名称 = String(规则名 || '').trim();
      if (!名称 || !目标) return null;
      return 读取战斗规则改写运行态列表(combatData)
        .filter(规则 => String(规则?.规则 || '').trim() === 名称)
        .filter(规则 => Math.max(0, Number(规则?.剩余回合 || 0)) > 0)
        .filter(规则 => 规则改写目标命中(规则, 目标))
        .sort((a, b) => 读取规则改写强度(b) - 读取规则改写强度(a))[0] || null;
    }

    function 登记战斗规则改写运行态(combatData = {}, effect = {}, targetUnits = [], caster = {}, skill = {}) {
      const 规则 = String(effect?.规则 || '').trim();
      if (!规则) return 0;
      if (规则 === '死亡转存活') return 0;
      const 目标文本 = String(effect?.目标 || '').trim();
      const 目标范围 = 目标文本 === '全场' ? '全场' : '目标';
      const 持续回合 = Math.max(1, Math.round(Number(effect?.持续回合 || 1)));
      const 运行态列表 = 读取战斗规则改写运行态列表(combatData);
      const 当前回合 = Math.max(0, Number(combatData?.回合 || 0));
      const 目标列表 = 目标范围 === '全场'
        ? [null]
        : dedupeCombatTargetList(Array.isArray(targetUnits) ? targetUnits : [targetUnits]).filter(Boolean);
      let 数量 = 0;
      目标列表.forEach(目标 => {
        const 目标标识 = 目标范围 === '全场' ? '全场' : 读取规则改写目标标识(目标);
        if (!目标标识) return;
        运行态列表.push({
          规则,
          目标范围,
          目标标识,
          剩余回合: 持续回合,
          强度: 读取规则改写强度(effect),
          数值: effect?.数值,
          创建回合: 当前回合,
          来源角色: caster?.name || caster?.名称 || '',
          来源技能: skill?.name || skill?.魂技名 || '',
        });
        数量 += 1;
      });
      return 数量;
    }

    const 战斗机制抹消可匹配字段表 = Object.freeze({
      状态施加: Object.freeze(['状态']),
      状态移除: Object.freeze(['状态', '匹配原型', '资源']),
      状态转移: Object.freeze(['状态']),
      状态交换: Object.freeze(['状态']),
      规则防御: Object.freeze(['规则']),
      规则改写: Object.freeze(['规则']),
      资源变化: Object.freeze(['资源']),
      资源转移: Object.freeze(['资源', '资源转移方式']),
      资源锁定: Object.freeze(['资源']),
      结算修正: Object.freeze(['结算']),
      属性修正: Object.freeze(['属性']),
      复制执行: Object.freeze(['复制类型']),
    });

    const 战斗机制抹消支持原型 = new Set([
      '资源变化',
      '资源转移',
      '护盾变化',
      '属性修正',
      '判定修正',
      '结算修正',
      '炸环',
      '状态施加',
      '时窗修正',
      '状态移除',
      '规则防御',
      '状态转移',
      '状态交换',
      '资源锁定',
      '规则改写',
      '机制抹消',
      '机制授予',
      '复制执行',
      '时光回溯',
      '位移执行',
      '决策干扰',
      '召唤生成',
    ]);

    const 战斗机制抹消全部字段值 = new Set(['全部', '抹消全部', '全部状态', '全部规则', '全部资源', '全部结算', '全部属性', '全部原型', '全部转移方式', '全部复制类型']);

    function 读取战斗机制抹消可匹配字段(原型 = '') {
      const 原型名 = String(原型 || '').trim();
      return Array.isArray(战斗机制抹消可匹配字段表[原型名]) ? 战斗机制抹消可匹配字段表[原型名] : [];
    }

    function 规范化战斗机制抹消对象(value = {}) {
      const source = value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : { 原型: String(value || '').trim() || '机制授予' };
      const result = { 原型: String(source.原型 || '机制授予').trim() || '机制授予' };
      if (!战斗机制抹消支持原型.has(result.原型)) return result;
      读取战斗机制抹消可匹配字段(result.原型).forEach(key => {
        const 原始列表 = Array.isArray(source[key]) ? source[key] : String(source[key] ?? '').split(/[、,，|/]/);
        if (原始列表.some(item => 战斗机制抹消全部字段值.has(String(item ?? '').trim()))) return;
        const 字段列表 = Array.from(new Set(
          原始列表
            .map(item => String(item ?? '').trim())
            .filter(item => item && item !== '无' && !战斗机制抹消全部字段值.has(item)),
        ));
        if (字段列表.length === 1) result[key] = 字段列表[0];
        else if (字段列表.length > 1) result[key] = 字段列表;
      });
      return result;
    }

    function 读取战斗机制抹消对象摘要(object = {}) {
      const matcher = 规范化战斗机制抹消对象(object);
      const parts = [String(matcher.原型 || '机制')];
      读取战斗机制抹消可匹配字段(matcher.原型).forEach(key => {
        const 字段值 = Array.isArray(matcher[key]) ? matcher[key].map(item => String(item || '').trim()).filter(Boolean).join('、') : String(matcher[key] || '').trim();
        if (字段值) parts.push(`${key}:${字段值}`);
      });
      return parts.join(' ');
    }

    function 读取战斗机制候选原型(candidate = {}) {
      const 原型 = String(candidate?.原型 || candidate?.来源原型摘要 || '').trim();
      if (原型) return 原型;
      if (Array.isArray(candidate?.抹消规则) || candidate?.战斗效果?.mechanism_suppress === true) return '机制抹消';
      if (candidate?.效果授予状态 === true || candidate?.战斗效果?.mechanism_grant === true || Array.isArray(candidate?.授予效果)) return '机制授予';
      if (Number(candidate?.shield_value || 0) > 0) return '护盾变化';
      const ce = candidate?.战斗效果 || {};
      if (Number(ce.block_count || 0) > 0 || Number(ce.death_save_count || 0) > 0 || ce.invincible === true || ce.super_armor === true || Number(ce.revive_count || 0) > 0) return '规则防御';
      return '';
    }

    function 战斗机制字段匹配(expected, values = []) {
      const 预期列表 = (Array.isArray(expected) ? expected : [expected]).map(item => String(item || '').trim()).filter(Boolean);
      if (!预期列表.length) return true;
      const 候选列表 = values.map(item => String(item || '').trim()).filter(Boolean);
      return 预期列表.some(item => 候选列表.includes(item));
    }

    function 战斗机制对象匹配(matcher = {}, candidate = {}) {
      const rule = 规范化战斗机制抹消对象(matcher);
      if (String(rule.原型 || '').trim() !== 读取战斗机制候选原型(candidate)) return false;
      if (!战斗机制字段匹配(rule.状态 || rule.状态名称, [candidate?.状态, candidate?.状态名称, candidate?.name, candidate?.key])) return false;
      if (!战斗机制字段匹配(rule.规则, [candidate?.规则, candidate?.战斗效果?.规则])) return false;
      if (!战斗机制字段匹配(rule.资源, [candidate?.资源])) return false;
      if (!战斗机制字段匹配(rule.结算, [candidate?.结算])) return false;
      if (!战斗机制字段匹配(rule.属性, [candidate?.属性])) return false;
      if (!战斗机制字段匹配(rule.匹配原型, [candidate?.匹配原型])) return false;
      if (!战斗机制字段匹配(rule.资源转移方式, [candidate?.资源转移方式])) return false;
      if (!战斗机制字段匹配(rule.复制类型, [candidate?.复制类型])) return false;
      return true;
    }

    function 读取战斗机制抹消规则列表(targetChar, point = '') {
      if (!targetChar?.状态效果) return [];
      void point;
      return Object.entries(targetChar.状态效果)
        .flatMap(([key, cond]) => (Array.isArray(cond?.抹消规则) ? cond.抹消规则 : []).map((rule, index) => ({
          key,
          状态: cond,
          规则索引: index,
          抹消对象: 规范化战斗机制抹消对象(rule?.抹消对象),
        })));
    }

    function 战斗机制抹消命中(targetChar, point = '', candidate = {}, options = {}) {
      const purpose = String(options?.用途 || '封锁').trim();
      const 命中规则 = 读取战斗机制抹消规则列表(targetChar, point).find(rule => {
        void purpose;
        if (String(candidate?.原型 || '').trim() === '伤害结算' && String(point || '').trim() !== '源动作') return false;
        return 战斗机制对象匹配(rule.抹消对象, candidate);
      }) || null;
      if (
        命中规则 &&
        options?.消费 !== false &&
        String(命中规则?.状态?.抹消规则?.[命中规则.规则索引]?.抹消方式 || '').trim() === '阻断本次'
      ) {
        命中规则.状态.抹消规则.splice(命中规则.规则索引, 1);
      }
      return 命中规则;
    }

    function 移除战斗机制抹消命中节点(targetChar, point = '', matcher = {}, options = {}) {
      if (!targetChar?.状态效果) return [];
      const excluded = new Set(Array.isArray(options.excludeKeys) ? options.excludeKeys : []);
      const removed = [];
      Object.entries(targetChar.状态效果).forEach(([key, cond]) => {
        if (excluded.has(key)) return;
        if (!cond || typeof cond !== 'object' || Array.isArray(cond)) return;
        if (String(key || '').startsWith(AUTO_PROJECTED_CONDITION_PREFIX)) return;
        const candidate = { ...cond, key, name: key };
        const 延迟效果命中 = cond.延迟效果 === true &&
          Array.isArray(cond.结算效果) &&
          String(point || '').trim() !== '源动作' &&
          cond.结算效果.some(effect => String(effect?.原型 || '').trim() !== '伤害结算' && 战斗机制对象匹配(matcher, effect));
        const 抹消规则内部命中 = Array.isArray(cond.抹消规则) &&
          cond.抹消规则.some(rule => 战斗机制对象匹配(matcher, 规范化战斗机制抹消对象(rule?.抹消对象)));
        const 候选原型 = 读取战斗机制候选原型(candidate);
        const 匹配原型 = String(规范化战斗机制抹消对象(matcher).原型 || '').trim();
        if (point === '最终结果' && 候选原型 === '机制授予' && 匹配原型 !== '机制授予') return;
        if (!延迟效果命中 && !抹消规则内部命中 && !战斗机制对象匹配(matcher, candidate)) return;
        delete targetChar.状态效果[key];
        removed.push(key);
        if (targetChar.持续效果) {
          Object.keys(targetChar.持续效果).forEach(sustainKey => {
            if (targetChar.持续效果[sustainKey]?.related_condition === key) delete targetChar.持续效果[sustainKey];
          });
        }
        if (targetChar.召唤键) 同步召唤单位镜像(targetChar);
      });
      return removed;
    }

    function 移除战斗机制抹消命中运行态(combatData = {}, point = '', matcher = {}, target = null) {
      if (!combatData || !Array.isArray(combatData.__规则改写运行态)) return [];
      if (String(point || '').trim() === '源动作') return [];
      const removed = [];
      combatData.__规则改写运行态 = combatData.__规则改写运行态.filter(规则 => {
        const candidate = { 原型: '规则改写', 规则: 规则?.规则 };
        if (target && !规则改写目标命中(规则, target)) return true;
        if (!战斗机制对象匹配(matcher, candidate)) return true;
        removed.push(String(规则?.规则 || '规则改写').trim() || '规则改写');
        return false;
      });
      return removed;
    }

    function 技能包含运行语义(skill, semanticKey = '') {
      return getSkillEffects(skill).some(effect => {
        const consumer = 读取战斗原型运行消费器(effect);
        if (semanticKey === '群体赋予') return LOCAL_BATTLE_GROUP_GRANTABLE_CONSUMERS.has(consumer);
        return 读取战斗效果运行语义(effect) === semanticKey;
      });
    }

    function skillTargetsFriendlySide(skill) {
      const 战斗目标类型 = inferSkillPrimaryTargetKind(skill);
      return ['自身', '友方单体', '友方群体', '全场'].includes(战斗目标类型);
    }

    function skillTargetsEnemySide(skill) {
      const 战斗目标类型 = inferSkillPrimaryTargetKind(skill);
      return ['敌方单体', '敌方群体', '全场'].includes(战斗目标类型);
    }

    function skillCanGrantFriendlyMechanism(skill) {
      return skillTargetsFriendlySide(skill) && 技能包含运行语义(skill, '可赋予');
    }

    function getSkillRuntimeConsumerKeys(skill) {
      return Array.from(
        new Set(
          getSkillEffects(skill)
            .flatMap(effect => {
              const direct = String(effect?.运行时消费器 || '').trim();
              return [direct, 读取战斗原型运行消费器(effect)];
            })
            .filter(Boolean),
        ),
      );
    }

    function hasBattleSkillRuntimeConsumer(skill, consumerKeys = []) {
      const targetKeys = Array.isArray(consumerKeys) ? consumerKeys : [consumerKeys];
      const keySet = new Set(
        targetKeys
          .map(key => String(key || '').trim())
          .filter(Boolean),
      );
      if (!(keySet.size > 0)) return false;
      return getSkillRuntimeConsumerKeys(skill).some(key => keySet.has(key));
    }

    function 技能具有保命倾向(skill, context = {}) {
      const summary = context.summary || deriveBattleSummaryFromEffects(skill);
      return (
        summary.防御性质 !== '无' ||
        summary.回复性质 === '复活机制' ||
        hasBattleSkillRuntimeConsumer(skill, [...BATTLE_DEFENSE_RUNTIME_CONSUMERS]) ||
        hasBattleSkillRuntimeConsumer(skill, ['recover_vit', 'cleanse', 'recover_over_time']) && skillTargetsFriendlySide(skill)
      );
    }

    function 技能具有团队保护倾向(skill, context = {}) {
      const summary = context.summary || deriveBattleSummaryFromEffects(skill);
      const 来源类别 = context.来源类别 || getBattleSkillSourceCategory(skill);
      const 友方目标 = skillTargetsFriendlySide(skill);
      return (
        skillCanGrantFriendlyMechanism(skill) ||
        summary.协同性 === '高' ||
        summary.回复性质 !== '无' && 友方目标 ||
        技能具有保命倾向(skill, { summary }) && 友方目标 ||
        hasBattleSkillRuntimeConsumer(skill, [
          'guard',
          'damage_share',
          'revive',
          'shield',
          'damage_reduce',
          'death_save',
          'invincible',
          'resource_refeed',
          'shared_vision',
        ]) && 友方目标 ||
        (来源类别 === '武魂融合技' && ['辅助', '防御'].includes(getSkillType(skill)))
      );
    }

    function 技能具有规则压制倾向(skill, context = {}) {
      const summary = context.summary || deriveBattleSummaryFromEffects(skill);
      const mainType = context.mainType || inferMainTypeFromEffects(skill);
      const damage = context.damage || getPrimaryDamageEffect(skill);
      return (
        ['伤害类', '控制类', '削弱类', '特殊规则类'].includes(mainType) ||
        summary.控制强度 !== '无' ||
        summary.爆发级别 !== '无' ||
        skillTargetsEnemySide(skill) && 技能包含运行语义(skill, '敌对') ||
        hasBattleSkillRuntimeConsumer(skill, [
          ...BATTLE_OUTPUT_RUNTIME_CONSUMERS,
          ...BATTLE_CONTROL_RUNTIME_CONSUMERS,
          'dot_detonate',
          'shield_break',
          'resource_drain',
          'resource_refeed',
          'mechanism_suppress',
          'copy',
          'ring_burst_gain',
          'time_rewind',
          'luck_interference',
          'misfortune_backlash',
          'element_seal',
          'power_amplify',
          'skill_effect_amplify',
          'heal_to_damage',
        ]) ||
        Number(damage?.威力倍率 || 0) > 0
      );
    }

    function getSkillSummaryHint(skill, key = '', fallback = '') {
      const normalizedKey = String(key || '').trim();
      if (!normalizedKey) return fallback;
      const entries = getSkillEffects(skill)
        .map(effect => getBattleEffectRuntimeMeta(effect))
        .filter(meta => meta && meta.摘要提示 && typeof meta.摘要提示 === 'object');
      for (const meta of entries) {
        const value = String(meta.摘要提示[normalizedKey] || '').trim();
        if (value) return value;
      }
      return fallback;
    }

    function isBattleSkillDefensiveProfile(skill, context = {}) {
      const skillType = context.skillType || getSkillType(skill);
      const mainType = context.mainType || inferMainTypeFromEffects(skill);
      const summary = context.summary || deriveBattleSummaryFromEffects(skill);
      const 来源类别 = context.来源类别 || getBattleSkillSourceCategory(skill);
      return (
        skillType === '防御' ||
        mainType === '防御类' ||
        summary.防御性质 !== '无' ||
        summary.回复性质 === '复活机制' ||
        技能具有保命倾向(skill, { summary }) ||
        技能具有团队保护倾向(skill, { summary, 来源类别 }) ||
        (来源类别 === '武魂融合技' && ['防御', '辅助'].includes(skillType))
      );
    }

    function isBattleSkillOffensiveProfile(skill, context = {}) {
      const skillType = context.skillType || getSkillType(skill);
      const mainType = context.mainType || inferMainTypeFromEffects(skill);
      const summary = context.summary || deriveBattleSummaryFromEffects(skill);
      return (
        skillType === '输出' ||
        mainType === '伤害类' ||
        summary.爆发级别 !== '无' ||
        Number(getPrimaryDamageEffect(skill)?.威力倍率 || 0) > 0
      );
    }

    function isBattleSkillControlProfile(skill, context = {}) {
      const mainType = context.mainType || inferMainTypeFromEffects(skill);
      const calc = context.calc || getPrimaryStateCalc(skill);
      const flags = context.flags || getPrimaryStateFlags(skill);
      const summary = context.summary || deriveBattleSummaryFromEffects(skill);
      return (
        mainType === '控制类' ||
        mainType === '削弱类' ||
        技能具有规则压制倾向(skill, { summary, mainType }) ||
        summary.控制强度 === '硬控' ||
        summary.控制强度 === '软控' ||
        Number(calc.lock_level || 0) > 0 ||
        Number(calc.reaction_penalty || 0) > 0 ||
        Number(calc.cast_speed_penalty || 0) > 0 ||
        Number(calc.dodge_penalty || 0) > 0 ||
        技能包含资源锁定原型(skill) ||
        flags.includes('硬控')
      );
    }

    function isBattleSkillTeamSupportProfile(skill, context = {}) {
      const skillType = context.skillType || getSkillType(skill);
      const summary = context.summary || deriveBattleSummaryFromEffects(skill);
      const 来源类别 = context.来源类别 || getBattleSkillSourceCategory(skill);
      return (
        skillCanGrantFriendlyMechanism(skill) ||
        summary.协同性 === '高' ||
        summary.回复性质 !== '无' ||
        技能具有团队保护倾向(skill, { summary, 来源类别 }) ||
        (来源类别 === '武魂融合技' && ['辅助', '防御'].includes(skillType))
      );
    }

    function 是团队保护技能(skill, context = {}) {
      const summary = context.summary || deriveBattleSummaryFromEffects(skill);
      const 战斗目标类型 = inferSkillPrimaryTargetKind(skill);
      const 防御性质 = String(summary.防御性质 || '无');
      const 友方目标 = ['友方单体', '友方群体', '全场'].includes(战斗目标类型);
      const 团队防御性质 = ['护盾', '减伤', '免伤', '免死', '无敌', '分摊', '护卫'].includes(防御性质);
      return (
        (友方目标 && 团队防御性质) ||
        (友方目标 && 技能具有团队保护倾向(skill, { summary })) ||
        (友方目标 && hasBattleSkillRuntimeConsumer(skill, ['guard', 'damage_share', 'shield', 'damage_reduce', 'death_save', 'invincible']))
      );
    }

    function isBattleSkillAntiHealProfile(skill, context = {}) {
      const summary = context.summary || deriveBattleSummaryFromEffects(skill);
      const calc = context.calc || getPrimaryStateCalc(skill);
      return (
        hasBattleSkillRuntimeConsumer(skill, ['anti_heal', 'heal_inversion']) ||
        summary.控制强度 === '软控' && Number(calc.heal_block_ratio || 0) > 0 ||
        Number(calc.heal_inversion_ratio || 0) > 0
      );
    }

    function isBattleSkillExecuteProfile(skill, context = {}) {
      const summary = context.summary || deriveBattleSummaryFromEffects(skill);
      const damage = context.damage || getPrimaryDamageEffect(skill);
      return (
        hasBattleSkillRuntimeConsumer(skill, ['judge_effect']) ||
        (summary.爆发级别 === '高' && Number(damage?.威力倍率 || 0) >= 180)
      );
    }

    function isBattleSkillShieldBreakProfile(skill, context = {}) {
      const damage = context.damage || getPrimaryDamageEffect(skill);
      return (
        hasBattleSkillRuntimeConsumer(skill, ['shield_break']) ||
        Number(damage?.防御穿透 || 0) >= 15 ||
        /破甲|穿透|粉碎|斩盾/.test(String(skill?.name || ''))
      );
    }

    function isBattleSkillDotDetonateProfile(skill) {
      return hasBattleSkillRuntimeConsumer(skill, ['dot_detonate']);
    }

    function isBattleSkillSealProfile(skill, context = {}) {
      const calc = context.calc || getPrimaryStateCalc(skill);
      return hasBattleSkillRuntimeConsumer(skill, ['skill_seal']) || calc.skill_seal === true;
    }

    function isBattleSkillTransferProfile(skill) {
      return hasBattleSkillRuntimeConsumer(skill, ['status_transfer']);
    }

    function isBattleSkillSharedVisionProfile(skill) {
      return hasBattleSkillRuntimeConsumer(skill, ['shared_vision']);
    }

    function isBattleSkillHealInvertProfile(skill, context = {}) {
      const calc = context.calc || getPrimaryStateCalc(skill);
      return hasBattleSkillRuntimeConsumer(skill, ['heal_inversion']) || Number(calc.heal_inversion_ratio || 0) > 0;
    }

    function 判定技能具备真实截断资格_V1(skill = {}) {
      if (!skill || typeof skill !== 'object') return false;
      return hasBattleSkillRuntimeConsumer(skill, ['interrupt']);
    }

    function isBattleSkillDotPressureProfile(skill) {
      return hasBattleSkillRuntimeConsumer(skill, ['dot_damage']);
    }

    function isBattleSkillRevealProfile(skill) {
      return hasBattleSkillRuntimeConsumer(skill, ['reveal']);
    }

    function isBattleSkillBuffStealProfile(skill) {
      return hasBattleSkillRuntimeConsumer(skill, ['steal_buff']);
    }

    function isBattleSkillTauntProfile(skill) {
      return hasBattleSkillRuntimeConsumer(skill, ['taunt']);
    }

    function isBattleSkillResourceDrainProfile(skill) {
      return hasBattleSkillRuntimeConsumer(skill, ['resource_drain']);
    }

    function isBattleSkillResourceRefeedProfile(skill) {
      return hasBattleSkillRuntimeConsumer(skill, ['resource_refeed']);
    }

    function 读取战斗抹消对象战术标签(对象 = {}) {
      const 匹配器 = 规范化战斗机制抹消对象(对象);
      const 标签 = new Set([读取战斗机制抹消对象摘要(匹配器)]);
      if (匹配器.原型 === '护盾变化') 标签.add('护盾').add('防御机制');
      if (匹配器.原型 === '规则防御') {
        标签.add('防御机制');
        if (/复活|免死|回溯/.test(String(匹配器.规则 || ''))) 标签.add('复活机制').add('回复机制');
      }
      if (匹配器.原型 === '资源变化') 标签.add('回复机制');
      if (匹配器.原型 === '状态施加') {
        collectBattleMechanismTagsFromDescriptor(匹配器.状态 || 匹配器.状态名称 || '', 匹配器).forEach(item => 标签.add(item));
      }
      if (匹配器.原型 === '机制授予' || 匹配器.原型 === '机制抹消') 标签.add('特殊规则');
      return Array.from(标签).filter(Boolean);
    }

    function 读取战斗技能抹消战术标签(skill) {
      const effect =
        getSkillEffects(skill).find(item => item?.原型 === '机制抹消') ||
        null;
      return effect?.抹消对象 ? 读取战斗抹消对象战术标签(effect.抹消对象) : [];
    }

    function isBattleSkillMechanismSuppressProfile(skill) {
      return hasBattleSkillRuntimeConsumer(skill, ['mechanism_suppress']);
    }

    function isBattleSkillReactiveDefenseProfile(skill, context = {}) {
      const summary = context.summary || deriveBattleSummaryFromEffects(skill);
      return (
        isBattleSkillDefensiveProfile(skill, context) ||
        技能具有保命倾向(skill, { summary }) ||
        ['护盾', '减伤', '免伤', '霸体', '免死', '无敌', '分摊', '反射', '护卫'].includes(summary.防御性质)
      );
    }

    function findBattleSkillEffect(skill, matcher) {
      if (typeof matcher !== 'function') return null;
      return getSkillEffects(skill).find(effect => matcher(effect)) || null;
    }

    function isBattleRecoverEffect(effect, properties = []) {
      const resourcePropertyMap = { 生命: 'hp', 体力: 'vit', 魂力: 'sp', 精神力: 'men' };
      const 原始属性列表 = Array.isArray(effect?.属性) ? effect.属性 : [effect?.属性];
      const 原始资源列表 = Array.isArray(effect?.资源) ? effect.资源 : [effect?.资源];
      const 属性列表 = [
        ...原始属性列表.map(item => String(item || '').trim()),
        ...原始资源列表.map(item => resourcePropertyMap[String(item || '').trim()] || ''),
      ].filter(Boolean);
      const allowAll = !Array.isArray(properties) || properties.length === 0;
      const propertyMatched = allowAll || 属性列表.some(property => properties.includes(property));
      if (!propertyMatched) return false;
      if (String(effect?.原型 || '').trim() === '资源变化') return 读取战斗数值正负(effect?.数值) > 0 && 属性列表.some(property => ['hp', 'vit', 'sp', 'men'].includes(property));
      const mechanism = String(effect?.原型 || '').trim();
      if (mechanism === '持续恢复') return 属性列表.some(property => ['vit', 'sp', 'men'].includes(property));
      return (
        mechanism === '属性变化' &&
        String(effect?.动作 || '').trim() === '加值' &&
        属性列表.some(property => ['vit', 'sp', 'men'].includes(property))
      );
    }

    function isBattleAttributeSupportEffect(effect) {
      return ['属性修正', '判定修正', '结算修正', '护盾变化', '规则防御', '状态施加', '资源变化', '资源转移'].includes(String(effect?.原型 || '').trim());
    }

    function isBattleDebuffAttributeEffect(effect) {
      const prototype = String(effect?.原型 || '').trim();
      if (['属性修正', '判定修正', '结算修正', '资源变化', '资源转移', '护盾变化'].includes(prototype)) return 读取战斗数值正负(effect?.数值) < 0;
      return false;
    }

    function normalizeSkillTypeLabel(raw) {
      const text = String(raw || '无');
      if (!text || text === '无') return '无';
      if (/输出|伤害|爆发|破甲|斩杀/.test(text)) return '输出';
      if (/控制|削弱|打断|沉默|禁疗|减速|软控|位移限制|锁定|束缚|缴械|驱散|干扰|扭曲|嘲讽|破隐|封技|治疗反转/.test(text)) return '控制';
      if (/防御|护盾|免伤|霸体|免死|反制|无敌|分摊|反射/.test(text)) return '防御';
      if (/位移|机动|追击|脱离|隐身|护卫/.test(text)) return '辅助';
      if (/辅助|增益|回复|治疗/.test(text)) return '辅助';
      return text.split(/[\/|｜]/)[0] || text;
    }

    function inferSkillTypeFromEffects(skill) {
      const fromSystem = normalizeSkillTypeLabel(skill?.技能分类);
      if (fromSystem !== '无') return fromSystem;
      const summarySkillType = getSkillSummaryHint(skill, 'skillType', '');
      if (summarySkillType) return normalizeSkillTypeLabel(summarySkillType);
      if (hasBattleSkillRuntimeConsumer(skill, [...BATTLE_CONTROL_RUNTIME_CONSUMERS]) || getSkillEffects(skill).some(effect => isBattleDebuffAttributeEffect(effect)))
        return '控制';
      if (hasBattleSkillRuntimeConsumer(skill, [...BATTLE_DEFENSE_RUNTIME_CONSUMERS])) return '防御';
      if (
        skillCanGrantFriendlyMechanism(skill) ||
        hasBattleSkillRuntimeConsumer(skill, [...BATTLE_SUPPORT_RUNTIME_CONSUMERS, ...BATTLE_SPECIAL_RULE_RUNTIME_CONSUMERS]) ||
        getSkillEffects(skill).some(effect => isBattleAttributeSupportEffect(effect))
      )
        return '辅助';
      if (hasBattleSkillRuntimeConsumer(skill, [...BATTLE_OUTPUT_RUNTIME_CONSUMERS]) || Number(getPrimaryDamageEffect(skill)?.威力倍率 || 0) > 0)
        return '输出';
      if (skillTargetsEnemySide(skill) && 技能包含运行语义(skill, '敌对')) return '控制';
      return '无';
    }

    function inferMainTypeFromEffects(skill) {
      const hintedMainType = getSkillSummaryHint(skill, 'mainType', '');
      if (hintedMainType) return hintedMainType;
      if (hasBattleSkillRuntimeConsumer(skill, [...BATTLE_MOBILITY_RUNTIME_CONSUMERS])) return '位移类';
      if (hasBattleSkillRuntimeConsumer(skill, [...BATTLE_SPECIAL_RULE_RUNTIME_CONSUMERS])) return '特殊规则类';
      if (
        hasBattleSkillRuntimeConsumer(skill, [...BATTLE_CONTROL_RUNTIME_CONSUMERS]) ||
        getSkillEffects(skill).some(effect => isBattleDebuffAttributeEffect(effect))
      )
        return '控制类';
      if (hasBattleSkillRuntimeConsumer(skill, [...BATTLE_DEFENSE_RUNTIME_CONSUMERS])) return '防御类';
      if (getSkillEffects(skill).some(effect => isBattleRecoverEffect(effect))) return '回复类';
      if (
        skillCanGrantFriendlyMechanism(skill) ||
        hasBattleSkillRuntimeConsumer(skill, [...BATTLE_SUPPORT_RUNTIME_CONSUMERS]) ||
        getSkillEffects(skill).some(effect => isBattleAttributeSupportEffect(effect))
      )
        return '增益类';
      if (hasBattleSkillRuntimeConsumer(skill, [...BATTLE_OUTPUT_RUNTIME_CONSUMERS]) || Number(getPrimaryDamageEffect(skill)?.威力倍率 || 0) > 0)
        return '伤害类';
      if (skillTargetsEnemySide(skill) && 技能包含运行语义(skill, '敌对')) return '控制类';
      return '无';
    }

    function deriveBattleSummaryFromEffects(skill, baseSummary = {}) {
      const defaultSummary = createEmptyBattleSummary();
      const summary = { ...defaultSummary, ...(baseSummary || {}) };
      const runtimeMeta = getSkillRuntimeMeta(skill);
      const 来源类别 = getBattleSkillSourceCategory(skill);
      const damage = getPrimaryDamageEffect(skill);
      const state = getPrimaryStateEffect(skill);
      const stateCalc = state?.计算层效果 || {};
      const targetText = String(runtimeMeta.对象 || '');
      const power = Number(damage?.威力倍率 || 0);
      const duration = Number(state?.持续回合 || 0);
      const skillName = String(skill?.name || skill?.技能名称 || '');
      const costText = String(getSkillCostText(skill) || '无');
      const attributeSource = getBattleSkillAttributeSource(skill);
      const skillRole = getBattleSkillRole(skill);
      const elementMode = String(getBattleSkillElementStructure(skill)?.模式 || '').trim() || '无';
      const wuxingMode = String(getBattleSkillWuxingInvocation(skill)?.模式 || '').trim() || '无';
      const polarityMode = String(getBattleSkillPolaritySummary(skill)?.polarityMode || '无').trim() || '无';
      const structureMode = elementMode !== '无' ? elementMode : wuxingMode;

      if (!baseSummary?.属性建模 || baseSummary.属性建模 === defaultSummary.属性建模 || baseSummary.属性建模 === '无') {
        const modelSegments = [attributeSource, skillRole, structureMode].filter(value => value && value !== '无');
        summary.属性建模 = modelSegments.length ? modelSegments.join('/') : '无';
      }
      if (!baseSummary?.极性层级 || baseSummary.极性层级 === defaultSummary.极性层级 || baseSummary.极性层级 === '无') {
        summary.极性层级 = polarityMode && polarityMode !== '无' ? polarityMode : '无';
      }
      if (
        (!baseSummary?.风险等级 || baseSummary.风险等级 === defaultSummary.风险等级 || baseSummary.风险等级 === '中') &&
        (structureMode === '逆演归一' ||
          structureMode === '阴阳合璧' ||
          (structureMode === '元素硬控' && normalizeBattleSkillAttributeTokens(skill?.附带属性).length >= 3))
      )
        summary.风险等级 = '高';
      if (来源类别 === '武魂融合技') summary.风险等级 = '高';
      else if (来源类别 === '自创魂技' && ['逆演归一', '阴阳合璧', '元素硬控'].includes(structureMode))
        summary.风险等级 = '高';

      if (!baseSummary?.目标规模 || baseSummary.目标规模 === defaultSummary.目标规模) {
        if (targetText === '全场') summary.目标规模 = '全场';
        else if (targetText.includes('群体')) summary.目标规模 = '群体';
        else summary.目标规模 = '单体';
      }

      const hasFriendlyGrantable = skillCanGrantFriendlyMechanism(skill);
      const hintedDefenseNature = getSkillSummaryHint(skill, 'defenseNature', '');
      const hintedRecoverNature = getSkillSummaryHint(skill, 'recoverNature', '');
      const hintedControlStrength = getSkillSummaryHint(skill, 'controlStrength', '');
      const hintedCooperation = getSkillSummaryHint(skill, 'cooperation', '');
      const hintedEffectMode = getSkillSummaryHint(skill, 'effectMode', '');

      if (!summary.防御性质 || summary.防御性质 === '无') {
        if (hintedDefenseNature) summary.防御性质 = hintedDefenseNature;
        else if (hasBattleSkillRuntimeConsumer(skill, ['counter', 'on_hit_counter'])) summary.防御性质 = '反制';
        else if (hasBattleSkillRuntimeConsumer(skill, ['death_save'])) summary.防御性质 = '免死';
        else if (hasBattleSkillRuntimeConsumer(skill, ['invincible'])) summary.防御性质 = '无敌';
        else if (hasBattleSkillRuntimeConsumer(skill, ['damage_share'])) summary.防御性质 = '分摊';
        else if (hasBattleSkillRuntimeConsumer(skill, ['cost_share'])) summary.防御性质 = '分摊';
        else if (hasBattleSkillRuntimeConsumer(skill, ['damage_transfer'])) summary.防御性质 = '反射';
        else if (hasBattleSkillRuntimeConsumer(skill, ['damage_reflect'])) summary.防御性质 = '反射';
        else if (hasBattleSkillRuntimeConsumer(skill, ['super_armor'])) summary.防御性质 = '霸体';
        else if (hasBattleSkillRuntimeConsumer(skill, ['guard'])) summary.防御性质 = '护卫';
        else if (hasBattleSkillRuntimeConsumer(skill, ['clone', 'stealth'])) summary.防御性质 = '分身';
        else if (hasBattleSkillRuntimeConsumer(skill, ['block'])) summary.防御性质 = '免伤';
        else if (hasBattleSkillRuntimeConsumer(skill, ['damage_reduce'])) summary.防御性质 = '减伤';
        else if (hasBattleSkillRuntimeConsumer(skill, ['shield'])) summary.防御性质 = '护盾';
      }
      if (!summary.回复性质 || summary.回复性质 === '无') {
        if (hintedRecoverNature) summary.回复性质 = hintedRecoverNature;
        else if (getSkillEffects(skill).some(effect => isBattleRecoverEffect(effect, ['vit'])))
          summary.回复性质 = '体力恢复';
        else if (getSkillEffects(skill).some(effect => isBattleRecoverEffect(effect, ['sp', 'men'])))
          summary.回复性质 = '资源回复';
      }
      if (!summary.控制强度 || summary.控制强度 === '无') {
        if (hintedControlStrength) summary.控制强度 = hintedControlStrength;
        else if (hasBattleSkillRuntimeConsumer(skill, ['hard_control']) || stateCalc.skip_turn === true) summary.控制强度 = '硬控';
        else if (
          isBattleSkillControlProfile(skill, { calc: stateCalc, summary }) ||
          getSkillEffects(skill).some(effect => isBattleDebuffAttributeEffect(effect)) ||
          hasBattleSkillRuntimeConsumer(skill, ['soft_control', 'position_lock', 'interrupt', 'skill_seal', 'anti_heal', 'heal_inversion'])
        )
          summary.控制强度 = '软控';
      }
      if (!baseSummary?.协同性 || baseSummary.协同性 === defaultSummary.协同性 || baseSummary.协同性 === '无') {
        if (hintedCooperation) summary.协同性 = hintedCooperation;
        else if (
          targetText === '全场' ||
          targetText.includes('群体') ||
          isBattleSkillSharedVisionProfile(skill) ||
          hasBattleSkillRuntimeConsumer(skill, ['target_lock', 'dispel_buff']) ||
          (hasFriendlyGrantable && summary.目标规模 !== '单体')
        )
          summary.协同性 = '高';
        else if (
          targetText.includes('己方') ||
          targetText.includes('友方') ||
          hasFriendlyGrantable ||
          getSkillEffects(skill).some(effect => isBattleRecoverEffect(effect)) ||
          ['分身', '护卫'].includes(summary.防御性质) ||
          hasBattleSkillRuntimeConsumer(skill, ['stealth'])
        )
          summary.协同性 = '中';
        else summary.协同性 = '低';
      }
      if (来源类别 === '武魂融合技' && summary.协同性 === '低') summary.协同性 = '高';
      if (!baseSummary?.生效方式 || baseSummary.生效方式 === defaultSummary.生效方式 || baseSummary.生效方式 === '无') {
        if (hintedEffectMode) summary.生效方式 = hintedEffectMode;
        else if (hasBattleSkillRuntimeConsumer(skill, [...BATTLE_TRIGGER_RUNTIME_CONSUMERS])) summary.生效方式 = '触发';
        else if (getSkillEffects(skill).some(effect => String(effect?.原型 || '').trim() === '状态施加' && Number(effect?.延迟回合 || 0) > 0)) summary.生效方式 = '延迟';
        else if (
          duration > 1 ||
          hasBattleSkillRuntimeConsumer(skill, [...BATTLE_SUSTAIN_RUNTIME_CONSUMERS])
        )
          summary.生效方式 = '持续';
        else summary.生效方式 = '瞬发';
      }
      if (!baseSummary?.爆发级别 || baseSummary.爆发级别 === defaultSummary.爆发级别 || baseSummary.爆发级别 === '无') {
        if (power >= 300) summary.爆发级别 = '高';
        else if (power >= 160) summary.爆发级别 = '中';
        else if (power > 0) summary.爆发级别 = '低';
        else summary.爆发级别 = '无';
      }
      if (!baseSummary?.持续性 || baseSummary.持续性 === defaultSummary.持续性 || baseSummary.持续性 === '无') {
        if (duration >= 3) summary.持续性 = '长';
        else if (duration >= 2) summary.持续性 = '中';
        else if (duration > 0) summary.持续性 = '短';
        else if (hasBattleSkillRuntimeConsumer(skill, [...BATTLE_SUSTAIN_RUNTIME_CONSUMERS]))
          summary.持续性 = '中';
        else summary.持续性 = '无';
      }
      if (!baseSummary?.保留倾向 || Number(baseSummary.保留倾向 || 0) === Number(defaultSummary.保留倾向 || 0)) {
        let reserve = 0;
        if (/真身|武魂融合技|生命之火|第八魂技|第九魂技/.test(skillName)) reserve += 35;
        if (power >= 280) reserve += 20;
        if (Number(runtimeMeta.cast_time || 0) >= 25) reserve += 15;
        if (
          hasBattleSkillRuntimeConsumer(skill, ['death_save', 'block', 'counter', 'on_hit_counter', 'self_random_variance']) ||
          summary.生效方式 === '触发'
        )
          reserve += 10;
        if (/维持|启动\)/.test(costText)) reserve += 10;
        summary.保留倾向 = Math.min(90, reserve);
      }
      if (来源类别 === '武魂融合技') summary.保留倾向 = Math.max(summary.保留倾向, 75);
      else if (来源类别 === '自创魂技') summary.保留倾向 = Math.max(summary.保留倾向, 28);
      return summary;
    }

    function buildConditionTacticalSnapshot(entity) {
      const entries = Object.entries(entity?.状态效果 || {});
      const buffEntries = entries.filter(([, cond]) => cond?.类型 === 'buff');
      const debuffEntries = entries.filter(([, cond]) => cond?.类型 === 'debuff');
      const hasShielded = entries.some(
        ([name, cond]) => /护盾|屏障|结界/.test(name) || Number(cond?.战斗效果?.shield_gain_mult || 1) > 1.05,
      );
      const hasDefenseBuffed = entries.some(
        ([name, cond]) => Number(cond?.面板修改比例?.def || 1) > 1.12 || /护体|罡气|霸体|真身|免伤|减伤/.test(name),
      );
      const isLockedOrControlled = entries.some(([name, cond]) => {
        const ce = cond?.战斗效果 || {};
        return (
          ce.skip_turn === true ||
          ce.cannot_react === true ||
          Number(ce.lock_level || 0) > 0 ||
          Number(ce.reaction_penalty || 0) > 0 ||
          Number(ce.cast_speed_penalty || 0) > 0 ||
          Number(ce.dodge_penalty || 0) > 0 ||
          读取状态资源锁定强度(cond) > 0 ||
          /锁定|禁锢|眩晕|催眠|幻境|束缚|减速|迟缓|软控|位移限制|强制位移|位移交换/.test(name)
        );
      });
      const hasHealingTrend = entries.some(
        ([name, cond]) =>
          Number(cond?.战斗效果?.final_heal_mult || 1) > 1.0 ||
          Number(cond?.战斗效果?.final_heal_bonus || 0) > 0 ||
          Number(cond?.战斗效果?.vit_gain_ratio || 0) > 0 ||
          Number(cond?.战斗效果?.sp_gain_ratio || 0) > 0 ||
          Number(cond?.战斗效果?.men_gain_ratio || 0) > 0 ||
          /回血|治疗|再生|回复|回魂|回精神/.test(name),
      );
      const hasDotPressure = entries.some(([, cond]) => 战斗效果含结构化持续伤害(cond));
      const hasBadCondition = entries.some(
        ([name, cond]) => cond?.类型 === 'debuff' && !/霸体|真身|增益|护盾/.test(name),
      );
      const hasSharedVision = entries.some(([name]) => /共享视野/.test(name));
      const hasTargetLock = entries.some(
        ([name, cond]) => /目标锁定|标记锁定/.test(name) || Number(cond?.战斗效果?.lock_level || 0) > 0,
      );
      const movementLockLevel = entries.reduce(
        (最大强度, [name, cond]) => /位移限制|束缚|禁锢|定身/.test(name)
          ? Math.max(最大强度, Number(cond?.战斗效果?.lock_level || 1))
          : 最大强度,
        0,
      );
      const hasStealthed = entries.some(
        ([name, cond]) =>
          Number(cond?.战斗效果?.stealth_level || 0) > 0 || /隐身|潜行/.test(String(name || '')),
      );
      const 有探查屏蔽 = entries.some(
        ([name, cond]) =>
          cond?.战斗效果?.探查屏蔽 === true || /探查屏蔽|感知屏蔽|精神屏蔽/.test(String(name || '')),
      );
      const hasReactiveDefense = entries.some(
        ([name, cond]) =>
          cond?.战斗效果?.invincible === true ||
          cond?.战斗效果?.super_armor === true ||
          Number(cond?.战斗效果?.block_count || 0) > 0 ||
          Number(cond?.战斗效果?.death_save_count || 0) > 0 ||
          Number(cond?.战斗效果?.revive_count || 0) > 0 ||
          Number(cond?.战斗效果?.counter_attack_ratio || 0) > 0 ||
          Number(cond?.战斗效果?.damage_reflect_ratio || 0) > 0 ||
          Number(cond?.战斗效果?.damage_transfer_ratio || 0) > 0 ||
          Number(cond?.战斗效果?.damage_share_ratio || 0) > 0 ||
          Number(cond?.战斗效果?.damage_reduction || 0) > 0 ||
          /护盾|免伤|霸体|免死|反击|反制|无敌|分摊|反射|转移/.test(name),
      );
      const hasAntiHeal = entries.some(
        ([name, cond]) =>
          Number(cond?.战斗效果?.heal_block_ratio || 0) > 0 ||
          Number(cond?.战斗效果?.heal_inversion_ratio || 0) > 0 ||
          /禁疗|治疗反转/.test(name),
      );
      const suppressionEntries = getActiveMechanismSuppressionEntries(entity);
      return {
        entries,
        buffCount: buffEntries.length,
        debuffCount: debuffEntries.length,
        hasShielded,
        hasDefenseBuffed,
        isLockedOrControlled,
        hasHealingTrend,
        hasDotPressure,
        hasBadCondition,
        hasSharedVision,
        hasTargetLock,
        hasStealthed,
        有探查屏蔽,
        hasReactiveDefense,
        hasAntiHeal,
        hasMechanismSuppression: suppressionEntries.length > 0,
        suppressedMechanisms: Array.from(new Set(suppressionEntries.flatMap(entry => entry.tags))),
        movementLockLevel,
      };
    }

    function getForcedTauntTargetName(actorChar) {
      if (!actorChar?.状态效果) return '';
      const tauntEntry = Object.values(actorChar.状态效果).find(cond =>
        cond &&
        typeof cond === 'object' &&
        String(cond?.类型 || '') === 'debuff' &&
        String(cond?.强制目标名 || '').trim(),
      );
      return String(tauntEntry?.强制目标名 || '').trim();
    }

    function canBypassStealth(attackerChar, skill = null, 目标角色 = null) {
      if (目标角色 && buildConditionTacticalSnapshot(目标角色).有探查屏蔽) return false;
      const attackerSnapshot = buildConditionTacticalSnapshot(attackerChar);
      return (
        attackerSnapshot.hasSharedVision ||
        attackerSnapshot.hasTargetLock ||
        hasBattleSkillRuntimeConsumer(skill, ['shared_vision', 'target_lock'])
      );
    }

    function 读取隐匿识破率(观察者 = {}, 隐匿者 = {}) {
      const 观察者属性 = 观察者?.final || BATTLE_RUNTIME.buildCombatFinalStats(观察者);
      const 隐匿者属性 = 隐匿者?.final || BATTLE_RUNTIME.buildCombatFinalStats(隐匿者);
      const 观察者精神力 = Math.max(
        0,
        Number(读取战斗资源当前值(观察者, 观察者属性, 'men') || 观察者属性?.men || 观察者属性?.men_max || 0),
      );
      const 隐匿者精神力 = Math.max(
        1,
        Number(读取战斗资源当前值(隐匿者, 隐匿者属性, 'men') || 隐匿者属性?.men || 隐匿者属性?.men_max || 1),
      );
      return Math.max(0, Math.min(1, 观察者精神力 / 隐匿者精神力 - 1.5));
    }

    function 可以锁定隐匿目标(观察者 = {}, 目标 = {}, skill = null) {
      const 目标快照 = buildConditionTacticalSnapshot(目标);
      if (目标快照.有探查屏蔽) return !目标快照.hasStealthed;
      if (!目标快照.hasStealthed) return true;
      if (canBypassStealth(观察者, skill, 目标)) return true;
      const 识破率 = 读取隐匿识破率(观察者, 目标);
      return BATTLE_RUNTIME.probabilitySucceeds(识破率);
    }

    function 探查屏蔽阻断敌对锁定状态(目标 = {}, 状态模块 = {}) {
      if (!buildConditionTacticalSnapshot(目标).有探查屏蔽) return false;
      const 名称 = String(
        状态模块?.状态名称 ||
          状态模块?.状态 ||
          状态模块?.特殊机制标识 ||
          状态模块?.运行机制 ||
          状态模块?.运行时消费器 ||
          '',
      ).trim();
      const 计算层效果 = 状态模块?.计算层效果 || 状态模块?.战斗效果 || {};
      if (/^(标记)$|目标锁定|标记锁定|感知干扰|精神标记|精神探查|探查|锁定/.test(名称)) return true;
      return Number(计算层效果.lock_level || 0) > 0 && !/位移限制|束缚|禁锢|定身/.test(名称);
    }

    function resolveGuardRedirectTarget(initialTarget, allyTeam = []) {
      if (!initialTarget?.状态效果) return null;
      const 护卫状态列表 = Object.entries(initialTarget.状态效果).filter(([, cond]) =>
        cond &&
        typeof cond === 'object' &&
        String(cond?.类型 || '') === 'buff' &&
        String(cond?.护卫者名 || '').trim(),
      );
      for (const [状态名, 护卫状态] of 护卫状态列表) {
        const 护卫者名 = String(护卫状态?.护卫者名 || '').trim();
        const 剩余次数 = 护卫状态?.护卫剩余次数 === undefined ? Infinity : Number(护卫状态.护卫剩余次数 || 0);
        if (!护卫者名 || !(剩余次数 > 0)) continue;
        const 护卫者 = (allyTeam || []).find(
          unit =>
            unit &&
            unit.name !== initialTarget.name &&
            isCombatUnitAbleToFight(unit) &&
            isCombatUnitIdentityMatch(unit, 护卫者名),
        );
        if (!护卫者) continue;
        if (Number.isFinite(剩余次数)) {
          护卫状态.护卫剩余次数 = Math.max(0, 剩余次数 - 1);
          if (护卫状态.护卫剩余次数 <= 0 && /普防护援/.test(状态名)) delete initialTarget.状态效果[状态名];
        }
        return 护卫者;
      }
      return null;
    }

    function bindCombatMirrorField(target, source, key, options = {}) {
      if (!target || !source) return;
      if (options.preferSource && source[key] !== undefined) target[key] = source[key];
      else if (target[key] !== undefined) source[key] = target[key];
      else if (source[key] !== undefined) target[key] = source[key];

      try {
        Object.defineProperty(target, key, {
          configurable: true,
          enumerable: true,
          get() {
            return source[key];
          },
          set(value) {
            source[key] = value;
          },
        });
      } catch (e) {
        target[key] = source[key];
      }
    }

    function bindCombatAliasField(target, source, aliasKey, sourceKey, fallbackValue = 0) {
      if (!target || !source || !aliasKey || !sourceKey) return;
      if (source[sourceKey] === undefined) source[sourceKey] = fallbackValue;
      try {
        Object.defineProperty(target, aliasKey, {
          configurable: true,
          enumerable: true,
          get() {
            return source[sourceKey];
          },
          set(value) {
            source[sourceKey] = value;
          },
        });
      } catch (error) {
        target[aliasKey] = source[sourceKey];
      }
    }

    function normalizeCombatHpFields(source) {
      if (!source || typeof source !== 'object') return;
      source.HP上限 = Math.max(1, Number.isFinite(Number(source.HP上限)) ? Number(source.HP上限) : 1);
      source.HP = Math.max(
        0,
        Math.min(
          source.HP上限,
          Number.isFinite(Number(source.HP)) ? Number(source.HP) : source.HP上限,
        ),
      );
      source.体力上限 = Math.max(1, Number.isFinite(Number(source.体力上限)) ? Number(source.体力上限) : 1);
      source.体力 = Math.max(0, Math.min(source.体力上限, Number.isFinite(Number(source.体力)) ? Number(source.体力) : source.体力上限));
    }

    function bindCombatHpAliasField(target, source) {
      if (!target || !source) return;
      normalizeCombatHpFields(source);
      try {
        Object.defineProperty(target, 'hp', {
          configurable: true,
          enumerable: true,
          get() {
            return source.HP;
          },
          set(value) {
            source.HP = Math.max(0, Math.min(Number(source.HP上限 || 1), Number(value || 0)));
          },
        });
        Object.defineProperty(target, 'hp_max', {
          configurable: true,
          enumerable: true,
          get() {
            return source.HP上限;
          },
          set(value) {
            source.HP上限 = Math.max(1, Number(value || 1));
            source.HP = Math.max(0, Math.min(source.HP上限, Number(source.HP || 0)));
          },
        });
        Object.defineProperty(target, 'vit', {
          configurable: true,
          enumerable: true,
          get() {
            return source.体力;
          },
          set(value) {
            source.体力 = Math.max(0, Math.min(Number(source.体力上限 || 1), Number(value || 0)));
          },
        });
        Object.defineProperty(target, 'vit_max', {
          configurable: true,
          enumerable: true,
          get() {
            return source.体力上限;
          },
          set(value) {
            source.体力上限 = Math.max(1, Number(value || 1));
            source.体力 = Math.max(0, Math.min(source.体力上限, Number(source.体力 || 0)));
          },
        });
      } catch (error) {
        target.hp = source.HP;
        target.hp_max = source.HP上限;
        target.vit = source.体力;
        target.vit_max = source.体力上限;
      }
    }

    function bindCombatRuntimeAliases(target, source) {
      if (!target || !source) return;
      bindCombatAliasField(target, source, 'str', '力量', 0);
      bindCombatAliasField(target, source, 'def', '防御', 0);
      bindCombatAliasField(target, source, 'agi', '敏捷', 0);
      bindCombatAliasField(target, source, 'sp', '魂力', 0);
      bindCombatAliasField(target, source, 'sp_max', '魂力上限', 1);
      bindCombatAliasField(target, source, 'men', '精神力', 0);
      bindCombatAliasField(target, source, 'men_max', '精神力上限', 1);
      bindCombatAliasField(target, source, 'sta', '体力', 0);
      bindCombatAliasField(target, source, 'sta_max', '体力上限', 1);
      bindCombatHpAliasField(target, source);
    }

    function expandCombatParticipantFromMvu(participant) {
      if (!participant || typeof participant !== 'object' || Array.isArray(participant)) return participant;
      if (isTemporaryCombatParticipant(participant)) return participant;
      if (participant.属性 && typeof participant.属性 === 'object' && participant.状态 && typeof participant.状态 === 'object') {
        return participant;
      }

      const participantName = String(participant.name || '').trim();
      if (!participantName) return participant;
      const currentCharData = getMvuValue(`char.${participantName}`, undefined);
      if (!currentCharData || typeof currentCharData !== 'object') return participant;

      const expanded = cloneBattleValue(currentCharData);
      expanded.name = participantName;

      if (!expanded.属性 || typeof expanded.属性 !== 'object') expanded.属性 = {};
      if (!expanded.状态 || typeof expanded.状态 !== 'object') expanded.状态 = {};

      COMBAT_STAT_KEYS.forEach(key => {
        if (participant[key] !== undefined) expanded.属性[key] = cloneBattleValue(participant[key]);
      });
      COMBAT_STATUS_KEYS.forEach(key => {
        if (participant[key] !== undefined) expanded.状态[key] = cloneBattleValue(participant[key]);
      });

      if (participant.属性 && typeof participant.属性 === 'object') {
        expanded.属性 = { ...expanded.属性, ...cloneBattleValue(participant.属性) };
      }
      if (participant.状态 && typeof participant.状态 === 'object') {
        expanded.状态 = { ...expanded.状态, ...cloneBattleValue(participant.状态) };
      }
      if (participant.状态效果 && typeof participant.状态效果 === 'object' && !Array.isArray(participant.状态效果)) {
        expanded.状态效果 = cloneBattleValue(participant.状态效果);
      }
      if (participant.持续效果 && typeof participant.持续效果 === 'object' && !Array.isArray(participant.持续效果)) {
        expanded.持续效果 = cloneBattleValue(participant.持续效果);
      }
      if (participant.蓄力技能 !== undefined) expanded.蓄力技能 = cloneBattleValue(participant.蓄力技能);
      if (participant.决策记忆 !== undefined) expanded.决策记忆 = cloneBattleValue(participant.决策记忆);
      if (participant.当前领域 !== undefined) expanded.当前领域 = cloneBattleValue(participant.当前领域);
      if (participant.存活 !== undefined) expanded.状态.存活 = participant.存活 !== false;
      if (participant.势力 !== undefined) expanded.势力 = cloneBattleValue(participant.势力);

      delete expanded.__combatMirrorBound;
      return expanded;
    }

    function bindCombatParticipant(char) {
      if (!char) return char;
      const spDescriptor = Object.getOwnPropertyDescriptor(char, 'sp');
      const hpDescriptor = Object.getOwnPropertyDescriptor(char, 'hp');
      if (char.__combatMirrorBound && typeof spDescriptor?.get === 'function' && typeof hpDescriptor?.get === 'function') return char;
      if (char.__combatMirrorBound) delete char.__combatMirrorBound;

      if (char.属性) {
        COMBAT_STAT_KEYS.forEach(key => bindCombatMirrorField(char, char.属性, key, { preferSource: true }));
        bindCombatRuntimeAliases(char, char.属性);
        bindCombatRuntimeAliases(char.属性, char.属性);
      }

      if (char.状态) {
        COMBAT_STATUS_KEYS.forEach(key => bindCombatMirrorField(char, char.状态, key));
      }

      if (!char.状态效果) {
        if (char.属性?.状态效果) char.状态效果 = char.属性.状态效果;
        else char.状态效果 = {};
      }
      char.状态效果 = normalizeCombatConditionMapForRuntime(char.状态效果);

      if (char.存活 === undefined && char.状态?.存活 !== undefined) char.存活 = char.状态.存活;

      char.__combatMirrorBound = true;
      return char;
    }

    function hydrateCombatData(combatData) {
      if (!combatData || !combatData.参战者) return combatData;
      combatData.参战者.team_player = Array.isArray(combatData.参战者.team_player)
        ? combatData.参战者.team_player.map(expandCombatParticipantFromMvu)
        : [];
      combatData.参战者.team_enemy = Array.isArray(combatData.参战者.team_enemy)
        ? combatData.参战者.team_enemy.map(expandCombatParticipantFromMvu)
        : [];
      const playerRoster = (combatData.参战者.team_player || []).filter(Boolean);
      const enemyRoster = (combatData.参战者.team_enemy || []).filter(Boolean);

      const processRoster = (roster, opposingRoster) => {
        const seen = new Set();
        roster.forEach(member => {
          if (!member || seen.has(member)) return;
          seen.add(member);
          refreshParticipantProjectedState(
            member,
            roster.filter(unit => unit && unit !== member),
            opposingRoster.filter(Boolean),
          );
        });
      };

      processRoster(playerRoster, enemyRoster);
      processRoster(enemyRoster, playerRoster);

      (combatData.参战者.team_player || []).forEach(member => {
        if (member) member.final = BATTLE_RUNTIME.buildCombatFinalStats(member);
      });
      (combatData.参战者.team_enemy || []).forEach(member => {
        if (member) member.final = BATTLE_RUNTIME.buildCombatFinalStats(member);
      });
      return combatData;
    }

    function normalizeSkillData(skill, fallbackName = '未知技能') {
      const normalized = cloneBattleValue(skill || {});
      const 正式技能旧字段 = ['cast_time', '对象', '结算策略', '运行机制', '状态名称', '机制标签', '技能来源', 'source_tag'];
      const 命中旧字段 = skill && typeof skill === 'object'
        ? 正式技能旧字段.find(字段 => 字段 !== 'cast_time' || skill.__战斗标准技能 !== true
          ? Object.prototype.hasOwnProperty.call(normalized, 字段)
          : false)
        : '';
      if (命中旧字段) throw new Error(`技能正式结构错误:${normalized.魂技名 || normalized.name || fallbackName}仍写入旧字段${命中旧字段}`);
      normalized.__战斗标准技能 = true;
      normalized.name = normalized.name || normalized.技能名称 || fallbackName;
      normalized.魂技名 = normalized.魂技名 || normalized.name || normalized.技能名称 || fallbackName;
      normalized.战斗摘要 = { ...createEmptyBattleSummary(), ...(normalized.战斗摘要 || {}) };
      normalized.战斗语义 = { ...createEmptySkillSemantics(), ...(normalized.战斗语义 || {}) };
      normalized.技能分类 = normalizeSkillTypeLabel(normalized.技能分类 || inferSkillTypeFromEffects(normalized) || '无');
      normalized.cast_time = Number(normalized.前摇 ?? 0) || 0;
      normalized.消耗 =
        typeof normalized.消耗 === 'object' ? formatCostObjectToString(normalized.消耗) : normalized.消耗 || '无';
      normalized.附带属性 = normalizeBattleSkillAttributeTokens(normalized.附带属性);
      normalized.使用条件 = normalized.使用条件 && typeof normalized.使用条件 === 'object' && !Array.isArray(normalized.使用条件)
        ? cloneBattleValue(normalized.使用条件)
        : {};
      const 清理技能正式效果 = value => {
        if (Array.isArray(value)) return value.map(清理技能正式效果).filter(Boolean);
        if (!value || typeof value !== 'object') return value;
        const next = cloneBattleValue(value);
        ['运行机制', '状态名称', '计算层效果', '战斗效果', '面板修改比例', '面板固定修正', '运行时消费器'].forEach(key => {
          delete next[key];
        });
        ['使用效果', '授予效果', '结算效果'].forEach(key => {
          if (Array.isArray(next[key])) next[key] = 清理技能正式效果(next[key]);
        });
        if (Array.isArray(next.条件分支)) {
          next.条件分支 = next.条件分支.map(branch => {
            const 分支 = cloneBattleValue(branch);
            ['替换效果', '追加效果'].forEach(key => {
              if (Array.isArray(分支[key])) 分支[key] = 清理技能正式效果(分支[key]);
            });
            return 分支;
          });
        }
        return next;
      };
      normalized._效果数组 = (Array.isArray(normalized._效果数组) ? normalized._效果数组 : [])
        .filter(effect => effect && typeof effect === 'object')
        .map(清理技能正式效果);
      normalized.element = getBattleSkillDisplayElement(normalized);

      const runtimeMeta = getSkillRuntimeMeta(normalized);
      if (!normalized.消耗 || normalized.消耗 === '无') {
        normalized.消耗 = runtimeMeta.消耗 || '无';
      }
      if (!normalized.技能分类 || normalized.技能分类 === '无') normalized.技能分类 = runtimeMeta.技能分类 || '无';
      if (!(normalized.cast_time > 0)) {
        normalized.cast_time = Number(runtimeMeta.cast_time ?? 0) || 0;
      }
      normalized.前摇 = Number(normalized.前摇 ?? 0) || 0;

      applyAttributeCoeffToCombatSkill(normalized);
      if (skill && typeof skill === 'object') {
        const 来源上下文 = 战斗来源类别上下文表.get(skill);
        if (来源上下文) 写入战斗来源类别上下文(normalized, 来源上下文);
      }

      return normalized;
    }

    const FUSION_SELF_SPIRIT_SLOTS = ['第1武魂', '第2武魂'];

    function getFusionSkillMode(fusionSkill = {}) {
      return fusionSkill?.融合模式 === 'self' ? 'self' : 'partner';
    }

    function splitFusionPartnerText(rawValue = '') {
      return String(rawValue || '')
        .split(/[、,，+\/|｜；;]/)
        .map(item => String(item || '').trim())
        .filter(Boolean);
    }

    function normalizeFusionSkillParticipants(fusionSkill = {}) {
      const rawParticipants = Array.isArray(fusionSkill?.融合参与者) ? fusionSkill.融合参与者 : [];
      if (rawParticipants.length) {
        return rawParticipants
          .map(participant => {
            const raw = participant && typeof participant === 'object' ? participant : {};
            const roleText = String(raw.role || raw.类型 || raw.身份 || '').trim();
            const role = roleText === 'self' || /自身|自体|本体|自己/.test(roleText) ? 'self' : 'partner';
            const charName = String(
              raw.charName || raw.char_name || raw.name || raw.角色 || raw.角色名 || raw.charKey || raw.char_key || raw.key || '',
            ).trim();
            const charKey = String(raw.charKey || raw.char_key || raw.key || raw.角色键 || '').trim();
            const spirit = String(raw.spirit || raw.spiritName || raw.spirit_name || raw.武魂 || raw.来源武魂 || '').trim();
            return { role, charName, charKey, spirit };
          })
          .filter(participant => participant.charName || participant.charKey || participant.spirit);
      }
      const mode = getFusionSkillMode(fusionSkill);
      if (mode === 'self') {
        return getFusionSkillSourceSpirits(fusionSkill).map(slot => ({ role: 'self', charName: '', charKey: '', spirit: slot }));
      }
      return splitFusionPartnerText(fusionSkill?.融合对象 || '').map(name => ({
        role: 'partner',
        charName: name,
        charKey: '',
        spirit: '',
      }));
    }

    function getFusionSkillPartnerNames(fusionSkill = {}) {
      const names = normalizeFusionSkillParticipants(fusionSkill)
        .filter(participant => participant.role !== 'self')
        .map(participant => participant.charName || participant.charKey)
        .filter(Boolean);
      return Array.from(new Set(names));
    }

    function getFusionSkillPartnerName(fusionSkill = {}) {
      const names = getFusionSkillPartnerNames(fusionSkill);
      return names.length ? names.join('、') : String(fusionSkill?.融合对象 || '').trim();
    }

    function 读取融合相关度总分(charData = {}, fusionSkill = {}) {
      if (getFusionSkillMode(fusionSkill) === 'self') return 100;
      const partnerNames = getFusionSkillPartnerNames(fusionSkill);
      if (!partnerNames.length) return 0;
      const relationMap = charData?.社交?.关系 && typeof charData.社交.关系 === 'object' ? charData.社交.关系 : {};
      const scores = partnerNames.map(name => {
        const rel = relationMap[name];
        const base = Number(rel?.武魂相关度基础);
        const 基础分 = Number.isFinite(base) ? Math.max(0, Math.min(100, Math.floor(base))) : 0;
        const favor = Number(rel?.好感度 ?? 0);
        const 关系加成 = Number.isFinite(favor) ? Math.max(0, Math.min(20, Math.floor(Math.max(0, favor) / 10))) : 0;
        return Math.max(0, Math.min(100, 基础分 + 关系加成));
      });
      if (!scores.length) return 0;
      return Math.max(0, Math.min(100, Math.floor(Math.min(...scores))));
    }

    function 计算融合相关度倍率(相关度总分 = 100) {
      const 安全总分 = Math.max(0, Math.min(100, Number(相关度总分 || 0)));
      if (安全总分 < 70) return 0.9;
      const 进度 = (安全总分 - 70) / 30;
      return Number((1 + Math.max(0, Math.min(1, 进度)) * 0.25).toFixed(4));
    }

    function 获取融合技能可用性(charData, fusionSkill, alliedTeam = []) {
      if (!fusionSkill?.技能数据 || fusionSkill?.技能数据?.状态 === '未生成') {
        return { 可用: false, 原因: '融合技能未完成生成', 相关度总分: 0 };
      }
      if (getFusionSkillMode(fusionSkill) === 'self') {
        const slots = getFusionSkillSourceSpirits(fusionSkill);
        const 可用 = slots.length >= 2 && slots.every(slot => hasUsableSpiritSlot(charData, slot));
        return { 可用, 原因: 可用 ? '' : '自体融合缺少双武魂槽位', 相关度总分: 100 };
      }
      const partnerNames = getFusionSkillPartnerNames(fusionSkill);
      if (!partnerNames.length) return { 可用: false, 原因: '未配置融合对象', 相关度总分: 0 };
      const 搭档到位 = partnerNames.every(partnerName =>
        (alliedTeam || []).some(unit => isCombatUnitIdentityMatch(unit, partnerName) && isCombatUnitAbleToFight(unit)),
      );
      if (!搭档到位) {
        return { 可用: false, 原因: `搭档[${partnerNames.join('、')}]未到位`, 相关度总分: 0 };
      }
      const 相关度总分 = 读取融合相关度总分(charData || {}, fusionSkill || {});
      if (相关度总分 < 70) {
        return { 可用: false, 原因: `武魂相关度不足(${相关度总分}/70)`, 相关度总分 };
      }
      return { 可用: true, 原因: '', 相关度总分 };
    }

    function buildFusionBattleProfile(mode = 'partner', partnerCount = 1, 相关度总分 = 100) {
      const safeMode = mode === 'self' ? 'self' : 'partner';
      const safePartnerCount = Math.max(1, Math.floor(Number(partnerCount || 1)));
      const multiPartnerBonus = Math.min(0.12, Math.max(0, safePartnerCount - 1) * 0.05);
      if (safeMode === 'self') {
        return {
          mode: safeMode,
          partnerCount: 0,
          actorCostScale: 1.35,
          partnerPoolScale: 0,
          castTimeScale: 1.08,
          damageMult: 1.5,
          recoverMult: 1.38,
          shieldMult: 1.38,
          stateScale: 1.3,
          controlScale: 1.35,
          aftermathDuration: 2,
          aftermathPanelScale: 0.78,
          aftermathDamageMult: 0.76,
          aftermathHealMult: 0.78,
          aftermathShieldMult: 0.78,
          aftermathCastPenalty: 0.42,
          aftermathDodgePenalty: 0.15,
          aftermathReactionPenalty: 0.15,
          aftermathResourceBlock: 0.28,
          相关度总分: 100,
          相关度倍率: 1,
        };
      }
      const 相关度倍率 = 计算融合相关度倍率(相关度总分);
      return {
        mode: safeMode,
        partnerCount: safePartnerCount,
        actorCostScale: 1.1,
        partnerPoolScale: 0.6,
        castTimeScale: 1.15,
        damageMult: (1.65 + multiPartnerBonus) * 相关度倍率,
        recoverMult: (1.5 + multiPartnerBonus * 0.6) * 相关度倍率,
        shieldMult: (1.5 + multiPartnerBonus * 0.6) * 相关度倍率,
        stateScale: (1.42 + multiPartnerBonus * 0.5) * 相关度倍率,
        controlScale: (1.5 + multiPartnerBonus * 0.6) * 相关度倍率,
        aftermathDuration: 2,
        aftermathPanelScale: 0.82,
        aftermathDamageMult: 0.82,
        aftermathHealMult: 0.82,
        aftermathShieldMult: 0.82,
        aftermathCastPenalty: 0.35,
        aftermathDodgePenalty: 0.12,
        aftermathReactionPenalty: 0.12,
        aftermathResourceBlock: 0.22,
        相关度总分: Math.max(0, Math.min(100, Math.floor(Number(相关度总分 || 0)))),
        相关度倍率,
      };
    }

    function getFusionBattleProfileFromSkill(skill = {}) {
      return skill?.__fusion_profile && typeof skill.__fusion_profile === 'object' ? skill.__fusion_profile : null;
    }

    function buildFusionCombatSkill(fusionSkill = {}, fusionName = '武魂融合技', charData = null) {
      const skill = normalizeSkillData(fusionSkill?.技能数据, `武魂融合技·${fusionName}`);
      const mode = getFusionSkillMode(fusionSkill);
      const partnerNames = getFusionSkillPartnerNames(fusionSkill);
      const 相关度总分 = mode === 'self' ? 100 : 读取融合相关度总分(charData || {}, fusionSkill || {});
      const profile = buildFusionBattleProfile(mode, partnerNames.length || 1, 相关度总分);
      const baseCostText = String(skill.消耗 || '无').trim() || '无';
      const actorCostText = scaleSkillCostText(baseCostText, profile.actorCostScale);
      const partnerCostRatio =
        mode === 'partner' && partnerNames.length > 0
          ? Number(profile.partnerPoolScale || 0) / Math.max(1, partnerNames.length)
          : 0;
      const partnerCostText = partnerCostRatio > 0 ? scaleSkillCostText(actorCostText, partnerCostRatio) : '无';
      const baseCastTime = Number(skill.前摇 ?? 0) || 0;
      const nextCastTime = Math.max(baseCastTime > 0 ? 1 : 0, Math.round(baseCastTime * Number(profile.castTimeScale || 1)));

      skill.消耗 = actorCostText;
      skill.前摇 = nextCastTime;
      写入战斗来源类别上下文(skill, { 来源类别: '武魂融合技', 来源明细: fusionName || '武魂融合技' });
      skill.__融合模式 = mode;
      skill.__融合对象 = partnerNames.length ? partnerNames.join('、') : '无';
      skill.__fusion_profile = { ...profile, partnerNames: [...partnerNames] };
      skill.__fusion_partner_names = [...partnerNames];
      skill.__fusion_partner_cost_text = partnerCostText;
      skill.__融合相关度总分 = Number(profile?.相关度总分 || 0);
      skill.__融合相关度倍率 = Number(profile?.相关度倍率 || 1);
      skill.__fusion_display_cost_text =
        partnerCostText !== '无' && partnerNames.length
          ? `${actorCostText} | 共耗(${partnerNames.join('、')}): ${partnerCostText}`
          : actorCostText;
      return skill;
    }

    function getFusionSkillDisplayCostText(skill = {}) {
      const displayText = String(skill?.__fusion_display_cost_text || '').trim();
      if (displayText) return displayText;
      return getSkillCostText(skill);
    }

    function getFusionSkillSourceSpirits(fusionSkill = {}) {
      const rawSlots = Array.isArray(fusionSkill?.来源武魂) ? fusionSkill.来源武魂 : [];
      const slots = rawSlots
        .map(slot => String(slot || '').trim())
        .filter(slot => FUSION_SELF_SPIRIT_SLOTS.includes(slot));
      if (slots.length) return Array.from(new Set(slots));
      return getFusionSkillMode(fusionSkill) === 'self' ? [...FUSION_SELF_SPIRIT_SLOTS] : ['第1武魂'];
    }

    function hasUsableSpiritSlot(charData, slot) {
      return !!(charData && charData[slot] && typeof charData[slot] === 'object');
    }

    function isFusionSkillAvailable(charData, fusionSkill, alliedTeam = []) {
      return !!获取融合技能可用性(charData, fusionSkill, alliedTeam).可用;
    }

    function buildFusionCastNarration(fusionSkill, actorName = '施术者') {
      if (getFusionSkillMode(fusionSkill) === 'self') {
        const slots = getFusionSkillSourceSpirits(fusionSkill);
        return `${actorName}将${slots.join('与')}同频共振，自体交融，悍然施展了武魂融合技！`;
      }
      return `${actorName}与${getFusionSkillPartnerName(fusionSkill) || '同伴'}气息交融，果断施展了武魂融合技！`;
    }

    function parseResourceCostValue(costStr, label, currentValue, maxValue) {
      const text = String(costStr || '');
      const currentMatch = text.match(new RegExp(`${label}:(?:当前(?:剩余)?|剩余)(\\d+)%`));
      if (currentMatch)
        return Math.floor((Math.max(0, Number(currentValue || 0)) * parseInt(currentMatch[1], 10)) / 100);
      const baseMatch = text.match(new RegExp(`${label}:(\\d+)(%?)`));
      if (!baseMatch) return 0;
      return baseMatch[2]
        ? Math.floor((Math.max(0, Number(maxValue || 0)) * parseInt(baseMatch[1], 10)) / 100)
        : parseInt(baseMatch[1], 10);
    }

    function 读取运行态批量目标列表(skill) {
      if (!skill || !Array.isArray(skill.__批量目标列表)) return [];
      return dedupeCombatTargetList(skill.__批量目标列表.filter(Boolean));
    }

    function 计算辅助目标数量倍率(skill) {
      if (!skill || !isSupportLikeSkill(skill)) return 1;
      const 目标数量 = Math.max(1, Math.floor(Number(skill.__辅助目标数量 || 1)));
      return 1 + 0.1 * (Math.min(12, 目标数量) - 1);
    }

    function 计算运行态辅助消耗系数(skill, char, 默认单体系数 = 1) {
      if (!skill || !isSupportLikeSkill(skill)) return Math.max(1, Number(默认单体系数 || 1));
      const 批量目标列表 = 读取运行态批量目标列表(skill);
      const 批量模式 = String(skill.__批量消耗模式 || '').trim();
      const 七九单体语义 = 是否七九辅助单体语义(char, skill);
      if (批量目标列表.length > 0 && (批量模式 === '单体批量' || 七九单体语义)) {
        return 批量目标列表.reduce((总和, 目标) => 总和 + getSupportCostScale(char, 目标), 0);
      }
      if (批量目标列表.length > 0) {
        const 最高单体倍率 = 批量目标列表.reduce((最高, 目标) => Math.max(最高, getSupportCostScale(char, 目标)), 1);
        return 最高单体倍率 * (1 + 0.1 * (Math.min(12, 批量目标列表.length) - 1));
      }
      if (七九单体语义) return Math.max(1, Number(默认单体系数 || 1));
      return Math.max(1, Number(默认单体系数 || 1)) * 计算辅助目标数量倍率(skill);
    }

    function 读取运行态覆盖目标数量(skill) {
      const 批量目标列表 = 读取运行态批量目标列表(skill);
      if (批量目标列表.length > 0) return 批量目标列表.length;
      const 显式数量 = Math.max(
        0,
        Math.floor(Number(skill?.__覆盖目标数量 || skill?.__辅助目标数量 || 0)),
      );
      return 显式数量 > 0 ? 显式数量 : 1;
    }

    function 计算运行态目标数量消耗系数(skill, char, 默认单体系数 = 1) {
      const 基础系数 = Math.max(1, Number(默认单体系数 || 1));
      if (!skill) return 基础系数;
      if (isSupportLikeSkill(skill)) return 计算运行态辅助消耗系数(skill, char, 基础系数);
      const 目标数量 = Math.max(1, Math.min(12, 读取运行态覆盖目标数量(skill)));
      return 基础系数 * (1 + 0.1 * (目标数量 - 1));
    }

    function parseSkillCostForChar(skill, char, context = {}) {
      const stats = char?.属性 || char || {};
      const 使用条件 = skill?.使用条件 && typeof skill.使用条件 === 'object' && !Array.isArray(skill.使用条件) ? skill.使用条件 : {};
      const 角色等级 = Number(stats.等级 ?? char?.等级 ?? 0) || 0;
      const 最低等级 = Math.max(0, Number(使用条件.最低等级 || 0) || 0);
      if (最低等级 > 0 && 角色等级 < 最低等级) {
        return {
          reqSp: 0,
          reqVit: 0,
          reqMen: 0,
          costScale: 1,
          canCast: false,
          failureReason: `等级不足(${Math.floor(角色等级)}/${最低等级})`,
          partnerCosts: [],
        };
      }
      const 当前魂力 = Number(stats.sp ?? stats.魂力 ?? 0) || 0;
      const 当前精神力 = Number(stats.men ?? stats.精神力 ?? 0) || 0;
      const 最低魂力 = Math.max(0, Number(使用条件.最低魂力 || 0) || 0);
      const 最低精神力 = Math.max(0, Number(使用条件.最低精神力 || 0) || 0);
      if ((最低魂力 > 0 && 当前魂力 < 最低魂力) || (最低精神力 > 0 && 当前精神力 < 最低精神力)) {
        return {
          reqSp: 0,
          reqVit: 0,
          reqMen: 0,
          costScale: 1,
          canCast: false,
          failureReason: '使用条件不足',
          partnerCosts: [],
        };
      }
      const 百分比启动检查 = 检查普通魂技百分比启动消耗(skill, char, context?.action || {
        action_type: String(context?.当前行动 || '').trim() === '武魂融合技' ? '武魂融合技' : '释放魂技',
      });
      if (!百分比启动检查.可用) {
        return {
          reqSp: 0,
          reqVit: 0,
          reqMen: 0,
          costScale: 1,
          canCast: false,
          failureReason: 百分比启动检查.原因,
          partnerCosts: [],
        };
      }
      const 炸环恢复信息 = 读取技能魂环恢复标记_V1(skill, char);
      if (炸环恢复信息.恢复中) {
        return {
          reqSp: 0,
          reqVit: 0,
          reqMen: 0,
          costScale: 1,
          canCast: false,
          failureReason: `魂环恢复中(剩余${Math.max(1, Math.floor(Number(炸环恢复信息.剩余tick || 0)))}tick)`,
          partnerCosts: [],
        };
      }
      const rawCost = normalizeSkillData(skill).消耗 || getSkillCostText(skill);
      const costStr = rawCost && typeof rawCost === 'object' && !Array.isArray(rawCost)
        ? formatCostObjectToString(rawCost)
        : String(rawCost || '无');
      const presetCostScale = Number(skill?.__battleSupportCostScale);
      const 单体辅助消耗系数 =
        Number.isFinite(presetCostScale) && presetCostScale > 0
          ? presetCostScale
          : skill && char && skill.__targetForSupportCost && isSupportLikeSkill(skill)
            ? getSupportCostScale(char, skill.__targetForSupportCost)
            : 1;
      const costScale = 计算运行态目标数量消耗系数(skill, char, 单体辅助消耗系数);
      const statusCostScale = 获取施法消耗系数(char);
      const rawReqSp = parseResourceCostValue(
        costStr,
        '魂力',
        stats.sp ?? stats.魂力,
        stats.sp_max ?? stats.魂力上限,
      );
      const rawReqVit = parseResourceCostValue(
        costStr,
        '体力',
        stats.sta ?? stats.体力 ?? stats.vit,
        stats.sta_max ?? stats.体力上限 ?? stats.vit_max,
      );
      const rawReqMen = parseResourceCostValue(
        costStr,
        '精神力',
        stats.men ?? stats.精神力,
        stats.men_max ?? stats.精神力上限,
      );
      const 实际原始魂力消耗 = rawReqSp;
      const hpRatio =
        Math.max(0, Number(stats.hp ?? stats.HP ?? 0)) /
        Math.max(1, Number(stats.hp_max ?? stats.HP上限 ?? 1));
      const staminaCostScale = hpRatio <= 0.2 ? 2 : 1;
      const 自身消耗修正 = 读取技能自身结算修正(skill, '消耗', {
        ...context,
        actor: context?.actor || char,
        caster: context?.caster || char,
        attacker: context?.attacker || char,
        skill,
      });
      const 消耗绝对修正 = 获取施法消耗绝对修正(char) + 自身消耗修正.绝对;
      const 原始总消耗 = Math.max(1, 实际原始魂力消耗 + rawReqVit + rawReqMen);
      const 修正消耗 = (原始值, 倍率 = 1) => Math.max(0, Math.floor(原始值 * costScale * statusCostScale * 自身消耗修正.倍率 * 倍率 + 消耗绝对修正 * (原始值 / 原始总消耗)));
      const reqSp = 修正消耗(实际原始魂力消耗);
      const reqVit = 修正消耗(rawReqVit, staminaCostScale);
      const reqMen = 修正消耗(rawReqMen);
      const selfCanCast =
        ((stats.sp ?? stats.魂力) || 0) >= reqSp &&
        ((stats.sta ?? stats.体力 ?? stats.vit) || 0) >= reqVit &&
        ((stats.men ?? stats.精神力) || 0) >= reqMen;
      const fusionProfile = getFusionBattleProfileFromSkill(skill);
      const result = {
        reqSp,
        reqVit,
        reqMen,
        costScale: costScale * statusCostScale * 自身消耗修正.倍率,
        canCast: selfCanCast,
        failureReason: selfCanCast ? '' : '自身状态不足',
        partnerCosts: [],
      };
      if (getBattleSkillSourceCategory(skill) === '武魂融合技' && skill?.__融合可用 === false) {
        result.canCast = false;
        result.failureReason = String(skill?.__融合不可用原因 || '').trim() || '武魂融合技条件不足';
        return result;
      }
      if (!fusionProfile || fusionProfile.mode !== 'partner') return result;

      const 融合同队列表 = Array.isArray(skill?.__融合队友列表) ? skill.__融合队友列表 : [];
      const partnerUnits = resolveFusionPartnerUnitsForSkill(skill, 融合同队列表, null, char);
      const expectedNames = Array.isArray(skill?.__fusion_partner_names) ? skill.__fusion_partner_names : [];
      if (partnerUnits.length < Math.max(1, expectedNames.length)) {
        result.canCast = false;
        result.failureReason = expectedNames.length ? `搭档[${expectedNames.join('、')}]未到位` : '搭档未到位';
        return result;
      }

      const partnerCostText = String(skill?.__fusion_partner_cost_text || '无').trim() || '无';
      const partnerCosts = partnerUnits.map(unit => {
        const parsed = parseCostStringForChar(partnerCostText, unit, 1);
        return {
          ...parsed,
          unit,
          name: String(unit?.name || unit?.名称 || '搭档').trim() || '搭档',
        };
      });
      result.partnerCosts = partnerCosts;
      const failedPartner = partnerCosts.find(item => !item.canCast);
      if (failedPartner) {
        result.canCast = false;
        result.failureReason = `${failedPartner.name}状态不足`;
      }
      // Phase E: 摘出行动类型标注 + 技能谓词, 供 deductParsedCostFromUnit 推断疲劳率
      try {
        result.__action_type = String(skill?.action_type || skill?.类别 || skill?.category || '').trim();
        result.__风险等级 = String(skill?.风险等级 || skill?.summary?.风险等级 || '').trim();
        result.__来源类别 = (typeof 读取战斗来源类别上下文 === 'function')
          ? String(读取战斗来源类别上下文(skill, '魂技')?.来源类别 || '').trim()
          : '';
        // 技能谓词推断 (轻量, 不调 deriveBattleSummaryFromEffects)
        const _效果数组 = Array.isArray(skill?._效果数组) ? skill._效果数组 : [];
        const _原型集合 = _效果数组.map(e => String(e?.原型 || '').trim());
        result.__是输出 = _原型集合.some(p => /伤害结算|伤害|破甲|护盾.*斩除|护盾.*窃取/.test(p))
          || /^(伤害|输出|攻击)/.test(result.__action_type);
        result.__是治疗 = _原型集合.some(p => /生命恢复|资源变化.*生命|HP恢复/.test(p));
        result.__是控制 = _原型集合.some(p => /控制|眩晕|沉默|束缚|定身|混乱/.test(p));
        result.__是防护 = _原型集合.some(p => /护盾|防御|减伤|保护|减害/.test(p));
        result.__是召唤 = _原型集合.some(p => /^召唤生成$|召唤/.test(p));
        result.__是维持 = !!(getSkillCostText && /维持/.test(getSkillCostText(skill) || ''));
      } catch (e) { /* 缺依赖时静默 */ }
      return result;
    }

    function 计算技能消耗压力(skill, char) {
      const 空结果 = {
        可释放: true,
        失败原因: '',
        当前压力: 0,
        上限压力: 0,
        综合压力: 0,
        魂力占当前: 0,
        精神占当前: 0,
        体力占当前: 0,
      };
      if (!skill || !char) return 空结果;
      const 消耗片段 = splitSkillCostModes(getSkillCostText(skill));
      const 解析消耗 = parseSkillCostForChar({ ...skill, 消耗: 消耗片段.upfront || '无' }, char);
      const 属性 = char?.属性 || char || {};
      const 当前魂力 = Math.max(0, Number(属性.sp ?? 属性.魂力 ?? 0));
      const 当前精神力 = Math.max(0, Number(属性.men ?? 属性.精神力 ?? 0));
      const 当前体力 = Math.max(0, Number(属性.sta ?? 属性.体力 ?? 属性.vit ?? 0));
      const 魂力上限 = Math.max(1, Number(属性.sp_max ?? 属性.魂力上限 ?? 当前魂力 ?? 1));
      const 精神力上限 = Math.max(1, Number(属性.men_max ?? 属性.精神力上限 ?? 当前精神力 ?? 1));
      const 体力上限 = Math.max(1, Number(属性.sta_max ?? 属性.体力上限 ?? 属性.vit_max ?? 当前体力 ?? 1));
      const 魂力占当前 = 解析消耗.reqSp > 0 ? 解析消耗.reqSp / Math.max(1, 当前魂力) : 0;
      const 精神占当前 = 解析消耗.reqMen > 0 ? 解析消耗.reqMen / Math.max(1, 当前精神力) : 0;
      const 体力占当前 = 解析消耗.reqVit > 0 ? 解析消耗.reqVit / Math.max(1, 当前体力) : 0;
      const 当前压力 = Math.max(魂力占当前, 精神占当前, 体力占当前);
      const 上限压力 = Math.max(
        解析消耗.reqSp > 0 ? 解析消耗.reqSp / 魂力上限 : 0,
        解析消耗.reqMen > 0 ? 解析消耗.reqMen / 精神力上限 : 0,
        解析消耗.reqVit > 0 ? 解析消耗.reqVit / 体力上限 : 0,
      );
      return {
        可释放: 解析消耗.canCast !== false,
        失败原因: 解析消耗.failureReason || '',
        当前压力,
        上限压力,
        综合压力: Math.max(当前压力, 上限压力),
        魂力占当前,
        精神占当前,
        体力占当前,
        临界度: Math.max(魂力占当前, 精神占当前, 体力占当前),
      };
    }

    function 按资源压力调整权重(weight, skill, char, 选项 = {}) {
      let 修正权重 = Math.max(0, Number(weight || 0));
      if (修正权重 <= 0) return 0;
      const 消耗压力 = 计算技能消耗压力(skill, char);
      if (!消耗压力.可释放) return 0;
      const 回合 = Math.max(0, Number(选项.回合 || 0));
      const 战况推力 = Math.max(0, Math.min(1, Number(选项.战况推力 ?? 0)));
      const 是真身 = 选项.是真身 === true;
      const 消耗惩罚 = Math.ceil(消耗压力.当前压力 * 52 + 消耗压力.上限压力 * 22);
      const 临界推力 = Math.max(0, 消耗压力.临界度 - 0.45) * 78;
      const 回合推力 = Math.min(42, 回合 * 4.5) * Math.max(0, 消耗压力.综合压力 - 0.22);
      const 战况加权 = 战况推力 * (28 + 消耗压力.综合压力 * 70);
      const 保守扣权 = (1 - 战况推力) * Math.max(0, 消耗压力.综合压力 - 0.32) * (是真身 ? 70 : 48);
      修正权重 -= 消耗惩罚;
      修正权重 += 临界推力 + 回合推力 + 战况加权;
      修正权重 -= 保守扣权;
      if (是真身 && 战况推力 < 0.35) 修正权重 -= 24;
      return Math.max(0, Math.floor(修正权重));
    }

    function chooseWeightedOption(options) {
      const valid = (options || []).filter(option => option && option.weight > 0);
      if (valid.length === 0) return null;
      const totalWeight = valid.reduce((sum, option) => sum + option.weight, 0);
      let roll = Math.random() * totalWeight;
      for (const option of valid) {
        roll -= option.weight;
        if (roll <= 0) return option;
      }
      return valid[0];
    }

    function rollD100() {
      return Math.floor(Math.random() * 100) + 1;
    }

    function isPassiveSkillData(skill, sourceContext = {}) {
      if (!skill || typeof skill !== 'object') return false;
      if (String(skill?.承载方式 || '').trim() === '被动') return true;
      const 来源文本 = [
        sourceContext?.来源类别,
        sourceContext?.来源明细,
        读取战斗来源类别上下文(skill, '').来源类别,
        读取战斗来源类别上下文(skill, '').来源明细,
      ].map(value => String(value || '').trim()).filter(Boolean).join(' ');
      if (/血脉被动|被动/.test(来源文本)) return true;
      const 效果列表 = Array.isArray(skill?._效果数组) ? skill._效果数组 : [];
      if (效果列表.some(effect =>
        String(effect?.原型 || '').trim() === '规则改写' &&
        String(effect?.规则 || '').trim() === '死亡转存活' &&
        String(effect?.目标 || '自身').trim() === '自身'
      )) return true;
      if (效果列表.length > 0 && 效果列表.every(effect => 技能效果依赖当前行动条件(effect))) return true;
      const rawType = getSkillType(skill);
      return /被动/.test(String(rawType || ''));
    }

    function pushUnifiedSkillMapEntries(skills, skillMap, sourceTag, options = {}, sourceContext = {}) {
      const { includePassive = false, includeActive = true } = options;
      Object.entries(skillMap || {}).forEach(([skillName, skillData]) => {
        if (!skillData || skillData?.状态 === '未生成') return;
        const 来源类别 = 规范化战斗来源类别(sourceContext?.来源类别 || sourceTag, '魂技');
        const 来源明细 = String(sourceContext?.来源明细 || sourceTag || 来源类别).trim() || 来源类别;
        const 标准技能 = normalizeSkillData(skillData, skillName);
        写入战斗来源类别上下文(标准技能, {
          来源类别,
          来源明细,
          魂环路径: sourceContext?.魂环路径,
          魂技槽位: sourceContext?.魂技槽位 || skillName,
        });
        const 是否被动 = isPassiveSkillData(标准技能, { 来源类别, 来源明细 });
        if (是否被动 && !includePassive) return;
        if (!是否被动 && !includeActive) return;
        if (Array.isArray(sourceContext?.魂环路径) && sourceContext.魂环路径.length > 0) {
          标准技能.__魂环路径 = [...sourceContext.魂环路径];
        }
        skills.push(标准技能);
      });
    }

    function 套用复刻技能倍率(技能, 倍率 = 1) {
      const 比例 = Math.max(0.1, Math.min(1.5, Number(倍率 || 1)));
      if (Math.abs(比例 - 1) < 0.0001) return 技能;
      getSkillEffects(技能).forEach(effect => {
        ['威力倍率', '护盾值', '每回合伤害', 'dot_damage', 'final_damage_bonus', 'final_heal_bonus', 'shield_gain_bonus'].forEach(字段 => {
          if (Number.isFinite(Number(effect?.[字段]))) effect[字段] = scaleBattleValue(effect[字段], 比例, { min: 0, digits: 4 });
        });
        ['final_damage_mult', 'received_damage_mult', 'final_heal_mult', 'shield_gain_mult', 'skill_effect_mult'].forEach(字段 => {
          if (Number.isFinite(Number(effect?.[字段]))) effect[字段] = scaleBattleFactor(effect[字段], 比例, 1);
          if (effect?.计算层效果 && Number.isFinite(Number(effect.计算层效果[字段])))
            effect.计算层效果[字段] = scaleBattleFactor(effect.计算层效果[字段], 比例, 1);
        });
      });
      return 技能;
    }

    function collectUnifiedSkillEntries(charData, alliedTeam = [], options = {}) {
      const skills = [];
      const collectOptions = {
        includePassive: !!options.includePassive,
        includeActive: options.includeActive !== false,
        includeUnavailableFusion: !!options.includeUnavailableFusion,
      };

      取角色武魂条目_战斗(charData).forEach(([spKey, sp]) => {
        const spName = sp?.表象名称 || spKey || '武魂';
        取武魂魂灵条目_战斗(sp).forEach(([魂灵键, ss]) => {
          取魂灵魂环条目_战斗(ss).forEach(([魂环键, ring]) => {
            pushUnifiedSkillMapEntries(
              skills,
              Object.fromEntries(取魂环魂技条目_战斗(ring)),
              spName,
              collectOptions,
              { 来源类别: '魂技', 来源明细: spName, 魂环路径: [spKey, 魂灵键, 魂环键] },
            );
          });
        });
        取武魂直接魂环条目_战斗(sp).forEach(([魂环键, ring]) => {
          pushUnifiedSkillMapEntries(
            skills,
            Object.fromEntries(取魂环魂技条目_战斗(ring)),
            spName,
            collectOptions,
            { 来源类别: '魂技', 来源明细: spName, 魂环路径: [spKey, 魂环键] },
          );
        });
      });

      if (charData?.血脉之力) {
        pushUnifiedSkillMapEntries(skills, charData.血脉之力.技能 || {}, '血脉之力', collectOptions, { 来源类别: '血脉技能', 来源明细: '血脉之力' });
        pushUnifiedSkillMapEntries(skills, charData.血脉之力.被动 || {}, '血脉被动', collectOptions, { 来源类别: '血脉技能', 来源明细: '血脉被动' });
        取血脉气血魂环条目_战斗(charData.血脉之力).forEach(([, ring]) => {
          pushUnifiedSkillMapEntries(skills, Object.fromEntries(取气血魂环魂技条目_战斗(ring)), '气血魂技', collectOptions, { 来源类别: '气血魂技', 来源明细: '气血魂技' });
        });
      }

      Object.values(charData?.魂骨 || {}).forEach(bone => {
        const 合并魂骨 = 合并战斗物品定义_战斗(bone);
        pushUnifiedSkillMapEntries(skills, 合并魂骨?.附带技能 || 合并魂骨?.装备技能 || {}, '魂骨技能', collectOptions, { 来源类别: '魂骨技能', 来源明细: 合并魂骨?.名称 || 合并魂骨?.表象名称 || '魂骨技能' });
      });

      Object.entries(charData?.装备 || {}).forEach(([装备键, equip]) => {
        if (装备键 === '魂导器') return;
        if (!equip || typeof equip !== 'object' || Array.isArray(equip)) return;
        const 合并装备 = 合并战斗物品定义_战斗(equip);
        if (Number(合并装备.魂导等级 || 0) > 0) return;
        pushUnifiedSkillMapEntries(skills, 合并装备.装备技能 || {}, '装备技能', collectOptions, { 来源类别: '装备技能', 来源明细: 合并装备?.名称 || 合并装备?.name || '装备技能' });
      });
      pushUnifiedSkillMapEntries(skills, 构建魂导器技能表_战斗(charData?.装备?.魂导器), '装备技能', collectOptions, { 来源类别: '装备技能', 来源明细: '魂导器' });

      pushUnifiedSkillMapEntries(skills, charData?.自创魂技 || {}, '自创魂技', collectOptions, { 来源类别: '自创魂技', 来源明细: '自创魂技' });

      const 清理空复制效果 = 复制键 => {
        if (!charData?.复制效果?.[复制键]) return;
        const 记录 = charData.复制效果[复制键];
        if (!记录.技能列表 && !记录.属性快照) delete charData.复制效果[复制键];
        if (!Object.keys(charData.复制效果 || {}).length) delete charData.复制效果;
      };
      Object.entries(charData?.复制效果 || {}).forEach(([复制键, 记录]) => {
        if (!记录 || typeof 记录 !== 'object') return;
        const 到期tick = Math.max(0, Number(记录.到期tick || 0));
        const 当前tick = Math.max(0, Number(window.BattleUIBridge?.getMVU?.('world.时间.tick') || 0));
        if (到期tick > 0 && 当前tick >= 到期tick) {
          delete charData.复制效果[复制键];
          if (!Object.keys(charData.复制效果 || {}).length) delete charData.复制效果;
          return;
        }
        Object.entries(记录.技能列表 || {}).forEach(([技能键, item]) => {
          const 剩余次数 = item?.剩余次数 === undefined ? undefined : Math.max(0, Math.floor(Number(item.剩余次数 || 0)));
          if (剩余次数 !== undefined && 剩余次数 <= 0) {
            delete 记录.技能列表[技能键];
            if (!Object.keys(记录.技能列表 || {}).length) delete 记录.技能列表;
            清理空复制效果(复制键);
            return;
          }
          const 技能 = item?.技能数据 && typeof item.技能数据 === 'object' ? item.技能数据 : null;
          if (!技能 || typeof 技能 !== 'object') return;
          const 原名 = String(技能.name || 技能.魂技名 || 技能.技能名称 || 技能键).trim();
          const 复刻技能 = normalizeSkillData(cloneBattleValue(技能), 原名);
          复刻技能.name = `复刻·${原名}`;
          复刻技能.魂技名 = 复刻技能.name;
          写入战斗来源类别上下文(复刻技能, { 来源类别: '复制技能', 来源明细: 复制键 });
          复刻技能.__复制效果键 = 复制键;
          复刻技能.__复制效果技能键 = 技能键;
          if (剩余次数 !== undefined) 复刻技能.__复刻可用次数 = 剩余次数;
          const 是否被动 = isPassiveSkillData(复刻技能);
          if (是否被动 && !collectOptions.includePassive) return;
          if (!是否被动 && !collectOptions.includeActive) return;
          skills.push(复刻技能);
        });
      });

      Object.entries(charData?.状态效果 || {}).forEach(([状态名, 状态]) => {
        if (!状态 || Number(状态.duration ?? 1) <= 0 || !状态.技能列表 || typeof 状态.技能列表 !== 'object') return;
        Object.entries(状态.技能列表 || {}).forEach(([技能键, item]) => {
          const 剩余次数 = item?.剩余次数 === undefined ? undefined : Math.max(0, Math.floor(Number(item.剩余次数 || 0)));
          if (剩余次数 !== undefined && 剩余次数 <= 0) return;
          const 技能 = item?.技能数据 && typeof item.技能数据 === 'object' ? item.技能数据 : null;
          if (!技能 || typeof 技能 !== 'object') return;
          const 原名 = String(技能.name || 技能.魂技名 || 技能.技能名称 || 技能键).trim();
          const 复刻技能 = normalizeSkillData(cloneBattleValue(技能), 原名);
          复刻技能.name = `复刻·${原名}`;
          复刻技能.魂技名 = 复刻技能.name;
          写入战斗来源类别上下文(复刻技能, { 来源类别: '状态授予技能', 来源明细: 状态名 });
          复刻技能.__复制状态名 = 状态名;
          复刻技能.__复制状态技能键 = 技能键;
          if (剩余次数 !== undefined) 复刻技能.__复刻可用次数 = 剩余次数;
          const 是否被动 = isPassiveSkillData(复刻技能);
          if (是否被动 && !collectOptions.includePassive) return;
          if (!是否被动 && !collectOptions.includeActive) return;
          skills.push(复刻技能);
        });
      });

      Object.entries(charData?.状态效果 || {}).forEach(([状态名, 状态]) => {
        if (!状态 || Number(状态.duration ?? 1) <= 0 || 状态.效果授予状态 !== true && 状态.战斗效果?.mechanism_grant !== true) return;
        if (String(状态.触发条件 || '').trim() !== '主动触发') return;
        const 授予机制候选 = { ...状态, key: 状态名, name: 状态名, 原型: '机制授予' };
        const 移除规则 = 战斗机制抹消命中(charData, '中间机制', 授予机制候选, { 用途: '移除', 消费: false });
        if (移除规则) {
          delete charData.状态效果[状态名];
          if (charData.召唤键) 同步召唤单位镜像(charData);
          return;
        }
        if (战斗机制抹消命中(charData, '中间机制', 授予机制候选, { 用途: '封锁', 消费: false })) return;
        const 剩余次数 = Math.max(0, Math.floor(Number(状态.可用次数 ?? 1)));
        if (剩余次数 <= 0) return;
        const 原效果列表 = (Array.isArray(状态.授予效果) ? 状态.授予效果 : [])
          .filter(effect => effect && typeof effect === 'object')
          .filter(effect =>
            !战斗机制抹消命中(charData, '中间机制', effect, { 用途: '移除', 消费: false }) &&
            !战斗机制抹消命中(charData, '中间机制', effect, { 用途: '封锁', 消费: false }),
          );
        if (!原效果列表.length) return;
        const 临时技能名 = String(状态.来源技能 || 状态.name || 状态名.replace(/^原型授予[:：]?/, '') || '临时机制').trim() || '临时机制';
        const 临时技能 = normalizeSkillData({
          name: `授予·${临时技能名}`,
          魂技名: `授予·${临时技能名}`,
          技能分类: '辅助',
          消耗: '无',
          前摇: 10,
          _效果数组: 原效果列表.map(effect => ({
            ...cloneBattleValue(effect),
            __机制授予主动触发: true,
            __机制授予状态名: 状态名,
          })),
        }, `授予·${临时技能名}`);
        写入战斗来源类别上下文(临时技能, { 来源类别: '状态授予技能', 来源明细: 状态名 });
        临时技能.__机制授予主动技能 = true;
        临时技能.__机制授予状态名 = 状态名;
        临时技能.__机制授予剩余次数 = 剩余次数;
        skills.push(临时技能);
      });

      Object.entries(charData?.武魂融合技 || {}).forEach(([fusionName, fusionSkill]) => {
        const 融合可用性 = 获取融合技能可用性(charData, fusionSkill, alliedTeam);
        if (!融合可用性.可用 && !collectOptions.includeUnavailableFusion) return;
        const 技能项 = buildFusionCombatSkill(fusionSkill, fusionName, charData);
        技能项.__融合可用 = !!融合可用性.可用;
        技能项.__融合不可用原因 = String(融合可用性.原因 || '');
        技能项.__融合相关度总分 = Number(融合可用性.相关度总分 || 技能项.__融合相关度总分 || 0);
        技能项.__融合队友列表 = Array.isArray(alliedTeam) ? alliedTeam : [];
        const 是否被动 = isPassiveSkillData(技能项);
        if (是否被动 && !collectOptions.includePassive) return;
        if (!是否被动 && !collectOptions.includeActive) return;
        skills.push(技能项);
      });

      return skills;
    }

    function collectPassiveCombatSkills(charData, alliedTeam = []) {
      return collectUnifiedSkillEntries(charData, alliedTeam, { includePassive: true, includeActive: false });
    }

    const AUTO_PROJECTED_CONDITION_PREFIX = '__auto__:';

    function clearAutoProjectedConditions(char) {
      if (!char?.状态效果) return;
      Object.keys(char.状态效果).forEach(key => {
        if (String(key).startsWith(AUTO_PROJECTED_CONDITION_PREFIX)) delete char.状态效果[key];
      });
    }

    function createProjectedCondition(description, type = 'buff', statMods = {}, combatEffects = {}, duration = 999) {
      return {
        类型: type,
        层数: 1,
        描述: description || '自动投影效果',
        duration,
        面板修改比例: {
          str: Number(statMods.str ?? 1),
          def: Number(statMods.def ?? 1),
          agi: Number(statMods.agi ?? 1),
          sp_max: Number(statMods.sp_max ?? 1),
          vit_max: Number(statMods.vit_max ?? 1),
          men_max: Number(statMods.men_max ?? 1),
        },
        战斗效果: mergeCombatEffectMaps(createEmptyCombatEffectMap(), combatEffects || {}),
      };
    }

    function projectPassiveSkillToConditions(char, skill) {
      if (!char?.状态效果 || !skill) return;
      const sourceName = skill.name || skill.技能名称 || '被动技能';
      getSkillEffects(skill).forEach((effect, index) => {
        const 原型 = String(effect?.原型 || '').trim();
        if (!原型 || !BATTLE_PROTOTYPE_REGISTRY[原型]) return;
        if (原型 === '状态施加' && effect?.状态 && effect.状态 !== '无') {
          const specialFlag = effect.特殊机制标识 || '无';
          const calc = effect.计算层效果 || {};
          const 状态名 = String(effect.状态 || '').trim();
          const isBuff =
            /增益|真身|被动/.test(specialFlag) ||
            Number(calc.hit_bonus || 0) > 0 ||
            Number(calc.reaction_bonus || 0) > 0 ||
            Number(calc.dodge_bonus || 0) > 0 ||
            Number(calc.defense_strip || 0) > 0 ||
            Number(calc.spirit_resist_strip || 0) > 0 ||
            Number(calc.final_heal_mult || 1) > 1 ||
            Number(calc.final_damage_mult || 1) > 1 ||
            calc.super_armor === true ||
            calc.探查屏蔽 === true ||
            Number(calc.min_hp_floor || 0) > 0;
          char.状态效果[`${AUTO_PROJECTED_CONDITION_PREFIX}${sourceName}:${状态名}`] =
            createProjectedCondition(
              `自动投影[${sourceName}]`,
              isBuff ? 'buff' : 'debuff',
              effect.面板修改比例 || {},
              calc,
              999,
            );
          if (effect.面板固定修正 && typeof effect.面板固定修正 === 'object') {
            char.状态效果[`${AUTO_PROJECTED_CONDITION_PREFIX}${sourceName}:${状态名}`].面板固定修正 = {
              ...effect.面板固定修正,
            };
          }
          return;
        }
        if (
          原型 === '属性修正' &&
          ((effect?.面板修改比例 && typeof effect.面板修改比例 === 'object') ||
            (effect?.面板固定修正 && typeof effect.面板固定修正 === 'object'))
        ) {
          const mult = 1 + Math.max(0, Number(effect.强化值 || 0));
          char.状态效果[`${AUTO_PROJECTED_CONDITION_PREFIX}${sourceName}:属性永久强化:${index}`] =
            createProjectedCondition(
              `自动投影[${sourceName}]·属性永久强化`,
              'buff',
              effect.面板修改比例 || { str: mult, def: mult, agi: mult, sp_max: mult, vit_max: mult, men_max: mult },
              {},
              999,
            );
          if (effect.面板固定修正 && typeof effect.面板固定修正 === 'object') {
            char.状态效果[`${AUTO_PROJECTED_CONDITION_PREFIX}${sourceName}:属性永久强化:${index}`].面板固定修正 = {
              ...effect.面板固定修正,
            };
          }
        }
      });
      const runtimeEffect = createEmptyCombatEffectMap();
      applyRuntimeMechanismEffects(skill, char, char, char, char, runtimeEffect);
      if (hasMeaningfulCombatEffect(runtimeEffect)) {
        char.状态效果[`${AUTO_PROJECTED_CONDITION_PREFIX}${sourceName}:原型投影`] = createProjectedCondition(
          `自动投影[${sourceName}]·原型效果`,
          'buff',
          {},
          runtimeEffect,
          999,
        );
      }
    }

    function getActiveStructuredDomain(char) {
      if (!char || typeof char !== 'object') return null;
      const domain = char.精神领域 || {};
      const modifiers = domain.战斗修饰 || {};
      const enabled = Object.values(modifiers).some(mod => mod?.启用);
      const isActive =
        !!domain.进行中 || String(char.当前领域 || char.状态?.当前领域 || '').includes('精神领域');
      if (!enabled || !isActive) return null;
      return { name: domain.名称 || '精神领域', modifiers };
    }

    function buildDomainSuppressionStatMods(targetStat = 'all', reduceRatio = 0.3) {
      const mult = Math.max(0.05, 1 - Math.max(0, Number(reduceRatio || 0)));
      const mods = { str: 1, def: 1, agi: 1, sp_max: 1, vit_max: 1, men_max: 1 };
      if (targetStat === 'all') return { str: mult, def: mult, agi: mult, sp_max: mult, vit_max: mult, men_max: mult };
      const keyMap = {
        str: 'str',
        def: 'def',
        agi: 'agi',
        sp: 'sp_max',
        sp_max: 'sp_max',
        vit: 'vit_max',
        vit_max: 'vit_max',
        men: 'men_max',
        men_max: 'men_max',
      };
      const mapped = keyMap[targetStat] || null;
      if (mapped) mods[mapped] = mult;
      return mods;
    }

    function resolveArmorDomainDescriptor(char) {
      const activeDomainText = String(char?.当前领域 || char?.状态?.当前领域 || '');
      if (!activeDomainText.includes('斗铠领域')) return null;

      const isFourWord = activeDomainText.includes('四字');
      const ratio = isFourWord ? 1.2 : 1.1;
      const requiredCount = isFourWord ? 2 : 1;
      const attrPool = ['sp_max', 'men_max', 'str', 'def', 'agi', 'vit_max'];
      const bracketMatch = activeDomainText.match(/\[([^\]]+)\]/);
      let selectedAttrs = bracketMatch
        ? bracketMatch[1]
            .split(/[，,]/)
            .map(attr => String(attr || '').trim())
            .filter(attr => attrPool.includes(attr))
        : [];

      if (selectedAttrs.length > requiredCount) selectedAttrs = selectedAttrs.slice(0, requiredCount);

      if (activeDomainText.includes('未定') || selectedAttrs.length < requiredCount) {
        const remaining = [...attrPool];
        selectedAttrs = [];
        while (selectedAttrs.length < requiredCount && remaining.length > 0) {
          const index = Math.floor(Math.random() * remaining.length);
          selectedAttrs.push(remaining.splice(index, 1)[0]);
        }
        char.当前领域 = isFourWord
          ? `【四字斗铠领域】全开[${selectedAttrs.join(',')}]`
          : `【三字斗铠领域】全开[${selectedAttrs.join(',')}]`;
      }

      return {
        name: String(char.当前领域 || char?.状态?.当前领域 || activeDomainText),
        ratio,
        selectedAttrs,
      };
    }

    function projectDomainConditionsForParticipant(char, opposingTeam = []) {
      if (!char?.状态效果) return;
      const armorDomain = resolveArmorDomainDescriptor(char);
      if (armorDomain) {
        const statMods = { str: 1, def: 1, agi: 1, sp_max: 1, vit_max: 1, men_max: 1 };
        armorDomain.selectedAttrs.forEach(attr => {
          statMods[attr] = armorDomain.ratio;
        });
        char.状态效果[`${AUTO_PROJECTED_CONDITION_PREFIX}斗铠领域:${armorDomain.name}`] = createProjectedCondition(
          `自动投影[${armorDomain.name}]·斗铠增幅`,
          'buff',
          statMods,
          {},
          999,
        );
      }

      const ownDomain = getActiveStructuredDomain(char);
      if (ownDomain) {
        const selfEffects = createEmptyCombatEffectMap();
        const ownMods = ownDomain.modifiers;
        if (ownMods.条件闪避?.启用) {
          const compareStat = ownMods.条件闪避.比对属性 || 'men';
          const selfValue = getMechanismDriveValue(char, char.final || char, compareStat);
          const maxEnemy = Math.max(
            0,
            ...(opposingTeam || []).map(unit => getMechanismDriveValue(unit, unit.final || unit, compareStat)),
          );
          const maxRatio = Math.max(1, Number(ownMods.条件闪避.最大倍率 || 1.5));
          if (maxEnemy <= selfValue * maxRatio) {
            selfEffects.dodge_bonus += 0.25;
            selfEffects.reaction_bonus += 0.1;
          }
        }
        if (ownMods.必中真伤?.启用) {
          const ratio = Math.max(0, Number(ownMods.必中真伤.真伤比例 || 0.1));
          selfEffects.hit_bonus += 0.12;
          selfEffects.lock_level = Math.max(Number(selfEffects.lock_level || 0), 1);
          selfEffects.final_damage_mult *= 1 + Math.min(0.35, ratio);
          selfEffects.bonus_true_damage_ratio += ratio;
        }
        if (ownMods.灵魂汲取?.启用) {
          selfEffects.damage_absorb_ratio += Math.max(0, Math.min(1, Number(ownMods.灵魂汲取.汲取比例 || 0.5)));
        }
        if (hasMeaningfulCombatEffect(selfEffects)) {
          char.状态效果[`${AUTO_PROJECTED_CONDITION_PREFIX}领域:${ownDomain.name}:自我法则`] =
            createProjectedCondition(`自动投影[${ownDomain.name}]·自我法则`, 'buff', {}, selfEffects, 999);
        }
      }

      (opposingTeam || []).forEach(enemy => {
        const enemyDomain = getActiveStructuredDomain(enemy);
        if (!enemyDomain) return;
        const mods = enemyDomain.modifiers;
        const effectMap = createEmptyCombatEffectMap();
        let statMods = { str: 1, def: 1, agi: 1, sp_max: 1, vit_max: 1, men_max: 1 };
        if (mods.属性压制?.启用)
          statMods = buildDomainSuppressionStatMods(
            mods.属性压制.目标属性 || 'all',
            mods.属性压制.削弱比例 || 0.3,
          );
        if (mods.时间迟滞?.启用) {
          const mult = Math.max(1, Number(mods.时间迟滞.蓄力倍率 || 2));
          effectMap.reaction_penalty += Math.min(0.45, (mult - 1) * 0.2);
          effectMap.cast_speed_penalty += Math.min(2, mult - 1);
          effectMap.dodge_penalty += Math.min(0.2, (mult - 1) * 0.08);
        }
        if (mods.幻境偏移?.启用) {
          const chance = Math.max(0, Math.min(0.9, Number(mods.幻境偏移.偏移概率 || 0.4)));
          effectMap.hit_penalty += Number((chance * 0.5).toFixed(2));
          effectMap.reaction_penalty += Number((chance * 0.2).toFixed(2));
          effectMap.reaction_penalty += Number((chance * 0.15).toFixed(2));
        }
        if (hasMeaningfulCombatEffect(effectMap) || Object.values(statMods).some(v => Number(v || 1) !== 1)) {
          char.状态效果[
            `${AUTO_PROJECTED_CONDITION_PREFIX}领域压制:${enemy.name || enemyDomain.name}:${char.name || '目标'}`
          ] = createProjectedCondition(`自动投影[${enemyDomain.name}]·领域压制`, 'debuff', statMods, effectMap, 999);
        }
      });
    }

    // ===== Phase E: 体力疲劳 + 全属性衰减 =====
    // 设计:
    //   1. 任何主动行动消耗基础行动疲劳, 按行动类型分级 (见 行动疲劳率表_V1)
    //   2. 体力比例越低, 全属性 (str/def/agi 6 维) 衰减越严重
    //   3. 体力 = 0 → 已有"昏迷 KO"判定接管
    const 体力衰减分段表_V1 = Object.freeze([
      { 比例下界: 0.50, 系数: 1.00 },  // ≥ 50% 充沛
      { 比例下界: 0.30, 系数: 0.90 },  // 30-50% 疲劳
      { 比例下界: 0.15, 系数: 0.75 },  // 15-30% 力竭
      { 比例下界: 0.00, 系数: 0.50 },  // 0-15% 濒崩
    ]);

    // 行动疲劳率表 — 体力 = 肉体动作能量, 物理动作扣得多, 纯施法扣得少
    // 优先级: action_type 命中纯操作型 > 装备激活 > 召唤/维持极低 > 控制/治疗/辅助低 > 输出按品质
    const 行动疲劳率表_V1 = Object.freeze({
      // 纯操作型动作 (无 skill 对应, action_type 直接命中)
      '待机':         0.003,
      '调息':         0.003,
      '稳态调整':     0.005,
      '防御':         0.012,  // 格挡仍消耗
      '移动':         0.015,
      '位移':         0.015,
      '普通攻击':     0.030,
      '攻击':         0.030,
      '闪避':         0.040,  // 高敏捷动作
    });
    // 按 skill 谓词分级 (体力消耗 = 物理动作强度, 不是技能强度)
    const 行动疲劳率_装备激活_V1 = 0.025;
    const 行动疲劳率_召唤_V1 = 0.003;        // 站着施法, 几乎不耗
    const 行动疲劳率_维持_V1 = 0.003;        // 只消耗魂力
    const 行动疲劳率_控制治疗辅助_V1 = 0.005;  // 精神力/魂力主导
    const 行动疲劳率_输出基础_V1 = 0.040;     // 普通攻击型魂技
    const 行动疲劳率_输出高品质_V1 = 0.070;   // 风险等级=高 大招
    const 行动疲劳率_输出融合技_V1 = 0.120;   // 武魂融合技, 物理+魂力双重
    const 行动疲劳率默认_V1 = 0.020;

    function 计算体力衰减系数_V1(单位 = {}) {
      const stats = 单位?.属性 || 单位 || {};
      const 体力上限 = Math.max(1, Number(stats.体力上限 ?? stats.vit_max ?? 1));
      const 当前体力 = Math.max(0, Number(stats.体力 ?? stats.vit ?? 0));
      const 比例 = 当前体力 / 体力上限;
      for (const 段 of 体力衰减分段表_V1) {
        if (比例 >= 段.比例下界) return 段.系数;
      }
      return 体力衰减分段表_V1[体力衰减分段表_V1.length - 1].系数;
    }

    // 解析 parsed 的行动类型, 返回疲劳率 (% 体力上限)
    function 推断行动疲劳率_V1(parsed = {}) {
      const 来源类别 = String(parsed?.__来源类别 || '').trim();
      const 风险等级 = String(parsed?.__风险等级 || '').trim();
      const action_type = String(parsed?.__action_type || '').trim();
      const 是输出 = !!parsed?.__是输出;
      const 是控制 = !!parsed?.__是控制;
      const 是治疗 = !!parsed?.__是治疗;
      const 是防护 = !!parsed?.__是防护;
      const 是召唤 = !!parsed?.__是召唤;
      const 是维持 = !!parsed?.__是维持;
      // 1. 纯操作型动作 (无 skill, action_type 命中) — 闪避 / 移动 / 待机 / 普通攻击 / 防御
      if (行动疲劳率表_V1[action_type] !== undefined) return 行动疲劳率表_V1[action_type];
      // 2. 装备激活 — 穿戴动作, 中等物理消耗
      if (来源类别 === '装备技能') return 行动疲劳率_装备激活_V1;
      // 3. 召唤 — 站着施法, 几乎不耗体力
      if (是召唤) return 行动疲劳率_召唤_V1;
      // 4. 维持类 — 持续状态, 只消耗魂力
      if (是维持 && !是输出) return 行动疲劳率_维持_V1;
      // 5. 控制 / 治疗 / 防护 — 精神力/魂力主导, 体力极低耗
      if ((是控制 || 是治疗 || 是防护) && !是输出) return 行动疲劳率_控制治疗辅助_V1;
      // 6. 输出类 — 物理动作强度, 按品质细分
      if (是输出) {
        if (来源类别 === '武魂融合技') return 行动疲劳率_输出融合技_V1;
        if (风险等级 === '高') return 行动疲劳率_输出高品质_V1;
        return 行动疲劳率_输出基础_V1;
      }
      // 7. 默认 (混合 / 不明类型)
      return 行动疲劳率默认_V1;
    }

    function 计算行动疲劳体力_V1(单位 = {}, parsed = {}) {
      const stats = 单位?.属性 || 单位 || {};
      const 体力上限 = Math.max(1, Number(stats.体力上限 ?? stats.vit_max ?? 1));
      const 疲劳率 = 推断行动疲劳率_V1(parsed);
      return Math.max(1, Math.round(体力上限 * 疲劳率));
    }

    function refreshParticipantProjectedState(char, alliedTeam = [], opposingTeam = []) {
      if (!char) return char;
      bindCombatParticipant(char);
      clearAutoProjectedConditions(char);
      collectPassiveCombatSkills(char, alliedTeam).forEach(skill => projectPassiveSkillToConditions(char, skill));
      projectDomainConditionsForParticipant(char, opposingTeam);
      char.final = BATTLE_RUNTIME.buildCombatFinalStats(char);
      return char;
    }

    function applyStateToCharacter(targetChar, stateModule, sourceName, forceBuff) {
      if (!targetChar || !stateModule || !stateModule.状态名称 || stateModule.状态名称 === '无') return false;
      if (!targetChar.状态效果) targetChar.状态效果 = {};

      const specialFlag = stateModule.特殊机制标识 || '无';
      const calc = stateModule.计算层效果 || {};
      const hasPositiveCalc =
        Number(calc.hit_bonus || 0) > 0 ||
        Number(calc.reaction_bonus || 0) > 0 ||
        Number(calc.dodge_bonus || 0) > 0 ||
        Number(calc.vit_gain_ratio || 0) > 0 ||
        Number(calc.sp_gain_ratio || 0) > 0 ||
        Number(calc.men_gain_ratio || 0) > 0 ||
        Number(calc.final_heal_mult || 1.0) > 1.0 ||
        Number(calc.shield_gain_mult || 1.0) > 1.0 ||
        Number(calc.hot_heal_ratio || 0) > 0 ||
        calc.invincible === true ||
        calc.super_armor === true ||
        calc.探查屏蔽 === true ||
        Number(calc.min_hp_floor || 0) > 0 ||
        Number(calc.revive_count || 0) > 0;
      const isBuff =
        forceBuff === true || hasPositiveCalc || specialFlag.includes('增益') || specialFlag.includes('真身');
      if (!isBuff && 探查屏蔽阻断敌对锁定状态(targetChar, stateModule)) return false;

      const 状态条目 = {
        类型: isBuff ? 'buff' : 'debuff',
        层数: 1,
        描述: `由[${sourceName || stateModule.状态名称}]附加`,
        duration: stateModule.持续回合 || 0,
        面板修改比例: stateModule.面板修改比例 || { str: 1.0, def: 1.0, agi: 1.0, sp_max: 1.0 },
        战斗效果: {
          ...mergeCombatEffectMaps(createEmptyCombatEffectMap(), stateModule.计算层效果 || {}),
          skip_turn: stateModule.计算层效果?.skip_turn ?? false,
          cannot_react: stateModule.计算层效果?.cannot_react ?? false,
          invincible: stateModule.计算层效果?.invincible ?? false,
          skill_seal: stateModule.计算层效果?.skill_seal ?? false,
          silence: stateModule.计算层效果?.silence ?? false,
          disarm: stateModule.计算层效果?.disarm ?? false,
          blind: stateModule.计算层效果?.blind ?? false,
          探查屏蔽: stateModule.计算层效果?.探查屏蔽 ?? false,
          dot_damage: (stateModule.计算层效果?.dot_damage ?? stateModule.持续真伤dot) || 0,
          armor_pen: stateModule.计算层效果?.armor_pen ?? 0,
          reaction_bonus: stateModule.计算层效果?.reaction_bonus ?? 0,
          reaction_penalty: stateModule.计算层效果?.reaction_penalty ?? 0,
          attacker_speed_bonus: stateModule.计算层效果?.attacker_speed_bonus ?? 0,
          cast_speed_bonus: stateModule.计算层效果?.cast_speed_bonus ?? 0,
          cast_speed_penalty: stateModule.计算层效果?.cast_speed_penalty ?? 0,
          hit_bonus: stateModule.计算层效果?.hit_bonus ?? 0,
          hit_penalty: stateModule.计算层效果?.hit_penalty ?? 0,
          dodge_bonus: stateModule.计算层效果?.dodge_bonus ?? 0,
          dodge_penalty: stateModule.计算层效果?.dodge_penalty ?? 0,
          lock_level: stateModule.计算层效果?.lock_level ?? 0,
          interrupt_bonus: stateModule.计算层效果?.interrupt_bonus ?? 0,
          final_damage_mult: stateModule.计算层效果?.final_damage_mult ?? 1.0,
          received_damage_mult: stateModule.计算层效果?.received_damage_mult ?? 1.0,
          defense_strip: stateModule.计算层效果?.defense_strip ?? 0,
          spirit_resist_strip: stateModule.计算层效果?.spirit_resist_strip ?? 0,
          final_damage_bonus: stateModule.计算层效果?.final_damage_bonus ?? 0,
          final_heal_mult: stateModule.计算层效果?.final_heal_mult ?? 1.0,
          final_heal_bonus: stateModule.计算层效果?.final_heal_bonus ?? 0,
          shield_gain_mult: stateModule.计算层效果?.shield_gain_mult ?? 1.0,
          shield_gain_bonus: stateModule.计算层效果?.shield_gain_bonus ?? 0,
          vit_gain_ratio: stateModule.计算层效果?.vit_gain_ratio ?? 0,
          sp_gain_ratio: stateModule.计算层效果?.sp_gain_ratio ?? 0,
          men_gain_ratio: stateModule.计算层效果?.men_gain_ratio ?? 0,
          heal_block_ratio: stateModule.计算层效果?.heal_block_ratio ?? 0,
          hot_heal_ratio: stateModule.计算层效果?.hot_heal_ratio ?? 0,
          cost_ratio: stateModule.计算层效果?.cost_ratio ?? 1.0,
          cost_delta: stateModule.计算层效果?.cost_delta ?? 0,
          cost_delta_ratio: stateModule.计算层效果?.cost_delta_ratio ?? 0,
          windup_ratio: stateModule.计算层效果?.windup_ratio ?? 1.0,
          windup_delta: stateModule.计算层效果?.windup_delta ?? 0,
          stealth_level: stateModule.计算层效果?.stealth_level ?? 0,
          min_hp_floor: stateModule.计算层效果?.min_hp_floor ?? 0,
          death_save_count: stateModule.计算层效果?.death_save_count ?? 0,
          revive_count: stateModule.计算层效果?.revive_count ?? 0,
          revive_heal_ratio: stateModule.计算层效果?.revive_heal_ratio ?? 0,
          damage_reflect_ratio: stateModule.计算层效果?.damage_reflect_ratio ?? 0,
          damage_transfer_ratio: stateModule.计算层效果?.damage_transfer_ratio ?? 0,
          damage_transfer_target: stateModule.计算层效果?.damage_transfer_target ?? '',
          damage_share_ratio: stateModule.计算层效果?.damage_share_ratio ?? 0,
          damage_share_count: stateModule.计算层效果?.damage_share_count ?? 0,
          cost_share_ratio: stateModule.计算层效果?.cost_share_ratio ?? 0,
          cost_share_count: stateModule.计算层效果?.cost_share_count ?? 0,
          heal_inversion_ratio: stateModule.计算层效果?.heal_inversion_ratio ?? 0,
          invincible_tier_threshold: stateModule.计算层效果?.invincible_tier_threshold ?? 0,
          每日触发次数上限: stateModule.计算层效果?.每日触发次数上限 ?? 0,
          bonus_true_damage_ratio: stateModule.计算层效果?.bonus_true_damage_ratio ?? 0,
          damage_absorb_ratio: stateModule.计算层效果?.damage_absorb_ratio ?? 0,
          damage_to_heal_ratio: stateModule.计算层效果?.damage_to_heal_ratio ?? 0,
          heal_to_damage_ratio: stateModule.计算层效果?.heal_to_damage_ratio ?? 0,
          吸收来源: stateModule.计算层效果?.吸收来源 ?? '',
          吸收资源: stateModule.计算层效果?.吸收资源 ?? '',
          吸收转化效果: stateModule.计算层效果?.吸收转化效果 ?? '',
          伤害吸收增幅上限: stateModule.计算层效果?.伤害吸收增幅上限 ?? 0,
        },
      };
      if (stateModule.原型) 状态条目.来源原型 = stateModule.原型;
      const 持续移除命中 = 持续状态移除阻断状态附着(targetChar, stateModule.状态名称, 状态条目, sourceChar || targetChar);
      if (持续移除命中) return false;
      targetChar.状态效果[stateModule.状态名称] = 状态条目;
      targetChar.final = BATTLE_RUNTIME.buildCombatFinalStats(targetChar);
      if (targetChar.召唤键) 同步召唤单位镜像(targetChar);
      return true;
    }

    function 登记遥控状态效果(targetChar, stateEffect = {}, sourceName = '') {
      if (!targetChar || !stateEffect || typeof stateEffect !== 'object') return '';
      const 状态名 = String(stateEffect?.状态名称 || stateEffect?.状态 || '').trim();
      if (!状态名) return '';
      if (!targetChar.状态效果 || typeof targetChar.状态效果 !== 'object') targetChar.状态效果 = {};
      const 持续回合 = Math.max(1, Number(stateEffect?.持续回合 || 3));
      const 状态键基础 = `遥控:${状态名}`;
      let 状态键 = 状态键基础;
      let 序号 = 2;
      while (targetChar.状态效果[状态键]) {
        状态键 = `${状态键基础}·${序号}`;
        序号 += 1;
      }
      const 遥控效果 = cloneBattleValue(stateEffect);
      遥控效果.触发方式 = '立即触发';
      delete 遥控效果.延迟回合;
      targetChar.状态效果[状态键] = {
        类型: targetChar === stateEffect.__施术者 ? 'buff' : 'debuff',
        层数: 1,
        描述: `由[${sourceName || '技能'}]预置，等待遥控触发`,
        duration: 持续回合,
        遥控触发: true,
        遥控效果,
        面板修改比例: { str: 1, def: 1, agi: 1, sp_max: 1 },
        战斗效果: createEmptyCombatEffectMap(),
      };
      return 状态键;
    }

    function 触发遥控状态效果(触发者 = {}, 目标 = {}, 输入文本 = '', sourceName = '遥控触发') {
      const 单位列表 = dedupeCombatTargetList([触发者, 目标]);
      const 文本 = String(输入文本 || '').trim();
      if (!/触发|发动|引爆|引动|激活/.test(文本)) return { 日志: '', 触发数: 0 };
      const 日志 = [];
      let 触发数 = 0;
      单位列表.forEach(单位 => {
        if (!单位?.状态效果 || typeof 单位.状态效果 !== 'object') return;
        Object.entries({ ...单位.状态效果 }).forEach(([状态键, 状态]) => {
          if (!状态?.遥控触发 || !状态?.遥控效果) return;
          const 状态名 = String(状态?.遥控效果?.状态名称 || 状态?.遥控效果?.状态 || 状态键).trim();
          if (状态名 && !文本.includes(状态名) && !文本.includes(状态键) && !/遥控|预置/.test(文本)) return;
          const effect = cloneBattleValue(状态.遥控效果);
          delete 单位.状态效果[状态键];
          if (applyStateToCharacter(单位, effect, sourceName, 单位 === 触发者)) {
            触发数 += 1;
            日志.push(`[遥控触发] ${单位.name || 单位.名称 || '目标'}的[${状态名}]被触发。`);
          }
        });
      });
      return { 日志: 日志.join(' '), 触发数 };
    }

    function dedupeCombatTargetList(units = []) {
      const seen = new Set();
      const result = [];
      (Array.isArray(units) ? units : []).forEach(unit => {
        if (!unit) return;
        const identity = String(unit?.召唤键 || unit?.name || unit?.名称 || '').trim() || JSON.stringify([unit?.type, unit?.vit_max, unit?.str]);
        if (!identity || seen.has(identity)) return;
        seen.add(identity);
        result.push(unit);
      });
      return result;
    }

    function 读取召唤类型配置(类型 = '') {
      const 名称 = String(类型 || '魂兽').trim() || '魂兽';
      const 配置表 = {
        分身: { 属性系数: 1, 资源系数: 1, 生命系数: 0.9, 负载系数: 1.6, 默认行动模式: '自主行动' },
        本命召唤兽: { 属性系数: 1.1, 资源系数: 1.05, 生命系数: 1.1, 负载系数: 1.35, 默认行动模式: '自主行动' },
        魂兽: { 属性系数: 0.95, 资源系数: 0.9, 生命系数: 1.15, 负载系数: 1, 默认行动模式: '自主行动' },
        深渊生物: { 属性系数: 1.05, 资源系数: 0.95, 生命系数: 1, 负载系数: 1.4, 默认行动模式: '自主行动' },
        魂师: { 属性系数: 1, 资源系数: 1, 生命系数: 1, 负载系数: 1.8, 默认行动模式: '自主行动' },
        其他召唤生物: { 属性系数: 0.85, 资源系数: 0.8, 生命系数: 0.95, 负载系数: 0.8, 默认行动模式: '协同攻击' },
      };
      return { 名称, ...(配置表[名称] || 配置表.魂兽) };
    }

    function 读取行动模式负载系数(行动模式 = '') {
      const 文本 = String(行动模式 || '').trim();
      if (文本 === '自主行动') return 1.35;
      if (文本 === '护卫') return 1.1;
      return 0.85;
    }

    function 读取召唤生命系数(行动模式 = '') {
      const 文本 = String(行动模式 || '').trim();
      if (文本 === '护卫') return 1.25;
      if (文本 === '协同攻击') return 0.9;
      return 1;
    }

    function 读取召唤宿主阵营(combatData = {}, 宿主 = {}) {
      const 玩家侧 = (combatData?.参战者?.team_player || []).filter(Boolean);
      const 敌方侧 = (combatData?.参战者?.team_enemy || []).filter(Boolean);
      const 名称 = String(宿主?.name || 宿主?.名称 || '').trim();
      if (玩家侧.some(unit => unit && (unit === 宿主 || isCombatUnitIdentityMatch(unit, 名称)))) return '玩家';
      if (敌方侧.some(unit => unit && (unit === 宿主 || isCombatUnitIdentityMatch(unit, 名称)))) return '敌方';
      return '玩家';
    }

    function 确保召唤单位表(combatData = {}) {
      if (!combatData || typeof combatData !== 'object') return {};
      if (!combatData.召唤单位表 || typeof combatData.召唤单位表 !== 'object' || Array.isArray(combatData.召唤单位表)) {
        Object.defineProperty(combatData, '召唤单位表', {
          configurable: true,
          enumerable: false,
          writable: true,
          value: {},
        });
      }
      const 参战者 = combatData.参战者 || {};
      const 宿主列表 = dedupeCombatTargetList([
        ...((参战者.team_player || []).filter(Boolean)),
        ...((参战者.team_enemy || []).filter(Boolean)),
      ]);
      宿主列表.forEach(宿主 => {
        Object.entries(宿主?.状态效果 || {}).forEach(([来源状态键, 状态]) => {
          if (!状态?.召唤物 || 状态.召唤物.已消散 === true) return;
          注册召唤运行态单位(combatData, 宿主, 来源状态键, 状态, { 静默: true });
        });
      });
      return combatData.召唤单位表;
    }

    function 读取召唤单位列表(combatData = {}, 筛选 = {}) {
      const 表 = 确保召唤单位表(combatData);
      return Object.values(表).filter(单位 => {
        if (!单位 || 单位.已消散 === true) return false;
        if (筛选.阵营 && 单位.阵营 !== 筛选.阵营) return false;
        if (筛选.宿主 && !isCombatUnitIdentityMatch({ name: 单位.宿主名 }, 筛选.宿主?.name || 筛选.宿主?.名称 || 筛选.宿主)) return false;
        if (筛选.行动模式 && String(单位.行动模式 || '').trim() !== String(筛选.行动模式 || '').trim()) return false;
        return true;
      });
    }

    function 读取召唤收回锁键(宿主 = {}, 类型 = '', 名称 = '') {
      const 宿主名 = String(宿主?.name || 宿主?.名称 || '宿主').trim() || '宿主';
      return `${宿主名}::${String(类型 || '').trim()}::${String(名称 || '').trim()}`;
    }

    function 确保召唤收回锁(combatData = {}) {
      if (!combatData || typeof combatData !== 'object') return [];
      if (!Array.isArray(combatData.召唤收回锁)) combatData.召唤收回锁 = [];
      return combatData.召唤收回锁;
    }

    function 召唤已被主动收回(combatData = {}, 宿主 = {}, 类型 = '', 名称 = '') {
      return 确保召唤收回锁(combatData).includes(读取召唤收回锁键(宿主, 类型, 名称));
    }

    function 读取召唤编号基名(名称 = '') {
      return String(名称 || '召唤物').trim().replace(/#\d+$/, '') || '召唤物';
    }

    function 读取下一个召唤编号(combatData = {}, 宿主 = {}, 类型 = '', 基名 = '') {
      const 基础名 = 读取召唤编号基名(基名);
      const 宿主名 = String(宿主?.name || 宿主?.名称 || '宿主').trim() || '宿主';
      const 已用编号 = new Set();
      读取召唤单位列表(combatData, { 宿主 }).forEach(单位 => {
        if (String(单位?.类型 || '').trim() !== String(类型 || '').trim()) return;
        const 名称 = String(单位?.name || 单位?.名称 || '').trim();
        const 匹配 = 名称.match(new RegExp(`^${基础名.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}#(\\d+)$`));
        if (匹配) 已用编号.add(Number(匹配[1]));
      });
      确保召唤收回锁(combatData).forEach(锁键 => {
        const 前缀 = `${宿主名}::${String(类型 || '').trim()}::${基础名}#`;
        if (!String(锁键 || '').startsWith(前缀)) return;
        const 编号 = Number(String(锁键).slice(前缀.length));
        if (Number.isFinite(编号) && 编号 > 0) 已用编号.add(编号);
      });
      let 编号 = 1;
      while (已用编号.has(编号)) 编号 += 1;
      return 编号;
    }

    function 写入召唤收回锁(combatData = {}, 召唤单位 = {}) {
      const 锁 = 确保召唤收回锁(combatData);
      const 锁键 = 读取召唤收回锁键(召唤单位.__宿主, 召唤单位.类型, 召唤单位.name || 召唤单位.名称);
      if (锁键 && !锁.includes(锁键)) 锁.push(锁键);
    }

    function 读取战斗阵营单位列表(combatData = {}, 阵营 = '玩家') {
      const 基础列表 = 读取战斗主队单位列表(combatData, 阵营);
      return dedupeCombatTargetList([...基础列表, ...读取召唤单位列表(combatData, { 阵营 })]).filter(isCombatUnitAlive);
    }

    function 读取战斗主队单位列表(combatData = {}, 阵营 = '玩家') {
      const 参战者 = combatData?.参战者 || {};
      const 基础列表 = 阵营 === '敌方'
        ? (参战者.team_enemy || []).filter(Boolean)
        : (参战者.team_player || []).filter(Boolean);
      return dedupeCombatTargetList(基础列表.filter(Boolean));
    }

    function 读取召唤属性继承比例(召唤记录 = {}) {
      const 继承 = 召唤记录?.属性继承比例 && typeof 召唤记录.属性继承比例 === 'object' && !Array.isArray(召唤记录.属性继承比例)
        ? 召唤记录.属性继承比例
        : {};
      const 统一比例 = Number(召唤记录?.继承属性比例 || 0);
      const 读取 = 键 => Math.max(0, Math.min(1, Number(继承[键] ?? 统一比例 ?? 0)));
      return [
        ['力量', 读取('力量')],
        ['防御', 读取('防御')],
        ['敏捷', 读取('敏捷')],
        ['体力上限', 读取('体力上限')],
        ['魂力上限', 读取('魂力上限')],
        ['精神力上限', 读取('精神力上限')],
      ];
    }

    function 读取召唤属性继承对象(召唤记录 = {}, 默认比例 = 0) {
      const 表 = Object.fromEntries(读取召唤属性继承比例(召唤记录));
      return {
        力量: Math.max(0, Math.min(1, Number(表.力量 || 默认比例))),
        防御: Math.max(0, Math.min(1, Number(表.防御 || 默认比例))),
        敏捷: Math.max(0, Math.min(1, Number(表.敏捷 || 默认比例))),
        体力上限: Math.max(0, Math.min(1, Number(表.体力上限 || 默认比例))),
        魂力上限: Math.max(0, Math.min(1, Number(表.魂力上限 || 默认比例))),
        精神力上限: Math.max(0, Math.min(1, Number(表.精神力上限 || 默认比例))),
      };
    }

    function 召唤单位是分身(召唤单位 = {}) {
      return String(
        召唤单位?.类型 ||
        召唤单位?.召唤单位类型 ||
        召唤单位?.__来源状态?.召唤物?.召唤单位类型 ||
        '',
      ).trim() === '分身';
    }

    function 读取召唤稳定状态(召唤单位 = {}) {
      if (!召唤单位 || 召唤单位.已消散 === true || !isCombatUnitAlive(召唤单位)) return '消散';
      if (召唤单位.__禁用召唤技能 === true || Number(召唤单位.__精神维持率 || 1) < 0.25) return '受限';
      if (Number(召唤单位.__精神压缩 || 1) < 0.98) return '超载';
      if (Number(召唤单位.__精神维持率 || 1) < 0.5) return '不稳';
      return '稳定';
    }

    function 读取召唤类型倾向(类型 = '') {
      const 文本 = String(类型 || '').trim();
      const 倾向表 = {
        分身: { 继承: 1.35, 收割: 1.1, 高威胁: 1.0, 技能: 1.15 },
        本命召唤兽: { 护主: 1.35, 高威胁: 1.12, 收割: 1.0, 技能: 1.05 },
        魂兽: { 收割: 1.22, 高威胁: 1.05, 技能: 0.95 },
        深渊生物: { 高威胁: 1.28, 收割: 1.05, 技能: 1.08 },
        魂师: { 技能: 1.25, 高威胁: 1.12, 收割: 1.04 },
        其他召唤生物: { 收割: 1.0, 高威胁: 0.95, 技能: 0.9 },
      };
      return 倾向表[文本] || 倾向表.其他召唤生物;
    }

    function 构建召唤普通攻击技能(召唤单位 = {}) {
      return normalizeSkillData({
        name: '普通攻击',
        技能分类: '输出',
        消耗: '无',
        前摇: 10,
        _效果数组: [{
          原型: '伤害结算',
          目标: '单体',
          伤害类型: '近身攻击',
          威力倍率: Math.max(60, Math.round(Math.max(Number(召唤单位?.str || 0), Number(召唤单位?.sp_max || 0)) * 0.08)),
        }],
      }, '普通攻击');
    }

    function 构建临时召唤技能列表(召唤单位 = {}) {
      const 类型 = String(召唤单位?.类型 || '魂兽').trim();
      const 名称表 = {
        本命召唤兽: ['本命冲击', '本命撕咬', '本命压迫', '本命追击'],
        魂兽: ['兽性冲击', '撕咬打击', '重踏压制', '迅猛追击'],
        深渊生物: ['浊能冲击', '裂隙打击', '深渊压迫', '暗流追击'],
        魂师: ['魂力冲击', '魂力压制', '身法突击', '战术追击'],
        其他召唤生物: ['召唤冲击', '召唤打击', '召唤压迫', '召唤追击'],
      };
      return (名称表[类型] || 名称表.其他召唤生物).slice(0, 4).map((名称, index) => normalizeSkillData({
        name: 名称,
        技能分类: '输出',
        消耗: '无',
        前摇: Math.max(8, 14 - index),
        _效果数组: [{
          原型: '伤害结算',
          目标: '单体',
          伤害类型: index % 2 === 0 ? '近身攻击' : '远程攻击',
          威力倍率: 90 + index * 15,
        }],
      }, 名称));
    }

    function 构建召唤技能列表(召唤单位 = {}) {
      const 技能列表 = 构建临时召唤技能列表(召唤单位);
      if (!技能列表.some(skill => String(skill?.name || skill?.魂技名 || '').trim() === '普通攻击')) {
        技能列表.unshift(构建召唤普通攻击技能(召唤单位));
      }
      return 技能列表;
    }

    function 注册召唤运行态单位(combatData = {}, 宿主 = {}, 来源状态键 = '', 来源状态 = {}, 选项 = {}) {
      if (!combatData || !宿主 || !来源状态?.召唤物) return null;
      if (!combatData.召唤单位表 || typeof combatData.召唤单位表 !== 'object' || Array.isArray(combatData.召唤单位表)) {
        Object.defineProperty(combatData, '召唤单位表', {
          configurable: true,
          enumerable: false,
          writable: true,
          value: {},
        });
      }
      const 表 = combatData.召唤单位表;
      const 召唤记录 = 来源状态.召唤物;
      const 召唤物名称 = String(召唤记录.召唤物名称 || 召唤记录.name || '召唤物').trim() || '召唤物';
      const 宿主名 = String(宿主.name || 宿主.名称 || '宿主').trim() || '宿主';
      const 召唤键 = String(召唤记录.召唤键 || `${宿主名}::${来源状态键}::${召唤物名称}`).trim();
      const 类型配置 = 读取召唤类型配置(召唤记录.召唤单位类型 || 召唤记录.类型);
      const 数量 = 类型配置.名称 === '其他召唤生物' ? 1 : Math.max(1, Number(召唤记录.召唤数量 || 召唤记录.数量 || 来源状态.层数 || 1));
      const 行动模式 = String(召唤记录.行动模式 || 类型配置.默认行动模式 || '协同攻击').trim();
      const 默认继承比例 = 类型配置.名称 === '分身' || 类型配置.名称 === '本命召唤兽' ? 0.45 : 0;
      const 属性继承比例 = 读取召唤属性继承对象(召唤记录, 默认继承比例);
      const 继承比例 = Math.max(
        属性继承比例.力量,
        属性继承比例.防御,
        属性继承比例.敏捷,
        属性继承比例.体力上限,
        属性继承比例.魂力上限,
        属性继承比例.精神力上限,
      );
      const 强度 = 继承比例 > 0 ? 继承比例 : Math.max(0.01, Number(召唤记录.强度 || 1));
      const 宿主最终 = 宿主.final || BATTLE_RUNTIME.buildCombatFinalStats(宿主);
      const 数量系数 = 1 + Math.min(数量 - 1, 4) * 0.35;
      const 属性系数 = 继承比例 > 0 ? 1 : Math.max(0.12, Math.min(1.4, 0.35 + 强度 * 0.18));
      const 资源系数 = 继承比例 > 0 ? 1 : 属性系数;
      const 生命上限 = Math.max(1, Math.round(getCombatHpMaxValue(宿主) * (继承比例 > 0 ? 属性继承比例.体力上限 : 属性系数) * 数量系数 * 类型配置.生命系数 * 读取召唤生命系数(行动模式)));
      const 精神负载基准 = 继承比例 > 0 ? 继承比例 * 100 : 强度 * 35;
      const 精神负载 = Math.max(1, Math.round(数量 * 精神负载基准 * 类型配置.负载系数 * 读取行动模式负载系数(行动模式)));
      const 已有单位 = 表[召唤键];
      const 当前生命 = Math.max(0, Math.min(生命上限, Number(已有单位?.HP ?? 召唤记录.生命 ?? 召唤记录.HP ?? 生命上限)));
      const 单位 = 已有单位 || {};
      Object.assign(单位, {
        召唤键,
        name: 召唤物名称,
        名称: 召唤物名称,
        基础名称: 读取召唤编号基名(召唤记录.基础名称 || 召唤物名称),
        类型: 类型配置.名称,
        阵营: 读取召唤宿主阵营(combatData, 宿主),
        宿主名,
        来源状态键,
        行动模式,
        HP: 当前生命,
        HP上限: 生命上限,
        体力: Math.max(1, Math.round(生命上限 * 0.45)),
        体力上限: Math.max(1, Math.round(生命上限 * 0.45)),
        魂力: Math.max(0, Math.round(Number(宿主最终.sp_max || 宿主.sp_max || 0) * (继承比例 > 0 ? 属性继承比例.魂力上限 * 类型配置.资源系数 : 资源系数))),
        魂力上限: Math.max(1, Math.round(Number(宿主最终.sp_max || 宿主.sp_max || 1) * (继承比例 > 0 ? 属性继承比例.魂力上限 * 类型配置.资源系数 : 资源系数))),
        精神力: Math.max(0, Math.round(Number(宿主最终.men_max || 宿主.men_max || 0) * (继承比例 > 0 ? 属性继承比例.精神力上限 * 类型配置.资源系数 : 资源系数))),
        精神力上限: Math.max(1, Math.round(Number(宿主最终.men_max || 宿主.men_max || 1) * (继承比例 > 0 ? 属性继承比例.精神力上限 * 类型配置.资源系数 : 资源系数))),
        str: Math.max(1, Math.round(Number(宿主最终.str || 宿主.str || 1) * (继承比例 > 0 ? 属性继承比例.力量 * 类型配置.属性系数 : 属性系数))),
        def: Math.max(1, Math.round(Number(宿主最终.def || 宿主.def || 1) * (继承比例 > 0 ? 属性继承比例.防御 * 类型配置.属性系数 : 属性系数))),
        agi: Math.max(1, Math.round(Number(宿主最终.agi || 宿主.agi || 1) * (继承比例 > 0 ? 属性继承比例.敏捷 * 类型配置.属性系数 : 属性系数))),
        状态效果: 单位.状态效果 && typeof 单位.状态效果 === 'object' ? 单位.状态效果 : {},
        精神负载,
        生成回合: Math.max(0, Number(已有单位?.生成回合 ?? combatData?.回合 ?? 0)),
        可自主行动: 行动模式 === '自主行动',
        已消散: false,
        继承属性比例: 继承比例,
        属性继承比例,
        强度,
        死亡反噬: 继承比例 > 0,
        __宿主: 宿主,
        __来源状态: 来源状态,
      });
      单位.hp = 单位.HP;
      单位.hp_max = 单位.HP上限;
      单位.sp = 单位.魂力;
      单位.sp_max = 单位.魂力上限;
      单位.men = 单位.精神力;
      单位.men_max = 单位.精神力上限;
      单位.final = BATTLE_RUNTIME.buildCombatFinalStats(单位);
      单位.技能列表 = 构建召唤技能列表(单位);
      表[召唤键] = 单位;
      召唤记录.召唤键 = 召唤键;
      BATTLE_RUNTIME.ensureSummonWindowRuntime(单位);
      同步召唤单位镜像(单位);
      if (!选项.静默) 单位.__刚生成 = true;
      return 单位;
    }

    function 召唤单位本回合刚生成(召唤单位 = {}, combatData = {}) {
      const 当前回合 = Math.max(0, Number(combatData?.回合 || 0));
      const 生成回合 = Math.max(0, Number(召唤单位?.生成回合 || 0));
      return 当前回合 > 0 && 生成回合 > 0 && 当前回合 <= 生成回合;
    }

    function 读取召唤剩余有效窗口(召唤单位 = {}) {
      return Math.max(0, Number(召唤单位?.__来源状态?.duration || 0));
    }

    function 构建召唤行动授权ID(召唤单位 = {}, combatData = {}, 机会类型 = 'action') {
      const runtime = BATTLE_RUNTIME.ensureSummonWindowRuntime(召唤单位);
      if (!runtime) return '';
      return `${runtime.windowId}:${Math.max(0, Number(combatData?.回合 || 0))}:${String(机会类型 || 'action').trim()}`;
    }

    function 召唤行动授权已消费(召唤单位 = {}, combatData = {}, 机会类型 = 'action') {
      const runtime = BATTLE_RUNTIME.ensureSummonWindowRuntime(召唤单位);
      const grantId = 构建召唤行动授权ID(召唤单位, combatData, 机会类型);
      return !runtime || !grantId || runtime.consumedActionGrantIds.has(grantId);
    }

    function 领取召唤行动授权(召唤单位 = {}, combatData = {}, 机会类型 = 'action') {
      const runtime = BATTLE_RUNTIME.ensureSummonWindowRuntime(召唤单位);
      const grantId = 构建召唤行动授权ID(召唤单位, combatData, 机会类型);
      if (!runtime || !grantId || runtime.consumedActionGrantIds.has(grantId)) return '';
      runtime.consumedActionGrantIds.add(grantId);
      return grantId;
    }

    function 记录召唤无目标结果(combatData = {}, 召唤单位 = {}, 原因 = 'NO_VALID_TARGET', options = {}) {
      const runtime = BATTLE_RUNTIME.ensureSummonWindowRuntime(召唤单位);
      return BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'failed_action',
        round: Number(combatData?.回合 || 0),
        actorName: 召唤单位?.name || 召唤单位?.名称 || '',
        targetName: '',
        actionName: 召唤单位?.行动模式 === '协同攻击' ? '召唤协同攻击' : '召唤行动',
        actionType: 召唤单位?.行动模式 === '协同攻击' ? 'summon_assist' : 'summon_action',
        actionRole: 召唤单位?.行动模式 === '协同攻击' ? 'ASSIST' : 'ACTIVE',
        result: 'fail',
        failReason: '当前没有合法攻击目标',
        reasonCode: 原因,
        meta: {
          source: 'summon',
          reasonCode: 原因,
          summonName: 召唤单位?.name || 召唤单位?.名称 || '',
          summonHostName: 召唤单位?.宿主名 || 召唤单位?.__宿主?.name || 召唤单位?.__宿主?.名称 || '',
          summonMode: 召唤单位?.行动模式 || '',
          windowId: runtime?.windowId || '',
          grantId: String(options?.grantId || '').trim(),
        },
      });
    }

    function 主动收回召唤单位(combatData = {}, 宿主 = {}, 指定名称 = '') {
      const 指定文本 = String(指定名称 || '').trim();
      const 候选列表 = 读取召唤单位列表(combatData, { 宿主 }).filter(单位 =>
        !召唤单位是分身(单位) &&
        (
          !指定文本 ||
          String(单位.召唤键 || '').trim() === 指定文本 ||
          String(单位.name || 单位.名称 || '').includes(指定文本)
        ),
      );
      if (!候选列表.length) return '[收回召唤] 当前没有可收回的召唤物。';
      const 日志 = [];
      候选列表.forEach(单位 => {
        写入召唤收回锁(combatData, 单位);
        const 名称 = 单位.name || 单位.名称 || '召唤物';
        BATTLE_RUNTIME.removeSummonUnit(combatData, 单位, '主动收回');
        日志.push(`${名称}`);
      });
      return `[收回召唤] 已收回${日志.join('、')}。`;
    }

    function 读取护卫召唤单位(combatData = {}, 受击者 = {}) {
      const 阵营 = 读取召唤宿主阵营(combatData, 受击者);
      return 读取召唤单位列表(combatData, { 阵营, 行动模式: '护卫' })
        .find(单位 => isCombatUnitAlive(单位) && !召唤行动授权已消费(单位, combatData, 'guard') && !isCombatUnitIdentityMatch(单位, 受击者?.name || 受击者?.名称 || 受击者)) || null;
    }

    root.__LWCS_DEBUG_RUN_BATTLE_CASE__ = options => BATTLE_RUNTIME.runBattleCase(options);
    function 读取事件链状态(container = null) {
      const 状态 = container && typeof container === 'object' ? container : {};
      if (状态 && typeof 状态 === 'object' && (Array.isArray(状态.复制键集合) || Array.isArray(状态.反制键集合) || '复制深度' in 状态)) {
        if (!状态.id) 状态.id = `skill-chain-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        状态.复制深度 = Math.max(0, Number(状态.复制深度 || 0));
        if (!Array.isArray(状态.复制键集合)) 状态.复制键集合 = [];
        if (!Array.isArray(状态.反制键集合)) 状态.反制键集合 = [];
        return 状态;
      }
      if (!状态.__技能事件链 || typeof 状态.__技能事件链 !== 'object') {
        状态.__技能事件链 = {
          id: `skill-chain-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          复制深度: 0,
          复制键集合: [],
          反制键集合: [],
        };
      }
      if (!Array.isArray(状态.__技能事件链.复制键集合)) 状态.__技能事件链.复制键集合 = [];
      if (!Array.isArray(状态.__技能事件链.反制键集合)) 状态.__技能事件链.反制键集合 = [];
      return 状态.__技能事件链;
    }

    function 生成技能复制键(skill = {}) {
      return String(skill?.name || skill?.魂技名 || skill?.技能名称 || JSON.stringify(skill?._效果数组 || [])).trim();
    }

    function 技能含复制执行(skill = {}) {
      const 扫描 = value => {
        if (!value || typeof value !== 'object') return false;
        if (Array.isArray(value)) return value.some(扫描);
        if (String(value?.原型 || '').trim() === '复制执行') return true;
        return ['使用效果', '授予效果', '结算效果', '替换效果', '追加效果', '条件分支'].some(key => 扫描(value[key]));
      };
      return 扫描(skill?._效果数组);
    }

    function findCombatTargetInSet(targetSet = [], expectedTarget = null) {
      if (!expectedTarget) return null;
      return (
        (Array.isArray(targetSet) ? targetSet : []).find(target =>
          isCombatUnitIdentityMatch(target, expectedTarget?.name || expectedTarget),
        ) || null
      );
    }

    function 计算目标威胁分(target = {}) {
      const finalStat = target?.final || target || {};
      const 快照 = buildConditionTacticalSnapshot(target);
      return (
        Number(finalStat.str || target.str || target.力量 || 0) * 0.35 +
        Number(finalStat.men_max || target.men_max || target.精神力上限 || 0) * 0.25 +
        Number(finalStat.sp_max || target.sp_max || target.魂力上限 || 0) * 0.18 +
        Number(finalStat.agi || target.agi || target.敏捷 || 0) * 0.12 +
        (快照.hasTargetLock ? 500 : 0) +
        (快照.hasReactiveDefense ? 120 : 0)
      );
    }

    function 排序战斗目标列表(targetSet = [], attacker = null, preferredTarget = null, effect = null, effectiveTargetKind = '') {
      const preferredName = String(preferredTarget?.name || preferredTarget?.名称 || preferredTarget || '').trim();
      const forcedName = getForcedTauntTargetName(attacker);
      return [...(Array.isArray(targetSet) ? targetSet : [])]
        .map((target, index) => {
          return { target, index, threat: 计算目标威胁分(target) };
        })
        .sort((a, b) => {
          const aForced = forcedName && isCombatUnitIdentityMatch(a.target, forcedName) ? 1 : 0;
          const bForced = forcedName && isCombatUnitIdentityMatch(b.target, forcedName) ? 1 : 0;
          if (aForced !== bForced) return bForced - aForced;
          const aPreferred = preferredName && isCombatUnitIdentityMatch(a.target, preferredName) ? 1 : 0;
          const bPreferred = preferredName && isCombatUnitIdentityMatch(b.target, preferredName) ? 1 : 0;
          if (aPreferred !== bPreferred) return bPreferred - aPreferred;
          const aLocked = buildConditionTacticalSnapshot(a.target).hasTargetLock ? 1 : 0;
          const bLocked = buildConditionTacticalSnapshot(b.target).hasTargetLock ? 1 : 0;
          if (aLocked !== bLocked) return bLocked - aLocked;
          if (a.threat !== b.threat) return b.threat - a.threat;
          return a.index - b.index;
        })
        .map(entry => entry.target);
    }

    function 读取施术者召唤物目标列表(attacker = {}, combatData = {}) {
      return 读取召唤单位列表(combatData, { 宿主: attacker })
        .filter(单位 => isCombatUnitAlive(单位) && !召唤单位是分身(单位));
    }

    function 读取施术者分身目标列表(attacker = {}, combatData = {}) {
      return 读取召唤单位列表(combatData, { 宿主: attacker })
        .filter(单位 => isCombatUnitAlive(单位) && 召唤单位是分身(单位));
    }

    function resolveSkillTargetContext(skill, attacker, defender, combatData, effect = null) {
      if (String(effect?.原型 || '').trim() === '时光回溯') {
        return resolveTimeRewindTargetContext(skill, attacker, defender, combatData, effect);
      }
      const runtimeMeta = getSkillRuntimeMeta(skill);
      const baseTargetKind = effect ? 推断战斗效果目标类型(effect) : inferSkillPrimaryTargetKind(skill);
      const baseTargetScale = normalizeBattleSkillTargetScale(
        runtimeMeta?.目标规模 || '',
        deriveBattleSkillTargetScaleFromKind(baseTargetKind),
      );
      const explicitTargetText = String(effect?.目标 || '').trim();
      const targetModifiers = normalizeBattleSkillTargetModifiers(
        Array.isArray(effect?.目标修饰) && effect.目标修饰.length
          ? effect.目标修饰
          : runtimeMeta.目标修饰 || [],
      );
      const resolutionStrategy = deriveBattleTargetResolutionStrategy(baseTargetKind);
      const baseTargetText = explicitTargetText || mapBattleTargetKindToCombatTarget(baseTargetKind);
      const effectiveTargetKind = baseTargetKind;
      const targetText = mapBattleTargetKindToCombatTarget(effectiveTargetKind);
      确保召唤单位表(combatData || {});
      const 玩家侧单位 = 读取战斗阵营单位列表(combatData || {}, '玩家');
      const 敌方侧单位 = 读取战斗阵营单位列表(combatData || {}, '敌方');
      const 攻击者名 = String(attacker?.name || attacker?.名称 || '').trim();
      const 攻击者在玩家 = 玩家侧单位.some(unit => unit === attacker || isCombatUnitIdentityMatch(unit, 攻击者名));
      const 攻击者在敌方 = 敌方侧单位.some(unit => unit === attacker || isCombatUnitIdentityMatch(unit, 攻击者名));
      const 使用敌方视角 = !攻击者在玩家 && 攻击者在敌方;
      const alliedUnits = dedupeCombatTargetList([
        attacker,
        ...(使用敌方视角 ? 敌方侧单位 : 玩家侧单位),
      ]).filter(isCombatUnitAlive);
      const hostileUnits = dedupeCombatTargetList([
        defender,
        ...(使用敌方视角 ? 玩家侧单位 : 敌方侧单位),
      ]).filter(isCombatUnitAlive);
          const allUnits = dedupeCombatTargetList([...alliedUnits, ...hostileUnits]).filter(isCombatUnitAlive);
          const 指定目标名 = String(skill?.__指定目标名 || skill?.target_name || skill?.物品接收者 || '').trim();
          let targetSet = [];
      switch (effectiveTargetKind) {
        case '召唤物':
          targetSet = 读取施术者召唤物目标列表(attacker, combatData);
          break;
        case '分身':
          targetSet = 读取施术者分身目标列表(attacker, combatData);
          break;
        case '全场': {
          const prioritizedTarget = findCombatTargetInSet(allUnits, defender);
          targetSet = prioritizedTarget
            ? [prioritizedTarget, ...allUnits.filter(target => !isCombatUnitIdentityMatch(target, prioritizedTarget.name))]
            : allUnits;
          break;
        }
        case '自身':
          targetSet = attacker ? [attacker] : [];
          break;
        case '友方群体':
          if (是否七九辅助单体语义(attacker, skill)) {
            const alliedTarget = findCombatTargetInSet(alliedUnits, attacker) || attacker || alliedUnits[0] || null;
            targetSet = alliedTarget ? [alliedTarget] : [];
          } else {
            targetSet = alliedUnits;
          }
          break;
        case '友方单体': {
          const alliedTarget =
            (指定目标名 ? findCombatTargetInSet(alliedUnits, 指定目标名) : null) ||
            findCombatTargetInSet(alliedUnits, defender) ||
            findCombatTargetInSet(alliedUnits, attacker) ||
            attacker;
          targetSet = alliedTarget ? [alliedTarget] : [];
          break;
        }
        case '敌方群体':
          targetSet = hostileUnits;
          break;
        case '敌方单体':
        default: {
          const hostileTarget = findCombatTargetInSet(hostileUnits, defender) || hostileUnits[0] || null;
          targetSet = hostileTarget ? [hostileTarget] : [];
          break;
        }
      }
      const 运行态批量目标列表 = 读取运行态批量目标列表(skill).filter(isCombatUnitAlive);
      if (
        运行态批量目标列表.length > 0 &&
        isSupportLikeSkill(skill) &&
        ['自身', '友方单体', '友方群体'].includes(effectiveTargetKind)
      ) {
        targetSet = 运行态批量目标列表;
      }
      if (effectiveTargetKind !== '分身' && 推断战斗机制默认方向(effect || {}) === '友方') {
        targetSet = targetSet.filter(目标对象 => !召唤单位是分身(目标对象));
      }
      if (targetModifiers.includes('受隐身筛选') && effectiveTargetKind === '敌方单体') {
        const 可锁定目标 = targetSet.filter(target => 可以锁定隐匿目标(attacker, target, skill));
        targetSet = 可锁定目标.length
          ? 可锁定目标
          : hostileUnits.filter(target => 可以锁定隐匿目标(attacker, target, skill));
      }
      if (targetModifiers.includes('可被嘲讽') && ['敌方单体', '敌方群体'].includes(effectiveTargetKind)) {
        const forcedTargetName = getForcedTauntTargetName(attacker);
        if (forcedTargetName) {
          const forcedTarget = hostileUnits.find(target => isCombatUnitIdentityMatch(target, forcedTargetName));
          if (forcedTarget) {
            targetSet =
              effectiveTargetKind === '敌方单体'
                ? [forcedTarget]
                : [forcedTarget, ...targetSet.filter(target => !isCombatUnitIdentityMatch(target, forcedTarget.name))];
          }
        }
      }
      targetSet = 排序战斗目标列表(targetSet, attacker, defender, effect, effectiveTargetKind);
      const primaryTarget = targetSet[0] || null;
      return {
        targetKind: effectiveTargetKind,
        targetScale: baseTargetScale,
        directionId: '',
        directionSemantic: '上下文',
        targetModifiers,
        resolutionStrategy,
        targetText,
        alliedSet: alliedUnits,
        hostileSet: hostileUnits,
        targetSet,
        primaryTarget,
      };
    }

    function resolveSkillEffectTargetCharacter(skill, effect, attacker, defender, combatData = null) {
      return resolveSkillTargetContext(skill, attacker, defender, combatData, effect).primaryTarget;
    }

    function resolveSkillEffectTargetCharacters(skill, effect, attacker, defender, combatData) {
      return resolveSkillTargetContext(skill, attacker, defender, combatData, effect).targetSet;
    }

      function onPlayerAttack(playerInput, options = {}) {
        const state = root.BattleUI?.state || {};
        const sourceCombatData = options.combatData || state.combatData;
        if (!sourceCombatData || typeof sourceCombatData !== 'object') throw new Error('battle_combat_data_missing');
        const battleMode = options.mode === 'multi_round' ? 'multi_round' : 'single_round';
        const dryRun = options.dryRun === true;
        const maxRounds = battleMode === 'multi_round'
          ? Math.max(1, Math.min(20, Math.floor(Number(options.autoContinueConfig?.maxRounds || sourceCombatData?.胜负条件?.maxRounds || 20))))
          : 1;
        const runtime = BATTLE_RUNTIME.ensureCombatRuntime(sourceCombatData);
        const seed = Math.max(1, Math.floor(Number(runtime.decisionSeed || 1)));
        const result = BATTLE_RUNTIME.runBattleCase({
          caseId: dryRun ? 'battle-ui-preview' : 'battle-ui-formal',
          seed,
          combatData: sourceCombatData,
          mode: battleMode,
          rounds: maxRounds,
          selectedAction: options.actionDeclaration || null,
          battleIntent: {
            mode: String(options.intentMode || sourceCombatData.战斗意图 || '').trim(),
            objectives: sourceCombatData.胜负条件 || {},
          },
        });
        if (!dryRun && result?.combatData && typeof result.combatData === 'object') {
          Object.assign(sourceCombatData, result.combatData);
        }
        const mvuUpdate = dryRun
          ? null
          : root.BattleUIBridge?.persistCombatData?.(sourceCombatData, {
              analysis: 'Apply the authoritative BattleRuntime final snapshot, terminal result, resources and incapacitation facts exactly as provided.',
              extraPatchOps: Array.isArray(result?.extraPatchOps) ? result.extraPatchOps : [],
              syncHpRecoveryOnly: false,
            }) || null;
        const output = {
          ...result,
          preview: dryRun,
          intentText: String(playerInput || '').trim(),
          mode: dryRun ? 'preview' : 'engine_arbitrated',
          battleMode,
          roundsExecuted: Number(result?.roundsExecuted || 0),
          eventLedger: Array.isArray(result?.ledger) ? result.ledger : [],
          decisionTrace: Array.isArray(result?.decisions) ? result.decisions : [],
          resolutionTrace: Array.isArray(result?.trace) ? result.trace : [],
          publicReportBlocks: Array.isArray(result?.reportBlocks) ? result.reportBlocks : [],
          mvuUpdate,
        };
        if (!dryRun && result?.aiSummaryInput) {
          const settlementContext = registerBattleSettlementContext({
            id: `battle-${Date.now()}`,
            结构化摘要: JSON.stringify(result.aiSummaryInput),
            裁断卷宗: JSON.stringify(result.finalBattleReport || {}),
            来源: 'BattleRuntime',
          });
          output.battleSettlementContext = settlementContext;
          sendToAI(`<battle_structured_summary>\n${JSON.stringify(result.aiSummaryInput)}\n</battle_structured_summary>`, '', {
            mvuUpdate,
            requestKind: 'battle_settlement_plot',
          });
          output.aiRequest = root.__lastBattleAIRequest || null;
        }
        return output;
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
          if (!actionDeclaration && !intentText) throw new Error('battle_action_unavailable');
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

      function 读取战斗背包物品数据(物品名 = '', 背包状态 = {}) {
        const 全部物品 = window.BattleUIBridge?.getMVU('物品') || {};
        let 根物品 = {};
        let 根物品分类 = '';
        if (全部物品 && typeof 全部物品 === 'object' && !Array.isArray(全部物品)) {
          Object.entries(全部物品).some(([分类名, 分类表]) => {
            if (!分类表 || typeof 分类表 !== 'object' || Array.isArray(分类表)) return false;
            if (!分类表[物品名] || typeof 分类表[物品名] !== 'object' || Array.isArray(分类表[物品名])) return false;
            根物品 = 分类表[物品名];
            根物品分类 = String(分类名 || '').trim();
            return true;
          });
        }
        const 安全根物品 = 根物品 && typeof 根物品 === 'object' && !Array.isArray(根物品) ? 根物品 : {};
        const 安全背包状态 = 背包状态 && typeof 背包状态 === 'object' && !Array.isArray(背包状态) ? 背包状态 : {};
        const 批次列表 = (Array.isArray(安全背包状态.批次) ? 安全背包状态.批次 : []).filter(
          批次 => 批次 && typeof 批次 === 'object' && !Array.isArray(批次) && Number(批次.数量 || 0) > 0,
        );
        const 首批 = 批次列表[0] || {};
        const 总数量 =
          Math.max(0, Math.floor(Number(安全背包状态.数量 || 0))) +
          批次列表.reduce((总数, 批次) => 总数 + Math.max(0, Math.floor(Number(批次.数量 || 0))), 0);
        const 取数组字段 = 字段名 =>
          cloneBattleValue(
            Array.isArray(安全背包状态?.[字段名]) && 安全背包状态[字段名].length
              ? 安全背包状态[字段名]
              : Array.isArray(安全根物品?.[字段名])
                ? 安全根物品[字段名]
                : [],
          );
        return {
          ...cloneBattleValue(安全根物品),
          ...cloneBattleValue(安全背包状态),
          ...cloneBattleValue(首批),
          物品分类: String(安全背包状态?.物品分类 || 安全背包状态?.分类 || 安全根物品?.物品分类 || 安全根物品?.分类 || 根物品分类 || '').trim(),
          数量: 总数量,
          使用效果: 取数组字段('使用效果'),
          副作用列表: 取数组字段('副作用列表'),
          造物产出者属性: cloneBattleValue(
            安全背包状态?.造物产出者属性 && typeof 安全背包状态.造物产出者属性 === 'object' && !Array.isArray(安全背包状态.造物产出者属性)
              ? 安全背包状态.造物产出者属性
              : 安全根物品?.造物产出者属性 && typeof 安全根物品.造物产出者属性 === 'object' && !Array.isArray(安全根物品.造物产出者属性)
                ? 安全根物品.造物产出者属性
                : {},
          ),
          使用条件: cloneBattleValue(
            安全背包状态?.使用条件 && typeof 安全背包状态.使用条件 === 'object' && !Array.isArray(安全背包状态.使用条件)
              ? 安全背包状态.使用条件
              : 安全根物品?.使用条件 && typeof 安全根物品.使用条件 === 'object' && !Array.isArray(安全根物品.使用条件)
                ? 安全根物品.使用条件
                : {},
          ),
        };
      }

      function 读取战斗魂导等级(物品数据 = {}) {
        const 等级 = Math.floor(Number(物品数据?.魂导等级 || 0));
        return Number.isFinite(等级) ? Math.max(0, Math.min(12, 等级)) : 0;
      }

      function 判断战斗一次性魂导道具(物品名 = '', 物品数据 = {}) {
        const 分类 = String(物品数据?.物品分类 || 物品数据?.分类 || '').trim();
        const 文本 = `${物品名} ${分类} ${String(物品数据?.描述 || '')}`;
        return 分类 === '一次性道具' || /奶瓶|定装|炮弹|炸弹|爆弹|弹\b|弹$/.test(文本);
      }

      function 判断战斗可装配魂导器(物品名 = '', 物品数据 = {}) {
        return 读取战斗魂导等级(物品数据) > 0 && !判断战斗一次性魂导道具(物品名, 物品数据);
      }

      function 读取战斗背包使用效果倍率(物品数据 = {}) {
        const 品质系数 = Number(物品数据?.品质系数 ?? 1);
        if (!Number.isFinite(品质系数) || Math.abs(品质系数 - 1) < 0.0001) return 1;
        return Math.max(0.8, Math.min(1.25, roundBattleScaledNumber(1 + (品质系数 - 1) * 0.25, 4)));
      }

      function 按战斗背包批次倍率缩放使用效果(效果列表 = [], 物品数据 = {}) {
        const 倍率 = 读取战斗背包使用效果倍率(物品数据);
        const 输出 = cloneBattleValue(Array.isArray(效果列表) ? 效果列表 : []);
        if (Math.abs(倍率 - 1) < 0.0001) return 输出;
        const 缩放字段列表 = ['数值', '威力倍率', '效果倍率', '结算倍率', '强化倍率', '引爆倍率', '持续伤害', '治疗量', '恢复量', '护盾值'];
        const 缩放效果列表 = effects =>
          (Array.isArray(effects) ? effects : []).forEach(effect => {
            if (!effect || typeof effect !== 'object' || Array.isArray(effect)) return;
            if (['耐久修复', 'durability_repair'].includes(String(effect.原型 || effect.type || '').trim())) return;
            缩放字段列表.forEach(字段名 => {
              if (effect[字段名] !== undefined) effect[字段名] = scaleBattleValue(effect[字段名], 倍率, { digits: 4 });
            });
            ['使用效果', '授予效果', '结算效果'].forEach(字段名 => 缩放效果列表(effect[字段名]));
            (Array.isArray(effect.条件分支) ? effect.条件分支 : []).forEach(分支 => {
              缩放效果列表(分支?.替换效果);
              缩放效果列表(分支?.追加效果);
            });
          });
        缩放效果列表(输出);
        return 输出;
      }

      function 校验战斗背包物品可用(物品名 = '', 物品数据 = {}, 使用者名 = '', 当前tick = 0) {
        const 数量 = Math.max(0, Number(物品数据?.数量 || 0));
        if (!(数量 > 0)) return { 可用: false, 原因: '剩余数量不足' };
        if (判断战斗可装配魂导器(物品名, 物品数据)) return { 可用: false, 原因: '魂导器需要装配后使用' };
        const 持有者 = String(物品数据?.持有者 || '').trim();
        if (持有者 && 使用者名 && 持有者 !== 使用者名) return { 可用: false, 原因: `当前持有者不是${使用者名}` };
        const 有效期至tick = Math.max(0, Number(物品数据?.有效期至tick || 0));
        if (有效期至tick > 0 && 当前tick > 有效期至tick) return { 可用: false, 原因: `【${物品名}】已经过期` };
        if (!Array.isArray(物品数据?.使用效果) || !物品数据.使用效果.length)
          return { 可用: false, 原因: '没有可执行的使用效果' };
        return { 可用: true, 原因: '' };
      }

      function 构建战斗背包技能(物品名 = '', 物品数据 = {}) {
        const 动作名 = `使用${物品名}`;
        return normalizeSkillData(
          {
            name: 动作名,
            魂技名: 动作名,
            技能分类: '辅助',
            承载方式: '物品使用',
            目标: '自身',
            __物品名: 物品名,
            __造物产出者属性: cloneBattleValue(物品数据?.造物产出者属性 || {}),
            消耗: '无',
            前摇: 8,
            _效果数组: 按战斗背包批次倍率缩放使用效果(物品数据?.使用效果, 物品数据),
            副作用列表: cloneBattleValue(Array.isArray(物品数据?.副作用列表) ? 物品数据.副作用列表 : []),
          },
          动作名,
        );
      }

        function runTeamBattleSimulation(combatData, maxRounds = 3) {
          return 运行正式决策战斗(combatData, maxRounds, 'multi_round');
        }

        function 运行正式决策战斗(combatData, maxRounds = 3, mode = 'multi_round', adapterOptions = {}) {
          const runtime = BATTLE_RUNTIME.ensureCombatRuntime(combatData);
          const seed = Math.max(1, Math.floor(Number(runtime.decisionSeed || 1)));
          const lockedAction = runtime.playerLockedNaturalAction;
          const result = BATTLE_RUNTIME.runBattleCase({
            caseId: 'battle-ui-formal',
            combatData,
            rounds: Math.max(1, Number(maxRounds || 1)),
            mode,
            seed,
            battleIntent: {
              mode: String(combatData?.战斗意图 || '').trim(),
              objectives: combatData?.胜负条件 || {},
            },
            selectedAction: lockedAction?.consumed !== true ? lockedAction?.action : null,
          });
          const committedCombatData = result?.combatData && typeof result.combatData === 'object' ? result.combatData : null;
          if (committedCombatData) Object.assign(combatData, committedCombatData);
          return {
            ...result,
            rounds: Number(result?.roundsExecuted || 0),
            logs: Array.isArray(result?.logs) ? result.logs : [],
            extraPatchOps: Array.isArray(result?.extraPatchOps) ? result.extraPatchOps : [],
          };
        }

        function runTeamBattleRound(combatData) {
          return 运行正式决策战斗(combatData, 1, 'single_round');
        }

        function ui_executeBattleFlow(combatData, options = {}) {
          if (!combatData) {
            return {
              mode: options.mode || 'single_round',
              roundsExecuted: 0,
              winner: 'unfinished',
              logs: ['[UI执行] 未提供 combatData。'],
              snapshot: null,
            };
          }

          const mode = options.mode === 'multi_round' ? 'multi_round' : 'single_round';
          const rounds = Math.max(1, Number(options.rounds || 1));
          const result =
            mode === 'multi_round' ? runTeamBattleSimulation(combatData, rounds) : runTeamBattleRound(combatData);
          if (result.winner && result.winner !== 'unfinished') {
            combatData.进行中 = false;
            combatData.裁断结果 = result.winner === 'player' ? '我方胜利' : result.winner === 'enemy' ? '敌方胜利' : '平局';
          }
          const extraPatchOps = Array.isArray(result.extraPatchOps) ? result.extraPatchOps : [];
          const mvuUpdate =
            window.BattleUIBridge?.persistCombatData?.(combatData, {
              analysis:
                'Frontend team battle runtime produced the authoritative final snapshot. Apply HP, survival, incapacity state, resources and battle terminal fields exactly as given; plot continuation may only narrate these facts.',
              extraPatchOps,
              syncHpRecoveryOnly: false,
            }) || null;

          return {
            mode,
            roundsRequested: mode === 'multi_round' ? rounds : 1,
            roundsExecuted: result.rounds || 0,
            roundStart: result.roundStart,
            roundEnd: result.roundEnd,
            winner: result.winner || 'unfinished',
            playerAlive: result.playerAlive,
            enemyAlive: result.enemyAlive,
            objectiveResolution: result.objectiveResolution || null,
            extraPatchOps,
            logs: result.logs || [],
            snapshot: BATTLE_RUNTIME.getBattleSnapshot(combatData),
            mvuUpdate,
          };
        }

        // ==========================================
        // 📍 UI 适配器层 (对外暴露接口)
        // ==========================================

        function 获取同队可行动单位(战斗数据, 角色数据) {
          const 玩家队伍 = (Array.isArray(战斗数据?.参战者?.team_player) ? 战斗数据.参战者.team_player : []).filter(Boolean);
          const 敌方队伍 = (Array.isArray(战斗数据?.参战者?.team_enemy) ? 战斗数据.参战者.team_enemy : []).filter(Boolean);
          const 角色标识 = String(角色数据?.name || 角色数据?.名称 || 角色数据?.charKey || 角色数据?.char_key || 角色数据?.key || '').trim();
          const 角色在玩家队 = 玩家队伍.some(unit => isCombatUnitIdentityMatch(unit, 角色标识));
          const 角色在敌方队 = 敌方队伍.some(unit => isCombatUnitIdentityMatch(unit, 角色标识));
          const 所在队伍 = 角色在玩家队 ? 玩家队伍 : 角色在敌方队 ? 敌方队伍 : 玩家队伍;
          const 已见 = new Set();
          return 所在队伍.filter(unit => {
            if (!unit || (角色标识 && isCombatUnitIdentityMatch(unit, 角色标识))) return false;
            const 单位标识 = String(unit?.name || unit?.名称 || unit?.charKey || unit?.char_key || unit?.key || '').trim();
            if (单位标识 && 已见.has(单位标识)) return false;
            if (单位标识) 已见.add(单位标识);
            return isCombatUnitAbleToFight(unit);
          });
        }

        function ui_getAvailableActions(charData, combatData) {
          if (!charData) return [];
          bindCombatParticipant(charData);
          确保召唤单位表(combatData || {});
          const 当前tick = Number(window.BattleUIBridge?.getMVU('world.时间.tick') || 0);
          const 当前角色名 = String(charData?.name || charData?.名称 || '').trim();
          const allyTeam = 获取同队可行动单位(combatData, charData);
          const 读取UI单位标识 = 单位 =>
            String(单位?.name || 单位?.名称 || 单位?.charKey || 单位?.char_key || 单位?.key || '').trim();
          const UI单位相同 = (左, 右) => {
            if (!左 || !右) return false;
            const 左标识 = 读取UI单位标识(左);
            const 右标识 = 读取UI单位标识(右);
            return 左 === 右 || (!!左标识 && !!右标识 && 左标识 === 右标识);
          };
          const 去重UI存活队伍 = 队伍 => {
            const 已见 = new Set();
            return (Array.isArray(队伍) ? 队伍 : [])
              .filter(Boolean)
              .filter(单位 => {
                const 标识 = 读取UI单位标识(单位);
                if (标识 && 已见.has(标识)) return false;
                if (标识) 已见.add(标识);
                return isCombatUnitAlive(单位);
              });
          };
          const 读取UI辅助消耗上下文 = skill => {
            if (!skill || !isSupportLikeSkill(skill)) return { 目标: null, 目标数量: 1, 目标列表: [], 批量模式: '' };
            const 目标文本 = String(getSkillTarget(skill) || '').trim();
            if (!目标文本 || /自身/.test(目标文本)) return { 目标: charData, 目标数量: 1, 目标列表: [charData], 批量模式: '' };
            const 玩家队伍 = 读取战斗主队单位列表(combatData, '玩家');
            const 敌方队伍 = 读取战斗主队单位列表(combatData, '敌方');
            const 在玩家队 = 玩家队伍.some(单位 => UI单位相同(单位, charData));
            const 友方队伍 = 去重UI存活队伍([charData, ...(在玩家队 ? 玩家队伍 : 敌方队伍), ...allyTeam]);
            const 对方队伍 = 去重UI存活队伍(在玩家队 ? 敌方队伍 : 玩家队伍);
            const 取最高魂力目标 = 队伍 =>
              [...队伍].sort((左, 右) => Number(右?.sp_max || 右?.属性?.魂力上限 || 0) - Number(左?.sp_max || 左?.属性?.魂力上限 || 0))[0] ||
              null;
            if (/己方|友方/.test(目标文本)) {
              if (/群体/.test(目标文本) && !是否七九辅助单体语义(charData, skill)) {
                return { 目标: 取最高魂力目标(友方队伍) || charData, 目标数量: Math.max(1, 友方队伍.length), 目标列表: 友方队伍, 批量模式: '原生群体' };
              }
              return { 目标: 取最高魂力目标(友方队伍) || charData, 目标数量: 1, 目标列表: [], 批量模式: '' };
            }
            if (/敌/.test(目标文本)) {
              if (/群体/.test(目标文本)) return { 目标: 取最高魂力目标(对方队伍), 目标数量: Math.max(1, 对方队伍.length), 目标列表: 对方队伍, 批量模式: '原生群体' };
              return { 目标: combatData?.参战者?.team_enemy?.[0] || 取最高魂力目标(对方队伍), 目标数量: 1, 目标列表: [], 批量模式: '' };
            }
            return { 目标: charData, 目标数量: 1, 目标列表: [charData], 批量模式: '' };
          };
          const 读取UI经验目标 = skill => {
            const 战斗目标类型 = inferSkillPrimaryTargetKind(skill);
            if (['自身', '友方单体', '友方群体'].includes(战斗目标类型)) return charData;
            return combatData?.参战者?.team_enemy?.[0] || null;
          };
          const availableSkills = collectUnifiedSkillEntries(charData, allyTeam, {
            includePassive: false,
            includeActive: true,
            includeUnavailableFusion: true,
          });

          const actions = [];
          actions.push(
            {
              id: 'basic_attack',
              type: 'tactical',
              action_type: '常规攻击',
              name: '普通攻击',
              category: '战术',
              cast_time: 10,
              cost_text: '无',
              enabled: true,
              reason: '',
              raw_skill: normalizeSkillData(
                {
                  name: '普通攻击',
                  技能分类: '输出',
                  消耗: '无',
                  前摇: 10,
                  _效果数组: [
                    { 原型: '伤害结算', 目标: '单体', 威力倍率: 50, 伤害类型: '近身攻击', 防御穿透: 0 },
                  ],
                },
                '普通攻击',
              ),
            },
            {
              id: 'guard',
              type: 'tactical',
              action_type: '防御',
              name: '防御',
              category: '战术',
              cast_time: 10,
              cost_text: '无',
              enabled: true,
              reason: '',
              raw_skill: normalizeSkillData({ name: '防御', 技能分类: '防御', 消耗: '无', 前摇: 10 }, '防御'),
            },
            {
              id: 'evade',
              type: 'tactical',
              action_type: '闪避',
              name: '闪避',
              category: '战术',
              cast_time: 12,
              cost_text: '体力:5%',
              enabled: parseSkillCostForChar(normalizeSkillData({ name: '闪避', 技能分类: '防御', 消耗: '体力:5%', 前摇: 12 }, '闪避'), charData).canCast,
              reason: '',
              raw_skill: normalizeSkillData({ name: '闪避', 技能分类: '防御', 消耗: '体力:5%', 前摇: 12 }, '闪避'),
            },
          );

          availableSkills.forEach(skill => {
            let costParsed = null;
            try {
              if (skill && isSupportLikeSkill(skill)) {
                const 辅助消耗上下文 = 读取UI辅助消耗上下文(skill);
                if (辅助消耗上下文.目标) skill.__targetForSupportCost = 辅助消耗上下文.目标;
                skill.__辅助目标数量 = Math.max(1, Math.floor(Number(辅助消耗上下文.目标数量 || 1)));
                if (Array.isArray(辅助消耗上下文.目标列表) && 辅助消耗上下文.目标列表.length > 0) {
                  skill.__批量目标列表 = 辅助消耗上下文.目标列表;
                  skill.__批量消耗模式 = 辅助消耗上下文.批量模式 || '';
                }
              }
              const 预览目标 = 读取UI经验目标(skill);
              const 来源类别 = getBattleSkillSourceCategory(skill);
              costParsed = parseSkillCostForChar(skill, charData, {
                actor: charData,
                caster: charData,
                attacker: charData,
                target: 预览目标,
                defender: 预览目标,
                action: { action_type: 来源类别 === '武魂融合技' ? '武魂融合技' : '释放魂技', type: '技能', skill, category: 来源类别 },
                skill,
                combatData,
                当前行动: 来源类别 === '武魂融合技' ? '武魂融合技' : '释放魂技',
              });
            } finally {
              if (skill && isSupportLikeSkill(skill)) {
                delete skill.__targetForSupportCost;
                delete skill.__辅助目标数量;
                delete skill.__批量目标列表;
                delete skill.__批量消耗模式;
              }
            }
            const 来源上下文 = 读取战斗来源类别上下文(skill, '魂技');
            const 来源类别 = 来源上下文.来源类别;
            const 百分比启动检查 = 来源类别 === '武魂融合技'
              ? { 可用: true, 原因: '' }
              : 检查普通魂技百分比启动消耗(skill, charData, {
                  action_type: '释放魂技',
                  category: 来源类别,
                  source_detail: 来源上下文.来源明细,
                });
            const 来源键 = [
              来源类别,
              ...(Array.isArray(来源上下文.魂环路径) ? 来源上下文.魂环路径 : []),
              来源上下文.魂技槽位,
              skill.name,
            ].map(片段 => String(片段 || '').replace(/[^\w\u4e00-\u9fa5-]+/g, '_')).filter(Boolean).join('_');
            const 技能动作 = {
              id: `skill_${来源键 || skill.name}`,
              type: 'skill',
              action_type: 来源类别 === '武魂融合技' ? '武魂融合技' : '释放魂技',
              name: skill.name,
              category: 来源类别,
              source_detail: 来源上下文.来源明细,
              semantic_role: getSkillType(skill) || '输出',
              tags: 读取技能原型标签(skill),
              cast_time: getSkillCastTime(skill),
              cost_text: getFusionSkillDisplayCostText(skill),
              enabled: 百分比启动检查.可用 && costParsed.canCast,
              reason: !百分比启动检查.可用 ? 百分比启动检查.原因 : costParsed.canCast ? '' : (costParsed.failureReason || '状态不足'),
              raw_skill: skill,
            };
            actions.push(技能动作);
          });

          Object.entries(charData?.背包 && typeof charData.背包 === 'object' ? charData.背包 : {}).forEach(([物品名, 背包状态]) => {
            if (!物品名 || !背包状态 || typeof 背包状态 !== 'object') return;
            const 物品数据 = 读取战斗背包物品数据(物品名, 背包状态);
            if (判断战斗可装配魂导器(物品名, 物品数据)) return;
            if (!Array.isArray(物品数据?.使用效果) || !物品数据.使用效果.length) return;
            const 校验结果 = 校验战斗背包物品可用(物品名, 物品数据, 当前角色名, 当前tick);
            const 物品技能 = 构建战斗背包技能(物品名, 物品数据);
            const 技能动作 = {
              id: `item_${物品名}`,
              type: 'item',
              action_type: '使用物品',
              name: 物品名,
              category: '物品',
              source_detail: '背包',
              semantic_role: getSkillType(物品技能) || '辅助',
              tags: ['物品', ...(读取技能原型标签(物品技能) || [])],
              cast_time: getSkillCastTime(物品技能),
              cost_text: `数量:${Math.max(0, Number(物品数据?.数量 || 0))}`,
              enabled: 校验结果.可用,
              reason: 校验结果.可用 ? '' : 校验结果.原因,
              raw_skill: 物品技能,
              物品名,
            };
            actions.push(技能动作);
          });

          if (charData.装备?.斗铠?.等级 > 0 && charData.装备?.斗铠?.装备状态 !== '已装备') {
            const 斗铠等级 = Number(charData.装备?.斗铠?.等级 || 1);
            const 已排异 = charData.装备?.斗铠?._已排异 || false;
            let 最低品质 = Infinity;
            let 部件数量 = 0;
            Object.values(charData.装备?.斗铠?.parts || {}).forEach(部件 => {
              if (部件?.状态 !== '未打造' && 部件?.状态 !== '重创') {
                if (Number(部件?.品质系数 || 0) < 最低品质) 最低品质 = Number(部件?.品质系数 || 0);
                部件数量++;
              }
            });
            let 斗铠前摇 = Math.max(0, 20 - 斗铠等级 * 5);
            if (斗铠等级 === 1 && !已排异 && 最低品质 > 1.2 && 部件数量 > 0) 斗铠前摇 = Math.max(0, 斗铠前摇 - 5);
            const 斗铠动作 = {
              id: 'equip_armor',
              type: 'equip',
              action_type: '穿戴装备',
              name: '斗铠附体',
              category: '特殊动作',
              cast_time: 斗铠前摇,
              cost_text: '无',
              enabled: true,
              reason: '',
              equip_target: 'armor',
              raw_skill: normalizeSkillData({
                name: 斗铠前摇 <= 0 ? '斗铠瞬间附体' : '斗铠附体读条',
                技能分类: '辅助',
                消耗: '无',
                前摇: 斗铠前摇,
              }),
            };
            actions.push(斗铠动作);
          }

          if (
            charData.装备?.机甲?.等级 &&
            charData.装备.机甲.等级 !== '无' &&
            charData.装备?.机甲?.装备状态 !== '已装备' &&
            charData.装备?.机甲?.状态 !== '重创'
          ) {
            const 机甲前摇 = charData.装备?.机甲?.等级 === '红级' ? 0 : 50;
            const 机甲动作 = {
              id: 'equip_mech',
              type: 'equip',
              action_type: '穿戴装备',
              name: '召唤机甲',
              category: '特殊动作',
              cast_time: 机甲前摇,
              cost_text: '无',
              enabled: true,
              reason: '',
              equip_target: 'mech',
              raw_skill: normalizeSkillData({ name: '召唤机甲', 技能分类: '辅助', 消耗: '无', 前摇: 机甲前摇 }),
            };
            actions.push(机甲动作);
          }

          if (charData.血脉之力?.技能?.['点燃生命之火'] && !charData.血脉之力?.生命之火) {
            const 生命之火技能 = normalizeSkillData(charData.血脉之力?.技能?.['点燃生命之火'], '点燃生命之火');
            const 生命之火消耗 = parseSkillCostForChar(生命之火技能, charData);
            const 生命之火动作 = {
              id: 'special_lifefire',
              type: 'special',
              action_type: '点燃生命之火',
              name: '点燃生命之火',
              category: '特殊动作',
              cast_time: 5,
              cost_text: getSkillCostText(生命之火技能),
              enabled: 生命之火消耗.canCast,
              reason: 生命之火消耗.canCast ? '' : (生命之火消耗.failureReason || '状态不足'),
              raw_skill: 生命之火技能,
            };
            actions.push(生命之火动作);
          }

          if (hasBattleUnlockedAttributeSet(charData, ['金', '木', '水', '火', '土'])) {
            const wuxingStripSkill = normalizeSkillData({
              name: '五行剥离',
              技能分类: '控制',
              消耗: '魂力:18% 精神力:25%',
              cast_time: 18,
            });
            const wuxingEscapeSkill = normalizeSkillData({
              name: '五行遁法',
              技能分类: '辅助',
              消耗: '魂力:12% 精神力:18% 维持:精神力:8%',
              cast_time: 12,
            });
            const stripCostParsed = parseSkillCostForChar(wuxingStripSkill, charData);
            const escapeCostParsed = parseSkillCostForChar(wuxingEscapeSkill, charData);
            actions.push({
              id: 'special_wuxing_strip',
              type: 'special',
              action_type: '五行剥离',
              name: '五行剥离',
              category: '纯操控',
              semantic_role: '控制',
              cast_time: getSkillCastTime(wuxingStripSkill),
              cost_text: getSkillCostText(wuxingStripSkill),
              enabled: stripCostParsed.canCast,
              reason: stripCostParsed.canCast ? '' : '状态不足',
              raw_skill: wuxingStripSkill,
            });
            actions.push({
              id: 'special_wuxing_escape',
              type: 'special',
              action_type: '五行遁法',
              name: '五行遁法',
              category: '纯操控',
              semantic_role: '辅助',
              cast_time: getSkillCastTime(wuxingEscapeSkill),
              cost_text: getSkillCostText(wuxingEscapeSkill),
              enabled: escapeCostParsed.canCast,
              reason: escapeCostParsed.canCast ? '' : '状态不足',
              raw_skill: wuxingEscapeSkill,
            });
          }

          const 可收回召唤 = 读取召唤单位列表(combatData, { 宿主: charData })
            .filter(单位 => isCombatUnitAlive(单位) && !召唤单位是分身(单位));
          if (可收回召唤.length > 1) {
            actions.push({
              id: 'summon_recall_all',
              type: 'summon',
              action_type: '收回召唤',
              name: '收回全部',
              category: '召唤',
              cast_time: 8,
              cost_text: '无',
              enabled: true,
              reason: '',
              raw_skill: normalizeSkillData({ name: '收回召唤', 技能分类: '辅助', 消耗: '无', 前摇: 8 }, '收回召唤'),
            });
          }
          可收回召唤.forEach(单位 => {
            actions.push({
              id: `summon_recall_${单位.召唤键 || 单位.name || actions.length}`,
              type: 'summon',
              action_type: '收回召唤',
              name: `收回·${单位.name || 单位.名称 || '召唤物'}`,
              category: '召唤',
              cast_time: 8,
              cost_text: '无',
              enabled: true,
              reason: '',
              target_name: 单位.召唤键 || 单位.name || 单位.名称 || '',
              raw_skill: normalizeSkillData({ name: '收回召唤', 技能分类: '辅助', 消耗: '无', 前摇: 8 }, '收回召唤'),
            });
          });

          actions.push({
            id: 'action_flee',
            type: 'tactical',
            action_type: '撤离',
            name: '亡命奔逃',
            category: '特殊动作',
            cast_time: 20,
            cost_text: '无',
            enabled: true,
            reason: '',
            raw_skill: normalizeSkillData({ name: '撤离', 技能分类: '辅助', 消耗: '无', 前摇: 20 }, '撤离'),
          });

          actions.forEach(动作 => 套用动作实际前摇(charData, 动作, 读取UI经验目标(动作.raw_skill || 动作.skill || {}), combatData));
          if (当前角色名) actions.forEach(action => {
            if (action && typeof action === 'object' && !String(action.actor_name || action.__行动者名 || '').trim()) {
              action.actor_name = 当前角色名;
            }
          });
          return actions;
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
            ...读取召唤单位列表(combatData, { 阵营: '玩家' }),
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
          if (动作是造物承载(动作)) {
            动作.物品接收者 = 安全目标名;
            写入造物动作选择(动作, 状态);
          } else {
            写入普通动作目标(动作, 状态);
          }
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
            ...读取召唤单位列表(combatData, { 阵营: '玩家' }),
          ];
          const enemyTeam = [
            ...(combatData.参战者.team_enemy || []),
            ...读取召唤单位列表(combatData, { 阵营: '敌方' }),
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
          确保召唤单位表(combatData || {});
          const 召唤列表 = 读取召唤单位列表(combatData)
            .filter(单位 => !召唤单位是分身(单位))
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
                    <button class="summon-recall-btn" type="button" data-summon-key="${htmlEscapeText(单位.召唤键 || 单位.name || '')}">收回</button>
                  </div>
                  <div class="summon-card-meta">${htmlEscapeText(单位.宿主名 || '宿主')} · ${htmlEscapeText(单位.行动模式 || '召唤')} · ${htmlEscapeText(单位.稳定状态 || '稳定')}</div>
                  <div class="summon-card-meta">${htmlEscapeText(基础属性)} · ${htmlEscapeText(基础动作)}</div>
                  <div class="summon-hp"><span style="width:${hpRatio}%"></span></div>
                  <div class="summon-card-foot">${Math.round(单位.hp)} / ${Math.round(单位.hp_max)}</div>
                </div>
              `;
            })
            .join('');
          node.querySelectorAll('[data-summon-key]').forEach(button => {
            button.addEventListener('click', () => {
              const state = window.BattleUI?.state || {};
              const 召唤键 = String(button.getAttribute('data-summon-key') || '').trim();
              const action = (state.availableActions || []).find(item => item.action_type === '收回召唤' && String(item.target_name || '') === 召唤键) || {
                id: `summon_recall_${召唤键}`,
                type: 'summon',
                action_type: '收回召唤',
                name: '收回召唤',
                category: '召唤',
                cast_time: 8,
                cost_text: '无',
                enabled: true,
                target_name: 召唤键,
                raw_skill: normalizeSkillData({ name: '收回召唤', 技能分类: '辅助', 消耗: '无', 前摇: 8 }, '收回召唤'),
              };
              state.selectedAction = action;
              state.selectedSkillActions = [action];
              刷新战斗意图输出(action);
              renderUiActionGrid(state.availableActions || [], state.activeCategory || '全部');
            });
          });
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

        function pushUiSkillAction(actions, skill, fallbackName, source, 魂环路径 = null, 魂技槽位 = '') {
          if (!skill || typeof skill !== 'object') return;
          const name = String(skill.魂技名 || skill.name || fallbackName || '').trim();
          if (!name) return;
          const runtimeSkill = normalizeSkillData(skill, name);
          if (Array.isArray(魂环路径) && 魂环路径.length) runtimeSkill.__魂环路径 = [...魂环路径];
          const 技能槽位 = String(魂技槽位 || fallbackName || name).trim();
          if (技能槽位) runtimeSkill.__魂技槽位 = 技能槽位;
          const 来源明细 = String(source || '魂技').trim() || '魂技';
          const 来源类别 = 规范化战斗来源类别(来源明细, '魂技');
          写入战斗来源类别上下文(runtimeSkill, { 来源类别, 来源明细, 魂环路径, 魂技槽位: 技能槽位 });
          const 来源键 = [
            来源类别,
            ...(Array.isArray(魂环路径) ? 魂环路径 : []),
            技能槽位,
            name,
            actions.length,
          ].map(片段 => String(片段 || '').replace(/[^\w\u4e00-\u9fa5-]+/g, '_')).filter(Boolean).join('_');
          actions.push({
            id: `skill_${来源键 || actions.length}`,
            type: 'skill',
            action_type: '释放魂技',
            name,
            category: 来源类别,
            source_detail: 来源明细,
            cast_time: findUiSkillCastTime(skill),
            cost_text: findUiSkillCost(skill),
            enabled: true,
            reason: '',
            raw_skill: runtimeSkill,
            skill: runtimeSkill,
          });
        }

        function collectUiSkillActions(charData) {
          const actions = [];
          const char = charData && typeof charData === 'object' ? charData : {};
          取角色武魂条目_战斗(char).forEach(([spiritName, spirit]) => {
            取武魂魂灵条目_战斗(spirit).forEach(([soulSpiritName, soulSpirit]) => {
              取魂灵魂环条目_战斗(soulSpirit).forEach(([ringIndex, ring]) => {
                取魂环魂技条目_战斗(ring).forEach(([skillName, skill]) => {
                  pushUiSkillAction(
                    actions,
                    skill,
                    skillName,
                    spirit?.表象名称 || spiritName || soulSpiritName || `第${ringIndex}魂环`,
                    [spiritName, soulSpiritName, ringIndex],
                    skillName,
                  );
                });
              });
            });
            取武魂直接魂环条目_战斗(spirit).forEach(([ringIndex, ring]) => {
              取魂环魂技条目_战斗(ring).forEach(([skillName, skill]) => {
                pushUiSkillAction(actions, skill, skillName, spirit?.表象名称 || spiritName || `第${ringIndex}魂环`, [spiritName, ringIndex], skillName);
              });
            });
          });
          Object.entries(char.自创魂技 || {}).forEach(([name, skill]) => pushUiSkillAction(actions, skill, name, '自创魂技'));
          Object.entries(char.武魂融合技 || {}).forEach(([name, fusion]) => {
            pushUiSkillAction(actions, buildFusionCombatSkill(fusion, name, char), `武魂融合技·${name}`, '武魂融合技');
          });
          actions.push(
            { id: 'basic_attack', type: 'tactical', action_type: '常规攻击', name: '普通攻击', category: '战术', cast_time: 10, cost_text: '无', enabled: true, skill: { name: '普通攻击' } },
            { id: 'guard', type: 'tactical', action_type: '防御', name: '防御', category: '战术', cast_time: 10, cost_text: '无', enabled: true, skill: { name: '防御' } },
            { id: 'evade', type: 'tactical', action_type: '闪避', name: '闪避', category: '战术', cast_time: 12, cost_text: '体力', enabled: true, skill: { name: '闪避' } },
            { id: 'flee', type: 'tactical', action_type: '撤离', name: '撤离', category: '战术', cast_time: 20, cost_text: '无', enabled: true, skill: { name: '撤离' } },
          );
          return actions;
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
          executeBattleFlow(combatData, options = {}) {
            return ui_executeBattleFlow(combatData, options);
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

        function 获取动作炸环机制效果(action = {}) {
          const 技能 = action?.raw_skill || action?.skill;
          if (!技能 || typeof 技能 !== 'object') return null;
          const 效果列表 = Array.isArray(技能._效果数组) ? 技能._效果数组 : [];
          return 效果列表.find(效果 => 效果 && String(效果.原型 || '').trim() === '炸环') || null;
        }

        function 格式化魂环标签_V1(魂环项 = {}, 索引 = 0) {
          const 魂环键文本 = String(魂环项?.魂环键 || `第${索引 + 1}魂环`).trim();
          const 年限文本 = Math.max(0, Number(魂环项?.年限 || 0));
          const 档位文本 = String(魂环项?.档位类型 || 判定魂环档位类型_V1(年限文本));
          return `${魂环键文本}(${档位文本}/${年限文本}年)`;
        }

        function 构建炸环候选列表_V1(action = {}, state = {}) {
          const 玩家角色数据 = state?.玩家角色数据 || {};
          const 技能 = action?.raw_skill || action?.skill || {};
          const 当前路径 = Array.isArray(技能.__魂环路径) ? 技能.__魂环路径 : [];
          const 候选列表 = 收集角色可炸魂环列表_V1(玩家角色数据)
            .filter(项 => !读取魂环路径恢复标记_V1(玩家角色数据, 项.路径).恢复中)
            .map(项 => ({ ...项, 当前技能魂环: 路径相同_V1(项.路径, 当前路径) }));
          候选列表.sort((左, 右) => {
            if (左.当前技能魂环 && !右.当前技能魂环) return -1;
            if (!左.当前技能魂环 && 右.当前技能魂环) return 1;
            return Number(右.年限 || 0) - Number(左.年限 || 0);
          });
          return 候选列表;
        }

        function 打开炸环选择对话_V1(action = {}, state = {}) {
          const 炸环效果 = 获取动作炸环机制效果(action);
          if (!炸环效果) return true;
          const 候选列表 = 构建炸环候选列表_V1(action, state);
          if (!候选列表.length) {
            显示战斗提示('当前没有可炸的魂环。');
            return false;
          }
          const 默认已选路径 = Array.isArray(action?.skill?.__炸环选择路径列表)
            ? action.skill.__炸环选择路径列表
            : [];
          const 默认索引集合 = new Set();
          候选列表.forEach((项, 索引) => {
            if (项.当前技能魂环) 默认索引集合.add(索引 + 1);
            if (默认已选路径.some(路径 => 路径相同_V1(路径, 项.路径))) 默认索引集合.add(索引 + 1);
          });
          if (!默认索引集合.size) 默认索引集合.add(1);
          const 默认输入 = Array.from(默认索引集合).sort((a, b) => a - b).join(',');
          const 列表文本 = 候选列表
            .map((项, 索引) => `${索引 + 1}. ${格式化魂环标签_V1(项, 索引)}${项.当前技能魂环 ? ' [当前技能魂环]' : ''}`)
            .join('\n');
          const 输入文本 = window.prompt(`选择要炸掉的魂环（可多选，用逗号分隔）:\n${列表文本}`, 默认输入);
          if (输入文本 === null) return false;
          const 选择索引 = String(输入文本 || '')
            .split(/[，,、\s]+/)
            .map(片段 => Number(片段))
            .filter(数值 => Number.isFinite(数值) && 数值 >= 1 && 数值 <= 候选列表.length);
          const 去重索引 = Array.from(new Set(选择索引));
          if (!去重索引.length) {
            显示战斗提示('未选择有效魂环，本次炸环取消。');
            return false;
          }
          const 选择路径列表 = 去重索引.map(索引 => 候选列表[索引 - 1]?.路径).filter(路径 => Array.isArray(路径));
          if (!Array.isArray(action.skill.__魂环路径) || !action.skill.__魂环路径.length) {
            显示战斗提示('当前技能未绑定魂环路径，无法执行炸环。');
            return false;
          }
          if (!选择路径列表.some(路径 => 路径相同_V1(路径, action.skill.__魂环路径))) {
            选择路径列表.unshift([...action.skill.__魂环路径]);
          }
          action.__炸环选择路径列表 = 选择路径列表.map(路径 => [...路径]);
          action.skill.__炸环选择路径列表 = action.__炸环选择路径列表.map(路径 => [...路径]);
          return true;
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
          const 目标文本 = 动作是造物承载(动作)
            ? '造物'
            : 动作类型 === '撤离'
              ? '撤离'
              : ['防御', '闪避', '穿戴装备', '收回召唤'].includes(动作类型)
                ? '自身'
                : inferSkillPrimaryTargetKind(技能 || {});
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
          return byId('ui-skill-tooltip');
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
          const 容器矩形 = wrapperElement.getBoundingClientRect();
          const 触发矩形 = 触发节点.getBoundingClientRect();
          悬浮节点.hidden = false;
          悬浮节点.classList.add('show');
          const 宽度 = Math.min(420, Math.max(220, 容器矩形.width - 24));
          悬浮节点.style.width = `${宽度}px`;
          悬浮节点.style.maxHeight = '';
          悬浮节点.style.overflow = 'visible';
          const 可用高度 = Math.max(160, 容器矩形.height - 24);
          let 实际高度 = Math.max(悬浮节点.offsetHeight || 160, 120);
          if (实际高度 > 可用高度) {
            实际高度 = 可用高度;
            悬浮节点.style.maxHeight = `${Math.round(可用高度)}px`;
            悬浮节点.style.overflow = 'hidden auto';
          }
          let 左 = 触发矩形.left - 容器矩形.left;
          let 上 = 触发矩形.bottom - 容器矩形.top + 8;
          if (左 + 宽度 > 容器矩形.width - 12) 左 = 容器矩形.width - 宽度 - 12;
          if (左 < 12) 左 = 12;
          if (上 + 实际高度 > 容器矩形.height - 12) 上 = 触发矩形.top - 容器矩形.top - 实际高度 - 8;
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

        function 动作是造物承载(action = {}) {
          const skill = action?.raw_skill || action?.skill || {};
          return String(skill?.承载方式 || '').trim() === '造物承载';
        }

        function 读取动作目标候选(action = {}, state = {}) {
          const combatData = state.combatData || {};
          const playerTeam = (combatData?.参战者?.team_player || []).filter(unit => unit && isCombatUnitAlive(unit));
          const enemyTeam = (combatData?.参战者?.team_enemy || []).filter(unit => unit && isCombatUnitAlive(unit));
          const skill = action?.raw_skill || action?.skill || {};
          if (['防御', '闪避', '撤离', '穿戴装备', '收回召唤'].includes(String(action?.action_type || ''))) return [];
          if (动作是造物承载(action)) {
            const mode = String(action.造物处理 || '生成到自己背包');
            if (mode === '生成给友方') return playerTeam;
            if (mode === '立即给目标使用') return [...playerTeam, ...enemyTeam];
            return [];
          }
          const targetKind = inferSkillPrimaryTargetKind(skill);
          if (targetKind === '自身') return playerTeam.slice(0, 1);
          if (targetKind === '友方单体') return playerTeam;
          if (targetKind === '敌方单体') return enemyTeam;
          return [];
        }

        function 写入普通动作目标(action = {}, state = {}) {
          if (!action || typeof action !== 'object') return;
          if (动作是造物承载(action)) return;
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
        }

        function 写入造物动作选择(action = {}, state = {}) {
          if (!action || typeof action !== 'object' || !动作是造物承载(action)) return;
          const combatData = state.combatData || {};
          const player = combatData?.参战者?.team_player?.[0] || state.player || {};
          const playerName = 读取战斗单位名(player);
          const mode = String(action.造物处理 || '生成到自己背包').trim() || '生成到自己背包';
          action.造物处理 = mode;
          action.立即使用 = mode === '立即自用' || mode === '立即给目标使用';
          if (action.立即使用) action.即食 = true;
          else {
            delete action.即食;
            delete action.立即食用;
          }
          if (mode === '生成到自己背包' || mode === '立即自用') {
            action.物品接收者 = playerName;
            action.target_name = mode === '立即自用' ? playerName : '';
            if (mode === '立即自用') action.食用目标 = playerName;
            else delete action.食用目标;
            return;
          }
          const candidates = 读取动作目标候选(action, state);
          const current = String(action.target_name || action.物品接收者 || '').trim();
          const matched = candidates.find(unit => 读取战斗单位名(unit) === current);
          const targetName = 读取战斗单位名(matched || candidates[0] || player);
          action.target_name = targetName;
          action.物品接收者 = targetName;
          if (mode === '立即给目标使用') action.食用目标 = targetName;
          else delete action.食用目标;
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
          if (动作是造物承载(action)) {
            写入造物动作选择(action, state);
            const mode = String(action.造物处理 || '生成到自己背包');
            const modes = ['生成到自己背包', '生成给友方', '立即自用', '立即给目标使用'];
            const candidates = 读取动作目标候选(action, state);
            const 当前目标 = String(action.target_name || action.物品接收者 || '').trim();
            const 目标选项 = candidates.map(unit => 读取战斗单位名(unit)).filter(Boolean).map(name => ({ 值: name, 文本: name }));
            const targetHtml = 目标选项.length
              ? 构建战斗下拉控件({
                  标签: '施放目标',
                  当前值: 当前目标,
                  占位: '自身',
                  属性名: 'target-name',
                  选项列表: 目标选项,
                })
              : '';
            node.hidden = false;
            node.innerHTML = `
              ${targetHtml}
              ${构建战斗下拉控件({
                标签: '施放方式',
                当前值: mode,
                属性名: 'construct-mode',
                选项列表: modes.map(item => ({ 值: item, 文本: item })),
              })}
            `;
            node.querySelectorAll('[data-construct-mode]').forEach(button => {
              button.addEventListener('click', () => {
                action.造物处理 = button.getAttribute('data-construct-mode') || '生成到自己背包';
                写入造物动作选择(action, state);
                刷新战斗意图输出(action);
              });
            });
            node.querySelectorAll('[data-target-name]').forEach(button => {
              button.addEventListener('click', () => {
                选择战斗动作目标(button.getAttribute('data-target-name') || '', action);
              });
            });
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
              if (!打开炸环选择对话_V1(action, state)) return;
              state.selectedAction = action;
              state.selectedSkillActions = [action];
              if (动作是造物承载(action)) 写入造物动作选择(action, state);
              else 写入普通动作目标(action, state);
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
          hydrateCombatData(combatData);
          确保召唤单位表(combatData);
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
              activeBattleRecordView: ['round', 'report', 'decision', 'summary'].includes(previousState.activeBattleRecordView) ? previousState.activeBattleRecordView : 'round',
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
            if (动作是造物承载(selectedAction)) 写入造物动作选择(selectedAction, window.BattleUI.state);
            else 写入普通动作目标(selectedAction, window.BattleUI.state);
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
          const skill = action.raw_skill || action.skill || {};
          const type = action.action_type || action.type || getSkillType(skill) || '输出';
          const name = action.name || skill.name || '';
          const resolvedTargetName = resolveIntentTargetNameFromAction(action, window.BattleUI?.state?.combatData || {});
          const 来源上下文 = 读取战斗来源类别上下文(skill, action.category || '魂技');
          const 魂环路径 = Array.isArray(skill?.__魂环路径) ? skill.__魂环路径.map(片段 => String(片段)) : [];
          const 魂技槽位 = String(skill?.__魂技槽位 || '').trim();
          const actionObj = {
            type,
            action_type: type,
            category: action.category || 来源上下文.来源类别,
            source_detail: action.source_detail || 来源上下文.来源明细,
            skill: buildActionDeclarationSkill(skill),
            前摇: Number(action.cast_time ?? skill.前摇 ?? 0) || 0,
            target_name: resolvedTargetName,
            前摇已结算: action.前摇已结算 === true,
          };
          if (魂环路径.length) actionObj.__魂环路径 = 魂环路径;
          if (魂技槽位) actionObj.__魂技槽位 = 魂技槽位;
          const ownerName = String(action.actor_name || action.__行动者名 || window.BattleUI?.state?.player?.name || '').trim();
          if (ownerName) actionObj.actor_name = ownerName;
          if (type === '穿戴装备') actionObj.equip_target = /机甲/.test(name) ? 'mech' : 'armor';
          if (type === '吸血反哺') actionObj.heal_ratio = action.heal_ratio || 0.3;
          if (action.物品名 || skill.__物品名) actionObj.物品名 = String(action.物品名 || skill.__物品名 || '').trim();
          if (action.造物处理) actionObj.造物处理 = String(action.造物处理 || '').trim();
          if (action.物品接收者) actionObj.物品接收者 = String(action.物品接收者 || '').trim();
          if (action.立即使用 === true) actionObj.立即使用 = true;
          if (action.即食 === true) actionObj.即食 = true;
          if (action.食用目标) actionObj.食用目标 = String(action.食用目标 || '').trim();
          if (type === '多元素融合') {
            actionObj.fusionElements = normalizeBattleSkillAttributeTokens(action.fusionElements || []);
            actionObj.fusionPattern = String(
              action.fusionPattern || buildBattleFusionPattern(actionObj.fusionElements),
            );
          }
          const 炸环选择路径列表 =
            (Array.isArray(action?.__炸环选择路径列表) && action.__炸环选择路径列表) ||
            (Array.isArray(skill?.__炸环选择路径列表) && skill.__炸环选择路径列表) ||
            [];
          if (炸环选择路径列表.length) {
            actionObj.__炸环选择路径列表 = 炸环选择路径列表
              .filter(路径 => Array.isArray(路径) && 路径.length)
              .map(路径 => 路径.map(片段 => String(片段)));
          }
          if (action.is_charged) actionObj.is_charged = true;
          return actionObj;
        }

        function buildIntentText(actions) {
          const state = window.BattleUI?.state || {};
          const fallbackActions = [
            ...(state.selectedPreActions || []),
            state.selectedSkillActions?.[state.selectedSkillActions.length - 1] || state.selectedAction,
          ].filter(Boolean);
          const sourceActions = Array.isArray(actions) && actions.length ? actions : fallbackActions;
          const declaredActions = sourceActions.map(buildActionDeclarationEntry).filter(Boolean);
          const parts = [];
          if (declaredActions.length) parts.push(declaredActions.map(action => action.skill?.魂技名 || action.skill?.name || action.type).filter(Boolean).join('，'));
          const target =
            declaredActions.find(action => String(action?.target_name || '').trim())?.target_name ||
            resolveIntentTargetNameFromAction(sourceActions[0], state.combatData);
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
          const declaredActions = sourceActions.map(buildActionDeclarationEntry).filter(Boolean);
          return {
            actorName: String(declaredActions[0]?.actor_name || state.player?.name || '').trim(),
            actions: declaredActions,
            primaryTargetName: String(
              declaredActions.find(action => String(action?.target_name || '').trim())?.target_name ||
              resolveIntentTargetNameFromAction(sourceActions[0], state.combatData) || '',
            ).trim(),
          };
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
          return ['round', 'report', 'decision', 'summary'].includes(view) ? view : 'round';
        }

        function 设置战斗记录视图(view = 'round') {
          const activeView = ['round', 'report', 'decision', 'summary'].includes(view) ? view : 'round';
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
            dodge: '闪避应对',
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

        function 渲染判定侧写HTML(line = '', 轨迹 = {}) {
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
              const control = /控制|眩晕|禁锢|束缚|位移限制|减速|迟缓|沉默|封锁/.test(stateName);
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
            if (options && options.detail === true) detailLines.push(item);
            else lines.push(item);
          };
          const pushDetailLine = (text, kind = 'detail') => pushTimelineLine(text, kind, { detail: true });
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
          const 构建基础伤害代入式 = values => {
            const text = String(values?.formulaText || '').trim();
            const skillPower = Number(values?.skillPower || 0);
            const attackValue = Number(values?.attackValue || 0);
            const defenseValue = Number(values?.defenseValue || 0);
            const baseDamage = Number(values?.baseDamage || 0);
            if (!(skillPower > 0) || !(baseDamage > 0)) return '';
            const terms = [formatCalcNumber(skillPower)];
            if (attackValue > 0 && defenseValue > 0) terms.push(`(${formatCalcNumber(attackValue)}/${formatCalcNumber(defenseValue)})`);
            if (/魂力驱动/.test(text) && Number.isFinite(Number(values?.soulDriveScale))) terms.push(formatCalcNumber(values.soulDriveScale));
            if (/精神驱动/.test(text) && Number.isFinite(Number(values?.spiritDriveScale))) terms.push(formatCalcNumber(values.spiritDriveScale));
            if (/定位/.test(text) && Number.isFinite(Number(values?.positionDamageScale))) terms.push(formatCalcNumber(values.positionDamageScale));
            if (/近身系数/.test(text) && Number.isFinite(Number(values?.meleeContactScale))) terms.push(formatCalcNumber(values.meleeContactScale));
            if (/消耗加成/.test(text) && Number.isFinite(Number(values?.costDamageScale))) terms.push(formatCalcNumber(values.costDamageScale));
            const fusionDamageMult = Number(values?.fusionDamageMult || 1);
            if (Number.isFinite(fusionDamageMult) && Math.abs(fusionDamageMult - 1) >= 0.0001) terms.push(formatCalcNumber(fusionDamageMult));
            return terms.length >= 2 ? `代入：${terms.join('×')}=${formatCalcNumber(baseDamage)}` : '';
          };
          const 构建伤害计算明细行 = child => {
            const 读取 = key => 读取结算轨迹值(child.calculationTrace, key);
            const parts = [];
            const incoming = Number(读取('incomingDamage') || 0);
            const reactive = Number(读取('reactiveDamage') || 0);
            const threshold = Number(读取('defenseThreshold') || 0);
            const finalDamage = Number(读取('finalDamage') || 0);
            const segmentIndex = Number(读取('segmentIndex') || 0);
            const segmentCount = Number(读取('segmentCount') || 0);
            if (segmentCount > 1 && segmentIndex > 0) parts.push(`第${Math.round(segmentIndex)}/${Math.round(segmentCount)}段`);
            if (incoming > 0) parts.push(`入参${formatCalcNumber(incoming)}`);
            if (reactive > 0 && Math.round(reactive) !== Math.round(incoming)) parts.push(`反应后${formatCalcNumber(reactive)}`);
            if (threshold > 0) parts.push(`破防阈值${formatCalcNumber(threshold)}`);
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
              parts.push(`${label}${formatCalcNumber(value)}`);
            });
            if (finalDamage > 0) parts.push(`最终${formatCalcNumber(finalDamage)}`);
            return parts.length >= 2 ? `计算明细：${parts.join(' -> ')}` : '';
          };
          const 构建伤害基础公式行 = child => {
            const 读取 = key => 读取结算轨迹值(child.calculationTrace, key);
            const formulaText = String(读取('baseFormulaText') || '').trim();
            const damageType = String(读取('damageType') || '').trim();
            const skillPower = Number(读取('skillPower') || 0);
            const attackValue = Number(读取('attackValue') || 0);
            const defenseValue = Number(读取('defenseValue') || 0);
            const baseDamage = Number(读取('baseDamage') || 0);
            if (!formulaText || !(skillPower > 0) || !(baseDamage > 0)) return '';
            const params = [`威力${formatCalcNumber(skillPower)}`];
            if (attackValue > 0) params.push(`攻势${formatCalcNumber(attackValue)}`);
            if (defenseValue > 0) params.push(`防守${formatCalcNumber(defenseValue)}`);
            const substitution = 构建基础伤害代入式({
              formulaText,
              skillPower,
              attackValue,
              defenseValue,
              baseDamage,
              soulDriveScale: Number(读取('soulDriveScale') || 0),
              spiritDriveScale: Number(读取('spiritDriveScale') || 0),
              positionDamageScale: Number(读取('positionDamageScale') || 0),
              meleeContactScale: Number(读取('meleeContactScale') || 0),
              costDamageScale: Number(读取('costDamageScale') || 0),
              fusionDamageMult: Number(读取('fusionDamageMult') || 1),
            });
            return `基础公式：${damageType ? `【${damageType}】` : ''}${formulaText}，${params.join('，')}，得出${formatCalcNumber(baseDamage)}${substitution ? `；${substitution}` : ''}`;
          };
          const 构建攻防比审计行 = child => {
            const attackValue = Number(读取结算轨迹值(child.calculationTrace, 'attackValue') || 0);
            const defenseValue = Number(读取结算轨迹值(child.calculationTrace, 'defenseValue') || 0);
            if (!(attackValue > 0) || !(defenseValue > 0)) return '';
            const ratio = attackValue / defenseValue;
            if (!Number.isFinite(ratio) || (ratio >= 0.1 && ratio <= 5)) return '';
            return `攻防比审计：攻势 ${formatCalcNumber(attackValue)} / 防守 ${formatCalcNumber(defenseValue)} = ${formatCalcNumber(ratio)}，超出观察阈值 0.1-5；未启用 clamp`;
          };
          const 构建伤害路径行 = child => {
            const 读取 = key => 读取结算轨迹值(child.calculationTrace, key);
            const incoming = Number(读取('incomingDamage') || 0);
            const threshold = Number(读取('defenseThreshold') || 0);
            const finalDamage = Number(读取('finalDamage') || 0);
            if (!(incoming > 0) || !(finalDamage > 0)) return '';
            const parts = [`入参段伤害 ${formatCalcNumber(incoming)}`];
            if (threshold > 0) parts.push(`破防阈值 ${formatCalcNumber(threshold)}`);
            parts.push(`最终扣血 ${formatCalcNumber(finalDamage)}`);
            return `伤害路径：${parts.join(' -> ')}`;
          };
          const 构建闪避判定行 = child => {
            const 读取 = key => 读取结算轨迹值(child.calculationTrace, key);
            const dodgeRate = Number(读取('dodgeRate'));
            const dodgeRoll = Number(读取('dodgeRoll'));
            const failureReason = String(读取('failureReason') || child.failureReason || '').trim();
            const failureReasonCode = String(读取('reasonCode') || child.reasonCode || child.meta?.reasonCode || '').trim();
            const parts = [];
            if (Number.isFinite(dodgeRate) && Number.isFinite(dodgeRoll)) {
              const dodgeSucceeded = child.primaryOutcome === 'dodged' || /evaded|dodge_success|成功/.test(String(child.result || '').trim());
              parts.push(`闪避率${formatCalcNumber(dodgeRate)}`);
              parts.push(`投点${formatCalcNumber(dodgeRoll)}`);
              parts.push(dodgeSucceeded ? '实际终态：规避成功' : '实际终态：规避失败');
            } else if (/dodged|evaded|miss/i.test(failureReason) || child.primaryOutcome === 'miss') parts.push('目标完成规避，落点失效');
            const mappedReason = 映射玩家可见失败原因(failureReasonCode, failureReason);
            if (mappedReason && !/dodged|evaded|miss/i.test(failureReason)) parts.push(`原因${mappedReason}`);
            return parts.length ? `闪避判定：${parts.join(' -> ')}` : '';
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
            if (Number.isFinite(actualDefense) && actualDefense > 0) parts.push(`有效防御${formatCalcNumber(actualDefense)}`);
            if (Number.isFinite(threshold) && threshold > 0) parts.push(`破防阈值${formatCalcNumber(threshold)}`);
            if (Number.isFinite(damageReduction) && damageReduction > 0) parts.push(`减伤${formatCalcNumber(damageReduction * 100)}%`);
            if (Number.isFinite(activeShield) && activeShield > 0) parts.push(`反应护盾${formatCalcNumber(activeShield)}`);
            if (finalDamage >= 0) parts.push(`最终承伤${formatCalcNumber(finalDamage)}`);
            return parts.length >= 2 ? `防御判定：${parts.join(' -> ')}` : '';
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
              if (defenseLine) pushDetailLine(`${构建子级树前缀(prefix, false)} ${defenseLine}`, timelineKind);
            } else if (kind === 'hit_check') {
              const result = String(child.result || '').trim();
              const missed = /miss|evade|dodge|未命中|闪避/.test(result) || child.primaryOutcome === 'miss';
              pushChildTimelineLine(missed
                ? `${prefix} 命中检定：${actor}的【${finalAction}】未能命中${childTarget || target || '目标'}`
                : `${prefix} 命中检定：${actor}的【${finalAction}】锁定${childTarget || target || '目标'}，攻势落定`);
              const dodgeLine = 构建闪避判定行(child);
              if (dodgeLine) pushDetailLine(`${构建子级树前缀(prefix, false)} ${dodgeLine}`, timelineKind);
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
              if (stateDTO.successRateBreakdown) {
                pushDetailLine(`${构建子级树前缀(prefix, false)} ${stateDTO.successRateBreakdown}`, timelineKind);
              }
              (byParent.get(String(child.nodeId || '').trim()) || [])
                .filter(node => ['state_settlement', 'final_result'].includes(String(node.nodeKind || '')))
                .forEach((node, index, list) => pushChildLine(node, 构建子级树前缀(prefix, index === list.length - 1)));
            } else if (kind === 'damage_settlement') {
              const finalDamage = Number(读取结算轨迹值(child.calculationTrace, 'finalDamage') || 0);
              const result = String(child.result || '').trim();
              if (/miss|evade|dodge|未命中|闪避/.test(result) || child.primaryOutcome === 'miss') pushChildTimelineLine(`${prefix} 伤害结算：${childTarget || target || '目标'}未受到实质伤害`);
              else pushChildTimelineLine(`${prefix} 伤害结算：${childTarget || target || '目标'}${finalDamage > 0 ? `受到 ${Math.round(finalDamage)} 点伤害` : '未受到实质伤害'}`);
              const calcLine = 构建伤害计算明细行(child);
              const formulaLine = 构建伤害基础公式行(child);
              const ratioAuditLine = 构建攻防比审计行(child);
              const pathLine = 构建伤害路径行(child);
              [formulaLine, ratioAuditLine, pathLine, calcLine]
                .filter(Boolean)
                .forEach((line, index, list) => pushDetailLine(`${构建子级树前缀(prefix, index === list.length - 1)} ${line}`, timelineKind));
              (byParent.get(String(child.nodeId || '').trim()) || [])
                .filter(node => String(node.nodeKind || '') === 'summon_assist')
                .forEach((node, index, list) => pushChildLine(node, 构建子级树前缀(prefix, index === list.length - 1)));
            } else if (kind === 'state_settlement') {
              const stateName = String(读取结算轨迹值(child.calculationTrace, 'stateName') || child.stateName || '').trim();
              const duration = Math.max(0, Number(读取结算轨迹值(child.calculationTrace, 'duration') || child.duration || 0));
              const immune = /immune|immunity|免疫|无视异常/.test(String(child.result || '')) || /immune/.test(String(child.primaryOutcome || ''));
              if (stateName) pushChildTimelineLine(`${prefix} 状态结算：${childTarget || target || '目标'}${immune ? '免疫' : (/resist|resisted|抵抗|豁免/.test(String(child.result || '')) ? '抵住' : '陷入')}【${stateName}】${duration > 0 && !immune ? `，持续${duration}回合` : ''}`);
            } else if (kind === 'counter_action') {
              const damage = Number(读取结算轨迹值(child.calculationTrace, 'finalDamage') || 读取结算轨迹值(child.calculationTrace, 'damage') || 0);
              const counterLabel = Number(child.counterDepth || 0) >= 2 ? '反防反分支' : '防反分支';
              pushChildTimelineLine(`${prefix} ${counterLabel}：${childActor || '防守方'}以【${childAction}】反击${childTarget || actor}${damage > 0 ? `，造成 ${Math.round(damage)} 点伤害` : ''}`);
              const formulaLine = 构建伤害基础公式行(child);
              const ratioAuditLine = 构建攻防比审计行(child);
              const pathLine = 构建伤害路径行(child);
              const calcLine = 构建伤害计算明细行(child);
              const counterCalcLines = [formulaLine, ratioAuditLine, pathLine, calcLine].filter(Boolean);
              筛选可见因果子节点(byParent.get(String(child.nodeId || '').trim()) || [])
                .filter(node => ['reaction_window', 'reaction_decision'].includes(String(node.nodeKind || '')))
                .forEach((node, index, list) => pushChildLine(node, 构建子级树前缀(prefix, !counterCalcLines.length && index === list.length - 1)));
              counterCalcLines
                .forEach((line, index, list) => pushDetailLine(`${构建子级树前缀(prefix, index === list.length - 1)} ${line}`, timelineKind));
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
              pushChildTimelineLine(`${prefix} 召唤生成：召出${summonType || '召唤物'}【${summonName || '召唤物'}】${summonMode ? `，行动模式：${summonMode}` : ''}${mentalLoad > 0 ? `，精神负载 ${Math.round(mentalLoad)}` : ''}`);
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
            return `<div class="battle-preview-trace-node battle-preview-trace-node--${htmlEscapeText(kind)}" data-trace-node-kind="${htmlEscapeText(kind)}"><span>${渲染判定侧写HTML(line?.text || '')}</span></div>`;
          }).join('\n')}</div>`;
          const detailHtml = detailLines.length ? `
            <details class="battle-preview-trace-detail-fold">
              <summary>展开判定明细</summary>
              <div class="battle-preview-trace-tree battle-preview-trace-timeline battle-preview-trace-detail-tree">${detailLines.map(line => {
                const kind = String(line?.kind || 'detail').trim() || 'detail';
                return `<div class="battle-preview-trace-node battle-preview-trace-node--${htmlEscapeText(kind)} battle-preview-trace-node--detail" data-trace-node-kind="${htmlEscapeText(kind)}"><span>${渲染判定侧写HTML(line?.text || '')}</span></div>`;
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
          const 显示动作 = 判定防反动作名缺失(反击动作) ? 'Action_Missing' : 反击动作;
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
          const roundLabel = context?.showRound === false ? '动作' : `第${Math.max(0, Number(block?.round || 0))}回合`;
          return `
            <article class="battle-preview-report-group" data-round="${Math.max(0, Number(block?.round || 0))}" data-action-group-id="${htmlEscapeText(block?.actionGroupId || '')}">
              <header class="battle-structured-report-head"><span>${roundLabel}</span><b>${htmlEscapeText(actor)} · ${htmlEscapeText(action)}</b></header>
              ${String(block?.intentSummary || '').trim() ? `<p class="battle-structured-report-intent"><b>意图</b>${htmlEscapeText(block.intentSummary)}</p>` : ''}
              <p class="battle-structured-report-outcome"><b>结果</b>${outcomeHtml}</p>
              ${String(block?.nextWindow || '').trim() ? `<p class="battle-structured-report-window"><b>窗口</b>${htmlEscapeText(block.nextWindow)}</p>` : ''}
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
              return `${actor}以【${action}】${block?.targetIds?.length ? `指向${block.targetIds.join('、')}` : '展开行动'}`;
            });
            const exchangeText = declarations.length > 1
              ? `${declarations[0]}，${declarations.slice(1).map(text => `随后${text}`).join('；')}`
              : declarations[0] || '本回合没有主动交锋';
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
                <p class="battle-structured-report-exchange"><b>交锋</b>${htmlEscapeText(exchangeText)}</p>
                <div class="battle-structured-report-actions">${activeBlocks.map(block => 渲染结构化战报BlockHTML(block, { ...context, showRound: false })).join('')}</div>
                ${passiveHtml ? `<p class="battle-structured-report-passive"><b>回合结算</b>${passiveHtml}</p>` : ''}
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
                return `<div class="battle-final-summary-unit"><b>${htmlEscapeText(unit?.name || '单位')}</b><span>HP ${Math.max(0, Number(unit?.hp || 0))}/${Math.max(1, Number(unit?.hpMax || 1))}</span><span>魂力 ${Math.max(0, Number(unit?.sp || 0))}/${Math.max(1, Number(unit?.spMax || 1))}</span><span>体力 ${Math.max(0, Number(unit?.vit || 0))}/${Math.max(1, Number(unit?.vitMax || 1))}</span><span>精神力 ${Math.max(0, Number(unit?.men || 0))}/${Math.max(1, Number(unit?.menMax || 1))}</span>${states.length ? `<em>${htmlEscapeText(states.join('、'))}</em>` : ''}</div>`;
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
          const 视图标签 = { round: '回合', report: '战报', decision: '判定', summary: '总结' };
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
            if (!resolvedSkill) return;
            const action = {
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
          hydrateCombatData(combatData);
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
          clearCombatAdjudicationHints(combatData);
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

        function submitBattleIntent() {
          const state = window.BattleUI?.state || {};
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

          let result = { intentText, mode: 'intent_only', battleMode };
          try {
              window.dispatchEvent(new CustomEvent('battle-ui-intent-submit', { detail: { intentText, actionDeclaration, battleMode, intentMode: state.currentIntentMode || '点到为止', autoContinueConfig } }));
          } catch (error) {
            console.warn('battle-ui-intent-submit dispatch failed', error);
          }

          if (typeof onPlayerAttack === 'function') {
            try {
              const engineResult = onPlayerAttack(intentText, { mode: battleMode, intentMode: state.currentIntentMode || '点到为止', actionDeclaration, autoContinueConfig }) || {};
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
        }

        function previewBattleIntent() {
          const state = window.BattleUI?.state || {};
          if (state.pendingTowerSettlement) return { ok: false, mode: 'tower_pending_choice' };
          const previewBtn = byId('ui-battle-preview');
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
          if (previewBtn) previewBtn.disabled = true;
          try {
            const result = onPlayerAttack(intentText, {
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
            if (previewBtn) previewBtn.disabled = false;
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

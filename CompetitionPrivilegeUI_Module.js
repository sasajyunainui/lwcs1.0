!(function () {
  'use strict';

  const 文本 = 值 => String(值 ?? '').trim();
  const 转义 = 值 => String(值 ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const 运行时 = () => window.__LWCS_COMPETITION_PRIVILEGE_RUNTIME__ || window.parent?.__LWCS_COMPETITION_PRIVILEGE_RUNTIME__ || null;
  const 动作接口 = () => window.__LWCS_COMPETITION_PRIVILEGE_ACTION__ || window.parent?.__LWCS_COMPETITION_PRIVILEGE_ACTION__ || null;
  const 窗口函数 = 键 => typeof window[键] === 'function' ? window[键] : typeof window.parent?.[键] === 'function' ? window.parent[键] : null;

  class 赛事权限界面 {
    constructor(容器, 快照, 选项 = {}) {
      this.容器 = 容器;
      this.快照 = 快照 || {};
      this.选项 = 选项;
      this.模式 = 选项.mode === 'privilege' ? 'privilege' : 'competition';
      this.赛事ID = '';
      this.项目名 = '个人赛';
      this.页面 = '总览';
      this.归档 = [];
      this.渲染();
      this.加载归档();
    }

    get 数据() { return this.快照?.sd || this.快照?.rootData || {}; }
    get 玩家名() { return 文本(this.数据?.sys?.玩家名 || this.快照?.activeName); }
    updateData(快照) { this.快照 = 快照 || {}; this.渲染(); }
    destroy() { this.容器.innerHTML = ''; }

    async 执行(动作, 载荷 = {}) {
      const 接口 = 动作接口();
      if (typeof 接口 !== 'function') throw new Error('赛事管理接口尚未就绪');
      const 结果 = await 接口(动作, 载荷);
      this.选项.onAction?.({ 动作, 载荷, 结果 });
      return 结果;
    }

    async 加载归档() {
      const 接口 = 窗口函数('__LWCS_LIST_ARCHIVED_COMPETITIONS__');
      if (!接口) return;
      try { this.归档 = await 接口(); this.渲染(); } catch (错误) { console.warn('[LWCS] 赛事归档读取失败', 错误); }
    }

    渲染() {
      const 赛事表 = this.数据?.world?.赛事 || {};
      const 热赛事 = Object.entries(赛事表).filter(([, 赛事]) => 赛事?.状态 !== '已完成');
      if (this.模式 === 'privilege') {
        this.容器.innerHTML = `<div class="competition-privilege-scope competition-privilege-scope--privilege"><div class="cp-content">${this.渲染权限()}</div></div>`;
        this.绑定();
        return;
      }
      if (!this.赛事ID || !赛事表[this.赛事ID] || 赛事表[this.赛事ID].状态 === '已完成') this.赛事ID = 热赛事[0]?.[0] || '';
      const 当前赛事 = 赛事表[this.赛事ID];
      if (!当前赛事?.项目?.[this.项目名]) this.项目名 = Object.keys(当前赛事?.项目 || {})[0] || '个人赛';
      this.容器.innerHTML = `
        <div class="competition-privilege-scope competition-privilege-scope--competition">
          <div class="cp-content">${this.渲染赛事(热赛事, 当前赛事)}</div>
        </div>`;
      this.绑定();
    }

    渲染权限() {
      const 列表 = 运行时()?.列出持有人权限?.(this.数据, this.玩家名) || [];
      if (!列表.length) return '<div class="cp-empty">当前没有有效特殊权限。</div>';
      return `<div class="cp-permission-list">${列表.map(({ 权限ID, 记录 }) => {
        const 权限 = 记录.权限 || {};
        const 范围 = [权限.项目, 权限.地点, 权限.商店, 权限.物品分类, 权限.物品, 权限.来源, 权限.品质, 权限.分类].filter(Boolean).join(' / ');
        const 效果 = 权限.类型 === '折扣' ? `支付 ${权限.支付比例}%` : 权限.类型 === '物品选择' ? `可选 ${权限.数量} 件` : 权限.类型 === '奖励加成' ? `奖励 x${权限.倍率}` : '资格有效';
        const 配额 = 记录.使用配额 ? `${记录.使用配额.剩余}/${记录.使用配额.上限}${记录.使用配额.重置周期 ? ` · ${记录.使用配额.重置周期}重置` : ''}` : '不限次数';
        const 候选 = 权限.类型 === '物品选择' ? 运行时()?.生成物品选择候选?.(this.数据, 记录) || [] : [];
        return `<article class="cp-permission-row">
          <div class="cp-row-main"><div class="cp-row-title"><b>${转义(记录.名称)}</b><span>${转义(权限.类型)}</span></div>
          <div class="cp-row-meta">${转义(范围 || '全域')} · ${转义(效果)} · ${转义(配额)}</div>
          ${候选.length ? `<div class="cp-permission-use"><select data-choice="${转义(权限ID)}">${候选.slice(0, 100).map(项 => `<option>${转义(项.物品名)}</option>`).join('')}</select><button type="button" class="cp-command" data-claim="${转义(权限ID)}">领取</button></div>` : ''}</div>
          <button type="button" class="cp-icon-btn danger" title="撤销权限" data-revoke="${转义(权限ID)}">×</button>
        </article>`;
      }).join('')}</div>`;
    }

    渲染赛事(赛事列表, 赛事) {
      if (!赛事列表.length) return `<div class="cp-empty">当前没有进行中或筹备中的赛事。</div>${this.渲染归档()}`;
      return `<div class="cp-event-layout">
        <aside class="cp-event-list">${赛事列表.map(([ID, 记录]) => `<button type="button" class="cp-event-option${ID === this.赛事ID ? ' active' : ''}" data-event="${转义(ID)}"><b>${转义(记录.名称)}</b><span>${转义(记录.状态)} · ${Object.keys(记录.项目 || {}).join(' / ')}</span></button>`).join('')}</aside>
        <section class="cp-event-detail">${this.渲染赛事详情(赛事)}</section>
      </div>${this.渲染归档()}`;
    }

    渲染归档() {
      const 待重试 = Object.entries(this.数据?.world?.赛事 || {}).filter(([, 赛事]) => 赛事?.状态 === '已完成');
      if (!待重试.length && !this.归档.length) return '';
      return `<section class="cp-archive-zone"><h4>赛事归档</h4>
        ${待重试.map(([ID, 赛事]) => `<div class="cp-archive-row"><span><b>${转义(赛事.名称)}</b><small>归档待重试</small></span><button type="button" class="cp-command subtle" data-retry="${转义(ID)}">重试</button></div>`).join('')}
        ${this.归档.map(赛事 => `<div class="cp-archive-row"><span><b>${转义(赛事.名称)}</b><small>${转义(赛事.项目摘要 || `${赛事.参赛数量 || 0}个参赛单位`)}</small></span><button type="button" class="cp-command subtle" data-restore="${转义(赛事.赛事ID)}">恢复</button></div>`).join('')}
      </section>`;
    }

    渲染赛事详情(赛事) {
      if (!赛事) return '<div class="cp-empty">赛事不存在。</div>';
      const 项目 = 赛事.项目?.[this.项目名];
      const 进度 = 赛事._进度?.[this.项目名];
      return `<header class="cp-event-head"><div><h3>${转义(赛事.名称)}</h3><p>${转义(赛事.状态)} · ${转义(this.格式日程(赛事))}</p></div>
        <div class="cp-head-actions">${赛事.状态 === '筹备' ? '<button type="button" class="cp-command" data-start>启动</button>' : ''}${赛事.状态 === '进行中' ? '<button type="button" class="cp-command" data-simulate>推进场外赛</button>' : ''}</div></header>
        <div class="cp-sub-tabs">${Object.keys(赛事.项目 || {}).map(名称 => `<button type="button" class="cp-sub-tab${名称 === this.项目名 ? ' active' : ''}" data-project="${名称}">${名称}</button>`).join('')}</div>
        <div class="cp-sub-tabs">${['总览', '参赛者', '规则'].map(页面 => `<button type="button" class="cp-sub-tab${页面 === this.页面 ? ' active' : ''}" data-page="${页面}">${页面}</button>`).join('')}</div>
        ${this.页面 === '参赛者' ? this.渲染参赛者(赛事, 项目, 进度) : this.页面 === '规则' ? this.渲染规则(项目) : this.渲染总览(赛事, 项目, 进度)}`;
    }

    格式日程(赛事) {
      const 开始 = Number(赛事.日程?.开始tick || 0);
      const 结束 = Number(赛事.日程?.结束tick || 0);
      return `tick ${开始} 至 ${结束}`;
    }

    渲染参赛者(赛事, 项目, 进度) {
      const 列表 = Object.entries(项目?.参赛者 || {});
      const 显示列表 = 列表.slice(0, 100);
      const 已实体化 = Object.values(进度?.实体 || {}).filter(记录 => 记录?.来源 === '模拟').length;
      return `<div class="cp-rule-band"><h4>规模</h4><div class="cp-rule-tags"><span>总数 ${项目?.参赛总数 || 0}</span><span>已登记 ${列表.length}</span><span>模拟池 ${进度?.模拟数量 ?? Math.max(0, Number(项目?.参赛总数 || 0) - 列表.length)}</span><span>已实体化 ${已实体化}</span></div></div>
        <div class="cp-table-wrap"><table class="cp-table"><thead><tr><th>参赛单位</th><th>成员</th><th>状态</th></tr></thead><tbody>${显示列表.map(([, 记录]) => `<tr><td>${转义(记录.名称)}</td><td>${转义((记录.成员 || []).join('、'))}</td><td>${转义(记录.状态)}</td></tr>`).join('')}</tbody></table></div>
        ${赛事.状态 === '筹备' ? `<form class="cp-register-form" data-register><label>${this.项目名 === '个人赛' ? '选手名' : '队伍名'}<input name="名称" required></label><label>成员<input name="成员" value="${转义(this.玩家名)}" required></label><button type="submit" class="cp-command">报名</button></form>` : ''}`;
    }

    渲染规则(项目) {
      const 限制 = 项目?.参赛限制 || {};
      const 标签 = [
        `流程 ${项目?.流程 || '未设置'}`,
        `参赛总数 ${项目?.参赛总数 || 0}`,
        限制.队伍人数上限 ? `队伍最多 ${限制.队伍人数上限}人` : '',
        限制.年龄上限 !== undefined ? `年龄不超过 ${限制.年龄上限}岁` : '',
        限制.等级上限 !== undefined ? `等级不超过 ${限制.等级上限}级` : '',
        限制.允许身份?.length ? `身份 ${限制.允许身份.join('、')}` : '',
        限制.必需装备?.length ? `必需装备 ${限制.必需装备.join('、')}` : '',
        限制.禁止装备?.length ? `禁止装备 ${限制.禁止装备.join('、')}` : '',
      ].filter(Boolean);
      return `<div class="cp-rule-band"><h4>${转义(this.项目名)}规则</h4><div class="cp-rule-tags">${标签.map(值 => `<span>${转义(值)}</span>`).join('')}</div></div>`;
    }

    渲染总览(赛事, 项目, 进度) {
      if (!进度) return '<div class="cp-empty">项目尚未启动。</div>';
      const 对局 = Object.entries(进度.对局 || {});
      if (项目.流程 === '循环' || 项目.流程 === '循环后淘汰') {
        const 分组表 = 运行时()?.生成循环积分表?.(赛事, this.项目名) || {};
        const 玩家参赛者ID = Object.entries(项目.参赛者 || {}).find(([, 记录]) => 记录?.成员?.includes(this.玩家名) || 记录?.名称 === this.玩家名)?.[0];
        const 玩家分组 = Object.entries(分组表).find(([, 排名]) => 排名.some(记录 => 记录.参赛者ID === 玩家参赛者ID))?.[0];
        const 展示分组 = 玩家分组 ? [[玩家分组, 分组表[玩家分组]]] : Object.entries(分组表).slice(0, 1);
        return `<div class="cp-rule-band"><h4>循环分组</h4><div class="cp-rule-tags"><span>共 ${Object.keys(分组表).length} 组</span><span>${玩家分组 ? `当前显示 ${玩家分组} 组` : '显示首组摘要'}</span></div></div>
          <div class="cp-groups">${展示分组.map(([分组, 排名]) => `<section class="cp-group"><h4>${转义(分组)}组</h4><table class="cp-table compact"><thead><tr><th>#</th><th>参赛者</th><th>赛</th><th>胜</th><th>平</th><th>负</th><th>积分</th></tr></thead><tbody>${排名.slice(0, 32).map(记录 => `<tr class="${记录.排名 <= 2 ? 'advance' : ''}"><td>${记录.排名}</td><td>${转义(记录.名称)}</td><td>${记录.场次}</td><td>${记录.胜}</td><td>${记录.平}</td><td>${记录.负}</td><td><b>${记录.积分}</b></td></tr>`).join('')}</tbody></table></section>`).join('')}</div>${this.渲染对局列表(进度, 对局)}`;
      }
      return this.渲染对局列表(进度, 对局);
    }

    渲染对局列表(进度, 对局) {
      return `<div class="cp-schedule"><h4>赛程</h4>${对局.slice(0, 120).map(([ID, 记录]) => {
        const 双方 = (记录.参赛者 || []).map(参赛者ID => 进度.实体?.[参赛者ID]?.名称 || '待实体化参赛者');
        const 玩家相关 = (记录.参赛者 || []).some(参赛者ID => 进度.实体?.[参赛者ID]?.成员?.includes(this.玩家名));
        const 胜者 = 记录.赛果?.结果;
        return `<article class="cp-match"><div class="cp-match-meta"><span>${记录.分组 ? `${转义(记录.分组)}组 · ` : ''}第${记录.轮次}轮</span><small>tick ${记录.开始tick ?? '-'}</small></div>
          <div class="cp-match-sides">${双方.map((名称, index) => `<b class="${胜者 === 记录.参赛者[index] ? 'winner' : ''}">${转义(名称)}</b>`).join('<i>VS</i>')}</div>
          <div class="cp-match-result">${记录.赛果 ? `结果：${转义(进度.实体?.[胜者]?.名称 || 胜者)}` : '待赛'}</div>
          <div class="cp-match-actions">${玩家相关 && !记录.赛果 ? `<button type="button" class="cp-command" data-prepare="${转义(ID)}">进入比赛</button>` : ''}</div></article>`;
      }).join('')}</div>`;
    }

    绑定() {
      this.容器.querySelectorAll('[data-event]').forEach(按钮 => 按钮.onclick = () => { this.赛事ID = 按钮.dataset.event; this.页面 = '总览'; this.渲染(); });
      this.容器.querySelectorAll('[data-project]').forEach(按钮 => 按钮.onclick = () => { this.项目名 = 按钮.dataset.project; this.页面 = '总览'; this.渲染(); });
      this.容器.querySelectorAll('[data-page]').forEach(按钮 => 按钮.onclick = () => { this.页面 = 按钮.dataset.page; this.渲染(); });
      this.容器.querySelector('[data-start]')?.addEventListener('click', () => this.处理('启动赛事', { 赛事ID: this.赛事ID }));
      this.容器.querySelector('[data-simulate]')?.addEventListener('click', () => this.处理('模拟场外比赛', { 赛事ID: this.赛事ID }));
      this.容器.querySelectorAll('[data-revoke]').forEach(按钮 => 按钮.onclick = () => this.处理('撤销权限', { 权限ID: 按钮.dataset.revoke }));
      this.容器.querySelectorAll('[data-claim]').forEach(按钮 => 按钮.onclick = () => this.处理('领取物品选择', { 权限ID: 按钮.dataset.claim, 物品: this.容器.querySelector(`[data-choice="${CSS.escape(按钮.dataset.claim)}"]`)?.value || '' }));
      this.容器.querySelectorAll('[data-prepare]').forEach(按钮 => 按钮.onclick = async () => {
        const 载荷 = { 赛事ID: this.赛事ID, 项目: this.项目名, 对局ID: 按钮.dataset.prepare };
        const 结果 = await this.处理('准备玩家对局', 载荷);
        if (结果?.ok) this.选项.onStartMatch?.({ ...载荷, 结果 });
      });
      this.容器.querySelector('[data-register]')?.addEventListener('submit', 事件 => {
        事件.preventDefault();
        const 表单 = new FormData(事件.currentTarget);
        this.处理('报名', {
          赛事ID: this.赛事ID,
          项目: this.项目名,
          名称: 文本(表单.get('名称')),
          成员: 文本(表单.get('成员')).split(/[、，,]/).map(文本).filter(Boolean),
          持有人: this.玩家名,
        });
      });
      this.容器.querySelectorAll('[data-retry]').forEach(按钮 => 按钮.onclick = async () => { await 窗口函数('__LWCS_ARCHIVE_COMPLETED_COMPETITION__')?.(按钮.dataset.retry); await this.加载归档(); });
      this.容器.querySelectorAll('[data-restore]').forEach(按钮 => 按钮.onclick = async () => { await 窗口函数('__LWCS_RESTORE_ARCHIVED_COMPETITION__')?.(按钮.dataset.restore); await this.加载归档(); });
    }

    async 处理(动作, 载荷) {
      try {
        const 结果 = await this.执行(动作, 载荷);
        window.toastr?.success?.('操作已完成');
        return 结果;
      } catch (错误) {
        window.toastr?.error?.(错误?.message || String(错误));
        return null;
      }
    }
  }

  window.mountCompetitionUI = (容器, 快照, 选项 = {}) =>
    new 赛事权限界面(容器, 快照, { ...选项, mode: 'competition' });
  window.mountPrivilegeUI = (容器, 快照, 选项 = {}) =>
    new 赛事权限界面(容器, 快照, { ...选项, mode: 'privilege' });
})();

/* Test-only BattleUI fixtures. Injected by tools/battle_ui_test_source.mjs. */
    function 构建召唤夹具单位(名称, 阵营 = '玩家') {
      return bindCombatParticipant({
        name: 名称,
        type: 阵营 === '玩家' ? '强攻系' : '敏攻系',
        lv: 45,
        hp: 1200,
        hp_max: 1200,
        HP: 1200,
        HP上限: 1200,
        体力: 900,
        体力上限: 900,
        sp: 800,
        sp_max: 800,
        men: 600,
        men_max: 600,
        str: 180,
        def: 120,
        agi: 110,
        状态效果: {},
        持续效果: {},
      });
    }

    function 构建召唤夹具战斗态(配置 = {}) {
      const 宿主 = 构建召唤夹具单位('夹具宿主', '玩家');
      const 敌人 = 构建召唤夹具单位('夹具敌人', '敌方');
      const combatData = {
        回合: 1,
        战斗类型: '召唤夹具',
        阶段: 战斗阶段枚举_V1.宣告,
        参战者: { team_player: [宿主], team_enemy: [敌人] },
      };
      const 来源状态键 = `召唤:${配置.名称 || '夹具召唤物'}`;
      const 召唤状态 = {
        类型: 'buff',
        层数: 1,
        duration: Math.max(1, Number(配置.持续回合 || 3)),
        状态效果: {},
        战斗效果: createEmptyCombatEffectMap(),
          召唤物: {
            召唤单位类型: 配置.类型 || '魂兽',
            召唤物名称: 配置.名称 || '夹具召唤物',
            召唤数量: Math.max(1, Number(配置.数量 || 1)),
            行动模式: 配置.行动模式 || '自主行动',
          },
      };
      if (配置.继承属性比例 > 0) 召唤状态.召唤物.继承属性比例 = 配置.继承属性比例;
      else 召唤状态.召唤物.强度 = Number(配置.强度 || 1);
      宿主.状态效果[来源状态键] = 召唤状态;
      const 召唤单位 = 注册召唤运行态单位(combatData, 宿主, 来源状态键, 召唤状态);
      return { combatData, 宿主, 敌人, 召唤单位, 来源状态键 };
    }

    function 断言召唤夹具(条件, 文本) {
      if (!条件) throw new Error(`召唤夹具失败:${文本}`);
    }

    function 执行单个召唤夹具(名称, 执行函数) {
      const 日志 = [];
      try {
        执行函数(日志);
        return { ok: true, name: 名称, logs: 日志 };
      } catch (错误) {
        return { ok: false, name: 名称, logs: 日志, failedAt: String(错误?.message || 错误 || '未知失败') };
      }
    }

    function 运行召唤夹具(名称 = '') {
      const 夹具列表 = [];
      const 注册 = (夹具名, 执行函数) => {
        if (!名称 || 名称 === 夹具名) 夹具列表.push(执行单个召唤夹具(夹具名, 执行函数));
      };
      注册('生成入表', 日志 => {
        const { combatData, 宿主, 召唤单位 } = 构建召唤夹具战斗态();
        断言召唤夹具(!!combatData.召唤单位表?.[召唤单位.召唤键], '召唤单位未入表');
        断言召唤夹具(宿主.状态效果[召唤单位.来源状态键]?.召唤物?.召唤键 === 召唤单位.召唤键, '来源镜像未写回');
        日志.push('召唤单位入表与来源镜像成立');
      });
      注册('受击治疗护盾状态', 日志 => {
        const { combatData, 敌人, 召唤单位 } = 构建召唤夹具战斗态();
        applyResolvedDamagePackage(敌人, { action_type: '夹具攻击', skill: 构建召唤普通攻击技能(敌人) }, {
          targetResults: [{ target: 召唤单位, targetName: 召唤单位.name, damage: 80, kind: 'primary' }],
        }, { primaryTarget: 召唤单位, combatData });
        断言召唤夹具(getCombatHpValue(召唤单位) < getCombatHpMaxValue(召唤单位), '召唤物未受伤');
        设置战斗血量值(召唤单位, getCombatHpValue(召唤单位) + 30);
        applyShieldToCharacter(召唤单位, 40, 2, '夹具护盾');
        召唤单位.状态效果.夹具状态 = { 类型: 'buff', duration: 1, 战斗效果: createEmptyCombatEffectMap() };
        同步召唤单位镜像(召唤单位);
        delete 召唤单位.状态效果.夹具状态;
        同步召唤单位镜像(召唤单位);
        断言召唤夹具(召唤单位.__来源状态.召唤物.生命 === getCombatHpValue(召唤单位), '非伤害同步未写回镜像');
        日志.push('受击、治疗、护盾、状态同步成立');
      });
      注册('群体护卫协同自主', 日志 => {
        const 自主 = 构建召唤夹具战斗态({ 名称: '自主召唤', 行动模式: '自主行动' });
        const 护卫 = 构建召唤夹具战斗态({ 名称: '护卫召唤', 行动模式: '护卫' });
        const 协同 = 构建召唤夹具战斗态({ 名称: '协同召唤', 行动模式: '协同攻击' });
        applyResolvedDamagePackage(自主.敌人, { action_type: '群体夹具', skill: 构建召唤普通攻击技能(自主.敌人) }, {
          targetResults: [
            { target: 自主.宿主, targetName: 自主.宿主.name, damage: 10, kind: 'primary' },
            { target: 自主.召唤单位, targetName: 自主.召唤单位.name, damage: 10, kind: 'secondary' },
          ],
        }, { primaryTarget: 自主.宿主, combatData: 自主.combatData });
        断言召唤夹具(getCombatHpValue(自主.召唤单位) < getCombatHpMaxValue(自主.召唤单位), '群体未命中召唤物');
        断言召唤夹具(!!读取护卫召唤单位(护卫.combatData, 护卫.宿主), '护卫召唤不可读');
        断言召唤夹具(执行协同召唤追击(协同.宿主, 协同.敌人, 20, 协同.combatData).includes('召唤协同追击'), '协同追击未触发');
        自主.combatData.回合 = 2;
        BATTLE_RUNTIME.beginBattleRound(自主.combatData, 自主.combatData.回合);
        断言召唤夹具(执行自主召唤行动(自主.combatData).includes('召唤自主行动'), '自主行动未在下一行动轴触发');
        日志.push('群体、护卫、协同、自主路径成立');
      });
      注册('收回死亡精神', 日志 => {
        const 收回 = 构建召唤夹具战斗态({ 名称: '可收回召唤', 行动模式: '协同攻击' });
        主动收回召唤单位(收回.combatData, 收回.宿主, 收回.召唤单位.召唤键);
        断言召唤夹具(召唤已被主动收回(收回.combatData, 收回.宿主, 收回.召唤单位.类型, 收回.召唤单位.name), '收回锁未写入');
        断言召唤夹具(!读取召唤单位列表(收回.combatData, { 宿主: 收回.宿主 }).length, '收回后仍在表内');
        const 死亡 = 构建召唤夹具战斗态({ 名称: '继承召唤', 继承属性比例: 0.3, 行动模式: '协同攻击' });
        设置战斗血量值(死亡.召唤单位, 0);
        断言召唤夹具(处理召唤单位死亡(死亡.combatData, 死亡.召唤单位).includes('死亡反噬'), '继承型死亡未反噬');
        const 精神 = 构建召唤夹具战斗态({ 名称: '精神召唤', 行动模式: '自主行动' });
        精神.宿主.men = 0;
        断言召唤夹具(BATTLE_RUNTIME.refreshSummonMentalLoad(精神.combatData, 精神.宿主).includes('精神'), '精神枯竭未消散');
        const 消散事件 = (精神.combatData.__battleEventLedger || []).find(event =>
          event?.eventKind === 'blocked_action' &&
          event?.actionType === 'summon_control' &&
          event?.meta?.restriction === 'dissipated' &&
          event?.meta?.reasonCode === 'SUMMON_CONTROL_OVERLOAD'
        );
        断言召唤夹具(!!消散事件?.chainNodeId, '精神消散未写入召唤控制账本');
        断言召唤夹具((精神.combatData.__battleResolutionTrace || []).some(node => node.nodeId === 消散事件.chainNodeId), '精神消散未进入因果链');
        const 受限 = 构建召唤夹具战斗态({ 名称: '受限召唤', 行动模式: '自主行动' });
        受限.宿主.men_max = 100;
        受限.宿主.men = 10;
        断言召唤夹具(BATTLE_RUNTIME.refreshSummonMentalLoad(受限.combatData, 受限.宿主).includes('受限'), '精神不足未限制召唤技能');
        const 受限事件 = (受限.combatData.__battleEventLedger || []).find(event =>
          event?.eventKind === 'blocked_action' &&
          event?.actionType === 'summon_control' &&
          event?.meta?.restriction === 'skill_disabled' &&
          event?.meta?.reasonCode === 'SUMMON_CONTROL_OVERLOAD'
        );
        断言召唤夹具(!!受限事件?.chainNodeId, '精神受限未写入召唤控制账本');
        断言召唤夹具((受限.combatData.__battleResolutionTrace || []).some(node => node.nodeId === 受限事件.chainNodeId), '精神受限未进入因果链');
        const 超载 = 构建召唤夹具战斗态({ 名称: '超载召唤', 行动模式: '自主行动' });
        超载.宿主.men_max = 30;
        超载.宿主.men = 30;
        断言召唤夹具(BATTLE_RUNTIME.refreshSummonMentalLoad(超载.combatData, 超载.宿主).includes('超载'), '精神负载超限未压缩召唤物');
        const 压缩事件 = (超载.combatData.__battleEventLedger || []).find(event =>
          event?.eventKind === 'blocked_action' &&
          event?.actionType === 'summon_control' &&
          event?.meta?.restriction === 'compressed' &&
          event?.meta?.reasonCode === 'SUMMON_CONTROL_OVERLOAD'
        );
        断言召唤夹具(!!压缩事件?.chainNodeId, '精神超载压缩未写入召唤控制账本');
        断言召唤夹具((超载.combatData.__battleResolutionTrace || []).some(node => node.nodeId === 压缩事件.chainNodeId), '精神超载压缩未进入因果链');
        日志.push('收回锁、死亡反噬、精神消散、受限与超载压缩结构化成立');
      });
      注册('目标池与单体收回', 日志 => {
        const 第一 = 构建召唤夹具战斗态({ 名称: '一号召唤', 行动模式: '协同攻击' });
        const 第二状态键 = '召唤:二号召唤';
        const 第二状态 = {
          类型: 'buff',
          层数: 1,
          duration: 3,
          战斗效果: createEmptyCombatEffectMap(),
          召唤物: { 召唤单位类型: '魂兽', 召唤物名称: '二号召唤', 召唤数量: 1, 行动模式: '协同攻击', 强度: 1 },
        };
        第一.宿主.状态效果[第二状态键] = 第二状态;
        const 第二单位 = 注册召唤运行态单位(第一.combatData, 第一.宿主, 第二状态键, 第二状态);
        主动收回召唤单位(第一.combatData, 第一.宿主, 第一.召唤单位.召唤键);
        const 剩余列表 = 读取召唤单位列表(第一.combatData, { 宿主: 第一.宿主 });
        断言召唤夹具(剩余列表.length === 1 && 剩余列表[0].召唤键 === 第二单位.召唤键, '单体收回误收其他召唤物');
        设置战斗血量值(第二单位, 0);
        处理召唤单位死亡(第一.combatData, 第二单位);
        断言召唤夹具(!读取战斗阵营单位列表(第一.combatData, '玩家').some(单位 => 单位.召唤键 === 第二单位.召唤键), '已消散召唤仍在目标池');
        日志.push('单体收回与已消散目标池清理成立');
      });
      注册('分身目标隔离', 日志 => {
        const 分身态 = 构建召唤夹具战斗态({ 类型: '分身', 名称: '夹具分身', 继承属性比例: 0.45, 行动模式: '协同攻击' });
        const 召唤状态键 = '召唤:普通召唤';
        const 召唤状态 = {
          类型: 'buff',
          层数: 1,
          duration: 3,
          战斗效果: createEmptyCombatEffectMap(),
          召唤物: { 召唤单位类型: '魂兽', 召唤物名称: '普通召唤', 召唤数量: 1, 行动模式: '协同攻击', 强度: 1 },
        };
        分身态.宿主.状态效果[召唤状态键] = 召唤状态;
        const 普通召唤 = 注册召唤运行态单位(分身态.combatData, 分身态.宿主, 召唤状态键, 召唤状态);
        const 召唤物目标 = resolveSkillTargetContext({}, 分身态.宿主, 分身态.敌人, 分身态.combatData, { 原型: '状态施加', 目标: '召唤物' }).targetSet;
        const 分身目标 = resolveSkillTargetContext({}, 分身态.宿主, 分身态.敌人, 分身态.combatData, { 原型: '属性修正', 目标: '分身' }).targetSet;
        断言召唤夹具(召唤物目标.some(单位 => 单位.召唤键 === 普通召唤.召唤键), '召唤物目标未包含普通召唤');
        断言召唤夹具(!召唤物目标.some(单位 => 单位.召唤键 === 分身态.召唤单位.召唤键), '召唤物目标误包含分身');
        断言召唤夹具(分身目标.length === 1 && 分身目标[0].召唤键 === 分身态.召唤单位.召唤键, '分身目标未专门命中分身');
        主动收回召唤单位(分身态.combatData, 分身态.宿主, 分身态.召唤单位.召唤键);
        断言召唤夹具(!!读取召唤单位列表(分身态.combatData, { 宿主: 分身态.宿主 }).find(单位 => 单位.召唤键 === 分身态.召唤单位.召唤键), '收回召唤误收分身');
        日志.push('分身独立目标与召唤物目标隔离成立');
      });
      注册('批量编号重复召唤', 日志 => {
        const 基础 = 构建召唤夹具战斗态({ 名称: '占位召唤', 行动模式: '协同攻击' });
        移除召唤运行态单位(基础.combatData, 基础.召唤单位, '夹具重建');
        const 生成 = () => {
          const 编号 = 读取下一个召唤编号(基础.combatData, 基础.宿主, '其他召唤生物', '比蒙巨兽');
          const 名称 = `比蒙巨兽#${编号}`;
          const 状态键 = `召唤:${名称}`;
          const 状态 = {
            类型: 'buff',
            层数: 1,
            duration: 3,
            战斗效果: createEmptyCombatEffectMap(),
            召唤物: { 召唤单位类型: '其他召唤生物', 召唤物名称: 名称, 基础名称: '比蒙巨兽', 召唤数量: 1, 行动模式: '协同攻击', 强度: 1 },
          };
          基础.宿主.状态效果[状态键] = 状态;
          return 注册召唤运行态单位(基础.combatData, 基础.宿主, 状态键, 状态);
        };
        const 第一批 = [生成(), 生成(), 生成()];
        断言召唤夹具(第一批.map(单位 => 单位.name).join('|') === '比蒙巨兽#1|比蒙巨兽#2|比蒙巨兽#3', '批量召唤未按编号生成');
        主动收回召唤单位(基础.combatData, 基础.宿主, 第一批[1].召唤键);
        const 追加 = 生成();
        const 剩余名称 = 读取召唤单位列表(基础.combatData, { 宿主: 基础.宿主 }).map(单位 => 单位.name).sort();
        断言召唤夹具(追加.name === '比蒙巨兽#4', '重复召唤未追加新编号');
        断言召唤夹具(剩余名称.join('|') === '比蒙巨兽#1|比蒙巨兽#3|比蒙巨兽#4', '编号召唤未保持独立单位');
        日志.push('其他召唤生物批量编号、单体收回、重复追加成立');
      });
      注册('协同生成当回合行动一次', 日志 => {
        const 夹具 = 构建召唤夹具战斗态({ 名称: '一回合协同兽', 行动模式: '协同攻击', 持续回合: 1 });
        const 协同日志 = 执行协同召唤追击(夹具.宿主, 夹具.敌人, 0, 夹具.combatData);
        const 协同事件 = (夹具.combatData.__battleEventLedger || []).filter(event => event?.eventKind === 'summon_assist');
        断言召唤夹具(/召唤协同兜底/.test(协同日志), `生成当回合未获得协同兜底窗口:${协同日志}`);
        断言召唤夹具(协同事件.length === 1 && 协同事件[0]?.meta?.triggerMode === 'host_action_end', '协同兜底未按宿主动作结束记账');
        断言召唤夹具(!!协同事件[0]?.meta?.windowId && !!协同事件[0]?.meta?.grantId, '协同召唤缺少窗口或授权ID');
        断言召唤夹具(!读取召唤单位列表(夹具.combatData, { 宿主: 夹具.宿主 }).length, '持续1回合协同兽行动后未到期');
        执行协同召唤追击(夹具.宿主, 夹具.敌人, 20, 夹具.combatData);
        断言召唤夹具((夹具.combatData.__battleEventLedger || []).filter(event => event?.eventKind === 'summon_assist').length === 1, '协同召唤同回合重复行动');
        日志.push('协同召唤生成当回合获得窗口，宿主无伤时兜底攻击，且只行动一次');
      });
      注册('自主持续1回合下一行动轴一次', 日志 => {
        const 夹具 = 构建召唤夹具战斗态({ 名称: '一回合自主兽', 行动模式: '自主行动', 持续回合: 1 });
        断言召唤夹具(!执行自主召唤行动轴回合(夹具.combatData), '自主召唤生成当回合错误行动');
        断言召唤夹具(读取召唤剩余有效窗口(夹具.召唤单位) === 1, '自主召唤未行动却消耗窗口');
        夹具.combatData.回合 = 2;
        BATTLE_RUNTIME.beginBattleRound(夹具.combatData, 夹具.combatData.回合);
        const 行动日志 = 执行自主召唤行动轴回合(夹具.combatData);
        const 自主事件 = (夹具.combatData.__battleEventLedger || []).find(event =>
          event?.eventKind === 'action_start' && event?.actorName === 夹具.召唤单位.name && event?.actionType === '召唤自主行动',
        );
        断言召唤夹具(/召唤|攻击|命中|未能命中/.test(行动日志), `自主召唤下一行动轴未行动:${行动日志}`);
        断言召唤夹具(!!自主事件?.meta?.windowId && !!自主事件?.meta?.grantId, '自主召唤缺少窗口或授权ID');
        断言召唤夹具(!读取召唤单位列表(夹具.combatData, { 宿主: 夹具.宿主 }).length, '自主召唤完成一次行动后未到期');
        日志.push('自主召唤从下一行动轴开始，持续1回合只完成一次行动');
      });
      注册('护卫完整保护窗口', 日志 => {
        const 夹具 = 构建召唤夹具战斗态({ 名称: '一回合护卫兽', 行动模式: '护卫', 持续回合: 1 });
        const 护卫窗口ID = BATTLE_RUNTIME.ensureSummonWindowRuntime(夹具.召唤单位)?.windowId || '';
        断言召唤夹具(!!护卫窗口ID, '护卫召唤缺少稳定窗口ID');
        断言召唤夹具(!!读取护卫召唤单位(夹具.combatData, 夹具.宿主), '护卫召唤生成后不能立即拦截');
        断言召唤夹具(!BATTLE_RUNTIME.settleGuardSummonWindows(夹具.combatData), '护卫召唤生成回合错误消耗完整窗口');
        夹具.combatData.回合 = 2;
        BATTLE_RUNTIME.beginBattleRound(夹具.combatData, 夹具.combatData.回合);
        断言召唤夹具(!!读取护卫召唤单位(夹具.combatData, 夹具.宿主), '护卫召唤完整保护回合开始时不可用');
        const 到期日志 = BATTLE_RUNTIME.settleGuardSummonWindows(夹具.combatData);
        断言召唤夹具(/护卫保护窗口耗尽/.test(到期日志), `护卫完整窗口结束后未到期:${到期日志}`);
        日志.push('护卫召唤生成后立即可拦截，并在完整保护回合结束后消费窗口');
      });
      注册('召唤无目标明确失败', 日志 => {
        const 夹具 = 构建召唤夹具战斗态({ 名称: '无目标协同兽', 行动模式: '协同攻击', 持续回合: 1 });
        设置战斗血量值(夹具.敌人, 0);
        夹具.敌人.状态 = { ...(夹具.敌人.状态 || {}), 存活: false };
        夹具.combatData.参战者.team_enemy = [];
        const 结果日志 = 执行协同召唤追击(夹具.宿主, null, 0, 夹具.combatData);
        const 失败事件 = (夹具.combatData.__battleEventLedger || []).find(event => event?.eventKind === 'failed_action' && String(event?.reasonCode || event?.meta?.reasonCode || '').trim() === 'NO_VALID_TARGET');
        断言召唤夹具(/没有合法集火目标/.test(结果日志) && !!失败事件, '召唤无目标未记录明确失败');
        断言召唤夹具(!(夹具.combatData.__battleEventLedger || []).some(event => event?.eventKind === 'hit_result' && event?.actorName === 夹具.召唤单位.name), '召唤无目标制造了虚假攻击');
        日志.push('召唤无合法目标时记录失败并消费窗口，不制造攻击事实');
      });
      注册('协同宿主受控与失能', 日志 => {
        const 受控 = 构建召唤夹具战斗态({ 名称: '受控协同兽', 行动模式: '协同攻击', 持续回合: 1 });
        受控.宿主.状态效果.夹具硬控 = { 类型: 'debuff', duration: 1, 战斗效果: { ...createEmptyCombatEffectMap(), skip_turn: true } };
        const 受控日志 = 执行协同召唤追击(受控.宿主, 受控.敌人, 0, 受控.combatData);
        断言召唤夹具(/召唤协同兜底/.test(受控日志), '宿主受控后协同召唤没有在动作结束兜底');
        const 失能 = 构建召唤夹具战斗态({ 名称: '失能协同兽', 行动模式: '协同攻击', 持续回合: 2 });
        设置战斗血量值(失能.宿主, 0);
        const 失能日志 = 执行协同召唤追击(失能.宿主, 失能.敌人, 0, 失能.combatData);
        断言召唤夹具(/宿主失去战斗能力/.test(失能日志), '宿主失能后召唤物未明确离场');
        断言召唤夹具(!(失能.combatData.__battleEventLedger || []).some(event => event?.eventKind === 'hit_result' && event?.actorName === 失能.召唤单位.name), '宿主失能后召唤物制造虚假攻击');
        日志.push('宿主受控时协同兜底，宿主失能时召唤物明确离场');
      });
      注册('召唤评分纯计算', 日志 => {
        const 夹具 = 构建召唤夹具战斗态({ 名称: '评分基准兽', 行动模式: '协同攻击', 持续回合: 2 });
        移除召唤运行态单位(夹具.combatData, 夹具.召唤单位, '评分夹具重置');
        夹具.宿主.men = 10000;
        夹具.宿主.men_max = 10000;
        const before = JSON.stringify(夹具.combatData);
        const mutationBefore = 战斗评分预估写入次数;
        const ev = 估算召唤生成释放权重({ 原型: '召唤生成', 召唤单位类型: '其他召唤生物', 召唤物名称: '评分兽', 数量: 1, 行动模式: '协同攻击', 强度: 1, 持续回合: 2 }, 夹具.宿主, 夹具.敌人, { combatData: 夹具.combatData });
        const 单窗口EV = 估算召唤生成释放权重({ 原型: '召唤生成', 召唤单位类型: '其他召唤生物', 召唤物名称: '评分兽', 数量: 1, 行动模式: '协同攻击', 强度: 1, 持续回合: 1 }, 夹具.宿主, 夹具.敌人, { combatData: 夹具.combatData });
        断言召唤夹具(Number.isFinite(ev) && ev > 0, `召唤EV未计算实际收益:${ev}`);
        断言召唤夹具(单窗口EV <= ev, `减少召唤窗口反而提高召唤收益:${ev}/${单窗口EV}`);
        断言召唤夹具(before === JSON.stringify(夹具.combatData) && mutationBefore === 战斗评分预估写入次数, '召唤评分预估写入了真实战斗态');
        日志.push(`召唤EV=${ev}/${单窗口EV}，窗口单调且预估阶段无战斗态写入`);
      });
      return { ok: 夹具列表.every(item => item.ok), results: 夹具列表 };
    }

    root.__LWCS_LIST_SUMMON_FIXTURES__ = () => ['生成入表', '受击治疗护盾状态', '群体护卫协同自主', '收回死亡精神', '目标池与单体收回', '分身目标隔离', '批量编号重复召唤', '协同生成当回合行动一次', '自主持续1回合下一行动轴一次', '护卫完整保护窗口', '召唤无目标明确失败', '协同宿主受控与失能', '召唤评分纯计算'];
    root.__LWCS_RUN_SUMMON_FIXTURE_BATCH__ = (名称 = '') => 运行召唤夹具(名称);

    function 构建战斗回归夹具单位(名称, 系别 = '强攻系') {
      return bindCombatParticipant({
        name: 名称,
        type: 系别,
        lv: 35,
        等级: 35,
        战斗经验: 17,
        hp: 1600,
        hp_max: 1600,
        HP: 1600,
        HP上限: 1600,
        sp: 2000,
        sp_max: 2000,
        魂力: 2000,
        魂力上限: 2000,
        sta: 1200,
        vit: 1200,
        vit_max: 1200,
        体力: 1200,
        体力上限: 1200,
        men: 900,
        men_max: 900,
        精神力: 900,
        精神力上限: 900,
        str: 系别 === '敏攻系' ? 150 : 220,
        def: 140,
        agi: 系别 === '敏攻系' ? 260 : 120,
        状态效果: {},
        持续效果: {},
        背包: {},
      });
    }

    const 战斗回归第一魂技默认名 = '锁魄毒印';
    const 战斗回归敌方快攻技能名 = '疾影突刺';
    const 战斗回归敌方压制技能名 = '裂势冲拳';

    function 构建战斗回归第一魂技(名称 = 战斗回归第一魂技默认名, 消耗 = '魂力:120') {
      return {
        魂技名: 名称,
        name: 名称,
        技能分类: '控制',
        目标: '敌方单体',
        消耗,
        前摇: 10,
        _效果数组: [
          { 原型: '状态施加', 目标: '单体', 生效方式: '独立生效', 状态: '位移限制', 持续回合: 1, 计算层效果: { cast_speed_penalty: 0.2, dodge_penalty: 0.1, lock_level: 1 } },
          { 原型: '状态施加', 目标: '单体', 生效方式: '独立生效', 状态: '中毒', 持续回合: 2, 计算层效果: { dot_damage_ratio: 0.03, hit_penalty: 0.05 } },
        ],
      };
    }

    function 战斗回归输出魂技(名称, 目标 = '敌方单体', 前摇 = 10, 威力倍率 = 90, 伤害类型 = '近身攻击') {
      return {
        魂技名: 名称,
        name: 名称,
        技能分类: '输出',
        目标,
        消耗: '无',
        前摇,
        _效果数组: [
          { 原型: '伤害结算', 目标: /群体/.test(String(目标 || '')) ? '群体' : '单体', 生效方式: '独立生效', 威力倍率, 伤害类型, 防御穿透: 0 },
        ],
      };
    }

    function 构建战斗回归夹具战斗态() {
      const 玩家 = 构建战斗回归夹具单位('夹具玩家', '强攻系');
      const 友方 = 构建战斗回归夹具单位('夹具友方', '辅助系');
      const 敌人 = 构建战斗回归夹具单位('夹具敌人', '敏攻系');
      玩家.第1武魂 = {
        表象名称: '夹具武魂',
        第1魂环: {
          第1魂技: 构建战斗回归第一魂技(),
        },
      };
      const combatData = {
        回合: 1,
        战斗类型: '回归夹具',
        战斗意图: '点到为止',
        阶段: 战斗阶段枚举_V1.宣告,
        参战者: { team_player: [玩家, 友方], team_enemy: [敌人] },
      };
      return { combatData, 玩家, 友方, 敌人 };
    }

    function 断言战斗回归夹具(条件, 文本) {
      if (!条件) throw new Error(`战斗回归夹具失败:${文本}`);
    }

    function 使用战斗回归桥接(combatData, 角色表, 执行函数) {
      const 原桥接 = root.BattleUIBridge;
      const 物品表 = { 魂技造物: {} };
      root.BattleUIBridge = {
        ...(原桥接 || {}),
        getBattleContext: () => combatData,
        getMVU: 路径 => {
          const 文本 = String(路径 || '').trim();
          if (文本 === 'world.战斗') return combatData;
          if (文本 === 'world.时间.tick') return 0;
          if (文本 === 'sys.玩家名') return '夹具玩家';
          if (文本 === '物品') return 物品表;
          const 角色命中 = 文本.match(/^char\.([^\.]+)(?:\.(.+))?$/);
          if (角色命中) {
            const 角色 = 角色表?.[角色命中[1]];
            if (!角色) return null;
            if (!角色命中[2]) return 角色;
            if (角色命中[2] === '背包') return 角色.背包 || {};
            return 角色[角色命中[2]];
          }
          return 原桥接?.getMVU?.(路径);
        },
      };
      try {
        return 执行函数(物品表);
      } finally {
        root.BattleUIBridge = 原桥接;
      }
    }

    function 执行单个战斗回归夹具(名称, 执行函数) {
      const 日志 = [];
      try {
        执行函数(日志);
        return { ok: true, name: 名称, logs: 日志 };
      } catch (错误) {
        return { ok: false, name: 名称, logs: 日志, failedAt: String(错误?.message || 错误 || '未知失败') };
      }
    }

    function 构建战斗回归动作声明(...actions) {
      const 有效动作 = actions.filter(action => action && typeof action === 'object');
      return {
        actorName: String(有效动作[0]?.actor_name || '').trim(),
        actions: 有效动作,
        primaryTargetName: String(有效动作.find(action => action.target_name)?.target_name || '').trim(),
      };
    }

    function 运行战斗回归夹具(名称 = '') {
      const 夹具列表 = [];
      const 注册 = (夹具名, 执行函数) => {
        if (!名称 || 名称 === 夹具名) 夹具列表.push(执行单个战斗回归夹具(夹具名, 执行函数));
      };
      注册('第一魂技槽位归属', 日志 => {
        const { 玩家 } = 构建战斗回归夹具战斗态();
        const entry = {
          actor_name: '夹具玩家',
          action_type: '释放魂技',
          skill: { 魂技名: '错误缓存第一魂技', name: '错误缓存第一魂技', 消耗: '魂力:9999' },
          __魂环路径: ['第1武魂', '第1魂环'],
          __魂技槽位: '第1魂技',
        };
        const action = buildPlayerActionFromDeclaration(entry, '夹具玩家', 玩家);
        断言战斗回归夹具(!!action, '当前玩家动作未生成');
        断言战斗回归夹具(action.skill?.魂技名 === 战斗回归第一魂技默认名 || action.skill?.name === 战斗回归第一魂技默认名, '未按当前角色魂环槽位重取技能');
        断言战斗回归夹具(action.skill?.消耗 === '魂力:120', '仍沿用动作声明中的缓存技能数据');
        断言战斗回归夹具(action.actor_name === '夹具玩家', '行动者未绑定当前玩家');
        断言战斗回归夹具(Array.isArray(action.skill.__魂环路径) && action.skill.__魂环路径.join('/') === '第1武魂/第1魂环', '魂环路径未保留');
        断言战斗回归夹具(action.skill.__魂技槽位 === '第1魂技', '魂技槽位未保留');
        断言战斗回归夹具(buildPlayerActionFromDeclaration(entry, '其他角色', 玩家) === null, '外部行动者动作未被拒绝');
        日志.push('第一魂技来源、槽位、行动者归属成立');
      });
      注册('固定消耗只扣一次', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        const action = buildPlayerActionFromDeclaration({
          actor_name: '夹具玩家',
          action_type: '释放魂技',
          skill: { 魂技名: '错误缓存第一魂技' },
          __魂环路径: ['第1武魂', '第1魂环'],
          __魂技槽位: '第1魂技',
        }, '夹具玩家', 玩家);
        使用战斗回归桥接(combatData, { 夹具玩家: 玩家, 夹具敌人: 敌人 }, () => {
          applyActionCost(玩家, action, 敌人, combatData);
          applyActionCost(玩家, action, 敌人, combatData);
        });
        断言战斗回归夹具(Number(玩家.sp) === 1880 && Number(玩家.魂力) === 1880, `固定消耗异常:${玩家.sp}/${玩家.魂力}`);
        日志.push('固定魂力消耗只扣一次');
      });
      注册('百分比普通魂技阻断不扣费', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.第1武魂.第1魂环.第1魂技 = 构建战斗回归第一魂技('百分比错误魂技', '魂力:50%');
        const action = buildPlayerActionFromDeclaration({
          actor_name: '夹具玩家',
          action_type: '释放魂技',
          skill: { 魂技名: '百分比错误魂技' },
          __魂环路径: ['第1武魂', '第1魂环'],
          __魂技槽位: '第1魂技',
        }, '夹具玩家', 玩家);
        let log = '';
        使用战斗回归桥接(combatData, { 夹具玩家: 玩家, 夹具敌人: 敌人 }, () => {
          log = applyActionCost(玩家, action, 敌人, combatData);
        });
        断言战斗回归夹具(action.action_type === '施法失败', '百分比普通魂技未被阻断');
        断言战斗回归夹具(Number(玩家.sp) === 2000 && Number(玩家.魂力) === 2000, '百分比普通魂技阻断后仍扣费');
        断言战斗回归夹具(/百分比启动消耗|固定数值/.test(log), '阻断日志未说明百分比启动消耗');
        日志.push('普通魂技百分比启动消耗阻断且不扣费');
      });
      注册('目标语义不串线', 日志 => {
        const { combatData, 玩家, 友方, 敌人 } = 构建战斗回归夹具战斗态();
        const selfSkill = normalizeSkillData({ name: '自稳', 技能分类: '辅助', 目标: '自身', 消耗: '无', _效果数组: [{ 原型: '状态施加', 目标: '自身', 状态名称: '自稳' }] }, '自稳');
        const allySkill = normalizeSkillData({ name: '援护', 技能分类: '辅助', 目标: '友方单体', 消耗: '无', _效果数组: [{ 原型: '护盾变化', 目标: '单体', 护盾模式: '正向护盾', 数值: '+100' }] }, '援护');
        const enemySkill = normalizeSkillData({ name: '压制', 技能分类: '输出', 目标: '敌方单体', 消耗: '无', _效果数组: [{ 原型: '伤害结算', 目标: '单体', 生效方式: '独立生效', 威力倍率: 50, 伤害类型: '近身攻击' }] }, '压制');
        const allBuff = normalizeSkillData({ name: '全场鼓舞', 技能分类: '辅助', 目标: '全场', 消耗: '无', _效果数组: [{ 原型: '属性修正', 目标: '全场', 数值: '+10%' }] }, '全场鼓舞');
        断言战斗回归夹具(resolveSkillTargetContext(selfSkill, 玩家, 敌人, combatData).primaryTarget === 玩家, '自身技能目标串线');
        断言战斗回归夹具(resolveSkillTargetContext(allySkill, 玩家, 友方, combatData).primaryTarget === 友方, '友方技能目标串线');
        断言战斗回归夹具(resolveSkillTargetContext(enemySkill, 玩家, 敌人, combatData).primaryTarget === 敌人, '敌方技能目标串线');
        断言战斗回归夹具(!判定单挑动作敌对({ action_type: '释放魂技', skill: allBuff }, 玩家, 敌人, combatData), '全场纯增益误判为敌对');
        const 临时数据 = 构建单挑临时战斗数据(玩家, 玩家, 'player', combatData);
        断言战斗回归夹具(!临时数据.参战者.team_enemy.some(unit => isCombatUnitIdentityMatch(unit, 玩家.name)), '自身动作把自己塞入敌方队列');
        日志.push('自身、友方、敌方、全场目标语义成立');
      });
      注册('造物给友方入包补丁', 日志 => {
        const { combatData, 玩家, 友方, 敌人 } = 构建战斗回归夹具战斗态();
        const skill = {
          name: '夹具造物',
          魂技名: '夹具造物',
          技能分类: '辅助',
          承载方式: '造物承载',
          消耗: '魂力:100',
          _效果数组: [
            { 数量: 1, 描述: '夹具造物', 使用效果: [{ 原型: '资源变化', 目标: '自身', 资源: '魂力', 数值: '+10' }] },
          ],
        };
        let patchOps = [];
        使用战斗回归桥接(combatData, { 夹具玩家: 玩家, 夹具友方: 友方, 夹具敌人: 敌人 }, () => {
          patchOps = 构建造物承载补丁包({ ...skill, __造物产出者: 玩家 }, 友方.背包, '夹具友方').patchOps;
        });
        const paths = patchOps.map(op => String(op?.path || ''));
        断言战斗回归夹具(paths.some(path => path.includes('/char/夹具友方/背包/夹具造物')), '造物未写入友方背包路径');
        断言战斗回归夹具(!paths.some(path => path.includes('/char/夹具玩家/背包/夹具造物')), '生成给友方误写入自己背包');
        日志.push('造物生成给友方的 patch 落点成立');
      });
      注册('非敌对短前摇先完成', 日志 => {
        const { combatData, 玩家, 友方, 敌人 } = 构建战斗回归夹具战斗态();
        const fastConstruct = {
          name: '快造物',
          魂技名: '快造物',
          技能分类: '辅助',
          承载方式: '造物承载',
          消耗: '魂力:80',
          前摇: 6,
          _效果数组: [
            { 数量: 1, 描述: '快造物', 使用效果: [{ 原型: '资源变化', 目标: '自身', 资源: '魂力', 数值: '+10' }] },
          ],
        };
        const npcAttack = normalizeSkillData({
          name: '慢压制',
          技能分类: '输出',
          消耗: '无',
          前摇: 14,
          _效果数组: [{ 原型: '伤害结算', 目标: '单体', 生效方式: '独立生效', 威力倍率: 60, 伤害类型: '近身攻击' }],
        }, '慢压制');
        const action = {
          action_type: '释放魂技',
          skill: normalizeSkillData(fastConstruct, '快造物'),
          cast_time: 6,
          造物处理: '生成给友方',
          物品接收者: 友方.name,
          target_name: 友方.name,
        };
        const target = 解析单挑动作目标(action, 玩家, 敌人, combatData);
        const playerHostile = 判定单挑动作敌对(action, 玩家, target, combatData);
        const npcAction = { action_type: '主动压迫', type: '主动压迫', skill: npcAttack, cast_time: 14 };
        const npcHostile = 判定单挑动作敌对(npcAction, 敌人, 玩家, combatData);
        const playerCompletesBeforeNpc = !playerHostile && 读取单挑动作前摇(action) <= 读取单挑动作前摇(npcAction);
        const completedReaction = { type: '无法反应', log: `[先手压制] ${getCombatReportUnitName(玩家, '我方')}刚完成【${action?.skill?.name || action?.skill?.魂技名 || action?.action_type || '行动'}】，来不及追加防守。`, skill: null, def_mult: 1 };
        let patchOps = [];
        使用战斗回归桥接(combatData, { 夹具玩家: 玩家, 夹具友方: 友方, 夹具敌人: 敌人 }, () => {
          const costLog = applyActionCost(玩家, action, target, combatData);
          const result = executeClash(action, 构建单挑配合动作(玩家, target, action), 构建单挑临时战斗数据(玩家, target, 'player', combatData));
          patchOps = result.extraPatchOps || [];
          断言战斗回归夹具(/战前消耗/.test(costLog), '先完成非敌对动作未扣费');
        });
        断言战斗回归夹具(playerCompletesBeforeNpc && npcHostile, '短前摇非敌对动作未按完成后承压处理');
        断言战斗回归夹具(!/正在执行|未能完成/.test(completedReaction.log), '已完成动作反应文本仍像未完成');
        断言战斗回归夹具(Number(玩家.sp) === 1920 && Number(玩家.魂力) === 1920, '短前摇非敌对动作扣费异常');
        断言战斗回归夹具(patchOps.some(op => String(op?.path || '').includes('/char/夹具友方/背包/快造物')), '短前摇造物未入目标友方背包');
        日志.push('短前摇非敌对动作先完成、扣费与入包成立');
      });
      注册('非敌对长前摇被打断不落地', 日志 => {
        const { combatData, 玩家, 友方, 敌人 } = 构建战斗回归夹具战斗态();
        const slowConstruct = {
          name: '慢造物',
          魂技名: '慢造物',
          技能分类: '辅助',
          承载方式: '造物承载',
          消耗: '魂力:300',
          前摇: 28,
          _效果数组: [
            { 数量: 1, 描述: '慢造物', 使用效果: [{ 原型: '资源变化', 目标: '自身', 资源: '魂力', 数值: '+10' }] },
          ],
        };
        const npcInterrupt = normalizeSkillData({
          name: '先制截断',
          技能分类: '输出',
          消耗: '无',
          前摇: 5,
          _效果数组: [
            { 原型: '伤害结算', 目标: '单体', 生效方式: '独立生效', 威力倍率: 120, 伤害类型: '近身攻击' },
            { 原型: '状态施加', 目标: '单体', 状态: '眩晕', 计算层效果: { skip_turn: true } },
          ],
        }, '先制截断');
        const action = {
          action_type: '释放魂技',
          skill: normalizeSkillData(slowConstruct, '慢造物'),
          cast_time: 28,
          造物处理: '生成给友方',
          物品接收者: 友方.name,
          target_name: 友方.name,
        };
        const target = 解析单挑动作目标(action, 玩家, 敌人, combatData);
        const playerHostile = 判定单挑动作敌对(action, 玩家, target, combatData);
        const npcAction = { action_type: '主动压迫', type: '主动压迫', skill: npcInterrupt, cast_time: 5 };
        const npcFirst = 判定单挑动作敌对(npcAction, 敌人, 玩家, combatData) && (!playerHostile || 读取单挑动作前摇(npcAction) < 读取单挑动作前摇(action));
        断言战斗回归夹具(npcFirst, 'NPC 未在长前摇非敌对动作前抢先');
        断言战斗回归夹具(Number(玩家.sp) === 2000 && Number(玩家.魂力) === 2000, '长前摇被打断前不应扣费');
        使用战斗回归桥接(combatData, { 夹具玩家: 玩家, 夹具友方: 友方, 夹具敌人: 敌人 }, () => {
          const supportCombatData = 构建单挑临时战斗数据(玩家, target, 'player', combatData);
          断言战斗回归夹具(!supportCombatData.参战者.team_enemy.some(unit => isCombatUnitIdentityMatch(unit, 玩家.name)), '未完成非敌对动作把自己塞入敌方');
        });
        日志.push('长前摇非敌对动作可被先制，未完成前不扣费不落地');
      });
      注册('防御时 NPC 仍主动规划', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        敌人.第1武魂 = {
          表象名称: '敌方武魂',
          第1魂环: {
            第1魂技: {
              魂技名: '敌方快攻',
              name: '敌方快攻',
              技能分类: '输出',
              目标: '敌方单体',
              消耗: '无',
              前摇: 8,
              _效果数组: [{ 原型: '伤害结算', 目标: '单体', 生效方式: '独立生效', 威力倍率: 90, 伤害类型: '近身攻击' }],
            },
          },
        };
        const playerDefense = { action_type: '防御', type: '防御', skill: normalizeSkillData({ name: '防御', 技能分类: '防御', 消耗: '无', 前摇: 10 }, '防御'), cast_time: 10 };
        const npcActorEntry = { char: 敌人, side: 'enemy' };
        const npcTargets = chooseTargetForActor(npcActorEntry, { combatData }) || { enemyTarget: 玩家, allyTarget: 敌人 };
        const npcAction = buildAutoActionForActor(npcActorEntry, npcTargets, { combatData, observedTargetAction: playerDefense });
        断言战斗回归夹具(!!npcAction, 'NPC 未生成主动规划动作');
        断言战斗回归夹具(!/战术待机|观察/.test(String(npcAction.action_type || npcAction.type || '')), '玩家防御导致 NPC 冻结待机');
        断言战斗回归夹具(判定单挑动作敌对(npcAction, 敌人, 玩家, combatData), 'NPC 主动规划未形成敌对动作');
        日志.push(`玩家防御时 NPC 仍主动规划:${npcAction.skill?.name || npcAction.action_type || npcAction.type}`);
      });
      注册('非攻击动作集合不冻结 NPC', 日志 => {
        const 构建敌方快攻态 = () => {
          const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
          敌人.第1武魂 = {
            表象名称: '敌方武魂',
            第1魂环: {
              第1魂技: 战斗回归输出魂技('敌方快攻', '敌方单体', 8, 90, '近身攻击'),
            },
          };
          return { combatData, 玩家, 敌人 };
        };
        const 场景列表 = [
          {
            名称: '防御',
            动作: () => ({ action_type: '防御', type: '防御', skill: normalizeSkillData({ name: '防御', 技能分类: '防御', 消耗: '无', 前摇: 10 }, '防御'), cast_time: 10 }),
          },
          {
            名称: '闪避',
            动作: () => ({ action_type: '闪避', type: '闪避', skill: normalizeSkillData({ name: '闪避', 技能分类: '防御', 消耗: '体力:5', 前摇: 12 }, '闪避'), cast_time: 12 }),
          },
          {
            名称: '造物',
            动作: 玩家 => ({
              action_type: '释放魂技',
              type: '释放魂技',
              skill: normalizeSkillData({
                name: '战术造物',
                魂技名: '战术造物',
                技能分类: '辅助',
                承载方式: '造物承载',
                目标: '自身',
                消耗: '魂力:60',
                前摇: 8,
                _效果数组: [{ 数量: 1, 描述: '战术造物', 使用效果: [{ 原型: '资源变化', 目标: '自身', 资源: '魂力', 数值: '+10' }] }],
              }, '战术造物'),
              cast_time: 8,
              造物处理: '生成到自己背包',
              target_name: 玩家.name,
            }),
          },
          {
            名称: '自身增益',
            动作: () => ({
              action_type: '释放魂技',
              type: '释放魂技',
              skill: normalizeSkillData({
                name: '自稳增益',
                魂技名: '自稳增益',
                技能分类: '辅助',
                目标: '自身',
                消耗: '魂力:40',
                前摇: 8,
                _效果数组: [{ 原型: '状态施加', 目标: '自身', 状态名称: '自稳增益' }],
              }, '自稳增益'),
              cast_time: 8,
            }),
          },
        ];
        场景列表.forEach(场景 => {
          const { combatData, 玩家, 敌人 } = 构建敌方快攻态();
          const playerAction = 场景.动作(玩家);
          const npcActorEntry = { char: 敌人, side: 'enemy' };
          const npcTargets = chooseTargetForActor(npcActorEntry, { combatData }) || { enemyTarget: 玩家, allyTarget: 敌人 };
          const npcAction = buildAutoActionForActor(npcActorEntry, npcTargets, { combatData, observedTargetAction: playerAction });
          断言战斗回归夹具(!判定单挑动作敌对(playerAction, 玩家, 敌人, combatData), `${场景.名称} 被误判为敌对动作`);
          断言战斗回归夹具(!!npcAction, `${场景.名称} 场景 NPC 未生成主动规划`);
          断言战斗回归夹具(!/战术待机|观察/.test(String(npcAction.action_type || npcAction.type || '')), `${场景.名称} 场景 NPC 冻结待机`);
          断言战斗回归夹具(判定单挑动作敌对(npcAction, 敌人, 玩家, combatData), `${场景.名称} 场景 NPC 未形成敌对动作`);
        });
        日志.push(`非攻击动作均不冻结 NPC:${场景列表.map(item => item.名称).join('、')}`);
      });
      注册('敏攻近身来袭有通用应对', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.type = '敏攻系';
        玩家.agi = 360;
        玩家.str = 170;
        玩家.final = buildCombatFinalStats(玩家);
        敌人.type = '强攻系';
        敌人.agi = 150;
        敌人.str = 260;
        敌人.final = buildCombatFinalStats(敌人);
        敌人.第1武魂 = {
          表象名称: '反高速武魂',
          第1魂环: {
            第1魂技: 战斗回归输出魂技('短截拳', '敌方单体', 8, 88, '近身攻击'),
            第2魂技: 战斗回归输出魂技('横扫压制', '敌方群体', 14, 96, '远程攻击'),
          },
        };
        const playerAction = {
          action_type: '释放魂技',
          type: '释放魂技',
          skill: normalizeSkillData(战斗回归输出魂技('高速切入', '敌方单体', 8, 110, '近身攻击'), '高速切入'),
          cast_time: 8,
        };
        const 反高速窗口 = 评估反高速应对窗口(敌人, 玩家, playerAction, combatData);
        const 应招候选 = 构建应招候选池(敌人, 玩家, playerAction, combatData);
        断言战斗回归夹具(反高速窗口.成立, '敏攻近身高速攻击未打开反高速窗口');
        断言战斗回归夹具(应招候选.some(item => item.name === '防守反击' && Number(item.weight || 0) > 0), '应招候选缺少防守反击');
        断言战斗回归夹具(应招候选.some(item => item.分类 === '短前摇对轰' && Number(item.weight || 0) > 0), '应招候选缺少短前摇对轰');
        断言战斗回归夹具(应招候选.some(item => item.分类 === '范围压制' && Number(item.weight || 0) > 0), '应招候选缺少范围压制');
        日志.push(`反高速候选成立:${应招候选.map(item => `${item.name}/${item.分类}:${item.weight}`).join('，')}`);
      });
      注册('反高速主动规划保留区分', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.type = '敏攻系';
        玩家.agi = 360;
        玩家.str = 170;
        玩家.final = buildCombatFinalStats(玩家);
        敌人.type = '强攻系';
        敌人.agi = 150;
        敌人.str = 260;
        敌人.final = buildCombatFinalStats(敌人);
        敌人.第1武魂 = {
          表象名称: '反高速武魂',
          第1魂环: {
            第1魂技: 战斗回归输出魂技('短截拳', '敌方单体', 8, 88, '近身攻击'),
            第2魂技: 战斗回归输出魂技('横扫压制', '敌方群体', 14, 96, '远程攻击'),
          },
        };
        const playerAction = {
          action_type: '释放魂技',
          type: '释放魂技',
          skill: normalizeSkillData(战斗回归输出魂技('高速切入', '敌方单体', 8, 110, '近身攻击'), '高速切入'),
          cast_time: 8,
        };
        const availableSkills = collectCombatSkills(敌人, []);
        const strategicContext = buildStrategicCandidates(敌人, 玩家, combatData, playerAction, 1, availableSkills, [], (type, log, skill = null, extra = {}) => ({
          type,
          log,
          skill: skill ? normalizeSkillData(skill, skill.name || skill.魂技名 || type) : null,
          def_mult: 1,
          ...extra,
        }));
        strategicContext.behaviorState.规划上下文 = 构建规划上下文(敌人, 玩家, combatData, strategicContext.behaviorState);
        strategicContext.behaviorState.战局画像 = strategicContext.behaviorState.规划上下文.战局画像;
        strategicContext.behaviorState.目标优先表 = strategicContext.behaviorState.规划上下文.目标优先表;
        strategicContext.behaviorState.战略意图 = strategicContext.behaviorState.规划上下文.战略意图;
        strategicContext.behaviorState.主动回合 = true;
        const skillContext = buildNpcSkillCandidateContext(敌人, 玩家, playerAction, availableSkills, strategicContext.behaviorState, [], false, { 主动回合: true });
        const 候选 = buildTacticalCandidates(敌人, 玩家, playerAction, strategicContext.behaviorState, skillContext, (type, log, skill = null, extra = {}) => ({
          type,
          log,
          skill: skill ? normalizeSkillData(skill, skill.name || skill.魂技名 || type) : null,
          def_mult: 1,
          ...extra,
        }), false, false);
        const 范围 = 候选.find(item => item.name === '范围压制');
        const 短截 = 候选.find(item => item.name === '短前摇对轰');
        断言战斗回归夹具(!!范围 && Number(范围.weight || 0) > 0, '主动候选缺少范围压制');
        断言战斗回归夹具(!!短截 && Number(短截.weight || 0) > 0, '主动候选缺少短前摇对轰');
        断言战斗回归夹具(范围.build().type === '范围压制', '范围压制构造后丢失动作类型');
        断言战斗回归夹具(短截.build().type === '短前摇对轰', '短前摇对轰构造后丢失动作类型');
        日志.push(`主动反高速候选成立:范围${范围.weight}，短截${短截.weight}`);
      });
      注册('防守反击强于闪避反击', 日志 => {
        const { 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.type = '敏攻系';
        玩家.final = buildCombatFinalStats(玩家);
        敌人.type = '强攻系';
        敌人.final = buildCombatFinalStats(敌人);
        const 闪避动作 = 建立行为防反动作(玩家, { 防反类型: '完美闪避', 出手承诺: 0.42, 触发概率: 0.5 });
        const 防守动作 = 建立行为防反动作(敌人, { 防反类型: '硬抗换伤', 出手承诺: 0.42, 触发概率: 0.5 });
        const 闪避威力 = Number(getPrimaryDamageEffect(闪避动作.skill, { 行为规划: true })?.威力倍率 || 0);
        const 防守威力 = Number(getPrimaryDamageEffect(防守动作.skill, { 行为规划: true })?.威力倍率 || 0);
        const 闪避压制 = 计算行为防反压制倍率('完美闪避', '近身攻击');
        const 防守压制 = 计算行为防反压制倍率('硬抗换伤', '近身攻击');
        断言战斗回归夹具(防守威力 > 闪避威力, `防守反击威力未高于闪避反击:${防守威力}/${闪避威力}`);
        断言战斗回归夹具(防守压制.反应削弱倍率 > 闪避压制.反应削弱倍率, '防守反击二次反应削弱未强于闪避反击');
        断言战斗回归夹具(防守压制.闪避削弱倍率 > 闪避压制.闪避削弱倍率, '防守反击闪避削弱未强于闪避反击');
        断言战斗回归夹具(防守压制.锁定倍率 > 闪避压制.锁定倍率, '防守反击锁定压制未强于闪避反击');
        日志.push(`防反区分成立:闪避${闪避威力}/防守${防守威力}`);
      });
      注册('闪避擦伤战报不写完全避开', 日志 => {
        const lines = buildReadableBattleReportLines([
          '[第1回合] [起招] 夹具玩家以[高速切入]起招。 [应招] 夹具敌人以[伺机闪避]应对。 [擦伤命中] 夹具敌人未能完全避开，只承受 40% 伤害。 [命中结算] 夹具玩家对夹具敌人造成 32 点最终伤害。',
        ], 3);
        const text = lines.join(' ');
        断言战斗回归夹具(/未能完全脱离|擦中|未能摆脱/.test(text), `擦伤闪避未说明失败:${text}`);
        断言战斗回归夹具(!/避开攻势，未承受有效伤害|灵巧地避开/.test(text), `擦伤闪避误写成完全避开:${text}`);
        断言战斗回归夹具(/32/.test(text), `擦伤伤害未保留:${text}`);
        日志.push(`擦伤闪避战报成立:${text}`);
      });
      注册('完全闪避战报不带伤害', 日志 => {
        const lines = buildReadableBattleReportLines([
          '[第1回合] [起招] 夹具玩家以[高速切入]起招。 [应招] 夹具敌人以[伺机闪避]应对。 [主动闪避] 夹具敌人凭借敏捷优势惊险躲过了攻击。',
        ], 3);
        const text = lines.join(' ');
        断言战斗回归夹具(/闪避成功，这一击没有命中|灵巧地闪避/.test(text), `完全闪避未说明未命中:${text}`);
        断言战斗回归夹具(!/造成了\s*\d+\s*点伤害|擦中|被攻势命中|\[命中结算\]/.test(text), `完全闪避误带伤害:${text}`);
        日志.push(`完全闪避战报成立:${text}`);
      });
      注册('完全闪避不落本次攻击负面状态', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.agi = 20;
        玩家.men_max = 20;
        玩家.final = buildCombatFinalStats(玩家);
        敌人.agi = 9999;
        敌人.final = buildCombatFinalStats(敌人);
        const 闪避可躲控制 = normalizeSkillData({
          name: '夹具毒刃牵制',
          魂技名: '夹具毒刃牵制',
          技能分类: '输出',
          目标: '敌方单体',
          消耗: '无',
          前摇: 8,
          _效果数组: [
            { 原型: '伤害结算', 目标: '单体', 生效方式: '独立生效', 威力倍率: 120, 伤害类型: '近身攻击' },
            { 原型: '状态施加', 目标: '单体', 生效方式: '独立生效', 状态: '位移限制', 状态名称: '位移限制', 持续回合: 1, 计算层效果: { cast_speed_penalty: 0.1 } },
            { 原型: '状态施加', 目标: '单体', 生效方式: '独立生效', 状态: '中毒', 状态名称: '中毒', 持续回合: 1, 计算层效果: { dot_damage: 30 } },
          ],
        }, '夹具毒刃牵制');
        const action = { action_type: '释放魂技', type: '释放魂技', skill: 闪避可躲控制, target_name: 敌人.name, cast_time: 8 };
        const 原随机 = Math.random;
        let result = null;
        try {
          Math.random = () => 0;
          result = executeClash(
            action,
            { type: '伺机闪避', action_type: '伺机闪避', skill: normalizeSkillData({ name: '伺机闪避', 技能分类: '防御', 消耗: '无', 前摇: 1 }, '伺机闪避'), def_mult: 1, log: '[应招] 夹具敌人以[伺机闪避]应对。' },
            构建单挑临时战斗数据(玩家, 敌人, 'player', combatData),
          );
        } finally {
          Math.random = 原随机;
        }
        断言战斗回归夹具(/\[(?:主动闪避|绝对闪避)\]/.test(String(result?.desc || '')), `未触发完全闪避:${result?.desc || ''}`);
        断言战斗回归夹具(!/\[状态施加\].*(位移限制|中毒)|施加了\[(?:位移限制|中毒)\]/.test(String(result?.desc || '')), `完全闪避后仍记录本次负面状态:${result?.desc || ''}`);
        断言战斗回归夹具(!敌人.状态效果?.位移限制 && !敌人.状态效果?.中毒, `完全闪避后负面状态仍落表:${Object.keys(敌人.状态效果 || {}).join('、')}`);
        断言战斗回归夹具(Number(ensureActorDecisionMemory(玩家).dodge_whiff_count || 0) > 0, `完整闪避后攻击方未记录落空:${JSON.stringify(ensureActorDecisionMemory(玩家))}`);
        const settleLog = settleConditionsAtRoundEnd(敌人, 敌人.name, combatData).log || '';
        断言战斗回归夹具(!/\[状态结算\].*(位移限制|中毒)/.test(settleLog), `完全闪避后本回合状态跳伤仍触发:${settleLog}`);
        日志.push(`完全闪避不落负面状态成立:${result?.desc || ''}`);
      });
      注册('纯控制完整闪避后不落运行态状态', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.agi = 20;
        玩家.men_max = 20;
        玩家.final = buildCombatFinalStats(玩家);
        敌人.agi = 9999;
        敌人.final = buildCombatFinalStats(敌人);
        const 纯控制 = normalizeSkillData({
          name: '夹具锁步',
          魂技名: '夹具锁步',
          技能分类: '控制',
          目标: '敌方单体',
          消耗: '无',
          前摇: 1,
          _效果数组: [
            { 原型: '状态施加', 目标: '单体', 生效方式: '独立生效', 状态: '位移限制', 状态名称: '位移限制', 持续回合: 1, 计算层效果: { cast_speed_penalty: 0.1 } },
          ],
        }, '夹具锁步');
        const action = { action_type: '释放魂技', type: '释放魂技', skill: 纯控制, target_name: 敌人.name, cast_time: 1 };
        const 原随机 = Math.random;
        let result = null;
        try {
          Math.random = () => 0;
          result = executeClash(
            action,
            { type: '伺机闪避', action_type: '伺机闪避', skill: normalizeSkillData({ name: '伺机闪避', 技能分类: '防御', 消耗: '无', 前摇: 1 }, '伺机闪避'), def_mult: 1, log: '[应招] 夹具敌人以[伺机闪避]应对。' },
            构建单挑临时战斗数据(玩家, 敌人, 'player', combatData),
          );
        } finally {
          Math.random = 原随机;
        }
        const 目标结果 = Array.isArray(result?.targetResults) ? result.targetResults.find(entry => isCombatUnitIdentityMatch(entry?.target, 敌人)) : null;
        断言战斗回归夹具(/\[(?:主动闪避|绝对闪避)\]/.test(String(result?.desc || '')), `纯控制未触发完整闪避:${result?.desc || ''}`);
        断言战斗回归夹具(!敌人.状态效果?.位移限制, `纯控制被闪避后仍落状态:${JSON.stringify(敌人.状态效果 || {})}`);
        断言战斗回归夹具(!Array.isArray(目标结果?.时光回溯预结算落地) || !目标结果.时光回溯预结算落地.includes('状态施加'), `纯控制被闪避后仍预标记状态施加:${JSON.stringify(目标结果 || null)}`);
        日志.push(`纯控制完整闪避未落运行态状态:${result?.desc || ''}`);
      });
      注册('位移限制不结算生命流失', 日志 => {
        const { combatData, 玩家 } = 构建战斗回归夹具战斗态();
        玩家.HP = 1000;
        玩家.hp = 1000;
        玩家.HP上限 = 1000;
        玩家.hp_max = 1000;
        玩家.状态效果 = {
          位移限制: {
            类型: 'debuff',
            状态名称: '位移限制',
            duration: 1,
            战斗效果: { ...createEmptyCombatEffectMap(), dot_damage: 16, dot_damage_ratio: 0.2, cast_speed_penalty: 0.2 },
          },
          中毒: {
            类型: 'debuff',
            状态名称: '中毒',
            duration: 1,
            战斗效果: { ...createEmptyCombatEffectMap(), dot_damage: 16 },
          },
        };
        const result = settleConditionsAtRoundEnd(玩家, '玩家', combatData);
        断言战斗回归夹具(!/位移限制.*损失/.test(result.log || ''), `位移限制误触发生命流失:${result.log}`);
        断言战斗回归夹具(/中毒.*损失\s*16/.test(result.log || ''), `中毒持续伤害未正常结算:${result.log}`);
        断言战斗回归夹具(Number(玩家.hp) === 984, `位移限制和中毒疑似重复扣血:${玩家.hp};${result.log}`);
        日志.push(`位移限制不再复用中毒跳伤:${result.log}`);
      });
      注册('新附加持续状态下回合才跳伤', 日志 => {
        const { combatData, 玩家 } = 构建战斗回归夹具战斗态();
        玩家.HP = 1000;
        玩家.hp = 1000;
        玩家.HP上限 = 1000;
        玩家.hp_max = 1000;
        玩家.状态效果 = {
          中毒: {
            类型: 'debuff',
            状态名称: '中毒',
            __本回合新附加: true,
            duration: 1,
            战斗效果: { ...createEmptyCombatEffectMap(), dot_damage: 16 },
          },
        };
        const first = settleConditionsAtRoundEnd(玩家, '玩家', combatData);
        断言战斗回归夹具(!/中毒.*损失/.test(first.log || ''), `新附加中毒同回合误跳伤:${first.log}`);
        断言战斗回归夹具(Number(玩家.hp) === 1000, `新附加中毒同回合误扣血:${玩家.hp};${first.log}`);
        断言战斗回归夹具(玩家.状态效果?.中毒 && 玩家.状态效果.中毒.__本回合新附加 !== true && Number(玩家.状态效果.中毒.duration) === 1, `新附加中毒首回合状态错误:${JSON.stringify(玩家.状态效果?.中毒 || null)}`);
        const second = settleConditionsAtRoundEnd(玩家, '玩家', combatData);
        断言战斗回归夹具(/中毒.*损失\s*16/.test(second.log || ''), `中毒次回合未跳伤:${second.log}`);
        断言战斗回归夹具(Number(玩家.hp) === 984, `中毒次回合扣血异常:${玩家.hp};${second.log}`);
        断言战斗回归夹具(!玩家.状态效果?.中毒, `持续1回合中毒次回合后未结束:${JSON.stringify(玩家.状态效果?.中毒 || null)}`);
        日志.push(`新附加持续状态延后到下一回合结算:${first.log || '首回合无跳伤'} / ${second.log}`);
      });
      注册('重创流血首回合不立即跳伤', 日志 => {
        const { combatData, 玩家 } = 构建战斗回归夹具战斗态();
        玩家.HP = 1000;
        玩家.hp = 1000;
        玩家.HP上限 = 1000;
        玩家.hp_max = 1000;
        玩家.状态效果 = {
          重度流血: {
            类型: 'debuff',
            状态: '重度流血',
            状态名称: '重度流血',
            __本回合新附加: true,
            duration: 3,
            驱动属性: '魂力上限',
            效果摘要: '每回合损失80点生命',
            战斗效果: { ...createEmptyCombatEffectMap(), dot_damage: 80 },
          },
        };
        玩家.状态效果.重度流血.__状态来源键 = 记录状态来源登记(combatData, {
          stateName: '重度流血',
          targetName: 玩家.name,
          sourceActorName: '夹具敌人',
          sourceActionName: '重创打击',
          sourceActionType: 'attack',
          sourceRound: Number(combatData?.回合 || 0),
          duration: 3,
          effectSummary: '每回合损失80点生命',
          driverAttr: '魂力上限',
        });
        const first = settleConditionsAtRoundEnd(玩家, '玩家', combatData);
        断言战斗回归夹具(!/重度流血.*损失/.test(first.log || ''), `新附加重度流血同回合误跳伤:${first.log}`);
        断言战斗回归夹具(Number(玩家.hp) === 1000, `新附加重度流血同回合误扣血:${玩家.hp};${first.log}`);
        const second = settleConditionsAtRoundEnd(玩家, '玩家', combatData);
        断言战斗回归夹具(/重度流血.*损失\s*80/.test(second.log || ''), `重度流血次回合未跳伤:${second.log}`);
        断言战斗回归夹具(Number(玩家.hp) === 920, `重度流血次回合扣血异常:${玩家.hp};${second.log}`);
        日志.push(`重创流血延后到下一回合结算:${first.log || '首回合无跳伤'} / ${second.log}`);
      });
      注册('完整闪避链不触发本次状态结算', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.agi = 20;
        玩家.men_max = 20;
        玩家.final = buildCombatFinalStats(玩家);
        敌人.agi = 9999;
        敌人.final = buildCombatFinalStats(敌人);
        const 闪避可躲控制 = normalizeSkillData({
          name: '夹具毒刃牵制',
          魂技名: '夹具毒刃牵制',
          技能分类: '输出',
          目标: '敌方单体',
          消耗: '无',
          前摇: 1,
          _效果数组: [
            { 原型: '伤害结算', 目标: '单体', 生效方式: '独立生效', 威力倍率: 120, 伤害类型: '近身攻击' },
            { 原型: '状态施加', 目标: '单体', 生效方式: '独立生效', 状态: '位移限制', 状态名称: '位移限制', 持续回合: 1, 计算层效果: { cast_speed_penalty: 0.1, dot_damage: 16 } },
            { 原型: '状态施加', 目标: '单体', 生效方式: '独立生效', 状态: '中毒', 状态名称: '中毒', 持续回合: 1, 计算层效果: { dot_damage: 16 } },
          ],
        }, '夹具毒刃牵制');
        玩家.第1武魂.第1魂环.第1魂技 = 闪避可躲控制;
        const entry = {
          actor_name: '夹具玩家',
          action_type: '释放魂技',
          skill: { 魂技名: '夹具毒刃牵制', name: '夹具毒刃牵制', 消耗: '无' },
          __魂环路径: ['第1武魂', '第1魂环'],
          __魂技槽位: '第1魂技',
          target_name: '夹具敌人',
        };
        const 原随机 = Math.random;
        let result = null;
        try {
          Math.random = () => 0;
          使用战斗回归桥接(combatData, { 夹具玩家: 玩家, 夹具敌人: 敌人 }, () => {
            result = onPlayerAttack('夹具毒刃牵制', {
              dryRun: true,
              mode: 'single_round',
              combatData,
              actionDeclaration: 构建战斗回归动作声明(entry),
              intentMode: '点到为止',
            });
          });
        } finally {
          Math.random = 原随机;
        }
        const logText = String(result?.logs?.join(' ') || result?.publicReport || '');
        断言战斗回归夹具(/主动闪避|绝对闪避|没有命中|规避了本次攻击/.test(logText), `完整链未形成完全闪避:${logText}`);
        断言战斗回归夹具(!/\[状态施加\].*(位移限制|中毒)|施加了\[(?:位移限制|中毒)\]/.test(logText), `完全闪避后仍施加本次状态:${logText}`);
        断言战斗回归夹具(!/\[状态结算\].*(位移限制|中毒)|受【(?:位移限制|中毒)】影响/.test(logText), `完全闪避后仍触发本次状态结算:${logText}`);
        日志.push(`完整闪避链未触发本次状态结算:${logText}`);
      });
      注册('完全闪避不触发敌对技能副作用状态', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.agi = 20;
        玩家.men_max = 20;
        玩家.final = buildCombatFinalStats(玩家);
        敌人.agi = 9999;
        敌人.final = buildCombatFinalStats(敌人);
        const 闪避不吃后效 = normalizeSkillData({
          name: '夹具追毒飞刃',
          魂技名: '夹具追毒飞刃',
          技能分类: '输出',
          目标: '敌方单体',
          消耗: '无',
          前摇: 1,
          副作用列表: [
            { 副作用类型: '动作迟缓', 触发时机: '效果生效后', 生效对象: '效果承受者', 持续回合: 1, 数值: '20%', 副数值: '10%' },
          ],
          _效果数组: [
            { 原型: '伤害结算', 目标: '单体', 生效方式: '独立生效', 威力倍率: 120, 伤害类型: '远程攻击' },
          ],
        }, '夹具追毒飞刃');
        const action = { action_type: '释放魂技', type: '释放魂技', skill: 闪避不吃后效, target_name: 敌人.name, cast_time: 1 };
        const 原随机 = Math.random;
        let result = null;
        try {
          Math.random = () => 0;
          result = executeClash(
            action,
            { type: '伺机闪避', action_type: '伺机闪避', skill: normalizeSkillData({ name: '伺机闪避', 技能分类: '防御', 消耗: '无', 前摇: 1 }, '伺机闪避'), def_mult: 1, log: '[应招] 夹具敌人以[伺机闪避]应对。' },
            构建单挑临时战斗数据(玩家, 敌人, 'player', combatData),
          );
        } finally {
          Math.random = 原随机;
        }
        const 文本 = String(result?.desc || '');
        断言战斗回归夹具(/\[(?:主动闪避|绝对闪避)\]/.test(文本), `未形成完全闪避:${文本}`);
        断言战斗回归夹具(!/\[副作用\].*动作迟缓/.test(文本), `完全闪避后仍触发敌对技能副作用:${文本}`);
        断言战斗回归夹具(!敌人.状态效果?.动作迟缓, `完全闪避后敌对技能副作用仍落表:${JSON.stringify(敌人.状态效果 || {})}`);
        日志.push(`完全闪避未触发敌对技能副作用:${文本}`);
      });
      注册('群体攻击逐目标独立命中', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        敌人.name = '高速敌';
        敌人.agi = 10000;
        敌人.final = buildCombatFinalStats(敌人);
        const 低速敌 = 构建战斗回归夹具单位('低速敌', '防御系');
        低速敌.agi = 1;
        低速敌.def = 20;
        低速敌.final = buildCombatFinalStats(低速敌);
        combatData.参战者.team_enemy = [敌人, 低速敌];
        const 群体技能 = normalizeSkillData({
          name: '群体压制',
          魂技名: '群体压制',
          技能分类: '输出',
          目标: '敌方群体',
          消耗: '无',
          前摇: 10,
          _效果数组: [{ 原型: '伤害结算', 目标: '群体', 生效方式: '独立生效', 威力倍率: 90, 伤害类型: '远程攻击' }],
        }, '群体压制');
        const 原随机 = Math.random;
        let result = null;
        try {
          Math.random = () => 0.01;
          result = executeClash(
            { action_type: '释放魂技', type: '释放魂技', skill: 群体技能, cast_time: 10 },
            { type: '无法反应', action_type: '无法反应', skill: null, def_mult: 1, log: '' },
            combatData,
          );
        } finally {
          Math.random = 原随机;
        }
        const 目标结果 = result?.targetResults || [];
        const 高速结果 = 目标结果.find(entry => entry.targetName === '高速敌');
        const 低速结果 = 目标结果.find(entry => entry.targetName === '低速敌');
        断言战斗回归夹具(目标结果.length === 2, `群体攻击未覆盖两个目标:${目标结果.length}`);
        断言战斗回归夹具(Number(高速结果?.damage || 0) === 0, `高速目标未独立闪避:${JSON.stringify(目标结果)}`);
        断言战斗回归夹具(Number(低速结果?.damage || 0) > 0, `低速目标未独立受击:${JSON.stringify(目标结果)}`);
        断言战斗回归夹具(/逐个独立结算/.test(String(result?.desc || '')), `群体战报未说明逐目标结算:${result?.desc || ''}`);
        日志.push(`群体逐目标结算成立:${目标结果.map(entry => `${entry.targetName}:${entry.damage}`).join('，')}`);
      });
      注册('索敌失败进入公开战报', 日志 => {
        const lines = buildReadableBattleReportLines([
          '[第2回合] [起招] 夹具玩家以[横扫压制]起招。 [索敌失败] 当前没有可被命中的有效目标。',
        ], 3);
        const text = lines.join(' ');
        断言战斗回归夹具(/没有可被命中的有效目标|未找到可被命中的有效目标/.test(text), `索敌失败未进公开战报:${text}`);
        断言战斗回归夹具(!/\[索敌失败\]/.test(text), `公开战报残留底层标签:${text}`);
        日志.push(`索敌失败战报成立:${text}`);
      });
      注册('未破防终态进入公开战报', 日志 => {
        const lines = buildReadableBattleReportLines([
          '[第2回合] [团战执行] 夹具玩家以[第一魂技]指向[夹具敌人]。 [起招] 夹具玩家以[第一魂技]起招。 [应招] 夹具敌人以[承伤硬抗]应对。 [未破防] 夹具玩家对夹具敌人仅造成 1 点强制伤害。',
        ], 3);
        const text = lines.join(' ');
        断言战斗回归夹具(/夹具玩家对夹具敌人造成了 1 点伤害/.test(text), `未破防终态未被聚合:${text}`);
        断言战斗回归夹具(!/仅记录起手动作|缺少命中|无法判断/.test(text), `未破防被误写成缺结算:${text}`);
        日志.push(`未破防终态战报成立:${text}`);
      });
      注册('第一魂技正常释放链路', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.第1武魂.第1魂环.第1魂技 = 构建战斗回归第一魂技(战斗回归第一魂技默认名, '魂力:120');
        敌人.agi = 80;
        敌人.final = buildCombatFinalStats(敌人);
        敌人.第1武魂 = {
          表象名称: '慢反应武魂',
          第1魂环: {
            第1魂技: 战斗回归输出魂技('慢回击', '敌方单体', 18, 45, '近身攻击'),
          },
        };
        const entry = {
          actor_name: '夹具玩家',
          action_type: '释放魂技',
          skill: { 魂技名: '错误缓存第一魂技', name: '错误缓存第一魂技', 消耗: '魂力:9999' },
          __魂环路径: ['第1武魂', '第1魂环'],
          __魂技槽位: '第1魂技',
        };
        const intent = 战斗回归第一魂技默认名;
        const 原随机 = Math.random;
        let result = null;
        try {
          Math.random = () => 0.99;
          使用战斗回归桥接(combatData, { 夹具玩家: 玩家, 夹具敌人: 敌人 }, () => {
            result = onPlayerAttack(intent, { dryRun: true, combatData, actionDeclaration: 构建战斗回归动作声明(entry), intentMode: '点到为止' });
          });
        } finally {
          Math.random = 原随机;
        }
        const report = String(result?.publicReport || '');
        const rawLogText = String(result?.logs?.join(' ') || '');
        const playerSnapshot = result?.snapshot?.team_player?.find(unit => unit.name === '夹具玩家') || {};
        断言战斗回归夹具(report.includes(战斗回归第一魂技默认名), `正常释放战报缺第一魂技:${report}`);
        断言战斗回归夹具(/夹具敌人/.test(report), `正常释放战报缺目标:${report}`);
        断言战斗回归夹具(Number(playerSnapshot.sp) > 1800 && Number(playerSnapshot.sp) < 2000, `正常释放扣费异常:${playerSnapshot.sp}`);
        断言战斗回归夹具(Number(playerSnapshot.sp) === Number(playerSnapshot.魂力), `正常释放后魂力镜像不同步:${playerSnapshot.sp}/${playerSnapshot.魂力}`);
        断言战斗回归夹具(Number(playerSnapshot.sta ?? playerSnapshot.vit) === Number(playerSnapshot.体力), `正常释放后体力镜像不同步:${playerSnapshot.sta}/${playerSnapshot.vit}/${playerSnapshot.体力}`);
        断言战斗回归夹具((rawLogText.match(new RegExp(`\\[战前消耗\\]\\s*释放\\[${战斗回归第一魂技默认名}\\]`, 'g')) || []).length === 1, `第一魂技实际扣费次数异常:${rawLogText}`);
        const 事实账本 = result?.closedLoopLedger || {};
        断言战斗回归夹具((事实账本.消耗 || []).filter(item => item.技能 === 战斗回归第一魂技默认名).length === 1, `账本扣费次数异常:${JSON.stringify(事实账本)}`);
        断言战斗回归夹具((事实账本.起招 || []).filter(item => item.行动者 === '夹具玩家' && item.技能 === 战斗回归第一魂技默认名).length === 1, `账本起招次数异常:${JSON.stringify(事实账本)}`);
        断言战斗回归夹具(!(事实账本.未闭合起招 || []).length, `正常释放存在未闭合起招:${JSON.stringify(事实账本.未闭合起招 || [])}`);
        const 事件账本 = Array.isArray(result?.eventLedger) ? result.eventLedger : [];
        断言战斗回归夹具(事件账本.some(item => item?.eventKind === 'action_start' && item?.actionName === 战斗回归第一魂技默认名), `事件账本缺动作起手:${JSON.stringify(事件账本)}`);
        const 第一魂技伤害事件 = 事件账本.filter(item => item?.eventKind === 'hit_result' && item?.actorName === '夹具玩家' && item?.targetName === '夹具敌人' && normalizeBattleActionDisplayName(item?.actionName || item?.sourceActionName || '') === 战斗回归第一魂技默认名 && Number(item?.appliedDamage || item?.meta?.appliedDamage || item?.damage || item?.meta?.damage || 0) > 0);
        const 第一魂技反击伤害事件 = 事件账本.filter(item =>
          item?.eventKind === 'counter' &&
          normalizeBattleActionDisplayName(item?.sourceActionName || item?.meta?.sourceActionName || '') === 战斗回归第一魂技默认名 &&
          Number(item?.appliedDamage || item?.meta?.appliedDamage || item?.damage || item?.meta?.damage || 0) > 0
        );
        const 第一魂技状态集合 = new Set(事件账本
          .filter(item => item?.eventKind === 'state_apply' && item?.actorName === '夹具玩家' && item?.targetName === '夹具敌人' && normalizeBattleActionDisplayName(item?.actionName || item?.sourceActionName || '') === 战斗回归第一魂技默认名)
          .map(item => String(item?.stateName || item?.meta?.stateName || '').trim())
          .filter(Boolean));
        const 第一魂技污染反击窗口状态 = Object.entries(敌人.状态效果 || {})
          .filter(([状态名, 状态]) => /位移限制|中毒|锁魄毒印/.test(String(状态名 || 状态?.状态名称 || 状态?.状态 || 状态?.描述 || '')))
          .filter(([, 状态]) => Number(状态?.战斗效果?.counter_attack_ratio || 0) > 0);
        断言战斗回归夹具(!第一魂技伤害事件.length, `第一魂技不应生成直接伤害:${JSON.stringify(第一魂技伤害事件)}`);
        断言战斗回归夹具(!第一魂技反击伤害事件.length, `第一魂技不应触发常规防反伤害:${JSON.stringify(第一魂技反击伤害事件)}`);
        断言战斗回归夹具(第一魂技状态集合.has('位移限制') && 第一魂技状态集合.has('中毒'), `第一魂技缺控制/中毒状态:${JSON.stringify(事件账本)}`);
        断言战斗回归夹具(!第一魂技污染反击窗口状态.length, `第一魂技控制状态不应携带反击窗口:${JSON.stringify(第一魂技污染反击窗口状态)}`);
        断言战斗回归夹具(!/错误缓存第一魂技|9999/.test(report), `正常释放串用缓存技能:${report}`);
        日志.push(`第一魂技正常释放成立:${report}`);
      });
      注册('无伤害能力动作阻断污染伤害包', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        const 控制动作 = {
          action_type: '释放魂技',
          type: '释放魂技',
          skill: normalizeSkillData(构建战斗回归第一魂技(战斗回归第一魂技默认名, '魂力:120'), 战斗回归第一魂技默认名),
          target_name: 敌人.name,
        };
        const 初始敌方生命 = getCombatHpValue(敌人);
        const 伤害包 = applyResolvedDamagePackage(玩家, 控制动作, {
          dmg: 100,
          targetResults: [{
            target: 敌人,
            targetName: 敌人.name,
            damage: 100,
            kind: 'primary',
          }],
        }, {
          primaryTarget: 敌人,
          combatData,
        });
        const 账本 = Array.isArray(combatData.__battleEventLedger) ? combatData.__battleEventLedger : [];
        const 污染命中 = 账本.filter(event =>
          String(event?.eventKind || '').trim() === 'hit_result' &&
          normalizeBattleActionDisplayName(event?.actionName || event?.sourceActionName || '') === 战斗回归第一魂技默认名 &&
          Math.max(0, Number(event?.appliedDamage ?? event?.damage ?? event?.meta?.appliedDamage ?? event?.meta?.damage ?? 0)) > 0
        );
        const 阻断事件 = 账本.find(event =>
          String(event?.eventKind || '').trim() === 'blocked_settlement' &&
          String(event?.meta?.reasonCode || '').trim() === 'NON_DAMAGE_ACTION_DAMAGE_PACKAGE' &&
          normalizeBattleActionDisplayName(event?.actionName || event?.sourceActionName || '') === 战斗回归第一魂技默认名
        );
        断言战斗回归夹具(Number(伤害包.primaryAppliedDamage || 0) === 0 && Number(伤害包.totalAppliedDamage || 0) === 0, `污染伤害包未归零:${JSON.stringify(伤害包)}`);
        断言战斗回归夹具(getCombatHpValue(敌人) === 初始敌方生命, `污染伤害包仍扣血:${初始敌方生命}->${getCombatHpValue(敌人)}`);
        断言战斗回归夹具(!污染命中.length, `污染伤害包仍生成命中:${JSON.stringify(污染命中)}`);
        断言战斗回归夹具(!!阻断事件, `污染伤害包未写阻断事实:${JSON.stringify(账本)}`);
        日志.push('无伤害能力动作的污染伤害包已在结算层阻断');
      });
      注册('闭环账本标记未闭合起招', 日志 => {
        const broken = 从事件账本构建行动闭环事实账本([
          { eventKind: 'action_start', round: 1, actorName: '甲', targetName: '乙', actionName: '裂空斩', actionType: 'attack', result: 'declared' },
          { eventKind: 'dodge', round: 1, actorName: '乙', actionName: '伺机闪避', actionType: 'dodge', result: 'attempted' },
        ]);
        const dodged = 从事件账本构建行动闭环事实账本([
          { eventKind: 'action_start', round: 1, actorName: '甲', targetName: '乙', actionName: '裂空斩', actionType: 'attack', result: 'declared' },
          { eventKind: 'dodge', round: 1, actorName: '乙', actionName: '伺机闪避', actionType: 'dodge', result: 'evaded' },
        ]);
        const hit = 从事件账本构建行动闭环事实账本([
          { eventKind: 'action_start', round: 1, actorName: '甲', targetName: '乙', actionName: '裂空斩', actionType: 'attack', result: 'declared' },
          { eventKind: 'defend', round: 1, actorName: '乙', actionName: '承伤硬抗', actionType: 'defend', result: 'guarded' },
          { eventKind: 'hit_result', round: 1, actorName: '甲', targetName: '乙', actionName: '裂空斩', actionType: 'attack', result: 'hit', meta: { damage: 80 } },
          { eventKind: 'state_apply', round: 1, actorName: '甲', targetName: '乙', actionName: '裂空斩', sourceActionName: '裂空斩', sourceRound: 1, actionType: 'state_apply', result: 'applied', meta: { stateName: '迟缓' } },
        ]);
        断言战斗回归夹具(broken.未闭合起招.length === 1, `未闭合起招未被账本捕捉:${JSON.stringify(broken)}`);
        断言战斗回归夹具(dodged.未闭合起招.length === 0 && dodged.闪避.length === 1, `完整闪避链被误判:${JSON.stringify(dodged)}`);
        断言战斗回归夹具(hit.未闭合起招.length === 0 && hit.命中.length === 1 && hit.状态施加.length === 1, `命中状态链账本异常:${JSON.stringify(hit)}`);
        日志.push('闭环账本可区分断链、闪避闭合、命中状态闭合');
      });
      注册('空效果技能不留下未闭合起招', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.第1武魂.第1魂环.第1魂技 = normalizeSkillData({
          name: '空壳第一魂技',
          魂技名: '空壳第一魂技',
          技能分类: '输出',
          目标: '敌方单体',
          消耗: '无',
          前摇: 1,
          _效果数组: [],
        }, '空壳第一魂技');
        const entry = {
          actor_name: '夹具玩家',
          action_type: '释放魂技',
          skill: { 魂技名: '空壳第一魂技', name: '空壳第一魂技', 消耗: '无' },
          __魂环路径: ['第1武魂', '第1魂环'],
          __魂技槽位: '第1魂技',
          target_name: 敌人.name,
        };
        const result = onPlayerAttack('空壳第一魂技', {
          dryRun: true,
          mode: 'single_round',
          combatData,
          actionDeclaration: 构建战斗回归动作声明(entry),
          intentMode: '点到为止',
        });
        const logText = String(result?.logs?.join(' ') || '');
        const ledger = result?.closedLoopLedger || {};
        断言战斗回归夹具(/施法失败.*缺少可结算效果/.test(logText), `空效果技能未显式失败:${logText}`);
        断言战斗回归夹具(!(ledger.未闭合起招 || []).length, `空效果技能留下未闭合起招:${JSON.stringify(ledger.未闭合起招 || [])}`);
        日志.push(`空效果技能闭合为施法失败:${logText}`);
      });
      注册('自动续推不复用首轮手选魂技', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.HP = 99999;
        玩家.hp = 99999;
        玩家.HP上限 = 99999;
        玩家.hp_max = 99999;
        玩家.sp = 2000;
        玩家.魂力 = 2000;
        玩家.第1武魂.第1魂环.第1魂技 = {
          ...战斗回归输出魂技('续推轻击', '敌方单体', 4, 1, '近身攻击'),
          消耗: '魂力:120',
        };
        敌人.HP = 99999;
        敌人.hp = 99999;
        敌人.HP上限 = 99999;
        敌人.hp_max = 99999;
        敌人.agi = 1;
        敌人.def = 10;
        敌人.final = buildCombatFinalStats(敌人);
        const entry = {
          actor_name: '夹具玩家',
          action_type: '释放魂技',
          skill: { 魂技名: '错误缓存第一魂技', name: '错误缓存第一魂技', 消耗: '魂力:9999' },
          __魂环路径: ['第1武魂', '第1魂环'],
          __魂技槽位: '第1魂技',
        };
        const 原随机 = Math.random;
        let result = null;
        try {
          Math.random = () => 0.01;
          使用战斗回归桥接(combatData, { 夹具玩家: 玩家, 夹具敌人: 敌人 }, () => {
            result = onPlayerAttack('续推轻击', {
              dryRun: true,
              mode: 'multi_round',
              combatData,
              actionDeclaration: 构建战斗回归动作声明(entry),
              intentMode: '点到为止',
            });
          });
        } finally {
          Math.random = 原随机;
        }
        const 账本 = result?.closedLoopLedger || {};
        const 轨迹回合集合 = new Set((Array.isArray(result?.decisionTrace) ? result.decisionTrace : []).map(item => Number(item?.round || item?.回合 || 0)).filter(round => round > 0));
        const 首轮动作扣费 = (账本.消耗 || []).filter(item => item.技能 === '续推轻击').length;
        const 首轮动作起招 = (账本.起招 || []).filter(item => item.行动者 === '夹具玩家' && item.技能 === '续推轻击').length;
        断言战斗回归夹具(Number(result?.roundsExecuted || 0) > 1, `自动续推未进入第二回合:${result?.logs?.join(' ') || ''}`);
        断言战斗回归夹具(轨迹回合集合.has(2), `自动续推第2回合审计轨迹缺失:${JSON.stringify(Array.from(轨迹回合集合))}`);
        断言战斗回归夹具(首轮动作扣费 === 1, `自动续推重复扣首轮动作:${JSON.stringify(账本)}`);
        断言战斗回归夹具(首轮动作起招 === 1, `自动续推重复释放首轮动作:${JSON.stringify(账本)}`);
        断言战斗回归夹具(!/错误缓存第一魂技|9999/.test(String(result?.logs?.join(' ') || result?.publicReport || '')), '自动续推串用首轮缓存技能');
        日志.push(`自动续推未复用首轮手选魂技，推进${result?.roundsExecuted || 0}回合`);
      });
      注册('自动续推设置控制最大回合与伤害停推', 日志 => {
        const 构建低烈度战斗 = () => {
          const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
          玩家.HP = 99999;
          玩家.hp = 99999;
          玩家.HP上限 = 99999;
          玩家.hp_max = 99999;
          玩家.sp = 2000;
          玩家.魂力 = 2000;
          玩家.第1武魂.第1魂环.第1魂技 = {
            ...战斗回归输出魂技('续推轻击', '敌方单体', 4, 1, '近身攻击'),
            消耗: '魂力:120',
          };
          敌人.HP = 99999;
          敌人.hp = 99999;
          敌人.HP上限 = 99999;
          敌人.hp_max = 99999;
          敌人.agi = 1;
          敌人.def = 10;
          敌人.final = buildCombatFinalStats(敌人);
          return { combatData, 玩家, 敌人 };
        };
        const entry = {
          actor_name: '夹具玩家',
          action_type: '释放魂技',
          skill: { 魂技名: '错误缓存第一魂技', name: '错误缓存第一魂技', 消耗: '魂力:9999' },
          __魂环路径: ['第1武魂', '第1魂环'],
          __魂技槽位: '第1魂技',
        };
        const intent = '续推轻击';
        const 原随机 = Math.random;
        let maxRoundResult = null;
        let thresholdResult = null;
        try {
          Math.random = () => 0.99;
          const 第一场 = 构建低烈度战斗();
          使用战斗回归桥接(第一场.combatData, { 夹具玩家: 第一场.玩家, 夹具敌人: 第一场.敌人 }, () => {
            maxRoundResult = onPlayerAttack(intent, {
              dryRun: true,
              mode: 'multi_round',
              combatData: 第一场.combatData,
              actionDeclaration: 构建战斗回归动作声明(entry),
              intentMode: '点到为止',
              autoContinueConfig: { maxRounds: 2, stopDamagePercent: 100, continueChancePercent: 100 },
            });
          });
          const 第二场 = 构建低烈度战斗();
          使用战斗回归桥接(第二场.combatData, { 夹具玩家: 第二场.玩家, 夹具敌人: 第二场.敌人 }, () => {
            thresholdResult = onPlayerAttack(intent, {
              dryRun: true,
              mode: 'multi_round',
              combatData: 第二场.combatData,
              actionDeclaration: 构建战斗回归动作声明(entry),
              intentMode: '点到为止',
              autoContinueConfig: { maxRounds: 4, stopDamagePercent: 0, continueChancePercent: 100 },
            });
          });
        } finally {
          Math.random = 原随机;
        }
        断言战斗回归夹具(Number(maxRoundResult?.roundsExecuted || 0) === 2, `自定义最大回合未生效:${maxRoundResult?.logs?.join(' ') || ''}`);
        断言战斗回归夹具(Number(thresholdResult?.roundsExecuted || 0) === 1, `自定义伤害停推未生效:${thresholdResult?.logs?.join(' ') || ''}`);
        断言战斗回归夹具(/伤害已达生命占比0%/.test(String(thresholdResult?.logs?.join(' ') || '')), `伤害停推日志缺失:${thresholdResult?.logs?.join(' ') || ''}`);
        日志.push('自动续推最大回合、伤害停推与续推概率均可由运行时设置控制');
      });
      注册('自动续推不因同构攻防提前终止', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.HP = 99999;
        玩家.hp = 99999;
        玩家.HP上限 = 99999;
        玩家.hp_max = 99999;
        玩家.sp = 2000;
        玩家.魂力 = 2000;
        玩家.第1武魂.第1魂环.第1魂技 = {
          ...构建战斗回归第一魂技('锁魄印', '魂力:80'),
          前摇: 4,
          _效果数组: [
            { 原型: '状态施加', 目标: '单体', 状态: '位移限制', 持续回合: 1 },
          ],
        };
        敌人.HP = 99999;
        敌人.hp = 99999;
        敌人.HP上限 = 99999;
        敌人.hp_max = 99999;
        敌人.第1武魂 = 敌人.第1武魂 || { 表象名称: '敌方夹具武魂' };
        敌人.第1武魂.第1魂环 = 敌人.第1武魂.第1魂环 || {};
        敌人.第1武魂.第1魂环.第1魂技 = normalizeSkillData(战斗回归输出魂技(战斗回归敌方快攻技能名, '敌方单体', 6, 88, '近身攻击'), 战斗回归敌方快攻技能名);
        敌人.第1武魂.第2魂环 = { 第1魂技: normalizeSkillData(战斗回归输出魂技(战斗回归敌方压制技能名, '敌方单体', 10, 96, '近身攻击'), 战斗回归敌方压制技能名) };
        敌人.agi = Math.max(玩家.agi * 1.25, 280);
        敌人.final = buildCombatFinalStats(敌人);
        let result = null;
        const 原随机 = Math.random;
        try {
          Math.random = () => 0.01;
          使用战斗回归桥接(combatData, { 夹具玩家: 玩家, 夹具敌人: 敌人 }, () => {
            result = onPlayerAttack('锁魄印', {
              dryRun: true,
              mode: 'multi_round',
              combatData,
              intentMode: '点到为止',
              autoContinueConfig: { maxRounds: 6, stopDamagePercent: 100, continueChancePercent: 100 },
            });
          });
        } finally {
          Math.random = 原随机;
        }
        const logText = String(result?.logs?.join(' ') || '');
        断言战斗回归夹具(!/续推终止.*连续/.test(logText), `连续态势仍触发提前停推:${logText}`);
        断言战斗回归夹具(Number(result?.roundsExecuted || 0) === 6, `同构攻防不应截断用户续推上限:${result?.roundsExecuted || 0};${logText}`);
        日志.push(`自动续推同构攻防未提前截断，执行${result?.roundsExecuted || 0}回合`);
      });
      注册('撤离成功强制终态不被自动续推覆盖', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.agi = 10000;
        玩家.men = 10000;
        玩家.精神力 = 10000;
        玩家.final = buildCombatFinalStats(玩家);
        敌人.agi = 1;
        敌人.men = 1;
        敌人.精神力 = 1;
        敌人.str = 1;
        敌人.final = buildCombatFinalStats(敌人);
        let result = null;
        const 原随机 = Math.random;
        try {
          Math.random = () => 0.01;
          使用战斗回归桥接(combatData, { 夹具玩家: 玩家, 夹具敌人: 敌人 }, () => {
            result = onPlayerAttack('撤离', {
              dryRun: true,
              mode: 'multi_round',
              combatData,
              intentMode: '点到为止',
              autoContinueConfig: { maxRounds: 20, stopDamagePercent: 100, continueChancePercent: 100 },
            });
          });
        } finally {
          Math.random = 原随机;
        }
        const logText = String(result?.logs?.join(' ') || '');
        断言战斗回归夹具(/脱离成功/.test(logText), `撤离优势未形成成功终态:${logText}`);
        断言战斗回归夹具(Number(result?.roundsExecuted || 0) === 1, `撤离成功后仍被自动续推:${result?.roundsExecuted || 0};${logText}`);
        日志.push('撤离成功在第1回合强制终止，未被100%续推概率覆盖');
      });
      注册('资源镜像回合尾同步', 日志 => {
        const { combatData, 玩家 } = 构建战斗回归夹具战斗态();
        玩家.sp = 1880;
        玩家.魂力 = 1880;
        玩家.men = 860;
        玩家.精神力 = 860;
        玩家.sta = 1100;
        玩家.vit = 1100;
        玩家.体力 = 1100;
        const result = settleConditionsAtRoundEnd(玩家, 玩家.name, combatData);
        syncCombatActionState(玩家);
        断言战斗回归夹具(Number(玩家.sp) === Number(玩家.魂力), `自然恢复后魂力镜像不同步:${玩家.sp}/${玩家.魂力};${result.log}`);
        断言战斗回归夹具(Number(玩家.men) === Number(玩家.精神力), `自然恢复后精神力镜像不同步:${玩家.men}/${玩家.精神力};${result.log}`);
        断言战斗回归夹具(Number(玩家.sta) === Number(玩家.vit) && Number(玩家.sta) === Number(玩家.体力), `回合尾体力镜像不同步:${玩家.sta}/${玩家.vit}/${玩家.体力}`);
        日志.push(`资源镜像回合尾同步成立:${result.log}`);
      });
      注册('蓄力打断反噬HP与Ledger守恒', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        combatData.回合 = 1;
        const 截断技能 = normalizeSkillData({
          name: '瞬发截脉',
          技能分类: '控制',
          消耗: '无',
          前摇: 4,
          _效果数组: [
            { 原型: '状态施加', 目标: '单体', 状态: '眩晕', 计算层效果: { skip_turn: true } },
          ],
        }, '瞬发截脉');
        const 压制动作 = { type: '控制截断', action_type: '释放魂技', skill: 截断技能, cast_time: 4 };
        玩家.蓄力技能 = { skill: normalizeSkillData({ name: '蓄力重击', 前摇: 30 }, '蓄力重击') };
        const 起手事件 = BATTLE_RUNTIME.writeLedgerEvent(combatData, {
          eventKind: 'action_start',
          round: 1,
          actorName: 敌人.name,
          targetName: 玩家.name,
          actionName: 截断技能.name,
          actionType: '释放魂技',
          actorControl: 'AI',
          actionRole: 'ACTIVE',
          result: 'declared',
        });
        const 反噬前血量 = getCombatHpValue(玩家);
        const result = resolveCastInterruptOnDamage(玩家, 敌人, 压制动作, Math.ceil(getCombatHpMaxValue(玩家) * 0.3), {}, combatData, 玩家.name);
        const 反噬事件 = (combatData.__battleEventLedger || []).find(event => event?.ruleCode === 'CAST_INTERRUPTION_BACKLASH');
        const 僵直事件 = (combatData.__battleEventLedger || []).find(event => event?.sourceEffectId === 'CAST_INTERRUPTION_BACKLASH_STIFFNESS');
        const 反噬伤害 = Math.floor(getCombatHpMaxValue(玩家) * 0.05);
        断言战斗回归夹具(反噬前血量 - getCombatHpValue(玩家) === 反噬伤害, `反噬HP差不守恒:${反噬前血量}/${getCombatHpValue(玩家)}/${反噬伤害}`);
        断言战斗回归夹具(Number(反噬事件?.appliedDamage || 0) === 反噬伤害, `反噬Ledger伤害不守恒:${反噬事件?.appliedDamage}/${反噬伤害}`);
        断言战斗回归夹具(String(反噬事件?.sourceActionId || '') === String(起手事件?.actionId || ''), '反噬Ledger未关联截断动作');
        断言战斗回归夹具(反噬事件?.actionRole === 'REACTION' && 反噬事件?.actorControl === 'SYSTEM', '反噬事实职责或控制来源错误');
        断言战斗回归夹具(!玩家.蓄力技能 && 玩家.状态效果?.僵直?.战斗效果?.skip_turn === true, '正式打断入口未取消蓄力或落地僵直');
        断言战斗回归夹具(僵直事件?.eventKind === 'state_apply' && 僵直事件?.resultState === 'APPLIED', '反噬僵直缺少成功状态事实');
        断言战斗回归夹具(String(僵直事件?.sourceActionId || '') === String(起手事件?.actionId || ''), '反噬僵直事实未关联截断动作');
        断言战斗回归夹具(/蓄力打断|打断生效/.test(result), `正式打断入口缺少结果文本:${result}`);
        日志.push(`蓄力打断反噬守恒成立:${反噬伤害}`);
      });
      注册('蓄力反噬僵直被移除仍有失败事实', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        combatData.回合 = 1;
        玩家.状态效果 = {
          '持续净化': {
            特殊机制标识: '持续状态移除',
            持续原型效果: { 原型: '状态移除', 状态: '僵直' },
            战斗效果: {},
          },
        };
        const 截断技能 = normalizeSkillData({ name: '瞬发截脉', 技能分类: '控制', 消耗: '无', 前摇: 4 }, '瞬发截脉');
        玩家.蓄力技能 = { skill: normalizeSkillData({ name: '蓄力重击', 前摇: 30 }, '蓄力重击') };
        const result = resolveCastInterruptOnDamage(玩家, 敌人, { type: '控制截断', skill: 截断技能 }, Math.ceil(getCombatHpMaxValue(玩家) * 0.3), {}, combatData, 玩家.name);
        const 僵直事件 = (combatData.__battleEventLedger || []).find(event => event?.sourceEffectId === 'CAST_INTERRUPTION_BACKLASH_STIFFNESS');
        断言战斗回归夹具(!玩家.状态效果?.僵直, '持续净化未阻断反噬僵直');
        断言战斗回归夹具(僵直事件?.eventKind === 'state_apply' && 僵直事件?.resultState === 'BLOCKED', '反噬僵直被拦截时缺失败状态事实');
        断言战斗回归夹具(/持续净化/.test(String(僵直事件?.failReason || '')), '反噬僵直失败事实缺拦截来源');
        断言战斗回归夹具(/持续净化/.test(result), `正式打断入口未报告拦截来源:${result}`);
        日志.push('反噬僵直被持续净化拦截并记录BLOCKED事实');
      });
      注册('死亡保护多资源Ledger守恒', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        combatData.回合 = 1;
        combatData.战斗意图 = '必杀';
        设置战斗血量值(玩家, 10);
        设置战斗延迟效果资源值(玩家, 'sp', 500);
        设置战斗体力值(玩家, Math.floor(getCombatStaminaMaxValue(玩家) * 0.5));
        玩家.状态效果 = {
          '黄金瀑布·金龙不灭真身': {
            状态: '金龙不灭真身',
            战斗效果: { death_save_count: 1 },
          },
        };
        const sourceAction = { action_type: '普通攻击', type: '普通攻击', skill: normalizeSkillData({
          name: '致命测试',
          技能分类: '输出',
          消耗: '无',
          前摇: 5,
          _效果数组: [{ 原型: '伤害结算', 目标: '单体', 伤害类型: '近身攻击', 威力倍率: 300 }],
        }, '致命测试') };
        BATTLE_RUNTIME.writeLedgerEvent(combatData, {
          eventKind: 'action_start',
          round: 1,
          actorName: 敌人.name,
          targetName: 玩家.name,
          actionName: '致命测试',
          actionType: '普通攻击',
          actorControl: 'AI',
          actionRole: 'ACTIVE',
          result: 'declared',
        });
        const initial = {
          hp: getCombatHpValue(玩家),
          sp: 读取持续原型资源当前值(玩家, 'sp'),
          vit: getCombatStaminaValue(玩家),
        };
        const result = applyResolvedDamagePackage(敌人, sourceAction, {
          dmg: 9999,
          targetResults: [{ target: 玩家, targetName: 玩家.name, damage: 9999, kind: 'primary' }],
        }, { combatData, primaryTarget: 玩家 });
        const deltas = (combatData.__battleEventLedger || [])
          .filter(event => event?.ruleCode === 'DEATH_SAVE_RESOURCE_SETTLEMENT')
          .reduce((sum, event) => {
            const key = String(event?.meta?.resourceKey || '');
            sum[key] = Number(sum[key] || 0) + Number(event?.meta?.delta || 0);
            return sum;
          }, {});
        const lethalDamage = (combatData.__battleEventLedger || [])
          .filter(event => event?.eventKind === 'hit_result' && event?.targetName === 玩家.name && event?.ruleCode !== 'CAST_INTERRUPTION_BACKLASH')
          .reduce((sum, event) => sum + Number(event?.appliedDamage || event?.meta?.damage || 0), 0);
        断言战斗回归夹具(getCombatHpValue(玩家) === getCombatHpMaxValue(玩家), '金龙不灭真身未回满HP');
        断言战斗回归夹具(读取持续原型资源当前值(玩家, 'sp') === 0, '金龙不灭真身未清空魂力');
        断言战斗回归夹具(getCombatStaminaValue(玩家) === getCombatStaminaMaxValue(玩家), '金龙不灭真身未回满体力');
        断言战斗回归夹具(initial.hp - lethalDamage + Number(deltas.hp || 0) === getCombatHpValue(玩家), `死亡保护HP账本不守恒:${initial.hp}/${lethalDamage}/${deltas.hp}/${getCombatHpValue(玩家)}`);
        断言战斗回归夹具(initial.sp + Number(deltas.sp || 0) === 读取持续原型资源当前值(玩家, 'sp'), `死亡保护魂力账本不守恒:${initial.sp}/${deltas.sp}`);
        断言战斗回归夹具(initial.vit + Number(deltas.vit || 0) === getCombatStaminaValue(玩家), `死亡保护体力账本不守恒:${initial.vit}/${deltas.vit}/${getCombatStaminaValue(玩家)}`);
        断言战斗回归夹具(玩家.状态效果['黄金瀑布·金龙不灭真身'].战斗效果.death_save_count === 0, '死亡保护次数未消费');
        断言战斗回归夹具(/濒死守护/.test(String(result?.log || '')), `真实伤害链没有触发死亡保护:${result?.log}`);
        日志.push(`死亡保护多资源守恒成立:HP${deltas.hp}/魂力${deltas.sp}/体力${deltas.vit}`);
      });
      注册('第一魂技被先制打断不提前扣费', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.agi = 80;
        玩家.final = buildCombatFinalStats(玩家);
        玩家.第1武魂.第1魂环.第1魂技 = 构建战斗回归第一魂技('慢启动第一魂技', '魂力:120');
        玩家.第1武魂.第1魂环.第1魂技.前摇 = 64;
        敌人.agi = 360;
        敌人.final = buildCombatFinalStats(敌人);
        敌人.第1武魂 = {
          表象名称: '先制武魂',
          第1魂环: {
            第1魂技: 战斗回归输出魂技('先制截击', '敌方单体', 4, 160, '近身攻击'),
          },
        };
        const entry = {
          actor_name: '夹具玩家',
          action_type: '释放魂技',
          skill: { 魂技名: '错误缓存第一魂技', name: '错误缓存第一魂技', 消耗: '魂力:9999' },
          __魂环路径: ['第1武魂', '第1魂环'],
          __魂技槽位: '第1魂技',
        };
        const intent = '慢启动第一魂技';
        const 原随机 = Math.random;
        let result = null;
        try {
          Math.random = () => 0.99;
          使用战斗回归桥接(combatData, { 夹具玩家: 玩家, 夹具敌人: 敌人 }, () => {
            result = onPlayerAttack(intent, { dryRun: true, combatData, actionDeclaration: 构建战斗回归动作声明(entry), intentMode: '点到为止' });
          });
        } finally {
          Math.random = 原随机;
        }
        const report = String(result?.publicReport || '');
        const playerSnapshot = result?.snapshot?.team_player?.find(unit => unit.name === '夹具玩家') || {};
        断言战斗回归夹具(/慢启动第一魂技/.test(report), `先制打断战报缺原技能:${report}`);
        断言战斗回归夹具(/未能(?:在本回合)?完成|打断|先手压制|来不及|仍在启动/.test(report), `先制打断战报未说明失败:${report}`);
        断言战斗回归夹具(Number(playerSnapshot.sp) === 2000, `先制打断前不应扣费:${playerSnapshot.sp}`);
        断言战斗回归夹具(!/错误缓存第一魂技|9999/.test(report), `先制打断串用缓存技能:${report}`);
        日志.push(`第一魂技先制打断成立:${report}`);
      });
      注册('非物品动作拒绝背包调用', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.背包.夹具药剂 = {
          数量: 1,
          持有者: 玩家.name,
          使用效果: [{ 原型: '资源变化', 目标: '自身', 资源: '魂力', 数值: '+100' }],
        };
        let result = null;
        使用战斗回归桥接(combatData, { 夹具玩家: 玩家, 夹具敌人: 敌人 }, () => {
          const 物品技能 = 构建战斗背包技能('夹具药剂', 读取战斗背包物品数据('夹具药剂', 玩家.背包.夹具药剂));
          result = executeClash(
            { action_type: '释放魂技', type: '释放魂技', skill: 物品技能, 物品名: '夹具药剂', cast_time: 8 },
            { type: '无法反应', action_type: '无法反应', skill: null, def_mult: 1, log: '' },
            combatData,
          );
        });
        断言战斗回归夹具(/只有选择使用物品/.test(String(result?.desc || '')), `非物品动作未拒绝:${result?.desc || ''}`);
        断言战斗回归夹具(!String(result?.desc || '').includes('[物品消耗]'), '非物品动作错误消耗背包物品');
        断言战斗回归夹具(!(result?.extraPatchOps || []).some(op => String(op?.path || '').includes('/背包/夹具药剂')), '非物品动作生成了背包消耗补丁');
        日志.push('非使用物品动作无法调用背包物品');
      });
      注册('使用物品才消费背包', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.背包.夹具药剂 = {
          数量: 1,
          持有者: 玩家.name,
          使用效果: [{ 原型: '资源变化', 目标: '自身', 资源: '魂力', 数值: '+100' }],
        };
        let result = null;
        使用战斗回归桥接(combatData, { 夹具玩家: 玩家, 夹具敌人: 敌人 }, () => {
          const 物品技能 = 构建战斗背包技能('夹具药剂', 读取战斗背包物品数据('夹具药剂', 玩家.背包.夹具药剂));
          result = executeClash(
            { action_type: '使用物品', type: '使用物品', skill: 物品技能, 物品名: '夹具药剂', cast_time: 8 },
            { type: '无法反应', action_type: '无法反应', skill: null, def_mult: 1, log: '' },
            combatData,
          );
        });
        const patchOps = result?.extraPatchOps || [];
        断言战斗回归夹具(String(result?.desc || '').includes('[物品消耗]'), `使用物品未写消耗战报:${result?.desc || ''}`);
        断言战斗回归夹具(patchOps.some(op => String(op?.path || '').includes('/char/夹具玩家/背包/夹具药剂')), '使用物品未生成背包消耗补丁');
        断言战斗回归夹具(!/只有选择使用物品/.test(String(result?.desc || '')), '合法使用物品被误判为非法调用');
        日志.push('使用物品动作才会消费背包物品');
      });
      注册('自动规划不调用背包物品', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        敌人.背包.夹具爆弹 = {
          数量: 1,
          持有者: 敌人.name,
          使用效果: [{ 原型: '伤害结算', 目标: '单体', 生效方式: '独立生效', 威力倍率: 300, 伤害类型: '远程攻击' }],
        };
        const availableSkills = collectCombatSkills(敌人, []);
        断言战斗回归夹具(!availableSkills.some(skill => String(skill?.__物品名 || '').trim() === '夹具爆弹'), '背包物品混入自动技能池');
        const npcActorEntry = { char: 敌人, side: 'enemy' };
        const npcTargets = chooseTargetForActor(npcActorEntry, { combatData }) || { enemyTarget: 玩家, allyTarget: 敌人 };
        const npcAction = buildAutoActionForActor(npcActorEntry, npcTargets, { combatData });
        断言战斗回归夹具(String(npcAction?.action_type || npcAction?.type || '') !== '使用物品', '自动规划直接调用了背包物品');
        断言战斗回归夹具(!String(npcAction?.物品名 || npcAction?.skill?.__物品名 || '').trim(), '自动规划动作携带了背包物品名');
        日志.push(`自动规划未调用背包物品:${npcAction?.skill?.name || npcAction?.action_type || npcAction?.type || '无动作'}`);
      });
      注册('团战战报多链不串联', 日志 => {
        const lines = buildReadableBattleReportLines([
          '[团战第1回合开始]',
          '[团战执行] 夹具玩家以[烈焰拳]指向[甲敌]。 [起招] 夹具玩家以[烈焰拳]起招。 [应招] 甲敌以[伺机闪避]应对。 [主动闪避] 甲敌凭借敏捷优势惊险躲过了攻击。',
          '[团战执行] 夹具友方以[冰锁]指向[乙敌]。 [起招] 夹具友方以[冰锁]起招。 [应招] 乙敌以[承伤硬抗]应对。 [命中结算] 夹具友方对乙敌造成 66 点最终伤害。',
          '[行为防反] 乙敌凭硬抗反击抓住夹具友方出手后的空门，造成33点反击伤害。',
        ], 8);
        const text = lines.join('\n');
        const playerLine = lines.find(line => /夹具玩家/.test(line)) || '';
        const allyLine = lines.find(line => /夹具友方/.test(line)) || '';
        断言战斗回归夹具(/甲敌/.test(playerLine), `玩家链缺甲敌:${text}`);
        断言战斗回归夹具(/乙敌[\s\S]*66/.test(allyLine), `友方链缺乙敌伤害:${text}`);
        断言战斗回归夹具(!/乙敌/.test(playerLine), `玩家链串到乙敌:${playerLine}`);
        断言战斗回归夹具(!/甲敌/.test(allyLine), `友方链串到甲敌:${allyLine}`);
        断言战斗回归夹具(/乙敌抓住夹具友方露出的破绽，以【Action_Missing】进行反击，造成了 33 点伤害/.test(text), `防反未挂回友方链:${text}`);
        日志.push(`团战多链战报成立:${text}`);
      });
      注册('多行动索敌失败不污染他人链', 日志 => {
        const lines = buildReadableBattleReportLines([
          '[团战第2回合开始]',
          '[团战执行] 夹具玩家以[横扫压制]指向[空位]。 [起招] 夹具玩家以[横扫压制]起招。 [索敌失败] 夹具玩家没有找到可被命中的有效目标。',
          '[团战执行] 夹具友方以[破甲刺]指向[乙敌]。 [起招] 夹具友方以[破甲刺]起招。 [应招] 乙敌以[承伤硬抗]应对。 [命中结算] 夹具友方对乙敌造成 72 点最终伤害。',
        ], 8);
        const text = lines.join('\n');
        const playerLine = lines.find(line => /夹具玩家/.test(line)) || '';
        const allyLine = lines.find(line => /夹具友方/.test(line)) || '';
        断言战斗回归夹具(/没有找到可被命中的有效目标|没有可被命中的有效目标/.test(playerLine), `玩家索敌失败未单独说明:${text}`);
        断言战斗回归夹具(!/乙敌|72/.test(playerLine), `索敌失败链串到友方命中:${playerLine}`);
        断言战斗回归夹具(/乙敌[\s\S]*72/.test(allyLine), `友方命中链缺失:${text}`);
        断言战斗回归夹具(!/索敌失败|\[索敌失败\]/.test(allyLine), `索敌失败污染友方链:${allyLine}`);
        日志.push(`多行动索敌失败隔离成立:${text}`);
      });
      注册('判定主卡隐藏内部术语', 日志 => {
        const rows = 构建判定流程展示数据([
          {
            type: '主动规划',
            行动者: '夹具玩家',
            目标: '夹具敌人',
            技能: '肉体兜底',
            回合: 1,
            最终权重: 30,
            选择原因: '无可用候选；候选池生成完毕，未检出资源或释放条件阻断',
            候选来源: '行为预演/主动战术阶段',
            候选排序结果: [{ 名称: '肉体兜底', 权重: 30 }, { 名称: '防御', 权重: 12 }],
          },
          {
            type: '主动规划',
            行动者: '夹具友方',
            目标: '',
            技能: '',
            回合: 1,
            选择原因: '无可用候选',
            候选来源: '行为预演/主动战术阶段',
            候选排序结果: [],
          },
          {
            type: '主动规划',
            行动者: '夹具友方',
            目标: '夹具敌人',
            技能: '普通攻击',
            回合: 1,
            最终权重: 50,
            选择原因: '集火',
            候选来源: '行为预演/战术阶段',
            候选排序结果: [{ 名称: '普通攻击', 权重: 50 }],
          },
        ], ['[第1回合] [团战执行] 夹具玩家以[伺机闪避]指向[夹具敌人]。']);
        const html = 渲染分回合判定流程(rows);
        const visible = html
          .replace(/<details class="battle-preview-debug">[\s\S]*?<\/details>/g, '')
          .replace(/<[^>]+>/g, '');
        断言战斗回归夹具(/原计划|改为|战术过渡|常规战术博弈/.test(visible), `主卡未显示动作流转事实:${visible}`);
        断言战斗回归夹具(/战术过渡|常规战术博弈/.test(visible), `流转主卡未弱化:${visible}`);
        断言战斗回归夹具(!/审计层|抽样候选|实战日志|权限流转|无可用候选|无资源失败|候选池生成完毕|行为预演\/战术阶段/.test(visible), `主卡泄漏内部术语:${visible}`);
        断言战斗回归夹具(!/battle-preview-debug|原始选择原因|执行校对证据/.test(html), '玩家态默认渲染了底层 Debug 明细');
        const 原开发态开关 = root.__LWCS_BATTLE_DEBUG_VISIBLE__;
        root.__LWCS_BATTLE_DEBUG_VISIBLE__ = true;
        const debugHtml = 渲染分回合判定流程(rows);
        root.__LWCS_BATTLE_DEBUG_VISIBLE__ = 原开发态开关;
        断言战斗回归夹具(/原始选择原因|执行校对证据/.test(debugHtml), '开发态 Debug 明细没有保留原始证据');
        日志.push(`判定主卡禁词成立:${visible}`);
      });
      注册('判定流程压缩重复并展示结算链', 日志 => {
        const traceList = [
          { type: '主动规划', round: 1, actor: '夹具玩家', target: '夹具敌人', skill: 战斗回归第一魂技默认名, 最终权重: 0, 选择原因: '当前未形成有效出手机会' },
          { type: '主动规划', round: 1, actor: '夹具玩家', target: '夹具敌人', skill: 战斗回归第一魂技默认名, 最终权重: 109, 选择原因: '压制收束' },
          { type: '再判定审计', round: 1, actor: '夹具玩家', target: '夹具敌人', skill: 战斗回归第一魂技默认名, 最终权重: 42, 选择原因: '行为链再判定' },
          { type: '主动规划', round: 1, actor: '夹具玩家', target: '夹具敌人', skill: 战斗回归第一魂技默认名, 最终权重: 105, 选择原因: '压制收束' },
          { type: '应招审计', round: 1, actor: '夹具敌人', target: '夹具玩家', skill: '伺机闪避', 最终权重: 20, 选择原因: '正式应招动作进入行为链' },
        ];
        const logs = [`[第1回合] [战前消耗] 释放[${战斗回归第一魂技默认名}]，自身扣除 魂力:120。 [起招] 夹具玩家以[${战斗回归第一魂技默认名}]起招。 [应招] 夹具敌人以[伺机闪避]应对。 [主动闪避] 夹具敌人凭借敏捷优势惊险躲过了攻击。`];
        const rows = [
          ...构建判定流程展示数据(traceList, logs),
          ...构建结算链侧写条目(logs),
        ];
        const html = 渲染分回合判定流程(rows);
        const visible = html.replace(/<[^>]+>/g, ' ');
        const firstSkillCount = (visible.match(new RegExp(`最终执行【${战斗回归第一魂技默认名}】`, 'g')) || []).length;
        断言战斗回归夹具(firstSkillCount <= 2, `第一魂技主卡重复刷屏:${firstSkillCount};${visible}`);
        断言战斗回归夹具(/结算链/.test(visible) && /闪避成功|没有命中|灵巧地闪避/.test(visible), `判定流程缺结算链:${visible}`);
        日志.push(`判定流程去重与结算链成立:${visible.slice(0, 180)}`);
      });
      注册('玩家手选动作补战术确立主卡', 日志 => {
        const logs = ['[第1回合] [团战执行] 唐凌雪以[锁魄印]指向[韦小枫]。 [起招] 唐凌雪以[锁魄印]起招。 [应招] 韦小枫以[承伤硬抗]应对。'];
        const rows = 构建判定流程展示数据([
          { type: '应招审计', round: 1, actor: '韦小枫', target: '唐凌雪', skill: '承伤硬抗', 最终权重: 28, 选择原因: '正式应招动作进入行为链' },
          { type: '再判定审计', round: 1, actor: '唐凌雪', target: '韦小枫', skill: '锁魄印', 最终权重: 44, 选择原因: '行为链再判定' },
        ], logs, { combatData: { 参战者: { team_player: [{ name: '唐凌雪' }], team_enemy: [{ name: '韦小枫' }] } } });
        const visible = 渲染分回合判定流程(rows).replace(/<details class="battle-preview-debug">[\s\S]*?<\/details>/g, '').replace(/<[^>]+>/g, ' ');
        断言战斗回归夹具(/战术确立/.test(visible) && /唐凌雪/.test(visible) && /锁魄印/.test(visible), `玩家手选主卡未出现:${visible}`);
        日志.push(`玩家手选主卡成立:${visible.slice(0, 140)}`);
      });
      注册('行为链审计不被起招校正', 日志 => {
        const logs = [`[第1回合] [团战执行] 夹具玩家以[${战斗回归第一魂技默认名}]指向[夹具敌人]。 [起招] 夹具玩家以[${战斗回归第一魂技默认名}]起招。 [应招] 夹具敌人以[伺机闪避]应对。`];
        const rows = 构建判定流程展示数据([
          { type: '应招审计', round: 1, actor: '夹具敌人', target: '夹具玩家', skill: '承伤硬抗', 最终权重: 40, 选择原因: '正式应招动作进入行为链' },
          { type: '再判定审计', round: 1, actor: '夹具敌人', target: '夹具玩家', skill: '伺机闪避', 最终权重: 20, 选择原因: '行为链再判定' },
        ], logs);
        const html = 渲染分回合判定流程(rows);
        const visible = html.replace(/<details class="battle-preview-debug">[\s\S]*?<\/details>/g, '').replace(/<[^>]+>/g, ' ');
        断言战斗回归夹具(!new RegExp(`临场变招|局势瞬息万变|战局变化后调整动作|最终执行【${战斗回归第一魂技默认名}】`).test(visible), `行为链审计被起招误校正或泄漏泛化变招:${visible}`);
        断言战斗回归夹具(/应招校验【承伤硬抗】|落点校验【伺机闪避】/.test(visible), `行为链校验未保留原动作:${visible}`);
        日志.push(`行为链审计不被起招校正成立:${visible.slice(0, 160)}`);
      });
      注册('判定流程按日志回合归桶行为链', 日志 => {
        const logs = [
          '[第1回合] [团战执行] 甲以[裂空斩]指向[乙]。 [起招] 甲以[裂空斩]起招。 [应招] 乙以[伺机闪避]应对。 [主动闪避] 乙惊险躲过了攻击。',
          '[第2回合] [团战执行] 甲以[回身突刺]指向[乙]。 [起招] 甲以[回身突刺]起招。 [应招] 乙以[承伤硬抗]应对。 [命中结算] 甲对乙造成 50 点最终伤害。',
        ];
        const rows = [
          ...构建判定流程展示数据([
            { type: '索敌规划', actor: '甲', target: '乙', skill: '', 最终权重: 18, 选择原因: '锁定目标' },
            { type: '主动规划', actor: '甲', target: '乙', skill: '裂空斩', 最终权重: 62, 选择原因: '压制收束' },
            { type: '应招审计', actor: '乙', target: '甲', skill: '伺机闪避', 最终权重: 24, 选择原因: '正式应招动作进入行为链' },
            { type: '主动规划', actor: '甲', target: '乙', skill: '回身突刺', 最终权重: 55, 选择原因: '继续追击' },
            { type: '应招审计', actor: '乙', target: '甲', skill: '承伤硬抗', 最终权重: 15, 选择原因: '正式应招动作进入行为链' },
          ], logs),
          ...构建结算链侧写条目(logs),
        ];
        const html = 渲染分回合判定流程(rows);
        const visible = html.replace(/<details class="battle-preview-debug">[\s\S]*?<\/details>/g, '').replace(/<[^>]+>/g, ' ');
        断言战斗回归夹具(/第1回合[\s\S]*裂空斩[\s\S]*伺机闪避/.test(visible), `第1回合行为链未随日志归桶:${visible}`);
        断言战斗回归夹具(/第2回合[\s\S]*回身突刺[\s\S]*承伤硬抗/.test(visible), `第2回合行为链未随日志归桶:${visible}`);
        断言战斗回归夹具(!/其他判定片段[\s\S]*(裂空斩|回身突刺|伺机闪避|承伤硬抗)/.test(visible), `行为链仍堆入未分配片段:${visible}`);
        日志.push(`行为链按日志回合归桶成立:${visible.slice(0, 180)}`);
      });
      注册('后续回合守势主规划不再蒸发', 日志 => {
        const logs = [
          '[第1回合] [团战执行] 唐凌雪以[贴身冲拳]指向[韦小枫]。 [起招] 唐凌雪以[贴身冲拳]起招。 [应招] 韦小枫以[伺机闪避]应对。 [主动闪避] 韦小枫凭借敏捷优势惊险躲过了攻击。',
          '[团战第2回合开始]',
          '[第2回合] [起招] 韦小枫以[第1魂技]起招。 [应招] 唐凌雪以[收招转防]应对。',
        ];
        const traceList = [
          { type: '主动规划', round: 1, actor: '唐凌雪', target: '韦小枫', skill: '贴身冲拳', 最终权重: 58, 选择原因: '压制收束' },
          { type: '主动规划', round: 2, actor: '唐凌雪', target: '韦小枫', skill: '', 最终权重: 0, 选择原因: '收招转防；当前未形成有效出手机会', 候选排序结果: [{ 名称: '收招转防', 权重: 42 }] },
          { type: '应招审计', round: 2, actor: '唐凌雪', target: '韦小枫', skill: '收招转防', 最终权重: 18, 选择原因: '正式应招动作进入行为链' },
        ];
        const rows = [
          ...构建判定流程展示数据(traceList, logs),
          ...构建结算链侧写条目(logs),
        ];
        const html = 渲染分回合判定流程(rows);
        const visible = html.replace(/<details class="battle-preview-debug">[\s\S]*?<\/details>/g, '').replace(/<[^>]+>/g, ' ');
        断言战斗回归夹具(/第2回合[\s\S]*主动规划[\s\S]*收招转防|第2回合[\s\S]*最终确认【收招转防】/.test(visible), `后续回合守势主规划仍蒸发:${visible}`);
        日志.push(`后续回合守势主规划保留:${visible.slice(0, 180)}`);
      });
      注册('表现层语义纠偏', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        敌人.HP上限 = 300;
        敌人.hp_max = 300;
        敌人.HP = 300;
        敌人.hp = 300;
        敌人.final = buildCombatFinalStats(敌人);
        const 无暇战报 = buildReadableBattleReportLines([
          '[第1回合]',
          '[团战执行] 夹具玩家以[精神震荡]指向[夹具敌人]。 [起招] 夹具玩家以[精神震荡]起招。 [应招] 夹具敌人以[无暇反应]应对。 [命中结算] 夹具玩家对夹具敌人造成 120 点最终伤害。 [状态施加] 夹具敌人获得[迟缓]。',
        ], 8, { combatData }).join('\n');
        断言战斗回归夹具(/夹具敌人未能及时反应/.test(无暇战报), `无暇反应被主动化:${无暇战报}`);
        断言战斗回归夹具(!/以【无暇反应】应对/.test(无暇战报), `无暇反应仍按技能展示:${无暇战报}`);
        断言战斗回归夹具(/夹具玩家对夹具敌人造成了 120 点伤害/.test(无暇战报), `伤害主语不明确:${无暇战报}`);
        断言战斗回归夹具(/重创/.test(无暇战报), `战损烈度缺失:${无暇战报}`);
        断言战斗回归夹具(/夹具敌人陷入【迟缓】/.test(无暇战报), `状态未并入攻防链:${无暇战报}`);

        const 硬抗战报 = buildReadableBattleReportLines([
          '[第1回合]',
          '[团战执行] 夹具玩家以[裂地冲拳]指向[夹具敌人]。 [起招] 夹具玩家以[裂地冲拳]起招。 [应招] 夹具敌人以[承伤硬抗]应对。 [命中结算] 夹具玩家对夹具敌人造成 40 点最终伤害。',
        ], 8, { combatData }).join('\n');
        断言战斗回归夹具(/收缩防线|稳住防线|承压|硬抗/.test(硬抗战报), `承伤硬抗未呈现主动防御语义:${硬抗战报}`);
        断言战斗回归夹具(!/避让空间不足，只能硬吃/.test(硬抗战报), `承伤硬抗仍被写成被动硬吃:${硬抗战报}`);
        断言战斗回归夹具(!/以【承伤硬抗】应对/.test(硬抗战报), `承伤硬抗仍保留主动化句式:${硬抗战报}`);
        断言战斗回归夹具(!/硬吃[^。；]*硬吃/.test(硬抗战报), `承伤硬抗文案重复:${硬抗战报}`);

        const 无伤硬抗战报 = buildReadableBattleReportLines([
          '[第2回合]',
          '[团战执行] 夹具玩家以[裂地冲拳]指向[夹具敌人]。 [起招] 夹具玩家以[裂地冲拳]起招。 [应招] 夹具敌人以[承伤硬抗]应对。',
        ], 8, { combatData }).join('\n');
        断言战斗回归夹具(/未能造成实质伤害/.test(无伤硬抗战报), `硬吃无伤害未明确说明:${无伤硬抗战报}`);

        const 支援Rows = 构建判定流程展示数据([{
          type: '主动规划',
          行动者: '夹具玩家',
          目标: '夹具玩家',
          技能: '星辉护壁',
          回合: 1,
          目标语义: '自身',
          选择原因: '压制敌方续航点',
          目标理由: ['范围压制窗口打开', '安全距离仍可维持'],
          战术修正: 29,
          团队意图修正: 17,
          记忆惩罚: -3,
          最终权重: 62,
          候选排序结果: [{ 名称: '星辉护壁', 权重: 62 }, { 名称: '防御', 权重: 52 }],
        }]);
        const 支援可见 = 渲染分回合判定流程(支援Rows)
          .replace(/<details class="battle-preview-debug">[\s\S]*?<\/details>/g, '')
          .replace(/<[^>]+>/g, '');
        断言战斗回归夹具(!/压制敌方|范围压制|收割|击杀/.test(支援可见), `友方支援仍泄漏攻击理由:${支援可见}`);
        断言战斗回归夹具(/巩固防线|规避后续伤害/.test(支援可见), `友方支援缺防御语义:${支援可见}`);
        断言战斗回归夹具(/(?:施法对象：自身|作用目标：自身态势)（夹具玩家）/.test(支援可见), `自身目标未转为自然文案:${支援可见}`);
        断言战斗回归夹具(!/当前指向：【夹具玩家】|夹具玩家指向夹具玩家/.test(支援可见), `自身目标仍有机器自指:${支援可见}`);
        断言战斗回归夹具(!/主要加权|战术收益|团队意图|\(\+?\-?\d+\)|权衡：[^。！？]*\(\d+分\)/.test(支援可见), `支援主卡仍泄漏权重或计分板:${支援可见}`);

        const 压迫Rows = 构建判定流程展示数据([{
          type: '主动规划',
          行动者: '夹具敌人',
          目标: '夹具玩家',
          技能: '敌方压迫',
          回合: 1,
          目标语义: '敌方单体',
          选择原因: '压招',
          候选排序结果: [{ 名称: '敌方压迫', 权重: 64 }, { 名称: '普通攻击', 权重: 48 }],
        }]);
        const 压迫可见 = 渲染分回合判定流程(压迫Rows)
          .replace(/<details class="battle-preview-debug">[\s\S]*?<\/details>/g, '')
          .replace(/<[^>]+>/g, '');
        断言战斗回归夹具(/反制压制|逼位卡位/.test(压迫可见), `敌方压迫仍被泛化为控制:${压迫可见}`);
        断言战斗回归夹具(!/确认【控制】意图/.test(压迫可见), `敌方压迫意图仍过粗:${压迫可见}`);

        const 全场支援Rows = 构建判定流程展示数据([{
          type: '主动规划',
          行动者: '夹具玩家',
          目标: '夹具友方',
          技能: '全场鼓舞',
          hitCandidateName: '范围压制',
          finalResolvedActionName: '全场鼓舞',
          actionOverrideSource: '主动规划',
          回合: 1,
          目标语义: '友方群体',
          选择原因: '压制收束',
          目标理由: ['范围压制窗口打开'],
          战术修正: 48,
          最终权重: 274,
          候选排序结果: [{ 名称: '范围压制', 权重: 274 }, { 名称: '伺机闪避', 权重: 0 }],
        }]);
        const 全场支援可见 = 渲染分回合判定流程(全场支援Rows)
          .replace(/<details class="battle-preview-debug">[\s\S]*?<\/details>/g, '')
          .replace(/<[^>]+>/g, '');
        断言战斗回归夹具(!/先命中|战术窗口|随后落地/.test(全场支援可见), `支援技能泄漏候选覆写黑箱:${全场支援可见}`);
        断言战斗回归夹具(/支援对象：【夹具友方】/.test(全场支援可见), `全场支援仍未转为支援对象口径:${全场支援可见}`);
        断言战斗回归夹具(!/当前指向：【夹具友方】/.test(全场支援可见), `全场支援仍复用敌对目标口径:${全场支援可见}`);
        断言战斗回归夹具(!/最终执行【全场鼓舞】指向夹具友方/.test(全场支援可见), `全场支援仍复用敌对决断句式:${全场支援可见}`);
        断言战斗回归夹具(/最终以【全场鼓舞】巩固自身节奏/.test(全场支援可见), `全场支援未切入支援决断句式:${全场支援可见}`);

        const 压制Rows = 构建判定流程展示数据([{
          type: '主动规划',
          行动者: '夹具玩家',
          目标: '敌方治疗',
          技能: '普通攻击',
          回合: 1,
          目标语义: '敌方单体',
          选择原因: '集火',
          目标理由: ['治疗救场价值'],
          最终权重: 50,
          候选排序结果: [{ 名称: '普通攻击', 权重: 50 }, { 名称: '撤离', 权重: 12 }],
        }]);
        const 压制可见 = 渲染分回合判定流程(压制Rows)
          .replace(/<details class="battle-preview-debug">[\s\S]*?<\/details>/g, '')
          .replace(/<[^>]+>/g, '');
        断言战斗回归夹具(/压制敌方续航/.test(压制可见), `敌方续航压制被误删:${压制可见}`);

        const 造物Rows = 构建判定流程展示数据([{
          type: '主动规划',
          行动者: '唐凌雪',
          目标: '韦小枫',
          技能: '香喷喷牛肉干',
          回合: 4,
          目标语义: '造物承载',
          选择原因: '造物入包',
          最终权重: 42,
          候选排序结果: [{ 名称: '香喷喷牛肉干', 权重: 42 }],
        }]);
        const 造物可见 = 渲染分回合判定流程(造物Rows)
          .replace(/<details class="battle-preview-debug">[\s\S]*?<\/details>/g, '')
          .replace(/<[^>]+>/g, '');
        断言战斗回归夹具(/作用目标：造物承载/.test(造物可见), `造物动作仍复用敌方目标:${造物可见}`);
        断言战斗回归夹具(/完成造物承载|巩固自身节奏/.test(造物可见), `造物决断句仍未分流:${造物可见}`);
        断言战斗回归夹具(!/指向韦小枫/.test(造物可见), `造物动作仍错误指向敌方:${造物可见}`);

        const 守势Rows = 构建判定流程展示数据([
          {
            type: '主动规划',
            行动者: '夹具玩家',
            目标: '夹具敌人',
            技能: '收招转防',
            回合: 2,
            选择原因: '当前未形成有效出手机会',
            actionOverrideSource: '行为链再判定',
            候选排序结果: [{ 名称: '锁魄印', 权重: 55 }, { 名称: '收招转防', 权重: 42 }],
          },
          {
            type: '应招审计',
            行动者: '夹具玩家',
            目标: '夹具敌人',
            技能: '收招转防',
            回合: 2,
            选择原因: '正式应招动作进入行为链',
          },
        ]);
        const 守势可见 = 渲染分回合判定流程(守势Rows)
          .replace(/<details class="battle-preview-debug">[\s\S]*?<\/details>/g, '')
          .replace(/<[^>]+>/g, '');
        断言战斗回归夹具(/窗口已经消散|察觉战机已经溜走|主动收缩节奏/.test(守势可见), `守势退让仍只剩承压泛化语义:${守势可见}`);
        断言战斗回归夹具(/对照眼前攻势，确认以【收招转防】承住这一轮冲击/.test(守势可见), `应招审计语感未与主动规划拉开:${守势可见}`);
        日志.push(`表现层语义纠偏成立:${无暇战报} / ${支援可见} / ${守势可见}`);
      });
      注册('判定流程展示细化', 日志 => {
        const rows = 构建判定流程展示数据([
          {
            type: '索敌规划',
            行动者: '夹具敌人',
            目标: '夹具友方',
            回合: 1,
            选择原因: '目标优先表命中；唯一有效敌方目标',
            目标理由: ['后排/续航核心', '控制优先'],
          },
          {
            type: '辅助目标规划',
            行动者: '夹具玩家',
            目标: '夹具玩家',
            回合: 1,
            选择原因: '友方目标优先表命中；常规观察',
          },
          {
            type: '主动规划',
            行动者: '夹具玩家',
            目标: '甲敌',
            技能: '',
            回合: 1,
            选择原因: '当前未形成有效出手机会',
          },
          {
            type: '主动规划',
            行动者: '夹具玩家',
            目标: '乙敌',
            技能: '',
            回合: 1,
            选择原因: '常规方案收益过低',
          },
          {
            type: '主动规划',
            行动者: '夹具玩家',
            目标: '',
            技能: '',
            回合: 1,
            选择原因: '当前未形成有效出手机会',
          },
          {
            type: '主动规划',
            行动者: '夹具玩家',
            目标: '丙敌',
            技能: '裂空斩',
            回合: 1,
            选择原因: '压制收束',
            战术修正: -12,
            recentActionCount: 2,
            候选排序结果: [
              { 名称: '裂空斩', 权重: 66, recentActionCount: 2 },
              { 名称: '伺机闪避', 权重: 52 },
            ],
            最终权重: 66,
          },
          {
            type: '再判定审计',
            行动者: '夹具玩家',
            目标: '丙敌',
            技能: '裂空斩',
            回合: 1,
            选择原因: '放弃再判定',
            候选排序结果: [
              { 名称: '裂空斩', 权重: 44 },
              { 名称: '普通攻击', 权重: 30 },
            ],
            最终权重: 44,
          },
        ], []);
        const html = 渲染分回合判定流程([
          ...rows,
          {
            type: 'trace',
            trace: {
              type: '防反机制',
              行动者: '夹具敌人',
              目标: '夹具玩家',
              回合: 1,
              result: 'success',
              sourceActionName: '',
              damage: 33,
            },
          },
          {
            type: '防反机制',
            类型: '防反机制',
            行动者: '夹具友方',
            目标: '',
            回合: 1,
            roundPhase: 'action_result',
            phaseBucket: 'action_result',
            sourceActionName: '短刀',
            sourceActionType: 'counter',
            failReason: '距离不够',
            result: 'fail',
          },
        ]);
        const visible = html
          .replace(/<details class="battle-preview-debug">[\s\S]*?<\/details>/g, '')
          .replace(/<[^>]+>/g, ' ');
        断言战斗回归夹具(!/辅助目标规划/.test(visible), `无效辅助规划仍上屏:${visible}`);
        断言战斗回归夹具(/锁定对手/.test(visible) && /夹具友方/.test(visible), `索敌主卡仍未转为对手口径:${visible}`);
        断言战斗回归夹具(!/锁定目标/.test(visible), `索敌主卡仍在使用机械目标口径:${visible}`);
        断言战斗回归夹具(!/试图掌住战局节奏/.test(visible), `目标规划仍泄漏泛化战略词:${visible}`);
        断言战斗回归夹具(/目标遍历详情/.test(visible), `多目标失败推演未折叠:${visible}`);
        断言战斗回归夹具(/中间推演/.test(visible), `中间推演未归并:${visible}`);
        断言战斗回归夹具(!/重复使用惩罚|记忆惩罚|重复释放衰减|repeatDecay/.test(visible), `旧重复衰减元数据仍在玩家视图:${visible}`);
        断言战斗回归夹具(!/直接采用【裂空斩】/.test(visible), `放弃再判定仍映射为直接采用:${visible}`);
        断言战斗回归夹具(/动作沿用原计划/.test(visible), `keep_original 未改为事实语气:${visible}`);
        断言战斗回归夹具(!/未发现更优解|结合当前局势|战术倾向保留/.test(visible), `keep_original 仍泄漏黑箱解释:${visible}`);
        断言战斗回归夹具(/抓住\s*夹具玩家\s*露出的破绽，以\s*【Action_Missing】\s*进行反击[^。]*33\s*点伤害/.test(visible), `防反成功缺动作来源:${visible}`);
        断言战斗回归夹具(/尝试以\s*【短刀】\s*反打，但距离不够/.test(visible), `防反失败原因未展示:${visible}`);
        日志.push(`判定流程展示细化成立:${visible.slice(0, 220)}`);
      });
      注册('展示层P1护栏回归', 日志 => {
        const rows = 构建判定流程展示数据([
          {
            type: '应招审计',
            行动者: '夹具敌人',
            目标: '夹具玩家',
            技能: '无法反应',
            回合: 1,
            最终权重: 0,
            选择原因: '正式应招动作进入行为链',
            候选排序结果: [{ 名称: '无法反应', 权重: 0 }, { 名称: '承伤硬抗', 权重: 0 }],
          },
          {
            type: '再判定审计',
            行动者: '夹具玩家',
            目标: '夹具敌人',
            技能: '流火散射',
            回合: 1,
            最终权重: 66,
            选择原因: '战术重心锁定',
            候选排序结果: [
              { 名称: '抢落点', 权重: 66, candidateStatus: 'EXECUTED' },
              { 名称: '放弃再判定', 权重: 20, candidateStatus: 'REJECTED', rejectionCode: 'LOWER_PRIORITY' },
            ],
          },
        ], []);
        const settlementRows = 构建结算链侧写条目([
          '[第1回合] [命中结算] 夹具玩家对夹具敌人造成 88 点最终伤害。 [状态结算] 夹具敌人受[重度流血]影响，额外损失 18 点HP',
        ], {
          combatData: {
            参战者: {
              team_player: [{ name: '夹具玩家' }],
              team_enemy: [{ name: '夹具敌人' }],
            },
          },
        });
        const counterRows = [{
          type: 'trace',
          trace: {
            type: '防反机制',
            行动者: '夹具敌人',
            目标: '夹具玩家',
            回合: 1,
            result: 'success',
            sourceActionName: '',
            damage: 33,
          },
        }];
        const html = 渲染分回合判定流程([...rows, ...counterRows, ...settlementRows]);
        const visible = html.replace(/<details class="battle-preview-debug">[\s\S]*?<\/details>/g, '').replace(/<[^>]+>/g, ' ');
        断言战斗回归夹具(/无法反应/.test(visible) && !/评分为0/.test(visible), `0分审计仍泄漏评分口径:${visible}`);
        断言战斗回归夹具(/▱▱▱▱▱▱▱▱▱▱/.test(visible), `0分候选条未渲染为空条:${visible}`);
        断言战斗回归夹具(/回合结算/.test(visible) && /重度流血/.test(visible), `状态结算未进入独立容器:${visible}`);
        断言战斗回归夹具(/【Action_Missing】/.test(visible), `防反缺动作名未显性占位:${visible}`);
        断言战斗回归夹具(!/战术推演池|原始:\d+/.test(visible), `再判定仍泄漏旧候选池格式:${visible}`);
        断言战斗回归夹具(!/维持原定计划使用【流火散射】/.test(visible), `抢落点命中仍被映射为维持原案:${visible}`);
        日志.push(`展示层P1护栏成立:${visible.slice(0, 240)}`);
      });
      注册('全场纯增益不触发敌对', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        const 全场增益 = normalizeSkillData({
          name: '全场鼓舞',
          魂技名: '全场鼓舞',
          技能分类: '辅助',
          目标: '全场',
          消耗: '无',
          前摇: 6,
          _效果数组: [
            { 原型: '属性修正', 目标: '全场', 数值: '+20', 属性: '防御' },
            { 原型: '护盾变化', 目标: '全场', 护盾模式: '正向护盾', 数值: '+50' },
          ],
        }, '全场鼓舞');
        const action = { action_type: '释放魂技', type: '释放魂技', skill: 全场增益, cast_time: 6 };
        断言战斗回归夹具(判定单挑动作敌对(action, 玩家, 敌人, combatData) === false, '全场纯增益被误判敌对');
        const targetContext = resolveSkillTargetContext(全场增益, 玩家, 敌人, combatData, 全场增益._效果数组[0]);
        断言战斗回归夹具(targetContext.targetSet.some(unit => unit.name === '夹具玩家'), '全场增益未覆盖施术者');
        断言战斗回归夹具(targetContext.targetSet.some(unit => unit.name === '夹具敌人'), '全场增益未覆盖场上其他单位');
        日志.push(`全场纯增益非敌对成立:${targetContext.targetSet.map(unit => unit.name).join('、')}`);
      });
      注册('全场伤害触发敌对', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        const 全场伤害 = normalizeSkillData({
          name: '全场震荡',
          魂技名: '全场震荡',
          技能分类: '输出',
          目标: '全场',
          消耗: '无',
          前摇: 6,
          _效果数组: [
            { 原型: '伤害结算', 目标: '全场', 生效方式: '独立生效', 威力倍率: 40, 伤害类型: '远程攻击' },
          ],
        }, '全场震荡');
        const action = { action_type: '释放魂技', type: '释放魂技', skill: 全场伤害, cast_time: 6 };
        断言战斗回归夹具(判定单挑动作敌对(action, 玩家, 敌人, combatData) === true, '全场伤害未判定为敌对');
        const targetContext = resolveSkillTargetContext(全场伤害, 玩家, 敌人, combatData, 全场伤害._效果数组[0]);
        断言战斗回归夹具(targetContext.targetSet.some(unit => unit.name === '夹具玩家'), '全场伤害未覆盖玩家侧');
        断言战斗回归夹具(targetContext.targetSet.some(unit => unit.name === '夹具敌人'), '全场伤害未覆盖敌方侧');
        日志.push(`全场伤害敌对成立:${targetContext.targetSet.map(unit => unit.name).join('、')}`);
      });
      注册('NPC敌方削弱目标取玩家侧', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        const 削弱 = normalizeSkillData({
          name: '敌方削弱',
          魂技名: '敌方削弱',
          技能分类: '削弱',
          目标: '敌方单体',
          消耗: '无',
          前摇: 8,
          _效果数组: [
            { 原型: '属性修正', 目标: '单体', 数值: '-30', 属性: '防御' },
          ],
        }, '敌方削弱');
        const action = { action_type: '释放魂技', type: '释放魂技', skill: 削弱, target_name: 玩家.name, cast_time: 8 };
        使用战斗回归桥接(combatData, { 夹具玩家: 玩家, 夹具敌人: 敌人 }, () => {
          const supportCost = resolveSupportCostContext(敌人, action);
          断言战斗回归夹具(supportCost.目标?.name === '夹具玩家', `NPC敌方单体辅助上下文未取玩家侧:${supportCost.目标?.name || '无'}`);
          const actualTarget = 解析动作实际覆盖目标上下文(敌人, action, 玩家, combatData);
          断言战斗回归夹具(actualTarget.目标?.name === '夹具玩家', `NPC敌方削弱实际目标未取玩家侧:${actualTarget.目标?.name || '无'}`);
          断言战斗回归夹具(!actualTarget.目标列表.some(unit => unit.name === '夹具敌人'), 'NPC敌方削弱误覆盖自己队伍');
          日志.push(`NPC敌方削弱目标成立:${actualTarget.目标列表.map(unit => unit.name).join('、') || actualTarget.目标?.name}`);
        });
      });
      注册('控制削弱完成后扣费落状态', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        const 控制 = normalizeSkillData({
          name: '夹具封技',
          魂技名: '夹具封技',
          技能分类: '控制',
          目标: '敌方单体',
          消耗: '魂力:120',
          前摇: 8,
          _效果数组: [
            { 原型: '状态施加', 目标: '单体', 状态: '封技夹具', 状态名称: '封技夹具', 持续回合: 2, 计算层效果: { skill_seal: true } },
          ],
        }, '夹具封技');
        const action = { action_type: '释放魂技', type: '释放魂技', skill: 控制, target_name: 敌人.name, cast_time: 8 };
        let costLog = '';
        let result = null;
        使用战斗回归桥接(combatData, { 夹具玩家: 玩家, 夹具敌人: 敌人 }, () => {
          costLog = applyActionCost(玩家, action, 敌人, combatData);
          result = executeClash(
            action,
            构建单挑反应动作({ action_type: '无法反应', type: '无法反应' }, 敌人, 玩家),
            构建单挑临时战斗数据(玩家, 敌人, 'player', combatData),
          );
        });
        断言战斗回归夹具(/战前消耗/.test(costLog), `控制完成未扣费:${costLog}`);
        断言战斗回归夹具(Number(玩家.sp) === 1880 && Number(玩家.魂力) === 1880, `控制扣费异常:${玩家.sp}/${玩家.魂力}`);
        断言战斗回归夹具(!!敌人.状态效果?.封技夹具, `控制状态未落地:${result?.desc || ''}`);
        断言战斗回归夹具(/封技夹具/.test(String(result?.desc || '')), `控制战报缺状态:${result?.desc || ''}`);
        日志.push(`控制完成扣费落状态成立:${costLog} ${result?.desc || ''}`);
      });
      注册('控制资源不足不扣费不落地', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.sp = 50;
        玩家.魂力 = 50;
        const 控制 = normalizeSkillData({
          name: '高耗封技',
          魂技名: '高耗封技',
          技能分类: '控制',
          目标: '敌方单体',
          消耗: '魂力:120',
          前摇: 8,
          _效果数组: [
            { 原型: '状态施加', 目标: '单体', 状态: '高耗封技状态', 状态名称: '高耗封技状态', 持续回合: 2, 计算层效果: { skill_seal: true } },
          ],
        }, '高耗封技');
        const action = { action_type: '释放魂技', type: '释放魂技', skill: 控制, target_name: 敌人.name, cast_time: 8 };
        let costLog = '';
        使用战斗回归桥接(combatData, { 夹具玩家: 玩家, 夹具敌人: 敌人 }, () => {
          costLog = applyActionCost(玩家, action, 敌人, combatData);
        });
        断言战斗回归夹具(action.action_type === '施法失败', '资源不足控制未标记失败');
        断言战斗回归夹具(Number(玩家.sp) === 50 && Number(玩家.魂力) === 50, `资源不足仍扣费:${玩家.sp}/${玩家.魂力}`);
        断言战斗回归夹具(!敌人.状态效果?.高耗封技状态, '资源不足控制提前落状态');
        断言战斗回归夹具(/状态枯竭|无法支撑|施法失败/.test(costLog), `资源不足日志不明确:${costLog}`);
        日志.push(`控制资源不足阻断成立:${costLog}`);
      });
      注册('施法失败误入结算不落状态', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        const 控制 = normalizeSkillData({
          name: '失败封技',
          魂技名: '失败封技',
          技能分类: '控制',
          目标: '敌方单体',
          消耗: '魂力:120',
          前摇: 8,
          _效果数组: [
            { 原型: '状态施加', 目标: '单体', 状态: '失败不应落地', 状态名称: '失败不应落地', 持续回合: 2, 计算层效果: { skill_seal: true } },
          ],
        }, '失败封技');
        const action = { action_type: '施法失败', type: '释放魂技', skill: 控制, target_name: 敌人.name, cast_time: 8 };
        let result = null;
        使用战斗回归桥接(combatData, { 夹具玩家: 玩家, 夹具敌人: 敌人 }, () => {
          result = executeClash(action, 构建单挑配合动作(玩家, 敌人, action), 构建单挑临时战斗数据(玩家, 敌人, 'player', combatData));
        });
        断言战斗回归夹具(Number(玩家.sp) === 2000 && Number(玩家.魂力) === 2000, `失败动作误扣费:${玩家.sp}/${玩家.魂力}`);
        断言战斗回归夹具(!敌人.状态效果?.['失败不应落地'], `失败动作误落状态:${result?.desc || ''}`);
        断言战斗回归夹具(/未完成|失败|取消/.test(String(result?.desc || '')), `失败动作结算日志不明确:${result?.desc || ''}`);
        日志.push(`施法失败误入结算被拦截:${result?.desc || ''}`);
      });
      注册('团战NPC友方辅助不串敌我', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        敌人.name = '夹具敌方辅助';
        敌人.type = '辅助系';
        敌人.sp = 2000;
        敌人.魂力 = 2000;
        敌人.final = buildCombatFinalStats(敌人);
        const 敌方残血队友 = 构建战斗回归夹具单位('夹具敌方残血', '强攻系');
        敌方残血队友.hp = 200;
        敌方残血队友.HP = 200;
        敌方残血队友.final = buildCombatFinalStats(敌方残血队友);
        combatData.参战者.team_enemy = [敌人, 敌方残血队友];
        敌人.第1武魂 = {
          表象名称: '辅助夹具武魂',
          第1魂环: {
            第1魂技: normalizeSkillData({
              name: '夹具护援',
              魂技名: '夹具护援',
              技能分类: '辅助',
              目标: '友方单体',
              消耗: '魂力:80',
              前摇: 6,
              _效果数组: [
                { 原型: '状态施加', 目标: '单体', 状态: '护盾', 状态名称: '护援夹具', 数值: 120, 持续回合: 2 },
              ],
            }, '夹具护援'),
          },
        };
        const result = 使用战斗回归桥接(combatData, { 夹具玩家: 玩家, 夹具敌方辅助: 敌人, 夹具敌方残血: 敌方残血队友 }, () => {
          return runActorTurn({ char: 敌人, side: 'enemy' }, { combatData, observedTargetAction: { action_type: '防御', type: '防御', skill: normalizeSkillData({ name: '防御', 技能分类: '防御', 消耗: '无' }, '防御') } });
        });
        断言战斗回归夹具(/夹具护援|支援|辅助|护援/.test(String(result?.log || '')), `NPC辅助行动日志缺支援:${result?.log || ''}`);
        断言战斗回归夹具(Number(敌人.sp) < 2000 && Number(敌人.sp) > 1800, `NPC辅助扣费异常:${敌人.sp};${result?.log || ''}`);
        断言战斗回归夹具(
          !!敌方残血队友.状态效果?.护盾 && String(敌方残血队友.状态效果.护盾?.来源技能 || '').includes('夹具护援'),
          `友方辅助未落到敌方队友:${result?.log || ''}`,
        );
        断言战斗回归夹具(!玩家.状态效果?.护盾, 'NPC友方辅助误落到玩家');
        断言战斗回归夹具(!/夹具敌方辅助对夹具敌方残血造成|命中结算.*夹具敌方辅助对夹具敌方残血/.test(String(result?.log || '')), `NPC辅助被当成攻击队友:${result?.log || ''}`);
        日志.push(`团战NPC友方辅助不串敌我成立:${result?.log || ''}`);
      });
      注册('友方群体护盾只落己方', 日志 => {
        const { combatData, 玩家, 友方, 敌人 } = 构建战斗回归夹具战斗态();
        const 群体护盾 = normalizeSkillData({
          name: '夹具群体护盾',
          魂技名: '夹具群体护盾',
          技能分类: '辅助',
          目标: '友方群体',
          消耗: '魂力:60',
          前摇: 6,
          _效果数组: [
            { 原型: '护盾变化', 目标: '群体', 护盾模式: '正向护盾', 数值: '+80', 持续回合: 2 },
          ],
        }, '夹具群体护盾');
        const action = { action_type: '释放魂技', type: '释放魂技', skill: 群体护盾, target_name: 玩家.name, cast_time: 6 };
        let result = null;
        使用战斗回归桥接(combatData, { 夹具玩家: 玩家, 夹具友方: 友方, 夹具敌人: 敌人 }, () => {
          result = executeClash(action, 构建单挑配合动作(玩家, 玩家, action), 构建单挑临时战斗数据(玩家, 玩家, 'player', combatData));
        });
        断言战斗回归夹具(Number(玩家.状态效果?.夹具群体护盾?.shield_value || 0) > 0, `群体护盾未落到施术者:${result?.desc || ''}`);
        断言战斗回归夹具(Number(友方.状态效果?.夹具群体护盾?.shield_value || 0) > 0, `群体护盾未落到友方:${result?.desc || ''}`);
        断言战斗回归夹具(!敌人.状态效果?.夹具群体护盾, '友方群体护盾误落到敌方');
        日志.push(`友方群体护盾落点成立:${result?.desc || ''}`);
      });
      注册('敌方群体伤害跟随状态逐目标', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.agi = 9999;
        玩家.men_max = 9999;
        玩家.final = buildCombatFinalStats(玩家);
        敌人.agi = 1;
        敌人.def = 500;
        敌人.final = buildCombatFinalStats(敌人);
        const 敌方二号 = 构建战斗回归夹具单位('夹具敌方二号', '强攻系');
        敌方二号.agi = 1;
        敌方二号.def = 500;
        敌方二号.final = buildCombatFinalStats(敌方二号);
        combatData.参战者.team_enemy = [敌人, 敌方二号];
        const 群体压制 = normalizeSkillData({
          name: '夹具群体压制',
          魂技名: '夹具群体压制',
          技能分类: '输出',
          目标: '敌方群体',
          消耗: '魂力:50',
          前摇: 8,
          _效果数组: [
            { 原型: '伤害结算', 目标: '群体', 生效方式: '独立生效', 威力倍率: 10, 伤害类型: '远程攻击' },
            { 原型: '状态施加', 目标: '群体', 生效方式: '跟随主原型', 状态: '迟缓', 数值: '+10%', 持续回合: 2 },
          ],
        }, '夹具群体压制');
        const action = { action_type: '释放魂技', type: '释放魂技', skill: 群体压制, target_name: 敌人.name, cast_time: 8 };
        let result = null;
        使用战斗回归桥接(combatData, { 夹具玩家: 玩家, 夹具敌人: 敌人, 夹具敌方二号: 敌方二号 }, () => {
          result = executeClash(action, 构建单挑反应动作({ action_type: '防御', type: '防御' }, 敌人, 玩家), 构建单挑临时战斗数据(玩家, 敌人, 'player', combatData));
        });
        const 命中目标名 = (result?.targetResults || []).filter(entry => Number(entry?.damage || 0) > 0).map(entry => entry.target?.name || entry.targetName || '');
        断言战斗回归夹具(命中目标名.includes('夹具敌人') && 命中目标名.includes('夹具敌方二号'), `群体伤害未逐目标命中:${result?.desc || ''}`);
        const 目标结果去重 = new Set((result?.targetResults || []).map(entry => entry.target?.name || entry.targetName || '').filter(Boolean));
        断言战斗回归夹具(目标结果去重.size === 2 && (result?.targetResults || []).length === 2, `群体结算目标重复:${(result?.targetResults || []).map(entry => entry.target?.name || entry.targetName || '').join('、')};${result?.desc || ''}`);
        断言战斗回归夹具(!!敌人.状态效果?.迟缓 && !!敌方二号.状态效果?.迟缓, `跟随状态未落到全部命中目标:${result?.desc || ''}`);
        断言战斗回归夹具(!玩家.状态效果?.迟缓, '敌方群体跟随状态误落到玩家');
        日志.push(`敌方群体伤害跟随状态成立:${result?.desc || ''}`);
      });
      注册('护盾先吸收再扣血', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        applyShieldToCharacter(敌人, 80, 2, '夹具护盾');
        const beforeHp = getCombatHpValue(敌人);
        const action = { action_type: '释放魂技', type: '释放魂技', skill: normalizeSkillData(战斗回归输出魂技('夹具破盾击', '敌方单体', 8, 80, '近身攻击'), '夹具破盾击') };
        const settleResult = {
          dmg: 120,
          desc: '',
          targetResults: [{ target: 敌人, targetName: 敌人.name, damage: 120, kind: 'primary' }],
        };
        const applied = applyResolvedDamagePackage(玩家, action, settleResult, { primaryTarget: 敌人, combatData });
        const lostHp = beforeHp - getCombatHpValue(敌人);
        断言战斗回归夹具(lostHp === 40, `护盾吸收后扣血异常:${lostHp};${applied.log || ''}`);
        断言战斗回归夹具(!敌人.状态效果?.夹具护盾, '护盾耗尽后未移除');
        断言战斗回归夹具(/护盾吸收/.test(applied.log || ''), `护盾吸收日志缺失:${applied.log || ''}`);
        日志.push(`护盾吸收顺序成立:${applied.log || ''}`);
      });
      注册('UI动作声明契约不丢字段', 日志 => {
        const { combatData, 玩家, 友方, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.自创魂技 = {
          夹具援护: {
            魂技名: '夹具援护',
            name: '夹具援护',
            技能分类: '辅助',
            目标: '友方单体',
            消耗: '魂力:30',
            前摇: 6,
            使用条件: { 最低等级: 1 },
            _效果数组: [
              { 原型: '护盾变化', 目标: '单体', 护盾模式: '正向护盾', 数值: '+80' },
            ],
          },
        };
        玩家.背包.夹具药剂 = {
          名称: '夹具药剂',
          数量: 1,
          使用效果: [{ 原型: '资源变化', 目标: '自身', 资源: '魂力', 数值: '+10' }],
        };
        const actions = ui_getAvailableActions(玩家, combatData);
        const firstAction = actions.find(action => action.name === 战斗回归第一魂技默认名);
        const supportAction = actions.find(action => action.name === '夹具援护');
        const itemAction = actions.find(action => action.name === '夹具药剂');
        断言战斗回归夹具(!!firstAction && !!supportAction && !!itemAction, `UI动作缺失:${actions.map(action => action.name).join('、')}`);
        supportAction.target_name = 友方.name;
        const firstEntry = buildActionDeclarationEntry(firstAction);
        const supportEntry = buildActionDeclarationEntry(supportAction);
        const itemEntry = buildActionDeclarationEntry(itemAction);
        断言战斗回归夹具(firstEntry.actor_name === 玩家.name, '第一魂技UI声明缺行动者');
        断言战斗回归夹具(firstEntry.__魂环路径?.join('/') === '第1武魂/第1魂环' && firstEntry.__魂技槽位 === '第1魂技', '第一魂技UI声明缺魂环槽位');
        断言战斗回归夹具(firstEntry.skill?.目标 === '敌方单体' && firstEntry.skill?.技能分类 === '控制', '第一魂技UI声明缺目标/分类');
        断言战斗回归夹具(supportEntry.target_name === 友方.name, `友方辅助UI声明目标错误:${supportEntry.target_name}`);
        断言战斗回归夹具(supportEntry.skill?.目标 === '友方单体' && supportEntry.skill?.技能分类 === '辅助', '友方辅助UI声明缺目标/分类');
        断言战斗回归夹具(supportEntry.skill?.使用条件?.最低等级 === 1, '友方辅助UI声明缺使用条件');
        断言战斗回归夹具(itemEntry.action_type === '使用物品' && itemEntry.物品名 === '夹具药剂', '物品UI声明缺使用物品契约');
        断言战斗回归夹具(itemEntry.skill?.__物品名 === '夹具药剂' && itemEntry.skill?.承载方式 === '物品使用', '物品UI声明缺物品技能标记');
        const parsedSupport = buildPlayerActionFromDeclaration(supportEntry, 玩家.name, 玩家);
        断言战斗回归夹具(parsedSupport?.target_name === 友方.name, `友方辅助解析目标丢失:${parsedSupport?.target_name || '无'}`);
        断言战斗回归夹具(resolveSkillTargetContext(parsedSupport.skill, 玩家, 友方, combatData, null, parsedSupport).primaryTarget === 友方, '友方辅助解析后目标未落友方');
        断言战斗回归夹具(!判定单挑动作敌对(parsedSupport, 玩家, 敌人, combatData), '友方辅助UI声明被误判敌对');
        日志.push('UI动作声明保留来源、目标、物品契约字段');
      });
      注册('团战多窗口应招不串链', 日志 => {
        const { combatData, 玩家, 友方 } = 构建战斗回归夹具战斗态();
        玩家.name = '甲方攻手';
        友方.name = '乙方攻手';
        玩家.agi = 900;
        友方.agi = 850;
        玩家.final = buildCombatFinalStats(玩家);
        友方.final = buildCombatFinalStats(友方);
        const 甲敌 = 构建战斗回归夹具单位('甲敌', '防御系');
        const 乙敌 = 构建战斗回归夹具单位('乙敌', '防御系');
        甲敌.agi = 80;
        乙敌.agi = 70;
        甲敌.final = buildCombatFinalStats(甲敌);
        乙敌.final = buildCombatFinalStats(乙敌);
        combatData.战斗类型 = '团战';
        combatData.参战者.team_player = [玩家, 友方];
        combatData.参战者.team_enemy = [甲敌, 乙敌];
        setActorFocusTarget(玩家, 甲敌, 'shared_vision_focus', 2);
        setActorFocusTarget(友方, 乙敌, 'shared_vision_focus', 2);
        玩家.第1武魂.第1魂环.第1魂技 = 战斗回归输出魂技('甲方压制', '敌方单体', 8, 80, '近身攻击');
        友方.第1武魂 = {
          表象名称: '乙方武魂',
          第1魂环: {
            第1魂技: 战斗回归输出魂技('乙方刺击', '敌方单体', 8, 80, '近身攻击'),
          },
        };
        const 原随机 = Math.random;
        const 回合日志 = [];
        let 甲结果 = null;
        let 乙结果 = null;
        try {
          Math.random = () => 0.98;
          甲结果 = runActorTurn({ char: 玩家, side: 'player' }, { combatData, round: 1, logs: 回合日志 });
          乙结果 = runActorTurn({ char: 友方, side: 'player' }, { combatData, round: 1, logs: 回合日志 });
        } finally {
          Math.random = 原随机;
        }
        断言战斗回归夹具(甲结果?.target === '甲敌', `甲方目标串线:${甲结果?.target || '无'};${甲结果?.log || ''}`);
        断言战斗回归夹具(乙结果?.target === '乙敌', `乙方目标串线:${乙结果?.target || '无'};${乙结果?.log || ''}`);
        断言战斗回归夹具(!/乙敌/.test(String(甲结果?.log || '')), `甲方日志串入乙敌:${甲结果?.log || ''}`);
        断言战斗回归夹具(!/甲敌/.test(String(乙结果?.log || '')), `乙方日志串入甲敌:${乙结果?.log || ''}`);
        断言战斗回归夹具(!/抓住乙方攻手出手后的空门/.test(String(甲结果?.log || '')), `甲方防反串乙方:${甲结果?.log || ''}`);
        断言战斗回归夹具(!/抓住甲方攻手出手后的空门/.test(String(乙结果?.log || '')), `乙方防反串甲方:${乙结果?.log || ''}`);
        const report = buildReadableBattleReportLines(['[团战第1回合开始]', 甲结果.log, 乙结果.log], 8).join('\n');
        const 甲行 = report.split('\n').find(line => /甲方攻手/.test(line)) || '';
        const 乙行 = report.split('\n').find(line => /乙方攻手/.test(line)) || '';
        断言战斗回归夹具(/甲敌/.test(甲行) && !/乙敌/.test(甲行), `公开战报甲链串线:${report}`);
        断言战斗回归夹具(/乙敌/.test(乙行) && !/甲敌/.test(乙行), `公开战报乙链串线:${report}`);
        日志.push(`团战多窗口应招隔离成立:${report}`);
      });
      注册('预演结果导出与UI可见文本一致', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        const entry = {
          actor_name: 玩家.name,
          action_type: '释放魂技',
          skill: { 魂技名: 战斗回归第一魂技默认名, name: 战斗回归第一魂技默认名, 消耗: '魂力:120' },
          __魂环路径: ['第1武魂', '第1魂环'],
          __魂技槽位: '第1魂技',
          target_name: 敌人.name,
        };
        let result = null;
        使用战斗回归桥接(combatData, { [玩家.name]: 玩家, [敌人.name]: 敌人 }, () => {
          result = onPlayerAttack(战斗回归第一魂技默认名, {
            dryRun: true,
            mode: 'single_round',
            combatData,
            actionDeclaration: 构建战斗回归动作声明(entry),
            intentMode: '点到为止',
          });
        });
        const text = 导出战斗记录可见文本(result, 'preview');
        断言战斗回归夹具(/^预演结果/m.test(text), `导出缺预演结果头:${text}`);
        断言战斗回归夹具(/推进1回合/.test(text), `导出缺推进回合文本:${text}`);
        断言战斗回归夹具(/判定流程/.test(text), `导出缺判定流程标题:${text}`);
        断言战斗回归夹具(!/原始日志|判定 Trace JSON|用途：|说明：|随机种子：|【场景】/.test(text), `导出混入非UI文本:${text}`);
        日志.push(`预演结果导出保持UI口径:${text.split('\n').slice(0, 8).join(' | ')}`);
      });
      注册('公开战报不再自指普攻', 日志 => {
        const { combatData } = 构建战斗回归夹具战斗态();
        const text = buildReadableBattleReportLines([
          '[团战第1回合开始]',
          '[主动压迫] 夹具敌人判断对手没有主动进攻，改以[普通攻击]前压争夺节奏。 [起招] 夹具敌人以[普通攻击]起招。 [先手压制] 夹具玩家刚完成【星辉护壁】，来不及追加防守。 [命中结算] 夹具敌人对夹具玩家造成 57 点最终伤害。 [护盾吸收] 夹具玩家的[星辉护壁护盾]吸收了 57 点伤害。'
        ], 8, { combatData }).join('\n');
        断言战斗回归夹具(/夹具敌人施展【普通攻击】指向夹具玩家/.test(text), `普攻目标未指向玩家:${text}`);
        断言战斗回归夹具(!/夹具敌人施展【普通攻击】指向夹具敌人/.test(text), `公开战报仍自指普攻:${text}`);
        日志.push(`公开战报普攻目标正确:${text}`);
      });
      注册('缺事件账本不再回退旧战报解析', 日志 => {
        const text = buildPublicBattleReportBlock({
          battleLog: ['[第1回合] [起招] 夹具玩家以[裂地冲拳]起招。 [命中结算] 夹具玩家对夹具敌人造成 120 点最终伤害。'],
          combatData: { 战斗意图: '点到为止', 裁断结果: '未分胜负' },
          battleOutcome: { type: 'single_round_probe', label: '单回合试探' },
          modeLabel: '单回合',
          roundCount: 1,
          eventLedger: [],
        });
        断言战斗回归夹具(!/本回合未形成可展示结果/.test(text), `缺事件账本时仍向玩家补假结果:${text}`);
        断言战斗回归夹具(!/裂地冲拳/.test(text), `缺事件账本时仍泄漏旧battleLog文本:${text}`);
        日志.push(`缺事件账本时公开战报不再回退旧文本:${text}`);
      });
      注册('缺事件账本时战报面板不回退publicReport字符串', 日志 => {
        const rows = 提取战斗结果战报行({
          logs: ['[第1回合] [起招] 夹具玩家以[裂地冲拳]起招。 [命中结算] 夹具玩家对夹具敌人造成 120 点最终伤害。'],
          combatData: {
            战斗意图: '点到为止',
            裁断结果: '未分胜负',
            参战者: {
              team_player: [{ name: '夹具玩家' }],
              team_enemy: [{ name: '夹具敌人' }],
            },
          },
          publicReport: '<战斗公开战报>\n第1回合：夹具玩家施展【裂地冲拳】指向夹具敌人，造成了 120 点伤害。\n</战斗公开战报>',
          eventLedger: [],
        });
        断言战斗回归夹具(Array.isArray(rows) && rows.length === 0, `缺事件账本时仍从publicReport字符串回退:${JSON.stringify(rows)}`);
        日志.push('缺事件账本时战报面板不再从publicReport字符串反解析');
      });
      注册('状态结算可追溯附着来源', 日志 => {
        const { combatData } = 构建战斗回归夹具战斗态();
        const text = buildReadableBattleReportLines([
          '[团战第1回合开始]',
          '[第1回合] [起招] 夹具玩家以[毒牙牵制]起招。 [命中结算] 夹具玩家对夹具敌人造成 187 点最终伤害。 [状态施加] 夹具敌人进入[中毒]。',
          '[团战第2回合开始]',
          '[第2回合] [状态结算] 夹具敌人受[中毒]影响，额外损失 18 点HP。'
        ], 8, { combatData }).join('\n');
        断言战斗回归夹具(/并使夹具敌人陷入【中毒】/.test(text), `状态附着未并回原动作:${text}`);
        断言战斗回归夹具(/该状态由第1回合夹具玩家施展【毒牙牵制】附加/.test(text), `状态结算仍无法追溯来源:${text}`);
        日志.push(`状态结算来源可追溯:${text}`);
      });
      注册('玩家动作无论受阻或落地都闭合为可见终态', 日志 => {
        const { result } = 生成战斗判定样本结果(9);
        const ledger = Array.isArray(result?.eventLedger) ? result.eventLedger : [];
        const 玩家闭合事件 = ledger.find(item =>
          isSameBattleReportName(item?.actorName || '', '夹具玩家') &&
          normalizeBattleActionDisplayName(item?.actionName || item?.sourceActionName || '') === '第二魂技·青影蛇群' &&
          ['hit_result', 'state_apply', 'blocked_action', 'failed_action', 'target_fail'].includes(String(item?.eventKind || '').trim())
        );
        const text = 导出战斗记录可见文本(result, 'preview');
        断言战斗回归夹具(!!玩家闭合事件, `玩家动作未形成结构化终态:${JSON.stringify(ledger)}`);
        断言战斗回归夹具(
          /夹具玩家(?:的)?【第二魂技·青影蛇群】(?:尚未铺开，便被这轮交锋截断|被对手压住节奏，未能完成出手|本回合对抗结束，未能形成有效出手|被对手抢先压制|被对手先手压制)|夹具玩家刚欲催动【第二魂技·青影蛇群】|夹具玩家(?:施展|以)【第二魂技·青影蛇群】|并使夹具敌人陷入【迟缓】/.test(text),
          `玩家动作闭合结果未进入可见战报:${text}`,
        );
        日志.push(`玩家动作已闭合并投影:${玩家闭合事件?.eventKind || 'unknown'} ${玩家闭合事件?.failReason || ''} | ${text.split('\n').slice(0, 8).join(' | ')}`);
      });
      注册('反击后状态施加不串到防反链', 日志 => {
        const { combatData } = 构建战斗回归夹具战斗态();
        const text = buildReadableBattleReportLines([
          '[团战第1回合开始]',
          '[第1回合] [起招] 夹具敌人以[毒牙牵制]起招。 [应招] 夹具玩家以[承伤硬抗]应对。 [命中结算] 夹具敌人对夹具玩家造成 64 点最终伤害。 [行为防反] 夹具玩家凭借力守势抓住夹具敌人出手后的空门反击，造成了 12 点伤害。 [状态施加] 夹具玩家进入[中毒]。'
        ], 8, { combatData }).join('\n');
        断言战斗回归夹具(/夹具敌人施展【毒牙牵制】指向夹具玩家/.test(text), `主动作未建立:${text}`);
        断言战斗回归夹具(/并使夹具玩家陷入【中毒】/.test(text), `状态未并回受击者:${text}`);
        断言战斗回归夹具(!/随后夹具玩家凭【借力守势】[^。]+并使夹具玩家陷入【中毒】/.test(text), `状态串到防反链:${text}`);
        日志.push(`反击后状态归属正确:${text}`);
      });
      注册('公开战报保留DOT来源括号', 日志 => {
        const { combatData } = 构建战斗回归夹具战斗态();
        const text = buildReadableBattleReportLines([
          '[团战第2回合开始]',
          '[第2回合] [状态结算] 夹具玩家受[中毒]影响，额外损失 18 点HP（该状态由第1回合夹具敌人施展【毒牙牵制】附加）'
        ], 8, { combatData }).join('\n');
        断言战斗回归夹具(/该状态由第1回合夹具敌人施展【毒牙牵制】附加/.test(text), `公开战报丢失DOT来源:${text}`);
        日志.push(`DOT来源括号已保留:${text}`);
      });
      注册('自身增益动作队列不误取消', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.第1武魂.第1魂环.第1魂技 = normalizeSkillData({
          name: '星辉护壁', 魂技名: '星辉护壁', 技能分类: '辅助', 目标: '自身', 消耗: '魂力:80', 前摇: 8,
          _效果数组: [{ 原型: '护盾变化', 目标: '自身', 护盾模式: '正向护盾', 数值: '+120' }],
        }, '星辉护壁');
        const entry = {
          actor_name: 玩家.name,
          action_type: '释放魂技',
          skill: { 魂技名: '错误缓存第一魂技', name: '错误缓存第一魂技', 消耗: '魂力:9999' },
          __魂环路径: ['第1武魂', '第1魂环'],
          __魂技槽位: '第1魂技',
        };
        let result = null;
        使用战斗回归桥接(combatData, { [玩家.name]: 玩家, [敌人.name]: 敌人 }, () => {
          result = onPlayerAttack('星辉护壁', {
            dryRun: true,
            mode: 'single_round',
            combatData,
            actionDeclaration: 构建战斗回归动作声明(entry),
            intentMode: '点到为止',
          });
        });
        const text = `${result?.publicReport || ''}\n${(result?.logs || []).join(' ')}`;
        断言战斗回归夹具(!/动作取消/.test(text), `自身增益动作队列仍被误取消:${text}`);
        日志.push(`自身增益动作队列未误取消:${text.split('\n')[0] || text}`);
      });
      注册('自保候选不串旧敌方目标', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.第1武魂.第1魂环.第1魂技 = normalizeSkillData({
          name: '星辉护壁', 魂技名: '星辉护壁', 技能分类: '辅助', 目标: '自身', 消耗: '魂力:80', 前摇: 8,
          _效果数组: [{ 原型: '护盾变化', 目标: '自身', 护盾模式: '正向护盾', 数值: '+120' }],
        }, '星辉护壁');
        const entry = {
          actor_name: 玩家.name,
          action_type: '释放魂技',
          skill: { 魂技名: '错误缓存第一魂技', name: '错误缓存第一魂技', 消耗: '魂力:9999' },
          __魂环路径: ['第1武魂', '第1魂环'],
          __魂技槽位: '第1魂技',
        };
        let result = null;
        使用战斗回归桥接(combatData, { [玩家.name]: 玩家, [敌人.name]: 敌人 }, () => {
          result = onPlayerAttack('星辉护壁', {
            dryRun: true,
            mode: 'single_round',
            combatData,
            actionDeclaration: 构建战斗回归动作声明(entry),
            intentMode: '点到为止',
          });
        });
        const 主动规划 = (result?.decisionTrace || []).find(trace =>
          (trace?.type === '主动规划' || trace?.类型 === '主动规划') &&
          (trace?.actor === 敌人.name || trace?.行动者 === 敌人.name) &&
          Array.isArray(trace?.候选排序结果) &&
          trace.候选排序结果.some(候选 =>
            /伺机闪避|肉体兜底|危机自保|承伤硬抗|防御|借力守势|坚壁反制|收招转防/.test(String(候选?.名称 || ''))
          )
        );
        const 自保候选 = (主动规划?.候选排序结果 || []).filter(候选 =>
          /伺机闪避|肉体兜底|危机自保|承伤硬抗|防御|借力守势|坚壁反制|收招转防/.test(String(候选?.名称 || ''))
        );
        断言战斗回归夹具(!!主动规划, `未找到敌方主动规划审计:${JSON.stringify(result?.decisionTrace || [])}`);
        断言战斗回归夹具(自保候选.length > 0, `未找到自保候选:${JSON.stringify(主动规划?.候选排序结果 || [])}`);
        断言战斗回归夹具(
          自保候选.every(候选 => String(候选?.目标 || '') === 敌人.name),
          `自保候选仍串旧目标:${JSON.stringify(自保候选)}`,
        );
        日志.push(`自保候选目标已归自身:${自保候选.map(候选 => `${候选.名称}->${候选.目标}`).join('；')}`);
      });
      注册('非攻击动作不触发防反链', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        const 自身护盾 = {
          action_type: '释放魂技',
          type: '释放魂技',
          skill: normalizeSkillData({
            name: '星辉护壁', 魂技名: '星辉护壁', 技能分类: '辅助', 目标: '自身', 消耗: '魂力:80', 前摇: 8,
            _效果数组: [{ 原型: '护盾变化', 目标: '自身', 护盾模式: '正向护盾', 数值: '+120' }],
          }, '星辉护壁'),
          target_name: 玩家.name,
        };
        断言战斗回归夹具(!单挑动作可触发攻击反应链(自身护盾, 玩家, 玩家, combatData), '自身增益动作仍被识别为可触发反应链攻击');
        const 防反日志 = 执行行为防反结算(玩家, 敌人, 自身护盾, { type: '承伤硬抗', log: '', skill: null, def_mult: 1 }, {
          __行为防反候选: { 防反类型: '硬抗换伤', 防反方: 敌人, 攻击方: 玩家, 触发概率: 0.5, 出手承诺: 0.2, 战斗数据: combatData },
        }, { primaryAppliedDamage: 18 }, combatData);
        断言战斗回归夹具(!防反日志, `非攻击动作仍触发防反:${防反日志}`);
        const 被动承压防反日志 = 执行行为防反结算(玩家, 敌人, {
          action_type: '常规攻击',
          type: '常规攻击',
          skill: normalizeSkillData({
            name: '裂地冲拳', 技能分类: '输出', 目标: '敌方单体', 消耗: '无', 前摇: 8,
            _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 80, 伤害类型: '近身攻击', 防御穿透: 0 }],
          }, '裂地冲拳'),
        }, { type: '无法反应', action_type: '无法反应', log: '', skill: null, def_mult: 1 }, {
          __行为防反候选: {
            防反类型: '硬抗换伤',
            防反方: 敌人,
            攻击方: 玩家,
            触发概率: 1,
            出手承诺: 0.25,
            战斗数据: combatData,
            需要主动防御成立: true,
            被动承压: true,
          },
        }, { primaryAppliedDamage: 26 }, combatData);
        断言战斗回归夹具(!被动承压防反日志, `被动承压仍错误触发硬抗反击:${被动承压防反日志}`);
        const 原随机 = Math.random;
        Math.random = () => 0;
        const 主动承压动作 = {
          action_type: '释放魂技',
          type: '释放魂技',
          skill: normalizeSkillData({
            name: '裂地冲拳', 技能分类: '输出', 目标: '敌方单体', 消耗: '无', 前摇: 8,
            _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 80, 伤害类型: '近身攻击', 防御穿透: 0 }],
          }, '裂地冲拳'),
        };
        const 主动承压反应 = { type: '承伤硬抗', action_type: '承伤硬抗', log: '', skill: null, def_mult: 1 };
        const 主动承压候选 = {
          防反类型: '硬抗换伤',
          防反方: 敌人,
          攻击方: 玩家,
          触发概率: 1,
          出手承诺: 0.25,
          反应余量: 1.2,
          战斗数据: combatData,
          需要主动防御成立: true,
          被动承压: false,
        };
        const 主动承压门禁 = 单挑动作可触发攻击反应链(主动承压动作, 玩家, 敌人, combatData);
        const 主动承压概率 = 计算行为防反概率({
          ...主动承压候选,
          原动作: 主动承压动作,
          反应动作: 主动承压反应,
          战斗数据: combatData,
          实际伤害: 26,
        });
        let 主动承压防反日志 = '';
        try {
          主动承压防反日志 = 执行行为防反结算(玩家, 敌人, 主动承压动作, 主动承压反应, {
            __行为防反候选: 主动承压候选,
          }, { primaryAppliedDamage: 26 }, combatData);
        } finally {
          Math.random = 原随机;
        }
        断言战斗回归夹具(/\[行为防反\]/.test(主动承压防反日志), `主动承伤硬抗未触发防反:${主动承压防反日志};门禁:${主动承压门禁};概率:${主动承压概率}`);
        日志.push('非攻击动作未触发防反链，主动承压与被动承压的防反资格已区分');
      });
      注册('防反来源优先使用真实动作', 日志 => {
        const { combatData, 敌人 } = 构建战斗回归夹具战斗态();
        敌人.第1武魂 = {
          表象名称: '敌方武魂',
          第1魂环: {
            第1魂技: 战斗回归输出魂技(战斗回归敌方快攻技能名, '敌方单体', 6, 90, '近身攻击'),
          },
        };
        const 来源 = 选择行为防反动作来源(敌人, combatData, '硬抗换伤');
        断言战斗回归夹具(来源?.sourceActionName === 战斗回归敌方快攻技能名, `防反来源未优先取真实动作:${JSON.stringify(来源)}`);
        const 防反动作 = 建立行为防反动作(敌人, { ...来源, 防反类型: '硬抗换伤', 触发概率: 0.4, 出手承诺: 0.2, 战斗数据: combatData });
        断言战斗回归夹具((防反动作?.sourceActionName || '') === 战斗回归敌方快攻技能名, `防反动作未透传真实来源:${JSON.stringify(防反动作)}`);
        日志.push(`防反来源已切到真实动作:${来源?.sourceActionName || '无'}`);
      });
      注册('单挑防反队列挂接已完成父动作', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        const 主动动作 = {
          action_type: '释放魂技',
          type: '释放魂技',
          skill: normalizeSkillData(战斗回归输出魂技('队列主动攻击', '敌方单体', 6, 80, '近身攻击'), '队列主动攻击'),
          target_name: 敌人.name,
        };
        const 防反动作 = {
          action_type: '释放魂技',
          type: '释放魂技',
          skill: normalizeSkillData(战斗回归输出魂技('队列防反攻击', '敌方单体', 5, 70, '近身攻击'), '队列防反攻击'),
          target_name: 玩家.name,
        };
        const 防御动作 = { type: '防御', action_type: '防御', log: '', skill: null, def_mult: 0.85 };
        执行单挑队列结算(主动动作, 防御动作, combatData);
        const 运行态 = 确保战斗运行态(combatData);
        const 主动节点 = [...(运行态.actionQueueTrace || [])].reverse().find(item =>
          String(item?.state || '').trim() === 'COMPLETED' &&
          String(item?.actionRole || '').trim() === 'ACTIVE'
        );
        断言战斗回归夹具(Number(主动节点?.actionSequence || 0) > 0, `单挑主动结算没有形成已完成队列节点:${JSON.stringify(运行态.actionQueueTrace || [])}`);
        const 防反战斗数据 = {
          战斗类型: combatData.战斗类型,
          回合: combatData.回合,
          先攻: 敌人.name,
          __父级战斗数据: combatData,
          参战者: { team_player: [敌人], team_enemy: [玩家] },
        };
        执行单挑队列结算(防反动作, 防御动作, 防反战斗数据, {
          actionRole: 'COUNTER',
          phasePriority: 50,
          parentActionSequence: Number(主动节点.actionSequence),
          sourceActionId: 'fixture-active-action',
          side: 'enemy',
          traceCombatData: combatData,
        });
        const 已完成节点 = (运行态.actionQueueTrace || []).filter(item => String(item?.state || '').trim() === 'COMPLETED');
        const 防反节点 = [...已完成节点].reverse().find(item => String(item?.actionRole || '').trim() === 'COUNTER');
        const 主动索引 = 已完成节点.indexOf(主动节点);
        const 防反索引 = 已完成节点.indexOf(防反节点);
        断言战斗回归夹具(Number(防反节点?.parentActionSequence || 0) === Number(主动节点.actionSequence), `单挑防反未挂接主动父节点:${JSON.stringify(已完成节点)}`);
        断言战斗回归夹具(Number(防反节点?.round || 0) === Number(主动节点.round || 0), `单挑防反与父动作轮次不一致:${JSON.stringify(已完成节点)}`);
        断言战斗回归夹具(主动索引 >= 0 && 防反索引 > 主动索引, `单挑防反早于父动作完成:${JSON.stringify(已完成节点)}`);
        断言战斗回归夹具(String(防反节点?.nodeKind || '').trim() === 'COUNTER', `单挑防反被提升为其他动作职责:${JSON.stringify(防反节点)}`);
        日志.push(`单挑防反队列已挂接父动作:${主动节点.actionSequence}->${防反节点.actionSequence}`);
      });
      注册('控制第一魂技防反伤害不污染来源', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        敌人.第1武魂 = {
          表象名称: '敌方武魂',
          第1魂环: {
            第1魂技: 战斗回归输出魂技(战斗回归敌方快攻技能名, '敌方单体', 6, 90, '近身攻击'),
          },
        };
        const 第一魂技动作 = {
          action_type: '释放魂技',
          type: '释放魂技',
          skill: normalizeSkillData(构建战斗回归第一魂技(战斗回归第一魂技默认名, '魂力:120'), 战斗回归第一魂技默认名),
          target_name: 敌人.name,
        };
        const 原随机 = Math.random;
        Math.random = () => 0;
        try {
          const 日志文本 = 执行行为防反结算(玩家, 敌人, 第一魂技动作, {
            type: '伺机闪避',
            action_type: '伺机闪避',
            log: '',
            skill: null,
            def_mult: 1,
          }, {
            __行为防反候选: {
              防反类型: '完美闪避',
              防反方: 敌人,
              攻击方: 玩家,
              原动作: 第一魂技动作,
              触发概率: 1,
              出手承诺: 0.35,
              战斗数据: combatData,
              sourceActionName: 战斗回归敌方快攻技能名,
              sourceActionType: 'skill_counter',
            },
          }, { primaryAppliedDamage: 0 }, combatData);
          const 账本 = Array.isArray(combatData.__battleEventLedger) ? combatData.__battleEventLedger : [];
          const 第一魂技伤害事件 = 账本.filter(event =>
            String(event?.eventKind || '').trim() === 'hit_result' &&
            normalizeBattleActionDisplayName(event?.actionName || event?.sourceActionName || '') === 战斗回归第一魂技默认名 &&
            Math.max(0, Number(event?.appliedDamage ?? event?.damage ?? event?.meta?.appliedDamage ?? event?.meta?.damage ?? 0)) > 0
          );
          const 防反事件 = [...账本].reverse().find(event =>
            String(event?.eventKind || '').trim() === 'counter' &&
            String(event?.result || '').trim() === 'success' &&
            normalizeBattleActionDisplayName(event?.actionName || '') === 战斗回归敌方快攻技能名
          );
          断言战斗回归夹具(!日志文本, `纯控制第一魂技不应触发伤害型防反:${日志文本}`);
          断言战斗回归夹具(!第一魂技伤害事件.length, `控制第一魂技被污染成伤害来源:${JSON.stringify(第一魂技伤害事件)}`);
          断言战斗回归夹具(!防反事件, `纯控制第一魂技仍生成伤害型防反事件:${JSON.stringify(防反事件)}`);
          日志.push('控制第一魂技不会生成伤害型防反，伤害来源未被污染');
        } finally {
          Math.random = 原随机;
        }
      });
      注册('状态反伤必须写入防反账本', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        敌人.状态效果 = {
          荆棘反震: {
            类型: 'buff',
            duration: 2,
            战斗效果: {
              ...createEmptyCombatEffectMap(),
              counter_attack_ratio: 0.5,
            },
          },
        };
        const 攻击动作 = {
          action_type: '释放魂技',
          type: '释放魂技',
          skill: normalizeSkillData(战斗回归输出魂技('裂地冲拳', '敌方单体', 8, 100, '近身攻击'), '裂地冲拳'),
          target_name: 敌人.name,
        };
        BATTLE_RUNTIME.writeLedgerEvent(combatData, {
          eventKind: 'action_start',
          round: Number(combatData?.回合 || 0),
          actorName: 玩家.name,
          targetName: 敌人.name,
          actionName: '裂地冲拳',
          actionType: '释放魂技',
          result: 'started',
        });
        const 结算结果 = {
          result: 'hit',
          desc: '',
          dmg: 100,
          targetResults: [{ target: 敌人, targetName: 敌人.name, damage: 100, kind: 'primary' }],
        };
        const 攻击前血量 = getCombatHpValue(玩家);
        const 伤害包 = applyResolvedDamagePackage(玩家, 攻击动作, 结算结果, {
          primaryTarget: 敌人,
          combatData,
        });
        const 账本 = Array.isArray(combatData.__battleEventLedger) ? combatData.__battleEventLedger : [];
        const 状态反伤事件 = 账本.find(event =>
          String(event?.eventKind || '').trim() === 'counter' &&
          String(event?.result || '').trim() === 'success' &&
          normalizeBattleActionDisplayName(event?.actionName || '') === '荆棘反震' &&
          normalizeBattleActionDisplayName(event?.sourceActionName || '') === '裂地冲拳'
        );
        const 状态反伤窗口 = 账本.find(event =>
          String(event?.eventKind || '').trim() === 'counter_window' &&
          normalizeBattleActionDisplayName(event?.actionName || '') === '荆棘反震' &&
          normalizeBattleActionDisplayName(event?.sourceActionName || '') === '裂地冲拳'
        );
        const 轨迹 = Array.isArray(状态反伤事件?.meta?.settlementTrace) ? 状态反伤事件.meta.settlementTrace : [];
        const 读取轨迹值 = key => 轨迹.find(item => String(item?.key || '').trim() === key)?.value;
        断言战斗回归夹具(Number(伤害包.primaryAppliedDamage || 0) > 0, `主伤害未正常落地:${JSON.stringify(伤害包)}`);
        断言战斗回归夹具(getCombatHpValue(玩家) === 攻击前血量 - 50, `状态反伤扣血异常:${攻击前血量}->${getCombatHpValue(玩家)}`);
        断言战斗回归夹具(!!状态反伤窗口, `状态反伤缺防反窗口:${JSON.stringify(账本)}`);
        断言战斗回归夹具(!!状态反伤事件, `状态反伤缺防反账本:${JSON.stringify(账本)}`);
        断言战斗回归夹具(读取轨迹值('sourceAction') === '荆棘反震', `状态反伤来源动作串线:${JSON.stringify(轨迹)}`);
        断言战斗回归夹具(读取轨迹值('counteredAction') === '裂地冲拳', `状态反伤被反制动作缺失:${JSON.stringify(轨迹)}`);
        日志.push('状态反伤已写入 counter_window/counter 账本，反伤来源与被反制动作分离');
      });
      注册('防反失败真实原因优先于概率文案', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        const 原随机 = Math.random;
        Math.random = () => 0.99;
        try {
          const 失败日志 = 执行行为防反结算(玩家, 敌人, {
            action_type: '常规攻击',
            type: '常规攻击',
            skill: normalizeSkillData(战斗回归输出魂技('裂地冲拳', '敌方单体', 8, 80, '近身攻击'), '裂地冲拳'),
          }, { type: '伺机闪避', action_type: '伺机闪避', log: '', skill: null, def_mult: 1 }, {
            __行为防反候选: {
              防反类型: '完美闪避',
              防反方: 敌人,
              攻击方: 玩家,
              触发概率: 0.4,
              出手承诺: 0.2,
              战斗数据: combatData,
              sourceActionName: '短刀',
              failReason: '距离不够',
            },
          }, { primaryAppliedDamage: 16 }, combatData);
          const 账本 = Array.isArray(combatData.__battleEventLedger) ? combatData.__battleEventLedger : [];
          const 失败事件 = [...账本].reverse().find(item => item?.eventKind === 'counter' && item?.result === 'fail');
          断言战斗回归夹具(/尝试以\[短刀\]反打，但距离不够/.test(失败日志), `防反失败真实原因未优先展示:${失败日志}`);
          断言战斗回归夹具(!/概率:/.test(失败日志), `存在真实失败原因时仍拼接概率:${失败日志}`);
          断言战斗回归夹具(String(失败事件?.failReason || '') === '距离不够', `失败账本未保留真实原因:${JSON.stringify(失败事件)}`);
          日志.push(`防反失败优先原因:${失败日志}`);
        } finally {
          Math.random = 原随机;
        }
      });
      注册('防反失败自动提取来不及反应原因', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        const 原随机 = Math.random;
        Math.random = () => 0.99;
        try {
          const 失败日志 = 执行行为防反结算(玩家, 敌人, {
            action_type: '常规攻击',
            type: '常规攻击',
            skill: normalizeSkillData(战斗回归输出魂技('裂地冲拳', '敌方单体', 8, 80, '近身攻击'), '裂地冲拳'),
          }, { type: '无法反应', action_type: '无法反应', log: '[先手压制] 夹具敌人刚完成【前序动作】，来不及追加防守。', skill: null, def_mult: 1 }, {
            __行为防反候选: {
              防反类型: '完美闪避',
              防反方: 敌人,
              攻击方: 玩家,
              触发概率: 0.4,
              出手承诺: 0.2,
              战斗数据: combatData,
              sourceActionName: '短刀',
            },
          }, { primaryAppliedDamage: 16 }, combatData);
          断言战斗回归夹具(/来不及反应|来不及追加防守/.test(失败日志), `防反失败未自动提取来不及反应:${失败日志}`);
          断言战斗回归夹具(!/概率:/.test(失败日志), `来不及反应仍被概率文案覆盖:${失败日志}`);
          日志.push(`防反失败自动提取来不及反应:${失败日志}`);
        } finally {
          Math.random = 原随机;
        }
      });
      注册('防反失败自动提取资源不足原因', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        const 原随机 = Math.random;
        Math.random = () => 0.99;
        try {
          const 失败日志 = 执行行为防反结算(玩家, 敌人, {
            action_type: '常规攻击',
            type: '常规攻击',
            skill: normalizeSkillData(战斗回归输出魂技('裂地冲拳', '敌方单体', 8, 80, '近身攻击'), '裂地冲拳'),
          }, { type: '伺机闪避', action_type: '伺机闪避', log: '[状态枯竭] 自身状态不足，无法支撑反打。', skill: null, def_mult: 1 }, {
            __行为防反候选: {
              防反类型: '完美闪避',
              防反方: 敌人,
              攻击方: 玩家,
              触发概率: 0.4,
              出手承诺: 0.2,
              战斗数据: combatData,
              sourceActionName: '短刀',
            },
          }, { primaryAppliedDamage: 16 }, combatData);
          断言战斗回归夹具(/资源不足/.test(失败日志), `防反失败未自动提取资源不足:${失败日志}`);
          断言战斗回归夹具(!/概率:/.test(失败日志), `资源不足仍被概率文案覆盖:${失败日志}`);
          日志.push(`防反失败自动提取资源不足:${失败日志}`);
        } finally {
          Math.random = 原随机;
        }
      });
      注册('防反失败自动提取动作被拒原因', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        const 原随机 = Math.random;
        Math.random = () => 0.99;
        try {
          const 失败日志 = 执行行为防反结算(玩家, 敌人, {
            action_type: '常规攻击',
            type: '常规攻击',
            skill: normalizeSkillData(战斗回归输出魂技('裂地冲拳', '敌方单体', 8, 80, '近身攻击'), '裂地冲拳'),
          }, { type: '伺机闪避', action_type: '伺机闪避', log: '[门禁拒绝] 本次反打动作被拒绝执行。', skill: null, def_mult: 1 }, {
            __行为防反候选: {
              防反类型: '完美闪避',
              防反方: 敌人,
              攻击方: 玩家,
              触发概率: 0.4,
              出手承诺: 0.2,
              战斗数据: combatData,
              sourceActionName: '短刀',
            },
          }, { primaryAppliedDamage: 16 }, combatData);
          断言战斗回归夹具(/动作被拒/.test(失败日志), `防反失败未自动提取动作被拒:${失败日志}`);
          断言战斗回归夹具(!/概率:/.test(失败日志), `动作被拒仍被概率文案覆盖:${失败日志}`);
          日志.push(`防反失败自动提取动作被拒:${失败日志}`);
        } finally {
          Math.random = 原随机;
        }
      });
      注册('防反失败自动提取被打断原因', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        const 原随机 = Math.random;
        Math.random = () => 0.99;
        try {
          const 失败日志 = 执行行为防反结算(玩家, 敌人, {
            action_type: '常规攻击',
            type: '常规攻击',
            skill: normalizeSkillData(战斗回归输出魂技('裂地冲拳', '敌方单体', 8, 80, '近身攻击'), '裂地冲拳'),
          }, { type: '伺机闪避', action_type: '伺机闪避', log: '[抢招失败] 反打动作被对手攻势打断，未能成形。', skill: null, def_mult: 1 }, {
            __行为防反候选: {
              防反类型: '完美闪避',
              防反方: 敌人,
              攻击方: 玩家,
              触发概率: 0.4,
              出手承诺: 0.2,
              战斗数据: combatData,
              sourceActionName: '短刀',
            },
          }, { primaryAppliedDamage: 16 }, combatData);
          断言战斗回归夹具(/被打断/.test(失败日志), `防反失败未自动提取被打断:${失败日志}`);
          断言战斗回归夹具(!/概率:/.test(失败日志), `被打断仍被概率文案覆盖:${失败日志}`);
          日志.push(`防反失败自动提取被打断:${失败日志}`);
        } finally {
          Math.random = 原随机;
        }
      });
      注册('系统型防反按窗口归一显示名', 日志 => {
        const { 敌人 } = 构建战斗回归夹具战斗态();
        const 防守反击 = 建立行为防反动作(敌人, { 防反类型: '硬抗换伤', 触发概率: 0.4, 出手承诺: 0.2 });
        const 闪避反击 = 建立行为防反动作(敌人, { 防反类型: '完美闪避', 触发概率: 0.4, 出手承诺: 0.2 });
        const 绝地反扑 = 建立行为防反动作(敌人, { 防反类型: '以命换伤', 触发概率: 0.4, 出手承诺: 0.2, 以命换伤: true });
        断言战斗回归夹具((防守反击?.sourceActionName || '') === '防守反击', `硬抗换伤兜底名异常:${JSON.stringify(防守反击)}`);
        断言战斗回归夹具((闪避反击?.sourceActionName || '') === '闪避反击', `完美闪避兜底名异常:${JSON.stringify(闪避反击)}`);
        断言战斗回归夹具((绝地反扑?.sourceActionName || '') === '绝地反扑', `以命换伤兜底名异常:${JSON.stringify(绝地反扑)}`);
        断言战斗回归夹具(normalizeBattleActionDisplayName('系统反击') === '借势反打', '系统反击显示名未归一为借势反打');
        日志.push(`系统型防反显示名:硬抗=${防守反击?.sourceActionName};闪避=${闪避反击?.sourceActionName};搏命=${绝地反扑?.sourceActionName}`);
      });
      注册('防反零伤害改写为未造成实质伤害', 日志 => {
        const combatData = 构建战斗回归夹具战斗态().combatData;
        const text = buildReadableBattleReportLines([
          '[第1回合] [团战执行] 夹具玩家以[裂地冲拳]指向[夹具敌人]。 [起招] 夹具玩家以[裂地冲拳]起招。 [应招] 夹具敌人以[承伤硬抗]应对。 [命中结算] 夹具玩家对夹具敌人造成 115 点最终伤害。 [行为防反] 夹具敌人凭防守反击抓住夹具玩家出手后的空门反击，造成了 0 点伤害。',
        ], 8, { combatData }).join('\n');
        断言战斗回归夹具(/未能造成实质伤害/.test(text), `防反零伤害未改写:${text}`);
        断言战斗回归夹具(!/造成了 0 点伤害/.test(text), `防反零伤害仍以数字直出:${text}`);
        日志.push(`防反零伤害文案成立:${text}`);
      });
      注册('状态来源登记写入运行时账本', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        const action = {
          action_type: '释放魂技', type: '释放魂技',
          skill: normalizeSkillData({
            name: '毒牙牵制', 魂技名: '毒牙牵制', 技能分类: '输出', 目标: '敌方单体', 消耗: '魂力:60', 前摇: 8,
            _效果数组: [
              { 原型: '伤害结算', 目标: '单体', 生效方式: '独立生效', 威力倍率: 80, 伤害类型: '近身攻击' },
              { 原型: '状态施加', 目标: '单体', 生效方式: '跟随主原型', 状态: '中毒', 状态名称: '中毒', 持续回合: 2, 计算层效果: { dot_damage: 20 } },
            ],
          }, '毒牙牵制'),
        };
        使用战斗回归桥接(combatData, { [玩家.name]: 玩家, [敌人.name]: 敌人 }, () => {
          executeClash(action, 构建单挑反应动作({ action_type: '防御', type: '防御' }, 敌人, 玩家), 构建单挑临时战斗数据(玩家, 敌人, 'player', combatData));
        });
        const 登记 = combatData?.__行动闭环诊断?.状态来源登记 || [];
        const 命中 = 登记.find(item => item?.stateName === '中毒' && item?.targetName === 敌人.name);
        断言战斗回归夹具(!!命中, `状态来源登记缺中毒:${JSON.stringify(登记)}`);
        断言战斗回归夹具(命中?.sourceActorName === 玩家.name && 命中?.sourceActionName === '毒牙牵制', `状态来源登记字段异常:${JSON.stringify(命中)}`);
        日志.push(`状态来源登记已写入:${JSON.stringify(命中)}`);
      });
      注册('敌对动作目标不得落友方或自身', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        const actorEntry = { char: 敌人, side: 'enemy' };
        const targets = chooseTargetForActor(actorEntry, { combatData }) || { enemyTarget: 玩家, allyTarget: 敌人 };
        const action = buildAutoActionForActor(actorEntry, targets, { combatData, observedTargetAction: { action_type: '常规攻击', type: '常规攻击', skill: normalizeSkillData(战斗回归输出魂技('夹具攻击', '敌方单体', 8, 70, '近身攻击'), '夹具攻击') } });
        const 目标 = 解析单挑动作目标(action, 敌人, 玩家, combatData);
        if (单挑动作可触发攻击反应链(action, 敌人, 目标, combatData)) {
          断言战斗回归夹具((combatData?.参战者?.team_player || []).some(unit => isCombatUnitIdentityMatch(unit, 目标?.name || 目标)), `敌对动作落到了非玩家侧:${目标?.name || '无'};${action?.decision_log || ''}`);
          断言战斗回归夹具(!(combatData?.参战者?.team_enemy || []).some(unit => isCombatUnitIdentityMatch(unit, 目标?.name || 目标)), `敌对动作落到了友方或自身:${目标?.name || '无'};${action?.decision_log || ''}`);
        }
        const 探针 = combatData?.__行动闭环诊断?.目标权重探针 || [];
        断言战斗回归夹具(探针.some(item => item?.targetPoolSide === 'hostile'), `目标权重探针未写入敌对池:${JSON.stringify(探针)}`);
        日志.push(`敌对动作目标阵营正确:${目标?.name || '无'}`);
      });
      注册('玩家主动入口敌方规划不再转火友方', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        const 友方 = 构建战斗回归夹具单位('夹具友方', '辅助系');
        combatData.参战者.team_player = [玩家, 友方];
        敌人.type = '敏攻系';
        敌人.agi = 420;
        敌人.final = buildCombatFinalStats(敌人);
        敌人.第1武魂 = {
          表象名称: '锁敌武魂',
          第1魂环: {
            第1魂技: normalizeSkillData(战斗回归输出魂技(战斗回归敌方快攻技能名, '敌方单体', 6, 88, '近身攻击'), 战斗回归敌方快攻技能名),
          },
          第2魂环: {
            第1魂技: normalizeSkillData(战斗回归输出魂技(战斗回归敌方压制技能名, '敌方单体', 10, 96, '近身攻击'), 战斗回归敌方压制技能名),
          },
        };
        const actorEntry = { char: 敌人, side: 'enemy' };
        const action = buildAutoActionForActor(actorEntry, { enemyTarget: 玩家, allyTarget: 敌人 }, {
          combatData,
          observedTargetAction: {
            action_type: '释放魂技',
            type: '技能',
            cast_time: 10,
            skill: normalizeSkillData(战斗回归输出魂技('裂地冲拳', '敌方单体', 10, 88, '近身攻击'), '裂地冲拳'),
          },
        });
        const 解析目标 = 解析单挑动作目标(action, 敌人, 玩家, combatData);
        const 目标名 = String(解析目标?.name || 解析目标?.名称 || action?.target_name || '').trim();
        断言战斗回归夹具(isSameBattleReportName(目标名, 玩家.name), `玩家主动入口时敌方规划仍转火友方:${目标名};${action?.decision_log || ''}`);
        日志.push(`玩家主动入口敌方规划保持锁定当前玩家:${目标名}`);
      });
      注册('反敏攻闪避后不继续普攻前压', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.type = '敏攻系';
        玩家.agi = 999;
        玩家.final = buildCombatFinalStats(玩家);
        敌人.type = '强攻系';
        敌人.agi = 80;
        敌人.final = buildCombatFinalStats(敌人);
        敌人.第1武魂 = {
          表象名称: '反制武魂',
          第1魂环: {
            第1魂技: normalizeSkillData({
              name: '缚影压制',
              魂技名: '缚影压制',
              技能分类: '控制',
              目标: '敌方单体',
              消耗: '无',
              前摇: 8,
              _效果数组: [
                { 原型: '状态施加', 目标: '单体', 状态: '位移限制', 状态名称: '位移限制', 持续回合: 1, 计算层效果: { cast_speed_penalty: 0.2 } },
              ],
            }, '缚影压制'),
          },
        };
        recordActorActionWhiffedByDodge(敌人, '普通攻击', 玩家);
        const actorEntry = { char: 敌人, side: 'enemy' };
        const action = buildAutoActionForActor(actorEntry, { enemyTarget: 玩家, allyTarget: 敌人 }, {
          combatData,
          observedTargetAction: { action_type: '伺机闪避', type: '伺机闪避', skill: normalizeSkillData({ name: '伺机闪避', 技能分类: '防御', 目标: '自身', 消耗: '无', 前摇: 4 }, '伺机闪避') },
        });
        const 动作名 = String(action?.skill?.name || action?.skill?.魂技名 || action?.type || action?.action_type || '');
        断言战斗回归夹具(!/普通攻击|常规攻击/.test(动作名), `反敏攻后仍继续普攻:${动作名};${action?.decision_log || ''}`);
        断言战斗回归夹具(/缚影压制|反敏攻|收招转防|稳态调整|防御|稳住防线/.test(`${动作名} ${action?.decision_log || ''}`), `反敏攻后未切换到控制/稳态:${动作名};${action?.decision_log || ''}`);
        日志.push(`反敏攻闪避后动作切换:${动作名}`);
      });
      注册('普通控制命中不自动授予同回合追击', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        combatData.回合 = 1;
        玩家.第1武魂 = {
          表象名称: '普通控制夹具武魂',
          第1魂环: {
            第1魂技: normalizeSkillData({
              name: '缚影控场',
              魂技名: '缚影控场',
              技能分类: '控制',
              目标: '敌方单体',
              消耗: '无',
              前摇: 8,
              _效果数组: [{
                原型: '状态施加',
                目标: '单体',
                状态: '位移限制',
                状态名称: '位移限制',
                持续回合: 2,
                计算层效果: { cast_speed_penalty: 0.35, reaction_penalty: 0.25 },
              }],
            }, '缚影控场'),
            第2魂技: normalizeSkillData(战斗回归输出魂技('锁定追击', '敌方单体', 8, 88, '近身攻击'), '锁定追击'),
          },
        };
        玩家.final = buildCombatFinalStats(玩家);
        敌人.agi = 1;
        敌人.men_max = 1;
        敌人.final = buildCombatFinalStats(敌人);
        const action = {
          action_type: '释放魂技',
          type: '释放魂技',
          skill: 玩家.第1武魂.第1魂环.第1魂技,
          cast_time: 8,
        };
        const result = runActorTurn({
          char: 玩家,
          side: 'player',
          __declaredRound: 1,
          __declaredAction: action,
          __declaredActionName: '缚影控场',
          __declaredTargetName: 敌人.name,
        }, { combatData, round: 1 });
        const ledger = globalThis.__LWCS_BATTLE_RUNTIME__.ensureLedger(combatData);
        const starts = ledger.filter(event =>
          event?.eventKind === 'action_start' && isSameBattleReportName(event?.actorName || '', 玩家.name),
        );
        const controlState = 敌人.状态效果?.位移限制;
        断言战斗回归夹具(!!controlState, `控制动作没有实际附着:${JSON.stringify(ledger)}`);
        断言战斗回归夹具(starts.length === 1 && !starts.some(event => event?.meta?.chainType === 'FOLLOW_UP'), `普通控制错误赠送追击:${JSON.stringify(starts)}`);
        断言战斗回归夹具(!result?.followUp, '普通控制路径返回了免费追击结果');
        日志.push('普通控制命中只建立未来窗口，不自动赠送同回合攻击');
      });
      注册('显式追击授权按剩余行动预算最多执行一次', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        combatData.回合 = 1;
        玩家.第1武魂 = {
          表象名称: '显式追击授权夹具武魂',
          第1魂环: {
            第1魂技: normalizeSkillData({
              name: '缚影连袭',
              魂技名: '缚影连袭',
              技能分类: '控制',
              目标: '敌方单体',
              消耗: '无',
              前摇: 8,
              命中后追击: true,
              _效果数组: [
                {
                  原型: '伤害结算',
                  目标: '单体',
                  威力倍率: 20,
                  伤害类型: '近身攻击',
                },
                {
                  原型: '状态施加',
                  目标: '单体',
                  状态: '位移限制',
                  状态名称: '位移限制',
                  持续回合: 2,
                  计算层效果: { cast_speed_penalty: 0.35, reaction_penalty: 0.25 },
                },
              ],
            }, '缚影连袭'),
            第2魂技: normalizeSkillData(战斗回归输出魂技('锁定追击', '敌方单体', 8, 88, '近身攻击'), '锁定追击'),
          },
        };
        玩家.final = buildCombatFinalStats(玩家);
        敌人.agi = 1;
        敌人.men_max = 1;
        敌人.final = buildCombatFinalStats(敌人);
        const actorEntry = {
          char: 玩家,
          side: 'player',
          __declaredRound: 1,
          __declaredAction: {
            action_type: '释放魂技',
            type: '释放魂技',
            skill: 玩家.第1武魂.第1魂环.第1魂技,
            cast_time: 8,
          },
          __declaredActionName: '缚影连袭',
          __declaredTargetName: 敌人.name,
        };
        const queueLogs = [];
        const queueResult = 执行团战扁平行动队列([actorEntry], combatData, 1, queueLogs, []);
        const starts = globalThis.__LWCS_BATTLE_RUNTIME__.ensureLedger(combatData).filter(event =>
          event?.eventKind === 'action_start' && isSameBattleReportName(event?.actorName || '', 玩家.name),
        );
        const followUps = starts.filter(event => event?.meta?.chainType === 'FOLLOW_UP');
        const queueTrace = 确保战斗运行态(combatData).actionQueueTrace || [];
        断言战斗回归夹具(!queueResult?.fatal, `显式授权追击队列中止:${JSON.stringify(queueResult?.fatal || {})}`);
        断言战斗回归夹具(
          followUps.length === 1,
          `显式授权追击数量异常:${followUps.length};starts=${JSON.stringify(starts)};logs=${JSON.stringify(queueLogs)};trace=${JSON.stringify(queueTrace)}`,
        );
        断言战斗回归夹具(String(followUps[0]?.sourceActionId || '').trim() === String(starts[0]?.actionId || '').trim(), '显式追击未挂到主动作 sourceActionId');
        断言战斗回归夹具(followUps[0]?.actionName === '锁定追击', `显式追击没有选中有效伤害动作:${followUps[0]?.actionName || '无'}`);
        const executed = queueTrace.filter(item => item?.state === 'EXECUTED');
        const activeNodes = executed.filter(item => String(item?.nodeKind || '').trim() === 'ACTIVE');
        const reactionNodes = executed.filter(item => String(item?.nodeKind || '').trim() === 'REACTION');
        断言战斗回归夹具(activeNodes.length === 2 && reactionNodes.length === 2, `显式追击缺少主动或应招队列节点:${JSON.stringify(queueTrace)}`);
        const [firstActive, secondActive] = activeNodes;
        const [firstReaction, secondReaction] = reactionNodes;
        断言战斗回归夹具(
          executed.indexOf(firstActive) < executed.indexOf(firstReaction) &&
          executed.indexOf(firstReaction) < executed.indexOf(secondActive) &&
          executed.indexOf(secondActive) < executed.indexOf(secondReaction) &&
          Number(firstReaction?.parentActionSequence || 0) === Number(firstActive?.actionSequence || 0) &&
          Number(secondActive?.parentActionSequence || 0) === Number(firstActive?.actionSequence || 0) &&
          Number(secondReaction?.parentActionSequence || 0) === Number(secondActive?.actionSequence || 0),
          `显式追击没有按主动→应招→追击→应招的扁平队列顺序执行:${JSON.stringify(queueTrace)}`,
        );
        断言战斗回归夹具(new Set(executed.map(item => item?.grantId)).size === executed.length, `显式追击重复消费授权:${JSON.stringify(executed)}`);
        日志.push(`显式行动授权生成唯一追击:${followUps[0]?.actionName};队列节点:${executed.map(item => `${item.nodeKind}:${item.actionSequence}`).join('->')}`);
      });
      注册('战斗经验缺失时按稳定身份确定性推导', 日志 => {
        const 目标 = 构建战斗回归夹具单位('经验目标', '强攻系');
        const 构建无经验角色 = () => {
          const 角色 = 构建战斗回归夹具单位('稳定经验角色', '控制系');
          delete 角色.战斗经验;
          return 角色;
        };
        const 第一结果 = 计算行为战斗经验(构建无经验角色(), 目标, { 参战者: { team_player: [], team_enemy: [] } });
        const 原随机 = Math.random;
        Math.random = () => 0.999999;
        const 第二结果 = 计算行为战斗经验(构建无经验角色(), 目标, { 参战者: { team_player: [], team_enemy: [] } });
        Math.random = 原随机;
        断言战斗回归夹具(
          Number(第一结果.确定经验分) === Number(第二结果.确定经验分) && Number(第一结果.稳定度) === Number(第二结果.稳定度),
          `同身份经验推导不稳定:${JSON.stringify({ 第一结果, 第二结果 })}`,
        );
        日志.push(`稳定身份经验=${第一结果.确定经验分};稳定度=${Number(第一结果.稳定度).toFixed(3)}`);
      });
      注册('低置信度主观选择不越过最大后悔边界', 日志 => {
        const actor = 构建战斗回归夹具单位('低置信决策者', '强攻系');
        actor.men = 0;
        actor.精神力 = 0;
        actor.vit = 0;
        actor.sta = 0;
        actor.体力 = 0;
        const target = 构建战斗回归夹具单位('后悔边界目标', '防御系');
        const candidates = [
          { name: '最优动作', weight: 100, scoringSummary: { candidateId: 'best', tags: [], rejectionCode: '', resourceCostEV: 0 } },
          { name: '可容忍次优', weight: 80, scoringSummary: { candidateId: 'near', tags: [], rejectionCode: '', resourceCostEV: 0 } },
          { name: '越界动作', weight: 10, scoringSummary: { candidateId: 'far', tags: [], rejectionCode: '', resourceCostEV: 0 } },
        ];
        const result = 选择主观行为候选(actor, target, {
          round: 1,
          战斗经验: { 稳定度: 0 },
          combatData: { 战斗ID: 'regret-boundary', 回合: 1 },
        }, candidates, 'ACTIVE', 0);
        断言战斗回归夹具(result.option?.name !== '越界动作', `主观抽样越过最大后悔边界:${JSON.stringify(result)}`);
        断言战斗回归夹具(Number(result.maxRegret || 0) === 25, `最大后悔值异常:${result.maxRegret}`);
        日志.push(`低置信选择=${result.option?.name};最大后悔=${result.maxRegret}`);
      });
      注册('MAD归一化保持同比缩放选择一致', 日志 => {
        const actor = 构建战斗回归夹具单位('归一化决策者', '控制系');
        actor.men = actor.men_max;
        actor.vit = actor.vit_max;
        const target = 构建战斗回归夹具单位('归一化目标', '强攻系');
        const run = (scale, battleId) => 选择主观行为候选(actor, target, {
          round: 2,
          战斗经验: { 稳定度: 0 },
          combatData: { 战斗ID: battleId, 回合: 2 },
        }, [
          { name: '候选甲', weight: 100 * scale, scoringSummary: { candidateId: 'a', tags: [], rejectionCode: '', resourceCostEV: 0 } },
          { name: '候选乙', weight: 95 * scale, scoringSummary: { candidateId: 'b', tags: [], rejectionCode: '', resourceCostEV: 0 } },
          { name: '候选丙', weight: 90 * scale, scoringSummary: { candidateId: 'c', tags: [], rejectionCode: '', resourceCostEV: 0 } },
        ], 'ACTIVE', 0);
        const baseline = run(1, 'mad-scale');
        const scaled = run(10, 'mad-scale');
        断言战斗回归夹具(baseline.option?.name === scaled.option?.name, `同比缩放改变主观选择:${baseline.option?.name}->${scaled.option?.name}`);
        日志.push(`MAD同比缩放选择=${baseline.option?.name}`);
      });
      注册('控制抵抗后不生成同回合追击', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        combatData.回合 = 1;
        玩家.men = 1;
        玩家.men_max = 1;
        玩家.sp = 1;
        玩家.sp_max = 1;
        敌人.men = 100000;
        敌人.men_max = 100000;
        敌人.sp = 100000;
        敌人.sp_max = 100000;
        玩家.第1武魂 = {
          表象名称: '控制抵抗夹具武魂',
          第1魂环: {
            第1魂技: normalizeSkillData({
              name: '抵抗测试控制',
              魂技名: '抵抗测试控制',
              技能分类: '控制',
              目标: '敌方单体',
              消耗: '无',
              前摇: 8,
              命中后追击: true,
              _效果数组: [
                { 原型: '状态施加', 目标: '单体', 状态: '眩晕', 状态名称: '眩晕', 持续回合: 2, 计算层效果: { skip_turn: true } },
              ],
            }, '抵抗测试控制'),
            第2魂技: normalizeSkillData(战斗回归输出魂技('抵抗后不应追击', '敌方单体', 8, 88, '近身攻击'), '抵抗后不应追击'),
          },
        };
        玩家.final = buildCombatFinalStats(玩家);
        敌人.final = buildCombatFinalStats(敌人);
        const 原随机 = Math.random;
        Math.random = () => 0.99;
        try {
          const result = runActorTurn({
            char: 玩家,
            side: 'player',
            __declaredRound: 1,
            __declaredAction: { action_type: '释放魂技', type: '释放魂技', skill: 玩家.第1武魂.第1魂环.第1魂技, cast_time: 8 },
            __declaredActionName: '抵抗测试控制',
            __declaredTargetName: 敌人.name,
          }, { combatData, round: 1 });
          const starts = globalThis.__LWCS_BATTLE_RUNTIME__.ensureLedger(combatData).filter(event => event?.eventKind === 'action_start' && isSameBattleReportName(event?.actorName || '', 玩家.name));
          断言战斗回归夹具(!敌人.状态效果?.眩晕, `控制抵抗后状态仍落地:${JSON.stringify(敌人.状态效果)}`);
          断言战斗回归夹具(starts.length === 1 && !starts.some(event => event?.meta?.chainType === 'FOLLOW_UP'), `控制抵抗后仍生成追击:${JSON.stringify(starts)}`);
          断言战斗回归夹具(!result?.followUp, '抵抗路径返回了追击结果');
          日志.push('控制抵抗后未生成追击');
        } finally {
          Math.random = 原随机;
        }
      });
      注册('追击前摇不足时不免费追加动作', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        combatData.回合 = 1;
        玩家.第1武魂 = {
          表象名称: '预算夹具武魂',
          第1魂环: {
            第1魂技: normalizeSkillData({
              name: '长前摇控制', 魂技名: '长前摇控制', 技能分类: '控制', 目标: '敌方单体', 消耗: '无', 前摇: 35, 命中后追击: true,
              _效果数组: [
                { 原型: '状态施加', 目标: '单体', 状态: '位移限制', 状态名称: '位移限制', 持续回合: 2, 计算层效果: { cast_speed_penalty: 0.25 } },
              ],
            }, '长前摇控制'),
            第2魂技: normalizeSkillData(战斗回归输出魂技('预算不足追击', '敌方单体', 10, 120, '近身攻击'), '预算不足追击'),
          },
        };
        玩家.final = buildCombatFinalStats(玩家);
        敌人.agi = 1;
        敌人.final = buildCombatFinalStats(敌人);
        const 原随机 = Math.random;
        Math.random = () => 0.01;
        try {
          const result = runActorTurn({
            char: 玩家,
            side: 'player',
            __declaredRound: 1,
            __declaredAction: { action_type: '释放魂技', type: '释放魂技', skill: 玩家.第1武魂.第1魂环.第1魂技, cast_time: 35 },
            __declaredActionName: '长前摇控制',
            __declaredTargetName: 敌人.name,
          }, { combatData, round: 1 });
          const starts = globalThis.__LWCS_BATTLE_RUNTIME__.ensureLedger(combatData).filter(event => event?.eventKind === 'action_start' && isSameBattleReportName(event?.actorName || '', 玩家.name));
          断言战斗回归夹具(starts.length === 1 && !starts.some(event => event?.meta?.chainType === 'FOLLOW_UP'), `剩余预算不足仍生成追击:${JSON.stringify(starts)}`);
          断言战斗回归夹具(!result?.followUp, '前摇不足路径返回了追击结果');
          日志.push(`剩余预算不足不追击:${result?.remainingActionTime ?? '未知'}`);
        } finally {
          Math.random = 原随机;
        }
      });
      注册('敏攻压制态势下不再回落单体直伤硬追', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.type = '敏攻系';
        玩家.agi = 1200;
        玩家.final = buildCombatFinalStats(玩家);
        敌人.type = '强攻系';
        敌人.agi = 90;
        敌人.final = buildCombatFinalStats(敌人);
        敌人.第1武魂 = {
          表象名称: '压制武魂',
          第1魂环: {
            第1魂技: normalizeSkillData({
              name: '缚影压制',
              魂技名: '缚影压制',
              技能分类: '控制',
              目标: '敌方单体',
              消耗: '无',
              前摇: 8,
              _效果数组: [
                { 原型: '状态施加', 目标: '单体', 状态: '位移限制', 状态名称: '位移限制', 持续回合: 1, 计算层效果: { cast_speed_penalty: 0.2, lock_level: 1 } },
              ],
            }, '缚影压制'),
          },
          第2魂环: {
            第1魂技: normalizeSkillData(战斗回归输出魂技('贴身冲拳', '敌方单体', 8, 88, '近身攻击'), '贴身冲拳'),
          },
        };
        recordActorActionWhiffedByDodge(敌人, '贴身冲拳', 玩家);
        recordActorActionWhiffedByDodge(敌人, '普通攻击', 玩家);
        const actorEntry = { char: 敌人, side: 'enemy' };
        const action = buildAutoActionForActor(actorEntry, { enemyTarget: 玩家, allyTarget: 敌人 }, {
          combatData,
          observedTargetAction: { action_type: '常规攻击', type: '常规攻击', skill: normalizeSkillData(战斗回归输出魂技('高速切入', '敌方单体', 6, 72, '近身攻击'), '高速切入') },
        });
        const 动作名 = String(action?.skill?.name || action?.skill?.魂技名 || action?.type || action?.action_type || '');
        断言战斗回归夹具(!/普通攻击|常规攻击|贴身冲拳/.test(动作名), `敏攻压制态势下仍单体直伤硬追:${动作名};${action?.decision_log || ''}`);
        断言战斗回归夹具(/缚影压制|收招转防|反敏攻/.test(`${动作名} ${action?.decision_log || ''}`), `敏攻压制态势下未切反敏攻动作:${动作名};${action?.decision_log || ''}`);
        日志.push(`敏攻压制态势已避开直伤硬追:${动作名}`);
      });
      注册('敏攻闪避后不重复同一单体压制技能', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.type = '敏攻系';
        玩家.agi = 1250;
        玩家.final = buildCombatFinalStats(玩家);
        敌人.type = '强攻系';
        敌人.agi = 92;
        敌人.final = buildCombatFinalStats(敌人);
        敌人.第1武魂 = {
          表象名称: '蛇影武魂',
          第1魂环: {
            第1魂技: normalizeSkillData({
              name: '毒牙牵制',
              魂技名: '毒牙牵制',
              技能分类: '控制',
              目标: '敌方单体',
              消耗: '无',
              前摇: 8,
              _效果数组: [
                { 原型: '状态施加', 目标: '单体', 状态: '中毒', 状态名称: '中毒', 持续回合: 2, 计算层效果: { dot_damage_ratio: 0.03, dodge_penalty: 0.08 } },
              ],
            }, '毒牙牵制'),
          },
          第2魂环: {
            第1魂技: normalizeSkillData({
              name: '青影蛇群',
              魂技名: '青影蛇群',
              技能分类: '控制',
              目标: '敌方群体',
              消耗: '无',
              前摇: 10,
              _效果数组: [
                { 原型: '伤害结算', 目标: '群体', 威力倍率: 68, 伤害类型: '近身攻击', 防御穿透: 0 },
                { 原型: '状态施加', 目标: '群体', 状态: '位移限制', 状态名称: '位移限制', 持续回合: 1, 计算层效果: { cast_speed_penalty: 0.2 } },
              ],
            }, '青影蛇群'),
          },
        };
        recordActorActionWhiffedByDodge(敌人, '毒牙牵制', 玩家);
        recordActorActionWhiffedByDodge(敌人, '普通攻击', 玩家);
        const actorEntry = { char: 敌人, side: 'enemy' };
        const action = buildAutoActionForActor(actorEntry, { enemyTarget: 玩家, allyTarget: 敌人 }, {
          combatData,
          observedTargetAction: { action_type: '伺机闪避', type: '伺机闪避', skill: normalizeSkillData({ name: '伺机闪避', 技能分类: '防御', 目标: '自身', 消耗: '无', 前摇: 4 }, '伺机闪避') },
        });
        const 动作名 = String(action?.skill?.name || action?.skill?.魂技名 || action?.type || action?.action_type || '');
        断言战斗回归夹具(!/毒牙牵制/.test(动作名), `敏攻闪避后仍重复同一单体压制技能:${动作名};${action?.decision_log || ''}`);
        断言战斗回归夹具(/青影蛇群|收招转防|反敏攻/.test(`${动作名} ${action?.decision_log || ''}`), `敏攻闪避后未切到范围压制或收招:${动作名};${action?.decision_log || ''}`);
        日志.push(`敏攻闪避后改用:${动作名}`);
      });
      注册('敏攻系主动规划可选控制型第二魂技', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.type = '强攻系';
        玩家.agi = 180;
        玩家.final = buildCombatFinalStats(玩家);
        敌人.type = '敏攻系';
        敌人.agi = 420;
        敌人.final = buildCombatFinalStats(敌人);
        敌人.第1武魂 = {
          表象名称: '蛇影武魂',
          第1魂环: {
            第1魂技: normalizeSkillData(战斗回归输出魂技(战斗回归敌方快攻技能名, '敌方单体', 6, 88, '近身攻击'), 战斗回归敌方快攻技能名),
          },
          第2魂环: {
            第2魂技: normalizeSkillData({
              name: '第二魂技·青影蛇群',
              魂技名: '第二魂技·青影蛇群',
              技能分类: '控制',
              目标: '敌方群体',
              消耗: '无',
              前摇: 10,
              _效果数组: [
                { 原型: '伤害结算', 目标: '群体', 威力倍率: 72, 伤害类型: '远程攻击', 命中修正: 0.12 },
                { 原型: '状态施加', 目标: '群体', 状态: '迟缓', 状态名称: '迟缓', 持续回合: 2, 计算层效果: { cast_speed_penalty: 0.18, dodge_penalty: 0.08 } },
              ],
            }, '第二魂技·青影蛇群'),
          },
        };
        const actorEntry = { char: 敌人, side: 'enemy' };
        const action = buildAutoActionForActor(actorEntry, { enemyTarget: 玩家, allyTarget: 敌人 }, {
          combatData,
          observedTargetAction: {
            action_type: '释放魂技',
            type: '技能',
            cast_time: 12,
            skill: normalizeSkillData(战斗回归输出魂技('裂地冲拳', '敌方单体', 12, 96, '近身攻击'), '裂地冲拳'),
          },
        });
        const 动作名 = String(action?.skill?.name || action?.skill?.魂技名 || action?.type || action?.action_type || '');
        断言战斗回归夹具(/第二魂技·青影蛇群|敏攻截断|连锁控制|范围压制/.test(`${动作名} ${action?.decision_log || ''}`), `敏攻系主动规划未抬起控制型第二魂技:${动作名};${action?.decision_log || ''}`);
        日志.push(`敏攻系主动规划可抬起控制型第二魂技:${动作名}`);
      });
      注册('范围控制来袭且无真截断时不再强势对轰', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.type = '强攻系';
        玩家.final = buildCombatFinalStats(玩家);
        敌人.type = '敏攻系';
        敌人.agi = 360;
        敌人.final = buildCombatFinalStats(敌人);
        敌人.第1武魂 = {
          表象名称: '快攻武魂',
          第1魂环: {
            第1魂技: normalizeSkillData(战斗回归输出魂技(战斗回归敌方快攻技能名, '敌方单体', 6, 88, '近身攻击'), 战斗回归敌方快攻技能名),
            第2魂技: normalizeSkillData(战斗回归输出魂技(战斗回归敌方压制技能名, '敌方单体', 10, 96, '近身攻击'), 战斗回归敌方压制技能名),
          },
        };
        const playerAction = {
          action_type: '释放魂技',
          type: '释放魂技',
          cast_time: 12,
          skill: normalizeSkillData({
            name: '第二魂技·青影蛇群',
            魂技名: '第二魂技·青影蛇群',
            技能分类: '控制',
            目标: '敌方群体',
            消耗: '魂力:140',
            前摇: 12,
            _效果数组: [
              { 原型: '伤害结算', 目标: '群体', 威力倍率: 72, 伤害类型: '远程攻击', 命中修正: 0.12 },
              { 原型: '状态施加', 目标: '群体', 状态: '迟缓', 状态名称: '迟缓', 持续回合: 2, 计算层效果: { cast_speed_penalty: 0.18, dodge_penalty: 0.08 } },
            ],
          }, '第二魂技·青影蛇群'),
        };
        const ratio = calculateReactionRatio(玩家, 敌人, playerAction, combatData);
        const reaction = determineNpcAction(combatData, playerAction, ratio);
        const 动作名 = String(reaction?.skill?.name || reaction?.skill?.魂技名 || reaction?.type || reaction?.action_type || '');
        断言战斗回归夹具(!/强势对轰/.test(String(reaction?.type || '')), `范围控制来袭时仍走强势对轰:${reaction?.type || '无'};${reaction?.log || ''}`);
        断言战斗回归夹具(/伺机闪避|危机自保|防御|闪避/.test(`${动作名} ${reaction?.type || ''}`), `范围控制来袭时未转入防守应对:${动作名};${reaction?.log || ''}`);
        日志.push(`范围控制来袭改为防守应对:${reaction?.type || 动作名}`);
      });
      注册('范围控制主动技在无真截断时不再默认被先手压制', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.type = '强攻系';
        玩家.final = buildCombatFinalStats(玩家);
        玩家.第1武魂.第2魂环 ||= {};
        玩家.第1武魂.第2魂环.第2魂技 = normalizeSkillData({
          name: '第二魂技·青影蛇群',
          魂技名: '第二魂技·青影蛇群',
          技能分类: '控制',
          目标: '敌方群体',
          消耗: '魂力:140',
          前摇: 12,
          _效果数组: [
            { 原型: '伤害结算', 目标: '群体', 威力倍率: 72, 伤害类型: '远程攻击', 命中修正: 0.12 },
            { 原型: '状态施加', 目标: '群体', 状态: '迟缓', 状态名称: '迟缓', 持续回合: 2, 计算层效果: { cast_speed_penalty: 0.18, dodge_penalty: 0.08 } },
          ],
        }, '第二魂技·青影蛇群');
        敌人.type = '敏攻系';
        敌人.agi = 280;
        敌人.final = buildCombatFinalStats(敌人);
        敌人.第1武魂 = {
          表象名称: '快攻武魂',
          第1魂环: {
            第1魂技: normalizeSkillData(战斗回归输出魂技(战斗回归敌方快攻技能名, '敌方单体', 6, 88, '近身攻击'), 战斗回归敌方快攻技能名),
            第2魂技: normalizeSkillData(战斗回归输出魂技(战斗回归敌方压制技能名, '敌方单体', 10, 96, '近身攻击'), 战斗回归敌方压制技能名),
          },
        };
        const entry = {
          actor_name: 玩家.name,
          action_type: '释放魂技',
          skill: { 魂技名: '第二魂技·青影蛇群', name: '第二魂技·青影蛇群', 消耗: '魂力:140' },
          __魂环路径: ['第1武魂', '第2魂环'],
          __魂技槽位: '第2魂技',
          target_name: 敌人.name,
        };
        let result = null;
        使用战斗回归桥接(combatData, { [玩家.name]: 玩家, [敌人.name]: 敌人 }, () => {
          result = onPlayerAttack('第二魂技·青影蛇群', {
            dryRun: true,
            mode: 'single_round',
            combatData,
            actionDeclaration: 构建战斗回归动作声明(entry),
            intentMode: '点到为止',
          });
        });
        const text = 导出战斗记录可见文本(result, 'preview');
        断言战斗回归夹具(!/第二魂技·青影蛇群】被对手抢先压制/.test(text), `无真截断时范围控制仍被默认先手压制:${text}`);
        断言战斗回归夹具(/施展【第二魂技·青影蛇群】指向夹具敌人|陷入【迟缓】|陷入【减速】/.test(text), `范围控制主动技未形成可见落地结果:${text}`);
        日志.push(`范围控制主动技在无真截断时成功落地:${text.split('\n').slice(0, 6).join(' | ')}`);
      });
      注册('未触发闪避克制时仍允许继续压制', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.type = '强攻系';
        玩家.agi = 120;
        玩家.final = buildCombatFinalStats(玩家);
        敌人.type = '控制系';
        敌人.agi = 140;
        敌人.final = buildCombatFinalStats(敌人);
        敌人.第1武魂 = {
          表象名称: '压制武魂',
          第1魂环: {
            第1魂技: normalizeSkillData(战斗回归输出魂技(战斗回归敌方快攻技能名, '敌方单体', 6, 88, '近身攻击'), 战斗回归敌方快攻技能名),
          },
          第2魂环: {
            第1魂技: normalizeSkillData(战斗回归输出魂技(战斗回归敌方压制技能名, '敌方单体', 10, 96, '近身攻击'), 战斗回归敌方压制技能名),
          },
        };
        const actorEntry = { char: 敌人, side: 'enemy' };
        const action = buildAutoActionForActor(actorEntry, { enemyTarget: 玩家, allyTarget: 敌人 }, {
          combatData,
          observedTargetAction: { action_type: '常规攻击', type: '常规攻击', skill: normalizeSkillData(战斗回归输出魂技('裂地冲拳', '敌方单体', 8, 72, '近身攻击'), '裂地冲拳') },
        });
        const 动作名 = String(action?.skill?.name || action?.skill?.魂技名 || action?.type || action?.action_type || '');
        断言战斗回归夹具(new RegExp(`${战斗回归敌方快攻技能名}|${战斗回归敌方压制技能名}`).test(动作名), `未触发闪避克制时仍被过度压成守势:${动作名};${action?.decision_log || ''}`);
        断言战斗回归夹具(!/收招转防|当前不宜继续前压/.test(`${动作名} ${action?.decision_log || ''}`), `未触发闪避克制时误判为必须转守:${动作名};${action?.decision_log || ''}`);
        日志.push(`未触发闪避克制时继续压制:${动作名}`);
      });
      注册('行为链换招不泄漏占位技能名', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.type = '强攻系';
        玩家.agi = 80;
        玩家.final = buildCombatFinalStats(玩家);
        敌人.type = '敏攻系';
        敌人.agi = 999;
        敌人.final = buildCombatFinalStats(敌人);
        玩家.第1武魂 = {
          表象名称: '夹具武魂',
          第1魂环: {
            第1魂技: normalizeSkillData(战斗回归输出魂技('贴身冲拳', '敌方单体', 8, 88, '近身攻击'), '贴身冲拳'),
          },
        };
        const logs = buildReadableBattleReportLines([
          '[团战第1回合开始]',
          '[第1回合] [起招] 唐凌雪以[贴身冲拳]起招。 [应招] 韦小枫以[伺机闪避]应对。 [主动闪避] 韦小枫凭借敏捷优势惊险躲过了攻击。',
          '[团战第2回合开始]',
          '[第2回合] [起招] 韦小枫以[第1魂技]起招。 [应招] 唐凌雪以[收招转防]应对。'
        ], 8, { combatData }).join('\n');
        断言战斗回归夹具(!/换招技能|未命名技能/.test(logs), `公开战报泄漏内部占位技能名:${logs}`);
        断言战斗回归夹具(!/【第1魂技】|【第2魂技】/.test(logs), `公开战报仍残留魂技槽位占位:${logs}`);
        日志.push('行为链换招未再泄漏占位技能名');
      });
      注册('状态边际收益按剩余窗口收敛', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        const 中毒效果 = {
          原型: '状态施加',
          类型: 'debuff',
          目标: '单体',
          状态: '中毒',
          状态名称: '中毒',
          持续回合: 2,
          计算层效果: { dot_damage: 16 },
        };
        const 规划状态 = { combatData, primaryTarget: 敌人, target: 敌人 };
        const 首次收益 = 评估效果对单位规划收益(中毒效果, 玩家, 敌人, 规划状态, { name: '毒击' });
        敌人.状态效果.中毒 = { 类型: 'debuff', 层数: 1, duration: 2, 战斗效果: { ...createEmptyCombatEffectMap(), dot_damage: 16 } };
        const 满窗口重复收益 = 评估效果对单位规划收益(中毒效果, 玩家, 敌人, 规划状态, { name: '毒击' });
        敌人.状态效果.中毒.duration = 1;
        const 剩余一回合收益 = 评估效果对单位规划收益(中毒效果, 玩家, 敌人, 规划状态, { name: '毒击' });
        const 禁止刷新收益 = 评估效果对单位规划收益({ ...中毒效果, 覆盖规则: '不可刷新' }, 玩家, 敌人, 规划状态, { name: '毒击' });
        敌人.状态效果.中毒.duration = 2;
        const 可叠加收益 = 评估效果对单位规划收益({ ...中毒效果, 覆盖规则: '最多3层叠加' }, 玩家, 敌人, 规划状态, { name: '毒击' });
        const 叠加结果 = 合并状态覆盖条目_V1(敌人.状态效果.中毒, {
          类型: 'debuff',
          层数: 1,
          duration: 2,
          战斗效果: { ...createEmptyCombatEffectMap(), dot_damage: 16 },
        }, { ...中毒效果, 覆盖规则: '最多3层叠加' });
        断言战斗回归夹具(首次收益 > 0, `首次状态收益未成立:${首次收益}`);
        断言战斗回归夹具(满窗口重复收益 === 0, `满窗口同状态未归零:${满窗口重复收益}`);
        断言战斗回归夹具(剩余一回合收益 > 0 && 剩余一回合收益 < 首次收益, `剩余窗口边际收益异常:${首次收益}/${剩余一回合收益}`);
        断言战斗回归夹具(禁止刷新收益 === 0, `不可刷新状态仍获得收益:${禁止刷新收益}`);
        断言战斗回归夹具(可叠加收益 > 0, `可叠加状态未获得边际收益:${可叠加收益}`);
        断言战斗回归夹具(叠加结果.applied && 叠加结果.mode === 'stack' && Number(叠加结果.state?.层数 || 0) === 2, `状态叠加落地策略异常:${JSON.stringify(叠加结果)}`);
        日志.push(`状态边际收益成立:${首次收益}/${剩余一回合收益}/${满窗口重复收益}`);
      });
      注册('状态免疫与抵抗进入规划收益', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        const 控制效果 = {
          原型: '状态施加',
          类型: 'debuff',
          目标: '单体',
          状态: '位移限制',
          状态名称: '位移限制',
          持续回合: 2,
          驱动属性: '精神力',
          影响方向: '成功率',
          计算层效果: { cannot_react: true, lock_level: 1 },
        };
        const 规划状态 = { combatData, primaryTarget: 敌人, target: 敌人 };
        玩家.men_max = 1200;
        敌人.men_max = 120;
        玩家.final = buildCombatFinalStats(玩家);
        敌人.final = buildCombatFinalStats(敌人);
        const 高命中收益 = 评估效果对单位规划收益(控制效果, 玩家, 敌人, 规划状态, { name: '封步' });
        玩家.men_max = 60;
        敌人.men_max = 1800;
        玩家.final = buildCombatFinalStats(玩家);
        敌人.final = buildCombatFinalStats(敌人);
        const 高抵抗收益 = 评估效果对单位规划收益(控制效果, 玩家, 敌人, 规划状态, { name: '封步' });
        敌人.状态效果.异常免疫 = { 类型: 'buff', 层数: 1, duration: 2, 战斗效果: { ...createEmptyCombatEffectMap(), 无视异常: true } };
        敌人.final = buildCombatFinalStats(敌人);
        const 免疫收益 = 评估效果对单位规划收益(控制效果, 玩家, 敌人, 规划状态, { name: '封步' });
        断言战斗回归夹具(高命中收益 > 高抵抗收益 && 高抵抗收益 > 0, `抵抗未压低状态收益:${高命中收益}/${高抵抗收益}`);
        断言战斗回归夹具(免疫收益 === 0, `状态免疫未归零:${免疫收益}`);
        日志.push(`状态抵抗/免疫收益成立:${高命中收益}/${高抵抗收益}/${免疫收益}`);
      });
      注册('资源消费者减少不提高回复收益', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        玩家.sp = 0;
        玩家.sp_max = 1600;
        玩家.第1武魂 = {
          表象名称: '资源消费武魂',
          第1魂环: {
            第1魂技: normalizeSkillData(战斗回归输出魂技('耗魂重击', '敌方单体', 8, 120, '近身攻击'), '耗魂重击'),
          },
        };
        玩家.第1武魂.第1魂环.第1魂技.消耗 = '魂力:500';
        const 回复技能 = normalizeSkillData({
          name: '凝神回魂',
          魂技名: '凝神回魂',
          技能分类: '辅助',
          目标: '自身',
          消耗: '无',
          前摇: 10,
          _效果数组: [{ 原型: '资源变化', 目标: '自身', 资源: '魂力', 数值: 300 }],
        }, '凝神回魂');
        const 计算总分 = parts => Number(parts?.effectiveDeltaEV || 0) + Number(parts?.futureUnlockEV || 0) + Number(parts?.enemyDeniedEV || 0) + Number(parts?.teamIntentEV || 0) + Number(parts?.sustainEV || 0) -
          Number(parts?.resourceCostEV || 0) - Number(parts?.failureRiskEV || 0) - Number(parts?.exposureRiskEV || 0) - Number(parts?.chainConflictEV || 0);
        const 有消费者 = 评估技能规划净收益(回复技能, { actor: 玩家, primaryTarget: 玩家, combatData, behaviorState: { combatData }, skipTactical: true });
        delete 玩家.第1武魂;
        const 无消费者 = 评估技能规划净收益(回复技能, { actor: 玩家, primaryTarget: 玩家, combatData, behaviorState: { combatData }, skipTactical: true });
        const 有消费者分 = 计算总分(有消费者.scoreParts);
        const 无消费者分 = 计算总分(无消费者.scoreParts);
        断言战斗回归夹具(无消费者分 <= 有消费者分, `删除资源消费者反而提高回复收益:${有消费者分}/${无消费者分}`);
        断言战斗回归夹具(Number(无消费者.scoreParts?.sustainEV || 0) <= Number(有消费者.scoreParts?.sustainEV || 0), `无消费者仍获得更高续航价值:${JSON.stringify({ 有消费者: 有消费者.scoreParts, 无消费者: 无消费者.scoreParts })}`);
        日志.push(`资源消费者变形成立:${有消费者分}->${无消费者分}`);
      });
      注册('反伤增强不提高无防护多段攻击收益', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        const 多段技能 = normalizeSkillData({
          name: '连环冲击',
          魂技名: '连环冲击',
          技能分类: '输出',
          目标: '敌方单体',
          消耗: '无',
          前摇: 10,
          _效果数组: [{ 原型: '伤害结算', 目标: '单体', 威力倍率: 120, 攻击段数: 4, 伤害类型: '近身攻击', 防御穿透: 0 }],
        }, '连环冲击');
        const 计算总分 = parts => Number(parts?.effectiveDeltaEV || 0) + Number(parts?.futureUnlockEV || 0) + Number(parts?.enemyDeniedEV || 0) + Number(parts?.teamIntentEV || 0) + Number(parts?.sustainEV || 0) -
          Number(parts?.resourceCostEV || 0) - Number(parts?.failureRiskEV || 0) - Number(parts?.exposureRiskEV || 0) - Number(parts?.chainConflictEV || 0);
        const 无反伤 = 评估技能规划净收益(多段技能, { actor: 玩家, primaryTarget: 敌人, combatData, behaviorState: { combatData }, skipTactical: true });
        敌人.状态效果.荆棘反震 = { 类型: 'buff', 层数: 1, duration: 2, 战斗效果: { ...createEmptyCombatEffectMap(), damage_reflect_ratio: 0.8 } };
        const 高反伤 = 评估技能规划净收益(多段技能, { actor: 玩家, primaryTarget: 敌人, combatData, behaviorState: { combatData }, skipTactical: true });
        断言战斗回归夹具(Number(高反伤.scoreParts?.exposureRiskEV || 0) > Number(无反伤.scoreParts?.exposureRiskEV || 0), `反伤没有进入暴露风险:${JSON.stringify({ 无反伤: 无反伤.scoreParts, 高反伤: 高反伤.scoreParts })}`);
        断言战斗回归夹具(计算总分(高反伤.scoreParts) <= 计算总分(无反伤.scoreParts), `提高反伤反而提高多段攻击收益:${计算总分(无反伤.scoreParts)}/${计算总分(高反伤.scoreParts)}`);
        日志.push(`反伤变形成立:${计算总分(无反伤.scoreParts)}->${计算总分(高反伤.scoreParts)}`);
      });
      注册('召唤控制标签不能进入即时截断池', 日志 => {
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        const 召唤控制技能 = normalizeSkillData({
          name: '蛇群封场',
          魂技名: '蛇群封场',
          技能分类: '控制',
          目标: '敌方群体',
          消耗: '魂力:120',
          前摇: 10,
          _效果数组: [
            { 原型: '召唤生成', 目标: '自身', 召唤单位类型: '其他召唤生物', 召唤物名称: '青影蛇', 数量: 1, 行动模式: '协同攻击', 强度: 1, 持续回合: 1 },
            { 原型: '状态施加', 目标: '群体', 状态: '位移限制', 状态名称: '位移限制', 持续回合: 1, 计算层效果: { dodge_penalty: 0.15, cast_speed_penalty: 0.15 } },
          ],
        }, '蛇群封场');
        敌人.第1武魂 = { 表象名称: '召唤控制武魂', 第1魂环: { 第1魂技: 召唤控制技能 } };
        敌人.type = '敏攻系';
        敌人.final = buildCombatFinalStats(敌人);
        const 来袭技能 = normalizeSkillData(战斗回归输出魂技('高速突进', '敌方单体', 6, 96, '近身攻击'), '高速突进');
        const 应招候选 = 构建应招候选池(敌人, 玩家, { type: '释放魂技', action_type: '释放魂技', skill: 来袭技能 }, combatData);
        断言战斗回归夹具(!判定技能具备真实截断资格_V1(召唤控制技能), '召唤/控制标签被误判为真实截断');
        断言战斗回归夹具(!应招候选.some(item => String(item?.action?.skill?.name || item?.name || '') === '蛇群封场'), `召唤控制技能误入即时应招池:${JSON.stringify(应招候选)}`);
        日志.push('召唤控制技能未进入即时截断应招池');
      });
      return { ok: 夹具列表.every(item => item.ok), results: 夹具列表 };
    }

    function 生成自然召唤闭环调试结果(配置 = {}) {
      const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
      const 技能名 = String(配置.技能名 || '影蛇分身').trim() || '影蛇分身';
      const 召唤单位类型 = String(配置.召唤单位类型 || '分身').trim() || '分身';
      const 召唤物名称 = String(配置.召唤物名称 || 技能名).trim() || 技能名;
      const 属性继承比例 = 配置.属性继承比例 && typeof 配置.属性继承比例 === 'object'
        ? 配置.属性继承比例
        : { 力量: 0.72, 防御: 0.36, 敏捷: 0.68, 体力上限: 0.38, 魂力上限: 0.35, 精神力上限: 0.35 };
      const 技能 = normalizeSkillData({
        name: 技能名, 魂技名: 技能名, 技能分类: '召唤', 目标: '自身', 消耗: String(配置.消耗 || '魂力:90 | 精神力:45').trim(), 前摇: Number(配置.前摇 || 8),
        _效果数组: [{
          原型: '召唤生成', 目标: '自身', 生效方式: '独立生效', 召唤单位类型, 召唤物名称, 数量: 1, 持续回合: Number(配置.持续回合 || 3),
          继承属性比例: Object.values(属性继承比例).reduce((sum, value) => sum + Number(value || 0), 0) / Math.max(1, Object.keys(属性继承比例).length),
        }],
      }, 技能名);
      玩家.第1武魂.第1魂环.第1魂技 = 技能;
      敌人.第1武魂 = {
        表象名称: '敌方夹具武魂',
        第1魂环: {
          第1魂技: 战斗回归输出魂技(战斗回归敌方快攻技能名, '敌方单体', 6, 88, '近身攻击'),
          第2魂技: 战斗回归输出魂技(战斗回归敌方压制技能名, '敌方单体', 10, 96, '近身攻击'),
        },
      };
      敌人.type = String(配置.敌人系别 || '敏攻系').trim() || '敏攻系';
      敌人.agi = Math.max(1, Number(配置.敌人敏捷 || 80));
      敌人.final = buildCombatFinalStats(敌人);
      const entry = {
        actor_name: 玩家.name,
        action_type: '释放魂技',
        skill: { 魂技名: 技能名, name: 技能名, 消耗: 技能.消耗 || '无' },
        __魂环路径: ['第1武魂', '第1魂环'],
        __魂技槽位: '第1魂技',
        target_name: 玩家.name,
      };
      let 首轮结果 = null;
      使用战斗回归桥接(combatData, { [玩家.name]: 玩家, 夹具友方: 构建战斗回归夹具单位('夹具友方', '辅助系'), [敌人.name]: 敌人 }, () => {
        if (root.__LWCS_BATTLE_AUDIT_PROGRESS__ === true) console.warn('[battle-audit] summon-natural before onPlayerAttack');
        首轮结果 = onPlayerAttack(技能名, {
          dryRun: true,
          mode: 'single_round',
          combatData,
          actionDeclaration: 构建战斗回归动作声明(entry),
          intentMode: '点到为止',
        });
        if (root.__LWCS_BATTLE_AUDIT_PROGRESS__ === true) console.warn('[battle-audit] summon-natural after onPlayerAttack');
      });
      const 自然战斗数据 = 首轮结果?.combatData && typeof 首轮结果.combatData === 'object' ? 首轮结果.combatData : combatData;
      自然战斗数据.回合 = Math.max(1, Number(自然战斗数据.回合 || 1)) + 1;
      const 次轮日志 = [];
      const 召唤回合开始日志 = BATTLE_RUNTIME.beginBattleRound(自然战斗数据, 自然战斗数据.回合).filter(Boolean).join(' ');
      if (root.__LWCS_BATTLE_AUDIT_PROGRESS__ === true) console.warn('[battle-audit] summon-natural after round-start');
      if (召唤回合开始日志) 次轮日志.push(`[第${自然战斗数据.回合}回合] ${召唤回合开始日志}`);
      const 召唤行动日志 = 执行自主召唤行动轴回合(自然战斗数据);
      if (root.__LWCS_BATTLE_AUDIT_PROGRESS__ === true) console.warn('[battle-audit] summon-natural after summon-axis');
      if (召唤行动日志) 次轮日志.push(`[第${自然战斗数据.回合}回合] ${召唤行动日志}`);
      const eventLedger = 自然战斗数据.__battleEventLedger || [];
      const publicReportBlocks = 构建事件账本公开战报Blocks(eventLedger, 8, { combatData: 自然战斗数据 });
      const result = {
        preview: true,
        intentText: String(配置.intentText || `使用【${技能名}】后观察召唤物下一回合行动。`).trim(),
        mode: 'battle_preview',
        battleMode: String(配置.battleMode || 'summon_closure').trim(),
        modeLabel: String(配置.modeLabel || '召唤闭环').trim(),
        intentMode: '点到为止',
        logs: [...(Array.isArray(首轮结果?.logs) ? 首轮结果.logs : []), ...次轮日志],
        roundsExecuted: 2,
        battleOutcome: { type: '未分胜负', label: String(配置.modeLabel || '召唤闭环').trim() },
        publicReportBlocks,
        publicReport: publicReportBlocks.map(item => 序列化公开战报Blocks(item?.blocks || [])).filter(Boolean).join('\n'),
        combatData: 自然战斗数据,
        decisionTrace: BATTLE_RUNTIME.collectDecisionTrace(自然战斗数据),
        resolutionTrace: 自然战斗数据.__battleResolutionTrace || [],
        eventLedger,
      };
      return { result, combatData: 自然战斗数据, 玩家, 敌人 };
    }

    function 生成召唤默认模式调试结果() {
      const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
      const 自然战斗数据 = combatData;
      const 创建召唤 = (动作名, 记录 = {}) => {
        const 召唤单位类型 = String(记录.召唤单位类型 || '魂兽').trim() || '魂兽';
        const 类型配置 = 读取召唤类型配置(召唤单位类型);
        const 行动模式 = String(记录.行动模式 || 类型配置.默认行动模式 || '协同攻击').trim();
        const 召唤物名称 = String(记录.召唤物名称 || '召唤物').trim();
        const 状态 = {
          类型: 'buff',
          层数: 1,
          duration: Math.max(1, Number(记录.持续回合 || 2)),
          描述: `由[${动作名}]生成的${召唤单位类型}`,
          召唤物: {
            召唤单位类型,
            召唤物名称,
            基础名称: 读取召唤编号基名(召唤物名称),
            召唤数量: 1,
            行动模式,
          },
        };
        if (记录.属性继承比例) 状态.召唤物.属性继承比例 = 记录.属性继承比例;
        else 状态.召唤物.强度 = Math.max(0.01, Number(记录.强度 || 1));
        const 状态键 = 写入持续原型唯一状态条目(玩家, `召唤:${召唤物名称}`, 状态);
        const 召唤单位 = 注册召唤运行态单位(自然战斗数据, 玩家, 状态键, 状态);
        if (召唤单位) 记账召唤生成事件(自然战斗数据, 玩家, 动作名, 召唤单位, { 召唤单位类型, 行动模式, 召唤物名称 });
      };
      创建召唤('本命兽契', {
        召唤单位类型: '本命召唤兽',
        召唤物名称: '玄契灵兽',
        持续回合: 3,
        属性继承比例: { 力量: 0.5, 防御: 0.48, 敏捷: 0.42, 体力上限: 0.5, 魂力上限: 0.42, 精神力上限: 0.45 },
      });
      创建召唤('唤影小兽', {
        召唤单位类型: '其他召唤生物',
        召唤物名称: '唤影小兽#1',
        持续回合: 2,
        强度: 1,
      });
      const eventLedger = 自然战斗数据.__battleEventLedger || [];
      const publicReportBlocks = 构建事件账本公开战报Blocks(eventLedger, 8, { combatData: 自然战斗数据 });
      return {
        result: {
          preview: true,
          mode: 'battle_preview',
          battleMode: 'summon_default_modes',
          modeLabel: '召唤默认模式',
          roundsExecuted: 1,
          battleOutcome: { type: '未分胜负', label: '召唤默认模式' },
          publicReportBlocks,
          publicReport: publicReportBlocks.map(item => 序列化公开战报Blocks(item?.blocks || [])).filter(Boolean).join('\n'),
          combatData: 自然战斗数据,
          resolutionTrace: 自然战斗数据.__battleResolutionTrace || [],
          eventLedger,
        },
        combatData: 自然战斗数据,
        玩家,
        敌人,
      };
    }

    function 生成二层防反闭环调试结果() {
      const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
      combatData.回合 = 1;
      const 主动作 = BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'action_start',
        round: 1,
        actorName: 玩家.name,
        targetName: 敌人.name,
        actionName: '裂地冲拳',
        actionType: 'attack',
        result: 'declared',
        meta: { reasonCode: 'ACTION_COMMITTED' },
      });
      BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'defend',
        round: 1,
        actorName: 敌人.name,
        targetName: 玩家.name,
        actionName: '承伤硬抗',
        actionType: 'reaction',
        sourceActionName: '裂地冲拳',
        sourceActionId: 主动作?.actionId || '',
        parentNodeId: 主动作?.chainNodeId || '',
        sourceNodeId: 主动作?.chainNodeId || '',
        result: 'guarded_hit',
        meta: {
          source: 'second_counter_fixture_target_reaction',
          reasonCode: 'REACTION_FAILED',
          reasonText: '以守势承接本次落点',
          damageAfterReaction: 96,
        },
      });
      const 主命中 = BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'hit_result',
        round: 1,
        actorName: 玩家.name,
        targetName: 敌人.name,
        actionName: '裂地冲拳',
        actionType: 'attack',
        sourceActionName: '裂地冲拳',
        sourceActionId: 主动作?.actionId || '',
        result: 'hit',
        effectCapability: { hasDamageEffect: true, effectKinds: ['伤害结算'] },
        meta: {
          damage: 96,
          rawDamage: 120,
          incomingDamage: 120,
          reactiveDamage: 96,
          finalDamage: 96,
          defenseValue: 60,
          defenseThreshold: 60,
          actualDefense: 60,
          formulaTrace: {
            damageType: '近身攻击',
            skillPower: 96,
            attackValue: 180,
            defenseValue: 60,
            baseDamage: 120,
            formulaText: '夹具预结算威力×攻防折算',
            meleeContactScale: 1.04,
            fusionDamageMult: 1,
          },
        },
      });
      const 防反窗口 = BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'counter_window',
        round: 1,
        actorName: 敌人.name,
        targetName: 玩家.name,
        actionName: '敌方截击',
        actionType: 'counter_window',
        sourceActionName: '裂地冲拳',
        sourceActionId: 主动作?.actionId || '',
        sourceNodeId: 主动作?.chainNodeId || '',
        result: 'opened',
        meta: { counterDepth: 1, reasonCode: 'COUNTER_WINDOW_OPENED' },
      });
      const 防反起手 = BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'action_start',
        round: 1,
        actorName: 敌人.name,
        targetName: 玩家.name,
        actionName: '敌方截击',
        finalActionName: '敌方截击',
        actionType: 'counter',
        sourceActionName: '裂地冲拳',
        sourceActionId: 主动作?.actionId || '',
        parentNodeId: 防反窗口?.chainNodeId || '',
        sourceNodeId: 防反窗口?.chainNodeId || '',
        result: 'started',
        meta: {
          source: 'second_counter_fixture_counter_start',
          counterDepth: 1,
          counterWindowEventId: 防反窗口?.eventId || '',
          counterWindowNodeId: 防反窗口?.chainNodeId || '',
          reasonCode: 'COUNTER_WINDOW_OPENED',
        },
      });
      BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'hit_result',
        round: 1,
        actorName: 敌人.name,
        targetName: 玩家.name,
        actionName: '敌方截击',
        actionType: 'counter',
        sourceActionName: '敌方截击',
        sourceActionId: 防反起手?.actionId || '',
        parentNodeId: 防反起手?.chainNodeId || '',
        sourceNodeId: 防反起手?.chainNodeId || '',
        result: 'hit',
        effectCapability: { hasDamageEffect: true, effectKinds: ['伤害结算'] },
        meta: {
          damage: 42,
          rawDamage: 52,
          incomingDamage: 52,
          reactiveDamage: 42,
          finalDamage: 42,
          defenseValue: 50,
          defenseThreshold: 50,
          actualDefense: 50,
          formulaTrace: {
            damageType: '近身攻击',
            skillPower: 52,
            attackValue: 130,
            defenseValue: 50,
            baseDamage: 52,
            formulaText: '夹具防反威力×攻防折算',
            meleeContactScale: 1.04,
            fusionDamageMult: 1,
          },
        },
      });
      const 防反动作 = BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'counter',
        round: 1,
        actorName: 敌人.name,
        targetName: 玩家.name,
        actionName: '敌方截击',
        actionType: 'counter',
        sourceActionName: '裂地冲拳',
        sourceActionId: 主动作?.actionId || '',
        sourceNodeId: 主动作?.chainNodeId || '',
        result: 'success',
        meta: {
          damage: 42,
          counterDepth: 1,
          counterWindowEventId: 防反窗口?.eventId || '',
          counterWindowNodeId: 防反窗口?.chainNodeId || '',
        },
      });
      const 玩家起手事件 = BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'dodge',
        round: 1,
        actorName: 玩家.name,
        targetName: 敌人.name,
        actionName: '伺机闪避',
        actionType: 'counter_secondary_reaction',
        sourceActionName: 战斗回归敌方快攻技能名,
        sourceActionId: 防反动作?.actionId || '',
        parentNodeId: 防反动作?.chainNodeId || '',
        sourceNodeId: 防反动作?.chainNodeId || '',
        result: 'failed',
        meta: {
          source: 'counter_secondary_reaction',
          counterActionEventId: 防反动作?.eventId || '',
          counterActionNodeId: 防反动作?.chainNodeId || '',
          counterDepth: 1,
          reactionMargin: 0.42,
          damageAfterReaction: 42,
        },
      });
      const 反防反窗口 = BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'counter_window',
        round: 1,
        actorName: 玩家.name,
        targetName: 敌人.name,
        actionName: '收招反压',
        actionType: 'counter_window',
        sourceActionName: 战斗回归敌方快攻技能名,
        sourceActionId: 防反动作?.actionId || '',
        sourceNodeId: 防反动作?.chainNodeId || '',
        parentNodeId: 防反动作?.chainNodeId || '',
        result: 'opened',
        meta: { counterDepth: 2, reasonCode: 'COUNTER_WINDOW_OPENED' },
      });
      const 反防反起手 = BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'action_start',
        round: 1,
        actorName: 玩家.name,
        targetName: 敌人.name,
        actionName: '收招反压',
        finalActionName: '收招反压',
        actionType: 'counter',
        sourceActionName: 战斗回归敌方快攻技能名,
        sourceActionId: 防反动作?.actionId || '',
        parentNodeId: 反防反窗口?.chainNodeId || '',
        sourceNodeId: 反防反窗口?.chainNodeId || '',
        result: 'started',
        meta: {
          source: 'second_counter_fixture_counter_start',
          counterDepth: 2,
          counterWindowEventId: 反防反窗口?.eventId || '',
          counterWindowNodeId: 反防反窗口?.chainNodeId || '',
          reasonCode: 'COUNTER_WINDOW_OPENED',
        },
      });
      BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'hit_result',
        round: 1,
        actorName: 玩家.name,
        targetName: 敌人.name,
        actionName: '收招反压',
        actionType: 'counter',
        sourceActionName: '收招反压',
        sourceActionId: 反防反起手?.actionId || '',
        parentNodeId: 反防反起手?.chainNodeId || '',
        sourceNodeId: 反防反起手?.chainNodeId || '',
        result: 'hit',
        effectCapability: { hasDamageEffect: true, effectKinds: ['伤害结算'] },
        meta: {
          damage: 18,
          rawDamage: 26,
          incomingDamage: 26,
          reactiveDamage: 18,
          finalDamage: 18,
          defenseValue: 48,
          defenseThreshold: 48,
          actualDefense: 48,
          formulaTrace: {
            damageType: '近身攻击',
            skillPower: 26,
            attackValue: 96,
            defenseValue: 48,
            baseDamage: 26,
            formulaText: '夹具反防反威力×攻防折算',
            meleeContactScale: 1.04,
            fusionDamageMult: 1,
          },
        },
      });
      const 反防反动作 = BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'counter',
        round: 1,
        actorName: 玩家.name,
        targetName: 敌人.name,
        actionName: '收招反压',
        actionType: 'counter',
        sourceActionName: 战斗回归敌方快攻技能名,
        sourceActionId: 防反动作?.actionId || '',
        sourceNodeId: 防反动作?.chainNodeId || '',
        parentNodeId: 防反动作?.chainNodeId || '',
        result: 'success',
        meta: {
          damage: 18,
          counterDepth: 2,
          counterWindowEventId: 反防反窗口?.eventId || '',
          counterWindowNodeId: 反防反窗口?.chainNodeId || '',
        },
      });
      BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'defend',
        round: 1,
        actorName: 敌人.name,
        targetName: 玩家.name,
        actionName: '收招转防',
        actionType: 'counter_secondary_reaction',
        sourceActionName: '收招反压',
        sourceActionId: 反防反动作?.actionId || '',
        parentNodeId: 反防反动作?.chainNodeId || '',
        sourceNodeId: 反防反动作?.chainNodeId || '',
        result: 'guarded_hit',
        meta: {
          source: 'counter_secondary_reaction',
          counterActionEventId: 反防反动作?.eventId || '',
          counterActionNodeId: 反防反动作?.chainNodeId || '',
          counterDepth: 2,
          reactionMargin: 0.31,
          damageAfterReaction: 18,
        },
      });
      const eventLedger = combatData.__battleEventLedger || [];
      const publicReportBlocks = 构建事件账本公开战报Blocks(eventLedger, 8, { combatData });
      return {
        result: {
          preview: true,
          mode: 'battle_preview',
          battleMode: 'second_counter',
          modeLabel: '二层防反闭环',
          roundsExecuted: 1,
          battleOutcome: { type: '未分胜负', label: '二层防反闭环' },
          publicReportBlocks,
          publicReport: publicReportBlocks.map(item => 序列化公开战报Blocks(item?.blocks || [])).filter(Boolean).join('\n'),
          combatData,
          resolutionTrace: combatData.__battleResolutionTrace || [],
          eventLedger,
          debugAnchors: {
            mainActionNodeId: 主动作?.chainNodeId || '',
            mainHitNodeId: 主命中?.chainNodeId || '',
            counterActionNodeId: 防反动作?.chainNodeId || '',
          },
        },
        combatData,
        玩家,
        敌人,
      };
    }

    function 生成回合末状态聚合调试结果() {
      const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
      combatData.回合 = 2;
      const 友方敌人 = 构建战斗回归夹具单位('夹具敌人乙', '敏攻系');
      combatData.参战者.team_enemy = [敌人, 友方敌人];
      [敌人, 友方敌人].forEach((目标, index) => {
        BATTLE_RUNTIME.writeLedgerEvent(combatData, {
          eventKind: 'state_tick',
          round: 2,
          actorName: 玩家.name,
          targetName: 目标.name || 目标.名称,
          targetId: `fixture-dot-target-${index + 1}`,
          actionName: '毒牙牵制',
          actionType: 'state_tick',
          sourceActionName: '毒牙牵制',
          sourceRound: 1,
          result: '损失',
          meta: {
            stateName: '中毒',
            amount: index === 0 ? 32 : 28,
            resource: '生命值',
            sourceActorName: 玩家.name,
            sourceActionName: '毒牙牵制',
            sourceRound: 1,
          },
        });
      });
      const eventLedger = combatData.__battleEventLedger || [];
      const publicReportBlocks = 构建事件账本公开战报Blocks(eventLedger, 8, { combatData });
      return {
        result: {
          preview: true,
          mode: 'battle_preview',
          battleMode: 'state_tick_aggregation',
          modeLabel: '回合末状态聚合',
          roundsExecuted: 2,
          battleOutcome: { type: '未分胜负', label: '回合末状态聚合' },
          publicReportBlocks,
          publicReport: publicReportBlocks.map(item => 序列化公开战报Blocks(item?.blocks || [])).filter(Boolean).join('\n'),
          combatData,
          resolutionTrace: combatData.__battleResolutionTrace || [],
          eventLedger,
        },
        combatData,
        玩家,
        敌人,
      };
    }

    function 生成回合末恢复资源聚合调试结果() {
      const { combatData, 玩家 } = 构建战斗回归夹具战斗态();
      combatData.回合 = 3;
      const 友方甲 = 构建战斗回归夹具单位('夹具友方甲', '辅助系');
      const 友方乙 = 构建战斗回归夹具单位('夹具友方乙', '防御系');
      combatData.参战者.team_player = [玩家, 友方甲, 友方乙];
      [友方甲, 友方乙].forEach((目标, index) => {
        BATTLE_RUNTIME.writeLedgerEvent(combatData, {
          eventKind: 'state_tick',
          round: 3,
          actorName: 玩家.name,
          targetName: 目标.name || 目标.名称,
          targetId: `fixture-hot-target-${index + 1}`,
          actionName: '回春光环',
          actionType: 'state_tick',
          sourceActionName: '回春光环',
          sourceRound: 2,
          result: '恢复',
          meta: {
            stateName: '回春',
            amount: index === 0 ? 24 : 26,
            resource: '生命值',
            sourceActorName: 玩家.name,
            sourceActionName: '回春光环',
            sourceRound: 2,
          },
        });
      });
      [友方甲, 友方乙].forEach((目标, index) => {
        BATTLE_RUNTIME.writeLedgerEvent(combatData, {
          eventKind: 'state_tick',
          round: 3,
          actorName: 玩家.name,
          targetName: 目标.name || 目标.名称,
          targetId: `fixture-resource-target-${index + 1}`,
          actionName: '聚魂阵',
          actionType: 'state_tick',
          sourceActionName: '聚魂阵',
          sourceRound: 2,
          result: '恢复',
          meta: {
            stateName: '聚魂',
            amount: index === 0 ? 15 : 18,
            resource: '魂力',
            sourceActorName: 玩家.name,
            sourceActionName: '聚魂阵',
            sourceRound: 2,
          },
        });
      });
      const eventLedger = combatData.__battleEventLedger || [];
      const publicReportBlocks = 构建事件账本公开战报Blocks(eventLedger, 8, { combatData });
      return {
        result: {
          preview: true,
          mode: 'battle_preview',
          battleMode: 'hot_resource_tick_aggregation',
          modeLabel: '回合末恢复与资源聚合',
          roundsExecuted: 3,
          battleOutcome: { type: '未分胜负', label: '回合末恢复与资源聚合' },
          publicReportBlocks,
          publicReport: publicReportBlocks.map(item => 序列化公开战报Blocks(item?.blocks || [])).filter(Boolean).join('\n'),
          combatData,
          resolutionTrace: combatData.__battleResolutionTrace || [],
          eventLedger,
        },
        combatData,
        玩家,
      };
    }

    function 生成状态抵抗闭环调试结果() {
      const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
      combatData.回合 = 1;
      const 起手 = BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'action_start',
        round: 1,
        actorName: 玩家.name,
        targetName: 敌人.name,
        actionName: '锁魄印',
        actionType: 'control',
        result: 'declared',
        meta: { reasonCode: 'ACTION_COMMITTED' },
      });
      BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'state_apply',
        round: 1,
        actorName: 玩家.name,
        targetName: 敌人.name,
        actionName: '锁魄印',
        actionType: 'control',
        sourceActionName: '锁魄印',
        sourceActionId: 起手?.actionId || '',
        sourceNodeId: 起手?.chainNodeId || '',
        result: 'resisted',
        reasonCode: 'REACTION_SUCCEEDED',
        reasonText: '目标抵住本次状态附着',
        meta: {
          stateName: '位移限制',
          successRate: 0.42,
          roll: 0.67,
          successRateReason: '硬控基础78% - 属性差36%（夹具抵抗）',
          successRateBreakdown: '附着成功率：42%，硬控基础78% - 属性差36%（夹具抵抗），检定67 > 42，未通过',
          driverAttr: '精神力',
          failureReason: 'state_resisted',
        },
      });
      const eventLedger = combatData.__battleEventLedger || [];
      const publicReportBlocks = 构建事件账本公开战报Blocks(eventLedger, 8, { combatData });
      return {
        result: {
          preview: true,
          mode: 'battle_preview',
          battleMode: 'state_resisted_closure',
          modeLabel: '状态抵抗闭环',
          roundsExecuted: 1,
          battleOutcome: { type: '未分胜负', label: '状态抵抗闭环' },
          publicReportBlocks,
          publicReport: publicReportBlocks.map(item => 序列化公开战报Blocks(item?.blocks || [])).filter(Boolean).join('\n'),
          combatData,
          resolutionTrace: combatData.__battleResolutionTrace || [],
          eventLedger,
        },
        combatData,
        玩家,
        敌人,
      };
    }

    function 生成状态免疫闭环调试结果() {
      const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
      combatData.回合 = 1;
      const 起手 = BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'action_start',
        round: 1,
        actorName: 玩家.name,
        targetName: 敌人.name,
        actionName: '锁魄印',
        actionType: 'control',
        result: 'declared',
        meta: { reasonCode: 'ACTION_COMMITTED' },
      });
      BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'state_apply',
        round: 1,
        actorName: 玩家.name,
        targetName: 敌人.name,
        actionName: '锁魄印',
        actionType: 'control',
        sourceActionName: '锁魄印',
        sourceActionId: 起手?.actionId || '',
        sourceNodeId: 起手?.chainNodeId || '',
        result: 'immune',
        reasonCode: 'REACTION_SUCCEEDED',
        reasonText: '目标免疫本次状态附着',
        meta: {
          stateName: '位移限制',
          successRate: 0.42,
          roll: 0.99,
          successRateReason: '硬控基础78% - 属性差36%（夹具免疫）',
          successRateBreakdown: '附着成功率：42%，硬控基础78% - 属性差36%（夹具免疫），检定99 > 42，未通过',
          driverAttr: '精神力',
          failureReason: 'state_immune',
        },
      });
      const eventLedger = combatData.__battleEventLedger || [];
      const publicReportBlocks = 构建事件账本公开战报Blocks(eventLedger, 8, { combatData });
      return {
        result: {
          preview: true,
          mode: 'battle_preview',
          battleMode: 'state_immune_closure',
          modeLabel: '状态免疫闭环',
          roundsExecuted: 1,
          battleOutcome: { type: '未分胜负', label: '状态免疫闭环' },
          publicReportBlocks,
          publicReport: publicReportBlocks.map(item => 序列化公开战报Blocks(item?.blocks || [])).filter(Boolean).join('\n'),
          combatData,
          resolutionTrace: combatData.__battleResolutionTrace || [],
          eventLedger,
        },
        combatData,
        玩家,
        敌人,
      };
    }

    function 生成普通召唤协同攻击调试结果() {
      const { combatData, 宿主, 敌人, 召唤单位 } = 构建召唤夹具战斗态({
        类型: '其他召唤生物',
        名称: '唤影小兽',
        行动模式: '协同攻击',
        强度: 1.4,
      });
      combatData.回合 = 2;
      const 宿主技能 = 战斗回归输出魂技('裂地冲拳', '敌方单体', 8, 96, '近身攻击');
      const 宿主伤害 = 96;
      const 玩家起手事件 = BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'action_start',
        round: 2,
        actorName: 宿主.name || 宿主.名称 || '',
        targetName: 敌人.name || 敌人.名称 || '',
        actionName: '裂地冲拳',
        actionType: 'attack',
        result: 'declared',
      });
      applyResolvedDamagePackage(宿主, { action_type: '释放魂技', type: '释放魂技', skill: 宿主技能 }, {
        targetResults: [{ target: 敌人, targetName: 敌人.name || 敌人.名称, damage: 宿主伤害, kind: 'primary' }],
        dmg: 宿主伤害,
        totalProjectedDamage: 宿主伤害,
      }, { primaryTarget: 敌人, combatData });
      const 协同日志 = 执行协同召唤追击(宿主, 敌人, 宿主伤害, combatData);
      const eventLedger = combatData.__battleEventLedger || [];
      const publicReportBlocks = 构建事件账本公开战报Blocks(eventLedger, 8, { combatData });
      return {
        result: {
          preview: true,
          intentText: '宿主造成有效伤害后观察普通召唤物协同追击。',
          mode: 'battle_preview',
          battleMode: 'summon_assist_closure',
          modeLabel: '普通召唤物协同攻击闭环',
          intentMode: '点到为止',
          logs: [协同日志].filter(Boolean),
          roundsExecuted: 2,
          battleOutcome: { type: '未分胜负', label: '普通召唤物协同攻击闭环' },
          publicReportBlocks,
          publicReport: publicReportBlocks.map(item => 序列化公开战报Blocks(item?.blocks || [])).filter(Boolean).join('\n'),
          combatData,
          decisionTrace: BATTLE_RUNTIME.collectDecisionTrace(combatData),
          resolutionTrace: combatData.__battleResolutionTrace || [],
          eventLedger,
        },
        combatData,
        宿主,
        敌人,
        召唤单位,
      };
    }

    function 生成多召唤协同攻击调试结果() {
      const { combatData, 宿主, 敌人, 召唤单位 } = 构建召唤夹具战斗态({
        类型: '其他召唤生物',
        名称: '唤影小兽甲',
        行动模式: '协同攻击',
        强度: 1.1,
      });
      const 第二状态 = {
        类型: 'buff',
        层数: 1,
        duration: 3,
        状态效果: {},
        战斗效果: createEmptyCombatEffectMap(),
        召唤物: {
          召唤单位类型: '其他召唤生物',
          召唤物名称: '唤影小兽乙',
          召唤数量: 1,
          行动模式: '协同攻击',
          强度: 1.2,
        },
      };
      宿主.状态效果['召唤:唤影小兽乙'] = 第二状态;
      const 第二单位 = 注册召唤运行态单位(combatData, 宿主, '召唤:唤影小兽乙', 第二状态);
      combatData.回合 = 2;
      const 宿主技能 = 战斗回归输出魂技('裂地冲拳', '敌方单体', 8, 88, '近身攻击');
      const 宿主伤害 = 88;
      BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'action_start',
        round: 2,
        actorName: 宿主.name || 宿主.名称 || '',
        targetName: 敌人.name || 敌人.名称 || '',
        actionName: '裂地冲拳',
        actionType: 'attack',
        result: 'declared',
      });
      applyResolvedDamagePackage(宿主, { action_type: '释放魂技', type: '释放魂技', skill: 宿主技能 }, {
        targetResults: [{ target: 敌人, targetName: 敌人.name || 敌人.名称, damage: 宿主伤害, kind: 'primary' }],
        dmg: 宿主伤害,
        totalProjectedDamage: 宿主伤害,
      }, { primaryTarget: 敌人, combatData });
      const 协同日志 = 执行协同召唤追击(宿主, 敌人, 宿主伤害, combatData);
      const eventLedger = combatData.__battleEventLedger || [];
      const publicReportBlocks = 构建事件账本公开战报Blocks(eventLedger, 8, { combatData });
      return {
        result: {
          preview: true,
          intentText: '宿主造成有效伤害后观察多只普通召唤物协同追击。',
          mode: 'battle_preview',
          battleMode: 'multi_summon_assist_closure',
          modeLabel: '多召唤物协同攻击闭环',
          intentMode: '点到为止',
          logs: [协同日志].filter(Boolean),
          roundsExecuted: 2,
          battleOutcome: { type: '未分胜负', label: '多召唤物协同攻击闭环' },
          publicReportBlocks,
          publicReport: publicReportBlocks.map(item => 序列化公开战报Blocks(item?.blocks || [])).filter(Boolean).join('\n'),
          combatData,
          decisionTrace: BATTLE_RUNTIME.collectDecisionTrace(combatData),
          resolutionTrace: combatData.__battleResolutionTrace || [],
          eventLedger,
        },
        combatData,
        宿主,
        敌人,
        召唤单位,
        第二单位,
      };
    }

    function 生成团战召唤行动轴调试结果() {
      const { combatData, 宿主, 敌人, 召唤单位 } = 构建召唤夹具战斗态({
        类型: '分身',
        名称: '团战影蛇分身',
        行动模式: '自主行动',
        继承属性比例: 0.45,
      });
      combatData.回合 = 2;
      combatData.战斗类型 = '团战召唤行动轴夹具';
      召唤单位.创建回合 = 1;
      召唤单位.行动模式 = '自主行动';
      const queue = generateActionQueue(combatData);
      const declarationLogs = [];
      记录团战行动轴声明(queue, combatData, declarationLogs);
      const summonEntry = queue.find(entry => entry?.char?.召唤键 === 召唤单位.召唤键);
      const turnResult = summonEntry ? runActorTurn(summonEntry, { combatData }) : null;
      const eventLedger = combatData.__battleEventLedger || [];
      const publicReportBlocks = 构建事件账本公开战报Blocks(eventLedger, 8, { combatData });
      return {
        result: {
          preview: true,
          intentText: '团战行动轴纳入自主行动召唤物并走同源结算。',
          mode: 'battle_preview',
          battleMode: 'team_summon_action_axis',
          modeLabel: '团战召唤物行动轴闭环',
          intentMode: '点到为止',
          logs: [...declarationLogs, turnResult?.log].filter(Boolean),
          roundsExecuted: 2,
          battleOutcome: { type: '未分胜负', label: '团战召唤物行动轴闭环' },
          publicReportBlocks,
          publicReport: publicReportBlocks.map(item => 序列化公开战报Blocks(item?.blocks || [])).filter(Boolean).join('\n'),
          combatData,
          decisionTrace: BATTLE_RUNTIME.collectDecisionTrace(combatData),
          resolutionTrace: combatData.__battleResolutionTrace || [],
          eventLedger,
          queueActors: queue.map(entry => ({
            name: entry?.char?.name || entry?.char?.名称 || '',
            side: entry?.side || '',
            isSummon: !!entry?.char?.召唤键,
            declaredActionName: normalizeBattleActionDisplayName(entry?.__declaredActionName || ''),
            declaredTargetName: String(entry?.__declaredTargetName || '').trim(),
          })),
          summonTurnResult: turnResult,
        },
        combatData,
        宿主,
        敌人,
        召唤单位,
        queue,
        turnResult,
      };
    }

    function 生成自动行动起手闭环调试结果() {
      const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
      combatData.回合 = 1;
      combatData.战斗类型 = '自动行动起手闭环夹具';
      玩家.type = '强攻系';
      玩家.第1武魂 ||= { 表象名称: '夹具武魂' };
      玩家.第1武魂.第1魂环 ||= {};
      玩家.第1武魂.第1魂环.第1魂技 = 战斗回归输出魂技('自动强攻', '敌方单体', 8, 72, '近身攻击');
      const queue = generateActionQueue(combatData);
      const declarationLogs = [];
      记录团战行动轴声明(queue, combatData, declarationLogs);
      const actorEntry = queue.find(entry => !entry?.char?.召唤键 && entry?.char === 玩家) || queue.find(entry => !entry?.char?.召唤键);
      const turnResult = actorEntry ? runActorTurn(actorEntry, { combatData }) : null;
      const eventLedger = combatData.__battleEventLedger || [];
      const publicReportBlocks = 构建事件账本公开战报Blocks(eventLedger, 8, { combatData });
      return {
        result: {
          preview: true,
          intentText: '自动行动必须在执行前写入 action_start 并进入 action_decision trace。',
          mode: 'battle_preview',
          battleMode: 'auto_actor_action_start',
          modeLabel: '自动行动起手闭环',
          intentMode: '点到为止',
          logs: [...declarationLogs, turnResult?.log].filter(Boolean),
          roundsExecuted: 1,
          battleOutcome: { type: '未分胜负', label: '自动行动起手闭环' },
          publicReportBlocks,
          publicReport: publicReportBlocks.map(item => 序列化公开战报Blocks(item?.blocks || [])).filter(Boolean).join('\n'),
          combatData,
          decisionTrace: BATTLE_RUNTIME.collectDecisionTrace(combatData),
          resolutionTrace: combatData.__battleResolutionTrace || [],
          eventLedger,
          queueActors: queue.map(entry => ({
            name: entry?.char?.name || entry?.char?.名称 || '',
            side: entry?.side || '',
            isSummon: !!entry?.char?.召唤键,
            declaredActionName: normalizeBattleActionDisplayName(entry?.__declaredActionName || ''),
            declaredTargetName: String(entry?.__declaredTargetName || '').trim(),
          })),
          actorName: actorEntry?.char?.name || actorEntry?.char?.名称 || '',
          turnResult,
        },
        combatData,
        玩家,
        敌人,
        queue,
        turnResult,
      };
    }

    function 生成保底资源回稳调试结果() {
      const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
      combatData.回合 = 5;
      combatData.战斗类型 = '保底资源回稳夹具';
      玩家.sp = 0;
      玩家.魂力 = 0;
      玩家.sta = 0;
      玩家.vit = 0;
      玩家.体力 = 0;
      玩家.属性 ||= {};
      玩家.属性.sp = 0;
      玩家.属性.魂力 = 0;
      玩家.属性.sta = 0;
      玩家.属性.vit = 0;
      玩家.属性.体力 = 0;
      BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'blocked_action',
        round: 5,
        actorName: 玩家.name,
        targetName: 敌人.name,
        actionName: '战术待机',
        actionType: '战术待机',
        result: 'no_effect',
        failReason: '夹具玩家的【战术待机】稳住身位',
        primaryOutcome: 'no_effect',
        meta: {
          source: 'auto_actor',
          reasonCode: 'NO_EFFECTIVE_OPENING',
          reasonText: '绝对保底动作',
        },
      });
      const eventLedger = combatData.__battleEventLedger || [];
      const runtimeSnapshot = 补水战斗运行态(combatData, eventLedger, { source: 'fallback_resource_fixture' });
      const publicReportBlocks = 构建事件账本公开战报Blocks(eventLedger, 8, { combatData });
      return {
        result: {
          preview: true,
          mode: 'battle_preview',
          battleMode: 'fallback_resource_recovery',
          modeLabel: '保底资源回稳',
          roundsExecuted: 5,
          battleOutcome: { type: '未分胜负', label: '保底资源回稳' },
          publicReportBlocks,
          publicReport: publicReportBlocks.map(item => 序列化公开战报Blocks(item?.blocks || [])).filter(Boolean).join('\n'),
          combatData,
          resolutionTrace: combatData.__battleResolutionTrace || [],
          eventLedger,
          runtimeSnapshot: BATTLE_RUNTIME.cloneAuditSnapshot(runtimeSnapshot),
        },
        combatData,
        玩家,
        敌人,
      };
    }

    function 生成非敌对动作不触发反应调试结果() {
      const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
      combatData.回合 = 1;
      combatData.战斗类型 = '非敌对反应过滤夹具';
      const 起手 = BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'action_start',
        round: 1,
        actorName: 玩家.name,
        targetName: 玩家.name,
        actionName: '香喷喷牛肉干',
        actionType: '造物承载',
        result: 'declared',
        primaryOutcome: 'item_created',
        meta: {
          isHostile: false,
          reasonCode: 'ACTION_COMMITTED',
          reasonText: '非敌对造物动作不打开常规反应窗口',
        },
      });
      BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'create',
        round: 1,
        actorName: 玩家.name,
        targetName: 玩家.name,
        actionName: '香喷喷牛肉干',
        actionType: '造物承载',
        sourceActionName: '香喷喷牛肉干',
        sourceActionId: 起手?.actionId || '',
        sourceNodeId: 起手?.chainNodeId || '',
        result: 'created',
        primaryOutcome: 'item_created',
        createdName: '香喷喷牛肉干',
        count: 1,
        meta: {
          isHostile: false,
          createdName: '香喷喷牛肉干',
          count: 1,
          reasonCode: 'ACTION_COMMITTED',
        },
      });
      const eventLedger = combatData.__battleEventLedger || [];
      const publicReportBlocks = 构建事件账本公开战报Blocks(eventLedger, 8, { combatData });
      return {
        result: {
          preview: true,
          mode: 'battle_preview',
          battleMode: 'non_hostile_reaction_filter',
          modeLabel: '非敌对反应过滤',
          roundsExecuted: 1,
          battleOutcome: { type: '未分胜负', label: '非敌对反应过滤' },
          publicReportBlocks,
          publicReport: publicReportBlocks.map(item => 序列化公开战报Blocks(item?.blocks || [])).filter(Boolean).join('\n'),
          combatData,
          resolutionTrace: combatData.__battleResolutionTrace || [],
          eventLedger,
        },
        combatData,
        玩家,
        敌人,
      };
    }

    function 生成目标池硬规则调试结果() {
      const { combatData } = 构建战斗回归夹具战斗态();
      combatData.回合 = 1;
      combatData.战斗类型 = '目标池硬规则夹具';
      const 攻击者 = 构建战斗回归夹具单位('夹具敌方刺客', '敏攻系');
      const 嘲讽者 = 构建战斗回归夹具单位('夹具嘲讽肉盾', '防御系');
      const 隐匿者 = 构建战斗回归夹具单位('夹具隐匿刺客', '敏攻系');
      攻击者.状态效果 ||= {};
      攻击者.状态效果.被嘲讽 = {
        类型: 'debuff',
        状态名称: '嘲讽',
        强制目标名: 嘲讽者.name,
        duration: 1,
      };
      隐匿者.状态效果 ||= {};
      隐匿者.状态效果.隐匿 = {
        类型: 'buff',
        状态名称: '隐匿',
        战斗效果: { stealth_level: 1, 探查屏蔽: false },
        duration: 1,
      };
      攻击者.men = 100;
      攻击者.men_max = 100;
      隐匿者.men = 1000;
      隐匿者.men_max = 1000;
      const 单体技能 = 战斗回归输出魂技('锁定打击', '敌方单体', 8, 72, '近身攻击');
      const 嘲讽索敌 = findTarget(攻击者, [隐匿者, 嘲讽者], combatData);
      delete 攻击者.状态效果.被嘲讽;
      const 隐匿过滤索敌 = chooseEnemyTargetForSkill(攻击者, [隐匿者, 嘲讽者], 单体技能, null, combatData);
      const eventLedger = combatData.__battleEventLedger || [];
      const publicReportBlocks = 构建事件账本公开战报Blocks(eventLedger, 8, { combatData });
      return {
        result: {
          preview: true,
          mode: 'battle_preview',
          battleMode: 'target_pool_hard_rules',
          modeLabel: '目标池硬规则',
          roundsExecuted: 1,
          battleOutcome: { type: '未分胜负', label: '目标池硬规则' },
          publicReportBlocks,
          publicReport: publicReportBlocks.map(item => 序列化公开战报Blocks(item?.blocks || [])).filter(Boolean).join('\n'),
          combatData,
          resolutionTrace: combatData.__battleResolutionTrace || [],
          eventLedger,
          targetRuleSnapshot: {
            tauntSelected: 嘲讽索敌?.name || 嘲讽索敌?.名称 || '',
            stealthFilteredSelected: 隐匿过滤索敌?.name || 隐匿过滤索敌?.名称 || '',
            tauntName: 嘲讽者.name,
            stealthName: 隐匿者.name,
          },
        },
        combatData,
        攻击者,
        嘲讽者,
        隐匿者,
      };
    }

    function 生成上限拦截调试结果() {
      const { combatData, 玩家 } = 构建战斗回归夹具战斗态();
      combatData.回合 = 1;
      combatData.战斗类型 = '上限拦截夹具';
      BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'failed_action',
        round: 1,
        actorName: 玩家.name,
        targetName: 玩家.name,
        actionName: '影蛇分身',
        actionType: '召唤生成',
        result: 'fail',
        failReason: '造物已达上限',
        reasonCode: 'CAP_REACHED',
        primaryOutcome: 'cap_reached',
        meta: {
          reasonCode: 'CAP_REACHED',
          primaryOutcome: 'cap_reached',
          summonName: '影蛇分身',
          summonType: '分身',
          currentCount: 2,
          cap: 2,
        },
      });
      const eventLedger = combatData.__battleEventLedger || [];
      const publicReportBlocks = 构建事件账本公开战报Blocks(eventLedger, 8, { combatData });
      return {
        result: {
          preview: true,
          mode: 'battle_preview',
          battleMode: 'cap_reached',
          modeLabel: '上限拦截',
          roundsExecuted: 1,
          battleOutcome: { type: '未分胜负', label: '上限拦截' },
          publicReportBlocks,
          publicReport: publicReportBlocks.map(item => 序列化公开战报Blocks(item?.blocks || [])).filter(Boolean).join('\n'),
          combatData,
          resolutionTrace: combatData.__battleResolutionTrace || [],
          eventLedger,
        },
        combatData,
        玩家,
      };
    }

    function 生成状态生命周期规则调试结果() {
      const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
      combatData.回合 = 1;
      combatData.战斗类型 = '状态生命周期规则夹具';
      玩家.状态效果 ||= {};
      玩家.状态效果.专注 = {
        类型: 'buff',
        状态名称: '专注',
        duration: 1,
        战斗效果: { ...createEmptyCombatEffectMap(), cast_speed_bonus: 0.05 },
      };
      玩家.状态效果.凝滞 = {
        类型: 'debuff',
        状态名称: '凝滞',
        duration: 2,
        战斗效果: { ...createEmptyCombatEffectMap(), cast_speed_penalty: 0.08 },
      };
      const 起手 = BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'action_start',
        round: 1,
        actorName: 玩家.name,
        actorSide: 'player',
        targetName: 玩家.name,
        actionName: '状态调律',
        actionType: '辅助',
        result: 'declared',
        primaryOutcome: 'action_committed',
      });
      BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'state_replace',
        round: 1,
        actorName: 玩家.name,
        actorSide: 'player',
        targetName: 玩家.name,
        actionName: '状态调律',
        actionType: 'state_replace',
        sourceActionName: '状态调律',
        sourceActionId: 起手?.actionId || '',
        result: 'refresh',
        primaryOutcome: 'state_refresh',
        duration: 3,
        calculationTrace: [
          ['stateName', '专注'],
          ['stackMode', 'refresh_duration'],
          ['previousDuration', 1],
          ['nextDuration', 3],
        ],
        meta: {
          stateName: '专注',
          previousDuration: 1,
          nextDuration: 3,
          calculationTrace: [
            ['stateName', '专注'],
            ['stackMode', 'refresh_duration'],
            ['previousDuration', 1],
            ['nextDuration', 3],
          ],
          stackMode: 'refresh_duration',
          replaceReason: 'same_state_refresh_duration',
        },
      });
      BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'state_remove',
        round: 1,
        actorName: 玩家.name,
        actorSide: 'player',
        targetName: 玩家.name,
        actionName: '状态调律',
        actionType: 'state_remove',
        sourceActionName: '状态调律',
        sourceActionId: 起手?.actionId || '',
        result: 'removed',
        primaryOutcome: 'state_remove',
        calculationTrace: [
          ['stateName', '凝滞'],
          ['stackMode', 'cleanse_or_dispel'],
          ['previousDuration', 2],
          ['nextDuration', 0],
        ],
        meta: {
          stateName: '凝滞',
          removedStates: ['凝滞'],
          calculationTrace: [
            ['stateName', '凝滞'],
            ['stackMode', 'cleanse_or_dispel'],
            ['previousDuration', 2],
            ['nextDuration', 0],
          ],
          stackMode: 'cleanse_or_dispel',
          replaceReason: 'state_remove_effect',
          previousDuration: 2,
          nextDuration: 0,
        },
      });
      const eventLedger = combatData.__battleEventLedger || [];
      const publicReportBlocks = 构建事件账本公开战报Blocks(eventLedger, 8, { combatData });
      return {
        result: {
          preview: true,
          mode: 'battle_preview',
          battleMode: 'state_lifecycle_rules',
          modeLabel: '状态生命周期规则',
          roundsExecuted: 1,
          battleOutcome: { type: '未分胜负', label: '状态生命周期规则' },
          publicReportBlocks,
          publicReport: publicReportBlocks.map(item => 序列化公开战报Blocks(item?.blocks || [])).filter(Boolean).join('\n'),
          combatData,
          resolutionTrace: combatData.__battleResolutionTrace || [],
          eventLedger,
          turnResult: null,
        },
        combatData,
        玩家,
        敌人,
      };
    }

    function 生成预声明目标丢失调试结果() {
      const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
      combatData.回合 = 1;
      combatData.战斗类型 = '预声明目标丢失夹具';
      玩家.type = '强攻系';
      玩家.第1武魂 ||= { 表象名称: '夹具武魂' };
      玩家.第1武魂.第1魂环 ||= {};
      玩家.第1武魂.第1魂环.第1魂技 = 战斗回归输出魂技('预声明强攻', '敌方单体', 8, 72, '近身攻击');
      const 替补敌人 = 构建战斗回归夹具单位('替补敌人', '防御系');
      combatData.参战者.team_enemy = [敌人, 替补敌人];
      const queue = generateActionQueue(combatData);
      const declarationLogs = [];
      记录团战行动轴声明(queue, combatData, declarationLogs);
      const actorEntry = queue.find(entry => !entry?.char?.召唤键 && entry?.char === 玩家) || queue.find(entry => !entry?.char?.召唤键);
      const declaredTargetName = String(actorEntry?.__declaredTargetName || '').trim();
      if (declaredTargetName && isSameBattleReportName(declaredTargetName, 敌人.name || 敌人.名称 || '')) {
        设置战斗血量值(敌人, 0);
      } else if (declaredTargetName && isSameBattleReportName(declaredTargetName, 替补敌人.name || 替补敌人.名称 || '')) {
        设置战斗血量值(替补敌人, 0);
      }
      const turnResult = actorEntry ? runActorTurn(actorEntry, { combatData }) : null;
      const eventLedger = combatData.__battleEventLedger || [];
      const publicReportBlocks = 构建事件账本公开战报Blocks(eventLedger, 8, { combatData });
      return {
        result: {
          preview: true,
          intentText: '预声明目标在行动前失效时必须显式闭合为目标丢失，而不是静默换靶。',
          mode: 'battle_preview',
          battleMode: 'declared_target_lost',
          modeLabel: '预声明目标丢失闭环',
          intentMode: '点到为止',
          logs: [...declarationLogs, turnResult?.log].filter(Boolean),
          roundsExecuted: 1,
          battleOutcome: { type: '未分胜负', label: '预声明目标丢失闭环' },
          publicReportBlocks,
          publicReport: publicReportBlocks.map(item => 序列化公开战报Blocks(item?.blocks || [])).filter(Boolean).join('\n'),
          combatData,
          decisionTrace: BATTLE_RUNTIME.collectDecisionTrace(combatData),
          resolutionTrace: combatData.__battleResolutionTrace || [],
          eventLedger,
          queueActors: queue.map(entry => ({
            name: entry?.char?.name || entry?.char?.名称 || '',
            side: entry?.side || '',
            isSummon: !!entry?.char?.召唤键,
            declaredActionName: normalizeBattleActionDisplayName(entry?.__declaredActionName || ''),
            declaredTargetName: String(entry?.__declaredTargetName || '').trim(),
          })),
          actorName: actorEntry?.char?.name || actorEntry?.char?.名称 || '',
          declaredTargetName,
          turnResult,
        },
        combatData,
        玩家,
        敌人,
        替补敌人,
        queue,
        turnResult,
      };
    }

    function 生成多宿主召唤协同调试结果() {
      const { combatData, 宿主, 敌人, 召唤单位 } = 构建召唤夹具战斗态({
        类型: '其他召唤生物',
        名称: '宿主甲影兽',
        行动模式: '协同攻击',
        强度: 1.05,
      });
      宿主.name = '夹具宿主甲';
      宿主.名称 = '夹具宿主甲';
      召唤单位.宿主名 = '夹具宿主甲';
      召唤单位.__宿主 = 宿主;
      const 宿主乙 = 构建召唤夹具单位('夹具宿主乙', '玩家');
      combatData.参战者.team_player.push(宿主乙);
      const 乙状态键 = '召唤:宿主乙影兽';
      const 乙状态 = {
        类型: 'buff',
        层数: 1,
        duration: 3,
        状态效果: {},
        战斗效果: createEmptyCombatEffectMap(),
        召唤物: {
          召唤单位类型: '其他召唤生物',
          召唤物名称: '宿主乙影兽',
          召唤数量: 1,
          行动模式: '协同攻击',
          强度: 1.15,
        },
      };
      宿主乙.状态效果[乙状态键] = 乙状态;
      const 乙召唤单位 = 注册召唤运行态单位(combatData, 宿主乙, 乙状态键, 乙状态);
      combatData.回合 = 2;
      const 甲技能 = 战斗回归输出魂技('裂地冲拳', '敌方单体', 8, 84, '近身攻击');
      const 乙技能 = 战斗回归输出魂技('穿影击', '敌方单体', 8, 72, '近身攻击');
      BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'action_start',
        round: 2,
        actorName: 宿主.name || 宿主.名称 || '',
        targetName: 敌人.name || 敌人.名称 || '',
        actionName: '裂地冲拳',
        actionType: 'attack',
        result: 'declared',
      });
      applyResolvedDamagePackage(宿主, { action_type: '释放魂技', type: '释放魂技', skill: 甲技能 }, {
        targetResults: [{ target: 敌人, targetName: 敌人.name || 敌人.名称, damage: 84, kind: 'primary' }],
        dmg: 84,
        totalProjectedDamage: 84,
      }, { primaryTarget: 敌人, combatData });
      const 甲协同日志 = 执行协同召唤追击(宿主, 敌人, 84, combatData);
      BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'action_start',
        round: 2,
        actorName: 宿主乙.name || 宿主乙.名称 || '',
        targetName: 敌人.name || 敌人.名称 || '',
        actionName: '穿影击',
        actionType: 'attack',
        result: 'declared',
      });
      applyResolvedDamagePackage(宿主乙, { action_type: '释放魂技', type: '释放魂技', skill: 乙技能 }, {
        targetResults: [{ target: 敌人, targetName: 敌人.name || 敌人.名称, damage: 72, kind: 'primary' }],
        dmg: 72,
        totalProjectedDamage: 72,
      }, { primaryTarget: 敌人, combatData });
      const 乙协同日志 = 执行协同召唤追击(宿主乙, 敌人, 72, combatData);
      const eventLedger = combatData.__battleEventLedger || [];
      const publicReportBlocks = 构建事件账本公开战报Blocks(eventLedger, 8, { combatData });
      return {
        result: {
          preview: true,
          intentText: '两个宿主分别造成有效伤害后观察各自召唤物协同追击归属。',
          mode: 'battle_preview',
          battleMode: 'multi_host_summon_assist_closure',
          modeLabel: '多宿主召唤协同闭环',
          intentMode: '点到为止',
          logs: [甲协同日志, 乙协同日志].filter(Boolean),
          roundsExecuted: 2,
          battleOutcome: { type: '未分胜负', label: '多宿主召唤协同闭环' },
          publicReportBlocks,
          publicReport: publicReportBlocks.map(item => 序列化公开战报Blocks(item?.blocks || [])).filter(Boolean).join('\n'),
          combatData,
          decisionTrace: BATTLE_RUNTIME.collectDecisionTrace(combatData),
          resolutionTrace: combatData.__battleResolutionTrace || [],
          eventLedger,
        },
        combatData,
        宿主甲: 宿主,
        宿主乙,
        敌人,
        甲召唤单位: 召唤单位,
        乙召唤单位,
      };
    }

    function 生成敌我双方召唤协同调试结果() {
      const { combatData, 宿主, 敌人, 召唤单位 } = 构建召唤夹具战斗态({
        类型: '其他召唤生物',
        名称: '玩家影兽',
        行动模式: '协同攻击',
        强度: 1.05,
      });
      宿主.name = '玩家宿主';
      宿主.名称 = '玩家宿主';
      敌人.name = '敌方宿主';
      敌人.名称 = '敌方宿主';
      宿主.agi = 0;
      敌人.agi = 0;
      宿主.final = buildCombatFinalStats(宿主);
      敌人.final = buildCombatFinalStats(敌人);
      召唤单位.宿主名 = '玩家宿主';
      召唤单位.__宿主 = 宿主;
      const 敌方状态键 = '召唤:敌方影兽';
      const 敌方状态 = {
        类型: 'buff',
        层数: 1,
        duration: 3,
        状态效果: {},
        战斗效果: createEmptyCombatEffectMap(),
        召唤物: {
          召唤单位类型: '其他召唤生物',
          召唤物名称: '敌方影兽',
          召唤数量: 1,
          行动模式: '协同攻击',
          强度: 1.1,
        },
      };
      敌人.状态效果[敌方状态键] = 敌方状态;
      const 敌方召唤单位 = 注册召唤运行态单位(combatData, 敌人, 敌方状态键, 敌方状态);
      combatData.回合 = 2;
      const 玩家技能 = 战斗回归输出魂技('裂地冲拳', '敌方单体', 8, 82, '近身攻击');
      const 敌方技能 = 战斗回归输出魂技('影刃反扑', '敌方单体', 8, 76, '近身攻击');
      const 玩家起手事件 = BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'action_start',
        round: 2,
        actorName: 宿主.name || 宿主.名称 || '',
        targetName: 敌人.name || 敌人.名称 || '',
        actionName: '裂地冲拳',
        actionType: 'attack',
        result: 'declared',
      });
      BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'pass',
        round: 2,
        actorName: 敌人.name || 敌人.名称 || '',
        targetName: 宿主.name || 宿主.名称 || '',
        actionName: '临场应对',
        actionType: 'reaction',
        sourceActionName: '裂地冲拳',
        sourceActionId: 玩家起手事件?.actionId || '',
        parentNodeId: 玩家起手事件?.chainNodeId || '',
        sourceNodeId: 玩家起手事件?.chainNodeId || '',
        result: 'reaction_failed',
        meta: { source: 'summon_assist_fixture_reaction', reasonCode: 'REACTION_FAILED', reasonText: '未形成有效应招动作' },
      });
      applyResolvedDamagePackage(宿主, { action_type: '释放魂技', type: '释放魂技', skill: 玩家技能 }, {
        targetResults: [{ target: 敌人, targetName: 敌人.name || 敌人.名称, damage: 82, kind: 'primary' }],
        dmg: 82,
        totalProjectedDamage: 82,
      }, { primaryTarget: 敌人, combatData });
      const 玩家协同日志 = 执行协同召唤追击(宿主, 敌人, 82, combatData);
      const 敌方起手事件 = BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'action_start',
        round: 2,
        actorName: 敌人.name || 敌人.名称 || '',
        targetName: 宿主.name || 宿主.名称 || '',
        actionName: '影刃反扑',
        actionType: 'attack',
        result: 'declared',
      });
      BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'pass',
        round: 2,
        actorName: 宿主.name || 宿主.名称 || '',
        targetName: 敌人.name || 敌人.名称 || '',
        actionName: '临场应对',
        actionType: 'reaction',
        sourceActionName: '影刃反扑',
        sourceActionId: 敌方起手事件?.actionId || '',
        parentNodeId: 敌方起手事件?.chainNodeId || '',
        sourceNodeId: 敌方起手事件?.chainNodeId || '',
        result: 'reaction_failed',
        meta: { source: 'summon_assist_fixture_reaction', reasonCode: 'REACTION_FAILED', reasonText: '未形成有效应招动作' },
      });
      applyResolvedDamagePackage(敌人, { action_type: '释放魂技', type: '释放魂技', skill: 敌方技能 }, {
        targetResults: [{ target: 宿主, targetName: 宿主.name || 宿主.名称, damage: 76, kind: 'primary' }],
        dmg: 76,
        totalProjectedDamage: 76,
      }, { primaryTarget: 宿主, combatData });
      const 敌方协同日志 = 执行协同召唤追击(敌人, 宿主, 76, combatData);
      const eventLedger = combatData.__battleEventLedger || [];
      const publicReportBlocks = 构建事件账本公开战报Blocks(eventLedger, 8, { combatData });
      return {
        result: {
          preview: true,
          intentText: '敌我双方宿主分别造成有效伤害后观察各自协同召唤物阵营归属。',
          mode: 'battle_preview',
          battleMode: 'opposing_side_summon_assist_closure',
          modeLabel: '敌我双方召唤协同闭环',
          intentMode: '点到为止',
          logs: [玩家协同日志, 敌方协同日志].filter(Boolean),
          roundsExecuted: 2,
          battleOutcome: { type: '未分胜负', label: '敌我双方召唤协同闭环' },
          publicReportBlocks,
          publicReport: publicReportBlocks.map(item => 序列化公开战报Blocks(item?.blocks || [])).filter(Boolean).join('\n'),
          combatData,
          decisionTrace: BATTLE_RUNTIME.collectDecisionTrace(combatData),
          resolutionTrace: combatData.__battleResolutionTrace || [],
          eventLedger,
        },
        combatData,
        玩家宿主: 宿主,
        敌方宿主: 敌人,
        玩家召唤单位: 召唤单位,
        敌方召唤单位,
      };
    }

    function 生成敌我双方自主召唤行动轴调试结果() {
      const 原随机 = Math.random;
      try {
        root.__LWCS_BATTLE_AUDIT_MARK__?.('opposing_summon_fixture:setup:start');
        let seed = 87321;
        Math.random = () => {
          seed = (seed * 233 + 7919) % 104729;
          return seed / 104729;
        };
        const { combatData, 宿主, 敌人, 召唤单位 } = 构建召唤夹具战斗态({
          类型: '分身',
          名称: '玩家自主影兽',
          行动模式: '自主行动',
          继承属性比例: 0.42,
        });
        root.__LWCS_BATTLE_AUDIT_MARK__?.('opposing_summon_fixture:base-state:done');
        宿主.name = '玩家宿主';
        宿主.名称 = '玩家宿主';
        敌人.name = '敌方宿主';
        敌人.名称 = '敌方宿主';
        召唤单位.name = '玩家自主影兽';
        召唤单位.名称 = '玩家自主影兽';
        召唤单位.宿主名 = '玩家宿主';
        召唤单位.__宿主 = 宿主;
        召唤单位.创建回合 = 1;
        宿主.is_controlled = true;
        敌人.is_controlled = true;
        const 玩家召唤记忆 = ensureActorDecisionMemory(召唤单位);
        玩家召唤记忆.focus_target = 敌人.name;
        玩家召唤记忆.focus_reason = 'shared_vision_focus';
        玩家召唤记忆.focus_ttl = 2;
        const 敌方状态键 = '召唤:敌方自主影兽';
        const 敌方状态 = {
          类型: 'buff',
          层数: 1,
          duration: 3,
          状态效果: {},
          战斗效果: createEmptyCombatEffectMap(),
          召唤物: {
            召唤单位类型: '分身',
            召唤物名称: '敌方自主影兽',
            召唤数量: 1,
            行动模式: '自主行动',
            继承属性比例: 0.4,
          },
        };
        敌人.状态效果[敌方状态键] = 敌方状态;
        const 敌方召唤单位 = 注册召唤运行态单位(combatData, 敌人, 敌方状态键, 敌方状态);
        root.__LWCS_BATTLE_AUDIT_MARK__?.('opposing_summon_fixture:enemy-summon:done');
        敌方召唤单位.创建回合 = 1;
        const 敌方召唤记忆 = ensureActorDecisionMemory(敌方召唤单位);
        敌方召唤记忆.focus_target = 宿主.name;
        敌方召唤记忆.focus_reason = 'shared_vision_focus';
        敌方召唤记忆.focus_ttl = 2;
        combatData.回合 = 2;
        combatData.战斗类型 = '敌我双方自主召唤行动轴夹具';
        root.__LWCS_BATTLE_AUDIT_MARK__?.('opposing_summon_fixture:queue:start');
        const queue = generateActionQueue(combatData);
        root.__LWCS_BATTLE_AUDIT_MARK__?.(`opposing_summon_fixture:queue:done count=${queue.length}`);
        const summonEntries = queue.filter(entry => ['玩家自主影兽', '敌方自主影兽'].includes(String(entry?.char?.name || entry?.char?.名称 || '').trim()));
        const declarationLogs = [];
        root.__LWCS_BATTLE_AUDIT_MARK__?.('opposing_summon_fixture:declarations:start');
        记录团战行动轴声明(summonEntries, combatData, declarationLogs);
        root.__LWCS_BATTLE_AUDIT_MARK__?.('opposing_summon_fixture:declarations:done');
        const turnResults = [];
        summonEntries.forEach(entry => {
          const actorName = String(entry?.char?.name || entry?.char?.名称 || '').trim();
          root.__LWCS_BATTLE_AUDIT_MARK__?.(`opposing_summon_turn:${actorName}:start`);
          const turnResult = runActorTurn(entry, { combatData });
          root.__LWCS_BATTLE_AUDIT_MARK__?.(`opposing_summon_turn:${actorName}:done`);
          if (turnResult) turnResults.push(turnResult);
        });
        const eventLedger = combatData.__battleEventLedger || [];
        const publicReportBlocks = 构建事件账本公开战报Blocks(eventLedger, 8, { combatData });
        return {
          result: {
            preview: true,
            intentText: '敌我双方自主行动召唤物进入团战行动轴并分别锁定敌对阵营。',
            mode: 'battle_preview',
            battleMode: 'opposing_side_summon_action_axis',
            modeLabel: '敌我双方自主召唤行动轴闭环',
            intentMode: '点到为止',
            logs: [...declarationLogs, ...turnResults.map(item => item?.log).filter(Boolean)],
            roundsExecuted: 2,
            battleOutcome: { type: '未分胜负', label: '敌我双方自主召唤行动轴闭环' },
            publicReportBlocks,
            publicReport: publicReportBlocks.map(item => 序列化公开战报Blocks(item?.blocks || [])).filter(Boolean).join('\n'),
            combatData,
            decisionTrace: BATTLE_RUNTIME.collectDecisionTrace(combatData),
            resolutionTrace: combatData.__battleResolutionTrace || [],
            eventLedger,
            queueActors: summonEntries.map(entry => ({
              name: entry?.char?.name || entry?.char?.名称 || '',
              side: entry?.side || '',
              isSummon: !!entry?.char?.召唤键,
              declaredActionName: normalizeBattleActionDisplayName(entry?.__declaredActionName || ''),
              declaredTargetName: String(entry?.__declaredTargetName || '').trim(),
            })),
            summonTurnResults: turnResults,
          },
          combatData,
          玩家宿主: 宿主,
          敌方宿主: 敌人,
          玩家召唤单位: 召唤单位,
          敌方召唤单位,
          queue: summonEntries,
          turnResults,
        };
      } finally {
        Math.random = 原随机;
      }
    }

    function 生成战斗判定样本文本(数量 = 100) {
      const 技能库 = [
        () => 构建战斗回归第一魂技(战斗回归第一魂技默认名, '魂力:120'),
        () => 战斗回归输出魂技('裂地冲拳', '敌方单体', 10, 88, '近身攻击'),
        () => 战斗回归输出魂技('流火散射', '敌方群体', 14, 96, '远程攻击'),
        () => normalizeSkillData({
          name: '毒牙牵制', 魂技名: '毒牙牵制', 技能分类: '输出', 目标: '敌方单体', 消耗: '魂力:60', 前摇: 8,
          _效果数组: [
            { 原型: '伤害结算', 目标: '单体', 生效方式: '独立生效', 威力倍率: 80, 伤害类型: '近身攻击' },
            { 原型: '状态施加', 目标: '单体', 生效方式: '跟随主原型', 状态: '中毒', 状态名称: '中毒', 持续回合: 2, 计算层效果: { dot_damage_ratio: 0.03 } },
          ],
        }, '毒牙牵制'),
        () => normalizeSkillData({
          name: '裂伤追咬', 魂技名: '裂伤追咬', 技能分类: '输出', 目标: '敌方单体', 消耗: '魂力:70', 前摇: 8,
          _效果数组: [
            { 原型: '伤害结算', 目标: '单体', 生效方式: '独立生效', 威力倍率: 90, 伤害类型: '近身攻击' },
            { 原型: '状态施加', 目标: '单体', 生效方式: '跟随主原型', 状态: '流血', 状态名称: '流血', 持续回合: 2, 计算层效果: { dot_damage: 80 } },
          ],
        }, '裂伤追咬'),
        () => normalizeSkillData({
          name: '锁魄印', 魂技名: '锁魄印', 技能分类: '控制', 目标: '敌方单体', 消耗: '魂力:80', 前摇: 10,
          _效果数组: [{ 原型: '状态施加', 目标: '单体', 状态: '位移限制', 状态名称: '位移限制', 持续回合: 1, 计算层效果: { cast_speed_penalty: 0.25, lock_level: 1 } }],
        }, '锁魄印'),
        () => normalizeSkillData({
          name: '第二魂技·青影蛇群', 魂技名: '第二魂技·青影蛇群', 技能分类: '控制', 目标: '敌方群体', 消耗: '魂力:140', 前摇: 12,
          _效果数组: [
            { 原型: '伤害结算', 目标: '群体', 生效方式: '独立生效', 威力倍率: 72, 伤害类型: '远程攻击', 命中修正: 0.12 },
            { 原型: '状态施加', 目标: '群体', 生效方式: '跟随主原型', 状态: '迟缓', 状态名称: '迟缓', 持续回合: 2, 计算层效果: { cast_speed_penalty: 0.18, dodge_penalty: 0.08 } },
          ],
        }, '第二魂技·青影蛇群'),
        () => normalizeSkillData({
          name: '香喷喷牛肉干', 魂技名: '香喷喷牛肉干', 技能分类: '辅助', 目标: '自身', 承载方式: '造物承载', 消耗: '魂力:50', 前摇: 6,
          _效果数组: [{ 数量: 1, 描述: '香喷喷牛肉干', 使用效果: [{ 原型: '资源变化', 目标: '自身', 资源: '体力', 数值: '+80' }] }],
        }, '香喷喷牛肉干'),
      ];
      const 原随机 = Math.random;
      const 块 = [];
      const 构建自然召唤闭环样本 = () => {
        const 结果 = 生成自然召唤闭环调试结果()?.result || {};
        return 导出战斗记录可见文本(结果, 'preview');
      };
      const 构建可信战术侧写样本 = () => {
        const 结果 = 生成可信战术侧写调试结果()?.result || {};
        return 导出战斗记录可见文本(结果, 'preview');
      };
      try {
        for (let index = 1; index <= Math.max(1, Number(数量 || 100)); index += 1) {
          let seed = index * 9301 + 49297;
          Math.random = () => {
            seed = (seed * 233 + 7919) % 104729;
            return seed / 104729;
          };
          const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
          const 技能 = 技能库[(index - 1) % 技能库.length]();
          玩家.第1武魂.第1魂环.第1魂技 = 技能;
          敌人.第1武魂 = {
            表象名称: '敌方夹具武魂',
            第1魂环: {
              第1魂技: 战斗回归输出魂技(战斗回归敌方快攻技能名, '敌方单体', 6, 88, '近身攻击'),
              第2魂技: 战斗回归输出魂技(战斗回归敌方压制技能名, '敌方单体', 10, 96, '近身攻击'),
            },
          };
          if (/第二魂技|青影蛇群/.test(String(技能.name || 技能.魂技名 || ''))) {
            玩家.第1武魂.第2魂环 ||= {};
            玩家.第1武魂.第2魂环.第2魂技 = 技能;
          }
          玩家.type = index % 5 === 0 ? '敏攻系' : '强攻系';
          敌人.type = '敏攻系';
          敌人.agi = index % 4 === 0 ? 980 : 220 + (index % 6) * 40;
          敌人.final = buildCombatFinalStats(敌人);
          if (index % 9 === 0) recordActorActionWhiffedByDodge(玩家, '普通攻击', 敌人);
          const entry = {
            actor_name: 玩家.name,
            action_type: '释放魂技',
            skill: { 魂技名: 技能.name || 技能.魂技名, name: 技能.name || 技能.魂技名, 消耗: 技能.消耗 || '无' },
            __魂环路径: /第二魂技|青影蛇群/.test(String(技能.name || 技能.魂技名 || '')) ? ['第1武魂', '第2魂环'] : ['第1武魂', '第1魂环'],
            __魂技槽位: /第二魂技|青影蛇群/.test(String(技能.name || 技能.魂技名 || '')) ? '第2魂技' : '第1魂技',
            target_name: /自身|友方|造物|食物|药剂|召唤/.test(String(技能.目标 || '') + String(技能.技能分类 || '') + String(技能.承载方式 || '')) ? 玩家.name : 敌人.name,
          };
          const 是召唤技能 = getSkillEffects(技能).some(effect => String(effect?.原型 || '').trim() === '召唤生成');
          let result = null;
          使用战斗回归桥接(combatData, { [玩家.name]: 玩家, 夹具友方: 构建战斗回归夹具单位('夹具友方', '辅助系'), [敌人.name]: 敌人 }, () => {
            result = onPlayerAttack(技能.name || 技能.魂技名, {
              dryRun: true,
              mode: !是召唤技能 && index % 6 === 0 ? 'multi_round' : 'single_round',
              combatData,
              actionDeclaration: 构建战斗回归动作声明(entry),
              intentMode: '点到为止',
              autoContinueConfig: { maxRounds: 4, stopDamagePercent: 100, continueChancePercent: 100 },
            });
          });
          const 可见文本 = 导出战斗记录可见文本(result, 'preview');
          块.push(`==================== 样本 ${String(index).padStart(3, '0')} ====================\n${可见文本.trim()}`);
        }
      } finally {
        Math.random = 原随机;
      }
      块.push(`==================== 样本 SUMMON_NATURAL ====================\n${构建自然召唤闭环样本().trim()}`);
      块.push(`==================== 样本 TRUSTED_TACTICAL_NARRATION ====================\n${构建可信战术侧写样本().trim()}`);
      return 块.join('\n\n');
    }

    function 生成战斗判定样本结果(索引 = 1) {
      const 技能库 = [
        () => 构建战斗回归第一魂技(战斗回归第一魂技默认名, '魂力:120'),
        () => 战斗回归输出魂技('裂地冲拳', '敌方单体', 10, 88, '近身攻击'),
        () => 战斗回归输出魂技('流火散射', '敌方群体', 14, 96, '远程攻击'),
        () => normalizeSkillData({
          name: '毒牙牵制', 魂技名: '毒牙牵制', 技能分类: '输出', 目标: '敌方单体', 消耗: '魂力:60', 前摇: 8,
          _效果数组: [
            { 原型: '伤害结算', 目标: '单体', 生效方式: '独立生效', 威力倍率: 80, 伤害类型: '近身攻击' },
            { 原型: '状态施加', 目标: '单体', 生效方式: '跟随主原型', 状态: '中毒', 状态名称: '中毒', 持续回合: 2, 计算层效果: { dot_damage_ratio: 0.03 } },
          ],
        }, '毒牙牵制'),
        () => normalizeSkillData({
          name: '裂伤追咬', 魂技名: '裂伤追咬', 技能分类: '输出', 目标: '敌方单体', 消耗: '魂力:70', 前摇: 8,
          _效果数组: [
            { 原型: '伤害结算', 目标: '单体', 生效方式: '独立生效', 威力倍率: 90, 伤害类型: '近身攻击' },
            { 原型: '状态施加', 目标: '单体', 生效方式: '跟随主原型', 状态: '流血', 状态名称: '流血', 持续回合: 2, 计算层效果: { dot_damage: 80 } },
          ],
        }, '裂伤追咬'),
        () => normalizeSkillData({
          name: '影蛇分身', 魂技名: '影蛇分身', 技能分类: '召唤', 目标: '自身', 消耗: '魂力:90 | 精神力:45', 前摇: 8,
          _效果数组: [{
            原型: '召唤生成', 目标: '自身', 生效方式: '独立生效', 召唤单位类型: '分身', 召唤物名称: '影蛇分身', 数量: 1, 持续回合: 3,
            继承属性比例: 0.42,
          }],
        }, '影蛇分身'),
        () => normalizeSkillData({
          name: '锁魄印', 魂技名: '锁魄印', 技能分类: '控制', 目标: '敌方单体', 消耗: '魂力:80', 前摇: 10,
          _效果数组: [{ 原型: '状态施加', 目标: '单体', 状态: '位移限制', 状态名称: '位移限制', 持续回合: 1, 计算层效果: { cast_speed_penalty: 0.25, lock_level: 1 } }],
        }, '锁魄印'),
        () => normalizeSkillData({
          name: '影蛇分身', 魂技名: '影蛇分身', 技能分类: '召唤', 目标: '自身', 消耗: '魂力:90 | 精神力:45', 前摇: 8,
          _效果数组: [{
            原型: '召唤生成', 目标: '自身', 生效方式: '独立生效', 召唤单位类型: '分身', 召唤物名称: '影蛇分身', 数量: 1, 持续回合: 3,
            继承属性比例: 0.42,
          }],
        }, '影蛇分身'),
        () => normalizeSkillData({
          name: '第二魂技·青影蛇群', 魂技名: '第二魂技·青影蛇群', 技能分类: '控制', 目标: '敌方群体', 消耗: '魂力:140', 前摇: 12,
          _效果数组: [
            { 原型: '伤害结算', 目标: '群体', 生效方式: '独立生效', 威力倍率: 72, 伤害类型: '远程攻击', 命中修正: 0.12 },
            { 原型: '状态施加', 目标: '群体', 生效方式: '跟随主原型', 状态: '迟缓', 状态名称: '迟缓', 持续回合: 2, 计算层效果: { cast_speed_penalty: 0.18, dodge_penalty: 0.08 } },
          ],
        }, '第二魂技·青影蛇群'),
        () => normalizeSkillData({
          name: '香喷喷牛肉干', 魂技名: '香喷喷牛肉干', 技能分类: '辅助', 目标: '自身', 承载方式: '造物承载', 消耗: '魂力:50', 前摇: 6,
          _效果数组: [{ 数量: 1, 描述: '香喷喷牛肉干', 使用效果: [{ 原型: '资源变化', 目标: '自身', 资源: '体力', 数值: '+80' }] }],
        }, '香喷喷牛肉干'),
      ];
      const index = Math.max(1, Math.floor(Number(索引 || 1)));
      const 原随机 = Math.random;
      try {
        let seed = index * 9301 + 49297;
        Math.random = () => {
          seed = (seed * 233 + 7919) % 104729;
          return seed / 104729;
        };
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        const 技能 = 技能库[(index - 1) % 技能库.length]();
        玩家.第1武魂.第1魂环.第1魂技 = 技能;
        敌人.第1武魂 = {
          表象名称: '敌方夹具武魂',
          第1魂环: {
            第1魂技: 战斗回归输出魂技(战斗回归敌方快攻技能名, '敌方单体', 6, 88, '近身攻击'),
            第2魂技: 战斗回归输出魂技(战斗回归敌方压制技能名, '敌方单体', 10, 96, '近身攻击'),
          },
        };
        if (/第二魂技|青影蛇群/.test(String(技能.name || 技能.魂技名 || ''))) {
          玩家.第1武魂.第2魂环 ||= {};
          玩家.第1武魂.第2魂环.第2魂技 = 技能;
        }
        玩家.type = index % 5 === 0 ? '敏攻系' : '强攻系';
        敌人.type = '敏攻系';
        敌人.agi = index % 4 === 0 ? 980 : 220 + (index % 6) * 40;
        敌人.final = buildCombatFinalStats(敌人);
        if (index % 9 === 0) recordActorActionWhiffedByDodge(玩家, '普通攻击', 敌人);
        const entry = {
          actor_name: 玩家.name,
          action_type: '释放魂技',
          skill: { 魂技名: 技能.name || 技能.魂技名, name: 技能.name || 技能.魂技名, 消耗: 技能.消耗 || '无' },
          __魂环路径: /第二魂技|青影蛇群/.test(String(技能.name || 技能.魂技名 || '')) ? ['第1武魂', '第2魂环'] : ['第1武魂', '第1魂环'],
          __魂技槽位: /第二魂技|青影蛇群/.test(String(技能.name || 技能.魂技名 || '')) ? '第2魂技' : '第1魂技',
          target_name: /自身|友方|造物|食物|药剂|召唤/.test(String(技能.目标 || '') + String(技能.技能分类 || '') + String(技能.承载方式 || '')) ? 玩家.name : 敌人.name,
        };
        let result = null;
        使用战斗回归桥接(combatData, { [玩家.name]: 玩家, 夹具友方: 构建战斗回归夹具单位('夹具友方', '辅助系'), [敌人.name]: 敌人 }, () => {
          result = onPlayerAttack(技能.name || 技能.魂技名, {
            dryRun: true,
            mode: index % 6 === 0 ? 'multi_round' : 'single_round',
            combatData,
            actionDeclaration: 构建战斗回归动作声明(entry),
            intentMode: '点到为止',
            autoContinueConfig: { maxRounds: 4, stopDamagePercent: 100, continueChancePercent: 100 },
          });
        });
        return { index, result, combatData, 玩家, 敌人 };
      } finally {
        Math.random = 原随机;
      }
    }

    function 生成可信战术侧写调试结果() {
      const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
      combatData.回合 = 1;
      combatData.战斗类型 = '可信战术侧写夹具';
      玩家.name = '唐凌雪';
      玩家.名称 = '唐凌雪';
      敌人.name = '韦小枫';
      敌人.名称 = '韦小枫';
      const actionEvent = BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'action_start',
        round: 1,
        actorName: 玩家.name,
        targetName: 敌人.name,
        actionName: '锁魄印',
        actionType: '释放魂技',
        targetScope: 'single',
        targetPoolSide: 'enemy',
        result: 'declared',
      });
      BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'state_apply',
        round: 1,
        actorName: 玩家.name,
        targetName: 敌人.name,
        actionName: '锁魄印',
        sourceActionName: '锁魄印',
        sourceActionId: actionEvent?.actionId || '',
        sourceNodeId: actionEvent?.chainNodeId || '',
        stateName: '位移限制',
        duration: 1,
        result: 'applied',
        primaryOutcome: 'state_applied',
        meta: {
          stateName: '位移限制',
          successRate: 100,
          successRateReason: '必中/无法抵抗',
          successRateBreakdown: '附着成功率：100%，必中/无法抵抗',
        },
      });
      记录行动闭环审计(combatData, '主动规划', {
        actionId: actionEvent?.actionId || '',
        回合: 1,
        行动者: 玩家.name,
        目标: 敌人.name,
        技能: '锁魄印',
        战略意图: 'CONTROL',
        目标理由: ['控制收益:位移限制可限制反扑'],
        候选来源: '主动候选结构化评分',
        原始权重: 70,
        战术修正: 22,
        目标修正: 18,
        最终权重: 110,
        选择原因: '结构化候选链锁定',
        hitCandidateName: '锁魄印',
        selectedCandidateName: '锁魄印',
        finalResolvedActionName: '锁魄印',
        目标语义: '敌方单体',
        承载方式: '释放魂技',
        候选排序结果: [
          {
            candidateId: 'trusted_lock_soul',
            candidateName: '锁魄印',
            名称: '锁魄印',
            score: 110,
            权重: 110,
            原始权重: 70,
            战术修正: 22,
            目标修正: 18,
            目标价值修正: 0,
            资源修正: 0,
            candidateStatus: 'EXECUTED',
            rejectionCode: '',
            effectTags: ['CONTROL_RESTRICTION'],
            candidateSource: 'ACTIVE_SCORER',
          },
          {
            candidateId: 'trusted_basic_attack',
            candidateName: '普通攻击',
            名称: '普通攻击',
            score: 96,
            权重: 96,
            原始权重: 70,
            战术修正: 8,
            目标修正: 18,
            目标价值修正: 0,
            资源修正: 0,
            candidateStatus: 'REJECTED',
            rejectionCode: 'CONTROL_GAP',
            effectTags: ['DIRECT_DAMAGE'],
            rejectedByEffectGap: 'CONTROL_RESTRICTION_GAP',
            candidateSource: 'ACTIVE_SCORER',
          },
        ],
      });
      const eventLedger = combatData.__battleEventLedger || [];
      const publicReportBlocks = 构建事件账本公开战报Blocks(eventLedger, 8, { combatData });
      return {
        result: {
          preview: true,
          intentText: '可信候选链生成 DM 战术侧写。',
          mode: 'battle_preview',
          battleMode: 'trusted_tactical_narration',
          modeLabel: '可信战术侧写闭环',
          intentMode: '点到为止',
          logs: [],
          roundsExecuted: 1,
          battleOutcome: { type: '未分胜负', label: '可信战术侧写闭环' },
          publicReportBlocks,
          publicReport: publicReportBlocks.map(item => 序列化公开战报Blocks(item?.blocks || [])).filter(Boolean).join('\n'),
          combatData,
          decisionTrace: BATTLE_RUNTIME.collectDecisionTrace(combatData),
          resolutionTrace: combatData.__battleResolutionTrace || [],
          eventLedger,
        },
        combatData,
        玩家,
        敌人,
      };
    }

    function 生成直攻压制战术侧写调试结果() {
      const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
      combatData.回合 = 1;
      combatData.战斗类型 = '直攻压制战术侧写夹具';
      玩家.name = '唐凌雪';
      玩家.名称 = '唐凌雪';
      敌人.name = '韦小枫';
      敌人.名称 = '韦小枫';
      const actionEvent = BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'action_start',
        round: 1,
        actorName: 玩家.name,
        targetName: 敌人.name,
        actionName: '裂地冲拳',
        actionType: '释放魂技',
        targetScope: 'single',
        targetPoolSide: 'enemy',
        result: 'declared',
      });
      BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'defend',
        round: 1,
        actorName: 敌人.name,
        targetName: 玩家.name,
        actionName: '承伤硬抗',
        sourceActionName: '裂地冲拳',
        sourceRound: 1,
        sourceActionId: actionEvent?.actionId || '',
        sourceNodeId: actionEvent?.chainNodeId || '',
        result: 'guarded',
        primaryOutcome: 'guarded',
        meta: {
          sourceActorName: 玩家.name,
          sourceActionName: '裂地冲拳',
          reactionType: 'defend',
          reactionOutcome: 'guarded',
        },
      });
      BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'hit_result',
        round: 1,
        actorName: 玩家.name,
        targetName: 敌人.name,
        actionName: '裂地冲拳',
        sourceActionName: '裂地冲拳',
        sourceActionId: actionEvent?.actionId || '',
        sourceNodeId: actionEvent?.chainNodeId || '',
        appliedDamage: 96,
        damage: 96,
        result: 'full_hit',
        primaryOutcome: 'full_hit',
        effectCapability: { hasDamageEffect: true, effectKinds: ['伤害结算'] },
        meta: {
          appliedDamage: 96,
          damage: 96,
          incomingDamage: 96,
          defenseThreshold: 0,
          actualDefense: 137,
          shieldAbsorb: 0,
          finalDamage: 96,
          damageType: '近身攻击',
          skillPower: 88,
          attackValue: 150,
          defenseValue: 137,
          baseDamage: 96,
          formulaAttackValue: 150,
          formulaDefenseValue: 137,
          formulaText: '威力88 × 攻势150 / 防守137',
          damageFormulaText: '伤害 = 威力88 × 攻势150 / 防守137 = 96',
          formulaTrace: {
            damageType: '近身攻击',
            skillPower: 88,
            attackValue: 150,
            defenseValue: 137,
            baseDamage: 96,
            formulaText: '威力88 × 攻势150 / 防守137',
          },
          settlementTrace: [
            { key: 'sourceAction', label: '来源动作', value: '裂地冲拳' },
            { key: 'attacker', label: '攻方', value: 玩家.name },
            { key: 'target', label: '目标', value: 敌人.name },
            { key: 'result', label: '结果', value: 'full_hit' },
            { key: 'incomingDamage', label: '入参伤害', value: 96 },
            { key: 'actualDefense', label: '有效防御', value: 137 },
            { key: 'defenseThreshold', label: '破防阈值', value: 0 },
            { key: 'shieldAbsorb', label: '护盾吸收', value: 0 },
            { key: 'finalDamage', label: '最终伤害', value: 96 },
          ],
        },
      });
      记录行动闭环审计(combatData, '主动规划', {
        actionId: actionEvent?.actionId || '',
        回合: 1,
        行动者: 玩家.name,
        目标: 敌人.name,
        技能: '裂地冲拳',
        战略意图: 'DIRECT_PRESSURE',
        目标理由: ['攻势收益:裂地冲拳能稳定推进战线'],
        候选来源: '主动候选结构化评分',
        原始权重: 72,
        战术修正: 18,
        目标修正: 16,
        最终权重: 106,
        选择原因: '结构化候选链锁定',
        hitCandidateName: '裂地冲拳',
        selectedCandidateName: '裂地冲拳',
        finalResolvedActionName: '裂地冲拳',
        目标语义: '敌方单体',
        承载方式: '释放魂技',
        候选排序结果: [
          {
            candidateId: 'trusted_direct_punch',
            candidateName: '裂地冲拳',
            名称: '裂地冲拳',
            score: 106,
            权重: 106,
            原始权重: 72,
            战术修正: 18,
            目标修正: 16,
            目标价值修正: 0,
            资源修正: 0,
            candidateStatus: 'EXECUTED',
            rejectionCode: '',
            effectTags: ['DIRECT_DAMAGE'],
            candidateSource: 'ACTIVE_SCORER',
          },
          {
            candidateId: 'trusted_probe',
            candidateName: '试探掌',
            名称: '试探掌',
            score: 92,
            权重: 92,
            原始权重: 68,
            战术修正: 10,
            目标修正: 14,
            目标价值修正: 0,
            资源修正: 0,
            candidateStatus: 'REJECTED',
            rejectionCode: 'DIRECT_PRESSURE_GAP',
            effectTags: ['DIRECT_DAMAGE'],
            rejectedByEffectGap: 'DIRECT_PRESSURE_GAP',
            candidateSource: 'ACTIVE_SCORER',
          },
        ],
      });
      const eventLedger = combatData.__battleEventLedger || [];
      const publicReportBlocks = 构建事件账本公开战报Blocks(eventLedger, 8, { combatData });
      return {
        result: {
          preview: true,
          intentText: '可信直攻压制候选链生成 DM 战术侧写。',
          mode: 'battle_preview',
          battleMode: 'trusted_direct_pressure_tactical_narration',
          modeLabel: '可信直攻压制侧写闭环',
          intentMode: '点到为止',
          logs: [],
          roundsExecuted: 1,
          battleOutcome: { type: '未分胜负', label: '可信直攻压制侧写闭环' },
          publicReportBlocks,
          publicReport: publicReportBlocks.map(item => 序列化公开战报Blocks(item?.blocks || [])).filter(Boolean).join('\n'),
          combatData,
          decisionTrace: BATTLE_RUNTIME.collectDecisionTrace(combatData),
          resolutionTrace: combatData.__battleResolutionTrace || [],
          eventLedger,
        },
        combatData,
        玩家,
        敌人,
      };
    }

    function 生成主导原因战术侧写调试结果(配置 = {}) {
      const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
      combatData.回合 = 1;
      combatData.战斗类型 = `${配置.label || '主导原因'}战术侧写夹具`;
      玩家.name = '唐凌雪';
      玩家.名称 = '唐凌雪';
      敌人.name = '韦小枫';
      敌人.名称 = '韦小枫';
      const finalAction = String(配置.finalAction || '定势一击').trim();
      const altAction = String(配置.altAction || '普通攻击').trim();
      const actionEvent = BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'action_start',
        round: 1,
        actorName: 玩家.name,
        targetName: 敌人.name,
        actionName: finalAction,
        actionType: '释放魂技',
        targetScope: 'single',
        targetPoolSide: 'enemy',
        result: 'declared',
      });
      if (配置.ledgerKind === 'shield') {
        BATTLE_RUNTIME.writeLedgerEvent(combatData, {
          eventKind: 'shield_create',
          round: 1,
          actorName: 玩家.name,
          targetName: '夹具友方',
          actionName: finalAction,
          sourceActionName: finalAction,
          sourceActionId: actionEvent?.actionId || '',
          sourceNodeId: actionEvent?.chainNodeId || '',
          result: 'shielded',
          meta: { amount: 120, shield: 120, sourceAction: finalAction },
        });
      } else {
        BATTLE_RUNTIME.writeLedgerEvent(combatData, {
          eventKind: 'defend',
          round: 1,
          actorName: 敌人.name,
          targetName: 玩家.name,
          actionName: '承伤硬抗',
          sourceActionName: finalAction,
          sourceRound: 1,
          sourceActionId: actionEvent?.actionId || '',
          sourceNodeId: actionEvent?.chainNodeId || '',
          result: 'guarded',
          primaryOutcome: 'guarded',
          meta: {
            sourceActorName: 玩家.name,
            sourceActionName: finalAction,
            reactionType: 'defend',
            reactionOutcome: 'guarded',
          },
        });
        BATTLE_RUNTIME.writeLedgerEvent(combatData, {
          eventKind: 'hit_result',
          round: 1,
          actorName: 玩家.name,
          targetName: 敌人.name,
          actionName: finalAction,
          sourceActionName: finalAction,
          sourceActionId: actionEvent?.actionId || '',
          sourceNodeId: actionEvent?.chainNodeId || '',
          appliedDamage: Number(配置.damage || 88),
          damage: Number(配置.damage || 88),
          result: 'full_hit',
          primaryOutcome: 'full_hit',
          effectCapability: { hasDamageEffect: true, effectKinds: ['伤害结算'] },
          meta: {
            appliedDamage: Number(配置.damage || 88),
            damage: Number(配置.damage || 88),
            finalDamage: Number(配置.damage || 88),
            damageFormulaText: `伤害 = 威力${Number(配置.power || 80)} × 攻势150 / 防守140 = ${Number(配置.damage || 88)}`,
            formulaTrace: {
              damageType: '魂技冲击',
              skillPower: Number(配置.power || 80),
              attackValue: 150,
              defenseValue: 140,
              baseDamage: Number(配置.damage || 88),
              formulaText: `威力${Number(配置.power || 80)} × 攻势150 / 防守140`,
            },
            settlementTrace: [
              { key: 'sourceAction', label: '来源动作', value: finalAction },
              { key: 'attacker', label: '攻方', value: 玩家.name },
              { key: 'target', label: '目标', value: 敌人.name },
              { key: 'result', label: '结果', value: 'full_hit' },
              { key: 'incomingDamage', label: '入参伤害', value: Number(配置.damage || 88) },
              { key: 'actualDefense', label: '有效防御', value: 140 },
              { key: 'defenseThreshold', label: '破防阈值', value: 0 },
              { key: 'shieldAbsorb', label: '护盾吸收', value: 0 },
              { key: 'finalDamage', label: '最终伤害', value: Number(配置.damage || 88) },
            ],
          },
        });
      }
      记录行动闭环审计(combatData, '主动规划', {
        actionId: actionEvent?.actionId || '',
        回合: 1,
        行动者: 玩家.name,
        目标: 配置.ledgerKind === 'shield' ? '夹具友方' : 敌人.name,
        displayTargetName: 配置.ledgerKind === 'shield' ? '夹具友方' : 敌人.name,
        技能: finalAction,
        战略意图: 配置.dominantReason,
        目标理由: Array.isArray(配置.targetReasons) ? 配置.targetReasons : [],
        候选来源: '主动候选结构化评分',
        原始权重: Number(配置.base || 70),
        战术修正: Number(配置.tactical || 16),
        目标修正: Number(配置.target || 14),
        资源修正: Number(配置.resource || 0),
        职责修正: Number(配置.role || 0),
        最终权重: Number(配置.finalScore || 100),
        选择原因: '结构化候选链锁定',
        hitCandidateName: finalAction,
        selectedCandidateName: finalAction,
        finalResolvedActionName: finalAction,
        目标语义: 配置.ledgerKind === 'shield' ? '友方单体' : '敌方单体',
        承载方式: '释放魂技',
        目标价值分解: 配置.targetBreakdown || {},
        候选排序结果: [
          {
            candidateId: `trusted_${配置.dominantReason || 'reason'}_final`,
            candidateName: finalAction,
            名称: finalAction,
            score: Number(配置.finalScore || 100),
            权重: Number(配置.finalScore || 100),
            finalScore: Number(配置.finalScore || 100),
            resourceCostEV: Number(配置.finalResourceCostEV || 0),
            castTime: Number(配置.finalCastTime || 0),
            原始权重: Number(配置.finalBase ?? 配置.base ?? 70),
            战术修正: Number(配置.finalTactical ?? 配置.tactical ?? 16),
            目标修正: Number(配置.finalTarget ?? 配置.target ?? 14),
            资源修正: Number(配置.finalResource ?? 配置.resource ?? 0),
            candidateStatus: 'EXECUTED',
            rejectionCode: '',
            effectTags: Array.isArray(配置.selectedTags) ? 配置.selectedTags : [],
            candidateSource: 'ACTIVE_SCORER',
          },
          {
            candidateId: `trusted_${配置.dominantReason || 'reason'}_alt`,
            candidateName: altAction,
            名称: altAction,
            score: Number(配置.altScore || 88),
            权重: Number(配置.altScore || 88),
            finalScore: Number(配置.altScore || 88),
            resourceCostEV: Number(配置.altResourceCostEV || 0),
            castTime: Number(配置.altCastTime || 0),
            原始权重: Number(配置.altBase ?? 配置.base ?? 70),
            战术修正: Number(配置.altTactical ?? 配置.tactical ?? 16),
            目标修正: Number(配置.altTarget ?? 配置.target ?? 14),
            资源修正: Number(配置.altResource ?? 配置.resource ?? 0),
            candidateStatus: 'REJECTED',
            rejectionCode: String(配置.altRejectionCode || 'DIRECT_PRESSURE_GAP'),
            effectTags: Array.isArray(配置.altTags) ? 配置.altTags : [],
            rejectedByEffectGap: String(配置.rejectedByEffectGap || ''),
            candidateSource: 'ACTIVE_SCORER',
          },
        ],
      });
      const eventLedger = combatData.__battleEventLedger || [];
      const publicReportBlocks = 构建事件账本公开战报Blocks(eventLedger, 8, { combatData });
      return {
        result: {
          preview: true,
          intentText: `可信${配置.label || '主导原因'}候选链生成 DM 战术侧写。`,
          mode: 'battle_preview',
          battleMode: `trusted_${String(配置.dominantReason || 'reason').toLowerCase()}_tactical_narration`,
          modeLabel: `可信${配置.label || '主导原因'}侧写闭环`,
          intentMode: '点到为止',
          logs: [],
          roundsExecuted: 1,
          battleOutcome: { type: '未分胜负', label: `可信${配置.label || '主导原因'}侧写闭环` },
          publicReportBlocks,
          publicReport: publicReportBlocks.map(item => 序列化公开战报Blocks(item?.blocks || [])).filter(Boolean).join('\n'),
          combatData,
          decisionTrace: BATTLE_RUNTIME.collectDecisionTrace(combatData),
          resolutionTrace: combatData.__battleResolutionTrace || [],
          eventLedger,
        },
        combatData,
        玩家,
        敌人,
      };
    }

    function 生成斩杀战术侧写调试结果() {
      return 生成主导原因战术侧写调试结果({
        label: '斩杀',
        dominantReason: 'LETHAL',
        finalAction: '追魂断击',
        altAction: '普通攻击',
        base: 74,
        tactical: 20,
        target: 18,
        finalScore: 112,
        altScore: 97,
        selectedTags: ['DIRECT_DAMAGE', 'LETHAL'],
        altTags: ['DIRECT_DAMAGE'],
        altRejectionCode: 'LETHAL_GAP',
        rejectedByEffectGap: 'LETHAL_GAP',
        targetBreakdown: { lethalWindow: 24 },
        targetReasons: ['终结窗口:目标已露颓势'],
        damage: 132,
        power: 116,
      });
    }

    function 生成资源压力战术侧写调试结果() {
      return 生成主导原因战术侧写调试结果({
        label: '资源压力',
        dominantReason: 'RESOURCE_PRESSURE',
        finalAction: '凝息掌',
        altAction: '第二魂技',
        base: 76,
        tactical: 22,
        target: 20,
        resource: -18,
        finalScore: 100,
        altScore: 96,
        selectedTags: ['DIRECT_DAMAGE', 'RESOURCE_STABLE'],
        altTags: ['DIRECT_DAMAGE'],
        altRejectionCode: 'RESOURCE_PRESSURE',
        rejectedByEffectGap: 'RESOURCE_PRESSURE',
        targetReasons: ['资源后果:当前动作更利于维持后续魂力节奏'],
        damage: 74,
        power: 68,
      });
    }

    function 生成保护协同战术侧写调试结果() {
      return 生成主导原因战术侧写调试结果({
        label: '保护协同',
        dominantReason: 'PROTECT_ALLY',
        finalAction: '护心屏障',
        altAction: '普通攻击',
        ledgerKind: 'shield',
        base: 58,
        tactical: 18,
        target: 10,
        role: 16,
        finalScore: 102,
        altScore: 90,
        selectedTags: ['PROTECT_ALLY'],
        altTags: ['DIRECT_DAMAGE'],
        altRejectionCode: 'PROTECT_ALLY_GAP',
        rejectedByEffectGap: 'PROTECT_ALLY_GAP',
        targetReasons: ['保护收益:己方防线需要支援'],
      });
    }

    function 生成同分破平战术侧写调试结果() {
      return 生成主导原因战术侧写调试结果({
        label: '同分破平',
        dominantReason: 'TIE_BREAK',
        finalAction: '锁魄印',
        altAction: '缠身掌',
        base: 70,
        tactical: 18,
        target: 12,
        altTactical: 14,
        altTarget: 12,
        finalScore: 100,
        altScore: 100,
        finalResourceCostEV: 8,
        altResourceCostEV: 16,
        selectedTags: ['CONTROL_RESTRICTION'],
        altTags: ['DIRECT_DAMAGE'],
        altRejectionCode: 'DIRECT_PRESSURE_GAP',
        targetReasons: ['战术重心:收益相近时优先锁定当前意图'],
        damage: 66,
        power: 62,
      });
    }

    function 生成战斗AOE链路调试结果() {
      const 原随机 = Math.random;
      try {
        Math.random = () => 0.01;
        const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
        敌人.name = '高速敌';
        敌人.agi = 10000;
        敌人.final = buildCombatFinalStats(敌人);
        const 低速敌 = 构建战斗回归夹具单位('低速敌', '防御系');
        低速敌.agi = 1;
        低速敌.def = 90;
        低速敌.final = buildCombatFinalStats(低速敌);
        combatData.参战者.team_enemy = [敌人, 低速敌];
        const 群体技能 = normalizeSkillData({
          name: '群体压制',
          魂技名: '群体压制',
          技能分类: '输出',
          目标: '敌方群体',
          消耗: '无',
          前摇: 10,
          _效果数组: [{ 原型: '伤害结算', 目标: '群体', 生效方式: '独立生效', 威力倍率: 90, 伤害类型: '远程攻击' }],
        }, '群体压制');
        玩家.第1武魂.第1魂环.第1魂技 = 群体技能;
        const entry = {
          actor_name: 玩家.name,
          action_type: '释放魂技',
          skill: { 魂技名: '群体压制', name: '群体压制', 消耗: '无' },
          __魂环路径: ['第1武魂', '第1魂环'],
          __魂技槽位: '第1魂技',
          target_name: 敌人.name,
        };
        let result = null;
        使用战斗回归桥接(combatData, {
          [玩家.name]: 玩家,
          [敌人.name]: 敌人,
          [低速敌.name]: 低速敌,
          夹具友方: 构建战斗回归夹具单位('夹具友方', '辅助系'),
        }, () => {
          result = onPlayerAttack('群体压制', {
            dryRun: true,
            mode: 'single_round',
            combatData,
            actionDeclaration: 构建战斗回归动作声明(entry),
            intentMode: '点到为止',
          });
        });
        return { result, combatData, 玩家, 敌人, 低速敌 };
      } finally {
        Math.random = 原随机;
      }
    }

    function 生成非伤害AOE链路调试结果() {
      const { combatData, 玩家 } = 构建战斗回归夹具战斗态();
      const 唐三 = 构建战斗回归夹具单位('唐三', '强攻系');
      const 小舞 = 构建战斗回归夹具单位('小舞', '敏攻系');
      combatData.参战者.team_player = [玩家, 唐三, 小舞];
      BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'action_start',
        round: 1,
        actorName: 玩家.name || '夹具玩家',
        targetName: '友方阵列',
        targetScope: 'ally_group',
        actionName: '七宝护阵',
        actionType: '释放魂技',
        result: 'declared',
        meta: { targetScope: 'ally_group' },
      });
      [
        { target: 唐三, amount: 160, eventId: 'fixture-group-shield-tangsan' },
        { target: 小舞, amount: 140, eventId: 'fixture-group-shield-xiaowu' },
      ].forEach(item => {
        BATTLE_RUNTIME.writeLedgerEvent(combatData, {
          eventId: item.eventId,
          eventKind: 'shield_create',
          round: 1,
          actorName: 玩家.name || '夹具玩家',
          targetName: item.target.name,
          targetId: `unit-${item.target.name}`,
          targetScope: 'ally_group',
          actionName: '七宝护阵',
          actionType: '释放魂技',
          result: 'shielded',
          meta: {
            targetScope: 'ally_group',
            amount: item.amount,
            shield: item.amount,
            sourceAction: '七宝护阵',
          },
        });
      });
      const eventLedger = combatData.__battleEventLedger || [];
      const publicReportBlocks = 构建事件账本公开战报Blocks(eventLedger, 8, { combatData });
      return {
        result: {
          eventLedger,
          resolutionTrace: combatData.__battleResolutionTrace || [],
          publicReportBlocks,
          publicReport: publicReportBlocks.map(item => 序列化公开战报Blocks(item?.blocks || [])).filter(Boolean).join('\n'),
        },
        combatData,
        玩家,
        唐三,
        小舞,
      };
    }

    function 生成战斗变招链路调试结果() {
      const { combatData, 玩家, 敌人 } = 构建战斗回归夹具战斗态();
      BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'action_start',
        round: 1,
        actorName: 玩家.name || '夹具玩家',
        targetName: 敌人.name || '夹具敌人',
        actionName: '收招转防',
        actionType: 'replan_fixture',
        initialActionName: '毒牙牵制',
        finalActionName: '收招转防',
        discardedActionName: '毒牙牵制',
        result: 'declared',
        replanReasonCode: 'TACTICAL_DISADVANTAGE',
        replanReasonText: '没有合适出手窗口',
        meta: {
          replanReasonCode: 'TACTICAL_DISADVANTAGE',
          replanReasonText: '没有合适出手窗口',
        },
      });
      BATTLE_RUNTIME.writeLedgerEvent(combatData, {
        eventKind: 'failed_action',
        round: 1,
        actorName: 玩家.name || '夹具玩家',
        targetName: 敌人.name || '夹具敌人',
        actionName: '收招转防',
        actionType: 'replan_fixture',
        initialActionName: '毒牙牵制',
        finalActionName: '收招转防',
        discardedActionName: '毒牙牵制',
        result: 'no_effective_opening',
        failReason: 'no_valid_window',
        replanReasonCode: 'TACTICAL_DISADVANTAGE',
        replanReasonText: '没有合适出手窗口',
        meta: {
          failureReason: 'no_valid_window',
          reasonCode: 'NO_EFFECTIVE_OPENING',
          reasonText: '未形成有效出手机会',
          replanReasonCode: 'TACTICAL_DISADVANTAGE',
          replanReasonText: '没有合适出手窗口',
        },
      });
      return {
        result: {
          eventLedger: combatData.__battleEventLedger || [],
          resolutionTrace: combatData.__battleResolutionTrace || [],
          publicReportBlocks: 构建事件账本公开战报Blocks(combatData.__battleEventLedger || [], 8, { combatData }),
        },
        combatData,
        玩家,
        敌人,
      };
    }

    function 生成召唤精神控制公开战报调试结果() {
      const { combatData, 宿主, 召唤单位 } = 构建召唤夹具战斗态({
        类型: '其他召唤生物',
        名称: '精神受限兽',
        行动模式: '自主行动',
        强度: 1,
      });
      combatData.回合 = 2;
      宿主.men = 100;
      宿主.精神力 = 100;
      宿主.men_max = 1000;
      宿主.精神力上限 = 1000;
      宿主.属性 = { ...(宿主.属性 || {}), 精神力: 100, 精神力上限: 1000 };
      const log = BATTLE_RUNTIME.refreshSummonMentalLoad(combatData, 宿主);
      const publicReportBlocks = 构建事件账本公开战报Blocks(combatData.__battleEventLedger || [], 8, { combatData });
      return {
        result: {
          log,
          eventLedger: combatData.__battleEventLedger || [],
          resolutionTrace: combatData.__battleResolutionTrace || [],
          publicReportBlocks,
          publicReport: publicReportBlocks.map(item => 序列化公开战报Blocks(item?.blocks || [])).filter(Boolean).join('\n'),
        },
        combatData,
        宿主,
        召唤单位,
      };
    }

    function 生成多召唤精神负载调试结果() {
      const { combatData, 宿主 } = 构建召唤夹具战斗态({
        类型: '其他召唤生物',
        名称: '负载兽甲',
        行动模式: '协同攻击',
        强度: 6,
      });
      const 第二状态 = {
        类型: 'buff',
        层数: 1,
        duration: 3,
        状态效果: {},
        战斗效果: createEmptyCombatEffectMap(),
        召唤物: {
          召唤单位类型: '其他召唤生物',
          召唤物名称: '负载兽乙',
          召唤数量: 1,
          行动模式: '协同攻击',
          强度: 5,
        },
      };
      宿主.状态效果['召唤:负载兽乙'] = 第二状态;
      const 第二单位 = 注册召唤运行态单位(combatData, 宿主, '召唤:负载兽乙', 第二状态);
      combatData.回合 = 2;
      宿主.men = 900;
      宿主.精神力 = 900;
      宿主.men_max = 200;
      宿主.精神力上限 = 200;
      宿主.属性 = { ...(宿主.属性 || {}), 精神力: 900, 精神力上限: 200 };
      const log = BATTLE_RUNTIME.refreshSummonMentalLoad(combatData, 宿主);
      const publicReportBlocks = 构建事件账本公开战报Blocks(combatData.__battleEventLedger || [], 8, { combatData });
      return {
        result: {
          log,
          eventLedger: combatData.__battleEventLedger || [],
          resolutionTrace: combatData.__battleResolutionTrace || [],
          publicReportBlocks,
          publicReport: publicReportBlocks.map(item => 序列化公开战报Blocks(item?.blocks || [])).filter(Boolean).join('\n'),
        },
        combatData,
        宿主,
        第二单位,
      };
    }

/**
 * BattleUI_Module.js 战斗风味文本渲染器 (受控润色层示例)
 * 
 * 该模块用于安全地将 eventLedger（底层账本事件）映射为具有表现力的自然语言文本。
 * 核心原则：绝不捏造事实，必须基于事件守卫（Guard）进行条件判断。
 */

const FlavorDictionary = require('./BattleFlavorDictionary.json');

class BattleFlavorRenderer {
    /**
     * 模板插槽替换引擎
     * @param {string} template 包含 {slot} 标识的字符串
     * @param {object} data 数据字典，包含 attacker, target, damage, skill 等
     */
    static injectSlots(template, data) {
        return template.replace(/\{(\w+)\}/g, (match, key) => {
            return data[key] !== undefined ? data[key] : match;
        });
    }

    /**
     * 随机抽取一个模板防疲劳
     */
    static rollTemplate(templateArray) {
        if (!templateArray || templateArray.length === 0) return "";
        const index = Math.floor(Math.random() * templateArray.length);
        return templateArray[index];
    }

    /**
     * 核心解析器：将单条账本事件转换为风味文本
     * 工程师需要根据实际的 eventLedger 数据结构映射属性
     * 
     * @param {object} event 结构化的结算链事件
     */
    static formatEvent(event) {
        // ===========================================
        // Guard 1: 动作被压制 / 失败 (blocked_action)
        // ===========================================
        if (event.type === 'action_attempt' && event.status === 'blocked') {
            const tmpl = this.rollTemplate(FlavorDictionary.blocked_action);
            return this.injectSlots(tmpl, {
                attacker: event.attackerName,
                target: event.targetName,
                skill: event.skillName
            });
        }

        // ===========================================
        // Guard 2: 命中且对方尝试闪避失败 (hit_result_dodge_failed)
        // ===========================================
        if (event.type === 'hit' && event.damage > 0 && event.targetDodgeAttempt) {
            // 进阶防越权：如果不满足高伤阈值，或者暴击条件，可在这里细分逻辑加载不同层级的模板
            const tmpl = this.rollTemplate(FlavorDictionary.hit_result_dodge_failed);
            return this.injectSlots(tmpl, {
                attacker: event.attackerName,
                target: event.targetName,
                skill: event.skillName,
                damage: event.damage
            });
        }

        // ===========================================
        // Guard 3: 借势反击 (counter)
        // ===========================================
        if (event.type === 'counter_hit' && event.damage > 0) {
            const tmpl = this.rollTemplate(FlavorDictionary.counter);
            return this.injectSlots(tmpl, {
                attacker: event.attackerName,
                target: event.targetName,
                skill: event.skillName,
                damage: event.damage
            });
        }

        // ===========================================
        // Guard 4: 状态判定 (state_apply / state_resisted)
        // ===========================================
        if (event.type === 'state_application') {
            // 防越权：如果状态被抵抗，绝对不能调用 state_apply 模板！
            if (event.resisted) {
                return `${event.targetName} 凭借坚韧抵御了【${event.stateName}】的侵蚀。`;
            }

            const tmpl = this.rollTemplate(FlavorDictionary.state_apply);
            return this.injectSlots(tmpl, {
                target: event.targetName,
                state: event.stateName,
                duration: event.duration
            });
        }

        // ===========================================
        // Guard 5: 回合末 DOT 跳字结算 (state_tick)
        // ===========================================
        if (event.type === 'state_tick' && event.damage > 0) {
            const tmpl = this.rollTemplate(FlavorDictionary.state_tick);
            return this.injectSlots(tmpl, {
                target: event.targetName,
                state: event.stateName,
                damage: event.damage
            });
        }

        // ===========================================
        // Guard 6: 双方僵持 (guard_stalemate)
        // ===========================================
        // 在外部多回合逻辑判断出“连续两回合双方转防”后，抛出该事件
        if (event.type === 'guard_stalemate') {
            const tmpl = this.rollTemplate(FlavorDictionary.guard_stalemate);
            return tmpl; // 无插槽直接返回
        }

        // ===========================================
        // Fallback: 如果没有任何模板匹配，或者数据不全
        // ===========================================
        // 兜底底线：宁可恢复系统直译的干瘪机械，也绝对不能乱编事实！
        return `[系统播报] ${event.attackerName || '未知'} 对 ${event.targetName || '未知'} 采取了动作。`;
    }
}

module.exports = BattleFlavorRenderer;

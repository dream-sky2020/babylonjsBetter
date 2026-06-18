// clash-logic-engine.js - 战斗生命周期与管线核心引擎

class CombatEngine {
    constructor() {
        // 定义标准的战斗生命周期阶段（Pipeline Phases）
        this.hooks = {
            onTurnStart: [],     // 回合开始时（适合：处理一些全局增益衰减、摸牌或初始化逻辑）
            onBeforeClash: [],   // 拼点开始前修正（适合：拼点威力加成、强壮/虚弱对拼点点数的修正）
            onClashEnd: [],      // 拼点结束后（适合：拼点胜负判定后的触发效果，如胜方恢复理智、输方触发特效）
            onBeforeHit: [],     // 命中伤害计算前（核心数值修正：强壮、虚弱、脆弱、守护、混乱倍率等修改 context.damage）
            onHit: [],           // 命中判定时/伤害扣除前（动作触发：破裂附加真实伤害、沉沦扣除理智等额外效果）
            onAfterHit: [],      // 伤害扣除后（适合：吸血、受击反伤、受到伤害触发的被动）
            onTurnEnd: []        // 回合结束结算时（适合：结算烧伤扣血、流血等层数衰减结算）
        };
    }

    /**
     * 注册效果/状态插件到指定的生命周期阶段
     * @param {string} phase - 生命周期阶段名称 (如 'onBeforeHit')
     * @param {string} name - 效果的唯一标识名（防止重复注册，也方便调试追踪）
     * @param {function} fn - 拦截处理函数，接收并修改 context 上下文对象
     * @param {number} priority - 执行优先级，数字越大越先执行，默认为 50
     */
    registerEffect(phase, name, fn, priority = 50) {
        if (!this.hooks[phase]) {
            console.warn(`[CombatEngine] 尝试注册到不存在的生命周期阶段: ${phase}`);
            return;
        }
        
        // 自动去重：如果存在同名效果，先将其移除，以便更新
        this.hooks[phase] = this.hooks[phase].filter(effect => effect.name !== name);
        
        // 推入新钩子
        this.hooks[phase].push({ name, fn, priority });
        
        // 按优先级从大到小（降序）排序，确保高优先级先被管线处理
        this.hooks[phase].sort((a, b) => b.priority - a.priority);
    }

    /**
     * 触发指定生命周期的管线，让上下文对象依次流经所有注册的拦截函数
     * @param {string} phase - 生命周期阶段名称
     * @param {object} context - 流转的战斗上下文数据对象
     * @returns {object} 最终被所有钩子修改完后的上下文对象
     */
    trigger(phase, context) {
        if (!this.hooks[phase] || this.hooks[phase].length === 0) {
            return context;
        }

        // 依次执行该阶段的所有钩子
        for (const effect of this.hooks[phase]) {
            try {
                // 执行钩子，传入当前最新的 context
                effect.fn(context);
            } catch (error) {
                console.error(`[CombatEngine] 执行效果 [${effect.name}] 在阶段 [${phase}] 时发生崩溃:`, error);
            }
        }
        return context;
    }

    /**
     * 清空钩子（通常在每轮攻击开始前、或者新回合开始时重新绑定状态）
     * @param {string} [phase] - 可选，若传入则只清空特定阶段，不传则清空全部
     */
    clearHooks(phase) {
        if (phase) {
            if (this.hooks[phase]) this.hooks[phase] = [];
        } else {
            for (const key in this.hooks) {
                this.hooks[key] = [];
            }
        }
    }
}

// 挂载到全局 window 对象上，确保 html 和其他 js 文件可以直接访问
window.CombatEngine = CombatEngine;
window.combatEngine = new CombatEngine();
console.log("🚀 CombatEngine (战斗管线引擎) 初始化成功！已挂载至全局 window.combatEngine");

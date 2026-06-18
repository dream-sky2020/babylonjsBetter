// clash-logic-effects.js - 状态效果与被动插件库

/**
 * 将所有基础状态逻辑注册到战斗引擎中
 * 只要在页面加载或战斗初始化时调用一次此函数，所有的状态结算都会自动挂载到管线上
 * @param {CombatEngine} engine
 */
function registerAllCombatEffects(engine) {

    // ==========================================
    // 新增：动态硬币效果解析插件
    // ==========================================

    // 插件 1：硬币追加伤害处理 (在计算防御/脆弱前生效)
    engine.registerEffect('onBeforeHit', 'coin_dynamic_damage', (ctx) => {
        if (ctx.effects && ctx.effects.length > 0) {
            ctx.effects.forEach(effect => {
                if (effect.type === 'dmg') {
                    ctx.damage += effect.value;
                    log(`  💥 触发硬币效果：追加常规伤害 +${effect.value} (当前总伤害: ${ctx.damage})`);
                }
            });
        }
    }, 60); // 赋予稍高的优先级，在混乱倍率计算前加入基础面板

    // 插件 2：硬币赋予状态处理 (在命中判定扣血时生效)
    engine.registerEffect('onHit', 'coin_dynamic_apply_status', (ctx) => {
        if (ctx.effects && ctx.effects.length > 0) {
            ctx.effects.forEach(effect => {
                if (effect.type === 'applyStatus') {
                    // 调用你原本在 effects.js 底部实现的通用状态挂载方法
                    // 传入目标单位ID、状态名、强度增量、层数增量
                    applyOrUpdateStatus(ctx.targetId, effect.statusId, effect.power, effect.stack);
                    log(`  ✨ 触发硬币效果：对 ${ctx.targetId} 赋予 [${effect.statusId}] (强度+${effect.power}, 层数+${effect.stack})`);
                }
            });
        }
    }, 60);

    

    // ==========================================
    // 1. 拼点前阶段 (onBeforeClash)
    // ==========================================
    engine.registerEffect('onBeforeClash', 'status_clash_modifiers', (ctx) => {
        // 注意：拼点时的上下文需要你在 startClash.js 中构造成 { unitId: 'A', currentRoll: 5 }
        
        // 强壮：增加拼点点数
        const str = consumeStatus(ctx.unitId, 'strength');
        if (str) {
            ctx.currentRoll += str.power;
            log(`  ${ctx.unitId} 触发强壮，拼点点数 +${str.power}`);
        }

        // 虚弱：减少拼点点数
        const frail = consumeStatus(ctx.unitId, 'frailty');
        if (frail) {
            ctx.currentRoll = Math.max(0, ctx.currentRoll - frail.power);
            log(`  ${ctx.unitId} 触发虚弱，拼点点数 -${frail.power}`);
        }
    }, 50);


    // ==========================================
    // 2. 命中/伤害计算前阶段 (onBeforeHit)
    // ==========================================
    engine.registerEffect('onBeforeHit', 'status_damage_modifiers', (ctx) => {
        // 上下文 ctx 包含: attackerId, targetId, damage, baseRoll

        // 攻击者流血：发起攻击时自身受到伤害 (原逻辑是在 applyDamage 每次遍历硬币时触发)
        const atkBleed = consumeStatus(ctx.attackerId, 'bleed');
        if (atkBleed) {
            dealDirectHpDamage(ctx.attackerId, atkBleed.power, '流血(攻击动作)');
        }

        // 攻击者强壮：增加造成的面板伤害
        const atkStr = consumeStatus(ctx.attackerId, 'strength');
        if (atkStr) {
            ctx.damage += atkStr.power;
            log(`  ${ctx.attackerId} 触发强壮，造成的伤害 +${atkStr.power}`);
        }

        // 攻击者虚弱：减少造成的面板伤害
        const atkFrail = consumeStatus(ctx.attackerId, 'frailty');
        if (atkFrail) {
            ctx.damage = Math.max(0, ctx.damage - atkFrail.power);
            log(`  ${ctx.attackerId} 触发虚弱，造成的伤害 -${atkFrail.power}`);
        }

        // 受击者脆弱：增加受到的伤害
        const defVuln = consumeStatus(ctx.targetId, 'vulnerability');
        if (defVuln) {
            ctx.damage += defVuln.power;
            log(`  ${ctx.targetId} 触发脆弱，受到的伤害 +${defVuln.power}`);
        }

        // 受击者守护：减少受到的伤害
        const defProt = consumeStatus(ctx.targetId, 'protection');
        if (defProt) {
            ctx.damage = Math.max(0, ctx.damage - defProt.power);
            log(`  ${ctx.targetId} 触发守护，受到的伤害 -${defProt.power}`);
        }

        // 受击者混乱：基于混乱强度增加伤害
        const defConfusion = consumeStatus(ctx.targetId, 'confusion');
        if (defConfusion) {
            // 原注释写着 "每1点=100%加成"，这里修正为标准的倍率计算 (1点强度 = +100%)
            const bonus = defConfusion.power; 
            ctx.damage = Math.floor(ctx.damage * (1 + bonus));
            log(`  🌪️ ${ctx.targetId} 触发混乱(强度${defConfusion.power})，受到的伤害增加至 ${ctx.damage} (+${bonus * 100}%)`);
        }
}, 50);


    // ==========================================
    // 3. 命中判定时阶段 (onHit) - 处理附加特效与真伤
    // ==========================================
    engine.registerEffect('onHit', 'status_hit_effects', (ctx) => {
        // 受击者破裂：附加真实伤害
        const defRupture = consumeStatus(ctx.targetId, 'rupture');
        if (defRupture) {
            ctx.extraTrueDamage = (ctx.extraTrueDamage || 0) + defRupture.power;
            log(`  ${ctx.targetId} 触发破裂(受击)，附加真实伤害 ${defRupture.power}`);
        }

        // 受击者沉沦：扣除理智，理智不足则转化为生命值伤害
        const defSinking = consumeStatus(ctx.targetId, 'sinking');
        if (defSinking) {
            // 假设你页面上的理智输入框 id 是 'sanA' 或 'sanB'
            const sanInputId = 'san' + ctx.targetId;
            let currentSan = typeof getVal === 'function' ? getVal(sanInputId) : 0;
            
            if (currentSan > 0) {
                let sanDmg = Math.min(currentSan, defSinking.power);
                let newSan = currentSan - sanDmg;
                if (typeof setVal === 'function') setVal(sanInputId, newSan);
                
                log(`  ${ctx.targetId} 触发沉沦(受击)，失去 ${sanDmg} 点理智 (San: ${currentSan} → ${newSan})`);
                
                let spillOver = defSinking.power - sanDmg;
                if (spillOver > 0) {
                    dealDirectHpDamage(ctx.targetId, spillOver, '沉沦(理智耗尽溢出)');
                }
            } else {
                dealDirectHpDamage(ctx.targetId, defSinking.power, '沉沦(理智为空)');
            }
        }
    }, 50);

    // ==========================================
    // 4. 回合结束阶段 (onTurnEnd)
    // ==========================================
    engine.registerEffect('onTurnEnd', 'status_turn_end_effects', (ctx) => {
        // 上下文 ctx 假设为 { unitId: 'A' } 或 { unitId: 'B' }
        const burn = consumeStatus(ctx.unitId, 'burn');
        if (burn) {
            dealDirectHpDamage(ctx.unitId, burn.power, '烧伤结算');
        }
    }, 50);
    // ==========================================
    // 新增：5. 命中/结算后阶段 (onAfterHit) 
    // ==========================================
    engine.registerEffect('onAfterHit', 'status_chaos_buildup', (ctx) => {
        // 只有当造成了真实的血量伤害时，才累积混乱值
        if (ctx.hpDamageTaken && ctx.hpDamageTaken > 0) {
            const chaosInputId = 'chaos' + ctx.targetId;
            const thresholdInputId = 'chaosThreshold' + ctx.targetId;
            
            // 获取当前值
            let currentChaos = typeof getVal === 'function' ? getVal(chaosInputId) : parseInt(document.getElementById(chaosInputId)?.value || 0);
            const threshold = typeof getVal === 'function' ? getVal(thresholdInputId) : parseInt(document.getElementById(thresholdInputId)?.value || 30);

            // 累加伤害到混乱值
            currentChaos += ctx.hpDamageTaken;

            // 检查阈值
            if (currentChaos >= threshold && threshold > 0) {
                const power = Math.floor(currentChaos / threshold);
                currentChaos = 0; // 触发后清空混乱条
                
                log(`🌀 ${ctx.targetId} 混乱值达到阈值 ${threshold}，触发混乱状态！强度: ${power}`);
                
                // 动态给角色添加混乱状态
                applyOrUpdateStatus(ctx.targetId, 'confusion', power, 1);
            }

            // 更新 UI 界面的混乱值
            if (typeof setVal === 'function') {
                setVal(chaosInputId, currentChaos);
            } else {
                const el = document.getElementById(chaosInputId);
                if (el) el.value = currentChaos;
            }
        }
    }, 50);
    // console.log("🧩 基础战斗状态插件 (Effects) 注册完成！");
}
/**
 * ✅ 提取出的通用底层方法（可以放在 effects.js 底部）
 * 替代原来特定于混乱的 addConfusionStatus，现在它可以被任何需要在战斗中动态挂载状态的机制（比如燃烧、流血）复用。
 */
function applyOrUpdateStatus(unitId, type, powerToAdd, stackToSet = 1) {
    const statusList = document.getElementById(`status-list-${unitId}`);
    if (!statusList) return;

    // 查找是否已有同类状态，有则叠加强度
    const existingItems = statusList.querySelectorAll('.status-item');
    for (const item of existingItems) {
        const typeSelect = item.querySelector('.status-type');
        if (typeSelect && typeSelect.value === type) {
            const powerInput = item.querySelector('.status-power');
            if (powerInput) {
                const currentPower = parseInt(powerInput.value) || 0;
                powerInput.value = currentPower + powerToAdd;
                log(`  🔄 更新 ${unitId} 的 ${type} 状态: 强度 ${currentPower} → ${currentPower + powerToAdd}`);
            }
            return;
        }
    }

    // 不存在则创建新状态节点 (依赖你原有的 createStatusInput)
    if (typeof createStatusInput === 'function') {
        const newStatus = createStatusInput({ 
            type: type, 
            stack: stackToSet, 
            power: powerToAdd 
        });
        statusList.appendChild(newStatus);
        log(`  ✅ 为 ${unitId} 添加了新状态: ${type} (强度: ${powerToAdd})`);
    }
}
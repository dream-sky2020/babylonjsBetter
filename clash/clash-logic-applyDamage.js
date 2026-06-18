// clash-logic-applyDamage.js - 命中伤害管线驱动与最终结算中心

/**
 * 核心主循环：由攻击方对受击方施加一组硬币的伤害
 * @param {string} attackerId - 攻击方ID ('A' 或 'B')
 * @param {string} targetId - 受击方ID ('A' 或 'B')
 * @param {Array} results - 骰子/硬币投掷结果数组
 */
function applyDamage(attackerId, targetId, results) {
    log(`=== 开始由 ${attackerId} 对 ${targetId} 施加伤害 ===`);
    log(`初始状态: HP=${getVal('hp' + targetId)}, 护盾=${getVal('shd' + targetId)}`);

    // 遍历每一个硬币投掷结果
    results.forEach((result, index) => {
        // 1. 初始化管道上下文数据 Context
        let ctx = {
            attackerId: attackerId,
            targetId: targetId,
            coinIndex: index,
            baseRoll: result.roll,
            damage: result.roll,       // 基础常规伤害初始等于点数
            extraTrueDamage: 0,          // 额外真实伤害初始为 0
            effects: result.effects || (result.die && result.die.effects) || []
        };

        // 2. 流经管线阶段 1：面板伤害修正
        // 这里会自动触发 effects.js 里的强壮、虚弱、脆弱、守护以及混乱倍率加成
        if (typeof combatEngine !== 'undefined') {
            ctx = combatEngine.trigger('onBeforeHit', ctx);
        }

        // 3. 流经管线阶段 2：命中特效判定
        // 这里会自动触发破裂(附带真伤)、沉沦(扣除理智)等状态
        if (typeof combatEngine !== 'undefined') {
            ctx = combatEngine.trigger('onHit', ctx);
        }

        // 4. 本地调用：执行最终的扣盾、扣血、增混乱副作用
        _executeApplyHit(ctx);
    });
}

/**
 * 内部辅助函数：接收经过管线清洗后的最终上下文，并应用到实际角色的属性上
 * @param {object} ctx - 管道上下文对象
 */
function _executeApplyHit(ctx) {
    const targetId = ctx.targetId;
    const coinIndex = ctx.coinIndex;

    // 提取管线结算后的最终普通伤害与真实伤害
    let normalDamage = ctx.damage;
    let trueDamage = ctx.extraTrueDamage || 0;

    // 获取当前防御方的实时数值
    let hp = getVal('hp' + targetId);
    let shd = getVal('shd' + targetId);
    let tempShd = getVal('tempShd' + targetId);

    log(`  💥 [硬币#${coinIndex + 1} 最终面板] 普通伤: [${normalDamage}], 真实伤: [${trueDamage}]`);

    // ==========================================
    // 1. 处理普通伤害 (依次扣除: 临时护盾 -> 常规护盾 -> 血量)
    // ==========================================
    let remainingDamage = normalDamage;

    // 优先扣除临时护盾
    if (tempShd > 0 && remainingDamage > 0) {
        if (tempShd >= remainingDamage) {
            tempShd -= remainingDamage;
            log(`    🛡️ ${targetId} 的临时护盾吸收了 ${remainingDamage} 点伤害 (剩余临时护盾: ${tempShd})`);
            remainingDamage = 0;
        } else {
            log(`    🛡️ ${targetId} 的临时护盾破碎！吸收了 ${tempShd} 点伤害`);
            remainingDamage -= tempShd;
            tempShd = 0;
        }
        setVal('tempShd' + targetId, tempShd);
    }

    // 其次扣除常规护盾
    if (shd > 0 && remainingDamage > 0) {
        if (shd >= remainingDamage) {
            shd -= remainingDamage;
            log(`    🛡️ ${targetId} 的护盾吸收了 ${remainingDamage} 点伤害 (剩余护盾: ${shd})`);
            remainingDamage = 0;
        } else {
            log(`    🛡️ ${targetId} 的护盾破碎！吸收了 ${shd} 点伤害`);
            remainingDamage -= shd;
            shd = 0;
        }
        setVal('shd' + targetId, shd);
    }

    // 扣除实际血量，并记录受到的实际常规血量伤害
    let hpDamageTaken = 0;
    if (remainingDamage > 0) {
        let oldHp = hp;
        hp = Math.max(0, hp - remainingDamage);
        hpDamageTaken += (oldHp - hp);
        log(`    ❤️ ${targetId} 受到 ${remainingDamage} 点常规血量伤害 (HP: ${oldHp} → ${hp})`);
        setVal('hp' + targetId, hp);
    }

    // ==========================================
    // 2. 处理真实伤害 (直接绕过护盾，扣减血量)
    // ==========================================
    if (trueDamage > 0 && hp > 0) {
        let oldHp = hp;
        hp = Math.max(0, hp - trueDamage);
        hpDamageTaken += (oldHp - hp);
        log(`    ✨ ${targetId} 受到 ${trueDamage} 点附加真实伤害 (HP: ${oldHp} → ${hp})`);
        setVal('hp' + targetId, hp);
    }

    // ==========================================
    // 3. 触发【伤害扣除后】生命周期管线 (用于吸血、受击反伤等扩展)
    // ==========================================
    if (typeof combatEngine !== 'undefined') {
        ctx.hpDamageTaken = hpDamageTaken; // 挂载实际扣血数值供插件读取
        combatEngine.trigger('onAfterHit', ctx);
    }
}

// 挂载全局方法
window.applyDamage = applyDamage;
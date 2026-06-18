// clash-logic-startClash.js - 拼点流程函数 (管线重构版)

function startClash() {
    // 获取当前界面所有数值
    const A = { hp: getVal('hpA'), shd: getVal('shdA'), tempShd: getVal('tempShdA') };
    const B = { hp: getVal('hpB'), shd: getVal('shdB'), tempShd: getVal('tempShdB') };

    const statusA = buildStatusConfig('A');
    const statusB = buildStatusConfig('B');

    const resultA = rollFromDice('A');
    const resultB = rollFromDice('B');
    if (!resultA || !resultB) {
        log('拼点失败：A 或 B 的骰子配置为空');
        return;
    }

    log(`A 特殊状态: ${statusA.map(s => `${s.type}(层${s.stack},强${s.power})`).join(' | ')}`);
    log(`B 特殊状态: ${statusB.map(s => `${s.type}(层${s.stack},强${s.power})`).join(' | ')}`);

    // 记录所有初始投掷结果
    log(`A 投掷了 ${resultA.length} 个骰子:`);
    resultA.forEach((r, i) => log(`  #${i + 1}: ${r.die.min}~${r.die.max} → ${r.roll}`));
    log(`B 投掷了 ${resultB.length} 个骰子:`);
    resultB.forEach((r, i) => log(`  #${i + 1}: ${r.die.min}~${r.die.max} → ${r.roll}`));

    // 辅助函数：处理单个角色的所有硬币投掷结果并穿过管线
    function processClashRolls(unitId, results) {
        let totalSum = 0;
        
        results.forEach((r, index) => {
            // 1. 构建拼点阶段上下文 Context
            let ctx = {
                unitId: unitId,
                coinIndex: index,
                baseRoll: r.roll,
                currentRoll: r.roll  // 初始拼点点数
            };

            // 2. 保留原有的流血判定 (拼点动作受伤害)
            // 提示：未来如果想彻底解耦，也可以把这段移入 effects.js 的 onBeforeClash 中
            const bleed = consumeStatus(unitId, 'bleed');
            if (bleed) {
                dealDirectHpDamage(unitId, bleed.power, '流血(拼点)');
            }

            // 3. 将上下文穿过【拼点前】管线
            // 这里会自动触发 effects.js 里的强壮、虚弱加减成，并修改 ctx.currentRoll
            if (typeof combatEngine !== 'undefined') {
                ctx = combatEngine.trigger('onBeforeClash', ctx);
            }

            // 累加计算后的最终点数
            totalSum += ctx.currentRoll;
            r.finalRoll = ctx.currentRoll; // 保存最终点数供后续可能的效果使用
        });
        
        return totalSum;
    }

    // 结算 A 和 B 的最终点数总和
    let sumRollA = processClashRolls('A', resultA);
    let sumRollB = processClashRolls('B', resultB);

    // 显示最终结果
    log(`A 全部骰子结算点数: ${resultA.map(r => r.finalRoll).join(' + ')} = ${sumRollA}`);
    log(`B 全部骰子结算点数: ${resultB.map(r => r.finalRoll).join(' + ')} = ${sumRollB}`);
    log(`最终拼点: A(${sumRollA}) vs B(${sumRollB})`);

    // 胜负判定与伤害触发
    if (sumRollA > sumRollB) {
        log('🎉 A 胜出');
        // 将经过管线的 resultA 传给 applyDamage
        applyDamage('A', 'B', resultA); 
    } else if (sumRollB > sumRollA) {
        log('🎉 B 胜出');
        applyDamage('B', 'A', resultB); 
    } else {
        log('⚖️ 平局！骰子互相抵消');
    }
}
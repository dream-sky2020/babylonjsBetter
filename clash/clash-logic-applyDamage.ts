import type { HitContext, DiceRollResult, UnitId, DamageInstance } from './types.ts';
import { buildBattleContext, clampUnitHpToMax } from './utils/combat-utils.ts';

type MutableHitContext = HitContext & Record<string, unknown>;

function applyDamage(attackerId: UnitId, targetId: UnitId, results: DiceRollResult[]): void {
  clampUnitHpToMax(attackerId);
  clampUnitHpToMax(targetId);
  const battle = buildBattleContext();
  window.log(`=== 开始由 ${attackerId} 对 ${targetId} 施加伤害 ===`);
  window.log(`初始状态: HP=${window.getVal('hp' + targetId)}/${window.getVal('maxHp' + targetId)}, 护盾=${window.getVal('shd' + targetId)}`);

  const currentSkillEffects = window.buildSkillEffectConfig(attackerId) ?? [];

  results.forEach((result, index) => {
    // 1. 根据骰子配置初始化基础伤害实例
    const baseDamageInstance: DamageInstance = {
      tags: result.die.tags || [], // 从骰子配置继承标签 (如 'slash')
      baseAmount: result.roll,     // 骰子最终点数作为基础伤害
      modifierFlat: 0,
      multiplier: 1.0,
      finalAmount: 0
    };

    let ctx: MutableHitContext = {
      attackerId,
      targetId,
      coinIndex: index,
      baseRoll: result.roll,
      damageInstances: [baseDamageInstance], // 使用伤害实例数组
      effects: result.effects ?? result.die.effects ?? [],
      skillEffects: currentSkillEffects,
      battle,
    };

    ctx = window.combatEngine.trigger('onBeforeHit', ctx) as MutableHitContext;
    ctx = window.combatEngine.trigger('onHit', ctx) as MutableHitContext;
    executeApplyHit(ctx);
  });
}

function executeApplyHit(ctx: MutableHitContext): void {
  const targetId = ctx.targetId;
  const coinIndex = ctx.coinIndex;

  let normalDamage = 0;
  let trueDamage = 0;

  // 2. 计算并分类所有伤害实例
  ctx.damageInstances.forEach(instance => {
    // 计算公式: 最终伤害 = 向下取整((基础 + 固定修饰) * 乘区)
    instance.finalAmount = Math.floor((instance.baseAmount + instance.modifierFlat) * instance.multiplier);
    
    if (instance.tags.includes('true_damage')) {
      trueDamage += instance.finalAmount;
    } else {
      normalDamage += instance.finalAmount;
    }
  });

  let hp = window.getVal('hp' + targetId);
  let shd = window.getVal('shd' + targetId);
  let tempShd = window.getVal('tempShd' + targetId);

  window.log(`  💥 [硬币#${coinIndex + 1} 结算] 常规伤: [${normalDamage}], 真实伤: [${trueDamage}]`);

  // 3. 护盾与临时护盾抵挡逻辑 (仅抵挡常规伤害)
  let remainingDamage = normalDamage;
  if (tempShd > 0 && remainingDamage > 0) {
    if (tempShd >= remainingDamage) {
      tempShd -= remainingDamage;
      window.log(`    🛡️ 临时护盾吸收了 ${remainingDamage} 伤 (剩余: ${tempShd})`);
      remainingDamage = 0;
    } else {
      window.log(`    🛡️ 临时护盾破碎！吸收了 ${tempShd} 伤`);
      remainingDamage -= tempShd;
      tempShd = 0;
    }
    window.setVal('tempShd' + targetId, tempShd);
  }

  if (shd > 0 && remainingDamage > 0) {
    if (shd >= remainingDamage) {
      shd -= remainingDamage;
      window.log(`    🛡️ 护盾吸收了 ${remainingDamage} 伤 (剩余: ${shd})`);
      remainingDamage = 0;
    } else {
      window.log(`    🛡️ 护盾破碎！吸收了 ${shd} 伤`);
      remainingDamage -= shd;
      shd = 0;
    }
    window.setVal('shd' + targetId, shd);
  }

  // 4. 扣除生命值
  let hpDamageTaken = 0;
  if (remainingDamage > 0) {
    const oldHp = hp;
    hp = Math.max(0, hp - remainingDamage);
    hpDamageTaken += oldHp - hp;
    window.log(`    ❤️ 受到 ${remainingDamage} 点常规伤害 (HP: ${oldHp} → ${hp})`);
  }

  if (trueDamage > 0 && hp > 0) {
    const oldHp = hp;
    hp = Math.max(0, hp - trueDamage);
    hpDamageTaken += oldHp - hp;
    window.log(`    ✨ 受到 ${trueDamage} 点真实伤害 (HP: ${oldHp} → ${hp})`);
  }
  
  window.setVal('hp' + targetId, hp);
  ctx.hpDamageTaken = hpDamageTaken;
  
  window.combatEngine.trigger('onAfterHit', ctx);
}

window.applyDamage = applyDamage;

export { applyDamage };
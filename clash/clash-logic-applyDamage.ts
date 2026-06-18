import type { HitContext, DiceRollResult, UnitId } from './types.ts';

type MutableHitContext = HitContext & Record<string, unknown>;

function applyDamage(attackerId: UnitId, targetId: UnitId, results: DiceRollResult[]): void {
  window.log(`=== 开始由 ${attackerId} 对 ${targetId} 施加伤害 ===`);
  window.log(`初始状态: HP=${window.getVal('hp' + targetId)}, 护盾=${window.getVal('shd' + targetId)}`);

  const currentSkillEffects = window.buildSkillEffectConfig(attackerId) ?? [];

  results.forEach((result, index) => {
    let ctx: MutableHitContext = {
      attackerId,
      targetId,
      coinIndex: index,
      baseRoll: result.roll,
      damage: result.roll,
      extraTrueDamage: 0,
      effects: result.effects ?? result.die.effects ?? [],
      skillEffects: currentSkillEffects,
    };

    ctx = window.combatEngine.trigger('onBeforeHit', ctx) as MutableHitContext;
    ctx = window.combatEngine.trigger('onHit', ctx) as MutableHitContext;
    executeApplyHit(ctx);
  });
}

function executeApplyHit(ctx: MutableHitContext): void {
  const targetId = ctx.targetId;
  const coinIndex = ctx.coinIndex;

  const normalDamage = Number(ctx.damage) || 0;
  const trueDamage = Number(ctx.extraTrueDamage) || 0;

  let hp = window.getVal('hp' + targetId);
  let shd = window.getVal('shd' + targetId);
  let tempShd = window.getVal('tempShd' + targetId);

  window.log(`  💥 [硬币#${coinIndex + 1} 最终面板] 普通伤: [${normalDamage}], 真实伤: [${trueDamage}]`);

  let remainingDamage = normalDamage;
  if (tempShd > 0 && remainingDamage > 0) {
    if (tempShd >= remainingDamage) {
      tempShd -= remainingDamage;
      window.log(`    🛡️ ${targetId} 的临时护盾吸收了 ${remainingDamage} 点伤害 (剩余临时护盾: ${tempShd})`);
      remainingDamage = 0;
    } else {
      window.log(`    🛡️ ${targetId} 的临时护盾破碎！吸收了 ${tempShd} 点伤害`);
      remainingDamage -= tempShd;
      tempShd = 0;
    }
    window.setVal('tempShd' + targetId, tempShd);
  }

  if (shd > 0 && remainingDamage > 0) {
    if (shd >= remainingDamage) {
      shd -= remainingDamage;
      window.log(`    🛡️ ${targetId} 的护盾吸收了 ${remainingDamage} 点伤害 (剩余护盾: ${shd})`);
      remainingDamage = 0;
    } else {
      window.log(`    🛡️ ${targetId} 的护盾破碎！吸收了 ${shd} 点伤害`);
      remainingDamage -= shd;
      shd = 0;
    }
    window.setVal('shd' + targetId, shd);
  }

  let hpDamageTaken = 0;
  if (remainingDamage > 0) {
    const oldHp = hp;
    hp = Math.max(0, hp - remainingDamage);
    hpDamageTaken += oldHp - hp;
    window.log(`    ❤️ ${targetId} 受到 ${remainingDamage} 点常规血量伤害 (HP: ${oldHp} → ${hp})`);
    window.setVal('hp' + targetId, hp);
  }

  if (trueDamage > 0 && hp > 0) {
    const oldHp = hp;
    hp = Math.max(0, hp - trueDamage);
    hpDamageTaken += oldHp - hp;
    window.log(`    ✨ ${targetId} 受到 ${trueDamage} 点附加真实伤害 (HP: ${oldHp} → ${hp})`);
    window.setVal('hp' + targetId, hp);
  }

  ctx.hpDamageTaken = hpDamageTaken;
  window.combatEngine.trigger('onAfterHit', ctx);
}

window.applyDamage = applyDamage;

export { applyDamage };

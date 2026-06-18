import type { ClashContext, HitContext, SkillEffectConfig, UnitId } from './types.ts';

type MutableContext = (ClashContext | HitContext) & Record<string, unknown>;

function registerAllCombatEffects(engine: typeof window.combatEngine): void {
  engine.registerEffect(
    'onBeforeHit',
    'coin_dynamic_damage',
    (ctx) => {
      const hitCtx = ctx as MutableContext;
      const effects = Array.isArray(hitCtx.effects) ? hitCtx.effects : [];
      effects.forEach((effect) => {
        if (effect && typeof effect === 'object' && (effect as Record<string, unknown>).type === 'dmg') {
          const value = Number((effect as Record<string, unknown>).value) || 0;
          hitCtx.damage = (Number(hitCtx.damage) || 0) + value;
          window.log(`  💥 触发硬币效果：追加常规伤害 +${value} (当前总伤害: ${hitCtx.damage})`);
        }
      });
    },
    60,
  );

  engine.registerEffect(
    'onHit',
    'coin_dynamic_apply_status',
    (ctx) => {
      const hitCtx = ctx as MutableContext;
      const effects = Array.isArray(hitCtx.effects) ? hitCtx.effects : [];
      effects.forEach((effect) => {
        if (effect && typeof effect === 'object' && (effect as Record<string, unknown>).type === 'applyStatus') {
          const payload = effect as Record<string, unknown>;
          applyOrUpdateStatus(
            hitCtx.targetId as UnitId,
            String(payload.statusId ?? ''),
            Number(payload.power) || 0,
            Number(payload.stack) || 0,
          );
          window.log(
            `  ✨ 触发硬币效果：对 ${String(hitCtx.targetId)} 赋予 [${String(payload.statusId ?? '')}] (强度+${Number(payload.power) || 0}, 层数+${Number(payload.stack) || 0})`,
          );
        }
      });
    },
    60,
  );

  engine.registerEffect('onBeforeClash', 'skill_effects_before_clash', (ctx) => {
    processSkillEffects(ctx as MutableContext, 'onBeforeClash');
  }, 80);

  engine.registerEffect('onClashEnd', 'skill_effects_clash_win', (ctx) => {
    const clashCtx = ctx as MutableContext;
    if (clashCtx.isWinner) {
      processSkillEffects(clashCtx, 'onClashWin');
    }
  }, 80);

  engine.registerEffect('onBeforeHit', 'skill_effects_before_hit', (ctx) => {
    processSkillEffects(ctx as MutableContext, 'onBeforeHit');
  }, 80);

  engine.registerEffect('onHit', 'skill_effects_hit', (ctx) => {
    processSkillEffects(ctx as MutableContext, 'onHit');
  }, 80);

  engine.registerEffect('onAfterHit', 'skill_effects_after_hit', (ctx) => {
    processSkillEffects(ctx as MutableContext, 'onAfterHit');
  }, 80);

  engine.registerEffect(
    'onBeforeClash',
    'status_clash_modifiers',
    (ctx) => {
      const clashCtx = ctx as MutableContext;
      const unitId = clashCtx.unitId as UnitId;
      if (!unitId) return;

      const strength = window.consumeStatus(unitId, 'strength');
      if (strength) {
        clashCtx.currentRoll = (Number(clashCtx.currentRoll) || 0) + strength.power;
        window.log(`  ${unitId} 触发强壮，拼点点数 +${strength.power}`);
      }

      const frailty = window.consumeStatus(unitId, 'frailty');
      if (frailty) {
        clashCtx.currentRoll = Math.max(0, (Number(clashCtx.currentRoll) || 0) - frailty.power);
        window.log(`  ${unitId} 触发虚弱，拼点点数 -${frailty.power}`);
      }
    },
    50,
  );

  engine.registerEffect(
    'onBeforeHit',
    'status_damage_modifiers',
    (ctx) => {
      const hitCtx = ctx as MutableContext;
      const attackerId = hitCtx.attackerId as UnitId;
      const targetId = hitCtx.targetId as UnitId;

      const attackerBleed = window.consumeStatus(attackerId, 'bleed');
      if (attackerBleed) {
        window.dealDirectHpDamage(attackerId, attackerBleed.power, '流血(攻击动作)');
      }

      const attackerStrength = window.consumeStatus(attackerId, 'strength');
      if (attackerStrength) {
        hitCtx.damage = (Number(hitCtx.damage) || 0) + attackerStrength.power;
        window.log(`  ${attackerId} 触发强壮，造成的伤害 +${attackerStrength.power}`);
      }

      const attackerFrailty = window.consumeStatus(attackerId, 'frailty');
      if (attackerFrailty) {
        hitCtx.damage = Math.max(0, (Number(hitCtx.damage) || 0) - attackerFrailty.power);
        window.log(`  ${attackerId} 触发虚弱，造成的伤害 -${attackerFrailty.power}`);
      }

      const targetVulnerability = window.consumeStatus(targetId, 'vulnerability');
      if (targetVulnerability) {
        hitCtx.damage = (Number(hitCtx.damage) || 0) + targetVulnerability.power;
        window.log(`  ${targetId} 触发脆弱，受到的伤害 +${targetVulnerability.power}`);
      }

      const targetProtection = window.consumeStatus(targetId, 'protection');
      if (targetProtection) {
        hitCtx.damage = Math.max(0, (Number(hitCtx.damage) || 0) - targetProtection.power);
        window.log(`  ${targetId} 触发守护，受到的伤害 -${targetProtection.power}`);
      }

      const targetConfusion = window.consumeStatus(targetId, 'confusion');
      if (targetConfusion) {
        const bonus = targetConfusion.power;
        hitCtx.damage = Math.floor((Number(hitCtx.damage) || 0) * (1 + bonus));
        window.log(`  🌪️ ${targetId} 触发混乱(强度${targetConfusion.power})，受到的伤害增加至 ${hitCtx.damage} (+${bonus * 100}%)`);
      }
    },
    50,
  );

  engine.registerEffect(
    'onHit',
    'status_hit_effects',
    (ctx) => {
      const hitCtx = ctx as MutableContext;
      const targetId = hitCtx.targetId as UnitId;

      const targetRupture = window.consumeStatus(targetId, 'rupture');
      if (targetRupture) {
        hitCtx.extraTrueDamage = (Number(hitCtx.extraTrueDamage) || 0) + targetRupture.power;
        window.log(`  ${targetId} 触发破裂(受击)，附加真实伤害 ${targetRupture.power}`);
      }

      const targetSinking = window.consumeStatus(targetId, 'sinking');
      if (!targetSinking) return;

      const sanInputId = 'san' + targetId;
      const currentSan = window.getVal(sanInputId);
      if (currentSan > 0) {
        const sanDamage = Math.min(currentSan, targetSinking.power);
        const newSan = currentSan - sanDamage;
        window.setVal(sanInputId, newSan);
        window.log(`  ${targetId} 触发沉沦(受击)，失去 ${sanDamage} 点理智 (San: ${currentSan} → ${newSan})`);

        const spillOver = targetSinking.power - sanDamage;
        if (spillOver > 0) {
          window.dealDirectHpDamage(targetId, spillOver, '沉沦(理智耗尽溢出)');
        }
      } else {
        window.dealDirectHpDamage(targetId, targetSinking.power, '沉沦(理智为空)');
      }
    },
    50,
  );

  engine.registerEffect(
    'onTurnEnd',
    'status_turn_end_effects',
    (ctx) => {
      const unitId = (ctx as MutableContext).unitId as UnitId;
      const burn = window.consumeStatus(unitId, 'burn');
      if (burn) {
        window.dealDirectHpDamage(unitId, burn.power, '烧伤结算');
      }
    },
    50,
  );

  engine.registerEffect(
    'onAfterHit',
    'status_chaos_buildup',
    (ctx) => {
      const hitCtx = ctx as MutableContext;
      const targetId = hitCtx.targetId as UnitId;
      const hpDamageTaken = Number(hitCtx.hpDamageTaken) || 0;
      if (hpDamageTaken <= 0) return;

      const chaosInputId = 'chaos' + targetId;
      const thresholdInputId = 'chaosThreshold' + targetId;
      let currentChaos = window.getVal(chaosInputId);
      const threshold = window.getVal(thresholdInputId);
      currentChaos += hpDamageTaken;

      if (currentChaos >= threshold && threshold > 0) {
        const power = Math.floor(currentChaos / threshold);
        currentChaos = 0;
        window.log(`🌀 ${targetId} 混乱值达到阈值 ${threshold}，触发混乱状态！强度: ${power}`);
        applyOrUpdateStatus(targetId, 'confusion', power, 1);
      }

      window.setVal(chaosInputId, currentChaos);
    },
    50,
  );
}

function applyOrUpdateStatus(unitId: UnitId, type: string, powerToAdd: number, stackToSet = 1): void {
  const statusList = document.getElementById(`status-list-${unitId}`);
  if (!statusList) return;

  const existingItems = statusList.querySelectorAll('.status-item');
  for (const item of existingItems) {
    const typeSelect = item.querySelector('.status-type') as HTMLSelectElement | null;
    if (!typeSelect || typeSelect.value !== type) continue;

    const powerInput = item.querySelector('.status-power') as HTMLInputElement | null;
    if (powerInput) {
      const currentPower = Number.parseInt(powerInput.value, 10) || 0;
      powerInput.value = String(currentPower + powerToAdd);
    }

    const stackInput = item.querySelector('.status-stack') as HTMLInputElement | null;
    if (stackInput) {
      const currentStack = Number.parseInt(stackInput.value, 10) || 0;
      stackInput.value = String(currentStack + stackToSet);
    }

    window.log(`  🔄 更新 ${unitId} 的 ${type} 状态: 强度 +${powerToAdd}, 层数 +${stackToSet}`);
    return;
  }

  const newStatus = window.createStatusInput({
    type,
    stack: stackToSet,
    power: powerToAdd,
  });
  statusList.appendChild(newStatus);
  window.log(`  ✅ 为 ${unitId} 添加了新状态: ${type} (强度: ${powerToAdd})`);
}

function processSkillEffects(ctx: MutableContext, currentTiming: string): void {
  const effects = Array.isArray(ctx.skillEffects) ? (ctx.skillEffects as SkillEffectConfig[]) : [];
  if (effects.length === 0) return;

  effects.forEach((effect) => {
    if (!effect || effect.timing !== currentTiming) return;

    switch (effect.type) {
      case 'dmg':
        ctx.damage = (Number(ctx.damage) || 0) + (effect.value || 0);
        window.log(`  💥 [技能效果] 追加伤害 +${effect.value ?? 0} (当前总伤害: ${ctx.damage})`);
        break;
      case 'applyStatus': {
        const targetId = effect.target === 'self' ? (ctx.attackerId as UnitId) : (ctx.targetId as UnitId);
        applyOrUpdateStatus(targetId, effect.statusId ?? '', effect.power ?? 0, effect.stack ?? 0);
        window.log(`  ✨ [技能效果] 对 ${targetId} 赋予 [${effect.statusId ?? ''}] (强度+${effect.power ?? 0})`);
        break;
      }
      case 'heal': {
        const healTargetId = effect.target === 'enemy' ? (ctx.targetId as UnitId) : (ctx.attackerId as UnitId);
        const currentHp = window.getVal('hp' + healTargetId);
        const maxHp = window.getVal('maxHp' + healTargetId) || 999;
        const value = effect.value || 0;
        const newHp = Math.min(maxHp, currentHp + value);
        window.setVal('hp' + healTargetId, newHp);
        window.log(`  💚 [技能效果] 恢复生命值 +${value} (HP: ${currentHp} → ${newHp})`);
        break;
      }
      default:
        console.warn(`[CombatEngine] 未知的技能效果类型: ${effect.type}`);
    }
  });
}

window.registerAllCombatEffects = registerAllCombatEffects;

export { applyOrUpdateStatus, processSkillEffects, registerAllCombatEffects };

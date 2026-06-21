// plugins/status-modifiers.ts
import type { CombatEngine } from '../clash-logic-engine.ts';
import type { ClashContext, HitContext, UnitId } from '../types.ts';
import { applyOrUpdateStatus } from '../utils/combat-utils.ts';

export interface CombatPlugin {
  name: string;
  install: (engine: CombatEngine) => void;
}

// ✅ 拆分出精确的类型断言
type MutableClashContext = ClashContext & Record<string, unknown>;
type MutableHitContext = HitContext & Record<string, unknown>;

export const StatusModifiersPlugin: CombatPlugin = {
  name: 'Core_StatusModifiers',
  install(engine: CombatEngine) {
    
    // 1. 拼点阶段的状态修正
    engine.registerEffect('onBeforeClash', 'status_clash_modifiers', (ctx) => {
        const clashCtx = ctx as MutableClashContext; // ✅ 使用精确断言
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
      }, 50);

    // 2. 伤害计算前的状态修正
    engine.registerEffect('onBeforeHit', 'status_damage_modifiers', (ctx) => {
        const hitCtx = ctx as MutableHitContext; // ✅ 使用精确断言，TS 就能认出 damageInstances
        const attackerId = hitCtx.attackerId as UnitId;
        const targetId = hitCtx.targetId as UnitId;

        const hasDamageInstances = Array.isArray(hitCtx.damageInstances) && hitCtx.damageInstances.length > 0;

        // 攻击者状态结算
        const attackerBleed = window.consumeStatus(attackerId, 'bleed');
        if (attackerBleed) window.dealDirectHpDamage(attackerId, attackerBleed.power, '流血(攻击动作)');

        const attackerStrength = window.consumeStatus(attackerId, 'strength');
        if (attackerStrength && hasDamageInstances) {
          hitCtx.damageInstances[0].modifierFlat += attackerStrength.power;
          window.log(`  ${attackerId} 触发强壮，造成的伤害修正 +${attackerStrength.power}`);
        }

        const attackerFrailty = window.consumeStatus(attackerId, 'frailty');
        if (attackerFrailty && hasDamageInstances) {
          hitCtx.damageInstances[0].modifierFlat -= attackerFrailty.power;
          window.log(`  ${attackerId} 触发虚弱，造成的伤害修正 -${attackerFrailty.power}`);
        }

        // 受击者状态结算
        const targetVulnerability = window.consumeStatus(targetId, 'vulnerability');
        if (targetVulnerability && hasDamageInstances) {
          hitCtx.damageInstances[0].modifierFlat += targetVulnerability.power;
          window.log(`  ${targetId} 触发脆弱，受到的伤害修正 +${targetVulnerability.power}`);
        }

        const targetProtection = window.consumeStatus(targetId, 'protection');
        if (targetProtection && hasDamageInstances) {
          hitCtx.damageInstances[0].modifierFlat -= targetProtection.power;
          window.log(`  ${targetId} 触发守护，受到的伤害修正 -${targetProtection.power}`);
        }

        // 混乱状态乘区修正
        const targetConfusion = window.consumeStatus(targetId, 'confusion');
        if (targetConfusion && hasDamageInstances) {
          const bonus = targetConfusion.power;
          hitCtx.damageInstances.forEach(inst => {
            inst.multiplier *= (1 + bonus);
          });
          window.log(`  🌪️ ${targetId} 触发混乱(强度${targetConfusion.power})，所有伤害乘区增加 +${bonus * 100}%`);
        }
      }, 50);

    // 3. 命中时的状态结算
    engine.registerEffect('onHit', 'status_hit_effects', (ctx) => {
        const hitCtx = ctx as MutableHitContext; // ✅ 使用精确断言
        const targetId = hitCtx.targetId as UnitId;

        const targetRupture = window.consumeStatus(targetId, 'rupture');
        if (targetRupture && Array.isArray(hitCtx.damageInstances)) {
          hitCtx.damageInstances.push({
            tags: ['true_damage'],
            baseAmount: targetRupture.power,
            modifierFlat: 0,
            multiplier: 1.0,
            finalAmount: 0
          });
          window.log(`  ${targetId} 触发破裂(受击)，附加真实伤害段数 ${targetRupture.power}`);
        }

        const targetSinking = window.consumeStatus(targetId, 'sinking');
        if (targetSinking) {
          const sanInputId = 'san' + targetId;
          const currentSan = window.getVal(sanInputId);
          if (currentSan > 0) {
            const sanDamage = Math.min(currentSan, targetSinking.power);
            const newSan = currentSan - sanDamage;
            window.setVal(sanInputId, newSan);
            window.log(`  ${targetId} 触发沉沦(受击)，失去 ${sanDamage} 点理智 (San: ${currentSan} → ${newSan})`);

            const spillOver = targetSinking.power - sanDamage;
            if (spillOver > 0) window.dealDirectHpDamage(targetId, spillOver, '沉沦(理智耗尽溢出)');
          } else {
            window.dealDirectHpDamage(targetId, targetSinking.power, '沉沦(理智为空)');
          }
        }
      }, 50);

    // 4. 命中后的状态积累
    engine.registerEffect('onAfterHit', 'status_chaos_buildup', (ctx) => {
        const hitCtx = ctx as MutableHitContext; // ✅ 使用精确断言
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
      }, 50);

    // 5. 回合结束时的状态结算 (保持不变，但为了严谨稍微提一下)
    engine.registerEffect('onTurnEnd', 'status_turn_end_effects', (ctx) => {
        const unitId = (ctx as Record<string, unknown>).unitId as UnitId;
        if (!unitId) return;
        const burn = window.consumeStatus(unitId, 'burn');
        if (burn) window.dealDirectHpDamage(unitId, burn.power, '烧伤结算');
      }, 50);
  }
};
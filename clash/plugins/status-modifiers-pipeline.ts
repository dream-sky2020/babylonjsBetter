import type { ClashPipelineEngine, CombatPlugin } from '../clash-pipeline-engine.ts';
import type { ClashPayload, UnitId, DiceRollResult } from '../types.ts';
import { applyOrUpdateStatus } from '../utils/combat-utils.ts';

export const StatusModifiersPipelinePlugin: CombatPlugin = {
  name: 'Core_StatusModifiers_Pipeline',
  install(engine: ClashPipelineEngine) {
    
    // 1. 拼点阶段的状态修正
    engine.on('onBeforeClash', 'status_clash_modifiers', (payload: ClashPayload) => {
      const units = [payload.UnitA_selectedForClash, payload.UnitB_selectedForClash];
      const rolls = [payload.metadata.rollA as DiceRollResult[], payload.metadata.rollB as DiceRollResult[]];

      units.forEach((unit, idx) => {
        const unitId = unit.id;
        const unitRolls = rolls[idx];

        const strength = window.consumeStatus(unitId, 'strength');
        if (strength) {
          unitRolls.forEach(r => {
            r.finalRoll = (r.finalRoll ?? r.roll) + strength.power;
          });
          payload.logs.push(`  ${unit.name} 触发强壮，拼点点数 +${strength.power}`);
        }

        const frailty = window.consumeStatus(unitId, 'frailty');
        if (frailty) {
          unitRolls.forEach(r => {
            r.finalRoll = Math.max(0, (r.finalRoll ?? r.roll) - frailty.power);
          });
          payload.logs.push(`  ${unit.name} 触发虚弱，拼点点数 -${frailty.power}`);
        }
      });
    });

    // 2. 伤害计算前的状态修正
    engine.on('onBeforeHit', 'status_damage_modifiers', (payload: ClashPayload) => {
      const hit = payload.currentHit;
      if (!hit) return;

      const attackerId = hit.attackerId;
      const targetId = hit.targetIds[0]; // 假设单体攻击

      // 攻击者状态结算
      const attackerBleed = window.consumeStatus(attackerId, 'bleed');
      if (attackerBleed) {
        const attacker = payload.AllUnit.find(u => u.id === attackerId);
        if (attacker) {
          attacker.hp = Math.max(0, attacker.hp - attackerBleed.power);
          payload.logs.push(`  ${attacker.name} 触发流血(攻击动作)，受到 ${attackerBleed.power} 点伤害`);
        }
      }

      // 强壮/虚弱 影响后续生成的 DamagePayload
      // 注意：由于新引擎在 onHit 之后才生成默认 DamagePayload，
      // 插件可以在 onHit 阶段手动生成并应用修正，或者在 onBeforeDamage 阶段应用。
      // 这里我们在 metadata 中存一下修正值，稍后在 onBeforeDamage 使用。
      const attackerStrength = window.consumeStatus(attackerId, 'strength');
      const attackerFrailty = window.consumeStatus(attackerId, 'frailty');
      const targetVulnerability = window.consumeStatus(targetId, 'vulnerability');
      const targetProtection = window.consumeStatus(targetId, 'protection');

      let flatBonus = 0;
      if (attackerStrength) flatBonus += attackerStrength.power;
      if (attackerFrailty) flatBonus -= attackerFrailty.power;
      if (targetVulnerability) flatBonus += targetVulnerability.power;
      if (targetProtection) flatBonus -= targetProtection.power;

      if (flatBonus !== 0) {
        payload.metadata.currentHitFlatBonus = flatBonus;
        payload.logs.push(`  状态伤害修正总计: ${flatBonus > 0 ? '+' : ''}${flatBonus}`);
      }
    });

    // 3. 伤害计算中的状态应用
    engine.on('onBeforeDamage', 'apply_status_damage_modifiers', (payload: ClashPayload) => {
      const damage = payload.currentDamage;
      if (!damage) return;

      if (payload.metadata.currentHitFlatBonus) {
        damage.modifierFlat += payload.metadata.currentHitFlatBonus;
      }

      // 混乱状态乘区修正
      const targetId = damage.targetId;
      const targetConfusion = window.consumeStatus(targetId, 'confusion');
      if (targetConfusion) {
        const bonus = targetConfusion.power;
        damage.multiplier *= (1 + bonus);
        payload.logs.push(`  🌪️ ${targetId} 触发混乱，伤害乘区增加 +${bonus * 100}%`);
      }
    });

    // 4. 命中时的状态结算 (破裂/沉沦)
    engine.on('onHit', 'status_hit_effects', (payload: ClashPayload) => {
      const hit = payload.currentHit;
      if (!hit) return;
      const targetId = hit.targetIds[0];

      const targetRupture = window.consumeStatus(targetId, 'rupture');
      if (targetRupture) {
        // 破裂产生一段额外的真实伤害
        const ruptureDamage: any = {
          attackerId: hit.attackerId,
          targetId: targetId,
          skillId: hit.skillId,
          tags: ['true_damage', 'rupture'],
          baseDamage: targetRupture.power,
          capDamage: 999,
          modifierFlat: 0,
          multiplier: 1.0,
          finalDamage: 0,
          timing: 'onHit'
        };
        hit.damagePayloads.push(ruptureDamage);
        payload.logs.push(`  ${targetId} 触发破裂(受击)，附加真实伤害 ${targetRupture.power}`);
      }

      const targetSinking = window.consumeStatus(targetId, 'sinking');
      if (targetSinking) {
        const target = payload.AllUnit.find(u => u.id === targetId);
        if (target) {
          if (target.sanity > 0) {
            const sanDamage = Math.min(target.sanity, targetSinking.power);
            target.sanity -= sanDamage;
            payload.logs.push(`  ${target.name} 触发沉沦(受击)，失去 ${sanDamage} 点理智`);

            const spillOver = targetSinking.power - sanDamage;
            if (spillOver > 0) {
              target.hp = Math.max(0, target.hp - spillOver);
              payload.logs.push(`  理智耗尽溢出，受到 ${spillOver} 点实际伤害`);
            }
          } else {
            target.hp = Math.max(0, target.hp - targetSinking.power);
            payload.logs.push(`  理智为空，受到 ${targetSinking.power} 点实际伤害`);
          }
        }
      }
    });

    // 5. 伤害结算后的混乱值积累
    engine.on('onAfterDamage', 'status_chaos_buildup', (payload: ClashPayload) => {
      const damage = payload.currentDamage;
      if (!damage || damage.finalDamage <= 0) return;

      const target = payload.AllUnit.find(u => u.id === damage.targetId);
      if (!target) return;

      // 这里假设 hpDamageTaken 已经在引擎中扣除，我们直接根据 finalDamage 增加混乱值
      target.chaos += damage.finalDamage;

      if (target.chaos >= target.chaosThreshold && target.chaosThreshold > 0) {
        const power = Math.floor(target.chaos / target.chaosThreshold);
        target.chaos = 0;
        payload.logs.push(`🌀 ${target.name} 混乱值达到阈值，触发混乱状态！强度: ${power}`);
        applyOrUpdateStatus(target.id, 'confusion', power, 1);
      }
    });

    // 6. 死亡前拦截
    engine.on('onBeforeDeath', 'status_death_guard', (payload: ClashPayload) => {
      const death = payload.currentDeath;
      if (!death || death.deathPrevented) return;

      const target = payload.AllUnit.find(u => u.id === death.deathId);
      if (!target) return;

      const kAmpule = window.consumeStatus(target.id, 'kAmpule');
      if (kAmpule) {
        death.deathPrevented = true;
        death.reviveHp = target.maxHp;
        payload.logs.push(`  💉 ${target.name} 触发 K公司安瓿，阻止死亡并回复至满血`);
      }
    });

    // 7. 死亡后处理
    engine.on('onDeath', 'status_funeral_wedge_after_death', (payload: ClashPayload) => {
      const death = payload.currentDeath;
      if (!death) return;

      const target = payload.AllUnit.find(u => u.id === death.deathId);
      if (!target) return;

      const flowerWedge = window.consumeStatus(target.id, 'funeralWedge');
      if (!flowerWedge) return;

      death.deathPrevented = true; // 葬花楔实际上也是一种免死
      death.reviveHp = 6;
      payload.logs.push(`  ⚰️ ${target.name} 触发葬花楔，回复至 6 HP`);

      // 影响全体
      payload.AllUnit.forEach(u => {
        if (payload.LeftUnit.some(lu => lu.id === target.id) === payload.LeftUnit.some(lu => lu.id === u.id)) {
          // 盟友
          applyOrUpdateStatus(u.id, 'strength', 6, 6);
        } else {
          // 敌人
          applyOrUpdateStatus(u.id, 'rupture', 6, 6);
        }
      });
      payload.logs.push(`  🌸 葬花楔结算：友方全体获得强壮，敌方全体获得破裂`);
    });

    // 8. 回合结束时的状态结算
    engine.on('onTurnEnd', 'status_turn_end_effects', (payload: ClashPayload) => {
      payload.AllUnit.forEach(unit => {
        const burn = window.consumeStatus(unit.id, 'burn');
        if (burn) {
          unit.hp = Math.max(0, unit.hp - burn.power);
          payload.logs.push(`  ${unit.name} 触发烧伤结算，受到 ${burn.power} 点伤害`);
        }
      });
    });
  }
};

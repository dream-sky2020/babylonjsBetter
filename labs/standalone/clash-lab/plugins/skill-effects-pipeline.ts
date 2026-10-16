import type { ClashPipelineEngine, CombatPlugin } from '../clash-pipeline-engine.ts';
import type { ClashPayload, SkillEffectConfig, UnitId } from '../types.ts';
import { applyOrUpdateStatus } from '../utils/combat-utils.ts';

export const SkillEffectsPipelinePlugin: CombatPlugin = {
  name: 'Core_SkillEffects_Pipeline',
  install(engine: ClashPipelineEngine) {
    
    const processEffects = (payload: ClashPayload, timing: string) => {
      // 确定当前动作的发起者和目标
      let attackerId: string | undefined;
      let targetId: string | undefined;
      let effects: SkillEffectConfig[] = [];

      if (payload.currentPhase === 'onBeforeClash' || payload.currentPhase === 'onClashEnd') {
        // 拼点阶段，双方都可能触发技能效果
        [payload.UnitA_selectedForClash, payload.UnitB_selectedForClash].forEach(unit => {
          const skill = unit.id === payload.UnitA_selectedForClash.id ? payload.SkillA_selectedForClash : payload.SkillB_selectedForClash;
          const unitEffects = skill.skillEffects.filter(e => e.timing === timing);
          if (unitEffects.length > 0) {
            const opponentId = unit.id === payload.UnitA_selectedForClash.id ? payload.UnitB_selectedForClash.id : payload.UnitA_selectedForClash.id;
            applyEffects(payload, unitEffects, unit.id, opponentId);
          }
        });
        return;
      } else if (payload.currentHit) {
        attackerId = payload.currentHit.attackerId;
        targetId = payload.currentHit.targetIds[0];
        const attacker = payload.AllUnit.find(u => u.id === attackerId);
        const skill = attacker?.id === payload.UnitA_selectedForClash.id ? payload.SkillA_selectedForClash : payload.SkillB_selectedForClash;
        effects = skill?.skillEffects.filter(e => e.timing === timing) || [];
      }

      if (effects.length > 0 && attackerId && targetId) {
        applyEffects(payload, effects, attackerId, targetId);
      }
    };

    const applyEffects = (payload: ClashPayload, effects: SkillEffectConfig[], attackerId: string, targetId: string) => {
      effects.forEach(effect => {
        switch (effect.type) {
          case 'dmg':
            if (payload.currentDamage) {
              payload.currentDamage.modifierFlat += (effect.value || 0);
              payload.logs.push(`  💥 [技能效果] 伤害修正 +${effect.value || 0}`);
            } else if (payload.currentHit) {
              // 如果在 onBeforeHit 阶段，存入 metadata
              payload.metadata.skillDamageBonus = (payload.metadata.skillDamageBonus || 0) + (effect.value || 0);
            }
            break;
          case 'applyStatus': {
            const finalTargetId = effect.target === 'self' ? attackerId : targetId;
            applyOrUpdateStatus(finalTargetId as UnitId, effect.statusId ?? '', effect.power ?? 0, effect.stack ?? 0);
            payload.logs.push(`  ✨ [技能效果] 对 ${finalTargetId} 赋予 [${effect.statusId}] (强度+${effect.power})`);
            break;
          }
          case 'heal': {
            const healTargetId = effect.target === 'enemy' ? targetId : attackerId;
            const target = payload.AllUnit.find(u => u.id === healTargetId);
            if (target) {
              const oldHp = target.hp;
              target.hp = Math.min(target.maxHp, target.hp + (effect.value || 0));
              payload.logs.push(`  💚 [技能效果] ${target.name} 恢复生命值 +${effect.value || 0} (HP: ${oldHp} → ${target.hp})`);
            }
            break;
          }
        }
      });
    };

    engine.on('onBeforeClash', 'skill_effects_before_clash', (p) => processEffects(p, 'onBeforeClash'));
    
    engine.on('onClashEnd', 'skill_effects_clash_win', (p) => {
      if (p.winnerId) {
        // 只有胜者触发 onClashWin
        const winner = p.AllUnit.find(u => u.id === p.winnerId);
        const skill = winner?.id === p.UnitA_selectedForClash.id ? p.SkillA_selectedForClash : p.SkillB_selectedForClash;
        const effects = skill?.skillEffects.filter(e => e.timing === 'onClashWin') || [];
        const loserId = p.winnerId === p.UnitA_selectedForClash.id ? p.UnitB_selectedForClash.id : p.UnitA_selectedForClash.id;
        applyEffects(p, effects, p.winnerId, loserId);
      }
    });

    engine.on('onBeforeHit', 'skill_effects_before_hit', (p) => processEffects(p, 'onBeforeHit'));
    engine.on('onHit', 'skill_effects_hit', (p) => processEffects(p, 'onHit'));
    engine.on('onAfterHit', 'skill_effects_after_hit', (p) => processEffects(p, 'onAfterHit'));

    // 在伤害计算前应用技能伤害加成
    engine.on('onBeforeDamage', 'apply_skill_damage_bonus', (p) => {
      if (p.currentDamage && p.metadata.skillDamageBonus) {
        p.currentDamage.modifierFlat += p.metadata.skillDamageBonus;
        p.metadata.skillDamageBonus = 0; // 用完清空
      }
    });
  }
};

import type { ClashPipelineEngine, CombatPlugin } from '../clash-pipeline-engine.ts';
import type { ClashPayload, UnitId } from '../types.ts';
import { applyOrUpdateStatus } from '../utils/combat-utils.ts';

export const CoinEffectsPipelinePlugin: CombatPlugin = {
  name: 'Core_CoinEffects_Pipeline',
  install(engine: ClashPipelineEngine) {
    
    // 1. 硬币：追加常规伤害或标签
    engine.on('onBeforeHit', 'coin_dynamic_damage', (payload: ClashPayload) => {
      const hit = payload.currentHit;
      if (!hit) return;

      const effects = hit.dice.effects || [];
      
      effects.forEach((effect) => {
        if (effect.type === 'dmg') {
          const value = Number(effect.value) || 0;
          // 存入 metadata，稍后在 onBeforeDamage 应用
          payload.metadata.currentCoinDamageBonus = (payload.metadata.currentCoinDamageBonus || 0) + value;
          
          // 如果有标签，直接加到 hit 对应的骰子上（虽然骰子已经拷贝，但这里可以记录）
          if (effect.tags && effect.tags.length > 0) {
            const mergedTags = new Set([...hit.dice.tags, ...effect.tags]);
            hit.dice.tags = Array.from(mergedTags);
          }
          payload.logs.push(`  💥 触发硬币效果：追加基础伤害修正 +${value}`);
        }
      });
    });

    // 2. 在伤害计算前应用硬币伤害加成
    engine.on('onBeforeDamage', 'apply_coin_damage_bonus', (payload: ClashPayload) => {
      if (payload.currentDamage && payload.metadata.currentCoinDamageBonus) {
        payload.currentDamage.modifierFlat += payload.metadata.currentCoinDamageBonus;
        payload.metadata.currentCoinDamageBonus = 0; // 用完清空
      }
    });

    // 3. 硬币：赋予状态
    engine.on('onHit', 'coin_dynamic_apply_status', (payload: ClashPayload) => {
      const hit = payload.currentHit;
      if (!hit) return;

      const effects = hit.dice.effects || [];
      const targetId = hit.targetIds[0];
      
      effects.forEach((effect) => {
        if (effect.type === 'applyStatus') {
          applyOrUpdateStatus(
            targetId as UnitId,
            effect.statusId ?? '',
            effect.power ?? 0,
            effect.stack ?? 0,
          );
          payload.logs.push(
            `  ✨ 触发硬币效果：对 ${targetId} 赋予 [${effect.statusId}] (强度+${effect.power}, 层数+${effect.stack})`,
          );
        }
      });
    });
  }
};

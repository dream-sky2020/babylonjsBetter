// plugins/coin-effects.ts
import type { CombatEngine } from '../clash-logic-engine.ts';
import type { ClashContext, HitContext, UnitId } from '../types.ts';
import { applyOrUpdateStatus } from '../utils/combat-utils.ts';

export interface CombatPlugin {
  name: string;
  install: (engine: CombatEngine) => void;
}

type MutableContext = (ClashContext | HitContext) & Record<string, unknown>;

export const CoinEffectsPlugin: CombatPlugin = {
  name: 'Core_CoinEffects',
  install(engine: CombatEngine) {
    // 1. 硬币：追加常规伤害
    engine.registerEffect(
      'onBeforeHit',
      'coin_dynamic_damage',
      (ctx) => {
        const hitCtx = ctx as MutableContext;
        const effects = Array.isArray(hitCtx.effects) ? hitCtx.effects : [];
        
        effects.forEach((effect) => {
          if (effect && typeof effect === 'object' && (effect as Record<string, unknown>).type === 'dmg') {
            const value = Number((effect as Record<string, unknown>).value) || 0;
            // ✅ 适配 DamageInstance：附加到首段伤害的固定修正区
            if (Array.isArray(hitCtx.damageInstances) && hitCtx.damageInstances.length > 0) {
              hitCtx.damageInstances[0].modifierFlat += value;
              window.log(`  💥 触发硬币效果：追加基础伤害修正 +${value}`);
            }
          }
        });
      },
      60,
    );

    // 2. 硬币：赋予状态 (保持不变)
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
  }
};
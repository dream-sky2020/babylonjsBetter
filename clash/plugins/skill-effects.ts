// plugins/skill-effects.ts
import type { CombatEngine } from '../clash-logic-engine.ts';
import type { ClashContext, HitContext } from '../types.ts';
import { processSkillEffects } from '../utils/combat-utils.ts';
import type { CombatPlugin } from './coin-effects.ts'; // 复用接口

type MutableContext = (ClashContext | HitContext) & Record<string, unknown>;

export const SkillEffectsPlugin: CombatPlugin = {
  name: 'Core_SkillEffects',
  install(engine: CombatEngine) {
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
  }
};
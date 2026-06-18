import type { CombatPhase } from './types.ts';

type EffectHandler = (context: Record<string, unknown>) => void;

interface RegisteredEffect {
  name: string;
  fn: EffectHandler;
  priority: number;
}

type HookMap = Record<CombatPhase, RegisteredEffect[]>;

export class CombatEngine {
  private hooks: HookMap = {
    onTurnStart: [],
    onBeforeClash: [],
    onClashEnd: [],
    onBeforeHit: [],
    onHit: [],
    onAfterHit: [],
    onTurnEnd: [],
  };

  registerEffect(phase: CombatPhase, name: string, fn: EffectHandler, priority = 50): void {
    this.hooks[phase] = this.hooks[phase].filter((effect) => effect.name !== name);
    this.hooks[phase].push({ name, fn, priority });
    this.hooks[phase].sort((a, b) => b.priority - a.priority);
  }

  trigger<T extends Record<string, unknown>>(phase: CombatPhase, context: T): T {
    const phaseHooks = this.hooks[phase];
    if (phaseHooks.length === 0) return context;

    for (const effect of phaseHooks) {
      try {
        effect.fn(context);
      } catch (error) {
        console.error(`[CombatEngine] 执行效果 [${effect.name}] 在阶段 [${phase}] 时发生崩溃:`, error);
      }
    }
    return context;
  }

  clearHooks(phase?: CombatPhase): void {
    if (phase) {
      this.hooks[phase] = [];
      return;
    }
    (Object.keys(this.hooks) as CombatPhase[]).forEach((key) => {
      this.hooks[key] = [];
    });
  }
}

export const combatEngine = new CombatEngine();

window.CombatEngine = CombatEngine;
window.combatEngine = combatEngine;

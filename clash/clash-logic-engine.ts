import type { CombatPhase } from './types.ts';
import { clampUnitHpToMax } from './utils/combat-utils.ts';

export interface CombatPlugin {
  /** 插件的唯一名称，用于调试和排查 */
  name: string;
  /** 插件的安装方法，引擎会将自身的实例注入进来 */
  install: (engine: CombatEngine) => void;
}

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

  // 新增：插件注册中心
  private registeredPlugins: Set<string> = new Set();

  // 新增：挂载插件的方法
  use(plugin: CombatPlugin): this {
    if (this.registeredPlugins.has(plugin.name)) {
      console.warn(`[CombatEngine] 插件 [${plugin.name}] 已经注册过，跳过。`);
      return this;
    }
    
    try {
      plugin.install(this);
      this.registeredPlugins.add(plugin.name);
      console.log(`[CombatEngine] 🔌 成功挂载插件: ${plugin.name}`);
    } catch (error) {
      console.error(`[CombatEngine] ❌ 插件 [${plugin.name}] 挂载失败:`, error);
    }
    
    return this; // 支持链式调用
  }


  registerEffect(phase: CombatPhase, name: string, fn: EffectHandler, priority = 50): void {
    this.hooks[phase] = this.hooks[phase].filter((effect) => effect.name !== name);
    this.hooks[phase].push({ name, fn, priority });
    this.hooks[phase].sort((a, b) => b.priority - a.priority);
  }

  private sanitizeContextUnits(context: Record<string, unknown>): void {
    const maybeIds = [context.unitId, context.attackerId, context.targetId];
    maybeIds.forEach((id) => {
      if (typeof id === 'string' && id.length > 0) {
        clampUnitHpToMax(id);
      }
    });
  }

  trigger<T extends Record<string, unknown>>(phase: CombatPhase, context: T): T {
    this.sanitizeContextUnits(context);
    const phaseHooks = this.hooks[phase];
    if (phaseHooks.length === 0) return context;

    for (const effect of phaseHooks) {
      try {
        effect.fn(context);
        this.sanitizeContextUnits(context);
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

window.combatEngine = combatEngine;

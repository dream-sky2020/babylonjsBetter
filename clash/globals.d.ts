import type { CombatEngine } from './clash-logic-engine.ts';
import type { DiceConfig, DiceRollResult, SkillEffectConfig, StatusConfig, UnitId } from './types.ts';

declare global {
  interface DiceInputElement extends HTMLElement {
    setValues(data: Partial<DiceConfig>): void;
    getData(): DiceConfig;
  }

  interface SkillEffectInputElement extends HTMLElement {
    setValues(data: Partial<SkillEffectConfig>): void;
    getData(): SkillEffectConfig;
  }

  interface EffectInputElement extends HTMLElement {
    setValues(data: unknown): void;
    getData(): unknown;
  }

  interface Window {
    CombatEngine: typeof CombatEngine;
    combatEngine: CombatEngine;
    startClash: () => void;
    endTurn: () => void;
    applyDamage: (attackerId: UnitId, targetId: UnitId, results: DiceRollResult[]) => void;
    registerAllCombatEffects: (engine: CombatEngine) => void;
    log: (msg: string) => void;
    getVal: (id: string) => number;
    setVal: (id: string, val: number) => void;
    buildStatusConfig: (unitId: UnitId) => StatusConfig[];
    buildSkillEffectConfig: (unitId: UnitId) => SkillEffectConfig[];
    consumeStatus: (unitId: UnitId, typeId: string) => {
      type: string;
      label: string;
      power: number;
      prevStack: number;
      nextStack: number;
    } | null;
    dealDirectHpDamage: (unitId: UnitId, amount: number, reason: string) => number;
    createStatusInput: (data?: Partial<StatusConfig>) => HTMLElement;
  }
}

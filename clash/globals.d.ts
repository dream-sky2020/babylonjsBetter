import type { CombatEngine } from './clash-logic-engine.ts';
import type { DiceConfig, DiceRollResult, SkillData, SkillEffectConfig, StatusConfig, UnitId } from './types.ts';

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

  interface StatusInputElement extends HTMLElement {
    setValues(data: Partial<StatusConfig>): void;
    getData(): StatusConfig;
  }

  interface UnitInputElement extends HTMLElement {
    setValues(data: Partial<import('./types.ts').UnitConfig>): void;
    getData(): import('./types.ts').UnitConfig;
    setUnitId(id: string): void;
    getUnitId(): string;
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
    getUnitElement: (unitId: UnitId) => UnitInputElement | null;
    buildStatusConfig: (unitId: UnitId) => StatusConfig[];
    buildSkillData: (unitId: UnitId) => SkillData | null;
    buildDiceConfig: (unitId: UnitId) => DiceConfig[];
    buildSkillEffectConfig: (unitId: UnitId) => SkillEffectConfig[];
    consumeStatus: (unitId: UnitId, typeId: string) => {
      type: string;
      label: string;
      power: number;
      prevStack: number;
      nextStack: number;
    } | null;
    dealDirectHpDamage: (unitId: UnitId, amount: number, reason: string) => number;
    createStatusInput: (data?: Partial<StatusConfig>) => StatusInputElement;
  }
}

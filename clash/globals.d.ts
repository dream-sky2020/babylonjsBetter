import type { ClashPipelineEngine } from './clash-pipeline-engine.ts';
import type { DiceConfig, SkillData, SkillEffectConfig, StatusConfig, UnitId, UnitConfig } from './types.ts';

declare global {
  interface Window {
    clashPipelineEngine: ClashPipelineEngine;
    startClash: () => void;
    endTurn: () => void;
    log: (msg: string) => void;
    getVal: (id: string) => number;
    setVal: (id: string, val: number) => void;
    getUnitElement: (unitId: UnitId) => {
        getData: () => UnitConfig;
        setValues: (updates: Partial<UnitConfig>) => void;
        getUnitId: () => string;
    } | null;
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
  }
}

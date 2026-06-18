export type UnitId = 'A' | 'B';

export type CombatPhase =
  | 'onTurnStart'
  | 'onBeforeClash'
  | 'onClashEnd'
  | 'onBeforeHit'
  | 'onHit'
  | 'onAfterHit'
  | 'onTurnEnd';

export interface StatusConfig {
  type: string;
  stack: number;
  power: number;
}

export interface SkillEffectConfig {
  timing: string;
  type: 'dmg' | 'applyStatus' | 'heal' | string;
  value?: number;
  statusId?: string;
  power?: number;
  stack?: number;
  target?: 'self' | 'enemy';
}

export interface DiceEffectConfig {
  type: 'dmg' | 'applyStatus' | string;
  value?: number;
  statusId?: string;
  power?: number;
  stack?: number;
}

export interface DiceConfig {
  tags: string[];
  min: number;
  max: number;
  effects?: DiceEffectConfig[];
}

export interface DiceRollResult {
  die: DiceConfig;
  roll: number;
  finalRoll?: number;
  effects?: DiceEffectConfig[];
}

export interface ClashContext {
  unitId: UnitId;
  attackerId: UnitId;
  targetId: UnitId;
  coinIndex: number;
  baseRoll: number;
  currentRoll: number;
  skillEffects?: SkillEffectConfig[];
  isWinner?: boolean;
}

export interface HitContext {
  attackerId: UnitId;
  targetId: UnitId;
  coinIndex: number;
  baseRoll: number;
  damage: number;
  extraTrueDamage?: number;
  effects?: DiceEffectConfig[];
  skillEffects?: SkillEffectConfig[];
  hpDamageTaken?: number;
}

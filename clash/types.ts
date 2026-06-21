// --- 3. 完整的技能数据结构 ---

export interface SkillData {
  tags: string[];             // 技能标签，例如 'passive', 'active', 'buff', 'debuff'
  skillId: string;            // 技能的唯一标识符
  skillName: string;          // 技能名称
  dice: DiceConfig[];         // 编辑器生成的硬币列表
  skillEffects: SkillEffectConfig[];
}

// 1. 新增全局战场上下文
export interface BattleContext {
  leftCamp: UnitId[];
  rightCamp: UnitId[];
  turnCount: number;
  // 未来可以扩展: weather, globalBuffs 等
}

export type UnitId = string;

export interface UnitConfig {
  id: UnitId;
  name: string;
  hp: number;
  maxHp: number;
  shield: number;
  tempShield: number;
  sanity: number;
  maxSanity: number;
  chaos: number;
  chaosThreshold: number;
  status: StatusConfig[];
  skills: SkillData[];
  activeSkillId?: string;
}

export type CombatPhase =
  | 'onTurnStart'
  | 'onBeforeClash'
  | 'onClashEnd'
  | 'onBeforeHit'
  | 'onHit'
  | 'onAfterHit'
  | 'onTurnEnd';

// 结构化的伤害实例
export interface DamageInstance {
  tags: string[];           // 伤害标签，例如 'slash', 'pierce', 'true_damage'
  baseAmount: number;    // 初始基础伤害
  modifierFlat: number;  // 固定修正值（如 攻击力buff带来的固定增伤）
  multiplier: number;    // 乘区修正值（如 50%抗性即为 0.5，200%暴击即为 2.0）
  finalAmount: number;   // 最终结算伤害
}

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
  battle: BattleContext; // ✅ 注入全局战场
}

export interface HitContext {
  attackerId: UnitId;
  targetId: UnitId;
  coinIndex: number;
  baseRoll: number;
  damageInstances: DamageInstance[];
  extraTrueDamage?: number;
  effects?: DiceEffectConfig[];
  skillEffects?: SkillEffectConfig[];
  hpDamageTaken?: number;
  battle: BattleContext; // ✅ 注入全局战场
}

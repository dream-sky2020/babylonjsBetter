export interface ClashPayload{

  currentPhase: CombatPhase;//记录当前管道运行到了哪个阶段（如 onBeforeClash, onHit 等）。

  AllUnit: UnitConfig[];//全部单位
  LeftUnit: UnitConfig[];//只是代表位置不一样而已,不代表阵营
  RightUnit: UnitConfig[];//只是代表位置不一样而已,不代表阵营,后期会搞一个多个单位乱战的

  turnCount: number; //这是第几回合的战斗

  UnitA_selectedForClash: UnitConfig;//参与拼点的单位,其实同一阵营下也可以发生拼点,比如陷入疯狂自相残杀时
  UnitB_selectedForClash: UnitConfig;

  SkillA_selectedForClash: SkillData;//参与拼点的技能,隶属于A单位
  SkillB_selectedForClash: SkillData;//参与拼点的技能,隶属于B单位

  DicesA_selectedForClash: DiceConfig[];//参与拼点的骰子,隶属于A单位,一般还是会拷贝一份的,万一出现了
  DicesB_selectedForClash: DiceConfig[];//参与拼点的骰子,隶属于A单位


  clashCount: number; //记录已经拼了第几次点了
  clashCountMax: number;//决定拼点上限,一般是99,平局会重新拼点,但是超过拼点上限就无法拼点了,平局99次还是太离谱了

  winnerId: UnitId | null;// 记录拼点胜出者的 ID，方便后续 Hit 和 Damage 阶段直接引用。
  loserId: UnitId | null;// 记录拼点失败者的 ID。
  
  isFinished: boolean;// 标识本次拼点逻辑是否已全部执行完毕。


  hitPayloads: HitPayload[];//存储本次拼点后,胜利一方造成的全部的命中数据
  damagePayloads: DamagePayload[];//存储本次拼点造成的全部的伤害数据

  deathPayloads: DeathPayload[];//存储本次拼点造成的全部死亡数据

  logs: string[];//存储战斗过程中产生的文本日志

  currentHit: HitPayload | null; //当前正在处理的命中数据。
  currentDamage: DamagePayload | null;// 当前正在处理的伤害数据。
  currentDeath: DeathPayload | null;// 当前正在处理的死亡数据。

  metadata: Record<string, any>;// 插件自定义数据存储区
}

export interface HitPayload{
  // 基础身份信息
  attackerId: string;//不大可能是空的
  targetIds: string[];   // 支持群体攻击
  skillId: string;//不大可能是空的

  dice: DiceConfig;         // 攻击的骰子本身
  
  diceRollResult: DiceRollResult; // 骰子掷出的结果

  damagePayloads: DamagePayload[];//存储本次硬币全部的伤害数据
}


export interface DamagePayload{

  // 基础身份信息
  attackerId: string;//状态伤害attackerId写'status_effect'
  targetId: string;//不大可能是空的
  
  skillId: string;//'STATUS_EFFECT_ID': 当伤害由“流血”、“烧伤”等状态结算产生时使用。'ENVIRONMENT_ID': 当伤害由环境机制或其他非角色触发的逻辑产生时使用。'UNKNOWN_ID': 作为兜底项。

  // 伤害标签用于复杂计算
  tags: string[];           // 对应之前的 DamageTagOption
  
  baseDamage: number;

  capDamage: number;  //最大伤害上限

  modifierFlat: number;  // 固定修正值（如 攻击力buff带来的固定增伤）
  multiplier: number;    // 乘区修正值（如 50%抗性即为 0.5，200%暴击即为 2.0）
  
  finalDamage: number;

  // 触发时机
  timing: string; // 结合CombatPhase来填写 比如'onHit' | 'onAfterHit'

}

export interface DeathPayload{
  //一般拼点结束后填写
  deathId: string;//死亡者的id

  reason: string;//死亡原因

  deathPrevented: boolean;//是否被死亡拦截

  reviveHp: number;//复活后的hp
}


export interface SkillData {
  tags: string[];             // 技能标签，例如 'passive', 'active', 'buff', 'debuff'
  skillId: string;            // 技能的唯一标识符
  skillName: string;          // 技能名称
  dice: DiceConfig[];         // 编辑器生成的硬币列表
  skillEffects: SkillEffectConfig[];
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
  | 'onBeforeDamage'
  | 'onDamage'
  | 'onAfterDamage'
  | 'onBeforeDeath'
  | 'onDeath'
  | 'onAfterDeath'
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
  tags?: string[];
  statusId?: string;
  power?: number;
  stack?: number;
  target?: 'self' | 'enemy';
}

export interface DiceEffectConfig {
  type: 'dmg' | 'applyStatus' | string;
  value?: number;
  tags?: string[];
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
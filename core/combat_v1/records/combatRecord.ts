import type { TurnPhase } from '../turns/turnPhase.ts';

/** 效果来源快照；持续效果在施加时保存，后续每次结算继承，不按当前控制关系重新推断。 */
export type EffectSource = {
  /** 直接产生效果的角色实例 ID；无角色来源的环境效果填 null。 */
  actorId: string | null;
  /** 战绩归属角色实例 ID，例如召唤物主人；无角色归属时填 null。 */
  creditCharacterId: string | null;
  /** 战绩归属用户 ID；敌人或无用户归属的环境效果可省略。 */
  userId?: string;
  /** 来源类别：技能、物品、状态或环境。 */
  kind: 'skill' | 'item' | 'status' | 'environment';
  /** 对应技能、物品、状态或环境效果的定义 ID。 */
  definitionId: string;
  /** 来源实例 ID，例如某人施加的中毒实例，用于区分同名效果。 */
  instanceId?: string;
  /** 本次行动或效果发动的唯一标识；同一次多段攻击共享该标识。 */
  actionId: string;
  /** 触发本效果的上一条结算记录 ID，例如触发反伤的伤害记录；主动发动时可省略。 */
  parentEventId?: string;
};

/** 已成功提交的单次结算记录；请求、预览和未提交结果不应写入战绩记录。 */
export type CombatRecordBase = {
  /** 本场战斗内唯一的记录 ID；统计时按 battleId + id 去重。 */
  id: string;
  /** 所属战斗的唯一标识，避免跨战斗汇总时混淆记录。 */
  battleId: string;
  /** 本次效果的来源和战绩归属快照。 */
  source: EffectSource;
  /** 承受本次效果的角色实例 ID。 */
  targetId: string;
  /** 结算发生的轮数，从 1 开始。 */
  round: number;
  /** 结算发生的我方或非我方阶段。 */
  phase: TurnPhase;
};

/** 单个目标、单段伤害的最终结算结果；多目标或多段攻击分别记录。 */
export type DamageRecord = CombatRecordBase & {
  /** 记录类型，用于区分伤害与治疗。 */
  type: 'damage';
  /** 进入防御、减伤等计算前的非负伤害量。 */
  requestedDamage: number;
  /** 经过伤害计算后、由护盾和生命承受的非负伤害量。 */
  resolvedDamage: number;
  /** 实际扣除的护盾量。 */
  shieldDamage: number;
  /** 实际扣除的生命值，不包含护盾伤害和过量伤害。 */
  hpDamage: number;
  /** 超过目标可承受部分的伤害，不计入有效伤害。 */
  overkill: number;
  /** 本段伤害是否暴击。 */
  critical: boolean;
};

/** 单个目标、单次治疗的最终结算结果。 */
export type HealingRecord = CombatRecordBase & {
  /** 记录类型，用于区分伤害与治疗。 */
  type: 'healing';
  /** 经过治疗加成、禁疗等计算后，实际恢复前的非负治疗量。 */
  resolvedHealing: number;
  /** 实际恢复的生命值，作为有效治疗量统计。 */
  hpRestored: number;
  /** 因生命上限而未实际恢复的部分，单独统计为过量治疗。 */
  overheal: number;
};

/** 可按 type 判断具体结构的伤害或治疗结算记录。 */
export type CombatRecord = DamageRecord | HealingRecord;

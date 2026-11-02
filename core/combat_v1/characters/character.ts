import type { CharacterStats } from '../attributes/attributes.ts';
import type { ItemUnit } from '../items/types.ts';
import type { UsageLimits } from '../skills/usageLimits.ts';
import type { UseContext } from '../effects/usage.ts';
import type { CombatFaction } from '../turns/turnPhase.ts';
import type { int } from '@babylonjs/core';

/** 单个角色持有的技能状态，不与其他角色共享可变数据。 */
export type CharacterSkillState = {
  /** 对应技能定义的唯一标识。 */
  skillId: string;
  /** 此角色持有该技能的等级。 */
  level: number;
  /** 技能是否启用；发动时由调用方传入并校验。 */
  enabled: boolean;
  /** 按战斗中（battle）和战斗外（field）分别保存的可变使用限制，包括消耗、冷却与次数。 */
  usageLimits: Partial<Record<UseContext, UsageLimits>>;
};

/** 战斗角色的运行数据；当前生命、魔法、技能值及其上限统一保存在 stats 中。 */
export type CombatCharacter = {
  /** 角色在本场战斗中的唯一实例标识，由调用方保证不重复。 */
  id: string;
  /** 角色执行行动的顺序，这个是给非我方队伍中的角色使用的。 */
  order: int;
  /** 角色显示名称。 */
  name: string;
  /** 阵营：ally 为我方，enemy 为敌人，neutral 为中立；敌人与中立均在非我方阶段行动。 */
  faction: CombatFaction;
  /** 当前完整属性快照，包括生命、魔法、技能值、资源上限及其他战斗属性。 */
  stats: CharacterStats;
  /** 当前状态：键为状态标识，值为剩余回合数；递减与移除时机由战斗流程控制。 */
  statuses: Record<string, number>;
  /** 正常行动的分配配置；默认每个角色回合 1 次，Boss 可以配置多次。 */
  actionDefinition: { normalActionsPerTurn: number };
  /** 当前剩余的正常行动和额外行动次数；创建角色时均为 0，由战斗流程显式分配。 */
  actions: {
    /** 剩余正常行动，创建时尚未分配。 */
    normal: number;
    /** 剩余额外行动，创建时尚未获得。 */
    extra: number;
  };
  /** 此角色持有的技能列表，包含等级、启用状态和独立的使用限制。 */
  skills: CharacterSkillState[];
  /** 当前装备：键为装备位置标识，值为物品单元；null 表示该位置没有装备。 */
  equipment: Record<string, ItemUnit | null>;
};

/** 角色创建输入：标识、名称、阵营和属性必填，其余字段可省略；行动余额由工厂初始化。 */
export type CharacterDefinition = Pick<CombatCharacter, 'id' | 'name' | 'faction' | 'stats'> &
Partial<Pick<CombatCharacter,
  'order' | 'statuses' | 'actionDefinition' | 'skills' | 'equipment'
>>;
/** 深拷贝创建独立的运行角色，避免修改输入或其他角色；之后由战斗流程显式分配行动。 */
export function createCombatCharacter(definition: CharacterDefinition): CombatCharacter {
  return structuredClone({
    ...definition,
    order: definition.order ?? 0,
    statuses: definition.statuses ?? {},
    actionDefinition: definition.actionDefinition ?? { normalActionsPerTurn: 1 },
    actions: {
      // 剩余正常行动，创建时尚未分配。
      normal: 0,
      // 剩余额外行动，创建时尚未获得。
      extra: 0,
    },
    skills: definition.skills ?? [],
    equipment: definition.equipment ?? {},
  });
}

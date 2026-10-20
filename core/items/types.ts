import type { AttributeModifier } from '../combat/modifiers.ts';
import type { EffectAction, ItemStorageLimits, ItemUseProfiles } from './usage.ts';

export type ItemBase = { id: string; name: string; description: string; storage?: ItemStorageLimits; use?: ItemUseProfiles };
export type WearRule =
  | { kind: 'chanceOnly'; breakChance: number }
  | { kind: 'durability'; breakChance: number; maxDurability: number; durabilityLoss: number };
export type EquipmentSkill = { skillId: string; level: number; mode: 'grant' | 'levelBonus' };
export type EquipmentDefinition = ItemBase & {
  kind: 'equipment';
  slot: string;
  modifiers: AttributeModifier[];
  skills: EquipmentSkill[];
  wear: WearRule;
};
export type SkillAction = EffectAction & { cost: { mp?: number; sp?: number }; turnCost?: 0 | 1 };
export type SkillItemDefinition = Omit<ItemBase, 'use'> & { kind: 'skill'; modifiers: AttributeModifier[]; active?: { battle?: SkillAction; field?: SkillAction } };
export type ItemDefinition = EquipmentDefinition | SkillItemDefinition;
export type Enchantment = { id: string; modifiers: AttributeModifier[]; skills?: EquipmentSkill[] };
export type PlainItem = { kind: 'plain'; definitionId: string };
export type UniqueItem = { kind: 'unique'; instanceId: string; definitionId: string; enchantments: Enchantment[]; skillLevels?: Record<string, number>; extraModifiers?: AttributeModifier[]; durability?: number };
export type ItemUnit = PlainItem | UniqueItem;
export type ItemInventory = { stacks: Record<string, number>; uniques: UniqueItem[] };

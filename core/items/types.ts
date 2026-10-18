import type { AttributeModifier } from '../combat/modifiers.ts';
import type { ItemStorageLimits, ItemUseProfiles } from './usage.ts';

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
export type SkillItemDefinition = ItemBase & { kind: 'skill'; mpCost?: number; passive?: boolean; modifiers: AttributeModifier[] };
export type ItemDefinition = EquipmentDefinition | SkillItemDefinition;
export type Enchantment = { id: string; modifiers: AttributeModifier[]; skills?: EquipmentSkill[] };
export type PlainItem = { kind: 'plain'; definitionId: string };
export type UniqueItem = { kind: 'unique'; instanceId: string; definitionId: string; enchantments: Enchantment[]; skillLevels?: Record<string, number>; extraModifiers?: AttributeModifier[]; durability?: number };
export type ItemUnit = PlainItem | UniqueItem;
export type ItemInventory = { stacks: Record<string, number>; uniques: UniqueItem[] };

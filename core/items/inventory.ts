import type { Enchantment, EquipmentDefinition, ItemInventory, ItemUnit, UniqueItem } from './types.ts';

export type ItemSelector = { kind: 'stack'; definitionId: string } | { kind: 'unique'; instanceId: string };
export function makeItem(definition: EquipmentDefinition, instanceId?: string): ItemUnit {
  if (definition.wear.kind === 'chanceOnly') return { kind: 'plain', definitionId: definition.id };
  if (!instanceId) throw new Error('有耐久的物品需要独立实例 ID。');
  return { kind: 'unique', instanceId, definitionId: definition.id, enchantments: [], durability: definition.wear.maxDurability };
}
export function takeItem(inventory: ItemInventory, selector: ItemSelector): { inventory: ItemInventory; item: ItemUnit } {
  if (selector.kind === 'stack') {
    const count = inventory.stacks[selector.definitionId] ?? 0;
    if (!Number.isInteger(count) || count <= 0) throw new Error('物品堆叠数量不足。');
    return { inventory: { ...inventory, stacks: { ...inventory.stacks, [selector.definitionId]: count - 1 } }, item: { kind: 'plain', definitionId: selector.definitionId } };
  }
  const index = inventory.uniques.findIndex(item => item.instanceId === selector.instanceId);
  if (index < 0) throw new Error('独立物品不存在。');
  return { inventory: { ...inventory, uniques: inventory.uniques.filter((_, position) => position !== index) }, item: inventory.uniques[index] };
}
export function canStack(item: ItemUnit, definition: EquipmentDefinition): boolean {
  return item.kind === 'plain' && definition.wear.kind === 'chanceOnly' || item.kind === 'unique' && definition.wear.kind === 'chanceOnly' && !item.enchantments.length && !Object.keys(item.skillLevels ?? {}).length && !item.extraModifiers?.length && item.durability === undefined;
}
export function putItem(inventory: ItemInventory, item: ItemUnit, definition: EquipmentDefinition): ItemInventory {
  if (item.definitionId !== definition.id) throw new Error('物品定义不匹配。');
  if (canStack(item, definition)) return { ...inventory, stacks: { ...inventory.stacks, [definition.id]: (inventory.stacks[definition.id] ?? 0) + 1 } };
  if (item.kind !== 'unique') throw new Error('有耐久的物品必须保存独立实例。');
  if (inventory.uniques.some(existing => existing.instanceId === item.instanceId)) throw new Error('独立物品 ID 重复。');
  return { ...inventory, uniques: [...inventory.uniques, item] };
}
export function enchantItem(item: ItemUnit, definition: EquipmentDefinition, enchantment: Enchantment, instanceId?: string): UniqueItem {
  if (item.definitionId !== definition.id) throw new Error('物品定义不匹配。');
  if (!enchantment.id) throw new Error('附魔需要 ID。');
  if (item.kind === 'plain' && !instanceId) throw new Error('从堆叠中附魔时需要新的实例 ID。');
  const unique: UniqueItem = item.kind === 'unique' ? item : { kind: 'unique', definitionId: item.definitionId, instanceId: instanceId!, enchantments: [] };
  if (unique.enchantments.some(value => value.id === enchantment.id)) throw new Error('同一物品不能重复添加相同附魔。');
  return { ...unique, enchantments: [...unique.enchantments, enchantment] };
}

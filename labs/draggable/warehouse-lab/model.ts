import type { ItemInventory, UniqueItem } from '../../../core/items/types.ts';
import type { EffectSets, EffectTargetState, ItemEffect, ItemStock, ItemUseAction, UsableItemDefinition } from '../../../core/items/usage.ts';

export type WarehouseItem = UsableItemDefinition & { name: string; category: '材料' | '消耗品' | '装备' | '任务物品'; description: string; stackable: boolean; maxDurability?: number };
const fixed = (value: number) => ({ kind: 'fixed' as const, value });
const action = (target: ItemUseAction['target'], cost: ItemUseAction['cost'], effects: readonly ItemEffect[]): ItemUseAction => ({ target, cost, effects });
export const effectSets: EffectSets = { 'herb-recovery': [{ type: 'restore', resource: 'hp', amount: fixed(12) }] };
export const items: WarehouseItem[] = [
  { id: 'iron-ore', name: '铁矿石', category: '材料', description: '用于锻造的常见矿石，可以成批存放。', stackable: true, storage: { backpackLimit: 10, warehouseLimit: 99 }, use: { field: action('self', 'consumeOne', [{ type: 'triggerEvent', eventId: 'craft.iron' }]) } },
  { id: 'herb', name: '药草', category: '材料', description: '战斗内外都能使用，两个场景共用同一效果组。', stackable: true, storage: { backpackLimit: 5, warehouseLimit: 99 }, use: { battle: { target: 'oneAlly', cost: 'consumeOne', effectSetId: 'herb-recovery' }, field: { target: 'oneAlly', cost: 'consumeOne', effectSetId: 'herb-recovery' } } },
  { id: 'potion', name: '治疗药剂', category: '消耗品', description: '战斗中恢复 50 HP，战斗外恢复 80 HP。', stackable: true, storage: { backpackLimit: 3, warehouseLimit: 50 }, use: { battle: action('oneAlly', 'consumeOne', [{ type: 'restore', resource: 'hp', amount: fixed(50) }]), field: action('oneAlly', 'consumeOne', [{ type: 'restore', resource: 'hp', amount: fixed(80) }]) } },
  { id: 'screwdriver', name: '工匠螺丝刀', category: '装备', description: '战斗中可攻击，战斗外可触发修理事件；使用后才判定损耗。', stackable: true, storage: { backpackLimit: 2, warehouseLimit: 10 }, wear: { kind: 'chanceOnly', breakChance: 0.05 }, use: { battle: action('oneEnemy', 'wearCheck', [{ type: 'damage', amount: fixed(18) }]), field: action('self', 'wearCheck', [{ type: 'triggerEvent', eventId: 'tool.repair' }]) } },
  { id: 'relic', name: '传承之刃', category: '装备', description: '带耐久的珍贵武器，每件独立存储。', stackable: false, maxDurability: 5, storage: { backpackLimit: 1, warehouseLimit: 2 }, wear: { kind: 'durability', breakChance: 0.25, maxDurability: 5, durabilityLoss: 1 }, use: { battle: action('oneEnemy', 'wearCheck', [{ type: 'damage', amount: fixed(35) }]) } },
  { id: 'key', name: '古旧钥匙', category: '任务物品', description: '只能在战斗外触发开锁事件，每把都有独立来历。', stackable: false, storage: { backpackLimit: 1, warehouseLimit: 5 }, use: { field: action('self', 'none', [{ type: 'triggerEvent', eventId: 'door.unlock' }]) } },
];
export const catalog = Object.fromEntries(items.map(item => [item.id, item])) as Record<string, WarehouseItem>;
export const categories = ['全部', '材料', '消耗品', '装备', '任务物品'] as const;
export type CategoryFilter = typeof categories[number];
export type Warehouse = ItemInventory;
export type Selection = { definitionId: string; instanceId?: string };
export function sampleBackpack(): ItemInventory { return { stacks: { potion: 1, herb: 1 }, uniques: [] }; }
export function sampleStock(): ItemStock { return { warehouse: sample(), backpack: sampleBackpack() }; }
export function sampleTargets(): { hero: EffectTargetState; enemy: EffectTargetState } { return { hero: { id: 'hero', hp: 20, maxHp: 100, mp: 10, maxMp: 30, sp: 0, maxSp: 10, statuses: {} }, enemy: { id: 'enemy', hp: 100, maxHp: 100, mp: 0, maxMp: 0, sp: 0, maxSp: 0, statuses: {} } }; }

export function sample(): Warehouse {
  return { stacks: { 'iron-ore': 36, herb: 18, potion: 8, screwdriver: 3 }, uniques: [
    { kind: 'unique', definitionId: 'relic', instanceId: 'sample-relic-1', durability: 5, enchantments: [] },
    { kind: 'unique', definitionId: 'key', instanceId: 'sample-key-1', enchantments: [] },
    { kind: 'unique', definitionId: 'screwdriver', instanceId: 'sample-tool-1', enchantments: [{ id: '锋锐', modifiers: [{ attribute: 'attack', stage: 'first', value: 0.1 }] }] },
  ] };
}
export function count(inventory: Warehouse, definitionId: string): number {
  return (inventory.stacks[definitionId] ?? 0) + inventory.uniques.filter(item => item.definitionId === definitionId).length;
}
export function selectedUnit(inventory: Warehouse, selection: Selection | null): UniqueItem | null {
  return selection?.instanceId ? inventory.uniques.find(item => item.instanceId === selection.instanceId && item.definitionId === selection.definitionId) ?? null : null;
}
export function deposit(inventory: Warehouse, definitionId: string, amount: number, instanceId?: string): Warehouse {
  const definition = catalog[definitionId];
  if (!definition || !Number.isInteger(amount) || amount < 1) throw new Error('存入物品或数量无效。');
  if (!definition.stackable && (amount !== 1 || !instanceId || inventory.uniques.some(item => item.instanceId === instanceId))) throw new Error('独立物品需要唯一实例编号，一次只能存入一件。');
  if (count(inventory, definitionId) + amount > definition.storage.warehouseLimit) throw new Error('仓库已达到该物品的上限。');
  if (definition.stackable) return { ...inventory, stacks: { ...inventory.stacks, [definitionId]: (inventory.stacks[definitionId] ?? 0) + amount } };
  const item: UniqueItem = { kind: 'unique', definitionId, instanceId: instanceId!, enchantments: [], ...(definition.maxDurability ? { durability: definition.maxDurability } : {}) };
  return { ...inventory, uniques: [...inventory.uniques, item] };
}
export function withdraw(inventory: Warehouse, selection: Selection, amount: number): Warehouse {
  const definition = catalog[selection.definitionId];
  if (!definition || !Number.isInteger(amount) || amount < 1) throw new Error('取出物品或数量无效。');
  if (selection.instanceId) {
    if (amount !== 1 || !selectedUnit(inventory, selection)) throw new Error('独立物品已不在仓库，一次只能取出一件。');
    return { ...inventory, uniques: inventory.uniques.filter(item => item.instanceId !== selection.instanceId) };
  }
  const owned = inventory.stacks[selection.definitionId] ?? 0;
  if (owned < amount) throw new Error('所选堆叠的数量不足。');
  return { ...inventory, stacks: { ...inventory.stacks, [selection.definitionId]: owned - amount } };
}

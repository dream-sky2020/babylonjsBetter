import type { EquipmentDefinition, ItemUnit } from './types.ts';

export type UseResult = { item: ItemUnit | null; wore: boolean; destroyed: boolean };
/** Called once after an eligible use. A successful chance reduces durability, or destroys a chance-only item. */
export function useItem(item: ItemUnit, definition: EquipmentDefinition, random: () => number = Math.random): UseResult {
  if (item.definitionId !== definition.id) throw new Error('物品定义不匹配。');
  const wear = definition.wear;
  if (!Number.isFinite(wear.breakChance) || wear.breakChance < 0 || wear.breakChance > 1) throw new Error('损耗概率必须在 0 到 1 之间。');
  const roll = random();
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new Error('随机数必须在 [0, 1) 内。');
  if (roll >= wear.breakChance) return { item, wore: false, destroyed: false };
  if (wear.kind === 'chanceOnly') return { item: null, wore: true, destroyed: true };
  if (item.kind !== 'unique' || item.durability === undefined) throw new Error('有耐久的物品缺少当前耐久值。');
  if (!Number.isInteger(wear.maxDurability) || wear.maxDurability <= 0 || !Number.isInteger(wear.durabilityLoss) || wear.durabilityLoss <= 0) throw new Error('耐久规则无效。');
  const remaining = Math.max(0, item.durability - wear.durabilityLoss);
  return { item: remaining === 0 ? null : { ...item, durability: remaining }, wore: true, destroyed: remaining === 0 };
}

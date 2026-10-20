import type { ItemInventory, UniqueItem, WearRule } from './types.ts';

export type UseContext = 'battle' | 'field';
export type UseTarget = 'self' | 'oneAlly' | 'oneEnemy' | 'allAllies' | 'allEnemies';
export type UseCost = 'consumeOne' | 'wearCheck' | 'none';
export type EffectAmount = { kind: 'fixed'; value: number } | { kind: 'maxPercent'; ratio: number };
export type ItemEffect =
  | { type: 'restore'; resource: 'hp' | 'mp' | 'sp'; amount: EffectAmount }
  | { type: 'damage'; amount: EffectAmount }
  | { type: 'applyStatus'; statusId: string; chance: number; turns: number }
  | { type: 'triggerEvent'; eventId: string };
export type EffectAction = { target: UseTarget } & (
  | { effects: readonly ItemEffect[]; effectSetId?: never }
  | { effectSetId: string; effects?: never }
);
export type ItemUseAction = EffectAction & { cost: UseCost };
export type ItemUseProfiles = { battle?: ItemUseAction; field?: ItemUseAction };
export type ItemStorageLimits = { backpackLimit: number; warehouseLimit: number };
export type UsableItemDefinition = { id: string; storage: ItemStorageLimits; use?: ItemUseProfiles; wear?: WearRule };
export type EffectSets = Readonly<Record<string, readonly ItemEffect[]>>;
export type EffectTargetState = { id: string; hp: number; maxHp: number; mp: number; maxMp: number; sp: number; maxSp: number; statuses: Record<string, number> };
export type ItemStock = { warehouse: ItemInventory; backpack: ItemInventory };
export type ItemSelection = { definitionId: string; instanceId?: string };
export type UseOutcome = { stock: ItemStock; targets: EffectTargetState[]; events: string[]; consumed: boolean; wore: boolean; destroyed: boolean; turnCost: 0 | 1 };

export function inventoryCount(inventory: ItemInventory, definitionId: string): number {
  return (inventory.stacks[definitionId] ?? 0) + inventory.uniques.filter(item => item.definitionId === definitionId).length;
}
function limits(definition: UsableItemDefinition): ItemStorageLimits {
  const result = definition.storage;
  if (!Number.isSafeInteger(result.backpackLimit) || result.backpackLimit < 0 || !Number.isSafeInteger(result.warehouseLimit) || result.warehouseLimit < 0) throw new Error('背包和仓库上限必须是非负整数。');
  return result;
}
function take(inventory: ItemInventory, selection: ItemSelection, amount: number): ItemInventory {
  if (selection.instanceId) {
    if (amount !== 1 || !inventory.uniques.some(item => item.instanceId === selection.instanceId && item.definitionId === selection.definitionId)) throw new Error('所选独立物品不存在。');
    return { ...inventory, uniques: inventory.uniques.filter(item => item.instanceId !== selection.instanceId) };
  }
  const count = inventory.stacks[selection.definitionId] ?? 0;
  if (count < amount) throw new Error('所选堆叠数量不足。');
  return { ...inventory, stacks: { ...inventory.stacks, [selection.definitionId]: count - amount } };
}
function put(inventory: ItemInventory, selection: ItemSelection, amount: number, unit?: UniqueItem): ItemInventory {
  if (unit) {
    if (inventory.uniques.some(item => item.instanceId === unit.instanceId)) throw new Error('独立物品编号重复。');
    return { ...inventory, uniques: [...inventory.uniques, unit] };
  }
  return { ...inventory, stacks: { ...inventory.stacks, [selection.definitionId]: (inventory.stacks[selection.definitionId] ?? 0) + amount } };
}
/** Moves inventory without changing the total number of items. Outside battle this costs no turn. */
export function transferItem(stock: ItemStock, definition: UsableItemDefinition, from: keyof ItemStock, selection: ItemSelection, amount: number): ItemStock {
  if (selection.definitionId !== definition.id || !Number.isSafeInteger(amount) || amount < 1) throw new Error('转移物品或数量无效。');
  const to = from === 'warehouse' ? 'backpack' : 'warehouse';
  const max = from === 'warehouse' ? limits(definition).backpackLimit : limits(definition).warehouseLimit;
  if (inventoryCount(stock[to], definition.id) + amount > max) throw new Error(`${to === 'backpack' ? '背包' : '仓库'}已达到该物品的上限。`);
  const unit = selection.instanceId ? stock[from].uniques.find(item => item.instanceId === selection.instanceId && item.definitionId === definition.id) : undefined;
  if (selection.instanceId && !unit) throw new Error('所选独立物品不存在。');
  const source = take(stock[from], selection, amount);
  const target = put(stock[to], selection, amount, unit);
  return { ...stock, [from]: source, [to]: target };
}
/** A battle preparation action: refill one item type to its backpack limit, spending one ordinary turn only when something moves. */
export function restockItem(stock: ItemStock, definition: UsableItemDefinition, selection?: ItemSelection): { stock: ItemStock; moved: number; turnCost: 0 | 1 } {
  const free = Math.max(0, limits(definition).backpackLimit - inventoryCount(stock.backpack, definition.id));
  const chosen = selection ?? ((stock.warehouse.stacks[definition.id] ?? 0) > 0 ? { definitionId: definition.id } : { definitionId: definition.id, instanceId: stock.warehouse.uniques.find(item => item.definitionId === definition.id)?.instanceId });
  if (chosen.definitionId !== definition.id) throw new Error('整备物品与定义不匹配。');
  const available = chosen.instanceId ? stock.warehouse.uniques.some(item => item.instanceId === chosen.instanceId && item.definitionId === definition.id) ? 1 : 0 : stock.warehouse.stacks[definition.id] ?? 0;
  const moved = Math.min(free, available);
  if (moved < 1) return { stock, moved: 0, turnCost: 0 };
  return { stock: transferItem(stock, definition, 'warehouse', chosen, moved), moved, turnCost: 1 };
}
export function effectsFor(action: EffectAction, sets: EffectSets = {}): readonly ItemEffect[] {
  if ('effects' in action && action.effects) return action.effects;
  const effects = sets[action.effectSetId!];
  if (!effects) throw new Error(`效果组不存在：${action.effectSetId}。`);
  return effects;
}
function amountValue(amount: EffectAmount, maximum: number): number {
  const value = amount.kind === 'fixed' ? amount.value : maximum * amount.ratio;
  if (!Number.isFinite(value) || value < 0) throw new Error('效果数值无效。');
  return Math.floor(value);
}
export function applyEffects(targets: readonly EffectTargetState[], effects: readonly ItemEffect[], random: () => number): { targets: EffectTargetState[]; events: string[] } {
  const next = structuredClone(targets) as EffectTargetState[];
  const events: string[] = [];
  for (const effect of effects) {
    if (effect.type === 'triggerEvent') { if (!effect.eventId) throw new Error('事件 ID 不能为空。'); events.push(effect.eventId); continue; }
    for (const target of next) {
      if (effect.type === 'applyStatus') {
        if (!effect.statusId || !Number.isFinite(effect.chance) || effect.chance < 0 || effect.chance > 1 || !Number.isSafeInteger(effect.turns) || effect.turns < 1) throw new Error('状态效果无效。');
        if (random() < effect.chance) target.statuses[effect.statusId] = Math.max(target.statuses[effect.statusId] ?? 0, effect.turns);
      } else if (effect.type === 'damage') target.hp = Math.max(0, target.hp - amountValue(effect.amount, target.maxHp));
      else { const key = effect.resource; const maximum = target[`max${key[0].toUpperCase()}${key.slice(1)}` as 'maxHp' | 'maxMp' | 'maxSp']; target[key] = Math.min(maximum, target[key] + amountValue(effect.amount, maximum)); }
    }
  }
  return { targets: next, events };
}
/** Resolves use against explicit targets. Battle draws from backpack; field draws from warehouse. Invalid uses leave all input unchanged. */
export function resolveItemUse(stock: ItemStock, definition: UsableItemDefinition, context: UseContext, selection: ItemSelection, targets: readonly EffectTargetState[], sets: EffectSets = {}, random: () => number = Math.random): UseOutcome {
  const action = definition.use?.[context];
  if (!action) throw new Error(`此物品不能在${context === 'battle' ? '战斗中' : '战斗外'}使用。`);
  if (selection.definitionId !== definition.id || targets.length < 1) throw new Error('物品或目标无效。');
  const effects = effectsFor(action, sets);
  const source = context === 'battle' ? 'backpack' : 'warehouse';
  const inventory = stock[source];
  const unique = selection.instanceId ? inventory.uniques.find(item => item.instanceId === selection.instanceId && item.definitionId === definition.id) : undefined;
  if (selection.instanceId ? !unique : (inventory.stacks[definition.id] ?? 0) < 1) throw new Error(`${source === 'backpack' ? '战斗背包' : '仓库'}中没有所选物品。`);
  if (action.cost === 'wearCheck' && !definition.wear) throw new Error('此物品缺少使用损耗规则。');
  const result = applyEffects(targets, effects, random);
  const turnCost = context === 'battle' ? 1 : 0;
  if (action.cost === 'none') return { stock, ...result, consumed: false, wore: false, destroyed: false, turnCost };
  if (action.cost === 'consumeOne') return { stock: { ...stock, [source]: take(inventory, selection, 1) }, ...result, consumed: true, wore: false, destroyed: true, turnCost };
  const wear = definition.wear!;
  if (!Number.isFinite(wear.breakChance) || wear.breakChance < 0 || wear.breakChance > 1) throw new Error('损耗概率无效。');
  const wore = random() < wear.breakChance;
  if (!wore) return { stock, ...result, consumed: false, wore: false, destroyed: false, turnCost };
  if (wear.kind === 'chanceOnly') return { stock: { ...stock, [source]: take(inventory, selection, 1) }, ...result, consumed: true, wore: true, destroyed: true, turnCost };
  if (!unique || unique.durability === undefined || !Number.isSafeInteger(wear.durabilityLoss) || wear.durabilityLoss < 1) throw new Error('耐久物品数据无效。');
  const durability = Math.max(0, unique.durability - wear.durabilityLoss);
  const nextInventory = durability === 0 ? take(inventory, selection, 1) : { ...inventory, uniques: inventory.uniques.map(item => item.instanceId === unique.instanceId ? { ...item, durability } : item) };
  return { stock: { ...stock, [source]: nextInventory }, ...result, consumed: durability === 0, wore: true, destroyed: durability === 0, turnCost };
}
